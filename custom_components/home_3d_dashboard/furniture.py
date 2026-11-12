"""Download and install the furniture library pack.

The imported Sweet Home 3D libraries are too large to ship in the
integration (the Home Assistant Marketplace refuses installs over 100 MiB),
so they are published as a release asset (see furniture_pack_info.py) and
fetched on first start into <config>/home_3d_dashboard/furniture/. The
editor's catalog lists them from the start; until the download finishes,
their thumbnails and models are simply not found.

Progress is broadcast on SIGNAL_FURNITURE_STATUS; the panel shows it as a
progress bar (websocket command home_3d_dashboard/furniture/subscribe).
"""
from __future__ import annotations

import hashlib
import logging
import shutil
import time
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any

import aiohttp

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.dispatcher import async_dispatcher_send

from .furniture_pack_info import (
    FURNITURE_LIBRARIES,
    FURNITURE_PACK_SHA256,
    FURNITURE_PACK_SIZE,
    FURNITURE_PACK_URL,
    FURNITURE_PACK_VERSION,
)

_LOGGER = logging.getLogger(__name__)

SIGNAL_FURNITURE_STATUS = "home_3d_dashboard_furniture_status"

STATE_PENDING = "pending"
STATE_DOWNLOADING = "downloading"
STATE_INSTALLING = "installing"
STATE_READY = "ready"
STATE_ERROR = "error"

_VERSION_FILE = ".version"
_CHUNK_SIZE = 1 << 20
_DOWNLOAD_TIMEOUT = aiohttp.ClientTimeout(total=30 * 60, sock_read=120)
# Progress updates at most this often (seconds) while downloading.
_PROGRESS_INTERVAL = 0.5
# Sanity bounds on the archive (the 1.9.3 pack is 2780 files, ~170 MiB).
_MAX_FILES = 20000
_MAX_UNPACKED_BYTES = 1 << 30


def prepare_pack_dir(pack_dir: Path) -> None:
    """Create the library folders so their static paths can be registered."""
    for library in FURNITURE_LIBRARIES:
        (pack_dir / library).mkdir(parents=True, exist_ok=True)


def _installed_version(pack_dir: Path) -> str | None:
    try:
        return (pack_dir / _VERSION_FILE).read_text(encoding="utf-8").strip()
    except OSError:
        return None


