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
  button.href = targetPage;
  button.style.cssText =
    'position:fixed;' + vertical + 'right:10px;z-index:10000;' +
    'padding:6px 16px;background:#03a9f4;color:#fff;' +
    'font:600 13px/1.4 system-ui,sans-serif;text-decoration:none;' +
    'border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:pointer;';
  document.body.appendChild(button);
}
