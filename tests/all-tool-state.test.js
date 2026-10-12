"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
function load() {
  const values = new Map(), listeners = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const events = [];
  const window = { localStorage: storage, sessionStorage: { getItem: () => null }, addEventListener: (name, fn) => listeners.set(name, fn), CustomEvent: class { constructor(type) { this.type = type; } }, dispatchEvent: event => events.push(event.type) };
  vm.runInNewContext(fs.readFileSync(require.resolve("../all-tool-state.js"), "utf8"), { window });
  return { api: window.HHAllToolState, values, events, auth: user => listeners.get("hh:auth-change")({ detail: { user } }), external: () => listeners.get("storage")({ key: "hh-auth-user" }) };
}
test("All Tool state is account-specific and never adopts unattributed legacy storage", () => {
  const { api, values, auth } = load();
  values.set("hh.all-tools.catalog.v1", '{"favorites":["private"]}');
  assert.equal(api.accountScope(), "guest");
  assert.deepEqual(JSON.parse(JSON.stringify(api.readJSON("hh.all-tools.catalog.v1", {}))), {});
  auth({ id: "owner-a", email: "private@example.test" });
  api.writeJSON("hh.test", { note: "A" });
  auth({ id: "owner-b" });
  assert.equal(api.readJSON("hh.test", null), null);
  api.writeJSON("hh.test", { note: "B" });
  auth({ id: "owner-a" });
  assert.equal(api.readJSON("hh.test", null).note, "A");
  auth(null);
  assert.equal(api.readJSON("hh.test", null), null);
  assert.equal([...values.keys()].some(key => key.includes("@")), false);
});
test("quota/write failures propagate instead of reporting saved", () => {
  const { api } = load();
  assert.throws(() => api.writeJSON("hh.large", "x".repeat(2 * 1024 * 1024 + 1)), /2 MB/);
});
test("a cross-tab public profile change blocks until auth resolves instead of reusing another session", () => {
  const { api, values, auth, external } = load();
  auth({ id: "owner-a" });
  values.set("hh-auth-user", JSON.stringify({ id: "owner-b" }));
  external();
  assert.equal(api.isAccountChanging(), true);
  assert.equal(api.accountScope(), "account-change-pending");
  assert.throws(() => api.writeJSON("hh.test", { note: "do not reassign" }), /tải lại/);
  auth({ id: "owner-b" });
  assert.equal(api.isAccountChanging(), false);
  assert.equal(api.accountScope(), "account:owner-b");
});
test("all 86 declared tool manifests have unique valid identifiers", () => {
  const { TOOL_MANIFESTS } = require("../tool-manifests.js"), { ToolRegistry } = require("../tool-runtime.js");
  assert.equal(TOOL_MANIFESTS.length, 86);
  assert.equal(new ToolRegistry(TOOL_MANIFESTS).list().length, 86);
});
test("runtime fallback history is isolated by owner even without IndexedDB", async () => {
  const values = new Map(), env = { localStorage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) } };
  const { createStorage } = require("../tool-runtime.js");
  const first = await createStorage(env, "account:a"), second = await createStorage(env, "account:b");
  await first.put("history", { id: "entry", summary: "private-a" });
  assert.equal((await second.list("history")).length, 0);
  await second.clear("history");
  assert.equal((await first.get("history", "entry")).summary, "private-a");
});
test("catalog managers share validated favorites and emit refresh without remounting", () => {
  const { api, events, auth } = load(); auth({ id: "first" });
  api.updateCatalogPreferences({ favorites: ["notes", "notes"], pinned: ["monaco-code-editor"] });
  api.updateCatalogPreferences({ recent: ["json-viewer"] });
  assert.equal(api.readCatalogPreferences().favorites.join(","), "notes");
  assert.equal(api.readCatalogPreferences().pinned.join(","), "monaco-code-editor");
  assert.equal(events.filter(event => event === "hh:alltools-catalog-change").length, 2);
  assert.throws(() => api.updateCatalogPreferences({ favorites: ["<script>"] }), /không hợp lệ/);
  auth({ id: "second" }); assert.equal(api.readCatalogPreferences().favorites.length, 0);
  assert.throws(() => api.readCatalogPreferences("account:first"), /tài khoản khác/);
});
test("cross-suite backup validates every scope before any write and excludes other owners", async () => {
  const { api, auth } = load(); auth({ id: "a" }); let imported = 0;
  api.registerBackupScope("utility", { export: async () => ({ version: 1, notes: [] }), normalize: data => { if (data.version !== 1) throw new Error("schema rejected"); return data; }, import: async () => { imported++; } });
  const backup = await api.exportWorkspaceBackup();
  assert.equal(backup.owner, "account:a"); assert.deepEqual(Object.keys(backup.scopes).sort(), ["appearance", "catalog", "utility"]);
  const invalid = JSON.parse(JSON.stringify(backup)); invalid.scopes.utility.version = 999;
  await assert.rejects(api.importWorkspaceBackup(invalid), /schema rejected/); assert.equal(imported, 0);
  invalid.scopes.utility.version = 1; invalid.scopes.untrusted = {};
  await assert.rejects(api.importWorkspaceBackup(invalid), /chưa được hỗ trợ/); assert.equal(imported, 0);
  const poison = JSON.parse(JSON.stringify(backup)); poison.scopes.utility = JSON.parse('{"version":1,"__proto__":{"hacked":true}}');
  assert.throws(() => api.normalizeWorkspaceBackup(poison), /không an toàn/);
  auth({ id: "b" }); await assert.rejects(api.importWorkspaceBackup(backup), /tài khoản/); assert.equal(imported, 0);
});
test("multi-store import captures snapshots and rolls back even a partially failed adapter", async () => {
  const { api } = load(); let saved = { version: 1, value: "old" }, failed = false;
  api.registerBackupScope("utility", { export: async () => saved, normalize: data => data, import: async data => { saved = data; if (data.value === "bad" && !failed) { failed = true; throw new Error("disk full"); } } });
  api.updateCatalogPreferences({ favorites: ["notes"] });
  const backup = await api.exportWorkspaceBackup(); backup.scopes.catalog.favorites = ["todo"]; backup.scopes.utility.value = "bad";
  await assert.rejects(api.importWorkspaceBackup(backup, { strategy: "replace" }), error => error.report.rolledBack && !error.report.partial);
  assert.equal(saved.value, "old"); assert.equal(api.readCatalogPreferences().favorites.join(","), "notes");
  backup.scopes.utility.value = "new";
  const plan = await api.prepareWorkspaceImport(backup, { strategy: "replace" }); await plan.apply(); assert.equal(saved.value, "new");
  await plan.rollback(); assert.equal(saved.value, "old"); await assert.rejects(plan.apply(), /đã được sử dụng/);
});
test("aggregate history contains only bounded action metadata, never input or output content", async () => {
  const { api } = load();
  api.registerBackupScope("workspace", { export: async () => ({}), normalize: value => value, import: async () => {}, history: async () => [{ id: "1", tool: "notes", action: "saved", at: "2026-10-12", text: "private", token: "secret" }, { id: "2", tool: "notes", action: "ignored", at: "invalid" }] });
  const rows = await api.workspaceHistory(); assert.equal(rows.length, 1); assert.doesNotMatch(JSON.stringify(rows), /private|secret/); assert.equal(rows[0].source, "workspace");
});
test("appearance accepts older partial settings but still validates supplied fields", async () => {
  const { api } = load(); api.writeJSON("hh.all-tools.appearance.v1", { mode: "light" });
  const backup = await api.exportWorkspaceBackup(); assert.equal(backup.scopes.appearance.mode, "light"); assert.equal(backup.scopes.appearance.fontScale, 100);
  backup.scopes.appearance.fontScale = 10000; assert.throws(() => api.normalizeWorkspaceBackup(backup), /ngoài giới hạn/);
});

