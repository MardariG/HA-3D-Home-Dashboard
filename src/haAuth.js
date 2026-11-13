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
