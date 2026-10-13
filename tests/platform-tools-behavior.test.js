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
  const context = { document, localStorage: storage, navigator: { onLine: true }, crypto: require("node:crypto").webcrypto, structuredClone, Blob, URL, Response, Headers, AbortController, CSS: { escape: value => value },
    location: { hash: "#/platform", href: "http://localhost/", origin: "http://localhost" },
    CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
    addEventListener: (type, listener) => listeners.set(type, listener), removeEventListener: type => listeners.delete(type), dispatchEvent() {}, setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {},
    requestAnimationFrame: () => 2, cancelAnimationFrame: id => cancelled.push(id), performance: { now: () => 1000 }, devicePixelRatio: 3,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), HHAuthz: { currentUser: () => user }
  };
  context.window = context;
  vm.runInNewContext(source.replace("window.HHPlatformTools = {", "window.__test = { state, values, dbAll, dbPut, dbClear, readSettings, saveSetting, record, accountOwner, safeKey, localPrefix, normalizeImport, validRoute, canonicalCombo, normalizeCombo, applyColorMode, cleanupRuntime, setupLongTasks, handleAction, buildExport, globalShortcut, catalogPreferences, updateCatalogPreferences, allHistory, scanWorkspace, runSearch, searchScore, normalizeSearch, skeletonDocument, prepareOffline, readBoundedAsset, offlineAssetUrl, startProgress, applyStoreBatch, commitImport, publishNotificationSignal, inspectPwa, COSMIC_PRESETS, themeConfig, themePresetStore, getThemePresets, saveThemePreset, renameThemePreset, deleteThemePreset, useThemePreset, historyMetadata, filterHistory, historyExport, csvCell, refreshHistoryView }; window.HHPlatformTools = {"), context);
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

test("search indexes every real catalog tool and derives canonical routes even when catalog has no route field", () => {
  const { api, context } = runtime();
  context.HHFeatureLab = { catalog: () => [{ id: "notes", name: "Notes", description: "Ghi chú độc lập", group: "Productivity" }, { id: "ocr", name: "OCR", description: "Nhận dạng ảnh" }] };
  const results = api.scanWorkspace("ghi chu", "route", 50);
  assert.equal(results.length, 1); assert.equal(results[0].route, "/tools/notes");
  assert.equal(api.normalizeSearch("ĐIỀU KHIỂN"), "dieu khien");
  assert.equal(api.searchScore("Notes", "notes"), 3); assert.equal(api.searchScore("Notes Tools", "notes"), 2);
});

test("command palette returns matching executable actions rather than only static quick buttons", async () => {
  const { api } = runtime(); api.state.active = "Command Palette++";
  api.state.root = root([{ name: "query", value: "thiet lap sang", type: "text" }]);
  await api.runSearch(true);
  assert.match(api.state.root.querySelector("[data-pt-results]").innerHTML, /data-pt-action="command-theme"/);
  assert.doesNotMatch(api.state.root.querySelector("[data-pt-results]").innerHTML, /data-pt-action="command-home"/);
});

test("favorite and pinned manager share catalog preferences, filter stale IDs and stay scoped", () => {
  const { api, context, setUser } = runtime(); const data = new Map();
  context.HHFeatureLab = { catalog: () => [{ id: "notes", name: "Notes" }, { id: "json-viewer", name: "JSON Viewer" }] };
  context.HHAllToolState = { readJSON: (base, fallback, owner) => data.get(`${base}:${owner}`) || fallback, writeJSON: (base, value, owner) => data.set(`${base}:${owner}`, value) };
  api.updateCatalogPreferences({ favorites: ["notes"], pinned: ["notes", "not-a-tool"] });
  assert.deepEqual(plain(api.catalogPreferences()), { favorites: ["notes"], pinned: ["notes"], recent: [] });
  setUser({ id: "owner-b" }); assert.deepEqual(plain(api.catalogPreferences()), { favorites: [], pinned: [], recent: [] });
  setUser({ id: "owner-a" }); assert.deepEqual(plain(api.catalogPreferences()).favorites, ["notes"]);
});