test("appearance backup normalizes legacy decimal slider strings and rejects nonnumeric representations", async () => {
  const { api } = load();
  for (const fontScale of ["85", "100", "125", "100.5"]) {
    api.writeJSON("hh.all-tools.appearance.v1", { mode: "dark", fontScale });
    const backup = await api.exportWorkspaceBackup();
    assert.equal(backup.scopes.appearance.fontScale, Number(fontScale));
    assert.equal(typeof backup.scopes.appearance.fontScale, "number");
  }
  for (const fontScale of ["", " 100 ", "0x64", "1e2", "NaN", "Infinity", "84", "126", true, null, {}]) {
    api.writeJSON("hh.all-tools.appearance.v1", { mode: "dark", fontScale });
    await assert.rejects(api.exportWorkspaceBackup(), /ngoài giới hạn/);
  }
});
test("file import refuses mutation when original binaries cannot fit the rollback snapshot", async () => {
  const { api } = load(); let calls = 0;
  api.registerBackupScope("workspace", { export: async () => ({ filesIncluded: true, omittedFiles: [{ id: "large", name: "large.bin" }] }), normalize: value => value, import: async () => { calls++; } });
  const backup = await api.exportWorkspaceBackup(); await assert.rejects(api.prepareWorkspaceImport(backup), /hoàn tác/); assert.equal(calls, 0);
});
