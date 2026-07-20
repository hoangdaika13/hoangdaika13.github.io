const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const file = path.join(root, "graphic-design-mockup.js");
const source = fs.readFileSync(file, "utf8");
const mockup = require(file);

test("Graphic Mockup exposes a standalone idempotent mount lifecycle", () => {
  assert.equal(typeof mockup.mount, "function");
  assert.equal(typeof mockup.unmount, "function");
  assert.match(source, /global\.HHGraphicMockup = api/);
  assert.match(source, /mounted\.has\(root\)/);
  assert.match(source, /root\.__hhGraphicMockupController/);
  assert.match(source, /function unmount\(root\)/);
});

test("Project schema provides devices, scene, timeline and export configuration", () => {
  const project = mockup.createDefaultProject();
  assert.equal(project.version, 1);
  assert.ok(mockup.DEVICE_PRESETS["phone-modern"]);
  assert.ok(mockup.DEVICE_PRESETS.tablet);
  assert.ok(mockup.DEVICE_PRESETS.laptop);
  assert.ok(mockup.DEVICE_PRESETS.browser);
  assert.ok(Object.keys(mockup.SCENE_PRESETS).length >= 5);
  assert.ok(project.timeline.keyframes.length >= 3);
  assert.equal(project.export.format, "png");
});

test("Normalization bounds unsafe project values and accepts only image data URLs", () => {
  const project = mockup.normalizeProject({
    meta: { name: "x".repeat(300) },
    device: { preset: "unknown", orientation: "sideways", frameColor: "red", screen: { name: "bad", dataUrl: "https://remote.example/image.png" } },
    transform: { rotateX: 999, rotateY: -999, rotateZ: 999, scale: 0, cameraDistance: 9 },
    scene: { preset: "bad", shadow: 9, reflection: 9, shadowBlur: -4 },
    timeline: { duration: 999, fps: 12, keyframes: [{ time: -5, easing: "spring", transform: {} }] },
    export: { width: 99999, height: 2, quality: 4 }
  });
  assert.equal(project.meta.name.length, 120);
  assert.equal(project.device.preset, "phone-modern");
  assert.equal(project.device.orientation, "portrait");
  assert.equal(project.device.frameColor, "#111827");
  assert.equal(project.device.screen.dataUrl, "");
  assert.equal(project.transform.rotateX, 75);
  assert.equal(project.transform.rotateY, -180);
  assert.equal(project.transform.scale, 0.35);
  assert.equal(project.transform.cameraDistance, 400);
  assert.equal(project.scene.shadow, 1);
  assert.equal(project.scene.reflection, 0.7);
  assert.equal(project.timeline.duration, 60);
  assert.equal(project.timeline.fps, 30);
  assert.equal(project.timeline.keyframes[0].time, 0);
  assert.equal(project.timeline.keyframes[0].easing, "ease-in-out");
  assert.equal(project.export.width, 4096);
  assert.equal(project.export.height, 320);
  assert.equal(project.export.quality, 1);
});

test("Orbit timeline interpolates transform with selectable easing", () => {
  const project = mockup.createDefaultProject();
  project.timeline.keyframes = [
    mockup.createKeyframe(0, { rotateX: 0, rotateY: -100, rotateZ: 0, scale: 1, cameraDistance: 1000 }, "linear"),
    mockup.createKeyframe(10, { rotateX: 20, rotateY: 100, rotateZ: 40, scale: 2, cameraDistance: 2000 }, "linear")
  ];
  const middle = mockup.transformAt(project, 5);
  assert.deepEqual(middle, { rotateX: 10, rotateY: 0, rotateZ: 20, scale: 1.5, cameraDistance: 1500 });
  assert.equal(mockup.interpolateTransform(project.timeline.keyframes[0].transform, project.timeline.keyframes[1].transform, 0.5, "ease-in").rotateY, -50);
});