test("History Manager combines real action metadata from suites, not note contents", async () => {
  const { api, context } = runtime();
  context.HHFeatureLab = { catalog: () => [{ id: "notes", name: "Notes" }, { id: "global-search", name: "Global Search" }] };
  context.HHAllToolState = { workspaceHistory: async () => [{ id: "note-history", source: "utility", tool: "notes", action: "save", at: "2026-10-12T08:00:00Z", detail: "private note content" }] };
  await api.dbPut("history", { id: "platform-history", tool: "global-search", name: "Global Search", action: "search", createdAt: 1 });
  const rows = plain(await api.allHistory());
  assert.equal(rows.length, 2); assert.equal(rows[0].name, "Notes"); assert.equal(rows[0].source, "utility"); assert.equal(rows[0].detail, undefined);
});

test("skeleton generator produces independent accessible HTML/CSS and clamps untrusted settings", () => {
  const { api } = runtime(); const html = api.skeletonDocument({ pattern: '<script>bad</script>', count: 100 });
  assert.equal((html.match(/<article /g) || []).length, 12); assert.match(html, /aria-busy="true"/);
  assert.match(html, /prefers-reduced-motion/); assert.match(html, /forced-colors/); assert.doesNotMatch(html, /<script>/);
});

test("theme undo snapshot is persistent and export/import strips recursive or unapproved fields", async () => {
  const { api } = runtime();
  await api.saveSetting("themeUndo", { accent: "#123456", fontScale: 100 });
  assert.equal((await api.readSettings()).themeUndo.accent, "#123456");
  const imported = api.normalizeImport(payload({ settings: [{ id: "setting:themeUndo", value: { accent: "#123456", token: "private", themeUndo: { accent: "#ffffff" } } }] }));
  assert.deepEqual(plain(imported.data.settings[0].value), { accent: "#123456" });
  assert.throws(() => api.normalizeImport(payload({ settings: [{ id: "setting:themeUndo", value: { accent: "not-color" } }] })), /Cài đặt/);
});

test("v2 backups explicitly bind current owner and require workspace adapter validation", () => {
  const { api, context } = runtime(); const owner = api.accountOwner();
  assert.throws(() => api.normalizeImport({ ...payload({}), version: 2, owner: "account:owner-b" }), /tài khoản khác/);
  assert.throws(() => api.normalizeImport({ ...payload({ workspace: {} }), version: 2, owner }), /bộ kiểm tra/);
  let checked = 0; context.HHAllToolState = { normalizeWorkspaceBackup(value, currentOwner) { checked++; assert.equal(currentOwner, owner); return { ...value, normalized: true }; } };
  const normalized = api.normalizeImport({ ...payload({ workspace: { version: 1 } }), version: 2, owner });
  assert.equal(normalized.data.workspace.normalized, true); assert.equal(checked, 1);
});

test("workspace backup export is explicitly selected and files are never implicitly included", async () => {
  const { api, context } = runtime(); let included;
  context.HHAllToolState = { exportWorkspaceBackup: async (owner, options) => { included = options.includeFiles; return { format: "HH All Tool Workspace Backup", version: 1, owner, scopes: { utility: { notes: [] } } }; } };
  const scopes = Array.from({ length: 7 }, (_, index) => ({ name: "scope", type: "checkbox", value: String(index), checked: index === 5 }));
  api.state.root = root([{ name: "format", value: "json", type: "select-one" }, ...scopes]); await api.buildExport();
  const exported = JSON.parse(api.state.generatedExport); assert.equal(exported.version, 2); assert.equal(exported.owner, "account:owner-a"); assert.equal(included, false); assert.ok(exported.data.workspace);
  scopes[5].checked = false; scopes[6].checked = true;
  await assert.rejects(api.buildExport(), /phạm vi workspace/);
});

