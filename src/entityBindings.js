/**
 * Live entity bindings for the dashboard (HA build, viewer page).
 *
 * Talks to the custom panel element (public/panel.js) over postMessage —
 * the protocol is documented there. View mode is intentionally read-only:
 *  - toggleable entities on furniture/rooms: amber tint while "on",
 *    click/tap to toggle through the panel
 *  - sensor/climate entities: floating 3D label with the live value; on
 *    rooms additionally a temperature floor heatmap (blue -> red)
 *  - ambient sun/weather context drives the scene mood (dashboardEffects)
 * Bindings are AUTHORED in the editor (see editorBindings.js).
 *
 * Does nothing when the page is not embedded in the HA panel (standalone
 * builds, or the page opened directly).
 */

import { applyAmbient } from './dashboardEffects.js';

var ON_COLOR = 0xF9A825;
var LABEL_COLOR = 0x212121;
var HEATMAP_COLD = 0x64B5F6; // 16 degC and below
var HEATMAP_HOT = 0xEF5350;  // 28 degC and above
var HEATMAP_MIN = 16;
var HEATMAP_MAX = 28;
var CLICK_TOLERANCE_PX = 5;

// Domains toggled by clicking their bound object (deliberately excludes
// climate/sensor: misclicking should not turn off the heating)
var TOGGLE_CLICK_DOMAINS =
  /^(light|switch|fan|cover|lock|media_player|input_boolean|scene|script|vacuum)\./;
var VALUE_DOMAINS = /^(sensor|climate)\./;

export function installEntityBindings(previewComponent) {
  if (window.parent === window) {
    return;
  }

  var home = null;
  var component3D = null;
  var mappings = {};
  var states = {};
  var ambient = null;
  var originalPieceColors = {};
  var originalFloorColors = {};
  var valueLabels = {};

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

  /** Finds the bound furniture piece or room by its persistent id. */
  function findTarget(targetId) {
    var furniture = home.getFurniture();
    for (var i = 0; i < furniture.length; i++) {
      if (furniture[i].getId() === targetId) {
        return { piece: furniture[i] };
      }
    }
    var rooms = home.getRooms();
    for (var j = 0; j < rooms.length; j++) {
      if (rooms[j].getId() === targetId) {
        return { room: rooms[j] };
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
        if (entityId && TOGGLE_CLICK_DOMAINS.test(entityId)) {
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
    for (var targetId in mappings) {
      var entityId = mappings[targetId];
      var target = findTarget(targetId);
      if (target === null) {
        continue;
      }
      if (VALUE_DOMAINS.test(entityId)) {
        renderValue(targetId, target, states[entityId]);
      } else {
        renderOnOff(targetId, target,
          states[entityId] !== undefined && states[entityId].state === 'on');
      }
    }
    // Drop leftovers of removed bindings
    for (var labelId in valueLabels) {
      if (!(labelId in mappings)) {
        home.deleteLabel(valueLabels[labelId]);
        delete valueLabels[labelId];
      }
    }
    for (var floorId in originalFloorColors) {
      if (!(floorId in mappings)) {
        var stale = findTarget(floorId);
        if (stale !== null && stale.room) {
          stale.room.setFloorColor(originalFloorColors[floorId]);
        }
        delete originalFloorColors[floorId];
      }
    }
  }

  function renderOnOff(targetId, target, on) {
    if (target.piece && typeof target.piece.setColor === 'function') {
      var piece = target.piece;
      if (on) {
        if (!(targetId in originalPieceColors)) {
          originalPieceColors[targetId] = piece.getColor();
        }
        if (piece.getColor() !== ON_COLOR) {
          piece.setColor(ON_COLOR);
        }
      } else if (targetId in originalPieceColors) {
        if (piece.getColor() !== originalPieceColors[targetId]) {
          piece.setColor(originalPieceColors[targetId]);
        }
        delete originalPieceColors[targetId];
      }
    } else if (target.room) {
      var room = target.room;
      if (on) {
        if (!(targetId in originalFloorColors)) {
          originalFloorColors[targetId] = room.getFloorColor();
        }
        room.setFloorColor(ON_COLOR);
      } else if (targetId in originalFloorColors) {
        room.setFloorColor(originalFloorColors[targetId]);
        delete originalFloorColors[targetId];
      }
    }
  }

  function renderValue(targetId, target, state) {
    var value = state === undefined ? undefined
      : (state.currentTemperature !== undefined && state.currentTemperature !== null
          ? state.currentTemperature
          : state.state);
    var unavailable = value === undefined || value === null
      || value === 'unknown' || value === 'unavailable';
    var text = unavailable
      ? '—'
      : String(value) + (state.unit ? ' ' + state.unit : '');
    var numeric = unavailable ? NaN : parseFloat(value);

    var x;
    var y;
    var elevation;
    var level = null;
    if (target.piece) {
      x = target.piece.getX();
      y = target.piece.getY();
      elevation = target.piece.getElevation() + target.piece.getHeight() + 15;
      level = target.piece.getLevel();
    } else {
      x = target.room.getXCenter();
      y = target.room.getYCenter();
      elevation = 2; // just above the (possibly tinted) floor
      level = target.room.getLevel();
    }
    ensureLabel(targetId, x, y, elevation, level, text);

    if (target.room) {
      if (isFinite(numeric)) {
        if (!(targetId in originalFloorColors)) {
          originalFloorColors[targetId] = target.room.getFloorColor();
        }
        target.room.setFloorColor(heatmapColor(numeric));
      } else if (targetId in originalFloorColors) {
        target.room.setFloorColor(originalFloorColors[targetId]);
        delete originalFloorColors[targetId];
      }
    }
  }

  function heatmapColor(value) {
    var t = Math.min(1, Math.max(0, (value - HEATMAP_MIN) / (HEATMAP_MAX - HEATMAP_MIN)));
    var r = ((HEATMAP_COLD >> 16) & 0xFF) + (((HEATMAP_HOT >> 16) & 0xFF) - ((HEATMAP_COLD >> 16) & 0xFF)) * t;
    var g = ((HEATMAP_COLD >> 8) & 0xFF) + (((HEATMAP_HOT >> 8) & 0xFF) - ((HEATMAP_COLD >> 8) & 0xFF)) * t;
    var b = (HEATMAP_COLD & 0xFF) + ((HEATMAP_HOT & 0xFF) - (HEATMAP_COLD & 0xFF)) * t;
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
  }

  function ensureLabel(targetId, x, y, elevation, level, text) {
    var label = valueLabels[targetId];
    if (!label) {
      // Flat (pitch 0) labels read best from the aerial camera
      label = new window.Label(text, x, y);
      if (typeof label.setPitch === 'function') {
        label.setPitch(0);
      }
      if (typeof label.setElevation === 'function') {
        label.setElevation(elevation);
      }
      if (typeof label.setColor === 'function') {
        label.setColor(LABEL_COLOR);
      }
      if (level !== null && typeof label.setLevel === 'function') {
        label.setLevel(level);
      }
      home.addLabel(label);
      valueLabels[targetId] = label;
    } else if (label.getText() !== text) {
      label.setText(text);
    }
  }
}
