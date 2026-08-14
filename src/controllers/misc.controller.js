/* ==========================================================================
   Stations, audit, dashboard and AI controllers
   Grouped: each is small, and splitting them would add files without adding
   clarity.
   ========================================================================== */

const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/response');
const stationService = require('../services/station.service');
const auditService = require('../services/audit.service');
const dashboardService = require('../services/dashboard.service');
const aiService = require('../services/ai.service');
const notificationRepo = require('../repositories/notification.repository');
const present = require('../utils/present');
const { query } = require('../config/database');

/**
 * Unauthenticated, safe-by-construction: three national totals and nothing
 * that could identify a person, a docket, or even which station is doing
 * well or badly. This exists specifically so the login screen's right-hand
 * panel has something real to show before anyone has signed in.
 */
exports.publicOverview = asyncHandler(async (req, res) => {
  const [totals] = await query(
    `SELECT
       (SELECT COUNT(*) FROM cases WHERE status NOT IN ('Closed','Referred to NPA')) AS open_cases,
       (SELECT COUNT(*) FROM users WHERE role IN ('officer','detective','commander') AND status = 'active') AS officers,
       (SELECT COUNT(*) FROM cases) AS total_cases,
       (SELECT COUNT(*) FROM cases WHERE status IN ('Closed','Referred to NPA')) AS closed_cases`
  );

  const totalCases = Number(totals.total_cases || 0);
  const closedCases = Number(totals.closed_cases || 0);

  return ok(res, {
    openDockets: Number(totals.open_cases || 0),
    officersOnSystem: Number(totals.officers || 0),
    meanClearance: totalCases ? Math.round((closedCases / totalCases) * 100) : 0
  });
});

/* --- Stations ----------------------------------------------------------- */
exports.listStations = asyncHandler(async (req, res) => ok(res, await stationService.list()));

exports.createStation = asyncHandler(async (req, res) => {
  const station = await stationService.create(req.body);
  await auditService.record(req, 'STATION_CREATE', 'station', station.code, station.name);
  return created(res, station);
});

/* --- Audit -------------------------------------------------------------- */
exports.listAudit = asyncHandler(async (req, res) => {
  const result = await auditService.list({
    limit: req.query.limit || 200,
    offset: req.query.offset || 0,
    action: req.query.action,
    targetId: req.query.target
  });
  return ok(res, result.entries, { integrity: result.integrity });
});

exports.verifyAudit = asyncHandler(async (req, res) => {
  const integrity = await auditService.verify();
  return ok(res, {
    ...integrity,
    message: integrity.intact
      ? `Chain verified across ${integrity.entries} entries. No gaps and no rewrites.`
      : `Chain broken at sequence ${integrity.seq}. That entry does not hash to the one before it.`
  });
});

/* --- Dashboard ---------------------------------------------------------- */
exports.bootstrap = asyncHandler(async (req, res) =>
  ok(res, await dashboardService.bootstrap(req.user, req.scope)));

/* --- Notifications ------------------------------------------------------ */
exports.listNotifications = asyncHandler(async (req, res) => {
  const rows = await notificationRepo.listForUser(req.user.id, 30);
  return ok(res, rows.map(present.notification));
});

exports.markNotificationsRead = asyncHandler(async (req, res) => {
  await notificationRepo.markAllRead(req.user.id);
  return ok(res, { read: true });
});

/* --- AI ----------------------------------------------------------------- */
exports.listInsights = asyncHandler(async (req, res) =>
  ok(res, await aiService.forUser(req.user, req.scope)));

exports.resolveInsight = asyncHandler(async (req, res) => {
  const disposition = req.body.disposition === 'accepted' ? 'accepted' : 'dismissed';
  const result = await aiService.resolve(Number(req.params.id), disposition, req.user);

  await auditService.record(req, 'AI_SUGGESTION', 'insight', req.params.id,
    `Suggestion ${disposition} by officer`);

  return ok(res, result);
});

exports.ask = asyncHandler(async (req, res) => {
  const result = await aiService.ask(req.body.question, req.user, req.scope);

  await auditService.record(req, 'AI_QUERY', 'ai', 'assistant',
    String(req.body.question).slice(0, 120));

  return ok(res, {
    ...result,
    advisory: true,
    notice: 'Advisory only. Nothing is filed to a docket without an officer accepting it.'
  });
});
