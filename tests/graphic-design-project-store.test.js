const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const file = path.join(root, "graphic-design-project-store.js");
const source = fs.readFileSync(file, "utf8");
const projectStore = require(file);

test("Project Store exposes IndexedDB-ready global API and memory fallback", async () => {
  assert.equal(projectStore.VERSION, 1);
  assert.equal(projectStore.FORMAT, "hhdesign-package");
  assert.deepEqual(projectStore.STORE_NAMES, ["projects", "assets", "snapshots", "sessions"]);
  assert.match(source, /globalScope\.HHGraphicProjectStore = api/);
  assert.match(source, /indexedDb\.open\(name, DB_VERSION\)/);
  assert.match(source, /createObjectStore\(store, \{ keyPath: "id" \}\)/);
  const store = projectStore.createStore({ indexedDB: null });
  assert.deepEqual(await store.ready(), { backend: "memory" });
  await store.close();
});

test("Memory backend supports real project CRUD without sharing mutable references", async () => {
  const store = projectStore.createStore({ indexedDB: null });
  const saved = await store.saveProject({ name: "Chiến dịch HH", data: { layers: [{ id: 1 }] } });
  saved.data.layers[0].id = 99;
  assert.equal((await store.getProject(saved.id)).data.layers[0].id, 1);
  await store.saveProject({ ...saved, name: "Chiến dịch mới", data: { layers: [{ id: 2 }] } });
  assert.equal((await store.listProjects()).length, 1);
  assert.equal((await store.getProject(saved.id)).name, "Chiến dịch mới");
  await store.deleteProject(saved.id);
  assert.equal(await store.getProject(saved.id), undefined);
});

test("Asset Manager classifies supported creative files and reports actionable warnings", async () => {
  assert.equal(projectStore.assetKind("image/png", "cover.png"), "image");
  assert.equal(projectStore.assetKind("video/mp4", "clip.mp4"), "video");
  assert.equal(projectStore.assetKind("font/woff2", "brand.woff2"), "font");
  assert.equal(projectStore.assetKind("image/svg+xml", "icon.svg"), "svg");
  assert.equal(projectStore.assetKind("", "motion.lottie"), "lottie");
  assert.equal(projectStore.assetKind("model/gltf-binary", "scene.glb"), "3d");
  const store = projectStore.createStore({ indexedDB: null });
  const project = await store.saveProject({ name: "Assets", assetIds: ["missing-id"] });
  const blob = new Blob(["svg"], { type: "image/svg+xml" });
  const asset = await store.saveAsset({ projectId: project.id, name: "logo.svg", blob });
  const warnings = await store.validateAssets(project.id, 2);
  assert.ok(warnings.some((item) => item.code === "missing"));
  assert.ok(warnings.some((item) => item.code === "oversize" && item.assetId === asset.id));
  assert.equal((await store.listAssets(project.id))[0].blob.size, 3);
  await store.removeAsset(asset.id);
  assert.equal((await store.listAssets(project.id)).length, 0);
});

test("Snapshots restore immutable project data and expose path-level diff", async () => {
  const store = projectStore.createStore({ indexedDB: null });
  let project = await store.saveProject({ name: "Snapshot", data: { canvas: { width: 1080 }, title: "A" } });
  const snapshot = await store.createSnapshot(project.id, "Bản đầu");
  project = await store.saveProject({ ...project, data: { canvas: { width: 1920 }, title: "B" } });
  const changes = await store.compareSnapshot(snapshot.id, project.id);
  assert.ok(changes.some((item) => item.path === "$.data.canvas.width" && item.before === 1080 && item.after === 1920));
  assert.ok(changes.some((item) => item.path === "$.data.title"));
  const restored = await store.restoreSnapshot(snapshot.id);
  assert.equal(restored.data.canvas.width, 1080);
  assert.equal((await store.listSnapshots(project.id)).length, 1);
});

test("Branch and review workflow keeps parent information and explicit status", async () => {
  const store = projectStore.createStore({ indexedDB: null });
  const main = await store.saveProject({ name: "Main", branch: "main" });
  const branch = await store.createBranch(main.id, "YouTube launch");
  assert.notEqual(branch.id, main.id);
  assert.equal(branch.branch, "YouTube-launch");
  assert.equal(branch.parentBranch, "main");
  assert.equal(branch.status, "draft");
  assert.equal((await store.requestReview(branch.id)).status, "review");
  assert.equal((await store.setReviewStatus(branch.id, "approved")).status, "approved");
  await assert.rejects(() => store.setReviewStatus(branch.id, "published"), /không hợp lệ/);
});

test("Session autosave can debounce, flush and persist the latest project", async () => {
  const savedEvents = [];
  const store = projectStore.createStore({ indexedDB: null });
  const project = await store.saveProject({ name: "Autosave", data: { value: 1 } });
  const session = store.createAutosaveSession(project.id, { delay: 5000, onSaved: (value) => savedEvents.push(value) });
  session.schedule({ ...project, data: { value: 2 } });
  session.schedule({ ...project, data: { value: 3 } });
  assert.equal(session.pending, true);
  const saved = await session.flush();
  assert.equal(saved.data.value, 3);
  assert.equal(session.pending, false);
  assert.equal(savedEvents.length, 1);
  await session.dispose();
});

test(".hhdesign package round-trips metadata, snapshots and binary assets", async () => {
  const sourceStore = projectStore.createStore({ indexedDB: null });
  let project = await sourceStore.saveProject({ name: "Portable", data: { stage: "ready" } });
  const asset = await sourceStore.saveAsset({ projectId: project.id, name: "scene.glb", type: "model/gltf-binary", blob: new Blob([Uint8Array.from([1, 2, 3, 4])], { type: "model/gltf-binary" }) });
  project = await sourceStore.getProject(project.id);
  await sourceStore.createSnapshot(project.id, "Release candidate");
  const text = await sourceStore.exportPackage(project.id);
  const packageJson = JSON.parse(text);
  assert.equal(packageJson.format, projectStore.FORMAT);
  assert.match(packageJson.assets[0].dataUrl, /^data:model\/gltf-binary;base64,/);

  const targetStore = projectStore.createStore({ indexedDB: null });
  const imported = await targetStore.importPackage(text);
  assert.notEqual(imported.project.id, project.id);
  assert.equal(imported.importedAssets, 1);
  const importedAssets = await targetStore.listAssets(imported.project.id);
  assert.equal(importedAssets[0].name, asset.name);
  assert.deepEqual([...new Uint8Array(await importedAssets[0].blob.arrayBuffer())], [1, 2, 3, 4]);
  assert.equal((await targetStore.listSnapshots(imported.project.id)).length, 1);
});

test("UI is Vietnamese, responsive, accessible and does not fake cloud collaboration", () => {
  for (const token of [
    "Project & Version System", "Dự án mới", "Tạo snapshot", "Tạo nhánh", "Gửi duyệt", "Asset Manager",
    "data-hps-drop", "data-hps-import-file", "data-hps-asset-file", "dataTransfer.files", "role=\"status\"",
    "aria-live=\"polite\"", "@media(max-width:680px)", "prefers-reduced-motion:reduce", ".hhdesign"
  ]) assert.ok(source.includes(token), `missing ${token}`);
  assert.doesNotMatch(source, /WebSocket|Socket\.io|fetch\s*\(|XMLHttpRequest|sendBeacon/);
  assert.match(source, /type: "indexeddb"/);
  assert.match(source, /type: "memory"/);
});
