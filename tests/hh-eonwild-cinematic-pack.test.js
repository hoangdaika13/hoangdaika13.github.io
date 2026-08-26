"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packs = require(path.join(root, "hh-eonwild-cinematic-pack.js"));
const worker = require(path.join(root, "hh-eonwild-cinematic-pack-worker.js"));
const source = fs.readFileSync(path.join(root, "hh-eonwild-cinematic-pack.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const pipelineDocs = fs.readFileSync(path.join(root, "docs", "HH_EONWILD_ASSET_PIPELINE.md"), "utf8");
const LICENSE_REPORT_TEXT = "reviewed-owner-license-report-v1";
const LICENSE_REPORT_SHA256 = crypto.createHash("sha256").update(LICENSE_REPORT_TEXT).digest("hex");
const licenseReportResponse = () => new Response(LICENSE_REPORT_TEXT, { status: 200, headers: { "content-type": "text/plain", "content-length": String(Buffer.byteLength(LICENSE_REPORT_TEXT)) } });

const makeManifest = () => ({
  format: packs.MANIFEST_FORMAT,
  version: packs.MANIFEST_VERSION,
  id: "creature-ultra",
  build: "2026.08.24-owner",
  immutable: true,
  totalBytes: 12,
  licenseReportUrl: "https://hoang8.com/eonwild/licenses/creature-ultra",
  licenseReportSha256: LICENSE_REPORT_SHA256,
  assets: [0, 1, 2, 3].map((lod) => ({
    path: `tyrannosaurus/lod${lod}.glb`,
    role: `creature:tyrannosaurus:lod${lod}`,
    url: `https://hoang8.com/eonwild/creature-ultra/abc123-lod${lod}.glb`,
    byteSize: 3,
    sha256: crypto.createHash("sha256").update("abc").digest("hex"),
    contentType: "model/gltf-binary",
    author: "Owner-reviewed creature artist",
    license: "CC-BY-4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    sourceUrl: "https://example.org/official-creature-source",
    provenanceSha256: LICENSE_REPORT_SHA256
  }))
});

function createMemoryCaches() {
  const stores = new Map();
  const keyOf = (input) => typeof input === "string" ? input : input.url;
  return {
    stores,
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      return {
        async match(input) { const value = entries.get(keyOf(input)); return value?.clone() || undefined; },
        async put(input, response) { entries.set(keyOf(input), response.clone()); },
        async delete(input) { return entries.delete(keyOf(input)); },
        async keys() { return [...entries.keys()].map((url) => ({ url })); }
      };
    }
  };
}

class MemoryFileHandle {
  constructor(name) { this.kind = "file"; this.name = name; this.bytes = new Uint8Array(); }
  async getFile() { return new Blob([this.bytes]); }
  async createWritable({ keepExistingData = false } = {}) {
    const handle = this;
    let staging = keepExistingData ? this.bytes.slice() : new Uint8Array();
    let cursor = 0;
    let finished = false;
    const grow = (size) => {
      if (staging.byteLength >= size) return;
      const next = new Uint8Array(size);
      next.set(staging);
      staging = next;
    };
    return {
      async seek(position) { cursor = position; },
      async truncate(size) { staging = staging.slice(0, size); grow(size); cursor = Math.min(cursor, size); },
      async write(value) {
        const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value instanceof Uint8Array ? value : new Uint8Array(value);
        grow(cursor + bytes.byteLength);
        staging.set(bytes, cursor);
        cursor += bytes.byteLength;
      },
      async close() { if (!finished) { finished = true; handle.bytes = staging.slice(); } },
      async abort() { finished = true; }
    };
  }
}

class MemoryDirectory {
  constructor(name = "") { this.kind = "directory"; this.name = name; this.entries = new Map(); }
  async getDirectoryHandle(name, { create = false } = {}) {
    let entry = this.entries.get(name);
    if (!entry && create) { entry = new MemoryDirectory(name); this.entries.set(name, entry); }
    if (!entry || entry.kind !== "directory") throw Object.assign(new Error("Not found"), { name: "NotFoundError" });
    return entry;
  }
  async getFileHandle(name, { create = false } = {}) {
    let entry = this.entries.get(name);
    if (!entry && create) { entry = new MemoryFileHandle(name); this.entries.set(name, entry); }
    if (!entry || entry.kind !== "file") throw Object.assign(new Error("Not found"), { name: "NotFoundError" });
    return entry;
  }
  async removeEntry(name, { recursive = false } = {}) {
    const entry = this.entries.get(name);
    if (!entry) throw Object.assign(new Error("Not found"), { name: "NotFoundError" });
    if (entry.kind === "directory" && entry.entries.size && !recursive) throw new Error("Directory is not empty");
    this.entries.delete(name);
  }
  async *values() { yield* this.entries.values(); }
}

function runtimeBase(overrides = {}) {
  return {
    location: { href: "https://hoang8.com/#/game", origin: "https://hoang8.com" },
    crypto: crypto.webcrypto,
    Response,
    Blob,
    URL,
    AbortController,
    DOMException,
    ...overrides
  };
}

test("Personal Cinematic Pack exposes the six truthful owner-only pack families", () => {
  assert.equal(packs.PACK_CATALOG.length, 6);
  assert.deepEqual(packs.PACK_CATALOG.map((pack) => pack.id), [
    "creature-ultra", "forest-vegetation", "terrain-rock", "ocean", "weather-atmosphere", "cinematic-audio"
  ]);
  assert.equal(new Set(packs.PACK_CATALOG.map((pack) => pack.id)).size, 6);
  assert.equal(packs.formatBytes(1024 ** 3), "1.00 GiB");
});

test("cinematic manifests are immutable, bounded, checksummed and origin-allowlisted", () => {
  const valid = packs.validateManifest(makeManifest(), { baseUrl: "https://hoang8.com/#/game" });
  assert.equal(valid.valid, true, valid.errors.join("\n"));
  assert.equal(valid.manifest.totalBytes, 12);

  const hostile = makeManifest();
  hostile.immutable = false;
  hostile.assets[0].path = "../secrets.glb";
  hostile.assets[0].url = "https://evil.example/ripped.glb#token";
  hostile.assets[0].sha256 = "unknown";
  hostile.totalBytes = 999;
  const rejected = packs.validateManifest(hostile, { baseUrl: "https://hoang8.com/#/game" });
  assert.equal(rejected.valid, false);
  assert.ok(rejected.errors.some((message) => message.includes("bất biến")));
  assert.ok(rejected.errors.some((message) => message.includes("không an toàn")));
  assert.ok(rejected.errors.some((message) => message.includes("allowlist")));
  assert.ok(rejected.errors.some((message) => message.includes("SHA-256")));
  assert.ok(rejected.errors.some((message) => message.includes("Tổng số byte")));

  const active = makeManifest();
  active.assets[0].contentType = "text/html";
  active.licenseReportUrl = "https://owner:secret@hoang8.com/licenses#token";
  const activeRejected = packs.validateManifest(active, { baseUrl: "https://hoang8.com/#/game" });
  assert.equal(activeRejected.valid, false);
  assert.ok(activeRejected.errors.some((message) => message.includes("Content-Type")));
  assert.ok(activeRejected.errors.some((message) => message.includes("giấy phép")));

  const unverifiedReport = makeManifest();
  unverifiedReport.licenseReportUrl = "https://example.invalid/unverified-license-report";
  unverifiedReport.licenseReportSha256 = "unknown";
  delete unverifiedReport.assets[0].author;
  delete unverifiedReport.assets[0].license;
  delete unverifiedReport.assets[0].licenseUrl;
  delete unverifiedReport.assets[0].sourceUrl;
  unverifiedReport.assets[0].provenanceSha256 = "0".repeat(64);
  const provenanceRejected = packs.validateManifest(unverifiedReport, { baseUrl: "https://hoang8.com/#/game" });
  assert.equal(provenanceRejected.valid, false);
  assert.ok(provenanceRejected.errors.some((message) => message.includes("allowlist")));
  assert.ok(provenanceRejected.errors.some((message) => message.includes("SHA-256 bất biến")));
  assert.ok(provenanceRejected.errors.some((message) => message.includes("metadata provenance")));
  assert.ok(provenanceRejected.errors.some((message) => message.includes("liên kết đúng SHA-256")));

  const fakeReference = makeManifest();
  delete fakeReference.assets[0].author;
  delete fakeReference.assets[0].license;
  delete fakeReference.assets[0].licenseUrl;
  delete fakeReference.assets[0].sourceUrl;
  fakeReference.assets[0].assetManifestId = "invented-production-record";
  assert.equal(packs.validateManifest(fakeReference, { baseUrl: "https://hoang8.com/#/game" }).valid, false);
  assert.equal(packs.validateManifest(fakeReference, { baseUrl: "https://hoang8.com/#/game", approvedAssetManifestIds: ["invented-production-record"] }).valid, false, "a bare approved ID must never approve substitute bytes");

  const boundReference = makeManifest();
  boundReference.assets[0].assetManifestId = "reviewed-production-record";
  const record = Object.fromEntries(["sha256", "byteSize", "author", "sourceUrl", "license", "licenseUrl"].map((key) => [key, boundReference.assets[0][key]]));
  assert.equal(packs.validateManifest(boundReference, { baseUrl: "https://hoang8.com/#/game", approvedAssetRecords: { "reviewed-production-record": record } }).valid, true);
  record.sha256 = "0".repeat(64);
  assert.equal(packs.validateManifest(boundReference, { baseUrl: "https://hoang8.com/#/game", approvedAssetRecords: { "reviewed-production-record": record } }).valid, true, "complete inline provenance remains valid even if an optional record is stale");

  const trustedCdn = makeManifest();
  trustedCdn.assets[0].url = "https://cdn.example/eonwild/hash.glb";
  assert.equal(packs.validateManifest(trustedCdn, { baseUrl: "https://hoang8.com/#/game", trustedOrigins: ["https://cdn.example/some/path"] }).valid, true);
  assert.equal(packs.validateManifest(trustedCdn, { baseUrl: "https://hoang8.com/#/game" }).valid, false);
  assert.deepEqual(packs.parseContentRange("bytes 2-9/10"), { start: 2, end: 9, total: 10 });
  assert.equal(packs.parseContentRange("bytes 2-10/10"), null);
});

test("manifest paths cannot collide with metadata or parent directories and Creature Ultra requires one unique four-LOD role set", () => {
  const reserved = makeManifest();
  reserved.assets[0].path = "pack-state.json/hidden.glb";
  const reservedResult = packs.validateManifest(reserved, { baseUrl: "https://hoang8.com/#/game" });
  assert.equal(reservedResult.valid, false);
  assert.ok(reservedResult.errors.some((message) => message.includes("metadata dành riêng")));

  const prefixCollision = makeManifest();
  prefixCollision.assets[0].path = "models";
  prefixCollision.assets[1].path = "models/lod1.glb";
  const prefixResult = packs.validateManifest(prefixCollision, { baseUrl: "https://hoang8.com/#/game" });
  assert.equal(prefixResult.valid, false);
  assert.ok(prefixResult.errors.some((message) => message.includes("xung đột file/thư mục")));

  const duplicateRole = makeManifest();
  duplicateRole.assets[1].role = duplicateRole.assets[0].role;
  const duplicateResult = packs.validateManifest(duplicateRole, { baseUrl: "https://hoang8.com/#/game" });
  assert.equal(duplicateResult.valid, false);
  assert.ok(duplicateResult.errors.some((message) => message.includes("Vai trò runtime bị trùng")));
  assert.ok(duplicateResult.errors.some((message) => message.includes("đúng bốn role LOD0-LOD3")));

  const incomplete = makeManifest();
  incomplete.assets.pop();
  incomplete.totalBytes = 9;
  const incompleteResult = packs.validateManifest(incomplete, { baseUrl: "https://hoang8.com/#/game" });
  assert.equal(incompleteResult.valid, false);
  assert.ok(incompleteResult.errors.some((message) => message.includes("đúng bốn role LOD0-LOD3")));

  const wrongFamily = makeManifest();
  wrongFamily.assets[0].role = "vegetation:tyrannosaurus";
  const wrongFamilyResult = packs.validateManifest(wrongFamily, { baseUrl: "https://hoang8.com/#/game" });
  assert.equal(wrongFamilyResult.valid, false);
  assert.ok(wrongFamilyResult.errors.some((message) => message.includes("Creature Ultra GLB cần role")));
});

test("incremental worker SHA-256 matches Node across arbitrary chunk boundaries", () => {
  const bytes = crypto.randomBytes(1024 * 1024 + 37);
  const hasher = new worker.Sha256();
  for (let offset = 0; offset < bytes.length; offset += 8191) hasher.update(bytes.subarray(offset, Math.min(bytes.length, offset + 8191)));
  assert.equal(hasher.hex(), crypto.createHash("sha256").update(bytes).digest("hex"));
  assert.equal(new worker.Sha256().hex(), crypto.createHash("sha256").update("").digest("hex"));
  assert.equal(worker.MAX_CHUNK_BYTES, 8 * 1024 * 1024);
  assert.equal(worker.MAX_JOB_BYTES, packs.MAX_PACK_BYTES);
});

test("hash sessions terminate on worker error, messageerror, timeout and AbortSignal instead of hanging", async (context) => {
  const makeWorker = (dispatch) => class FakeWorker {
    constructor() { this.listeners = new Map(); this.terminated = false; }
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(listener);
    }
    removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
    postMessage(message) { dispatch(this, message); }
    terminate() { this.terminated = true; }
    emit(type, event = {}) { for (const listener of this.listeners.get(type) || []) listener(event); }
  };

  await context.test("error", async () => {
    let instance;
    const Worker = makeWorker((workerInstance) => { instance = workerInstance; queueMicrotask(() => workerInstance.emit("error", { message: "worker script missing", preventDefault() {} })); });
    const session = packs.createHashSession({ runtime: runtimeBase(), Worker, workerTimeoutMs: 100 });
    await assert.rejects(session.start(), /worker script missing/);
    assert.equal(instance.terminated, true);
  });

  await context.test("messageerror", async () => {
    let instance;
    const Worker = makeWorker((workerInstance) => { instance = workerInstance; queueMicrotask(() => workerInstance.emit("messageerror")); });
    const session = packs.createHashSession({ runtime: runtimeBase(), Worker, workerTimeoutMs: 100 });
    await assert.rejects(session.start(), /HASH_WORKER_MESSAGE_ERROR/);
    assert.equal(instance.terminated, true);
  });

  await context.test("timeout", async () => {
    let instance;
    const Worker = makeWorker((workerInstance) => { instance = workerInstance; });
    const session = packs.createHashSession({ runtime: runtimeBase(), Worker, workerTimeoutMs: 50 });
    await assert.rejects(session.start(), /HASH_WORKER_TIMEOUT:start/);
    assert.equal(instance.terminated, true);
  });

  await context.test("abort", async () => {
    let instance;
    const controller = new AbortController();
    const Worker = makeWorker((workerInstance) => { instance = workerInstance; });
    const session = packs.createHashSession({ runtime: runtimeBase(), Worker, signal: controller.signal, workerTimeoutMs: 100 });
    const starting = session.start();
    controller.abort();
    await assert.rejects(starting, (error) => error?.name === "AbortError");
    assert.equal(instance.terminated, true);
  });
});

