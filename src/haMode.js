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

/**
 * A centered card for something the user must know or do instead of seeing
 * their home (no home yet, sign-in refused, load failure). Replaces the
 * previous card. Uses the editor's theme variables when present (dark
 * defaults match the dashboard's background).
 * @param {{icon?: string, title: string, text: string, details?: string,
 *          actions?: Array<{label: string, primary?: boolean,
 *                           href?: string, onClick?: function}>}} options
 *   icon: an SVG path (24×24, e.g. from @mdi/js)
 */
export function showMessageCard(options) {
  var previous = document.getElementById('h3d-message');
  if (previous) {
    previous.remove();
  }
  var overlay = document.createElement('div');
  overlay.id = 'h3d-message';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:9990;display:flex;align-items:center;justify-content:center;' +
    'padding:16px;box-sizing:border-box;pointer-events:none;';
  var card = document.createElement('div');
  card.setAttribute('role', 'alert');
  card.style.cssText =
    'pointer-events:auto;box-sizing:border-box;width:100%;max-width:440px;padding:28px 28px 22px;' +
    'border-radius:16px;text-align:center;background:var(--h3d-card,#262640);' +
    'color:var(--h3d-text,#f1f1f5);box-shadow:0 8px 32px rgba(0,0,0,.45);' +
    'font:14px/1.5 var(--h3d-font,system-ui,-apple-system,"Segoe UI",sans-serif);';
  if (options.icon) {
    var icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('width', '48');
    icon.setAttribute('height', '48');
    icon.setAttribute('aria-hidden', 'true');
    icon.style.cssText = 'display:block;margin:0 auto 12px;fill:var(--h3d-primary,#03a9f4);';
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', options.icon);
    icon.appendChild(path);
    card.appendChild(icon);
  }
  var title = document.createElement('h2');
  title.textContent = options.title;
  title.style.cssText = 'margin:0 0 8px;font-size:20px;font-weight:500;color:inherit;';
  card.appendChild(title);
  var text = document.createElement('p');
  text.textContent = options.text;
  text.style.cssText = 'margin:0;color:var(--h3d-text2,#b4b4c4);';
  card.appendChild(text);
  var actions = options.actions || [];
  if (actions.length) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:20px;';
    actions.forEach(function (action) {
      var button = document.createElement(action.href ? 'a' : 'button');
      button.textContent = action.label;
      if (action.href) {
        button.href = action.href;
      }
      if (action.onClick) {
        button.addEventListener('click', function (ev) {
          ev.preventDefault();
          action.onClick();
        });
      }
      button.style.cssText =
        'display:inline-block;padding:9px 20px;border-radius:18px;cursor:pointer;text-decoration:none;' +
        'font:500 14px/1.3 inherit;font-family:inherit;' +
        (action.primary
          ? 'border:0;background:var(--h3d-primary,#03a9f4);color:var(--h3d-on-primary,#fff);'
          : 'border:1px solid var(--h3d-primary,#03a9f4);background:transparent;color:var(--h3d-primary,#03a9f4);');
      row.appendChild(button);
    });
    card.appendChild(row);
  }
  if (options.details) {
    var details = document.createElement('details');
    details.style.cssText = 'margin-top:18px;font-size:12px;color:var(--h3d-text2,#b4b4c4);';
    var summary = document.createElement('summary');
    summary.textContent = 'Technical details';
    summary.style.cssText = 'cursor:pointer;color:inherit;';
    var detailText = document.createElement('div');
    detailText.textContent = options.details;
    detailText.style.cssText = 'margin-top:6px;word-break:break-word;color:inherit;';
    details.appendChild(summary);
    details.appendChild(detailText);
    card.appendChild(details);
  }
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  return overlay;
}

/** Removes the card shown by showMessageCard, if any. */
export function hideMessageCard() {
  var card = document.getElementById('h3d-message');
  if (card) {
    card.remove();
  }
}
