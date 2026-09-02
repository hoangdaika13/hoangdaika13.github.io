const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const modulePath = path.join(__dirname, "..", "galaxy-layer-one-storage.js");
const source = fs.readFileSync(modulePath, "utf8");
const storage = require(modulePath);

let namespaceSequence = 0;

function uniqueNamespace(label) {
  namespaceSequence += 1;
  return "test-" + label + "-" + process.pid + "-" + namespaceSequence;
}

function hasCode(code) {
  return function matchesStorageError(error) {
    assert.equal(error && error.name, "GalaxyStorageError");
    assert.equal(error && error.code, code);
    return true;
  };
}

function createAdapter(options) {
  const config = options || {};
  const memory = storage.createMemoryBackend({
    isolated: true,
    seed: Array.isArray(config.seed) ? config.seed : []
  });
  const counts = {
    open: 0,
    get: 0,
    list: 0,
    put: 0,
    delete: 0,
    clear: 0,
    stats: 0,
    close: 0,
    abort: 0
  };
  const adapter = {
    kind: config.kind || "fake",
    persistent: config.persistent === true,
    async open(context) {
      counts.open += 1;
      if (config.openError) throw config.openError;
      await memory.open(context);
      return adapter;
    },
    get(key) { counts.get += 1; return memory.get(key); },
    list(route) { counts.list += 1; return memory.list(route); },
    put(record) { counts.put += 1; return memory.put(record); },
    delete(key) { counts.delete += 1; return memory.delete(key); },
    clear(route) { counts.clear += 1; return memory.clear(route); },
    stats(route) { counts.stats += 1; return memory.stats(route); },
    async close() { counts.close += 1; await memory.close(); },
    async abort(reason) { counts.abort += 1; await memory.abort(reason); },
    dump() { return memory.dump(); }
  };
  return { adapter, counts };
}

test("exposes one frozen UMD/CommonJS API with immutable defaults", () => {
  assert.equal(globalThis.HHGalaxyLayerOneStorage, storage);
  assert.ok(Object.isFrozen(storage));
  assert.ok(Object.isFrozen(storage.defaultLimits));
  assert.equal(storage.schema, "hh-galaxy-layer-one-storage");
  assert.equal(storage.version, 1);
  assert.deepEqual(
    Object.keys(storage).sort(),
    [
      "cloneValue",
      "createEngine",
      "createIndexedDbBackend",
      "createMemoryBackend",
      "defaultLimits",
      "estimateBytes",
      "schema",
      "version"
    ]
  );

  const browserContext = {};
  vm.runInNewContext(source, browserContext, { filename: "galaxy-layer-one-storage.js" });
  assert.equal(typeof browserContext.HHGalaxyLayerOneStorage.createEngine, "function");
  assert.ok(Object.isFrozen(browserContext.HHGalaxyLayerOneStorage));
});

test("contains no localStorage dependency for large or blob data", () => {
  assert.doesNotMatch(source, /localStorage/i);
});

test("falls back to an explicit non-persistent memory session when IndexedDB is unavailable", async (t) => {
  const engine = storage.createEngine({
    name: uniqueNamespace("no-idb"),
    indexedDB: null,
    isolatedMemory: true
  });
  t.after(() => engine.close());

  await engine.open();
  const status = engine.status();
  assert.deepEqual(
    {
      state: status.state,
      backend: status.backend,
      persistent: status.persistent,
      fallback: status.fallback,
      fallbackReason: status.fallbackReason
    },
    {
      state: "ready",
      backend: "memory",
      persistent: false,
      fallback: true,
      fallbackReason: "INDEXEDDB_UNAVAILABLE"
    }
  );
  assert.ok(Object.isFrozen(status));
  assert.ok(Object.isFrozen(status.limits));
});

