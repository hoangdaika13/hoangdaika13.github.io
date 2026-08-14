"use strict";

const { createHash } = require("node:crypto");
const { clean } = require("./platform");
const { evaluateRights, normalizeLicenseCode, sanitizeRights } = require("./comic-motion-rights");
const { trustedRightsForSeries } = require("./comic-motion-trusted-catalog");

const MANUALLY_APPROVABLE_LICENSES = new Set([
  "CC0-1.0",
  "CC-BY-2.0",
  "CC-BY-2.5",
  "CC-BY-3.0",
  "CC-BY-4.0",
  "CC-BY-SA-3.0",
  "CC-BY-SA-4.0",
  "OWNED"
]);

function safeHttps(value, max = 900) {
  try {
    const url = new URL(clean(value, max));
    if (url.protocol !== "https:" || url.username || url.password) return "";
    url.hash = "";
    return url.href.slice(0, max);
  } catch {
    return "";
  }
}

function expectedCreativeCommonsPath(code) {
  if (code === "CC0-1.0") return "/publicdomain/zero/1.0/";
  const match = code.match(/^CC-(BY(?:-SA)?)-(\d\.\d)$/);
  return match ? `/licenses/${match[1].toLowerCase()}/${match[2]}/` : "";
}

function canonicalLicenseUrl(code, value) {
  const url = safeHttps(value, 600);
  if (code === "OWNED") return url;
  if (!url) return "";
  const parsed = new URL(url);
  const expectedPath = expectedCreativeCommonsPath(code);
  return parsed.hostname.toLowerCase() === "creativecommons.org" && parsed.pathname === expectedPath ? parsed.href : "";
}

function validateManualApproval(input = {}) {
  const code = normalizeLicenseCode(input.licenseCode);
  const errors = [];
  const sourceUrl = safeHttps(input.sourceUrl, 900);
  const evidenceUrl = safeHttps(input.evidenceUrl, 900);
  const licenseUrl = canonicalLicenseUrl(code, input.licenseUrl);
  const evidenceHash = /^[a-f0-9]{64}$/i.test(clean(input.evidenceHash, 80)) ? clean(input.evidenceHash, 80).toLowerCase() : "";
  const evidenceId = clean(input.evidenceId, 160);
  const attributionText = clean(input.attributionText, 2000);
  const ownershipEvidenceId = clean(input.ownershipEvidenceId || input.evidenceId, 160);

  if (!MANUALLY_APPROVABLE_LICENSES.has(code)) errors.push("Giấy phép không cho phép phê duyệt chuyển thể/thương mại.");
  if (!sourceUrl) errors.push("Thiếu URL nguồn HTTPS hợp lệ.");
  if (!evidenceUrl) errors.push("Thiếu URL bằng chứng HTTPS hợp lệ.");
  if (code !== "OWNED" && !licenseUrl) errors.push("URL giấy phép không khớp mã Creative Commons.");
  if (!evidenceHash) errors.push("Thiếu SHA-256 của bằng chứng đã lưu.");
  if (!evidenceId) errors.push("Thiếu mã hồ sơ bằng chứng.");
  if (code !== "CC0-1.0" && code !== "OWNED" && !attributionText) errors.push("Thiếu nội dung ghi công bắt buộc.");
  if (code === "OWNED" && !ownershipEvidenceId) errors.push("Thiếu mã bằng chứng sở hữu.");
  if (input.commercialUseAllowed !== true) errors.push("Chưa xác nhận quyền sử dụng thương mại.");
  if (input.derivativesAllowed !== true) errors.push("Chưa xác nhận quyền tạo tác phẩm phái sinh.");
  if (clean(input.territory || "worldwide", 100).toLowerCase() !== "worldwide") errors.push("Comic Motion chỉ duyệt tự động cho phạm vi worldwide.");

  return {
    valid: errors.length === 0,
    errors,
    normalized: {
      licenseCode: code,
      licenseUrl,
      sourceUrl,
      evidenceUrl,
      evidenceHash,
      evidenceId,
      author: clean(input.author, 240),
      artist: clean(input.artist, 240),
      attributionText,
      ownershipEvidenceId,
      commercialUseAllowed: input.commercialUseAllowed === true,
      derivativesAllowed: input.derivativesAllowed === true,
      redistributionAllowed: input.redistributionAllowed === true,
      territory: "worldwide"
    }
  };
}

function approvalDecisionHash(record, normalized, reviewerId, reviewedAt) {
  return createHash("sha256").update(JSON.stringify({
    recordId: String(record?._id || ""),
    ownerId: String(record?.ownerId || ""),
    seriesId: String(record?.seriesId || ""),
    chapterId: String(record?.chapterId || ""),
    evidenceHash: normalized.evidenceHash,
    licenseCode: normalized.licenseCode,
    reviewerId: String(reviewerId || ""),
    reviewedAt: new Date(reviewedAt).toISOString()
  })).digest("hex");
}