test("multi-store batch merge, skip and replace affect only listed stores", async () => {
  const { api } = runtime(); const owner = api.accountOwner();
  await api.dbPut("favorites", { id: "saved", title: "Before" }); await api.dbPut("notifications", { id: "untouched", title: "Untouched" });
  await api.applyStoreBatch({ favorites: [{ id: "saved", title: "Skipped" }, { id: "new", title: "New" }] }, "skip", owner);
  assert.equal((await api.dbAll("favorites")).find(row => row.id === "saved").title, "Before");
  await api.applyStoreBatch({ favorites: [{ id: "saved", title: "Merged" }] }, "merge", owner);
  assert.equal((await api.dbAll("favorites")).length, 2);
  await api.applyStoreBatch({ favorites: [] }, "replace", owner); assert.equal((await api.dbAll("favorites")).length, 0); assert.equal((await api.dbAll("notifications")).length, 1);
});

test("failed multi-suite import restores Platform stores and local drafts; no false success", async () => {
  const { api, context, storage } = runtime(); const owner = api.accountOwner(), key = `${api.localPrefix()}draft:global-search`;
  await api.dbPut("favorites", { id: "before", title: "Before", route: "/platform", createdAt: 1 }); storage.setItem(key, "[]");
  let applied = 0, rolledBack = 0;
  context.HHAllToolState = { normalizeWorkspaceBackup: value => value, prepareWorkspaceImport: async () => ({ apply: async () => { applied++; throw new Error("Storage full"); }, rollback: async () => { rolledBack++; } }) };
  api.state.root = root([{ name: "strategy", type: "select-one", value: "merge" }]);
  api.state.importPayload = { ...payload({ favorites: [{ id: "after", title: "After", route: "/tools/notes", createdAt: 1 }], local: { [key]: '[{"name":"query","value":"new","type":"text"}]' }, workspace: {} }), version: 2, owner };
  await assert.rejects(api.commitImport(), /Đã hoàn tác/);
  assert.equal(applied, 1); assert.equal(rolledBack, 1); assert.deepEqual(plain((await api.dbAll("favorites")).map(row => row.id)), ["before"]); assert.equal(storage.getItem(key), "[]");
});

test("import reports partial rollback failure rather than claiming data fully restored", async () => {
  const { api, context } = runtime(); const owner = api.accountOwner();
  context.HHAllToolState = { normalizeWorkspaceBackup: value => value, prepareWorkspaceImport: async () => ({ apply: async () => { throw new Error("write failed"); }, rollback: async () => { throw new Error("rollback failed"); } }) };
  api.state.root = root([{ name: "strategy", type: "select-one", value: "merge" }]); api.state.importPayload = { ...payload({ workspace: {} }), version: 2, owner };
  await assert.rejects(api.commitImport(), /Hoàn tác CHƯA đầy đủ/);
});

test("selective offline preparation caches only public allowlisted assets with correct loaded queries", async () => {
  const { api, context } = runtime(); const saved = [], fetched = [], suites = [{ name: "offlineSuite", value: "workspace", checked: true }];
  context.isSecureContext = true;
  context.document.querySelectorAll = () => [{ src: "http://localhost/tool-workspace-pro.js?v=3" }, { href: "http://localhost/tool-workspace-pro.css?v=3" }];
  context.caches = { open: async name => { assert.equal(name, "hh-alltools-offline-v2"); return { put: async (url, response) => { saved.push(url); assert.equal(response.status, 200); } }; } };
  context.fetch = async (url, options) => { fetched.push(url); assert.equal(options.credentials, "omit"); return new Response("/* public code */", { headers: { "Content-Type": url.includes(".css") ? "text/css" : "application/javascript" } }); };
  api.state.root = root(suites); await api.prepareOffline();
  assert.deepEqual(saved, ["http://localhost/tool-workspace-pro.js?v=3", "http://localhost/tool-workspace-pro.css?v=3"]); assert.equal(fetched.length, 2);
  assert.throws(() => api.offlineAssetUrl("api/auth/providers"), /public All Tools/);
});

