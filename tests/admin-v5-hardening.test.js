const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("audit projection preserves dates and masks network metadata by default", () => {
  const { auditRecordHash, presentAdminAuditRecord } = require("../utils/community-admin");
  const createdAt = new Date("2026-08-11T00:00:00.000Z");
  const record = {
    _id: "audit-1",
    action: "user:status",
    previousHash: "genesis",
    integrityVersion: "sha256-chain-v2",
    ip: "203.0.113.42",
    userAgent: "Mozilla/5.0 Chrome/140.0",
    createdAt
  };
  record.recordHash = auditRecordHash(record);
  const output = presentAdminAuditRecord(record);
  assert.equal(output.createdAt, createdAt);
  assert.equal(output.ip, "203.0.*.*");
  assert.equal(output.userAgent, "Chrome · metadata hidden");
  assert.equal(output.networkMetadataMasked, true);
  assert.equal(output._id, undefined);
});

test("tamper-evident verifier detects changed records and broken links truthfully", () => {
  const { auditRecordHash, verifyAuditChain } = require("../utils/community-admin");
  const first = { action: "first", previousHash: "genesis", integrityVersion: "sha256-chain-v2", createdAt: new Date("2026-08-11T00:00:00.000Z") };
  first.recordHash = auditRecordHash(first);
  const second = { action: "second", previousHash: first.recordHash, integrityVersion: "sha256-chain-v2", createdAt: new Date("2026-08-11T00:01:00.000Z") };
  second.recordHash = auditRecordHash(second);
  const valid = verifyAuditChain([first, second], { total: 2 });
  assert.equal(valid.valid, true);
  assert.equal(valid.completeToHead, true);
  assert.equal(valid.immutable, false);
  assert.equal(valid.externalAnchor, false);

  const tampered = verifyAuditChain([first, { ...second, action: "changed" }], { total: 3 });
  assert.equal(tampered.valid, false);
  assert.equal(tampered.completeToHead, false);
  assert.ok(tampered.issues.some((issue) => issue.type === "record-hash"));
});

test("Admin V5 claims critical execution atomically and exposes honest integrity", () => {
  const api = read("utils/community-admin-api.js");
  const client = read("community-admin.js");
  const css = read("community-admin.css");
  assert.match(api, /findOneAndUpdate\([\s\S]*?status:\s*"executing"[\s\S]*?executionClaim/);
  assert.match(api, /"executionClaim\.claimId":\s*claimId/);
  assert.match(api, /idempotentReplay:\s*true/);
  assert.match(api, /view === "audit-integrity"/);
  assert.match(api, /presentAdminAuditRecord/);
  assert.match(api, /\$in:\s*\["\$outcome",\s*\["error",\s*"failed"\]\]/);
  assert.match(client, /beginFormSubmission/);
  assert.match(client, /Tamper-evident Audit/);
  assert.match(client, /Atomic approval claim/);
  assert.doesNotMatch(client, /Immutable Audit/);
  assert.match(css, /hh-admin-safety-strip/);
  assert.match(css, /hh-admin-audit-integrity\.critical/);
});
