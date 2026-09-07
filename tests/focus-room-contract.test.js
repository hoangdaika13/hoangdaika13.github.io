const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const rootDir = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(rootDir, file), "utf8");
const source = read("focus-room.js");
const styles = read("focus-room.css");
const router = read("script.js");
const loader = read("performance-loader.js");
const worker = read("sw.js");
const documentation = read("docs/HH_FOCUS_ROOM.md");

function createHarness() {
  let now = 1_800_000_000_000;
  let nextTimer = 1;
  let audioContexts = 0;
  let audioCloses = 0;
  let nodeStarts = 0;
  let nodeStops = 0;
  const storage = new Map();
  const intervals = new Map();
  const timeouts = new Map();
  const mediaEvents = [];
  const documentListeners = new Map();
  const windowListeners = new Map();

  const add = (listeners, type, listener) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(listener);
  };
  const remove = (listeners, type, listener) => listeners.get(type)?.delete(listener);
  const listenerTarget = (listeners, extra = {}) => Object.assign({
    addEventListener(type, listener) { add(listeners, type, listener); },
    removeEventListener(type, listener) { remove(listeners, type, listener); }
  }, extra);

  const documentNode = listenerTarget(documentListeners, { hidden: false, fullscreenElement: null });
  const audioParam = (value = 0) => ({ value, setTargetAtTime(next) { this.value = next; } });
  const audioNode = (extra = {}) => Object.assign({
    connect() {}, disconnect() {},
    start() { nodeStarts += 1; },
    stop() { nodeStops += 1; }
  }, extra);

  class FakeAudioContext {
    constructor() {
      audioContexts += 1;
      this.sampleRate = 12;
      this.currentTime = 0;
      this.destination = {};
    }
    createGain() { return audioNode({ gain: audioParam(1) }); }
    createBuffer(_channels, length, sampleRate = this.sampleRate) { return { duration: length / sampleRate, getChannelData: () => new Float32Array(length) }; }
    createBufferSource() { return audioNode({ buffer: null, loop: false }); }
    createBiquadFilter() { return audioNode({ type: "lowpass", frequency: audioParam(0), Q: audioParam(0) }); }
    createStereoPanner() { return audioNode({ pan: audioParam(0) }); }
    createOscillator() { return audioNode({ frequency: audioParam(0) }); }
    createDynamicsCompressor() {
      return audioNode({
        threshold: audioParam(-24), knee: audioParam(20), ratio: audioParam(4),
        attack: audioParam(0.03), release: audioParam(0.35)
      });
    }
    resume() { return Promise.resolve(); }
    suspend() { return Promise.resolve(); }
    close() { audioCloses += 1; return Promise.resolve(); }
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
    navigator: { deviceMemory: 8, hardwareConcurrency: 8 },
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame(callback) { callback(); return 1; },
    cancelAnimationFrame() {},
    setInterval(callback) { const timer = nextTimer++; intervals.set(timer, callback); return timer; },
    clearInterval(timer) { intervals.delete(timer); },
    setTimeout(callback) { const timer = nextTimer++; timeouts.set(timer, callback); return timer; },
    clearTimeout(timer) { timeouts.delete(timer); },
    dispatchEvent(event) { mediaEvents.push(event); return true; }
  });

  class FakeImage {
    set src(value) { this.currentSrc = value; }
  }

  vm.runInNewContext(source, {
    window: windowNode,
    globalThis: windowNode,
    Image: FakeImage,
    URL,
    Blob,
    Date: FakeDate,
    console
  });

  function createRoot() {
    const listeners = new Map();
    const root = listenerTarget(listeners, {
      dataset: {},
      innerHTML: "",
      querySelector() { return null; },
      querySelectorAll() { return []; },
      replaceChildren() { this.innerHTML = ""; }
    });
    return { root, listeners };
  }

  function createLayoutRoot() {
    const listeners = new Map();
    const style = () => ({ removeProperty(name) { delete this[name]; } });
    const app = { dataset: { motion: "off", quality: "balanced" } };
    const stage = listenerTarget(new Map(), {
      dataset: {}, style: style(),
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 1000, bottom: 700, width: 1000, height: 700 })
    });
    const items = {
      title: { style: style(), getBoundingClientRect: () => ({ left: 24, top: 20, right: 444, bottom: 150, width: 420, height: 130 }) },
      clock: { style: style(), getBoundingClientRect: () => ({ left: 300, top: 200, right: 700, bottom: 500, width: 400, height: 300 }) },
      dock: { style: style(), getBoundingClientRect: () => ({ left: 150, top: 620, right: 850, bottom: 680, width: 700, height: 60 }) }
    };
    const root = listenerTarget(listeners, {
      dataset: {}, innerHTML: "",
      querySelector(selector) {
        if (selector === "[data-hfr-root]") return app;
        if (selector === ".hfr-stage") return stage;
        const match = selector.match(/^\[data-hfr-layout-item="(title|clock|dock)"\]$/);
        return match ? items[match[1]] : null;
      },
      querySelectorAll() { return []; },
      replaceChildren() { this.innerHTML = ""; }
    });
    return { root, listeners, app, stage, items };
  }

  function dispatch(listeners, type, event) {
    [...(listeners.get(type) || [])].forEach((listener) => listener(event));
  }

  function click(entry, action, dataset = {}) {
    const target = {
      dataset: { hfrAction: action, ...dataset },
      closest(selector) { return selector === "[data-hfr-action]" ? this : null; }
    };
    dispatch(entry.listeners, "click", { target });
  }

  return {
    api: windowNode.HHFocusRoom,
    storage,
    documentNode,
    createRoot,
    createLayoutRoot,
    dispatch(entry, type, event) { dispatch(entry.listeners, type, event); },
    click,
    input(entry, selector, value) {
      const target = { value, dataset: {}, matches(candidate) { return candidate === selector; } };
      dispatch(entry.listeners, "input", { target });
    },
    setNow(value) { now = value; },
    advance(milliseconds) {
      now += milliseconds;
      [...intervals.values()].forEach((callback) => callback());
    },
    visibility(hidden) {
      documentNode.hidden = hidden;
      dispatch(documentListeners, "visibilitychange", {});
    },
    metrics: {
      get audioContexts() { return audioContexts; },
      get audioCloses() { return audioCloses; },
      get nodeStarts() { return nodeStarts; },
      get nodeStops() { return nodeStops; },
      get intervalCount() { return intervals.size; },
      get listenerCount() {
        return [...documentListeners.values(), ...windowListeners.values()].reduce((sum, listeners) => sum + listeners.size, 0);
      },
      mediaEvents
    }
  };
}

