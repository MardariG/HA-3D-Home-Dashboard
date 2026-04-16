"""3D Home Dashboard - HA integration."""
import logging
import os
import json
import voluptuous as vol

from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.components import websocket_api
from homeassistant.components.http import HomeAssistantView
from homeassistant.helpers.typing import ConfigType
from aiohttp import web

_LOGGER = logging.getLogger(__name__)

DOMAIN = "home_3d_dashboard"
STORAGE_KEY = "home_3d_dashboard_mappings"
MODELS_DIR = "3d_models"

WS_GET = DOMAIN + "/get_mappings"
WS_SAVE = DOMAIN + "/save_mappings"
WS_INFO = DOMAIN + "/get_model_info"
WS_DEL = DOMAIN + "/delete_model"


def _setup_integration(hass):
    """Shared setup for YAML and config entry."""
    default = {
        "mappings": {},
        "model_filename": None,
        "_setup_done": False,
    }
    hass.data.setdefault(DOMAIN, default)
    if hass.data[DOMAIN].get("_setup_done"):
        return
    hass.data[DOMAIN]["_setup_done"] = True

    mp = hass.config.path(MODELS_DIR)
    os.makedirs(mp, exist_ok=True)

    sp = hass.config.path(".storage/" + STORAGE_KEY)
    if os.path.exists(sp):
        try:
            with open(sp, "r") as fp:
                data = json.load(fp)
                hass.data[DOMAIN]["mappings"] = (
                    data.get("mappings", {})
                )
                hass.data[DOMAIN]["model_filename"] = (
                    data.get("model_filename")
                )
        except Exception:
            _LOGGER.exception("Load failed")

    fdir = os.path.dirname(__file__)
    fpath = os.path.join(fdir, "frontend")
    url_pfx = "/" + DOMAIN + "/frontend"
    from homeassistant.components.http import StaticPathConfig
    hass.http.async_register_static_paths(
        [StaticPathConfig(url_pfx, fpath, False)]
    )
    hass.http.register_view(ModelUploadView(hass))
    hass.http.register_view(ModelServeView(hass))
    websocket_api.async_register_command(
        hass, ws_get_mappings
    )
    websocket_api.async_register_command(
        hass, ws_save_mappings
    )
    websocket_api.async_register_command(
        hass, ws_get_model_info
    )
    websocket_api.async_register_command(
        hass, ws_delete_model
    )

    js = "/" + DOMAIN + "/frontend/entrypoint.js"
    pc = {
        "_panel_custom": {
            "name": "home-3d-dashboard-panel",
            "embed_iframe": False,
            "trust_external": False,
            "js_url": js,
        }
    }
    from homeassistant.components.frontend import (
        async_register_built_in_panel,
    )
    async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title="3D Dashboard",
        sidebar_icon="mdi:home-3d",
        frontend_url_path="home-3d-dashboard",
        config=pc,
        require_admin=False,
    )


CONFIG_SCHEMA = vol.Schema(
    {DOMAIN: vol.Schema({})},
    extra=vol.ALLOW_EXTRA,
)


async def async_setup(hass, config):
    """Set up via configuration.yaml."""
    if DOMAIN in config:
        _setup_integration(hass)
    return True


async def async_setup_entry(hass, entry):
    """Set up via UI config flow."""
    _setup_integration(hass)
    return True


async def async_unload_entry(hass, entry):
    """Unload a config entry."""
    from homeassistant.components.frontend import (
        async_remove_panel,
    )
    async_remove_panel(hass, "home-3d-dashboard")
    hass.data[DOMAIN]["_setup_done"] = False
    return True


def _save_data(hass):
    """Save mappings and model info."""
    sp = hass.config.path(
        ".storage/" + STORAGE_KEY
    )
    d = os.path.dirname(sp)
    os.makedirs(d, exist_ok=True)
    payload = {
        "mappings": hass.data[DOMAIN]["mappings"],
        "model_filename": (
            hass.data[DOMAIN]["model_filename"]
        ),
    }
    with open(sp, "w") as fp:
        json.dump(payload, fp, indent=2)


