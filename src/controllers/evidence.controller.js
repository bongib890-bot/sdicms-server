/* ==========================================================================
   Evidence controller
   ========================================================================== */

const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const evidenceService = require('../services/evidence.service');
const auditService = require('../services/audit.service');

exports.list = asyncHandler(async (req, res) => {
  const stationId = req.user.role === 'admin' ? null : req.user.station_id;
  const items = await evidenceService.list({ stationId, status: req.query.status });
  return ok(res, items, { count: items.length });
});

exports.detail = asyncHandler(async (req, res) =>
  ok(res, await evidenceService.detail(decodeURIComponent(req.params.number))));

exports.create = asyncHandler(async (req, res) => {
  const exhibit = await evidenceService.create(req.body, req.file, req.user, req.scope);

  await auditService.record(req, 'EVIDENCE_ADD', 'evidence', exhibit.id,
    `${exhibit.label} → ${exhibit.caseNo}` + (exhibit.sha256 ? ` · sha256 ${exhibit.sha256}` : ''));

  return created(res, exhibit);
});

exports.transferCustody = asyncHandler(async (req, res) => {
  const number = decodeURIComponent(req.params.number);
  const exhibit = await evidenceService.transferCustody(number, req.body, req.user);

  await auditService.record(req, 'CUSTODY_TRANSFER', 'evidence', number,
    `→ ${req.body.toParty} · ${req.body.action}`);

  return ok(res, exhibit);
});

exports.verify = asyncHandler(async (req, res) => {
  const number = decodeURIComponent(req.params.number);
  const exhibit = await evidenceService.verifyExhibit(number, req.user);

  await auditService.record(req, 'EVIDENCE_VERIFY', 'evidence', number, 'Verified and sealed');

  return ok(res, exhibit);
});

exports.download = asyncHandler(async (req, res) => {
  const number = decodeURIComponent(req.params.number);
  const file = await evidenceService.fileStream(number);

  // Every access to an exhibit file is itself an auditable event.
  await auditService.record(req, 'EVIDENCE_ACCESS', 'evidence', number, 'Exhibit file retrieved');

  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  return res.sendFile(file.path);
});
