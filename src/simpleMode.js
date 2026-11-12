/**
 * Simple editing mode for the editor page.
 *
 * A friendlier front end over the full Sweet Home 3D editor: the engine,
 * its plan and 3D views and the .sh3d format stay the same, but the dense
 * toolbar and catalog are replaced by a side panel that:
 *
 *   1. offers the user's Home Assistant floors and areas ("your rooms") and
 *      creates one level per HA floor;
 *   2. draws rooms as rectangles (drag on the plan, or type the size) with
 *      walls created automatically, shared walls drawn once;
 *   3. places doors and windows with one click on a wall;
 *   4. places Home Assistant devices, which binds them as it places them
 *      (dropping onto an existing lamp or room binds that one instead);
 *   5. adds furniture from a small curated set (the full catalog is one
 *      click away in the Advanced editor).
 *
 * "Advanced editor" switches back to the complete Sweet Home 3D UI on the
 * same home. Every change goes through the engine's controllers, so it is
 * undoable and saved like any other edit.
 *
 * Rooms created here carry the properties ha3d.simple and ha3d.areaId;
 * levels created from HA floors carry ha3d.floorId (HomeObject properties
 * are saved in the .sh3d file).
 */

var STORAGE_KEY = 'home_3d_dashboard.editorMode';
var PANEL_WIDTH = 320;

var AREA_PROPERTY = 'ha3d.areaId';
var SIMPLE_PROPERTY = 'ha3d.simple';
var FLOOR_PROPERTY = 'ha3d.floorId';

// Geometry tolerances, in cm
var COLLINEAR_TOLERANCE = 2;
var MIN_WALL_LENGTH = 5;
var MIN_ROOM_SIZE = 50;
var GRID = 5;

var OPENINGS = [
  { id: 'eTeks#door', label: 'Door' },
  { id: 'eTeks#frontDoor', label: 'Front door' },
  { id: 'eTeks#window85x123', label: 'Window' },
  { id: 'eTeks#doubleWindow126x163', label: 'Wide window' },
  { id: 'eTeks#frenchWindow85x200', label: 'French window' },
  { id: 'eTeks#garageDoor', label: 'Garage door' }
];

var FURNITURE = [
  { id: 'eTeks#sofa2', label: 'Sofa' },
  { id: 'eTeks#armchair2', label: 'Armchair' },
  { id: 'eTeks#coffeeTable', label: 'Coffee table' },
  { id: 'eTeks#table', label: 'Table' },
  { id: 'eTeks#chair2', label: 'Chair' },
  { id: 'eTeks#tvUnit', label: 'TV unit' },
  { id: 'eTeks#bed140x190', label: 'Double bed' },
  { id: 'eTeks#bed90x190', label: 'Single bed' },
  { id: 'eTeks#wardrobe', label: 'Wardrobe' },
  { id: 'eTeks#desk', label: 'Desk' },
  { id: 'eTeks#bookcase', label: 'Bookcase' },
  { id: 'eTeks#kitchenCabinet', label: 'Kitchen unit' },
  { id: 'eTeks#fridgeFreezer', label: 'Fridge' },
  { id: 'eTeks#cooker', label: 'Cooker' },
  { id: 'eTeks#sink', label: 'Sink' },
  { id: 'eTeks#washbasin', label: 'Washbasin' },
  { id: 'eTeks#toiletUnit', label: 'Toilet' },
  { id: 'eTeks#shower', label: 'Shower' },
  { id: 'eTeks#bath', label: 'Bath' },
  { id: 'eTeks#clothesWasher', label: 'Washer' },
  { id: 'eTeks#plant', label: 'Plant' }
];

// How each device is represented when placed. Everything without a fitting
// model in the basic catalog becomes a small colored box ("marker").
var DOMAIN_STYLES = {
  light: { icon: '💡', catalogId: 'eTeks#pendantLamp', mount: 'ceiling' },
  media_player: { icon: '📺', catalogId: 'eTeks#flatTV' },
  climate: { icon: '🌡️', catalogId: 'eTeks#electricRadiator', elevation: 15 },
  cover: { icon: '🪟', catalogId: 'eTeks#blind', elevation: 50 },
  switch: { icon: '🔌', color: 0x26a69a },
  input_boolean: { icon: '🔘', color: 0x26a69a },
  fan: { icon: '🌀', color: 0x29b6f6 },
  lock: { icon: '🔒', color: 0xffa726 },
  vacuum: { icon: '🧹', color: 0x8d6e63 },
  scene: { icon: '🎬', color: 0xab47bc },
  script: { icon: '▶️', color: 0xab47bc },
  sensor: { icon: '📟', color: 0x78909c }
};
var MARKER = { catalogId: 'eTeks#texturableBox', size: 14, elevation: 110 };

// The hidden panes keep their size (visibility, not display: none): the
// editor's splitters would otherwise shrink them to 0 and save that in the home.
var STYLE = [
  'body.h3d-simple #home-pane-toolbar, body.h3d-simple #application-menu-toolbar,',
  'body.h3d-simple #catalog-furniture-pane, body.h3d-simple #furniture-plan-splitter',
  '  { visibility: hidden !important; }',
  'body.h3d-simple #plan-3D-view-pane { top: 0 !important; left: ' + PANEL_WIDTH + 'px !important;',
  '  width: calc(100% - ' + PANEL_WIDTH + 'px) !important; height: 100% !important; }',
  'body:not(.h3d-simple) #h3d-simple { display: none; }',
  '#h3d-simple { position: fixed; left: 0; top: 0; bottom: 0; width: ' + PANEL_WIDTH + 'px;',
  '  box-sizing: border-box; display: flex; flex-direction: column; z-index: 9000;',
  '  background: var(--h3d-bg); color: var(--h3d-text); border-right: 1px solid var(--h3d-divider);',
  '  font: 13px/1.45 var(--h3d-font);',
  '  user-select: none; -webkit-user-select: none; }',
  '#h3d-simple * { box-sizing: border-box; }',
  '#h3d-simple span, #h3d-simple div { color: inherit; }',
  '#h3d-simple .h3d-head { padding: 10px 12px; background: var(--h3d-card); border-bottom: 1px solid var(--h3d-divider); }',
  '#h3d-simple .h3d-title { display: flex; align-items: center; justify-content: space-between; }',
  '#h3d-simple .h3d-title b { font-size: 15px; }',
  '#h3d-simple .h3d-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }',
  '#h3d-simple .h3d-head .h3d-row { margin-top: 8px; }',
  '#h3d-simple .h3d-head .h3d-home-row { margin-top: 4px; gap: 10px; }',
  '#h3d-simple span.h3d-home-name { flex: 1; min-width: 0; font-weight: 500; overflow: hidden;',
  '  text-overflow: ellipsis; white-space: nowrap; }',
  '#h3d-simple span.h3d-status { margin-left: auto; font-size: 12px; color: var(--h3d-text2); }',
  '#h3d-simple span.h3d-status.dirty { color: var(--h3d-warning); }',
  '#h3d-simple .h3d-body { flex: 1; overflow-y: auto; padding: 4px 0 12px; }',
  '#h3d-simple section { padding: 8px 12px 10px; border-bottom: 1px solid var(--h3d-divider); }',
  '#h3d-simple h3 { margin: 4px 0 6px; font-size: 12px; text-transform: uppercase;',
  '  letter-spacing: .05em; color: var(--h3d-text2); display: flex; align-items: center; gap: 6px; }',
  '#h3d-simple h3 span.h3d-count { margin-left: auto; text-transform: none; letter-spacing: 0;',
  '  font-weight: 400; color: var(--h3d-text2); }',
  '#h3d-simple .h3d-hint, #h3d-simple span.h3d-hint { color: var(--h3d-text2); font-size: 12px; margin: 2px 0 6px; }',
  '#h3d-simple button { font: inherit; cursor: pointer; border: 1px solid var(--h3d-border);',
  '  background: var(--h3d-card); color: var(--h3d-text); border-radius: 6px; padding: 4px 10px; }',
  '#h3d-simple button:hover { background: var(--h3d-hover); }',
  '#h3d-simple button:disabled { opacity: .45; cursor: default; }',
  '#h3d-simple button.primary { background: var(--h3d-primary); border-color: var(--h3d-primary); color: var(--h3d-on-primary); }',
  '#h3d-simple button.primary:hover { background: color-mix(in srgb, var(--h3d-primary) 88%, #000); }',
  '#h3d-simple button.danger { color: var(--h3d-error); border-color: color-mix(in srgb, var(--h3d-error) 45%, transparent); }',
  '#h3d-simple button.link { border: 0; background: none; color: var(--h3d-primary); padding: 2px 0; }',
  '#h3d-simple button.link:hover { text-decoration: underline; background: none; }',
  '#h3d-simple button.active { background: var(--h3d-primary-tint); border-color: var(--h3d-primary); box-shadow: inset 0 0 0 1px var(--h3d-primary); }',
  '#h3d-simple .h3d-chips { display: flex; gap: 6px; flex-wrap: wrap; }',
  '#h3d-simple .h3d-chip { border-radius: 14px; padding: 3px 12px; }',
  '#h3d-simple .h3d-list { display: flex; flex-direction: column; gap: 4px; }',
  '#h3d-simple .h3d-item { display: flex; align-items: center; gap: 8px; padding: 5px 8px;',
  '  background: var(--h3d-card); border: 1px solid var(--h3d-divider); border-radius: 6px; min-height: 34px; }',
  '#h3d-simple .h3d-item[draggable="true"] { cursor: grab; }',
  '#h3d-simple .h3d-item .h3d-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
  '#h3d-simple .h3d-item span.h3d-sub { display: block; font-size: 11px; color: var(--h3d-text2); overflow: hidden; text-overflow: ellipsis; }',
  '#h3d-simple .h3d-item.done { background: var(--h3d-success-tint); border-color: color-mix(in srgb, var(--h3d-success) 40%, transparent); }',
  '#h3d-simple .h3d-item.done span.h3d-check { color: var(--h3d-success); font-weight: 700; }',
  '#h3d-simple .h3d-item.current { border-color: var(--h3d-primary); box-shadow: 0 0 0 1px var(--h3d-primary); }',
  '#h3d-simple .h3d-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }',
  '#h3d-simple .h3d-tile { display: flex; flex-direction: column; align-items: center; gap: 2px;',
  '  padding: 6px 2px; font-size: 11px; text-align: center; }',
  '#h3d-simple .h3d-tile img { width: 44px; height: 44px; object-fit: contain; pointer-events: none; }',
  '#h3d-simple .h3d-card { background: var(--h3d-card); border: 1px solid var(--h3d-primary); border-radius: 8px; padding: 10px; }',
  '#h3d-simple .h3d-card label { display: block; font-size: 11px; color: var(--h3d-text2); margin: 6px 0 2px; }',
  '#h3d-simple input[type=text], #h3d-simple input[type=search], #h3d-simple input[type=number], #h3d-simple select',
  '  { font: inherit; width: 100%; padding: 4px 6px; border: 1px solid var(--h3d-border); border-radius: 5px; background: var(--h3d-card); color: var(--h3d-text); }',
  '#h3d-simple .h3d-size { display: flex; gap: 6px; align-items: center; }',
  '#h3d-simple .h3d-size input { width: 74px; }',
  '#h3d-simple details summary { cursor: pointer; color: var(--h3d-primary); margin: 6px 0; }',
  '#h3d-simple .h3d-tool { padding: 10px 12px; background: #263238; color: #fff; display: none; }',
  '#h3d-simple .h3d-tool.on { display: flex; gap: 8px; align-items: center; }',
  '#h3d-simple .h3d-tool span { flex: 1; }',
  '#h3d-simple .h3d-tool button { background: #455a64; border-color: #546e7a; color: #fff; }',
  '#h3d-overlay { position: fixed; z-index: 8000; cursor: crosshair; touch-action: none; overflow: hidden; }',
  '#h3d-overlay .h3d-rect { position: absolute; border: 2px solid var(--h3d-primary); background: var(--h3d-primary-tint); }',
  '#h3d-overlay .h3d-rect span { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%);',
  '  background: var(--h3d-primary); color: var(--h3d-on-primary); padding: 2px 8px; border-radius: 10px; white-space: nowrap;',
  '  font: 600 12px/1.4 system-ui, sans-serif; }',
  '#h3d-overlay .h3d-dot { position: absolute; width: 14px; height: 14px; margin: -7px 0 0 -7px;',
  '  border-radius: 50%; background: var(--h3d-primary); box-shadow: 0 0 0 4px var(--h3d-primary-tint); }',
  '#h3d-overlay svg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; }',
  '#h3d-overlay .h3d-tip { position: absolute; background: rgba(38,50,56,.9); color: #fff; padding: 2px 8px;',
  '  border-radius: 4px; white-space: nowrap; font: 12px/1.4 system-ui, sans-serif; pointer-events: none; }',
  '#h3d-dialog { position: fixed; inset: 0; z-index: 10003; background: rgba(0,0,0,.35);',
  '  display: flex; align-items: center; justify-content: center; font: 13px/1.5 var(--h3d-font); }',
  '#h3d-dialog > div { background: var(--h3d-card); color: var(--h3d-text); border-radius: 16px; padding: 20px 24px; max-width: 380px;',
  '  box-shadow: var(--h3d-shadow); }',
  '#h3d-dialog .h3d-row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px; }',
  '#h3d-dialog button { font: 500 14px/1 var(--h3d-font); cursor: pointer; border: 1px solid var(--h3d-border); background: transparent;',
  '  color: var(--h3d-primary); border-radius: 17px; height: 34px; padding: 0 16px; }',
  '#h3d-dialog button.primary { background: var(--h3d-primary); border-color: var(--h3d-primary); color: var(--h3d-on-primary); }',
  '#h3d-toast { position: fixed; bottom: 14px; left: 50%; transform: translateX(-50%); z-index: 10002;',
  '  max-width: 440px; background: rgba(38,50,56,.95); color: #fff; padding: 8px 14px; border-radius: 6px;',
  '  font: 13px/1.5 var(--h3d-font); }',
  '@media (max-width: 720px) {',
  '  #h3d-simple { top: auto; height: 46%; width: 100%; right: 0; border-right: 0; border-top: 1px solid var(--h3d-divider); }',
  '  body.h3d-simple #plan-3D-view-pane { left: 0 !important; width: 100% !important; height: 54% !important; }',
  '}'
].join('\n');

