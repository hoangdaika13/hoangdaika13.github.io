const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "music-mix-master.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "music-mix-master.css"), "utf8");
const mixMaster = require("../music-mix-master.js");

test("public API supports Mix and Master workspaces", () => {
  assert.equal(mixMaster.VERSION, 1);
  assert.equal(mixMaster.STORAGE_KEY, "hh.music.mix-master.v1");
  assert.equal(mixMaster.supports("mix"), true);
  assert.equal(mixMaster.supports("master"), true);
  assert.equal(mixMaster.supports("composer"), false);
  assert.equal(typeof mixMaster.mount, "function");
  assert.equal(typeof mixMaster.unmount, "function");
  assert.match(source, /globalScope\.HHMusicMixMaster = api/);
});

test("DSP parameters are clamped to safe declared ranges", () => {
  const channel = mixMaster.normalizeChannel({
    gainDb: 900, pan: -8,
    eq: { lowDb: -90, midDb: 24, highDb: Infinity, lowHz: 2, midHz: 999999, highHz: "bad" },
    compressor: { threshold: -900, ratio: 99, attack: -3, release: 7 },
    sends: { reverb: 12, delay: -1 },
    automation: { gain: [{ time: -5, value: 999 }], pan: [{ time: 999999, value: -9 }] }
  }, 0);
  assert.equal(channel.gainDb, 12);
  assert.equal(channel.pan, -1);
  assert.equal(channel.eq.lowDb, -18);
  assert.equal(channel.eq.midDb, 18);
  assert.equal(channel.eq.highDb, 0);
  assert.equal(channel.eq.lowHz, 20);
  assert.equal(channel.eq.midHz, 20000);
  assert.equal(channel.eq.highHz, 8000);
  assert.deepEqual(channel.compressor, { enabled: true, threshold: -100, ratio: 20, attack: 0, release: 1 });
  assert.deepEqual(channel.sends, { reverb: 1, delay: 0 });
  assert.deepEqual(channel.automation.gain.map(({ time, value }) => ({ time, value })), [{ time: 0, value: 12 }]);
  assert.deepEqual(channel.automation.pan.map(({ time, value }) => ({ time, value })), [{ time: 86400, value: -1 }]);

  const master = mixMaster.normalizeMaster({ inputGainDb: -100, outputGainDb: 50, ceilingDb: 8, stereoWidth: 7 });
  assert.equal(master.inputGainDb, -60);
  assert.equal(master.outputGainDb, 12);
  assert.equal(master.ceilingDb, 0);
  assert.equal(master.stereoWidth, 2);
  assert.equal(mixMaster.dbToGain(0), 1);
  assert.ok(Math.abs(mixMaster.gainToDb(1) - 0) < 1e-9);
});

test("all publishing presets contain bounded mastering data and truthful targets", () => {
  assert.deepEqual(Object.keys(mixMaster.MASTER_PRESETS), ["youtube", "podcast", "streaming", "shorts"]);
  for (const preset of Object.values(mixMaster.MASTER_PRESETS)) {
    assert.ok(preset.label);
    assert.match(preset.target, /tham chiếu/);
    assert.ok(preset.ceilingDb <= 0 && preset.ceilingDb >= -12);
    assert.ok(preset.compressor.ratio >= 1 && preset.compressor.ratio <= 20);
    assert.ok(preset.stereoWidth >= 0 && preset.stereoWidth <= 2);
  }
  assert.equal(mixMaster.normalizeMaster({ preset: "unknown" }).preset, "youtube");
});

test("metering remains explicitly estimated without a standards analyzer", () => {
  const labels = mixMaster.getMeterLabels({});
  assert.equal(labels.standards, false);
  assert.match(labels.truePeak, /ước tính/);
  assert.match(labels.lufs, /ước tính/);
  assert.match(labels.note, /ITU-R BS\.1770/);
  const compliant = mixMaster.getMeterLabels({ HHLoudnessAnalyzer: { isStandardsCompliant: true, measure() {} } });
  assert.equal(compliant.standards, true);
  assert.doesNotMatch(compliant.lufs, /ước tính/);
  assert.match(source, /True Peak \(ước tính\)/);
  assert.match(source, /LUFS \(ước tính\)/);
});

