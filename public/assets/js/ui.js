/* ==========================================================================
   SDICMS — UI library
   Icons, DOM helpers, formatters, chart renderers and micro-interactions.
   Loaded as a classic script so the prototype runs from file:// with no
   server. Everything is namespaced on window.SD.
   ========================================================================== */

window.SD = (function () {
  'use strict';

  /* ------------------------------------------------------------------------
     Icon set
     Stroke-based 24x24 paths, drawn inline so there is no icon font, no
     network request, and colour is inherited from the parent.
     --------------------------------------------------------------------- */
  var PATHS = {
    grid:     '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
    folder:   '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.2l2 2.2h7.8A2.5 2.5 0 0 1 21 9.7v7.8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z"/>',
    evidence: '<path d="M12 3l8.5 4.4v9.2L12 21l-8.5-4.4V7.4z"/><path d="M3.5 7.4L12 11.8l8.5-4.4"/><path d="M12 11.8V21"/>',
    users:    '<circle cx="9.5" cy="8" r="3.2"/><path d="M3.5 20a6 6 0 0 1 12 0"/><path d="M16.5 5.4a3.2 3.2 0 0 1 0 6.2"/><path d="M17.5 14.4A5.6 5.6 0 0 1 21 20"/>',
    chart:    '<path d="M3.5 20h17"/><rect x="5" y="12" width="3.4" height="5"/><rect x="10.3" y="7.5" width="3.4" height="9.5"/><rect x="15.6" y="10" width="3.4" height="7"/>',
    clock:    '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.2 2"/>',
    bell:     '<path d="M18 9a6 6 0 1 0-12 0c0 6.4-2.6 7.6-2.6 7.6h17.2S18 15.4 18 9"/><path d="M10.4 20a2 2 0 0 0 3.2 0"/>',
    search:   '<circle cx="11" cy="11" r="7"/><path d="M20.2 20.2l-4-4"/>',
    logout:   '<path d="M9.5 20.5H5.6A2.1 2.1 0 0 1 3.5 18.4V5.6a2.1 2.1 0 0 1 2.1-2.1h3.9"/><path d="M16 16.5l4.5-4.5L16 7.5"/><path d="M20.5 12H9.5"/>',
    ai:       '<path d="M12 3.2l1.9 4.9 4.9 1.9-4.9 1.9L12 16.8l-1.9-4.9-4.9-1.9 4.9-1.9z"/><path d="M18.6 15.2l.85 2.15 2.15.85-2.15.85-.85 2.15-.85-2.15-2.15-.85 2.15-.85z"/>',
    alert:    '<path d="M12 3.6L2.6 20.4h18.8z"/><path d="M12 10v4.2"/><path d="M12 17.4h.01"/>',
    check:    '<path d="M4.5 12.5l5 5 10-11"/>',
    plus:     '<path d="M12 5v14"/><path d="M5 12h14"/>',
    shield:   '<path d="M12 3.2l8 3v6.2c0 5-3.6 8.2-8 9.4-4.4-1.2-8-4.4-8-9.4V6.2z"/><path d="M9 12.2l2.2 2.2 4-4.2"/>',
    file:     '<path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z"/><path d="M14 3.5V8h4.5"/>',
    pin:      '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
    settings: '<circle cx="12" cy="12" r="3.1"/><path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.4 5.4l1.9 1.9M16.7 16.7l1.9 1.9M18.6 5.4l-1.9 1.9M7.3 16.7l-1.9 1.9"/>',
    scale:    '<path d="M12 3.5v17"/><path d="M6 6.5h12"/><path d="M6 6.5L3 13h6z"/><path d="M18 6.5L15 13h6z"/><path d="M8.5 20.5h7"/>',
    arrowUp:  '<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>',
    arrowDown:'<path d="M12 5v14"/><path d="M6 13l6 6 6-6"/>',
    arrowRight:'<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
    chevron:  '<path d="M6 9.5l6 6 6-6"/>',
    menu:     '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
    lock:     '<rect x="4.5" y="10.5" width="15" height="10" rx="2.2"/><path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9"/>',
    mail:     '<rect x="3" y="5.5" width="18" height="13" rx="2.2"/><path d="M3.6 6.8l8.4 6 8.4-6"/>',
    camera:   '<path d="M3.5 8.5h3.2l1.6-2.4h7.4l1.6 2.4h3.2v10a1.6 1.6 0 0 1-1.6 1.6H5.1a1.6 1.6 0 0 1-1.6-1.6z"/><circle cx="12" cy="13.6" r="3.4"/>',
    activity: '<path d="M3 12h4l2.5-7 5 14 2.5-7h4"/>',
    building: '<path d="M4 20.5V6.2L12 3l8 3.2v14.3"/><path d="M4 20.5h16"/><path d="M9.5 20.5v-5h5v5"/><path d="M8.5 9.5h1.5M14 9.5h1.5M8.5 12.5h1.5M14 12.5h1.5"/>',
    fingerprint:'<path d="M12 4.5c-3.6 0-6.5 2.7-6.5 6v2.2"/><path d="M12 4.5c3.6 0 6.5 2.7 6.5 6 0 3.4-.6 6.3-1.6 8.6"/><path d="M8.8 10.5a3.2 3.2 0 0 1 6.4 0c0 4-.7 6.9-1.9 9.2"/><path d="M12 10.4v3.2c0 2.6-.5 4.9-1.4 6.8"/><path d="M5.5 16.8c.6-1.3.9-2.8.9-4.3"/>',
    refresh:  '<path d="M20.2 11.5a8.2 8.2 0 1 0-.7 4.6"/><path d="M20.5 6.5v5h-5"/>',
    download: '<path d="M12 4v11"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M4.5 19.5h15"/>',
    eye:      '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    close:    '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>'
  };

  /**
   * The application's badge mark. An original shield glyph — not the SAPS
   * crest, which is protected government insignia. Renders filled rather
   * than stroked, so it sits cleanly on the navy/gold gradient tile used
   * for the sidebar and the login screen.
   */
  function brandMark(size) {
    var s = size || 22;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" ' +
      'fill="none" aria-hidden="true">' +
        '<path d="M12 2.4L20.5 5.6V11.2C20.5 16.6 17.1 20.6 12 22.4C6.9 20.6 3.5 16.6 3.5 11.2V5.6L12 2.4Z" ' +
          'fill="rgba(255,255,255,0.14)" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/>' +
        '<path d="M7 9.6H17" stroke="#fff" stroke-width="1.1" stroke-linecap="round" opacity="0.85"/>' +
        '<path d="M12 6.6L13.05 8.75L15.4 9.1L13.7 10.75L14.1 13.1L12 12L9.9 13.1L10.3 10.75L8.6 9.1L10.95 8.75Z" ' +
          'fill="#fff"/>' +
      '</svg>';
  }

  /** Render an icon as an SVG string. */
  function icon(name, size) {
    var d = PATHS[name] || PATHS.file;
    var s = size || 18;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" ' +
           'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" ' +
           'stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  }

  /* ------------------------------------------------------------------------
     DOM helpers
     --------------------------------------------------------------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /** Replace an element's contents with an HTML string. */
  function html(el, markup) { if (el) el.innerHTML = markup; return el; }

  /** Escape user-supplied text before it goes into innerHTML. */
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ------------------------------------------------------------------------
     Formatters
     --------------------------------------------------------------------- */

  /** Initials for an avatar: "Det. Sgt Shalom Adeyemi" -> "SA". */
  function initials(name) {
    var parts = String(name).replace(/^(Det\.|Sgt|Capt\.|Const\.|Lt\.|Col\.|Brig\.|W\/O)\s*/gi, '')
                 .trim().split(/\s+/);
    var a = parts[0] ? parts[0][0] : '';
    var b = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (a + b).toUpperCase();
  }

  /** "3 h ago" style relative time from a minutes-ago integer. */
  function ago(minutes) {
    // Some data arrives as a timestamp rather than a minutes-elapsed number
    // (server notifications carry `at`, not a precomputed age). Detect and
    // convert rather than doing arithmetic on the wrong kind of value.
    if (minutes instanceof Date || (typeof minutes === 'string' && isNaN(Number(minutes)))) {
      minutes = Math.max(0, Math.round((Date.now() - asDate(minutes).getTime()) / 60000));
    }
    if (minutes < 1) return 'just now';
    if (minutes < 60) return minutes + ' min ago';
    var h = Math.floor(minutes / 60);
    if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
    var d = Math.floor(h / 24);
    if (d < 7) return d + (d === 1 ? ' day ago' : ' days ago');
    return Math.floor(d / 7) + ' weeks ago';
  }

  /** Duty-roster style date line. */
  function dutyDate(value) {
    var date = asDate(value);
    var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return days[date.getDay()] + ', ' + date.getDate() + ' ' + months[date.getMonth()] + ' ' + date.getFullYear();
  }

  /** Coerce anything date-shaped into a real Date. JSON has no date type,
      so anything that crossed the network arrives as an ISO string — this
      is the one place that difference gets normalised away. */
  function asDate(value) {
    if (value instanceof Date) return value;
    var d = new Date(value);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  function clock(value) {
    var date = asDate(value);
    var h = String(date.getHours()).padStart(2, '0');
    var m = String(date.getMinutes()).padStart(2, '0');
    return h + ':' + m;
  }

  /** Greeting keyed to the actual time of day — shifts run around the clock. */
  function greeting(date) {
    var h = date.getHours();
    if (h < 5)  return 'Night shift';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  /* ------------------------------------------------------------------------
     Status mapping
     One place decides how a status or priority is coloured.
     --------------------------------------------------------------------- */
  var STATUS_CLASS = {
    'Reported': 'neutral',
    'Assigned': 'info',
    'Under investigation': 'info',
    'Awaiting forensics': 'warning',
    'Pending approval': 'warning',
    'Closed': 'success',
    'Referred to NPA': 'success',
    'Overdue': 'danger'
  };

  var PRIORITY_CLASS = {
    'Critical': 'danger',
    'High': 'danger',
    'Medium': 'warning',
    'Low': 'neutral'
  };

  function statusBadge(status) {
    return '<span class="badge badge--' + (STATUS_CLASS[status] || 'neutral') + '">' + esc(status) + '</span>';
  }

  function priorityBadge(p) {
    return '<span class="badge badge--priority badge--' + (PRIORITY_CLASS[p] || 'neutral') + '">' + esc(p) + '</span>';
  }

  /* ------------------------------------------------------------------------
     Animated counter
     Counts a figure up on first paint. Skipped when the OS asks for
     reduced motion.
     --------------------------------------------------------------------- */
  function countUp(el, target, opts) {
    opts = opts || {};
    var suffix = opts.suffix || '';
    var decimals = opts.decimals || 0;
    var duration = opts.duration || 1100;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = target.toFixed(decimals) + suffix;
      return;
    }

    var start = performance.now();
    function frame(now) {
      var p = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);           // ease-out cubic
      el.textContent = (target * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------------
     Charts — hand-rolled SVG, no library
     --------------------------------------------------------------------- */

  /**
   * Area + line chart for case volume over time.
   * values: array of numbers. Returns an SVG string.
   */
  function areaChart(values, opts) {
    opts = opts || {};
    var w = 100, h = 34;                      // drawn in a 100x34 user space
    var max = Math.max.apply(null, values) * 1.15 || 1;
    var min = 0;
    var step = w / (values.length - 1);
    var pts = values.map(function (v, i) {
      var x = i * step;
      var y = h - ((v - min) / (max - min)) * h;
      return [x, y];
    });

    // Smooth the line with mid-point quadratic curves.
    var d = 'M' + pts[0][0] + ',' + pts[0][1];
    for (var i = 1; i < pts.length; i++) {
      var px = pts[i - 1], cx = pts[i];
      var mx = (px[0] + cx[0]) / 2;
      d += ' Q' + px[0] + ',' + px[1] + ' ' + mx + ',' + ((px[1] + cx[1]) / 2);
      d += ' Q' + cx[0] + ',' + cx[1] + ' ' + cx[0] + ',' + cx[1];
    }

    var area = d + ' L' + w + ',' + h + ' L0,' + h + ' Z';
    var id = 'g' + Math.random().toString(36).slice(2, 8);
    var stroke = opts.color || 'var(--accent)';

    return '' +
      '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" ' +
      'height="' + (opts.height || 150) + '" aria-hidden="true">' +
        '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="' + stroke + '" stop-opacity="0.34"/>' +
          '<stop offset="100%" stop-color="' + stroke + '" stop-opacity="0"/>' +
        '</linearGradient></defs>' +
        '<path d="' + area + '" fill="url(#' + id + ')"/>' +
        '<path d="' + d + '" fill="none" stroke="' + stroke + '" stroke-width="0.8" ' +
        'vector-effect="non-scaling-stroke" stroke-linecap="round"/>' +
      '</svg>';
  }

  /**
   * Grouped bar chart. series = [{label, color, values:[]}], labels = x axis.
   */
  function barChart(series, labels, opts) {
    opts = opts || {};
    var h = 140, w = 100;
    var groups = labels.length;
    var groupW = w / groups;
    var barW = (groupW * 0.62) / series.length;
    var all = series.reduce(function (acc, s) { return acc.concat(s.values); }, []);
    var max = Math.max.apply(null, all) * 1.15 || 1;

    var bars = '';
    for (var g = 0; g < groups; g++) {
      for (var s = 0; s < series.length; s++) {
        var v = series[s].values[g];
        var bh = (v / max) * h;
        var x = g * groupW + groupW * 0.19 + s * barW;
        bars += '<rect x="' + x.toFixed(2) + '" y="' + (h - bh).toFixed(2) + '" ' +
                'width="' + (barW * 0.82).toFixed(2) + '" height="' + bh.toFixed(2) + '" ' +
                'rx="1" fill="' + series[s].color + '" opacity="0.92">' +
                '<animate attributeName="height" from="0" to="' + bh.toFixed(2) + '" dur="0.7s" fill="freeze"/>' +
                '<animate attributeName="y" from="' + h + '" to="' + (h - bh).toFixed(2) + '" dur="0.7s" fill="freeze"/>' +
                '</rect>';
      }
    }

    // Horizontal guide lines behind the bars.
    var grid = '';
    for (var i = 1; i <= 3; i++) {
      var y = h - (h / 4) * i;
      grid += '<line x1="0" y1="' + y + '" x2="' + w + '" y2="' + y + '" ' +
              'stroke="rgba(148,163,184,0.13)" stroke-width="0.4"/>';
    }

    return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" ' +
           'height="' + (opts.height || 170) + '" aria-hidden="true">' + grid + bars + '</svg>';
  }

  /**
   * Donut chart. slices = [{label, value, color}].
   */
  function donut(slices, size) {
    var s = size || 168;
    var r = 62, c = 2 * Math.PI * r, cx = 84, cy = 84;
    var total = slices.reduce(function (a, b) { return a + b.value; }, 0) || 1;
    var offset = 0;
    var arcs = '';

    slices.forEach(function (sl) {
      var len = (sl.value / total) * c;
      arcs += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" ' +
              'stroke="' + sl.color + '" stroke-width="17" stroke-linecap="butt" ' +
              'stroke-dasharray="' + len.toFixed(2) + ' ' + (c - len).toFixed(2) + '" ' +
              'stroke-dashoffset="' + (-offset).toFixed(2) + '" ' +
              'transform="rotate(-90 ' + cx + ' ' + cy + ')"/>';
      offset += len;
    });

    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 168 168" aria-hidden="true">' +
             '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" ' +
             'stroke="rgba(148,163,184,0.12)" stroke-width="17"/>' + arcs +
             '<text x="84" y="80" text-anchor="middle" fill="#FFFFFF" ' +
             'font-size="26" font-weight="700" font-family="Inter, sans-serif">' + total + '</text>' +
             '<text x="84" y="98" text-anchor="middle" fill="#94A3B8" font-size="10" ' +
             'letter-spacing="1.2" font-family="Inter, sans-serif">DOCKETS</text>' +
           '</svg>';
  }

  /** Circular completeness ring used for investigation health. */
  function ring(percent, color) {
    var r = 46, c = 2 * Math.PI * r;
    var offset = c - (percent / 100) * c;
    return '<div class="ring">' +
      '<svg width="108" height="108" viewBox="0 0 108 108">' +
        '<circle class="ring__track" cx="54" cy="54" r="' + r + '" fill="none" stroke-width="9"/>' +
        '<circle class="ring__value" cx="54" cy="54" r="' + r + '" fill="none" stroke-width="9" ' +
        'stroke="' + color + '" stroke-dasharray="' + c.toFixed(1) + '" ' +
        'stroke-dashoffset="' + c.toFixed(1) + '" data-offset="' + offset.toFixed(1) + '"/>' +
      '</svg>' +
      '<div class="ring__label"><div class="ring__num">' + percent + '</div>' +
      '<div class="ring__cap">health</div></div>' +
    '</div>';
  }

  /* ------------------------------------------------------------------------
     Chain-of-custody strip
     links: array of 'ok' | 'broken' | 'pending'
     --------------------------------------------------------------------- */
  function chainStrip(links) {
    var out = '<div class="chain">';
    links.forEach(function (state, i) {
      var cls = state === 'broken' ? ' chain__link--broken'
              : state === 'pending' ? ' chain__link--pending' : '';
      out += '<div class="chain__link' + cls + '" title="Custody event ' + (i + 1) + '"></div>';
    });
    return out + '</div>';
  }

  /* ------------------------------------------------------------------------
     Toast
     --------------------------------------------------------------------- */
  function toast(message, kind) {
    var host = $('.toasts');
    if (!host) {
      host = document.createElement('div');
      host.className = 'toasts';
      document.body.appendChild(host);
    }
    var k = kind || 'info';
    var ic = k === 'success' ? 'check' : k === 'warning' ? 'alert' : 'activity';
    var el = document.createElement('div');
    el.className = 'toast toast--' + k;
    el.innerHTML = icon(ic, 18) + '<span>' + esc(message) + '</span>';
    host.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity 240ms, transform 240ms';
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      setTimeout(function () { el.remove(); }, 240);
    }, 3400);
  }

  /* ------------------------------------------------------------------------
     Typewriter — used when the AI copilot answers
     --------------------------------------------------------------------- */
  function typeOut(el, text, done) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = text;
      if (done) done();
      return;
    }
    var i = 0;
    el.textContent = '';
    var caret = document.createElement('span');
    caret.className = 'caret';
    el.appendChild(caret);

    var timer = setInterval(function () {
      i += 2;
      caret.remove();
      el.textContent = text.slice(0, i);
      el.appendChild(caret);
      if (i >= text.length) {
        clearInterval(timer);
        caret.remove();
        if (done) done();
      }
    }, 16);
  }

  /* ------------------------------------------------------------------------
     Entrance stagger — sets --i on each card so CSS can delay them
     --------------------------------------------------------------------- */
  function stagger(selector) {
    $$(selector).forEach(function (el, i) {
      el.style.setProperty('--i', i);
      el.classList.add('enter');
    });
  }

  /** Kick off any progress bars and rings once they are in the DOM. */
  function animateMeters(root) {
    setTimeout(function () {
      $$('.progress__fill', root).forEach(function (el) {
        el.style.width = (el.dataset.value || 0) + '%';
      });
      $$('.ring__value', root).forEach(function (el) {
        el.style.strokeDashoffset = el.dataset.offset;
      });
      $$('[data-count]', root).forEach(function (el) {
        countUp(el, parseFloat(el.dataset.count), {
          suffix: el.dataset.suffix || '',
          decimals: parseInt(el.dataset.decimals || '0', 10)
        });
      });
    }, 60);
  }

  /* --------------------------------------------------------------------- */
  return {
    icon: icon, $: $, $$: $$, html: html, esc: esc,
    initials: initials, ago: ago, dutyDate: dutyDate, clock: clock, greeting: greeting, asDate: asDate,
    brandMark: brandMark,
    statusBadge: statusBadge, priorityBadge: priorityBadge,
    countUp: countUp, areaChart: areaChart, barChart: barChart, donut: donut, ring: ring,
    chainStrip: chainStrip, toast: toast, typeOut: typeOut,
    stagger: stagger, animateMeters: animateMeters
  };
})();