test("offline preparation rejects HTML login fallback and reports cached partial result honestly", async () => {
  const { api, context } = runtime(); let writes = 0; context.isSecureContext = true;
  context.caches = { open: async () => ({ put: async () => { writes++; } }) };
  context.fetch = async () => new Response("<html>Login</html>", { headers: { "Content-Type": "text/html" } });
  api.state.root = root([{ name: "offlineSuite", value: "workspace", checked: true }]); await api.prepareOffline();
  assert.equal(writes, 0); assert.equal(api.state.root.querySelector("[data-pt-status]").dataset.state, "warning"); assert.match(api.state.root.querySelector("[data-pt-pwa-report]").innerHTML, /Không phải JS\/CSS/);
});

test("bounded public-asset reader rejects oversized payloads before caching", async () => {
  const { api } = runtime();
  await assert.rejects(api.readBoundedAsset(new Response("abc", { headers: { "Content-Length": "100" } }), 2), /8 MB/);
  await assert.rejects(api.readBoundedAsset(new Response("abc"), 2), /8 MB/);
  assert.equal((await api.readBoundedAsset(new Response("ab"), 2)).byteLength, 2);
});

test("live Page Progress listens only to real application events and cleanup detaches it", () => {
  const { api, context, listeners } = runtime(); api.state.root = root([{ name: "progressType", type: "select-one", value: "events" }]);
  api.startProgress(); assert.equal(api.state.root.querySelector("[data-pt-progress]").value, 0);
  listeners.get("hh:progress")({ detail: { value: 42, label: "Upload", state: "running" } });
  assert.equal(api.state.root.querySelector("[data-pt-progress]").value, 42); assert.match(api.state.root.querySelector("[data-pt-progress-detail]").textContent, /Upload/);
  api.cleanupRuntime(); assert.equal(listeners.has("hh:progress"), false);
});

test("cross-tab notification signal contains no title/message and cannot signal another account", () => {
  const { api, context, storage } = runtime(); api.publishNotificationSignal();
  const key = "hh.all-tools.notification-signal.v1.account:owner-a", value = JSON.parse(storage.getItem(key));
  assert.deepEqual(Object.keys(value).sort(), ["changedAt", "id"]); assert.equal(api.safeKey(key), false);
  context.HHAuthz.currentUser = () => ({ id: "owner-b" }); assert.throws(() => api.publishNotificationSignal("account:owner-a"), /Tài khoản đã thay đổi/);
});

test("restarting Page Progress detaches the prior event source instead of accumulating listeners", () => {
  const { api, context } = runtime(); let added = 0, removed = 0;
  context.addEventListener = type => { if (type === "hh:progress") added++; }; context.removeEventListener = type => { if (type === "hh:progress") removed++; };
  api.state.root = root([{ name: "progressType", type: "select-one", value: "events" }]);
  api.startProgress(); api.startProgress(); api.startProgress(); assert.equal(added, 3); assert.equal(removed, 2);
  api.cleanupRuntime(); assert.equal(removed, 3);
});

test("applying theme from real form string values stores numeric scale and immediately supports cross-suite backup", async () => {
  const { api, context, storage } = runtime();
  storage.setItem("hh-auth-user", JSON.stringify({ id: "owner-a" }));
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "all-tool-state.js"), "utf8"), context);
  api.state.active = "Theme Color Switcher";
  api.state.root = root([{ name: "accent", type: "color", value: "#123456" }, { name: "highlight", type: "color", value: "#abcdef" }, { name: "fontScale", type: "range", value: "108" }, { name: "contrast", type: "select-one", value: "normal" }]);
  api.state.root.style = { setProperty() {}, removeProperty() {} };
  await api.handleAction("theme-apply");
  const settings = await api.readSettings(); assert.equal(settings.fontScale, 108);
  const saved = context.HHAllToolState.readJSON("hh.all-tools.appearance.v1", null); assert.equal(typeof saved.fontScale, "number");
  const backup = await context.HHAllToolState.exportWorkspaceBackup(); assert.equal(backup.scopes.appearance.fontScale, 108);
  context.HHAllToolState.normalizeWorkspaceBackup(backup);
});

