const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const system = require("../system-platform.js");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const memoryStorage = seed => {
  const values = new Map(Object.entries(seed || {}));
  return {
    get length() { return values.size; },
    key: index => [...values.keys()][index] || null,
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key), values
  };
};

test("system V3 remains local-first and redacts credentials, tokens and personal fields", () => {
  assert.equal(system.STORAGE_KEY, "hh.system.center.v1");
  assert.equal(system.VERSION, 3);
  const storage = memoryStorage();
  const store = system.createStore(storage);
  store.updatePreferences({ theme: "dark", apiToken: "never-store", password: "hidden" });
  store.setLocalFlag("compactNavigation", true);
  const saved = storage.values.get(system.STORAGE_KEY);
  assert.match(saved, /"version":3/);
  assert.doesNotMatch(saved, /never-store|hidden|apiToken|password/);
  assert.equal(store.inspect().preferences.theme, "dark");
  assert.equal(store.inspect().localFlags.compactNavigation, true);
  assert.deepEqual(system.sanitize({ email: "private@example.com", nested: { apiKey: "x", state: "ready" } }), { nested: { state: "ready" } });
});

test("Backup V2 exports allowlisted namespaces with real SHA-256 and detects tampering", () => {
  const storage = memoryStorage({
    "hh.command-center.todos.v2": JSON.stringify([{ title: "Việc cần làm" }]),
    "hh.japanese.state.v1": JSON.stringify({ due: 4 }),
    "random-private-key": JSON.stringify({ text: "do not export" }),
    "hh.social-media-tools.v1": JSON.stringify({ apiToken: "must-redact", project: "Social" })
  });
  const first = system.createStore(storage);
  first.updatePreferences({ density: "compact", reducedData: true });
  const raw = first.exportBackup(["notes", "learning", "social"]);
  const backup = JSON.parse(raw);
  assert.equal(backup.schema, "hh.system.backup.v2");
  assert.equal(backup.checksum.algorithm, "SHA-256");
  assert.equal(backup.checksum.value.length, 64);
  assert.equal(system.sha256("abc"), crypto.createHash("sha256").update("abc").digest("hex"));
  assert.equal("random-private-key" in backup.data.namespaces, false);
  assert.doesNotMatch(raw, /must-redact|apiToken|password|sessionId/i);
  const secondStorage = memoryStorage({ "hh.japanese.state.v1": "{}" });
  const second = system.createStore(secondStorage);
  const preview = second.previewBackup(raw);
  assert.equal(preview.conflicts, 1);
  assert.ok(preview.additions >= 2);
  const imported = second.importBackup(raw, "merge");
  assert.ok(imported.checkpointId);
  assert.equal(second.inspect().preferences.density, "compact");
  const tampered = JSON.parse(raw); tampered.data.preferences.theme = "light";
  assert.throws(() => second.importBackup(tampered), /checksum/i);
  assert.equal(second.rollbackCheckpoint(imported.checkpointId), imported.checkpointId);
});

test("storage inspector measures origin quota, LocalStorage, Cache and IndexedDB", async () => {
  const cache = { keys: async () => [{ url: "/a" }], match: async () => ({ headers: { get: () => "64" }, clone() { return this; }, arrayBuffer: async () => new ArrayBuffer(64) }) };
  const scope = {
    localStorage: memoryStorage({ "hh.japanese.state.v1": "1234" }),
    navigator: { storage: { estimate: async () => ({ usage: 256, quota: 4096 }), persisted: async () => true, persist: async () => true } },
    caches: { keys: async () => ["hh-test"], open: async () => cache, delete: async () => true },
    indexedDB: { databases: async () => [{ name: "hh-school", version: 3 }] }
  };
  const snapshot = await system.inspectStorage(scope);
  assert.equal(snapshot.usage, 256);
  assert.equal(snapshot.quota, 4096);
  assert.equal(snapshot.persisted, true);
  assert.equal(snapshot.caches[0].bytes, 64);
  assert.equal(snapshot.indexedDB[0].name, "hh-school");
  assert.deepEqual(await system.requestPersistentStorage(scope), { granted: true, confirmed: true });
  assert.deepEqual(await system.deleteCache(scope, "hh-test"), { confirmed: true, name: "hh-test" });
  const removed = system.deleteLocalSection(scope.localStorage, "learning");
  assert.equal(removed.confirmed, true);
  assert.equal(removed.removed, 1);
  assert.equal(scope.localStorage.getItem("hh.japanese.state.v1"), null);
});

test("PWA manager exposes installing/waiting/active state without pretending installability", async () => {
  const registration = { scope: "https://hoang8.com/", installing: { state: "installing", scriptURL: "/sw.js" }, waiting: { state: "installed", scriptURL: "/sw.js" }, active: { state: "activated", scriptURL: "/sw.js" } };
  const snapshot = await system.inspectPwa({ navigator: { serviceWorker: { controller: { state: "activated", scriptURL: "/sw.js" }, getRegistration: async () => registration } } });
  assert.equal(snapshot.supported, true);
  assert.equal(snapshot.controlled, true);
  assert.equal(snapshot.waiting.state, "installed");
  assert.equal(snapshot.active.state, "activated");
});

