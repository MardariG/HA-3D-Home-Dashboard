"""3D Home Dashboard - HA integration.

Serves the webpack-built Sweet Home 3D web editor as a sidebar panel and
exposes:
  - an HTTP API to list / read / write / delete `.sh3d` home files stored
    under `<config>/home_3d_dashboard/` (see http.py),
  - websocket commands to persist piece -> entity mappings (per home) and
    settings, including the active home the dashboard shows (carried over
    from v1.x; the "default" home keeps the v1-compatible storage).
"""
from __future__ import annotations

import json
import logging
import shutil
from pathlib import Path

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.components.frontend import (
    async_register_built_in_panel,
    async_remove_panel,
)
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.typing import ConfigType

from .furniture import (
    SIGNAL_FURNITURE_STATUS,
    STATE_ERROR,
    FurniturePack,
    prepare_pack_dir,
)
from .furniture_pack_info import FURNITURE_LIBRARIES
from .http import HomesListView, HomeView, safe_home_path

_LOGGER = logging.getLogger(__name__)

DOMAIN = "home_3d_dashboard"
STORAGE_KEY = "home_3d_dashboard_mappings"
FRONTEND_URL = "/home_3d_dashboard-frontend"
PANEL_URL_PATH = "home-3d-dashboard"
RESOURCES_URL = "/com/eteks/sweethome3d/io/resources"

WS_GET = DOMAIN + "/get_mappings"
WS_SAVE = DOMAIN + "/save_mappings"
WS_GET_SETTINGS = DOMAIN + "/get_settings"
WS_SAVE_SETTINGS = DOMAIN + "/save_settings"
WS_GET_ACTIVE_HOME = DOMAIN + "/get_active_home"
WS_SET_ACTIVE_HOME = DOMAIN + "/set_active_home"
WS_FURNITURE_SUBSCRIBE = DOMAIN + "/furniture/subscribe"
WS_FURNITURE_RETRY = DOMAIN + "/furniture/retry"

CONFIG_SCHEMA = vol.Schema({DOMAIN: vol.Schema({})}, extra=vol.ALLOW_EXTRA)

# The home created on first start; its bindings live in the top-level
# "mappings" (v1-compatible), other homes' in "home_mappings"[name].
DEFAULT_HOME = "default"
ACTIVE_HOME_SETTING = "active_home"


