/**
 * 3D Home Dashboard - Home Assistant Custom Panel
 * v1.5.1 - SH3D only, improved rendering & settings
 */
const THREE_CDN = "https://esm.sh/three@0.162.0";

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
    this._OBJLoader = null;
    this._MTLLoader = null;
    this._OrbitControls = null;
    this._modelType = null;
    this._loaded = false;
    this._wsSubscription = null;
    this._settingsOpen = false;
    this._settings = {
      ambientIntensity: 0.6,
      skyLightIntensity: 0.8,
      sunIntensity: 0.7,
      exposure: 1.0,
      rotateX: 0,
      rotateY: 0,
      rotateZ: 0,
      bgColor: "#1a1a2e",
      groundColor: "#4a7c3f",
      showGrid: true,
      showWireframe: false,
    };
    this._defaultCameraPos = null;
    this._defaultCameraTarget = null;
    this._ambientLight = null;
    this._skyLight = null;
    this._sunLight = null;
    this._gridHelper = null;
    this._skyDome = null;
    this._sunSphere = null;
    this._moonSphere = null;
    this._clouds = [];
    this._groundPlane = null;
  }

  set hass(hass) {
    this._hass = hass;
    if (this._loaded) this._updateEntityStates();
  }

  set panel(panel) { this._panel = panel; }

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
        :host { display:block;width:100%;height:100%;--pc:#03a9f4;--ac:#ff9800;--bg:#1c1c1e;--cb:#2c2c2e;--tc:#f5f5f5;--ts:#a0a0a0;--bc:#3a3a3c;--sc:#4caf50;--dc:#f44336;--wc:#ff9800;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
        * { box-sizing:border-box;margin:0;padding:0; }
        .container { display:flex;flex-direction:column;height:100vh;background:var(--bg);color:var(--tc);overflow:hidden; }
        .topbar { display:flex;align-items:center;justify-content:space-between;padding:12px 20px;background:var(--cb);border-bottom:1px solid var(--bc);z-index:10;min-height:56px; }
        .topbar-left { display:flex;align-items:center;gap:12px; }
        .topbar-title { font-size:18px;font-weight:600; }
        .topbar-right { display:flex;align-items:center;gap:8px; }
        .btn { display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;transition:all 0.2s;white-space:nowrap; }
        .btn svg { width:16px;height:16px; }
        .btn-primary { background:var(--pc);color:white; }
        .btn-primary:hover { background:#0288d1; }
        .btn-accent { background:var(--ac);color:white; }
        .btn-accent:hover { background:#f57c00; }
        .btn-ghost { background:transparent;color:var(--tc);border:1px solid var(--bc); }
        .btn-ghost:hover { background:rgba(255,255,255,0.08); }
        .btn-danger { background:var(--dc);color:white; }
        .btn-danger:hover { background:#d32f2f; }
        .btn-success { background:var(--sc);color:white; }
        .btn-success:hover { background:#388e3c; }
        .btn-sm { padding:6px 12px;font-size:12px; }
        .main { flex:1;display:flex;position:relative;overflow:hidden; }
        .canvas-wrap { flex:1;position:relative;overflow:hidden; }
        .canvas-wrap canvas { display:block;width:100%!important;height:100%!important; }
        .upload-overlay { position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--bg);z-index:5; }
        .upload-area { display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;width:420px;max-width:90%;padding:48px 32px;border:2px dashed var(--bc);border-radius:16px;cursor:pointer;transition:all 0.25s; }
        .upload-area:hover,.upload-area.dragover { border-color:var(--pc);background:rgba(3,169,244,0.05); }
        .upload-area svg { width:56px;height:56px;color:var(--ts); }
        .upload-area h2 { font-size:18px;font-weight:600; }
        .upload-area p { font-size:13px;color:var(--ts);text-align:center; }
        .upload-area input[type="file"] { display:none; }
        .loading-overlay { position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(28,28,30,0.92);z-index:20; }
        .spinner { width:40px;height:40px;border:3px solid var(--bc);border-top-color:var(--pc);border-radius:50%;animation:spin 0.8s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }
        .loading-text { margin-top:14px;font-size:14px;color:var(--ts); }
        .side-panel { width:340px;background:var(--cb);border-left:1px solid var(--bc);display:flex;flex-direction:column;overflow:hidden;animation:slideIn 0.25s ease-out; }
        @keyframes slideIn { from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1} }
        .side-header { padding:16px;border-bottom:1px solid var(--bc); }
        .side-header h3 { font-size:15px;font-weight:600;margin-bottom:4px; }
        .side-header p { font-size:12px;color:var(--ts); }
        .side-body { flex:1;overflow-y:auto;padding:12px; }
        .mesh-item { display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:8px;cursor:pointer;transition:background 0.15s;margin-bottom:2px; }
        .mesh-item:hover { background:rgba(255,255,255,0.05); }
        .mesh-item.selected { background:rgba(3,169,244,0.15); }
        .mesh-item-name { font-size:13px;font-weight:500;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
        .mesh-item-badge { font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(3,169,244,0.2);color:var(--pc);white-space:nowrap; }
        .mesh-item-badge.sensor { background:rgba(76,175,80,0.2);color:var(--sc); }
        .mesh-item-badge.switch { background:rgba(255,152,0,0.2);color:var(--wc); }
        .mapping-card { background:rgba(0,0,0,0.2);border-radius:10px;padding:16px;margin-top:12px;animation:fadeIn 0.2s; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
        .mapping-card h4 { font-size:14px;font-weight:600;margin-bottom:12px;color:var(--pc); }
        .mapping-field { margin-bottom:12px; }
        .mapping-field label { display:block;font-size:12px;color:var(--ts);margin-bottom:4px;font-weight:500; }
        .mapping-field select,.mapping-field input { width:100%;padding:8px 10px;background:var(--bg);color:var(--tc);border:1px solid var(--bc);border-radius:6px;font-size:13px;outline:none;transition:border-color 0.2s; }
        .mapping-field select:focus,.mapping-field input:focus { border-color:var(--pc); }
        .mapping-actions { display:flex;gap:8px;margin-top:8px; }
        .hud { position:absolute;bottom:16px;left:16px;display:flex;gap:8px;z-index:5; }
        .hud-chip { display:flex;align-items:center;gap:6px;padding:6px 12px;background:rgba(44,44,46,0.85);backdrop-filter:blur(10px);border-radius:20px;font-size:12px;color:var(--ts); }
        .hud-chip .dot { width:8px;height:8px;border-radius:50%;background:var(--sc); }
        .hover-tooltip { position:absolute;padding:8px 14px;background:rgba(44,44,46,0.92);backdrop-filter:blur(10px);border-radius:8px;font-size:12px;pointer-events:none;z-index:15;transition:opacity 0.15s;max-width:260px; }
        .hover-tooltip .tt-name { font-weight:600;margin-bottom:2px; }
        .hover-tooltip .tt-entity { color:var(--ts);font-size:11px; }
        .hover-tooltip .tt-state { font-size:11px;margin-top:2px; }
        .settings-panel { position:absolute;top:56px;right:0;width:340px;background:var(--cb);border-left:1px solid var(--bc);border-bottom:1px solid var(--bc);border-radius:0 0 0 12px;z-index:25;padding:16px;overflow-y:auto;max-height:calc(100vh - 80px);animation:fadeIn 0.2s; }
        .settings-panel h3 { font-size:15px;font-weight:600;margin-bottom:16px; }
        .settings-group { margin-bottom:16px; }
        .settings-group h4 { font-size:12px;color:var(--ts);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px; }
        .setting-row { display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px; }
        .setting-row label { font-size:13px;flex-shrink:0;margin-right:12px; }
        .setting-row input[type="range"] { flex:1;accent-color:var(--pc); }
        .setting-row input[type="color"] { width:40px;height:28px;border:1px solid var(--bc);border-radius:4px;background:var(--bg);cursor:pointer; }
        .setting-row input[type="checkbox"] { accent-color:var(--pc); }
        .setting-value { font-size:11px;color:var(--ts);min-width:36px;text-align:right; }
        .setting-row .btn-sm { margin-left:8px; }
        .side-body::-webkit-scrollbar { width:6px; }
        .side-body::-webkit-scrollbar-track { background:transparent; }
        .side-body::-webkit-scrollbar-thumb { background:var(--bc);border-radius:3px; }
        @media(max-width:768px) { .side-panel{width:280px;} .topbar-title{font-size:15px;} .settings-panel{width:280px;} }
      </style>
      <div class="container">
        <div class="topbar">
          <div class="topbar-left">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span class="topbar-title">3D Home Dashboard</span>
          </div>
          <div class="topbar-right" id="topbar-actions"></div>
        </div>
        <div class="main">
          <div class="canvas-wrap" id="canvas-wrap">
            <div class="upload-overlay" id="upload-overlay">
              <div class="upload-area" id="upload-area">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <h2>Upload 3D Model</h2>
                <p>Sweet Home 3D (.sh3d) files supported<br>Drag & drop or click to browse</p>
                <span class="btn btn-primary btn-sm">Choose File</span>
                <input type="file" id="file-input" accept=".sh3d">
              </div>
            </div>
            <div class="loading-overlay" id="loading" style="display:none"><div class="spinner"></div><div class="loading-text" id="loading-text">Loading...</div></div>
            <div class="hud" id="hud" style="display:none"></div>
            <div class="hover-tooltip" id="tooltip" style="display:none"></div>
            <div class="settings-panel" id="settings-panel" style="display:none"></div>
          </div>
          <div class="side-panel" id="side-panel" style="display:none"></div>
        </div>
      </div>`;
    const uploadArea = this.shadowRoot.getElementById("upload-area");
    const fileInput = this.shadowRoot.getElementById("file-input");
    uploadArea.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => { if (e.target.files[0]) this._uploadModel(e.target.files[0]); });
    uploadArea.addEventListener("dragover", (e) => { e.preventDefault(); uploadArea.classList.add("dragover"); });
    uploadArea.addEventListener("dragleave", () => { uploadArea.classList.remove("dragover"); });
    uploadArea.addEventListener("drop", (e) => { e.preventDefault(); uploadArea.classList.remove("dragover"); if (e.dataTransfer.files[0]) this._uploadModel(e.dataTransfer.files[0]); });
  }

  async _loadDependencies() {
    this._showLoading("Loading 3D engine...");
    try {
      const [threeModule, objModule, mtlModule, orbitModule] = await Promise.all([
        import(THREE_CDN),
        import(`${THREE_CDN}/examples/jsm/loaders/OBJLoader`),
        import(`${THREE_CDN}/examples/jsm/loaders/MTLLoader`),
        import(`${THREE_CDN}/examples/jsm/controls/OrbitControls`),
      ]);
      this._THREE = threeModule;
      this._OBJLoader = objModule.OBJLoader;
      this._MTLLoader = mtlModule.MTLLoader;
      this._OrbitControls = orbitModule.OrbitControls;
      this._loaded = true;
      this._hideLoading();
      await this._checkExistingModel();
    } catch (err) {
      console.error("Failed to load Three.js:", err);
      this._showLoading("Failed to load 3D engine. Please refresh.");
    }
  }

  async _checkExistingModel() {
    if (!this._hass) return;
    try {
      await this._loadSettings();
      const result = await this._hass.callWS({ type: "home_3d_dashboard/get_model_info" });
      if (result && result.filename) {
        this._modelFilename = result.filename;
        this._modelType = result.model_type || "sh3d";
        this._objPath = result.obj_path || null;
        await this._loadModelFromServer(result.filename);
        if (this._objPath) await this._loadMappings();
      }
    } catch (err) { console.error("Error checking model:", err); }
  }

  async _uploadModel(file) {
    this._showLoading("Uploading model...");
    const formData = new FormData();
    formData.append("model", file);
    try {
      const token = this._hass?.auth?.data?.access_token || "";
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const resp = await fetch("/api/home_3d_dashboard/upload", {
        method: "POST",
        headers,
        credentials: "same-origin",
        body: formData,
      });
      if (!resp.ok) {
        alert("Upload failed: HTTP " + resp.status + ". Please refresh and try again.");
        this._hideLoading();
        return;
      }
      const data = await resp.json();
      if (data.success) {
        this._modelFilename = data.filename;
        this._modelType = "sh3d";
        this._mappings = {};
        const info = await this._hass.callWS({ type: "home_3d_dashboard/get_model_info" });
        this._objPath = info.obj_path || null;
        await this._loadModelFromServer(data.filename);
      } else {
        alert("Upload failed: " + (data.error || "Unknown error"));
        this._hideLoading();
      }
    } catch (err) { console.error("Upload error:", err); alert("Upload failed: " + err.message); this._hideLoading(); }
  }

  async _loadModelFromServer(filename) {
    this._showLoading("Loading 3D model...");
    const canvasWrap = this.shadowRoot.getElementById("canvas-wrap");
    if (!this._scene) this._initScene(canvasWrap);
    if (this._model) { this._scene.remove(this._model); this._model = null; this._meshList = []; this._originalMaterials.clear(); }
    try {
      if (!this._objPath) {
        this._hideLoading();
        const uploadOv = this.shadowRoot.getElementById("upload-overlay");
        uploadOv.style.display = "flex";
        const ua = this.shadowRoot.getElementById("upload-area");
        ua.querySelector("p").innerHTML = '<span style="color:#f44336;font-weight:600">No OBJ found in .sh3d file</span><br>Please re-upload or delete the model and try again.<br>Sweet Home 3D (.sh3d) files supported';
        this._updateTopbar();
        return;
      }
      const sceneRoot = await this._loadOBJ(`/api/home_3d_dashboard/sh3d/${this._objPath}`, `/api/home_3d_dashboard/sh3d/`);
      this._model = sceneRoot;
      this._scene.add(this._model);
      this._meshList = [];
      let idx = 0;
      this._model.traverse((child) => {
        if (child.isMesh) {
          if (!child.name) child.name = `mesh_${idx++}`;
          this._meshList.push(child);
          this._originalMaterials.set(child.uuid, this._cloneMat(child.material));
        }
      });
      this._applyModelRotation();
      this._fitCameraToModel();
      this._applyLoadedSettings();
      this.shadowRoot.getElementById("upload-overlay").style.display = "none";
      this._hideLoading();
      this._updateTopbar();
      this._updateHud();
      this._updateEntityStates();
    } catch (err) { console.error("Model load error:", err); this._showLoading("Failed to load model: " + (err.message || err)); }
  }

  async _loadOBJ(objUrl, basePath) {
    const THREE = this._THREE;
    const mtlUrl = objUrl.replace(/\.obj$/i, ".mtl");
    let materials = null;
    try {
      const mtlLoader = new this._MTLLoader();
      const mtlDir = mtlUrl.substring(0, mtlUrl.lastIndexOf("/") + 1);
      mtlLoader.setResourcePath(mtlDir);
      materials = await new Promise((res) => { mtlLoader.load(mtlUrl, res, undefined, () => res(null)); });
      if (materials) materials.preload();
    } catch (e) { materials = null; }
    const objLoader = new this._OBJLoader();
    if (materials) objLoader.setMaterials(materials);
    const obj = await new Promise((resolve, reject) => {
      objLoader.load(objUrl, resolve, (p) => { if (p.total > 0) this.shadowRoot.getElementById("loading-text").textContent = `Loading... ${Math.round(p.loaded/p.total*100)}%`; }, reject);
    });
    obj.traverse((c) => {
      if (c.isMesh) {
        const upgradeMat = (m) => {
          if (!m) return new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.7, metalness: 0.1, side: THREE.DoubleSide });
          const sm = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
          if (m.color) sm.color = m.color;
          if (m.map) sm.map = m.map;
          if (m.opacity < 1) { sm.opacity = m.opacity; sm.transparent = true; }
          sm.roughness = m.shininess ? 1.0 - Math.min(m.shininess / 150, 0.85) : 0.7;
          sm.metalness = m.specular ? Math.min((m.specular.r + m.specular.g + m.specular.b) / 3, 0.5) : 0.05;
          return sm;
        };
        if (!materials) {
          c.material = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.7, metalness: 0.1, side: THREE.DoubleSide });
        } else if (Array.isArray(c.material)) {
          c.material = c.material.map(upgradeMat);
        } else {
          c.material = upgradeMat(c.material);
        }
      }
    });
    return obj;
  }

  _initScene(container) {
    const THREE = this._THREE;
    this._scene = new THREE.Scene();
    const bg = new THREE.Color(this._settings.bgColor);
    this._scene.background = bg;

    this._camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.05, 2000);
    this._camera.position.set(8, 12, 8);

    this._renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this._renderer.setSize(container.clientWidth, container.clientHeight);
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.shadowMap.enabled = true;
    this._renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this._renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._renderer.toneMappingExposure = this._settings.exposure;
    this._renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.insertBefore(this._renderer.domElement, container.firstChild);

    this._controls = new this._OrbitControls(this._camera, this._renderer.domElement);
    this._controls.enableDamping = true;
    this._controls.dampingFactor = 0.08;
    this._controls.enablePan = true;
    this._controls.panSpeed = 0.8;
    this._controls.rotateSpeed = 0.6;
    this._controls.zoomSpeed = 1.0;
    this._controls.minDistance = 0.5;
    this._controls.maxDistance = 500;

    this._ambientLight = new THREE.AmbientLight(0xffffff, this._settings.ambientIntensity);
    this._scene.add(this._ambientLight);

    this._skyLight = new THREE.HemisphereLight(0x87CEEB, 0x444422, this._settings.skyLightIntensity);
    this._scene.add(this._skyLight);

    this._sunLight = new THREE.DirectionalLight(0xffffff, this._settings.sunIntensity);
    this._sunLight.position.set(15, 30, 15);
    this._sunLight.castShadow = true;
    this._sunLight.shadow.mapSize.width = 2048;
    this._sunLight.shadow.mapSize.height = 2048;
    this._sunLight.shadow.camera.near = 0.5;
    this._sunLight.shadow.camera.far = 200;
    this._sunLight.shadow.camera.left = -60;
    this._sunLight.shadow.camera.right = 60;
    this._sunLight.shadow.camera.top = 60;
    this._sunLight.shadow.camera.bottom = -60;
    this._scene.add(this._sunLight);

    const fillLight = new THREE.DirectionalLight(0xffeedd, 0.3);
    fillLight.position.set(-10, 8, -10);
    this._scene.add(fillLight);

    this._gridHelper = new THREE.GridHelper(100, 100, 0x333355, 0x222244);
    this._gridHelper.material.opacity = 0.3;
    this._gridHelper.material.transparent = true;
    this._scene.add(this._gridHelper);

    this._buildSkyEnvironment(THREE);

    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();
    this._clock = new THREE.Clock();

    this._renderer.domElement.addEventListener("pointermove", (e) => this._onPointerMove(e));
    this._renderer.domElement.addEventListener("click", (e) => this._onClick(e));

    const ro = new ResizeObserver(() => {
      if (!container.clientWidth || !container.clientHeight) return;
      this._camera.aspect = container.clientWidth / container.clientHeight;
      this._camera.updateProjectionMatrix();
      this._renderer.setSize(container.clientWidth, container.clientHeight);
    });
    ro.observe(container);
    this._animate();
  }

  _fitCameraToModel() {
    const THREE = this._THREE;
    if (!this._model) return;
    if (this._defaultCameraPos && this._defaultCameraTarget) {
      this._camera.position.copy(this._defaultCameraPos);
      this._controls.target.copy(this._defaultCameraTarget);
      this._controls.update();
      return;
    }
    const box = new THREE.Box3().setFromObject(this._model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const diag = Math.sqrt(size.x * size.x + size.y * size.y + size.z * size.z);
    const d = Math.max(diag * 1.4, 8);
    this._camera.position.set(center.x + d * 0.5, center.y + d * 0.9, center.z + d * 0.5);
    this._controls.target.copy(center);
    this._controls.update();
  }

  _setDefaultCamera() {
    this._defaultCameraPos = this._camera.position.clone();
    this._defaultCameraTarget = this._controls.target.clone();
  }

  _clearDefaultCamera() {
    this._defaultCameraPos = null;
    this._defaultCameraTarget = null;
  }

  async _loadSettings() {
    if (!this._hass) return;
    try {
      const saved = await this._hass.callWS({ type: "home_3d_dashboard/get_settings" });
      if (saved && typeof saved === "object") {
        Object.assign(this._settings, saved);
        if (saved.defaultCameraPos && saved.defaultCameraTarget) {
          const THREE = this._THREE;
          if (THREE) {
            this._defaultCameraPos = new THREE.Vector3(saved.defaultCameraPos.x, saved.defaultCameraPos.y, saved.defaultCameraPos.z);
            this._defaultCameraTarget = new THREE.Vector3(saved.defaultCameraTarget.x, saved.defaultCameraTarget.y, saved.defaultCameraTarget.z);
          }
        }
      }
    } catch (err) { console.warn("Failed to load settings:", err); }
  }

  _saveSettings() {
    if (!this._hass) return;
    const s = { ...this._settings };
    if (this._defaultCameraPos) {
      s.defaultCameraPos = { x: this._defaultCameraPos.x, y: this._defaultCameraPos.y, z: this._defaultCameraPos.z };
    }
    if (this._defaultCameraTarget) {
      s.defaultCameraTarget = { x: this._defaultCameraTarget.x, y: this._defaultCameraTarget.y, z: this._defaultCameraTarget.z };
    }
    this._hass.callWS({ type: "home_3d_dashboard/save_settings", settings: s }).catch((err) => console.warn("Failed to save settings:", err));
  }

  _applyLoadedSettings() {
    const s = this._settings;
    if (this._ambientLight) this._ambientLight.intensity = s.ambientIntensity;
    if (this._skyLight) this._skyLight.intensity = s.skyLightIntensity;
    if (this._sunLight) this._sunLight.intensity = s.sunIntensity;
    if (this._renderer) this._renderer.toneMappingExposure = s.exposure;
    if (this._gridHelper) this._gridHelper.visible = s.showGrid;
    if (this._groundPlane) this._groundPlane.material.color.set(s.groundColor || "#4a7c3f");
    if (s.showWireframe) {
      this._meshList.forEach((m) => {
        if (m.material) {
          if (Array.isArray(m.material)) m.material.forEach((mt) => { mt.wireframe = true; });
          else m.material.wireframe = true;
        }
      });
    }
    this._applyWeatherFromEntity();
  }

  _updateGroundColor(hex) {
    this._settings.groundColor = hex;
    if (this._groundPlane) {
      this._groundPlane.material.color.set(hex);
    }
  }

  _buildSkyEnvironment(THREE) {
    // --- Sky dome (large inverted sphere with gradient) ---
    const skyRadius = 500;
    const skyGeo = new THREE.SphereGeometry(skyRadius, 32, 16);
    const skyVertexShader = `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    const skyFragmentShader = `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + offset).y;
        if (h > 0.0) {
          gl_FragColor = vec4(mix(horizonColor, topColor, pow(max(h, 0.0), exponent)), 1.0);
        } else {
          gl_FragColor = vec4(mix(horizonColor, bottomColor, pow(min(-h, 1.0), 0.5)), 1.0);
        }
      }
    `;
    const skyUniforms = {
      topColor: { value: new THREE.Color(0x0077ff) },
      horizonColor: { value: new THREE.Color(0xb0d4f1) },
      bottomColor: { value: new THREE.Color(0x445533) },
      offset: { value: 10 },
      exponent: { value: 0.6 },
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this._skyDome = new THREE.Mesh(skyGeo, skyMat);
    this._skyDome.renderOrder = -1;
    this._scene.add(this._skyDome);
    this._skyUniforms = skyUniforms;

    // Remove flat background color since we have the dome
    this._scene.background = null;

    // --- Ground plane (flat color) ---
    const groundGeo = new THREE.CircleGeometry(skyRadius * 0.8, 64);
    const groundMat = new THREE.MeshStandardMaterial({
      color: this._settings.groundColor || "#4a7c3f",
      roughness: 0.92,
      metalness: 0.0,
    });
    this._groundPlane = new THREE.Mesh(groundGeo, groundMat);
    this._groundPlane.rotation.x = -Math.PI / 2;
    this._groundPlane.position.y = -0.05;
    this._groundPlane.receiveShadow = true;
    this._scene.add(this._groundPlane);

    // --- Sun ---
    const sunGeo = new THREE.SphereGeometry(12, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffee88 });
    this._sunSphere = new THREE.Mesh(sunGeo, sunMat);
    this._sunSphere.position.set(150, 200, -100);
    this._scene.add(this._sunSphere);

    // Sun glow
    const glowGeo = new THREE.SphereGeometry(18, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffdd66,
      transparent: true,
      opacity: 0.2,
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    this._sunSphere.add(glowMesh);

    // --- Moon ---
    const moonGeo = new THREE.SphereGeometry(8, 16, 16);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xddeeff });
    this._moonSphere = new THREE.Mesh(moonGeo, moonMat);
    this._moonSphere.position.set(-150, -100, 100);
    this._moonSphere.visible = false;
    this._scene.add(this._moonSphere);

    // --- Clouds ---
    this._clouds = [];
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    for (let i = 0; i < 15; i++) {
      const cGroup = new THREE.Group();
      const puffCount = 3 + Math.floor(Math.random() * 4);
      for (let j = 0; j < puffCount; j++) {
        const r = 3 + Math.random() * 5;
        const puffGeo = new THREE.SphereGeometry(r, 8, 6);
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        puff.position.set(
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.3) * 3,
          (Math.random() - 0.5) * 6
        );
        puff.scale.y = 0.4 + Math.random() * 0.3;
        cGroup.add(puff);
      }
      const dist = 80 + Math.random() * 200;
      const angle = Math.random() * Math.PI * 2;
      cGroup.position.set(
        Math.cos(angle) * dist,
        60 + Math.random() * 80,
        Math.sin(angle) * dist
      );
      cGroup.userData.speed = 0.02 + Math.random() * 0.05;
      cGroup.userData.angle = angle;
      cGroup.userData.dist = dist;
      this._scene.add(cGroup);
      this._clouds.push(cGroup);
    }
  }

  _updateSkyForWeather(condition) {
    // condition: "sunny", "cloudy", "rainy", "night", "clear-night"
    if (!this._skyUniforms) return;
    const THREE = this._THREE;
    const u = this._skyUniforms;
    if (condition === "night" || condition === "clear-night") {
      u.topColor.value.set(0x0a0a2e);
      u.horizonColor.value.set(0x1a1a3e);
      u.bottomColor.value.set(0x111122);
      if (this._sunSphere) this._sunSphere.visible = false;
      if (this._moonSphere) { this._moonSphere.visible = true; this._moonSphere.position.set(100, 180, -80); }
      this._clouds.forEach((c) => c.children.forEach((p) => { p.material.opacity = 0.15; }));
      this._updateGroundColor("#1a2e1a");
    } else if (condition === "cloudy" || condition === "rainy") {
      u.topColor.value.set(0x667788);
      u.horizonColor.value.set(0x99aabb);
      u.bottomColor.value.set(0x445544);
      if (this._sunSphere) this._sunSphere.visible = false;
      if (this._moonSphere) this._moonSphere.visible = false;
      const opacity = condition === "rainy" ? 0.9 : 0.8;
      this._clouds.forEach((c) => c.children.forEach((p) => { p.material.opacity = opacity; p.material.color.set(condition === "rainy" ? 0x888888 : 0xcccccc); }));
      this._updateGroundColor(condition === "rainy" ? "#3a5a3a" : "#4a7c3f");
    } else {
      // sunny / default
      u.topColor.value.set(0x0077ff);
      u.horizonColor.value.set(0xb0d4f1);
      u.bottomColor.value.set(0x445533);
      if (this._sunSphere) { this._sunSphere.visible = true; this._sunSphere.position.set(150, 200, -100); }
      if (this._moonSphere) this._moonSphere.visible = false;
      this._clouds.forEach((c) => c.children.forEach((p) => { p.material.opacity = 0.7; p.material.color.set(0xffffff); }));
      this._updateGroundColor(this._settings.groundColor || "#4a7c3f");
    }
  }

  _applyModelRotation() {
    if (!this._model) return;
    const deg = Math.PI / 180;
    this._model.rotation.set(
      this._settings.rotateX * deg,
      this._settings.rotateY * deg,
      this._settings.rotateZ * deg
    );
  }

  _animate() {
    this._animationId = requestAnimationFrame(() => this._animate());
    if (this._controls) this._controls.update();
    // Drift clouds slowly
    for (const c of this._clouds) {
      c.userData.angle += c.userData.speed * 0.002;
      c.position.x = Math.cos(c.userData.angle) * c.userData.dist;
      c.position.z = Math.sin(c.userData.angle) * c.userData.dist;
    }
    // Keep sky dome centered on camera
    if (this._skyDome && this._camera) {
      this._skyDome.position.copy(this._camera.position);
    }
    if (this._renderer && this._scene && this._camera) this._renderer.render(this._scene, this._camera);
  }

  _getIntersects(event) {
    const rect = this._renderer.domElement.getBoundingClientRect();
    this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._mouse, this._camera);
    return this._raycaster.intersectObjects(this._meshList, false);
  }

  _onPointerMove(event) {
    if (!this._model) return;
    const intersects = this._getIntersects(event);
    const tooltip = this.shadowRoot.getElementById("tooltip");
    if (this._hoveredMesh && this._hoveredMesh !== this._selectedMesh) this._restoreMaterial(this._hoveredMesh);
    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      this._hoveredMesh = mesh;
      if (mesh !== this._selectedMesh) this._highlightMesh(mesh, 0x03a9f4, 0.15);
      this._renderer.domElement.style.cursor = "pointer";
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
            const sc = state.state === "on" ? "#4caf50" : "#f44336";
            const bri = state.attributes?.brightness ? ` - ${Math.round(state.attributes.brightness/255*100)}%` : "";
            const unit = state.attributes?.unit_of_measurement ? ` ${state.state} ${state.attributes.unit_of_measurement}` : "";
            html += `<div class="tt-state" style="color:${sc}">${state.state}${bri}${unit}</div>`;
          }
        }
        tooltip.innerHTML = html;
      } else { tooltip.style.display = "none"; }
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
      this._selectMesh(intersects[0].object);
    } else if (!this._editMode && intersects.length > 0) {
      const mesh = intersects[0].object;
      const mapping = this._findMappingForMesh(mesh.name);
      if (mapping && this._hass) {
        const state = this._hass.states[mapping.entity_id];
        if (state) {
          const domain = mapping.entity_id.split(".")[0];
          if (domain === "light" || domain === "switch") this._hass.callService(domain, "toggle", { entity_id: mapping.entity_id });
        }
      }
    }
  }

  _cloneMat(mat) {
    if (!mat) return mat;
    if (Array.isArray(mat)) return mat.map((m) => m.clone ? m.clone() : m);
    return mat.clone ? mat.clone() : mat;
  }

  _applyToMat(mat, fn) {
    if (Array.isArray(mat)) { mat.forEach(fn); } else if (mat) { fn(mat); }
  }

  _highlightMesh(mesh, color, intensity) {
    if (!mesh.material) return;
    const mat = this._cloneMat(mesh.material);
    this._applyToMat(mat, (m) => { m.emissive = new this._THREE.Color(color); m.emissiveIntensity = intensity; });
    mesh.material = mat;
  }

  _restoreMaterial(mesh) {
    const orig = this._originalMaterials.get(mesh.uuid);
    if (orig) mesh.material = this._cloneMat(orig);
  }

  _toggleEditMode() {
    this._editMode = !this._editMode;
    this._selectedMesh = null;
    if (!this._editMode) {
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
    if (this._selectedMesh) this._restoreMaterial(this._selectedMesh);
    this._selectedMesh = mesh;
    this._highlightMesh(mesh, 0xff9800, 0.35);
    this._renderSidePanel();
    const el = this.shadowRoot.querySelector(`[data-mesh-name="${CSS.escape(mesh.name)}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  _renderSidePanel() {
    const panel = this.shadowRoot.getElementById("side-panel");
    const selected = this._selectedMesh;
    let meshListHTML = this._meshList.map((m) => {
      const mapping = this._findMappingForMesh(m.name);
      const isSel = selected && selected.name === m.name;
      let badge = "";
      if (mapping) {
        const dom = mapping.entity_id.split(".")[0];
        const cls = dom === "sensor" ? "sensor" : dom === "switch" ? "switch" : "";
        badge = `<span class="mesh-item-badge ${cls}">${mapping.entity_id.split(".")[1]}</span>`;
      }
      return `<div class="mesh-item ${isSel ? "selected" : ""}" data-mesh-name="${this._escHtml(m.name)}"><span class="mesh-item-name">${this._escHtml(m.name || "Unnamed")}</span>${badge}</div>`;
    }).join("");
    let mcHTML = "";
    if (selected) {
      const mapping = this._findMappingForMesh(selected.name) || {};
      const eid = mapping.entity_id || "";
      const domains = ["light", "switch", "sensor"];
      let opts = '<option value="">-- Select Entity --</option>';
      for (const dom of domains) {
        const ents = Object.keys(this._hass?.states || {}).filter((e) => e.startsWith(dom + "."));
        if (ents.length > 0) {
          opts += `<optgroup label="${dom.charAt(0).toUpperCase()+dom.slice(1)}s">`;
          ents.forEach((e) => { const n = this._hass.states[e].attributes.friendly_name || e; opts += `<option value="${e}" ${e===eid?"selected":""}>${n} (${e})</option>`; });
          opts += "</optgroup>";
        }
      }
      mcHTML = `<div class="mapping-card"><h4>Map: ${this._escHtml(selected.name||"Unnamed")}</h4><div class="mapping-field"><label>Entity</label><select id="entity-select">${opts}</select></div><div class="mapping-actions"><button class="btn btn-success btn-sm" id="save-mapping-btn">Save</button>${eid?'<button class="btn btn-danger btn-sm" id="remove-mapping-btn">Remove</button>':""}</div></div>`;
    }
    panel.innerHTML = `<div class="side-header"><h3>Edit Mode</h3><p>Click a mesh in the 3D view or list below to map entities</p></div><div class="side-body">${meshListHTML}${mcHTML}</div>`;
    panel.querySelectorAll(".mesh-item").forEach((el) => { el.addEventListener("click", () => { const mesh = this._meshList.find((m) => m.name === el.dataset.meshName); if (mesh) this._selectMesh(mesh); }); });
    const saveBtn = panel.querySelector("#save-mapping-btn");
    if (saveBtn) saveBtn.addEventListener("click", () => this._saveMappingFromUI());
    const removeBtn = panel.querySelector("#remove-mapping-btn");
    if (removeBtn) removeBtn.addEventListener("click", () => this._removeMapping());
  }

  _saveMappingFromUI() {
    if (!this._selectedMesh) return;
    const select = this.shadowRoot.getElementById("entity-select");
    if (!select || !select.value) return;
    const entityId = select.value;
    const domain = entityId.split(".")[0];
    this._mappings[this._selectedMesh.name] = { entity_id: entityId, entity_type: domain, mesh_name: this._selectedMesh.name };
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

  async _loadMappings() {
    try {
      const result = await this._hass.callWS({ type: "home_3d_dashboard/get_mappings" });
      this._mappings = result || {};
      this._updateEntityStates();
      this._updateHud();
    } catch (err) { console.error("Failed to load mappings:", err); }
  }

  async _saveMappingsToServer() {
    try { await this._hass.callWS({ type: "home_3d_dashboard/save_mappings", mappings: this._mappings }); }
    catch (err) { console.error("Failed to save mappings:", err); }
  }

  _findMappingForMesh(meshName) { return this._mappings[meshName] || null; }

  _updateEntityStates() {
    if (!this._hass || !this._model || this._editMode) return;
    const THREE = this._THREE;
    this._lightHelpers.forEach((h) => this._scene.remove(h));
    this._lightHelpers = [];
    for (const [meshName, mapping] of Object.entries(this._mappings)) {
      const mesh = this._meshList.find((m) => m.name === meshName);
      if (!mesh) continue;
      const state = this._hass.states[mapping.entity_id];
      if (!state) continue;
      const domain = mapping.entity_type || mapping.entity_id.split(".")[0];
      if (domain === "light") this._applyLightState(mesh, state);
      else if (domain === "switch") this._applySwitchState(mesh, state);
      else if (domain === "sensor") this._applySensorState(mesh, state);
    }
    this._applyWeatherFromEntity();
  }

  _applyWeatherFromEntity() {
    const eid = this._settings.weatherEntity;
    if (!eid || !this._hass?.states?.[eid]) {
      this._updateSkyForWeather("sunny");
      return;
    }
    const st = this._hass.states[eid].state;
    const map = {
      "sunny": "sunny",
      "clear-night": "clear-night",
      "partlycloudy": "cloudy",
      "cloudy": "cloudy",
      "fog": "cloudy",
      "rainy": "rainy",
      "pouring": "rainy",
      "snowy": "rainy",
      "snowy-rainy": "rainy",
      "hail": "rainy",
      "lightning": "rainy",
      "lightning-rainy": "rainy",
      "windy": "sunny",
      "windy-variant": "cloudy",
      "exceptional": "cloudy",
    };
    this._updateSkyForWeather(map[st] || (st.includes("night") ? "night" : "sunny"));
  }

  _applyLightState(mesh, state) {
    const THREE = this._THREE;
    const isOn = state.state === "on";
    const bri = (state.attributes?.brightness || 255) / 255;
    this._restoreMaterial(mesh);
    if (isOn) {
      const mat = this._cloneMat(mesh.material);
      let lc = new THREE.Color(0xffdd88);
      if (state.attributes?.rgb_color) { const [r,g,b] = state.attributes.rgb_color; lc = new THREE.Color(r/255,g/255,b/255); }
      else if (state.attributes?.color_temp_kelvin) lc = this._kelvinToColor(state.attributes.color_temp_kelvin);
      this._applyToMat(mat, (m) => { m.emissive = lc; m.emissiveIntensity = 0.2 + bri * 0.6; });
      mesh.material = mat;
      const box = new THREE.Box3().setFromObject(mesh);
      const center = box.getCenter(new THREE.Vector3());
      const pl = new THREE.PointLight(lc, bri * 2, 10);
      pl.position.copy(center);
      this._scene.add(pl);
      this._lightHelpers.push(pl);
    } else {
      const mat = this._cloneMat(mesh.material);
      this._applyToMat(mat, (m) => { m.emissive = new THREE.Color(0x000000); m.emissiveIntensity = 0; });
      mesh.material = mat;
    }
  }

  _applySwitchState(mesh, state) {
    const THREE = this._THREE;
    this._restoreMaterial(mesh);
    const mat = this._cloneMat(mesh.material);
    if (state.state === "on") { this._applyToMat(mat, (m) => { m.emissive = new THREE.Color(0x4caf50); m.emissiveIntensity = 0.2; }); }
    else { this._applyToMat(mat, (m) => { m.emissive = new THREE.Color(0x000000); }); }
    mesh.material = mat;
  }

  _applySensorState(mesh, state) {
    const THREE = this._THREE;
    this._restoreMaterial(mesh);
    const val = parseFloat(state.state);
    if (isNaN(val)) return;
    const mat = this._cloneMat(mesh.material);
    const unit = state.attributes?.unit_of_measurement || "";
    let nv = 0.5;
    if (unit === "\u00b0C" || unit === "\u00b0F") { const tc = unit === "\u00b0F" ? (val-32)*5/9 : val; nv = Math.max(0, Math.min(1, (tc-15)/15)); }
    else if (unit === "%") nv = Math.max(0, Math.min(1, val/100));
    const color = new THREE.Color();
    color.setHSL(0.6 - nv * 0.6, 0.7, 0.5);
    this._applyToMat(mat, (m) => { m.emissive = color; m.emissiveIntensity = 0.15; });
    mesh.material = mat;
  }

  _kelvinToColor(kelvin) {
    const t = kelvin / 100;
    let r, g, b; if (t <= 66) { r = 255; g = Math.max(0, Math.min(255, 99.47*Math.log(t)-161.12)); b = t <= 19 ? 0 : Math.max(0, Math.min(255, 138.52*Math.log(t-10)-305.04)); }
    else { r = Math.max(0, Math.min(255, 329.7*Math.pow(t-60,-0.133))); g = Math.max(0, Math.min(255, 288.12*Math.pow(t-60,-0.0755))); b = 255; }
    return new this._THREE.Color(r/255, g/255, b/255);
  }

  _toggleSettings() {
    this._settingsOpen = !this._settingsOpen;
    const sp = this.shadowRoot.getElementById("settings-panel");
    if (this._settingsOpen) {
      this._renderSettings();
      sp.style.display = "block";
    } else {
      sp.style.display = "none";
    }
  }

  _renderSettings() {
    const sp = this.shadowRoot.getElementById("settings-panel");
    const s = this._settings;
    sp.innerHTML = `
      <h3>Scene Settings</h3>
      <div class="settings-group">
        <h4>Lighting</h4>
        <div class="setting-row">
          <label>Ambient</label>
          <input type="range" min="0" max="2" step="0.05" value="${s.ambientIntensity}" id="s-ambient">
          <span class="setting-value">${s.ambientIntensity.toFixed(2)}</span>
        </div>
        <div class="setting-row">
          <label>Sky Light</label>
          <input type="range" min="0" max="2" step="0.05" value="${s.skyLightIntensity}" id="s-sky">
          <span class="setting-value">${s.skyLightIntensity.toFixed(2)}</span>
        </div>
        <div class="setting-row">
          <label>Sun</label>
          <input type="range" min="0" max="3" step="0.05" value="${s.sunIntensity}" id="s-sun">
          <span class="setting-value">${s.sunIntensity.toFixed(2)}</span>
        </div>
        <div class="setting-row">
          <label>Exposure</label>
          <input type="range" min="0.1" max="3" step="0.05" value="${s.exposure}" id="s-exposure">
          <span class="setting-value">${s.exposure.toFixed(2)}</span>
        </div>
      </div>
      <div class="settings-group">
        <h4>Camera</h4>
        <div class="setting-row">
          <button class="btn btn-primary btn-sm" id="s-recenter">Re-center Camera</button>
          <button class="btn btn-accent btn-sm" id="s-setdefault">Set as Default</button>
          ${this._defaultCameraPos ? '<button class="btn btn-danger btn-sm" id="s-cleardefault">Clear Default</button>' : ''}
        </div>
      </div>
      <div class="settings-group">
        <h4>Weather Entity</h4>
        <div class="setting-row">
          <select id="s-weather" style="flex:1;padding:6px 8px;background:var(--bg);color:var(--tc);border:1px solid var(--bc);border-radius:6px;font-size:12px;">
            <option value="">-- None (sunny default) --</option>
            ${Object.keys(this._hass?.states || {}).filter((e) => e.startsWith("weather.")).map((e) => {
              const n = this._hass.states[e].attributes.friendly_name || e;
              return `<option value="${e}" ${e === (s.weatherEntity || "") ? "selected" : ""}>${n}</option>`;
            }).join("")}
          </select>
        </div>
        <div class="setting-row">
          <span class="setting-value" style="min-width:auto">${s.weatherEntity ? (this._hass?.states?.[s.weatherEntity]?.state || "unknown") : "sunny"}</span>
        </div>
      </div>
      <div class="settings-group">
        <h4>Display</h4>
        <div class="setting-row">
          <label>Ground Color</label>
          <input type="color" value="${s.groundColor}" id="s-ground-color">
        </div>
        <div class="setting-row">
          <label>Show Grid</label>
          <input type="checkbox" ${s.showGrid ? "checked" : ""} id="s-grid">
        </div>
        <div class="setting-row">
          <label>Wireframe</label>
          <input type="checkbox" ${s.showWireframe ? "checked" : ""} id="s-wire">
        </div>
      </div>`;

    const bindSlider = (id, key, applyFn) => {
      const el = sp.querySelector(`#${id}`);
      if (el) el.addEventListener("input", (e) => {
        s[key] = parseFloat(e.target.value);
        e.target.nextElementSibling.textContent = key.startsWith("rotate") ? `${s[key]}\u00b0` : s[key].toFixed(2);
        applyFn();
        this._saveSettings();
      });
    };

    bindSlider("s-ambient", "ambientIntensity", () => { if (this._ambientLight) this._ambientLight.intensity = s.ambientIntensity; });
    bindSlider("s-sky", "skyLightIntensity", () => { if (this._skyLight) this._skyLight.intensity = s.skyLightIntensity; });
    bindSlider("s-sun", "sunIntensity", () => { if (this._sunLight) this._sunLight.intensity = s.sunIntensity; });
    bindSlider("s-exposure", "exposure", () => { if (this._renderer) this._renderer.toneMappingExposure = s.exposure; });

    const recenterBtn = sp.querySelector("#s-recenter");
    if (recenterBtn) recenterBtn.addEventListener("click", () => this._fitCameraToModel());
    const setDefaultBtn = sp.querySelector("#s-setdefault");
    if (setDefaultBtn) setDefaultBtn.addEventListener("click", () => { this._setDefaultCamera(); this._saveSettings(); this._renderSettings(); });
    const clearDefaultBtn = sp.querySelector("#s-cleardefault");
    if (clearDefaultBtn) clearDefaultBtn.addEventListener("click", () => { this._clearDefaultCamera(); this._saveSettings(); this._renderSettings(); });
    const weatherSelect = sp.querySelector("#s-weather");
    if (weatherSelect) weatherSelect.addEventListener("change", (e) => {
      s.weatherEntity = e.target.value || "";
      this._applyWeatherFromEntity();
      this._saveSettings();
      this._renderSettings();
    });

    const groundColorInput = sp.querySelector("#s-ground-color");
    if (groundColorInput) groundColorInput.addEventListener("input", (e) => {
      this._updateGroundColor(e.target.value);
      this._saveSettings();
    });

    const gridCb = sp.querySelector("#s-grid");
    if (gridCb) gridCb.addEventListener("change", (e) => {
      s.showGrid = e.target.checked;
      if (this._gridHelper) this._gridHelper.visible = s.showGrid;
      this._saveSettings();
    });

    const wireCb = sp.querySelector("#s-wire");
    if (wireCb) wireCb.addEventListener("change", (e) => {
      s.showWireframe = e.target.checked;
      this._meshList.forEach((m) => {
        if (m.material) {
          if (Array.isArray(m.material)) m.material.forEach((mt) => { mt.wireframe = s.showWireframe; });
          else m.material.wireframe = s.showWireframe;
        }
      });
      this._saveSettings();
    });
  }

  _updateTopbar() {
    const actions = this.shadowRoot.getElementById("topbar-actions");
    if (!this._modelFilename) { actions.innerHTML = ""; return; }
    const eL = this._editMode ? "Done Editing" : "Edit Mode";
    const eC = this._editMode ? "btn-success" : "btn-accent";
    const eI = this._editMode ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    const sI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
    actions.innerHTML = `<button class="btn ${eC}" id="edit-btn">${eI} ${eL}</button><button class="btn btn-ghost" id="settings-btn">${sI} Settings</button><button class="btn btn-ghost" id="replace-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Replace</button><button class="btn btn-danger btn-sm" id="delete-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>`;
    actions.querySelector("#edit-btn").addEventListener("click", () => this._toggleEditMode());
    actions.querySelector("#settings-btn").addEventListener("click", () => this._toggleSettings());
    actions.querySelector("#replace-btn").addEventListener("click", () => { const input = document.createElement("input"); input.type = "file"; input.accept = ".sh3d"; input.onchange = (e) => { if (e.target.files[0]) this._uploadModel(e.target.files[0]); }; input.click(); });
    actions.querySelector("#delete-btn").addEventListener("click", async () => {
      if (confirm("Delete the current 3D model and all mappings?")) {
        await this._hass.callWS({ type: "home_3d_dashboard/delete_model" });
        if (this._model) { this._scene.remove(this._model); this._model = null; this._meshList = []; this._mappings = {}; }
        this._lightHelpers.forEach((h) => this._scene.remove(h));
        this._lightHelpers = [];
        this._modelFilename = null;
        this._editMode = false;
        this.shadowRoot.getElementById("side-panel").style.display = "none";
        this.shadowRoot.getElementById("settings-panel").style.display = "none";
        this._settingsOpen = false;
        this.shadowRoot.getElementById("upload-overlay").style.display = "flex";
        this.shadowRoot.getElementById("hud").style.display = "none";
        this._updateTopbar();
      }
    });
  }

  _updateHud() {
    const hud = this.shadowRoot.getElementById("hud");
    if (!this._model) { hud.style.display = "none"; return; }
    hud.style.display = "flex";
    const mc = Object.keys(this._mappings).length;
    const ms = this._meshList.length;
    hud.innerHTML = `<div class="hud-chip"><div class="dot"></div> Model loaded</div><div class="hud-chip">${ms} meshes</div><div class="hud-chip">${mc} mapped</div>`;
  }

  _showLoading(text) { const el = this.shadowRoot.getElementById("loading"); const t = this.shadowRoot.getElementById("loading-text"); if (el) el.style.display = "flex"; if (t) t.textContent = text || "Loading..."; }
  _hideLoading() { const el = this.shadowRoot.getElementById("loading"); if (el) el.style.display = "none"; }
  _escHtml(str) { const div = document.createElement("div"); div.textContent = str; return div.innerHTML; }
}

customElements.define("home-3d-dashboard-panel", ThreeDHomeDashboard);
