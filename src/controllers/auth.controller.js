/* ==========================================================================
   Auth controller
   Thin: parse, delegate, format. No business logic lives here.
   ========================================================================== */

const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/response');
const authService = require('../services/auth.service');
const auditService = require('../services/audit.service');
const present = require('../utils/present');

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password, req, res);

  await auditService.record(
    { ...req, user: { id: result.user.id, rank_title: result.user.rank, full_name: result.user.name } },
    'USER_LOGIN', 'user', result.user.badge, 'Session opened'
  );

  return ok(res, result);
});

exports.refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req, res);
  return ok(res, result);
});

exports.logout = asyncHandler(async (req, res) => {
  await authService.logout(req, res);
  return ok(res, { signedOut: true });
});

exports.me = asyncHandler(async (req, res) => ok(res, { user: present.user(req.user) }));

exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req.user.id, currentPassword, newPassword);

  await auditService.record(req, 'PASSWORD_CHANGE', 'user', req.user.badge_number,
    'Password changed; all other sessions revoked');

  return ok(res, {
    changed: true,
    message: 'Password changed. Every other device signed in on this account has been signed out.'
  });
});
