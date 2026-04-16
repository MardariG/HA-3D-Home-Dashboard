"""3D Home Dashboard - HA integration."""
import logging
import os
import json
import shutil
import zipfile
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

FRONTEND_DIR = os.path.join(
    os.path.dirname(__file__), "frontend"
)

ALLOWED_EXT = (".sh3d",)


def _extract_sh3d(zip_path, dest_dir):
    """Extract a .sh3d file and find OBJ.

    .sh3d is a ZIP containing Home.xml and
    one or more .obj files with textures.
    Returns (obj_path, mtl_path) or None.
    """
    extract_dir = os.path.join(
        dest_dir, "_sh3d_extracted"
    )
    if os.path.exists(extract_dir):
        shutil.rmtree(extract_dir)
    os.makedirs(extract_dir, exist_ok=True)

    obj_file = None
    mtl_file = None

    try:
        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(extract_dir)

        # Walk extracted files for OBJ/MTL
        for root, dirs, files in os.walk(
            extract_dir
        ):
            for f in files:
                fl = f.lower()
                fp = os.path.join(root, f)
                if fl.endswith(".obj"):
                    # Prefer the largest OBJ
                    if obj_file is None:
                        obj_file = fp
                    else:
                        cur = os.path.getsize(fp)
                        old = os.path.getsize(
                            obj_file
                        )
                        if cur > old:
                            obj_file = fp
                elif fl.endswith(".mtl"):
                    mtl_file = fp
    except Exception:
        _LOGGER.exception("sh3d extract failed")
        return None

    if obj_file is None:
        _LOGGER.error("No OBJ found in .sh3d")
        return None

    return (obj_file, mtl_file)


async def _setup_integration(hass):
    """Shared async setup."""
    default = {
        "mappings": {},
        "model_filename": None,
        "model_type": None,
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

    js_url = (
        "/api/" + DOMAIN + "/static/entrypoint.js"
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
    """Set up via configuration.yaml."""
    if DOMAIN in config:
        await _setup_integration(hass)
    return True


async def async_setup_entry(hass, entry):
    """Set up via UI config flow."""
    await _setup_integration(hass)
    return True


async def async_unload_entry(hass, entry):
    """Unload a config entry."""
    async_remove_panel(
        hass, "home-3d-dashboard"
    )
    hass.data[DOMAIN]["_setup_done"] = False
    return True


def _save_data(hass):
    """Save mappings and model info."""
    sp = hass.config.path(
        ".storage/" + STORAGE_KEY
    )
    d = os.path.dirname(sp)
    os.makedirs(d, exist_ok=True)
    dd = hass.data[DOMAIN]
    payload = {
        "mappings": dd["mappings"],
        "model_filename": dd["model_filename"],
        "model_type": dd["model_type"],
    }
    with open(sp, "w") as fp:
        json.dump(payload, fp, indent=2)


class FrontendView(HomeAssistantView):
    """Serve frontend JS files."""

    url = "/api/home_3d_dashboard/static/{p:.*}"
    name = "api:home_3d_dashboard:static"
    requires_auth = False

    async def get(self, request, p):
        """Serve a frontend file."""
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
            if not fname.lower().endswith(
                ALLOWED_EXT
            ):
                err = {
                    "error": (
                        "Only .sh3d files"
                        " are supported"
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

            # Extract OBJ from sh3d
            mtype = "sh3d"
            result = await (
                self.hass.async_add_executor_job(
                    _extract_sh3d, fpath, mp
                )
            )
            if result is None:
                err = {
                    "error": (
                        "No OBJ model found"
                        " in .sh3d file"
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
                "Uploaded: %s (%d bytes) [%s]",
                fname, size, mtype
            )
            result = {
                "success": True,
                "filename": fname,
                "size": size,
                "model_type": mtype,
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

    url = "/api/home_3d_dashboard/model/{fn}"
    name = "api:home_3d_dashboard:model"
    requires_auth = True

    def __init__(self, hass):
        self.hass = hass

    async def get(self, request, fn):
        """Serve the model file."""
        mp = self.hass.config.path(MODELS_DIR)
        fpath = os.path.join(mp, fn)
        if not os.path.exists(fpath):
            err = {"error": "Not found"}
            return web.json_response(
                err, status=404
            )
        fl = fn.lower()
        if fl.endswith(".glb"):
            ct = "model/gltf-binary"
        elif fl.endswith(".obj"):
            ct = "text/plain"
        elif fl.endswith(".mtl"):
            ct = "text/plain"
        else:
            ct = "application/octet-stream"
        hdrs = {"Content-Type": ct}
        return web.FileResponse(
            fpath, headers=hdrs
        )


class SH3DAssetView(HomeAssistantView):
    """Serve extracted .sh3d assets."""

    url = "/api/home_3d_dashboard/sh3d/{p:.*}"
    name = "api:home_3d_dashboard:sh3d"
    requires_auth = False

    def __init__(self, hass):
        self.hass = hass

    async def get(self, request, p):
        """Serve an extracted sh3d asset."""
        mp = self.hass.config.path(MODELS_DIR)
        extract = os.path.join(
            mp, "_sh3d_extracted"
        )
        fpath = os.path.join(extract, p)
        # Security: must be under extract dir
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
        elif fl.endswith((".jpg", ".jpeg")):
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
    dd = hass.data[DOMAIN]
    result = {
        "filename": dd["model_filename"],
        "model_type": dd.get("model_type"),
    }
    # For sh3d, find the extracted OBJ path
    if dd.get("model_type") == "sh3d":
        mp = hass.config.path(MODELS_DIR)
        ed = os.path.join(
            mp, "_sh3d_extracted"
        )
        obj_rel = None
        if os.path.isdir(ed):
            for rt, ds, fs in os.walk(ed):
                for f in fs:
                    if f.lower().endswith(".obj"):
                        fp = os.path.join(rt, f)
                        obj_rel = (
                            os.path.relpath(
                                fp, ed
                            )
                        )
                        break
                if obj_rel:
                    break
        result["obj_path"] = obj_rel
    conn.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {vol.Required("type"): WS_DEL}
)
@websocket_api.async_response
async def ws_delete_model(hass, conn, msg):
    """Delete the current model."""
    dd = hass.data[DOMAIN]
    fn = dd["model_filename"]
    mp = hass.config.path(MODELS_DIR)
    if fn:
        fp = os.path.join(mp, fn)
        if os.path.exists(fp):
            os.remove(fp)
    # Also clean extracted sh3d
    ed = os.path.join(mp, "_sh3d_extracted")
    if os.path.isdir(ed):
        shutil.rmtree(ed, ignore_errors=True)
    dd["model_filename"] = None
    dd["model_type"] = None
    dd["mappings"] = {}
    await hass.async_add_executor_job(
        _save_data, hass
    )
    result = {"success": True}
    conn.send_result(msg["id"], result)
