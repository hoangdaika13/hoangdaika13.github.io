const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const studio = require("../music-visual-studio.js");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("exposes four Music Visual Studio views and versioned local state", () => {
  assert.equal(studio.VERSION, 1);
  assert.equal(studio.STORAGE_KEY, "hh.music.visual-studio.v1");
  assert.deepEqual(studio.VIEW_IDS, ["image-music", "realtime-jam", "visualizer", "video"]);
  for (const view of studio.VIEW_IDS) assert.equal(studio.supports(view), true);
  assert.equal(studio.supports("unknown"), false);
  assert.deepEqual(Object.keys(global.HHMusicVisualStudio).sort(), ["mount", "supports", "unmount"]);
});

test("normalizes bounded state without persisting local media blobs", () => {
  const state = studio.normalizeState({
    view: "video",
    image: { duration: 9999, provider: "lyria", prompt: "cinematic" },
    jam: { density: 500, brightness: -3, bpm: 999, automation: [{ time: 12, control: "tension", value: 73 }] },
    visualizer: { template: "9:16", mode: "particles", particleCount: 999, title: "Demo" },
    audioBlob: "must-not-survive",
    imageDataUrl: "data:image/png;base64,secret"
  });
  assert.equal(state.view, "video");
  assert.equal(state.image.duration, 600);
  assert.equal(state.image.provider, "lyria");
  assert.equal(state.jam.density, 100);
  assert.equal(state.jam.brightness, 0);
  assert.equal(state.jam.bpm, 200);
  assert.equal(state.visualizer.particleCount, 180);
  assert.equal(state.audioBlob, undefined);
  assert.equal(state.imageDataUrl, undefined);
});

