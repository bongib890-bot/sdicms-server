/* ==========================================================================
   JWT issue and verify
   Short-lived access token in the Authorization header; long-lived refresh
   token in an httpOnly cookie so page scripts cannot read it.
   ========================================================================== */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

function signAccess(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      station: user.station_id,
      badge: user.badge_number
    },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiry }
  );
}

function signRefresh(user, tokenId) {
  return jwt.sign(
    { sub: user.id, jti: tokenId },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpiry }
  );
}

function verifyAccess(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

function verifyRefresh(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

/** Refresh tokens are stored hashed, never in plain text. */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function randomId() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh, hashToken, randomId };
