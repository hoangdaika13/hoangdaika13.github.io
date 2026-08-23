const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const modulePath = path.join(root, "universal-media-project.js");
const cssPath = path.join(root, "universal-media-project.css");
const source = fs.readFileSync(modulePath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const media = require(modulePath);
const makeFile = (content, name, options = {}) => {
  if (typeof File === "function") return new File([content], name, options);
  const blob = new Blob([content], { type: options.type });
  Object.defineProperties(blob, { name: { value: name }, lastModified: { value: options.lastModified || 0 } });
  return blob;
};

test("exposes the versioned UMD API and truthful storage limits", async () => {
  assert.equal(media.SCHEMA, "hh.universal-media.v1");
  assert.equal(media.FORMAT, "hhmedia-package");
  assert.equal(media.VERSION, 1);
  assert.equal(media.RECORD_VERSION, 2);
  assert.deepEqual(media.STORE_NAMES, ["projects", "assets", "snapshots"]);
  assert.equal(globalThis.HHUniversalMediaProject, media);
  assert.match(source, /globalScope\.HHUniversalMediaProject = api/);
  assert.match(source, /indexedDB\.open\(dbName, DB_VERSION\)/);
  assert.ok(media.LIMITS.MAX_PACKAGE_TEXT_BYTES <= 12 * 1024 * 1024);
  assert.ok(media.LIMITS.MAX_INLINE_ASSET_BYTES < media.LIMITS.MAX_PACKAGE_TEXT_BYTES);

  const store = media.createStore({ indexedDB: null });
  assert.deepEqual(await store.ready(), { backend: "memory", schema: media.SCHEMA });
  const status = await store.storageStatus();
  assert.equal(status.backend, "memory");
  assert.equal(status.persistent, false);
  assert.equal(status.fallbackReason, "indexeddb-unavailable");
  assert.equal(status.quota.pressure, "unknown");
  assert.deepEqual(status.opfs, { available: false, used: false, reason: "Trình duyệt không cung cấp OPFS." });
  await store.close();
});

test("storage capability audit reports quota, persistence and OPFS without claiming OPFS usage", async () => {
  const status = await media.inspectStorageCapabilities({ navigator: { storage: {
    estimate: async () => ({ usage: 90, quota: 100 }), persisted: async () => true, getDirectory() {}
  } } });
  assert.deepEqual(status.quota, { supported: true, usage: 90, quota: 100, remaining: 10, ratio: .9, pressure: "warning" });
  assert.deepEqual(status.persistence, { supported: true, granted: true });
  assert.equal(status.opfs.available, true);
  assert.equal(status.opfs.used, false);
  assert.match(status.opfs.reason, /hiện lưu binary trong IndexedDB/);
  assert.deepEqual(media.classifyStorageError(Object.assign(new Error("full"), { name: "QuotaExceededError" })).code, "quota-exceeded");
});

test("migrates legacy records and normalizes rights without unsafe URLs", () => {
  const project = media.migrateProjectRecord({ id: "legacy-project", version: 1, name: "Legacy", assets: ["ignored"], assetIds: ["a", "a"] });
  const asset = media.migrateAssetRecord({
    id: "a", projectId: project.id, name: "licensed.svg", type: "image/svg+xml", license: "CC BY 4.0",
    sourceUrl: "javascript:alert(1)", metadata: { GPS: { latitude: 10 }, camera: "HH" }
  });
  assert.equal(project.recordVersion, media.RECORD_VERSION);
  assert.deepEqual(project.assetIds, ["a"]);
  assert.equal(asset.recordVersion, media.RECORD_VERSION);
  assert.equal(asset.rights.license, "CC BY 4.0");
  assert.equal(asset.rights.sourceUrl, "");
  assert.equal(media.hasSensitiveMetadata(asset.metadata), true);
  assert.deepEqual(media.stripSensitiveMetadata(asset.metadata), { camera: "HH" });
});

test("shared project schema bounds layers, tracks, clips, pages, scenes, effects and presets", () => {
  const project = media.normalizeProject({
    id: "shared", projectKind: "template", lifecycle: "archived",
    workspace: { layers: [{ id: "same", name: "Layer A", assetId: "asset-a" }, { id: "same", name: "Duplicate" }], tracks: [{ id: "t1" }], clips: [{ id: "c1", assetId: "asset-a" }], pages: [{ id: "p1" }], scenes: [{ id: "s1" }], effects: [{ id: "fx1" }], keyframes: [{ id: "k1" }], colorTokens: [{ id: "brand", value: "#fff" }] },
    presets: [{ id: "preset", name: "Social", section: "canvas", payload: { width: 1080, height: 1080 } }],
    ingestJobs: [{ id: "job", name: "hero.png", size: 12, status: "uploading" }]
  });
  assert.equal(project.projectKind, "template");
  assert.equal(project.lifecycle, "archived");
  assert.equal(project.workspace.layers.length, 1);
  for (const key of ["tracks", "clips", "pages", "scenes", "effects", "keyframes", "colorTokens"]) assert.equal(project.workspace[key].length, 1);
  assert.equal(project.presets[0].section, "canvas");
  assert.equal(project.ingestJobs[0].status, "awaiting-file");
});

test("bounded command history executes, undoes and redoes without overlapping mutations", async () => {
  let value = 0;
  const changes = [];
  const history = media.createCommandHistory({ limit: 2, onChange: (state) => changes.push(state) });
  const command = (next) => ({ label: `Set ${next}`, redo: () => { value = next; }, undo: () => { value = next - 1; } });
  await history.execute(command(1));
  await history.execute(command(2));
  await history.execute(command(3));
  assert.equal(value, 3);
  assert.equal(await history.undo(), true);
  assert.equal(value, 2);
  assert.equal(await history.undo(), true);
  assert.equal(value, 1);
  assert.equal(await history.undo(), false);
  assert.equal(await history.redo(), true);
  assert.equal(value, 2);
  assert.ok(changes.some((state) => state.canUndo));
});

test("pending async mount is cancelled cleanly before it can repaint an unmounted route", async () => {
  let resolveReady;
  const ready = new Promise((resolve) => { resolveReady = resolve; });
  const classes = new Set();
  const rootNode = {
    innerHTML: "", ownerDocument: {},
    classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) },
    querySelector() { return null; }
  };
  const store = { ready: () => ready, close: async () => {} };
  const mounting = media.mount(rootNode, { store });
  await new Promise((resolve) => setImmediate(resolve));
  await media.unmount(rootNode);
  resolveReady({ backend: "memory", schema: media.SCHEMA });
  assert.equal(await mounting, null);
  assert.equal(rootNode.innerHTML, "");
  assert.equal(classes.has("hhump"), false);
});

