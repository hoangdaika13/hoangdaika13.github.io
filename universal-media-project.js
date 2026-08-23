(function (globalScope, factory) {
  "use strict";
  const api = factory(globalScope || globalThis);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope) globalScope.HHUniversalMediaProject = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (globalScope) {
  "use strict";

  const SCHEMA = "hh.universal-media.v1";
  const FORMAT = "hhmedia-package";
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
  const MAX_PROJECT_JSON_BYTES = 1024 * 1024;
  const MAX_ASSET_BYTES = 4 * 1024 * 1024 * 1024;
  const MAX_ASSET_VERSIONS = 24;
  const MAX_VERSION_BINARY_BYTES = 8 * 1024 * 1024;
  const MAX_VERSION_BINARY_TOTAL_BYTES = 32 * 1024 * 1024;
  const MAX_COMMAND_HISTORY = 100;
  const HASH_FULL_MAX_BYTES = 32 * 1024 * 1024;
  const MAX_SVG_BYTES = 5 * 1024 * 1024;
  const MAX_RIGHTS_USES = 20;
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
    return {
      schema: SCHEMA,
      recordVersion: RECORD_VERSION,
      id: boundedText(source.id, 100, uid("media-project")),
      name: boundedText(source.name, 160, "Dự án media mới"),
      description: boundedText(source.description, 1200),
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

  function searchAssets(assets, query, options) {
    const settings = options || {};
    const term = String(query || "").trim().toLocaleLowerCase("vi");
    return (Array.isArray(assets) ? assets : []).filter((asset) => {
      if (settings.folderId && settings.folderId !== "all" && asset.folderId !== settings.folderId) return false;
      if (settings.kind && settings.kind !== "all" && asset.kind !== settings.kind) return false;
      if (settings.tag && !asset.tags?.includes(settings.tag)) return false;
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
      const project = normalizeProject({ ...existing, ...input, createdAt: existing?.createdAt || input?.createdAt, updatedAt: now(), revision: existing ? Math.max(existing.revision + 1, Number(input.revision) || 0) : input?.revision });
      if (JSON.stringify(project).length > MAX_PROJECT_JSON_BYTES) throw new Error("Dự án vượt giới hạn metadata 1 MB.");
      await withBackend((backend) => backend.put("projects", project));
      return clone(project);
    }

    async function getProject(id) {
      return migrateStoredRecord("projects", await withBackend((backend) => backend.get("projects", id)), migrateProjectRecord);
    }

    async function listProjects() {
      const projects = await withBackend((backend) => backend.all("projects"));
      return Promise.all(projects.map((project) => migrateStoredRecord("projects", project, migrateProjectRecord))).then((rows) => rows.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))));
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
        orphanAssetIds
      };
    }

    function createAutosave(projectId, autosaveOptions) {
      const delay = Math.max(50, Number(autosaveOptions?.delay) || 900);
      const checkpointEvery = Math.max(0, Math.min(100, Number(autosaveOptions?.checkpointEvery) || 0));
      let timer = 0;
      let pending = null;
      let closed = false;
      let saveCount = 0;
      async function flush() {
        if (!pending || closed) return null;
        clearTimeout(timer);
        const next = pending;
        pending = null;
        let saved;
        try { saved = await saveProject({ ...next, id: projectId }); }
        catch (error) { pending = next; throw error; }
        saveCount += 1;
        if (checkpointEvery && saveCount % checkpointEvery === 0) {
          try {
            const checkpoint = await createSnapshot(projectId, `Tự động · ${new Date().toLocaleString("vi-VN")}`, "Checkpoint autosave");
            autosaveOptions?.onCheckpoint?.(clone(checkpoint));
          } catch (error) { autosaveOptions?.onError?.(error); }
        }
        autosaveOptions?.onSaved?.(clone(saved));
        return saved;
      }
      return {
        schedule(project) {
          if (closed) return false;
          pending = clone(project);
          clearTimeout(timer);
          timer = setTimeout(() => { flush().catch(autosaveOptions?.onError || (() => {})); }, delay);
          return true;
        },
        flush,
        async dispose(settings) { if (settings?.flush !== false) await flush(); closed = true; clearTimeout(timer); },
        get pending() { return Boolean(pending); }
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
            const actual = await computeContentHash(blob, options?.crypto);
            const expectedFamily = expected.replace(/^sampled-/, "").split("-")[0];
            const actualFamily = actual.replace(/^sampled-/, "").split("-")[0];
            if (expectedFamily === actualFamily && expected !== actual) throw new Error(`Checksum binary không khớp với asset ${sourceId}.`);
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
      async storageStatus() { const backend = await backendPromise; return { backend: backend.type, persistent: backend.persistent === true || backend.type === "indexeddb", fallbackReason: backend.fallbackReason || "", schema: SCHEMA, recordVersion: RECORD_VERSION }; },
      saveProject, getProject, listProjects, deleteProject,
      createFolder, deleteFolder,
      saveAsset, getAsset, listAssets, updateAsset, replaceAsset, relinkAsset, restoreAssetVersion, restoreAssetRecord, removeAsset, touchAsset, findDuplicate, repairDuplicateLinks,
      createSnapshot, listSnapshots, restoreSnapshot, recoveryStatus, createAutosave,
      exportPackage, importPackage,
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
          <button class="hhump-button" type="button" data-ump-undo disabled aria-label="Hoàn tác">↶ Hoàn tác</button>
          <button class="hhump-button" type="button" data-ump-redo disabled aria-label="Làm lại">↷ Làm lại</button>
          <button class="hhump-button" type="button" data-ump-snapshot>Chụp phiên bản</button>
          <button class="hhump-button" type="button" data-ump-import>Mở .hhmedia</button>
          <button class="hhump-button primary" type="button" data-ump-export>Đóng gói .hhmedia</button>
        </div>
        <input class="hhump-hidden" type="file" accept=".hhmedia,application/json" data-ump-package-file aria-label="Chọn gói HH Media">
      </header>
      <section class="hhump-projectbar" aria-label="Thông tin dự án">
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
            <button class="hhump-button" type="button" data-ump-upload>+ Thêm media</button>
            <input class="hhump-hidden" type="file" multiple accept="image/*,video/*,audio/*,.svg,.ttf,.otf,.woff,.woff2,.cube,.3dl,.look,.lut" data-ump-file aria-label="Chọn media từ thiết bị">
          </section>
          <section class="hhump-dropzone" data-ump-drop tabindex="0" role="button" aria-label="Kéo thả hoặc chọn media">
            <span aria-hidden="true">＋</span><div><strong>Thả ảnh, video, âm thanh, font, LUT hoặc SVG</strong><small>Binary lưu trong IndexedDB trên thiết bị, không đưa vào localStorage.</small></div><button class="hhump-button primary" type="button" data-ump-upload>Chọn tệp</button>
          </section>
          <div class="hhump-notice" data-ump-notice role="status" aria-live="polite">Sẵn sàng.</div>
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
    const ready = await store.ready();
    if (signal.aborted || pendingMounts.get(root) !== controller) { if (!options?.store) await store.close().catch(() => {}); return null; }
    const persistence = await store.storageStatus?.() || { backend: ready.backend, persistent: ready.backend === "indexeddb", fallbackReason: "" };
    let project = options?.projectId ? await store.getProject(options.projectId) : null;
    if (!project) project = (await store.listProjects())[0] || await store.saveProject({ name: options?.name || "Universal Media Project" });
    if (signal.aborted || pendingMounts.get(root) !== controller) { if (!options?.store) await store.close().catch(() => {}); return null; }
    let assets = [];
    let snapshots = [];
    let selectedId = null;
    let collection = "all";
    let folderId = "all";
    let kind = "all";
    let search = "";
    const objectUrls = new Set();
    const updateHistoryControls = (state) => {
      const undo = root.querySelector("[data-ump-undo]");
      const redo = root.querySelector("[data-ump-redo]");
      if (undo) { undo.disabled = !state.canUndo; undo.title = state.undoLabel ? `Hoàn tác: ${state.undoLabel}` : "Không có thao tác để hoàn tác"; }
      if (redo) { redo.disabled = !state.canRedo; redo.title = state.redoLabel ? `Làm lại: ${state.redoLabel}` : "Không có thao tác để làm lại"; }
    };
    const commandHistory = createCommandHistory({ limit: MAX_COMMAND_HISTORY, onChange: updateHistoryControls });
    const createProjectAutosave = (projectId) => store.createAutosave(projectId, { delay: 700, checkpointEvery: 10, onSaved: (saved) => { project = saved; notice("Đã tự lưu dự án trên thiết bị."); } });
    let autosave = createProjectAutosave(project.id);
    const instance = { root, controller, store, autosave, commandHistory, objectUrls, ownedStore: !options?.store };
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
      const searched = searchAssets(assets, search, { folderId, kind });
      return applySmartCollection(searched, collection, { availableFonts: options?.availableFonts || [] });
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
      root.querySelector("[data-ump-persistence]").textContent = persistence.persistent ? "IndexedDB · local-first" : `Bộ nhớ tạm · ${persistence.fallbackReason === "indexeddb-unavailable" ? "trình duyệt không hỗ trợ" : "không thể mở kho bền vững"}`;
      root.querySelector("[data-ump-health]").textContent = `${warnings.length} cảnh báo`;
      root.querySelector("[data-ump-health]").classList.toggle("has-warning", warnings.length > 0);
      root.querySelector("[data-ump-metrics]").innerHTML = `<span><b>${assets.length}</b> asset</span><span><b>${formatBytes(assets.reduce((sum, asset) => sum + asset.size, 0))}</b> local</span><span><b>${snapshots.length}</b> phiên bản</span><span><b>${warnings.length}</b> cảnh báo</span>`;
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
      renderStatus();
      scrollers.forEach(({ selector, top, left }) => { const node = root.querySelector(selector); if (node) { node.scrollTop = top; node.scrollLeft = left; } });
      let focusTarget = focusProjectName ? root.querySelector("[data-ump-project-name]") : null;
      if (!focusTarget && focusAttribute) focusTarget = [...root.querySelectorAll(`[${focusAttribute}]`)].find((node) => node.getAttribute(focusAttribute) === focusValue);
      if (!focusTarget && focusForm && focusName) focusTarget = [...root.querySelectorAll("[data-ump-rights-form]")].find((form) => form.dataset.umpRightsForm === focusForm)?.elements?.namedItem?.(focusName);
      focusTarget?.focus?.({ preventScroll: true });
    }

    async function refresh() {
      if (signal.aborted) return;
      project = await store.getProject(project.id);
      if (signal.aborted || !project) return;
      assets = await store.listAssets(project.id);
      snapshots = await store.listSnapshots(project.id);
      if (signal.aborted) return;
      render();
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
          const asset = await store.saveAsset({ projectId: project.id, folderId: folderId === "all" ? ROOT_FOLDER_ID : folderId, name: file.name, type: file.type, size: file.size, lastModified: file.lastModified, metadata, provenance: { sourceType: "local-file", originalName: file.name }, blob: file });
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
      const upload = event.target.closest("[data-ump-upload]");
      if (upload) { root.querySelector("[data-ump-file]").click(); return; }
      const packageImport = event.target.closest("[data-ump-import]");
      if (packageImport) { root.querySelector("[data-ump-package-file]").click(); return; }
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
      if (event.target.matches("[data-ump-file]")) { await addFiles(event.target.files); event.target.value = ""; return; }
      if (event.target.matches("[data-ump-package-file]")) {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
          const imported = await store.importPackage(file);
          if (signal.aborted) return;
          await autosave.dispose({ flush: false }); project = imported.project; autosave = createProjectAutosave(project.id); instance.autosave = autosave; commandHistory.clear(); selectedId = null;
          await refresh(); notice(`Đã nhập ${imported.importedAssets} asset; ${imported.relinkRequired} asset cần relink.`, imported.relinkRequired ? "warning" : "success");
        }
        catch (error) { notice(error.message, "error"); }
        event.target.value = "";
        return;
      }
      if (event.target.matches("[data-ump-kind]")) { kind = event.target.value; renderAssets(); return; }
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
    notice(persistence.persistent ? "Kho IndexedDB đã sẵn sàng trên thiết bị." : "IndexedDB không khả dụng; dữ liệu chỉ tồn tại trong phiên này.", persistence.persistent ? "success" : "warning");
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
      instance.commandHistory?.clear?.();
      instance.objectUrls.forEach((url) => globalScope.URL?.revokeObjectURL?.(url));
      if (instance.ownedStore) await instance.store.close().catch(() => {});
      instance.root.classList.remove("hhump");
      instance.root.innerHTML = "";
      activeInstances.delete(instance);
    }
  }

  const api = Object.freeze({
    SCHEMA, FORMAT, VERSION, RECORD_VERSION, DB_NAME, STORE_NAMES, ROOT_FOLDER_ID,
    LIMITS: Object.freeze({ MAX_ASSETS, MAX_FOLDERS, MAX_TAGS, MAX_SNAPSHOTS, MAX_INLINE_ASSET_BYTES, MAX_PACKAGE_TEXT_BYTES, MAX_ASSET_BYTES, MAX_ASSET_VERSIONS, MAX_VERSION_BINARY_BYTES, MAX_VERSION_BINARY_TOTAL_BYTES, MAX_COMMAND_HISTORY, HASH_FULL_MAX_BYTES, MAX_SVG_BYTES }),
    TYPE_LABELS, SMART_COLLECTIONS,
    classifyAsset, normalizeProject, normalizeAsset, normalizeRights, normalizeProvenance, migrateProjectRecord, migrateAssetRecord, migrateSnapshotRecord,
    searchAssets, applySmartCollection, assessWarnings, stripSensitiveMetadata, hasSensitiveMetadata,
    proxyPlan, metadataCapability, computeContentHash, inspectAssetBlob, extractMetadata, createCommandHistory,
    createMemoryBackend, createStore, mount, unmount
  });

  return api;
});
