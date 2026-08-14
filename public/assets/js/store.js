/* ==========================================================================
   SDICMS — Store
   The single seam between the interface and its data.

   Two modes, one interface:
     • API mode — the page is served by the Node server and a session exists.
       Reads come from a cache filled by one bootstrap call; writes go to the
       API and then refresh the cache.
     • Standalone mode — the files were opened straight from disk. The same
       seed data the database ships with is held in memory, so every screen
       still works with no server and no MySQL.

   Reads are synchronous, served from the cache. Writes always return a
   Promise, so calling code never has to know which mode it is in.
   ========================================================================== */

window.SD_STORE = (function () {
  'use strict';

  var remote = false;

  var cache = {
    user: null,
    cases: [],
    caseDetails: {},
    evidence: [],
    documents: [],
    suspects: [],
    statements: [],
    staff: [],
    stationAdmins: [],
    stations: [],
    audit: [],
    auditIntegrity: { intact: true },
    notifications: [],
    insights: [],
    stats: null,
    trend: null,
    permissions: {}
  };

  /* ======================================================================
     Case lifecycle — mirrored from the server.
     The server is the authority; this copy only decides which buttons to
     draw. A transition the client allows and the server refuses is rejected.
     ====================================================================== */
  var TRANSITIONS = {
    'Reported': [{ to: 'Assigned', label: 'Assign detective', roles: ['admin', 'commander'] }],
    'Assigned': [{ to: 'Under investigation', label: 'Begin investigation', roles: ['admin', 'commander', 'detective'] }],
    'Under investigation': [
      { to: 'Awaiting forensics', label: 'Request forensic analysis', roles: ['admin', 'commander', 'detective'] },
      { to: 'Pending approval', label: 'Request closure', roles: ['admin', 'commander', 'detective'] }
    ],
    'Awaiting forensics': [{ to: 'Under investigation', label: 'Forensics returned', roles: ['admin', 'commander', 'detective'] }],
    'Pending approval': [
      { to: 'Closed', label: 'Approve closure', roles: ['admin', 'commander'] },
      { to: 'Referred to NPA', label: 'Refer to NPA', roles: ['admin', 'commander'] },
      { to: 'Under investigation', label: 'Return for more work', roles: ['admin', 'commander'] }
    ],
    'Closed': [],
    'Referred to NPA': []
  };

  var PERMISSION_MATRIX = {
    createCase:     ['officer', 'detective', 'commander', 'admin'],
    editCase:       ['detective', 'commander', 'admin'],
    addEvidence:    ['officer', 'detective', 'commander', 'admin'],
    addSuspect:     ['detective', 'commander', 'admin'],
    addStatement:   ['officer', 'detective', 'commander', 'admin'],
    uploadDocument: ['officer', 'detective', 'commander', 'admin'],
    assign:         ['commander', 'admin'],
    approve:        ['commander', 'admin'],
    verifyEvidence: ['detective', 'commander', 'admin'],
    manageUsers:    ['admin', 'station_admin'],
    viewAudit:      ['admin', 'station_admin', 'commander'],
    viewAllCases:   ['commander', 'station_admin', 'admin'],
    viewAdminOversight: ['admin']
  };

  /* ======================================================================
     Standalone seed data
     Mirrors what database/seed.js loads, so both modes tell the same story.
     ====================================================================== */
  var DEMO_USERS = {
    admin:         { id: 1, name: 'Mirander Khumalo', rank: 'Systems Administrator', role: 'admin', roleLabel: 'Super Administrator', email: 'm.khumalo@sdicms.gov.za', badge: 'SA-4471', station: 'National Operations Centre', stationCode: 'NOC-001' },
    station_admin: { id: 5, name: 'Kagiso Ramaphosa', rank: 'Warrant Officer', role: 'station_admin', roleLabel: 'Station Administrator', email: 's.admin.sandton@sdicms.gov.za', badge: 'SA-4201', station: 'Sandton Police Station', stationCode: 'GP-SND-021' },
    commander:     { id: 2, name: 'Bongiwe Zulu', rank: 'Captain', role: 'commander', roleLabel: 'Station Commander', email: 'b.zulu@sdicms.gov.za', badge: 'SA-2210', station: 'Hillbrow Police Station', stationCode: 'GP-HLB-014' },
    detective:     { id: 3, name: 'Shalom Adeyemi', rank: 'Detective Sergeant', role: 'detective', roleLabel: 'Detective', email: 's.adeyemi@sdicms.gov.za', badge: 'SA-7734', station: 'Hillbrow Police Station', stationCode: 'GP-HLB-014' },
    officer:       { id: 4, name: 'Lerato Mahlangu', rank: 'Constable', role: 'officer', roleLabel: 'Police Officer', email: 'l.mahlangu@sdicms.gov.za', badge: 'SA-9182', station: 'Hillbrow Police Station', stationCode: 'GP-HLB-014' }
  };

  function demoCase(o) {
    return {
      no: o.no, title: o.title, category: o.category, priority: o.priority, status: o.status,
      detective: o.detective || null, station: 'Hillbrow', opened: o.opened, health: o.health,
      lastActivity: o.lastActivity, description: o.description || '',
      location: o.location || 'Hillbrow, Johannesburg',
      complainant: o.complainant || { name: 'Not recorded', id: '—', phone: '—', address: '—' },
      notes: [],
      timeline: o.timeline || [{ t: 'Complaint registered', by: 'Const. Lerato Mahlangu', at: new Date(), body: '', state: 'done' }]
    };
  }

  var DEMO_CASES = [
    demoCase({ no: 'CAS 412/07/2026', title: 'Armed robbery — Pretoria Street spaza', category: 'Contact crime', priority: 'Critical', status: 'Under investigation', detective: 'Shalom Adeyemi', opened: 6, health: 82, lastActivity: 90, location: '114 Pretoria Street, Hillbrow', description: 'Two armed males entered the premises at approximately 20:40, threatened the shopkeeper with a firearm and removed cash and airtime vouchers.', complainant: { name: 'Ahmed Hassan', id: '8503125••••••', phone: '072 ••• 4418', address: '114 Pretoria Street, Hillbrow' } }),
    demoCase({ no: 'CAS 408/07/2026', title: 'Vehicle hijacking — Klein Street off-ramp', category: 'Contact crime', priority: 'Critical', status: 'Awaiting forensics', detective: 'Shalom Adeyemi', opened: 9, health: 64, lastActivity: 420, description: 'Complainant stopped at the off-ramp when three males approached, one armed. Ballistics submitted.' }),
    demoCase({ no: 'CAS 397/07/2026', title: 'Business burglary — Quartz Street electronics', category: 'Property-related', priority: 'High', status: 'Under investigation', detective: 'Shalom Adeyemi', opened: 14, health: 71, lastActivity: 1500, description: 'Forced entry through the rear service door overnight.' }),
    demoCase({ no: 'CAS 385/07/2026', title: 'Assault GBH — Banket Street tavern', category: 'Contact crime', priority: 'High', status: 'Pending approval', detective: 'Shalom Adeyemi', opened: 21, health: 91, lastActivity: 260, description: 'Suspect identified and arrested. Docket submitted for closure approval.' }),
    demoCase({ no: 'CAS 371/07/2026', title: 'Theft of motor vehicle — Esselen Street', category: 'Property-related', priority: 'Medium', status: 'Under investigation', detective: 'Shalom Adeyemi', opened: 28, health: 38, lastActivity: 11520, description: 'No suspect identified. No activity recorded for eight days.' }),
    demoCase({ no: 'CAS 366/07/2026', title: 'Fraud — fraudulent RDP housing allocation', category: 'Commercial crime', priority: 'Medium', status: 'Awaiting forensics', detective: 'Nkosi Dlamini', opened: 34, health: 76, lastActivity: 780, description: 'Documents submitted for questioned-document examination.' }),
    demoCase({ no: 'CAS 352/06/2026', title: 'Malicious damage to property — Sherwell Street', category: 'Property-related', priority: 'Low', status: 'Closed', detective: 'Rashid Naidoo', opened: 41, health: 100, lastActivity: 4300, description: 'Suspect admitted liability. Restitution agreed.' }),
    demoCase({ no: 'CAS 344/06/2026', title: 'Possession of stolen goods — Twist Street market', category: 'Property-related', priority: 'Medium', status: 'Referred to NPA', detective: 'Nkosi Dlamini', opened: 47, health: 100, lastActivity: 6200, description: 'Four suspects arrested with recovered goods.' }),
    demoCase({ no: 'CAS 338/06/2026', title: 'Common robbery — Joubert Park entrance', category: 'Contact crime', priority: 'High', status: 'Under investigation', detective: 'Rashid Naidoo', opened: 63, health: 22, lastActivity: 21600, description: 'No suspect identified. Past the 30-day standard.' }),
    demoCase({ no: 'CAS 421/07/2026', title: 'Shoplifting — Kotze Street pharmacy', category: 'Property-related', priority: 'Low', status: 'Reported', opened: 1, health: 45, lastActivity: 35, description: 'Store CCTV clip attached. Till slip outstanding.' }),
    demoCase({ no: 'CAS 420/07/2026', title: 'Domestic violence complaint — Wolmarans Street', category: 'Contact crime', priority: 'High', status: 'Reported', opened: 1, health: 52, lastActivity: 110, description: 'Complainant contact number outstanding.' }),
    demoCase({ no: 'CAS 419/07/2026', title: 'Drug-related offence — Claim Street corner', category: 'Drug-related', priority: 'Medium', status: 'Assigned', detective: 'Nkosi Dlamini', opened: 2, health: 58, lastActivity: 200, description: 'Two suspects detained during a directed patrol.' })
  ];

  /** Deterministic stand-in for SHA-256, used only in standalone mode. */
  function demoDigest(str) {
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < str.length; i++) {
      h1 = ((h1 ^ str.charCodeAt(i)) * 0x01000193) >>> 0;
      h2 = ((h2 + str.charCodeAt(i) * (i + 7)) * 0x85ebca6b) >>> 0;
    }
    return (h1.toString(16) + h2.toString(16)).padStart(16, '0').slice(0, 16);
  }

  function demoChain(entries, breakAt) {
    var prev = '0000000000000000';
    return entries.map(function (e, i) {
      var hash = demoDigest(prev + e[1] + e[2] + i);
      var row = { seq: i + 1, from: e[0], to: e[1], action: e[2], at: e[3],
                  prevHash: prev, hash: hash, ok: breakAt !== i + 1 };
      prev = hash;
      return row;
    });
  }

  var DEMO_EVIDENCE = [
    { id: 'EX-2026-0441', caseNo: 'CAS 412/07/2026', label: 'Scene photograph set (7 frames)', type: 'Photograph', collectedBy: 'Det. Sgt Shalom Adeyemi', collectedAt: '22 Jul 2026, 21:20', location: 'Exhibit store A', status: 'Verified', size: '18.4 MB', hasFile: false,
      chain: demoChain([['Scene', 'Det. Sgt S. Adeyemi', 'Collected', '22 Jul 21:20'], ['Det. Sgt S. Adeyemi', 'Exhibit store A', 'Booked in', '22 Jul 23:05'], ['Exhibit store A', 'Det. Sgt S. Adeyemi', 'Signed out for review', '24 Jul 09:12'], ['Det. Sgt S. Adeyemi', 'Exhibit store A', 'Returned', '24 Jul 16:40']]) },
    { id: 'EX-2026-0442', caseNo: 'CAS 412/07/2026', label: 'Till roll and cash register report', type: 'Document', collectedBy: 'Det. Sgt Shalom Adeyemi', collectedAt: '23 Jul 2026, 10:05', location: 'Exhibit store A', status: 'Verified', size: '0.9 MB', hasFile: false,
      chain: demoChain([['Complainant', 'Det. Sgt S. Adeyemi', 'Handed over', '23 Jul 10:05'], ['Det. Sgt S. Adeyemi', 'Exhibit store A', 'Booked in', '23 Jul 11:30']]) },
    { id: 'EX-2026-0448', caseNo: 'CAS 408/07/2026', label: 'Cartridge casing — 9mm', type: 'Physical', collectedBy: 'Det. Sgt Shalom Adeyemi', collectedAt: '19 Jul 2026, 22:50', location: 'Forensic Services', status: 'Chain break', size: '—', hasFile: false,
      chain: demoChain([['Scene', 'Det. Sgt S. Adeyemi', 'Collected', '19 Jul 22:50'], ['Det. Sgt S. Adeyemi', 'Exhibit store A', 'Booked in', '20 Jul 00:15'], ['Exhibit store A', 'Unrecorded', 'Removed', '21 Jul 14:00'], ['Unrecorded', 'Forensic Services', 'Delivered', '21 Jul 16:30']], 3) },
    { id: 'EX-2026-0451', caseNo: 'CAS 421/07/2026', label: 'Store CCTV clip — 4 min', type: 'Video', collectedBy: 'Const. Lerato Mahlangu', collectedAt: '27 Jul 2026, 15:40', location: 'Digital vault', status: 'Pending verification', size: '142 MB', hasFile: false,
      chain: demoChain([['Store manager', 'Const. L. Mahlangu', 'Handed over', '27 Jul 15:40'], ['Const. L. Mahlangu', 'Digital vault', 'Uploaded', '27 Jul 16:02']]) },
    { id: 'EX-2026-0452', caseNo: 'CAS 397/07/2026', label: 'Rear door tool marks — cast', type: 'Physical', collectedBy: 'Det. Sgt Shalom Adeyemi', collectedAt: '15 Jul 2026, 08:30', location: 'Exhibit store A', status: 'Verified', size: '—', hasFile: false,
      chain: demoChain([['Scene', 'Det. Sgt S. Adeyemi', 'Collected', '15 Jul 08:30'], ['Det. Sgt S. Adeyemi', 'Exhibit store A', 'Booked in', '15 Jul 12:00']]) }
  ];

  var DEMO_SUSPECTS = [
    { id: 'SP-1041', name: 'Unknown male A', caseNo: 'CAS 412/07/2026', age: '25–30', status: 'Sought', identified: false, note: 'Approx 1.8 m, dark hooded top. Seen on partial CCTV.' },
    { id: 'SP-1042', name: 'Unknown male B', caseNo: 'CAS 412/07/2026', age: '20–25', status: 'Sought', identified: false, note: 'Carried the firearm.' },
    { id: 'SP-1043', name: 'Kagiso Mthembu', caseNo: 'CAS 385/07/2026', age: '31', status: 'Arrested', identified: true, note: 'Arrested 12 Jul. Bail granted 14 Jul.' },
    { id: 'SP-1044', name: 'Sibusiso Khoza', caseNo: 'CAS 344/06/2026', age: '27', status: 'Charged', identified: true, note: 'Docket referred to the NPA.' },
    { id: 'SP-1045', name: 'Unknown female', caseNo: 'CAS 421/07/2026', age: '30–40', status: 'Sought', identified: false, note: 'Clear CCTV image available.' }
  ];

  var DEMO_STATEMENTS = [
    { id: 'ST-2201', caseNo: 'CAS 412/07/2026', deponent: 'Ahmed Hassan', kind: 'Complainant', takenBy: 'Const. Lerato Mahlangu', at: '22 Jul 2026', status: 'Signed' },
    { id: 'ST-2202', caseNo: 'CAS 412/07/2026', deponent: 'Grace Mahlaba', kind: 'Witness', takenBy: 'Det. Sgt Shalom Adeyemi', at: '24 Jul 2026', status: 'Signed' },
    { id: 'ST-2203', caseNo: 'CAS 408/07/2026', deponent: 'Nomsa Sithole', kind: 'Complainant', takenBy: 'Const. Sipho Ndlovu', at: '19 Jul 2026', status: 'Signed' },
    { id: 'ST-2204', caseNo: 'CAS 421/07/2026', deponent: 'Fatima Patel', kind: 'Complainant', takenBy: 'Const. Lerato Mahlangu', at: '27 Jul 2026', status: 'Draft' },
    { id: 'ST-2205', caseNo: 'CAS 385/07/2026', deponent: 'Johannes Mabaso', kind: 'Complainant', takenBy: 'Det. Sgt Shalom Adeyemi', at: '08 Jul 2026', status: 'Signed' }
  ];

  var DEMO_STAFF = [
    { id: 3, name: 'Shalom Adeyemi', rank: 'Det. Sergeant', role: 'detective', roleLabel: 'Detective', badge: 'SA-7734', active: 5, capacity: 18, closed: 0, overdue: 1, status: 'Active' },
    { id: 5, name: 'Nkosi Dlamini', rank: 'Det. Constable', role: 'detective', roleLabel: 'Detective', badge: 'SA-6612', active: 2, capacity: 18, closed: 1, overdue: 1, status: 'Active' },
    { id: 6, name: 'Rashid Naidoo', rank: 'Det. Sergeant', role: 'detective', roleLabel: 'Detective', badge: 'SA-5540', active: 1, capacity: 18, closed: 1, overdue: 1, status: 'Active' },
    { id: 7, name: 'Thandi Mokoena', rank: 'Det. Warrant Officer', role: 'detective', roleLabel: 'Detective', badge: 'SA-3391', active: 21, capacity: 18, closed: 5, overdue: 5, status: 'Flagged' },
    { id: 8, name: 'Pieter van Wyk', rank: 'Det. Constable', role: 'detective', roleLabel: 'Detective', badge: 'SA-8807', active: 1, capacity: 18, closed: 0, overdue: 0, status: 'Active' },
    { id: 2, name: 'Bongiwe Zulu', rank: 'Captain', role: 'commander', roleLabel: 'Station Commander', badge: 'SA-2210', active: 0, capacity: 0, closed: 0, overdue: 0, status: 'Active' },
    { id: 4, name: 'Lerato Mahlangu', rank: 'Constable', role: 'officer', roleLabel: 'Police Officer', badge: 'SA-9182', active: 0, capacity: 0, closed: 0, overdue: 0, status: 'Active' },
    { id: 9, name: 'Sipho Ndlovu', rank: 'Constable', role: 'officer', roleLabel: 'Police Officer', badge: 'SA-7120', active: 0, capacity: 0, closed: 0, overdue: 0, status: 'Suspended' },
    { id: 5, name: 'Kagiso Ramaphosa', rank: 'Warrant Officer', role: 'station_admin', roleLabel: 'Station Administrator', badge: 'SA-4201', active: 0, capacity: 0, closed: 0, overdue: 0, status: 'Active' }
  ];

  var DEMO_STATIONS = [
    { id: 1, name: 'Hillbrow', code: 'GP-HLB-014', province: 'Gauteng', officers: 148, open: 312, clearance: 61 },
    { id: 2, name: 'Sandton', code: 'GP-SND-021', province: 'Gauteng', officers: 96, open: 187, clearance: 74 },
    { id: 3, name: 'Orlando', code: 'GP-ORL-033', province: 'Gauteng', officers: 122, open: 268, clearance: 58 },
    { id: 4, name: 'Cape Town Central', code: 'WC-CTC-002', province: 'Western Cape', officers: 176, open: 341, clearance: 69 },
    { id: 5, name: 'Mitchells Plain', code: 'WC-MPN-018', province: 'Western Cape', officers: 134, open: 402, clearance: 47 },
    { id: 6, name: 'Durban Central', code: 'KZN-DBC-007', province: 'KwaZulu-Natal', officers: 159, open: 295, clearance: 66 },
    { id: 7, name: 'Gqeberha Central', code: 'EC-GQC-011', province: 'Eastern Cape', officers: 88, open: 173, clearance: 72 },
    { id: 8, name: 'Bloemfontein', code: 'FS-BFN-004', province: 'Free State', officers: 71, open: 129, clearance: 78 }
  ];

  var DEMO_NOTIFICATIONS = {
    detective: [
      { kind: 'urgent', icon: 'alert', text: 'CAS 371/07/2026 has had no activity for 8 days', at: new Date() },
      { kind: 'info', icon: 'file', text: 'Ballistics report attached to CAS 408/07/2026', at: new Date() },
      { kind: 'ok', icon: 'check', text: 'Closure approved on CAS 352/06/2026', at: new Date() }
    ],
    commander: [
      { kind: 'urgent', icon: 'alert', text: '3 dockets exceed the 30-day investigation standard', at: new Date() },
      { kind: 'info', icon: 'folder', text: 'CAS 385/07/2026 awaits your closure approval', at: new Date() },
      { kind: 'urgent', icon: 'users', text: 'Det. Mokoena is over caseload capacity', at: new Date() }
    ],
    admin: [
      { kind: 'urgent', icon: 'shield', text: 'Repeated failed sign-ins on badge SA-3391', at: new Date() },
      { kind: 'urgent', icon: 'alert', text: 'Custody chain break detected on EX-2026-0448', at: new Date() },
      { kind: 'info', icon: 'refresh', text: 'Scheduled backup completed at 02:00', at: new Date() }
    ],
    officer: [
      { kind: 'info', icon: 'folder', text: 'CAS 421/07/2026 assigned to Det. Adeyemi', at: new Date() },
      { kind: 'urgent', icon: 'alert', text: 'Statement outstanding on CAS 420/07/2026', at: new Date() },
      { kind: 'ok', icon: 'check', text: 'Your evidence uploads passed verification', at: new Date() }
    ]
  };

  var DEMO_INSIGHTS = {
    detective: [
      { id: 1, kind: 'Stalled docket', confidence: 0.96, ref: 'CAS 371/07/2026', text: 'No activity recorded for 8 days and no suspect on file. This docket breaches the 30-day standard in 2 days.', actions: ['Add case note', 'Dismiss'] },
      { id: 2, kind: 'Missing evidence', confidence: 0.91, ref: 'CAS 412/07/2026', text: 'This docket holds exhibits but no CCTV request is logged. Footage is typically overwritten after 14 days and 6 have passed.', actions: ['Log follow-up', 'Dismiss'] }
    ],
    commander: [
      { id: 3, kind: 'Workload', confidence: 0.93, ref: 'Station', text: 'Det. Mokoena carries 21 active dockets against a capacity of 18, while Det. van Wyk holds 6. Moving 4 dockets would bring both within range.', actions: ['Review reassignment', 'Dismiss'] },
      { id: 4, kind: 'Duplicate detected', confidence: 0.74, ref: 'CAS 420/07/2026', text: 'This docket and CAS 411/07/2026 share an address on Wolmarans Street and were reported 6 days apart. They may be one continuing matter.', actions: ['Compare dockets', 'Dismiss'] }
    ],
    admin: [
      { id: 5, kind: 'Integrity', confidence: 0.99, ref: 'EX-2026-0448', text: 'Exhibit EX-2026-0448 has a custody entry at position 3 that does not hash to the entry before it. The exhibit moved without a recorded handler.', actions: ['Open exhibit', 'Dismiss'] },
      { id: 6, kind: 'Security', confidence: 0.88, ref: 'SA-3391', text: 'Badge SA-3391 recorded repeated failed sign-ins from outside the Gauteng network block, then succeeded.', actions: ['Flag account', 'Dismiss'] }
    ],
    officer: [
      { id: 7, kind: 'Incomplete', confidence: 0.89, ref: 'CAS 420/07/2026', text: 'The complaint you captured has no complainant contact number. Statements without contact details are normally returned.', actions: ['Open docket', 'Dismiss'] },
      { id: 8, kind: 'Suggested evidence', confidence: 0.76, ref: 'CAS 421/07/2026', text: 'For a shoplifting docket the till slip, the stock report and the store CCTV clip are normally required. Only the CCTV clip is attached.', actions: ['Upload evidence', 'Dismiss'] }
    ]
  };

  /* ======================================================================
     Standalone audit chain
     ====================================================================== */
  var demoSeq = 0;
  var demoLastHash = '0000000000000000';

  function demoAudit(actor, action, target, detail) {
    demoSeq += 1;
    var at = new Date();
    var hash = demoDigest(demoLastHash + demoSeq + actor + action + target + at.toISOString());
    var entry = { seq: demoSeq, at: at, actor: actor, action: action, target: target,
                  detail: detail || '', prevHash: demoLastHash, hash: hash, ok: true };
    demoLastHash = hash;
    cache.audit.unshift(entry);
    return entry;
  }

  function loadDemo(role) {
    remote = false;
    cache.user = DEMO_USERS[role] || DEMO_USERS.detective;
    cache.cases = JSON.parse(JSON.stringify(DEMO_CASES));
    cache.cases.forEach(function (c) {
      c.timeline.forEach(function (t) { t.at = new Date(); });
    });
    cache.evidence = JSON.parse(JSON.stringify(DEMO_EVIDENCE));
    cache.suspects = DEMO_SUSPECTS.slice();
    cache.statements = DEMO_STATEMENTS.slice();
    cache.staff = DEMO_STAFF.slice();
    cache.stationAdmins = DEMO_STATION_ADMINS.slice();
    cache.stations = DEMO_STATIONS.slice();
    cache.documents = [];
    cache.caseDetails = {};
    cache.notifications = (DEMO_NOTIFICATIONS[cache.user.role] || []).slice();
    cache.insights = (DEMO_INSIGHTS[cache.user.role] || []).slice();
    cache.audit = [];
    cache.auditIntegrity = { intact: true };
    cache.trend = { opened: [18, 22, 19, 27, 24, 31, 28, 35, 30, 38, 34, 41],
                    closed: [12, 15, 14, 18, 17, 21, 19, 24, 22, 26, 25, 29] };

    cache.permissions = {};
    Object.keys(PERMISSION_MATRIX).forEach(function (k) {
      cache.permissions[k] = PERMISSION_MATRIX[k].indexOf(cache.user.role) > -1;
    });

    demoSeq = 0;
    demoLastHash = '0000000000000000';
    [['System', 'SYSTEM_INIT', 'database', 'Standalone data loaded'],
     ['Const. Lerato Mahlangu', 'CASE_CREATE', 'CAS 421/07/2026', 'Shoplifting complaint registered'],
     ['Capt. Bongiwe Zulu', 'CASE_ASSIGN', 'CAS 419/07/2026', 'Assigned to Det. Dlamini'],
     ['Det. Sgt Shalom Adeyemi', 'EVIDENCE_ADD', 'EX-2026-0442', 'Till roll booked in'],
     ['Det. Sgt Shalom Adeyemi', 'STATUS_CHANGE', 'CAS 385/07/2026', 'Under investigation → Pending approval'],
     ['System', 'CHAIN_VERIFY', 'audit', 'Nightly verification passed']
    ].forEach(function (r) { demoAudit(r[0], r[1], r[2], r[3]); });
  }

  /* ======================================================================
     Bootstrap
     ====================================================================== */
  function applyBootstrap(payload) {
    remote = true;
    cache.user = payload.user;
    cache.cases = payload.cases || [];
    cache.evidence = payload.evidence || [];
    cache.suspects = payload.suspects || [];
    cache.statements = payload.statements || [];
    cache.stations = payload.stations || [];
    cache.staff = payload.staff || [];
    cache.stationAdmins = payload.stationAdmins || [];
    cache.notifications = payload.notifications || [];
    cache.insights = payload.insights || [];
    cache.audit = payload.audit || [];
    cache.auditIntegrity = payload.auditIntegrity || { intact: true };
    cache.stats = payload.stats || null;
    cache.trend = payload.trend || null;
    cache.permissions = payload.permissions || {};
    cache.caseDetails = {};
  }

  /**
   * Called once at start-up. Uses the API when the page is served and a
   * session exists; otherwise falls back to standalone data, so the
   * interface is never a dead end.
   */
  function init(fallbackRole) {
    if (!window.SD_API) {
      loadDemo(fallbackRole);
      return Promise.resolve({ mode: 'standalone' });
    }

    // Ask whether a real SDICMS backend is answering, rather than assuming
    // one is there because the page arrived over http. A static file server
    // will serve these pages perfectly well and then refuse every API call.
    return SD_API.probe().then(function (backendPresent) {
      if (!backendPresent) {
        loadDemo(fallbackRole);
        return { mode: 'standalone' };
      }

      if (!SD_API.hasSession()) {
        return { mode: 'needsLogin' };
      }

      return SD_API.bootstrap()
        .then(applyBootstrap)
        .then(function () { return { mode: 'api' }; })
        .catch(function () {
          loadDemo(fallbackRole);
          return { mode: 'standalone', reason: 'The server is running but did not return your data.' };
        });
    });
  }

  /** Re-read everything after a write, so derived figures stay honest. */
  function refresh() {
    if (!remote) return Promise.resolve();
    return SD_API.bootstrap().then(applyBootstrap);
  }

  /* ======================================================================
     Derived helpers
     ====================================================================== */
  function isOverdue(c) {
    if (typeof c.overdue === 'boolean') return c.overdue;
    return c.opened > 30 && c.status !== 'Closed' && c.status !== 'Referred to NPA';
  }

  function getCase(no) {
    if (cache.caseDetails[no]) return cache.caseDetails[no];
    for (var i = 0; i < cache.cases.length; i++) {
      if (cache.cases[i].no === no) return cache.cases[i];
    }
    return null;
  }

  function getEvidence(id) {
    for (var i = 0; i < cache.evidence.length; i++) {
      if (cache.evidence[i].id === id) return cache.evidence[i];
    }
    return null;
  }

  function evidenceFor(no)   { return cache.evidence.filter(function (e) { return e.caseNo === no; }); }
  function suspectsFor(no)   { return cache.suspects.filter(function (s) { return s.caseNo === no; }); }
  function statementsFor(no) { return cache.statements.filter(function (s) { return s.caseNo === no; }); }
  function documentsFor(no)  { return cache.documents.filter(function (d) { return d.caseNo === no; }); }

  function healthOf(no) {
    var c = getCase(no);
    if (!c) return 0;
    if (remote && typeof c.health === 'number') return c.health;
    if (c.status === 'Closed' || c.status === 'Referred to NPA') return 100;

    var ev = evidenceFor(no).length;
    var st = statementsFor(no).length;
    var sp = suspectsFor(no).length;
    var score = 0;
    score += Math.min(ev, 6) / 6 * 35;
    score += Math.min(st, 3) / 3 * 25;
    score += Math.min(sp, 2) / 2 * 20;
    score += c.description ? 10 : 0;
    score += c.lastActivity < 4320 ? 10 : 0;
    return Math.round(score);
  }

  function allowedTransitions(c) {
    var role = cache.user.role;
    return (TRANSITIONS[c.status] || []).filter(function (t) {
      return t.roles.indexOf(role) > -1;
    });
  }

  function actorName() { return cache.user.rank + ' ' + cache.user.name; }

  /** Full docket, fetched on demand in API mode. */
  function loadCase(no) {
    if (!remote) return Promise.resolve(getCase(no));
    return SD_API.getCase(no).then(function (detail) {
      cache.caseDetails[no] = detail;
      return detail;
    });
  }

  /** Demo data for the Super Administrator's oversight screen when offline. */
  var DEMO_STATION_ADMINS = [
    { id: 5, name: 'Kagiso Ramaphosa', rank: 'Warrant Officer', badge: 'SA-4201', email: 's.admin.sandton@sdicms.gov.za', station: 'Sandton', stationCode: 'GP-SND-021', status: 'active', lastLogin: new Date(Date.now() - 3600000), staffManaged: 14, openCases: 9 },
    { id: 6, name: 'Precious Nkosi', rank: 'Warrant Officer', badge: 'SA-4202', email: 's.admin.orlando@sdicms.gov.za', station: 'Orlando', stationCode: 'GP-ORL-033', status: 'active', lastLogin: new Date(Date.now() - 7200000), staffManaged: 11, openCases: 7 },
    { id: 7, name: 'Willem Botha', rank: 'Captain', badge: 'SA-4203', email: 's.admin.ctc@sdicms.gov.za', station: 'Cape Town Central', stationCode: 'WC-CTC-002', status: 'active', lastLogin: new Date(Date.now() - 86400000), staffManaged: 18, openCases: 12 },
    { id: 8, name: 'Nomvula Dube', rank: 'Warrant Officer', badge: 'SA-4204', email: 's.admin.mitchells@sdicms.gov.za', station: 'Mitchells Plain', stationCode: 'WC-MPN-018', status: 'flagged', lastLogin: new Date(Date.now() - 604800000), staffManaged: 9, openCases: 15 },
    { id: 9, name: 'Sibongile Zungu', rank: 'Captain', badge: 'SA-4205', email: 's.admin.durban@sdicms.gov.za', station: 'Durban Central', stationCode: 'KZN-DBC-007', status: 'active', lastLogin: new Date(Date.now() - 5400000), staffManaged: 16, openCases: 10 }
  ];

  function loadStationAdmins() {
    if (!remote) return Promise.resolve(DEMO_STATION_ADMINS.slice());
    return SD_API.listStationAdmins();
  }

  /* ======================================================================
     Mutations — always return a Promise
     ====================================================================== */

  function createCase(form) {
    if (remote) {
      return SD_API.createCase({
        title: form.title,
        category: form.category,
        priority: form.priority,
        description: form.description,
        location: form.location,
        complainantName: form.complainant,
        complainantIdNumber: form.complainantId,
        complainantPhone: form.phone,
        complainantAddress: form.location
      }).then(function (created) {
        return refresh().then(function () { return created; });
      });
    }

    var max = 400;
    cache.cases.forEach(function (c) {
      var n = parseInt(c.no.replace('CAS ', ''), 10);
      if (n > max) max = n;
    });
    var d = new Date();
    var c = demoCase({
      no: 'CAS ' + (max + 1) + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(),
      title: form.title, category: form.category, priority: form.priority, status: 'Reported',
      opened: 0, health: 40, lastActivity: 0, description: form.description, location: form.location,
      complainant: { name: form.complainant || 'Not recorded', id: form.complainantId || '—',
                     phone: form.phone || '—', address: form.location || '—' },
      timeline: [{ t: 'Complaint registered', by: actorName(), at: new Date(), body: form.description, state: 'now' }]
    });
    cache.cases.unshift(c);
    demoAudit(actorName(), 'CASE_CREATE', c.no, form.title);
    return Promise.resolve(c);
  }

  function changeStatus(no, to, reason) {
    if (remote) {
      return SD_API.changeCaseStatus(no, to, reason)
        .then(function () { delete cache.caseDetails[no]; return refresh(); })
        .then(function () { return getCase(no); });
    }
    var c = getCase(no);
    if (!c) return Promise.reject(new Error('Docket not found'));
    var from = c.status;
    c.status = to;
    c.lastActivity = 0;
    c.timeline.push({ t: from + ' → ' + to, by: actorName(), at: new Date(), body: reason || '', state: 'now' });
    demoAudit(actorName(), 'STATUS_CHANGE', no, from + ' → ' + to);
    return Promise.resolve(c);
  }

  function assignDetective(no, detective) {
    if (remote) {
      return SD_API.assignCase(no, detective)
        .then(function () { delete cache.caseDetails[no]; return refresh(); })
        .then(function () { return getCase(no); });
    }
    var c = getCase(no);
    c.detective = detective;
    if (c.status === 'Reported') c.status = 'Assigned';
    c.lastActivity = 0;
    c.timeline.push({ t: 'Docket assigned to ' + detective, by: actorName(), at: new Date(), state: 'now' });
    demoAudit(actorName(), 'CASE_ASSIGN', no, 'Assigned to ' + detective);
    return Promise.resolve(c);
  }

  function addNote(no, text) {
    if (remote) {
      return SD_API.addNote(no, text).then(function (note) {
        delete cache.caseDetails[no];
        return refresh().then(function () { return note; });
      });
    }
    var c = getCase(no);
    c.notes = c.notes || [];
    c.notes.unshift({ by: actorName(), at: new Date(), text: text });
    c.lastActivity = 0;
    c.timeline.push({ t: 'Case note added', by: actorName(), at: new Date(), body: text, state: 'now' });
    demoAudit(actorName(), 'NOTE_ADD', no, text.slice(0, 60));
    return Promise.resolve(c);
  }

  function addEvidence(form) {
    if (remote) {
      var fd = new FormData();
      fd.append('caseNumber', form.caseNo);
      fd.append('label', form.label);
      fd.append('evidenceType', form.type);
      fd.append('storageLocation', form.storage);
      if (form.source) fd.append('collectedFrom', form.source);
      if (form.fileHandle) fd.append('file', form.fileHandle);

      return SD_API.createEvidence(fd).then(function (exhibit) {
        return refresh().then(function () { return exhibit; });
      });
    }

    var max = 0;
    cache.evidence.forEach(function (e) {
      var n = parseInt(e.id.split('-')[2], 10);
      if (n > max) max = n;
    });
    var id = 'EX-2026-' + String(max + 1).padStart(4, '0');
    var stamp = new Date().toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

    var ex = {
      id: id, caseNo: form.caseNo, label: form.label, type: form.type,
      collectedBy: actorName(), collectedAt: new Date().toISOString(),
      location: form.storage, status: 'Pending verification',
      size: form.size || '—', hasFile: false,
      chain: demoChain([
        [form.source || 'Scene', actorName(), 'Collected', stamp],
        [actorName(), form.storage, 'Booked in', stamp]
      ])
    };
    cache.evidence.unshift(ex);
    demoAudit(actorName(), 'EVIDENCE_ADD', id, form.label + ' → ' + form.caseNo);
    return Promise.resolve(ex);
  }

  function verifyEvidence(id) {
    if (remote) {
      return SD_API.verifyEvidence(id).then(function (ex) {
        return refresh().then(function () { return ex; });
      });
    }
    var e = getEvidence(id);
    e.status = 'Verified';
    demoAudit(actorName(), 'EVIDENCE_VERIFY', id, 'Verified and sealed');
    return Promise.resolve(e);
  }

  function transferCustody(id, to, action) {
    if (remote) {
      return SD_API.transferCustody(id, to, action).then(function (ex) {
        return refresh().then(function () { return ex; });
      });
    }
    var e = getEvidence(id);
    var last = e.chain[e.chain.length - 1];
    var stamp = new Date().toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    var hash = demoDigest(last.hash + to + stamp + e.chain.length);
    e.chain.push({ seq: e.chain.length + 1, from: last.to, to: to, action: action,
                   at: stamp, prevHash: last.hash, hash: hash, ok: true });
    e.location = to;
    demoAudit(actorName(), 'CUSTODY_TRANSFER', id, last.to + ' → ' + to + ' · ' + action);
    return Promise.resolve(e);
  }

  function addSuspect(form) {
    if (remote) {
      return SD_API.createSuspect({
        caseNumber: form.caseNo,
        fullName: form.name,
        apparentAge: form.age,
        status: form.status,
        notes: form.note
      }).then(function (s) { return refresh().then(function () { return s; }); });
    }
    var id = 'SP-' + (1045 + cache.suspects.length + 1);
    var s = { id: id, name: form.name, caseNo: form.caseNo, age: form.age || '—',
              status: form.status || 'Sought',
              identified: !/^unknown/i.test(form.name), note: form.note || '' };
    cache.suspects.unshift(s);
    demoAudit(actorName(), 'SUSPECT_ADD', id, form.name + ' → ' + form.caseNo);
    return Promise.resolve(s);
  }

  function addStatement(form) {
    if (remote) {
      return SD_API.createStatement({
        caseNumber: form.caseNo,
        deponentName: form.deponent,
        deponentType: form.kind,
        body: form.body
      }).then(function (s) { return refresh().then(function () { return s; }); });
    }
    var id = 'ST-' + (2205 + cache.statements.length + 1);
    var s = { id: id, caseNo: form.caseNo, deponent: form.deponent, kind: form.kind,
              takenBy: actorName(), at: new Date().toDateString(), status: 'Draft', body: form.body || '' };
    cache.statements.unshift(s);
    demoAudit(actorName(), 'STATEMENT_ADD', id, form.deponent + ' → ' + form.caseNo);
    return Promise.resolve(s);
  }

  function uploadDocument(form) {
    if (remote) {
      var fd = new FormData();
      fd.append('caseNumber', form.caseNo);
      fd.append('title', form.title);
      fd.append('docType', form.docType);
      if (form.fileHandle) fd.append('file', form.fileHandle);

      return SD_API.uploadDocument(fd).then(function (doc) {
        cache.documents.unshift(doc);
        return doc;
      });
    }
    var doc = { id: cache.documents.length + 1, caseNo: form.caseNo, title: form.title,
                docType: form.docType, filename: form.file || 'document.pdf',
                size: form.size || '—', sha256: demoDigest(form.title + Date.now()),
                uploadedBy: actorName(), at: new Date() };
    cache.documents.unshift(doc);
    demoAudit(actorName(), 'DOCUMENT_ADD', String(doc.id), form.title + ' → ' + form.caseNo);
    return Promise.resolve(doc);
  }

  function createUser(form) {
    if (remote) {
      return SD_API.createUser({
        fullName: form.name,
        badgeNumber: form.badge,
        rankTitle: form.rank,
        email: form.email,
        role: form.role,
        // A Station Administrator's form has no station picker at all —
        // the server forces it to their own station regardless of what,
        // if anything, is sent here.
        stationId: form.stationId ? Number(form.stationId) : undefined
      }).then(function (result) {
        return refresh().then(function () { return result; });
      });
    }
    var user = { id: cache.staff.length + 20, name: form.name, rank: form.rank || 'Constable',
                 role: form.role, badge: form.badge, active: 0, capacity: 18,
                 closed: 0, overdue: 0, status: 'Active' };
    cache.staff.unshift(user);
    demoAudit(actorName(), 'USER_CREATE', form.badge, form.name + ' · ' + form.role);
    return Promise.resolve({
      user: user,
      temporaryPassword: 'Sdicms#2026',
      message: 'Account created in standalone mode. Start the server to issue real credentials.'
    });
  }

  function resetUserPassword(id) {
    if (remote) return SD_API.resetUserPassword(id);
    demoAudit(actorName(), 'PASSWORD_RESET', String(id), 'Administrator reset');
    return Promise.resolve({
      temporaryPassword: 'Sdicms#2026',
      message: 'Standalone mode — no password was actually changed.'
    });
  }

  function changePassword(current, next, confirm) {
    if (remote) return SD_API.changePassword(current, next, confirm);
    return Promise.reject(new Error(
      'Password changes need the server. Start it with npm run dev, then sign in through the API.'
    ));
  }

  function askAssistant(question) {
    if (remote) return SD_API.ask(question).then(function (r) { return r.answer; });

    var replies = [
      'Checked the docket: the exhibits are logged and the custody chain is unbroken, but no complainant statement has been signed. That is the gap most likely to delay this one.',
      'Three dockets in your scope have passed the 30-day standard. The oldest carries only two exhibits.',
      'Comparing this against similar dockets that reached prosecution, the item normally present by this stage and missing here is the CCTV request.',
      'I can draft that, but a detective has to review and sign it before it enters the docket.'
    ];
    return Promise.resolve(replies[Math.floor(Math.random() * replies.length)]);
  }

  function resolveInsight(id, disposition) {
    if (remote && id) return SD_API.resolveInsight(id, disposition).catch(function () {});
    demoAudit(actorName(), 'AI_SUGGESTION', String(id || 'insight'), 'Suggestion ' + disposition);
    return Promise.resolve();
  }

  function writeAudit(actor, action, target, detail) {
    if (remote) return;                  // the server writes its own trail
    demoAudit(actor, action, target, detail);
  }

  /* ======================================================================
     Public interface
     ====================================================================== */
  return {
    init: init,
    refresh: refresh,
    isRemote: function () { return remote; },

    /* session */
    users: DEMO_USERS,
    setRole: function (role) { if (!remote) loadDemo(role); return cache.user; },
    user: function () { return cache.user; },
    can: function (what) {
      if (remote && cache.permissions && (what in cache.permissions)) return !!cache.permissions[what];
      return (PERMISSION_MATRIX[what] || []).indexOf(cache.user.role) > -1;
    },

    /* reads */
    cases: function () { return cache.cases.slice(); },
    myCases: function () {
      var u = cache.user;
      if (remote) return cache.cases.slice();      // the server already scoped these
      if (u.role === 'detective') {
        return cache.cases.filter(function (c) { return c.detective === u.name; });
      }
      if (u.role === 'officer') return cache.cases.filter(function (c) { return c.opened <= 3; });
      return cache.cases.slice();
    },
    getCase: getCase,
    loadCase: loadCase,
    loadStationAdmins: loadStationAdmins,
    evidence: function () { return cache.evidence.slice(); },
    getEvidence: getEvidence,
    evidenceFor: evidenceFor,
    documents: function () { return cache.documents.slice(); },
    documentsFor: documentsFor,
    suspects: function () { return cache.suspects.slice(); },
    suspectsFor: suspectsFor,
    statements: function () { return cache.statements.slice(); },
    statementsFor: statementsFor,
    staff: function () { return cache.staff.slice(); },
    stationAdmins: function () { return cache.stationAdmins.slice(); },
    detectives: function () {
      return cache.staff.filter(function (s) { return s.role === 'detective'; });
    },
    stations: function () { return cache.stations.slice(); },
    audit: function () { return cache.audit.slice(); },
    auditIntegrity: function () { return cache.auditIntegrity; },
    notifications: function () { return cache.notifications.slice(); },
    insights: function () { return cache.insights.slice(); },
    stats: function () { return cache.stats; },
    isOverdue: isOverdue,
    healthOf: healthOf,
    allowedTransitions: allowedTransitions,
    caseTrend: function () { return (cache.trend && cache.trend.opened) || []; },
    closureTrend: function () { return (cache.trend && cache.trend.closed) || []; },

    /* writes */
    createCase: createCase,
    changeStatus: changeStatus,
    assignDetective: assignDetective,
    addNote: addNote,
    addEvidence: addEvidence,
    verifyEvidence: verifyEvidence,
    transferCustody: transferCustody,
    addSuspect: addSuspect,
    addStatement: addStatement,
    uploadDocument: uploadDocument,
    createUser: createUser,
    resetUserPassword: resetUserPassword,
    changePassword: changePassword,
    askAssistant: askAssistant,
    resolveInsight: resolveInsight,
    writeAudit: writeAudit
  };
})();
