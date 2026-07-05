/**
 * Ambient scene mood for the dashboard (HA build, viewer page).
 *
 * Drives the engine's live-wired HomeEnvironment properties from real-world
 * context supplied by the panel (sun.sun elevation + weather state):
 *  - LIGHT_COLOR  -> re-lights the whole scene (HomeComponent3D listener)
 *  - SKY_COLOR    -> background sky
 *  - GROUND_COLOR -> ground plane
 *
 * The home's authored colors are captured on first use and act as the
 * "bright day" reference, so the effect respects whatever the user set in
 * the editor.
 */

// How much light each weather state leaves (1 = full sun)
var WEATHER_LIGHT = {
  'clear-night': 1,
  sunny: 1,
  windy: 0.95,
  'windy-variant': 0.95,
  exceptional: 1,
  partlycloudy: 0.85,
  cloudy: 0.7,
  fog: 0.6,
  hail: 0.6,
  rainy: 0.6,
  pouring: 0.5,
  lightning: 0.55,
  'lightning-rainy': 0.5,
  snowy: 0.75,
  'snowy-rainy': 0.65
};

var NIGHT_LIGHT = 0x2E3A5C; // dim blue indoor light at night
var NIGHT_SKY = 0x0B1526;   // dark navy sky
var GREY_SKY = 0x9AA3AD;    // overcast sky
var WARM_LIGHT = 0xFFB466;  // sunrise / sunset tint
var WARM_SKY = 0xFF9A5C;

var originalColors = null;
var lastApplied = null;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerpColor(from, to, t) {
  var r = ((from >> 16) & 0xFF) + (((to >> 16) & 0xFF) - ((from >> 16) & 0xFF)) * t;
  var g = ((from >> 8) & 0xFF) + (((to >> 8) & 0xFF) - ((from >> 8) & 0xFF)) * t;
  var b = (from & 0xFF) + ((to & 0xFF) - (from & 0xFF)) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

function scaleColor(color, factor) {
  return lerpColor(0x000000, color, clamp(factor, 0, 1));
}

export function applyAmbient(home, ambient) {
  if (!home || !ambient || (!ambient.sun && !ambient.weather)) {
    return;
  }
  var environment = home.getEnvironment();
  if (originalColors === null) {
    originalColors = {
      light: environment.getLightColor(),
      sky: environment.getSkyColor(),
      ground: environment.getGroundColor()
    };
  }

  // 0 = deep night, 1 = full day; ramp through civil twilight (-6..+18 deg)
  var elevation = ambient.sun && typeof ambient.sun.elevation === 'number'
    ? ambient.sun.elevation
    : (ambient.sun && ambient.sun.state === 'below_horizon' ? -18 : 45);
  var dayFactor = clamp((elevation + 6) / 24, 0, 1);

  var weatherFactor = WEATHER_LIGHT[ambient.weather] !== undefined
    ? WEATHER_LIGHT[ambient.weather]
    : 1;
  var cloudiness = 1 - weatherFactor;

  // Sunrise/sunset warmth peaks around +4 deg elevation, fades over +/-8
  var warmth = clamp(1 - Math.abs(elevation - 4) / 8, 0, 1) * weatherFactor;

  var light = lerpColor(NIGHT_LIGHT, originalColors.light, dayFactor);
  light = scaleColor(light, 0.6 + 0.4 * weatherFactor);
  light = lerpColor(light, WARM_LIGHT, warmth * 0.45);

  var daySky = lerpColor(originalColors.sky, GREY_SKY, cloudiness);
  var sky = lerpColor(NIGHT_SKY, daySky, dayFactor);
  sky = lerpColor(sky, WARM_SKY, warmth * 0.35);

  var ground = scaleColor(originalColors.ground,
    0.25 + 0.75 * dayFactor * (0.7 + 0.3 * weatherFactor));

  var key = light + '/' + sky + '/' + ground;
  if (key === lastApplied) {
    return;
  }
  lastApplied = key;
  environment.setLightColor(light);
  environment.setSkyColor(sky);
  environment.setGroundColor(ground);
}
