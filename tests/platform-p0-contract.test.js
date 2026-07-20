const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const runtime = require(path.join(root, "platform-p0.js"));

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

test("P0 runtime enhances only the requested host contracts", () => {
  const source = read("platform-p0.js");
  for (const selector of ["[data-notification]", "[data-smart-search]", "[data-widgets-engine]"]) {
    assert.ok(source.includes(selector));
  }
  for (const filter of ["all", "unread", "project", "chat", "ai", "system"]) {
    assert.match(source, new RegExp(`\\[\"${filter}\",`));
  }
  for (const feature of [
    "data-p0-search-type",
    "data-p0-search-date",
    "data-p0-search-creator",
    "data-p0-search-workspace",
    "data-p0-search-recent",
    "data-p0-search-saved",
    "data-p0-open-source",
    "data-p0-widget-retry",
    "data-p0-widget-export",
    "data-p0-widget-import"
  ]) assert.match(source, new RegExp(feature));
  assert.match(source, /MutationObserver/);
  assert.match(source, /aria-live/);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /\/api\/widgets\/sync/);
});

test("search index enforces permissions before applying advanced filters", () => {
  const actor = { id: "u1", role: "editor", roles: ["editor"], workspaceIds: ["w1"] };
  const records = [
    { id: "public", type: "wiki", title: "Public guide", creator: "An", workspace: "Docs", createdAt: new Date().toISOString(), permissions: { visibility: "public" } },
    { id: "workspace", type: "project", title: "Alpha roadmap", creator: "Binh", workspace: "Alpha", workspaceId: "w1", createdAt: new Date().toISOString(), permissions: { visibility: "workspace" } },
    { id: "private-allowed", type: "chat", title: "Design chat", creator: "Chi", workspace: "Alpha", permissions: { visibility: "private", allowedUserIds: ["u1"] } },
    { id: "private-denied", type: "chat", title: "Payroll chat", creator: "Dung", workspace: "Finance", permissions: { visibility: "private", allowedUserIds: ["u2"] } },
    { id: "explicit-deny", type: "project", title: "Hidden roadmap", creator: "Binh", workspace: "Alpha", permissions: { visibility: "public", deniedUserIds: ["u1"] } }
  ];

  const visible = runtime.filterSearchRecords(records, { type: "all", date: "all" }, actor);
  assert.deepEqual(visible.map((record) => record.id).sort(), ["private-allowed", "public", "workspace"]);

  const filtered = runtime.filterSearchRecords(records, {
    query: "roadmap",
    type: "project",
    date: "week",
    creator: "Binh",
    workspace: "Alpha"
  }, actor);
  assert.deepEqual(filtered.map((record) => record.id), ["workspace"]);
  assert.equal(runtime.canReadRecord(records[3], actor), false);
  assert.equal(runtime.canReadRecord(records[4], actor), false);
  assert.equal(runtime.normalizeSearchRecord({ title: "Unsafe", href: "javascript:alert(1)" }).href, "");
});

test("widget queue never reports server sync without a real adapter acknowledgement", async () => {
  const storage = memoryStorage();
  const queue = runtime.createSyncQueue(storage, "test-widget-queue");
  queue.enqueue("layout:update", { layout: { clock: true } });
  queue.enqueue("layout:update", { layout: { clock: false } });
  assert.equal(queue.list().length, 1, "repeated local layout updates are coalesced");

  const withoutAdapter = await queue.flush(null, true);
  assert.deepEqual(withoutAdapter, { status: "adapter-required", pending: 1, synced: 0 });
  assert.equal(queue.list().length, 1);

  const failed = await queue.flush(async () => { throw new Error("network down"); }, true);
  assert.equal(failed.status, "pending");
  assert.equal(queue.list()[0].attempts, 1);
  assert.equal(queue.list()[0].lastError, "network down");

  const waitingJob = queue.list()[0];
  storage.setItem("test-widget-queue", JSON.stringify([{ ...waitingJob, retryAt: 0 }]));
  const acknowledged = await queue.flush(async (job) => ({ ok: job.type === "layout:update" }), true);
  assert.equal(acknowledged.status, "synced");
  assert.equal(acknowledged.synced, 1);
  assert.equal(queue.list().length, 0);
});

test("layout import validates schema before local persistence", () => {
  assert.deepEqual(runtime.validateLayoutDocument({ schemaVersion: 1, layout: { clock: true, notes: false } }).layout, { clock: true, notes: false });
  assert.throws(() => runtime.validateLayoutDocument({ schemaVersion: 2, layout: {} }), /chưa được hỗ trợ/);
  assert.throws(() => runtime.validateLayoutDocument({ schemaVersion: 1, layout: [] }), /object/);
});

test("P0 CSS is scoped, responsive and exposes all state surfaces", () => {
  const styles = read("platform-p0.css");
  for (const selector of [
    ".p0-notification-toolbar",
    ".p0-search-controls",
    ".p0-smart-result",
    ".p0-search-memory",
    ".p0-widget-sync",
    ".p0-widget-state"
  ]) assert.match(styles, new RegExp(selector.replace(".", "\\.")));
  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /prefers-contrast: more/);
});
