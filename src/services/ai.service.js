/* ==========================================================================
   AI service
   Two providers behind one interface. The heuristic provider derives its
   findings from the database, so the system produces genuine, checkable
   suggestions with no API key, no network and no cost. A model provider can
   be added later without touching a caller.

   Standing rule: the copilot proposes, an officer disposes. Nothing here
   writes to a docket, closes a case or alters evidence. Every suggestion and
   every disposition is recorded in ai_insights and the audit log.
   ========================================================================== */

const insightRepo = require('../repositories/insight.repository');
const caseRepo = require('../repositories/case.repository');
const evidenceRepo = require('../repositories/evidence.repository');
const personRepo = require('../repositories/person.repository');
const { query } = require('../config/database');
const present = require('../utils/present');
const { SLA_DAYS } = require('../config/constants');

/* ------------------------------------------------------------------------
   Redaction
   Anything sent to an external model has identifiers stripped first and
   restored locally afterwards. Kept here even while the heuristic provider
   is the only one wired up, because it is the boundary that matters.
   --------------------------------------------------------------------- */
function redact(text) {
  return String(text || '')
    .replace(/\b\d{13}\b/g, '[ID_NUMBER]')
    .replace(/\b(?:\+27|0)\d{9}\b/g, '[PHONE]')
    .replace(/\b[\w.%-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL]');
}

/* ------------------------------------------------------------------------
   Heuristic findings — each one is a real query against real data
   --------------------------------------------------------------------- */

/** Dockets with no recorded activity, ranked by how close they are to SLA. */
async function stalledDockets(scope) {
  const rows = await caseRepo.list(scope, {});
  return rows
    .filter((r) => r.status !== 'Closed' && r.status !== 'Referred to NPA')
    .filter((r) => Number(r.minutes_since_activity) > 4320)
    .sort((a, b) => b.minutes_since_activity - a.minutes_since_activity)
    .slice(0, 3)
    .map((r) => {
      const days = Math.floor(r.minutes_since_activity / 1440);
      const toSla = SLA_DAYS - Number(r.days_open);
      return {
        caseId: r.id,
        caseNumber: r.case_number,
        kind: 'Stalled docket',
        confidence: Math.min(0.6 + days * 0.04, 0.97),
        body: `No activity recorded for ${days} days` +
          (Number(r.suspect_count) === 0 ? ' and no suspect on file' : '') + '. ' +
          (toSla > 0
            ? `This docket breaches the ${SLA_DAYS}-day standard in ${toSla} day(s).`
            : `It is already ${Number(r.days_open) - SLA_DAYS} day(s) past the ${SLA_DAYS}-day standard.`)
      };
    });
}

/** Dockets carrying exhibits but missing a signed complainant statement. */
async function missingStatements(scope) {
  const rows = await caseRepo.list(scope, {});
  return rows
    .filter((r) => r.status !== 'Closed' && r.status !== 'Referred to NPA')
    .filter((r) => Number(r.evidence_count) >= 2 && Number(r.statement_count) === 0)
    .slice(0, 2)
    .map((r) => ({
      caseId: r.id,
      caseNumber: r.case_number,
      kind: 'Missing evidence',
      confidence: 0.88,
      body: `This docket holds ${r.evidence_count} exhibit(s) but no statement has been recorded. ` +
        'Dockets reaching prosecution almost always carry a signed complainant statement; ' +
        'this is the single largest gap here.'
    }));
}

/**
 * Possible duplicates: same station, same category, opened within 10 days,
 * and sharing a complainant name or address.
 */
async function duplicateCandidates(stationId) {
  const rows = await query(
    `SELECT a.id AS a_id, a.case_number AS a_no, b.case_number AS b_no,
            a.complainant_name, a.category, ABS(DATEDIFF(a.opened_at, b.opened_at)) AS gap
       FROM cases a
       JOIN cases b
         ON b.id < a.id
        AND b.station_id = a.station_id
        AND b.category = a.category
        AND ABS(DATEDIFF(a.opened_at, b.opened_at)) <= 10
        AND (
             (a.complainant_name IS NOT NULL AND a.complainant_name = b.complainant_name)
          OR (a.complainant_address IS NOT NULL AND a.complainant_address = b.complainant_address)
        )
      WHERE a.station_id = ?
      LIMIT 2`,
    [stationId]
  );

  return rows.map((r) => ({
    caseId: r.a_id,
    caseNumber: r.a_no,
    kind: 'Duplicate detected',
    confidence: 0.74,
    body: `${r.a_no} and ${r.b_no} share a complainant and were reported ${r.gap} day(s) apart ` +
      `in the same category. They may be one continuing matter rather than two dockets.`
  }));
}

/** Caseload imbalance across the detectives at a station. */
async function workloadImbalance(stationId) {
  const rows = await query(
    `SELECT u.id, u.full_name, u.caseload_capacity,
            COUNT(c.id) AS active
       FROM users u
       LEFT JOIN cases c
         ON c.detective_id = u.id AND c.status NOT IN ('Closed','Referred to NPA')
      WHERE u.role = 'detective' AND u.station_id = ? AND u.status = 'active'
      GROUP BY u.id
      ORDER BY active DESC`,
    [stationId]
  );

  if (rows.length < 2) return [];

  const heaviest = rows[0];
  const lightest = rows[rows.length - 1];
  const over = Number(heaviest.active) - Number(heaviest.caseload_capacity);
  if (over <= 0) return [];

  return [{
    caseId: null,
    caseNumber: null,
    kind: 'Workload',
    confidence: 0.92,
    body: `${heaviest.full_name} carries ${heaviest.active} active dockets against a capacity of ` +
      `${heaviest.caseload_capacity}, while ${lightest.full_name} holds ${lightest.active}. ` +
      `Moving ${over} docket(s) would bring both within range.`
  }];
}

/** Exhibits whose custody chain fails recomputation. */
async function integrityFindings(stationId) {
  const rows = await evidenceRepo.list({ stationId });
  const findings = [];

  for (const row of rows) {
    const integrity = await evidenceRepo.verifyCustody(row.id);
    if (!integrity.intact) {
      findings.push({
        caseId: row.case_id,
        caseNumber: row.case_number,
        kind: 'Integrity',
        confidence: 0.99,
        body: `Exhibit ${row.exhibit_number} has a custody entry at position ${integrity.seq} ` +
          'that does not hash to the entry before it. The exhibit moved without a recorded ' +
          'handler and is locked pending review.'
      });
    }
    if (findings.length >= 2) break;
  }
  return findings;
}

/* ------------------------------------------------------------------------
   Assembly
   --------------------------------------------------------------------- */

/** Build fresh findings for a user, persist them, and return them. */
async function generateFor(user, scope) {
  const findings = [];

  if (user.role === 'detective' || user.role === 'officer') {
    findings.push(...await stalledDockets(scope));
    findings.push(...await missingStatements(scope));
  }

  if (user.role === 'commander') {
    findings.push(...await workloadImbalance(user.station_id));
    findings.push(...await duplicateCandidates(user.station_id));
    findings.push(...await stalledDockets(scope));
  }

  if (user.role === 'admin') {
    findings.push(...await integrityFindings(null));
    findings.push(...await stalledDockets(scope));
  }

  const stored = [];
  for (const f of findings.slice(0, 4)) {
    const row = await insightRepo.create({
      caseId: f.caseId,
      userId: user.id,
      kind: f.kind,
      body: f.body,
      confidence: f.confidence,
      model: 'heuristic-v1'
    });
    stored.push(present.insight({ ...row, case_number: f.caseNumber }));
  }

  return stored;
}

/** Open insights for a user, generating a fresh set if none are outstanding. */
async function forUser(user, scope) {
  const existing = await insightRepo.listOpen({ userId: user.id, limit: 6 });
  if (existing.length) return existing.map(present.insight);
  return generateFor(user, scope);
}

async function resolve(id, disposition, user) {
  const row = await insightRepo.findById(id);
  if (!row) return null;
  await insightRepo.resolve(id, disposition, user.id);
  return { id, disposition };
}

/**
 * Answer a question about a docket from what is actually recorded against it.
 * Deliberately not a chat model: every sentence here traces to a row.
 */
async function ask(question, user, scope) {
  const q = redact(question).toLowerCase();

  const stats = await caseRepo.statistics(scope);
  const mentioned = /cas\s*\d+\/\d+\/\d+/i.exec(question);

  if (mentioned) {
    const number = mentioned[0].toUpperCase().replace(/\s+/, ' ');
    const row = await caseRepo.findByNumber(number, scope);
    if (!row) {
      return { answer: `I cannot find ${number} within your station scope.`, basis: 'cases' };
    }

    const [ev, sp, st] = await Promise.all([
      evidenceRepo.list({ caseId: row.id }),
      personRepo.listSuspects({ caseId: row.id }),
      personRepo.listStatements({ caseId: row.id })
    ]);

    const score = present.health(row);
    const gap = st.length === 0 ? 'a signed complainant statement'
      : sp.length === 0 ? 'a suspect description'
      : ev.length < 3 ? 'further exhibits'
      : 'nothing obvious';

    return {
      answer: `${number} is at "${row.status}", opened ${row.days_open} day(s) ago. ` +
        `It holds ${ev.length} exhibit(s), ${st.length} statement(s) and ${sp.length} suspect record(s), ` +
        `giving a completeness score of ${score}%. The largest outstanding gap is ${gap}.`,
      basis: 'docket record'
    };
  }

  if (/overdue|sla|late|stalled/.test(q)) {
    const stalled = await stalledDockets(scope);
    return {
      answer: Number(stats.overdue) === 0
        ? 'No dockets in your scope have passed the 30-day standard.'
        : `${stats.overdue} docket(s) in your scope have passed the ${SLA_DAYS}-day standard. ` +
          (stalled.length ? `The most inactive is ${stalled[0].caseNumber}.` : ''),
      basis: 'case statistics'
    };
  }

  if (/evidence|exhibit|custody/.test(q)) {
    const evStats = await evidenceRepo.statistics(user.role === 'admin' ? null : user.station_id);
    return {
      answer: `${evStats.total} exhibit(s) are on the register: ${evStats.verified} verified, ` +
        `${evStats.pending} awaiting sign-off` +
        (Number(evStats.broken) ? `, and ${evStats.broken} with a broken custody chain.` : '.'),
      basis: 'evidence register'
    };
  }

  if (/workload|caseload|busy/.test(q)) {
    const imbalance = await workloadImbalance(user.station_id);
    return {
      answer: imbalance.length ? imbalance[0].body : 'Every detective at this station is within capacity.',
      basis: 'caseload query'
    };
  }

  return {
    answer: `Your scope holds ${stats.total} docket(s): ${stats.open_cases} open, ` +
      `${stats.pending_approval} awaiting approval and ${stats.overdue} past the ${SLA_DAYS}-day standard. ` +
      'Ask about a specific docket number, evidence, workload or overdue cases for more detail.',
    basis: 'case statistics'
  };
}

module.exports = { forUser, generateFor, resolve, ask, redact };
