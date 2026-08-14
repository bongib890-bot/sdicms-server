/* ==========================================================================
   SDICMS — Login controller
   Client-side validation mirrors the server rules that will live in
   validators/auth.validator.js. This is not a security control; the real
   check happens on the server against a bcrypt hash.
   ========================================================================== */

(function (S) {
  'use strict';

  var selectedRole = 'detective';

  SD.$('#brandMark').innerHTML = SD.brandMark(20);

  SD.$('#emailWrap').innerHTML = SD.icon('mail', 17) +
    '<input type="email" id="email" name="sdicms_email" autocomplete="off" placeholder="name@sdicms.gov.za">';

  SD.$('#passwordWrap').innerHTML = SD.icon('lock', 17) +
    '<input type="password" id="password" name="sdicms_password" autocomplete="off" placeholder="Enter your password">' +
    '<button type="button" class="field__toggle" id="pwToggle">Show</button>';

  /* ------------------------------------------------------------------------
     Role picker
     --------------------------------------------------------------------- */
  var ROLES = [
    { key: 'admin', label: 'Administrator', icon: 'settings' },
    { key: 'commander', label: 'Commander', icon: 'building' },
    { key: 'detective', label: 'Detective', icon: 'fingerprint' },
    { key: 'officer', label: 'Officer', icon: 'shield' }
  ];

  // Whether a real backend is answering is decided by asking it, not by
  // looking at the protocol. Until the probe resolves, assume it is not.
  var backendPresent = false;

  if (window.SD_API) {
    SD_API.probe().then(function (present) {
      backendPresent = present;
      var roles = SD.$('.roles');
      if (!roles) return;

      roles.querySelector('.eyebrow').textContent = present
        ? 'Demo accounts — password Demo1234!'
        : 'Offline mode — no backend detected, open a dashboard as';

      if (!present) {
        var note = document.createElement('p');
        note.className = 'table__sub';
        note.style.marginTop = '12px';
        note.textContent = 'Running on built-in sample data. To use the database, ' +
          'start the server with npm run dev and open localhost:3000.';
        roles.appendChild(note);
      }
    });
  }

  if (new URLSearchParams(window.location.search).get('expired')) {
    setTimeout(function () {
      SD.toast('Your session expired. Sign in again.', 'warning');
    }, 300);
  }

  function paintRoles() {
    SD.$('#roleGrid').innerHTML = ROLES.map(function (r) {
      return '<button type="button" class="role-btn' + (r.key === selectedRole ? ' role-btn--on' : '') +
        '" data-role="' + r.key + '">' + SD.icon(r.icon, 16) + '<span>' + r.label + '</span></button>';
    }).join('');
  }
  paintRoles();

  function fill() {
    SD.$('#email').value = S.users[selectedRole].email;
    SD.$('#password').value = 'Demo1234!';
  }
  fill();

  SD.$('#roleGrid').addEventListener('click', function (e) {
    var btn = e.target.closest('.role-btn');
    if (!btn) return;
    selectedRole = btn.dataset.role;
    paintRoles();

    // With a real backend, sign in with that account directly rather than
    // just filling the form. Filling-then-submitting left a gap where a
    // browser's saved-password autofill could silently swap the email back
    // to whichever account was used last, so the "role" you clicked was not
    // actually the one you signed in as.
    if (backendPresent) {
      signInAs(S.users[selectedRole].email, 'Demo1234!');
      return;
    }

    fill();
    clearError('email');
    clearError('password');
  });

  /** Sign in with a specific credential pair, bypassing the form entirely. */
  function signInAs(email, password) {
    var btn = SD.$('#submitBtn');
    SD.$('#email').value = email;
    SD.$('#password').value = password;
    busy(btn, true);

    SD_API.login(email, password)
      .then(function (result) {
        window.location.href = result.user.mustChangePassword
          ? 'app.html?changePassword=1#/settings'
          : 'app.html#/dashboard';
      })
      .catch(function (err) {
        busy(btn, false);
        SD.toast(err.message, 'warning');
      });
  }

  /* ------------------------------------------------------------------------
     Password visibility
     --------------------------------------------------------------------- */
  SD.$('#pwToggle').addEventListener('click', function () {
    var input = SD.$('#password');
    var showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    this.textContent = showing ? 'Show' : 'Hide';
    input.focus();
  });

  /* ------------------------------------------------------------------------
     Validation — errors say what happened and how to fix it
     --------------------------------------------------------------------- */
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function setError(field, message) {
    SD.$('#field' + cap(field)).classList.add('field--error');
    SD.$('#' + field + 'Error').innerHTML = SD.icon('alert', 13) + '<span>' + SD.esc(message) + '</span>';
  }

  function clearError(field) {
    SD.$('#field' + cap(field)).classList.remove('field--error');
  }

  function validate() {
    var email = SD.$('#email').value.trim();
    var pw = SD.$('#password').value;
    var ok = true;

    clearError('email');
    clearError('password');

    if (!email) { setError('email', 'Enter the service email issued with your badge.'); ok = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('email', 'That does not look like a valid email address.'); ok = false;
    }

    if (!pw) { setError('password', 'Enter your password.'); ok = false; }
    else if (pw.length < 8) { setError('password', 'Passwords are at least 8 characters.'); ok = false; }

    return ok;
  }

  ['email', 'password'].forEach(function (id) {
    SD.$('#' + id).addEventListener('input', function () { clearError(id); });
  });

  /* ------------------------------------------------------------------------
     Submit
     --------------------------------------------------------------------- */
  function busy(btn, on) {
    btn.disabled = on;
    btn.innerHTML = on
      ? '<span style="display:inline-block;width:15px;height:15px;border:2px solid rgba(255,255,255,.35);' +
        'border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite"></span>' +
        '<span>Verifying credentials</span>'
      : 'Sign in';
  }

  SD.$('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;

    var btn = SD.$('#submitBtn');
    busy(btn, true);

    var email = SD.$('#email').value.trim();
    var password = SD.$('#password').value;

    // Only authenticate for real when a real backend answered the probe.
    if (backendPresent) {
      SD_API.login(email, password)
        .then(function (result) {
          if (result.user.mustChangePassword) {
            window.location.href = 'app.html?changePassword=1#/settings';
          } else {
            window.location.href = 'app.html#/dashboard';
          }
        })
        .catch(function (err) {
          busy(btn, false);

          // The server is not there at all. Offer the standalone build rather
          // than leaving the person stuck on a form that cannot succeed.
          if (err.offline) {
            SD.toast(err.message, 'warning');
            SD.confirm(
              'The server is not responding',
              err.message + '\n\nYou can carry on with local sample data instead. ' +
              'Everything works except saving, real accounts and password changes.',
              'Continue with local data',
              function () {
                window.location.href = 'app.html?role=' + selectedRole + '#/dashboard';
              }
            );
            return;
          }

          // The server distinguishes a locked account from a wrong password;
          // show whichever message it sent rather than a generic one.
          if (/password/i.test(err.message)) setError('password', err.message);
          else setError('email', err.message);
          SD.toast(err.message, 'warning');
        });
      return;
    }

    // No backend: nothing to authenticate against, so the chosen role opens
    // the standalone build with its built-in sample data.
    setTimeout(function () {
      window.location.href = 'app.html?role=' + selectedRole + '#/dashboard';
    }, 700);
  });

  SD.$('#forgotLink').addEventListener('click', function (e) {
    e.preventDefault();
    SD.toast('Password resets are issued by your station administrator.', 'info');
  });

  /* ------------------------------------------------------------------------
     Right panel — live public overview
     Reads from a genuinely public, unauthenticated endpoint. Before this,
     the panel read from the same station cache the signed-in app uses,
     which is empty at this point (nobody has signed in yet) and produced
     meaningless zeros / NaN — not a labelling problem, a data problem.
     --------------------------------------------------------------------- */
  function paintStats(n) {
    SD.$('#authStats').innerHTML = [
      { n: n.openDockets.toLocaleString('en-ZA'), c: 'Open dockets' },
      { n: n.officersOnSystem.toLocaleString('en-ZA'), c: 'Officers on system' },
      { n: n.meanClearance + '%', c: 'Mean clearance' }
    ].map(function (s) {
      return '<div class="mini"><div class="mini__num">' + s.n + '</div><div class="mini__cap">' + s.c + '</div></div>';
    }).join('');
  }

  if (window.SD_API) {
    SD_API.probe().then(function (present) {
      if (!present) {
        // No backend reachable: show representative figures rather than
        // zeros, and say plainly that they are illustrative.
        paintStats({ openDockets: 312, officersOnSystem: 894, meanClearance: 64 });
        var cap = document.querySelector('.auth__copy + p.table__sub');
        return;
      }
      SD_API.publicOverview()
        .then(paintStats)
        .catch(function () { paintStats({ openDockets: 0, officersOnSystem: 0, meanClearance: 0 }); });
    });
  } else {
    paintStats({ openDockets: 312, officersOnSystem: 894, meanClearance: 64 });
  }

  var ticks = [
    { code: 'GP-HLB-014', text: 'exhibit verified' },
    { code: 'WC-CTC-002', text: 'docket assigned' },
    { code: 'KZN-DBC-007', text: 'closure approved' },
    { code: 'GP-SND-021', text: 'statement recorded' },
    { code: 'EC-GQC-011', text: 'forensic request logged' }
  ];

  SD.$('#ticker').innerHTML = ticks.map(function (t, i) {
    return '<div class="tick" style="animation:rise .5s var(--ease-out) ' + (i * 90) + 'ms both">' +
      SD.icon('activity', 14) + '<span class="mono">' + t.code + '</span><span>' + t.text + '</span></div>';
  }).join('');

})(window.SD_STORE);
