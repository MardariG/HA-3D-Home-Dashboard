/**
 * Helpers for the Home Assistant build (__HA_BUILD__).
 */

/**
 * Adds a fixed button in the top-right corner that switches between the
 * viewer page (view mode) and the editor page (edit mode).
 * @param {string} targetPage e.g. 'editor.html' or 'index.html'
 * @param {string} label button text
 * @param {{top: number}|{bottom: number}} [position] offset in px (default top:10)
 */
export function addModeToggle(targetPage, label, position) {
  var vertical = position && position.bottom !== undefined
    ? 'bottom:' + position.bottom + 'px;'
    : 'top:' + ((position && position.top) || 10) + 'px;';
  var button = document.createElement('a');
  button.textContent = label;
  // Keeps the page's ?v=<version> (see public/panel.js)
  button.href = targetPage + window.location.search;
  button.style.cssText =
    'position:fixed;' + vertical + 'right:10px;z-index:10000;' +
    // The editor's HA theme variables (src/editorTheme.css) when present
    'padding:7px 18px;background:var(--h3d-primary,#03a9f4);color:var(--h3d-on-primary,#fff);' +
    'font:500 13px/1.4 var(--h3d-font,system-ui,sans-serif);text-decoration:none;' +
    'border-radius:18px;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:pointer;';
  document.body.appendChild(button);
}

/**
 * Tells the user when an update isn't fully active yet, from the panel's
 * sh3d-config (src/haAuth.js getPanelConfig): an old panel script still
 * running sends no `home`; a new panel on a not yet restarted integration
 * reports homesSupported: false. Either way the active home can't change.
 * @param {Object|null} config
 */
export function showUpdateNotice(config) {
  if (!config) {
    return;
  }
  var text = null;
  if (!('home' in config)) {
    text = 'Home Assistant is still running the previous version of the 3D Dashboard panel. '
      + 'Reload this page (Ctrl+F5) to finish updating.';
  } else if (config.homesSupported === false) {
    text = 'Restart Home Assistant to finish updating the 3D Dashboard. Until then, '
      + 'new homes and switching homes won\'t show on the dashboard.';
  }
  if (!text) {
    return;
  }
  var notice = document.createElement('div');
  notice.setAttribute('role', 'status');
  notice.style.cssText =
    'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:10005;' +
    'display:flex;align-items:center;gap:10px;max-width:min(640px,calc(100vw - 32px));' +
    'padding:8px 8px 8px 16px;border-radius:12px;box-sizing:border-box;' +
    'background:var(--h3d-warning,#ffa600);color:#000;' +
    'font:500 13px/1.4 var(--h3d-font,system-ui,sans-serif);box-shadow:0 2px 10px rgba(0,0,0,.35);';
  var message = document.createElement('span');
  message.textContent = text;
  message.style.color = '#000';
  var close = document.createElement('button');
  close.textContent = '×';
  close.title = 'Dismiss';
  close.style.cssText = 'flex:none;width:26px;height:26px;border:0;border-radius:50%;' +
    'background:rgba(0,0,0,.12);color:#000;font:16px/26px system-ui,sans-serif;cursor:pointer;';
  close.addEventListener('click', function () {
    notice.remove();
  });
  notice.appendChild(message);
  notice.appendChild(close);
  document.body.appendChild(notice);
}
