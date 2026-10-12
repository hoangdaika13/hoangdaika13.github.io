(function initAllToolState(scope) {
  "use strict";
  let authUser, hasAuthEvent = false, accountChanging = false;
  const read = (storage, key) => { try { return JSON.parse(storage?.getItem(key) || "null"); } catch { return null; } };
  function currentUser() {
    if (hasAuthEvent) return authUser;
    return read(scope.sessionStorage, "hh.auth.guest-user") || read(scope.localStorage, "hh-auth-user");
  }
  function identityScope(user) {
    if (!user || user.guest === true) return "guest";
    const id = user.id || user._id || user.sub;
    if (id) return `account:${encodeURIComponent(String(id))}`;
    // A legacy profile without a stable identifier cannot claim another user's data.
    return "guest";
  }
  let observedScope = identityScope(currentUser());
  function accountScope(user = currentUser()) {
    return accountChanging ? "account-change-pending" : identityScope(user);
  }
  const key = (base, owner = accountScope()) => `${base}.${owner}`;
  function readJSON(base, fallback, owner) {
    try { const raw = scope.localStorage.getItem(key(base, owner)); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
  }
  function writeJSON(base, value, owner) {
    if (accountChanging) throw new Error("Phiên tài khoản đã thay đổi; tải lại trang trước khi lưu dữ liệu All Tool.");
    const serialized = JSON.stringify(value);
    if (serialized.length > 2 * 1024 * 1024) throw new Error("Dữ liệu tool vượt giới hạn 2 MB; hãy xuất hoặc giảm nội dung.");
    scope.localStorage.setItem(key(base, owner), serialized);
    return value;
  }
  const CATALOG_KEY = "hh.all-tools.catalog.v1", APPEARANCE_KEY = "hh.all-tools.appearance.v1";
  const BACKUP_LIMIT = 4 * 1024 * 1024, adapters = new Map();
  const notify = name => { if (scope.CustomEvent) scope.dispatchEvent?.(new scope.CustomEvent(name)); };
  function assertOwner(owner) {
    if (accountChanging || owner !== accountScope()) throw new Error("Tài khoản đã thay đổi; không thể đọc/nhập bản sao của tài khoản khác.");
  }
  function safeJSON(value) {
    const serialized = JSON.stringify(value);
    if (!serialized || serialized.length > BACKUP_LIMIT) throw new Error("Bản sao vượt giới hạn 4 MB.");
    let bytes = 0;
    for (const char of serialized) { const cp = char.codePointAt(0); bytes += cp < 128 ? 1 : cp < 2048 ? 2 : cp < 65536 ? 3 : 4; }
    if (bytes > BACKUP_LIMIT) throw new Error("Bản sao vượt giới hạn 4 MB UTF-8.");
    const parsed = JSON.parse(serialized), stack = [{ value: parsed, depth: 0 }];
    while (stack.length) {
      const { value: item, depth } = stack.pop();
      if (depth > 24) throw new Error("Bản sao lồng quá nhiều cấp.");
      if (!item || typeof item !== "object") continue;
      if (Object.keys(item).length > 25000) throw new Error("Bản sao có quá nhiều mục.");
      for (const [field, child] of Object.entries(item)) {
        if (["__proto__", "prototype", "constructor"].includes(field)) throw new Error("Bản sao chứa trường không an toàn.");
        stack.push({ value: child, depth: depth + 1 });
      }
    }
    return parsed;
  }
  function normalizeCatalog(value, strict = false) {
    if (!value || typeof value !== "object" || Array.isArray(value)) { if (strict) throw new Error("Danh mục không hợp lệ."); value = {}; }
    if (strict && Object.keys(value).some(field => !["favorites", "pinned", "recent"].includes(field))) throw new Error("Danh mục có trường không hỗ trợ.");
    const result = {};
    for (const field of ["favorites", "pinned", "recent"]) {
      const items = value[field] || [];
      if (strict && (!Array.isArray(items) || items.length > 86 || items.some(id => typeof id !== "string" || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)))) throw new Error("Mã công cụ trong danh mục không hợp lệ.");
      result[field] = Array.isArray(items) ? [...new Set(items.filter(id => typeof id === "string" && /^[a-z0-9][a-z0-9-]{0,79}$/.test(id) && (!scope.HHFeatureLab?.getTool || scope.HHFeatureLab.getTool(id))))].slice(0, field === "recent" ? 12 : 86) : [];
    }
    return result;
  }
  function readCatalogPreferences(owner = accountScope()) {
    assertOwner(owner); return normalizeCatalog(readJSON(CATALOG_KEY, {}, owner));
  }
  function updateCatalogPreferences(patch, owner = accountScope()) {
    assertOwner(owner);
    const next = normalizeCatalog({ ...readCatalogPreferences(owner), ...patch }, true);
    writeJSON(CATALOG_KEY, next, owner); notify("hh:alltools-catalog-change"); return next;
  }
  function normalizeAppearance(value) {
    if (value === null) return null;
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(field => !["mode", "lightStart", "darkStart", "accent", "highlight", "fontScale", "contrast"].includes(field))) throw new Error("Cấu hình giao diện không hợp lệ.");
    value = { mode: "system", lightStart: "06:00", darkStart: "18:00", accent: "#67e8f9", highlight: "#ff8ece", fontScale: 100, contrast: "normal", ...value };
    // Older range-input values were persisted as decimal strings. Normalize only
    // that legacy representation; booleans, empty strings, hex and expressions
    // are not numeric appearance values and must still be rejected.
    if (typeof value.fontScale === "string" && /^\d{2,3}(?:\.\d+)?$/.test(value.fontScale)) value.fontScale = Number(value.fontScale);
    if (!["system", "light", "dark", "schedule"].includes(value.mode) || !["normal", "high"].includes(value.contrast) || !Number.isFinite(value.fontScale) || value.fontScale < 85 || value.fontScale > 125) throw new Error("Giá trị giao diện ngoài giới hạn.");
    for (const field of ["accent", "highlight"]) if (!/^#[a-f\d]{6}$/i.test(value[field])) throw new Error("Màu giao diện không hợp lệ.");
    for (const field of ["lightStart", "darkStart"]) if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value[field])) throw new Error("Giờ giao diện không hợp lệ.");
    return { ...value };
  }
  function registerBackupScope(id, adapter) {
    if (!["utility", "workspace"].includes(id) || !adapter || !["export", "normalize", "import"].every(method => typeof adapter[method] === "function")) throw new Error("Adapter bản sao không hợp lệ.");
    adapters.set(id, adapter);
  }
  function normalizeWorkspaceBackup(payload, owner = accountScope()) {
    assertOwner(owner); payload = safeJSON(payload);
    if (payload.format !== "HH All Tool Workspace Backup" || payload.version !== 1 || payload.owner !== owner || !payload.scopes || typeof payload.scopes !== "object" || Array.isArray(payload.scopes) || Object.keys(payload).some(field => !["format", "version", "owner", "createdAt", "scopes"].includes(field))) throw new Error("Bản sao không đúng định dạng hoặc tài khoản.");
    const result = { format: payload.format, version: 1, owner, createdAt: String(payload.createdAt || "").slice(0, 40), scopes: {} };
    for (const [id, data] of Object.entries(payload.scopes)) {
      if (id === "catalog") result.scopes[id] = normalizeCatalog(data, true);
      else if (id === "appearance") result.scopes[id] = normalizeAppearance(data);
      else if (adapters.has(id)) result.scopes[id] = adapters.get(id).normalize(data, { owner });
      else throw new Error(`Phạm vi ${id} chưa được hỗ trợ; không nhập một phần bản sao.`);
    }
    return safeJSON(result);
  }
  async function exportWorkspaceBackup(owner = accountScope(), options = {}) {
    assertOwner(owner);
    const ids = options.scopes || ["catalog", "appearance", ...adapters.keys()];
    if (!Array.isArray(ids) || ids.length > 4 || new Set(ids).size !== ids.length) throw new Error("Chọn phạm vi bản sao không hợp lệ.");
    const scopes = {};
    for (const id of ids) {
      assertOwner(owner);
      if (id === "catalog") scopes[id] = readCatalogPreferences(owner);
      else if (id === "appearance") scopes[id] = normalizeAppearance(readJSON(APPEARANCE_KEY, null, owner));
      else if (adapters.has(id)) scopes[id] = await adapters.get(id).export({ owner, includeFiles: options.includeFiles === true, maxBytes: BACKUP_LIMIT });
      else throw new Error(`Phạm vi ${id} chưa tải; hãy mở bộ công cụ trước khi xuất.`);
    }
    assertOwner(owner);
    return normalizeWorkspaceBackup({ format: "HH All Tool Workspace Backup", version: 1, owner, createdAt: new Date().toISOString(), scopes }, owner);
  }
  async function applyScope(id, data, owner, strategy) {
    assertOwner(owner);
    if (id === "catalog") {
      const existing = readCatalogPreferences(owner);
      const next = strategy === "replace" ? data : Object.fromEntries(Object.keys(existing).map(field => [field, strategy === "skip" && existing[field].length ? existing[field] : [...new Set([...existing[field], ...data[field]])]]));
      updateCatalogPreferences(next, owner);
    } else if (id === "appearance") {
      if (strategy === "skip" && readJSON(APPEARANCE_KEY, null, owner) !== null) return;
      if (data === null) scope.localStorage.removeItem(key(APPEARANCE_KEY, owner)); else writeJSON(APPEARANCE_KEY, data, owner);
      notify("hh:alltools-appearance-change");
    } else await adapters.get(id).import(data, { owner, strategy });
  }
  async function prepareWorkspaceImport(payload, { owner = accountScope(), strategy = "merge" } = {}) {
    if (!["merge", "skip", "replace"].includes(strategy)) throw new Error("Cách nhập không hợp lệ.");
    const next = normalizeWorkspaceBackup(payload, owner), ids = Object.keys(next.scopes);
    const before = await exportWorkspaceBackup(owner, { scopes: ids, includeFiles: next.scopes.workspace?.filesIncluded === true });
    if (next.scopes.workspace?.filesIncluded && before.scopes.workspace?.omittedFiles?.length) throw new Error("Tệp hiện tại vượt giới hạn sao lưu hoàn tác. Hãy nhập không kèm nội dung tệp để bảo toàn dữ liệu cũ.");
    const applied = []; let started = false;
    const report = { scopes: ids, strategy, rolledBack: false, partial: false };
    async function rollback() {
      let failure;
      for (const id of [...applied].reverse()) { try { await applyScope(id, before.scopes[id], owner, "replace"); } catch (error) { failure = error; } }
      report.rolledBack = !failure; report.partial = Boolean(failure);
      if (failure) throw new Error(`Không hoàn tác được toàn bộ bản sao: ${failure.message}`);
      applied.length = 0; return report;
    }
    async function apply() {
      if (started) throw new Error("Kế hoạch nhập đã được sử dụng.");
      started = true;
      try { for (const id of ids) { applied.push(id); await applyScope(id, next.scopes[id], owner, strategy); } return report; }
      catch (error) { try { await rollback(); } catch (restoreError) { error.message += ` ${restoreError.message}`; } error.report = report; throw error; }
    }
    return { apply, rollback, report };
  }
  async function importWorkspaceBackup(payload, options) { const plan = await prepareWorkspaceImport(payload, options); return plan.apply(); }
  async function workspaceHistory(owner = accountScope(), limit = 100) {
    assertOwner(owner); const rows = [];
    for (const [source, adapter] of adapters) if (adapter.history) for (const row of await adapter.history({ owner, limit })) {
      if (row && typeof row.id === "string" && typeof row.tool === "string" && typeof row.action === "string" && Number.isFinite(new Date(row.at).getTime())) rows.push({ id: row.id.slice(0, 100), source, tool: row.tool.slice(0, 80), action: row.action.slice(0, 100), at: new Date(row.at).toISOString() });
    }
    assertOwner(owner); return rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, Math.min(500, Math.max(1, Number(limit) || 100)));
  }
  const api = Object.freeze({ accountScope, currentUser, key, readJSON, writeJSON, readCatalogPreferences, updateCatalogPreferences, registerBackupScope, exportWorkspaceBackup, normalizeWorkspaceBackup, prepareWorkspaceImport, importWorkspaceBackup, workspaceHistory, isAccountChanging: () => accountChanging });
  if (scope?.addEventListener) scope.addEventListener("hh:auth-change", event => {
    authUser = event.detail?.user || null;
    hasAuthEvent = true;
    accountChanging = false;
    observedScope = identityScope(authUser);
  });
  if (scope?.addEventListener) scope.addEventListener("storage", event => {
    if (event.key === key(CATALOG_KEY)) { notify("hh:alltools-catalog-change"); return; }
    if (event.key === key(APPEARANCE_KEY)) { notify("hh:alltools-appearance-change"); return; }
    if (event.key !== null && event.key !== "hh-auth-user") return;
    const profile = read(scope.sessionStorage, "hh.auth.guest-user") || read(scope.localStorage, "hh-auth-user");
    if (identityScope(profile) === observedScope) return;
    // A public profile change does not prove the current tab's authenticated token changed.
    // Stop tool work until the normal auth bootstrap can resolve the session again.
    accountChanging = true;
    scope.dispatchEvent?.(new scope.CustomEvent("hh:alltools-account-change"));
  });
  if (scope) scope.HHAllToolState = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
