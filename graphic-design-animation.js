(function graphicDesignAnimationFactory(globalScope) {
  "use strict";

  const hasDocument = Boolean(globalScope && typeof document !== "undefined");
  const SCHEMA_VERSION = 1;
  const FORMAT = "hh-graphic-animation-project";
  const INTERNAL_LOTTIE_FORMAT = "hh-lottie-like-compatibility";
  const MAX_HISTORY = 40;
  const MAX_KEYFRAMES = 300;
  const MAX_TRACKS = 80;
  const MAX_STATES = 30;
  const MAX_TRANSITIONS = 80;
  const TRIGGERS = ["click", "hover", "drag", "scroll", "data"];
  const EASINGS = ["linear", "easeIn", "easeOut", "easeInOut", "cubicIn", "cubicOut", "backOut", "elasticOut"];

  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const uid = (prefix = "id") => {
    const random = globalScope?.crypto?.randomUUID?.();
    return random ? `${prefix}-${random}` : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[character]));
  const validTrigger = (value) => TRIGGERS.includes(value) ? value : "click";
  const validEasing = (value) => EASINGS.includes(value) ? value : "linear";
  const isPlainObject = (value) => value && typeof value === "object" && !Array.isArray(value);

  function easingValue(name, progress) {
    const t = clamp(progress, 0, 1);
    switch (validEasing(name)) {
      case "easeIn": return t * t;
      case "easeOut": return 1 - ((1 - t) * (1 - t));
      case "easeInOut": return t < 0.5 ? 2 * t * t : 1 - (Math.pow(-2 * t + 2, 2) / 2);
      case "cubicIn": return t * t * t;
      case "cubicOut": return 1 - Math.pow(1 - t, 3);
      case "backOut": {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      }
      case "elasticOut": {
        if (t === 0 || t === 1) return t;
        return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
      }
      default: return t;
    }
  }

  function interpolateValue(left, right, progress) {
    const amount = clamp(progress, 0, 1);
    if (typeof left === "number" && typeof right === "number") return left + (right - left) * amount;
    if (Array.isArray(left) && Array.isArray(right) && left.length === right.length) return left.map((item, index) => interpolateValue(item, right[index], amount));
    if (isPlainObject(left) && isPlainObject(right)) {
      const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
      return Object.fromEntries([...keys].map((key) => [key, interpolateValue(left[key] ?? right[key], right[key] ?? left[key], amount)]));
    }
    return amount < 1 ? clone(left) : clone(right);
  }

  function normalizeKeyframe(raw, index = 0) {
    const value = raw?.value;
    return {
      id: String(raw?.id || uid("keyframe")),
      time: Math.max(0, Math.round(Number(raw?.time) || index * 500)),
      value: value === undefined ? 0 : clone(value),
      easing: validEasing(raw?.easing)
    };
  }

  function normalizeTrack(raw, index = 0) {
    const keyframes = Array.isArray(raw?.keyframes) ? raw.keyframes.slice(0, MAX_KEYFRAMES).map(normalizeKeyframe) : [normalizeKeyframe({ time: 0, value: 0 })];
    keyframes.sort((a, b) => a.time - b.time);
    return {
      id: String(raw?.id || uid("track")),
      name: String(raw?.name || `Track ${index + 1}`).slice(0, 120),
      targetId: String(raw?.targetId || "hero-card"),
      property: String(raw?.property || "x").slice(0, 80),
      muted: Boolean(raw?.muted),
      keyframes
    };
  }

  function normalizeState(raw, index = 0) {
    return {
      id: String(raw?.id || uid("state")),
      name: String(raw?.name || `State ${index + 1}`).slice(0, 80),
      description: String(raw?.description || "").slice(0, 240)
    };
  }

  function normalizeTransition(raw, index = 0, states = []) {
    const fallback = states[0]?.id || "rest";
    return {
      id: String(raw?.id || uid("transition")),
      from: String(raw?.from || fallback),
      to: String(raw?.to || states[1]?.id || fallback),
      trigger: validTrigger(raw?.trigger),
      condition: String(raw?.condition || "").slice(0, 180),
      duration: clamp(raw?.duration ?? 450, 0, 10000)
    };
  }

  function defaultProject() {
    const targets = [
      { id: "hero-card", name: "Hero Card", type: "card", x: 460, y: 220, width: 360, height: 190, color: "#ec4899", state: "rest" },
      { id: "orb", name: "Aurora Orb", type: "orb", x: 150, y: 110, width: 100, height: 100, color: "#64d7df", state: "rest" }
    ];
    return {
      schemaVersion: SCHEMA_VERSION,
      format: FORMAT,
      name: "Untitled Motion Study",
      duration: 5000,
      fps: 60,
      stage: { width: 920, height: 520, background: "#0b1020" },
      targets,
      tracks: [
        { id: "track-card-x", name: "Hero Card / X", targetId: "hero-card", property: "x", keyframes: [
          { id: "kf-card-x-0", time: 0, value: 460, easing: "easeOut" },
          { id: "kf-card-x-1", time: 1800, value: 510, easing: "easeInOut" },
          { id: "kf-card-x-2", time: 3600, value: 460, easing: "easeOut" }
        ] },
        { id: "track-card-rotation", name: "Hero Card / Rotation", targetId: "hero-card", property: "rotation", keyframes: [
          { id: "kf-card-r-0", time: 0, value: -3, easing: "easeInOut" },
          { id: "kf-card-r-1", time: 1800, value: 3, easing: "easeInOut" },
          { id: "kf-card-r-2", time: 3600, value: -3, easing: "easeInOut" }
        ] },
        { id: "track-orb-scale", name: "Aurora Orb / Scale", targetId: "orb", property: "scale", keyframes: [
          { id: "kf-orb-s-0", time: 0, value: 0.86, easing: "easeInOut" },
          { id: "kf-orb-s-1", time: 2500, value: 1.16, easing: "elasticOut" },
          { id: "kf-orb-s-2", time: 5000, value: 0.86, easing: "easeInOut" }
        ] }
      ],
      stateMachine: {
        initial: "rest",
        states: [
          { id: "rest", name: "Rest", description: "Trang thai mac dinh" },
          { id: "active", name: "Active", description: "Khi nguoi dung tuong tac" },
          { id: "dragging", name: "Dragging", description: "Khi keo doi tuong" }
        ],
        transitions: [
          { id: "transition-hover", from: "rest", to: "active", trigger: "hover", condition: "pointer enters stage", duration: 350 },
          { id: "transition-drag", from: "active", to: "dragging", trigger: "drag", condition: "pointer moves target", duration: 160 },
          { id: "transition-click", from: "active", to: "rest", trigger: "click", condition: "pointer clicks target", duration: 500 }
        ]
      },
      triggers: [{ type: "data", name: "progress", value: 0.7 }],
      meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    };
  }

  function normalizeProject(raw) {
    const base = defaultProject();
    const project = isPlainObject(raw) ? raw : {};
    const stage = isPlainObject(project.stage) ? project.stage : {};
    const targets = Array.isArray(project.targets) && project.targets.length ? project.targets : base.targets;
    const normalizedTargets = targets.slice(0, 80).map((target, index) => ({
      id: String(target?.id || uid("target")),
      name: String(target?.name || `Target ${index + 1}`).slice(0, 100),
      type: String(target?.type || "card").slice(0, 40),
      x: clamp(target?.x ?? 100, -10000, 10000),
      y: clamp(target?.y ?? 100, -10000, 10000),
      width: clamp(target?.width ?? 180, 8, 10000),
      height: clamp(target?.height ?? 100, 8, 10000),
      color: String(target?.color || "#64d7df").slice(0, 30),
      state: String(target?.state || "rest")
    }));
    const statesRaw = project.stateMachine?.states || base.stateMachine.states;
    const states = Array.isArray(statesRaw) && statesRaw.length ? statesRaw.slice(0, MAX_STATES).map(normalizeState) : base.stateMachine.states;
    const transitionsRaw = Array.isArray(project.stateMachine?.transitions) ? project.stateMachine.transitions : base.stateMachine.transitions;
    const transitions = transitionsRaw.slice(0, MAX_TRANSITIONS).map((item, index) => normalizeTransition(item, index, states));
    const stateIds = new Set(states.map((state) => state.id));
    transitions.forEach((transition) => {
      if (!stateIds.has(transition.from)) transition.from = states[0].id;
      if (!stateIds.has(transition.to)) transition.to = states[0].id;
    });
    const tracksRaw = Array.isArray(project.tracks) && project.tracks.length ? project.tracks : base.tracks;
    return {
      schemaVersion: SCHEMA_VERSION,
      format: FORMAT,
      name: String(project.name || base.name).slice(0, 140),
      duration: clamp(project.duration ?? base.duration, 100, 3600000),
      fps: clamp(project.fps ?? base.fps, 1, 240),
      stage: { width: clamp(stage.width ?? base.stage.width, 120, 4000), height: clamp(stage.height ?? base.stage.height, 80, 4000), background: String(stage.background || base.stage.background).slice(0, 40) },
      targets: normalizedTargets,
      tracks: tracksRaw.slice(0, MAX_TRACKS).map(normalizeTrack),
      stateMachine: { initial: stateIds.has(project.stateMachine?.initial) ? project.stateMachine.initial : states[0].id, states, transitions },
      triggers: Array.isArray(project.triggers) ? project.triggers.slice(0, 30).map((trigger) => ({ type: validTrigger(trigger?.type), name: String(trigger?.name || "Data trigger").slice(0, 80), value: clone(trigger?.value ?? 0) })) : clone(base.triggers),
      meta: { createdAt: String(project.meta?.createdAt || base.meta.createdAt), updatedAt: new Date().toISOString() }
    };
  }

  function createKeyframe(time, value, easing = "linear") {
    return normalizeKeyframe({ id: uid("keyframe"), time, value, easing });
  }

  function createState(name = "New State", description = "") {
    return normalizeState({ id: uid("state"), name, description });
  }

  function createTransition(from, to, trigger = "click", condition = "") {
    return normalizeTransition({ id: uid("transition"), from, to, trigger, condition, duration: 450 });
  }

  function valueAtKeyframes(keyframes, time) {
    const sorted = (keyframes || []).slice().sort((a, b) => a.time - b.time).map(normalizeKeyframe);
    if (!sorted.length) return 0;
    if (time <= sorted[0].time) return clone(sorted[0].value);
    const last = sorted[sorted.length - 1];
    if (time >= last.time) return clone(last.value);
    for (let index = 1; index < sorted.length; index += 1) {
      const right = sorted[index];
      if (time <= right.time) {
        const left = sorted[index - 1];
        const progress = easingValue(left.easing, (time - left.time) / Math.max(1, right.time - left.time));
        return interpolateValue(left.value, right.value, progress);
      }
    }
    return clone(last.value);
  }

  function evaluateAt(project, time) {
    const normalized = normalizeProject(project);
    const values = {};
    normalized.tracks.filter((track) => !track.muted).forEach((track) => {
      values[track.targetId] = values[track.targetId] || {};
      values[track.targetId][track.property] = valueAtKeyframes(track.keyframes, clamp(time, 0, normalized.duration));
    });
    return values;
  }

  function exportProject(project) {
    return JSON.stringify({ ...normalizeProject(project), exportedAt: new Date().toISOString(), exportFormat: FORMAT }, null, 2);
  }

  function exportLottieLike(project) {
    const normalized = normalizeProject(project);
    return JSON.stringify({
      format: INTERNAL_LOTTIE_FORMAT,
      compatibilityNote: "Internal HH mapping; not an official Lottie or dotLottie file.",
      schemaVersion: 1,
      name: normalized.name,
      fr: normalized.fps,
      ip: 0,
      op: Math.round((normalized.duration / 1000) * normalized.fps),
      w: normalized.stage.width,
      h: normalized.stage.height,
      layers: normalized.targets.map((target, index) => ({
        ind: index + 1,
        nm: target.name,
        ty: 4,
        ks: normalized.tracks.filter((track) => track.targetId === target.id).map((track) => ({ property: track.property, keyframes: track.keyframes }))
      }))
    }, null, 2);
  }

  const publicApi = {
    SCHEMA_VERSION,
    FORMAT,
    INTERNAL_LOTTIE_FORMAT,
    TRIGGERS,
    EASINGS,
    easingValue,
    interpolateValue,
    normalizeProject,
    createKeyframe,
    createState,
    createTransition,
    valueAtKeyframes,
    evaluateAt,
    exportProject,
    exportLottieLike
  };

  if (typeof module === "object" && module.exports) module.exports = publicApi;
  if (!hasDocument) return;

  const STORAGE_KEY = "hh.graphic-animation.project.v1";
  const STYLE_ID = "hh-graphic-animation-style";
  const text = (value, fallback = "") => String(value ?? fallback);
  const safeParse = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };
  const readProject = () => normalizeProject(safeParse(globalScope.localStorage?.getItem(STORAGE_KEY), defaultProject()));
  const saveProject = (project) => { const normalized = normalizeProject(project); globalScope.localStorage?.setItem(STORAGE_KEY, JSON.stringify(normalized)); return normalized; };
  const downloadJson = (filename, value) => { const blob = new Blob([value], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [data-graphic-animation]{--ga-bg:#080d18;--ga-panel:#101827;--ga-panel-2:#0c1320;--ga-border:#26364b;--ga-text:#e9f1ff;--ga-muted:#8b9ab0;--ga-cyan:#65d7df;--ga-pink:#ef62be;--ga-green:#74e4a5;display:block;color:var(--ga-text);font:500 13px/1.45 Inter,ui-sans-serif,system-ui,sans-serif;background:radial-gradient(circle at 80% -10%,rgba(239,98,190,.18),transparent 34%),radial-gradient(circle at 0% 0%,rgba(101,215,223,.13),transparent 36%),var(--ga-bg);border:1px solid var(--ga-border);border-radius:18px;overflow:hidden;box-shadow:0 22px 70px rgba(0,0,0,.28)}
      [data-graphic-animation] *{box-sizing:border-box}[data-graphic-animation] button,[data-graphic-animation] input,[data-graphic-animation] select,[data-graphic-animation] textarea{font:inherit}[data-graphic-animation] button{border:1px solid var(--ga-border);background:#121d2d;color:var(--ga-text);border-radius:8px;padding:7px 10px;cursor:pointer;transition:transform .18s,border-color .18s,background .18s}[data-graphic-animation] button:hover{border-color:var(--ga-cyan);background:#172b3b;transform:translateY(-1px)}[data-graphic-animation] button:focus-visible,[data-graphic-animation] input:focus-visible,[data-graphic-animation] select:focus-visible,[data-graphic-animation] textarea:focus-visible{outline:2px solid var(--ga-cyan);outline-offset:2px}[data-graphic-animation] input,[data-graphic-animation] select,[data-graphic-animation] textarea{width:100%;background:#09111d;border:1px solid var(--ga-border);border-radius:7px;color:var(--ga-text);padding:7px 8px}[data-graphic-animation] textarea{resize:vertical;min-height:70px}[data-graphic-animation] label{display:grid;gap:5px;color:var(--ga-muted);font-size:11px}[data-graphic-animation] kbd{border:1px solid #34465b;border-radius:4px;padding:1px 5px;color:var(--ga-cyan);font-size:10px}
      .ga-head{display:flex;align-items:center;gap:14px;padding:18px 20px;border-bottom:1px solid var(--ga-border);background:linear-gradient(110deg,rgba(101,215,223,.09),transparent 48%,rgba(239,98,190,.1))}.ga-logo{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,var(--ga-pink),var(--ga-cyan));color:#08101c;font-weight:900}.ga-head h2{margin:0;font-size:18px}.ga-head p{margin:3px 0 0;color:var(--ga-muted);font-size:12px}.ga-head-actions{margin-left:auto;display:flex;gap:7px;flex-wrap:wrap}.ga-primary{background:linear-gradient(135deg,var(--ga-cyan),#9bf0cd)!important;color:#07111b!important;border-color:transparent!important;font-weight:800}.ga-tabs{display:flex;gap:7px;padding:11px 16px;border-bottom:1px solid var(--ga-border);overflow:auto}.ga-tab.is-active{border-color:var(--ga-pink);box-shadow:0 0 0 1px rgba(239,98,190,.2) inset;background:linear-gradient(100deg,rgba(239,98,190,.18),rgba(101,215,223,.1))}.ga-main{display:grid;grid-template-columns:minmax(210px,260px) minmax(360px,1fr) minmax(220px,280px);min-height:690px}.ga-sidebar,.ga-inspector{background:rgba(9,15,25,.78);padding:14px;border-right:1px solid var(--ga-border)}.ga-inspector{border-right:0;border-left:1px solid var(--ga-border)}.ga-panel{padding:12px;border:1px solid var(--ga-border);border-radius:11px;background:rgba(16,24,39,.82);margin-bottom:12px}.ga-panel h3{margin:0 0 10px;font-size:12px;color:var(--ga-cyan);text-transform:uppercase;letter-spacing:.08em}.ga-stack{display:grid;gap:8px}.ga-row{display:flex;align-items:center;gap:7px}.ga-row>*:last-child{margin-left:auto}.ga-small{font-size:11px;color:var(--ga-muted)}.ga-list{display:grid;gap:6px}.ga-list button{display:flex;justify-content:space-between;text-align:left;width:100%;font-size:12px}.ga-list button.is-active{border-color:var(--ga-cyan);background:#142a35}.ga-stage-col{display:grid;grid-template-rows:auto minmax(360px,1fr) auto;background:#080d16}.ga-stage-toolbar,.ga-timeline-toolbar{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid var(--ga-border)}.ga-stage-wrap{display:grid;place-items:center;padding:18px;min-height:400px;overflow:auto;background:linear-gradient(45deg,rgba(255,255,255,.025) 25%,transparent 25%,transparent 75%,rgba(255,255,255,.025) 75%),linear-gradient(45deg,rgba(255,255,255,.025) 25%,transparent 25%,transparent 75%,rgba(255,255,255,.025) 75%);background-size:24px 24px;background-position:0 0,12px 12px}.ga-stage{position:relative;overflow:hidden;border:1px solid #365066;border-radius:8px;box-shadow:0 18px 60px rgba(0,0,0,.38);background:#0b1020;user-select:none}.ga-target{position:absolute;display:grid;place-items:center;transform-origin:center;cursor:grab;border:1px solid rgba(255,255,255,.42);color:#07101b;font-weight:800;transition:box-shadow .15s,border-color .15s}.ga-target:active{cursor:grabbing}.ga-target.is-selected{border:2px solid var(--ga-cyan);box-shadow:0 0 0 4px rgba(101,215,223,.18),0 0 32px rgba(101,215,223,.24)}.ga-target--card{border-radius:16px;background:linear-gradient(135deg,#ef62be,#8b75f5 55%,#65d7df);padding:20px;box-shadow:0 18px 40px rgba(239,98,190,.25)}.ga-target--orb{border-radius:50%;background:radial-gradient(circle at 30% 25%,#e7ffff,#65d7df 35%,#8b75f5 72%,#151b40);box-shadow:0 0 45px rgba(101,215,223,.48)}.ga-target--shape{border-radius:8px;background:var(--target-color)}.ga-target--text{background:transparent;color:var(--ga-text);font-size:24px}.ga-timeline{border-top:1px solid var(--ga-border);background:#0b121e}.ga-time-ruler{position:relative;height:24px;border-bottom:1px solid var(--ga-border);color:var(--ga-muted);font-size:9px}.ga-time-ruler span{position:absolute;top:5px;transform:translateX(-50%)}.ga-playhead{position:absolute;top:0;bottom:0;width:2px;background:var(--ga-pink);z-index:4;pointer-events:none}.ga-playhead::before{content:"";position:absolute;top:0;left:-4px;border:5px solid transparent;border-top-color:var(--ga-pink)}.ga-track-row{display:grid;grid-template-columns:180px minmax(300px,1fr);min-height:40px;border-bottom:1px solid #1a293b}.ga-track-label{display:flex;align-items:center;gap:6px;padding:7px 10px;border-right:1px solid var(--ga-border);overflow:hidden}.ga-track-label button{padding:3px 5px;font-size:10px}.ga-track-label span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ga-track-lane{position:relative;background:repeating-linear-gradient(90deg,transparent 0,transparent calc(20% - 1px),rgba(130,156,180,.12) calc(20% - 1px),rgba(130,156,180,.12) 20%)}.ga-keyframe{position:absolute;top:11px;width:13px;height:13px;border:2px solid var(--ga-cyan);background:#122333;transform:translateX(-50%) rotate(45deg);padding:0;border-radius:2px}.ga-keyframe.is-active{background:var(--ga-pink);border-color:#fff;box-shadow:0 0 14px var(--ga-pink)}.ga-footer{display:flex;align-items:center;gap:10px;padding:8px 12px;color:var(--ga-muted);font-size:11px;border-top:1px solid var(--ga-border)}.ga-inspector .ga-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ga-value-editor{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px}.ga-metric{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #1b2b3b;color:var(--ga-muted)}.ga-metric strong{color:var(--ga-text)}.ga-state{padding:8px;border:1px solid var(--ga-border);border-radius:8px;background:#0d1724}.ga-state.is-active{border-color:var(--ga-pink);background:rgba(239,98,190,.1)}.ga-state strong{display:block}.ga-state span{display:block;color:var(--ga-muted);font-size:10px;margin-top:2px}.ga-toast{position:fixed;right:22px;bottom:22px;z-index:30;max-width:340px;padding:10px 12px;border:1px solid var(--ga-cyan);border-radius:10px;background:#0b1623;box-shadow:0 12px 40px rgba(0,0,0,.35);color:var(--ga-text)}.ga-sr-only{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important}
      @media (max-width:1100px){.ga-main{grid-template-columns:220px minmax(340px,1fr)}.ga-inspector{grid-column:1/-1;border-left:0;border-top:1px solid var(--ga-border);display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.ga-inspector .ga-panel{margin:0}}@media (max-width:760px){.ga-head{align-items:flex-start;flex-wrap:wrap}.ga-head-actions{width:100%;margin-left:0}.ga-main{display:block}.ga-sidebar,.ga-inspector{border:0;border-bottom:1px solid var(--ga-border)}.ga-inspector{display:block}.ga-inspector .ga-panel{margin-bottom:12px}.ga-stage-wrap{min-height:330px;padding:10px}.ga-stage{transform-origin:center center}.ga-track-row{grid-template-columns:120px minmax(280px,1fr)}.ga-track-label{font-size:10px}.ga-tabs{padding-inline:10px}}
      @media (prefers-reduced-motion:reduce){[data-graphic-animation] *,[data-graphic-animation] *::before,[data-graphic-animation] *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.001ms!important}}
    `;
    document.head.appendChild(style);
  }

  function markup() {
    return `<header class="ga-head"><div class="ga-logo" aria-hidden="true">HH</div><div><h2>Thiet ke do hoa · Animation Studio</h2><p>Vector, timeline, state machine va interaction trong mot workspace local-first.</p></div><div class="ga-head-actions"><button type="button" data-ga-action="undo" title="Undo">Undo <kbd>Ctrl Z</kbd></button><button type="button" data-ga-action="redo" title="Redo">Redo <kbd>Ctrl Y</kbd></button><button type="button" data-ga-action="import">Import</button><button type="button" data-ga-action="export" class="ga-primary">Export project</button></div></header>
      <nav class="ga-tabs" role="tablist" aria-label="Animation workspace"><button class="ga-tab is-active" type="button" data-ga-tab="timeline">Timeline</button><button class="ga-tab" type="button" data-ga-tab="states">State Machine</button><button class="ga-tab" type="button" data-ga-tab="triggers">Interactions</button><button class="ga-tab" type="button" data-ga-tab="exports">Export & Schema</button></nav>
      <div class="ga-main"><aside class="ga-sidebar"><section class="ga-panel"><h3>Project</h3><div class="ga-stack"><label>Ten project<input data-ga-project-name value="Untitled Motion Study" maxlength="140"></label><div class="ga-grid"><label>Duration (ms)<input type="number" min="100" max="3600000" data-ga-duration value="5000"></label><label>FPS<input type="number" min="1" max="240" data-ga-fps value="60"></label></div><button type="button" data-ga-action="new-target">+ Add target</button></div></section><section class="ga-panel"><h3>Targets</h3><div class="ga-list" data-ga-target-list></div></section><section class="ga-panel"><h3>Tracks</h3><div class="ga-list" data-ga-track-list></div><button type="button" data-ga-action="new-track">+ Add track</button></section></aside><section class="ga-stage-col"><div class="ga-stage-toolbar"><button type="button" data-ga-action="play">Play <kbd>Space</kbd></button><button type="button" data-ga-action="stop">Stop</button><button type="button" data-ga-action="add-keyframe" class="ga-primary">+ Keyframe</button><label>Time <input type="number" min="0" data-ga-time style="width:90px" value="0"></label><span class="ga-small" data-ga-status aria-live="polite">Ready. Local preview only.</span></div><div class="ga-stage-wrap"><div class="ga-stage" data-ga-stage role="application" aria-label="Animation preview"></div></div><div class="ga-timeline"><div class="ga-timeline-toolbar"><strong>Timeline</strong><button type="button" data-ga-action="zoom-out">-</button><button type="button" data-ga-action="zoom-in">+</button><span class="ga-small" data-ga-play-state>Stopped</span></div><div class="ga-time-ruler" data-ga-ruler><div class="ga-playhead" data-ga-playhead></div></div><div data-ga-timeline-rows></div><div class="ga-footer"><span data-ga-time-readout>00:00.000</span><span>Click a lane to scrub · drag objects on stage</span><span class="ga-small" data-ga-storage-state>Local autosave</span></div></div></section><aside class="ga-inspector"><section class="ga-panel"><h3>Selected keyframe</h3><div class="ga-stack"><label>Time (ms)<input type="number" min="0" data-ga-kf-time></label><label>Easing<select data-ga-kf-easing>${EASINGS.map((easing) => `<option value="${easing}">${easing}</option>`).join("")}</select></label><label>Value<textarea class="ga-value-editor" data-ga-kf-value spellcheck="false"></textarea></label><div class="ga-row"><button type="button" data-ga-action="update-keyframe" class="ga-primary">Update</button><button type="button" data-ga-action="delete-keyframe">Delete</button></div></div></section><section class="ga-panel"><h3>State machine</h3><div class="ga-stack" data-ga-state-list></div><div class="ga-row"><button type="button" data-ga-action="new-state">+ State</button><button type="button" data-ga-action="new-transition">+ Transition</button></div></section><section class="ga-panel"><h3>Runtime</h3><div class="ga-metric"><span>Preview</span><strong data-ga-metric-preview>Idle</strong></div><div class="ga-metric"><span>Current state</span><strong data-ga-metric-state>Rest</strong></div><div class="ga-metric"><span>Tracks</span><strong data-ga-metric-tracks>0</strong></div><div class="ga-metric"><span>Keyframes</span><strong data-ga-metric-keyframes>0</strong></div><div class="ga-metric"><span>Trigger</span><strong data-ga-metric-trigger>click</strong></div></section></aside></div><div class="ga-toast" data-ga-toast hidden></div><input type="file" accept="application/json,.json" data-ga-import-file hidden>`;
  }

  function formatTime(milliseconds) { const value = Math.max(0, Math.round(Number(milliseconds) || 0)); return `${String(Math.floor(value / 60000)).padStart(2, "0")}:${String(Math.floor((value % 60000) / 1000)).padStart(2, "0")}.${String(value % 1000).padStart(3, "0")}`; }
  function parseValue(value) { const trimmed = String(value ?? "").trim(); if (!trimmed) return 0; try { return JSON.parse(trimmed); } catch { const number = Number(trimmed); return Number.isFinite(number) ? number : trimmed; } }
  function stateName(project, id) { return project.stateMachine.states.find((state) => state.id === id)?.name || id; }

  function mount(root) {
    if (!root || root.dataset.graphicAnimationMounted === "true") return root?.__hhGraphicAnimation || null;
    root.dataset.graphicAnimationMounted = "true";
    addStyles();
    root.innerHTML = markup();
    const project = saveProject(readProject());
    const instance = { root, project, activeTab: "timeline", selectedTargetId: project.targets[0]?.id || null, selectedTrackId: project.tracks[0]?.id || null, selectedKeyframeId: project.tracks[0]?.keyframes[0]?.id || null, currentTime: 0, playing: false, raf: 0, lastFrame: 0, zoom: 1, stateId: project.stateMachine.initial, history: [], historyIndex: -1, dragging: null, mountedAt: Date.now() };
    root.__hhGraphicAnimation = instance;
    const remember = () => { instance.history.splice(instance.historyIndex + 1); instance.history.push(clone(instance.project)); if (instance.history.length > MAX_HISTORY) instance.history.shift(); instance.historyIndex = instance.history.length - 1; saveProject(instance.project); };
    instance.remember = remember;
    remember();
    const qs = (selector) => root.querySelector(selector);
    const qsa = (selector) => [...root.querySelectorAll(selector)];
    const status = (message) => { const node = qs("[data-ga-status]"); if (node) node.textContent = message; };
    const toast = (message) => { const node = qs("[data-ga-toast]"); if (!node) return; node.textContent = message; node.hidden = false; clearTimeout(instance.toastTimer); instance.toastTimer = setTimeout(() => { node.hidden = true; }, 2600); };
    const selectedTrack = () => instance.project.tracks.find((track) => track.id === instance.selectedTrackId);
    const selectedKeyframe = () => selectedTrack()?.keyframes.find((keyframe) => keyframe.id === instance.selectedKeyframeId);
    const renderTargets = () => {
      const stage = qs("[data-ga-stage]"); const scaleX = 1; stage.style.width = `${instance.project.stage.width * scaleX}px`; stage.style.height = `${instance.project.stage.height * scaleX}px`; stage.style.background = instance.project.stage.background; stage.innerHTML = "";
      const animated = evaluateAt(instance.project, instance.currentTime);
      instance.project.targets.forEach((target) => { const values = { x: target.x, y: target.y, rotation: 0, scale: 1, opacity: 1, ...(animated[target.id] || {}) }; const element = document.createElement("div"); element.className = `ga-target ga-target--${esc(target.type).replace(/[^a-z0-9_-]/gi, "") || "card"}${target.id === instance.selectedTargetId ? " is-selected" : ""}`; element.dataset.gaTarget = target.id; element.style.left = `${Number(values.x) || 0}px`; element.style.top = `${Number(values.y) || 0}px`; element.style.width = `${target.width}px`; element.style.height = `${target.height}px`; element.style.transform = `translate(-50%,-50%) rotate(${Number(values.rotation) || 0}deg) scale(${Number(values.scale) || 1})`; element.style.opacity = `${clamp(values.opacity ?? 1, 0, 1)}`; element.style.setProperty("--target-color", target.color); element.textContent = target.name; stage.appendChild(element); });
    };
    const renderTargetList = () => { const node = qs("[data-ga-target-list]"); node.innerHTML = instance.project.targets.map((target) => `<button type="button" class="${target.id === instance.selectedTargetId ? "is-active" : ""}" data-ga-select-target="${esc(target.id)}"><span>${esc(target.name)}</span><span class="ga-small">${esc(target.type)}</span></button>`).join(""); };
    const renderTrackList = () => { const node = qs("[data-ga-track-list]"); node.innerHTML = instance.project.tracks.map((track) => `<button type="button" class="${track.id === instance.selectedTrackId ? "is-active" : ""}" data-ga-select-track="${esc(track.id)}"><span>${esc(track.name)}</span><span class="ga-small">${track.keyframes.length}</span></button>`).join(""); };
    const renderRuler = () => { const ruler = qs("[data-ga-ruler]"); ruler.querySelectorAll("span").forEach((item) => item.remove()); const step = instance.project.duration <= 10000 ? 1000 : instance.project.duration / 10; for (let time = 0; time <= instance.project.duration; time += step) { const mark = document.createElement("span"); mark.textContent = formatTime(time).slice(3); mark.style.left = `${(time / instance.project.duration) * 100}%`; ruler.appendChild(mark); } qs("[data-ga-playhead]").style.left = `${(instance.currentTime / instance.project.duration) * 100}%`; };
    const renderTimeline = () => { const rows = qs("[data-ga-timeline-rows]"); rows.innerHTML = instance.project.tracks.map((track) => `<div class="ga-track-row"><div class="ga-track-label"><button type="button" data-ga-mute-track="${track.id}" aria-label="Mute track">${track.muted ? "M" : "A"}</button><span>${esc(track.name)}</span></div><div class="ga-track-lane" data-ga-lane="${track.id}">${track.keyframes.map((keyframe) => `<button type="button" class="ga-keyframe ${keyframe.id === instance.selectedKeyframeId ? "is-active" : ""}" style="left:${(keyframe.time / instance.project.duration) * 100}%" data-ga-select-keyframe="${keyframe.id}" data-ga-track="${track.id}" title="${formatTime(keyframe.time)}"></button>`).join("")}</div></div>`).join(""); renderRuler(); };
    const renderStates = () => { const node = qs("[data-ga-state-list]"); node.innerHTML = instance.project.stateMachine.states.map((state) => `<div class="ga-state ${state.id === instance.stateId ? "is-active" : ""}"><strong>${esc(state.name)}</strong><span>${esc(state.description || "No description")}</span><div class="ga-row"><button type="button" data-ga-set-state="${esc(state.id)}">Preview</button><button type="button" data-ga-delete-state="${esc(state.id)}">Delete</button></div></div>`).join(""); qs("[data-ga-metric-state]").textContent = stateName(instance.project, instance.stateId); };
    const renderInspector = () => { const keyframe = selectedKeyframe(); qs("[data-ga-kf-time]").value = keyframe?.time ?? instance.currentTime; qs("[data-ga-kf-easing]").value = keyframe?.easing || "linear"; qs("[data-ga-kf-value]").value = keyframe ? JSON.stringify(keyframe.value) : ""; qs("[data-ga-metric-tracks]").textContent = String(instance.project.tracks.length); qs("[data-ga-metric-keyframes]").textContent = String(instance.project.tracks.reduce((sum, track) => sum + track.keyframes.length, 0)); qs("[data-ga-metric-trigger]").textContent = instance.project.stateMachine.transitions.find((transition) => transition.to === instance.stateId)?.trigger || "click"; };
    const render = () => { qs("[data-ga-project-name]").value = instance.project.name; qs("[data-ga-duration]").value = instance.project.duration; qs("[data-ga-fps]").value = instance.project.fps; qsa("[data-ga-tab]").forEach((button) => button.classList.toggle("is-active", button.dataset.gaTab === instance.activeTab)); renderTargetList(); renderTrackList(); renderTimeline(); renderTargets(); renderStates(); renderInspector(); qs("[data-ga-time]").value = Math.round(instance.currentTime); qs("[data-ga-time-readout]").textContent = formatTime(instance.currentTime); qs("[data-ga-play-state]").textContent = instance.playing ? "Playing" : "Stopped"; qs("[data-ga-metric-preview]").textContent = instance.playing ? "Playing" : "Idle"; };
    const setTime = (value) => { instance.currentTime = clamp(value, 0, instance.project.duration); render(); };
    const updateKeyframe = () => { const track = selectedTrack(); const keyframe = selectedKeyframe(); if (!track || !keyframe) return toast("Select a keyframe first."); keyframe.time = clamp(qs("[data-ga-kf-time]").value, 0, instance.project.duration); keyframe.easing = validEasing(qs("[data-ga-kf-easing]").value); keyframe.value = parseValue(qs("[data-ga-kf-value]").value); track.keyframes.sort((a, b) => a.time - b.time); instance.remember(); render(); toast("Keyframe updated locally."); };
    const addKeyframe = () => { const track = selectedTrack(); if (!track) return toast("Create or select a track first."); if (track.keyframes.length >= MAX_KEYFRAMES) return toast("Track keyframe limit reached."); const current = evaluateAt(instance.project, instance.currentTime)[track.targetId]?.[track.property] ?? 0; const keyframe = createKeyframe(instance.currentTime, current, "easeInOut"); track.keyframes.push(keyframe); track.keyframes.sort((a, b) => a.time - b.time); instance.selectedKeyframeId = keyframe.id; instance.remember(); render(); toast("Keyframe added."); };
    const deleteKeyframe = () => { const track = selectedTrack(); if (!track || !selectedKeyframe()) return toast("Select a keyframe first."); if (track.keyframes.length <= 1) return toast("A track must keep one keyframe."); track.keyframes = track.keyframes.filter((keyframe) => keyframe.id !== instance.selectedKeyframeId); instance.selectedKeyframeId = track.keyframes[0].id; instance.remember(); render(); };
    const addTrack = () => { if (instance.project.tracks.length >= MAX_TRACKS) return toast("Track limit reached."); const target = instance.project.targets[0]; const property = ["x", "y", "rotation", "scale", "opacity"][instance.project.tracks.length % 5]; const track = normalizeTrack({ id: uid("track"), name: `${target?.name || "Target"} / ${property}`, targetId: target?.id || "hero-card", property, keyframes: [createKeyframe(0, property === "scale" || property === "opacity" ? 1 : target?.[property] || 0, "easeInOut")] }); instance.project.tracks.push(track); instance.selectedTrackId = track.id; instance.selectedKeyframeId = track.keyframes[0].id; instance.remember(); render(); };
    const addTarget = () => { const target = { id: uid("target"), name: `Target ${instance.project.targets.length + 1}`, type: "shape", x: 250, y: 220, width: 160, height: 100, color: "#f2d16b", state: instance.stateId }; instance.project.targets.push(target); instance.selectedTargetId = target.id; instance.remember(); render(); };
    const undo = () => { if (instance.historyIndex <= 0) return toast("Nothing to undo."); instance.historyIndex -= 1; instance.project = normalizeProject(instance.history[instance.historyIndex]); saveProject(instance.project); render(); };
    const redo = () => { if (instance.historyIndex >= instance.history.length - 1) return toast("Nothing to redo."); instance.historyIndex += 1; instance.project = normalizeProject(instance.history[instance.historyIndex]); saveProject(instance.project); render(); };
    const play = () => { if (instance.playing) return; instance.playing = true; instance.lastFrame = performance.now(); const frame = (now) => { if (!instance.playing) return; const delta = now - instance.lastFrame; instance.lastFrame = now; instance.currentTime += delta; if (instance.currentTime > instance.project.duration) instance.currentTime = 0; renderTargets(); renderRuler(); qs("[data-ga-time-readout]").textContent = formatTime(instance.currentTime); qs("[data-ga-play-state]").textContent = "Playing"; qs("[data-ga-metric-preview]").textContent = "Playing"; instance.raf = requestAnimationFrame(frame); }; instance.raf = requestAnimationFrame(frame); render(); };
    const stop = () => { instance.playing = false; cancelAnimationFrame(instance.raf); instance.currentTime = 0; render(); };
    const addState = () => { if (instance.project.stateMachine.states.length >= MAX_STATES) return toast("State limit reached."); const state = createState(`State ${instance.project.stateMachine.states.length + 1}`); instance.project.stateMachine.states.push(state); instance.remember(); render(); };
    const addTransition = () => { const states = instance.project.stateMachine.states; if (states.length < 2) return toast("Create at least two states first."); const transition = createTransition(states[0].id, states[1].id, TRIGGERS[(instance.project.stateMachine.transitions.length) % TRIGGERS.length], "user interaction"); instance.project.stateMachine.transitions.push(transition); instance.remember(); render(); toast(`Transition ${transition.trigger} created.`); };
    const importProject = (file) => { const reader = new FileReader(); reader.onload = () => { const parsed = safeParse(reader.result, null); if (!parsed || (parsed.format && parsed.format !== FORMAT)) return toast("Unsupported project schema."); instance.project = normalizeProject(parsed); instance.history = []; instance.historyIndex = -1; instance.selectedTrackId = instance.project.tracks[0]?.id || null; instance.selectedKeyframeId = instance.project.tracks[0]?.keyframes[0]?.id || null; instance.remember(); render(); toast("Project imported."); }; reader.readAsText(file); };
    const action = (name) => { if (name === "play") play(); else if (name === "stop") stop(); else if (name === "undo") undo(); else if (name === "redo") redo(); else if (name === "add-keyframe") addKeyframe(); else if (name === "delete-keyframe") deleteKeyframe(); else if (name === "update-keyframe") updateKeyframe(); else if (name === "new-track") addTrack(); else if (name === "new-target") addTarget(); else if (name === "new-state") addState(); else if (name === "new-transition") addTransition(); else if (name === "import") qs("[data-ga-import-file]").click(); else if (name === "export") downloadJson(`${instance.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "motion-project"}.json`, exportProject(instance.project)); else if (name === "zoom-in") { instance.zoom = Math.min(2, instance.zoom + .1); toast(`Timeline zoom ${Math.round(instance.zoom * 100)}%.`); } else if (name === "zoom-out") { instance.zoom = Math.max(.5, instance.zoom - .1); toast(`Timeline zoom ${Math.round(instance.zoom * 100)}%.`); } };
    root.addEventListener("click", (event) => { const target = event.target.closest("button,[data-ga-lane],[data-ga-stage]"); if (!target || !root.contains(target)) return; if (target.matches("[data-ga-action]")) return action(target.dataset.gaAction); if (target.matches("[data-ga-tab]")) { instance.activeTab = target.dataset.gaTab; toast(`${target.textContent.trim()} workspace selected.`); return render(); } if (target.matches("[data-ga-select-target]")) { instance.selectedTargetId = target.dataset.gaSelectTarget; render(); return; } if (target.matches("[data-ga-select-track]")) { instance.selectedTrackId = target.dataset.gaSelectTrack; instance.selectedKeyframeId = selectedTrack()?.keyframes[0]?.id || null; render(); return; } if (target.matches("[data-ga-select-keyframe]")) { instance.selectedTrackId = target.dataset.gaTrack; instance.selectedKeyframeId = target.dataset.gaSelectKeyframe; render(); return; } if (target.matches("[data-ga-lane]")) { const rect = target.getBoundingClientRect(); setTime(((event.clientX - rect.left) / rect.width) * instance.project.duration); return; } if (target.matches("[data-ga-set-state]")) { instance.stateId = target.dataset.gaSetState; instance.project.targets.forEach((item) => { item.state = instance.stateId; }); render(); return; } if (target.matches("[data-ga-delete-state]")) { if (instance.project.stateMachine.states.length <= 1) return toast("State machine must keep one state."); instance.project.stateMachine.states = instance.project.stateMachine.states.filter((state) => state.id !== target.dataset.gaDeleteState); instance.project.stateMachine.transitions = instance.project.stateMachine.transitions.filter((transition) => transition.from !== target.dataset.gaDeleteState && transition.to !== target.dataset.gaDeleteState); if (instance.stateId === target.dataset.gaDeleteState) instance.stateId = instance.project.stateMachine.initial; instance.remember(); render(); } if (target.matches("[data-ga-mute-track]")) { const track = instance.project.tracks.find((item) => item.id === target.dataset.gaMuteTrack); if (track) { track.muted = !track.muted; instance.remember(); render(); } } });
    root.addEventListener("input", (event) => { if (event.target.matches("[data-ga-time]")) setTime(event.target.value); if (event.target.matches("[data-ga-project-name]")) { instance.project.name = text(event.target.value).slice(0, 140); saveProject(instance.project); } if (event.target.matches("[data-ga-duration]")) { instance.project.duration = clamp(event.target.value, 100, 3600000); instance.currentTime = Math.min(instance.currentTime, instance.project.duration); instance.remember(); render(); } if (event.target.matches("[data-ga-fps]")) { instance.project.fps = clamp(event.target.value, 1, 240); instance.remember(); render(); } });
    root.addEventListener("change", (event) => { if (event.target.matches("[data-ga-import-file]") && event.target.files[0]) importProject(event.target.files[0]); });
    root.addEventListener("keydown", (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); } else if (event.code === "Space" && !/input|textarea|select/i.test(event.target.tagName)) { event.preventDefault(); instance.playing ? stop() : play(); } });
    const stage = qs("[data-ga-stage]"); stage.addEventListener("pointerdown", (event) => { const element = event.target.closest("[data-ga-target]"); if (!element) return; const target = instance.project.targets.find((item) => item.id === element.dataset.gaTarget); if (!target) return; instance.selectedTargetId = target.id; instance.dragging = { target, startX: event.clientX, startY: event.clientY, originalX: target.x, originalY: target.y }; element.setPointerCapture?.(event.pointerId); instance.stateId = instance.project.stateMachine.transitions.find((transition) => transition.trigger === "drag")?.to || instance.stateId; render(); });
    stage.addEventListener("pointermove", (event) => { if (!instance.dragging) return; const rect = stage.getBoundingClientRect(); const factorX = instance.project.stage.width / rect.width; const factorY = instance.project.stage.height / rect.height; instance.dragging.target.x = instance.dragging.originalX + (event.clientX - instance.dragging.startX) * factorX; instance.dragging.target.y = instance.dragging.originalY + (event.clientY - instance.dragging.startY) * factorY; renderTargets(); });
    stage.addEventListener("pointerup", () => { if (instance.dragging) { instance.remember(); instance.dragging = null; render(); } });
    stage.addEventListener("pointerenter", () => { const transition = instance.project.stateMachine.transitions.find((item) => item.trigger === "hover"); if (transition) { instance.stateId = transition.to; renderStates(); renderInspector(); } });
    stage.addEventListener("click", (event) => { if (!event.target.closest("[data-ga-target]")) return; const transition = instance.project.stateMachine.transitions.find((item) => item.trigger === "click"); if (transition) { instance.stateId = transition.to; renderStates(); renderInspector(); } });
    render();
    return instance;
  }

  function mountAll() { document.querySelectorAll("[data-graphic-animation]").forEach(mount); }
  globalScope.HHGraphicAnimation = { ...publicApi, mount, mountAll };
  if (typeof window !== "undefined") window.HHGraphicAnimation = globalScope.HHGraphicAnimation;
  addStyles();
  mountAll();
  new MutationObserver(mountAll).observe(document.documentElement, { childList: true, subtree: true });
})(typeof window !== "undefined" ? window : null);
