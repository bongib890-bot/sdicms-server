/* ==========================================================================
   Suspects and statements controller
   ========================================================================== */

const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const personService = require('../services/person.service');
const auditService = require('../services/audit.service');

function stationOf(req) {
  return req.user.role === 'admin' ? null : req.user.station_id;
}

exports.listSuspects = asyncHandler(async (req, res) =>
  ok(res, await personService.listSuspects({ stationId: stationOf(req) })));

exports.createSuspect = asyncHandler(async (req, res) => {
  const suspect = await personService.createSuspect(req.body, req.user, req.scope);
  await auditService.record(req, 'SUSPECT_ADD', 'suspect', suspect.id,
    `${suspect.name} → ${suspect.caseNo}`);
  return created(res, suspect);
});

exports.listStatements = asyncHandler(async (req, res) =>
  ok(res, await personService.listStatements({ stationId: stationOf(req) })));

exports.createStatement = asyncHandler(async (req, res) => {
  const statement = await personService.createStatement(req.body, req.user, req.scope);
  await auditService.record(req, 'STATEMENT_ADD', 'statement', statement.id,
    `${statement.deponent} (${statement.kind}) → ${statement.caseNo}`);
  return created(res, statement);
});

exports.signStatement = asyncHandler(async (req, res) => {
  const statement = await personService.signStatement(Number(req.params.id), req.user);
  await auditService.record(req, 'STATEMENT_SIGN', 'statement', statement.id, 'Marked signed');
  return ok(res, statement);
});
