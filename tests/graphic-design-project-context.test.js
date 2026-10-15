const test = require("node:test");
const assert = require("node:assert/strict");
const contextApi = require("../graphic-design-project-context.js");
const storeApi = require("../graphic-design-project-store.js");
const fs = require("node:fs"), vm = require("node:vm"), path = require("node:path");

function storage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key), values };
}

test("Explicit per-project adapters isolate two documents of the same engine and reload", () => {
  const raw = storage();
  const a = contextApi.resolve({ storage: raw, accountId: "member-a", projectId: "poster-a" });
  const b = contextApi.resolve({ storage: raw, accountId: "member-a", projectId: "poster-b" });
  const key = "hh.graphic-vector.project.v1";
  a.engineStorage.setItem(key, JSON.stringify({ title: "A", color: "#ff00ff" }));
  b.engineStorage.setItem(key, JSON.stringify({ title: "B", color: "#00ffff" }));
  assert.equal(JSON.parse(contextApi.resolve({ storage: raw, accountId: "member-a", projectId: "poster-a" }).engineStorage.getItem(key)).title, "A");
  assert.equal(JSON.parse(b.engineStorage.getItem(key)).title, "B");
  assert.equal(raw.getItem(key), null, "No mutation or silent adoption of old global key");
  a.engineStorage.removeItem(key);
  assert.equal(a.engineStorage.getItem(key), null);
  assert.equal(JSON.parse(b.engineStorage.getItem(key)).title, "B");
});

test("Account selection and draft reads never import legacy or another account", () => {
  const raw = storage();
  raw.setItem("hh.graphic-design.hub.v2", JSON.stringify({ projects: [{ id: "legacy" }] }));
  assert.equal(contextApi.select("private-project", { storage: raw, accountId: "alice" }).ok, true);
  const alice = contextApi.resolve({ storage: raw, accountId: "alice" });
  const bob = contextApi.resolve({ storage: raw, accountId: "bob" });
  const guest = contextApi.resolve({ storage: raw, user: null });
  assert.equal(alice.projectId, "private-project");
  assert.equal(bob.projectId, "workspace");
  assert.equal(guest.projectId, "workspace");
  alice.engineStorage.setItem("hh.engine.v1", "alice-only");
  assert.equal(bob.engineStorage.getItem("hh.engine.v1"), null);
  assert.equal(guest.engineStorage.getItem("hh.engine.v1"), null);
  assert.equal(raw.getItem(bob.accountKey("hh.graphic-design.hub.v2")), null);
  assert.equal(JSON.parse(raw.getItem("hh.graphic-design.hub.v2")).projects[0].id, "legacy");
});

test("Keys are unambiguous and explicit unavailable storage fails closed", () => {
  const raw = storage();
  const one = contextApi.resolve({ storage: raw, accountId: "a:project:b", projectId: "c" });
  const two = contextApi.resolve({ storage: raw, accountId: "a", projectId: "b:project:c" });
  assert.notEqual(one.storageKey("hh.base.v1"), two.storageKey("hh.base.v1"));
  const denied = contextApi.resolve({ storage: null, accountId: "a", projectId: "p" });
  assert.equal(denied.storage, null);
  assert.equal(denied.engineStorage, null);
  assert.equal(contextApi.select("p", { storage: null, accountId: "a" }).ok, false);
  const blocked = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("quota"); } };
  assert.equal(contextApi.resolve({ storage: blocked }).projectId, "workspace");
  assert.equal(contextApi.select("p", { storage: blocked }).ok, false);
});

test("Wrapping an already scoped engine adapter does not duplicate its previous namespace", () => {
  const raw = storage();
  const previous = contextApi.resolve({ storage: raw, accountId: "a", projectId: "one" });
  const next = contextApi.resolve({ storage: previous.engineStorage, accountId: "a", projectId: "two" });
  next.engineStorage.setItem("hh.engine.v1", "two");
  assert.equal(raw.getItem(next.storageKey("hh.engine.v1")), "two");
  assert.equal(previous.engineStorage.getItem("hh.engine.v1"), null);
});

