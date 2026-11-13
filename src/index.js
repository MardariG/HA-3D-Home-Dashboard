/**
 * Dashboard (view mode) entry point.
 *
 * Renders the home with Three.js (src/dashboard3d.js) using the Sweet
 * Home 3D engine as scene builder. In the HA build, entity bindings and
 * ambient effects attach through the panel bridge (src/bindings3d.js),
 * and the homes API requires the panel's access token (src/haAuth.js).
 */

import { addModeToggle, showUpdateNotice } from './haMode.js';
import { installZipRequestDeduplication } from './zipDedupe.js';
import {
  installAuthXhr, requestPanelConfig, getActiveHome, getPanelConfig, requestFreshToken, errorStatus
} from './haAuth.js';
import { showNoHome, showSignInRefused, showLoadFailed, showNotInPanel } from './homeMessages.js';
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
  if (__HA_BUILD__ && window.parent !== window) {
    showUpdateNotice(getPanelConfig());
  }
  loadHome(false);
}

function loadHome(retried) {
  var homeName = getActiveHome();
  initDashboard({
    // The active home, chosen in the editor (see src/homes.js)
    homeUrl: __HA_BUILD__
      ? '/api/home_3d_dashboard/homes/' + encodeURIComponent(homeName)
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
      if (!__HA_BUILD__) {
        status('Could not load home: ' + message);
        return;
      }
      var code = errorStatus(message);
      if ((code === 401 || code === 403) && !retried) {
        // Most likely an expired access token: renew it once and retry
        status('Signing in…');
        requestFreshToken(function () {
          loadHome(true);
        });
        return;
      }
      status('');
      if (code === 404) {
        showNoHome(homeName, 'editor.html' + window.location.search);
      } else if (code === 401 || code === 403) {
        showSignInRefused(message);
      } else {
        showLoadFailed(homeName, message,
          [{ label: 'Open the editor', href: 'editor.html' + window.location.search }]);
      }
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
      status('');
      showNotInPanel();
    });
  } else if (__HA_BUILD__) {
    // Opened on its own: the homes API needs the panel's sign-in
    status('');
    showNotInPanel();
  } else {
    start();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
