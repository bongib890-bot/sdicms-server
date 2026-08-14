/* ==========================================================================
   User controller
   ========================================================================== */

const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const userService = require('../services/user.service');
const auditService = require('../services/audit.service');

exports.list = asyncHandler(async (req, res) => ok(res, await userService.list(req.scope)));

exports.create = asyncHandler(async (req, res) => {
  const result = await userService.create(req.body, req.user);

  await auditService.record(req, 'USER_CREATE', 'user', result.user.badge,
    `${result.user.name} created as ${result.user.role}`);

  return created(res, {
    user: result.user,
    temporaryPassword: result.temporaryPassword,
    message: `Account created. Issue the temporary password to ${result.user.name}; ` +
             'they will be required to change it at first sign-in.'
  });
});

exports.update = asyncHandler(async (req, res) => {
  const user = await userService.update(Number(req.params.id), req.body, req.user);

  await auditService.record(req, 'USER_UPDATE', 'user', user.badge,
    Object.keys(req.body).join(', ') + ' updated');

  return ok(res, user);
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const result = await userService.resetPassword(Number(req.params.id), req.user);

  await auditService.record(req, 'PASSWORD_RESET', 'user', result.user.badge,
    `Reset by ${req.user.role === 'admin' ? 'Super Administrator' : 'Station Administrator'}; all sessions revoked`);

  return ok(res, {
    temporaryPassword: result.temporaryPassword,
    message: `Password reset for ${result.user.name}. They must change it at next sign-in.`
  });
});

/** Super Administrator only — one row per Station Administrator. */
exports.stationAdminOversight = asyncHandler(async (req, res) =>
  ok(res, await userService.stationAdminOversight()));
