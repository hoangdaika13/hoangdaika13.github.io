(function initHHCharacter3DRightsRegistry(global) {
  "use strict";

  const STORAGE_VERSION = 1;
  const VALID_STATUSES = new Set(["approved", "review", "rejected"]);
  const PURPOSE_RULES = Object.freeze({
    preview: [],
    avatar: ["avatarUse"],
    commercial: ["commercialUse"],
    modify: ["modification"],
    export: ["redistribution"],
    publish: ["redistribution", "avatarUse"]
  });
  const LICENSE_POLICY = Object.freeze({
    "CC0-1.0": { commercialUse: true, modification: true, redistribution: true, attributionRequired: false },
    "CC-BY-2.5": { commercialUse: true, modification: true, redistribution: true, attributionRequired: true },
    "CC-BY-3.0": { commercialUse: true, modification: true, redistribution: true, attributionRequired: true },
    "CC-BY-4.0": { commercialUse: true, modification: true, redistribution: true, attributionRequired: true },
    "CC-BY-SA-3.0": { commercialUse: true, modification: true, redistribution: true, attributionRequired: true, shareAlike: true },
    "CC-BY-SA-4.0": { commercialUse: true, modification: true, redistribution: true, attributionRequired: true, shareAlike: true },
    MIT: { commercialUse: true, modification: true, redistribution: true, attributionRequired: true },
    "HH-ORIGINAL-1.0": { commercialUse: true, modification: true, redistribution: true, attributionRequired: true },
    "PROPRIETARY-HH": { commercialUse: true, modification: true, redistribution: false, attributionRequired: true }
  });

  const nowIso = () => new Date().toISOString();
  const cleanText = (value, limit = 500) => String(value == null ? "" : value).trim().slice(0, limit);
  const cleanId = (value, fallback = "asset") => {
    const normalized = cleanText(value, 120).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    return normalized || fallback;
  };
  const isHttpUrl = (value) => {
    if (!value) return false;
    try {
      const url = new URL(value, global.location?.href || "https://hoang8.com/");
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) { return false; }
  };
  const boolOr = (value, fallback) => typeof value === "boolean" ? value : Boolean(fallback);

  function normalizeRecord(input, ownerId) {
    const source = input && typeof input === "object" ? input : {};
    const assetId = cleanId(source.assetId || source.id, "");
    if (!assetId) throw new Error("Asset ID is required for the Rights Registry.");
    const licenseId = cleanText(source.licenseId || source.license, 80).toUpperCase() || "UNKNOWN";
    const policy = LICENSE_POLICY[licenseId] || {};
    const status = VALID_STATUSES.has(source.status) ? source.status : "review";
    const record = {
      assetId,
      ownerId,
      title: cleanText(source.title || source.name || assetId, 200),
      author: cleanText(source.author, 200),
      sourceUrl: /^local:\/\/[a-z0-9._/-]+$/i.test(cleanText(source.sourceUrl, 500))
        ? cleanText(source.sourceUrl, 500)
        : (isHttpUrl(source.sourceUrl) ? new URL(source.sourceUrl, global.location?.href || undefined).href : ""),
      licenseId,
      licenseUrl: isHttpUrl(source.licenseUrl) ? new URL(source.licenseUrl, global.location?.href || undefined).href : "",
      commercialUse: boolOr(source.commercialUse, policy.commercialUse),
      modification: boolOr(source.modification, policy.modification),
      redistribution: boolOr(source.redistribution, policy.redistribution),
      // Avatar/personation use may involve consent or personality rights, so it is never inferred from a content license.
      avatarUse: source.avatarUse === true,
      attribution: cleanText(source.attribution, 2000),
      sha256: cleanText(source.sha256, 64).toLowerCase().replace(/[^a-f0-9]/g, "").slice(0, 64),
      reviewedAt: cleanText(source.reviewedAt, 40) || nowIso(),
      reviewedBy: cleanText(source.reviewedBy, 160),
      status,
      provenance: cleanText(source.provenance, 500),
      notes: cleanText(source.notes, 2000),
      consentReference: cleanText(source.consentReference, 500),
      createdAt: cleanText(source.createdAt, 40) || nowIso(),
      updatedAt: nowIso()
    };
    if (policy.attributionRequired && !record.attribution && status === "approved") record.status = "review";
    if (!policy && record.status === "approved") record.status = "review";
    if (record.sha256 && record.sha256.length !== 64) record.sha256 = "";
    return record;
  }

  class RightsRegistry {
    constructor(options = {}) {
      this.ownerId = cleanId(options.ownerId || "local-owner", "local-owner");
      this.storageKey = cleanText(options.storageKey, 160) || `hh.character3d.rights.v${STORAGE_VERSION}.${this.ownerId}`;
      this.records = new Map();
      this.storage = options.storage === false ? null : (options.storage || this._safeStorage());
      this._load();
    }

    _safeStorage() {
      try {
        const storage = global.localStorage;
        if (!storage) return null;
        const key = `${this.storageKey}.probe`;
        storage.setItem(key, "1"); storage.removeItem(key);
        return storage;
      } catch (_) { return null; }
    }

    _load() {
      if (!this.storage) return;
      try {
        const payload = JSON.parse(this.storage.getItem(this.storageKey) || "null");
        if (!payload || payload.version !== STORAGE_VERSION || payload.ownerId !== this.ownerId || !Array.isArray(payload.records)) return;
        payload.records.forEach((entry) => {
          if (entry?.ownerId !== this.ownerId) return;
          const normalized = normalizeRecord(entry, this.ownerId);
          normalized.createdAt = entry.createdAt || normalized.createdAt;
          normalized.updatedAt = entry.updatedAt || normalized.updatedAt;
          this.records.set(normalized.assetId, normalized);
        });
      } catch (_) {
        // Corrupt local metadata is ignored; it must not unlock publishing.
      }
    }

    _save() {
      if (!this.storage) return false;
      const payload = { version: STORAGE_VERSION, ownerId: this.ownerId, updatedAt: nowIso(), records: this.list() };
      try { this.storage.setItem(this.storageKey, JSON.stringify(payload)); return true; }
      catch (_) { return false; }
    }

    register(input) {
      if (input?.ownerId && cleanId(input.ownerId) !== this.ownerId) throw new Error("Rights record belongs to another owner.");
      const previous = this.records.get(cleanId(input?.assetId || input?.id, ""));
      const record = normalizeRecord(Object.assign({}, previous || {}, input || {}, { createdAt: previous?.createdAt }), this.ownerId);
      this.records.set(record.assetId, record);
      this._save();
      return Object.freeze(Object.assign({}, record));
    }

    remove(assetId) {
      const removed = this.records.delete(cleanId(assetId, ""));
      if (removed) this._save();
      return removed;
    }

    get(assetId) {
      const record = this.records.get(cleanId(assetId, ""));
      return record ? Object.freeze(Object.assign({}, record)) : null;
    }

    list(filter = {}) {
      return Array.from(this.records.values())
        .filter((entry) => !filter.status || entry.status === filter.status)
        .map((entry) => Object.assign({}, entry));
    }

    evaluate(assetOrId, purpose = "preview") {
      const record = typeof assetOrId === "string" ? this.get(assetOrId) : assetOrId;
      if (!Object.prototype.hasOwnProperty.call(PURPOSE_RULES, purpose)) throw new Error("Unknown Rights Registry purpose.");
      const normalizedPurpose = purpose;
      const errors = [];
      const warnings = [];
      if (!record) errors.push("Chưa có hồ sơ quyền cho tài sản này.");
      if (record?.ownerId && cleanId(record.ownerId) !== this.ownerId) errors.push("Tài sản thuộc hồ sơ người dùng khác.");
      if (record?.status === "rejected") errors.push("Tài sản đã bị từ chối sử dụng.");
      if (normalizedPurpose !== "preview" && record?.status !== "approved") errors.push("Tài sản chưa được duyệt để xuất bản hoặc phân phối.");
      (PURPOSE_RULES[normalizedPurpose] || []).forEach((field) => {
        if (record?.[field] !== true) errors.push(`Quyền ${field} chưa được xác nhận.`);
      });
      const policy = record ? LICENSE_POLICY[record.licenseId] : null;
      if (record && !policy) {
        warnings.push("Giấy phép chưa có trong danh sách chính sách tự động; cần kiểm duyệt thủ công.");
        if (normalizedPurpose !== "preview") errors.push("Giấy phép không nằm trong chính sách được phép xuất/phát hành tự động.");
      }
      if (record && policy?.attributionRequired && !record.attribution) errors.push("Thiếu nội dung ghi công bắt buộc.");
      if (record && !record.sha256) warnings.push("Chưa lưu SHA-256 để đối chiếu đúng file.");
      if (record && !record.sourceUrl && !new Set(["HH-ORIGINAL-1.0", "PROPRIETARY-HH"]).has(record.licenseId)) warnings.push("Chưa lưu URL nguồn độc lập.");
      return Object.freeze({ allowed: errors.length === 0, purpose: normalizedPurpose, errors, warnings, record: record || null });
    }

    assertAllowed(assetOrId, purpose = "publish") {
      const result = this.evaluate(assetOrId, purpose);
      if (!result.allowed) throw new Error(result.errors.join(" ") || "Rights gate rejected this asset.");
      return result;
    }

    attributionManifest(assetIds) {
      const ids = Array.isArray(assetIds) ? assetIds : this.list().map((entry) => entry.assetId);
      const assets = ids.map((id) => this.get(id)).filter(Boolean);
      return {
        schema: "https://hoang8.com/schemas/character-3d-rights/v1",
        generatedAt: nowIso(),
        ownerId: this.ownerId,
        assets
      };
    }

    attributionText(assetIds) {
      return this.attributionManifest(assetIds).assets.map((entry) => {
        const source = entry.sourceUrl ? ` — ${entry.sourceUrl}` : "";
        return `${entry.title} — ${entry.attribution || entry.author || "Attribution pending"} — ${entry.licenseId}${source}`;
      }).join("\n");
    }

    clear() {
      this.records.clear();
      try { this.storage?.removeItem(this.storageKey); } catch (_) { /* no-op */ }
    }

    static async sha256(input) {
      if (!global.crypto?.subtle) throw new Error("SHA-256 is not supported by this browser context.");
      const buffer = input instanceof ArrayBuffer ? input : await input.arrayBuffer();
      const digest = await global.crypto.subtle.digest("SHA-256", buffer);
      return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    }
  }

  const api = Object.freeze({ RightsRegistry, LICENSE_POLICY, PURPOSE_RULES, STORAGE_VERSION, normalizeRecord });
  global.HHCharacter3DRightsRegistry = api;
  global.HHCharacter3D = global.HHCharacter3D || {};
  global.HHCharacter3D.RightsRegistry = RightsRegistry;
})(typeof window !== "undefined" ? window : globalThis);
