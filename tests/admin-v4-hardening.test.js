const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function auditDb(records, head) {
  return {
    collection(name) {
      if (name === "communityAdminAuditState") {
        return { findOne: async () => head };
      }
      if (name !== "communityAdminAuditLogs") throw new Error(`Unexpected collection ${name}`);
      return {
        find() {
          const cursor = {
            sort() { return cursor; },
            limit() { return cursor; },
            async toArray() { return records; }
          };
          return cursor;
        }
      };
    }
  };
}

test("Admin V4 RBAC denies absent, unknown and forged permissions by default", () => {
  const admin = require("../utils/community-admin");

  assert.deepEqual(admin.accessFor(null), {
    roles: [], permissions: [], admin: false, tier: "delegated", permissionCount: 0
  });
  assert.equal(admin.hasPermission({ systemRoles: ["invented_root"] }, "dashboard.view"), false);
  assert.equal(admin.hasPermission({ systemRoles: ["custom:ops"], adminCustomPermissions: ["unknown.permission"] }, "unknown.permission"), false);
  assert.equal(admin.hasPermission({ systemRoles: ["analyst"] }, "platform.manage"), false);
  assert.equal(admin.normalizePermissions(["dashboard.view", "dashboard.view", "unknown.permission"]).join(","), "dashboard.view");

  assert.throws(() => admin.requirePermission(null, "dashboard.view"), (error) => error.statusCode === 401);
  assert.throws(() => admin.requirePermission({ systemRoles: [] }, "dashboard.view"), (error) => error.statusCode === 403);
});

test("Admin V4 audit presentation masks network identity and recursively removes secrets", () => {
  const { auditSafe, presentAdminAuditRecord } = require("../utils/community-admin");
  const { ObjectId } = require("mongodb");
  const auditId = new ObjectId("66b82f20c24156f6ea746e01");
  const source = {
    _id: "audit-1",
    ownerId: auditId,
    createdAt: new Date("2026-08-10T00:00:00.000Z"),
    ip: "203.0.113.44",
    userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/126.0.0.0",
    before: { profile: { name: "Allowed", accessToken: "never-return", password: "never-return" } },
    after: { ok: true, privateMessage: "never-return" }
  };
  const scrubbed = auditSafe(source);
  assert.equal(scrubbed.before.profile.name, "Allowed");
  assert.equal("accessToken" in scrubbed.before.profile, false);
  assert.equal("password" in scrubbed.before.profile, false);
  assert.equal("privateMessage" in scrubbed.after, false);
  assert.equal(scrubbed.ownerId, auditId.toHexString());
  assert.equal(scrubbed.createdAt, "2026-08-10T00:00:00.000Z");

  const masked = presentAdminAuditRecord(source);
  assert.equal(masked.id, "audit-1");
  assert.equal(masked.ip, "203.0.x.x");
  assert.equal(masked.userAgent, "Chrome · Windows");
  assert.equal(masked.networkMetadata, "masked");
  assert.doesNotMatch(JSON.stringify(masked), /203\.0\.113\.44|126\.0\.0\.0|never-return/);

  const revealed = presentAdminAuditRecord(source, { revealNetwork: true });
  assert.equal(revealed.ip, "203.0.113.44");
  assert.match(revealed.userAgent, /Chrome\/126\.0\.0\.0/);
  assert.equal(revealed.networkMetadata, "revealed_after_step_up");
});

