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

function initViewer() {
  if (typeof window.viewHome !== 'function') {
    const msg =
      '[SweetHome3D] Global `viewHome` is not defined. ' +
      'Check that the vendor scripts in index.html loaded before bundle.js.';
    console.error(msg);
    const err = document.getElementById('viewerProgressLabel');
    if (err) err.textContent = msg;
    return;
  }

  // URL of the .sh3d home file to display.
  // `assets/default.sh3d` is copied from public/assets/ into dist/assets/ by webpack.
  const homeUrl = 'assets/default.sh3d';

  const onerror = function (err) {
    if (err === 'No WebGL') {
      alert("Sorry, your browser doesn't support WebGL.");
      return;
    }
    console.error(err && err.stack ? err.stack : err);
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

  window.viewHome(
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initViewer);
} else {
  initViewer();
}
