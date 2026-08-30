const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "galaxy-domain-views.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "galaxy-domain-views.css"), "utf8");
const documentation = fs.readFileSync(path.join(root, "docs", "HH_GALAXY_ROUTE_CAPABILITIES.md"), "utf8");

function createAmbientLifecycleHarness() {
  let now = 1_800_000_000_000;
  let audioContexts = 0;
  let audioCloses = 0;
  let nodeStarts = 0;
  let nodeStops = 0;
  let nextInterval = 1;
  const intervals = new Map();
  const mediaEvents = [];
  const rootListeners = new Map();
  const documentListeners = new Map();
  const windowListeners = new Map();
  const storage = new Map();

  const listenerTarget = (listeners, extra = {}) => Object.assign({
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); }
  }, extra);

  const rootNode = listenerTarget(rootListeners, {
    classList: { add() {}, remove() {} },
    dataset: {},
    innerHTML: "",
    replaced: false,
    querySelector() { return null; },
    querySelectorAll() { return []; },
    replaceChildren() { this.innerHTML = ""; this.replaced = true; }
  });
  const documentNode = listenerTarget(documentListeners, { hidden: false });

  const audioParam = (value = 0) => ({
    value,
    setTargetAtTime(next) { this.value = next; }
  });
  const audioNode = (extra = {}) => Object.assign({
    connect() {},
    disconnect() {},
    start() { nodeStarts += 1; },
    stop() { nodeStops += 1; }
  }, extra);

  class FakeAudioContext {
    constructor() {
      audioContexts += 1;
      this.sampleRate = 16;
      this.currentTime = 0;
      this.destination = {};
      this.state = "suspended";
    }
    createGain() { return audioNode({ gain: audioParam(1) }); }
    createAnalyser() { return audioNode({ fftSize: 512, getByteTimeDomainData() {} }); }
    createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    createBufferSource() { return audioNode({ buffer: null, loop: false }); }
    createBiquadFilter() { return audioNode({ type: "lowpass", frequency: audioParam(0) }); }
    createOscillator() { return audioNode({ type: "sine", frequency: audioParam(0) }); }
    resume() { this.state = "running"; return Promise.resolve(); }
    close() { this.state = "closed"; audioCloses += 1; return Promise.resolve(); }
  }

  class FakeDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }

  class FakeCustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  }

  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
  };
  const windowNode = listenerTarget(windowListeners, {
    AudioContext: FakeAudioContext,
    CustomEvent: FakeCustomEvent,
    Date: FakeDate,
    document: documentNode,
    localStorage,
    location: { hash: "#/music/ambient", href: "http://127.0.0.1/#/music/ambient" },
    navigator: { onLine: true },
    requestAnimationFrame() { return 1; },
    cancelAnimationFrame() {},
    setInterval(callback) { const id = nextInterval++; intervals.set(id, callback); return id; },
    clearInterval(id) { intervals.delete(id); },
    dispatchEvent(event) { mediaEvents.push(event); return true; }
  });

  vm.runInNewContext(source, {
    window: windowNode,
    globalThis: windowNode,
    URL,
    Date: FakeDate,
    console
  });

  return {
    api: windowNode.HHGalaxyDomainViews,
    root: rootNode,
    click(selector) {
      const target = { closest(candidate) { return candidate === selector ? target : null; } };
      rootListeners.get("click")({ target, preventDefault() {} });
    },
    advance(milliseconds) {
      now += milliseconds;
      [...intervals.values()].forEach((callback) => callback());
    },
    metrics: {
      get audioContexts() { return audioContexts; },
      get audioCloses() { return audioCloses; },
      get nodeStarts() { return nodeStarts; },
      get nodeStops() { return nodeStops; },
      get intervalCount() { return intervals.size; },
      get listenerCount() { return rootListeners.size + documentListeners.size + windowListeners.size; },
      mediaEvents
    }
  };
}

