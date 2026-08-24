(function initHHEonWildCinematicPacks(root, factory) {
  "use strict";
  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHEonWildCinematicPacks = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createHHEonWildCinematicPacks(runtime) {
  "use strict";

  const VERSION = "1.1.0";
  const MANIFEST_FORMAT = "hh-eonwild-cinematic-pack";
  const MANIFEST_VERSION = 1;
  const CACHE_NAME = "hh-eonwild-cinematic-assets-v1";
  const ROOT_DIRECTORY = "hh-eonwild-cinematic-v1";
  const WORKER_URL = "./hh-eonwild-cinematic-pack-worker.js?v=1";
  const MAX_PACK_BYTES = 8 * 1024 * 1024 * 1024;
  const MAX_ASSET_BYTES = 2 * 1024 * 1024 * 1024;
  const MAX_ASSETS = 256;
  const CACHE_FALLBACK_MAX_BYTES = 128 * 1024 * 1024;
  const MAX_LICENSE_REPORT_BYTES = 4 * 1024 * 1024;
  const DEFAULT_HASH_TIMEOUT_MS = 30 * 1000;
  const LICENSE_REPORT_PATH = "license-report.bin";
  const SHA256_PATTERN = /^[a-f0-9]{64}$/;
  const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
  const SAFE_PATH_SEGMENT_PATTERN = /^[a-z0-9][a-z0-9._@+-]{0,95}$/i;
  const SAFE_BUILD_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/i;
  const SAFE_CONTENT_TYPE_PATTERN = /^(?:application\/(?:octet-stream|json|gltf-buffer|x-ktx2)|model\/gltf(?:\+json|-binary)|image\/(?:png|jpeg|webp|avif|ktx2|vnd\.radiance|x-exr)|audio\/(?:mpeg|ogg|wav|webm|flac|aac))$/i;
  const VALID_STATES = new Set(["not-installed", "installing", "paused", "ready", "failed"]);
  const APPROVED_LICENSES = new Set(["CC0-1.0", "CC-BY-4.0", "Apache-2.0", "original-proprietary"]);
  const SAFE_ROLE_PATTERN = /^(?:creature:[a-z0-9][a-z0-9-]{0,63}:lod[0-3]|vegetation:[a-z0-9][a-z0-9-]{0,63}|terrain:[a-z0-9][a-z0-9-]{0,63}|ocean:[a-z0-9][a-z0-9-]{0,63}|weather:[a-z0-9][a-z0-9-]{0,63}|audio:[a-z0-9][a-z0-9-]{0,63})$/;
  const CREATURE_ROLE_PATTERN = /^creature:([a-z0-9][a-z0-9-]{0,63}):lod([0-3])$/;
  const RESERVED_PACK_PATHS = new Set([LICENSE_REPORT_PATH, "pack-state.json", "pack-manifest.json", "pack-pending.json"]);

  const PACK_CATALOG = Object.freeze([
    Object.freeze({ id: "creature-ultra", label: "Creature Ultra Pack", description: "Model đúng loài, rig, animation, PBR và bốn LOD.", accent: "#ff9b70" }),
    Object.freeze({ id: "forest-vegetation", label: "Forest & Vegetation Pack", description: "Cây, cỏ, dương xỉ và vật liệu tán lá độ phân giải cao.", accent: "#65f0a5" }),
    Object.freeze({ id: "terrain-rock", label: "Terrain & Rock Pack", description: "Heightmap, splat material, đá quét và displacement.", accent: "#e7bb78" }),
    Object.freeze({ id: "ocean", label: "Ocean Pack", description: "Sóng, foam, caustics, bờ biển và môi trường dưới nước.", accent: "#55d9ff" }),
    Object.freeze({ id: "weather-atmosphere", label: "Weather & Atmosphere Pack", description: "Mây, mưa, sương, bão, tuyết, tro và LUT điện ảnh.", accent: "#9d8cff" }),
    Object.freeze({ id: "cinematic-audio", label: "Cinematic Audio Pack", description: "Ambience và âm thanh động vật có giấy phép rõ ràng.", accent: "#ff70c8" })
  ]);
  const PACK_IDS = new Set(PACK_CATALOG.map((pack) => pack.id));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const freeze = (value) => Object.freeze(value);
  const safePath = (value) => {
    const path = String(value || "").replaceAll("\\", "/");
    return Boolean(path && path.length <= 240 && path.split("/").every((part) => SAFE_PATH_SEGMENT_PATTERN.test(part) && part !== "." && part !== ".."));
  };

  function formatBytes(value) {
    const bytes = Math.max(0, Number(value) || 0);
    if (bytes < 1024) return `${Math.round(bytes)} B`;
    const units = ["KiB", "MiB", "GiB", "TiB"];
    let amount = bytes;
    let unit = -1;
    do { amount /= 1024; unit += 1; } while (amount >= 1024 && unit < units.length - 1);
    return `${amount >= 100 ? amount.toFixed(0) : amount >= 10 ? amount.toFixed(1) : amount.toFixed(2)} ${units[unit]}`;
  }

  function trustedAssetUrl(rawUrl, options = {}) {
    try {
      const environment = options.runtime || runtime;
      const base = options.baseUrl || environment.location?.href || "https://invalid.local/";
      const url = new URL(String(rawUrl || ""), base);
      const page = new URL(base);
      const origins = new Set([page.origin]);
      for (const candidate of Array.isArray(options.trustedOrigins) ? options.trustedOrigins : []) {
        try {
          const allowed = new URL(String(candidate));
          if (/^https?:$/i.test(allowed.protocol) && !allowed.username && !allowed.password && !allowed.search && !allowed.hash && !(page.protocol === "https:" && allowed.protocol !== "https:")) origins.add(allowed.origin);
        } catch {}
      }
      if (!/^https?:$/i.test(url.protocol) || url.username || url.password || url.search || url.hash || !origins.has(url.origin)) return null;
      if (page.protocol === "https:" && url.protocol !== "https:") return null;
      return url;
    } catch { return null; }
  }

  function safeEvidenceUrl(rawUrl) {
    try {
      const url = new URL(String(rawUrl || ""));
      return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash ? url.href : "";
    } catch { return ""; }
  }

  function validateManifest(input, options = {}) {
    const errors = [];
    const manifest = input && typeof input === "object" && !Array.isArray(input) ? input : {};
    const id = String(manifest.id || "");
    const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
    if (manifest.format !== MANIFEST_FORMAT || manifest.version !== MANIFEST_VERSION) errors.push("Định dạng hoặc phiên bản manifest không được hỗ trợ.");
    if (!SAFE_ID_PATTERN.test(id) || !PACK_IDS.has(id)) errors.push("Mã gói không nằm trong danh mục Cinematic được phép.");
    if (manifest.immutable !== true) errors.push("Manifest phải xác nhận URL asset bất biến.");
    if (!SAFE_BUILD_PATTERN.test(String(manifest.build || ""))) errors.push("Gói cần build ID an toàn, bất biến và có giới hạn.");
    if (assets.length === 0 || assets.length > MAX_ASSETS) errors.push("Số asset trong gói không hợp lệ.");
    const licenseReportUrl = trustedAssetUrl(manifest.licenseReportUrl, options);
    const licenseReportSha256 = String(manifest.licenseReportSha256 || "").toLowerCase();
    const approvedAssetRecords = new Map();
    const rawApprovedRecords = options.approvedAssetRecords instanceof Map
      ? [...options.approvedAssetRecords]
      : Object.entries(options.approvedAssetRecords && typeof options.approvedAssetRecords === "object" ? options.approvedAssetRecords : {});
    for (const [recordId, record] of rawApprovedRecords) {
      const safeId = String(recordId || "");
      if (!SAFE_ID_PATTERN.test(safeId) || !record || typeof record !== "object" || Array.isArray(record)) continue;
      approvedAssetRecords.set(safeId, record);
    }
    if (!licenseReportUrl) errors.push("URL báo cáo giấy phép phải thuộc cùng allowlist asset bất biến.");
    if (!SHA256_PATTERN.test(licenseReportSha256)) errors.push("Báo cáo giấy phép cần SHA-256 bất biến.");
    const paths = new Set();
    const roles = new Set();
    const creatureLods = new Map();
    let totalBytes = 0;
    const normalizedAssets = [];
    for (const asset of assets.slice(0, MAX_ASSETS + 1)) {
      const path = String(asset?.path || "").replaceAll("\\", "/");
      const byteSize = Number(asset?.byteSize);
      const sha256 = String(asset?.sha256 || "").toLowerCase();
      const url = trustedAssetUrl(asset?.url, options);
      const contentType = String(asset?.contentType || "application/octet-stream").toLowerCase().trim();
      const role = String(asset?.role || "").trim().toLowerCase();
      const assetManifestId = String(asset?.assetManifestId || "");
      const author = String(asset?.author || "").trim();
      const license = String(asset?.license || "").trim();
      const licenseUrl = safeEvidenceUrl(asset?.licenseUrl);
      const sourceUrl = safeEvidenceUrl(asset?.sourceUrl);
      const provenanceSha256 = String(asset?.provenanceSha256 || "").toLowerCase();
      const pathKey = path.toLowerCase();
      const reservedPath = [...RESERVED_PACK_PATHS].some((reserved) => pathKey === reserved || pathKey.startsWith(`${reserved}/`));
      const approvedRecord = SAFE_ID_PATTERN.test(assetManifestId) ? approvedAssetRecords.get(assetManifestId) : null;
      const hasManifestReference = Boolean(approvedRecord
        && String(approvedRecord.sha256 || "").toLowerCase() === sha256
        && Number(approvedRecord.byteSize) === byteSize
        && String(approvedRecord.author || "").trim() === author
        && safeEvidenceUrl(approvedRecord.sourceUrl) === sourceUrl
        && String(approvedRecord.license || "").trim() === license
        && safeEvidenceUrl(approvedRecord.licenseUrl) === licenseUrl);
      const hasInlineProvenance = Boolean(author && author.length <= 160 && !/[\u0000-\u001f\u007f]/u.test(author) && APPROVED_LICENSES.has(license) && licenseUrl && sourceUrl);
      if (!safePath(path)) errors.push(`Đường dẫn asset không an toàn: ${path || "<trống>"}.`);
      if (reservedPath) errors.push(`Đường dẫn asset trùng metadata dành riêng: ${path}.`);
      if (paths.has(pathKey)) errors.push(`Asset bị trùng đường dẫn: ${path}.`);
      if ([...paths].some((existing) => pathKey.startsWith(`${existing}/`) || existing.startsWith(`${pathKey}/`))) errors.push(`Đường dẫn asset xung đột file/thư mục: ${path}.`);
      paths.add(pathKey);
      if (!Number.isSafeInteger(byteSize) || byteSize <= 0 || byteSize > MAX_ASSET_BYTES) errors.push(`Kích thước asset không hợp lệ: ${path}.`);
      if (!SHA256_PATTERN.test(sha256)) errors.push(`SHA-256 không hợp lệ: ${path}.`);
      if (!url) errors.push(`URL asset không thuộc allowlist: ${path}.`);
      if (!SAFE_CONTENT_TYPE_PATTERN.test(contentType)) errors.push(`Content-Type asset không an toàn: ${path}.`);
      if (role && !SAFE_ROLE_PATTERN.test(role)) errors.push(`Vai trò runtime không hợp lệ: ${path}.`);
      if (role && roles.has(role)) errors.push(`Vai trò runtime bị trùng: ${role}.`);
      if (role) roles.add(role);
      if (id === "creature-ultra" && contentType === "model/gltf-binary") {
        const creatureRole = CREATURE_ROLE_PATTERN.exec(role);
        if (!creatureRole) errors.push(`Creature Ultra GLB cần role creature:<loài>:lod0-3: ${path}.`);
        else {
          const species = creatureRole[1];
          const lod = Number(creatureRole[2]);
          if (!creatureLods.has(species)) creatureLods.set(species, new Set());
          creatureLods.get(species).add(lod);
        }
      }
      if (!hasManifestReference && !hasInlineProvenance) errors.push(`Asset thiếu bản ghi provenance khớp byte hoặc metadata provenance đầy đủ: ${path}.`);
      if (!SHA256_PATTERN.test(provenanceSha256) || provenanceSha256 !== licenseReportSha256) errors.push(`Asset không liên kết đúng SHA-256 báo cáo provenance: ${path}.`);
      totalBytes += Number.isSafeInteger(byteSize) ? byteSize : 0;
      normalizedAssets.push(freeze({
        path,
        byteSize,
        sha256,
        url: url?.href || "",
        contentType,
        role,
        assetManifestId: hasManifestReference ? assetManifestId : "",
        author: hasInlineProvenance ? author : "",
        license: hasInlineProvenance ? license : "",
        licenseUrl: hasInlineProvenance ? licenseUrl : "",
        sourceUrl: hasInlineProvenance ? sourceUrl : "",
        provenanceSha256
      }));
    }
    if (id === "creature-ultra") {
      if (creatureLods.size === 0) errors.push("Creature Ultra cần ít nhất một loài có đủ bốn LOD.");
      for (const [species, lods] of creatureLods) {
        if (lods.size !== 4 || ![0, 1, 2, 3].every((lod) => lods.has(lod))) errors.push(`Creature Ultra cần đúng bốn role LOD0-LOD3 duy nhất cho loài ${species}.`);
      }
    }
    if (!Number.isSafeInteger(manifest.totalBytes) || manifest.totalBytes !== totalBytes || totalBytes <= 0 || totalBytes > MAX_PACK_BYTES) errors.push("Tổng số byte của gói không khớp hoặc vượt 8 GiB.");
    return freeze({
      valid: errors.length === 0,
      errors: freeze(errors),
      manifest: errors.length ? null : freeze({
        format: MANIFEST_FORMAT,
        version: MANIFEST_VERSION,
        id,
        build: String(manifest.build),
        immutable: true,
        totalBytes,
        licenseReportUrl: licenseReportUrl?.href || "",
        licenseReportSha256,
        assets: freeze(normalizedAssets)
      })
    });
  }

  function createHashSession(options = {}) {
    const environment = options.runtime || runtime;
    const WorkerCtor = options.Worker || environment.Worker;
    if (typeof WorkerCtor !== "function") return null;
    const worker = new WorkerCtor(options.workerUrl || WORKER_URL);
    const id = `hash-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const signal = options.signal || null;
    const timeoutMs = clamp(Number(options.workerTimeoutMs || DEFAULT_HASH_TIMEOUT_MS), 50, 5 * 60 * 1000);
    let waiting = null;
    let closed = false;
    const abortException = () => {
      const DomExceptionCtor = environment.DOMException || (typeof DOMException === "function" ? DOMException : null);
      return DomExceptionCtor ? new DomExceptionCtor("Hash aborted.", "AbortError") : Object.assign(new Error("Hash aborted."), { name: "AbortError" });
    };
    const detach = () => {
      try { worker.removeEventListener("message", receive); } catch {}
      try { worker.removeEventListener("error", receiveError); } catch {}
      try { worker.removeEventListener("messageerror", receiveMessageError); } catch {}
      try { signal?.removeEventListener?.("abort", receiveAbort); } catch {}
    };
    const rejectWaiting = (error) => {
      if (!waiting) return;
      const reject = waiting.reject;
      clearTimeout(waiting.timer);
      waiting = null;
      reject(error);
    };
    const terminate = (error = null) => {
      if (closed) return;
      closed = true;
      detach();
      try { worker.terminate(); } catch {}
      if (error) rejectWaiting(error);
    };
    const receive = (event) => {
      const message = event?.data;
      if (!message || message.id !== id || !waiting) return;
      if (message.type === waiting.type) {
        const resolve = waiting.resolve;
        clearTimeout(waiting.timer);
        waiting = null;
        resolve(message);
      } else if (message.type === "error") terminate(new Error(message.message || "HASH_WORKER_ERROR"));
    };
    const receiveError = (event) => {
      try { event?.preventDefault?.(); } catch {}
      terminate(Object.assign(new Error(String(event?.message || "HASH_WORKER_ERROR").slice(0, 240)), { code: "HASH_WORKER_ERROR" }));
    };
    const receiveMessageError = () => terminate(Object.assign(new Error("HASH_WORKER_MESSAGE_ERROR"), { code: "HASH_WORKER_MESSAGE_ERROR" }));
    const receiveAbort = () => terminate(abortException());
    worker.addEventListener("message", receive);
    worker.addEventListener("error", receiveError);
    worker.addEventListener("messageerror", receiveMessageError);
    signal?.addEventListener?.("abort", receiveAbort, { once: true });
    const request = (type, payload = {}, transfer = []) => new Promise((resolve, reject) => {
      if (closed || waiting) return reject(new Error(closed ? "Hash worker is closed." : "Hash worker is busy."));
      if (signal?.aborted) { terminate(); return reject(abortException()); }
      const timer = setTimeout(() => terminate(Object.assign(new Error(`HASH_WORKER_TIMEOUT:${payload.type || type}`), { code: "HASH_WORKER_TIMEOUT" })), timeoutMs);
      waiting = { type, resolve, reject, timer };
      try { worker.postMessage({ id, ...payload }, transfer); }
      catch (error) { terminate(error); }
    });
    return freeze({
      async start() { await request("ready", { type: "start" }); },
      async update(chunk) {
        const copy = chunk instanceof Uint8Array ? chunk.slice() : new Uint8Array(chunk || 0);
        await request("chunk", { type: "chunk", chunk: copy.buffer }, [copy.buffer]);
      },
      async finish() { return (await request("result", { type: "finish" })).sha256; },
      cancel() {
        if (closed) return;
        try { worker.postMessage({ id, type: "cancel" }); } catch {}
        terminate(Object.assign(new Error("Hash cancelled."), { name: "AbortError" }));
      },
      close() { terminate(waiting ? new Error("Hash worker closed while busy.") : null); }
    });
  }

  async function digestSmallBlob(blob, options = {}) {
    const environment = options.runtime || runtime;
    if (blob.size > 64 * 1024 * 1024 || !environment.crypto?.subtle) throw new Error("HASH_WORKER_REQUIRED");
    const signal = options.signal || null;
    const abortException = () => {
      const DomExceptionCtor = environment.DOMException || (typeof DOMException === "function" ? DOMException : null);
      return DomExceptionCtor ? new DomExceptionCtor("Hash aborted.", "AbortError") : Object.assign(new Error("Hash aborted."), { name: "AbortError" });
    };
    const abortable = (promise) => {
      if (!signal) return promise;
      if (signal.aborted) return Promise.reject(abortException());
      return new Promise((resolve, reject) => {
        const abort = () => reject(abortException());
        signal.addEventListener("abort", abort, { once: true });
        Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
      });
    };
    const bytes = await abortable(blob.arrayBuffer());
    const hash = await abortable(environment.crypto.subtle.digest("SHA-256", bytes));
    return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join("");
  }

  async function opfsDirectory(create = true, environment = runtime) {
    const storage = environment.navigator?.storage;
    if (typeof storage?.getDirectory !== "function") return null;
    const root = await storage.getDirectory();
    return root.getDirectoryHandle(ROOT_DIRECTORY, { create });
  }

  async function nestedFile(directory, path, create = true) {
    const parts = String(path).split("/");
    const fileName = parts.pop();
    let cursor = directory;
    for (const part of parts) cursor = await cursor.getDirectoryHandle(part, { create });
    return cursor.getFileHandle(fileName, { create });
  }

  async function writeJson(directory, name, value) {
    const handle = await directory.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(value, null, 2));
    await writable.close();
  }

  async function readJson(directory, name) {
    try { return JSON.parse(await (await directory.getFileHandle(name)).getFile().then((file) => file.text())); }
    catch { return null; }
  }

  function cacheKey(packId, path, environment = runtime) {
    const origin = environment.location?.origin || "https://hh-eonwild.invalid";
    return `${origin}/__hwe_cinematic__/${encodeURIComponent(packId)}/${path.split("/").map(encodeURIComponent).join("/")}`;
  }

  function normalizeState(packId, value = {}) {
    const totalBytes = clamp(Number(value.totalBytes || 0), 0, MAX_PACK_BYTES);
    return freeze({
      id: packId,
      status: VALID_STATES.has(value.status) ? value.status : "not-installed",
      build: SAFE_BUILD_PATTERN.test(String(value.build || "")) ? String(value.build) : "",
      totalBytes,
      loadedBytes: clamp(Number(value.loadedBytes || 0), 0, totalBytes),
      storage: value.storage === "opfs" || value.storage === "cache" ? value.storage : "none",
      verifiedAt: Math.max(0, Number(value.verifiedAt || 0)),
      updatedAt: Math.max(0, Number(value.updatedAt || 0)),
      error: value.error ? String(value.error).slice(0, 240) : ""
    });
  }

  function recoverState(packId, value = {}) {
    const state = normalizeState(packId, value);
    return state.status === "installing" ? normalizeState(packId, { ...state, status: "paused", error: "" }) : state;
  }

  function parseContentRange(value) {
    const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(String(value || "").trim());
    if (!match) return null;
    const start = Number(match[1]);
    const end = Number(match[2]);
    const total = Number(match[3]);
    if (![start, end, total].every(Number.isSafeInteger) || start < 0 || end < start || total <= end) return null;
    return freeze({ start, end, total });
  }

  function createManager(options = {}) {
    const environment = options.runtime || runtime;
    const ResponseCtor = environment.Response || Response;
    const BlobCtor = environment.Blob || Blob;
    const UrlCtor = environment.URL || URL;
    const AbortControllerCtor = environment.AbortController || AbortController;
    const listeners = new Set();
    const controllers = new Map();
    const objectUrls = new Map();
    const reusableAssetUrls = new Map();
    const verifiedAssets = new Map();
    const packGenerations = new Map();
    const states = new Map();
    const verifiedLicenseReports = new Set();
    const removing = new Set();
    const trustPolicy = freeze({
      baseUrl: String(options.baseUrl || environment.location?.href || "https://invalid.local/"),
      trustedOrigins: freeze(Array.isArray(options.trustedOrigins) ? options.trustedOrigins.slice(0, 16).map(String) : []),
      approvedAssetRecords: options.approvedAssetRecords instanceof Map
        ? new Map(options.approvedAssetRecords)
        : freeze({ ...(options.approvedAssetRecords && typeof options.approvedAssetRecords === "object" ? options.approvedAssetRecords : {}) })
    });
    let initialized = false;
    let disposed = false;
    const abortError = () => {
      const DomExceptionCtor = environment.DOMException || (typeof DOMException === "function" ? DOMException : null);
      return DomExceptionCtor ? new DomExceptionCtor("Paused", "AbortError") : Object.assign(new Error("Paused"), { name: "AbortError" });
    };
    const emit = (detail) => {
      const safe = freeze({ version: VERSION, at: Date.now(), ...detail });
      for (const listener of listeners) { try { listener(safe); } catch {} }
      return safe;
    };

    const generationOf = (packId) => packGenerations.get(packId) || 0;
    const assetGenerationKey = (packId, path, generation = generationOf(packId)) => `${packId}:${generation}:${path}`;
    const clearPackVerification = (packId, advance = true) => {
      if (advance) packGenerations.set(packId, generationOf(packId) + 1);
      for (const key of [...verifiedAssets.keys()]) if (key.startsWith(`${packId}:`)) verifiedAssets.delete(key);
      for (const [key, url] of [...reusableAssetUrls]) {
        if (!key.startsWith(`${packId}:`)) continue;
        reusableAssetUrls.delete(key);
        const record = objectUrls.get(url);
        if (record) record.reusable = false;
      }
      for (const key of [...verifiedLicenseReports]) if (key.startsWith(`${packId}:`)) verifiedLicenseReports.delete(key);
      return generationOf(packId);
    };
    const licenseGenerationKey = (manifest) => `${manifest.id}:${generationOf(manifest.id)}:${manifest.build}:${manifest.licenseReportSha256}`;
    const createVerifiedObjectUrl = (packId, path, blob) => {
      const key = assetGenerationKey(packId, path);
      const reusableUrl = reusableAssetUrls.get(key);
      const reusable = reusableUrl ? objectUrls.get(reusableUrl) : null;
      if (reusable) {
        reusable.references += 1;
        return reusableUrl;
      }
      const url = UrlCtor.createObjectURL(blob);
      objectUrls.set(url, { packId, key, references: 1, reusable: true });
      reusableAssetUrls.set(key, url);
      return url;
    };
    const setFailedStateLocal = (packId, error, value = {}) => {
      clearPackVerification(packId);
      const state = normalizeState(packId, { ...(states.get(packId) || {}), ...value, status: "failed", error: String(error?.message || error).slice(0, 240), updatedAt: Date.now() });
      states.set(packId, state);
      emit({ type: "state", packId, state });
      emit({ type: "error", packId, state, error: state.error });
      return state;
    };
    async function saveFailedState(packId, error, located = null) {
      clearPackVerification(packId);
      const previous = states.get(packId) || {};
      const next = { ...previous, status: "failed", storage: located?.storage || previous.storage, error: error?.message || error };
      try { return await saveState(packId, next, located?.directory || null); }
      catch { return setFailedStateLocal(packId, error, next); }
    }

    async function packDirectory(packId, create = false) {
      const root = await opfsDirectory(create, environment).catch(() => null);
      if (!root) return null;
      try { return await root.getDirectoryHandle(packId, { create }); } catch { return null; }
    }

    async function deleteCachedPack(packId) {
      if (!environment.caches) return;
      const cache = await environment.caches.open(CACHE_NAME);
      const marker = `/__hwe_cinematic__/${encodeURIComponent(packId)}/`;
      for (const request of await cache.keys()) {
        try { if (new UrlCtor(request.url).pathname.includes(marker)) await cache.delete(request); } catch {}
      }
      const remaining = (await cache.keys()).some((request) => {
        try { return new UrlCtor(request.url).pathname.includes(marker); } catch { return false; }
      });
      if (remaining) throw new Error("CACHE_PACK_DELETE_FAILED");
    }

    async function cacheResponse(packId, path) {
      if (!environment.caches) return null;
      return (await environment.caches.open(CACHE_NAME)).match(cacheKey(packId, path, environment));
    }

    async function initialize() {
      if (disposed) throw new Error("PACK_MANAGER_DISPOSED");
      if (initialized) return list();
      initialized = true;
      const root = await opfsDirectory(false, environment).catch(() => null);
      if (root && root.values) {
        for await (const entry of root.values()) {
          if (entry.kind !== "directory" || !PACK_IDS.has(entry.name)) continue;
          const metadata = await readJson(entry, "pack-state.json");
          if (metadata) states.set(entry.name, recoverState(entry.name, metadata));
        }
      }
      if (environment.caches) {
        const cache = await environment.caches.open(CACHE_NAME);
        for (const pack of PACK_CATALOG) {
          if (states.has(pack.id)) continue;
          const response = await cache.match(cacheKey(pack.id, "pack-state.json", environment));
          if (response?.ok) { try { states.set(pack.id, recoverState(pack.id, await response.json())); } catch {} }
        }
      }
      return list();
    }

    function list() {
      return freeze(PACK_CATALOG.map((pack) => freeze({ ...pack, status: states.get(pack.id)?.status || "not-installed", ...(states.get(pack.id) || {}) })));
    }

    async function saveState(packId, value, directory = null) {
      if (disposed) throw new Error("PACK_MANAGER_DISPOSED");
      const state = normalizeState(packId, { ...value, updatedAt: Date.now() });
      states.set(packId, state);
      const stateDirectory = directory || (state.storage !== "cache" ? await packDirectory(packId, true) : null);
      if (stateDirectory) await writeJson(stateDirectory, "pack-state.json", state);
      else if (environment.caches) {
        const cache = await environment.caches.open(CACHE_NAME);
        await cache.put(cacheKey(packId, "pack-state.json", environment), new ResponseCtor(JSON.stringify(state), { headers: { "content-type": "application/json" } }));
      }
      emit({ type: "state", packId, state });
      return state;
    }

    async function hashFile(file, onBytes, signal = null) {
      const hashOptions = { ...options, runtime: environment, signal };
      const session = createHashSession(hashOptions);
      if (!session) {
        if (signal?.aborted) throw abortError();
        const result = await digestSmallBlob(file, hashOptions);
        if (signal?.aborted) throw abortError();
        onBytes?.(file.size);
        return result;
      }
      try {
        await session.start();
        const reader = file.stream().getReader();
        while (true) {
          if (signal?.aborted) throw abortError();
          const { done, value } = await reader.read();
          if (done) break;
          await session.update(value);
          onBytes?.(value.byteLength);
        }
        const result = await session.finish();
        session.close();
        return result;
      } catch (error) { session.cancel(); throw error; }
    }

    async function verifyLicenseReportBlob(manifest, blob, signal = null, onProgress = null) {
      if (!blob || !Number.isSafeInteger(blob.size) || blob.size <= 0 || blob.size > MAX_LICENSE_REPORT_BYTES) throw new Error("LICENSE_REPORT_SIZE_INVALID");
      let checked = 0;
      const checksum = await hashFile(blob, (bytes) => {
        checked += bytes;
        onProgress?.(freeze({ packId: manifest.id, phase: "license-report", assetPath: LICENSE_REPORT_PATH, assetLoadedBytes: checked, assetTotalBytes: blob.size, loadedBytes: 0, totalBytes: manifest.totalBytes, label: "Đang xác minh báo cáo giấy phép" }));
      }, signal);
      if (checksum !== manifest.licenseReportSha256) throw new Error("LICENSE_REPORT_CHECKSUM_MISMATCH");
      return blob;
    }

    async function loadLicenseReport(manifest, signal, onProgress, suppliedFile = null) {
      if (suppliedFile) return verifyLicenseReportBlob(manifest, suppliedFile, signal, onProgress);
      const response = await environment.fetch(manifest.licenseReportUrl, { signal, cache: "no-store", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" });
      if (!response?.ok || response.status !== 200 || response.redirected) throw new Error("LICENSE_REPORT_FETCH_FAILED");
      const declaredLength = Number(response.headers?.get?.("content-length") || 0);
      if (declaredLength && (!Number.isSafeInteger(declaredLength) || declaredLength <= 0 || declaredLength > MAX_LICENSE_REPORT_BYTES)) throw new Error("LICENSE_REPORT_SIZE_INVALID");
      const contentType = String(response.headers?.get?.("content-type") || "application/octet-stream").split(";", 1)[0].trim().toLowerCase();
      if (!/^(?:application\/(?:json|pdf|octet-stream)|text\/(?:plain|html|markdown))$/.test(contentType)) throw new Error("LICENSE_REPORT_TYPE_INVALID");
      if (!response.body) throw new Error("LICENSE_REPORT_EMPTY");
      const chunks = [];
      let received = 0;
      const reader = response.body.getReader();
      while (true) {
        if (signal?.aborted) throw abortError();
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > MAX_LICENSE_REPORT_BYTES) throw new Error("LICENSE_REPORT_SIZE_INVALID");
        chunks.push(value);
      }
      if (declaredLength && received !== declaredLength) throw new Error("LICENSE_REPORT_SIZE_MISMATCH");
      return verifyLicenseReportBlob(manifest, new BlobCtor(chunks, { type: contentType }), signal, onProgress);
    }

    async function storeLicenseReportOpfs(directory, blob) {
      const handle = await directory.getFileHandle(LICENSE_REPORT_PATH, { create: true });
      const writable = await handle.createWritable();
      try { await writable.write(new Uint8Array(await blob.arrayBuffer())); await writable.close(); }
      catch (error) { try { await writable.abort(error); } catch {} throw error; }
    }

    async function storedLicenseReport(located, packId) {
      if (located?.directory) {
        try { return await (await located.directory.getFileHandle(LICENSE_REPORT_PATH)).getFile(); }
        catch { return null; }
      }
      if (located?.cache) {
        const response = await located.cache.match(cacheKey(packId, LICENSE_REPORT_PATH, environment));
        if (response?.ok) return response.blob();
      }
      return null;
    }

    async function verifyStoredLicenseReport(located, manifest, signal = null, onProgress = null, force = false) {
      const key = licenseGenerationKey(manifest);
      if (!force && verifiedLicenseReports.has(key)) return true;
      await verifyLicenseReportBlob(manifest, await storedLicenseReport(located, manifest.id), signal, onProgress);
      if (disposed) throw new Error("PACK_MANAGER_DISPOSED");
      verifiedLicenseReports.add(key);
      return true;
    }

    function assertDownloadResponse(response, asset, requestedOffset) {
      if (!response || !response.ok) throw new Error(`HTTP_${response?.status || 0}:${asset.path}`);
      if (response.redirected) throw new Error(`REDIRECT_REJECTED:${asset.path}`);
      if (requestedOffset > 0 && response.status === 200) return 0;
      if (requestedOffset > 0 && response.status !== 206) throw new Error(`RANGE_UNSUPPORTED:${asset.path}`);
      if (response.status === 206) {
        const range = parseContentRange(response.headers?.get?.("content-range"));
        if (!range || range.start !== requestedOffset || range.end !== asset.byteSize - 1 || range.total !== asset.byteSize) throw new Error(`CONTENT_RANGE_MISMATCH:${asset.path}`);
      } else if (requestedOffset === 0 && response.status !== 200) throw new Error(`HTTP_${response.status}:${asset.path}`);
      return requestedOffset;
    }

    async function prepareOpfs(manifest) {
      const root = await opfsDirectory(true, environment);
      let directory = await root.getDirectoryHandle(manifest.id, { create: true });
      const previousManifest = await readJson(directory, "pack-pending.json") || await readJson(directory, "pack-manifest.json");
      if (previousManifest && JSON.stringify(previousManifest) !== JSON.stringify(manifest)) {
        await root.removeEntry(manifest.id, { recursive: true });
        directory = await root.getDirectoryHandle(manifest.id, { create: true });
      }
      await writeJson(directory, "pack-pending.json", manifest);
      return directory;
    }

    async function installOpfs(manifest, signal, onProgress, fileMap = null, licenseReport = null, checkedAssets = null) {
      const directory = await prepareOpfs(manifest);
      await storeLicenseReportOpfs(directory, licenseReport);
      let packLoaded = 0;
      await saveState(manifest.id, { status: "installing", build: manifest.build, totalBytes: manifest.totalBytes, loadedBytes: 0, storage: "opfs" }, directory);
      for (const asset of manifest.assets) {
        if (signal.aborted) throw abortError();
        const fileHandle = await nestedFile(directory, asset.path, true);
        const existing = await fileHandle.getFile();
        let offset = existing.size > asset.byteSize ? 0 : existing.size;
        let response = null;
        const sourceFile = fileMap?.get(asset.path) || null;
        if (sourceFile && sourceFile.size !== asset.byteSize) throw new Error(`LOCAL_SIZE_MISMATCH:${asset.path}`);
        if (!sourceFile && existing.size === asset.byteSize) {
          onProgress?.(freeze({ packId: manifest.id, assetPath: asset.path, assetLoadedBytes: existing.size, assetTotalBytes: asset.byteSize, loadedBytes: packLoaded + existing.size, totalBytes: manifest.totalBytes, label: `Đang xác minh ${asset.path}` }));
          if (await hashFile(existing, null, signal) === asset.sha256) {
            checkedAssets?.set(asset.path, { blob: existing, sha256: asset.sha256, byteSize: asset.byteSize });
            packLoaded += existing.size;
            continue;
          }
          offset = 0;
        }
        if (!sourceFile) {
          response = await environment.fetch(asset.url, { signal, headers: offset ? { Range: `bytes=${offset}-` } : {}, cache: "no-store", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" });
          offset = assertDownloadResponse(response, asset, offset);
        } else offset = 0;
        const writable = await fileHandle.createWritable({ keepExistingData: Boolean(offset) });
        if (!offset) await writable.truncate(0); else await writable.seek(offset);
        let assetLoaded = offset;
        packLoaded += offset;
        try {
          const stream = sourceFile ? sourceFile.stream() : response.body;
          if (!stream) throw new Error(`EMPTY_STREAM:${asset.path}`);
          const reader = stream.getReader();
          while (true) {
            if (signal.aborted) throw abortError();
            const { done, value } = await reader.read();
            if (done) break;
            assetLoaded += value.byteLength;
            packLoaded += value.byteLength;
            if (assetLoaded > asset.byteSize) throw new Error(`SIZE_OVERFLOW:${asset.path}`);
            await writable.write(value);
            onProgress?.(freeze({ packId: manifest.id, assetPath: asset.path, assetLoadedBytes: assetLoaded, assetTotalBytes: asset.byteSize, loadedBytes: packLoaded, totalBytes: manifest.totalBytes, label: `Đang tải ${asset.path}` }));
          }
          await writable.close();
        } catch (error) {
          try {
            if (assetLoaded <= asset.byteSize && !String(error?.message || error).startsWith("SIZE_OVERFLOW")) await writable.close();
            else await writable.abort(error);
          } catch {}
          throw error;
        }
        const file = await fileHandle.getFile();
        if (file.size !== asset.byteSize) throw new Error(`SIZE_MISMATCH:${asset.path}`);
        onProgress?.(freeze({ packId: manifest.id, assetPath: asset.path, assetLoadedBytes: file.size, assetTotalBytes: asset.byteSize, loadedBytes: packLoaded, totalBytes: manifest.totalBytes, label: `Đang xác minh ${asset.path}` }));
        const checksum = await hashFile(file, null, signal);
        if (checksum !== asset.sha256) throw new Error(`CHECKSUM_MISMATCH:${asset.path}`);
        checkedAssets?.set(asset.path, { blob: file, sha256: asset.sha256, byteSize: asset.byteSize });
      }
      await writeJson(directory, "pack-manifest.json", manifest);
      try { await directory.removeEntry("pack-pending.json"); } catch {}
      return saveState(manifest.id, { status: "ready", build: manifest.build, totalBytes: manifest.totalBytes, loadedBytes: manifest.totalBytes, storage: "opfs", verifiedAt: Date.now() }, directory);
    }

    async function responseBlob(response, manifest, asset, completedBytes, signal, onProgress) {
      const stream = response.body;
      if (!stream) throw new Error(`EMPTY_STREAM:${asset.path}`);
      const chunks = [];
      let assetLoaded = 0;
      const reader = stream.getReader();
      while (true) {
        if (signal.aborted) throw abortError();
        const { done, value } = await reader.read();
        if (done) break;
        assetLoaded += value.byteLength;
        if (assetLoaded > asset.byteSize) throw new Error(`SIZE_OVERFLOW:${asset.path}`);
        chunks.push(value);
        onProgress?.(freeze({ packId: manifest.id, phase: "download", assetPath: asset.path, assetLoadedBytes: assetLoaded, assetTotalBytes: asset.byteSize, loadedBytes: completedBytes + assetLoaded, totalBytes: manifest.totalBytes, label: `Đang tải ${asset.path}` }));
      }
      if (assetLoaded !== asset.byteSize) throw new Error(`SIZE_MISMATCH:${asset.path}`);
      return new BlobCtor(chunks, { type: asset.contentType });
    }

    async function prepareCache(manifest) {
      const cache = await environment.caches.open(CACHE_NAME);
      const pendingKey = cacheKey(manifest.id, "pack-pending.json", environment);
      const previousResponse = await cache.match(pendingKey) || await cache.match(cacheKey(manifest.id, "pack-manifest.json", environment));
      let previousManifest = null;
      try { if (previousResponse?.ok) previousManifest = await previousResponse.json(); } catch {}
      if (previousManifest && JSON.stringify(previousManifest) !== JSON.stringify(manifest)) await deleteCachedPack(manifest.id);
      const prepared = await environment.caches.open(CACHE_NAME);
      await prepared.put(pendingKey, new ResponseCtor(JSON.stringify(manifest), { headers: { "content-type": "application/json" } }));
      return prepared;
    }

    async function installCache(manifest, signal, onProgress, fileMap = null, licenseReport = null, checkedAssets = null) {
      if (manifest.totalBytes > CACHE_FALLBACK_MAX_BYTES) throw new Error("OPFS_REQUIRED_FOR_LARGE_PACK");
      if (!environment.caches) throw new Error("CINEMATIC_STORAGE_UNAVAILABLE");
      const cache = await prepareCache(manifest);
      await cache.put(cacheKey(manifest.id, LICENSE_REPORT_PATH, environment), new ResponseCtor(licenseReport, { headers: { "content-type": licenseReport.type || "application/octet-stream", "x-hwe-sha256": manifest.licenseReportSha256, "x-content-type-options": "nosniff" } }));
      let completedBytes = 0;
      await saveState(manifest.id, { status: "installing", build: manifest.build, totalBytes: manifest.totalBytes, loadedBytes: 0, storage: "cache" });
      for (const asset of manifest.assets) {
        if (signal.aborted) throw abortError();
        const assetKey = cacheKey(manifest.id, asset.path, environment);
        const installed = await cache.match(assetKey);
        if (installed?.ok) {
          const installedBlob = await installed.blob();
          if (installedBlob.size === asset.byteSize && await hashFile(installedBlob, null, signal) === asset.sha256) {
            checkedAssets?.set(asset.path, { blob: installedBlob, sha256: asset.sha256, byteSize: asset.byteSize });
            completedBytes += asset.byteSize;
            onProgress?.(freeze({ packId: manifest.id, phase: "resume", assetPath: asset.path, assetLoadedBytes: asset.byteSize, assetTotalBytes: asset.byteSize, loadedBytes: completedBytes, totalBytes: manifest.totalBytes, label: `Đã khôi phục ${asset.path}` }));
            continue;
          }
          await cache.delete(assetKey);
        }
        const response = fileMap?.has(asset.path)
          ? new ResponseCtor(fileMap.get(asset.path), { headers: { "content-type": asset.contentType } })
          : await environment.fetch(asset.url, { signal, cache: "no-store", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" });
        assertDownloadResponse(response, asset, 0);
        const blob = await responseBlob(response, manifest, asset, completedBytes, signal, onProgress);
        let assetChecked = 0;
        const checksum = await hashFile(blob, (bytes) => {
          assetChecked += bytes;
          onProgress?.(freeze({ packId: manifest.id, phase: "verify", assetPath: asset.path, assetLoadedBytes: assetChecked, assetTotalBytes: asset.byteSize, loadedBytes: completedBytes + assetChecked, totalBytes: manifest.totalBytes, label: `Đang xác minh ${asset.path}` }));
        }, signal);
        if (checksum !== asset.sha256) throw new Error(`CHECKSUM_MISMATCH:${asset.path}`);
        checkedAssets?.set(asset.path, { blob, sha256: asset.sha256, byteSize: asset.byteSize });
        await cache.put(assetKey, new ResponseCtor(blob, { headers: { "content-type": asset.contentType, "x-hwe-sha256": checksum, "x-content-type-options": "nosniff" } }));
        completedBytes += asset.byteSize;
      }
      await cache.put(cacheKey(manifest.id, "pack-manifest.json", environment), new ResponseCtor(JSON.stringify(manifest), { headers: { "content-type": "application/json" } }));
      await cache.delete(cacheKey(manifest.id, "pack-pending.json", environment));
      return saveState(manifest.id, { status: "ready", build: manifest.build, totalBytes: manifest.totalBytes, loadedBytes: manifest.totalBytes, storage: "cache", verifiedAt: Date.now() });
    }

    async function install(rawManifest, installOptions = {}) {
      if (disposed) throw new Error("PACK_MANAGER_DISPOSED");
      await initialize();
      const validation = validateManifest(rawManifest, { ...trustPolicy, runtime: environment });
      if (!validation.valid) {
        const error = Object.assign(new Error(validation.errors.join(" ")), { code: "INVALID_MANIFEST", errors: validation.errors });
        const rawId = String(rawManifest?.id || "");
        if (PACK_IDS.has(rawId)) setFailedStateLocal(rawId, error);
        throw error;
      }
      const manifest = validation.manifest;
      if (controllers.has(manifest.id) || removing.has(manifest.id)) throw new Error("PACK_OPERATION_ACTIVE");
      const controller = new AbortControllerCtor();
      let finishOperation;
      const done = new Promise((resolve) => { finishOperation = resolve; });
      controllers.set(manifest.id, { kind: "install", controller, done });
      let lastProgress = { loadedBytes: 0 };
      let storage = "none";
      const forwardProgress = (progress) => { lastProgress = progress; installOptions.onProgress?.(progress); emit({ type: "progress", ...progress }); };
      try {
        const fileMap = installOptions.files instanceof Map ? installOptions.files : null;
        const licenseReport = await loadLicenseReport(manifest, controller.signal, forwardProgress, installOptions.licenseReportFile || null);
        const useOpfs = Boolean(await opfsDirectory(true, environment).catch(() => null));
        storage = useOpfs ? "opfs" : "cache";
        const checkedAssets = new Map();
        const state = await (useOpfs ? installOpfs(manifest, controller.signal, forwardProgress, fileMap, licenseReport, checkedAssets) : installCache(manifest, controller.signal, forwardProgress, fileMap, licenseReport, checkedAssets));
        clearPackVerification(manifest.id);
        for (const [path, record] of checkedAssets) verifiedAssets.set(assetGenerationKey(manifest.id, path), record);
        verifiedLicenseReports.add(licenseGenerationKey(manifest));
        emit({ type: "installed", packId: manifest.id, state });
        return state;
      } catch (error) {
        const paused = error?.name === "AbortError";
        const previous = states.get(manifest.id) || {};
        const nextState = { ...previous, status: paused ? "paused" : "failed", build: manifest.build, totalBytes: manifest.totalBytes, loadedBytes: lastProgress.loadedBytes || previous.loadedBytes || 0, storage: previous.storage || storage, error: paused ? "" : error?.message || error };
        if (disposed) throw error;
        if (!paused) clearPackVerification(manifest.id);
        let state;
        try { state = await saveState(manifest.id, nextState); }
        catch { state = normalizeState(manifest.id, { ...nextState, updatedAt: Date.now() }); states.set(manifest.id, state); emit({ type: "state", packId: manifest.id, state }); }
        emit({ type: paused ? "paused" : "error", packId: manifest.id, state, error: String(error?.message || error).slice(0, 240) });
        if (!paused) throw error;
        return state;
      } finally {
        controllers.delete(manifest.id);
        finishOperation();
      }
    }

    function pause(packId) {
      const operation = controllers.get(String(packId));
      if (!operation || operation.kind !== "install") return false;
      operation.controller.abort();
      return true;
    }

    async function locatePack(packId) {
      const directory = await packDirectory(packId, false);
      if (directory) {
        const manifest = await readJson(directory, "pack-manifest.json");
        if (manifest) return { manifest, directory, cache: null, storage: "opfs" };
      }
      const response = await cacheResponse(packId, "pack-manifest.json");
      if (response?.ok) {
        try { return { manifest: await response.json(), directory: null, cache: await environment.caches.open(CACHE_NAME), storage: "cache" }; } catch {}
      }
      return null;
    }

    async function verify(packId, verifyOptions = {}) {
      await initialize();
      const id = String(packId || "");
      if (!PACK_IDS.has(id)) throw new Error("PACK_ID_INVALID");
      if (controllers.has(id) || removing.has(id)) throw new Error("PACK_OPERATION_ACTIVE");
      const controller = new AbortControllerCtor();
      let finishOperation;
      const done = new Promise((resolve) => { finishOperation = resolve; });
      controllers.set(id, { kind: "verify", controller, done });
      let located = null;
      try {
        located = await locatePack(id);
        if (!located) throw new Error("PACK_MANIFEST_MISSING");
        const validation = validateManifest(located.manifest, { ...trustPolicy, runtime: environment });
        if (!validation.valid) throw new Error("PACK_MANIFEST_INVALID");
        await verifyStoredLicenseReport(located, validation.manifest, controller.signal, verifyOptions.onProgress, true);
        let checked = 0;
        const checkedAssets = new Map();
        for (const asset of validation.manifest.assets) {
          if (controller.signal.aborted || disposed) throw abortError();
          let file = null;
          if (located.directory) file = await (await nestedFile(located.directory, asset.path, false)).getFile();
          else {
            const response = await located.cache.match(cacheKey(id, asset.path, environment));
            if (response?.ok) file = await response.blob();
          }
          if (!file || file.size !== asset.byteSize || await hashFile(file, null, controller.signal) !== asset.sha256) throw new Error(`PACK_INTEGRITY_FAILED:${asset.path}`);
          checkedAssets.set(asset.path, { blob: file, sha256: asset.sha256, byteSize: asset.byteSize });
          checked += file.size;
          verifyOptions.onProgress?.(freeze({ packId: id, phase: "verify", assetPath: asset.path, loadedBytes: checked, totalBytes: validation.manifest.totalBytes, label: `Đã xác minh ${asset.path}` }));
        }
        if (controller.signal.aborted || disposed) throw abortError();
        const state = await saveState(id, { ...(states.get(id) || {}), status: "ready", storage: located.storage, verifiedAt: Date.now(), loadedBytes: validation.manifest.totalBytes }, located.directory);
        clearPackVerification(id);
        for (const [path, record] of checkedAssets) verifiedAssets.set(assetGenerationKey(id, path), record);
        verifiedLicenseReports.add(licenseGenerationKey(validation.manifest));
        emit({ type: "verified", packId: id, state });
        return state;
      } catch (error) {
        if (error?.name === "AbortError" || disposed || removing.has(id)) throw error;
        const state = await saveFailedState(id, error, located);
        emit({ type: "error", packId: id, state, error: String(error?.message || error).slice(0, 240) });
        throw error;
      } finally {
        controllers.delete(id);
        finishOperation();
      }
    }

    async function remove(packId) {
      const id = String(packId || "");
      if (!PACK_IDS.has(id) || disposed) return false;
      if (removing.has(id)) throw new Error("PACK_OPERATION_ACTIVE");
      removing.add(id);
      try {
        const operation = controllers.get(id);
        if (operation) { operation.controller?.abort?.(); await operation.done; }
        let root = null;
        try { root = await opfsDirectory(false, environment); }
        catch (error) { if (error?.name !== "NotFoundError") throw error; }
        if (root) {
          try { await root.removeEntry(id, { recursive: true }); }
          catch (error) { if (error?.name !== "NotFoundError") throw error; }
        }
        await deleteCachedPack(id);
        for (const [url, record] of [...objectUrls]) {
          if (record.packId !== id) continue;
          try { UrlCtor.revokeObjectURL(url); } catch {}
          objectUrls.delete(url);
          if (reusableAssetUrls.get(record.key) === url) reusableAssetUrls.delete(record.key);
        }
        clearPackVerification(id);
        states.delete(id);
        emit({ type: "removed", packId: id });
        return true;
      } finally { removing.delete(id); }
    }

    async function removeAll() {
      for (const pack of PACK_CATALOG) await remove(pack.id);
      return true;
    }

    async function verifyAll(verifyOptions = {}) {
      await initialize();
      const results = [];
      for (const pack of list()) {
        if (pack.status !== "ready") continue;
        try { results.push(freeze({ id: pack.id, ok: true, state: await verify(pack.id, verifyOptions) })); }
        catch (error) { results.push(freeze({ id: pack.id, ok: false, error: String(error?.message || error) })); }
      }
      return freeze(results);
    }

    async function waitForAssetTurn(packId) {
      while (true) {
        const operation = controllers.get(packId);
        if (!operation) return !disposed && !removing.has(packId);
        if (operation.kind !== "asset-url") return false;
        await operation.done;
        if (disposed || removing.has(packId)) return false;
      }
    }

    async function assetUrl(packId, path) {
      const id = String(packId || "");
      const assetPath = String(path || "").replaceAll("\\", "/");
      if (disposed || !PACK_IDS.has(id) || !safePath(assetPath)) return null;
      await initialize();
      if (states.get(id)?.status !== "ready" || !await waitForAssetTurn(id) || states.get(id)?.status !== "ready") return null;
      const controller = new AbortControllerCtor();
      let finishOperation;
      const done = new Promise((resolve) => { finishOperation = resolve; });
      const operation = { kind: "asset-url", controller, done };
      controllers.set(id, operation);
      let bytesTrusted = false;
      let located = null;
      try {
        const generationKey = assetGenerationKey(id, assetPath);
        const cached = verifiedAssets.get(generationKey);
        if (cached) {
          bytesTrusted = true;
          if (controller.signal.aborted || disposed || removing.has(id)) return null;
          return createVerifiedObjectUrl(id, assetPath, cached.blob);
        }
        located = await locatePack(id);
        if (!located) throw new Error("PACK_MANIFEST_MISSING");
        const validation = validateManifest(located.manifest, { ...trustPolicy, runtime: environment });
        if (!validation.valid) throw new Error("PACK_MANIFEST_INVALID");
        const descriptor = validation.manifest.assets.find((asset) => asset.path === assetPath);
        if (!descriptor) return null;
        await verifyStoredLicenseReport(located, validation.manifest, controller.signal);
        let blob = null;
        if (located.directory) blob = await (await nestedFile(located.directory, assetPath, false)).getFile();
        else {
          const response = await located.cache.match(cacheKey(id, assetPath, environment));
          if (response?.ok) blob = await response.blob();
        }
        // A persisted `ready` marker is not enough: browser storage can be
        // evicted or corrupted between sessions. Re-check the exact file on
        // first use so an altered asset never reaches Babylon or creates a
        // black frame. Hashing stays in the bounded worker for large files.
        if (!blob || blob.size !== descriptor.byteSize || await hashFile(blob, null, controller.signal) !== descriptor.sha256) throw new Error(`PACK_INTEGRITY_FAILED:${assetPath}`);
        if (controller.signal.aborted || disposed || removing.has(id)) return null;
        verifiedAssets.set(generationKey, { blob, sha256: descriptor.sha256, byteSize: descriptor.byteSize });
        bytesTrusted = true;
        return createVerifiedObjectUrl(id, assetPath, blob);
      } catch (error) {
        if (!bytesTrusted && error?.name !== "AbortError" && !disposed && !removing.has(id)) {
          const state = await saveFailedState(id, error, located);
          emit({ type: "error", packId: id, state, error: String(error?.message || error).slice(0, 240) });
        }
        return null;
      } finally {
        if (controllers.get(id) === operation) controllers.delete(id);
        finishOperation();
      }
    }

    async function getManifest(packId) {
      await initialize();
      const id = String(packId || "");
      if (!PACK_IDS.has(id) || states.get(id)?.status !== "ready" || !await waitForAssetTurn(id) || states.get(id)?.status !== "ready") return null;
      let located = null;
      try {
        located = await locatePack(id);
        if (!located) throw new Error("PACK_MANIFEST_MISSING");
        const validation = validateManifest(located.manifest, { ...trustPolicy, runtime: environment });
        if (!validation.valid) throw new Error("PACK_MANIFEST_INVALID");
        await verifyStoredLicenseReport(located, validation.manifest);
        return validation.manifest;
      } catch (error) {
        if (!disposed && !removing.has(id)) {
          const state = await saveFailedState(id, error, located);
          emit({ type: "error", packId: id, state, error: String(error?.message || error).slice(0, 240) });
        }
        return null;
      }
    }

    function releaseAssetUrl(url) {
      const record = objectUrls.get(url);
      if (!record) return false;
      record.references = Math.max(0, record.references - 1);
      if (record.references > 0) return true;
      try { UrlCtor.revokeObjectURL(url); } catch {}
      objectUrls.delete(url);
      if (reusableAssetUrls.get(record.key) === url) reusableAssetUrls.delete(record.key);
      return true;
    }

    async function storageEstimate() {
      let estimate = null;
      let persisted = false;
      let opfs = false;
      try { estimate = await environment.navigator?.storage?.estimate?.(); } catch {}
      try { persisted = Boolean(await environment.navigator?.storage?.persisted?.()); } catch {}
      if (typeof environment.navigator?.storage?.getDirectory === "function") {
        try { opfs = Boolean(await environment.navigator.storage.getDirectory()); } catch {}
      }
      return freeze({ usage: Number(estimate?.usage || 0), quota: Number(estimate?.quota || 0), persisted, opfs, cacheFallbackLimit: CACHE_FALLBACK_MAX_BYTES });
    }

    async function requestPersistence() {
      try { return Boolean(await environment.navigator?.storage?.persist?.()); } catch { return false; }
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      for (const operation of controllers.values()) operation.controller?.abort?.();
      for (const url of objectUrls.keys()) try { UrlCtor.revokeObjectURL(url); } catch {}
      objectUrls.clear();
      reusableAssetUrls.clear();
      verifiedAssets.clear();
      packGenerations.clear();
      verifiedLicenseReports.clear();
      listeners.clear();
    }

    return freeze({
      initialize,
      list,
      install,
      installFromFiles: (manifest, files, installOptions = {}) => install(manifest, { ...installOptions, files }),
      pause,
      verify,
      verifyAll,
      remove,
      removeAll,
      assetUrl,
      getManifest,
      releaseAssetUrl,
      storageEstimate,
      requestPersistence,
      subscribe(listener) { if (typeof listener !== "function") return () => {}; listeners.add(listener); return () => listeners.delete(listener); },
      dispose
    });
  }

  return freeze({
    VERSION,
    MANIFEST_FORMAT,
    MANIFEST_VERSION,
    CACHE_NAME,
    ROOT_DIRECTORY,
    WORKER_URL,
    MAX_PACK_BYTES,
    MAX_ASSET_BYTES,
    MAX_ASSETS,
    CACHE_FALLBACK_MAX_BYTES,
    MAX_LICENSE_REPORT_BYTES,
    DEFAULT_HASH_TIMEOUT_MS,
    LICENSE_REPORT_PATH,
    PACK_CATALOG,
    formatBytes,
    safePath,
    trustedAssetUrl,
    safeEvidenceUrl,
    validateManifest,
    parseContentRange,
    createHashSession,
    createManager
  });
});