test("classifies every required Media Bin type", () => {
  assert.equal(media.classifyAsset("image/jpeg", "cover.jpg"), "image");
  assert.equal(media.classifyAsset("video/mp4", "intro.mp4"), "video");
  assert.equal(media.classifyAsset("audio/wav", "voice.wav"), "audio");
  assert.equal(media.classifyAsset("font/woff2", "Inter.woff2"), "font");
  assert.equal(media.classifyAsset("", "cinema.cube"), "lut");
  assert.equal(media.classifyAsset("image/svg+xml", "logo.svg"), "svg");
  assert.equal(media.classifyAsset("application/octet-stream", "data.bin"), "other");
});

test("pure search and Smart Collections support folder, tag, favorite, recent and proxy views", () => {
  const current = Date.parse("2026-07-21T10:00:00.000Z");
  const assets = [
    media.normalizeAsset({ id: "a", projectId: "p", folderId: "social", name: "Hero Neon.png", type: "image/png", tags: ["campaign"], favorite: true, lastOpenedAt: "2026-07-20T10:00:00.000Z", blob: new Blob(["a"]) }),
    media.normalizeAsset({ id: "b", projectId: "p", name: "Master.mov", type: "video/quicktime", size: 120 * 1024 * 1024, lastOpenedAt: "2026-06-01T10:00:00.000Z", blob: new Blob(["b"]) }),
    media.normalizeAsset({ id: "c", projectId: "p", name: "Inter.woff2", type: "font/woff2", metadata: { fontFamily: "Inter" }, rights: { license: "Commercial", verified: false }, availability: "offline", createdAt: "2026-05-01T10:00:00.000Z", lastOpenedAt: "2026-05-01T10:00:00.000Z" })
  ];
  assert.deepEqual(media.searchAssets(assets, "neon", { folderId: "social", tag: "campaign" }).map((asset) => asset.id), ["a"]);
  assert.deepEqual(media.applySmartCollection(assets, "favorites", { nowMs: current }).map((asset) => asset.id), ["a"]);
  assert.deepEqual(media.applySmartCollection(assets, "recent", { nowMs: current }).map((asset) => asset.id), ["a"]);
  assert.deepEqual(media.applySmartCollection(assets, "large-video").map((asset) => asset.id), ["b"]);
  assert.deepEqual(media.applySmartCollection(assets, "offline").map((asset) => asset.id), ["c"]);
  assert.deepEqual(media.applySmartCollection(assets, "rights-review").map((asset) => asset.id), ["c"]);
  assert.deepEqual(media.applySmartCollection(assets, "missing-fonts", { availableFonts: [] }).map((asset) => asset.id), ["c"]);
});

