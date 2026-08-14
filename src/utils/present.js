/* ==========================================================================
   Presenters
   Database rows are shaped for storage; the client is shaped for display.
   Every transformation between the two lives here, so a column rename never
   reaches the frontend and personal identifiers are masked in exactly one
   place.
   ========================================================================== */

const { SLA_DAYS } = require('../config/constants');

const ROLE_LABELS = {
  admin: 'Super Administrator',
  station_admin: 'Station Administrator',
  commander: 'Station Commander',
  detective: 'Detective',
  officer: 'Police Officer'
};

/**
 * Identity numbers are masked at the boundary. The whole value stays in the
 * database so a lawful reveal can be audited rather than silently allowed.
 */
function maskId(idNumber) {
  if (!idNumber) return '—';
  const s = String(idNumber);
  return s.length <= 7 ? s : s.slice(0, 7) + '••••••';
}

function maskPhone(phone) {
  if (!phone) return '—';
  const s = String(phone).replace(/\s+/g, '');
  return s.length <= 6 ? s : s.slice(0, 3) + ' ••• ' + s.slice(-4);
}

function user(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.full_name,
    rank: row.rank_title,
    role: row.role,
    roleLabel: ROLE_LABELS[row.role] || row.role,
    email: row.email,
    badge: row.badge_number,
    station: row.station_name || 'Unassigned',
    stationCode: row.station_code || '—',
    status: row.status,
    mustChangePassword: !!row.must_change_password,
    lastLoginAt: row.last_login_at
  };
}

function staff(row) {
  return {
    id: row.id,
    name: row.full_name,
    rank: row.rank_title,
    role: row.role,
    roleLabel: ROLE_LABELS[row.role] || row.role,
    badge: row.badge_number,
    email: row.email,
    station: row.station_name || '—',
    active: Number(row.active_cases || 0),
    capacity: Number(row.caseload_capacity || 18),
    closed: Number(row.closed_cases || 0),
    overdue: Number(row.overdue_cases || 0),
    status: row.status === 'active' ? 'Active' : row.status === 'flagged' ? 'Flagged' : 'Suspended'
  };
}

function station(row) {
  const total = Number(row.total_cases || 0);
  const closed = Number(row.closed_cases || 0);
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    province: row.province,
    officers: Number(row.officers || 0),
    open: Number(row.open_cases || 0),
    clearance: total ? Math.round((closed / total) * 100) : 0
  };
}

/**
 * Completeness score, computed from real signals rather than an opinion:
 * exhibits, statements, suspects, a written narrative and recent activity.
 */
function health(row) {
  if (row.status === 'Closed' || row.status === 'Referred to NPA') return 100;

  const ev = Number(row.evidence_count || 0);
  const st = Number(row.statement_count || 0);
  const sp = Number(row.suspect_count || 0);
  const minutes = Number(row.minutes_since_activity || 0);

  let score = 0;
  score += (Math.min(ev, 6) / 6) * 35;
  score += (Math.min(st, 3) / 3) * 25;
  score += (Math.min(sp, 2) / 2) * 20;
  score += row.description ? 10 : 0;
  score += minutes < 4320 ? 10 : 0;      // active within three days
  return Math.round(score);
}

function isOverdue(row) {
  return Number(row.days_open || 0) > SLA_DAYS
    && row.status !== 'Closed'
    && row.status !== 'Referred to NPA';
}

function caseSummary(row) {
  return {
    id: row.id,
    no: row.case_number,
    title: row.title,
    category: row.category,
    priority: row.priority,
    status: row.status,
    detective: row.detective_name || null,
    detectiveId: row.detective_id || null,
    station: row.station_name,
    stationCode: row.station_code,
    opened: Number(row.days_open || 0),
    lastActivity: Number(row.minutes_since_activity || 0),
    health: health(row),
    overdue: isOverdue(row),
    evidenceCount: Number(row.evidence_count || 0),
    suspectCount: Number(row.suspect_count || 0),
    statementCount: Number(row.statement_count || 0),
    documentCount: Number(row.document_count || 0),
    description: row.description || '',
    location: row.incident_location || '—',
    createdBy: row.created_by_name || null,
    openedAt: row.opened_at
  };
}