async def _setup_integration(hass: HomeAssistant) -> None:
    hass.data.setdefault(
        DOMAIN,
        {"mappings": {}, "home_mappings": {}, "settings": {}, "_setup_done": False},
    )
    if hass.data[DOMAIN]["_setup_done"]:
        return
    hass.data[DOMAIN]["_setup_done"] = True

    homes_dir = Path(hass.config.path(DOMAIN))
    pack_dir = homes_dir / "furniture"
    frontend_dir = Path(__file__).parent / "frontend"
    await hass.async_add_executor_job(_init_homes_dir, homes_dir, frontend_dir)
    await hass.async_add_executor_job(prepare_pack_dir, pack_dir)
    await hass.async_add_executor_job(_load_data, hass)
    # Heavy immutable assets (engine scripts, icons, 3D models) get long
    # cache headers; only the HTML shells stay uncached so upgrades land.
    # More specific paths must be registered before the frontend root,
    # since aiohttp resolves prefixed resources in registration order.
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(f"{FRONTEND_URL}/vendor", str(frontend_dir / "vendor"), True),
            StaticPathConfig(f"{FRONTEND_URL}/src", str(frontend_dir / "src"), True),
            StaticPathConfig(f"{FRONTEND_URL}/lib", str(frontend_dir / "lib"), True),
            StaticPathConfig(f"{FRONTEND_URL}/assets", str(frontend_dir / "assets"), True),
            StaticPathConfig(FRONTEND_URL, str(frontend_dir), False),
            # The furniture catalog addresses its 3D models and thumbnails
            # with absolute document-root URLs (/com/eteks/...), so that
            # folder must also be reachable at the server root. The imported
            # libraries live in the downloaded pack (see furniture.py) and
            # are served under the same URLs, ahead of the bundled folder.
            *(
                StaticPathConfig(
                    f"{RESOURCES_URL}/{library}", str(pack_dir / library), True
                )
                for library in FURNITURE_LIBRARIES
            ),
            StaticPathConfig("/com", str(frontend_dir / "com"), True),
        ]
    )
    furniture = FurniturePack(hass, pack_dir)
    hass.data[DOMAIN]["furniture"] = furniture
    furniture.async_start()

    hass.http.register_view(HomesListView(homes_dir))
    hass.data[DOMAIN]["homes_dir"] = homes_dir

    async def on_home_deleted(name: str) -> None:
        # A deleted home's bindings can never apply again
        if _set_home_mappings(hass, name, {}):
            await hass.async_add_executor_job(_save_data, hass)

    hass.http.register_view(HomeView(homes_dir, on_home_deleted))

    websocket_api.async_register_command(hass, ws_get_mappings)
    websocket_api.async_register_command(hass, ws_save_mappings)
    websocket_api.async_register_command(hass, ws_get_settings)
    websocket_api.async_register_command(hass, ws_save_settings)
    websocket_api.async_register_command(hass, ws_get_active_home)
    websocket_api.async_register_command(hass, ws_set_active_home)
    websocket_api.async_register_command(hass, ws_subscribe_furniture)
    websocket_api.async_register_command(hass, ws_retry_furniture)

    # Custom element panel (frontend/panel.js): unlike an iframe panel it
    # receives the authenticated hass object, which it bridges to the viewer
    # iframe over postMessage for entity bindings and click-to-toggle.
    async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title="3D Dashboard",
        sidebar_icon="mdi:home-floor-3",
        frontend_url_path=PANEL_URL_PATH,
        config={
            "_panel_custom": {
                "name": "home-3d-dashboard-panel",
                "embed_iframe": False,
                "trust_external": False,
                "js_url": f"{FRONTEND_URL}/panel.js",
            }
        },
        require_admin=False,
    )


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    if DOMAIN in config:
        await _setup_integration(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    await _setup_integration(hass)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    async_remove_panel(hass, PANEL_URL_PATH)
    hass.data[DOMAIN]["_setup_done"] = False
    return True


def _init_homes_dir(homes_dir: Path, frontend_dir: Path) -> None:
    """Create the homes dir; seed it with the bundled sample home."""
    homes_dir.mkdir(parents=True, exist_ok=True)
    default_home = homes_dir / "default.sh3d"
    sample = frontend_dir / "assets" / "default.sh3d"
    if not default_home.exists() and sample.is_file():
        shutil.copyfile(sample, default_home)


def _storage_path(hass: HomeAssistant) -> Path:
    return Path(hass.config.path(".storage")) / STORAGE_KEY


def _load_data(hass: HomeAssistant) -> None:
    path = _storage_path(hass)
    if not path.is_file():
        return
    try:
        data = json.loads(path.read_text())
    except (OSError, ValueError):
        _LOGGER.exception("Failed to load %s", path)
        return
    hass.data[DOMAIN]["mappings"] = data.get("mappings", {})
    hass.data[DOMAIN]["home_mappings"] = data.get("home_mappings", {})
    hass.data[DOMAIN]["settings"] = data.get("settings", {})


def _save_data(hass: HomeAssistant) -> None:
    path = _storage_path(hass)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "mappings": hass.data[DOMAIN]["mappings"],
        "home_mappings": hass.data[DOMAIN]["home_mappings"],
        "settings": hass.data[DOMAIN]["settings"],
    }
    path.write_text(json.dumps(payload, indent=2))


def _home_mappings(hass: HomeAssistant, home: str) -> dict:
    if home == DEFAULT_HOME:
        return hass.data[DOMAIN]["mappings"]
    return hass.data[DOMAIN]["home_mappings"].get(home, {})


def _set_home_mappings(hass: HomeAssistant, home: str, mappings: dict) -> bool:
    """Store a home's mappings (none: forget them); returns True if changed."""
    if home == DEFAULT_HOME:
        changed = hass.data[DOMAIN]["mappings"] != mappings
        hass.data[DOMAIN]["mappings"] = mappings
        return changed
    home_mappings = hass.data[DOMAIN]["home_mappings"]
    if not mappings:
        return home_mappings.pop(home, None) is not None
    changed = home_mappings.get(home) != mappings
    home_mappings[home] = mappings
    return changed


