const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const file = path.join(root, "graphic-design-adaptive.js");
const source = fs.readFileSync(file, "utf8");
const adaptive = require(file);

test("Adaptive Design exposes a standalone global lifecycle", () => {
  assert.equal(adaptive.VERSION, 1);
  assert.equal(adaptive.FORMAT, "hh-adaptive-design");
  assert.equal(typeof adaptive.mount, "function");
  assert.equal(typeof adaptive.unmount, "function");
  assert.match(source, /globalScope\.HHGraphicAdaptive = api/);
  assert.match(source, /instances\.has\(root\)/);
  assert.match(source, /instances\.delete\(root\)/);
});

test("Master design generates the five required synchronized variants", () => {
  assert.deepEqual(Object.keys(adaptive.PRESETS), ["instagram", "story", "youtube", "banner", "ads"]);
  const project = adaptive.createDefaultProject();
  project.master.title = "Nội dung dùng chung";
  project.brand.primary = "#123456";
  const variants = adaptive.createVariants(project);
  assert.equal(variants.length, 5);
  for (const variant of variants) {
    assert.equal(variant.content.title, "Nội dung dùng chung");
    assert.equal(variant.brand.primary, "#123456");
    assert.equal(variant.layout.width, adaptive.PRESETS[variant.presetId].width);
    assert.equal(variant.layout.height, adaptive.PRESETS[variant.presetId].height);
  }
});

test("Normalizer bounds imported data and rejects unsafe embedded images", () => {
  const project = adaptive.normalizeProject({
    name: "x".repeat(300),
    master: {
      title: "t".repeat(300), overlay: 9, titleScale: 0, align: "diagonal",
      focalPoint: { x: -4, y: 8 }, image: { dataUrl: "https://remote.invalid/image.png" }
    },
    brand: { primary: "red", secondary: "#112233", fontHeading: "Comic Sans" },
    variants: [{ presetId: "story", enabled: false }]
  });
  assert.equal(project.name.length, 160);
  assert.equal(project.master.title.length, 180);
  assert.equal(project.master.overlay, 0.9);
  assert.equal(project.master.titleScale, 0.6);
  assert.equal(project.master.align, "left");
  assert.deepEqual(project.master.focalPoint, { x: 0, y: 1 });
  assert.equal(project.master.image, null);
  assert.equal(project.brand.primary, "#F25CB4");
  assert.equal(project.brand.secondary, "#112233");
  assert.equal(project.brand.fontHeading, "Inter");
  assert.equal(project.variants.find((item) => item.presetId === "story").enabled, false);
});

test("Smart crop covers the target while preserving the focal point", () => {
  const centered = adaptive.calculateCoverCrop(2000, 1000, 1000, 1000, { x: 0.5, y: 0.5 });
  assert.deepEqual(centered, { sx: 500, sy: 0, sw: 1000, sh: 1000, dx: 0, dy: 0, dw: 1000, dh: 1000, scale: 1 });
  const right = adaptive.calculateCoverCrop(2000, 1000, 1000, 1000, { x: 1, y: 0.5 });
  assert.equal(right.sx, 1000);
  const portrait = adaptive.calculateCoverCrop(1000, 2000, 1000, 500, { x: 0.5, y: 0 });
  assert.equal(portrait.sy, 0);
  assert.equal(portrait.sw, 1000);
  assert.equal(portrait.sh, 500);
});

test("Reflow constraints and safe zones adapt typography to each platform", () => {
  const project = adaptive.createDefaultProject();
  const story = adaptive.reflowLayout(project, "story");
  const youtube = adaptive.reflowLayout(project, "youtube");
  const banner = adaptive.reflowLayout(project, "banner");
  assert.deepEqual(adaptive.safeZone("story"), adaptive.PRESETS.story.safe);
  assert.ok(story.content.y > youtube.content.y);
  assert.ok(story.safe.top > youtube.safe.top);
  assert.ok(banner.title.maxLines <= story.title.maxLines);
  assert.ok(banner.content.width <= banner.width);
  assert.equal(story.content.anchor, "left");
});

test("Canvas renderer paints brand background, text, CTA and optional safe zone", () => {
  const calls = [];
  const gradient = { addColorStop(offset, color) { calls.push(["stop", offset, color]); } };
  const context = {
    setTransform(...args) { calls.push(["transform", ...args]); }, createLinearGradient() { calls.push(["gradient"]); return gradient; },
    fillRect(...args) { calls.push(["fillRect", ...args]); }, drawImage(...args) { calls.push(["drawImage", ...args]); },
    measureText(text) { return { width: String(text).length * 20 }; }, fillText(text) { calls.push(["text", text]); },
    beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, closePath() {}, fill() { calls.push(["fill"]); },
    save() {}, restore() {}, strokeRect(...args) { calls.push(["safe", ...args]); }, setLineDash() {},
    set fillStyle(value) { calls.push(["fillStyle", value]); }, set strokeStyle(value) {}, set lineWidth(value) {},
    set font(value) { calls.push(["font", value]); }, set textAlign(value) {}, set textBaseline(value) {}, set globalAlpha(value) {}
  };
  const canvas = { getContext() { return context; } };
  const image = { naturalWidth: 2000, naturalHeight: 1000 };
  assert.equal(adaptive.renderArtboard(canvas, adaptive.createDefaultProject(), "youtube", { image, showSafeZone: true, pixelRatio: 0.5 }), true);
  assert.equal(canvas.width, 640);
  assert.equal(canvas.height, 360);
  assert.ok(calls.some((entry) => entry[0] === "gradient"));
  assert.ok(calls.some((entry) => entry[0] === "drawImage"));
  assert.ok(calls.some((entry) => entry[0] === "text" && entry[1] === "Một thiết kế, mọi định dạng"));
  assert.ok(calls.some((entry) => entry[0] === "safe"));
});

test("Project JSON and Brand Kit token exports are truthful and reusable", () => {
  const project = adaptive.createDefaultProject();
  project.brand.primary = "#123456";
  const parsed = JSON.parse(adaptive.serializeProject(project));
  const tokens = adaptive.brandTokens(project);
  assert.equal(parsed.format, adaptive.FORMAT);
  assert.match(tokens, /--brand-primary: #123456/);
  assert.match(tokens, /--brand-font-heading: "Inter"/);
});

test("UI includes real local upload, focal editing, synced artboards and PNG export", () => {
  for (const token of [
    "data-gad-field=\"title\"", "data-gad-brand=\"primary\"", "data-gad-focal", "data-gad-drop",
    "data-gad-canvas", "data-gad-export", "data-gad-action=\"toggle-safe\"", "data-gad-action=\"copy-tokens\"",
    "FileReader", "readAsDataURL", "canvas.toBlob", "localStorage", "STORAGE_KEY", "dataTransfer.files",
    "Ctrl", "aria-live=\"polite\"", "@media(max-width:680px)", "prefers-reduced-motion:reduce"
  ]) assert.ok(source.includes(token), `missing ${token}`);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
  assert.doesNotMatch(source, /ffmpeg|GIFEncoder|MediaRecorder/);
});
