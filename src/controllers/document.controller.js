/* ==========================================================================
   Document controller
   ========================================================================== */

const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const documentService = require('../services/document.service');
const auditService = require('../services/audit.service');

exports.list = asyncHandler(async (req, res) => {
  const stationId = req.user.role === 'admin' ? null : req.user.station_id;
  return ok(res, await documentService.list({ stationId }));
});

exports.create = asyncHandler(async (req, res) => {
  const doc = await documentService.create(req.body, req.file, req.user, req.scope);
  await auditService.record(req, 'DOCUMENT_ADD', 'document', String(doc.id),
    `${doc.title} → ${doc.caseNo} · sha256 ${doc.sha256}`);
  return created(res, doc);
});

exports.download = asyncHandler(async (req, res) => {
  const file = await documentService.fileStream(Number(req.params.id));
  await auditService.record(req, 'DOCUMENT_ACCESS', 'document', req.params.id, 'Document retrieved');

  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  return res.sendFile(file.path);
});
