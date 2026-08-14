/* ==========================================================================
   Document repository
   Documents are anything filed against a docket that is not an exhibit:
   charge sheets, warrants, forensic reports, correspondence.
   ========================================================================== */

const { query, queryOne } = require('../config/database');

const SELECT_DOC = `
  SELECT d.*, c.case_number, u.full_name AS uploaded_by_name, u.rank_title
    FROM documents d
    JOIN cases c ON c.id = d.case_id
    JOIN users u ON u.id = d.uploaded_by
`;

function list(filters = {}) {
  const where = [];
  const params = [];
  if (filters.caseId) { where.push('d.case_id = ?'); params.push(filters.caseId); }
  if (filters.stationId) { where.push('c.station_id = ?'); params.push(filters.stationId); }

  return query(
    `${SELECT_DOC} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY d.created_at DESC LIMIT 300`, params
  );
}

function findById(id) {
  return queryOne(`${SELECT_DOC} WHERE d.id = ?`, [id]);
}

async function create(data) {
  const result = await query(
    `INSERT INTO documents
       (case_id, title, doc_type, original_filename, file_path, file_size, mime_type, sha256, uploaded_by)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [data.caseId, data.title, data.docType, data.originalFilename, data.filePath,
     data.fileSize, data.mimeType, data.sha256, data.uploadedBy]
  );
  await query('UPDATE cases SET last_activity_at = NOW() WHERE id = ?', [data.caseId]);
  return findById(result.insertId);
}

module.exports = { list, findById, create };