test("Focus Room upgrades the canonical HH Platform learning workspace", () => {
  assert.match(router, /route === "\/focus-room"/);
  assert.match(router, /window\.HHFocusRoom\?\.mount/);
  assert.match(router, /window\.HHFocusRoom\?\.unmount/);
  assert.match(router, /Phòng học tập trung/);
  assert.match(router, /26 scene nguyên bản/);
  assert.match(router, /Trong Học tập &amp; Ngôn ngữ/);
  assert.match(loader, /"focus-study-room":\s*\{[\s\S]*focus-room\.css\?v=5[\s\S]*focus-room\.js\?v=5/);
  assert.match(loader, /value === "\/focus-room"/);
  assert.match(worker, /\.\/focus-room\.css\?v=5/);
  assert.match(worker, /\.\/focus-room\.js\?v=5/);
  assert.doesNotMatch(source, /HH CORE|gateway|location\.href\s*=/i);
});

test("scene library ships twenty-six local full images and thumbnails with provenance", () => {
  const api = require("../focus-room.js");
  assert.equal(api.route, "/focus-room");
  assert.equal(api.scenes.length, 26);
  assert.equal(api.channels.length, 16);
  assert.equal(api.canHandle("/focus-room"), true);
  assert.equal(api.canHandle("/learn"), false);
  for (const scene of api.scenes) {
    for (const asset of [scene.image, scene.thumb]) {
      const fullPath = path.join(rootDir, asset);
      assert.equal(fs.existsSync(fullPath), true, `missing ${asset}`);
      assert.ok(fs.statSync(fullPath).size > 2_000, `empty ${asset}`);
    }
    assert.ok(scene.performance);
    assert.ok(scene.soundStatus);
  }
  assert.match(documentation, /LifeAt/);
  assert.match(documentation, /Ukiyo\.js[\s\S]*MIT/);
  assert.match(documentation, /ayoisaiah\/focus[\s\S]*MIT/);
  assert.match(read("assets/focus-room/README.md"), /SHA-256/);
  assert.match(read("assets/focus-room/README.md"), /rainy greenhouse[\s\S]*moonlit mountain observatory/i);
});

test("state is account scoped and favorites persist independently", () => {
  const harness = createHarness();
  const alice = harness.createRoot();
  const bob = harness.createRoot();
  const aliceController = harness.api.mount(alice.root, { currentUser: { email: "alice@example.test" } });
  const bobController = harness.api.mount(bob.root, { currentUser: { email: "bob@example.test" } });
  harness.click(alice, "favorite-scene", { id: "snow-cabin" });
  assert.deepEqual(Array.from(aliceController.getState().scenes.favorites), ["snow-cabin"]);
  assert.deepEqual(Array.from(bobController.getState().scenes.favorites), []);
  const accountKeys = [...harness.storage.keys()].filter((key) => /^hh\.focus-room\.v2\.account-/.test(key));
  assert.equal(accountKeys.length, 2);
  assert.ok(accountKeys.every((key) => !key.includes("alice") && !key.includes("bob")));
  const guest = harness.createRoot();
  harness.api.mount(guest.root, { currentUser: { id: "guest-browser-profile", guest: true } });
  assert.match(guest.root.innerHTML, /Lưu cục bộ · Khách/);
});

test("existing Focus Study Room data migrates into the immersive account state", () => {
  const harness = createHarness();
  harness.storage.set("hh.focus.study-room.v1:legacy-user", JSON.stringify({
    tasks: [{ id: "old-task", title: "Ôn Kanji", estimate: 3, done: false, createdAt: "2026-09-01T10:00:00.000Z" }],
    note: "Ghi chú từ phòng học cũ",
    history: [{ id: "old-session", mode: "focus", durationSeconds: 1500, startedAt: "2026-09-01T10:00:00.000Z", completedAt: "2026-09-01T10:25:00.000Z", taskId: "old-task" }],
    settings: { focusMinutes: 45, shortBreakMinutes: 15, longBreakMinutes: 20, longBreakEvery: 4, reducedMotion: true },
    sound: { rain: 0.4, brown: 0.2, cafe: 0.1 },
    timer: { mode: "focus", status: "paused", durationSeconds: 2700, remainingSeconds: 1200, taskId: "old-task", completedFocusCycles: 2 }
  }));
  const entry = harness.createRoot();
  const controller = harness.api.mount(entry.root, { currentUser: { id: "legacy-user" } });
  const state = controller.getState();
  assert.equal(state.note, "Ghi chú từ phòng học cũ");
  assert.equal(state.tasks[0].target, 3);
  assert.equal(state.primaryTaskId, "old-task");
  assert.equal(state.timer.focusMinutes, 45);
  assert.equal(state.timer.remaining, 1200);
  assert.equal(state.history[0].taskTitle, "Ôn Kanji");
  assert.equal(state.settings.reducedMotion, true);
  assert.ok([...harness.storage.keys()].some((key) => key.startsWith("hh.focus-room.v2.account-")));
});

test("audio starts only on direct action and releases every node on unmount", async () => {
  const harness = createHarness();
  const entry = harness.createRoot();
  harness.api.mount(entry.root, { currentUser: { id: "audio-user" } });
  assert.equal(harness.metrics.audioContexts, 0);
  harness.click(entry, "audio-toggle");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.metrics.audioContexts, 1);
  assert.ok(harness.metrics.nodeStarts >= 4, "active sources and slow modulation should start lazily");
  assert.equal(harness.metrics.mediaEvents.at(-1).detail.active, true);
  const runningNodes = harness.metrics.nodeStarts;
  harness.api.unmount(entry.root);
  assert.equal(harness.metrics.audioCloses, 1);
  assert.equal(harness.metrics.nodeStops, runningNodes);
  assert.equal(harness.metrics.mediaEvents.at(-1).detail.active, false);
});

