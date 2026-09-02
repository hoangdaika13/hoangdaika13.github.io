const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dataSource = fs.readFileSync(path.join(root, "galaxy-layer-one-data.js"), "utf8");
const studioSource = fs.readFileSync(path.join(root, "galaxy-creator-studio.js"), "utf8");
const layerOneSource = fs.readFileSync(path.join(root, "galaxy-layer-one.js"), "utf8");
const loaderSource = fs.readFileSync(path.join(root, "performance-loader.js"), "utf8");
const routerSource = fs.readFileSync(path.join(root, "script.js"), "utf8");
const studioStyles = fs.readFileSync(path.join(root, "galaxy-creator-studio.css"), "utf8");
const data = require("../galaxy-layer-one-data.js");
const studio = require("../galaxy-creator-studio.js");

const FIXED_NOW = new Date("2026-08-31T09:30:00.000Z");
const now = () => new Date(FIXED_NOW);

function makeStore() {
  return data.createStore({ storage: data.memoryStorage(), now });
}

function fakeHost() {
  const listeners = new Map();
  const attributes = new Map();
  const classes = new Set();
  const documentListeners = new Map();
  const selectorNodes = new Map();
  const ownerDocument = {
    hidden: false,
    activeElement: null,
    addEventListener(type, handler) { documentListeners.set(type, handler); },
    removeEventListener(type) { documentListeners.delete(type); }
  };
  const saveLabel = { textContent: "" };
  const saveNode = { dataset: {}, querySelector(selector) { return selector === "span" ? saveLabel : null; } };
  const host = {
    innerHTML: "",
    dataset: {},
    ownerDocument,
    classList: {
      add(...names) { names.forEach((name) => classes.add(name)); },
      remove(...names) { names.forEach((name) => classes.delete(name)); },
      contains(name) { return classes.has(name); }
    },
    querySelector(selector) {
      if (selector === "[data-gcs-save-state]") return saveNode;
      const nodes = selectorNodes.get(selector) || [];
      return nodes[0] || null;
    },
    querySelectorAll(selector) { return selectorNodes.get(selector) || []; },
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type) { listeners.delete(type); },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    removeAttribute(name) { attributes.delete(name); },
    replaceChildren() { this.innerHTML = ""; }
  };
  return {
    host,
    listeners,
    documentListeners,
    saveNode,
    saveLabel,
    classes,
    setSelectorNodes(selector, nodes) { selectorNodes.set(selector, nodes); }
  };
}

function actionNode(action, parentNode) {
  return {
    parentNode,
    focusCount: 0,
    focus() { this.focusCount += 1; },
    matches(selector) { return selector === "[data-gcs-action]"; },
    getAttribute(name) { return name === "data-gcs-action" ? action : null; }
  };
}

test("Layer-one data exports the canonical nine-step pipeline", () => {
  assert.equal(global.HHGalaxyLayerOneData, data);
  assert.equal(data.VERSION, "1.0.0");
  assert.equal(data.STORAGE_KEY, "hh-galaxy.creator-studio.v1");
  assert.equal(data.PIPELINE_STEPS.length, 9);
  assert.deepEqual(
    data.PIPELINE_STEPS.map((step) => step.label),
    ["IDEA", "SCRIPT", "IMAGE", "VOICE", "MUSIC", "VIDEO", "THUMBNAIL", "SEO", "PUBLISH"]
  );
  assert.deepEqual(data.STEP_STATUSES.map((status) => status.id), ["not-started", "in-progress", "review", "completed"]);
  assert.ok(Object.isFrozen(data.PIPELINE_STEPS));
  assert.ok(Object.isFrozen(data.SAMPLE_PROJECTS));
});

test("every sample record is explicitly read-only and traceable", () => {
  assert.ok(data.SAMPLE_PROJECTS.length >= 3);
  for (const project of data.SAMPLE_PROJECTS) {
    assert.equal(project.isDemo, true);
    assert.equal(project.source, "local-template");
    assert.equal(project.templateVersion, "1.0.0");
    assert.equal(project.editable, false);
    assert.equal(Object.keys(project.steps).length, 9);
  }
  for (const item of data.SAMPLE_SCHEDULE) {
    assert.equal(item.isDemo, true);
    assert.equal(item.source, "local-template");
    assert.equal(item.templateVersion, "1.0.0");
    assert.equal(item.editable, false);
  }
});

test("progress is derived from all nine step states instead of a stored metric", () => {
  const project = data.normalizeProject({
    title: "Progress test",
    steps: Object.fromEntries(data.PIPELINE_STEPS.map((step, index) => [step.id, {
      status: index < 3 ? "completed" : index < 6 ? "review" : index < 8 ? "in-progress" : "not-started"
    }]))
  }, { nowIso: FIXED_NOW.toISOString() });
  // (3 * 1 + 3 * .8 + 2 * .5 + 0) / 9 = 71.111...
  assert.equal(data.progressOf(project), 71);
  project.progress = 100;
  assert.equal(data.progressOf(project), 71, "an injected progress property must not affect calculation");
});

