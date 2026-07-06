/**
 * Home Assistant bindings on the Three.js dashboard.
 *
 * Same postMessage protocol as before (documented in public/panel.js), new
 * rendering vocabulary:
 *  - toggleable entities: piece materials get an amber emissive GLOW while
 *    on, plus a real shadow-casting point light whose intensity follows the
 *    light's HA brightness; rooms tint their meshes
 *  - sensor/climate: camera-facing text sprites with the live value
 *    (rooms also get a blue->red floor tint; material color multiplies the
 *    texture, so heatmaps work on textured floors without clearing them)
 *  - sun.sun elevation + weather drive the Three sun/ambient/sky
 */

import * as THREE from 'three';

var ON_EMISSIVE = 0xF9A825;
var HEATMAP_COLD = 0x64B5F6;
var HEATMAP_HOT = 0xEF5350;
var HEATMAP_MIN = 16;
var HEATMAP_MAX = 28;

var TOGGLE_CLICK_DOMAINS =
  /^(light|switch|fan|cover|lock|media_player|input_boolean|scene|script|vacuum)\./;
var VALUE_DOMAINS = /^(sensor|climate)\./;

var WEATHER_LIGHT = {
  'clear-night': 1, sunny: 1, windy: 0.95, 'windy-variant': 0.95,
  exceptional: 1, partlycloudy: 0.85, cloudy: 0.7, fog: 0.6, hail: 0.6,
  rainy: 0.6, pouring: 0.5, lightning: 0.55, 'lightning-rainy': 0.5,
  snowy: 0.75, 'snowy-rainy': 0.65
};
var NIGHT_SKY = 0x0B1526;
var GREY_SKY = 0x9AA3AD;