/** Full docket, including complainant block, notes and derived timeline. */
function caseDetail(row, { history = [], notes = [], allowedTransitions = [] } = {}) {
  const base = caseSummary(row);

  const timeline = history.map((h) => ({
    t: h.from_status ? `${h.from_status} → ${h.to_status}` : h.to_status,
    by: `${h.rank_title} ${h.changed_by_name}`,
    at: h.created_at,
    body: h.reason || '',
    state: 'done'
  }));

  notes.slice().reverse().forEach((n) => {
    timeline.push({
      t: 'Case note added',
      by: `${n.rank_title} ${n.author_name}`,
      at: n.created_at,
      body: n.body,
      state: 'done'
    });
  });

  timeline.sort((a, b) => new Date(a.at) - new Date(b.at));
  if (timeline.length) timeline[timeline.length - 1].state = 'now';

  return {
    ...base,
    complainant: {
      name: row.complainant_name || 'Not recorded',
      id: maskId(row.complainant_id_number),
      phone: maskPhone(row.complainant_phone),
      address: row.complainant_address || '—'
    },
    notes: notes.map((n) => ({
      id: n.id,
      by: `${n.rank_title} ${n.author_name}`,
      at: n.created_at,
      text: n.body
    })),
    timeline,
    allowedTransitions
  };
}

function custodyLink(row, ok = true) {
  return {
    seq: row.seq,
    from: row.from_party,
    to: row.to_party,
    action: row.action,
    at: row.occurred_at,
    actor: row.actor_name,
    prevHash: String(row.prev_hash).slice(0, 16),
    hash: String(row.entry_hash).slice(0, 16),
    ok
  };
}

function evidence(row, chainRows = [], integrity = { intact: true, brokenAt: null }) {
  return {
    id: row.exhibit_number,
    dbId: row.id,
    caseNo: row.case_number,
    caseTitle: row.case_title,
    label: row.label,
    type: row.evidence_type,
    description: row.description || '',
    collectedBy: `${row.collected_by_rank} ${row.collected_by_name}`,
    collectedAt: row.collected_at,
    location: row.storage_location,
    status: integrity.intact ? row.status : 'Chain break',
    size: row.file_size ? (row.file_size / 1048576).toFixed(1) + ' MB' : '—',
    hasFile: !!row.file_path,
    sha256: row.sha256 ? String(row.sha256).slice(0, 16) : null,
    verifiedBy: row.verified_by_name || null,
    chain: chainRows.map((c) => custodyLink(c, integrity.intact || c.id !== integrity.brokenAt))
  };
}

function suspect(row) {
  return {
    id: row.reference,
    dbId: row.id,
    name: row.full_name,
    caseNo: row.case_number,
    age: row.apparent_age || '—',
    status: row.status,
    identified: !!row.is_identified,
    note: row.notes || ''
  };
}

function statement(row) {
  return {
    id: row.reference,
    dbId: row.id,
    caseNo: row.case_number,
    deponent: row.deponent_name,
    kind: row.deponent_type,
    takenBy: `${row.taken_by_rank} ${row.taken_by_name}`,
    at: row.taken_at,
    status: row.status,
    body: row.body || ''
  };
}

function documentRow(row) {
  return {
    id: row.id,
    caseNo: row.case_number,
    title: row.title,
    docType: row.doc_type,
    filename: row.original_filename,
    size: (row.file_size / 1048576).toFixed(2) + ' MB',
    mimeType: row.mime_type,
    sha256: String(row.sha256).slice(0, 16),
    uploadedBy: `${row.rank_title} ${row.uploaded_by_name}`,
    at: row.created_at
  };
}

function auditEntry(row, ok = true) {
  return {
    seq: Number(row.seq),
    at: row.created_at,
    actor: row.actor_name,
    action: row.action,
    target: row.target_id,
    targetType: row.target_type,
    detail: row.detail || '',
    prevHash: String(row.prev_hash).slice(0, 16),
    hash: String(row.entry_hash).slice(0, 16),
    ok
  };
}

function notification(row) {
  return {
    id: row.id,
    kind: row.kind,
    icon: row.icon,
    text: row.message,
    link: row.link,
    read: !!row.is_read,
    at: row.created_at
  };
}

function insight(row) {
  return {
    id: row.id,
    kind: row.kind,
    text: row.body,
    confidence: Number(row.confidence),
    ref: row.case_number || 'Station',
    model: row.model,
    actions: [defaultAction(row.kind), 'Dismiss']
  };
}

function defaultAction(kind) {
  const map = {
    'Missing evidence': 'Log follow-up',
    'Next step': 'Log follow-up',
    'Stalled docket': 'Open docket',
    'Workload': 'Review reassignment',
    'Duplicate detected': 'Compare dockets',
    'Pattern': 'Log recommendation',
    'Security': 'Flag account',
    'Integrity': 'Open exhibit',
    'Access review': 'Open user list',
    'Incomplete': 'Open docket',
    'Suggested evidence': 'Upload evidence',
    'Report draft': 'Generate report'
  };
  return map[kind] || 'Accept';
}

module.exports = {
  ROLE_LABELS, maskId, maskPhone, user, staff, station, health, isOverdue,
  caseSummary, caseDetail, evidence, custodyLink, suspect, statement,
  documentRow, auditEntry, notification, insight
};
