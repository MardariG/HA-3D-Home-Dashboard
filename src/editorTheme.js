/**
 * Home Assistant theme for the editor page.
 *
 * The panel (public/panel.js) sends `sh3d-theme` {dark, font, vars} with the
 * HA theme's resolved CSS variables; they are copied onto <html> as the
 * --h3d-* variables that src/editorTheme.css styles the editor with. Without
 * a panel (standalone build) the light defaults from editorTheme.css apply.
 *
 * The plan keeps its light background in dark themes: Sweet Home 3D draws
 * walls, room names and dimensions in the plan's text color, captured once
 * when the plan is created.
 */

// HA variable -> editor variable
var VARIABLES = {
  'primary-color': '--h3d-primary',
  'text-primary-color': '--h3d-on-primary',
  'primary-text-color': '--h3d-text',
  'secondary-text-color': '--h3d-text2',
  'disabled-text-color': '--h3d-disabled',
  'primary-background-color': '--h3d-bg',
  'secondary-background-color': '--h3d-bg2',
  'card-background-color': '--h3d-card',
  'divider-color': '--h3d-divider',
  'error-color': '--h3d-error',
  'success-color': '--h3d-success',
  'warning-color': '--h3d-warning'
};

// Only plain colors are copied: a theme value is inserted into a style
// attribute, so anything else (url(), expressions, ...) is ignored.
var COLOR = /^(#[0-9a-f]{3,8}|(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([0-9a-z.,%\s/+-]*\)|[a-z]+)$/i;
var FONT = /^[0-9a-z\s"',_-]+$/i;

function applyTheme(theme) {
  var root = document.documentElement;
  var vars = theme.vars || {};
  Object.keys(VARIABLES).forEach(function (name) {
    var value = typeof vars[name] === 'string' ? vars[name].trim() : '';
    if (value && COLOR.test(value)) {
      root.style.setProperty(VARIABLES[name], value);
    } else {
      root.style.removeProperty(VARIABLES[name]);
    }
  });
  if (typeof theme.font === 'string' && theme.font && FONT.test(theme.font)) {
    root.style.setProperty('--h3d-font', theme.font + ', system-ui, -apple-system, "Segoe UI", sans-serif');
  } else {
    root.style.removeProperty('--h3d-font');
  }
  root.classList.toggle('h3d-dark', !!theme.dark);
}

/** Listens for theme updates from the panel. Call before the editor starts. */
export function installEditorTheme() {
  if (window.parent === window) {
    return;
  }
  window.addEventListener('message', function (ev) {
    if (ev.origin !== window.location.origin
        || ev.source !== window.parent
        || !ev.data
        || ev.data.type !== 'sh3d-theme') {
      return;
    }
    applyTheme(ev.data);
  });
}
