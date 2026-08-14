/* ==========================================================================
   Authentication service
   Sign in, token rotation, sign out and password change.

   Design points worth noting:
    • A wrong email and a wrong password produce the same message and take
      roughly the same time, so the endpoint cannot be used to enumerate
      which accounts exist.
    • Refresh tokens rotate on every use and are stored hashed.
    • Changing a password revokes every other session on that account.
   ========================================================================== */

const bcrypt = require('bcrypt');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const token = require('../utils/token');
const present = require('../utils/present');
const userRepo = require('../repositories/user.repository');
const tokenRepo = require('../repositories/token.repository');

const REFRESH_COOKIE = 'sdicms_refresh';

function expiryDate(spec) {
  const days = /^(\d+)d$/.exec(spec);
  const hours = /^(\d+)h$/.exec(spec);
  const ms = days ? Number(days[1]) * 86400000
    : hours ? Number(hours[1]) * 3600000
    : 7 * 86400000;
  return new Date(Date.now() + ms);
}

function cookieOptions() {
  return {
    httpOnly: true,                          // page scripts cannot read it
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',    // requires HTTPS in production
    path: '/api/v1/auth',
    maxAge: 7 * 86400000
  };
}

async function issueSession(user, req, res) {
  const tokenId = token.randomId();
  const refresh = token.signRefresh(user, tokenId);

  await tokenRepo.create({
    id: tokenId,
    userId: user.id,
    tokenHash: token.hashToken(refresh),
    expiresAt: expiryDate(env.jwt.refreshExpiry),
    userAgent: req.context ? req.context.userAgent : null,
    ip: req.context ? req.context.ip : null
  });

  res.cookie(REFRESH_COOKIE, refresh, cookieOptions());
  return token.signAccess(user);
}

async function login(email, password, req, res) {
  const generic = 'Those credentials do not match an account.';
  const user = await userRepo.findByEmailWithSecret(String(email).toLowerCase().trim());

  if (!user) {
    // Spend comparable time even when the account is absent.
    await bcrypt.compare(password, '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin');
    throw ApiError.unauthorized(generic);
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutes = Math.ceil((new Date(user.locked_until) - Date.now()) / 60000);
    throw ApiError.forbidden(
      `This account is locked after repeated failed attempts. Try again in ${minutes} minute(s), or ask your administrator to reset it.`
    );
  }

  if (user.status === 'suspended') {
    throw ApiError.forbidden('This account is suspended. Contact your station administrator.');
  }

  const match = await bcrypt.compare(password, user.password_hash);

  if (!match) {
    const attempts = user.failed_attempts + 1;
    const lockUntil = attempts >= env.maxLoginAttempts
      ? new Date(Date.now() + env.lockoutMinutes * 60000)
      : null;
    await userRepo.recordLoginFailure(user.id, lockUntil);

    if (lockUntil) {
      throw ApiError.forbidden(
        `Too many failed attempts. This account is locked for ${env.lockoutMinutes} minutes.`
      );
    }
    const left = env.maxLoginAttempts - attempts;
    throw ApiError.unauthorized(`${generic} ${left} attempt(s) remaining before the account locks.`);
  }

  await userRepo.recordLoginSuccess(user.id);
  const accessToken = await issueSession(user, req, res);
  const fresh = await userRepo.findById(user.id);

  return { accessToken, user: present.user(fresh) };
}

/**
 * Rotate: the presented refresh token is revoked and a new one issued. If a
 * revoked token is presented again, every session for that user is killed —
 * reuse is the signature of a stolen token.
 */
async function refresh(req, res) {
  const presented = req.cookies ? req.cookies[REFRESH_COOKIE] : null;
  if (!presented) throw ApiError.unauthorized('No refresh token. Sign in again.');

  let payload;
  try {
    payload = token.verifyRefresh(presented);
  } catch (err) {
    throw ApiError.unauthorized('Your session has expired. Sign in again.');
  }

  const stored = await tokenRepo.findActive(payload.jti);
  if (!stored) {
    await tokenRepo.revokeAllForUser(payload.sub);
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    throw ApiError.unauthorized('That session is no longer valid. Sign in again.');
  }

  if (stored.token_hash !== token.hashToken(presented)) {
    await tokenRepo.revokeAllForUser(payload.sub);
    throw ApiError.unauthorized('Session mismatch. All sessions on this account have been closed.');
  }

  await tokenRepo.revoke(payload.jti);

  const user = await userRepo.findByIdWithSecret(payload.sub);
  if (!user || user.status === 'suspended') {
    throw ApiError.unauthorized('This account can no longer sign in.');
  }

  const accessToken = await issueSession(user, req, res);
  const fresh = await userRepo.findById(user.id);
  return { accessToken, user: present.user(fresh) };
}

async function logout(req, res) {
  const presented = req.cookies ? req.cookies[REFRESH_COOKIE] : null;
  if (presented) {
    try {
      const payload = token.verifyRefresh(presented);
      await tokenRepo.revoke(payload.jti);
    } catch (err) { /* an invalid token is already useless */ }
  }
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
}

/**
 * Change own password. Requires the current one — knowing the session is not
 * the same as knowing the credential.
 */
async function changePassword(userId, currentPassword, newPassword) {
  const user = await userRepo.findByIdWithSecret(userId);
  if (!user) throw ApiError.notFound('Account not found.');

  const match = await bcrypt.compare(currentPassword, user.password_hash);
  if (!match) throw ApiError.badRequest('Your current password is not correct.', {
    currentPassword: 'This does not match the password on file.'
  });

  if (await bcrypt.compare(newPassword, user.password_hash)) {
    throw ApiError.badRequest('Choose a password you have not used here before.', {
      newPassword: 'This is the same as your current password.'
    });
  }

  const hash = await bcrypt.hash(newPassword, env.bcryptRounds);
  await userRepo.setPassword(userId, hash, 0);

  // Every other device holding a session is now signed out.
  await tokenRepo.revokeAllForUser(userId);
}

module.exports = { login, refresh, logout, changePassword, REFRESH_COOKIE };
