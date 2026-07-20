const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "graphic-design-animation.js"), "utf8");
const animation = require("../graphic-design-animation.js");

test("Graphic Animation exposes a versioned project schema and independent mount API", () => {
  assert.equal(animation.SCHEMA_VERSION, 1);
  assert.equal(animation.FORMAT, "hh-graphic-animation-project");
  assert.equal(animation.INTERNAL_LOTTIE_FORMAT, "hh-lottie-like-compatibility");
  assert.match(source, /window\.HHGraphicAnimation/);
  assert.match(source, /mount\(root\)/);
  assert.match(source, /\[data-graphic-animation\]/);
  assert.match(source, /dataset\.graphicAnimationMounted/);
});

test("timeline interpolation supports easing and scalar values", () => {
  assert.equal(animation.easingValue("linear", 0.5), 0.5);
  assert.equal(animation.easingValue("easeIn", 0.5), 0.25);
  assert.equal(animation.interpolateValue(0, 100, 0.25), 25);
  assert.deepEqual(animation.interpolateValue({ x: 0, y: 10 }, { x: 100, y: 30 }, 0.5), { x: 50, y: 20 });
});

test("project normalization keeps targets, tracks, state machine and safe limits", () => {
  const project = animation.normalizeProject({
    name: "Study",
    duration: 4200,
    targets: [{ id: "box", name: "Box", x: 10, y: 20, width: 200, height: 100 }],
    tracks: [{ id: "x", targetId: "box", property: "x", keyframes: [{ time: 0, value: 10 }, { time: 1000, value: 110, easing: "easeOut" }] }],
    stateMachine: { initial: "missing", states: [{ id: "idle", name: "Idle" }, { id: "active", name: "Active" }], transitions: [{ from: "idle", to: "active", trigger: "scroll" }] }
  });
  assert.equal(project.name, "Study");
  assert.equal(project.duration, 4200);
  assert.equal(project.targets[0].id, "box");
  assert.equal(project.stateMachine.initial, "idle");
  assert.equal(project.stateMachine.transitions[0].trigger, "scroll");
  assert.equal(project.tracks[0].keyframes[1].easing, "easeOut");
});

test("evaluateAt returns animated property values at a timeline position", () => {
  const project = animation.normalizeProject({
    duration: 1000,
    targets: [{ id: "box", name: "Box", x: 0, y: 0, width: 100, height: 100 }],
    tracks: [{ targetId: "box", property: "x", keyframes: [{ time: 0, value: 0 }, { time: 1000, value: 100 }] }]
  });
  assert.equal(animation.evaluateAt(project, 500).box.x, 50);
  assert.equal(animation.evaluateAt(project, 1000).box.x, 100);
});

test("keyframe and state machine helpers validate interaction contracts", () => {
  const keyframe = animation.createKeyframe(800, { opacity: 0.4 }, "not-an-easing");
  const state = animation.createState("Hover");
  const transition = animation.createTransition("rest", state.id, "data", "progress > 0");
  assert.equal(keyframe.time, 800);
  assert.equal(keyframe.easing, "linear");
  assert.equal(state.name, "Hover");
  assert.equal(transition.trigger, "data");
  assert.equal(transition.to, state.id);
});

test("exports are explicit JSON and Lottie-like output never claims official Lottie", () => {
  const project = animation.normalizeProject({ name: "Export Test" });
  const exported = JSON.parse(animation.exportProject(project));
  const lottieLike = JSON.parse(animation.exportLottieLike(project));
  assert.equal(exported.exportFormat, animation.FORMAT);
  assert.equal(lottieLike.format, animation.INTERNAL_LOTTIE_FORMAT);
  assert.match(lottieLike.compatibilityNote, /not an official Lottie/i);
  assert.equal(lottieLike.w, project.stage.width);
  assert.equal(lottieLike.layers.length, project.targets.length);
});

test("browser implementation includes the required local-first interaction surfaces", () => {
  for (const marker of [
    "requestAnimationFrame",
    "data-ga-action=\"play\"",
    "data-ga-action=\"stop\"",
    "data-ga-action=\"add-keyframe\"",
    "data-ga-action=\"new-transition\"",
    "data-ga-import-file",
    "pointerdown",
    "pointermove",
    "pointerup",
    "data-ga-tab=\"states\"",
    "data-ga-tab=\"triggers\"",
    "localStorage",
    "Ctrl Z"
  ]) assert.ok(source.includes(marker), `missing ${marker}`);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /socket\.io|WebSocket/);
});