test("large pack runtime uses OPFS, byte ranges, pause, integrity verification and Cache fallback", () => {
  for (const contract of [
    /navigator\?\.storage/, /getDirectory/, /createWritable/, /Range:\s*`bytes=\$\{offset\}-`/,
    /controller\.abort\(\)/, /CHECKSUM_MISMATCH/, /PACK_INTEGRITY_FAILED/, /environment\.caches\.open/,
    /CACHE_FALLBACK_MAX_BYTES/, /redirect:\s*"error"/, /CONTENT_RANGE_MISMATCH/, /revokeObjectURL/
  ]) assert.match(source, contract);
  const manager = packs.createManager({});
  for (const method of ["initialize", "list", "install", "installFromFiles", "pause", "verify", "verifyAll", "remove", "removeAll", "assetUrl", "getManifest", "releaseAssetUrl", "storageEstimate", "requestPersistence", "dispose"]) {
    assert.equal(typeof manager[method], "function", `missing ${method}`);
  }
  manager.dispose();
});

test("Cache fallback installs exact bytes, reports real progress, verifies and deletes cleanly", async () => {
  const caches = createMemoryCaches();
  let fetchCount = 0;
  const runtime = runtimeBase({
    caches,
    navigator: { storage: { estimate: async () => ({ usage: 3, quota: 1024 }), persisted: async () => true, persist: async () => true } },
    fetch: async (url) => { if (String(url).includes("/licenses/")) return licenseReportResponse(); fetchCount += 1; return new Response("abc", { status: 200, headers: { "content-type": "model/gltf-binary" } }); }
  });
  const manager = packs.createManager({ runtime, baseUrl: runtime.location.href });
  const progress = [];
  const state = await manager.install(makeManifest(), { onProgress: (event) => progress.push(event) });
  assert.equal(state.status, "ready");
  assert.equal(state.storage, "cache");
  assert.equal(fetchCount, 4);
  assert.ok(progress.some((event) => event.phase === "download" && event.loadedBytes === 3));
  assert.ok(progress.some((event) => event.phase === "verify" && event.loadedBytes === 3));
  assert.equal((await manager.getManifest("creature-ultra")).assets[0].role, "creature:tyrannosaurus:lod0");
  assert.equal((await manager.verify("creature-ultra")).status, "ready");
  assert.equal((await manager.verifyAll())[0].ok, true);
  const url = await manager.assetUrl("creature-ultra", "tyrannosaurus/lod0.glb");
  assert.match(url, /^blob:/);
  assert.equal(manager.releaseAssetUrl(url), true);
  const cache = await caches.open(packs.CACHE_NAME);
  const assetRequest = (await cache.keys()).find((request) => request.url.endsWith("/tyrannosaurus/lod0.glb"));
  await cache.put(assetRequest, new Response("abd", { headers: { "content-type": "model/gltf-binary" } }));
  manager.dispose();
  const coldManager = packs.createManager({ runtime, baseUrl: runtime.location.href });
  await coldManager.initialize();
  assert.equal(await coldManager.assetUrl("creature-ultra", "tyrannosaurus/lod0.glb"), null, "a new generation must re-check persisted bytes before Babylon can consume them");
  assert.equal(coldManager.list().find((pack) => pack.id === "creature-ultra").status, "failed");
  assert.equal(await coldManager.requestPersistence(), true);
  assert.deepEqual(await coldManager.storageEstimate(), { usage: 3, quota: 1024, persisted: true, opfs: false, cacheFallbackLimit: packs.CACHE_FALLBACK_MAX_BYTES });
  assert.equal(await coldManager.remove("creature-ultra"), true);
  assert.equal(coldManager.list().find((pack) => pack.id === "creature-ultra").status, "not-installed");
  assert.equal((await (await caches.open(packs.CACHE_NAME)).keys()).length, 0);
  coldManager.dispose();
});

