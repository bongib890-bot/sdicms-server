/* ==========================================================================
   Station service
   ========================================================================== */

const present = require('../utils/present');
const stationRepo = require('../repositories/station.repository');
const ApiError = require('../utils/ApiError');

async function list() {
  const rows = await stationRepo.list();
  return rows.map(present.station);
}

async function create(data) {
  if (!/^[A-Z]{2,3}-[A-Z]{3}-\d{3}$/.test(data.code)) {
    throw ApiError.badRequest('Station codes follow the pattern GP-HLB-014.', {
      code: 'Use the format PROVINCE-STATION-NUMBER, for example GP-HLB-014.'
    });
  }
  const row = await stationRepo.create(data);
  return present.station({ ...row, officers: 0, open_cases: 0, total_cases: 0, closed_cases: 0 });
}

module.exports = { list, create };
