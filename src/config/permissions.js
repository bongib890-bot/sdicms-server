/* ==========================================================================
   Role matrix
   The single source of truth for who may do what. Routes reference these
   permission names; no role string is hard-coded anywhere else.

   Administrator hierarchy:
     admin          — Super Administrator. National scope. Sees and manages
                       every station, every Station Administrator, and every
                       Commander. There is exactly one tier above a station.
     station_admin  — Station Administrator. Scoped to one station. Manages
                       that station's officer and detective accounts, resets
                       their passwords, and reviews that station's audit log
                       and evidence integrity. Cannot create another
                       Administrator or a Commander — that stays with the
                       Super Administrator, so the hierarchy cannot promote
                       itself.
   ========================================================================== */

const ROLES = ['admin', 'station_admin', 'commander', 'detective', 'officer'];

const PERMISSIONS = {
  'case:create':        ['admin', 'station_admin', 'commander', 'detective', 'officer'],
  'case:read':          ['admin', 'station_admin', 'commander', 'detective', 'officer'],
  'case:readAll':       ['admin', 'station_admin', 'commander'],
  'case:update':        ['admin', 'commander', 'detective'],
  'case:assign':        ['admin', 'commander'],
  'case:approve':       ['admin', 'commander'],
  'case:note':          ['admin', 'station_admin', 'commander', 'detective', 'officer'],

  'evidence:create':    ['admin', 'commander', 'detective', 'officer'],
  'evidence:read':      ['admin', 'station_admin', 'commander', 'detective', 'officer'],
  'evidence:verify':    ['admin', 'commander', 'detective'],
  'evidence:custody':   ['admin', 'commander', 'detective'],

  'document:create':    ['admin', 'commander', 'detective', 'officer'],
  'document:read':      ['admin', 'station_admin', 'commander', 'detective', 'officer'],

  'suspect:create':     ['admin', 'commander', 'detective'],
  'statement:create':   ['admin', 'commander', 'detective', 'officer'],

  // Accounts: a Station Administrator manages their own station's people;
  // only the Super Administrator can create another Administrator or a
  // Commander, so authority can never be self-granted from below.
  'user:read':          ['admin', 'station_admin', 'commander'],
  'user:create':        ['admin', 'station_admin'],
  'user:update':        ['admin', 'station_admin'],
  'user:resetPassword': ['admin', 'station_admin'],

  'station:read':       ['admin', 'station_admin', 'commander', 'detective', 'officer'],
  'station:write':      ['admin'],

  // Oversight of Station Administrators themselves is Super Administrator
  // only — this is the screen that answers "who is watching the watchers".
  'admin:oversight':    ['admin'],

  'audit:read':         ['admin', 'station_admin', 'commander'],
  'report:generate':    ['admin', 'station_admin', 'commander', 'detective']
};

/**
 * Case lifecycle. A docket may only move along these edges, and only by a
 * role listed against the edge. Enforced server-side — a hidden button in
 * the UI is a convenience, not a control.
 */
const TRANSITIONS = {
  'Reported': [
    { to: 'Assigned', roles: ['admin', 'commander'] }
  ],
  'Assigned': [
    { to: 'Under investigation', roles: ['admin', 'commander', 'detective'] }
  ],
  'Under investigation': [
    { to: 'Awaiting forensics', roles: ['admin', 'commander', 'detective'] },
    { to: 'Pending approval', roles: ['admin', 'commander', 'detective'] }
  ],
  'Awaiting forensics': [
    { to: 'Under investigation', roles: ['admin', 'commander', 'detective'] }
  ],
  'Pending approval': [
    { to: 'Closed', roles: ['admin', 'commander'] },
    { to: 'Referred to NPA', roles: ['admin', 'commander'] },
    { to: 'Under investigation', roles: ['admin', 'commander'] }
  ],
  'Closed': [],
  'Referred to NPA': []
};

function can(role, permission) {
  return (PERMISSIONS[permission] || []).includes(role);
}

function allowedTransitions(status, role) {
  return (TRANSITIONS[status] || []).filter((t) => t.roles.includes(role)).map((t) => t.to);
}

module.exports = { ROLES, PERMISSIONS, TRANSITIONS, can, allowedTransitions };
