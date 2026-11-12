/**
 * 3D Home Dashboard — Home Assistant custom panel.
 *
 * Registered via panel_custom (see custom_components/home_3d_dashboard/
 * __init__.py). This element owns the authenticated `hass` object and hosts
 * the Sweet Home 3D viewer in an iframe; the two sides talk over
 * postMessage (same-origin only):
 *
 *   iframe -> panel : sh3d-hello         (page boot: request config)
 *                     sh3d-ready         (home loaded: request init)
 *                     sh3d-toggle        {entityId}
 *                     sh3d-save-mappings {mappings: {pieceId: entityId}}
 *   panel -> iframe : sh3d-config        {accessToken} (re-sent on refresh)
 *                     sh3d-theme         {dark, font, vars} (HA theme, re-sent on change)
 *                     sh3d-init          {mappings, entities, areas, floors}
 *                     sh3d-states        {states: {entityId: state}}
 *
 * The panel also subscribes to home_3d_dashboard/furniture/subscribe and
 * overlays a progress bar while the furniture libraries download on first
 * start (see custom_components/home_3d_dashboard/furniture.py).
 *
 * Mappings persist through the integration's websocket commands
 * (home_3d_dashboard/get_mappings, /save_mappings) — same storage format
 * as v1.x.
 */

const FRONTEND_URL = '/home_3d_dashboard-frontend';
// HA theme variables forwarded to the editor (see src/editorTheme.js)
const THEME_VARIABLES = [
  'primary-color', 'text-primary-color', 'primary-text-color',
  'secondary-text-color', 'disabled-text-color', 'primary-background-color',
  'secondary-background-color', 'card-background-color', 'divider-color',
  'error-color', 'success-color', 'warning-color',
];
const BINDABLE_DOMAINS =
  /^(light|switch|fan|cover|lock|media_player|climate|input_boolean|scene|script|vacuum|sensor)\./;

