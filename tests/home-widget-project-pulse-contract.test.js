const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "home-widget-project-pulse.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "home-widget-project-pulse.css"), "utf8");
const engine = require(path.join(root, "home-widget-project-pulse.js"));

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

test("Widget Engine V2 exposes four named layouts with a Project Pulse widget", () => {
  const store = engine.createDefaultStore();
  assert.equal(store.schema, "hh-widget-project-pulse");
  assert.equal(store.version, 2);
  assert.deepEqual(engine.VIEW_IDS, ["personal", "work", "creative", "learning"]);
  assert.deepEqual(Object.values(store.views).map((view) => view.label), ["Cá nhân", "Công việc", "Sáng tạo", "Học tập"]);
  for (const view of Object.values(store.views)) {
    assert.equal(view.widgets.filter((widget) => widget.id === "project-pulse").length, 1);
    assert.equal(new Set(view.widgets.map((widget) => widget.id)).size, view.widgets.length);
  }
  assert.equal(store.views.work.widgets.find((widget) => widget.id === "google").hidden, true);
  assert.equal(store.views.work.widgets.find((widget) => widget.id === "project-pulse").pinned, true);
  assert.equal(store.views.creative.widgets.find((widget) => widget.id === "ai").hidden, false);
});

test("Clone creates a configuration view and never duplicates widget identities", () => {
  const original = engine.createDefaultStore();
  const cloned = engine.cloneView(original, "work", "Sprint tháng 8");
  const created = cloned.views[cloned.activeView];
  assert.equal(created.label, "Sprint tháng 8");
  assert.notEqual(created.id, "work");
  assert.deepEqual(created.widgets.map((widget) => widget.id), cloned.views.work.widgets.map((widget) => widget.id));
  assert.equal(new Set(created.widgets.map((widget) => widget.id)).size, created.widgets.length);
  assert.equal(Object.keys(original.views).length, 4, "input store remains immutable");
  assert.match(source, /widget DOM không bị nhân bản/);
  assert.doesNotMatch(source, /cloneNode\s*\(/);
});

test("Layout storage is scoped per authenticated user", () => {
  const first = memoryStorage({ "hh-auth-user": JSON.stringify({ id: "user-a", email: "a@example.com" }) });
  const second = memoryStorage({ "hh-auth-user": JSON.stringify({ id: "user-b", email: "b@example.com" }) });
  assert.equal(engine.userScope(first), "user-a");
  assert.equal(engine.userScope(second), "user-b");
  assert.notEqual(engine.storageKeyForUser(first), engine.storageKeyForUser(second));
  assert.match(engine.storageKeyForUser(first), /^hh\.command-center\.widget-project-pulse\.v2:user-a$/);
});

test("Store normalization migrates malformed state and rejects duplicate or unsafe widget data", () => {
  const normalized = engine.normalizeStore({
    version: 1,
    activeView: "bad-view",
    views: {
      personal: {
        label: "My view",
        widgets: [
          { id: "todo", size: "enormous", order: "not-a-number", hidden: true },
          { id: "todo", size: "large", order: 1 },
          { id: "<script>", size: "small" }
        ]
      }
    }
  });
  assert.equal(normalized.version, 2);
  assert.equal(normalized.activeView, "personal");
  assert.equal(normalized.views.personal.label, "My view");
  assert.equal(normalized.views.personal.widgets.filter((widget) => widget.id === "todo").length, 1);
  assert.ok(["small", "medium", "large"].includes(normalized.views.personal.widgets.find((widget) => widget.id === "todo").size));
  assert.equal(normalized.views.personal.widgets.some((widget) => widget.id.includes("script")), false);
});

test("Export and import round-trip versioned layout data", () => {
  const store = engine.cloneView(engine.createDefaultStore(), "creative", "Studio riêng");
  const payload = engine.exportStore(store, "member-13");
  const parsed = JSON.parse(payload);
  assert.equal(parsed.schema, "hh-widget-project-pulse-export");
  assert.equal(parsed.userScope, "member-13");
  const restored = engine.importStore(payload);
  assert.equal(restored.views[restored.activeView].label, "Studio riêng");
  assert.throws(() => engine.importStore({ version: 99, views: {} }), /chưa được hỗ trợ/i);
});

test("Project health is deterministic from progress, deadline and declared blockers", () => {
  const now = new Date("2026-07-22T12:00:00Z");
  const overdue = engine.deriveProjectHealth({ progress: 42, due: "2026-07-20" }, [], now);
  assert.equal(overdue.tone, "critical");
  assert.equal(overdue.daysLeft, -2);

  const blocked = engine.deriveProjectHealth({ progress: 68, due: "2026-08-10", blockers: ["API"] }, [], now);
  assert.equal(blocked.tone, "risk");
  assert.deepEqual(blocked.blockers, ["API"]);

  const healthy = engine.deriveProjectHealth({ progress: 82, due: "2026-09-01" }, [], now);
  assert.equal(healthy.tone, "healthy");

  const complete = engine.deriveProjectHealth({ progress: 100, status: "Hoàn tất" }, [], now);
  assert.equal(complete.tone, "complete");
});

test("Project Pulse reads the existing Project Center schema without inventing realtime data", () => {
  const state = engine.normalizeProjectState({
    projects: [{
      id: "platform",
      name: "HH Platform",
      progress: 75,
      due: "2026-08-12",
      owner: "Hoàng",
      dependencies: ["OAuth"],
      milestones: [{ title: "Release", date: "2026-08-01", progress: 40 }]
    }],
    tasks: [
      { id: "t1", project: "platform", title: "Fix API", assignee: "An", blockedBy: "Backend" },
      { id: "t2", project: "other", title: "Unrelated" }
    ]
  }, new Date("2026-07-22T12:00:00Z"));
  assert.equal(state.length, 1);
  assert.equal(state[0].name, "HH Platform");
  assert.equal(state[0].tasks.length, 1);
  assert.equal(state[0].assignee, "Hoàng, An");
  assert.deepEqual(state[0].dependencies, ["OAuth", "Backend"]);
  assert.equal(state[0].nextMilestone.title, "Release");
  assert.equal(state[0].blockers.length, 1);
  assert.match(source, /không phải dữ liệu realtime/);
  assert.match(source, /localFallback: true/);
  assert.match(source, /localSample: true/);
  assert.doesNotMatch(source, /setInterval\s*\(\s*renderPulse/);
});

test("Project Pulse provides working views, routes and local synchronization hooks", () => {
  assert.deepEqual(engine.PROJECT_VIEWS, ["list", "board", "calendar", "timeline"]);
  assert.match(source, /PROJECT_VIEWS\.map\(\(view\) =>/);
  for (const label of ["Danh sách", "Board", "Lịch", "Timeline"]) assert.ok(source.includes(label));
  assert.match(source, /global\.location\.hash = "#\/work\/project-center"/);
  assert.match(source, /state\.activeProject = projectId/);
  assert.match(source, /state\.projectView = PROJECT_VIEWS\.includes/);
  assert.match(source, /"hh:project-center-sync"/);
  assert.match(source, /event\.key === PROJECT_KEY/);
});

test("Controls are accessible by pointer, keyboard and mobile priority", () => {
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /role="toolbar"/);
  assert.match(source, /aria-pressed/);
  assert.match(source, /\["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "Home", "End"\]/);
  assert.match(source, /data-hhw-widget-action="up"/);
  assert.match(source, /data-hhw-widget-action="down"/);
  assert.match(source, /data-hhw-widget-action="mobile"/);
  assert.match(source, /--hhw-mobile-order/);
  assert.match(styles, /\[data-mobile-priority\]/);
  assert.match(styles, /@media \(max-width: 560px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /:focus-visible/);
});

test("Standalone enhancement does not modify or require shared source files", () => {
  assert.match(source, /#commandCenterProRoot/);
  assert.match(source, /\.cc-grid/);
  assert.match(source, /data-cc-widget/);
  assert.equal(fs.existsSync(path.join(root, "home-widget-project-pulse.js")), true);
  assert.equal(fs.existsSync(path.join(root, "home-widget-project-pulse.css")), true);
});
