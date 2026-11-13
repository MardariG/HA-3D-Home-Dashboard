/**
 * Access-token plumbing for the HA build.
 *
 * The homes API (/api/home_3d_dashboard/*) requires authentication, but the
 * engine's XMLHttpRequests know nothing about Home Assistant auth. The
 * custom panel element (public/panel.js) owns the frontend's access token
 * and hands it to this iframe during an initial handshake:
 *
 *   page  -> panel : sh3d-hello                     (repeated until answered)
 *   panel -> page  : sh3d-config {accessToken, home} (re-sent on token refresh)
 *   page  -> panel : sh3d-token-refresh             (a request got a 401;
 *                                                    see requestFreshToken)
 *
 * `home` is the active home: the one the viewer and editor open.
 *
 * installAuthXhr() then attaches "Authorization: Bearer <token>" to every
 * XHR aimed at the integration's API. The save worker gets the same
 * treatment through the shim in the generated recorder-worker.js, which
 * reads the token from the recorder configuration.
 */

var accessToken = null;
var activeHome = null;
var panelConfig = null;
var tokenWaiters = [];

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

/** The panel's first sh3d-config message (null outside the panel). */
export function getPanelConfig() {
  return panelConfig;
}

/** Name of the home to open (from the panel), "default" before/without it. */
export function getActiveHome() {
  return activeHome || 'default';
}

/**
 * Asks the panel for a renewed access token, for a request that was refused
 * (401): onDone(true) once it arrived, onDone(false) without a panel or
 * answer.
 */
export function requestFreshToken(onDone) {
  if (window.parent === window) {
    onDone(false);
    return;
  }
  var done = false;
  var finish = function (ok) {
    if (!done) {
      done = true;
      onDone(ok);
    }
  };
  tokenWaiters.push(function () {
    finish(true);
  });
  window.parent.postMessage({ type: 'sh3d-token-refresh' }, window.location.origin);
  setTimeout(function () {
    finish(false);
  }, 8000);
}

/** HTTP status in an engine load error ("Error: 401 while requesting …"), or 0. */
export function errorStatus(error) {
  var match = /\b([1-5]\d\d) while requesting\b/.exec(String(error));
  return match ? parseInt(match[1], 10) : 0;
}

export function installAuthXhr() {
  var originalOpen = XMLHttpRequest.prototype.open;
  var originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__sh3dApiRequest = typeof url === 'string'
      && url.indexOf('/api/home_3d_dashboard/') !== -1;
    return originalOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    if (this.__sh3dApiRequest && accessToken) {
      this.setRequestHeader('Authorization', 'Bearer ' + accessToken);
    }
    return originalSend.apply(this, arguments);
  };
}

/**
 * Performs the handshake with the panel. onConfig fires once, with the
 * config message data; later sh3d-config messages (token refreshes) only
 * update the stored token. onTimeout fires if the panel never answers
 * (page opened outside the 3D Dashboard panel).
 */
export function requestPanelConfig(onConfig, onTimeout) {
  var configReceived = false;

  window.addEventListener('message', function (ev) {
    if (ev.origin !== window.location.origin
        || ev.source !== window.parent
        || !ev.data
        || ev.data.type !== 'sh3d-config') {
      return;
    }
    setAccessToken(ev.data.accessToken);
    tokenWaiters.splice(0).forEach(function (waiter) {
      waiter();
    });
    if (!configReceived) {
      configReceived = true;
      panelConfig = ev.data;
      activeHome = typeof ev.data.home === 'string' && ev.data.home ? ev.data.home : null;
      onConfig(ev.data);
    }
  });

  var attempts = 0;
  var hello = function () {
    if (configReceived) {
      return;
    }
    if (++attempts > 16) { // ~5s
      if (onTimeout) {
        onTimeout();
      }
      return;
    }
    window.parent.postMessage({ type: 'sh3d-hello' }, window.location.origin);
    setTimeout(hello, 300);
  };
  hello();
}
