(function (scope) {
  "use strict";
  const VERSION = 1;
  const ACTIVE_KEY = "hh.graphic-design.active-project.v1";
  const adapters = new WeakMap();
  function id(value, fallback) {
    const text = String(value == null ? "" : value).trim().slice(0, 240);
    return text || fallback;
  }
  function rawStorage(options) {
    if (options && Object.prototype.hasOwnProperty.call(options, "storage")) return options.storage;
    try { return scope.localStorage || null; } catch (_) { return null; }
  }
  function accountId(options) {
    if (options?.accountId) return id(options.accountId, "guest");
    let user = options?.user;
    if (!user) { try { user = scope.HHAuthz?.currentUser?.(); } catch (_) { user = null; } }
    return id(user?.id || user?._id || user?.email?.toLowerCase(), "guest");
  }
  function accountKey(base, account) {
    return `${String(base)}:account:${encodeURIComponent(id(account, "guest"))}`;
  }
  function storageKey(base, context) {
    return `${accountKey(base, context.accountId)}:project:${encodeURIComponent(id(context.projectId, "workspace"))}`;
  }
  function createStorage(storage, context) {
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") return null;
    if (adapters.has(storage)) storage = adapters.get(storage);
    const adapter = Object.freeze({
      getItem(key) { return storage.getItem(storageKey(key, context)); },
      setItem(key, value) { storage.setItem(storageKey(key, context), value); },
      removeItem(key) { storage.removeItem(storageKey(key, context)); }
    });
    adapters.set(adapter, storage);
    return adapter;
  }
  function resolve(options = {}) {
    if (options.projectContext) return options.projectContext;
    let storage = rawStorage(options);
    if (storage && adapters.has(storage)) storage = adapters.get(storage);
    const account = accountId(options);
    let selected = null;
    try { selected = storage?.getItem(accountKey(ACTIVE_KEY, account)); } catch (_) { /* Session remains usable. */ }
    const context = {
      version: VERSION,
      accountId: account,
      projectId: id(options.projectId || selected, "workspace"),
      storage,
      accountKey: (base) => accountKey(base, account),
      storageKey(base) { return storageKey(base, context); }
    };
    context.engineStorage = createStorage(storage, context);
    return Object.freeze(context);
  }
  function select(projectId, options = {}) {
    const context = resolve({ ...options, projectContext: undefined, projectId });
    try {
      if (!context.storage) return { ok: false, context, reason: "unsupported" };
      context.storage.setItem(context.accountKey(ACTIVE_KEY), context.projectId);
      return { ok: true, context };
    } catch (_) { return { ok: false, context, reason: "storage" }; }
  }
  const api = Object.freeze({ VERSION, ACTIVE_KEY, accountId, accountKey, storageKey, createStorage, resolve, select });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  scope.HHGraphicProjectContext = api;
}(typeof globalThis !== "undefined" ? globalThis : this));
