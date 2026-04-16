"""3D Home Dashboard - HA integration."""
import logging
import os
import json
import shutil
import voluptuous as vol

from homeassistant.core import HomeAssistant
from homeassistant.config_entries import ConfigEntry
from homeassistant.components import websocket_api
from homeassistant.components.http import (
    HomeAssistantView,
)
from homeassistant.components.frontend import (
    async_register_built_in_panel,
    async_remove_panel,
)
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
WS_GET_SETTINGS = DOMAIN + "/get_settings"
WS_SAVE_SETTINGS = DOMAIN + "/save_settings"

FRONTEND_DIR = os.path.join(
    os.path.dirname(__file__), "frontend"
)

ALLOWED_EXT = (".sh3d",)


def _extract_sh3d(zip_path, dest_dir):
    from .sh3d_assembler import assemble_sh3d
    ed = os.path.join(
        dest_dir, "_sh3d_extracted"
    )
    try:
        result = assemble_sh3d(
            zip_path, ed
        )
        if result is None:
            _LOGGER.error("Assembly failed")
            return None
        return (result, None)
    except Exception:
        _LOGGER.exception("sh3d fail")
        return None


async def _setup_integration(hass):
    default = {
        "mappings": {},
        "model_filename": None,
        "model_type": None,
        "settings": {},
        "_setup_done": False,
    }
    hass.data.setdefault(DOMAIN, default)
    if hass.data[DOMAIN].get("_setup_done"):
        return
    hass.data[DOMAIN]["_setup_done"] = True
    mp = hass.config.path(MODELS_DIR)
    os.makedirs(mp, exist_ok=True)
    sp = hass.config.path(
        ".storage/" + STORAGE_KEY
    )
    if os.path.exists(sp):
        try:
            with open(sp, "r") as fp:
                data = json.load(fp)
                d = hass.data[DOMAIN]
                d["mappings"] = (
                    data.get("mappings", {})
                )
                d["model_filename"] = (
                    data.get("model_filename")
                )
                d["model_type"] = (
                    data.get("model_type")
                )
                d["settings"] = (
                    data.get("settings", {})
                )
        except Exception:
            _LOGGER.exception("Load failed")
    hass.http.register_view(FrontendView())
    hass.http.register_view(
        ModelUploadView(hass)
    )
    hass.http.register_view(
        ModelServeView(hass)
    )
    hass.http.register_view(
        SH3DAssetView(hass)
    )
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
    websocket_api.async_register_command(
        hass, ws_get_settings
    )
    websocket_api.async_register_command(
        hass, ws_save_settings
    )
    js_url = (
        "/api/" + DOMAIN
        + "/static/entrypoint.js"
    )
    pc = {
        "_panel_custom": {
            "name": "home-3d-dashboard-panel",
            "embed_iframe": False,
            "trust_external": False,
            "js_url": js_url,
        }
    }
    async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title="3D Dashboard",
        sidebar_icon="mdi:home-floor-3",
        frontend_url_path="home-3d-dashboard",
        config=pc,
        require_admin=False,
    )


CONFIG_SCHEMA = vol.Schema(
    {DOMAIN: vol.Schema({})},
    extra=vol.ALLOW_EXTRA,
)


async def async_setup(hass, config):
    if DOMAIN in config:
        await _setup_integration(hass)
    return True


async def async_setup_entry(hass, entry):
    await _setup_integration(hass)
    return True


async def async_unload_entry(hass, entry):
    async_remove_panel(
        hass, "home-3d-dashboard"
    )
    hass.data[DOMAIN]["_setup_done"] = False
    return True


def _save_data(hass):
    sp = hass.config.path(
        ".storage/" + STORAGE_KEY
    )
    d = os.path.dirname(sp)
    os.makedirs(d, exist_ok=True)
    dd = hass.data[DOMAIN]
    payload = {
        "mappings": dd["mappings"],
        "model_filename": (
            dd["model_filename"]
        ),
        "model_type": dd["model_type"],
        "settings": dd.get("settings", {}),
    }
    with open(sp, "w") as fp:
        json.dump(payload, fp, indent=2)


