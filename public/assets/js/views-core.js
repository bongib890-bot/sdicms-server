/* ==========================================================================
   SDICMS — Core views
   Dashboard, case list and case detail. Each view renders into a mount
   element and wires its own interactions. Views read and write only through
   SD_STORE.
   ========================================================================== */

window.SD_VIEWS = window.SD_VIEWS || {};

(function (V, S) {
  'use strict';

  /* ======================================================================
     Shared fragments
     ====================================================================== */

  /** The AI copilot panel. Present on every dashboard, scoped to the role. */
  function aiPanel(span) {
    var insights = S.insights();
    var body = insights.map(function (ins, i) {
      return '<div class="insight" data-ins="' + i + '">' +
        '<div class="insight__top">' +
          '<span class="insight__kind">' + SD.esc(ins.kind) + '</span>' +
          '<span class="insight__conf">' + Math.round(ins.confidence * 100) + '% confidence</span>' +
        '</div>' +
        (ins.ref ? '<div class="table__sub mono" style="margin-bottom:6px">' + SD.esc(ins.ref) + '</div>' : '') +
        '<p class="insight__text">' + SD.esc(ins.text) + '</p>' +
        '<div class="insight__act">' +
          '<button class="btn btn--ghost btn--sm" data-ai-act="' + SD.esc(ins.actions[0]) +
            '" data-ai-ref="' + SD.esc(ins.ref || '') + '" data-ai-kind="' + SD.esc(ins.kind) +
            '" data-ai-id="' + SD.esc(ins.id || '') + '">' +
            SD.esc(ins.actions[0]) + '</button>' +
          '<button class="btn btn--quiet btn--sm" data-ai-dismiss="1" ' +
            'data-ai-id="' + SD.esc(ins.id || '') + '">Dismiss</button>' +
        '</div>' +
      '</div>';
    }).join('');

    return '<article class="card ai ' + span + '">' +
      '<div class="ai__head">' +
        '<div class="ai__mark">' + SD.icon('ai', 18) + '</div>' +
        '<div style="flex:1">' +
          '<div class="ai__title">Investigation copilot</div>' +
          '<div class="ai__status"><i></i>Reading your dockets</div>' +
        '</div>' +
      '</div>' +
      '<div id="aiBody">' + body + '</div>' +
      '<div class="ai__ask">' +
        '<input type="text" id="aiInput" placeholder="Ask about a docket…">' +
        '<button class="btn btn--primary btn--sm" id="aiSend">' + SD.icon('arrowRight', 15) + '</button>' +
      '</div>' +
      '<div class="ai__note">' + SD.icon('alert', 14) +
        '<span>Copilot output is advisory. Nothing reaches a docket until an authorised ' +
        'officer accepts it, and every suggestion accepted or dismissed is written to the audit log.</span>' +
      '</div>' +
    '</article>';
  }

  /** Compact case table used on dashboards. */
  function caseTable(list, title, span, linkAll) {
    var rows = list.slice(0, 6).map(function (c) {
      return '<tr data-case="' + SD.esc(c.no) + '">' +
        '<td><div class="table__primary">' + SD.esc(c.title) + '</div>' +
            '<div class="table__sub mono">' + SD.esc(c.no) + ' · ' + SD.esc(c.category) + '</div></td>' +
        '<td>' + SD.priorityBadge(c.priority) + '</td>' +
        '<td>' + SD.statusBadge(S.isOverdue(c) ? 'Overdue' : c.status) + '</td>' +
        '<td><div class="table__sub">' + (c.detective ? SD.esc(c.detective) : '<span class="muted-dim">Unassigned</span>') + '</div></td>' +
        '<td><div class="table__sub mono">' + c.opened + ' d</div></td>' +
      '</tr>';
    }).join('');

    return '<article class="card ' + span + '">' +
      '<div class="card__head"><h2 class="card__title">' + SD.icon('folder', 17) + SD.esc(title) + '</h2>' +
        '<button class="card__link" data-go="' + (linkAll || 'cases') + '">View all</button></div>' +
      '<div class="table-wrap"><table class="table">' +
        '<thead><tr><th>Docket</th><th>Priority</th><th>Status</th><th>Investigating officer</th><th>Age</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>' +
    '</article>';
  }

  function notificationCard(span) {
    var body = S.notifications().map(function (n) {
      return '<div class="note-item note-item--' + n.kind + '">' +
        '<span class="note-item__icon">' + SD.icon(n.icon, 15) + '</span>' +
        '<div><div class="note-item__text">' + SD.esc(n.text) + '</div>' +
        '<div class="note-item__time">' + SD.ago(n.mins) + '</div></div></div>';
    }).join('');

    return '<article class="card ' + span + '">' +
      '<div class="card__head"><h2 class="card__title">' + SD.icon('bell', 17) + 'Alerts</h2></div>' +
      '<div class="scroll-240">' + body + '</div></article>';
  }

  function activityCard(span) {
    var body = S.audit().slice(0, 8).map(function (a) {
      return '<div class="feed-item">' +
        '<span class="avatar avatar--sm">' + SD.initials(a.actor) + '</span>' +
        '<div><div class="feed-item__text"><b>' + SD.esc(a.actor) + '</b> — ' +
          SD.esc(a.detail || a.action) + '</div>' +
        '<div class="feed-item__time mono">' + SD.esc(a.target) + ' · ' + SD.clock(a.at) + '</div></div></div>';
    }).join('');

    return '<article class="card ' + span + '">' +
      '<div class="card__head"><h2 class="card__title">' + SD.icon('activity', 17) + 'Recent activity</h2>' +
      (S.can('viewAudit') ? '<button class="card__link" data-go="audit">Full audit log</button>' : '') +
      '</div><div class="scroll-320">' + body + '</div></article>';
  }

  /** Chain-of-custody integrity summary — the signature component. */
  function chainCard(span) {
    var ev = S.evidence();
    var links = ev.slice(0, 12).map(function (e) {
      var bad = e.chain.some(function (c) { return !c.ok; });
      return bad ? 'broken' : (e.status === 'Pending verification' ? 'pending' : 'ok');
    });
    while (links.length < 10) links.push('pending');
    var broken = links.indexOf('broken') > -1;

    return '<article class="card ' + span + '">' +
      '<div class="card__head"><h2 class="card__title">' + SD.icon('evidence', 17) +
        'Chain of custody integrity</h2>' +
        (broken ? '<span class="badge badge--danger">1 break</span>'
                : '<span class="badge badge--success">Verified</span>') + '</div>' +
      '<p class="muted" style="font-size:13px;margin-bottom:16px">' +
        (broken
          ? 'Exhibit EX-2026-0448 has a custody entry that does not hash to the one before it. The exhibit moved without a recorded handler.'
          : 'Every custody transfer hashes to the entry before it. No gaps, no rewrites.') + '</p>' +
      SD.chainStrip(links) +
      '<div class="chain-legend">' +
        '<span><i style="background:rgba(34,197,94,.45)"></i>Verified</span>' +
        (broken ? '<span><i style="background:rgba(239,68,68,.5)"></i>Hash mismatch</span>' : '') +
        '<span><i style="background:rgba(148,163,184,.28)"></i>Awaiting sign-off</span>' +
      '</div>' +
      '<button class="btn btn--ghost btn--sm" style="margin-top:16px" data-go="evidence">' +
        'Open evidence register</button>' +
    '</article>';
  }

  function quickCard(span) {
    var QUICK = {
      admin: [
        { icon: 'users', label: 'Add user', hint: 'Issue credentials', act: 'addUser' },
        { icon: 'shield', label: 'Security alerts', hint: '4 outstanding', act: 'go:audit' },
        { icon: 'building', label: 'Stations', hint: '8 registered', act: 'go:stations' },
        { icon: 'file', label: 'Export audit', hint: 'Signed CSV', act: 'export' }
      ],
      commander: [
        { icon: 'check', label: 'Approvals queue', hint: 'Awaiting you', act: 'go:cases' },
        { icon: 'users', label: 'Assign docket', hint: 'Unassigned dockets', act: 'go:cases' },
        { icon: 'chart', label: 'Station report', hint: 'Monthly summary', act: 'go:reports' },
        { icon: 'alert', label: 'Over SLA', hint: 'Needs escalation', act: 'go:cases' }
      ],
      detective: [
        { icon: 'plus', label: 'New docket', hint: 'Open a case', act: 'newCase' },
        { icon: 'evidence', label: 'Log exhibit', hint: 'Seal and hash', act: 'addEvidence' },
        { icon: 'fingerprint', label: 'Add suspect', hint: 'Link to a docket', act: 'addSuspect' },
        { icon: 'file', label: 'Record statement', hint: 'Witness or suspect', act: 'addStatement' }
      ],
      officer: [
        { icon: 'plus', label: 'Capture incident', hint: 'Start a complaint', act: 'newCase' },
        { icon: 'camera', label: 'Upload evidence', hint: 'Photos and video', act: 'addEvidence' },
        { icon: 'file', label: 'Write statement', hint: 'Complainant', act: 'addStatement' },
        { icon: 'folder', label: 'My complaints', hint: 'Captured by me', act: 'go:cases' }
      ],
      station_admin: [
        { icon: 'users', label: 'Add user', hint: 'Officer or detective', act: 'addUser' },
        { icon: 'shield', label: 'Station audit log', hint: 'Review activity', act: 'go:audit' },
        { icon: 'evidence', label: 'Evidence integrity', hint: 'Check custody chains', act: 'go:evidence' },
        { icon: 'file', label: 'Station report', hint: 'Monthly summary', act: 'go:reports' }
      ]
    };

    return '<article class="card ' + span + '">' +
      '<div class="card__head"><h2 class="card__title">' + SD.icon('grid', 17) + 'Quick actions</h2></div>' +
      '<div class="actions">' + QUICK[S.user().role].map(function (q) {
        return '<button class="action" data-act="' + q.act + '">' + SD.icon(q.icon, 18) +
          '<span class="action__label">' + q.label + '</span>' +
          '<span class="action__hint">' + q.hint + '</span></button>';
      }).join('') + '</div></article>';
  }

  /* ======================================================================
     Dashboard
     ====================================================================== */

  function statCard(s) {
    var arrow = s.dir === 'up' ? 'arrowUp' : s.dir === 'down' ? 'arrowDown' : 'arrowRight';
    return '<article class="card card--hover stat col-3' + (s.tone ? ' stat--' + s.tone : '') + '">' +
      '<div class="stat__top"><span class="stat__label">' + s.label + '</span>' +
      '<span class="stat__icon">' + SD.icon(s.icon, 17) + '</span></div>' +
      '<div class="stat__value" data-count="' + s.value + '"' +
        (s.suffix ? ' data-suffix="' + s.suffix + '"' : '') +
        (s.decimals ? ' data-decimals="' + s.decimals + '"' : '') + '>0</div>' +
      '<div class="stat__foot"><span class="trend trend--' + s.dir + '">' +
      SD.icon(arrow, 12) + s.trend + '</span><span>· ' + s.note + '</span></div></article>';
  }

  /** Figures are computed from the store, so they move when you add things. */
  function statsFor(role) {
    var all = S.cases();
    var mine = S.myCases();
    var open = all.filter(function (c) { return c.status !== 'Closed' && c.status !== 'Referred to NPA'; });
    var overdue = all.filter(S.isOverdue);
    var pending = all.filter(function (c) { return c.status === 'Pending approval'; });
    var closed = all.filter(function (c) { return c.status === 'Closed' || c.status === 'Referred to NPA'; });
    var unverified = S.evidence().filter(function (e) { return e.status !== 'Verified'; });

    if (role === 'detective') {
      return [
        { label: 'Active investigations', value: mine.filter(function (c) { return c.status !== 'Closed' && c.status !== 'Referred to NPA'; }).length, icon: 'folder', trend: 'capacity 18', dir: 'flat', note: 'assigned to you', tone: '' },
        { label: 'High priority', value: mine.filter(function (c) { return c.priority === 'Critical' || c.priority === 'High'; }).length, icon: 'alert', trend: 'action today', dir: 'flat', note: 'critical and high', tone: 'alert' },
        { label: 'Exhibits unverified', value: unverified.length, icon: 'evidence', trend: 'awaiting', dir: 'flat', note: 'sign-off needed', tone: 'warn' },
        { label: 'Closed this month', value: closed.length, icon: 'check', trend: '+1', dir: 'up', note: 'station avg 4.8', tone: 'good' }
      ];
    }
    if (role === 'commander') {
      return [
        { label: 'Open dockets', value: open.length, icon: 'folder', trend: '+18', dir: 'up', note: 'station total', tone: '' },
        { label: 'Awaiting approval', value: pending.length, icon: 'clock', trend: 'from detectives', dir: 'flat', note: 'needs your sign-off', tone: 'warn' },
        { label: 'Past 30-day SLA', value: overdue.length, icon: 'alert', trend: 'escalate', dir: 'down', note: 'breached', tone: 'alert' },
        { label: 'Clearance rate', value: Math.round(closed.length / all.length * 100), icon: 'chart', suffix: '%', trend: '+4%', dir: 'up', note: 'vs last month', tone: 'good' }
      ];
    }
    if (role === 'admin') {
      return [
        { label: 'Active users', value: S.staff().length, icon: 'users', trend: '+2', dir: 'up', note: 'across 8 stations', tone: '' },
        { label: 'System uptime', value: 99.9, icon: 'activity', suffix: '%', decimals: 1, trend: '30 d', dir: 'flat', note: 'no incidents', tone: 'good' },
        { label: 'Security alerts', value: 4, icon: 'shield', trend: '+3', dir: 'down', note: 'since 06:00', tone: 'alert' },
        { label: 'Audit entries', value: S.audit().length, icon: 'file', trend: 'chained', dir: 'up', note: 'this session', tone: 'good' }
      ];
    }
    if (role === 'station_admin') {
      var myStaff = S.staff().filter(function (s) { return s.role === 'officer' || s.role === 'detective'; });
      return [
        { label: 'My station\u2019s staff', value: myStaff.length, icon: 'users', trend: 'managed', dir: 'flat', note: 'officers and detectives', tone: '' },
        { label: 'Open dockets', value: open.length, icon: 'folder', trend: 'station total', dir: 'flat', note: 'at this station', tone: '' },
        { label: 'Evidence unverified', value: unverified.length, icon: 'evidence', trend: 'awaiting', dir: 'flat', note: 'sign-off needed', tone: 'warn' },
        { label: 'Audit entries', value: S.audit().length, icon: 'file', trend: 'chained', dir: 'up', note: 'this station', tone: 'good' }
      ];
    }
    return [
      { label: 'Complaints captured', value: mine.length, icon: 'plus', trend: '+4', dir: 'up', note: 'last 7 days', tone: '' },
      { label: 'Evidence uploaded', value: S.evidence().length, icon: 'camera', trend: '+9', dir: 'up', note: 'on the register', tone: 'good' },
      { label: 'Statements drafted', value: S.statements().filter(function (s) { return s.status === 'Draft'; }).length, icon: 'file', trend: 'unsigned', dir: 'down', note: 'need signature', tone: 'warn' },
      { label: 'Assigned tasks', value: 5, icon: 'clock', trend: '1 due today', dir: 'flat', note: 'from Det. Adeyemi', tone: '' }
    ];
  }

  function workloadCard(span) {
    var rows = S.detectives().map(function (d) {
      var pct = Math.min(Math.round((d.active / d.capacity) * 100), 130);
      var tone = pct > 100 ? 'danger' : pct > 85 ? 'warning' : 'success';
      return '<div class="load-row"><div>' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<span class="avatar avatar--sm">' + SD.initials(d.name) + '</span>' +
          '<span style="font-size:13px;color:var(--text);font-weight:600">' + SD.esc(d.name) + '</span>' +
          (d.overdue ? '<span class="badge badge--danger">' + d.overdue + ' over SLA</span>' : '') +
        '</div>' +
        '<div class="progress load-row__bar"><div class="progress__fill progress__fill--' + tone +
        '" data-value="' + Math.min(pct, 100) + '"></div></div></div>' +
        '<div class="load-row__num">' + d.active + '/' + d.capacity + '</div></div>';
    }).join('');

    return '<article class="card ' + span + '">' +
      '<div class="card__head"><h2 class="card__title">' + SD.icon('users', 17) +
      'Detective workload</h2><button class="card__link" data-go="officers">Manage</button></div>' +
      rows + '</article>';
  }

  function statusCard(span) {
    var all = S.cases();
    var slices = [
      { label: 'Under investigation', color: '#38BDF8', value: all.filter(function (c) { return ['Under investigation', 'Assigned', 'Reported'].indexOf(c.status) > -1; }).length },
      { label: 'Awaiting forensics', color: '#F59E0B', value: all.filter(function (c) { return c.status === 'Awaiting forensics'; }).length },
      { label: 'Pending approval', color: '#7C3AED', value: all.filter(function (c) { return c.status === 'Pending approval'; }).length },
      { label: 'Closed / referred', color: '#22C55E', value: all.filter(function (c) { return c.status === 'Closed' || c.status === 'Referred to NPA'; }).length }
    ];

    return '<article class="card ' + span + '">' +
      '<div class="card__head"><h2 class="card__title">' + SD.icon('chart', 17) + 'Docket status board</h2></div>' +
      '<div class="donut-wrap">' + SD.donut(slices) + '<div class="donut-key">' +
      slices.map(function (s) {
        return '<div class="donut-key__row"><i style="background:' + s.color + '"></i>' +
               '<span>' + s.label + '</span><b>' + s.value + '</b></div>';
      }).join('') + '</div></div></article>';
  }

  function trendCard(span) {
    return '<article class="card ' + span + '">' +
      '<div class="card__head"><h2 class="card__title">' + SD.icon('activity', 17) +
      'Docket volume — 12 weeks</h2><span class="badge badge--info">+18% reported</span></div>' +
      SD.barChart([
        { label: 'Reported', color: '#4F46E5', values: S.caseTrend() },
        { label: 'Closed', color: '#22C55E', values: S.closureTrend() }
      ], S.caseTrend()) +
      '<div class="chart-x"><span>W1</span><span>W4</span><span>W8</span><span>W12</span></div>' +
      '<div class="chart-legend"><span><i style="background:#4F46E5"></i>Opened</span>' +
      '<span><i style="background:#22C55E"></i>Closed</span></div></article>';
  }

  function systemCard(span) {
    var rows = [
      ['API response time (p95)', '184 ms'],
      ['Database connections', '12 / 40'],
      ['Evidence vault usage', '412 GB / 2 TB'],
      ['Last backup', 'Today 02:00'],
      ['Audit chain last verified', 'Today 02:14'],
      ['Failed logins (24 h)', '9']
    ].map(function (r) {
      return '<div class="sys-row"><span class="muted">' + r[0] + '</span>' +
             '<span class="sys-row__v">' + r[1] + '</span></div>';
    }).join('');

    return '<article class="card ' + span + '">' +
      '<div class="card__head"><h2 class="card__title">' + SD.icon('activity', 17) +
      'System health</h2><span class="badge badge--success">Operational</span></div>' + rows + '</article>';
  }

  /**
   * Super Administrator only. Answers "who is watching the watchers":
   * one row per Station Administrator, with enough signal to see at a
   * glance whether that station's administration is healthy.
   */
  function adminOversightCard(span) {
    var admins = S.stationAdmins();

    var rows = admins.map(function (a) {
      var quiet = a.lastLogin && (Date.now() - new Date(a.lastLogin).getTime()) > 7 * 86400000;
      return '<tr data-station-admin="' + SD.esc(a.id) + '">' +
        '<td><div class="who"><span class="avatar avatar--sm">' + SD.initials(a.name) + '</span>' +
        '<div><div class="who__name">' + SD.esc(a.name) + '</div>' +
        '<div class="who__role">' + SD.esc(a.rank) + '</div></div></div></td>' +
        '<td><div class="table__primary">' + SD.esc(a.station) + '</div>' +
        '<div class="table__sub mono">' + SD.esc(a.stationCode) + '</div></td>' +
        '<td class="mono">' + a.staffManaged + '</td>' +
        '<td class="mono">' + a.openCases + '</td>' +
        '<td>' + (a.status === 'active'
          ? (quiet ? '<span class="badge badge--warning">Quiet</span>' : '<span class="badge badge--success">Active</span>')
          : '<span class="badge badge--danger">' + SD.esc(a.status) + '</span>') + '</td>' +
        '<td><div class="table__sub">' + (a.lastLogin ? SD.ago(a.lastLogin) : 'Never signed in') + '</div></td>' +
      '</tr>';
    }).join('');

    return '<article class="card ' + span + '">' +
      '<div class="card__head"><h2 class="card__title">' + SD.icon('shield', 17) +
      'Station Administrators</h2><button class="card__link" data-go="admin-oversight">View all</button></div>' +
      '<p class="muted" style="font-size:13px;margin-bottom:16px">' +
      'Every Station Administrator reports here. A quiet or flagged station is the first place to look.</p>' +
      (admins.length
        ? '<div class="table-wrap"><table class="table"><thead><tr><th>Administrator</th><th>Station</th>' +
          '<th>Staff</th><th>Open dockets</th><th>Status</th><th>Last sign-in</th></tr></thead><tbody>' +
          rows + '</tbody></table></div>'
        : '<div class="empty">' + SD.icon('shield', 26) +
          '<div class="empty__title">No Station Administrators yet</div>' +
          '<p class="empty__body">Add one from Users &amp; permissions to delegate account management to a station.</p></div>') +
    '</article>';
  }

  function stationCard(span) {
    var rows = S.stations().slice(0, 6).map(function (s) {
      var tone = s.clearance >= 70 ? 'success' : s.clearance >= 55 ? 'warning' : 'danger';
      return '<tr><td><div class="table__primary">' + SD.esc(s.name) + '</div>' +
        '<div class="table__sub mono">' + SD.esc(s.code) + '</div></td>' +
        '<td><div class="table__sub">' + s.province + '</div></td>' +
        '<td class="mono">' + s.officers + '</td><td class="mono">' + s.open + '</td>' +
        '<td style="min-width:110px"><div class="progress"><div class="progress__fill progress__fill--' +
        tone + '" data-value="' + s.clearance + '"></div></div>' +
        '<div class="table__sub mono" style="margin-top:4px">' + s.clearance + '%</div></td></tr>';
    }).join('');

    return '<article class="card ' + span + '">' +
      '<div class="card__head"><h2 class="card__title">' + SD.icon('building', 17) +
      'Station overview</h2><button class="card__link" data-go="stations">Manage stations</button></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Station</th><th>Province</th>' +
      '<th>Officers</th><th>Open</th><th>Clearance</th></tr></thead><tbody>' + rows +
      '</tbody></table></div></article>';
  }

  function timelineCard(span) {
    var c = S.getCase('CAS 412/07/2026') || S.myCases()[0];
    if (!c) return '';
    var events = (c.timeline || []).slice(-6);

    return '<article class="card ' + span + '">' +
      '<div class="card__head"><h2 class="card__title">' + SD.icon('activity', 17) +
      'Investigation timeline</h2><span class="mono" style="font-size:12px;color:var(--accent)">' +
      SD.esc(c.no) + '</span></div><div class="timeline">' +
      events.map(function (e) {
        return '<div class="tl-item' + (e.state ? ' tl-item--' + e.state : '') + '">' +
          '<span class="tl-item__dot"></span>' +
          '<div class="tl-item__title">' + SD.esc(e.t) + '</div>' +
          '<div class="tl-item__meta">' + SD.esc(e.by) + ' · ' + SD.ago(e.mins) + '</div>' +
          (e.body ? '<div class="tl-item__body">' + SD.esc(e.body) + '</div>' : '') + '</div>';
      }).join('') + '</div>' +
      '<button class="btn btn--ghost btn--sm" style="margin-top:8px" data-open-case="' + SD.esc(c.no) + '">' +
      'Open docket</button></article>';
  }

  function healthCard(span) {
    var c = S.getCase('CAS 412/07/2026') || S.myCases()[0];
    if (!c) return '';
    var score = S.healthOf(c.no);
    var ev = S.evidenceFor(c.no).length;
    var st = S.statementsFor(c.no).length;
    var sp = S.suspectsFor(c.no).length;

    var items = [
      { ok: st > 0, t: st + ' statement' + (st === 1 ? '' : 's') + ' on file' },
      { ok: ev >= 3, t: ev + ' exhibit' + (ev === 1 ? '' : 's') + ' logged and sealed' },
      { ok: sp > 0, t: sp + ' suspect' + (sp === 1 ? '' : 's') + ' recorded' },
      { ok: false, t: 'No CCTV request logged' },
      { ok: c.lastActivity < 4320, t: 'Activity in the last 3 days' }
    ];

    var colour = score >= 75 ? 'var(--success)' : score >= 45 ? 'var(--warning)' : 'var(--danger)';

    return '<article class="card ' + span + '">' +
      '<div class="card__head"><h2 class="card__title">' + SD.icon('scale', 17) +
      'Docket completeness</h2></div><div class="health">' + SD.ring(score, colour) +
      '<div class="health__list">' + items.map(function (i) {
        return '<div class="health__row health__row--' + (i.ok ? 'ok' : 'miss') + '">' +
          SD.icon(i.ok ? 'check' : 'alert', 15) + '<span>' + SD.esc(i.t) + '</span></div>';
      }).join('') + '</div></div></article>';
  }

  V.dashboard = function (mount) {
    var u = S.user();
    var role = u.role;
    var now = new Date();

    var SUBTITLE = {
      admin: 'National overview across every station. Security, integrity and Station Administrator oversight need your attention.',
      station_admin: 'Your station\u2019s accounts, evidence integrity and audit trail.',
      commander: 'Hillbrow station caseload, approvals and detective workload.',
      detective: 'Your assigned dockets, evidence and outstanding work.',
      officer: 'Complaints you captured this shift and what is still outstanding.'
    };

    var SHIFT = {
      admin: [['On duty', u.rank], ['Scope', 'All stations'], ['Node status', 'Operational'], ['Open alerts', '4 security']],
      station_admin: [['On duty', u.rank], ['Station', u.station], ['Role', 'Station Administrator'], ['Reports to', 'Super Administrator']],
      commander: [['On duty', u.rank], ['Station', 'Hillbrow GP-HLB-014'], ['Detectives on shift', '5 of 7'], ['Awaiting you', S.cases().filter(function (c) { return c.status === 'Pending approval'; }).length + ' approvals']],
      detective: [['On duty', u.rank], ['Station', 'Hillbrow GP-HLB-014'], ['Active dockets', String(S.myCases().length)], ['Court appearance', 'Thu 30 Jul, 09:00']],
      officer: [['On duty', u.rank], ['Sector', 'Sector 2 — Pretoria St'], ['Shift ends', '18:00'], ['Handover report', 'Due in 4 h']]
    };

    var PRIMARY = {
      admin: { icon: 'plus', label: 'Add user', act: 'addUser' },
      station_admin: { icon: 'plus', label: 'Add user', act: 'addUser' },
      commander: { icon: 'file', label: 'Generate report', act: 'go:reports' },
      detective: { icon: 'plus', label: 'Open new docket', act: 'newCase' },
      officer: { icon: 'plus', label: 'Capture incident', act: 'newCase' }
    };

    var head =
      '<div class="page__head"><div class="welcome">' +
        '<div class="welcome__eyebrow eyebrow">' + SD.icon('clock', 13) +
          '<span>' + SD.dutyDate(now) + ' · ' + SD.clock(now) + '</span></div>' +
        '<h1 class="welcome__title">' + SD.greeting(now) + ', ' + SD.esc(u.name.split(' ')[0]) + '</h1>' +
        '<p class="welcome__sub">' + SUBTITLE[role] + '</p></div>' +
      '<div class="head-actions">' +
        '<button class="btn btn--ghost" data-act="export">' + SD.icon('download', 16) + 'Export</button>' +
        '<button class="btn btn--primary" data-act="' + PRIMARY[role].act + '">' +
          SD.icon(PRIMARY[role].icon, 16) + PRIMARY[role].label + '</button>' +
      '</div></div>';

    var shift = '<div class="shift">' + SHIFT[role].map(function (p) {
      return '<div class="shift__item"><span class="shift__k">' + p[0] + '</span>' +
             '<span class="shift__v">' + SD.esc(p[1]) + '</span></div>';
    }).join('<div class="shift__divider"></div>') +
      '<div class="shift__spacer"></div>' +
      '<button class="btn btn--ghost btn--sm" data-act="handover">' + SD.icon('refresh', 15) +
      'Shift handover</button></div>';

    var body = statsFor(role).map(statCard).join('');

    if (role === 'detective') {
      body += caseTable(S.myCases(), 'My investigations', 'col-8');
      body += aiPanel('col-4');
      body += timelineCard('col-4');
      body += healthCard('col-4');
      body += notificationCard('col-4');
      body += chainCard('col-8');
      body += quickCard('col-4');
    } else if (role === 'commander') {
      body += trendCard('col-8');
      body += aiPanel('col-4');
      body += workloadCard('col-5');
      body += statusCard('col-4');
      body += notificationCard('col-3');
      body += caseTable(S.cases().filter(function (c) {
        return c.priority === 'Critical' || S.isOverdue(c) || c.status === 'Pending approval';
      }), 'Needs your attention', 'col-8');
      body += quickCard('col-4');
    } else if (role === 'admin') {
      body += stationCard('col-8');
      body += aiPanel('col-4');
      body += adminOversightCard('col-8');
      body += systemCard('col-4');
      body += chainCard('col-6');
      body += notificationCard('col-6');
      body += activityCard('col-8');
      body += quickCard('col-4');
    } else if (role === 'station_admin') {
      body += workloadCard('col-5');
      body += aiPanel('col-4');
      body += quickCard('col-3');
      body += chainCard('col-6');
      body += notificationCard('col-6');
      body += activityCard('col-8');
      body += healthCard('col-4');
    } else {
      body += quickCard('col-8');
      body += aiPanel('col-4');
      body += caseTable(S.myCases(), 'Complaints I captured', 'col-8');
      body += notificationCard('col-4');
      body += chainCard('col-8');
      body += activityCard('col-4');
    }

    mount.innerHTML = head + shift + '<section class="bento">' + body + '</section>';
    SD.stagger('.bento > .card');
    SD.animateMeters(mount);
  };

  /* ======================================================================
     Case list
     ====================================================================== */

  var caseFilter = { status: 'all', priority: 'all', q: '' };

  V.cases = function (mount) {
    function render() {
      var all = S.can('viewAllCases') ? S.cases() : S.myCases();

      var list = all.filter(function (c) {
        if (caseFilter.status === 'overdue' && !S.isOverdue(c)) return false;
        if (caseFilter.status !== 'all' && caseFilter.status !== 'overdue' && c.status !== caseFilter.status) return false;
        if (caseFilter.priority !== 'all' && c.priority !== caseFilter.priority) return false;
        if (caseFilter.q) {
          var hay = (c.no + ' ' + c.title + ' ' + c.category + ' ' + (c.detective || '')).toLowerCase();
          if (hay.indexOf(caseFilter.q.toLowerCase()) < 0) return false;
        }
        return true;
      });

      var rows = list.map(function (c) {
        var health = S.healthOf(c.no);
        var tone = health >= 75 ? 'success' : health >= 45 ? 'warning' : 'danger';
        return '<tr data-case="' + SD.esc(c.no) + '">' +
          '<td><div class="table__primary">' + SD.esc(c.title) + '</div>' +
            '<div class="table__sub mono">' + SD.esc(c.no) + '</div></td>' +
          '<td><div class="table__sub">' + SD.esc(c.category) + '</div></td>' +
          '<td>' + SD.priorityBadge(c.priority) + '</td>' +
          '<td>' + SD.statusBadge(S.isOverdue(c) ? 'Overdue' : c.status) + '</td>' +
          '<td><div class="table__sub">' + (c.detective ? SD.esc(c.detective) : '<span class="muted-dim">Unassigned</span>') + '</div></td>' +
          '<td class="mono">' + c.opened + ' d</td>' +
          '<td style="min-width:96px"><div class="progress"><div class="progress__fill progress__fill--' +
            tone + '" data-value="' + health + '"></div></div>' +
            '<div class="table__sub mono" style="margin-top:4px">' + health + '%</div></td>' +
        '</tr>';
      }).join('');

      var statuses = ['all', 'Reported', 'Assigned', 'Under investigation', 'Awaiting forensics', 'Pending approval', 'Closed', 'overdue'];

      mount.innerHTML =
        '<div class="page__head"><div class="welcome">' +
          '<h1 class="welcome__title">Dockets</h1>' +
          '<p class="welcome__sub">' + (S.can('viewAllCases')
            ? 'Every docket registered at this station.'
            : 'Dockets assigned to you.') + '</p></div>' +
          '<div class="head-actions">' +
            (S.can('createCase')
              ? '<button class="btn btn--primary" data-act="newCase">' + SD.icon('plus', 16) + 'New docket</button>'
              : '') +
          '</div></div>' +

        '<div class="filters">' +
          '<div class="search">' + SD.icon('search', 16) +
            '<input type="search" id="caseSearch" placeholder="Search docket number, title, officer" value="' +
            SD.esc(caseFilter.q) + '"></div>' +
          '<div class="chipset">' + statuses.map(function (s) {
            var label = s === 'all' ? 'All' : s === 'overdue' ? 'Over SLA' : s;
            return '<button class="chip' + (caseFilter.status === s ? ' chip--on' : '') +
                   '" data-status="' + SD.esc(s) + '">' + SD.esc(label) + '</button>';
          }).join('') + '</div>' +
          '<span class="result-count">' + list.length + ' of ' + all.length + '</span>' +
        '</div>' +

        (list.length
          ? '<article class="card"><div class="table-wrap"><table class="table">' +
            '<thead><tr><th>Docket</th><th>Category</th><th>Priority</th><th>Status</th>' +
            '<th>Investigating officer</th><th>Age</th><th>Completeness</th></tr></thead>' +
            '<tbody>' + rows + '</tbody></table></div></article>'
          : '<article class="card"><div class="empty">' + SD.icon('folder', 30) +
            '<div class="empty__title">No dockets match those filters</div>' +
            '<p class="empty__body">Clear the filters, or open a new docket if this matter has not been registered yet.</p>' +
            '<button class="btn btn--ghost btn--sm" data-status="all">Clear filters</button></div></article>');

      SD.animateMeters(mount);

      var search = SD.$('#caseSearch', mount);
      if (search) {
        search.addEventListener('input', function () {
          caseFilter.q = this.value;
          var pos = this.selectionStart;
          render();
          var again = SD.$('#caseSearch', mount);
          again.focus();
          again.setSelectionRange(pos, pos);
        });
      }

      SD.$$('[data-status]', mount).forEach(function (b) {
        b.addEventListener('click', function () {
          caseFilter.status = b.dataset.status;
          render();
        });
      });

      // Rows and actions must be re-wired on every internal re-render.
      SD.$$('[data-case]', mount).forEach(function (tr) {
        tr.addEventListener('click', function () {
          window.location.hash = '#/cases/' + encodeURIComponent(tr.dataset.case);
        });
      });

      SD_APP.wireActions(mount, { after: render });
    }

    render();
  };

  /* ======================================================================
     Case detail
     ====================================================================== */

  var caseTab = 'overview';

  V.case = function (mount, caseNo) {
    // In API mode the full docket — narrative, complainant, notes, timeline —
    // is a separate fetch. Show a skeleton until it lands.
    mount.innerHTML = '<article class="card"><div class="skel skel--title"></div>' +
      '<div class="skel skel--line"></div><div class="skel skel--line" style="width:70%"></div>' +
      '<div class="skel skel--block" style="margin-top:20px"></div></article>';

    S.loadCase(caseNo)
      .then(function () { renderCase(mount, caseNo); })
      .catch(function (err) {
        mount.innerHTML = '<article class="card"><div class="empty">' + SD.icon('alert', 30) +
          '<div class="empty__title">Could not open that docket</div>' +
          '<p class="empty__body">' + SD.esc(err.message || 'It may be outside your station scope.') + '</p>' +
          '<button class="btn btn--ghost btn--sm" data-go="cases">Back to dockets</button></div></article>';
        SD_APP.wireActions(mount, {});
        SD.$$('[data-go]', mount).forEach(function (b) {
          b.addEventListener('click', function () { window.location.hash = '#/cases'; });
        });
      });
  };

  function renderCase(mount, caseNo) {
    var c = S.getCase(caseNo);
    if (!c) {
      mount.innerHTML = '<article class="card"><div class="empty">' + SD.icon('alert', 30) +
        '<div class="empty__title">Docket not found</div>' +
        '<p class="empty__body">' + SD.esc(caseNo) + ' is not on the register.</p>' +
        '<button class="btn btn--ghost btn--sm" data-go="cases">Back to dockets</button></div></article>';
      return;
    }

    function render() {
      var ev = S.evidenceFor(c.no);
      var sp = S.suspectsFor(c.no);
      var st = S.statementsFor(c.no);
      var health = S.healthOf(c.no);
      var moves = S.allowedTransitions(c);

      var tabs = SD.tabs([
        { key: 'overview', label: 'Overview' },
        { key: 'timeline', label: 'Timeline', count: (c.timeline || []).length },
        { key: 'evidence', label: 'Evidence', count: ev.length },
        { key: 'suspects', label: 'Suspects', count: sp.length },
        { key: 'statements', label: 'Statements', count: st.length },
        { key: 'documents', label: 'Documents', count: S.documentsFor(c.no).length },
        { key: 'notes', label: 'Notes', count: (c.notes || []).length }
      ], caseTab);

      /* --- action bar: only transitions this role may perform --- */
      var actions = moves.map(function (m) {
        return '<button class="btn btn--ghost btn--sm" data-move="' + SD.esc(m.to) + '">' +
               SD.esc(m.label) + '</button>';
      }).join('');

      if (S.can('addEvidence')) actions += '<button class="btn btn--ghost btn--sm" data-act="addEvidence">' + SD.icon('evidence', 15) + 'Log exhibit</button>';
      if (S.can('addSuspect')) actions += '<button class="btn btn--ghost btn--sm" data-act="addSuspect">' + SD.icon('fingerprint', 15) + 'Add suspect</button>';
      if (S.can('addStatement')) actions += '<button class="btn btn--ghost btn--sm" data-act="addStatement">' + SD.icon('file', 15) + 'Record statement</button>';
      if (S.can('uploadDocument')) actions += '<button class="btn btn--ghost btn--sm" data-act="uploadDocument">' + SD.icon('download', 15) + 'Upload document</button>';
      if (S.can('assign') && !c.detective) actions += '<button class="btn btn--primary btn--sm" data-act="assign">' + SD.icon('users', 15) + 'Assign detective</button>';
      actions += '<button class="btn btn--ghost btn--sm" data-act="addNote">' + SD.icon('plus', 15) + 'Add note</button>';

      /* --- tab bodies --- */
      var panel = '';

      if (caseTab === 'overview') {
        var colour = health >= 75 ? 'var(--success)' : health >= 45 ? 'var(--warning)' : 'var(--danger)';
        panel =
          '<section class="bento">' +
            '<article class="card col-8">' +
              '<div class="card__head"><h2 class="card__title">' + SD.icon('file', 17) + 'Docket summary</h2></div>' +
              '<p class="prose" style="margin-bottom:20px">' + SD.esc(c.description || 'No narrative recorded yet.') + '</p>' +
              '<div class="ai-block">' +
                '<div class="ai-block__tag">' + SD.icon('ai', 13) + 'AI summary · advisory</div>' +
                '<p class="prose" style="font-size:13px">' + SD.esc(aiSummary(c, ev, sp, st, health)) + '</p>' +
              '</div>' +
            '</article>' +

            '<article class="card col-4">' +
              '<div class="card__head"><h2 class="card__title">' + SD.icon('scale', 17) + 'Completeness</h2></div>' +
              '<div style="display:grid;place-items:center">' + SD.ring(health, colour) + '</div>' +
              '<div style="margin-top:16px">' +
                checkRow(st.length > 0, st.length + ' statement(s) on file') +
                checkRow(ev.length >= 3, ev.length + ' exhibit(s) logged') +
                checkRow(sp.length > 0, sp.length + ' suspect(s) recorded') +
                checkRow(!!c.detective, c.detective ? 'Detective assigned' : 'No detective assigned') +
                checkRow(c.lastActivity < 4320, 'Activity in the last 3 days') +
              '</div></article>' +

            '<article class="card col-6">' +
              '<div class="card__head"><h2 class="card__title">' + SD.icon('folder', 17) + 'Docket details</h2></div>' +
              kv('Docket number', '<span class="mono">' + SD.esc(c.no) + '</span>') +
              kv('Category', SD.esc(c.category)) +
              kv('Priority', SD.priorityBadge(c.priority)) +
              kv('Status', SD.statusBadge(S.isOverdue(c) ? 'Overdue' : c.status)) +
              kv('Investigating officer', c.detective ? SD.esc(c.detective) : '<span class="muted-dim">Unassigned</span>') +
              kv('Station', SD.esc(c.station) + ' · GP-HLB-014') +
              kv('Days open', c.opened + ' days') +
              kv('Location', SD.esc(c.location || '—')) +
            '</article>' +

            '<article class="card col-6">' +
              '<div class="card__head"><h2 class="card__title">' + SD.icon('users', 17) + 'Complainant</h2></div>' +
              kv('Full name', SD.esc(c.complainant.name)) +
              kv('Identity number', '<span class="mono">' + SD.esc(c.complainant.id) + '</span>') +
              kv('Contact number', '<span class="mono">' + SD.esc(c.complainant.phone) + '</span>') +
              kv('Address', SD.esc(c.complainant.address)) +
              '<p class="muted" style="font-size:12px;margin-top:16px">' + SD.icon('lock', 12) +
              ' Identity numbers are masked at display. Full values are visible only to the ' +
              'investigating officer and are recorded in the audit log when revealed.</p>' +
            '</article>' +
          '</section>';
      }

      if (caseTab === 'timeline') {
        panel = '<article class="card"><div class="timeline">' +
          (c.timeline || []).slice().reverse().map(function (e) {
            return '<div class="tl-item' + (e.state === 'now' ? ' tl-item--now' : ' tl-item--done') + '">' +
              '<span class="tl-item__dot"></span>' +
              '<div class="tl-item__title">' + SD.esc(e.t) + '</div>' +
              '<div class="tl-item__meta">' + SD.esc(e.by) + ' · ' + SD.ago(e.mins) + '</div>' +
              (e.body ? '<div class="tl-item__body">' + SD.esc(e.body) + '</div>' : '') + '</div>';
          }).join('') + '</div></article>';
      }

      if (caseTab === 'evidence') {
        panel = ev.length
          ? '<article class="card"><div class="table-wrap"><table class="table">' +
            '<thead><tr><th>Exhibit</th><th>Type</th><th>Collected by</th><th>Storage</th>' +
            '<th>Status</th><th>Chain</th></tr></thead><tbody>' +
            ev.map(function (e) {
              var bad = e.chain.some(function (x) { return !x.ok; });
              return '<tr data-evidence="' + SD.esc(e.id) + '">' +
                '<td><div class="table__primary">' + SD.esc(e.label) + '</div>' +
                  '<div class="table__sub mono">' + SD.esc(e.id) + '</div></td>' +
                '<td><div class="table__sub">' + SD.esc(e.type) + '</div></td>' +
                '<td><div class="table__sub">' + SD.esc(e.collectedBy) + '</div></td>' +
                '<td><div class="table__sub">' + SD.esc(e.location) + '</div></td>' +
                '<td>' + (e.status === 'Verified'
                  ? '<span class="badge badge--success">Verified</span>'
                  : bad ? '<span class="badge badge--danger">Chain break</span>'
                        : '<span class="badge badge--warning">Pending</span>') + '</td>' +
                '<td>' + SD.chainStrip(e.chain.map(function (x) { return x.ok ? 'ok' : 'broken'; })) + '</td>' +
              '</tr>';
            }).join('') + '</tbody></table></div></article>'
          : emptyCard('evidence', 'No exhibits on this docket', 'Log the first exhibit to start a chain of custody.', 'addEvidence', 'Log exhibit');
      }

      if (caseTab === 'suspects') {
        panel = sp.length
          ? '<article class="card"><div class="table-wrap"><table class="table">' +
            '<thead><tr><th>Suspect</th><th>Reference</th><th>Age</th><th>Status</th><th>Note</th></tr></thead><tbody>' +
            sp.map(function (s) {
              return '<tr><td><div class="table__primary">' + SD.esc(s.name) + '</div></td>' +
                '<td class="mono table__sub">' + SD.esc(s.id) + '</td>' +
                '<td class="table__sub">' + SD.esc(s.age) + '</td>' +
                '<td>' + (s.status === 'Arrested' || s.status === 'Charged'
                  ? '<span class="badge badge--success">' + SD.esc(s.status) + '</span>'
                  : '<span class="badge badge--warning">' + SD.esc(s.status) + '</span>') + '</td>' +
                '<td class="table__sub">' + SD.esc(s.note) + '</td></tr>';
            }).join('') + '</tbody></table></div></article>'
          : emptyCard('fingerprint', 'No suspects recorded', 'Add a suspect profile, even if the description is partial.', 'addSuspect', 'Add suspect');
      }

      if (caseTab === 'statements') {
        panel = st.length
          ? '<article class="card"><div class="table-wrap"><table class="table">' +
            '<thead><tr><th>Deponent</th><th>Reference</th><th>Type</th><th>Taken by</th><th>Date</th><th>Status</th></tr></thead><tbody>' +
            st.map(function (s) {
              return '<tr><td><div class="table__primary">' + SD.esc(s.deponent) + '</div></td>' +
                '<td class="mono table__sub">' + SD.esc(s.id) + '</td>' +
                '<td class="table__sub">' + SD.esc(s.kind) + '</td>' +
                '<td class="table__sub">' + SD.esc(s.takenBy) + '</td>' +
                '<td class="table__sub">' + SD.esc(s.at) + '</td>' +
                '<td>' + (s.status === 'Signed'
                  ? '<span class="badge badge--success">Signed</span>'
                  : '<span class="badge badge--warning">Draft</span>') + '</td></tr>';
            }).join('') + '</tbody></table></div></article>'
          : emptyCard('file', 'No statements recorded', 'A docket without a complainant statement is normally returned.', 'addStatement', 'Record statement');
      }

      if (caseTab === 'documents') {
        var docs = S.documentsFor(c.no);
        panel = docs.length
          ? '<article class="card"><div class="table-wrap"><table class="table">' +
            '<thead><tr><th>Document</th><th>Type</th><th>Size</th><th>Digest</th>' +
            '<th>Filed by</th><th></th></tr></thead><tbody>' +
            docs.map(function (d) {
              return '<tr><td><div class="table__primary">' + SD.esc(d.title) + '</div>' +
                '<div class="table__sub">' + SD.esc(d.filename) + '</div></td>' +
                '<td class="table__sub">' + SD.esc(d.docType) + '</td>' +
                '<td class="table__sub mono">' + SD.esc(d.size) + '</td>' +
                '<td class="table__sub mono">' + SD.esc(d.sha256 || '—') + '</td>' +
                '<td class="table__sub">' + SD.esc(d.uploadedBy) + '</td>' +
                '<td>' + (S.isRemote()
                  ? '<a class="btn btn--quiet btn--sm" href="' + SD_API.documentFileUrl(d.id) +
                    '" target="_blank" rel="noopener">Open</a>'
                  : '<span class="muted-dim" style="font-size:12px">local</span>') + '</td></tr>';
            }).join('') + '</tbody></table></div></article>'
          : emptyCard('file', 'No documents filed', 'Charge sheets, warrants, forensic reports and ' +
              'correspondence are filed here. Each one is hashed on upload.', 'uploadDocument', 'Upload document');
      }

      if (caseTab === 'notes') {
        panel = (c.notes && c.notes.length)
          ? '<article class="card">' + c.notes.map(function (n) {
              return '<div class="feed-item"><span class="avatar avatar--sm">' + SD.initials(n.by) + '</span>' +
                '<div><div class="feed-item__text">' + SD.esc(n.text) + '</div>' +
                '<div class="feed-item__time">' + SD.esc(n.by) + ' · ' + SD.clock(n.at) + '</div></div></div>';
            }).join('') + '</article>'
          : emptyCard('plus', 'No case notes yet', 'Notes are timestamped, attributed and cannot be edited once written.', 'addNote', 'Add note');
      }

      /* --- assemble --- */
      mount.innerHTML =
        '<div class="crumb">' + SD.icon('arrowRight', 13) +
          '<button data-go="cases">Dockets</button><span>/</span>' +
          '<span class="mono">' + SD.esc(c.no) + '</span></div>' +

        '<div class="case-hero"><div class="case-hero__main">' +
          '<div class="case-hero__no">' + SD.esc(c.no) + '</div>' +
          '<h1 class="case-hero__title">' + SD.esc(c.title) + '</h1>' +
          '<div class="case-hero__meta">' +
            SD.priorityBadge(c.priority) +
            SD.statusBadge(S.isOverdue(c) ? 'Overdue' : c.status) +
            '<span class="badge badge--neutral">' + SD.esc(c.category) + '</span>' +
            '<span class="muted" style="font-size:13px">Opened ' + c.opened + ' days ago</span>' +
          '</div></div></div>' +

        '<div class="act-bar">' + actions + '</div>' +
        tabs + panel;

      SD.animateMeters(mount);

      /* --- tab switching --- */
      SD.$$('[data-tab]', mount).forEach(function (b) {
        b.addEventListener('click', function () { caseTab = b.dataset.tab; render(); });
      });

      /* --- status transitions --- */
      SD.$$('[data-move]', mount).forEach(function (b) {
        b.addEventListener('click', function () {
          var to = b.dataset.move;
          SD.confirm('Move docket to “' + to + '”?',
            'This writes a status change to the docket timeline and the audit log. ' +
            'It cannot be removed, only superseded by a later change.',
            'Confirm change',
            function () {
              S.changeStatus(c.no, to).then(function () {
                SD.toast('Docket moved to ' + to, 'success');
                renderCase(mount, caseNo);
              }).catch(SD_APP.showFormError);
            });
        });
      });

      /* --- assign detective --- */
      var assignBtn = SD.$('[data-act="assign"]', mount);
      if (assignBtn) {
        assignBtn.addEventListener('click', function () {
          SD.modal({
            title: 'Assign investigating officer',
            subtitle: c.no,
            body: '<div class="fm">' + SD.select('who', 'Detective',
              S.detectives().map(function (d) {
                return {
                  value: S.isRemote() ? String(d.id) : d.name,
                  label: d.name + ' — ' + d.active + '/' + d.capacity + ' dockets' +
                         (d.overdue ? ' · ' + d.overdue + ' over SLA' : '')
                };
              }), { wide: true, required: true }) + '</div>',
            submitLabel: 'Assign docket',
            onSubmit: function (v, close) {
              S.assignDetective(c.no, S.isRemote() ? Number(v.who) : v.who).then(function () {
                close();
                SD.toast('Docket assigned', 'success');
                renderCase(mount, caseNo);
              }).catch(SD_APP.showFormError);
            }
          });
        });
      }

      /* --- add note --- */
      SD.$$('[data-act="addNote"]', mount).forEach(function (b) {
        b.addEventListener('click', function () {
          SD.modal({
            title: 'Add case note',
            subtitle: c.no,
            body: '<div class="fm">' + SD.textarea('text', 'Note',
              { required: true, placeholder: 'What was done, observed or decided.' }) + '</div>',
            submitLabel: 'Save note',
            onSubmit: function (v, close) {
              S.addNote(c.no, v.text).then(function () {
                close();
                SD.toast('Note saved to the docket', 'success');
                caseTab = 'notes';
                renderCase(mount, caseNo);
              }).catch(SD_APP.showFormError);
            }
          });
        });
      });

      /* --- evidence rows open the exhibit --- */
      SD.$$('[data-evidence]', mount).forEach(function (tr) {
        tr.addEventListener('click', function () {
          window.location.hash = '#/evidence/' + encodeURIComponent(tr.dataset.evidence);
        });
      });

      // Modal-opening actions shared with the rest of the app
      SD_APP.wireActions(mount, { caseNo: c.no, after: render });
    }

    render();
  }

  /* ======================================================================
     Small helpers used by the views above
     ====================================================================== */

  function kv(k, v) {
    return '<div class="kv"><div class="kv__k">' + k + '</div><div class="kv__v">' + v + '</div></div>';
  }

  function checkRow(ok, text) {
    return '<div class="health__row health__row--' + (ok ? 'ok' : 'miss') + '">' +
      SD.icon(ok ? 'check' : 'alert', 15) + '<span>' + SD.esc(text) + '</span></div>';
  }

  function emptyCard(icon, title, body, act, label) {
    return '<article class="card"><div class="empty">' + SD.icon(icon, 30) +
      '<div class="empty__title">' + SD.esc(title) + '</div>' +
      '<p class="empty__body">' + SD.esc(body) + '</p>' +
      '<button class="btn btn--ghost btn--sm" data-act="' + act + '">' + SD.esc(label) + '</button>' +
      '</div></article>';
  }

  /** Draft summary assembled from what is actually on the docket. */
  function aiSummary(c, ev, sp, st, health) {
    var parts = [];
    parts.push('This ' + c.category.toLowerCase() + ' docket was opened ' + c.opened +
               ' days ago and currently sits at ' + c.status.toLowerCase() + '.');
    parts.push('It holds ' + ev.length + ' exhibit' + (ev.length === 1 ? '' : 's') + ', ' +
               st.length + ' statement' + (st.length === 1 ? '' : 's') + ' and ' +
               sp.length + ' suspect record' + (sp.length === 1 ? '' : 's') + '.');
    if (health < 50) {
      parts.push('Completeness is low at ' + health + '%. The strongest single improvement would be ' +
                 (st.length === 0 ? 'recording a complainant statement.' :
                  sp.length === 0 ? 'establishing a suspect description.' :
                  'logging further physical or digital exhibits.'));
    } else if (health < 80) {
      parts.push('Completeness is moderate at ' + health + '%. Outstanding items are listed alongside.');
    } else {
      parts.push('Completeness is strong at ' + health + '%. The docket is close to submission standard.');
    }
    if (c.lastActivity > 4320) {
      parts.push('No activity has been recorded for several days, which is the most common cause of SLA breach.');
    }
    return parts.join(' ');
  }

  V._aiPanel = aiPanel;
  V._caseTable = caseTable;
  V._notificationCard = notificationCard;
  V._activityCard = activityCard;

})(window.SD_VIEWS, window.SD_STORE);