test("Cache fallback resumes completed assets and rejects bad checksum or oversized packs", async () => {
  const caches = createMemoryCaches();
  let fetchCount = 0;
  const runtime = runtimeBase({
    caches,
    navigator: { storage: {} },
    fetch: async (url) => { if (String(url).includes("/licenses/")) return licenseReportResponse(); fetchCount += 1; return new Response("abc", { status: 200 }); }
  });
  const installer = packs.createManager({ runtime, baseUrl: runtime.location.href });
  await installer.install(makeManifest());
  installer.dispose();
  const manager = packs.createManager({ runtime, baseUrl: runtime.location.href });
  await manager.initialize();
  await manager.install(makeManifest());
  assert.equal(fetchCount, 4, "verified Cache entries should resume without another fetch");

  const badRuntime = runtimeBase({ caches: createMemoryCaches(), navigator: { storage: {} }, fetch: async (url) => String(url).includes("/licenses/") ? licenseReportResponse() : new Response("abd", { status: 200 }) });
  const badManager = packs.createManager({ runtime: badRuntime, baseUrl: badRuntime.location.href });
  await assert.rejects(badManager.install(makeManifest()), /CHECKSUM_MISMATCH/);
  assert.equal(badManager.list().find((pack) => pack.id === "creature-ultra").status, "failed");

  const oversized = makeManifest();
  oversized.assets[0].byteSize = packs.CACHE_FALLBACK_MAX_BYTES + 1;
  oversized.totalBytes = oversized.assets.reduce((sum, asset) => sum + asset.byteSize, 0);
  await assert.rejects(badManager.install(oversized), /OPFS_REQUIRED_FOR_LARGE_PACK/);
  manager.dispose();
  badManager.dispose();
});

