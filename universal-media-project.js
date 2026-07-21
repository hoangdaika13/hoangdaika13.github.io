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
  const activeInstances = new Set();

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
    { id: "missing-fonts", label: "Font bị thiếu", icon: "T" },
    { id: "large-video", label: "Video cần proxy", icon: "▶" }
  ]);

  function now() {
    return new Date().toISOString();
  }

  function uid(prefix) {
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
      createdAt: source.createdAt || now()
    };
  }

  function normalizeProject(input) {
    const source = input && typeof input === "object" ? input : {};
    const folders = (Array.isArray(source.folders) ? source.folders : []).slice(0, MAX_FOLDERS).map(normalizeFolder);
    if (!folders.some((folder) => folder.id === ROOT_FOLDER_ID)) folders.unshift(normalizeFolder({ id: ROOT_FOLDER_ID }, 0));
    const createdAt = source.createdAt || now();
    return {
      schema: SCHEMA,
      id: boundedText(source.id, 100, uid("media-project")),
      name: boundedText(source.name, 160, "Dự án media mới"),
      description: boundedText(source.description, 1200),
      createdAt,
      updatedAt: now(),
      folders: folders.slice(0, MAX_FOLDERS),
      requiredFonts: uniqueStrings(source.requiredFonts, 100, 120),
      assetIds: uniqueStrings(source.assetIds, MAX_ASSETS, 100),
      settings: safeJsonValue(source.settings || {}, 0),
      references: safeJsonValue(source.references || {}, 0),
      revision: Math.max(1, Number(source.revision) || 1)
    };
  }

  function normalizeAsset(input) {
    const source = input && typeof input === "object" ? input : {};
    const blob = source.blob instanceof Blob ? source.blob : null;
    const thumbnailBlob = source.thumbnailBlob instanceof Blob ? source.thumbnailBlob : null;
    const type = boundedText(source.type || blob?.type, 160, "application/octet-stream");
    const createdAt = source.createdAt || now();
    return {
      schema: SCHEMA,
      id: boundedText(source.id, 100, uid("asset")),
      projectId: boundedText(source.projectId, 100),
      folderId: boundedText(source.folderId, 100, ROOT_FOLDER_ID),
      name: boundedText(source.name, 240, "asset.bin"),
      type,
      kind: TYPE_LABELS[source.kind] ? source.kind : classifyAsset(type, source.name),
      size: Math.max(0, Number(source.size ?? blob?.size) || 0),
      lastModified: Math.max(0, Number(source.lastModified) || 0),
      checksum: boundedText(source.checksum, 160),
      duplicateOf: boundedText(source.duplicateOf, 100) || null,
      favorite: Boolean(source.favorite),
      tags: uniqueStrings(source.tags, MAX_TAGS, 60),
      availability: ["ready", "offline", "missing"].includes(source.availability) ? source.availability : (blob ? "ready" : "offline"),
      createdAt,
      updatedAt: now(),
      lastOpenedAt: source.lastOpenedAt || createdAt,
      metadata: safeJsonValue(source.metadata || {}, 0),
      thumbnail: safeJsonValue(source.thumbnail || { status: thumbnailBlob ? "generated" : "unavailable" }, 0),
      references: safeJsonValue(source.references || [], 0),
      effects: safeJsonValue(source.effects || [], 0),
      blob,
      thumbnailBlob
    };
  }

  function normalizeSnapshot(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      schema: SCHEMA,
      id: boundedText(source.id, 100, uid("snapshot")),
      projectId: boundedText(source.projectId, 100),
      label: boundedText(source.label, 120, "Snapshot"),
      note: boundedText(source.note, 500),
      createdAt: source.createdAt || now(),
      project: normalizeProject(source.project || {}),
      assets: (Array.isArray(source.assets) ? source.assets : []).slice(0, MAX_ASSETS).map((asset) => {
        const normalized = normalizeAsset(asset);
        normalized.blob = null;
        normalized.thumbnailBlob = null;
        return normalized;
      })
    };
  }

  function searchAssets(assets, query, options) {
    const settings = options || {};
    const term = String(query || "").trim().toLocaleLowerCase("vi");
    return (Array.isArray(assets) ? assets : []).filter((asset) => {
      if (settings.folderId && settings.folderId !== "all" && asset.folderId !== settings.folderId) return false;
      if (settings.kind && settings.kind !== "all" && asset.kind !== settings.kind) return false;
      if (settings.tag && !asset.tags?.includes(settings.tag)) return false;
      if (!term) return true;
      const haystack = [asset.name, asset.kind, asset.type, ...(asset.tags || []), asset.metadata?.title, asset.metadata?.artist]
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
    if (input instanceof Blob) bytes = new Uint8Array(await input.arrayBuffer());
    else if (input instanceof ArrayBuffer) bytes = new Uint8Array(input);
    else if (ArrayBuffer.isView(input)) bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    else bytes = new TextEncoder().encode(String(input || ""));
    const cryptoApi = cryptoScope || globalScope.crypto;
    if (cryptoApi?.subtle?.digest) {
      const digest = await cryptoApi.subtle.digest("SHA-256", bytes);
      return `sha256-${[...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
    }
    let hash = 2166136261;
    for (let index = 0; index < bytes.length; index += 1) {
      hash ^= bytes[index];
      hash = Math.imul(hash, 16777619);
    }
    return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}-${bytes.length}`;
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

  function createMemoryBackend() {
    const stores = Object.fromEntries(STORE_NAMES.map((name) => [name, new Map()]));
    return {
      type: "memory",
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
    if (!indexedDB?.open) return createMemoryBackend();
    try {
      return await createIndexedDbBackend(indexedDB, options?.dbName || DB_NAME);
    } catch (_) {
      return createMemoryBackend();
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

    async function saveProject(input) {
      const existing = input?.id ? await withBackend((backend) => backend.get("projects", input.id)) : null;
      const project = normalizeProject({ ...existing, ...input, createdAt: existing?.createdAt || input?.createdAt, revision: existing ? Math.max(existing.revision + 1, Number(input.revision) || 0) : input?.revision });
      if (JSON.stringify(project).length > MAX_PROJECT_JSON_BYTES) throw new Error("Dự án vượt giới hạn metadata 1 MB.");
      await withBackend((backend) => backend.put("projects", project));
      return clone(project);
    }

    async function getProject(id) {
      return withBackend((backend) => backend.get("projects", id));
    }

    async function listProjects() {
      const projects = await withBackend((backend) => backend.all("projects"));
      return projects.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    }

    async function createFolder(projectId, input) {
      const project = await getProject(projectId);
      if (!project) throw new Error("Không tìm thấy dự án.");
      if (project.folders.length >= MAX_FOLDERS) throw new Error(`Mỗi dự án tối đa ${MAX_FOLDERS} thư mục.`);
      const folder = normalizeFolder({ ...input, id: input?.id || uid("folder") }, project.folders.length);
      await saveProject({ ...project, folders: [...project.folders, folder] });
      return clone(folder);
    }

    async function deleteFolder(projectId, folderId) {
      if (folderId === ROOT_FOLDER_ID) throw new Error("Không thể xóa Media Bin gốc.");
      const project = await getProject(projectId);
      if (!project) throw new Error("Không tìm thấy dự án.");
      const assets = await listAssets(projectId);
      await Promise.all(assets.filter((asset) => asset.folderId === folderId).map((asset) => updateAsset(asset.id, { folderId: ROOT_FOLDER_ID })));
      await saveProject({ ...project, folders: project.folders.filter((folder) => folder.id !== folderId) });
      return true;
    }

    async function listAssets(projectId, query) {
      const assets = await withBackend((backend) => backend.all("assets"));
      const projectAssets = assets.filter((asset) => !projectId || asset.projectId === projectId);
      return searchAssets(projectAssets, query?.text, query).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    }

    async function getAsset(id) {
      return withBackend((backend) => backend.get("assets", id));
    }

    async function findDuplicate(projectId, checksum, exceptId) {
      if (!checksum) return null;
      const assets = await listAssets(projectId);
      return assets.find((asset) => asset.id !== exceptId && asset.checksum === checksum) || null;
    }

    async function saveAsset(input) {
      if (!input?.projectId) throw new Error("Asset cần projectId.");
      const project = await getProject(input.projectId);
      if (!project) throw new Error("Không tìm thấy dự án chứa asset.");
      if (!input.id && project.assetIds.length >= MAX_ASSETS) throw new Error(`Mỗi dự án tối đa ${MAX_ASSETS} asset.`);
      const checksum = input.checksum || (input.blob instanceof Blob ? await computeContentHash(input.blob, options?.crypto) : "");
      const duplicate = await findDuplicate(input.projectId, checksum, input.id);
      const asset = normalizeAsset({ ...input, checksum, duplicateOf: input.duplicateOf || duplicate?.id || null });
      await withBackend((backend) => backend.put("assets", asset));
      if (!project.assetIds.includes(asset.id)) await saveProject({ ...project, assetIds: [...project.assetIds, asset.id] });
      return clone(asset);
    }

    async function updateAsset(id, patch) {
      const existing = await getAsset(id);
      if (!existing) throw new Error("Không tìm thấy asset.");
      const immutable = { id: existing.id, projectId: existing.projectId, createdAt: existing.createdAt };
      const asset = normalizeAsset({ ...existing, ...safeJsonValue(patch || {}, 0), ...immutable, blob: patch?.blob instanceof Blob ? patch.blob : existing.blob, thumbnailBlob: patch?.thumbnailBlob instanceof Blob ? patch.thumbnailBlob : existing.thumbnailBlob });
      await withBackend((backend) => backend.put("assets", asset));
      return clone(asset);
    }

    async function replaceAsset(id, replacement) {
      const existing = await getAsset(id);
      if (!existing) throw new Error("Không tìm thấy asset cần thay thế.");
      const blob = replacement?.blob instanceof Blob ? replacement.blob : null;
      if (!blob) throw new Error("Tệp thay thế không hợp lệ.");
      const checksum = await computeContentHash(blob, options?.crypto);
      const duplicate = await findDuplicate(existing.projectId, checksum, id);
      const replaced = normalizeAsset({
        ...existing,
        name: replacement.name || existing.name,
        type: replacement.type || blob.type || existing.type,
        size: blob.size,
        lastModified: replacement.lastModified || 0,
        metadata: replacement.metadata || {},
        checksum,
        duplicateOf: duplicate?.id || null,
        availability: "ready",
        blob,
        thumbnailBlob: replacement.thumbnailBlob || null,
        thumbnail: replacement.thumbnail || { status: "pending", reason: "Asset vừa được thay thế" },
        references: existing.references,
        effects: existing.effects,
        id: existing.id,
        projectId: existing.projectId,
        folderId: existing.folderId,
        tags: existing.tags,
        favorite: existing.favorite,
        createdAt: existing.createdAt
      });
      await withBackend((backend) => backend.put("assets", replaced));
      return clone(replaced);
    }

    async function removeAsset(id) {
      const asset = await getAsset(id);
      if (!asset) return false;
      await withBackend((backend) => backend.delete("assets", id));
      const project = await getProject(asset.projectId);
      if (project) await saveProject({ ...project, assetIds: project.assetIds.filter((assetId) => assetId !== id) });
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
      return snapshots.filter((snapshot) => !projectId || snapshot.projectId === projectId).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    }

    async function restoreSnapshot(snapshotId) {
      const snapshot = await withBackend((backend) => backend.get("snapshots", snapshotId));
      if (!snapshot) throw new Error("Không tìm thấy snapshot.");
      const currentAssets = new Map((await listAssets(snapshot.projectId)).map((asset) => [asset.id, asset]));
      const project = await saveProject({ ...snapshot.project, id: snapshot.projectId });
      for (const metadata of snapshot.assets) {
        const current = currentAssets.get(metadata.id);
        await withBackend((backend) => backend.put("assets", normalizeAsset({ ...metadata, blob: current?.blob || null, thumbnailBlob: current?.thumbnailBlob || null, availability: current?.blob ? metadata.availability : "offline" })));
      }
      return clone(project);
    }

    function createAutosave(projectId, autosaveOptions) {
      const delay = Math.max(50, Number(autosaveOptions?.delay) || 900);
      let timer = 0;
      let pending = null;
      let closed = false;
      async function flush() {
        if (!pending || closed) return null;
        clearTimeout(timer);
        const next = pending;
        pending = null;
        const saved = await saveProject({ ...next, id: projectId });
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
        const record = { ...asset, blob: undefined, thumbnailBlob: undefined, binary: null };
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
        exportedAt: now(),
        limits: { maxAssets: MAX_ASSETS, maxInlineAssetBytes: MAX_INLINE_ASSET_BYTES },
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
      payload.assets.forEach((asset) => idMap.set(boundedText(asset.id, 100), uid("asset")));
      let project = normalizeProject({ ...safeJsonValue(payload.project, 0), id: projectId, name: `${boundedText(payload.project.name, 140, "Dự án nhập")} · nhập`, assetIds: [] });
      project = await saveProject(project);
      let importedAssets = 0;
      let relinkRequired = 0;
      for (const raw of payload.assets) {
        const clean = safeJsonValue({ ...raw, binary: undefined }, 0);
        let blob = null;
        if (raw.binary) {
          const binary = raw.binary && typeof raw.binary === "object" ? raw.binary : {};
          if (binary.encoding !== "base64" || Number(binary.bytes) > MAX_INLINE_ASSET_BYTES || typeof binary.data !== "string") throw new Error("Binary asset vượt giới hạn an toàn.");
          if (binary.data.length > Math.ceil(MAX_INLINE_ASSET_BYTES * 4 / 3) + 8) throw new Error("Binary Base64 vượt giới hạn an toàn.");
          blob = base64ToBlob(binary.data, binary.type);
          if (blob.size !== Number(binary.bytes)) throw new Error("Kích thước binary asset không khớp manifest.");
        } else relinkRequired += 1;
        const asset = await saveAsset({
          ...clean,
          binary: undefined,
          id: idMap.get(boundedText(clean.id, 100)),
          projectId,
          references: Array.isArray(clean.references) ? clean.references.map((id) => idMap.get(id) || id) : clean.references,
          availability: blob ? "ready" : "offline",
          blob
        });
        importedAssets += 1;
        project.assetIds.push(asset.id);
      }
      await saveProject({ ...project, assetIds: project.assetIds });
      for (const rawSnapshot of (Array.isArray(payload.snapshots) ? payload.snapshots : []).slice(0, MAX_SNAPSHOTS)) {
        const snapshot = normalizeSnapshot({ ...safeJsonValue(rawSnapshot, 0), id: uid("snapshot"), projectId, project: { ...rawSnapshot.project, id: projectId } });
        await withBackend((backend) => backend.put("snapshots", snapshot));
      }
      return { project: await getProject(projectId), importedAssets, relinkRequired, sourceProjectId: oldProjectId };
    }

    async function deleteProject(id) {
      const assets = await listAssets(id);
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
      saveProject, getProject, listProjects, deleteProject,
      createFolder, deleteFolder,
      saveAsset, getAsset, listAssets, updateAsset, replaceAsset, removeAsset, touchAsset, findDuplicate,
      createSnapshot, listSnapshots, restoreSnapshot, createAutosave,
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
    unmount(root);
    renderShell(root);
    const documentScope = root.ownerDocument;
    const controller = new AbortController();
    const store = options?.store || createStore(options);
    const ready = await store.ready();
    let project = options?.projectId ? await store.getProject(options.projectId) : null;
    if (!project) project = (await store.listProjects())[0] || await store.saveProject({ name: options?.name || "Universal Media Project" });
    let assets = [];
    let snapshots = [];
    let selectedId = null;
    let collection = "all";
    let folderId = "all";
    let kind = "all";
    let search = "";
    const objectUrls = new Set();
    const autosave = store.createAutosave(project.id, { delay: 700, onSaved: (saved) => { project = saved; notice("Đã tự lưu dự án trên thiết bị."); } });
    const instance = { root, controller, store, autosave, objectUrls, ownedStore: !options?.store };
    activeInstances.add(instance);

    const signal = controller.signal;
    const listen = (target, type, handler) => target?.addEventListener(type, handler, { signal });
    const notice = (message, tone) => {
      const element = root.querySelector("[data-ump-notice]");
      if (element) { element.textContent = message; element.dataset.tone = tone || "info"; }
    };

    function mediaPreview(asset) {
      const blob = asset.thumbnailBlob || (asset.kind === "image" || asset.kind === "svg" ? asset.blob : null);
      if (!blob || !globalScope.URL?.createObjectURL) return `<span class="hhump-file-icon">${({ image: "IMG", video: "VID", audio: "AUD", font: "Aa", lut: "LUT", svg: "SVG" })[asset.kind] || "FILE"}</span>`;
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
      host.innerHTML = `<section class="hhump-inspector-card"><div class="hhump-kind-badge">${escapeHtml(TYPE_LABELS[asset.kind] || "Tệp")}</div><h3>${escapeHtml(asset.name)}</h3><dl><div><dt>Dung lượng</dt><dd>${formatBytes(asset.size)}</dd></div><div><dt>Checksum</dt><dd title="${escapeHtml(asset.checksum)}">${escapeHtml(asset.checksum ? asset.checksum.slice(0, 18) : "Chưa có")}</dd></div><div><dt>Trạng thái</dt><dd>${asset.availability === "ready" ? "Sẵn sàng" : "Cần relink"}</dd></div><div><dt>Tham chiếu</dt><dd>${Array.isArray(asset.references) ? asset.references.length : 0}</dd></div><div><dt>Hiệu ứng</dt><dd>${Array.isArray(asset.effects) ? asset.effects.length : 0}</dd></div></dl><label>Tag<input data-ump-tags="${escapeHtml(asset.id)}" value="${escapeHtml((asset.tags || []).join(", "))}" placeholder="thumbnail, social"></label><div class="hhump-inspector-actions"><button class="hhump-button" type="button" data-ump-replace="${escapeHtml(asset.id)}">Thay tệp</button><button class="hhump-button" type="button" data-ump-open="${escapeHtml(asset.id)}">Đánh dấu đã mở</button><button class="hhump-button danger" type="button" data-ump-remove="${escapeHtml(asset.id)}">Xóa</button></div><input class="hhump-hidden" type="file" data-ump-replace-file="${escapeHtml(asset.id)}"></section><section class="hhump-proxy-plan ${plan.recommended ? "recommended" : ""}"><small>PROXY PLAN</small><strong>${plan.recommended ? "Nên tạo proxy" : "Không cần proxy"}</strong><p>${escapeHtml(plan.reason)} ${escapeHtml(plan.message)}</p></section>`;
    }

    function renderSnapshots() {
      const host = root.querySelector("[data-ump-snapshots]");
      host.innerHTML = snapshots.length ? snapshots.slice(0, 8).map((snapshot) => `<article><span>◷</span><div><strong>${escapeHtml(snapshot.label)}</strong><small>${new Date(snapshot.createdAt).toLocaleString("vi-VN")}</small></div><button type="button" data-ump-restore="${escapeHtml(snapshot.id)}">Khôi phục</button></article>`).join("") : `<p>Chưa có snapshot. Binary không bị nhân bản; phiên bản lưu project và metadata asset.</p>`;
    }

    function renderStatus() {
      const warnings = assessWarnings(project, assets, { availableFonts: options?.availableFonts || [] });
      root.querySelector("[data-ump-project-name]").value = project.name;
      root.querySelector("[data-ump-persistence]").textContent = ready.backend === "indexeddb" ? "IndexedDB · local-first" : "Bộ nhớ tạm · chưa bền vững";
      root.querySelector("[data-ump-health]").textContent = `${warnings.length} cảnh báo`;
      root.querySelector("[data-ump-health]").classList.toggle("has-warning", warnings.length > 0);
      root.querySelector("[data-ump-metrics]").innerHTML = `<span><b>${assets.length}</b> asset</span><span><b>${formatBytes(assets.reduce((sum, asset) => sum + asset.size, 0))}</b> local</span><span><b>${snapshots.length}</b> phiên bản</span><span><b>${warnings.length}</b> cảnh báo</span>`;
    }

    function render() {
      renderCollections();
      renderFolders();
      renderAssets();
      renderInspector();
      renderSnapshots();
      renderStatus();
    }

    async function refresh() {
      project = await store.getProject(project.id);
      assets = await store.listAssets(project.id);
      snapshots = await store.listSnapshots(project.id);
      render();
    }

    async function addFiles(fileList) {
      const files = [...(fileList || [])].slice(0, MAX_ASSETS);
      if (!files.length) return;
      notice(`Đang phân tích ${files.length} tệp...`);
      let duplicates = 0;
      for (const file of files) {
        const metadata = await extractMetadata(file, globalScope);
        const asset = await store.saveAsset({ projectId: project.id, folderId: folderId === "all" ? ROOT_FOLDER_ID : folderId, name: file.name, type: file.type, size: file.size, lastModified: file.lastModified, metadata, blob: file });
        if (asset.duplicateOf) duplicates += 1;
      }
      await refresh();
      notice(`Đã thêm ${files.length} tệp${duplicates ? `, phát hiện ${duplicates} tệp trùng` : ""}.`, duplicates ? "warning" : "success");
    }

    listen(root, "click", async (event) => {
      const upload = event.target.closest("[data-ump-upload]");
      if (upload) { root.querySelector("[data-ump-file]").click(); return; }
      const packageImport = event.target.closest("[data-ump-import]");
      if (packageImport) { root.querySelector("[data-ump-package-file]").click(); return; }
      const collectionButton = event.target.closest("[data-ump-collection]");
      if (collectionButton) { collection = collectionButton.dataset.umpCollection; folderId = "all"; render(); return; }
      const folderButton = event.target.closest("[data-ump-folder]");
      if (folderButton) { folderId = folderButton.dataset.umpFolder; collection = "all"; render(); return; }
      const favoriteButton = event.target.closest("[data-ump-favorite]");
      if (favoriteButton) { event.stopPropagation(); const asset = await store.getAsset(favoriteButton.dataset.umpFavorite); await store.updateAsset(asset.id, { favorite: !asset.favorite }); await refresh(); return; }
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
      if (restore) { await store.restoreSnapshot(restore.dataset.umpRestore); await refresh(); notice("Đã khôi phục phiên bản; binary hiện có được giữ nguyên.", "success"); return; }
      const replace = event.target.closest("[data-ump-replace]");
      if (replace) { root.querySelector(`[data-ump-replace-file="${replace.dataset.umpReplace}"]`)?.click(); return; }
      const open = event.target.closest("[data-ump-open]");
      if (open) { await store.touchAsset(open.dataset.umpOpen); await refresh(); notice("Đã cập nhật hoạt động gần đây."); return; }
      const remove = event.target.closest("[data-ump-remove]");
      if (remove) { await store.removeAsset(remove.dataset.umpRemove); selectedId = null; await refresh(); notice("Đã xóa asset khỏi Media Bin.", "success"); return; }
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
        try { const imported = await store.importPackage(file); project = imported.project; selectedId = null; await refresh(); notice(`Đã nhập ${imported.importedAssets} asset; ${imported.relinkRequired} asset cần relink.`, imported.relinkRequired ? "warning" : "success"); }
        catch (error) { notice(error.message, "error"); }
        event.target.value = "";
        return;
      }
      if (event.target.matches("[data-ump-kind]")) { kind = event.target.value; renderAssets(); return; }
      if (event.target.matches("[data-ump-tags]")) { await store.updateAsset(event.target.dataset.umpTags, { tags: event.target.value.split(",").map((tag) => tag.trim()) }); await refresh(); return; }
      if (event.target.matches("[data-ump-replace-file]")) {
        const file = event.target.files?.[0];
        if (!file) return;
        const metadata = await extractMetadata(file, globalScope);
        await store.replaceAsset(event.target.dataset.umpReplaceFile, { name: file.name, type: file.type, blob: file, lastModified: file.lastModified, metadata });
        await refresh(); notice("Đã thay asset và giữ nguyên ID, reference, effect.", "success");
      }
    });

    listen(root.querySelector("[data-ump-search]"), "input", (event) => { search = event.target.value; renderAssets(); });
    listen(root.querySelector("[data-ump-project-name]"), "input", (event) => { project = { ...project, name: boundedText(event.target.value, 160, "Dự án media") }; autosave.schedule(project); });
    const dropzone = root.querySelector("[data-ump-drop]");
    listen(dropzone, "dragover", (event) => { event.preventDefault(); dropzone.classList.add("dragging"); });
    listen(dropzone, "dragleave", () => dropzone.classList.remove("dragging"));
    listen(dropzone, "drop", (event) => { event.preventDefault(); dropzone.classList.remove("dragging"); addFiles(event.dataTransfer.files).catch((error) => notice(error.message, "error")); });
    listen(dropzone, "keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); root.querySelector("[data-ump-file]").click(); } });

    await refresh();
    notice(ready.backend === "indexeddb" ? "Kho IndexedDB đã sẵn sàng trên thiết bị." : "IndexedDB không khả dụng; dữ liệu chỉ tồn tại trong phiên này.", ready.backend === "indexeddb" ? "success" : "warning");
    return Object.freeze({
      getProject: () => clone(project),
      getAssets: () => clone(assets),
      refresh,
      selectAsset(id) { selectedId = id; render(); },
      async unmount() { await unmount(root); }
    });
  }

  async function unmount(root) {
    const targets = [...activeInstances].filter((instance) => !root || instance.root === root);
    for (const instance of targets) {
      instance.controller.abort();
      await instance.autosave.dispose().catch(() => {});
      instance.objectUrls.forEach((url) => globalScope.URL?.revokeObjectURL?.(url));
      if (instance.ownedStore) await instance.store.close().catch(() => {});
      instance.root.classList.remove("hhump");
      instance.root.innerHTML = "";
      activeInstances.delete(instance);
    }
  }

  const api = Object.freeze({
    SCHEMA, FORMAT, VERSION, DB_NAME, STORE_NAMES, ROOT_FOLDER_ID,
    LIMITS: Object.freeze({ MAX_ASSETS, MAX_FOLDERS, MAX_TAGS, MAX_SNAPSHOTS, MAX_INLINE_ASSET_BYTES, MAX_PACKAGE_TEXT_BYTES }),
    TYPE_LABELS, SMART_COLLECTIONS,
    classifyAsset, normalizeProject, normalizeAsset, searchAssets, applySmartCollection, assessWarnings,
    proxyPlan, metadataCapability, computeContentHash, extractMetadata,
    createMemoryBackend, createStore, mount, unmount
  });

  return api;
});
