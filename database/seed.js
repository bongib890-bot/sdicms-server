/* ==========================================================================
   Seed data
   Loads stations, users, dockets, exhibits with real hash-chained custody,
   suspects, statements, notifications and a genesis audit trail.

   Every password is hashed with bcrypt at the configured cost, so the seed
   accounts behave exactly like accounts created through the interface.

   Run with:  npm run db:seed
   ========================================================================== */

require('dotenv').config();

const bcrypt = require('bcrypt');
const env = require('../src/config/env');
const { pool, query } = require('../src/config/database');
const { chain, GENESIS } = require('../src/utils/hashChain');

const DEMO_PASSWORD = 'Demo1234!';

/* ------------------------------------------------------------------------
   Reference data
   --------------------------------------------------------------------- */
const STATIONS = [
  ['GP-HLB-014', 'Hillbrow', 'Gauteng', 'Corner Klein & Pretoria Street, Hillbrow', '011 488 0000'],
  ['GP-SND-021', 'Sandton', 'Gauteng', 'Summit Road, Sandton', '011 722 4200'],
  ['GP-ORL-033', 'Orlando', 'Gauteng', 'Mooki Street, Orlando East', '011 936 0000'],
  ['WC-CTC-002', 'Cape Town Central', 'Western Cape', 'Buitenkant Street, Cape Town', '021 467 8000'],
  ['WC-MPN-018', 'Mitchells Plain', 'Western Cape', 'AZ Berman Drive, Mitchells Plain', '021 370 1600'],
  ['KZN-DBC-007', 'Durban Central', 'KwaZulu-Natal', 'Stanger Street, Durban', '031 325 4000'],
  ['EC-GQC-011', 'Gqeberha Central', 'Eastern Cape', 'Govan Mbeki Avenue, Gqeberha', '041 394 6000'],
  ['FS-BFN-004', 'Bloemfontein', 'Free State', 'Fontein Street, Bloemfontein', '051 507 6000'],
  ['NOC-001', 'National Operations Centre', 'Gauteng', 'Pretoria', '012 393 1000']
];

// [badge, name, rank, email, role, stationCode, capacity, status]
const USERS = [
  ['SA-4471', 'Mirander Khumalo', 'Systems Administrator', 'm.khumalo@sdicms.gov.za', 'admin', 'NOC-001', 0, 'active'],
  ['SA-2210', 'Bongiwe Zulu', 'Captain', 'b.zulu@sdicms.gov.za', 'commander', 'GP-HLB-014', 0, 'active'],
  ['SA-7734', 'Shalom Adeyemi', 'Detective Sergeant', 's.adeyemi@sdicms.gov.za', 'detective', 'GP-HLB-014', 18, 'active'],
  ['SA-9182', 'Lerato Mahlangu', 'Constable', 'l.mahlangu@sdicms.gov.za', 'officer', 'GP-HLB-014', 0, 'active'],
  ['SA-6612', 'Nkosi Dlamini', 'Detective Constable', 'n.dlamini@sdicms.gov.za', 'detective', 'GP-HLB-014', 18, 'active'],
  ['SA-5540', 'Rashid Naidoo', 'Detective Sergeant', 'r.naidoo@sdicms.gov.za', 'detective', 'GP-HLB-014', 18, 'active'],
  ['SA-3391', 'Thandi Mokoena', 'Detective Warrant Officer', 't.mokoena@sdicms.gov.za', 'detective', 'GP-HLB-014', 18, 'flagged'],
  ['SA-8807', 'Pieter van Wyk', 'Detective Constable', 'p.vanwyk@sdicms.gov.za', 'detective', 'GP-HLB-014', 18, 'active'],
  ['SA-7120', 'Sipho Ndlovu', 'Constable', 's.ndlovu@sdicms.gov.za', 'officer', 'GP-HLB-014', 0, 'suspended'],
  ['SA-1180', 'Aisha Petersen', 'Captain', 'a.petersen@sdicms.gov.za', 'commander', 'WC-CTC-002', 0, 'active']
];

