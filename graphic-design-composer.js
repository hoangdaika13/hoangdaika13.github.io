(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const FORMAT = "hh-universal-scene";
  const STORAGE_KEY = "hh.graphic-composer.scene.v1";
  const STYLE_ID = "hh-graphic-composer-styles-v1";
  const MAX_HISTORY = 80;
  const LAYER_TYPES = ["vector", "character", "scene3d", "ui", "audio", "animation"];
  const mounted = new WeakMap();

  function uid(prefix) {
    return `${prefix || "item"}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min, max) {
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : min));
  }

  function safeText(value, fallback, max) {
    return String(value == null ? (fallback || "") : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/<\/?script[^>]*>/gi, "")
      .replace(/[<>]/g, (character) => character === "<" ? "‹" : "›")
      .slice(0, max || 240);
  }

  function safeId(value, fallback) {
    const id = String(value || "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
    return id || fallback || uid("item");
  }

  function safeColor(value, fallback) {
    const text = String(value || "").trim();
    return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|transparent)$/i.test(text) ? text : fallback;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function download(filename, content, type) {
    if (typeof document === "undefined") return false;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type: type || "application/json" }));
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    return true;
  }

  function normalizeTransform(raw) {
    return {
      x: clamp(raw?.x == null ? 80 : raw.x, -10000, 10000),
      y: clamp(raw?.y == null ? 80 : raw.y, -10000, 10000),
      width: clamp(raw?.width == null ? 280 : raw.width, 8, 10000),
      height: clamp(raw?.height == null ? 180 : raw.height, 8, 10000),
      rotation: clamp(raw?.rotation || 0, -36000, 36000),
      opacity: clamp(raw?.opacity == null ? 1 : raw.opacity, 0, 1),
      scaleX: clamp(raw?.scaleX == null ? 1 : raw.scaleX, -100, 100),
      scaleY: clamp(raw?.scaleY == null ? 1 : raw.scaleY, -100, 100)
    };
  }

  function normalizeSource(raw, type) {
    const formats = {
      vector: "hh-vector-motion-project",
      character: "hh-character-rig",
      scene3d: "hh-graphic-design-3d",
      ui: "hh-ui-frame",
      audio: "hh-audio-asset",
      animation: "hh-graphic-state-machine"
    };
    const modules = {
      vector: "HHGraphicVectorCore",
      character: "HHGraphicCharacter",
      scene3d: "HHGraphic3D",
      ui: "HHGraphicAdaptive",
      audio: "WebAudio",
      animation: "HHGraphicStateMachine"
    };
    return {
      module: safeText(raw?.module, modules[type], 80),
      format: safeText(raw?.format, formats[type], 80),
      version: clamp(raw?.version || 1, 1, 999),
      payload: raw?.payload && typeof raw.payload === "object" ? clone(raw.payload) : {},
      assetName: safeText(raw?.assetName, "", 160),
      assetType: safeText(raw?.assetType, "", 120),
      duration: clamp(raw?.duration || 0, 0, 86400),
      waveform: Array.isArray(raw?.waveform) ? raw.waveform.slice(0, 512).map((item) => clamp(item, 0, 1)) : []
    };
  }

  function normalizeLayer(raw, index) {
    const type = LAYER_TYPES.includes(raw?.type) ? raw.type : "vector";
    return {
      id: safeId(raw?.id, `layer-${index + 1}`),
      name: safeText(raw?.name, `${type} ${index + 1}`, 100),
      type,
      parentId: raw?.parentId ? safeId(raw.parentId, "") : null,
      visible: raw?.visible !== false,
      locked: raw?.locked === true,
      blendMode: ["normal", "multiply", "screen", "overlay", "lighten", "darken"].includes(raw?.blendMode) ? raw.blendMode : "normal",
      transform: normalizeTransform(raw?.transform),
      style: {
        fill: safeColor(raw?.style?.fill, type === "character" ? "#ff78cc" : "#62d7e7"),
        stroke: safeColor(raw?.style?.stroke, "#eafaff"),
        strokeWidth: clamp(raw?.style?.strokeWidth == null ? 2 : raw.style.strokeWidth, 0, 100),
        radius: clamp(raw?.style?.radius == null ? 18 : raw.style.radius, 0, 500),
        fontSize: clamp(raw?.style?.fontSize || 28, 8, 500),
        color: safeColor(raw?.style?.color, "#f6f8ff")
      },
      content: safeText(raw?.content, type === "ui" ? "Bắt đầu hành trình" : "", 2000),
      source: normalizeSource(raw?.source, type),
      metadata: raw?.metadata && typeof raw.metadata === "object" ? clone(raw.metadata) : {}
    };
  }

  function normalizeKeyframe(raw, duration, layerIds) {
    const layerId = safeId(raw?.layerId, layerIds[0] || "");
    return {
      id: safeId(raw?.id, uid("key")),
      layerId: layerIds.includes(layerId) ? layerId : (layerIds[0] || ""),
      time: clamp(raw?.time || 0, 0, duration),
      property: ["x", "y", "rotation", "opacity", "scaleX", "scaleY", "width", "height"].includes(raw?.property) ? raw.property : "x",
      value: clamp(raw?.value || 0, -100000, 100000),
      easing: Array.isArray(raw?.easing) ? raw.easing.slice(0, 4).map((item) => clamp(item, -2, 2)) : [0.42, 0, 0.58, 1]
    };
  }

  function normalizeScene(raw) {
    const duration = clamp(raw?.timeline?.duration || 12, 0.1, 3600);
    const layers = (Array.isArray(raw?.layers) ? raw.layers : []).slice(0, 300).map(normalizeLayer);
    const ids = layers.map((layer) => layer.id);
    const uniqueIds = new Set();
    layers.forEach((layer, index) => {
      if (uniqueIds.has(layer.id)) layer.id = `${layer.id}-${index + 1}`;
      uniqueIds.add(layer.id);
    });
    const finalIds = layers.map((layer) => layer.id);
    layers.forEach((layer) => {
      if (!finalIds.includes(layer.parentId) || layer.parentId === layer.id) layer.parentId = null;
    });
    const artboards = (Array.isArray(raw?.artboards) ? raw.artboards : []).slice(0, 24).map((item, index) => ({
      id: safeId(item?.id, `artboard-${index + 1}`),
      name: safeText(item?.name, `Artboard ${index + 1}`, 80),
      width: clamp(item?.width || 1280, 64, 8192),
      height: clamp(item?.height || 720, 64, 8192),
      background: safeColor(item?.background, "#07101f"),
      cameraId: safeId(item?.cameraId, "camera-main")
    }));
    const cameras = (Array.isArray(raw?.cameras) ? raw.cameras : []).slice(0, 24).map((item, index) => ({
      id: safeId(item?.id, `camera-${index + 1}`),
      name: safeText(item?.name, `Camera ${index + 1}`, 80),
      x: clamp(item?.x || 0, -10000, 10000),
      y: clamp(item?.y || 0, -10000, 10000),
      zoom: clamp(item?.zoom == null ? 1 : item.zoom, 0.05, 20),
      rotation: clamp(item?.rotation || 0, -36000, 36000)
    }));
    const stateMachine = raw?.stateMachine && typeof raw.stateMachine === "object" ? raw.stateMachine : {};
    const scene = {
      format: FORMAT,
      version: VERSION,
      meta: {
        name: safeText(raw?.meta?.name, "Anime Orbit Story", 120),
        createdAt: safeText(raw?.meta?.createdAt, new Date().toISOString(), 40),
        updatedAt: new Date().toISOString(),
        description: safeText(raw?.meta?.description, "Universal scene kết hợp 2D, character, 3D, UI và audio.", 500)
      },
      artboards: artboards.length ? artboards : [{ id: "artboard-main", name: "Cảnh chính 16:9", width: 1280, height: 720, background: "#07101f", cameraId: "camera-main" }],
      cameras: cameras.length ? cameras : [{ id: "camera-main", name: "Camera chính", x: 0, y: 0, zoom: 1, rotation: 0 }],
      activeArtboardId: safeId(raw?.activeArtboardId, artboards[0]?.id || "artboard-main"),
      activeCameraId: safeId(raw?.activeCameraId, cameras[0]?.id || "camera-main"),
      layers,
      timeline: {
        duration,
        fps: Math.round(clamp(raw?.timeline?.fps || 30, 1, 120)),
        currentTime: clamp(raw?.timeline?.currentTime || 0, 0, duration),
        loop: raw?.timeline?.loop !== false,
        workArea: {
          start: clamp(raw?.timeline?.workArea?.start || 0, 0, duration),
          end: clamp(raw?.timeline?.workArea?.end == null ? duration : raw.timeline.workArea.end, 0, duration)
        },
        keyframes: (Array.isArray(raw?.timeline?.keyframes) ? raw.timeline.keyframes : []).slice(0, 4000).map((item) => normalizeKeyframe(item, duration, finalIds)),
        markers: (Array.isArray(raw?.timeline?.markers) ? raw.timeline.markers : []).slice(0, 1000).map((item, index) => ({
          id: safeId(item?.id, `marker-${index + 1}`),
          time: clamp(item?.time || 0, 0, duration),
          type: ["marker", "dialogue", "viseme", "event"].includes(item?.type) ? item.type : "marker",
          label: safeText(item?.label, `Marker ${index + 1}`, 160),
          value: safeText(item?.value, "", 240)
        })).sort((a, b) => a.time - b.time)
      },
      stateMachine: {
        initial: safeId(stateMachine.initial, "idle"),
        current: safeId(stateMachine.current, stateMachine.initial || "idle"),
        states: (Array.isArray(stateMachine.states) ? stateMachine.states : []).slice(0, 100).map((item, index) => ({
          id: safeId(item?.id, `state-${index + 1}`),
          name: safeText(item?.name, `State ${index + 1}`, 80)
        })),
        transitions: (Array.isArray(stateMachine.transitions) ? stateMachine.transitions : []).slice(0, 400).map((item, index) => ({
          id: safeId(item?.id, `transition-${index + 1}`),
          from: safeId(item?.from, "idle"),
          to: safeId(item?.to, "idle"),
          event: safeText(item?.event, "click", 80),
          targetId: safeId(item?.targetId, ""),
          conditions: Array.isArray(item?.conditions) ? clone(item.conditions).slice(0, 20) : []
        })),
        bindings: (Array.isArray(stateMachine.bindings) ? stateMachine.bindings : []).slice(0, 400).map((item, index) => ({
          id: safeId(item?.id, `binding-${index + 1}`),
          property: safeText(item?.property, "label", 80),
          layerId: finalIds.includes(item?.layerId) ? item.layerId : (finalIds[0] || ""),
          target: ["content", "fill", "x", "y", "opacity", "state"].includes(item?.target) ? item.target : "content",
          value: typeof item?.value === "number" ? item.value : safeText(item?.value, "", 500)
        })),
        values: stateMachine.values && typeof stateMachine.values === "object" ? clone(stateMachine.values) : {}
      },
      audio: {
        masterVolume: clamp(raw?.audio?.masterVolume == null ? 0.8 : raw.audio.masterVolume, 0, 1),
        muted: raw?.audio?.muted === true
      }
    };
    if (!scene.artboards.some((item) => item.id === scene.activeArtboardId)) scene.activeArtboardId = scene.artboards[0].id;
    if (!scene.cameras.some((item) => item.id === scene.activeCameraId)) scene.activeCameraId = scene.cameras[0].id;
    if (!scene.stateMachine.states.length) scene.stateMachine.states = [{ id: "idle", name: "Idle" }, { id: "talking", name: "Talking" }, { id: "explore", name: "Explore" }];
    if (!scene.stateMachine.states.some((item) => item.id === scene.stateMachine.current)) scene.stateMachine.current = scene.stateMachine.initial;
    return scene;
  }

  function createStarterScene() {
    return normalizeScene({
      meta: { name: "Anime Orbit Story", description: "Nhân vật anime kể chuyện trong scene không gian, có hội thoại và trigger khám phá." },
      artboards: [
        { id: "artboard-main", name: "Cảnh chính 16:9", width: 1280, height: 720, background: "#07101f", cameraId: "camera-main" },
        { id: "artboard-story", name: "Story 9:16", width: 1080, height: 1920, background: "#090719", cameraId: "camera-story" }
      ],
      cameras: [
        { id: "camera-main", name: "Camera chính", x: 0, y: 0, zoom: 1, rotation: 0 },
        { id: "camera-story", name: "Camera dọc", x: 80, y: 0, zoom: 1.15, rotation: 0 }
      ],
      activeArtboardId: "artboard-main",
      activeCameraId: "camera-main",
      layers: [
        {
          id: "space-scene", name: "Nebula Station · 3D", type: "scene3d",
          transform: { x: 0, y: 0, width: 1280, height: 720 }, style: { fill: "#0d1e3b", stroke: "#2f89aa" },
          source: { module: "HHGraphic3D", format: "hh-graphic-design-3d", version: 1, payload: { scene: { name: "Nebula Station", objects: [{ id: "planet", type: "sphere" }, { id: "station", type: "model" }], rendererRequired: "Three.js/WebGL2" } } }
        },
        {
          id: "orbit-vector", name: "Quỹ đạo vector", type: "vector", parentId: "space-scene",
          transform: { x: 190, y: 90, width: 900, height: 500, rotation: -8 }, style: { fill: "transparent", stroke: "#62d7e7", strokeWidth: 4, radius: 500 },
          source: { module: "HHGraphicVectorCore", format: "hh-vector-motion-project", version: 1, payload: { layers: [{ type: "ellipse", name: "Orbit" }], timeline: { duration: 12 } } }
        },
        {
          id: "anime-guide", name: "Airi · Character Rig", type: "character", parentId: "space-scene",
          transform: { x: 120, y: 135, width: 310, height: 470 }, style: { fill: "#ff78cc", stroke: "#ffd9f1", radius: 44 },
          source: { module: "HHGraphicCharacter", format: "hh-character-rig", version: 2, payload: { archetype: "anime", view: "front", expression: "happy", pose: "talk", rig: { joints: 17, bones: 16 }, timeline: { visemes: ["REST", "A", "I", "O"] } } }
        },
        {
          id: "dialogue-card", name: "Hộp thoại", type: "ui", parentId: "anime-guide",
          transform: { x: 430, y: 405, width: 700, height: 128 }, style: { fill: "rgba(7,16,31,.88)", stroke: "#62d7e7", strokeWidth: 2, radius: 24, fontSize: 25, color: "#f8fbff" },
          content: "Airi: Chạm Khám phá để mở cổng không gian."
        },
        {
          id: "explore-button", name: "Nút Khám phá", type: "ui", parentId: "dialogue-card",
          transform: { x: 845, y: 555, width: 285, height: 70 }, style: { fill: "#ff5dbd", stroke: "#ffd8f0", strokeWidth: 2, radius: 18, fontSize: 24, color: "#130718" },
          content: "Khám phá"
        },
        {
          id: "voice-track", name: "Voice Airi", type: "audio", locked: true,
          transform: { x: 0, y: 0, width: 1, height: 1 }, source: { module: "WebAudio", format: "hh-audio-asset", assetName: "airi-dialogue.wav", assetType: "audio/wav", duration: 6.4, waveform: [0.08, .22, .5, .8, .35, .65, .92, .4, .7, .3, .12] }
        },
        {
          id: "interaction-track", name: "Interaction Controller", type: "animation", locked: true,
          transform: { x: 0, y: 0, width: 1, height: 1 }, source: { module: "HHGraphicStateMachine", format: "hh-graphic-state-machine", payload: { initial: "idle", states: ["idle", "talking", "explore"] } }
        }
      ],
      timeline: {
        duration: 12, fps: 30, loop: true, workArea: { start: 0, end: 12 },
        keyframes: [
          { id: "key-airi-in", layerId: "anime-guide", time: 0, property: "x", value: -320 },
          { id: "key-airi-settle", layerId: "anime-guide", time: 1.2, property: "x", value: 120 },
          { id: "key-orbit-a", layerId: "orbit-vector", time: 0, property: "rotation", value: -8 },
          { id: "key-orbit-b", layerId: "orbit-vector", time: 12, property: "rotation", value: 352 },
          { id: "key-button-a", layerId: "explore-button", time: 3.8, property: "scaleX", value: .94 },
          { id: "key-button-b", layerId: "explore-button", time: 4.3, property: "scaleX", value: 1 }
        ],
        markers: [
          { id: "dialogue-1", time: .8, type: "dialogue", label: "Airi chào", value: "Xin chào, mình là Airi." },
          { id: "viseme-a", time: 1.05, type: "viseme", label: "Viseme A", value: "A" },
          { id: "viseme-i", time: 1.34, type: "viseme", label: "Viseme I", value: "I" },
          { id: "viseme-o", time: 1.72, type: "viseme", label: "Viseme O", value: "O" },
          { id: "dialogue-2", time: 2.1, type: "dialogue", label: "Lời mời", value: "Chạm Khám phá để mở cổng không gian." },
          { id: "event-explore", time: 4.2, type: "event", label: "Sẵn sàng trigger", value: "explore" }
        ]
      },
      stateMachine: {
        initial: "idle", current: "idle",
        states: [{ id: "idle", name: "Idle" }, { id: "talking", name: "Talking" }, { id: "explore", name: "Explore" }],
        transitions: [
          { id: "idle-talk", from: "idle", to: "talking", event: "play", targetId: "" },
          { id: "talk-explore", from: "talking", to: "explore", event: "click", targetId: "explore-button" },
          { id: "idle-explore", from: "idle", to: "explore", event: "click", targetId: "explore-button" }
        ],
        bindings: [
          { id: "bind-dialogue", property: "dialogue", layerId: "dialogue-card", target: "content", value: "Cổng không gian đã mở. Chúng ta lên đường!" },
          { id: "bind-button", property: "accent", layerId: "explore-button", target: "fill", value: "#62d7e7" }
        ],
        values: { dialogue: "Airi: Chạm Khám phá để mở cổng không gian.", accent: "#ff5dbd" }
      }
    });
  }

  function interpolate(a, b, amount) {
    return a + (b - a) * clamp(amount, 0, 1);
  }

  function evaluateLayer(scene, layer, time) {
    const result = clone(layer);
    const keys = scene.timeline.keyframes.filter((item) => item.layerId === layer.id).sort((a, b) => a.time - b.time);
    const byProperty = {};
    keys.forEach((key) => { (byProperty[key.property] ||= []).push(key); });
    Object.entries(byProperty).forEach(([property, frames]) => {
      const previous = [...frames].reverse().find((frame) => frame.time <= time) || frames[0];
      const next = frames.find((frame) => frame.time >= time) || frames[frames.length - 1];
      const span = Math.max(.0001, next.time - previous.time);
      result.transform[property] = interpolate(previous.value, next.value, (time - previous.time) / span);
    });
    return result;
  }

  function sceneBounds(scene) {
    const artboard = scene.artboards.find((item) => item.id === scene.activeArtboardId) || scene.artboards[0];
    return { width: artboard.width, height: artboard.height, background: artboard.background };
  }

  function drawRoundedRect(context, x, y, width, height, radius) {
    const r = Math.min(Math.max(0, radius), width / 2, height / 2);
    context.beginPath();
    context.roundRect ? context.roundRect(x, y, width, height, r) : context.rect(x, y, width, height);
  }

  function renderSceneToCanvas(sceneInput, canvas, time, options) {
    const scene = normalizeScene(sceneInput);
    const bounds = sceneBounds(scene);
    const context = canvas.getContext?.("2d");
    if (!context) return false;
    const pixelRatio = options?.pixelRatio || 1;
    canvas.width = Math.max(1, Math.round(bounds.width * pixelRatio));
    canvas.height = Math.max(1, Math.round(bounds.height * pixelRatio));
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.fillStyle = bounds.background;
    context.fillRect(0, 0, bounds.width, bounds.height);
    const byId = new Map(scene.layers.map((layer) => [layer.id, layer]));
    const depths = new Map();
    function depth(layer) {
      if (depths.has(layer.id)) return depths.get(layer.id);
      const value = layer.parentId && byId.has(layer.parentId) ? 1 + depth(byId.get(layer.parentId)) : 0;
      depths.set(layer.id, value);
      return value;
    }
    scene.layers.filter((layer) => layer.visible && !["audio", "animation"].includes(layer.type)).sort((a, b) => depth(a) - depth(b)).forEach((raw) => {
      const layer = evaluateLayer(scene, raw, time || 0);
      const t = layer.transform;
      context.save();
      context.globalAlpha = t.opacity;
      context.globalCompositeOperation = layer.blendMode === "normal" ? "source-over" : layer.blendMode;
      context.translate(t.x + t.width / 2, t.y + t.height / 2);
      context.rotate(t.rotation * Math.PI / 180);
      context.scale(t.scaleX, t.scaleY);
      context.translate(-t.width / 2, -t.height / 2);
      if (layer.type === "scene3d") {
        const gradient = context.createLinearGradient(0, 0, t.width, t.height);
        gradient.addColorStop(0, "#07101f");
        gradient.addColorStop(.55, layer.style.fill);
        gradient.addColorStop(1, "#1d0b2b");
        context.fillStyle = gradient;
        context.fillRect(0, 0, t.width, t.height);
        context.strokeStyle = "rgba(98,215,231,.32)";
        context.lineWidth = 1;
        for (let x = 0; x < t.width; x += 80) { context.beginPath(); context.moveTo(x, t.height); context.lineTo(t.width / 2, t.height * .55); context.stroke(); }
        for (let y = t.height * .55; y < t.height; y += 52) { context.beginPath(); context.moveTo(0, y); context.lineTo(t.width, y); context.stroke(); }
        context.fillStyle = "rgba(234,250,255,.72)";
        context.font = "600 18px system-ui";
        context.fillText("3D payload · xem bằng HH 3D Studio", 28, 42);
      } else if (layer.type === "vector") {
        context.strokeStyle = layer.style.stroke;
        context.lineWidth = layer.style.strokeWidth;
        context.setLineDash([18, 12]);
        context.beginPath();
        context.ellipse(t.width / 2, t.height / 2, Math.max(8, t.width / 2 - 6), Math.max(8, t.height / 2 - 6), 0, 0, Math.PI * 2);
        context.stroke();
      } else if (layer.type === "character") {
        const cx = t.width / 2;
        context.strokeStyle = layer.style.stroke;
        context.lineWidth = Math.max(3, t.width * .02);
        context.fillStyle = layer.style.fill;
        context.beginPath(); context.arc(cx, t.height * .2, t.width * .2, 0, Math.PI * 2); context.fill(); context.stroke();
        drawRoundedRect(context, t.width * .26, t.height * .36, t.width * .48, t.height * .37, t.width * .14); context.fill(); context.stroke();
        context.beginPath(); context.moveTo(t.width * .28, t.height * .43); context.lineTo(t.width * .08, t.height * .64); context.moveTo(t.width * .72, t.height * .43); context.lineTo(t.width * .92, t.height * .6); context.moveTo(t.width * .4, t.height * .72); context.lineTo(t.width * .3, t.height * .98); context.moveTo(t.width * .6, t.height * .72); context.lineTo(t.width * .7, t.height * .98); context.stroke();
        context.fillStyle = "#07101f"; context.beginPath(); context.arc(t.width * .43, t.height * .18, 5, 0, Math.PI * 2); context.arc(t.width * .57, t.height * .18, 5, 0, Math.PI * 2); context.fill();
      } else if (layer.type === "ui") {
        drawRoundedRect(context, 0, 0, t.width, t.height, layer.style.radius);
        context.fillStyle = layer.style.fill; context.fill();
        if (layer.style.strokeWidth) { context.strokeStyle = layer.style.stroke; context.lineWidth = layer.style.strokeWidth; context.stroke(); }
        context.fillStyle = layer.style.color; context.font = `700 ${layer.style.fontSize}px system-ui`; context.textBaseline = "middle";
        const lines = layer.content.match(new RegExp(`.{1,${Math.max(10, Math.floor(t.width / (layer.style.fontSize * .58)))}}(?:\\s|$)`, "g")) || [layer.content];
        lines.slice(0, 4).forEach((line, index) => context.fillText(line.trim(), 24, t.height / 2 + (index - (lines.length - 1) / 2) * layer.style.fontSize * 1.25, t.width - 48));
      }
      context.restore();
    });
    return true;
  }

  function handoffPayload(sceneInput, layerId) {
    const scene = normalizeScene(sceneInput);
    const layer = scene.layers.find((item) => item.id === layerId);
    if (!layer) return null;
    return {
      format: "hh-creative-handoff",
      version: 1,
      targetModule: layer.source.module,
      sourceFormat: layer.source.format,
      sceneFormat: FORMAT,
      sceneId: safeId(scene.meta.name, "scene"),
      layerId: layer.id,
      transform: clone(layer.transform),
      payload: clone(layer.source.payload),
      metadata: { name: layer.name, type: layer.type, exportedAt: new Date().toISOString() }
    };
  }

  function applyBinding(sceneInput, name, value) {
    const scene = normalizeScene(sceneInput);
    scene.stateMachine.values[name] = value;
    scene.stateMachine.bindings.filter((item) => item.property === name).forEach((binding) => {
      const layer = scene.layers.find((item) => item.id === binding.layerId);
      if (!layer) return;
      const actual = value == null ? binding.value : value;
      if (binding.target === "content") layer.content = safeText(actual, layer.content, 2000);
      else if (binding.target === "fill") layer.style.fill = safeColor(actual, layer.style.fill);
      else if (["x", "y", "opacity"].includes(binding.target)) layer.transform[binding.target] = clamp(actual, binding.target === "opacity" ? 0 : -10000, binding.target === "opacity" ? 1 : 10000);
      else if (binding.target === "state") scene.stateMachine.current = safeId(actual, scene.stateMachine.current);
    });
    return scene;
  }

  function dispatchEvent(sceneInput, eventName, targetId) {
    let scene = normalizeScene(sceneInput);
    const transition = scene.stateMachine.transitions.find((item) => item.from === scene.stateMachine.current && item.event === eventName && (!item.targetId || item.targetId === targetId));
    if (!transition) return { scene, changed: false, transition: null };
    scene.stateMachine.current = transition.to;
    if (transition.to === "explore") {
      scene = applyBinding(scene, "dialogue", "Cổng không gian đã mở. Chúng ta lên đường!");
      scene = applyBinding(scene, "accent", "#62d7e7");
    }
    return { scene, changed: true, transition: clone(transition) };
  }

  function exportScene(sceneInput) {
    const scene = normalizeScene(sceneInput);
    return JSON.stringify({ ...scene, exportedAt: new Date().toISOString(), extension: ".hhscene" }, null, 2);
  }

  function safeJsonForScript(value) {
    return JSON.stringify(value).replace(/</g, "\\u003c").replace(/-->/g, "--\\u003e");
  }

  function exportWebComponent(sceneInput) {
    const scene = normalizeScene(sceneInput);
    const payload = safeJsonForScript(scene);
    return `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(scene.meta.name)}</title><style>html,body{margin:0;min-height:100%;background:#07101f;color:#fff;font:16px system-ui}hh-universal-scene{display:block;min-height:100vh}</style><hh-universal-scene></hh-universal-scene><script>const SCENE=${payload};class HHUniversalScene extends HTMLElement{constructor(){super();this.scene=structuredClone(SCENE);this.time=0;this.playing=false;this.raf=0;this.values={...this.scene.stateMachine.values};this.attachShadow({mode:"open"})}connectedCallback(){this.render();this.dispatchEvent(new CustomEvent("hh-scene-ready",{detail:{format:this.scene.format}}))}render(){const a=this.scene.artboards.find(x=>x.id===this.scene.activeArtboardId)||this.scene.artboards[0];const layers=this.scene.layers.filter(x=>x.visible&&!['audio','animation'].includes(x.type));this.shadowRoot.innerHTML='<style>:host{display:grid;place-items:center;min-height:100vh;background:#030712}.stage{position:relative;width:min(96vw,'+a.width+'px);aspect-ratio:'+a.width+'/'+a.height+';overflow:hidden;background:'+a.background+'}.layer{position:absolute;box-sizing:border-box;transform-origin:center;white-space:pre-wrap}.scene3d{display:grid;place-items:center;background:linear-gradient(135deg,#07101f,#153054,#210b2e);color:#9deffc}.character{border-radius:45%;background:#ff78cc;border:2px solid #ffd9f1}.ui{display:grid;align-items:center;padding:18px;border:2px solid #62d7e7;border-radius:18px;background:#0b1728e6}.vector{border:3px dashed #62d7e7;border-radius:50%}</style><div class="stage">'+layers.map(l=>'<div class="layer '+l.type+'" data-id="'+l.id+'" style="left:'+l.transform.x/a.width*100+'%;top:'+l.transform.y/a.height*100+'%;width:'+l.transform.width/a.width*100+'%;height:'+l.transform.height/a.height*100+'%;opacity:'+l.transform.opacity+';transform:rotate('+l.transform.rotation+'deg) scale('+l.transform.scaleX+','+l.transform.scaleY+');color:'+l.style.color+'">'+(l.type==='scene3d'?'3D payload · cần HHGraphic3D':l.content||l.name)+'</div>').join('')+'</div>';this.shadowRoot.querySelectorAll('[data-id]').forEach(el=>el.addEventListener('click',()=>this.trigger('click',el.dataset.id)))}play(){if(this.playing)return;this.playing=true;this.trigger('play','');let last=performance.now();const tick=now=>{if(!this.playing)return;this.time+=(now-last)/1000;last=now;if(this.time>=this.scene.timeline.duration)this.time=this.scene.timeline.loop?0:this.scene.timeline.duration;this.raf=requestAnimationFrame(tick)};this.raf=requestAnimationFrame(tick)}pause(){this.playing=false;cancelAnimationFrame(this.raf)}seek(time){this.time=Math.max(0,Math.min(this.scene.timeline.duration,Number(time)||0));return this.time}trigger(eventName,targetId){const t=this.scene.stateMachine.transitions.find(x=>x.from===this.scene.stateMachine.current&&x.event===eventName&&(!x.targetId||x.targetId===targetId));if(!t)return false;this.scene.stateMachine.current=t.to;this.dispatchEvent(new CustomEvent('hh-scene-state',{detail:{state:t.to,transition:t.id}}));return true}setBinding(name,value){this.values[name]=value;this.scene.stateMachine.bindings.filter(x=>x.property===name).forEach(b=>{const l=this.scene.layers.find(x=>x.id===b.layerId);if(!l)return;if(b.target==='content')l.content=String(value);else if(b.target==='fill')l.style.fill=String(value)});this.render()}getState(){return structuredClone({time:this.time,state:this.scene.stateMachine.current,values:this.values})}getScene(){return structuredClone(this.scene)}}customElements.define('hh-universal-scene',HHUniversalScene);<\/script></html>`;
  }

  function createWaveform(samples, buckets) {
    const values = samples instanceof Float32Array ? samples : Float32Array.from(samples || []);
    const count = Math.max(8, Math.min(512, Math.round(buckets || 96)));
    if (!values.length) return Array(count).fill(0);
    const size = Math.max(1, Math.floor(values.length / count));
    return Array.from({ length: count }, (_, index) => {
      let peak = 0;
      const start = index * size;
      const end = Math.min(values.length, start + size);
      for (let i = start; i < end; i += 1) peak = Math.max(peak, Math.abs(values[i]));
      return Math.round(clamp(peak, 0, 1) * 1000) / 1000;
    });
  }

  function injectStyles() {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .hhc{--c:#67d9e8;--p:#ff64c7;--lime:#c8f36d;--bg:#070b13;--panel:#0e1520;--line:#263647;color:#eef5ff;background:radial-gradient(circle at 16% 0%,#19364b55,transparent 31%),radial-gradient(circle at 88% 10%,#4a123a55,transparent 28%),var(--bg);font:500 13px/1.45 Inter,system-ui,sans-serif;min-height:760px;display:flex;flex-direction:column;border:1px solid #263647;border-radius:8px;overflow:hidden}.hhc *{box-sizing:border-box}.hhc button,.hhc input,.hhc select{font:inherit}.hhc button{color:#dce8f5;background:#111b27;border:1px solid #304255;border-radius:6px;min-height:34px;padding:7px 11px;cursor:pointer}.hhc button:hover,.hhc button:focus-visible{border-color:var(--c);color:#fff;box-shadow:0 0 0 2px #67d9e825}.hhc button.is-active,.hhc .primary{background:linear-gradient(135deg,#213c46,#3c193c);border-color:var(--p)}.hhc-top{display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid var(--line);background:#090f18d9;backdrop-filter:blur(14px)}.hhc-brand{display:flex;align-items:center;gap:9px;margin-right:auto}.hhc-logo{display:grid;place-items:center;width:36px;height:36px;border:1px solid var(--c);border-radius:7px;background:linear-gradient(135deg,#163c49,#46183c);font-weight:900}.hhc-kicker{color:var(--c);font-size:10px;text-transform:uppercase;font-weight:800}.hhc-brand strong{display:block;font-size:14px}.hhc-body{display:grid;grid-template-columns:230px minmax(0,1fr) 268px;min-height:0;flex:1}.hhc-side{min-height:0;background:#091019;border-right:1px solid var(--line);display:flex;flex-direction:column}.hhc-side.right{border-right:0;border-left:1px solid var(--line)}.hhc-section{padding:11px;border-bottom:1px solid #1b2a38}.hhc-section h3{margin:0 0 8px;color:#8fa2b7;font-size:10px;text-transform:uppercase}.hhc-add-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}.hhc-layer-list{overflow:auto;min-height:180px;flex:1;padding:7px}.hhc-layer{display:grid;grid-template-columns:26px 1fr auto;align-items:center;gap:7px;width:100%;text-align:left;margin-bottom:4px;background:#0d1621}.hhc-layer.is-selected{border-color:var(--p);background:#2b1127}.hhc-layer small{color:#71879c;display:block;overflow:hidden;text-overflow:ellipsis}.hhc-type{display:grid;place-items:center;width:24px;height:24px;border-radius:5px;background:#152839;color:var(--c);font-size:9px;font-weight:900}.hhc-main{min-width:0;display:grid;grid-template-rows:auto minmax(340px,1fr) 220px;background:#050a11}.hhc-toolbar{display:flex;gap:7px;padding:8px 10px;border-bottom:1px solid var(--line);overflow:auto}.hhc-stage-wrap{position:relative;display:grid;place-items:center;overflow:hidden;padding:18px;background-color:#080e16;background-image:linear-gradient(#17243455 1px,transparent 1px),linear-gradient(90deg,#17243455 1px,transparent 1px);background-size:24px 24px}.hhc-stage{position:relative;max-width:100%;max-height:100%;box-shadow:0 18px 70px #000a;border:1px solid #3b5266;overflow:hidden;isolation:isolate}.hhc-stage canvas{display:block;width:100%;height:100%}.hhc-hit{position:absolute;border:1px solid transparent;transform-origin:center;touch-action:none}.hhc-hit:hover{border-color:#67d9e888}.hhc-hit.is-selected{border-color:var(--p);box-shadow:0 0 0 1px #ff64c733}.hhc-handle{position:absolute;right:-6px;bottom:-6px;width:12px;height:12px;border:2px solid #08101b;background:var(--c);border-radius:2px}.hhc-rotate{position:absolute;left:50%;top:-22px;width:10px;height:10px;border:2px solid #08101b;background:var(--p);border-radius:50%}.hhc-timeline{border-top:1px solid var(--line);display:grid;grid-template-rows:42px 1fr;min-height:0;background:#0a1018}.hhc-timebar{display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid var(--line)}.hhc-timebar input{flex:1;accent-color:var(--p)}.hhc-tracks{overflow:auto;padding:6px 10px}.hhc-track{display:grid;grid-template-columns:150px 1fr;min-height:31px;border-bottom:1px solid #172433}.hhc-track-name{padding:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hhc-track-rail{position:relative;background:linear-gradient(90deg,#152232 1px,transparent 1px);background-size:10% 100%}.hhc-key{position:absolute;top:10px;width:8px;height:8px;transform:translateX(-50%) rotate(45deg);background:var(--p);border:1px solid #fff}.hhc-marker{position:absolute;top:2px;width:2px;height:24px;background:var(--lime)}.hhc-props{overflow:auto;flex:1}.hhc-field{display:grid;grid-template-columns:74px 1fr;gap:8px;align-items:center;margin-bottom:7px}.hhc-field label{color:#91a4b8}.hhc-field input,.hhc-field select{width:100%;min-height:32px;color:#edf5ff;background:#070d15;border:1px solid #293b4e;border-radius:5px;padding:5px 7px}.hhc-wave{height:72px;display:flex;align-items:center;gap:2px;padding:8px;background:#070d15;border:1px solid #243547;border-radius:6px}.hhc-wave i{display:block;flex:1;min-width:1px;background:linear-gradient(var(--c),var(--p));border-radius:2px}.hhc-status{min-height:32px;padding:8px 12px;border-top:1px solid var(--line);color:#83a0b8;display:flex;justify-content:space-between}.hhc-status strong{color:#74dfb4}.hhc-empty{padding:18px;color:#7f93a8;text-align:center}.hhc-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
      @media(max-width:1100px){.hhc-body{grid-template-columns:200px minmax(0,1fr)}.hhc-side.right{grid-column:1/-1;border-left:0;border-top:1px solid var(--line);display:grid;grid-template-columns:repeat(3,1fr)}.hhc-props{display:contents}}
      @media(max-width:760px){.hhc{min-height:900px}.hhc-top{flex-wrap:wrap}.hhc-brand{width:100%}.hhc-body{display:block;overflow:auto}.hhc-side{max-height:250px}.hhc-main{min-height:630px}.hhc-side.right{display:block;max-height:none}.hhc-toolbar{position:sticky;top:0;z-index:3}.hhc-track{grid-template-columns:105px 1fr}}
      @media(prefers-reduced-motion:reduce){.hhc *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
    `;
    document.head.appendChild(style);
  }

  function mount(root, initialScene) {
    if (!root || typeof root.innerHTML !== "string") throw new TypeError("HHGraphicComposer.mount cần một root element hợp lệ");
    if (mounted.has(root)) return mounted.get(root).api;
    injectStyles();
    let scene = normalizeScene(initialScene || (() => {
      try { return JSON.parse(globalScope.localStorage?.getItem(STORAGE_KEY) || "null"); } catch (_) { return null; }
    })() || createStarterScene());
    let selectedId = scene.layers.find((item) => !["audio", "animation"].includes(item.type))?.id || scene.layers[0]?.id || null;
    let history = [clone(scene)];
    let historyIndex = 0;
    let playing = false;
    let raf = 0;
    let lastFrame = 0;
    let pointer = null;
    let saveTimer = 0;
    let audioUrl = "";
    const listeners = [];

    root.classList.add("hhc");
    root.dataset.graphicComposer = "";
    root.setAttribute("aria-label", "Universal Scene Composer");
    root.innerHTML = `
      <header class="hhc-top">
        <div class="hhc-brand"><span class="hhc-logo">HH</span><div><span class="hhc-kicker">Universal Scene Composer</span><strong data-hhc-scene-name></strong></div></div>
        <button type="button" data-hhc-action="new">Cảnh mẫu</button><button type="button" data-hhc-action="import">Mở .hhscene</button><button type="button" data-hhc-action="save">Lưu</button><button type="button" data-hhc-action="export">Xuất .hhscene</button><button type="button" data-hhc-action="component" class="primary">Web Component</button><button type="button" data-hhc-action="png">PNG</button>
        <input class="hhc-sr" type="file" accept=".hhscene,.json,application/json" data-hhc-file="scene"><input class="hhc-sr" type="file" accept="audio/*" data-hhc-file="audio"><input class="hhc-sr" type="file" accept=".json,application/json" data-hhc-file="handoff">
      </header>
      <div class="hhc-body">
        <aside class="hhc-side">
          <section class="hhc-section"><h3>Thêm layer</h3><div class="hhc-add-grid">${LAYER_TYPES.map((type) => `<button type="button" data-hhc-add="${type}">${({ vector: "Vector", character: "Character", scene3d: "3D Scene", ui: "UI Frame", audio: "Audio", animation: "State" })[type]}</button>`).join("")}</div></section>
          <section class="hhc-section"><h3>Nhập từ HH Studio</h3><button type="button" data-hhc-action="handoff">Nhập handoff JSON</button></section>
          <div class="hhc-layer-list" data-hhc-layers></div>
        </aside>
        <main class="hhc-main">
          <div class="hhc-toolbar"><button type="button" data-hhc-action="undo">Hoàn tác</button><button type="button" data-hhc-action="redo">Làm lại</button><button type="button" data-hhc-action="duplicate">Nhân bản</button><button type="button" data-hhc-action="delete">Xóa</button><button type="button" data-hhc-action="front">Lên trước</button><button type="button" data-hhc-action="back">Xuống sau</button><button type="button" data-hhc-action="handoff-out">Bàn giao module</button><button type="button" data-hhc-action="trigger">Trigger: click</button></div>
          <div class="hhc-stage-wrap"><div class="hhc-stage" data-hhc-stage><canvas data-hhc-canvas aria-label="Canvas tổng hợp scene"></canvas><div data-hhc-hit-layer></div></div></div>
          <div class="hhc-timeline"><div class="hhc-timebar"><button type="button" data-hhc-action="play">Phát</button><button type="button" data-hhc-action="stop">Dừng</button><span data-hhc-time>00:00.00</span><input type="range" min="0" step="0.01" data-hhc-time-range><button type="button" data-hhc-action="key">+ Keyframe</button><button type="button" data-hhc-action="marker">+ Marker</button></div><div class="hhc-tracks" data-hhc-tracks></div></div>
        </main>
        <aside class="hhc-side right">
          <section class="hhc-section"><h3>Artboard & Camera</h3><div class="hhc-field"><label>Artboard</label><select data-hhc-scene-field="activeArtboardId"></select></div><div class="hhc-field"><label>Camera</label><select data-hhc-scene-field="activeCameraId"></select></div><div class="hhc-field"><label>FPS</label><input type="number" min="1" max="120" data-hhc-timeline-field="fps"></div><div class="hhc-field"><label>Thời lượng</label><input type="number" min=".1" max="3600" step=".1" data-hhc-timeline-field="duration"></div></section>
          <div class="hhc-props"><section class="hhc-section"><h3>Thuộc tính layer</h3><div data-hhc-properties></div></section><section class="hhc-section"><h3>Audio waveform cục bộ</h3><button type="button" data-hhc-action="audio">Chọn tệp âm thanh</button><div class="hhc-wave" data-hhc-wave></div><small>Chỉ metadata và waveform được lưu; Blob âm thanh không rời thiết bị.</small></section><section class="hhc-section"><h3>State & Data Binding</h3><div class="hhc-field"><label>State</label><select data-hhc-state></select></div><div data-hhc-bindings></div></section></div>
        </aside>
      </div>
      <footer class="hhc-status"><span data-hhc-status aria-live="polite">Sẵn sàng.</span><span><strong>Local-first</strong> · Canvas 2D · 3D qua HHGraphic3D</span></footer>`;

    const canvas = root.querySelector("[data-hhc-canvas]");
    const stage = root.querySelector("[data-hhc-stage]");
    const status = root.querySelector("[data-hhc-status]");
    const timeRange = root.querySelector("[data-hhc-time-range]");

    function listen(target, event, handler, options) {
      target.addEventListener(event, handler, options);
      listeners.push(() => target.removeEventListener(event, handler, options));
    }

    function announce(message) { status.textContent = message; }
    function activeArtboard() { return scene.artboards.find((item) => item.id === scene.activeArtboardId) || scene.artboards[0]; }
    function selected() { return scene.layers.find((item) => item.id === selectedId) || null; }
    function scheduleSave() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        try { globalScope.localStorage?.setItem(STORAGE_KEY, JSON.stringify(scene)); announce("Đã tự lưu phiên trên thiết bị."); } catch (_) { announce("Không thể tự lưu. Hãy xuất .hhscene."); }
      }, 280);
    }
    function commit(label, mutate) {
      mutate();
      scene = normalizeScene(scene);
      history = history.slice(0, historyIndex + 1);
      history.push(clone(scene));
      if (history.length > MAX_HISTORY) history.shift(); else historyIndex += 1;
      scheduleSave(); render(); announce(label);
    }
    function restore(index) {
      if (index < 0 || index >= history.length) return;
      historyIndex = index; scene = clone(history[index]); selectedId = scene.layers.some((item) => item.id === selectedId) ? selectedId : scene.layers[0]?.id; render(); scheduleSave();
    }
    function formatTime(time) { const minutes = Math.floor(time / 60).toString().padStart(2, "0"); return `${minutes}:${(time % 60).toFixed(2).padStart(5, "0")}`; }

    function addLayer(type) {
      if (type === "audio") { root.querySelector('[data-hhc-file="audio"]').click(); return; }
      const count = scene.layers.filter((item) => item.type === type).length + 1;
      commit(`Đã thêm ${type}`, () => {
        const layer = normalizeLayer({ id: uid(type), name: `${type} ${count}`, type, transform: { x: 110 + count * 18, y: 90 + count * 18, width: type === "scene3d" ? 680 : 300, height: type === "character" ? 420 : 190 }, content: type === "ui" ? "UI frame mới" : "" }, scene.layers.length);
        scene.layers.push(layer); selectedId = layer.id;
      });
    }

    function renderProperties() {
      const layer = selected();
      const host = root.querySelector("[data-hhc-properties]");
      if (!layer) { host.innerHTML = '<div class="hhc-empty">Chọn một layer trên canvas hoặc scene graph.</div>'; return; }
      host.innerHTML = `
        <div class="hhc-field"><label>Tên</label><input value="${escapeHtml(layer.name)}" data-hhc-layer-field="name"></div>
        ${["x", "y", "width", "height", "rotation", "opacity"].map((key) => `<div class="hhc-field"><label>${key}</label><input type="number" step="${key === "opacity" ? ".05" : "1"}" value="${layer.transform[key]}" data-hhc-transform-field="${key}"></div>`).join("")}
        <div class="hhc-field"><label>Blend</label><select data-hhc-layer-field="blendMode">${["normal", "multiply", "screen", "overlay", "lighten", "darken"].map((item) => `<option${item === layer.blendMode ? " selected" : ""}>${item}</option>`).join("")}</select></div>
        ${layer.type === "ui" ? `<div class="hhc-field"><label>Nội dung</label><input value="${escapeHtml(layer.content)}" data-hhc-layer-field="content"></div><div class="hhc-field"><label>Màu nền</label><input type="color" value="${/^#[0-9a-f]{6}$/i.test(layer.style.fill) ? layer.style.fill : "#0b1728"}" data-hhc-style-field="fill"></div>` : ""}
        <div class="hhc-field"><label>Module</label><input value="${escapeHtml(layer.source.module)}" readonly></div><div class="hhc-field"><label>Format</label><input value="${escapeHtml(layer.source.format)}" readonly></div>`;
    }

    function render() {
      const board = activeArtboard();
      root.querySelector("[data-hhc-scene-name]").textContent = scene.meta.name;
      const availableWidth = Math.max(280, stage.parentElement.clientWidth - 36);
      const availableHeight = Math.max(220, stage.parentElement.clientHeight - 36);
      const scale = Math.min(availableWidth / board.width, availableHeight / board.height, 1);
      stage.style.width = `${board.width * scale}px`; stage.style.height = `${board.height * scale}px`; stage.style.background = board.background;
      renderSceneToCanvas(scene, canvas, scene.timeline.currentTime, { pixelRatio: 1 });
      const hitHost = root.querySelector("[data-hhc-hit-layer]");
      hitHost.innerHTML = scene.layers.filter((item) => item.visible && !item.locked && !["audio", "animation"].includes(item.type)).map((item) => {
        const layer = evaluateLayer(scene, item, scene.timeline.currentTime); const t = layer.transform;
        const selectedClass = item.id === selectedId ? " is-selected" : "";
        return `<div class="hhc-hit${selectedClass}" data-hhc-hit="${item.id}" style="left:${t.x / board.width * 100}%;top:${t.y / board.height * 100}%;width:${t.width / board.width * 100}%;height:${t.height / board.height * 100}%;transform:rotate(${t.rotation}deg) scale(${t.scaleX},${t.scaleY})"><span class="hhc-rotate" data-hhc-handle="rotate"></span><span class="hhc-handle" data-hhc-handle="resize"></span></div>`;
      }).join("");
      root.querySelector("[data-hhc-layers]").innerHTML = scene.layers.map((item) => {
        const selectedClass = item.id === selectedId ? " is-selected" : "";
        return `<button type="button" class="hhc-layer${selectedClass}" data-hhc-select="${item.id}"><span class="hhc-type">${item.type.slice(0, 3).toUpperCase()}</span><span>${escapeHtml(item.name)}<small>${escapeHtml(item.source.module)}</small></span><span>${item.locked ? "L" : item.visible ? "V" : "H"}</span></button>`;
      }).join("");
      const trackHost = root.querySelector("[data-hhc-tracks]");
      trackHost.innerHTML = scene.layers.map((layer) => `<div class="hhc-track"><div class="hhc-track-name">${escapeHtml(layer.name)}</div><div class="hhc-track-rail">${scene.timeline.keyframes.filter((key) => key.layerId === layer.id).map((key) => `<i class="hhc-key" title="${escapeHtml(key.property)} · ${key.time}s" style="left:${key.time / scene.timeline.duration * 100}%"></i>`).join("")}${scene.timeline.markers.map((marker) => `<i class="hhc-marker" title="${escapeHtml(marker.type)} · ${escapeHtml(marker.label)}" style="left:${marker.time / scene.timeline.duration * 100}%"></i>`).join("")}</div></div>`).join("");
      timeRange.max = scene.timeline.duration; timeRange.value = scene.timeline.currentTime; root.querySelector("[data-hhc-time]").textContent = formatTime(scene.timeline.currentTime);
      root.querySelector('[data-hhc-action="play"]').textContent = playing ? "Tạm dừng" : "Phát";
      const artboardSelect = root.querySelector('[data-hhc-scene-field="activeArtboardId"]'); artboardSelect.innerHTML = scene.artboards.map((item) => `<option value="${item.id}"${item.id === scene.activeArtboardId ? " selected" : ""}>${escapeHtml(item.name)} · ${item.width}×${item.height}</option>`).join("");
      const cameraSelect = root.querySelector('[data-hhc-scene-field="activeCameraId"]'); cameraSelect.innerHTML = scene.cameras.map((item) => `<option value="${item.id}"${item.id === scene.activeCameraId ? " selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
      root.querySelector('[data-hhc-timeline-field="fps"]').value = scene.timeline.fps; root.querySelector('[data-hhc-timeline-field="duration"]').value = scene.timeline.duration;
      const stateSelect = root.querySelector("[data-hhc-state]"); stateSelect.innerHTML = scene.stateMachine.states.map((item) => `<option value="${item.id}"${item.id === scene.stateMachine.current ? " selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
      root.querySelector("[data-hhc-bindings]").innerHTML = scene.stateMachine.bindings.map((item) => `<div class="hhc-field"><label>${escapeHtml(item.property)}</label><input value="${escapeHtml(scene.stateMachine.values[item.property] ?? item.value)}" data-hhc-binding="${escapeHtml(item.property)}"></div>`).join("");
      const audio = scene.layers.find((item) => item.type === "audio"); root.querySelector("[data-hhc-wave]").innerHTML = (audio?.source.waveform || []).map((value) => `<i style="height:${Math.max(4, value * 100)}%"></i>`).join("") || "<span>Chưa có waveform.</span>";
      renderProperties();
    }

    function playPause() {
      playing = !playing;
      if (playing) {
        const result = dispatchEvent(scene, "play", ""); scene = result.scene; lastFrame = performance.now();
        const tick = (now) => { if (!playing) return; scene.timeline.currentTime += (now - lastFrame) / 1000; lastFrame = now; if (scene.timeline.currentTime >= scene.timeline.duration) { if (scene.timeline.loop) scene.timeline.currentTime = 0; else { scene.timeline.currentTime = scene.timeline.duration; playing = false; } } render(); raf = globalScope.requestAnimationFrame?.(tick) || 0; };
        raf = globalScope.requestAnimationFrame?.(tick) || 0;
      } else globalScope.cancelAnimationFrame?.(raf);
      render();
    }

    function setScene(next) { scene = normalizeScene(next); selectedId = scene.layers[0]?.id || null; history = [clone(scene)]; historyIndex = 0; scheduleSave(); render(); }
    function exportPng() {
      const output = document.createElement("canvas"); renderSceneToCanvas(scene, output, scene.timeline.currentTime, { pixelRatio: 1 });
      output.toBlob((blob) => { if (!blob) return announce("Trình duyệt không thể tạo PNG."); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${safeId(scene.meta.name, "scene")}.png`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); announce("Đã xuất PNG snapshot từ Canvas 2D."); }, "image/png");
    }

    async function loadAudio(file) {
      if (!file) return;
      try {
        const buffer = await file.arrayBuffer();
        const AudioContextCtor = globalScope.AudioContext || globalScope.webkitAudioContext;
        let waveform = [];
        let duration = 0;
        if (AudioContextCtor) {
          const context = new AudioContextCtor(); const decoded = await context.decodeAudioData(buffer.slice(0)); duration = decoded.duration; waveform = createWaveform(decoded.getChannelData(0), 96); await context.close();
        }
        if (audioUrl) URL.revokeObjectURL(audioUrl); audioUrl = URL.createObjectURL(file);
        commit("Đã phân tích waveform cục bộ", () => {
          let layer = scene.layers.find((item) => item.type === "audio");
          if (!layer) { layer = normalizeLayer({ id: uid("audio"), type: "audio", name: file.name, locked: true }, scene.layers.length); scene.layers.push(layer); }
          layer.name = file.name; layer.source.assetName = file.name; layer.source.assetType = file.type; layer.source.duration = duration; layer.source.waveform = waveform;
        });
      } catch (_) { announce("Không đọc được tệp âm thanh trên thiết bị này."); }
    }

    listen(root, "click", (event) => {
      const target = event.target.closest("[data-hhc-action],[data-hhc-add],[data-hhc-select]"); if (!target) return;
      if (target.dataset.hhcAdd) return addLayer(target.dataset.hhcAdd);
      if (target.dataset.hhcSelect) { selectedId = target.dataset.hhcSelect; render(); return; }
      const action = target.dataset.hhcAction;
      if (action === "new") setScene(createStarterScene());
      else if (action === "import") root.querySelector('[data-hhc-file="scene"]').click();
      else if (action === "save") { try { globalScope.localStorage?.setItem(STORAGE_KEY, JSON.stringify(scene)); announce("Đã lưu trên thiết bị."); } catch (_) { announce("Không thể lưu trên thiết bị."); } }
      else if (action === "export") download(`${safeId(scene.meta.name, "scene")}.hhscene`, exportScene(scene));
      else if (action === "component") download(`${safeId(scene.meta.name, "scene")}-component.html`, exportWebComponent(scene), "text/html");
      else if (action === "png") exportPng();
      else if (action === "handoff") root.querySelector('[data-hhc-file="handoff"]').click();
      else if (action === "handoff-out") { const payload = handoffPayload(scene, selectedId); if (payload) download(`${safeId(payload.metadata.name, "layer")}-handoff.json`, JSON.stringify(payload, null, 2)); }
      else if (action === "audio") root.querySelector('[data-hhc-file="audio"]').click();
      else if (action === "undo") restore(historyIndex - 1);
      else if (action === "redo") restore(historyIndex + 1);
      else if (action === "play") playPause();
      else if (action === "stop") { playing = false; globalScope.cancelAnimationFrame?.(raf); scene.timeline.currentTime = 0; render(); }
      else if (action === "duplicate" && selected()) commit("Đã nhân bản layer", () => { const copy = clone(selected()); copy.id = uid(copy.type); copy.name += " copy"; copy.transform.x += 24; copy.transform.y += 24; scene.layers.push(copy); selectedId = copy.id; });
      else if (action === "delete" && selected()) commit("Đã xóa layer", () => { scene.layers = scene.layers.filter((item) => item.id !== selectedId); scene.timeline.keyframes = scene.timeline.keyframes.filter((item) => item.layerId !== selectedId); selectedId = scene.layers[0]?.id || null; });
      else if (action === "front" && selected()) commit("Đã đưa layer lên trước", () => { const index = scene.layers.findIndex((item) => item.id === selectedId); const [item] = scene.layers.splice(index, 1); scene.layers.push(item); });
      else if (action === "back" && selected()) commit("Đã đưa layer xuống sau", () => { const index = scene.layers.findIndex((item) => item.id === selectedId); const [item] = scene.layers.splice(index, 1); scene.layers.unshift(item); });
      else if (action === "key" && selected()) commit("Đã thêm keyframe", () => scene.timeline.keyframes.push({ id: uid("key"), layerId: selectedId, time: scene.timeline.currentTime, property: "x", value: selected().transform.x, easing: [.42, 0, .58, 1] }));
      else if (action === "marker") commit("Đã thêm marker", () => scene.timeline.markers.push({ id: uid("marker"), time: scene.timeline.currentTime, type: "marker", label: `Marker ${scene.timeline.markers.length + 1}`, value: "" }));
      else if (action === "trigger") { const result = dispatchEvent(scene, "click", selectedId || "explore-button"); scene = result.scene; if (result.changed) { history.push(clone(scene)); historyIndex = history.length - 1; scheduleSave(); announce(`State → ${scene.stateMachine.current}`); } else announce("Không có transition phù hợp với layer đang chọn."); render(); }
    });

    listen(root, "input", (event) => {
      const target = event.target; const layer = selected();
      if (target.dataset.hhcTransformField && layer) { const key = target.dataset.hhcTransformField; layer.transform[key] = Number(target.value); scene = normalizeScene(scene); scheduleSave(); render(); }
      else if (target.dataset.hhcLayerField && layer) { layer[target.dataset.hhcLayerField] = target.value; scheduleSave(); render(); }
      else if (target.dataset.hhcStyleField && layer) { layer.style[target.dataset.hhcStyleField] = target.value; scheduleSave(); render(); }
      else if (target.dataset.hhcSceneField) { scene[target.dataset.hhcSceneField] = target.value; scheduleSave(); render(); }
      else if (target.dataset.hhcTimelineField) { scene.timeline[target.dataset.hhcTimelineField] = Number(target.value); scene = normalizeScene(scene); scheduleSave(); render(); }
      else if (target.matches("[data-hhc-time-range]")) { scene.timeline.currentTime = Number(target.value); render(); }
      else if (target.matches("[data-hhc-state]")) { scene.stateMachine.current = target.value; scheduleSave(); render(); }
      else if (target.dataset.hhcBinding) { scene = applyBinding(scene, target.dataset.hhcBinding, target.value); scheduleSave(); render(); }
    });

    listen(root.querySelector('[data-hhc-file="scene"]'), "change", (event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { setScene(JSON.parse(String(reader.result || "{}"))); announce(`Đã mở ${file.name}.`); } catch (_) { announce("File .hhscene không hợp lệ."); } }; reader.readAsText(file); event.target.value = ""; });
    listen(root.querySelector('[data-hhc-file="handoff"]'), "change", (event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const data = JSON.parse(String(reader.result || "{}")); const type = ({ HHGraphicVectorCore: "vector", HHGraphicCharacter: "character", HHGraphic3D: "scene3d", HHGraphicStateMachine: "animation", HHGraphicAdaptive: "ui" })[data.targetModule || data.module] || "vector"; commit("Đã nhập handoff", () => { const layer = normalizeLayer({ id: uid(type), name: data.metadata?.name || file.name, type, transform: data.transform, source: { module: data.targetModule || data.module, format: data.sourceFormat || data.format, version: data.version, payload: data.payload || data.project || data.scene || data } }, scene.layers.length); scene.layers.push(layer); selectedId = layer.id; }); } catch (_) { announce("Handoff JSON không hợp lệ."); } }; reader.readAsText(file); event.target.value = ""; });
    listen(root.querySelector('[data-hhc-file="audio"]'), "change", (event) => { loadAudio(event.target.files?.[0]); event.target.value = ""; });

    listen(stage, "pointerdown", (event) => {
      const hit = event.target.closest("[data-hhc-hit]"); if (!hit) return;
      selectedId = hit.dataset.hhcHit; const layer = selected(); if (!layer || layer.locked) return;
      const board = activeArtboard(); const rect = stage.getBoundingClientRect(); const mode = event.target.dataset.hhcHandle || "move";
      pointer = { mode, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, rect, board, before: clone(layer.transform), centerX: rect.left + (layer.transform.x + layer.transform.width / 2) / board.width * rect.width, centerY: rect.top + (layer.transform.y + layer.transform.height / 2) / board.height * rect.height };
      hit.setPointerCapture?.(event.pointerId); render();
    });
    listen(stage, "pointermove", (event) => {
      if (!pointer) return; const layer = selected(); if (!layer) return;
      const dx = (event.clientX - pointer.startX) / pointer.rect.width * pointer.board.width; const dy = (event.clientY - pointer.startY) / pointer.rect.height * pointer.board.height;
      if (pointer.mode === "move") { layer.transform.x = pointer.before.x + dx; layer.transform.y = pointer.before.y + dy; }
      else if (pointer.mode === "resize") { layer.transform.width = Math.max(8, pointer.before.width + dx); layer.transform.height = Math.max(8, pointer.before.height + dy); }
      else { layer.transform.rotation = Math.atan2(event.clientY - pointer.centerY, event.clientX - pointer.centerX) * 180 / Math.PI + 90; }
      render();
    });
    listen(stage, "pointerup", () => { if (!pointer) return; pointer = null; scene = normalizeScene(scene); history = history.slice(0, historyIndex + 1); history.push(clone(scene)); historyIndex += 1; scheduleSave(); announce("Đã cập nhật transform trên canvas."); });
    listen(root, "keydown", (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); restore(event.shiftKey ? historyIndex + 1 : historyIndex - 1); } if (event.key === "Delete" && selected() && !selected().locked) { event.preventDefault(); commit("Đã xóa layer", () => { scene.layers = scene.layers.filter((item) => item.id !== selectedId); selectedId = scene.layers[0]?.id || null; }); } if (event.code === "Space" && !/input|textarea|select/i.test(event.target.tagName)) { event.preventDefault(); playPause(); } });

    let resizeObserver = null;
    if (typeof ResizeObserver !== "undefined") { resizeObserver = new ResizeObserver(() => render()); resizeObserver.observe(stage.parentElement); }
    render();

    const api = {
      getScene: () => clone(scene), setScene, selectLayer: (id) => { if (scene.layers.some((item) => item.id === id)) { selectedId = id; render(); return true; } return false; },
      addLayer, play: () => { if (!playing) playPause(); }, pause: () => { if (playing) playPause(); }, seek: (time) => { scene.timeline.currentTime = clamp(time, 0, scene.timeline.duration); render(); },
      trigger: (eventName, targetId) => { const result = dispatchEvent(scene, eventName, targetId); scene = result.scene; render(); return result; }, setBinding: (name, value) => { scene = applyBinding(scene, name, value); render(); },
      undo: () => restore(historyIndex - 1), redo: () => restore(historyIndex + 1), exportScene: () => exportScene(scene), exportWebComponent: () => exportWebComponent(scene), handoff: (layerId) => handoffPayload(scene, layerId), renderPng: () => exportPng(), unmount: () => unmount(root)
    };
    mounted.set(root, { api, cleanup() { playing = false; globalScope.cancelAnimationFrame?.(raf); clearTimeout(saveTimer); if (audioUrl) URL.revokeObjectURL(audioUrl); resizeObserver?.disconnect(); listeners.splice(0).forEach((off) => off()); } });
    return api;
  }

  function unmount(root) {
    const state = mounted.get(root); if (!state) return false;
    state.cleanup(); mounted.delete(root); root.classList.remove("hhc"); root.removeAttribute("data-graphic-composer"); root.removeAttribute("aria-label"); root.innerHTML = ""; return true;
  }

  const api = { VERSION, FORMAT, STORAGE_KEY, LAYER_TYPES, createStarterScene, normalizeScene, normalizeLayer, evaluateLayer, renderSceneToCanvas, createWaveform, handoffPayload, applyBinding, dispatchEvent, exportScene, exportWebComponent, mount, unmount };
  globalScope.HHGraphicComposer = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