class ModelUploadView(HomeAssistantView):
    """Handle 3D model file uploads."""

    url = "/api/home_3d_dashboard/upload"
    name = "api:home_3d_dashboard:upload"
    requires_auth = True

    def __init__(self, hass):
        self.hass = hass

    async def post(self, request):
        """Handle model upload."""
        try:
            reader = await request.multipart()
            field = await reader.next()
            is_bad = (
                field is None
                or not (field.name == "model")
            )
            if is_bad:
                err = {"error": "No file"}
                return web.json_response(
                    err, status=400
                )
            fname = field.filename
            ok_ext = (".glb", ".gltf")
            if not fname.lower().endswith(ok_ext):
                err = {"error": "GLB/GLTF only"}
                return web.json_response(
                    err, status=400
                )
            mp = self.hass.config.path(MODELS_DIR)
            fpath = os.path.join(mp, fname)
            size = 0
            with open(fpath, "wb") as fp:
                while True:
                    chunk = await field.read_chunk()
                    if not chunk:
                        break
                    size += len(chunk)
                    fp.write(chunk)
            d = self.hass.data[DOMAIN]
            d["model_filename"] = fname
            d["mappings"] = {}
            _save_data(self.hass)
            _LOGGER.info(
                "Uploaded: %s (%d bytes)",
                fname, size
            )
            result = {
                "success": True,
                "filename": fname,
                "size": size,
            }
            return web.json_response(result)
        except Exception as e:
            _LOGGER.exception("Upload failed")
            err = {"error": str(e)}
            return web.json_response(
                err, status=500
            )


class ModelServeView(HomeAssistantView):
    """Serve the uploaded 3D model file."""

    url = "/api/home_3d_dashboard/model/{filename}"
    name = "api:home_3d_dashboard:model"
    requires_auth = True

    def __init__(self, hass):
        self.hass = hass

    async def get(self, request, filename):
        """Serve the model file."""
        mp = self.hass.config.path(MODELS_DIR)
        fpath = os.path.join(mp, filename)
        if not os.path.exists(fpath):
            err = {"error": "Not found"}
            return web.json_response(
                err, status=404
            )
        if filename.endswith(".glb"):
            ct = "model/gltf-binary"
        else:
            ct = "model/gltf+json"
        hdrs = {"Content-Type": ct}
        return web.FileResponse(
            fpath, headers=hdrs
        )


@websocket_api.websocket_command(
    {vol.Required("type"): WS_GET}
)
@websocket_api.async_response
async def ws_get_mappings(hass, conn, msg):
    """Return mappings."""
    data = hass.data[DOMAIN]["mappings"]
    conn.send_result(msg["id"], data)


@websocket_api.websocket_command({
    vol.Required("type"): WS_SAVE,
    vol.Required("mappings"): dict,
})
@websocket_api.async_response
async def ws_save_mappings(hass, conn, msg):
    """Save mappings."""
    m = msg["mappings"]
    hass.data[DOMAIN]["mappings"] = m
    await hass.async_add_executor_job(
        _save_data, hass
    )
    result = {"success": True}
    conn.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {vol.Required("type"): WS_INFO}
)
@websocket_api.async_response
async def ws_get_model_info(hass, conn, msg):
    """Return model info."""
    fn = hass.data[DOMAIN]["model_filename"]
    result = {"filename": fn}
    conn.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {vol.Required("type"): WS_DEL}
)
@websocket_api.async_response
async def ws_delete_model(hass, conn, msg):
    """Delete the current model."""
    fn = hass.data[DOMAIN]["model_filename"]
    if fn:
        fp = hass.config.path(MODELS_DIR, fn)
        if os.path.exists(fp):
            os.remove(fp)
    hass.data[DOMAIN]["model_filename"] = None
    hass.data[DOMAIN]["mappings"] = {}
    await hass.async_add_executor_job(
        _save_data, hass
    )
    result = {"success": True}
    conn.send_result(msg["id"], result)
