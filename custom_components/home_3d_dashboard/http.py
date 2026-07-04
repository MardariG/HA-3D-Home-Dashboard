"""HTTP API consumed by the editor's DirectHomeRecorder.

Protocol (dictated by public/src/DirectHomeRecorder.js in the frontend):
  - GET  /api/home_3d_dashboard/homes            -> JSON array of home names
  - GET  /api/home_3d_dashboard/homes/{name}     -> raw .sh3d bytes
  - POST /api/home_3d_dashboard/homes/{name}     -> save raw .sh3d body
  - GET  /api/home_3d_dashboard/homes/{name}?action=delete -> delete
    (DirectHomeRecorder issues deletions as plain GET requests.)
"""
from __future__ import annotations

import re
from pathlib import Path

from aiohttp import web

from homeassistant.components.http import KEY_HASS, HomeAssistantView

# Allow word chars, spaces, dots, dashes, parentheses; no path separators.
_VALID_NAME = re.compile(r"^[\w][\w .()\-]{0,100}$")


def _safe_path(homes_dir: Path, name: str) -> Path | None:
    """Map a client-supplied home name to a file path, rejecting traversal."""
    if not _VALID_NAME.match(name) or ".." in name:
        return None
    path = (homes_dir / f"{name}.sh3d").resolve()
    if path.parent != homes_dir.resolve():
        return None
    return path


class HomesListView(HomeAssistantView):
    """List saved homes."""

    url = "/api/home_3d_dashboard/homes"
    name = "api:home_3d_dashboard:homes"
    # The editor runs inside an iframe panel and has no way to attach the
    # user's bearer token to its XHR calls. TODO: replace with signed paths.
    requires_auth = False

    def __init__(self, homes_dir: Path) -> None:
        self._homes_dir = homes_dir

    async def get(self, request: web.Request) -> web.Response:
        hass = request.app[KEY_HASS]
        names = await hass.async_add_executor_job(
            lambda: sorted(p.stem for p in self._homes_dir.glob("*.sh3d"))
        )
        return self.json(names)


class HomeView(HomeAssistantView):
    """Read, write and delete a single home."""

    url = "/api/home_3d_dashboard/homes/{name}"
    name = "api:home_3d_dashboard:home"
    requires_auth = False

    def __init__(self, homes_dir: Path) -> None:
        self._homes_dir = homes_dir

    async def get(self, request: web.Request, name: str) -> web.StreamResponse:
        path = _safe_path(self._homes_dir, name)
        if path is None:
            return web.Response(status=400, text="Invalid home name")

        hass = request.app[KEY_HASS]
        if request.query.get("action") == "delete":
            deleted = await hass.async_add_executor_job(self._delete, path)
            if not deleted:
                return web.Response(status=404, text="Home not found")
            return web.Response(status=200, text="1")

        exists = await hass.async_add_executor_job(path.is_file)
        if not exists:
            return web.Response(status=404, text="Home not found")
        return web.FileResponse(path)

    async def post(self, request: web.Request, name: str) -> web.Response:
        path = _safe_path(self._homes_dir, name)
        if path is None:
            return web.Response(status=400, text="Invalid home name")

        data = await request.read()
        hass = request.app[KEY_HASS]
        await hass.async_add_executor_job(path.write_bytes, data)
        return web.Response(status=200, text="1")

    @staticmethod
    def _delete(path: Path) -> bool:
        if not path.is_file():
            return False
        path.unlink()
        return True
