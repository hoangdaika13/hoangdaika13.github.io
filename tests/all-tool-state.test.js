"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
function load() {
  const values = new Map(), listeners = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const window = { localStorage: storage, sessionStorage: { getItem: () => null }, addEventListener: (name, fn) => listeners.set(name, fn) };
  vm.runInNewContext(fs.readFileSync(require.resolve("../all-tool-state.js"), "utf8"), { window });
  return { api: window.HHAllToolState, values, auth: user => listeners.get("hh:auth-change")({ detail: { user } }), external: () => listeners.get("storage")({ key: "hh-auth-user" }) };
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
