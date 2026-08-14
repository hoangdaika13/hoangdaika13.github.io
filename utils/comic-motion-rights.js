"use strict";

const { createHash } = require("node:crypto");

const RIGHTS_STATUSES = Object.freeze(["allowed", "manual-review", "denied", "unknown"]);
const SAFE_LICENSES = new Set([
  "CC0-1.0", "CC-BY-2.0", "CC-BY-2.5", "CC-BY-3.0", "CC-BY-4.0",
  "CC-BY-SA-3.0", "CC-BY-SA-4.0"
]);

function text(value, max = 500) {
  return String(value ?? "").trim().replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").slice(0, max);
}

function normalizeLicenseCode(value) {
  const source = text(value, 80).toUpperCase().replace(/_/g, "-").replace(/\s+/g, "-");
  if (!source) return "UNKNOWN";
  if (["CC0", "CC-0", "CC0-1", "CC0-1.0"].includes(source)) return "CC0-1.0";
  const match = source.match(/^CC-?(BY(?:-NC)?(?:-ND)?(?:-SA)?)-(\d(?:\.\d)?)$/);
  if (match) return `CC-${match[1]}-${match[2]}`;
  if (/PUBLIC-?DOMAIN|PDM/.test(source)) return "PUBLIC-DOMAIN-MARK";
  if (/ALL-?RIGHTS-?RESERVED|ARR/.test(source)) return "ALL-RIGHTS-RESERVED";
  if (source === "UNLICENSE") return "UNLICENSE";
  return source.slice(0, 80);
}

function sanitizeRights(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const licenseCode = normalizeLicenseCode(source.licenseCode || source.license || source.code);
  const reviewed = source.reviewStatus === "approved" || source.status === "allowed";
  return {
    status: RIGHTS_STATUSES.includes(source.status) ? source.status : "unknown",
    licenseCode,
    licenseVersion: text(source.licenseVersion || licenseCode.match(/\d(?:\.\d)?$/)?.[0], 20),
    licenseUrl: /^https:\/\//i.test(text(source.licenseUrl, 600)) ? text(source.licenseUrl, 600) : "",
    sourceUrl: /^https:\/\//i.test(text(source.sourceUrl, 900)) ? text(source.sourceUrl, 900) : "",
    author: text(source.author, 240),
    artist: text(source.artist, 240),
    translator: text(source.translator, 240),
    scanlationGroup: text(source.scanlationGroup, 240),
    commercialUseAllowed: source.commercialUseAllowed === true,
    derivativesAllowed: source.derivativesAllowed === true,
    redistributionAllowed: source.redistributionAllowed === true,
    territory: text(source.territory || "worldwide", 100),
    attributionText: text(source.attributionText, 2000),
    evidenceId: text(source.evidenceId, 160),
    evidenceUrl: /^https:\/\//i.test(text(source.evidenceUrl, 900)) ? text(source.evidenceUrl, 900) : "",
    evidenceHash: /^[a-f0-9]{64}$/i.test(text(source.evidenceHash, 80)) ? text(source.evidenceHash, 80).toLowerCase() : "",
    evidenceCapturedAt: source.evidenceCapturedAt ? new Date(source.evidenceCapturedAt) : null,
    reviewerId: text(source.reviewerId, 160),
    reviewStatus: text(source.reviewStatus || (reviewed ? "approved" : "unreviewed"), 40).toLowerCase(),
    reviewedAt: source.reviewedAt ? new Date(source.reviewedAt) : null,
    revokedAt: source.revokedAt ? new Date(source.revokedAt) : null,
    ownershipAttestedAt: source.ownershipAttestedAt ? new Date(source.ownershipAttestedAt) : null,
    ownershipEvidenceId: text(source.ownershipEvidenceId, 160)
  };
}