function createDomainHarness({ route = "/work/automation-lab", capabilities = {}, estimate } = {}) {
  const rootListeners = new Map();
  const documentListeners = new Map();
  const windowListeners = new Map();
  const elements = new Map();
  const flowStyles = new Map();
  const canvasStage = { style: {} };
  const canvasViewport = {
    clientWidth: 1000,
    get scrollWidth() { return Number.parseInt(canvasStage.style.width, 10) || this.clientWidth; }
  };
  const canvasFlow = {
    offsetWidth: 1000,
    scrollWidth: 1000,
    offsetHeight: 400,
    scrollHeight: 400,
    style: { setProperty(name, value) { flowStyles.set(name, value); } }
  };
  const storage = new Map();
  const listenerTarget = (listeners, extra = {}) => Object.assign({
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); }
  }, extra);
  const rootNode = listenerTarget(rootListeners, {
    classList: { add() {}, remove() {} },
    dataset: {},
    innerHTML: "",
    contains() { return true; },
    querySelector(selector) {
      if (selector === "[data-gdv-canvas-zoom-value]") {
        if (!elements.has(selector)) elements.set(selector, { textContent: "100%", setAttribute(name, value) { this[name] = value; } });
        return elements.get(selector);
      }
      if (selector === "[data-gdv-canvas-viewport]") return canvasViewport;
      if (selector === "[data-gdv-canvas-stage]") return canvasStage;
      if (selector === ".gdv-node-flow--blueprint") return canvasFlow;
      if (selector === "[data-gdv-live]") return null;
      if (selector === ".gdv-storage-card .gdv-status") {
        if (!elements.has(selector)) elements.set(selector, { className: "", lastChild: { textContent: "" } });
        return elements.get(selector);
      }
      if (selector === "[data-gdv-storage-note]") {
        if (!elements.has(selector)) elements.set(selector, { textContent: "" });
        return elements.get(selector);
      }
      return null;
    },
    querySelectorAll() { return []; },
    replaceChildren() { this.innerHTML = ""; }
  });
  const documentNode = listenerTarget(documentListeners, { hidden: false });
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
  };
  const windowNode = listenerTarget(windowListeners, {
    document: documentNode,
    localStorage,
    location: { hash: `#${route}`, href: `http://127.0.0.1/#${route}` },
    navigator: { onLine: true, storage: estimate ? { estimate } : undefined },
    requestAnimationFrame(callback) { callback(); return 1; },
    cancelAnimationFrame() {},
    setInterval() { return 1; },
    clearInterval() {}
  });
  vm.runInNewContext(source, { window: windowNode, globalThis: windowNode, URL, Date, console });
  const controller = windowNode.HHGalaxyDomainViews.mount(rootNode, { route, capabilities });
  return {
    api: windowNode.HHGalaxyDomainViews,
    controller,
    root: rootNode,
    click(selector, dataset = {}) {
      const target = { dataset, closest(candidate) { return candidate === selector ? target : null; } };
      rootListeners.get("click")({ target, preventDefault() {} });
    },
    element(selector) { return elements.get(selector); },
    flowStyles,
    canvasStage,
    canvasViewport
  };
}

