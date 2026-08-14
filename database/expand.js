/* ==========================================================================
   SDICMS — Expand to a national picture
   Additive migration. Does NOT touch anything that already exists — every
   insert here is new rows only, so it is safe to run against a database you
   have already been using and testing against.

   What this adds:
    1. An ALTER on users.role — your existing database was built before the
       Station Administrator tier existed, so the column does not accept
       that value yet until this runs.
    2. A Station Administrator account for each station that does not
       already have one.
    3. A batch of dockets (mixed open/closed) at stations that currently
       have none, so their clearance percentage becomes a real number
       instead of 0% for lack of any data to compute it from.

   Run with:  node database/expand.js
   ========================================================================== */

require('dotenv').config();

const bcrypt = require('bcrypt');
const env = require('../src/config/env');
const { pool, query } = require('../src/config/database');

const DEMO_PASSWORD = 'Demo1234!';

function daysAgo(n, hour = 9) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, Math.floor(Math.random() * 59), 0, 0);
  return d;
}

// [badge, name, rank, email, stationCode]
const STATION_ADMINS = [
  ['SA-4201', 'Kagiso Ramaphosa',  'Warrant Officer', 's.admin.sandton@sdicms.gov.za',   'GP-SND-021'],
  ['SA-4202', 'Precious Nkosi',    'Warrant Officer', 's.admin.orlando@sdicms.gov.za',    'GP-ORL-033'],
  ['SA-4203', 'Willem Botha',      'Captain',         's.admin.ctc@sdicms.gov.za',        'WC-CTC-002'],
  ['SA-4204', 'Nomvula Dube',      'Warrant Officer', 's.admin.mitchells@sdicms.gov.za',  'WC-MPN-018'],
  ['SA-4205', 'Sibongile Zungu',   'Captain',         's.admin.durban@sdicms.gov.za',     'KZN-DBC-007'],
  ['SA-4206', 'Andile Fakude',     'Warrant Officer', 's.admin.gqeberha@sdicms.gov.za',   'EC-GQC-011'],
  ['SA-4207', 'Johan Pretorius',   'Warrant Officer', 's.admin.bloemfontein@sdicms.gov.za','FS-BFN-004']
];

// A spread of case titles used to populate stations with no docket history yet.
// [title, category, priority, status, daysOpen]
const CASE_TEMPLATES = [
  ['Business burglary — retail strip', 'Property-related', 'High', 'Closed', 52],
  ['Common assault — taxi rank', 'Contact crime', 'Medium', 'Closed', 44],
  ['Theft of motor vehicle', 'Property-related', 'Medium', 'Under investigation', 18],
  ['Possession of suspected stolen property', 'Property-related', 'Low', 'Closed', 61],
  ['Robbery with aggravating circumstances', 'Contact crime', 'Critical', 'Referred to NPA', 70],
  ['Malicious damage to property', 'Property-related', 'Low', 'Closed', 38],
  ['Housebreaking — residential', 'Property-related', 'High', 'Under investigation', 12],
  ['Drug possession — public order', 'Drug-related', 'Medium', 'Assigned', 5],
  ['Fraud — false vendor invoicing', 'Commercial crime', 'Medium', 'Awaiting forensics', 26],
  ['Common robbery — pedestrian', 'Contact crime', 'High', 'Closed', 49],
  ['Shoplifting — repeat offender', 'Property-related', 'Low', 'Closed', 33],
  ['Domestic violence complaint', 'Contact crime', 'High', 'Under investigation', 8]
];