test("license report bytes are fetched, bounded and SHA-256 verified before any asset is installed", async () => {
  let assetFetches = 0;
  const runtime = runtimeBase({
    caches: createMemoryCaches(),
    navigator: { storage: {} },
    fetch: async (url) => {
      if (String(url).includes("/licenses/")) return new Response("tampered-license-report", { status: 200, headers: { "content-type": "text/plain" } });
      assetFetches += 1;
      return new Response("abc", { status: 200 });
    }
  });
  const manager = packs.createManager({ runtime, baseUrl: runtime.location.href });
  await assert.rejects(manager.install(makeManifest()), /LICENSE_REPORT_CHECKSUM_MISMATCH/);
  assert.equal(assetFetches, 0, "unlicensed bytes must be rejected before the GLB request starts");
  assert.equal(manager.list().find((pack) => pack.id === "creature-ultra").status, "failed");
  manager.dispose();
});

test("invalid manifests immediately move a known pack to failed, including corrupted persisted metadata", async () => {
  let fetches = 0;
  const caches = createMemoryCaches();
  const runtime = runtimeBase({
    caches,
    navigator: { storage: {} },
    fetch: async (url) => { fetches += 1; return String(url).includes("/licenses/") ? licenseReportResponse() : new Response("abc", { status: 200 }); }
  });
  const manager = packs.createManager({ runtime, baseUrl: runtime.location.href });
  const incomplete = makeManifest();
  incomplete.assets.pop();
  incomplete.totalBytes = 9;
  await assert.rejects(manager.install(incomplete), (error) => error?.code === "INVALID_MANIFEST");
  assert.equal(fetches, 0, "an invalid manifest must fail before network or storage ingestion");
  assert.equal(manager.list().find((pack) => pack.id === "creature-ultra").status, "failed");

  await manager.install(makeManifest());
  const cache = await caches.open(packs.CACHE_NAME);
  const manifestRequest = (await cache.keys()).find((request) => request.url.endsWith("/pack-manifest.json"));
  const corrupted = makeManifest();
  corrupted.assets[1].role = corrupted.assets[0].role;
  await cache.put(manifestRequest, new Response(JSON.stringify(corrupted), { headers: { "content-type": "application/json" } }));
  assert.equal(await manager.getManifest("creature-ultra"), null);
  assert.equal(manager.list().find((pack) => pack.id === "creature-ultra").status, "failed");
  manager.dispose();
});

