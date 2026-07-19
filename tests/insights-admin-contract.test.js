const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("server uses one admin policy for both owner accounts and RBAC roles", () => {
  const platform = read("utils/platform.js");
  const communityAdmin = read("utils/community-admin.js");

  assert.match(platform, /nhhoang130803@gmail\.com/);
  assert.match(platform, /dungnguyen29082000@gmail\.com/);
  assert.match(platform, /function isOwnerEmail/);
  assert.match(platform, /function isAdminUser/);
  assert.match(platform, /roles\.add\("owner"\)/);
  assert.match(communityAdmin, /isOwnerEmail\(user\.email\)/);

  for (const file of ["api/platform/summary.js", "api/modules/[moduleId]/items.js", "api/helpdesk/tickets.js", "api/donations.js"]) {
    assert.match(read(file), /isAdminUser/);
  }
});

test("Admin Panel is absent for members, route-guarded, and mounts the full RBAC app", () => {
  const client = read("script.js");
  const adminClient = read("community-admin.js");
  const adminApi = read("utils/community-admin-api.js");
  const communityAdmin = read("utils/community-admin.js");

  assert.match(client, /id !== "admin-panel" \|\| isCurrentUserAdmin\(\)/);
  assert.match(client, /route\.endsWith\("\/admin-panel"\)/);
  assert.match(client, /HHCommunityAdmin\.mount\(host\)/);
  assert.match(adminClient, /\["dashboard".*\["users".*\["reports".*\["appeals".*\["content".*\["settings".*\["audit"/s);
  assert.match(adminApi, /user:roles/);
  assert.match(adminApi, /user:revoke-sessions/);
  assert.match(adminApi, /content:moderate/);
  assert.match(adminApi, /feature-flag:update/);
  assert.match(adminApi, /report:export/);
  assert.match(adminClient, /data-admin-activity-refresh/);
  assert.match(adminClient, /Behavior Center/);
  assert.match(adminApi, /view === "activity"/);
  assert.match(adminApi, /telemetryEvents/);
  assert.match(adminApi, /user:feature-access/);
  assert.match(communityAdmin, /activity\.view/);
  assert.match(communityAdmin, /users\.features/);
});

test("Phân tích ships interactive telemetry, filters, diagnostics and exports", () => {
  const html = read("index.html");
  const client = read("insights-pro.js");
  const css = read("insights-pro.css");

  assert.match(html, /insights-pro\.css\?v=1/);
  assert.match(html, /insights-pro\.js\?v=2/);
  assert.match(client, /PerformanceObserver/);
  assert.match(client, /data-insights-range/);
  assert.match(client, /data-insights-event-search/);
  assert.match(client, /data-insights-health/);
  assert.match(client, /text\/csv/);
  assert.match(client, /application\/json/);
  assert.match(client, /REMOTE_BATCH_SIZE/);
  assert.match(client, /analyticsConsent/);
  assert.match(client, /restrictedFeatures/);
  assert.match(read("api/platform/summary.js"), /TELEMETRY_RETENTION_SECONDS/);
  assert.match(read("api/platform/summary.js"), /formValuesStored:\s*false/);
  assert.doesNotMatch(read("api/platform/summary.js"), /passwordHash:\s*1/);
  assert.match(css, /@media \(max-width: 560px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
