/* ==========================================================================
   SDICMS — Secondary views
   Evidence register, exhibit detail, people, stations, reports, audit log,
   AI workspace and settings.
   ========================================================================== */

(function (V, S) {
  'use strict';

  function head(title, sub, actionHtml) {
    return '<div class="page__head"><div class="welcome">' +
      '<h1 class="welcome__title">' + SD.esc(title) + '</h1>' +
      '<p class="welcome__sub">' + SD.esc(sub) + '</p></div>' +
      '<div class="head-actions">' + (actionHtml || '') + '</div></div>';
  }

  /* ======================================================================
     Evidence register
     ====================================================================== */
  var evFilter = 'all';

  V.evidence = function (mount) {
    function render() {
      var all = S.evidence();
      var list = all.filter(function (e) {
        if (evFilter === 'all') return true;
        if (evFilter === 'break') return e.chain.some(function (c) { return !c.ok; });
        return e.status === evFilter;
      });

      var rows = list.map(function (e) {
        var bad = e.chain.some(function (x) { return !x.ok; });
        return '<tr data-evidence="' + SD.esc(e.id) + '">' +
          '<td><div class="table__primary">' + SD.esc(e.label) + '</div>' +
            '<div class="table__sub mono">' + SD.esc(e.id) + '</div></td>' +
          '<td><div class="table__sub mono">' + SD.esc(e.caseNo) + '</div></td>' +
          '<td><div class="table__sub">' + SD.esc(e.type) + '</div></td>' +
          '<td><div class="table__sub">' + SD.esc(e.collectedBy) + '</div></td>' +
          '<td><div class="table__sub">' + SD.esc(e.location) + '</div></td>' +
          '<td>' + (bad ? '<span class="badge badge--danger">Chain break</span>'
                  : e.status === 'Verified' ? '<span class="badge badge--success">Verified</span>'
                  : '<span class="badge badge--warning">Pending</span>') + '</td>' +
          '<td style="min-width:120px">' +
            SD.chainStrip(e.chain.map(function (x) { return x.ok ? 'ok' : 'broken'; })) + '</td>' +
        '</tr>';
      }).join('');

      mount.innerHTML =
        head('Evidence register', 'Every exhibit logged at this station, with its custody chain.',
          S.can('addEvidence')
            ? '<button class="btn btn--primary" data-act="addEvidence">' + SD.icon('plus', 16) + 'Log exhibit</button>'
            : '') +

        '<div class="filters"><div class="chipset">' +
          [['all', 'All'], ['Verified', 'Verified'], ['Pending verification', 'Pending'], ['break', 'Chain breaks']]
            .map(function (f) {
              return '<button class="chip' + (evFilter === f[0] ? ' chip--on' : '') +
                     '" data-ev-filter="' + f[0] + '">' + f[1] + '</button>';
            }).join('') +
        '</div><span class="result-count">' + list.length + ' of ' + all.length + ' exhibits</span></div>' +

        '<article class="card"><div class="table-wrap"><table class="table">' +
        '<thead><tr><th>Exhibit</th><th>Docket</th><th>Type</th><th>Collected by</th>' +
        '<th>Storage</th><th>Status</th><th>Custody chain</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div></article>';

      SD.$$('[data-ev-filter]', mount).forEach(function (b) {
        b.addEventListener('click', function () { evFilter = b.dataset.evFilter; render(); });
      });

      SD.$$('[data-evidence]', mount).forEach(function (tr) {
        tr.addEventListener('click', function () {
          window.location.hash = '#/evidence/' + encodeURIComponent(tr.dataset.evidence);
        });
      });

      SD_APP.wireActions(mount, { after: render });
    }
    render();
  };

  /* ======================================================================
     Exhibit detail — the custody chain in full
     ====================================================================== */
  V.exhibit = function (mount, id) {
    function render() {
      var e = S.getEvidence(id);
      if (!e) {
        mount.innerHTML = '<article class="card"><div class="empty">' + SD.icon('alert', 30) +
          '<div class="empty__title">Exhibit not found</div>' +
          '<button class="btn btn--ghost btn--sm" data-go="evidence">Back to register</button></div></article>';
        return;
      }

      var bad = e.chain.some(function (x) { return !x.ok; });

      var chainRows = e.chain.map(function (link, i) {
        return '<div class="custody-row' + (link.ok ? '' : ' custody-row--bad') + '">' +
          '<div class="custody-row__num">' + (i + 1) + '</div>' +
          '<div><div class="custody-row__move">' + SD.esc(link.from) + ' → ' + SD.esc(link.to) + '</div>' +
            '<div class="custody-row__meta">' + SD.esc(link.action) + ' · ' + SD.esc(link.at) + '</div>' +
            '<div class="custody-row__hash">prev ' + SD.esc(link.prevHash) + ' → ' + SD.esc(link.hash) + '</div>' +
            (link.ok ? '' : '<div class="table__sub" style="color:#FCA5A5;margin-top:6px">' +
              'This entry does not hash to the entry before it. The exhibit moved without a recorded handler.</div>') +
          '</div>' +
          '<div>' + (link.ok ? '<span class="badge badge--success">Intact</span>'
                             : '<span class="badge badge--danger">Mismatch</span>') + '</div>' +
        '</div>';
      }).join('');

      mount.innerHTML =
        '<div class="crumb">' + SD.icon('arrowRight', 13) +
          '<button data-go="evidence">Evidence</button><span>/</span>' +
          '<span class="mono">' + SD.esc(e.id) + '</span></div>' +

        '<div class="case-hero"><div class="case-hero__main">' +
          '<div class="case-hero__no">' + SD.esc(e.id) + '</div>' +
          '<h1 class="case-hero__title">' + SD.esc(e.label) + '</h1>' +
          '<div class="case-hero__meta">' +
            '<span class="badge badge--neutral">' + SD.esc(e.type) + '</span>' +
            (bad ? '<span class="badge badge--danger">Chain break</span>'
                 : e.status === 'Verified' ? '<span class="badge badge--success">Verified</span>'
                 : '<span class="badge badge--warning">Pending verification</span>') +
            '<span class="muted" style="font-size:13px">Docket ' + SD.esc(e.caseNo) + '</span>' +
          '</div></div></div>' +

        '<div class="act-bar">' +
          '<button class="btn btn--ghost btn--sm" data-open-case="' + SD.esc(e.caseNo) + '">' +
            SD.icon('folder', 15) + 'Open docket</button>' +
          (e.status !== 'Verified' && !bad
            ? '<button class="btn btn--primary btn--sm" data-verify="1">' + SD.icon('check', 15) + 'Verify and seal</button>'
            : '') +
          '<button class="btn btn--ghost btn--sm" data-transfer="1">' + SD.icon('refresh', 15) + 'Transfer custody</button>' +
          (e.hasFile && S.isRemote()
            ? '<a class="btn btn--ghost btn--sm" href="' + SD_API.evidenceFileUrl(e.id) +
              '" target="_blank" rel="noopener">' + SD.icon('download', 15) +
              'Open exhibit file</a>'
            : '') +
        '</div>' +

        '<section class="bento">' +
          '<article class="card col-7">' +
            '<div class="card__head"><h2 class="card__title">' + SD.icon('evidence', 17) +
            'Chain of custody</h2><span class="badge badge--' + (bad ? 'danger">Break detected' : 'success">Verified') +
            '</span></div>' + chainRows + '</article>' +

          '<article class="card col-5">' +
            '<div class="card__head"><h2 class="card__title">' + SD.icon('file', 17) + 'Exhibit record</h2></div>' +
            kv('Exhibit number', '<span class="mono">' + SD.esc(e.id) + '</span>') +
            kv('Linked docket', '<span class="mono">' + SD.esc(e.caseNo) + '</span>') +
            kv('Type', SD.esc(e.type)) +
            kv('Collected by', SD.esc(e.collectedBy)) +
            kv('Collected at', SD.esc(e.collectedAt)) +
            kv('Storage location', SD.esc(e.location)) +
            kv('File size', SD.esc(e.size)) +
            kv('SHA-256 digest', e.sha256
              ? '<span class="mono">' + SD.esc(e.sha256) + '…</span>'
              : '<span class="muted-dim">no file attached</span>') +
            kv('Custody events', String(e.chain.length)) +
          '</article>' +
        '</section>';

      var verify = SD.$('[data-verify]', mount);
      if (verify) {
        verify.addEventListener('click', function () {
          SD.confirm('Verify and seal this exhibit?',
            'Sealing records your badge against the exhibit and closes it to further edits. ' +
            'Custody transfers remain possible and continue the chain.',
            'Verify and seal',
            function () {
              S.verifyEvidence(e.id).then(function () {
                SD.toast('Exhibit verified and sealed', 'success');
                render();
              }).catch(SD_APP.showFormError);
            });
        });
      }

      SD.$('[data-transfer]', mount).addEventListener('click', function () {
        SD.modal({
          title: 'Transfer custody',
          subtitle: e.id + ' · ' + e.label,
          body: '<div class="fm">' +
            SD.input('to', 'Transfer to', { required: true, placeholder: 'Forensic Services, Exhibit store B, Court' }) +
            SD.select('action', 'Reason', ['Signed out for review', 'Delivered for analysis', 'Returned to store', 'Presented in court'], { required: true }) +
            '</div>',
          submitLabel: 'Record transfer',
          onSubmit: function (v, close) {
            S.transferCustody(e.id, v.to, v.action).then(function () {
              close();
              SD.toast('Custody transfer recorded and chained', 'success');
              render();
            }).catch(SD_APP.showFormError);
          }
        });
      });

      SD_APP.wireActions(mount, { after: render });
    }
    render();
  };

  /* ======================================================================
     Suspects
     ====================================================================== */
  V.suspects = function (mount) {
    function render() {
      var list = S.suspects();
      mount.innerHTML =
        head('Suspects', 'Suspect profiles linked to dockets at this station.',
          S.can('addSuspect')
            ? '<button class="btn btn--primary" data-act="addSuspect">' + SD.icon('plus', 16) + 'Add suspect</button>'
            : '') +
        '<article class="card"><div class="table-wrap"><table class="table">' +
        '<thead><tr><th>Suspect</th><th>Reference</th><th>Docket</th><th>Age</th><th>Status</th><th>Note</th></tr></thead><tbody>' +
        list.map(function (s) {
          return '<tr data-open-case-row="' + SD.esc(s.caseNo) + '">' +
            '<td><div class="table__primary">' + SD.esc(s.name) + '</div></td>' +
            '<td class="mono table__sub">' + SD.esc(s.id) + '</td>' +
            '<td class="mono table__sub">' + SD.esc(s.caseNo) + '</td>' +
            '<td class="table__sub">' + SD.esc(s.age) + '</td>' +
            '<td>' + (s.identified ? '<span class="badge badge--success">' + SD.esc(s.status) + '</span>'
                                   : '<span class="badge badge--warning">' + SD.esc(s.status) + '</span>') + '</td>' +
            '<td class="table__sub">' + SD.esc(s.note) + '</td></tr>';
        }).join('') + '</tbody></table></div></article>';

      wireCaseRows(mount);
      SD_APP.wireActions(mount, { after: render });
    }
    render();
  };

  /* ======================================================================
     Statements
     ====================================================================== */
  V.statements = function (mount) {
    function render() {
      var list = S.statements();
      mount.innerHTML =
        head('Statements', 'Complainant, witness and suspect statements on file.',
          S.can('addStatement')
            ? '<button class="btn btn--primary" data-act="addStatement">' + SD.icon('plus', 16) + 'Record statement</button>'
            : '') +
        '<article class="card"><div class="table-wrap"><table class="table">' +
        '<thead><tr><th>Deponent</th><th>Reference</th><th>Docket</th><th>Type</th><th>Taken by</th><th>Date</th><th>Status</th></tr></thead><tbody>' +
        list.map(function (s) {
          return '<tr data-open-case-row="' + SD.esc(s.caseNo) + '">' +
            '<td><div class="table__primary">' + SD.esc(s.deponent) + '</div></td>' +
            '<td class="mono table__sub">' + SD.esc(s.id) + '</td>' +
            '<td class="mono table__sub">' + SD.esc(s.caseNo) + '</td>' +
            '<td class="table__sub">' + SD.esc(s.kind) + '</td>' +
            '<td class="table__sub">' + SD.esc(s.takenBy) + '</td>' +
            '<td class="table__sub">' + SD.esc(s.at) + '</td>' +
            '<td>' + (s.status === 'Signed' ? '<span class="badge badge--success">Signed</span>'
                                            : '<span class="badge badge--warning">Draft</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div></article>';

      wireCaseRows(mount);
      SD_APP.wireActions(mount, { after: render });
    }
    render();
  };

  /* ======================================================================
     Officers / users
     ====================================================================== */
  V.officers = function (mount) {
    function render() {
      var list = S.staff();
      mount.innerHTML =
        head(S.can('manageUsers') ? 'Users and permissions' : 'Officers',
          S.can('manageUsers')
            ? 'Every account on the system, its role and its current standing.'
            : 'Detectives at this station and their current caseload.',
          S.can('manageUsers')
            ? '<button class="btn btn--primary" data-act="addUser">' + SD.icon('plus', 16) + 'Add user</button>'
            : '') +
        '<article class="card"><div class="table-wrap"><table class="table">' +
        '<thead><tr><th>Officer</th><th>Badge</th><th>Role</th><th>Caseload</th><th>Closed</th><th>Standing</th></tr></thead><tbody>' +
        list.map(function (d) {
          var pct = d.capacity ? Math.min(Math.round(d.active / d.capacity * 100), 100) : 0;
          var tone = pct > 95 ? 'danger' : pct > 85 ? 'warning' : 'success';
          return '<tr><td><div class="who"><span class="avatar avatar--sm">' + SD.initials(d.name) + '</span>' +
            '<div><div class="who__name">' + SD.esc(d.name) + '</div>' +
            '<div class="who__role">' + SD.esc(d.rank) + '</div></div></div></td>' +
            '<td class="mono table__sub">' + SD.esc(d.badge) + '</td>' +
            '<td><span class="badge badge--neutral">' + SD.esc(d.roleLabel || d.role) + '</span></td>' +
            '<td style="min-width:120px">' + (d.capacity
              ? '<div class="progress"><div class="progress__fill progress__fill--' + tone +
                '" data-value="' + pct + '"></div></div>' +
                '<div class="table__sub mono" style="margin-top:4px">' + d.active + '/' + d.capacity + '</div>'
              : '<span class="muted-dim">—</span>') + '</td>' +
            '<td class="mono table__sub">' + (d.closed || '—') + '</td>' +
            '<td>' + (d.status === 'Active' ? '<span class="badge badge--success">Active</span>'
                    : d.status === 'Flagged' ? '<span class="badge badge--warning">Flagged</span>'
                    : '<span class="badge badge--danger">Suspended</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div></article>';

      SD.animateMeters(mount);
      SD_APP.wireActions(mount, { after: render });
    }
    render();
  };

  /* ======================================================================
     Stations
     ====================================================================== */
  V.stations = function (mount) {
    var list = S.stations();
    mount.innerHTML =
      head('Stations', 'Registered stations, their establishment and clearance performance.') +
      '<section class="bento">' + list.map(function (s) {
        var tone = s.clearance >= 70 ? 'success' : s.clearance >= 55 ? 'warning' : 'danger';
        return '<article class="card card--hover col-4">' +
          '<div class="card__head"><h2 class="card__title">' + SD.icon('building', 17) + SD.esc(s.name) + '</h2>' +
          '<span class="badge badge--' + tone + '">' + s.clearance + '%</span></div>' +
          '<div class="mono table__sub" style="margin-bottom:12px">' + SD.esc(s.code) + ' · ' + SD.esc(s.province) + '</div>' +
          '<div class="progress"><div class="progress__fill progress__fill--' + tone +
          '" data-value="' + s.clearance + '"></div></div>' +
          '<div style="display:flex;gap:24px;margin-top:16px">' +
            '<div><div class="stat__value" style="font-size:20px" data-count="' + s.officers + '">0</div>' +
            '<div class="table__sub">Officers</div></div>' +
            '<div><div class="stat__value" style="font-size:20px" data-count="' + s.open + '">0</div>' +
            '<div class="table__sub">Open dockets</div></div>' +
          '</div></article>';
      }).join('') + '</section>';

    SD.stagger('.bento > .card');
    SD.animateMeters(mount);
  };

  /* ======================================================================
     Reports
     ====================================================================== */
  V.reports = function (mount) {
    function render(generated) {
      var all = S.cases();
      var closed = all.filter(function (c) { return c.status === 'Closed' || c.status === 'Referred to NPA'; });
      var overdue = all.filter(S.isOverdue);

      var preview = generated
        ? '<article class="card col-12"><div class="card__head">' +
            '<h2 class="card__title">' + SD.icon('file', 17) + SD.esc(generated.title) + '</h2>' +
            '<button class="btn btn--ghost btn--sm" data-act="export">' + SD.icon('download', 15) + 'Download</button></div>' +
            '<div class="report">' + generated.body + '</div></article>'
        : '';

      var options = [
        { key: 'station', title: 'Station performance report', hint: 'Caseload, clearance and SLA breaches for the current month' },
        { key: 'docket', title: 'Docket status report', hint: 'Every open docket with age, priority and completeness' },
        { key: 'evidence', title: 'Evidence and custody report', hint: 'Exhibit register with chain integrity findings' },
        { key: 'officer', title: 'Officer activity report', hint: 'Actions per officer over the reporting period' }
      ];

      mount.innerHTML =
        head('Reports', 'Generate a report from live docket data. Every generation is logged.') +
        '<section class="bento">' +
          options.map(function (o) {
            return '<article class="card card--hover col-3">' +
              '<div class="stat__icon" style="margin-bottom:16px">' + SD.icon('file', 17) + '</div>' +
              '<h3 style="margin-bottom:8px">' + SD.esc(o.title) + '</h3>' +
              '<p class="muted" style="font-size:13px;margin-bottom:20px">' + SD.esc(o.hint) + '</p>' +
              '<button class="btn btn--ghost btn--sm btn--block" data-report="' + o.key + '">Generate</button>' +
            '</article>';
          }).join('') + preview +
        '</section>';

      SD.stagger('.bento > .card');

      SD.$$('[data-report]', mount).forEach(function (b) {
        b.addEventListener('click', function () {
          var kind = b.dataset.report;
          b.textContent = 'Generating…';
          setTimeout(function () {
            S.writeAudit(S.user().rank + ' ' + S.user().name, 'REPORT_GENERATE', kind, 'Report generated');
            render(buildReport(kind, all, closed, overdue));
            SD.toast('Report generated from live docket data', 'success');
          }, 700);
        });
      });

      SD_APP.wireActions(mount, { after: function () { render(generated); } });
    }
    render(null);
  };

  function buildReport(kind, all, closed, overdue) {
    var u = S.user();
    var when = SD.dutyDate(new Date()) + ' at ' + SD.clock(new Date());
    var header = '<h3>Hillbrow Police Station — GP-HLB-014</h3>' +
      '<div class="table__sub">Prepared by ' + SD.esc(u.rank + ' ' + u.name) + ' · ' + when + '</div>' +
      '<div class="report__rule"></div>';

    if (kind === 'station') {
      return { title: 'Station performance report', body: header +
        '<p>The station carries ' + all.length + ' registered dockets, of which ' +
        (all.length - closed.length) + ' remain open. ' + closed.length + ' have been closed or referred ' +
        'to the National Prosecuting Authority, giving a clearance rate of ' +
        Math.round(closed.length / all.length * 100) + '%.</p>' +
        '<div class="report__sec"><b>SLA performance</b><p>' + overdue.length +
        ' docket(s) have exceeded the 30-day investigation standard. The oldest is ' +
        (overdue.length ? SD.esc(overdue[0].no) + ' at ' + overdue[0].opened + ' days' : 'not applicable') + '.</p></div>' +
        '<div class="report__sec"><b>Caseload distribution</b>' +
        S.detectives().map(function (d) {
          return '<p>' + SD.esc(d.name) + ' — ' + d.active + ' active against a capacity of ' + d.capacity +
                 (d.overdue ? ', ' + d.overdue + ' over SLA' : '') + '.</p>';
        }).join('') + '</div>' };
    }

    if (kind === 'docket') {
      return { title: 'Docket status report', body: header +
        all.slice(0, 10).map(function (c) {
          return '<p><span class="mono">' + SD.esc(c.no) + '</span> — ' + SD.esc(c.title) +
                 '. Status ' + SD.esc(c.status).toLowerCase() + ', priority ' + SD.esc(c.priority).toLowerCase() +
                 ', open ' + c.opened + ' days, completeness ' + S.healthOf(c.no) + '%.</p>';
        }).join('') };
    }

    if (kind === 'evidence') {
      var ev = S.evidence();
      var broken = ev.filter(function (e) { return e.chain.some(function (x) { return !x.ok; }); });
      return { title: 'Evidence and custody report', body: header +
        '<p>' + ev.length + ' exhibits are on the register. ' +
        ev.filter(function (e) { return e.status === 'Verified'; }).length + ' are verified and sealed.</p>' +
        '<div class="report__sec"><b>Chain integrity</b><p>' +
        (broken.length
          ? broken.length + ' exhibit(s) show a hash mismatch: ' +
            broken.map(function (e) { return SD.esc(e.id); }).join(', ') +
            '. These exhibits are locked pending review and may be challenged on admissibility.'
          : 'All custody chains verify end to end.') + '</p></div>' };
    }

    return { title: 'Officer activity report', body: header +
      S.audit().slice(0, 12).map(function (a) {
        return '<p><span class="mono">' + SD.clock(a.at) + '</span> — ' + SD.esc(a.actor) +
               ' · ' + SD.esc(a.action) + ' on ' + SD.esc(a.target) + '.</p>';
      }).join('') };
  }

  /* ======================================================================
     Audit log
     ====================================================================== */
  V.audit = function (mount) {
    var entries = S.audit();
    var integrity = S.auditIntegrity() || { intact: true };
    var broken = entries.filter(function (e) { return !e.ok; }).length;
    if (!integrity.intact && !broken) broken = 1;

    mount.innerHTML =
      head('Audit log', 'Every action written to the system, each entry hashed to the one before it.',
        '<button class="btn btn--ghost" data-act="export">' + SD.icon('download', 16) + 'Export signed CSV</button>') +

      '<section class="bento">' +
        '<article class="card col-4"><div class="card__head"><h2 class="card__title">' +
          SD.icon('shield', 17) + 'Chain status</h2>' +
          (broken ? '<span class="badge badge--danger">' + broken + ' break</span>'
                  : '<span class="badge badge--success">Intact</span>') + '</div>' +
          '<p class="muted" style="font-size:13px">' +
          (broken
            ? 'One entry does not hash to its predecessor. The record was altered or written out of sequence after the fact.'
            : 'Every entry hashes to the entry before it. No gaps and no rewrites.') + '</p>' +
          '<div style="margin-top:16px">' + SD.chainStrip(entries.slice(0, 12).map(function (e) {
            return e.ok ? 'ok' : 'broken';
          })) + '</div></article>' +

        '<article class="card col-8"><div class="card__head"><h2 class="card__title">' +
          SD.icon('file', 17) + 'Entries this session</h2>' +
          '<span class="mono table__sub">' + entries.length + ' records</span></div>' +
          '<div class="scroll-420">' + entries.map(function (e) {
            return '<div class="audit-row' + (e.ok ? '' : ' audit-row--bad') + '">' +
              '<div class="audit-row__seq">#' + String(e.seq).padStart(4, '0') + '</div>' +
              '<div><div class="audit-row__action">' + SD.esc(e.action) + ' · ' + SD.esc(e.target) + '</div>' +
                '<div class="audit-row__text">' + SD.esc(e.actor) +
                (e.detail ? ' — ' + SD.esc(e.detail) : '') + '</div>' +
                '<div class="audit-row__hash">' + SD.clock(e.at) + ' · ' +
                SD.esc(e.prevHash) + ' → ' + SD.esc(e.hash) + '</div>' +
              '</div></div>';
          }).join('') + '</div></article>' +
      '</section>';

    SD.stagger('.bento > .card');
    SD_APP.wireActions(mount, {});
  };

  /* ======================================================================
     Analytics
     ====================================================================== */
  V.analytics = function (mount) {
    var all = S.cases();
    var byCategory = {};
    all.forEach(function (c) { byCategory[c.category] = (byCategory[c.category] || 0) + 1; });

    var colours = ['#4F46E5', '#38BDF8', '#7C3AED', '#22C55E', '#F59E0B', '#EF4444'];
    var slices = Object.keys(byCategory).map(function (k, i) {
      return { label: k, value: byCategory[k], color: colours[i % colours.length] };
    });

    mount.innerHTML =
      head('Analytics', 'Docket volume, category mix and clearance trend for this station.') +
      '<section class="bento">' +
        '<article class="card col-8"><div class="card__head"><h2 class="card__title">' +
          SD.icon('activity', 17) + 'Opened against closed — 12 weeks</h2></div>' +
          SD.barChart([
            { label: 'Opened', color: '#4F46E5', values: S.caseTrend() },
            { label: 'Closed', color: '#22C55E', values: S.closureTrend() }
          ], S.caseTrend(), { height: 220 }) +
          '<div class="chart-x"><span>W1</span><span>W4</span><span>W8</span><span>W12</span></div>' +
          '<div class="chart-legend"><span><i style="background:#4F46E5"></i>Opened</span>' +
          '<span><i style="background:#22C55E"></i>Closed</span></div></article>' +

        '<article class="card col-4"><div class="card__head"><h2 class="card__title">' +
          SD.icon('chart', 17) + 'Crime category mix</h2></div>' +
          '<div class="donut-wrap">' + SD.donut(slices) + '</div>' +
          '<div class="donut-key" style="margin-top:20px">' + slices.map(function (s) {
            return '<div class="donut-key__row"><i style="background:' + s.color + '"></i>' +
                   '<span>' + SD.esc(s.label) + '</span><b>' + s.value + '</b></div>';
          }).join('') + '</div></article>' +

        '<article class="card col-12"><div class="card__head"><h2 class="card__title">' +
          SD.icon('building', 17) + 'Clearance by station</h2></div>' +
          S.stations().map(function (s) {
            var tone = s.clearance >= 70 ? 'success' : s.clearance >= 55 ? 'warning' : 'danger';
            return '<div class="load-row"><div>' +
              '<div style="font-size:13px;color:var(--text);font-weight:600">' + SD.esc(s.name) +
              ' <span class="mono muted-dim" style="font-weight:400">' + SD.esc(s.code) + '</span></div>' +
              '<div class="progress load-row__bar"><div class="progress__fill progress__fill--' + tone +
              '" data-value="' + s.clearance + '"></div></div></div>' +
              '<div class="load-row__num">' + s.clearance + '%</div></div>';
          }).join('') + '</article>' +
      '</section>';

    SD.stagger('.bento > .card');
    SD.animateMeters(mount);
  };

  /* ======================================================================
     AI workspace
     ====================================================================== */
  V.ai = function (mount) {
    mount.innerHTML =
      head('Investigation copilot', 'Ask about dockets, evidence gaps and next steps. Output is advisory.') +
      '<section class="bento">' + V._aiPanel('col-5') +
        '<article class="card col-7"><div class="card__head"><h2 class="card__title">' +
          SD.icon('ai', 17) + 'What the copilot can do</h2></div>' +
          [['Docket summary', 'Assembles a plain-language summary from the exhibits, statements and suspects actually on file.'],
           ['Missing evidence', 'Compares a docket against what similar dockets held when they reached prosecution.'],
           ['Duplicate detection', 'Flags dockets sharing a complainant, address or method within a short window.'],
           ['Investigation health', 'Scores completeness from real signals rather than an opinion.'],
           ['Next steps', 'Suggests the action most likely to move the docket, with a stated basis.'],
           ['Report drafting', 'Produces a first draft an officer must review and sign.']
          ].map(function (r) {
            return '<div class="kv"><div class="kv__k">' + r[0] + '</div>' +
                   '<div class="kv__v">' + r[1] + '</div></div>';
          }).join('') +
          '<div class="ai__note" style="margin-top:20px">' + SD.icon('alert', 14) +
          '<span>The copilot never closes a docket, never files a document and never alters ' +
          'evidence. It proposes; an authorised officer disposes, and the audit log records ' +
          'which of the two acted.</span></div>' +
        '</article>' +
      '</section>';

    SD.stagger('.bento > .card');
    SD_APP.wireAi(mount);
  };

  /* ======================================================================
     Station Administrator oversight — Super Administrator only
     ====================================================================== */
  V['admin-oversight'] = function (mount) {
    var admins = S.stationAdmins();
    var stations = S.stations();
    var covered = {};
    admins.forEach(function (a) { covered[a.stationCode] = true; });
    var uncovered = stations.filter(function (s) { return !covered[s.code]; });

    var active = admins.filter(function (a) { return a.status === 'active'; }).length;
    var quiet = admins.filter(function (a) {
      return a.lastLogin && (Date.now() - new Date(a.lastLogin).getTime()) > 7 * 86400000;
    }).length;
    var flagged = admins.filter(function (a) { return a.status !== 'active'; }).length;

    var summary =
      '<article class="card col-3 stat"><div class="stat__top"><span class="stat__label">Station Administrators</span>' +
      '<span class="stat__icon">' + SD.icon('shield', 17) + '</span></div>' +
      '<div class="stat__value" data-count="' + admins.length + '">0</div>' +
      '<div class="stat__foot"><span>across ' + stations.length + ' stations</span></div></article>' +

      '<article class="card col-3 stat stat--good"><div class="stat__top"><span class="stat__label">Active</span>' +
      '<span class="stat__icon">' + SD.icon('check', 17) + '</span></div>' +
      '<div class="stat__value" data-count="' + active + '">0</div>' +
      '<div class="stat__foot"><span>signed in recently</span></div></article>' +

      '<article class="card col-3 stat' + (quiet ? ' stat--warn' : '') + '"><div class="stat__top">' +
      '<span class="stat__label">Quiet (7+ days)</span><span class="stat__icon">' + SD.icon('clock', 17) + '</span></div>' +
      '<div class="stat__value" data-count="' + quiet + '">0</div>' +
      '<div class="stat__foot"><span>worth a check-in</span></div></article>' +

      '<article class="card col-3 stat' + (uncovered.length ? ' stat--alert' : '') + '"><div class="stat__top">' +
      '<span class="stat__label">Stations uncovered</span><span class="stat__icon">' + SD.icon('alert', 17) + '</span></div>' +
      '<div class="stat__value" data-count="' + uncovered.length + '">0</div>' +
      '<div class="stat__foot"><span>no Station Administrator assigned</span></div></article>';

    var rows = admins.map(function (a) {
      var quietRow = a.lastLogin && (Date.now() - new Date(a.lastLogin).getTime()) > 7 * 86400000;
      return '<tr>' +
        '<td><div class="who"><span class="avatar avatar--sm">' + SD.initials(a.name) + '</span>' +
        '<div><div class="who__name">' + SD.esc(a.name) + '</div>' +
        '<div class="who__role">' + SD.esc(a.rank) + ' \u00b7 ' + SD.esc(a.badge) + '</div></div></div></td>' +
        '<td><div class="table__sub">' + SD.esc(a.email) + '</div></td>' +
        '<td><div class="table__primary">' + SD.esc(a.station) + '</div>' +
        '<div class="table__sub mono">' + SD.esc(a.stationCode) + '</div></td>' +
        '<td class="mono">' + a.staffManaged + '</td>' +
        '<td class="mono">' + a.openCases + '</td>' +
        '<td>' + (a.status === 'active'
          ? (quietRow ? '<span class="badge badge--warning">Quiet</span>' : '<span class="badge badge--success">Active</span>')
          : '<span class="badge badge--danger">' + SD.esc(a.status) + '</span>') + '</td>' +
        '<td><div class="table__sub">' + (a.lastLogin ? SD.ago(a.lastLogin) : 'Never signed in') + '</div></td>' +
        '<td><button class="btn btn--ghost btn--sm" data-reset-admin="' + a.id + '" ' +
          'data-admin-name="' + SD.esc(a.name) + '">Reset password</button></td>' +
      '</tr>';
    }).join('');

    var uncoveredBlock = uncovered.length
      ? '<article class="card col-12"><div class="card__head"><h2 class="card__title">' +
        SD.icon('alert', 17) + 'Stations without a Station Administrator</h2></div>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Station</th><th>Province</th>' +
        '<th>Officers</th><th>Open dockets</th><th></th></tr></thead><tbody>' +
        uncovered.map(function (s) {
          return '<tr><td><div class="table__primary">' + SD.esc(s.name) + '</div>' +
            '<div class="table__sub mono">' + SD.esc(s.code) + '</div></td>' +
            '<td><div class="table__sub">' + SD.esc(s.province) + '</div></td>' +
            '<td class="mono">' + s.officers + '</td><td class="mono">' + s.open + '</td>' +
            '<td><button class="btn btn--ghost btn--sm" data-act="addUser">Assign administrator</button></td></tr>';
        }).join('') + '</tbody></table></div></article>'
      : '';

    mount.innerHTML =
      head('Station Administrators',
        'Every Station Administrator across the service, in one place \u2014 the Super Administrator\u2019s ' +
        'view of who is managing accounts and accountability at each station.',
        '<button class="btn btn--primary" data-act="addUser">' + SD.icon('plus', 16) + 'Add Station Administrator</button>') +
      '<section class="bento">' + summary +
        '<article class="card col-12"><div class="card__head"><h2 class="card__title">' + SD.icon('shield', 17) +
        'All Station Administrators</h2></div>' +
        (admins.length
          ? '<div class="table-wrap"><table class="table"><thead><tr><th>Administrator</th><th>Email</th>' +
            '<th>Station</th><th>Staff managed</th><th>Open dockets</th><th>Status</th><th>Last sign-in</th><th></th></tr></thead>' +
            '<tbody>' + rows + '</tbody></table></div>'
          : '<div class="empty">' + SD.icon('shield', 30) +
            '<div class="empty__title">No Station Administrators yet</div>' +
            '<p class="empty__body">Add one to delegate account management for a station, without granting national access.</p></div>') +
        '</article>' +
        uncoveredBlock +
      '</section>';

    SD.stagger('.bento > .card');
    SD.animateMeters(mount);

    SD.$$('[data-reset-admin]', mount).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.dataset.resetAdmin;
        var name = btn.dataset.adminName;
        SD.confirm('Reset password for ' + name + '?',
          'A new temporary password is issued and every session on this account is signed out immediately. ' +
          name + ' will be required to change it at next sign-in.',
          'Reset password',
          function () {
            SD_API.resetUserPassword(id).then(function (result) {
              SD.modal({
                title: 'Password reset',
                subtitle: name,
                body: '<p class="modal__copy">' + SD.esc(result.message) + '</p>' +
                  '<div class="report" style="margin-top:16px">' +
                    '<div class="eyebrow">Temporary password</div>' +
                    '<div class="mono" style="font-size:19px;color:var(--text);margin-top:6px">' +
                      SD.esc(result.temporaryPassword) + '</div>' +
                  '</div>',
                submitLabel: 'Done',
                onSubmit: function (x, close) { close(); }
              });
            }).catch(function (err) { SD.toast(err.message, 'warning'); });
          });
      });
    });

    SD_APP.wireActions(mount, {});
  };

  /* ======================================================================
     Settings
     ====================================================================== */
  V.settings = function (mount) {
    var u = S.user();
    mount.innerHTML =
      head('Settings', 'Your account, session and notification preferences.') +
      '<section class="bento">' +
        '<article class="card col-6"><div class="card__head"><h2 class="card__title">' +
          SD.icon('users', 17) + 'Account</h2></div>' +
          kv('Full name', SD.esc(u.name)) + kv('Rank', SD.esc(u.rank)) +
          kv('Badge number', '<span class="mono">' + SD.esc(u.badge) + '</span>') +
          kv('Service email', '<span class="mono">' + SD.esc(u.email) + '</span>') +
          kv('Role', '<span class="badge badge--info">' + SD.esc(u.roleLabel) + '</span>') +
          kv('Station', SD.esc(u.station)) + '</article>' +

        '<article class="card col-6"><div class="card__head"><h2 class="card__title">' +
          SD.icon('shield', 17) + 'Security</h2></div>' +
          kv('Multi-factor', '<span class="badge badge--warning">Not enrolled</span>') +
          kv('Password', S.isRemote()
            ? 'Hashed with bcrypt on the server'
            : '<span class="muted-dim">standalone mode — no server</span>') +
          kv('Session', S.isRemote()
            ? 'Access token 15 min · refresh token rotates'
            : 'Local only') +
          kv('Last sign-in', SD.dutyDate(new Date()) + ' · ' + SD.clock(new Date())) +
          '<div style="display:flex;gap:8px;margin-top:20px;flex-wrap:wrap">' +
            '<button class="btn btn--primary btn--sm" data-act="changePassword">Change password</button>' +
            '<button class="btn btn--ghost btn--sm" data-act="mfa">Enrol multi-factor</button>' +
            '<button class="btn btn--quiet btn--sm" data-act="signout">Sign out everywhere</button>' +
          '</div></article>' +
      '</section>';

    SD.stagger('.bento > .card');

    var change = SD.$('[data-act="changePassword"]', mount);
    if (change) change.addEventListener('click', function () { SD_APP.changePassword(); });

    var mfa = SD.$('[data-act="mfa"]', mount);
    if (mfa) mfa.addEventListener('click', function () {
      SD.toast('Multi-factor enrolment is issued by your station administrator', 'info');
    });
    var so = SD.$('[data-act="signout"]', mount);
    if (so) so.addEventListener('click', function () {
      SD.confirm('Sign out of every device?',
        'All active sessions on your badge will be closed immediately. On the server this revokes ' +
        'every refresh token issued to this account.',
        'Sign out everywhere', function () {
          if (S.isRemote()) SD_API.logout().then(function () { window.location.href = 'index.html'; });
          else window.location.href = 'index.html';
        });
    });
  };

  /* ======================================================================
     Helpers
     ====================================================================== */
  function kv(k, v) {
    return '<div class="kv"><div class="kv__k">' + k + '</div><div class="kv__v">' + v + '</div></div>';
  }

  function wireCaseRows(mount) {
    SD.$$('[data-open-case-row]', mount).forEach(function (tr) {
      tr.addEventListener('click', function () {
        window.location.hash = '#/cases/' + encodeURIComponent(tr.dataset.openCaseRow);
      });
    });
  }

})(window.SD_VIEWS, window.SD_STORE);
