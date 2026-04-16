/**
 * 3D Home Dashboard - Home Assistant Custom Panel
 *
 * Interactive 3D model viewer with entity mapping for lights, switches, and sensors.
 * Uses Three.js for rendering via CDN (importmap).
 */

const THREE_CDN = "https://cdn.jsdelivr.net/npm/three@0.162.0";

class ThreeDHomeDashboard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._panel = null;
    this._scene = null;
    this._camera = null;
    this._renderer = null;
    this._controls = null;
    this._model = null;
    this._mixer = null;
    this._clock = null;
    this._raycaster = null;
    this._mouse = null;
    this._mappings = {};
    this._modelFilename = null;
    this._editMode = false;
    this._selectedMesh = null;
    this._hoveredMesh = null;
    this._meshList = [];
    this._originalMaterials = new Map();
    this._lightHelpers = [];
    this._entityStates = {};
    this._animationId = null;
    this._THREE = null;
    this._GLTFLoader = null;
    this._OrbitControls = null;
    this._loaded = false;
    this._wsSubscription = null;
  }

  set hass(hass) {
    this._hass = hass;
    if (this._loaded) {
      this._updateEntityStates();
    }
  }

  set panel(panel) {
    this._panel = panel;
  }

  connectedCallback() {
    this._render();
    this._loadDependencies();
  }

  disconnectedCallback() {
    if (this._animationId) cancelAnimationFrame(this._animationId);
    if (this._renderer) this._renderer.dispose();
    if (this._wsSubscription) this._wsSubscription();
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%;
          --primary-color: #03a9f4;
          --accent-color: #ff9800;
          --bg-color: #1c1c1e;
          --card-bg: #2c2c2e;
          --text-color: #f5f5f5;
          --text-secondary: #a0a0a0;
          --border-color: #3a3a3c;
          --success-color: #4caf50;
          --danger-color: #f44336;
          --warning-color: #ff9800;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: var(--bg-color);
          color: var(--text-color);
          overflow: hidden;
        }

        /* Top Bar */
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 20px;
          background: var(--card-bg);
          border-bottom: 1px solid var(--border-color);
          z-index: 10;
          min-height: 56px;
        }
        .topbar-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .topbar-title {
          font-size: 18px;
          font-weight: 600;
          letter-spacing: -0.3px;
        }
        .topbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Buttons */
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .btn svg { width: 16px; height: 16px; }
        .btn-primary {
          background: var(--primary-color);
          color: white;
        }
        .btn-primary:hover { background: #0288d1; }
        .btn-accent {
          background: var(--accent-color);
          color: white;
        }
        .btn-accent:hover { background: #f57c00; }
        .btn-ghost {
          background: transparent;
          color: var(--text-color);
          border: 1px solid var(--border-color);
        }
        .btn-ghost:hover { background: rgba(255,255,255,0.08); }
        .btn-danger {
          background: var(--danger-color);
          color: white;
        }
        .btn-danger:hover { background: #d32f2f; }
        .btn-success {
          background: var(--success-color);
          color: white;
        }
        .btn-success:hover { background: #388e3c; }
        .btn-sm { padding: 6px 12px; font-size: 12px; }

        /* Main content area */
        .main {
          flex: 1;
          display: flex;
          position: relative;
          overflow: hidden;
        }

        /* Canvas container */
        .canvas-wrap {
          flex: 1;
          position: relative;
          overflow: hidden;
        }
        .canvas-wrap canvas {
          display: block;
          width: 100% !important;
          height: 100% !important;
        }

        /* Upload overlay */
        .upload-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: var(--bg-color);
          z-index: 5;
        }
        .upload-area {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          width: 420px;
          max-width: 90%;
          padding: 48px 32px;
          border: 2px dashed var(--border-color);
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.25s;
        }
        .upload-area:hover, .upload-area.dragover {
          border-color: var(--primary-color);
          background: rgba(3, 169, 244, 0.05);
        }
        .upload-area svg {
          width: 56px;
          height: 56px;
          color: var(--text-secondary);
        }
        .upload-area h2 {
          font-size: 18px;
          font-weight: 600;
        }
        .upload-area p {
          font-size: 13px;
          color: var(--text-secondary);
          text-align: center;
        }
        .upload-area input[type="file"] { display: none; }

        /* Loading */
        .loading-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(28,28,30,0.92);
          z-index: 20;
        }
        .spinner {
          width: 40px; height: 40px;
          border: 3px solid var(--border-color);
          border-top-color: var(--primary-color);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .loading-text {
          margin-top: 14px;
          font-size: 14px;
          color: var(--text-secondary);
        }

        /* Side Panel (Edit Mode) */
        .side-panel {
          width: 340px;
          background: var(--card-bg);
          border-left: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideIn 0.25s ease-out;
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .side-header {
          padding: 16px;
          border-bottom: 1px solid var(--border-color);
        }
        .side-header h3 {
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .side-header p {
          font-size: 12px;
          color: var(--text-secondary);
        }
        .side-body {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        }

        /* Mesh list in edit panel */
        .mesh-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s;
          margin-bottom: 2px;
        }
        .mesh-item:hover { background: rgba(255,255,255,0.05); }
        .mesh-item.selected { background: rgba(3,169,244,0.15); }
        .mesh-item-name {
          font-size: 13px;
          font-weight: 500;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .mesh-item-badge {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 10px;
          background: rgba(3,169,244,0.2);
          color: var(--primary-color);
          white-space: nowrap;
        }
        .mesh-item-badge.sensor { background: rgba(76,175,80,0.2); color: var(--success-color); }
        .mesh-item-badge.switch { background: rgba(255,152,0,0.2); color: var(--warning-color); }

        /* Mapping Card */
        .mapping-card {
          background: rgba(0,0,0,0.2);
          border-radius: 10px;
          padding: 16px;
          margin-top: 12px;
          animation: fadeIn 0.2s;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .mapping-card h4 {
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 12px;
          color: var(--primary-color);
        }
        .mapping-field {
          margin-bottom: 12px;
        }
        .mapping-field label {
          display: block;
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 4px;
          font-weight: 500;
        }
        .mapping-field select,
        .mapping-field input {
          width: 100%;
          padding: 8px 10px;
          background: var(--bg-color);
          color: var(--text-color);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          font-size: 13px;
          outline: none;
          transition: border-color 0.2s;
        }
        .mapping-field select:focus,
        .mapping-field input:focus {
          border-color: var(--primary-color);
        }
        .mapping-actions {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }

        /* Info HUD */
        .hud {
          position: absolute;
          bottom: 16px;
          left: 16px;
          display: flex;
          gap: 8px;
          z-index: 5;
        }
        .hud-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(44,44,46,0.85);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          font-size: 12px;
          color: var(--text-secondary);
        }
        .hud-chip .dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: var(--success-color);
        }

        /* Tooltip on hover */
        .hover-tooltip {
          position: absolute;
          padding: 8px 14px;
          background: rgba(44,44,46,0.92);
          backdrop-filter: blur(10px);
          border-radius: 8px;
          font-size: 12px;
          pointer-events: none;
          z-index: 15;
          transition: opacity 0.15s;
          max-width: 260px;
        }
        .hover-tooltip .tt-name {
          font-weight: 600;
          margin-bottom: 2px;
        }
        .hover-tooltip .tt-entity {
          color: var(--text-secondary);
          font-size: 11px;
        }
        .hover-tooltip .tt-state {
          font-size: 11px;
          margin-top: 2px;
        }

        /* Scrollbar */
        .side-body::-webkit-scrollbar { width: 6px; }
        .side-body::-webkit-scrollbar-track { background: transparent; }
        .side-body::-webkit-scrollbar-thumb {
          background: var(--border-color);
          border-radius: 3px;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .side-panel { width: 280px; }
          .topbar-title { font-size: 15px; }
        }
      </style>

      <div class="container">
        <div class="topbar">
          <div class="topbar-left">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span class="topbar-title">3D Home Dashboard</span>
          </div>
          <div class="topbar-right" id="topbar-actions"></div>
        </div>

        <div class="main">
          <div class="canvas-wrap" id="canvas-wrap">
            <div class="upload-overlay" id="upload-overlay">
              <div class="upload-area" id="upload-area">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <h2>Upload 3D Model</h2>
                <p>Drag & drop a GLB or GLTF file here,<br>or click to browse</p>
                <span class="btn btn-primary btn-sm">Choose File</span>
                <input type="file" id="file-input" accept=".glb,.gltf">
              </div>
            </div>
            <div class="loading-overlay" id="loading" style="display:none">
              <div class="spinner"></div>
              <div class="loading-text" id="loading-text">Loading model…</div>
            </div>
            <div class="hud" id="hud" style="display:none"></div>
            <div class="hover-tooltip" id="tooltip" style="display:none"></div>
          </div>
          <div class="side-panel" id="side-panel" style="display:none"></div>
        </div>
      </div>
    `;

    // Event bindings
    const uploadArea = this.shadowRoot.getElementById("upload-area");
    const fileInput = this.shadowRoot.getElementById("file-input");

    uploadArea.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
      if (e.target.files[0]) this._uploadModel(e.target.files[0]);
    });

    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadArea.classList.add("dragover");
    });
    uploadArea.addEventListener("dragleave", () => {
      uploadArea.classList.remove("dragover");
    });
    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.classList.remove("dragover");
      if (e.dataTransfer.files[0]) this._uploadModel(e.dataTransfer.files[0]);
    });
  }

  async _loadDependencies() {
    // Dynamically load Three.js and addons
    this._showLoading("Loading 3D engine…");

    try {
      const [threeModule, gltfModule, orbitModule] = await Promise.all([
        import(`${THREE_CDN}/build/three.module.js`),
        import(`${THREE_CDN}/examples/jsm/loaders/GLTFLoader.js`),
        import(`${THREE_CDN}/examples/jsm/controls/OrbitControls.js`),
      ]);

      this._THREE = threeModule;
      this._GLTFLoader = gltfModule.GLTFLoader;
      this._OrbitControls = orbitModule.OrbitControls;

      this._loaded = true;
      this._hideLoading();

      // Check if we already have a model
      await this._checkExistingModel();
    } catch (err) {
      console.error("Failed to load Three.js:", err);
      this._showLoading("Failed to load 3D engine. Please refresh.");
    }
  }

  async _checkExistingModel() {
    if (!this._hass) return;

    try {
      const result = await this._hass.callWS({
        type: "3d_home_dashboard/get_model_info",
      });

      if (result && result.filename) {
        this._modelFilename = result.filename;
        await this._loadModelFromServer(result.filename);
        await this._loadMappings();
      }
    } catch (err) {
      console.error("Error checking model:", err);
    }
  }

  async _uploadModel(file) {
    this._showLoading("Uploading model…");

    const formData = new FormData();
    formData.append("model", file);

    try {
      const resp = await fetch(`/api/3d_home_dashboard/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this._hass.auth.data.access_token}`,
        },
        body: formData,
      });

      const data = await resp.json();
      if (data.success) {
        this._modelFilename = data.filename;
        this._mappings = {};
        await this._loadModelFromServer(data.filename);
      } else {
        alert("Upload failed: " + (data.error || "Unknown error"));
        this._hideLoading();
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed: " + err.message);
      this._hideLoading();
    }
  }

  async _loadModelFromServer(filename) {
    this._showLoading("Loading 3D model…");

    const THREE = this._THREE;
    const canvasWrap = this.shadowRoot.getElementById("canvas-wrap");

    // Init scene if needed
    if (!this._scene) {
      this._initScene(canvasWrap);
    }

    // Clear existing model
    if (this._model) {
      this._scene.remove(this._model);
      this._model = null;
      this._meshList = [];
      this._originalMaterials.clear();
    }

    try {
      const loader = new this._GLTFLoader();
      const url = `/api/3d_home_dashboard/model/${encodeURIComponent(filename)}`;

      const gltf = await new Promise((resolve, reject) => {
        loader.load(
          url,
          resolve,
          (progress) => {
            if (progress.total > 0) {
              const pct = Math.round((progress.loaded / progress.total) * 100);
              this.shadowRoot.getElementById("loading-text").textContent =
                `Loading model… ${pct}%`;
            }
          },
          reject,
          { requestHeader: { Authorization: `Bearer ${this._hass.auth.data.access_token}` } }
        );
      });

      this._model = gltf.scene;
      this._scene.add(this._model);

      // Gather all meshes
      this._meshList = [];
      this._model.traverse((child) => {
        if (child.isMesh) {
          this._meshList.push(child);
          // Store original materials for restoration
          this._originalMaterials.set(
            child.uuid,
            child.material.clone ? child.material.clone() : child.material
          );
        }
      });

      // Handle animations
      if (gltf.animations && gltf.animations.length > 0) {
        this._mixer = new THREE.AnimationMixer(this._model);
        gltf.animations.forEach((clip) => {
          this._mixer.clipAction(clip).play();
        });
      }

      // Auto-fit camera to model
      this._fitCameraToModel();

      // Hide upload overlay
      this.shadowRoot.getElementById("upload-overlay").style.display = "none";
      this._hideLoading();
      this._updateTopbar();
      this._updateHud();
      this._updateEntityStates();

    } catch (err) {
      console.error("Model load error:", err);
      // If auth failed, try with custom headers approach
      if (err.message && err.message.includes("401")) {
        this._showLoading("Authentication error. Please refresh the page.");
      } else {
        this._showLoading("Failed to load model: " + err.message);
      }
    }
  }

  _initScene(container) {
    const THREE = this._THREE;

    // Scene
    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(0x1a1a2e);

    // Subtle fog
    this._scene.fog = new THREE.FogExp2(0x1a1a2e, 0.015);

    // Camera
    this._camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this._camera.position.set(5, 5, 5);

    // Renderer
    this._renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this._renderer.setSize(container.clientWidth, container.clientHeight);
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.shadowMap.enabled = true;
    this._renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this._renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._renderer.toneMappingExposure = 1.0;
    this._renderer.outputColorSpace = THREE.SRGBColorSpace;

    container.insertBefore(this._renderer.domElement, container.firstChild);

    // Orbit Controls
    this._controls = new this._OrbitControls(
      this._camera,
      this._renderer.domElement
    );
    this._controls.enableDamping = true;
    this._controls.dampingFactor = 0.08;
    this._controls.enablePan = true;
    this._controls.panSpeed = 0.8;
    this._controls.rotateSpeed = 0.6;
    this._controls.zoomSpeed = 1.0;
    this._controls.minDistance = 1;
    this._controls.maxDistance = 100;
    this._controls.maxPolarAngle = Math.PI * 0.85;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this._scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    this._scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(-10, 5, -10);
    this._scene.add(fillLight);

    // Ground grid
    const grid = new THREE.GridHelper(50, 50, 0x333355, 0x222244);
    grid.material.opacity = 0.3;
    grid.material.transparent = true;
    this._scene.add(grid);

    // Raycaster for picking
    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();

    // Clock for animations
    this._clock = new THREE.Clock();

    // Events
    this._renderer.domElement.addEventListener("pointermove", (e) =>
      this._onPointerMove(e)
    );
    this._renderer.domElement.addEventListener("click", (e) =>
      this._onClick(e)
    );

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container.clientWidth || !container.clientHeight) return;
      this._camera.aspect = container.clientWidth / container.clientHeight;
      this._camera.updateProjectionMatrix();
      this._renderer.setSize(container.clientWidth, container.clientHeight);
    });
    resizeObserver.observe(container);

    // Start animation loop
    this._animate();
  }

  _fitCameraToModel() {
    const THREE = this._THREE;
    if (!this._model) return;

    const box = new THREE.Box3().setFromObject(this._model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 1.8;

    this._camera.position.set(
      center.x + distance * 0.6,
      center.y + distance * 0.5,
      center.z + distance * 0.6
    );
    this._controls.target.copy(center);
    this._controls.update();
  }

  _animate() {
    this._animationId = requestAnimationFrame(() => this._animate());

    const delta = this._clock ? this._clock.getDelta() : 0.016;

    if (this._mixer) this._mixer.update(delta);
    if (this._controls) this._controls.update();
    if (this._renderer && this._scene && this._camera) {
      this._renderer.render(this._scene, this._camera);
    }
  }

  /* ───── Pointer / Raycasting ───── */

  _getIntersects(event) {
    const canvas = this._renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._mouse, this._camera);
    return this._raycaster.intersectObjects(this._meshList, false);
  }

  _onPointerMove(event) {
    if (!this._model) return;

    const intersects = this._getIntersects(event);
    const THREE = this._THREE;
    const tooltip = this.shadowRoot.getElementById("tooltip");

    // Reset hovered
    if (this._hoveredMesh && this._hoveredMesh !== this._selectedMesh) {
      this._restoreMaterial(this._hoveredMesh);
    }

    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      this._hoveredMesh = mesh;

      if (mesh !== this._selectedMesh) {
        this._highlightMesh(mesh, 0x03a9f4, 0.15);
      }

      this._renderer.domElement.style.cursor = "pointer";

      // Show tooltip
      const mapping = this._findMappingForMesh(mesh.name);
      if (mapping || this._editMode) {
        tooltip.style.display = "block";
        tooltip.style.left = event.offsetX + 16 + "px";
        tooltip.style.top = event.offsetY - 10 + "px";

        let html = `<div class="tt-name">${mesh.name || "Unnamed"}</div>`;
        if (mapping) {
          const state = this._hass?.states?.[mapping.entity_id];
          html += `<div class="tt-entity">${mapping.entity_id}</div>`;
          if (state) {
            html += `<div class="tt-state" style="color:${state.state === "on" ? "#4caf50" : "#f44336"}">${state.state}${state.attributes?.brightness ? ` · ${Math.round((state.attributes.brightness / 255) * 100)}%` : ""}${state.attributes?.unit_of_measurement ? ` ${state.state} ${state.attributes.unit_of_measurement}` : ""}</div>`;
          }
        }
        tooltip.innerHTML = html;
      } else {
        tooltip.style.display = "none";
      }
    } else {
      this._hoveredMesh = null;
      this._renderer.domElement.style.cursor = "default";
      tooltip.style.display = "none";
    }
  }

  _onClick(event) {
    if (!this._model) return;
    const intersects = this._getIntersects(event);

    if (this._editMode && intersects.length > 0) {
      const mesh = intersects[0].object;
      this._selectMesh(mesh);
    } else if (!this._editMode && intersects.length > 0) {
      // Toggle entity if mapped
      const mesh = intersects[0].object;
      const mapping = this._findMappingForMesh(mesh.name);
      if (mapping && this._hass) {
        const state = this._hass.states[mapping.entity_id];
        if (state) {
          const domain = mapping.entity_id.split(".")[0];
          if (domain === "light" || domain === "switch") {
            this._hass.callService(domain, "toggle", {
              entity_id: mapping.entity_id,
            });
          }
        }
      }
    }
  }

  /* ───── Material Helpers ───── */

  _highlightMesh(mesh, color, intensity) {
    const THREE = this._THREE;
    if (!mesh.material) return;

    const mat = mesh.material.clone();
    mat.emissive = new THREE.Color(color);
    mat.emissiveIntensity = intensity;
    mesh.material = mat;
  }

  _restoreMaterial(mesh) {
    const orig = this._originalMaterials.get(mesh.uuid);
    if (orig) {
      mesh.material = orig.clone ? orig.clone() : orig;
    }
  }

  /* ───── Edit Mode ───── */

  _toggleEditMode() {
    this._editMode = !this._editMode;
    this._selectedMesh = null;

    if (!this._editMode) {
      // Restore all materials
      this._meshList.forEach((m) => this._restoreMaterial(m));
      this.shadowRoot.getElementById("side-panel").style.display = "none";
    } else {
      this._renderSidePanel();
      this.shadowRoot.getElementById("side-panel").style.display = "flex";
    }
    this._updateTopbar();
    this._updateEntityStates();
  }

  _selectMesh(mesh) {
    // Restore previous selection
    if (this._selectedMesh) {
      this._restoreMaterial(this._selectedMesh);
    }

    this._selectedMesh = mesh;
    this._highlightMesh(mesh, 0xff9800, 0.35);

    // Highlight in the sidebar list
    this._renderSidePanel();

    // Scroll to the mesh item in the list
    const el = this.shadowRoot.querySelector(
      `[data-mesh-name="${CSS.escape(mesh.name)}"]`
    );
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  _renderSidePanel() {
    const panel = this.shadowRoot.getElementById("side-panel");
    const selected = this._selectedMesh;

    let meshListHTML = this._meshList
      .map((m) => {
        const mapping = this._findMappingForMesh(m.name);
        const isSelected = selected && selected.name === m.name;
        let badge = "";
        if (mapping) {
          const domain = mapping.entity_id.split(".")[0];
          const cls =
            domain === "sensor"
              ? "sensor"
              : domain === "switch"
                ? "switch"
                : "";
          badge = `<span class="mesh-item-badge ${cls}">${mapping.entity_id.split(".")[1]}</span>`;
        }
        return `<div class="mesh-item ${isSelected ? "selected" : ""}" data-mesh-name="${this._escHtml(m.name)}">
          <span class="mesh-item-name">${this._escHtml(m.name || "Unnamed")}</span>
          ${badge}
        </div>`;
      })
      .join("");

    let mappingCardHTML = "";
    if (selected) {
      const mapping = this._findMappingForMesh(selected.name) || {};
      const entityId = mapping.entity_id || "";
      const entityType = mapping.entity_type || "";

      // Build entity options grouped by domain
      const domains = ["light", "switch", "sensor"];
      let entityOptions = '<option value="">— Select Entity —</option>';
      for (const domain of domains) {
        const entities = Object.keys(this._hass?.states || {}).filter((e) =>
          e.startsWith(domain + ".")
        );
        if (entities.length > 0) {
          entityOptions += `<optgroup label="${domain.charAt(0).toUpperCase() + domain.slice(1)}s">`;
          entities.forEach((eid) => {
            const name =
              this._hass.states[eid].attributes.friendly_name || eid;
            entityOptions += `<option value="${eid}" ${eid === entityId ? "selected" : ""}>${name} (${eid})</option>`;
          });
          entityOptions += "</optgroup>";
        }
      }

      mappingCardHTML = `
        <div class="mapping-card">
          <h4>Map: ${this._escHtml(selected.name || "Unnamed")}</h4>
          <div class="mapping-field">
            <label>Entity</label>
            <select id="entity-select">${entityOptions}</select>
          </div>
          <div class="mapping-actions">
            <button class="btn btn-success btn-sm" id="save-mapping-btn">Save</button>
            ${entityId ? '<button class="btn btn-danger btn-sm" id="remove-mapping-btn">Remove</button>' : ""}
          </div>
        </div>
      `;
    }

    panel.innerHTML = `
      <div class="side-header">
        <h3>Edit Mode</h3>
        <p>Click a mesh in the 3D view or list below to map entities</p>
      </div>
      <div class="side-body">
        ${meshListHTML}
        ${mappingCardHTML}
      </div>
    `;

    // Bind mesh item clicks
    panel.querySelectorAll(".mesh-item").forEach((el) => {
      el.addEventListener("click", () => {
        const name = el.dataset.meshName;
        const mesh = this._meshList.find((m) => m.name === name);
        if (mesh) this._selectMesh(mesh);
      });
    });

    // Bind save/remove
    const saveBtn = panel.querySelector("#save-mapping-btn");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => this._saveMappingFromUI());
    }
    const removeBtn = panel.querySelector("#remove-mapping-btn");
    if (removeBtn) {
      removeBtn.addEventListener("click", () => this._removeMapping());
    }
  }

  _saveMappingFromUI() {
    if (!this._selectedMesh) return;
    const select = this.shadowRoot.getElementById("entity-select");
    if (!select || !select.value) return;

    const entityId = select.value;
    const domain = entityId.split(".")[0];

    this._mappings[this._selectedMesh.name] = {
      entity_id: entityId,
      entity_type: domain,
      mesh_name: this._selectedMesh.name,
    };

    this._saveMappingsToServer();
    this._renderSidePanel();
    this._updateEntityStates();
    this._updateHud();
  }

  _removeMapping() {
    if (!this._selectedMesh) return;
    delete this._mappings[this._selectedMesh.name];
    this._restoreMaterial(this._selectedMesh);
    this._saveMappingsToServer();
    this._renderSidePanel();
    this._updateEntityStates();
    this._updateHud();
  }

  /* ───── Mappings Persistence ───── */

  async _loadMappings() {
    try {
      const result = await this._hass.callWS({
        type: "3d_home_dashboard/get_mappings",
      });
      this._mappings = result || {};
      this._updateEntityStates();
      this._updateHud();
    } catch (err) {
      console.error("Failed to load mappings:", err);
    }
  }

  async _saveMappingsToServer() {
    try {
      await this._hass.callWS({
        type: "3d_home_dashboard/save_mappings",
        mappings: this._mappings,
      });
    } catch (err) {
      console.error("Failed to save mappings:", err);
    }
  }

  _findMappingForMesh(meshName) {
    return this._mappings[meshName] || null;
  }

  /* ───── Entity State Rendering ───── */

  _updateEntityStates() {
    if (!this._hass || !this._model || this._editMode) return;
    const THREE = this._THREE;

    // Remove old light helpers
    this._lightHelpers.forEach((h) => this._scene.remove(h));
    this._lightHelpers = [];

    for (const [meshName, mapping] of Object.entries(this._mappings)) {
      const mesh = this._meshList.find((m) => m.name === meshName);
      if (!mesh) continue;

      const state = this._hass.states[mapping.entity_id];
      if (!state) continue;

      const domain = mapping.entity_type || mapping.entity_id.split(".")[0];

      if (domain === "light") {
        this._applyLightState(mesh, state);
      } else if (domain === "switch") {
        this._applySwitchState(mesh, state);
      } else if (domain === "sensor") {
        this._applySensorState(mesh, state);
      }
    }
  }

  _applyLightState(mesh, state) {
    const THREE = this._THREE;
    const isOn = state.state === "on";
    const brightness = state.attributes?.brightness || 255;
    const brightnessPct = brightness / 255;

    // Restore base material first
    this._restoreMaterial(mesh);

    if (isOn) {
      const mat = mesh.material.clone();

      // Parse color from HA attributes
      let lightColor = new THREE.Color(0xffdd88); // warm white default
      if (state.attributes?.rgb_color) {
        const [r, g, b] = state.attributes.rgb_color;
        lightColor = new THREE.Color(r / 255, g / 255, b / 255);
      } else if (state.attributes?.color_temp_kelvin) {
        lightColor = this._kelvinToColor(state.attributes.color_temp_kelvin);
      }

      mat.emissive = lightColor;
      mat.emissiveIntensity = 0.2 + brightnessPct * 0.6;
      mesh.material = mat;

      // Add a point light at mesh position for glow effect
      const box = new THREE.Box3().setFromObject(mesh);
      const center = box.getCenter(new THREE.Vector3());
      const pointLight = new THREE.PointLight(
        lightColor,
        brightnessPct * 2,
        10
      );
      pointLight.position.copy(center);
      this._scene.add(pointLight);
      this._lightHelpers.push(pointLight);
    } else {
      // Darken slightly when off
      const mat = mesh.material.clone();
      mat.emissive = new THREE.Color(0x000000);
      mat.emissiveIntensity = 0;
      const c = mat.color || new THREE.Color(0x888888);
      mat.color = c.multiplyScalar(0.7);
      mesh.material = mat;
    }
  }

  _applySwitchState(mesh, state) {
    const THREE = this._THREE;
    const isOn = state.state === "on";

    this._restoreMaterial(mesh);
    const mat = mesh.material.clone();

    if (isOn) {
      mat.emissive = new THREE.Color(0x4caf50);
      mat.emissiveIntensity = 0.2;
    } else {
      mat.emissive = new THREE.Color(0x000000);
      const c = mat.color || new THREE.Color(0x888888);
      mat.color = c.multiplyScalar(0.7);
    }
    mesh.material = mat;
  }

  _applySensorState(mesh, state) {
    const THREE = this._THREE;
    this._restoreMaterial(mesh);

    const val = parseFloat(state.state);
    if (isNaN(val)) return;

    const mat = mesh.material.clone();

    // Color temperature-like mapping: blue (cold) → green (normal) → red (hot)
    const unit = state.attributes?.unit_of_measurement || "";
    let normalizedVal = 0.5;

    if (unit === "°C" || unit === "°F") {
      // Temperature: 15-30°C range
      const tempC = unit === "°F" ? (val - 32) * (5 / 9) : val;
      normalizedVal = Math.max(0, Math.min(1, (tempC - 15) / 15));
    } else if (unit === "%") {
      normalizedVal = Math.max(0, Math.min(1, val / 100));
    } else {
      normalizedVal = 0.5;
    }

    const color = new THREE.Color();
    color.setHSL(0.6 - normalizedVal * 0.6, 0.7, 0.5);
    mat.emissive = color;
    mat.emissiveIntensity = 0.15;
    mesh.material = mat;
  }

  _kelvinToColor(kelvin) {
    const THREE = this._THREE;
    const temp = kelvin / 100;
    let r, g, b;

    if (temp <= 66) {
      r = 255;
      g = Math.max(0, Math.min(255, 99.47 * Math.log(temp) - 161.12));
      b =
        temp <= 19
          ? 0
          : Math.max(0, Math.min(255, 138.52 * Math.log(temp - 10) - 305.04));
    } else {
      r = Math.max(0, Math.min(255, 329.7 * Math.pow(temp - 60, -0.133)));
      g = Math.max(0, Math.min(255, 288.12 * Math.pow(temp - 60, -0.0755)));
      b = 255;
    }

    return new THREE.Color(r / 255, g / 255, b / 255);
  }

  /* ───── Topbar / HUD ───── */

  _updateTopbar() {
    const actions = this.shadowRoot.getElementById("topbar-actions");
    if (!this._modelFilename) {
      actions.innerHTML = "";
      return;
    }

    const editLabel = this._editMode ? "Done Editing" : "Edit Mode";
    const editClass = this._editMode ? "btn-success" : "btn-accent";
    const editIcon = this._editMode
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';

    actions.innerHTML = `
      <button class="btn ${editClass}" id="edit-btn">${editIcon} ${editLabel}</button>
      <button class="btn btn-ghost" id="replace-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Replace Model
      </button>
      <button class="btn btn-danger btn-sm" id="delete-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    `;

    actions.querySelector("#edit-btn").addEventListener("click", () => {
      this._toggleEditMode();
    });

    actions.querySelector("#replace-btn").addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".glb,.gltf";
      input.onchange = (e) => {
        if (e.target.files[0]) this._uploadModel(e.target.files[0]);
      };
      input.click();
    });

    actions.querySelector("#delete-btn").addEventListener("click", async () => {
      if (confirm("Delete the current 3D model and all mappings?")) {
        await this._hass.callWS({ type: "3d_home_dashboard/delete_model" });
        if (this._model) {
          this._scene.remove(this._model);
          this._model = null;
          this._meshList = [];
          this._mappings = {};
        }
        this._lightHelpers.forEach((h) => this._scene.remove(h));
        this._lightHelpers = [];
        this._modelFilename = null;
        this._editMode = false;
        this.shadowRoot.getElementById("side-panel").style.display = "none";
        this.shadowRoot.getElementById("upload-overlay").style.display = "flex";
        this.shadowRoot.getElementById("hud").style.display = "none";
        this._updateTopbar();
      }
    });
  }

  _updateHud() {
    const hud = this.shadowRoot.getElementById("hud");
    if (!this._model) {
      hud.style.display = "none";
      return;
    }
    hud.style.display = "flex";

    const mappingCount = Object.keys(this._mappings).length;
    const meshCount = this._meshList.length;

    hud.innerHTML = `
      <div class="hud-chip"><div class="dot"></div> Model loaded</div>
      <div class="hud-chip">${meshCount} meshes</div>
      <div class="hud-chip">${mappingCount} mapped</div>
    `;
  }

  /* ───── Loading overlay ───── */

  _showLoading(text) {
    const el = this.shadowRoot.getElementById("loading");
    const textEl = this.shadowRoot.getElementById("loading-text");
    if (el) el.style.display = "flex";
    if (textEl) textEl.textContent = text || "Loading…";
  }

  _hideLoading() {
    const el = this.shadowRoot.getElementById("loading");
    if (el) el.style.display = "none";
  }

  /* ───── Utilities ───── */

  _escHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
}

customElements.define("3d-home-dashboard-panel", ThreeDHomeDashboard);
