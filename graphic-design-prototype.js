(function () {
  "use strict";

  const STORAGE_KEY = "hh.graphic-design.prototype.v1";
  const STYLE_KEY = "hh-graphic-design-prototype-style";
  const TRIGGERS = ["click", "hover", "drag", "swipe"];
  const DEVICES = {
    desktop: { label: "Desktop 1440", width: 1440, height: 900 },
    laptop: { label: "Laptop 1280", width: 1280, height: 800 },
    tablet: { label: "Tablet 834", width: 834, height: 1112 },
    mobile: { label: "Mobile 390", width: 390, height: 844 }
  };
  const COMPONENT_STATES = ["default", "hover", "pressed", "disabled"];
  const MAX_FRAMES = 40;
  const MAX_HISTORY = 30;

  const uid = (prefix) => {
    const random = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix || "item"}-${random}`;
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const safeInt = (value, fallback, min, max) => {
    const number = Number.parseInt(value, 10);
    return Number.isFinite(number) ? clamp(number, min, max) : fallback;
  };
  const safeStorageRead = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch (_) {
      return null;
    }
  };
  const safeStorageWrite = (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (_) {
      // The editor remains usable when storage is disabled or full.
    }
  };

  function defaultState() {
    const homeId = "frame-home";
    const detailId = "frame-detail";
    return {
      version: 1,
      device: "mobile",
      mode: "design",
      currentFrameId: homeId,
      selectedHotspotId: "",
      variables: [
        { id: "var-user", name: "userName", value: "Hoàng Đại Ka 13", type: "text" },
        { id: "var-theme", name: "theme", value: "neon", type: "text" }
      ],
      components: [
        { id: "component-cta", name: "Nút khám phá", state: "default", states: COMPONENT_STATES.slice() },
        { id: "component-card", name: "Thẻ dự án", state: "default", states: COMPONENT_STATES.slice() }
      ],
      frames: [
        {
          id: homeId,
          name: "Trang chủ",
          width: 390,
          height: 844,
          background: "aurora",
          layers: ["Logo HH", "Lời chào", "Thẻ dự án", "Nút khám phá"],
          hotspots: [
            { id: "hotspot-explore", label: "Mở dự án", x: 44, y: 456, width: 302, height: 58, trigger: "click", targetFrameId: detailId, action: "navigate", componentId: "component-cta" },
            { id: "hotspot-hover", label: "Hover preview", x: 44, y: 540, width: 302, height: 44, trigger: "hover", targetFrameId: detailId, action: "navigate", componentId: "component-card" }
          ]
        },
        {
          id: detailId,
          name: "Chi tiết dự án",
          width: 390,
          height: 844,
          background: "midnight",
          layers: ["Nút quay lại", "Tiêu đề", "Nội dung", "Nút bắt đầu"],
          hotspots: [
            { id: "hotspot-back", label: "Quay lại", x: 28, y: 38, width: 110, height: 44, trigger: "click", targetFrameId: homeId, action: "navigate", componentId: "component-cta" },
            { id: "hotspot-swipe", label: "Swipe bắt đầu", x: 42, y: 650, width: 306, height: 58, trigger: "swipe", targetFrameId: homeId, action: "navigate", componentId: "component-card" }
          ]
        }
      ]
    };
  }

  function normalizeState(raw) {
    const fallback = defaultState();
    if (!raw || typeof raw !== "object") return fallback;
    const next = clone(fallback);
    next.device = DEVICES[raw.device] ? raw.device : fallback.device;
    next.mode = raw.mode === "play" ? "play" : "design";
    next.variables = Array.isArray(raw.variables) ? raw.variables.slice(0, 30).map((item) => ({
      id: String(item.id || uid("var")),
      name: String(item.name || "variable"),
      value: String(item.value == null ? "" : item.value),
      type: ["text", "number", "boolean"].includes(item.type) ? item.type : "text"
    })) : next.variables;
    next.components = Array.isArray(raw.components) ? raw.components.slice(0, 30).map((item) => ({
      id: String(item.id || uid("component")),
      name: String(item.name || "Component"),
      state: COMPONENT_STATES.includes(item.state) ? item.state : "default",
      states: COMPONENT_STATES.slice()
    })) : next.components;
    const frames = Array.isArray(raw.frames) ? raw.frames.slice(0, MAX_FRAMES).map((frame, index) => {
      const id = String(frame.id || uid("frame"));
      const hotspots = Array.isArray(frame.hotspots) ? frame.hotspots.slice(0, 50).map((spot) => ({
        id: String(spot.id || uid("hotspot")),
        label: String(spot.label || "Hotspot"),
        x: safeInt(spot.x, 24, 0, 5000),
        y: safeInt(spot.y, 24, 0, 5000),
        width: safeInt(spot.width, 180, 24, 5000),
        height: safeInt(spot.height, 52, 24, 5000),
        trigger: TRIGGERS.includes(spot.trigger) ? spot.trigger : "click",
        targetFrameId: String(spot.targetFrameId || ""),
        action: String(spot.action || "navigate"),
        componentId: String(spot.componentId || "")
      })) : [];
      return {
        id,
        name: String(frame.name || `Frame ${index + 1}`),
        width: safeInt(frame.width, 390, 120, 5000),
        height: safeInt(frame.height, 844, 120, 5000),
        background: String(frame.background || "aurora"),
        layers: Array.isArray(frame.layers) ? frame.layers.slice(0, 30).map(String) : [],
        hotspots
      };
    }) : next.frames;
    next.frames = frames.length ? frames : next.frames;
    const ids = new Set(next.frames.map((frame) => frame.id));
    next.frames.forEach((frame) => frame.hotspots.forEach((spot) => {
      if (!ids.has(spot.targetFrameId)) spot.targetFrameId = next.frames[0].id;
    }));
    next.currentFrameId = ids.has(String(raw.currentFrameId)) ? String(raw.currentFrameId) : next.frames[0].id;
    next.selectedHotspotId = "";
    next.version = 1;
    return next;
  }

  const styles = `
  .hh-gd-prototype{--hh-gd-bg:#070b13;--hh-gd-panel:#0d1420;--hh-gd-panel-2:#111b29;--hh-gd-line:#25364b;--hh-gd-muted:#8292a8;--hh-gd-text:#eef6ff;--hh-gd-cyan:#62e6ef;--hh-gd-pink:#ff63c8;--hh-gd-lime:#c4ff68;--hh-gd-shadow:0 18px 60px rgba(0,0,0,.32);color:var(--hh-gd-text);background:radial-gradient(circle at 12% 0%,rgba(255,99,200,.14),transparent 32%),linear-gradient(140deg,#070b13 0%,#090d18 52%,#0c1320 100%);border:1px solid rgba(98,230,239,.24);border-radius:20px;box-shadow:var(--hh-gd-shadow);font:500 13px/1.45 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;min-height:720px;overflow:hidden;position:relative}
  .hh-gd-prototype *{box-sizing:border-box}.hh-gd-prototype button,.hh-gd-prototype input,.hh-gd-prototype select{font:inherit}.hh-gd-prototype button{border:1px solid var(--hh-gd-line);border-radius:9px;background:#111a27;color:var(--hh-gd-text);cursor:pointer;min-height:34px;padding:7px 11px;transition:transform .16s ease,border-color .16s ease,background .16s ease,box-shadow .16s ease}.hh-gd-prototype button:hover{border-color:var(--hh-gd-cyan);background:#172739;box-shadow:0 0 18px rgba(98,230,239,.14);transform:translateY(-1px)}.hh-gd-prototype button:focus-visible,.hh-gd-prototype input:focus-visible,.hh-gd-prototype select:focus-visible{outline:2px solid var(--hh-gd-cyan);outline-offset:2px}.hh-gd-prototype button[data-primary]{background:linear-gradient(110deg,var(--hh-gd-cyan),#74a9ff);border-color:transparent;color:#06111b;font-weight:800}.hh-gd-prototype button[data-danger]{color:#ff9bbd;border-color:rgba(255,99,200,.34)}.hh-gd-prototype button[disabled]{cursor:not-allowed;opacity:.42;transform:none;box-shadow:none}.hh-gd-topbar{align-items:center;background:rgba(8,12,20,.82);border-bottom:1px solid var(--hh-gd-line);display:flex;gap:8px;min-height:62px;padding:10px 14px;position:relative;z-index:2}.hh-gd-brand{align-items:center;display:flex;gap:10px;margin-right:auto}.hh-gd-mark{align-items:center;background:linear-gradient(135deg,var(--hh-gd-pink),var(--hh-gd-cyan));border-radius:11px;color:#06111b;display:grid;font-weight:900;height:36px;place-items:center;width:36px}.hh-gd-brand strong{display:block;font-size:14px}.hh-gd-brand small{color:var(--hh-gd-muted);display:block;font-size:10px;letter-spacing:.08em;text-transform:uppercase}.hh-gd-toolbar-group{align-items:center;display:flex;gap:6px}.hh-gd-select,.hh-gd-input{background:#0a111b;border:1px solid var(--hh-gd-line);border-radius:8px;color:var(--hh-gd-text);min-height:34px;padding:7px 9px;width:100%}.hh-gd-select{appearance:auto}.hh-gd-layout{display:grid;grid-template-columns:232px minmax(430px,1fr) 284px;min-height:658px}.hh-gd-panel{background:rgba(7,12,20,.68);border-right:1px solid var(--hh-gd-line);min-width:0;padding:14px}.hh-gd-panel:last-child{border-left:1px solid var(--hh-gd-line);border-right:0}.hh-gd-panel-title{align-items:flex-start;display:flex;justify-content:space-between;margin-bottom:12px}.hh-gd-panel-title strong{font-size:12px;letter-spacing:.08em;text-transform:uppercase}.hh-gd-panel-title small{color:var(--hh-gd-muted);font-size:11px}.hh-gd-section{border-top:1px solid rgba(37,54,75,.72);margin-top:14px;padding-top:14px}.hh-gd-section:first-of-type{border-top:0;margin-top:0;padding-top:0}.hh-gd-frame-list{display:grid;gap:8px}.hh-gd-frame-item{align-items:center;background:#0b121d;border:1px solid transparent;border-radius:10px;cursor:pointer;display:flex;gap:9px;padding:8px}.hh-gd-frame-item:hover{border-color:#426076}.hh-gd-frame-item.is-active{background:linear-gradient(110deg,rgba(98,230,239,.14),rgba(255,99,200,.08));border-color:var(--hh-gd-cyan);box-shadow:inset 3px 0 var(--hh-gd-pink)}.hh-gd-frame-thumb{background:linear-gradient(140deg,#2c154a,#132e43);border:1px solid rgba(98,230,239,.42);border-radius:7px;height:42px;position:relative;width:32px}.hh-gd-frame-thumb:after{background:var(--hh-gd-pink);border-radius:2px;bottom:7px;content:"";height:5px;left:5px;position:absolute;width:20px}.hh-gd-frame-copy{min-width:0}.hh-gd-frame-copy strong,.hh-gd-frame-copy small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hh-gd-frame-copy strong{font-size:12px}.hh-gd-frame-copy small{color:var(--hh-gd-muted);font-size:10px}.hh-gd-frame-actions{display:flex;gap:6px;margin-top:10px}.hh-gd-frame-actions button{flex:1;font-size:11px;padding-left:5px;padding-right:5px}.hh-gd-flow{display:grid;gap:7px;margin-top:8px}.hh-gd-flow-chip{align-items:center;background:#0c1521;border:1px solid var(--hh-gd-line);border-radius:8px;color:var(--hh-gd-muted);display:flex;gap:7px;padding:7px 8px}.hh-gd-flow-chip strong{color:var(--hh-gd-cyan);font-size:10px}.hh-gd-flow-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hh-gd-stage{align-items:center;background:radial-gradient(circle at 50% 44%,rgba(98,230,239,.1),transparent 33%),repeating-conic-gradient(#111b27 0 25%,#0e1723 0 50%) 50%/24px 24px;display:flex;justify-content:center;min-width:0;overflow:auto;padding:34px 22px 80px;position:relative}.hh-gd-stage.is-play{background:radial-gradient(circle at 50% 44%,rgba(255,99,200,.12),transparent 38%),#080c14}.hh-gd-stage-top{align-items:center;color:var(--hh-gd-muted);display:flex;font-size:11px;gap:8px;left:18px;position:absolute;right:18px;top:14px}.hh-gd-stage-top span:last-child{margin-left:auto}.hh-gd-preview{background:#101927;border:1px solid rgba(255,255,255,.18);border-radius:22px;box-shadow:0 30px 80px rgba(0,0,0,.48),0 0 0 8px rgba(13,20,32,.86);max-height:calc(100vh - 220px);max-width:100%;overflow:hidden;position:relative;transform-origin:center;transition:width .2s ease,height .2s ease}.hh-gd-preview[data-bg="aurora"]{background:radial-gradient(circle at 20% 15%,rgba(255,99,200,.74),transparent 28%),radial-gradient(circle at 85% 35%,rgba(98,230,239,.7),transparent 32%),linear-gradient(160deg,#27103e,#0a2432 76%)}.hh-gd-preview[data-bg="midnight"]{background:radial-gradient(circle at 72% 20%,rgba(98,230,239,.28),transparent 30%),linear-gradient(160deg,#121a38,#080b16 72%)}.hh-gd-preview:before{background:linear-gradient(90deg,rgba(255,255,255,.16),transparent 36%);content:"";inset:0;pointer-events:none;position:absolute}.hh-gd-preview-content{display:flex;flex-direction:column;height:100%;padding:26px 22px;position:relative}.hh-gd-preview-kicker{color:var(--hh-gd-cyan);font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.hh-gd-preview h2{font-size:clamp(21px,3vw,32px);letter-spacing:-.04em;line-height:1.05;margin:10px 0}.hh-gd-preview p{color:rgba(238,246,255,.72);font-size:12px;margin:0;max-width:260px}.hh-gd-preview-card{background:rgba(255,255,255,.11);border:1px solid rgba(255,255,255,.2);border-radius:15px;box-shadow:0 16px 35px rgba(0,0,0,.18);margin-top:34px;padding:16px}.hh-gd-preview-card strong{display:block;font-size:13px}.hh-gd-preview-card span{color:rgba(238,246,255,.66);display:block;font-size:11px;margin-top:4px}.hh-gd-preview-pill{align-items:center;background:linear-gradient(100deg,var(--hh-gd-pink),#aa7cff);border-radius:10px;color:#fff;display:flex;font-size:12px;font-weight:800;justify-content:center;margin-top:16px;padding:13px}.hh-gd-preview-bottom{align-items:end;display:flex;flex:1;justify-content:space-between}.hh-gd-preview-bottom small{color:rgba(238,246,255,.62);font-size:10px}.hh-gd-hotspot{background:rgba(98,230,239,.18);border:1px dashed var(--hh-gd-cyan);border-radius:9px;cursor:grab;left:0;position:absolute;top:0;transition:background .14s ease,box-shadow .14s ease,border-color .14s ease}.hh-gd-hotspot:hover{background:rgba(255,99,200,.26);box-shadow:0 0 22px rgba(255,99,200,.28)}.hh-gd-hotspot:active{cursor:grabbing}.hh-gd-hotspot.is-selected{background:rgba(255,99,200,.32);border:2px solid var(--hh-gd-pink);box-shadow:0 0 0 3px rgba(255,99,200,.13),0 0 24px rgba(255,99,200,.26)}.hh-gd-hotspot span{background:rgba(4,9,16,.76);border-radius:4px;color:#fff;font-size:9px;left:6px;padding:2px 4px;position:absolute;top:5px;white-space:nowrap}.hh-gd-stage.is-play .hh-gd-hotspot{background:transparent;border-color:transparent;box-shadow:none;cursor:pointer}.hh-gd-stage.is-play .hh-gd-hotspot span{display:none}.hh-gd-stage-hint{bottom:22px;color:var(--hh-gd-muted);font-size:11px;left:20px;position:absolute;right:20px;text-align:center}.hh-gd-inspector{display:grid;gap:10px}.hh-gd-field{display:grid;gap:5px}.hh-gd-field label{color:var(--hh-gd-muted);font-size:10px;letter-spacing:.05em;text-transform:uppercase}.hh-gd-grid-2{display:grid;gap:7px;grid-template-columns:1fr 1fr}.hh-gd-mini-row{align-items:center;display:flex;gap:6px}.hh-gd-mini-row .hh-gd-input{min-width:0}.hh-gd-list{display:grid;gap:6px}.hh-gd-list-row{align-items:center;background:#0b121d;border:1px solid rgba(37,54,75,.82);border-radius:8px;display:flex;gap:6px;padding:6px}.hh-gd-list-row .hh-gd-input{border:0;min-height:28px;padding:3px 5px}.hh-gd-list-row button{border:0;font-size:11px;min-height:26px;padding:3px 6px}.hh-gd-badge{background:rgba(98,230,239,.12);border:1px solid rgba(98,230,239,.32);border-radius:99px;color:var(--hh-gd-cyan);font-size:10px;padding:3px 7px}.hh-gd-statusbar{align-items:center;background:#080d16;border-top:1px solid var(--hh-gd-line);color:var(--hh-gd-muted);display:flex;gap:12px;min-height:38px;padding:7px 14px}.hh-gd-statusbar span:last-child{margin-left:auto}.hh-gd-toast{animation:hhGdToastIn .2s ease;background:#132536;border:1px solid var(--hh-gd-cyan);border-radius:9px;bottom:52px;box-shadow:0 14px 40px rgba(0,0,0,.35);color:var(--hh-gd-text);font-size:12px;padding:10px 13px;position:absolute;right:18px;z-index:5}.hh-gd-help{color:var(--hh-gd-muted);font-size:11px;margin:6px 0 0}.hh-gd-shortcuts{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}.hh-gd-shortcuts kbd{background:#111c2a;border:1px solid var(--hh-gd-line);border-radius:5px;color:var(--hh-gd-cyan);font-size:10px;padding:3px 5px}.hh-gd-import{display:none}.hh-gd-sr-only{clip:rect(0 0 0 0);clip-path:inset(50%);height:1px;overflow:hidden;position:absolute;white-space:nowrap;width:1px}.hh-gd-prototype[data-mode="play"] .hh-gd-panel{opacity:.72}.hh-gd-prototype[data-mode="play"] .hh-gd-panel:last-child{opacity:0;pointer-events:none;width:0}.hh-gd-prototype[data-mode="play"] .hh-gd-layout{grid-template-columns:188px 1fr 0}.hh-gd-prototype[data-mode="play"] .hh-gd-stage{padding-bottom:50px}.hh-gd-prototype[data-mode="play"] .hh-gd-stage-hint{color:var(--hh-gd-cyan)}
  @keyframes hhGdToastIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@media(max-width:1080px){.hh-gd-layout{grid-template-columns:200px minmax(360px,1fr) 250px}.hh-gd-toolbar-group:nth-last-child(2){display:none}}@media(max-width:780px){.hh-gd-prototype{border-radius:12px}.hh-gd-topbar{align-items:flex-start;flex-wrap:wrap}.hh-gd-brand{width:100%}.hh-gd-toolbar-group{flex:1}.hh-gd-toolbar-group button{flex:1;font-size:11px;padding-left:6px;padding-right:6px}.hh-gd-layout{grid-template-columns:1fr}.hh-gd-panel{border-bottom:1px solid var(--hh-gd-line);border-right:0}.hh-gd-panel:last-child{border-left:0}.hh-gd-frame-list{grid-template-columns:repeat(2,minmax(0,1fr))}.hh-gd-stage{min-height:560px;order:-1}.hh-gd-prototype[data-mode="play"] .hh-gd-layout{grid-template-columns:1fr}.hh-gd-prototype[data-mode="play"] .hh-gd-panel{display:none}.hh-gd-prototype[data-mode="play"] .hh-gd-stage{display:flex}.hh-gd-statusbar{font-size:10px}}@media(prefers-reduced-motion:reduce){.hh-gd-prototype *{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important}}
  `;

  function injectStyles() {
    if (typeof document === "undefined" || document.querySelector(`[data-${STYLE_KEY}]`)) return;
    const node = document.createElement("style");
    node.setAttribute(`data-${STYLE_KEY}`, "true");
    node.textContent = styles;
    document.head.append(node);
  }

  function mount(target) {
    if (typeof document === "undefined") return null;
    const host = typeof target === "string"
      ? document.querySelector(target)
      : target || document.querySelector("[data-graphic-prototype]");
    if (!host) return null;
    if (host.__hhGraphicPrototypeInstance) return host.__hhGraphicPrototypeInstance;
    injectStyles();
    const state = normalizeState(safeStorageRead());
    let history = [];
    let future = [];
    let drag = null;
    let gesture = null;
    let toastTimer = null;

    const currentFrame = () => state.frames.find((frame) => frame.id === state.currentFrameId) || state.frames[0];
    const selectedHotspot = () => currentFrame()?.hotspots.find((spot) => spot.id === state.selectedHotspotId) || null;
    const snapshot = () => clone({ ...state, mode: "design", currentFrameId: state.currentFrameId });
    const restore = (value) => {
      const restored = normalizeState(value);
      Object.keys(state).forEach((key) => delete state[key]);
      Object.assign(state, restored);
    };
    const persist = () => safeStorageWrite({ ...clone(state), mode: "design" });
    const pushHistory = (before) => {
      history = [...history.slice(-(MAX_HISTORY - 1)), before];
      future = [];
      persist();
    };
    const mutate = (callback) => {
      const before = snapshot();
      callback();
      pushHistory(before);
      render();
    };
    const showToast = (message) => {
      const old = host.querySelector(".hh-gd-toast");
      if (old) old.remove();
      const node = document.createElement("div");
      node.className = "hh-gd-toast";
      node.setAttribute("role", "status");
      node.textContent = message;
      host.append(node);
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => node.remove(), 2600);
    };
    const frameIndex = (id) => Math.max(0, state.frames.findIndex((frame) => frame.id === id));
    const frameName = (id) => state.frames.find((frame) => frame.id === id)?.name || "Frame không tồn tại";

    function render() {
      const frame = currentFrame();
      if (!frame) return;
      state.selectedHotspotId = frame.hotspots.some((spot) => spot.id === state.selectedHotspotId) ? state.selectedHotspotId : "";
      host.dataset.mode = state.mode;
      host.innerHTML = `
        <section class="hh-gd-prototype" data-mode="${esc(state.mode)}" aria-label="Thiết kế đồ họa - Prototype Studio">
          <header class="hh-gd-topbar">
            <div class="hh-gd-brand"><span class="hh-gd-mark">HH</span><div><strong>Prototype Studio</strong><small>Thiết kế đồ họa · local-first</small></div></div>
            <div class="hh-gd-toolbar-group"><button data-action="undo" title="Hoàn tác (Ctrl+Z)" ${history.length ? "" : "disabled"}>↶</button><button data-action="redo" title="Làm lại (Ctrl+Shift+Z)" ${future.length ? "" : "disabled"}>↷</button></div>
            <div class="hh-gd-toolbar-group"><label class="hh-gd-sr-only" for="hh-gd-device">Thiết bị xem trước</label><select id="hh-gd-device" class="hh-gd-select" data-action="device-change">${Object.entries(DEVICES).map(([id, device]) => `<option value="${id}" ${state.device === id ? "selected" : ""}>${esc(device.label)}</option>`).join("")}</select><button data-action="toggle-play" data-primary>${state.mode === "play" ? "Thoát preview" : "▶ Chạy prototype"}</button></div>
            <div class="hh-gd-toolbar-group"><button data-action="export">Xuất JSON</button><button data-action="import">Nhập</button><button data-action="copy-share">Chia sẻ</button><input class="hh-gd-import" type="file" accept="application/json" data-import-input></div>
          </header>
          <div class="hh-gd-layout">
            <aside class="hh-gd-panel" aria-label="Danh sách frame">
              <div class="hh-gd-panel-title"><div><strong>Flow frames</strong><small> ${state.frames.length}/${MAX_FRAMES}</small></div><span class="hh-gd-badge">${state.mode === "play" ? "PLAY" : "EDIT"}</span></div>
              <div class="hh-gd-frame-list">${state.frames.map((item) => `<button class="hh-gd-frame-item ${item.id === state.currentFrameId ? "is-active" : ""}" data-frame-id="${esc(item.id)}" aria-pressed="${item.id === state.currentFrameId}"><span class="hh-gd-frame-thumb" aria-hidden="true"></span><span class="hh-gd-frame-copy"><strong>${esc(item.name)}</strong><small>${item.width} × ${item.height} · ${item.hotspots.length} link</small></span></button>`).join("")}</div>
              <div class="hh-gd-frame-actions"><button data-action="add-frame">＋ Frame</button><button data-action="duplicate-frame">Nhân bản</button></div>
              <div class="hh-gd-frame-actions"><button data-action="delete-frame" data-danger>Xóa frame</button></div>
              <div class="hh-gd-section"><div class="hh-gd-panel-title"><div><strong>Prototype flow</strong><small>Điểm nối</small></div></div><div class="hh-gd-flow">${state.frames.flatMap((item) => item.hotspots.map((spot) => `<div class="hh-gd-flow-chip"><strong>${esc(spot.trigger)}</strong><span>${esc(item.name)} → ${esc(frameName(spot.targetFrameId))}</span></div>`)).slice(0, 12).join("") || `<p class="hh-gd-help">Thêm hotspot để tạo luồng.</p>`}</div></div>
              <div class="hh-gd-section"><strong>Phím tắt</strong><div class="hh-gd-shortcuts"><kbd>Ctrl Z</kbd><kbd>Ctrl Shift Z</kbd><kbd>Space</kbd><kbd>Delete</kbd></div></div>
            </aside>
            <main class="hh-gd-stage ${state.mode === "play" ? "is-play" : ""}" aria-live="polite">
              <div class="hh-gd-stage-top"><span>${state.mode === "play" ? "Prototype đang chạy · tương tác trực tiếp" : "Canvas preview · kéo hotspot để đặt vùng tương tác"}</span><span>${esc(frame.name)} · ${frame.width}×${frame.height}</span></div>
              <div class="hh-gd-preview" data-preview-frame="${esc(frame.id)}" data-bg="${esc(frame.background)}" style="width:${frame.width}px;height:${frame.height}px">
                <div class="hh-gd-preview-content"><span class="hh-gd-preview-kicker">HH CREATIVE SYSTEM</span><h2>${esc(frame.name)}</h2><p>Thiết kế prototype phản ứng theo click, hover, kéo thả và swipe.</p><div class="hh-gd-preview-card"><strong>${esc(state.variables.find((item) => item.name === "userName")?.value || "Người dùng")}</strong><span>Component state: ${esc(state.components[0]?.state || "default")}</span></div><div class="hh-gd-preview-bottom"><small>${state.mode === "play" ? "Chạm vào vùng sáng để chuyển frame" : "Kéo viền nét đứt để tạo flow"}</small><span class="hh-gd-preview-pill">Bắt đầu khám phá</span></div></div>
                ${frame.hotspots.map((spot) => `<button class="hh-gd-hotspot ${spot.id === state.selectedHotspotId ? "is-selected" : ""}" data-hotspot-id="${esc(spot.id)}" style="left:${spot.x}px;top:${spot.y}px;width:${spot.width}px;height:${spot.height}px" aria-label="${esc(spot.label)} · ${esc(spot.trigger)}"><span>${esc(spot.label)} · ${esc(spot.trigger)}</span></button>`).join("")}
              </div>
              <p class="hh-gd-stage-hint">${state.mode === "play" ? "Click / hover / drag / swipe lên hotspot để chạy flow" : "Chọn hotspot để chỉnh trigger, đích đến và component state"}</p>
            </main>
            <aside class="hh-gd-panel" aria-label="Inspector">
              <div class="hh-gd-panel-title"><div><strong>Inspector</strong><small>${esc(frame.name)}</small></div><span class="hh-gd-badge">LOCAL</span></div>
              <div class="hh-gd-inspector">
                <div class="hh-gd-field"><label for="hh-gd-frame-name">Tên frame</label><input id="hh-gd-frame-name" class="hh-gd-input" data-field="frame-name" value="${esc(frame.name)}"></div>
                <div class="hh-gd-grid-2"><div class="hh-gd-field"><label for="hh-gd-frame-width">Rộng</label><input id="hh-gd-frame-width" class="hh-gd-input" type="number" min="120" max="5000" data-field="frame-width" value="${frame.width}"></div><div class="hh-gd-field"><label for="hh-gd-frame-height">Cao</label><input id="hh-gd-frame-height" class="hh-gd-input" type="number" min="120" max="5000" data-field="frame-height" value="${frame.height}"></div></div>
                <div class="hh-gd-field"><label for="hh-gd-frame-bg">Nền canvas</label><select id="hh-gd-frame-bg" class="hh-gd-select" data-field="frame-background"><option value="aurora" ${frame.background === "aurora" ? "selected" : ""}>Aurora neon</option><option value="midnight" ${frame.background === "midnight" ? "selected" : ""}>Midnight ocean</option></select></div>
                <div class="hh-gd-section"><div class="hh-gd-panel-title"><div><strong>Hotspot / Link</strong><small>${selectedHotspot() ? "Đang chọn" : "Chưa chọn"}</small></div><button data-action="add-hotspot">＋</button></div>${renderHotspotInspector(selectedHotspot())}</div>
                <div class="hh-gd-section"><div class="hh-gd-panel-title"><div><strong>Variables</strong><small>Dynamic data</small></div><button data-action="add-variable">＋</button></div><div class="hh-gd-list">${state.variables.map((item) => `<div class="hh-gd-list-row"><input class="hh-gd-input" data-variable-id="${esc(item.id)}" data-variable-field="name" value="${esc(item.name)}" aria-label="Tên biến"><input class="hh-gd-input" data-variable-id="${esc(item.id)}" data-variable-field="value" value="${esc(item.value)}" aria-label="Giá trị biến"><button data-action="remove-variable" data-variable-id="${esc(item.id)}" title="Xóa biến">×</button></div>`).join("")}</div></div>
                <div class="hh-gd-section"><div class="hh-gd-panel-title"><div><strong>Component states</strong><small>State machine</small></div><button data-action="add-component">＋</button></div><div class="hh-gd-list">${state.components.map((item) => `<div class="hh-gd-list-row"><span class="hh-gd-help" style="flex:1">${esc(item.name)}</span><select class="hh-gd-select" data-component-id="${esc(item.id)}" data-component-field="state" aria-label="State của ${esc(item.name)}">${item.states.map((entry) => `<option value="${entry}" ${item.state === entry ? "selected" : ""}>${entry}</option>`).join("")}</select></div>`).join("")}</div></div>
              </div>
            </aside>
          </div>
          <footer class="hh-gd-statusbar"><span>● ${state.mode === "play" ? "Đang chạy prototype" : "Đã lưu local"}</span><span>Device: ${esc(DEVICES[state.device].label)} · ${history.length} thay đổi có thể hoàn tác</span></footer>
        </section>`;
    }

    function renderHotspotInspector(spot) {
      if (!spot) return `<p class="hh-gd-help">Chọn một vùng hotspot trên canvas hoặc tạo hotspot mới.</p>`;
      return `<div class="hh-gd-inspector"><div class="hh-gd-field"><label for="hh-gd-hotspot-label">Nhãn</label><input id="hh-gd-hotspot-label" class="hh-gd-input" data-hotspot-field="label" value="${esc(spot.label)}"></div><div class="hh-gd-grid-2"><div class="hh-gd-field"><label>Trigger</label><select class="hh-gd-select" data-hotspot-field="trigger">${TRIGGERS.map((trigger) => `<option value="${trigger}" ${spot.trigger === trigger ? "selected" : ""}>${trigger}</option>`).join("")}</select></div><div class="hh-gd-field"><label>Action</label><select class="hh-gd-select" data-hotspot-field="action"><option value="navigate" ${spot.action === "navigate" ? "selected" : ""}>Navigate</option><option value="set-variable" ${spot.action === "set-variable" ? "selected" : ""}>Set variable</option></select></div></div><div class="hh-gd-field"><label>Đi tới frame</label><select class="hh-gd-select" data-hotspot-field="targetFrameId">${state.frames.map((item) => `<option value="${esc(item.id)}" ${spot.targetFrameId === item.id ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select></div><div class="hh-gd-grid-2"><div class="hh-gd-field"><label>X</label><input class="hh-gd-input" type="number" data-hotspot-field="x" value="${spot.x}"></div><div class="hh-gd-field"><label>Y</label><input class="hh-gd-input" type="number" data-hotspot-field="y" value="${spot.y}"></div><div class="hh-gd-field"><label>Rộng</label><input class="hh-gd-input" type="number" data-hotspot-field="width" value="${spot.width}"></div><div class="hh-gd-field"><label>Cao</label><input class="hh-gd-input" type="number" data-hotspot-field="height" value="${spot.height}"></div></div><button data-action="delete-hotspot" data-danger>Xóa hotspot</button></div>`;
    }

    function addFrame(duplicate) {
      if (state.frames.length >= MAX_FRAMES) return showToast(`Đã đạt giới hạn ${MAX_FRAMES} frame`);
      mutate(() => {
        const source = currentFrame();
        const id = uid("frame");
        const copiedSpots = duplicate ? source.hotspots.map((spot) => ({ ...spot, id: uid("hotspot") })) : [];
        state.frames.push({ id, name: duplicate ? `${source.name} copy` : `Frame ${state.frames.length + 1}`, width: source.width, height: source.height, background: source.background, layers: duplicate ? source.layers.slice() : ["Tiêu đề", "Nội dung"], hotspots: copiedSpots });
        state.currentFrameId = id;
        state.selectedHotspotId = "";
      });
    }

    function deleteFrame() {
      if (state.frames.length <= 1) return showToast("Prototype cần ít nhất một frame");
      mutate(() => {
        const removed = state.currentFrameId;
        state.frames = state.frames.filter((frame) => frame.id !== removed);
        state.frames.forEach((frame) => frame.hotspots.forEach((spot) => { if (spot.targetFrameId === removed) spot.targetFrameId = state.frames[0].id; }));
        state.currentFrameId = state.frames[0].id;
        state.selectedHotspotId = "";
      });
    }

    function addHotspot() {
      mutate(() => {
        const frame = currentFrame();
        const target = state.frames.find((item) => item.id !== frame.id) || frame;
        const spot = { id: uid("hotspot"), label: "Hotspot mới", x: 44, y: Math.min(frame.height - 80, 620), width: Math.min(frame.width - 48, 280), height: 52, trigger: "click", targetFrameId: target.id, action: "navigate", componentId: state.components[0]?.id || "" };
        frame.hotspots.push(spot);
        state.selectedHotspotId = spot.id;
      });
    }

    function exportJson() {
      const payload = { ...clone(state), mode: "design", exportedAt: new Date().toISOString(), source: "HH Graphic Design Prototype Studio" };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "hh-graphic-prototype.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      showToast("Đã xuất prototype JSON");
    }

    function sharePayload() {
      const payload = btoa(unescape(encodeURIComponent(JSON.stringify({ ...clone(state), mode: "design" }))));
      const share = `hh-prototype:v1:${payload}`;
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(share).then(() => showToast("Đã copy share payload local-first")).catch(() => showToast("Đã tạo payload, clipboard bị chặn"));
      else showToast("Đã tạo share payload local-first");
      return share;
    }

    function undo() {
      const previous = history.pop();
      if (!previous) return;
      future.unshift(snapshot());
      restore(previous);
      persist();
      render();
    }

    function redo() {
      const next = future.shift();
      if (!next) return;
      history.push(snapshot());
      restore(next);
      persist();
      render();
    }

    function navigate(targetId) {
      if (!state.frames.some((item) => item.id === targetId)) return;
      state.currentFrameId = targetId;
      state.selectedHotspotId = "";
      render();
    }

    function handleAction(action, node) {
      if (action === "undo") return undo();
      if (action === "redo") return redo();
      if (action === "add-frame") return addFrame(false);
      if (action === "duplicate-frame") return addFrame(true);
      if (action === "delete-frame") return deleteFrame();
      if (action === "add-hotspot") return addHotspot();
      if (action === "delete-hotspot") return mutate(() => { currentFrame().hotspots = currentFrame().hotspots.filter((spot) => spot.id !== state.selectedHotspotId); state.selectedHotspotId = ""; });
      if (action === "toggle-play") { state.mode = state.mode === "play" ? "design" : "play"; state.selectedHotspotId = ""; render(); return; }
      if (action === "device-change") { state.device = node.value; persist(); render(); return; }
      if (action === "export") return exportJson();
      if (action === "copy-share") return sharePayload();
      if (action === "import") return host.querySelector("[data-import-input]")?.click();
      if (action === "add-variable") return mutate(() => state.variables.push({ id: uid("var"), name: `variable${state.variables.length + 1}`, value: "", type: "text" }));
      if (action === "remove-variable") return mutate(() => { state.variables = state.variables.filter((item) => item.id !== node.dataset.variableId); });
      if (action === "add-component") return mutate(() => state.components.push({ id: uid("component"), name: `Component ${state.components.length + 1}`, state: "default", states: COMPONENT_STATES.slice() }));
    }

    function updateField(field, value) {
      mutate(() => {
        const frame = currentFrame();
        if (field === "frame-name") frame.name = String(value).trim() || "Frame chưa đặt tên";
        if (field === "frame-width") frame.width = safeInt(value, frame.width, 120, 5000);
        if (field === "frame-height") frame.height = safeInt(value, frame.height, 120, 5000);
        if (field === "frame-background") frame.background = value === "midnight" ? "midnight" : "aurora";
      });
    }

    function updateHotspotField(field, value) {
      const spot = selectedHotspot();
      if (!spot) return;
      mutate(() => {
        if (field === "label") spot.label = String(value).trim() || "Hotspot";
        else if (field === "trigger") spot.trigger = TRIGGERS.includes(value) ? value : "click";
        else if (field === "action") spot.action = value === "set-variable" ? value : "navigate";
        else if (field === "targetFrameId") spot.targetFrameId = state.frames.some((item) => item.id === value) ? value : state.frames[0].id;
        else spot[field] = safeInt(value, spot[field], field === "width" || field === "height" ? 24 : 0, 5000);
      });
    }

    function handleInputChange(event) {
      const node = event.target;
      if (node.matches("[data-import-input]")) {
        const file = node.files?.[0];
        if (!file) return;
        file.text().then((text) => {
          try {
            const imported = JSON.parse(text);
            const before = snapshot();
            restore(imported);
            history = [...history.slice(-(MAX_HISTORY - 1)), before];
            future = [];
            persist();
            render();
            showToast("Đã nhập prototype JSON");
          } catch (_) { showToast("File JSON không hợp lệ"); }
        });
        return;
      }
      if (node.matches("[data-field]")) return updateField(node.dataset.field, node.value);
      if (node.matches("[data-hotspot-field]")) return updateHotspotField(node.dataset.hotspotField, node.value);
      if (node.matches("[data-variable-field]")) return mutate(() => { const item = state.variables.find((entry) => entry.id === node.dataset.variableId); if (item) item[node.dataset.variableField] = node.value; });
      if (node.matches("[data-component-field]")) return mutate(() => { const item = state.components.find((entry) => entry.id === node.dataset.componentId); if (item) item[node.dataset.componentField] = COMPONENT_STATES.includes(node.value) ? node.value : "default"; });
    }

    function beginDrag(event, node) {
      if (state.mode === "play") return;
      const spot = currentFrame().hotspots.find((item) => item.id === node.dataset.hotspotId);
      const preview = host.querySelector("[data-preview-frame]");
      if (!spot || !preview) return;
      event.preventDefault();
      state.selectedHotspotId = spot.id;
      drag = { id: spot.id, node, preview, before: snapshot(), offsetX: event.clientX, offsetY: event.clientY, startX: spot.x, startY: spot.y };
      node.setPointerCapture?.(event.pointerId);
    }

    function moveDrag(event) {
      if (!drag) return;
      const rect = drag.preview.getBoundingClientRect();
      const scale = rect.width / currentFrame().width || 1;
      const spot = currentFrame().hotspots.find((item) => item.id === drag.id);
      if (!spot) return;
      spot.x = clamp(Math.round(drag.startX + (event.clientX - drag.offsetX) / scale), 0, Math.max(0, currentFrame().width - spot.width));
      spot.y = clamp(Math.round(drag.startY + (event.clientY - drag.offsetY) / scale), 0, Math.max(0, currentFrame().height - spot.height));
      drag.node.style.left = `${spot.x}px`;
      drag.node.style.top = `${spot.y}px`;
    }

    function endDrag() {
      if (!drag) return;
      history = [...history.slice(-(MAX_HISTORY - 1)), drag.before];
      future = [];
      persist();
      drag = null;
      render();
    }

    function handleClick(event) {
      const actionNode = event.target.closest("[data-action]");
      if (actionNode && host.contains(actionNode)) return handleAction(actionNode.dataset.action, actionNode);
      const frameNode = event.target.closest("[data-frame-id]");
      if (frameNode && host.contains(frameNode)) { state.currentFrameId = frameNode.dataset.frameId; state.selectedHotspotId = ""; render(); return; }
      const hotspot = event.target.closest("[data-hotspot-id]");
      if (hotspot && host.contains(hotspot)) {
        const spot = currentFrame().hotspots.find((item) => item.id === hotspot.dataset.hotspotId);
        if (!spot) return;
        if (state.mode === "play" && spot.trigger === "click") return navigate(spot.targetFrameId);
        state.selectedHotspotId = spot.id;
        render();
      }
    }

    function handlePointerDown(event) {
      const hotspot = event.target.closest("[data-hotspot-id]");
      if (!hotspot || !host.contains(hotspot)) return;
      const spot = currentFrame().hotspots.find((item) => item.id === hotspot.dataset.hotspotId);
      if (!spot) return;
      if (state.mode === "play") { gesture = { id: spot.id, x: event.clientX, y: event.clientY }; return; }
      beginDrag(event, hotspot);
    }

    function handlePointerUp(event) {
      if (drag) return endDrag();
      if (!gesture || state.mode !== "play") return;
      const spot = currentFrame().hotspots.find((item) => item.id === gesture.id);
      const delta = Math.abs(event.clientX - gesture.x) + Math.abs(event.clientY - gesture.y);
      if (spot && ((spot.trigger === "drag" && delta > 8) || (spot.trigger === "swipe" && delta > 24))) navigate(spot.targetFrameId);
      gesture = null;
    }

    function handlePointerOver(event) {
      if (state.mode !== "play") return;
      const hotspot = event.target.closest("[data-hotspot-id]");
      if (!hotspot) return;
      const spot = currentFrame().hotspots.find((item) => item.id === hotspot.dataset.hotspotId);
      if (spot?.trigger === "hover") navigate(spot.targetFrameId);
    }

    function handleKeydown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); return event.shiftKey ? redo() : undo(); }
      if (event.key === " " && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) { event.preventDefault(); state.mode = state.mode === "play" ? "design" : "play"; render(); }
      if (event.key === "Delete" && state.mode === "design" && selectedHotspot()) handleAction("delete-hotspot", { dataset: {} });
    }

    const onClick = (event) => handleClick(event);
    const onChange = (event) => handleInputChange(event);
    const onPointerDown = (event) => handlePointerDown(event);
    const onPointerMove = (event) => moveDrag(event);
    const onPointerUp = (event) => handlePointerUp(event);
    const onPointerOver = (event) => handlePointerOver(event);
    const onKeydown = (event) => handleKeydown(event);
    host.addEventListener("click", onClick);
    host.addEventListener("change", onChange);
    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerup", onPointerUp);
    host.addEventListener("pointercancel", onPointerUp);
    host.addEventListener("pointerover", onPointerOver);
    host.addEventListener("keydown", onKeydown);
    host.tabIndex = -1;
    render();

    const instance = {
      state,
      render,
      exportJson,
      sharePayload,
      undo,
      redo,
      destroy() {
        host.removeEventListener("click", onClick);
        host.removeEventListener("change", onChange);
        host.removeEventListener("pointerdown", onPointerDown);
        host.removeEventListener("pointermove", onPointerMove);
        host.removeEventListener("pointerup", onPointerUp);
        host.removeEventListener("pointercancel", onPointerUp);
        host.removeEventListener("pointerover", onPointerOver);
        host.removeEventListener("keydown", onKeydown);
        clearTimeout(toastTimer);
        host.innerHTML = "";
        delete host.__hhGraphicPrototypeInstance;
      }
    };
    host.__hhGraphicPrototypeInstance = instance;
    return instance;
  }

  function unmount(target) {
    const host = typeof target === "string" ? document.querySelector(target) : target;
    host?.__hhGraphicPrototypeInstance?.destroy();
  }

  const api = { mount, unmount, STORAGE_KEY, DEVICES, TRIGGERS };
  if (typeof window !== "undefined") {
    window.HHGraphicPrototype = window.HHGraphicPrototype || api;
    if (document.querySelector("[data-graphic-prototype]")) mount();
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
}());