test("the store supports real local CRUD and protects demos from mutation", () => {
  const store = makeStore();
  assert.equal(store.storageKind(), "adapter");
  assert.equal(store.getSnapshot().projects.length, data.SAMPLE_PROJECTS.length);
  assert.throws(() => store.updateProject("demo-ai-space-journey", { title: "Mutated" }), { code: "DEMO_READ_ONLY" });
  assert.throws(() => store.removeProject("demo-ai-space-journey"), { code: "DEMO_READ_ONLY" });

  const created = store.createProject({ title: "Dự án thật", description: "Dữ liệu người dùng", category: "Video" });
  assert.equal(created.isDemo, false);
  assert.equal(created.source, "user");
  assert.equal(created.editable, true);
  assert.equal(data.progressOf(created), 0);

  const updated = store.updateStep(created.id, "idea", { status: "completed", content: "Ý tưởng đã xác nhận" });
  assert.equal(updated.steps.idea.status, "completed");
  assert.equal(updated.steps.idea.content, "Ý tưởng đã xác nhận");
  assert.equal(data.progressOf(updated), 11);
  assert.equal(store.updateProject(created.id, { title: "Tên đã đổi" }).title, "Tên đã đổi");

  assert.equal(store.removeProject(created.id), true);
  assert.equal(store.getProject(created.id), null);
});

test("a demo becomes editable only through clone-before-edit", () => {
  const store = makeStore();
  const clone = store.cloneProject("demo-ai-space-journey");
  assert.equal(clone.isDemo, false);
  assert.equal(clone.editable, true);
  assert.equal(clone.source, "user-clone");
  assert.equal(clone.clonedFrom, "demo-ai-space-journey");
  assert.match(clone.title, /^Bản sao · /);
  const edited = store.updateStep(clone.id, "script", { content: "Kịch bản riêng", status: "in-progress" });
  assert.equal(edited.steps.script.content, "Kịch bản riêng");
  assert.equal(store.getProject("demo-ai-space-journey").steps.script.content, data.SAMPLE_PROJECTS[0].steps.script.content);
});

test("hidden samples stay hidden until an explicit restore", () => {
  const storage = data.memoryStorage();
  const first = data.createStore({ storage, now });
  assert.equal(first.hideDemo("demo-piano-rain"), true);
  assert.equal(first.getProject("demo-piano-rain"), null);

  const reopened = data.createStore({ storage, now, persistInitial: false });
  assert.equal(reopened.getProject("demo-piano-rain"), null, "a reload must not silently re-seed hidden templates");
  reopened.restoreDemos();
  assert.equal(reopened.getProject("demo-piano-rain").isDemo, true);
});

test("blocked or exhausted localStorage degrades to an in-memory namespace", () => {
  const blocked = {
    getItem() { return null; },
    setItem() { throw new Error("quota blocked"); },
    removeItem() {}
  };
  const store = data.createStore({ storage: blocked, now });
  assert.equal(store.storageKind(), "memory-fallback");
  const project = store.createProject({ title: "Vẫn dùng được" });
  assert.equal(store.getProject(project.id).title, "Vẫn dùng được");
  assert.equal(store.storageKind(), "memory-fallback");
});

test("legacy Creator data migrates copy-only into IndexedDB and leaves only a small manifest for new writes", async () => {
  const storage = data.memoryStorage();
  const legacy = data.createStore({ storage, now });
  const project = legacy.createProject({ id: "legacy-project", title: "Dự án legacy" });
  legacy.updateStep(project.id, "script", { content: "Nội dung legacy cần được giữ nguyên" });
  const legacyBeforeMigration = storage.getItem(data.STORAGE_KEY);
  const database = data.memoryDatabase();

  const migrated = data.createStore({ storage, database, now });
  assert.equal(migrated.storageKind(), "indexedDB-pending");
  const status = await migrated.ready();
  await migrated.flush();

  assert.equal(status.kind, "indexedDB");
  assert.equal(migrated.getProject(project.id).steps.script.content, "Nội dung legacy cần được giữ nguyên");
  assert.equal(storage.getItem(data.STORAGE_KEY), legacyBeforeMigration, "migration must not delete or rewrite the recoverable legacy payload");
  const manifestText = storage.getItem(data.MANIFEST_KEY);
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.backend, "indexedDB");
  assert.equal(manifest.schemaVersion, 2);
  assert.doesNotMatch(manifestText, /Nội dung legacy|steps|projects/);
  assert.equal(database.inspect().state.projects.filter((entry) => entry.id === project.id).length, 1);

  const reopened = data.createStore({ storage, database, now });
  await reopened.ready();
  assert.equal(reopened.getSnapshot().projects.filter((entry) => entry.id === project.id).length, 1, "an idempotent migration must not duplicate records");
});