class Home3DDashboardPanel extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._iframe = null;
    this._viewerReady = false;
    this._initSent = false;
    this._helloPending = false;
    this._lastToken = null;
    this._mappings = null;
    this._lastStatesJson = null;
    this._furnitureUnsub = null;
    this._furnitureBusySeen = false;
    this._furnitureDismissed = false;
    this._furnitureEl = null;
    this._lastThemes = null;
    this._lastThemeJson = null;
    this._onMessage = this._onMessage.bind(this);
  }

  set hass(hass) {
    this._hass = hass;
    this._subscribeFurniture();
    if (this._helloPending) {
      this._helloPending = false;
      this._sendConfig();
    } else if (this._lastToken !== null && this._accessToken() !== this._lastToken) {
      // Frontend refreshed its access token: keep the iframe's copy current
      this._sendConfig();
    }
    if (hass.themes !== this._lastThemes) {
      // The theme's CSS variables apply after this update: read them next frame
      this._lastThemes = hass.themes;
      requestAnimationFrame(() => this._sendTheme(false));
    }
    if (this._viewerReady && !this._initSent) {
      this._sendInit();
    } else if (this._initSent) {
      this._pushStates();
    }
  }

  _accessToken() {
    return (this._hass && this._hass.auth && this._hass.auth.data
      && this._hass.auth.data.access_token) || null;
  }

  _sendConfig() {
    this._lastToken = this._accessToken();
    this._sendTheme(true);
    this._post({ type: 'sh3d-config', accessToken: this._lastToken });
  }

  // Sends the HA theme (colors, font, dark mode) so the editor matches it.
  // An unchanged theme is only re-sent when `force` (page (re)load).
  _sendTheme(force) {
    if (!this._hass) {
      return;
    }
    const style = getComputedStyle(this);
    const vars = {};
    THEME_VARIABLES.forEach((name) => {
      const value = style.getPropertyValue('--' + name).trim();
      if (value) {
        vars[name] = value;
      }
    });
    const msg = {
      type: 'sh3d-theme',
      dark: !!(this._hass.themes && this._hass.themes.darkMode),
      font: style.fontFamily || '',
      vars,
    };
    const json = JSON.stringify(msg);
    if (force || json !== this._lastThemeJson) {
      this._lastThemeJson = json;
      this._post(msg);
    }
  }

  set panel(panel) {
    // unused; assigned by Home Assistant
  }

  connectedCallback() {
    // Re-attached panels (HA keeps them cached) must listen again
    window.addEventListener('message', this._onMessage);
    this._subscribeFurniture();
    if (this._iframe) {
      return;
    }
    // Size to the viewport, not the parent: HA's panel container has no
    // definite height, so `height:100%` collapses and the iframe falls back
    // to its 150px default. dvh (with a vh fallback) tracks mobile toolbars.
    this.style.cssText =
      'display:block;position:relative;height:100vh;height:100dvh;overflow:hidden;';
    this._iframe = document.createElement('iframe');
    this._iframe.src = `${FRONTEND_URL}/index.html`;
    this._iframe.style.cssText = 'width:100%;height:100%;border:0;display:block;';
    this.appendChild(this._iframe);
  }

  disconnectedCallback() {
    window.removeEventListener('message', this._onMessage);
    if (this._furnitureUnsub) {
      this._furnitureUnsub.then((unsub) => unsub()).catch(() => {});
      this._furnitureUnsub = null;
    }
  }

  /* ------------------- furniture libraries download bar ------------------ */

  _subscribeFurniture() {
    if (this._furnitureUnsub || !this.isConnected
        || !this._hass || !this._hass.connection) {
      return;
    }
    const subscription = this._hass.connection.subscribeMessage(
      (status) => this._renderFurniture(status),
      { type: 'home_3d_dashboard/furniture/subscribe' });
    this._furnitureUnsub = subscription;
    subscription.catch((err) => {
      console.warn('[3d-dashboard] furniture status unavailable', err);
      if (this._furnitureUnsub === subscription) {
        this._furnitureUnsub = null;
      }
    });
  }

  _renderFurniture(status) {
    const state = status && status.state;
    if (state === 'pending' || state === 'downloading' || state === 'installing') {
      this._furnitureBusySeen = true;
      this._furnitureDismissed = false;
    }
    // Nothing to show when the pack was already installed before this page
    // loaded, or the user closed the message.
    if (this._furnitureDismissed
        || (state === 'ready' && !this._furnitureBusySeen)) {
      this._removeFurnitureBar();
      return;
    }
    const el = this._furnitureBar();
    const fill = el.querySelector('[data-fill]');
    const label = el.querySelector('[data-label]');
    const detail = el.querySelector('[data-detail]');
    const track = el.querySelector('[data-track]');
    const action = el.querySelector('[data-action]');
    const close = el.querySelector('[data-close]');
    const mb = (bytes) => (bytes / 1e6).toFixed(0);
    fill.style.animation = '';
    fill.style.marginLeft = '0';
    fill.style.background = 'var(--primary-color, #03a9f4)';
    track.style.display = 'block';
    action.style.display = 'none';
    close.style.display = 'none';
    detail.textContent = '';

    if (state === 'downloading' || state === 'pending') {
      const total = status.total || 0;
      const received = status.received || 0;
      const pct = total ? Math.min(100, Math.floor((received / total) * 100)) : 0;
      label.textContent = `Downloading furniture libraries… ${pct}%`;
      detail.textContent = total ? `${mb(received)} / ${mb(total)} MB` : '';
      fill.style.width = `${pct}%`;
    } else if (state === 'installing') {
      label.textContent = 'Unpacking furniture libraries…';
      fill.style.width = '30%';
      fill.style.animation = 'h3d-indeterminate 1.2s ease-in-out infinite';
    } else if (state === 'error') {
      label.textContent = 'Furniture libraries could not be downloaded';
      detail.textContent = status.error || '';
      track.style.display = 'none';
      action.textContent = 'Retry';
      action.style.display = '';
      action.onclick = () => {
        this._hass.callWS({ type: 'home_3d_dashboard/furniture/retry' })
          .catch((err) => console.error('[3d-dashboard] retry failed', err));
      };
      close.style.display = '';
    } else if (state === 'ready') {
      label.textContent = 'Furniture libraries installed';
      detail.textContent = 'Reload to show them in the editor catalog.';
      fill.style.width = '100%';
      fill.style.background = 'var(--success-color, #43a047)';
      action.textContent = 'Reload';
      action.style.display = '';
      action.onclick = () => {
        this._furnitureDismissed = true;
        this._removeFurnitureBar();
        if (this._iframe && this._iframe.contentWindow) {
          this._iframe.contentWindow.location.reload();
        }
      };
      close.style.display = '';
    }
  }

  _furnitureBar() {
    if (this._furnitureEl) {
      return this._furnitureEl;
    }
    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.style.cssText = [
      'position:absolute', 'left:50%', 'bottom:16px', 'transform:translateX(-50%)',
      'z-index:5', 'box-sizing:border-box', 'width:min(420px,calc(100% - 32px))',
      'padding:12px 14px', 'border-radius:12px',
      'background:var(--card-background-color,#fff)',
      'color:var(--primary-text-color,#212121)',
      'box-shadow:0 4px 16px rgba(0,0,0,.25)',
      'font:14px/1.4 var(--ha-font-family-body,system-ui,sans-serif)',
    ].join(';');
    // Static markup only; all dynamic text goes through textContent
    el.innerHTML = `
      <style>@keyframes h3d-indeterminate {
        0% { margin-left: -30%; } 100% { margin-left: 100%; } }</style>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="flex:1;min-width:0">
          <div data-label style="font-weight:500"></div>
          <div data-detail style="font-size:12px;opacity:.7;overflow-wrap:anywhere"></div>
        </div>
        <button data-action type="button" style="border:0;border-radius:6px;padding:6px 12px;
          cursor:pointer;font:inherit;font-weight:500;color:var(--text-primary-color,#fff);
          background:var(--primary-color,#03a9f4)"></button>
        <button data-close type="button" aria-label="Close" style="border:0;background:none;
          cursor:pointer;font-size:18px;line-height:1;padding:4px;color:inherit;opacity:.6">×</button>
      </div>
      <div data-track style="margin-top:8px;height:6px;border-radius:3px;overflow:hidden;
        background:var(--divider-color,rgba(0,0,0,.12))">
        <div data-fill style="height:100%;width:0;border-radius:3px;transition:width .3s"></div>
      </div>`;
    el.querySelector('[data-close]').onclick = () => {
      this._furnitureDismissed = true;
      this._removeFurnitureBar();
    };
    this.appendChild(el);
    this._furnitureEl = el;
    return el;
  }

  _removeFurnitureBar() {
    if (this._furnitureEl) {
      this._furnitureEl.remove();
      this._furnitureEl = null;
    }
  }

  _onMessage(ev) {
    if (ev.origin !== window.location.origin
        || !this._iframe
        || ev.source !== this._iframe.contentWindow
        || !ev.data
        || typeof ev.data.type !== 'string') {
      return;
    }
    switch (ev.data.type) {
      case 'sh3d-hello':
        if (this._hass) {
          this._sendConfig();
        } else {
          this._helloPending = true;
        }
        break;
      case 'sh3d-ready':
        this._viewerReady = true;
        this._initSent = false; // a page reload (view/edit toggle) re-inits
        if (this._hass) {
          this._sendInit();
        }
        break;
      case 'sh3d-toggle':
        if (this._hass && typeof ev.data.entityId === 'string') {
          console.info('[3d-dashboard] toggle', ev.data.entityId);
          this._hass
            .callService('homeassistant', 'toggle', { entity_id: ev.data.entityId })
            .catch((err) =>
              console.error('[3d-dashboard] toggle failed', ev.data.entityId, err));
        }
        break;
      case 'sh3d-save-mappings':
        if (this._hass && ev.data.mappings && typeof ev.data.mappings === 'object') {
          this._mappings = ev.data.mappings;
          this._hass.callWS({
            type: 'home_3d_dashboard/save_mappings',
            mappings: this._mappings,
          });
          this._lastStatesJson = null;
          this._pushStates();
        }
        break;
    }
  }

  async _sendInit() {
    this._initSent = true;
    try {
      const raw = await this._hass.callWS({
        type: 'home_3d_dashboard/get_mappings',
      });
      // Drop v1.x legacy entries (mesh-name keys with object values); only
      // pieceId -> entityId string mappings are meaningful since v2
      this._mappings = {};
      for (const key of Object.keys(raw || {})) {
        if (typeof raw[key] === 'string') {
          this._mappings[key] = raw[key];
        }
      }
    } catch (err) {
      console.error('[home_3d_dashboard] get_mappings failed', err);
      this._mappings = {};
    }
    const registry = this._hass.entities || {};
    const devices = this._hass.devices || {};
    const entities = Object.keys(this._hass.states)
      .filter((id) => BINDABLE_DOMAINS.test(id))
      .sort()
      .map((id) => {
        const attributes = this._hass.states[id].attributes;
        const entry = registry[id];
        if (entry && entry.hidden) {
          return null;
        }
        const device = entry && entry.device_id ? devices[entry.device_id] : null;
        return {
          entity_id: id,
          name: attributes.friendly_name || id,
          // An entity's own area overrides its device's area
          area_id: (entry && entry.area_id) || (device && device.area_id) || null,
          device_class: attributes.device_class || null,
          unit: attributes.unit_of_measurement || null,
        };
      })
      .filter(Boolean);
    // Floors and areas let the editor's simple mode offer "your rooms"
    // (hass.floors/areas exist since HA 2024.4; older versions send none).
    const areas = Object.values(this._hass.areas || {})
      .map((area) => ({
        area_id: area.area_id,
        name: area.name,
        floor_id: area.floor_id || null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const floors = Object.values(this._hass.floors || {})
      .map((floor) => ({
        floor_id: floor.floor_id,
        name: floor.name,
        level: typeof floor.level === 'number' ? floor.level : null,
      }))
      .sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name));
    console.info('[3d-dashboard] init sent: '
      + Object.keys(this._mappings).length + ' mapping(s), '
      + entities.length + ' bindable entities, '
      + areas.length + ' area(s), ' + floors.length + ' floor(s)');
    this._post({
      type: 'sh3d-init', mappings: this._mappings, entities, areas, floors,
    });
    this._lastStatesJson = null;
    this._pushStates();
  }

  _pushStates() {
    if (!this._hass || !this._mappings) {
      return;
    }
    const states = {};
    for (const pieceId of Object.keys(this._mappings)) {
      const entityId = this._mappings[pieceId];
      const state = this._hass.states[entityId];
      if (state) {
        states[entityId] = {
          state: state.state,
          unit: state.attributes.unit_of_measurement,
          currentTemperature: state.attributes.current_temperature,
          brightness: state.attributes.brightness,
          colorTempKelvin: state.attributes.color_temp_kelvin,
          rgbColor: state.attributes.rgb_color,
        };
      }
    }
    // Ambient context for the day/night + weather scene mood (see
    // src/dashboardEffects.js in the viewer).
    const ambient = {};
    const sun = this._hass.states['sun.sun'];
    if (sun) {
      ambient.sun = {
        state: sun.state,
        elevation: sun.attributes.elevation,
      };
    }
    const weatherId = Object.keys(this._hass.states)
      .find((id) => id.startsWith('weather.'));
    if (weatherId) {
      ambient.weather = this._hass.states[weatherId].state;
    }
    const json = JSON.stringify([states, ambient]);
    if (json !== this._lastStatesJson) {
      this._lastStatesJson = json;
      this._post({ type: 'sh3d-states', states, ambient });
    }
  }

  _post(msg) {
    if (this._iframe && this._iframe.contentWindow) {
      this._iframe.contentWindow.postMessage(msg, window.location.origin);
    }
  }
}

customElements.define('home-3d-dashboard-panel', Home3DDashboardPanel);
