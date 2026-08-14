/* ==========================================================================
   Authorisation
   Two separate checks:
     authorize(permission)  — may this role perform this kind of action
     scopeToStation(...)    — may this user touch this particular record
   Role alone is never enough: a commander at one station must not read
   another station's dockets.
   ========================================================================== */

const ApiError = require('../utils/ApiError');
const { can } = require('../config/permissions');

function authorize(permission) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!can(req.user.role, permission)) {
      return next(ApiError.forbidden(
        `A ${req.user.role} may not perform this action (${permission}).`
      ));
    }
    next();
  };
}

/**
 * Attaches the ownership predicate the repositories use when listing.
 *   admin          — everything, every station
 *   station_admin  — their station only (accounts, audit, evidence)
 *   commander      — their station only (dockets, operations)
 *   detective      — dockets assigned to them, plus anything at their
 *                     station they created
 *   officer        — dockets they registered
 */
function withScope(req, res, next) {
  const u = req.user;
  req.scope = {
    role: u.role,
    userId: u.id,
    stationId: u.station_id,
    allStations: u.role === 'admin',
    ownOnly: u.role === 'detective' || u.role === 'officer'
  };
  next();
}

module.exports = { authorize, withScope };