test("keeps CRUD records isolated by route", async (t) => {
  const engine = storage.createEngine({
    name: uniqueNamespace("routes"),
    indexedDB: null,
    isolatedMemory: true,
    now: () => 1_700_000_000_000
  });
  t.after(() => engine.close());

  await engine.put("/galaxy/video", "shared", { title: "Video" });
  await engine.put("/galaxy/music", "shared", { title: "Music" });

  assert.equal((await engine.get("/galaxy/video", "shared")).value.title, "Video");
  assert.equal((await engine.get("/galaxy/music", "shared")).value.title, "Music");
  assert.equal((await engine.list("/galaxy/video")).length, 1);
  assert.equal(await engine.delete("/galaxy/video", "shared"), true);
  assert.equal(await engine.delete("/galaxy/video", "shared"), false);
  assert.equal(await engine.get("/galaxy/video", "shared"), null);
  assert.equal((await engine.get("/galaxy/music", "shared")).value.title, "Music");
  assert.deepEqual(await engine.usage("/galaxy/video"), { records: 0, bytes: 0, route: "/galaxy/video" });
  assert.equal(await engine.clear("/galaxy/music"), 1);
  assert.equal(await engine.clear("/galaxy/music"), 0);
});

test("lists deterministically with newest-first, oldest-first, offset, and capped limits", async (t) => {
  let clock = 1_700_000_000_000;
  const engine = storage.createEngine({
    name: uniqueNamespace("list"),
    indexedDB: null,
    isolatedMemory: true,
    limits: { maxListResults: 2 },
    now: () => { clock += 1000; return clock; }
  });
  t.after(() => engine.close());

  await engine.put("/galaxy/tools", "a", { order: 1 });
  await engine.put("/galaxy/tools", "b", { order: 2 });
  await engine.put("/galaxy/tools", "c", { order: 3 });

  assert.deepEqual((await engine.list("/galaxy/tools")).map((record) => record.id), ["c", "b"]);
  assert.deepEqual(
    (await engine.list("/galaxy/tools", { limit: 99, offset: 1 })).map((record) => record.id),
    ["b", "a"]
  );
  assert.deepEqual(
    (await engine.list("/galaxy/tools", { newestFirst: false })).map((record) => record.id),
    ["a", "b"]
  );
});

test("clones values on input and every output, including typed arrays and cycles", async (t) => {
  const engine = storage.createEngine({
    name: uniqueNamespace("clone"),
    indexedDB: null,
    isolatedMemory: true
  });
  t.after(() => engine.close());

  const input = { nested: { label: "original" }, bytes: new Uint8Array([1, 2, 3]) };
  const metadata = { tags: ["safe"] };
  const stored = await engine.put("/galaxy/creator", "draft-1", input, metadata);
  input.nested.label = "mutated";
  input.bytes[0] = 9;
  metadata.tags.push("mutated");
  stored.value.nested.label = "changed-output";

  const firstRead = await engine.get("/galaxy/creator", "draft-1");
  assert.equal(firstRead.value.nested.label, "original");
  assert.deepEqual([...firstRead.value.bytes], [1, 2, 3]);
  assert.deepEqual(firstRead.metadata.tags, ["safe"]);

  firstRead.value.bytes[1] = 8;
  firstRead.metadata.tags[0] = "changed";
  const listed = await engine.list("/galaxy/creator");
  assert.deepEqual([...listed[0].value.bytes], [1, 2, 3]);
  assert.deepEqual(listed[0].metadata.tags, ["safe"]);

  const cyclic = { title: "cycle" };
  cyclic.self = cyclic;
  const cyclicClone = storage.cloneValue(cyclic);
  assert.notEqual(cyclicClone, cyclic);
  assert.equal(cyclicClone.self, cyclicClone);
});

