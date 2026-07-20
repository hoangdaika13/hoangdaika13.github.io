const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "graphic-design-quick-motion.js"), "utf8");
const quickMotion = require("../graphic-design-quick-motion.js");

test("Quick Motion exposes a standalone mount and unmount contract", () => {
  assert.equal(typeof quickMotion.mount, "function");
  assert.equal(typeof quickMotion.unmount, "function");
  assert.equal(quickMotion.VERSION, 1);
  assert.equal(quickMotion.FORMAT, "hh-quick-motion-project");
  assert.equal(quickMotion.STORAGE_KEY, "hh.graphic-quick-motion.project.v1");
  assert.match(source, /globalScope\.HHGraphicQuickMotion = api/);
  assert.match(source, /mounted\.has\(root\)/);
  assert.match(source, /mounted\.delete\(root\)/);
});

test("Vietnamese workflow covers logo, loading and social post makers", () => {
  assert.deepEqual(quickMotion.TEMPLATES.map((item) => item.id), ["logo", "loader", "social"]);
  assert.match(source, /Logo động/);
  assert.match(source, /Loading/);
  assert.match(source, /Bài đăng/);
  assert.match(source, /Bắt đầu nhanh/);
  assert.match(source, /Dự án tự lưu trên thiết bị/);
});

test("Default project contains normalized canvas, content, motion and timeline data", () => {
  for (const template of quickMotion.TEMPLATES) {
    const project = quickMotion.createDefaultProject(template.id);
    assert.equal(project.template, template.id);
    assert.equal(project.format, quickMotion.FORMAT);
    assert.ok(project.canvas.width >= 160);
    assert.ok(project.canvas.height >= 160);
    assert.equal(project.canvas.palette.length, 4);
    assert.ok(project.motion.duration >= 0.4);
    assert.ok(project.timeline.length >= 3);
  }
});

test("Normalizer bounds imported user data and rejects unsupported values", () => {
  const project = quickMotion.normalizeProject({
    template: "unknown",
    meta: { name: "x".repeat(300) },
    canvas: { width: 999999, height: 1, background: "red", palette: ["bad"] },
    content: { logo: "LONG-LOGO-NAME-HERE", shape: "star" },
    motion: { preset: "explode", duration: 999, easing: "elastic" },
    timeline: [{ time: -2, label: "a" }, { time: 5, label: "b" }]
  });
  assert.equal(project.template, "logo");
  assert.equal(project.meta.name.length, 100);
  assert.equal(project.canvas.width, 4096);
  assert.equal(project.canvas.height, 160);
  assert.equal(project.canvas.background, "#101426");
  assert.equal(project.content.logo.length, 12);
  assert.equal(project.content.shape, "rounded");
  assert.equal(project.motion.preset, "fade-up");
  assert.equal(project.motion.duration, 20);
  assert.equal(project.motion.easing, "ease");
  assert.deepEqual(project.timeline.map((key) => key.time), [0, 1]);
});

test("All animation presets return finite real preview transforms", () => {
  const project = quickMotion.createDefaultProject("logo");
  for (const preset of quickMotion.ANIMATION_PRESETS) {
    project.motion.preset = preset.id;
    for (const progress of [0, 0.25, 0.5, 1]) {
      const transform = quickMotion.motionTransform(project, progress);
      for (const key of ["x", "y", "scale", "rotate", "opacity"]) assert.ok(Number.isFinite(transform[key]), `${preset.id}.${key}`);
    }
  }
});

test("SVG renderer creates truthful template-specific vector previews", () => {
  for (const template of ["logo", "loader", "social"]) {
    const project = quickMotion.createDefaultProject(template);
    const svg = quickMotion.renderSvg(project, 0.5);
    assert.match(svg, /^<svg/);
    assert.match(svg, /viewBox=/);
    assert.match(svg, /hhqm-gradient/);
    assert.match(svg, /aria-label="Xem trước hoạt ảnh/);
    assert.match(svg, new RegExp(project.content.title));
  }
});

test("Exports include real project JSON, animated SVG and CSS", () => {
  const project = quickMotion.createDefaultProject("social");
  const json = JSON.parse(quickMotion.exportProject(project));
  const svg = quickMotion.exportAnimatedSvg(project);
  const css = quickMotion.exportCss(project);
  assert.equal(json.format, quickMotion.FORMAT);
  assert.match(svg, /^<svg/);
  assert.match(svg, /@keyframes hhqm-motion/);
  assert.match(css, /@keyframes hh-/);
  assert.match(css, /prefers-reduced-motion/);
});

test("UI includes timeline, keyframes, responsive controls and local-first operations", () => {
  for (const marker of [
    "data-qm-stage",
    "data-qm-track",
    "data-qm-add-key",
    "data-qm-play",
    "data-qm-undo",
    "data-qm-redo",
    "data-qm-import",
    "data-qm-export=\"svg\"",
    "FileReader",
    "localStorage",
    "requestAnimationFrame",
    "pointerdown",
    "prefers-reduced-motion",
    "@media(max-width:720px)",
    "aria-live=\"polite\""
  ]) assert.ok(source.includes(marker), `missing ${marker}`);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
  assert.doesNotMatch(source, /MediaRecorder|ffmpeg|GIFEncoder/);
  assert.match(source, /GIF\/MP4 cần encoder chuyên dụng/);
});

test("Live inspector editing updates preview without replacing focused controls", () => {
  assert.match(source, /function liveChange\(mutator\)/);
  assert.match(source, /liveChange\(\(draft\) => \{ draft\.content/);
  const body = source.slice(source.indexOf("function liveChange"), source.indexOf("function renderTemplates"));
  assert.match(body, /renderPreview\(\)/);
  assert.doesNotMatch(body, /render\(\)/);
});
