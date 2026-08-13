(function initHHCharacter3DAvatarRuntime(global) {
  "use strict";

  const QUALITY_PROFILES = Object.freeze({
    cinematic: Object.freeze({ label: "Điện ảnh", pixelRatio: 2, shadows: true, shadowSize: 2048, antialias: true, physicsSteps: 2, targetFps: 55 }),
    balanced: Object.freeze({ label: "Cân bằng", pixelRatio: 1.5, shadows: true, shadowSize: 1024, antialias: true, physicsSteps: 1, targetFps: 45 }),
    mobile: Object.freeze({ label: "Mobile", pixelRatio: 1, shadows: false, shadowSize: 512, antialias: false, physicsSteps: 1, targetFps: 30 }),
    static: Object.freeze({ label: "Tĩnh", pixelRatio: 1, shadows: false, shadowSize: 512, antialias: false, physicsSteps: 0, targetFps: 1 })
  });
  const CAMERA_PRESETS = Object.freeze({
    full: { position: [0, 1.12, 3.45], target: [0, 1.05, 0] },
    half: { position: [0, 1.38, 2.15], target: [0, 1.32, 0] },
    face: { position: [0, 1.65, 1.15], target: [0, 1.63, 0] },
    reset: { position: [0, 1.12, 3.45], target: [0, 1.05, 0] }
  });
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const canWebGL = () => {
    try { const canvas = document.createElement("canvas"); return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl")); }
    catch (_) { return false; }
  };

  class MiniOrbitControls {
    constructor(camera, domElement, THREE, target) {
      this.camera = camera;
      this.domElement = domElement;
      this.THREE = THREE;
      this.target = target || new THREE.Vector3(0, 1.05, 0);
      this.enabled = true;
      this.minDistance = 0.65;
      this.maxDistance = 8;
      this.minPolarAngle = 0.2;
      this.maxPolarAngle = Math.PI - 0.2;
      this.rotateSpeed = 0.006;
      this.panSpeed = 0.0022;
      this.zoomSpeed = 0.0015;
      this.pointer = null;
      this.mode = "rotate";
      this.spherical = new THREE.Spherical();
      this.offset = new THREE.Vector3();
      this.pan = new THREE.Vector3();
      this.changed = true;
      this.handlers = {
        pointerdown: (event) => this.onPointerDown(event), pointermove: (event) => this.onPointerMove(event), pointerup: (event) => this.onPointerUp(event),
        wheel: (event) => this.onWheel(event), contextmenu: (event) => event.preventDefault()
      };
      Object.entries(this.handlers).forEach(([type, handler]) => domElement.addEventListener(type, handler, type === "wheel" ? { passive: false } : undefined));
      this.syncFromCamera();
    }

    syncFromCamera() {
      this.offset.copy(this.camera.position).sub(this.target);
      this.spherical.setFromVector3(this.offset);
      this.spherical.radius = clamp(this.spherical.radius, this.minDistance, this.maxDistance);
      this.changed = true;
    }

    onPointerDown(event) {
      if (!this.enabled || event.button > 2) return;
      this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      this.mode = event.button === 2 || event.button === 1 || event.shiftKey ? "pan" : "rotate";
      this.domElement.setPointerCapture?.(event.pointerId);
    }

    onPointerMove(event) {
      if (!this.enabled || !this.pointer || event.pointerId !== this.pointer.id) return;
      const dx = event.clientX - this.pointer.x;
      const dy = event.clientY - this.pointer.y;
      this.pointer.x = event.clientX; this.pointer.y = event.clientY;
      if (this.mode === "pan") {
        const scale = this.spherical.radius * this.panSpeed;
        const right = new this.THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
        const up = new this.THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
        this.target.addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale);
      } else {
        this.spherical.theta -= dx * this.rotateSpeed;
        this.spherical.phi = clamp(this.spherical.phi - dy * this.rotateSpeed, this.minPolarAngle, this.maxPolarAngle);
      }
      this.changed = true;
    }

    onPointerUp(event) {
      if (this.pointer?.id !== event.pointerId) return;
      this.domElement.releasePointerCapture?.(event.pointerId);
      this.pointer = null;
    }

    onWheel(event) {
      if (!this.enabled) return;
      event.preventDefault();
      if (this.camera.isOrthographicCamera) {
        this.camera.zoom = clamp(this.camera.zoom * Math.exp(-event.deltaY * this.zoomSpeed), 0.35, 7);
        this.camera.updateProjectionMatrix();
      } else this.spherical.radius = clamp(this.spherical.radius * Math.exp(event.deltaY * this.zoomSpeed), this.minDistance, this.maxDistance);
      this.changed = true;
    }

    update() {
      if (!this.changed) return false;
      this.offset.setFromSpherical(this.spherical);
      this.camera.position.copy(this.target).add(this.offset);
      this.camera.lookAt(this.target);
      this.changed = false;
      return true;
    }

    dispose() {
      Object.entries(this.handlers).forEach(([type, handler]) => this.domElement.removeEventListener(type, handler));
      this.pointer = null;
    }
  }

  class AvatarRuntime {
    constructor(container, options = {}) {
      if (!container?.appendChild) throw new TypeError("AvatarRuntime requires a DOM container.");
      this.container = container;
      this.options = options;
      this.quality = QUALITY_PROFILES[options.quality] ? options.quality : "balanced";
      this.transparent = options.transparent !== false;
      this.background = options.background || "#070a12";
      this.projection = options.projection === "orthographic" ? "orthographic" : "perspective";
      this.THREE = options.THREE || null;
      this.renderer = null;
      this.scene = null;
      this.camera = null;
      this.cameras = {};
      this.controls = null;
      this.modelRoot = null;
      this.prototypeRoot = null;
      this.stageRoot = null;
      this.grid = null;
      this.lights = {};
      this.animationController = null;
      this.expressionController = null;
      this.springBoneManager = null;
      this.physicsEnabled = options.physicsEnabled !== false;
      this.frame = 0;
      this.lastFrame = 0;
      this.running = false;
      this.paused = false;
      this.contextLost = false;
      this.disposed = false;
      this.reducedMotion = Boolean(options.reducedMotion ?? global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
      this.fpsSamples = [];
      this.fps = 0;
      this.lowFpsSeconds = 0;
      this.autoQuality = options.autoQuality !== false;
      this.lastQualityChange = 0;
      this.listeners = new Map();
      this.lookTarget = { x: 0, y: 0 };
      this.clockSeconds = 0;
      this.visibilityHandler = () => this.setPaused(document.hidden, "visibility");
      this.resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => this.resize()) : null;
      this.resizeHandler = () => this.resize();
      this.contextHandlers = {
        lost: (event) => { event.preventDefault(); this.contextLost = true; this.resumeAfterContextRestore = this.running && !this.paused; this.stop(); this.emit("contextlost", {}); },
        restored: () => { this.contextLost = false; this.resize(); this.render(); if (this.resumeAfterContextRestore) this.start(); this.resumeAfterContextRestore = false; this.emit("contextrestored", {}); }
      };
    }

    async init() {
      if (this.renderer) return this;
      if (!canWebGL()) throw new Error("WebGL không khả dụng; hãy dùng ảnh 2D dự phòng.");
      this.THREE ||= await import("../../vendor/three.module.min.js");
      const THREE = this.THREE;
      const profile = QUALITY_PROFILES[this.quality];
      this.renderer = new THREE.WebGLRenderer({ antialias: profile.antialias, alpha: true, powerPreference: this.quality === "mobile" ? "low-power" : "high-performance", preserveDrawingBuffer: true });
      this.renderer.domElement.className = "character-3d-canvas";
      this.renderer.domElement.setAttribute("aria-label", "Viewport nhân vật 3D tương tác");
      this.renderer.domElement.tabIndex = 0;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = this.quality === "cinematic" ? 1.08 : 1;
      this.renderer.setClearColor(this.background, this.transparent ? 0 : 1);
      this.container.replaceChildren(this.renderer.domElement);
      this.scene = new THREE.Scene();
      this.scene.userData.hhCharacterRuntime = true;
      this.stageRoot = new THREE.Group(); this.stageRoot.name = "HH Character 3D Stage"; this.scene.add(this.stageRoot);
      this.createCameras();
      this.createStage();
      this.prototypeRoot = new THREE.Group();
      this.prototypeRoot.name = "Astra H-08 build pending";
      this.prototypeRoot.userData = { buildPending: true, assetId: "astra-h08-concept-sheet-v1" };
      this.setModel(this.prototypeRoot, { ownedPrototype: true, disposePrevious: false, fit: false });
      this.controls = new MiniOrbitControls(this.camera, this.renderer.domElement, THREE, new THREE.Vector3(...CAMERA_PRESETS.full.target));
      this.applyQuality(this.quality, { restart: false });
      this.resize();
      document.addEventListener("visibilitychange", this.visibilityHandler);
      global.addEventListener?.("resize", this.resizeHandler, { passive: true });
      this.resizeObserver?.observe(this.container);
      this.renderer.domElement.addEventListener("webglcontextlost", this.contextHandlers.lost, false);
      this.renderer.domElement.addEventListener("webglcontextrestored", this.contextHandlers.restored, false);
      this.disposed = false;
      this.start();
      this.emit("ready", this.diagnostics());
      return this;
    }

    createCameras() {
      const THREE = this.THREE;
      const aspect = Math.max(0.1, this.container.clientWidth / Math.max(1, this.container.clientHeight));
      this.cameras.perspective = new THREE.PerspectiveCamera(34, aspect, 0.01, 100);
      this.cameras.orthographic = new THREE.OrthographicCamera(-aspect * 1.3, aspect * 1.3, 1.3, -1.3, 0.01, 100);
      Object.values(this.cameras).forEach((camera) => { camera.position.set(...CAMERA_PRESETS.full.position); camera.lookAt(...CAMERA_PRESETS.full.target); });
      this.camera = this.cameras[this.projection];
    }

    createStage() {
      const THREE = this.THREE;
      const ambient = new THREE.HemisphereLight(0xb9dcff, 0x160d2c, 1.25);
      const key = new THREE.DirectionalLight(0xfff2df, 3.2); key.position.set(2.8, 4, 3); key.castShadow = true;
      const fill = new THREE.DirectionalLight(0x55dfff, 1.55); fill.position.set(-3, 2.2, 2.2);
      const rim = new THREE.DirectionalLight(0xff4b9d, 2.4); rim.position.set(2, 2.8, -3.5);
      [key, fill, rim].forEach((light) => this.scene.add(light)); this.scene.add(ambient);
      this.lights = { ambient, key, fill, rim };
      const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x080b18, roughness: 0.7, metalness: 0.3, transparent: true, opacity: 0.64 });
      const ground = new THREE.Mesh(new THREE.CircleGeometry(2.15, 64), groundMaterial);
      ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.position.y = 0; ground.name = "Contact shadow stage";
      this.stageRoot.add(ground); this.ground = ground;
      this.grid = new THREE.GridHelper(6, 24, 0x2ce8ff, 0x25315f); this.grid.position.y = 0.003;
      this.grid.material.transparent = true; this.grid.material.opacity = 0.17; this.stageRoot.add(this.grid);
      const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x20dffb, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false });
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.82, 1.86, 96), ringMaterial); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012; ring.name = "HH sci-fi stage ring"; this.stageRoot.add(ring);
      this.stageRing = ring;
    }

    setModel(root, options = {}) {
      if (!root) throw new Error("Model root is required.");
      if (this.modelRoot && this.modelRoot !== root) {
        this.modelRoot.removeFromParent?.();
        if (options.disposePrevious && this.modelRoot !== this.prototypeRoot) global.HHCharacter3DAssetLoader?.disposeObject3D?.(this.modelRoot);
      }
      this.modelRoot = root; this.scene.add(root);
      root.position.y = Number.isFinite(root.position.y) ? root.position.y : 0;
      root.traverse?.((object) => { if (object.isMesh) { object.castShadow = QUALITY_PROFILES[this.quality].shadows; object.receiveShadow = true; } });
      // The studio owns the awaited animation bind so model installation cannot
      // race a second, fire-and-forget mixer reset on the same controller.
      if (options.bindControllers !== false) {
        this.animationController?.bind?.(root, options.animations || []).catch?.(() => {});
      }
      this.expressionController?.bind?.(root, options.expressionOptions || {});
      if (options.fit !== false && !root.userData?.hhFit) this.fitModel(root, options.fitOptions);
      this.emit("modelchange", { root, report: options.report || null });
      this.render();
      return root;
    }

    fitModel(root, options = {}) {
      if (!root || !this.THREE) return false;
      const box = new this.THREE.Box3().setFromObject(root);
      if (box.isEmpty()) return false;
      const size = box.getSize(new this.THREE.Vector3());
      const center = box.getCenter(new this.THREE.Vector3());
      const targetHeight = clamp(options?.targetHeight || 1.8, 0.5, 3);
      const scale = size.y > 0.001 ? targetHeight / size.y : 1;
      root.scale.multiplyScalar(scale);
      const scaledBox = new this.THREE.Box3().setFromObject(root);
      const scaledCenter = scaledBox.getCenter(new this.THREE.Vector3());
      root.position.x -= scaledCenter.x;
      root.position.z -= scaledCenter.z;
      root.position.y -= scaledBox.min.y;
      root.userData.hhFit = { originalHeight: size.y, scale, originalCenter: center.toArray() };
      return true;
    }

    showBuildPending() {
      if (!this.prototypeRoot) {
        this.prototypeRoot = new this.THREE.Group();
        this.prototypeRoot.name = "Astra H-08 build pending";
        this.prototypeRoot.userData = { buildPending: true, assetId: "astra-h08-concept-sheet-v1" };
      }
      return this.setModel(this.prototypeRoot, { disposePrevious: true, ownedPrototype: true });
    }

    attachControllers({ animation, expression, springBone } = {}) {
      this.animationController = animation || this.animationController;
      this.expressionController = expression || this.expressionController;
      this.springBoneManager = springBone || this.springBoneManager;
      if (this.modelRoot && this.expressionController) this.expressionController.bind?.(this.modelRoot);
      // Animation clips are bound by setModel/importModel; avoid a second empty bind that would discard them.
      if (this.modelRoot && this.animationController && !this.animationController.root) this.animationController.bind?.(this.modelRoot, []).catch?.(() => {});
    }

    setCameraPreset(name = "full") {
      const preset = CAMERA_PRESETS[name] || CAMERA_PRESETS.full;
      this.camera.position.set(...preset.position);
      this.controls.target.set(...preset.target);
      this.controls.syncFromCamera(); this.controls.update(); this.render();
      this.emit("camera", { preset: name, projection: this.projection });
      return true;
    }

    setProjection(mode) {
      if (!new Set(["perspective", "orthographic"]).has(mode) || mode === this.projection) return false;
      const previous = this.camera;
      this.projection = mode; this.camera = this.cameras[mode];
      this.camera.position.copy(previous.position); this.camera.quaternion.copy(previous.quaternion);
      const target = this.controls?.target?.clone?.() || new this.THREE.Vector3(0, 1.05, 0);
      this.controls?.dispose(); this.controls = new MiniOrbitControls(this.camera, this.renderer.domElement, this.THREE, target);
      this.resize(); this.render(); this.emit("camera", { projection: mode }); return true;
    }

    setLook(x, y) {
      this.lookTarget.x = clamp(x, -1, 1); this.lookTarget.y = clamp(y, -1, 1);
      this.expressionController?.setLook?.(this.lookTarget.x, this.lookTarget.y);
      return Object.assign({}, this.lookTarget);
    }

    setTransparent(value) { this.transparent = Boolean(value); this.renderer?.setClearColor(this.background, this.transparent ? 0 : 1); this.render(); }
    setBackground(color) { this.background = String(color || "#070a12"); this.renderer?.setClearColor(this.background, this.transparent ? 0 : 1); this.render(); }
    setGrid(visible) { if (this.grid) this.grid.visible = Boolean(visible); this.render(); }

    applyQuality(mode, options = {}) {
      if (!QUALITY_PROFILES[mode]) return false;
      this.quality = mode;
      const profile = QUALITY_PROFILES[mode];
      if (this.renderer) {
        this.renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, profile.pixelRatio));
        this.renderer.shadowMap.enabled = profile.shadows;
        if (this.THREE?.PCFShadowMap) this.renderer.shadowMap.type = this.THREE.PCFShadowMap;
        this.lights.key && (this.lights.key.castShadow = profile.shadows);
        if (this.lights.key?.shadow?.mapSize) { this.lights.key.shadow.mapSize.set(profile.shadowSize, profile.shadowSize); this.lights.key.shadow.map?.dispose?.(); this.lights.key.shadow.map = null; }
        this.modelRoot?.traverse?.((object) => { if (object.isMesh) object.castShadow = profile.shadows; });
        this.resize(); this.render();
      }
      if (options.restart !== false) { this.stop(); this.start(); }
      this.emit("quality", { mode, profile });
      return true;
    }

    resize() {
      if (!this.renderer || !this.container) return false;
      const width = Math.max(1, Math.round(this.container.clientWidth || 1));
      const height = Math.max(1, Math.round(this.container.clientHeight || 1));
      const aspect = width / height;
      this.renderer.setSize(width, height, false);
      this.cameras.perspective.aspect = aspect; this.cameras.perspective.updateProjectionMatrix();
      const heightView = 2.6; this.cameras.orthographic.left = -heightView * aspect / 2; this.cameras.orthographic.right = heightView * aspect / 2;
      this.cameras.orthographic.top = heightView / 2; this.cameras.orthographic.bottom = -heightView / 2; this.cameras.orthographic.updateProjectionMatrix();
      this.render(); return true;
    }

    update(delta, now) {
      this.clockSeconds += delta;
      this.controls?.update();
      this.animationController?.update?.(delta);
      this.expressionController?.update?.(delta, now);
      if (this.physicsEnabled && this.springBoneManager?.update && QUALITY_PROFILES[this.quality].physicsSteps) {
        const steps = QUALITY_PROFILES[this.quality].physicsSteps;
        for (let i = 0; i < steps; i += 1) this.springBoneManager.update(delta / steps);
      }
      if (this.modelRoot === this.prototypeRoot && !this.reducedMotion) {
        const p = this.prototypeParts;
        if (p?.torso) p.torso.scale.y = 1 + Math.sin(this.clockSeconds * 1.7) * 0.008;
        if (p?.head) { p.head.rotation.y += (this.lookTarget.x * 0.2 - p.head.rotation.y) * Math.min(1, delta * 4); p.head.rotation.x += (-this.lookTarget.y * 0.1 - p.head.rotation.x) * Math.min(1, delta * 4); }
        if (p?.hairBack) p.hairBack.rotation.z = Math.sin(this.clockSeconds * 0.8) * 0.018;
      }
      if (this.stageRing && !this.reducedMotion) this.stageRing.rotation.z += delta * 0.08;
      if (this.autoQuality && !this.reducedMotion && this.quality !== "static" && now - this.lastQualityChange > 12000 && this.fpsSamples.length >= 90) {
        const target = QUALITY_PROFILES[this.quality].targetFps;
        this.lowFpsSeconds = this.fps < target * 0.72 ? this.lowFpsSeconds + delta : Math.max(0, this.lowFpsSeconds - delta * 0.5);
        if (this.lowFpsSeconds > 6) {
          const next = this.quality === "cinematic" ? "balanced" : this.quality === "balanced" ? "mobile" : this.quality;
          if (next !== this.quality) { this.lastQualityChange = now; this.lowFpsSeconds = 0; this.applyQuality(next, { restart: false }); this.emit("autodowngrade", { mode: next, fps: this.fps }); }
        }
      }
    }

    render() { if (this.renderer && this.scene && this.camera && !this.contextLost) this.renderer.render(this.scene, this.camera); }

    start() {
      if (this.running || this.paused || this.contextLost || this.disposed || !this.renderer) return false;
      this.running = true; this.lastFrame = performance.now();
      const tick = (now) => {
        this.frame = 0;
        if (!this.running || this.paused || this.contextLost || this.disposed) return;
        const delta = Math.min(0.05, Math.max(0, (now - this.lastFrame) / 1000)); this.lastFrame = now;
        if (delta > 0) { this.fpsSamples.push(1 / delta); if (this.fpsSamples.length > 90) this.fpsSamples.shift(); this.fps = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length; }
        this.update(delta, now); this.render();
        if (this.quality !== "static") this.frame = requestAnimationFrame(tick); else this.running = false;
      };
      this.frame = requestAnimationFrame(tick); return true;
    }

    stop() { cancelAnimationFrame(this.frame); this.frame = 0; this.running = false; }

    setPaused(value, reason = "manual") {
      this.paused = Boolean(value);
      if (this.paused) this.stop(); else this.start();
      this.emit("pause", { paused: this.paused, reason }); return this.paused;
    }

    diagnostics() {
      const info = this.renderer?.info;
      return Object.freeze({
        fps: Math.round((this.fps || 0) * 10) / 10,
        quality: this.quality,
        projection: this.projection,
        render: { calls: info?.render?.calls || 0, triangles: info?.render?.triangles || 0, lines: info?.render?.lines || 0, points: info?.render?.points || 0 },
        gpuResources: { geometries: info?.memory?.geometries || 0, textures: info?.memory?.textures || 0, programs: info?.programs?.length || 0 },
        webglContextLost: this.contextLost,
        paused: this.paused,
        // Renderer counters describe this viewport only; they are not whole-device CPU/RAM statistics.
        scope: "Three.js renderer/tab only"
      });
    }

    async fullscreen() {
      if (!document.fullscreenElement) { await this.container.requestFullscreen?.(); return Boolean(document.fullscreenElement); }
      if (document.fullscreenElement === this.container) { await document.exitFullscreen?.(); return false; }
      return false;
    }

    setPhysicsEnabled(enabled) {
      this.physicsEnabled = Boolean(enabled);
      return this.physicsEnabled;
    }

    on(eventName, listener) {
      if (typeof listener !== "function") throw new TypeError("Runtime event listener must be a function.");
      if (!this.listeners.has(eventName)) this.listeners.set(eventName, new Set());
      this.listeners.get(eventName).add(listener);
      return () => this.listeners.get(eventName)?.delete(listener);
    }

    emit(eventName, payload) {
      this.listeners.get(eventName)?.forEach((listener) => { try { listener(payload); } catch (_) { /* isolate listener */ } });
    }

    disposeObject(root) {
      if (!root?.traverse) return;
      const geometries = new Set(); const materials = new Set(); const textures = new Set();
      root.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        const list = Array.isArray(object.material) ? object.material : [object.material];
        list.filter(Boolean).forEach((material) => { materials.add(material); Object.values(material).forEach((value) => { if (value?.isTexture) textures.add(value); }); });
        object.skeleton?.dispose?.();
      });
      textures.forEach((texture) => texture.dispose?.()); materials.forEach((material) => material.dispose?.()); geometries.forEach((geometry) => geometry.dispose?.()); root.removeFromParent?.();
    }

    dispose() {
      if (this.disposed) return;
      this.stop(); this.disposed = true;
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      global.removeEventListener?.("resize", this.resizeHandler);
      this.resizeObserver?.disconnect();
      this.controls?.dispose();
      // Controllers are owned by the studio and may already have been disposed; reset references here without double-disposing shared instances.
      this.animationController?.dispose?.(); this.expressionController?.dispose?.(); this.springBoneManager?.dispose?.();
      this.renderer?.domElement?.removeEventListener("webglcontextlost", this.contextHandlers.lost);
      this.renderer?.domElement?.removeEventListener("webglcontextrestored", this.contextHandlers.restored);
      if (this.modelRoot && this.modelRoot !== this.prototypeRoot) this.disposeObject(this.modelRoot);
      if (this.prototypeRoot) this.disposeObject(this.prototypeRoot);
      if (this.stageRoot) this.disposeObject(this.stageRoot);
      this.renderer?.renderLists?.dispose?.(); this.renderer?.dispose?.(); this.renderer?.forceContextLoss?.(); this.renderer?.domElement?.remove?.();
      this.listeners.clear(); this.renderer = null; this.scene = null; this.camera = null; this.cameras = {}; this.modelRoot = null; this.prototypeRoot = null; this.container = null;
    }
  }

  global.HHCharacter3DAvatarRuntime = Object.freeze({ AvatarRuntime, MiniOrbitControls, QUALITY_PROFILES, CAMERA_PRESETS, canWebGL });
  global.HHCharacter3D = global.HHCharacter3D || {};
  global.HHCharacter3D.AvatarRuntime = AvatarRuntime;
})(typeof window !== "undefined" ? window : globalThis);