export function installBindings3D(api) {
  if (window.parent === window) {
    return;
  }

  var home = api.home;
  var mappings = {};
  var states = {};
  var ambient = null;
  var pointLights = {};   // targetId -> THREE.PointLight
  var valueSprites = {};  // targetId -> {sprite, canvas, context, texture, text}
  var daySky = new THREE.Color(home.getEnvironment().getSkyColor());

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
      console.info('[3d-dashboard] init: ' + Object.keys(mappings).length + ' binding(s)');
      renderStates();
    } else if (ev.data.type === 'sh3d-states') {
      states = ev.data.states || {};
      ambient = ev.data.ambient || null;
      renderStates();
      applyAmbient();
    }
  });

  api.onItemTap(function (item) {
    if (typeof item.getId !== 'function') {
      return;
    }
    var entityId = mappings[item.getId()];
    if (entityId && TOGGLE_CLICK_DOMAINS.test(entityId)) {
      post({ type: 'sh3d-toggle', entityId: entityId });
    }
  });

  // Level switches / model loading rebuild the scene: re-apply overlays
  api.setOnRebuilt(function () {
    renderStates();
  });

  post({ type: 'sh3d-ready' });

  function findItem(targetId) {
    var furniture = home.getFurniture();
    for (var i = 0; i < furniture.length; i++) {
      if (furniture[i].getId() === targetId) {
        return furniture[i];
      }
      if (furniture[i] instanceof window.HomeFurnitureGroup) {
        var all = furniture[i].getAllFurniture();
        for (var j = 0; j < all.length; j++) {
          if (all[j].getId() === targetId) {
            return all[j];
          }
        }
      }
    }
    var rooms = home.getRooms();
    for (var r = 0; r < rooms.length; r++) {
      if (rooms[r].getId() === targetId) {
        return rooms[r];
      }
    }
    return null;
  }

  function isRoom(item) {
    return typeof item.getXCenter === 'function'
        && typeof item.getFloorColor === 'function';
  }

  function renderStates() {
    for (var targetId in mappings) {
      var entityId = mappings[targetId];
      var item = findItem(targetId);
      if (item === null) {
        console.warn('[3d-dashboard] binding target not found in this home: '
          + targetId + ' -> ' + entityId);
        continue;
      }
      try {
        if (VALUE_DOMAINS.test(entityId)) {
          renderValue(targetId, item, states[entityId]);
        } else {
          renderOnOff(targetId, item, states[entityId]);
        }
      } catch (ex) {
        console.warn('[3d-dashboard] failed to render binding ' + targetId, ex);
      }
    }
    // Remove leftovers of deleted bindings
    for (var lightId in pointLights) {
      if (!(lightId in mappings)) {
        removePointLight(lightId);
      }
    }
    for (var spriteId in valueSprites) {
      if (!(spriteId in mappings)) {
        removeSprite(spriteId);
      }
    }
  }

  /** Applies an emissive/color overlay to all meshes of an item's groups. */
  function overlayItem(targetId, apply) {
    api.getGroupsByItemId(targetId).forEach(function (group) {
      group.traverse(function (object) {
        if (!object.isMesh) {
          return;
        }
        if (apply) {
          if (!object.userData.baseMaterial) {
            object.userData.baseMaterial = object.material;
            object.material = object.material.clone();
          }
          apply(object.material);
        } else if (object.userData.baseMaterial) {
          object.material.dispose();
          object.material = object.userData.baseMaterial;
          delete object.userData.baseMaterial;
        }
      });
    });
  }

  function renderOnOff(targetId, item, state) {
    var on = state !== undefined && state.state === 'on';
    if (on) {
      if (isRoom(item)) {
        overlayItem(targetId, function (material) {
          material.color.set(ON_EMISSIVE);
        });
      } else {
        overlayItem(targetId, function (material) {
          material.emissive.set(ON_EMISSIVE);
          material.emissiveIntensity = 0.55;
        });
        ensurePointLight(targetId, item, state);
      }
    } else {
      overlayItem(targetId, null);
      removePointLight(targetId);
    }
  }

  function ensurePointLight(targetId, piece, state) {
    var brightness = state && typeof state.brightness === 'number'
      ? state.brightness / 255
      : 1;
    var light = pointLights[targetId];
    if (!light) {
      light = new THREE.PointLight(0xFFC46B, 0, 0, 2);
      light.position.set(piece.getX(),
        piece.getElevation() + piece.getHeight() * 0.8, piece.getY());
      light.castShadow = true;
      light.shadow.bias = -0.002;
      api.scene.add(light);
      pointLights[targetId] = light;
    }
    light.intensity = 60000 * Math.max(0.15, brightness);
  }

  function removePointLight(targetId) {
    var light = pointLights[targetId];
    if (light) {
      api.scene.remove(light);
      light.dispose();
      delete pointLights[targetId];
    }
  }

  function renderValue(targetId, item, state) {
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
    if (isRoom(item)) {
      x = item.getXCenter();
      y = item.getYCenter();
      elevation = (typeof home.getWallHeight === 'function'
          && isFinite(home.getWallHeight()) ? home.getWallHeight() : 250) + 30;
    } else {
      x = item.getX();
      y = item.getY();
      elevation = item.getElevation() + item.getHeight() + 40;
    }
    ensureSprite(targetId, x, elevation, y, text);

    if (isRoom(item)) {
      if (isFinite(numeric)) {
        var t = Math.min(1, Math.max(0,
          (numeric - HEATMAP_MIN) / (HEATMAP_MAX - HEATMAP_MIN)));
        var heat = new THREE.Color(HEATMAP_COLD).lerp(new THREE.Color(HEATMAP_HOT), t);
        overlayItem(targetId, function (material) {
          // color multiplies the texture map: heatmap works on textured floors
          material.color.copy(heat);
        });
      } else {
        overlayItem(targetId, null);
      }
    }
  }

  function ensureSprite(targetId, x, elevation, y, text) {
    var entry = valueSprites[targetId];
    if (!entry) {
      var canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 160;
      var context = canvas.getContext('2d');
      var texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      var sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false
      }));
      sprite.renderOrder = 999;
      var spriteHeight = 55; // cm
      sprite.scale.set(spriteHeight * canvas.width / canvas.height, spriteHeight, 1);
      api.scene.add(sprite);
      entry = { sprite: sprite, canvas: canvas, context: context, texture: texture, text: null };
      valueSprites[targetId] = entry;
    }
    entry.sprite.position.set(x, elevation, y);
    if (entry.text !== text) {
      entry.text = text;
      var ctx = entry.context;
      ctx.clearRect(0, 0, entry.canvas.width, entry.canvas.height);
      ctx.font = '600 72px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 10;
      ctx.strokeStyle = 'rgba(0,0,0,.75)';
      ctx.strokeText(text, entry.canvas.width / 2, entry.canvas.height / 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(text, entry.canvas.width / 2, entry.canvas.height / 2);
      entry.texture.needsUpdate = true;
    }
  }

  function removeSprite(targetId) {
    var entry = valueSprites[targetId];
    if (entry) {
      api.scene.remove(entry.sprite);
      entry.sprite.material.map.dispose();
      entry.sprite.material.dispose();
      delete valueSprites[targetId];
    }
  }

  function applyAmbient() {
    if (!ambient || (!ambient.sun && !ambient.weather)) {
      return;
    }
    var elevation = ambient.sun && typeof ambient.sun.elevation === 'number'
      ? ambient.sun.elevation
      : (ambient.sun && ambient.sun.state === 'below_horizon' ? -18 : 45);
    var dayFactor = Math.min(1, Math.max(0, (elevation + 6) / 24));
    var weatherFactor = WEATHER_LIGHT[ambient.weather] !== undefined
      ? WEATHER_LIGHT[ambient.weather]
      : 1;
    var warmth = Math.min(1, Math.max(0, 1 - Math.abs(elevation - 4) / 8)) * weatherFactor;

    api.sun.intensity = 1.1 * (0.1 + 0.9 * dayFactor * weatherFactor);
    api.sun.color.set(0xFFF3E0).lerp(new THREE.Color(0xFF9A5C), warmth * 0.6);
    api.hemisphere.intensity = 1.15 * (0.25 + 0.75 * dayFactor);

    var sky = new THREE.Color(NIGHT_SKY)
      .lerp(daySky.clone().lerp(new THREE.Color(GREY_SKY), 1 - weatherFactor), dayFactor)
      .lerp(new THREE.Color(0xFF9A5C), warmth * 0.3);
    api.setBackground(sky);
  }
}
