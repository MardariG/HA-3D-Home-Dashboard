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

## Install via the Marketplace (or HACS)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=MardariG&repository=HA-3D-Home-Dashboard&category=integration)

On Home Assistant 2026.11+ the link opens the built-in **Marketplace**
(HACS became the Marketplace; existing HACS installs migrate automatically).
Or manually: **Settings → Marketplace** → three-dot menu → **Custom
repositories** → paste `https://github.com/MardariG/HA-3D-Home-Dashboard` →
type **Integration** → **Install** → restart Home Assistant. On older
versions, do the same from HACS.

On first start the integration downloads the extra furniture libraries
(~155 MB, the official Sweet Home 3D 1.9.3 libraries) from this repository's
releases into `<config>/home_3d_dashboard/furniture/`. They are not bundled
because Marketplace installs are limited to 100 MiB. The 3D Dashboard panel
shows a progress bar while it downloads (with a Retry button if it fails, and
a Reload button once it's done). Until the download finishes (or if Home Assistant has no internet access) those catalog items
show without thumbnails and can't be placed; the basic catalog always works.

Then go to **Settings → Devices & Services → Add Integration** → search
**3D Home Dashboard** → **Submit**. A **3D Dashboard** item appears in the
sidebar. (Alternatively add `home_3d_dashboard:` to `configuration.yaml`.)

## Features

- **Simple editor** — the editor opens in a simple mode built for
  Home Assistant:
  - **Your floors and areas:** a home without levels gets one level per
    HA floor, and each level lists the HA areas on that floor as rooms to
    draw.
  - **Rooms:** pick a room and drag a rectangle on the plan, or type its
    size. Walls are added automatically, and rooms that touch share one
    wall. Clicking inside walls or a room you already have links it
    instead.
  - **Doors and windows:** click a wall to add one. It opens towards the
    side you clicked.
  - **Devices:** drag an HA device onto the plan and it's bound as it's
    placed. Lights become ceiling lamps, TVs, radiators and blinds get
    their own models, and everything else gets a small colored marker.
    Dropping a light on an existing lamp binds that lamp, and dropping a
    temperature sensor on a room gives it a floor heatmap. A room drawn
    for an area with exactly one temperature sensor is bound to it
    automatically.
  - **Furniture:** an optional small set of common pieces.
  - **Floor plan image:** "Trace over a floor plan image" puts a picture
    of your floor plan under the plan, at the right scale.

  **Advanced editor** switches to the complete Sweet Home 3D editor
  (full catalog, any wall shape, levels, textures) on the same home.
- **Home Assistant look** — both editors follow your HA theme, including
  dark mode and custom primary colors. The Advanced editor's toolbar uses
  Home Assistant's Material Design Icons, with text labels on the drawing
  tools and *Add to home* when there's room, and a ⋮ menu for rarely used
  actions. Context
  menus and dialogs are restyled to match, and a tip at the bottom of the
  plan explains the current drawing tool (turn it off with its ×, back on
  from the ⋮ menu). The plan itself stays light in dark mode so walls and
  dimensions stay readable.
- **Several homes** — *New…* in the simple editor (or *New* in the
  Advanced editor's ⋮ menu) asks for a name and creates an empty home; the
  previous one stays in your list. The simple editor's header has a list
  of your homes: pick one to open it (*Open* in the Advanced editor's ⋮
  menu), and *Delete…* removes homes you no longer need (except the open
  one). The dashboard shows the home last opened in the editor, on every
  device. Each home keeps its own entity bindings.
  After updating, restart Home Assistant and reload the page: the
  dashboard shows a notice until both are done.
- **Native `.sh3d` files** — stored in `<config>/home_3d_dashboard/`, one
  per home (`<name>.sh3d`); interchange freely with the desktop
  [Sweet Home 3D](https://www.sweethome3d.com/) app. A `.sh3d` file copied
  into that folder shows up in the list of homes.
- **3D navigation** — orbit, pan, zoom, aerial view and virtual visit modes,
  mouse or touch
- **Entity bindings** — place devices from the simple editor, select an
  item there and choose *Bind…*, or right-click a furniture piece *or
  room* in the advanced editor (furniture list, plan or 3D view) →
  *Bind to entity…*. In view
  mode, toggleable entities tint their object amber while on and toggle on
  click/tap; `sensor.*`/`climate.*` entities show a floating 3D label with
  the live value, and rooms bound to temperature sensors get a floor
  heatmap (blue → red). Mappings persist server-side (v1-compatible).
- **Living scene** — the 3D view follows the real world: sun elevation
  drives a day/night lighting cycle (with golden-hour tint) and your
  `weather.*` entity dims the light and greys the sky when it's overcast.
- **Realistic rendering (v2.3)** — the dashboard renders with Three.js:
  soft shadow mapping, ACES tone mapping, and lamps that actually LIGHT
  their room when on — an emissive glow plus a shadow-casting point light
  whose intensity follows the light's HA brightness. The Sweet Home 3D
  engine still builds all geometry (walls/rooms/furniture stay pixel-true
  to the editor); Three.js only replaces the rasterizer
  (`src/dashboard3d.js` converts the engine's Java3D-style scene graph).
- **Authenticated API** — the sidebar panel is a custom element that owns
  the frontend's access token and hands it to the viewer/editor, so the
  home file API runs with `requires_auth` like any HA endpoint.

### Roadmap

- Virtual-visit (walk-through) camera mode for the Three.js dashboard
  (view mode currently offers orbit navigation; the editor keeps both)
- Entity state details in a hover/click info card (brightness, temperature)

## Migrating from v1.x

- Your entity mappings in `.storage/home_3d_dashboard_mappings` are kept.
- The Python `.sh3d` → OBJ converter (`sh3d_assembler.py`) and the Three.js
  viewer are gone; the engine now reads `.sh3d` directly.
- Previously uploaded models in `<config>/3d_models/` are not migrated —
  re-save them via the editor or copy the `.sh3d` files into
  `<config>/home_3d_dashboard/`, then pick them in the editor's list of
  homes.

## Development

The frontend is an npm/webpack project at the repo root (no Java required —
it consumes the prebuilt JSweet output in `public/vendor/`):

- `npm install` — installs webpack + plugins
- `npm run build:ha` — builds the panel into
  `custom_components/home_3d_dashboard/frontend/` (committed, so the
  Marketplace ships it)
- `node scripts/import-sh3f.js <dir>` — imports official `.sh3f` furniture
  libraries into the gitignored `furniture-pack/`;
  `python scripts/build-furniture-pack.py` zips it into `dist-pack/` for
  upload to a release, and prints the SHA-256 to pin in
  `custom_components/home_3d_dashboard/furniture_pack_info.py`
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
                     #   to the HA API via the __HA_BUILD__ define;
                     #   simpleMode.js is the simple editing panel,
                     #   advancedUi.js the Advanced editor's toolbar,
                     #   editorTheme.js/.css the HA theme and styling, and
                     #   homes.js several homes, the active one and the
                     #   simple editor's home list)
public/              # Sweet Home 3D engine: vendor libs, editor sources,
                     #   icons, furniture models (legacy global scripts,
                     #   loaded via <script> tags — see webpack.config.js)
```

The home file API implements the protocol expected by the engine's
`DirectHomeRecorder` (`public/src/DirectHomeRecorder.js`): GET/POST raw
`.sh3d` bytes at `/api/home_3d_dashboard/homes/{name}`, JSON list at
`/homes`, delete via GET `?action=delete` (which also drops the home's
bindings). The active home — the one the dashboard and editor open — is
kept in the integration's settings (`home_3d_dashboard/get_active_home`,
`/set_active_home` websocket commands); the panel passes it to the pages
in its `sh3d-config` message. Bindings are stored per home: `default` keeps
the v1-compatible top-level `mappings`, other homes use `home_mappings`.

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
Third-party component licenses (Big.js, glMatrix, JSZip, Batik, Material
Design Icons, …) are in
[`licenses/`](licenses/) and are shipped into the build output.
