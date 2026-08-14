/* ==========================================================================
   Case repository
   All docket reads carry an ownership predicate built from the request
   scope, so authorisation cannot be bypassed by calling an endpoint directly.
   ========================================================================== */

const { query, queryOne, transaction } = require('../config/database');
const { caseNumber } = require('../utils/caseNumber');

const SELECT_CASE = `
  SELECT c.*,
         d.full_name  AS detective_name,
         d.badge_number AS detective_badge,
         cr.full_name AS created_by_name,
         st.name      AS station_name,
         st.code      AS station_code,
         DATEDIFF(NOW(), c.opened_at) AS days_open,
         TIMESTAMPDIFF(MINUTE, c.last_activity_at, NOW()) AS minutes_since_activity,
         (SELECT COUNT(*) FROM evidence e   WHERE e.case_id = c.id)   AS evidence_count,
         (SELECT COUNT(*) FROM suspects s   WHERE s.case_id = c.id)   AS suspect_count,
         (SELECT COUNT(*) FROM statements t WHERE t.case_id = c.id)   AS statement_count,
         (SELECT COUNT(*) FROM documents dc WHERE dc.case_id = c.id)  AS document_count
    FROM cases c
    LEFT JOIN users d     ON d.id  = c.detective_id
    LEFT JOIN users cr    ON cr.id = c.created_by
    LEFT JOIN stations st ON st.id = c.station_id
`;

/** Builds the WHERE fragment that enforces who may see which dockets. */
function scopeClause(scope) {
  if (!scope || scope.allStations) return { sql: '', params: [] };

  if (scope.role === 'commander') {
    return { sql: 'c.station_id = ?', params: [scope.stationId] };
  }
  if (scope.role === 'detective') {
    return {
      sql: '(c.detective_id = ? OR c.created_by = ? OR (c.station_id = ? AND c.detective_id IS NULL))',
      params: [scope.userId, scope.userId, scope.stationId]
    };
  }
  // officer
  return { sql: '(c.created_by = ? OR c.detective_id = ?)', params: [scope.userId, scope.userId] };
}

async function list(scope, filters = {}) {
  const where = [];
  const params = [];

  const s = scopeClause(scope);
  if (s.sql) { where.push(s.sql); params.push(...s.params); }

  if (filters.status)   { where.push('c.status = ?');   params.push(filters.status); }
  if (filters.priority) { where.push('c.priority = ?'); params.push(filters.priority); }
  if (filters.category) { where.push('c.category = ?'); params.push(filters.category); }
  if (filters.detectiveId) { where.push('c.detective_id = ?'); params.push(filters.detectiveId); }

  if (filters.overdue) {
    where.push("DATEDIFF(NOW(), c.opened_at) > 30 AND c.status NOT IN ('Closed','Referred to NPA')");
  }

  if (filters.q) {
    where.push('(c.case_number LIKE ? OR c.title LIKE ? OR c.category LIKE ?)');
    const like = `%${filters.q}%`;
    params.push(like, like, like);
  }

  // Inlined rather than bound: MySQL rejects a parameter in LIMIT / OFFSET
  // when the statement is prepared. Both are forced to integers first.
  const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 200, 1), 500);
  const offset = Math.max(parseInt(filters.offset, 10) || 0, 0);

  return query(
    `${SELECT_CASE} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY FIELD(c.priority,'Critical','High','Medium','Low'), c.last_activity_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );
}

function findByNumber(caseNo, scope) {
  const s = scopeClause(scope);
  return queryOne(
    `${SELECT_CASE} WHERE c.case_number = ? ${s.sql ? 'AND ' + s.sql : ''}`,
    [caseNo, ...s.params]
  );
}

function findById(id) {
  return queryOne(`${SELECT_CASE} WHERE c.id = ?`, [id]);
}

/**
 * Allocate the next serial for the current month and insert, both inside one
 * transaction so two simultaneous registrations cannot take the same number.
 */
async function create(data) {
  return transaction(async (conn) => {
    const now = new Date();
    const [rows] = await conn.query(
      `SELECT case_number FROM cases
        WHERE YEAR(opened_at) = ? AND MONTH(opened_at) = ?
        ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [now.getFullYear(), now.getMonth() + 1]
    );

    let serial = 401;
    if (rows.length) {
      const parsed = parseInt(String(rows[0].case_number).replace('CAS ', ''), 10);
      if (!Number.isNaN(parsed)) serial = parsed + 1;
    }

    const number = caseNumber(serial, now);

    const [result] = await conn.query(
      `INSERT INTO cases
         (case_number, title, category, priority, status, description, incident_location,
          station_id, created_by, complainant_name, complainant_id_number,
          complainant_phone, complainant_address)
       VALUES (?,?,?,?, 'Reported', ?,?,?,?,?,?,?,?)`,
      [number, data.title, data.category, data.priority, data.description || null,
       data.location || null, data.stationId, data.createdBy,
       data.complainantName || null, data.complainantIdNumber || null,
       data.complainantPhone || null, data.complainantAddress || null]
    );

    await conn.query(
      'INSERT INTO case_status_history (case_id, from_status, to_status, reason, changed_by) VALUES (?,NULL,?,?,?)',
      [result.insertId, 'Reported', 'Complaint registered', data.createdBy]
    );

    return result.insertId;
  });
}

