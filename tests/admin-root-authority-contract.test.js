const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("custom admin roles grant only catalogued server permissions", () => {
  const {
    PERMISSION_CATALOG,
    accessFor,
    hasPermission,
    rolesFor,
    simulatePermissions
  } = require("../utils/community-admin");
  const user = {
    systemRoles: ["custom:ops_reader"],
    adminCustomPermissions: ["dashboard.view", "observability.view", "unknown.permission"]
  };

  assert.ok(PERMISSION_CATALOG.some((item) => item.id === "platform.production.rollback" && item.tier === "critical"));
  assert.deepEqual(rolesFor(user), ["custom:ops_reader"]);
  assert.equal(hasPermission(user, "observability.view"), true);
  assert.equal(hasPermission(user, "unknown.permission"), false);
  assert.deepEqual(accessFor(user).permissions.sort(), ["dashboard.view", "observability.view"]);

  const simulation = simulatePermissions([], ["payments.refunds.approve"]);
  assert.equal(simulation.valid, true);
  assert.ok(simulation.critical.includes("payments.refunds.approve"));
  assert.ok(simulation.conflicts.some((item) => item.includes("payments.reconcile")));
  assert.ok(simulation.riskScore > 0);
});

test("Root Authority API enforces elevation, dual approval and adapter truth", () => {
  const api = read("utils/community-admin-api.js");
  const roles = read("utils/community-admin.js");

  for (const action of [
    "privilege:activate",
    "permission:simulate",
    "custom-role:save",
    "control:execute",
    "approval:request",
    "approval:approve",
    "access-review:complete"
  ]) {
    assert.match(api, new RegExp(action.replace(":", "\\:")));
  }

  assert.match(api, /GOOGLE_REAUTH_REQUIRED/);
  assert.match(api, /ADMIN_ELEVATION_REQUIRED/);
  assert.match(api, /requiredApprovals:\s*2/);
  assert.match(api, /approved_waiting_adapter/);
  assert.match(api, /security\.logout-all/);
  assert.match(api, /communityCustomAdminRoles/);
  assert.match(api, /communityPrivilegeActivations/);
  assert.match(api, /communityApprovalRequests/);
  assert.match(roles, /sha256-chain-v2/);
  assert.doesNotMatch(api, /PAYOS_API_KEY\s*:/);
  assert.doesNotMatch(api, /VERCEL_API_TOKEN\s*:/);
});

test("Root Authority UI includes command palette, constellation and responsive controls", () => {
  const client = read("community-admin.js");
  const css = read("community-admin.css");

  for (const marker of [
    "Root Authority Console",
    "Permission Simulator",
    "Permission Constellation",
    "Live Infrastructure Map",
    "Tamper-evident Audit Chain",
    "Quantum Authority",
    "Solar Crown",
    "Aurora Command",
    "Black Hole Security",
    "data-admin-command",
    "data-admin-density-select"
  ]) {
    assert.match(`${client}\n${css}`, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }

  assert.match(css, /hh-admin-investigation-workspace/);
  assert.match(css, /@media \(max-width: 375px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(client, /event\.key\.toLowerCase\(\) !== "k"/);
});

test("PayOS control policy blocks new payment links without exposing secrets", () => {
  const donations = read("api/donations.js");
  assert.match(donations, /communityControlPolicies/);
  assert.match(donations, /payments\.locked/);
  assert.match(donations, /tạm khóa để bảo trì hoặc đối soát/);
});
