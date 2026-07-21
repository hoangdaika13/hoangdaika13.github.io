/* HH Developer Toolbox: Smart Input and Developer Recipe. */
(function initHHDevSmartRecipe(globalScope) {
  "use strict";

  const VERSION = 1;
  const STORAGE_KEY = "hh.dev.smart-recipe.v1";
  const MAX_INPUT_LENGTH = 500000;
  const MAX_STORED_TEXT = 24000;
  const MAX_IMPORT_SIZE = 250000;
  const MAX_SHARE_LENGTH = 7600;
  const HISTORY_LIMIT = 60;
  const PIN_LIMIT = 20;
  const RECIPE_LIMIT = 30;
  const TOOLS = Object.freeze([
    { id: "smart-input", name: "Smart Input", icon: "sparkles", description: "Nhận diện dữ liệu và mở đúng công cụ." },
    { id: "developer-recipe", name: "Developer Recipe", icon: "workflow", description: "Ghép các thao tác thành pipeline có thể chạy lại." }
  ]);
  const OPERATION_DEFINITIONS = Object.freeze([
    { id: "base64-encode", name: "Base64 Encode", group: "Mã hóa", icon: "binary" },
    { id: "base64-decode", name: "Base64 Decode", group: "Mã hóa", icon: "binary" },
    { id: "gzip-compress", name: "GZip Compress", group: "Nén", icon: "archive" },
    { id: "gzip-decompress", name: "GZip Decompress", group: "Nén", icon: "archive-restore" },
    { id: "json-format", name: "JSON Format", group: "JSON", icon: "braces" },
    { id: "json-minify", name: "JSON Minify", group: "JSON", icon: "braces" },
    { id: "jsonpath", name: "JSONPath", group: "JSON", icon: "route" },
    { id: "url-encode", name: "URL Encode", group: "URL", icon: "link" },
    { id: "url-decode", name: "URL Decode", group: "URL", icon: "unlink" },
    { id: "sha256", name: "SHA-256", group: "Băm", icon: "hash" }
  ]);

  const mounted = new Map();
  const memoryStorage = new Map();
  let idCounter = 0;

  function uid(prefix = "item") {
    const random = globalScope.crypto?.randomUUID?.();
    idCounter += 1;
    return random || `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
  }

  function clampText(value, max = MAX_INPUT_LENGTH) {
    return String(value ?? "").slice(0, Math.max(0, max));
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function safeJsonParse(value, fallback = null) {
    try { return JSON.parse(value); } catch (_) { return fallback; }
  }

  function getStorage(scope = globalScope) {
    try {
      const storage = scope.localStorage;
      if (storage && typeof storage.getItem === "function") {
        const probe = `${STORAGE_KEY}.probe`;
        storage.setItem(probe, "1");
        storage.removeItem(probe);
        return storage;
      }
    } catch (_) { /* A memory fallback keeps the tool usable in private contexts. */ }
    return {
      getItem: (key) => memoryStorage.has(key) ? memoryStorage.get(key) : null,
      setItem: (key, value) => memoryStorage.set(key, String(value)),
      removeItem: (key) => memoryStorage.delete(key)
    };
  }

  function defaultStore() {
    return { version: VERSION, history: [], pins: [], recipes: [], activeRecipeId: "", updatedAt: 0 };
  }

  function normalizeStoredRow(row, pinned = false) {
    return {
      id: clampText(row?.id || uid(pinned ? "pin" : "history"), 100),
      input: clampText(row?.input, MAX_STORED_TEXT),
      preview: clampText(row?.preview ?? row?.input, 240),
      types: Array.isArray(row?.types) ? row.types.map((item) => clampText(item, 40)).slice(0, 12) : [],
      pinned: Boolean(pinned || row?.pinned),
      createdAt: Number(row?.createdAt) || Date.now()
    };
  }

  function normalizeStore(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      version: VERSION,
      history: Array.isArray(source.history) ? source.history.slice(0, HISTORY_LIMIT).map((row) => normalizeStoredRow(row)) : [],
      pins: Array.isArray(source.pins) ? source.pins.slice(0, PIN_LIMIT).map((row) => normalizeStoredRow(row, true)) : [],
      recipes: Array.isArray(source.recipes) ? source.recipes.slice(0, RECIPE_LIMIT).map(normalizeRecipe) : [],
      activeRecipeId: clampText(source.activeRecipeId, 100),
      updatedAt: Number(source.updatedAt) || 0
    };
  }

  function loadStore(scope = globalScope) {
    const raw = getStorage(scope).getItem(STORAGE_KEY);
    return normalizeStore(safeJsonParse(raw, defaultStore()));
  }

  function mirrorToIndexedDB(store, scope = globalScope) {
    if (!scope.indexedDB || typeof scope.indexedDB.open !== "function") return Promise.resolve(false);
    return new Promise((resolve) => {
      let request;
      try { request = scope.indexedDB.open("hh-dev-workspace", 1); } catch (_) { resolve(false); return; }
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains("state")) database.createObjectStore("state");
      };
      request.onerror = () => resolve(false);
      request.onsuccess = () => {
        const database = request.result;
        try {
          const transaction = database.transaction("state", "readwrite");
          transaction.objectStore("state").put(store, STORAGE_KEY);
          transaction.oncomplete = () => { database.close(); resolve(true); };
          transaction.onerror = () => { database.close(); resolve(false); };
        } catch (_) { database.close(); resolve(false); }
      };
    });
  }

  function saveStore(store, scope = globalScope) {
    const normalized = normalizeStore({ ...store, updatedAt: Date.now() });
    getStorage(scope).setItem(STORAGE_KEY, JSON.stringify(normalized));
    void mirrorToIndexedDB(normalized, scope);
    return normalized;
  }

  function isJson(value) {
    const trimmed = value.trim();
    if (!trimmed || !/^[\[{]/.test(trimmed)) return false;
    const parsed = safeJsonParse(trimmed, undefined);
    return parsed !== undefined && parsed !== null && typeof parsed === "object";
  }

  function decodeBase64Bytes(value) {
    const normalized = String(value).replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    if (!normalized || /[^A-Za-z0-9+/=]/.test(normalized)) throw new Error("Chuỗi Base64 không hợp lệ.");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    if (typeof globalScope.atob === "function") {
      const binary = globalScope.atob(padded);
      return Uint8Array.from(binary, (character) => character.charCodeAt(0));
    }
    if (typeof Buffer !== "undefined") return Uint8Array.from(Buffer.from(padded, "base64"));
    throw new Error("Trình duyệt không hỗ trợ Base64.");
  }

  function encodeBase64Bytes(bytes) {
    if (typeof globalScope.btoa === "function") {
      let binary = "";
      const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      for (let index = 0; index < source.length; index += 0x8000) {
        binary += String.fromCharCode(...source.subarray(index, index + 0x8000));
      }
      return globalScope.btoa(binary);
    }
    if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
    throw new Error("Trình duyệt không hỗ trợ Base64.");
  }

  function utf8ToBase64(value) {
    return encodeBase64Bytes(new TextEncoder().encode(String(value)));
  }

  function base64ToUtf8(value) {
    return new TextDecoder("utf-8", { fatal: true }).decode(decodeBase64Bytes(value));
  }

  function decodeJwt(value) {
    const parts = String(value).trim().split(".");
    if (parts.length !== 3) return null;
    try {
      const header = JSON.parse(base64ToUtf8(parts[0]));
      const payload = JSON.parse(base64ToUtf8(parts[1]));
      return { header, payload, signature: parts[2] };
    } catch (_) { return null; }
  }

  function looksLikeBase64(value) {
    const compact = value.trim().replace(/\s+/g, "");
    if (compact.length < 8 || compact.length % 4 === 1 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(compact)) return false;
    try {
      const decoded = base64ToUtf8(compact);
      if (!decoded) return false;
      const printable = [...decoded].filter((character) => character === "\n" || character === "\r" || character === "\t" || character >= " ").length;
      return printable / decoded.length > 0.85;
    } catch (_) { return false; }
  }

  function looksLikeXml(value) {
    const trimmed = value.trim();
    if (!/^<\?xml\b|^<[A-Za-z_][\w:.-]*(?:\s|>|\/)/.test(trimmed)) return false;
    if (globalScope.DOMParser) {
      const parsed = new globalScope.DOMParser().parseFromString(trimmed, "application/xml");
      return !parsed.querySelector("parsererror");
    }
    const documentBody = trimmed.replace(/^<\?xml\b[^?]*\?>\s*/i, "");
    const root = documentBody.match(/^<([A-Za-z_][\w:.-]*)\b[^>]*>/)?.[1];
    return Boolean(root && (new RegExp(`<\\/${root}\\s*>$`).test(documentBody) || /\/>$/.test(documentBody)));
  }

  function looksLikeTimestamp(value) {
    const trimmed = value.trim();
    if (/^\d{10}$/.test(trimmed)) return Number(trimmed) >= 315532800 && Number(trimmed) <= 4102444800;
    if (/^\d{13}$/.test(trimmed)) return Number(trimmed) >= 315532800000 && Number(trimmed) <= 4102444800000;
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed) && !Number.isNaN(Date.parse(trimmed));
  }

  function detectInput(value) {
    const input = clampText(value).trim();
    if (!input) return [];
    const detections = [];
    const add = (type, confidence, reason, toolId, metadata = {}) => detections.push({ type, confidence, reason, toolId, metadata });
    if (isJson(input)) add("JSON", 0.99, "Cú pháp JSON hợp lệ", "json");
    const jwt = decodeJwt(input);
    if (jwt) add("JWT", 0.99, "Ba phần Base64URL chứa header và payload JSON", "security-lab", { algorithm: jwt.header.alg || "unknown", expiresAt: jwt.payload.exp || null });
    try {
      const parsedUrl = new URL(input);
      if (["http:", "https:"].includes(parsedUrl.protocol)) add("URL", 0.98, `Liên kết ${parsedUrl.protocol.replace(":", "").toUpperCase()}`, "url", { host: parsedUrl.host });
    } catch (_) { /* Not a URL. */ }
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input)) add("UUID", 0.99, "Đúng cấu trúc UUID chuẩn", "uuid");
    if (looksLikeTimestamp(input)) add("Timestamp", 0.96, "Thời gian Unix hoặc ISO 8601", "timestamp");
    if (looksLikeXml(input)) add("XML", 0.96, "Cấu trúc thẻ XML hợp lệ", "json-data-lab");
    if (/\b(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\b[\s\S]*\b(?:FROM|INTO|TABLE|SET|AS)\b/i.test(input)) add("SQL", 0.94, "Phát hiện câu lệnh và từ khóa SQL", "database-playground");
    if (/^(?:#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\))$/i.test(input)) add("Màu", 0.98, "Giá trị màu CSS", "color");
    if (!jwt && looksLikeBase64(input)) add("Base64", 0.9, "Chuỗi giải mã thành văn bản UTF-8", "base64");
    return detections.sort((left, right) => right.confidence - left.confidence || left.type.localeCompare(right.type));
  }

  function tokenizeJsonPath(path) {
    const source = String(path || "$ ").trim();
    if (!source.startsWith("$")) throw new Error("JSONPath phải bắt đầu bằng $.");
    const tokens = [];
    let index = 1;
    while (index < source.length) {
      if (/\s/.test(source[index])) { index += 1; continue; }
      if (source[index] === ".") {
        index += 1;
        if (source[index] === "*") { tokens.push({ type: "wildcard" }); index += 1; continue; }
        const match = source.slice(index).match(/^[A-Za-z_$][\w$-]*/);
        if (!match) throw new Error(`JSONPath không hợp lệ tại vị trí ${index}.`);
        tokens.push({ type: "property", value: match[0] });
        index += match[0].length;
        continue;
      }
      if (source[index] === "[") {
        const close = source.indexOf("]", index);
        if (close < 0) throw new Error("JSONPath thiếu dấu ].");
        const segment = source.slice(index + 1, close).trim();
        if (segment === "*") tokens.push({ type: "wildcard" });
        else if (/^\d+$/.test(segment)) tokens.push({ type: "index", value: Number(segment) });
        else {
          const quoted = segment.match(/^(['"])(.*?)\1$/);
          if (!quoted) throw new Error("Chỉ hỗ trợ property, index và wildcard an toàn.");
          tokens.push({ type: "property", value: quoted[2] });
        }
        index = close + 1;
        continue;
      }
      throw new Error(`JSONPath không hỗ trợ cú pháp tại vị trí ${index}.`);
    }
    return tokens;
  }

  function queryJsonPath(input, path) {
    const root = typeof input === "string" ? JSON.parse(input) : input;
    let current = [root];
    for (const token of tokenizeJsonPath(path)) {
      const next = [];
      for (const value of current) {
        if (token.type === "property" && value !== null && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, token.value)) next.push(value[token.value]);
        if (token.type === "index" && Array.isArray(value) && token.value < value.length) next.push(value[token.value]);
        if (token.type === "wildcard" && value !== null && typeof value === "object") next.push(...Object.values(value));
      }
      current = next;
    }
    if (!current.length) return undefined;
    return current.length === 1 ? current[0] : current;
  }

  function streamTransformSupported(scope = globalScope) {
    return typeof scope.CompressionStream === "function" && typeof scope.DecompressionStream === "function" && typeof scope.Response === "function";
  }

  async function gzipCompress(value, scope = globalScope) {
    if (!streamTransformSupported(scope)) throw new Error("GZip cần CompressionStream; trình duyệt này chưa hỗ trợ.");
    const input = new Blob([new TextEncoder().encode(String(value))]).stream();
    const result = await new scope.Response(input.pipeThrough(new scope.CompressionStream("gzip"))).arrayBuffer();
    return encodeBase64Bytes(new Uint8Array(result));
  }

  async function gzipDecompress(value, scope = globalScope) {
    if (!streamTransformSupported(scope)) throw new Error("GZip cần DecompressionStream; trình duyệt này chưa hỗ trợ.");
    const input = new Blob([decodeBase64Bytes(value)]).stream();
    const result = await new scope.Response(input.pipeThrough(new scope.DecompressionStream("gzip"))).arrayBuffer();
    return new TextDecoder().decode(result);
  }

  async function sha256(value, scope = globalScope) {
    let cryptoApi = scope.crypto;
    if (!cryptoApi?.subtle && typeof require === "function") {
      try { cryptoApi = require("node:crypto").webcrypto; } catch (_) { /* Browser-only fallback below. */ }
    }
    if (!cryptoApi?.subtle) throw new Error("Thiết bị không hỗ trợ Web Crypto SHA-256.");
    const digest = await cryptoApi.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function normalizeStep(step, index = 0) {
    const operation = OPERATION_DEFINITIONS.find((item) => item.id === step?.operation) || OPERATION_DEFINITIONS[0];
    return {
      id: clampText(step?.id || uid("step"), 100),
      operation: operation.id,
      label: clampText(step?.label || operation.name, 100),
      enabled: step?.enabled !== false,
      breakpoint: Boolean(step?.breakpoint),
      options: { path: clampText(step?.options?.path || "$.items[*]", 240) },
      order: index
    };
  }

  function createDefaultRecipe() {
    return normalizeRecipe({
      id: uid("recipe"),
      name: "Giải mã và định dạng JSON",
      autoRun: false,
      steps: [
        { operation: "base64-decode", label: "Giải mã Base64" },
        { operation: "json-format", label: "Định dạng JSON" }
      ]
    });
  }

  function normalizeRecipe(recipe) {
    const source = recipe && typeof recipe === "object" ? recipe : {};
    const steps = Array.isArray(source.steps) ? source.steps.slice(0, 40).map(normalizeStep) : [];
    return {
      format: "hh-developer-recipe",
      version: VERSION,
      id: clampText(source.id || uid("recipe"), 100),
      name: clampText(source.name || "Recipe chưa đặt tên", 120),
      autoRun: Boolean(source.autoRun),
      steps,
      createdAt: Number(source.createdAt) || Date.now(),
      updatedAt: Number(source.updatedAt) || Date.now()
    };
  }

  async function executeOperation(step, input, options = {}) {
    const operation = typeof step === "string" ? step : step?.operation;
    const config = typeof step === "object" ? step.options || {} : options;
    const text = String(input ?? "");
    if (operation === "base64-encode") return utf8ToBase64(text);
    if (operation === "base64-decode") return base64ToUtf8(text);
    if (operation === "gzip-compress") return gzipCompress(text, options.scope || globalScope);
    if (operation === "gzip-decompress") return gzipDecompress(text, options.scope || globalScope);
    if (operation === "json-format") return JSON.stringify(JSON.parse(text), null, 2);
    if (operation === "json-minify") return JSON.stringify(JSON.parse(text));
    if (operation === "jsonpath") {
      const result = queryJsonPath(text, config.path || options.path || "$");
      return result === undefined ? "" : typeof result === "string" ? result : JSON.stringify(result, null, 2);
    }
    if (operation === "url-encode") return encodeURIComponent(text);
    if (operation === "url-decode") return decodeURIComponent(text);
    if (operation === "sha256") return sha256(text, options.scope || globalScope);
    throw new Error(`Không hỗ trợ thao tác: ${operation}.`);
  }

  async function runPipeline(recipeInput, initialInput, options = {}) {
    const recipe = normalizeRecipe(recipeInput);
    const outputs = [];
    let value = String(initialInput ?? "");
    let pausedAt = -1;
    const startIndex = Math.max(0, Number(options.startIndex) || 0);
    const stopAfter = Number.isFinite(options.stopAfter) ? Math.max(startIndex, options.stopAfter) : Infinity;
    for (let index = startIndex; index < recipe.steps.length; index += 1) {
      const step = recipe.steps[index];
      if (!step.enabled) {
        outputs.push({ stepId: step.id, index, operation: step.operation, status: "skipped", input: value, output: value, elapsed: 0 });
        continue;
      }
      if (step.breakpoint && !options.ignoreBreakpoints && index !== options.resumeBreakpoint) {
        pausedAt = index;
        outputs.push({ stepId: step.id, index, operation: step.operation, status: "breakpoint", input: value, output: value, elapsed: 0 });
        break;
      }
      const before = value;
      const started = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
      try {
        value = await executeOperation(step, value, options);
        const ended = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
        outputs.push({ stepId: step.id, index, operation: step.operation, status: "success", input: before, output: value, elapsed: Math.max(0, ended - started) });
      } catch (error) {
        const ended = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
        outputs.push({ stepId: step.id, index, operation: step.operation, status: "error", input: before, output: before, error: error?.message || String(error), elapsed: Math.max(0, ended - started) });
        return { recipe, input: String(initialInput ?? ""), output: before, outputs, pausedAt: -1, nextIndex: index, status: "error" };
      }
      if (index >= stopAfter) return { recipe, input: String(initialInput ?? ""), output: value, outputs, pausedAt: index, nextIndex: index + 1, status: index + 1 >= recipe.steps.length ? "success" : "stepped" };
    }
    return { recipe, input: String(initialInput ?? ""), output: value, outputs, pausedAt, nextIndex: pausedAt >= 0 ? pausedAt : recipe.steps.length, status: pausedAt >= 0 ? "paused" : "success" };
  }

  function exportRecipe(recipe) {
    return JSON.stringify(normalizeRecipe(recipe), null, 2);
  }

  function importRecipe(value) {
    const text = String(value ?? "");
    if (!text || text.length > MAX_IMPORT_SIZE) throw new Error("Tệp recipe trống hoặc vượt quá 250 KB.");
    const parsed = JSON.parse(text);
    if (parsed.format !== "hh-developer-recipe" || Number(parsed.version) !== VERSION) throw new Error("Định dạng recipe không hợp lệ.");
    return normalizeRecipe(parsed);
  }

  function bytesToBase64Url(bytes) {
    return encodeBase64Bytes(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function base64UrlToText(value) {
    return new TextDecoder().decode(decodeBase64Bytes(value.replace(/-/g, "+").replace(/_/g, "/")));
  }

  function createShareLink(recipe, options = {}) {
    const baseUrl = options.baseUrl || (globalScope.location ? `${globalScope.location.origin}${globalScope.location.pathname}#/dev-tools/developer-recipe` : "https://hh.local/#/dev-tools/developer-recipe");
    const payload = bytesToBase64Url(new TextEncoder().encode(exportRecipe(recipe)));
    const link = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}recipe=${payload}`;
    const maxLength = Number(options.maxLength) || MAX_SHARE_LENGTH;
    if (link.length > maxLength) throw new Error(`Recipe quá lớn để chia sẻ bằng liên kết (${link.length}/${maxLength} ký tự). Hãy xuất tệp JSON.`);
    return link;
  }

  function parseShareLink(value) {
    const text = String(value ?? "");
    const query = text.includes("?") ? text.slice(text.indexOf("?") + 1) : text.replace(/^#?/, "");
    const payload = new URLSearchParams(query).get("recipe");
    if (!payload || payload.length > MAX_SHARE_LENGTH) throw new Error("Liên kết recipe không hợp lệ hoặc quá lớn.");
    return importRecipe(base64UrlToText(payload));
  }

  async function readClipboardWithPermission(scope = globalScope) {
    const navigatorApi = scope.navigator;
    if (!navigatorApi?.clipboard?.readText) throw new Error("Trình duyệt không hỗ trợ đọc clipboard.");
    if (navigatorApi.permissions?.query) {
      try {
        const permission = await navigatorApi.permissions.query({ name: "clipboard-read" });
        if (permission.state === "denied") throw new Error("Quyền đọc clipboard đã bị từ chối.");
      } catch (error) {
        if (/từ chối/.test(error?.message || "")) throw error;
      }
    }
    return clampText(await navigatorApi.clipboard.readText());
  }

  function supports(toolId) {
    return TOOLS.some((tool) => tool.id === toolId);
  }

  function tools() {
    return TOOLS.map((tool) => ({ ...tool }));
  }

  function icon(name) {
    return `<i data-lucide="${escapeHtml(name)}" aria-hidden="true"></i>`;
  }

  function toolRoute(toolId) {
    return `/dev-tools/${toolId}`;
  }

  function detectionMarkup(detections) {
    if (!detections.length) return `<div class="dsr-empty"><b>Chưa nhận diện được định dạng cụ thể</b><span>Thử dán JSON, URL, JWT, UUID, XML, SQL, timestamp, Base64 hoặc mã màu.</span></div>`;
    return detections.map((item, index) => `<article class="dsr-detection ${index === 0 ? "is-primary" : ""}">
      <span class="dsr-detection__score">${Math.round(item.confidence * 100)}%</span>
      <div><strong>${escapeHtml(item.type)}</strong><small>${escapeHtml(item.reason)}</small></div>
      <button type="button" data-dsr-open-tool="${escapeHtml(item.toolId)}">Mở công cụ<span aria-hidden="true">→</span></button>
    </article>`).join("");
  }

  function historyMarkup(store) {
    const rows = [...store.pins.map((row) => ({ ...row, pinned: true })), ...store.history].slice(0, 16);
    if (!rows.length) return `<p class="dsr-muted">Lịch sử chỉ lưu trên thiết bị này sau khi bạn phân tích dữ liệu.</p>`;
    return rows.map((row) => `<button type="button" class="dsr-history-row" data-dsr-history-id="${escapeHtml(row.id)}" data-pinned="${row.pinned ? "true" : "false"}">
      <span>${row.pinned ? icon("pin") : icon("history")}</span><span><b>${escapeHtml(row.types.join(", ") || "Văn bản")}</b><small>${escapeHtml(row.preview || "Dữ liệu trống")}</small></span>
    </button>`).join("");
  }

  function smartInputView(store) {
    return `<main class="dsr-workspace dsr-smart" data-dsr-root data-tool="smart-input">
      <header class="dsr-hero">
        <div class="dsr-hero__icon">${icon("sparkles")}</div>
        <div><span>DEV INTELLIGENCE</span><h2>Smart Input</h2><p>Dán một lần. HH nhận diện định dạng và đưa bạn tới đúng công cụ.</p></div>
        <div class="dsr-local-badge">${icon("shield-check")} Xử lý local-first</div>
      </header>
      <section class="dsr-grid dsr-grid--smart">
        <article class="dsr-panel dsr-input-panel">
          <header><div><span>01 · INPUT</span><h3>Dữ liệu đầu vào</h3></div><small data-dsr-count>0 ký tự</small></header>
          <label class="dsr-dropzone" data-dsr-dropzone>
            ${icon("file-input")}<span><b>Thả tệp văn bản vào đây</b><small>Tối đa 500.000 ký tự, không tự tải lên máy chủ</small></span>
            <input type="file" data-dsr-file accept=".txt,.json,.xml,.sql,.csv,.yaml,.yml,.toml,.jwt,text/*,application/json">
          </label>
          <label class="dsr-editor-label" for="dsr-smart-input">Nội dung cần phân tích</label>
          <textarea id="dsr-smart-input" data-dsr-smart-input spellcheck="false" placeholder="Dán JSON, JWT, URL, UUID, timestamp, XML, SQL, Base64 hoặc mã màu..."></textarea>
          <div class="dsr-actions">
            <button class="is-primary" type="button" data-dsr-analyze>${icon("scan-search")} Phân tích</button>
            <button type="button" data-dsr-clipboard>${icon("clipboard-paste")} Đọc clipboard</button>
            <button type="button" data-dsr-pin>${icon("pin")} Ghim dữ liệu</button>
            <button type="button" data-dsr-clear>${icon("trash-2")} Xóa</button>
          </div>
          <p class="dsr-privacy">Clipboard chỉ được đọc sau khi bạn bấm nút và trình duyệt cấp quyền.</p>
        </article>
        <article class="dsr-panel dsr-result-panel">
          <header><div><span>02 · DETECT</span><h3>Kết quả nhận diện</h3></div><small data-dsr-detect-count>0 định dạng</small></header>
          <div class="dsr-detections" data-dsr-detections aria-live="polite">${detectionMarkup([])}</div>
          <footer><button type="button" data-dsr-send-recipe>${icon("workflow")} Đưa dữ liệu sang Recipe</button></footer>
        </article>
        <aside class="dsr-panel dsr-history-panel">
          <header><div><span>LOCAL VAULT</span><h3>Lịch sử & đã ghim</h3></div><button type="button" data-dsr-clear-history title="Xóa lịch sử">${icon("eraser")}</button></header>
          <div data-dsr-history>${historyMarkup(store)}</div>
        </aside>
      </section>
      <div class="dsr-toast" role="status" aria-live="polite" data-dsr-toast hidden></div>
    </main>`;
  }

  function operationButtons() {
    return OPERATION_DEFINITIONS.map((operation) => `<button type="button" draggable="true" data-dsr-add-operation="${operation.id}">${icon(operation.icon)}<span><b>${operation.name}</b><small>${operation.group}</small></span><span aria-hidden="true">+</span></button>`).join("");
  }

  function pipelineMarkup(recipe) {
    if (!recipe.steps.length) return `<div class="dsr-pipeline-empty" data-dsr-pipeline-empty>${icon("workflow")}<b>Kéo thao tác vào đây</b><span>Hoặc bấm dấu + trong thư viện.</span></div>`;
    return recipe.steps.map((step, index) => `<article class="dsr-step" draggable="true" data-dsr-step-id="${escapeHtml(step.id)}">
      <button class="dsr-step__handle" type="button" aria-label="Kéo bước ${index + 1}">${icon("grip-vertical")}</button>
      <span class="dsr-step__number">${String(index + 1).padStart(2, "0")}</span>
      <div class="dsr-step__body"><strong>${escapeHtml(step.label)}</strong><small>${escapeHtml(step.operation)}</small>${step.operation === "jsonpath" ? `<label>Path<input data-dsr-step-path="${escapeHtml(step.id)}" value="${escapeHtml(step.options.path)}" aria-label="JSONPath"></label>` : ""}</div>
      <label class="dsr-breakpoint" title="Tạm dừng trước bước này"><input type="checkbox" data-dsr-breakpoint="${escapeHtml(step.id)}" ${step.breakpoint ? "checked" : ""}><span></span>BP</label>
      <div class="dsr-step__actions">
        <button type="button" data-dsr-step-up="${escapeHtml(step.id)}" aria-label="Đưa lên">↑</button>
        <button type="button" data-dsr-step-down="${escapeHtml(step.id)}" aria-label="Đưa xuống">↓</button>
        <button type="button" data-dsr-step-remove="${escapeHtml(step.id)}" aria-label="Xóa bước">×</button>
      </div>
    </article>`).join("");
  }

  function outputMarkup(run) {
    if (!run?.outputs?.length) return `<div class="dsr-empty"><b>Chưa chạy pipeline</b><span>Mỗi bước sẽ hiển thị input, output, thời gian và trạng thái tại đây.</span></div>`;
    return run.outputs.map((row) => `<details class="dsr-output-step" ${row.status === "error" || row.status === "breakpoint" ? "open" : ""}>
      <summary><span class="is-${escapeHtml(row.status)}"></span><b>${String(row.index + 1).padStart(2, "0")} · ${escapeHtml(row.operation)}</b><small>${escapeHtml(row.status)} · ${Number(row.elapsed || 0).toFixed(1)} ms</small></summary>
      <div><label>Input<pre>${escapeHtml(clampText(row.input, 4000))}</pre></label><label>Output<pre>${escapeHtml(clampText(row.error || row.output, 4000))}</pre></label></div>
    </details>`).join("");
  }

  function recipeView(store) {
    const recipe = store.recipes.find((item) => item.id === store.activeRecipeId) || store.recipes[0] || createDefaultRecipe();
    return `<main class="dsr-workspace dsr-recipe" data-dsr-root data-tool="developer-recipe">
      <header class="dsr-hero">
        <div class="dsr-hero__icon">${icon("workflow")}</div>
        <div><span>DEV AUTOMATION</span><h2>Developer Recipe</h2><p>Ghép, kiểm tra và chạy lại pipeline dữ liệu mà không thực thi mã tùy ý.</p></div>
        <div class="dsr-local-badge">${icon("shield-check")} Không eval · Local-first</div>
      </header>
      <section class="dsr-recipe-toolbar">
        <label>Tên recipe<input data-dsr-recipe-name value="${escapeHtml(recipe.name)}" maxlength="120"></label>
        <label class="dsr-toggle"><input type="checkbox" data-dsr-auto-run ${recipe.autoRun ? "checked" : ""}><span></span>Chạy tự động</label>
        <button class="is-primary" type="button" data-dsr-run>${icon("play")} Chạy tất cả</button>
        <button type="button" data-dsr-step-run>${icon("step-forward")} Chạy từng bước</button>
        <button type="button" data-dsr-reset>${icon("rotate-ccw")} Đặt lại</button>
        <button type="button" data-dsr-save>${icon("save")} Lưu</button>
        <button type="button" data-dsr-share>${icon("share-2")} Chia sẻ</button>
        <button type="button" data-dsr-export>${icon("download")} Xuất</button>
        <label class="dsr-file-button">${icon("upload")} Nhập<input type="file" data-dsr-import accept="application/json,.json"></label>
      </section>
      <section class="dsr-recipe-layout">
        <aside class="dsr-panel dsr-operation-library"><header><div><span>THƯ VIỆN</span><h3>Thao tác</h3></div><small>${OPERATION_DEFINITIONS.length} bước</small></header><div>${operationButtons()}</div></aside>
        <section class="dsr-recipe-center">
          <article class="dsr-panel dsr-recipe-input"><header><div><span>SOURCE</span><h3>Input</h3></div><small data-dsr-recipe-count>0 ký tự</small></header><textarea data-dsr-recipe-input spellcheck="false" placeholder="Dán dữ liệu đầu vào cho pipeline..."></textarea></article>
          <article class="dsr-panel dsr-pipeline-panel"><header><div><span>PIPELINE</span><h3>Luồng xử lý</h3></div><small data-dsr-pipeline-status>${recipe.steps.length} bước</small></header><div class="dsr-pipeline" data-dsr-pipeline>${pipelineMarkup(recipe)}</div></article>
        </section>
        <aside class="dsr-panel dsr-output-panel"><header><div><span>INSPECTOR</span><h3>Đầu ra từng bước</h3></div><button type="button" data-dsr-copy-output title="Sao chép đầu ra">${icon("copy")}</button></header><div data-dsr-outputs aria-live="polite">${outputMarkup(null)}</div><footer><b data-dsr-final-label>Final output</b><pre data-dsr-final-output>Chưa có kết quả.</pre></footer></aside>
      </section>
      <footer class="dsr-statusbar"><span data-dsr-status role="status" aria-live="polite">Sẵn sàng.</span><span>GZip: ${streamTransformSupported() ? "khả dụng" : "không hỗ trợ"}</span><span>Persistence: IndexedDB + localStorage fallback</span></footer>
      <div class="dsr-toast" role="status" aria-live="polite" data-dsr-toast hidden></div>
    </main>`;
  }

  function mount(host, options = {}) {
    if (!host || typeof host.querySelector !== "function") throw new Error("HHDevSmartRecipe.mount cần một host DOM hợp lệ.");
    cleanup(host);
    const toolId = supports(options.toolId) ? options.toolId : TOOLS[0].id;
    let store = loadStore();
    if (toolId === "developer-recipe" && !store.recipes.length) {
      const starter = createDefaultRecipe();
      store = saveStore({ ...store, recipes: [starter], activeRecipeId: starter.id });
    }
    host.innerHTML = toolId === "smart-input" ? smartInputView(store) : recipeView(store);
    const root = host.querySelector("[data-dsr-root]");
    const controller = new AbortController();
    const session = { host, root, toolId, controller, timer: 0, recipe: null, run: null, stepCursor: 0, draggedStepId: "", draggedOperation: "" };
    mounted.set(host, session);
    if (toolId === "smart-input") bindSmartInput(session);
    else bindRecipe(session);
    globalScope.lucide?.createIcons?.({ attrs: { width: 16, height: 16, "stroke-width": 1.8 } });
    return { root, toolId, cleanup: () => cleanup(host) };
  }

  function signal(session) {
    return { signal: session.controller.signal };
  }

  function toast(session, message, kind = "info") {
    const node = session.root.querySelector("[data-dsr-toast]");
    if (!node) return;
    node.textContent = message;
    node.dataset.kind = kind;
    node.hidden = false;
    clearTimeout(session.timer);
    session.timer = setTimeout(() => { node.hidden = true; }, 2600);
  }

  function openSuggestedTool(toolId) {
    const route = toolRoute(toolId);
    if (globalScope.location) globalScope.location.hash = `#${route}`;
    globalScope.dispatchEvent?.(new CustomEvent("hh:route", { detail: { route } }));
  }

  function readHistoryRow(store, id, pinned) {
    return (pinned ? store.pins : store.history).find((row) => row.id === id);
  }

  function addHistory(input, detections) {
    const store = loadStore();
    const row = normalizeStoredRow({ input, preview: input.trim().replace(/\s+/g, " "), types: detections.map((item) => item.type), createdAt: Date.now() });
    const history = [row, ...store.history.filter((item) => item.input !== row.input)].slice(0, HISTORY_LIMIT);
    return saveStore({ ...store, history });
  }

  function bindSmartInput(session) {
    const root = session.root;
    const input = root.querySelector("[data-dsr-smart-input]");
    const count = root.querySelector("[data-dsr-count]");
    const results = root.querySelector("[data-dsr-detections]");
    const detectionCount = root.querySelector("[data-dsr-detect-count]");
    const history = root.querySelector("[data-dsr-history]");
    let latestDetections = [];

    const updateCount = () => { count.textContent = `${input.value.length.toLocaleString("vi-VN")} ký tự`; };
    const renderHistory = () => { history.innerHTML = historyMarkup(loadStore()); globalScope.lucide?.createIcons?.({ attrs: { width: 15, height: 15 } }); };
    const analyze = ({ persist = true } = {}) => {
      latestDetections = detectInput(input.value);
      results.innerHTML = detectionMarkup(latestDetections);
      detectionCount.textContent = `${latestDetections.length} định dạng`;
      if (persist && input.value.trim()) { addHistory(input.value, latestDetections); renderHistory(); }
      globalScope.lucide?.createIcons?.({ attrs: { width: 15, height: 15 } });
      return latestDetections;
    };

    root.addEventListener("click", async (event) => {
      const button = event.target.closest("button,[data-dsr-history-id]");
      if (!button) return;
      try {
        if (button.matches("[data-dsr-analyze]")) analyze();
        if (button.matches("[data-dsr-clipboard]")) { input.value = await readClipboardWithPermission(); updateCount(); analyze(); toast(session, "Đã đọc clipboard sau khi được cấp quyền.", "success"); }
        if (button.matches("[data-dsr-clear]")) { input.value = ""; updateCount(); latestDetections = []; results.innerHTML = detectionMarkup([]); detectionCount.textContent = "0 định dạng"; input.focus(); }
        if (button.matches("[data-dsr-pin]")) {
          if (!input.value.trim()) throw new Error("Hãy nhập dữ liệu trước khi ghim.");
          const store = loadStore();
          const detections = latestDetections.length ? latestDetections : detectInput(input.value);
          const row = normalizeStoredRow({ input: input.value, preview: input.value.trim().replace(/\s+/g, " "), types: detections.map((item) => item.type) }, true);
          saveStore({ ...store, pins: [row, ...store.pins.filter((item) => item.input !== row.input)].slice(0, PIN_LIMIT) });
          renderHistory(); toast(session, "Đã ghim dữ liệu trên thiết bị.", "success");
        }
        if (button.matches("[data-dsr-clear-history]")) { const store = loadStore(); saveStore({ ...store, history: [] }); renderHistory(); toast(session, "Đã xóa lịch sử, dữ liệu ghim vẫn được giữ."); }
        if (button.matches("[data-dsr-open-tool]")) openSuggestedTool(button.dataset.dsrOpenTool);
        if (button.matches("[data-dsr-send-recipe]")) {
          if (!input.value.trim()) throw new Error("Chưa có dữ liệu để chuyển.");
          getStorage().setItem(`${STORAGE_KEY}.handoff`, clampText(input.value, MAX_STORED_TEXT));
          openSuggestedTool("developer-recipe");
        }
        if (button.matches("[data-dsr-history-id]")) {
          const row = readHistoryRow(loadStore(), button.dataset.dsrHistoryId, button.dataset.pinned === "true");
          if (row) { input.value = row.input; updateCount(); analyze({ persist: false }); input.focus(); }
        }
      } catch (error) { toast(session, error?.message || String(error), "error"); }
    }, signal(session));

    input.addEventListener("input", () => {
      updateCount();
      clearTimeout(session.timer);
      session.timer = setTimeout(() => analyze({ persist: false }), 260);
    }, signal(session));
    input.addEventListener("paste", () => setTimeout(() => { updateCount(); analyze(); }, 0), signal(session));

    const dropzone = root.querySelector("[data-dsr-dropzone]");
    const fileInput = root.querySelector("[data-dsr-file]");
    const loadFile = async (file) => {
      if (!file) return;
      if (file.size > 2000000) throw new Error("Tệp vượt quá giới hạn 2 MB của Smart Input.");
      input.value = clampText(await file.text());
      updateCount(); analyze(); toast(session, `Đã đọc ${file.name} trên thiết bị.`, "success");
    };
    fileInput.addEventListener("change", () => loadFile(fileInput.files?.[0]).catch((error) => toast(session, error.message, "error")), signal(session));
    dropzone.addEventListener("dragover", (event) => { event.preventDefault(); dropzone.classList.add("is-dragging"); }, signal(session));
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-dragging"), signal(session));
    dropzone.addEventListener("drop", (event) => { event.preventDefault(); dropzone.classList.remove("is-dragging"); loadFile(event.dataTransfer?.files?.[0]).catch((error) => toast(session, error.message, "error")); }, signal(session));
    updateCount();
  }

  function persistRecipe(session) {
    const root = session.root;
    session.recipe.name = clampText(root.querySelector("[data-dsr-recipe-name]").value, 120) || "Recipe chưa đặt tên";
    session.recipe.autoRun = root.querySelector("[data-dsr-auto-run]").checked;
    session.recipe.updatedAt = Date.now();
    const store = loadStore();
    const recipes = [session.recipe, ...store.recipes.filter((item) => item.id !== session.recipe.id)].slice(0, RECIPE_LIMIT);
    saveStore({ ...store, recipes, activeRecipeId: session.recipe.id });
  }

  function renderPipeline(session) {
    session.root.querySelector("[data-dsr-pipeline]").innerHTML = pipelineMarkup(session.recipe);
    session.root.querySelector("[data-dsr-pipeline-status]").textContent = `${session.recipe.steps.length} bước`;
    globalScope.lucide?.createIcons?.({ attrs: { width: 15, height: 15 } });
  }

  function renderRun(session) {
    const output = session.root.querySelector("[data-dsr-outputs]");
    const final = session.root.querySelector("[data-dsr-final-output]");
    output.innerHTML = outputMarkup(session.run);
    final.textContent = session.run?.output || "Chưa có kết quả.";
    session.root.querySelector("[data-dsr-final-label]").textContent = session.run?.status === "error" ? "Output trước lỗi" : "Final output";
  }

  function setRecipeStatus(session, message, kind = "info") {
    const node = session.root.querySelector("[data-dsr-status]");
    node.textContent = message;
    node.dataset.kind = kind;
  }

  async function executeRecipe(session, mode = "all") {
    const input = session.root.querySelector("[data-dsr-recipe-input]").value;
    if (!input && session.recipe.steps.length) throw new Error("Hãy nhập dữ liệu đầu vào.");
    setRecipeStatus(session, "Đang chạy pipeline…", "running");
    if (mode === "step") {
      const result = await runPipeline(session.recipe, session.stepCursor === 0 ? input : session.run?.output || input, {
        startIndex: session.stepCursor,
        stopAfter: session.stepCursor,
        ignoreBreakpoints: true
      });
      const previousOutputs = session.stepCursor === 0 ? [] : session.run?.outputs || [];
      session.run = { ...result, input, outputs: [...previousOutputs, ...result.outputs] };
      session.stepCursor = result.nextIndex >= session.recipe.steps.length ? 0 : result.nextIndex;
    } else {
      session.run = await runPipeline(session.recipe, input);
      session.stepCursor = session.run.nextIndex >= session.recipe.steps.length ? 0 : session.run.nextIndex;
    }
    renderRun(session);
    const message = session.run.status === "paused" ? `Tạm dừng tại breakpoint bước ${session.run.pausedAt + 1}.` : session.run.status === "error" ? "Pipeline dừng do lỗi." : session.run.status === "stepped" ? `Đã chạy đến bước ${session.stepCursor}.` : "Pipeline hoàn tất.";
    setRecipeStatus(session, message, session.run.status === "error" ? "error" : "success");
  }

  function moveStep(recipe, id, delta) {
    const index = recipe.steps.findIndex((step) => step.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= recipe.steps.length) return false;
    const [step] = recipe.steps.splice(index, 1);
    recipe.steps.splice(target, 0, step);
    recipe.steps = recipe.steps.map(normalizeStep);
    return true;
  }

  function downloadText(content, name) {
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 1500);
  }

  function bindRecipe(session) {
    const root = session.root;
    const store = loadStore();
    session.recipe = normalizeRecipe(store.recipes.find((item) => item.id === store.activeRecipeId) || store.recipes[0] || createDefaultRecipe());
    const input = root.querySelector("[data-dsr-recipe-input]");
    const handoff = getStorage().getItem(`${STORAGE_KEY}.handoff`);
    if (handoff) { input.value = handoff; getStorage().removeItem(`${STORAGE_KEY}.handoff`); }
    const updateCount = () => { root.querySelector("[data-dsr-recipe-count]").textContent = `${input.value.length.toLocaleString("vi-VN")} ký tự`; };
    const scheduleAutoRun = () => {
      if (!session.recipe.autoRun) return;
      clearTimeout(session.timer);
      session.timer = setTimeout(() => executeRecipe(session).catch((error) => setRecipeStatus(session, error.message, "error")), 420);
    };

    root.addEventListener("click", async (event) => {
      const target = event.target.closest("button,label.dsr-file-button");
      if (!target) return;
      try {
        const operationId = target.dataset.dsrAddOperation;
        if (operationId) { session.recipe.steps.push(normalizeStep({ operation: operationId }, session.recipe.steps.length)); renderPipeline(session); persistRecipe(session); scheduleAutoRun(); }
        if (target.matches("[data-dsr-run]")) await executeRecipe(session);
        if (target.matches("[data-dsr-step-run]")) await executeRecipe(session, "step");
        if (target.matches("[data-dsr-reset]")) { session.stepCursor = 0; session.run = null; renderRun(session); setRecipeStatus(session, "Đã đặt lại trạng thái chạy."); }
        if (target.matches("[data-dsr-save]")) { persistRecipe(session); toast(session, "Đã lưu recipe trên thiết bị.", "success"); }
        if (target.matches("[data-dsr-share]")) { const link = createShareLink(session.recipe); await globalScope.navigator?.clipboard?.writeText?.(link); toast(session, "Đã sao chép liên kết recipe.", "success"); }
        if (target.matches("[data-dsr-export]")) downloadText(exportRecipe(session.recipe), `${session.recipe.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "hh-recipe"}.json`);
        if (target.matches("[data-dsr-copy-output]")) { if (!session.run) throw new Error("Chưa có output để sao chép."); await globalScope.navigator?.clipboard?.writeText?.(session.run.output); toast(session, "Đã sao chép output.", "success"); }
        const upId = target.dataset.dsrStepUp, downId = target.dataset.dsrStepDown, removeId = target.dataset.dsrStepRemove;
        if (upId && moveStep(session.recipe, upId, -1)) { renderPipeline(session); persistRecipe(session); }
        if (downId && moveStep(session.recipe, downId, 1)) { renderPipeline(session); persistRecipe(session); }
        if (removeId) { session.recipe.steps = session.recipe.steps.filter((step) => step.id !== removeId).map(normalizeStep); renderPipeline(session); persistRecipe(session); }
      } catch (error) { setRecipeStatus(session, error?.message || String(error), "error"); toast(session, error?.message || String(error), "error"); }
    }, signal(session));

    root.addEventListener("change", (event) => {
      const target = event.target;
      if (target.matches("[data-dsr-auto-run]")) { session.recipe.autoRun = target.checked; persistRecipe(session); scheduleAutoRun(); }
      if (target.matches("[data-dsr-breakpoint]")) { const step = session.recipe.steps.find((item) => item.id === target.dataset.dsrBreakpoint); if (step) { step.breakpoint = target.checked; persistRecipe(session); } }
      if (target.matches("[data-dsr-step-path]")) { const step = session.recipe.steps.find((item) => item.id === target.dataset.dsrStepPath); if (step) { step.options.path = clampText(target.value, 240); persistRecipe(session); scheduleAutoRun(); } }
    }, signal(session));
    root.querySelector("[data-dsr-recipe-name]").addEventListener("input", () => persistRecipe(session), signal(session));
    input.addEventListener("input", () => { updateCount(); session.stepCursor = 0; scheduleAutoRun(); }, signal(session));

    const fileInput = root.querySelector("[data-dsr-import]");
    fileInput.addEventListener("change", async () => {
      try {
        const file = fileInput.files?.[0];
        if (!file || file.size > MAX_IMPORT_SIZE) throw new Error("Tệp recipe không hợp lệ hoặc vượt quá 250 KB.");
        session.recipe = importRecipe(await file.text());
        root.querySelector("[data-dsr-recipe-name]").value = session.recipe.name;
        root.querySelector("[data-dsr-auto-run]").checked = session.recipe.autoRun;
        renderPipeline(session); persistRecipe(session); toast(session, "Đã nhập recipe.", "success");
      } catch (error) { toast(session, error.message, "error"); }
      fileInput.value = "";
    }, signal(session));

    root.addEventListener("dragstart", (event) => {
      const step = event.target.closest("[data-dsr-step-id]");
      const operation = event.target.closest("[data-dsr-add-operation]");
      session.draggedStepId = step?.dataset.dsrStepId || "";
      session.draggedOperation = operation?.dataset.dsrAddOperation || "";
      event.dataTransfer?.setData("text/plain", session.draggedStepId || session.draggedOperation);
    }, signal(session));
    const pipeline = root.querySelector("[data-dsr-pipeline]");
    pipeline.addEventListener("dragover", (event) => { event.preventDefault(); pipeline.classList.add("is-dragging"); }, signal(session));
    pipeline.addEventListener("dragleave", () => pipeline.classList.remove("is-dragging"), signal(session));
    pipeline.addEventListener("drop", (event) => {
      event.preventDefault(); pipeline.classList.remove("is-dragging");
      const over = event.target.closest("[data-dsr-step-id]");
      if (session.draggedOperation) session.recipe.steps.push(normalizeStep({ operation: session.draggedOperation }, session.recipe.steps.length));
      if (session.draggedStepId && over && over.dataset.dsrStepId !== session.draggedStepId) {
        const from = session.recipe.steps.findIndex((step) => step.id === session.draggedStepId);
        const to = session.recipe.steps.findIndex((step) => step.id === over.dataset.dsrStepId);
        if (from >= 0 && to >= 0) { const [step] = session.recipe.steps.splice(from, 1); session.recipe.steps.splice(to, 0, step); }
      }
      session.recipe.steps = session.recipe.steps.map(normalizeStep);
      session.draggedStepId = ""; session.draggedOperation = "";
      renderPipeline(session); persistRecipe(session); scheduleAutoRun();
    }, signal(session));
    updateCount();
  }

  function cleanup(host) {
    if (host) {
      const session = mounted.get(host);
      if (!session) return false;
      session.controller.abort(); clearTimeout(session.timer); session.root?.remove(); mounted.delete(host); return true;
    }
    for (const [mountedHost] of [...mounted]) cleanup(mountedHost);
    return true;
  }

  const api = {
    VERSION, STORAGE_KEY, MAX_INPUT_LENGTH, MAX_IMPORT_SIZE, MAX_SHARE_LENGTH,
    OPERATION_DEFINITIONS, supports, mount, cleanup, tools,
    detectInput, decodeJwt, utf8ToBase64, base64ToUtf8,
    tokenizeJsonPath, queryJsonPath, streamTransformSupported,
    gzipCompress, gzipDecompress, sha256, executeOperation,
    createDefaultRecipe, normalizeRecipe, runPipeline,
    exportRecipe, importRecipe, createShareLink, parseShareLink,
    loadStore, saveStore, readClipboardWithPermission
  };

  globalScope.HHDevSmartRecipe = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
