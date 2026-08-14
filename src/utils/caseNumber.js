/* ==========================================================================
   Reference generators
   Case numbers follow the SAPS docket convention: CAS <serial>/<month>/<year>.
   The serial restarts each month and is allocated inside a transaction so two
   simultaneous registrations cannot collide.
   ========================================================================== */

function pad(n, width) {
  return String(n).padStart(width, '0');
}

function caseNumber(serial, date = new Date()) {
  return `CAS ${serial}/${pad(date.getMonth() + 1, 2)}/${date.getFullYear()}`;
}

function exhibitNumber(serial, date = new Date()) {
  return `EX-${date.getFullYear()}-${pad(serial, 4)}`;
}

function suspectReference(serial) {
  return `SP-${pad(serial, 4)}`;
}

function statementReference(serial) {
  return `ST-${pad(serial, 4)}`;
}

function forensicReference(serial, date = new Date()) {
  return `FSL-${date.getFullYear()}-${pad(serial, 5)}`;
}

module.exports = {
  caseNumber, exhibitNumber, suspectReference, statementReference, forensicReference
};
