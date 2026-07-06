/**
 * Three.js dashboard renderer.
 *
 * The readable Sweet Home 3D engine BUILDS the scene (Ground3D/Wall3D/
 * Room3D/HomePieceOfFurniture3D generate authentic geometry into the
 * Java3D-style scene graph) and this module converts it one-way into
 * Three.js for rendering: shadow mapping, point lights, emissive materials
 * and tone mapping — none of which the classic WebGL1 renderer supports.
 *
 * Every converted branch is tagged with its home item (userData.homeItem),
 * which powers raycaster picking and per-item material overlays in
 * bindings3d.js.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/* --------------------------- scene conversion --------------------------- */

var materialCache = new Map();

function colorToThree(vec) {
  return new THREE.Color(vec[0], vec[1], vec[2]);
}

function cullFaceToSide(appearance) {
  // Mirror the classic renderer (HTMLCanvas3D drawScene): default is
  // back-face culling — that is what hides ceilings when looking down at
  // a room from above (their faces point into the room).
  var cullFace = appearance.getCullFace !== undefined ? appearance.getCullFace() : undefined;
  if (cullFace === window.Appearance3D.CULL_NONE) {
    return THREE.DoubleSide;
  }
  if (cullFace === window.Appearance3D.CULL_FRONT) {
    return THREE.BackSide;
  }
  return THREE.FrontSide; // CULL_BACK or unset (GL default in the engine)
}

function convertAppearance(appearance) {
  if (!appearance) {
    return new THREE.MeshPhongMaterial({ color: 0xAAAAAA, side: THREE.FrontSide });
  }
  if (materialCache.has(appearance)) {
    return materialCache.get(appearance);
  }
  var parameters = { side: cullFaceToSide(appearance) };
  var diffuse = appearance.getDiffuseColor();
  var textureImage = appearance.getTextureImage();
  if (textureImage && (textureImage.width > 0 || textureImage.naturalWidth > 0)) {
    var texture = new THREE.Texture(textureImage);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    parameters.map = texture;
    parameters.color = 0xFFFFFF;
  } else if (diffuse !== undefined) {
    parameters.color = colorToThree(diffuse);
  } else {
    parameters.color = 0xAAAAAA;
  }
  var specular = appearance.getSpecularColor();
  if (specular !== undefined) {
    parameters.specular = colorToThree(specular);
  }
  var shininess = appearance.getShininess();
  if (shininess !== undefined) {
    parameters.shininess = Math.max(1, shininess * 128);
  }
  var emissive = appearance.getEmissiveColor();
  if (emissive !== undefined) {
    parameters.emissive = colorToThree(emissive);
  }
  var transparency = appearance.getTransparency();
  if (transparency !== undefined && transparency > 0) {
    parameters.transparent = true;
    parameters.opacity = 1 - transparency;
  }
  var material = new THREE.MeshPhongMaterial(parameters);
  materialCache.set(appearance, material);
  return material;
}

function convertGeometry(geometry) {
  // Multi-indexed triangles (scene3d.js IndexedTriangleArray3D): de-index
  // into flat arrays, mirroring HTMLCanvas3D.prepareGeometries
  var indexCount = geometry.vertexIndices.length;
  var positions = new Float32Array(indexCount * 3);
  for (var i = 0; i < indexCount; i++) {
    var vertex = geometry.vertices[geometry.vertexIndices[i]];
    positions[i * 3] = vertex[0];
    positions[i * 3 + 1] = vertex[1];
    positions[i * 3 + 2] = vertex[2];
  }
  var bufferGeometry = new THREE.BufferGeometry();
  bufferGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  if (geometry.normals && geometry.normalIndices
      && geometry.normalIndices.length === indexCount) {
    var normals = new Float32Array(indexCount * 3);
    for (var n = 0; n < indexCount; n++) {
      var normal = geometry.normals[geometry.normalIndices[n]];
      normals[n * 3] = normal[0];
      normals[n * 3 + 1] = normal[1];
      normals[n * 3 + 2] = normal[2];
    }
    bufferGeometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  } else {
    bufferGeometry.computeVertexNormals();
  }

  if (geometry.hasTextureCoordinates()
      && geometry.textureCoordinateIndices.length === indexCount) {
    var uvs = new Float32Array(indexCount * 2);
    for (var t = 0; t < indexCount; t++) {
      var uv = geometry.textureCoordinates[geometry.textureCoordinateIndices[t]];
      uvs[t * 2] = uv[0];
      uvs[t * 2 + 1] = uv[1];
    }
    bufferGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }
  return bufferGeometry;
}

