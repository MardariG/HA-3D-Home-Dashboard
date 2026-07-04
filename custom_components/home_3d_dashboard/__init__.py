"""3D Home Dashboard - HA integration.

Serves the webpack-built Sweet Home 3D web editor as a sidebar panel and
exposes:
  - an HTTP API to list / read / write / delete `.sh3d` home files stored
    under `<config>/home_3d_dashboard/` (see http.py),
  - websocket commands to persist mesh -> entity mappings and viewer
    settings (carried over from v1.x; storage format is compatible).
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.components.frontend import (
    async_register_built_in_panel,
    async_remove_panel,
)
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

from .http import HomesListView, HomeView

_LOGGER = logging.getLogger(__name__)

DOMAIN = "home_3d_dashboard"
STORAGE_KEY = "home_3d_dashboard_mappings"
FRONTEND_URL = "/home_3d_dashboard-frontend"
PANEL_URL_PATH = "home-3d-dashboard"

WS_GET = DOMAIN + "/get_mappings"
WS_SAVE = DOMAIN + "/save_mappings"
WS_GET_SETTINGS = DOMAIN + "/get_settings"
WS_SAVE_SETTINGS = DOMAIN + "/save_settings"

CONFIG_SCHEMA = vol.Schema({DOMAIN: vol.Schema({})}, extra=vol.ALLOW_EXTRA)


async def _setup_integration(hass: HomeAssistant) -> None:
    hass.data.setdefault(
        DOMAIN, {"mappings": {}, "settings": {}, "_setup_done": False}
    )
    if hass.data[DOMAIN]["_setup_done"]:
        return
    hass.data[DOMAIN]["_setup_done"] = True

    homes_dir = Path(hass.config.path(DOMAIN))
    await hass.async_add_executor_job(
        lambda: homes_dir.mkdir(parents=True, exist_ok=True)
    )
    await hass.async_add_executor_job(_load_data, hass)

    frontend_dir = Path(__file__).parent / "frontend"
    await hass.http.async_register_static_paths(
        [StaticPathConfig(FRONTEND_URL, str(frontend_dir), False)]
    )

    hass.http.register_view(HomesListView(homes_dir))
    hass.http.register_view(HomeView(homes_dir))

    websocket_api.async_register_command(hass, ws_get_mappings)
    websocket_api.async_register_command(hass, ws_save_mappings)
    websocket_api.async_register_command(hass, ws_get_settings)
    websocket_api.async_register_command(hass, ws_save_settings)

    async_register_built_in_panel(
        hass,
        "iframe",
        sidebar_title="3D Dashboard",
        sidebar_icon="mdi:home-floor-3",
        frontend_url_path=PANEL_URL_PATH,
        config={"url": f"{FRONTEND_URL}/editor.html"},
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
    hass.data[DOMAIN]["settings"] = data.get("settings", {})


def _save_data(hass: HomeAssistant) -> None:
    path = _storage_path(hass)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "mappings": hass.data[DOMAIN]["mappings"],
        "settings": hass.data[DOMAIN]["settings"],
    }
    path.write_text(json.dumps(payload, indent=2))


@websocket_api.websocket_command({vol.Required("type"): WS_GET})
@websocket_api.async_response
async def ws_get_mappings(hass, connection, msg):
    connection.send_result(msg["id"], hass.data[DOMAIN]["mappings"])


@websocket_api.websocket_command(
    {vol.Required("type"): WS_SAVE, vol.Required("mappings"): dict}
)
@websocket_api.async_response
async def ws_save_mappings(hass, connection, msg):
    hass.data[DOMAIN]["mappings"] = msg["mappings"]
    await hass.async_add_executor_job(_save_data, hass)
    connection.send_result(msg["id"], {"success": True})


@websocket_api.websocket_command({vol.Required("type"): WS_GET_SETTINGS})
@websocket_api.async_response
async def ws_get_settings(hass, connection, msg):
    connection.send_result(msg["id"], hass.data[DOMAIN]["settings"])


@websocket_api.websocket_command(
    {vol.Required("type"): WS_SAVE_SETTINGS, vol.Required("settings"): dict}
)
@websocket_api.async_response
async def ws_save_settings(hass, connection, msg):
    hass.data[DOMAIN]["settings"] = msg["settings"]
    await hass.async_add_executor_job(_save_data, hass)
    connection.send_result(msg["id"], {"success": True})
