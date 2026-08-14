/* ==========================================================================
   User repository
   ========================================================================== */

const { query, queryOne } = require('../config/database');

const PUBLIC_COLUMNS = `
  u.id, u.badge_number, u.full_name, u.rank_title, u.email, u.role,
  u.station_id, u.status, u.caseload_capacity, u.must_change_password,
  u.password_changed_at, u.last_login_at, u.created_at,
  s.name AS station_name, s.code AS station_code, s.province AS station_province
`;

function findById(id) {
  return queryOne(
    `SELECT ${PUBLIC_COLUMNS} FROM users u
     LEFT JOIN stations s ON s.id = u.station_id WHERE u.id = ?`, [id]
  );
}

/** Includes the password hash — used only by the auth service. */
function findByEmailWithSecret(email) {
  return queryOne(
    `SELECT u.*, s.name AS station_name, s.code AS station_code
       FROM users u LEFT JOIN stations s ON s.id = u.station_id
      WHERE u.email = ?`, [email]
  );
}

function findByIdWithSecret(id) {
  return queryOne('SELECT * FROM users WHERE id = ?', [id]);
}

function list({ stationId = null, role = null, allStations = true } = {}) {
  const where = [];
  const params = [];
  if (!allStations && stationId) { where.push('u.station_id = ?'); params.push(stationId); }
  if (role) { where.push('u.role = ?'); params.push(role); }

  return query(
    `SELECT ${PUBLIC_COLUMNS},
            (SELECT COUNT(*) FROM cases c
              WHERE c.detective_id = u.id
                AND c.status NOT IN ('Closed','Referred to NPA')) AS active_cases,
            (SELECT COUNT(*) FROM cases c
              WHERE c.detective_id = u.id
                AND c.status IN ('Closed','Referred to NPA'))     AS closed_cases
       FROM users u
       LEFT JOIN stations s ON s.id = u.station_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY FIELD(u.role,'admin','commander','detective','officer'), u.full_name`,
    params
  );
}

async function create(data) {
  const result = await query(
    `INSERT INTO users
       (badge_number, full_name, rank_title, email, password_hash, role,
        station_id, caseload_capacity, must_change_password, password_changed_at)
     VALUES (?,?,?,?,?,?,?,?,1,NOW())`,
    [data.badgeNumber, data.fullName, data.rankTitle, data.email, data.passwordHash,
     data.role, data.stationId || null, data.capacity || 18]
  );
  return findById(result.insertId);
}

async function update(id, fields) {
  const allowed = ['full_name', 'rank_title', 'email', 'role', 'station_id', 'status', 'caseload_capacity'];
  const sets = [];
  const params = [];

  Object.keys(fields).forEach((k) => {
    if (allowed.includes(k) && fields[k] !== undefined) {
      sets.push(`${k} = ?`);
      params.push(fields[k]);
    }
  });

  if (!sets.length) return findById(id);
  params.push(id);
  await query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
  return findById(id);
}

function setPassword(id, passwordHash, mustChange = 0) {
  return query(
    `UPDATE users
        SET password_hash = ?, must_change_password = ?, password_changed_at = NOW(),
            failed_attempts = 0, locked_until = NULL
      WHERE id = ?`,
    [passwordHash, mustChange, id]
  );
}

function recordLoginSuccess(id) {
  return query(
    'UPDATE users SET last_login_at = NOW(), failed_attempts = 0, locked_until = NULL WHERE id = ?', [id]
  );
}

function recordLoginFailure(id, lockUntil) {
  return query(
    'UPDATE users SET failed_attempts = failed_attempts + 1, locked_until = ? WHERE id = ?',
    [lockUntil, id]
  );
}

module.exports = {
  findById, findByEmailWithSecret, findByIdWithSecret, list,
  create, update, setPassword, recordLoginSuccess, recordLoginFailure
};