test("wall-clock timer pauses polling when hidden and notes flush during navigation", () => {
  const harness = createHarness();
  const first = harness.createRoot();
  const controller = harness.api.mount(first.root, { currentUser: { id: "timer-user" } });
  harness.click(first, "timer-toggle");
  assert.equal(controller.getState().timer.running, true);
  const initialEnd = controller.getState().timer.endsAt;
  harness.advance(60_000);
  assert.equal(controller.getState().timer.remaining, 1440);
  assert.equal(controller.getState().timer.endsAt, initialEnd);
  harness.visibility(true);
  assert.equal(harness.metrics.intervalCount, 0);
  harness.advance(60_000);
  harness.visibility(false);
  assert.equal(controller.getState().timer.remaining, 1380);
  assert.equal(harness.metrics.intervalCount, 1);
  harness.input(first, "[data-hfr-note]", "Ghi chú phải sống sót khi đổi workspace");
  controller.unmount();

  const restoredRoot = harness.createRoot();
  const restored = harness.api.mount(restoredRoot.root, { currentUser: { id: "timer-user" } });
  assert.equal(restored.getState().note, "Ghi chú phải sống sót khi đổi workspace");
  assert.equal(restored.getState().timer.running, true);
});

test("two tabs record one completed focus session without overwriting history", () => {
  const harness = createHarness();
  const seedRoot = harness.createRoot();
  const seed = harness.api.mount(seedRoot.root, { currentUser: { id: "shared-timer" } });
  const state = seed.getState();
  seed.unmount();
  const stateKey = [...harness.storage.keys()].find((key) => key.startsWith("hh.focus-room.v2.account-"));
  Object.assign(state.timer, {
    phase: "focus", running: true, remaining: 1, duration: 1,
    endsAt: 1_800_000_001_000, startedAt: 1_800_000_000_000, sessionId: "same-session"
  });
  harness.storage.set(stateKey, JSON.stringify(state));
  harness.setNow(1_800_000_000_000);

  const tabOne = harness.createRoot();
  const tabTwo = harness.createRoot();
  harness.api.mount(tabOne.root, { currentUser: { id: "shared-timer" } });
  harness.api.mount(tabTwo.root, { currentUser: { id: "shared-timer" } });
  harness.advance(1_100);
  const stored = JSON.parse(harness.storage.get(stateKey));
  assert.equal(stored.history.length, 1);
  assert.equal(stored.history[0].id, "same-session");
});