test("an edit made while IndexedDB is hydrating wins over the stale persisted project", async () => {
  const storage = data.memoryStorage();
  const legacy = data.createStore({ storage, now });
  const project = legacy.createProject({ id: "race-project", title: "Race", steps: { script: { content: "bản cũ" } } });
  const staleState = legacy.getSnapshot();
  let resolveRead;
  const writes = [];
  const database = {
    open() { return Promise.resolve(); },
    read() { return new Promise((resolve) => { resolveRead = resolve; }); },
    write(payload) { writes.push(payload); return Promise.resolve(); },
    close() {}
  };
  const store = data.createStore({ storage, database, now });
  store.updateStep(project.id, "script", { content: "bản sửa trong lúc hydrate" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  resolveRead({ exists: true, state: staleState, history: [] });
  await store.ready();
  await store.flush();

  assert.equal(store.getProject(project.id).steps.script.content, "bản sửa trong lúc hydrate");
  assert.equal(writes.at(-1).state.projects.find((entry) => entry.id === project.id).steps.script.content, "bản sửa trong lúc hydrate");
});

test("IndexedDB open or write failures are disclosed as memory fallback without losing the live mirror", async () => {
  const openFailure = data.createStore({
    storage: data.memoryStorage(),
    database: { open() { return Promise.reject(new Error("blocked")); }, read() { return Promise.resolve(null); }, write() { return Promise.resolve(); }, close() {} },
    now
  });
  const project = openFailure.createProject({ title: "Vẫn còn trong phiên" });
  const status = await openFailure.ready();
  assert.equal(status.kind, "memory-fallback");
  assert.equal(openFailure.storageKind(), "memory-fallback");
  assert.equal(openFailure.getProject(project.id).title, "Vẫn còn trong phiên");

  const writeFailure = data.createStore({ storage: data.memoryStorage(), database: data.memoryDatabase(null, { writeError: new Error("quota") }), now });
  await writeFailure.ready();
  assert.equal(writeFailure.storageKind(), "memory-fallback");
});

test("a fresh store reloads complete project payloads from IndexedDB", async () => {
  const database = data.memoryDatabase();
  const first = data.createStore({ storage: data.memoryStorage(), database, now });
  await first.ready();
  const project = first.createProject({ id: "indexed-project", title: "Lưu trong IndexedDB" });
  first.updateStep(project.id, "video", { status: "review", content: "Shot list đầy đủ", notes: "Kiểm tra phụ đề" });
  await first.flush();

  const reopened = data.createStore({ storage: data.memoryStorage(), database, now });
  await reopened.ready();
  const restored = reopened.getProject(project.id);
  assert.equal(restored.steps.video.status, "review");
  assert.equal(restored.steps.video.content, "Shot list đầy đủ");
  assert.equal(restored.steps.video.notes, "Kiểm tra phụ đề");
});

test("bounded version history can restore a prior project snapshot", () => {
  const store = makeStore();
  const project = store.createProject({ title: "Phiên bản 0" });
  for (let index = 1; index <= data.MAX_HISTORY_PER_PROJECT + 3; index += 1) {
    store.updateProject(project.id, { title: `Phiên bản ${index}` });
  }
  const history = store.listHistory(project.id);
  assert.equal(history.length, data.MAX_HISTORY_PER_PROJECT);
  const target = history.find((entry) => entry.project.title === "Phiên bản 5");
  assert.ok(target);
  const restored = store.restoreVersion(project.id, target.id);
  assert.equal(restored.title, "Phiên bản 5");
  assert.equal(store.getProject(project.id).title, "Phiên bản 5");
  assert.ok(store.listHistory(project.id).length <= data.MAX_HISTORY_PER_PROJECT);
});

test("public async backup hooks hydrate first and require an explicit merge or replace mode", async () => {
  const source = data.createStore({ storage: data.memoryStorage(), database: data.memoryDatabase(), now });
  await source.ready();
  const project = source.createProject({ id: "backup-project", title: "Backup đa kho" });
  source.updateStep(project.id, "idea", { content: "Dữ liệu đã sanitize" });
  const backup = await source.exportAsync();
  assert.ok(Buffer.byteLength(backup, "utf8") <= data.BACKUP_LIMITS.maxBytes);

  const destination = data.createStore({ storage: data.memoryStorage(), database: data.memoryDatabase(), now });
  const result = await destination.importAsync(backup, { mode: "replace" });
  assert.equal(result.mode, "replace");
  assert.equal(result.storageKind, "indexedDB");
  assert.equal(destination.getProject(project.id).steps.idea.content, "Dữ liệu đã sanitize");
  await assert.rejects(destination.importAsync(backup, { mode: "overwrite" }), { code: "INVALID_IMPORT_MODE" });
});

test("validated snapshot replacement preserves provenance and timestamps while retaining the local demo visibility state", async () => {
  const database = data.memoryDatabase();
  const store = data.createStore({ storage: data.memoryStorage(), database, now });
  await store.ready();
  store.hideDemo("demo-piano-rain");
  await store.flush();

  const payload = {
    schema: data.SCHEMA,
    schemaVersion: 1,
    appVersion: data.VERSION,
    projects: [{
      id: "creator-snapshot-project",
      title: "Dự án từ snapshot",
      description: "Giữ nguyên provenance",
      category: "Video",
      accent: "cyan",
      isDemo: false,
      source: "user-clone",
      templateVersion: null,
      editable: false,
      clonedFrom: "origin-project",
      tags: ["snapshot"],
      dueAt: "2026-10-10T08:00:00.000Z",
      createdAt: "2024-01-02T03:04:05.000Z",
      updatedAt: "2025-02-03T04:05:06.000Z",
      steps: Object.fromEntries(data.PIPELINE_STEPS.map((step) => [step.id, {
        id: step.id,
        status: step.id === "idea" ? "completed" : "not-started",
        content: step.id === "idea" ? "Nội dung gốc" : "",
        notes: "",
        checklist: [],
        updatedAt: "2025-02-03T04:05:06.000Z"
      }]))
    }, {
      id: "foreign-demo",
      title: "Không được nhập",
      isDemo: true,
      source: "local-template"
    }],
    schedule: [{
      id: "creator-snapshot-schedule",
      title: "Lịch nguyên trạng",
      note: "Không đổi timestamp",
      at: "2026-10-10T08:00:00.000Z",
      time: "15:04",
      stepId: "idea",
      projectId: "creator-snapshot-project",
      done: false,
      isDemo: false,
      source: "user-clone",
      editable: false,
      createdAt: "2024-01-02T03:04:05.000Z",
      updatedAt: "2025-02-03T04:05:06.000Z"
    }, {
      id: "foreign-demo-schedule",
      title: "Lịch mẫu từ file",
      projectId: "foreign-demo",
      isDemo: true,
      source: "local-template"
    }]
  };

  const beforeActivity = store.getSnapshot().activity.length;
  const result = await store.replaceValidatedSnapshotAsync(payload, { audit: false });
  assert.deepEqual(result, {
    projects: 1,
    schedule: 1,
    audit: false,
    auditReason: null,
    storageKind: "indexedDB"
  });
  const restored = store.getProject("creator-snapshot-project");
  assert.equal(restored.source, "user-clone");
  assert.equal(restored.editable, false);
  assert.equal(restored.createdAt, "2024-01-02T03:04:05.000Z");
  assert.equal(restored.updatedAt, "2025-02-03T04:05:06.000Z");
  assert.equal(restored.steps.idea.updatedAt, "2025-02-03T04:05:06.000Z");
  const restoredSchedule = store.getSnapshot().schedule.find((item) => item.id === "creator-snapshot-schedule");
  assert.equal(restoredSchedule.source, "user-clone");
  assert.equal(restoredSchedule.editable, false);
  assert.equal(restoredSchedule.createdAt, "2024-01-02T03:04:05.000Z");
  assert.equal(restoredSchedule.updatedAt, "2025-02-03T04:05:06.000Z");
  assert.equal(store.getProject("foreign-demo"), null, "a demo from the file must never enter the live store");
  assert.equal(store.getProject("demo-piano-rain"), null, "a locally hidden demo must stay hidden");
  assert.equal(store.getProject("demo-ai-space-journey").source, "local-template", "visible local demos are retained from the device, not the file");
  assert.equal(store.getSnapshot().activity.length, beforeActivity, "audit=false must not append an audit activity");
  assert.deepEqual(database.inspect().state.projects.find((item) => item.id === restored.id), restored, "the API resolves only after IndexedDB receives the exact user project");
});

test("validated Creator snapshot supports drift-free rollback and fails closed before mutating state", async () => {
  const store = data.createStore({ storage: data.memoryStorage(), database: data.memoryDatabase(), now });
  await store.ready();
  const project = store.createProject({
    id: "rollback-project",
    title: "Trước giao dịch",
    source: "user-clone",
    editable: true,
    createdAt: "2023-01-01T00:00:00.000Z",
    updatedAt: "2023-02-01T00:00:00.000Z"
  });
  store.addSchedule({
    id: "ignored-by-create",
    title: "Lịch trước giao dịch",
    projectId: project.id,
    source: "user",
    editable: true,
    createdAt: "2023-01-01T00:00:00.000Z",
    updatedAt: "2023-02-01T00:00:00.000Z"
  });
  await store.flush();
  const rollback = JSON.parse(await store.exportAsync());
  const baselineProjects = rollback.projects;
  const baselineSchedule = rollback.schedule;
  const replacement = JSON.parse(JSON.stringify(rollback));
  replacement.projects[0].title = "Sau giao dịch";
  replacement.projects[0].source = "external-reviewed";
  replacement.projects[0].editable = false;
  replacement.projects[0].updatedAt = "2026-01-01T00:00:00.000Z";

  await store.replaceValidatedSnapshotAsync(replacement, { audit: false });
  assert.equal(store.getProject(project.id).source, "external-reviewed");
  await store.replaceValidatedSnapshotAsync(rollback, { audit: false });
  const afterRollback = JSON.parse(await store.exportAsync());
  assert.deepEqual(afterRollback.projects, baselineProjects, "rollback must not rewrite source, timestamps, editable flags or step payloads");
  assert.deepEqual(afterRollback.schedule, baselineSchedule, "rollback must restore the user schedule without drift");

  const beforeInvalid = JSON.parse(await store.exportAsync());
  await assert.rejects(store.replaceValidatedSnapshotAsync(rollback), { code: "SNAPSHOT_AUDIT_REQUIRED" });
  const duplicate = JSON.parse(JSON.stringify(rollback));
  duplicate.projects.push(JSON.parse(JSON.stringify(duplicate.projects[0])));
  await assert.rejects(store.replaceValidatedSnapshotAsync(duplicate, { audit: false }), { code: "SNAPSHOT_DUPLICATE_ID" });
  const invalidVersion = { ...rollback, schemaVersion: 99 };
  await assert.rejects(store.replaceValidatedSnapshotAsync(invalidVersion, { audit: false }), { code: "SNAPSHOT_VERSION_UNSUPPORTED" });
  const invalidTimestamp = JSON.parse(JSON.stringify(rollback));
  invalidTimestamp.projects[0].updatedAt = "không-phải-ngày";
  await assert.rejects(store.replaceValidatedSnapshotAsync(invalidTimestamp, { audit: false }), { code: "SNAPSHOT_PROJECT_UPDATED_AT_INVALID" });
  const afterInvalid = JSON.parse(await store.exportAsync());
  assert.deepEqual(afterInvalid.projects, beforeInvalid.projects, "failed validation must leave projects untouched");
  assert.deepEqual(afterInvalid.schedule, beforeInvalid.schedule, "failed validation must leave schedule untouched");
});

test("validated snapshot persistence failure restores the prior live mirror and rejects", async () => {
  let rejectWrites = false;
  const database = {
    record: null,
    open() { return Promise.resolve(); },
    read() { return Promise.resolve(this.record ? JSON.parse(JSON.stringify(this.record)) : { exists: false, state: null, history: [] }); },
    write(payload) {
      if (rejectWrites) return Promise.reject(new Error("quota"));
      this.record = JSON.parse(JSON.stringify(payload));
      return Promise.resolve();
    },
    close() {}
  };
  const store = data.createStore({ storage: data.memoryStorage(), database, now });
  await store.ready();
  const project = store.createProject({ id: "persisted-before-failure", title: "Không được mất" });
  await store.flush();
  const before = JSON.parse(await store.exportAsync());
  const replacement = JSON.parse(JSON.stringify(before));
  replacement.projects[0].title = "Không được commit";
  rejectWrites = true;

  await assert.rejects(store.replaceValidatedSnapshotAsync(replacement, { audit: false }), { code: "SNAPSHOT_PERSIST_FAILED" });
  assert.equal(store.getProject(project.id).title, "Không được mất");
  assert.equal(store.storageKind(), "memory-fallback", "the persistence failure must be disclosed instead of reported as a durable success");
  const after = JSON.parse(await store.exportAsync());
  assert.deepEqual(after.projects, before.projects);
  assert.deepEqual(after.schedule, before.schedule);
});

test("Creator store close is idempotent and releases its database connection after snapshot writes flush", async () => {
  let closeCalls = 0;
  const writes = [];
  const database = {
    open() { return Promise.resolve(); },
    read() { return Promise.resolve({ exists: false, state: null, history: [] }); },
    write(payload) { writes.push(JSON.parse(JSON.stringify(payload))); return Promise.resolve(); },
    close() { closeCalls += 1; }
  };
  const store = data.createStore({ storage: data.memoryStorage(), database, now });
  await store.ready();
  const payload = { schema: data.SCHEMA, schemaVersion: 1, appVersion: data.VERSION, projects: [], schedule: [] };
  await store.replaceValidatedSnapshotAsync(payload, { audit: true, auditReason: "transaction-restore" });
  await Promise.all([store.close(), store.close()]);
  assert.equal(closeCalls, 1, "one store lifecycle must close its database driver exactly once");
  assert.equal(writes.at(-1).state.activity[0].action, "validated-snapshot-replaced");
  assert.equal(writes.at(-1).state.activity[0].entityId, "transaction-restore");
  assert.equal(writes.at(-1).state.projects.filter((item) => !item.isDemo).length, 0);
});

test("analytics and schedule counters exclude all sample records", () => {
  const store = makeStore();
  assert.deepEqual(store.getStats(FIXED_NOW), {
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    draftProjects: 0,
    dueToday: 0,
    completedSteps: 0
  });
  const project = store.createProject({ title: "Người dùng" });
  store.updateStep(project.id, "idea", { status: "completed" });
  store.updateStep(project.id, "script", { status: "in-progress" });
  store.addSchedule({ title: "Việc hôm nay", at: "2026-08-31T14:00:00.000Z", stepId: "script", projectId: project.id });
  assert.deepEqual(store.getStats(FIXED_NOW), {
    totalProjects: 1,
    activeProjects: 1,
    completedProjects: 0,
    draftProjects: 0,
    dueToday: 1,
    completedSteps: 1
  });
});

test("JSON export omits demos and validated import restores user data", () => {
  const sourceStore = makeStore();
  const project = sourceStore.createProject({ title: "Xuất nhập", description: "Không giả dữ liệu" });
  sourceStore.updateStep(project.id, "video", { status: "review", notes: "Chờ duyệt" });
  sourceStore.addSchedule({ title: "Duyệt video", at: "2026-09-01T08:00:00.000Z", projectId: project.id, stepId: "video" });

  const exported = sourceStore.exportJSON();
  const payload = JSON.parse(exported);
  assert.equal(payload.schema, data.SCHEMA);
  assert.equal(payload.projects.length, 1);
  assert.equal(payload.schedule.length, 1);
  assert.ok(payload.projects.every((entry) => entry.isDemo === false));
  assert.doesNotMatch(exported, /demo-ai-space-journey/);

  const destination = makeStore();
  const result = destination.importJSON(exported, { mode: "replace" });
  assert.deepEqual(result, { projects: 1, schedule: 1 });
  assert.equal(destination.getProject(project.id).steps.video.status, "review");
  assert.equal(destination.getStats(FIXED_NOW).totalProjects, 1);
  assert.throws(() => destination.importJSON('{"schema":"other","schemaVersion":1}'), { code: "INVALID_IMPORT" });
});

test("Creator import gate fails closed on byte, MIME, extension and record limits", () => {
  assert.ok(Object.isFrozen(studio.IMPORT_LIMITS));
  assert.equal(studio.IMPORT_LIMITS.maxBytes, 2 * 1024 * 1024);
  const validFile = {
    name: "creator-backup.json",
    type: "application/json",
    size: 128,
    text() { return Promise.resolve(""); }
  };
  assert.equal(studio.validateImportFile(validFile), true);
  assert.throws(() => studio.validateImportFile({ ...validFile, type: "text/plain" }), { code: "IMPORT_INVALID_MIME" });
  assert.throws(() => studio.validateImportFile({ ...validFile, name: "creator-backup.txt" }), { code: "IMPORT_INVALID_EXTENSION" });
  assert.throws(() => studio.validateImportFile({ ...validFile, size: studio.IMPORT_LIMITS.maxBytes + 1 }), { code: "IMPORT_TOO_LARGE" });
  assert.throws(() => studio.validateImportFile({ ...validFile, text: null }), { code: "IMPORT_UNREADABLE_FILE" });

  const payload = { schema: data.SCHEMA, schemaVersion: 1, projects: [], schedule: [] };
  assert.deepEqual(studio.parseImportPayload(JSON.stringify(payload)), payload);
  assert.throws(
    () => studio.parseImportPayload(JSON.stringify({ ...payload, projects: Array.from({ length: 501 }, (_, index) => ({ id: `p-${index}` })) })),
    { code: "IMPORT_TOO_MANY_PROJECTS" }
  );
  assert.throws(() => studio.parseImportPayload('{"schema":'), { code: "IMPORT_INVALID_JSON" });
  assert.throws(() => studio.parseImportPayload(JSON.stringify({ schema: data.SCHEMA, schemaVersion: 1, projects: {} })), { code: "IMPORT_INVALID_COLLECTIONS" });
});

test("the file-input handler rejects an unsafe MIME before reading or mutating data", () => {
  const harness = fakeHost();
  const store = makeStore();
  const controller = studio.mount(harness.host, { route: "/galaxy/creator", store, now });
  let read = false;
  const target = {
    files: [{ name: "unsafe.json", type: "text/plain", size: 128, text() { read = true; return Promise.resolve("{}"); } }],
    value: "C:\\fakepath\\unsafe.json",
    matches(selector) { return selector === "[data-gcs-import]"; }
  };
  harness.listeners.get("change")({ target });
  assert.equal(read, false);
  assert.equal(target.value, "");
  assert.equal(store.getStats(FIXED_NOW).totalProjects, 0);
  controller.unmount();
});

test("an import that finishes after unmount cannot mutate the Creator store", async () => {
  const harness = fakeHost();
  const store = makeStore();
  let finishRead;
  const file = {
    name: "creator-backup.json",
    type: "application/json",
    size: 256,
    text() { return new Promise((resolve) => { finishRead = resolve; }); }
  };
  const target = {
    files: [file],
    value: "C:\\fakepath\\creator-backup.json",
    matches(selector) { return selector === "[data-gcs-import]"; }
  };
  const controller = studio.mount(harness.host, { route: "/galaxy/creator", store, now });
  harness.listeners.get("change")({ target });
  controller.unmount();
  finishRead(JSON.stringify({
    schema: data.SCHEMA,
    schemaVersion: 1,
    projects: [{ id: "late-project", title: "Không được nhập sau unmount" }],
    schedule: []
  }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(store.getProject("late-project"), null);
});

test("Creator hydration that finishes after unmount cannot repaint the old host", async () => {
  let resolveRead;
  const database = {
    open() { return Promise.resolve(); },
    read() { return new Promise((resolve) => { resolveRead = resolve; }); },
    write() { return Promise.resolve(); },
    close() {}
  };
  const store = data.createStore({ storage: data.memoryStorage(), database, now });
  const harness = fakeHost();
  const controller = studio.mount(harness.host, { route: "/galaxy/creator", store, now });
  await new Promise((resolve) => setTimeout(resolve, 0));
  controller.unmount();
  assert.equal(harness.host.innerHTML, "");
  resolveRead({ exists: true, state: data.normalizeState({ projects: [{ id: "late-hydration", title: "Không được repaint" }] }, FIXED_NOW.toISOString()), history: [] });
  await store.ready();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(harness.host.innerHTML, "");
  assert.equal(studio.getState(harness.host), null);
});

test("future user schedule entries are shown instead of falling back to samples", () => {
  const harness = fakeHost();
  const store = makeStore();
  store.addSchedule({ title: "Duyệt bản dựng tương lai", at: "2026-09-15T08:00:00.000Z", stepId: "video" });
  const controller = studio.mount(harness.host, { route: "/galaxy/creator", store, now });
  assert.match(harness.host.innerHTML, /Hôm nay &amp; sắp tới/);
  assert.match(harness.host.innerHTML, /Duyệt bản dựng tương lai/);
  assert.doesNotMatch(harness.host.innerHTML, /id="gcs-schedule-title">Lịch mẫu/);
  controller.unmount();
});

test("Creator Studio owns only /galaxy/creator and exposes a lifecycle API", () => {
  assert.equal(global.HHGalaxyCreatorStudio, studio);
  assert.equal(studio.VERSION, "1.0.0");
  for (const method of ["mount", "unmount", "getState", "canHandle", "normalizeRoute", "renderMarkup"]) {
    assert.equal(typeof studio[method], "function", method);
  }
  assert.equal(studio.canHandle("#/galaxy/creator?project=one"), true);
  assert.equal(studio.canHandle("/create/workflow"), false);
  assert.equal(studio.canHandle("/galaxy/creator-pipeline"), false);
  assert.equal(studio.canHandle("/create"), false);
  assert.ok(Object.isFrozen(studio));
});

test("mount renders a complete accessible pipeline and unmount clears ownership", () => {
  const harness = fakeHost();
  const store = makeStore();
  const controller = studio.mount(harness.host, { route: "/galaxy/creator", store, now });
  assert.equal(controller.route, "/galaxy/creator");
  assert.equal(studio.getState(harness.host).mounted, true);
  assert.equal(harness.host.dataset.gcsMounted, "true");
  assert.equal((harness.host.innerHTML.match(/data-gcs-step=/g) || []).length, 9);
  assert.match(harness.host.innerHTML, /Creator Pipeline/);
  assert.match(harness.host.innerHTML, /aria-label="Quy trình sáng tạo 9 bước"/);
  assert.match(harness.host.innerHTML, /Bản mẫu/);
  assert.match(harness.host.innerHTML, /Không hiển thị lượt xem, doanh thu hoặc người đăng ký/);
  assert.equal(studio.unmount(harness.host), true);
  assert.equal(harness.host.innerHTML, "");
  assert.equal(studio.getState(harness.host), null);
});

test("editor input autosaves without fabricating a completed state", async () => {
  const harness = fakeHost();
  const store = makeStore();
  const project = store.createProject({ title: "Autosave" });
  const controller = studio.mount(harness.host, {
    route: "/galaxy/creator",
    store,
    now,
    view: "editor",
    projectId: project.id,
    autosaveDelay: 0
  });
  assert.equal(controller.getState().view, "editor");
  const input = harness.listeners.get("input");
  assert.equal(typeof input, "function");
  input({
    target: {
      value: "Nội dung được tự động lưu",
      matches(selector) { return selector === "[data-gcs-step-field]"; },
      getAttribute(name) { return name === "data-gcs-step-field" ? "content" : null; }
    }
  });
  assert.equal(controller.getState().autosavePending, true);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(controller.getState().autosavePending, false);
  assert.equal(store.getProject(project.id).steps.idea.content, "Nội dung được tự động lưu");
  assert.equal(store.getProject(project.id).steps.idea.status, "not-started");
  assert.equal(harness.saveNode.dataset.state, "saved");
  controller.unmount();
});

test("a persistence failure is disclosed as session-only instead of falsely saved", async () => {
  const blocked = {
    getItem() { return null; },
    setItem() { throw new Error("quota blocked"); },
    removeItem() {}
  };
  const store = data.createStore({ storage: blocked, now });
  const project = store.createProject({ title: "Bộ nhớ tạm" });
  const harness = fakeHost();
  const controller = studio.mount(harness.host, {
    route: "/galaxy/creator",
    store,
    now,
    view: "editor",
    projectId: project.id,
    autosaveDelay: 0
  });
  assert.match(harness.host.innerHTML, /data-state="volatile"/);
  assert.match(harness.host.innerHTML, /Chỉ lưu trong phiên này/);
  harness.listeners.get("input")({
    target: {
      value: "Nội dung tạm",
      matches(selector) { return selector === "[data-gcs-step-field]"; },
      getAttribute(name) { return name === "data-gcs-step-field" ? "content" : null; }
    }
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(store.getProject(project.id).steps.idea.content, "Nội dung tạm", "session data remains usable");
  assert.equal(harness.saveNode.dataset.state, "volatile");
  assert.equal(harness.saveLabel.textContent, "Chỉ lưu trong phiên này");
  assert.notEqual(harness.saveLabel.textContent, "Đã lưu cục bộ");
  controller.unmount();
});

test("closing a dialog returns focus to the exact control that opened it", () => {
  const harness = fakeHost();
  const firstCreate = actionNode("create", harness.host);
  const secondCreate = actionNode("create", harness.host);
  const autofocus = { focusCount: 0, focus() { this.focusCount += 1; } };
  harness.setSelectorNodes('[data-gcs-action="create"]', [firstCreate, secondCreate]);
  harness.setSelectorNodes("[data-gcs-modal] input[autofocus]", [autofocus]);
  const controller = studio.mount(harness.host, { route: "/galaxy/creator", store: makeStore(), now });

  harness.listeners.get("click")({ target: secondCreate, preventDefault() {} });
  assert.equal(autofocus.focusCount, 1, "dialog autofocus should still work");
  const close = actionNode("close-modal", harness.host);
  harness.listeners.get("click")({ target: close, preventDefault() {} });
  assert.equal(firstCreate.focusCount, 0);
  assert.equal(secondCreate.focusCount, 1, "focus must return by opener index, not to the first Create button");
  controller.unmount();
});

test("source contract is local-first, motion-safe, and contains no fake showcase metrics", () => {
  assert.match(dataSource, /hh-galaxy\.creator-studio\.v1/);
  assert.match(studioSource, /new AbortController\(\)/);
  assert.match(studioSource, /visibilitychange/);
  assert.match(studioSource, /flushAutosave/);
  assert.match(studioSource, /hh:galaxy:creator-studio:/);
  assert.match(studioSource, /Không hiển thị lượt xem, doanh thu hoặc người đăng ký/);
  assert.doesNotMatch(dataSource + studioSource, /\b1\.2M\b|\b45\.6K\b|\$3,450|12\.5K|Math\.random/);
  assert.doesNotMatch(dataSource + studioSource, /hh-core\.|hh:core:|HHCoreGateway|\/create\/workflow/);
});

test("read-only shell integration loads once, mounts the dedicated slot, and cleans both lifecycles", () => {
  const layerGroup = loaderSource.match(/"galaxy-layer-one"\s*:\s*\{[\s\S]*?scripts:\s*\[([^\]]+)\]/)?.[1] || "";
  const dataIndex = layerGroup.indexOf("galaxy-layer-one-data.js");
  const creatorIndex = layerGroup.indexOf("galaxy-creator-studio.js");
  const shellIndex = layerGroup.indexOf("galaxy-layer-one.js");
  assert.ok(dataIndex >= 0 && creatorIndex > dataIndex && shellIndex > creatorIndex, "the data API and Creator Studio must exist before their owning layer-one shell");
  assert.match(loaderSource, /\/galaxy\/creator["',\s\]]+[\s\S]{0,220}return \["galaxy-layer-one"\]/);
  assert.equal((layerOneSource.match(/data-hh-galaxy-creator-host/g) || []).length, 3, "one slot declaration, one delegate lookup and one persistent-island selector are expected");
  assert.match(layerOneSource, /runtime\.route\s*===\s*["']\/galaxy\/creator["'][\s\S]{0,120}islandSelector\s*=\s*["']\[data-hh-galaxy-creator-host\]["']/, "same-route renders must preserve the mounted Creator workspace");
  assert.match(layerOneSource, /options\.mountCreator\(creatorHost, context\)/);
  assert.match(layerOneSource, /registerDelegateCleanup\(delegatedCreator\)/);
  assert.match(layerOneSource, /function cleanupDelegate\(\)[\s\S]{0,180}runtime\.delegateCleanups\.splice/);
  assert.match(layerOneSource, /function unmount\(\)[\s\S]{0,180}cleanupDelegate\(\)/);
  assert.match(routerSource, /HHGalaxyCreatorStudio\?\.mount\?\.\(creatorHost,[\s\S]{0,260}route:\s*context\.route\s*\|\|\s*"\/galaxy\/creator"/);
  assert.match(routerSource, /return \(\) => window\.HHGalaxyCreatorStudio\?\.unmount\?\.\(creatorHost\)/);
  assert.match(routerSource, /window\.HHGalaxyLayerOne\?\.unmount\?\.\(\);\s*window\.HHGalaxyCreatorStudio\?\.unmount\?\.\(\);/);
  assert.doesNotMatch(studioSource + dataSource, /HHCoreGateway|hh:core:|hh-core\.|\/create(?:\/|["'])/);
  assert.equal((studioSource.match(/data-gcs-app/g) || []).length, 1, "Creator renders one dashboard root per mounted host");
});

test("project-card actions stay inside their own full-width row at tablet and desktop widths", () => {
  assert.match(
    studioStyles,
    /\.gcs-project-body footer\s*{[^}]*\bdisplay:\s*block\b[^}]*\bmin-width:\s*0\b[^}]*\bpadding:\s*9px 0 0\b[^}]*}/,
    "project-card footer must use normal block flow and reset global horizontal footer padding"
  );
  assert.match(
    studioStyles,
    /\.gcs-card-actions\s*{[^}]*\bwidth:\s*100%[^}]*\bmin-width:\s*0\b[^}]*\bflex-wrap:\s*wrap\b[^}]*\bjustify-content:\s*flex-end\b[^}]*\bmargin-top:\s*8px\b[^}]*}/,
    "the action group must fill, shrink and wrap within its own card row"
  );
  assert.match(
    studioStyles,
    /\.gcs-card-actions button\s*{[^}]*\bmax-width:\s*100%[^}]*\bwhite-space:\s*nowrap\b[^}]*}/,
    "individual actions must remain bounded without clipping their labels"
  );
});

test("important Creator controls expose 44px targets and readable labels", () => {
  assert.match(studioStyles, /\.gcs-button,[\s\S]*?\.gcs-back\s*{[^}]*min-height:\s*44px/);
  assert.match(studioStyles, /\.gcs-card-actions button\s*{[^}]*min-height:\s*44px[^}]*font-size:\s*12px/);
  assert.match(studioStyles, /\.gcs-side-card > header button\s*{[^}]*min-height:\s*44px[^}]*font-size:\s*12px/);
  assert.match(studioStyles, /\.gcs-modal__close\s*{[^}]*width:\s*44px[^}]*height:\s*44px/);
  assert.match(studioStyles, /\.gcs-checklist li > button\s*{[^}]*width:\s*44px[^}]*height:\s*44px/);
  assert.match(studioStyles, /\.gcs-modal form label > span\s*{[^}]*font-size:\s*12px/);
});

