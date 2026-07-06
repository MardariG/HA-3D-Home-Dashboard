/**
 * Dashboard (view mode) entry point.
 *
 * Renders the home with Three.js (src/dashboard3d.js) using the Sweet
 * Home 3D engine as scene builder. In the HA build, entity bindings and
 * ambient effects attach through the panel bridge (src/bindings3d.js),
 * and the homes API requires the panel's access token (src/haAuth.js).
 */

import { addModeToggle } from './haMode.js';
import { installZipRequestDeduplication } from './zipDedupe.js';
import { installAuthXhr, requestPanelConfig } from './haAuth.js';
import { initDashboard } from './dashboard3d.js';
import { installBindings3D } from './bindings3d.js';

function status(text) {
  var element = document.getElementById('status');
  if (element) {
    element.textContent = text;
  }
}

function start() {
  installZipRequestDeduplication();
  initDashboard({
    homeUrl: __HA_BUILD__
      ? '/api/home_3d_dashboard/homes/default'
      : 'assets/default.sh3d',
    container: document.getElementById('container'),
    onStatus: status,
    onReady: function (api) {
      status('');
      if (__HA_BUILD__ && window.parent !== window) {
        installBindings3D(api);
      }
    },
    onError: function (message) {
      status(__HA_BUILD__
        ? 'No home found yet — click "Edit" (top right) to build one. (' + message + ')'
        : 'Could not load home: ' + message);
    }
  });
}

function boot() {
  if (__HA_BUILD__) {
    addModeToggle('editor.html', 'Edit');
  }
  if (__HA_BUILD__ && window.parent !== window) {
    // The homes API requires auth: get the access token from the panel
    // before the engine starts fetching (see src/haAuth.js).
    installAuthXhr();
    requestPanelConfig(start, function () {
      status('No connection to Home Assistant — open this page through the 3D Dashboard sidebar panel.');
    });
  } else {
    start();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