test("Admin V4 appends the audit head and record through one MongoDB transaction", async () => {
  const platform = read("utils/platform.js");
  const adminSource = read("utils/community-admin.js");
  assert.match(platform, /cachedClientPromise/);
  assert.match(platform, /startSession\(\)/);
  assert.match(platform, /session\.withTransaction/);
  assert.match(platform, /readConcern:\s*\{\s*level:\s*["']snapshot["']/);
  assert.match(platform, /writeConcern:\s*\{\s*w:\s*["']majority["']/);
  assert.match(adminSource, /withDatabaseTransaction\(\(db, session\)/);

  const { appendAdminAuditRecord } = require("../utils/community-admin").__test;
  const session = { id: "audit-transaction" };
  const calls = [];
  const db = {
    collection(name) {
      if (name === "communityAdminAuditState") return {
        async findOne(filter, options) {
          calls.push({ operation: "head:read", filter, options });
          return { sequence: 4, recordHash: "previous-record-hash" };
        },
        async updateOne(filter, update, options) {
          calls.push({ operation: "head:update", filter, update, options });
          return { matchedCount: 1, upsertedCount: 0 };
        }
      };
      if (name === "communityAdminAuditLogs") return {
        async insertOne(record, options) {
          calls.push({ operation: "log:insert", record, options });
          return { acknowledged: true };
        }
      };
      throw new Error(`Unexpected collection ${name}`);
    }
  };
  const record = await appendAdminAuditRecord(
    db,
    session,
    { headers: {}, socket: {} },
    { _id: "admin-1", name: "Owner", email: "owner@example.com" },
    { action: "user:update", targetType: "user", targetId: "user-1", before: { at: new Date("2026-08-10T00:00:00.000Z") } },
    { roles: ["owner"] }
  );

  assert.equal(record.sequence, 5);
  assert.equal(record.previousHash, "previous-record-hash");
  assert.equal(record.before.at, "2026-08-10T00:00:00.000Z");
  assert.deepEqual(calls.map((call) => call.operation), ["head:read", "head:update", "log:insert"]);
  assert.ok(calls.every((call) => call.options?.session === session));
});

test("Admin V4 CORS permits the idempotency key used by approval and job mutations", () => {
  const { setCors } = require("../utils/platform");
  const headers = new Map();
  setCors({ headers: {} }, { setHeader(name, value) { headers.set(name.toLowerCase(), value); } });
  assert.match(headers.get("access-control-allow-headers"), /X-Idempotency-Key/i);
});

test("full audit network metadata requires the dedicated security permission and recent step-up", () => {
  const admin = require("../utils/community-admin");
  const api = read("utils/community-admin-api.js");
  assert.equal(admin.hasPermission({ systemRoles: ["security_admin"] }, "audit.network-metadata.view"), true);
  assert.equal(admin.hasPermission({ systemRoles: ["admin"] }, "audit.network-metadata.view"), false);
  assert.equal(admin.hasPermission({ systemRoles: ["super_admin"] }, "audit.network-metadata.view"), false);
  assert.match(api, /hasPermission\(admin,\s*["']audit\.network-metadata\.view["']\)/);
  assert.match(api, /recentGoogleVerification\(admin\)/);
  assert.match(api, /privilege\.active/);
  assert.match(api, /requiresRecentGoogleVerification:\s*true/);
});

test("delegated security and release roles can request their granted elevated actions but cannot approve them", () => {
  const api = read("utils/community-admin-api.js");
  const activation = api.slice(api.indexOf('if (action === "privilege:activate")'), api.indexOf('if (action === "permission:simulate")'));
  const request = api.slice(api.indexOf('if (action === "approval:request")'), api.indexOf('if (["approval:approve", "approval:reject"]'));
  const decision = api.slice(api.indexOf('if (["approval:approve", "approval:reject"]'), api.indexOf('if (action === "incident:update")'));
  assert.match(activation, /requirePermission\(admin,\s*"privileges\.activate"\)/);
  assert.match(activation, /recentGoogleVerification\(admin\)/);
  assert.doesNotMatch(activation, /isPrivilegedAdmin/);
  assert.match(request, /requirePermission\(admin,\s*"approvals\.request"\)/);
  assert.doesNotMatch(request, /isPrivilegedAdmin/);
  assert.match(decision, /isPrivilegedAdmin\(admin\)/);
});

test("Admin V4 verifies ordered audit hashes and detects tampering, gaps and head mismatch", async () => {
  const { computeAdminAuditHash, verifyAdminAuditChain } = require("../utils/community-admin");
  const first = {
    sequence: 1,
    previousHash: "genesis",
    integrityVersion: "sha256-chain-v2",
    action: "user:update",
    targetId: "u1",
    createdAt: new Date("2026-08-10T00:00:00.000Z")
  };
  first.recordHash = computeAdminAuditHash(first);
  const second = {
    sequence: 2,
    previousHash: first.recordHash,
    integrityVersion: "sha256-chain-v2",
    action: "session:revoke",
    targetId: "u1",
    createdAt: new Date("2026-08-10T00:01:00.000Z")
  };
  second.recordHash = computeAdminAuditHash(second);

  const valid = await verifyAdminAuditChain(auditDb([first, second], { sequence: 2, recordHash: second.recordHash }));
  assert.deepEqual({ valid: valid.valid, checked: valid.checked, last: valid.lastSequence, mode: valid.mode }, {
    valid: true, checked: 2, last: 2, mode: "sha256-chain-v2"
  });

  const tampered = { ...second, targetId: "changed-after-write" };
  const invalid = await verifyAdminAuditChain(auditDb([first, tampered], { sequence: 2, recordHash: "wrong" }));
  assert.equal(invalid.valid, false);
  assert.ok(invalid.issues.some((issue) => issue.code === "record_hash_mismatch"));
  assert.ok(invalid.issues.some((issue) => issue.code === "head_mismatch"));

  const incomplete = await verifyAdminAuditChain(auditDb([], { sequence: 2, recordHash: second.recordHash }));
  assert.equal(incomplete.segmentValid, true);
  assert.equal(incomplete.completeToHead, false);
  assert.equal(incomplete.valid, false);
});

test("audit UI describes the Mongo hash chain truthfully until an external WORM anchor exists", () => {
  const client = read("community-admin.js");
  const api = read("utils/community-admin-api.js");
  assert.match(client, /Tamper-evident Audit Chain/);
  assert.match(client, /chưa (?:phải|tuyên bố) WORM|external anchor/i);
  assert.doesNotMatch(client, /Immutable Audit|audit bất biến/i);
  assert.match(api, /immutable:\s*false/);
  assert.match(api, /externalAnchor:\s*false/);
});

test("Admin V4 approval path is atomic, idempotent and never executes before ownership is claimed", () => {
  const api = read("utils/community-admin-api.js");
  assert.match(api, /requestKey|idempotencyKey/);
  assert.match(api, /findOneAndUpdate|updateOne/);
  assert.match(api, /status:\s*["']executing["']|executionClaim|claimedBy/);
  assert.match(api, /x-idempotency-key/);
  assert.match(api, /communityApprovalRequests[\s\S]{0,1000}unique:\s*true/);
  const claimAt = api.indexOf('status: "executing", executionClaimId');
  const executeAt = api.indexOf("execution = await executeControlAction", claimAt);
  const finalizeAt = api.indexOf('status: "executing", executionClaimId', executeAt + 1);
  assert.ok(claimAt > 0, "an atomic pending -> executing claim is required");
  assert.ok(executeAt > claimAt, "the adapter may run only after the request is claimed");
  assert.ok(finalizeAt > executeAt, "finalization must be guarded by the same execution claim");
  assert.match(api.slice(Math.max(0, claimAt - 350), claimAt), /findOneAndUpdate/);
  assert.match(api, /IDEMPOTENCY_KEY_REQUIRED/);
});

test("Admin V4 sends stable mutation keys, locks forms and provides no-replay approval recovery", () => {
  const client = read("community-admin.js");
  const api = read("utils/community-admin-api.js");
  assert.match(client, /X-Idempotency-Key/);
  assert.match(client, /mutationKey/);
  assert.match(client, /withSubmitLock/);
  assert.match(client, /dataset\.idempotencyKey/);
  assert.match(api, /approval:reconcile/);
  assert.match(api, /reconciliation_required/);
  assert.match(api, /automaticReplayPerformed:\s*false/);
  assert.match(api, /APPROVAL_EXECUTION_LEASE_MS/);
});

test("Admin V4 API helpers produce stable idempotency and a single-use approval claim", () => {
  const api = require("../utils/community-admin-api").__test;
  assert.equal(api.stableKey({ a: 1, nested: { b: 2, c: 3 } }), api.stableKey({ nested: { c: 3, b: 2 }, a: 1 }));
  assert.notEqual(api.stableKey({ a: 1 }), api.stableKey({ a: 2 }));

  assert.equal(api.idempotencyKey({ headers: { "x-idempotency-key": "request-1234" } }, {}, "approval"), "approval:request-1234");
  assert.equal(api.idempotencyKey({ headers: {} }, { idempotencyKey: "body-key-123" }, "job"), "job:body-key-123");
  assert.equal(api.idempotencyKey({ headers: { "x-idempotency-key": "short" } }, {}, "approval"), "");

  const now = new Date("2026-08-10T01:00:00.000Z");
  const filter = api.approvalClaimFilter("request-1", "admin-2", now);
  assert.deepEqual(filter, {
    _id: "request-1",
    status: "pending",
    expiresAt: { $gt: now },
    "approvals.id": { $ne: "admin-2" }
  });
});

test("Admin V4 queue duplication is resumable only with payload and never exposes job payloads", () => {
  const api = require("../utils/community-admin-api").__test;
  const now = new Date("2026-08-10T02:00:00.000Z");
  const blocked = api.buildDuplicateJob({ _id: "job-1", type: "render", token: "secret" }, {
    now, reason: "Operator retry", sourceJobId: "job-1", operationKey: "duplicate:abc"
  });
  assert.equal(blocked.status, "blocked_missing_payload");
  assert.equal(blocked.runnable, false);
  assert.equal("token" in blocked, false);
  assert.equal(blocked.adminOperationKey, "duplicate:abc");

  const runnable = api.buildDuplicateJob({ type: "render", payload: { assetId: "asset-1" }, checkpoint: { frame: 25 } }, {
    now, sourceJobId: "job-1"
  });
  assert.equal(runnable.status, "queued");
  assert.equal(runnable.runnable, true);
  assert.deepEqual(runnable.checkpoint, { frame: 25 });

  const presented = api.presentQueueJob({ ...runnable, _id: "job-2", payload: { private: true }, token: "never-return" });
  assert.equal(presented.id, "job-2");
  assert.equal(presented.runnable, true);
  assert.equal("payload" in presented, false);
  assert.equal("token" in presented, false);
});

test("provider status never claims operational health from configuration alone", () => {
  const { configuredProviderStatus } = require("../utils/community-admin-api").__test;
  const now = new Date("2026-08-10T04:00:00.000Z");
  assert.equal(configuredProviderStatus(false, { status: "operational" }), "not_configured");
  assert.equal(configuredProviderStatus(true, {}, now), "health_stale");
  assert.equal(configuredProviderStatus(true, { status: "operational", lastCheckedAt: "2026-08-10T03:00:00.000Z" }, now), "health_stale");
  assert.equal(configuredProviderStatus(true, { status: "warning", lastCheckedAt: "2026-08-10T03:59:00.000Z" }, now), "configured_not_verified");
  assert.equal(configuredProviderStatus(true, { status: "operational", lastCheckedAt: "2026-08-10T03:59:00.000Z" }, now), "verified_operational");
  assert.equal(configuredProviderStatus(true, { status: "operational", lastCheckedAt: "2026-08-10T03:59:00.000Z", expiresAt: "2026-08-10T03:59:59.000Z" }, now), "credential_expired");
});

test("stale execution leases require manual reconciliation and gateway failures use the canonical state", async () => {
  const { recoverStaleApprovalClaims } = require("../utils/community-admin-api").__test;
  let captured;
  const db = { collection: () => ({ updateMany: async (filter, update) => { captured = { filter, update }; return { modifiedCount: 2 }; } }) };
  assert.equal(await recoverStaleApprovalClaims(db, new Date("2026-08-10T05:00:00.000Z")), 2);
  assert.equal(captured.filter.status, "executing");
  assert.equal(captured.update.$set.status, "reconciliation_required");
  const api = read("utils/community-admin-api.js");
  assert.match(api, /\$eq:\s*\["\$outcome",\s*"failed"\]/);
  assert.doesNotMatch(api, /\$eq:\s*\["\$outcome",\s*"error"\]/);
});

test("Admin V4 revokes canonical and transitional sessions consistently", () => {
  const api = read("utils/community-admin-api.js");
  assert.match(api, /db\.collection\(["']authSessions["']\)\.updateMany/);
  assert.match(api, /db\.collection\(["']sessions["']\)\.updateMany/);
  assert.match(api, /tokenVersion/);
  const targeted = api.slice(api.indexOf('if (["user:status"'), api.indexOf('if (["report:resolve"'));
  assert.match(targeted, /authSessions[\s\S]*userId:\s*\{\s*\$in:\s*\[targetId,\s*String\(targetId\)\]/,
    "targeted revocation must invalidate the canonical auth session store");
  assert.match(targeted, /sessions[\s\S]*userId:\s*\{\s*\$in:\s*\[targetId,\s*String\(targetId\)\]/,
    "transitional session records must be ended during the same operation");
  assert.match(targeted, /tokenVersion/);
});

test("Admin V4 role editor preserves the target user's current built-in and custom roles", () => {
  const client = read("community-admin.js");
  assert.match(client, /currentRoles/);
  assert.match(client, /normalizedCurrentRoles\.(?:includes|has)\(role\)/);
  assert.match(client, /checked/);
  assert.match(client, /custom:/);
  assert.match(client, /data-user-roles=/);
  assert.match(client, /action\.dataset\.userRoles/);
  assert.match(client, /confirmRoleChange/);
  assert.match(client, /data-admin-role-diff/);
});

test("Admin V4 reports provider and job truth without equating configuration to execution", () => {
  const api = read("utils/community-admin-api.js");
  const client = read("community-admin.js");

  for (const state of ["policy_recorded", "approved_waiting_adapter", "executed"]) {
    assert.match(`${api}\n${client}`, new RegExp(state));
  }
  assert.match(api, /connected:\s*Boolean|connected:\s*envReady/);
  assert.match(api, /affected:\s*0/);
  assert.match(client, /adapterStatus|executionState|approved_waiting_adapter|policy_recorded/);
  assert.doesNotMatch(client, /configured\s*\?\s*["']Đã thực thi/);
});

test("Admin V4 exposes operations, incident, integrations, rights and finance workspaces", () => {
  const client = read("community-admin.js");
  const api = read("utils/community-admin-api.js");
  const combined = `${client}\n${api}`;
  for (const marker of [
    "Operations", "Incident", "Integrations", "Copyright", "Finance",
    "Context Inspector", "Universal Job", "Live", "Delayed", "Stale"
  ]) assert.match(combined, new RegExp(marker, "i"), marker);
  assert.match(client, /data-admin-inspect/);
  assert.match(client, /data-admin-save-view/);
  assert.match(client, /aria-keyshortcuts=["']Control\+K["']/);
});

test("Admin V4 remains a readable one-screen command center on desktop and mobile", () => {
  const css = read("community-admin.css");
  assert.match(css, /100dvh/);
  assert.match(css, /height:\s*100%;[\s\S]{0,80}max-height:\s*100dvh/);
  assert.match(css, /overflow:\s*hidden/);
  assert.match(css, /hh-admin-context-inspector/);
  assert.match(css, /hh-admin-job-tray/);
  assert.match(css, /@media\s*\(max-width:\s*375px\)/);
  assert.match(css, /min-height:\s*(?:40|4[1-9]|[5-9]\d)px/);
  assert.match(css, /font-size:\s*(?:12|13|14|15|16)px/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("the legacy script-level Admin Panel cannot mount beside Admin V4", () => {
  const shell = read("script.js");
  assert.doesNotMatch(shell, /adminPanelMarkup|data-admin-panel|loadAdminPanelData|bindAdminPanel/);
  assert.match(shell, /HHCommunityAdmin/);
});