test("local image analysis produces palette, luminance, energy and a musical tempo", () => {
  const width = 4;
  const height = 2;
  const pixels = new Uint8ClampedArray([
    250, 40, 40, 255, 250, 40, 40, 255, 250, 180, 30, 255, 250, 180, 30, 255,
    20, 30, 210, 255, 20, 30, 210, 255, 15, 15, 20, 255, 245, 245, 250, 255
  ]);
  const analysis = studio.analyzeImageData({ data: pixels }, width, height);
  assert.ok(analysis.palette.length >= 3);
  assert.match(analysis.palette[0], /^#[0-9a-f]{6}$/i);
  assert.ok(analysis.luminance >= 0 && analysis.luminance <= 100);
  assert.ok(analysis.energy > 20);
  assert.ok(analysis.saturation > 20);
  assert.ok(analysis.suggestedBpm >= 55 && analysis.suggestedBpm <= 156);
  assert.equal(typeof analysis.mood, "string");
  assert.throws(() => studio.analyzeImageData([], 0, 0), /không hợp lệ/i);
});

test("music brief stays editable and reflects visual analysis settings", () => {
  const generated = studio.buildMusicBrief({
    palette: ["#f05080", "#40dfe8"], luminance: 66, energy: 74, saturation: 62,
    contrast: 47, warmth: 18, mood: "rực rỡ", suggestedBpm: 128
  }, { genre: "Synthwave", duration: 120, instrumental: true });
  assert.match(generated.brief, /Synthwave/);
  assert.match(generated.brief, /128 BPM/);
  assert.match(generated.brief, /120 giây/);
  assert.match(generated.prompt, /instrumental/);
  assert.match(generated.prompt, /#f05080/);
});

test("provider adapters never require or expose browser-side credentials", () => {
  const disconnected = studio.providerAdapterState({});
  assert.equal(disconnected.local.ready, true);
  assert.equal(disconnected.lyria.ready, false);
  assert.equal(disconnected.lyria.status, "access-required");
  assert.match(disconnected.lyria.detail, /phía máy chủ/i);
  assert.match(disconnected.eleven.detail, /API key không được đưa xuống client/i);
  const connected = studio.providerAdapterState({ lyria: { ready: true }, eleven: { ready: true } });
  assert.equal(connected.lyria.ready, true);
  assert.equal(connected.eleven.status, "ready");
  for (const provider of Object.values(connected)) {
    assert.equal(Object.hasOwn(provider, "apiKey"), false);
    assert.equal(Object.hasOwn(provider, "secret"), false);
  }
});

test("Jam automation export and import are portable, bounded and validated", () => {
  const text = studio.serializeAutomation({
    bpm: 110,
    key: "D minor",
    instrument: "pluck",
    mood: "hopeful",
    automation: [
      { id: "b", time: 900, control: "tension", value: 61 },
      { id: "a", time: 120, control: "density", value: 44 }
    ]
  });
  const restored = studio.parseAutomation(text);
  assert.equal(restored.bpm, 110);
  assert.equal(restored.instrument, "pluck");
  assert.deepEqual(restored.automation.map((event) => event.time), [120, 900]);
  assert.throws(() => studio.parseAutomation('{"format":"other"}'), /không phải automation/i);
});

test("visual templates include YouTube, Shorts and square safe zones", () => {
  assert.deepEqual(studio.templateDimensions("16:9"), { width: 1280, height: 720, label: "YouTube 16:9", safe: 0.08 });
  assert.equal(studio.templateDimensions("9:16").height, 1280);
  assert.equal(studio.templateDimensions("1:1").width, 1080);
  assert.equal(studio.templateDimensions("invalid").width, 1280);
});

test("browser capability report is truthful and requires both recorder APIs", () => {
  assert.deepEqual(studio.visualizerCapabilities({}), {
    webAudio: false, canvasCapture: false, mediaRecorder: false, recording: false
  });
  function Canvas() {}
  Canvas.prototype.captureStream = function captureStream() {};
  const scope = { AudioContext() {}, HTMLCanvasElement: Canvas, MediaRecorder() {} };
  assert.deepEqual(studio.visualizerCapabilities(scope), {
    webAudio: true, canvasCapture: true, mediaRecorder: true, recording: true
  });
});

test("source implements local input, WebAudio jam, visualization and WebM recording", () => {
  const source = read("music-visual-studio.js");
  for (const marker of [
    "data-mvs-image-input", "data-mvs-image-drop", "getImageData", "createOscillator",
    "createBiquadFilter", "data-mvs-pad", "captureStream(30)", "new MediaRecorder",
    "createMediaStreamDestination", "getByteFrequencyData", "getByteTimeDomainData",
    "data-mvs-cover-input", "data-mvs-audio-input", "openVideoEditor"
  ]) assert.match(source, new RegExp(marker.replace(/[()]/g, "\\$&")));
  assert.match(source, /Lyria RealTime cần quyền truy cập/);
  assert.match(source, /API key không được đưa xuống client/);
  assert.match(source, /URL\.revokeObjectURL/);
  assert.match(source, /audioContext\.close/);
  assert.doesNotMatch(source, /AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z_-]{20,}|process\.env/);
});

test("stylesheet is scoped, responsive, keyboard accessible and motion aware", () => {
  const css = read("music-visual-studio.css");
  assert.match(css, /\.mvs\s*\{/);
  assert.match(css, /\.mvs-image-layout/);
  assert.match(css, /\.mvs-jam-layout/);
  assert.match(css, /\.mvs-video-layout/);
  assert.match(css, /\.mvs-xy-pad/);
  assert.match(css, /focus-visible/);
  assert.match(css, /@media \(max-width: 560px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /font-size:\s*[^;]*vw/);
});

test("new feature remains isolated to the requested files", () => {
  const source = read("music-visual-studio.js");
  assert.match(source, /window !== "undefined"/);
  assert.match(source, /HHMusicVisualStudio = publicApi/);
  assert.match(source, /Object\.freeze\(\{ supports, mount, unmount \}\)/);
});
