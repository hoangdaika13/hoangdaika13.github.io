const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const shellSource = read("galaxy-layer-one.js");
const loaderSource = read("performance-loader.js");
const serviceWorkerSource = read("sw.js");
const dataSource = read("galaxy-layer-one-data.js");
const backup = require("../galaxy-layer-one-backup.js");
const learning = require("../galaxy-layer-one-learning.js");

const FIXED_NOW = "2026-09-02T04:30:00.000Z";
const MAIN_STORAGE_KEY = "hh.galaxy.layer-one.v1";
const LEARNING_RECORD_ID = "learning-state-v1";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function bridgeBackupApi(overrides) {
  const api = {
    ...backup,
    canonicalStringify(value) { return backup.canonicalStringify(clone(value)); },
    containsLikelySecret(value) { return backup.containsLikelySecret(clone(value)); },
    serializeBackup(input, options) { return backup.serializeBackup(clone(input), clone(options || {})); },
    inspectBackup(input, options) { return backup.inspectBackup(clone(input), clone(options || {})); },
    createImportPlan(current, candidate, options) {
      return backup.createImportPlan(clone(current), clone(candidate), clone(options || {}));
    }
  };
  return Object.freeze(Object.assign(api, overrides || {}));
}

function scriptAsset(source, fileName) {
  const expression = new RegExp(`(?:\\./)?${fileName.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\?v=(\\d+)`, "g");
  const matches = [...source.matchAll(expression)];
  assert.ok(matches.length, `${fileName} must be versioned`);
  return Object.freeze({ token: `${fileName}?v=${matches[0][1]}`, version: Number(matches[0][1]), index: matches[0].index });
}

function makeStorage(initialState, onSet) {
  const values = new Map([[MAIN_STORAGE_KEY, JSON.stringify(initialState)]]);
  const calls = [];
  return {
    calls,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      calls.push({ key, value: String(value) });
      if (onSet) onSet({ key, value: String(value), calls });
      values.set(key, String(value));
    },
    removeItem(key) { values.delete(key); },
    snapshot() { return JSON.parse(values.get(MAIN_STORAGE_KEY)); }
  };
}

function creatorPayload(projectId, title) {
  return {
    schema: backup.CREATOR_SCHEMA,
    schemaVersion: 1,
    appVersion: "integration-test",
    projects: projectId ? [{ id: projectId, title, source: "user" }] : [],
    schedule: projectId ? [{ id: `${projectId}-schedule`, projectId, title: `Lịch ${title}`, source: "user" }] : []
  };
}

function makeCreatorAdapter(initial, onImport) {
  let state = clone(initial);
  const imports = [];
  let readyCount = 0;
  let closeCount = 0;
  const api = {
    createStore() {
      return {
        async ready() { readyCount += 1; },
        async exportAsync() { return JSON.stringify(state); },
        async replaceValidatedSnapshotAsync(value, options) {
          const candidate = typeof value === "string" ? JSON.parse(value) : clone(value);
          imports.push({ candidate: clone(candidate), options: clone(options || {}) });
          if (onImport) await onImport({ candidate, options: options || {}, imports, setState(value) { state = clone(value); } });
          state = clone(candidate);
          return { projects: state.projects.length, schedule: state.schedule.length, audit: options && options.audit };
        },
        async close() { closeCount += 1; return true; }
      };
    }
  };
  return {
    api,
    imports,
    state: () => clone(state),
    readyCount: () => readyCount,
    closeCount: () => closeCount
  };
}

function portableRecord(id, value) {
  return {
    id,
    route: "/galaxy/tools",
    value: clone(value),
    metadata: { contentType: "application/json", source: "user" },
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW
  };
}