test("memory store manages projects, folders and immutable asset records", async () => {
  const store = media.createStore({ indexedDB: null });
  let project = await store.saveProject({ name: "HH Campaign" });
  const folder = await store.createFolder(project.id, { name: "Ảnh social", color: "#f05caf" });
  project = await store.getProject(project.id);
  assert.ok(project.folders.some((item) => item.id === folder.id));
  const asset = await store.saveAsset({ projectId: project.id, folderId: folder.id, name: "post.svg", type: "image/svg+xml", tags: ["social"], blob: new Blob(["<svg/>"]) });
  const returned = await store.getAsset(asset.id);
  returned.tags.push("mutated-outside");
  assert.deepEqual((await store.getAsset(asset.id)).tags, ["social"]);
  await store.deleteFolder(project.id, folder.id);
  assert.equal((await store.getAsset(asset.id)).folderId, media.ROOT_FOLDER_ID);
  await store.close();
});

test("project lifecycle supports duplicate, archive, template, instantiate and personal presets", async () => {
  const store = media.createStore({ indexedDB: null });
  let project = await store.createProject({ name: "Campaign", settings: { fps: 30 }, references: { hero: "asset-hero" }, workspace: { layers: [{ id: "layer-1", assetId: "asset-hero" }] } });
  const asset = await store.saveAsset({ id: "asset-hero", projectId: project.id, name: "hero.svg", type: "image/svg+xml", rights: { license: "CC BY 4.0", verified: true }, blob: new Blob(["<svg></svg>"]) });
  project = await store.getProject(project.id);

  const duplicate = await store.duplicateProject(project.id);
  assert.notEqual(duplicate.id, project.id);
  assert.equal((await store.listAssets(duplicate.id)).length, 1);
  const duplicateAsset = (await store.listAssets(duplicate.id))[0];
  assert.notEqual(duplicateAsset.id, asset.id);
  assert.equal(await duplicateAsset.blob.text(), "<svg></svg>");
  assert.equal(duplicate.references.hero, duplicateAsset.id);

  const template = await store.createTemplateFromProject(project.id, { name: "Clean campaign" });
  assert.equal(template.projectKind, "template");
  assert.deepEqual(template.assetIds, []);
  assert.equal(template.references.hero, null);
  assert.equal(template.workspace.layers[0].assetId, null);
  assert.deepEqual((await store.listTemplates()).map((item) => item.id), [template.id]);
  const fromTemplate = await store.instantiateTemplate(template.id, { name: "Campaign B" });
  assert.equal(fromTemplate.projectKind, "project");
  assert.equal(fromTemplate.templateSourceId, template.id);
  assert.deepEqual(fromTemplate.assetIds, []);

  const preset = await store.saveProjectPreset(project.id, { name: "60 fps", section: "settings", payload: { fps: 60 } });
  const applied = await store.applyProjectPreset(project.id, preset.id);
  assert.equal(applied.settings.fps, 60);
  assert.equal(await store.deleteProjectPreset(project.id, preset.id), true);

  const placement = await store.linkAssetToWorkspace(project.id, asset.id, "layers", { name: "Hero placement", role: "photo" });
  let linkedProject = await store.getProject(project.id);
  assert.equal(linkedProject.workspace.layers.at(-1).assetId, asset.id);
  assert.ok((await store.getAsset(asset.id)).references.includes(placement.id));
  assert.equal(await store.unlinkAssetFromWorkspace(project.id, "layers", placement.id), true);
  linkedProject = await store.getProject(project.id);
  assert.ok(!linkedProject.workspace.layers.some((item) => item.id === placement.id));
  assert.ok(!(await store.getAsset(asset.id)).references.includes(placement.id));

  await store.archiveProject(project.id, true);
  assert.ok(!(await store.listProjects()).some((item) => item.id === project.id));
  assert.ok((await store.listProjects({ includeArchived: true })).some((item) => item.id === project.id && item.lifecycle === "archived"));
  assert.equal((await store.archiveProject(project.id, false)).lifecycle, "active");
});

