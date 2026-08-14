/* ==========================================================================
   Dashboard service
   Assembles the single bootstrap payload the frontend loads on sign-in.
   One round trip rather than nine, because the dashboard needs all of it
   before it can paint anything.
   ========================================================================== */

const present = require('../utils/present');
const caseRepo = require('../repositories/case.repository');
const evidenceRepo = require('../repositories/evidence.repository');
const personRepo = require('../repositories/person.repository');
const stationRepo = require('../repositories/station.repository');
const notificationRepo = require('../repositories/notification.repository');
const userService = require('./user.service');
const auditService = require('./audit.service');
const aiService = require('./ai.service');
const evidenceService = require('./evidence.service');
const { can } = require('../config/permissions');
const { query } = require('../config/database');
const logger = require('../config/logger');

/**
 * Run a piece of the dashboard and fall back to something safe if it throws,
 * rather than letting one broken widget take the entire dashboard down. Every
 * failure is logged with which piece failed, so it is diagnosable from the
 * server terminal instead of only ever showing as a generic client error.
 */
async function piece(label, promise, fallback) {
  try {
    return await promise;
  } catch (err) {
    logger.error(`Dashboard piece "${label}" failed: ${err.message}`);
    return fallback;
  }
}

/** Twelve weeks of opened-against-closed volume for the trend charts. */
async function trends(stationId) {
  const rows = await query(
    `SELECT YEARWEEK(opened_at, 3) AS wk,
            COUNT(*) AS opened,
            SUM(CASE WHEN status IN ('Closed','Referred to NPA') THEN 1 ELSE 0 END) AS closed
       FROM cases
      ${stationId ? 'WHERE station_id = ?' : ''}
      GROUP BY wk ORDER BY wk DESC LIMIT 12`,
    stationId ? [stationId] : []
  );

  const ordered = rows.reverse();
  return {
    opened: ordered.map((r) => Number(r.opened)),
    closed: ordered.map((r) => Number(r.closed))
  };
}

async function bootstrap(user, scope) {
  const stationId = user.role === 'admin' ? null : user.station_id;

  const emptyStats = { total: 0, open_cases: 0, closed_cases: 0, pending_approval: 0, high_priority: 0, overdue: 0 };
  const emptyEvStats = { total: 0, verified: 0, pending: 0, broken: 0 };

  const [
    cases, evidence, suspects, statements, stations,
    staff, notifications, caseStats, evidenceStats, trend, insights, auditData, stationAdmins
  ] = await Promise.all([
    piece('cases', caseRepo.list(scope, {}).then((rows) => rows.map(present.caseSummary)), []),
    piece('evidence', evidenceService.list({ stationId }), []),
    piece('suspects', personRepo.listSuspects({ stationId }).then((rows) => rows.map(present.suspect)), []),
    piece('statements', personRepo.listStatements({ stationId }).then((rows) => rows.map(present.statement)), []),
    piece('stations', stationRepo.list().then((rows) => rows.map(present.station)), []),
    piece('staff', userService.list(scope), []),
    piece('notifications', notificationRepo.listForUser(user.id, 20).then((rows) => rows.map(present.notification)), []),
    piece('case statistics', caseRepo.statistics(scope), emptyStats),
    piece('evidence statistics', evidenceRepo.statistics(stationId), emptyEvStats),
    piece('trends', trends(stationId), { opened: [], closed: [] }),
    piece('ai insights', aiService.forUser(user, scope), []),
    piece(
      'audit log',
      can(user.role, 'audit:read') ? auditService.list({ limit: 60 }) : Promise.resolve({ entries: [], integrity: { intact: true } }),
      { entries: [], integrity: { intact: true } }
    ),
    // Only the Super Administrator sees this; cheap no-op for everyone else
    // rather than a second round trip fetched on demand.
    piece(
      'station admin oversight',
      can(user.role, 'admin:oversight') ? userService.stationAdminOversight() : Promise.resolve([]),
      []
    )
  ]);

  return {
    user: present.user(user),
    cases,
    evidence,
    suspects,
    statements,
    stations,
    staff,
    stationAdmins,
    notifications,
    insights,
    audit: auditData.entries,
    auditIntegrity: auditData.integrity,
    stats: {
      cases: {
        total: Number(caseStats.total || 0),
        open: Number(caseStats.open_cases || 0),
        closed: Number(caseStats.closed_cases || 0),
        pendingApproval: Number(caseStats.pending_approval || 0),
        highPriority: Number(caseStats.high_priority || 0),
        overdue: Number(caseStats.overdue || 0)
      },
      evidence: {
        total: Number(evidenceStats.total || 0),
        verified: Number(evidenceStats.verified || 0),
        pending: Number(evidenceStats.pending || 0),
        broken: Number(evidenceStats.broken || 0)
      }
    },
    trend,
    permissions: {
      createCase: can(user.role, 'case:create'),
      viewAllCases: can(user.role, 'case:readAll'),
      assign: can(user.role, 'case:assign'),
      approve: can(user.role, 'case:approve'),
      addEvidence: can(user.role, 'evidence:create'),
      verifyEvidence: can(user.role, 'evidence:verify'),
      addSuspect: can(user.role, 'suspect:create'),
      addStatement: can(user.role, 'statement:create'),
      manageUsers: can(user.role, 'user:create'),
      viewAudit: can(user.role, 'audit:read'),
      uploadDocument: can(user.role, 'document:create'),
      viewAdminOversight: can(user.role, 'admin:oversight')
    }
  };
}

module.exports = { bootstrap, trends };
