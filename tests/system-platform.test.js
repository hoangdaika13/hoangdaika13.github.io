const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const system = require("../system-platform.js");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const memoryStorage = seed => {
  const values = new Map(Object.entries(seed || {}));
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)), values };
};

test("system state is versioned, local-first and redacts sensitive fields", () => {
  assert.equal(system.STORAGE_KEY, "hh.system.center.v1");
  const storage = memoryStorage();
  const store = system.createStore(storage);
  store.updatePreferences({ theme: "dark", apiToken: "never-store", password: "hidden" });
  store.setLocalFlag("compactNavigation", true);
  const saved = storage.values.get(system.STORAGE_KEY);
  assert.match(saved, /"version":1/);
  assert.doesNotMatch(saved, /never-store|hidden|apiToken|password/);
  assert.equal(store.inspect().preferences.theme, "dark");
  assert.equal(store.inspect().localFlags.compactNavigation, true);
});

test("portable backup round-trips settings without account, session or secret data", () => {
  const first = system.createStore(memoryStorage());
  first.updatePreferences({ density: "compact", reducedData: true });
  const raw = first.exportBackup();
  const backup = JSON.parse(raw);
  assert.equal(backup.schema, "hh.system.backup.v1");
  assert.deepEqual(backup.privacy, { secretsIncluded: false, sessionsIncluded: false, accountDataIncluded: false });
  assert.doesNotMatch(raw, /auth|sessionId|token|password/i);
  const second = system.createStore(memoryStorage());
  second.importBackup(raw);
  assert.equal(second.inspect().preferences.density, "compact");
  assert.equal(second.inspect().preferences.reducedData, true);
  assert.ok(second.inspect().audit.some(item => item.action === "backup.imported"));
  assert.throws(() => second.importBackup('{"schema":"unknown"}'), /không đúng định dạng/i);
});

test("session and health adapters require backend-confirmed responses", async () => {
  const calls = [];
  const adapter = system.createFetchAdapter(async (url, options) => {
    calls.push([url, options]);
    if (url.includes("summary")) return { ok: true, json: async () => ({ ok: true, health: { checkedAt: "2026-07-22T00:00:00.000Z", payments: { payos: true } } }) };
    if (url.endsWith("/sessions")) return { ok: true, json: async () => ({ sessions: [{ id: "self-1", token: "must-redact", device: { label: "Chrome · Windows" } }] }) };
    return { ok: true, json: async () => ({ ok: false }) };
  }, "https://backend.example");
  assert.equal((await adapter.health()).confirmed, true);
  const sessions = await adapter.sessions();
  assert.equal(sessions[0].id, "self-1");
  assert.equal("token" in sessions[0], false);
  await assert.rejects(adapter.revokeSession("self-1"), /chưa xác nhận/i);
  assert.equal(calls.at(-1)[1].credentials, "include");
  assert.doesNotMatch(JSON.stringify(calls), /Bearer|Authorization/);
});

test("RBAC is explanatory and server-enforced; UI covers system contracts accessibly", () => {
  const access = system.accessSnapshot({ roles: ["admin", "analyst"] });
  assert.deepEqual(access.roles, ["admin", "analyst"]);
  assert.equal(access.enforcement, "server");
  assert.ok(access.permissions.includes("Xem số liệu tổng hợp an toàn"));
  const js = read("system-platform.js");
  const css = read("system-platform.css");
  for (const marker of ["Thiết bị đăng nhập", "RBAC", "API quota", "Integration center", "Export / Import", "Audit log", "Feature flags", "PWA", "Offline"]) assert.match(js, new RegExp(marker));
  assert.match(js, /Không có theo dõi người dùng khác/);
  assert.match(js, /role="status" aria-live="polite"/);
  assert.match(css, /@media\(max-width:420px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /:focus-visible/);
});
