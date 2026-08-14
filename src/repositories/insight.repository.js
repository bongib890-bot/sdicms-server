/* ==========================================================================
   AI insight repository
   Every suggestion is stored with the model that produced it and its
   disposition, so an AI recommendation can never be mistaken for an
   officer's own decision after the fact.
   ========================================================================== */

const { query, queryOne } = require('../config/database');

function listOpen({ userId, caseId = null, limit = 10 }) {
  const where = ["i.status = 'open'"];
  const params = [];
  if (caseId) { where.push('i.case_id = ?'); params.push(caseId); }
  if (userId) { where.push('(i.user_id = ? OR i.user_id IS NULL)'); params.push(userId); }

  // Inlined as a validated integer — LIMIT cannot be a bound parameter.
  const safe = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

  return query(
    `SELECT i.*, c.case_number
       FROM ai_insights i LEFT JOIN cases c ON c.id = i.case_id
      WHERE ${where.join(' AND ')}
      ORDER BY i.confidence DESC, i.created_at DESC LIMIT ${safe}`,
    params
  );
}

async function create(data) {
  const result = await query(
    `INSERT INTO ai_insights (case_id, user_id, kind, body, confidence, model)
     VALUES (?,?,?,?,?,?)`,
    [data.caseId || null, data.userId || null, data.kind, data.body,
     data.confidence || 0.5, data.model || 'heuristic-v1']
  );
  return queryOne('SELECT * FROM ai_insights WHERE id = ?', [result.insertId]);
}

function resolve(id, status, userId) {
  return query(
    'UPDATE ai_insights SET status = ?, resolved_by = ?, resolved_at = NOW() WHERE id = ?',
    [status, userId, id]
  );
}

function findById(id) {
  return queryOne('SELECT * FROM ai_insights WHERE id = ?', [id]);
}

module.exports = { listOpen, create, resolve, findById };
