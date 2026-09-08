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

function createHarness(options = {}) {
  let now = 1_800_000_000_000;
  let nextTimer = 1;
  let audioContexts = 0;
  let audioCloses = 0;
  let nodeStarts = 0;
  let nodeStops = 0;
  let mediaCreates = 0;
  let mediaPlays = 0;
  let mediaPauses = 0;
  let mediaLoads = 0;
  let wakeLockRequests = 0;
  let wakeLockReleases = 0;
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

  class FakeAudio {
    constructor() {
      mediaCreates += 1;
      this.currentTime = 0;
      this.duration = 75.44;
      this.volume = 1;
      this.loop = false;
      this.listeners = new Map();
    }
    addEventListener(type, listener) { add(this.listeners, type, listener); }
    removeEventListener(type, listener) { remove(this.listeners, type, listener); }
    removeAttribute(name) { if (name === "src") this.src = ""; }
    play() {
      mediaPlays += 1;
      [...(this.listeners.get("playing") || [])].forEach((listener) => listener());
      return Promise.resolve();
    }
    pause() { mediaPauses += 1; }
    load() { mediaLoads += 1; }
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
    Audio: FakeAudio,
    CustomEvent: FakeCustomEvent,
    Date: FakeDate,
    document: documentNode,
    localStorage,
    navigator: {
      deviceMemory: 8,
      hardwareConcurrency: 8,
      wakeLock: {
        async request(type) {
          assert.equal(type, "screen");
          wakeLockRequests += 1;
          const listeners = new Set();
          return {
            addEventListener(event, listener) { if (event === "release") listeners.add(listener); },
            async release() { wakeLockReleases += 1; listeners.forEach((listener) => listener()); }
          };
        }
      }
    },
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame(callback) { callback(); return 1; },
    cancelAnimationFrame() {},
    setInterval(callback) { const timer = nextTimer++; intervals.set(timer, callback); return timer; },
    clearInterval(timer) { intervals.delete(timer); },
    setTimeout(callback) { const timer = nextTimer++; timeouts.set(timer, callback); return timer; },
    clearTimeout(timer) { timeouts.delete(timer); },
    dispatchEvent(event) { mediaEvents.push(event); return true; },
    ...(options.window || {})
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
    flushTimeouts() {
      const pending = [...timeouts.entries()];
      timeouts.clear();
      pending.forEach(([, callback]) => callback());
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
      get mediaCreates() { return mediaCreates; },
      get mediaPlays() { return mediaPlays; },
      get mediaPauses() { return mediaPauses; },
      get mediaLoads() { return mediaLoads; },
      get wakeLockRequests() { return wakeLockRequests; },
      get wakeLockReleases() { return wakeLockReleases; },
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
  assert.match(router, /230 không gian \(30 cảnh gốc \+ Atlas 200\)/);
  assert.match(router, /Trong Học tập &amp; Ngôn ngữ/);
  assert.match(loader, /"focus-study-room":\s*\{[\s\S]*focus-room\.css\?v=13[\s\S]*focus-room\.js\?v=19/);
  assert.match(loader, /value === "\/focus-room"/);
  assert.match(worker, /\.\/focus-room\.css\?v=13/);
  assert.match(worker, /\.\/focus-room\.js\?v=19/);
  assert.doesNotMatch(source, /HH CORE|gateway|location\.href\s*=/i);
});

test("scene library ships 230 local presets, including four pet-ready sanctuaries and exactly 200 truthful Atlas environments", () => {
  const api = require("../focus-room.js");
  assert.equal(api.route, "/focus-room");
  assert.equal(api.scenes.length, 230);
  assert.equal(new Set(api.scenes.map((scene) => scene.id)).size, 230);
  const atlas = api.scenes.filter((scene) => scene.collection === "Atlas 200");
  assert.equal(atlas.length, 200);
  assert.equal(new Set(atlas.map((scene) => scene.image)).size, 20);
  assert.equal(atlas.filter((scene) => scene.pet === "cat" || scene.pet === "dog").length, 20);
  const sanctuaries = api.scenes.filter((scene) => scene.collection === "Pet Sanctuary 3D");
  assert.equal(sanctuaries.length, 4);
  assert.equal(sanctuaries.filter((scene) => scene.pet === "cat").length, 2);
  assert.equal(sanctuaries.filter((scene) => scene.pet === "dog").length, 2);
  assert.equal(api.channels.length, 16);
  assert.equal(api.musicTracks.length, 3);
  assert.equal(Object.keys(api.petProfiles).length, 8);
  assert.equal(Object.values(api.petProfiles).filter((profile) => profile.species === "cat").length, 4);
  assert.equal(Object.values(api.petProfiles).filter((profile) => profile.species === "dog").length, 4);
  assert.equal(api.petProfiles.cat.label, "Mèo cam trắng");
  assert.equal(api.petProfiles.dog.label, "Shiba vàng");
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
  assert.match(read("assets/focus-room/README.md"), /Atlas 200[\s\S]*200 independent photographs/);
  for (const track of api.musicTracks.filter((item) => item.kind === "file")) {
    assert.equal(fs.existsSync(path.join(rootDir, track.src)), true, `missing ${track.src}`);
    assert.ok(fs.statSync(path.join(rootDir, track.src)).size > 1_000_000, `empty ${track.src}`);
    assert.equal(track.license, "CC0 1.0");
  }
  assert.match(read("assets/focus-room/README.md"), /Kimiko Ishizaka[\s\S]*CC0 1\.0[\s\S]*SHA-256/);
  const petModels = [
    ["assets/focus-room/pets/bicolor-cat.glb", "631DF22885E06E48185BF73B0711413F90DEB34AC71B2AB1DE99C3CD27C25131"],
    ["assets/focus-room/pets/quander-shiba.glb", "02979B1497D192CB9F47620D97D543FDFD10B161E18BFF5B8C92A04731066F03"],
    ["assets/focus-room/pets/bicolor-cat-texture.png", "376D72A0C89CE257874DDB4369E4CD32EB1134466C36316FF735E73D594802DA"],
    ["assets/focus-room/pets/bicolor-cat-texture-2.png", "F7A8DA7B92814E69F0DDDE9DC95E421FDE59CAEC56B91E6649813E3960CBE888"],
    ["assets/focus-room/pets/bicolor-cat-texture-3.jpg", "38B6602BF0BD48E185BBC666087DFAAD4179F5A651E0F3FF76194760D101CB5F"],
    ["assets/focus-room/pets/quander-shiba-texture.webp", "71A1B81C7FAE9586FF82D715549FF8076FF3EEB4DC2821AF840716CA318B7F73"],
    ["assets/focus-room/pets/quander-shiba-texture-2.webp", "055D0C38E9A6BA5C08DCC2353BF744E2BAE04F84B92CC3923E6A2CAE4C50B16A"]
  ];
  const crypto = require("node:crypto");
  for (const [asset, expectedHash] of petModels) {
    const bytes = fs.readFileSync(path.join(rootDir, asset));
    assert.ok(bytes.length > (asset.endsWith(".glb") ? 500_000 : 32), `empty ${asset}`);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(), expectedHash);
    if (asset.endsWith(".glb")) {
      let cursor = 12;
      let gltf;
      while (cursor < bytes.length) {
        const length = bytes.readUInt32LE(cursor);
        const type = bytes.readUInt32LE(cursor + 4);
        if (type === 0x4e4f534a) gltf = JSON.parse(bytes.subarray(cursor + 8, cursor + 8 + length).toString("utf8").trim());
        cursor += 8 + length;
      }
      assert.ok(gltf.animations?.length, "pet models must contain real skeletal clips");
      if (asset.includes("quander-shiba.glb")) {
        const clipNames = gltf.animations.map((clip) => clip.name);
        assert.ok(clipNames.includes("0|shake_0"), "Shiba play must use its real shake clip");
        assert.ok(clipNames.includes("0|rollover_0"), "Shiba play must use its real rollover clip");
      }
      for (const image of gltf.images || []) {
        assert.match(image.uri, /-texture(?:-\d+)?\.(?:png|jpe?g|webp)$/);
        assert.equal(image.bufferView, undefined, "runtime texture must not require a blob URL");
      }
    }
  }
  const notices = read("assets/focus-room/pets/THIRD_PARTY_NOTICES.md");
  assert.match(notices, /Bicolor Cat[\s\S]*kenchoo[\s\S]*CC BY 4\.0/);
  assert.match(notices, /Shiba Inu[\s\S]*quander[\s\S]*CC BY 4\.0/);
});

test("large scene catalog paginates and all pet coat preferences remain account scoped", () => {
  const harness = createHarness();
  const first = harness.createRoot();
  const controller = harness.api.mount(first.root, { currentUser: { id: "pet-atlas-user" } });
  controller.openPanel("scenes");
  assert.equal((first.root.innerHTML.match(/class="hfr-scene-card/g) || []).length, 24);
  assert.match(first.root.innerHTML, /Xem thêm 24 cảnh · còn 206/);
  harness.click(first, "scene-more");
  assert.equal((first.root.innerHTML.match(/class="hfr-scene-card/g) || []).length, 48);

  harness.click(first, "pet-companion", { value: "cat-silver" });
  harness.click(first, "pet-mode", { value: "walk" });
  assert.equal(controller.getState().settings.companion, "cat-silver");
  assert.deepEqual(JSON.parse(JSON.stringify(controller.getState().pet)), { interactions: 0, lastPlayedAt: 0 });
  assert.equal(controller.getState().settings.petMode, "walk");
  controller.unmount();

  const restoredRoot = harness.createRoot();
  const restored = harness.api.mount(restoredRoot.root, { currentUser: { id: "pet-atlas-user" } });
  assert.equal(restored.getState().settings.companion, "cat-silver");
  assert.equal(restored.getState().settings.petMode, "walk");
  assert.match(restoredRoot.root.innerHTML, /Mèo bạc 3D/);
  harness.click(restoredRoot, "pet-companion", { value: "cat" });
  assert.equal(restored.getState().settings.companion, "cat", "legacy cat identifier stays valid");
  harness.click(restoredRoot, "pet-companion", { value: "dog" });
  assert.equal(restored.getState().settings.companion, "dog", "legacy dog identifier stays valid");
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

test("study music never autoplays, persists controls and pauses while hidden", async () => {
  const harness = createHarness();
  const entry = harness.createRoot();
  const controller = harness.api.mount(entry.root, { currentUser: { id: "music-user" } });
  assert.equal(harness.metrics.mediaCreates, 0);
  assert.equal(harness.metrics.mediaPlays, 0);
  harness.click(entry, "music-select", { id: "bach-prelude-bwv848" });
  assert.equal(controller.getState().audio.music.selected, "bach-prelude-bwv848");
  assert.equal(harness.metrics.mediaCreates, 0, "selecting a track must not autoplay");
  harness.click(entry, "music-toggle");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.metrics.mediaCreates, 1);
  assert.equal(harness.metrics.mediaPlays, 1);
  assert.equal(harness.metrics.mediaEvents.at(-1).detail.active, true);
  harness.input(entry, "[data-hfr-music-volume]", "42");
  assert.equal(controller.getState().audio.music.volume, 0.42);
  harness.click(entry, "music-loop");
  assert.equal(controller.getState().audio.music.loop, false);
  harness.visibility(true);
  assert.equal(harness.metrics.mediaPauses, 1);
  assert.equal(harness.metrics.mediaEvents.at(-1).detail.active, false);
  harness.visibility(false);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.metrics.mediaPlays, 2);
  controller.unmount();
  assert.ok(harness.metrics.mediaPauses >= 2);
  assert.equal(harness.metrics.mediaLoads, 1, "unmount must release the media source");
  assert.equal(harness.metrics.mediaEvents.at(-1).detail.active, false);
});

test("procedural lo-fi starts on click and releases scheduler plus AudioContext", async () => {
  const harness = createHarness();
  const entry = harness.createRoot();
  const controller = harness.api.mount(entry.root, { currentUser: { id: "lofi-user" } });
  assert.equal(harness.metrics.audioContexts, 0);
  harness.click(entry, "music-toggle");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.metrics.audioContexts, 1);
  assert.ok(harness.metrics.nodeStarts >= 5, "lo-fi chord and vinyl bed should be scheduled lazily");
  assert.equal(harness.metrics.intervalCount, 1, "only the lo-fi scheduler should be active");
  harness.visibility(true);
  assert.equal(harness.metrics.intervalCount, 0, "hidden tabs must stop the lo-fi scheduler");
  harness.visibility(false);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.metrics.intervalCount, 1, "visible playback may restart one scheduler");
  harness.click(entry, "music-toggle");
  assert.equal(harness.metrics.intervalCount, 0, "manual pause must stop the scheduler");
  controller.unmount();
  assert.equal(harness.metrics.audioCloses, 1);
  assert.equal(harness.metrics.intervalCount, 0);
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

test("focus planning rituals and distraction log are real account-scoped state", () => {
  const harness = createHarness();
  const entry = harness.createRoot();
  const controller = harness.api.mount(entry.root, { currentUser: { id: "planning-user" } });
  harness.click(entry, "apply-built-in-ritual", { id: "library-reading" });
  let state = controller.getState();
  assert.equal(state.scenes.selected, "university-reading-hall");
  assert.equal(state.timer.focusMinutes, 45);
  assert.equal(state.timer.breakMinutes, 15);
  assert.equal(state.audio.music.selected, "bach-canon-bwv1080");
  assert.ok(state.audio.mix.pages > 0);
  assert.equal(harness.metrics.mediaCreates, 0, "applying a ritual must not autoplay media");

  harness.click(entry, "log-distraction", { value: "Điện thoại" });
  state = controller.getState();
  assert.equal(state.planning.distractions.length, 1);
  assert.equal(state.planning.distractions[0].label, "Điện thoại");
  controller.unmount();

  const restoredRoot = harness.createRoot();
  const restored = harness.api.mount(restoredRoot.root, { currentUser: { id: "planning-user" } });
  assert.equal(restored.getState().planning.distractions[0].label, "Điện thoại");
  assert.match(restoredRoot.root.innerHTML, /Kế hoạch/);
  assert.match(restoredRoot.root.innerHTML, /1 lần xao nhãng/);
});

test("screen wake lock is opt-in and follows visibility lifecycle", async () => {
  const harness = createHarness();
  const entry = harness.createRoot();
  const controller = harness.api.mount(entry.root, { currentUser: { id: "wake-user" } });
  assert.equal(harness.metrics.wakeLockRequests, 0);
  harness.click(entry, "wake-lock-toggle");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.metrics.wakeLockRequests, 1);
  harness.visibility(true);
  assert.equal(harness.metrics.wakeLockReleases, 1);
  harness.visibility(false);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.metrics.wakeLockRequests, 2);
  controller.unmount();
  assert.equal(harness.metrics.wakeLockReleases, 2);
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

test("shared room sends only allowlisted state and restores the personal session on leave", async () => {
  const outbound = [];
  const socket = { connected: true, once() {}, off() {} };
  const realtime = {
    status: () => ({ state: "connected" }),
    socket: () => socket,
    connect: async () => socket,
    subscribe: () => () => {},
    unsubscribeScope() {},
    async emit(event, payload) {
      outbound.push({ event, payload });
      if (event === "workspace:room:create") {
        return {
          ok: true,
          room: {
            code: "ABC234",
            name: payload.name,
            revision: 0,
            state: payload.state,
            members: [{ id: "member-host", name: "Người học", role: "host" }]
          },
          self: { id: "member-host", name: "Người học", role: "host" }
        };
      }
      return { ok: true, revision: 1 };
    }
  };
  const harness = createHarness({ window: { HHRealtime: realtime } });
  const entry = harness.createRoot();
  const controller = harness.api.mount(entry.root, { currentUser: { id: "room-user" } });
  harness.input(entry, "[data-hfr-note]", "Ghi chú riêng không được gửi");
  harness.flushTimeouts();
  await controller.createSharedRoom("Cùng ôn thi");

  assert.equal(controller.getSharedRoom().code, "ABC234");
  const createPayload = outbound.find((item) => item.event === "workspace:room:create").payload;
  assert.deepEqual(Object.keys(createPayload.state).sort(), ["audio", "sceneId", "timer"]);
  assert.equal(createPayload.state.note, undefined);
  assert.equal(createPayload.state.tasks, undefined);

  harness.click(entry, "select-scene", { id: "ocean-sunset" });
  harness.flushTimeouts();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(controller.getState().scenes.selected, "ocean-sunset");
  const synchronized = outbound.find((item) => item.event === "workspace:room:state");
  assert.equal(synchronized.payload.state.sceneId, "ocean-sunset");
  assert.equal(synchronized.payload.state.note, undefined);

  await controller.leaveSharedRoom();
  assert.equal(controller.getSharedRoom().code, "");
  assert.equal(controller.getState().scenes.selected, "rainy-window");
  assert.equal(controller.getState().note, "Ghi chú riêng không được gửi");
  assert.ok(outbound.some((item) => item.event === "workspace:room:leave"));
});

test("responsive, motion and truthful capability contracts are explicit", () => {
  assert.match(styles, /@media \(max-width: 430px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /pointer-events:\s*none/);
  assert.match(styles, /focus-visible/);
  assert.match(styles, /\.hfr-panel[\s\S]*overflow:\s*auto/);
  assert.match(source, /document\?\.hidden/);
  assert.match(source, /context\?\.suspend|context\.suspend/);
  assert.match(source, /REALTIME_SERVICE = "focus-room"/);
  assert.match(source, /workspace:room:create/);
  assert.match(source, /workspace:room:join/);
  assert.match(source, /workspace:room:state/);
  assert.match(source, /Công việc, ghi chú, lịch sử, mục tiêu và tệp cá nhân không rời thiết bị/);
  assert.match(source, /không bao giờ tự phát/i);
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
  assert.match(source, /import\(THREE_MODULE\)/);
  assert.match(source, /import\(GLTF_LOADER_MODULE\)/);
  assert.match(source, /import\(SKELETON_UTILS_MODULE\)/);
  assert.match(source, /import\(MESHOPT_DECODER_MODULE\)/);
  assert.match(source, /assets\/focus-room\/pets\/bicolor-cat\.glb/);
  assert.match(source, /assets\/focus-room\/pets\/quander-shiba\.glb/);
  assert.doesNotMatch(source, /src:\s*"https?:\/\//);
  assert.match(source, /new THREE\.WebGLRenderer/);
  assert.match(source, /1000 \/ 30/);
  assert.match(source, /targetFps = quality === "high" \? 60 : 30/);
  assert.match(source, /Math\.min\(1\.5/);
  assert.match(source, /transitionPetAction/);
  assert.match(source, /fadeIn\?\.\(fadeDuration\)/);
  assert.match(source, /applyPetGait/);
  assert.match(source, /restorePetRigBase\(runtime\)[\s\S]*mixer\.update\(delta\)[\s\S]*capturePetRigBase\(runtime\)[\s\S]*applyPetGait/);
  assert.doesNotMatch(source, /pose\.scale\.set\(1,/);
  assert.match(source, /petBehaviorMode/);
  assert.match(source, /data-hfr-action="pet-play"/);
  assert.match(source, /playShake:[\s\S]*shake/);
  assert.match(source, /playRoll:[\s\S]*rollover/);
  assert.match(source, /filteredPetTexture/);
  assert.match(source, /const PET_LIGHT_PROFILES/);
  assert.match(source, /PET_LIGHT_PROFILES\[selected\.effect\]/);
  assert.match(source, /function enablePetFurSway/);
  assert.match(source, /hh-soft-fur-v1/);
  assert.match(source, /uHHFurTime\.value = elapsed/);
  assert.match(source, /rig\.paws\.forEach/);
  assert.match(source, /rig\.neck\.forEach/);
  assert.match(source, /new THREE\.CanvasTexture/);
  assert.match(source, /instance\.state\.pet\.interactions \+= 1/);
  assert.match(source, /lastPlayedAt = Date\.now\(\)/);
  assert.match(source, /compactLane = width < 620/);
  assert.match(source, /runtime\.restingX - runtime\.laneHalf/);
  assert.match(source, /const pathCenterX = runtime\.restingX/);
  assert.match(source, /const edgeLane = clamp\(runtime\.travelHalf \* \.8/);
  assert.match(source, /sideClearance \* \.4/);
  assert.match(source, /runtime\.currentZ/);
  assert.match(source, /Math\.atan2\(-directionX, directionZ\)/);
  assert.match(source, /anchor\.position\.set\(runtime\.currentX, -1\.14 - runtime\.currentZ \* \.1, runtime\.currentZ\)/);
  assert.doesNotMatch(source, /const endpointEase/);
  assert.match(source, /teardownPetDepth/);
  assert.match(styles, /\.hfr-pet-depth[\s\S]*pointer-events:\s*none/);
  assert.match(styles, /\.hfr-pet-play\s*\{[\s\S]*?z-index:\s*1/);
  assert.match(styles, /\.hfr-focus-center\s*\{[\s\S]*?z-index:\s*2/);
  assert.match(styles, /\.hfr-pet-play:focus-visible/);
  assert.match(styles, /\.hfr-pet-play__hearts[\s\S]*pointer-events:\s*none/);
  assert.match(styles, /\.hfr-backdrop img[\s\S]*?filter:\s*var\(--hfr-scene-grade/);
  assert.match(styles, /\.hfr-companion-controls/);
  assert.match(styles, /\.hfr-load-more/);
  assert.match(source, /hh-lofi-calm/);
  assert.match(source, /Kimiko Ishizaka/);
  assert.match(source, /suspendMusicForVisibility/);
  assert.match(source, /data-hfr-task-edit-form/);
  assert.match(source, /DEEP FOCUS COMMAND/);
  assert.match(source, /data-hfr-ritual-save/);
  assert.match(source, /data-hfr-distraction-form/);
  assert.match(source, /downloadHistoryCsv/);
  assert.match(source, /navigator\?\.wakeLock\?\.request/);
  assert.match(source, /Alt[\s\S]*Space/);
  assert.match(styles, /\.hfr-week-chart/);
  assert.match(styles, /\.hfr-app\.has-panel:not\(\[data-layout-mode="editing"\]\)[\s\S]*margin-right/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.hfr-app\.has-panel:not\(\[data-layout-mode="editing"\]\) \.hfr-clock-card[\s\S]*margin-right:\s*0/);
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
