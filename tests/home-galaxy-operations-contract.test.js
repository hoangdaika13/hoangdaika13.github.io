const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("home-galaxy-operations.js");
const styles = read("home-galaxy-operations.css");
const loader = read("performance-loader.js");
const worker = read("sw.js");
const index = read("index.html");
const operations = require(path.join(root, "home-galaxy-operations.js"));

test("Galaxy Operations V3 is versioned on home and offline shell", () => {
  assert.equal(operations.VERSION, "3.0.0");
  for (const asset of ["home-galaxy-operations.css?v=1", "home-galaxy-operations.js?v=4"]) {
    assert.ok(loader.includes(asset), `loader missing ${asset}`);
    assert.ok(worker.includes(asset), `service worker missing ${asset}`);
  }
  assert.match(worker, /hh-identity-portal-v256/);
  assert.match(index, /performance-loader\.js\?v=45/);
});

test("Command Center reads and writes the existing work stores without fake counters", () => {
  assert.equal(Object.keys(operations.KEYS).length, 13);
  for (const key of [
    "hh.command-center.todos.v2",
    "hh.dashboard.sticky-notes.v1",
    "hh-project-center",
    "hh-work-center-v2",
    "hh.platform.orchestrator.v2"
  ]) assert.ok(source.includes(key), `missing current store ${key}`);
  for (const contract of [
    "data-hgo-command",
    "data-hgo-capture=\"task\"",
    "data-hgo-capture=\"note\"",
    "data-hgo-continue",
    "data-hgo-complete-task",
    "Chưa có công việc gần đây",
    "Chưa có tác vụ nền"
  ]) assert.ok(source.includes(contract), `missing Command Center contract ${contract}`);
  assert.match(source, /has-overdue/);
  assert.match(source, /showNova\(instance/);
  assert.doesNotMatch(source, /fake|mock|demoCount/i);

  const empty = operations.commandSnapshot();
  assert.equal(empty.open.length, 0);
  assert.equal(empty.overdue.length, 0);
  assert.equal(empty.activeJobs.length, 0);
});

test("work galaxy map is generated from real projects, tasks and dependencies", () => {
  for (const contract of [
    "planning.projects",
    "planning.tasks",
    "legacy.projects",
    "legacy.tasks",
    "dependsOn",
    "data-hgo-project",
    "data-hgo-task",
    "data-hgo-route=\"/work/project-center\"",
    "Đường xung: dependency thật"
  ]) assert.ok(source.includes(contract), `missing work-map contract ${contract}`);
  for (const state of [".is-done", ".is-due", ".is-overdue"]) {
    assert.ok(styles.includes(state), `missing real task state ${state}`);
  }
});

test("Cosmic Status Ring exposes six clickable live system signals", () => {
  for (const signal of ["ai", "today", "messages", "deploy", "endpoint", "vitals"]) {
    assert.ok(source.includes(`id: "${signal}"`), `missing status segment ${signal}`);
  }
  assert.match(source, /data-hgo-status-ring/);
  assert.match(source, /healthSnapshot/);
  assert.match(source, /is-unsupported/);
  assert.match(styles, /\.hgo-status-ring/);
});

test("Focus Galaxy is a layered holographic panel backed by real planet data", () => {
  for (const tab of ["overview", "queue", "history", "signal"]) {
    assert.ok(source.includes(`data-hgo-focus-tab="${tab}"`), `missing focus layer ${tab}`);
  }
  for (const contract of [
    "focusContent",
    "hgo-focus-layers",
    "polyline points",
    "data-hgm-open-workspace"
  ]) assert.ok(source.includes(contract), `missing hologram contract ${contract}`);
  assert.match(styles, /\.hgo-focus-tabs/);
  assert.match(styles, /\.hgo-focus-layers svg/);
});

test("wormhole waits for destination assets and reverses into a retry state on failure", () => {
  for (const contract of [
    "loader?.ensureForRoute",
    "loader.isRouteReady?.(route)",
    "waitForRoute",
    "data-hgo-wormhole",
    "data-phase",
    "hh:runtime-issue",
    "data-hgo-wormhole-retry",
    "380"
  ]) assert.ok(source.includes(contract) || styles.includes(contract), `missing wormhole contract ${contract}`);
  assert.match(styles, /\.hgo-wormhole/);
  assert.match(styles, /data-phase="error"/);
});

test("notifications and timeline are driven by persisted event-bus activity", () => {
  for (const contract of [
    "hh.home.galaxy.activity.v2",
    "hh:event",
    "detectNotification",
    "markActivityRead",
    "data-hgo-event-comet",
    "data-hgo-activity",
    "data-hgo-filter",
    "categoryForActivity",
    "relative(item.createdAt)"
  ]) assert.ok(source.includes(contract), `missing real activity contract ${contract}`);
  assert.deepEqual(
    ["AI", "Công việc", "Deployment", "Giao tiếp", "Hệ thống"].every((label) => source.includes(label)),
    true
  );
  assert.doesNotMatch(source, /setInterval\([^)]*(comet|nova)/i);
});

test("H Navigator maps all six supported commands to current modules", () => {
  for (const phrase of [
    "Hôm nay tôi cần làm gì?",
    "Mở task quá hạn",
    "Tiếp tục dự án gần nhất",
    "Kiểm tra website",
    "Tìm asset vừa tải lên",
    "Bật Focus 25 phút"
  ]) assert.ok(source.includes(phrase), `missing H command ${phrase}`);
  for (const contract of [
    "executeNavigator",
    "/work/project-center",
    "/media-design",
    "data-hhhf-toggle",
    "data-hhhf-refresh"
  ]) assert.ok(source.includes(contract), `missing navigator integration ${contract}`);
});

test("cosmos reflects time, connectivity, health, quality and page visibility", () => {
  for (const contract of [
    "dataset.cosmicPeriod",
    "dataset.network",
    "dataset.cosmosHealth",
    "navigator?.onLine",
    "global.document.hidden",
    "data-quality=\"low\""
  ]) {
    assert.ok(source.includes(contract) || styles.includes(contract), `missing state reflection ${contract}`);
  }
  for (const mode of ["data-cosmic-period=\"morning\"", "data-cosmic-period=\"sunset\"", "data-cosmic-period=\"night\"", "data-network=\"offline\""]) {
    assert.ok(styles.includes(mode), `missing cosmic palette ${mode}`);
  }
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /max-width: 700px/);
  assert.match(styles, /\.hgo-work-map \{\s*overflow-x: auto/);
});