test("offline capability inspection requires the exact loaded asset URL including version query", async () => {
  const { api, context } = runtime();
  const requests = [{ url: "http://localhost/platform-tools.js?v=2" }];
  context.document.querySelectorAll = () => [{ src: "http://localhost/platform-tools.js?v=3" }];
  context.caches = { keys: async () => ["hh-alltools-offline-v2"], open: async () => ({ keys: async () => requests }) };
  api.state.root = root(); await api.inspectPwa("Offline Mode");
  assert.match(api.state.root.querySelector("[data-pt-pwa-report]").innerHTML, /<span>platform-tools\.js<\/span><b>Chưa lưu bản đang dùng offline/);
  requests.push({ url: "http://localhost/platform-tools.js?v=3" }); await api.inspectPwa("Offline Mode");
  assert.match(api.state.root.querySelector("[data-pt-pwa-report]").innerHTML, /<span>platform-tools\.js<\/span><b>Đã có bản đang dùng trong cache/);
});

const palette = { accent: "#c4a5ff", highlight: "#ff92d0", fontScale: "108", contrast: "normal" };
test("five named Cosmic palettes are validated original presets with distinct identifiers and colors", () => {
  const { api } = runtime();
  assert.equal(api.COSMIC_PRESETS.length, 5); assert.equal(new Set(api.COSMIC_PRESETS.map(item => item.id)).size, 5);
  assert.equal(new Set(api.COSMIC_PRESETS.map(item => item.accent)).size, 5);
  assert.deepEqual(plain(api.COSMIC_PRESETS.map(item => item.name)), ["Nebula", "Aurora", "Solar", "Ocean", "Minimal"]);
  api.COSMIC_PRESETS.forEach(item => { assert.equal(typeof api.themeConfig(item).fontScale, "number"); assert.ok(Object.isFrozen(item)); });
});

test("custom palette save rename delete persist validated settings and leave applied appearance unchanged", async () => {
  const { api } = runtime(); await api.saveSetting("accent", "#123456");
  const saved = await api.saveThemePreset("  Góc học của tôi  ", palette);
  assert.equal(saved.name, "Góc học của tôi"); assert.equal(saved.fontScale, 108); assert.match(saved.id, /^preset-/);
  assert.equal((await api.getThemePresets())[0].name, saved.name);
  const renamed = await api.renameThemePreset(saved.id, "Màu mới");
  assert.equal(renamed.createdAt, saved.createdAt); assert.equal(renamed.accent, saved.accent); assert.equal((await api.getThemePresets())[0].name, "Màu mới");
  await api.deleteThemePreset(saved.id); assert.equal((await api.getThemePresets()).length, 0); assert.equal((await api.readSettings()).accent, "#123456");
});

test("custom preset names and storage are account scoped and bounded without overwriting old entries", async () => {
  const { api, setUser } = runtime(); const first = await api.saveThemePreset("Góc học", palette);
  await assert.rejects(api.saveThemePreset("goc hoc", palette), /đã tồn tại/);
  await assert.rejects(api.saveThemePreset("", palette), /1–60/); await assert.rejects(api.saveThemePreset("x".repeat(61), palette), /1–60/);
  await assert.rejects(api.renameThemePreset(first.id, "bad\nname"), /1–60/);
  for (let index = 1; index < 12; index++) await api.saveThemePreset(`Palette ${index}`, palette);
  await assert.rejects(api.saveThemePreset("Palette 13", palette), /12 preset/); assert.equal((await api.getThemePresets()).length, 12);
  setUser({ id: "owner-b" }); assert.equal((await api.getThemePresets()).length, 0); await api.saveThemePreset("B", palette);
  setUser({ id: "owner-a" }); assert.equal((await api.getThemePresets()).length, 12);
});

