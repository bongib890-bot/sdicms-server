/* ==========================================================================
   SDICMS — API client
   The only place in the frontend that knows how to talk to the server.

   Token handling:
    • The access token lives in memory and in sessionStorage, so a page
      reload does not sign you out but closing the tab does.
    • The refresh token is an httpOnly cookie the server sets. This file
      cannot read it, and neither can any other script on the page.
    • A 401 triggers one refresh attempt and one retry. If that fails, the
      session is cleared and the user is returned to sign-in.
   ========================================================================== */

window.SD_API = (function () {
  'use strict';

  var BASE = '/api/v1';
  var STORAGE_KEY = 'sdicms.access';
  var accessToken = null;
  var refreshing = null;

  /* ------------------------------------------------------------------------
     Session state
     --------------------------------------------------------------------- */
  function loadToken() {
    if (accessToken) return accessToken;
    try {
      accessToken = window.sessionStorage.getItem(STORAGE_KEY);
    } catch (e) {
      accessToken = null;          // private browsing, or a file:// origin
    }
    return accessToken;
  }

  function setToken(value) {
    accessToken = value;
    try {
      if (value) window.sessionStorage.setItem(STORAGE_KEY, value);
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* nothing we can do; the in-memory copy still works */ }
  }

  /**
   * Being served over http is not the same as being served by *this* API.
   * VS Code Live Server, python -m http.server and similar will happily
   * serve the pages and then reject a POST with 405, because they only
   * know how to hand out files.
   *
   * So we ask the server directly. /health is the cheapest possible check:
   * if it answers with our envelope, the backend is really there.
   */
  var available = null;          // null = not yet checked

  function isServed() {
    return window.location.protocol === 'http:' || window.location.protocol === 'https:';
  }

  function probe() {
    if (available !== null) return Promise.resolve(available);

    if (!isServed()) {
      available = false;
      return Promise.resolve(false);
    }

    return fetch(BASE + '/health', { method: 'GET', credentials: 'include' })
      .then(function (r) {
        if (!r.ok) return false;
        return r.json().then(function (body) {
          return !!(body && body.success && body.data && body.data.status === 'ok');
        }).catch(function () { return false; });
      })
      .catch(function () { return false; })
      .then(function (result) {
        available = result;
        return result;
      });
  }

  /** Synchronous answer, only valid after probe() has resolved. */
  function isAvailable() { return available === true; }

  function hasSession() {
    return isServed() && !!loadToken();
  }

  /* ------------------------------------------------------------------------
     Core request
     --------------------------------------------------------------------- */
  function buildError(payload, status) {
    var message = payload && payload.error && payload.error.message;

    if (!message) {
      // No JSON body came back, so describe the status instead of shrugging.
      message = status === 404
        ? 'That endpoint does not exist on the server. The frontend and the API may be out of step.'
        : status === 429
          ? 'Too many attempts. Wait a few minutes and try again.'
          : status >= 500
            ? 'The server hit an error handling that request. Check the terminal running npm run dev — the reason is printed there.'
            : 'The request failed (HTTP ' + status + ').';
    }

    var err = new Error(message);
    err.status = status;
    err.details = payload && payload.error ? payload.error.details : null;
    return err;
  }

  async function raw(method, path, body, options) {
    options = options || {};

    var headers = {};
    var token = loadToken();
    if (token) headers.Authorization = 'Bearer ' + token;

    var payload;
    if (body instanceof FormData) {
      payload = body;                      // let the browser set the boundary
    } else if (body !== undefined && body !== null) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    var response;
    try {
      response = await fetch(BASE + path, {
        method: method,
        headers: headers,
        body: payload,
        credentials: 'include'             // required for the refresh cookie
      });
    } catch (networkError) {
      // fetch only rejects when the request never reached a server at all.
      var offline = new Error(
        'Could not reach the SDICMS server at ' + window.location.origin +
        '. Check that it is running (npm run dev) and that the port matches.'
      );
      offline.status = 0;
      offline.offline = true;
      throw offline;
    }

    if (response.status === 204) return null;

    // File downloads come back as a blob rather than JSON.
    if (options.blob) {
      if (!response.ok) throw buildError(await response.json().catch(function () { return null; }), response.status);
      return response.blob();
    }

    var data = await response.json().catch(function () { return null; });

    if (!response.ok) throw buildError(data, response.status);
    return data ? data.data : null;
  }

  /**
   * Request with one automatic refresh-and-retry on 401. Concurrent 401s
   * share a single refresh call rather than each firing their own.
   */
  async function request(method, path, body, options) {
    try {
      return await raw(method, path, body, options);
    } catch (err) {
      if (err.status !== 401 || path.indexOf('/auth/') === 0) throw err;

      if (!refreshing) {
        refreshing = raw('POST', '/auth/refresh')
          .then(function (result) {
            setToken(result.accessToken);
            return result;
          })
          .catch(function (refreshErr) {
            setToken(null);
            throw refreshErr;
          })
          .finally(function () { refreshing = null; });
      }

      try {
        await refreshing;
      } catch (refreshErr) {
        signOutLocally();
        throw err;
      }

      return raw(method, path, body, options);
    }
  }

  function signOutLocally() {
    setToken(null);
    if (window.location.pathname.indexOf('index.html') < 0 && window.location.pathname !== '/') {
      window.location.href = 'index.html?expired=1';
    }
  }

  /* ------------------------------------------------------------------------
     Endpoints
     Named after what they do, not after their URL, so a route change is a
     one-line edit here.
     --------------------------------------------------------------------- */
  return {
    isServed: isServed,
    probe: probe,
    isAvailable: isAvailable,
    hasSession: hasSession,
    /** No auth required — safe to call before anyone has signed in. */
    publicOverview: function () { return raw('GET', '/public/overview'); },
    setToken: setToken,
    clearToken: function () { setToken(null); },

    /* --- auth --- */
    login: function (email, password) {
      return raw('POST', '/auth/login', { email: email, password: password })
        .then(function (result) {
          setToken(result.accessToken);
          return result;
        });
    },
    logout: function () {
      return raw('POST', '/auth/logout').catch(function () { /* sign out locally regardless */ })
        .then(function () { setToken(null); });
    },
    me: function () { return request('GET', '/auth/me'); },
    changePassword: function (currentPassword, newPassword, confirmPassword) {
      return request('POST', '/auth/change-password', {
        currentPassword: currentPassword,
        newPassword: newPassword,
        confirmPassword: confirmPassword
      });
    },

    /* --- bootstrap: one call that fills the entire client cache --- */
    bootstrap: function () { return request('GET', '/bootstrap'); },

    /* --- cases --- */
    listCases: function (params) {
      var q = new URLSearchParams(params || {}).toString();
      return request('GET', '/cases' + (q ? '?' + q : ''));
    },
    getCase: function (number) { return request('GET', '/cases/' + encodeURIComponent(number)); },
    createCase: function (data) { return request('POST', '/cases', data); },
    changeCaseStatus: function (number, status, reason) {
      return request('PATCH', '/cases/' + encodeURIComponent(number) + '/status',
        { status: status, reason: reason });
    },
    assignCase: function (number, detectiveId) {
      return request('PATCH', '/cases/' + encodeURIComponent(number) + '/assign',
        { detectiveId: detectiveId });
    },
    addNote: function (number, body) {
      return request('POST', '/cases/' + encodeURIComponent(number) + '/notes', { body: body });
    },

    /* --- evidence --- */
    listEvidence: function () { return request('GET', '/evidence'); },
    getEvidence: function (number) { return request('GET', '/evidence/' + encodeURIComponent(number)); },
    createEvidence: function (formData) { return request('POST', '/evidence', formData); },
    transferCustody: function (number, toParty, action) {
      return request('POST', '/evidence/' + encodeURIComponent(number) + '/custody',
        { toParty: toParty, action: action });
    },
    verifyEvidence: function (number) {
      return request('PATCH', '/evidence/' + encodeURIComponent(number) + '/verify');
    },
    evidenceFileUrl: function (number) {
      return BASE + '/evidence/' + encodeURIComponent(number) + '/file';
    },

    /* --- documents --- */
    listDocuments: function () { return request('GET', '/documents'); },
    uploadDocument: function (formData) { return request('POST', '/documents', formData); },
    documentFileUrl: function (id) { return BASE + '/documents/' + id + '/file'; },

    /* --- people --- */
    listSuspects: function () { return request('GET', '/suspects'); },
    createSuspect: function (data) { return request('POST', '/suspects', data); },
    listStatements: function () { return request('GET', '/statements'); },
    createStatement: function (data) { return request('POST', '/statements', data); },
    signStatement: function (id) { return request('PATCH', '/statements/' + id + '/sign'); },

    /* --- users and stations --- */
    listUsers: function () { return request('GET', '/users'); },
    createUser: function (data) { return request('POST', '/users', data); },
    updateUser: function (id, data) { return request('PATCH', '/users/' + id, data); },
    resetUserPassword: function (id) { return request('POST', '/users/' + id + '/reset-password'); },
    listStationAdmins: function () { return request('GET', '/users/station-admins'); },
    listStations: function () { return request('GET', '/stations'); },
    createStation: function (data) { return request('POST', '/stations', data); },

    /* --- audit --- */
    listAudit: function (limit) { return request('GET', '/audit?limit=' + (limit || 200)); },
    verifyAudit: function () { return request('GET', '/audit/verify'); },

    /* --- notifications and AI --- */
    listNotifications: function () { return request('GET', '/notifications'); },
    markNotificationsRead: function () { return request('PATCH', '/notifications/read'); },
    listInsights: function () { return request('GET', '/ai/insights'); },
    resolveInsight: function (id, disposition) {
      return request('PATCH', '/ai/insights/' + id, { disposition: disposition });
    },
    ask: function (question) { return request('POST', '/ai/ask', { question: question }); }
  };
})();