class FurniturePack:
    """Owns the pack download and its observable status."""

    def __init__(self, hass: HomeAssistant, pack_dir: Path) -> None:
        self._hass = hass
        self._pack_dir = pack_dir
        self._task = None
        self.status: dict[str, Any] = {
            "state": STATE_PENDING,
            "version": FURNITURE_PACK_VERSION,
            "received": 0,
            "total": FURNITURE_PACK_SIZE,
            "error": None,
        }

    @callback
    def async_start(self) -> None:
        """Start installing the pack unless that is already running."""
        if self._task is not None and not self._task.done():
            return
        self._task = self._hass.async_create_background_task(
            self._async_run(), "home_3d_dashboard furniture libraries download"
        )

    @callback
    def _update(self, **changes: Any) -> None:
        self.status = {**self.status, **changes}
        async_dispatcher_send(self._hass, SIGNAL_FURNITURE_STATUS, self.status)

    async def _async_run(self) -> None:
        hass = self._hass
        pack_dir = self._pack_dir
        if await hass.async_add_executor_job(_installed_version, pack_dir) == FURNITURE_PACK_VERSION:
            self._update(state=STATE_READY, received=0, error=None)
            return
        download = pack_dir.with_name(pack_dir.name + ".download")
        _LOGGER.info("Downloading furniture libraries %s", FURNITURE_PACK_VERSION)
        self._update(state=STATE_DOWNLOADING, received=0, error=None)
        try:
            digest = await self._async_download(download)
            if digest != FURNITURE_PACK_SHA256:
                raise ValueError(f"checksum mismatch (got {digest})")
            self._update(state=STATE_INSTALLING)
            await hass.async_add_executor_job(_install, download, pack_dir)
        except (aiohttp.ClientError, TimeoutError, OSError, ValueError, zipfile.BadZipFile) as err:
            _LOGGER.warning(
                "Could not install furniture libraries from %s: %s. The editor "
                "catalog will miss their models; retry from the panel or restart",
                FURNITURE_PACK_URL,
                err,
            )
            self._update(state=STATE_ERROR, error=str(err) or type(err).__name__)
            return
        except Exception as err:  # noqa: BLE001 - never leave the panel's bar stuck
            _LOGGER.exception("Unexpected error installing furniture libraries")
            self._update(state=STATE_ERROR, error=f"{type(err).__name__}: {err}")
            return
        finally:
            await hass.async_add_executor_job(lambda: download.unlink(missing_ok=True))
        _LOGGER.info("Installed furniture libraries %s", FURNITURE_PACK_VERSION)
        self._update(state=STATE_READY, error=None)

    async def _async_download(self, target: Path) -> str:
        """Stream the pack to `target`; return its SHA-256."""
        hass = self._hass
        session = async_get_clientsession(hass)
        digest = hashlib.sha256()
        async with session.get(FURNITURE_PACK_URL, timeout=_DOWNLOAD_TIMEOUT) as response:
            response.raise_for_status()
            total = response.content_length or FURNITURE_PACK_SIZE
            received = 0
            last_report = 0.0
            self._update(received=0, total=total)
            handle = await hass.async_add_executor_job(target.open, "wb")
            try:
                async for chunk in response.content.iter_chunked(_CHUNK_SIZE):
                    digest.update(chunk)
                    await hass.async_add_executor_job(handle.write, chunk)
                    received += len(chunk)
                    now = time.monotonic()
                    if now - last_report >= _PROGRESS_INTERVAL:
                        last_report = now
                        self._update(received=received)
            finally:
                await hass.async_add_executor_job(handle.close)
            self._update(received=received)
        return digest.hexdigest()


def _install(archive_path: Path, pack_dir: Path) -> None:
    """Extract the pack next to `pack_dir`, then swap each library folder in."""
    staging = pack_dir.with_name(pack_dir.name + ".new")
    shutil.rmtree(staging, ignore_errors=True)
    try:
        with zipfile.ZipFile(archive_path) as archive:
            members = [info for info in archive.infolist() if not info.is_dir()]
            if len(members) > _MAX_FILES:
                raise ValueError(f"too many files ({len(members)})")
            if sum(info.file_size for info in members) > _MAX_UNPACKED_BYTES:
                raise ValueError("unpacked size too large")
            for info in members:
                parts = PurePosixPath(info.filename).parts
                if (len(parts) < 2 or parts[0] not in FURNITURE_LIBRARIES
                        or any(part in ("", ".", "..") or ":" in part or "\\" in part
                               for part in parts)):
                    raise ValueError(f"unexpected entry {info.filename!r}")
            for info in members:
                target = staging.joinpath(*PurePosixPath(info.filename).parts)
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(info) as source, target.open("wb") as output:
                    shutil.copyfileobj(source, output)
        # The static routes point at pack_dir/<library>: replace the folder
        # contents under the same path so the routes keep working.
        pack_dir.mkdir(parents=True, exist_ok=True)
        (pack_dir / _VERSION_FILE).unlink(missing_ok=True)
        for library in FURNITURE_LIBRARIES:
            current = pack_dir / library
            shutil.rmtree(current, ignore_errors=True)
            source = staging / library
            if source.is_dir():
                source.rename(current)
            else:
                current.mkdir()
        (pack_dir / _VERSION_FILE).write_text(FURNITURE_PACK_VERSION, encoding="utf-8")
    finally:
        shutil.rmtree(staging, ignore_errors=True)
