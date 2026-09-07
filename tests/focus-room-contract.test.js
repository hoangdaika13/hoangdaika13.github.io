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
    createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    createBufferSource() { return audioNode({ buffer: null, loop: false }); }
    createBiquadFilter() { return audioNode({ type: "lowpass", frequency: audioParam(0) }); }
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
  assert.match(router, /Trong Học tập &amp; Ngôn ngữ/);
  assert.match(loader, /"focus-study-room":\s*\{[\s\S]*focus-room\.css\?v=1[\s\S]*focus-room\.js\?v=1/);
  assert.match(loader, /value === "\/focus-room"/);
  assert.match(worker, /\.\/focus-room\.css\?v=1/);
  assert.match(worker, /\.\/focus-room\.js\?v=1/);
  assert.doesNotMatch(source, /HH CORE|gateway|location\.href\s*=/i);
});

test("scene library ships twelve local full images and thumbnails with provenance", () => {
  const api = require("../focus-room.js");
  assert.equal(api.route, "/focus-room");
  assert.equal(api.scenes.length, 12);
  assert.equal(api.channels.length, 14);
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
  assert.equal(harness.metrics.nodeStarts, 14);
  assert.equal(harness.metrics.mediaEvents.at(-1).detail.active, true);
  harness.api.unmount(entry.root);
  assert.equal(harness.metrics.audioCloses, 1);
  assert.equal(harness.metrics.nodeStops, 14);
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
  assert.match(source, /Lật sách/);
  assert.match(source, /cafe-rain/);
  assert.match(source, /Phòng anime chạng vạng/);
  assert.match(source, /data-hfr-task-edit-form/);
});