test("rejects functions, symbols, accessors, and unsupported object prototypes", async (t) => {
  const engine = storage.createEngine({
    name: uniqueNamespace("invalid-clone"),
    indexedDB: null,
    isolatedMemory: true
  });
  t.after(() => engine.close());

  class UnsupportedRecord {}
  const accessor = {};
  Object.defineProperty(accessor, "secret", { enumerable: true, get() { return "hidden"; } });
  const hiddenAccessor = {};
  Object.defineProperty(hiddenAccessor, "secret", { enumerable: false, get() { return "hidden"; } });
  const symbolKey = { safe: true };
  symbolKey[Symbol("hidden")] = "unsupported";

  await assert.rejects(engine.put("/galaxy/ai", "fn", { run() {} }), hasCode("CLONE_FAILED"));
  await assert.rejects(engine.put("/galaxy/ai", "symbol", Symbol("x")), hasCode("CLONE_FAILED"));
  await assert.rejects(engine.put("/galaxy/ai", "accessor", accessor), hasCode("CLONE_FAILED"));
  await assert.rejects(engine.put("/galaxy/ai", "hidden-accessor", hiddenAccessor), hasCode("CLONE_FAILED"));
  await assert.rejects(engine.put("/galaxy/ai", "symbol-key", symbolKey), hasCode("CLONE_FAILED"));
  await assert.rejects(engine.put("/galaxy/ai", "prototype", new UnsupportedRecord()), hasCode("CLONE_FAILED"));
});

test("validates routes, optional allowlists, and record IDs before touching storage", async (t) => {
  const engine = storage.createEngine({
    name: uniqueNamespace("validation"),
    indexedDB: null,
    isolatedMemory: true,
    allowedRoutes: ["/galaxy/video", "/galaxy/music"]
  });
  t.after(() => engine.close());

  await assert.rejects(engine.put("galaxy/video", "ok", {}), hasCode("ROUTE_INVALID"));
  await assert.rejects(engine.put("/galaxy/video?tab=1", "ok", {}), hasCode("ROUTE_INVALID"));
  await assert.rejects(engine.put("/galaxy/../settings", "ok", {}), hasCode("ROUTE_INVALID"));
  await assert.rejects(engine.put("/galaxy//video", "ok", {}), hasCode("ROUTE_INVALID"));
  await assert.rejects(engine.put("/galaxy/unknown", "ok", {}), hasCode("ROUTE_NOT_ALLOWED"));
  await assert.rejects(engine.put("/galaxy/video", "bad id", {}), hasCode("ID_INVALID"));
  await assert.rejects(engine.put("/galaxy/video", "x".repeat(129), {}), hasCode("ID_INVALID"));
  await engine.put("/galaxy/video", "valid_ID-1.0", { ok: true });
  assert.equal((await engine.usage()).records, 1);
});

test("measures UTF-8 and binary payload sizes deterministically", () => {
  assert.equal(storage.estimateBytes("A"), 1);
  assert.equal(storage.estimateBytes("é"), 2);
  assert.equal(storage.estimateBytes("😀"), 4);
  assert.equal(storage.estimateBytes(new Uint8Array(17)), 17);
  assert.equal(storage.estimateBytes(new ArrayBuffer(23)), 23);
});

test("enforces exact per-record byte boundaries", async (t) => {
  const route = "/galaxy/video";
  const id = "boundary";
  const value = { text: "vũ trụ 😀" };
  const exactBytes = storage.estimateBytes({ route, id, value, metadata: {} });
  const engine = storage.createEngine({
    name: uniqueNamespace("record-bytes"),
    indexedDB: null,
    isolatedMemory: true,
    limits: { maxRecordBytes: exactBytes, maxTotalBytes: exactBytes * 4 }
  });
  t.after(() => engine.close());

  await engine.put(route, id, value);
  await assert.rejects(engine.put(route, "too-large", { text: "x".repeat(exactBytes * 2) }), hasCode("RECORD_BYTES_EXCEEDED"));
  assert.equal((await engine.usage()).records, 1);
});