test("concurrent assetUrl reads queue and reuse one verified immutable Blob per generation", async () => {
  const caches = createMemoryCaches();
  let digestCalls = 0;
  let shouldBlock = false;
  let enteredResolve;
  let releaseResolve;
  const entered = new Promise((resolve) => { enteredResolve = resolve; });
  const release = new Promise((resolve) => { releaseResolve = resolve; });
  const subtle = {
    async digest(...args) {
      digestCalls += 1;
      if (shouldBlock) { enteredResolve(); await release; }
      return crypto.webcrypto.subtle.digest(...args);
    }
  };
  let created = 0;
  let revoked = 0;
  const createdBlobs = [];
  class TrackingURL extends URL {}
  TrackingURL.createObjectURL = (blob) => { createdBlobs.push(blob); created += 1; return `blob:tracked-${created}`; };
  TrackingURL.revokeObjectURL = () => { revoked += 1; };
  const runtime = runtimeBase({
    URL: TrackingURL,
    crypto: { subtle },
    caches,
    navigator: { storage: {} },
    fetch: async (url) => String(url).includes("/licenses/") ? licenseReportResponse() : new Response("abc", { status: 200 })
  });
  const installer = packs.createManager({ runtime, baseUrl: runtime.location.href });
  await installer.install(makeManifest());
  installer.dispose();
  const manager = packs.createManager({ runtime, baseUrl: runtime.location.href });
  await manager.initialize();
  assert.ok(await manager.getManifest("creature-ultra"));
  const digestBaseline = digestCalls;
  shouldBlock = true;
  const first = manager.assetUrl("creature-ultra", "tyrannosaurus/lod0.glb");
  await entered;
  const second = manager.assetUrl("creature-ultra", "tyrannosaurus/lod0.glb");
  releaseResolve();
  const [firstUrl, secondUrl] = await Promise.all([first, second]);
  assert.equal(firstUrl, secondUrl, "queued readers should share the generation-scoped object URL");
  assert.equal(digestCalls - digestBaseline, 1, "the same generation must hash the asset only once");
  assert.equal(created, 1);
  assert.equal(manager.releaseAssetUrl(firstUrl), true);
  assert.equal(revoked, 0, "one reader still owns the shared URL");
  assert.equal(manager.releaseAssetUrl(secondUrl), true);
  assert.equal(revoked, 1);

  shouldBlock = false;
  const reopened = await manager.assetUrl("creature-ultra", "tyrannosaurus/lod0.glb");
  assert.equal(digestCalls - digestBaseline, 1, "reopening must reuse the already verified Blob without rehashing storage");
  assert.equal(createdBlobs[1], createdBlobs[0]);
  manager.releaseAssetUrl(reopened);
  manager.dispose();
});

