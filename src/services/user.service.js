/* ==========================================================================
   User service
   Creating accounts, changing roles, suspending, and administrator-issued
   password resets.
   ========================================================================== */

const bcrypt = require('bcrypt');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const present = require('../utils/present');
const userRepo = require('../repositories/user.repository');
const tokenRepo = require('../repositories/token.repository');
const stationRepo = require('../repositories/station.repository');
const { query } = require('../config/database');

/** Roles a Station Administrator is permitted to create or edit. They may
 *  staff their own station with officers and detectives, but cannot create
 *  a peer Station Administrator, a Commander, or another Super
 *  Administrator — authority only flows downward from the top tier. */
const STATION_ADMIN_MANAGEABLE_ROLES = ['officer', 'detective'];

async function list(scope) {
  const rows = await userRepo.list({
    stationId: scope.stationId,
    allStations: scope.role === 'admin'
  });

  // Overdue counts are a second pass rather than a correlated subquery in the
  // main list — cheaper, and this table is small.
  const overdue = await query(
    `SELECT detective_id AS id, COUNT(*) AS n FROM cases
      WHERE DATEDIFF(NOW(), opened_at) > 30
        AND status NOT IN ('Closed','Referred to NPA')
        AND detective_id IS NOT NULL
      GROUP BY detective_id`
  );
  const byId = {};
  overdue.forEach((r) => { byId[r.id] = Number(r.n); });

  return rows.map((r) => present.staff({ ...r, overdue_cases: byId[r.id] || 0 }));
}

async function create(data, actor) {
  const email = String(data.email).toLowerCase().trim();

  const existing = await userRepo.findByEmailWithSecret(email);
  if (existing) {
    throw ApiError.conflict('An account already uses that email address.');
  }

  var role = data.role;
  var stationId = data.stationId;

  // A Station Administrator cannot create an account outside their own
  // station, or an account senior to their own role. The station and role
  // they submit are checked rather than trusted.
  if (actor.role === 'station_admin') {
    if (!STATION_ADMIN_MANAGEABLE_ROLES.includes(role)) {
      throw ApiError.forbidden(
        'A Station Administrator may only create Officer or Detective accounts. ' +
        'Administrator, Station Administrator and Commander accounts are created by a Super Administrator.'
      );
    }
    stationId = actor.station_id; // ignore whatever station was submitted
  }

  // A new account gets a known temporary password and is forced to change it
  // at first sign-in, so no administrator ever knows a user's live password.
  const temporary = data.password || env.defaultPassword;
  const passwordHash = await bcrypt.hash(temporary, env.bcryptRounds);

  const user = await userRepo.create({
    badgeNumber: data.badgeNumber,
    fullName: data.fullName,
    rankTitle: data.rankTitle,
    email,
    passwordHash,
    role,
    stationId,
    capacity: data.capacity
  });

  return { user: present.user(user), temporaryPassword: temporary };
}

async function update(id, fields, actor) {
  const user = await userRepo.findById(id);
  if (!user) throw ApiError.notFound('That account does not exist.');

  if (actor.role === 'station_admin') {
    if (user.station_id !== actor.station_id) {
      throw ApiError.forbidden('You may only manage accounts at your own station.');
    }
    if (!STATION_ADMIN_MANAGEABLE_ROLES.includes(user.role)) {
      throw ApiError.forbidden('You may only manage Officer and Detective accounts.');
    }
    if (fields.role && !STATION_ADMIN_MANAGEABLE_ROLES.includes(fields.role)) {
      throw ApiError.forbidden('You may not promote an account beyond Officer or Detective.');
    }
    delete fields.stationId; // cannot move an account to another station
  }

  const patch = {};
  if (fields.fullName)  patch.full_name = fields.fullName;
  if (fields.rankTitle) patch.rank_title = fields.rankTitle;
  if (fields.email)     patch.email = String(fields.email).toLowerCase().trim();
  if (fields.role)      patch.role = fields.role;
  if (fields.stationId) patch.station_id = fields.stationId;
  if (fields.status)    patch.status = fields.status;
  if (fields.capacity)  patch.caseload_capacity = fields.capacity;

  const updated = await userRepo.update(id, patch);

  // Suspending an account must take effect immediately, not at token expiry.
  if (patch.status === 'suspended') await tokenRepo.revokeAllForUser(id);

  return present.user(updated);
}

/** Administrator reset: issues a temporary password and forces a change. */
async function resetPassword(id, actor) {
  const user = await userRepo.findById(id);
  if (!user) throw ApiError.notFound('That account does not exist.');

  if (actor.role === 'station_admin' && user.station_id !== actor.station_id) {
    throw ApiError.forbidden('You may only reset passwords for accounts at your own station.');
  }

  const temporary = env.defaultPassword;
  const hash = await bcrypt.hash(temporary, env.bcryptRounds);

  await userRepo.setPassword(id, hash, 1);
  await tokenRepo.revokeAllForUser(id);

  return { temporaryPassword: temporary, user: present.user(user) };
}

/**
 * Super Administrator oversight: one row per Station Administrator, with
 * enough at-a-glance signal to answer "is this station's administration
 * healthy" without opening each account individually. This is the concrete
 * answer to "does a main administrator monitor the other administrators."
 */
async function stationAdminOversight() {
  const rows = await userRepo.list({ allStations: true, role: 'station_admin' });

  const staffCounts = await query(
    `SELECT station_id, COUNT(*) AS n FROM users
      WHERE role IN ('officer','detective') AND status != 'suspended'
      GROUP BY station_id`
  );
  const openCaseCounts = await query(
    `SELECT station_id, COUNT(*) AS n FROM cases
      WHERE status NOT IN ('Closed','Referred to NPA')
      GROUP BY station_id`
  );
  const staffById = {};
  staffCounts.forEach((r) => { staffById[r.station_id] = Number(r.n); });
  const openById = {};
  openCaseCounts.forEach((r) => { openById[r.station_id] = Number(r.n); });

  return rows.map((r) => ({
    id: r.id,
    name: r.full_name,
    rank: r.rank_title,
    badge: r.badge_number,
    email: r.email,
    station: r.station_name || 'Unassigned',
    stationCode: r.station_code || '—',
    status: r.status,
    lastLogin: r.last_login_at,
    staffManaged: staffById[r.station_id] || 0,
    openCases: openById[r.station_id] || 0
  }));
}

module.exports = { list, create, update, resetPassword, stationAdminOversight };
