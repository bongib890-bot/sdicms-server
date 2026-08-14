/* ==========================================================================
   Case service
   Docket lifecycle. The state machine is enforced here, not in the client:
   a hidden button is a convenience, a rejected transition is a control.
   ========================================================================== */

const ApiError = require('../utils/ApiError');
const present = require('../utils/present');
const caseRepo = require('../repositories/case.repository');
const userRepo = require('../repositories/user.repository');
const { allowedTransitions, TRANSITIONS } = require('../config/permissions');
const { CASE_CATEGORIES, CASE_PRIORITIES } = require('../config/constants');

async function list(scope, filters) {
  const rows = await caseRepo.list(scope, filters);
  return rows.map(present.caseSummary);
}

async function detail(caseNumber, scope) {
  const row = await caseRepo.findByNumber(caseNumber, scope);
  if (!row) {
    throw ApiError.notFound('That docket does not exist, or it is not within your station scope.');
  }

  const [history, notes] = await Promise.all([
    caseRepo.statusHistory(row.id),
    caseRepo.notes(row.id)
  ]);

  return present.caseDetail(row, {
    history,
    notes,
    allowedTransitions: allowedTransitions(row.status, scope.role)
  });
}

async function create(data, user) {
  if (!CASE_CATEGORIES.includes(data.category)) {
    throw ApiError.badRequest('Unknown crime category.', { category: 'Choose one of the listed categories.' });
  }
  if (!CASE_PRIORITIES.includes(data.priority)) {
    throw ApiError.badRequest('Unknown priority.', { priority: 'Choose Critical, High, Medium or Low.' });
  }
  if (!user.station_id) {
    throw ApiError.badRequest('Your account is not attached to a station, so it cannot open a docket.');
  }

  const id = await caseRepo.create({
    title: data.title,
    category: data.category,
    priority: data.priority,
    description: data.description,
    location: data.location,
    stationId: user.station_id,
    createdBy: user.id,
    complainantName: data.complainantName,
    complainantIdNumber: data.complainantIdNumber,
    complainantPhone: data.complainantPhone,
    complainantAddress: data.complainantAddress || data.location
  });

  const row = await caseRepo.findById(id);
  return present.caseSummary(row);
}

async function changeStatus(caseNumber, toStatus, reason, user, scope) {
  const row = await caseRepo.findByNumber(caseNumber, scope);
  if (!row) throw ApiError.notFound('That docket is not within your scope.');

  const permitted = allowedTransitions(row.status, user.role);

  if (!permitted.includes(toStatus)) {
    const anyone = (TRANSITIONS[row.status] || []).map((t) => t.to);
    if (!anyone.includes(toStatus)) {
      throw ApiError.badRequest(
        `A docket at "${row.status}" cannot move to "${toStatus}". Valid next steps: ${anyone.join(', ') || 'none — this docket is closed'}.`
      );
    }
    throw ApiError.forbidden(
      `Moving a docket to "${toStatus}" is reserved for a station commander.`
    );
  }

  const updated = await caseRepo.changeStatus(row.id, row.status, toStatus, reason, user.id);
  return { before: row.status, after: toStatus, case: present.caseSummary(updated) };
}

async function assign(caseNumber, detectiveId, user, scope) {
  const row = await caseRepo.findByNumber(caseNumber, scope);
  if (!row) throw ApiError.notFound('That docket is not within your scope.');

  const detective = await userRepo.findById(detectiveId);
  if (!detective) throw ApiError.badRequest('That officer does not exist.');
  if (detective.role !== 'detective') {
    throw ApiError.badRequest('Dockets may only be assigned to a detective.');
  }
  if (detective.status !== 'active') {
    throw ApiError.badRequest(`${detective.full_name} is not an active account.`);
  }
  if (user.role !== 'admin' && detective.station_id !== user.station_id) {
    throw ApiError.forbidden('You may only assign dockets to detectives at your own station.');
  }

  const updated = await caseRepo.assignDetective(row.id, detectiveId, user.id);
  return { case: present.caseSummary(updated), detective: present.user(detective) };
}

async function addNote(caseNumber, body, user, scope) {
  const row = await caseRepo.findByNumber(caseNumber, scope);
  if (!row) throw ApiError.notFound('That docket is not within your scope.');

  const note = await caseRepo.addNote(row.id, user.id, body);
  return {
    id: note.id,
    by: `${note.rank_title} ${note.author_name}`,
    at: note.created_at,
    text: note.body
  };
}

module.exports = { list, detail, create, changeStatus, assign, addNote };
