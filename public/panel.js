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
 *                     sh3d-init          {mappings, entities}
 *                     sh3d-states        {states: {entityId: state}}
 *
 * Mappings persist through the integration's websocket commands
 * (home_3d_dashboard/get_mappings, /save_mappings) — same storage format
 * as v1.x.
 */

const FRONTEND_URL = '/home_3d_dashboard-frontend';
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
    this._onMessage = this._onMessage.bind(this);
  }

  set hass(hass) {
    this._hass = hass;
    if (this._helloPending) {
      this._helloPending = false;
      this._sendConfig();
    } else if (this._lastToken !== null && this._accessToken() !== this._lastToken) {
      // Frontend refreshed its access token: keep the iframe's copy current
      this._sendConfig();
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
    this._post({ type: 'sh3d-config', accessToken: this._lastToken });
  }

  set panel(panel) {
    // unused; assigned by Home Assistant
  }

  connectedCallback() {
    if (this._iframe) {
      return;
    }
    this.style.cssText = 'display:block;height:100%;';
    this._iframe = document.createElement('iframe');
    this._iframe.src = `${FRONTEND_URL}/index.html`;
    this._iframe.style.cssText = 'width:100%;height:100%;border:0;display:block;';
    this.appendChild(this._iframe);
    window.addEventListener('message', this._onMessage);
  }

  disconnectedCallback() {
    window.removeEventListener('message', this._onMessage);
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
      this._mappings = await this._hass.callWS({
        type: 'home_3d_dashboard/get_mappings',
      });
    } catch (err) {
      console.error('[home_3d_dashboard] get_mappings failed', err);
      this._mappings = {};
    }
    const entities = Object.keys(this._hass.states)
      .filter((id) => BINDABLE_DOMAINS.test(id))
      .sort()
      .map((id) => ({
        entity_id: id,
        name: this._hass.states[id].attributes.friendly_name || id,
      }));
    console.info('[3d-dashboard] init sent: '
      + Object.keys(this._mappings).length + ' mapping(s), '
      + entities.length + ' bindable entities');
    this._post({ type: 'sh3d-init', mappings: this._mappings, entities });
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
