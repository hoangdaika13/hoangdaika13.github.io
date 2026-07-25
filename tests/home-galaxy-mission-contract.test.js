const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("home-galaxy-mission.js");
const styles = read("home-galaxy-mission.css");
const loader = read("performance-loader.js");
const worker = read("sw.js");
const vercel = read("vercel.json");
const mission = require(path.join(root, "home-galaxy-mission.js"));

test("Galaxy Mission Control V2 is versioned on home and offline shell", () => {
  assert.equal(mission.VERSION, "2.0.0");
  assert.match(loader, /home-galaxy-mission\.css\?v=4/);
  assert.match(loader, /home-galaxy-mission\.js\?v=6/);
  assert.match(worker, /home-galaxy-mission\.css\?v=4/);
  assert.match(worker, /home-galaxy-mission\.js\?v=6/);
  assert.match(source, /hh\.home\.galaxy\.preferences\.v2/);
  assert.match(source, /newlyIntroduced/);
});

test("exactly eight real feature planets read their existing module stores", () => {
  assert.equal(mission.PLANETS.length, 8);
  assert.deepEqual(
    mission.PLANETS.map((item) => item.id),
    ["creative", "work", "media", "dev", "communication", "learning", "analytics", "system"]
  );
  for (const key of [
    "hh-ai-center-advanced-v1",
    "hh.command-center.todos.v2",
    "hh.creative-os.v1",
    "hh.media-design.page.v1",
    "hh.communication.intelligence.v1",
    "hh.learning.os.v1",
    "hh.insights.analytics.v3",
    "hh.system.center.v1"
  ]) assert.ok(source.includes(key), `missing store ${key}`);
  assert.match(source, /Chưa có hoạt động/);
  assert.doesNotMatch(source, /mockPlanet|fakePlanet|demoCount/);
});

test("LIVE ORBIT uses measurable browser and backend data with honest unsupported states", () => {
  assert.equal(mission.WIDGETS.length, 10);
  assert.deepEqual(
    mission.WIDGETS.map((item) => item.id),
    ["weather", "performance", "vitals", "resources", "api", "services", "storage", "pwa", "network", "sync"]
  );
  for (const contract of [
    "PerformanceObserver",
    "largest-contentful-paint",
    "layout-shift",
    "event",
    "getEntriesByType?.(\"resource\")",
    "navigator.storage",
    "indexedDB.databases",
    "serviceWorker",
    "navigator?.connection",
    "/api/health"
  ]) assert.ok(source.includes(contract), `missing live source ${contract}`);
  assert.match(source, /Trình duyệt không cung cấp/);
  assert.match(source, /không tự ước lượng/i);
  assert.match(vercel, /"source": "\/api\/health"/);
  assert.match(vercel, /\/api\/platform\/summary\?view=health/);
});

test("activity stream is backed by the event bus and emits effects only for real events", () => {
  for (const contract of [
    "HHEventBus",
    "hh:event",
    "Một task vừa được hoàn thành",
    "AI vừa hoàn tất",
    "Deployment",
    "AQI",
    "showComet(instance, item)",
    "read: input.read === true"
  ]) assert.ok(source.includes(contract), `missing activity contract ${contract}`);
  assert.match(source, /hh\.home\.galaxy\.activity\.v2/);
  assert.doesNotMatch(source, /setInterval\([^)]*showComet/);
});

test("command dock writes to current modules and exposes all eight real actions", () => {
  assert.equal(mission.ACTIONS.length, 8);
  assert.deepEqual(
    mission.ACTIONS.map((item) => item.id),
    ["task", "ai", "asset", "note", "recent", "health", "search", "focus"]
  );
  for (const contract of [
    "hh.command-center.todos.v2",
    "hh.dashboard.sticky-notes.v1",
    "hh.command-center.files.v1",
    "data-command-open",
    "data-hhhf-refresh",
    "data-hhhf-toggle",
    "/create/ai-center",
    "/recent"
  ]) assert.ok(source.includes(contract), `missing dock integration ${contract}`);
});

test("Focus Galaxy, account sync and advanced personalization are complete", () => {
  for (const contract of [
    "data-hgm-focus",
    "data-hgm-open-workspace",
    "data-hgm-pin-planet",
    "data-hgm-hide-signal",
    "data-hgm-widget-size",
    "data-hgm-setting-widget",
    "data-hgm-export",
    "data-hgm-import",
    "/api/modules/home-galaxy/items",
    "preferences-v2"
  ]) assert.ok(source.includes(contract), `missing personalization contract ${contract}`);

  const empty = mission.normalizePrefs({ widgets: [], pinnedActions: [] });
  assert.deepEqual(empty.widgets, []);
  assert.deepEqual(empty.pinnedActions, []);
  const limited = mission.normalizePrefs({ pinnedActions: mission.ACTIONS.map((item) => item.id) });
  assert.equal(limited.pinnedActions.length, 4);
});

test("cosmic rendering is adaptive, semantic, mobile-safe and motion-safe", () => {
  for (const contract of [
    "requestAnimationFrame",
    "visibilitychange",
    "data-quality",
    "has-ai-energy",
    "has-overdue",
    "has-slow-endpoint",
    "hgm-burst",
    "hgm-aurora"
  ]) assert.ok(source.includes(contract) || styles.includes(contract), `missing rendering contract ${contract}`);
  assert.match(styles, /@media\s*\(max-width:\s*700px\)/);
  assert.match(styles, /scroll-snap-type:\s*x mandatory/);
  assert.match(styles, /position:\s*fixed;[\s\S]*bottom:\s*0/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(styles, /focus-visible/);
  assert.match(styles, /border-radius:\s*50%/);
  assert.match(styles, /\[data-paused="true"\]/);
});