test("preset schema rejects injected fields styles unsafe IDs duplicates and out-of-range font values", async () => {
  const { api } = runtime(), item = await api.saveThemePreset("Valid", palette);
  const store = value => ({ version: 1, items: [value] });
  assert.throws(() => api.themePresetStore(store({ ...item, token: "private" })), /ID preset/);
  assert.throws(() => api.themePresetStore(store({ ...item, id: 'preset-" onclick=bad' })), /ID preset/);
  assert.throws(() => api.themePresetStore(store({ ...item, accent: "#fff;display:none" })), /Cài đặt/);
  assert.throws(() => api.themePresetStore(store({ ...item, fontScale: "150" })), /Cài đặt/);
  assert.throws(() => api.themePresetStore(store({ ...item, fontScale: [100] })), /Cài đặt/);
  assert.throws(() => api.themePresetStore({ version: 1, items: [item, item] }), /bị trùng/);
  assert.throws(() => api.themePresetStore({ version: 1, items: [], owner: "other" }), /Kho preset/);
});

test("personal themes round-trip existing Platform settings backup while retaining legacy setting rows", async () => {
  const { api } = runtime(), item = await api.saveThemePreset("Backup theme", palette);
  const old = { id: "setting:colorMode", value: "system", updatedAt: 1 };
  const normalized = api.normalizeImport(payload({ settings: [old, { id: "setting:themePresets", value: { version: 1, items: [item] }, updatedAt: 1 }] }));
  assert.equal(normalized.data.settings[0].value, "system"); assert.equal(normalized.data.settings[1].value.items[0].id, item.id);
  await api.applyStoreBatch(normalized.data, "replace", api.accountOwner());
  assert.equal((await api.getThemePresets())[0].name, "Backup theme");
});

test("preset preview and apply manipulate only the current All Tools workspace", async () => {
  const { api, context } = runtime(); const fields = Object.entries(palette).map(([name, value]) => ({ name, value, type: name === "fontScale" ? "range" : "text" }));
  const workspace = root(fields), originalQuery = workspace.querySelector.bind(workspace), styles = {};
  workspace.querySelector = selector => fields.find(field => selector === `[name="${field.name}"]`) || originalQuery(selector);
  workspace.style = { setProperty: (key, value) => { styles[key] = value; } };
  const preview = workspace.querySelector(".pt-theme-preview"); preview.style = { setProperty() {} }; preview.classList = { toggle() {} };
  api.state.root = workspace; api.state.active = "Theme Color Switcher";
  await api.useThemePreset("aurora"); assert.equal(fields.find(field => field.name === "accent").value, "#6ef2c4"); assert.equal((await api.readSettings()).accent, undefined);
  await api.handleAction("theme-preset-apply:aurora"); assert.equal((await api.readSettings()).accent, "#6ef2c4"); assert.equal(styles["--pt-cyan"], "#6ef2c4");
  assert.deepEqual(context.document.documentElement.style.values, {}); assert.equal(context.document.documentElement.dataset.colorMode, undefined);
});

test("stale account cannot mutate or read the previous account's presets", async () => {
  const { api, context } = runtime(), item = await api.saveThemePreset("Private", palette);
  context.HHAuthz.currentUser = () => ({ id: "owner-b" });
  await assert.rejects(api.renameThemePreset(item.id, "Leak"), /Tài khoản đã thay đổi/);
  await assert.rejects(api.deleteThemePreset(item.id), /Tài khoản đã thay đổi/);
});

