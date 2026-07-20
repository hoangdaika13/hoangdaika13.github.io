(function (runtime, factory) {
  "use strict";

  const api = factory(runtime);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  runtime.HHGraphicCharacterPro = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function (runtime) {
  "use strict";

  const VERSION = 3;
  const FORMAT = "hh-character-pro";
  const STORAGE_KEY = "hh.graphic-character-pro.project.v3";
  const STYLE_ID = "hh-graphic-character-pro-styles-v3";
  const STAGE = Object.freeze({ width: 600, height: 700 });
  const MAX_VERTICES = 2000;
  const MAX_TIMING_ITEMS = 2000;
  const MAX_MARKERS = 5000;
  let idSequence = 0;

  const BONE_DEFINITIONS = Object.freeze([
    { id: "root", parent: null, x: 300, y: 400 },
    { id: "hips", parent: "root", x: 300, y: 430 },
    { id: "spine", parent: "hips", x: 300, y: 355 },
    { id: "chest", parent: "spine", x: 300, y: 285 },
    { id: "neck", parent: "chest", x: 300, y: 215 },
    { id: "head", parent: "neck", x: 300, y: 145 },
    { id: "upperArmL", parent: "chest", x: 225, y: 275 },
    { id: "lowerArmL", parent: "upperArmL", x: 165, y: 350 },
    { id: "handL", parent: "lowerArmL", x: 120, y: 430 },
    { id: "upperArmR", parent: "chest", x: 375, y: 275 },
    { id: "lowerArmR", parent: "upperArmR", x: 435, y: 350 },
    { id: "handR", parent: "lowerArmR", x: 480, y: 430 },
    { id: "upperLegL", parent: "hips", x: 265, y: 455 },
    { id: "lowerLegL", parent: "upperLegL", x: 255, y: 560 },
    { id: "footL", parent: "lowerLegL", x: 245, y: 665 },
    { id: "upperLegR", parent: "hips", x: 335, y: 455 },
    { id: "lowerLegR", parent: "upperLegR", x: 345, y: 560 },
    { id: "footR", parent: "lowerLegR", x: 355, y: 665 }
  ]);

  const PUPPET_VIEWS = Object.freeze([
    { id: "front", label: "Chính diện", depth: 1, mirror: false },
    { id: "three-quarter-left", label: "Nghiêng trái 3/4", depth: 0.72, mirror: false },
    { id: "profile-left", label: "Trái", depth: 0.24, mirror: false },
    { id: "back", label: "Sau lưng", depth: 1, mirror: true },
    { id: "profile-right", label: "Phải", depth: 0.24, mirror: true },
    { id: "three-quarter-right", label: "Nghiêng phải 3/4", depth: 0.72, mirror: true }
  ]);

  const FACIAL_CONTROLS = Object.freeze([
    { id: "smile", label: "Cười", min: 0, max: 1, defaultValue: 0 },
    { id: "jawOpen", label: "Mở hàm", min: 0, max: 1, defaultValue: 0 },
    { id: "pucker", label: "Chu môi", min: 0, max: 1, defaultValue: 0 },
    { id: "blinkLeft", label: "Chớp trái", min: 0, max: 1, defaultValue: 0 },
    { id: "blinkRight", label: "Chớp phải", min: 0, max: 1, defaultValue: 0 },
    { id: "browRaise", label: "Nâng mày", min: 0, max: 1, defaultValue: 0 },
    { id: "browFrown", label: "Cau mày", min: 0, max: 1, defaultValue: 0 },
    { id: "cheekPuff", label: "Phồng má", min: 0, max: 1, defaultValue: 0 }
  ]);

  const VISEMES = Object.freeze(["REST", "A", "E", "I", "O", "U", "MBP", "FV", "L", "WQ", "TH", "CH", "NG"]);
  const VISEME_BLEND_MAP = Object.freeze({
    REST: {},
    A: { jawOpen: 0.82 },
    E: { jawOpen: 0.36, smile: 0.52 },
    I: { jawOpen: 0.22, smile: 0.72 },
    O: { jawOpen: 0.55, pucker: 0.7 },
    U: { jawOpen: 0.28, pucker: 0.9 },
    MBP: { jawOpen: 0, pucker: 0.18 },
    FV: { jawOpen: 0.16, smile: 0.18 },
    L: { jawOpen: 0.42 },
    WQ: { pucker: 0.78, jawOpen: 0.18 },
    TH: { jawOpen: 0.3 },
    CH: { jawOpen: 0.26, pucker: 0.36 },
    NG: { jawOpen: 0.2 }
  });

  const POSE_LIBRARY = Object.freeze([
    { id: "neutral", label: "Tự nhiên", transforms: {} },
    { id: "wave", label: "Vẫy tay", transforms: { upperArmR: { rotation: -48 }, lowerArmR: { rotation: -78 }, handR: { rotation: -18 }, chest: { rotation: -3 } } },
    { id: "walk", label: "Đi bộ", transforms: { root: { x: 5 }, chest: { rotation: 4 }, upperArmL: { rotation: -24 }, upperArmR: { rotation: 24 }, upperLegL: { rotation: 22 }, upperLegR: { rotation: -22 }, lowerLegL: { rotation: -12 }, lowerLegR: { rotation: 18 } } },
    { id: "run", label: "Chạy", transforms: { root: { x: 10, y: -8 }, chest: { rotation: 10 }, upperArmL: { rotation: -48 }, upperArmR: { rotation: 48 }, upperLegL: { rotation: 42 }, upperLegR: { rotation: -38 }, lowerLegL: { rotation: -32 }, lowerLegR: { rotation: 44 } } },
    { id: "jump", label: "Nhảy", transforms: { root: { y: -65 }, upperArmL: { rotation: -65 }, upperArmR: { rotation: 65 }, upperLegL: { rotation: 20 }, upperLegR: { rotation: -20 }, lowerLegL: { rotation: -48 }, lowerLegR: { rotation: 48 } } },
    { id: "sit", label: "Ngồi", transforms: { root: { y: 45 }, hips: { rotation: -6 }, upperLegL: { rotation: -72 }, upperLegR: { rotation: 72 }, lowerLegL: { rotation: 68 }, lowerLegR: { rotation: -68 } } },
    { id: "talk", label: "Trò chuyện", transforms: { chest: { rotation: -3 }, upperArmL: { rotation: -18 }, lowerArmL: { rotation: 24 }, upperArmR: { rotation: 22 }, lowerArmR: { rotation: -34 } } },
    { id: "fight", label: "Chiến đấu", transforms: { root: { x: 8, y: 8 }, chest: { rotation: 12 }, upperArmL: { rotation: -58 }, lowerArmL: { rotation: 74 }, upperArmR: { rotation: 38 }, lowerArmR: { rotation: -62 }, upperLegL: { rotation: 24 }, upperLegR: { rotation: -30 } } }
  ]);

  function uid(prefix) {
    idSequence += 1;
    return `${prefix}-${Date.now().toString(36)}-${idSequence.toString(36)}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function finite(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max, fallback) {
    return Math.min(max, Math.max(min, finite(value, fallback == null ? min : fallback)));
  }

  function cleanText(value, maxLength) {
    return String(value == null ? "" : value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, maxLength);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function safeId(value, fallback) {
    const id = String(value || "");
    return /^[a-zA-Z][\w-]{0,63}$/.test(id) ? id : fallback;
  }

  function createSkeleton(overrides) {
    const source = overrides && typeof overrides === "object" ? overrides : {};
    return BONE_DEFINITIONS.reduce((bones, definition) => {
      const current = source[definition.id] || {};
      bones[definition.id] = {
        x: clamp(current.x, -600, 600, 0),
        y: clamp(current.y, -700, 700, 0),
        rotation: clamp(current.rotation, -360, 360, 0),
        scaleX: clamp(current.scaleX, 0.25, 4, 1),
        scaleY: clamp(current.scaleY, 0.25, 4, 1)
      };
      return bones;
    }, {});
  }

  function createDefaultMesh() {
    const vertices = [
      ["headTop", 300, 58, "head"], ["headL", 247, 105, "head"], ["headR", 353, 105, "head"],
      ["jawL", 258, 183, "head"], ["jawR", 342, 183, "head"], ["neckL", 282, 215, "neck"], ["neckR", 318, 215, "neck"],
      ["shoulderL", 220, 250, "chest"], ["shoulderR", 380, 250, "chest"], ["waistL", 262, 395, "spine"], ["waistR", 338, 395, "spine"],
      ["hipL", 258, 445, "hips"], ["hipR", 342, 445, "hips"], ["elbowL", 160, 350, "lowerArmL"], ["elbowR", 440, 350, "lowerArmR"],
      ["handL", 112, 442, "handL"], ["handR", 488, 442, "handR"], ["kneeL", 252, 555, "lowerLegL"], ["kneeR", 348, 555, "lowerLegR"],
      ["ankleL", 242, 652, "footL"], ["ankleR", 358, 652, "footR"], ["toeL", 220, 681, "footL"], ["toeR", 380, 681, "footR"],
      ["eyeL", 278, 125, "head"], ["eyeR", 322, 125, "head"], ["browL", 276, 108, "head"], ["browR", 324, 108, "head"],
      ["mouthL", 280, 160, "head"], ["mouthR", 320, 160, "head"], ["mouthTop", 300, 155, "head"], ["mouthBottom", 300, 166, "head"]
    ].map(([id, x, y, bone]) => ({ id, x, y, weights: { [bone]: 1 } }));
    return {
      id: "human-mesh",
      vertices,
      triangles: [
        [0, 1, 2], [1, 3, 4], [1, 4, 2], [3, 5, 6], [3, 6, 4],
        [5, 7, 8], [5, 8, 6], [7, 9, 10], [7, 10, 8], [9, 11, 12], [9, 12, 10],
        [7, 13, 9], [13, 15, 9], [8, 10, 14], [14, 10, 16],
        [11, 17, 12], [17, 18, 12], [17, 19, 20], [17, 20, 18], [19, 21, 20], [21, 22, 20]
      ],
      blendShapes: {
        smile: { mouthL: { x: -5, y: -5 }, mouthR: { x: 5, y: -5 }, mouthTop: { y: 2 } },
        jawOpen: { jawL: { y: 5 }, jawR: { y: 5 }, mouthBottom: { y: 14 }, mouthL: { y: 3 }, mouthR: { y: 3 } },
        pucker: { mouthL: { x: 9 }, mouthR: { x: -9 }, mouthTop: { y: -2 }, mouthBottom: { y: 2 } },
        blinkLeft: { eyeL: { y: 5 } }, blinkRight: { eyeR: { y: 5 } },
        browRaise: { browL: { y: -9 }, browR: { y: -9 } },
        browFrown: { browL: { x: 4, y: 3 }, browR: { x: -4, y: 3 } },
        cheekPuff: { jawL: { x: -5 }, jawR: { x: 5 } }
      }
    };
  }

  function normalizeWeights(rawWeights) {
    const allowed = new Set(BONE_DEFINITIONS.map((bone) => bone.id));
    const entries = Object.entries(rawWeights && typeof rawWeights === "object" ? rawWeights : {})
      .filter(([id]) => allowed.has(id))
      .map(([id, weight]) => [id, clamp(weight, 0, 1, 0)])
      .filter((entry) => entry[1] > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    const total = entries.reduce((sum, entry) => sum + entry[1], 0);
    if (!total) return { root: 1 };
    return entries.reduce((weights, [id, weight]) => {
      weights[id] = weight / total;
      return weights;
    }, {});
  }

  function normalizeMesh(raw) {
    const fallback = createDefaultMesh();
    const source = raw && typeof raw === "object" ? raw : fallback;
    const inputVertices = Array.isArray(source.vertices) && source.vertices.length >= 3 ? source.vertices : fallback.vertices;
    const used = new Set();
    const vertices = inputVertices.slice(0, MAX_VERTICES).map((vertex, index) => {
      let id = safeId(vertex && vertex.id, `vertex-${index}`);
      while (used.has(id)) id = `${id}-${index}`;
      used.add(id);
      return {
        id,
        x: clamp(vertex && vertex.x, -2000, 2000, 0),
        y: clamp(vertex && vertex.y, -2000, 2000, 0),
        weights: normalizeWeights(vertex && vertex.weights)
      };
    });
    const triangles = (Array.isArray(source.triangles) ? source.triangles : fallback.triangles)
      .slice(0, MAX_VERTICES * 2)
      .map((triangle) => Array.isArray(triangle) ? triangle.slice(0, 3).map((index) => Math.floor(finite(index, -1))) : [])
      .filter((triangle) => triangle.length === 3 && triangle.every((index) => index >= 0 && index < vertices.length));
    const blendShapes = {};
    Object.entries(source.blendShapes && typeof source.blendShapes === "object" ? source.blendShapes : fallback.blendShapes)
      .slice(0, 48)
      .forEach(([shapeId, deltas]) => {
        const id = safeId(shapeId, "");
        if (!id || !deltas || typeof deltas !== "object") return;
        blendShapes[id] = {};
        Object.entries(deltas).slice(0, vertices.length).forEach(([vertexId, delta]) => {
          if (!used.has(vertexId) || !delta || typeof delta !== "object") return;
          blendShapes[id][vertexId] = {
            x: clamp(delta.x, -500, 500, 0),
            y: clamp(delta.y, -500, 500, 0)
          };
        });
      });
    return { id: safeId(source.id, fallback.id), vertices, triangles, blendShapes };
  }

  function evaluateFacialRig(rawControls, viseme) {
    const source = rawControls && typeof rawControls === "object" ? rawControls : {};
    const result = FACIAL_CONTROLS.reduce((weights, control) => {
      weights[control.id] = clamp(source[control.id], control.min, control.max, control.defaultValue);
      return weights;
    }, {});
    const visemeWeights = VISEME_BLEND_MAP[VISEMES.includes(viseme) ? viseme : "REST"];
    Object.entries(visemeWeights).forEach(([id, value]) => {
      result[id] = Math.max(result[id] || 0, value);
    });
    return result;
  }

  function applyBlendShapes(mesh, rawWeights) {
    const source = normalizeMesh(mesh);
    const weights = rawWeights && typeof rawWeights === "object" ? rawWeights : {};
    return source.vertices.map((vertex) => {
      const point = { ...vertex, weights: { ...vertex.weights } };
      Object.entries(source.blendShapes).forEach(([shapeId, deltas]) => {
        const weight = clamp(weights[shapeId], 0, 1, 0);
        const delta = deltas[vertex.id];
        if (!delta || !weight) return;
        point.x += delta.x * weight;
        point.y += delta.y * weight;
      });
      return point;
    });
  }

  function transformByBone(point, definition, transform) {
    const angle = clamp(transform.rotation, -360, 360, 0) * Math.PI / 180;
    const scaleX = clamp(transform.scaleX, 0.25, 4, 1);
    const scaleY = clamp(transform.scaleY, 0.25, 4, 1);
    const dx = (point.x - definition.x) * scaleX;
    const dy = (point.y - definition.y) * scaleY;
    return {
      x: definition.x + dx * Math.cos(angle) - dy * Math.sin(angle) + clamp(transform.x, -600, 600, 0),
      y: definition.y + dx * Math.sin(angle) + dy * Math.cos(angle) + clamp(transform.y, -700, 700, 0)
    };
  }

  function deformMesh(rawMesh, rawSkeleton, rawBlendWeights) {
    const mesh = normalizeMesh(rawMesh);
    const skeleton = createSkeleton(rawSkeleton);
    const definitions = new Map(BONE_DEFINITIONS.map((bone) => [bone.id, bone]));
    const morphed = applyBlendShapes(mesh, rawBlendWeights);
    const vertices = morphed.map((vertex) => {
      let x = 0;
      let y = 0;
      Object.entries(vertex.weights).forEach(([boneId, weight]) => {
        const transformed = transformByBone(vertex, definitions.get(boneId), skeleton[boneId]);
        x += transformed.x * weight;
        y += transformed.y * weight;
      });
      return { ...vertex, sourceX: vertex.x, sourceY: vertex.y, x, y };
    });
    return { ...mesh, vertices };
  }

  function createDefaultDynamics() {
    const chain = (id, kind, points, stiffness, damping) => ({ id, kind, enabled: true, stiffness, damping, gravity: 160, wind: 0, points });
    return {
      enabled: true,
      chains: [
        chain("hair-left", "hair", [
          { id: "hl-0", x: 265, y: 92, prevX: 265, prevY: 92, pinned: true, anchorBone: "head", anchorOffsetX: -35, anchorOffsetY: -53, restLength: 0 },
          { id: "hl-1", x: 242, y: 145, prevX: 242, prevY: 145, pinned: false, anchorBone: "", restLength: 58 },
          { id: "hl-2", x: 236, y: 205, prevX: 236, prevY: 205, pinned: false, anchorBone: "", restLength: 60 }
        ], 0.74, 0.12),
        chain("hair-right", "hair", [
          { id: "hr-0", x: 335, y: 92, prevX: 335, prevY: 92, pinned: true, anchorBone: "head", anchorOffsetX: 35, anchorOffsetY: -53, restLength: 0 },
          { id: "hr-1", x: 358, y: 145, prevX: 358, prevY: 145, pinned: false, anchorBone: "", restLength: 58 },
          { id: "hr-2", x: 364, y: 205, prevX: 364, prevY: 205, pinned: false, anchorBone: "", restLength: 60 }
        ], 0.74, 0.12),
        chain("jacket-hem", "clothing", [
          { id: "jh-0", x: 266, y: 388, prevX: 266, prevY: 388, pinned: true, anchorBone: "spine", anchorOffsetX: -34, anchorOffsetY: 33, restLength: 0 },
          { id: "jh-1", x: 250, y: 432, prevX: 250, prevY: 432, pinned: false, anchorBone: "", restLength: 47 },
          { id: "jh-2", x: 265, y: 468, prevX: 265, prevY: 468, pinned: false, anchorBone: "", restLength: 39 }
        ], 0.82, 0.18)
      ]
    };
  }

  function normalizeDynamics(raw) {
    const fallback = createDefaultDynamics();
    const source = raw && typeof raw === "object" ? raw : fallback;
    const inputChains = Array.isArray(source.chains) && source.chains.length ? source.chains : fallback.chains;
    return {
      enabled: source.enabled !== false,
      chains: inputChains.slice(0, 24).map((item, chainIndex) => {
        const defaultChain = fallback.chains[chainIndex % fallback.chains.length];
        const points = Array.isArray(item.points) && item.points.length >= 2 ? item.points : defaultChain.points;
        return {
          id: safeId(item.id, `dynamic-${chainIndex}`),
          kind: item.kind === "clothing" ? "clothing" : "hair",
          enabled: item.enabled !== false,
          stiffness: clamp(item.stiffness, 0.05, 1, defaultChain.stiffness),
          damping: clamp(item.damping, 0, 0.95, defaultChain.damping),
          gravity: clamp(item.gravity, -1000, 1000, defaultChain.gravity),
          wind: clamp(item.wind, -1000, 1000, 0),
          points: points.slice(0, 32).map((point, pointIndex) => ({
            id: safeId(point.id, `point-${pointIndex}`),
            x: clamp(point.x, -2000, 2000, 0), y: clamp(point.y, -2000, 2000, 0),
            prevX: clamp(point.prevX, -2000, 2000, finite(point.x, 0)),
            prevY: clamp(point.prevY, -2000, 2000, finite(point.y, 0)),
            pinned: pointIndex === 0 ? true : point.pinned === true,
            anchorBone: safeId(point.anchorBone, ""),
            anchorOffsetX: clamp(point.anchorOffsetX, -500, 500, 0),
            anchorOffsetY: clamp(point.anchorOffsetY, -500, 500, 0),
            restLength: pointIndex === 0 ? 0 : clamp(point.restLength, 1, 500, 40)
          }))
        };
      })
    };
  }

  function stepDynamics(rawDynamics, anchorTargets, deltaTime) {
    const dynamics = normalizeDynamics(rawDynamics);
    if (!dynamics.enabled) return dynamics;
    const anchors = anchorTargets && typeof anchorTargets === "object" ? anchorTargets : {};
    const dt = clamp(deltaTime, 1 / 240, 1 / 15, 1 / 60);
    dynamics.chains.forEach((chain) => {
      if (!chain.enabled) return;
      chain.points.forEach((point) => {
        if (point.pinned) {
          const anchor = anchors[point.anchorBone];
          if (anchor && Number.isFinite(Number(anchor.x)) && Number.isFinite(Number(anchor.y))) {
            const oldX = point.x;
            const oldY = point.y;
            point.x = Number(anchor.x) + point.anchorOffsetX;
            point.y = Number(anchor.y) + point.anchorOffsetY;
            point.prevX += point.x - oldX;
            point.prevY += point.y - oldY;
          }
          return;
        }
        const velocityX = (point.x - point.prevX) * (1 - chain.damping);
        const velocityY = (point.y - point.prevY) * (1 - chain.damping);
        point.prevX = point.x;
        point.prevY = point.y;
        point.x += velocityX + chain.wind * dt * dt;
        point.y += velocityY + chain.gravity * dt * dt;
      });
      for (let iteration = 0; iteration < 4; iteration += 1) {
        for (let index = 1; index < chain.points.length; index += 1) {
          const parent = chain.points[index - 1];
          const point = chain.points[index];
          const dx = point.x - parent.x;
          const dy = point.y - parent.y;
          const distance = Math.max(0.0001, Math.hypot(dx, dy));
          const correction = (distance - point.restLength) / distance * chain.stiffness;
          if (parent.pinned) {
            point.x -= dx * correction;
            point.y -= dy * correction;
          } else {
            point.x -= dx * correction * 0.5;
            point.y -= dy * correction * 0.5;
            parent.x += dx * correction * 0.5;
            parent.y += dy * correction * 0.5;
          }
        }
      }
    });
    return dynamics;
  }

  function applyPose(rawSkeleton, poseId, amount) {
    const skeleton = createSkeleton(rawSkeleton);
    const pose = POSE_LIBRARY.find((item) => item.id === poseId) || POSE_LIBRARY[0];
    const weight = clamp(amount, 0, 1, 1);
    Object.entries(pose.transforms).forEach(([boneId, transform]) => {
      if (!skeleton[boneId]) return;
      ["x", "y", "rotation"].forEach((property) => {
        if (transform[property] == null) return;
        skeleton[boneId][property] += (finite(transform[property], 0) - skeleton[boneId][property]) * weight;
      });
      ["scaleX", "scaleY"].forEach((property) => {
        if (transform[property] == null) return;
        skeleton[boneId][property] += (finite(transform[property], 1) - skeleton[boneId][property]) * weight;
      });
    });
    return skeleton;
  }

  function easingValue(name, rawValue) {
    const value = clamp(rawValue, 0, 1, 0);
    if (name === "step") return value < 1 ? 0 : 1;
    if (name === "ease-in") return value * value;
    if (name === "ease-out") return 1 - Math.pow(1 - value, 2);
    if (name === "ease-in-out") return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
    return value;
  }

  function interpolateValues(start, end, amount) {
    if (typeof start === "number" && typeof end === "number") return start + (end - start) * amount;
    if (Array.isArray(start) && Array.isArray(end)) return start.map((value, index) => interpolateValues(value, end[index] == null ? value : end[index], amount));
    if (start && end && typeof start === "object" && typeof end === "object") {
      const result = {};
      new Set([...Object.keys(start), ...Object.keys(end)]).forEach((key) => {
        result[key] = interpolateValues(start[key], end[key], amount);
      });
      return result;
    }
    return amount < 0.5 ? (start == null ? end : start) : (end == null ? start : end);
  }

  function interpolateKeyframes(rawFrames, rawTime, options) {
    const frames = (Array.isArray(rawFrames) ? rawFrames : [])
      .filter((frame) => frame && Number.isFinite(Number(frame.time)))
      .map((frame) => ({ time: Number(frame.time), value: clone(frame.value), easing: frame.easing || "linear" }))
      .sort((a, b) => a.time - b.time);
    if (!frames.length) return null;
    const duration = Math.max(0, finite(options && options.duration, frames[frames.length - 1].time));
    let time = finite(rawTime, 0);
    if (options && options.loop && duration > 0) time = ((time % duration) + duration) % duration;
    if (time <= frames[0].time) return clone(frames[0].value);
    if (time >= frames[frames.length - 1].time) return clone(frames[frames.length - 1].value);
    const afterIndex = frames.findIndex((frame) => frame.time >= time);
    const before = frames[afterIndex - 1];
    const after = frames[afterIndex];
    const progress = easingValue(after.easing, (time - before.time) / Math.max(0.000001, after.time - before.time));
    return interpolateValues(before.value, after.value, progress);
  }

  function createDefaultMotionClips() {
    const track = (target, values) => ({ target, keyframes: values.map(([time, value, easing]) => ({ time, value, easing: easing || "ease-in-out" })) });
    return [
      { id: "idle", label: "Thở nhẹ", duration: 2, loop: true, tracks: [track("bones.chest.y", [[0, 0], [1, -3], [2, 0]]), track("facial.blinkLeft", [[0, 0], [1.82, 0], [1.9, 1], [2, 0]], "linear"), track("facial.blinkRight", [[0, 0], [1.82, 0], [1.9, 1], [2, 0]])] },
      { id: "walk", label: "Đi bộ", duration: 1.2, loop: true, tracks: [track("bones.root.y", [[0, 0], [0.3, -7], [0.6, 0], [0.9, -7], [1.2, 0]]), track("bones.upperLegL.rotation", [[0, 24], [0.6, -24], [1.2, 24]]), track("bones.upperLegR.rotation", [[0, -24], [0.6, 24], [1.2, -24]]), track("bones.upperArmL.rotation", [[0, -20], [0.6, 20], [1.2, -20]]), track("bones.upperArmR.rotation", [[0, 20], [0.6, -20], [1.2, 20]])] },
      { id: "wave", label: "Vẫy tay", duration: 1.5, loop: true, tracks: [track("bones.upperArmR.rotation", [[0, -42], [0.75, -58], [1.5, -42]]), track("bones.lowerArmR.rotation", [[0, -58], [0.38, -88], [0.75, -55], [1.12, -88], [1.5, -58]]), track("facial.smile", [[0, 0.2], [0.4, 0.8], [1.5, 0.2]])] },
      { id: "talk", label: "Trò chuyện", duration: 2, loop: true, tracks: [track("bones.head.rotation", [[0, -2], [0.7, 3], [1.4, -1], [2, -2]]), track("bones.upperArmL.rotation", [[0, -15], [1, -28], [2, -15]]), track("bones.lowerArmL.rotation", [[0, 18], [1, 36], [2, 18]])] }
    ];
  }

  function normalizeMotionClip(raw, fallback, index) {
    const source = raw && typeof raw === "object" ? raw : fallback;
    const duration = clamp(source.duration, 0.05, 3600, fallback ? fallback.duration : 1);
    return {
      id: safeId(source.id, fallback ? fallback.id : `clip-${index}`),
      label: cleanText(source.label || (fallback && fallback.label) || `Clip ${index + 1}`, 80),
      duration,
      loop: source.loop !== false,
      tracks: (Array.isArray(source.tracks) ? source.tracks : (fallback ? fallback.tracks : [])).slice(0, 200).map((trackItem) => ({
        target: cleanText(trackItem.target, 120),
        keyframes: (Array.isArray(trackItem.keyframes) ? trackItem.keyframes : []).slice(0, 1000).map((frame) => ({
          time: clamp(frame.time, 0, duration, 0),
          value: typeof frame.value === "number" ? clamp(frame.value, -10000, 10000, 0) : clone(frame.value),
          easing: ["linear", "step", "ease-in", "ease-out", "ease-in-out"].includes(frame.easing) ? frame.easing : "ease-in-out"
        })).sort((a, b) => a.time - b.time)
      })).filter((trackItem) => /^(bones|facial)\.[a-zA-Z][\w-]*\.[a-zA-Z][\w-]*$/.test(trackItem.target) || /^facial\.[a-zA-Z][\w-]*$/.test(trackItem.target))
    };
  }

  function setPath(target, path, value) {
    const parts = path.split(".");
    let cursor = target;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) cursor[part] = value;
      else {
        if (!cursor[part] || typeof cursor[part] !== "object") cursor[part] = {};
        cursor = cursor[part];
      }
    });
  }

  function getPath(target, path, fallback) {
    const value = path.split(".").reduce((cursor, part) => cursor && cursor[part], target);
    return value == null ? fallback : value;
  }

  function sampleMotionClip(rawClip, time) {
    if (!rawClip || typeof rawClip !== "object") return { bones: {}, facial: {} };
    const fallback = { id: "clip", label: "Clip", duration: 1, loop: true, tracks: [] };
    const clip = normalizeMotionClip(rawClip, fallback, 0);
    const sampled = { bones: {}, facial: {} };
    clip.tracks.forEach((track) => {
      const value = interpolateKeyframes(track.keyframes, time, { duration: clip.duration, loop: clip.loop });
      if (value != null) setPath(sampled, track.target, value);
    });
    return sampled;
  }

  function flattenNumbers(value, prefix, output) {
    Object.entries(value && typeof value === "object" ? value : {}).forEach(([key, item]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof item === "number" && Number.isFinite(item)) output[path] = item;
      else if (item && typeof item === "object") flattenNumbers(item, path, output);
    });
    return output;
  }

  function mixMotionClips(rawLayers, time, rawBase) {
    const base = rawBase && typeof rawBase === "object" ? clone(rawBase) : { bones: createSkeleton(), facial: evaluateFacialRig({}) };
    if (!base.bones) base.bones = createSkeleton();
    if (!base.facial) base.facial = evaluateFacialRig({});
    (Array.isArray(rawLayers) ? rawLayers : []).slice(0, 16).forEach((layer) => {
      if (!layer || !layer.clip || layer.enabled === false) return;
      const weight = clamp(layer.weight, 0, 1, 1);
      const sampleTime = finite(time, 0) * clamp(layer.timeScale, -8, 8, 1) + finite(layer.offset, 0);
      const values = flattenNumbers(sampleMotionClip(layer.clip, sampleTime), "", {});
      Object.entries(values).forEach(([path, value]) => {
        const current = finite(getPath(base, path, 0), 0);
        setPath(base, path, layer.additive === true ? current + value * weight : current + (value - current) * weight);
      });
    });
    base.bones = createSkeleton(base.bones);
    base.facial = evaluateFacialRig(base.facial);
    return base;
  }

  function createMotionMixer(rawClips) {
    const defaults = createDefaultMotionClips();
    const clips = (Array.isArray(rawClips) && rawClips.length ? rawClips : defaults).map((clip, index) => normalizeMotionClip(clip, defaults[index % defaults.length], index));
    let layers = [];
    return {
      addLayer(clipId, options) {
        const clip = clips.find((item) => item.id === clipId);
        if (!clip) return null;
        const layer = { id: uid("mix"), clipId, weight: clamp(options && options.weight, 0, 1, 1), timeScale: clamp(options && options.timeScale, -8, 8, 1), offset: finite(options && options.offset, 0), additive: options && options.additive === true, enabled: true };
        layers.push(layer);
        return clone(layer);
      },
      removeLayer(id) { layers = layers.filter((layer) => layer.id !== id); },
      setWeight(id, weight) { const layer = layers.find((item) => item.id === id); if (layer) layer.weight = clamp(weight, 0, 1, layer.weight); },
      sample(time, base) { return mixMotionClips(layers.map((layer) => ({ ...layer, clip: clips.find((clip) => clip.id === layer.clipId) })), time, base); },
      getState() { return { clips: clone(clips), layers: clone(layers) }; }
    };
  }

  function normalizeLanguage(language, content) {
    if (language === "vi" || language === "en") return language;
    return /[ăâđêôơưàáạảãèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹ]/i.test(String(content || "")) ? "vi" : "en";
  }

  function plainLetters(value) {
    return String(value || "").toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
  }

  function wordToVisemes(word, language) {
    const letters = plainLetters(word);
    const lang = normalizeLanguage(language, word);
    const output = [];
    let index = 0;
    while (index < letters.length) {
      const pair = letters.slice(index, index + 2);
      const triple = letters.slice(index, index + 3);
      let viseme = "REST";
      let advance = 1;
      if (triple === "ngh") { viseme = "NG"; advance = 3; }
      else if (["ng", "nh"].includes(pair)) { viseme = "NG"; advance = 2; }
      else if (["ch", "tr", "sh", "zh"].includes(pair)) { viseme = "CH"; advance = 2; }
      else if (pair === "th") { viseme = "TH"; advance = 2; }
      else if (["ph", "wh"].includes(pair)) { viseme = pair === "ph" ? "FV" : "WQ"; advance = 2; }
      else if (pair === "qu") { viseme = "WQ"; advance = 2; }
      else {
        const letter = letters[index];
        if ("bmp".includes(letter)) viseme = "MBP";
        else if ("fv".includes(letter)) viseme = "FV";
        else if (letter === "l") viseme = "L";
        else if ("wq".includes(letter)) viseme = "WQ";
        else if ("kg".includes(letter) && lang === "vi") viseme = "NG";
        else if (letter === "a") viseme = "A";
        else if (letter === "e") viseme = "E";
        else if (letter === "i" || letter === "y") viseme = "I";
        else if (letter === "o") viseme = "O";
        else if (letter === "u") viseme = "U";
        else if ("tdnszrxhcj".includes(letter)) viseme = letter === "h" ? "REST" : "CH";
      }
      if (viseme !== "REST" || !output.length) output.push(viseme);
      index += advance;
    }
    return output.length ? output : ["REST"];
  }

  function textToVisemes(rawText, language, options) {
    const transcript = cleanText(rawText, 12000);
    const lang = normalizeLanguage(language, transcript);
    const wordsPerMinute = clamp(options && options.wordsPerMinute, 60, 300, lang === "vi" ? 145 : 155);
    const startTime = Math.max(0, finite(options && options.startTime, 0));
    const tokens = transcript.match(/[\p{L}\p{M}'’-]+|[.,!?;:]/gu) || [];
    const markers = [];
    let cursor = startTime;
    tokens.slice(0, MAX_TIMING_ITEMS).forEach((token) => {
      if (/^[.,!?;:]$/.test(token)) {
        const pause = /[.!?]/.test(token) ? 0.24 : 0.12;
        markers.push({ id: `text-${markers.length}`, time: Number(cursor.toFixed(3)), duration: pause, viseme: "REST", token, language: lang, source: "text-rule" });
        cursor += pause;
        return;
      }
      const visemes = wordToVisemes(token, lang);
      const wordDuration = Math.max(0.12, 60 / wordsPerMinute);
      const unit = wordDuration / visemes.length;
      visemes.forEach((viseme) => {
        markers.push({ id: `text-${markers.length}`, time: Number(cursor.toFixed(3)), duration: Number(unit.toFixed(3)), viseme, token, language: lang, source: "text-rule" });
        cursor += unit;
      });
      cursor += 0.035;
    });
    return markers.slice(0, MAX_MARKERS);
  }

  function audioTimingToVisemes(rawTiming, language) {
    const timing = Array.isArray(rawTiming) ? rawTiming : [];
    const markers = [];
    timing.slice(0, MAX_TIMING_ITEMS).forEach((item, timingIndex) => {
      if (!item || typeof item !== "object") return;
      const token = cleanText(item.word != null ? item.word : item.text, 160);
      const lang = normalizeLanguage(item.language || language, token);
      const start = clamp(item.start != null ? item.start : item.time, 0, 86400, 0);
      const end = clamp(item.end, start, 86400, start + clamp(item.duration, 0.02, 30, 0.2));
      const directViseme = VISEMES.includes(item.viseme) ? item.viseme : null;
      const visemes = directViseme ? [directViseme] : wordToVisemes(token, lang);
      const unit = Math.max(0.01, (end - start) / visemes.length);
      visemes.forEach((viseme, index) => {
        markers.push({
          id: `timing-${timingIndex}-${index}`,
          time: Number((start + index * unit).toFixed(3)),
          duration: Number(unit.toFixed(3)),
          viseme,
          token,
          language: lang,
          source: "provided-audio-timing"
        });
      });
    });
    return markers.sort((a, b) => a.time - b.time).slice(0, MAX_MARKERS);
  }

  function sampleViseme(markers, time) {
    const safeTime = Math.max(0, finite(time, 0));
    const marker = (Array.isArray(markers) ? markers : []).find((item) => safeTime >= item.time && safeTime < item.time + item.duration);
    return marker && VISEMES.includes(marker.viseme) ? marker.viseme : "REST";
  }

  function projectPuppetView(rawVertices, viewId, stage) {
    const view = PUPPET_VIEWS.find((item) => item.id === viewId) || PUPPET_VIEWS[0];
    const width = finite(stage && stage.width, STAGE.width);
    const center = width / 2;
    return (Array.isArray(rawVertices) ? rawVertices : []).map((vertex) => {
      const local = (finite(vertex.x, center) - center) * view.depth;
      const x = center + (view.mirror ? -local : local);
      const perspective = view.depth < 1 ? (finite(vertex.y, 0) - STAGE.height * 0.45) * (1 - view.depth) * 0.025 : 0;
      return { ...vertex, x: x + (view.mirror ? -perspective : perspective), view: view.id };
    });
  }

  function createDefaultProject() {
    const clips = createDefaultMotionClips();
    return {
      format: FORMAT,
      version: VERSION,
      meta: { name: "Nhân vật Pro", author: "", createdAt: nowIso(), updatedAt: nowIso() },
      stage: { width: STAGE.width, height: STAGE.height, background: "#f4f5f7" },
      puppet: { view: "front", skinColor: "#f3bd9f", outfitColor: "#2f6f68", hairColor: "#27232d", outlineColor: "#24262b" },
      mesh: createDefaultMesh(),
      skeleton: createSkeleton(),
      facialRig: { controls: evaluateFacialRig({}), activeViseme: "REST" },
      dynamics: createDefaultDynamics(),
      pose: { activeId: "neutral" },
      motion: { duration: 4, fps: 30, loop: true, clips, layers: [{ id: "layer-idle", clipId: "idle", weight: 1, timeScale: 1, offset: 0, additive: false, enabled: true }] },
      lipSync: { language: "vi", transcript: "", source: "none", markers: [], audioTiming: [] },
      camera: { enabled: false, status: "idle", mode: "luminance-centroid-guidance", consentStored: false, limitation: "Camera guidance cục bộ, không phải motion capture hay nhận diện khuôn mặt." },
      export: { spriteColumns: 4, spriteFps: 12, includeViews: ["front"] }
    };
  }

  function normalizeColor(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback;
  }

  function normalizeMarkers(rawMarkers, language) {
    return (Array.isArray(rawMarkers) ? rawMarkers : []).slice(0, MAX_MARKERS).map((marker, index) => ({
      id: safeId(marker.id, `marker-${index}`),
      time: clamp(marker.time, 0, 86400, 0),
      duration: clamp(marker.duration, 0.01, 30, 0.1),
      viseme: VISEMES.includes(marker.viseme) ? marker.viseme : "REST",
      token: cleanText(marker.token, 160),
      language: normalizeLanguage(marker.language || language, marker.token),
      source: marker.source === "provided-audio-timing" ? "provided-audio-timing" : "text-rule"
    })).sort((a, b) => a.time - b.time);
  }

  function normalizeProject(raw) {
    const fallback = createDefaultProject();
    const source = raw && typeof raw === "object" ? raw : fallback;
    const clipsInput = Array.isArray(source.motion && source.motion.clips) && source.motion.clips.length ? source.motion.clips : fallback.motion.clips;
    const clips = clipsInput.slice(0, 40).map((clip, index) => normalizeMotionClip(clip, fallback.motion.clips[index % fallback.motion.clips.length], index));
    const clipIds = new Set(clips.map((clip) => clip.id));
    const language = normalizeLanguage(source.lipSync && source.lipSync.language, source.lipSync && source.lipSync.transcript);
    const views = (Array.isArray(source.export && source.export.includeViews) ? source.export.includeViews : fallback.export.includeViews).filter((id) => PUPPET_VIEWS.some((view) => view.id === id));
    return {
      format: FORMAT,
      version: VERSION,
      meta: {
        name: cleanText(source.meta && source.meta.name || fallback.meta.name, 120),
        author: cleanText(source.meta && source.meta.author || "", 120),
        createdAt: cleanText(source.meta && source.meta.createdAt || fallback.meta.createdAt, 40),
        updatedAt: nowIso()
      },
      stage: { width: STAGE.width, height: STAGE.height, background: normalizeColor(source.stage && source.stage.background, fallback.stage.background) },
      puppet: {
        view: PUPPET_VIEWS.some((view) => view.id === (source.puppet && source.puppet.view)) ? source.puppet.view : "front",
        skinColor: normalizeColor(source.puppet && source.puppet.skinColor, fallback.puppet.skinColor),
        outfitColor: normalizeColor(source.puppet && source.puppet.outfitColor, fallback.puppet.outfitColor),
        hairColor: normalizeColor(source.puppet && source.puppet.hairColor, fallback.puppet.hairColor),
        outlineColor: normalizeColor(source.puppet && source.puppet.outlineColor, fallback.puppet.outlineColor)
      },
      mesh: normalizeMesh(source.mesh),
      skeleton: createSkeleton(source.skeleton),
      facialRig: { controls: evaluateFacialRig(source.facialRig && source.facialRig.controls), activeViseme: VISEMES.includes(source.facialRig && source.facialRig.activeViseme) ? source.facialRig.activeViseme : "REST" },
      dynamics: normalizeDynamics(source.dynamics),
      pose: { activeId: POSE_LIBRARY.some((pose) => pose.id === (source.pose && source.pose.activeId)) ? source.pose.activeId : "neutral" },
      motion: {
        duration: clamp(source.motion && source.motion.duration, 0.1, 3600, fallback.motion.duration),
        fps: [12, 15, 24, 25, 30, 50, 60].includes(Number(source.motion && source.motion.fps)) ? Number(source.motion.fps) : 30,
        loop: !source.motion || source.motion.loop !== false,
        clips,
        layers: (Array.isArray(source.motion && source.motion.layers) ? source.motion.layers : fallback.motion.layers).slice(0, 16).map((layer, index) => ({
          id: safeId(layer.id, `layer-${index}`),
          clipId: clipIds.has(layer.clipId) ? layer.clipId : clips[0].id,
          weight: clamp(layer.weight, 0, 1, 1), timeScale: clamp(layer.timeScale, -8, 8, 1), offset: finite(layer.offset, 0), additive: layer.additive === true, enabled: layer.enabled !== false
        }))
      },
      lipSync: {
        language,
        transcript: cleanText(source.lipSync && source.lipSync.transcript, 12000),
        source: source.lipSync && source.lipSync.source === "provided-audio-timing" ? "provided-audio-timing" : (source.lipSync && source.lipSync.source === "text-rule" ? "text-rule" : "none"),
        markers: normalizeMarkers(source.lipSync && source.lipSync.markers, language),
        audioTiming: (Array.isArray(source.lipSync && source.lipSync.audioTiming) ? source.lipSync.audioTiming : []).slice(0, MAX_TIMING_ITEMS).map((item) => ({ word: cleanText(item.word || item.text, 160), start: clamp(item.start, 0, 86400, 0), end: clamp(item.end, 0, 86400, 0) }))
      },
      camera: { enabled: false, status: "idle", mode: "luminance-centroid-guidance", consentStored: false, limitation: fallback.camera.limitation },
      export: { spriteColumns: Math.round(clamp(source.export && source.export.spriteColumns, 1, 12, 4)), spriteFps: Math.round(clamp(source.export && source.export.spriteFps, 1, 60, 12)), includeViews: views.length ? [...new Set(views)] : ["front"] }
    };
  }

  function upgradeCharacterProject(baseProject) {
    if (!baseProject || typeof baseProject !== "object") return createDefaultProject();
    if (baseProject.format === FORMAT) return normalizeProject(baseProject);
    const project = createDefaultProject();
    project.meta.name = cleanText(baseProject.meta && baseProject.meta.name || project.meta.name, 120);
    project.meta.author = cleanText(baseProject.meta && baseProject.meta.author || "", 120);
    const oldView = baseProject.character && baseProject.character.view;
    const viewMap = { front: "front", left: "profile-left", right: "profile-right", back: "back" };
    project.puppet.view = viewMap[oldView] || "front";
    const oldExpression = baseProject.character && baseProject.character.expression;
    if (oldExpression === "happy") project.facialRig.controls.smile = 0.8;
    if (oldExpression === "surprised") project.facialRig.controls.jawOpen = 0.65;
    if (oldExpression === "blink") { project.facialRig.controls.blinkLeft = 1; project.facialRig.controls.blinkRight = 1; }
    return normalizeProject(project);
  }

  function serializeProject(project) {
    return JSON.stringify(normalizeProject(project), null, 2);
  }

  function parseProject(json) {
    if (typeof json !== "string" || json.length > 5_000_000) throw new Error("Tệp project không hợp lệ hoặc quá lớn.");
    let parsed;
    try { parsed = JSON.parse(json); } catch (_) { throw new Error("JSON project không hợp lệ."); }
    return parsed && parsed.format === FORMAT ? normalizeProject(parsed) : upgradeCharacterProject(parsed);
  }

  function buildSpriteManifest(rawProject, options) {
    const project = normalizeProject(rawProject);
    const fps = Math.round(clamp(options && options.fps, 1, 60, project.export.spriteFps));
    const duration = clamp(options && options.duration, 0.05, 30, Math.min(4, project.motion.duration));
    const views = (Array.isArray(options && options.views) ? options.views : project.export.includeViews).filter((id) => PUPPET_VIEWS.some((view) => view.id === id));
    const selectedViews = views.length ? [...new Set(views)] : [project.puppet.view];
    const frameTimes = Array.from({ length: Math.min(240, Math.max(1, Math.ceil(duration * fps))) }, (_, index) => index / fps);
    const frames = [];
    selectedViews.forEach((view) => frameTimes.forEach((time) => frames.push({ index: frames.length, view, time: Number(time.toFixed(4)) })));
    const columns = Math.min(Math.round(clamp(options && options.columns, 1, 12, project.export.spriteColumns)), Math.max(1, frames.length));
    const rows = Math.ceil(frames.length / columns);
    const cellWidth = Math.round(clamp(options && options.cellWidth, 64, 1024, 256));
    const cellHeight = Math.round(clamp(options && options.cellHeight, 64, 1024, 300));
    frames.forEach((frame) => { frame.x = frame.index % columns * cellWidth; frame.y = Math.floor(frame.index / columns) * cellHeight; frame.width = cellWidth; frame.height = cellHeight; });
    return { format: "hh-character-sprite-manifest", version: 1, projectName: project.meta.name, fps, duration, columns, rows, cellWidth, cellHeight, width: columns * cellWidth, height: rows * cellHeight, frames };
  }

  function detectCapabilities(scope) {
    const host = scope || runtime;
    const documentRef = host && host.document;
    let canvasSupported = false;
    try { canvasSupported = Boolean(documentRef && documentRef.createElement("canvas").getContext("2d")); } catch (_) { canvasSupported = false; }
    let storageSupported = false;
    try { storageSupported = Boolean(host && host.localStorage); } catch (_) { storageSupported = false; }
    return {
      camera: { supported: Boolean(host && host.navigator && host.navigator.mediaDevices && typeof host.navigator.mediaDevices.getUserMedia === "function"), reason: "Camera guidance cần MediaDevices và quyền do người dùng cấp trong phiên." },
      sprite: { supported: canvasSupported, reason: canvasSupported ? "" : "Trình duyệt không hỗ trợ Canvas 2D." },
      localStorage: { supported: storageSupported, reason: storageSupported ? "" : "Không thể dùng lưu trữ cục bộ trong ngữ cảnh này." },
      reducedMotion: Boolean(host && host.matchMedia && host.matchMedia("(prefers-reduced-motion: reduce)").matches)
    };
  }

  function estimateCameraGuidance(imageData, width, height) {
    const data = imageData && imageData.data ? imageData.data : imageData;
    const w = Math.max(1, Math.floor(finite(width, 1)));
    const h = Math.max(1, Math.floor(finite(height, 1)));
    if (!data || data.length < w * h * 4) return { x: 0, y: 0, confidence: 0, headX: 0, headY: 0, mode: "luminance-centroid-guidance" };
    let average = 0;
    const pixels = w * h;
    for (let index = 0; index < pixels; index += 1) average += (data[index * 4] * 0.2126 + data[index * 4 + 1] * 0.7152 + data[index * 4 + 2] * 0.0722) / 255;
    average /= pixels;
    let total = 0;
    let sumX = 0;
    let sumY = 0;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const index = (y * w + x) * 4;
        const luminance = (data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722) / 255;
        const weight = Math.max(0, luminance - average - 0.04);
        total += weight;
        sumX += x * weight;
        sumY += y * weight;
      }
    }
    if (total < pixels * 0.003) return { x: 0, y: 0, confidence: 0, headX: 0, headY: 0, mode: "luminance-centroid-guidance" };
    const normalizedX = (sumX / total / Math.max(1, w - 1) - 0.5) * 2;
    const normalizedY = (sumY / total / Math.max(1, h - 1) - 0.5) * 2;
    return { x: normalizedX, y: normalizedY, confidence: clamp(total / (pixels * 0.18), 0, 1, 0), headX: normalizedX * 22, headY: normalizedY * 14, mode: "luminance-centroid-guidance" };
  }

  async function requestCameraTracking(options) {
    const settings = options && typeof options === "object" ? options : {};
    if (settings.consent !== true) {
      const error = new Error("Cần xác nhận rõ ràng trước khi xin quyền camera.");
      error.code = "CONSENT_REQUIRED";
      throw error;
    }
    const scope = settings.runtime || runtime;
    const capabilities = detectCapabilities(scope);
    if (!capabilities.camera.supported) {
      const error = new Error(capabilities.camera.reason);
      error.code = "CAMERA_UNSUPPORTED";
      throw error;
    }
    const stream = await scope.navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    let stopped = false;
    return {
      status: "ready",
      stream,
      mode: "luminance-centroid-guidance",
      limitation: "Ước lượng tâm sáng cục bộ để dẫn hướng puppet; không phải motion capture, face tracking hay nhận diện.",
      analyzeFrame: estimateCameraGuidance,
      stop() {
        if (stopped) return;
        stopped = true;
        if (stream && typeof stream.getTracks === "function") stream.getTracks().forEach((track) => track.stop());
      }
    };
  }

  function storageFor(scope) {
    try { return scope && scope.localStorage ? scope.localStorage : null; } catch (_) { return null; }
  }

  function saveProject(project, storage) {
    const target = storage || storageFor(runtime);
    if (!target || typeof target.setItem !== "function") return { saved: false, reason: "Local storage không khả dụng." };
    try { target.setItem(STORAGE_KEY, serializeProject(project)); return { saved: true, key: STORAGE_KEY }; }
    catch (error) { return { saved: false, reason: cleanText(error && error.message || "Không thể lưu project.", 180) }; }
  }

  function loadProject(storage) {
    const target = storage || storageFor(runtime);
    if (!target || typeof target.getItem !== "function") return createDefaultProject();
    try { const value = target.getItem(STORAGE_KEY); return value ? parseProject(value) : createDefaultProject(); }
    catch (_) { return createDefaultProject(); }
  }

  function motionFrame(project, time) {
    const layers = project.motion.layers.map((layer) => ({ ...layer, clip: project.motion.clips.find((clip) => clip.id === layer.clipId) })).filter((layer) => layer.clip);
    return mixMotionClips(layers, time, { bones: project.skeleton, facial: project.facialRig.controls });
  }

  function dynamicsAnchors(bones) {
    const definitions = new Map(BONE_DEFINITIONS.map((bone) => [bone.id, bone]));
    return ["head", "spine"].reduce((anchors, id) => {
      const definition = definitions.get(id);
      const transform = bones[id] || {};
      anchors[id] = { x: definition.x + finite(transform.x, 0), y: definition.y + finite(transform.y, 0) };
      return anchors;
    }, {});
  }

  function drawPuppet(context, rawProject, time, viewId, viewport, dynamicState, cameraGuide) {
    const project = normalizeProject(rawProject);
    const view = PUPPET_VIEWS.some((item) => item.id === viewId) ? viewId : project.puppet.view;
    const frame = motionFrame(project, time);
    if (cameraGuide && cameraGuide.confidence > 0.05) {
      frame.bones.head.x += cameraGuide.headX;
      frame.bones.head.y += cameraGuide.headY;
      frame.bones.head.rotation += cameraGuide.x * 8;
    }
    const viseme = sampleViseme(project.lipSync.markers, time);
    const facial = evaluateFacialRig(frame.facial, viseme);
    const mesh = deformMesh(project.mesh, frame.bones, facial);
    const points = projectPuppetView(mesh.vertices, view, project.stage);
    const byIndex = points;
    const byId = new Map(points.map((point) => [point.id, point]));
    const target = viewport || { x: 0, y: 0, width: STAGE.width, height: STAGE.height };
    context.save();
    context.beginPath();
    context.rect(target.x, target.y, target.width, target.height);
    context.clip();
    context.translate(target.x, target.y);
    context.scale(target.width / STAGE.width, target.height / STAGE.height);
    context.fillStyle = project.stage.background;
    context.fillRect(0, 0, STAGE.width, STAGE.height);
    context.lineJoin = "round";
    context.lineWidth = 5;
    context.strokeStyle = project.puppet.outlineColor;
    context.fillStyle = project.puppet.outfitColor;
    project.mesh.triangles.forEach((triangle, index) => {
      const a = byIndex[triangle[0]];
      const b = byIndex[triangle[1]];
      const c = byIndex[triangle[2]];
      if (!a || !b || !c) return;
      context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.lineTo(c.x, c.y); context.closePath();
      context.fillStyle = index < 5 ? project.puppet.skinColor : project.puppet.outfitColor;
      context.fill(); context.stroke();
    });
    const eyeL = byId.get("eyeL");
    const eyeR = byId.get("eyeR");
    context.fillStyle = project.puppet.outlineColor;
    [eyeL, eyeR].filter(Boolean).forEach((eye) => { context.beginPath(); context.arc(eye.x, eye.y, 5, 0, Math.PI * 2); context.fill(); });
    const mouthL = byId.get("mouthL"); const mouthR = byId.get("mouthR"); const mouthBottom = byId.get("mouthBottom");
    if (mouthL && mouthR && mouthBottom) { context.beginPath(); context.moveTo(mouthL.x, mouthL.y); context.quadraticCurveTo(mouthBottom.x, mouthBottom.y, mouthR.x, mouthR.y); context.stroke(); }
    const dynamics = dynamicState ? normalizeDynamics(dynamicState) : project.dynamics;
    dynamics.chains.forEach((chain) => {
      if (!chain.enabled || chain.points.length < 2) return;
      const projected = projectPuppetView(chain.points, view, project.stage);
      context.beginPath(); context.moveTo(projected[0].x, projected[0].y); projected.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      context.strokeStyle = chain.kind === "hair" ? project.puppet.hairColor : project.puppet.outfitColor;
      context.lineWidth = chain.kind === "hair" ? 17 : 11;
      context.stroke();
    });
    context.restore();
    return { bones: frame.bones, facial, viseme };
  }

  function renderSpriteSheet(rawProject, options) {
    const scope = options && options.runtime || runtime;
    const capabilities = detectCapabilities(scope);
    if (!capabilities.sprite.supported) return { supported: false, reason: capabilities.sprite.reason };
    const project = normalizeProject(rawProject);
    const manifest = buildSpriteManifest(project, options);
    const canvas = scope.document.createElement("canvas");
    canvas.width = manifest.width;
    canvas.height = manifest.height;
    const context = canvas.getContext("2d");
    manifest.frames.forEach((frame) => drawPuppet(context, project, frame.time, frame.view, frame));
    return { supported: true, canvas, manifest };
  }

  function canvasBlob(canvas, type) {
    return new Promise((resolve) => {
      if (!canvas || typeof canvas.toBlob !== "function") { resolve(null); return; }
      canvas.toBlob(resolve, type || "image/png");
    });
  }

  function downloadBlob(scope, blob, fileName) {
    if (!scope || !scope.document || !scope.URL || typeof scope.URL.createObjectURL !== "function" || !blob) return false;
    const url = scope.URL.createObjectURL(blob);
    const anchor = scope.document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.hidden = true;
    scope.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    scope.setTimeout(() => scope.URL.revokeObjectURL(url), 0);
    return true;
  }

  function ensureStyles(documentRef) {
    if (!documentRef || documentRef.getElementById(STYLE_ID)) return;
    const style = documentRef.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .hhcp{--hhcp-ink:#202228;--hhcp-muted:#686b73;--hhcp-line:#d8dadd;--hhcp-panel:#fff;--hhcp-stage:#f4f5f7;--hhcp-accent:#187a70;--hhcp-warm:#b94c65;color:var(--hhcp-ink);background:#eceeef;font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;min-width:0}
      .hhcp *{box-sizing:border-box}.hhcp button,.hhcp input,.hhcp select,.hhcp textarea{font:inherit}.hhcp button,.hhcp input,.hhcp select,.hhcp textarea{border:1px solid var(--hhcp-line);border-radius:6px;background:#fff;color:var(--hhcp-ink)}
      .hhcp button{min-height:36px;padding:7px 11px;cursor:pointer}.hhcp button:hover{border-color:var(--hhcp-accent)}.hhcp button[aria-pressed="true"],.hhcp button[data-primary]{background:var(--hhcp-accent);border-color:var(--hhcp-accent);color:#fff}
      .hhcp button:focus-visible,.hhcp input:focus-visible,.hhcp select:focus-visible,.hhcp textarea:focus-visible,.hhcp canvas:focus-visible{outline:3px solid #efb34b;outline-offset:2px}.hhcp button:disabled{cursor:not-allowed;opacity:.55}
      .hhcp-shell{display:grid;grid-template-rows:auto auto minmax(0,1fr);min-height:650px}.hhcp-top{display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--hhcp-panel);border-bottom:1px solid var(--hhcp-line)}
      .hhcp-brand{display:flex;flex-direction:column;min-width:180px}.hhcp-brand strong{font-size:16px}.hhcp-brand small{color:var(--hhcp-muted)}.hhcp-name{display:flex;align-items:center;gap:7px;min-width:0;flex:1}.hhcp-name input{width:min(300px,100%);padding:7px 9px}
      .hhcp-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.hhcp-views{display:flex;gap:6px;padding:8px 12px;overflow-x:auto;background:#f8f9fa;border-bottom:1px solid var(--hhcp-line)}.hhcp-views button{white-space:nowrap}
      .hhcp-workspace{display:grid;grid-template-columns:minmax(320px,1fr) minmax(280px,340px);min-height:0}.hhcp-stage-wrap{position:relative;display:grid;place-items:center;padding:16px;min-width:0;background:#dfe2e4}.hhcp-canvas{display:block;width:min(100%,720px);height:auto;aspect-ratio:6/7;background:var(--hhcp-stage);border:1px solid #c8cbd0;box-shadow:0 8px 24px rgba(32,34,40,.12)}
      .hhcp-playbar{position:absolute;left:24px;right:24px;bottom:24px;display:flex;align-items:center;gap:8px;padding:8px;background:rgba(255,255,255,.94);border:1px solid var(--hhcp-line);border-radius:7px}.hhcp-playbar input{min-width:0;flex:1}.hhcp-time{font-variant-numeric:tabular-nums;min-width:48px;text-align:right}
      .hhcp-inspector{overflow:auto;background:var(--hhcp-panel);border-left:1px solid var(--hhcp-line)}.hhcp-section{padding:12px;border-bottom:1px solid var(--hhcp-line)}.hhcp-section h2{font-size:13px;margin:0 0 10px}.hhcp-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.hhcp-grid button{min-width:0}.hhcp-field{display:grid;grid-template-columns:minmax(88px,1fr) minmax(100px,1.3fr);align-items:center;gap:8px;margin:7px 0}.hhcp-field input[type="range"]{width:100%}.hhcp-field select,.hhcp-field textarea{width:100%;padding:7px}.hhcp-field textarea{grid-column:1/-1;min-height:72px;resize:vertical}.hhcp-check{display:flex;gap:8px;align-items:flex-start;margin:9px 0}.hhcp-check input{margin-top:3px}.hhcp-camera-video{display:none;width:100%;margin-top:8px;background:#111;aspect-ratio:4/3;object-fit:cover}.hhcp-camera-video[data-active="true"]{display:block}
      .hhcp-status{min-height:20px;margin:7px 0 0;color:var(--hhcp-muted)}.hhcp-status[data-tone="error"]{color:#a32643}.hhcp-status[data-tone="ok"]{color:#116c50}.hhcp-file,.hhcp-sr{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
      @media(max-width:900px){.hhcp-workspace{grid-template-columns:minmax(0,1fr)}.hhcp-inspector{border-left:0;border-top:1px solid var(--hhcp-line);display:grid;grid-template-columns:repeat(2,minmax(0,1fr));overflow:visible}.hhcp-section{min-width:0}}
      @media(max-width:620px){.hhcp-shell{min-height:0}.hhcp-top{align-items:stretch;flex-direction:column}.hhcp-name{width:100%}.hhcp-actions{justify-content:flex-start}.hhcp-actions button{flex:1 1 auto}.hhcp-stage-wrap{padding:8px 8px 72px}.hhcp-playbar{left:12px;right:12px;bottom:12px}.hhcp-inspector{grid-template-columns:1fr}.hhcp-field{grid-template-columns:minmax(82px,1fr) minmax(0,1.4fr)}}
      @media(max-width:440px){.hhcp{font-size:13px}.hhcp-top,.hhcp-views,.hhcp-section{padding-left:9px;padding-right:9px}.hhcp-grid{grid-template-columns:1fr 1fr}.hhcp button{padding-left:8px;padding-right:8px}.hhcp-playbar{gap:5px}.hhcp-time{min-width:42px}}
      @media(prefers-reduced-motion:reduce){.hhcp *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
    `;
    (documentRef.head || documentRef.documentElement).appendChild(style);
  }

  function createController(root, options) {
    const documentRef = root.ownerDocument || runtime.document;
    const scope = documentRef.defaultView || runtime;
    ensureStyles(documentRef);
    const storage = options.storage || storageFor(scope);
    let project = options.project ? normalizeProject(options.project) : loadProject(storage);
    let currentTime = 0;
    let playing = false;
    let lastTimestamp = 0;
    let animationFrame = 0;
    let cameraSession = null;
    let cameraGuide = null;
    let dynamicsState = normalizeDynamics(project.dynamics);
    let destroyed = false;
    const capabilities = detectCapabilities(scope);

    root.classList.add("hhcp");
    root.dataset.graphicCharacterPro = "mounted";
    root.setAttribute("role", "application");
    root.setAttribute("aria-label", "HH Character Creator 3.0 Pro");
    root.innerHTML = `<section class="hhcp-shell">
      <header class="hhcp-top">
        <div class="hhcp-brand"><strong>Character Creator 3.0</strong><small>Pro add-on</small></div>
        <label class="hhcp-name"><span>Tên</span><input data-hhcp-name maxlength="120" value="${escapeHtml(project.meta.name)}"></label>
        <div class="hhcp-actions"><button type="button" data-hhcp-action="import">Nhập project</button><button type="button" data-hhcp-action="export">Xuất project</button><button type="button" data-hhcp-action="sprite" data-primary>Xuất sprite</button></div>
        <input class="hhcp-file" type="file" accept="application/json" data-hhcp-project-file aria-label="Chọn project JSON">
      </header>
      <nav class="hhcp-views" aria-label="Góc nhìn puppet">${PUPPET_VIEWS.map((view) => `<button type="button" data-hhcp-view="${view.id}" aria-pressed="${view.id === project.puppet.view}">${escapeHtml(view.label)}</button>`).join("")}</nav>
      <div class="hhcp-workspace">
        <main class="hhcp-stage-wrap"><canvas class="hhcp-canvas" width="600" height="700" tabindex="0" data-hhcp-canvas aria-label="Puppet nhiều góc nhìn, dùng phím mũi tên trái phải để đổi góc"></canvas>
          <div class="hhcp-playbar"><button type="button" data-hhcp-action="play" aria-label="Phát chuyển động">Phát</button><input type="range" min="0" max="${project.motion.duration}" step="0.01" value="0" data-hhcp-time aria-label="Thời gian"><span class="hhcp-time" data-hhcp-time-label>0.00s</span></div>
        </main>
        <aside class="hhcp-inspector" aria-label="Thuộc tính nhân vật">
          <section class="hhcp-section"><h2>Pose</h2><div class="hhcp-grid">${POSE_LIBRARY.map((pose) => `<button type="button" data-hhcp-pose="${pose.id}" aria-pressed="${pose.id === project.pose.activeId}">${escapeHtml(pose.label)}</button>`).join("")}</div></section>
          <section class="hhcp-section"><h2>Facial rig</h2>${FACIAL_CONTROLS.map((control) => `<label class="hhcp-field"><span>${escapeHtml(control.label)}</span><input type="range" min="0" max="1" step="0.01" value="${project.facialRig.controls[control.id]}" data-hhcp-face="${control.id}"></label>`).join("")}</section>
          <section class="hhcp-section"><h2>Motion mixer</h2><label class="hhcp-field"><span>Clip</span><select data-hhcp-motion>${project.motion.clips.map((clip) => `<option value="${clip.id}"${clip.id === project.motion.layers[0]?.clipId ? " selected" : ""}>${escapeHtml(clip.label)}</option>`).join("")}</select></label><label class="hhcp-field"><span>Trọng số</span><input type="range" min="0" max="1" step="0.01" value="${project.motion.layers[0]?.weight ?? 1}" data-hhcp-mix-weight></label><label class="hhcp-check"><input type="checkbox" data-hhcp-dynamics${project.dynamics.enabled ? " checked" : ""}><span>Hair / clothing dynamics</span></label></section>
          <section class="hhcp-section"><h2>Lip-sync Việt / Anh</h2><label class="hhcp-field"><span>Ngôn ngữ</span><select data-hhcp-language><option value="vi"${project.lipSync.language === "vi" ? " selected" : ""}>Tiếng Việt</option><option value="en"${project.lipSync.language === "en" ? " selected" : ""}>English</option><option value="auto">Tự nhận theo chữ</option></select></label><label class="hhcp-field"><span class="hhcp-sr">Văn bản</span><textarea maxlength="12000" data-hhcp-transcript placeholder="Nhập lời thoại">${escapeHtml(project.lipSync.transcript)}</textarea></label><div class="hhcp-grid"><button type="button" data-hhcp-action="text-viseme">Tạo từ chữ</button><button type="button" data-hhcp-action="timing-import">Nhập timing</button></div><input class="hhcp-file" type="file" accept="application/json" data-hhcp-timing-file aria-label="Chọn audio timing JSON"><p class="hhcp-status" data-hhcp-lip-status>${project.lipSync.markers.length} viseme</p></section>
          <section class="hhcp-section"><h2>Camera guidance</h2><label class="hhcp-check"><input type="checkbox" data-hhcp-camera-consent><span>Tôi đồng ý xin quyền camera cho phiên này</span></label><div class="hhcp-grid"><button type="button" data-hhcp-action="camera"${capabilities.camera.supported ? "" : " disabled"}>Bật camera</button><button type="button" data-hhcp-action="camera-stop" disabled>Dừng</button></div><video class="hhcp-camera-video" autoplay muted playsinline data-hhcp-video></video><p class="hhcp-status" data-hhcp-camera-status>${escapeHtml(capabilities.camera.supported ? "Chưa cấp quyền. Không phải motion capture." : capabilities.camera.reason)}</p></section>
          <section class="hhcp-section"><h2>Màu</h2><label class="hhcp-field"><span>Trang phục</span><input type="color" value="${project.puppet.outfitColor}" data-hhcp-color="outfitColor"></label><label class="hhcp-field"><span>Tóc</span><input type="color" value="${project.puppet.hairColor}" data-hhcp-color="hairColor"></label><p class="hhcp-status" role="status" aria-live="polite" data-hhcp-status></p></section>
        </aside>
      </div>
    </section>`;

    const canvas = root.querySelector("[data-hhcp-canvas]");
    const context = canvas && canvas.getContext ? canvas.getContext("2d") : null;
    const cameraCanvas = documentRef.createElement("canvas");
    cameraCanvas.width = 64;
    cameraCanvas.height = 48;
    const cameraContext = cameraCanvas.getContext && cameraCanvas.getContext("2d", { willReadFrequently: true });

    function status(message, tone) {
      const node = root.querySelector("[data-hhcp-status]");
      if (!node) return;
      node.textContent = cleanText(message, 220);
      node.dataset.tone = tone || "";
    }

    function persist(message) {
      project.meta.updatedAt = nowIso();
      const result = saveProject(project, storage);
      if (message) status(result.saved ? message : result.reason, result.saved ? "ok" : "error");
    }

    function updateControls() {
      root.querySelectorAll("[data-hhcp-view]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.hhcpView === project.puppet.view)));
      root.querySelectorAll("[data-hhcp-pose]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.hhcpPose === project.pose.activeId)));
      const playButton = root.querySelector('[data-hhcp-action="play"]');
      if (playButton) { playButton.textContent = playing ? "Tạm dừng" : "Phát"; playButton.setAttribute("aria-label", playing ? "Tạm dừng chuyển động" : "Phát chuyển động"); }
      const timeInput = root.querySelector("[data-hhcp-time]");
      if (timeInput) { timeInput.max = project.motion.duration; timeInput.value = currentTime; }
      const timeLabel = root.querySelector("[data-hhcp-time-label]");
      if (timeLabel) timeLabel.textContent = `${currentTime.toFixed(2)}s`;
    }

    function updateCameraFrame() {
      if (!cameraSession || !cameraContext) return;
      const video = root.querySelector("[data-hhcp-video]");
      if (!video || video.readyState < 2) return;
      try {
        cameraContext.drawImage(video, 0, 0, cameraCanvas.width, cameraCanvas.height);
        cameraGuide = cameraSession.analyzeFrame(cameraContext.getImageData(0, 0, cameraCanvas.width, cameraCanvas.height), cameraCanvas.width, cameraCanvas.height);
      } catch (_) {
        cameraGuide = null;
      }
    }

    function render() {
      if (!context) { status("Canvas 2D không được hỗ trợ trong trình duyệt này.", "error"); return; }
      drawPuppet(context, project, currentTime, project.puppet.view, { x: 0, y: 0, width: canvas.width, height: canvas.height }, dynamicsState, cameraGuide);
      updateControls();
    }

    function loop(timestamp) {
      if (destroyed) return;
      const delta = lastTimestamp ? Math.min(0.067, (timestamp - lastTimestamp) / 1000) : 1 / 60;
      lastTimestamp = timestamp;
      if (playing) {
        currentTime += delta;
        if (currentTime > project.motion.duration) currentTime = project.motion.loop ? currentTime % project.motion.duration : project.motion.duration;
      }
      updateCameraFrame();
      const frame = motionFrame(project, currentTime);
      if (project.dynamics.enabled && (playing || cameraSession)) dynamicsState = stepDynamics(dynamicsState, dynamicsAnchors(frame.bones), delta);
      render();
      if (playing || cameraSession) animationFrame = scope.requestAnimationFrame(loop);
      else { animationFrame = 0; lastTimestamp = 0; }
    }

    function startLoop() {
      if (!animationFrame && scope.requestAnimationFrame) animationFrame = scope.requestAnimationFrame(loop);
    }

    function stopCamera() {
      if (cameraSession) cameraSession.stop();
      cameraSession = null;
      cameraGuide = null;
      project.camera.enabled = false;
      project.camera.status = "idle";
      const video = root.querySelector("[data-hhcp-video]");
      if (video) { video.srcObject = null; video.dataset.active = "false"; }
      const startButton = root.querySelector('[data-hhcp-action="camera"]');
      const stopButton = root.querySelector('[data-hhcp-action="camera-stop"]');
      if (startButton) startButton.disabled = !capabilities.camera.supported;
      if (stopButton) stopButton.disabled = true;
      const cameraStatus = root.querySelector("[data-hhcp-camera-status]");
      if (cameraStatus) cameraStatus.textContent = "Camera đã dừng. Không phải motion capture.";
      render();
    }

    async function exportSprite() {
      const rendered = renderSpriteSheet(project, { runtime: scope, views: project.export.includeViews, fps: project.export.spriteFps, duration: Math.min(project.motion.duration, 4) });
      if (!rendered.supported) { status(rendered.reason, "error"); return rendered; }
      const blob = await canvasBlob(rendered.canvas, "image/png");
      if (!blob || !downloadBlob(scope, blob, "hh-character-pro-sprites.png")) { status("Trình duyệt không thể tạo tệp sprite PNG.", "error"); return { supported: false, reason: "PNG export unsupported" }; }
      const manifestBlob = new scope.Blob([JSON.stringify(rendered.manifest, null, 2)], { type: "application/json" });
      downloadBlob(scope, manifestBlob, "hh-character-pro-sprites.json");
      status(`Đã xuất ${rendered.manifest.frames.length} frame sprite.`, "ok");
      return rendered;
    }

    async function readJsonFile(file, maxBytes) {
      if (!file || file.size > maxBytes) throw new Error("Tệp JSON quá lớn.");
      const content = typeof file.text === "function" ? await file.text() : await new Promise((resolve, reject) => {
        const reader = new scope.FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("Không thể đọc tệp.")); reader.readAsText(file);
      });
      try { return JSON.parse(content); } catch (_) { throw new Error("JSON không hợp lệ."); }
    }

    async function onClick(event) {
      const button = event.target.closest("button");
      if (!button || !root.contains(button)) return;
      if (button.dataset.hhcpView) {
        project.puppet.view = button.dataset.hhcpView;
        persist("Đã đổi góc nhìn."); render(); return;
      }
      if (button.dataset.hhcpPose) {
        project.skeleton = applyPose(createSkeleton(), button.dataset.hhcpPose, 1);
        project.pose.activeId = button.dataset.hhcpPose;
        dynamicsState = normalizeDynamics(project.dynamics);
        persist("Đã áp dụng pose."); render(); return;
      }
      const action = button.dataset.hhcpAction;
      if (action === "play") { playing = !playing; if (playing) startLoop(); else render(); return; }
      if (action === "import") { root.querySelector("[data-hhcp-project-file]").click(); return; }
      if (action === "timing-import") { root.querySelector("[data-hhcp-timing-file]").click(); return; }
      if (action === "export") {
        if (!scope.Blob) { status("Blob download không được hỗ trợ.", "error"); return; }
        const blob = new scope.Blob([serializeProject(project)], { type: "application/json" });
        const downloaded = downloadBlob(scope, blob, "hh-character-pro-project.json");
        status(downloaded ? "Đã xuất project JSON." : "Không thể tải project trong trình duyệt này.", downloaded ? "ok" : "error"); return;
      }
      if (action === "sprite") { await exportSprite(); return; }
      if (action === "text-viseme") {
        const transcript = root.querySelector("[data-hhcp-transcript]").value;
        const language = root.querySelector("[data-hhcp-language]").value;
        project.lipSync.transcript = cleanText(transcript, 12000);
        project.lipSync.language = normalizeLanguage(language, transcript);
        project.lipSync.markers = textToVisemes(transcript, language);
        project.lipSync.source = "text-rule";
        root.querySelector("[data-hhcp-lip-status]").textContent = `${project.lipSync.markers.length} viseme từ quy tắc cục bộ`;
        persist("Đã tạo lip-sync từ văn bản."); render(); return;
      }
      if (action === "camera") {
        const consent = root.querySelector("[data-hhcp-camera-consent]").checked;
        const cameraStatus = root.querySelector("[data-hhcp-camera-status]");
        try {
          button.disabled = true;
          cameraStatus.textContent = "Đang chờ quyền camera của trình duyệt…";
          cameraSession = await requestCameraTracking({ consent, runtime: scope });
          project.camera.enabled = true; project.camera.status = "ready";
          const video = root.querySelector("[data-hhcp-video]");
          video.srcObject = cameraSession.stream; video.dataset.active = "true";
          root.querySelector('[data-hhcp-action="camera-stop"]').disabled = false;
          cameraStatus.textContent = "Camera guidance đang chạy cục bộ. Không phải motion capture.";
          cameraStatus.dataset.tone = "ok";
          startLoop();
        } catch (error) {
          button.disabled = !capabilities.camera.supported;
          cameraStatus.textContent = cleanText(error.message, 220);
          cameraStatus.dataset.tone = "error";
        }
        return;
      }
      if (action === "camera-stop") stopCamera();
    }

    function onInput(event) {
      const target = event.target;
      if (target.matches("[data-hhcp-time]")) { currentTime = clamp(target.value, 0, project.motion.duration, 0); render(); return; }
      if (target.matches("[data-hhcp-face]")) { project.facialRig.controls[target.dataset.hhcpFace] = clamp(target.value, 0, 1, 0); persist(); render(); return; }
      if (target.matches("[data-hhcp-mix-weight]")) { if (project.motion.layers[0]) project.motion.layers[0].weight = clamp(target.value, 0, 1, 1); persist(); render(); }
    }

    function onChange(event) {
      const target = event.target;
      if (target.matches("[data-hhcp-name]")) { project.meta.name = cleanText(target.value, 120); target.value = project.meta.name; persist("Đã lưu tên project."); return; }
      if (target.matches("[data-hhcp-motion]")) { if (project.motion.layers[0]) project.motion.layers[0].clipId = target.value; currentTime = 0; persist("Đã đổi clip."); render(); return; }
      if (target.matches("[data-hhcp-dynamics]")) { project.dynamics.enabled = target.checked; dynamicsState = normalizeDynamics(project.dynamics); persist("Đã cập nhật dynamics."); render(); return; }
      if (target.matches("[data-hhcp-color]")) { project.puppet[target.dataset.hhcpColor] = normalizeColor(target.value, project.puppet[target.dataset.hhcpColor]); persist(); render(); return; }
      if (target.matches("[data-hhcp-project-file]") && target.files[0]) {
        readJsonFile(target.files[0], 5_000_000).then((value) => { project = value.format === FORMAT ? normalizeProject(value) : upgradeCharacterProject(value); currentTime = 0; dynamicsState = normalizeDynamics(project.dynamics); persist("Đã nhập project."); render(); }).catch((error) => status(error.message, "error")); target.value = ""; return;
      }
      if (target.matches("[data-hhcp-timing-file]") && target.files[0]) {
        readJsonFile(target.files[0], 1_000_000).then((value) => {
          const timing = Array.isArray(value) ? value : value.timings;
          if (!Array.isArray(timing)) throw new Error("Tệp timing cần là mảng hoặc có trường timings.");
          project.lipSync.audioTiming = timing.slice(0, MAX_TIMING_ITEMS);
          project.lipSync.markers = audioTimingToVisemes(timing, project.lipSync.language);
          project.lipSync.source = "provided-audio-timing";
          root.querySelector("[data-hhcp-lip-status]").textContent = `${project.lipSync.markers.length} viseme từ audio timing`;
          persist("Đã nhập audio timing."); render();
        }).catch((error) => status(error.message, "error")); target.value = "";
      }
    }

    function onKeydown(event) {
      if (event.target !== canvas) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const current = PUPPET_VIEWS.findIndex((view) => view.id === project.puppet.view);
        const direction = event.key === "ArrowRight" ? 1 : -1;
        project.puppet.view = PUPPET_VIEWS[(current + direction + PUPPET_VIEWS.length) % PUPPET_VIEWS.length].id;
        persist(); render();
      } else if (event.code === "Space") {
        event.preventDefault(); playing = !playing; if (playing) startLoop(); else render();
      } else if (event.key === "Escape" && cameraSession) stopCamera();
    }

    root.addEventListener("click", onClick);
    root.addEventListener("input", onInput);
    root.addEventListener("change", onChange);
    root.addEventListener("keydown", onKeydown);
    render();

    return {
      getProject: () => normalizeProject(project),
      setProject(next) { project = normalizeProject(next); currentTime = 0; dynamicsState = normalizeDynamics(project.dynamics); persist(); render(); },
      applyPose(poseId, amount) { project.skeleton = applyPose(project.skeleton, poseId, amount); project.pose.activeId = POSE_LIBRARY.some((pose) => pose.id === poseId) ? poseId : "neutral"; persist(); render(); },
      setView(viewId) { if (PUPPET_VIEWS.some((view) => view.id === viewId)) { project.puppet.view = viewId; persist(); render(); } },
      play() { if (!playing) { playing = true; startLoop(); } },
      pause() { playing = false; render(); },
      exportProject: () => serializeProject(project),
      exportSprite,
      stopCamera,
      unmount() {
        destroyed = true;
        playing = false;
        stopCamera();
        if (animationFrame && scope.cancelAnimationFrame) scope.cancelAnimationFrame(animationFrame);
        root.removeEventListener("click", onClick);
        root.removeEventListener("input", onInput);
        root.removeEventListener("change", onChange);
        root.removeEventListener("keydown", onKeydown);
        root.replaceChildren();
        root.classList.remove("hhcp");
        root.removeAttribute("data-graphic-character-pro");
        root.removeAttribute("role");
      }
    };
  }

  const instances = typeof WeakMap !== "undefined" ? new WeakMap() : new Map();

  function mount(target, options) {
    const root = typeof target === "string" && runtime.document ? runtime.document.querySelector(target) : target;
    if (!root || typeof root.querySelector !== "function") return null;
    if (instances.has(root)) return instances.get(root);
    const controller = createController(root, options || {});
    instances.set(root, controller);
    return controller;
  }

  function unmount(target) {
    const root = typeof target === "string" && runtime.document ? runtime.document.querySelector(target) : target;
    const controller = root && instances.get(root);
    if (!controller) return false;
    controller.unmount();
    instances.delete(root);
    return true;
  }

  function mountAll(options) {
    if (!runtime.document) return [];
    return Array.from(runtime.document.querySelectorAll("[data-graphic-character-pro]")).map((root) => mount(root, options)).filter(Boolean);
  }

  return {
    VERSION,
    FORMAT,
    STORAGE_KEY,
    STAGE: { ...STAGE },
    BONE_DEFINITIONS: BONE_DEFINITIONS.map((item) => ({ ...item })),
    PUPPET_VIEWS: PUPPET_VIEWS.map((item) => ({ ...item })),
    FACIAL_CONTROLS: FACIAL_CONTROLS.map((item) => ({ ...item })),
    VISEMES: VISEMES.slice(),
    POSE_LIBRARY: POSE_LIBRARY.map((item) => clone(item)),
    MOTION_LIBRARY: createDefaultMotionClips(),
    BLEND_SHAPES: clone(createDefaultMesh().blendShapes),
    createSkeleton,
    createMeshModel: createDefaultMesh,
    createDefaultMesh,
    normalizeMesh,
    evaluateFacialRig,
    applyBlendShapes,
    deformMesh,
    createDefaultDynamics,
    normalizeDynamics,
    stepDynamics,
    simulateDynamics: stepDynamics,
    applyPose,
    easingValue,
    interpolateValues,
    interpolateKeyframes,
    interpolateMotion: interpolateKeyframes,
    createDefaultMotionClips,
    sampleMotionClip,
    mixMotionClips,
    createMotionMixer,
    wordToVisemes,
    textToVisemes,
    buildTextVisemeTimeline: textToVisemes,
    audioTimingToVisemes,
    buildAudioTimingVisemeTimeline: audioTimingToVisemes,
    sampleViseme,
    projectPuppetView,
    createDefaultProject,
    normalizeProject,
    upgradeCharacterProject,
    serializeProject,
    exportProject: serializeProject,
    parseProject,
    buildSpriteManifest,
    detectCapabilities,
    estimateCameraGuidance,
    requestCameraTracking,
    saveProject,
    loadProject,
    renderSpriteSheet,
    exportSpriteSheet: renderSpriteSheet,
    mount,
    unmount,
    mountAll
  };
}));