function convertNode(node) {
  if (node instanceof window.Shape3D) {
    var appearance = node.getAppearance();
    if (appearance && appearance.isVisible !== undefined && appearance.isVisible() === false) {
      return null;
    }
    var geometries = node.getGeometries();
    var group = null;
    var single = null;
    for (var i = 0; i < geometries.length; i++) {
      if (geometries[i] instanceof window.IndexedLineArray3D
          || !geometries[i].vertexIndices) {
        continue; // lines (selection outlines) not rendered
      }
      var material = convertAppearance(appearance);
      var mesh = new THREE.Mesh(convertGeometry(geometries[i]), material);
      // Transparent surfaces (window panes) must not cast shadows: the
      // shadow depth pass ignores opacity and would project SOLID shadows,
      // plunging rooms behind windows into darkness
      mesh.castShadow = !material.transparent;
      mesh.receiveShadow = true;
      if (single === null && group === null) {
        single = mesh;
      } else {
        if (group === null) {
          group = new THREE.Group();
          group.add(single);
          single = null;
        }
        group.add(mesh);
      }
    }
    return group !== null ? group : single;
  }
  if (node instanceof window.Link3D) {
    return convertNode(node.getSharedGroup());
  }
  if (node instanceof window.Group3D) {
    var threeGroup = new THREE.Group();
    if (node instanceof window.TransformGroup3D) {
      var matrix = new THREE.Matrix4();
      matrix.fromArray(node.transform); // gl-matrix mat4 is column-major, like Three.js
      threeGroup.matrix.copy(matrix);
      threeGroup.matrixAutoUpdate = false;
    }
    var children = node.getChildren();
    for (var c = 0; c < children.length; c++) {
      var converted = convertNode(children[c]);
      if (converted !== null) {
        threeGroup.add(converted);
      }
    }
    return threeGroup;
  }
  return null;
}

/* ------------------------------ home helpers ---------------------------- */

function homeBounds(home) {
  var minX = Infinity;
  var minY = Infinity;
  var maxX = -Infinity;
  var maxY = -Infinity;
  var extend = function (x, y) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  home.getWalls().forEach(function (wall) {
    extend(wall.getXStart(), wall.getYStart());
    extend(wall.getXEnd(), wall.getYEnd());
  });
  home.getRooms().forEach(function (room) {
    room.getPoints().forEach(function (point) {
      extend(point[0], point[1]);
    });
  });
  home.getFurniture().forEach(function (piece) {
    extend(piece.getX(), piece.getY());
  });
  if (!isFinite(minX)) {
    minX = -500; minY = -500; maxX = 500; maxY = 500;
  }
  return { minX: minX, minY: minY, maxX: maxX, maxY: maxY,
           centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2,
           size: Math.max(maxX - minX, maxY - minY) };
}

function buildEngineBranches(home, bounds) {
  // waitLoading=false everywhere: matches how HomeComponent3D drives these
  // classes (progressive async loading)
  var margin = bounds.size * 0.75;
  var branches = [
    new window.Ground3D(home,
      bounds.minX - margin, bounds.minY - margin,
      (bounds.maxX - bounds.minX) + 2 * margin,
      (bounds.maxY - bounds.minY) + 2 * margin, false)
  ];
  home.getWalls().forEach(function (wall) {
    branches.push(new window.Wall3D(wall, home, null, false));
  });
  home.getRooms().forEach(function (room) {
    branches.push(new window.Room3D(room, home, null, false, false));
  });
  // Furniture groups have no model of their own: expand into leaf pieces,
  // exactly like HomeComponent3D.createHomeTree does
  var addPiece = function (piece) {
    if (piece instanceof window.HomeFurnitureGroup) {
      piece.getAllFurniture().forEach(function (childPiece) {
        if (!(childPiece instanceof window.HomeFurnitureGroup)) {
          branches.push(new window.HomePieceOfFurniture3D(childPiece, home, null, false));
        }
      });
    } else {
      branches.push(new window.HomePieceOfFurniture3D(piece, home, null, false));
    }
  };
  home.getFurniture().forEach(addPiece);
  return branches;
}