/* --------------------------------- helpers -------------------------------- */

function el(tag, attributes, children) {
  var node = document.createElement(tag);
  if (attributes) {
    for (var key in attributes) {
      var value = attributes[key];
      if (value === undefined || value === null || value === false) {
        continue;
      }
      if (key === 'text') {
        node.textContent = value;
      } else if (key === 'className') {
        node.className = value;
      } else if (key.substring(0, 2) === 'on') {
        node.addEventListener(key.substring(2).toLowerCase(), value);
      } else {
        node.setAttribute(key, value === true ? '' : value);
      }
    }
  }
  (children || []).forEach(function (child) {
    if (child === null || child === undefined || child === false) {
      return;
    }
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  });
  return node;
}

function normalize(name) {
  return (name || '').trim().toLowerCase();
}

function metres(cm) {
  return (Math.round(cm) / 100).toFixed(2);
}

function domainOf(entityId) {
  return entityId.substring(0, entityId.indexOf('.'));
}

function isTemperatureSensor(entity) {
  return domainOf(entity.entity_id) === 'sensor'
    && (entity.device_class === 'temperature' || /°[CF]$/.test(entity.unit || ''));
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  var dx = x2 - x1;
  var dy = y2 - y1;
  var lengthSq = dx * dx + dy * dy;
  var t = lengthSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  var x = x1 + t * dx;
  var y = y1 + t * dy;
  return { distance: Math.hypot(px - x, py - y), x: x, y: y };
}

function rectanglePoints(x0, y0, x1, y1) {
  var xMin = Math.min(x0, x1);
  var xMax = Math.max(x0, x1);
  var yMin = Math.min(y0, y1);
  var yMax = Math.max(y0, y1);
  return [[xMin, yMin], [xMax, yMin], [xMax, yMax], [xMin, yMax]];
}

function roomBounds(room) {
  var points = room.getPoints();
  var b = { xMin: Infinity, yMin: Infinity, xMax: -Infinity, yMax: -Infinity };
  points.forEach(function (p) {
    b.xMin = Math.min(b.xMin, p[0]);
    b.yMin = Math.min(b.yMin, p[1]);
    b.xMax = Math.max(b.xMax, p[0]);
    b.yMax = Math.max(b.yMax, p[1]);
  });
  return b;
}

// True when the room is an axis-aligned rectangle (its size can be typed).
function isRectangle(room) {
  var points = room.getPoints();
  if (points.length !== 4) {
    return false;
  }
  var b = roomBounds(room);
  return points.every(function (p) {
    return (Math.abs(p[0] - b.xMin) < 0.5 || Math.abs(p[0] - b.xMax) < 0.5)
      && (Math.abs(p[1] - b.yMin) < 0.5 || Math.abs(p[1] - b.yMax) < 0.5);
  });
}

function edgesOf(points) {
  var edges = [];
  for (var i = 0; i < points.length; i++) {
    var p = points[i];
    var q = points[(i + 1) % points.length];
    var length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (length >= 1) {
      edges.push({ x: p[0], y: p[1], ux: (q[0] - p[0]) / length, uy: (q[1] - p[1]) / length, length: length });
    }
  }
  return edges;
}

// Interval [from, to] of the edge covered by the wall, or null when the wall
// isn't lying along the edge.
function wallCoverage(edge, wall) {
  var ends = [[wall.getXStart(), wall.getYStart()], [wall.getXEnd(), wall.getYEnd()]];
  var t = [];
  for (var i = 0; i < 2; i++) {
    var dx = ends[i][0] - edge.x;
    var dy = ends[i][1] - edge.y;
    var across = Math.abs(dx * edge.uy - dy * edge.ux);
    if (across > COLLINEAR_TOLERANCE || wall.getArcExtent()) {
      return null;
    }
    t.push(dx * edge.ux + dy * edge.uy);
  }
  var from = Math.max(0, Math.min(t[0], t[1]));
  var to = Math.min(edge.length, Math.max(t[0], t[1]));
  return to - from > 1 ? [from, to] : null;
}

/* -------------------------------- the mode -------------------------------- */

/**
 * Installs the simple editing panel and opens the mode the user last chose.
 * @return {{setSimple: function(boolean), isSimple: function(): boolean}|null}
 */
