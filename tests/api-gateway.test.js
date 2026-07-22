const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const gateway = require("../services/apiGateway.js");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("gateway redaction strips secrets, credentials and search bodies from audit metadata", () => {
  const safe = gateway.redact({ provider: "google", action: "search", query: "private words", apiToken: "secret", nested: { password: "bad", status: 200 } });
  assert.deepEqual(safe, { provider: "google", action: "search", nested: { status: 200 } });
  const source = read("services/apiGateway.js");
  assert.match(source, /gatewayAuditLogs/);
  assert.match(source, /actorHash/);
  assert.doesNotMatch(source, /query:\s*(?:req|options|entry)/);
});

test("cookie mutations enforce trusted Origin while safe reads remain available", () => {
  assert.equal(gateway.assertCsrf({ method: "GET", headers: { cookie: "hh_session=opaque" } }), true);
  assert.equal(gateway.assertCsrf({ method: "POST", headers: { cookie: "hh_session=opaque", origin: "https://nhhoang13all.xyz" } }), true);
  assert.throws(() => gateway.assertCsrf({ method: "POST", headers: { cookie: "hh_session=opaque", origin: "https://evil.example" } }), error => error.code === "CSRF_ORIGIN_REJECTED");
  const auth = read("utils/auth-security.js");
  assert.match(auth, /HttpOnly; Secure; SameSite=None/);
});

test("RBAC is server-side and provider quota costs are explicit", () => {
  assert.equal(gateway.requireRoles({ systemRoles: ["analyst"] }, ["analyst"]), true);
  assert.throws(() => gateway.requireRoles({ systemRoles: ["support"] }, ["analyst"]), error => error.code === "RBAC_DENIED");
  assert.equal(gateway.providerPolicy("google", "search").cost, 1);
  assert.equal(gateway.providerPolicy("youtube", "search").cost, 101);
  assert.equal(gateway.providerPolicy("youtube", "videos").cost, 1);
});

test("Google and YouTube search share durable gateway rate limit, quota and safe aggregate status", () => {
  const search = read("api/search/[provider].js");
  const service = read("services/apiGateway.js");
  const status = read("api/platform/summary.js");
  assert.match(search, /beginGateway\(req, res, \{ provider, action \}\)/);
  assert.doesNotMatch(search, /const rateBuckets = new Map/);
  assert.match(service, /enforceRateLimit\(db/);
  assert.match(service, /gatewayQuotaUsage/);
  assert.match(service, /GATEWAY_QUOTA_EXHAUSTED/);
  assert.match(status, /aggregateOnly: true/);
  assert.match(status, /actorHashesReturned: false/);
  assert.match(status, /view === "gateway-quotas"/);
});

test("donation polling, webhook, receipts and refunds remain backend-confirmed and idempotent", () => {
  const source = read("api/donations.js");
  assert.match(source, /donation:poll:\$\{pollIdentity\}/);
  assert.match(source, /duplicate: true/);
  assert.match(source, /payosTransactionReference/);
  assert.match(source, /"receipt\.leaseId": leaseId/);
  assert.match(source, /confirmation\.confirmed !== true/);
  assert.match(source, /refundUpdate\.modifiedCount/);
  assert.doesNotMatch(source, /owner_verified/);
});
