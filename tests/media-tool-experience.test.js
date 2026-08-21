const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const experience = require(path.join(root, "media-tool-experience.js"));
const pageSource = fs.readFileSync(path.join(root, "media-design-page.js"), "utf8");
const studioSource = fs.readFileSync(path.join(root, "media-design-studio.js"), "utf8");
const cssSource = fs.readFileSync(path.join(root, "media-tool-experience.css"), "utf8");
const loaderSource = fs.readFileSync(path.join(root, "performance-loader.js"), "utf8");
const workerSource = fs.readFileSync(path.join(root, "sw.js"), "utf8");

const expectedTools = [
  "media-core", "production-workflow", "universal-media", "asset-manager", "review-studio", "universal-canvas",
  "photo-workspace", "ai-task-center", "photo-editor", "video-workspace", "motion-compositor", "audio-workspace",
  "background-remover", "collage", "inspector", "compress", "convert", "image", "document-workspace", "pdf", "qr",
  "brand-workspace", "dev-handoff", "color", "type", "icon", "svg", "gradient", "picker", "asset-workspace",
  "media-cloud", "social-post", "brand-kit", "favicon", "meme", "export-workspace"
];

test("all 36 Media & Design tools have a unique visual signature", () => {
  assert.deepEqual(Object.keys(experience.SIGNATURES).sort(), [...expectedTools].sort());
  const motions = Object.values(experience.SIGNATURES).map((item) => item.motion);
  assert.equal(new Set(motions).size, expectedTools.length);
  Object.values(experience.SIGNATURES).forEach((item) => {
    assert.match(item.accent, /^#[0-9a-f]{6}$/i);
    assert.match(item.glow, /^#[0-9a-f]{6}$/i);
    assert.ok(item.scene);
    assert.ok(item.label);
  });
});

test("tool rail exposes every routed engine without a generic fallback entry", () => {
  expectedTools.forEach((id) => assert.match(pageSource, new RegExp(`id: ["']${id}["']`)));
  assert.match(pageSource, /const toolRailMarkup/);
  assert.match(pageSource, /HHMediaToolExperience\?\.decorate/);
  assert.match(pageSource, /data-mdp-tool-rail/);
  assert.match(pageSource, /HHMediaAudioStudio/);
  assert.match(pageSource, /HHMediaNextSuite/);
  assert.match(pageSource, /HHMediaProfessionalSuite/);
  assert.match(pageSource, /HHMediaProductionWorkflow/);
  assert.match(pageSource, /HHUniversalMediaProject/);
  assert.match(pageSource, /HHMediaDesign/);
});

test("compressor, converter and image toolkit keep real processing but use distinct layouts", () => {
  assert.match(studioSource, /md-image-layout--\$\{kind\}/);
  assert.match(studioSource, /Nén và đo kết quả/);
  assert.match(studioSource, /Chuyển đổi định dạng/);
  assert.match(studioSource, /Áp dụng lên canvas/);
  assert.match(studioSource, /processImage\(work, name\)/);
  assert.match(cssSource, /md-image-layout--compressor/);
  assert.match(cssSource, /md-image-layout--converter/);
  assert.match(cssSource, /md-image-layout--toolkit/);
});

test("experience layer is route-loaded, offline-cached, responsive and motion-safe", () => {
  assert.match(loaderSource, /media-tool-experience\.css\?v=2/);
  assert.match(loaderSource, /media-tool-experience\.js\?v=2/);
  assert.match(workerSource, /media-tool-experience\.css\?v=2/);
  assert.match(workerSource, /media-tool-experience\.js\?v=2/);
  assert.match(cssSource, /@media\(max-width:720px\)/);
  assert.match(cssSource, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(cssSource, /is-tab-hidden/);
});
