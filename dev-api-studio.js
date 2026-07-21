(function initHHDevApiStudio(factory) {
  "use strict";

  const api = factory(typeof globalThis !== "undefined" ? globalThis : window);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof globalThis !== "undefined") globalThis.HHDevApiStudio = api;
})(function createHHDevApiStudio(globalScope) {
  "use strict";

  const SCHEMA = "hh.dev.api-studio.v1";
  const VERSION = 1;
  const STORAGE_KEY = SCHEMA;
  const MAX_TEXT_BYTES = 2 * 1024 * 1024;
  const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
  const PROTOCOLS = ["rest", "graphql", "websocket", "sse", "socketio", "mqtt"];
  const TOOLS = Object.freeze([
    {
      id: "api-studio",
      name: "API Studio Pro",
      group: "Mạng & API",
      description: "REST, GraphQL, WebSocket, SSE, môi trường, assertion và đo hiệu năng trong một workspace.",
      capabilities: ["REST", "GraphQL", "WebSocket", "SSE", "OAuth 2.0 PKCE", "Collections"]
    },
    {
      id: "mock-api",
      name: "Mock Server & API Testing",
      group: "Mạng & API",
      description: "Nhập OpenAPI, mô phỏng route cục bộ, lỗi, độ trễ, runner và sinh code nhiều ngôn ngữ.",
      capabilities: ["OpenAPI", "Local simulator", "Collection runner", "Assertions", "Code snippets"]
    }
  ]);

  const runtime = {
    host: null,
    root: null,
    toolId: "api-studio",
    controller: null,
    socket: null,
    eventSource: null,
    cleanupTasks: [],
    secretValues: Object.create(null),
    files: new Map(),
    lastResponse: null,
    activePanel: "params",
    protocol: "rest",
    activeRequestId: "request-welcome",
    timer: 0
  };

  const DEFAULT_REQUEST = Object.freeze({
    id: "request-welcome",
    name: "Yêu cầu mới",
    folderId: "folder-default",
    protocol: "rest",
    method: "GET",
    url: "https://api.github.com/repos/hoangdaika13/hoangdaika13.github.io",
    paramsText: "",
    headersText: "Accept: application/vnd.github+json",
    bodyMode: "none",
    bodyText: "",
    graphqlVariables: "{}",
    auth: { type: "none", username: "", apiKeyName: "X-API-Key", apiKeyLocation: "header" },
    assertions: [{ source: "status", operator: "equals", expected: 200 }],
    preRequest: []
  });

  function defaultState() {
    return {
      schema: SCHEMA,
      version: VERSION,
      updatedAt: new Date(0).toISOString(),
      activeEnvironmentId: "environment-local",
      folders: [{ id: "folder-default", name: "Mặc định" }],
      collections: [{ id: "collection-main", name: "HH API", folderIds: ["folder-default"], requestIds: [DEFAULT_REQUEST.id] }],
      requests: [clone(DEFAULT_REQUEST)],
      environments: [{
        id: "environment-local",
        name: "Local",
        variables: [
          { key: "baseUrl", value: "https://api.github.com", secret: false, enabled: true },
          { key: "token", value: "", secret: true, enabled: true }
        ]
      }],
      mock: {
        specificationText: "",
        routes: [],
        selectedRouteId: "",
        request: { method: "GET", path: "/health" },
        runner: []
      },
      history: []
    };
  }

  function clone(value) {
    if (typeof structuredClone === "function") {
      try { return structuredClone(value); } catch {}
    }
    return JSON.parse(JSON.stringify(value));
  }

  function uid(prefix = "id") {
    const random = globalScope.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
    return `${prefix}-${random}`;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[character]);
  }

  function boundedText(value, max = 200000) {
    return String(value ?? "").slice(0, max);
  }

  function safeJsonParse(value, fallback = null) {
    try { return JSON.parse(String(value)); } catch { return fallback; }
  }

  function byteLength(value) {
    const text = String(value ?? "");
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text).byteLength;
    if (typeof Buffer !== "undefined") return Buffer.byteLength(text, "utf8");
    return unescape(encodeURIComponent(text)).length;
  }

  function normalizePairs(input, options = {}) {
    if (Array.isArray(input)) {
      return input.slice(0, 200).map((item) => ({
        key: boundedText(item?.key, 200).trim(),
        value: boundedText(item?.value, options.maxValueLength || 20000),
        enabled: item?.enabled !== false,
        secret: Boolean(item?.secret)
      })).filter((item) => item.key);
    }
    return String(input || "").split(/\r?\n/).slice(0, 200).map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return null;
      const separator = trimmed.indexOf(":");
      const equal = trimmed.indexOf("=");
      const index = separator >= 0 ? separator : equal;
      return index < 0
        ? { key: trimmed, value: "", enabled: true, secret: false }
        : { key: trimmed.slice(0, index).trim(), value: trimmed.slice(index + 1).trim(), enabled: true, secret: false };
    }).filter(Boolean);
  }

  function pairsToObject(input) {
    return Object.fromEntries(normalizePairs(input).filter((item) => item.enabled).map((item) => [item.key, item.value]));
  }

  function stripSecrets(value) {
    if (Array.isArray(value)) return value.map(stripSecrets);
    if (!value || typeof value !== "object") return value;
    if (value.secret === true) {
      const safeSecret = {};
      Object.entries(value).forEach(([key, item]) => {
        safeSecret[key] = key === "value" ? "" : stripSecrets(item);
      });
      safeSecret.configured = Boolean(value.value || value.configured);
      return safeSecret;
    }
    const result = {};
    Object.entries(value).forEach(([key, item]) => {
      if (key === "secretValues" || key === "files") return;
      if (item && typeof item === "object" && item.secret === true) {
        result[key] = { ...stripSecrets(item), value: "", configured: Boolean(item.value || item.configured) };
        return;
      }
      if (/password|clientSecret|accessToken|refreshToken/i.test(key)) {
        result[key] = "";
        return;
      }
      result[key] = stripSecrets(item);
    });
    return result;
  }

  function sanitizeState(input) {
    const base = defaultState();
    const raw = input && typeof input === "object" ? stripSecrets(input) : {};
    const state = {
      ...base,
      ...raw,
      schema: SCHEMA,
      version: VERSION,
      folders: Array.isArray(raw.folders) ? raw.folders.slice(0, 100) : base.folders,
      collections: Array.isArray(raw.collections) ? raw.collections.slice(0, 100) : base.collections,
      requests: Array.isArray(raw.requests) ? raw.requests.slice(0, 300) : base.requests,
      environments: Array.isArray(raw.environments) ? raw.environments.slice(0, 50).map((environment) => ({
        id: boundedText(environment.id || uid("environment"), 120),
        name: boundedText(environment.name || "Environment", 120),
        variables: normalizePairs(environment.variables).map((variable) => variable.secret ? { ...variable, value: "", configured: Boolean(variable.configured) } : variable)
      })) : base.environments,
      mock: { ...base.mock, ...(raw.mock || {}), routes: Array.isArray(raw.mock?.routes) ? raw.mock.routes.slice(0, 500) : [] },
      history: Array.isArray(raw.history) ? raw.history.slice(0, 100) : []
    };
    return state;
  }

  function createStore(storage = globalScope.localStorage) {
    let memory = defaultState();
    return {
      load() {
        if (!storage?.getItem) return clone(memory);
        try {
          const text = storage.getItem(STORAGE_KEY);
          return sanitizeState(text ? JSON.parse(text) : defaultState());
        } catch { return defaultState(); }
      },
      save(next) {
        const safe = sanitizeState({ ...next, updatedAt: new Date().toISOString() });
        const text = JSON.stringify(safe);
        if (byteLength(text) > MAX_TEXT_BYTES) throw new Error("Workspace vượt giới hạn lưu cục bộ 2 MB.");
        memory = safe;
        if (storage?.setItem) storage.setItem(STORAGE_KEY, text);
        return clone(safe);
      },
      export(next, options = {}) {
        const safe = sanitizeState(next || this.load());
        const payload = { format: "hh-api-studio", schema: SCHEMA, version: VERSION, exportedAt: new Date().toISOString(), workspace: safe };
        if (options.includeSecrets === true) throw new Error("Secret không được xuất từ client. Hãy cấu hình lại ở thiết bị đích.");
        return JSON.stringify(payload, null, 2);
      },
      import(text) {
        if (byteLength(text) > MAX_TEXT_BYTES) throw new Error("Tệp import vượt giới hạn 2 MB.");
        const payload = safeJsonParse(text);
        if (!payload || payload.format !== "hh-api-studio" || payload.version !== VERSION) throw new Error("Tệp API Studio không hợp lệ.");
        return this.save(payload.workspace);
      }
    };
  }

  function upsertWorkspaceItem(state, collectionName, item, prefix) {
    const next = sanitizeState(state);
    const list = Array.isArray(next[collectionName]) ? next[collectionName] : [];
    const normalized = stripSecrets({ ...item, id: boundedText(item?.id || uid(prefix), 120) });
    const index = list.findIndex((entry) => entry.id === normalized.id);
    if (index >= 0) list[index] = { ...list[index], ...normalized };
    else list.push(normalized);
    next[collectionName] = list;
    return { state: next, item: clone(list[index >= 0 ? index : list.length - 1]) };
  }

  function upsertFolder(state, folder = {}) {
    const result = upsertWorkspaceItem(state, "folders", { name: "Thư mục mới", ...folder }, "folder");
    result.item.name = boundedText(result.item.name, 120) || "Thư mục mới";
    result.state.folders = result.state.folders.map((item) => item.id === result.item.id ? result.item : item);
    return result;
  }

  function upsertCollection(state, collection = {}) {
    const result = upsertWorkspaceItem(state, "collections", { name: "Collection mới", folderIds: [], requestIds: [], ...collection }, "collection");
    result.item.name = boundedText(result.item.name, 120) || "Collection mới";
    result.item.folderIds = [...new Set(Array.isArray(result.item.folderIds) ? result.item.folderIds : [])].slice(0, 100);
    result.item.requestIds = [...new Set(Array.isArray(result.item.requestIds) ? result.item.requestIds : [])].slice(0, 300);
    result.state.collections = result.state.collections.map((item) => item.id === result.item.id ? result.item : item);
    return result;
  }

  function upsertEnvironment(state, environment = {}) {
    const result = upsertWorkspaceItem(state, "environments", { name: "Environment mới", variables: [], ...environment }, "environment");
    result.item.name = boundedText(result.item.name, 120) || "Environment mới";
    result.item.variables = normalizePairs(environment.variables || result.item.variables).map((variable) => variable.secret ? { ...variable, value: "", configured: Boolean(variable.value || variable.configured) } : variable);
    result.state.environments = result.state.environments.map((item) => item.id === result.item.id ? result.item : item);
    return result;
  }

  function upsertRequest(state, request = {}, collectionId = "") {
    const result = upsertWorkspaceItem(state, "requests", { ...clone(DEFAULT_REQUEST), ...request }, "request");
    result.item.name = boundedText(result.item.name, 160) || "Yêu cầu mới";
    result.item.url = boundedText(result.item.url, 10000);
    result.state.requests = result.state.requests.map((item) => item.id === result.item.id ? result.item : item);
    if (collectionId) {
      result.state.collections = result.state.collections.map((collection) => collection.id === collectionId
        ? { ...collection, requestIds: [...new Set([...(collection.requestIds || []), result.item.id])] }
        : collection);
    }
    return result;
  }

  function removeWorkspaceItem(state, collectionName, id) {
    const next = sanitizeState(state);
    if (!["folders", "collections", "requests", "environments"].includes(collectionName)) throw new Error("Loại workspace item không hợp lệ.");
    next[collectionName] = next[collectionName].filter((item) => item.id !== id);
    if (collectionName === "requests") next.collections = next.collections.map((collection) => ({ ...collection, requestIds: (collection.requestIds || []).filter((requestId) => requestId !== id) }));
    if (collectionName === "folders") next.collections = next.collections.map((collection) => ({ ...collection, folderIds: (collection.folderIds || []).filter((folderId) => folderId !== id) }));
    if (collectionName === "environments" && next.activeEnvironmentId === id) next.activeEnvironmentId = next.environments[0]?.id || "";
    return next;
  }

  function environmentMap(environment, secretValues = {}) {
    const values = Object.create(null);
    normalizePairs(environment?.variables).forEach((variable) => {
      if (!variable.enabled) return;
      values[variable.key] = variable.secret ? String(secretValues[variable.key] || "") : String(variable.value || "");
    });
    return values;
  }

  function applyTemplate(value, variables = {}, dynamic = {}) {
    const now = dynamic.now instanceof Date ? dynamic.now : new Date();
    const builtins = {
      "$timestamp": String(Math.floor(now.getTime() / 1000)),
      "$isoTimestamp": now.toISOString(),
      "$uuid": dynamic.uuid || uid("request"),
      "$randomInt": String(Number.isInteger(dynamic.randomInt) ? dynamic.randomInt : Math.floor(Math.random() * 10000))
    };
    return String(value ?? "").replace(/\{\{\s*([\w$.-]+)\s*\}\}/g, (match, key) => {
      if (Object.prototype.hasOwnProperty.call(variables, key)) return String(variables[key]);
      if (Object.prototype.hasOwnProperty.call(builtins, key)) return builtins[key];
      return match;
    });
  }

  function applyPreRequest(request, variables, dynamic) {
    const next = clone(request);
    next.url = applyTemplate(next.url, variables, dynamic);
    next.paramsText = applyTemplate(next.paramsText, variables, dynamic);
    next.headersText = applyTemplate(next.headersText, variables, dynamic);
    next.bodyText = applyTemplate(next.bodyText, variables, dynamic);
    next.graphqlVariables = applyTemplate(next.graphqlVariables, variables, dynamic);
    (Array.isArray(next.preRequest) ? next.preRequest : []).slice(0, 50).forEach((step) => {
      if (!step || step.type !== "set-variable" || !/^[\w.-]{1,120}$/.test(step.key || "")) return;
      variables[step.key] = applyTemplate(step.value, variables, dynamic);
    });
    return next;
  }

  function base64Utf8(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return globalScope.btoa ? globalScope.btoa(binary) : Buffer.from(bytes).toString("base64");
  }

  function buildRequest(input, options = {}) {
    const environment = { ...(options.environment || {}) };
    const request = applyPreRequest({ ...clone(DEFAULT_REQUEST), ...(input || {}) }, environment, options.dynamic);
    const protocol = PROTOCOLS.includes(request.protocol) ? request.protocol : "rest";
    if (["socketio", "mqtt"].includes(protocol)) return { protocol, adapterRequired: true, request, notes: [`${protocol === "socketio" ? "Socket.IO" : "MQTT"} cần runtime adapter riêng.`] };
    let url;
    try { url = new URL(request.url); } catch { throw new Error("URL không hợp lệ."); }
    normalizePairs(request.paramsText).filter((item) => item.enabled).forEach((item) => url.searchParams.set(applyTemplate(item.key, environment), applyTemplate(item.value, environment)));
    const headers = new Headers();
    normalizePairs(request.headersText).filter((item) => item.enabled).forEach((item) => headers.set(applyTemplate(item.key, environment), applyTemplate(item.value, environment)));
    const auth = request.auth || {};
    const authSecret = options.authSecret || "";
    if (auth.type === "basic") headers.set("Authorization", `Basic ${base64Utf8(`${applyTemplate(auth.username || "", environment)}:${authSecret}`)}`);
    if (auth.type === "bearer" && authSecret) headers.set("Authorization", `Bearer ${authSecret}`);
    if (auth.type === "oauth2" && authSecret) headers.set("Authorization", `Bearer ${authSecret}`);
    if (auth.type === "api-key" && authSecret) {
      const name = auth.apiKeyName || "X-API-Key";
      if (auth.apiKeyLocation === "query") url.searchParams.set(name, authSecret);
      else headers.set(name, authSecret);
    }
    const method = HTTP_METHODS.includes(String(request.method).toUpperCase()) ? String(request.method).toUpperCase() : "GET";
    const fetchOptions = { method, headers };
    const notes = [];
    if (String(request.cookiesText || "").trim()) notes.push("Trình duyệt không cho đặt Cookie header thủ công. Dùng credentials và cookie cùng origin.");
    if (request.credentials === "include") fetchOptions.credentials = "include";
    if (!["GET", "HEAD"].includes(method)) {
      if (protocol === "graphql") {
        const variables = safeJsonParse(request.graphqlVariables || "{}", null);
        if (variables === null) throw new Error("GraphQL variables phải là JSON hợp lệ.");
        headers.set("Content-Type", "application/json");
        fetchOptions.body = JSON.stringify({ query: request.bodyText || "", variables });
      } else if (request.bodyMode === "json") {
        const body = safeJsonParse(request.bodyText, null);
        if (body === null) throw new Error("JSON body không hợp lệ.");
        headers.set("Content-Type", "application/json");
        fetchOptions.body = JSON.stringify(body);
      } else if (request.bodyMode === "form") {
        headers.set("Content-Type", "application/x-www-form-urlencoded;charset=UTF-8");
        fetchOptions.body = new URLSearchParams(pairsToObject(request.bodyText));
      } else if (request.bodyMode === "multipart") {
        const form = new FormData();
        normalizePairs(request.bodyText).forEach((item) => form.append(item.key, item.value));
        (options.files || []).forEach((entry) => { if (entry?.file) form.append(entry.key || "file", entry.file, entry.file.name); });
        fetchOptions.body = form;
      } else if (request.bodyMode === "text") fetchOptions.body = request.bodyText || "";
    }
    return { protocol, url: url.toString(), fetchOptions, request, notes, assertions: request.assertions || [] };
  }

  function getHeader(headers, name) {
    if (!headers) return "";
    if (typeof headers.get === "function") return headers.get(name) || "";
    const key = Object.keys(headers).find((item) => item.toLowerCase() === String(name).toLowerCase());
    return key ? String(headers[key]) : "";
  }

  function readPath(value, path) {
    const normalized = String(path || "").replace(/^\$\.?/, "");
    if (!normalized) return value;
    return normalized.split(/\.|\[|\]/).filter(Boolean).reduce((current, key) => current == null ? undefined : current[key], value);
  }

  function evaluateAssertion(assertion, response) {
    const operator = assertion?.operator || "equals";
    let actual;
    if (assertion?.source === "status") actual = response.status;
    else if (assertion?.source === "time") actual = response.elapsedMs;
    else if (assertion?.source === "header") actual = getHeader(response.headers, assertion.path);
    else if (assertion?.source === "json") actual = readPath(response.json, assertion.path);
    else actual = response.text;
    const expected = assertion?.expected;
    let pass = false;
    if (operator === "equals") pass = String(actual) === String(expected);
    else if (operator === "not-equals") pass = String(actual) !== String(expected);
    else if (operator === "contains") pass = String(actual).includes(String(expected));
    else if (operator === "exists") pass = actual !== undefined && actual !== null && actual !== "";
    else if (operator === "less-than") pass = Number(actual) < Number(expected);
    else if (operator === "greater-than") pass = Number(actual) > Number(expected);
    else if (operator === "matches") {
      try { pass = new RegExp(String(expected)).test(String(actual)); } catch { pass = false; }
    }
    return { pass, source: assertion?.source || "body", operator, actual, expected, path: assertion?.path || "" };
  }

  async function executeHttp(request, options = {}) {
    const fetchImpl = options.fetchImpl || globalScope.fetch;
    if (typeof fetchImpl !== "function") throw new Error("Fetch API không được hỗ trợ trong môi trường này.");
    const prepared = request?.fetchOptions ? request : buildRequest(request, options);
    if (!["rest", "graphql"].includes(prepared.protocol)) throw new Error("Request này không phải HTTP/GraphQL.");
    const started = options.now ? options.now() : (globalScope.performance?.now?.() || Date.now());
    let response;
    try { response = await fetchImpl(prepared.url, { ...prepared.fetchOptions, signal: options.signal }); }
    catch (error) {
      if (error?.name === "AbortError") throw new Error("Yêu cầu đã được hủy.");
      throw new Error(`Không thể gửi request. Kiểm tra mạng, URL hoặc CORS. ${error?.message || ""}`.trim());
    }
    const text = await response.text();
    const ended = options.now ? options.now() : (globalScope.performance?.now?.() || Date.now());
    const headers = {};
    response.headers?.forEach?.((value, key) => { headers[key] = value; });
    const result = {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      elapsedMs: Math.max(0, ended - started),
      size: byteLength(text),
      headers,
      text,
      json: safeJsonParse(text),
      url: response.url || prepared.url,
      notes: prepared.notes || []
    };
    result.assertions = (prepared.assertions || []).map((assertion) => evaluateAssertion(assertion, result));
    return result;
  }

  function connectWebSocket(url, options = {}) {
    const WebSocketImpl = options.WebSocketImpl || globalScope.WebSocket;
    if (typeof WebSocketImpl !== "function") throw new Error("WebSocket chưa được hỗ trợ trong trình duyệt này.");
    let socket;
    try { socket = new WebSocketImpl(url, options.protocols); } catch { throw new Error("WebSocket URL không hợp lệ."); }
    socket.addEventListener?.("open", () => options.onStatus?.("connected"));
    socket.addEventListener?.("message", (event) => options.onMessage?.(event.data));
    socket.addEventListener?.("error", () => options.onStatus?.("error"));
    socket.addEventListener?.("close", (event) => options.onStatus?.("closed", event));
    return {
      socket,
      send(value) {
        if (socket.readyState !== (WebSocketImpl.OPEN ?? 1)) throw new Error("WebSocket chưa kết nối.");
        socket.send(value);
      },
      close(code = 1000, reason = "HH API Studio đóng kết nối") { socket.close(code, reason); }
    };
  }

  function connectSSE(url, options = {}) {
    const EventSourceImpl = options.EventSourceImpl || globalScope.EventSource;
    if (typeof EventSourceImpl !== "function") throw new Error("EventSource/SSE chưa được hỗ trợ trong trình duyệt này.");
    const source = new EventSourceImpl(url, { withCredentials: Boolean(options.withCredentials) });
    source.addEventListener?.("open", () => options.onStatus?.("connected"));
    source.addEventListener?.("message", (event) => options.onMessage?.(event.data));
    source.addEventListener?.("error", () => options.onStatus?.("error"));
    return { source, close() { source.close(); options.onStatus?.("closed"); } };
  }

  function adapterStatus(protocol, scope = globalScope) {
    if (protocol === "socketio") return {
      protocol, available: typeof scope.io === "function", connected: false,
      message: typeof scope.io === "function" ? "Runtime Socket.IO đã phát hiện; cần server signaling để kết nối." : "Chưa nạp Socket.IO runtime. Cấu hình adapter và server trước khi kết nối."
    };
    if (protocol === "mqtt") return {
      protocol, available: Boolean(scope.mqtt?.connect), connected: false,
      message: scope.mqtt?.connect ? "MQTT.js đã phát hiện; cần broker WebSocket để kết nối." : "Chưa nạp MQTT.js. Cấu hình adapter và broker WebSocket trước khi kết nối."
    };
    return { protocol, available: true, connected: false, message: "Adapter trình duyệt có sẵn." };
  }

  function randomBytes(length) {
    const bytes = new Uint8Array(length);
    if (globalScope.crypto?.getRandomValues) globalScope.crypto.getRandomValues(bytes);
    else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
    return bytes;
  }

  function base64Url(bytes) {
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    const encoded = globalScope.btoa ? globalScope.btoa(binary) : Buffer.from(bytes).toString("base64");
    return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  async function generatePkce(options = {}) {
    const verifier = options.verifier || base64Url(randomBytes(48));
    if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) throw new Error("PKCE verifier phải dài 43-128 ký tự hợp lệ.");
    const subtle = options.subtle || globalScope.crypto?.subtle;
    if (!subtle?.digest) throw new Error("Web Crypto SHA-256 không khả dụng.");
    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    return { verifier, challenge: base64Url(new Uint8Array(digest)), method: "S256" };
  }

  function parseScalar(value) {
    const text = String(value || "").trim();
    if (!text) return {};
    if (/^(true|false)$/i.test(text)) return text.toLowerCase() === "true";
    if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
    if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) return safeJsonParse(text, text);
    return text.replace(/^['"]|['"]$/g, "");
  }

  function parseOpenApiYamlSubset(text) {
    const specification = { openapi: "3.0.0", info: { title: "Imported API", version: "1.0.0" }, paths: {} };
    let currentPath = "";
    let currentMethod = "";
    let currentStatus = "";
    let inPaths = false;
    String(text || "").split(/\r?\n/).forEach((rawLine) => {
      if (!rawLine.trim() || rawLine.trim().startsWith("#")) return;
      const indent = rawLine.match(/^\s*/)[0].length;
      const line = rawLine.trim();
      const split = line.indexOf(":");
      const key = (split >= 0 ? line.slice(0, split) : line).replace(/^['"]|['"]$/g, "");
      const value = split >= 0 ? line.slice(split + 1).trim() : "";
      if (indent === 0 && key === "openapi") specification.openapi = String(parseScalar(value));
      if (indent === 0 && key === "paths") { inPaths = true; return; }
      if (!inPaths) return;
      if (indent <= 2 && key.startsWith("/")) {
        currentPath = key;
        currentMethod = "";
        specification.paths[currentPath] = specification.paths[currentPath] || {};
        return;
      }
      if (indent <= 4 && HTTP_METHODS.map((method) => method.toLowerCase()).includes(key.toLowerCase())) {
        currentMethod = key.toLowerCase();
        currentStatus = "";
        specification.paths[currentPath][currentMethod] = { responses: {} };
        return;
      }
      if (!currentMethod) return;
      const operation = specification.paths[currentPath][currentMethod];
      if (key === "summary") operation.summary = String(parseScalar(value));
      if (/^[1-5Xx][0-9Xx]{2}$/.test(key)) {
        currentStatus = key;
        operation.responses[currentStatus] = operation.responses[currentStatus] || { description: "Mock response" };
      } else if (currentStatus && key === "description") operation.responses[currentStatus].description = String(parseScalar(value));
      else if (currentStatus && ["example", "value"].includes(key)) operation.responses[currentStatus].example = parseScalar(value);
    });
    return specification;
  }

  function parseOpenApi(input) {
    const text = boundedText(input, MAX_TEXT_BYTES);
    if (!text.trim()) throw new Error("Hãy dán OpenAPI JSON hoặc YAML.");
    let specification = safeJsonParse(text);
    if (!specification) specification = parseOpenApiYamlSubset(text);
    if (!specification.paths || typeof specification.paths !== "object") throw new Error("OpenAPI thiếu đối tượng paths.");
    return specification;
  }

  function extractExamples(response) {
    const values = [];
    if (response?.example !== undefined) values.push(response.example);
    Object.values(response?.content || {}).forEach((media) => {
      if (media?.example !== undefined) values.push(media.example);
      Object.values(media?.examples || {}).forEach((example) => values.push(example?.value ?? example));
      if (!values.length && media?.schema?.example !== undefined) values.push(media.schema.example);
    });
    return values.length ? values : [{ message: response?.description || "Mock response" }];
  }

  function routesFromOpenApi(specification) {
    const routes = [];
    Object.entries(specification.paths || {}).forEach(([path, item]) => {
      Object.entries(item || {}).forEach(([method, operation]) => {
        if (!HTTP_METHODS.map((value) => value.toLowerCase()).includes(method.toLowerCase())) return;
        const responses = operation.responses || { 200: { description: "OK" } };
        Object.entries(responses).forEach(([status, response]) => {
          if (!/^\d{3}$/.test(String(status))) return;
          routes.push({
            id: uid("mock-route"), method: method.toUpperCase(), path, status: Number(status), delayMs: 0,
            summary: operation.summary || `${method.toUpperCase()} ${path}`,
            examples: extractExamples(response), random: false, enabled: true,
            headers: { "content-type": "application/json" }
          });
        });
      });
    });
    return routes;
  }

  function pathMatches(pattern, actual) {
    const escaped = String(pattern).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\{[^/]+\\\}/g, "[^/]+");
    return new RegExp(`^${escaped}/?$`).test(String(actual).split("?")[0]);
  }

  async function simulateMock(routes, request, options = {}) {
    const method = String(request?.method || "GET").toUpperCase();
    const route = (routes || []).find((item) => item.enabled !== false && item.method === method && pathMatches(item.path, request.path));
    if (!route) return { ok: false, status: 404, headers: { "content-type": "application/json" }, body: { error: "Mock route not found" }, delayMs: 0, routeId: null };
    const delayMs = Math.min(10000, Math.max(0, Number(options.delayMs ?? route.delayMs) || 0));
    if (options.wait !== false && delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    const examples = Array.isArray(route.examples) && route.examples.length ? route.examples : [{ message: route.summary || "Mock response" }];
    const index = route.random || options.random ? Math.floor((options.randomValue ?? Math.random()) * examples.length) % examples.length : 0;
    const status = Number(options.status || route.status || 200);
    return { ok: status >= 200 && status < 400, status, headers: clone(route.headers || {}), body: clone(examples[index]), delayMs, routeId: route.id };
  }

  async function runCollection(items, options = {}) {
    const execute = options.execute;
    if (typeof execute !== "function") throw new Error("Collection Runner cần hàm execute.");
    const results = [];
    for (const item of (items || []).slice(0, 100)) {
      if (options.signal?.aborted) break;
      const started = Date.now();
      try {
        const response = await execute(item.request || item, item);
        const normalized = {
          ...response,
          elapsedMs: response.elapsedMs ?? Date.now() - started,
          text: response.text ?? JSON.stringify(response.body ?? ""),
          json: response.json ?? response.body
        };
        const assertions = (item.assertions || item.request?.assertions || []).map((assertion) => evaluateAssertion(assertion, normalized));
        results.push({ id: item.id || uid("run"), name: item.name || item.request?.name || "Request", ok: response.ok !== false && assertions.every((assertion) => assertion.pass), response: normalized, assertions });
      } catch (error) {
        results.push({ id: item.id || uid("run"), name: item.name || "Request", ok: false, error: error.message, assertions: [] });
        if (options.stopOnFailure) break;
      }
    }
    return {
      total: results.length,
      passed: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).length,
      results
    };
  }

  function quote(value, language) {
    const text = String(value ?? "");
    if (language === "python") return JSON.stringify(text);
    if (language === "php") return `'${text.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
    return JSON.stringify(text);
  }

  function generateSnippet(input, language = "javascript") {
    const prepared = input?.fetchOptions ? input : buildRequest(input, input?.options || {});
    if (prepared.adapterRequired) return `// ${prepared.notes.join(" ")}`;
    const method = prepared.fetchOptions.method;
    const headers = {};
    prepared.fetchOptions.headers?.forEach?.((value, key) => { if (key.toLowerCase() !== "authorization") headers[key] = value; });
    const body = typeof prepared.fetchOptions.body === "string" ? prepared.fetchOptions.body : "";
    if (language === "python") return `import requests\n\nresponse = requests.request(${quote(method, "python")}, ${quote(prepared.url, "python")}, headers=${JSON.stringify(headers)}, data=${quote(body, "python")})\nprint(response.status_code)\nprint(response.text)`;
    if (language === "php") return `<?php\n$ch = curl_init(${quote(prepared.url, "php")});\ncurl_setopt($ch, CURLOPT_CUSTOMREQUEST, ${quote(method, "php")});\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\ncurl_setopt($ch, CURLOPT_HTTPHEADER, ${JSON.stringify(Object.entries(headers).map(([key, value]) => `${key}: ${value}`))});${body ? `\ncurl_setopt($ch, CURLOPT_POSTFIELDS, ${quote(body, "php")});` : ""}\n$response = curl_exec($ch);\necho $response;\ncurl_close($ch);`;
    if (language === "java") return `var request = java.net.http.HttpRequest.newBuilder()\n    .uri(java.net.URI.create(${quote(prepared.url)}))\n    .method(${quote(method)}, java.net.http.HttpRequest.BodyPublishers.ofString(${quote(body)}))\n    .build();\nvar response = java.net.http.HttpClient.newHttpClient().send(request, java.net.http.HttpResponse.BodyHandlers.ofString());\nSystem.out.println(response.body());`;
    if (language === "csharp") return `using var client = new HttpClient();\nusing var request = new HttpRequestMessage(HttpMethod.${method[0] + method.slice(1).toLowerCase()}, ${quote(prepared.url)});${body ? `\nrequest.Content = new StringContent(${quote(body)}, Encoding.UTF8, "application/json");` : ""}\nvar response = await client.SendAsync(request);\nConsole.WriteLine(await response.Content.ReadAsStringAsync());`;
    return `const response = await fetch(${quote(prepared.url)}, {\n  method: ${quote(method)},\n  headers: ${JSON.stringify(headers, null, 2)}${body ? `,\n  body: ${quote(body)}` : ""}\n});\nconsole.log(response.status, await response.text());`;
  }

  function formatBytes(value) {
    const size = Number(value) || 0;
    return size < 1024 ? `${size} B` : size < 1048576 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1048576).toFixed(1)} MB`;
  }

  function supports(toolId) {
    return TOOLS.some((tool) => tool.id === toolId);
  }

  function tools() {
    return TOOLS.map((tool) => ({ ...tool, capabilities: [...tool.capabilities] }));
  }

  function getActiveState() {
    const store = createStore();
    const state = store.load();
    const request = state.requests.find((item) => item.id === runtime.activeRequestId) || state.requests[0] || clone(DEFAULT_REQUEST);
    runtime.activeRequestId = request.id;
    const environment = state.environments.find((item) => item.id === state.activeEnvironmentId) || state.environments[0];
    return { store, state, request, environment };
  }

  function protocolLabel(protocol) {
    return ({ rest: "REST", graphql: "GraphQL", websocket: "WebSocket", sse: "SSE", socketio: "Socket.IO", mqtt: "MQTT" })[protocol] || protocol;
  }

  function icon(name) {
    const symbols = { send: "↗", stop: "■", save: "＋", key: "◆", folder: "▰", api: "⌁", mock: "◇", copy: "▣", import: "⇩", run: "▶", close: "×" };
    return `<span aria-hidden="true">${symbols[name] || "•"}</span>`;
  }

  function renderShell(toolId) {
    const active = supports(toolId) ? toolId : "api-studio";
    return `<section class="hh-api-studio" data-hh-api-studio data-tool="${active}">
      <header class="hh-api-hero">
        <div class="hh-api-hero__brand"><span class="hh-api-logo">API</span><div><small>HH DEVELOPER WORKSPACE</small><h2>${active === "mock-api" ? "Mock Server & API Testing" : "API Studio Pro"}</h2><p>${active === "mock-api" ? "Mô phỏng OpenAPI và kiểm thử collection hoàn toàn cục bộ." : "Gửi request thật, kiểm tra realtime và giữ secret trong bộ nhớ phiên."}</p></div></div>
        <nav aria-label="Chuyển workspace"><button type="button" data-switch-tool="api-studio" class="${active === "api-studio" ? "is-active" : ""}">${icon("api")} API Studio</button><button type="button" data-switch-tool="mock-api" class="${active === "mock-api" ? "is-active" : ""}">${icon("mock")} Mock Lab</button></nav>
      </header>
      <div class="hh-api-runtime"><span class="is-online"></span><b>Browser runtime</b><span>Secret: memory-only</span><span>CORS phụ thuộc máy chủ đích</span><span data-api-clock></span></div>
      <main data-api-workspace>${active === "mock-api" ? renderMockWorkspace() : renderApiWorkspace()}</main>
      <div class="hh-api-toast" data-api-toast role="status" aria-live="polite" hidden></div>
    </section>`;
  }

  function renderApiWorkspace() {
    const { request, environment, state } = getActiveState();
    const protocols = PROTOCOLS.map((protocol) => `<button type="button" data-api-protocol="${protocol}" class="${protocol === (request.protocol || "rest") ? "is-active" : ""}">${protocolLabel(protocol)}</button>`).join("");
    const panels = ["params", "headers", "body", "auth", "tests", "code"].map((panel) => `<button type="button" data-api-panel="${panel}" class="${panel === "params" ? "is-active" : ""}>${({ params: "Params", headers: "Headers", body: "Body", auth: "Auth", tests: "Tests", code: "Code" })[panel]}</button>`).join("");
    return `<div class="hh-api-layout">
      <aside class="hh-api-sidebar">
        <div class="hh-api-sidebar__title"><div><small>COLLECTIONS</small><strong>${state.collections.length} workspace</strong></div><span><button type="button" data-new-request title="Tạo request">＋</button><button type="button" data-save-request title="Lưu request">${icon("save")}</button></span></div>
        <label class="hh-api-search"><span>⌕</span><input type="search" placeholder="Tìm request..." data-collection-search></label>
        ${state.collections.map((collection) => `<div class="hh-api-collection"><span class="hh-api-folder">${icon("folder")}</span><div><strong>${escapeHTML(collection.name)}</strong><small>${(collection.requestIds || []).length} request</small></div></div>`).join("")}
        ${state.requests.map((item) => `<button type="button" class="hh-api-request ${item.id === request.id ? "is-active" : ""}" data-select-request="${escapeHTML(item.id)}"><span>${escapeHTML(item.method)}</span><div><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.url)}</small></div></button>`).join("")}
        <section class="hh-api-environment"><header><small>ENVIRONMENT</small><span><select data-environment>${state.environments.map((item) => `<option value="${escapeHTML(item.id)}" ${item.id === environment?.id ? "selected" : ""}>${escapeHTML(item.name)}</option>`).join("")}</select><button type="button" data-new-environment title="Tạo environment">＋</button></span></header><label><span>baseUrl</span><input value="${escapeHTML(environmentMap(environment).baseUrl || "")}" data-env-base></label><label><span>token <b>memory</b></span><input type="password" autocomplete="off" placeholder="Không lưu / không export" data-api-secret></label><div class="hh-api-environment__actions"><button type="button" data-new-collection>Collection +</button><button type="button" data-new-folder>Folder +</button></div></section>
        <div class="hh-api-privacy"><b>Riêng tư theo thiết kế</b><p>Token và tệp chỉ tồn tại trong phiên hiện tại. Export không chứa secret.</p></div>
      </aside>
      <section class="hh-api-main">
        <div class="hh-api-protocols" role="tablist" aria-label="Giao thức API">${protocols}</div>
        <div class="hh-api-requestbar"><select aria-label="HTTP method" data-api-method>${HTTP_METHODS.map((method) => `<option ${method === request.method ? "selected" : ""}>${method}</option>`).join("")}</select><input type="url" value="${escapeHTML(request.url)}" aria-label="URL request" data-api-url><button type="button" class="is-primary" data-api-run>${icon("send")}<span>Gửi</span><kbd>Ctrl ↵</kbd></button><button type="button" data-api-abort title="Hủy request">${icon("stop")}</button></div>
        <div class="hh-api-tabs" role="tablist">${panels}</div>
        <div class="hh-api-editor" data-api-editor>${renderApiPanel("params", request)}</div>
        <section class="hh-api-response" aria-live="polite">
          <header><div><strong>Response</strong><span data-api-status>Chưa gửi</span></div><div class="hh-api-response__metrics"><span data-api-time>0 ms</span><span data-api-size>0 B</span><button type="button" data-copy-response>${icon("copy")} Sao chép</button></div></header>
          <div class="hh-api-response__body"><pre data-api-output>Gửi request để xem status, headers, body, timing và assertion.</pre><aside data-api-assertions><b>Assertions</b><p>Chưa có kết quả.</p></aside></div>
        </section>
      </section>
    </div>`;
  }

  function renderApiPanel(panel, request) {
    if (panel === "headers") return `<div class="hh-api-panel-grid"><label><span>Headers <small>mỗi dòng Key: Value</small></span><textarea data-api-headers spellcheck="false">${escapeHTML(request.headersText)}</textarea></label><div class="hh-api-guidance"><b>Cookie & CORS</b><p>Cookie header bị trình duyệt bảo vệ. Bật credentials chỉ khi API đích cho phép CORS credentials.</p><label class="hh-api-check"><input type="checkbox" data-api-credentials ${request.credentials === "include" ? "checked" : ""}> Gửi cookie cùng origin/đã cấp quyền</label></div></div>`;
    if (panel === "body") return `<div class="hh-api-panel-grid"><div><label><span>Body mode</span><select data-api-body-mode><option value="none">Không có</option><option value="json" ${request.bodyMode === "json" ? "selected" : ""}>JSON</option><option value="text" ${request.bodyMode === "text" ? "selected" : ""}>Text</option><option value="form" ${request.bodyMode === "form" ? "selected" : ""}>Form URL encoded</option><option value="multipart" ${request.bodyMode === "multipart" ? "selected" : ""}>Multipart + file</option></select></label><label><span>Payload / GraphQL query</span><textarea data-api-body spellcheck="false">${escapeHTML(request.bodyText)}</textarea></label></div><div><label><span>GraphQL variables</span><textarea data-api-graphql spellcheck="false">${escapeHTML(request.graphqlVariables || "{}")}</textarea></label><label class="hh-api-file"><span>Multipart files</span><input type="file" multiple data-api-files><small data-api-file-status>Chưa chọn tệp. Tệp không được lưu.</small></label></div></div>`;
    if (panel === "auth") {
      const authType = request.auth?.type || "none";
      const keyLocation = request.auth?.apiKeyLocation || "header";
      return `<div class="hh-api-panel-grid"><div><label><span>Authorization</span><select data-api-auth-type><option value="none" ${authType === "none" ? "selected" : ""}>Không dùng</option><option value="basic" ${authType === "basic" ? "selected" : ""}>Basic Auth</option><option value="bearer" ${authType === "bearer" ? "selected" : ""}>Bearer Token</option><option value="api-key" ${authType === "api-key" ? "selected" : ""}>API Key</option><option value="oauth2" ${authType === "oauth2" ? "selected" : ""}>OAuth 2.0 PKCE</option></select></label><label><span>Username / Client ID</span><input data-api-auth-user value="${escapeHTML(request.auth?.username || "")}"></label><label><span>Secret / token <small>memory-only</small></span><input type="password" autocomplete="off" data-api-auth-secret placeholder="Không lưu vào localStorage"></label></div><div><label><span>API key name</span><input data-api-key-name value="${escapeHTML(request.auth?.apiKeyName || "X-API-Key")}"></label><label><span>Vị trí API key</span><select data-api-key-location><option value="header" ${keyLocation === "header" ? "selected" : ""}>Header</option><option value="query" ${keyLocation === "query" ? "selected" : ""}>Query</option></select></label><button type="button" data-generate-pkce>Generate PKCE S256</button><pre data-pkce-output>Verifier chỉ tồn tại trong phiên.</pre></div></div>`;
    }
    if (panel === "tests") return `<div class="hh-api-panel-grid"><label><span>Assertions declarative <small>không eval</small></span><textarea data-api-tests spellcheck="false">${escapeHTML(JSON.stringify(request.assertions || [], null, 2))}</textarea></label><label><span>Pre-request steps <small>set-variable + {{template}}</small></span><textarea data-api-prerequest spellcheck="false">${escapeHTML(JSON.stringify(request.preRequest || [], null, 2))}</textarea><small>Hỗ trợ {{$timestamp}}, {{$isoTimestamp}}, {{$uuid}}, {{$randomInt}}. Không chạy JavaScript tùy ý.</small></label></div>`;
    if (panel === "code") return `<div class="hh-api-code"><div><label><span>Ngôn ngữ</span><select data-snippet-language><option value="javascript">JavaScript</option><option value="python">Python</option><option value="php">PHP</option><option value="java">Java</option><option value="csharp">C#</option></select></label><button type="button" data-generate-snippet>Sinh code</button></div><pre data-snippet-output>Secret được loại khỏi code sinh tự động.</pre></div>`;
    return `<div class="hh-api-panel-grid"><label><span>Query params <small>mỗi dòng Key: Value</small></span><textarea data-api-params spellcheck="false">${escapeHTML(request.paramsText)}</textarea></label><div class="hh-api-guidance"><b>Template an toàn</b><p>Dùng <code>{{baseUrl}}</code>, <code>{{$timestamp}}</code> hoặc biến environment. Không chạy eval hay script tùy ý.</p><div><span>URL encode tự động</span><span>AbortController</span><span>Timing thật</span></div></div></div>`;
  }

  function renderMockWorkspace() {
    const { state } = getActiveState();
    return `<div class="hh-mock-layout">
      <aside class="hh-mock-import"><header><small>OPENAPI IMPORT</small><strong>Specification</strong></header><textarea data-openapi-input spellcheck="false" placeholder="Dán OpenAPI 3.x JSON hoặc YAML subset...">${escapeHTML(state.mock.specificationText || "")}</textarea><div><button type="button" class="is-primary" data-import-openapi>${icon("import")} Phân tích OpenAPI</button><button type="button" data-load-openapi-sample>Mẫu</button></div><p>Parser cục bộ hỗ trợ JSON đầy đủ và YAML subset cho paths, methods, responses, description, example.</p>
        <section class="hh-mock-route-form"><small>ROUTE THỦ CÔNG</small><div><select data-mock-method>${HTTP_METHODS.map((method) => `<option>${method}</option>`).join("")}</select><input data-mock-path value="/health" aria-label="Mock path"></div><div><input type="number" min="100" max="599" value="200" data-mock-status aria-label="Mock status"><input type="number" min="0" max="10000" value="0" data-mock-delay aria-label="Mock delay"></div><textarea data-mock-body>{"status":"ok"}</textarea><label class="hh-api-check"><input type="checkbox" data-mock-random> Chọn response ngẫu nhiên</label><button type="button" data-add-mock-route>Thêm route</button></section>
      </aside>
      <section class="hh-mock-main">
        <header class="hh-mock-heading"><div><small>LOCAL SIMULATOR</small><h3>Mock routes</h3><p>Không mở cổng mạng và không giả làm server public. Request được khớp ngay trong trình duyệt.</p></div><div><b data-mock-count>${state.mock.routes.length}</b><span>routes</span></div></header>
        <div class="hh-mock-routes" data-mock-routes>${renderMockRoutes(state.mock.routes)}</div>
        <section class="hh-mock-console"><header><strong>Request simulator</strong><span>Local-only</span></header><div class="hh-mock-requestbar"><select data-sim-method>${HTTP_METHODS.map((method) => `<option>${method}</option>`).join("")}</select><input value="/health" data-sim-path><button type="button" class="is-primary" data-simulate-mock>${icon("run")} Chạy</button><button type="button" data-run-collection>Runner</button></div><div class="hh-mock-result"><pre data-mock-output>Chọn route hoặc nhập path để mô phỏng.</pre><aside data-runner-output><b>Collection Runner</b><p>Chưa chạy.</p></aside></div></section>
        <section class="hh-mock-snippets"><header><strong>Code generation</strong><select data-mock-language><option value="javascript">JavaScript</option><option value="python">Python</option><option value="php">PHP</option><option value="java">Java</option><option value="csharp">C#</option></select><button type="button" data-mock-snippet>Sinh code</button></header><pre data-mock-snippet-output>Chọn route để sinh request mẫu.</pre></section>
      </section>
    </div>`;
  }

  function renderMockRoutes(routes) {
    if (!routes.length) return `<div class="hh-api-empty"><span>◇</span><b>Chưa có mock route</b><p>Nhập OpenAPI hoặc tạo route thủ công để bắt đầu.</p></div>`;
    return routes.map((route) => `<button type="button" class="hh-mock-route" data-mock-route="${escapeHTML(route.id)}"><span class="method-${route.method.toLowerCase()}">${escapeHTML(route.method)}</span><div><strong>${escapeHTML(route.path)}</strong><small>${escapeHTML(route.summary || "Mock response")}</small></div><div><b>${route.status}</b><small>${route.delayMs || 0} ms</small></div></button>`).join("");
  }

  function toast(message, kind = "info") {
    const node = runtime.root?.querySelector("[data-api-toast]");
    if (!node) return;
    node.textContent = message;
    node.dataset.kind = kind;
    node.hidden = false;
    clearTimeout(runtime.timer);
    runtime.timer = setTimeout(() => { node.hidden = true; }, 2800);
  }

  function currentRequestFromUI() {
    const { state, request, environment } = getActiveState();
    const query = (selector) => runtime.root?.querySelector(selector);
    const panelData = runtime.panelDraft || {};
    const environmentValues = environmentMap(environment, runtime.secretValues);
    const visibleBaseUrl = query("[data-env-base]")?.value;
    if (visibleBaseUrl !== undefined) environmentValues.baseUrl = visibleBaseUrl;
    return {
      ...request,
      protocol: runtime.protocol || request.protocol,
      method: query("[data-api-method]")?.value || request.method,
      url: query("[data-api-url]")?.value || request.url,
      paramsText: panelData.params ?? request.paramsText,
      headersText: panelData.headers ?? request.headersText,
      bodyMode: panelData.bodyMode ?? request.bodyMode,
      bodyText: panelData.body ?? request.bodyText,
      graphqlVariables: panelData.graphql ?? request.graphqlVariables,
      credentials: panelData.credentials ? "include" : "omit",
      auth: { ...(request.auth || {}), ...(panelData.auth || {}) },
      assertions: panelData.assertions ?? request.assertions,
      preRequest: panelData.preRequest ?? request.preRequest,
      environment: environmentValues,
      state
    };
  }

  function capturePanel() {
    const query = (selector) => runtime.root?.querySelector(selector);
    runtime.panelDraft = runtime.panelDraft || {};
    if (query("[data-api-params]")) runtime.panelDraft.params = query("[data-api-params]").value;
    if (query("[data-api-headers]")) runtime.panelDraft.headers = query("[data-api-headers]").value;
    if (query("[data-api-body]")) {
      runtime.panelDraft.body = query("[data-api-body]").value;
      runtime.panelDraft.graphql = query("[data-api-graphql]")?.value || "{}";
      runtime.panelDraft.bodyMode = query("[data-api-body-mode]")?.value || "none";
    }
    if (query("[data-api-auth-type]")) runtime.panelDraft.auth = {
      type: query("[data-api-auth-type]").value,
      username: query("[data-api-auth-user]").value,
      apiKeyName: query("[data-api-key-name]").value,
      apiKeyLocation: query("[data-api-key-location]").value
    };
    if (query("[data-api-tests]")) {
      runtime.panelDraft.assertions = safeJsonParse(query("[data-api-tests]").value, []);
      runtime.panelDraft.preRequest = safeJsonParse(query("[data-api-prerequest]").value, []);
    }
    if (query("[data-api-credentials]")) runtime.panelDraft.credentials = query("[data-api-credentials]").checked;
  }

  function showResponse(response) {
    runtime.lastResponse = response;
    const output = runtime.root?.querySelector("[data-api-output]");
    const status = runtime.root?.querySelector("[data-api-status]");
    const time = runtime.root?.querySelector("[data-api-time]");
    const size = runtime.root?.querySelector("[data-api-size]");
    if (output) output.textContent = response.json !== null ? JSON.stringify(response.json, null, 2) : response.text;
    if (status) { status.textContent = `${response.status} ${response.statusText || ""}`.trim(); status.dataset.ok = response.ok ? "true" : "false"; }
    if (time) time.textContent = `${response.elapsedMs.toFixed(0)} ms`;
    if (size) size.textContent = formatBytes(response.size);
    const assertions = runtime.root?.querySelector("[data-api-assertions]");
    if (assertions) assertions.innerHTML = `<b>Assertions</b>${response.assertions?.length ? response.assertions.map((item) => `<p class="${item.pass ? "is-pass" : "is-fail"}">${item.pass ? "PASS" : "FAIL"} · ${escapeHTML(item.source)} ${escapeHTML(item.operator)} ${escapeHTML(item.expected)}</p>`).join("") : "<p>Không có assertion.</p>"}`;
  }

  async function runCurrentRequest() {
    capturePanel();
    runtime.secretValues.token = runtime.root?.querySelector("[data-api-secret]")?.value || runtime.secretValues.token || "";
    const authSecret = runtime.root?.querySelector("[data-api-auth-secret]")?.value || runtime.secretValues.auth || "";
    runtime.secretValues.auth = authSecret;
    const request = currentRequestFromUI();
    if (["socketio", "mqtt"].includes(request.protocol)) {
      const status = adapterStatus(request.protocol);
      showResponse({ ok: false, status: 0, statusText: "ADAPTER REQUIRED", elapsedMs: 0, size: 0, text: status.message, json: { ...status }, assertions: [] });
      return;
    }
    if (request.protocol === "websocket") {
      const realtimeRequest = applyPreRequest(request, { ...request.environment });
      runtime.socket?.close?.();
      const messages = [];
      runtime.socket = connectWebSocket(realtimeRequest.url, {
        onStatus(status) { showResponse({ ok: status === "connected", status: 101, statusText: status.toUpperCase(), elapsedMs: 0, size: byteLength(messages.join("\n")), text: messages.join("\n") || `WebSocket ${status}`, json: null, assertions: [] }); },
        onMessage(message) { messages.push(String(message)); showResponse({ ok: true, status: 101, statusText: "CONNECTED", elapsedMs: 0, size: byteLength(messages.join("\n")), text: messages.join("\n"), json: null, assertions: [] }); }
      });
      return;
    }
    if (request.protocol === "sse") {
      const realtimeRequest = applyPreRequest(request, { ...request.environment });
      runtime.eventSource?.close?.();
      const messages = [];
      runtime.eventSource = connectSSE(realtimeRequest.url, {
        withCredentials: request.credentials === "include",
        onStatus(status) { showResponse({ ok: status === "connected", status: 200, statusText: `SSE ${status}`, elapsedMs: 0, size: byteLength(messages.join("\n")), text: messages.join("\n") || `SSE ${status}`, json: null, assertions: [] }); },
        onMessage(message) { messages.push(String(message)); showResponse({ ok: true, status: 200, statusText: "SSE CONNECTED", elapsedMs: 0, size: byteLength(messages.join("\n")), text: messages.join("\n"), json: null, assertions: [] }); }
      });
      return;
    }
    runtime.controller?.abort();
    runtime.controller = new AbortController();
    const prepared = buildRequest(request, { environment: request.environment, authSecret, files: [...runtime.files.values()] });
    const result = await executeHttp(prepared, { signal: runtime.controller.signal });
    showResponse(result);
    const { store, state } = getActiveState();
    state.history.unshift({ id: uid("history"), name: request.name, method: request.method, url: request.url, status: result.status, elapsedMs: result.elapsedMs, at: new Date().toISOString() });
    store.save(state);
  }

  function persistRequest() {
    capturePanel();
    const current = currentRequestFromUI();
    const { store, state } = getActiveState();
    const safe = stripSecrets(current);
    delete safe.state;
    delete safe.environment;
    const index = state.requests.findIndex((item) => item.id === safe.id);
    if (index >= 0) state.requests[index] = safe;
    else state.requests.push(safe);
    store.save(state);
    toast("Đã lưu request. Secret vẫn chỉ ở bộ nhớ phiên.", "success");
  }

  function updateMockRoutes(routes) {
    const container = runtime.root?.querySelector("[data-mock-routes]");
    if (container) container.innerHTML = renderMockRoutes(routes);
    const count = runtime.root?.querySelector("[data-mock-count]");
    if (count) count.textContent = routes.length;
  }

  function saveMockRoutes(routes, specificationText) {
    const { store, state } = getActiveState();
    state.mock.routes = routes;
    if (specificationText !== undefined) state.mock.specificationText = specificationText;
    store.save(state);
    updateMockRoutes(routes);
  }

  function selectedMockRoute() {
    const { state } = getActiveState();
    return state.mock.routes.find((route) => route.id === state.mock.selectedRouteId) || state.mock.routes[0];
  }

  async function handleClick(event) {
    const button = event.target.closest("button");
    if (!button || !runtime.root?.contains(button)) return;
    try {
      if (button.dataset.switchTool) {
        mount(runtime.host, { toolId: button.dataset.switchTool });
      } else if (button.dataset.selectRequest) {
        runtime.activeRequestId = button.dataset.selectRequest;
        mount(runtime.host, { toolId: "api-studio" });
      } else if (button.dataset.apiProtocol) {
        runtime.protocol = button.dataset.apiProtocol;
        const method = runtime.root.querySelector("[data-api-method]");
        if (method && runtime.protocol === "graphql" && method.value === "GET") method.value = "POST";
        runtime.root.querySelectorAll("[data-api-protocol]").forEach((item) => item.classList.toggle("is-active", item === button));
        toast(`${protocolLabel(runtime.protocol)} đã sẵn sàng.`, "success");
      } else if (button.dataset.apiPanel) {
        capturePanel();
        runtime.activePanel = button.dataset.apiPanel;
        runtime.root.querySelectorAll("[data-api-panel]").forEach((item) => item.classList.toggle("is-active", item === button));
        runtime.root.querySelector("[data-api-editor]").innerHTML = renderApiPanel(runtime.activePanel, currentRequestFromUI());
      } else if (button.hasAttribute("data-api-run")) {
        button.disabled = true;
        await runCurrentRequest();
        button.disabled = false;
      } else if (button.hasAttribute("data-api-abort")) {
        runtime.controller?.abort(); runtime.socket?.close?.(); runtime.eventSource?.close?.(); toast("Đã dừng request/kết nối.");
      } else if (button.hasAttribute("data-save-request")) persistRequest();
      else if (button.hasAttribute("data-new-request")) {
        const { store, state } = getActiveState();
        const result = upsertRequest(state, { id: uid("request"), name: `Request ${state.requests.length + 1}`, url: "{{baseUrl}}/", folderId: state.folders[0]?.id || "" }, state.collections[0]?.id || "");
        store.save(result.state); runtime.activeRequestId = result.item.id; mount(runtime.host, { toolId: "api-studio" });
      } else if (button.hasAttribute("data-new-collection")) {
        const { store, state } = getActiveState();
        const result = upsertCollection(state, { name: `Collection ${state.collections.length + 1}` }); store.save(result.state); mount(runtime.host, { toolId: "api-studio" });
      } else if (button.hasAttribute("data-new-folder")) {
        const { store, state } = getActiveState();
        const result = upsertFolder(state, { name: `Folder ${state.folders.length + 1}` }); store.save(result.state); mount(runtime.host, { toolId: "api-studio" });
      } else if (button.hasAttribute("data-new-environment")) {
        const { store, state } = getActiveState();
        const result = upsertEnvironment(state, { name: `Environment ${state.environments.length + 1}`, variables: [{ key: "baseUrl", value: "https://api.example.com", enabled: true }] });
        result.state.activeEnvironmentId = result.item.id; store.save(result.state); mount(runtime.host, { toolId: "api-studio" });
      }
      else if (button.hasAttribute("data-copy-response")) {
        await globalScope.navigator?.clipboard?.writeText(runtime.lastResponse?.text || ""); toast("Đã sao chép response.", "success");
      } else if (button.hasAttribute("data-generate-pkce")) {
        const result = await generatePkce(); runtime.secretValues.pkceVerifier = result.verifier;
        runtime.root.querySelector("[data-pkce-output]").textContent = `Challenge: ${result.challenge}\nMethod: S256\nVerifier được giữ trong bộ nhớ phiên.`;
      } else if (button.hasAttribute("data-generate-snippet")) {
        capturePanel();
        const request = currentRequestFromUI();
        runtime.root.querySelector("[data-snippet-output]").textContent = generateSnippet(request, runtime.root.querySelector("[data-snippet-language]").value);
      } else if (button.hasAttribute("data-load-openapi-sample")) {
        runtime.root.querySelector("[data-openapi-input]").value = JSON.stringify({ openapi: "3.0.3", info: { title: "HH Demo", version: "1.0.0" }, paths: { "/health": { get: { summary: "Health check", responses: { 200: { description: "OK", content: { "application/json": { example: { status: "ok", service: "hh-api" } } } } } } } } }, null, 2);
      } else if (button.hasAttribute("data-import-openapi")) {
        const text = runtime.root.querySelector("[data-openapi-input]").value;
        const routes = routesFromOpenApi(parseOpenApi(text)); saveMockRoutes(routes, text); toast(`Đã tạo ${routes.length} mock route.`, "success");
      } else if (button.hasAttribute("data-add-mock-route")) {
        const query = (selector) => runtime.root.querySelector(selector);
        const body = safeJsonParse(query("[data-mock-body]").value, query("[data-mock-body]").value);
        const route = { id: uid("mock-route"), method: query("[data-mock-method]").value, path: query("[data-mock-path]").value || "/", status: Number(query("[data-mock-status]").value) || 200, delayMs: Number(query("[data-mock-delay]").value) || 0, examples: [body], random: query("[data-mock-random]").checked, enabled: true, summary: "Route thủ công", headers: { "content-type": "application/json" } };
        const { state } = getActiveState(); saveMockRoutes([...state.mock.routes, route]); toast("Đã thêm mock route.", "success");
      } else if (button.dataset.mockRoute) {
        const { store, state } = getActiveState(); state.mock.selectedRouteId = button.dataset.mockRoute; store.save(state);
        runtime.root.querySelectorAll("[data-mock-route]").forEach((item) => item.classList.toggle("is-active", item === button));
      } else if (button.hasAttribute("data-simulate-mock")) {
        const { state } = getActiveState();
        const response = await simulateMock(state.mock.routes, { method: runtime.root.querySelector("[data-sim-method]").value, path: runtime.root.querySelector("[data-sim-path]").value });
        runtime.root.querySelector("[data-mock-output]").textContent = JSON.stringify(response, null, 2);
      } else if (button.hasAttribute("data-run-collection")) {
        const { state } = getActiveState();
        const items = state.mock.routes.map((route) => ({ id: route.id, name: route.summary, request: { method: route.method, path: route.path }, assertions: [{ source: "status", operator: "equals", expected: route.status }] }));
        const report = await runCollection(items, { execute: (request) => simulateMock(state.mock.routes, request, { wait: false }) });
        runtime.root.querySelector("[data-runner-output]").innerHTML = `<b>Collection Runner</b><p class="${report.failed ? "is-fail" : "is-pass"}">${report.passed}/${report.total} passed · ${report.failed} failed</p>`;
      } else if (button.hasAttribute("data-mock-snippet")) {
        const route = selectedMockRoute();
        if (!route) throw new Error("Hãy chọn hoặc tạo một route.");
        const request = { ...clone(DEFAULT_REQUEST), method: route.method, url: `https://api.example.com${route.path}` };
        runtime.root.querySelector("[data-mock-snippet-output]").textContent = generateSnippet(request, runtime.root.querySelector("[data-mock-language]").value);
      }
    } catch (error) {
      const runButton = runtime.root?.querySelector("[data-api-run]"); if (runButton) runButton.disabled = false;
      toast(error.message || "Không thể hoàn thành thao tác.", "error");
      const output = runtime.root?.querySelector("[data-api-output]") || runtime.root?.querySelector("[data-mock-output]");
      if (output) output.textContent = error.message || String(error);
    }
  }

  function handleChange(event) {
    if (event.target.matches("[data-api-secret]")) runtime.secretValues.token = event.target.value;
    if (event.target.matches("[data-api-auth-secret]")) runtime.secretValues.auth = event.target.value;
    if (event.target.matches("[data-api-files]")) {
      runtime.files.clear();
      [...event.target.files].slice(0, 20).forEach((file, index) => runtime.files.set(`${file.name}-${index}`, { key: `file${index + 1}`, file }));
      const status = runtime.root.querySelector("[data-api-file-status]"); if (status) status.textContent = `${runtime.files.size} tệp trong bộ nhớ phiên.`;
    }
    if (event.target.matches("[data-environment]")) {
      const { store, state } = getActiveState();
      state.activeEnvironmentId = event.target.value;
      store.save(state);
      mount(runtime.host, { toolId: "api-studio" });
    }
    if (event.target.matches("[data-env-base]")) {
      const { store, state, environment } = getActiveState();
      const variables = normalizePairs(environment.variables);
      const index = variables.findIndex((item) => item.key === "baseUrl");
      const baseVariable = { key: "baseUrl", value: boundedText(event.target.value, 10000), secret: false, enabled: true };
      if (index >= 0) variables[index] = baseVariable;
      else variables.unshift(baseVariable);
      const result = upsertEnvironment(state, { ...environment, variables });
      result.state.activeEnvironmentId = result.item.id;
      store.save(result.state);
      toast("Đã lưu baseUrl của environment.", "success");
    }
  }

  function handleKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && runtime.toolId === "api-studio") {
      event.preventDefault();
      runCurrentRequest().catch((error) => toast(error.message, "error"));
    }
  }

  function mount(host, options = {}) {
    if (!host || typeof host.innerHTML === "undefined") return false;
    cleanup();
    runtime.host = host;
    runtime.toolId = supports(options.toolId) ? options.toolId : "api-studio";
    runtime.protocol = "rest";
    runtime.activePanel = "params";
    runtime.panelDraft = {};
    host.innerHTML = renderShell(runtime.toolId);
    runtime.root = host.querySelector("[data-hh-api-studio]");
    const click = (event) => { handleClick(event); };
    const change = (event) => handleChange(event);
    const keydown = (event) => handleKeydown(event);
    runtime.root.addEventListener("click", click);
    runtime.root.addEventListener("change", change);
    runtime.root.addEventListener("keydown", keydown);
    runtime.cleanupTasks.push(() => runtime.root?.removeEventListener("click", click), () => runtime.root?.removeEventListener("change", change), () => runtime.root?.removeEventListener("keydown", keydown));
    const clock = runtime.root.querySelector("[data-api-clock]");
    const updateClock = () => { if (clock) clock.textContent = new Date().toLocaleTimeString("vi-VN"); };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    runtime.cleanupTasks.push(() => clearInterval(interval));
    return true;
  }

  function cleanup() {
    runtime.controller?.abort();
    runtime.socket?.close?.();
    runtime.eventSource?.close?.();
    runtime.cleanupTasks.splice(0).forEach((task) => { try { task(); } catch {} });
    clearTimeout(runtime.timer);
    runtime.controller = null;
    runtime.socket = null;
    runtime.eventSource = null;
    runtime.files.clear();
    runtime.secretValues = Object.create(null);
    runtime.lastResponse = null;
    runtime.panelDraft = {};
    runtime.root = null;
    runtime.host = null;
  }

  return Object.freeze({
    SCHEMA, VERSION, STORAGE_KEY, MAX_TEXT_BYTES, HTTP_METHODS, PROTOCOLS, DEFAULT_REQUEST: clone(DEFAULT_REQUEST),
    supports, tools, mount, cleanup, escapeHTML, normalizePairs, pairsToObject, stripSecrets, sanitizeState,
    createStore, upsertFolder, upsertCollection, upsertEnvironment, upsertRequest, removeWorkspaceItem,
    environmentMap, applyTemplate, applyPreRequest, buildRequest, executeHttp, evaluateAssertion,
    connectWebSocket, connectSSE, adapterStatus, generatePkce, parseOpenApi, parseOpenApiYamlSubset,
    routesFromOpenApi, pathMatches, simulateMock, runCollection, generateSnippet, formatBytes
  });
});
