(function (globalScope, factory) {
  "use strict";
  const api = factory(globalScope || globalThis);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope) globalScope.HHUniversalMediaProject = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (globalScope) {
  "use strict";

  const SCHEMA = "hh.universal-media.v1";
  const FORMAT = "hhmedia-package";
  const ASSET_MANIFEST_FORMAT = "hhasset-manifest";
  const VERSION = 1;
  const RECORD_VERSION = 2;
  const DB_NAME = "hh-universal-media";
  const DB_VERSION = 1;
  const STORE_NAMES = Object.freeze(["projects", "assets", "snapshots"]);
  const ROOT_FOLDER_ID = "root";
  const MAX_ASSETS = 500;
  const MAX_FOLDERS = 100;
  const MAX_TAGS = 40;
  const MAX_SNAPSHOTS = 50;
  const MAX_INLINE_ASSET_BYTES = 1024 * 1024;
  const MAX_PACKAGE_TEXT_BYTES = 12 * 1024 * 1024;
  const MAX_ASSET_MANIFEST_BYTES = 2 * 1024 * 1024;
  const MAX_PROJECT_JSON_BYTES = 1024 * 1024;
  const MAX_ASSET_BYTES = 4 * 1024 * 1024 * 1024;
  const MAX_ASSET_VERSIONS = 24;
  const MAX_VERSION_BINARY_BYTES = 8 * 1024 * 1024;
  const MAX_VERSION_BINARY_TOTAL_BYTES = 32 * 1024 * 1024;
  const MAX_COMMAND_HISTORY = 100;
  const HASH_FULL_MAX_BYTES = 32 * 1024 * 1024;
  const MAX_SVG_BYTES = 5 * 1024 * 1024;
  const MAX_RIGHTS_USES = 20;
  const MAX_PROJECTS = 120;
  const MAX_PROJECT_PRESETS = 40;
  const MAX_INGEST_JOBS = 100;
  const MAX_SHARED_ENTITIES = 500;
  const activeInstances = new Set();
  const pendingMounts = new Map();

  const TYPE_LABELS = Object.freeze({
    image: "Hình ảnh",
    video: "Video",
    audio: "Âm thanh",
    font: "Font",
    lut: "LUT",
    svg: "SVG",
    other: "Khác"
  });

  const SMART_COLLECTIONS = Object.freeze([
    { id: "all", label: "Tất cả tài sản", icon: "▦" },
    { id: "recent", label: "Gần đây", icon: "◷" },
    { id: "favorites", label: "Yêu thích", icon: "★" },
    { id: "duplicates", label: "Tệp trùng", icon: "⧉" },
    { id: "offline", label: "Đang ngoại tuyến", icon: "!" },
    { id: "rights-review", label: "Cần kiểm tra quyền", icon: "©" },
    { id: "missing-fonts", label: "Font bị thiếu", icon: "T" },
    { id: "large-video", label: "Video cần proxy", icon: "▶" }
  ]);

  function now() {
    return new Date().toISOString();
  }

  function uid(prefix) {
    if (globalScope.crypto?.randomUUID) return `${prefix}-${globalScope.crypto.randomUUID()}`;
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function clone(value) {
    if (value == null) return value;
    if (typeof structuredClone === "function") return structuredClone(value);
    if (value instanceof Blob) return value.slice(0, value.size, value.type);
    if (Array.isArray(value)) return value.map(clone);
    if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
    return value;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function boundedText(value, max, fallback) {
    const text = String(value == null ? "" : value).trim().slice(0, max);
    return text || fallback || "";
  }

  function uniqueStrings(values, max, maxLength) {
    return [...new Set((Array.isArray(values) ? values : []).map((value) => boundedText(value, maxLength || 60)).filter(Boolean))].slice(0, max);
  }

  function normalizeSharedEntity(input, index, prefix) {
    const source = input && typeof input === "object" ? input : {};
    const clean = safeJsonValue(source, 0) || {};
    return {
      ...clean,
      id: boundedText(source.id, 100, `${prefix}-${index + 1}`),
      name: boundedText(source.name || source.label, 160, `${prefix} ${index + 1}`),
      assetId: boundedText(source.assetId, 100) || null,
      parentId: boundedText(source.parentId, 100) || null,
      order: Math.max(0, Math.min(MAX_SHARED_ENTITIES - 1, Number(source.order) || index))
    };
  }

  function normalizeSharedWorkspace(input) {
    const source = input && typeof input === "object" ? input : {};
    const list = (name, prefix) => {
      const seen = new Set();
      return (Array.isArray(source[name]) ? source[name] : []).slice(0, MAX_SHARED_ENTITIES).map((item, index) => normalizeSharedEntity(item, index, prefix)).filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id); return true;
      });
    };
    return {
      layers: list("layers", "layer"), tracks: list("tracks", "track"), clips: list("clips", "clip"),
      pages: list("pages", "page"), scenes: list("scenes", "scene"), effects: list("effects", "effect"),
      keyframes: list("keyframes", "keyframe"), colorTokens: list("colorTokens", "color")
    };
  }

  function normalizeProjectPreset(input, index) {
    const source = input && typeof input === "object" ? input : {};
    const section = ["settings", "canvas", "timeline", "document", "workspace"].includes(source.section) ? source.section : "settings";
    return {
      id: boundedText(source.id, 100, `preset-${index + 1}`),
      name: boundedText(source.name, 120, `Preset ${index + 1}`),
      section,
      payload: section === "workspace" ? normalizeSharedWorkspace(source.payload) : safeJsonValue(source.payload || {}, 0),
      createdAt: safeIsoDate(source.createdAt) || now(),
      updatedAt: safeIsoDate(source.updatedAt) || now()
    };
  }

  function ingestFingerprint(input) {
    const source = input && typeof input === "object" ? input : {};
    return [boundedText(source.name, 240, "asset.bin"), Math.max(0, Number(source.size) || 0), Math.max(0, Number(source.lastModified) || 0), boundedText(source.type, 160)].join("::");
  }

  function normalizeIngestJob(input, index) {
    const source = input && typeof input === "object" ? input : {};
    const status = ["awaiting-file", "failed", "complete", "cancelled"].includes(source.status) ? source.status : "awaiting-file";
    const file = {
      name: boundedText(source.file?.name || source.name, 240, "asset.bin"),
      type: boundedText(source.file?.type || source.type, 160, "application/octet-stream"),
      size: Math.max(0, Math.min(MAX_ASSET_BYTES, Number(source.file?.size ?? source.size) || 0)),
      lastModified: Math.max(0, Number(source.file?.lastModified ?? source.lastModified) || 0)
    };
    return {
      id: boundedText(source.id, 100, `ingest-${index + 1}`),
      fingerprint: ingestFingerprint(file), file,
      folderId: boundedText(source.folderId, 100, ROOT_FOLDER_ID),
      status,
      assetId: boundedText(source.assetId, 100) || null,
      error: status === "failed" ? boundedText(source.error, 300, "Nhập tệp thất bại") : "",
      attempts: Math.max(0, Math.min(20, Number(source.attempts) || 0)),
      createdAt: safeIsoDate(source.createdAt) || now(),
      updatedAt: safeIsoDate(source.updatedAt) || now()
    };
  }

  function normalizeRecovery(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      sessionId: boundedText(source.sessionId, 120),
      sessionStartedAt: safeIsoDate(source.sessionStartedAt),
      lastCleanCloseAt: safeIsoDate(source.lastCleanCloseAt),
      cleanlyClosed: source.cleanlyClosed !== false,
      previousSessionUnclean: Boolean(source.previousSessionUnclean),
      lastAutosaveAt: safeIsoDate(source.lastAutosaveAt),
      lastAutosaveError: boundedText(source.lastAutosaveError, 300)
    };
  }

  function safeExternalUrl(value) {
    const text = boundedText(value, 1000);
    if (!text || !/^https?:\/\//i.test(text)) return "";
    try {
      const parsed = new URL(text, "https://hh.local/");
      return ["http:", "https:"].includes(parsed.protocol) ? text : "";
    } catch (_) {
      return "";
    }
  }

  function safeIsoDate(value) {
    if (!value) return "";
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
  }

  function normalizeRights(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      author: boundedText(source.author, 180),
      sourceUrl: safeExternalUrl(source.sourceUrl || source.source),
      license: boundedText(source.license || source.licenseId, 100),
      licenseUrl: safeExternalUrl(source.licenseUrl),
      attributionRequired: Boolean(source.attributionRequired),
      attribution: boundedText(source.attribution, 500),
      allowedUses: uniqueStrings(source.allowedUses, MAX_RIGHTS_USES, 80),
      territories: uniqueStrings(source.territories, 40, 80),
      expiresAt: safeIsoDate(source.expiresAt),
      verified: Boolean(source.verified),
      notes: boundedText(source.notes, 1000)
    };
  }

  function normalizeProvenance(input, fallbackName) {
    const source = input && typeof input === "object" ? input : {};
    return {
      sourceType: ["local-file", "package", "generated", "provider", "unknown"].includes(source.sourceType) ? source.sourceType : "unknown",
      sourceId: boundedText(source.sourceId, 180),
      sourceUrl: safeExternalUrl(source.sourceUrl),
      originalName: boundedText(source.originalName, 240, fallbackName || "asset.bin"),
      importedAt: safeIsoDate(source.importedAt) || now(),
      attribution: boundedText(source.attribution, 500)
    };
  }

  function normalizeAssetVersion(input) {
    const source = input && typeof input === "object" ? input : {};
    const blob = source.blob instanceof Blob && source.blob.size <= MAX_VERSION_BINARY_BYTES ? source.blob : null;
    return {
      id: boundedText(source.id, 100, uid("asset-version")),
      createdAt: safeIsoDate(source.createdAt) || now(),
      reason: boundedText(source.reason, 180, "Thay thế tệp nguồn"),
      name: boundedText(source.name, 240, "asset.bin"),
      type: boundedText(source.type, 160, "application/octet-stream"),
      size: Math.max(0, Math.min(MAX_ASSET_BYTES, Number(source.size) || 0)),
      checksum: boundedText(source.checksum, 180),
      checksumMode: ["full", "sampled", "unavailable"].includes(source.checksumMode) ? source.checksumMode : "unavailable",
      metadata: safeJsonValue(source.metadata || {}, 0),
      rights: normalizeRights(source.rights),
      binaryRetained: Boolean(blob),
      blob
    };
  }

  function normalizeAssetVersions(input) {
    const versions = (Array.isArray(input) ? input : []).slice(-MAX_ASSET_VERSIONS).map(normalizeAssetVersion);
    let retainedBytes = 0;
    for (let index = versions.length - 1; index >= 0; index -= 1) {
      const version = versions[index];
      if (!version.blob || retainedBytes + version.blob.size > MAX_VERSION_BINARY_TOTAL_BYTES) { version.blob = null; version.binaryRetained = false; }
      else retainedBytes += version.blob.size;
    }
    return versions;
  }

  function stripSensitiveMetadata(input) {
    const blocked = /^(gps|location|latitude|longitude|serialnumber|deviceid|ownername|creatorcontact)$/i;
    const walk = (value, depth) => {
      if (depth > 8 || value == null || typeof value !== "object") return safeJsonValue(value, depth);
      if (Array.isArray(value)) return value.slice(0, 1000).map((item) => walk(item, depth + 1));
      const output = {};
      Object.entries(value).slice(0, 1000).forEach(([key, item]) => {
        if (!["__proto__", "prototype", "constructor"].includes(key) && !blocked.test(key.replace(/[\s_-]/g, ""))) output[boundedText(key, 120, "field")] = walk(item, depth + 1);
      });
      return output;
    };
    return walk(input && typeof input === "object" ? input : {}, 0) || {};
  }

  function hasSensitiveMetadata(input) {
    const blocked = /^(gps|location|latitude|longitude|serialnumber|deviceid|ownername|creatorcontact)$/i;
    const inspect = (value, depth) => {
      if (depth > 8 || value == null || typeof value !== "object") return false;
      return Object.entries(value).some(([key, item]) => blocked.test(key.replace(/[\s_-]/g, "")) || inspect(item, depth + 1));
    };
    return inspect(input, 0);
  }

  function safeJsonValue(value, depth, budget) {
    const level = Number(depth) || 0;
    const state = budget || { keys: 0 };
    if (level > 8 || state.keys > 10000) return null;
    if (value == null || typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value === "string") return value.slice(0, 20000);
    if (Array.isArray(value)) return value.slice(0, 1000).map((item) => safeJsonValue(item, level + 1, state));
    if (typeof value === "object" && !(value instanceof Blob)) {
      const output = {};
      Object.entries(value).slice(0, 1000).forEach(([key, item]) => {
        if (["__proto__", "prototype", "constructor"].includes(key)) return;
        state.keys += 1;
        output[boundedText(key, 120, "field")] = safeJsonValue(item, level + 1, state);
      });
      return output;
    }
    return null;
  }

  function extensionOf(name) {
    const clean = String(name || "").split(/[?#]/)[0];
    const index = clean.lastIndexOf(".");
    return index >= 0 ? clean.slice(index + 1).toLowerCase() : "";
  }

  function classifyAsset(type, name) {
    const mime = String(type || "").toLowerCase();
    const extension = extensionOf(name);
    if (mime.includes("svg") || extension === "svg") return "svg";
    if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "avif", "bmp", "tif", "tiff"].includes(extension)) return "image";
    if (mime.startsWith("video/") || ["mp4", "webm", "mov", "mkv", "avi", "m4v"].includes(extension)) return "video";
    if (mime.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "aac", "flac", "opus"].includes(extension)) return "audio";
    if (mime.includes("font") || ["ttf", "otf", "woff", "woff2", "eot"].includes(extension)) return "font";
    if (["cube", "3dl", "look", "lut"].includes(extension)) return "lut";
    return "other";
  }

  function normalizeFolder(input, index) {
    const source = input && typeof input === "object" ? input : {};
    const id = boundedText(source.id, 100, index === 0 ? ROOT_FOLDER_ID : uid("folder"));
    return {
      id,
      name: boundedText(source.name, 100, id === ROOT_FOLDER_ID ? "Media Bin" : "Thư mục mới"),
      parentId: id === ROOT_FOLDER_ID ? null : boundedText(source.parentId, 100, ROOT_FOLDER_ID),
      color: /^#[0-9a-f]{6}$/i.test(String(source.color || "")) ? source.color : "#62d7e7",
      createdAt: safeIsoDate(source.createdAt) || now()
    };
  }

  function normalizeProject(input) {
    const source = input && typeof input === "object" ? input : {};
    const folderIds = new Set();
    const folders = (Array.isArray(source.folders) ? source.folders : []).slice(0, MAX_FOLDERS).map(normalizeFolder).filter((folder) => {
      if (folderIds.has(folder.id)) return false;
      folderIds.add(folder.id); return true;
    });
    if (!folders.some((folder) => folder.id === ROOT_FOLDER_ID)) folders.unshift(normalizeFolder({ id: ROOT_FOLDER_ID }, 0));
    const createdAt = safeIsoDate(source.createdAt) || now();
    const projectKind = source.projectKind === "template" ? "template" : "project";
    const lifecycle = source.lifecycle === "archived" ? "archived" : "active";
    return {
      schema: SCHEMA,
      recordVersion: RECORD_VERSION,
      id: boundedText(source.id, 100, uid("media-project")),
      name: boundedText(source.name, 160, "Dự án media mới"),
      description: boundedText(source.description, 1200),
      projectKind,
      lifecycle,
      archivedAt: lifecycle === "archived" ? (safeIsoDate(source.archivedAt) || now()) : "",
      templateSourceId: boundedText(source.templateSourceId, 100) || null,
      createdAt,
      updatedAt: safeIsoDate(source.updatedAt) || now(),
      lastOpenedAt: safeIsoDate(source.lastOpenedAt) || createdAt,
      folders: folders.slice(0, MAX_FOLDERS),
      requiredFonts: uniqueStrings(source.requiredFonts, 100, 120),
      assetIds: uniqueStrings(source.assetIds, MAX_ASSETS, 100),
      settings: safeJsonValue(source.settings || {}, 0),
      references: safeJsonValue(source.references || {}, 0),
      canvas: safeJsonValue(source.canvas || {}, 0),
      timeline: safeJsonValue(source.timeline || {}, 0),
      document: safeJsonValue(source.document || {}, 0),
      workspace: normalizeSharedWorkspace(source.workspace || source.graph || {}),
      presets: (Array.isArray(source.presets) ? source.presets : []).slice(0, MAX_PROJECT_PRESETS).map(normalizeProjectPreset),
      ingestJobs: (Array.isArray(source.ingestJobs) ? source.ingestJobs : []).slice(-MAX_INGEST_JOBS).map(normalizeIngestJob),
      recovery: normalizeRecovery(source.recovery),
      exportJobs: (Array.isArray(source.exportJobs) ? source.exportJobs : []).slice(-100).map((job) => safeJsonValue(job, 0)),
      revision: Math.max(1, Number(source.revision) || 1)
    };
  }

  function normalizeAsset(input) {
    const source = input && typeof input === "object" ? input : {};
    const blob = source.blob instanceof Blob ? source.blob : null;
    const thumbnailBlob = source.thumbnailBlob instanceof Blob ? source.thumbnailBlob : null;
    const type = boundedText(source.type || blob?.type, 160, "application/octet-stream");
    const createdAt = safeIsoDate(source.createdAt) || now();
    const id = boundedText(source.id, 100, uid("asset"));
    return {
      schema: SCHEMA,
      recordVersion: RECORD_VERSION,
      id,
      originId: boundedText(source.originId || source.id || id, 100),
      projectId: boundedText(source.projectId, 100),
      folderId: boundedText(source.folderId, 100, ROOT_FOLDER_ID),
      name: boundedText(source.name, 240, "asset.bin"),
      type,
      kind: TYPE_LABELS[source.kind] ? source.kind : classifyAsset(type, source.name),
      size: Math.max(0, Math.min(MAX_ASSET_BYTES, Number(source.size ?? blob?.size) || 0)),
      lastModified: Math.max(0, Number(source.lastModified) || 0),
      checksum: boundedText(source.checksum, 160),
      checksumMode: ["full", "sampled", "unavailable"].includes(source.checksumMode) ? source.checksumMode : (String(source.checksum || "").startsWith("sampled-") ? "sampled" : source.checksum ? "full" : "unavailable"),
      duplicateOf: boundedText(source.duplicateOf, 100) || null,
      duplicateConfidence: source.duplicateConfidence === "probable" ? "probable" : source.duplicateOf ? "exact" : "none",
      favorite: Boolean(source.favorite),
      tags: uniqueStrings(source.tags, MAX_TAGS, 60),
      availability: ["ready", "offline", "missing"].includes(source.availability) ? source.availability : (blob ? "ready" : "offline"),
      createdAt,
      updatedAt: safeIsoDate(source.updatedAt) || now(),
      lastOpenedAt: safeIsoDate(source.lastOpenedAt) || createdAt,
      metadata: safeJsonValue(source.metadata || {}, 0),
      thumbnail: safeJsonValue(source.thumbnail || { status: thumbnailBlob ? "generated" : "unavailable" }, 0),
      references: safeJsonValue(source.references || [], 0),
      effects: safeJsonValue(source.effects || [], 0),
      versions: normalizeAssetVersions(source.versions),
      rights: normalizeRights(source.rights || {
        author: source.author,
        sourceUrl: source.sourceUrl,
        license: source.license,
        licenseUrl: source.licenseUrl
      }),
      provenance: normalizeProvenance(source.provenance, source.name),
      blob,
      thumbnailBlob
    };
  }

  function normalizeSnapshot(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      schema: SCHEMA,
      recordVersion: RECORD_VERSION,
      id: boundedText(source.id, 100, uid("snapshot")),
      projectId: boundedText(source.projectId, 100),
      label: boundedText(source.label, 120, "Snapshot"),
      note: boundedText(source.note, 500),
      createdAt: safeIsoDate(source.createdAt) || now(),
      project: normalizeProject(source.project || {}),
      assets: (Array.isArray(source.assets) ? source.assets : []).slice(0, MAX_ASSETS).map((asset) => {
        const normalized = normalizeAsset(asset);
        normalized.blob = null;
        normalized.thumbnailBlob = null;
        normalized.versions = normalized.versions.map((version) => ({ ...version, blob: null, binaryRetained: false }));
        return normalized;
      })
    };
  }

  function migrateProjectRecord(input) {
    const source = input && typeof input === "object" ? input : {};
    const migrated = normalizeProject(source);
    migrated.createdAt = safeIsoDate(source.createdAt) || migrated.createdAt;
    migrated.updatedAt = safeIsoDate(source.updatedAt) || migrated.updatedAt;
    return migrated;
  }

  function migrateAssetRecord(input) {
    const source = input && typeof input === "object" ? input : {};
    const migrated = normalizeAsset(source);
    migrated.createdAt = safeIsoDate(source.createdAt) || migrated.createdAt;
    migrated.updatedAt = safeIsoDate(source.updatedAt) || migrated.updatedAt;
    return migrated;
  }

  function migrateSnapshotRecord(input) {
    return normalizeSnapshot(input);
  }

  function remapIds(value, idMap, depth) {
    const level = Number(depth) || 0;
    if (level > 8 || value == null) return value;
    if (typeof value === "string") return idMap.get(value) || value;
    if (Array.isArray(value)) return value.slice(0, 1000).map((item) => remapIds(item, idMap, level + 1));
    if (typeof value === "object" && !(value instanceof Blob)) {
      return Object.fromEntries(Object.entries(value).slice(0, 1000).filter(([key]) => !["__proto__", "prototype", "constructor"].includes(key)).map(([key, item]) => [key, remapIds(item, idMap, level + 1)]));
    }
    return value;
  }

  function scrubAssetReferences(value, assetIds, depth) {
    const level = Number(depth) || 0;
    if (level > 8 || value == null) return value;
    if (typeof value === "string") return assetIds.has(value) ? null : value;
    if (Array.isArray(value)) return value.slice(0, 1000).map((item) => scrubAssetReferences(item, assetIds, level + 1)).filter((item) => item != null);
    if (typeof value === "object" && !(value instanceof Blob)) {
      return Object.fromEntries(Object.entries(value).slice(0, 1000).filter(([key]) => !["__proto__", "prototype", "constructor"].includes(key)).map(([key, item]) => [key, scrubAssetReferences(item, assetIds, level + 1)]));
    }
    return value;
  }

  function classifyStorageError(error) {
    const name = boundedText(error?.name, 100);
    const message = boundedText(error?.message, 300, "Không thể lưu dữ liệu.");
    if (name === "QuotaExceededError" || /quota|disk full|storage full/i.test(message)) return { code: "quota-exceeded", message: "Kho lưu trữ đã đầy. Hãy xuất project hoặc xóa asset không cần thiết." };
    if (name === "SecurityError" || name === "NotAllowedError") return { code: "storage-denied", message: "Trình duyệt không cho phép ghi vào kho local." };
    if (name === "AbortError") return { code: "storage-aborted", message: "Giao dịch lưu trữ đã bị hủy." };
    return { code: "storage-failed", message };
  }

  async function inspectStorageCapabilities(env) {
    const scope = env || globalScope;
    const storage = scope?.navigator?.storage;
    let estimate = null;
    let persisted = null;
    try { estimate = typeof storage?.estimate === "function" ? await storage.estimate() : null; } catch (_) {}
    try { persisted = typeof storage?.persisted === "function" ? await storage.persisted() : null; } catch (_) {}
    const usage = Math.max(0, Number(estimate?.usage) || 0);
    const quota = Math.max(0, Number(estimate?.quota) || 0);
    const ratio = quota ? Math.min(1, usage / quota) : null;
    return {
      quota: { supported: Boolean(estimate), usage, quota, remaining: quota ? Math.max(0, quota - usage) : null, ratio, pressure: ratio == null ? "unknown" : ratio >= .95 ? "critical" : ratio >= .8 ? "warning" : "healthy" },
      persistence: { supported: typeof storage?.persisted === "function", granted: persisted === true },
      opfs: { available: typeof storage?.getDirectory === "function", used: false, reason: typeof storage?.getDirectory === "function" ? "Có adapter OPFS nhưng Project Core hiện lưu binary trong IndexedDB." : "Trình duyệt không cung cấp OPFS." }
    };
  }

  function searchAssets(assets, query, options) {
    const settings = options || {};
    const term = String(query || "").trim().toLocaleLowerCase("vi");
    return (Array.isArray(assets) ? assets : []).filter((asset) => {
      if (settings.folderId && settings.folderId !== "all" && asset.folderId !== settings.folderId) return false;
      if (settings.kind && settings.kind !== "all" && asset.kind !== settings.kind) return false;
      if (settings.tag && !asset.tags?.includes(settings.tag)) return false;
      if (Number.isFinite(Number(settings.minSize)) && asset.size < Number(settings.minSize)) return false;
      if (Number.isFinite(Number(settings.maxSize)) && Number(settings.maxSize) >= 0 && asset.size > Number(settings.maxSize)) return false;
      if (settings.dateFrom && Date.parse(asset.updatedAt || asset.createdAt) < Date.parse(settings.dateFrom)) return false;
      if (settings.dateTo && Date.parse(asset.updatedAt || asset.createdAt) > Date.parse(settings.dateTo)) return false;
      if (settings.rights === "verified" && !asset.rights?.verified) return false;
      if (settings.rights === "review" && asset.rights?.verified) return false;
      if (settings.color) {
        const requested = String(settings.color).toLowerCase();
        const colors = [asset.metadata?.dominantColor, ...(Array.isArray(asset.metadata?.colors) ? asset.metadata.colors : [])].filter(Boolean).map((color) => String(color).toLowerCase());
        if (!colors.includes(requested)) return false;
      }
      if (!term) return true;
      const haystack = [asset.name, asset.kind, asset.type, ...(asset.tags || []), asset.metadata?.title, asset.metadata?.artist, asset.rights?.author, asset.rights?.license, asset.provenance?.originalName]
        .filter(Boolean).join(" ").toLocaleLowerCase("vi");
      return haystack.includes(term);
    });
  }

  function applySmartCollection(assets, collectionId, context) {
    const list = Array.isArray(assets) ? assets : [];
    const nowMs = Number(context?.nowMs) || Date.now();
    const recentAfter = nowMs - 7 * 24 * 60 * 60 * 1000;
    if (collectionId === "recent") return list.filter((asset) => Date.parse(asset.lastOpenedAt || asset.updatedAt || 0) >= recentAfter).sort((a, b) => String(b.lastOpenedAt).localeCompare(String(a.lastOpenedAt)));
    if (collectionId === "favorites") return list.filter((asset) => asset.favorite);
    if (collectionId === "duplicates") return list.filter((asset) => Boolean(asset.duplicateOf));
    if (collectionId === "offline") return list.filter((asset) => asset.availability !== "ready" || !asset.blob);
    if (collectionId === "rights-review") return list.filter((asset) => Boolean(asset.rights?.expiresAt && Date.parse(asset.rights.expiresAt) < nowMs) || Boolean((asset.rights?.license || asset.rights?.sourceUrl) && !asset.rights?.verified) || Boolean(asset.rights?.attributionRequired && !asset.rights?.attribution));
    if (collectionId === "missing-fonts") {
      const availableFonts = new Set((context?.availableFonts || []).map((font) => String(font).toLowerCase()));
      return list.filter((asset) => asset.kind === "font" && asset.metadata?.fontFamily && !availableFonts.has(String(asset.metadata.fontFamily).toLowerCase()));
    }
    if (collectionId === "large-video") return list.filter((asset) => asset.kind === "video" && asset.size >= 100 * 1024 * 1024);
    return list;
  }

  function assessWarnings(project, assets, options) {
    const warnings = [];
    const list = Array.isArray(assets) ? assets : [];
    const byId = new Map(list.map((asset) => [asset.id, asset]));
    const availableFonts = new Set((options?.availableFonts || []).map((font) => String(font).toLowerCase()));
    (project?.assetIds || []).forEach((id) => {
      if (!byId.has(id)) warnings.push({ code: "missing-asset", level: "error", assetId: id, message: `Không tìm thấy asset ${id}.` });
    });
    list.forEach((asset) => {
      if (asset.availability === "missing") warnings.push({ code: "missing-file", level: "error", assetId: asset.id, message: `${asset.name} đã mất liên kết nguồn.` });
      else if (asset.availability === "offline" || !asset.blob) warnings.push({ code: "offline", level: "warning", assetId: asset.id, message: `${asset.name} chỉ còn metadata trên thiết bị này.` });
      if (asset.duplicateOf) warnings.push({ code: "duplicate", level: "info", assetId: asset.id, message: `${asset.name} trùng nội dung với asset khác.` });
      if (asset.rights?.expiresAt && Date.parse(asset.rights.expiresAt) < Date.now()) warnings.push({ code: "rights-expired", level: "error", assetId: asset.id, message: `Quyền sử dụng ${asset.name} đã hết hạn.` });
      else if ((asset.rights?.license || asset.rights?.sourceUrl) && !asset.rights?.verified) warnings.push({ code: "rights-unverified", level: "warning", assetId: asset.id, message: `Nguồn hoặc giấy phép của ${asset.name} chưa được xác minh.` });
      if (asset.rights?.attributionRequired && !asset.rights?.attribution) warnings.push({ code: "attribution-missing", level: "warning", assetId: asset.id, message: `${asset.name} yêu cầu ghi công nhưng chưa có nội dung ghi công.` });
      if (hasSensitiveMetadata(asset.metadata)) warnings.push({ code: "sensitive-metadata", level: "warning", assetId: asset.id, message: `${asset.name} còn metadata vị trí hoặc thiết bị nhạy cảm.` });
    });
    Object.entries(project?.workspace || {}).forEach(([collection, entities]) => {
      if (!Array.isArray(entities)) return;
      entities.forEach((entity) => {
        if (entity?.assetId && !byId.has(entity.assetId)) warnings.push({ code: "broken-workspace-reference", level: "error", assetId: entity.assetId, entityId: entity.id, collection, message: `${entity.name || entity.id} đang trỏ tới asset không còn trong project.` });
      });
    });
    (project?.requiredFonts || []).forEach((font) => {
      if (!availableFonts.has(String(font).toLowerCase())) warnings.push({ code: "missing-font", level: "warning", font, message: `Thiếu font ${font}.` });
    });
    return warnings;
  }

  function proxyPlan(asset, capabilities) {
    const isLargeVideo = asset?.kind === "video" && Number(asset.size) >= 100 * 1024 * 1024;
    const isHighResolution = Number(asset?.metadata?.width) >= 3840 || Number(asset?.metadata?.height) >= 2160;
    const recommended = Boolean(isLargeVideo || isHighResolution || Number(asset?.metadata?.duration) > 900);
    const canRecord = Boolean(capabilities?.MediaRecorder && (capabilities?.OffscreenCanvas || capabilities?.document));
    return {
      recommended,
      reason: !recommended ? "Asset hiện chưa cần proxy." : isLargeVideo ? "Video lớn hơn 100 MB." : isHighResolution ? "Video có độ phân giải 4K trở lên." : "Video dài hơn 15 phút.",
      status: "not-generated",
      browserPreviewPossible: canRecord,
      productionAdapterRequired: recommended,
      message: recommended ? "Cần FFmpeg/WebCodecs worker để tạo proxy thật; module hiện chỉ lập kế hoạch." : "Không tạo proxy giả lập."
    };
  }

  function metadataCapability(asset, env) {
    const scope = env || globalScope;
    const kind = asset?.kind || classifyAsset(asset?.type, asset?.name);
    return {
      kind,
      basic: true,
      dimensions: kind === "image" ? Boolean(scope.createImageBitmap || scope.document) : kind === "video" ? Boolean(scope.document) : false,
      duration: ["video", "audio"].includes(kind) && Boolean(scope.document),
      thumbnail: ["image", "video"].includes(kind) && Boolean(scope.createImageBitmap || scope.document),
      deepCodecInspection: false,
      note: "Codec, bitrate chính xác và thumbnail video cần browser decoder hoặc adapter chuyên dụng."
    };
  }

  async function computeContentHash(input, cryptoScope) {
    let bytes;
    let sampled = false;
    if (input instanceof Blob && input.size > HASH_FULL_MAX_BYTES) {
      const sampleBytes = 1024 * 1024;
      const head = new Uint8Array(await input.slice(0, sampleBytes).arrayBuffer());
      const tail = new Uint8Array(await input.slice(Math.max(0, input.size - sampleBytes)).arrayBuffer());
      const size = new TextEncoder().encode(`:${input.size}:`);
      bytes = new Uint8Array(head.length + size.length + tail.length);
      bytes.set(head, 0); bytes.set(size, head.length); bytes.set(tail, head.length + size.length);
      sampled = true;
    } else if (input instanceof Blob) bytes = new Uint8Array(await input.arrayBuffer());
    else if (input instanceof ArrayBuffer) bytes = new Uint8Array(input);
    else if (ArrayBuffer.isView(input)) bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    else bytes = new TextEncoder().encode(String(input || ""));
    const cryptoApi = cryptoScope || globalScope.crypto;
    if (cryptoApi?.subtle?.digest) {
      const digest = await cryptoApi.subtle.digest("SHA-256", bytes);
      return `${sampled ? "sampled-" : ""}sha256-${[...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("")}${sampled ? `-${input.size}` : ""}`;
    }
    let hash = 2166136261;
    for (let index = 0; index < bytes.length; index += 1) {
      hash ^= bytes[index];
      hash = Math.imul(hash, 16777619);
    }
    return `${sampled ? "sampled-" : ""}fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}-${sampled ? input.size : bytes.length}`;
  }

  async function verifyContentHash(input, expected, cryptoScope) {
    const checksum = boundedText(expected, 180);
    if (!checksum) return { verified: false, reason: "missing-checksum", actual: "" };
    const isSha = /^(?:sampled-)?sha256-[0-9a-f]{64}(?:-\d+)?$/i.test(checksum);
    const isFnv = /^(?:sampled-)?fnv1a-[0-9a-f]{8}-\d+$/i.test(checksum);
    if (!isSha && !isFnv) return { verified: false, reason: "unsupported-checksum", actual: "" };
    const cryptoApi = cryptoScope || globalScope.crypto;
    if (isSha && !cryptoApi?.subtle?.digest) return { verified: false, reason: "sha256-unavailable", actual: "" };
    const actual = await computeContentHash(input, isFnv ? {} : cryptoApi);
    return { verified: actual === checksum, reason: actual === checksum ? "match" : "mismatch", actual };
  }

  async function inspectAssetBlob(blob, input) {
    if (!(blob instanceof Blob)) return { status: "metadata-only", detectedType: "", safeToPreview: false };
    if (blob.size > MAX_ASSET_BYTES) throw new Error("Asset vượt giới hạn an toàn 4 GB.");
    const name = boundedText(input?.name, 240, "asset.bin");
    const claimedType = boundedText(input?.type || blob.type, 160, "application/octet-stream").toLowerCase();
    const kind = classifyAsset(claimedType, name);
    const bytes = new Uint8Array(await blob.slice(0, 32).arrayBuffer());
    const ascii = String.fromCharCode(...bytes);
    let detectedType = "";
    if (bytes[0] === 0x89 && ascii.slice(1, 4) === "PNG") detectedType = "image/png";
    else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) detectedType = "image/jpeg";
    else if (["GIF87a", "GIF89a"].includes(ascii.slice(0, 6))) detectedType = "image/gif";
    else if (ascii.slice(0, 4) === "RIFF" && ascii.slice(8, 12) === "WEBP") detectedType = "image/webp";
    else if (ascii.slice(4, 8) === "ftyp") detectedType = kind === "audio" ? "audio/mp4" : "video/mp4";
    else if (ascii.slice(0, 4) === "OggS") detectedType = kind === "audio" ? "audio/ogg" : "video/ogg";
    else if (ascii.slice(0, 4) === "%PDF") detectedType = "application/pdf";
    else if (ascii.slice(0, 4) === "wOFF") detectedType = "font/woff";
    else if (ascii.slice(0, 4) === "wOF2") detectedType = "font/woff2";
    if (kind === "svg") {
      if (blob.size > MAX_SVG_BYTES) throw new Error("SVG vượt giới hạn kiểm tra an toàn 5 MB.");
      const markup = await blob.text();
      if (/<script\b|\bon[a-z]+\s*=|javascript\s*:|<!ENTITY\b|<foreignObject\b|@import\b|(?:href|xlink:href)\s*=\s*["']\s*(?:https?:|\/\/)|url\s*\(\s*["']?\s*(?:https?:|\/\/)/i.test(markup)) throw new Error("SVG chứa nội dung chủ động hoặc tham chiếu ngoài không an toàn.");
      if (!/<svg\b/i.test(markup)) return { status: "signature-mismatch", detectedType: "", safeToPreview: false };
      detectedType = "image/svg+xml";
    }
    const exact = !detectedType || claimedType === "application/octet-stream" || claimedType === detectedType || (claimedType.startsWith("audio/") && detectedType.startsWith("audio/")) || (claimedType.startsWith("video/") && detectedType.startsWith("video/"));
    return {
      status: detectedType ? (exact ? "verified" : "signature-mismatch") : "unverified",
      detectedType,
      claimedType,
      safeToPreview: Boolean(detectedType && exact && ["image", "svg"].includes(kind))
    };
  }

  function createCommandHistory(options) {
    const limit = Math.max(1, Math.min(MAX_COMMAND_HISTORY, Number(options?.limit) || MAX_COMMAND_HISTORY));
    const undoStack = [];
    const redoStack = [];
    let busy = false;
    const notify = () => options?.onChange?.({ canUndo: undoStack.length > 0, canRedo: redoStack.length > 0, undoLabel: undoStack.at(-1)?.label || "", redoLabel: redoStack.at(-1)?.label || "" });
    const validate = (command) => {
      if (!command || typeof command.undo !== "function" || typeof command.redo !== "function") throw new TypeError("Lệnh cần hàm undo và redo.");
      return { label: boundedText(command.label, 120, "Thay đổi"), undo: command.undo, redo: command.redo };
    };
    return Object.freeze({
      async execute(command) {
        if (busy) throw new Error("Một thao tác lịch sử đang chạy.");
        const entry = validate(command); busy = true;
        try { const result = await entry.redo(); undoStack.push(entry); if (undoStack.length > limit) undoStack.shift(); redoStack.length = 0; notify(); return result; }
        finally { busy = false; }
      },
      async undo() {
        if (busy || !undoStack.length) return false;
        busy = true; const entry = undoStack.pop();
        try { await entry.undo(); redoStack.push(entry); notify(); return true; }
        catch (error) { undoStack.push(entry); notify(); throw error; }
        finally { busy = false; }
      },
      async redo() {
        if (busy || !redoStack.length) return false;
        busy = true; const entry = redoStack.pop();
        try { await entry.redo(); undoStack.push(entry); notify(); return true; }
        catch (error) { redoStack.push(entry); notify(); throw error; }
        finally { busy = false; }
      },
      clear() { if (!busy) { undoStack.length = 0; redoStack.length = 0; notify(); } },
      get state() { return { canUndo: undoStack.length > 0, canRedo: redoStack.length > 0, undoLabel: undoStack.at(-1)?.label || "", redoLabel: redoStack.at(-1)?.label || "", busy }; }
    });
  }

  async function extractMetadata(file, env) {
    const scope = env || globalScope;
    const kind = classifyAsset(file?.type, file?.name);
    const metadata = {
      source: "local-file",
      extension: extensionOf(file?.name),
      capturedAt: now(),
      dimensionsStatus: "not-applicable",
      durationStatus: "not-applicable"
    };
    if (!(file instanceof Blob)) return metadata;
    if (kind === "image" && typeof scope.createImageBitmap === "function") {
      try {
        const bitmap = await scope.createImageBitmap(file);
        metadata.width = bitmap.width;
        metadata.height = bitmap.height;
        metadata.dimensionsStatus = "measured";
        bitmap.close?.();
      } catch (_) {
        metadata.dimensionsStatus = "decoder-unavailable";
      }
    } else if (["video", "audio"].includes(kind) && scope.document && scope.URL?.createObjectURL) {
      metadata.durationStatus = "pending-decoder";
      const element = scope.document.createElement(kind === "video" ? "video" : "audio");
      const url = scope.URL.createObjectURL(file);
      try {
        await new Promise((resolve, reject) => {
          const timer = scope.setTimeout(() => reject(new Error("metadata timeout")), 3000);
          element.preload = "metadata";
          element.onloadedmetadata = () => { scope.clearTimeout(timer); resolve(); };
          element.onerror = () => { scope.clearTimeout(timer); reject(new Error("decoder error")); };
          element.src = url;
        });
        metadata.duration = Number.isFinite(element.duration) ? element.duration : 0;
        metadata.durationStatus = "measured";
        if (kind === "video") {
          metadata.width = element.videoWidth;
          metadata.height = element.videoHeight;
          metadata.dimensionsStatus = "measured";
        }
      } catch (_) {
        metadata.durationStatus = "decoder-unavailable";
      } finally {
        scope.URL.revokeObjectURL(url);
      }
    }
    return metadata;
  }

  function createMemoryBackend(fallbackReason) {
    const stores = Object.fromEntries(STORE_NAMES.map((name) => [name, new Map()]));
    return {
      type: "memory",
      persistent: false,
      fallbackReason: boundedText(fallbackReason, 180, "indexeddb-unavailable"),
      async get(store, key) { return clone(stores[store].get(key)); },
      async put(store, value) { stores[store].set(value.id, clone(value)); return clone(value); },
      async delete(store, key) { stores[store].delete(key); return true; },
      async all(store) { return [...stores[store].values()].map(clone); },
      async clear(store) { stores[store].clear(); },
      close() {}
    };
  }

  function requestPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
    });
  }

  async function createIndexedDbBackend(indexedDB, dbName) {
    const request = indexedDB.open(dbName, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      STORE_NAMES.forEach((name) => {
        if (!database.objectStoreNames.contains(name)) database.createObjectStore(name, { keyPath: "id" });
      });
    };
    const database = await requestPromise(request);
    function objectStore(name, mode) {
      return database.transaction(name, mode).objectStore(name);
    }
    return {
      type: "indexeddb",
      persistent: true,
      fallbackReason: "",
      get: (store, key) => requestPromise(objectStore(store, "readonly").get(key)),
      put: (store, value) => requestPromise(objectStore(store, "readwrite").put(value)).then(() => clone(value)),
      delete: (store, key) => requestPromise(objectStore(store, "readwrite").delete(key)).then(() => true),
      all: (store) => requestPromise(objectStore(store, "readonly").getAll()),
      clear: (store) => requestPromise(objectStore(store, "readwrite").clear()),
      close: () => database.close()
    };
  }

  async function createBackend(options) {
    if (options?.backend) return options.backend;
    const indexedDB = Object.prototype.hasOwnProperty.call(options || {}, "indexedDB") ? options.indexedDB : globalScope.indexedDB;
    if (!indexedDB?.open) return createMemoryBackend("indexeddb-unavailable");
    try {
      return await createIndexedDbBackend(indexedDB, options?.dbName || DB_NAME);
    } catch (error) {
      return createMemoryBackend(`indexeddb-open-failed:${boundedText(error?.name || "unknown", 80)}`);
    }
  }

  async function blobToBase64(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    const encoder = typeof btoa === "function" ? btoa : (value) => Buffer.from(value, "binary").toString("base64");
    return encoder(binary);
  }

  function base64ToBlob(base64, type) {
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(String(base64 || ""))) throw new Error("Dữ liệu asset không phải Base64 hợp lệ.");
    const decoder = typeof atob === "function" ? atob : (value) => Buffer.from(value, "base64").toString("binary");
    const binary = decoder(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new Blob([bytes], { type: boundedText(type, 160, "application/octet-stream") });
  }

  function createStore(options) {
    const backendPromise = createBackend(options || {});
    const withBackend = async (callback) => callback(await backendPromise);

    async function migrateStoredRecord(storeName, raw, normalizer) {
      if (!raw) return null;
      const migrated = normalizer(raw);
      if (raw.schema !== SCHEMA || Number(raw.recordVersion) !== RECORD_VERSION) await withBackend((backend) => backend.put(storeName, migrated));
      return migrated;
    }

    async function saveProject(input) {
      const existing = input?.id ? await withBackend((backend) => backend.get("projects", input.id)) : null;
      if (!existing) {
        const count = (await withBackend((backend) => backend.all("projects"))).length;
        if (count >= MAX_PROJECTS) throw new Error(`Kho local chỉ giữ tối đa ${MAX_PROJECTS} project và template.`);
      }
      const project = normalizeProject({ ...existing, ...input, createdAt: existing?.createdAt || input?.createdAt, updatedAt: now(), revision: existing ? Math.max(existing.revision + 1, Number(input.revision) || 0) : input?.revision });
      if (JSON.stringify(project).length > MAX_PROJECT_JSON_BYTES) throw new Error("Dự án vượt giới hạn metadata 1 MB.");
      await withBackend((backend) => backend.put("projects", project));
      return clone(project);
    }

    async function getProject(id) {
      return migrateStoredRecord("projects", await withBackend((backend) => backend.get("projects", id)), migrateProjectRecord);
    }

    async function listProjects(query) {
      const projects = await withBackend((backend) => backend.all("projects"));
      return Promise.all(projects.map((project) => migrateStoredRecord("projects", project, migrateProjectRecord))).then((rows) => rows.filter((project) => {
        if (!query?.includeTemplates && project.projectKind === "template") return false;
        if (!query?.includeArchived && project.lifecycle === "archived") return false;
        if (query?.kind && project.projectKind !== query.kind) return false;
        return true;
      }).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))));
    }

    async function createProject(input) {
      return saveProject({ ...(input || {}), id: input?.id || uid("media-project"), projectKind: "project", lifecycle: "active", archivedAt: "", recovery: normalizeRecovery() });
    }

    async function archiveProject(projectId, archived) {
      const project = await getProject(projectId);
      if (!project || project.projectKind !== "project") throw new Error("Không tìm thấy project để lưu trữ.");
      const shouldArchive = archived !== false;
      return saveProject({ ...project, lifecycle: shouldArchive ? "archived" : "active", archivedAt: shouldArchive ? now() : "" });
    }

    async function duplicateProject(projectId, duplicateOptions) {
      const source = await getProject(projectId);
      if (!source || source.projectKind !== "project") throw new Error("Không tìm thấy project cần nhân bản.");
      const includeAssets = duplicateOptions?.includeAssets !== false;
      const sourceAssets = includeAssets ? await listAssets(projectId) : [];
      const idMap = new Map(sourceAssets.map((asset) => [asset.id, uid("asset")]));
      let duplicate = normalizeProject({
        ...source,
        id: uid("media-project"), name: boundedText(duplicateOptions?.name, 160, `${source.name} · bản sao`),
        projectKind: "project", lifecycle: "active", archivedAt: "", templateSourceId: null,
        createdAt: now(), updatedAt: now(), assetIds: [], snapshots: [],
        references: remapIds(source.references, idMap), canvas: remapIds(source.canvas, idMap), timeline: remapIds(source.timeline, idMap),
        document: remapIds(source.document, idMap), workspace: remapIds(source.workspace, idMap),
        ingestJobs: [], recovery: normalizeRecovery(), exportJobs: [], revision: 1
      });
      try {
        duplicate = await saveProject(duplicate);
        const importedIds = [];
        for (const sourceAsset of sourceAssets) {
          const copied = await saveAsset({
            ...sourceAsset, id: idMap.get(sourceAsset.id), originId: sourceAsset.originId || sourceAsset.id, projectId: duplicate.id,
            duplicateOf: idMap.get(sourceAsset.duplicateOf) || null, references: remapIds(sourceAsset.references, idMap), effects: remapIds(sourceAsset.effects, idMap),
            versions: [], provenance: { ...sourceAsset.provenance, sourceId: sourceAsset.id }, blob: sourceAsset.blob, thumbnailBlob: sourceAsset.thumbnailBlob
          });
          importedIds.push(copied.id);
        }
        return saveProject({ ...duplicate, assetIds: importedIds });
      } catch (error) {
        await deleteProject(duplicate.id).catch(() => {});
        throw error;
      }
    }

    async function createTemplateFromProject(projectId, templateInput) {
      const source = await getProject(projectId);
      if (!source || source.projectKind !== "project") throw new Error("Không tìm thấy project nguồn cho template.");
      const assetIds = new Set(source.assetIds);
      return saveProject({
        ...source, id: uid("media-template"), name: boundedText(templateInput?.name, 160, `${source.name} · template`),
        description: boundedText(templateInput?.description, 1200, source.description), projectKind: "template", lifecycle: "active", archivedAt: "",
        templateSourceId: source.id, createdAt: now(), updatedAt: now(), assetIds: [], folders: [normalizeFolder({ id: ROOT_FOLDER_ID }, 0)],
        references: scrubAssetReferences(source.references, assetIds), canvas: scrubAssetReferences(source.canvas, assetIds),
        timeline: scrubAssetReferences(source.timeline, assetIds), document: scrubAssetReferences(source.document, assetIds),
        workspace: scrubAssetReferences(source.workspace, assetIds), presets: source.presets.map((preset) => ({ ...preset, payload: scrubAssetReferences(preset.payload, assetIds) })),
        ingestJobs: [], recovery: normalizeRecovery(), exportJobs: [], revision: 1
      });
    }

    async function instantiateTemplate(templateId, projectInput) {
      const template = await getProject(templateId);
      if (!template || template.projectKind !== "template") throw new Error("Không tìm thấy template.");
      return createProject({
        ...template, id: uid("media-project"), name: boundedText(projectInput?.name, 160, template.name.replace(/\s*·\s*template$/i, "") || "Project từ template"),
        description: boundedText(projectInput?.description, 1200, template.description), templateSourceId: template.id,
        createdAt: now(), updatedAt: now(), assetIds: [], ingestJobs: [], recovery: normalizeRecovery(), exportJobs: [], revision: 1
      });
    }

    async function listTemplates() {
      return listProjects({ includeTemplates: true, kind: "template" });
    }

    async function saveProjectPreset(projectId, presetInput) {
      const project = await getProject(projectId);
      if (!project) throw new Error("Không tìm thấy project.");
      const existingIndex = project.presets.findIndex((preset) => preset.id === presetInput?.id);
      const preset = normalizeProjectPreset({ ...presetInput, id: presetInput?.id || uid("preset"), createdAt: existingIndex >= 0 ? project.presets[existingIndex].createdAt : now(), updatedAt: now() }, Math.max(0, existingIndex));
      const presets = project.presets.slice();
      if (existingIndex >= 0) presets[existingIndex] = preset;
      else {
        if (presets.length >= MAX_PROJECT_PRESETS) throw new Error(`Mỗi project tối đa ${MAX_PROJECT_PRESETS} preset.`);
        presets.push(preset);
      }
      await saveProject({ ...project, presets });
      return clone(preset);
    }

    async function applyProjectPreset(projectId, presetId) {
      const project = await getProject(projectId);
      const preset = project?.presets?.find((item) => item.id === presetId);
      if (!project || !preset) throw new Error("Không tìm thấy preset.");
      const patch = preset.section === "workspace" ? { workspace: normalizeSharedWorkspace(preset.payload) } : { [preset.section]: safeJsonValue(preset.payload, 0) };
      return saveProject({ ...project, ...patch });
    }

    async function deleteProjectPreset(projectId, presetId) {
      const project = await getProject(projectId);
      if (!project) throw new Error("Không tìm thấy project.");
      if (!project.presets.some((preset) => preset.id === presetId)) return false;
      await saveProject({ ...project, presets: project.presets.filter((preset) => preset.id !== presetId) });
      return true;
    }

    async function linkAssetToWorkspace(projectId, assetId, collection, input) {
      const allowed = ["layers", "tracks", "clips", "pages", "scenes"];
      if (!allowed.includes(collection)) throw new Error("Vùng đích của asset không được hỗ trợ.");
      const project = await getProject(projectId);
      const asset = await getAsset(assetId);
      if (!project || !asset || asset.projectId !== projectId || !project.assetIds.includes(assetId)) throw new Error("Asset không thuộc project hiện tại.");
      const current = normalizeSharedWorkspace(project.workspace);
      if (current[collection].length >= MAX_SHARED_ENTITIES) throw new Error(`Vùng ${collection} đã đạt giới hạn ${MAX_SHARED_ENTITIES} mục.`);
      const entity = normalizeSharedEntity({ ...input, id: input?.id || uid(collection.slice(0, -1)), name: input?.name || asset.name, assetId }, current[collection].length, collection.slice(0, -1));
      if (current[collection].some((item) => item.id === entity.id)) throw new Error("ID liên kết workspace đã tồn tại.");
      const workspace = { ...current, [collection]: [...current[collection], entity] };
      await saveProject({ ...project, workspace });
      await updateAsset(assetId, { references: [...(Array.isArray(asset.references) ? asset.references : []), entity.id] });
      return clone(entity);
    }

    async function unlinkAssetFromWorkspace(projectId, collection, entityId) {
      const allowed = ["layers", "tracks", "clips", "pages", "scenes"];
      if (!allowed.includes(collection)) throw new Error("Vùng đích của asset không được hỗ trợ.");
      const project = await getProject(projectId);
      if (!project) throw new Error("Không tìm thấy project.");
      const current = normalizeSharedWorkspace(project.workspace);
      const entity = current[collection].find((item) => item.id === entityId);
      if (!entity) return false;
      await saveProject({ ...project, workspace: { ...current, [collection]: current[collection].filter((item) => item.id !== entityId) } });
      if (entity.assetId) {
        const asset = await getAsset(entity.assetId);
        if (asset) await updateAsset(asset.id, { references: (Array.isArray(asset.references) ? asset.references : []).filter((reference) => reference !== entityId) });
      }
      return true;
    }

    async function createFolder(projectId, input) {
      const project = await getProject(projectId);
      if (!project) throw new Error("Không tìm thấy dự án.");
      if (project.folders.length >= MAX_FOLDERS) throw new Error(`Mỗi dự án tối đa ${MAX_FOLDERS} thư mục.`);
      const folder = normalizeFolder({ ...input, id: input?.id || uid("folder") }, project.folders.length);
      if (project.folders.some((item) => item.id === folder.id)) throw new Error("ID thư mục đã tồn tại.");
      if (!project.folders.some((item) => item.id === folder.parentId)) folder.parentId = ROOT_FOLDER_ID;
      await saveProject({ ...project, folders: [...project.folders, folder] });
      return clone(folder);
    }

    async function deleteFolder(projectId, folderId) {
      if (folderId === ROOT_FOLDER_ID) throw new Error("Không thể xóa Media Bin gốc.");
      const project = await getProject(projectId);
      if (!project) throw new Error("Không tìm thấy dự án.");
      const assets = await listAssets(projectId);
      await Promise.all(assets.filter((asset) => asset.folderId === folderId).map((asset) => updateAsset(asset.id, { folderId: ROOT_FOLDER_ID })));
      await saveProject({ ...project, folders: project.folders.filter((folder) => folder.id !== folderId).map((folder) => folder.parentId === folderId ? { ...folder, parentId: ROOT_FOLDER_ID } : folder) });
      return true;
    }

    async function listAllProjectAssets(projectId) {
      const assets = await withBackend((backend) => backend.all("assets"));
      const rows = assets.filter((asset) => !projectId || asset.projectId === projectId);
      return Promise.all(rows.map((asset) => migrateStoredRecord("assets", asset, migrateAssetRecord)));
    }

    async function listAssets(projectId, query) {
      const assets = await listAllProjectAssets(projectId);
      const project = projectId ? await getProject(projectId) : null;
      const activeIds = project ? new Set(project.assetIds) : null;
      const projectAssets = assets.filter((asset) => !activeIds || activeIds.has(asset.id));
      return searchAssets(projectAssets, query?.text, query).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    }

    async function getAsset(id) {
      return migrateStoredRecord("assets", await withBackend((backend) => backend.get("assets", id)), migrateAssetRecord);
    }

    async function findDuplicate(projectId, checksum, exceptId) {
      if (!checksum) return null;
      const assets = await listAssets(projectId);
      return assets.find((asset) => asset.id !== exceptId && asset.checksum === checksum) || null;
    }

    async function repairDuplicateLinks(projectId) {
      const assets = await listAssets(projectId);
      const leaders = new Map();
      for (const asset of assets.slice().sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))) {
        if (!asset.checksum) continue;
        const leader = leaders.get(asset.checksum);
        const duplicateOf = leader?.id || null;
        const duplicateConfidence = duplicateOf ? (asset.checksumMode === "sampled" ? "probable" : "exact") : "none";
        if (asset.duplicateOf !== duplicateOf || asset.duplicateConfidence !== duplicateConfidence) {
          await withBackend((backend) => backend.put("assets", normalizeAsset({ ...asset, duplicateOf, duplicateConfidence, updatedAt: now() })));
        }
        if (!leader) leaders.set(asset.checksum, asset);
      }
    }

    async function saveAsset(input) {
      if (!input?.projectId) throw new Error("Asset cần projectId.");
      const project = await getProject(input.projectId);
      if (!project) throw new Error("Không tìm thấy dự án chứa asset.");
      const existing = input.id ? await getAsset(input.id) : null;
      if (existing && existing.projectId !== project.id) throw new Error("ID asset đã thuộc một dự án khác.");
      if (!existing && project.assetIds.length >= MAX_ASSETS) throw new Error(`Mỗi dự án tối đa ${MAX_ASSETS} asset.`);
      if (input.blob instanceof Blob && input.blob.size > MAX_ASSET_BYTES) throw new Error("Asset vượt giới hạn an toàn 4 GB.");
      const folderId = project.folders.some((folder) => folder.id === input.folderId) ? input.folderId : ROOT_FOLDER_ID;
      const validation = input.blob instanceof Blob ? await inspectAssetBlob(input.blob, input) : { status: "metadata-only", detectedType: "", safeToPreview: false };
      const checksum = input.checksum || (input.blob instanceof Blob ? await computeContentHash(input.blob, options?.crypto) : "");
      const duplicate = await findDuplicate(input.projectId, checksum, input.id);
      const checksumMode = String(checksum).startsWith("sampled-") ? "sampled" : checksum ? "full" : "unavailable";
      const asset = normalizeAsset({
        ...existing,
        ...input,
        id: existing?.id || input.id,
        projectId: project.id,
        folderId,
        createdAt: existing?.createdAt || input.createdAt,
        updatedAt: now(),
        size: input.blob instanceof Blob ? input.blob.size : input.size,
        metadata: { ...safeJsonValue(input.metadata || existing?.metadata || {}, 0), validation },
        checksum,
        checksumMode,
        duplicateOf: duplicate?.id || null,
        duplicateConfidence: duplicate ? (checksumMode === "sampled" ? "probable" : "exact") : "none",
        provenance: input.provenance || existing?.provenance || { sourceType: input.blob ? "local-file" : "unknown", originalName: input.name },
        blob: input.blob instanceof Blob ? input.blob : existing?.blob || null,
        thumbnailBlob: input.thumbnailBlob instanceof Blob ? input.thumbnailBlob : existing?.thumbnailBlob || null
      });
      await withBackend((backend) => backend.put("assets", asset));
      if (!project.assetIds.includes(asset.id)) await saveProject({ ...project, assetIds: [...project.assetIds, asset.id] });
      return clone(asset);
    }

    async function updateAsset(id, patch) {
      const existing = await getAsset(id);
      if (!existing) throw new Error("Không tìm thấy asset.");
      const immutable = { id: existing.id, projectId: existing.projectId, createdAt: existing.createdAt };
      const project = await getProject(existing.projectId);
      const cleanPatch = safeJsonValue(patch || {}, 0);
      if (cleanPatch.folderId && !project?.folders?.some((folder) => folder.id === cleanPatch.folderId)) cleanPatch.folderId = ROOT_FOLDER_ID;
      const asset = normalizeAsset({ ...existing, ...cleanPatch, ...immutable, updatedAt: now(), blob: patch?.blob instanceof Blob ? patch.blob : existing.blob, thumbnailBlob: patch?.thumbnailBlob instanceof Blob ? patch.thumbnailBlob : existing.thumbnailBlob });
      await withBackend((backend) => backend.put("assets", asset));
      return clone(asset);
    }

    async function replaceAsset(id, replacement) {
      const existing = await getAsset(id);
      if (!existing) throw new Error("Không tìm thấy asset cần thay thế.");
      const blob = replacement?.blob instanceof Blob ? replacement.blob : null;
      if (!blob) throw new Error("Tệp thay thế không hợp lệ.");
      const validation = await inspectAssetBlob(blob, replacement);
      const checksum = await computeContentHash(blob, options?.crypto);
      const duplicate = await findDuplicate(existing.projectId, checksum, id);
      const previousVersion = normalizeAssetVersion({ ...existing, reason: replacement.reason || "Thay thế tệp nguồn", checksumMode: existing.checksumMode, blob: existing.blob?.size <= MAX_VERSION_BINARY_BYTES ? existing.blob : null });
      const checksumMode = checksum.startsWith("sampled-") ? "sampled" : "full";
      const replaced = normalizeAsset({
        ...existing,
        name: replacement.name || existing.name,
        type: replacement.type || blob.type || existing.type,
        size: blob.size,
        lastModified: replacement.lastModified || 0,
        metadata: { ...safeJsonValue(replacement.metadata || {}, 0), validation },
        checksum,
        checksumMode,
        duplicateOf: duplicate?.id || null,
        duplicateConfidence: duplicate ? (checksumMode === "sampled" ? "probable" : "exact") : "none",
        availability: "ready",
        blob,
        thumbnailBlob: replacement.thumbnailBlob || null,
        thumbnail: replacement.thumbnail || { status: "pending", reason: "Asset vừa được thay thế" },
        references: existing.references,
        effects: existing.effects,
        versions: normalizeAssetVersions([...existing.versions, previousVersion]),
        rights: replacement.rights || existing.rights,
        provenance: replacement.provenance || { ...existing.provenance, originalName: replacement.name || existing.name },
        id: existing.id,
        projectId: existing.projectId,
        folderId: existing.folderId,
        tags: existing.tags,
        favorite: existing.favorite,
        createdAt: existing.createdAt
      });
      await withBackend((backend) => backend.put("assets", replaced));
      await repairDuplicateLinks(existing.projectId);
      return clone(replaced);
    }

    async function relinkAsset(id, replacement, relinkOptions) {
      const existing = await getAsset(id);
      if (!existing) throw new Error("Không tìm thấy asset cần relink.");
      const blob = replacement?.blob instanceof Blob ? replacement.blob : null;
      if (!blob) throw new Error("Tệp relink không hợp lệ.");
      const checksum = await computeContentHash(blob, options?.crypto);
      const sameAlgorithm = existing.checksum && existing.checksum.split("-")[0] === checksum.split("-")[0];
      if (existing.checksum && sameAlgorithm && existing.checksum !== checksum && relinkOptions?.acceptChangedContent !== true) {
        throw new Error("Tệp relink không khớp checksum. Hãy dùng Thay tệp nếu đây là phiên bản nội dung mới.");
      }
      if (existing.checksum && existing.checksum !== checksum && relinkOptions?.acceptChangedContent !== true) {
        throw new Error("Không thể xác minh checksum bằng cùng thuật toán. Hãy xác nhận thay đổi nội dung để tiếp tục.");
      }
      return replaceAsset(id, { ...replacement, reason: existing.availability === "ready" ? "Relink nguồn" : "Khôi phục liên kết nguồn" });
    }

    async function restoreAssetVersion(id, versionId) {
      const existing = await getAsset(id);
      if (!existing) throw new Error("Không tìm thấy asset.");
      const version = existing.versions.find((item) => item.id === versionId);
      if (!version) throw new Error("Không tìm thấy phiên bản asset.");
      if (!(version.blob instanceof Blob)) throw new Error("Phiên bản này chỉ giữ metadata/checksum và cần relink binary nguồn.");
      const remaining = existing.versions.filter((item) => item.id !== version.id);
      const currentVersion = normalizeAssetVersion({ ...existing, reason: `Trước khi khôi phục ${version.name}`, blob: existing.blob?.size <= MAX_VERSION_BINARY_BYTES ? existing.blob : null });
      const restored = normalizeAsset({
        ...existing,
        name: version.name,
        type: version.type,
        size: version.blob.size,
        checksum: version.checksum,
        checksumMode: version.checksumMode,
        metadata: version.metadata,
        rights: version.rights,
        availability: "ready",
        blob: version.blob,
        versions: normalizeAssetVersions([...remaining, currentVersion])
      });
      await withBackend((backend) => backend.put("assets", restored));
      await repairDuplicateLinks(existing.projectId);
      return getAsset(id);
    }

    async function restoreAssetRecord(record) {
      const clean = migrateAssetRecord(record);
      const project = await getProject(clean.projectId);
      if (!project) throw new Error("Không tìm thấy dự án để khôi phục asset.");
      await withBackend((backend) => backend.put("assets", normalizeAsset({ ...clean, updatedAt: now() })));
      if (!project.assetIds.includes(clean.id)) await saveProject({ ...project, assetIds: [...project.assetIds, clean.id] });
      await repairDuplicateLinks(clean.projectId);
      return getAsset(clean.id);
    }

    async function removeAsset(id) {
      const asset = await getAsset(id);
      if (!asset) return false;
      await withBackend((backend) => backend.delete("assets", id));
      const project = await getProject(asset.projectId);
      if (project) await saveProject({ ...project, assetIds: project.assetIds.filter((assetId) => assetId !== id) });
      await repairDuplicateLinks(asset.projectId);
      return true;
    }

    async function touchAsset(id) {
      return updateAsset(id, { lastOpenedAt: now() });
    }

    async function registerIngestJob(projectId, fileInfo, ingestOptions) {
      const project = await getProject(projectId);
      if (!project) throw new Error("Không tìm thấy project.");
      const fingerprint = ingestFingerprint(fileInfo);
      const existing = project.ingestJobs.find((job) => job.fingerprint === fingerprint && !["complete", "cancelled"].includes(job.status));
      if (existing) return clone(existing);
      const job = normalizeIngestJob({ id: uid("ingest"), file: fileInfo, folderId: ingestOptions?.folderId, status: "awaiting-file", createdAt: now(), updatedAt: now() }, project.ingestJobs.length);
      await saveProject({ ...project, ingestJobs: [...project.ingestJobs, job].slice(-MAX_INGEST_JOBS) });
      return clone(job);
    }

    async function listIngestJobs(projectId, query) {
      const project = await getProject(projectId);
      if (!project) throw new Error("Không tìm thấy project.");
      return project.ingestJobs.filter((job) => !query?.status || job.status === query.status).map(clone);
    }

    async function resumeIngestJob(projectId, jobId, file, ingestOptions) {
      let project = await getProject(projectId);
      const job = project?.ingestJobs?.find((item) => item.id === jobId);
      if (!project || !job) throw new Error("Không tìm thấy checkpoint nhập tệp.");
      if (job.status === "cancelled") throw new Error("Checkpoint đã bị hủy.");
      if (!(file instanceof Blob) || ingestFingerprint(file) !== job.fingerprint) throw new Error("Tệp được chọn không khớp tên, kích thước và thời gian của checkpoint.");
      const existingAsset = (await listAssets(projectId)).find((asset) => asset.provenance?.sourceId === job.id);
      try {
        const metadata = ingestOptions?.metadata || await extractMetadata(file, ingestOptions?.env || globalScope);
        const asset = existingAsset || await saveAsset({
          projectId, folderId: project.folders.some((folder) => folder.id === job.folderId) ? job.folderId : ROOT_FOLDER_ID,
          name: file.name || job.file.name, type: file.type || job.file.type, size: file.size, lastModified: file.lastModified || job.file.lastModified,
          metadata: { ...safeJsonValue(metadata, 0), ingestJobId: job.id }, provenance: { sourceType: "local-file", sourceId: job.id, originalName: file.name || job.file.name }, blob: file
        });
        project = await getProject(projectId);
        await saveProject({ ...project, ingestJobs: project.ingestJobs.map((item) => item.id === job.id ? normalizeIngestJob({ ...item, status: "complete", assetId: asset.id, error: "", attempts: item.attempts + 1, updatedAt: now() }) : item) });
        return clone(asset);
      } catch (error) {
        const failure = classifyStorageError(error);
        project = await getProject(projectId);
        await saveProject({ ...project, ingestJobs: project.ingestJobs.map((item) => item.id === job.id ? normalizeIngestJob({ ...item, status: "failed", error: failure.code === "storage-failed" ? boundedText(error?.message, 300, failure.message) : failure.message, attempts: item.attempts + 1, updatedAt: now() }) : item) }).catch(() => {});
        throw error;
      }
    }

    async function cancelIngestJob(projectId, jobId) {
      const project = await getProject(projectId);
      const job = project?.ingestJobs?.find((item) => item.id === jobId);
      if (!project || !job) return false;
      if (job.status === "complete") throw new Error("Asset đã nhập xong; hãy xóa asset nếu không còn cần.");
      await saveProject({ ...project, ingestJobs: project.ingestJobs.map((item) => item.id === jobId ? normalizeIngestJob({ ...item, status: "cancelled", error: "", updatedAt: now() }) : item) });
      return true;
    }

    async function startProjectSession(projectId, sessionId) {
      const project = await getProject(projectId);
      if (!project) throw new Error("Không tìm thấy project.");
      const previousSessionUnclean = project.recovery.cleanlyClosed === false;
      return saveProject({ ...project, lastOpenedAt: now(), recovery: { ...project.recovery, sessionId: boundedText(sessionId, 120, uid("session")), sessionStartedAt: now(), cleanlyClosed: false, previousSessionUnclean, lastAutosaveError: "" } });
    }

    async function finishProjectSession(projectId, sessionId) {
      const project = await getProject(projectId);
      if (!project) return null;
      if (sessionId && project.recovery.sessionId && project.recovery.sessionId !== sessionId) return project;
      return saveProject({ ...project, recovery: { ...project.recovery, cleanlyClosed: true, previousSessionUnclean: false, lastCleanCloseAt: now(), lastAutosaveError: "" } });
    }

    async function createSnapshot(projectId, label, note) {
      const project = await getProject(projectId);
      if (!project) throw new Error("Không tìm thấy dự án.");
      const existing = await listSnapshots(projectId);
      if (existing.length >= MAX_SNAPSHOTS) await withBackend((backend) => backend.delete("snapshots", existing[existing.length - 1].id));
      const assets = await listAssets(projectId);
      const snapshot = normalizeSnapshot({ projectId, label, note, project, assets });
      await withBackend((backend) => backend.put("snapshots", snapshot));
      return clone(snapshot);
    }

    async function listSnapshots(projectId) {
      const snapshots = await withBackend((backend) => backend.all("snapshots"));
      const rows = snapshots.filter((snapshot) => !projectId || snapshot.projectId === projectId);
      return Promise.all(rows.map((snapshot) => migrateStoredRecord("snapshots", snapshot, migrateSnapshotRecord))).then((items) => items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
    }

    async function restoreSnapshot(snapshotId) {
      const rawSnapshot = await withBackend((backend) => backend.get("snapshots", snapshotId));
      if (!rawSnapshot) throw new Error("Không tìm thấy snapshot.");
      const snapshot = migrateSnapshotRecord(rawSnapshot);
      const currentAssets = new Map((await listAllProjectAssets(snapshot.projectId)).map((asset) => [asset.id, asset]));
      const project = await saveProject({ ...snapshot.project, id: snapshot.projectId });
      for (const metadata of snapshot.assets) {
        const current = currentAssets.get(metadata.id);
        await withBackend((backend) => backend.put("assets", normalizeAsset({ ...metadata, blob: current?.blob || null, thumbnailBlob: current?.thumbnailBlob || null, availability: current?.blob ? metadata.availability : "offline" })));
      }
      await repairDuplicateLinks(snapshot.projectId);
      return clone(project);
    }

    async function recoveryStatus(projectId) {
      const project = await getProject(projectId);
      if (!project) throw new Error("Không tìm thấy dự án.");
      const snapshots = await listSnapshots(projectId);
      const allAssets = await listAllProjectAssets(projectId);
      const activeIds = new Set(project.assetIds);
      const orphanAssetIds = allAssets.filter((asset) => !activeIds.has(asset.id)).map((asset) => asset.id);
      const latest = snapshots[0] || null;
      return {
        projectId,
        latestSnapshotId: latest?.id || null,
        latestSnapshotAt: latest?.createdAt || null,
        hasRecoveryPoint: Boolean(latest),
        changedSinceSnapshot: Boolean(latest && Date.parse(project.updatedAt) > Date.parse(latest.createdAt)),
        orphanAssetIds,
        uncleanSession: project.recovery.cleanlyClosed === false || project.recovery.previousSessionUnclean === true,
        sessionStartedAt: project.recovery.sessionStartedAt || null,
        lastAutosaveAt: project.recovery.lastAutosaveAt || null,
        lastAutosaveError: project.recovery.lastAutosaveError || ""
      };
    }

    function createAutosave(projectId, autosaveOptions) {
      const delay = Math.max(50, Number(autosaveOptions?.delay) || 900);
      const checkpointEvery = Math.max(0, Math.min(100, Number(autosaveOptions?.checkpointEvery) || 0));
      let timer = 0;
      let pending = null;
      let closed = false;
      let saveCount = 0;
      let status = { phase: "idle", pending: false, savedAt: null, error: null };
      const updateStatus = (phase, extra) => {
        status = { ...status, ...extra, phase, pending: Boolean(pending) };
        autosaveOptions?.onState?.(clone(status));
      };
      async function flush() {
        if (!pending || closed) return null;
        clearTimeout(timer);
        const next = pending;
        pending = null;
        updateStatus("saving", { error: null });
        let saved;
        try {
          saved = await saveProject({ ...next, id: projectId, recovery: { ...next.recovery, lastAutosaveAt: now(), lastAutosaveError: "" } });
        } catch (error) {
          pending = next;
          const failure = classifyStorageError(error);
          updateStatus("error", { error: failure, savedAt: status.savedAt });
          throw error;
        }
        saveCount += 1;
        if (checkpointEvery && saveCount % checkpointEvery === 0) {
          try {
            const checkpoint = await createSnapshot(projectId, `Tự động · ${new Date().toLocaleString("vi-VN")}`, "Checkpoint autosave");
            autosaveOptions?.onCheckpoint?.(clone(checkpoint));
          } catch (error) { autosaveOptions?.onError?.(error); }
        }
        updateStatus("saved", { savedAt: saved.updatedAt, error: null });
        autosaveOptions?.onSaved?.(clone(saved));
        return saved;
      }
      return {
        schedule(project) {
          if (closed) return false;
          pending = clone(project);
          clearTimeout(timer);
          updateStatus("scheduled", { error: null });
          timer = setTimeout(() => { flush().catch(autosaveOptions?.onError || (() => {})); }, delay);
          return true;
        },
        flush,
        async dispose(settings) {
          let failure = null;
          try { if (settings?.flush !== false) await flush(); } catch (error) { failure = error; }
          finally { closed = true; clearTimeout(timer); updateStatus("closed", { pending: false }); }
          if (failure) throw failure;
        },
        get pending() { return Boolean(pending); },
        get status() { return clone(status); }
      };
    }

    async function exportPackage(projectId) {
      const project = await getProject(projectId);
      if (!project) throw new Error("Không tìm thấy dự án để đóng gói.");
      const assets = await listAssets(projectId);
      const snapshots = await listSnapshots(projectId);
      let embeddedBytes = 0;
      const warnings = [];
      const packagedAssets = [];
      for (const source of assets.slice(0, MAX_ASSETS)) {
        const asset = normalizeAsset(source);
        const record = { ...asset, blob: undefined, thumbnailBlob: undefined, versions: asset.versions.map((version) => ({ ...version, blob: undefined, binaryRetained: false })), binary: null };
        if (asset.blob && asset.size <= MAX_INLINE_ASSET_BYTES && embeddedBytes + asset.size <= MAX_PACKAGE_TEXT_BYTES / 2) {
          record.binary = { encoding: "base64", type: asset.type, data: await blobToBase64(asset.blob), bytes: asset.size };
          embeddedBytes += asset.size;
        } else if (asset.blob) {
          warnings.push({ code: "binary-omitted", assetId: asset.id, message: `${asset.name} lớn hơn giới hạn nhúng và cần relink sau khi nhập.` });
        }
        packagedAssets.push(record);
      }
      const payload = {
        format: FORMAT,
        schema: SCHEMA,
        version: VERSION,
        recordVersion: RECORD_VERSION,
        exportedAt: now(),
        limits: { maxAssets: MAX_ASSETS, maxInlineAssetBytes: MAX_INLINE_ASSET_BYTES },
        contract: { stableAssetIds: true, binaryOptional: true, missingBinaryRequiresRelink: true, assetVersionBinariesOmittedFromPackage: true },
        project: safeJsonValue(project, 0),
        assets: packagedAssets.map((asset) => {
          const metadata = safeJsonValue({ ...asset, binary: undefined }, 0);
          return { ...metadata, binary: asset.binary };
        }),
        snapshots: snapshots.slice(0, MAX_SNAPSHOTS).map((snapshot) => safeJsonValue(snapshot, 0)),
        warnings
      };
      const text = JSON.stringify(payload);
      if (new TextEncoder().encode(text).byteLength > MAX_PACKAGE_TEXT_BYTES) throw new Error("Gói .hhmedia vượt giới hạn 12 MB.");
      return text;
    }

    async function importPackage(input) {
      if (input instanceof Blob && input.size > MAX_PACKAGE_TEXT_BYTES) throw new Error("Gói .hhmedia vượt giới hạn an toàn 12 MB.");
      const text = typeof input === "string" ? input : await input?.text?.();
      if (typeof text !== "string") throw new Error("Gói .hhmedia không hợp lệ.");
      if (new TextEncoder().encode(text).byteLength > MAX_PACKAGE_TEXT_BYTES) throw new Error("Gói .hhmedia vượt giới hạn an toàn 12 MB.");
      let payload;
      try { payload = JSON.parse(text); } catch (_) { throw new Error("Không đọc được JSON trong gói .hhmedia."); }
      if (payload?.format !== FORMAT || payload?.schema !== SCHEMA || Number(payload?.version) !== VERSION) throw new Error("Phiên bản .hhmedia không được hỗ trợ.");
      if (!payload.project || !Array.isArray(payload.assets) || payload.assets.length > MAX_ASSETS) throw new Error("Manifest .hhmedia không hợp lệ hoặc vượt giới hạn.");
      const oldProjectId = boundedText(payload.project.id, 100);
      const projectId = uid("media-project");
      const idMap = new Map();
      const prepared = [];
      for (const raw of payload.assets) {
        const sourceId = boundedText(raw?.id, 100);
        if (!sourceId || idMap.has(sourceId)) throw new Error("Manifest chứa ID asset trống hoặc trùng lặp.");
        idMap.set(sourceId, uid("asset"));
        const clean = safeJsonValue({ ...raw, binary: undefined }, 0);
        let blob = null;
        if (raw.binary) {
          const binary = raw.binary && typeof raw.binary === "object" ? raw.binary : {};
          if (binary.encoding !== "base64" || Number(binary.bytes) > MAX_INLINE_ASSET_BYTES || typeof binary.data !== "string") throw new Error("Binary asset vượt giới hạn an toàn.");
          if (binary.data.length > Math.ceil(MAX_INLINE_ASSET_BYTES * 4 / 3) + 8) throw new Error("Binary Base64 vượt giới hạn an toàn.");
          blob = base64ToBlob(binary.data, binary.type);
          if (blob.size !== Number(binary.bytes)) throw new Error("Kích thước binary asset không khớp manifest.");
          const expected = boundedText(clean.checksum, 160);
          if (expected) {
            const verification = await verifyContentHash(blob, expected, options?.crypto);
            if (verification.reason === "sha256-unavailable") throw new Error(`Không thể xác minh SHA-256 của asset ${sourceId} trên trình duyệt này.`);
            if (!verification.verified) throw new Error(`Checksum binary không khớp hoặc không được hỗ trợ với asset ${sourceId}.`);
          }
          await inspectAssetBlob(blob, clean);
        }
        prepared.push({ sourceId, clean, blob });
      }
      for (const rawSnapshot of (Array.isArray(payload.snapshots) ? payload.snapshots : []).slice(0, MAX_SNAPSHOTS)) {
        for (const snapshotAsset of (Array.isArray(rawSnapshot?.assets) ? rawSnapshot.assets : []).slice(0, MAX_ASSETS)) {
          const sourceId = boundedText(snapshotAsset?.id, 100);
          if (sourceId && !idMap.has(sourceId)) idMap.set(sourceId, uid("asset"));
        }
      }
      let project = normalizeProject({
        ...safeJsonValue(payload.project, 0),
        id: projectId,
        name: `${boundedText(payload.project.name, 140, "Dự án nhập")} · nhập`,
        projectKind: "project", lifecycle: "active", archivedAt: "", ingestJobs: [], recovery: normalizeRecovery(),
        assetIds: [],
        references: remapIds(payload.project.references || {}, idMap)
      });
      let importedAssets = 0;
      let relinkRequired = prepared.filter((item) => !item.blob).length;
      try {
        project = await saveProject(project);
        const importedIds = [];
        for (const item of prepared) {
          const asset = await saveAsset({
            ...item.clean,
            binary: undefined,
            id: idMap.get(item.sourceId),
            originId: item.sourceId,
            projectId,
            duplicateOf: idMap.get(item.clean.duplicateOf) || null,
            references: remapIds(item.clean.references || [], idMap),
            effects: remapIds(item.clean.effects || [], idMap),
            provenance: { ...item.clean.provenance, sourceType: "package", sourceId: item.sourceId },
            availability: item.blob ? "ready" : "offline",
            blob: item.blob
          });
          importedIds.push(asset.id);
          importedAssets += 1;
        }
        project = await saveProject({ ...project, assetIds: importedIds });
        for (const rawSnapshot of (Array.isArray(payload.snapshots) ? payload.snapshots : []).slice(0, MAX_SNAPSHOTS)) {
          const snapshotSource = safeJsonValue(rawSnapshot, 0);
          const snapshotAssets = (Array.isArray(snapshotSource.assets) ? snapshotSource.assets : []).map((asset) => ({
            ...asset,
            id: idMap.get(asset.id) || uid("asset"),
            originId: asset.id,
            projectId,
            duplicateOf: idMap.get(asset.duplicateOf) || null,
            references: remapIds(asset.references || [], idMap),
            effects: remapIds(asset.effects || [], idMap)
          }));
          const snapshot = normalizeSnapshot({
            ...snapshotSource,
            id: uid("snapshot"),
            projectId,
            project: { ...snapshotSource.project, id: projectId, assetIds: snapshotAssets.map((asset) => asset.id), references: remapIds(snapshotSource.project?.references || {}, idMap) },
            assets: snapshotAssets
          });
          await withBackend((backend) => backend.put("snapshots", snapshot));
        }
      } catch (error) {
        await deleteProject(projectId).catch(() => {});
        throw error;
      }
      return { project: await getProject(projectId), importedAssets, relinkRequired, sourceProjectId: oldProjectId };
    }

    async function exportAssetManifest(projectId) {
      const project = await getProject(projectId);
      if (!project) throw new Error("Không tìm thấy project.");
      const assets = await listAssets(projectId);
      const payload = {
        format: ASSET_MANIFEST_FORMAT, schema: SCHEMA, version: VERSION, recordVersion: RECORD_VERSION, exportedAt: now(),
        project: { id: project.id, name: project.name },
        contract: { metadataOnly: true, stableOriginId: true, binaryRequiresRelink: true },
        assets: assets.map((source) => {
          const asset = normalizeAsset(source);
          return safeJsonValue({ ...asset, blob: undefined, thumbnailBlob: undefined, availability: "offline", versions: asset.versions.map((version) => ({ ...version, blob: undefined, binaryRetained: false })) }, 0);
        })
      };
      const text = JSON.stringify(payload);
      if (new TextEncoder().encode(text).byteLength > MAX_ASSET_MANIFEST_BYTES) throw new Error("Asset manifest vượt giới hạn an toàn 2 MB.");
      return text;
    }

    async function importAssetManifest(input, projectId) {
      if (input instanceof Blob && input.size > MAX_ASSET_MANIFEST_BYTES) throw new Error("Asset manifest vượt giới hạn an toàn 2 MB.");
      const text = typeof input === "string" ? input : await input?.text?.();
      if (typeof text !== "string" || new TextEncoder().encode(text).byteLength > MAX_ASSET_MANIFEST_BYTES) throw new Error("Asset manifest không hợp lệ hoặc vượt giới hạn 2 MB.");
      let payload;
      try { payload = JSON.parse(text); } catch (_) { throw new Error("Không đọc được JSON asset manifest."); }
      if (payload?.format !== ASSET_MANIFEST_FORMAT || payload?.schema !== SCHEMA || Number(payload?.version) !== VERSION) throw new Error("Phiên bản asset manifest không được hỗ trợ.");
      if (!Array.isArray(payload.assets) || payload.assets.length > MAX_ASSETS) throw new Error("Asset manifest vượt giới hạn.");
      const project = await getProject(projectId);
      if (!project) throw new Error("Không tìm thấy project nhận manifest.");
      if (project.assetIds.length + payload.assets.length > MAX_ASSETS) throw new Error(`Mỗi project tối đa ${MAX_ASSETS} asset.`);
      const idMap = new Map();
      const prepared = payload.assets.map((raw) => {
        if (raw?.binary || raw?.blob || raw?.thumbnailBlob) throw new Error("Asset manifest chỉ được chứa metadata.");
        const sourceId = boundedText(raw?.id, 100);
        if (!sourceId || idMap.has(sourceId)) throw new Error("Asset manifest chứa ID trống hoặc trùng lặp.");
        idMap.set(sourceId, uid("asset"));
        return { sourceId, clean: safeJsonValue(raw, 0) };
      });
      const importedIds = [];
      try {
        for (const item of prepared) {
          const asset = await saveAsset({
            ...item.clean, id: idMap.get(item.sourceId), originId: item.clean.originId || item.sourceId, projectId,
            folderId: project.folders.some((folder) => folder.id === item.clean.folderId) ? item.clean.folderId : ROOT_FOLDER_ID,
            duplicateOf: idMap.get(item.clean.duplicateOf) || null, references: remapIds(item.clean.references || [], idMap), effects: remapIds(item.clean.effects || [], idMap),
            availability: "offline", blob: null, thumbnailBlob: null, provenance: { ...item.clean.provenance, sourceType: "package", sourceId: item.sourceId }
          });
          importedIds.push(asset.id);
        }
      } catch (error) {
        for (const id of importedIds) await removeAsset(id).catch(() => {});
        throw error;
      }
      return { importedAssets: importedIds.length, relinkRequired: importedIds.length, assetIds: importedIds };
    }

    async function deleteProject(id) {
      const assets = await listAllProjectAssets(id);
      const snapshots = await listSnapshots(id);
      await Promise.all([
        withBackend((backend) => backend.delete("projects", id)),
        ...assets.map((asset) => withBackend((backend) => backend.delete("assets", asset.id))),
        ...snapshots.map((snapshot) => withBackend((backend) => backend.delete("snapshots", snapshot.id)))
      ]);
      return true;
    }

    return Object.freeze({
      async ready() { const backend = await backendPromise; return { backend: backend.type, schema: SCHEMA }; },
      async storageStatus() {
        const backend = await backendPromise;
        const capabilities = await inspectStorageCapabilities(options?.env || globalScope);
        return { backend: backend.type, persistent: backend.persistent === true || backend.type === "indexeddb", fallbackReason: backend.fallbackReason || "", schema: SCHEMA, recordVersion: RECORD_VERSION, ...capabilities };
      },
      saveProject, createProject, getProject, listProjects, archiveProject, duplicateProject, deleteProject,
      createTemplateFromProject, instantiateTemplate, listTemplates,
      saveProjectPreset, applyProjectPreset, deleteProjectPreset, linkAssetToWorkspace, unlinkAssetFromWorkspace,
      createFolder, deleteFolder,
      saveAsset, getAsset, listAssets, updateAsset, replaceAsset, relinkAsset, restoreAssetVersion, restoreAssetRecord, removeAsset, touchAsset, findDuplicate, repairDuplicateLinks,
      registerIngestJob, listIngestJobs, resumeIngestJob, cancelIngestJob,
      createSnapshot, listSnapshots, restoreSnapshot, recoveryStatus, startProjectSession, finishProjectSession, createAutosave,
      exportPackage, importPackage, exportAssetManifest, importAssetManifest,
      async close() { (await backendPromise).close(); }
    });
  }

  function formatBytes(bytes) {
    const value = Math.max(0, Number(bytes) || 0);
    if (value < 1024) return `${value} B`;
    if (value < 1048576) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1073741824) return `${(value / 1048576).toFixed(1)} MB`;
    return `${(value / 1073741824).toFixed(1)} GB`;
  }

  function downloadText(documentScope, text, name) {
    const blob = new Blob([text], { type: "application/vnd.hhmedia+json" });
    const url = globalScope.URL.createObjectURL(blob);
    const anchor = documentScope.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    globalScope.setTimeout(() => globalScope.URL.revokeObjectURL(url), 0);
  }

  function renderShell(root) {
    root.classList.add("hhump");
    root.innerHTML = `
      <header class="hhump-topbar">
        <div class="hhump-brand"><span class="hhump-logo" aria-hidden="true">UM</span><span><small>MEDIA & DESIGN</small><strong>Universal Media Project</strong></span></div>
        <div class="hhump-top-actions">
          <span class="hhump-persistence" data-ump-persistence>Đang mở kho local...</span>
          <span class="hhump-autosave" data-ump-autosave data-phase="idle">Autosave · sẵn sàng</span>
          <button class="hhump-button" type="button" data-ump-undo disabled aria-label="Hoàn tác">↶ Hoàn tác</button>
          <button class="hhump-button" type="button" data-ump-redo disabled aria-label="Làm lại">↷ Làm lại</button>
          <button class="hhump-button" type="button" data-ump-snapshot>Chụp phiên bản</button>
          <button class="hhump-button" type="button" data-ump-import>Mở .hhmedia</button>
          <button class="hhump-button primary" type="button" data-ump-export>Đóng gói .hhmedia</button>
        </div>
        <input class="hhump-hidden" type="file" accept=".hhmedia,application/json" data-ump-package-file aria-label="Chọn gói HH Media">
      </header>
      <section class="hhump-projectbar" aria-label="Thông tin dự án">
        <div class="hhump-project-switcher">
          <label><span>Project đang mở</span><select data-ump-project-select aria-label="Chuyển project"></select></label>
          <button class="hhump-button" type="button" data-ump-new-project>＋ Mới</button>
          <details class="hhump-project-menu"><summary>Quản lý ▾</summary><div>
            <button type="button" data-ump-duplicate-project>Nhân bản project</button>
            <button type="button" data-ump-archive-project>Lưu trữ project</button>
            <button type="button" data-ump-create-template>Lưu thành template</button>
            <label>Template<select data-ump-template-select><option value="">Chưa có template</option></select></label><button type="button" data-ump-use-template>Tạo từ template</button>
            <label>Đã lưu trữ<select data-ump-archived-select><option value="">Chưa có project</option></select></label><button type="button" data-ump-restore-project>Khôi phục project</button>
            <label>Preset<select data-ump-preset-select><option value="">Chưa có preset</option></select></label><button type="button" data-ump-apply-preset>Áp dụng preset</button>
            <button type="button" data-ump-save-preset>Lưu cấu hình thành preset</button>
            <button type="button" data-ump-delete-preset>Xóa preset chọn</button>
            <button class="danger" type="button" data-ump-delete-project>Xóa vĩnh viễn…</button>
          </div></details>
        </div>
        <label><span>Tên dự án</span><input data-ump-project-name maxlength="160" autocomplete="off"></label>
        <div class="hhump-project-metrics" data-ump-metrics></div>
      </section>
      <div class="hhump-layout">
        <aside class="hhump-sidebar" aria-label="Thư viện media">
          <div class="hhump-panel-title"><div><small>THƯ VIỆN</small><strong>Media Bin</strong></div><button class="hhump-icon-button" type="button" data-ump-new-folder title="Tạo thư mục" aria-label="Tạo thư mục">+</button></div>
          <label class="hhump-search"><span aria-hidden="true">⌕</span><input type="search" data-ump-search placeholder="Tìm tên, tag, loại tệp..." aria-label="Tìm kiếm asset"></label>
          <nav class="hhump-collections" data-ump-collections aria-label="Bộ sưu tập thông minh"></nav>
          <div class="hhump-divider"></div>
          <div class="hhump-folder-head"><small>THƯ MỤC</small><span data-ump-folder-count>0</span></div>
          <nav class="hhump-folders" data-ump-folders aria-label="Thư mục media"></nav>
        </aside>
        <main class="hhump-main">
          <section class="hhump-commandbar" aria-label="Điều khiển Media Bin">
            <div><strong data-ump-view-title>Tất cả tài sản</strong><small data-ump-view-note>Kho media dùng chung cho toàn bộ editor.</small></div>
            <label>Loại<select data-ump-kind><option value="all">Tất cả</option>${Object.entries(TYPE_LABELS).map(([id, label]) => `<option value="${id}">${label}</option>`).join("")}</select></label>
            <label>Quyền<select data-ump-rights-filter><option value="all">Tất cả</option><option value="verified">Đã xác minh</option><option value="review">Cần kiểm tra</option></select></label>
            <button class="hhump-button" type="button" data-ump-export-assets>Manifest asset</button>
            <button class="hhump-button" type="button" data-ump-import-assets>Mở manifest</button>
            <button class="hhump-button" type="button" data-ump-upload>+ Thêm media</button>
            <input class="hhump-hidden" type="file" multiple accept="image/*,video/*,audio/*,.svg,.ttf,.otf,.woff,.woff2,.cube,.3dl,.look,.lut" data-ump-file aria-label="Chọn media từ thiết bị">
            <input class="hhump-hidden" type="file" accept=".hhassets,application/json" data-ump-asset-manifest-file aria-label="Chọn asset manifest">
          </section>
          <section class="hhump-dropzone" data-ump-drop tabindex="0" role="button" aria-label="Kéo thả hoặc chọn media">
            <span aria-hidden="true">＋</span><div><strong>Thả ảnh, video, âm thanh, font, LUT hoặc SVG</strong><small>Binary lưu trong IndexedDB trên thiết bị, không đưa vào localStorage.</small></div><button class="hhump-button primary" type="button" data-ump-upload>Chọn tệp</button>
          </section>
          <div class="hhump-notice" data-ump-notice role="status" aria-live="polite">Sẵn sàng.</div>
          <section class="hhump-ingest-list" data-ump-ingest-list aria-label="Checkpoint nhập tệp"></section>
          <section class="hhump-grid" data-ump-assets aria-label="Danh sách asset"></section>
        </main>
        <aside class="hhump-inspector" aria-label="Chi tiết asset và phiên bản">
          <div class="hhump-panel-title"><div><small>INSPECTOR</small><strong>Chi tiết</strong></div><span class="hhump-health" data-ump-health>0 cảnh báo</span></div>
          <div data-ump-inspector></div>
          <div class="hhump-divider"></div>
          <div class="hhump-panel-title"><div><small>VERSION</small><strong>Lịch sử phiên bản</strong></div></div>
          <div class="hhump-snapshots" data-ump-snapshots></div>
        </aside>
      </div>`;
  }

  async function mount(root, options) {
    if (!root || typeof root.querySelector !== "function") throw new TypeError("HHUniversalMediaProject.mount cần root DOM hợp lệ.");
    await unmount(root);
    const controller = new AbortController();
    const signal = controller.signal;
    pendingMounts.set(root, controller);
    renderShell(root);
    const documentScope = root.ownerDocument;
    const store = options?.store || createStore(options);
    let ready;
    let persistence;
    let project;
    try {
      ready = await store.ready();
      if (signal.aborted || pendingMounts.get(root) !== controller) { if (!options?.store) await store.close().catch(() => {}); return null; }
      persistence = await store.storageStatus?.() || { backend: ready.backend, persistent: ready.backend === "indexeddb", fallbackReason: "" };
      project = options?.projectId ? await store.getProject(options.projectId) : null;
      if (!project || project.projectKind === "template" || project.lifecycle === "archived") project = (await store.listProjects())[0] || await (store.createProject?.({ name: options?.name || "Universal Media Project" }) || store.saveProject({ name: options?.name || "Universal Media Project" }));
      if (signal.aborted || pendingMounts.get(root) !== controller) { if (!options?.store) await store.close().catch(() => {}); return null; }
    } catch (error) {
      pendingMounts.delete(root); controller.abort(); root.classList.remove("hhump"); root.innerHTML = "";
      if (!options?.store) await store.close().catch(() => {});
      throw error;
    }
    let projects = [];
    let archivedProjects = [];
    let templates = [];
    let ingestJobs = [];
    let recovery = await store.recoveryStatus?.(project.id) || { uncleanSession: false };
    let currentSessionId = uid("media-session");
    project = await store.startProjectSession?.(project.id, currentSessionId) || project;
    let assets = [];
    let snapshots = [];
    let selectedId = null;
    let collection = "all";
    let folderId = "all";
    let kind = "all";
    let rightsFilter = "all";
    let search = "";
    let autosaveState = { phase: "idle", pending: false, savedAt: null, error: null };
    const objectUrls = new Set();
    const updateHistoryControls = (state) => {
      const undo = root.querySelector("[data-ump-undo]");
      const redo = root.querySelector("[data-ump-redo]");
      if (undo) { undo.disabled = !state.canUndo; undo.title = state.undoLabel ? `Hoàn tác: ${state.undoLabel}` : "Không có thao tác để hoàn tác"; }
      if (redo) { redo.disabled = !state.canRedo; redo.title = state.redoLabel ? `Làm lại: ${state.redoLabel}` : "Không có thao tác để làm lại"; }
    };
    const commandHistory = createCommandHistory({ limit: MAX_COMMAND_HISTORY, onChange: updateHistoryControls });
    const createProjectAutosave = (projectId) => store.createAutosave(projectId, {
      delay: 700, checkpointEvery: 10,
      onState: (state) => { autosaveState = state; renderAutosaveState(); },
      onSaved: (saved) => { project = saved; notice("Đã tự lưu dự án trên thiết bị."); },
      onError: (error) => notice(classifyStorageError(error).message, "error")
    });
    let autosave = createProjectAutosave(project.id);
    const instance = { root, controller, store, autosave, commandHistory, objectUrls, ownedStore: !options?.store, finishSession: async () => store.finishProjectSession?.(project.id, currentSessionId) };
    activeInstances.add(instance);
    pendingMounts.delete(root);

    const listen = (target, type, handler) => target?.addEventListener(type, (event) => {
      try { Promise.resolve(handler(event)).catch((error) => notice(error?.message || "Không thể hoàn tất thao tác.", "error")); }
      catch (error) { notice(error?.message || "Không thể hoàn tất thao tác.", "error"); }
    }, { signal });
    const notice = (message, tone) => {
      const element = root.querySelector("[data-ump-notice]");
      if (element) { element.textContent = message; element.dataset.tone = tone || "info"; }
    };

    function mediaPreview(asset) {
      const blob = asset.thumbnailBlob || (asset.kind === "image" || asset.kind === "svg" ? asset.blob : null);
      const validation = asset.metadata?.validation;
      const blockedPreview = validation?.safeToPreview === false || (asset.kind === "svg" && validation?.status !== "verified");
      if (!blob || blockedPreview || !globalScope.URL?.createObjectURL) return `<span class="hhump-file-icon">${({ image: "IMG", video: "VID", audio: "AUD", font: "Aa", lut: "LUT", svg: "SVG" })[asset.kind] || "FILE"}</span>`;
      const url = globalScope.URL.createObjectURL(blob);
      objectUrls.add(url);
      return `<img src="${escapeHtml(url)}" alt="" loading="lazy">`;
    }

    function filteredAssets() {
      const searched = searchAssets(assets, search, { folderId, kind, rights: rightsFilter });
      return applySmartCollection(searched, collection, { availableFonts: options?.availableFonts || [] });
    }

    function renderAutosaveState() {
      const node = root.querySelector("[data-ump-autosave]");
      if (!node) return;
      const labels = { idle: "Autosave · sẵn sàng", scheduled: "Autosave · đang chờ", saving: "Autosave · đang lưu…", saved: "Autosave · đã lưu", error: "Autosave · lỗi", closed: "Autosave · đã đóng" };
      node.dataset.phase = autosaveState.phase || "idle";
      node.textContent = labels[autosaveState.phase] || labels.idle;
      node.title = autosaveState.error?.message || (autosaveState.savedAt ? `Lần lưu cuối ${new Date(autosaveState.savedAt).toLocaleString("vi-VN")}` : "");
    }

    function renderProjectControls() {
      const select = root.querySelector("[data-ump-project-select]");
      if (select) select.innerHTML = projects.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === project.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
      const templateSelect = root.querySelector("[data-ump-template-select]");
      if (templateSelect) templateSelect.innerHTML = `<option value="">${templates.length ? "Chọn template…" : "Chưa có template"}</option>` + templates.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
      const archivedSelect = root.querySelector("[data-ump-archived-select]");
      if (archivedSelect) archivedSelect.innerHTML = `<option value="">${archivedProjects.length ? "Chọn project…" : "Chưa có project"}</option>` + archivedProjects.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
      const presetSelect = root.querySelector("[data-ump-preset-select]");
      if (presetSelect) presetSelect.innerHTML = `<option value="">${project.presets.length ? "Chọn preset…" : "Chưa có preset"}</option>` + project.presets.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${escapeHtml(item.section)}</option>`).join("");
    }

    function renderIngestJobs() {
      const host = root.querySelector("[data-ump-ingest-list]");
      if (!host) return;
      const pendingJobs = ingestJobs.filter((job) => ["awaiting-file", "failed"].includes(job.status)).slice(-5).reverse();
      host.hidden = !pendingJobs.length;
      host.innerHTML = pendingJobs.map((job) => `<article data-state="${job.status}"><div><strong>${escapeHtml(job.file.name)}</strong><small>${job.status === "failed" ? escapeHtml(job.error) : "Chọn lại đúng tệp để tiếp tục checkpoint"}</small></div><label>Tiếp tục<input type="file" data-ump-resume-ingest="${escapeHtml(job.id)}"></label><button type="button" data-ump-cancel-ingest="${escapeHtml(job.id)}">Hủy</button></article>`).join("");
    }

    function renderCollections() {
      root.querySelector("[data-ump-collections]").innerHTML = SMART_COLLECTIONS.map((item) => {
        const count = applySmartCollection(assets, item.id, { availableFonts: options?.availableFonts || [] }).length;
        return `<button type="button" data-ump-collection="${item.id}" class="${collection === item.id ? "active" : ""}"><span>${item.icon}</span><strong>${item.label}</strong><small>${count}</small></button>`;
      }).join("");
    }

    function renderFolders() {
      root.querySelector("[data-ump-folder-count]").textContent = project.folders.length;
      root.querySelector("[data-ump-folders]").innerHTML = `<button type="button" data-ump-folder="all" class="${folderId === "all" ? "active" : ""}"><span>◇</span><strong>Toàn bộ thư mục</strong><small>${assets.length}</small></button>` + project.folders.map((folder) => `<button type="button" data-ump-folder="${escapeHtml(folder.id)}" class="${folderId === folder.id ? "active" : ""}"><i style="--folder-color:${escapeHtml(folder.color)}"></i><strong>${escapeHtml(folder.name)}</strong><small>${assets.filter((asset) => asset.folderId === folder.id).length}</small></button>`).join("");
    }

    function renderAssets() {
      objectUrls.forEach((url) => globalScope.URL.revokeObjectURL(url));
      objectUrls.clear();
      const list = filteredAssets();
      const host = root.querySelector("[data-ump-assets]");
      if (!list.length) {
        host.innerHTML = `<div class="hhump-empty"><span>◇</span><strong>Chưa có asset phù hợp</strong><p>Thêm media hoặc thay đổi bộ lọc để bắt đầu.</p></div>`;
        return;
      }
      host.innerHTML = list.map((asset) => `<article class="hhump-asset ${selectedId === asset.id ? "selected" : ""}" data-ump-asset="${escapeHtml(asset.id)}" tabindex="0" aria-label="${escapeHtml(asset.name)}">
        <div class="hhump-thumb">${mediaPreview(asset)}<span>${escapeHtml(TYPE_LABELS[asset.kind] || "Tệp")}</span>${asset.duplicateOf ? '<b title="Tệp trùng">TRÙNG</b>' : ""}</div>
        <div class="hhump-asset-info"><div><strong title="${escapeHtml(asset.name)}">${escapeHtml(asset.name)}</strong><small>${formatBytes(asset.size)} · ${escapeHtml(asset.metadata?.width && asset.metadata?.height ? `${asset.metadata.width}×${asset.metadata.height}` : asset.type)}</small></div><button type="button" data-ump-favorite="${escapeHtml(asset.id)}" aria-label="${asset.favorite ? "Bỏ yêu thích" : "Thêm yêu thích"}" title="Yêu thích">${asset.favorite ? "★" : "☆"}</button></div>
        <div class="hhump-tags">${(asset.tags || []).slice(0, 3).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}${asset.availability !== "ready" ? `<span class="warning">${asset.availability === "missing" ? "Thiếu tệp" : "Offline"}</span>` : ""}</div>
      </article>`).join("");
    }

    function renderInspector() {
      const asset = assets.find((item) => item.id === selectedId);
      const host = root.querySelector("[data-ump-inspector]");
      if (!asset) {
        host.innerHTML = `<div class="hhump-inspector-empty"><span>⌁</span><p>Chọn một asset để xem metadata, proxy và liên kết.</p></div>`;
        return;
      }
      const plan = proxyPlan(asset, globalScope);
      const rights = asset.rights || normalizeRights();
      const versions = (asset.versions || []).slice(-3).reverse();
      host.innerHTML = `<section class="hhump-inspector-card">
        <div class="hhump-kind-badge">${escapeHtml(TYPE_LABELS[asset.kind] || "Tệp")}</div><h3>${escapeHtml(asset.name)}</h3>
        <dl><div><dt>Dung lượng</dt><dd>${formatBytes(asset.size)}</dd></div><div><dt>Checksum</dt><dd title="${escapeHtml(asset.checksum)}">${escapeHtml(asset.checksum ? asset.checksum.slice(0, 18) : "Chưa có")}</dd></div><div><dt>Độ tin cậy hash</dt><dd>${asset.checksumMode === "sampled" ? "Mẫu · tệp lớn" : asset.checksum ? "Toàn tệp" : "Chưa có"}</dd></div><div><dt>Trạng thái</dt><dd>${asset.availability === "ready" ? "Sẵn sàng" : "Cần relink"}</dd></div><div><dt>Tham chiếu</dt><dd>${Array.isArray(asset.references) ? asset.references.length : 0}</dd></div><div><dt>Phiên bản</dt><dd>${asset.versions?.length || 0}</dd></div></dl>
        <label>Tag<input data-ump-tags="${escapeHtml(asset.id)}" value="${escapeHtml((asset.tags || []).join(", "))}" placeholder="thumbnail, social"></label>
        <div class="hhump-workspace-link"><select data-ump-link-target aria-label="Gắn asset vào workspace"><option value="layers">Layer ảnh/brand</option><option value="tracks">Track video/audio</option><option value="clips">Clip timeline</option><option value="pages">Trang tài liệu</option><option value="scenes">Scene motion</option></select><button class="hhump-button" type="button" data-ump-link-asset="${escapeHtml(asset.id)}">Gắn asset</button></div>
        <div class="hhump-inspector-actions"><button class="hhump-button" type="button" data-ump-replace="${escapeHtml(asset.id)}">Thay tệp</button>${asset.availability !== "ready" ? `<button class="hhump-button" type="button" data-ump-relink="${escapeHtml(asset.id)}">Relink đúng nguồn</button>` : `<button class="hhump-button" type="button" data-ump-open="${escapeHtml(asset.id)}">Đánh dấu đã mở</button>`}<button class="hhump-button danger" type="button" data-ump-remove="${escapeHtml(asset.id)}">Xóa · có hoàn tác</button></div>
        ${hasSensitiveMetadata(asset.metadata) ? `<button class="hhump-button hhump-clean-metadata" type="button" data-ump-clean-metadata="${escapeHtml(asset.id)}">Xóa metadata vị trí/thiết bị</button>` : ""}
        <input class="hhump-hidden" type="file" data-ump-replace-file="${escapeHtml(asset.id)}"><input class="hhump-hidden" type="file" data-ump-relink-file="${escapeHtml(asset.id)}">
      </section>
      <form class="hhump-rights-card" data-ump-rights-form="${escapeHtml(asset.id)}">
        <header><small>RIGHTS & PROVENANCE</small><span data-state="${rights.verified ? "verified" : "unverified"}">${rights.verified ? "Đã xác minh" : "Chưa xác minh"}</span></header>
        <label>Tác giả<input name="author" maxlength="180" value="${escapeHtml(rights.author)}" placeholder="Tên tác giả/chủ sở hữu"></label>
        <label>Nguồn<input name="sourceUrl" type="url" maxlength="1000" value="${escapeHtml(rights.sourceUrl)}" placeholder="https://..."></label>
        <div><label>Giấy phép<input name="license" maxlength="100" value="${escapeHtml(rights.license)}" placeholder="CC BY 4.0, Commercial..."></label><label>Hết hạn<input name="expiresAt" type="date" value="${escapeHtml(rights.expiresAt ? rights.expiresAt.slice(0, 10) : "")}"></label></div>
        <label>Mục đích được phép<input name="allowedUses" maxlength="600" value="${escapeHtml((rights.allowedUses || []).join(", "))}" placeholder="web, social, print"></label>
        <label class="hhump-check"><input name="attributionRequired" type="checkbox" ${rights.attributionRequired ? "checked" : ""}> Cần ghi công</label>
        <label>Nội dung ghi công<input name="attribution" maxlength="500" value="${escapeHtml(rights.attribution)}"></label>
        <label class="hhump-check"><input name="verified" type="checkbox" ${rights.verified ? "checked" : ""}> Tôi đã kiểm tra nguồn và giấy phép</label>
        <button class="hhump-button" type="submit">Lưu quyền sử dụng</button>
      </form>
      <section class="hhump-version-lineage"><small>VERSION LINEAGE</small>${versions.length ? versions.map((version) => `<article><strong>${escapeHtml(version.name)}</strong><span>${new Date(version.createdAt).toLocaleString("vi-VN")}</span><em>${escapeHtml(version.checksum ? version.checksum.slice(0, 16) : "Không có hash")}</em><button type="button" data-ump-restore-asset-version="${escapeHtml(asset.id)}" data-version-id="${escapeHtml(version.id)}" ${version.binaryRetained ? "" : "disabled"}>${version.binaryRetained ? "Khôi phục" : "Cần relink"}</button></article>`).join("") : `<p>Chưa thay tệp. Binary cũ chỉ được giữ cục bộ khi không vượt giới hạn an toàn.</p>`}</section>
      <section class="hhump-proxy-plan ${plan.recommended ? "recommended" : ""}"><small>PROXY PLAN</small><strong>${plan.recommended ? "Nên tạo proxy" : "Không cần proxy"}</strong><p>${escapeHtml(plan.reason)} ${escapeHtml(plan.message)}</p></section>`;
    }

    function renderSnapshots() {
      const host = root.querySelector("[data-ump-snapshots]");
      host.innerHTML = snapshots.length ? snapshots.slice(0, 8).map((snapshot) => `<article><span>◷</span><div><strong>${escapeHtml(snapshot.label)}</strong><small>${new Date(snapshot.createdAt).toLocaleString("vi-VN")}</small></div><button type="button" data-ump-restore="${escapeHtml(snapshot.id)}">Khôi phục</button></article>`).join("") : `<p>Chưa có snapshot. Binary không bị nhân bản; phiên bản lưu project và metadata asset.</p>`;
    }

    function renderStatus() {
      const warnings = assessWarnings(project, assets, { availableFonts: options?.availableFonts || [] });
      root.querySelector("[data-ump-project-name]").value = project.name;
      const persistenceNode = root.querySelector("[data-ump-persistence]");
      const quotaLabel = persistence.quota?.ratio == null ? "quota chưa xác minh" : `${Math.round(persistence.quota.ratio * 100)}% đã dùng`;
      persistenceNode.textContent = persistence.persistent ? `IndexedDB · ${quotaLabel}` : `Bộ nhớ tạm · ${persistence.fallbackReason === "indexeddb-unavailable" ? "trình duyệt không hỗ trợ" : "không thể mở kho bền vững"}`;
      persistenceNode.dataset.pressure = persistence.quota?.pressure || "unknown";
      persistenceNode.title = `${persistence.opfs?.reason || "OPFS chưa kiểm tra"} Không tự nhận đang dùng OPFS.`;
      root.querySelector("[data-ump-health]").textContent = `${warnings.length} cảnh báo`;
      root.querySelector("[data-ump-health]").classList.toggle("has-warning", warnings.length > 0);
      root.querySelector("[data-ump-metrics]").innerHTML = `<span><b>${assets.length}</b> asset</span><span><b>${formatBytes(assets.reduce((sum, asset) => sum + asset.size, 0))}</b> local</span><span><b>${snapshots.length}</b> phiên bản</span><span><b>${warnings.length}</b> cảnh báo</span>`;
      renderProjectControls();
      renderAutosaveState();
      updateHistoryControls(commandHistory.state);
    }

    function render() {
      const scrollers = [".hhump-sidebar", ".hhump-main", ".hhump-inspector"].map((selector) => {
        const node = root.querySelector(selector); return { selector, top: node?.scrollTop || 0, left: node?.scrollLeft || 0 };
      });
      const active = documentScope.activeElement;
      const focusAttributes = ["data-ump-asset", "data-ump-favorite", "data-ump-folder", "data-ump-collection", "data-ump-restore", "data-ump-replace", "data-ump-relink"];
      const focusAttribute = focusAttributes.find((attribute) => active?.hasAttribute?.(attribute));
      const focusValue = focusAttribute ? active.getAttribute(focusAttribute) : "";
      const focusName = active?.name || "";
      const focusForm = active?.closest?.("[data-ump-rights-form]")?.dataset?.umpRightsForm || "";
      const focusProjectName = Boolean(active?.matches?.("[data-ump-project-name]"));
      renderCollections();
      renderFolders();
      renderAssets();
      renderInspector();
      renderSnapshots();
      renderIngestJobs();
      renderStatus();
      scrollers.forEach(({ selector, top, left }) => { const node = root.querySelector(selector); if (node) { node.scrollTop = top; node.scrollLeft = left; } });
      let focusTarget = focusProjectName ? root.querySelector("[data-ump-project-name]") : null;
      if (!focusTarget && focusAttribute) focusTarget = [...root.querySelectorAll(`[${focusAttribute}]`)].find((node) => node.getAttribute(focusAttribute) === focusValue);
      if (!focusTarget && focusForm && focusName) focusTarget = [...root.querySelectorAll("[data-ump-rights-form]")].find((form) => form.dataset.umpRightsForm === focusForm)?.elements?.namedItem?.(focusName);
      focusTarget?.focus?.({ preventScroll: true });
    }

    async function refresh() {
      if (signal.aborted) return;
      const pendingName = autosave?.pending ? project.name : "";
      project = await store.getProject(project.id);
      if (project && pendingName) project = { ...project, name: pendingName };
      if (signal.aborted || !project) return;
      assets = await store.listAssets(project.id);
      snapshots = await store.listSnapshots(project.id);
      projects = await store.listProjects();
      archivedProjects = (await store.listProjects({ includeArchived: true })).filter((item) => item.lifecycle === "archived");
      templates = await store.listTemplates?.() || [];
      ingestJobs = await store.listIngestJobs?.(project.id) || [];
      if (signal.aborted) return;
      render();
    }

    async function switchProject(nextProject) {
      if (!nextProject || nextProject.id === project.id) return;
      await autosave.dispose().catch(() => {});
      await store.finishProjectSession?.(project.id, currentSessionId);
      recovery = await store.recoveryStatus?.(nextProject.id) || { uncleanSession: false };
      currentSessionId = uid("media-session");
      project = await store.startProjectSession?.(nextProject.id, currentSessionId) || nextProject;
      autosaveState = { phase: "idle", pending: false, savedAt: null, error: null };
      autosave = createProjectAutosave(project.id); instance.autosave = autosave;
      commandHistory.clear(); selectedId = null; collection = "all"; folderId = "all"; kind = "all"; rightsFilter = "all"; search = "";
      await refresh();
      notice(recovery.uncleanSession ? "Đã mở bản autosave sau một phiên chưa đóng sạch. Hãy kiểm tra Lịch sử phiên bản." : `Đã mở ${project.name}.`, recovery.uncleanSession ? "warning" : "success");
    }

    async function addFiles(fileList) {
      const files = [...(fileList || [])].filter((file) => file instanceof Blob && file.size > 0).slice(0, Math.max(0, MAX_ASSETS - assets.length));
      if (!files.length) return;
      notice(`Đang phân tích ${files.length} tệp...`);
      let duplicates = 0;
      let imported = 0;
      const errors = [];
      for (const file of files) {
        if (signal.aborted) break;
        try {
          const metadata = await extractMetadata(file, globalScope);
          let asset;
          if (store.registerIngestJob && store.resumeIngestJob) {
            const job = await store.registerIngestJob(project.id, file, { folderId: folderId === "all" ? ROOT_FOLDER_ID : folderId });
            asset = await store.resumeIngestJob(project.id, job.id, file, { metadata, env: globalScope });
          } else asset = await store.saveAsset({ projectId: project.id, folderId: folderId === "all" ? ROOT_FOLDER_ID : folderId, name: file.name, type: file.type, size: file.size, lastModified: file.lastModified, metadata, provenance: { sourceType: "local-file", originalName: file.name }, blob: file });
          if (asset.duplicateOf) duplicates += 1;
          imported += 1;
        } catch (error) { errors.push(`${boundedText(file.name, 80, "Tệp")}: ${boundedText(error?.message, 180, "Không thể nhập")}`); }
      }
      await refresh();
      notice(`Đã thêm ${imported}/${files.length} tệp${duplicates ? `, phát hiện ${duplicates} tệp trùng` : ""}${errors.length ? ` · ${errors[0]}` : ""}.`, errors.length || duplicates ? "warning" : "success");
    }

    listen(root, "click", async (event) => {
      if (event.target.closest("[data-ump-undo]")) { if (await commandHistory.undo()) { await refresh(); notice("Đã hoàn tác thao tác gần nhất.", "success"); } return; }
      if (event.target.closest("[data-ump-redo]")) { if (await commandHistory.redo()) { await refresh(); notice("Đã làm lại thao tác.", "success"); } return; }
      if (event.target.closest("[data-ump-new-project]")) {
        const name = boundedText(globalScope.prompt?.("Tên project mới:", "Project media mới"), 160);
        if (name) await switchProject(await store.createProject({ name }));
        return;
      }
      if (event.target.closest("[data-ump-duplicate-project]")) {
        await autosave.flush();
        notice("Đang nhân bản project và binary local…");
        await switchProject(await store.duplicateProject(project.id));
        return;
      }
      if (event.target.closest("[data-ump-archive-project]")) {
        await autosave.dispose();
        project = await store.archiveProject(project.id, true);
        const next = (await store.listProjects()).find((item) => item.id !== project.id) || await store.createProject({ name: "Project media mới" });
        await switchProject(next); notice("Đã lưu trữ project cũ. Binary vẫn nằm trong kho local.", "success"); return;
      }
      if (event.target.closest("[data-ump-create-template]")) {
        const name = boundedText(globalScope.prompt?.("Tên template:", `${project.name} · template`), 160);
        if (name) { await autosave.flush(); await store.createTemplateFromProject(project.id, { name }); await refresh(); notice("Đã tạo template metadata; asset riêng tư không bị sao chép.", "success"); }
        return;
      }
      if (event.target.closest("[data-ump-use-template]")) {
        const templateId = root.querySelector("[data-ump-template-select]")?.value;
        if (!templateId) { notice("Hãy chọn một template.", "warning"); return; }
        const template = templates.find((item) => item.id === templateId);
        const name = boundedText(globalScope.prompt?.("Tên project từ template:", template?.name?.replace(/\s*·\s*template$/i, "") || "Project từ template"), 160);
        if (name) await switchProject(await store.instantiateTemplate(templateId, { name }));
        return;
      }
      if (event.target.closest("[data-ump-restore-project]")) {
        const archivedId = root.querySelector("[data-ump-archived-select]")?.value;
        if (!archivedId) { notice("Hãy chọn project đã lưu trữ.", "warning"); return; }
        const restored = await store.archiveProject(archivedId, false); await refresh(); notice(`Đã khôi phục ${restored.name}.`, "success"); return;
      }
      if (event.target.closest("[data-ump-save-preset]")) {
        const name = boundedText(globalScope.prompt?.("Tên preset cấu hình:", "Preset mới"), 120);
        if (name) { await autosave.flush(); await store.saveProjectPreset(project.id, { name, section: "settings", payload: project.settings }); await refresh(); notice("Đã lưu preset cấu hình trong project.", "success"); }
        return;
      }
      if (event.target.closest("[data-ump-apply-preset]")) {
        const presetId = root.querySelector("[data-ump-preset-select]")?.value;
        if (!presetId) { notice("Hãy chọn một preset.", "warning"); return; }
        await autosave.flush(); project = await store.applyProjectPreset(project.id, presetId); await refresh(); notice("Đã áp dụng preset.", "success"); return;
      }
      if (event.target.closest("[data-ump-delete-preset]")) {
        const presetId = root.querySelector("[data-ump-preset-select]")?.value;
        if (!presetId) { notice("Hãy chọn preset cần xóa.", "warning"); return; }
        await autosave.flush(); await store.deleteProjectPreset(project.id, presetId); await refresh(); notice("Đã xóa preset.", "success"); return;
      }
      if (event.target.closest("[data-ump-delete-project]")) {
        const confirmation = boundedText(globalScope.prompt?.(`Nhập chính xác “${project.name}” để xóa vĩnh viễn project và binary:`, ""), 160);
        if (confirmation !== project.name) { notice("Đã hủy xóa project.", "warning"); return; }
        const deletedId = project.id;
        await autosave.dispose({ flush: false }); await store.finishProjectSession?.(deletedId, currentSessionId); await store.deleteProject(deletedId);
        const next = (await store.listProjects())[0] || await store.createProject({ name: "Project media mới" });
        await switchProject(next); notice("Đã xóa vĩnh viễn project, snapshot và binary liên quan.", "success"); return;
      }
      const upload = event.target.closest("[data-ump-upload]");
      if (upload) { root.querySelector("[data-ump-file]").click(); return; }
      const packageImport = event.target.closest("[data-ump-import]");
      if (packageImport) { root.querySelector("[data-ump-package-file]").click(); return; }
      if (event.target.closest("[data-ump-export-assets]")) {
        const text = await store.exportAssetManifest(project.id); downloadText(documentScope, text, `${project.name.replace(/[^a-z0-9_-]+/gi, "-") || "hh-assets"}.hhassets`); notice("Đã xuất asset manifest metadata; binary không được nhúng.", "success"); return;
      }
      if (event.target.closest("[data-ump-import-assets]")) { root.querySelector("[data-ump-asset-manifest-file]")?.click(); return; }
      const cancelIngest = event.target.closest("[data-ump-cancel-ingest]");
      if (cancelIngest) { await store.cancelIngestJob(project.id, cancelIngest.dataset.umpCancelIngest); await refresh(); notice("Đã hủy checkpoint nhập tệp.", "success"); return; }
      const collectionButton = event.target.closest("[data-ump-collection]");
      if (collectionButton) { collection = collectionButton.dataset.umpCollection; folderId = "all"; render(); return; }
      const folderButton = event.target.closest("[data-ump-folder]");
      if (folderButton) { folderId = folderButton.dataset.umpFolder; collection = "all"; render(); return; }
      const favoriteButton = event.target.closest("[data-ump-favorite]");
      if (favoriteButton) {
        event.stopPropagation(); const asset = await store.getAsset(favoriteButton.dataset.umpFavorite); const next = !asset.favorite;
        await commandHistory.execute({ label: next ? "Thêm yêu thích" : "Bỏ yêu thích", redo: () => store.updateAsset(asset.id, { favorite: next }), undo: () => store.updateAsset(asset.id, { favorite: asset.favorite }) });
        await refresh(); return;
      }
      const assetCard = event.target.closest("[data-ump-asset]");
      if (assetCard) { selectedId = assetCard.dataset.umpAsset; renderAssets(); renderInspector(); return; }
      const linkAsset = event.target.closest("[data-ump-link-asset]");
      if (linkAsset) {
        const target = root.querySelector("[data-ump-link-target]")?.value;
        const entity = await store.linkAssetToWorkspace(project.id, linkAsset.dataset.umpLinkAsset, target, { role: "asset-placement" });
        await refresh(); notice(`Đã gắn asset vào ${target} bằng ID ${entity.id}.`, "success"); return;
      }
      if (event.target.closest("[data-ump-new-folder]")) {
        const name = boundedText(globalScope.prompt?.("Tên thư mục mới:", "Tài sản dự án"), 100);
        if (name) { const folder = await store.createFolder(project.id, { name }); folderId = folder.id; await refresh(); notice("Đã tạo thư mục.", "success"); }
        return;
      }
      if (event.target.closest("[data-ump-snapshot]")) {
        await store.createSnapshot(project.id, `Phiên bản ${snapshots.length + 1}`, "Snapshot thủ công"); await refresh(); notice("Đã chụp phiên bản metadata.", "success"); return;
      }
      const restore = event.target.closest("[data-ump-restore]");
      if (restore) {
        const before = await store.createSnapshot(project.id, "Tự động · trước khôi phục", "Điểm hoàn tác trước khi khôi phục snapshot");
        await commandHistory.execute({ label: "Khôi phục snapshot", redo: () => store.restoreSnapshot(restore.dataset.umpRestore), undo: () => store.restoreSnapshot(before.id) });
        await refresh(); notice("Đã khôi phục phiên bản; binary hiện có được giữ nguyên và có thể hoàn tác.", "success"); return;
      }
      const replace = event.target.closest("[data-ump-replace]");
      if (replace) { root.querySelector(`[data-ump-replace-file="${replace.dataset.umpReplace}"]`)?.click(); return; }
      const relink = event.target.closest("[data-ump-relink]");
      if (relink) { root.querySelector(`[data-ump-relink-file="${relink.dataset.umpRelink}"]`)?.click(); return; }
      const open = event.target.closest("[data-ump-open]");
      if (open) { await store.touchAsset(open.dataset.umpOpen); await refresh(); notice("Đã cập nhật hoạt động gần đây."); return; }
      const remove = event.target.closest("[data-ump-remove]");
      if (remove) {
        const removedAsset = await store.getAsset(remove.dataset.umpRemove);
        await commandHistory.execute({ label: `Xóa ${removedAsset.name}`, redo: () => store.removeAsset(removedAsset.id), undo: () => store.restoreAssetRecord(removedAsset) });
        selectedId = null; await refresh(); notice("Đã xóa asset khỏi Media Bin. Có thể hoàn tác.", "success"); return;
      }
      const cleanMetadata = event.target.closest("[data-ump-clean-metadata]");
      if (cleanMetadata) {
        const asset = await store.getAsset(cleanMetadata.dataset.umpCleanMetadata); const cleaned = stripSensitiveMetadata(asset.metadata);
        await commandHistory.execute({ label: "Xóa metadata nhạy cảm", redo: () => store.updateAsset(asset.id, { metadata: cleaned }), undo: () => store.updateAsset(asset.id, { metadata: asset.metadata }) });
        await refresh(); notice("Đã xóa metadata vị trí, thiết bị và chủ sở hữu khỏi bản ghi.", "success"); return;
      }
      const restoreVersion = event.target.closest("[data-ump-restore-asset-version]");
      if (restoreVersion) {
        const before = await store.getAsset(restoreVersion.dataset.umpRestoreAssetVersion); let after = null;
        await commandHistory.execute({ label: "Khôi phục phiên bản asset", redo: async () => { after = after || await store.restoreAssetVersion(before.id, restoreVersion.dataset.versionId); return store.restoreAssetRecord(after); }, undo: () => store.restoreAssetRecord(before) });
        await refresh(); notice("Đã khôi phục binary của phiên bản cũ và giữ nguyên ID asset.", "success"); return;
      }
      if (event.target.closest("[data-ump-export]")) {
        try { const text = await store.exportPackage(project.id); downloadText(documentScope, text, `${project.name.replace(/[^a-z0-9_-]+/gi, "-") || "hh-media"}.hhmedia`); notice("Đã tạo gói .hhmedia. Kiểm tra cảnh báo relink trong manifest nếu có.", "success"); }
        catch (error) { notice(error.message, "error"); }
      }
    });

    listen(root, "change", async (event) => {
      if (event.target.matches("[data-ump-project-select]")) {
        const next = projects.find((item) => item.id === event.target.value);
        if (next) await switchProject(next);
        return;
      }
      if (event.target.matches("[data-ump-file]")) { await addFiles(event.target.files); event.target.value = ""; return; }
      if (event.target.matches("[data-ump-package-file]")) {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
          const imported = await store.importPackage(file);
          if (signal.aborted) return;
          await switchProject(imported.project); notice(`Đã nhập ${imported.importedAssets} asset; ${imported.relinkRequired} asset cần relink.`, imported.relinkRequired ? "warning" : "success");
        }
        catch (error) { notice(error.message, "error"); }
        event.target.value = "";
        return;
      }
      if (event.target.matches("[data-ump-asset-manifest-file]")) {
        const file = event.target.files?.[0];
        if (!file) return;
        try { const imported = await store.importAssetManifest(file, project.id); await refresh(); notice(`Đã nhập ${imported.importedAssets} metadata asset; cần relink toàn bộ binary.`, "warning"); }
        catch (error) { notice(error.message, "error"); }
        event.target.value = ""; return;
      }
      if (event.target.matches("[data-ump-resume-ingest]")) {
        const file = event.target.files?.[0]; if (!file) return;
        try { await store.resumeIngestJob(project.id, event.target.dataset.umpResumeIngest, file, { env: globalScope }); await refresh(); notice("Đã tiếp tục và hoàn tất checkpoint nhập tệp.", "success"); }
        catch (error) { await refresh(); notice(error.message, "error"); }
        event.target.value = ""; return;
      }
      if (event.target.matches("[data-ump-kind]")) { kind = event.target.value; renderAssets(); return; }
      if (event.target.matches("[data-ump-rights-filter]")) { rightsFilter = event.target.value; renderAssets(); return; }
      if (event.target.matches("[data-ump-tags]")) {
        const asset = await store.getAsset(event.target.dataset.umpTags); const nextTags = uniqueStrings(event.target.value.split(","), MAX_TAGS, 60);
        await commandHistory.execute({ label: "Cập nhật tag", redo: () => store.updateAsset(asset.id, { tags: nextTags }), undo: () => store.updateAsset(asset.id, { tags: asset.tags }) });
        await refresh(); return;
      }
      if (event.target.matches("[data-ump-replace-file]")) {
        const file = event.target.files?.[0];
        if (!file) return;
        const metadata = await extractMetadata(file, globalScope);
        const before = await store.getAsset(event.target.dataset.umpReplaceFile); let after = null;
        await commandHistory.execute({ label: `Thay tệp ${before.name}`, redo: async () => { after = after || await store.replaceAsset(before.id, { name: file.name, type: file.type, blob: file, lastModified: file.lastModified, metadata }); return store.restoreAssetRecord(after); }, undo: () => store.restoreAssetRecord(before) });
        await refresh(); notice("Đã thay asset và giữ nguyên ID, reference, effect.", "success");
        event.target.value = ""; return;
      }
      if (event.target.matches("[data-ump-relink-file]")) {
        const file = event.target.files?.[0]; if (!file) return;
        const before = await store.getAsset(event.target.dataset.umpRelinkFile); const metadata = await extractMetadata(file, globalScope); let after = null;
        try {
          await commandHistory.execute({ label: `Relink ${before.name}`, redo: async () => { after = after || await store.relinkAsset(before.id, { name: file.name, type: file.type, blob: file, lastModified: file.lastModified, metadata }); return store.restoreAssetRecord(after); }, undo: () => store.restoreAssetRecord(before) });
          await refresh(); notice("Đã relink đúng checksum và giữ nguyên ID.", "success");
        } catch (error) { notice(error.message, "error"); }
        event.target.value = "";
      }
    });

    listen(root, "submit", async (event) => {
      const form = event.target.closest("[data-ump-rights-form]");
      if (!form) return;
      event.preventDefault();
      const asset = await store.getAsset(form.dataset.umpRightsForm);
      const data = new FormData(form);
      const rights = normalizeRights({
        author: data.get("author"), sourceUrl: data.get("sourceUrl"), license: data.get("license"), expiresAt: data.get("expiresAt"),
        allowedUses: String(data.get("allowedUses") || "").split(","), attributionRequired: data.get("attributionRequired") === "on",
        attribution: data.get("attribution"), verified: data.get("verified") === "on"
      });
      await commandHistory.execute({ label: "Cập nhật quyền sử dụng", redo: () => store.updateAsset(asset.id, { rights }), undo: () => store.updateAsset(asset.id, { rights: asset.rights }) });
      await refresh(); notice("Đã lưu nguồn, giấy phép và phạm vi sử dụng.", rights.verified ? "success" : "warning");
    });

    listen(root.querySelector("[data-ump-search]"), "input", (event) => { search = event.target.value; renderAssets(); });
    listen(root.querySelector("[data-ump-project-name]"), "input", (event) => { project = { ...project, name: boundedText(event.target.value, 160, "Dự án media") }; autosave.schedule(project); });
    listen(root, "keydown", (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) { event.preventDefault(); commandHistory.undo().then((changed) => changed && refresh()).catch((error) => notice(error.message, "error")); }
      else if (key === "y" || (key === "z" && event.shiftKey)) { event.preventDefault(); commandHistory.redo().then((changed) => changed && refresh()).catch((error) => notice(error.message, "error")); }
    });
    const dropzone = root.querySelector("[data-ump-drop]");
    listen(dropzone, "dragover", (event) => { event.preventDefault(); dropzone.classList.add("dragging"); });
    listen(dropzone, "dragleave", () => dropzone.classList.remove("dragging"));
    listen(dropzone, "drop", (event) => { event.preventDefault(); dropzone.classList.remove("dragging"); addFiles(event.dataTransfer.files).catch((error) => notice(error.message, "error")); });
    listen(dropzone, "keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); root.querySelector("[data-ump-file]").click(); } });

    await refresh();
    if (signal.aborted) return null;
    if (recovery.uncleanSession) notice("Đã khôi phục bản autosave của phiên trước chưa đóng sạch. Bạn có thể đối chiếu snapshot trong Lịch sử phiên bản.", "warning");
    else notice(persistence.persistent ? "Kho IndexedDB đã sẵn sàng trên thiết bị." : "IndexedDB không khả dụng; dữ liệu chỉ tồn tại trong phiên này.", persistence.persistent ? "success" : "warning");
    return Object.freeze({
      getProject: () => clone(project),
      getAssets: () => clone(assets),
      getHistoryState: () => ({ ...commandHistory.state }),
      undo: async () => { const changed = await commandHistory.undo(); if (changed) await refresh(); return changed; },
      redo: async () => { const changed = await commandHistory.redo(); if (changed) await refresh(); return changed; },
      refresh,
      selectAsset(id) { selectedId = id; render(); },
      async unmount() { await unmount(root); }
    });
  }

  async function unmount(root) {
    const pendingTargets = [...pendingMounts.entries()].filter(([node]) => !root || node === root);
    pendingTargets.forEach(([node, controller]) => {
      controller.abort(); pendingMounts.delete(node); node.classList?.remove?.("hhump"); node.innerHTML = "";
    });
    const targets = [...activeInstances].filter((instance) => !root || instance.root === root);
    for (const instance of targets) {
      instance.controller.abort();
      await instance.autosave.dispose().catch(() => {});
      await instance.finishSession?.().catch(() => {});
      instance.commandHistory?.clear?.();
      instance.objectUrls.forEach((url) => globalScope.URL?.revokeObjectURL?.(url));
      if (instance.ownedStore) await instance.store.close().catch(() => {});
      instance.root.classList.remove("hhump");
      instance.root.innerHTML = "";
      activeInstances.delete(instance);
    }
  }

  const api = Object.freeze({
    SCHEMA, FORMAT, ASSET_MANIFEST_FORMAT, VERSION, RECORD_VERSION, DB_NAME, STORE_NAMES, ROOT_FOLDER_ID,
    LIMITS: Object.freeze({ MAX_ASSETS, MAX_FOLDERS, MAX_TAGS, MAX_SNAPSHOTS, MAX_INLINE_ASSET_BYTES, MAX_PACKAGE_TEXT_BYTES, MAX_ASSET_MANIFEST_BYTES, MAX_ASSET_BYTES, MAX_ASSET_VERSIONS, MAX_VERSION_BINARY_BYTES, MAX_VERSION_BINARY_TOTAL_BYTES, MAX_COMMAND_HISTORY, HASH_FULL_MAX_BYTES, MAX_SVG_BYTES, MAX_PROJECTS, MAX_PROJECT_PRESETS, MAX_INGEST_JOBS, MAX_SHARED_ENTITIES }),
    TYPE_LABELS, SMART_COLLECTIONS,
    classifyAsset, normalizeProject, normalizeAsset, normalizeRights, normalizeProvenance, normalizeSharedWorkspace, normalizeProjectPreset, normalizeIngestJob, ingestFingerprint, migrateProjectRecord, migrateAssetRecord, migrateSnapshotRecord,
    searchAssets, applySmartCollection, assessWarnings, stripSensitiveMetadata, hasSensitiveMetadata,
    proxyPlan, metadataCapability, computeContentHash, verifyContentHash, inspectAssetBlob, extractMetadata, classifyStorageError, inspectStorageCapabilities, createCommandHistory,
    createMemoryBackend, createStore, mount, unmount
  });

  return api;
});