async function run() {
  console.log('\nSDICMS — expanding to a national picture\n');

  /* --- 1. Allow the new role value ------------------------------------- */
  await query(
    "ALTER TABLE users MODIFY COLUMN role ENUM('admin','station_admin','commander','detective','officer') NOT NULL"
  );
  console.log('  users.role now accepts station_admin');

  /* --- 2. Station Administrators ----------------------------------------
     One per station that does not already have one. Skips stations that
     already have a station_admin, so this is safe to run more than once. */
  const stations = await query('SELECT id, code, name FROM stations');
  const stationByCode = {};
  stations.forEach((s) => { stationByCode[s.code] = s; });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, env.bcryptRounds);
  let adminsCreated = 0;

  for (const [badge, name, rank, email, code] of STATION_ADMINS) {
    const station = stationByCode[code];
    if (!station) continue;

    const already = await query(
      "SELECT id FROM users WHERE station_id = ? AND role = 'station_admin' LIMIT 1",
      [station.id]
    );
    if (already.length) continue;

    const existingBadge = await query('SELECT id FROM users WHERE badge_number = ?', [badge]);
    if (existingBadge.length) continue;

    await query(
      `INSERT INTO users
         (badge_number, full_name, rank_title, email, password_hash, role,
          station_id, caseload_capacity, status, must_change_password, password_changed_at)
       VALUES (?,?,?,?,?, 'station_admin', ?, 0, 'active', 0, NOW())`,
      [badge, name, rank, email, passwordHash, station.id]
    );
    adminsCreated += 1;
  }
  console.log(`  ${adminsCreated} Station Administrator account(s) added`);

  /* --- 3. Dockets for stations with none --------------------------------
     Only stations with zero existing dockets are touched, so Hillbrow (and
     anywhere else you have already been working in) is left completely
     alone. */
  let casesCreated = 0;

  for (const station of stations) {
    const existingCases = await query('SELECT COUNT(*) AS n FROM cases WHERE station_id = ?', [station.id]);
    if (Number(existingCases[0].n) > 0) continue;

    const creator = await query(
      "SELECT id FROM users WHERE station_id = ? AND role IN ('officer','station_admin') LIMIT 1",
      [station.id]
    );
    if (!creator.length) continue; // no one at this station to attribute the docket to
    const creatorId = creator[0].id;

    // Give this station a detective if it has one; otherwise leave unassigned.
    const detective = await query(
      "SELECT id, full_name FROM users WHERE station_id = ? AND role = 'detective' LIMIT 1",
      [station.id]
    );

    // Serial continues from the current month's highest case number so
    // numbering stays consistent with dockets created through the app.
    const now = new Date();
    const existingMax = await query(
      `SELECT case_number FROM cases
        WHERE YEAR(opened_at) = ? AND MONTH(opened_at) = ?
        ORDER BY id DESC LIMIT 1`,
      [now.getFullYear(), now.getMonth() + 1]
    );
    let serial = 500 + station.id * 10;
    if (existingMax.length) {
      const parsed = parseInt(String(existingMax[0].case_number).replace('CAS ', ''), 10);
      if (!Number.isNaN(parsed) && parsed >= serial) serial = parsed + 1;
    }

    // Pick a handful of templates for this station so every station is not
    // identical — enough to make a real, differentiated clearance rate.
    const count = 5 + (station.id % 4); // 5–8 dockets per station
    for (let i = 0; i < count; i++) {
      const tpl = CASE_TEMPLATES[(station.id + i) % CASE_TEMPLATES.length];
      const [title, category, priority, status, daysOpen] = tpl;
      const openedAt = daysAgo(daysOpen);
      const isClosed = status === 'Closed' || status === 'Referred to NPA';

      const detId = (status !== 'Reported' && detective.length) ? detective[0].id : null;

      await query(
        `INSERT INTO cases
           (case_number, title, category, priority, status, description, incident_location,
            station_id, detective_id, created_by, opened_at, last_activity_at, closed_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          `CAS ${serial + i}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`,
          `${title} — ${station.name}`,
          category, priority, status,
          'Docket seeded to establish a station-level case history for reporting.',
          `${station.name}, station precinct`,
          station.id, detId, creatorId,
          openedAt, openedAt,
          isClosed ? openedAt : null
        ]
      );
      casesCreated += 1;
    }
  }
  console.log(`  ${casesCreated} docket(s) added across previously-empty stations`);

  console.log('\n  Station Administrator sign-in — password for all: ' + DEMO_PASSWORD + '\n');
  STATION_ADMINS.forEach(([badge, name, , email]) => {
    console.log(`    ${name.padEnd(22)} ${email}`);
  });
  console.log('\n  Restart the server, then sign in as the Super Administrator to see');
  console.log('  Users & permissions → Station Administrators.\n');

  await pool.end();
}

run().catch(async (err) => {
  console.error('\nExpansion failed:', err.message);
  await pool.end();
  process.exit(1);
});
