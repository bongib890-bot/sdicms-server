/* ==========================================================================
   SDICMS — Application shell
   Hash routing, role-aware navigation, and the actions shared across views.
   ========================================================================== */

window.SD_APP = (function (S, V) {
  'use strict';

  var mount, current = '';

  /* ------------------------------------------------------------------------
     Navigation — each role sees only the sections it may act on
     --------------------------------------------------------------------- */
  var NAV = {
    admin: [
      { section: 'Overview' },
      { route: 'dashboard', icon: 'grid', label: 'Command centre' },
      { route: 'analytics', icon: 'chart', label: 'Analytics' },
      { section: 'Administration' },
      { route: 'admin-oversight', icon: 'shield', label: 'Station Administrators' },
      { route: 'officers', icon: 'users', label: 'Users & permissions' },
      { route: 'stations', icon: 'building', label: 'Stations' },
      { route: 'audit', icon: 'shield', label: 'Audit log' },
      { section: 'Casework' },
      { route: 'cases', icon: 'folder', label: 'Dockets' },
      { route: 'evidence', icon: 'evidence', label: 'Evidence' },
      { route: 'reports', icon: 'file', label: 'Reports' },
      { section: 'Intelligence' },
      { route: 'ai', icon: 'ai', label: 'AI copilot' },
      { route: 'settings', icon: 'settings', label: 'Settings' }
    ],
    station_admin: [
      { section: 'Overview' },
      { route: 'dashboard', icon: 'grid', label: 'Command centre' },
      { section: 'Station administration' },
      { route: 'officers', icon: 'users', label: 'My station\u2019s users' },
      { route: 'audit', icon: 'shield', label: 'Station audit log' },
      { route: 'evidence', icon: 'evidence', label: 'Evidence integrity' },
      { section: 'Casework' },
      { route: 'cases', icon: 'folder', label: 'Dockets' },
      { route: 'reports', icon: 'file', label: 'Reports' },
      { section: 'Intelligence' },
      { route: 'ai', icon: 'ai', label: 'AI copilot' },
      { route: 'settings', icon: 'settings', label: 'Settings' }
    ],
    commander: [
      { section: 'Overview' },
      { route: 'dashboard', icon: 'grid', label: 'Command centre' },
      { route: 'analytics', icon: 'chart', label: 'Station performance' },
      { section: 'Caseload' },
      { route: 'cases', icon: 'folder', label: 'All dockets' },
      { route: 'evidence', icon: 'evidence', label: 'Evidence' },
      { route: 'officers', icon: 'users', label: 'Detectives' },
      { section: 'Records' },
      { route: 'reports', icon: 'file', label: 'Reports' },
      { route: 'audit', icon: 'shield', label: 'Audit log' },
      { section: 'Intelligence' },
      { route: 'ai', icon: 'ai', label: 'AI copilot' },
      { route: 'settings', icon: 'settings', label: 'Settings' }
    ],
    detective: [
      { section: 'Investigations' },
      { route: 'dashboard', icon: 'grid', label: 'My command centre' },
      { route: 'cases', icon: 'folder', label: 'My dockets' },
      { section: 'Case work' },
      { route: 'evidence', icon: 'evidence', label: 'Evidence' },
      { route: 'suspects', icon: 'fingerprint', label: 'Suspects' },
      { route: 'statements', icon: 'file', label: 'Statements' },
      { route: 'reports', icon: 'chart', label: 'Reports' },
      { section: 'Intelligence' },
      { route: 'ai', icon: 'ai', label: 'AI copilot' },
      { route: 'settings', icon: 'settings', label: 'Settings' }
    ],
    officer: [
      { section: 'Duty' },
      { route: 'dashboard', icon: 'grid', label: 'My shift' },
      { route: 'cases', icon: 'folder', label: 'My complaints' },
      { section: 'Case work' },
      { route: 'evidence', icon: 'evidence', label: 'Evidence' },
      { route: 'statements', icon: 'file', label: 'Statements' },
      { section: 'Support' },
      { route: 'ai', icon: 'ai', label: 'AI copilot' },
      { route: 'settings', icon: 'settings', label: 'Settings' }
    ]
  };

  /** Live counts beside nav items, recalculated on every render. */
  function navCount(route) {
    var u = S.user();
    if (route === 'cases') return (u.role === 'detective' || u.role === 'officer' ? S.myCases() : S.cases()).length;
    if (route === 'evidence') return S.evidence().length;
    if (route === 'suspects') return S.suspects().length;
    if (route === 'statements') return S.statements().length;
    if (route === 'officers') return S.staff().length;
    if (route === 'stations') return S.stations().length;
    if (route === 'audit') return S.audit().length;
    return null;
  }

  function paintNav(activeRoute) {
    var u = S.user();
    SD.$('#nav').innerHTML = NAV[u.role].map(function (item) {
      if (item.section) return '<div class="nav__section eyebrow">' + item.section + '</div>';
      var count = navCount(item.route);
      return '<button class="nav__item' + (item.route === activeRoute ? ' nav__item--active' : '') +
        '" data-route="' + item.route + '">' + SD.icon(item.icon, 18) +
        '<span>' + SD.esc(item.label) + '</span>' +
        (count != null ? '<span class="nav__count">' + count + '</span>' : '') + '</button>';
    }).join('');

    SD.$$('.nav__item').forEach(function (b) {
      b.addEventListener('click', function () { go(b.dataset.route); });
    });
  }

  function paintChrome() {
    var u = S.user();
    SD.$('#brandMark').innerHTML = SD.brandMark(20);
    SD.$('#brandSub').textContent = u.roleLabel;
    SD.$('#menuBtn').innerHTML = SD.icon('menu', 18);
    SD.$('#aiBtn').innerHTML = SD.icon('ai', 18);
    SD.$('#bellBtn').innerHTML = SD.icon('bell', 18) + '<span class="icon-btn__dot"></span>';
    SD.$('#searchIcon').innerHTML = SD.icon('search', 16);

    SD.$('#stationTag').innerHTML =
      '<div class="stat__icon" style="width:30px;height:30px;flex:0 0 30px">' + SD.icon('pin', 15) + '</div>' +
      '<div style="min-width:0"><div class="station-tag__name">' +
        SD.esc(u.station.replace(' Police Station', '')) + '</div>' +
      '<div class="station-tag__code mono muted-dim">' + SD.esc(u.stationCode) + '</div></div>';

    SD.$('#profile').innerHTML =
      '<div class="avatar">' + SD.initials(u.name) + '</div>' +
      '<div style="min-width:0"><div class="who__name">' + SD.esc(u.name) + '</div>' +
      '<div class="who__role">' + SD.esc(u.rank) + '</div></div>' + SD.icon('chevron', 15);
  }

  /* ------------------------------------------------------------------------
     Router
     --------------------------------------------------------------------- */
  function parseHash() {
    var raw = (window.location.hash || '#/dashboard').replace(/^#\/?/, '');
    var parts = raw.split('/').filter(Boolean);
    return { route: parts[0] || 'dashboard', param: parts[1] ? decodeURIComponent(parts[1]) : null };
  }

  function go(route, param) {
    window.location.hash = '#/' + route + (param ? '/' + encodeURIComponent(param) : '');
  }

  function render() {
    var r = parseHash();
    current = r.route;
    paintNav(r.route);

    mount.innerHTML = '';
    window.scrollTo({ top: 0 });

    // A screen that throws while building its HTML must not leave a blank
    // page with no explanation. Catch it, show what broke, and keep the
    // rest of the app (sidebar, search, sign-out) usable.
    try {
      if (r.route === 'cases' && r.param) V.case(mount, r.param);
      else if (r.route === 'evidence' && r.param) V.exhibit(mount, r.param);
      else if (V[r.route]) V[r.route](mount);
      else V.dashboard(mount);
    } catch (err) {
      console.error('Screen "' + r.route + '" failed to render:', err);
      mount.innerHTML =
        '<article class="card"><div class="empty">' + SD.icon('alert', 30) +
        '<div class="empty__title">This screen hit a problem</div>' +
        '<p class="empty__body">' + SD.esc(err.message) + '</p>' +
        '<p class="table__sub" style="margin-top:8px">Full detail is in the browser console (F12).</p>' +
        '<button class="btn btn--ghost btn--sm" data-go="dashboard">Back to dashboard</button>' +
        '</div></article>';
      SD.$$('[data-go]', mount).forEach(function (b) {
        b.addEventListener('click', function () { go(b.dataset.go); });
      });
      return;
    }

    wireGlobal(mount);
    wireAi(mount);
  }

  /* ------------------------------------------------------------------------
     Global click handling shared by every view
     --------------------------------------------------------------------- */
  function wireGlobal(root) {
    SD.$$('[data-go]', root).forEach(function (b) {
      b.addEventListener('click', function () { go(b.dataset.go); });
    });

    SD.$$('[data-case]', root).forEach(function (tr) {
      tr.addEventListener('click', function () { go('cases', tr.dataset.case); });
    });

    SD.$$('[data-open-case]', root).forEach(function (b) {
      b.addEventListener('click', function () { go('cases', b.dataset.openCase); });
    });

    wireActions(root, {});
  }

  /* ------------------------------------------------------------------------
     Actions — the modals that create and change things
     ctx: { caseNo, after }
     --------------------------------------------------------------------- */
  var CATEGORIES = ['Contact crime', 'Property-related', 'Commercial crime', 'Drug-related', 'Sexual offence', 'Other'];
  var PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

  function caseOptions() {
    return S.cases().map(function (c) { return { value: c.no, label: c.no + ' — ' + c.title }; });
  }

  /** Pull the real File object out of a modal's picker so it can be posted. */
  function fileFrom(modal, name) {
    if (!modal || !modal.el) return null;
    var input = modal.el.querySelector('input[type=file][data-name="' + name + '"]');
    return input && input.files && input.files[0] ? input.files[0] : null;
  }

  /**
   * Turn a rejected request into something the person can act on. Field-level
   * detail from the server is shown against the field that caused it.
   */
  function showFormError(err) {
    var modal = SD.$('.modal-back');
    if (modal && err.details) {
      Object.keys(err.details).forEach(function (field) {
        var control = modal.querySelector('[data-name="' + field + '"]');
        if (!control) return;
        var row = control.closest('.fm__row');
        row.classList.add('fm__row--error');
        row.querySelector('.fm__error').textContent = err.details[field];
      });
    }
    SD.toast(err.message || 'That did not go through.', 'warning');
  }

  /** Change your own password. Requires the current one. */
  function openChangePassword() {
    SD.modal({
      title: 'Change your password',
      subtitle: 'Every other device signed in on this account will be signed out',
      body: '<div class="fm">' +
        SD.input('currentPassword', 'Current password', { required: true, type: 'password', wide: true }) +
        SD.input('newPassword', 'New password', { required: true, type: 'password', wide: true,
          hint: 'at least 10 characters, with upper case, lower case and a digit' }) +
        SD.input('confirmPassword', 'Confirm new password', { required: true, type: 'password', wide: true }) +
      '</div>',
      submitLabel: 'Change password',
      onSubmit: function (v, close) {
        if (v.newPassword !== v.confirmPassword) {
          SD.toast('The two new passwords do not match.', 'warning');
          return;
        }
        S.changePassword(v.currentPassword, v.newPassword, v.confirmPassword)
          .then(function () {
            close();
            SD.toast('Password changed. Other sessions have been signed out.', 'success');
          })
          .catch(showFormError);
      }
    });
  }

  function wireActions(root, ctx) {
    ctx = ctx || {};
    var after = ctx.after || render;

    SD.$$('[data-act]', root).forEach(function (btn) {
      if (btn.dataset.wired) return;
      btn.dataset.wired = '1';

      btn.addEventListener('click', function () {
        var act = btn.dataset.act;

        if (act.indexOf('go:') === 0) { go(act.slice(3)); return; }

        /* --- open a new docket --- */
        if (act === 'newCase') {
          SD.modal({
            title: 'Open a new docket',
            subtitle: 'A case number is issued automatically in SAPS format',
            wide: true,
            body: '<div class="fm">' +
              SD.input('title', 'Docket title', { required: true, wide: true, placeholder: 'Armed robbery — Pretoria Street spaza' }) +
              SD.select('category', 'Crime category', CATEGORIES, { required: true }) +
              SD.select('priority', 'Priority', PRIORITIES, { required: true, value: 'Medium' }) +
              SD.input('location', 'Location of incident', { required: true, wide: true, placeholder: '114 Pretoria Street, Hillbrow' }) +
              SD.input('complainant', 'Complainant full name', { required: true }) +
              SD.input('phone', 'Contact number', { placeholder: '072 000 0000' }) +
              SD.input('complainantId', 'Identity number', { hint: 'masked on display', placeholder: '8503125000000' }) +
              SD.textarea('description', 'What happened', { required: true, wide: true, rows: 5,
                placeholder: 'Narrative as reported by the complainant.' }) +
            '</div>',
            submitLabel: 'Register docket',
            onSubmit: function (v, close) {
              S.createCase(v).then(function (c) {
                close();
                SD.toast('Docket ' + c.no + ' registered', 'success');
                go('cases', c.no);
              }).catch(showFormError);
            }
          });
        }

        /* --- log an exhibit --- */
        if (act === 'addEvidence') {
          SD.modal({
            title: 'Log an exhibit',
            subtitle: 'The exhibit is hashed and a custody chain is opened',
            wide: true,
            body: '<div class="fm">' +
              SD.select('caseNo', 'Attach to docket', caseOptions(), { required: true, wide: true, value: ctx.caseNo }) +
              SD.input('label', 'Exhibit description', { required: true, wide: true, placeholder: 'Scene photograph set (7 frames)' }) +
              SD.select('type', 'Exhibit type', ['Photograph', 'Video', 'Audio', 'Document', 'Physical', 'Digital'], { required: true }) +
              SD.select('storage', 'Storage location', ['Exhibit store A', 'Exhibit store B', 'Digital vault', 'Forensic Services'], { required: true }) +
              SD.input('source', 'Received from', { placeholder: 'Scene, complainant, store manager' }) +
              SD.filePicker('file', 'Attach file') +
            '</div>',
            submitLabel: 'Log and seal',
            onSubmit: function (v, close, modal) {
              v.size = v.file_size || '—';
              v.fileHandle = fileFrom(modal, 'file');
              S.addEvidence(v).then(function (e) {
                close();
                SD.toast('Exhibit ' + e.id + ' logged' +
                  (e.sha256 ? ' · sha256 ' + e.sha256 : ' and hashed'), 'success');
                after();
              }).catch(showFormError);
            }
          });
        }

        /* --- add a suspect --- */
        if (act === 'addSuspect') {
          SD.modal({
            title: 'Add suspect profile',
            body: '<div class="fm">' +
              SD.select('caseNo', 'Docket', caseOptions(), { required: true, wide: true, value: ctx.caseNo }) +
              SD.input('name', 'Name or description', { required: true, wide: true, placeholder: 'Unknown male, approx 1.8 m' }) +
              SD.input('age', 'Apparent age', { placeholder: '25–30' }) +
              SD.select('status', 'Status', ['Sought', 'Detained', 'Arrested', 'Charged', 'Released'], { required: true }) +
              SD.textarea('note', 'Identifying detail', { wide: true, rows: 3,
                placeholder: 'Clothing, marks, vehicle, known associates.' }) +
            '</div>',
            submitLabel: 'Add suspect',
            onSubmit: function (v, close) {
              S.addSuspect(v).then(function (s) {
                close();
                SD.toast('Suspect ' + s.id + ' linked to ' + v.caseNo, 'success');
                after();
              }).catch(showFormError);
            }
          });
        }

        /* --- record a statement --- */
        if (act === 'addStatement') {
          SD.modal({
            title: 'Record a statement',
            subtitle: 'Saved as a draft until the deponent signs',
            wide: true,
            body: '<div class="fm">' +
              SD.select('caseNo', 'Docket', caseOptions(), { required: true, wide: true, value: ctx.caseNo }) +
              SD.input('deponent', 'Deponent full name', { required: true }) +
              SD.select('kind', 'Statement type', ['Complainant', 'Witness', 'Suspect', 'Officer'], { required: true }) +
              SD.textarea('body', 'Statement', { required: true, wide: true, rows: 6,
                placeholder: 'Record the account in the deponent\u2019s own words.' }) +
            '</div>',
            submitLabel: 'Save statement',
            onSubmit: function (v, close) {
              S.addStatement(v).then(function (s) {
                close();
                SD.toast('Statement ' + s.id + ' saved as draft', 'success');
                after();
              }).catch(showFormError);
            }
          });
        }

        /* --- add a user --- */
        if (act === 'addUser') {
          var actorRole = S.user().role;
          var isStationAdmin = actorRole === 'station_admin';

          // A Station Administrator may only staff their own station with
          // Officers or Detectives — the server enforces this too, but the
          // form should not offer a choice that will only be refused.
          var roleOptions = isStationAdmin
            ? [
                { value: 'officer', label: 'Police Officer' },
                { value: 'detective', label: 'Detective' }
              ]
            : [
                { value: 'officer', label: 'Police Officer' },
                { value: 'detective', label: 'Detective' },
                { value: 'commander', label: 'Station Commander' },
                { value: 'station_admin', label: 'Station Administrator' },
                { value: 'admin', label: 'Super Administrator' }
              ];

          SD.modal({
            title: isStationAdmin ? 'Add a user to ' + S.user().station : 'Add a user',
            subtitle: 'A temporary password is issued; the user must change it at first sign-in',
            wide: true,
            body: '<div class="fm">' +
              SD.input('name', 'Full name', { required: true, placeholder: 'Thabo Nkosi' }) +
              SD.input('badge', 'Badge number', { required: true, placeholder: 'SA-0000',
                hint: 'format SA-0000' }) +
              SD.input('rank', 'Rank or job title', { required: true, placeholder: 'Constable' }) +
              SD.select('role', 'Role', roleOptions, { required: true }) +
              (isStationAdmin ? '' : SD.select('stationId', 'Station', S.stations().map(function (st, i) {
                return { value: String(st.id || i + 1), label: st.name + ' · ' + st.code };
              }), { required: true })) +
              SD.input('email', 'Service email', { required: true, wide: true, type: 'email',
                placeholder: 'name@sdicms.gov.za' }) +
            '</div>',
            submitLabel: 'Create account',
            onSubmit: function (v, close) {
              S.createUser(v).then(function (result) {
                close();
                // The temporary password is shown once, to be handed over in
                // person. It is never emailed and never stored in plain text.
                SD.modal({
                  title: 'Account created',
                  subtitle: result.user.name + ' · ' + v.badge,
                  body: '<p class="modal__copy">' + SD.esc(result.message) + '</p>' +
                    '<div class="report" style="margin-top:16px">' +
                      '<div class="eyebrow">Temporary password</div>' +
                      '<div class="mono" style="font-size:19px;color:var(--text);margin-top:6px">' +
                        SD.esc(result.temporaryPassword) + '</div>' +
                      '<p class="table__sub" style="margin-top:12px">Hand this over in person. ' +
                      'It is shown once, is not emailed, and must be changed at first sign-in.</p>' +
                    '</div>',
                  submitLabel: 'Done',
                  onSubmit: function (x, closeInner) { closeInner(); }
                });
                after();
              }).catch(showFormError);
            }
          });
        }

        /* --- upload a document to a docket --- */
        if (act === 'uploadDocument') {
          SD.modal({
            title: 'Upload a document',
            subtitle: 'Charge sheets, warrants, forensic reports and correspondence',
            wide: true,
            body: '<div class="fm">' +
              SD.select('caseNo', 'Attach to docket', caseOptions(), { required: true, wide: true, value: ctx.caseNo }) +
              SD.input('title', 'Document title', { required: true, wide: true, placeholder: 'Ballistics report FSL-2026-11842' }) +
              SD.select('docType', 'Document type', ['Docket cover', 'Charge sheet', 'Warrant',
                'Forensic report', 'Court document', 'Correspondence', 'Other'], { required: true }) +
              SD.filePicker('file', 'Attach file') +
            '</div>',
            submitLabel: 'Upload and hash',
            onSubmit: function (v, close, modal) {
              v.size = v.file_size || '—';
              v.fileHandle = fileFrom(modal, 'file');
              if (S.isRemote() && !v.fileHandle) {
                SD.toast('Choose a file before uploading.', 'warning');
                return;
              }
              S.uploadDocument(v).then(function (doc) {
                close();
                SD.toast('Document filed · sha256 ' + (doc.sha256 || 'recorded'), 'success');
                after();
              }).catch(showFormError);
            }
          });
        }

        if (act === 'export') {
          SD.toast('Export queued. A signed PDF would download here.', 'success');
          S.writeAudit(S.user().rank + ' ' + S.user().name, 'EXPORT', current, 'Export requested');
        }

        if (act === 'handover') {
          SD.modal({
            title: 'Shift handover',
            subtitle: SD.dutyDate(new Date()) + ' · ' + SD.clock(new Date()),
            body: '<div class="report">' +
              '<h3>Handover summary</h3>' +
              '<div class="report__rule"></div>' +
              '<p>' + S.myCases().length + ' docket(s) carried. ' +
              S.cases().filter(S.isOverdue).length + ' past the 30-day standard. ' +
              S.evidence().filter(function (e) { return e.status !== 'Verified'; }).length +
              ' exhibit(s) awaiting verification.</p>' +
              '<div class="report__sec"><b>Actions this session</b>' +
              S.audit().slice(0, 5).map(function (a) {
                return '<p><span class="mono">' + SD.clock(a.at) + '</span> ' + SD.esc(a.action) +
                       ' on ' + SD.esc(a.target) + '</p>';
              }).join('') + '</div></div>',
            submitLabel: 'Submit handover',
            onSubmit: function (v, close) {
              S.writeAudit(S.user().rank + ' ' + S.user().name, 'HANDOVER', 'shift', 'Handover submitted');
              close();
              SD.toast('Handover submitted to the duty commander', 'success');
            }
          });
        }
      });
    });
  }

  /* ------------------------------------------------------------------------
     Copilot wiring — insight actions and the conversation box
     --------------------------------------------------------------------- */
  var REPLIES = [
    'Checked the docket: the exhibits are logged and the custody chain is unbroken, but no complainant statement has been signed. That is the gap most likely to delay this one.',
    'Three dockets at this station have passed the 30-day standard. The oldest carries only two exhibits, which usually means the scene was not fully worked.',
    'Comparing this against similar dockets that reached prosecution, the item normally present by this stage and missing here is the CCTV request.',
    'I can draft that, but a detective has to review and sign it before it enters the docket. Nothing I write is filed on its own.',
    'The completeness score is driven by statements, exhibits, suspects and recent activity. Adding a signed statement would move it more than anything else right now.'
  ];

  function wireAi(root) {
    SD.$$('[data-ai-act]', root).forEach(function (b) {
      if (b.dataset.wired) return;
      b.dataset.wired = '1';
      b.addEventListener('click', function () {
        var ref = b.dataset.aiRef;
        S.resolveInsight(b.dataset.aiId, 'accepted');
        SD.toast('Recorded: ' + b.dataset.aiAct + '. Awaiting your signature.', 'success');
        if (ref && ref.indexOf('CAS') === 0) go('cases', ref);
      });
    });

    SD.$$('[data-ai-dismiss]', root).forEach(function (b) {
      if (b.dataset.wired) return;
      b.dataset.wired = '1';
      b.addEventListener('click', function () {
        var card = b.closest('.insight');
        card.style.transition = 'opacity 200ms, transform 200ms';
        card.style.opacity = '0';
        card.style.transform = 'translateX(12px)';
        setTimeout(function () { card.remove(); }, 200);
        S.resolveInsight(b.dataset.aiId, 'dismissed');
        SD.toast('Suggestion dismissed and logged', 'info');
      });
    });

    var input = SD.$('#aiInput', root);
    var send = SD.$('#aiSend', root);
    if (!input || !send || input.dataset.wired) return;
    input.dataset.wired = '1';

    function ask() {
      var q = input.value.trim();
      if (!q) return;
      input.value = '';

      var body = SD.$('#aiBody', root);
      var mine = document.createElement('div');
      mine.className = 'insight';
      mine.innerHTML = '<div class="insight__top"><span class="insight__kind">You asked</span></div>' +
                       '<p class="insight__text">' + SD.esc(q) + '</p>';
      body.prepend(mine);

      var answer = document.createElement('div');
      answer.className = 'insight';
      answer.innerHTML = '<div class="insight__top"><span class="insight__kind">Copilot</span>' +
                         '<span class="insight__conf">thinking…</span></div>' +
                         '<p class="insight__text" data-answer="1"></p>';
      body.prepend(answer);

      S.askAssistant(q).then(function (reply) {
        answer.querySelector('.insight__conf').textContent = 'advisory';
        SD.typeOut(answer.querySelector('[data-answer]'), reply);
      }).catch(function () {
        answer.querySelector('.insight__conf').textContent = 'unavailable';
        answer.querySelector('[data-answer]').textContent =
          'The copilot could not be reached. Everything else keeps working.';
      });
    }

    send.addEventListener('click', ask);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') ask(); });
  }

  /* ------------------------------------------------------------------------
     Boot
     --------------------------------------------------------------------- */
  function boot() {
    mount = SD.$('#view');

    var params = new URLSearchParams(window.location.search);

    // One call fills the whole client cache: from the API when the page is
    // served and a session exists, otherwise from standalone seed data.
    mount.innerHTML = '<div class="card"><div class="skel skel--title"></div>' +
      '<div class="skel skel--line"></div><div class="skel skel--line" style="width:60%"></div></div>';

    S.init(params.get('role') || 'detective').then(function (result) {
      startShell(result, params);
    });
  }

  function startShell(result, params) {
    // A backend is there, but this browser holds no session. Send them to
    // sign in rather than showing an empty shell.
    if (result.mode === 'needsLogin') {
      window.location.href = 'index.html';
      return;
    }

    if (result.mode === 'standalone' && result.reason) {
      SD.toast(result.reason, 'warning');
    }

    paintChrome();

    /* Topbar */
    SD.$('#menuBtn').addEventListener('click', function () {
      var bar = SD.$('#sidebar');
      bar.classList.add('sidebar--open');
      var scrim = document.createElement('div');
      scrim.className = 'scrim';
      scrim.addEventListener('click', function () { bar.classList.remove('sidebar--open'); scrim.remove(); });
      document.body.appendChild(scrim);
    });

    SD.$('#aiBtn').addEventListener('click', function () { go('ai'); });
    SD.$('#bellBtn').addEventListener('click', function () {
      SD.modal({
        title: 'Alerts',
        body: S.notifications().map(function (n) {
          return '<div class="note-item note-item--' + n.kind + '">' +
            '<span class="note-item__icon">' + SD.icon(n.icon, 15) + '</span>' +
            '<div><div class="note-item__text">' + SD.esc(n.text) + '</div>' +
            '<div class="note-item__time">' + SD.ago(n.mins) + '</div></div></div>';
        }).join('')
      });
    });

    /* Global search jumps straight to a matching docket. */
    var search = SD.$('#globalSearch');
    search.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var q = this.value.trim().toLowerCase();
      if (!q) return;
      var hit = S.cases().filter(function (c) {
        return (c.no + ' ' + c.title + ' ' + c.category).toLowerCase().indexOf(q) > -1;
      })[0];
      if (hit) { go('cases', hit.no); this.value = ''; }
      else { SD.toast('Nothing on the register matches “' + q + '”', 'info'); }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' &&
          document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        search.focus();
      }
    });

    /* Profile menu */
    SD.$('#profile').addEventListener('click', function () {
      var open = SD.$('.menu');
      if (open) { open.remove(); return; }
      var u = S.user();
      var menu = document.createElement('div');
      menu.className = 'menu';
      menu.innerHTML =
        '<div class="menu__head"><div class="who">' +
          '<div class="avatar avatar--lg">' + SD.initials(u.name) + '</div>' +
          '<div><div class="who__name">' + SD.esc(u.name) + '</div>' +
          '<div class="who__role mono">' + SD.esc(u.badge) + '</div></div></div></div>' +
        '<button class="menu__item" data-menu="settings">' + SD.icon('users', 16) + 'My profile</button>' +
        '<button class="menu__item" data-menu="settings">' + SD.icon('shield', 16) + 'Security &amp; sessions</button>' +
        '<button class="menu__item" data-menu="password">' + SD.icon('lock', 16) + 'Change password</button>' +
        '<div class="menu__sep"></div>' +
        '<button class="menu__item menu__item--danger" data-menu="out">' + SD.icon('logout', 16) + 'Sign out</button>';
      this.appendChild(menu);

      SD.$$('[data-menu]', menu).forEach(function (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          menu.remove();
          if (b.dataset.menu === 'password') { openChangePassword(); return; }
          if (b.dataset.menu === 'out') {
            if (S.isRemote()) SD_API.logout().then(function () { window.location.href = 'index.html'; });
            else window.location.href = 'index.html';
          }
          else go('settings');
        });
      });
      menu.addEventListener('click', function (e) { e.stopPropagation(); });
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('#profile')) {
        var m = SD.$('.menu');
        if (m) m.remove();
      }
    });

    window.addEventListener('hashchange', render);
    if (!window.location.hash) window.location.hash = '#/dashboard';
    render();

    setTimeout(function () {
      SD.toast('Signed in as ' + S.user().roleLabel + ' · ' + S.user().badge +
               (S.isRemote() ? '' : ' · local data'), 'success');
    }, 500);

    // An administrator-issued password must be changed before anything else.
    if (params.get('changePassword')) {
      setTimeout(openChangePassword, 700);
    }
  }

  return {
    boot: boot, go: go, render: render,
    wireActions: wireActions, wireAi: wireAi,
    changePassword: openChangePassword, showFormError: showFormError
  };

})(window.SD_STORE, window.SD_VIEWS);

document.addEventListener('DOMContentLoaded', function () { SD_APP.boot(); });
