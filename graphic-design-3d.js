(function (global, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    global.HHGraphic3D = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const runtime = typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : {});
  const STORAGE_KEY = "hh.graphic-design-3d.scene.v1";
  const PROJECT_VERSION = 1;
  const MAX_OBJECTS = 120;
  const MAX_KEYFRAMES = 600;
  const TYPE_LABELS = {
    cube: "Cube",
    sphere: "Sphere",
    plane: "Plane",
    model: "Model placeholder"
  };

  let idSequence = 0;

  function makeId(prefix) {
    idSequence += 1;
    return `${prefix || "item"}-${Date.now().toString(36)}-${idSequence.toString(36)}`;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function numberOr(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function vector(value, fallback) {
    return {
      x: numberOr(value && value.x, fallback.x),
      y: numberOr(value && value.y, fallback.y),
      z: numberOr(value && value.z, fallback.z)
    };
  }

  function transform(value) {
    return {
      position: vector(value && value.position, { x: 0, y: 0, z: 0 }),
      rotation: vector(value && value.rotation, { x: 0, y: 0, z: 0 }),
      scale: vector(value && value.scale, { x: 1, y: 1, z: 1 })
    };
  }

  function makeObject(type, overrides) {
    const safeType = Object.prototype.hasOwnProperty.call(TYPE_LABELS, type) ? type : "cube";
    const base = {
      id: makeId("object"),
      name: TYPE_LABELS[safeType],
      type: safeType,
      visible: true,
      locked: false,
      transform: transform(),
      material: {
        color: safeType === "sphere" ? "#6fd3ff" : safeType === "plane" ? "#c891ff" : "#ff56c7",
        opacity: 1,
        roughness: 0.45,
        metallic: 0.05
      },
      asset: safeType === "model" ? { status: "required", fileName: "", type: "3d-model" } : null
    };
    const result = Object.assign({}, base, overrides || {});
    result.transform = transform(overrides && overrides.transform);
    result.material = Object.assign({}, base.material, (overrides && overrides.material) || {});
    return result;
  }

  function createDefaultScene() {
    const cube = makeObject("cube", {
      name: "Hero Cube",
      transform: { position: { x: 0, y: 0.6, z: 0 }, scale: { x: 1.4, y: 1.4, z: 1.4 } },
      material: { color: "#ef5fc9" }
    });
    const plane = makeObject("plane", {
      name: "Ground Plane",
      transform: { position: { x: 0, y: -0.8, z: 0 }, scale: { x: 5, y: 1, z: 5 } },
      material: { color: "#1b3341", opacity: 0.92 }
    });
    return {
      version: PROJECT_VERSION,
      name: "Untitled HH Scene",
      background: "#081018",
      grid: { visible: true, snap: true, size: 0.5 },
      camera: { yaw: 45, pitch: 30, zoom: 1, distance: 8 },
      lights: [{ id: makeId("light"), name: "Key Light", color: "#ffffff", intensity: 1, position: { x: 4, y: 6, z: 4 } }],
      objects: [plane, cube],
      timeline: { currentTime: 0, duration: 5, playing: false, loop: true, keyframes: [] },
      meta: { assetPolicy: "Models require a real import before use", updatedAt: new Date().toISOString() }
    };
  }

  function normalizeScene(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const base = createDefaultScene();
    const objects = Array.isArray(source.objects) ? source.objects.slice(0, MAX_OBJECTS) : base.objects;
    const normalizedObjects = objects.map((item) => {
      const object = makeObject(item && item.type, item);
      object.id = typeof item.id === "string" && item.id ? item.id : object.id;
      object.name = typeof item.name === "string" && item.name.trim() ? item.name.trim().slice(0, 80) : object.name;
      object.visible = item.visible !== false;
      object.locked = item.locked === true;
      if (object.type === "model") {
        object.asset = Object.assign({ status: "required", fileName: "", type: "3d-model" }, item.asset || {});
        object.asset.status = object.asset.status === "imported" ? "imported" : "required";
      }
      return object;
    });
    const timelineSource = source.timeline && typeof source.timeline === "object" ? source.timeline : {};
    const keyframes = Array.isArray(timelineSource.keyframes) ? timelineSource.keyframes.slice(-MAX_KEYFRAMES) : [];
    return {
      version: PROJECT_VERSION,
      name: typeof source.name === "string" && source.name.trim() ? source.name.trim().slice(0, 100) : base.name,
      background: typeof source.background === "string" ? source.background : base.background,
      grid: {
        visible: !(source.grid && source.grid.visible === false),
        snap: !(source.grid && source.grid.snap === false),
        size: clamp(numberOr(source.grid && source.grid.size, base.grid.size), 0.1, 5)
      },
      camera: {
        yaw: clamp(numberOr(source.camera && source.camera.yaw, base.camera.yaw), -180, 180),
        pitch: clamp(numberOr(source.camera && source.camera.pitch, base.camera.pitch), 10, 80),
        zoom: clamp(numberOr(source.camera && source.camera.zoom, base.camera.zoom), 0.35, 2.5),
        distance: clamp(numberOr(source.camera && source.camera.distance, base.camera.distance), 2, 30)
      },
      lights: Array.isArray(source.lights) && source.lights.length ? source.lights.slice(0, 8) : base.lights,
      objects: normalizedObjects.length ? normalizedObjects : base.objects,
      timeline: {
        currentTime: clamp(numberOr(timelineSource.currentTime, 0), 0, 60),
        duration: clamp(numberOr(timelineSource.duration, 5), 1, 60),
        playing: false,
        loop: timelineSource.loop !== false,
        keyframes: keyframes.filter((frame) => frame && typeof frame.objectId === "string").map((frame) => ({
          id: typeof frame.id === "string" ? frame.id : makeId("keyframe"),
          objectId: frame.objectId,
          time: clamp(numberOr(frame.time, 0), 0, 60),
          transform: transform(frame.transform)
        }))
      },
      meta: Object.assign({}, base.meta, source.meta || {}, { updatedAt: new Date().toISOString() })
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function snapValue(value, enabled, size) {
    if (!enabled) return numberOr(value, 0);
    const step = Math.max(0.1, numberOr(size, 0.5));
    return Math.round(numberOr(value, 0) / step) * step;
  }

  function rotatePoint(point, rotation) {
    let x = point.x;
    let y = point.y;
    let z = point.z;
    const rx = (numberOr(rotation.x, 0) * Math.PI) / 180;
    const ry = (numberOr(rotation.y, 0) * Math.PI) / 180;
    const rz = (numberOr(rotation.z, 0) * Math.PI) / 180;
    let nextY = y * Math.cos(rx) - z * Math.sin(rx);
    let nextZ = y * Math.sin(rx) + z * Math.cos(rx);
    y = nextY;
    z = nextZ;
    let nextX = x * Math.cos(ry) + z * Math.sin(ry);
    nextZ = -x * Math.sin(ry) + z * Math.cos(ry);
    x = nextX;
    z = nextZ;
    nextX = x * Math.cos(rz) - y * Math.sin(rz);
    nextY = x * Math.sin(rz) + y * Math.cos(rz);
    return { x: nextX, y: nextY, z };
  }

  function projectPoint(point, camera, width, height) {
    const yaw = (numberOr(camera.yaw, 45) * Math.PI) / 180;
    const pitch = (numberOr(camera.pitch, 30) * Math.PI) / 180;
    const scale = Math.min(width, height) * 0.105 * numberOr(camera.zoom, 1);
    const horizontal = point.x * Math.cos(yaw) + point.z * Math.sin(yaw);
    const depth = -point.x * Math.sin(yaw) + point.z * Math.cos(yaw);
    return {
      x: width / 2 + horizontal * scale,
      y: height / 2 - point.y * scale + depth * scale * Math.sin(pitch)
    };
  }

  function interpolate(a, b, ratio) {
    return numberOr(a, 0) + (numberOr(b, 0) - numberOr(a, 0)) * ratio;
  }

  function transformAt(object, scene, time) {
    const frames = scene.timeline.keyframes
      .filter((frame) => frame.objectId === object.id)
      .sort((a, b) => a.time - b.time);
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

  function objectPoints(object, activeTransform) {
    const t = activeTransform || object.transform;
    const sx = numberOr(t.scale.x, 1);
    const sy = numberOr(t.scale.y, 1);
    const sz = numberOr(t.scale.z, 1);
    if (object.type === "plane") {
      return [
        { x: -0.5 * sx, y: 0, z: -0.5 * sz }, { x: 0.5 * sx, y: 0, z: -0.5 * sz },
        { x: 0.5 * sx, y: 0, z: 0.5 * sz }, { x: -0.5 * sx, y: 0, z: 0.5 * sz }
      ].map((point) => rotatePoint(point, t.rotation)).map((point) => ({ x: point.x + t.position.x, y: point.y + t.position.y, z: point.z + t.position.z }));
    }
    if (object.type === "sphere") {
      return [{ x: t.position.x, y: t.position.y, z: t.position.z }, { x: t.position.x + sx, y: t.position.y, z: t.position.z }, { x: t.position.x, y: t.position.y + sy, z: t.position.z }];
    }
    const half = [
      { x: -0.5 * sx, y: -0.5 * sy, z: -0.5 * sz }, { x: 0.5 * sx, y: -0.5 * sy, z: -0.5 * sz },
      { x: 0.5 * sx, y: 0.5 * sy, z: -0.5 * sz }, { x: -0.5 * sx, y: 0.5 * sy, z: -0.5 * sz },
      { x: -0.5 * sx, y: -0.5 * sy, z: 0.5 * sz }, { x: 0.5 * sx, y: -0.5 * sy, z: 0.5 * sz },
      { x: 0.5 * sx, y: 0.5 * sy, z: 0.5 * sz }, { x: -0.5 * sx, y: 0.5 * sy, z: 0.5 * sz }
    ];
    return half.map((point) => rotatePoint(point, t.rotation)).map((point) => ({ x: point.x + t.position.x, y: point.y + t.position.y, z: point.z + t.position.z }));
  }

  function renderScene(canvas, scene, selectedId) {
    if (!canvas || !canvas.getContext) return { hitRegions: [] };
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(runtime.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(rect.width || canvas.clientWidth || 640));
    const height = Math.max(1, Math.floor(rect.height || canvas.clientHeight || 440));
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = scene.background;
    ctx.fillRect(0, 0, width, height);
    const drawScale = Math.min(width, height) * 0.105 * scene.camera.zoom;

    if (scene.grid.visible) {
      ctx.save();
      ctx.strokeStyle = "rgba(107, 211, 221, .13)";
      ctx.lineWidth = 1;
      for (let i = -10; i <= 10; i += 1) {
        const a = projectPoint({ x: i, y: -0.82, z: -10 }, scene.camera, width, height);
        const b = projectPoint({ x: i, y: -0.82, z: 10 }, scene.camera, width, height);
        const c = projectPoint({ x: -10, y: -0.82, z: i }, scene.camera, width, height);
        const d = projectPoint({ x: 10, y: -0.82, z: i }, scene.camera, width, height);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
      }
      ctx.restore();
    }

    const hitRegions = [];
    const visibleObjects = scene.objects.filter((object) => object.visible);
    visibleObjects.forEach((object) => {
      const activeTransform = transformAt(object, scene, scene.timeline.currentTime);
      const points = objectPoints(object, activeTransform).map((point) => projectPoint(point, scene.camera, width, height));
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const minX = Math.min.apply(null, xs) - 18;
      const maxX = Math.max.apply(null, xs) + 18;
      const minY = Math.min.apply(null, ys) - 18;
      const maxY = Math.max.apply(null, ys) + 18;
      hitRegions.push({ id: object.id, minX, maxX, minY, maxY, depth: activeTransform.position.y });
      ctx.save();
      const lightIntensity = clamp(numberOr(scene.lights[0] && scene.lights[0].intensity, 1), 0, 2);
      const lighting = 0.58 + lightIntensity * 0.21;
      ctx.globalAlpha = clamp(numberOr(object.material.opacity, 1) * lighting, 0.05, 1);
      ctx.fillStyle = object.material.color || "#6fd3ff";
      ctx.strokeStyle = object.id === selectedId ? "#ffffff" : "rgba(214, 233, 241, .75)";
      ctx.lineWidth = object.id === selectedId ? 2.5 : 1;
      if (object.type === "sphere") {
        const center = points[0];
        const radius = Math.max(9, Math.abs(points[1].x - center.x), Math.abs(points[2].y - center.y));
        const gradient = ctx.createRadialGradient(center.x - radius * 0.35, center.y - radius * 0.4, radius * 0.1, center.x, center.y, radius);
        gradient.addColorStop(0, "#ffffff");
        gradient.addColorStop(0.08, object.material.color || "#6fd3ff");
        gradient.addColorStop(1, "#111827");
        ctx.fillStyle = gradient;
        ctx.beginPath(); ctx.arc(center.x, center.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.globalAlpha = 0.38;
        ctx.beginPath(); ctx.ellipse(center.x, center.y, radius, radius * 0.27, 0, 0, Math.PI * 2); ctx.stroke();
      } else if (object.type === "model") {
        ctx.setLineDash([6, 4]);
        ctx.fillStyle = "rgba(117, 136, 150, .16)";
        ctx.fillRect(minX, minY, Math.max(12, maxX - minX), Math.max(12, maxY - minY));
        ctx.strokeRect(minX, minY, Math.max(12, maxX - minX), Math.max(12, maxY - minY));
        ctx.setLineDash([]);
        ctx.fillStyle = "#b9c7d2";
        ctx.font = "12px system-ui, sans-serif";
        ctx.fillText("Import 3D asset", minX + 8, minY + 20);
      } else if (object.type === "plane") {
        ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else {
        const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
        faces.map((face) => face.map((index) => points[index])).sort((a, b) => a[0].y - b[0].y).forEach((face, faceIndex) => {
          ctx.globalAlpha = clamp(numberOr(object.material.opacity, 1) * lighting * (0.68 + faceIndex * 0.06), 0.08, 1);
          ctx.beginPath(); face.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.closePath(); ctx.fill(); ctx.stroke();
        });
      }
      if (object.id === selectedId) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#6bd3dd";
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(minX, minY, Math.max(12, maxX - minX), Math.max(12, maxY - minY));
        ctx.setLineDash([]);
      }
      ctx.restore();
    });

    ctx.save();
    ctx.fillStyle = "rgba(220, 238, 244, .72)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`Canvas 2D / isometric preview  •  ${visibleObjects.length} object(s)`, 14, height - 14);
    ctx.fillText(`Zoom ${Math.round(scene.camera.zoom * 100)}%`, width - 82, height - 14);
    ctx.restore();
    return { hitRegions, width, height, drawScale };
  }

  function styles() {
    return `
      .hh-g3d{--g3d-bg:#070c13;--g3d-panel:#0d151e;--g3d-panel-2:#111d27;--g3d-border:#263846;--g3d-text:#e6f0f4;--g3d-muted:#8ea4af;--g3d-cyan:#6bd3dd;--g3d-pink:#ef5fc9;display:grid;grid-template-rows:auto 1fr;min-height:680px;color:var(--g3d-text);background:radial-gradient(circle at 74% 10%,rgba(106,211,221,.1),transparent 34%),radial-gradient(circle at 18% 10%,rgba(239,95,201,.12),transparent 30%),var(--g3d-bg);font:13px/1.4 Inter,ui-sans-serif,system-ui,sans-serif;overflow:hidden;border:1px solid var(--g3d-border);border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.35)}
      .hh-g3d *{box-sizing:border-box}.hh-g3d button,.hh-g3d input,.hh-g3d select{font:inherit;color:inherit}.g3d-header{display:flex;align-items:center;gap:14px;padding:14px 16px;border-bottom:1px solid var(--g3d-border);background:rgba(13,21,30,.85);backdrop-filter:blur(16px)}
      .g3d-brand{display:flex;align-items:center;gap:10px;min-width:185px}.g3d-mark{display:grid;place-items:center;width:34px;height:34px;border:1px solid var(--g3d-cyan);border-radius:10px;background:linear-gradient(135deg,rgba(239,95,201,.7),rgba(107,211,221,.7));font-weight:900;color:#071018}.g3d-title{font-weight:800}.g3d-subtitle{display:block;color:var(--g3d-muted);font-size:11px;font-weight:500}.g3d-header-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-left:auto}.g3d-button{min-height:32px;padding:6px 10px;border:1px solid var(--g3d-border);border-radius:8px;background:#111a24;cursor:pointer;transition:transform .16s ease,border-color .16s ease,background .16s ease}.g3d-button:hover,.g3d-button:focus-visible{border-color:var(--g3d-cyan);background:#152936;transform:translateY(-1px);outline:none}.g3d-button.is-primary{border-color:transparent;background:linear-gradient(135deg,#ef5fc9,#6bd3dd);color:#061016;font-weight:800}.g3d-button.is-danger{color:#ff9bbd}.g3d-button:disabled{opacity:.45;cursor:not-allowed;transform:none}.g3d-layout{display:grid;grid-template-columns:235px minmax(0,1fr) 245px;min-height:0}.g3d-sidebar,.g3d-inspector{min-width:0;overflow:auto;background:rgba(13,21,30,.76)}.g3d-sidebar{border-right:1px solid var(--g3d-border)}.g3d-inspector{border-left:1px solid var(--g3d-border)}.g3d-panel{padding:14px}.g3d-panel+.g3d-panel{border-top:1px solid var(--g3d-border)}.g3d-panel h2{margin:0 0 10px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--g3d-cyan)}.g3d-scene-name{width:100%;padding:9px 10px;border:1px solid var(--g3d-border);border-radius:8px;background:#091018}.g3d-object-list{display:grid;gap:6px}.g3d-object{display:flex;align-items:center;gap:8px;width:100%;padding:8px;border:1px solid transparent;border-radius:8px;background:transparent;text-align:left;cursor:pointer}.g3d-object:hover{background:#13202a;border-color:var(--g3d-border)}.g3d-object.is-selected{background:linear-gradient(90deg,rgba(107,211,221,.16),rgba(239,95,201,.1));border-color:var(--g3d-cyan)}.g3d-object-badge{display:grid;place-items:center;flex:0 0 26px;width:26px;height:26px;border:1px solid var(--g3d-border);border-radius:7px;color:var(--g3d-cyan);font-size:10px;font-weight:800}.g3d-object-copy{min-width:0}.g3d-object-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.g3d-object-type{display:block;color:var(--g3d-muted);font-size:10px}.g3d-stage{display:grid;grid-template-rows:minmax(360px,1fr) auto;min-width:0;min-height:0;background:#05090e}.g3d-canvas-wrap{position:relative;min-height:360px;overflow:hidden}.g3d-canvas{display:block;width:100%;height:100%;min-height:360px;cursor:crosshair}.g3d-stage-help{position:absolute;left:14px;top:14px;padding:7px 9px;border:1px solid rgba(107,211,221,.25);border-radius:8px;background:rgba(5,9,14,.66);color:var(--g3d-muted);font-size:11px;pointer-events:none}.g3d-timeline{border-top:1px solid var(--g3d-border);background:#0b121a}.g3d-timeline-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--g3d-border)}.g3d-time-input{width:74px;padding:5px 7px;border:1px solid var(--g3d-border);border-radius:6px;background:#071018}.g3d-range{accent-color:var(--g3d-cyan);width:150px}.g3d-track{display:grid;grid-template-columns:160px 1fr;min-height:62px}.g3d-track-label{padding:10px 12px;color:var(--g3d-muted);border-right:1px solid var(--g3d-border);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.g3d-track-line{position:relative;background:repeating-linear-gradient(90deg,transparent 0 49px,rgba(142,164,175,.11) 50px)}.g3d-keyframe{position:absolute;top:22px;width:10px;height:10px;border:1px solid #071018;background:var(--g3d-pink);transform:rotate(45deg);border-radius:2px}.g3d-form{display:grid;gap:10px}.g3d-field{display:grid;gap:4px}.g3d-field label{color:var(--g3d-muted);font-size:11px}.g3d-field input,.g3d-field select{width:100%;padding:7px 8px;border:1px solid var(--g3d-border);border-radius:7px;background:#091018}.g3d-vector{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.g3d-vector input{min-width:0}.g3d-control-row{display:flex;flex-wrap:wrap;gap:7px}.g3d-control-row .g3d-button{flex:1 1 auto}.g3d-check{display:flex;align-items:center;gap:7px;color:var(--g3d-muted)}.g3d-check input{accent-color:var(--g3d-cyan)}.g3d-status{display:flex;align-items:center;gap:7px;padding:8px 12px;border-top:1px solid var(--g3d-border);color:var(--g3d-muted);font-size:11px}.g3d-status-dot{width:7px;height:7px;border-radius:50%;background:#66dd9d;box-shadow:0 0 12px #66dd9d}.g3d-status.is-warning .g3d-status-dot{background:#ffc857;box-shadow:0 0 12px #ffc857}.g3d-empty{padding:15px;border:1px dashed var(--g3d-border);border-radius:8px;color:var(--g3d-muted);font-size:12px}.g3d-asset-note{padding:9px;border:1px solid rgba(255,200,87,.35);border-radius:8px;background:rgba(255,200,87,.07);color:#ffd88a;font-size:11px}.g3d-file{display:none}.g3d-toast{position:fixed;right:18px;bottom:18px;z-index:1000;max-width:320px;padding:10px 12px;border:1px solid var(--g3d-cyan);border-radius:9px;background:#0d151e;color:var(--g3d-text);box-shadow:0 10px 30px rgba(0,0,0,.3)}
      @media (max-width:1050px){.g3d-layout{grid-template-columns:205px minmax(0,1fr)}.g3d-inspector{grid-column:1/-1;border-left:0;border-top:1px solid var(--g3d-border);display:grid;grid-template-columns:repeat(2,minmax(0,1fr));overflow:visible}.g3d-inspector .g3d-panel{border-top:0}.g3d-inspector .g3d-panel+.g3d-panel{border-left:1px solid var(--g3d-border)}}
      @media (max-width:700px){.hh-g3d{min-height:760px}.g3d-header{align-items:flex-start;flex-wrap:wrap}.g3d-header-actions{margin-left:0;width:100%}.g3d-layout{display:block}.g3d-sidebar,.g3d-inspector{border:0;border-top:1px solid var(--g3d-border);max-height:none}.g3d-sidebar{display:grid;grid-template-columns:1fr 1fr}.g3d-sidebar .g3d-panel{min-width:0}.g3d-inspector{display:block}.g3d-stage{min-height:520px}.g3d-canvas-wrap,.g3d-canvas{min-height:360px}.g3d-track{grid-template-columns:100px 1fr}}
      @media (prefers-reduced-motion:reduce){.g3d-button{transition:none}}
    `;
  }

  function htmlEscape(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function downloadText(filename, text, type) {
    if (typeof document === "undefined" || typeof URL === "undefined") return false;
    const blob = new Blob([text], { type: type || "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return true;
  }

  function mount(root) {
    if (!root || typeof root !== "object") return null;
    if (root.__hhGraphic3DController) return root.__hhGraphic3DController;
    if (typeof document === "undefined") return null;
    root.__hhGraphic3DMounted = true;
    const style = document.createElement("style");
    style.setAttribute("data-hh-graphic-3d-style", "true");
    style.textContent = styles();
    document.head.appendChild(style);
    let scene = createDefaultScene();
    let selectedId = scene.objects[1] ? scene.objects[1].id : scene.objects[0].id;
    let hitRegions = [];
    let animationFrame = 0;
    let lastTick = 0;
    let pointerState = null;
    let messageTimer = 0;

    root.innerHTML = `
      <div class="hh-g3d" data-g3d-app role="application" aria-label="HH Graphic Design 3D Scene Studio">
        <header class="g3d-header">
          <div class="g3d-brand"><span class="g3d-mark">3D</span><div><span class="g3d-title">Scene Studio</span><span class="g3d-subtitle">Canvas 2D / isometric workspace</span></div></div>
          <input class="g3d-scene-name" data-g3d-scene-name aria-label="Tên scene" value="${htmlEscape(scene.name)}">
          <div class="g3d-header-actions" role="toolbar" aria-label="Công cụ scene">
            <button class="g3d-button is-primary" data-g3d-action="new">Scene mới</button>
            <button class="g3d-button" data-g3d-action="save">Lưu</button>
            <button class="g3d-button" data-g3d-action="load">Tải local</button>
            <button class="g3d-button" data-g3d-action="load-json">Tải JSON</button>
            <button class="g3d-button" data-g3d-action="export">Xuất JSON</button>
            <button class="g3d-button" data-g3d-action="import">Import asset</button>
            <input class="g3d-file" data-g3d-file type="file" accept=".glb,.gltf,.obj,.fbx,.blend,.dae,.zip">
            <input class="g3d-file" data-g3d-scene-file type="file" accept=".json,.hh3d.json,application/json">
          </div>
        </header>
        <div class="g3d-layout">
          <aside class="g3d-sidebar" aria-label="Scene graph">
            <section class="g3d-panel"><h2>Scene graph</h2><div class="g3d-control-row"><button class="g3d-button" data-g3d-add="cube">+ Cube</button><button class="g3d-button" data-g3d-add="sphere">+ Sphere</button><button class="g3d-button" data-g3d-add="plane">+ Plane</button><button class="g3d-button" data-g3d-add="model">+ Model</button></div></section>
            <section class="g3d-panel"><div class="g3d-control-row"><button class="g3d-button" data-g3d-action="duplicate">Duplicate</button><button class="g3d-button is-danger" data-g3d-action="delete">Delete</button></div><div class="g3d-object-list" data-g3d-object-list></div></section>
            <section class="g3d-panel"><h2>View</h2><label class="g3d-check"><input type="checkbox" data-g3d-setting="grid" checked> Grid</label><label class="g3d-check"><input type="checkbox" data-g3d-setting="snap" checked> Snap</label><div class="g3d-field"><label>Snap size</label><input type="number" min="0.1" max="5" step="0.1" data-g3d-setting="snap-size" value="0.5"></div><button class="g3d-button" data-g3d-action="reset-camera">Reset camera</button></section>
          </aside>
          <section class="g3d-stage">
            <div class="g3d-canvas-wrap"><canvas class="g3d-canvas" data-g3d-canvas aria-label="Isometric scene preview"></canvas><div class="g3d-stage-help">Click để chọn • kéo nền để orbit • wheel để zoom</div></div>
            <div class="g3d-timeline" aria-label="Timeline"><div class="g3d-timeline-head"><button class="g3d-button" data-g3d-action="play">Play</button><button class="g3d-button" data-g3d-action="keyframe">+ Keyframe</button><label>Time <input class="g3d-time-input" type="number" min="0" max="60" step="0.1" data-g3d-time value="0"></label><input class="g3d-range" type="range" min="0" max="5" step="0.01" data-g3d-timeline-range value="0"><span data-g3d-duration>0:05</span></div><div data-g3d-tracks></div></div>
            <div class="g3d-status" data-g3d-status role="status" aria-live="polite"><span class="g3d-status-dot"></span><span data-g3d-status-text>Local scene ready. No backend required.</span></div>
          </section>
          <aside class="g3d-inspector" aria-label="Inspector">
            <section class="g3d-panel"><h2>Inspector</h2><div data-g3d-inspector></div></section>
            <section class="g3d-panel"><h2>Material & light</h2><div class="g3d-form"><div class="g3d-field"><label>Background</label><input type="color" data-g3d-background value="${scene.background}"></div><div class="g3d-field"><label>Key light intensity</label><input type="range" min="0" max="2" step="0.05" data-g3d-light value="${scene.lights[0].intensity}"></div></div></section>
          </aside>
        </div>
      </div>`;

    const app = root.querySelector("[data-g3d-app]");
    const canvas = root.querySelector("[data-g3d-canvas]");
    const sceneFile = root.querySelector("[data-g3d-scene-file]");
    const list = root.querySelector("[data-g3d-object-list]");
    const inspector = root.querySelector("[data-g3d-inspector]");
    const tracks = root.querySelector("[data-g3d-tracks]");
    const status = root.querySelector("[data-g3d-status]");
    const statusText = root.querySelector("[data-g3d-status-text]");
    const timeInput = root.querySelector("[data-g3d-time]");
    const timelineRange = root.querySelector("[data-g3d-timeline-range]");
    const durationLabel = root.querySelector("[data-g3d-duration]");
    const sceneName = root.querySelector("[data-g3d-scene-name]");

    function setStatus(message, warning) {
      statusText.textContent = message;
      status.classList.toggle("is-warning", Boolean(warning));
      clearTimeout(messageTimer);
      messageTimer = setTimeout(() => {
        statusText.textContent = scene.meta.assetPolicy || "Local scene ready. No backend required.";
        status.classList.remove("is-warning");
      }, 4500);
    }

    function selected() { return scene.objects.find((object) => object.id === selectedId) || null; }

    function renderObjects() {
      list.innerHTML = scene.objects.map((object) => `<button class="g3d-object${object.id === selectedId ? " is-selected" : ""}" data-g3d-select="${htmlEscape(object.id)}" aria-pressed="${object.id === selectedId}"><span class="g3d-object-badge">${object.type.slice(0, 2).toUpperCase()}</span><span class="g3d-object-copy"><span class="g3d-object-name">${htmlEscape(object.name)}</span><span class="g3d-object-type">${htmlEscape(TYPE_LABELS[object.type])}${object.locked ? " • locked" : ""}</span></span></button>`).join("") || `<div class="g3d-empty">Scene chưa có object. Thêm một primitive để bắt đầu.</div>`;
      const object = selected();
      if (!object) {
        inspector.innerHTML = `<div class="g3d-empty">Chọn một object để chỉnh sửa transform và material.</div>`;
        return;
      }
      const t = object.transform;
      inspector.innerHTML = `<div class="g3d-form">
        <div class="g3d-field"><label>Tên object</label><input data-g3d-field="name" value="${htmlEscape(object.name)}"></div>
        <div class="g3d-field"><label>Loại</label><input value="${htmlEscape(TYPE_LABELS[object.type])}" disabled></div>
        <div class="g3d-field"><label>Position</label><div class="g3d-vector">${["x", "y", "z"].map((axis) => `<input type="number" step="0.1" data-g3d-field="transform.position.${axis}" value="${t.position[axis]}">`).join("")}</div></div>
        <div class="g3d-field"><label>Rotation (deg)</label><div class="g3d-vector">${["x", "y", "z"].map((axis) => `<input type="number" step="1" data-g3d-field="transform.rotation.${axis}" value="${t.rotation[axis]}">`).join("")}</div></div>
        <div class="g3d-field"><label>Scale</label><div class="g3d-vector">${["x", "y", "z"].map((axis) => `<input type="number" step="0.1" min="0.05" data-g3d-field="transform.scale.${axis}" value="${t.scale[axis]}">`).join("")}</div></div>
        <div class="g3d-field"><label>Material color</label><input type="color" data-g3d-field="material.color" value="${htmlEscape(object.material.color)}"></div>
        <div class="g3d-field"><label>Opacity <output data-g3d-opacity-value>${Math.round(object.material.opacity * 100)}%</output></label><input type="range" min="0.05" max="1" step="0.01" data-g3d-field="material.opacity" value="${object.material.opacity}"></div>
        <label class="g3d-check"><input type="checkbox" data-g3d-field="visible" ${object.visible ? "checked" : ""}> Visible</label>
        <label class="g3d-check"><input type="checkbox" data-g3d-field="locked" ${object.locked ? "checked" : ""}> Lock transform</label>
        ${object.type === "model" ? `<div class="g3d-asset-note"><strong>Asset status: ${object.asset && object.asset.status === "imported" ? "imported metadata" : "needs import"}</strong><br>Studio chỉ lưu metadata và hiển thị placeholder. Chưa có engine GLTF/OBJ nên không tuyên bố render model thật.</div>` : ""}
      </div>`;
    }

    function renderTracks() {
      durationLabel.textContent = `0:${String(Math.round(scene.timeline.duration)).padStart(2, "0")}`;
      timeInput.value = scene.timeline.currentTime.toFixed(1);
      timelineRange.max = scene.timeline.duration;
      timelineRange.value = scene.timeline.currentTime;
      tracks.innerHTML = scene.objects.map((object) => {
        const frames = scene.timeline.keyframes.filter((frame) => frame.objectId === object.id);
        return `<div class="g3d-track"><div class="g3d-track-label">${htmlEscape(object.name)}</div><div class="g3d-track-line">${frames.map((frame) => `<span class="g3d-keyframe" title="${frame.time.toFixed(1)}s" style="left:${Math.min(98, (frame.time / scene.timeline.duration) * 100)}%"></span>`).join("")}</div></div>`;
      }).join("");
    }

    function render() {
      renderObjects();
      renderTracks();
      hitRegions = renderScene(canvas, scene, selectedId).hitRegions;
      root.querySelector("[data-g3d-grid]");
      sceneName.value = scene.name;
      root.querySelector("[data-g3d-setting='grid']").checked = scene.grid.visible;
      root.querySelector("[data-g3d-setting='snap']").checked = scene.grid.snap;
      root.querySelector("[data-g3d-setting='snap-size']").value = scene.grid.size;
      root.querySelector("[data-g3d-background]").value = scene.background;
      root.querySelector("[data-g3d-light]").value = scene.lights[0] && scene.lights[0].intensity != null ? scene.lights[0].intensity : 1;
    }

    function setPath(object, path, value) {
      const parts = path.split(".");
      let target = object;
      for (let index = 0; index < parts.length - 1; index += 1) target = target[parts[index]];
      target[parts[parts.length - 1]] = value;
    }

    function updateTransformFromInput(input) {
      const object = selected();
      if (!object || object.locked) return;
      const path = input.dataset.g3dField;
      let value;
      if (input.type === "checkbox") value = input.checked;
      else if (input.type === "color") value = input.value;
      else if (path === "name") value = input.value.slice(0, 80) || TYPE_LABELS[object.type];
      else value = numberOr(input.value, 0);
      if (path.startsWith("transform.position.")) {
        value = snapValue(value, scene.grid.snap, scene.grid.size);
      }
      setPath(object, path, value);
      scene.meta.updatedAt = new Date().toISOString();
      if (path === "material.opacity") {
        const output = root.querySelector("[data-g3d-opacity-value]");
        if (output) output.textContent = `${Math.round(object.material.opacity * 100)}%`;
      }
      render();
    }

    function addObject(type) {
      if (scene.objects.length >= MAX_OBJECTS) return setStatus(`Đã đạt giới hạn ${MAX_OBJECTS} object.`, true);
      const object = makeObject(type, { transform: { position: { x: scene.objects.length % 4 - 1.5, y: type === "plane" ? -0.8 : 0, z: Math.floor(scene.objects.length / 4) * 0.6 } } });
      scene.objects.push(object);
      selectedId = object.id;
      render();
      setStatus(`${TYPE_LABELS[type]} đã được thêm vào scene.`);
    }

    function duplicateSelected() {
      const object = selected();
      if (!object) return setStatus("Chọn object trước khi duplicate.", true);
      if (scene.objects.length >= MAX_OBJECTS) return setStatus(`Đã đạt giới hạn ${MAX_OBJECTS} object.`, true);
      const copy = makeObject(object.type, clone(object));
      copy.id = makeId("object");
      copy.name = `${object.name} copy`;
      copy.transform.position.x += scene.grid.snap ? scene.grid.size : 0.5;
      scene.objects.push(copy);
      selectedId = copy.id;
      render();
      setStatus("Đã duplicate object.");
    }

    function deleteSelected() {
      const object = selected();
      if (!object) return setStatus("Chọn object trước khi xóa.", true);
      scene.objects = scene.objects.filter((item) => item.id !== object.id);
      scene.timeline.keyframes = scene.timeline.keyframes.filter((frame) => frame.objectId !== object.id);
      selectedId = scene.objects[0] ? scene.objects[0].id : null;
      render();
      setStatus("Đã xóa object.");
    }

    function addKeyframe() {
      const object = selected();
      if (!object) return setStatus("Chọn object để tạo keyframe.", true);
      if (scene.timeline.keyframes.length >= MAX_KEYFRAMES) return setStatus(`Đã đạt giới hạn ${MAX_KEYFRAMES} keyframe.`, true);
      scene.timeline.keyframes = scene.timeline.keyframes.filter((frame) => !(frame.objectId === object.id && Math.abs(frame.time - scene.timeline.currentTime) < 0.001));
      scene.timeline.keyframes.push({ id: makeId("keyframe"), objectId: object.id, time: scene.timeline.currentTime, transform: clone(object.transform) });
      scene.timeline.keyframes.sort((a, b) => a.time - b.time);
      render();
      setStatus(`Đã đặt keyframe cho ${object.name} tại ${scene.timeline.currentTime.toFixed(1)}s.`);
    }

    function saveScene() {
      scene.meta.updatedAt = new Date().toISOString();
      if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(scene));
      setStatus("Đã lưu scene vào localStorage của thiết bị.");
    }

    function loadScene() {
      if (typeof localStorage === "undefined") return setStatus("Thiết bị không hỗ trợ localStorage.", true);
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return setStatus("Chưa có scene đã lưu trên thiết bị.", true);
      try {
        scene = normalizeScene(JSON.parse(raw));
        selectedId = scene.objects[0] ? scene.objects[0].id : null;
        render();
        setStatus("Đã tải scene từ localStorage.");
      } catch (error) {
        setStatus("Không thể tải scene: dữ liệu JSON không hợp lệ.", true);
      }
    }

    function newScene() {
      scene = createDefaultScene();
      selectedId = scene.objects[1] ? scene.objects[1].id : scene.objects[0].id;
      render();
      setStatus("Đã tạo scene mới. Scene cũ vẫn còn trong localStorage cho đến khi bạn Lưu.");
    }

    function exportProject() {
      const project = { format: "hh-graphic-design-3d", version: PROJECT_VERSION, exportedAt: new Date().toISOString(), scene: normalizeScene(scene) };
      downloadText(`${scene.name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "hh-scene"}.hh3d.json`, JSON.stringify(project, null, 2));
      setStatus("Đã xuất project JSON. Model thật vẫn cần asset import riêng.");
    }

    function loadSceneFile(file) {
      if (!file || typeof FileReader === "undefined") return setStatus("Thiết bị không hỗ trợ đọc file JSON.", true);
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || "{}"));
          scene = normalizeScene(parsed.scene && typeof parsed.scene === "object" ? parsed.scene : parsed);
          selectedId = scene.objects[0] ? scene.objects[0].id : null;
          render();
          setStatus(`Đã tải scene JSON từ ${file.name}.`);
        } catch (error) {
          setStatus("Không thể tải scene JSON: file không hợp lệ.", true);
        }
      };
      reader.onerror = () => setStatus("Không thể đọc file scene JSON.", true);
      reader.readAsText(file);
    }

    function importAsset(file) {
      if (!file) return;
      const object = makeObject("model", { name: file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Imported model", asset: { status: "imported", fileName: file.name, size: file.size, mime: file.type || "application/octet-stream", type: "3d-model" } });
      scene.objects.push(object);
      selectedId = object.id;
      render();
      setStatus(`Đã ghi nhận asset ${file.name}. Preview đang là placeholder; cần engine 3D để render model thật.`, true);
    }

    function setTime(value) {
      scene.timeline.currentTime = clamp(numberOr(value, 0), 0, scene.timeline.duration);
      render();
    }

    function tick(timestamp) {
      if (!scene.timeline.playing) return;
      if (!lastTick) lastTick = timestamp;
      const elapsed = (timestamp - lastTick) / 1000;
      lastTick = timestamp;
      scene.timeline.currentTime += elapsed;
      if (scene.timeline.currentTime >= scene.timeline.duration) {
        if (scene.timeline.loop) scene.timeline.currentTime = 0;
        else { scene.timeline.currentTime = scene.timeline.duration; scene.timeline.playing = false; }
      }
      renderTracks();
      hitRegions = renderScene(canvas, scene, selectedId).hitRegions;
      animationFrame = runtime.requestAnimationFrame ? runtime.requestAnimationFrame(tick) : 0;
    }

    function togglePlay() {
      scene.timeline.playing = !scene.timeline.playing;
      lastTick = 0;
      root.querySelector('[data-g3d-action="play"]').textContent = scene.timeline.playing ? "Pause" : "Play";
      if (scene.timeline.playing && runtime.requestAnimationFrame) animationFrame = runtime.requestAnimationFrame(tick);
      else if (animationFrame && runtime.cancelAnimationFrame) runtime.cancelAnimationFrame(animationFrame);
      setStatus(scene.timeline.playing ? "Timeline đang chạy." : "Timeline đã tạm dừng.");
    }

    function resetCamera() {
      scene.camera = { yaw: 45, pitch: 30, zoom: 1, distance: 8 };
      render();
      setStatus("Camera đã reset.");
    }

    app.addEventListener("click", (event) => {
      const target = event.target.closest("[data-g3d-action],[data-g3d-add],[data-g3d-select]");
      if (!target) return;
      if (target.dataset.g3dSelect) { selectedId = target.dataset.g3dSelect; render(); return; }
      if (target.dataset.g3dAdd) return addObject(target.dataset.g3dAdd);
      const action = target.dataset.g3dAction;
      if (action === "new") newScene();
      if (action === "save") saveScene();
      if (action === "load") loadScene();
      if (action === "load-json") sceneFile.click();
      if (action === "export") exportProject();
      if (action === "import") root.querySelector("[data-g3d-file]").click();
      if (action === "duplicate") duplicateSelected();
      if (action === "delete") deleteSelected();
      if (action === "keyframe") addKeyframe();
      if (action === "play") togglePlay();
      if (action === "reset-camera") resetCamera();
    });

    app.addEventListener("input", (event) => {
      const target = event.target;
      if (target.dataset.g3dField) updateTransformFromInput(target);
      if (target.dataset.g3dSetting === "grid") { scene.grid.visible = target.checked; render(); }
      if (target.dataset.g3dSetting === "snap") { scene.grid.snap = target.checked; render(); }
      if (target.dataset.g3dSetting === "snap-size") { scene.grid.size = clamp(numberOr(target.value, 0.5), 0.1, 5); render(); }
      if (target.dataset.g3dTime) setTime(target.value);
      if (target.dataset.g3dTimelineRange) setTime(target.value);
      if (target.dataset.g3dBackground) { scene.background = target.value; render(); }
      if (target.dataset.g3dLight) { scene.lights[0].intensity = clamp(numberOr(target.value, 1), 0, 2); render(); }
    });

    sceneName.addEventListener("change", () => { scene.name = sceneName.value.trim().slice(0, 100) || "Untitled HH Scene"; render(); });
    root.querySelector("[data-g3d-file]").addEventListener("change", (event) => { importAsset(event.target.files && event.target.files[0]); event.target.value = ""; });
    sceneFile.addEventListener("change", (event) => { loadSceneFile(event.target.files && event.target.files[0]); event.target.value = ""; });
    canvas.addEventListener("wheel", (event) => { event.preventDefault(); scene.camera.zoom = clamp(scene.camera.zoom + (event.deltaY < 0 ? 0.08 : -0.08), 0.35, 2.5); render(); }, { passive: false });
    canvas.addEventListener("pointerdown", (event) => { pointerState = { x: event.clientX, y: event.clientY, yaw: scene.camera.yaw, pitch: scene.camera.pitch }; canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener("pointermove", (event) => { if (!pointerState) return; const dx = event.clientX - pointerState.x; const dy = event.clientY - pointerState.y; scene.camera.yaw = clamp(pointerState.yaw + dx * 0.35, -180, 180); scene.camera.pitch = clamp(pointerState.pitch + dy * 0.2, 10, 80); render(); });
    canvas.addEventListener("pointerup", (event) => { const start = pointerState; pointerState = null; if (!start) return; const moved = Math.abs(event.clientX - start.x) + Math.abs(event.clientY - start.y); if (moved > 6) return; const rect = canvas.getBoundingClientRect(); const x = event.clientX - rect.left; const y = event.clientY - rect.top; const hit = hitRegions.filter((item) => x >= item.minX && x <= item.maxX && y >= item.minY && y <= item.maxY).sort((a, b) => a.depth - b.depth)[0]; if (hit) { selectedId = hit.id; render(); } });
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => render()).observe(canvas);

    const controller = {
      mount: () => controller,
      getState: () => clone(scene),
      addObject,
      selectObject: (id) => { if (scene.objects.some((object) => object.id === id)) { selectedId = id; render(); } },
      duplicateSelected,
      deleteSelected,
      addKeyframe,
      save: saveScene,
      load: loadScene,
      exportProject,
      resetCamera,
      destroy: () => { if (animationFrame && runtime.cancelAnimationFrame) runtime.cancelAnimationFrame(animationFrame); clearTimeout(messageTimer); if (style.parentNode) style.parentNode.removeChild(style); root.innerHTML = ""; delete root.__hhGraphic3DController; delete root.__hhGraphic3DMounted; }
    };
    root.__hhGraphic3DController = controller;
    render();
    return controller;
  }

  function autoMount() {
    if (typeof document === "undefined") return;
    document.querySelectorAll("[data-graphic-3d]").forEach((root) => mount(root));
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", autoMount, { once: true });
    else autoMount();
  }

  return {
    mount,
    createDefaultScene,
    normalizeScene,
    makeObject,
    projectPoint,
    transformAt,
    snapValue,
    constants: { STORAGE_KEY, PROJECT_VERSION, MAX_OBJECTS, MAX_KEYFRAMES, TYPE_LABELS }
  };
});