/* daysAgo → a DATETIME the given number of days in the past */
function daysAgo(n, hour = 9) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, Math.floor(Math.random() * 59), 0, 0);
  return d;
}

// [number, title, category, priority, status, detectiveBadge|null, creatorBadge,
//  daysOpen, minutesSinceActivity, description, location, complainant]
const CASES = [
  ['CAS 412/07/2026', 'Armed robbery — Pretoria Street spaza', 'Contact crime', 'Critical',
   'Under investigation', 'SA-7734', 'SA-9182', 6, 90,
   'Two armed males entered the premises at approximately 20:40, threatened the shopkeeper with a firearm and removed cash and airtime vouchers. Both fled on foot towards Klein Street.',
   '114 Pretoria Street, Hillbrow',
   ['Ahmed Hassan', '8503125041088', '0721234418', '114 Pretoria Street, Hillbrow']],

  ['CAS 408/07/2026', 'Vehicle hijacking — Klein Street off-ramp', 'Contact crime', 'Critical',
   'Awaiting forensics', 'SA-7734', 'SA-7120', 9, 420,
   'Complainant was stopped at the off-ramp when three males approached, one armed. Vehicle taken; complainant uninjured. Ballistics submitted for comparison.',
   'Klein Street off-ramp, Hillbrow',
   ['Nomsa Sithole', '9107224088091', '0834562290', 'Berea, Johannesburg']],

  ['CAS 397/07/2026', 'Business burglary — Quartz Street electronics', 'Property-related', 'High',
   'Under investigation', 'SA-7734', 'SA-9182', 14, 1500,
   'Forced entry through the rear service door overnight. Stock inventory outstanding from the complainant.',
   '42 Quartz Street, Hillbrow',
   ['Priya Naicker', '8811035102087', '0791231102', '42 Quartz Street, Hillbrow']],

  ['CAS 385/07/2026', 'Assault GBH — Banket Street tavern', 'Contact crime', 'High',
   'Pending approval', 'SA-7734', 'SA-9182', 21, 260,
   'Altercation between two patrons. Suspect identified and arrested. Docket complete and submitted for closure approval.',
   'Banket Street, Hillbrow',
   ['Johannes Mabaso', '9402118033086', '0715558834', 'Banket Street, Hillbrow']],

  ['CAS 371/07/2026', 'Theft of motor vehicle — Esselen Street', 'Property-related', 'Medium',
   'Under investigation', 'SA-7734', 'SA-9182', 28, 11520,
   'Vehicle removed from street parking. No suspect identified. No activity recorded for eight days.',
   'Esselen Street, Hillbrow',
   ['Tumelo Radebe', '8709145077085', '0761115521', 'Esselen Street, Hillbrow']],

  ['CAS 366/07/2026', 'Fraud — fraudulent RDP housing allocation', 'Commercial crime', 'Medium',
   'Awaiting forensics', 'SA-6612', 'SA-9182', 34, 780,
   'Allegation of falsified allocation documents. Documents submitted for questioned-document examination.',
   'Hillbrow Housing Office',
   ['Dept of Human Settlements', null, '0114880000', 'Johannesburg']],

  ['CAS 352/06/2026', 'Malicious damage to property — Sherwell Street', 'Property-related', 'Low',
   'Closed', 'SA-5540', 'SA-9182', 41, 4300,
   'Suspect admitted liability. Restitution agreed. Docket closed with commander approval.',
   'Sherwell Street, Hillbrow',
   ['Zanele Mkhize', '9506120044081', '0824447712', 'Sherwell Street, Hillbrow']],

  ['CAS 344/06/2026', 'Possession of stolen goods — Twist Street market', 'Property-related', 'Medium',
   'Referred to NPA', 'SA-6612', 'SA-7120', 47, 6200,
   'Four suspects arrested with recovered goods. Docket referred for prosecution.',
   'Twist Street, Hillbrow',
   ['SAPS Hillbrow', null, '0114880000', 'Hillbrow']],

  ['CAS 338/06/2026', 'Common robbery — Joubert Park entrance', 'Contact crime', 'High',
   'Under investigation', 'SA-5540', 'SA-9182', 63, 21600,
   'No suspect identified. Two exhibits on file. This docket has exceeded the 30-day investigation standard.',
   'Joubert Park, Johannesburg',
   ['Kabelo Moloi', '9209085066084', '0733338890', 'Joubert Park']],

  ['CAS 421/07/2026', 'Shoplifting — Kotze Street pharmacy', 'Property-related', 'Low',
   'Reported', null, 'SA-9182', 1, 35,
   'Store CCTV clip attached. Till slip and stock report outstanding.',
   'Kotze Street, Hillbrow',
   ['Fatima Patel', '9203047099082', '0827777719', 'Kotze Street, Hillbrow']],

  ['CAS 420/07/2026', 'Domestic violence complaint — Wolmarans Street', 'Contact crime', 'High',
   'Reported', null, 'SA-9182', 1, 110,
   'Complainant contact number outstanding. Protection order application referred.',
   'Wolmarans Street, Hillbrow',
   ['Withheld', null, null, 'Wolmarans Street, Hillbrow']],

  ['CAS 419/07/2026', 'Drug-related offence — Claim Street corner', 'Drug-related', 'Medium',
   'Assigned', 'SA-6612', 'SA-7120', 2, 200,
   'Two suspects detained during a directed patrol. Substances submitted for analysis.',
   'Claim Street, Hillbrow',
   ['SAPS Hillbrow', null, '0114880000', 'Hillbrow']],

  ['CAS 411/07/2026', 'Domestic violence complaint — Wolmarans Street', 'Contact crime', 'High',
   'Under investigation', 'SA-8807', 'SA-9182', 7, 900,
   'Earlier complaint at the same address. Possibly a continuing matter with CAS 420/07/2026.',
   'Wolmarans Street, Hillbrow',
   ['Withheld', null, null, 'Wolmarans Street, Hillbrow']]
];

