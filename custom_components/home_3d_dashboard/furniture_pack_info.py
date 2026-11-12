"""Furniture library pack metadata (no Home Assistant imports).

Kept separate from furniture.py so scripts/build-furniture-pack.py can read
it without Home Assistant installed.
"""

# Imported official Sweet Home 3D libraries. Each is served at
# /com/eteks/sweethome3d/io/resources/<library>/, the URLs the catalog
# (frontend/vendor/resources/DefaultFurnitureCatalog.json) already uses.
FURNITURE_LIBRARIES = (
    "blendswap-cc-0",
    "blendswap-cc-by",
    "contributions",
    "katorlegaz",
    "lucapresidente",
    "reallusion",
    "scopia",
    "trees",
)

# Bump when the pack contents change; an installed pack with another
# version is replaced on the next start.
FURNITURE_PACK_VERSION = "1.9.3"
FURNITURE_PACK_FILENAME = f"home_3d_dashboard-furniture-{FURNITURE_PACK_VERSION}.zip"
FURNITURE_PACK_URL = (
    "https://github.com/MardariG/HA-3D-Home-Dashboard/releases/download/"
    f"v2.5.0/{FURNITURE_PACK_FILENAME}"
)
FURNITURE_PACK_SHA256 = "ca95963cd7a52f467ec03c3678e24452c1ec6ad9058ebe17e1a2953e8d907f9f"
# Archive size in bytes: progress total when the server sends no length.
FURNITURE_PACK_SIZE = 161672595
