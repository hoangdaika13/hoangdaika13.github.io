(function (global, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else global.HHGraphic3D = factory();
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const runtime = typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : {});
  const STORAGE_KEY = "hh.graphic-design-3d.scene.v2";
  const PROJECT_VERSION = 2;
  const THREE_VERSION = "r184";
  const THREE_MODULE_PATH = "vendor/three.module.min.js";
  const SCRIPT_BASE_URL = typeof document !== "undefined" && document.currentScript && document.currentScript.src
    ? new URL(".", document.currentScript.src).href
    : "";
  const MAX_OBJECTS = 160;
  const MAX_KEYFRAMES = 1200;
  const TYPE_LABELS = {
    group: "Nhóm",
    cube: "Khối hộp",
    sphere: "Khối cầu",
    plane: "Mặt phẳng",
    cylinder: "Hình trụ",
    cone: "Hình nón",
    torus: "Vòng xuyến",
    model: "Mô hình glTF/GLB"
  };
  const LIGHT_LABELS = { ambient: "Ánh sáng môi trường", directional: "Ánh sáng hướng", point: "Ánh sáng điểm", spot: "Đèn rọi" };
  const MATERIAL_DEFAULTS = {
    color: "#ef5fc9", emissive: "#000000", opacity: 1, roughness: 0.42,
    metalness: 0.08, envMapIntensity: 1, wireframe: false, side: "front",
    textureName: "", normalName: ""
  };

  let idSequence = 0;
  function makeId(prefix) {
    idSequence += 1;
    return `${prefix || "item"}-${Date.now().toString(36)}-${idSequence.toString(36)}`;
  }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value) || 0)); }
  function numberOr(value, fallback) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
  function bool(value, fallback) { return typeof value === "boolean" ? value : fallback; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function vector(value, fallback) {
    const source = value && typeof value === "object" ? value : {};
    return { x: numberOr(source.x, fallback.x), y: numberOr(source.y, fallback.y), z: numberOr(source.z, fallback.z) };
  }
  function transform(value) {
    return {
      position: vector(value && value.position, { x: 0, y: 0, z: 0 }),
      rotation: vector(value && value.rotation, { x: 0, y: 0, z: 0 }),
      scale: vector(value && value.scale, { x: 1, y: 1, z: 1 })
    };
  }
  function normalizeMaterial(value, type) {
    const source = value && typeof value === "object" ? value : {};
    const defaults = Object.assign({}, MATERIAL_DEFAULTS, {
      color: type === "sphere" ? "#65d7ff" : type === "plane" ? "#243746" : type === "torus" ? "#9ee66d" : "#ef5fc9"
    });
    return {
      color: typeof source.color === "string" ? source.color : defaults.color,
      emissive: typeof source.emissive === "string" ? source.emissive : defaults.emissive,
      opacity: clamp(numberOr(source.opacity, defaults.opacity), 0.02, 1),
      roughness: clamp(numberOr(source.roughness, defaults.roughness), 0, 1),
      metalness: clamp(numberOr(source.metalness, defaults.metalness), 0, 1),
      envMapIntensity: clamp(numberOr(source.envMapIntensity, defaults.envMapIntensity), 0, 4),
      wireframe: source.wireframe === true,
      side: ["front", "back", "double"].includes(source.side) ? source.side : defaults.side,
      textureName: typeof source.textureName === "string" ? source.textureName.slice(0, 120) : "",
      normalName: typeof source.normalName === "string" ? source.normalName.slice(0, 120) : ""
    };
  }
  function makeObject(type, overrides) {
    const safeType = Object.prototype.hasOwnProperty.call(TYPE_LABELS, type) ? type : "cube";
    const source = overrides && typeof overrides === "object" ? overrides : {};
    const base = {
      id: makeId("object"), name: TYPE_LABELS[safeType], type: safeType, parentId: null,
      visible: true, locked: false, transform: transform(), material: normalizeMaterial(null, safeType),
      physics: { dynamic: false, collision: safeType !== "group", trigger: false, mass: 1, velocity: { x: 0, y: 0, z: 0 } },
      asset: safeType === "model" ? { status: "required", fileName: "", format: "gltf", limitations: "Cần nhập lại file sau khi tải project" } : null
    };
    const result = Object.assign({}, base, source);
    result.id = typeof source.id === "string" && source.id ? source.id : base.id;
    result.name = typeof source.name === "string" && source.name.trim() ? source.name.trim().slice(0, 80) : base.name;
    result.parentId = typeof source.parentId === "string" ? source.parentId : null;
    result.transform = transform(source.transform);
    result.material = normalizeMaterial(source.material, safeType);
    result.physics = Object.assign({}, base.physics, source.physics || {});
    result.physics.velocity = vector(source.physics && source.physics.velocity, { x: 0, y: 0, z: 0 });
    result.asset = safeType === "model" ? Object.assign({}, base.asset, source.asset || {}) : null;
    return result;
  }
  function makeLight(type, overrides) {
    const safeType = Object.prototype.hasOwnProperty.call(LIGHT_LABELS, type) ? type : "directional";
    const source = overrides && typeof overrides === "object" ? overrides : {};
    return {
      id: typeof source.id === "string" ? source.id : makeId("light"),
      name: typeof source.name === "string" ? source.name.slice(0, 70) : LIGHT_LABELS[safeType],
      type: safeType, color: typeof source.color === "string" ? source.color : "#ffffff",
      intensity: clamp(numberOr(source.intensity, safeType === "ambient" ? 0.5 : 2), 0, 20),
      position: vector(source.position, { x: 4, y: 6, z: 4 }),
      castShadow: safeType !== "ambient" && source.castShadow !== false,
      distance: clamp(numberOr(source.distance, 25), 0, 200), angle: clamp(numberOr(source.angle, 0.6), 0.05, 1.5)
    };
  }
  function createDefaultScene() {
    const ground = makeObject("plane", {
      name: "Sàn studio", transform: { position: { x: 0, y: -1, z: 0 }, rotation: { x: -90, y: 0, z: 0 }, scale: { x: 12, y: 12, z: 1 } },
      material: { color: "#182933", roughness: 0.85, metalness: 0.05 }
    });
    const hero = makeObject("torus", {
      name: "Hero Torus", transform: { position: { x: 0, y: 0.5, z: 0 }, rotation: { x: 30, y: 20, z: 0 }, scale: { x: 1.3, y: 1.3, z: 1.3 } },
      material: { color: "#ef5fc9", emissive: "#190718", roughness: 0.22, metalness: 0.58 }
    });
    return {
      version: PROJECT_VERSION, name: "HH WebGL Studio",
      background: "#071019", environment: { fileName: "", mode: "none", intensity: 1 },
      grid: { visible: true, snap: true, size: 0.5 },
      camera: { yaw: 42, pitch: 25, zoom: 1, distance: 8, fov: 45, near: 0.05, far: 500, keyframes: [] },
      renderer: { shadows: true, toneMapping: "aces", exposure: 1, fog: false, fogDensity: 0.025, dof: { enabled: false, focus: 8, aperture: 0.025, supported: false } },
      lights: [
        makeLight("ambient", { name: "Ambient", intensity: 0.55, castShadow: false }),
        makeLight("directional", { name: "Key", intensity: 3.2, position: { x: 5, y: 7, z: 4 } }),
        makeLight("point", { name: "Rim", color: "#65d7ff", intensity: 18, position: { x: -4, y: 3, z: -3 }, distance: 20, castShadow: false })
      ],
      objects: [ground, hero],
      particles: [],
      physics: { enabled: false, gravity: -9.81, floorY: -1, lastTrigger: "" },
      timeline: { currentTime: 0, duration: 6, playing: false, loop: true, keyframes: [], markers: [] },
      meta: { assetPolicy: "WebGL2 local; asset nhị phân cần nhập lại sau khi tải project", updatedAt: new Date().toISOString() }
    };
  }
  function normalizeScene(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const base = createDefaultScene();
    const objectSource = Array.isArray(source.objects) ? source.objects.slice(0, MAX_OBJECTS) : base.objects;
    const objects = objectSource.map((item) => makeObject(item && item.type, item));
    const ids = new Set(objects.map((item) => item.id));
    objects.forEach((item) => { if (!ids.has(item.parentId) || item.parentId === item.id) item.parentId = null; });
    const cameraSource = source.camera && typeof source.camera === "object" ? source.camera : {};
    const timelineSource = source.timeline && typeof source.timeline === "object" ? source.timeline : {};
    const rendererSource = source.renderer && typeof source.renderer === "object" ? source.renderer : {};
    const physicsSource = source.physics && typeof source.physics === "object" ? source.physics : {};
    const keyframes = Array.isArray(timelineSource.keyframes) ? timelineSource.keyframes.slice(-MAX_KEYFRAMES) : [];
    const cameraFrames = Array.isArray(cameraSource.keyframes) ? cameraSource.keyframes.slice(-MAX_KEYFRAMES) : [];
    return {
      version: PROJECT_VERSION,
      name: typeof source.name === "string" && source.name.trim() ? source.name.trim().slice(0, 100) : base.name,
      background: typeof source.background === "string" ? source.background : base.background,
      environment: Object.assign({}, base.environment, source.environment || {}),
      grid: { visible: !(source.grid && source.grid.visible === false), snap: !(source.grid && source.grid.snap === false), size: clamp(numberOr(source.grid && source.grid.size, 0.5), 0.1, 10) },
      camera: {
        yaw: clamp(numberOr(cameraSource.yaw, base.camera.yaw), -180, 180), pitch: clamp(numberOr(cameraSource.pitch, base.camera.pitch), -85, 85),
        zoom: clamp(numberOr(cameraSource.zoom, base.camera.zoom), 0.25, 4), distance: clamp(numberOr(cameraSource.distance, base.camera.distance), 1, 100),
        fov: clamp(numberOr(cameraSource.fov, base.camera.fov), 10, 100), near: clamp(numberOr(cameraSource.near, base.camera.near), 0.001, 10),
        far: clamp(numberOr(cameraSource.far, base.camera.far), 10, 5000),
        keyframes: cameraFrames.map((frame) => ({ id: frame.id || makeId("camera-frame"), time: clamp(numberOr(frame.time, 0), 0, 120), yaw: numberOr(frame.yaw, 0), pitch: numberOr(frame.pitch, 20), distance: numberOr(frame.distance, 8), target: vector(frame.target, { x: 0, y: 0, z: 0 }) }))
      },
      renderer: {
        shadows: rendererSource.shadows !== false,
        toneMapping: ["none", "linear", "reinhard", "cineon", "aces"].includes(rendererSource.toneMapping) ? rendererSource.toneMapping : base.renderer.toneMapping,
        exposure: clamp(numberOr(rendererSource.exposure, 1), 0.1, 4), fog: rendererSource.fog === true,
        fogDensity: clamp(numberOr(rendererSource.fogDensity, 0.025), 0.001, 0.2),
        dof: Object.assign({}, base.renderer.dof, rendererSource.dof || {}, { supported: false })
      },
      lights: Array.isArray(source.lights) && source.lights.length ? source.lights.slice(0, 12).map((light) => makeLight(light.type, light)) : base.lights,
      objects: objects.length ? objects : base.objects,
      particles: Array.isArray(source.particles) ? source.particles.slice(0, 12).map((item) => ({ id: item.id || makeId("particles"), name: String(item.name || "Particle Field").slice(0, 70), count: clamp(numberOr(item.count, 500), 10, 10000), size: clamp(numberOr(item.size, 0.04), 0.005, 1), color: typeof item.color === "string" ? item.color : "#65d7ff", spread: clamp(numberOr(item.spread, 7), 0.5, 100), speed: clamp(numberOr(item.speed, 0.2), 0, 10) })) : [],
      physics: { enabled: physicsSource.enabled === true, gravity: clamp(numberOr(physicsSource.gravity, -9.81), -100, 100), floorY: numberOr(physicsSource.floorY, -1), lastTrigger: "" },
      timeline: {
        currentTime: clamp(numberOr(timelineSource.currentTime, 0), 0, 120), duration: clamp(numberOr(timelineSource.duration, 6), 1, 120),
        playing: false, loop: timelineSource.loop !== false,
        keyframes: keyframes.filter((frame) => frame && ids.has(frame.objectId)).map((frame) => ({ id: frame.id || makeId("keyframe"), objectId: frame.objectId, time: clamp(numberOr(frame.time, 0), 0, 120), transform: transform(frame.transform) })),
        markers: Array.isArray(timelineSource.markers) ? timelineSource.markers.slice(0, 100).map((marker) => ({ id: marker.id || makeId("marker"), time: clamp(numberOr(marker.time, 0), 0, 120), label: String(marker.label || "Marker").slice(0, 60) })) : []
      },
      meta: Object.assign({}, base.meta, source.meta || {}, { updatedAt: new Date().toISOString() })
    };
  }
  function snapValue(value, enabled, size) {
    if (!enabled) return numberOr(value, 0);
    const step = Math.max(0.1, numberOr(size, 0.5));
    return Math.round(numberOr(value, 0) / step) * step;
  }
  function interpolate(a, b, ratio) { return numberOr(a, 0) + (numberOr(b, 0) - numberOr(a, 0)) * ratio; }
  function transformAt(object, scene, time) {
    const frames = scene.timeline.keyframes.filter((frame) => frame.objectId === object.id).sort((a, b) => a.time - b.time);
    if (!frames.length) return clone(object.transform);
    if (time <= frames[0].time) return clone(frames[0].transform);
    if (time >= frames[frames.length - 1].time) return clone(frames[frames.length - 1].transform);
    const nextIndex = frames.findIndex((frame) => frame.time >= time);
    const previous = frames[Math.max(0, nextIndex - 1)];
    const next = frames[nextIndex];
    const ratio = (time - previous.time) / Math.max(0.0001, next.time - previous.time);
    return {
      position: { x: interpolate(previous.transform.position.x, next.transform.position.x, ratio), y: interpolate(previous.transform.position.y, next.transform.position.y, ratio), z: interpolate(previous.transform.position.z, next.transform.position.z, ratio) },
      rotation: { x: interpolate(previous.transform.rotation.x, next.transform.rotation.x, ratio), y: interpolate(previous.transform.rotation.y, next.transform.rotation.y, ratio), z: interpolate(previous.transform.rotation.z, next.transform.rotation.z, ratio) },
      scale: { x: interpolate(previous.transform.scale.x, next.transform.scale.x, ratio), y: interpolate(previous.transform.scale.y, next.transform.scale.y, ratio), z: interpolate(previous.transform.scale.z, next.transform.scale.z, ratio) }
    };
  }
  function cameraAt(scene, time) {
    const frames = scene.camera.keyframes.slice().sort((a, b) => a.time - b.time);
    if (!frames.length) return { yaw: scene.camera.yaw, pitch: scene.camera.pitch, distance: scene.camera.distance, target: { x: 0, y: 0, z: 0 } };
    if (time <= frames[0].time) return clone(frames[0]);
    if (time >= frames[frames.length - 1].time) return clone(frames[frames.length - 1]);
    const nextIndex = frames.findIndex((frame) => frame.time >= time);
    const a = frames[nextIndex - 1]; const b = frames[nextIndex]; const ratio = (time - a.time) / Math.max(0.0001, b.time - a.time);
    return { yaw: interpolate(a.yaw, b.yaw, ratio), pitch: interpolate(a.pitch, b.pitch, ratio), distance: interpolate(a.distance, b.distance, ratio), target: { x: interpolate(a.target.x, b.target.x, ratio), y: interpolate(a.target.y, b.target.y, ratio), z: interpolate(a.target.z, b.target.z, ratio) } };
  }

  function detectCapabilities(scope) {
    const target = scope || runtime;
    let webgl2 = false;
    try {
      const canvas = target.document && target.document.createElement ? target.document.createElement("canvas") : null;
      webgl2 = Boolean(canvas && canvas.getContext && canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }));
    } catch (error) { webgl2 = false; }
    return {
      webgl2,
      webgpu: Boolean(target.navigator && target.navigator.gpu),
      offscreenCanvas: typeof target.OffscreenCanvas !== "undefined",
      imageBitmap: typeof target.createImageBitmap === "function",
      reducedMotion: Boolean(target.matchMedia && target.matchMedia("(prefers-reduced-motion: reduce)").matches)
    };
  }

  function projectPoint(point, camera, width, height) {
    const yaw = numberOr(camera.yaw, 45) * Math.PI / 180;
    const pitch = numberOr(camera.pitch, 30) * Math.PI / 180;
    const scale = Math.min(width, height) * .105 * numberOr(camera.zoom, 1);
    const horizontal = point.x * Math.cos(yaw) + point.z * Math.sin(yaw);
    const depth = -point.x * Math.sin(yaw) + point.z * Math.cos(yaw);
    return { x: width / 2 + horizontal * scale, y: height / 2 - point.y * scale + depth * scale * Math.sin(pitch) };
  }

  function renderFallback(canvas, scene, selectedId) {
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width || canvas.clientWidth || 640));
    const height = Math.max(1, Math.floor(rect.height || canvas.clientHeight || 400));
    const dpr = Math.min(runtime.devicePixelRatio || 1, 2);
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) { canvas.width = width * dpr; canvas.height = height * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = scene.background;
    ctx.fillRect(0, 0, width, height);
    if (scene.grid.visible) {
      ctx.strokeStyle = "rgba(101,215,223,.12)"; ctx.lineWidth = 1;
      const step = Math.max(24, Math.min(width, height) / 12);
      for (let x = width / 2 % step; x < width; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
      for (let y = height / 2 % step; y < height; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    }
    scene.objects.filter((object) => object.visible && object.type !== "group").forEach((object) => {
      const active = transformAt(object, scene, scene.timeline.currentTime);
      const projected = projectPoint(active.position, scene.camera, width, height);
      const size = Math.max(12, 42 * Math.max(active.scale.x, active.scale.y) * scene.camera.zoom);
      ctx.save(); ctx.globalAlpha = object.material.opacity; ctx.fillStyle = object.material.color; ctx.strokeStyle = object.id === selectedId ? "#ffffff" : "rgba(101,215,223,.75)"; ctx.lineWidth = object.id === selectedId ? 3 : 1;
      if (object.type === "sphere" || object.type === "torus") { ctx.beginPath(); ctx.arc(projected.x, projected.y, size / 2, 0, Math.PI * 2); if (object.type === "torus") { ctx.lineWidth = Math.max(4, size * .2); ctx.stroke(); } else { ctx.fill(); ctx.stroke(); } }
      else { ctx.fillRect(projected.x - size / 2, projected.y - size / 2, size, size); ctx.strokeRect(projected.x - size / 2, projected.y - size / 2, size, size); }
      ctx.restore();
    });
    ctx.fillStyle = "rgba(232,242,245,.72)"; ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("Canvas 2D fallback · dữ liệu chỉnh sửa vẫn được bảo toàn", 12, height - 14);
  }

  function base64FromBytes(bytes) {
    if (typeof Buffer !== "undefined") return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");
    let binary = ""; const chunk = 0x8000;
    for (let index = 0; index < bytes.length; index += chunk) binary += String.fromCharCode.apply(null, bytes.subarray(index, Math.min(bytes.length, index + chunk)));
    return btoa(binary);
  }
  function eulerQuaternion(rotation) {
    const x = numberOr(rotation.x, 0) * Math.PI / 360; const y = numberOr(rotation.y, 0) * Math.PI / 360; const z = numberOr(rotation.z, 0) * Math.PI / 360;
    const c1 = Math.cos(x), c2 = Math.cos(y), c3 = Math.cos(z), s1 = Math.sin(x), s2 = Math.sin(y), s3 = Math.sin(z);
    return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3];
  }
  function primitiveGeometry(type) {
    if (type === "cube") return { positions: [-.5,-.5,.5,.5,-.5,.5,.5,.5,.5,-.5,.5,.5,-.5,-.5,-.5,-.5,.5,-.5,.5,.5,-.5,.5,-.5,-.5], indices: [0,1,2,0,2,3,1,5,6,1,6,2,5,4,7,5,7,6,4,0,3,4,3,7,3,2,6,3,6,7,4,5,1,4,1,0] };
    if (type === "plane") return { positions: [-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0], indices: [0,1,2,0,2,3] };
    const positions = []; const indices = [];
    if (type === "sphere") {
      const lat = 12, lon = 18;
      for (let y = 0; y <= lat; y += 1) for (let x = 0; x <= lon; x += 1) { const v = y / lat, u = x / lon, p = v * Math.PI, t = u * Math.PI * 2; positions.push(Math.sin(p) * Math.cos(t) * .5, Math.cos(p) * .5, Math.sin(p) * Math.sin(t) * .5); }
      for (let y = 0; y < lat; y += 1) for (let x = 0; x < lon; x += 1) { const a = y * (lon + 1) + x, b = a + lon + 1; indices.push(a,b,a+1,b,b+1,a+1); }
      return { positions, indices };
    }
    const segments = 24; const topRadius = type === "cone" ? 0 : .5; const bottomRadius = type === "torus" ? .25 : .5;
    if (type === "torus") {
      const tube = 10;
      for (let j = 0; j <= tube; j += 1) for (let i = 0; i <= segments; i += 1) { const u = i / segments * Math.PI * 2, v = j / tube * Math.PI * 2, r = .34 + .14 * Math.cos(v); positions.push(r * Math.cos(u), .14 * Math.sin(v), r * Math.sin(u)); }
      for (let j = 0; j < tube; j += 1) for (let i = 0; i < segments; i += 1) { const a = j * (segments + 1) + i, b = a + segments + 1; indices.push(a,b,a+1,b,b+1,a+1); }
      return { positions, indices };
    }
    for (let y = 0; y <= 1; y += 1) for (let i = 0; i <= segments; i += 1) { const angle = i / segments * Math.PI * 2, radius = y ? topRadius : bottomRadius; positions.push(Math.cos(angle) * radius, y - .5, Math.sin(angle) * radius); }
    for (let i = 0; i < segments; i += 1) { const a = i, b = i + segments + 1; indices.push(a,b,a+1,b,b+1,a+1); }
    return { positions, indices };
  }
  function buildGltf(sceneInput) {
    const scene = normalizeScene(sceneInput);
    const chunks = []; const bufferViews = []; const accessors = []; const meshes = []; const materials = []; const nodes = [];
    let byteOffset = 0;
    function append(typed, target) {
      const padding = (4 - (byteOffset % 4)) % 4;
      if (padding) { chunks.push(new Uint8Array(padding)); byteOffset += padding; }
      const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
      const index = bufferViews.length; bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.byteLength, target }); chunks.push(bytes); byteOffset += bytes.byteLength; return index;
    }
    scene.objects.forEach((object) => {
      const node = { name: object.name, translation: [object.transform.position.x, object.transform.position.y, object.transform.position.z], rotation: eulerQuaternion(object.transform.rotation), scale: [object.transform.scale.x, object.transform.scale.y, object.transform.scale.z], extras: { hhId: object.id, hhType: object.type } };
      const geometry = primitiveGeometry(object.type);
      if (geometry) {
        const positions = new Float32Array(geometry.positions); const IndexType = positions.length / 3 > 65535 ? Uint32Array : Uint16Array; const indices = new IndexType(geometry.indices);
        const positionView = append(positions, 34962); const indexView = append(indices, 34963);
        const xs = [], ys = [], zs = []; for (let i = 0; i < positions.length; i += 3) { xs.push(positions[i]); ys.push(positions[i + 1]); zs.push(positions[i + 2]); }
        const positionAccessor = accessors.length; accessors.push({ bufferView: positionView, componentType: 5126, count: positions.length / 3, type: "VEC3", min: [Math.min(...xs), Math.min(...ys), Math.min(...zs)], max: [Math.max(...xs), Math.max(...ys), Math.max(...zs)] });
        const indexAccessor = accessors.length; accessors.push({ bufferView: indexView, componentType: indices instanceof Uint32Array ? 5125 : 5123, count: indices.length, type: "SCALAR" });
        const materialIndex = materials.length; const color = object.material.color.replace("#", ""); const rgb = [parseInt(color.slice(0,2),16)/255,parseInt(color.slice(2,4),16)/255,parseInt(color.slice(4,6),16)/255,object.material.opacity];
        materials.push({ name: `${object.name} Material`, pbrMetallicRoughness: { baseColorFactor: rgb, metallicFactor: object.material.metalness, roughnessFactor: object.material.roughness }, alphaMode: object.material.opacity < 1 ? "BLEND" : "OPAQUE", doubleSided: object.material.side === "double" });
        node.mesh = meshes.length; meshes.push({ name: object.name, primitives: [{ attributes: { POSITION: positionAccessor }, indices: indexAccessor, material: materialIndex, mode: 4 }] });
      } else if (object.type === "model") node.extras.importedAsset = Object.assign({}, object.asset, { geometryEmbedded: false });
      nodes.push(node);
    });
    scene.objects.forEach((object, index) => {
      const children = scene.objects.map((candidate, childIndex) => candidate.parentId === object.id ? childIndex : -1).filter((childIndex) => childIndex >= 0);
      if (children.length) nodes[index].children = children;
    });
    const roots = scene.objects.map((object, index) => object.parentId ? -1 : index).filter((index) => index >= 0);
    const merged = new Uint8Array(byteOffset); let cursor = 0; chunks.forEach((chunk) => { merged.set(chunk, cursor); cursor += chunk.byteLength; });
    return { asset: { version: "2.0", generator: `HH Graphic 3D Studio ${PROJECT_VERSION} / Three.js ${THREE_VERSION}` }, scene: 0, scenes: [{ name: scene.name, nodes: roots }], nodes, meshes, materials, buffers: [{ byteLength: merged.byteLength, uri: `data:application/octet-stream;base64,${base64FromBytes(merged)}` }], bufferViews, accessors, extras: { hhNotice: "Primitive geometry is embedded. Imported model geometry must be re-exported from its source asset." } };
  }
  function parseGlb(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    if (view.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67) throw new Error("Không phải file GLB hợp lệ");
    if (view.getUint32(4, true) !== 2) throw new Error("Chỉ hỗ trợ GLB 2.0");
    let offset = 12; let json = null; let bin = null;
    while (offset + 8 <= view.byteLength) {
      const length = view.getUint32(offset, true); const type = view.getUint32(offset + 4, true); offset += 8;
      if (offset + length > view.byteLength) throw new Error("GLB bị cắt hoặc hỏng");
      const bytes = new Uint8Array(arrayBuffer, offset, length);
      if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(bytes).replace(/\u0000+$/g, ""));
      if (type === 0x004e4942) bin = bytes.slice().buffer;
      offset += length;
    }
    if (!json) throw new Error("GLB thiếu JSON chunk");
    return { json, bin };
  }
  function decodeDataUri(uri) {
    const comma = uri.indexOf(","); if (!uri.startsWith("data:") || comma < 0) throw new Error("Data URI không hợp lệ");
    const meta = uri.slice(0, comma); const payload = uri.slice(comma + 1);
    if (/;base64/i.test(meta)) {
      if (typeof Buffer !== "undefined") return Uint8Array.from(Buffer.from(payload, "base64")).buffer;
      const text = atob(payload); const bytes = new Uint8Array(text.length); for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i); return bytes.buffer;
    }
    return new TextEncoder().encode(decodeURIComponent(payload)).buffer;
  }

  function htmlEscape(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }
  function downloadBlob(filename, blob) {
    if (typeof document === "undefined" || typeof URL === "undefined") return false;
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0); return true;
  }
  function downloadText(filename, text, type) { return downloadBlob(filename, new Blob([text], { type: type || "application/json" })); }
  function styles() {
    return `
      .hh-g3d{--bg:#060b11;--panel:#0d151e;--panel2:#111c26;--line:#263946;--text:#e8f2f5;--muted:#8da4af;--cyan:#65d7df;--pink:#f15bbb;--green:#78dfa9;display:grid;grid-template-rows:auto 1fr;min-height:720px;color:var(--text);background:radial-gradient(circle at 76% 8%,rgba(101,215,223,.12),transparent 34%),radial-gradient(circle at 18% 0,rgba(241,91,187,.13),transparent 30%),var(--bg);font:13px/1.45 Inter,ui-sans-serif,system-ui,sans-serif;border:1px solid var(--line);border-radius:12px;overflow:hidden;letter-spacing:0}
      .hh-g3d *{box-sizing:border-box;letter-spacing:0}.hh-g3d button,.hh-g3d input,.hh-g3d select{font:inherit;color:inherit}.g3d-header{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--line);background:rgba(13,21,30,.9);backdrop-filter:blur(14px)}.g3d-brand{display:flex;align-items:center;gap:9px;min-width:190px}.g3d-mark{display:grid;place-items:center;width:34px;height:34px;border-radius:8px;background:linear-gradient(135deg,var(--pink),var(--cyan));color:#071017;font-weight:900}.g3d-title{font-weight:850}.g3d-subtitle{display:block;color:var(--muted);font-size:10px}.g3d-scene-name{flex:1;min-width:140px;padding:8px 10px;border:1px solid var(--line);border-radius:7px;background:#091018}.g3d-actions{display:flex;gap:6px;flex-wrap:wrap}.g3d-button{min-height:30px;padding:5px 9px;border:1px solid var(--line);border-radius:7px;background:#111b25;cursor:pointer;transition:transform .16s ease,border-color .16s ease,background .16s ease}.g3d-button:hover,.g3d-button:focus-visible{border-color:var(--cyan);background:#162a35;transform:translateY(-1px);outline:2px solid rgba(101,215,223,.18);outline-offset:1px}.g3d-button.is-primary{border-color:transparent;background:linear-gradient(135deg,var(--pink),var(--cyan));color:#061016;font-weight:800}.g3d-button.is-active{border-color:var(--cyan);background:rgba(101,215,223,.15);color:#bdf8fc}.g3d-button.is-danger{color:#ff9cba}.g3d-button:disabled{opacity:.42;cursor:not-allowed;transform:none}.g3d-layout{display:grid;grid-template-columns:250px minmax(0,1fr) 275px;min-height:0}.g3d-sidebar,.g3d-inspector{min-width:0;overflow:auto;background:rgba(13,21,30,.82)}.g3d-sidebar{border-right:1px solid var(--line)}.g3d-inspector{border-left:1px solid var(--line)}.g3d-panel{padding:12px}.g3d-panel+.g3d-panel{border-top:1px solid var(--line)}.g3d-panel h2{margin:0 0 9px;color:var(--cyan);font-size:10px;text-transform:uppercase}.g3d-control-row{display:flex;flex-wrap:wrap;gap:6px}.g3d-control-row .g3d-button{flex:1 1 auto}.g3d-object-list,.g3d-light-list{display:grid;gap:5px;margin-top:8px}.g3d-object{display:flex;align-items:center;gap:7px;width:100%;padding:7px;border:1px solid transparent;border-radius:7px;background:transparent;text-align:left;cursor:pointer}.g3d-object:hover{background:#13212b}.g3d-object.is-selected{border-color:var(--cyan);background:linear-gradient(90deg,rgba(101,215,223,.15),rgba(241,91,187,.08))}.g3d-object.is-child{padding-left:22px}.g3d-object-badge{display:grid;place-items:center;flex:0 0 25px;width:25px;height:25px;border:1px solid var(--line);border-radius:6px;color:var(--cyan);font-size:9px;font-weight:800}.g3d-object-copy{min-width:0}.g3d-object-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.g3d-object-type{display:block;color:var(--muted);font-size:9px}.g3d-stage{display:grid;grid-template-rows:auto minmax(400px,1fr) auto auto;min-width:0;min-height:0;background:#04080d}.g3d-enginebar,.g3d-toolbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:7px 10px;border-bottom:1px solid var(--line);background:#0a1119}.g3d-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 7px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:10px}.g3d-badge.is-ok{border-color:rgba(120,223,169,.45);color:#9df0c1}.g3d-badge.is-warn{border-color:rgba(255,194,87,.45);color:#ffd388}.g3d-metrics{margin-left:auto;color:var(--muted);font-variant-numeric:tabular-nums}.g3d-canvas-wrap{position:relative;min-height:400px;overflow:hidden}.g3d-canvas{display:block;width:100%;height:100%;min-height:400px;touch-action:none;cursor:crosshair}.g3d-stage-help{position:absolute;left:12px;top:12px;max-width:330px;padding:6px 8px;border:1px solid rgba(101,215,223,.25);border-radius:7px;background:rgba(4,8,13,.72);color:var(--muted);font-size:10px;pointer-events:none}.g3d-gizmo-label{color:var(--muted);font-size:10px}.g3d-axis[data-axis=x]{color:#ff8796}.g3d-axis[data-axis=y]{color:#8ceca8}.g3d-axis[data-axis=z]{color:#80bfff}.g3d-timeline{border-top:1px solid var(--line);background:#0a1118}.g3d-timeline-head{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:8px 10px;border-bottom:1px solid var(--line)}.g3d-time-input{width:66px;padding:5px;border:1px solid var(--line);border-radius:5px;background:#071018}.g3d-range{accent-color:var(--cyan);min-width:120px;flex:1}.g3d-track{display:grid;grid-template-columns:145px 1fr;min-height:42px}.g3d-track-label{padding:8px 10px;color:var(--muted);border-right:1px solid var(--line);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.g3d-track-line{position:relative;background:repeating-linear-gradient(90deg,transparent 0 49px,rgba(141,164,175,.1) 50px)}.g3d-keyframe{position:absolute;top:15px;width:9px;height:9px;background:var(--pink);transform:rotate(45deg);border-radius:2px}.g3d-keyframe.is-camera{background:#ffd45d}.g3d-status{display:flex;align-items:center;gap:7px;padding:7px 10px;border-top:1px solid var(--line);color:var(--muted);font-size:10px}.g3d-dot{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 10px var(--green)}.g3d-status.is-warning .g3d-dot{background:#ffca5c;box-shadow:0 0 10px #ffca5c}.g3d-form{display:grid;gap:9px}.g3d-field{display:grid;gap:4px}.g3d-field label{color:var(--muted);font-size:10px}.g3d-field input,.g3d-field select,.g3d-field textarea{width:100%;padding:7px;border:1px solid var(--line);border-radius:6px;background:#081018}.g3d-vector{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.g3d-check{display:flex;align-items:center;gap:6px;color:var(--muted)}.g3d-check input,.g3d-range{accent-color:var(--cyan)}.g3d-note,.g3d-empty{padding:8px;border:1px dashed var(--line);border-radius:7px;color:var(--muted);font-size:10px}.g3d-note.is-warn{border-style:solid;border-color:rgba(255,194,87,.35);background:rgba(255,194,87,.06);color:#ffd388}.g3d-file{display:none}.g3d-toast{position:fixed;right:16px;bottom:16px;z-index:10000;max-width:360px;padding:10px 12px;border:1px solid var(--cyan);border-radius:8px;background:#0d151e;box-shadow:0 12px 36px rgba(0,0,0,.4)}
      @media(max-width:1120px){.g3d-layout{grid-template-columns:210px minmax(0,1fr)}.g3d-inspector{grid-column:1/-1;border-left:0;border-top:1px solid var(--line);display:grid;grid-template-columns:repeat(2,minmax(0,1fr));overflow:visible}.g3d-inspector .g3d-panel+.g3d-panel{border-top:0;border-left:1px solid var(--line)}}
      @media(max-width:760px){.hh-g3d{min-height:820px}.g3d-header{align-items:flex-start;flex-wrap:wrap}.g3d-brand{min-width:150px}.g3d-scene-name{order:3;width:100%;flex-basis:100%}.g3d-layout{display:block}.g3d-sidebar,.g3d-inspector{border:0;border-top:1px solid var(--line);max-height:none}.g3d-sidebar{display:grid;grid-template-columns:1fr 1fr}.g3d-inspector{display:block}.g3d-stage{min-height:600px}.g3d-canvas-wrap,.g3d-canvas{min-height:380px}.g3d-track{grid-template-columns:95px 1fr}.g3d-metrics{width:100%;margin-left:0}.g3d-actions{width:100%}}
      @media(max-width:470px){.g3d-sidebar{display:block}.g3d-toolbar .g3d-button{padding-inline:7px}.g3d-canvas-wrap,.g3d-canvas{min-height:340px}}
      @media(prefers-reduced-motion:reduce){.g3d-button{transition:none}.hh-g3d *{scroll-behavior:auto!important}}
    `;
  }

  async function createThreeEngine(canvas, capabilities, notify) {
    if (!capabilities.webgl2 || typeof document === "undefined") return null;
    const moduleUrl = new URL(THREE_MODULE_PATH, SCRIPT_BASE_URL || document.baseURI).href;
    const THREE = await import(moduleUrl);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const stage = new THREE.Scene(); const world = new THREE.Group(); world.name = "HH World"; stage.add(world);
    const camera = new THREE.PerspectiveCamera(45, 1, .05, 500); const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
    const objectMap = new Map(); const modelRoots = new Map(); const textureSlots = new Map(); const objectUrls = new Set();
    let environmentTexture = null; let grid = null; let gizmo = null; let selectedId = null; let stats = { fps: 0, drawCalls: 0, triangles: 0, points: 0, textures: 0, geometries: 0 }; let frames = 0; let fpsAt = performance.now();
    function disposeObject(object) { object.traverse((node) => { if (node.geometry) node.geometry.dispose(); if (node.material) { const mats = Array.isArray(node.material) ? node.material : [node.material]; mats.forEach((material) => material.dispose()); } }); }
    function clearGroup(group) { while (group.children.length) { const child = group.children.pop(); disposeObject(child); } }
    function geometryFor(type) {
      if (type === "cube") return new THREE.BoxGeometry(1,1,1);
      if (type === "sphere") return new THREE.SphereGeometry(.5,32,18);
      if (type === "plane") return new THREE.PlaneGeometry(1,1,1,1);
      if (type === "cylinder") return new THREE.CylinderGeometry(.5,.5,1,32);
      if (type === "cone") return new THREE.ConeGeometry(.5,1,32);
      if (type === "torus") return new THREE.TorusGeometry(.36,.14,18,48);
      return null;
    }
    function materialFor(object) {
      const source = object.material; const material = new THREE.MeshStandardMaterial({ color: source.color, emissive: source.emissive, roughness: source.roughness, metalness: source.metalness, opacity: source.opacity, transparent: source.opacity < 1, wireframe: source.wireframe, side: source.side === "double" ? THREE.DoubleSide : source.side === "back" ? THREE.BackSide : THREE.FrontSide, envMapIntensity: source.envMapIntensity });
      const slots = textureSlots.get(object.id); if (slots) { if (slots.map) material.map = slots.map; if (slots.normalMap) material.normalMap = slots.normalMap; }
      return material;
    }
    function buildNode(object) {
      let node;
      if (object.type === "group") node = new THREE.Group();
      else if (object.type === "model" && modelRoots.has(object.id)) {
        node = modelRoots.get(object.id).clone(true);
        node.traverse((child) => {
          if (child.geometry) child.geometry = child.geometry.clone();
          if (child.material) child.material = Array.isArray(child.material) ? child.material.map((material) => material.clone()) : child.material.clone();
        });
      }
      else if (object.type === "model") { node = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshBasicMaterial({ color: 0x6f8290, wireframe: true })); node.userData.hhPlaceholder = true; }
      else node = new THREE.Mesh(geometryFor(object.type), materialFor(object));
      node.name = object.name; node.userData.hhId = object.id; node.visible = object.visible;
      node.traverse((child) => { child.userData.hhId = object.id; if (child.isMesh) { child.castShadow = object.type !== "plane"; child.receiveShadow = true; } });
      objectMap.set(object.id, node); return node;
    }
    function buildGizmo() {
      const group = new THREE.Group(); group.name = "HH Transform Gizmo";
      [[0xff5367,"x",new THREE.Vector3(1,0,0)],[0x58df84,"y",new THREE.Vector3(0,1,0)],[0x5798ff,"z",new THREE.Vector3(0,0,1)]].forEach(([color,axis,direction]) => { const arrow = new THREE.ArrowHelper(direction,new THREE.Vector3(),1.25,color,.22,.12); arrow.userData.hhGizmoAxis = axis; group.add(arrow); });
      stage.add(group); return group;
    }
    function applyTransform(node, value) { node.position.set(value.position.x,value.position.y,value.position.z); node.rotation.set(value.rotation.x*Math.PI/180,value.rotation.y*Math.PI/180,value.rotation.z*Math.PI/180); node.scale.set(value.scale.x,value.scale.y,value.scale.z); }
    function sync(scene, activeId) {
      clearGroup(world); objectMap.clear(); selectedId = activeId;
      stage.background = new THREE.Color(scene.background); stage.fog = scene.renderer.fog ? new THREE.FogExp2(scene.background, scene.renderer.fogDensity) : null;
      renderer.shadowMap.enabled = scene.renderer.shadows; renderer.toneMappingExposure = scene.renderer.exposure;
      renderer.toneMapping = scene.renderer.toneMapping === "linear" ? THREE.LinearToneMapping : scene.renderer.toneMapping === "reinhard" ? THREE.ReinhardToneMapping : scene.renderer.toneMapping === "cineon" ? THREE.CineonToneMapping : scene.renderer.toneMapping === "none" ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
      if (grid) { stage.remove(grid); grid.geometry.dispose(); grid.material.dispose(); }
      grid = new THREE.GridHelper(20,40,0x65d7df,0x25414f); grid.visible = scene.grid.visible; grid.position.y = scene.physics.floorY + .005; stage.add(grid);
      stage.children.filter((child) => child.userData && child.userData.hhLight).forEach((child) => stage.remove(child));
      scene.lights.forEach((item) => { let light; if (item.type === "ambient") light = new THREE.AmbientLight(item.color,item.intensity); else if (item.type === "point") light = new THREE.PointLight(item.color,item.intensity,item.distance,2); else if (item.type === "spot") { light = new THREE.SpotLight(item.color,item.intensity,item.distance,item.angle,.3,1); light.target.position.set(0,0,0); light.target.userData.hhLight = true; stage.add(light.target); } else light = new THREE.DirectionalLight(item.color,item.intensity); light.position.set(item.position.x,item.position.y,item.position.z); light.castShadow = item.castShadow; light.shadow.mapSize.set(1024,1024); light.userData.hhLight = true; stage.add(light); });
      scene.objects.forEach((object) => objectMap.set(object.id, buildNode(object)));
      scene.objects.forEach((object) => { const node = objectMap.get(object.id); const parent = object.parentId && objectMap.get(object.parentId); (parent || world).add(node); applyTransform(node, transformAt(object,scene,scene.timeline.currentTime)); });
      scene.particles.forEach((item) => { const positions = new Float32Array(item.count*3); for(let i=0;i<positions.length;i+=3){positions[i]=(Math.random()-.5)*item.spread;positions[i+1]=Math.random()*item.spread*.6;positions[i+2]=(Math.random()-.5)*item.spread;} const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));const points=new THREE.Points(geometry,new THREE.PointsMaterial({color:item.color,size:item.size,sizeAttenuation:true,transparent:true,opacity:.85}));points.userData.hhParticle=true;world.add(points); });
      if (!gizmo) gizmo = buildGizmo(); update(scene, activeId);
    }
    function update(scene, activeId) {
      selectedId = activeId;
      scene.objects.forEach((object) => { const node = objectMap.get(object.id); if (node) { applyTransform(node,transformAt(object,scene,scene.timeline.currentTime)); node.visible=object.visible; } });
      const cameraState = cameraAt(scene,scene.timeline.currentTime); const yaw=cameraState.yaw*Math.PI/180,pitch=cameraState.pitch*Math.PI/180,distance=cameraState.distance/scene.camera.zoom;
      camera.fov=scene.camera.fov;camera.near=scene.camera.near;camera.far=scene.camera.far;camera.position.set(cameraState.target.x+Math.sin(yaw)*Math.cos(pitch)*distance,cameraState.target.y+Math.sin(pitch)*distance,cameraState.target.z+Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(cameraState.target.x,cameraState.target.y,cameraState.target.z);camera.updateProjectionMatrix();
      const selected=activeId&&objectMap.get(activeId);gizmo.visible=Boolean(selected);if(selected){const position=new THREE.Vector3();selected.getWorldPosition(position);gizmo.position.copy(position);const scale=Math.max(.55,camera.position.distanceTo(position)*.09);gizmo.scale.setScalar(scale);}
    }
    function resize() { const rect=canvas.getBoundingClientRect();const width=Math.max(1,Math.floor(rect.width||640)),height=Math.max(1,Math.floor(rect.height||400));renderer.setPixelRatio(Math.min(runtime.devicePixelRatio||1,2));renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix(); }
    function render(scene, activeId) { resize();update(scene,activeId);renderer.render(stage,camera);frames+=1;const now=performance.now();if(now-fpsAt>=500){stats.fps=Math.round(frames*1000/(now-fpsAt));frames=0;fpsAt=now;}stats.drawCalls=renderer.info.render.calls;stats.triangles=renderer.info.render.triangles;stats.points=renderer.info.render.points;stats.textures=renderer.info.memory.textures;stats.geometries=renderer.info.memory.geometries;return Object.assign({},stats); }
    function pick(clientX,clientY){const rect=canvas.getBoundingClientRect();pointer.x=((clientX-rect.left)/rect.width)*2-1;pointer.y=-((clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(Array.from(objectMap.values()),true);const hit=hits.find((entry)=>entry.object.userData.hhId);return hit?hit.object.userData.hhId:null;}
    async function setTexture(objectId,slot,file){const url=URL.createObjectURL(file);objectUrls.add(url);const texture=await new THREE.TextureLoader().loadAsync(url);texture.colorSpace=slot==="map"?THREE.SRGBColorSpace:THREE.NoColorSpace;texture.flipY=false;const slots=textureSlots.get(objectId)||{};if(slots[slot])slots[slot].dispose();slots[slot]=texture;textureSlots.set(objectId,slots);return texture;}
    async function setEnvironment(file){if(/\.(hdr|exr)$/i.test(file.name))throw new Error("HDR/EXR cần RGBELoader hoặc EXRLoader; bản local hiện hỗ trợ PNG/JPG/WebP panorama.");const url=URL.createObjectURL(file);objectUrls.add(url);const texture=await new THREE.TextureLoader().loadAsync(url);texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.SRGBColorSpace;if(environmentTexture)environmentTexture.dispose();environmentTexture=texture;stage.environment=texture;return texture;}
    function installModel(id,root){modelRoots.set(id,root);}
    function destroy(){clearGroup(world);if(grid){grid.geometry.dispose();grid.material.dispose();}if(environmentTexture)environmentTexture.dispose();textureSlots.forEach((slots)=>Object.values(slots).forEach((texture)=>texture.dispose()));objectUrls.forEach((url)=>URL.revokeObjectURL(url));renderer.dispose();}
    notify(`Three.js ${THREE.REVISION || THREE_VERSION} đã tải cục bộ. WebGL2 renderer đang hoạt động.`);
    return { THREE, renderer, stage, camera, sync, render, pick, setTexture, setEnvironment, installModel, getStats:()=>Object.assign({},stats), destroy };
  }

  async function importGltfBundle(files, THREE) {
    const list = Array.from(files || []); const main = list.find((file) => /\.(glb|gltf)$/i.test(file.name)); if (!main) throw new Error("Hãy chọn file .glb hoặc .gltf cùng các file .bin/texture liên quan.");
    const fileMap = new Map(list.map((file) => [file.name, file])); let gltf; let glbBin = null;
    if (/\.glb$/i.test(main.name)) { const parsed = parseGlb(await main.arrayBuffer()); gltf=parsed.json;glbBin=parsed.bin; } else gltf=JSON.parse(await main.text());
    if (!gltf.asset || String(gltf.asset.version).split(".")[0] !== "2") throw new Error("Chỉ hỗ trợ glTF 2.0.");
    const extensions = gltf.extensionsRequired || []; if (extensions.includes("KHR_draco_mesh_compression")) throw new Error("File dùng Draco. Bản local chưa đóng gói DRACOLoader.");
    const buffers = await Promise.all((gltf.buffers || []).map(async (buffer,index) => { if (!buffer.uri && index===0&&glbBin)return glbBin;if(typeof buffer.uri!=="string")throw new Error("Thiếu buffer glTF");if(buffer.uri.startsWith("data:"))return decodeDataUri(buffer.uri);const file=fileMap.get(decodeURIComponent(buffer.uri).split("/").pop());if(!file)throw new Error(`Thiếu file buffer: ${buffer.uri}`);return file.arrayBuffer(); }));
    const componentMap={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};const countMap={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
    function accessor(index){const source=gltf.accessors[index],view=gltf.bufferViews[source.bufferView];if(!source||!view)throw new Error("Accessor glTF không hợp lệ");const Type=componentMap[source.componentType],size=countMap[source.type];if(!Type||!size)throw new Error(`Accessor ${source.componentType}/${source.type} chưa hỗ trợ`);const elementBytes=Type.BYTES_PER_ELEMENT*size;const stride=view.byteStride||elementBytes;const base=(view.byteOffset||0)+(source.byteOffset||0);const raw=buffers[view.buffer];if(stride===elementBytes)return new Type(raw,base,source.count*size).slice();const output=new Type(source.count*size);const data=new DataView(raw);for(let i=0;i<source.count;i+=1)for(let c=0;c<size;c+=1){const offset=base+i*stride+c*Type.BYTES_PER_ELEMENT;output[i*size+c]=Type===Float32Array?data.getFloat32(offset,true):Type===Uint32Array?data.getUint32(offset,true):Type===Uint16Array?data.getUint16(offset,true):Type===Int16Array?data.getInt16(offset,true):Type===Int8Array?data.getInt8(offset):data.getUint8(offset);}return output;}
    const materials=(gltf.materials||[]).map((item)=>{const pbr=item.pbrMetallicRoughness||{},factor=pbr.baseColorFactor||[1,1,1,1];return new THREE.MeshStandardMaterial({name:item.name||"glTF Material",color:new THREE.Color(factor[0],factor[1],factor[2]),opacity:factor[3]==null?1:factor[3],transparent:item.alphaMode==="BLEND"||(factor[3]!=null&&factor[3]<1),roughness:pbr.roughnessFactor==null?1:pbr.roughnessFactor,metalness:pbr.metallicFactor==null?1:pbr.metallicFactor,side:item.doubleSided?THREE.DoubleSide:THREE.FrontSide});});
    let vertices=0,triangles=0;const meshes=(gltf.meshes||[]).map((mesh)=>{const group=new THREE.Group();group.name=mesh.name||"glTF Mesh";(mesh.primitives||[]).forEach((primitive)=>{if(primitive.mode!=null&&primitive.mode!==4)throw new Error("Hiện chỉ hỗ trợ TRIANGLES primitive.");if(primitive.extensions&&primitive.extensions.KHR_draco_mesh_compression)throw new Error("Draco chưa được hỗ trợ.");if(primitive.attributes.POSITION==null)throw new Error("Primitive thiếu POSITION.");const geometry=new THREE.BufferGeometry();const positions=accessor(primitive.attributes.POSITION);geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));vertices+=positions.length/3;if(primitive.attributes.NORMAL!=null)geometry.setAttribute("normal",new THREE.BufferAttribute(accessor(primitive.attributes.NORMAL),3));else geometry.computeVertexNormals();if(primitive.attributes.TEXCOORD_0!=null)geometry.setAttribute("uv",new THREE.BufferAttribute(accessor(primitive.attributes.TEXCOORD_0),2));if(primitive.indices!=null){const index=accessor(primitive.indices);geometry.setIndex(new THREE.BufferAttribute(index,1));triangles+=index.length/3;}else triangles+=positions.length/9;const material=materials[primitive.material]||new THREE.MeshStandardMaterial({color:0x9ab7c2,roughness:.6});group.add(new THREE.Mesh(geometry,material));});return group;});
    const nodes=(gltf.nodes||[]).map((node)=>{const object=node.mesh!=null&&meshes[node.mesh]?meshes[node.mesh].clone(true):new THREE.Group();object.name=node.name||"glTF Node";if(Array.isArray(node.matrix)){const matrix=new THREE.Matrix4().fromArray(node.matrix);matrix.decompose(object.position,object.quaternion,object.scale);}else{if(node.translation)object.position.fromArray(node.translation);if(node.rotation)object.quaternion.fromArray(node.rotation);if(node.scale)object.scale.fromArray(node.scale);}return object;});
    (gltf.nodes||[]).forEach((node,index)=>(node.children||[]).forEach((child)=>{if(nodes[child])nodes[index].add(nodes[child]);}));
    const root=new THREE.Group();root.name=main.name.replace(/\.(glb|gltf)$/i,"");const sceneDef=(gltf.scenes||[])[gltf.scene||0]||{nodes:gltf.nodes?gltf.nodes.map((_,i)=>i):[]};(sceneDef.nodes||[]).forEach((index)=>{if(nodes[index])root.add(nodes[index]);});
    return { root, fileName:main.name,format:/\.glb$/i.test(main.name)?"glb":"gltf",vertices,triangles,animations:Array.isArray(gltf.animations)?gltf.animations.length:0,limitations:["Draco/KTX2/Meshopt chưa hỗ trợ","Animation được phát hiện nhưng chưa ánh xạ vào HH timeline","Texture glTF ngoài chưa nạp vào material trong bộ đọc tối giản"] };
  }

  function mount(root) {
    if (!root || typeof root !== "object") return null;
    if (root.__hhGraphic3DController) return root.__hhGraphic3DController;
    if (typeof document === "undefined") return null;
    root.__hhGraphic3DMounted = true;
    const style=document.createElement("style");style.setAttribute("data-hh-graphic-3d-style","true");style.textContent=styles();document.head.appendChild(style);
    let scene=createDefaultScene(),selectedId=scene.objects[1]?scene.objects[1].id:scene.objects[0].id,engine=null,animationFrame=0,lastTick=0,messageTimer=0,autosaveTimer=0,pointerState=null,gizmoMode="translate",gizmoAxis="x";
    const undoStack=[],redoStack=[];const capabilities=detectCapabilities(runtime);
    root.innerHTML=`<div class="hh-g3d" data-g3d-app role="application" aria-label="HH 3D Studio WebGL">
      <header class="g3d-header"><div class="g3d-brand"><span class="g3d-mark">3D</span><div><span class="g3d-title">HH 3D Studio</span><span class="g3d-subtitle">Three.js ${THREE_VERSION} · local WebGL</span></div></div><input class="g3d-scene-name" data-g3d-scene-name aria-label="Tên cảnh" value="${htmlEscape(scene.name)}"><div class="g3d-actions" role="toolbar" aria-label="Công cụ dự án"><button class="g3d-button" data-g3d-action="undo" title="Hoàn tác (Ctrl+Z)">↶</button><button class="g3d-button" data-g3d-action="redo" title="Làm lại (Ctrl+Shift+Z)">↷</button><button class="g3d-button is-primary" data-g3d-action="new">Cảnh mới</button><button class="g3d-button" data-g3d-action="save">Lưu</button><button class="g3d-button" data-g3d-action="load">Tải local</button><button class="g3d-button" data-g3d-action="load-json">Mở JSON</button><button class="g3d-button" data-g3d-action="import">Nhập glTF/GLB</button><button class="g3d-button" data-g3d-action="export-json">Xuất JSON</button><button class="g3d-button" data-g3d-action="export-gltf">Xuất glTF</button><button class="g3d-button" data-g3d-action="embed">Mã nhúng</button></div><input class="g3d-file" data-g3d-file type="file" multiple accept=".glb,.gltf,.bin,.png,.jpg,.jpeg,.webp,model/gltf+json,model/gltf-binary"><input class="g3d-file" data-g3d-scene-file type="file" accept=".json,.hh3d.json,application/json"><input class="g3d-file" data-g3d-texture-file type="file" accept="image/png,image/jpeg,image/webp"><input class="g3d-file" data-g3d-normal-file type="file" accept="image/png,image/jpeg,image/webp"><input class="g3d-file" data-g3d-env-file type="file" accept="image/png,image/jpeg,image/webp,.hdr,.exr"></header>
      <div class="g3d-layout"><aside class="g3d-sidebar" aria-label="Cây phân cấp cảnh"><section class="g3d-panel"><h2>Primitive & hierarchy</h2><div class="g3d-control-row">${["group","cube","sphere","plane","cylinder","cone","torus"].map((type)=>`<button class="g3d-button" data-g3d-add="${type}">+ ${TYPE_LABELS[type]}</button>`).join("")}</div><div class="g3d-control-row" style="margin-top:6px"><button class="g3d-button" data-g3d-action="duplicate">Nhân bản</button><button class="g3d-button is-danger" data-g3d-action="delete">Xóa</button></div><div class="g3d-object-list" data-g3d-object-list></div></section><section class="g3d-panel"><h2>Ánh sáng</h2><div class="g3d-control-row"><button class="g3d-button" data-g3d-add-light="directional">+ Hướng</button><button class="g3d-button" data-g3d-add-light="point">+ Điểm</button><button class="g3d-button" data-g3d-add-light="spot">+ Rọi</button></div><div class="g3d-light-list" data-g3d-light-list></div></section><section class="g3d-panel"><h2>Particle & physics</h2><button class="g3d-button" data-g3d-action="add-particles">+ Particle field</button><label class="g3d-check"><input type="checkbox" data-g3d-setting="physics"> Chạy physics/trigger đơn giản</label><div class="g3d-note">Va chạm dùng AABB và sàn phẳng. Đây không phải rigid-body engine đầy đủ.</div></section></aside>
      <main class="g3d-stage"><div class="g3d-enginebar"><span class="g3d-badge ${capabilities.webgl2?"is-ok":"is-warn"}" data-g3d-engine-badge>${capabilities.webgl2?"WebGL2 khả dụng":"Fallback Canvas 2D"}</span><span class="g3d-badge ${capabilities.webgpu?"is-ok":""}">${capabilities.webgpu?"WebGPU được phát hiện · chưa dùng renderer":"WebGPU không có"}</span><span class="g3d-badge">PBR · Shadow · FPS</span><span class="g3d-metrics" data-g3d-metrics>Đang khởi tạo engine…</span></div><div class="g3d-toolbar" role="toolbar" aria-label="Transform gizmo"><span class="g3d-gizmo-label">Gizmo</span>${["translate","rotate","scale"].map((mode)=>`<button class="g3d-button${mode==="translate"?" is-active":""}" data-g3d-gizmo="${mode}">${mode==="translate"?"Di chuyển":mode==="rotate"?"Xoay":"Tỉ lệ"}</button>`).join("")}<span class="g3d-gizmo-label">Trục</span>${["x","y","z"].map((axis)=>`<button class="g3d-button g3d-axis${axis==="x"?" is-active":""}" data-g3d-axis="${axis}" data-axis="${axis}">${axis.toUpperCase()}</button>`).join("")}<button class="g3d-button" data-g3d-action="reset-camera">Đặt lại camera</button><button class="g3d-button" data-g3d-action="optimize">Phân tích tối ưu</button></div><div class="g3d-canvas-wrap"><canvas class="g3d-canvas" data-g3d-canvas aria-label="Khung nhìn cảnh 3D WebGL"></canvas><div class="g3d-stage-help">Click chọn · kéo nền để orbit · wheel để zoom · chọn gizmo/trục rồi kéo object để biến đổi</div></div><div class="g3d-timeline" aria-label="Timeline camera và object"><div class="g3d-timeline-head"><button class="g3d-button" data-g3d-action="play">Phát</button><button class="g3d-button" data-g3d-action="keyframe">+ Keyframe object</button><button class="g3d-button" data-g3d-action="camera-keyframe">+ Keyframe camera</button><button class="g3d-button" data-g3d-action="marker">+ Marker</button><label>Thời gian <input class="g3d-time-input" type="number" min="0" max="120" step="0.1" data-g3d-time value="0"></label><input class="g3d-range" type="range" min="0" max="6" step="0.01" data-g3d-timeline-range value="0"><span data-g3d-duration>0:06</span></div><div data-g3d-tracks></div></div><div class="g3d-status" data-g3d-status role="status" aria-live="polite"><span class="g3d-dot"></span><span data-g3d-status-text>Đang tải Three.js cục bộ…</span></div></main>
      <aside class="g3d-inspector" aria-label="Thuộc tính 3D"><section class="g3d-panel"><h2>Inspector</h2><div data-g3d-inspector></div></section><section class="g3d-panel"><h2>Renderer & môi trường</h2><div class="g3d-form"><div class="g3d-field"><label>Nền</label><input type="color" data-g3d-background value="${scene.background}"></div><label class="g3d-check"><input type="checkbox" data-g3d-setting="grid" checked> Lưới 3D</label><label class="g3d-check"><input type="checkbox" data-g3d-setting="snap" checked> Snap transform</label><div class="g3d-field"><label>Bước snap</label><input type="number" min="0.1" max="10" step="0.1" data-g3d-setting="snap-size" value="0.5"></div><div class="g3d-field"><label>Tone mapping</label><select data-g3d-renderer="toneMapping"><option value="aces">ACES Filmic</option><option value="reinhard">Reinhard</option><option value="cineon">Cineon</option><option value="linear">Linear</option><option value="none">Không</option></select></div><div class="g3d-field"><label>Exposure</label><input type="range" min="0.1" max="4" step="0.05" data-g3d-renderer="exposure" value="1"></div><label class="g3d-check"><input type="checkbox" data-g3d-renderer="shadows" checked> Shadow thời gian thực</label><label class="g3d-check"><input type="checkbox" data-g3d-renderer="fog"> Fog post effect</label><button class="g3d-button" data-g3d-action="environment">Chọn environment PNG/JPG/WebP</button><div class="g3d-note is-warn">HDR/EXR cần RGBELoader; DOF bokeh cần EffectComposer. Hai hiệu ứng này chỉ lưu metadata và không được tuyên bố là đã render.</div><div class="g3d-field"><label>DOF focus metadata</label><input type="range" min="1" max="100" step="1" data-g3d-renderer="dof.focus" value="8"></div></div></section></aside></div></div>`;
    const app=root.querySelector("[data-g3d-app]"),canvas=root.querySelector("[data-g3d-canvas]"),list=root.querySelector("[data-g3d-object-list]"),lightList=root.querySelector("[data-g3d-light-list]"),inspector=root.querySelector("[data-g3d-inspector]"),tracks=root.querySelector("[data-g3d-tracks]"),status=root.querySelector("[data-g3d-status]"),statusText=root.querySelector("[data-g3d-status-text]"),metrics=root.querySelector("[data-g3d-metrics]"),timeInput=root.querySelector("[data-g3d-time]"),timelineRange=root.querySelector("[data-g3d-timeline-range]"),durationLabel=root.querySelector("[data-g3d-duration]"),sceneName=root.querySelector("[data-g3d-scene-name]"),assetFile=root.querySelector("[data-g3d-file]"),sceneFile=root.querySelector("[data-g3d-scene-file]");
    function notify(message,warning){statusText.textContent=message;status.classList.toggle("is-warning",Boolean(warning));clearTimeout(messageTimer);messageTimer=setTimeout(()=>{statusText.textContent=scene.meta.assetPolicy;status.classList.remove("is-warning");},6000);}
    function selected(){return scene.objects.find((object)=>object.id===selectedId)||null;}
    function scheduleAutosave(){clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(scene));}catch(error){notify("Autosave thất bại: dung lượng scene vượt giới hạn localStorage.",true);}},650);}
    function snapshot(label){undoStack.push({label,state:clone(scene),selectedId});if(undoStack.length>60)undoStack.shift();redoStack.length=0;}
    function commit(label,callback){snapshot(label);callback();scene.meta.updatedAt=new Date().toISOString();scheduleAutosave();render(true);}
    function restore(entry,targetStack){if(!entry)return;targetStack.push({state:clone(scene),selectedId});scene=normalizeScene(entry.state);selectedId=entry.selectedId&&scene.objects.some((item)=>item.id===entry.selectedId)?entry.selectedId:(scene.objects[0]&&scene.objects[0].id);render(true);scheduleAutosave();}
    function orderedObjects(){const result=[];const visit=(parentId,depth)=>scene.objects.filter((item)=>(item.parentId||null)===(parentId||null)).forEach((item)=>{result.push({item,depth});visit(item.id,depth+1);});visit(null,0);scene.objects.forEach((item)=>{if(!result.some((entry)=>entry.item.id===item.id))result.push({item,depth:0});});return result;}
    function renderObjects(){list.innerHTML=orderedObjects().map(({item,depth})=>`<button class="g3d-object${item.id===selectedId?" is-selected":""}${depth?" is-child":""}" style="--depth:${depth}" data-g3d-select="${htmlEscape(item.id)}" aria-pressed="${item.id===selectedId}"><span class="g3d-object-badge">${item.type.slice(0,2).toUpperCase()}</span><span class="g3d-object-copy"><span class="g3d-object-name">${htmlEscape(item.name)}</span><span class="g3d-object-type">${htmlEscape(TYPE_LABELS[item.type])}${item.parentId?" · child":""}${item.locked?" · khóa":""}</span></span></button>`).join("")||`<div class="g3d-empty">Cảnh chưa có object.</div>`;lightList.innerHTML=scene.lights.map((light)=>`<div class="g3d-object"><span class="g3d-object-badge">${light.type.slice(0,2).toUpperCase()}</span><span class="g3d-object-copy"><span class="g3d-object-name">${htmlEscape(light.name)}</span><span class="g3d-object-type">${LIGHT_LABELS[light.type]}</span><input aria-label="Cường độ ${htmlEscape(light.name)}" type="range" min="0" max="20" step=".1" value="${light.intensity}" data-g3d-light-intensity="${light.id}"></span><button class="g3d-button is-danger" data-g3d-remove-light="${light.id}" aria-label="Xóa ${htmlEscape(light.name)}">×</button></div>`).join("");}
    function parentOptions(object){return `<option value="">Gốc cảnh</option>`+scene.objects.filter((candidate)=>candidate.id!==object.id&&candidate.type==="group").map((candidate)=>`<option value="${candidate.id}"${object.parentId===candidate.id?" selected":""}>${htmlEscape(candidate.name)}</option>`).join("");}
    function renderInspector(){const object=selected();if(!object){inspector.innerHTML=`<div class="g3d-empty">Chọn object để chỉnh transform, PBR, hierarchy và physics.</div>`;return;}const t=object.transform;inspector.innerHTML=`<div class="g3d-form"><div class="g3d-field"><label>Tên object</label><input data-g3d-field="name" value="${htmlEscape(object.name)}"></div><div class="g3d-field"><label>Parent</label><select data-g3d-field="parentId">${parentOptions(object)}</select></div>${["position","rotation","scale"].map((key)=>`<div class="g3d-field"><label>${key==="position"?"Vị trí":key==="rotation"?"Xoay (độ)":"Tỉ lệ"}</label><div class="g3d-vector">${["x","y","z"].map((axis)=>`<input type="number" step="${key==="rotation"?1:.1}" data-g3d-field="transform.${key}.${axis}" value="${t[key][axis]}">`).join("")}</div></div>`).join("")}<div class="g3d-field"><label>Màu PBR</label><input type="color" data-g3d-field="material.color" value="${object.material.color}"></div><div class="g3d-field"><label>Roughness ${Math.round(object.material.roughness*100)}%</label><input type="range" min="0" max="1" step=".01" data-g3d-field="material.roughness" value="${object.material.roughness}"></div><div class="g3d-field"><label>Metalness ${Math.round(object.material.metalness*100)}%</label><input type="range" min="0" max="1" step=".01" data-g3d-field="material.metalness" value="${object.material.metalness}"></div><div class="g3d-field"><label>Opacity ${Math.round(object.material.opacity*100)}%</label><input type="range" min=".02" max="1" step=".01" data-g3d-field="material.opacity" value="${object.material.opacity}"></div><div class="g3d-control-row"><button class="g3d-button" data-g3d-action="texture">Texture</button><button class="g3d-button" data-g3d-action="normal">Normal map</button></div><label class="g3d-check"><input type="checkbox" data-g3d-field="material.wireframe" ${object.material.wireframe?"checked":""}> Wireframe</label><label class="g3d-check"><input type="checkbox" data-g3d-field="visible" ${object.visible?"checked":""}> Hiển thị</label><label class="g3d-check"><input type="checkbox" data-g3d-field="locked" ${object.locked?"checked":""}> Khóa transform</label><label class="g3d-check"><input type="checkbox" data-g3d-field="physics.dynamic" ${object.physics.dynamic?"checked":""}> Dynamic body</label><label class="g3d-check"><input type="checkbox" data-g3d-field="physics.collision" ${object.physics.collision?"checked":""}> Collision AABB</label><label class="g3d-check"><input type="checkbox" data-g3d-field="physics.trigger" ${object.physics.trigger?"checked":""}> Trigger area</label>${object.type==="model"?`<div class="g3d-note is-warn"><strong>${object.asset.status==="imported"?"Đã nhập":"Cần nhập lại"}: ${htmlEscape(object.asset.fileName||"glTF/GLB")}</strong><br>${htmlEscape((object.asset.limitations||[]).join?object.asset.limitations.join(" · "):object.asset.limitations||"")}</div>`:""}</div>`;}
    function renderTracks(){durationLabel.textContent=`0:${String(Math.round(scene.timeline.duration)).padStart(2,"0")}`;timeInput.value=scene.timeline.currentTime.toFixed(1);timelineRange.max=scene.timeline.duration;timelineRange.value=scene.timeline.currentTime;const rows=scene.objects.map((object)=>{const frames=scene.timeline.keyframes.filter((frame)=>frame.objectId===object.id);return `<div class="g3d-track"><div class="g3d-track-label">${htmlEscape(object.name)}</div><div class="g3d-track-line">${frames.map((frame)=>`<span class="g3d-keyframe" title="${frame.time.toFixed(1)}s" style="left:${Math.min(99,frame.time/scene.timeline.duration*100)}%"></span>`).join("")}</div></div>`;});rows.push(`<div class="g3d-track"><div class="g3d-track-label">Camera path</div><div class="g3d-track-line">${scene.camera.keyframes.map((frame)=>`<span class="g3d-keyframe is-camera" title="${frame.time.toFixed(1)}s" style="left:${Math.min(99,frame.time/scene.timeline.duration*100)}%"></span>`).join("")}</div></div>`);tracks.innerHTML=rows.join("");}
    function render(syncEngine){renderObjects();renderInspector();renderTracks();sceneName.value=scene.name;root.querySelector('[data-g3d-renderer="toneMapping"]').value=scene.renderer.toneMapping;root.querySelector('[data-g3d-renderer="exposure"]').value=scene.renderer.exposure;root.querySelector('[data-g3d-renderer="shadows"]').checked=scene.renderer.shadows;root.querySelector('[data-g3d-renderer="fog"]').checked=scene.renderer.fog;root.querySelector('[data-g3d-setting="grid"]').checked=scene.grid.visible;root.querySelector('[data-g3d-setting="snap"]').checked=scene.grid.snap;root.querySelector('[data-g3d-setting="snap-size"]').value=scene.grid.size;root.querySelector('[data-g3d-setting="physics"]').checked=scene.physics.enabled;if(engine){if(syncEngine)engine.sync(scene,selectedId);const result=engine.render(scene,selectedId);metrics.textContent=`${result.fps} FPS · ${result.drawCalls} draw · ${result.triangles.toLocaleString()} tam giác · ${result.textures} texture`;}else{renderFallback(canvas,scene,selectedId);metrics.textContent=capabilities.webgl2?"Đang tải Three.js local…":"Canvas 2D fallback · WebGL2 không khả dụng";}}
    function setPath(object,path,value){const parts=path.split(".");let target=object;for(let i=0;i<parts.length-1;i+=1)target=target[parts[i]];target[parts[parts.length-1]]=value;}
    function addObject(type){if(scene.objects.length>=MAX_OBJECTS)return notify(`Đã đạt giới hạn ${MAX_OBJECTS} object.`,true);commit(`Thêm ${type}`,()=>{const object=makeObject(type,{transform:{position:{x:(scene.objects.length%4)-1.5,y:type==="plane"?-1:0,z:Math.floor(scene.objects.length/4)*.6}}});scene.objects.push(object);selectedId=object.id;});}
    function duplicateSelected(){const object=selected();if(!object)return notify("Chọn object trước khi nhân bản.",true);commit("Nhân bản",()=>{const copy=makeObject(object.type,clone(object));copy.id=makeId("object");copy.name=`${object.name} copy`;copy.transform.position.x+=scene.grid.snap?scene.grid.size:.5;copy.parentId=object.parentId;scene.objects.push(copy);selectedId=copy.id;});}
    function deleteSelected(){const object=selected();if(!object)return notify("Chọn object trước khi xóa.",true);commit("Xóa object",()=>{scene.objects=scene.objects.filter((item)=>item.id!==object.id);scene.objects.forEach((item)=>{if(item.parentId===object.id)item.parentId=null;});scene.timeline.keyframes=scene.timeline.keyframes.filter((frame)=>frame.objectId!==object.id);selectedId=scene.objects[0]?scene.objects[0].id:null;});}
    function addKeyframe(){const object=selected();if(!object)return notify("Chọn object để tạo keyframe.",true);commit("Keyframe object",()=>{scene.timeline.keyframes=scene.timeline.keyframes.filter((frame)=>!(frame.objectId===object.id&&Math.abs(frame.time-scene.timeline.currentTime)<.001));scene.timeline.keyframes.push({id:makeId("keyframe"),objectId:object.id,time:scene.timeline.currentTime,transform:clone(object.transform)});scene.timeline.keyframes.sort((a,b)=>a.time-b.time);});}
    function addCameraKeyframe(){commit("Keyframe camera",()=>{scene.camera.keyframes=scene.camera.keyframes.filter((frame)=>Math.abs(frame.time-scene.timeline.currentTime)>.001);scene.camera.keyframes.push({id:makeId("camera-frame"),time:scene.timeline.currentTime,yaw:scene.camera.yaw,pitch:scene.camera.pitch,distance:scene.camera.distance,target:{x:0,y:0,z:0}});scene.camera.keyframes.sort((a,b)=>a.time-b.time);});}
    function saveScene(){scene.meta.updatedAt=new Date().toISOString();try{localStorage.setItem(STORAGE_KEY,JSON.stringify(scene));notify("Đã lưu scene và metadata asset trên thiết bị.");}catch(error){notify("Không thể lưu: localStorage đầy. Hãy xuất JSON.",true);}}
    function loadScene(){try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return notify("Chưa có scene local.",true);snapshot("Tải local");scene=normalizeScene(JSON.parse(raw));selectedId=scene.objects[0]&&scene.objects[0].id;render(true);notify("Đã tải scene. Mô hình/texture nhị phân cần chọn lại.");}catch(error){notify("Scene local không hợp lệ.",true);}}
    function newScene(){snapshot("Cảnh mới");scene=createDefaultScene();selectedId=scene.objects[1].id;render(true);scheduleAutosave();notify("Đã tạo cảnh mới.");}
    function exportProject(){const project={format:"hh-graphic-design-3d",version:PROJECT_VERSION,threeVersion:THREE_VERSION,exportedAt:new Date().toISOString(),scene:normalizeScene(scene)};downloadText(`${safeName(scene.name)}.hh3d.json`,JSON.stringify(project,null,2));notify("Đã xuất project JSON. Asset nhị phân không được nhúng.");}
    function exportGltf(){const gltf=buildGltf(scene);downloadText(`${safeName(scene.name)}.gltf`,JSON.stringify(gltf,null,2),"model/gltf+json");notify("Đã xuất glTF 2.0 cho primitive/hierarchy. Mesh model đã nhập chỉ xuất node metadata.");}
    function safeName(name){return String(name||"hh-scene").replace(/[^a-z0-9-_]+/gi,"-").toLowerCase()||"hh-scene";}
    function loadSceneFile(file){if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(String(reader.result||"{}"));snapshot("Mở JSON");scene=normalizeScene(parsed.scene||parsed);selectedId=scene.objects[0]&&scene.objects[0].id;render(true);scheduleAutosave();notify(`Đã mở ${file.name}.`);}catch(error){notify("File scene JSON không hợp lệ.",true);}};reader.readAsText(file);}
    async function importAssets(files){if(!engine)return notify("WebGL2/Three.js chưa sẵn sàng; không thể render model thật.",true);try{notify("Đang đọc glTF/GLB…");const imported=await importGltfBundle(files,engine.THREE);const object=makeObject("model",{name:imported.root.name||imported.fileName,asset:{status:"imported",fileName:imported.fileName,format:imported.format,vertices:imported.vertices,triangles:imported.triangles,animations:imported.animations,limitations:imported.limitations}});snapshot("Nhập model");scene.objects.push(object);selectedId=object.id;engine.installModel(object.id,imported.root);render(true);scheduleAutosave();notify(`Đã render ${imported.fileName}: ${imported.vertices.toLocaleString()} đỉnh, ${Math.round(imported.triangles).toLocaleString()} tam giác.`);}catch(error){notify(`Không thể nhập: ${error.message}`,true);}}
    async function applyTexture(slot,file){const object=selected();if(!object||!engine||!file)return;try{await engine.setTexture(object.id,slot,file);object.material[slot==="map"?"textureName":"normalName"]=file.name;render(true);scheduleAutosave();notify(`${slot==="map"?"Texture":"Normal map"} đã áp dụng trong phiên hiện tại.`);}catch(error){notify(`Không thể đọc texture: ${error.message}`,true);}}
    async function applyEnvironment(file){if(!engine||!file)return;try{await engine.setEnvironment(file);scene.environment={fileName:file.name,mode:"equirectangular-ldr",intensity:1};render(false);scheduleAutosave();notify("Environment LDR đã áp dụng. File cần chọn lại sau khi tải project.");}catch(error){notify(error.message,true);}}
    async function copyEmbed(){const project={format:"hh-graphic-design-3d",version:PROJECT_VERSION,scene:normalizeScene(scene)};const code=`<div id="hh-3d-scene" data-graphic-3d></div>\n<script src="/graphic-design-3d.js"><\/script>\n<script>const c=HHGraphic3D.mount(document.querySelector('#hh-3d-scene'));c.setState(${JSON.stringify(project.scene)});<\/script>`;try{await navigator.clipboard.writeText(code);notify("Đã sao chép mã nhúng. Host cần graphic-design-3d.js và vendor/three.module.min.js.");}catch(error){downloadText(`${safeName(scene.name)}-embed.html`,code,"text/html");notify("Clipboard bị chặn; đã tải đoạn mã nhúng.");}}
    function optimize(){const stat=engine?engine.getStats():{drawCalls:0,triangles:0,textures:0,geometries:0};const warnings=[];if(stat.drawCalls>80)warnings.push("draw call cao, nên gộp mesh/material");if(stat.triangles>250000)warnings.push("tam giác cao, nên giảm poly/LOD");if(stat.textures>20)warnings.push("nhiều texture, nên atlas/compress");const missing=scene.objects.filter((item)=>item.type==="model"&&item.asset.status!=="imported").length;if(missing)warnings.push(`${missing} model cần nhập lại`);notify(`Phân tích: ${stat.drawCalls} draw, ${stat.triangles.toLocaleString()} tam giác, ${stat.textures} texture.${warnings.length?` Cảnh báo: ${warnings.join("; ")}.`:" Scene đang gọn."}`,warnings.length>0);}
    function simulate(dt){if(!scene.physics.enabled)return;const dynamic=scene.objects.filter((object)=>object.physics.dynamic&&!object.locked);dynamic.forEach((object)=>{object.physics.velocity.y+=scene.physics.gravity*dt;object.transform.position.x+=object.physics.velocity.x*dt;object.transform.position.y+=object.physics.velocity.y*dt;object.transform.position.z+=object.physics.velocity.z*dt;const half=Math.abs(object.transform.scale.y)*.5;if(object.transform.position.y-half<scene.physics.floorY){object.transform.position.y=scene.physics.floorY+half;object.physics.velocity.y=Math.abs(object.physics.velocity.y)*.35;}});for(let i=0;i<scene.objects.length;i+=1)for(let j=i+1;j<scene.objects.length;j+=1){const a=scene.objects[i],b=scene.objects[j];if(!a.physics.collision||!b.physics.collision)continue;const overlap=["x","y","z"].every((axis)=>Math.abs(a.transform.position[axis]-b.transform.position[axis])<(.5*Math.abs(a.transform.scale[axis])+.5*Math.abs(b.transform.scale[axis])));if(overlap&&(a.physics.trigger||b.physics.trigger)){const label=`${a.name} ↔ ${b.name}`;if(scene.physics.lastTrigger!==label){scene.physics.lastTrigger=label;notify(`Trigger: ${label}`);}}}}
    function tick(timestamp){if(!lastTick)lastTick=timestamp;const dt=Math.min(.05,(timestamp-lastTick)/1000);lastTick=timestamp;if(scene.timeline.playing){scene.timeline.currentTime+=dt;if(scene.timeline.currentTime>=scene.timeline.duration){if(scene.timeline.loop)scene.timeline.currentTime=0;else{scene.timeline.currentTime=scene.timeline.duration;scene.timeline.playing=false;}}simulate(dt);render(false);}else if(engine)render(false);animationFrame=runtime.requestAnimationFrame?runtime.requestAnimationFrame(tick):0;}
    function togglePlay(){scene.timeline.playing=!scene.timeline.playing;root.querySelector('[data-g3d-action="play"]').textContent=scene.timeline.playing?"Tạm dừng":"Phát";notify(scene.timeline.playing?"Timeline/physics đang chạy.":"Timeline đã tạm dừng.");}
    function resetCamera(){commit("Reset camera",()=>{scene.camera.yaw=42;scene.camera.pitch=25;scene.camera.distance=8;scene.camera.zoom=1;});}
    function setTime(value){scene.timeline.currentTime=clamp(numberOr(value,0),0,scene.timeline.duration);render(false);}
    function setState(value){snapshot("Set state");scene=normalizeScene(value);selectedId=scene.objects[0]&&scene.objects[0].id;render(true);scheduleAutosave();}
    app.addEventListener("click",(event)=>{const target=event.target.closest("[data-g3d-action],[data-g3d-add],[data-g3d-select],[data-g3d-add-light],[data-g3d-remove-light],[data-g3d-gizmo],[data-g3d-axis]");if(!target)return;if(target.dataset.g3dSelect){selectedId=target.dataset.g3dSelect;render(false);return;}if(target.dataset.g3dAdd)return addObject(target.dataset.g3dAdd);if(target.dataset.g3dAddLight)return commit("Thêm light",()=>scene.lights.push(makeLight(target.dataset.g3dAddLight)));if(target.dataset.g3dRemoveLight)return commit("Xóa light",()=>{scene.lights=scene.lights.filter((light)=>light.id!==target.dataset.g3dRemoveLight);if(!scene.lights.length)scene.lights.push(makeLight("ambient"));});if(target.dataset.g3dGizmo){gizmoMode=target.dataset.g3dGizmo;root.querySelectorAll("[data-g3d-gizmo]").forEach((button)=>button.classList.toggle("is-active",button===target));return;}if(target.dataset.g3dAxis){gizmoAxis=target.dataset.g3dAxis;root.querySelectorAll("[data-g3d-axis]").forEach((button)=>button.classList.toggle("is-active",button===target));return;}const action=target.dataset.g3dAction;if(action==="new")newScene();else if(action==="save")saveScene();else if(action==="load")loadScene();else if(action==="load-json")sceneFile.click();else if(action==="import")assetFile.click();else if(action==="export-json")exportProject();else if(action==="export-gltf")exportGltf();else if(action==="embed")copyEmbed();else if(action==="duplicate")duplicateSelected();else if(action==="delete")deleteSelected();else if(action==="undo")restore(undoStack.pop(),redoStack);else if(action==="redo")restore(redoStack.pop(),undoStack);else if(action==="keyframe")addKeyframe();else if(action==="camera-keyframe")addCameraKeyframe();else if(action==="marker")commit("Marker",()=>scene.timeline.markers.push({id:makeId("marker"),time:scene.timeline.currentTime,label:`Marker ${scene.timeline.markers.length+1}`}));else if(action==="play")togglePlay();else if(action==="reset-camera")resetCamera();else if(action==="add-particles")commit("Particle",()=>scene.particles.push({id:makeId("particles"),name:"Particle Field",count:700,size:.045,color:"#65d7ff",spread:8,speed:.25}));else if(action==="optimize")optimize();else if(action==="texture")root.querySelector("[data-g3d-texture-file]").click();else if(action==="normal")root.querySelector("[data-g3d-normal-file]").click();else if(action==="environment")root.querySelector("[data-g3d-env-file]").click();});
    app.addEventListener("input",(event)=>{const target=event.target;const object=selected();if(target.dataset.g3dField&&object){const path=target.dataset.g3dField;let value=target.type==="checkbox"?target.checked:target.type==="color"?target.value:path==="name"||path==="parentId"?target.value:numberOr(target.value,0);if(path.startsWith("transform.position."))value=snapValue(value,scene.grid.snap,scene.grid.size);setPath(object,path,value);scene.meta.updatedAt=new Date().toISOString();scheduleAutosave();render(true);}if(target.dataset.g3dLightIntensity){const light=scene.lights.find((item)=>item.id===target.dataset.g3dLightIntensity);if(light){light.intensity=clamp(numberOr(target.value,light.intensity),0,20);scheduleAutosave();render(true);}}if(target.dataset.g3dTime)setTime(target.value);if(target.dataset.g3dTimelineRange)setTime(target.value);if(target.dataset.g3dBackground){scene.background=target.value;scheduleAutosave();render(false);}if(target.dataset.g3dRenderer){const path=target.dataset.g3dRenderer;let value=target.type==="checkbox"?target.checked:target.type==="range"?numberOr(target.value,1):target.value;setPath(scene.renderer,path,value);scheduleAutosave();render(false);}if(target.dataset.g3dSetting==="physics"){scene.physics.enabled=target.checked;scheduleAutosave();}if(target.dataset.g3dSetting==="grid"){scene.grid.visible=target.checked;scheduleAutosave();render(true);}if(target.dataset.g3dSetting==="snap"){scene.grid.snap=target.checked;scheduleAutosave();}if(target.dataset.g3dSetting==="snap-size"){scene.grid.size=clamp(numberOr(target.value,.5),.1,10);scheduleAutosave();}});
    sceneName.addEventListener("change",()=>{scene.name=sceneName.value.trim().slice(0,100)||"HH WebGL Studio";scheduleAutosave();});assetFile.addEventListener("change",(event)=>{importAssets(event.target.files);event.target.value="";});sceneFile.addEventListener("change",(event)=>{loadSceneFile(event.target.files&&event.target.files[0]);event.target.value="";});root.querySelector("[data-g3d-texture-file]").addEventListener("change",(event)=>{applyTexture("map",event.target.files&&event.target.files[0]);event.target.value="";});root.querySelector("[data-g3d-normal-file]").addEventListener("change",(event)=>{applyTexture("normalMap",event.target.files&&event.target.files[0]);event.target.value="";});root.querySelector("[data-g3d-env-file]").addEventListener("change",(event)=>{applyEnvironment(event.target.files&&event.target.files[0]);event.target.value="";});
    canvas.addEventListener("wheel",(event)=>{event.preventDefault();scene.camera.zoom=clamp(scene.camera.zoom+(event.deltaY<0?.08:-.08),.25,4);render(false);scheduleAutosave();},{passive:false});
    canvas.addEventListener("pointerdown",(event)=>{const hit=engine&&engine.pick(event.clientX,event.clientY);if(hit){selectedId=hit;render(false);}pointerState={x:event.clientX,y:event.clientY,yaw:scene.camera.yaw,pitch:scene.camera.pitch,hit:Boolean(hit),before:hit?clone(selected()):null};canvas.setPointerCapture(event.pointerId);});
    canvas.addEventListener("pointermove",(event)=>{if(!pointerState)return;const dx=event.clientX-pointerState.x,dy=event.clientY-pointerState.y;const object=selected();if(pointerState.hit&&object&&!object.locked){const delta=(Math.abs(dx)>Math.abs(dy)?dx:-dy)*.012;if(gizmoMode==="translate")object.transform.position[gizmoAxis]=snapValue(pointerState.before.transform.position[gizmoAxis]+delta,scene.grid.snap,scene.grid.size);else if(gizmoMode==="rotate")object.transform.rotation[gizmoAxis]=pointerState.before.transform.rotation[gizmoAxis]+delta*12;else object.transform.scale[gizmoAxis]=Math.max(.05,pointerState.before.transform.scale[gizmoAxis]+delta*.5);render(false);}else{scene.camera.yaw=clamp(pointerState.yaw+dx*.3,-180,180);scene.camera.pitch=clamp(pointerState.pitch-dy*.2,-85,85);render(false);}});
    canvas.addEventListener("pointerup",()=>{if(pointerState&&pointerState.hit){undoStack.push({label:"Gizmo",state:(()=>{const state=clone(scene);const current=state.objects.find((item)=>item.id===selectedId);if(current&&pointerState.before)Object.assign(current,pointerState.before);return state;})(),selectedId});redoStack.length=0;scheduleAutosave();}pointerState=null;});
    app.addEventListener("keydown",(event)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z"){event.preventDefault();restore((event.shiftKey?redoStack:undoStack).pop(),event.shiftKey?undoStack:redoStack);}if(event.key.toLowerCase()==="g")gizmoMode="translate";if(event.key.toLowerCase()==="r")gizmoMode="rotate";if(event.key.toLowerCase()==="s")gizmoMode="scale";});
    let resizeObserver=null;if(typeof ResizeObserver!=="undefined"){resizeObserver=new ResizeObserver(()=>render(false));resizeObserver.observe(canvas);}
    const controller={mount:()=>controller,getState:()=>clone(scene),setState,addObject,selectObject:(id)=>{if(scene.objects.some((object)=>object.id===id)){selectedId=id;render(false);}},duplicateSelected,deleteSelected,addKeyframe,addCameraKeyframe,save:saveScene,load:loadScene,exportProject,exportGltf,resetCamera,getCapabilities:()=>Object.assign({},capabilities),getMetrics:()=>engine?engine.getStats():null,destroy:()=>{if(animationFrame&&runtime.cancelAnimationFrame)runtime.cancelAnimationFrame(animationFrame);clearTimeout(messageTimer);clearTimeout(autosaveTimer);if(resizeObserver)resizeObserver.disconnect();if(engine)engine.destroy();if(style.parentNode)style.parentNode.removeChild(style);root.innerHTML="";delete root.__hhGraphic3DController;delete root.__hhGraphic3DMounted;}};
    root.__hhGraphic3DController=controller;render(false);
    createThreeEngine(canvas,capabilities,notify).then((created)=>{engine=created;if(engine){root.querySelector("[data-g3d-engine-badge]").textContent=`WebGL2 · Three.js ${engine.THREE.REVISION}`;render(true);}else{metrics.textContent="Canvas 2D fallback · WebGL2 không khả dụng";notify("Thiết bị không có WebGL2. Chỉnh dữ liệu vẫn hoạt động, nhưng preview 3D thật bị tắt.",true);}if(runtime.requestAnimationFrame)animationFrame=runtime.requestAnimationFrame(tick);}).catch((error)=>{const badge=root.querySelector("[data-g3d-engine-badge]");if(badge){badge.textContent="Canvas 2D dự phòng";badge.classList.remove("is-ok");badge.classList.add("is-warn");}metrics.textContent="Canvas 2D fallback · WebGL context không khởi tạo được";renderFallback(canvas,scene,selectedId);notify(`Không thể khởi tạo Three.js local: ${error.message}`,true);if(runtime.requestAnimationFrame)animationFrame=runtime.requestAnimationFrame(tick);});
    return controller;
  }
  function unmount(root){if(!root||typeof root!=="object")return false;const controller=root.__hhGraphic3DController;if(controller&&typeof controller.destroy==="function")controller.destroy();return Boolean(controller);}
  function autoMount(){if(typeof document==="undefined")return;document.querySelectorAll("[data-graphic-3d]").forEach((root)=>mount(root));}
  if(typeof document!=="undefined"){if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",autoMount,{once:true});else autoMount();}
  return { mount, unmount, createDefaultScene, normalizeScene, makeObject, makeLight, projectPoint, transformAt, cameraAt, snapValue, detectCapabilities, primitiveGeometry, buildGltf, parseGlb, decodeDataUri, renderFallback, constants:{STORAGE_KEY,PROJECT_VERSION,THREE_VERSION,THREE_MODULE_PATH,SCRIPT_BASE_URL,MAX_OBJECTS,MAX_KEYFRAMES,TYPE_LABELS,LIGHT_LABELS} };
});