def _active_home(hass: HomeAssistant) -> str:
    """The home the dashboard shows: the chosen one if it still exists,
    else "default", else the first saved home."""
    homes_dir = hass.data[DOMAIN]["homes_dir"]
    chosen = hass.data[DOMAIN]["settings"].get(ACTIVE_HOME_SETTING)
    for name in (chosen, DEFAULT_HOME):
        if isinstance(name, str):
            path = safe_home_path(homes_dir, name)
            if path is not None and path.is_file():
                return name
    names = sorted(p.stem for p in homes_dir.glob("*.sh3d"))
    return names[0] if names else DEFAULT_HOME


@websocket_api.websocket_command(
    {vol.Required("type"): WS_GET, vol.Optional("home", default=DEFAULT_HOME): str}
)
@websocket_api.async_response
async def ws_get_mappings(hass, connection, msg):
    connection.send_result(msg["id"], _home_mappings(hass, msg["home"]))


@websocket_api.websocket_command(
    {
        vol.Required("type"): WS_SAVE,
        vol.Required("mappings"): dict,
        vol.Optional("home", default=DEFAULT_HOME): str,
    }
)
@websocket_api.async_response
async def ws_save_mappings(hass, connection, msg):
    if safe_home_path(hass.data[DOMAIN]["homes_dir"], msg["home"]) is None:
        connection.send_error(msg["id"], "invalid_home", "Invalid home name")
        return
    _set_home_mappings(hass, msg["home"], msg["mappings"])
    await hass.async_add_executor_job(_save_data, hass)
    connection.send_result(msg["id"], {"success": True})


@websocket_api.websocket_command({vol.Required("type"): WS_GET_ACTIVE_HOME})
@websocket_api.async_response
async def ws_get_active_home(hass, connection, msg):
    home = await hass.async_add_executor_job(_active_home, hass)
    connection.send_result(msg["id"], {"home": home})


@websocket_api.websocket_command(
    {vol.Required("type"): WS_SET_ACTIVE_HOME, vol.Required("home"): str}
)
@websocket_api.async_response
async def ws_set_active_home(hass, connection, msg):
    if safe_home_path(hass.data[DOMAIN]["homes_dir"], msg["home"]) is None:
        connection.send_error(msg["id"], "invalid_home", "Invalid home name")
        return
    settings = hass.data[DOMAIN]["settings"]
    if settings.get(ACTIVE_HOME_SETTING) != msg["home"]:
        settings[ACTIVE_HOME_SETTING] = msg["home"]
        await hass.async_add_executor_job(_save_data, hass)
    connection.send_result(msg["id"], {"home": msg["home"]})


@websocket_api.websocket_command({vol.Required("type"): WS_GET_SETTINGS})
@websocket_api.async_response
async def ws_get_settings(hass, connection, msg):
    connection.send_result(msg["id"], hass.data[DOMAIN]["settings"])


@websocket_api.websocket_command(
    {vol.Required("type"): WS_SAVE_SETTINGS, vol.Required("settings"): dict}
)
@websocket_api.async_response
async def ws_save_settings(hass, connection, msg):
    settings = dict(msg["settings"])
    # The active home is set through set_active_home: keep it
    active = hass.data[DOMAIN]["settings"].get(ACTIVE_HOME_SETTING)
    if active is not None:
        settings.setdefault(ACTIVE_HOME_SETTING, active)
    hass.data[DOMAIN]["settings"] = settings
    await hass.async_add_executor_job(_save_data, hass)
    connection.send_result(msg["id"], {"success": True})


@websocket_api.websocket_command({vol.Required("type"): WS_FURNITURE_SUBSCRIBE})
@callback
def ws_subscribe_furniture(hass, connection, msg):
    """Stream the furniture pack status: current value first, then changes."""

    @callback
    def forward(status):
        connection.send_message(websocket_api.event_message(msg["id"], status))

    connection.subscriptions[msg["id"]] = async_dispatcher_connect(
        hass, SIGNAL_FURNITURE_STATUS, forward
    )
    connection.send_result(msg["id"])
    forward(hass.data[DOMAIN]["furniture"].status)


@websocket_api.websocket_command({vol.Required("type"): WS_FURNITURE_RETRY})
@callback
def ws_retry_furniture(hass, connection, msg):
    """Retry a failed furniture pack download."""
    furniture = hass.data[DOMAIN]["furniture"]
    if furniture.status["state"] == STATE_ERROR:
        furniture.async_start()
    connection.send_result(msg["id"])