test("local sample estimates report peak RMS clipping and bounded values", () => {
  const metrics = mixMaster.estimateMetrics(Float32Array.from([0, 0.5, -0.5, 1]));
  assert.equal(metrics.peak, 1);
  assert.equal(metrics.peakDb, 0);
  assert.equal(metrics.clipping, true);
  assert.ok(metrics.rms > 0 && metrics.rms < 1);
  assert.ok(Number.isFinite(metrics.lufsEstimate));
  assert.ok(metrics.truePeakEstimateDb <= 3);
  assert.deepEqual(mixMaster.estimateMetrics([]), { peak: 0, peakDb: -120, rms: 0, rmsDb: -120, truePeakEstimateDb: -120, lufsEstimate: -120, clipping: false });
});

test("processing manifest is non-destructive and honest about render support", () => {
  const state = mixMaster.createDefaultState();
  state.channels[0].file = { name: "vocal.wav", type: "audio/wav", size: 2048, duration: 5 };
  const manifest = mixMaster.buildProcessingManifest(state, {});
  assert.equal(manifest.format, "hh-mix-master-manifest");
  assert.equal(manifest.nonDestructive, true);
  assert.equal(manifest.renderCapability, false);
  assert.equal(manifest.sourceFiles[0].name, "vocal.wav");
  assert.match(manifest.metering.truePeak, /estimate/);
  assert.match(manifest.notice, /không thay đổi tệp nguồn/);
  const capable = mixMaster.buildProcessingManifest(state, { OfflineAudioContext() {} });
  assert.equal(capable.renderCapability, true);
});

test("resource lifecycle revokes URLs, disconnects nodes, stops sources and closes context", async () => {
  const calls = { revoke: 0, disconnect: 0, stop: 0, close: 0, cancel: 0 };
  const tracker = mixMaster.createResourceTracker({
    URL: { revokeObjectURL() { calls.revoke += 1; } },
    cancelAnimationFrame() { calls.cancel += 1; }
  });
  tracker.addUrl("blob:hh-audio");
  tracker.addNode({ disconnect() { calls.disconnect += 1; } });
  tracker.addSource({ stop() { calls.stop += 1; }, disconnect() { calls.disconnect += 1; } });
  tracker.addFrame(13);
  tracker.setContext({ state: "running", async close() { calls.close += 1; } });
  assert.deepEqual(tracker.stats(), { urls: 1, nodes: 1, sources: 1, frames: 1, hasContext: true });
  await tracker.cleanup();
  assert.deepEqual(calls, { revoke: 1, disconnect: 2, stop: 1, close: 1, cancel: 1 });
  assert.deepEqual(tracker.stats(), { urls: 0, nodes: 0, sources: 0, frames: 0, hasContext: false });
});

test("mount and unmount lifecycle works without browser audio globals", async () => {
  const listeners = new Map();
  const host = {
    innerHTML: "",
    addEventListener(name, handler) { listeners.set(name, handler); },
    removeEventListener(name) { listeners.delete(name); },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
  const runtime = mixMaster.mount(host, { view: "master" });
  assert.equal(runtime.state.view, "master");
  assert.equal(mixMaster.lifecycle().mounted, true);
  assert.match(host.innerHTML, /Mix & Master Pro/);
  assert.ok(listeners.has("click"));
  await mixMaster.unmount();
  assert.deepEqual(mixMaster.lifecycle(), { mounted: false, playing: false, urls: 0, nodes: 0, sources: 0, frames: 0, hasContext: false });
  assert.equal(host.innerHTML, "");
  assert.equal(listeners.size, 0);
});

test("workspace includes requested real controls and responsive accessibility", () => {
  for (const marker of [
    "decodeAudioData", "createBiquadFilter", "createDynamicsCompressor", "createConvolver", "createDelay",
    "createStereoPanner", "data-mm-channel-param", "data-mm-toggle=", "data-mm-automation-kind",
    "data-mm-spectrum", "data-mm-stereo", "data-mm-action=\"ab\"", "data-mm-action=\"bypass\"",
    "OfflineAudioContext", "encodeWav", "processing manifest", "aria-live=\"polite\""
  ]) assert.ok(source.includes(marker), `missing ${marker}`);
  assert.match(styles, /@media\(max-width:420px\)/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(styles, /:focus-visible/);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
  assert.doesNotMatch(source, /\beval\s*\(|new\s+Function\s*\(/);
  assert.doesNotMatch(source, /api[_-]?key|client[_-]?secret|BEGIN PRIVATE KEY/i);
});