async function changeStatus(caseId, fromStatus, toStatus, reason, userId) {
  await transaction(async (conn) => {
    await conn.query(
      `UPDATE cases
          SET status = ?, last_activity_at = NOW(),
              closed_at = CASE WHEN ? IN ('Closed','Referred to NPA') THEN NOW() ELSE closed_at END
        WHERE id = ?`,
      [toStatus, toStatus, caseId]
    );
    await conn.query(
      'INSERT INTO case_status_history (case_id, from_status, to_status, reason, changed_by) VALUES (?,?,?,?,?)',
      [caseId, fromStatus, toStatus, reason || null, userId]
    );
  });
  return findById(caseId);
}

async function assignDetective(caseId, detectiveId, userId) {
  await transaction(async (conn) => {
    await conn.query(
      `UPDATE cases
          SET detective_id = ?, last_activity_at = NOW(),
              status = CASE WHEN status = 'Reported' THEN 'Assigned' ELSE status END
        WHERE id = ?`,
      [detectiveId, caseId]
    );
    await conn.query(
      'INSERT INTO case_status_history (case_id, from_status, to_status, reason, changed_by) VALUES (?,?,?,?,?)',
      [caseId, 'Reported', 'Assigned', 'Detective assigned', userId]
    );
  });
  return findById(caseId);
}

function touch(caseId) {
  return query('UPDATE cases SET last_activity_at = NOW() WHERE id = ?', [caseId]);
}

function statusHistory(caseId) {
  return query(
    `SELECT h.*, u.full_name AS changed_by_name, u.rank_title
       FROM case_status_history h
       JOIN users u ON u.id = h.changed_by
      WHERE h.case_id = ? ORDER BY h.created_at ASC`, [caseId]
  );
}

function notes(caseId) {
  return query(
    `SELECT n.*, u.full_name AS author_name, u.rank_title
       FROM case_notes n JOIN users u ON u.id = n.author_id
      WHERE n.case_id = ? ORDER BY n.created_at DESC`, [caseId]
  );
}

async function addNote(caseId, authorId, body) {
  const result = await query(
    'INSERT INTO case_notes (case_id, author_id, body) VALUES (?,?,?)', [caseId, authorId, body]
  );
  await touch(caseId);
  return queryOne(
    `SELECT n.*, u.full_name AS author_name, u.rank_title
       FROM case_notes n JOIN users u ON u.id = n.author_id WHERE n.id = ?`, [result.insertId]
  );
}

/** Aggregate figures the dashboards read. One query, not six round trips. */
function statistics(scope) {
  const s = scopeClause(scope);
  return queryOne(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN c.status NOT IN ('Closed','Referred to NPA') THEN 1 ELSE 0 END) AS open_cases,
       SUM(CASE WHEN c.status IN ('Closed','Referred to NPA') THEN 1 ELSE 0 END) AS closed_cases,
       SUM(CASE WHEN c.status = 'Pending approval' THEN 1 ELSE 0 END) AS pending_approval,
       SUM(CASE WHEN c.priority IN ('Critical','High') AND c.status NOT IN ('Closed','Referred to NPA') THEN 1 ELSE 0 END) AS high_priority,
       SUM(CASE WHEN DATEDIFF(NOW(), c.opened_at) > 30 AND c.status NOT IN ('Closed','Referred to NPA') THEN 1 ELSE 0 END) AS overdue
     FROM cases c ${s.sql ? 'WHERE ' + s.sql : ''}`,
    s.params
  );
}

module.exports = {
  list, findByNumber, findById, create, changeStatus, assignDetective,
  touch, statusHistory, notes, addNote, statistics, scopeClause
};
