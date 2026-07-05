/**
 * Sweet Home 3D web viewer — entry point.
 *
 * This file boots the viewer once the page DOM is ready. The vendor scripts
 * (big.min.js, gl-matrix, core.min.js, geom.min.js, viewmodel.min.js,
 * viewhome.min.js, etc.) are already loaded via <script> tags in index.html
 * BEFORE this bundle runs, so globals like `viewHome`, `HomeRecorder`, and
 * `Node3D` are available.
 *
 * The viewer API is documented inline with the call to `viewHome(...)`.
 */

import './styles.css';
import { addModeToggle } from './haMode.js';
import { installZipRequestDeduplication } from './zipDedupe.js';
import { installEntityBindings } from './entityBindings.js';

function initViewer() {
  installZipRequestDeduplication();
  if (__HA_BUILD__) {
    document.body.classList.add('ha-mode');
    addModeToggle('editor.html', 'Edit');
  }

  if (typeof window.viewHome !== 'function') {
    const msg =
      '[SweetHome3D] Global `viewHome` is not defined. ' +
      'Check that the vendor scripts in index.html loaded before bundle.js.';
    console.error(msg);
    const err = document.getElementById('viewerProgressLabel');
    if (err) err.textContent = msg;
    return;
  }

  // URL of the .sh3d home file to display. In the HA build the home comes
  // from the integration's API; standalone uses the bundled sample.
  const homeUrl = __HA_BUILD__
    ? '/api/home_3d_dashboard/homes/default'
    : 'assets/default.sh3d';

  const onerror = function (err) {
    if (err === 'No WebGL') {
      alert("Sorry, your browser doesn't support WebGL.");
      return;
    }
    console.error(err && err.stack ? err.stack : err);
    if (__HA_BUILD__) {
      // Most likely there is no saved home yet (404) — guide, don't alert.
      const progressLabel = document.getElementById('viewerProgressLabel');
      const progressDiv = document.getElementById('viewerProgressDiv');
      if (progressDiv) progressDiv.style.visibility = 'visible';
      if (progressLabel) {
        progressLabel.textContent =
          'No home found yet — click "Edit" (top right) to build one.';
      }
      return;
    }
    const message = err && err.message
      ? err.constructor.name + ' ' + err.message
      : String(err);
    alert('Error: ' + message);
  };

  const onprogression = function (part, info, percentage) {
    const progress = document.getElementById('viewerProgress');
    const progressDiv = document.getElementById('viewerProgressDiv');
    const progressLabel = document.getElementById('viewerProgressLabel');

    if (part === window.HomeRecorder.READING_HOME) {
      progress.value = percentage * 100;
      info = info.substring(info.lastIndexOf('/') + 1);
    } else if (part === window.Node3D.READING_MODEL) {
      progress.value = 100 + percentage * 100;
      if (percentage === 1 && progressDiv) {
        progressDiv.style.visibility = 'hidden';
      }
    }

    progressLabel.innerHTML =
      (percentage ? Math.floor(percentage * 100) + '% ' : '') +
      part + ' ' + info;
  };

  const previewComponent = window.viewHome(
    'viewerCanvas', // id of the <canvas> element
    homeUrl,        // URL of the .sh3d file
    onerror,        // error callback
    onprogression,  // progress callback
    {
      roundsPerMinute: 0,
      navigationPanel: 'default',
      aerialViewButtonId: 'aerialView',
      virtualVisitButtonId: 'virtualVisit',
      levelsAndCamerasListId: 'levelsAndCameras',
      activateCameraSwitchKey: true
    }
  );

  if (__HA_BUILD__) {
    // Bridges to the HA custom panel (public/panel.js) when embedded in it:
    // entity bind mode, live state tinting, click-to-toggle.
    installEntityBindings(previewComponent);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initViewer);
} else {
  initViewer();
}