async function seed() {
  console.log('\nSDICMS — seeding sample data\n');

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, env.bcryptRounds);
  console.log(`  passwords hashed with bcrypt (cost ${env.bcryptRounds})`);

  /* --- Stations --------------------------------------------------------- */
  const stationIds = {};
  for (const [code, name, province, address, phone] of STATIONS) {
    const result = await query(
      'INSERT INTO stations (code, name, province, address, phone) VALUES (?,?,?,?,?)',
      [code, name, province, address, phone]
    );
    stationIds[code] = result.insertId;
  }
  console.log(`  ${STATIONS.length} stations`);

  /* --- Users ------------------------------------------------------------ */
  const userIds = {};
  for (const [badge, name, rank, email, role, stationCode, capacity, status] of USERS) {
    const result = await query(
      `INSERT INTO users
         (badge_number, full_name, rank_title, email, password_hash, role,
          station_id, caseload_capacity, status, must_change_password, password_changed_at)
       VALUES (?,?,?,?,?,?,?,?,?,0,NOW())`,
      [badge, name, rank, email, passwordHash, role, stationIds[stationCode], capacity || 18, status]
    );
    userIds[badge] = result.insertId;
  }
  console.log(`  ${USERS.length} users`);

  /* --- Cases ------------------------------------------------------------ */
  const caseIds = {};
  for (const c of CASES) {
    const [number, title, category, priority, status, detBadge, creatorBadge,
           days, minutes, description, location, complainant] = c;

    const openedAt = daysAgo(days);
    const lastActivity = new Date(Date.now() - minutes * 60000);

    const result = await query(
      `INSERT INTO cases
         (case_number, title, category, priority, status, description, incident_location,
          station_id, detective_id, created_by, complainant_name, complainant_id_number,
          complainant_phone, complainant_address, opened_at, last_activity_at, closed_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [number, title, category, priority, status, description, location,
       stationIds['GP-HLB-014'],
       detBadge ? userIds[detBadge] : null,
       userIds[creatorBadge],
       complainant[0], complainant[1], complainant[2], complainant[3],
       openedAt, lastActivity,
       ['Closed', 'Referred to NPA'].includes(status) ? lastActivity : null]
    );

    caseIds[number] = result.insertId;

    // A plausible status history rather than a single row.
    const path = ['Reported'];
    if (detBadge) path.push('Assigned');
    if (['Under investigation', 'Awaiting forensics', 'Pending approval', 'Closed', 'Referred to NPA'].includes(status)) {
      path.push('Under investigation');
    }
    if (status === 'Awaiting forensics') path.push('Awaiting forensics');
    if (['Pending approval', 'Closed', 'Referred to NPA'].includes(status)) path.push('Pending approval');
    if (status === 'Closed') path.push('Closed');
    if (status === 'Referred to NPA') path.push('Referred to NPA');

    for (let i = 0; i < path.length; i++) {
      await query(
        `INSERT INTO case_status_history (case_id, from_status, to_status, reason, changed_by, created_at)
         VALUES (?,?,?,?,?,?)`,
        [result.insertId, i === 0 ? null : path[i - 1], path[i],
         i === 0 ? 'Complaint registered' : null,
         userIds[detBadge || creatorBadge],
         daysAgo(Math.max(days - i * 2, 0), 10 + i)]
      );
    }
  }
  console.log(`  ${CASES.length} dockets with status history`);

  /* --- Evidence with hash-chained custody --------------------------------
     The chain is computed exactly as the running application computes it, so
     the integrity check verifies against seeded data too.                   */
  function custodyPayload(row) {
    return [row.evidence_id, row.seq, row.from_party, row.to_party,
            row.action, row.actor_id, new Date(row.occurred_at).toISOString()].join('|');
  }

  async function addExhibit(number, caseNo, label, type, storage, collectorBadge, status, transfers, breakAt) {
    const collectedAt = daysAgo(5, 21);
    const result = await query(
      `INSERT INTO evidence
         (exhibit_number, case_id, label, evidence_type, storage_location, status,
          collected_by, collected_from, collected_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [number, caseIds[caseNo], label, type, storage, status,
       userIds[collectorBadge], 'Scene', collectedAt]
    );

    const evidenceId = result.insertId;
    let prev = GENESIS;

    for (let i = 0; i < transfers.length; i++) {
      const t = transfers[i];
      const occurredAt = daysAgo(5 - i, 8 + i * 3);
      const row = {
        evidence_id: evidenceId, seq: i + 1,
        from_party: t[0], to_party: t[1], action: t[2],
        actor_id: userIds[collectorBadge], occurred_at: occurredAt
      };

      // A deliberate break: this entry is written with a hash that does not
      // follow from its predecessor, exactly as a tampered row would look.
      const entryHash = (breakAt === i + 1)
        ? chain('tampered', custodyPayload(row))
        : chain(prev, custodyPayload(row));

      await query(
        `INSERT INTO custody_chain
           (evidence_id, seq, from_party, to_party, action, actor_id, occurred_at, prev_hash, entry_hash)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [evidenceId, i + 1, t[0], t[1], t[2], userIds[collectorBadge], occurredAt, prev, entryHash]
      );

      prev = entryHash;
    }
  }

  await addExhibit('EX-2026-0441', 'CAS 412/07/2026', 'Scene photograph set (7 frames)',
    'Photograph', 'Exhibit store A', 'SA-7734', 'Verified', [
      ['Scene', 'Det. Sgt S. Adeyemi', 'Collected'],
      ['Det. Sgt S. Adeyemi', 'Exhibit store A', 'Booked in'],
      ['Exhibit store A', 'Det. Sgt S. Adeyemi', 'Signed out for review'],
      ['Det. Sgt S. Adeyemi', 'Exhibit store A', 'Returned']
    ]);

  await addExhibit('EX-2026-0442', 'CAS 412/07/2026', 'Till roll and cash register report',
    'Document', 'Exhibit store A', 'SA-7734', 'Verified', [
      ['Complainant', 'Det. Sgt S. Adeyemi', 'Handed over'],
      ['Det. Sgt S. Adeyemi', 'Exhibit store A', 'Booked in']
    ]);

  // The exhibit with the break — entry 3 does not hash to entry 2.
  await addExhibit('EX-2026-0448', 'CAS 408/07/2026', 'Cartridge casing — 9mm',
    'Physical', 'Forensic Services', 'SA-7734', 'Pending verification', [
      ['Scene', 'Det. Sgt S. Adeyemi', 'Collected'],
      ['Det. Sgt S. Adeyemi', 'Exhibit store A', 'Booked in'],
      ['Exhibit store A', 'Unrecorded', 'Removed'],
      ['Unrecorded', 'Forensic Services', 'Delivered']
    ], 3);

  await addExhibit('EX-2026-0451', 'CAS 421/07/2026', 'Store CCTV clip — 4 min',
    'Video', 'Digital vault', 'SA-9182', 'Pending verification', [
      ['Store manager', 'Const. L. Mahlangu', 'Handed over'],
      ['Const. L. Mahlangu', 'Digital vault', 'Uploaded']
    ]);

  await addExhibit('EX-2026-0452', 'CAS 397/07/2026', 'Rear door tool marks — cast',
    'Physical', 'Exhibit store A', 'SA-7734', 'Verified', [
      ['Scene', 'Det. Sgt S. Adeyemi', 'Collected'],
      ['Det. Sgt S. Adeyemi', 'Exhibit store A', 'Booked in']
    ]);

  console.log('  5 exhibits with hash-chained custody (one deliberate break)');

  /* --- Suspects --------------------------------------------------------- */
  const SUSPECTS = [
    ['SP-1041', 'CAS 412/07/2026', 'Unknown male A', '25–30', 'Sought', 0, 'Approx 1.8 m, dark hooded top. Seen on partial CCTV.', 'SA-7734'],
    ['SP-1042', 'CAS 412/07/2026', 'Unknown male B', '20–25', 'Sought', 0, 'Carried the firearm. No clear image obtained.', 'SA-7734'],
    ['SP-1043', 'CAS 385/07/2026', 'Kagiso Mthembu', '31', 'Arrested', 1, 'Arrested 12 Jul. Bail granted 14 Jul.', 'SA-7734'],
    ['SP-1044', 'CAS 344/06/2026', 'Sibusiso Khoza', '27', 'Charged', 1, 'Docket referred to the NPA.', 'SA-6612'],
    ['SP-1045', 'CAS 421/07/2026', 'Unknown female', '30–40', 'Sought', 0, 'Clear CCTV image available.', 'SA-9182']
  ];

  for (const [ref, caseNo, name, age, status, identified, notes, badge] of SUSPECTS) {
    await query(
      `INSERT INTO suspects (reference, case_id, full_name, apparent_age, status, is_identified, notes, created_by)
       VALUES (?,?,?,?,?,?,?,?)`,
      [ref, caseIds[caseNo], name, age, status, identified, notes, userIds[badge]]
    );
  }
  console.log(`  ${SUSPECTS.length} suspects`);

  /* --- Statements ------------------------------------------------------- */
  const STATEMENTS = [
    ['ST-2201', 'CAS 412/07/2026', 'Ahmed Hassan', 'Complainant', 'SA-9182', 'Signed'],
    ['ST-2202', 'CAS 412/07/2026', 'Grace Mahlaba', 'Witness', 'SA-7734', 'Signed'],
    ['ST-2203', 'CAS 408/07/2026', 'Nomsa Sithole', 'Complainant', 'SA-7120', 'Signed'],
    ['ST-2204', 'CAS 421/07/2026', 'Fatima Patel', 'Complainant', 'SA-9182', 'Draft'],
    ['ST-2205', 'CAS 385/07/2026', 'Johannes Mabaso', 'Complainant', 'SA-7734', 'Signed']
  ];

  for (const [ref, caseNo, deponent, kind, badge, status] of STATEMENTS) {
    await query(
      `INSERT INTO statements
         (reference, case_id, deponent_name, deponent_type, body, status, taken_by, taken_at, signed_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [ref, caseIds[caseNo], deponent, kind,
       'Statement recorded in the deponent\'s own words at the station.',
       status, userIds[badge], daysAgo(4), status === 'Signed' ? daysAgo(4) : null]
    );
  }
  console.log(`  ${STATEMENTS.length} statements`);

  /* --- Notifications ---------------------------------------------------- */
  const NOTIFICATIONS = [
    ['SA-7734', 'urgent', 'alert', 'CAS 371/07/2026 has had no activity for 8 days'],
    ['SA-7734', 'info', 'file', 'Ballistics report attached to CAS 408/07/2026'],
    ['SA-7734', 'ok', 'check', 'Closure approved on CAS 352/06/2026'],
    ['SA-2210', 'urgent', 'alert', '3 dockets exceed the 30-day investigation standard'],
    ['SA-2210', 'info', 'folder', 'CAS 385/07/2026 awaits your closure approval'],
    ['SA-2210', 'urgent', 'users', 'Det. Mokoena is over caseload capacity'],
    ['SA-4471', 'urgent', 'shield', 'Repeated failed sign-ins on badge SA-3391'],
    ['SA-4471', 'urgent', 'alert', 'Custody chain break detected on EX-2026-0448'],
    ['SA-4471', 'info', 'refresh', 'Scheduled backup completed at 02:00'],
    ['SA-9182', 'info', 'folder', 'CAS 421/07/2026 assigned to Det. Adeyemi'],
    ['SA-9182', 'urgent', 'alert', 'Statement outstanding on CAS 420/07/2026'],
    ['SA-9182', 'ok', 'check', 'Your evidence uploads passed verification']
  ];

  for (const [badge, kind, icon, message] of NOTIFICATIONS) {
    await query(
      'INSERT INTO notifications (user_id, kind, icon, message) VALUES (?,?,?,?)',
      [userIds[badge], kind, icon, message]
    );
  }
  console.log(`  ${NOTIFICATIONS.length} notifications`);

  /* --- Audit genesis -----------------------------------------------------
     Written through the same chaining function the application uses, so the
     integrity check passes over seeded history.                            */
  const auditRepo = require('../src/repositories/audit.repository');

  const GENESIS_ENTRIES = [
    ['SA-4471', 'SYSTEM_INIT', 'system', 'database', 'Database seeded'],
    ['SA-9182', 'CASE_CREATE', 'case', 'CAS 421/07/2026', 'Shoplifting complaint registered'],
    ['SA-2210', 'CASE_ASSIGN', 'case', 'CAS 419/07/2026', 'Assigned to Det. Dlamini'],
    ['SA-7734', 'EVIDENCE_ADD', 'evidence', 'EX-2026-0442', 'Till roll booked into exhibit store A'],
    ['SA-7734', 'STATUS_CHANGE', 'case', 'CAS 385/07/2026', 'Under investigation → Pending approval'],
    ['SA-4471', 'CHAIN_VERIFY', 'system', 'audit', 'Nightly verification passed']
  ];

  for (const [badge, action, targetType, targetId, detail] of GENESIS_ENTRIES) {
    const user = USERS.find((u) => u[0] === badge);
    await auditRepo.write({
      actorId: userIds[badge],
      actorName: `${user[2]} ${user[1]}`,
      action, targetType, targetId, detail,
      ip: '127.0.0.1', userAgent: 'seed'
    });
  }
  console.log(`  ${GENESIS_ENTRIES.length} audit entries (hash chained)`);

  /* --- Summary ---------------------------------------------------------- */
  console.log('\n  Sign in with any of these — password for all: ' + DEMO_PASSWORD + '\n');
  console.log('    Administrator     m.khumalo@sdicms.gov.za');
  console.log('    Station Commander b.zulu@sdicms.gov.za');
  console.log('    Detective         s.adeyemi@sdicms.gov.za');
  console.log('    Police Officer    l.mahlangu@sdicms.gov.za');
  console.log('\n  Start the server with: npm run dev\n');

  await pool.end();
}

seed().catch(async (err) => {
  console.error('\nSeeding failed:', err.message);
  console.error('If tables are missing, run: npm run db:setup');
  await pool.end();
  process.exit(1);
});
