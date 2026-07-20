const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const file = path.join(root, "creative-os-core.js");
const source = fs.readFileSync(file, "utf8");
const core = require(file);

function memoryStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    dump: () => Object.fromEntries(data)
  };
}

test("Creative OS exposes a versioned local-first API", () => {
  assert.equal(core.VERSION, 1);
  assert.equal(core.STORAGE_KEY, "hh.creative-os.v1");
  assert.equal(core.FORMAT, "hh-creative-project");
  for (const method of ["createStore", "createDefaultState", "normalizeState", "migrateState", "exportProject", "importProject"]) {
    assert.equal(typeof core[method], "function", method);
  }
  assert.match(source, /globalScope\.HHCreativeCore = api/);
  assert.doesNotMatch(source, /(?:AIza|sk-|mongodb\+srv|PRIVATE KEY)/i);
});

test("default and normalized projects contain the complete Creative OS schema", () => {
  const project = core.normalizeProject({ name: "Chiến dịch mùa hè" });
  for (const key of [
    "id", "name", "brief", "prompts", "scripts", "storyboard", "assets", "versions",
    "publishing", "world", "workflows", "brand", "review", "analytics", "rights", "createdAt", "updatedAt"
  ]) assert.ok(Object.hasOwn(project, key), key);
  const state = core.createDefaultState();
  assert.equal(state.version, 1);
  assert.deepEqual(state.projects, []);
});

test("normalization sanitizes text, bounds values, data, and sensitive keys", () => {
  const state = core.normalizeState({
    version: 1,
    projects: [{
      id: "project<script>",
      name: `Demo\u0000${"x".repeat(300)}`,
      brief: { product: "Video", apiKey: "must-not-survive", password: "hidden" },
      assets: [{ name: "Huge", source: `data:image/png;base64,${"a".repeat(700000)}` }],
      analytics: { progress: 999, estimatedCost: -5 }
    }]
  });
  assert.doesNotMatch(state.projects[0].id, /[<>]/);
  assert.equal(state.projects[0].name.length, 180);
  assert.equal(state.projects[0].brief.apiKey, undefined);
  assert.equal(state.projects[0].brief.password, undefined);
  assert.equal(state.projects[0].assets[0].source, "");
  assert.equal(state.projects[0].analytics.progress, 100);
  assert.equal(state.projects[0].analytics.estimatedCost, 0);
});

test("store creates, updates, activates, persists, and clones projects", () => {
  const storage = memoryStorage();
  const store = core.createStore({ storage });
  const events = [];
  const unsubscribe = store.subscribe((state, action) => events.push({ state, action }));
  const first = store.createProject({ name: "Series AI", brief: { platform: "YouTube" } });
  const second = store.createProject({ name: "Podcast" });
  store.updateProject(first.id, { brief: { audience: "Sinh viên" }, analytics: { progress: 48 } });
  store.setActiveProject(first.id);

  const state = store.getState();
  assert.equal(state.projects.length, 2);
  assert.equal(state.activeProjectId, first.id);
  assert.equal(state.projects.find((item) => item.id === first.id).brief.platform, "YouTube");
  assert.equal(state.projects.find((item) => item.id === first.id).brief.audience, "Sinh viên");
  assert.equal(state.projects.find((item) => item.id === first.id).analytics.progress, 48);
  state.projects[0].name = "mutated";
  assert.equal(store.getState().projects.find((item) => item.id === second.id).name, "Podcast");
  assert.ok(storage.dump()[core.STORAGE_KEY]);
  assert.equal(events.length, 4);
  unsubscribe();
});

test("asset, AI run, snapshot, export, and import operations round-trip", () => {
  const store = core.createStore({ storage: memoryStorage() });
  const project = store.createProject({ name: "Launch" });
  const asset = store.addAsset(project.id, { name: "cover.png", type: "image/png", size: 1200, source: "data:image/png;base64,AAAA" });
  const run = store.addRun(project.id, { provider: "Gemini", model: "flash", action: "brief", tokens: 340, estimatedCost: 0.02 });
  const version = store.snapshotProject(project.id, "Bản duyệt 1", "Trước khi chỉnh CTA");
  assert.equal(asset.name, "cover.png");
  assert.equal(run.estimatedCost, 0.02);
  assert.equal(version.label, "Bản duyệt 1");
  assert.equal(store.getState().projects[0].analytics.runs.length, 1);

  const exported = store.exportProject(project.id);
  const parsed = JSON.parse(exported);
  assert.equal(parsed.format, core.FORMAT);
  const target = core.createStore({ storage: memoryStorage() });
  const restored = target.importProject(exported);
  assert.equal(restored.name, "Launch");
  assert.equal(restored.assets[0].name, "cover.png");
  assert.equal(restored.versions[0].label, "Bản duyệt 1");
});

test("imports fail honestly for invalid, unsupported, or oversized data", () => {
  assert.throws(() => core.importProject("not-json"), (err) => err.code === "INVALID_JSON");
  assert.throws(() => core.importProject(JSON.stringify({ format: "other", version: 1 })), (err) => err.code === "UNSUPPORTED_FORMAT");
  assert.throws(() => core.importProject(JSON.stringify({ format: core.FORMAT, version: 2, project: {} })), (err) => err.code === "UNSUPPORTED_VERSION");
  const huge = JSON.stringify({ format: core.FORMAT, version: 1, project: { name: "x".repeat(core.MAX_PROJECT_BYTES + 100) } });
  assert.throws(() => core.importProject(huge), (err) => err.code === "PROJECT_TOO_LARGE");
});

test("project count is capped at 50 without removing existing work", () => {
  const store = core.createStore({ storage: memoryStorage() });
  for (let index = 0; index < core.MAX_PROJECTS; index += 1) store.createProject({ id: `p-${index}`, name: `Project ${index}` });
  assert.equal(store.getState().projects.length, 50);
  assert.throws(() => store.createProject({ name: "Overflow" }), (err) => err.code === "PROJECT_LIMIT");
  assert.equal(store.getState().projects.length, 50);
});

test("legacy unversioned state migrates to v1 and persisted state reloads", () => {
  const migrated = core.migrateState({ projects: [{ id: "legacy", name: "Legacy" }], active: "legacy" });
  assert.equal(migrated.version, 1);
  const storage = memoryStorage();
  const first = core.createStore({ storage, initialState: migrated });
  first.createProject({ id: "new-one", name: "New" });
  const second = core.createStore({ storage });
  assert.equal(second.getState().projects[0].name, "New");
  assert.equal(second.getState().activeProjectId, "new-one");
});
