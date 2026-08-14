/* ==========================================================================
   Station repository
   ========================================================================== */

const { query, queryOne } = require('../config/database');

function list() {
  return query(
    `SELECT s.*,
            (SELECT COUNT(*) FROM users u WHERE u.station_id = s.id AND u.status = 'active') AS officers,
            (SELECT COUNT(*) FROM cases c WHERE c.station_id = s.id
               AND c.status NOT IN ('Closed','Referred to NPA')) AS open_cases,
            (SELECT COUNT(*) FROM cases c WHERE c.station_id = s.id) AS total_cases,
            (SELECT COUNT(*) FROM cases c WHERE c.station_id = s.id
               AND c.status IN ('Closed','Referred to NPA')) AS closed_cases
       FROM stations s
      WHERE s.is_active = 1
      ORDER BY s.province, s.name`
  );
}

function findById(id) {
  return queryOne('SELECT * FROM stations WHERE id = ?', [id]);
}

async function create(data) {
  const result = await query(
    'INSERT INTO stations (code, name, province, address, phone) VALUES (?,?,?,?,?)',
    [data.code, data.name, data.province, data.address || null, data.phone || null]
  );
  return findById(result.insertId);
}

module.exports = { list, findById, create };