test("content hashing detects duplicates without pretending files are identical by name", async () => {
  const store = media.createStore({ indexedDB: null });
  const project = await store.saveProject({ name: "Duplicate lab" });
  const first = await store.saveAsset({ projectId: project.id, name: "first.wav", type: "audio/wav", blob: new Blob([Uint8Array.from([1, 2, 3])]) });
  const second = await store.saveAsset({ projectId: project.id, name: "renamed.wav", type: "audio/wav", blob: new Blob([Uint8Array.from([1, 2, 3])]) });
  const third = await store.saveAsset({ projectId: project.id, name: "first.wav", type: "audio/wav", blob: new Blob([Uint8Array.from([9, 8, 7])]) });
  assert.ok(first.checksum);
  assert.equal(second.checksum, first.checksum);
  assert.equal(second.duplicateOf, first.id);
  assert.notEqual(third.checksum, first.checksum);
  assert.equal(third.duplicateOf, null);
});

test("replaceAsset preserves stable identity, references, effects, tags and folder", async () => {
  const store = media.createStore({ indexedDB: null });
  const project = await store.saveProject({ name: "Replace" });
  const original = await store.saveAsset({
    projectId: project.id,
    folderId: "root",
    name: "source.png",
    type: "image/png",
    tags: ["hero"],
    favorite: true,
    references: ["timeline-clip-1", "poster-frame"],
    effects: [{ id: "fx-1", type: "blur", radius: 8 }],
    blob: new Blob(["old"])
  });
  const replaced = await store.replaceAsset(original.id, { name: "source-v2.webp", type: "image/webp", blob: new Blob(["new-binary"]) });
  assert.equal(replaced.id, original.id);
  assert.equal(replaced.projectId, original.projectId);
  assert.equal(replaced.folderId, original.folderId);
  assert.deepEqual(replaced.tags, ["hero"]);
  assert.equal(replaced.favorite, true);
  assert.deepEqual(replaced.references, ["timeline-clip-1", "poster-frame"]);
  assert.deepEqual(replaced.effects, [{ id: "fx-1", type: "blur", radius: 8 }]);
  assert.equal(await replaced.blob.text(), "new-binary");
  assert.equal(replaced.versions.length, 1);
  assert.equal(replaced.versions[0].binaryRetained, true);
  const restored = await store.restoreAssetVersion(replaced.id, replaced.versions[0].id);
  assert.equal(restored.id, original.id);
  assert.equal(restored.name, "source.png");
  assert.equal(await restored.blob.text(), "old");
  assert.ok(restored.versions.some((version) => version.name === "source-v2.webp"));
});

