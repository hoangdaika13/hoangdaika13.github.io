const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "music-mix-performance.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "music-mix-performance.css"), "utf8");
const engine = require("../music-mix-performance.js");

function memoryStorage(seed) {
  const values = new Map(Object.entries(seed || {}));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    value(key) { return values.get(key); }
  };
}

function hostHarness() {
  const listeners = new Map();
  return {
    host: {
      innerHTML: "",
      addEventListener(name, handler) { listeners.set(name, handler); },
      removeEventListener(name) { listeners.delete(name); },
      querySelector() { return null; },
      querySelectorAll() { return []; }
    },
    listeners
  };
}

test("public API exposes only the requested workspaces through supports", () => {
  assert.equal(engine.VERSION, 1);
  assert.equal(engine.STORAGE_KEY, "hh.music.mix-performance.v1");
  assert.equal(engine.supports("mix-doctor"), true);
  assert.equal(engine.supports("live-performance"), true);
  assert.equal(engine.supports("mix"), false);
  assert.equal(engine.supports("realtime-jam"), false);
  assert.equal(typeof engine.mount, "function");
  assert.equal(typeof engine.unmount, "function");
  assert.match(source, /globalScope\.HHMusicMixPerformance = api/);
  assert.match(source, /Object\.freeze\(\{/);
});

test("project context is read-only, validated and has a safe fallback", () => {
  let reads = 0;
  const context = {
    HHMusicProjectContext: {
      getSnapshot() { reads += 1; return { tempo: 126, musicalKey: "D minor" }; }
    }
  };
  assert.deepEqual(engine.readProjectContext(context), {
    source: "HHMusicProjectContext", bpm: 126, key: "D minor"
  });
  assert.equal(reads, 1);
  assert.deepEqual(engine.readProjectContext({}), { source: "fallback", bpm: null, key: null });
  assert.deepEqual(engine.readProjectContext({ HHMusicProjectContext: { getSnapshot() { throw new Error("offline"); } } }), { source: "fallback", bpm: null, key: null });
  assert.match(source, /HHMusicProjectContext/);
  assert.match(source, /getSnapshot\(\)/);
  assert.doesNotMatch(source, /HHMusicProjectContext\s*=/);
  assert.doesNotMatch(source, /new\s+HHMusicProjectContext/);
});

test("mount merges project BPM and key without creating a separate project context", async () => {
  const storage = memoryStorage();
  const { host, listeners } = hostHarness();
  const scope = {
    localStorage: storage,
    HHMusicProjectContext: { getSnapshot: () => ({ bpm: 134, key: "F# minor" }) },
    setTimeout() { return 0; }, clearTimeout() {}, clearInterval() {}, cancelAnimationFrame() {}
  };
  const runtime = engine.mount(host, { view: "live-performance", scope });
  assert.equal(runtime.state.project.bpm, 134);
  assert.equal(runtime.state.live.bpm, 134);
  assert.equal(runtime.state.project.key, "F# minor");
  assert.equal(runtime.state.project.contextSource, "HHMusicProjectContext");
  assert.match(host.innerHTML, /134 BPM/);
  assert.match(host.innerHTML, /Context: dự án chung/);
  assert.ok(listeners.has("click"));
  const persisted = JSON.parse(storage.value(engine.STORAGE_KEY));
  assert.equal(persisted.version, 1);
  assert.equal(persisted.project.bpm, 134);
  await engine.unmount();
  assert.equal(host.innerHTML, "");
  assert.equal(listeners.size, 0);
});

test("PCM analysis reports clipping, dynamics, DC, stereo and bounded spectrum", () => {
  const left = Float32Array.from([0, 1, -1, 0.5, -0.5, 0.25, -0.25, 0]);
  const right = Float32Array.from([0, -1, 1, -0.5, 0.5, -0.25, 0.25, 0]);
  const metrics = engine.analyzePCM([left, right], 48000);
  assert.equal(metrics.channels, 2);
  assert.equal(metrics.sampleRate, 48000);
  assert.equal(metrics.peak, 0, "anti-phase channels cancel in the mono analysis path");
  assert.ok(metrics.stereoCorrelation < -0.99);
  assert.ok(metrics.duration > 0);
  for (const value of [metrics.spectrum.low, metrics.spectrum.mid, metrics.spectrum.high]) assert.ok(value >= 0 && value <= 1);

  const clipping = engine.analyzePCM([Float32Array.from([0, 0.5, -0.5, 1, -1])], 44100);
  assert.equal(clipping.peak, 1);
  assert.equal(clipping.clippingSamples, 2);
  assert.ok(clipping.rms > 0);
  assert.ok(Number.isFinite(clipping.lufsEstimate));
  assert.ok(clipping.crestDb >= 0);
});

test("Mix Doctor explains issues and never applies a suggestion implicitly", () => {
  const state = engine.createDefaultState();
  const metrics = engine.analyzePCM([Float32Array.from([0, 0.2, 1, -1, 0.2, 0])], 48000);
  state.mix.metrics = metrics;
  state.mix.issues = engine.buildMixIssues(metrics, "youtube");
  assert.ok(state.mix.issues.some((issue) => issue.id === "clipping"));
  assert.equal(state.mix.adjustmentStack.length, 0, "analysis must not alter the processing stack");
  const proposed = state.mix.issues.find((issue) => issue.suggestion)?.suggestion;
  assert.ok(proposed);
  assert.equal(engine.applySuggestion(state, proposed), true);
  assert.equal(state.mix.adjustmentStack.length, 1);
  assert.equal(state.mix.ab, "B");
  assert.equal(engine.applySuggestion(state, proposed), false, "the same suggestion is not duplicated in one session");
  assert.equal(state.mix.adjustmentStack.length, 1);
  const restored = engine.normalizeState(state);
  assert.equal(engine.applySuggestion(restored, proposed), false, "the suggestion identity survives versioned persistence");
});

test("presets create removable non-destructive layers and reports are honest", () => {
  const state = engine.createDefaultState();
  assert.deepEqual(Object.keys(engine.MIX_PRESETS), ["youtube", "streaming", "podcast"]);
  assert.equal(engine.applyPreset(state, "podcast"), true);
  assert.equal(state.mix.preset, "podcast");
  assert.ok(state.mix.adjustmentStack.length >= 3);
  assert.ok(state.mix.adjustmentStack.every((item) => item.enabled));
  const report = engine.createMixReport(state);
  assert.equal(report.format, "hh-mix-doctor-report");
  assert.equal(report.nonDestructive, true);
  assert.equal(report.sourceModified, false);
  assert.equal(report.metering.standardCompliant, false);
  assert.match(report.metering.notice, /ước tính/);
  assert.match(report.metering.notice, /ITU-R BS\.1770/);
  assert.match(source, /LUFS ước tính/);
  assert.doesNotMatch(source, /LUFS chuẩn|True Peak chuẩn/);
});

test("live automation supports new takes, overdub data and bounded export", () => {
  const state = engine.createDefaultState();
  state.live.automation.recording = true;
  state.live.automation.startedAt = 1000;
  assert.equal(engine.recordAutomationEvent(state.live, "macro-mood", 90, 1250).time, 250);
  assert.equal(engine.recordAutomationEvent(state.live, "scene", "chorus", 1500).value, "chorus");
  assert.equal(state.live.automation.events.length, 2);
  state.live.automation.recording = false;
  assert.equal(engine.recordAutomationEvent(state.live, "pad-1", 100, 1800), null);
  const exported = engine.exportAutomationData(state);
  assert.equal(exported.format, "hh-live-performance-automation");
  assert.equal(exported.events.length, 2);
  assert.equal(exported.bpm, 112);
  assert.deepEqual(exported.macros, state.live.macros);
});

test("versioned normalization rejects unsafe or invalid persisted values", () => {
  const state = engine.normalizeState({
    version: 999,
    view: "unknown",
    project: { bpm: 9999, key: "<b>X minor</b>" },
    mix: { preset: "fake", adjustmentStack: [{ type: "gain", gainDb: 500, label: "<img src=x>Boost" }] },
    live: {
      macros: { mood: -50, density: 400 },
      activeClips: { drums: "fake" },
      midi: { mappings: { "144:60": "pad-0", "bad": "admin" } }
    }
  });
  assert.equal(state.version, 1);
  assert.equal(state.view, "mix-doctor");
  assert.equal(state.project.bpm, 300);
  assert.equal(state.project.key, "X minor");
  assert.equal(state.mix.preset, "youtube");
  assert.equal(state.mix.adjustmentStack[0].gainDb, 18);
  assert.equal(state.mix.adjustmentStack[0].label, "Boost");
  assert.equal(state.live.macros.mood, 0);
  assert.equal(state.live.macros.density, 100);
  assert.deepEqual(state.live.midi.mappings, { "144:60": "pad-0" });
});

test("resource bag releases URLs, nodes, sources, frames, timers, MIDI and audio context", async () => {
  const calls = { revoke: 0, disconnect: 0, stop: 0, cancel: 0, clear: 0, close: 0 };
  const scope = {
    URL: { revokeObjectURL() { calls.revoke += 1; } },
    cancelAnimationFrame() { calls.cancel += 1; },
    clearInterval() { calls.clear += 1; }
  };
  const bag = engine.createResourceBag(scope);
  const midi = { onmidimessage: () => {} };
  bag.addUrl("blob:mix");
  bag.addNode({ disconnect() { calls.disconnect += 1; } });
  bag.addSource({ stop() { calls.stop += 1; }, disconnect() { calls.disconnect += 1; } });
  bag.addFrame(9);
  bag.addInterval(12);
  bag.addMidiInput(midi);
  bag.setContext({ state: "running", async close() { calls.close += 1; } });
  assert.deepEqual(bag.stats(), { urls: 1, nodes: 1, sources: 1, frames: 1, intervals: 1, midiInputs: 1, hasContext: true });
  await bag.cleanup();
  assert.deepEqual(calls, { revoke: 1, disconnect: 2, stop: 1, cancel: 1, clear: 1, close: 1 });
  assert.equal(midi.onmidimessage, null);
  assert.deepEqual(bag.stats(), { urls: 0, nodes: 0, sources: 0, frames: 0, intervals: 0, midiInputs: 0, hasContext: false });
});

test("browser features are real, local-first and permission gated", () => {
  for (const marker of [
    "decodeAudioData", "getChannelData", "createAnalyser", "getByteFrequencyData",
    "createBiquadFilter", "createDynamicsCompressor", "createChannelSplitter", "createChannelMerger",
    "requestMIDIAccess({ sysex: false })", "onmidimessage", "data-hmp-midi-target",
    "data-hmp-scene", "data-hmp-clip", "data-hmp-pad", "data-hmp-macro",
    "automation-record", "automation-export", "aria-live=\"polite\""
  ]) assert.ok(source.includes(marker), `missing ${marker}`);
  const requestIndex = source.indexOf("requestMIDIAccess({ sysex: false })");
  const connectIndex = source.lastIndexOf("async function connectMidi", requestIndex);
  const mountIndex = source.indexOf("function mount(");
  const connectBody = source.slice(connectIndex, source.indexOf("\n  async function handleClick", connectIndex));
  const mountBody = source.slice(mountIndex, source.indexOf("\n  async function unmount", mountIndex));
  assert.ok(connectIndex >= 0 && connectBody.includes("requestMIDIAccess({ sysex: false })"));
  assert.doesNotMatch(mountBody, /requestMIDIAccess/, "mount must never prompt for MIDI access");
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
  assert.doesNotMatch(source, /api[_-]?key|client[_-]?secret|BEGIN PRIVATE KEY/i);
});

test("UI is Vietnamese, responsive, keyboard visible and motion-safe", () => {
  for (const text of ["Chẩn đoán tín hiệu", "Đề xuất luôn cần bạn xác nhận", "Clip Launcher", "Chơi trực tiếp", "Kết nối MIDI", "Ghi chuyển động"]) assert.ok(source.includes(text));
  assert.match(styles, /@media \(max-width: 420px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /overflow: auto/);
  assert.match(styles, /grid-template-columns/);
  assert.match(source, /aria-pressed/);
  assert.match(source, /aria-label=/);
});