test("Studio includes real local upload, drag drop, autosave, history and export actions", () => {
  for (const token of [
    "data-hm-screen-file", "FileReader", "readAsDataURL", "data-hm-dropzone", "dataTransfer.files",
    "localStorage", "STORAGE_KEY", "data-hm-action=\"undo\"", "data-hm-action=\"redo\"",
    "data-hm-action=\"export-png\"", "canvas.toBlob", "data-hm-action=\"export-json\"", "new runtime.Blob",
    "data-hm-action=\"add-keyframe\"", "data-hm-action=\"orbit-preset\""
  ]) assert.ok(source.includes(token), `missing token: ${token}`);
  assert.equal(mockup.STORAGE_KEY, "hh.graphic-mockup.project.v1");
});

test("Canvas renderer supports frame, background, shadow, reflection and uploaded screen", () => {
  for (const token of ["paintBackground", "drawDevice", "createLinearGradient", "shadowBlur", "reflection", "drawImage", "roundedRect", "cameraDistance"]) {
    assert.ok(source.includes(token), `missing canvas capability: ${token}`);
  }
  assert.equal(typeof mockup.renderCanvas, "function");
  assert.match(source, /if \(exporting\) return;/);
});

test("Canvas renderer executes without WebGL and paints a nonblank device preview", () => {
  const calls = [];
  const gradient = { addColorStop(offset, color) { calls.push(["stop", offset, color]); } };
  const context = {
    setTransform(...args) { calls.push(["setTransform", ...args]); }, clearRect() {}, fillRect(...args) { calls.push(["fillRect", ...args]); },
    createLinearGradient() { calls.push(["gradient"]); return gradient; }, save() {}, restore() {}, beginPath() {}, moveTo() {},
    arcTo() {}, closePath() {}, fill() { calls.push(["fill"]); }, stroke() {}, lineTo() {}, translate() {}, rotate() {}, transform() {},
    clip() {}, fillText(text) { calls.push(["text", text]); }, arc() {}, ellipse() {}, drawImage() { calls.push(["image"]); },
    set fillStyle(value) { calls.push(["fillStyle", value]); }, set strokeStyle(value) {}, set lineWidth(value) {}, set globalAlpha(value) {},
    set shadowColor(value) {}, set shadowBlur(value) {}, set shadowOffsetY(value) {}, set textAlign(value) {}, set font(value) {}
  };
  const canvas = { clientWidth: 960, clientHeight: 640, style: {}, getContext() { return context; } };
  assert.equal(mockup.renderCanvas(canvas, mockup.createDefaultProject(), { pixelRatio: 1 }), true);
  assert.equal(canvas.width, 960);
  assert.equal(canvas.height, 640);
  assert.ok(calls.some((entry) => entry[0] === "gradient"));
  assert.ok(calls.some((entry) => entry[0] === "fill"));
  assert.ok(calls.some((entry) => entry[0] === "text" && entry[1].includes("Thả ảnh")));
});

test("Export remains truthful about browser and advanced rendering boundaries", () => {
  assert.match(source, /PNG và JSON chạy trực tiếp trên thiết bị/);
  assert.match(source, /Render video, ray tracing và mô hình WebGL cần engine\/encoder chuyên dụng/);
  assert.match(source, /Canvas 2D · dữ liệu cục bộ/);
  assert.doesNotMatch(source, /THREE\.|Babylon|WebSocket|fetch\(|XMLHttpRequest|analytics|tracking/i);
  const serialized = mockup.serializeProject(mockup.createDefaultProject(), false);
  assert.equal(serialized.timeline.playing, false);
});

test("Workspace is responsive, accessible and respects reduced motion", () => {
  assert.match(source, /role=\"application\" aria-label=\"Studio tạo mockup thiết bị 3D\"/);
  assert.match(source, /aria-label=\"Bản xem trước mockup thiết bị\"/);
  assert.match(source, /role=\"status\" aria-live=\"polite\"/);
  assert.match(source, /@media\(max-width:720px\)/);
  assert.match(source, /prefers-reduced-motion:reduce/);
  assert.match(source, /matchMedia\(\"\(prefers-reduced-motion: reduce\)\"\)/);
  assert.doesNotMatch(source, /from\s+["'](three|babylon|fabric|pixi)/i);
});