test("remove serializes against verify and assetUrl without resurrecting metadata or Blob URLs", async () => {
  const caches = createMemoryCaches();
  let blockDigest = false;
  let enteredResolve = null;
  let releaseResolve = null;
  let entered = new Promise((resolve) => { enteredResolve = resolve; });
  let release = new Promise((resolve) => { releaseResolve = resolve; });
  const subtle = {
    async digest(...args) {
      if (blockDigest) { enteredResolve(); await release; }
      return crypto.webcrypto.subtle.digest(...args);
    }
  };
  const runtime = runtimeBase({
    crypto: { subtle },
    caches,
    navigator: { storage: {} },
    fetch: async (url) => String(url).includes("/licenses/") ? licenseReportResponse() : new Response("abc", { status: 200 })
  });
  const manager = packs.createManager({ runtime, baseUrl: runtime.location.href });
  await manager.install(makeManifest());

  blockDigest = true;
  const verifying = manager.verify("creature-ultra");
  await entered;
  const removing = manager.remove("creature-ultra");
  releaseResolve();
  await assert.rejects(verifying, /Paused|Abort/);
  assert.equal(await removing, true);
  assert.equal(manager.list().find((pack) => pack.id === "creature-ultra").status, "not-installed");
  assert.equal((await (await caches.open(packs.CACHE_NAME)).keys()).length, 0);

  blockDigest = false;
  await manager.install(makeManifest());
  manager.dispose();
  const readerManager = packs.createManager({ runtime, baseUrl: runtime.location.href });
  await readerManager.initialize();
  entered = new Promise((resolve) => { enteredResolve = resolve; });
  release = new Promise((resolve) => { releaseResolve = resolve; });
  blockDigest = true;
  const opening = readerManager.assetUrl("creature-ultra", "tyrannosaurus/lod0.glb");
  await entered;
  const removingAgain = readerManager.remove("creature-ultra");
  releaseResolve();
  assert.equal(await opening, null);
  assert.equal(await removingAgain, true);
  assert.equal(readerManager.list().find((pack) => pack.id === "creature-ultra").status, "not-installed");
  readerManager.dispose();
});

