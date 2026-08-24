(function (root, factory) {
  "use strict";
  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHEonWildRenderer3D = api;
})(typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this), function createHHEonWildRenderer3D(runtime) {
  "use strict";

  /*
   * HH EonWild 3D foundation.
   *
   * This adapter is deliberately optional. It owns a separate canvas, loads
   * Babylon lazily, and only exposes that canvas after a scene has rendered once.
   * A failed start therefore never invalidates the existing Canvas2D experience.
   * Terrain and animal stand-ins are procedural; no model, texture, physics, or
   * navigation dependency is implied by this file.
   */

  const VERSION = "1.0.0";
  const WORLD_SIZE = 4096;
  const WORLD_HALF = WORLD_SIZE / 2;
  const CHUNK_SIZE = 256;
  const CHUNKS_PER_AXIS = WORLD_SIZE / CHUNK_SIZE;
  const WATER_LEVEL = 3.5;
  const MAX_ACTIVE_CHUNKS = 96;
  const MAX_PENDING_CHUNKS = 128;
  const MAX_FRAME_SAMPLES = 180;
  const MAX_LOADER_URLS = 4;
  const BABYLON_VERSION = "9.22.1";
  const DEFAULT_LOCAL_BABYLON_URL = `./vendor/babylon-${BABYLON_VERSION}.js?v=${BABYLON_VERSION}`;
  const DEFAULT_REMOTE_BABYLON_URL = null;

  const FLAGSHIP_SPECIES = Object.freeze([
    Object.freeze({ id: "tyrannosaurus", label: "Tyrannosaurus rex", locomotion: "run", color: "#b96d43" }),
    Object.freeze({ id: "triceratops", label: "Triceratops", locomotion: "run", color: "#9fa66f" }),
    Object.freeze({ id: "spinosaurus", label: "Spinosaurus", locomotion: "amphibious", color: "#668d73" }),
    Object.freeze({ id: "pteranodon", label: "Pteranodon", locomotion: "fly", color: "#9b7a66" })
  ]);
  const FLAGSHIP_IDS = Object.freeze(FLAGSHIP_SPECIES.map((species) => species.id));

  const QUALITY_PRESETS = Object.freeze({
    low: Object.freeze({ id: "low", targetFps: 30, renderScale: 0.62, streamRadius: 2, maxChunks: 21, terrainSegments: 12, chunkBuildsPerFrame: 1, farClip: 520 }),
    balanced: Object.freeze({ id: "balanced", targetFps: 45, renderScale: 0.78, streamRadius: 3, maxChunks: 37, terrainSegments: 20, chunkBuildsPerFrame: 1, farClip: 700 }),
    high: Object.freeze({ id: "high", targetFps: 60, renderScale: 0.9, streamRadius: 4, maxChunks: 61, terrainSegments: 28, chunkBuildsPerFrame: 2, farClip: 900 }),
    ultra: Object.freeze({ id: "ultra", targetFps: 60, renderScale: 1, streamRadius: 5, maxChunks: 89, terrainSegments: 36, chunkBuildsPerFrame: 2, farClip: 1100 })
  });
  const QUALITY_ORDER = Object.freeze(["low", "balanced", "high", "ultra"]);

  const TERRAIN_COLORS = Object.freeze({
    waterbed: Object.freeze([0.16, 0.25, 0.2]),
    floodplain: Object.freeze([0.27, 0.42, 0.24]),
    fern: Object.freeze([0.2, 0.38, 0.2]),
    conifer: Object.freeze([0.13, 0.3, 0.2]),
    upland: Object.freeze([0.38, 0.4, 0.23]),
    badland: Object.freeze([0.48, 0.31, 0.2]),
    rock: Object.freeze([0.34, 0.34, 0.31])
  });

  const loaderPromises = new Map();
  const clamp = (value, min, max) => {
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : min));
  };
  const finite = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  };
  const now = () => runtime.performance && typeof runtime.performance.now === "function" ? runtime.performance.now() : Date.now();
  const lerp = (a, b, amount) => a + (b - a) * amount;
  const smooth = (value) => value * value * (3 - 2 * value);
  const normalizePreset = (value, fallback = "balanced") => Object.prototype.hasOwnProperty.call(QUALITY_PRESETS, value) ? value : fallback;
  const compactError = (error) => ({
    name: String(error && error.name || "Error").slice(0, 80),
    message: String(error && error.message || error || "Unknown error").slice(0, 360)
  });
  const freezeRecord = (value) => Object.freeze(value);
  const safeCall = (callback, value) => {
    if (typeof callback !== "function") return;
    try { callback(value); } catch { /* Host callbacks must not break the renderer. */ }
  };
  const safeDispose = (value) => {
    if (!value || typeof value.dispose !== "function") return;
    try { value.dispose(); } catch { /* Best-effort cleanup during fallback. */ }
  };

  function makeReason(code, message, stage, details, recoverable = true) {
    return freezeRecord({
      code: String(code || "UNKNOWN_FAILURE"),
      message: String(message || "The optional 3D renderer could not start."),
      stage: String(stage || "unknown"),
      recoverable: Boolean(recoverable),
      fallback: "canvas2d",
      details: details && typeof details === "object" ? freezeRecord({ ...details }) : freezeRecord({})
    });
  }

  function makeResult(ok, fields) {
    return freezeRecord({ ok: Boolean(ok), ...(fields || {}) });
  }

  function hashSeed(value) {
    const text = String(value === undefined ? "eonwild-mesozoic" : value).slice(0, 128);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function hash2D(x, z, seed) {
    let hash = (seed ^ Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263)) >>> 0;
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177) >>> 0;
    hash ^= hash >>> 16;
    return (hash >>> 0) / 4294967295;
  }

  function valueNoise(x, z, scale, seed) {
    const scaledX = x / scale;
    const scaledZ = z / scale;
    const x0 = Math.floor(scaledX);
    const z0 = Math.floor(scaledZ);
    const tx = smooth(scaledX - x0);
    const tz = smooth(scaledZ - z0);
    const top = lerp(hash2D(x0, z0, seed), hash2D(x0 + 1, z0, seed), tx);
    const bottom = lerp(hash2D(x0, z0 + 1, seed), hash2D(x0 + 1, z0 + 1, seed), tx);
    return lerp(top, bottom, tz);
  }

  function terrainHeightNumeric(worldX, worldZ, seed) {
    const x = clamp(worldX, 0, WORLD_SIZE);
    const z = clamp(worldZ, 0, WORLD_SIZE);
    const warpX = (valueNoise(x, z, 720, seed ^ 0x9e3779b9) - 0.5) * 180;
    const warpZ = (valueNoise(x, z, 690, seed ^ 0x85ebca6b) - 0.5) * 180;
    const continental = valueNoise(x + warpX, z + warpZ, 940, seed);
    const hills = valueNoise(x - warpZ, z + warpX, 310, seed ^ 0x27d4eb2f) - 0.5;
    const detail = valueNoise(x, z, 96, seed ^ 0x165667b1) - 0.5;
    const ridgeNoise = valueNoise(x + 217, z - 131, 470, seed ^ 0xd3a2646c);
    const ridge = Math.pow(1 - Math.abs(ridgeNoise * 2 - 1), 2);
    const channelNoise = Math.abs(valueNoise(x + 611, z - 347, 560, seed ^ 0xfd7046c5) * 2 - 1);
    const channel = channelNoise < 0.12 ? (0.12 - channelNoise) * 105 : 0;
    const edgeTaper = Math.min(1, Math.min(x, z, WORLD_SIZE - x, WORLD_SIZE - z) / 170);
    const height = 8 + (continental - 0.43) * 62 + hills * 31 + ridge * 16 + detail * 7 - channel;
    return lerp(WATER_LEVEL - 7, height, smooth(clamp(edgeTaper, 0, 1)));
  }

  function terrainSampleNumeric(worldX, worldZ, seed) {
    const height = terrainHeightNumeric(worldX, worldZ, seed);
    const moisture = valueNoise(worldX + 83, worldZ - 47, 390, seed ^ 0xa24baed5);
    const heat = valueNoise(worldX - 101, worldZ + 229, 780, seed ^ 0x9fb21c65);
    let biome = "fern";
    if (height <= WATER_LEVEL - 0.5) biome = "waterbed";
    else if (height <= WATER_LEVEL + 4 || moisture > 0.73) biome = "floodplain";
    else if (height > 64) biome = heat > 0.58 ? "badland" : "rock";
    else if (moisture > 0.57) biome = "conifer";
    else if (moisture < 0.3) biome = "upland";
    return { height, moisture, heat, biome, color: TERRAIN_COLORS[biome] };
  }

  function sampleTerrainHeight(worldX, worldZ, seed = "eonwild-mesozoic") {
    return terrainHeightNumeric(worldX, worldZ, hashSeed(seed));
  }

  function sampleTerrain(worldX, worldZ, seed = "eonwild-mesozoic") {
    const sample = terrainSampleNumeric(clamp(worldX, 0, WORLD_SIZE), clamp(worldZ, 0, WORLD_SIZE), hashSeed(seed));
    return freezeRecord({
      x: clamp(worldX, 0, WORLD_SIZE),
      z: clamp(worldZ, 0, WORLD_SIZE),
      height: sample.height,
      moisture: sample.moisture,
      heat: sample.heat,
      biome: sample.biome,
      underwater: sample.height < WATER_LEVEL
    });
  }

  function testWebGL(documentRef, kind) {
    if (!documentRef || typeof documentRef.createElement !== "function") return false;
    let canvas;
    let context;
    try {
      canvas = documentRef.createElement("canvas");
      context = canvas && typeof canvas.getContext === "function"
        ? canvas.getContext(kind, { failIfMajorPerformanceCaveat: true })
        : null;
      return Boolean(context);
    } catch {
      return false;
    } finally {
      const extension = context && typeof context.getExtension === "function" ? context.getExtension("WEBGL_lose_context") : null;
      try { extension && extension.loseContext(); } catch { /* Probe canvas only. */ }
      canvas = null;
      context = null;
    }
  }

  function detectCapabilities(options = {}) {
    const scope = options.runtime || runtime;
    const documentRef = options.document || scope.document;
    const navigatorRef = options.navigator || scope.navigator || {};
    let reducedMotion = false;
    try { reducedMotion = Boolean(scope.matchMedia && scope.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch { /* Optional media query. */ }
    const canvas = Boolean(documentRef && typeof documentRef.createElement === "function");
    const webgl2 = options.skipContextProbe ? null : testWebGL(documentRef, "webgl2");
    const webgl = options.skipContextProbe ? null : (webgl2 || testWebGL(documentRef, "webgl") || testWebGL(documentRef, "experimental-webgl"));
    const webgpu = Boolean(navigatorRef && navigatorRef.gpu);
    const preferredBackend = webgpu ? "webgpu" : webgl2 ? "webgl2" : webgl ? "webgl1" : null;
    return freezeRecord({
      dom: Boolean(documentRef),
      canvas,
      webgpu,
      webgl2,
      webgl,
      preferredBackend,
      rendererAvailable: Boolean(canvas && (webgpu || webgl)),
      secureContext: scope.isSecureContext !== false,
      pageVisibility: Boolean(documentRef && "hidden" in documentRef),
      resizeObserver: typeof scope.ResizeObserver === "function",
      offscreenCanvas: typeof scope.OffscreenCanvas === "function",
      reducedMotion,
      touch: finite(navigatorRef.maxTouchPoints, 0) > 0,
      hardwareConcurrency: clamp(navigatorRef.hardwareConcurrency || 0, 0, 256),
      deviceMemoryGB: clamp(navigatorRef.deviceMemory || 0, 0, 128),
      devicePixelRatio: clamp(scope.devicePixelRatio || 1, 0.5, 8),
      babylonPresent: isBabylonNamespace(options.babylon || scope.BABYLON),
      integrations: freezeRecord({ physics: "kinematic-proxy-only", rapier: false, recast: false, navmesh: false })
    });
  }

  function isBabylonNamespace(value) {
    return Boolean(value && typeof value === "object" && typeof value.Engine === "function" && typeof value.Scene === "function");
  }

  function validateBabylonNamespace(value) {
    if (!isBabylonNamespace(value)) return false;
    const required = ["ArcRotateCamera", "Color3", "Color4", "DirectionalLight", "HemisphericLight", "Mesh", "MeshBuilder", "StandardMaterial", "TransformNode", "Vector3", "VertexData"];
    return required.every((key) => typeof value[key] === "function" || (key === "MeshBuilder" && value[key] && typeof value[key] === "object"));
  }

  function normalizeUrl(url, documentRef) {
    const value = String(url || "").trim();
    if (!value) return "";
    if (/^(?:javascript|data):/i.test(value)) return "";
    try { return String(new URL(value, documentRef && documentRef.baseURI || runtime.location && runtime.location.href || undefined)); }
    catch { return value; }
  }

  function isRemoteUrl(url, documentRef) {
    try {
      const parsed = new URL(url, documentRef && documentRef.baseURI || runtime.location && runtime.location.href || undefined);
      let origin = runtime.location && runtime.location.origin || documentRef && documentRef.location && documentRef.location.origin;
      if (!origin && documentRef && documentRef.baseURI) {
        try { origin = new URL(documentRef.baseURI).origin; } catch { /* A non-URL base is treated as unknown. */ }
      }
      return /^https?:$/i.test(parsed.protocol) && (!origin || parsed.origin !== origin);
    } catch {
      return /^https?:\/\//i.test(String(url || ""));
    }
  }

  function resolveBabylonUrls(options, documentRef) {
    const allowRemote = options.allowRemoteBabylon === true;
    const explicit = Array.isArray(options.babylonUrls) ? options.babylonUrls : (Array.isArray(options.urls) ? options.urls : []);
    const candidates = explicit.length ? explicit.slice() : [
      options.localBabylonUrl || options.localUrl || DEFAULT_LOCAL_BABYLON_URL,
      ...(allowRemote ? [options.remoteBabylonUrl || options.remoteUrl || DEFAULT_REMOTE_BABYLON_URL].filter(Boolean) : [])
    ];
    const unique = [];
    for (const candidate of candidates) {
      const normalized = normalizeUrl(candidate, documentRef);
      if (!normalized || unique.includes(normalized)) continue;
      if (!allowRemote && isRemoteUrl(normalized, documentRef)) continue;
      unique.push(normalized);
      if (unique.length >= MAX_LOADER_URLS) break;
    }
    return unique.sort((left, right) => Number(isRemoteUrl(left, documentRef)) - Number(isRemoteUrl(right, documentRef)));
  }

  function loadScript(url, options, documentRef) {
    const cacheKey = String(url);
    if (loaderPromises.has(cacheKey)) return loaderPromises.get(cacheKey);
    const timeoutMs = clamp(options.loadTimeoutMs || options.timeoutMs || 12000, 1000, 30000);
    const promise = new Promise((resolve, reject) => {
      if (!documentRef || typeof documentRef.createElement !== "function") {
        const error = new Error("A DOM is required to load Babylon.js.");
        error.code = "DOM_UNAVAILABLE";
        reject(error);
        return;
      }

      let settled = false;
      let owned = false;
      let script = null;
      const scripts = documentRef.scripts ? Array.from(documentRef.scripts) : [];
      script = scripts.find((candidate) => normalizeUrl(candidate.src, documentRef) === url) || null;
      if (!script) {
        script = documentRef.createElement("script");
        owned = true;
        script.async = true;
        script.src = url;
        script.dataset.hweBabylonLoader = VERSION;
        if (options.nonce) script.nonce = String(options.nonce);
        if (options.integrity && typeof options.integrity === "string") {
          script.integrity = options.integrity;
          script.crossOrigin = options.crossOrigin || "anonymous";
        } else if (isRemoteUrl(url, documentRef) && options.crossOrigin !== false) {
          script.crossOrigin = typeof options.crossOrigin === "string" ? options.crossOrigin : "anonymous";
        }
        script.referrerPolicy = options.referrerPolicy || "no-referrer";
      }

      const cleanup = () => {
        runtime.clearTimeout(timer);
        if (script && typeof script.removeEventListener === "function") {
          script.removeEventListener("load", onLoad);
          script.removeEventListener("error", onError);
        }
      };
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        callback(value);
      };
      const onLoad = () => {
        if (isBabylonNamespace(runtime.BABYLON)) finish(resolve, runtime.BABYLON);
        else {
          const error = new Error("The script loaded but did not expose a Babylon namespace.");
          error.code = "BABYLON_NAMESPACE_MISSING";
          if (owned && script && typeof script.remove === "function") script.remove();
          finish(reject, error);
        }
      };
      const onError = () => {
        const error = new Error(`Could not load Babylon.js from ${url}.`);
        error.code = "BABYLON_SCRIPT_ERROR";
        if (owned && script && typeof script.remove === "function") script.remove();
        finish(reject, error);
      };
      const timer = runtime.setTimeout(() => {
        const error = new Error(`Timed out loading Babylon.js after ${timeoutMs} ms.`);
        error.code = "BABYLON_LOAD_TIMEOUT";
        if (owned && script && typeof script.remove === "function") script.remove();
        finish(reject, error);
      }, timeoutMs);

      if (typeof script.addEventListener === "function") {
        script.addEventListener("load", onLoad);
        script.addEventListener("error", onError);
      } else {
        script.onload = onLoad;
        script.onerror = onError;
      }
      if (isBabylonNamespace(runtime.BABYLON)) {
        finish(resolve, runtime.BABYLON);
      } else if (owned) {
        const parent = documentRef.head || documentRef.body || documentRef.documentElement;
        if (!parent || typeof parent.appendChild !== "function") {
          const error = new Error("No document node can host the Babylon.js loader.");
          error.code = "SCRIPT_HOST_MISSING";
          finish(reject, error);
        } else {
          parent.appendChild(script);
        }
      }
    }).catch((error) => {
      loaderPromises.delete(cacheKey);
      throw error;
    });
    loaderPromises.set(cacheKey, promise);
    return promise;
  }

  async function loadBabylon(options = {}) {
    const direct = options.babylon || runtime.BABYLON;
    if (isBabylonNamespace(direct)) return direct;
    if (typeof options.loadBabylon === "function") {
      const injected = await options.loadBabylon();
      if (isBabylonNamespace(injected)) return injected;
      const error = new Error("The injected Babylon loader returned an invalid namespace.");
      error.code = "BABYLON_NAMESPACE_INVALID";
      throw error;
    }

    const documentRef = options.document || runtime.document;
    const urls = resolveBabylonUrls(options, documentRef);
    const failures = [];
    for (const url of urls) {
      try {
        const loaded = await loadScript(url, options, documentRef);
        if (isBabylonNamespace(loaded)) return loaded;
      } catch (error) {
        failures.push({ url, code: String(error && error.code || "LOAD_FAILED"), message: String(error && error.message || error).slice(0, 220) });
      }
    }
    const error = new Error(urls.length ? "All configured Babylon.js sources failed." : "No permitted Babylon.js source is configured.");
    error.code = "BABYLON_LOAD_FAILED";
    error.failures = failures;
    throw error;
  }

  async function createBabylonEngine(B, canvas, capabilities, options) {
    const attempts = [];
    const requested = ["auto", "webgpu", "webgl"].includes(options.backend) ? options.backend : "auto";
    const mayTryWebGPU = requested !== "webgl" && Boolean(B.WebGPUEngine) && (capabilities.webgpu || options.forceWebGPUProbe === true);
    if (mayTryWebGPU) {
      let webgpuEngine = null;
      try {
        if (typeof B.WebGPUEngine.IsSupportedAsync !== "undefined") {
          const supportProbe = B.WebGPUEngine.IsSupportedAsync;
          const supported = typeof supportProbe === "function" ? await supportProbe.call(B.WebGPUEngine) : await supportProbe;
          if (!supported) throw Object.assign(new Error("Babylon reports that WebGPU is unavailable."), { code: "WEBGPU_UNSUPPORTED" });
        }
        const webgpuOptions = {
          antialias: options.antialias !== false,
          adaptToDeviceRatio: false,
          powerPreference: options.powerPreference || "high-performance",
          ...(options.webgpuOptions && typeof options.webgpuOptions === "object" ? options.webgpuOptions : {})
        };
        webgpuEngine = new B.WebGPUEngine(canvas, webgpuOptions);
        if (typeof webgpuEngine.initAsync !== "function") throw new Error("This Babylon WebGPU engine has no async initializer.");
        const startupPreset = QUALITY_PRESETS[normalizePreset(options.qualityPreset || options.quality, "balanced")];
        if (typeof webgpuEngine.setHardwareScalingLevel === "function") {
          // Set the scale before initAsync creates the swap chain. Calling it
          // immediately after initialization can invalidate an in-flight D3D
          // shared texture in Chromium's WebGPU implementation.
          webgpuEngine.setHardwareScalingLevel(clamp(1 / startupPreset.renderScale, 1, 2.25));
        }
        await webgpuEngine.initAsync(options.webgpuDeviceDescriptor);
        if (!webgpuEngine || typeof webgpuEngine.runRenderLoop !== "function") throw new Error("WebGPU returned an invalid engine.");
        attempts.push(freezeRecord({ backend: "webgpu", ok: true }));
        return { engine: webgpuEngine, backend: "webgpu", attempts };
      } catch (error) {
        safeDispose(webgpuEngine);
        attempts.push(freezeRecord({ backend: "webgpu", ok: false, error: compactError(error) }));
        if (options.allowWebGLFallback === false) {
          const failure = new Error("WebGPU initialization failed and WebGL fallback is disabled.");
          failure.code = "WEBGPU_INIT_FAILED";
          failure.attempts = attempts;
          throw failure;
        }
      }
    }

    if (requested === "webgpu" && options.allowWebGLFallback === false) {
      const error = new Error("WebGPU is unavailable and WebGL fallback is disabled.");
      error.code = "WEBGPU_UNAVAILABLE";
      error.attempts = attempts;
      throw error;
    }

    let webglEngine = null;
    try {
      const engineOptions = {
        preserveDrawingBuffer: false,
        stencil: true,
        disableWebGL2Support: false,
        powerPreference: options.powerPreference || "high-performance",
        premultipliedAlpha: false,
        ...(options.webglOptions && typeof options.webglOptions === "object" ? options.webglOptions : {})
      };
      webglEngine = new B.Engine(canvas, options.antialias !== false, engineOptions, false);
      if (!webglEngine || typeof webglEngine.runRenderLoop !== "function") throw new Error("WebGL returned an invalid engine.");
      attempts.push(freezeRecord({ backend: webglEngine.webGLVersion >= 2 ? "webgl2" : "webgl1", ok: true }));
      return { engine: webglEngine, backend: webglEngine.webGLVersion >= 2 ? "webgl2" : "webgl1", attempts };
    } catch (error) {
      safeDispose(webglEngine);
      attempts.push(freezeRecord({ backend: "webgl", ok: false, error: compactError(error) }));
      const failure = new Error("Neither WebGPU nor WebGL could initialize.");
      failure.code = "NO_RENDER_BACKEND";
      failure.attempts = attempts;
      throw failure;
    }
  }

  function makeColor3(B, rgb) {
    return new B.Color3(rgb[0], rgb[1], rgb[2]);
  }

  function createTerrainMaterial(B, scene) {
    const material = new B.StandardMaterial("hwe3d-terrain-material", scene);
    material.diffuseColor = new B.Color3(1, 1, 1);
    material.ambientColor = new B.Color3(0.3, 0.34, 0.28);
    material.specularColor = new B.Color3(0.025, 0.03, 0.025);
    material.roughness = 1;
    material.backFaceCulling = false;
    if (typeof material.freeze === "function") material.freeze();
    return material;
  }

  function appendSkirt(positions, colors, indices, edge, depth, color) {
    const start = positions.length / 3;
    for (const point of edge) {
      positions.push(point[0], point[1], point[2], point[0], point[1] - depth, point[2]);
      colors.push(color[0], color[1], color[2], 1, color[0] * 0.55, color[1] * 0.55, color[2] * 0.55, 1);
    }
    for (let index = 0; index < edge.length - 1; index += 1) {
      const topLeft = start + index * 2;
      const bottomLeft = topLeft + 1;
      const topRight = topLeft + 2;
      const bottomRight = topLeft + 3;
      indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight);
    }
  }

  function buildTerrainChunk(B, scene, material, chunkX, chunkZ, segments, seed) {
    const boundedSegments = Math.round(clamp(segments, 4, 48));
    const positions = [];
    const indices = [];
    const normals = [];
    const colors = [];
    const originX = chunkX * CHUNK_SIZE;
    const originZ = chunkZ * CHUNK_SIZE;
    const step = CHUNK_SIZE / boundedSegments;
    for (let zIndex = 0; zIndex <= boundedSegments; zIndex += 1) {
      for (let xIndex = 0; xIndex <= boundedSegments; xIndex += 1) {
        const worldX = originX + xIndex * step;
        const worldZ = originZ + zIndex * step;
        const sample = terrainSampleNumeric(worldX, worldZ, seed);
        positions.push(xIndex * step - CHUNK_SIZE / 2, sample.height, zIndex * step - CHUNK_SIZE / 2);
        colors.push(sample.color[0], sample.color[1], sample.color[2], 1);
      }
    }
    const row = boundedSegments + 1;
    for (let zIndex = 0; zIndex < boundedSegments; zIndex += 1) {
      for (let xIndex = 0; xIndex < boundedSegments; xIndex += 1) {
        const topLeft = zIndex * row + xIndex;
        const bottomLeft = (zIndex + 1) * row + xIndex;
        indices.push(topLeft, bottomLeft, topLeft + 1, topLeft + 1, bottomLeft, bottomLeft + 1);
      }
    }

    const edgeColor = TERRAIN_COLORS.rock;
    const pointAt = (xIndex, zIndex) => {
      const offset = (zIndex * row + xIndex) * 3;
      return [positions[offset], positions[offset + 1], positions[offset + 2]];
    };
    const north = [];
    const south = [];
    const west = [];
    const east = [];
    for (let index = 0; index <= boundedSegments; index += 1) {
      north.push(pointAt(index, 0));
      south.push(pointAt(index, boundedSegments));
      west.push(pointAt(0, index));
      east.push(pointAt(boundedSegments, index));
    }
    appendSkirt(positions, colors, indices, north, 10, edgeColor);
    appendSkirt(positions, colors, indices, south, 10, edgeColor);
    appendSkirt(positions, colors, indices, west, 10, edgeColor);
    appendSkirt(positions, colors, indices, east, 10, edgeColor);

    B.VertexData.ComputeNormals(positions, indices, normals);
    const mesh = new B.Mesh(`hwe3d-terrain-${chunkX}-${chunkZ}`, scene);
    const vertexData = new B.VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;
    vertexData.normals = normals;
    vertexData.colors = colors;
    vertexData.applyToMesh(mesh, false);
    mesh.position.x = originX + CHUNK_SIZE / 2 - WORLD_HALF;
    mesh.position.z = originZ + CHUNK_SIZE / 2 - WORLD_HALF;
    mesh.material = material;
    mesh.useVertexColors = true;
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    mesh.metadata = { eonwild: true, kind: "terrain-chunk", chunkX, chunkZ, segments: boundedSegments };
    if (typeof mesh.freezeWorldMatrix === "function") mesh.freezeWorldMatrix();
    return mesh;
  }

  class TerrainStreamer {
    constructor(B, scene, options) {
      this.B = B;
      this.scene = scene;
      this.seed = hashSeed(options.seed);
      this.material = createTerrainMaterial(B, scene);
      this.active = new Map();
      this.wanted = new Map();
      this.queue = [];
      this.queued = new Set();
      this.preset = QUALITY_PRESETS[normalizePreset(options.qualityPreset)];
      this.centerChunkX = -1;
      this.centerChunkZ = -1;
      this.dirty = true;
      this.disposed = false;
    }

    configure(preset) {
      if (!preset || this.preset.id === preset.id) return;
      this.preset = preset;
      this.dirty = true;
    }

    segmentsForDistance(distance) {
      const base = this.preset.terrainSegments;
      if (distance <= 1) return base;
      if (distance <= 2.25) return Math.max(8, Math.round(base / 2));
      return Math.max(4, Math.round(base / 4));
    }

    update(worldX, worldZ, force = false) {
      if (this.disposed) return;
      const centerX = clamp(Math.floor(clamp(worldX, 0, WORLD_SIZE - 0.001) / CHUNK_SIZE), 0, CHUNKS_PER_AXIS - 1);
      const centerZ = clamp(Math.floor(clamp(worldZ, 0, WORLD_SIZE - 0.001) / CHUNK_SIZE), 0, CHUNKS_PER_AXIS - 1);
      if (!force && !this.dirty && centerX === this.centerChunkX && centerZ === this.centerChunkZ) return;
      this.centerChunkX = centerX;
      this.centerChunkZ = centerZ;
      this.dirty = false;

      const candidates = [];
      const radius = this.preset.streamRadius;
      for (let dz = -radius; dz <= radius; dz += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const chunkX = centerX + dx;
          const chunkZ = centerZ + dz;
          if (chunkX < 0 || chunkZ < 0 || chunkX >= CHUNKS_PER_AXIS || chunkZ >= CHUNKS_PER_AXIS) continue;
          const distance = Math.hypot(dx, dz);
          if (distance > radius + 0.34) continue;
          candidates.push({ chunkX, chunkZ, distance, key: `${chunkX}:${chunkZ}` });
        }
      }
      candidates.sort((left, right) => left.distance - right.distance || left.chunkZ - right.chunkZ || left.chunkX - right.chunkX);
      const desired = candidates.slice(0, Math.min(this.preset.maxChunks, MAX_ACTIVE_CHUNKS));
      this.wanted.clear();
      for (const item of desired) this.wanted.set(item.key, { ...item, segments: this.segmentsForDistance(item.distance) });

      for (const [key, entry] of this.active) {
        if (this.wanted.has(key)) continue;
        safeDispose(entry.mesh);
        this.active.delete(key);
      }

      this.queue.length = 0;
      this.queued.clear();
      for (const item of desired) {
        const wanted = this.wanted.get(item.key);
        const current = this.active.get(item.key);
        if (current && current.segments === wanted.segments) continue;
        this.queue.push(wanted);
        this.queued.add(item.key);
        if (this.queue.length >= MAX_PENDING_CHUNKS) break;
      }
    }

    process(buildLimit) {
      if (this.disposed) return 0;
      const limit = Math.round(clamp(buildLimit || this.preset.chunkBuildsPerFrame, 1, 4));
      let built = 0;
      while (built < limit && this.queue.length) {
        const item = this.queue.shift();
        this.queued.delete(item.key);
        const wanted = this.wanted.get(item.key);
        if (!wanted || wanted.segments !== item.segments) continue;
        const current = this.active.get(item.key);
        if (current && current.segments === item.segments) continue;
        if (current) safeDispose(current.mesh);
        try {
          const mesh = buildTerrainChunk(this.B, this.scene, this.material, item.chunkX, item.chunkZ, item.segments, this.seed);
          this.active.set(item.key, { mesh, segments: item.segments });
          built += 1;
        } catch {
          this.active.delete(item.key);
        }
      }
      return built;
    }

    getStats() {
      return freezeRecord({ activeChunks: this.active.size, queuedChunks: this.queue.length, maxChunks: this.preset.maxChunks, chunkSize: CHUNK_SIZE });
    }

    dispose() {
      if (this.disposed) return;
      this.disposed = true;
      this.queue.length = 0;
      this.queued.clear();
      this.wanted.clear();
      for (const entry of this.active.values()) safeDispose(entry.mesh);
      this.active.clear();
      safeDispose(this.material);
    }
  }

  function createProxyMaterial(B, scene, name, hex, accent = false) {
    const material = new B.StandardMaterial(`hwe3d-proxy-${name}-${accent ? "accent" : "body"}`, scene);
    let color;
    try { color = typeof B.Color3.FromHexString === "function" ? B.Color3.FromHexString(hex) : new B.Color3(0.55, 0.45, 0.3); }
    catch { color = new B.Color3(0.55, 0.45, 0.3); }
    material.diffuseColor = accent ? new B.Color3(color.r * 0.72, color.g * 0.72, color.b * 0.72) : color;
    material.specularColor = new B.Color3(0.04, 0.04, 0.035);
    material.roughness = 0.95;
    if (typeof material.freeze === "function") material.freeze();
    return material;
  }

  function createProxyPart(B, scene, rootNode, material, definition) {
    const name = `${rootNode.name}-${definition.name}`;
    let mesh;
    if (definition.shape === "box") mesh = B.MeshBuilder.CreateBox(name, { size: 1 }, scene);
    else if (definition.shape === "cylinder") mesh = B.MeshBuilder.CreateCylinder(name, { height: 1, diameter: 1, tessellation: definition.tessellation || 8 }, scene);
    else mesh = B.MeshBuilder.CreateSphere(name, { diameter: 1, segments: definition.segments || 8 }, scene);
    mesh.parent = rootNode;
    mesh.position = new B.Vector3(definition.position[0], definition.position[1], definition.position[2]);
    mesh.scaling = new B.Vector3(definition.scale[0], definition.scale[1], definition.scale[2]);
    if (definition.rotation) mesh.rotation = new B.Vector3(definition.rotation[0], definition.rotation[1], definition.rotation[2]);
    mesh.material = material;
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    mesh.metadata = { eonwild: true, kind: "species-proxy-part", part: definition.name };
    return mesh;
  }

  function proxyDefinitions(speciesId) {
    if (speciesId === "triceratops") return [
      { name: "torso", shape: "sphere", position: [0, 2.1, 0], scale: [4.1, 1.75, 1.55] },
      { name: "head", shape: "sphere", position: [3.55, 2.15, 0], scale: [1.65, 1.2, 1.15] },
      { name: "frill", shape: "cylinder", position: [2.55, 2.8, 0], scale: [2.3, 0.38, 2.3], rotation: [Math.PI / 2, 0, 0], accent: true },
      { name: "horn-left", shape: "cylinder", position: [4.45, 3.05, -0.55], scale: [0.22, 1.45, 0.22], rotation: [0, 0, -1.08], accent: true },
      { name: "horn-right", shape: "cylinder", position: [4.45, 3.05, 0.55], scale: [0.22, 1.45, 0.22], rotation: [0, 0, -1.08], accent: true },
      { name: "leg-fl", shape: "cylinder", position: [2.2, 0.8, -0.85], scale: [0.58, 1.55, 0.58] },
      { name: "leg-fr", shape: "cylinder", position: [2.2, 0.8, 0.85], scale: [0.58, 1.55, 0.58] },
      { name: "leg-bl", shape: "cylinder", position: [-2.1, 0.8, -0.85], scale: [0.62, 1.55, 0.62] },
      { name: "leg-br", shape: "cylinder", position: [-2.1, 0.8, 0.85], scale: [0.62, 1.55, 0.62] },
      { name: "tail", shape: "cylinder", position: [-4.2, 2, 0], scale: [0.55, 3.4, 0.55], rotation: [0, 0, Math.PI / 2] }
    ];
    if (speciesId === "spinosaurus") return [
      { name: "torso", shape: "sphere", position: [0, 3.2, 0], scale: [4.5, 1.6, 1.3] },
      { name: "snout", shape: "sphere", position: [4.2, 3.75, 0], scale: [2.1, 0.7, 0.72] },
      { name: "sail", shape: "box", position: [-0.5, 5.5, 0], scale: [4.7, 4, 0.24], rotation: [0, 0, -0.08], accent: true },
      { name: "tail", shape: "cylinder", position: [-4.8, 3, 0], scale: [0.68, 4.3, 0.68], rotation: [0, 0, Math.PI / 2] },
      { name: "leg-left", shape: "cylinder", position: [-0.4, 1.3, -0.75], scale: [0.52, 2.1, 0.52] },
      { name: "leg-right", shape: "cylinder", position: [-0.4, 1.3, 0.75], scale: [0.52, 2.1, 0.52] },
      { name: "arm-left", shape: "cylinder", position: [2.2, 2.6, -0.8], scale: [0.22, 1.15, 0.22], rotation: [0.35, 0, -0.5] },
      { name: "arm-right", shape: "cylinder", position: [2.2, 2.6, 0.8], scale: [0.22, 1.15, 0.22], rotation: [-0.35, 0, -0.5] }
    ];
    if (speciesId === "pteranodon") return [
      { name: "body", shape: "sphere", position: [0, 0, 0], scale: [2.25, 0.62, 0.58] },
      { name: "head", shape: "sphere", position: [2.2, 0.25, 0], scale: [0.7, 0.55, 0.5] },
      { name: "beak", shape: "cylinder", position: [3.2, 0.17, 0], scale: [0.22, 1.5, 0.22], rotation: [0, 0, Math.PI / 2], accent: true },
      { name: "crest", shape: "box", position: [1.55, 0.85, 0], scale: [1.25, 0.65, 0.18], rotation: [0, 0, -0.4], accent: true },
      { name: "wing-left", shape: "box", position: [-0.2, 0, -3.2], scale: [3.5, 0.16, 5.8], rotation: [0, 0.1, 0], accent: true, wing: "left" },
      { name: "wing-right", shape: "box", position: [-0.2, 0, 3.2], scale: [3.5, 0.16, 5.8], rotation: [0, -0.1, 0], accent: true, wing: "right" }
    ];
    return [
      { name: "torso", shape: "sphere", position: [0, 3.2, 0], scale: [3.5, 1.55, 1.25] },
      { name: "head", shape: "sphere", position: [3.15, 4.05, 0], scale: [1.6, 0.9, 0.82] },
      { name: "jaw", shape: "box", position: [4.25, 3.75, 0], scale: [1.55, 0.4, 0.74], accent: true },
      { name: "tail", shape: "cylinder", position: [-4, 3, 0], scale: [0.58, 3.7, 0.58], rotation: [0, 0, Math.PI / 2] },
      { name: "leg-left", shape: "cylinder", position: [-0.2, 1.3, -0.62], scale: [0.55, 2.2, 0.55] },
      { name: "leg-right", shape: "cylinder", position: [-0.2, 1.3, 0.62], scale: [0.55, 2.2, 0.55] },
      { name: "arm-left", shape: "cylinder", position: [2, 3, -0.65], scale: [0.18, 0.85, 0.18], rotation: [0.35, 0, -0.45] },
      { name: "arm-right", shape: "cylinder", position: [2, 3, 0.65], scale: [0.18, 0.85, 0.18], rotation: [-0.35, 0, -0.45] }
    ];
  }

  function createSpeciesProxy(B, scene, species) {
    const rootNode = new B.TransformNode(`hwe3d-${species.id}`, scene);
    rootNode.metadata = { eonwild: true, kind: "species-proxy", speciesId: species.id, proxyOnly: true };
    const bodyMaterial = createProxyMaterial(B, scene, species.id, species.color, false);
    const accentMaterial = createProxyMaterial(B, scene, species.id, species.color, true);
    const parts = [];
    const wings = [];
    for (const definition of proxyDefinitions(species.id)) {
      const part = createProxyPart(B, scene, rootNode, definition.accent ? accentMaterial : bodyMaterial, definition);
      parts.push(part);
      if (definition.wing) wings.push({ mesh: part, side: definition.wing, baseRotation: part.rotation.x });
    }
    return { id: species.id, species, root: rootNode, parts, wings, materials: [bodyMaterial, accentMaterial], baseY: 0, flightOffset: species.locomotion === "fly" ? 18 : 0 };
  }

  class AdaptiveQualityGovernor {
    constructor(adapter, enabled) {
      this.adapter = adapter;
      this.enabled = enabled !== false;
      this.samples = [];
      this.lastEvaluation = now();
      this.slowWindows = 0;
      this.fastWindows = 0;
      this.p95 = 0;
      this.average = 0;
    }

    record(frameMs, timestamp) {
      const value = clamp(frameMs, 0.1, 250);
      this.samples.push({ at: timestamp, value });
      while (this.samples.length && (this.samples.length > MAX_FRAME_SAMPLES || this.samples[0].at < timestamp - 2000)) this.samples.shift();
      if (timestamp - this.lastEvaluation < 2000 || this.samples.length < 12) return;
      this.lastEvaluation = timestamp;
      const sorted = this.samples.map((sample) => sample.value).sort((a, b) => a - b);
      this.p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
      this.average = this.samples.reduce((sum, sample) => sum + sample.value, 0) / this.samples.length;
      if (!this.enabled) return;
      const preset = QUALITY_PRESETS[this.adapter._qualityPreset];
      const targetMs = 1000 / preset.targetFps;
      if (this.p95 > targetMs * 1.25) {
        this.slowWindows += 1;
        this.fastWindows = 0;
      } else if (this.p95 < targetMs * 0.72) {
        this.fastWindows += 1;
        this.slowWindows = 0;
      } else {
        this.slowWindows = 0;
        this.fastWindows = 0;
      }
      if (this.slowWindows >= 2) {
        this.slowWindows = 0;
        this.adapter._shiftAdaptiveQuality(-1, "frame-budget");
      } else if (this.fastWindows >= 4) {
        this.fastWindows = 0;
        this.adapter._shiftAdaptiveQuality(1, "frame-headroom");
      }
    }

    reset() {
      this.samples.length = 0;
      this.slowWindows = 0;
      this.fastWindows = 0;
      this.p95 = 0;
      this.average = 0;
      this.lastEvaluation = now();
    }
  }

  class EonWild3DAdapter {
    constructor(options = {}) {
      this._options = options && typeof options === "object" ? { ...options } : {};
      this._state = "idle";
      this._backend = null;
      this._failureReason = null;
      this._attempts = [];
      this._engine = null;
      this._scene = null;
      this._camera = null;
      this._canvas = null;
      this._container = null;
      this._ownsCanvas = false;
      this._manageCanvasVisibility = true;
      this._manageCanvasStyle = true;
      this._canvasCommitted = false;
      this._canvasStyleSnapshot = null;
      this._Babylon = null;
      this._streamer = null;
      this._water = null;
      this._lights = null;
      this._proxies = new Map();
      this._visibleWildlifeSpecies = new Set();
      this._playerSpeciesId = FLAGSHIP_IDS.includes(this._options.speciesId) ? this._options.speciesId : "tyrannosaurus";
      this._player = {
        x: clamp(this._options.playerX === undefined ? WORLD_HALF : this._options.playerX, 0, WORLD_SIZE),
        z: clamp(this._options.playerZ === undefined ? WORLD_HALF : this._options.playerZ, 0, WORLD_SIZE),
        heading: finite(this._options.heading, 0),
        elevation: finite(this._options.elevation, 0)
      };
      this._environment = {
        hour: clamp(this._options.timeOfDay === undefined ? 10.5 : this._options.timeOfDay, 0, 24),
        weather: "clear",
        fog: null,
        dayCycleMinutes: clamp(this._options.dayCycleMinutes || 0, 0, 1440)
      };
      this._qualityRequested = normalizePreset(this._options.qualityPreset || this._options.quality, "balanced");
      this._qualityPreset = this._qualityRequested;
      this._reducedMotionMode = this._options.reducedMotion === undefined ? "auto" : this._options.reducedMotion;
      this._reducedMotion = false;
      this._pausedByVisibility = false;
      this._pauseRequested = false;
      this._generation = 0;
      this._startPromise = null;
      this._cleanupCallbacks = [];
      this._resizeObserver = null;
      this._renderFrame = this._renderFrame.bind(this);
      this._lastFrameAt = 0;
      this._lastTelemetryAt = 0;
      this._elapsed = 0;
      this._governor = new AdaptiveQualityGovernor(this, this._options.adaptiveQuality !== false);
      this._capabilities = detectCapabilities({ babylon: this._options.babylon, document: this._options.document });
    }

    get status() { return this._state; }
    get backend() { return this._backend; }
    get canvas() { return this._canvas; }
    get scene() { return this._scene; }
    get engine() { return this._engine; }
    get failureReason() { return this._failureReason; }
    get capabilities() { return this._capabilities; }
    get qualityPreset() { return this._qualityPreset; }
    get reducedMotion() { return this._reducedMotion; }

    _emitStatus(extra = {}) {
      const detail = freezeRecord({
        status: this._state,
        backend: this._backend,
        qualityPreset: this._qualityPreset,
        reducedMotion: this._reducedMotion,
        reason: this._failureReason,
        ...extra
      });
      safeCall(this._options.onStatus, detail);
      const target = this._canvas || this._container;
      if (target && typeof target.dispatchEvent === "function" && typeof runtime.CustomEvent === "function") {
        try { target.dispatchEvent(new runtime.CustomEvent("hh:eonwild-renderer-status", { detail })); } catch { /* Optional DOM integration. */ }
      }
    }

    _fail(reason) {
      this._failureReason = reason;
      this._state = "failed";
      if (this._canvas && this._canvasCommitted && this._manageCanvasVisibility) this._canvas.hidden = true;
      this._emitStatus({ fallback: "canvas2d" });
      return makeResult(false, { status: this._state, reason });
    }

    _resolveMount(options) {
      const documentRef = options.document || runtime.document;
      let canvas = options.canvas || null;
      let container = options.container || options.mount || null;
      if (typeof canvas === "string" && documentRef && typeof documentRef.querySelector === "function") canvas = documentRef.querySelector(canvas);
      if (typeof container === "string" && documentRef && typeof documentRef.querySelector === "function") container = documentRef.querySelector(container);
      if (!container && canvas && canvas.parentElement) container = canvas.parentElement;
      if (!canvas) {
        if (!documentRef || typeof documentRef.createElement !== "function") {
          return { reason: makeReason("DOM_UNAVAILABLE", "A DOM canvas is required for the optional 3D renderer.", "mount", {}, true) };
        }
        if (!container || typeof container.appendChild !== "function") {
          return { reason: makeReason("MOUNT_TARGET_MISSING", "Pass a container (or a dedicated canvas) before starting 3D mode.", "mount", {}, true) };
        }
        canvas = documentRef.createElement("canvas");
        this._ownsCanvas = true;
      }
      if (!canvas || typeof canvas.getContext !== "function") {
        return { reason: makeReason("CANVAS_INVALID", "The configured 3D canvas is not a usable HTML canvas.", "mount", {}, true) };
      }
      return { canvas, container, documentRef };
    }

    async start(startOptions = {}) {
      if (this._state === "disposed") return makeResult(false, { status: this._state, reason: makeReason("ADAPTER_DISPOSED", "A disposed renderer cannot be restarted.", "lifecycle", {}, false) });
      if (this._state === "running" || this._state === "paused") return makeResult(true, { status: this._state, backend: this._backend, qualityPreset: this._qualityPreset });
      if (this._startPromise) return this._startPromise;
      if (this._state === "failed") {
        this._teardownGraphics();
        this._restoreCanvasPresentation();
        this._releaseOwnedCanvas();
        this._canvas = null;
      }
      const input = startOptions && typeof startOptions === "object" ? startOptions : {};
      const options = { ...this._options, ...input };
      const generation = ++this._generation;
      this._state = "starting";
      this._failureReason = null;
      this._attempts = [];
      this._emitStatus();
      this._startPromise = this._startInternal(options, generation).finally(() => { this._startPromise = null; });
      return this._startPromise;
    }

    async _startInternal(options, generation) {
      const mount = this._resolveMount(options);
      if (mount.reason) return this._fail(mount.reason);
      this._canvas = mount.canvas;
      this._container = mount.container;
      this._manageCanvasVisibility = options.manageCanvasVisibility !== false;
      this._manageCanvasStyle = options.manageCanvasStyle !== false;
      this._canvasCommitted = false;
      this._canvasStyleSnapshot = !this._ownsCanvas && this._canvas.style ? {
        width: this._canvas.style.width,
        height: this._canvas.style.height,
        display: this._canvas.style.display,
        touchAction: this._canvas.style.touchAction
      } : null;
      if (this._ownsCanvas) {
        this._canvas.hidden = true;
        this._canvas.className = options.canvasClassName || "hwe-render-surface hwe-render-surface--3d hwe-3d-canvas";
        this._canvas.setAttribute("data-hwe-3d-canvas", "");
        this._canvas.setAttribute("data-hwe-canvas-3d", "");
        this._canvas.setAttribute("aria-label", options.canvasLabel || "Thế giới 3D HH EonWild");
        this._canvas.setAttribute("role", "img");
        this._canvas.tabIndex = 0;
        this._canvas.style.width = "100%";
        this._canvas.style.height = "100%";
        this._canvas.style.display = "block";
        this._canvas.style.touchAction = "none";
      }

      let B;
      try {
        B = await loadBabylon({ ...options, document: mount.documentRef });
      } catch (error) {
        if (generation !== this._generation || this._state === "disposed") return makeResult(false, { status: this._state, reason: makeReason("START_CANCELLED", "3D startup was cancelled.", "lifecycle", {}, true) });
        this._releaseOwnedCanvas();
        return this._fail(makeReason("BABYLON_LOAD_FAILED", "Babylon.js was unavailable; 2D mode remains active.", "dependency", {
          error: compactError(error),
          failures: Array.isArray(error && error.failures) ? error.failures.slice(0, MAX_LOADER_URLS) : []
        }, true));
      }
      if (generation !== this._generation || this._state === "disposed") return makeResult(false, { status: this._state, reason: makeReason("START_CANCELLED", "3D startup was cancelled.", "lifecycle", {}, true) });
      if (!validateBabylonNamespace(B)) {
        this._releaseOwnedCanvas();
        return this._fail(makeReason("BABYLON_API_INCOMPLETE", "The loaded Babylon build does not contain the core scene APIs EonWild needs.", "dependency", {}, true));
      }

      this._Babylon = B;
      this._capabilities = detectCapabilities({ babylon: B, document: mount.documentRef });
      try {
        // Prime the backing store before WebGPU creates its swap chain. A
        // canvas without explicit dimensions starts at 300x150; resizing that
        // swap chain immediately after init can invalidate Chromium's first
        // D3D shared texture. Match Babylon's intended hardware scale up front
        // so the warm-up frame does not race a backing-store replacement.
        const startupScale = QUALITY_PRESETS[this._qualityPreset].renderScale;
        const cssWidth = Math.max(1, Math.round(this._canvas.clientWidth || this._container?.clientWidth || this._canvas.width || 1));
        const cssHeight = Math.max(1, Math.round(this._canvas.clientHeight || this._container?.clientHeight || this._canvas.height || 1));
        const backingWidth = Math.max(1, Math.round(cssWidth * startupScale));
        const backingHeight = Math.max(1, Math.round(cssHeight * startupScale));
        if (this._canvas.width !== backingWidth) this._canvas.width = backingWidth;
        if (this._canvas.height !== backingHeight) this._canvas.height = backingHeight;
        const created = await createBabylonEngine(B, this._canvas, this._capabilities, options);
        if (generation !== this._generation || this._state === "disposed") {
          safeDispose(created.engine);
          return makeResult(false, { status: this._state, reason: makeReason("START_CANCELLED", "3D startup was cancelled.", "lifecycle", {}, true) });
        }
        this._engine = created.engine;
        this._backend = created.backend;
        this._attempts = created.attempts.slice();
        this._buildScene(options);
        // Configure the swap-chain size before the first submitted frame. In
        // Chromium/D3D, resizing immediately after scene.render() can destroy
        // the frame's swap-buffer texture while WebGPU is still submitting it.
        // Besides producing a validation warning, affected drivers may show a
        // black first frame. Applying quality and resize first keeps startup
        // atomic and lets WebGL follow the same deterministic warm-up order.
        this._applyQuality(this._qualityPreset, "startup", false);
        if (typeof this._engine.resize === "function") this._engine.resize();
        this._streamer.update(this._player.x, this._player.z, true);
        this._streamer.process(2);
        this._scene.render();

        if (this._ownsCanvas && this._container && !this._canvas.parentNode) this._container.appendChild(this._canvas);
        if (!this._ownsCanvas && this._manageCanvasStyle && this._canvas.style) {
          this._canvas.style.width = "100%";
          this._canvas.style.height = "100%";
          this._canvas.style.display = "block";
          this._canvas.style.touchAction = "none";
        }
        if (this._manageCanvasVisibility) this._canvas.hidden = false;
        this._canvasCommitted = true;
        this._canvas.setAttribute("data-hwe-3d-backend", this._backend);
        this._installRuntimeListeners(mount.documentRef);
        this._state = this._pauseRequested || mount.documentRef && mount.documentRef.hidden ? "paused" : "running";
        this._pausedByVisibility = Boolean(mount.documentRef && mount.documentRef.hidden);
        this._lastFrameAt = now();
        if (this._state === "running") this._engine.runRenderLoop(this._renderFrame);
        this._emitStatus({ attempts: this._attempts.slice() });
        return makeResult(true, {
          status: this._state,
          backend: this._backend,
          qualityPreset: this._qualityPreset,
          capabilities: this._runtimeCapabilities(),
          attempts: this._attempts.slice()
        });
      } catch (error) {
        if (generation !== this._generation || this._state === "disposed") {
          this._teardownGraphics();
          this._releaseOwnedCanvas();
          return makeResult(false, { status: this._state, reason: makeReason("START_CANCELLED", "3D startup was cancelled.", "lifecycle", {}, true) });
        }
        const attempts = Array.isArray(error && error.attempts) ? error.attempts : this._attempts;
        const failureStage = this._scene ? "scene" : "engine";
        if (this._canvas && this._canvasCommitted && this._manageCanvasVisibility) this._canvas.hidden = true;
        this._teardownGraphics();
        this._restoreCanvasPresentation();
        this._releaseOwnedCanvas();
        return this._fail(makeReason(error && error.code || "SCENE_START_FAILED", "The 3D scene could not initialize; 2D mode remains active.", failureStage, {
          error: compactError(error), attempts: attempts.slice(0, 4)
        }, true));
      }
    }

    _buildScene(options) {
      const B = this._Babylon;
      const scene = new B.Scene(this._engine);
      this._scene = scene;
      scene.clearColor = new B.Color4(0.08, 0.15, 0.17, 1);
      scene.skipPointerMovePicking = true;
      scene.autoClear = true;

      const ambient = new B.HemisphericLight("hwe3d-ambient", new B.Vector3(0, 1, 0), scene);
      ambient.intensity = 0.72;
      ambient.groundColor = new B.Color3(0.12, 0.16, 0.13);
      const sun = new B.DirectionalLight("hwe3d-sun", new B.Vector3(-0.45, -0.78, 0.35), scene);
      sun.intensity = 1.05;
      sun.position = new B.Vector3(180, 280, -120);
      this._lights = { ambient, sun };

      const target = new B.Vector3(this._player.x - WORLD_HALF, terrainHeightNumeric(this._player.x, this._player.z, hashSeed(options.seed)) + 3, this._player.z - WORLD_HALF);
      const camera = new B.ArcRotateCamera("hwe3d-third-person-camera", -Math.PI / 2.2, 1.08, 27, target, scene);
      camera.lowerRadiusLimit = 10;
      camera.upperRadiusLimit = 72;
      camera.lowerBetaLimit = 0.45;
      camera.upperBetaLimit = 1.48;
      camera.wheelPrecision = 28;
      camera.panningSensibility = 0;
      camera.minZ = 0.15;
      camera.maxZ = QUALITY_PRESETS[this._qualityPreset].farClip;
      camera.inertia = 0.72;
      if (options.controls !== false && typeof camera.attachControl === "function") camera.attachControl(this._canvas, true);
      scene.activeCamera = camera;
      this._camera = camera;

      const waterMaterial = new B.StandardMaterial("hwe3d-water-material", scene);
      waterMaterial.diffuseColor = new B.Color3(0.08, 0.35, 0.43);
      waterMaterial.emissiveColor = new B.Color3(0.015, 0.07, 0.085);
      waterMaterial.specularColor = new B.Color3(0.38, 0.55, 0.58);
      waterMaterial.alpha = 0.68;
      waterMaterial.backFaceCulling = false;
      const water = B.MeshBuilder.CreateGround("hwe3d-water", { width: WORLD_SIZE, height: WORLD_SIZE, subdivisions: 1 }, scene);
      water.position.y = WATER_LEVEL;
      water.material = waterMaterial;
      water.isPickable = false;
      water.metadata = { eonwild: true, kind: "water-proxy", procedural: true };
      if (typeof water.freezeWorldMatrix === "function") water.freezeWorldMatrix();
      this._water = { mesh: water, material: waterMaterial };

      this._streamer = new TerrainStreamer(B, scene, { seed: options.seed || "eonwild-mesozoic", qualityPreset: this._qualityPreset });
      const placements = [
        [this._player.x, this._player.z],
        [this._player.x + 34, this._player.z + 22],
        [this._player.x - 42, this._player.z + 30],
        [this._player.x + 24, this._player.z - 45]
      ];
      this._visibleWildlifeSpecies.clear();
      FLAGSHIP_SPECIES.forEach((species, index) => {
        const proxy = createSpeciesProxy(B, scene, species);
        const worldX = clamp(placements[index][0], 8, WORLD_SIZE - 8);
        const worldZ = clamp(placements[index][1], 8, WORLD_SIZE - 8);
        proxy.baseY = terrainHeightNumeric(worldX, worldZ, this._streamer.seed) + proxy.flightOffset;
        proxy.root.position = new B.Vector3(worldX - WORLD_HALF, proxy.baseY, worldZ - WORLD_HALF);
        proxy.root.rotation.y = index * 1.45;
        if (typeof proxy.root.setEnabled === "function") proxy.root.setEnabled(species.id === this._playerSpeciesId);
        this._proxies.set(species.id, proxy);
      });
      this._applyPlayerPosition();
      this._applyEnvironment();
    }

    _runtimeCapabilities() {
      let engineCaps = {};
      try {
        const caps = this._engine && typeof this._engine.getCaps === "function" ? this._engine.getCaps() : {};
        engineCaps = {
          maxTextureSize: finite(caps.maxTextureSize, 0),
          maxMSAASamples: finite(caps.maxMSAASamples, 0),
          maxAnisotropy: finite(caps.maxAnisotropy, 0),
          instancing: Boolean(caps.instancedArrays),
          occlusionQueries: Boolean(caps.supportOcclusionQuery),
          computeShaders: Boolean(caps.supportComputeShaders)
        };
      } catch { /* Capability reporting is best effort. */ }
      return freezeRecord({
        ...this._capabilities,
        backend: this._backend,
        engine: freezeRecord(engineCaps),
        integrations: freezeRecord({ physics: "kinematic-proxy-only", rapier: false, recast: false, navmesh: false })
      });
    }

    _installRuntimeListeners(documentRef) {
      this._removeRuntimeListeners();
      const add = (target, type, handler, options) => {
        if (!target || typeof target.addEventListener !== "function") return;
        target.addEventListener(type, handler, options);
        this._cleanupCallbacks.push(() => { try { target.removeEventListener(type, handler, options); } catch { /* Cleanup only. */ } });
      };

      const visibilityHandler = () => {
        if (documentRef.hidden) {
          if (this._state === "running") {
            this._pausedByVisibility = true;
            this.pause("visibility");
          }
        } else if (this._pausedByVisibility) {
          this._pausedByVisibility = false;
          if (!this._pauseRequested) this.resume("visibility");
        }
      };
      add(documentRef, "visibilitychange", visibilityHandler, false);

      let observedWidth = Math.max(1, Math.round(this._canvas?.clientWidth || this._container?.clientWidth || 1));
      let observedHeight = Math.max(1, Math.round(this._canvas?.clientHeight || this._container?.clientHeight || 1));
      const resizeHandler = () => {
        const width = Math.max(1, Math.round(this._canvas?.clientWidth || this._container?.clientWidth || 1));
        const height = Math.max(1, Math.round(this._canvas?.clientHeight || this._container?.clientHeight || 1));
        // ResizeObserver always emits once after observe(). Skipping that
        // no-op callback prevents a WebGPU swap-chain rebuild from racing the
        // first submitted frame on Chromium/D3D.
        if (width === observedWidth && height === observedHeight) return;
        observedWidth = width;
        observedHeight = height;
        if (this._engine && typeof this._engine.resize === "function") this._engine.resize();
      };
      if (typeof runtime.ResizeObserver === "function" && this._container) {
        this._resizeObserver = new runtime.ResizeObserver(resizeHandler);
        this._resizeObserver.observe(this._container);
      } else add(runtime, "resize", resizeHandler, { passive: true });

      let mediaQuery = null;
      try { mediaQuery = runtime.matchMedia && runtime.matchMedia("(prefers-reduced-motion: reduce)"); } catch { /* Optional query. */ }
      const reducedHandler = (event) => {
        if (this._reducedMotionMode === "auto") this._setReducedMotionInternal(Boolean(event.matches));
      };
      if (mediaQuery) {
        this._setReducedMotionInternal(this._reducedMotionMode === "auto" ? Boolean(mediaQuery.matches) : Boolean(this._reducedMotionMode));
        if (typeof mediaQuery.addEventListener === "function") add(mediaQuery, "change", reducedHandler, false);
        else if (typeof mediaQuery.addListener === "function") {
          mediaQuery.addListener(reducedHandler);
          this._cleanupCallbacks.push(() => { try { mediaQuery.removeListener(reducedHandler); } catch { /* Legacy cleanup. */ } });
        }
      } else this._setReducedMotionInternal(Boolean(this._reducedMotionMode === true));

      const contextLost = (event) => {
        if (event && typeof event.preventDefault === "function") event.preventDefault();
        this._handleRuntimeFailure(makeReason("RENDER_CONTEXT_LOST", "The 3D graphics context was lost; return to 2D mode or retry 3D.", "runtime", { backend: this._backend }, true));
      };
      add(this._canvas, "webglcontextlost", contextLost, false);
      if (this._engine && this._engine.onContextLostObservable && typeof this._engine.onContextLostObservable.add === "function") {
        const observer = this._engine.onContextLostObservable.add(() => contextLost());
        this._cleanupCallbacks.push(() => { try { this._engine && this._engine.onContextLostObservable.remove(observer); } catch { /* Observer cleanup. */ } });
      }
    }

    _removeRuntimeListeners() {
      if (this._resizeObserver) {
        try { this._resizeObserver.disconnect(); } catch { /* Cleanup only. */ }
        this._resizeObserver = null;
      }
      while (this._cleanupCallbacks.length) {
        const cleanup = this._cleanupCallbacks.pop();
        try { cleanup(); } catch { /* Cleanup only. */ }
      }
    }

    _handleRuntimeFailure(reason) {
      if (this._state === "failed" || this._state === "disposed") return;
      try { this._engine && this._engine.stopRenderLoop(this._renderFrame); } catch { /* Engine may already be lost. */ }
      this._fail(reason);
    }

    _setReducedMotionInternal(value) {
      const next = Boolean(value);
      if (this._reducedMotion === next) return;
      this._reducedMotion = next;
      if (this._camera) this._camera.inertia = next ? 0 : 0.72;
      if (next && this._water && this._water.material) this._water.material.alpha = 0.68;
      if (next && QUALITY_ORDER.indexOf(this._qualityPreset) > QUALITY_ORDER.indexOf("low")) this._applyQuality("low", "reduced-motion", true);
      else if (!next && QUALITY_ORDER.indexOf(this._qualityPreset) < QUALITY_ORDER.indexOf(this._qualityRequested)) this._applyQuality(this._qualityRequested, "reduced-motion-ended", true);
      this._emitStatus({ change: "reduced-motion" });
    }

    setReducedMotion(value) {
      this._reducedMotionMode = value === "auto" ? "auto" : Boolean(value);
      let next = Boolean(value);
      if (value === "auto") {
        try { next = Boolean(runtime.matchMedia && runtime.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch { next = false; }
      }
      this._setReducedMotionInternal(next);
      return makeResult(true, { reducedMotion: this._reducedMotion, mode: this._reducedMotionMode });
    }

    _syncProxyVisibility(speciesId) {
      const proxy = this._proxies.get(speciesId);
      if (!proxy || typeof proxy.root.setEnabled !== "function") return;
      proxy.root.setEnabled(speciesId === this._playerSpeciesId || this._visibleWildlifeSpecies.has(speciesId));
    }

    _applyPlayerPosition() {
      const proxy = this._proxies.get(this._playerSpeciesId);
      if (!proxy || !this._streamer) return;
      const ground = terrainHeightNumeric(this._player.x, this._player.z, this._streamer.seed);
      proxy.baseY = ground + proxy.flightOffset + this._player.elevation;
      proxy.root.position.x = this._player.x - WORLD_HALF;
      proxy.root.position.y = proxy.baseY;
      proxy.root.position.z = this._player.z - WORLD_HALF;
      proxy.root.rotation.y = this._player.heading;
      if (this._streamer) this._streamer.update(this._player.x, this._player.z);
    }

    setPlayerState(state = {}) {
      if (!state || typeof state !== "object") return makeResult(false, { reason: makeReason("PLAYER_STATE_INVALID", "Player state must be an object.", "input", {}, true) });
      if (state.speciesId !== undefined) {
        const selected = this.selectSpecies(state.speciesId);
        if (!selected.ok) return selected;
      }
      if (state.x !== undefined) this._player.x = clamp(state.x, 0, WORLD_SIZE);
      if (state.z !== undefined || state.y !== undefined) this._player.z = clamp(state.z === undefined ? state.y : state.z, 0, WORLD_SIZE);
      if (state.heading !== undefined) this._player.heading = finite(state.heading, this._player.heading);
      if (state.elevation !== undefined) this._player.elevation = clamp(state.elevation, -20, 300);
      this._applyPlayerPosition();
      return makeResult(true, { player: freezeRecord({ ...this._player, speciesId: this._playerSpeciesId }) });
    }

    updatePlayer(state) { return this.setPlayerState(state); }

    selectSpecies(speciesId) {
      const id = String(speciesId || "").toLowerCase();
      if (!FLAGSHIP_IDS.includes(id)) return makeResult(false, { reason: makeReason("SPECIES_PROXY_UNAVAILABLE", "This foundation provides only four bounded Mesozoic proxy species.", "input", { supported: FLAGSHIP_IDS.slice() }, true) });
      const previousId = this._playerSpeciesId;
      this._playerSpeciesId = id;
      this._syncProxyVisibility(previousId);
      this._syncProxyVisibility(id);
      this._applyPlayerPosition();
      this._emitStatus({ change: "species", speciesId: id });
      return makeResult(true, { speciesId: id });
    }

    updateFlagship(speciesId, state = {}) {
      const proxy = this._proxies.get(String(speciesId || "").toLowerCase());
      if (!proxy) return makeResult(false, { reason: makeReason("SPECIES_PROXY_UNAVAILABLE", "No 3D proxy exists for this species.", "input", { speciesId }, true) });
      const worldX = clamp(state.x === undefined ? proxy.root.position.x + WORLD_HALF : state.x, 0, WORLD_SIZE);
      const worldZ = clamp(state.z === undefined ? (state.y === undefined ? proxy.root.position.z + WORLD_HALF : state.y) : state.z, 0, WORLD_SIZE);
      const altitude = proxy.flightOffset + clamp(state.elevation || 0, -20, 300);
      proxy.baseY = terrainHeightNumeric(worldX, worldZ, this._streamer ? this._streamer.seed : hashSeed(this._options.seed)) + altitude;
      proxy.root.position.x = worldX - WORLD_HALF;
      proxy.root.position.y = proxy.baseY;
      proxy.root.position.z = worldZ - WORLD_HALF;
      if (state.heading !== undefined) proxy.root.rotation.y = finite(state.heading, proxy.root.rotation.y);
      if (state.visible !== undefined) {
        if (state.visible) this._visibleWildlifeSpecies.add(proxy.id);
        else this._visibleWildlifeSpecies.delete(proxy.id);
        this._syncProxyVisibility(proxy.id);
      }
      return makeResult(true, { speciesId: proxy.id, x: worldX, z: worldZ, elevation: altitude });
    }

    setTimeOfDay(hour) {
      this._environment.hour = ((finite(hour, this._environment.hour) % 24) + 24) % 24;
      this._applyEnvironment();
      return makeResult(true, { hour: this._environment.hour });
    }

    setFog(value) {
      if (value === false || value === null) this._environment.fog = { enabled: false };
      else if (value && typeof value === "object") this._environment.fog = {
        enabled: value.enabled !== false,
        density: clamp(value.density === undefined ? 0.0018 : value.density, 0, 0.02),
        color: Array.isArray(value.color) ? value.color.slice(0, 3).map((channel) => clamp(channel, 0, 1)) : null
      };
      else this._environment.fog = { enabled: Boolean(value), density: 0.0018, color: null };
      this._applyEnvironment();
      return makeResult(true, { fog: freezeRecord({ ...this._environment.fog }) });
    }

    setWeather(value) {
      const weather = typeof value === "string" ? value : value && value.type;
      const allowed = ["clear", "mist", "rain", "storm", "ash"];
      this._environment.weather = allowed.includes(weather) ? weather : "clear";
      if (value && typeof value === "object" && value.dayCycleMinutes !== undefined) this._environment.dayCycleMinutes = clamp(value.dayCycleMinutes, 0, 1440);
      this._applyEnvironment();
      return makeResult(true, { weather: this._environment.weather });
    }

    setEnvironment(value = {}) {
      if (!value || typeof value !== "object") return makeResult(false, { reason: makeReason("ENVIRONMENT_INVALID", "Environment settings must be an object.", "input", {}, true) });
      if (value.timeOfDay !== undefined || value.hour !== undefined) this._environment.hour = ((finite(value.timeOfDay === undefined ? value.hour : value.timeOfDay, this._environment.hour) % 24) + 24) % 24;
      if (value.weather !== undefined) this.setWeather(value.weather);
      if (value.fog !== undefined) this.setFog(value.fog);
      if (value.dayCycleMinutes !== undefined) this._environment.dayCycleMinutes = clamp(value.dayCycleMinutes, 0, 1440);
      this._applyEnvironment();
      return makeResult(true, { environment: this.getEnvironment() });
    }

    getEnvironment() {
      return freezeRecord({ hour: this._environment.hour, weather: this._environment.weather, fog: this._environment.fog ? freezeRecord({ ...this._environment.fog }) : null, dayCycleMinutes: this._environment.dayCycleMinutes });
    }

    _applyEnvironment(announce = true) {
      if (!this._scene || !this._Babylon || !this._lights) return;
      const B = this._Babylon;
      const hour = this._environment.hour;
      const angle = (hour - 6) / 24 * Math.PI * 2;
      const elevation = Math.sin(angle);
      const daylight = clamp((elevation + 0.18) / 0.9, 0.04, 1);
      const dusk = 1 - clamp(Math.abs(elevation) * 4, 0, 1);
      const weatherFactors = {
        clear: { light: 1, fog: 0.00055 }, mist: { light: 0.83, fog: 0.0032 }, rain: { light: 0.72, fog: 0.0022 }, storm: { light: 0.48, fog: 0.0038 }, ash: { light: 0.58, fog: 0.0046 }
      };
      const weather = weatherFactors[this._environment.weather] || weatherFactors.clear;
      const sky = [
        lerp(0.025, 0.36, daylight) + dusk * 0.09,
        lerp(0.04, 0.59, daylight) + dusk * 0.035,
        lerp(0.09, 0.66, daylight)
      ];
      if (this._environment.weather === "storm") { sky[0] *= 0.55; sky[1] *= 0.62; sky[2] *= 0.68; }
      if (this._environment.weather === "ash") { sky[0] *= 0.82; sky[1] *= 0.6; sky[2] *= 0.46; }
      this._scene.clearColor = new B.Color4(sky[0], sky[1], sky[2], 1);
      this._lights.ambient.intensity = (0.18 + daylight * 0.58) * weather.light;
      this._lights.sun.intensity = (0.06 + daylight * 1.14) * weather.light;
      this._lights.sun.direction = new B.Vector3(-Math.cos(angle) * 0.66, -Math.max(0.08, elevation), Math.sin(angle) * 0.45);
      this._lights.sun.diffuse = new B.Color3(1, lerp(0.58, 0.96, daylight), lerp(0.38, 0.82, daylight));

      const override = this._environment.fog;
      const fogEnabled = !override || override.enabled !== false;
      this._scene.fogMode = fogEnabled ? B.Scene.FOGMODE_EXP2 : B.Scene.FOGMODE_NONE;
      this._scene.fogDensity = override && override.density !== undefined ? override.density : weather.fog;
      const fogColor = override && override.color || sky.map((channel) => channel * 0.82);
      this._scene.fogColor = makeColor3(B, fogColor);
      if (announce) safeCall(this._options.onEnvironmentChange, this.getEnvironment());
    }

    setQualityPreset(value, options = {}) {
      const preset = normalizePreset(value, "");
      if (!preset) return makeResult(false, { reason: makeReason("QUALITY_PRESET_INVALID", "Unknown graphics preset.", "input", { supported: QUALITY_ORDER.slice() }, true) });
      if (options.requested !== false) this._qualityRequested = preset;
      if (options.adaptive !== undefined) this._governor.enabled = Boolean(options.adaptive);
      this._applyQuality(preset, options.reason || "user", true);
      return makeResult(true, { qualityPreset: this._qualityPreset, requestedPreset: this._qualityRequested, adaptive: this._governor.enabled });
    }

    _applyQuality(value, reason, announce) {
      let presetId = normalizePreset(value);
      if (this._reducedMotion && QUALITY_ORDER.indexOf(presetId) > QUALITY_ORDER.indexOf("low")) presetId = "low";
      const preset = QUALITY_PRESETS[presetId];
      const changed = presetId !== this._qualityPreset;
      this._qualityPreset = presetId;
      if (this._engine && typeof this._engine.setHardwareScalingLevel === "function") {
        const targetScale = clamp(1 / preset.renderScale, 1, 2.25);
        const currentScale = typeof this._engine.getHardwareScalingLevel === "function" ? this._engine.getHardwareScalingLevel() : NaN;
        if (!Number.isFinite(currentScale) || Math.abs(currentScale - targetScale) > 0.001) this._engine.setHardwareScalingLevel(targetScale);
      }
      if (this._camera) this._camera.maxZ = preset.farClip;
      if (this._streamer) {
        this._streamer.configure(preset);
        this._streamer.update(this._player.x, this._player.z, true);
      }
      if (this._canvas) this._canvas.setAttribute("data-hwe-3d-quality", presetId);
      if (changed && announce) {
        const detail = freezeRecord({ qualityPreset: presetId, requestedPreset: this._qualityRequested, reason: String(reason || "unknown") });
        safeCall(this._options.onQualityChange, detail);
        this._emitStatus({ change: "quality", quality: detail });
      }
    }

    _shiftAdaptiveQuality(direction, reason) {
      const currentIndex = QUALITY_ORDER.indexOf(this._qualityPreset);
      const requestedIndex = QUALITY_ORDER.indexOf(this._qualityRequested);
      let targetIndex = clamp(currentIndex + Math.sign(direction), 0, requestedIndex);
      if (this._reducedMotion) targetIndex = Math.min(targetIndex, QUALITY_ORDER.indexOf("low"));
      if (targetIndex !== currentIndex) this._applyQuality(QUALITY_ORDER[targetIndex], reason, true);
    }

    _animateProxies(deltaSeconds) {
      if (this._reducedMotion) return;
      this._elapsed += deltaSeconds;
      let index = 0;
      for (const proxy of this._proxies.values()) {
        const phase = this._elapsed * (proxy.id === "pteranodon" ? 1.9 : 1.15) + index * 0.9;
        proxy.root.position.y = proxy.baseY + Math.sin(phase) * (proxy.id === "pteranodon" ? 0.45 : 0.075);
        for (const wing of proxy.wings) wing.mesh.rotation.x = wing.baseRotation + Math.sin(phase * 2.2) * (wing.side === "left" ? 0.22 : -0.22);
        index += 1;
      }
      if (this._water && this._water.material) this._water.material.alpha = 0.65 + Math.sin(this._elapsed * 0.45) * 0.025;
    }

    _followPlayer(deltaSeconds) {
      if (!this._camera || !this._Babylon) return;
      const proxy = this._proxies.get(this._playerSpeciesId);
      if (!proxy) return;
      const target = new this._Babylon.Vector3(proxy.root.position.x, proxy.root.position.y + (proxy.id === "pteranodon" ? 0.6 : 2.4), proxy.root.position.z);
      if (this._reducedMotion || !this._camera.target) this._camera.setTarget(target);
      else {
        const amount = 1 - Math.exp(-clamp(deltaSeconds, 0, 0.1) * 8);
        const next = new this._Babylon.Vector3(
          lerp(this._camera.target.x, target.x, amount),
          lerp(this._camera.target.y, target.y, amount),
          lerp(this._camera.target.z, target.z, amount)
        );
        this._camera.setTarget(next);
      }
    }

    _renderFrame() {
      if (this._state !== "running" || !this._scene || !this._engine) return;
      const startedAt = now();
      const rawDelta = this._lastFrameAt ? (startedAt - this._lastFrameAt) / 1000 : 1 / 60;
      const deltaSeconds = clamp(rawDelta, 0, 0.1);
      this._lastFrameAt = startedAt;
      try {
        if (this._environment.dayCycleMinutes > 0) {
          this._environment.hour = (this._environment.hour + deltaSeconds * 24 / (this._environment.dayCycleMinutes * 60)) % 24;
          this._applyEnvironment(false);
        }
        this._streamer.update(this._player.x, this._player.z);
        this._streamer.process(this._reducedMotion ? 1 : undefined);
        this._animateProxies(deltaSeconds);
        this._followPlayer(deltaSeconds);
        this._scene.render();
        const finishedAt = now();
        this._governor.record(Math.max(finishedAt - startedAt, rawDelta * 1000), finishedAt);
        if (finishedAt - this._lastTelemetryAt >= 1000) {
          this._lastTelemetryAt = finishedAt;
          safeCall(this._options.onTelemetry, this.getTelemetry());
        }
      } catch (error) {
        this._handleRuntimeFailure(makeReason("RENDER_LOOP_FAILED", "The 3D render loop stopped safely; 2D mode remains available.", "runtime", { error: compactError(error), backend: this._backend }, true));
      }
    }

    getTelemetry() {
      const streaming = this._streamer ? this._streamer.getStats() : freezeRecord({ activeChunks: 0, queuedChunks: 0, maxChunks: 0, chunkSize: CHUNK_SIZE });
      const average = this._governor.average;
      return freezeRecord({
        status: this._state,
        backend: this._backend,
        qualityPreset: this._qualityPreset,
        requestedPreset: this._qualityRequested,
        adaptiveQuality: this._governor.enabled,
        fps: average > 0 ? Math.round(1000 / average) : 0,
        frameTimeAverageMs: Math.round(average * 10) / 10,
        frameTimeP95Ms: Math.round(this._governor.p95 * 10) / 10,
        activeChunks: streaming.activeChunks,
        queuedChunks: streaming.queuedChunks,
        maxChunks: streaming.maxChunks,
        worldSize: WORLD_SIZE,
        reducedMotion: this._reducedMotion,
        hidden: Boolean((this._options.document || runtime.document) && (this._options.document || runtime.document).hidden),
        proxySpecies: FLAGSHIP_IDS.slice(),
        physics: "kinematic-proxy-only"
      });
    }

    async capture(mimeType = "image/png") {
      if (!this._engine || !this._camera || !this._canvas) throw new Error("The 3D renderer is not ready for capture.");
      const type = /^image\/(?:png|jpeg|webp)$/i.test(String(mimeType || "")) ? String(mimeType) : "image/png";
      const screenshot = this._Babylon?.Tools?.CreateScreenshotUsingRenderTargetAsync;
      if (typeof screenshot === "function") {
        const dataUrl = await screenshot(this._engine, this._camera, {
          width: Math.max(1, Math.trunc(this._canvas.width || this._canvas.clientWidth || 1)),
          height: Math.max(1, Math.trunc(this._canvas.height || this._canvas.clientHeight || 1))
        }, type);
        const encoded = String(dataUrl || "").split(",")[1];
        if (!encoded || typeof runtime.atob !== "function" || typeof runtime.Blob !== "function") throw new Error("The captured frame could not be encoded.");
        const binary = runtime.atob(encoded);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        return new runtime.Blob([bytes], { type });
      }
      return new Promise((resolve, reject) => {
        if (typeof this._canvas.toBlob !== "function") { reject(new Error("Canvas capture is unsupported.")); return; }
        this._canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Unable to capture the current frame.")), type);
      });
    }

    pause(cause = "user") {
      if (cause !== "visibility") this._pauseRequested = true;
      if (this._state === "starting" || this._state === "idle") {
        return makeResult(true, { status: this._state, pending: true, cause });
      }
      if (this._state !== "running") return makeResult(this._state === "paused", { status: this._state, cause });
      try { this._engine && this._engine.stopRenderLoop(this._renderFrame); } catch { /* Pausing must remain safe. */ }
      this._state = "paused";
      this._emitStatus({ cause: String(cause) });
      return makeResult(true, { status: this._state, cause });
    }

    resume(cause = "user") {
      if (cause !== "visibility") this._pauseRequested = false;
      else if (this._pauseRequested) return makeResult(false, { status: this._state, reason: makeReason("USER_PAUSED", "3D rendering remains paused until the user resumes it.", "lifecycle", {}, true) });
      if (this._state !== "paused") return makeResult(this._state === "running", { status: this._state, cause });
      const documentRef = this._options.document || runtime.document;
      if (documentRef && documentRef.hidden) {
        this._pausedByVisibility = true;
        return makeResult(false, { status: this._state, reason: makeReason("PAGE_HIDDEN", "3D rendering stays paused while the page is hidden.", "lifecycle", {}, true) });
      }
      this._pausedByVisibility = false;
      this._state = "running";
      this._lastFrameAt = now();
      this._engine.runRenderLoop(this._renderFrame);
      this._emitStatus({ cause: String(cause) });
      return makeResult(true, { status: this._state, cause });
    }

    _releaseOwnedCanvas() {
      if (this._ownsCanvas && this._canvas) {
        try { this._canvas.remove(); } catch { /* It may never have been attached. */ }
        this._canvas = null;
        this._ownsCanvas = false;
      }
      this._canvasCommitted = false;
    }

    _restoreCanvasPresentation() {
      if (!this._canvas || this._ownsCanvas) return;
      if (this._canvasStyleSnapshot && this._canvas.style) {
        this._canvas.style.width = this._canvasStyleSnapshot.width;
        this._canvas.style.height = this._canvasStyleSnapshot.height;
        this._canvas.style.display = this._canvasStyleSnapshot.display;
        this._canvas.style.touchAction = this._canvasStyleSnapshot.touchAction;
      }
      if (typeof this._canvas.removeAttribute === "function") {
        this._canvas.removeAttribute("data-hwe-3d-backend");
        this._canvas.removeAttribute("data-hwe-3d-quality");
      }
      this._canvasStyleSnapshot = null;
    }

    _teardownGraphics() {
      this._removeRuntimeListeners();
      try { this._engine && this._engine.stopRenderLoop(this._renderFrame); } catch { /* Cleanup only. */ }
      if (this._camera && typeof this._camera.detachControl === "function") {
        try { this._camera.detachControl(); } catch { /* Cleanup only. */ }
      }
      if (this._streamer) this._streamer.dispose();
      this._streamer = null;
      for (const proxy of this._proxies.values()) {
        safeDispose(proxy.root);
        for (const material of proxy.materials) safeDispose(material);
      }
      this._proxies.clear();
      this._visibleWildlifeSpecies.clear();
      if (this._water) {
        safeDispose(this._water.mesh);
        safeDispose(this._water.material);
      }
      this._water = null;
      safeDispose(this._scene);
      safeDispose(this._engine);
      this._scene = null;
      this._engine = null;
      this._camera = null;
      this._lights = null;
      this._Babylon = null;
      this._backend = null;
      this._governor.reset();
    }

    dispose() {
      if (this._state === "disposed") return makeResult(true, { status: this._state });
      this._generation += 1;
      this._teardownGraphics();
      if (this._canvas && this._manageCanvasVisibility) this._canvas.hidden = true;
      this._restoreCanvasPresentation();
      this._releaseOwnedCanvas();
      this._canvas = null;
      this._container = null;
      this._state = "disposed";
      this._failureReason = null;
      this._emitStatus();
      return makeResult(true, { status: this._state });
    }
  }

  function create(options) { return new EonWild3DAdapter(options); }
  function createRenderer(options) { return create(options); }
  let defaultAdapter = null;
  function getDefaultAdapter(options) {
    if (!defaultAdapter || defaultAdapter.status === "disposed") defaultAdapter = create(options);
    return defaultAdapter;
  }
  function start(options) { return getDefaultAdapter(options).start(options); }
  function pause(cause) { return defaultAdapter ? defaultAdapter.pause(cause) : makeResult(true, { status: "idle" }); }
  function resume(cause) { return defaultAdapter ? defaultAdapter.resume(cause) : makeResult(false, { status: "idle", reason: makeReason("ADAPTER_NOT_STARTED", "Start the optional 3D renderer before resuming it.", "lifecycle", {}, true) }); }
  function dispose() {
    if (!defaultAdapter) return makeResult(true, { status: "idle" });
    const result = defaultAdapter.dispose();
    defaultAdapter = null;
    return result;
  }
  function getStatus() {
    return defaultAdapter ? freezeRecord({ status: defaultAdapter.status, backend: defaultAdapter.backend, qualityPreset: defaultAdapter.qualityPreset, reason: defaultAdapter.failureReason }) : freezeRecord({ status: "idle", backend: null, qualityPreset: null, reason: null });
  }

  return Object.freeze({
    VERSION,
    version: VERSION,
    BABYLON_VERSION,
    WORLD_SIZE,
    CHUNK_SIZE,
    CHUNKS_PER_AXIS,
    WATER_LEVEL,
    MAX_ACTIVE_CHUNKS,
    DEFAULT_LOCAL_BABYLON_URL,
    DEFAULT_REMOTE_BABYLON_URL,
    FLAGSHIP_SPECIES,
    FLAGSHIP_IDS,
    QUALITY_PRESETS,
    detectCapabilities,
    loadBabylon,
    sampleTerrain,
    sampleTerrainHeight,
    create,
    createRenderer,
    start,
    pause,
    resume,
    dispose,
    getStatus,
    EonWild3DAdapter
  });
});