function makeContentAdapter(initialRecords, initialLearning, onOperation) {
  const records = new Map();
  const calls = [];
  (initialRecords || []).forEach((record) => records.set(`${record.route}\0${record.id}`, clone(record)));
  if (initialLearning) {
    records.set(`/galaxy/learning\0${LEARNING_RECORD_ID}`, {
      id: LEARNING_RECORD_ID,
      route: "/galaxy/learning",
      value: clone(initialLearning),
      metadata: { schema: learning.SCHEMA, schemaVersion: learning.SCHEMA_VERSION }
    });
  }
  async function operation(details) {
    calls.push(details);
    if (onOperation) await onOperation({ ...details, calls });
  }
  return {
    calls,
    async open() { await operation({ op: "open" }); return true; },
    async get(route, id) { return clone(records.get(`${route}\0${id}`) || null); },
    async list(route) {
      return [...records.values()].filter((record) => record.route === route).map(clone);
    },
    async put(route, id, value, metadata) {
      await operation({ op: "put", route, id, value: clone(value), metadata: clone(metadata || {}) });
      records.set(`${route}\0${id}`, {
        id,
        route,
        value: clone(value),
        metadata: clone(metadata || {}),
        createdAt: FIXED_NOW,
        updatedAt: FIXED_NOW
      });
      return true;
    },
    async delete(route, id) {
      await operation({ op: "delete", route, id });
      records.delete(`${route}\0${id}`);
      return true;
    },
    portable() {
      return [...records.values()]
        .filter((record) => !(record.route === "/galaxy/learning" && record.id === LEARNING_RECORD_ID))
        .map(clone)
        .sort((left, right) => `${left.route}\0${left.id}`.localeCompare(`${right.route}\0${right.id}`));
    },
    learning() {
      const record = records.get(`/galaxy/learning\0${LEARNING_RECORD_ID}`);
      return record ? clone(record.value) : null;
    }
  };
}

function learningState(id, title) {
  if (!id) return learning.normalizeState({ decks: [], activities: [] }, { now: FIXED_NOW });
  return learning.normalizeState({
    decks: [{
      id,
      title,
      source: "user",
      cards: [{ id: `${id}-card`, front: `Câu hỏi ${title}`, back: `Đáp án ${title}`, source: "user" }]
    }],
    activities: []
  }, { now: FIXED_NOW });
}

function mainState(id, title) {
  return {
    version: 1,
    settings: {
      theme: "cosmic",
      effects: "balanced",
      contrast: "standard",
      reducedMotion: "system",
      uiScale: "medium",
      colorVision: "standard",
      analyticsConsent: false
    },
    items: id ? [{
      id,
      route: "/galaxy/tools",
      title,
      kind: "tool-document",
      description: title,
      source: "user",
      isDemo: false,
      editable: true,
      createdAt: FIXED_NOW,
      updatedAt: FIXED_NOW,
      meta: {
        fileName: "",
        fileType: "",
        fileSize: 0,
        mediaKind: "",
        copiedFrom: "",
        learningCategory: "",
        dueDate: "",
        privacy: "private",
        provider: "",
        completed: false
      }
    }] : [],
    events: []
  };
}

function completeBackupInput(ids) {
  const settings = ids || {};
  const learningValue = learningState(settings.learningId || "", settings.learningTitle || "");
  return {
    main: mainState(settings.mainId || "", settings.mainTitle || ""),
    creator: creatorPayload(settings.creatorId || "", settings.creatorTitle || ""),
    learning: learning.createExportPayload(learningValue, { exportedAt: FIXED_NOW }),
    records: settings.recordId ? [portableRecord(settings.recordId, { title: settings.recordTitle })] : []
  };
}

