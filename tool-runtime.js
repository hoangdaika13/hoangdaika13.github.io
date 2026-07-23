(function initToolRuntime(globalScope) {
  "use strict";

  const STATES = Object.freeze(["idle", "validating", "queued", "running", "success", "error", "cancelled"]);
  const TERMINAL_STATES = new Set(["success", "error", "cancelled"]);
  const TRANSITIONS = Object.freeze({
    idle: ["validating", "cancelled"],
    validating: ["queued", "running", "error", "cancelled"],
    queued: ["running", "error", "cancelled"],
    running: ["success", "error", "cancelled"],
    success: [], error: [], cancelled: []
  });
  const RUNTIMES = new Set(["browser", "server", "ai", "integration"]);
  const SENSITIVE_KEY = /(?:password|passcode|secret|token|authorization|cookie|credential|private[-_]?key|api[-_]?key|card|cvv)/i;
  const STORAGE_PREFIX = "hh.tool-runtime.v1";

  class ToolRuntimeError extends Error {
    constructor(message, code = "TOOL_RUNTIME_ERROR", details = null) {
      super(message);
      this.name = "ToolRuntimeError";
      this.code = code;
      this.details = details;
    }
  }

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const nowIso = () => new Date().toISOString();
  const uid = (prefix = "task") => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

  function redact(value, depth = 0) {
    if (depth > 8 || value == null) return value == null ? null : undefined;
    if (["string", "boolean"].includes(typeof value)) return typeof value === "string" ? value.slice(0, 100000) : value;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof Blob !== "undefined" && value instanceof Blob) return { type: value.type, size: value.size, binary: true };
    if (Array.isArray(value)) return value.slice(0, 1000).map((item) => redact(item, depth + 1)).filter((item) => item !== undefined);
    if (typeof value !== "object") return undefined;
    return Object.entries(value).slice(0, 1000).reduce((safe, [key, item]) => {
      if (SENSITIVE_KEY.test(key)) return safe;
      const sanitized = redact(item, depth + 1);
      if (sanitized !== undefined) safe[key] = sanitized;
      return safe;
    }, {});
  }

  function validateManifest(candidate) {
    const manifest = candidate && typeof candidate === "object" ? candidate : {};
    const errors = [];
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(manifest.id || ""))) errors.push("id must use kebab-case");
    if (!String(manifest.name || "").trim()) errors.push("name is required");
    if (!RUNTIMES.has(manifest.runtime)) errors.push("runtime must be browser, server, ai or integration");
    if (!Array.isArray(manifest.actions) || !manifest.actions.length) errors.push("actions must not be empty");
    if (!Array.isArray(manifest.permissions || [])) errors.push("permissions must be an array");
    if (!Array.isArray(manifest.capabilities || [])) errors.push("capabilities must be an array");
    if (!Array.isArray(manifest.inputs || [])) errors.push("inputs must be an array");
    if (errors.length) throw new ToolRuntimeError(`Invalid Tool Manifest: ${errors.join(", ")}`, "INVALID_TOOL_MANIFEST", { errors });
    return Object.freeze({
      ...clone(manifest),
      version: Math.max(1, Number(manifest.version) || 1),
      permissions: Object.freeze([...(manifest.permissions || [])]),
      capabilities: Object.freeze([...(manifest.capabilities || [])]),
      actions: Object.freeze([...manifest.actions]),
      inputs: Object.freeze([...(manifest.inputs || [])]),
      history: manifest.history !== false,
      offline: manifest.offline !== false
    });
  }

  function validateInput(manifest, input = {}) {
    const errors = [];
    for (const field of manifest.inputs || []) {
      const value = input[field.id];
      const missing = value == null || value === "";
      if (field.required && missing) { errors.push({ field: field.id, code: "required", message: `${field.id} is required` }); continue; }
      if (missing) continue;
      if (field.type === "string") {
        if (typeof value !== "string") errors.push({ field: field.id, code: "type", message: `${field.id} must be text` });
        if (field.minLength && String(value).length < field.minLength) errors.push({ field: field.id, code: "minLength", message: `${field.id} is too short` });
        if (field.maxLength && String(value).length > field.maxLength) errors.push({ field: field.id, code: "maxLength", message: `${field.id} is too long` });
      }
      if (field.type === "number" && !Number.isFinite(Number(value))) errors.push({ field: field.id, code: "type", message: `${field.id} must be a number` });
      if (field.type === "number" && field.min != null && Number(value) < field.min) errors.push({ field: field.id, code: "min", message: `${field.id} is below minimum` });
      if (field.type === "number" && field.max != null && Number(value) > field.max) errors.push({ field: field.id, code: "max", message: `${field.id} is above maximum` });
      if (field.type === "enum" && !field.values?.includes(value)) errors.push({ field: field.id, code: "enum", message: `${field.id} is not supported` });
      if (field.type === "file") {
        if (field.maxBytes && Number(value?.size || 0) > field.maxBytes) errors.push({ field: field.id, code: "maxBytes", message: `${field.id} exceeds file limit` });
        if (field.accept && !acceptsFile(field.accept, value?.type, value?.name)) errors.push({ field: field.id, code: "accept", message: `${field.id} has an unsupported format` });
      }
    }
    return { valid: errors.length === 0, errors };
  }

  function acceptsFile(accept, mime = "", name = "") {
    const loweredName = String(name).toLowerCase();
    return String(accept).split(",").map((item) => item.trim().toLowerCase()).some((rule) => rule === String(mime).toLowerCase() || (rule.endsWith("/*") && String(mime).toLowerCase().startsWith(rule.slice(0, -1))) || (rule.startsWith(".") && loweredName.endsWith(rule)));
  }

  function createMemoryStorage() {
    const tables = new Map();
    const table = (name) => { if (!tables.has(name)) tables.set(name, new Map()); return tables.get(name); };
    return Object.freeze({
      kind: "memory",
      async put(name, value) { const row = clone(value); table(name).set(String(row.id), row); return clone(row); },
      async get(name, id) { return clone(table(name).get(String(id)) || null); },
      async list(name, options = {}) { return [...table(name).values()].map(clone).sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""))).slice(0, options.limit || 100); },
      async remove(name, id) { return table(name).delete(String(id)); },
      async clear(name) { table(name).clear(); }
    });
  }

  function createLocalStorageAdapter(localStorageRef) {
    const read = (name) => { try { return JSON.parse(localStorageRef.getItem(`${STORAGE_PREFIX}.${name}`) || "[]"); } catch { return []; } };
    const write = (name, rows) => localStorageRef.setItem(`${STORAGE_PREFIX}.${name}`, JSON.stringify(rows.slice(0, 250)));
    return Object.freeze({
      kind: "localStorage",
      async put(name, value) { const row = clone(value); const rows = read(name).filter((item) => String(item.id) !== String(row.id)); write(name, [row, ...rows]); return clone(row); },
      async get(name, id) { return clone(read(name).find((item) => String(item.id) === String(id)) || null); },
      async list(name, options = {}) { return read(name).slice(0, options.limit || 100).map(clone); },
      async remove(name, id) { const rows = read(name); write(name, rows.filter((item) => String(item.id) !== String(id))); return rows.length !== read(name).length; },
      async clear(name) { localStorageRef.removeItem(`${STORAGE_PREFIX}.${name}`); }
    });
  }

  function createIndexedDbAdapter(indexedDBRef) {
    const open = () => new Promise((resolve, reject) => {
      const request = indexedDBRef.open("hh-tool-runtime", 1);
      request.onupgradeneeded = () => {
        for (const name of ["tasks", "history", "logs", "drafts"]) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB unavailable"));
    });
    const request = async (name, mode, operation) => {
      const db = await open();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(name, mode);
        const result = operation(transaction.objectStore(name));
        result.onsuccess = () => resolve(clone(result.result));
        result.onerror = () => reject(result.error || new Error("IndexedDB request failed"));
        transaction.oncomplete = () => db.close();
      });
    };
    return Object.freeze({
      kind: "indexedDB",
      put: (name, value) => request(name, "readwrite", (store) => store.put(clone(value))),
      get: (name, id) => request(name, "readonly", (store) => store.get(String(id))),
      async list(name, options = {}) { const rows = await request(name, "readonly", (store) => store.getAll()); return (rows || []).sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""))).slice(0, options.limit || 100); },
      remove: (name, id) => request(name, "readwrite", (store) => store.delete(String(id))).then(() => true),
      clear: (name) => request(name, "readwrite", (store) => store.clear())
    });
  }

  async function createStorage(environment = globalScope || {}) {
    if (environment.indexedDB) {
      try { const adapter = createIndexedDbAdapter(environment.indexedDB); await adapter.list("tasks", { limit: 1 }); return adapter; }
      catch { /* Fall through to bounded local storage. */ }
    }
    if (environment.localStorage) {
      try { environment.localStorage.setItem(`${STORAGE_PREFIX}.probe`, "1"); environment.localStorage.removeItem(`${STORAGE_PREFIX}.probe`); return createLocalStorageAdapter(environment.localStorage); }
      catch { /* Private mode can disable localStorage. */ }
    }
    return createMemoryStorage();
  }

  async function detectCapabilities(environment = globalScope || {}) {
    const navigatorRef = environment.navigator || {};
    return Object.freeze({
      animationFrame: typeof environment.requestAnimationFrame === "function",
      clipboard: Boolean(navigatorRef.clipboard),
      download: typeof environment.Blob === "function" && typeof environment.URL?.createObjectURL === "function",
      fileReader: typeof environment.FileReader === "function",
      indexedDB: Boolean(environment.indexedDB),
      mediaRecorder: typeof environment.MediaRecorder === "function" && Boolean(navigatorRef.mediaDevices?.getUserMedia),
      notifications: typeof environment.Notification === "function",
      opfs: typeof navigatorRef.storage?.getDirectory === "function",
      pwaInstall: "BeforeInstallPromptEvent" in environment || Boolean(environment.__hhPwaInstallPrompt),
      serviceWorker: Boolean(navigatorRef.serviceWorker),
      speechRecognition: Boolean(environment.SpeechRecognition || environment.webkitSpeechRecognition),
      speechSynthesis: Boolean(environment.speechSynthesis),
      worker: typeof environment.Worker === "function"
    });
  }

  async function checkRequirements(manifest, environment = globalScope || {}) {
    const available = await detectCapabilities(environment);
    const missingCapabilities = (manifest.capabilities || []).filter((name) => !available[name]);
    const permissionState = {};
    for (const permission of manifest.permissions || []) {
      if (permission === "notifications" && environment.Notification) permissionState[permission] = String(environment.Notification.permission || "prompt");
      else if (environment.navigator?.permissions?.query) {
        try { permissionState[permission] = (await environment.navigator.permissions.query({ name: permission })).state; }
        catch { permissionState[permission] = "prompt"; }
      } else permissionState[permission] = "unsupported";
    }
    const deniedPermissions = Object.entries(permissionState).filter(([, state]) => state === "denied").map(([name]) => name);
    return { supported: missingCapabilities.length === 0 && deniedPermissions.length === 0, available, missingCapabilities, permissionState, deniedPermissions };
  }

  class ToolRegistry {
    constructor(manifests = []) { this.items = new Map(); manifests.forEach((manifest) => this.register(manifest)); }
    register(candidate) { const manifest = validateManifest(candidate); if (this.items.has(manifest.id)) throw new ToolRuntimeError(`Tool already registered: ${manifest.id}`, "TOOL_ALREADY_REGISTERED"); this.items.set(manifest.id, manifest); return manifest; }
    get(id) { return this.items.get(String(id)) || null; }
    has(id) { return this.items.has(String(id)); }
    list(filter = {}) { return [...this.items.values()].filter((item) => (!filter.runtime || item.runtime === filter.runtime) && (!filter.group || item.group === filter.group)); }
  }

  class ToolRuntime {
    constructor(options = {}) {
      this.registry = options.registry || new ToolRegistry(options.manifests || []);
      this.storage = options.storage || createMemoryStorage();
      this.environment = options.environment || globalScope || {};
      this.fetch = options.fetch || this.environment.fetch?.bind(this.environment);
      this.adapters = new Map(Object.entries(options.adapters || {}));
      this.tasks = new Map();
      this.listeners = new Map();
    }
    registerAdapter(toolId, adapter) { if (typeof adapter !== "function" && typeof adapter?.run !== "function") throw new ToolRuntimeError("Adapter must be a function or expose run()", "INVALID_TOOL_ADAPTER"); this.adapters.set(toolId, adapter); return this; }
    on(event, listener) { if (!this.listeners.has(event)) this.listeners.set(event, new Set()); this.listeners.get(event).add(listener); return () => this.listeners.get(event)?.delete(listener); }
    emit(event, payload) { for (const listener of this.listeners.get(event) || []) { try { listener(clone(payload)); } catch { /* Listener errors never break a tool. */ } } }
    async log(task, level, message, meta = {}) { const row = { id: uid("log"), taskId: task.id, toolId: task.toolId, level, message: String(message).slice(0, 500), meta: redact(meta), createdAt: nowIso() }; await this.storage.put("logs", row); this.emit("log", row); return row; }
    async transition(task, next, extra = {}) {
      if (!STATES.includes(next) || !TRANSITIONS[task.state]?.includes(next)) throw new ToolRuntimeError(`Invalid transition ${task.state} -> ${next}`, "INVALID_TOOL_TRANSITION");
      task.state = next; task.updatedAt = nowIso(); Object.assign(task, redact(extra));
      await this.storage.put("tasks", task); this.emit("statechange", task); return task;
    }
    async run(toolId, input = {}, options = {}) {
      const manifest = this.registry.get(toolId);
      if (!manifest) throw new ToolRuntimeError(`Unknown tool: ${toolId}`, "TOOL_NOT_FOUND");
      const action = options.action || manifest.actions[0] || "run";
      if (!manifest.actions.includes(action)) throw new ToolRuntimeError(`Unsupported action: ${action}`, "TOOL_ACTION_NOT_SUPPORTED");
      const task = { id: uid("task"), toolId, action, state: "idle", progress: 0, input: redact(input), output: null, error: null, createdAt: nowIso(), updatedAt: nowIso() };
      this.tasks.set(task.id, task); await this.storage.put("tasks", task); await this.transition(task, "validating");
      const validation = validateInput(manifest, input);
      if (!validation.valid) { await this.transition(task, "error", { error: { code: "TOOL_INPUT_INVALID", details: validation.errors } }); await this.log(task, "error", "Input validation failed", { errors: validation.errors }); return clone(task); }
      const requirements = await checkRequirements(manifest, this.environment);
      if (!requirements.supported) { await this.transition(task, "error", { error: { code: "TOOL_UNSUPPORTED", details: requirements } }); await this.log(task, "error", "Capability or permission unavailable", requirements); return clone(task); }
      const controller = new AbortController(); task.controller = controller;
      try {
        if (manifest.runtime !== "browser") await this.transition(task, "queued");
        await this.transition(task, "running", { startedAt: nowIso(), progress: 1 });
        await this.log(task, "info", "Tool started", { action, runtime: manifest.runtime });
        const output = manifest.runtime === "browser" ? await this.runBrowser(manifest, action, input, task, controller.signal) : await this.runGateway(manifest, action, input, task, controller.signal);
        if (controller.signal.aborted) return clone(task);
        await this.transition(task, "success", { output: redact(output), progress: 100, finishedAt: nowIso() });
        await this.log(task, "success", "Tool completed", { action });
        if (manifest.history) await this.storage.put("history", { id: task.id, toolId, action, state: task.state, summary: String(options.summary || `${manifest.name}: ${action}`).slice(0, 300), createdAt: task.createdAt, updatedAt: task.updatedAt });
      } catch (error) {
        if (controller.signal.aborted) return clone(task);
        await this.transition(task, "error", { error: { code: error.code || "TOOL_EXECUTION_FAILED", message: String(error.message || "Tool failed").slice(0, 500) }, finishedAt: nowIso() });
        await this.log(task, "error", "Tool failed", { code: error.code || "TOOL_EXECUTION_FAILED" });
      } finally { delete task.controller; this.tasks.set(task.id, task); }
      return clone(task);
    }
    async runBrowser(manifest, action, input, task, signal) {
      const adapter = this.adapters.get(manifest.id);
      if (!adapter) throw new ToolRuntimeError("Tool chưa có engine trình duyệt.", "TOOL_ADAPTER_MISSING");
      const run = typeof adapter === "function" ? adapter : adapter.run.bind(adapter);
      return run({ action, input, manifest, signal, taskId: task.id, progress: (value, message = "") => this.progress(task.id, value, message) });
    }
    async runGateway(manifest, action, input, task, signal) {
      if (!this.fetch || !manifest.endpoint) throw new ToolRuntimeError("Gateway không khả dụng.", "TOOL_GATEWAY_UNAVAILABLE");
      const response = await this.fetch(manifest.endpoint, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "X-HH-Tool-Version": String(manifest.version) }, body: JSON.stringify({ toolId: manifest.id, action, input: redact(input), taskId: task.id }), signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new ToolRuntimeError(payload.error || "Gateway rejected the tool request", payload.code || "TOOL_GATEWAY_REJECTED");
      return payload;
    }
    async progress(taskId, value, message = "") { const task = this.tasks.get(taskId); if (!task || task.state !== "running") return null; task.progress = Math.max(0, Math.min(100, Number(value) || 0)); task.updatedAt = nowIso(); await this.storage.put("tasks", task); if (message) await this.log(task, "progress", message, { progress: task.progress }); this.emit("progress", task); return clone(task); }
    async cancel(taskId) {
      const task = this.tasks.get(String(taskId)) || await this.storage.get("tasks", String(taskId));
      if (!task || TERMINAL_STATES.has(task.state)) return task ? clone(task) : null;
      task.controller?.abort?.(); delete task.controller;
      await this.transition(task, "cancelled", { finishedAt: nowIso(), error: null });
      await this.log(task, "info", "Tool cancelled");
      const manifest = this.registry.get(task.toolId);
      if (manifest?.runtime !== "browser" && this.fetch) this.fetch(`/api/jobs?id=${encodeURIComponent(task.id)}`, { method: "DELETE", credentials: "include" }).catch(() => {});
      return clone(task);
    }
    async history(limit = 100) { return this.storage.list("history", { limit }); }
    async logs(taskId, limit = 200) { return (await this.storage.list("logs", { limit: 1000 })).filter((row) => !taskId || row.taskId === taskId).slice(0, limit); }
    async exportTask(taskId) { const task = this.tasks.get(String(taskId)) || await this.storage.get("tasks", String(taskId)); if (!task) throw new ToolRuntimeError("Task not found", "TOOL_TASK_NOT_FOUND"); return JSON.stringify({ format: "HH Tool Task", version: 1, exportedAt: nowIso(), task: redact(task), logs: await this.logs(task.id) }, null, 2); }
  }

  async function createRuntime(options = {}) {
    const storage = options.storage || await createStorage(options.environment || globalScope || {});
    return new ToolRuntime({ ...options, storage });
  }

  const api = Object.freeze({ STATES, TRANSITIONS, ToolRuntimeError, ToolRegistry, ToolRuntime, validateManifest, validateInput, redact, detectCapabilities, checkRequirements, createStorage, createMemoryStorage, createRuntime });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope) globalScope.HHToolRuntime = api;
})(typeof window !== "undefined" ? window : globalThis);
