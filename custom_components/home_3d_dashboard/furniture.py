"""Download and install the furniture library pack.

The imported Sweet Home 3D libraries are too large to ship in the
integration (the Home Assistant Marketplace refuses installs over 100 MiB),
so they are published as a release asset (see furniture_pack_info.py) and
fetched on first start into <config>/home_3d_dashboard/furniture/. The
editor's catalog lists them from the start; until the download finishes,
their thumbnails and models are simply not found.
"""
from __future__ import annotations

import hashlib
import logging
import shutil
import zipfile
from pathlib import Path, PurePosixPath

import aiohttp

from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .furniture_pack_info import (
    FURNITURE_LIBRARIES,
    FURNITURE_PACK_SHA256,
    FURNITURE_PACK_URL,
    FURNITURE_PACK_VERSION,
)

_LOGGER = logging.getLogger(__name__)

_VERSION_FILE = ".version"
_CHUNK_SIZE = 1 << 20
_DOWNLOAD_TIMEOUT = aiohttp.ClientTimeout(total=30 * 60, sock_read=120)
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


async def async_ensure_furniture_pack(hass: HomeAssistant, pack_dir: Path) -> None:
    """Download and install the pack unless the current version is present."""
    if await hass.async_add_executor_job(_installed_version, pack_dir) == FURNITURE_PACK_VERSION:
        return
    download = pack_dir.with_name(pack_dir.name + ".download")
    _LOGGER.info("Downloading furniture libraries %s", FURNITURE_PACK_VERSION)
    try:
        digest = await _async_download(hass, download)
        if digest != FURNITURE_PACK_SHA256:
            raise ValueError(f"checksum mismatch (got {digest})")
        await hass.async_add_executor_job(_install, download, pack_dir)
    except (aiohttp.ClientError, TimeoutError, OSError, ValueError, zipfile.BadZipFile) as err:
        _LOGGER.warning(
            "Could not install furniture libraries from %s: %s. The editor "
            "catalog will miss their models; retrying on next start",
            FURNITURE_PACK_URL,
            err,
        )
        return
    finally:
        await hass.async_add_executor_job(lambda: download.unlink(missing_ok=True))
    _LOGGER.info("Installed furniture libraries %s", FURNITURE_PACK_VERSION)


async def _async_download(hass: HomeAssistant, target: Path) -> str:
    """Stream the pack to `target`; return its SHA-256."""
    session = async_get_clientsession(hass)
    digest = hashlib.sha256()
    async with session.get(FURNITURE_PACK_URL, timeout=_DOWNLOAD_TIMEOUT) as response:
        response.raise_for_status()
        handle = await hass.async_add_executor_job(target.open, "wb")
        try:
            async for chunk in response.content.iter_chunked(_CHUNK_SIZE):
                digest.update(chunk)
                await hass.async_add_executor_job(handle.write, chunk)
        finally:
            await hass.async_add_executor_job(handle.close)
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
