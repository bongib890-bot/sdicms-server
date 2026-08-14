/* ==========================================================================
   SDICMS — Forms & overlays
   Modal dialogs, form field builders and value collection. Extends the SD
   namespace created in ui.js.
   ========================================================================== */

(function (SD) {
  'use strict';

  /* ------------------------------------------------------------------------
     Field builders
     Each returns markup with a data-name attribute so formValues() can read
     the whole form back without wiring per-field listeners.
     --------------------------------------------------------------------- */

  function label(text, hint) {
    return '<label class="fm__label">' + SD.esc(text) +
           (hint ? ' <span class="fm__hint">' + SD.esc(hint) + '</span>' : '') + '</label>';
  }

  SD.input = function (name, text, opts) {
    opts = opts || {};
    return '<div class="fm__row' + (opts.wide ? ' fm__row--wide' : '') + '">' + label(text, opts.hint) +
      '<input class="fm__control" data-name="' + name + '" type="' + (opts.type || 'text') + '" ' +
      'placeholder="' + SD.esc(opts.placeholder || '') + '" ' +
      'value="' + SD.esc(opts.value || '') + '"' + (opts.required ? ' data-required="1"' : '') + '>' +
      '<div class="fm__error"></div></div>';
  };

  SD.textarea = function (name, text, opts) {
    opts = opts || {};
    return '<div class="fm__row fm__row--wide">' + label(text, opts.hint) +
      '<textarea class="fm__control" data-name="' + name + '" rows="' + (opts.rows || 4) + '" ' +
      'placeholder="' + SD.esc(opts.placeholder || '') + '"' +
      (opts.required ? ' data-required="1"' : '') + '>' + SD.esc(opts.value || '') + '</textarea>' +
      '<div class="fm__error"></div></div>';
  };

  SD.select = function (name, text, options, opts) {
    opts = opts || {};
    var body = options.map(function (o) {
      var v = typeof o === 'string' ? o : o.value;
      var l = typeof o === 'string' ? o : o.label;
      return '<option value="' + SD.esc(v) + '"' + (opts.value === v ? ' selected' : '') + '>' +
             SD.esc(l) + '</option>';
    }).join('');
    return '<div class="fm__row' + (opts.wide ? ' fm__row--wide' : '') + '">' + label(text, opts.hint) +
      '<select class="fm__control" data-name="' + name + '"' +
      (opts.required ? ' data-required="1"' : '') + '>' + body + '</select>' +
      '<div class="fm__error"></div></div>';
  };

  /** File picker that reports the chosen file without uploading anything. */
  SD.filePicker = function (name, text) {
    return '<div class="fm__row fm__row--wide">' + label(text, 'Nothing leaves your machine in this prototype') +
      '<label class="drop" data-drop="' + name + '">' +
        SD.icon('download', 22) +
        '<span class="drop__title">Choose a file or drag it here</span>' +
        '<span class="drop__hint">Photographs, video, audio or documents up to 100 MB</span>' +
        '<input type="file" data-name="' + name + '" hidden>' +
      '</label><div class="fm__error"></div></div>';
  };

  /** Read every data-name control inside a root element into a plain object. */
  SD.formValues = function (root) {
    var out = {};
    SD.$$('[data-name]', root).forEach(function (el) {
      if (el.type === 'file') {
        out[el.dataset.name] = el.files && el.files[0] ? el.files[0].name : '';
        out[el.dataset.name + '_size'] = el.files && el.files[0]
          ? (el.files[0].size / 1048576).toFixed(1) + ' MB' : '';
      } else {
        out[el.dataset.name] = el.value.trim();
      }
    });
    return out;
  };

  /** Validate required controls, marking the ones that are empty. */
  SD.formValidate = function (root) {
    var ok = true;
    SD.$$('[data-required]', root).forEach(function (el) {
      var row = el.closest('.fm__row');
      var empty = !el.value.trim();
      row.classList.toggle('fm__row--error', empty);
      if (empty) {
        row.querySelector('.fm__error').textContent = 'This field is required.';
        ok = false;
      }
    });
    return ok;
  };

  /* ------------------------------------------------------------------------
     Modal
     opts: { title, subtitle, body, submitLabel, onSubmit(values, close), wide }
     --------------------------------------------------------------------- */
  SD.modal = function (opts) {
    var api = {};
    var back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML =
      '<div class="modal' + (opts.wide ? ' modal--wide' : '') + '" role="dialog" aria-modal="true">' +
        '<div class="modal__head">' +
          '<div><h2 class="modal__title">' + SD.esc(opts.title) + '</h2>' +
          (opts.subtitle ? '<p class="modal__sub">' + SD.esc(opts.subtitle) + '</p>' : '') + '</div>' +
          '<button class="icon-btn" data-close aria-label="Close">' + SD.icon('close', 16) + '</button>' +
        '</div>' +
        '<div class="modal__body">' + opts.body + '</div>' +
        '<div class="modal__foot">' +
          '<button class="btn btn--ghost" data-close>Cancel</button>' +
          (opts.submitLabel
            ? '<button class="btn btn--primary" data-submit>' + SD.esc(opts.submitLabel) + '</button>'
            : '') +
        '</div>' +
      '</div>';

    document.body.appendChild(back);
    document.body.style.overflow = 'hidden';

    function close() {
      back.style.opacity = '0';
      document.body.style.overflow = '';
      setTimeout(function () { back.remove(); }, 160);
      document.removeEventListener('keydown', onKey);
    }

    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);

    SD.$$('[data-close]', back).forEach(function (b) { b.addEventListener('click', close); });
    back.addEventListener('click', function (e) { if (e.target === back) close(); });

    var submit = SD.$('[data-submit]', back);
    if (submit) {
      submit.addEventListener('click', function () {
        var body = SD.$('.modal__body', back);
        if (!SD.formValidate(body)) return;
        // The modal itself is passed so a handler can reach the real File
        // object behind a picker, which formValues() cannot carry.
        opts.onSubmit(SD.formValues(body), close, api);
      });
    }

    // File picker feedback
    SD.$$('.drop', back).forEach(function (drop) {
      var input = drop.querySelector('input[type=file]');
      input.addEventListener('change', function () {
        if (input.files && input.files[0]) {
          drop.classList.add('drop--filled');
          drop.querySelector('.drop__title').textContent = input.files[0].name;
          drop.querySelector('.drop__hint').textContent =
            (input.files[0].size / 1048576).toFixed(1) + ' MB · ready to log';
        }
      });
    });

    var first = SD.$('.fm__control', back);
    if (first) setTimeout(function () { first.focus(); }, 60);

    api.close = close;
    api.el = back;
    return api;
  };

  /** Yes/no dialog for anything irreversible. */
  SD.confirm = function (title, message, confirmLabel, onYes) {
    SD.modal({
      title: title,
      body: '<p class="modal__copy">' + SD.esc(message) + '</p>',
      submitLabel: confirmLabel,
      onSubmit: function (v, close) { close(); onYes(); }
    });
  };

  /* ------------------------------------------------------------------------
     Tabs
     --------------------------------------------------------------------- */
  SD.tabs = function (items, active) {
    return '<div class="tabs" role="tablist">' + items.map(function (t) {
      return '<button class="tab' + (t.key === active ? ' tab--on' : '') + '" data-tab="' + t.key + '">' +
        SD.esc(t.label) +
        (t.count != null ? '<span class="tab__count">' + t.count + '</span>' : '') +
      '</button>';
    }).join('') + '</div>';
  };

})(window.SD);