class FrontendView(HomeAssistantView):
    url = "/api/home_3d_dashboard/static/{p:.*}"
    name = "api:home_3d_dashboard:static"
    requires_auth = False

    async def get(self, request, p):
        safe = os.path.basename(p)
        fpath = os.path.join(
            FRONTEND_DIR, safe
        )
        if not os.path.isfile(fpath):
            return web.Response(status=404)
        ct = "application/javascript"
        return web.FileResponse(
            fpath,
            headers={"Content-Type": ct},
        )


class ModelUploadView(HomeAssistantView):
    url = "/api/home_3d_dashboard/upload"
    name = "api:home_3d_dashboard:upload"
    requires_auth = False

    def __init__(self, hass):
        self.hass = hass

    async def post(self, request):
        # Manual auth check
        user = request.get("hass_user")
        if user is None:
            ah = request.headers.get(
                "Authorization", ""
            )
            if ah.startswith("Bearer "):
                try:
                    rt = await (
                        self.hass.auth
                        .async_validate_access_token(
                            ah[7:]
                        )
                    )
                    if rt is not None:
                        user = rt.user
                except Exception:
                    pass
        if user is None:
            return web.json_response(
                {"error": "Unauthorized"},
                status=401,
            )
        try:
            reader = await request.multipart()
            field = await reader.next()
            is_bad = (
                field is None
                or not (
                    field.name == "model"
                )
            )
            if is_bad:
                err = {"error": "No file"}
                return web.json_response(
                    err, status=400
                )
            fname = field.filename
            if not fname.lower().endswith(
                ALLOWED_EXT
            ):
                err = {
                    "error": (
                        "Only .sh3d supported"
                    )
                }
                return web.json_response(
                    err, status=400
                )
            mp = self.hass.config.path(
                MODELS_DIR
            )
            fpath = os.path.join(mp, fname)
            size = 0
            with open(fpath, "wb") as fp:
                while True:
                    chunk = (
                        await field.read_chunk()
                    )
                    if not chunk:
                        break
                    size += len(chunk)
                    fp.write(chunk)
            mtype = "sh3d"
            result = await (
                self.hass
                .async_add_executor_job(
                    _extract_sh3d,
                    fpath, mp
                )
            )
            if result is None:
                err = {
                    "error": (
                        "No OBJ in .sh3d"
                    )
                }
                return web.json_response(
                    err, status=400
                )
            dd = self.hass.data[DOMAIN]
            dd["model_filename"] = fname
            dd["model_type"] = mtype
            dd["mappings"] = {}
            _save_data(self.hass)
            _LOGGER.info(
                "Uploaded: %s (%dB)",
                fname, size
            )
            result = {
                "success": True,
                "filename": fname,
                "size": size,
                "model_type": mtype,
            }
            return web.json_response(
                result
            )
        except Exception as e:
            _LOGGER.exception("Upload err")
            err = {"error": str(e)}
            return web.json_response(
                err, status=500
            )


class ModelServeView(HomeAssistantView):
    url = "/api/home_3d_dashboard/model/{fn}"
    name = "api:home_3d_dashboard:model"
    requires_auth = True

    def __init__(self, hass):
        self.hass = hass

    async def get(self, request, fn):
        mp = self.hass.config.path(
            MODELS_DIR
        )
        fpath = os.path.join(mp, fn)
        if not os.path.exists(fpath):
            err = {"error": "Not found"}
            return web.json_response(
                err, status=404
            )
        ct = "application/octet-stream"
        fl = fn.lower()
        if fl.endswith(".obj"):
            ct = "text/plain"
        elif fl.endswith(".mtl"):
            ct = "text/plain"
        hdrs = {"Content-Type": ct}
        return web.FileResponse(
            fpath, headers=hdrs
        )


