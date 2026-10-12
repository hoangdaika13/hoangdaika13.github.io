"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "platform-tools.js"), "utf8");
function runtime() {
  let user = { id: "owner-a" };
  const listeners = new Map(), cancelled = [], storage = {};
  Object.defineProperties(storage, {
    getItem: { value: key => Object.hasOwn(storage, key) ? storage[key] : null },
    setItem: { value: (key, value) => { storage[key] = String(value); } },
    removeItem: { value: key => { delete storage[key]; } }
  });
  const documentElement = { dataset: {}, style: { values: {}, setProperty(key, value) { this.values[key] = value; }, getPropertyValue(key) { return this.values[key] || ""; }, removeProperty(key) { delete this.values[key]; }, fontSize: "", colorScheme: "" } };
  const document = { hidden: false, documentElement, querySelector: selector => selector.startsWith("link[") ? {} : null, querySelectorAll: () => [], addEventListener: (type, listener) => listeners.set(type, listener), removeEventListener: type => listeners.delete(type), head: { append() {} } };
  const context = { document, localStorage: storage, navigator: { onLine: true }, crypto: require("node:crypto").webcrypto, structuredClone, Blob, URL, CSS: { escape: value => value },
    location: { hash: "#/platform", href: "http://localhost/", origin: "http://localhost" },
    CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
    addEventListener: (type, listener) => listeners.set(type, listener), dispatchEvent() {}, setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {},
    requestAnimationFrame: () => 2, cancelAnimationFrame: id => cancelled.push(id), performance: { now: () => 1000 }, devicePixelRatio: 3,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), HHAuthz: { currentUser: () => user }
  };
  context.window = context;
  vm.runInNewContext(source.replace("window.HHPlatformTools = {", "window.__test = { state, values, dbAll, dbPut, dbClear, readSettings, saveSetting, record, accountOwner, safeKey, localPrefix, normalizeImport, validRoute, canonicalCombo, normalizeCombo, applyColorMode, cleanupRuntime, setupLongTasks, handleAction, buildExport, globalShortcut }; window.HHPlatformTools = {"), context);
  const api = context.__test;
  api.state.owner = api.accountOwner();
  return { api, context, storage, listeners, cancelled, setUser: next => { user = next; api.state.owner = api.accountOwner(); } };
}
const plain = value => JSON.parse(JSON.stringify(value));
function root(fields = []) {
  const nodes = new Map();
  return { isConnected: true, dataset: {}, querySelectorAll: () => fields, querySelector: selector => { if (!nodes.has(selector)) nodes.set(selector, { textContent: "", dataset: {}, disabled: false, value: 0 }); return nodes.get(selector); }, closest: () => null };
}
const payload = data => ({ format: "HH Platform Tools Export", version: 1, data });

test("checked radio is used rather than the last option; checkboxes stay boolean", () => {
  const { api } = runtime();
  api.state.root = root([{ name: "mode", type: "radio", value: "light", checked: true }, { name: "mode", type: "radio", value: "schedule", checked: false }, { name: "autosave", type: "checkbox", checked: false }]);
  assert.deepEqual(plain(api.values()), { mode: "light", autosave: false });
});

test("all tool storage, counts, clear and history are isolated across owner and guest", async () => {
  const { api, setUser } = runtime();
  await api.dbPut("favorites", { id: "a", title: "Only A" });
  setUser({ id: "owner-b" }); assert.equal((await api.dbAll("favorites")).length, 0);
  await api.dbPut("favorites", { id: "b", title: "Only B" });
  setUser(null); assert.equal((await api.dbAll("favorites")).length, 0);
  await api.dbClear("favorites");
  setUser({ id: "owner-a" }); assert.equal((await api.dbAll("favorites"))[0].title, "Only A");
  setUser({ id: "owner-b" }); assert.equal((await api.dbAll("favorites"))[0].title, "Only B");
});

test("history opt-out is real and history is capped at 500 records", async () => {
  const { api } = runtime(); api.state.active = "Favorite Manager";
  await api.saveSetting("historyEnabled", false); await api.record("favorite.add"); assert.equal((await api.dbAll("history")).length, 0);
  await api.saveSetting("historyEnabled", true);
  for (let index = 0; index < 503; index++) await api.dbPut("history", { id: String(index), createdAt: index, tool: "favorite-manager" });
  await api.record("favorite.add"); assert.equal((await api.dbAll("history")).length, 500);
});

test("theme preview is independent and time-based color resolver is honest", () => {
  const { api, context } = runtime(); const preview = { dataset: {}, style: {} };
  assert.equal(api.applyColorMode({ mode: "light" }, preview), "light");
  assert.equal(preview.dataset.colorMode, "light"); assert.equal(context.document.documentElement.dataset.colorMode, undefined);
  assert.throws(() => api.applyColorMode({ mode: "pretend" }, preview), /không hợp lệ/);
});

test("unsafe/external favorite routes are rejected; old home canonicalizes to platform", () => {
  const { api } = runtime();
  assert.equal(api.validRoute("#/home"), "/platform"); assert.equal(api.validRoute("/tools/platform/theme-switcher"), "/tools/platform/theme-switcher");
  ["javascript:alert(1)", "https://example.com/", "//evil.com", "/../api", "/tools/\"x"].forEach(route => assert.throws(() => api.validRoute(route), /đường dẫn nội bộ/));
});

