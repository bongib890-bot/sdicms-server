/* ==========================================================================
   Audit repository
   Append only. The next entry's digest is derived from the previous one, so
   the sequence allocation and the insert must happen inside one transaction
   or two concurrent writes would chain off the same predecessor.
   ========================================================================== */

const { query, queryOne, transaction } = require('../config/database');
const { chain, GENESIS, verifyChain } = require('../utils/hashChain');

/** Canonical payload for hashing — field order is fixed and must not change. */
function payloadOf(row) {
  return [
    row.seq, row.actor_id || 0, row.actor_name, row.action,
    row.target_type, row.target_id, row.detail || '',
    new Date(row.created_at).toISOString()
  ].join('|');
}

async function write(entry) {
  return transaction(async (conn) => {
    // Lock the tail so the sequence and predecessor hash are consistent.
    const [tail] = await conn.query(
      'SELECT seq, entry_hash FROM audit_log ORDER BY seq DESC LIMIT 1 FOR UPDATE'
    );

    const seq = tail.length ? Number(tail[0].seq) + 1 : 1;
    const prevHash = tail.length ? tail[0].entry_hash : GENESIS;
    const createdAt = new Date();

    const row = {
      seq,
      actor_id: entry.actorId || null,
      actor_name: entry.actorName,
      action: entry.action,
      target_type: entry.targetType,
      target_id: String(entry.targetId),
      detail: entry.detail || null,
      created_at: createdAt
    };

    const entryHash = chain(prevHash, payloadOf(row));

    await conn.query(
      `INSERT INTO audit_log
         (seq, actor_id, actor_name, action, target_type, target_id, detail,
          ip, user_agent, prev_hash, entry_hash, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [seq, row.actor_id, row.actor_name, row.action, row.target_type, row.target_id,
       row.detail, entry.ip || null, entry.userAgent || null, prevHash, entryHash, createdAt]
    );

    return { seq, entryHash, prevHash };
  });
}

async function list({ limit = 100, offset = 0, action = null, targetId = null } = {}) {
  const where = [];
  const params = [];
  if (action)   { where.push('a.action = ?');    params.push(action); }
  if (targetId) { where.push('a.target_id = ?'); params.push(targetId); }

  // LIMIT and OFFSET cannot be bound parameters in a prepared statement, so
  // they are coerced to integers and inlined. Number() plus a floor makes
  // that safe — nothing string-shaped ever reaches the SQL.
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 1000);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  return query(
    `SELECT a.*, u.full_name AS actor_full_name
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY a.seq DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    params
  );
}

async function count() {
  const row = await queryOne('SELECT COUNT(*) AS n FROM audit_log');
  return Number(row.n);
}

/**
 * Recompute the entire chain and report the first entry that does not match.
 * This is what the administrator's integrity panel calls.
 */
async function verify() {
  const rows = await query('SELECT * FROM audit_log ORDER BY seq ASC');
  const result = verifyChain(rows, payloadOf);
  return { ...result, entries: rows.length };
}

module.exports = { write, list, count, verify, payloadOf };
