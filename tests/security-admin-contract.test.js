const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("owner access comes only from configured and verified identities", () => {
  const previousEmails = process.env.ADMIN_EMAILS;
  const previousEmail = process.env.ADMIN_EMAIL;
  const previousIds = process.env.ADMIN_USER_IDS;
  process.env.ADMIN_EMAILS = "owner@example.test";
  process.env.ADMIN_EMAIL = "";
  process.env.ADMIN_USER_IDS = "507f1f77bcf86cd799439011";

  delete require.cache[require.resolve("../utils/platform")];
  delete require.cache[require.resolve("../utils/community-admin")];
  const platform = require("../utils/platform");
  const admin = require("../utils/community-admin");

  assert.equal(platform.isOwnerUser({ _id: "other", email: "owner@example.test", emailVerifiedAt: null }), false);
  assert.equal(platform.isOwnerUser({ _id: "other", email: "owner@example.test", emailVerifiedAt: new Date() }), true);
  assert.equal(platform.isOwnerUser({ _id: "507f1f77bcf86cd799439011", email: "member@example.test" }), true);
  assert.deepEqual(admin.rolesFor({ email: "member@example.test", systemRoles: ["owner"] }), []);

  process.env.ADMIN_EMAILS = previousEmails;
  process.env.ADMIN_EMAIL = previousEmail;
  process.env.ADMIN_USER_IDS = previousIds;
  delete require.cache[require.resolve("../utils/platform")];
  delete require.cache[require.resolve("../utils/community-admin")];
});

test("role hierarchy prevents administrators from granting equal or higher privilege", () => {
  process.env.ADMIN_EMAILS = "owner@example.test";
  delete require.cache[require.resolve("../utils/platform")];
  delete require.cache[require.resolve("../utils/community-admin")];
  const { canGrantRole, hasPermission } = require("../utils/community-admin");
  const owner = { email: "owner@example.test", emailVerifiedAt: new Date() };
  const superAdmin = { email: "super@example.test", systemRoles: ["super_admin"] };
  const admin = { email: "admin@example.test", systemRoles: ["admin"] };

  assert.equal(canGrantRole(owner, "super_admin"), true);
  assert.equal(canGrantRole(superAdmin, "super_admin"), false);
  assert.equal(canGrantRole(superAdmin, "admin"), true);
  assert.equal(hasPermission(admin, "users.roles"), false);
  assert.equal(hasPermission(admin, "users.moderate"), true);
});

test("shared APIs enforce origin checks, revocation and hardened security headers", () => {
  const platform = read("utils/platform.js");
  const adminApi = read("utils/community-admin-api.js");
  const adminClient = read("community-admin.js");
  const realtime = read("realtime-server/src/server.js");
  const vercel = read("vercel.json");

  assert.match(platform, /CSRF_ORIGIN_REJECTED/);
  assert.match(platform, /authSessions/);
  assert.match(platform, /revokedAt:\s*null/);
  assert.match(adminApi, /canGrantRole\(admin, role\)/);
  assert.match(adminApi, /view === "security"/);
  assert.match(adminClient, /Security Center/);
  assert.doesNotMatch(realtime, /dev-secret-change-me/);
  assert.match(realtime, /await requireAdmin\(req, res\)/);
  assert.match(vercel, /Content-Security-Policy/);
  assert.match(vercel, /X-Permitted-Cross-Domain-Policies/);
});

test("deployment templates require admin secrets without committing values", () => {
  const envExample = read(".env.example");
  const realtimeEnv = read("realtime-server/.env.example");
  const render = read("render.yaml");

  assert.match(envExample, /ADMIN_EMAILS=owner@example\.com/);
  assert.match(envExample, /ADMIN_USER_IDS=/);
  assert.match(realtimeEnv, /ADMIN_TOKEN=/);
  assert.doesNotMatch(realtimeEnv, /ADMIN_TOKEN=change-this/);
  for (const key of ["ADMIN_EMAILS", "ADMIN_USER_IDS", "ADMIN_TOKEN"]) {
    assert.match(render, new RegExp(`key: ${key}\\s+sync: false`));
  }
});
