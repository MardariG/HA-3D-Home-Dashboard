# 3D Home Dashboard

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)
[![GitHub Release](https://img.shields.io/github/v/release/MardariG/HA-3D-Home-Dashboard)](https://github.com/MardariG/HA-3D-Home-Dashboard/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An interactive 3D model dashboard for Home Assistant. Upload a GLB/GLTF model of your home and map rooms, walls, and objects to real Home Assistant entities — lights, switches, and sensors. The 3D view updates in real time based on entity states.

## Quick Install via HACS

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=MardariG&repository=HA-3D-Home-Dashboard&category=integration)

Or manually: HACS → three-dot menu → **Custom repositories** → paste `https://github.com/MardariG/HA-3D-Home-Dashboard` → select **Integration** → **Install**

## Features

- **3D Model Upload** — drag-and-drop or browse for GLB/GLTF files
- **Interactive Viewer** — orbit (rotate), pan, and zoom with mouse or touch
- **Edit Mode** — click any mesh in the 3D model to map it to a HA entity
- **Entity Types** — supports lights, switches, and sensors
- **Real-Time Rendering**:
  - Lights glow with correct color, brightness, and color temperature
  - Switches show green tint when on, dimmed when off
  - Sensors color-map based on value (temperature, humidity, etc.)
- **Click to Toggle** — click a mapped light or switch in the 3D view to toggle it
- **Hover Tooltips** — see entity name, state, and brightness on hover
- **Persistent Storage** — mappings and model are saved across restarts

## Installation

### HACS (Recommended)

Use the **Quick Install** button above, or:

1. Open HACS in your Home Assistant instance
2. Click the three dots menu → **Custom repositories**
3. Paste `https://github.com/MardariG/HA-3D-Home-Dashboard` and select **Integration**
4. Search for "3D Home Dashboard" and click **Install**
5. Restart Home Assistant

### Manual

1. Copy the `custom_components/home_3d_dashboard` folder to your `config/custom_components/` directory
2. Restart Home Assistant

## Configuration

Go to **Settings → Integrations → Add Integration** → search **3D Home Dashboard** → click **Submit**. The sidebar item appears automatically.

Alternatively, add the following to your `configuration.yaml`:

```yaml
home_3d_dashboard:
```

Restart Home Assistant. A new **3D Dashboard** item will appear in your sidebar.

## Usage

1. Click **3D Dashboard** in the sidebar
2. Upload a GLB or GLTF 3D model of your home
3. Click **Edit Mode** in the top bar
4. Click any mesh/object in the 3D model or in the side panel list
5. Select a Home Assistant entity (light, switch, or sensor) from the dropdown
6. Click **Save** to create the mapping
7. Click **Done Editing** to exit edit mode
8. The 3D model now reflects live entity states — and you can click to toggle lights/switches!

## Creating a 3D Model

You can create home models using:

- **Blender** (free) — export as GLB
- **SketchUp** — export via glTF extension
- **Sweet Home 3D** — export via OBJ then convert to GLB
- **Floorplanner / Homestyler** — online tools with export options

**Tips for best results:**
- Name your meshes descriptively (e.g., "Living_Room", "Kitchen_Light", "Bedroom_Wall")
- Keep mesh names unique — they're used as identifiers for entity mapping
- Use separate meshes for rooms/objects you want to control independently
- Optimize the model (reduce polygon count) for smooth performance

## Requirements

- Home Assistant 2024.1.0 or newer
- A modern browser with WebGL support
- A GLB or GLTF 3D model file

## License

MIT
