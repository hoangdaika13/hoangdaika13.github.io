const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const cosmos = require(path.join(root, "media-cosmos.js"));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Media Cosmos publishes seven colored workspaces and a versioned local-first state", () => {
  assert.equal(cosmos.SCHEMA, "hh.media.cosmos.v1");
  assert.equal(cosmos.STATE_KEY, "hh.media.cosmos.v1");
  assert.equal(cosmos.PLANETS.length, 7);
  assert.equal(cosmos.THEMES.length, 6);
  assert.deepEqual(cosmos.PLANETS.map((planet) => planet.id), ["universal", "photo", "video", "documents", "brand", "assets", "export"]);
  const values = new Map();
  const store = cosmos.createStateStore({ getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) });
  const state = store.save({ theme: "aurora", lastTool: "video-editor", lastToolName: "<Video>" });
  assert.equal(state.theme, "aurora");
  assert.equal(store.load().lastTool, "video-editor");
  assert.equal(cosmos.escapeHtml(store.load().lastToolName), "&lt;Video&gt;");
});

test("Adaptive Export creates honest plans for five requested surfaces", () => {
  const jobs = cosmos.createAdaptiveExportPlan({ name: "Launch Film" }, "2026-07-26T00:00:00.000Z");
  assert.equal(jobs.length, 5);
  assert.deepEqual(jobs.map((job) => [job.width, job.height]), [[1920, 1080], [1080, 1920], [1080, 1080], [1280, 720], [1080, 1920]]);
  assert.ok(jobs.every((job) => job.status === "planned"));
  assert.ok(jobs.every((job) => job.cost === 0));
  assert.ok(jobs.every((job) => /chưa render/i.test(job.message)));
});

test("queue actions pause, resume and cancel local work without faking server retries", () => {
  const job = cosmos.createAdaptiveExportPlan({ name: "Campaign" })[0];
  const paused = cosmos.applyQueueAction(job, "pause");
  assert.equal(paused.status, "paused");
  assert.equal(cosmos.applyQueueAction(paused, "resume").status, "planned");
  assert.equal(cosmos.applyQueueAction(paused, "cancel").status, "canceled");
  const retry = cosmos.applyQueueAction({ ...job, status: "failed" }, "retry");
  assert.equal(retry.status, "needs-adapter");
  assert.match(retry.message, /adapter/i);
  const running = cosmos.applyQueueAction({ ...job, status: "running" }, "cancel");
  assert.equal(running.status, "running");
  assert.match(running.message, /server/i);
});

test("effects only animate during preview or render and respect weak devices", () => {
  const healthy = { navigator: { deviceMemory: 8, hardwareConcurrency: 8, connection: { saveData: false } }, matchMedia: () => ({ matches: false }) };
  assert.equal(cosmos.getEffectsPolicy(healthy, "idle").particles, false);
  assert.equal(cosmos.getEffectsPolicy(healthy, "preview").particles, true);
  const weak = { navigator: { deviceMemory: 2, hardwareConcurrency: 2 }, matchMedia: () => ({ matches: false }) };
  assert.equal(cosmos.getEffectsPolicy(weak, "render").particles, false);
  const reduced = { navigator: { deviceMemory: 8, hardwareConcurrency: 8 }, matchMedia: () => ({ matches: true }) };
  assert.equal(cosmos.getEffectsPolicy(reduced, "preview").particles, false);
});

test("provenance graph records providers, derivations and rights warnings from real metadata", () => {
  const project = { id: "project", name: "Film", requiredFonts: [] };
  const assets = [
    { id: "source", name: "Source.png", kind: "image", availability: "ready", blob: {}, metadata: {} },
    { id: "cover", name: "Cover.png", kind: "image", availability: "ready", blob: {}, references: ["source"], metadata: { aiProvider: "Provider A" } }
  ];
  const graph = cosmos.buildProvenanceGraph(project, assets);
  assert.equal(graph.providers, 1);
  assert.ok(graph.edges.some((edge) => edge.from === "source" && edge.to === "cover" && edge.relation === "derived"));
  const mediaApi = { assessWarnings: () => [] };
  const warnings = cosmos.assessCosmosWarnings(project, assets, [{ id: "render", name: "Vertical", status: "failed" }], { mediaApi });
  assert.ok(warnings.some((warning) => warning.code === "missing-rights"));
  assert.ok(warnings.some((warning) => warning.code === "export-failed"));
});

test("Media Cosmos is loaded before the Media page and remains responsive and motion-safe", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const page = read("media-design-page.js");
  const css = read("media-cosmos.css");
  assert.match(loader, /media-cosmos\.css\?v=2/);
  assert.match(loader, /media-cosmos\.js\?v=2[\s\S]*media-design-page\.js/);
  assert.match(worker, /media-cosmos\.css\?v=2/);
  assert.match(worker, /media-cosmos\.js\?v=2/);
  assert.match(page, /HHMediaCosmos\?\.mount/);
  assert.match(page, /HHMediaCosmos\?\.recordTool/);
  assert.match(css, /@media\(max-width:520px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /:focus-visible/);
});
