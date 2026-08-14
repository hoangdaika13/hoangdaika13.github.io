"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");

const {
  approvedManualRecord,
  canonicalLicenseUrl,
  trustedApprovalForRecord,
  validateManualApproval
} = require("../utils/comic-motion-rights-admin");

const evidence = {
  licenseCode: "CC-BY-4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  sourceUrl: "https://creator.example/comic/episode-1",
  evidenceUrl: "https://creator.example/rights/episode-1.json",
  evidenceId: "rights-episode-1",
  evidenceHash: "a".repeat(64),
  author: "Creator",
  attributionText: "Comic by Creator · CC BY 4.0",
  commercialUseAllowed: true,
  derivativesAllowed: true,
  redistributionAllowed: true,
  territory: "worldwide"
};

test("manual approval accepts a complete CC BY evidence record and creates an audited decision hash", () => {
  const approved = approvedManualRecord({
    _id: "rights-1",
    ownerId: "owner-1",
    seriesId: "series-1",
    chapterId: "chapter-1",
    provider: "otruyen"
  }, evidence, "admin-1", new Date("2026-08-14T00:00:00.000Z"));
  assert.equal(approved.status, "allowed");
  assert.equal(approved.reviewStatus, "approved");
  assert.equal(approved.reviewMethod, "manual-admin-evidence");
  assert.match(approved.decisionHash, /^[a-f0-9]{64}$/);
});

test("manual approval rejects unsafe licenses, noncanonical URLs and missing derivative rights", () => {
  const unsafe = validateManualApproval({
    ...evidence,
    licenseCode: "CC-BY-NC-ND-4.0",
    licenseUrl: "https://example.com/not-a-license",
    derivativesAllowed: false
  });
  assert.equal(unsafe.valid, false);
  assert.ok(unsafe.errors.some((item) => item.includes("không cho phép")));
  assert.ok(unsafe.errors.some((item) => item.includes("không khớp")));
  assert.ok(unsafe.errors.some((item) => item.includes("phái sinh")));
  assert.equal(canonicalLicenseUrl("CC-BY-4.0", "https://creativecommons.org/licenses/by/4.0/"), "https://creativecommons.org/licenses/by/4.0/");
});

test("trusted sync only approves records present in the server-owned catalog", () => {
  const trusted = trustedApprovalForRecord({ _id: "r1", ownerId: "o1", seriesId: "github-open:pepper-and-carrot", chapterId: "c1" });
  assert.equal(trusted.status, "allowed");
  assert.equal(trusted.reviewMethod, "server-trusted-catalog");
  assert.equal(trusted.evidenceUrl, "https://www.peppercarrot.com/en/about/index.html");
  const evidencePath = path.resolve(__dirname, "..", trusted.evidenceFile);
  assert.equal(createHash("sha256").update(fs.readFileSync(evidencePath)).digest("hex"), trusted.evidenceHash);
  assert.equal(trustedApprovalForRecord({ seriesId: "otruyen:unknown" }), null);
});

test("Admin UI and API expose a real rights console without a blanket approval path", () => {
  const root = path.resolve(__dirname, "..");
  const client = fs.readFileSync(path.join(root, "community-admin.js"), "utf8");
  const api = fs.readFileSync(path.join(root, "utils", "community-admin-api.js"), "utf8");
  assert.match(client, /Comic Rights Review Console/);
  assert.match(client, /data-admin-rights-trusted-sync/);
  assert.match(client, /Duyệt có bằng chứng/);
  assert.match(api, /view === "comic-rights"/);
  assert.match(api, /comic-rights:trusted-sync/);
  assert.match(api, /reviewStatus:\s*\{\s*\$in:\s*\["submitted",\s*"unreviewed"\]\s*\}/);
  assert.match(api, /comic-rights:approve/);
  assert.doesNotMatch(api, /comic-rights:approve-all/);
});
