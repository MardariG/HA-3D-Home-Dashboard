# 3D Home Dashboard

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)
[![GitHub Release](https://img.shields.io/github/v/release/MardariG/HA-3D-Home-Dashboard)](https://github.com/MardariG/HA-3D-Home-Dashboard/releases)
[![License: GPL v2](https://img.shields.io/badge/License-GPL_v2-blue.svg)](https://www.gnu.org/licenses/old-licenses/gpl-2.0.html)

Build, edit and view your home in 3D — directly inside Home Assistant.

v2 replaces the old Three.js viewer + Python `.sh3d` converter with the full
**Sweet Home 3D** engine running in the browser: a complete 2D floor-plan +
3D editor in a sidebar panel. No desktop app needed — draw walls, rooms and
furniture right in HA, and homes are saved as standard `.sh3d` files in your
config directory.

## Quick Install via HACS

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=MardariG&repository=HA-3D-Home-Dashboard&category=integration)

Or manually: HACS → three-dot menu → **Custom repositories** → paste
`https://github.com/MardariG/HA-3D-Home-Dashboard` → select **Integration** →
**Install** → restart Home Assistant.

Then go to **Settings → Devices & Services → Add Integration** → search
**3D Home Dashboard** → **Submit**. A **3D Dashboard** item appears in the
sidebar. (Alternatively add `home_3d_dashboard:` to `configuration.yaml`.)

## Features

- **Full in-browser editor** — draw walls and rooms, place furniture, and
  see the live 3D view side-by-side (the complete Sweet Home 3D web editor)
- **Native `.sh3d` files** — stored in `<config>/home_3d_dashboard/`;
  interchange freely with the desktop [Sweet Home 3D](https://www.sweethome3d.com/) app
- **3D navigation** — orbit, pan, zoom, aerial view and virtual visit modes,
  mouse or touch
- **Entity bindings** — right-click a furniture piece in the editor
  (furniture list, plan or 3D view) → *Bind to entity…* and pick any
  toggleable Home Assistant entity. In view mode the piece tints amber
  while the entity is on, and clicking/tapping it toggles the entity.
  Mappings persist server-side (v1-compatible storage format).
- **Authenticated API** — the sidebar panel is a custom element that owns
  the frontend's access token and hands it to the viewer/editor, so the
  home file API runs with `requires_auth` like any HA endpoint.

### Roadmap

- Per-light glow rendering (the engine's realtime renderer has no emissive
  materials, so "on" is currently shown by tinting the whole piece)
- Entity state details in a hover/click info card (brightness, temperature)

## Migrating from v1.x

- Your entity mappings in `.storage/home_3d_dashboard_mappings` are kept.
- The Python `.sh3d` → OBJ converter (`sh3d_assembler.py`) and the Three.js
  viewer are gone; the engine now reads `.sh3d` directly.
- Previously uploaded models in `<config>/3d_models/` are not migrated —
  re-save them via the editor or copy the `.sh3d` files into
  `<config>/home_3d_dashboard/`.

## Development

The frontend is an npm/webpack project at the repo root (no Java required —
it consumes the prebuilt JSweet output in `public/vendor/`):

- `npm install` — installs webpack + plugins
- `npm run build:ha` — builds the panel into
  `custom_components/home_3d_dashboard/frontend/` (committed, so HACS ships it)
- `docker compose up -d` — spins up a disposable Home Assistant with the
  integration bind-mounted (see comments in `docker-compose.yml`; state
  lives in the gitignored `.ha-test/`)
- `npm run build` — standalone web build into `dist/` (viewer at `/`,
  editor at `/editor.html`) for hosting outside HA
- `npm start` — dev server on <http://localhost:8080> (standalone mode)

Layout highlights:

```
custom_components/home_3d_dashboard/
├── __init__.py      # panel + static files + websocket mappings/settings
├── http.py          # /api/home_3d_dashboard/homes* (.sh3d read/write API)
├── config_flow.py, strings.json, translations/
└── frontend/        # output of `npm run build:ha`
src/                 # webpack entries (editor.js wires DirectHomeRecorder
                     #   to the HA API via the __HA_BUILD__ define)
public/              # Sweet Home 3D engine: vendor libs, editor sources,
                     #   icons, furniture models (legacy global scripts,
                     #   loaded via <script> tags — see webpack.config.js)
```

The home file API implements the protocol expected by the engine's
`DirectHomeRecorder` (`public/src/DirectHomeRecorder.js`): GET/POST raw
`.sh3d` bytes at `/api/home_3d_dashboard/homes/{name}`, JSON list at
`/homes`, delete via GET `?action=delete`.

The API requires authentication: the custom panel element (`panel.js`)
passes the frontend's access token to the iframe over a same-origin
postMessage handshake, and the pages (plus the save worker) attach it as a
Bearer header on API requests (`src/haAuth.js`). Consequently the
viewer/editor pages only work when opened through the sidebar panel. Home
names are strictly sanitized server-side. Note: HA's HTTP stack caps
uploads (~16 MB) — very model-heavy homes may exceed it.

## Requirements

- Home Assistant 2024.1.0 or newer
- A modern browser with WebGL support

## License

GPL v2 or later — see [LICENSE](LICENSE). This project bundles the
[Sweet Home 3D](https://www.sweethome3d.com/) JS engine (GPL, © eTeks /
Space Mushrooms); it is not affiliated with or endorsed by eTeks.
Third-party component licenses (Big.js, glMatrix, JSZip, Batik, …) are in
[`licenses/`](licenses/) and are shipped into the build output.