test("serializes concurrent writes and enforces the global record limit", async (t) => {
  const engine = storage.createEngine({
    name: uniqueNamespace("record-limit"),
    indexedDB: null,
    isolatedMemory: true,
    limits: { maxRecords: 2 }
  });
  t.after(() => engine.close());

  const results = await Promise.allSettled([
    engine.put("/galaxy/games", "one", { value: 1 }),
    engine.put("/galaxy/games", "two", { value: 2 }),
    engine.put("/galaxy/games", "three", { value: 3 })
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 2);
  const rejection = results.find((result) => result.status === "rejected");
  assert.equal(rejection.reason.code, "RECORD_LIMIT_EXCEEDED");
  assert.equal((await engine.usage()).records, 2);
});

test("enforces total bytes and accounts for replacements by delta", async (t) => {
  const route = "/galaxy/music";
  const firstValue = { text: "a".repeat(80) };
  const secondValue = { text: "b".repeat(90) };
  const firstBytes = storage.estimateBytes({ route, id: "first", value: firstValue, metadata: {} });
  const secondBytes = storage.estimateBytes({ route, id: "second", value: secondValue, metadata: {} });
  const totalLimit = firstBytes + secondBytes - 1;
  const engine = storage.createEngine({
    name: uniqueNamespace("total-bytes"),
    indexedDB: null,
    isolatedMemory: true,
    limits: { maxRecordBytes: Math.max(firstBytes, secondBytes) + 50, maxTotalBytes: totalLimit }
  });
  t.after(() => engine.close());

  await engine.put(route, "first", firstValue);
  await assert.rejects(engine.put(route, "second", secondValue), hasCode("TOTAL_BYTES_EXCEEDED"));
  assert.deepEqual(await engine.usage(), { records: 1, bytes: firstBytes, route: null });

  const smallerValue = { text: "small" };
  const smallerBytes = storage.estimateBytes({ route, id: "first", value: smallerValue, metadata: {} });
  await engine.put(route, "first", smallerValue);
  assert.deepEqual(await engine.usage(), { records: 1, bytes: smallerBytes, route: null });
  await engine.put(route, "second", secondValue);
  assert.deepEqual(await engine.usage(), { records: 2, bytes: smallerBytes + secondBytes, route: null });
});

test("migrates seeded legacy payload/meta records without mutating the seed", async (t) => {
  const seed = {
    route: "/galaxy/creator",
    id: "legacy-draft",
    payload: { title: "Bản nháp cũ" },
    meta: { imported: true },
    schemaVersion: 0,
    createdAt: "2025-01-02T03:04:05.000Z"
  };
  const backend = storage.createMemoryBackend({ isolated: true, seed: [seed] });
  const engine = storage.createEngine({ backend, now: () => 1_700_000_000_000 });
  t.after(() => engine.close());

  await engine.open();
  const record = await engine.get("/galaxy/creator", "legacy-draft");
  assert.deepEqual(record.value, { title: "Bản nháp cũ" });
  assert.deepEqual(record.metadata, { imported: true });
  assert.equal(record.schemaVersion, 1);
  assert.equal(record.schema, storage.schema);
  assert.equal(record.createdAt, "2025-01-02T03:04:05.000Z");
  assert.equal(Object.hasOwn(seed, "value"), false);
});

test("runs sequential custom migrations and fails closed when a version step is missing", async (t) => {
  const legacyV1 = {
    route: "/galaxy/learning",
    id: "lesson",
    value: { progress: 1 },
    metadata: {},
    schemaVersion: 1
  };
  const migratedBackend = storage.createMemoryBackend({ isolated: true, seed: [legacyV1] });
  const migratedEngine = storage.createEngine({
    backend: migratedBackend,
    version: 2,
    migrations: {
      2(record, context) {
        assert.deepEqual(context, { from: 1, to: 2, schema: storage.schema });
        record.metadata = { migrated: true };
        return record;
      }
    }
  });
  t.after(() => migratedEngine.close());
  await migratedEngine.open();
  assert.deepEqual((await migratedEngine.get("/galaxy/learning", "lesson")).metadata, { migrated: true });

  const missingBackend = storage.createMemoryBackend({ isolated: true, seed: [legacyV1] });
  const missingEngine = storage.createEngine({ backend: missingBackend, version: 2 });
  await assert.rejects(missingEngine.open(), hasCode("MIGRATION_MISSING"));
  assert.equal(missingEngine.status().state, "error");
  assert.equal(missingEngine.status().error, "MIGRATION_MISSING");
});

test("prefers an injected IndexedDB backend factory when persistence opens successfully", async (t) => {
  const fake = createAdapter({ kind: "indexeddb-test", persistent: true });
  let factoryCalls = 0;
  const engine = storage.createEngine({
    name: uniqueNamespace("idb-preferred"),
    indexedDB: { open() {} },
    indexedDbBackendFactory(indexedDB, options) {
      factoryCalls += 1;
      assert.equal(typeof indexedDB.open, "function");
      assert.equal(options.version, 1);
      return fake.adapter;
    }
  });
  t.after(() => engine.close());

  await engine.open();
  await engine.put("/galaxy/analytics", "metric", { real: true });
  assert.equal(factoryCalls, 1);
  assert.equal(fake.counts.open, 1);
  assert.equal(fake.counts.put, 1);
  assert.equal(engine.status().backend, "indexeddb");
  assert.equal(engine.status().persistent, true);
  assert.equal(engine.status().fallback, false);
});

test("falls back transparently after an IndexedDB open failure", async (t) => {
  const openError = Object.assign(new Error("denied"), {
    name: "GalaxyStorageError",
    code: "IDB_DENIED"
  });
  const failed = createAdapter({ persistent: true, openError });
  const engine = storage.createEngine({
    name: uniqueNamespace("idb-fallback"),
    indexedDB: { open() {} },
    indexedDbBackendFactory: () => failed.adapter,
    isolatedMemory: true
  });
  t.after(() => engine.close());

  await engine.open();
  assert.equal(failed.counts.open, 1);
  assert.equal(failed.counts.close, 1);
  assert.equal(engine.status().backend, "memory");
  assert.equal(engine.status().persistent, false);
  assert.equal(engine.status().fallbackReason, "IDB_DENIED");
  await engine.put("/galaxy/community", "offline-draft", { body: "safe" });
  assert.equal((await engine.get("/galaxy/community", "offline-draft")).value.body, "safe");
});

test("fails closed when IndexedDB is unavailable or broken and memory fallback is disabled", async () => {
  const unavailable = storage.createEngine({ indexedDB: null, allowMemoryFallback: false });
  await assert.rejects(unavailable.open(), hasCode("INDEXEDDB_UNAVAILABLE"));
  assert.equal(unavailable.status().state, "error");

  const openError = Object.assign(new Error("blocked"), {
    name: "GalaxyStorageError",
    code: "INDEXEDDB_BLOCKED"
  });
  const failed = createAdapter({ persistent: true, openError });
  const broken = storage.createEngine({
    indexedDB: { open() {} },
    indexedDbBackendFactory: () => failed.adapter,
    allowMemoryFallback: false
  });
  await assert.rejects(broken.open(), hasCode("INDEXEDDB_BLOCKED"));
  assert.equal(broken.status().backend, "none");
  assert.equal(failed.counts.close, 1);
});

test("uses an explicit backend lifecycle and rejects incomplete adapters", async (t) => {
  const fake = createAdapter({ kind: "test-adapter", persistent: true });
  const engine = storage.createEngine({ backend: fake.adapter });
  t.after(() => engine.close());

  await engine.open();
  await engine.put("/galaxy/dev", "project", { name: "HH" });
  await engine.get("/galaxy/dev", "project");
  await engine.list("/galaxy/dev");
  await engine.usage();
  await engine.delete("/galaxy/dev", "project");
  await engine.clear("/galaxy/dev");
  assert.equal(engine.status().backend, "test-adapter");
  assert.ok(fake.counts.get >= 2);
  assert.ok(fake.counts.stats >= 2);

  const invalid = storage.createEngine({ backend: { open() {} } });
  await assert.rejects(invalid.open(), hasCode("BACKEND_INVALID"));
});

test("restore writes a validated portable record without losing its original timestamps", async (t) => {
  const engine = storage.createEngine({
    name: uniqueNamespace("restore-record"),
    indexedDB: null,
    isolatedMemory: true,
    allowedRoutes: ["/galaxy/tools"]
  });
  t.after(() => engine.close());
  const input = {
    route: "/galaxy/tools",
    id: "portable-json",
    value: { title: "Dữ liệu đã sao lưu" },
    metadata: { contentType: "application/json" },
    createdAt: "2025-01-02T03:04:05.000Z",
    updatedAt: "2026-02-03T04:05:06.000Z"
  };

  const restored = await engine.restore(input);
  assert.equal(restored.createdAt, input.createdAt);
  assert.equal(restored.updatedAt, input.updatedAt);
  assert.deepEqual((await engine.get(input.route, input.id)).value, input.value);
  input.value.title = "Đã sửa bên ngoài";
  assert.equal((await engine.get(input.route, input.id)).value.title, "Dữ liệu đã sao lưu");
  await assert.rejects(engine.restore({ route: "/galaxy/tools", id: "missing-value" }), hasCode("RECORD_VALUE_REQUIRED"));
  await assert.rejects(engine.restore({ route: "/outside", id: "bad", value: null }), hasCode("ROUTE_NOT_ALLOWED"));
});

test("close is idempotent, cleans the backend, and prevents every later operation", async () => {
  const fake = createAdapter({ kind: "lifecycle" });
  const engine = storage.createEngine({ backend: fake.adapter });
  await engine.open();

  assert.equal(await engine.close(), true);
  assert.equal(await engine.close(), false);
  assert.equal(fake.counts.close, 1);
  assert.equal(engine.status().state, "closed");
  await assert.rejects(engine.open(), hasCode("CLOSED"));
  await assert.rejects(engine.get("/galaxy/video", "id"), hasCode("CLOSED"));
  await assert.rejects(engine.put("/galaxy/video", "id", {}), hasCode("CLOSED"));
});

test("close during open closes the late backend and leaves no usable engine", async () => {
  let releaseOpen;
  const gate = new Promise((resolve) => { releaseOpen = resolve; });
  const counts = { close: 0, abort: 0 };
  const backend = {
    kind: "delayed",
    persistent: true,
    async open() { await gate; return backend; },
    async get() { return null; },
    async list() { return []; },
    async put() { return true; },
    async delete() { return false; },
    async clear() { return 0; },
    async stats() { return { records: 0, bytes: 0 }; },
    async close() { counts.close += 1; },
    async abort() { counts.abort += 1; }
  };
  const engine = storage.createEngine({ backend });
  const openingRejected = assert.rejects(engine.open(), hasCode("CLOSED"));
  await Promise.resolve();
  assert.equal(await engine.close(), true);
  releaseOpen();
  await openingRejected;
  assert.equal(counts.close, 1);
  assert.equal(counts.abort, 0);
  assert.equal(engine.status().state, "closed");
});

test("manual and external aborts clean resources and prevent future operations", async () => {
  const fake = createAdapter({ kind: "abortable" });
  const engine = storage.createEngine({ backend: fake.adapter });
  await engine.open();
  assert.equal(await engine.abort("user-request"), true);
  assert.equal(await engine.abort("again"), false);
  assert.equal(fake.counts.abort, 1);
  assert.equal(engine.status().state, "aborted");
  assert.equal(engine.status().error, "user-request");
  await assert.rejects(engine.get("/galaxy/video", "id"), hasCode("ABORTED"));

  const controller = new AbortController();
  const external = storage.createEngine({
    name: uniqueNamespace("external-abort"),
    indexedDB: null,
    isolatedMemory: true,
    signal: controller.signal
  });
  await external.open();
  controller.abort("navigation");
  await assert.rejects(external.put("/galaxy/music", "draft", {}), hasCode("ABORTED"));
  assert.equal(external.status().state, "aborted");

  const alreadyAborted = new AbortController();
  alreadyAborted.abort("already-gone");
  const neverOpened = storage.createEngine({ signal: alreadyAborted.signal, indexedDB: null });
  await assert.rejects(neverOpened.open(), hasCode("ABORTED"));
});

test("memory namespaces persist only for the current JS session and clone across engines", async () => {
  const namespace = uniqueNamespace("session");
  const first = storage.createEngine({ name: namespace, indexedDB: null });
  await first.put("/galaxy/settings", "preferences", { uiScale: 1.25 });
  await first.close();

  const second = storage.createEngine({ name: namespace, indexedDB: null });
  const restored = await second.get("/galaxy/settings", "preferences");
  assert.deepEqual(restored.value, { uiScale: 1.25 });
  restored.value.uiScale = 4;
  assert.deepEqual((await second.get("/galaxy/settings", "preferences")).value, { uiScale: 1.25 });
  await second.clear("/galaxy/settings");
  await second.close();
});
