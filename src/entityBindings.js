/**
 * Live entity bindings for the dashboard (HA build, viewer page).
 *
 * Talks to the custom panel element (public/panel.js) over postMessage —
 * the protocol is documented there. View mode is intentionally read-only:
 *  - mapped pieces are tinted amber while their entity is "on",
 *  - clicking a mapped piece toggles its entity through the panel.
 * Bindings are AUTHORED in the editor (see editorBindings.js).
 *
 * Does nothing when the page is not embedded in the HA panel (standalone
 * builds, or the page opened directly).
 */

import { applyAmbient } from './dashboardEffects.js';

var ON_COLOR = 0xF9A825;
var CLICK_TOLERANCE_PX = 5;

export function installEntityBindings(previewComponent) {
  if (window.parent === window) {
    return;
  }

  var home = null;
  var component3D = null;
  var mappings = {};
  var states = {};
  var ambient = null;
  var originalColors = {};

  function post(msg) {
    window.parent.postMessage(msg, window.location.origin);
  }

  window.addEventListener('message', function (ev) {
    if (ev.origin !== window.location.origin
        || ev.source !== window.parent
        || !ev.data
        || typeof ev.data.type !== 'string') {
      return;
    }
    if (ev.data.type === 'sh3d-init') {
      mappings = ev.data.mappings || {};
      renderStates();
    } else if (ev.data.type === 'sh3d-states') {
      states = ev.data.states || {};
      ambient = ev.data.ambient || null;
      renderStates();
      applyAmbient(home, ambient);
    }
  });

  // The home loads asynchronously inside HomePreviewComponent.
  var waiter = setInterval(function () {
    try {
      home = previewComponent.getHome();
      component3D = previewComponent.getComponent3D();
    } catch (ex) { /* not ready yet */ }
    if (home && component3D) {
      clearInterval(waiter);
      attachClickHandler();
      renderStates();
      applyAmbient(home, ambient);
      post({ type: 'sh3d-ready' });
    }
  }, 250);

  function findPiece(pieceId) {
    var furniture = home.getFurniture();
    for (var i = 0; i < furniture.length; i++) {
      if (furniture[i].getId() === pieceId) {
        return furniture[i];
      }
    }
    return null;
  }

  function attachClickHandler() {
    var canvas = component3D.getHTMLElement();
    var downX = null;
    var downY = null;

    function handleTap(x, y) {
      if (downX === null
          || Math.abs(x - downX) > CLICK_TOLERANCE_PX
          || Math.abs(y - downY) > CLICK_TOLERANCE_PX) {
        return; // camera drag, not a tap
      }
      var item = component3D.getClosestItemAt(x, y);
      if (item !== null && typeof item.getId === 'function') {
        var entityId = mappings[item.getId()];
        if (entityId) {
          post({ type: 'sh3d-toggle', entityId: entityId });
        }
      }
    }

    canvas.addEventListener('mousedown', function (ev) {
      downX = ev.clientX;
      downY = ev.clientY;
    });
    canvas.addEventListener('mouseup', function (ev) {
      handleTap(ev.clientX, ev.clientY);
    });
    canvas.addEventListener('touchstart', function (ev) {
      if (ev.touches.length === 1) {
        downX = ev.touches[0].clientX;
        downY = ev.touches[0].clientY;
      } else {
        downX = null; // multi-touch = camera gesture
      }
    });
    canvas.addEventListener('touchend', function (ev) {
      if (ev.changedTouches.length === 1) {
        handleTap(ev.changedTouches[0].clientX, ev.changedTouches[0].clientY);
      }
    });
  }

  function renderStates() {
    if (!home) {
      return;
    }
    for (var pieceId in mappings) {
      var piece = findPiece(pieceId);
      if (piece === null || typeof piece.setColor !== 'function') {
        continue;
      }
      var on = states[mappings[pieceId]] === 'on';
      if (on) {
        if (!(pieceId in originalColors)) {
          originalColors[pieceId] = piece.getColor();
        }
        if (piece.getColor() !== ON_COLOR) {
          piece.setColor(ON_COLOR);
        }
      } else if (pieceId in originalColors) {
        if (piece.getColor() !== originalColors[pieceId]) {
          piece.setColor(originalColors[pieceId]);
        }
        delete originalColors[pieceId];
      }
    }
  }
}