test("responsive, motion and truthful capability contracts are explicit", () => {
  assert.match(styles, /@media \(max-width: 430px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /pointer-events:\s*none/);
  assert.match(styles, /focus-visible/);
  assert.match(styles, /\.hfr-panel[\s\S]*overflow:\s*auto/);
  assert.match(source, /document\?\.hidden/);
  assert.match(source, /context\?\.suspend|context\.suspend/);
  assert.match(source, /Chưa cấu hình/);
  assert.match(source, /không có thành viên hoặc phòng trực tuyến giả/i);
  assert.match(source, /heavy-rain/);
  assert.match(source, /lật sách/i);
  assert.match(source, /cafe-rain/);
  assert.match(source, /Phòng anime chạng vạng/);
  assert.match(source, /Nhà kính ngày mưa/);
  assert.match(source, /Hiên ruộng bậc thang/);
  assert.match(source, /Gác mái mưa cùng mèo/);
  assert.match(source, /Cabin hồ cùng cún nhỏ/);
  assert.match(source, /Mèo gừ êm/);
  assert.match(source, /Thú cưng ngủ/);
  assert.match(source, /createDynamicsCompressor/);
  assert.match(source, /createAudioVoice/);
  assert.match(source, /normalization/);
  assert.match(styles, /hfr-condensation/);
  assert.match(styles, /hfr-leaf-drift/);
  assert.match(styles, /hfr-pet-breathe/);
  assert.match(source, /data-hfr-task-edit-form/);
});

test("custom layout is persisted, bounded, keyboard accessible and zoom safe", () => {
  const harness = createHarness();
  const first = harness.createRoot();
  const controller = harness.api.mount(first.root, { currentUser: { id: "layout-user" } });
  assert.deepEqual(JSON.parse(JSON.stringify(controller.getState().layout)), {
    locked: true,
    clock: { x: 0, y: 0 },
    title: { x: 0, y: 0 },
    dock: { x: 0, y: 0 }
  });
  controller.unmount();

  const key = [...harness.storage.keys()].find((entry) => entry.startsWith("hh.focus-room.v2.account-"));
  const stored = JSON.parse(harness.storage.get(key));
  stored.layout = {
    locked: false,
    clock: { x: 8, y: -7 },
    title: { x: -0.45, y: 0.3 },
    dock: { x: "invalid", y: 0.6 }
  };
  harness.storage.set(key, JSON.stringify(stored));
  const restoredRoot = harness.createRoot();
  const restored = harness.api.mount(restoredRoot.root, { currentUser: { id: "layout-user" } }).getState().layout;
  assert.equal(restored.locked, false);
  assert.deepEqual(JSON.parse(JSON.stringify(restored.clock)), { x: 1, y: -1 });
  assert.deepEqual(JSON.parse(JSON.stringify(restored.title)), { x: -0.45, y: 0.3 });
  assert.deepEqual(JSON.parse(JSON.stringify(restored.dock)), { x: 0, y: 0.6 });

  assert.match(source, /data-hfr-drag-handle="clock"/);
  assert.match(source, /ArrowLeft[\s\S]*ArrowRight[\s\S]*ArrowUp[\s\S]*ArrowDown/);
  assert.match(source, /event\.key === "Home"/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /visualViewport[\s\S]*"resize"/);
  assert.match(styles, /data-layout-mode="editing"[\s\S]*hfr-drag-handle/);
  assert.match(styles, /touch-action:\s*none/);
  assert.match(styles, /data-layout-mode="compact"[\s\S]*transform:\s*none\s*!important/);
  assert.match(styles, /data-layout-mode="compact"[\s\S]*\.hfr-panel[\s\S]*position:\s*relative/);
});

test("desktop layout drag, keyboard movement, lock and reload operate on real state", () => {
  const harness = createHarness();
  const entry = harness.createLayoutRoot();
  const controller = harness.api.mount(entry.root, { currentUser: { id: "drag-user" } });
  assert.equal(entry.app.dataset.layoutMode, "locked");

  harness.click(entry, "layout-edit");
  assert.equal(controller.getState().layout.locked, false);
  assert.equal(entry.app.dataset.layoutMode, "editing");

  const handle = {
    dataset: { hfrDragHandle: "clock" },
    captured: false,
    closest(selector) { return selector === "[data-hfr-drag-handle]" ? this : null; },
    setPointerCapture() { this.captured = true; },
    releasePointerCapture() { this.captured = false; }
  };
  let prevented = 0;
  harness.dispatch(entry, "pointerdown", { target: handle, button: 0, pointerId: 7, clientX: 500, clientY: 300, preventDefault() { prevented += 1; } });
  harness.dispatch(entry, "pointermove", { target: handle, pointerId: 7, clientX: 700, clientY: 400, preventDefault() { prevented += 1; } });
  assert.equal(handle.captured, true);
  assert.equal(entry.stage.dataset.layoutDragging, "clock");
  assert.ok(controller.getState().layout.clock.x > 0.6);
  assert.ok(controller.getState().layout.clock.y > 0.5);
  assert.match(entry.items.clock.style.transform, /translate3d\(200\.00px, 100\.00px/);
  harness.dispatch(entry, "pointerup", { target: handle, pointerId: 7 });
  assert.equal(handle.captured, false);
  assert.equal(entry.stage.dataset.layoutDragging, undefined);
  assert.equal(prevented, 2);

  const beforeArrow = controller.getState().layout.clock.x;
  harness.dispatch(entry, "keydown", { target: handle, key: "ArrowLeft", shiftKey: false, preventDefault() {} });
  assert.ok(controller.getState().layout.clock.x < beforeArrow);
  harness.dispatch(entry, "keydown", { target: handle, key: "Home", shiftKey: false, preventDefault() {} });
  assert.deepEqual(JSON.parse(JSON.stringify(controller.getState().layout.clock)), { x: 0, y: 0 });

  harness.dispatch(entry, "keydown", { target: handle, key: "Escape", shiftKey: false, preventDefault() {} });
  assert.equal(controller.getState().layout.locked, true);
  assert.equal(entry.app.dataset.layoutMode, "locked");
  controller.unmount();

  const restoredRoot = harness.createLayoutRoot();
  const restored = harness.api.mount(restoredRoot.root, { currentUser: { id: "drag-user" } });
  assert.equal(restored.getState().layout.locked, true);
  assert.deepEqual(JSON.parse(JSON.stringify(restored.getState().layout.clock)), { x: 0, y: 0 });
});
