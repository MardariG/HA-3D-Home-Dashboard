"""Build the furniture library pack downloaded by the integration at runtime.

The imported Sweet Home 3D libraries (scripts/import-sh3f.js writes them to
furniture-pack/<library>/) are ~170 MiB: far over the Home Assistant
Marketplace's 100 MiB install limit. They are therefore not committed; this
script zips them into dist-pack/<name>.zip, which is published as a GitHub
release asset and fetched by custom_components/home_3d_dashboard/furniture.py.

Usage: python scripts/build-furniture-pack.py

The archive is deterministic (sorted entries, fixed timestamps), so rebuilding
the same files reproduces the same SHA-256. After publishing a changed pack,
update FURNITURE_PACK_URL / FURNITURE_PACK_SHA256 in furniture.py.
"""
from __future__ import annotations

import hashlib
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "custom_components" / "home_3d_dashboard"))
from furniture_pack_info import (  # noqa: E402
    FURNITURE_LIBRARIES,
    FURNITURE_PACK_FILENAME,
)

SOURCE_DIR = ROOT / "furniture-pack"
OUTPUT_DIR = ROOT / "dist-pack"
FIXED_DATE = (2026, 1, 1, 0, 0, 0)


def main() -> int:
    missing = [lib for lib in FURNITURE_LIBRARIES if not (SOURCE_DIR / lib).is_dir()]
    if missing:
        print(f"Missing libraries in {SOURCE_DIR}: {', '.join(missing)}")
        return 1
    OUTPUT_DIR.mkdir(exist_ok=True)
    output = OUTPUT_DIR / FURNITURE_PACK_FILENAME
    count = 0
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for lib in FURNITURE_LIBRARIES:
            for path in sorted((SOURCE_DIR / lib).rglob("*")):
                if not path.is_file():
                    continue
                info = zipfile.ZipInfo(path.relative_to(SOURCE_DIR).as_posix(), FIXED_DATE)
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                archive.writestr(info, path.read_bytes())
                count += 1
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    size = output.stat().st_size / 1048576
    print(f"{output}: {count} files, {size:.1f} MiB")
    print(f"FURNITURE_PACK_SHA256 = \"{digest}\"")
    return 0


if __name__ == "__main__":
    sys.exit(main())