test("relink verifies content identity, preserves stable ID and duplicate links repair after delete", async () => {
  const store = media.createStore({ indexedDB: null });
  const project = await store.saveProject({ name: "Relink lab" });
  const original = await store.saveAsset({ projectId: project.id, name: "voice.wav", type: "audio/wav", blob: new Blob([Uint8Array.from([1, 2, 3])]) });
  const duplicate = await store.saveAsset({ projectId: project.id, name: "voice-copy.wav", type: "audio/wav", blob: new Blob([Uint8Array.from([1, 2, 3])]) });
  await store.updateAsset(original.id, { availability: "offline" });
  await assert.rejects(() => store.relinkAsset(original.id, { name: "wrong.wav", type: "audio/wav", blob: new Blob([Uint8Array.from([9])]) }), /không khớp checksum/);
  const relinked = await store.relinkAsset(original.id, { name: "voice-restored.wav", type: "audio/wav", blob: new Blob([Uint8Array.from([1, 2, 3])]) });
  assert.equal(relinked.id, original.id);
  await store.removeAsset(original.id);
  const repaired = await store.getAsset(duplicate.id);
  assert.equal(repaired.duplicateOf, null);
  assert.equal(repaired.duplicateConfidence, "none");
});

test("asset validation rejects active SVG and labels sampled hashes honestly", async () => {
  await assert.rejects(() => media.inspectAssetBlob(new Blob(['<svg onload="alert(1)"></svg>'], { type: "image/svg+xml" }), { name: "unsafe.svg", type: "image/svg+xml" }), /không an toàn/);
  await assert.rejects(() => media.inspectAssetBlob(new Blob(['<svg><image href="https://tracker.invalid/x.png"/></svg>'], { type: "image/svg+xml" }), { name: "external.svg", type: "image/svg+xml" }), /không an toàn/);
  const safe = await media.inspectAssetBlob(new Blob(["<svg></svg>"], { type: "image/svg+xml" }), { name: "safe.svg", type: "image/svg+xml" });
  assert.equal(safe.status, "verified");
  const large = new Blob([new Uint8Array(media.LIMITS.HASH_FULL_MAX_BYTES + 1)]);
  assert.match(await media.computeContentHash(large, {}), /^sampled-fnv1a-/);
});

test("warning and proxy helpers report missing/offline/font states truthfully", () => {
  const project = media.normalizeProject({ id: "p", assetIds: ["ready", "gone"], requiredFonts: ["Inter", "Missing Sans"] });
  const assets = [media.normalizeAsset({ id: "ready", projectId: "p", name: "film.mp4", type: "video/mp4", size: 150 * 1024 * 1024, blob: new Blob(["video"]) })];
  const warnings = media.assessWarnings(project, assets, { availableFonts: ["Inter"] });
  assert.ok(warnings.some((item) => item.code === "missing-asset" && item.assetId === "gone"));
  assert.ok(warnings.some((item) => item.code === "missing-font" && item.font === "Missing Sans"));

  const plan = media.proxyPlan(assets[0], {});
  assert.equal(plan.recommended, true);
  assert.equal(plan.status, "not-generated");
  assert.equal(plan.productionAdapterRequired, true);
  assert.match(plan.message, /FFmpeg\/WebCodecs/);
  assert.equal(media.metadataCapability(assets[0], {}).deepCodecInspection, false);
});

test("autosave, snapshots and restore preserve versioned metadata", async () => {
  const savedEvents = [];
  const store = media.createStore({ indexedDB: null });
  let project = await store.saveProject({ name: "Version one", settings: { fps: 30 } });
  await store.saveAsset({ projectId: project.id, name: "logo.svg", type: "image/svg+xml", tags: ["v1"], blob: new Blob(["svg"]) });
  const snapshot = await store.createSnapshot(project.id, "Bản duyệt đầu");
  const autosave = store.createAutosave(project.id, { delay: 5000, onSaved: (value) => savedEvents.push(value) });
  autosave.schedule({ ...project, name: "Discard me" });
  autosave.schedule({ ...project, name: "Version two", settings: { fps: 60 } });
  project = await autosave.flush();
  assert.equal(project.name, "Version two");
  assert.equal(savedEvents.length, 1);
  const restored = await store.restoreSnapshot(snapshot.id);
  assert.equal(restored.name, "Version one");
  assert.equal(restored.settings.fps, 30);
  assert.equal((await store.listSnapshots(project.id)).length, 1);
  await autosave.dispose();
});