test("icon-only mobile actions keep explicit accessible names", () => {
  for (const [action, label] of [
    ["import", "Nhập JSON"],
    ["export", "Xuất JSON"],
    ["delete", "Xóa dự án"]
  ]) {
    const openingTag = studioSource.match(new RegExp(`<button[^>]*data-gcs-action=["']${action}["'][^>]*>`, "i"));
    assert.ok(openingTag, `missing ${action} action button`);
    assert.match(openingTag[0], new RegExp(`aria-label=["']${label}["']`, "i"), `${action} must not rely on CSS-visible text for its name`);
  }
});

test("embedded Creator content does not create nested main landmarks", () => {
  assert.doesNotMatch(studioSource, /<main\b/i, "Creator mounts inside the Layer One main and must not emit another main element");
  assert.match(studioSource, /<div id="gcs-main" class="gcs-main" role="region" aria-label="Nội dung Creator Studio"/);
  assert.match(studioSource, /<section class="gcs-workspace__canvas"/);
});

test("visual stylesheet is responsive, focus-visible and reduced-motion safe", { skip: !fs.existsSync(path.join(root, "galaxy-creator-studio.css")) }, () => {
  const styles = studioStyles;
  assert.match(styles, /\.gcs-host/);
  assert.match(styles, /\.gcs-pipeline/);
  assert.match(styles, /\.gcs-project-grid/);
  assert.match(styles, /\.gcs-workspace/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media\s*\(max-width:\s*900px\)/);
  assert.match(styles, /@media\s*\(max-width:\s*(?:680|640|600)px\)/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.doesNotMatch(styles, /url\s*\(\s*["']?https?:/i);
});