function approvedManualRecord(record = {}, input = {}, reviewerId = "", now = new Date()) {
  const validation = validateManualApproval(input);
  if (!validation.valid) {
    const error = new Error(validation.errors[0]);
    error.statusCode = 400;
    error.code = "COMIC_RIGHTS_EVIDENCE_INVALID";
    error.validationErrors = validation.errors;
    throw error;
  }
  const normalized = validation.normalized;
  const ownership = normalized.licenseCode === "OWNED" ? {
    ownershipAttestedAt: now,
    ownershipEvidenceId: normalized.ownershipEvidenceId
  } : {};
  const verdict = evaluateRights({
    ...sanitizeRights(record),
    ...normalized,
    ...ownership,
    status: "allowed",
    reviewStatus: "approved",
    reviewerId: String(reviewerId),
    reviewedAt: now,
    revokedAt: null
  }, {
    provider: record.provider,
    sourceType: normalized.licenseCode === "OWNED" ? "owned-upload" : (record.sourceType || record.provider),
    commercialMode: true,
    requireEvidence: true,
    trustedReview: true
  });
  if (verdict.status !== "allowed") {
    const error = new Error(verdict.reasons?.[0] || "Bằng chứng chưa đủ để duyệt Comic Motion.");
    error.statusCode = 409;
    error.code = "COMIC_RIGHTS_REVIEW_REQUIRED";
    throw error;
  }
  return {
    ...verdict,
    reviewStatus: "approved",
    reviewerId: String(reviewerId),
    reviewedAt: now,
    evidenceCapturedAt: record.evidenceCapturedAt || now,
    reviewMethod: "manual-admin-evidence",
    decisionHash: approvalDecisionHash(record, normalized, reviewerId, now)
  };
}

function trustedApprovalForRecord(record = {}, reviewerId = "hh-trusted-catalog", now = new Date()) {
  const trusted = trustedRightsForSeries(record.seriesId);
  if (!trusted) return null;
  return {
    ...trusted,
    status: "allowed",
    reviewStatus: "approved",
    reviewerId: trusted.reviewerId || reviewerId,
    reviewedAt: trusted.reviewedAt || now,
    reviewMethod: "server-trusted-catalog",
    decisionHash: approvalDecisionHash(record, trusted, trusted.reviewerId || reviewerId, trusted.reviewedAt || now),
    revokedAt: null
  };
}

function publicRightsRecord(record = {}) {
  return {
    id: String(record._id || ""),
    ownerId: clean(record.ownerId, 120),
    workspaceId: clean(record.workspaceId, 180),
    seriesId: clean(record.seriesId, 180),
    chapterId: clean(record.chapterId, 180),
    provider: clean(record.provider, 80),
    status: clean(record.status || "unknown", 40),
    reviewStatus: clean(record.reviewStatus || "unreviewed", 40),
    reasonCode: clean(record.reasonCode, 100),
    reasons: (Array.isArray(record.reasons) ? record.reasons : []).map((item) => clean(item, 400)).filter(Boolean).slice(0, 10),
    licenseCode: normalizeLicenseCode(record.licenseCode),
    licenseUrl: safeHttps(record.licenseUrl, 600),
    sourceUrl: safeHttps(record.sourceUrl, 900),
    evidenceUrl: safeHttps(record.evidenceUrl, 900),
    evidenceId: clean(record.evidenceId, 160),
    evidenceHash: /^[a-f0-9]{64}$/i.test(String(record.evidenceHash || "")) ? String(record.evidenceHash).toLowerCase() : "",
    author: clean(record.author, 240),
    artist: clean(record.artist, 240),
    attributionText: clean(record.attributionText, 2000),
    commercialUseAllowed: record.commercialUseAllowed === true,
    derivativesAllowed: record.derivativesAllowed === true,
    redistributionAllowed: record.redistributionAllowed === true,
    territory: clean(record.territory || "", 100),
    shareAlikeRequired: record.shareAlikeRequired === true,
    reviewMethod: clean(record.reviewMethod, 80),
    reviewerId: clean(record.reviewerId, 160),
    decisionHash: /^[a-f0-9]{64}$/i.test(String(record.decisionHash || "")) ? String(record.decisionHash).toLowerCase() : "",
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
    reviewedAt: record.reviewedAt || null,
    revokedAt: record.revokedAt || null,
    trustedCatalogEligible: Boolean(trustedRightsForSeries(record.seriesId))
  };
}

module.exports = {
  MANUALLY_APPROVABLE_LICENSES,
  safeHttps,
  canonicalLicenseUrl,
  validateManualApproval,
  approvedManualRecord,
  trustedApprovalForRecord,
  publicRightsRecord
};