class SH3DAssetView(HomeAssistantView):
    url = "/api/home_3d_dashboard/sh3d/{p:.*}"
    name = "api:home_3d_dashboard:sh3d"
    requires_auth = False

    def __init__(self, hass):
        self.hass = hass

    async def get(self, request, p):
        mp = self.hass.config.path(
            MODELS_DIR
        )
        extract = os.path.join(
            mp, "_sh3d_extracted"
        )
        fpath = os.path.join(extract, p)
        real = os.path.realpath(fpath)
        base = os.path.realpath(extract)
        if not real.startswith(base):
            return web.Response(status=403)
        if not os.path.isfile(fpath):
            return web.Response(status=404)
        fl = p.lower()
        if fl.endswith(".obj"):
            ct = "text/plain"
        elif fl.endswith(".mtl"):
            ct = "text/plain"
        elif fl.endswith(
            (".jpg", ".jpeg")
        ):
            ct = "image/jpeg"
        elif fl.endswith(".png"):
            ct = "image/png"
        else:
            ct = "application/octet-stream"
        hdrs = {"Content-Type": ct}
        return web.FileResponse(
            fpath, headers=hdrs
        )


@websocket_api.websocket_command(
    {vol.Required("type"): WS_GET}
)
@websocket_api.async_response
async def ws_get_mappings(hass, conn, msg):
    data = hass.data[DOMAIN]["mappings"]
    conn.send_result(msg["id"], data)


@websocket_api.websocket_command({
    vol.Required("type"): WS_SAVE,
    vol.Required("mappings"): dict,
})
@websocket_api.async_response
async def ws_save_mappings(hass, conn, msg):
    m = msg["mappings"]
    hass.data[DOMAIN]["mappings"] = m
    await hass.async_add_executor_job(
        _save_data, hass
    )
    r = {"success": True}
    conn.send_result(msg["id"], r)


@websocket_api.websocket_command(
    {vol.Required("type"): WS_INFO}
)
@websocket_api.async_response
async def ws_get_model_info(hass, conn, msg):
    dd = hass.data[DOMAIN]
    result = {
        "filename": dd["model_filename"],
        "model_type": dd.get("model_type"),
    }
    if dd.get("model_type") == "sh3d":
        mp = hass.config.path(MODELS_DIR)
        ed = os.path.join(
            mp, "_sh3d_extracted"
        )
        obj_rel = None
        ap = os.path.join(
            ed, "assembled.obj"
        )
        if os.path.isfile(ap):
            obj_rel = "assembled.obj"
        result["obj_path"] = obj_rel
    conn.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {vol.Required("type"): WS_DEL}
)
@websocket_api.async_response
async def ws_delete_model(hass, conn, msg):
    dd = hass.data[DOMAIN]
    fn = dd["model_filename"]
    mp = hass.config.path(MODELS_DIR)
    if fn:
        fp = os.path.join(mp, fn)
        if os.path.exists(fp):
            os.remove(fp)
    ed = os.path.join(
        mp, "_sh3d_extracted"
    )
    if os.path.isdir(ed):
        shutil.rmtree(
            ed, ignore_errors=True
        )
    dd["model_filename"] = None
    dd["model_type"] = None
    dd["mappings"] = {}
    await hass.async_add_executor_job(
        _save_data, hass
    )
    r = {"success": True}
    conn.send_result(msg["id"], r)


@websocket_api.websocket_command(
    {vol.Required("type"): WS_GET_SETTINGS}
)
@websocket_api.async_response
async def ws_get_settings(hass, conn, msg):
    data = hass.data[DOMAIN].get(
        "settings", {}
    )
    conn.send_result(msg["id"], data)


@websocket_api.websocket_command({
    vol.Required("type"): WS_SAVE_SETTINGS,
    vol.Required("settings"): dict,
})
@websocket_api.async_response
async def ws_save_settings(hass, conn, msg):
    hass.data[DOMAIN]["settings"] = (
        msg["settings"]
    )
    await hass.async_add_executor_job(
        _save_data, hass
    )
    conn.send_result(
        msg["id"], {"success": True}
    )