export function installSimpleMode(application, bridge) {
  var homes = application.getHomes();
  if (homes.length === 0) {
    return null;
  }
  var home = homes[0];
  var controller = application.getHomeController(home);
  var planController = controller.getPlanController();
  var furnitureController = controller.getFurnitureController();
  var preferences = application.getUserPreferences();
  var undoSupport = controller.getUndoableEditSupport();
  var plan = planController.getView();

  var state = {
    tool: null,           // {kind: 'room'|'opening'|'place', ...}
    pointer: null,        // last pointer position in model coordinates
    dragStart: null,      // room drawing start point
    dragPayload: null,    // item dragged from the panel
    showAllDevices: false,
    deviceFilter: '',
    lastSignature: null,
    roomPoints: {},       // room id -> points JSON, to repair walls after moves
    extendingSelection: false,
    leaving: false
  };

  document.head.appendChild(el('style', { text: STYLE }));

  /* ------------------------------ catalog ------------------------------ */

  var catalogIndex = null;

  function catalogPiece(id) {
    if (catalogIndex === null || !(id in catalogIndex)) {
      catalogIndex = {};
      preferences.getFurnitureCatalog().getCategories().forEach(function (category) {
        category.getFurniture().forEach(function (piece) {
          catalogIndex[piece.getId()] = piece;
        });
      });
    }
    return catalogIndex[id] || null;
  }

  function iconURL(id) {
    var piece = catalogPiece(id);
    var icon = piece && piece.getIcon();
    return icon && typeof icon.getURL === 'function' ? icon.getURL() : null;
  }

  /* ------------------------------ queries ------------------------------ */

  function selectedLevel() {
    return home.getSelectedLevel();
  }

  function sortedLevels() {
    return home.getLevels().slice(0).sort(function (a, b) {
      return a.getElevation() - b.getElevation()
        || a.getElevationIndex() - b.getElevationIndex();
    });
  }

  function levelWalls(level) {
    return home.getWalls().filter(function (wall) {
      return wall.isAtLevel(level);
    });
  }

  function levelRooms(level) {
    return home.getRooms().filter(function (room) {
      return room.isAtLevel(level);
    });
  }

  function wallHeight() {
    var level = selectedLevel();
    return level ? level.getHeight() : preferences.getNewWallHeight();
  }

  function floorOfLevel(level) {
    if (!level) {
      return null;
    }
    var floors = bridge.getFloors();
    var id = level.getProperty(FLOOR_PROPERTY);
    for (var i = 0; i < floors.length; i++) {
      if (floors[i].floor_id === id) {
        return floors[i];
      }
    }
    for (var j = 0; j < floors.length; j++) {
      if (normalize(floors[j].name) === normalize(level.getName())) {
        return floors[j];
      }
    }
    return null;
  }

  function areaById(areaId) {
    var areas = bridge.getAreas();
    for (var i = 0; i < areas.length; i++) {
      if (areas[i].area_id === areaId) {
        return areas[i];
      }
    }
    return null;
  }

  function areaOfRoom(room) {
    var area = areaById(room.getProperty(AREA_PROPERTY));
    if (area) {
      return area;
    }
    var name = normalize(room.getName());
    var areas = bridge.getAreas();
    for (var i = 0; name && i < areas.length; i++) {
      if (normalize(areas[i].name) === name) {
        return areas[i];
      }
    }
    return null;
  }

  function roomOfArea(area) {
    var rooms = home.getRooms();
    for (var i = 0; i < rooms.length; i++) {
      if (rooms[i].getProperty(AREA_PROPERTY) === area.area_id) {
        return rooms[i];
      }
    }
    for (var j = 0; j < rooms.length; j++) {
      if (!rooms[j].getProperty(AREA_PROPERTY)
          && normalize(rooms[j].getName()) === normalize(area.name)) {
        return rooms[j];
      }
    }
    return null;
  }

  // Areas to offer on the selected level: those on its HA floor (plus areas
  // without a floor), or every area when levels aren't linked to floors.
  function areasForLevel() {
    var areas = bridge.getAreas();
    var floor = floorOfLevel(selectedLevel());
    if (!floor) {
      return areas;
    }
    return areas.filter(function (area) {
      return !area.floor_id || area.floor_id === floor.floor_id;
    });
  }

  function allPieces() {
    var pieces = [];
    var add = function (piece) {
      pieces.push(piece);
      if (piece instanceof window.HomeFurnitureGroup) {
        piece.getAllFurniture().forEach(add);
      }
    };
    home.getFurniture().forEach(add);
    return pieces;
  }

  function itemById(id) {
    var pieces = allPieces();
    for (var i = 0; i < pieces.length; i++) {
      if (pieces[i].getId() === id) {
        return pieces[i];
      }
    }
    var rooms = home.getRooms();
    for (var j = 0; j < rooms.length; j++) {
      if (rooms[j].getId() === id) {
        return rooms[j];
      }
    }
    return null;
  }

  // Items currently bound to entityId
  function boundItems(entityId) {
    var mappings = bridge.getMappings();
    var items = [];
    for (var targetId in mappings) {
      if (mappings[targetId] === entityId) {
        var item = itemById(targetId);
        if (item) {
          items.push(item);
        }
      }
    }
    return items;
  }

  function entityById(entityId) {
    var entities = bridge.getEntities();
    for (var i = 0; i < entities.length; i++) {
      if (entities[i].entity_id === entityId) {
        return entities[i];
      }
    }
    return null;
  }

  /* --------------------------- walls and rooms -------------------------- */

  // New walls along the parts of the polygon's edges no wall covers yet, so
  // rooms sharing a side share one wall. Consecutive walls are joined.
  function missingWalls(points, level, ignoredWalls) {
    var existing = levelWalls(level).filter(function (wall) {
      return !ignoredWalls || ignoredWalls.indexOf(wall) < 0;
    });
    var thickness = preferences.getNewWallThickness();
    var height = wallHeight();
    var walls = [];
    edgesOf(points).forEach(function (edge) {
      var covered = existing
        .map(function (wall) { return wallCoverage(edge, wall); })
        .filter(Boolean)
        .sort(function (a, b) { return a[0] - b[0]; });
      var free = [];
      var position = 0;
      covered.forEach(function (interval) {
        if (interval[0] > position) {
          free.push([position, interval[0]]);
        }
        position = Math.max(position, interval[1]);
      });
      if (position < edge.length) {
        free.push([position, edge.length]);
      }
      free.forEach(function (segment) {
        if (segment[1] - segment[0] < MIN_WALL_LENGTH) {
          return;
        }
        walls.push(new window.Wall(
          edge.x + edge.ux * segment[0], edge.y + edge.uy * segment[0],
          edge.x + edge.ux * segment[1], edge.y + edge.uy * segment[1],
          thickness, height, preferences.getNewWallPattern()));
      });
    });
    for (var i = 0; i < walls.length; i++) {
      var wall = walls[i];
      var next = walls[(i + 1) % walls.length];
      if (next !== wall
          && Math.abs(wall.getXEnd() - next.getXStart()) < 0.5
          && Math.abs(wall.getYEnd() - next.getYStart()) < 0.5) {
        wall.setWallAtEnd(next);
        next.setWallAtStart(wall);
      }
    }
    walls.forEach(function (wall) {
      joinToFreeEnd(wall, true, existing);
      joinToFreeEnd(wall, false, existing);
    });
    return walls;
  }

  // Joins a free end of a new wall to a free end of an existing wall at the
  // same point (a corner with a wall that was already there). Deleting the
  // new wall, e.g. on undo, detaches it again.
  function joinToFreeEnd(wall, atStart, existing) {
    if (atStart ? wall.getWallAtStart() : wall.getWallAtEnd()) {
      return;
    }
    var x = atStart ? wall.getXStart() : wall.getXEnd();
    var y = atStart ? wall.getYStart() : wall.getYEnd();
    for (var i = 0; i < existing.length; i++) {
      var other = existing[i];
      if (other.getArcExtent()) {
        continue;
      }
      var join = null;
      if (!other.getWallAtStart() && Math.hypot(other.getXStart() - x, other.getYStart() - y) < 0.5) {
        join = 'start';
      } else if (!other.getWallAtEnd() && Math.hypot(other.getXEnd() - x, other.getYEnd() - y) < 0.5) {
        join = 'end';
      }
      if (join === null) {
        continue;
      }
      // Collinear walls don't need a corner joint
      var a = Math.atan2(wall.getYEnd() - wall.getYStart(), wall.getXEnd() - wall.getXStart());
      var b = Math.atan2(other.getYEnd() - other.getYStart(), other.getXEnd() - other.getXStart());
      if (Math.abs(Math.sin(a - b)) < 0.01) {
        continue;
      }
      if (atStart) {
        wall.setWallAtStart(other);
      } else {
        wall.setWallAtEnd(other);
      }
      if (join === 'start') {
        other.setWallAtStart(wall);
      } else {
        other.setWallAtEnd(wall);
      }
      return;
    }
  }

  // Walls lying along the room's edges
  function wallsOfRoom(room) {
    var edges = edgesOf(room.getPoints());
    return levelWalls(room.getLevel()).filter(function (wall) {
      return edges.some(function (edge) {
        var coverage = wallCoverage(edge, wall);
        var length = wall.getStartPointToEndPointDistance();
        return coverage !== null && coverage[1] - coverage[0] > length - 2 * COLLINEAR_TOLERANCE;
      });
    });
  }

  // The room's walls that no other room on its level also uses
  function ownWalls(room) {
    var others = levelRooms(room.getLevel()).filter(function (other) {
      return other !== room;
    });
    return wallsOfRoom(room).filter(function (wall) {
      return !others.some(function (other) {
        return edgesOf(other.getPoints()).some(function (edge) {
          return wallCoverage(edge, wall) !== null;
        });
      });
    });
  }

  function createRoom(points, name, areaId, withWalls) {
    var room = new window.Room(points);
    room.setName(name || null);
    room.setAreaVisible(true);
    var floorColor = preferences.getNewRoomFloorColor();
    if (floorColor !== null && floorColor !== undefined) {
      room.setFloorColor(floorColor);
    }
    if (withWalls) {
      // Its walls run along its sides: it can be moved and resized with them
      room.setProperty(SIMPLE_PROPERTY, 'true');
    }
    if (areaId) {
      room.setProperty(AREA_PROPERTY, areaId);
    }
    var walls = withWalls ? missingWalls(points, selectedLevel(), null) : [];
    planController.addItems(walls.concat([room]));
    rememberRoomPoints(room);
    selectRoom(room);
    return room;
  }

  function linkRoom(room, area, name) {
    if (name) {
      room.setName(name);
    }
    if (area) {
      room.setProperty(AREA_PROPERTY, area.area_id);
    }
    markModified();
    selectRoom(room);
  }

  // Undoable change of a room's points
  function setRoomPoints(room, points) {
    var Base = window.javax.swing.undo.AbstractUndoableEdit;
    var oldPoints = room.getPoints();
    var edit = new Base();
    edit.undo = function () {
      Base.prototype.undo.call(this);
      room.setPoints(oldPoints);
      rememberRoomPoints(room);
    };
    edit.redo = function () {
      Base.prototype.redo.call(this);
      room.setPoints(points);
      rememberRoomPoints(room);
    };
    edit.getPresentationName = function () {
      return 'room size';
    };
    room.setPoints(points);
    rememberRoomPoints(room);
    undoSupport.postEdit(edit);
  }

  function resizeRoom(room, width, depth) {
    var b = roomBounds(room);
    var points = rectanglePoints(b.xMin, b.yMin, b.xMin + width, b.yMin + depth);
    var level = room.getLevel();
    undoSupport.beginUpdate();
    try {
      var walls = ownWalls(room);
      if (walls.length > 0) {
        planController.deleteItems(walls);
      }
      setRoomPoints(room, points);
      var added = missingWalls(points, level, null);
      if (added.length > 0) {
        planController.addItems(added);
      }
    } finally {
      undoSupport.endUpdate();
    }
    selectRoom(room);
  }

  function deleteRoom(room) {
    planController.deleteItems(ownWalls(room).concat([room]));
    delete state.roomPoints[room.getId()];
  }

  function rememberRoomPoints(room) {
    state.roomPoints[room.getId()] = JSON.stringify(room.getPoints());
  }

  // After a simple room was moved (it's dragged with its own walls, see
  // extendSelection), add the walls its new sides are missing.
  function repairMovedRooms() {
    home.getRooms().forEach(function (room) {
      if (room.getProperty(SIMPLE_PROPERTY) !== 'true') {
        return;
      }
      var id = room.getId();
      var points = JSON.stringify(room.getPoints());
      var previous = state.roomPoints[id];
      state.roomPoints[id] = points;
      if (previous === undefined || previous === points || !isSimple()) {
        return;
      }
      var walls = missingWalls(room.getPoints(), room.getLevel(), null);
      if (walls.length > 0) {
        var selection = home.getSelectedItems();
        planController.addItems(walls);
        home.setSelectedItems(selection);
      }
    });
  }

  function selectRoom(room) {
    if (room.getLevel() && room.getLevel() !== selectedLevel()) {
      home.setSelectedLevel(room.getLevel());
    }
    home.setSelectedItems([room]);
  }

  function selectedRoom() {
    var items = home.getSelectedItems();
    return items.length > 0 && items[0] instanceof window.Room ? items[0] : null;
  }

  function selectedPiece() {
    var items = home.getSelectedItems();
    return items.length === 1 && items[0] instanceof window.HomePieceOfFurniture ? items[0] : null;
  }

  // Selecting a simple room also selects its own walls and what stands in
  // it, so dragging it in the plan moves the whole room.
  function extendSelection() {
    if (!isSimple() || state.extendingSelection || state.tool) {
      return;
    }
    var items = home.getSelectedItems();
    if (items.length !== 1 || !(items[0] instanceof window.Room)
        || items[0].getProperty(SIMPLE_PROPERTY) !== 'true') {
      return;
    }
    var room = items[0];
    var level = room.getLevel();
    var margin = preferences.getNewWallThickness();
    var extended = [room].concat(ownWalls(room));
    allPieces().forEach(function (piece) {
      if (home.getFurniture().indexOf(piece) >= 0
          && piece.isAtLevel(level)
          && room.containsPoint(piece.getX(), piece.getY(), piece.isDoorOrWindow() ? margin : 0)) {
        extended.push(piece);
      }
    });
    if (extended.length > 1) {
      state.extendingSelection = true;
      try {
        home.setSelectedItems(extended);
      } finally {
        state.extendingSelection = false;
      }
    }
  }

  /* ------------------------------ placement ----------------------------- */

  function snapToWall(x, y) {
    var best = null;
    var maxDistance = 30 * plan.getPixelLength();
    levelWalls(selectedLevel()).forEach(function (wall) {
      if (wall.getArcExtent()) {
        return;
      }
      var hit = distanceToSegment(x, y, wall.getXStart(), wall.getYStart(), wall.getXEnd(), wall.getYEnd());
      if (hit.distance <= maxDistance + wall.getThickness() / 2
          && (best === null || hit.distance < best.distance)) {
        best = { wall: wall, x: hit.x, y: hit.y, distance: hit.distance };
      }
    });
    return best;
  }

  function newPiece(catalogId, x, y, options) {
    var catalog = catalogPiece(catalogId);
    if (!catalog) {
      toast('This item is missing from the furniture catalog.');
      return null;
    }
    options = options || {};
    var piece = furnitureController.createHomePieceOfFurniture(catalog);
    if (options.size) {
      piece.setWidth(options.size);
      piece.setDepth(options.size);
      piece.setHeight(options.size);
    }
    if (options.color !== undefined) {
      piece.setColor(options.color);
    }
    if (options.name) {
      piece.setName(options.name);
    }
    piece.setX(x);
    piece.setY(y);
    if (piece.isDoorOrWindow() || preferences.isMagnetismEnabled()) {
      planController.adjustMagnetizedPieceOfFurniture(piece, x, y);
    }
    if (options.mount === 'ceiling') {
      piece.setElevation(Math.max(0, wallHeight() - piece.getHeight()));
    } else if (options.elevation !== undefined) {
      piece.setElevation(options.elevation);
    }
    planController.addItems([piece]);
    return piece;
  }

  function placeOpening(catalogId, x, y) {
    var hit = snapToWall(x, y);
    if (!hit) {
      toast('Click on a wall to put it there.');
      return;
    }
    // Stay inside the wall but on the clicked side of its middle: doors
    // open towards that side (click inside a room to open into it).
    var offset = Math.min(hit.distance, hit.wall.getThickness() / 2 - 0.5);
    var ratio = hit.distance > 0.01 ? Math.max(0, offset) / hit.distance : 0;
    newPiece(catalogId, hit.x + (x - hit.x) * ratio, hit.y + (y - hit.y) * ratio);
  }

  function placeFurniture(catalogId, x, y) {
    newPiece(catalogId, x, y);
  }

  // Whether an existing piece can stand for the entity (a lamp for a light,
  // a window or blind for a cover...). Other pieces are only bound by hand.
  function fitsEntity(piece, entity) {
    var name = (piece.getName() || '') + ' ' + (piece.getCatalogId() || '');
    switch (domainOf(entity.entity_id)) {
      case 'light':
        return piece instanceof window.HomeLight;
      case 'cover':
        return piece.isDoorOrWindow() || /blind|curtain|shutter|awning|garage/i.test(name);
      case 'media_player':
        return /\btv\b|television|screen|speaker|radio|hi-?fi|sound/i.test(name);
      case 'climate':
        return /radiator|heater|air ?condition|\bac\b|thermostat|stove|fireplace/i.test(name);
      case 'fan':
        return /\bfan\b/i.test(name);
      default:
        return false;
    }
  }

  function itemForBinding(x, y, entity) {
    var items = planController.getSelectableItemsAt(x, y);
    var temperature = isTemperatureSensor(entity);
    var pieces = items.filter(function (item) {
      return item instanceof window.HomePieceOfFurniture && fitsEntity(item, entity);
    });
    if (pieces.length > 0 && !temperature) {
      return pieces[0];
    }
    if (temperature) {
      var rooms = levelRooms(selectedLevel()).filter(function (room) {
        return room.containsPoint(x, y, 0);
      });
      if (rooms.length > 0) {
        return rooms[0];
      }
    }
    return null;
  }

  function itemLabel(item) {
    return (item.getName && item.getName()) || (item instanceof window.Room ? 'room' : 'item');
  }

  function placeDevice(entity, x, y) {
    if (!bridge.isReady()) {
      toast('Home Assistant devices are only available inside the 3D Dashboard panel.');
      return;
    }
    var mappings = bridge.getMappings();
    var target = itemForBinding(x, y, entity);
    if (target && mappings[target.getId()] && mappings[target.getId()] !== entity.entity_id) {
      target = null; // already bound to something else: add a new piece instead
    }
    var style = DOMAIN_STYLES[domainOf(entity.entity_id)] || {};
    if (target) {
      bridge.setMapping(target.getId(), entity.entity_id);
      toast(target instanceof window.Room
        ? '"' + itemLabel(target) + '" now shows ' + entity.name + ' (floor heatmap in View).'
        : '"' + itemLabel(target) + '" is now bound to ' + entity.name + '.');
    } else {
      var piece = style.catalogId
        ? newPiece(style.catalogId, x, y, { name: entity.name, mount: style.mount, elevation: style.elevation })
        : newPiece(MARKER.catalogId, x, y, {
          name: entity.name, size: MARKER.size, elevation: MARKER.elevation,
          color: style.color !== undefined ? style.color : 0x78909c
        });
      if (!piece) {
        return;
      }
      bridge.setMapping(piece.getId(), entity.entity_id);
      toast('Added "' + entity.name + '". It\'s bound already: switch to View to use it.');
    }
    refresh(true);
  }

  // Room for an area: binds the area's temperature sensor as a heatmap when
  // there's exactly one.
  function bindAreaTemperature(room, area) {
    if (!area || !bridge.isReady() || bridge.getMappings()[room.getId()]) {
      return;
    }
    var sensors = bridge.getEntities().filter(function (entity) {
      return entity.area_id === area.area_id && isTemperatureSensor(entity);
    });
    if (sensors.length === 1) {
      bridge.setMapping(room.getId(), sensors[0].entity_id);
      toast('Added "' + room.getName() + '" and bound it to ' + sensors[0].name
        + ' (floor heatmap in View).');
    }
  }

  /* ------------------------------- levels ------------------------------- */

  // A home without levels gets one level per HA floor (in HA's order)
  function createLevelsFromFloors() {
    var floors = bridge.getFloors();
    if (floors.length < 2 || home.getLevels().length > 0) {
      return;
    }
    undoSupport.beginUpdate();
    try {
      var guard = 0;
      while (home.getLevels().length < floors.length && guard++ < 50) {
        planController.addLevel();
      }
    } finally {
      undoSupport.endUpdate();
    }
    var levels = sortedLevels();
    floors.forEach(function (floor, index) {
      if (levels[index]) {
        levels[index].setName(floor.name);
        levels[index].setProperty(FLOOR_PROPERTY, floor.floor_id);
      }
    });
    home.setSelectedLevel(levels[0]);
    markModified();
    refresh(true);
  }

  // Adds a level on top of the others for an HA floor the home lacks
  function addLevelForFloor(floor) {
    planController.addLevel();
    var level = selectedLevel();
    level.setName(floor.name);
    level.setProperty(FLOOR_PROPERTY, floor.floor_id);
    markModified();
    refresh(true);
  }

  function linkLevel(level, floorId) {
    // A floor is linked to one level at most
    home.getLevels().forEach(function (other) {
      if (other !== level && floorId && other.getProperty(FLOOR_PROPERTY) === floorId) {
        other.setProperty(FLOOR_PROPERTY, null);
      }
    });
    level.setProperty(FLOOR_PROPERTY, floorId || null);
    markModified();
    refresh(true);
  }

  function unlinkedFloors() {
    var levels = home.getLevels();
    return bridge.getFloors().filter(function (floor) {
      return !levels.some(function (level) {
        return floorOfLevel(level) === floor;
      });
    });
  }

  function markModified() {
    home.setModified(true);
  }

  /* --------------------------------- tools ------------------------------ */

  var overlay = null;
  var overlayLayer = null;

  function planRect() {
    return plan.canvas.getBoundingClientRect();
  }

  function toModel(clientX, clientY) {
    var rect = planRect();
    return [plan.convertXPixelToModel(clientX - rect.left), plan.convertYPixelToModel(clientY - rect.top)];
  }

  function toOverlay(x, y) {
    return [plan.convertXModelToPixel(x), plan.convertYModelToPixel(y)];
  }

  function snapCoordinate(value, candidates, tolerance) {
    var best = null;
    candidates.forEach(function (candidate) {
      var distance = Math.abs(candidate - value);
      if (distance <= tolerance && (best === null || distance < Math.abs(best - value))) {
        best = candidate;
      }
    });
    return best !== null ? best : Math.round(value / GRID) * GRID;
  }

  // Snaps to the corners of existing walls and rooms, else to a 5 cm grid
  function snapPoint(x, y) {
    var xs = [];
    var ys = [];
    levelWalls(selectedLevel()).forEach(function (wall) {
      xs.push(wall.getXStart(), wall.getXEnd());
      ys.push(wall.getYStart(), wall.getYEnd());
    });
    levelRooms(selectedLevel()).forEach(function (room) {
      room.getPoints().forEach(function (p) {
        xs.push(p[0]);
        ys.push(p[1]);
      });
    });
    var tolerance = 12 * plan.getPixelLength();
    return [snapCoordinate(x, xs, tolerance), snapCoordinate(y, ys, tolerance)];
  }

  function showOverlay() {
    if (!overlay) {
      overlay = el('div', { id: 'h3d-overlay' });
      overlay.addEventListener('pointerdown', onPointerDown);
      overlay.addEventListener('pointermove', onPointerMove);
      overlay.addEventListener('pointerup', onPointerUp);
      overlay.addEventListener('pointercancel', function () {
        state.dragStart = null;
        drawPreview();
      });
      overlay.addEventListener('wheel', onWheel, { passive: false });
      overlay.addEventListener('dragover', onDragOver);
      overlay.addEventListener('dragleave', function () {
        state.pointer = null;
        drawPreview();
      });
      overlay.addEventListener('drop', onDrop);
      overlay.addEventListener('contextmenu', function (ev) {
        ev.preventDefault();
        cancelTool();
      });
      overlayLayer = el('div');
      overlay.appendChild(overlayLayer);
      document.body.appendChild(overlay);
    }
    var rect = planRect();
    overlay.style.left = rect.left + 'px';
    overlay.style.top = rect.top + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    overlay.style.display = 'block';
  }

  function hideOverlay() {
    if (overlay) {
      overlay.style.display = 'none';
      overlayLayer.innerHTML = '';
    }
  }

  function setTool(tool) {
    state.tool = tool;
    state.dragStart = null;
    state.pointer = null;
    if (tool) {
      showOverlay();
      drawPreview();
    } else if (!state.dragPayload) {
      hideOverlay();
    }
    renderTool();
    refresh(true);
  }

  function cancelTool() {
    setTool(null);
  }

  function toolHint() {
    var tool = state.tool;
    if (!tool) {
      return '';
    }
    if (tool.kind === 'room') {
      return 'Drag a rectangle on the plan for "' + tool.name + '". '
        + 'Or click inside walls or a room that already exists.';
    }
    if (tool.kind === 'opening') {
      return 'Click on a wall to add a ' + tool.label.toLowerCase() + '.';
    }
    if (tool.entity) {
      return 'Click where "' + tool.entity.name + '" is. '
        + (domainOf(tool.entity.entity_id) === 'light' ? 'Click an existing lamp to bind it instead.'
          : isTemperatureSensor(tool.entity) ? 'Click inside a room for a floor heatmap.' : '');
    }
    return 'Click where the ' + tool.label.toLowerCase() + ' goes.';
  }

  function onWheel(ev) {
    ev.preventDefault();
    if (ev.ctrlKey || ev.metaKey) {
      planController.zoom(ev.deltaY < 0 ? 1.1 : 1 / 1.1);
    } else {
      var factor = ev.deltaMode === 1 ? 16 : 1;
      plan.moveView(plan.convertPixelToLength(ev.deltaX * factor),
        plan.convertPixelToLength(ev.deltaY * factor));
    }
    drawPreview();
  }

  function onPointerDown(ev) {
    if (ev.button !== 0) {
      return;
    }
    var point = toModel(ev.clientX, ev.clientY);
    state.pointer = point;
    if (state.tool && state.tool.kind === 'room') {
      state.dragStart = snapPoint(point[0], point[1]);
      overlay.setPointerCapture(ev.pointerId);
    }
    drawPreview();
  }

  function onPointerMove(ev) {
    state.pointer = toModel(ev.clientX, ev.clientY);
    drawPreview();
  }

  function onPointerUp(ev) {
    if (ev.button !== 0 || !state.tool) {
      return;
    }
    var point = toModel(ev.clientX, ev.clientY);
    var tool = state.tool;
    if (tool.kind === 'room') {
      var start = state.dragStart;
      state.dragStart = null;
      if (!start) {
        return;
      }
      var end = snapPoint(point[0], point[1]);
      if (Math.abs(end[0] - start[0]) >= MIN_ROOM_SIZE && Math.abs(end[1] - start[1]) >= MIN_ROOM_SIZE) {
        finishRoom(tool, rectanglePoints(start[0], start[1], end[0], end[1]), true);
      } else if (Math.hypot(end[0] - start[0], end[1] - start[1]) < 20 * plan.getPixelLength()) {
        clickRoom(tool, point[0], point[1]);
      } else {
        toast('Too small: drag a rectangle at least 0.5 m on each side.');
        drawPreview();
      }
    } else if (tool.kind === 'opening') {
      placeOpening(tool.catalogId, point[0], point[1]);
      drawPreview();
    } else if (tool.kind === 'place') {
      setTool(null);
      if (tool.entity) {
        placeDevice(tool.entity, point[0], point[1]);
      } else {
        placeFurniture(tool.catalogId, point[0], point[1]);
      }
    }
  }

  // A click (no drag) with the room tool: link the room under the pointer,
  // or create one from the walls enclosing that point.
  function clickRoom(tool, x, y) {
    var existing = levelRooms(selectedLevel()).filter(function (room) {
      return room.containsPoint(x, y, 0);
    });
    if (existing.length > 0) {
      var area = tool.areaId ? areaById(tool.areaId) : null;
      setTool(null);
      linkRoom(existing[0], area, tool.name);
      if (area) {
        bindAreaTemperature(existing[0], area);
      }
      toast('Linked this room to "' + tool.name + '".');
      return;
    }
    var points = planController.computeRoomPointsAt(x, y);
    if (points && points.length >= 3) {
      finishRoom(tool, points, false);
    } else {
      toast('Drag to draw the room. Clicking only works inside walls that enclose a space.');
    }
  }

  function finishRoom(tool, points, withWalls) {
    setTool(null);
    var room = createRoom(points, tool.name, tool.areaId, withWalls);
    bindAreaTemperature(room, tool.areaId ? areaById(tool.areaId) : null);
  }

  function onDragOver(ev) {
    if (!state.dragPayload) {
      return;
    }
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'copy';
    state.pointer = toModel(ev.clientX, ev.clientY);
    drawPreview();
  }

  function onDrop(ev) {
    var payload = state.dragPayload;
    if (!payload) {
      return;
    }
    ev.preventDefault();
    state.dragPayload = null;
    var point = toModel(ev.clientX, ev.clientY);
    if (!state.tool) {
      hideOverlay();
    }
    if (payload.entity) {
      placeDevice(payload.entity, point[0], point[1]);
    } else if (payload.opening) {
      placeOpening(payload.catalogId, point[0], point[1]);
    } else {
      placeFurniture(payload.catalogId, point[0], point[1]);
    }
  }

  function startDrag(ev, payload) {
    state.dragPayload = payload;
    ev.dataTransfer.effectAllowed = 'copy';
    ev.dataTransfer.setData('text/plain', payload.entity ? payload.entity.entity_id : payload.catalogId);
    showOverlay();
  }

  function endDrag() {
    state.dragPayload = null;
    state.pointer = null;
    if (!state.tool) {
      hideOverlay();
    } else {
      drawPreview();
    }
  }

  function drawPreview() {
    if (!overlayLayer) {
      return;
    }
    overlayLayer.innerHTML = '';
    var tool = state.tool || (state.dragPayload ? { kind: 'drop', payload: state.dragPayload } : null);
    var pointer = state.pointer;
    if (!tool || !pointer) {
      return;
    }
    if (tool.kind === 'room') {
      if (state.dragStart) {
        var end = snapPoint(pointer[0], pointer[1]);
        var a = toOverlay(state.dragStart[0], state.dragStart[1]);
        var b = toOverlay(end[0], end[1]);
        var rect = el('div', { className: 'h3d-rect' }, [
          el('span', { text: metres(Math.abs(end[0] - state.dragStart[0])) + ' × '
            + metres(Math.abs(end[1] - state.dragStart[1])) + ' m' })
        ]);
        rect.style.left = Math.min(a[0], b[0]) + 'px';
        rect.style.top = Math.min(a[1], b[1]) + 'px';
        rect.style.width = Math.abs(b[0] - a[0]) + 'px';
        rect.style.height = Math.abs(b[1] - a[1]) + 'px';
        overlayLayer.appendChild(rect);
      } else {
        var snapped = snapPoint(pointer[0], pointer[1]);
        dot(toOverlay(snapped[0], snapped[1]), tool.name);
      }
      return;
    }
    var opening = tool.kind === 'opening' || (tool.payload && tool.payload.opening);
    if (opening) {
      var hit = snapToWall(pointer[0], pointer[1]);
      if (hit) {
        var start = toOverlay(hit.wall.getXStart(), hit.wall.getYStart());
        var stop = toOverlay(hit.wall.getXEnd(), hit.wall.getYEnd());
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', start[0]);
        line.setAttribute('y1', start[1]);
        line.setAttribute('x2', stop[0]);
        line.setAttribute('y2', stop[1]);
        line.style.stroke = 'var(--h3d-primary)';
        line.setAttribute('stroke-width', '6');
        line.setAttribute('stroke-opacity', '.6');
        line.setAttribute('stroke-linecap', 'round');
        svg.appendChild(line);
        overlayLayer.appendChild(svg);
        dot(toOverlay(hit.x, hit.y));
      } else {
        dot(toOverlay(pointer[0], pointer[1]), 'Move over a wall');
      }
      return;
    }
    var entity = tool.entity || (tool.payload && tool.payload.entity);
    var label = null;
    if (entity) {
      var target = itemForBinding(pointer[0], pointer[1], entity);
      label = target ? 'Bind to "' + itemLabel(target) + '"' : 'Add ' + entity.name;
    }
    dot(toOverlay(pointer[0], pointer[1]), label);
  }

  function dot(position, label) {
    var marker = el('div', { className: 'h3d-dot' });
    marker.style.left = position[0] + 'px';
    marker.style.top = position[1] + 'px';
    overlayLayer.appendChild(marker);
    if (label) {
      var tip = el('div', { className: 'h3d-tip', text: label });
      tip.style.left = (position[0] + 14) + 'px';
      tip.style.top = (position[1] + 10) + 'px';
      overlayLayer.appendChild(tip);
    }
  }

  /* ------------------------------ the panel ----------------------------- */

  var panel = el('div', { id: 'h3d-simple' });
  var statusLabel = el('span', { className: 'h3d-status' });
  var homeLabel = el('span', { className: 'h3d-home-name' });
  var head = el('div', { className: 'h3d-head' }, [
    el('div', { className: 'h3d-title' }, [
      el('b', { text: 'Edit your home' }),
      el('button', { className: 'link', text: 'Advanced editor', title: 'Switch to the full Sweet Home 3D editor', onclick: function () { setSimple(false); } })
    ]),
    // Which home this is; the dashboard shows the one open here
    el('div', { className: 'h3d-row h3d-home-row' }, [
      homeLabel,
      el('button', { className: 'link', text: 'Switch…', title: 'Open another of your homes (you can delete homes there too)', onclick: function () { cancelTool(); controller.open(); } }),
      el('button', { className: 'link', text: 'New…', title: 'Start a new home with its own name; this one stays in the list', onclick: function () { cancelTool(); controller.newHome(); } })
    ]),
    el('div', { className: 'h3d-row' }, [
      el('button', { text: '↶ Undo', title: 'Undo (Ctrl+Z)', onclick: function () { undoRedo('undo'); } }),
      el('button', { text: '↷ Redo', title: 'Redo (Ctrl+Y)', onclick: function () { undoRedo('redo'); } }),
      el('button', { className: 'primary', text: 'Save', onclick: function () { save(); } }),
      statusLabel
    ])
  ]);
  var toolBar = el('div', { className: 'h3d-tool' });
  var body = el('div', { className: 'h3d-body' });
  panel.appendChild(head);
  panel.appendChild(toolBar);
  panel.appendChild(body);
  document.body.appendChild(panel);
  // The way back from the Advanced editor is the toolbar's "Simple editor"
  // button (src/advancedUi.js), which calls the setSimple returned below.

  function undoRedo(action) {
    cancelTool();
    try {
      controller[action]();
    } catch (e) {
      // nothing to undo / redo
    }
    home.getRooms().forEach(rememberRoomPoints);
    refresh(true);
  }

  function renderTool() {
    toolBar.innerHTML = '';
    if (!state.tool) {
      toolBar.classList.remove('on');
      return;
    }
    toolBar.classList.add('on');
    toolBar.appendChild(el('span', { text: toolHint() }));
    toolBar.appendChild(el('button', {
      text: state.tool.kind === 'opening' ? 'Done' : 'Cancel',
      onclick: cancelTool
    }));
  }

  function section(title, count, children) {
    return el('section', null, [
      el('h3', null, [title, count !== undefined && count !== null ? el('span', { className: 'h3d-count', text: count }) : null])
    ].concat(children));
  }

  function renderSelection() {
    var room = selectedRoom();
    var piece = room ? null : selectedPiece();
    if (!room && !piece) {
      return null;
    }
    var mappings = bridge.getMappings();
    var card = el('div', { className: 'h3d-card' });
    if (room) {
      var nameInput = el('input', { type: 'text', value: room.getName() || '', placeholder: 'Room name' });
      nameInput.addEventListener('change', function () {
        room.setName(nameInput.value.trim() || null);
        markModified();
        refresh(true);
      });
      card.appendChild(el('label', { text: 'Room name' }));
      card.appendChild(nameInput);
      var areas = bridge.getAreas();
      if (areas.length > 0) {
        var current = areaOfRoom(room);
        var select = el('select', null, [el('option', { value: '', text: '— not linked —' })]
          .concat(areas.map(function (area) {
            return el('option', { value: area.area_id, text: area.name, selected: current === area });
          })));
        select.addEventListener('change', function () {
          if (select.value) {
            room.setProperty(AREA_PROPERTY, select.value);
          } else {
            room.setProperty(AREA_PROPERTY, null);
          }
          markModified();
          refresh(true);
        });
        card.appendChild(el('label', { text: 'Home Assistant area' }));
        card.appendChild(select);
      }
      var simpleRoom = room.getProperty(SIMPLE_PROPERTY) === 'true';
      if (simpleRoom && isRectangle(room)) {
        var b = roomBounds(room);
        var width = el('input', { type: 'number', min: '0.5', step: '0.05', value: metres(b.xMax - b.xMin) });
        var depth = el('input', { type: 'number', min: '0.5', step: '0.05', value: metres(b.yMax - b.yMin) });
        var apply = function () {
          var w = Math.round(parseFloat(width.value) * 100);
          var d = Math.round(parseFloat(depth.value) * 100);
          if (!(w >= MIN_ROOM_SIZE && d >= MIN_ROOM_SIZE)) {
            toast('Rooms must be at least 0.5 m on each side.');
            return;
          }
          if (Math.abs(w - (b.xMax - b.xMin)) >= 1 || Math.abs(d - (b.yMax - b.yMin)) >= 1) {
            resizeRoom(room, w, d);
          }
        };
        width.addEventListener('change', apply);
        depth.addEventListener('change', apply);
        card.appendChild(el('label', { text: 'Size (width × depth, metres)' }));
        card.appendChild(el('div', { className: 'h3d-size' }, [width, '×', depth, 'm']));
      }
      if (bridge.isReady()) {
        var roomEntity = mappings[room.getId()] ? entityById(mappings[room.getId()]) : null;
        card.appendChild(el('label', { text: 'Floor heatmap' }));
        card.appendChild(el('div', { className: 'h3d-row' }, [
          el('span', { className: 'h3d-name', text: roomEntity ? roomEntity.name : (mappings[room.getId()] || 'None: drop a temperature sensor on the room') }),
          el('button', { className: 'link', text: 'Change…', onclick: function () { bridge.showPicker(room); } })
        ]));
      }
      card.appendChild(el('div', { className: 'h3d-row', style: 'margin-top:10px' }, [
        el('span', { className: 'h3d-hint', style: 'flex:1;margin:0', text: simpleRoom ? 'Drag the room in the plan to move it.' : '' }),
        el('button', { className: 'danger', text: 'Delete room', onclick: function () { deleteRoom(room); refresh(true); } })
      ]));
    } else {
      var entityId = mappings[piece.getId()];
      var entity = entityId ? entityById(entityId) : null;
      card.appendChild(el('div', { className: 'h3d-name', style: 'font-weight:600', text: piece.getName() || 'Item' }));
      if (bridge.isReady() && !piece.isDoorOrWindow()) {
        card.appendChild(el('label', { text: 'Home Assistant entity' }));
        card.appendChild(el('div', { className: 'h3d-row' }, [
          el('span', { className: 'h3d-name', text: entity ? entity.name + ' (' + entityId + ')' : (entityId || 'Not bound') }),
          el('button', { className: 'link', text: entityId ? 'Change…' : 'Bind…', onclick: function () { bridge.showPicker(piece); } })
        ]));
      }
      card.appendChild(el('div', { className: 'h3d-row', style: 'margin-top:10px' }, [
        el('span', { className: 'h3d-hint', style: 'flex:1;margin:0', text: 'Drag it in the plan to move it; use its corner handle to turn it.' }),
        el('button', { className: 'danger', text: 'Delete', onclick: function () { planController.deleteItems([piece]); refresh(true); } })
      ]));
    }
    return el('section', null, [card]);
  }

  function renderFloors() {
    var levels = sortedLevels();
    var floors = bridge.getFloors();
    if (levels.length === 0 && floors.length < 2) {
      return null;
    }
    var children = [];
    if (levels.length === 0) {
      children.push(el('div', { className: 'h3d-hint',
        text: 'Home Assistant has ' + floors.length + ' floors: '
          + floors.map(function (f) { return f.name; }).join(', ') + '.' }));
      children.push(el('button', { text: 'Create these floors', onclick: createLevelsFromFloors }));
      return section('Floors', null, children);
    }
    children.push(el('div', { className: 'h3d-chips' }, levels.map(function (level) {
      return el('button', {
        className: 'h3d-chip' + (level === selectedLevel() ? ' active' : ''),
        text: level.getName() || 'Level',
        onclick: function () { home.setSelectedLevel(level); refresh(true); }
      });
    })));
    var missing = unlinkedFloors();
    if (floors.length > 0) {
      var details = el('details', { open: missing.length > 0 && state.floorsOpen !== false });
      details.addEventListener('toggle', function () { state.floorsOpen = details.open; });
      details.appendChild(el('summary', { text: missing.length
        ? 'Match levels to Home Assistant floors (' + missing.length + ' unmatched)'
        : 'Home Assistant floors' }));
      details.appendChild(el('div', { className: 'h3d-hint',
        text: 'Each level lists the rooms of its Home Assistant floor.' }));
      var list = el('div', { className: 'h3d-list' });
      levels.forEach(function (level) {
        var current = floorOfLevel(level);
        var select = el('select', null, [el('option', { value: '', text: '— none —' })]
          .concat(floors.map(function (floor) {
            return el('option', { value: floor.floor_id, text: floor.name, selected: current === floor });
          })));
        select.addEventListener('change', function () { linkLevel(level, select.value); });
        list.appendChild(el('div', { className: 'h3d-item' }, [
          el('span', { className: 'h3d-name', text: level.getName() || 'Level' }),
          el('span', { style: 'width:130px' }, [select])
        ]));
      });
      details.appendChild(list);
      missing.forEach(function (floor) {
        details.appendChild(el('button', {
          className: 'link', style: 'display:block;margin-top:4px',
          text: '+ Add a level for ' + floor.name,
          onclick: function () { addLevelForFloor(floor); }
        }));
      });
      children.push(details);
    }
    return section('Floors', null, children);
  }

  function renderRooms() {
    var areas = areasForLevel();
    var children = [];
    var level = selectedLevel();
    var empty = levelWalls(level).length === 0 && levelRooms(level).length === 0;
    if (empty) {
      children.push(el('div', { className: 'h3d-hint',
        text: 'Pick a room, then drag a rectangle on the plan. Walls are added for you, '
          + 'and rooms that touch share one wall.' }));
    } else {
      children.push(el('div', { className: 'h3d-hint',
        text: 'Pick a room and drag on the plan, or click inside existing walls or a room to use them.' }));
    }
    var done = 0;
    var list = el('div', { className: 'h3d-list' });
    var current = selectedRoom();
    areas.forEach(function (area) {
      var room = roomOfArea(area);
      if (room) {
        done++;
      }
      var drawing = state.tool && state.tool.kind === 'room' && state.tool.areaId === area.area_id;
      list.appendChild(el('div', {
        className: 'h3d-item' + (room ? ' done' : '') + (room && room === current ? ' current' : '')
      }, [
        el('span', { className: 'h3d-check', text: room ? '✓' : '○' }),
        el('span', { className: 'h3d-name', text: area.name }),
        room
          ? el('button', { className: 'link', text: 'Show', onclick: function () { selectRoom(room); refresh(true); } })
          : el('button', {
            className: drawing ? 'active' : '',
            text: 'Draw',
            onclick: function () {
              setTool(drawing ? null : { kind: 'room', name: area.name, areaId: area.area_id });
            }
          })
      ]));
    });
    if (areas.length === 0) {
      list.appendChild(el('div', { className: 'h3d-hint',
        text: bridge.isReady()
          ? 'No Home Assistant areas yet (Settings → Areas). You can still add rooms by name.'
          : 'Add rooms by name below.' }));
    }
    children.push(list);
    var other = el('input', { type: 'text', placeholder: 'Other room, e.g. Hallway' });
    var startOther = function () {
      var name = other.value.trim();
      if (!name) {
        other.focus();
        return;
      }
      setTool({ kind: 'room', name: name, areaId: null });
    };
    other.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        startOther();
      }
    });
    children.push(el('div', { className: 'h3d-row', style: 'margin-top:8px;flex-wrap:nowrap' }, [
      other,
      el('button', { text: 'Draw', onclick: startOther })
    ]));
    children.push(el('div', { className: 'h3d-row', style: 'margin-top:8px' }, [
      el('button', {
        className: 'link',
        text: home.getBackgroundImage() ? 'Change the floor plan image…' : 'Trace over a floor plan image…',
        title: 'Show a picture of your floor plan under the plan, at the right scale',
        onclick: function () {
          if (home.getBackgroundImage()) {
            controller.modifyBackgroundImage();
          } else {
            controller.importBackgroundImage();
          }
        }
      }),
      empty ? null : el('button', { className: 'link', style: 'margin-left:auto;color:var(--h3d-error)', text: 'Clear plan…', onclick: confirmClear })
    ]));
    return section('Rooms', areas.length ? done + ' of ' + areas.length + ' drawn' : null, children);
  }

  function renderOpenings() {
    var grid = el('div', { className: 'h3d-grid' }, OPENINGS.map(function (opening) {
      var active = state.tool && state.tool.kind === 'opening' && state.tool.catalogId === opening.id;
      var url = iconURL(opening.id);
      return el('button', {
        className: 'h3d-tile' + (active ? ' active' : ''),
        draggable: 'true',
        title: 'Click, then click on a wall (or drag it onto a wall)',
        onclick: function () {
          setTool(active ? null : { kind: 'opening', catalogId: opening.id, label: opening.label });
        },
        ondragstart: function (ev) { startDrag(ev, { catalogId: opening.id, opening: true }); },
        ondragend: endDrag
      }, [url ? el('img', { src: url, alt: '' }) : null, opening.label]);
    }));
    return section('Doors & windows', null, [grid]);
  }

  function deviceRow(entity, current) {
    var domain = domainOf(entity.entity_id);
    var style = DOMAIN_STYLES[domain] || {};
    var items = boundItems(entity.entity_id);
    var area = entity.area_id ? areaById(entity.area_id) : null;
    var placing = state.tool && state.tool.kind === 'place' && state.tool.entity === entity;
    return el('div', {
      className: 'h3d-item' + (items.length ? ' done' : ''),
      draggable: 'true',
      title: 'Drag onto the plan (or click Place)',
      ondragstart: function (ev) { startDrag(ev, { entity: entity }); },
      ondragend: endDrag
    }, [
      el('span', { text: style.icon || '•' }),
      el('span', { className: 'h3d-name' }, [
        entity.name,
        el('span', { className: 'h3d-sub', text: entity.entity_id + (area && !current ? ' · ' + area.name : '') })
      ]),
      items.length
        ? el('button', { className: 'link', text: '✓ Show', onclick: function () {
          var item = items[0];
          if (item.getLevel && item.getLevel() && item.getLevel() !== selectedLevel()) {
            home.setSelectedLevel(item.getLevel());
          }
          home.setSelectedItems([item]);
          refresh(true);
        } })
        : el('button', {
          className: placing ? 'active' : '',
          text: 'Place',
          onclick: function () {
            setTool(placing ? null : { kind: 'place', entity: entity, label: entity.name });
          }
        })
    ]);
  }

  function renderDevices() {
    if (!bridge.isReady()) {
      return section('Devices', null, [el('div', { className: 'h3d-hint',
        text: 'Open the editor from the 3D Dashboard panel to place your Home Assistant devices.' })]);
    }
    var entities = bridge.getEntities();
    var children = [];
    var room = selectedRoom();
    var area = room ? areaOfRoom(room) : null;
    if (area) {
      var inRoom = entities.filter(function (entity) { return entity.area_id === area.area_id; });
      children.push(el('div', { className: 'h3d-hint',
        text: inRoom.length
          ? 'In ' + area.name + ': drag a device onto the plan where it is. It\'s bound as you place it.'
          : 'Home Assistant has no devices in ' + area.name + '.' }));
      var list = el('div', { className: 'h3d-list' });
      inRoom.forEach(function (entity) { list.appendChild(deviceRow(entity, true)); });
      children.push(list);
    } else {
      children.push(el('div', { className: 'h3d-hint',
        text: room
          ? 'Link this room to a Home Assistant area to list its devices here.'
          : 'Select a room to see its devices, or search all of them below. Drop a device on an '
            + 'existing lamp to bind it, or on a room (temperature sensors) for a heatmap.' }));
    }
    var details = el('details', { open: state.showAllDevices || !area });
    details.addEventListener('toggle', function () { state.showAllDevices = details.open; });
    var search = el('input', { type: 'search', placeholder: 'Search ' + entities.length + ' devices…', value: state.deviceFilter });
    var results = el('div', { className: 'h3d-list', style: 'margin-top:6px' });
    var fill = function () {
      results.innerHTML = '';
      var terms = normalize(search.value).split(/\s+/).filter(Boolean);
      var matches = entities.filter(function (entity) {
        var haystack = normalize(entity.name + ' ' + entity.entity_id);
        return terms.every(function (term) { return haystack.indexOf(term) >= 0; });
      });
      matches.slice(0, 60).forEach(function (entity) { results.appendChild(deviceRow(entity, false)); });
      if (matches.length > 60) {
        results.appendChild(el('div', { className: 'h3d-hint', text: (matches.length - 60) + ' more: refine the search.' }));
      } else if (matches.length === 0) {
        results.appendChild(el('div', { className: 'h3d-hint', text: 'No matching devices.' }));
      }
    };
    search.addEventListener('input', function () {
      state.deviceFilter = search.value;
      fill();
    });
    fill();
    details.appendChild(el('summary', { text: area ? 'All devices' : 'Search devices' }));
    details.appendChild(search);
    details.appendChild(results);
    children.push(details);
    var placed = entities.filter(function (entity) { return boundItems(entity.entity_id).length > 0; }).length;
    return section('Devices', placed + ' placed', children);
  }

  function renderFurniture() {
    var grid = el('div', { className: 'h3d-grid' }, FURNITURE.map(function (item) {
      var active = state.tool && state.tool.kind === 'place' && state.tool.catalogId === item.id;
      var url = iconURL(item.id);
      return el('button', {
        className: 'h3d-tile' + (active ? ' active' : ''),
        draggable: 'true',
        title: 'Click, then click on the plan (or drag it there)',
        onclick: function () {
          setTool(active ? null : { kind: 'place', catalogId: item.id, label: item.label });
        },
        ondragstart: function (ev) { startDrag(ev, { catalogId: item.id }); },
        ondragend: endDrag
      }, [url ? el('img', { src: url, alt: '' }) : null, item.label]);
    }));
    return section('Furniture', 'optional', [
      grid,
      el('button', { className: 'link', style: 'margin-top:6px', text: 'More in the full catalog (Advanced editor) →', onclick: function () { setSimple(false); } })
    ]);
  }

  function render() {
    var scroll = body.scrollTop;
    var focused = document.activeElement;
    var keepFocus = focused && body.contains(focused) && focused.tagName === 'INPUT'
      && focused.placeholder ? focused.placeholder : null;
    body.innerHTML = '';
    [renderSelection(), renderFloors(), renderRooms(), renderOpenings(), renderDevices(), renderFurniture()]
      .forEach(function (node) {
        if (node) {
          body.appendChild(node);
        }
      });
    body.scrollTop = scroll;
    if (keepFocus !== null) {
      var again = body.querySelector('input[placeholder="' + keepFocus.replace(/"/g, '\\"') + '"]');
      if (again) {
        again.focus();
        if (again.type !== 'number') {
          again.setSelectionRange(again.value.length, again.value.length);
        }
      }
    }
  }

  // Re-renders the panel when anything it shows changed (also catches undo,
  // redo and edits made with the plan's own tools).
  function signature() {
    var selection = home.getSelectedItems().map(function (item) {
      return item.getId ? item.getId() : '';
    }).join(',');
    var rooms = home.getRooms().map(function (room) {
      return room.getId() + ':' + room.getName() + ':' + room.getProperty(AREA_PROPERTY)
        + ':' + (room.getLevel() ? room.getLevel().getId() : '') + ':' + JSON.stringify(room.getPoints());
    }).join('|');
    var levels = home.getLevels().map(function (level) {
      return level.getId() + ':' + level.getName();
    }).join('|');
    return [selection, rooms, levels, home.getWalls().length, home.getFurniture().length,
      selectedLevel() ? selectedLevel().getId() : '', JSON.stringify(bridge.getMappings()),
      bridge.isReady(), !!home.getBackgroundImage(), state.tool ? state.tool.kind + state.tool.label : ''].join('#');
  }

  function refresh(force) {
    if (!isSimple()) {
      return;
    }
    var current = signature();
    if (force || current !== state.lastSignature) {
      state.lastSignature = current;
      render();
    }
  }

  function updateStatus() {
    var modified = home.isModified();
    statusLabel.textContent = modified ? '● Unsaved changes' : 'Saved';
    statusLabel.classList.toggle('dirty', modified);
    var name = home.getName() || 'Untitled';
    if (homeLabel.textContent !== '🏠 ' + name) {
      homeLabel.textContent = '🏠 ' + name;
      homeLabel.title = 'Home: ' + name;
    }
  }

  /* ------------------------- saving and leaving ------------------------- */

  function save(then) {
    controller.save(function () {
      updateStatus();
      if (then) {
        then();
      }
    });
  }

  function dialog(message, buttons) {
    var overlayDialog = el('div', { id: 'h3d-dialog' });
    var close = function () { overlayDialog.remove(); };
    overlayDialog.appendChild(el('div', null, [
      el('div', { text: message }),
      el('div', { className: 'h3d-row' }, buttons.map(function (button) {
        return el('button', {
          className: button.primary ? 'primary' : '',
          text: button.label,
          onclick: function () {
            close();
            if (button.action) {
              button.action();
            }
          }
        });
      }))
    ]));
    document.body.appendChild(overlayDialog);
  }

  function confirmClear() {
    dialog('Remove all walls, rooms, doors and furniture from the plan? '
      + 'You can still undo this until you leave the editor.', [
      { label: 'Cancel' },
      {
        label: 'Clear plan',
        primary: true,
        action: function () {
          var items = [].concat(home.getFurniture(), home.getWalls(), home.getRooms(),
            home.getPolylines(), home.getDimensionLines(), home.getLabels());
          if (home.isBasePlanLocked()) {
            planController.unlockBasePlan();
          }
          planController.deleteItems(items);
          refresh(true);
        }
      }
    ]);
  }

  // The View button navigates away: offer to save unsaved changes first.
  function guardViewButton() {
    var view = document.querySelector('a[href="index.html"]');
    if (!view) {
      return;
    }
    view.addEventListener('click', function (ev) {
      if (!home.isModified()) {
        return;
      }
      ev.preventDefault();
      var go = function () {
        state.leaving = true;
        window.location.href = view.href;
      };
      dialog('You have unsaved changes.', [
        { label: 'Cancel' },
        { label: 'Discard', action: go },
        { label: 'Save and view', primary: true, action: function () { save(go); } }
      ]);
    });
    window.addEventListener('beforeunload', function (ev) {
      if (home.isModified() && !state.leaving) {
        ev.preventDefault();
        ev.returnValue = '';
      }
    });
  }

  /* ------------------------------ switching ----------------------------- */

  function isSimple() {
    return document.body.classList.contains('h3d-simple');
  }

  function setSimple(simple) {
    cancelTool();
    document.body.classList.toggle('h3d-simple', simple);
    try {
      window.localStorage.setItem(STORAGE_KEY, simple ? 'simple' : 'advanced');
    } catch (e) {
      // storage unavailable: the choice just isn't remembered
    }
    if (simple && home.getCamera() === home.getObserverCamera()) {
      // Building is easier seen from above than walking through it
      controller.getHomeController3D().viewFromTop();
    }
    if (simple && home.isBasePlanLocked()) {
      // Simple mode edits walls and rooms, which a locked base plan forbids
      planController.unlockBasePlan();
    }
    if (!simple) {
      restoreCollapsedCatalog();
    }
    // Plan and 3D view size themselves from their containers on resize
    window.dispatchEvent(new Event('resize'));
    refresh(true);
  }

  // A catalog splitter saved at 0 (catalog collapsed) would leave the
  // Advanced editor without its catalog: back to the default layout then.
  function restoreCollapsedCatalog() {
    var catalog = document.getElementById('furniture-catalog');
    if (catalog && catalog.offsetHeight < 40) {
      ['furniture-catalog', 'catalog-furniture-splitter', 'furniture-view'].forEach(function (id) {
        var node = document.getElementById(id);
        if (node) {
          node.style.removeProperty('top');
          node.style.removeProperty('height');
        }
      });
    }
  }

  var toastNode = null;
  var toastTimer = null;

  function toast(text) {
    if (toastNode) {
      toastNode.remove();
    }
    clearTimeout(toastTimer);
    toastNode = el('div', { id: 'h3d-toast', text: text });
    document.body.appendChild(toastNode);
    toastTimer = setTimeout(function () {
      if (toastNode) {
        toastNode.remove();
        toastNode = null;
      }
    }, 4500);
  }

  /* -------------------------------- wiring ------------------------------ */

  var selectionListener = {
    selectionChanged: function () {
      extendSelection();
      refresh(false);
    }
  };

  function levelListener() {
    refresh(false);
    if (state.tool) {
      drawPreview();
    }
  }

  // Points everything at `newHome`: New and Open in the Advanced editor
  // close the current home and open another one with its own controllers,
  // and the panel (Save included) must work on that one, not the closed one.
  function attachHome(newHome) {
    home = newHome;
    controller = application.getHomeController(home);
    planController = controller.getPlanController();
    furnitureController = controller.getFurnitureController();
    undoSupport = controller.getUndoableEditSupport();
    plan = planController.getView();
    state.roomPoints = {};
    state.lastSignature = null;
    home.getRooms().forEach(rememberRoomPoints);
    home.addSelectionListener(selectionListener);
    home.addPropertyChangeListener('SELECTED_LEVEL', levelListener);
  }

  home.getRooms().forEach(rememberRoomPoints);
  home.addSelectionListener(selectionListener);
  home.addPropertyChangeListener('SELECTED_LEVEL', levelListener);

  application.addHomesListener(function (ev) {
    if (ev.getType() === window.CollectionEvent.Type.ADD && ev.getItem() !== home) {
      cancelTool();
      attachHome(ev.getItem());
      // Re-applies the mode to the new home's views (camera, base plan lock)
      setSimple(isSimple());
    }
  });
  bridge.onInit(function () {
    refresh(true);
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && state.tool) {
      cancelTool();
    }
  });
  window.addEventListener('resize', function () {
    if (overlay && overlay.style.display === 'block') {
      showOverlay();
    }
  });
  // Plain mouse-up anywhere ends a move in the plan: repair walls then
  document.addEventListener('pointerup', function () {
    setTimeout(repairMovedRooms, 0);
  }, true);
  setInterval(function () {
    updateStatus();
    refresh(false);
  }, 1000);

  guardViewButton();
  updateStatus();

  var saved = null;
  try {
    saved = window.localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    saved = null;
  }
  setSimple(saved !== 'advanced');

  return { setSimple: setSimple, isSimple: isSimple };
}