test("Vault isolates projects, blobs and snapshots on a shared backend without claiming unowned records", async () => {
  const backend = storeApi.createMemoryBackend();
  await backend.put("projects", { id: "unowned", name: "Old device record" });
  const alice = storeApi.createStore({ backend, accountId: "alice" });
  const bob = storeApi.createStore({ backend, accountId: "bob" });
  const a = await alice.saveProject({ id: "same-id", name: "Alice" });
  await alice.saveAsset({ id: "same-asset", projectId: a.id, name: "private.txt", blob: new Blob(["private"]) });
  const snapshot = await alice.createSnapshot(a.id, "Alice snapshot");
  assert.equal(await bob.getProject(a.id), undefined);
  assert.deepEqual(await bob.listProjects(), []);
  assert.deepEqual(await bob.listAssets(), []);
  await assert.rejects(() => bob.restoreSnapshot(snapshot.id), /Không tìm thấy/);
  await bob.saveProject({ id: "same-id", name: "Bob" });
  await bob.deleteProject("same-id");
  assert.equal((await alice.getProject("same-id")).name, "Alice");
  assert.equal(await (await alice.listAssets("same-id"))[0].blob.text(), "private");
  assert.equal((await backend.get("projects", "unowned")).name, "Old device record");
});

test("Failed autosave keeps pending changes and retry actually saves before success callback", async () => {
  const backend = storeApi.createMemoryBackend();
  let fail = false;
  const observed = [];
  const store = storeApi.createStore({ backend: { ...backend, async put(name, value) { if (fail) throw new Error("quota"); return backend.put(name, value); } } });
  const project = await store.saveProject({ name: "Draft", data: { text: "original" } });
  const session = store.createAutosaveSession(project.id, { delay: 60000, onSaved: (saved) => observed.push(saved.data.text), onError: (error) => observed.push(error.message) });
  session.schedule({ ...project, data: { text: "latest edit" } });
  fail = true;
  await assert.rejects(() => session.flush(), /quota/);
  assert.equal(session.pending, true);
  assert.equal((await store.getProject(project.id)).data.text, "original");
  assert.deepEqual(observed, ["quota"]);
  fail = false;
  assert.equal((await session.flush()).data.text, "latest edit");
  assert.equal(session.pending, false);
  assert.deepEqual(observed, ["quota", "latest edit"]);
  await session.dispose();
});

test("Portable Vault import and branch remap document and asset references without modifying user text", async () => {
  const source = storeApi.createStore({ indexedDB: null, accountId: "source-account" });
  const project = await source.saveProject({ id: "poster", name: "Poster", data: { designDocument: { id: "poster", title: "asset-original", layers: [{ assetId: "asset-original" }], assetIds: ["asset-original"] } } });
  await source.saveAsset({ id: "asset-original", projectId: project.id, name: "photo.png", blob: new Blob(["original pixels"], { type: "image/png" }) });
  const snapshot = await source.createSnapshot(project.id, "With photo");
  const target = storeApi.createStore({ indexedDB: null, accountId: "target-account" });
  const imported = await target.importPackage(await source.exportPackage(project.id));
  const [asset] = await target.listAssets(imported.project.id);
  assert.notEqual(asset.id, "asset-original");
  assert.equal(imported.project.data.designDocument.id, imported.project.id);
  assert.equal(imported.project.data.designDocument.layers[0].assetId, asset.id);
  assert.equal(imported.project.data.designDocument.assetIds[0], asset.id);
  assert.equal(imported.project.data.designDocument.title, "asset-original", "Do not rewrite normal text matching an asset id");
  assert.equal(await asset.blob.text(), "original pixels");
  const [importedSnapshot] = await target.listSnapshots(imported.project.id);
  assert.notEqual(importedSnapshot.id, snapshot.id);
  assert.equal((await target.restoreSnapshot(importedSnapshot.id)).data.designDocument.layers[0].assetId, asset.id);
  const branch = await target.createBranch(imported.project.id, "alt");
  const [branchAsset] = await target.listAssets(branch.id);
  assert.notEqual(branchAsset.id, asset.id);
  assert.equal(branch.data.designDocument.id, branch.id);
  assert.equal(branch.data.designDocument.layers[0].assetId, branchAsset.id);
  assert.equal(await branchAsset.blob.text(), "original pixels");
});