function loadInstrumentedShell(options) {
  const marker = /  const api = Object\.freeze\(\{\r?\n    version: VERSION,/;
  assert.match(shellSource, marker, "the shell test seam marker changed");
  const instrumented = shellSource.replace(marker, `  const api = Object.freeze({
    __backupIntegrationTest: Object.freeze({
      setRuntime: function setBackupTestRuntime(value) { runtime = value; },
      getRuntime: function getBackupTestRuntime() { return runtime; },
      withCreatorStore: withCreatorStore,
      collectCompleteBackupInput: collectCompleteBackupInput,
      exportCompleteBackup: exportCompleteBackup,
      applyCompleteBackup: applyCompleteBackup,
      replacePortableRecords: replacePortableRecords
    }),
    version: VERSION,`);
  const downloads = [];
  class CapturingBlob {
    constructor(parts, blobOptions) {
      this.text = (parts || []).map((part) => String(part)).join("");
      this.type = blobOptions && blobOptions.type;
    }
  }
  const context = vm.createContext({
    module: { exports: {} },
    exports: {},
    console,
    Blob: CapturingBlob,
    URL: {
      createObjectURL(blob) { downloads.push({ text: blob.text, type: blob.type }); return `blob:backup-${downloads.length}`; },
      revokeObjectURL() {}
    },
    document: {
      activeElement: null,
      body: { appendChild() {} },
      createElement() {
        return { hidden: false, href: "", download: "", click() {}, remove() {} };
      }
    },
    navigator: { onLine: true },
    setTimeout(callback) { callback(); return 1; },
    clearTimeout() {},
    crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000001" },
    HHGalaxyLayerOneBackup: (options && options.backupApi) || bridgeBackupApi(),
    HHGalaxyLayerOneLearning: (options && options.learningApi) || learning,
    HHGalaxyLayerOneData: options && options.dataApi,
    localStorage: options && options.storage
  });
  vm.runInContext(instrumented, context, { filename: "galaxy-layer-one.instrumented.js" });
  return {
    api: context.module.exports,
    privateApi: context.module.exports.__backupIntegrationTest,
    downloads,
    context
  };
}

function runtimeFixture(overrides) {
  const source = overrides || {};
  return {
    storage: source.storage,
    localState: source.storage && typeof source.storage.snapshot === "function" ? source.storage.snapshot() : null,
    contentStorage: source.contentStorage,
    learningState: clone(source.learningState),
    learningStatus: "ready",
    learningLoadPromise: null,
    app: null,
    route: "/galaxy/settings",
    toastTimer: 0
  };
}

function normalizedSnapshot(runtime, creatorAdapter, contentAdapter) {
  return {
    main: clone(runtime.storage.snapshot()),
    creator: creatorAdapter.state(),
    learning: clone(runtime.learningState),
    records: contentAdapter.portable().map((record) => ({ id: record.id, route: record.route, value: record.value, metadata: record.metadata }))
  };
}

test("the versioned loader and service worker load backup before the Layer One shell", () => {
  const loaderBackup = scriptAsset(loaderSource, "galaxy-layer-one-backup.js");
  const loaderShell = scriptAsset(loaderSource, "galaxy-layer-one.js");
  const workerBackup = scriptAsset(serviceWorkerSource, "galaxy-layer-one-backup.js");
  const workerShell = scriptAsset(serviceWorkerSource, "galaxy-layer-one.js");

  assert.ok(loaderBackup.index < loaderShell.index, "backup engine must execute before the owning shell");
  assert.ok(workerBackup.index < workerShell.index, "the offline catalog must preserve the executable dependency order");
  assert.equal(workerBackup.version, loaderBackup.version, "backup cache-buster must match the loader");
  assert.equal(workerShell.version, loaderShell.version, "shell cache-buster must match the loader");
  assert.match(loaderSource, /galaxy-layer-one-data\.js\?v=\d+[\s\S]{0,900}galaxy-layer-one-backup\.js\?v=\d+[\s\S]{0,300}galaxy-layer-one\.js\?v=\d+/);
});

test("the v2 preview counts every store and the settings preview renders those counts", () => {
  const text = backup.serializeBackup({
    main: mainState("main-preview", "Tài liệu xem trước"),
    creator: {
      ...creatorPayload("creator-preview", "Dự án xem trước"),
      schedule: [
        { id: "schedule-a", projectId: "creator-preview", title: "A" },
        { id: "schedule-b", projectId: "creator-preview", title: "B" }
      ]
    },
    learning: learning.createExportPayload(learningState("deck-preview", "Bộ thẻ xem trước"), { exportedAt: FIXED_NOW }),
    records: [portableRecord("record-a", { value: 1 }), portableRecord("record-b", { value: 2 })]
  }, { now: FIXED_NOW });
  const preview = backup.inspectBackup(text);

  assert.equal(preview.ok, true);
  assert.equal(preview.version, 2);
  assert.deepEqual(
    {
      main: preview.stores.main.items,
      creatorProjects: preview.stores.creator.projects,
      creatorSchedule: preview.stores.creator.schedule,
      learningDecks: preview.stores.learning.decks,
      learningCards: preview.stores.learning.cards,
      records: preview.stores.records.records,
      total: preview.totalRecords
    },
    { main: 1, creatorProjects: 1, creatorSchedule: 2, learningDecks: 1, learningCards: 1, records: 2, total: 8 }
  );

  const shell = loadInstrumentedShell({ storage: makeStorage(mainState("", "")) });
  const markup = shell.api.viewMarkup("/galaxy/settings", mainState("", ""), {
    pendingBackup: {
      candidate: preview.candidate,
      complete: true,
      summary: {
        complete: true,
        items: preview.stores.main.items,
        events: preview.stores.main.events,
        creatorProjects: preview.stores.creator.projects,
        creatorSchedule: preview.stores.creator.schedule,
        learningDecks: preview.stores.learning.decks,
        learningCards: preview.stores.learning.cards,
        learningActivities: preview.stores.learning.activities,
        records: preview.stores.records.records,
        totalRecords: preview.totalRecords
      }
    }
  });
  assert.match(markup, /1 tài liệu, 0 sự kiện đã consent, 1 dự án\/2 lịch Creator, 1 bộ thẻ\/1 flashcard\/0 hoạt động học và 2 bản ghi JSON lớn/);
  assert.match(shellSource, /result\.stores\.main\.items[\s\S]{0,500}result\.stores\.creator\.projects[\s\S]{0,500}result\.stores\.learning\.cards[\s\S]{0,300}result\.stores\.records\.records/);
});

test("complete export awaits all stores, uses the v2 engine and always closes Creator", async () => {
  const current = completeBackupInput({
    mainId: "main-export", mainTitle: "Tài liệu xuất",
    creatorId: "creator-export", creatorTitle: "Dự án xuất",
    learningId: "learning-export", learningTitle: "Bộ thẻ xuất",
    recordId: "record-export", recordTitle: "JSON xuất"
  });
  const storage = makeStorage(current.main);
  const creator = makeCreatorAdapter(current.creator);
  const content = makeContentAdapter(current.records, learning.normalizeState(current.learning));
  let serializeCalls = 0;
  const backupApi = bridgeBackupApi({
    serializeBackup(input, options) {
      serializeCalls += 1;
      const serialized = backup.serializeBackup(clone(input), clone(options || {}));
      assert.equal(JSON.parse(serialized).version, 2);
      return serialized;
    }
  });
  const shell = loadInstrumentedShell({ storage, dataApi: creator.api, backupApi });
  const runtime = runtimeFixture({ storage, contentStorage: content, learningState: learning.normalizeState(current.learning) });
  shell.privateApi.setRuntime(runtime);

  const resultPromise = shell.privateApi.exportCompleteBackup();
  assert.equal(typeof resultPromise.then, "function", "complete export must remain asynchronous");
  assert.equal(await resultPromise, true);
  assert.equal(serializeCalls, 1);
  assert.equal(creator.readyCount(), 1);
  assert.equal(creator.closeCount(), 1, "Creator's IndexedDB-capable store must be closed after export");
  assert.equal(shell.downloads.length, 1);
  const exported = backup.parseBackup(shell.downloads[0].text);
  assert.equal(exported.version, 2);
  assert.deepEqual(exported.stores.main.items.map((item) => item.id), ["main-export"]);
  assert.deepEqual(exported.stores.creator.projects.map((item) => item.id), ["creator-export"]);
  assert.deepEqual(exported.stores.learning.decks.map((item) => item.id), ["learning-export"]);
  assert.deepEqual(exported.stores.records.map((item) => item.id), ["record-export"]);
});

test("complete import applies asynchronous merge and replace plans across all stores", async () => {
  const local = completeBackupInput({
    mainId: "main-local", mainTitle: "Main local",
    creatorId: "creator-local", creatorTitle: "Creator local",
    learningId: "learning-local", learningTitle: "Learning local",
    recordId: "record-local", recordTitle: "Record local"
  });
  const incoming = completeBackupInput({
    mainId: "main-incoming", mainTitle: "Main incoming",
    creatorId: "creator-incoming", creatorTitle: "Creator incoming",
    learningId: "learning-incoming", learningTitle: "Learning incoming",
    recordId: "record-incoming", recordTitle: "Record incoming"
  });
  const storage = makeStorage(local.main);
  const creator = makeCreatorAdapter(local.creator, async () => Promise.resolve());
  const content = makeContentAdapter(local.records, learning.normalizeState(local.learning));
  const shell = loadInstrumentedShell({ storage, dataApi: creator.api });
  const runtime = runtimeFixture({ storage, contentStorage: content, learningState: learning.normalizeState(local.learning) });
  shell.privateApi.setRuntime(runtime);
  const candidate = backup.buildBackup(incoming, { now: FIXED_NOW });

  const mergePromise = shell.privateApi.applyCompleteBackup(candidate, "merge");
  assert.equal(typeof mergePromise.then, "function");
  const merged = await mergePromise;
  assert.equal(merged.ok, true);
  assert.equal(merged.plan.mode, "merge");
  assert.deepEqual(storage.snapshot().items.map((item) => item.id).sort(), ["main-incoming", "main-local"]);
  assert.deepEqual(creator.state().projects.map((item) => item.id).sort(), ["creator-incoming", "creator-local"]);
  assert.deepEqual(runtime.learningState.decks.map((item) => item.id).sort(), ["learning-incoming", "learning-local"]);
  assert.deepEqual(content.portable().map((item) => item.id).sort(), ["record-incoming", "record-local"]);
  assert.deepEqual(clone(runtime.localState), storage.snapshot(), "runtime.localState must refresh after a successful merge");

  const replaced = await shell.privateApi.applyCompleteBackup(candidate, "replace");
  assert.equal(replaced.ok, true);
  assert.equal(replaced.plan.mode, "replace");
  assert.deepEqual(storage.snapshot().items.map((item) => item.id), ["main-incoming"]);
  assert.deepEqual(creator.state().projects.map((item) => item.id), ["creator-incoming"]);
  assert.deepEqual(runtime.learningState.decks.map((item) => item.id), ["learning-incoming"]);
  assert.deepEqual(content.portable().map((item) => item.id), ["record-incoming"]);
  assert.deepEqual(clone(runtime.localState), storage.snapshot(), "runtime.localState must refresh after a successful replace");
  assert.equal(creator.closeCount(), 4, "each current-state read and Creator import owns and closes its store");
  assert.ok(creator.imports.every((entry) => entry.options.audit === false), "the pure plan resolves merge before unaudited transaction replacement");
});

test("rollback restores main, Creator, Learning and portable records when each forward source fails", async (suite) => {
  for (const failedSource of ["creator", "learning", "records", "main"]) {
    await suite.test(failedSource, async () => {
      const local = completeBackupInput({
        mainId: "main-local", mainTitle: "Main local",
        creatorId: "creator-local", creatorTitle: "Creator local",
        learningId: "learning-local", learningTitle: "Learning local",
        recordId: "record-local", recordTitle: "Record local"
      });
      const incoming = completeBackupInput({
        mainId: "main-incoming", mainTitle: "Main incoming",
        creatorId: "creator-incoming", creatorTitle: "Creator incoming",
        learningId: "learning-incoming", learningTitle: "Learning incoming",
        recordId: "record-incoming", recordTitle: "Record incoming"
      });
      let failed = false;
      const storage = makeStorage(local.main, ({ value }) => {
        if (failedSource === "main" && !failed && JSON.parse(value).items.some((item) => item.id === "main-incoming")) {
          failed = true;
          throw new Error("MAIN_FORWARD_FAILURE");
        }
      });
      const creator = makeCreatorAdapter(local.creator, async ({ candidate }) => {
        if (failedSource === "creator" && !failed && candidate.projects.some((item) => item.id === "creator-incoming")) {
          failed = true;
          throw new Error("CREATOR_FORWARD_FAILURE");
        }
      });
      const content = makeContentAdapter(local.records, learning.normalizeState(local.learning), async ({ op, route, id, value }) => {
        if (failedSource === "learning" && !failed && op === "put" && route === "/galaxy/learning" && value.decks.some((deck) => deck.id === "learning-incoming")) {
          failed = true;
          throw new Error("LEARNING_FORWARD_FAILURE");
        }
        if (failedSource === "records" && !failed && op === "put" && id === "record-incoming") {
          failed = true;
          throw new Error("RECORD_FORWARD_FAILURE");
        }
      });
      const shell = loadInstrumentedShell({ storage, dataApi: creator.api });
      const runtime = runtimeFixture({ storage, contentStorage: content, learningState: learning.normalizeState(local.learning) });
      shell.privateApi.setRuntime(runtime);
      const before = normalizedSnapshot(runtime, creator, content);

      const result = await shell.privateApi.applyCompleteBackup(backup.buildBackup(incoming, { now: FIXED_NOW }), "replace");
      assert.equal(result.ok, false);
      assert.equal(failed, true, `${failedSource} fault must be reached`);
      assert.deepEqual(normalizedSnapshot(runtime, creator, content), before, `${failedSource} failure must restore every source`);
      assert.deepEqual(clone(runtime.localState), storage.snapshot(), "the in-memory main snapshot must follow the rollback result");
      assert.equal(creator.readyCount(), creator.closeCount(), "Creator store must close on success, failure and rollback");
    });
  }
});

test("rollback attempts independent sources even if one rollback adapter also fails", async () => {
  const local = completeBackupInput({
    mainId: "main-local", mainTitle: "Main local",
    creatorId: "creator-local", creatorTitle: "Creator local",
    learningId: "learning-local", learningTitle: "Learning local",
    recordId: "record-local", recordTitle: "Record local"
  });
  const incoming = completeBackupInput({
    mainId: "main-incoming", mainTitle: "Main incoming",
    creatorId: "creator-incoming", creatorTitle: "Creator incoming",
    learningId: "learning-incoming", learningTitle: "Learning incoming",
    recordId: "record-incoming", recordTitle: "Record incoming"
  });
  let rejectedMain = false;
  const storage = makeStorage(local.main, ({ value }) => {
    if (!rejectedMain && JSON.parse(value).items.some((item) => item.id === "main-incoming")) {
      rejectedMain = true;
      throw new Error("MAIN_FORWARD_FAILURE");
    }
  });
  let importNumber = 0;
  const creator = makeCreatorAdapter(local.creator, async ({ candidate }) => {
    importNumber += 1;
    if (importNumber === 2 && candidate.projects.some((item) => item.id === "creator-local")) {
      throw new Error("CREATOR_ROLLBACK_FAILURE");
    }
  });
  const content = makeContentAdapter(local.records, learning.normalizeState(local.learning));
  const shell = loadInstrumentedShell({ storage, dataApi: creator.api });
  const runtime = runtimeFixture({ storage, contentStorage: content, learningState: learning.normalizeState(local.learning) });
  shell.privateApi.setRuntime(runtime);

  const result = await shell.privateApi.applyCompleteBackup(backup.buildBackup(incoming, { now: FIXED_NOW }), "replace");
  assert.equal(result.ok, false);
  assert.equal(rejectedMain, true);
  assert.deepEqual(clone(result.rollbackFailed), ["creator"]);
  assert.deepEqual(runtime.learningState.decks.map((deck) => deck.id), ["learning-local"], "Learning rollback must not be skipped by a Creator rollback error");
  assert.deepEqual(content.portable().map((record) => record.id), ["record-local"], "record rollback must not be skipped by a Creator rollback error");
  assert.deepEqual(storage.snapshot().items.map((item) => item.id), ["main-local"], "main rollback must remain independently attempted");
  assert.equal(creator.readyCount(), creator.closeCount(), "a rejected Creator rollback must still close its store");
});

test("legacy v1 packages remain importable through the v2 complete plan", () => {
  const legacy = JSON.stringify({
    schema: backup.SCHEMA,
    version: 1,
    exportedAt: FIXED_NOW,
    data: mainState("legacy-main", "Tài liệu phiên bản 1")
  });
  const preview = backup.inspectBackup(legacy);
  assert.equal(preview.ok, true);
  assert.equal(preview.version, 2);
  assert.equal(preview.migratedFrom, 1);
  assert.equal(preview.stores.main.items, 1);
  assert.equal(preview.stores.creator.records, 0);
  assert.equal(preview.stores.learning.records, 0);
  assert.equal(preview.stores.records.records, 0);

  const plan = backup.createImportPlan(completeBackupInput({}), preview.candidate, { mode: "replace", now: FIXED_NOW });
  assert.equal(plan.source.migratedFrom, 1);
  assert.deepEqual(plan.stores.main.items.map((item) => item.id), ["legacy-main"]);
  assert.deepEqual(plan.stores.creator.projects, []);
  assert.deepEqual(plan.stores.learning.decks, []);
  assert.deepEqual(plan.stores.records, []);
});

test("complete backup fails closed when a required engine or content store is missing", async (suite) => {
  const local = completeBackupInput({
    mainId: "main-local", mainTitle: "Main local",
    creatorId: "creator-local", creatorTitle: "Creator local",
    learningId: "learning-local", learningTitle: "Learning local",
    recordId: "record-local", recordTitle: "Record local"
  });
  const incoming = backup.buildBackup(completeBackupInput({ mainId: "main-incoming", mainTitle: "Main incoming" }), { now: FIXED_NOW });

  await suite.test("backup engine", async () => {
    const storage = makeStorage(local.main);
    const creator = makeCreatorAdapter(local.creator);
    const content = makeContentAdapter(local.records, learning.normalizeState(local.learning));
    const shell = loadInstrumentedShell({ storage, dataApi: creator.api, backupApi: {} });
    const runtime = runtimeFixture({ storage, contentStorage: content, learningState: learning.normalizeState(local.learning) });
    shell.privateApi.setRuntime(runtime);
    assert.deepEqual(
      clone(await shell.privateApi.applyCompleteBackup(incoming, "replace")),
      { ok: false, error: "BACKUP_ENGINE_UNAVAILABLE", imported: 0 }
    );
    assert.equal(await shell.privateApi.exportCompleteBackup(), false);
    assert.equal(shell.downloads.length, 0);
    assert.equal(creator.readyCount(), 0, "no source may be opened without the validating backup engine");
  });

  await suite.test("Creator engine", async () => {
    const storage = makeStorage(local.main);
    const content = makeContentAdapter(local.records, learning.normalizeState(local.learning));
    const shell = loadInstrumentedShell({ storage });
    const runtime = runtimeFixture({ storage, contentStorage: content, learningState: learning.normalizeState(local.learning) });
    shell.privateApi.setRuntime(runtime);
    const result = await shell.privateApi.applyCompleteBackup(incoming, "replace");
    assert.equal(result.ok, false);
    assert.match(result.error, /CREATOR_ENGINE_UNAVAILABLE/);
    assert.deepEqual(storage.snapshot().items.map((item) => item.id), ["main-local"]);
  });

  await suite.test("content storage", async () => {
    const storage = makeStorage(local.main);
    const creator = makeCreatorAdapter(local.creator);
    const shell = loadInstrumentedShell({ storage, dataApi: creator.api });
    const runtime = runtimeFixture({ storage, contentStorage: null, learningState: learning.normalizeState(local.learning) });
    shell.privateApi.setRuntime(runtime);
    const result = await shell.privateApi.applyCompleteBackup(incoming, "replace");
    assert.equal(result.ok, false);
    assert.match(result.error, /CONTENT_STORAGE_UNAVAILABLE/);
    assert.deepEqual(storage.snapshot().items.map((item) => item.id), ["main-local"]);
    assert.deepEqual(creator.state().projects.map((item) => item.id), ["creator-local"]);
    assert.equal(creator.readyCount(), creator.closeCount());
  });
});

test("Creator store lifecycle exposes close and the shell awaits it in finally", async () => {
  const creator = makeCreatorAdapter(creatorPayload("creator-close", "Creator close"));
  const storage = makeStorage(mainState("", ""));
  const shell = loadInstrumentedShell({ storage, dataApi: creator.api });
  shell.privateApi.setRuntime(runtimeFixture({ storage, contentStorage: null, learningState: learningState("", "") }));

  await assert.rejects(
    shell.privateApi.withCreatorStore(async () => { throw new Error("CALLBACK_FAILURE"); }),
    /CALLBACK_FAILURE/
  );
  assert.equal(creator.readyCount(), 1);
  assert.equal(creator.closeCount(), 1);
  assert.match(dataSource, /function close\(\)\s*\{[\s\S]{0,600}database\.close\(\)[\s\S]{0,600}close:\s*close/);
  assert.match(shellSource, /async function withCreatorStore[\s\S]{0,650}finally\s*\{[\s\S]{0,260}await store\.close\(\)/);
});
