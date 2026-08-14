/* ==========================================================================
   Authentication
   Verifies the access token and attaches the live user record to the
   request. The token is not trusted for anything beyond identity — role and
   station are re-read from the database on every request, so a role change
   or suspension takes effect immediately rather than at token expiry.
   ========================================================================== */

const ApiError = require('../utils/ApiError');
const token = require('../utils/token');
const userRepo = require('../repositories/user.repository');

module.exports = async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      throw ApiError.unauthorized('No access token supplied.');
    }

    let payload;
    try {
      payload = token.verifyAccess(header.slice(7));
    } catch (err) {
      throw ApiError.unauthorized(
        err.name === 'TokenExpiredError'
          ? 'Your session has expired. Refreshing.'
          : 'That access token is not valid.'
      );
    }

    const user = await userRepo.findById(payload.sub);
    if (!user) throw ApiError.unauthorized('This account no longer exists.');
    if (user.status === 'suspended') throw ApiError.forbidden('This account is suspended.');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};
