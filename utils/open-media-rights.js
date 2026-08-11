(function initHHOpenMediaRights(global) {
  "use strict";

  const VERSION = "2.2.0";
  const AUTO_LICENSE_URLS = Object.freeze({
    "CC0-1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
    "CC-BY-2.5": "https://creativecommons.org/licenses/by/2.5/",
    "CC-BY-3.0": "https://creativecommons.org/licenses/by/3.0/",
    "CC-BY-4.0": "https://creativecommons.org/licenses/by/4.0/",
    "CC-BY-SA-3.0": "https://creativecommons.org/licenses/by-sa/3.0/",
    "CC-BY-SA-4.0": "https://creativecommons.org/licenses/by-sa/4.0/"
  });
  const MANUAL_LICENSE_URLS = Object.freeze({
    "PDM-1.0": "https://creativecommons.org/publicdomain/mark/1.0/",
    "NASA-MEDIA-GUIDELINES": "https://www.nasa.gov/nasa-brand-center/images-and-media/"
  });
  const LICENSE_URLS = Object.freeze({ ...AUTO_LICENSE_URLS, ...MANUAL_LICENSE_URLS });
  const AUTO_ALLOWED_LICENSES = Object.freeze(new Set(Object.keys(AUTO_LICENSE_URLS)));
  const SUPPORTED_LICENSES = Object.freeze(new Set(Object.keys(LICENSE_URLS)));
  const MANUAL_RIGHTS_BASES = Object.freeze(new Set([
    "public-domain-mark",
    "us-government-work",
    "nasa-media-guidelines",
    "custom-license"
  ]));
  const RIGHTS_BASES = Object.freeze(new Set(["cc-license", ...MANUAL_RIGHTS_BASES]));
  const REVIEW_STATUSES = Object.freeze(new Set([
    "discovered",
    "quarantine",
    "review",
    "approved",
    "published",
    "suspended",
    "taken_down",
    "archived"
  ]));
  const LAYER_STATUSES = Object.freeze(new Set(["cleared", "not-applicable", "manual-review", "blocked"]));
  const KIND_PLAYBACK_TYPES = Object.freeze({ film: "video", track: "audio" });
  const REQUIRED_PUBLICATION_TERRITORY = "WORLDWIDE";
  const REQUIRED_LAYERS = Object.freeze({
    film: Object.freeze(["master", "soundtrack", "poster", "subtitles", "privacyPublicity"]),
    track: Object.freeze(["composition", "performance", "masterRecording", "artwork"])
  });
  const BLOCKED_LICENSE_MARKERS = Object.freeze([
    "-NC",
    "-ND",
    "SAMPLING",
    "EDUCATIONAL",
    "UNKNOWN",
    "ALL-RIGHTS-RESERVED"
  ]);
  const MEDIA_CHECKSUM_SCOPES = Object.freeze(new Set([
    "original-file",
    "stream-derivative",
    "rehosted-file",
    "remote-playback",
    "playback-media-bytes",
    "remote-transcode-bytes",
    "remote-media-bytes"
  ]));
  const SOURCE_AUTHORITIES = Object.freeze(new Set([
    "primary-rights-record",
    "official-project-page",
    "government-rights-advisory"
  ]));
  const TRUSTED_PRIMARY_PROVIDERS = Object.freeze(new Set([
    "Blender Open Movies",
    "Wikimedia Commons"
  ]));
  const STATUS_TRANSITIONS = Object.freeze({
    discovered: Object.freeze(["quarantine", "archived"]),
    quarantine: Object.freeze(["review", "taken_down"]),
    review: Object.freeze(["quarantine", "approved", "suspended", "taken_down"]),
    approved: Object.freeze(["review", "published", "suspended", "taken_down"]),
    published: Object.freeze(["review", "suspended", "taken_down"]),
    suspended: Object.freeze(["review", "published", "taken_down"]),
    taken_down: Object.freeze(["review", "archived"]),
    archived: Object.freeze([])
  });

  function normalizeLicenseCode(value) {
    const raw = String(value || "")
      .trim()
      .toUpperCase()
      .replace(/CREATIVE\s+COMMONS/g, "CC")
      .replace(/PUBLIC\s+DOMAIN\s+MARK/g, "PDM")
      .replace(/[_\s/]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const aliases = {
      "CC-0-1.0": "CC0-1.0",
      "CC-ZERO-1.0": "CC0-1.0",
      "PUBLIC-DOMAIN-MARK-1.0": "PDM-1.0",
      "NASA-MEDIA-USAGE-GUIDELINES": "NASA-MEDIA-GUIDELINES"
    };
    return aliases[raw] || raw;
  }

  // Backwards-compatible: this means a known exact license, not automatic approval.
  function isAllowedLicense(value) {
    const normalized = normalizeLicenseCode(value);
    if (!normalized || BLOCKED_LICENSE_MARKERS.some((marker) => normalized.includes(marker))) return false;
    return SUPPORTED_LICENSES.has(normalized);
  }

  function isAutoApprovableLicense(value) {
    const normalized = normalizeLicenseCode(value);
    if (!normalized || BLOCKED_LICENSE_MARKERS.some((marker) => normalized.includes(marker))) return false;
    return AUTO_ALLOWED_LICENSES.has(normalized);
  }

  function requiresManualReview(rights = {}) {
    const code = normalizeLicenseCode(rights.licenseCode);
    const basis = String(rights.rightsBasis || "").trim().toLowerCase();
    return code === "PDM-1.0" || code === "NASA-MEDIA-GUIDELINES" || MANUAL_RIGHTS_BASES.has(basis);
  }

  function isSafeHttpsUrl(value) {
    try {
      const parsed = new URL(String(value || ""));
      return parsed.protocol === "https:" && !parsed.username && !parsed.password;
    } catch {
      return false;
    }
  }

  function hasCanonicalLicenseUrl(code, value) {
    const expected = LICENSE_URLS[code];
    if (!expected || !isSafeHttpsUrl(value)) return false;
    try {
      const parsed = new URL(String(value));
      return parsed.href === expected && !parsed.search && !parsed.hash;
    } catch {
      return false;
    }
  }

  function isValidDate(value) {
    const text = String(value || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
    const [year, month, day] = text.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return false;
    let today = new Date().toISOString().slice(0, 10);
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit"
      }).formatToParts(new Date());
      const valueOf = (type) => parts.find((part) => part.type === type)?.value || "";
      today = `${valueOf("year")}-${valueOf("month")}-${valueOf("day")}`;
    } catch { /* UTC fallback remains fail-safe. */ }
    return text <= today;
  }

  function isSha256(value) {
    return /^sha256:[a-f0-9]{64}$/i.test(String(value || ""));
  }

  function isMediaChecksum(value) {
    return /^(?:sha1:[a-f0-9]{40}|sha256:[a-f0-9]{64})$/i.test(String(value || ""));
  }

  function mediaChecksumAlgorithm(value) {
    const match = /^(sha1|sha256):[a-f0-9]+$/i.exec(String(value || ""));
    return match ? match[1].toLowerCase() : "";
  }

  function normalizeTerritory(value) {
    return String(value || "").trim().toUpperCase();
  }

  function isValidTerritory(value) {
    return value === "WORLDWIDE" || /^[A-Z]{2}(?:-[A-Z0-9]{1,3})?$/.test(value);
  }

  function territoryEligible(territories, requestedTerritory = "WORLDWIDE") {
    const requested = normalizeTerritory(requestedTerritory) || "WORLDWIDE";
    const normalized = Array.isArray(territories) ? territories.map(normalizeTerritory) : [];
    if (normalized.includes("WORLDWIDE")) return true;
    if (requested === "WORLDWIDE") return false;
    return normalized.includes(requested);
  }

  function canTransitionStatus(from, to) {
    const current = String(from || "").trim();
    const next = String(to || "").trim();
    return Boolean(STATUS_TRANSITIONS[current]?.includes(next));
  }

  function validateItem(item) {
    const errors = [];
    if (!item || typeof item !== "object" || Array.isArray(item)) return { ok: false, errors: ["invalid-item"] };

    const rights = item.rights && typeof item.rights === "object" ? item.rights : {};
    const source = item.source && typeof item.source === "object" ? item.source : {};
    const playback = item.playback && typeof item.playback === "object" ? item.playback : {};
    const licenseCode = normalizeLicenseCode(rights.licenseCode);
    const expectedPlaybackType = KIND_PLAYBACK_TYPES[item.kind];

    if (!String(item.id || "").trim()) errors.push("missing-id");
    if (!String(item.title || "").trim()) errors.push("missing-title");
    if (!String(item.creator || "").trim()) errors.push("missing-creator");
    if (!expectedPlaybackType) errors.push("invalid-kind");
    if (!isSafeHttpsUrl(source.landingUrl)) errors.push("invalid-source-url");
    if (!isAllowedLicense(licenseCode)) errors.push("license-not-allowed");
    if (String(rights.licenseCode || "").trim() !== licenseCode) errors.push("noncanonical-license-code");
    if (!hasCanonicalLicenseUrl(licenseCode, rights.licenseUrl)) errors.push("license-url-mismatch");
    if (!String(rights.attributionText || "").trim()) errors.push("missing-attribution");
    if (!isValidDate(rights.verifiedAt)) errors.push("invalid-verification-date");
    if (rights.commercialAllowed !== true) errors.push("commercial-use-not-confirmed");
    if (rights.derivativesAllowed !== true) errors.push("derivatives-not-confirmed");
    if (!isSafeHttpsUrl(playback.url)) errors.push("invalid-playback-url");
    if (!expectedPlaybackType || playback.type !== expectedPlaybackType) errors.push("playback-kind-mismatch");

    return { ok: errors.length === 0, errors, licenseCode };
  }

  function validateLayer(layer, key) {
    const errors = [];
    if (!layer || typeof layer !== "object" || Array.isArray(layer)) return [`missing-rights-layer:${key}`];
    const status = String(layer.status || "").trim();
    if (!LAYER_STATUSES.has(status)) errors.push(`invalid-layer-status:${key}`);
    if (status === "blocked" || status === "manual-review") errors.push(`uncleared-rights-layer:${key}`);
    if (status === "not-applicable" && String(layer.reason || "").trim().length < 3) errors.push(`missing-layer-reason:${key}`);
    if (status === "cleared") {
      const basis = String(layer.rightsBasis || "").trim().toLowerCase();
      if (!RIGHTS_BASES.has(basis)) errors.push(`invalid-layer-basis:${key}`);
      if (basis === "cc-license") {
        const code = normalizeLicenseCode(layer.licenseCode);
        if (!isAutoApprovableLicense(code)) errors.push(`layer-license-not-auto-allowed:${key}`);
        if (String(layer.licenseCode || "").trim() !== code) errors.push(`noncanonical-layer-license:${key}`);
        if (!hasCanonicalLicenseUrl(code, layer.licenseUrl)) errors.push(`layer-license-url-mismatch:${key}`);
      }
      if (!String(layer.attributionText || "").trim()) errors.push(`missing-layer-attribution:${key}`);
      if (!String(layer.evidenceRef || "").trim()) errors.push(`missing-layer-evidence:${key}`);
    }
    return errors;
  }

  function validateGovernanceItem(item, options = {}) {
    const base = validateItem(item);
    let errors = [...base.errors];
    if (!item || typeof item !== "object" || Array.isArray(item)) return { ok: false, errors };
    const rights = item.rights && typeof item.rights === "object" ? item.rights : {};
    const source = item.source && typeof item.source === "object" ? item.source : {};
    const status = String(rights.reviewStatus || "").trim();
    const basis = String(rights.rightsBasis || "").trim().toLowerCase();
    const customLicense = basis === "custom-license";
    const territories = Array.isArray(rights.territories) ? rights.territories.map(normalizeTerritory) : [];
    const requiredLayers = REQUIRED_LAYERS[item.kind] || [];
    const evidence = rights.evidence && typeof rights.evidence === "object" ? rights.evidence : {};

    if (customLicense) {
      errors = errors.filter((error) => !["license-not-allowed", "license-url-mismatch"].includes(error));
      if (String(rights.licenseCode || "").trim() !== "CUSTOM-LICENSE") errors.push("invalid-custom-license-code");
      if (!isSafeHttpsUrl(rights.licenseUrl)) errors.push("invalid-custom-license-url");
    }
    if (!REVIEW_STATUSES.has(status)) errors.push("invalid-review-status");
    if (!RIGHTS_BASES.has(basis)) errors.push("invalid-rights-basis");
    if (item.kind === "film" && basis === "public-domain-mark") errors.push("film-public-domain-mark-quarantine-only");
    if (!String(source.provider || "").trim()) errors.push("missing-source-provider");
    if (!String(source.itemId || "").trim()) errors.push("missing-source-item-id");
    if (!String(rights.jurisdiction || "").trim()) errors.push("missing-jurisdiction");
    if (!territories.length || territories.some((entry) => !isValidTerritory(entry)) || new Set(territories).size !== territories.length) {
      errors.push("invalid-territories");
    }
    if (rights.streamAllowed !== true) errors.push("streaming-not-cleared");
    if (typeof rights.rehostAllowed !== "boolean") errors.push("missing-rehost-decision");
    if (typeof rights.downloadAllowed !== "boolean") errors.push("missing-download-decision");
    if (item.kind === "track" && typeof rights.syncAllowed !== "boolean") errors.push("missing-sync-decision");
    if (typeof rights.shareAlike !== "boolean") errors.push("missing-sharealike-decision");
    if (/^CC-BY-SA-/.test(base.licenseCode) && rights.shareAlike !== true) errors.push("sharealike-not-preserved");
    if (!String(evidence.sourceRevision || "").trim()) errors.push("missing-source-revision");
    if (!isValidDate(evidence.checkedAt)) errors.push("invalid-evidence-date");
    if (!isSha256(evidence.metadataChecksum)) errors.push("invalid-metadata-checksum");
    const metadataRecord = typeof evidence.metadataRecord === "string"
      ? evidence.metadataRecord.trim()
      : evidence.sourceMetadataSnapshot && typeof evidence.sourceMetadataSnapshot === "object" && !Array.isArray(evidence.sourceMetadataSnapshot)
        ? JSON.stringify(evidence.sourceMetadataSnapshot)
        : "";
    if (!metadataRecord) errors.push("missing-metadata-record");
    if (String(evidence.metadataChecksumAlgorithm || "").toLowerCase().replace(/-/g, "") !== "sha256") errors.push("invalid-metadata-checksum-algorithm");
    if (!String(evidence.metadataChecksumScope || evidence.metadataChecksumSource || "").trim()) errors.push("missing-metadata-checksum-scope");
    if (["verified", "verified-upstream"].includes(evidence.mediaChecksumStatus)) {
      const detectedAlgorithm = mediaChecksumAlgorithm(evidence.mediaChecksum);
      if (!isMediaChecksum(evidence.mediaChecksum)) errors.push("invalid-media-checksum");
      const declaredAlgorithm = String(evidence.mediaChecksumAlgorithm || "").toLowerCase().replace(/-/g, "");
      if (declaredAlgorithm !== detectedAlgorithm) errors.push("media-checksum-algorithm-mismatch");
      if (!String(evidence.mediaChecksumSource || "").trim()) errors.push("invalid-media-checksum-source");
      if (!MEDIA_CHECKSUM_SCOPES.has(String(evidence.checksumScope || evidence.mediaChecksumScope || ""))) errors.push("invalid-media-checksum-scope");
    } else if (evidence.mediaChecksumStatus === "unavailable") {
      if (evidence.mediaChecksum != null && String(evidence.mediaChecksum).trim()) errors.push("unavailable-media-checksum-must-be-empty");
      if (evidence.mediaChecksumAlgorithm != null && String(evidence.mediaChecksumAlgorithm).trim()) errors.push("unavailable-media-algorithm-must-be-empty");
      const unavailableReason = String(evidence.mediaChecksumReason || evidence.mediaChecksumSource || "").trim();
      if (unavailableReason.length < 8) errors.push("missing-media-checksum-unavailable-reason");
      const checksumScope = String(evidence.checksumScope || evidence.mediaChecksumScope || "");
      if (!["remote-playback", "remote-transcode-bytes", "remote-media-bytes"].includes(checksumScope)) errors.push("unavailable-media-must-be-remote-playback");
      if (rights.rehostAllowed !== false || rights.downloadAllowed !== false) errors.push("unfingerprinted-media-cannot-be-rehosted-or-downloaded");
      const sourceAuthority = String(evidence.sourceAuthority || "").trim();
      const manualDecision = rights.manualReview?.decision === "approved";
      const trustedPrimaryRecord = TRUSTED_PRIMARY_PROVIDERS.has(String(source.provider || "")) && isSafeHttpsUrl(source.rightsEvidenceUrl);
      if (!SOURCE_AUTHORITIES.has(sourceAuthority) && !trustedPrimaryRecord && !manualDecision) errors.push("unfingerprinted-media-needs-primary-source-or-review");
    } else {
      errors.push("invalid-media-checksum-status");
    }

    const layers = rights.layers && typeof rights.layers === "object" ? rights.layers : {};
    for (const key of requiredLayers) errors.push(...validateLayer(layers[key], key));

    const manual = requiresManualReview(rights);
    if (manual) {
      const review = rights.manualReview && typeof rights.manualReview === "object" ? rights.manualReview : {};
      if (review.decision !== "approved") errors.push("manual-review-required");
      if (!isValidDate(review.reviewedAt)) errors.push("invalid-manual-review-date");
      if (!String(review.reviewerId || "").trim()) errors.push("missing-manual-reviewer");
      if (!isSha256(review.evidenceChecksum)) errors.push("invalid-manual-review-evidence");
      if (customLicense && !isSha256(review.permissionDocumentChecksum)) errors.push("invalid-custom-permission-document");
    } else if (basis !== "cc-license" || !isAutoApprovableLicense(base.licenseCode)) {
      errors.push("license-not-auto-allowed");
    }

    // The public catalog is one global catalog. A viewer's current country must
    // never relax publication rights: only records cleared WORLDWIDE may ship.
    const publicationTerritory = normalizeTerritory(options.requiredTerritory || REQUIRED_PUBLICATION_TERRITORY);
    if (!territoryEligible(territories, publicationTerritory)) errors.push("territory-not-cleared");
    if (publicationTerritory === REQUIRED_PUBLICATION_TERRITORY && (territories.length !== 1 || territories[0] !== REQUIRED_PUBLICATION_TERRITORY)) {
      errors.push("worldwide-only-publication-required");
    }

    return {
      ok: errors.length === 0,
      errors: [...new Set(errors)],
      licenseCode: base.licenseCode,
      status,
      publicationTerritory,
      manualReviewRequired: manual,
      publishable: errors.length === 0 && ["approved", "published"].includes(status),
      publiclyAvailable: errors.length === 0 && status === "published"
    };
  }

  function publicRightsRecord(item, options = {}) {
    const assessment = validateGovernanceItem(item, options);
    const rights = item?.rights || {};
    const evidence = rights.evidence || {};
    const layerKeys = REQUIRED_LAYERS[item?.kind] || [];
    return Object.freeze({
      id: String(item?.id || ""),
      kind: String(item?.kind || ""),
      title: String(item?.title || ""),
      creator: String(item?.creator || ""),
      sourceUrl: String(item?.source?.landingUrl || ""),
      licenseCode: assessment.licenseCode,
      licenseUrl: String(rights.licenseUrl || ""),
      attributionText: String(rights.attributionText || ""),
      rightsBasis: String(rights.rightsBasis || ""),
      jurisdiction: String(rights.jurisdiction || ""),
      territories: Array.isArray(rights.territories) ? [...rights.territories] : [],
      permissions: {
        stream: rights.streamAllowed === true,
        rehost: rights.rehostAllowed === true,
        download: rights.downloadAllowed === true,
        sync: rights.syncAllowed === true
      },
      layers: layerKeys.map((key) => ({ key, status: String(rights.layers?.[key]?.status || "missing") })),
      evidence: {
        checkedAt: String(evidence.checkedAt || ""),
        sourceRevision: String(evidence.sourceRevision || ""),
        metadataChecksum: String(evidence.metadataChecksum || ""),
        mediaChecksumStatus: String(evidence.mediaChecksumStatus || ""),
        mediaChecksum: evidence.mediaChecksum == null ? null : String(evidence.mediaChecksum),
        mediaChecksumAlgorithm: evidence.mediaChecksumAlgorithm == null ? null : String(evidence.mediaChecksumAlgorithm),
        mediaChecksumSource: String(evidence.mediaChecksumSource || ""),
        mediaChecksumReason: String(evidence.mediaChecksumReason || ""),
        checksumScope: String(evidence.checksumScope || evidence.mediaChecksumScope || ""),
        sourceAuthority: String(evidence.sourceAuthority || "")
      },
      reviewStatus: assessment.status,
      eligible: assessment.publiclyAvailable,
      manualReviewRequired: assessment.manualReviewRequired,
      validationErrors: assessment.errors
    });
  }

  const api = Object.freeze({
    VERSION,
    licenseUrls: LICENSE_URLS,
    allowedLicenses: Object.freeze([...SUPPORTED_LICENSES]),
    autoAllowedLicenses: Object.freeze([...AUTO_ALLOWED_LICENSES]),
    reviewStatuses: Object.freeze([...REVIEW_STATUSES]),
    requiredLayers: REQUIRED_LAYERS,
    requiredPublicationTerritory: REQUIRED_PUBLICATION_TERRITORY,
    normalizeLicenseCode,
    isAllowedLicense,
    isAutoApprovableLicense,
    requiresManualReview,
    isSafeHttpsUrl,
    isValidVerificationDate: isValidDate,
    isSha256,
    isMediaChecksum,
    territoryEligible,
    canTransitionStatus,
    validateItem,
    validateGovernanceItem,
    publicRightsRecord
  });

  global.HHOpenMediaRights = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
