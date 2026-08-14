/* ==========================================================================
   Suspects and statements
   Grouped because both are people attached to a docket and share the same
   reference-allocation pattern.
   ========================================================================== */

const { query, queryOne, transaction } = require('../config/database');
const { suspectReference, statementReference } = require('../utils/caseNumber');

/* --- Suspects ----------------------------------------------------------- */

function listSuspects(filters = {}) {
  const where = [];
  const params = [];
  if (filters.caseId) { where.push('s.case_id = ?'); params.push(filters.caseId); }
  if (filters.stationId) { where.push('c.station_id = ?'); params.push(filters.stationId); }

  return query(
    `SELECT s.*, c.case_number, c.title AS case_title, u.full_name AS created_by_name
       FROM suspects s
       JOIN cases c ON c.id = s.case_id
       JOIN users u ON u.id = s.created_by
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY s.created_at DESC LIMIT 300`,
    params
  );
}

async function createSuspect(data) {
  return transaction(async (conn) => {
    const [rows] = await conn.query('SELECT reference FROM suspects ORDER BY id DESC LIMIT 1 FOR UPDATE');
    let serial = 1041;
    if (rows.length) {
      const parsed = parseInt(String(rows[0].reference).split('-')[1], 10);
      if (!Number.isNaN(parsed)) serial = parsed + 1;
    }
    const reference = suspectReference(serial);

    const [result] = await conn.query(
      `INSERT INTO suspects
         (reference, case_id, full_name, id_number, apparent_age, status, is_identified, notes, created_by)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [reference, data.caseId, data.fullName, data.idNumber || null, data.apparentAge || null,
       data.status || 'Sought', data.isIdentified ? 1 : 0, data.notes || null, data.createdBy]
    );

    await conn.query('UPDATE cases SET last_activity_at = NOW() WHERE id = ?', [data.caseId]);
    return result.insertId;
  });
}

function findSuspect(id) {
  return queryOne(
    `SELECT s.*, c.case_number FROM suspects s JOIN cases c ON c.id = s.case_id WHERE s.id = ?`, [id]
  );
}

/* --- Statements --------------------------------------------------------- */

function listStatements(filters = {}) {
  const where = [];
  const params = [];
  if (filters.caseId) { where.push('t.case_id = ?'); params.push(filters.caseId); }
  if (filters.stationId) { where.push('c.station_id = ?'); params.push(filters.stationId); }

  return query(
    `SELECT t.*, c.case_number, c.title AS case_title,
            u.full_name AS taken_by_name, u.rank_title AS taken_by_rank
       FROM statements t
       JOIN cases c ON c.id = t.case_id
       JOIN users u ON u.id = t.taken_by
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY t.created_at DESC LIMIT 300`,
    params
  );
}

async function createStatement(data) {
  return transaction(async (conn) => {
    const [rows] = await conn.query('SELECT reference FROM statements ORDER BY id DESC LIMIT 1 FOR UPDATE');
    let serial = 2201;
    if (rows.length) {
      const parsed = parseInt(String(rows[0].reference).split('-')[1], 10);
      if (!Number.isNaN(parsed)) serial = parsed + 1;
    }
    const reference = statementReference(serial);

    const [result] = await conn.query(
      `INSERT INTO statements (reference, case_id, deponent_name, deponent_type, body, status, taken_by)
       VALUES (?,?,?,?,?, 'Draft', ?)`,
      [reference, data.caseId, data.deponentName, data.deponentType, data.body || null, data.takenBy]
    );

    await conn.query('UPDATE cases SET last_activity_at = NOW() WHERE id = ?', [data.caseId]);
    return result.insertId;
  });
}

function findStatement(id) {
  return queryOne(
    `SELECT t.*, c.case_number, u.full_name AS taken_by_name
       FROM statements t JOIN cases c ON c.id = t.case_id JOIN users u ON u.id = t.taken_by
      WHERE t.id = ?`, [id]
  );
}

function signStatement(id) {
  return query("UPDATE statements SET status = 'Signed', signed_at = NOW() WHERE id = ?", [id]);
}

module.exports = {
  listSuspects, createSuspect, findSuspect,
  listStatements, createStatement, findStatement, signStatement
};
