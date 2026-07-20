(function (global) {
  "use strict";

  const VERSION = 1;
  const STORAGE_KEY = "hh.graphic-motion.project.v1";
  const STYLE_ID = "hh-graphic-motion-styles-v1";
  const MAX_HISTORY = 40;
  const DEFAULT_STAGE = { width: 960, height: 540, background: "#101726" };
  const MOTION_PRESETS = [
    { id: "float", label: "Trôi nhẹ", description: "Di chuyển lên xuống mềm mại", icon: "↕" },
    { id: "slide-up", label: "Trượt lên", description: "Xuất hiện từ dưới lên", icon: "↑" },
    { id: "pop", label: "Bật nảy", description: "Scale và nảy vào khung", icon: "✦" },
    { id: "pulse", label: "Nhịp sáng", description: "Phóng nhẹ theo vòng lặp", icon: "◌" },
    { id: "typewriter", label: "Gõ chữ", description: "Hiển thị chữ theo từng ký tự", icon: "T" },
    { id: "orbit", label: "Quỹ đạo", description: "Xoay quanh tâm sân khấu", icon: "◎" }
  ];
  const TRIGGER_TYPES = [
    { id: "click", label: "Khi bấm" },
    { id: "hover", label: "Khi di chuột" },
    { id: "drag", label: "Khi kéo thả" },
    { id: "data", label: "Khi dữ liệu đổi" }
  ];

  const hasDocument = typeof document !== "undefined";
  const hasWindow = typeof window !== "undefined";

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : min));
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function safeJsonParse(value, fallback) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
    const secs = Math.floor(safe % 60).toString().padStart(2, "0");
    const frames = Math.floor((safe % 1) * 30).toString().padStart(2, "0");
    return `${minutes}:${secs}:${frames}`;
  }

  function createKeyframe(time, values, easing) {
    return { id: uid("key"), time: clamp(time, 0, 3600), easing: easing || "ease-out", values: { ...values } };
  }

  function createLayer(type, overrides) {
    const base = type === "text" || type === "logo"
      ? { text: type === "logo" ? "HH" : "Tiêu đề mới", fontSize: type === "logo" ? 72 : 48, fontWeight: 800, color: "#ffffff" }
      : type === "puppet"
        ? { puppetName: "Nhân vật HH", expression: "neutral", layers: ["head", "body", "eyes", "mouth"] }
        : { text: "Hình ảnh / Shape", color: "#63e6be", radius: 22 };
    return {
      id: uid("layer"),
      type: type || "shape",
      name: type === "text" ? "Tiêu đề" : type === "logo" ? "Logo HH" : type === "puppet" ? "Puppet" : "Shape",
      visible: true,
      locked: false,
      x: 480,
      y: 270,
      width: type === "text" || type === "logo" ? 360 : 220,
      height: type === "text" || type === "logo" ? 90 : 150,
      rotation: 0,
      opacity: 1,
      ...base,
      ...(overrides || {}),
      keyframes: Array.isArray(overrides?.keyframes) ? overrides.keyframes : [createKeyframe(0, { x: 480, y: 270, opacity: 1, scale: 1, rotation: 0 })]
    };
  }

  function createDefaultProject() {
    const title = createLayer("text", { name: "Tiêu đề mở đầu", text: "HH Motion Studio", x: 480, y: 210, width: 620, height: 100, fontSize: 58, color: "#f8fafc" });
    const logo = createLayer("logo", { name: "Logo HH", x: 160, y: 150, width: 110, height: 110, fontSize: 52, color: "#0f172a" });
    return normalizeProject({
      version: VERSION,
      meta: { name: "Dự án Motion mới", author: "HH Platform", createdAt: nowIso(), updatedAt: nowIso() },
      stage: { ...DEFAULT_STAGE },
      settings: { fps: 30, duration: 8, loop: true, reducedMotion: false, exportFormat: "json", quality: "high" },
      layers: [title, logo],
      tracks: [
        { id: uid("track"), name: "Tiêu đề", layerId: title.id, muted: false, locked: false },
        { id: uid("track"), name: "Logo", layerId: logo.id, muted: false, locked: false }
      ],
      triggers: [{ id: uid("trigger"), type: "click", targetId: title.id, action: "pulse", label: "Bật nhịp tiêu đề" }],
      lipSync: [{ id: uid("lip"), time: 0.4, phoneme: "A", layerId: logo.id }],
      selectedLayerId: title.id,
      selectedKeyframeId: title.keyframes[0].id,
      selectedTrackId: null
    });
  }

  function normalizeKeyframe(raw) {
    const values = raw && raw.values && typeof raw.values === "object" ? raw.values : {};
    return {
      id: String(raw?.id || uid("key")),
      time: clamp(raw?.time, 0, 3600),
      easing: String(raw?.easing || "ease-out"),
      values: {
        x: clamp(values.x, -5000, 5000),
        y: clamp(values.y, -5000, 5000),
        opacity: clamp(values.opacity == null ? 1 : values.opacity, 0, 1),
        scale: clamp(values.scale == null ? 1 : values.scale, 0.05, 10),
        rotation: clamp(values.rotation || 0, -3600, 3600)
      }
    };
  }

  function normalizeLayer(raw) {
    const layer = createLayer(raw?.type || "shape", raw);
    layer.id = String(raw?.id || layer.id);
    layer.name = String(raw?.name || layer.name).slice(0, 100);
    layer.type = ["shape", "text", "logo", "puppet"].includes(raw?.type) ? raw.type : layer.type;
    layer.visible = raw?.visible !== false;
    layer.locked = raw?.locked === true;
    layer.x = clamp(raw?.x, -5000, 5000);
    layer.y = clamp(raw?.y, -5000, 5000);
    layer.width = clamp(raw?.width, 12, 5000);
    layer.height = clamp(raw?.height, 12, 5000);
    layer.rotation = clamp(raw?.rotation || 0, -3600, 3600);
    layer.opacity = clamp(raw?.opacity == null ? 1 : raw.opacity, 0, 1);
    layer.keyframes = (Array.isArray(raw?.keyframes) && raw.keyframes.length ? raw.keyframes : layer.keyframes).map(normalizeKeyframe).sort((a, b) => a.time - b.time);
    if (layer.type === "puppet") layer.layers = Array.isArray(raw?.layers) ? raw.layers.map((item) => String(item).slice(0, 40)).slice(0, 30) : ["head", "body", "eyes", "mouth"];
    return layer;
  }

  function normalizeProject(raw) {
    const fallback = { version: VERSION, meta: {}, stage: DEFAULT_STAGE, settings: {}, layers: [], tracks: [], triggers: [], lipSync: [] };
    const source = raw && typeof raw === "object" ? raw : fallback;
    const layers = (Array.isArray(source.layers) ? source.layers : []).map(normalizeLayer).slice(0, 80);
    const layerIds = new Set(layers.map((layer) => layer.id));
    const fallbackProject = layers.length ? null : createDefaultProject();
    if (!layers.length && fallbackProject) return fallbackProject;
    const tracks = (Array.isArray(source.tracks) ? source.tracks : layers.map((layer) => ({ id: uid("track"), name: layer.name, layerId: layer.id })))
      .filter((track) => layerIds.has(track.layerId)).map((track) => ({ id: String(track.id || uid("track")), name: String(track.name || "Track").slice(0, 80), layerId: String(track.layerId), muted: track.muted === true, locked: track.locked === true }));
    const validSelected = layerIds.has(source.selectedLayerId) ? String(source.selectedLayerId) : layers[0].id;
    const triggerTypes = new Set(TRIGGER_TYPES.map((item) => item.id));
    const triggers = (Array.isArray(source.triggers) ? source.triggers : []).filter((trigger) => layerIds.has(trigger.targetId) && triggerTypes.has(trigger.type)).slice(0, 100).map((trigger) => ({ id: String(trigger.id || uid("trigger")), type: trigger.type, targetId: String(trigger.targetId), action: String(trigger.action || "pulse").slice(0, 40), label: String(trigger.label || "Tương tác").slice(0, 80) }));
    const lipSync = (Array.isArray(source.lipSync) ? source.lipSync : []).filter((marker) => layerIds.has(marker.layerId)).slice(0, 200).map((marker) => ({ id: String(marker.id || uid("lip")), time: clamp(marker.time, 0, 3600), phoneme: String(marker.phoneme || "A").slice(0, 12), layerId: String(marker.layerId) }));
    return {
      version: VERSION,
      meta: { name: String(source.meta?.name || "Dự án Motion mới").slice(0, 120), author: String(source.meta?.author || "HH Platform").slice(0, 120), createdAt: source.meta?.createdAt || nowIso(), updatedAt: nowIso() },
      stage: { width: clamp(source.stage?.width || DEFAULT_STAGE.width, 160, 4096), height: clamp(source.stage?.height || DEFAULT_STAGE.height, 90, 4096), background: /^#[0-9a-f]{6}$/i.test(source.stage?.background || "") ? source.stage.background : DEFAULT_STAGE.background },
      settings: { fps: [24, 25, 30, 50, 60].includes(Number(source.settings?.fps)) ? Number(source.settings.fps) : 30, duration: clamp(source.settings?.duration || 8, 0.5, 3600), loop: source.settings?.loop !== false, reducedMotion: source.settings?.reducedMotion === true, exportFormat: ["json", "gif", "webm", "video"].includes(source.settings?.exportFormat) ? source.settings.exportFormat : "json", quality: ["draft", "high", "lossless"].includes(source.settings?.quality) ? source.settings.quality : "high" },
      layers,
      tracks,
      triggers,
      lipSync,
      selectedLayerId: validSelected,
      selectedKeyframeId: String(source.selectedKeyframeId || layers[0].keyframes[0].id),
      selectedTrackId: tracks.some((track) => track.id === source.selectedTrackId) ? String(source.selectedTrackId) : tracks[0]?.id || null
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function interpolateKeyframes(layer, time) {
    const frames = Array.isArray(layer.keyframes) ? layer.keyframes.slice().sort((a, b) => a.time - b.time) : [];
    if (!frames.length) return { x: layer.x, y: layer.y, opacity: layer.opacity, scale: 1, rotation: layer.rotation };
    if (time <= frames[0].time) return { ...frames[0].values };
    if (time >= frames[frames.length - 1].time) return { ...frames[frames.length - 1].values };
    const afterIndex = frames.findIndex((frame) => frame.time >= time);
    const after = frames[afterIndex];
    const before = frames[Math.max(0, afterIndex - 1)];
    const span = Math.max(0.0001, after.time - before.time);
    const progress = clamp((time - before.time) / span, 0, 1);
    const easing = after.easing === "linear" ? progress : 1 - Math.pow(1 - progress, 3);
    const keys = ["x", "y", "opacity", "scale", "rotation"];
    return keys.reduce((result, key) => {
      result[key] = Number(before.values[key] || 0) + (Number(after.values[key] || 0) - Number(before.values[key] || 0)) * easing;
      return result;
    }, {});
  }

  function presetKeyframes(presetId, layer, duration) {
    const base = { x: layer.x, y: layer.y, opacity: 1, scale: 1, rotation: layer.rotation || 0 };
    const start = { ...base };
    const end = { ...base };
    const half = Math.max(0.2, Math.min(1, duration / 3));
    if (presetId === "float") { start.y -= 14; end.y += 14; }
    if (presetId === "slide-up") { start.y += 80; start.opacity = 0; }
    if (presetId === "pop") { start.scale = 0.35; start.opacity = 0; end.scale = 1.06; }
    if (presetId === "pulse") { end.scale = 1.08; }
    if (presetId === "typewriter") { start.opacity = 0; }
    if (presetId === "orbit") { start.rotation -= 12; end.rotation += 348; }
    return [createKeyframe(0, start, presetId === "orbit" ? "linear" : "ease-out"), createKeyframe(half, base, "ease-out"), createKeyframe(duration, end, presetId === "orbit" ? "linear" : "ease-in-out")];
  }

  function downloadJson(filename, payload) {
    if (!hasDocument) return false;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  function injectStyles() {
    if (!hasDocument || document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .hh-gm{--gm-bg:#080c15;--gm-panel:#101827;--gm-panel-2:#0c1320;--gm-line:#263449;--gm-text:#edf5ff;--gm-muted:#8fa1b8;--gm-cyan:#58e5e5;--gm-pink:#ff66c4;--gm-green:#9ef0b3;display:grid;grid-template-rows:auto minmax(0,1fr) 240px;min-height:720px;overflow:hidden;color:var(--gm-text);background:radial-gradient(circle at 78% 0%,rgba(86,229,229,.13),transparent 32%),radial-gradient(circle at 16% 100%,rgba(255,102,196,.1),transparent 34%),var(--gm-bg);font:13px/1.45 Inter,ui-sans-serif,system-ui,sans-serif;border:1px solid var(--gm-line);border-radius:18px;box-shadow:0 22px 70px rgba(0,0,0,.28)}
      .hh-gm *{box-sizing:border-box}.hh-gm button,.hh-gm input,.hh-gm select{font:inherit}.hh-gm button{cursor:pointer;color:inherit;border:1px solid var(--gm-line);background:#121c2b;border-radius:8px;padding:7px 10px;transition:transform .18s,background .18s,border-color .18s,box-shadow .18s}.hh-gm button:hover{transform:translateY(-1px);background:#18273a;border-color:#55dce0;box-shadow:0 0 0 3px rgba(85,220,224,.09)}.hh-gm button:focus-visible,.hh-gm input:focus-visible,.hh-gm select:focus-visible{outline:2px solid var(--gm-cyan);outline-offset:2px}.hh-gm button[data-primary]{background:linear-gradient(135deg,#48d8dd,#bdfb91);border-color:transparent;color:#08111a;font-weight:800}.hh-gm button[data-danger]{border-color:#a74c6e;color:#ffb4d6}.hh-gm input,.hh-gm select{width:100%;color:var(--gm-text);background:#09111c;border:1px solid var(--gm-line);border-radius:7px;padding:7px 9px}.hh-gm label{display:grid;gap:5px;color:var(--gm-muted);font-size:11px}.hh-gm small{color:var(--gm-muted)}
      .gm-topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 14px;border-bottom:1px solid var(--gm-line);background:linear-gradient(90deg,rgba(255,102,196,.07),rgba(88,229,229,.06))}.gm-brand{display:flex;align-items:center;gap:10px;min-width:0}.gm-brand-mark{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,#ef64bf,#59e6e5);color:#061018;font-weight:900;box-shadow:0 8px 25px rgba(88,229,229,.25)}.gm-brand h2{margin:0;font-size:15px}.gm-brand p{margin:2px 0 0;color:var(--gm-muted);font-size:11px}.gm-actions{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:6px}.gm-status{color:var(--gm-green);font-size:11px;white-space:nowrap}.gm-status[data-kind=warn]{color:#ffd477}.gm-status[data-kind=error]{color:#ff9ebf}
      .gm-workspace{display:grid;grid-template-columns:220px minmax(0,1fr) 250px;min-height:0}.gm-sidebar,.gm-inspector{min-width:0;overflow:auto;background:rgba(12,19,32,.74)}.gm-sidebar{border-right:1px solid var(--gm-line);padding:13px}.gm-inspector{border-left:1px solid var(--gm-line);padding:13px}.gm-section-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 9px;text-transform:uppercase;letter-spacing:.08em;color:#75dee1;font-size:10px}.gm-layer-list{display:grid;gap:6px}.gm-layer-row{display:flex;align-items:center;gap:7px;min-height:36px;padding:6px 7px;border:1px solid transparent;border-radius:8px;color:#b7c7db}.gm-layer-row:hover{background:#152133}.gm-layer-row[data-selected=true]{border-color:#56dce0;background:linear-gradient(90deg,rgba(88,229,229,.15),rgba(255,102,196,.08));color:#fff}.gm-layer-icon{display:grid;place-items:center;width:25px;height:25px;border:1px solid #52758a;border-radius:6px;color:#8beeee;font-size:11px}.gm-layer-name{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.gm-layer-lock,.gm-layer-eye{padding:3px 5px;background:transparent;border:0;box-shadow:none;color:var(--gm-muted)}.gm-tool-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.gm-preset{display:flex;align-items:flex-start;gap:7px;text-align:left;min-height:56px;padding:8px}.gm-preset strong{display:block;font-size:11px}.gm-preset small{display:block;margin-top:2px;font-size:10px}.gm-preset span{font-size:16px;color:var(--gm-pink)}
      .gm-stage-panel{display:grid;grid-template-rows:auto minmax(0,1fr);min-width:0;min-height:0;background:#080d16}.gm-stage-toolbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:9px 12px;border-bottom:1px solid var(--gm-line);background:#0d1522}.gm-stage-toolbar .gm-spacer{flex:1}.gm-stage-wrap{display:grid;place-items:center;min-height:0;padding:24px;background:repeating-conic-gradient(#111d2c 0 25%,#0e1927 0 50%) 50%/22px 22px}.gm-stage-frame{position:relative;width:min(100%,960px);aspect-ratio:16/9;max-height:100%;background:#101726;border:1px solid #42536d;box-shadow:0 15px 50px rgba(0,0,0,.45);overflow:hidden;container-type:inline-size}.gm-stage-canvas{display:block;width:100%;height:100%;touch-action:none}.gm-stage-hint{position:absolute;right:10px;bottom:8px;color:rgba(255,255,255,.55);font-size:10px;pointer-events:none}.gm-stage-empty{position:absolute;inset:0;display:grid;place-items:center;color:#95a8c0;pointer-events:none}.gm-stage-empty span{max-width:220px;text-align:center}
      .gm-inspector-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.gm-field-full{grid-column:1/-1}.gm-inspector-card,.gm-export-card{display:grid;gap:9px;padding:10px;margin-bottom:10px;border:1px solid var(--gm-line);border-radius:10px;background:rgba(16,24,39,.8)}.gm-inspector-card h3,.gm-export-card h3{margin:0;font-size:12px}.gm-check{display:flex;align-items:center;gap:7px;color:var(--gm-muted)}.gm-check input{width:auto}.gm-inline{display:flex;align-items:center;gap:6px}.gm-inline>*{flex:1}.gm-button-row{display:flex;flex-wrap:wrap;gap:6px}.gm-button-row button{flex:1;min-width:80px}.gm-marker-list{display:grid;gap:5px;max-height:130px;overflow:auto}.gm-marker{display:flex;align-items:center;justify-content:space-between;gap:5px;padding:5px 6px;border-radius:6px;background:#0b1421;color:#b6c6d9;font-size:11px}.gm-marker button{padding:2px 5px;background:transparent}
      .gm-timeline{min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr);border-top:1px solid var(--gm-line);background:#0b121e}.gm-timeline-head{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--gm-line)}.gm-timeline-head h3{margin:0;font-size:12px}.gm-timeline-head .gm-spacer{flex:1}.gm-timeline-scroll{overflow:auto;padding:8px 12px}.gm-ruler{position:relative;height:23px;margin-left:120px;border-bottom:1px solid #34445c;background:repeating-linear-gradient(90deg,transparent 0 59px,rgba(144,165,194,.27) 60px)}.gm-ruler span{position:absolute;top:2px;transform:translateX(-50%);font-size:9px;color:#7790ad}.gm-track-row{display:grid;grid-template-columns:120px minmax(520px,1fr);min-height:45px;border-bottom:1px solid rgba(51,68,91,.56)}.gm-track-name{display:flex;align-items:center;gap:6px;padding:7px;color:#b6c7db;background:#0f1826;border-right:1px solid var(--gm-line);font-size:11px}.gm-track-name[data-muted=true]{opacity:.45}.gm-key-area{position:relative;background:repeating-linear-gradient(90deg,transparent 0 59px,rgba(144,165,194,.12) 60px)}.gm-keyframe{position:absolute;top:13px;width:16px;height:16px;transform:translateX(-50%) rotate(45deg);border:2px solid #9aeaff;border-radius:3px;background:#f361c6;cursor:pointer}.gm-keyframe[data-selected=true]{box-shadow:0 0 0 3px rgba(88,229,229,.25),0 0 18px #ff66c4}.gm-playhead{position:absolute;top:0;bottom:0;width:2px;background:#ff75ca;z-index:3;pointer-events:none}.gm-playhead::before{content:"";position:absolute;top:-3px;left:-4px;border:5px solid transparent;border-top-color:#ff75ca}
      .gm-legend{display:flex;align-items:center;gap:12px;color:var(--gm-muted);font-size:10px}.gm-legend i{display:inline-block;width:8px;height:8px;transform:rotate(45deg);background:#f361c6}.gm-announce{min-height:18px;color:var(--gm-muted);font-size:11px}.gm-announce[data-kind=success]{color:var(--gm-green)}.gm-announce[data-kind=error]{color:#ff9ebf}.gm-file-input{position:relative;overflow:hidden}.gm-file-input input{position:absolute;inset:0;opacity:0;cursor:pointer}.gm-permission{display:flex;align-items:center;gap:7px;padding:7px;border-radius:7px;background:#0c1725;color:#9eb1c8;font-size:11px}.gm-permission[data-granted=true]{color:var(--gm-green)}
      @media(max-width:1050px){.hh-gm{grid-template-rows:auto minmax(0,1fr) 220px}.gm-workspace{grid-template-columns:190px minmax(0,1fr) 215px}.gm-tool-grid{grid-template-columns:1fr}.gm-stage-wrap{padding:14px}}
      @media(max-width:780px){.hh-gm{min-height:900px;grid-template-rows:auto auto 230px}.gm-workspace{grid-template-columns:1fr;grid-template-rows:auto minmax(420px,1fr) auto}.gm-sidebar,.gm-inspector{max-height:230px;border:0;border-bottom:1px solid var(--gm-line)}.gm-inspector{border-top:1px solid var(--gm-line)}.gm-layer-list{grid-template-columns:repeat(2,minmax(0,1fr))}.gm-stage-wrap{min-height:420px}.gm-stage-toolbar{position:sticky;top:0;z-index:4}.gm-ruler{margin-left:90px}.gm-track-row{grid-template-columns:90px minmax(520px,1fr)}}
      @media(max-width:520px){.gm-actions{justify-content:flex-start}.gm-brand p{display:none}.gm-topbar{align-items:flex-start;flex-direction:column}.gm-layer-list{grid-template-columns:1fr}.gm-stage-wrap{padding:8px}.gm-stage-frame{width:100%}.gm-timeline{grid-template-rows:auto 1fr}.gm-timeline-head{align-items:flex-start;flex-wrap:wrap}}
      @media(prefers-reduced-motion:reduce){.hh-gm *{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important}}
    `;
    document.head.appendChild(style);
  }

  function getStorage(storage) {
    if (storage) return storage;
    if (hasWindow && global.localStorage) return global.localStorage;
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  }

  function createController(host, options) {
    injectStyles();
    const storage = getStorage(options?.storage);
    let project = normalizeProject(options?.project || safeJsonParse(storage.getItem(STORAGE_KEY), null));
    let history = [clone(project)];
    let historyIndex = 0;
    let time = 0;
    let playing = false;
    let raf = 0;
    let mounted = true;
    let cameraStream = null;
    let micStream = null;
    const reducedMotion = Boolean(global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

    function persist() {
      project.meta.updatedAt = nowIso();
      try { storage.setItem(STORAGE_KEY, JSON.stringify(project)); } catch (_) {}
    }

    function announce(message, kind) {
      const status = host.querySelector("[data-gm-status]");
      if (!status) return;
      status.textContent = message;
      status.dataset.kind = kind || "";
      clearTimeout(announce.timer);
      announce.timer = setTimeout(() => { if (status) { status.textContent = "Sẵn sàng"; status.dataset.kind = ""; } }, 3600);
    }

    function saveSnapshot() {
      history = history.slice(0, historyIndex + 1);
      history.push(clone(project));
      if (history.length > MAX_HISTORY) history.shift();
      historyIndex = history.length - 1;
      persist();
    }

    function replaceProject(next, message) {
      project = normalizeProject(next);
      if (!project.layers.some((layer) => layer.id === project.selectedLayerId)) project.selectedLayerId = project.layers[0]?.id || null;
      saveSnapshot();
      render();
      if (message) announce(message, "success");
    }

    function update(mutator, message) {
      const next = clone(project);
      mutator(next);
      replaceProject(next, message);
    }

    function undo() {
      if (historyIndex <= 0) return announce("Không còn bước để hoàn tác.", "warn");
      historyIndex -= 1;
      project = normalizeProject(clone(history[historyIndex]));
      persist(); render(); announce("Đã hoàn tác", "success");
    }

    function redo() {
      if (historyIndex >= history.length - 1) return announce("Không còn bước để làm lại.", "warn");
      historyIndex += 1;
      project = normalizeProject(clone(history[historyIndex]));
      persist(); render(); announce("Đã làm lại", "success");
    }

    function selectedLayer() {
      return project.layers.find((layer) => layer.id === project.selectedLayerId) || project.layers[0] || null;
    }

    function selectLayer(id) {
      if (!project.layers.some((layer) => layer.id === id)) return;
      project.selectedLayerId = id;
      project.selectedKeyframeId = project.layers.find((layer) => layer.id === id)?.keyframes[0]?.id || null;
      persist(); render();
    }

    function addLayer(type) {
      const layer = createLayer(type, { x: project.stage.width / 2, y: project.stage.height / 2 });
      const track = { id: uid("track"), name: layer.name, layerId: layer.id, muted: false, locked: false };
      update((next) => { next.layers.push(layer); next.tracks.push(track); next.selectedLayerId = layer.id; next.selectedKeyframeId = layer.keyframes[0].id; }, `Đã thêm ${layer.name}`);
    }

    function addPreset(presetId) {
      const layer = selectedLayer();
      if (!layer) return announce("Hãy chọn một layer trước.", "warn");
      update((next) => {
        const target = next.layers.find((item) => item.id === layer.id);
        target.keyframes = presetKeyframes(presetId, target, next.settings.duration);
        next.selectedKeyframeId = target.keyframes[0].id;
      }, `Đã áp preset ${MOTION_PRESETS.find((item) => item.id === presetId)?.label || presetId}`);
    }

    function addKeyframe() {
      const layer = selectedLayer();
      if (!layer) return announce("Chưa có layer để tạo keyframe.", "warn");
      const values = interpolateKeyframes(layer, time);
      const key = createKeyframe(time, values, "ease-out");
      update((next) => { const target = next.layers.find((item) => item.id === layer.id); target.keyframes.push(key); target.keyframes.sort((a, b) => a.time - b.time); next.selectedKeyframeId = key.id; }, `Đã tạo keyframe tại ${formatTime(time)}`);
    }

    function addTrigger() {
      const layer = selectedLayer();
      if (!layer) return announce("Chọn layer để gắn trigger.", "warn");
      update((next) => next.triggers.push({ id: uid("trigger"), type: "click", targetId: layer.id, action: "pulse", label: "Tương tác mới" }), "Đã thêm trigger khi bấm");
    }

    function addLipMarker() {
      const layer = selectedLayer();
      if (!layer) return announce("Chọn puppet/layer để thêm marker.", "warn");
      update((next) => next.lipSync.push({ id: uid("lip"), time, phoneme: "A", layerId: layer.id }), `Đã thêm marker khẩu hình tại ${formatTime(time)}`);
    }

    function setTime(value) {
      time = clamp(value, 0, project.settings.duration);
      const output = host.querySelector("[data-gm-time]");
      if (output) output.textContent = formatTime(time);
      const range = host.querySelector("[data-gm-time-range]");
      if (range) range.value = String(time);
      updateCanvas();
      updateTimelinePlayhead();
    }

    function tick(timestamp) {
      if (!mounted) return;
      if (playing && !reducedMotion && !project.settings.reducedMotion) {
        if (!tick.last) tick.last = timestamp;
        const delta = (timestamp - tick.last) / 1000;
        tick.last = timestamp;
        setTime(time + delta);
        if (time >= project.settings.duration) time = project.settings.loop ? 0 : project.settings.duration;
      }
      raf = global.requestAnimationFrame ? global.requestAnimationFrame(tick) : setTimeout(() => tick(Date.now()), 50);
    }

    function togglePlay() {
      playing = !playing;
      if (!playing) tick.last = 0;
      const button = host.querySelector("[data-gm-play]");
      if (button) button.textContent = playing ? "Tạm dừng" : "Phát xem trước";
      announce(playing ? "Đang xem trước trên thiết bị" : "Đã tạm dừng", "success");
    }

    function drawCanvas() {
      const canvas = host.querySelector("[data-gm-canvas]");
      if (!canvas) return;
      const context = canvas.getContext?.("2d");
      if (!context) return;
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.max(1, global.devicePixelRatio || 1);
      const width = project.stage.width;
      const height = project.stage.height;
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) { canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.fillStyle = project.stage.background;
      context.fillRect(0, 0, width, height);
      const visibleLayers = project.layers.filter((layer) => layer.visible);
      for (const layer of visibleLayers) {
        const track = project.tracks.find((item) => item.layerId === layer.id);
        if (track?.muted) continue;
        const values = interpolateKeyframes(layer, time);
        const x = values.x || layer.x;
        const y = values.y || layer.y;
        const scale = values.scale || 1;
        context.save();
        context.globalAlpha = clamp(values.opacity == null ? layer.opacity : values.opacity, 0, 1);
        context.translate(x, y);
        context.rotate(((values.rotation || 0) * Math.PI) / 180);
        context.scale(scale, scale);
        if (layer.type === "text" || layer.type === "logo") {
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.font = `${layer.fontWeight || 700} ${layer.fontSize || 48}px Inter, system-ui, sans-serif`;
          if (layer.type === "logo") { context.fillStyle = "#65e7e6"; context.shadowColor = "#ff66c4"; context.shadowBlur = 22; context.fillRect(-layer.width / 2, -layer.height / 2, layer.width, layer.height); context.shadowBlur = 0; context.fillStyle = layer.color || "#08111a"; }
          else context.fillStyle = layer.color || "#ffffff";
          context.fillText(layer.text || "HH", 0, 0, layer.width);
        } else if (layer.type === "puppet") {
          context.fillStyle = "#ffbc87"; context.beginPath(); context.arc(0, -28, 34, 0, Math.PI * 2); context.fill(); context.fillStyle = "#5bdde0"; context.fillRect(-45, 8, 90, 82); context.fillStyle = "#17233a"; context.fillRect(-13, -37, 8, 8); context.fillRect(13, -37, 8, 8); context.strokeStyle = "#ff66c4"; context.lineWidth = 4; context.beginPath(); context.arc(0, -25, 18, .15, Math.PI - .15); context.stroke();
        } else {
          context.fillStyle = layer.color || "#63e6be"; const radius = Math.min(layer.radius || 20, layer.width / 2, layer.height / 2); context.beginPath(); context.roundRect?.(-layer.width / 2, -layer.height / 2, layer.width, layer.height, radius); if (!context.roundRect) context.rect(-layer.width / 2, -layer.height / 2, layer.width, layer.height); context.fill();
        }
        context.restore();
      }
      const selected = selectedLayer();
      if (selected) { const values = interpolateKeyframes(selected, time); context.save(); context.strokeStyle = "rgba(88,229,229,.8)"; context.setLineDash([6, 5]); context.strokeRect((values.x || selected.x) - selected.width / 2 - 8, (values.y || selected.y) - selected.height / 2 - 8, selected.width + 16, selected.height + 16); context.restore(); }
      void rect;
    }

    function updateCanvas() { drawCanvas(); }

    function updateTimelinePlayhead() {
      const playhead = host.querySelector("[data-gm-playhead]");
      if (playhead) playhead.style.left = `${(time / project.settings.duration) * 100}%`;
    }

    function layerIcon(type) { return type === "text" ? "T" : type === "logo" ? "◆" : type === "puppet" ? "◉" : "□"; }

    function renderLayers() {
      const list = host.querySelector("[data-gm-layers]");
      if (!list) return;
      list.innerHTML = project.layers.slice().reverse().map((layer) => `<div class="gm-layer-row" data-gm-layer="${esc(layer.id)}" data-selected="${layer.id === project.selectedLayerId}"><span class="gm-layer-icon">${layerIcon(layer.type)}</span><span class="gm-layer-name">${esc(layer.name)}</span><button class="gm-layer-eye" type="button" data-gm-toggle-visibility="${esc(layer.id)}" aria-label="${layer.visible ? "Ẩn" : "Hiện"} layer">${layer.visible ? "◉" : "○"}</button><button class="gm-layer-lock" type="button" data-gm-toggle-lock="${esc(layer.id)}" aria-label="${layer.locked ? "Mở khóa" : "Khóa"} layer">${layer.locked ? "▣" : "□"}</button></div>`).join("");
    }

    function renderInspector() {
      const card = host.querySelector("[data-gm-inspector]");
      if (!card) return;
      const layer = selectedLayer();
      if (!layer) { card.innerHTML = `<div class="gm-inspector-card"><h3>Chưa có layer</h3><small>Thêm text, logo, shape hoặc puppet để bắt đầu.</small></div>`; return; }
      card.innerHTML = `<div class="gm-inspector-card"><h3>Layer Inspector</h3><label class="gm-field-full">Tên layer<input data-gm-field="name" value="${esc(layer.name)}"></label><div class="gm-inspector-grid"><label>X<input type="number" data-gm-field="x" value="${layer.x}"></label><label>Y<input type="number" data-gm-field="y" value="${layer.y}"></label><label>Rộng<input type="number" data-gm-field="width" value="${layer.width}"></label><label>Cao<input type="number" data-gm-field="height" value="${layer.height}"></label><label>Góc xoay<input type="number" data-gm-field="rotation" value="${layer.rotation}"></label><label>Độ mờ<input type="number" min="0" max="1" step=".05" data-gm-field="opacity" value="${layer.opacity}"></label></div>${layer.type === "text" || layer.type === "logo" ? `<label>Nội dung<input data-gm-field="text" value="${esc(layer.text || "")}"></label><div class="gm-inspector-grid"><label>Cỡ chữ<input type="number" data-gm-field="fontSize" value="${layer.fontSize || 48}"></label><label>Màu chữ<input type="color" data-gm-field="color" value="${/^#[0-9a-f]{6}$/i.test(layer.color || "") ? layer.color : "#ffffff"}"></label></div>` : `<label>Màu layer<input type="color" data-gm-field="color" value="${/^#[0-9a-f]{6}$/i.test(layer.color || "") ? layer.color : "#63e6be"}"></label>`}<div class="gm-button-row"><button type="button" data-gm-delete-layer data-danger>Xóa layer</button><button type="button" data-gm-duplicate-layer>Nhân bản</button></div></div><div class="gm-inspector-card"><h3>Motion Preset</h3><div class="gm-tool-grid">${MOTION_PRESETS.map((preset) => `<button type="button" class="gm-preset" data-gm-preset="${preset.id}"><span>${preset.icon}</span><span><strong>${preset.label}</strong><small>${preset.description}</small></span></button>`).join("")}</div></div><div class="gm-inspector-card"><h3>Triggers & Lip-sync</h3><div class="gm-button-row"><button type="button" data-gm-add-trigger>+ Trigger</button><button type="button" data-gm-add-lip>+ Marker</button></div><div class="gm-marker-list">${project.triggers.filter((item) => item.targetId === layer.id).map((item) => `<div class="gm-marker"><span>${esc(TRIGGER_TYPES.find((type) => type.id === item.type)?.label || item.type)} · ${esc(item.action)}</span><button type="button" data-gm-remove-trigger="${esc(item.id)}" aria-label="Xóa trigger">×</button></div>`).join("") || `<small>Chưa có trigger cho layer này.</small>`}</div><div class="gm-marker-list">${project.lipSync.filter((item) => item.layerId === layer.id).map((item) => `<div class="gm-marker"><span>${esc(item.phoneme)} · ${formatTime(item.time)}</span><button type="button" data-gm-remove-lip="${esc(item.id)}" aria-label="Xóa marker">×</button></div>`).join("") || `<small>Chưa có marker khẩu hình.</small>`}</div></div><div class="gm-export-card"><h3>Cấu hình xuất</h3><div class="gm-inspector-grid"><label>Định dạng<select data-gm-setting="exportFormat"><option value="json" ${project.settings.exportFormat === "json" ? "selected" : ""}>Project JSON</option><option value="gif" ${project.settings.exportFormat === "gif" ? "selected" : ""}>GIF</option><option value="webm" ${project.settings.exportFormat === "webm" ? "selected" : ""}>WebM</option><option value="video" ${project.settings.exportFormat === "video" ? "selected" : ""}>Video</option></select></label><label>Chất lượng<select data-gm-setting="quality"><option value="draft" ${project.settings.quality === "draft" ? "selected" : ""}>Nháp</option><option value="high" ${project.settings.quality === "high" ? "selected" : ""}>Cao</option><option value="lossless" ${project.settings.quality === "lossless" ? "selected" : ""}>Không mất dữ liệu</option></select></label></div><small>GIF/WebM/video hiện lưu cấu hình và project JSON. Bộ mã hóa render thật cần được kết nối riêng, module không giả vờ đã render.</small></div>`;
    }

    function renderTimeline() {
      const timeline = host.querySelector("[data-gm-timeline-body]");
      if (!timeline) return;
      const steps = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((item) => item <= project.settings.duration);
      timeline.innerHTML = `<div class="gm-ruler">${steps.map((step) => `<span style="left:${(step / project.settings.duration) * 100}%">${step}s</span>`).join("")}<i class="gm-playhead" data-gm-playhead></i></div>${project.tracks.map((track) => { const layer = project.layers.find((item) => item.id === track.layerId); if (!layer) return ""; return `<div class="gm-track-row"><div class="gm-track-name" data-muted="${track.muted}"><span>${esc(track.name)}</span><button type="button" data-gm-toggle-track="${esc(track.id)}" aria-label="${track.muted ? "Bật" : "Tắt"} track">${track.muted ? "○" : "●"}</button></div><div class="gm-key-area">${layer.keyframes.map((frame) => `<button class="gm-keyframe" type="button" data-gm-keyframe="${esc(frame.id)}" data-gm-layer-keyframe="${esc(layer.id)}" data-selected="${frame.id === project.selectedKeyframeId}" style="left:${(frame.time / project.settings.duration) * 100}%" aria-label="Keyframe ${formatTime(frame.time)}"></button>`).join("")}</div></div>`; }).join("")}`;
      updateTimelinePlayhead();
    }

    function render() {
      if (!mounted) return;
      const selected = selectedLayer();
      host.innerHTML = `<div class="gm-topbar"><div class="gm-brand"><span class="gm-brand-mark">HH</span><div><h2>Motion & Character Studio</h2><p>Thiết kế hoạt ảnh tương tác local-first · Canvas preview</p></div></div><div class="gm-actions"><span class="gm-status" data-gm-status role="status" aria-live="polite">Sẵn sàng</span><button type="button" data-gm-undo aria-label="Hoàn tác">↶</button><button type="button" data-gm-redo aria-label="Làm lại">↷</button><button type="button" data-gm-export data-primary>Xuất JSON</button><label class="gm-file-input"><button type="button">Nhập JSON</button><input type="file" accept="application/json" data-gm-import></label></div></div><div class="gm-workspace"><aside class="gm-sidebar"><div class="gm-section-title"><span>Layers & Puppet</span><span>${project.layers.length}</span></div><div class="gm-button-row"><button type="button" data-gm-add="text">+ Text</button><button type="button" data-gm-add="logo">+ Logo</button><button type="button" data-gm-add="puppet">+ Puppet</button></div><div class="gm-button-row" style="margin-top:6px"><button type="button" data-gm-add="shape">+ Shape</button><button type="button" data-gm-add-keyframe>◆ Keyframe</button></div><div class="gm-layer-list" data-gm-layers style="margin-top:10px"></div><div class="gm-section-title" style="margin-top:16px"><span>Motion Preset</span><span>${MOTION_PRESETS.length}</span></div><div class="gm-tool-grid">${MOTION_PRESETS.slice(0, 4).map((preset) => `<button type="button" class="gm-preset" data-gm-preset="${preset.id}"><span>${preset.icon}</span><span><strong>${preset.label}</strong><small>${preset.description}</small></span></button>`).join("")}</div><div class="gm-section-title" style="margin-top:16px"><span>Quyền thiết bị</span><span>Chỉ khi bấm</span></div><div class="gm-permission" data-gm-camera-status>Camera: chưa cấp quyền</div><div class="gm-permission" data-gm-mic-status>Micro: chưa cấp quyền</div><div class="gm-button-row" style="margin-top:6px"><button type="button" data-gm-camera>Xin quyền camera</button><button type="button" data-gm-mic>Xin quyền mic</button></div></aside><section class="gm-stage-panel"><div class="gm-stage-toolbar"><button type="button" data-gm-play data-primary>Phát xem trước</button><button type="button" data-gm-stop>Dừng</button><button type="button" data-gm-add-trigger>+ Trigger</button><button type="button" data-gm-add-lip>+ Lip-sync</button><span class="gm-spacer"></span><label style="width:82px">FPS<select data-gm-setting="fps">${[24,25,30,50,60].map((fps) => `<option value="${fps}" ${project.settings.fps === fps ? "selected" : ""}>${fps}</option>`).join("")}</select></label><label style="width:102px">Thời lượng<input type="number" min=".5" max="3600" step=".5" data-gm-setting="duration" value="${project.settings.duration}"></label></div><div class="gm-stage-wrap"><div class="gm-stage-frame"><canvas class="gm-stage-canvas" data-gm-canvas width="960" height="540" aria-label="Canvas preview hoạt ảnh"></canvas><div class="gm-stage-hint">Kéo canvas để di chuyển layer đã chọn</div></div></div></section><aside class="gm-inspector" data-gm-inspector></aside></div><section class="gm-timeline"><div class="gm-timeline-head"><h3>Timeline / Keyframes</h3><button type="button" data-gm-add-keyframe>+ Keyframe tại <span data-gm-time>${formatTime(time)}</span></button><label class="gm-check"><input type="checkbox" data-gm-setting="loop" ${project.settings.loop ? "checked" : ""}> Lặp</label><span class="gm-spacer"></span><span class="gm-legend"><i></i> Keyframe · <span data-gm-time>${formatTime(time)}</span></span></div><div class="gm-timeline-scroll"><input type="range" min="0" max="${project.settings.duration}" step=".01" value="${time}" data-gm-time-range aria-label="Vị trí playhead"><div data-gm-timeline-body></div></div></section>`;
      renderLayers(); renderInspector(); renderTimeline(); updateCanvas();
      if (selected) project.selectedLayerId = selected.id;
    }

    function updateField(field, value) {
      const layer = selectedLayer();
      if (!layer) return;
      const numberFields = new Set(["x", "y", "width", "height", "rotation", "opacity", "fontSize"]);
      update((next) => { const target = next.layers.find((item) => item.id === layer.id); target[field] = numberFields.has(field) ? Number(value) : String(value); }, `Đã cập nhật ${field}`);
    }

    function deleteLayer() {
      const layer = selectedLayer();
      if (!layer) return;
      update((next) => { next.layers = next.layers.filter((item) => item.id !== layer.id); next.tracks = next.tracks.filter((item) => item.layerId !== layer.id); next.triggers = next.triggers.filter((item) => item.targetId !== layer.id); next.lipSync = next.lipSync.filter((item) => item.layerId !== layer.id); next.selectedLayerId = next.layers[0]?.id || null; }, `Đã xóa ${layer.name}`);
    }

    function duplicateLayer() {
      const layer = selectedLayer();
      if (!layer) return;
      const copyLayer = clone(layer); copyLayer.id = uid("layer"); copyLayer.name = `${layer.name} bản sao`; copyLayer.x += 28; copyLayer.y += 28; copyLayer.keyframes = copyLayer.keyframes.map((frame) => ({ ...frame, id: uid("key") }));
      update((next) => { next.layers.push(copyLayer); next.tracks.push({ id: uid("track"), name: copyLayer.name, layerId: copyLayer.id, muted: false, locked: false }); next.selectedLayerId = copyLayer.id; next.selectedKeyframeId = copyLayer.keyframes[0].id; }, "Đã nhân bản layer");
    }

    function updatePermission(kind, stream) {
      const target = host.querySelector(`[data-gm-${kind}-status]`);
      if (!target) return;
      target.textContent = `${kind === "camera" ? "Camera" : "Micro"}: đã cấp quyền trong phiên này`;
      target.dataset.granted = "true";
      if (kind === "camera") cameraStream = stream; else micStream = stream;
    }

    async function requestPermission(kind) {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Trình duyệt không hỗ trợ quyền thiết bị.");
        const stream = await navigator.mediaDevices.getUserMedia(kind === "camera" ? { video: true, audio: false } : { audio: true, video: false });
        updatePermission(kind, stream);
        announce(`Đã cấp quyền ${kind === "camera" ? "camera" : "micro"} trong phiên này`, "success");
      } catch (error) { announce(`${kind === "camera" ? "Camera" : "Micro"}: ${error.message || "không thể cấp quyền"}`, "error"); }
    }

    function handleImport(file) {
      const reader = new FileReader();
      reader.onload = () => { const imported = safeJsonParse(reader.result, null); if (!imported?.layers || !imported?.stage) return announce("Tệp project không hợp lệ.", "error"); replaceProject(imported, "Đã nhập project JSON"); };
      reader.onerror = () => announce("Không đọc được tệp JSON.", "error");
      reader.readAsText(file);
    }

    function handlePointer(event) {
      const canvas = event.currentTarget;
      const selected = selectedLayer();
      if (!selected || selected.locked) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * project.stage.width;
      const y = ((event.clientY - rect.top) / rect.height) * project.stage.height;
      const values = interpolateKeyframes(selected, time);
      if (Math.abs(x - values.x) > selected.width / 2 + 30 || Math.abs(y - values.y) > selected.height / 2 + 30) return;
      canvas.setPointerCapture?.(event.pointerId);
      const startX = x; const startY = y; const originX = selected.x; const originY = selected.y;
      const move = (moveEvent) => { const nextX = originX + (((moveEvent.clientX - rect.left) / rect.width) * project.stage.width - startX); const nextY = originY + (((moveEvent.clientY - rect.top) / rect.height) * project.stage.height - startY); project.layers.find((item) => item.id === selected.id).x = Math.round(nextX); project.layers.find((item) => item.id === selected.id).y = Math.round(nextY); updateCanvas(); };
      const end = () => { canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerup", end); canvas.removeEventListener("pointercancel", end); saveSnapshot(); render(); announce("Đã di chuyển layer", "success"); };
      canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerup", end, { once: true }); canvas.addEventListener("pointercancel", end, { once: true });
    }

    function onClick(event) {
      const target = event.target.closest?.("[data-gm-layer],[data-gm-toggle-visibility],[data-gm-toggle-lock],[data-gm-add],[data-gm-preset],[data-gm-add-keyframe],[data-gm-undo],[data-gm-redo],[data-gm-play],[data-gm-stop],[data-gm-add-trigger],[data-gm-add-lip],[data-gm-delete-layer],[data-gm-duplicate-layer],[data-gm-remove-trigger],[data-gm-remove-lip],[data-gm-keyframe],[data-gm-camera],[data-gm-mic],[data-gm-export]");
      if (!target) return;
      if (target.dataset.gmLayer) return selectLayer(target.dataset.gmLayer);
      if (target.dataset.gmToggleVisibility) return update((next) => { const layer = next.layers.find((item) => item.id === target.dataset.gmToggleVisibility); layer.visible = !layer.visible; }, "Đã cập nhật hiển thị layer");
      if (target.dataset.gmToggleLock) return update((next) => { const layer = next.layers.find((item) => item.id === target.dataset.gmToggleLock); layer.locked = !layer.locked; }, "Đã cập nhật khóa layer");
      if (target.dataset.gmAdd) return addLayer(target.dataset.gmAdd);
      if (target.dataset.gmPreset) return addPreset(target.dataset.gmPreset);
      if (target.dataset.gmAddKeyframe !== undefined) return addKeyframe();
      if (target.dataset.gmUndo !== undefined) return undo();
      if (target.dataset.gmRedo !== undefined) return redo();
      if (target.dataset.gmPlay !== undefined) return togglePlay();
      if (target.dataset.gmStop !== undefined) { playing = false; setTime(0); const play = host.querySelector("[data-gm-play]"); if (play) play.textContent = "Phát xem trước"; return announce("Đã dừng preview", "success"); }
      if (target.dataset.gmAddTrigger !== undefined) return addTrigger();
      if (target.dataset.gmAddLip !== undefined) return addLipMarker();
      if (target.dataset.gmDeleteLayer !== undefined) return deleteLayer();
      if (target.dataset.gmDuplicateLayer !== undefined) return duplicateLayer();
      if (target.dataset.gmRemoveTrigger) return update((next) => { next.triggers = next.triggers.filter((item) => item.id !== target.dataset.gmRemoveTrigger); }, "Đã xóa trigger");
      if (target.dataset.gmRemoveLip) return update((next) => { next.lipSync = next.lipSync.filter((item) => item.id !== target.dataset.gmRemoveLip); }, "Đã xóa marker");
      if (target.dataset.gmKeyframe) { project.selectedLayerId = target.dataset.gmLayerKeyframe; project.selectedKeyframeId = target.dataset.gmKeyframe; persist(); render(); return; }
      if (target.dataset.gmCamera !== undefined) return requestPermission("camera");
      if (target.dataset.gmMic !== undefined) return requestPermission("mic");
      if (target.dataset.gmExport !== undefined) return downloadJson(`${project.meta.name.replace(/[^a-z0-9_-]+/gi, "-") || "hh-motion-project"}.json`, project);
    }

    function onInput(event) {
      const field = event.target.closest?.("[data-gm-field]");
      if (field && event.type === "change") return updateField(field.dataset.gmField, field.value);
      if (event.target.matches("[data-gm-time-range]")) return setTime(event.target.value);
      const setting = event.target.closest?.("[data-gm-setting]");
      if (setting && event.type === "change") {
        const key = setting.dataset.gmSetting;
        const value = key === "loop" ? setting.checked : key === "duration" ? clamp(setting.value, .5, 3600) : key === "fps" ? Number(setting.value) : String(setting.value);
        return update((next) => { next.settings[key] = value; }, `Đã cập nhật ${key}`);
      }
    }

    function onKeydown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); return event.shiftKey ? redo() : undo(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); return redo(); }
      if (event.code === "Space" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) { event.preventDefault(); togglePlay(); }
      if (event.key === "Delete" && document.activeElement?.tagName === "BODY") deleteLayer();
    }

    function bind() {
      host.addEventListener("click", onClick); host.addEventListener("change", onInput); host.addEventListener("input", onInput); host.addEventListener("keydown", onKeydown);
      host.addEventListener("pointerdown", (event) => { if (event.target.matches("[data-gm-canvas]")) handlePointer(event); });
      const input = host.querySelector("[data-gm-import]"); if (input) input.addEventListener("change", () => { if (input.files?.[0]) handleImport(input.files[0]); input.value = ""; });
    }

    function unmount() {
      mounted = false; playing = false;
      if (global.cancelAnimationFrame && raf) global.cancelAnimationFrame(raf); else clearTimeout(raf);
      cameraStream?.getTracks?.().forEach((track) => track.stop()); micStream?.getTracks?.().forEach((track) => track.stop());
      host.replaceChildren();
    }

    render(); bind();
    tick(Date.now());
    return { getProject: () => clone(project), setProject: (next) => replaceProject(next, "Đã nạp project"), undo, redo, addLayer, addPreset, addKeyframe, exportProject: () => downloadJson("hh-motion-project.json", project), unmount };
  }

  const mounted = typeof WeakMap !== "undefined" ? new WeakMap() : new Map();

  function mount(root, options) {
    if (!root || !root.querySelector) return null;
    if (mounted.has(root)) return mounted.get(root);
    const controller = createController(root, options || {});
    mounted.set(root, controller);
    return controller;
  }

  function unmount(root) {
    const controller = mounted.get(root);
    if (!controller) return false;
    controller.unmount();
    mounted.delete(root);
    return true;
  }

  function mountAll() {
    if (!hasDocument) return;
    document.querySelectorAll("[data-graphic-motion]").forEach((root) => mount(root));
  }

  const api = { VERSION, STORAGE_KEY, MOTION_PRESETS: MOTION_PRESETS.map((item) => ({ ...item })), TRIGGER_TYPES: TRIGGER_TYPES.map((item) => ({ ...item })), createDefaultProject, normalizeProject, interpolateKeyframes, presetKeyframes, formatTime, mount, unmount, mountAll };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (hasWindow) {
    global.HHGraphicMotion = api;
    if (hasDocument) { mountAll(); if (typeof global.MutationObserver === "function") new global.MutationObserver(mountAll).observe(document.documentElement, { childList: true, subtree: true }); }
  }
})(typeof window !== "undefined" ? window : globalThis);