test("OPFS deletion errors are surfaced and cannot silently resurrect a removed pack", async () => {
  const fileSystemRoot = new MemoryDirectory("origin");
  const runtime = runtimeBase({
    navigator: { storage: { getDirectory: async () => fileSystemRoot } },
    fetch: async (url) => String(url).includes("/licenses/") ? licenseReportResponse() : new Response("abc", { status: 200 })
  });
  const manager = packs.createManager({ runtime, baseUrl: runtime.location.href });
  await manager.install(makeManifest());
  const cinematicRoot = await fileSystemRoot.getDirectoryHandle(packs.ROOT_DIRECTORY);
  const originalRemove = cinematicRoot.removeEntry.bind(cinematicRoot);
  cinematicRoot.removeEntry = async () => { throw Object.assign(new Error("denied"), { name: "NotAllowedError" }); };
  await assert.rejects(manager.remove("creature-ultra"), /denied/);
  assert.equal(manager.list().find((pack) => pack.id === "creature-ultra").status, "ready");
  cinematicRoot.removeEntry = originalRemove;
  assert.equal(await manager.remove("creature-ultra"), true);
  manager.dispose();

  const gatedRoot = new MemoryDirectory("origin");
  let denyRoot = false;
  const gatedRuntime = runtimeBase({
    navigator: { storage: { getDirectory: async () => {
      if (denyRoot) throw Object.assign(new Error("root access denied"), { name: "NotAllowedError" });
      return gatedRoot;
    } } },
    fetch: async (url) => String(url).includes("/licenses/") ? licenseReportResponse() : new Response("abc", { status: 200 })
  });
  const gatedManager = packs.createManager({ runtime: gatedRuntime, baseUrl: gatedRuntime.location.href });
  await gatedManager.install(makeManifest());
  denyRoot = true;
  await assert.rejects(gatedManager.remove("creature-ultra"), /root access denied/);
  assert.equal(gatedManager.list().find((pack) => pack.id === "creature-ultra").status, "ready");
  denyRoot = false;
  assert.equal(await gatedManager.remove("creature-ultra"), true);
  gatedManager.dispose();
});

test("storageEstimate reports OPFS capability without requiring or creating the pack directory", async () => {
  const fileSystemRoot = new MemoryDirectory("origin");
  const runtime = runtimeBase({
    navigator: { storage: {
      getDirectory: async () => fileSystemRoot,
      estimate: async () => ({ usage: 7, quota: 99 }),
      persisted: async () => false
    } }
  });
  const manager = packs.createManager({ runtime, baseUrl: runtime.location.href });
  assert.deepEqual(await manager.storageEstimate(), { usage: 7, quota: 99, persisted: false, opfs: true, cacheFallbackLimit: packs.CACHE_FALLBACK_MAX_BYTES });
  assert.equal(fileSystemRoot.entries.has(packs.ROOT_DIRECTORY), false, "a capability probe must not create application storage");
  manager.dispose();

  const deniedRuntime = runtimeBase({ navigator: { storage: { getDirectory: async () => { throw new Error("denied"); } } } });
  const deniedManager = packs.createManager({ runtime: deniedRuntime, baseUrl: deniedRuntime.location.href });
  assert.equal((await deniedManager.storageEstimate()).opfs, false);
  deniedManager.dispose();
});