/**
 * Floor selector, mirroring the classic viewer's level filtering: selecting
 * a level shows it and the ones below. Also removes ceilings on the
 * newly-topmost visible level, which is how the aerial view sees inside.
 */
function createLevelSelector(home, rebuild) {
  var levels = home.getLevels();
  if (levels.length < 2) {
    return;
  }
  var select = document.createElement('select');
  select.style.cssText =
    'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);' +
    'z-index:10;padding:5px 10px;border-radius:6px;border:0;' +
    'font:13px system-ui,sans-serif;background:rgba(0,0,0,.6);color:#fff;';

  var allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'All levels';
  select.appendChild(allOption);
  levels.forEach(function (level, index) {
    var option = document.createElement('option');
    option.value = String(index);
    option.textContent = level.getName() || ('Level ' + (index + 1));
    select.appendChild(option);
  });

  var applySelection = function (value) {
    if (value === 'all') {
      home.getEnvironment().setAllLevelsVisible(true);
      levels.forEach(function (level) {
        level.setVisible(true);
      });
    } else {
      var index = parseInt(value, 10);
      home.getEnvironment().setAllLevelsVisible(false);
      home.setSelectedLevel(levels[index]);
      levels.forEach(function (level, i) {
        level.setVisible(i <= index);
      });
    }
  };

  var selectedLevel = home.getSelectedLevel();
  select.value = selectedLevel !== null && levels.indexOf(selectedLevel) >= 0
      && !home.getEnvironment().isAllLevelsVisible()
    ? String(levels.indexOf(selectedLevel))
    : 'all';
  // Normalize initial visibility the way the classic viewer does on load
  applySelection(select.value);

  select.addEventListener('change', function () {
    applySelection(select.value);
    rebuild();
  });
  document.body.appendChild(select);
}

/* ------------------------------- dashboard ------------------------------ */

/**
 * Boots the Three.js dashboard.
 * @param {{homeUrl: string, container: Element, onStatus: function,
 *          onReady: function(api), onError: function}} options
 * onReady receives an api object used by bindings3d.js.
 */
export function initDashboard(options) {
  var onStatus = options.onStatus || function () {};

  new window.HomeRecorder({}).readHome(options.homeUrl, {
    homeLoaded: function (home) {
      try {
        var api = createScene(home, options);
        if (options.onReady) {
          options.onReady(api);
        }
      } catch (ex) {
        console.error('[3d-dashboard] scene failed', ex);
        if (options.onError) {
          options.onError(ex.message);
        }
      }
    },
    homeError: function (err) {
      if (options.onError) {
        options.onError(String(err));
      }
    },
    progression: function (part, info, percentage) {
      onStatus(part + ' ' + Math.round((percentage || 0) * 100) + '%');
    }
  });
}