test("snapshot recovery hides later assets without destroying their relinkable binary", async () => {
  const store = media.createStore({ indexedDB: null });
  const project = await store.saveProject({ name: "Recovery" });
  const first = await store.saveAsset({ projectId: project.id, name: "first.svg", type: "image/svg+xml", blob: new Blob(["<svg></svg>"]) });
  const snapshot = await store.createSnapshot(project.id, "Before second asset");
  const later = await store.saveAsset({ projectId: project.id, name: "later.svg", type: "image/svg+xml", blob: new Blob(["<svg><path/></svg>"]) });
  await store.restoreSnapshot(snapshot.id);
  assert.deepEqual((await store.listAssets(project.id)).map((asset) => asset.id), [first.id]);
  const recovery = await store.recoveryStatus(project.id);
  assert.deepEqual(recovery.orphanAssetIds, [later.id]);
  assert.equal(await (await store.getAsset(later.id)).blob.text(), "<svg><path/></svg>");
});

test("autosave can create bounded real checkpoints without failing a successful save", async () => {
  const store = media.createStore({ indexedDB: null });
  const project = await store.saveProject({ name: "Autosave checkpoints" });
  const checkpoints = [];
  const autosave = store.createAutosave(project.id, { delay: 5000, checkpointEvery: 1, onCheckpoint: (snapshot) => checkpoints.push(snapshot.id) });
  autosave.schedule({ ...project, name: "Autosaved" });
  const saved = await autosave.flush();
  assert.equal(saved.name, "Autosaved");
  assert.equal(checkpoints.length, 1);
  assert.equal((await store.listSnapshots(project.id)).length, 1);
  await autosave.dispose();
});

test("autosave exposes scheduled, saving, saved and quota-error states", async () => {
  const states = [];
  const store = media.createStore({ indexedDB: null });
  const project = await store.createProject({ name: "Observable autosave" });
  const autosave = store.createAutosave(project.id, { delay: 5000, onState: (state) => states.push(state) });
  autosave.schedule({ ...project, name: "Saved" });
  assert.equal(autosave.status.phase, "scheduled");
  await autosave.flush();
  assert.equal(autosave.status.phase, "saved");
  assert.ok(states.some((state) => state.phase === "saving"));
  await autosave.dispose();

  const quotaError = Object.assign(new Error("disk full"), { name: "QuotaExceededError" });
  const failingBackend = media.createMemoryBackend();
  const originalPut = failingBackend.put;
  failingBackend.put = async (table, value) => { if (table === "projects" && value.name === "Fail") throw quotaError; return originalPut(table, value); };
  const failingStore = media.createStore({ backend: failingBackend });
  const seed = await failingStore.createProject({ name: "Seed" });
  const failingAutosave = failingStore.createAutosave(seed.id, { delay: 5000 });
  failingAutosave.schedule({ ...seed, name: "Fail" });
  await assert.rejects(() => failingAutosave.flush(), /disk full/);
  assert.equal(failingAutosave.status.phase, "error");
  assert.equal(failingAutosave.status.error.code, "quota-exceeded");
  assert.equal(failingAutosave.pending, true);
  await failingAutosave.dispose({ flush: false });
});

test("session recovery detects unclean close and resets after a clean finish", async () => {
  const store = media.createStore({ indexedDB: null });
  const project = await store.createProject({ name: "Recovery session" });
  await store.startProjectSession(project.id, "session-a");
  await store.startProjectSession(project.id, "session-b");
  let recovery = await store.recoveryStatus(project.id);
  assert.equal(recovery.uncleanSession, true);
  assert.ok(recovery.sessionStartedAt);
  await store.finishProjectSession(project.id, "session-b");
  recovery = await store.recoveryStatus(project.id);
  assert.equal(recovery.uncleanSession, false);
});

