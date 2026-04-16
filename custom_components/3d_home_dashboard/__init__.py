"""3D Home Dashboard - Interactive 3D model dashboard for Home Assistant."""
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

DOMAIN = "3d_home_dashboard"
STORAGE_KEY = "3d_home_dashboard_mappings"
MODELS_DIR = "3d_models"
PANEL_URL = "/3d-home-dashboard"

CONFIG_SCHEMA = vol.Schema(
    {DOMAIN: vol.Schema({})},
    extra=vol.ALLOW_EXTRA,
)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the 3D Home Dashboard component."""
    hass.data.setdefault(DOMAIN, {"mappings": {}, "model_filename": None})

    # Ensure storage directories exist
    models_path = hass.config.path(MODELS_DIR)
    os.makedirs(models_path, exist_ok=True)

    # Load saved mappings
    store_path = hass.config.path(f".storage/{STORAGE_KEY}")
    if os.path.exists(store_path):
        try:
            with open(store_path, "r") as f:
                data = json.load(f)
                hass.data[DOMAIN]["mappings"] = data.get("mappings", {})
                hass.data[DOMAIN]["model_filename"] = data.get("model_filename")
        except Exception:
            _LOGGER.exception("Failed to load 3D Home Dashboard data")

    # Register the frontend panel
    hass.http.register_static_path(
        f"/{DOMAIN}/frontend",
        os.path.join(os.path.dirname(__file__), "frontend"),
        cache_headers=False,
    )

    # Register views
    hass.http.register_view(ModelUploadView(hass))
    hass.http.register_view(ModelServeView(hass))

    # Register websocket commands
    websocket_api.async_register_command(hass, ws_get_mappings)
    websocket_api.async_register_command(hass, ws_save_mappings)
    websocket_api.async_register_command(hass, ws_get_model_info)
    websocket_api.async_register_command(hass, ws_delete_model)

    # Register the panel
    hass.components.frontend.async_register_built_in_panel(
        component_name="custom",
        sidebar_title="3D Dashboard",
        sidebar_icon="mdi:home-3d",
        frontend_url_path="3d-home-dashboard",
        config={
            "_panel_custom": {
                "name": "3d-home-dashboard-panel",
                "embed_iframe": False,
                "trust_external": False,
                "js_url": f"/{DOMAIN}/frontend/entrypoint.js",
            }
        },
        require_admin=False,
    )

    return True


def _save_data(hass: HomeAssistant):
    """Save mappings and model info to storage."""
    store_path = hass.config.path(f".storage/{STORAGE_KEY}")
    os.makedirs(os.path.dirname(store_path), exist_ok=True)
    with open(store_path, "w") as f:
        json.dump(
            {
                "mappings": hass.data[DOMAIN]["mappings"],
                "model_filename": hass.data[DOMAIN]["model_filename"],
            },
            f,
            indent=2,
        )


class ModelUploadView(HomeAssistantView):
    """Handle 3D model file uploads."""

    url = f"/api/{DOMAIN}/upload"
    name = f"api:{DOMAIN}:upload"
    requires_auth = True

    def __init__(self, hass: HomeAssistant):
        self.hass = hass

    async def post(self, request: web.Request) -> web.Response:
        """Handle model upload."""
        try:
            reader = await request.multipart()
            field = await reader.next()

            if field is None or field.name != "model":
                return web.json_response(
                    {"error": "No model file provided"}, status=400
                )

            filename = field.filename
            if not filename.lower().endswith((".glb", ".gltf")):
                return web.json_response(
                    {"error": "Only GLB/GLTF files are supported"}, status=400
                )

            # Save the file
            models_path = self.hass.config.path(MODELS_DIR)
            filepath = os.path.join(models_path, filename)

            size = 0
            with open(filepath, "wb") as f:
                while True:
                    chunk = await field.read_chunk()
                    if not chunk:
                        break
                    size += len(chunk)
                    f.write(chunk)

            # Update state
            self.hass.data[DOMAIN]["model_filename"] = filename
            # Clear old mappings when a new model is uploaded
            self.hass.data[DOMAIN]["mappings"] = {}
            _save_data(self.hass)

            _LOGGER.info("3D model uploaded: %s (%d bytes)", filename, size)

            return web.json_response(
                {"success": True, "filename": filename, "size": size}
            )
        except Exception as e:
            _LOGGER.exception("Model upload failed")
            return web.json_response({"error": str(e)}, status=500)


class ModelServeView(HomeAssistantView):
    """Serve the uploaded 3D model file."""

    url = f"/api/{DOMAIN}/model/{{filename}}"
    name = f"api:{DOMAIN}:model"
    requires_auth = True

    def __init__(self, hass: HomeAssistant):
        self.hass = hass

    async def get(self, request: web.Request, filename: str) -> web.Response:
        """Serve the model file."""
        models_path = self.hass.config.path(MODELS_DIR)
        filepath = os.path.join(models_path, filename)

        if not os.path.exists(filepath):
            return web.json_response({"error": "Model not found"}, status=404)

        content_type = (
            "model/gltf-binary"
            if filename.endswith(".glb")
            else "model/gltf+json"
        )
        return web.FileResponse(filepath, headers={"Content-Type": content_type})


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/get_mappings"}
)
@websocket_api.async_response
async def ws_get_mappings(hass, connection, msg):
    """Return entity-to-mesh mappings."""
    connection.send_result(msg["id"], hass.data[DOMAIN]["mappings"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/save_mappings",
        vol.Required("mappings"): dict,
    }
)
@websocket_api.async_response
async def ws_save_mappings(hass, connection, msg):
    """Save entity-to-mesh mappings."""
    hass.data[DOMAIN]["mappings"] = msg["mappings"]
    await hass.async_add_executor_job(_save_data, hass)
    connection.send_result(msg["id"], {"success": True})


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/get_model_info"}
)
@websocket_api.async_response
async def ws_get_model_info(hass, connection, msg):
    """Return info about the uploaded model."""
    connection.send_result(
        msg["id"],
        {"filename": hass.data[DOMAIN]["model_filename"]},
    )


@websocket_api.websocket_command(
    {vol.Required("type"): f"{DOMAIN}/delete_model"}
)
@websocket_api.async_response
async def ws_delete_model(hass, connection, msg):
    """Delete the current model."""
    filename = hass.data[DOMAIN]["model_filename"]
    if filename:
        filepath = hass.config.path(MODELS_DIR, filename)
        if os.path.exists(filepath):
            os.remove(filepath)
    hass.data[DOMAIN]["model_filename"] = None
    hass.data[DOMAIN]["mappings"] = {}
    await hass.async_add_executor_job(_save_data, hass)
    connection.send_result(msg["id"], {"success": True})
