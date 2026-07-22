(function initHHSystemPlatform(globalScope, factory) {
  "use strict";

  const api = factory(globalScope || {});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope) globalScope.HHSystemPlatform = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function systemPlatformFactory(globalScope) {
  "use strict";

  const VERSION = 1;
  const INTEGRATION_VERSION = "system-platform.v1";
  const STORAGE_KEY = "hh.system.center.v1";
  const BACKUP_SCHEMA = "hh.system.backup.v1";
  const SENSITIVE_KEY = /(?:password|passcode|secret|token|authorization|cookie|credential|private[-_]?key|api[-_]?key|card|cvv)/i;
  const controllers = new WeakMap();

  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const text = (value, limit = 500) => String(value == null ? "" : value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .normalize("NFC")
    .slice(0, limit);
  const escapeHtml = value => text(value, 5000).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const now = () => new Date().toISOString();
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  function sanitize(value, depth = 0) {
    if (depth > 6 || value == null) return value == null ? null : undefined;
    if (["string", "boolean"].includes(typeof value)) return typeof value === "string" ? text(value, 10000) : value;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (Array.isArray(value)) return value.slice(0, 200).map(item => sanitize(item, depth + 1)).filter(item => item !== undefined);
    if (typeof value !== "object") return undefined;
    return Object.entries(value).slice(0, 200).reduce((result, [key, item]) => {
      const safeKey = text(key, 100).trim();
      if (!safeKey || SENSITIVE_KEY.test(safeKey)) return result;
      const safeValue = sanitize(item, depth + 1);
      if (safeValue !== undefined) result[safeKey] = safeValue;
      return result;
    }, {});
  }

  function defaultState() {
    return {
      version: VERSION,
      preferences: { theme: "system", density: "comfortable", language: "vi", reducedData: false, offlineHints: true },
      localFlags: { compactNavigation: false, quietMotion: false },
      backups: [],
      audit: [],
      updatedAt: now()
    };
  }

  function migrate(input) {
    const base = defaultState();
    if (!input || typeof input !== "object") return base;
    const preferences = input.preferences || {};
    return {
      version: VERSION,
      preferences: {
        theme: ["system", "dark", "light"].includes(preferences.theme) ? preferences.theme : base.preferences.theme,
        density: ["comfortable", "compact"].includes(preferences.density) ? preferences.density : base.preferences.density,
        language: ["vi", "en"].includes(preferences.language) ? preferences.language : base.preferences.language,
        reducedData: Boolean(preferences.reducedData),
        offlineHints: preferences.offlineHints !== false
      },
      localFlags: Object.fromEntries(Object.entries(sanitize(input.localFlags || {}) || {}).slice(0, 40).map(([key, value]) => [text(key, 80), Boolean(value)])),
      backups: (Array.isArray(input.backups) ? input.backups : []).slice(-20).map(item => ({ id: text(item.id, 100), kind: ["export", "import"].includes(item.kind) ? item.kind : "export", createdAt: text(item.createdAt, 40) })),
      audit: (Array.isArray(input.audit) ? input.audit : []).slice(-150).map(item => sanitize(item)).filter(Boolean),
      updatedAt: text(input.updatedAt || now(), 40)
    };
  }

  function createStore(storage) {
    let state = defaultState();
    try { state = migrate(JSON.parse(storage?.getItem?.(STORAGE_KEY) || "null")); } catch { state = defaultState(); }

    function persist() {
      state.updatedAt = now();
      try { storage?.setItem?.(STORAGE_KEY, JSON.stringify(state)); } catch { /* Private mode or local quota. */ }
    }
    function audit(action, detail = {}) {
      state.audit.push({ id: uid("audit"), action: text(action, 100), detail: sanitize(detail) || {}, createdAt: now(), scope: "this-device" });
      state.audit = state.audit.slice(-150);
    }
    function updatePreferences(patch = {}) {
      const next = migrate({ ...state, preferences: { ...state.preferences, ...sanitize(patch) } });
      state.preferences = next.preferences;
      audit("settings.updated", { fields: Object.keys(patch).filter(key => !SENSITIVE_KEY.test(key)) });
      persist();
      return clone(state.preferences);
    }
    function setLocalFlag(key, enabled) {
      const flag = text(key, 80).replace(/[^a-zA-Z0-9_.:-]/g, "-");
      if (!flag || SENSITIVE_KEY.test(flag)) throw new Error("Khóa feature flag không hợp lệ.");
      state.localFlags[flag] = Boolean(enabled);
      audit("local-flag.updated", { flag, enabled: Boolean(enabled) });
      persist();
      return Boolean(state.localFlags[flag]);
    }
    function exportBackup() {
      const createdAt = now();
      const payload = { schema: BACKUP_SCHEMA, version: VERSION, createdAt, data: { preferences: clone(state.preferences), localFlags: clone(state.localFlags) }, privacy: { secretsIncluded: false, sessionsIncluded: false, accountDataIncluded: false } };
      state.backups.push({ id: uid("backup"), kind: "export", createdAt });
      audit("backup.exported", { schema: BACKUP_SCHEMA });
      persist();
      return JSON.stringify(payload, null, 2);
    }
    function importBackup(raw) {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!parsed || parsed.schema !== BACKUP_SCHEMA || Number(parsed.version) !== VERSION || !parsed.data) throw new Error("Tệp backup không đúng định dạng HH System v1.");
      const safe = sanitize(parsed.data) || {};
      const imported = migrate({ ...state, preferences: safe.preferences, localFlags: safe.localFlags });
      state.preferences = imported.preferences;
      state.localFlags = imported.localFlags;
      const createdAt = now();
      state.backups.push({ id: uid("backup"), kind: "import", createdAt });
      audit("backup.imported", { schema: BACKUP_SCHEMA });
      persist();
      return inspect();
    }
    function inspect() { return clone(state); }
    return { inspect, updatePreferences, setLocalFlag, exportBackup, importBackup };
  }

  function createFetchAdapter(fetcher, apiBase = "") {
    const request = async (path, options = {}) => {
      if (typeof fetcher !== "function") throw new Error("Trình duyệt không hỗ trợ kết nối backend.");
      const response = await fetcher(`${String(apiBase).replace(/\/$/, "")}${path}`, { cache: "no-store", credentials: "include", ...options, headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Backend trả HTTP ${response.status}.`);
      return data;
    };
    return {
      async health() {
        const data = await request("/api/platform/summary?view=health");
        if (data.ok !== true || !data.health) throw new Error("Backend chưa xác nhận trạng thái hệ thống.");
        return { confirmed: true, checkedAt: data.health.checkedAt || now(), health: sanitize(data.health) || {} };
      },
      async sessions() {
        const data = await request("/api/auth/sessions");
        return (Array.isArray(data.sessions) ? data.sessions : []).slice(0, 50).map(item => sanitize(item)).filter(Boolean);
      },
      async revokeSession(sessionId) {
        const data = await request("/api/auth/session-revoke", { method: "POST", body: JSON.stringify({ sessionId: text(sessionId, 120) }) });
        if (data.ok !== true) throw new Error("Backend chưa xác nhận thu hồi phiên.");
        return { confirmed: true };
      }
    };
  }

  const rolePermissions = Object.freeze({
    owner: ["Quản trị nền tảng", "RBAC", "Feature flags", "Audit"],
    super_admin: ["Quản trị nền tảng", "RBAC", "Feature flags", "Audit"],
    admin: ["Quản trị nội dung", "Phiên người dùng", "Audit"],
    moderator: ["Kiểm duyệt nội dung"],
    support: ["Xử lý yêu cầu hỗ trợ"],
    analyst: ["Xem số liệu tổng hợp an toàn"],
    member: ["Thiết lập cá nhân", "Dữ liệu trên thiết bị"]
  });

  function accessSnapshot(user = {}) {
    const roles = [...new Set((Array.isArray(user.roles) ? user.roles : []).map(role => text(role, 40).toLowerCase()).filter(Boolean))];
    if (!roles.length) roles.push("member");
    return { roles, permissions: [...new Set(roles.flatMap(role => rolePermissions[role] || []))], source: "signed-in-profile", enforcement: "server" };
  }

  function renderMarkup(state, access) {
    const checked = (value, expected = true) => value === expected ? " checked" : "";
    return `<section class="system-platform" data-system-platform>
      <header class="system-hero"><div><p>HH SYSTEM · ${INTEGRATION_VERSION}</p><h2>Hệ thống của bạn, minh bạch và local-first</h2><span>Cài đặt, backup và nhật ký thao tác chỉ trên thiết bị này. Quyền, phiên đăng nhập và provider chỉ được báo thành công sau khi backend xác nhận.</span></div><output data-system-notice role="status" aria-live="polite">Sẵn sàng.</output></header>
      <nav class="system-tabs" aria-label="Khu vực hệ thống">
        ${[["overview","Tổng quan"],["account","Thiết bị & quyền"],["providers","API & tích hợp"],["data","Backup"],["flags","Feature flags"],["audit","Audit log"]].map(([id,label], index) => `<button type="button" data-system-tab="${id}"${index === 0 ? ' aria-current="page"' : ""}>${label}</button>`).join("")}
      </nav>
      <section class="system-panel" data-system-panel="overview">
        <div class="system-status-grid"><article><span>Kết nối</span><strong data-system-online>Đang kiểm tra</strong><small>Trạng thái thật từ trình duyệt</small></article><article><span>PWA</span><strong data-system-pwa>Đang kiểm tra</strong><small>Không giả lập khả năng cài đặt</small></article><article><span>Backend</span><strong data-system-backend>Chưa kiểm tra</strong><small data-system-backend-time>Chờ adapter xác nhận</small></article><article><span>Offline</span><strong data-system-offline>Chưa xác định</strong><small>Cache phụ thuộc service worker hiện có</small></article></div>
        <form class="system-settings" data-system-settings><header><div><span>Thiết lập thiết bị</span><h3>Trải nghiệm cá nhân</h3></div><button type="submit">Lưu trên thiết bị</button></header><div><label>Giao diện<select name="theme"><option value="system"${state.preferences.theme === "system" ? " selected" : ""}>Theo hệ thống</option><option value="dark"${state.preferences.theme === "dark" ? " selected" : ""}>Tối</option><option value="light"${state.preferences.theme === "light" ? " selected" : ""}>Sáng</option></select></label><label>Mật độ<select name="density"><option value="comfortable"${state.preferences.density === "comfortable" ? " selected" : ""}>Thoải mái</option><option value="compact"${state.preferences.density === "compact" ? " selected" : ""}>Gọn</option></select></label><label>Ngôn ngữ<select name="language"><option value="vi"${state.preferences.language === "vi" ? " selected" : ""}>Tiếng Việt</option><option value="en"${state.preferences.language === "en" ? " selected" : ""}>English</option></select></label></div><label class="system-check"><input name="reducedData" type="checkbox"${checked(state.preferences.reducedData)}><span><b>Giảm dữ liệu</b><small>Ưu tiên nội dung nhẹ khi module hỗ trợ.</small></span></label><label class="system-check"><input name="offlineHints" type="checkbox"${checked(state.preferences.offlineHints)}><span><b>Gợi ý ngoại tuyến</b><small>Hiện rõ phần nào cần mạng.</small></span></label></form>
      </section>
      <section class="system-panel" data-system-panel="account" hidden><div class="system-two-column"><article class="system-card"><header><div><span>Phiên của tôi</span><h3>Thiết bị đăng nhập</h3></div><button type="button" data-system-refresh-sessions>Làm mới</button></header><p>Chỉ hiển thị các phiên thuộc tài khoản hiện tại. Không có theo dõi người dùng khác.</p><div data-system-sessions><p class="system-empty">Đang chờ backend.</p></div></article><article class="system-card"><header><div><span>RBAC</span><h3>Quyền hiện tại</h3></div></header><p>Backend mới là nơi thực thi quyền; giao diện này chỉ giải thích hồ sơ đã đăng nhập.</p><div class="system-chips">${access.roles.map(role => `<span>${escapeHtml(role)}</span>`).join("")}</div><ul>${access.permissions.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></article></div></section>
      <section class="system-panel" data-system-panel="providers" hidden><div class="system-two-column"><article class="system-card"><header><div><span>API quota</span><h3>Hạn mức provider</h3></div><button type="button" data-system-refresh-health>Kiểm tra</button></header><p>Chỉ hiển thị số liệu backend có thể xác nhận. “Đã cấu hình” không đồng nghĩa còn quota.</p><div data-system-quotas><p class="system-empty">Chưa có số liệu quota được xác nhận.</p></div></article><article class="system-card"><header><div><span>Integration center</span><h3>Kết nối máy chủ</h3></div></header><p>Client không nhận hoặc lưu API key, secret, token hay password.</p><div data-system-integrations><p class="system-empty">Nhấn Kiểm tra để tải trạng thái cấu hình.</p></div></article></div></section>
      <section class="system-panel" data-system-panel="data" hidden><div class="system-two-column"><article class="system-card"><header><div><span>Portable JSON</span><h3>Export / Import</h3></div></header><p>Backup chỉ gồm preferences và local feature flags; không gồm tài khoản, phiên hoặc bí mật.</p><div class="system-actions"><button type="button" data-system-export>Xuất backup</button><label class="system-file">Nhập backup<input type="file" accept="application/json,.json" data-system-import></label></div></article><article class="system-card"><header><div><span>Lịch sử</span><h3>Backup trên thiết bị</h3></div></header><div data-system-backups>${state.backups.slice().reverse().map(item => `<p><b>${item.kind === "import" ? "Đã nhập" : "Đã xuất"}</b><span>${escapeHtml(new Date(item.createdAt).toLocaleString("vi-VN"))}</span></p>`).join("") || '<p class="system-empty">Chưa có backup.</p>'}</div></article></div></section>
      <section class="system-panel" data-system-panel="flags" hidden><article class="system-card"><header><div><span>Thiết bị này</span><h3>Feature flags cục bộ</h3></div></header><p>Các công tắc này chỉ điều chỉnh trình bày trên thiết bị, không vượt RBAC hoặc kill switch của backend.</p><div class="system-flag-list">${Object.entries(state.localFlags).map(([key, enabled]) => `<label><span><b>${escapeHtml(key)}</b><small>Phạm vi: thiết bị này</small></span><input type="checkbox" role="switch" data-system-flag="${escapeHtml(key)}"${checked(enabled)}></label>`).join("")}</div></article></section>
      <section class="system-panel" data-system-panel="audit" hidden><article class="system-card"><header><div><span>Nhật ký cục bộ</span><h3>Audit log thiết bị</h3></div></header><p>Chỉ ghi loại thao tác và thời gian; không ghi nội dung form nhạy cảm hoặc dữ liệu người dùng khác.</p><ol class="system-audit" data-system-audit>${state.audit.slice().reverse().map(item => `<li><span>${escapeHtml(item.action)}</span><time datetime="${escapeHtml(item.createdAt)}">${escapeHtml(new Date(item.createdAt).toLocaleString("vi-VN"))}</time></li>`).join("") || '<li class="system-empty">Chưa có thao tác.</li>'}</ol></article></section>
    </section>`;
  }

  function downloadJson(documentRef, filename, value) {
    const url = globalScope.URL?.createObjectURL?.(new Blob([value], { type: "application/json;charset=utf-8" }));
    if (!url) throw new Error("Trình duyệt không hỗ trợ tải backup.");
    const anchor = documentRef.createElement("a");
    anchor.href = url; anchor.download = filename; anchor.click();
    globalScope.setTimeout?.(() => globalScope.URL.revokeObjectURL(url), 1000);
  }

  async function mount(container, options = {}) {
    if (!container?.querySelector) throw new TypeError("HHSystemPlatform cần một container hợp lệ.");
    controllers.get(container)?.abort();
    const controller = new AbortController();
    controllers.set(container, controller);
    const storage = options.storage || globalScope.localStorage;
    const store = createStore(storage);
    const user = options.currentUser || (() => { try { return JSON.parse(storage?.getItem?.("hh-auth-user") || "{}"); } catch { return {}; } })();
    const access = accessSnapshot(user);
    const adapter = options.adapter || createFetchAdapter(options.fetch || globalScope.fetch?.bind(globalScope), options.apiBase || "");
    container.innerHTML = renderMarkup(store.inspect(), access);
    const page = container.querySelector("[data-system-platform]");
    const signal = controller.signal;
    const notice = (message, state = "") => { const node = page.querySelector("[data-system-notice]"); node.textContent = message; node.dataset.state = state; };
    const onlineNode = page.querySelector("[data-system-online]");
    const updateOnline = () => { const online = globalScope.navigator?.onLine !== false; onlineNode.textContent = online ? "Trực tuyến" : "Ngoại tuyến"; onlineNode.dataset.state = online ? "ready" : "warning"; page.querySelector("[data-system-offline]").textContent = globalScope.navigator?.serviceWorker?.controller ? "Cache đang được quản lý" : "Chưa có controller"; };
    updateOnline();
    globalScope.addEventListener?.("online", updateOnline, { signal });
    globalScope.addEventListener?.("offline", updateOnline, { signal });
    const standalone = globalScope.matchMedia?.("(display-mode: standalone)")?.matches || globalScope.navigator?.standalone === true;
    page.querySelector("[data-system-pwa]").textContent = standalone ? "Đang chạy dạng ứng dụng" : globalScope.navigator?.serviceWorker ? "Trình duyệt hỗ trợ" : "Không hỗ trợ";

    const renderSessions = sessions => {
      page.querySelector("[data-system-sessions]").innerHTML = sessions.length ? sessions.map(session => `<article><div><strong>${escapeHtml(session.device?.label || `${session.device?.browser || "Trình duyệt"} · ${session.device?.platform || "Thiết bị"}`)}</strong><small>${session.current ? "Phiên hiện tại" : `Hoạt động ${escapeHtml(session.lastSeenAt ? new Date(session.lastSeenAt).toLocaleString("vi-VN") : "chưa rõ")}`}</small></div><button type="button" data-system-revoke="${escapeHtml(session.id)}">${session.current ? "Đăng xuất phiên này" : "Thu hồi"}</button></article>`).join("") : '<p class="system-empty">Không có phiên đang hoạt động hoặc backend chưa trả dữ liệu.</p>';
    };
    const loadSessions = async () => { try { renderSessions(await adapter.sessions()); notice("Đã đồng bộ phiên đăng nhập của bạn.", "success"); } catch (error) { renderSessions([]); notice(error.message, "error"); } };
    const renderHealth = result => {
      const health = result.health || {};
      page.querySelector("[data-system-backend]").textContent = result.confirmed ? "Backend đã xác nhận" : "Chưa xác nhận";
      page.querySelector("[data-system-backend-time]").textContent = `Kiểm tra ${new Date(result.checkedAt || Date.now()).toLocaleString("vi-VN")}`;
      const integrations = [
        ["Database", health.database?.connected], ["Google OAuth", health.auth?.googleOAuth], ["Email", health.auth?.emailVerification], ["Gemini", health.ai?.gemini], ["ElevenLabs", health.ai?.elevenLabs], ["payOS", health.payments?.payos], ["Object Storage", health.storage?.objectStorage], ["Realtime", health.realtime?.connected]
      ];
      page.querySelector("[data-system-integrations]").innerHTML = integrations.map(([label, ready]) => `<p><span>${escapeHtml(label)}</span><b data-state="${ready ? "ready" : "setup"}">${ready ? "Đã cấu hình" : "Cần cấu hình server"}</b></p>`).join("");
      page.querySelector("[data-system-quotas]").innerHTML = '<p class="system-empty">Backend hiện chưa cung cấp số quota đã dùng/giới hạn. Không hiển thị số liệu ước đoán.</p>';
    };
    const loadHealth = async () => { try { const result = await adapter.health(); renderHealth(result); notice("Trạng thái tích hợp đã được backend xác nhận.", "success"); } catch (error) { notice(error.message, "error"); } };

    page.addEventListener("click", async event => {
      const tab = event.target.closest("[data-system-tab]");
      if (tab) {
        page.querySelectorAll("[data-system-tab]").forEach(node => node.toggleAttribute("aria-current", node === tab));
        page.querySelectorAll("[data-system-panel]").forEach(panel => { panel.hidden = panel.dataset.systemPanel !== tab.dataset.systemTab; });
        return;
      }
      if (event.target.closest("[data-system-refresh-sessions]")) return loadSessions();
      if (event.target.closest("[data-system-refresh-health]")) return loadHealth();
      const revoke = event.target.closest("[data-system-revoke]");
      if (revoke) {
        revoke.disabled = true;
        try { await adapter.revokeSession(revoke.dataset.systemRevoke); notice("Backend đã xác nhận thu hồi phiên.", "success"); await loadSessions(); }
        catch (error) { revoke.disabled = false; notice(error.message, "error"); }
        return;
      }
      if (event.target.closest("[data-system-export]")) {
        try { const value = store.exportBackup(); downloadJson(container.ownerDocument, `hh-system-backup-${new Date().toISOString().slice(0, 10)}.json`, value); notice("Đã xuất backup không chứa bí mật.", "success"); }
        catch (error) { notice(error.message, "error"); }
      }
    }, { signal });
    page.querySelector("[data-system-settings]").addEventListener("submit", event => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      store.updatePreferences({ theme: form.get("theme"), density: form.get("density"), language: form.get("language"), reducedData: form.has("reducedData"), offlineHints: form.has("offlineHints") });
      notice("Đã lưu thiết lập trên thiết bị này.", "success");
    }, { signal });
    page.querySelectorAll("[data-system-flag]").forEach(input => input.addEventListener("change", () => { store.setLocalFlag(input.dataset.systemFlag, input.checked); notice("Đã cập nhật feature flag cục bộ; quyền backend không thay đổi.", "success"); }, { signal }));
    page.querySelector("[data-system-import]").addEventListener("change", async event => {
      const file = event.target.files?.[0]; if (!file) return;
      try { store.importBackup(await file.text()); notice("Đã nhập backup hợp lệ. Mở lại Hệ thống để thấy toàn bộ thiết lập.", "success"); }
      catch (error) { notice(error.message, "error"); }
      finally { event.target.value = ""; }
    }, { signal });
    loadHealth();
    loadSessions();
    return { unmount: () => controller.abort(), integrationVersion: INTEGRATION_VERSION };
  }

  function unmount(container) {
    if (container) { controllers.get(container)?.abort(); controllers.delete(container); }
    else controllers.forEach?.(controller => controller.abort());
  }

  return Object.freeze({ VERSION, INTEGRATION_VERSION, STORAGE_KEY, BACKUP_SCHEMA, sanitize, migrate, createStore, createFetchAdapter, accessSnapshot, mount, unmount });
});
