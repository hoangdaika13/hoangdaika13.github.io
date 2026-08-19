const test = require("node:test");
const assert = require("node:assert/strict");

const {
  authorize,
  conditionsAllow,
  effectivePermissions,
  normalizeScope,
  redactAdapterResult,
  scopeAllows,
  adapterRegistry
} = require("../utils/admin-control-plane");
const { featureFlagEnabled, enforceControlPolicy, policyStatus } = require("../utils/control-policy");
const fs = require("node:fs");
const path = require("node:path");

test("ABAC scopes deny resources outside their workspace or module", () => {
  const scope = normalizeScope({ type: "workspace", workspaceIds: ["workspace-a"] });
  assert.equal(scopeAllows(scope, { workspaceId: "workspace-a" }), true);
  assert.equal(scopeAllows(scope, { workspaceId: "workspace-b" }), false);
  const result = authorize({ actor: { id: "admin-1", systemRoles: ["admin"] }, action: "content.review", permission: "content.review", permissions: ["content.review"], scope, resource: { workspaceId: "workspace-b" } });
  assert.equal(result.allowed, false);
  assert.equal(result.code, "SCOPE_DENIED");
});

test("permission conditions expire and require step-up without a permissive fallback", () => {
  assert.equal(conditionsAllow({ expiresAt: "2026-08-17T00:00:00.000Z" }, { now: "2026-08-18T00:00:00.000Z" }), false);
  assert.equal(conditionsAllow({ requireStepUp: true }, { stepUpVerified: false }), false);
  assert.equal(conditionsAllow({ requireStepUp: true }, { stepUpVerified: true }), true);
});

test("versioned custom roles select the newest definition and redact secrets", () => {
  const permissions = effectivePermissions({
    roles: ["admin", "custom:operator"],
    rolePermissions: { admin: ["dashboard.view"] },
    definitions: [
      { roleId: "custom:operator", version: 1, status: "active", permissions: ["users.view"] },
      { roleId: "custom:operator", version: 2, status: "active", permissions: ["users.roles"] }
    ]
  });
  assert.deepEqual(permissions.sort(), ["dashboard.view", "users.roles"]);
  const safe = redactAdapterResult({ token: "do-not-return", nested: { password: "hidden", status: "ok" } });
  assert.equal(Object.prototype.hasOwnProperty.call(safe, "token"), false);
  assert.equal(safe.nested.status, "ok");
});

test("resource-aware permission helper respects assignment scope", () => {
  const { hasPermissionForResource } = require("../utils/community-admin");
  const user = {
    systemRoles: ["custom:ops"],
    adminCustomPermissions: ["users.view"],
    __adminRoleAssignments: [{ roleId: "custom:ops", status: "active", scope: { type: "workspace", workspaceIds: ["a"] } }],
    __adminRoleDefinitions: [{ roleId: "custom:ops", permissions: ["users.view"], status: "active" }]
  };
  assert.equal(hasPermissionForResource(user, "users.view", { workspaceId: "a" }), true);
  assert.equal(hasPermissionForResource(user, "users.view", { workspaceId: "b" }), false);
});

test("adapter registry distinguishes configured from write-ready", () => {
  const states = adapterRegistry({ MONGODB_URI: "mongodb://configured" }, [{ id: "mongodb", state: "configured", verifiedWrite: false }]);
  const mongo = states.find((item) => item.id === "mongodb");
  assert.equal(mongo.configured, true);
  assert.equal(mongo.canExecute, false);
  assert.equal(mongo.verifiedWrite, false);
});

test("control policy exposes an honest no-consumer state and blocks enforced locks", async () => {
  const rows = new Map([
    ["payments.locked", { key: "payments.locked", value: true, updatedAt: new Date() }],
    ["observability.slo.foo", { key: "observability.slo.foo", value: true }]
  ]);
  const db = { collection: () => ({ findOne: async ({ key }) => rows.get(key) || null }) };
  const blocked = await enforceControlPolicy(db, { key: "payments.locked", action: "payment:create" });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.code, "CONTROL_POLICY_BLOCKED");
  assert.equal(policyStatus("observability.slo.foo").enforcementState, "no_consumer");
});

test("feature flag rollout is deterministic per subject", async () => {
  const db = { collection: () => ({ findOne: async () => ({ enabled: true, rollout: 50 }) }) };
  const first = await featureFlagEnabled(db, "test.flag", { subjectId: "user-1" });
  const second = await featureFlagEnabled(db, "test.flag", { subjectId: "user-1" });
  assert.equal(first, second);
});

test("Admin Control Plane exposes real governance views and one-time token lifecycle", () => {
  const root = path.resolve(__dirname, "..");
  const api = fs.readFileSync(path.join(root, "utils/community-admin-api.js"), "utf8");
  const ui = fs.readFileSync(path.join(root, "community-admin.js"), "utf8");
  for (const marker of ["effective-access", "access-requests", "service-accounts", "adapter-health", "ai-operations", "data-governance", "workspace", "access:approve", "service-account:rotate", "service-account:revoke", "audit:checkpoint", "CURRENT_SESSION_PROTECTED"]) assert.match(api, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const marker of ["renderGovernance", "data-admin-access-decision", "data-admin-service-rotate", "data-admin-adapter-health", "data-admin-workspace-create"]) assert.match(ui, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
