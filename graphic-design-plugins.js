(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const FORMAT = "hh-graphic-plugin-package";
  const REGISTRY_FORMAT = "hh-graphic-plugin-registry";
  const STORAGE_KEY = "hh.graphic-plugins.registry.v1";
  const STYLE_ID = "hh-graphic-plugins-style-v1";
  const PREVIEW_CHANNEL = "hh.graphic-plugins.preview.v1";
  const MAX_PACKAGE_BYTES = 512 * 1024;
  const MAX_EXTENSIONS = 64;
  const MAX_AUDIT_ENTRIES = 200;
  const MAX_CONTRIBUTIONS = 100;
  const instances = new WeakMap();

  const PERMISSIONS = Object.freeze(["canvas", "layer", "selection", "export", "command"]);
  const PACK_TYPES = Object.freeze(["preset", "brush", "template", "effect", "character"]);
  const PACKAGE_TYPES = Object.freeze(["extension", ...PACK_TYPES.map((type) => `${type}-pack`)]);
  const PREVIEW_MESSAGE_TYPES = Object.freeze(["preview.ready", "command.request"]);
  const CONTRIBUTION_KEYS = Object.freeze({
    preset: "presets",
    brush: "brushes",
    template: "templates",
    effect: "effects",
    character: "characters"
  });
  const COMMAND_OPERATIONS = Object.freeze({
    "canvas.set-background": Object.freeze({ permission: "canvas", label: "Set canvas background" }),
    "canvas.resize": Object.freeze({ permission: "canvas", label: "Resize canvas" }),
    "layer.add": Object.freeze({ permission: "layer", label: "Add layer" }),
    "layer.rename": Object.freeze({ permission: "layer", label: "Rename layer" }),
    "selection.set": Object.freeze({ permission: "selection", label: "Set selection" }),
    "selection.clear": Object.freeze({ permission: "selection", label: "Clear selection" }),
    "export.snapshot": Object.freeze({ permission: "export", label: "Export snapshot" }),
    "command.notify": Object.freeze({ permission: "command", label: "Show notification" })
  });
  const FORBIDDEN_CODE_KEYS = new Set(["entry", "main", "script", "scripts", "module", "code", "handler", "runtime", "executable", "run"]);
  const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

  class PluginPackageError extends Error {
    constructor(errors) {
      super(Array.isArray(errors) && errors.length ? errors.join("; ") : "Invalid local plugin package.");
      this.name = "PluginPackageError";
      this.errors = Array.isArray(errors) ? [...errors] : [];
    }
  }

  class PluginPermissionError extends Error {
    constructor(permission) {
      super(`Permission '${permission}' was not granted.`);
      this.name = "PluginPermissionError";
      this.permission = permission;
    }
  }

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function nowIso(clock) {
    const value = typeof clock === "function" ? clock() : Date.now();
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }

  function isPlainObject(value) {
    if (!value || Object.prototype.toString.call(value) !== "[object Object]") return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function safeText(value, maximum, fallback) {
    const text = String(value == null ? "" : value).trim();
    return (text || String(fallback || "")).slice(0, maximum);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[character]));
  }

  function normalizeColor(value, fallback) {
    const color = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : fallback;
  }

  function clampNumber(value, minimum, maximum, fallback) {
    const number = Number(value);
    return Math.min(maximum, Math.max(minimum, Number.isFinite(number) ? number : fallback));
  }

  function inspectJsonValue(value, path, errors, seen, depth) {
    if (depth > 16) {
      errors.push(`${path} exceeds the maximum nesting depth.`);
      return;
    }
    if (value == null || typeof value === "string" || typeof value === "boolean") return;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) errors.push(`${path} must contain finite numbers.`);
      return;
    }
    if (typeof value !== "object") {
      errors.push(`${path} must be JSON data, not executable values.`);
      return;
    }
    if (seen.has(value)) {
      errors.push(`${path} must not contain circular references.`);
      return;
    }
    seen.add(value);
    if (Array.isArray(value)) {
      if (value.length > MAX_CONTRIBUTIONS * 4) errors.push(`${path} contains too many items.`);
      value.forEach((item, index) => inspectJsonValue(item, `${path}[${index}]`, errors, seen, depth + 1));
    } else if (!isPlainObject(value)) {
      errors.push(`${path} must be a plain JSON object.`);
    } else {
      Object.keys(value).forEach((key) => {
        if (DANGEROUS_KEYS.has(key)) errors.push(`${path}.${key} is not allowed.`);
        if (FORBIDDEN_CODE_KEYS.has(key)) errors.push(`${path}.${key} is not allowed; packages are declarative JSON only.`);
        inspectJsonValue(value[key], `${path}.${key}`, errors, seen, depth + 1);
      });
    }
    seen.delete(value);
  }

  function jsonErrors(value, path) {
    const errors = [];
    inspectJsonValue(value, path || "$", errors, new Set(), 0);
    return errors;
  }

  function normalizePackageType(value) {
    const type = String(value || "extension").trim().toLowerCase();
    if (type === "plugin") return "extension";
    if (PACK_TYPES.includes(type)) return `${type}-pack`;
    return type;
  }

  function contributionSource(source) {
    if (isPlainObject(source.contributes)) return source.contributes;
    if (isPlainObject(source.contributions)) return source.contributions;
    return {};
  }

  function normalizeContribution(item, type, pluginId, index) {
    const source = isPlainObject(item) ? item : {};
    const identifier = safeText(source.id, 100, `${pluginId}.${type}.${index + 1}`);
    return {
      ...clone(source),
      id: identifier,
      name: safeText(source.name || source.title, 100, `${type} ${index + 1}`),
      description: safeText(source.description, 400, "")
    };
  }

  function normalizeCommand(command) {
    const source = isPlainObject(command) ? command : {};
    return {
      id: safeText(source.id, 100, ""),
      title: safeText(source.title || source.name, 100, "Untitled command"),
      description: safeText(source.description, 300, ""),
      operation: safeText(source.operation || source.action, 80, ""),
      args: isPlainObject(source.args) ? clone(source.args) : {}
    };
  }

  function validateManifest(input) {
    const errors = [];
    if (!isPlainObject(input)) return { valid: false, errors: ["Manifest must be a JSON object."], manifest: null };
    const source = input;
    const id = safeText(source.id, 120, "");
    const name = safeText(source.name, 100, "");
    const version = safeText(source.version, 40, "");
    const type = normalizePackageType(source.type || source.kind);
    const permissions = Array.isArray(source.permissions) ? [...new Set(source.permissions.map((item) => String(item).trim().toLowerCase()))] : [];
    const contributes = contributionSource(source);

    if (!/^[a-z0-9](?:[a-z0-9._-]{1,118}[a-z0-9])?$/i.test(id)) errors.push("manifest.id must be a stable identifier using letters, numbers, dots, dashes or underscores.");
    if (!name) errors.push("manifest.name is required.");
    if (!/^\d+\.\d+\.\d+(?:-[0-9a-z.-]+)?$/i.test(version)) errors.push("manifest.version must use semantic versioning such as 1.0.0.");
    if (!PACKAGE_TYPES.includes(type)) errors.push(`manifest.type must be one of: ${PACKAGE_TYPES.join(", ")}.`);
    if (!Array.isArray(source.permissions)) errors.push("manifest.permissions must be an array.");
    permissions.filter((permission) => !PERMISSIONS.includes(permission)).forEach((permission) => errors.push(`Unknown permission '${permission}'.`));
    Object.keys(source).filter((key) => FORBIDDEN_CODE_KEYS.has(key)).forEach((key) => errors.push(`manifest.${key} is not allowed; packages are declarative JSON only.`));
    errors.push(...jsonErrors(source, "manifest"));

    const commandInputs = Array.isArray(contributes.commands) ? contributes.commands : [];
    if (contributes.commands != null && !Array.isArray(contributes.commands)) errors.push("manifest.contributes.commands must be an array.");
    if (commandInputs.length > MAX_CONTRIBUTIONS) errors.push(`A package may contribute at most ${MAX_CONTRIBUTIONS} commands.`);
    const commands = commandInputs.slice(0, MAX_CONTRIBUTIONS).map(normalizeCommand);
    const commandIds = new Set();
    commands.forEach((command, index) => {
      const path = `manifest.contributes.commands[${index}]`;
      const raw = commandInputs[index];
      if (!isPlainObject(raw)) errors.push(`${path} must be an object.`);
      if (!/^[a-z0-9][a-z0-9._:-]{1,99}$/i.test(command.id)) errors.push(`${path}.id is invalid.`);
      if (commandIds.has(command.id)) errors.push(`${path}.id must be unique.`);
      commandIds.add(command.id);
      if (!COMMAND_OPERATIONS[command.operation]) errors.push(`${path}.operation is not in the command allowlist.`);
      Object.keys(isPlainObject(raw) ? raw : {}).filter((key) => FORBIDDEN_CODE_KEYS.has(key)).forEach((key) => errors.push(`${path}.${key} is not allowed.`));
      if (raw && raw.args != null && !isPlainObject(raw.args)) errors.push(`${path}.args must be a JSON object.`);
      if (!permissions.includes("command")) errors.push(`${path} requires the 'command' permission.`);
      const operationPermission = COMMAND_OPERATIONS[command.operation] && COMMAND_OPERATIONS[command.operation].permission;
      if (operationPermission && !permissions.includes(operationPermission)) errors.push(`${path} requires the '${operationPermission}' permission.`);
    });

    const normalizedContributions = { commands };
    PACK_TYPES.forEach((packType) => {
      const key = CONTRIBUTION_KEYS[packType];
      const items = contributes[key] == null ? [] : contributes[key];
      if (!Array.isArray(items)) {
        errors.push(`manifest.contributes.${key} must be an array.`);
        normalizedContributions[key] = [];
        return;
      }
      if (items.length > MAX_CONTRIBUTIONS) errors.push(`A package may contribute at most ${MAX_CONTRIBUTIONS} ${key}.`);
      const normalizedItems = items.slice(0, MAX_CONTRIBUTIONS).map((item, index) => normalizeContribution(item, packType, id || "plugin", index));
      const ids = new Set();
      normalizedItems.forEach((item, index) => {
        if (!isPlainObject(items[index])) errors.push(`manifest.contributes.${key}[${index}] must be an object.`);
        if (!/^[a-z0-9][a-z0-9._:-]{1,99}$/i.test(item.id)) errors.push(`manifest.contributes.${key}[${index}].id is invalid.`);
        if (ids.has(item.id)) errors.push(`manifest.contributes.${key}[${index}].id must be unique.`);
        ids.add(item.id);
      });
      normalizedContributions[key] = normalizedItems;
    });

    if (type !== "extension") {
      const packType = type.replace(/-pack$/, "");
      const key = CONTRIBUTION_KEYS[packType];
      if (!normalizedContributions[key] || normalizedContributions[key].length === 0) errors.push(`${type} must include at least one ${key} contribution.`);
    }

    const manifest = {
      id,
      name,
      version,
      type,
      description: safeText(source.description, 500, ""),
      author: safeText(source.author, 100, "Local package"),
      permissions: permissions.filter((permission) => PERMISSIONS.includes(permission)),
      preview: {
        title: safeText(source.preview && source.preview.title, 100, name || "Extension preview"),
        body: safeText(source.preview && source.preview.body, 500, source.description || "Local declarative extension"),
        accent: normalizeColor(source.preview && source.preview.accent, "#65DCE8")
      },
      contributes: normalizedContributions
    };
    return { valid: errors.length === 0, errors: [...new Set(errors)], manifest: errors.length === 0 ? manifest : null };
  }

  function parsePackageInput(input) {
    if (typeof input === "string") {
      if (input.length > MAX_PACKAGE_BYTES) throw new PluginPackageError([`Package exceeds ${MAX_PACKAGE_BYTES} bytes.`]);
      try {
        return JSON.parse(input);
      } catch (_) {
        throw new PluginPackageError(["Package must contain valid JSON."]);
      }
    }
    return clone(input);
  }

  function validatePackage(input) {
    let source;
    try {
      source = parsePackageInput(input);
    } catch (error) {
      return { valid: false, errors: error.errors || [error.message], package: null };
    }
    const errors = [];
    if (!isPlainObject(source)) return { valid: false, errors: ["Package root must be a JSON object."], package: null };
    if (source.format !== FORMAT) errors.push(`Package format must be '${FORMAT}'.`);
    const packageVersion = Number(source.packageVersion ?? source.schemaVersion ?? source.version ?? VERSION);
    if (packageVersion !== VERSION) errors.push(`Package schema version ${packageVersion} is not supported.`);
    Object.keys(source).filter((key) => FORBIDDEN_CODE_KEYS.has(key)).forEach((key) => errors.push(`package.${key} is not allowed; packages cannot ship executable code.`));
    errors.push(...jsonErrors(source, "package"));
    const manifestInput = isPlainObject(source.manifest) ? clone(source.manifest) : source.manifest;
    if (isPlainObject(manifestInput) && !manifestInput.contributes && !manifestInput.contributions) {
      const topLevelContributions = source.contributes || source.contributions || source.packs;
      if (isPlainObject(topLevelContributions)) manifestInput.contributes = clone(topLevelContributions);
    }
    const manifestResult = validateManifest(manifestInput);
    errors.push(...manifestResult.errors);
    let serializedSize = 0;
    try { serializedSize = JSON.stringify(source).length; } catch (_) { serializedSize = MAX_PACKAGE_BYTES + 1; }
    if (serializedSize > MAX_PACKAGE_BYTES) errors.push(`Package exceeds ${MAX_PACKAGE_BYTES} bytes.`);
    return {
      valid: errors.length === 0,
      errors: [...new Set(errors)],
      package: errors.length === 0 ? { format: FORMAT, version: VERSION, manifest: manifestResult.manifest } : null
    };
  }

  function parseLocalPackage(input) {
    const result = validatePackage(input);
    if (!result.valid) throw new PluginPackageError(result.errors);
    return clone(result.package);
  }

  function createMemoryHost(initialState) {
    const source = isPlainObject(initialState) ? initialState : {};
    const state = {
      canvas: {
        width: Math.round(clampNumber(source.canvas && source.canvas.width, 64, 16384, 1080)),
        height: Math.round(clampNumber(source.canvas && source.canvas.height, 64, 16384, 1080)),
        background: normalizeColor(source.canvas && source.canvas.background, "#111827")
      },
      layers: Array.isArray(source.layers) ? clone(source.layers).slice(0, 1000) : [],
      selection: Array.isArray(source.selection) ? source.selection.map(String).slice(0, 1000) : [],
      exports: [],
      notifications: []
    };
    const host = {
      canvas: {
        getSize: () => ({ width: state.canvas.width, height: state.canvas.height }),
        setBackground(color) { state.canvas.background = normalizeColor(color, state.canvas.background); return clone(state.canvas); },
        resize(width, height) {
          state.canvas.width = Math.round(clampNumber(width, 64, 16384, state.canvas.width));
          state.canvas.height = Math.round(clampNumber(height, 64, 16384, state.canvas.height));
          return clone(state.canvas);
        }
      },
      layer: {
        list: () => clone(state.layers),
        add(layer) {
          const next = {
            id: safeText(layer && layer.id, 100, uid("layer")),
            name: safeText(layer && layer.name, 100, "Plugin layer"),
            type: ["shape", "text", "image", "group"].includes(layer && layer.type) ? layer.type : "shape"
          };
          state.layers.push(next);
          return clone(next);
        },
        rename(id, name) {
          const layer = state.layers.find((item) => item.id === String(id));
          if (!layer) throw new Error(`Layer '${String(id)}' was not found.`);
          layer.name = safeText(name, 100, layer.name);
          return clone(layer);
        }
      },
      selection: {
        get: () => [...state.selection],
        set(ids) { state.selection = [...new Set((Array.isArray(ids) ? ids : []).map(String))].slice(0, 1000); return [...state.selection]; },
        clear() { state.selection = []; return []; }
      },
      export: {
        snapshot(label) {
          const snapshot = { label: safeText(label, 100, "Plugin snapshot"), canvas: clone(state.canvas), layers: clone(state.layers), selection: [...state.selection] };
          state.exports.push(snapshot);
          return clone(snapshot);
        }
      },
      command: {
        notify(message) { const text = safeText(message, 240, "Command completed."); state.notifications.push(text); return text; }
      },
      getState: () => clone(state)
    };
    return Object.freeze(host);
  }

  function hostCall(host, capability, method, args) {
    const target = host && host[capability];
    if (!target || typeof target[method] !== "function") throw new Error(`Host capability '${capability}.${method}' is unsupported.`);
    return target[method](...args);
  }

  function createCapabilityApi(permissionInput, hostInput) {
    const granted = new Set((Array.isArray(permissionInput) ? permissionInput : []).filter((permission) => PERMISSIONS.includes(permission)));
    const host = hostInput || createMemoryHost();
    const guard = (permission, callback) => (...args) => {
      if (!granted.has(permission)) throw new PluginPermissionError(permission);
      return callback(...args);
    };
    const canvas = Object.freeze({
      allowed: granted.has("canvas"),
      getSize: guard("canvas", () => hostCall(host, "canvas", "getSize", [])),
      setBackground: guard("canvas", (color) => hostCall(host, "canvas", "setBackground", [normalizeColor(color, "#111827")])),
      resize: guard("canvas", (width, height) => hostCall(host, "canvas", "resize", [width, height]))
    });
    const layer = Object.freeze({
      allowed: granted.has("layer"),
      list: guard("layer", () => hostCall(host, "layer", "list", [])),
      add: guard("layer", (value) => hostCall(host, "layer", "add", [isPlainObject(value) ? clone(value) : {}])),
      rename: guard("layer", (id, name) => hostCall(host, "layer", "rename", [String(id), safeText(name, 100, "Layer")]))
    });
    const selection = Object.freeze({
      allowed: granted.has("selection"),
      get: guard("selection", () => hostCall(host, "selection", "get", [])),
      set: guard("selection", (ids) => hostCall(host, "selection", "set", [Array.isArray(ids) ? ids.map(String) : []])),
      clear: guard("selection", () => hostCall(host, "selection", "clear", []))
    });
    const exportCapability = Object.freeze({
      allowed: granted.has("export"),
      snapshot: guard("export", (label) => hostCall(host, "export", "snapshot", [safeText(label, 100, "Plugin snapshot")]))
    });
    const command = Object.freeze({
      allowed: granted.has("command"),
      notify: guard("command", (message) => hostCall(host, "command", "notify", [safeText(message, 240, "Command completed.")]))
    });
    return Object.freeze({
      permissions: Object.freeze([...granted]),
      can: (permission) => granted.has(permission),
      canvas,
      layer,
      selection,
      export: exportCapability,
      command
    });
  }

  function executeDeclarativeCommand(commandInput, permissions, host, runtimeArgs) {
    const command = normalizeCommand(commandInput);
    const definition = COMMAND_OPERATIONS[command.operation];
    if (!definition) throw new Error(`Command operation '${command.operation}' is unsupported.`);
    const capabilities = createCapabilityApi(permissions, host);
    if (!capabilities.can("command")) throw new PluginPermissionError("command");
    if (!capabilities.can(definition.permission)) throw new PluginPermissionError(definition.permission);
    const args = { ...command.args, ...(isPlainObject(runtimeArgs) ? runtimeArgs : {}) };
    switch (command.operation) {
      case "canvas.set-background": return capabilities.canvas.setBackground(args.color);
      case "canvas.resize": return capabilities.canvas.resize(args.width, args.height);
      case "layer.add": return capabilities.layer.add(args.layer || args);
      case "layer.rename": return capabilities.layer.rename(args.id, args.name);
      case "selection.set": return capabilities.selection.set(args.ids);
      case "selection.clear": return capabilities.selection.clear();
      case "export.snapshot": return capabilities.export.snapshot(args.label);
      case "command.notify": return capabilities.command.notify(args.message);
      default: throw new Error(`Command operation '${command.operation}' is unsupported.`);
    }
  }

  function storageWorks(storage) {
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function" || typeof storage.removeItem !== "function") return false;
    const probe = `${STORAGE_KEY}.probe`;
    try {
      storage.setItem(probe, "1");
      storage.removeItem(probe);
      return true;
    } catch (_) {
      return false;
    }
  }

  function defaultStorage() {
    try { return globalScope.localStorage; } catch (_) { return null; }
  }

  function normalizeStoredExtension(value) {
    if (!isPlainObject(value) || !isPlainObject(value.manifest)) return null;
    const result = validateManifest(value.manifest);
    if (!result.valid) return null;
    return {
      manifest: result.manifest,
      enabled: value.enabled !== false,
      installedAt: safeText(value.installedAt, 40, new Date().toISOString()),
      updatedAt: safeText(value.updatedAt, 40, new Date().toISOString()),
      source: "local-json"
    };
  }

  function createRegistry(options) {
    const settings = options || {};
    const clock = settings.clock;
    const host = settings.host || createMemoryHost(settings.hostState);
    const storage = Object.prototype.hasOwnProperty.call(settings, "storage") ? settings.storage : defaultStorage();
    let backend = storageWorks(storage) ? "localStorage" : "memory";
    let state = { format: REGISTRY_FORMAT, version: VERSION, extensions: [], audit: [] };
    const listeners = new Set();

    if (backend === "localStorage") {
      try {
        const parsed = JSON.parse(storage.getItem(settings.storageKey || STORAGE_KEY) || "null");
        if (parsed && parsed.format === REGISTRY_FORMAT && parsed.version === VERSION) {
          state.extensions = Array.isArray(parsed.extensions) ? parsed.extensions.map(normalizeStoredExtension).filter(Boolean).slice(0, MAX_EXTENSIONS) : [];
          state.audit = Array.isArray(parsed.audit) ? parsed.audit.filter(isPlainObject).map((entry) => ({
            id: safeText(entry.id, 100, uid("audit")),
            timestamp: safeText(entry.timestamp, 40, nowIso(clock)),
            action: safeText(entry.action, 80, "unknown"),
            pluginId: safeText(entry.pluginId, 120, "system"),
            status: entry.status === "denied" || entry.status === "error" ? entry.status : "ok",
            detail: safeText(entry.detail, 500, "")
          })).slice(0, MAX_AUDIT_ENTRIES) : [];
        }
      } catch (_) {
        state = { format: REGISTRY_FORMAT, version: VERSION, extensions: [], audit: [] };
      }
    }

    function persist() {
      if (backend !== "localStorage") return false;
      try {
        storage.setItem(settings.storageKey || STORAGE_KEY, JSON.stringify(state));
        return true;
      } catch (_) {
        backend = "memory";
        return false;
      }
    }

    function notify() {
      const snapshot = getSnapshot();
      listeners.forEach((listener) => {
        try { listener(snapshot); } catch (_) { /* Listener errors do not break the registry. */ }
      });
    }

    function record(action, pluginId, detail, status) {
      state.audit.unshift({
        id: uid("audit"),
        timestamp: nowIso(clock),
        action: safeText(action, 80, "unknown"),
        pluginId: safeText(pluginId, 120, "system"),
        status: status === "denied" || status === "error" ? status : "ok",
        detail: safeText(detail, 500, "")
      });
      state.audit = state.audit.slice(0, MAX_AUDIT_ENTRIES);
    }

    function commit() {
      persist();
      notify();
    }

    function getSnapshot() {
      return clone(state);
    }

    function get(id) {
      const item = state.extensions.find((extension) => extension.manifest.id === String(id));
      return item ? clone(item) : null;
    }

    function list(filter) {
      const settingsFilter = filter || {};
      return state.extensions.filter((extension) => {
        if (settingsFilter.enabled != null && extension.enabled !== Boolean(settingsFilter.enabled)) return false;
        if (settingsFilter.type && extension.manifest.type !== settingsFilter.type) return false;
        return true;
      }).map(clone);
    }

    function install(input) {
      let parsed;
      try {
        parsed = parseLocalPackage(input);
      } catch (error) {
        record("install", "local-package", safeText(error && error.message, 500, "Package validation failed."), "denied");
        commit();
        throw error;
      }
      const manifest = parsed.manifest;
      const index = state.extensions.findIndex((extension) => extension.manifest.id === manifest.id);
      const timestamp = nowIso(clock);
      const existing = index >= 0 ? state.extensions[index] : null;
      const installed = {
        manifest,
        enabled: existing ? existing.enabled : true,
        installedAt: existing ? existing.installedAt : timestamp,
        updatedAt: timestamp,
        source: "local-json"
      };
      if (index >= 0) state.extensions.splice(index, 1, installed);
      else {
        if (state.extensions.length >= MAX_EXTENSIONS) throw new Error(`Registry limit of ${MAX_EXTENSIONS} extensions reached.`);
        state.extensions.unshift(installed);
      }
      record(existing ? "update" : "install", manifest.id, `${manifest.name} ${manifest.version}`);
      commit();
      return clone(installed);
    }

    function setEnabled(id, enabled) {
      const item = state.extensions.find((extension) => extension.manifest.id === String(id));
      if (!item) throw new Error(`Extension '${String(id)}' is not installed.`);
      item.enabled = Boolean(enabled);
      item.updatedAt = nowIso(clock);
      record(item.enabled ? "enable" : "disable", item.manifest.id, item.manifest.name);
      commit();
      return clone(item);
    }

    function uninstall(id) {
      const index = state.extensions.findIndex((extension) => extension.manifest.id === String(id));
      if (index < 0) return false;
      const [removed] = state.extensions.splice(index, 1);
      record("uninstall", removed.manifest.id, removed.manifest.name);
      commit();
      return true;
    }

    function listContributions(type, optionsInput) {
      const key = type === "command" ? "commands" : CONTRIBUTION_KEYS[type];
      if (!key) return [];
      const includeDisabled = Boolean(optionsInput && optionsInput.includeDisabled);
      return state.extensions.flatMap((extension) => {
        if (!includeDisabled && !extension.enabled) return [];
        const items = extension.manifest.contributes[key] || [];
        return items.map((item) => ({
          ...clone(item),
          pluginId: extension.manifest.id,
          pluginName: extension.manifest.name,
          pluginVersion: extension.manifest.version,
          enabled: extension.enabled
        }));
      });
    }

    function findCommand(commandId, pluginId) {
      const candidates = state.extensions.filter((extension) => !pluginId || extension.manifest.id === pluginId);
      for (const extension of candidates) {
        const command = extension.manifest.contributes.commands.find((item) => item.id === commandId);
        if (command) return { extension, command };
      }
      return null;
    }

    function executeCommand(commandId, context) {
      const runtime = isPlainObject(context) ? context : {};
      const found = findCommand(String(commandId), runtime.pluginId && String(runtime.pluginId));
      if (!found) {
        record("command", runtime.pluginId || "unknown", `${String(commandId)}: not found`, "denied");
        commit();
        throw new Error(`Command '${String(commandId)}' was not found.`);
      }
      if (!found.extension.enabled) {
        record("command", found.extension.manifest.id, `${commandId}: extension disabled`, "denied");
        commit();
        throw new Error(`Extension '${found.extension.manifest.id}' is disabled.`);
      }
      try {
        const result = executeDeclarativeCommand(found.command, found.extension.manifest.permissions, host, runtime.args);
        if (result && typeof result.then === "function") {
          return result.then((value) => {
            record("command", found.extension.manifest.id, `${commandId}: ${found.command.operation}`);
            commit();
            return value;
          }, (error) => {
            record("command", found.extension.manifest.id, `${commandId}: ${safeText(error && error.message, 300, "failed")}`, "error");
            commit();
            throw error;
          });
        }
        record("command", found.extension.manifest.id, `${commandId}: ${found.command.operation}`);
        commit();
        return clone(result);
      } catch (error) {
        record("command", found.extension.manifest.id, `${commandId}: ${safeText(error && error.message, 300, "failed")}`, error instanceof PluginPermissionError ? "denied" : "error");
        commit();
        throw error;
      }
    }

    function getAuditLog(filter) {
      const pluginId = filter && filter.pluginId;
      const action = filter && filter.action;
      return state.audit.filter((entry) => (!pluginId || entry.pluginId === pluginId) && (!action || entry.action === action)).map(clone);
    }

    function clearAudit() {
      state.audit = [];
      commit();
    }

    function subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    }

    const registry = {
      get backend() { return backend; },
      host,
      install,
      installPackage: install,
      get,
      getExtension: get,
      list,
      listExtensions: list,
      enable: (id) => setEnabled(id, true),
      disable: (id) => setEnabled(id, false),
      setEnabled,
      uninstall,
      listContributions,
      getCommands: (optionsInput) => listContributions("command", optionsInput),
      executeCommand,
      runCommand: executeCommand,
      getAuditLog,
      clearAudit,
      getSnapshot,
      exportState: () => JSON.stringify(getSnapshot(), null, 2),
      subscribe,
      destroy: () => listeners.clear()
    };
    return Object.freeze(registry);
  }

  function detectCapabilities(scopeInput) {
    const scope = scopeInput || globalScope;
    let storage = null;
    try { storage = scope.localStorage; } catch (_) { storage = null; }
    const doc = scope.document;
    let iframeSandbox = false;
    if (doc && typeof doc.createElement === "function") {
      try {
        const iframe = doc.createElement("iframe");
        iframeSandbox = "sandbox" in iframe && "srcdoc" in iframe;
      } catch (_) { iframeSandbox = false; }
    }
    const capabilities = {
      localStorage: storageWorks(storage),
      fileReader: typeof scope.FileReader === "function",
      iframeSandbox,
      postMessage: typeof scope.postMessage === "function",
      localJson: typeof JSON === "object" && typeof JSON.parse === "function"
    };
    capabilities.preview = capabilities.iframeSandbox && capabilities.postMessage;
    capabilities.unsupported = Object.keys(capabilities).filter((key) => key !== "unsupported" && capabilities[key] === false);
    return capabilities;
  }

  function manifestFromPreviewInput(input) {
    if (input && input.manifest) return input.manifest;
    if (input && input.package && input.package.manifest) return input.package.manifest;
    return input || {};
  }

  function createPreviewDocument(input) {
    const manifestResult = validateManifest(manifestFromPreviewInput(input));
    if (!manifestResult.valid) throw new PluginPackageError(manifestResult.errors);
    const manifest = manifestResult.manifest;
    const commands = manifest.contributes.commands;
    const packCount = PACK_TYPES.reduce((total, type) => total + manifest.contributes[CONTRIBUTION_KEYS[type]].length, 0);
    const commandButtons = commands.length ? commands.map((command) => `<button type="button" data-command="${escapeHtml(command.id)}">${escapeHtml(command.title)}</button>`).join("") : `<p class="empty">No commands in this package.</p>`;
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><title>${escapeHtml(manifest.preview.title)}</title><style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;padding:18px;color:#edf7ff;background:#0b111b;font:500 14px/1.5 system-ui,sans-serif}main{max-width:520px;margin:auto}header{padding-bottom:14px;border-bottom:3px solid ${manifest.preview.accent}}h1{margin:0;font-size:20px;overflow-wrap:anywhere}p{color:#a8b7c7;overflow-wrap:anywhere}.meta{font-size:12px}.commands{display:grid;gap:8px;margin-top:16px}button{min-height:42px;padding:9px 12px;border:1px solid #496176;border-radius:6px;color:#edf7ff;background:#152333;text-align:left;font:inherit;cursor:pointer}button:focus-visible{outline:3px solid ${manifest.preview.accent};outline-offset:2px}.empty{padding:12px;border:1px dashed #496176;border-radius:6px}@media(max-width:375px){body{padding:12px}h1{font-size:18px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}</style></head><body><main><header><h1>${escapeHtml(manifest.preview.title)}</h1><p>${escapeHtml(manifest.preview.body)}</p><div class="meta">${escapeHtml(manifest.type)} | ${packCount} pack items | ${commands.length} commands</div></header><section class="commands" aria-label="Extension commands">${commandButtons}</section></main><script>"use strict";document.addEventListener("click",function(event){var button=event.target.closest("[data-command]");if(!button)return;parent.postMessage({channel:"${PREVIEW_CHANNEL}",type:"command.request",pluginId:"${escapeHtml(manifest.id)}",commandId:button.getAttribute("data-command")},"*");});parent.postMessage({channel:"${PREVIEW_CHANNEL}",type:"preview.ready",pluginId:"${escapeHtml(manifest.id)}"},"*");</script></body></html>`;
  }

  function isAllowedPreviewMessage(event, iframe, pluginId, commandIds) {
    if (!event || !isPlainObject(event.data)) return false;
    if (iframe && (!iframe.contentWindow || event.source !== iframe.contentWindow)) return false;
    if (event.origin !== "null") return false;
    const data = event.data;
    if (data.channel !== PREVIEW_CHANNEL || !PREVIEW_MESSAGE_TYPES.includes(data.type)) return false;
    if (data.pluginId !== pluginId) return false;
    if (data.type === "command.request") {
      if (typeof data.commandId !== "string") return false;
      if (Array.isArray(commandIds) && !commandIds.includes(data.commandId)) return false;
    }
    return true;
  }

  const DEMO_PACKAGE = Object.freeze({
    format: FORMAT,
    version: VERSION,
    manifest: Object.freeze({
      id: "hh.demo.brand-tools",
      name: "HH Brand Tools",
      version: "1.0.0",
      type: "extension",
      description: "A local declarative command and pack demo.",
      author: "HH Local SDK",
      permissions: Object.freeze(["canvas", "layer", "selection", "export", "command"]),
      preview: Object.freeze({ title: "HH Brand Tools", body: "Run allowlisted commands against the local demo document.", accent: "#F25CB4" }),
      contributes: Object.freeze({
        commands: Object.freeze([
          Object.freeze({ id: "hh.brand.apply-background", title: "Apply brand background", operation: "canvas.set-background", args: Object.freeze({ color: "#12263A" }) }),
          Object.freeze({ id: "hh.brand.add-title", title: "Add title layer", operation: "layer.add", args: Object.freeze({ layer: Object.freeze({ id: "brand-title", name: "Brand title", type: "text" }) }) }),
          Object.freeze({ id: "hh.brand.export-snapshot", title: "Create JSON snapshot", operation: "export.snapshot", args: Object.freeze({ label: "Brand review" }) })
        ]),
        presets: Object.freeze([Object.freeze({ id: "hh.brand.social", name: "Social square", settings: Object.freeze({ width: 1080, height: 1080 }) })]),
        brushes: Object.freeze([Object.freeze({ id: "hh.brand.marker", name: "Brand marker", settings: Object.freeze({ size: 18, hardness: 0.7 }) })]),
        templates: Object.freeze([Object.freeze({ id: "hh.brand.cover", name: "Brand cover", settings: Object.freeze({ width: 1600, height: 900 }) })]),
        effects: Object.freeze([Object.freeze({ id: "hh.brand.shadow", name: "Soft shadow", settings: Object.freeze({ blur: 24, opacity: 0.28 }) })]),
        characters: Object.freeze([Object.freeze({ id: "hh.brand.guide", name: "Brand guide", settings: Object.freeze({ pose: "present" }) })])
      })
    })
  });

  function addStyles(doc) {
    if (!doc || doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .hgp{--cyan:#65dce8;--pink:#f25cb4;--lime:#bde879;--ink:#091019;--panel:#111a25;--line:#2b3b4b;--muted:#99aabd;color:#eef8ff;background:#080d14;border:1px solid var(--line);border-radius:8px;overflow:hidden;font:500 13px/1.45 Inter,system-ui,sans-serif}.hgp *{box-sizing:border-box}.hgp button,.hgp input,.hgp select{font:inherit}.hgp button,.hgp select{min-height:36px;border:1px solid #3d556a;border-radius:6px;color:#eef8ff;background:#142232}.hgp button{padding:7px 10px;cursor:pointer}.hgp button:hover:not(:disabled){border-color:var(--cyan)}.hgp button:focus-visible,.hgp input:focus-visible,.hgp select:focus-visible,.hgp [tabindex]:focus-visible{outline:3px solid rgba(101,220,232,.45);outline-offset:2px}.hgp button:disabled{opacity:.5;cursor:not-allowed}.hgp-head{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line);background:#0d1621}.hgp-mark{display:grid;place-items:center;width:40px;height:40px;border:1px solid var(--pink);border-radius:6px;color:var(--pink);font-weight:900}.hgp-head h2{margin:0;font-size:18px;letter-spacing:0}.hgp-head p{margin:2px 0 0;color:var(--muted);font-size:11px}.hgp-actions{display:flex;gap:7px;margin-left:auto;flex-wrap:wrap}.hgp-primary{border-color:var(--cyan)!important;background:var(--cyan)!important;color:#071018!important;font-weight:800}.hgp-grid{display:grid;grid-template-columns:260px minmax(320px,1fr) 300px;min-height:620px}.hgp-pane{min-width:0;padding:13px;border-right:1px solid var(--line);background:#0b121b}.hgp-pane:last-child{border-right:0}.hgp-pane h3{margin:0 0 10px;color:var(--cyan);font-size:11px;text-transform:uppercase;letter-spacing:0}.hgp-list,.hgp-stack{display:grid;gap:8px}.hgp-card{min-width:0;padding:10px;border:1px solid var(--line);border-radius:7px;background:var(--panel)}.hgp-card.is-selected{border-color:var(--pink)}.hgp-card-head{display:flex;align-items:flex-start;gap:7px}.hgp-card-head button{min-width:0;flex:1;text-align:left}.hgp-card strong,.hgp-card span{overflow-wrap:anywhere}.hgp-meta{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.hgp-badge{display:inline-flex;align-items:center;min-height:24px;padding:2px 6px;border:1px solid #40586c;border-radius:999px;color:var(--muted);font-size:10px}.hgp-badge.is-on{border-color:var(--lime);color:var(--lime)}.hgp-switch{display:flex;align-items:center;gap:5px;color:var(--muted);font-size:11px}.hgp-switch input{width:18px;height:18px;accent-color:var(--cyan)}.hgp-card-actions{display:flex;gap:6px;margin-top:8px}.hgp-card-actions>*{flex:1}.hgp-work{display:grid;grid-template-rows:auto minmax(280px,1fr) auto;min-width:0;background:#080d14}.hgp-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:11px 13px;border-bottom:1px solid var(--line)}.hgp-toolbar label{min-width:180px;flex:1}.hgp-toolbar select{width:100%;padding:7px}.hgp-preview{display:grid;place-items:center;min-width:0;padding:14px;background:#0a1018}.hgp-preview iframe{width:min(100%,620px);height:360px;border:1px solid #3d556a;border-radius:7px;background:#0b111b}.hgp-empty{padding:24px 12px;color:var(--muted);text-align:center;border:1px dashed #40586c;border-radius:7px;overflow-wrap:anywhere}.hgp-output{margin:0;padding:10px 13px;border-top:1px solid var(--line);color:var(--muted);font:500 11px/1.5 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere}.hgp-pack{display:grid;grid-template-columns:66px 1fr;gap:8px;padding:7px 0;border-bottom:1px solid #21303f}.hgp-pack b{color:var(--pink);font-size:10px;text-transform:uppercase}.hgp-pack small,.hgp-audit small{display:block;color:var(--muted);overflow-wrap:anywhere}.hgp-audit{padding:7px 0;border-bottom:1px solid #21303f}.hgp-audit span{color:var(--lime);font-size:10px}.hgp-audit.is-error span{color:#ff9b9b}.hgp-status{display:flex;gap:10px;justify-content:space-between;padding:9px 13px;border-top:1px solid var(--line);color:var(--muted);font-size:11px}.hgp-drop.is-over{border-color:var(--cyan);background:#102434}.hgp-sr{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important}
      @media(max-width:980px){.hgp-grid{grid-template-columns:230px 1fr}.hgp-pane:last-child{grid-column:1/-1;border-top:1px solid var(--line);display:grid;grid-template-columns:1fr 1fr;gap:14px}}
      @media(max-width:620px){.hgp{width:100%;overflow-x:hidden}.hgp-head{align-items:flex-start;flex-wrap:wrap}.hgp-actions{width:100%;margin-left:0}.hgp-actions button{flex:1 1 130px}.hgp-grid{display:block}.hgp-pane{border-right:0;border-bottom:1px solid var(--line)}.hgp-pane:last-child{display:block}.hgp-toolbar{align-items:stretch}.hgp-toolbar>*{width:100%}.hgp-preview{padding:9px}.hgp-preview iframe{height:390px}.hgp-status{display:block}.hgp-status span{display:block;margin-top:3px}}
      @media(max-width:420px){.hgp-head{padding:12px}.hgp-pane{padding:10px}.hgp-card-actions{flex-wrap:wrap}.hgp-card-actions>*{flex:1 1 110px}.hgp-preview iframe{height:420px}.hgp-toolbar label{min-width:0}}
      @media(prefers-reduced-motion:reduce){.hgp *{animation-duration:.001ms!important;transition-duration:.001ms!important;scroll-behavior:auto!important}}
    `;
    doc.head.appendChild(style);
  }

  function mount(root, options) {
    if (!root || typeof root.querySelector !== "function") return null;
    if (instances.has(root)) return instances.get(root);
    const settings = options || {};
    const doc = root.ownerDocument || globalScope.document;
    const view = doc && doc.defaultView || globalScope;
    addStyles(doc);
    const registry = settings.registry || createRegistry({
      storage: Object.prototype.hasOwnProperty.call(settings, "storage") ? settings.storage : (() => { try { return view.localStorage; } catch (_) { return null; } })(),
      storageKey: settings.storageKey,
      host: settings.host,
      hostState: settings.hostState
    });
    const capabilityReport = detectCapabilities(view);
    let selectedId = settings.selectedId || registry.list()[0]?.manifest.id || null;
    let previewFrame = null;
    let commandOutput = "No command has run in this session.";
    let destroyed = false;
    let suppressRegistryRender = false;

    root.classList.add("hgp");

    function selectedExtension() {
      return selectedId ? registry.get(selectedId) : null;
    }

    function setStatus(message) {
      const status = root.querySelector("[data-hgp-status]");
      if (status) status.textContent = safeText(message, 300, "Ready.");
    }

    function extensionMarkup(extension) {
      const manifest = extension.manifest;
      return `<article class="hgp-card ${manifest.id === selectedId ? "is-selected" : ""}"><div class="hgp-card-head"><button type="button" data-hgp-select="${escapeHtml(manifest.id)}"><strong>${escapeHtml(manifest.name)}</strong><span class="hgp-sr">Select extension</span></button><label class="hgp-switch"><input type="checkbox" data-hgp-enabled="${escapeHtml(manifest.id)}" ${extension.enabled ? "checked" : ""}><span>${extension.enabled ? "On" : "Off"}</span></label></div><div class="hgp-meta"><span class="hgp-badge">${escapeHtml(manifest.version)}</span><span class="hgp-badge">${escapeHtml(manifest.type)}</span><span class="hgp-badge ${extension.enabled ? "is-on" : ""}">${extension.enabled ? "Enabled" : "Disabled"}</span></div><div class="hgp-card-actions"><button type="button" data-hgp-preview="${escapeHtml(manifest.id)}">Preview</button><button type="button" data-hgp-uninstall="${escapeHtml(manifest.id)}">Uninstall</button></div></article>`;
    }

    function packsMarkup() {
      const items = PACK_TYPES.flatMap((type) => registry.listContributions(type).map((item) => ({ ...item, packType: type })));
      if (!items.length) return `<div class="hgp-empty">No enabled pack items.</div>`;
      return items.slice(0, 40).map((item) => `<div class="hgp-pack"><b>${escapeHtml(item.packType)}</b><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.pluginName)}</small></div></div>`).join("");
    }

    function auditMarkup() {
      const entries = registry.getAuditLog().slice(0, 12);
      if (!entries.length) return `<div class="hgp-empty">Audit log is empty.</div>`;
      return entries.map((entry) => `<div class="hgp-audit ${entry.status === "ok" ? "" : "is-error"}"><span>${escapeHtml(entry.action)} | ${escapeHtml(entry.status)}</span><strong>${escapeHtml(entry.pluginId)}</strong><small>${escapeHtml(entry.detail)}</small></div>`).join("");
    }

    function render(message) {
      if (destroyed) return;
      const extensions = registry.list();
      if (selectedId && !extensions.some((extension) => extension.manifest.id === selectedId)) selectedId = extensions[0]?.manifest.id || null;
      const selected = selectedExtension();
      const commands = selected ? selected.manifest.contributes.commands : [];
      const storageLabel = registry.backend === "localStorage" ? "Saved locally" : "Memory only: localStorage unsupported";
      const previewLabel = capabilityReport.preview ? "Sandbox preview available" : "Sandbox preview unsupported";
      root.innerHTML = `<header class="hgp-head"><div class="hgp-mark" aria-hidden="true">PX</div><div><h2>Plugin & Extension SDK</h2><p>${escapeHtml(storageLabel)}</p></div><div class="hgp-actions"><button type="button" class="hgp-drop" data-hgp-install>Install local JSON</button><button type="button" class="hgp-primary" data-hgp-demo>Install demo</button></div></header><div class="hgp-grid"><aside class="hgp-pane" aria-label="Extension registry"><h3>Extension registry</h3><div class="hgp-list" data-hgp-extensions>${extensions.map(extensionMarkup).join("") || `<div class="hgp-empty">No local extensions installed.</div>`}</div></aside><main class="hgp-work"><div class="hgp-toolbar"><label>Command<select data-hgp-command ${!commands.length || !selected?.enabled ? "disabled" : ""}>${commands.map((command) => `<option value="${escapeHtml(command.id)}">${escapeHtml(command.title)}</option>`).join("") || `<option>No commands</option>`}</select></label><button type="button" data-hgp-run ${!commands.length || !selected?.enabled ? "disabled" : ""}>Run command</button></div><div class="hgp-preview" data-hgp-preview-slot>${selected ? (capabilityReport.preview ? `<iframe data-hgp-frame title="Sandbox preview for ${escapeHtml(selected.manifest.name)}" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe>` : `<div class="hgp-empty" role="alert">This browser cannot provide an isolated iframe sandbox preview.</div>`) : `<div class="hgp-empty">Select or install an extension.</div>`}</div><pre class="hgp-output" data-hgp-output>${escapeHtml(commandOutput)}</pre></main><aside class="hgp-pane"><section><h3>Enabled packs</h3><div data-hgp-packs>${packsMarkup()}</div></section><section><h3>Audit log</h3><div data-hgp-audit>${auditMarkup()}</div><button type="button" data-hgp-clear-audit ${registry.getAuditLog().length ? "" : "disabled"}>Clear audit</button></section></aside></div><footer class="hgp-status"><strong role="status" aria-live="polite" data-hgp-status>${escapeHtml(message || "Ready.")}</strong><span>${escapeHtml(previewLabel)} | ${extensions.length}/${MAX_EXTENSIONS} installed</span></footer><input class="hgp-sr" type="file" accept="application/json,.json" data-hgp-file>`;
      previewFrame = root.querySelector("[data-hgp-frame]");
      if (previewFrame && selected) previewFrame.srcdoc = createPreviewDocument(selected);
    }

    async function installFile(file) {
      if (!file) return;
      if (file.size > MAX_PACKAGE_BYTES) return setStatus(`Package exceeds ${MAX_PACKAGE_BYTES} bytes.`);
      if (typeof view.FileReader !== "function") return setStatus("FileReader is unsupported; this browser cannot install a local JSON file.");
      const reader = new view.FileReader();
      reader.onerror = () => setStatus("The local JSON package could not be read.");
      reader.onload = () => {
        try {
          suppressRegistryRender = true;
          const installed = registry.install(String(reader.result || ""));
          selectedId = installed.manifest.id;
          commandOutput = `Installed ${installed.manifest.name} ${installed.manifest.version}.`;
          suppressRegistryRender = false;
          render("Local JSON package installed.");
        } catch (error) {
          suppressRegistryRender = false;
          setStatus(`Install rejected: ${safeText(error && error.message, 220, "Invalid package.")}`);
        }
      };
      reader.readAsText(file);
    }

    async function onClick(event) {
      const target = event.target.closest && event.target.closest("button");
      if (!target || !root.contains(target)) return;
      if (target.matches("[data-hgp-install]")) {
        if (!capabilityReport.fileReader) return setStatus("FileReader is unsupported; local JSON installation is unavailable.");
        return root.querySelector("[data-hgp-file]").click();
      }
      if (target.matches("[data-hgp-demo]")) {
        try {
          suppressRegistryRender = true;
          const installed = registry.install(DEMO_PACKAGE);
          selectedId = installed.manifest.id;
          suppressRegistryRender = false;
          return render("Demo extension installed from bundled local JSON data.");
        } catch (error) {
          suppressRegistryRender = false;
          return setStatus(error.message);
        }
      }
      if (target.dataset.hgpSelect || target.dataset.hgpPreview) {
        selectedId = target.dataset.hgpSelect || target.dataset.hgpPreview;
        return render("Extension selected.");
      }
      if (target.dataset.hgpUninstall) {
        const id = target.dataset.hgpUninstall;
        suppressRegistryRender = true;
        registry.uninstall(id);
        suppressRegistryRender = false;
        if (selectedId === id) selectedId = registry.list()[0]?.manifest.id || null;
        return render("Extension uninstalled; its commands and packs were removed.");
      }
      if (target.matches("[data-hgp-clear-audit]")) {
        suppressRegistryRender = true;
        registry.clearAudit();
        suppressRegistryRender = false;
        return render("Audit log cleared.");
      }
      if (target.matches("[data-hgp-run]")) {
        const commandId = root.querySelector("[data-hgp-command]")?.value;
        if (!commandId || !selectedId) return setStatus("Select an enabled command first.");
        try {
          const result = await registry.executeCommand(commandId, { pluginId: selectedId });
          commandOutput = JSON.stringify(result, null, 2);
          return render("Allowlisted command completed.");
        } catch (error) {
          commandOutput = safeText(error && error.message, 500, "Command failed.");
          return render("Command was rejected or failed.");
        }
      }
    }

    function onChange(event) {
      if (event.target.matches("[data-hgp-file]") && event.target.files[0]) return installFile(event.target.files[0]);
      if (event.target.dataset.hgpEnabled) {
        const id = event.target.dataset.hgpEnabled;
        suppressRegistryRender = true;
        registry.setEnabled(id, event.target.checked);
        suppressRegistryRender = false;
        return render(event.target.checked ? "Extension enabled." : "Extension disabled; its commands and packs are inactive.");
      }
    }

    function onDragOver(event) {
      const target = event.target.closest && event.target.closest("[data-hgp-install]");
      if (!target) return;
      event.preventDefault();
      target.classList.add("is-over");
    }

    function onDragLeave(event) {
      const target = event.target.closest && event.target.closest("[data-hgp-install]");
      if (target) target.classList.remove("is-over");
    }

    function onDrop(event) {
      const target = event.target.closest && event.target.closest("[data-hgp-install]");
      if (!target) return;
      event.preventDefault();
      target.classList.remove("is-over");
      installFile(event.dataTransfer.files && event.dataTransfer.files[0]);
    }

    async function onMessage(event) {
      const selected = selectedExtension();
      if (!selected || !previewFrame) return;
      const commandIds = selected.manifest.contributes.commands.map((command) => command.id);
      if (!isAllowedPreviewMessage(event, previewFrame, selected.manifest.id, commandIds)) return;
      if (event.data.type === "preview.ready") return setStatus("Sandbox preview ready.");
      try {
        const result = await registry.executeCommand(event.data.commandId, { pluginId: selected.manifest.id });
        commandOutput = JSON.stringify(result, null, 2);
        render("Sandbox requested an allowlisted command; host capability check passed.");
      } catch (error) {
        commandOutput = safeText(error && error.message, 500, "Command rejected.");
        render("Sandbox command was rejected.");
      }
    }

    function onKeyDown(event) {
      if (event.key !== "Escape" || !selectedId) return;
      const button = root.querySelector(`[data-hgp-select="${selectedId}"]`);
      if (button) button.focus();
    }

    root.addEventListener("click", onClick);
    root.addEventListener("change", onChange);
    root.addEventListener("dragover", onDragOver);
    root.addEventListener("dragleave", onDragLeave);
    root.addEventListener("drop", onDrop);
    root.addEventListener("keydown", onKeyDown);
    if (view && typeof view.addEventListener === "function") view.addEventListener("message", onMessage);
    const unsubscribe = registry.subscribe(() => { if (!suppressRegistryRender) render("Registry updated."); });
    render();

    const controller = {
      registry,
      getSelected: () => selectedExtension(),
      select(id) { if (!registry.get(id)) return false; selectedId = String(id); render("Extension selected."); return true; },
      render,
      unmount() {
        if (destroyed) return;
        destroyed = true;
        unsubscribe();
        root.removeEventListener("click", onClick);
        root.removeEventListener("change", onChange);
        root.removeEventListener("dragover", onDragOver);
        root.removeEventListener("dragleave", onDragLeave);
        root.removeEventListener("drop", onDrop);
        root.removeEventListener("keydown", onKeyDown);
        if (view && typeof view.removeEventListener === "function") view.removeEventListener("message", onMessage);
        root.replaceChildren();
        root.classList.remove("hgp");
        instances.delete(root);
      }
    };
    instances.set(root, controller);
    return controller;
  }

  function unmount(root) {
    const controller = instances.get(root);
    if (!controller) return false;
    controller.unmount();
    return true;
  }

  const api = Object.freeze({
    VERSION,
    FORMAT,
    REGISTRY_FORMAT,
    STORAGE_KEY,
    MAX_PACKAGE_BYTES,
    MAX_EXTENSIONS,
    MAX_AUDIT_ENTRIES,
    PERMISSIONS,
    PACK_TYPES,
    PACKAGE_TYPES,
    COMMAND_OPERATIONS,
    PREVIEW_CHANNEL,
    PREVIEW_MESSAGE_TYPES,
    DEMO_PACKAGE,
    PluginPackageError,
    PluginPermissionError,
    escapeHtml,
    validateManifest,
    validatePackage,
    parseLocalPackage,
    createMemoryHost,
    createCapabilityApi,
    executeDeclarativeCommand,
    createRegistry,
    detectCapabilities,
    createPreviewDocument,
    isAllowedPreviewMessage,
    mount,
    unmount
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.HHGraphicPlugins = api;
}(typeof globalThis !== "undefined" ? globalThis : this));