test("OPFS pause commits a partial file and resume uses an exact validated byte range", async () => {
  const fileSystemRoot = new MemoryDirectory("origin");
  const requests = [];
  let manager;
  const runtime = runtimeBase({
    navigator: { storage: { getDirectory: async () => fileSystemRoot } },
    fetch: async (url, options) => {
      if (String(url).includes("/licenses/")) return licenseReportResponse();
      if (!String(url).includes("lod0")) return new Response("abc", { status: 200 });
      const range = options.headers.Range || "";
      requests.push(range);
      if (!range) return new Response("ab", { status: 200 });
      return new Response("c", { status: 206, headers: { "content-range": "bytes 2-2/3" } });
    }
  });
  manager = packs.createManager({ runtime, baseUrl: runtime.location.href });
  const paused = await manager.install(makeManifest(), { onProgress(event) { if (event.loadedBytes === 2) manager.pause("creature-ultra"); } });
  assert.equal(paused.status, "paused");
  assert.equal(paused.loadedBytes, 2);
  const resumed = await manager.install(makeManifest());
  assert.equal(resumed.status, "ready");
  assert.deepEqual(requests, ["", "bytes=2-"]);
  assert.equal((await manager.verify("creature-ultra")).status, "ready");
  manager.dispose();
});

test("OPFS refuses a mismatched resume range instead of combining untrusted bytes", async () => {
  const fileSystemRoot = new MemoryDirectory("origin");
  let phase = 0;
  let manager;
  const runtime = runtimeBase({
    navigator: { storage: { getDirectory: async () => fileSystemRoot } },
    fetch: async (url, options) => {
      if (String(url).includes("/licenses/")) return licenseReportResponse();
      if (!String(url).includes("lod0")) return new Response("abc", { status: 200 });
      phase += 1;
      if (phase === 1) return new Response("ab", { status: 200 });
      assert.equal(options.headers.Range, "bytes=2-");
      return new Response("bc", { status: 206, headers: { "content-range": "bytes 1-2/3" } });
    }
  });
  manager = packs.createManager({ runtime, baseUrl: runtime.location.href });
  await manager.install(makeManifest(), { onProgress(event) { if (event.loadedBytes === 2) manager.pause("creature-ultra"); } });
  await assert.rejects(manager.install(makeManifest()), /CONTENT_RANGE_MISMATCH/);
  assert.equal(manager.list().find((pack) => pack.id === "creature-ultra").status, "failed");
  manager.dispose();
});

test("route-lazy integration loads the pack runtime before the game and preserves its separate cache", () => {
  const loaderIndex = html.indexOf('<script src="performance-loader.js?v=559"');
  assert.ok(loaderIndex > 0);
  assert.equal(html.includes('<script src="hh-eonwild-cinematic-pack.js?v=1" defer></script>'), false, "the base shell must not eagerly load the owner-only pack runtime");
  const cinematicIndex = fs.readFileSync(path.join(root, "performance-loader.js"), "utf8").indexOf('"hh-eonwild-cinematic-pack.js?v=1"');
  const gameIndex = fs.readFileSync(path.join(root, "performance-loader.js"), "utf8").indexOf('"hh-eonwild-game.js?v=30"');
  assert.ok(cinematicIndex > 0 && cinematicIndex < gameIndex);
  assert.equal((serviceWorker.match(/"\.\/hh-eonwild-cinematic-pack\.js\?v=1"/g) || []).length, 1);
  assert.equal((serviceWorker.match(/"\.\/hh-eonwild-cinematic-pack-worker\.js\?v=1"/g) || []).length, 1);
  assert.match(serviceWorker, /key !== CACHE && key !== EONWILD_CINEMATIC_CACHE/);
  assert.match(require(path.join(root, "package.json")).scripts["test:eonwild"], /hh-eonwild-cinematic-pack\.test\.js/);
  for (const contract of ["OPFS", "Range: bytes=N-", "Content-Range", "verifyAll()", "removeAll()", "Dùng model thay thế", "localStorage"]) assert.match(pipelineDocs, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
