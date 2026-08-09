(function initHHOpenMediaRights(global) {
  "use strict";

  const VERSION = "1.1.0";
  const LICENSE_URLS = Object.freeze({
    "CC0-1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
    "PDM-1.0": "https://creativecommons.org/publicdomain/mark/1.0/",
    "CC-BY-2.5": "https://creativecommons.org/licenses/by/2.5/",
    "CC-BY-3.0": "https://creativecommons.org/licenses/by/3.0/",
    "CC-BY-4.0": "https://creativecommons.org/licenses/by/4.0/",
    "CC-BY-SA-3.0": "https://creativecommons.org/licenses/by-sa/3.0/",
    "CC-BY-SA-4.0": "https://creativecommons.org/licenses/by-sa/4.0/"
  });
  const ALLOWED_LICENSES = Object.freeze(new Set(Object.keys(LICENSE_URLS)));
  const KIND_PLAYBACK_TYPES = Object.freeze({ film: "video", track: "audio" });
  const BLOCKED_LICENSE_MARKERS = Object.freeze(["-NC", "-ND", "UNKNOWN", "ALL-RIGHTS-RESERVED"]);

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
      "PUBLIC-DOMAIN-MARK-1.0": "PDM-1.0"
    };
    return aliases[raw] || raw;
  }

  function isAllowedLicense(value) {
    const normalized = normalizeLicenseCode(value);
    if (!normalized || BLOCKED_LICENSE_MARKERS.some((marker) => normalized.includes(marker))) return false;
    return ALLOWED_LICENSES.has(normalized);
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

  function isValidVerificationDate(value) {
    const text = String(value || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
    const [year, month, day] = text.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) return false;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return text <= today;
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
    if (!isValidVerificationDate(rights.verifiedAt)) errors.push("invalid-verification-date");
    if (rights.commercialAllowed !== true) errors.push("commercial-use-not-confirmed");
    if (rights.derivativesAllowed !== true) errors.push("derivatives-not-confirmed");
    if (!isSafeHttpsUrl(playback.url)) errors.push("invalid-playback-url");
    if (!expectedPlaybackType || playback.type !== expectedPlaybackType) errors.push("playback-kind-mismatch");

    return {
      ok: errors.length === 0,
      errors,
      licenseCode
    };
  }

  const api = Object.freeze({
    VERSION,
    allowedLicenses: Object.freeze([...ALLOWED_LICENSES]),
    normalizeLicenseCode,
    isAllowedLicense,
    validateItem
  });

  global.HHOpenMediaRights = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
