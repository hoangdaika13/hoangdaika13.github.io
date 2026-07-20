const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "graphic-design-motion.js"), "utf8");
const motion = require("../graphic-design-motion.js");

test("Graphic Motion Studio exposes a standalone idempotent mount contract", () => {
  assert.match(source, /HHGraphicMotion\s*=\s*api/);
  assert.match(source, /mount\(root, options\)/);
  assert.match(source, /mounted\.has\(root\)/);
  assert.match(source, /querySelectorAll\("\[data-graphic-motion\]"\)/);
  assert.match(source, /new global\.MutationObserver\(mountAll\)/);
  assert.equal(typeof motion.mount, "function");
  assert.equal(typeof motion.unmount, "function");
});

test("Project schema contains stage, layers, tracks, triggers and lip-sync markers", () => {
  const project = motion.createDefaultProject();
  assert.equal(project.version, 1);
  assert.deepEqual(Object.keys(project.stage), ["width", "height", "background"]);
  assert.ok(project.layers.length >= 2);
  assert.ok(project.tracks.length >= project.layers.length);
  assert.ok(Array.isArray(project.triggers));
  assert.ok(Array.isArray(project.lipSync));
  assert.ok(project.layers.every((layer) => Array.isArray(layer.keyframes) && layer.keyframes.length > 0));
});

test("Motion presets generate usable timeline keyframes without claiming a renderer", () => {
  const project = motion.createDefaultProject();
  const layer = project.layers[0];
  for (const preset of motion.MOTION_PRESETS) {
    const frames = motion.presetKeyframes(preset.id, layer, 8);
    assert.equal(frames.length, 3);
    assert.ok(frames[0].time <= frames[1].time && frames[1].time <= frames[2].time);
    assert.ok(frames.every((frame) => frame.values && Number.isFinite(frame.values.x)));
  }
  assert.doesNotMatch(source, /MediaRecorder|ffmpeg|encoder/i);
  assert.match(source, /exportFormat/);
  assert.match(source, /Cấu hình xuất/);
  assert.match(source, /GIF/);
  assert.match(source, /WebM/);
  assert.match(source, /chưa render trong trình duyệt|Xuất JSON/);
});

test("Project normalization bounds user data and removes invalid references", () => {
  const normalized = motion.normalizeProject({
    stage: { width: 999999, height: 1, background: "not-a-color" },
    settings: { duration: 99999, fps: 11, exportFormat: "native" },
    layers: [{ id: "hero", type: "text", name: "x".repeat(500), x: 9000, keyframes: [{ id: "k", time: -9, values: { opacity: 3, scale: 0, x: 9 } }] }],
    tracks: [{ id: "bad", layerId: "missing" }],
    triggers: [{ id: "bad-trigger", targetId: "missing", type: "click" }],
    lipSync: [{ id: "bad-lip", layerId: "missing", time: 2 }]
  });
  assert.equal(normalized.stage.width, 4096);
  assert.equal(normalized.stage.height, 90);
  assert.equal(normalized.stage.background, "#101726");
  assert.equal(normalized.settings.fps, 30);
  assert.equal(normalized.settings.duration, 3600);
  assert.equal(normalized.layers[0].name.length, 100);
  assert.equal(normalized.layers[0].x, 5000);
  assert.equal(normalized.layers[0].keyframes[0].time, 0);
  assert.equal(normalized.layers[0].keyframes[0].values.opacity, 1);
  assert.equal(normalized.tracks.length, 0);
  assert.equal(normalized.triggers.length, 0);
  assert.equal(normalized.lipSync.length, 0);
});

test("Interpolation uses keyframes and keeps values bounded", () => {
  const project = motion.createDefaultProject();
  const layer = project.layers[0];
  layer.keyframes = [
    { id: "a", time: 0, easing: "linear", values: { x: 0, y: 0, opacity: 0, scale: 1, rotation: 0 } },
    { id: "b", time: 10, easing: "linear", values: { x: 100, y: 50, opacity: 1, scale: 2, rotation: 90 } }
  ];
  assert.deepEqual(motion.interpolateKeyframes(layer, 0), layer.keyframes[0].values);
  assert.deepEqual(motion.interpolateKeyframes(layer, 5), { x: 50, y: 25, opacity: 0.5, scale: 1.5, rotation: 45 });
  assert.deepEqual(motion.interpolateKeyframes(layer, 99), layer.keyframes[1].values);
});

test("Device permissions are explicitly gated behind user actions", () => {
  assert.match(source, /data-gm-camera/);
  assert.match(source, /data-gm-mic/);
  assert.match(source, /requestPermission\("camera"\)/);
  assert.match(source, /requestPermission\("mic"\)/);
  assert.match(source, /getUserMedia/);
  assert.match(source, /async function requestPermission\(kind\)/);
  assert.equal((source.match(/getUserMedia/g) || []).length, 2);
  assert.match(source, /cameraStream\?\.getTracks/);
  assert.match(source, /micStream\?\.getTracks/);
});

test("Local-first project operations include import/export, undo/redo and no network or tracking", () => {
  assert.equal(motion.STORAGE_KEY, "hh.graphic-motion.project.v1");
  assert.match(source, /storage\.setItem\(STORAGE_KEY/);
  assert.match(source, /JSON\.stringify\(payload, null, 2\)/);
  assert.match(source, /FileReader/);
  assert.match(source, /function undo\(\)/);
  assert.match(source, /function redo\(\)/);
  assert.match(source, /data-gm-undo/);
  assert.match(source, /data-gm-redo/);
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|WebSocket|navigator\.sendBeacon|analytics|tracking/i);
});

test("UI includes accessible preview, timeline, puppet, trigger and export states", () => {
  assert.match(source, /aria-label="Canvas preview hoạt ảnh"/);
  assert.match(source, /data-gm-canvas/);
  assert.match(source, /data-gm-playhead/);
  assert.match(source, /Timeline \/ Keyframes/);
  assert.match(source, /data-gm-add="puppet"/);
  assert.match(source, /data-gm-add-trigger/);
  assert.match(source, /data-gm-add-lip/);
  assert.match(source, /role="status" aria-live="polite"/);
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /@media\(max-width:780px\)/);
});
