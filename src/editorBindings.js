/**
 * Entity binding AUTHORING for the editor page (HA build).
 *
 * The editor runs in the same panel iframe as the viewer (the View/Edit
 * toggle navigates the iframe), so the same postMessage bridge to the
 * custom panel element (public/panel.js) applies.
 *
 * UX: right-click a furniture piece (furniture list, plan or 3D view) and
 * choose "Bind to entity…" — the item is injected through the
 * window.__sh3dAppendBindMenuItem hook that HomePane's popup builders call.
 * Mappings are keyed by the piece's persistent id, which survives saves.
 *
 * Does nothing when not embedded in the HA panel.
 */

export function installEditorBindings(application) {
  if (window.parent === window) {
    return;
  }

  var entities = [];
  var mappings = {};
  var bridgeReady = false;

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
      entities = ev.data.entities || [];
      mappings = ev.data.mappings || {};
      bridgeReady = true;
    }
    // sh3d-states is ignored in the editor: no live tinting while authoring
  });

  // Announce readiness once the home is open, so the panel sends init.
  var waiter = setInterval(function () {
    if (application.getHomes().length > 0) {
      clearInterval(waiter);
      post({ type: 'sh3d-ready' });
    }
  }, 250);

  function selectedPiece(home) {
    var selected = home.getSelectedItems().filter(function (item) {
      return typeof item.getId === 'function'
          && typeof item.getName === 'function'
          && typeof item.getModel === 'function'; // furniture only
    });
    return selected.length === 1 ? selected[0] : null;
  }

  // Called by the popup menu builders in HomePane.js (furniture list, plan
  // and 3D view). Right-clicking an item selects it first, so the current
  // selection is the menu's target.
  window.__sh3dAppendBindMenuItem = function (builder, home) {
    if (!bridgeReady) {
      return;
    }
    var piece = selectedPiece(home);
    if (piece === null) {
      return;
    }
    var current = mappings[piece.getId()];
    var label = current
      ? 'Bind to entity… (' + current + ')'
      : 'Bind to entity…';
    builder.addMenuItem(label, function () {
      showPicker(piece);
    });
  };

  var picker = null;

  function showPicker(piece) {
    hidePicker();
    var pieceId = piece.getId();
    picker = document.createElement('div');
    picker.style.cssText =
      'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'z-index:10001;background:#263238;color:#fff;padding:14px;' +
      'border-radius:6px;box-shadow:0 2px 12px rgba(0,0,0,.6);' +
      'font:13px/1.5 system-ui,sans-serif;width:340px;';

    var title = document.createElement('div');
    title.textContent = 'Bind "' + (piece.getName() || 'piece') + '" to:';
    title.style.cssText = 'font-weight:600;margin-bottom:8px;';
    picker.appendChild(title);

    var select = null;
    if (entities.length === 0) {
      var hint = document.createElement('div');
      hint.textContent =
        'No bindable entities found in Home Assistant (looking for light, '
        + 'switch, fan, cover, lock, media_player, climate, input_boolean, '
        + 'scene, script, vacuum). Create one — e.g. Settings → Devices'
        + ' & Services → Helpers → Toggle — then reload this page.';
      hint.style.cssText = 'margin-bottom:8px;color:#ffcc80;';
      picker.appendChild(hint);
    } else {
      select = document.createElement('select');
      select.style.cssText = 'width:100%;margin-bottom:10px;padding:4px;';
      var none = document.createElement('option');
      none.value = '';
      none.textContent = '— no entity —';
      select.appendChild(none);
      for (var i = 0; i < entities.length; i++) {
        var option = document.createElement('option');
        option.value = entities[i].entity_id;
        option.textContent = entities[i].name + ' (' + entities[i].entity_id + ')';
        select.appendChild(option);
      }
      select.value = mappings[pieceId] || '';
      picker.appendChild(select);
    }

    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
    actions.appendChild(pickerButton('Cancel', '#455a64', hidePicker));
    if (select !== null) {
      actions.appendChild(pickerButton('Save', '#03a9f4', function () {
        if (select.value) {
          mappings[pieceId] = select.value;
        } else {
          delete mappings[pieceId];
        }
        post({ type: 'sh3d-save-mappings', mappings: mappings });
        hidePicker();
        showToast(select.value
          ? 'Bound to ' + select.value + ' — switch to View to use it.'
          : 'Binding removed.');
      }));
    }
    picker.appendChild(actions);
    document.body.appendChild(picker);
  }

  function pickerButton(label, background, onClick) {
    var btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText =
      'padding:4px 12px;border:0;border-radius:4px;color:#fff;cursor:pointer;' +
      'font:600 12px/1.4 system-ui,sans-serif;background:' + background + ';';
    btn.addEventListener('click', onClick);
    return btn;
  }

  function hidePicker() {
    if (picker) {
      picker.remove();
      picker = null;
    }
  }

  var toast = null;

  function showToast(text) {
    if (toast) {
      toast.remove();
    }
    toast = document.createElement('div');
    toast.textContent = text;
    toast.style.cssText =
      'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);' +
      'z-index:10002;max-width:420px;background:rgba(38,50,56,.95);' +
      'color:#fff;padding:8px 14px;border-radius:6px;' +
      'font:13px/1.5 system-ui,sans-serif;';
    document.body.appendChild(toast);
    setTimeout(function () {
      if (toast) {
        toast.remove();
        toast = null;
      }
    }, 4000);
  }
}
