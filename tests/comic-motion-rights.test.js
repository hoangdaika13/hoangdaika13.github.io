"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { evaluateRights, normalizeLicenseCode, assertRightsAllowed } = require("../utils/comic-motion-rights");

const granted = (licenseCode, extra = {}) => ({
  licenseCode, attributionText: "Author · source · license", derivativesAllowed: true,
  commercialUseAllowed: true, redistributionAllowed: true, ...extra
});

test("CC0, CC BY and CC BY-SA pass with correct obligations", () => {
  assert.equal(evaluateRights(granted("CC0"), {}).status, "allowed");
  assert.equal(evaluateRights(granted("CC BY 4.0"), {}).status, "allowed");
  const shareAlike = evaluateRights(granted("CC-BY-SA-4.0"), {});
  assert.equal(shareAlike.status, "allowed");
  assert.equal(shareAlike.shareAlikeRequired, true);
  assert.equal(normalizeLicenseCode("cc by 4.0"), "CC-BY-4.0");
});

test("ND is denied, unknown requires review and NC is denied commercially", () => {
  assert.equal(evaluateRights(granted("CC-BY-ND-4.0"), {}).status, "denied");
  assert.equal(evaluateRights(granted("CC-BY-NC-ND-4.0"), { commercialMode: false }).status, "denied");
  assert.equal(evaluateRights(granted("CC-BY-NC-4.0"), { commercialMode: true }).status, "denied");
  assert.equal(evaluateRights({ licenseCode: "UNKNOWN" }, {}).status, "manual-review");
  assert.throws(() => assertRightsAllowed({ licenseCode: "ALL RIGHTS RESERVED" }), (error) => error.code === "COMIC_RIGHTS_DENIED");
});

test("OTruyen and MangaDex never inherit adaptation permission from reading access", () => {
  for (const provider of ["otruyen", "mangadex"]) {
    const result = evaluateRights(granted("CC-BY-4.0"), { provider, sourceType: provider });
    assert.equal(result.status, "manual-review", provider);
    assert.equal(result.reasonCode, "PROVIDER_REQUIRES_EVIDENCE");
  }
});

test("revoked rights always stop the pipeline", () => {
  const result = evaluateRights(granted("CC0-1.0", { revokedAt: new Date() }), {});
  assert.equal(result.status, "denied");
  assert.equal(result.reasonCode, "RIGHTS_REVOKED");
});

test("client-claimed open licenses require server-side evidence", () => {
  const untrusted = evaluateRights(granted("CC-BY-4.0"), { provider: "github-open", sourceType: "github-open", requireEvidence: true });
  assert.equal(untrusted.status, "manual-review");
  assert.equal(untrusted.reasonCode, "RIGHTS_EVIDENCE_NOT_VERIFIED");
  const trusted = evaluateRights(granted("CC-BY-4.0", { reviewStatus: "approved", evidenceHash: "a".repeat(64) }), { provider: "github-open", sourceType: "github-open", requireEvidence: true, trustedReview: true });
  assert.equal(trusted.status, "allowed");
});