test("ingest checkpoints resume only with the exact local file identity", async () => {
  const store = media.createStore({ indexedDB: null });
  const project = await store.createProject({ name: "Resumable ingest" });
  const file = makeFile("hello", "voice.wav", { type: "audio/wav", lastModified: 123 });
  const job = await store.registerIngestJob(project.id, file);
  assert.equal(job.status, "awaiting-file");
  assert.equal((await store.listIngestJobs(project.id)).length, 1);
  const wrong = makeFile("wrong!", "voice.wav", { type: "audio/wav", lastModified: 123 });
  await assert.rejects(() => store.resumeIngestJob(project.id, job.id, wrong), /không khớp/);
  const asset = await store.resumeIngestJob(project.id, job.id, file);
  assert.equal(asset.provenance.sourceId, job.id);
  assert.equal((await store.listIngestJobs(project.id, { status: "complete" })).length, 1);
  assert.equal(await (await store.getAsset(asset.id)).blob.text(), "hello");
});

test("bounded .hhmedia package round-trips small binary and marks large asset for relink", async () => {
  const sourceStore = media.createStore({ indexedDB: null });
  let project = await sourceStore.saveProject({ name: "Portable project", references: { activeAsset: "small" } });
  const small = await sourceStore.saveAsset({ id: "small", projectId: project.id, name: "logo.svg", type: "image/svg+xml", blob: new Blob(["<svg>HH</svg>"]) });
  const largeBytes = new Uint8Array(media.LIMITS.MAX_INLINE_ASSET_BYTES + 1);
  await sourceStore.saveAsset({ id: "large", projectId: project.id, name: "master.wav", type: "audio/wav", blob: new Blob([largeBytes]) });
  project = await sourceStore.getProject(project.id);
  await sourceStore.createSnapshot(project.id, "Portable snapshot");

  const text = await sourceStore.exportPackage(project.id);
  const payload = JSON.parse(text);
  assert.equal(payload.format, media.FORMAT);
  assert.equal(payload.schema, media.SCHEMA);
  assert.equal(payload.assets.find((asset) => asset.id === small.id).binary.encoding, "base64");
  assert.equal(payload.assets.find((asset) => asset.id === "large").binary, null);
  assert.ok(payload.warnings.some((item) => item.code === "binary-omitted" && item.assetId === "large"));
  assert.ok(payload.assets.every((asset) => (asset.versions || []).every((version) => version.binaryRetained === false && version.blob == null)));
  assert.ok(Buffer.byteLength(text, "utf8") <= media.LIMITS.MAX_PACKAGE_TEXT_BYTES);

  const targetStore = media.createStore({ indexedDB: null });
  const imported = await targetStore.importPackage(text);
  assert.equal(imported.importedAssets, 2);
  assert.equal(imported.relinkRequired, 1);
  const importedAssets = await targetStore.listAssets(imported.project.id);
  const importedSmall = importedAssets.find((asset) => asset.name === "logo.svg");
  const importedLarge = importedAssets.find((asset) => asset.name === "master.wav");
  assert.equal(await importedSmall.blob.text(), "<svg>HH</svg>");
  assert.equal(importedLarge.blob, null);
  assert.equal(importedLarge.availability, "offline");
  assert.equal((await targetStore.listSnapshots(imported.project.id)).length, 1);
});

test("asset manifest is metadata-only, preserves origin lineage and imports as relink-required", async () => {
  const store = media.createStore({ indexedDB: null });
  const project = await store.createProject({ name: "Manifest source" });
  const asset = await store.saveAsset({ projectId: project.id, name: "licensed.svg", type: "image/svg+xml", tags: ["brand"], rights: { author: "HH", license: "CC BY 4.0", verified: true }, blob: new Blob(["<svg></svg>"]) });
  const text = await store.exportAssetManifest(project.id);
  const manifest = JSON.parse(text);
  assert.equal(manifest.format, media.ASSET_MANIFEST_FORMAT);
  assert.equal(manifest.contract.metadataOnly, true);
  assert.equal(manifest.assets[0].blob, undefined);
  assert.equal(manifest.assets[0].availability, "offline");

  const target = await store.createProject({ name: "Manifest target" });
  const imported = await store.importAssetManifest(text, target.id);
  assert.equal(imported.importedAssets, 1);
  assert.equal(imported.relinkRequired, 1);
  const importedAsset = await store.getAsset(imported.assetIds[0]);
  assert.notEqual(importedAsset.id, asset.id);
  assert.equal(importedAsset.originId, asset.originId);
  assert.equal(importedAsset.availability, "offline");
  assert.equal(importedAsset.blob, null);
  assert.equal(importedAsset.rights.license, "CC BY 4.0");
});