test("import checks every row before replace, refuses cross-workspace data and drops arbitrary history detail", () => {
  const { api } = runtime();
  assert.throws(() => api.normalizeImport(null), /Schema/);
  assert.throws(() => api.normalizeImport(payload({ favorites: [{ id: "bad\"onclick", title: "Bad", route: "/platform", createdAt: 1 }] })), /ID/);
  assert.throws(() => api.normalizeImport(payload({ favorites: [{ id: "ok", title: "Bad", route: "https://evil.com", createdAt: 1 }] })), /đường dẫn/);
  assert.throws(() => api.normalizeImport(payload({ settings: [{ id: "setting:fontScale", value: 9000 }] })), /Cài đặt/);
  assert.throws(() => api.normalizeImport(payload({ settings: [{ id: "setting:colorMode", value: "system" }, { id: "setting:colorMode", value: "dark" }] })), /trùng/);
  assert.throws(() => api.normalizeImport(payload({ local: { "hh-focus-room:another-user": "private" } })), /không thuộc kho/);
  const valid = api.normalizeImport(payload({ history: [{ id: "h", tool: "global-search", name: "Ignore untrusted name", action: "search", createdAt: 1, detail: { token: "hidden" } }] }));
  assert.equal(valid.data.history[0].name, "Global Search"); assert.deepEqual(plain(valid.data.history[0].detail), {});
});

test("export is scoped, excludes other workspace/accounts and neutralizes CSV formulas", async () => {
  const { api, storage } = runtime();
  storage.setItem("hh-auth-user", JSON.stringify({ id: "owner-a" })); storage.setItem("hh-focus-room:owner-a", "private"); storage.setItem("hh.all-tools.v1:account%3Aowner-b:draft:query", "other");
  const own = `${api.localPrefix()}draft:global-search`; storage.setItem(own, "[]");
  assert.equal(api.safeKey(own), true); assert.equal(api.safeKey("hh-auth-user"), false); assert.equal(api.safeKey("hh-focus-room:owner-a"), false);
  const scopes = Array.from({ length: 5 }, (_, value) => ({ name: "scope", value: String(value), checked: true }));
  api.state.root = root([{ name: "format", value: "json", type: "select-one" }, ...scopes]);
  await api.buildExport(); const exported = JSON.parse(api.state.generatedExport);
  assert.deepEqual(Object.keys(exported.data.local), [own]);
  await api.dbPut("history", { id: "test", name: "=SUM(1,2)", action: "@FORMULA", createdAt: 1 });
  api.state.root = root([{ name: "format", value: "csv", type: "select-one" }, ...scopes]); await api.buildExport();
  assert.match(api.state.generatedExport, /"'=SUM\(1,2\)"/); assert.match(api.state.generatedExport, /"'@FORMULA"/);
});

test("shortcuts normalize modifier order and Space and do not steal text/browser editing", () => {
  const { api, context } = runtime();
  assert.equal(api.canonicalCombo("shift + ctrl + h"), "Ctrl+Shift+H"); assert.equal(api.canonicalCombo("alt+space"), "Alt+Space");
  assert.equal(api.normalizeCombo({ ctrlKey: false, altKey: true, key: " " }), "Alt+Space");
  assert.throws(() => api.canonicalCombo("Ctrl+R"), /trình duyệt/);
  assert.throws(() => api.canonicalCombo("Ctrl+Ctrl+H"), /không hợp lệ/);
  let prevented = false; api.state.root = root(); api.state.shortcutCache = [{ combo: "Ctrl+K", action: "home" }];
  api.globalShortcut({ key: "k", ctrlKey: true, target: { closest: () => ({}) }, preventDefault() { prevented = true; } }); assert.equal(prevented, false);
  api.globalShortcut({ key: "k", ctrlKey: true, target: { closest: () => null }, preventDefault() { prevented = true; } }); assert.equal(prevented, true); assert.equal(context.location.hash, "#/platform");
});

test("All Tools settings do not mutate the primary shell", async () => {
  const { api, context } = runtime(); api.state.active = "Settings Center";
  api.state.root = root([{ name: "density", type: "select-one", value: "compact" }, { name: "reducedMotion", type: "checkbox", checked: true }, { name: "autosave", type: "checkbox", checked: true }, { name: "historyEnabled", type: "checkbox", checked: false }]);
  await api.handleAction("settings-apply");
  assert.equal(api.state.root.dataset.density, "compact"); assert.equal(api.state.root.dataset.reducedMotion, "true");
  assert.equal(context.document.documentElement.dataset.density, undefined); assert.equal(context.document.documentElement.dataset.reducedMotion, undefined);
  assert.equal((await api.readSettings()).historyEnabled, false);
});

test("FPS observer is unique and cleanup disconnects it, frames and draft references", () => {
  const { api, context, cancelled } = runtime(); let observed = 0, disconnected = 0;
  context.PerformanceObserver = class { static supportedEntryTypes = ["longtask"]; observe() { observed++; } disconnect() { disconnected++; } };
  api.setupLongTasks(); api.setupLongTasks(); assert.equal(observed, 1);
  api.state.fpsFrame = 99; api.state.progressFrame = 98; api.cleanupRuntime();
  assert.equal(disconnected, 1); assert.ok(cancelled.includes(99)); assert.ok(cancelled.includes(98)); assert.equal(api.state.root, null); assert.equal(api.state.owner, "");
});

test("stale account operations cannot write to the next account", async () => {
  const { api, context } = runtime(); api.state.owner = "account:owner-a";
  context.HHAuthz.currentUser = () => ({ id: "owner-b" });
  await assert.rejects(api.dbPut("favorites", { id: "leak" }), /Tài khoản đã thay đổi/);
});

test("an account switch between awaited reads and writes cannot attribute old history to new owner", async () => {
  const { api, setUser } = runtime(); api.state.active = "Global Search";
  const pending = api.record("search", { label: "Old account" });
  setUser({ id: "owner-b" });
  await assert.rejects(pending, /Tài khoản đã thay đổi/);
  assert.equal((await api.dbAll("history")).length, 0);
});