function studioHarness() {
  const raw = storage(), listeners = new Map(), writes = [], readers = [];
  const originalSet = raw.setItem;
  raw.setItem = (key, value) => { writes.push([key, value]); originalSet(key, value); };
  const list = { innerHTML: "" };
  const root = {
    dataset: {}, style: { setProperty() {} }, className: "", innerHTML: "",
    querySelector(selector) { return selector === "[data-gd-project-list]" ? list : null; },
    querySelectorAll() { return []; }, replaceChildren() { this.innerHTML = ""; },
    addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback); },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
    dispatch(type, target) { for (const callback of [...listeners.get(type) || []]) callback({ target }); }
  };
  const scope = { localStorage: raw, HHGraphicProjectContext: contextApi, location: { hash: "#/graphic-design" }, setTimeout: () => 1, clearTimeout() {}, URL: { revokeObjectURL() {} },
    FileReader: class { constructor() { readers.push(this); } readAsText() {} }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../graphic-design-studio.js"), "utf8"), scope);
  return { raw, writes, root, listeners, scope, readers };
}

test("Reusing one actual studio host removes old account handlers before favorite/create actions", () => {
  const { raw, writes, root, listeners, scope } = studioHarness();
  const a = contextApi.resolve({ storage: raw, accountId: "a" }), b = contextApi.resolve({ storage: raw, accountId: "b" });
  const state = (name) => ({ version: 2, projects: [{ id: "same-project", name, type: "quick-motion", favorite: false }], activity: [] });
  raw.setItem(a.accountKey("hh.graphic-design.hub.v2"), JSON.stringify(state("A private")));
  raw.setItem(b.accountKey("hh.graphic-design.hub.v2"), JSON.stringify(state("B private")));
  scope.HHGraphicDesign.mount(root, { storage: raw, accountId: "a", view: "overview" });
  scope.HHGraphicDesign.mount(root, { storage: raw, accountId: "b", view: "overview" });
  assert.equal(listeners.get("click").size, 1);
  assert.equal(listeners.get("input").size, 1);
  assert.equal(listeners.get("change").size, 1);
  writes.length = 0;
  const favorite = { dataset: { gdFavorite: "same-project" } };
  root.dispatch("click", { closest: (selector) => selector === "[data-gd-favorite]" ? favorite : null });
  assert.equal(writes.length, 1, "Exactly one live handler writes for B");
  assert.equal(writes[0][0], b.accountKey("hh.graphic-design.hub.v2"));
  assert.equal(JSON.parse(writes[0][1]).projects[0].name, "B private");
  assert.equal(JSON.parse(raw.getItem(a.accountKey("hh.graphic-design.hub.v2"))).projects[0].favorite, false);
  const action = { dataset: { gdAction: "new-project" } };
  root.dispatch("click", { closest: (selector) => selector === "[data-gd-action]" ? action : null });
  assert.equal(JSON.parse(raw.getItem(b.accountKey("hh.graphic-design.hub.v2"))).projects.length, 2, "One click creates only one project");
  assert.equal(JSON.parse(raw.getItem(a.accountKey("hh.graphic-design.hub.v2"))).projects.length, 1);
  scope.HHGraphicDesign.unmount();
  assert.equal([...listeners.values()].reduce((total, items) => total + items.size, 0), 0);
});

test("A pending import callback from unmounted account cannot write or remount a reused host", () => {
  const { raw, writes, root, scope, readers } = studioHarness();
  scope.HHGraphicDesign.mount(root, { storage: raw, accountId: "a", view: "overview" });
  root.dispatch("change", { matches: (selector) => selector === "[data-gd-import]", files: [{}] });
  assert.equal(readers.length, 1);
  scope.HHGraphicDesign.mount(root, { storage: raw, accountId: "b", view: "overview" });
  writes.length = 0;
  readers[0].result = JSON.stringify({ version: 2, projects: [{ id: "old-private", name: "A-only content" }] });
  readers[0].onload();
  assert.deepEqual(writes, [], "Late callback is invalidated, not reassigned to B");
  scope.HHGraphicDesign.unmount();
});