test("hash verification fails closed when SHA-256 capability is unavailable", async () => {
  const blob = new Blob(["HH"]);
  const checksum = await media.computeContentHash(blob);
  assert.deepEqual(await media.verifyContentHash(blob, checksum), { verified: true, reason: "match", actual: checksum });
  const unavailable = await media.verifyContentHash(blob, `sha256-${"0".repeat(64)}`, {});
  assert.equal(unavailable.verified, false);
  assert.equal(unavailable.reason, "sha256-unavailable");
  const unsupported = await media.verifyContentHash(blob, "custom-123", {});
  assert.equal(unsupported.reason, "unsupported-checksum");
});

test("package importer rejects malformed, oversized and corrupt binary manifests", async () => {
  const store = media.createStore({ indexedDB: null });
  await assert.rejects(() => store.importPackage("not-json"), /Không đọc được JSON/);
  await assert.rejects(() => store.importPackage(JSON.stringify({ format: "foreign", schema: media.SCHEMA, version: 1 })), /không được hỗ trợ/);
  const invalid = {
    format: media.FORMAT,
    schema: media.SCHEMA,
    version: 1,
    project: { name: "Invalid" },
    assets: [{ id: "bad", name: "bad.bin", binary: { encoding: "base64", bytes: 4, type: "application/octet-stream", data: "not base64!" } }],
    snapshots: []
  };
  await assert.rejects(() => store.importPackage(JSON.stringify(invalid)), /Base64/);
  const corrupt = {
    format: media.FORMAT, schema: media.SCHEMA, version: media.VERSION,
    project: { id: "source", name: "Corrupt" },
    assets: [{ id: "asset-a", name: "a.bin", type: "application/octet-stream", checksum: `sha256-${"0".repeat(64)}`, binary: { encoding: "base64", bytes: 3, type: "application/octet-stream", data: Buffer.from([1, 2, 3]).toString("base64") } }],
    snapshots: []
  };
  await assert.rejects(() => store.importPackage(JSON.stringify(corrupt)), /Checksum binary không khớp/);
  assert.equal((await store.listProjects()).length, 0);
  const oversized = "x".repeat(media.LIMITS.MAX_PACKAGE_TEXT_BYTES + 1);
  await assert.rejects(() => store.importPackage(oversized), /vượt giới hạn an toàn/);
});

test("UI contract is Vietnamese, semantic, responsive and never persists large URLs in localStorage", () => {
  for (const token of [
    "Universal Media Project", "Media Bin", "Bộ sưu tập thông minh", "Chụp phiên bản", "Đóng gói .hhmedia",
    "data-ump-drop", "data-ump-search", "data-ump-favorite", "data-ump-replace", "data-ump-restore",
    "data-ump-project-select", "data-ump-new-project", "data-ump-duplicate-project", "data-ump-archive-project", "data-ump-create-template",
    "data-ump-autosave", "data-ump-ingest-list", "data-ump-export-assets", "data-ump-import-assets",
    "role=\"status\"", "aria-live=\"polite\"", "aria-label=\"Kéo thả hoặc chọn media\"",
    "Binary lưu trong IndexedDB", "Không tạo proxy giả lập"
  ]) assert.ok(source.includes(token), `missing ${token}`);
  assert.doesNotMatch(source, /localStorage\.(?:setItem|getItem)/);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|Socket\.io/);
  assert.match(css, /@media \(max-width: 420px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});
