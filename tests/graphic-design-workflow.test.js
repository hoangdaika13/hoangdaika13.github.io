const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "graphic-design-workflow.js"), "utf8");
const studioSource = fs.readFileSync(path.join(root, "graphic-design-studio.js"), "utf8");
const workflow = require("../graphic-design-workflow.js");

function memoryStorage(initial) {
  const values = new Map(Object.entries(initial || {}));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    dump() { return Object.fromEntries(values); }
  };
}

test("integrated workflow exposes a versioned local-first contract", () => {
  assert.equal(workflow.VERSION, 1);
  assert.equal(workflow.INTEGRATION_VERSION, 6);
  assert.equal(workflow.FORMAT, "hh-graphic-design-workflow");
  assert.equal(workflow.STORAGE_KEY, "hh.graphic-design.workflow.v1");
  assert.deepEqual(workflow.STEPS.map((step) => step.id), ["design", "system", "qa", "review", "deliver"]);
  assert.equal(typeof workflow.mount, "function");
  assert.equal(typeof workflow.unmount, "function");
  assert.match(source, /globalScope\.HHGraphicDesignWorkflow = api/);
});

test("state normalization bounds user fields and rejects unsafe colors and fonts", () => {
  const state = workflow.normalizeState({
    activeStep: "bad-step",
    projectName: "<script>" + "x".repeat(200),
    brand: {
      name: "<img src=x onerror=1>",
      primary: "javascript:alert(1)",
      heading: "Bad;}</style><script>alert(1)</script>"
    },
    history: Array.from({ length: 30 }, (_, index) => ({ id: `snapshot ${index}`, label: `<b>${index}</b>` }))
  });
  assert.equal(state.activeStep, "design");
  assert.equal(state.projectName.length, 120);
  assert.equal(state.brand.primary, "#FF5FC8");
  assert.doesNotMatch(state.brand.heading, /[;{}<>'"]/);
  assert.equal(state.history.length, workflow.MAX_HISTORY);
  assert.match(workflow.escapeHtml(state.brand.name), /&lt;img/);
});

test("storage driver only restores the exact hh workflow schema version", () => {
  const storage = memoryStorage();
  const driver = workflow.createStorageDriver(storage);
  assert.equal(driver.supported, true);
  const state = workflow.createDefaultState();
  state.projectName = "Local project";
  assert.deepEqual(driver.save(state), { ok: true, reason: null });
  assert.equal(driver.load().state.projectName, "Local project");
  storage.setItem(workflow.STORAGE_KEY, JSON.stringify({ format: workflow.FORMAT, version: 99, projectName: "Future" }));
  assert.equal(driver.load().reason, "version");
  assert.equal(workflow.createStorageDriver(null).load().reason, "unsupported");
});

test("contrast audit uses WCAG luminance thresholds without external calls", () => {
  assert.equal(workflow.contrastRatio("#000000", "#FFFFFF"), 21);
  const reports = workflow.auditContrast({ background: "#000000", surface: "#111111", text: "#FFFFFF", primary: "#777777", secondary: "#00FFFF", accent: "#FFFF00" });
  assert.equal(reports.length, 5);
  assert.equal(reports[0].aaa, true);
  assert.ok(reports.some((report) => report.aa));
  assert.ok(reports.every((report) => Number.isFinite(report.ratio)));
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|sendBeacon/i);
});

test("snapshots capture and restore real vector and component controller state", () => {
  const calls = [];
  const controllers = {
    vector: { getProject: () => ({ format: "vector", layers: [{ id: "title" }] }), setProject: (value) => calls.push(["vector", value]) },
    components: { getProject: () => ({ format: "components", library: { components: [] } }), setProject: (value) => calls.push(["components", value]) }
  };
  const captured = workflow.captureSnapshot(workflow.createDefaultState(), controllers, "Milestone 1");
  assert.equal(captured.snapshot.label, "Milestone 1");
  assert.equal(captured.snapshot.vector.layers[0].id, "title");
  assert.equal(captured.state.history.length, 1);
  const restored = workflow.restoreSnapshot(captured.state, captured.snapshot.id, controllers);
  assert.equal(restored.ok, true);
  assert.deepEqual(calls.map((entry) => entry[0]), ["vector", "components"]);
});

test("CSS, handoff and workflow package outputs are generated from live controllers", () => {
  const state = workflow.createDefaultState();
  state.projectName = "Delivery";
  const controllers = {
    vector: {
      getProject: () => ({ format: "hh-vector-motion-project", version: 1, stage: { width: 1280, height: 720 }, layers: [{ id: "hero", name: "Hero", type: "path" }] }),
      exportAnimatedSvg: () => "<svg></svg>",
      exportLottie: () => '{"v":"5.12.2"}'
    },
    components: { getProject: () => ({ activeTheme: "dark", library: { components: [{ id: "button" }] } }) }
  };
  const apis = {
    components: {
      exportDevMode: () => ({ format: "hh-dev-handoff", cssVariables: ":root{}" }),
      exportCssVariables: () => ":root{--hh-color-accent:#fff;}"
    }
  };
  const css = workflow.buildBrandCss({ heading: '</style><script>x</script>', primary: "bad" }, apis.components.exportCssVariables());
  assert.match(css, /--hh-brand-primary: #FF5FC8/);
  assert.doesNotMatch(css, /<script>/);
  const handoff = workflow.buildHandoff(state, controllers, apis);
  assert.equal(handoff.format, "hh-design-dev-handoff");
  assert.equal(handoff.outputs.svg, true);
  assert.equal(handoff.outputs.lottie, true);
  assert.equal(handoff.outputs.css, true);
  assert.equal(handoff.vector.layers[0].id, "hero");
  const packed = JSON.parse(workflow.serializePackage(state, controllers));
  assert.equal(packed.format, workflow.FORMAT);
  assert.equal(workflow.parsePackage(JSON.stringify(packed)).vector.stage.width, 1280);
  assert.throws(() => workflow.parsePackage('{"format":"other","version":1}'), /không đúng định dạng/);
});

test("the UI uses real engines, honest realtime capability and working export controls", () => {
  for (const marker of [
    "graphic-design-vector-core.js?v=2",
    "graphic-design-components.js?v=2",
    "graphic-design-collaboration.js?v=2",
    "data-gdw-vector",
    "data-gdw-components",
    "data-gdw-collaboration",
    "data-gdw-export=\"svg\"",
    "data-gdw-export=\"lottie\"",
    "data-gdw-export=\"css\"",
    "data-gdw-export=\"handoff\"",
    "serverConfirmed",
    "Không tạo presence giả"
  ]) assert.ok(source.includes(marker), `missing ${marker}`);
  assert.doesNotMatch(source, /fake collaborator|mock socket|setInterval\([^)]*cursor/i);
});

test("studio exposes workflow route and integration version without shell edits", () => {
  assert.match(studioSource, /const INTEGRATION_VERSION = 6/);
  assert.match(studioSource, /id: "workflow"/);
  assert.match(studioSource, /graphic-design-workflow\.js\?v=1/);
  assert.match(studioSource, /data-graphic-design-workflow/);
  assert.match(studioSource, /HHGraphicDesignWorkflow\?\.unmount/);
  assert.match(studioSource, /Object\.freeze\(\{ INTEGRATION_VERSION, mount/);
});

test("workflow is semantic, keyboard operable, 375px safe and reduced-motion aware", () => {
  assert.match(source, /role=\"tablist\"/);
  assert.match(source, /role=\"tabpanel\"/);
  assert.match(source, /aria-live=\"polite\"/);
  assert.match(source, /ArrowLeft/);
  assert.match(source, /ArrowRight/);
  assert.match(source, /event\.key\.toLowerCase\(\) === "s"/);
  assert.match(source, /@media\(max-width:520px\)/);
  assert.match(source, /overflow-x:auto/);
  assert.match(source, /@media\(prefers-reduced-motion:reduce\)/);
});
