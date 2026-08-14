/* ==========================================================================
   Evidence repository
   An exhibit and its opening custody entry are written together: an exhibit
   that exists without a chain would be inadmissible from the moment it was
   created.
   ========================================================================== */

const { query, queryOne, transaction } = require('../config/database');
const { chain, GENESIS, verifyChain } = require('../utils/hashChain');
const { exhibitNumber } = require('../utils/caseNumber');

const SELECT_EVIDENCE = `
  SELECT e.*,
         c.case_number,
         c.title AS case_title,
         u.full_name  AS collected_by_name,
         u.rank_title AS collected_by_rank,
         v.full_name  AS verified_by_name,
         (SELECT COUNT(*) FROM custody_chain cc WHERE cc.evidence_id = e.id) AS custody_events
    FROM evidence e
    JOIN cases c  ON c.id = e.case_id
    JOIN users u  ON u.id = e.collected_by
    LEFT JOIN users v ON v.id = e.verified_by
`;

/** Canonical payload for a custody entry. Field order is fixed. */
function custodyPayload(row) {
  return [
    row.evidence_id, row.seq, row.from_party, row.to_party,
    row.action, row.actor_id, new Date(row.occurred_at).toISOString()
  ].join('|');
}

function list(filters = {}) {
  const where = [];
  const params = [];

  if (filters.caseId)   { where.push('e.case_id = ?'); params.push(filters.caseId); }
  if (filters.status)   { where.push('e.status = ?');  params.push(filters.status); }
  if (filters.stationId) { where.push('c.station_id = ?'); params.push(filters.stationId); }

  return query(
    `${SELECT_EVIDENCE} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY e.collected_at DESC LIMIT 300`,
    params
  );
}

function findById(id) {
  return queryOne(`${SELECT_EVIDENCE} WHERE e.id = ?`, [id]);
}

function findByNumber(number) {
  return queryOne(`${SELECT_EVIDENCE} WHERE e.exhibit_number = ?`, [number]);
}

function custodyFor(evidenceId) {
  return query(
    `SELECT cc.*, u.full_name AS actor_name, u.rank_title
       FROM custody_chain cc JOIN users u ON u.id = cc.actor_id
      WHERE cc.evidence_id = ? ORDER BY cc.seq ASC`, [evidenceId]
  );
}

/** Recompute one exhibit's chain and report the first mismatch. */
async function verifyCustody(evidenceId) {
  const rows = await custodyFor(evidenceId);
  const result = verifyChain(rows, custodyPayload);
  return { ...result, events: rows.length };
}

async function create(data) {
  return transaction(async (conn) => {
    const now = new Date();

    const [rows] = await conn.query(
      'SELECT exhibit_number FROM evidence ORDER BY id DESC LIMIT 1 FOR UPDATE'
    );
    let serial = 441;
    if (rows.length) {
      const parsed = parseInt(String(rows[0].exhibit_number).split('-')[2], 10);
      if (!Number.isNaN(parsed)) serial = parsed + 1;
    }
    const number = exhibitNumber(serial, now);

    const [result] = await conn.query(
      `INSERT INTO evidence
         (exhibit_number, case_id, label, evidence_type, description, storage_location,
          status, original_filename, file_path, file_size, mime_type, sha256,
          collected_by, collected_from, collected_at)
       VALUES (?,?,?,?,?,?, 'Pending verification', ?,?,?,?,?,?,?,?)`,
      [number, data.caseId, data.label, data.evidenceType, data.description || null,
       data.storageLocation, data.originalFilename || null, data.filePath || null,
       data.fileSize || null, data.mimeType || null, data.sha256 || null,
       data.collectedBy, data.collectedFrom || 'Scene', now]
    );

    const evidenceId = result.insertId;

    // Opening custody entries: collection, then booking in.
    const entries = [
      { from: data.collectedFrom || 'Scene', to: data.collectorName, action: 'Collected' },
      { from: data.collectorName, to: data.storageLocation, action: 'Booked in' }
    ];

    let prev = GENESIS;
    let seq = 1;
    for (const e of entries) {
      const row = {
        evidence_id: evidenceId, seq, from_party: e.from, to_party: e.to,
        action: e.action, actor_id: data.collectedBy, occurred_at: now
      };
      const entryHash = chain(prev, custodyPayload(row));
      await conn.query(
        `INSERT INTO custody_chain
           (evidence_id, seq, from_party, to_party, action, actor_id, occurred_at, prev_hash, entry_hash)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [evidenceId, seq, e.from, e.to, e.action, data.collectedBy, now, prev, entryHash]
      );
      prev = entryHash;
      seq += 1;
    }

    await conn.query('UPDATE cases SET last_activity_at = NOW() WHERE id = ?', [data.caseId]);

    return evidenceId;
  });
}

/** Extend the chain. Never rewrites an existing entry. */
async function addCustody(evidenceId, { toParty, action, actorId, actorName }) {
  return transaction(async (conn) => {
    const [tail] = await conn.query(
      'SELECT seq, to_party, entry_hash FROM custody_chain WHERE evidence_id = ? ORDER BY seq DESC LIMIT 1 FOR UPDATE',
      [evidenceId]
    );

    const seq = tail.length ? tail[0].seq + 1 : 1;
    const prev = tail.length ? tail[0].entry_hash : GENESIS;
    const fromParty = tail.length ? tail[0].to_party : 'Scene';
    const now = new Date();

    const row = {
      evidence_id: evidenceId, seq, from_party: fromParty, to_party: toParty,
      action, actor_id: actorId, occurred_at: now
    };
    const entryHash = chain(prev, custodyPayload(row));

    await conn.query(
      `INSERT INTO custody_chain
         (evidence_id, seq, from_party, to_party, action, actor_id, occurred_at, prev_hash, entry_hash)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [evidenceId, seq, fromParty, toParty, action, actorId, now, prev, entryHash]
    );

    await conn.query('UPDATE evidence SET storage_location = ? WHERE id = ?', [toParty, evidenceId]);

    return { seq, entryHash };
  });
}

function verify(evidenceId, userId) {
  return query(
    "UPDATE evidence SET status = 'Verified', verified_by = ?, verified_at = NOW() WHERE id = ?",
    [userId, evidenceId]
  );
}

function markChainBreak(evidenceId) {
  return query("UPDATE evidence SET status = 'Chain break' WHERE id = ?", [evidenceId]);
}

function statistics(stationId) {
  return queryOne(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN e.status = 'Verified' THEN 1 ELSE 0 END) AS verified,
            SUM(CASE WHEN e.status = 'Pending verification' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN e.status = 'Chain break' THEN 1 ELSE 0 END) AS broken
       FROM evidence e JOIN cases c ON c.id = e.case_id
      ${stationId ? 'WHERE c.station_id = ?' : ''}`,
    stationId ? [stationId] : []
  );
}

module.exports = {
  list, findById, findByNumber, custodyFor, verifyCustody,
  create, addCustody, verify, markChainBreak, statistics, custodyPayload
};