function evaluateRights(input = {}, options = {}) {
  const rights = sanitizeRights(input);
  const provider = text(options.provider || input.provider, 40).toLowerCase();
  const sourceType = text(options.sourceType || input.sourceType, 60).toLowerCase();
  const commercialMode = options.commercialMode !== false;
  const reasons = [];
  let status = "manual-review";
  let shareAlikeRequired = false;

  if (rights.revokedAt) {
    return { ...rights, status: "denied", reasonCode: "RIGHTS_REVOKED", reasons: ["Quyền sử dụng đã bị thu hồi."], shareAlikeRequired: false };
  }
  if (["otruyen", "mangadex"].includes(provider)) {
    const explicitlyApproved = options.trustedReview === true && rights.reviewStatus === "approved" && rights.evidenceHash && rights.derivativesAllowed;
    if (!explicitlyApproved) {
      return { ...rights, status: "manual-review", reasonCode: "PROVIDER_REQUIRES_EVIDENCE", reasons: ["Quyền đọc từ nhà cung cấp không đồng nghĩa quyền chuyển thể video."], shareAlikeRequired: false };
    }
  }
  if (["owned-upload", "imported", "local-cbz", "local-zip"].includes(sourceType)) {
    const owned = Boolean(rights.ownershipAttestedAt && rights.ownershipEvidenceId && rights.derivativesAllowed);
    if (!owned && options.trustedReview !== true) {
      return { ...rights, status: "manual-review", reasonCode: "OWNERSHIP_EVIDENCE_REQUIRED", reasons: ["Cần lưu xác nhận sở hữu và mã bằng chứng trước khi chuyển thể."], shareAlikeRequired: false };
    }
    if (owned) {
      return { ...rights, status: "allowed", reasonCode: "OWNERSHIP_EVIDENCE_ACCEPTED", reasons: ["Người dùng đã lưu xác nhận sở hữu và mã bằng chứng."], shareAlikeRequired: false };
    }
  }
  if (options.requireEvidence === true && options.trustedReview !== true && !["owned-upload", "imported", "local-cbz", "local-zip"].includes(sourceType)) {
    return { ...rights, status: "manual-review", reasonCode: "RIGHTS_EVIDENCE_NOT_VERIFIED", reasons: ["Giấy phép cần được đối chiếu với bằng chứng nguồn phía máy chủ."], shareAlikeRequired: false };
  }

  const code = rights.licenseCode;
  if (code === "CC0-1.0") {
    status = "allowed";
    reasons.push("CC0 cho phép chuyển thể và sử dụng thương mại.");
  } else if (/^CC-BY-SA-/.test(code)) {
    shareAlikeRequired = true;
    if (!rights.attributionText) reasons.push("Thiếu nội dung ghi công bắt buộc.");
    status = rights.attributionText ? "allowed" : "manual-review";
    reasons.push("Bản phái sinh phải giữ điều kiện ShareAlike tương thích.");
  } else if (/-ND(?:-|$)/.test(code)) {
    status = "denied";
    reasons.push("Giấy phép ND không cho phép tạo tác phẩm phái sinh.");
  } else if (/^CC-BY-NC/.test(code)) {
    status = commercialMode ? "denied" : (rights.attributionText ? "allowed" : "manual-review");
    reasons.push(commercialMode ? "Giấy phép NC không cho phép Creator/Commercial Mode." : "Chỉ được dùng trong chế độ phi thương mại.");
  } else if (/^CC-BY-/.test(code)) {
    status = rights.attributionText ? "allowed" : "manual-review";
    reasons.push(rights.attributionText ? "CC BY cho phép chuyển thể khi ghi công đầy đủ." : "Thiếu nội dung ghi công bắt buộc.");
  } else if (code === "ALL-RIGHTS-RESERVED") {
    status = "denied";
    reasons.push("All Rights Reserved không cấp quyền chuyển thể.");
  } else if (code === "PUBLIC-DOMAIN-MARK") {
    status = rights.reviewStatus === "approved" && rights.evidenceHash ? "allowed" : "manual-review";
    reasons.push("Public Domain Mark cần kiểm tra lãnh thổ và bằng chứng nguồn.");
  } else if (code === "UNLICENSE") {
    status = rights.reviewStatus === "approved" && rights.evidenceHash && rights.derivativesAllowed ? "allowed" : "manual-review";
    reasons.push("License của repository không tự động bao phủ asset truyện; cần bằng chứng riêng.");
  } else if (SAFE_LICENSES.has(code)) {
    status = "allowed";
  } else {
    status = "manual-review";
    reasons.push("Giấy phép chưa rõ hoặc chưa được hỗ trợ tự động.");
  }

  if (status === "allowed" && commercialMode && rights.commercialUseAllowed === false && code !== "CC0-1.0") {
    status = "manual-review";
    reasons.push("Bản ghi quyền chưa xác nhận sử dụng thương mại.");
  }
  if (status === "allowed" && rights.derivativesAllowed === false && code !== "CC0-1.0") {
    status = "denied";
    reasons.push("Bản ghi quyền không cho phép tác phẩm phái sinh.");
  }
  return {
    ...rights,
    status,
    reasonCode: status === "allowed" ? "RIGHTS_ALLOWED" : status === "denied" ? "RIGHTS_DENIED" : "RIGHTS_REVIEW_REQUIRED",
    reasons,
    shareAlikeRequired
  };
}

function rightsFingerprint(input) {
  const rights = sanitizeRights(input);
  return createHash("sha256").update(JSON.stringify({
    licenseCode: rights.licenseCode,
    sourceUrl: rights.sourceUrl,
    attributionText: rights.attributionText,
    evidenceHash: rights.evidenceHash,
    reviewStatus: rights.reviewStatus,
    revokedAt: rights.revokedAt?.toISOString() || ""
  })).digest("hex");
}

function assertRightsAllowed(input, options = {}) {
  const result = evaluateRights(input, options);
  if (result.status !== "allowed") {
    const error = new Error(result.reasons[0] || "Nội dung chưa đủ quyền để tạo Comic Motion.");
    error.statusCode = result.status === "denied" ? 403 : 409;
    error.code = result.status === "denied" ? "COMIC_RIGHTS_DENIED" : "COMIC_RIGHTS_REVIEW_REQUIRED";
    error.rights = result;
    throw error;
  }
  return result;
}

module.exports = {
  RIGHTS_STATUSES,
  SAFE_LICENSES,
  normalizeLicenseCode,
  sanitizeRights,
  evaluateRights,
  rightsFingerprint,
  assertRightsAllowed
};