test("domain views expose the required lifecycle contract", () => {
  assert.match(source, /global\.HHGalaxyDomainViews\s*=\s*api/);
  for (const method of ["mount", "unmount", "canHandle", "getState"]) {
    assert.match(source, new RegExp(`\\b${method}\\b`), `missing ${method}`);
  }
  assert.match(source, /const instances = new WeakMap\(\)/);
  assert.match(source, /Object\.freeze\(\{\s*version:[\s\S]+mount,[\s\S]+unmount,[\s\S]+canHandle,[\s\S]+getState/);
});

test("canonical routes use the existing HH Platform destinations", () => {
  const canonicalRoutes = [
    "/create/workflow",
    "/work/automation-lab",
    "/work/projects-tasks",
    "/communication/community",
    "/music/ambient",
    "/system/desktop"
  ];
  canonicalRoutes.forEach((route) => assert.match(source, new RegExp(route.replaceAll("/", "\\/")), `missing ${route}`));
  assert.match(source, /aliases:\s*Object\.freeze/);
  assert.match(source, /options\.includeAliases !== false/);
  assert.doesNotMatch(source, /aliases:\s*Object\.freeze\(\["\/create\/ai-automation"/);
  assert.doesNotMatch(source, /aliases:\s*Object\.freeze\(\["\/music-ai\/ambient-room"/);
  assert.match(source, /data-gdv-route=/);
  assert.match(source, /data-gdv-engine=/);
  assert.match(source, /function launchEngine\(instance, engineId\)/);
  assert.doesNotMatch(source, /data-gdv-route="\/work\/automation-lab"/);
  assert.doesNotMatch(source, /data-gdv-route="\/work\/projects-tasks"/);
  assert.doesNotMatch(source, /data-gdv-route="\/communication\/community"/);
  assert.doesNotMatch(source, /window\.open\s*\(/);
  assert.doesNotMatch(source, /<iframe/i);
});

test("capability states are explicit and fabricated metrics are absent", () => {
  for (const state of ["loading", "ready", "empty", "offline", "unsupported", "configuration-required", "degraded", "error"]) {
    assert.match(source, new RegExp(state), `missing ${state}`);
  }
  assert.match(source, /navigator\?\.storage\?\.estimate/);
  assert.match(source, /Không dùng phần trăm minh họa/);
  assert.match(source, /Không có tiến độ minh họa/);
  assert.match(source, /không xuất hiện khi backend chưa trả dữ liệu/);
  assert.match(source, /communityVerified/);
  assert.match(source, /health check chưa được adapter tích hợp xác nhận/);
  assert.doesNotMatch(source, /12\.5K|99\.9%|78\.4 GB|1\.2K Users|89\.2K/);
});

test("external media URLs are protocol constrained before interpolation", () => {
  assert.match(source, /function safeMediaUrl\(value\)/);
  assert.match(source, /\["http:", "https:", "blob:"\]\.includes\(url\.protocol\)/);
  assert.doesNotMatch(source, /src=\\"\$\{escapeHtml\(item\.thumbnail\)\}/);
});

test("legacy data is read without rewriting its storage keys", () => {
  for (const key of ["hh.creative-os.v1", "hh-work-center-v2", "hh-project-center"]) {
    assert.match(source, new RegExp(key.replaceAll(".", "\\.")), `missing adapter ${key}`);
    assert.doesNotMatch(source, new RegExp(`setItem\\(\\s*["']${key.replaceAll(".", "\\.")}`), `must not overwrite ${key}`);
  }
  assert.match(source, /hh\.galaxy\.domain-views\.v1/);
});

test("Web Audio is interaction gated, real and cleaned up", () => {
  assert.match(source, /data-gdv-audio-toggle/);
  assert.match(source, /function startAmbientAudio\(instance\)/);
  assert.match(source, /new AudioContextCtor\(\)/);
  assert.match(source, /createAnalyser\(\)/);
  assert.match(source, /getByteTimeDomainData/);
  assert.match(source, /createGain\(\)/);
  assert.match(source, /function closeAudioContext\(context\)/);
  assert.match(source, /closeAudioContext\(audio\.context\)/);
  assert.match(source, /cancelAnimationFrame/);
  assert.match(source, /hh:media-playback/);
  assert.match(source, /source:\s*"galaxy-ambient-room"/);
  assert.match(source, /startedNodes\.forEach/);
  assert.match(source, /Promise\.resolve\(context\.resume\(\)\)/);
  assert.doesNotMatch(source, /startAmbientAudio\(instance\);\s*return \{/);
});

test("Ambient runtime gates AudioContext, tracks elapsed time and fully disposes resources", async () => {
  const harness = createAmbientLifecycleHarness();
  const controller = harness.api.mount(harness.root, { route: "/music/ambient" });

  assert.equal(harness.metrics.audioContexts, 0, "mount must not construct AudioContext");
  assert.equal(harness.metrics.intervalCount, 0, "mount must not start Pomodoro");

  harness.click("[data-gdv-audio-toggle]");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.metrics.audioContexts, 1);
  assert.equal(controller.getState().audio.active, true);
  assert.equal(controller.getState().audio.state, "running");
  assert.deepEqual(harness.metrics.mediaEvents.map((event) => event.detail.active), [true]);

  harness.click("[data-gdv-timer-toggle]");
  assert.equal(harness.metrics.intervalCount, 1);
  harness.advance(4_200);
  assert.equal(controller.getState().timer.remaining, 1496, "remaining time must derive from elapsed wall time");

  controller.unmount();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.metrics.intervalCount, 0);
  assert.equal(harness.metrics.audioCloses, 1);
  assert.equal(harness.metrics.nodeStops, harness.metrics.nodeStarts);
  assert.equal(harness.metrics.listenerCount, 0);
  assert.equal(harness.root.replaced, true);
  assert.deepEqual(harness.metrics.mediaEvents.map((event) => event.detail.active), [true, false]);
});

test("Web Desktop is opt-in and resource governed", () => {
  assert.match(source, /desktopEnabled:\s*raw\?\.desktopEnabled === true/);
  assert.match(source, /data-gdv-desktop-enable/);
  assert.match(source, /data-gdv-desktop-disable/);
  assert.match(source, /const MAX_DESKTOP_WINDOWS = 3/);
  assert.match(source, /while \(windows\.length > MAX_DESKTOP_WINDOWS\) windows\.shift\(\)/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /function updateDesktopVisibilityUi\(instance\)/);
  assert.doesNotMatch(source, /handleVisibility\(instance\)[\s\S]{0,500}updateDesktopStage\(instance\)/);
  assert.match(source, /Preview đang nghỉ/);
  assert.doesNotMatch(source, /\.mount\([^)]*gdv-desktop-window/);
});

test("mount owns listeners and unmount releases timers, audio and DOM", () => {
  assert.match(source, /instance\.cleanup\.push/);
  assert.match(source, /removeEventListener/);
  assert.match(source, /clearInterval/);
  assert.match(source, /stopAmbientAudio\(instance\)/);
  assert.match(source, /root\.replaceChildren\(\)/);
  assert.match(source, /instances\.delete\(root\)/);
  assert.match(source, /instance\.timer\.running && !instance\.timer\.interval/);
  assert.doesNotMatch(source, /if \(!instance\.timer\.interval\) instance\.timer\.interval/);
  assert.match(source, /completed \? "Đã hoàn thành"/);
  assert.match(source, /if \(instance\.timer\.running\) updateTimer\(instance\)/);
  assert.match(source, /function closeAudioContext\(context\)/);
  assert.match(source, /instance\.capabilities\.community = "offline";[\s\S]{0,120}render\(instance\)/);
});

test("views include keyboard and screen reader affordances", () => {
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /aria-current="page"/);
  assert.match(source, /aria-pressed=/);
  assert.match(source, /aria-label=/);
  assert.match(source, /role="table"/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /forced-colors:\s*active/);
});

test("golden-reference domain controls stay interactive and structurally anchored", () => {
  assert.match(source, /data-gdv-project-category/);
  assert.match(source, /data-gdv-mood/);
  assert.match(source, /function applyMood\(instance, mood\)/);
  assert.match(source, /class="gdv-automation-tabs"/);
  assert.match(source, /class="gdv-automation-features"/);
  assert.match(source, /class="gdv-canvas-viewport" data-gdv-canvas-viewport role="region" tabindex="0"/);
  assert.match(source, /class="gdv-canvas-stage" data-gdv-canvas-stage/);
  assert.match(source, /aria-controls="gdv-automation-blueprint"/);
  assert.match(source, /class="gdv-template-placeholder-list" aria-hidden="true"/);
  assert.match(source, /class="gdv-vault-placeholder-grid" aria-hidden="true"/);
  assert.match(source, /data-gdv-storage-ring/);
  assert.match(source, /data-gdv-storage-percent/);
  assert.match(source, /class="gdv-creator-dashboard"/);
  assert.match(source, /class="gdv-creator-placeholder-grid" aria-hidden="true"/);
  assert.match(source, /class="gdv-creator-metrics"/);
  assert.match(styles, /data-gdv-view="projects"\]\s+\.gdv-project-list\s*\{[^}]*overflow:\s*hidden/);
  assert.match(styles, /data-gdv-view="ambient"\][^\{]*\.gdv-scene-picker\s*\{[^}]*grid-column:\s*1\s*\/\s*-1[^}]*inset-inline:\s*clamp\(280px,\s*22vw,\s*372px\)/);
  assert.match(styles, /\.gdv-empty--vault\s*\{[^}]*backdrop-filter:\s*blur/);
  assert.match(styles, /\.gdv-automation-features\s*\{[^}]*grid-template-columns:\s*repeat\(8/);
  assert.match(styles, /\.gdv-canvas-viewport\s*\{[^}]*overflow:\s*auto[^}]*overscroll-behavior-inline:\s*contain[^}]*overscroll-behavior-block:\s*auto/);
  assert.match(styles, /data-gdv-view="automation"\][^\{]*\.gdv-template-empty-state\s+\.gdv-empty--compact[\s\S]{0,260}position:\s*static/);
  assert.match(styles, /data-gdv-view="projects"\][^\{]*\.gdv-vault-categories[\s\S]{0,220}scroll-snap-type:\s*x\s+proximity/);
  assert.match(styles, /\.gdv-cloud-readiness li > span:not\(\.gdv-status\)/);
  assert.doesNotMatch(styles, /\.gdv-cloud-readiness li > span\s*\{/);
  assert.match(styles, /@media \(min-width:\s*1221px\) and \(max-height:\s*850px\)[\s\S]*data-gdv-view="projects"[\s\S]*overflow-y:\s*visible/);
  assert.match(styles, /@media \(min-width:\s*1221px\) and \(max-height:\s*850px\)[\s\S]*data-gdv-view="ambient"[\s\S]*overflow-y:\s*visible/);
  assert.match(styles, /data-gdv-view="ambient"\]\s+\.gdv-orb::before\s*\{\s*inset:\s*3px;\s*transform:\s*none/);
  assert.match(styles, /\.gdv-mood-wave\s*\{[^}]*overflow:\s*clip/);
  assert.match(styles, /\.gdv-creator-pipeline\s+\.gdv-pipeline__grid\s*>\s*li:not\(:last-child\)::after\s*\{[^}]*right:\s*0/);
});

test("Automation blueprint zoom controls update their own canvas without launching an engine", () => {
  const harness = createDomainHarness();
  for (let index = 0; index < 5; index += 1) harness.click("[data-gdv-canvas-zoom]", { gdvCanvasZoom: "1" });
  assert.equal(harness.controller.getState().canvasZoom, 150);
  assert.equal(harness.element("[data-gdv-canvas-zoom-value]").textContent, "150%");
  assert.equal(harness.flowStyles.get("--gdv-canvas-scale"), "1.5");
  assert.equal(harness.canvasStage.style.width, "1500px");
  assert.equal(harness.canvasStage.style.height, "600px");
  assert.equal(harness.canvasViewport.scrollWidth, 1500, "zoom 150% must create a reachable horizontal scroll extent");
  assert.ok(harness.canvasViewport.scrollWidth > harness.canvasViewport.clientWidth);
  for (let index = 0; index < 10; index += 1) harness.click("[data-gdv-canvas-zoom]", { gdvCanvasZoom: "-1" });
  assert.equal(harness.controller.getState().canvasZoom, 50, "zoom must stay within the supported range");
  assert.equal(harness.canvasStage.style.width, "1000px", "zooming out must not shrink the focusable viewport below its container");
  harness.controller.unmount();
});

test("cloud provider readiness requires per-provider verification", () => {
  const generic = createDomainHarness({ route: "/work/projects-tasks", capabilities: { cloud: "ready" } });
  assert.equal(generic.controller.getState().capabilities.cloud, "ready");
  assert.equal(generic.controller.getState().capabilities.cloudProviders.drive, "configuration-required");
  generic.controller.unmount();

  const verified = createDomainHarness({ route: "/work/projects-tasks", capabilities: { cloud: "ready", cloudProviders: { drive: "ready" } } });
  assert.equal(verified.controller.getState().capabilities.cloudProviders.drive, "ready");
  assert.equal(verified.controller.getState().capabilities.cloudProviders.dropbox, "configuration-required");
  verified.controller.unmount();
});

test("invalid Pomodoro dataset values are rejected and Storage API failures leave loading state", async () => {
  const timer = createDomainHarness({ route: "/music/ambient" });
  timer.click("[data-gdv-timer-minutes]", { gdvTimerMinutes: "NaN" });
  assert.equal(timer.controller.getState().timer.remaining, 1500);
  timer.controller.unmount();

  const projects = createDomainHarness({ route: "/work/projects-tasks", estimate: () => Promise.reject(new Error("quota blocked")) });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(projects.controller.getState().capabilities.storageEstimate, "error");
  assert.equal(projects.element(".gdv-storage-card .gdv-status").className, "gdv-status gdv-status--error");
  projects.controller.unmount();
});

test("styles are scoped and responsive without broad element ownership", () => {
  assert.match(styles, /\[data-gdv-root\]/);
  assert.match(styles, /@media \(max-width: 1120px\)/);
  assert.match(styles, /@media \(max-width: 520px\)/);
  assert.doesNotMatch(styles, /(?:^|\n)\s*(?:html|body|:root)\s*\{/);
  assert.doesNotMatch(styles, /(?:^|\n)\s*(?:button|input|main|canvas)\s*\{/);
});

test("documentation records routes, honest capabilities and ownership", () => {
  assert.match(documentation, /Canonical route/i);
  assert.match(documentation, /\/work\/automation-lab/);
  assert.match(documentation, /configuration-required/);
  assert.match(documentation, /Không tạo dữ liệu giả/i);
  assert.match(documentation, /Web Audio/i);
  assert.match(documentation, /Resource Governor/i);
});
