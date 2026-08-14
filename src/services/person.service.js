/* ==========================================================================
   Suspects and statements
   ========================================================================== */

const ApiError = require('../utils/ApiError');
const present = require('../utils/present');
const personRepo = require('../repositories/person.repository');
const caseRepo = require('../repositories/case.repository');

async function listSuspects(filters) {
  const rows = await personRepo.listSuspects(filters);
  return rows.map(present.suspect);
}

async function createSuspect(data, user, scope) {
  const docket = await caseRepo.findByNumber(data.caseNumber, scope);
  if (!docket) throw ApiError.notFound('That docket is not within your scope.');

  const id = await personRepo.createSuspect({
    caseId: docket.id,
    fullName: data.fullName,
    idNumber: data.idNumber,
    apparentAge: data.apparentAge,
    status: data.status,
    // A description beginning "Unknown" is not an identification.
    isIdentified: !/^unknown/i.test(data.fullName),
    notes: data.notes,
    createdBy: user.id
  });

  return present.suspect(await personRepo.findSuspect(id));
}

async function listStatements(filters) {
  const rows = await personRepo.listStatements(filters);
  return rows.map(present.statement);
}

async function createStatement(data, user, scope) {
  const docket = await caseRepo.findByNumber(data.caseNumber, scope);
  if (!docket) throw ApiError.notFound('That docket is not within your scope.');

  const id = await personRepo.createStatement({
    caseId: docket.id,
    deponentName: data.deponentName,
    deponentType: data.deponentType,
    body: data.body,
    takenBy: user.id
  });

  return present.statement(await personRepo.findStatement(id));
}

async function signStatement(id, user) {
  const row = await personRepo.findStatement(id);
  if (!row) throw ApiError.notFound('That statement does not exist.');
  if (row.status === 'Signed') throw ApiError.conflict('That statement is already signed.');
  if (row.taken_by !== user.id && user.role === 'officer') {
    throw ApiError.forbidden('Only the officer who recorded a statement may mark it signed.');
  }

  await personRepo.signStatement(id);
  return present.statement(await personRepo.findStatement(id));
}

module.exports = {
  listSuspects, createSuspect, listStatements, createStatement, signStatement
};