function activity(id, tool, action, source, date, extra = {}) { return { id, tool, name: tool === "notes" ? "Ghi chú" : tool, action, source, createdAt: new Date(date).getTime(), ...extra }; }
test("history date tool action source and accent-insensitive search filters intersect correctly", () => {
  const { api } = runtime(), rows = [activity("1", "notes", "save", "utility", "2026-10-13T00:00:00"), activity("2", "notes", "save", "utility", "2026-10-13T23:59:59.999"), activity("3", "notes", "save", "utility", "2026-10-14T00:00:00"), activity("4", "notes", "delete", "utility", "2026-10-13T12:00:00"), activity("5", "theme-switcher", "save", "platform", "2026-10-13T12:00:00")];
  const selected = api.filterHistory(rows, { query: "ghi chu", historyTool: "notes", historyAction: "save", historySource: "utility", historyFrom: "2026-10-13", historyTo: "2026-10-13" });
  assert.deepEqual(plain(selected.map(row => row.id)), ["1", "2"]);
  assert.equal(api.filterHistory(rows, { historySource: "workspace" }).length, 0);
});

test("history rejects invalid calendar dates and reverse ranges without losing the input data", () => {
  const { api } = runtime(), rows = [activity("1", "notes", "save", "utility", "2024-02-29T12:00:00")];
  assert.throws(() => api.filterHistory(rows, { historyFrom: "2026-02-29" }), /không tồn tại/);
  assert.throws(() => api.filterHistory(rows, { historyFrom: "2026-10-14", historyTo: "2026-10-13" }), /sau ngày/);
  assert.throws(() => api.filterHistory(rows, { historyFrom: "invalid" }), /YYYY-MM-DD/);
  assert.equal(api.filterHistory(rows, { historyFrom: "2024-02-29", historyTo: "2024-02-29" }).length, 1); assert.equal(rows.length, 1);
});

test("history export projects only filtered bounded action metadata, never stored details or private content", () => {
  const { api } = runtime(), rows = [activity("1", "notes", "save", "utility", "2026-10-13", { token: "secret", detail: { note: "private source text" }, content: "private input", output: "private output" }), activity("2", "todo", "delete", "utility", "2026-10-13")];
  const selected = api.filterHistory(rows, { historyTool: "notes" }), exported = JSON.parse(api.historyExport(selected, "json"));
  assert.equal(exported.count, 1); assert.equal(exported.rows[0].id, "1"); assert.equal(exported.owner, "account:owner-a");
  assert.doesNotMatch(JSON.stringify(exported), /secret|private|token|content|output|detail/);
  assert.equal(api.historyMetadata([{ createdAt: NaN }]).length, 0);
});

test("filtered CSV wraps and escapes each field and protects ASCII full-width and whitespace-leading formulas", () => {
  const { api } = runtime();
  for (const value of ["=1+2", "+SUM(A1)", "-1+2", "@SUM(A1)", "  =HYPERLINK()", "\t@formula", "\r\n=1", "＝1+2", "＋1", "－1", "＠SUM()"] ) assert.ok(api.csvCell(value).startsWith('"\''), value);
  assert.equal(api.csvCell('line "one",\nsecond'), '"line ""one"",\nsecond"');
  const csv = api.historyExport([activity("1", "notes", "=1+2", "utility", "2026-10-13", { detail: "private" })], "csv");
  assert.ok(csv.startsWith("\ufeff")); assert.match(csv, /"'=1\+2"/); assert.doesNotMatch(csv, /private/); assert.match(csv, /"createdAt"/);
});

test("history empty and invalid-filter states disable export and preserve the real stored rows", () => {
  const { api } = runtime(), fields = [{ name: "query", value: "no-match", type: "text" }]; api.state.root = root(fields);
  api.state.historyRows = [activity("1", "notes", "save", "utility", "2026-10-13")];
  api.refreshHistoryView(); assert.equal(api.state.root.querySelector('[data-pt-action="history-export"]').disabled, true); assert.match(api.state.root.querySelector("[data-pt-history]").innerHTML, /Không có hoạt động khớp/);
  fields.push({ name: "historyFrom", type: "date", value: "2026-02-31" }); assert.throws(() => api.refreshHistoryView(), /không tồn tại/);
  assert.equal(api.state.root.querySelector('[data-pt-action="history-export-csv"]').disabled, true); assert.equal(api.state.historyRows.length, 1);
});
