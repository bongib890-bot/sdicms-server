/* ==========================================================================
   Case controller
   ========================================================================== */

const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const caseService = require('../services/case.service');
const auditService = require('../services/audit.service');

exports.list = asyncHandler(async (req, res) => {
  const cases = await caseService.list(req.scope, {
    status: req.query.status,
    priority: req.query.priority,
    category: req.query.category,
    overdue: req.query.overdue === 'true',
    q: req.query.q,
    limit: req.query.limit,
    offset: req.query.offset
  });
  return ok(res, cases, { count: cases.length });
});

exports.detail = asyncHandler(async (req, res) => {
  const docket = await caseService.detail(decodeURIComponent(req.params.number), req.scope);
  return ok(res, docket);
});

exports.create = asyncHandler(async (req, res) => {
  const docket = await caseService.create(req.body, req.user);
  await auditService.record(req, 'CASE_CREATE', 'case', docket.no, docket.title);
  return created(res, docket);
});

exports.changeStatus = asyncHandler(async (req, res) => {
  const number = decodeURIComponent(req.params.number);
  const result = await caseService.changeStatus(number, req.body.status, req.body.reason, req.user, req.scope);

  await auditService.record(req, 'STATUS_CHANGE', 'case', number,
    `${result.before} → ${result.after}` + (req.body.reason ? ` · ${req.body.reason}` : ''));

  return ok(res, result.case);
});

exports.assign = asyncHandler(async (req, res) => {
  const number = decodeURIComponent(req.params.number);
  const result = await caseService.assign(number, Number(req.body.detectiveId), req.user, req.scope);

  await auditService.record(req, 'CASE_ASSIGN', 'case', number, `Assigned to ${result.detective.name}`);

  return ok(res, result.case);
});

exports.addNote = asyncHandler(async (req, res) => {
  const number = decodeURIComponent(req.params.number);
  const note = await caseService.addNote(number, req.body.body, req.user, req.scope);

  await auditService.record(req, 'NOTE_ADD', 'case', number, note.text.slice(0, 120));

  return created(res, note);
});
