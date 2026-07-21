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

test("exposes the versioned UMD API and truthful storage limits", async () => {
  assert.equal(media.SCHEMA, "hh.universal-media.v1");
  assert.equal(media.FORMAT, "hhmedia-package");
  assert.equal(media.VERSION, 1);
  assert.deepEqual(media.STORE_NAMES, ["projects", "assets", "snapshots"]);
  assert.equal(globalThis.HHUniversalMediaProject, media);
  assert.match(source, /globalScope\.HHUniversalMediaProject = api/);
  assert.match(source, /indexedDB\.open\(dbName, DB_VERSION\)/);
  assert.ok(media.LIMITS.MAX_PACKAGE_TEXT_BYTES <= 12 * 1024 * 1024);
  assert.ok(media.LIMITS.MAX_INLINE_ASSET_BYTES < media.LIMITS.MAX_PACKAGE_TEXT_BYTES);

  const store = media.createStore({ indexedDB: null });
  assert.deepEqual(await store.ready(), { backend: "memory", schema: media.SCHEMA });
  await store.close();
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
    media.normalizeAsset({ id: "c", projectId: "p", name: "Inter.woff2", type: "font/woff2", metadata: { fontFamily: "Inter" }, availability: "offline", createdAt: "2026-05-01T10:00:00.000Z", lastOpenedAt: "2026-05-01T10:00:00.000Z" })
  ];
  assert.deepEqual(media.searchAssets(assets, "neon", { folderId: "social", tag: "campaign" }).map((asset) => asset.id), ["a"]);
  assert.deepEqual(media.applySmartCollection(assets, "favorites", { nowMs: current }).map((asset) => asset.id), ["a"]);
  assert.deepEqual(media.applySmartCollection(assets, "recent", { nowMs: current }).map((asset) => asset.id), ["a"]);
  assert.deepEqual(media.applySmartCollection(assets, "large-video").map((asset) => asset.id), ["b"]);
  assert.deepEqual(media.applySmartCollection(assets, "offline").map((asset) => asset.id), ["c"]);
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
  const oversized = "x".repeat(media.LIMITS.MAX_PACKAGE_TEXT_BYTES + 1);
  await assert.rejects(() => store.importPackage(oversized), /vượt giới hạn an toàn/);
});

test("UI contract is Vietnamese, semantic, responsive and never persists large URLs in localStorage", () => {
  for (const token of [
    "Universal Media Project", "Media Bin", "Bộ sưu tập thông minh", "Chụp phiên bản", "Đóng gói .hhmedia",
    "data-ump-drop", "data-ump-search", "data-ump-favorite", "data-ump-replace", "data-ump-restore",
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