function createScene(home, options) {
  var container = options.container;
  var onStatus = options.onStatus || function () {};
  var bounds = homeBounds(home);

  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(home.getEnvironment().getSkyColor());

  // Lighting: strong hemisphere ambient (dollhouse views need readable
  // interiors) + a steep, softer sun so interior walls don't plunge whole
  // rooms into shadow
  var hemisphere = new THREE.HemisphereLight(0xBFD4E2, 0x8C7B66, 1.15);
  scene.add(hemisphere);
  var sun = new THREE.DirectionalLight(0xFFF3E0, 1.1);
  sun.position.set(bounds.centerX + bounds.size * 0.5, bounds.size * 2.2, bounds.centerY - bounds.size * 0.35);
  sun.target.position.set(bounds.centerX, 0, bounds.centerY);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  var shadowExtent = bounds.size * 1.2;
  sun.shadow.camera.left = -shadowExtent;
  sun.shadow.camera.right = shadowExtent;
  sun.shadow.camera.top = shadowExtent;
  sun.shadow.camera.bottom = -shadowExtent;
  sun.shadow.camera.far = bounds.size * 6;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  var camera = new THREE.PerspectiveCamera(
    55, container.clientWidth / container.clientHeight, 10, bounds.size * 20);
  camera.position.set(bounds.centerX + bounds.size * 0.8, bounds.size * 0.9,
    bounds.centerY + bounds.size * 0.8);
  var controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(bounds.centerX, 100, bounds.centerY);
  controls.update();

  var homeGroup = new THREE.Group();
  scene.add(homeGroup);

  var onRebuilt = null;
  var branches = [];
  var lastCount = -1;
  var stableRuns = 0;
  var attempts = 0;
  var convert = function () {
    homeGroup.clear();
    materialCache = new Map();
    var triangles = 0;
    branches.forEach(function (branch) {
      var converted = convertNode(branch);
      if (converted !== null) {
        // Tag the branch root with its home item for picking and overlays
        var item = branch.getUserData();
        converted.userData.homeItem = item;
        if (item && typeof item.getId === 'function') {
          converted.userData.homeItemId = item.getId();
        }
        homeGroup.add(converted);
      }
    });
    homeGroup.traverse(function (object) {
      if (object.isMesh) {
        triangles += object.geometry.getAttribute('position').count / 3;
      }
    });
    onStatus(stableRuns > 0 ? '' : 'Loading models…');
    if (triangles === lastCount) {
      stableRuns++;
    } else {
      stableRuns = 0;
      lastCount = triangles;
    }
    if (stableRuns < 2 && ++attempts < 30) {
      setTimeout(convert, 1500);
    }
    if (onRebuilt) {
      onRebuilt();
    }
  };
  var rebuild = function () {
    branches = buildEngineBranches(home, bounds);
    lastCount = -1;
    stableRuns = 0;
    attempts = 0;
    convert();
  };
  // Selector first: it normalizes level visibility before first conversion
  createLevelSelector(home, rebuild);
  rebuild();

  // Tap picking (click without drag; single-finger tap)
  var raycaster = new THREE.Raycaster();
  var pointer = new THREE.Vector2();
  var tapHandler = null;
  var downX = null;
  var downY = null;
  var pick = function (clientX, clientY) {
    if (tapHandler === null
        || downX === null
        || Math.abs(clientX - downX) > 5
        || Math.abs(clientY - downY) > 5) {
      return;
    }
    var rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    var hits = raycaster.intersectObjects(homeGroup.children, true);
    for (var i = 0; i < hits.length; i++) {
      var object = hits[i].object;
      while (object !== null && object.userData.homeItem === undefined) {
        object = object.parent;
      }
      if (object !== null && object.userData.homeItem) {
        tapHandler(object.userData.homeItem);
        return;
      }
    }
  };
  renderer.domElement.addEventListener('mousedown', function (ev) {
    downX = ev.clientX;
    downY = ev.clientY;
  });
  renderer.domElement.addEventListener('mouseup', function (ev) {
    pick(ev.clientX, ev.clientY);
  });
  renderer.domElement.addEventListener('touchstart', function (ev) {
    if (ev.touches.length === 1) {
      downX = ev.touches[0].clientX;
      downY = ev.touches[0].clientY;
    } else {
      downX = null;
    }
  });
  renderer.domElement.addEventListener('touchend', function (ev) {
    if (ev.changedTouches.length === 1) {
      pick(ev.changedTouches[0].clientX, ev.changedTouches[0].clientY);
    }
  });

  window.addEventListener('resize', function () {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  renderer.setAnimationLoop(function () {
    controls.update();
    renderer.render(scene, camera);
  });

  return {
    home: home,
    scene: scene,
    bounds: bounds,
    sun: sun,
    hemisphere: hemisphere,
    setBackground: function (color) {
      scene.background.set(color);
    },
    onItemTap: function (handler) {
      tapHandler = handler;
    },
    setOnRebuilt: function (handler) {
      onRebuilt = handler;
    },
    /** All converted root groups whose home item has the given id. */
    getGroupsByItemId: function (itemId) {
      return homeGroup.children.filter(function (child) {
        return child.userData.homeItemId === itemId;
      });
    }
  };
}