test("session, personal system and job control adapters demand confirmed backend responses", async () => {
  const calls = [];
  const adapter = system.createFetchAdapter(async (url, options) => {
    calls.push([url, options]);
    const response = payload => ({ ok: true, status: 200, headers: { get: key => key === "x-request-id" ? "request-1" : "" }, json: async () => payload });
    if (url.includes("view=health")) return response({ ok: true, health: { checkedAt: "2026-08-13T00:00:00.000Z", services: [] } });
    if (url.includes("view=system-me")) return response({ ok: true, confirmed: true, jobs: [], integrations: [] });
    if (url.includes("gateway-quotas")) return response({ ok: true, confirmed: true, quotas: [{ provider: "youtube", used: 101, limit: 10000, remaining: 9899 }] });
    if (url.endsWith("/sessions")) return response({ sessions: [{ id: "self-1", token: "must-redact", device: { label: "Chrome · Windows" } }] });
    if (url.endsWith("/session-revoke-all")) return response({ ok: true, currentPreserved: true, revoked: 2 });
    if (url.includes("system-job-control")) return response({ ok: true, confirmed: true, job: { id: "j1", source: "tiktok", controls: ["pause", "hack"] } });
    if (url.includes("system-incident-report")) return response({ ok: true, confirmed: true, requestId: "sys-123" });
    return response({ ok: false });
  }, "https://backend.example");
  assert.equal((await adapter.health()).requestId, "request-1");
  assert.equal((await adapter.systemMe()).confirmed, true);
  assert.equal((await adapter.gatewayStatus()).quotas[0].remaining, 9899);
  const sessions = await adapter.sessions();
  assert.equal("token" in sessions[0], false);
  assert.deepEqual(await adapter.revokeOtherSessions(), { confirmed: true, revoked: 2 });
  assert.deepEqual((await adapter.controlJob("j1", "tiktok", "pause")).controls, ["pause"]);
  assert.deepEqual(await adapter.reportIncident({ kind: "runtime-error", token: "no" }), { confirmed: true, requestId: "sys-123" });
  await assert.rejects(adapter.revokeSession("self-1"), /chưa xác nhận/i);
  assert.ok(calls.every(([, options]) => options.credentials === "include"));
  assert.doesNotMatch(JSON.stringify(calls), /Bearer|Authorization/);
});

test("support diagnostics report browser truthfully and redact sensitive values", async () => {
  const scope = {
    navigator: { onLine: true, userAgent: "Browser private@example.com", language: "vi", storage: { estimate: async () => ({ usage: 1, quota: 2 }), persisted: async () => false }, serviceWorker: { controller: null, getRegistration: async () => null } },
    localStorage: memoryStorage(), caches: { keys: async () => [] }, indexedDB: { databases: async () => [] },
    Notification: { permission: "denied" }, File: function File() {}, FormData: function FormData() {},
    document: { createElement: () => ({ canPlayType: type => type.includes("mp4") ? "probably" : "maybe" }) },
    performance: { getEntriesByType: () => [] }, location: { hash: "#/system" }
  };
  const result = await system.runDiagnostics(scope, { fetch: async () => ({ ok: true, status: 200 }), apiBase: "https://api.example", realtimeUrl: "https://rt.example" });
  assert.equal(result.schema, "hh.support-diagnostics.v2");
  assert.equal(result.privacy.secretsIncluded, false);
  assert.doesNotMatch(JSON.stringify(result), /private@example\.com/);
  assert.ok(result.checks.some(item => item.id === "media-codec" && item.status === "pass"));
});

test("UI and backend contracts cover every real System Center domain accessibly", () => {
  const access = system.accessSnapshot({ roles: ["admin", "analyst"] });
  assert.equal(access.enforcement, "server");
  assert.ok(access.permissions.includes("Xem số liệu của workspace"));
  const js = read("system-platform.js"); const css = read("system-platform.css"); const api = read("api/platform/summary.js"); const auth = read("api/auth/[...action].js"); const router = read("script.js");
  for (const marker of ["System Health Center", "PWA & Update Manager", "Storage Inspector", "Backup & Restore V2", "Security & Session", "Integration Center V2", "Unified Job Center", "Diagnostics Lab", "Error & Incident", "Data Integrity", "Privacy Center", "Permission Matrix", "Feature Flag & Release", "Notification Control", "Accessibility & Device"]) assert.match(js, new RegExp(marker.replace(/[&]/g, "\\&")));
  assert.match(js, /role="status" aria-live="polite"/);
  assert.match(js, /SUPPORT-BUNDLE/);
  assert.match(api, /view === "system-me"/);
  assert.match(api, /ownerIsolated: true/);
  assert.match(api, /system-job-control/);
  assert.match(api, /system-incident-report/);
  assert.match(api, /systemUserIncidents/);
  assert.match(auth, /body\.exceptCurrent === true/);
  assert.match(auth, /currentPreserved: true/);
  assert.match(router, /apiBase: window\.HH_API_BASE \|\| ""/);
  assert.match(router, /realtimeUrl: SOCKET_URL/);
  assert.match(router, /id: "system-center", title: "Trung tâm Hệ thống", route: "\/system"/);
  assert.match(router, /updatePageHeader\("Trung tâm Hệ thống"/);
  assert.match(read("performance-loader.js"), /system-platform\.js\?v=5/);
  assert.match(read("performance-loader.js"), /system-platform\.css\?v=3/);
  assert.match(read("index.html"), /performance-loader\.js\?v=316/);
  assert.match(read("index.html"), /script\.js\?v=185/);
  assert.match(read("sw.js"), /hh-identity-portal-v591/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /:focus-visible/);
});
