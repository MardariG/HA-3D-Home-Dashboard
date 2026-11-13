/**
 * Home Assistant theme for the editor page.
 *
 * The panel (public/panel.js) sends `sh3d-theme` {dark, font, vars} with the
 * HA theme's resolved CSS variables; they are copied onto <html> as the
 * --h3d-* variables that src/editorTheme.css styles the editor with. Without
 * a panel (standalone build) the light defaults from editorTheme.css apply.
 *
 * The ⋮ menu's appearance choice (src/advancedUi.js) can force light or dark
 * whatever HA uses; then HA's neutral colors (made for the other mode) are
 * left out for editorTheme.css's own, and only its accent colors are kept.
 *
 * The plan follows too: Sweet Home 3D draws walls, room names and dimensions
 * in the plan's text color over its background, both read once when a plan
 * is created, so they are handed to the plan again at each change.
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

// Colors made for HA's light or dark mode, not used in the other one
var NEUTRAL = {
  'primary-text-color': true,
  'secondary-text-color': true,
  'disabled-text-color': true,
  'primary-background-color': true,
  'secondary-background-color': true,
  'card-background-color': true,
  'divider-color': true
};

var APPEARANCE_KEY = 'home_3d_dashboard.appearance';
var APPEARANCES = ['auto', 'light', 'dark'];

var lastTheme = { dark: false };
var application = null;
var appearanceListeners = [];

/** 'auto' (follow Home Assistant), 'light' or 'dark'. */
export function getAppearance() {
  try {
    var stored = window.localStorage.getItem(APPEARANCE_KEY);
    return APPEARANCES.indexOf(stored) >= 0 ? stored : 'auto';
  } catch (e) {
    return 'auto';
  }
}

export function setAppearance(appearance) {
  try {
    window.localStorage.setItem(APPEARANCE_KEY, appearance);
  } catch (e) {
    // storage unavailable: the choice lasts until the page is left
  }
  applyTheme(lastTheme, appearance);
  appearanceListeners.forEach(function (listener) {
    listener(appearance);
  });
}

/** Calls listener(appearance) when the appearance choice changes. */
export function onAppearanceChange(listener) {
  appearanceListeners.push(listener);
}

/**
 * Hands the theme to the plans of `app`'s homes, now and at each change
 * (see the header comment). Call once the application exists.
 */
export function followThemeInPlans(app) {
  application = app;
  fixGridColor();
  app.addHomesListener(function () {
    setTimeout(refreshPlans, 0);
  });
  refreshPlans();
}

// The engine's grid color (PlanComponent.getGridColor) adds up the color
// channels unshifted: black on white gives #AAAAAA, but light text on a
// dark plan gives white. Same weights, per channel: 2/3 background.
function fixGridColor() {
  var PlanComponent = window.PlanComponent;
  var ColorTools = window.ColorTools;
  if (typeof PlanComponent !== 'function' || !ColorTools || PlanComponent.prototype.h3dGridColor) {
    return;
  }
  PlanComponent.prototype.h3dGridColor = true;
  PlanComponent.prototype.getGridColor = function () {
    if (this.gridColor == null) {
      var background = ColorTools.styleToInteger(this.canvas.style.backgroundColor);
      var foreground = ColorTools.styleToInteger(this.canvas.style.color);
      var mix = 0xAAAAAA;
      if (background >= 0 && foreground >= 0) {
        mix = 0;
        [16, 8, 0].forEach(function (shift) {
          var channel = Math.round((((background >> shift) & 0xFF) * 2 + ((foreground >> shift) & 0xFF)) / 3);
          mix |= channel << shift;
        });
      }
      this.gridColor = ColorTools.integerToHexadecimalString(mix);
    }
    return this.gridColor;
  };
}

function refreshPlans() {
  var PlanComponent = window.PlanComponent;
  var container = document.getElementById('home-plan');
  if (typeof PlanComponent !== 'function' || !container) {
    return;
  }
  var style = window.getComputedStyle(container);
  var background = style.backgroundColor;
  var foreground = style.color;
  // Read by plans created from now on (another home opened)
  PlanComponent.initialBackgroundColor = background;
  PlanComponent.initialForegroundColor = foreground;
  PlanComponent.DEFAULT_SELECTION_COLOR = null;
  if (!application) {
    return;
  }
  application.getHomes().forEach(function (home) {
    var plan = null;
    try {
      plan = application.getHomeController(home).getPlanController().getView();
    } catch (e) {
      return;
    }
    if (!plan || !plan.canvas
        || (plan.canvas.style.backgroundColor === background && plan.canvas.style.color === foreground)) {
      return;
    }
    plan.canvas.style.backgroundColor = background;
    plan.canvas.style.color = foreground;
    // Colors the plan derived and kept
    plan.background = null;
    plan.foreground = null;
    plan.gridColor = null;
    plan.patternImagesCache = {};
    if (plan.tooltip && window.ColorTools) {
      plan.tooltip.style.backgroundColor = window.ColorTools.toRGBAStyle(plan.getBackground(), 0.7);
      plan.tooltip.style.borderColor = window.ColorTools.toRGBAStyle(plan.getForeground(), 0.7);
      plan.tooltip.style.color = foreground;
    }
    plan.repaint();
  });
}

// Only plain colors are copied: a theme value is inserted into a style
// attribute, so anything else (url(), expressions, ...) is ignored.
var COLOR = /^(#[0-9a-f]{3,8}|(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([0-9a-z.,%\s/+-]*\)|[a-z]+)$/i;
var FONT = /^[0-9a-z\s"',_-]+$/i;

function applyTheme(theme, appearance) {
  lastTheme = theme;
  appearance = appearance || getAppearance();
  var dark = appearance === 'auto' ? !!theme.dark : appearance === 'dark';
  var neutrals = dark === !!theme.dark;
  var root = document.documentElement;
  var vars = theme.vars || {};
  Object.keys(VARIABLES).forEach(function (name) {
    var value = typeof vars[name] === 'string' ? vars[name].trim() : '';
    if (value && COLOR.test(value) && (neutrals || !NEUTRAL[name])) {
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
  root.classList.toggle('h3d-dark', dark);
  refreshPlans();
}

/** Listens for theme updates from the panel. Call before the editor starts. */
export function installEditorTheme() {
  // The appearance choice, until (or without) the panel's theme
  applyTheme(lastTheme);
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
