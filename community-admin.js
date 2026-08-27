(() => {
  "use strict";

  const API_BASE = String(window.HH_REALTIME_URL || "").replace(/\/$/, "");
  let access = null;
  let accessToken = "";
  let panelRef = null;
  let activeView = "dashboard";
  let navTimer = 0;
  let activityTimer = 0;
  let userQuery = {};
  let contentQuery = { type: "post", status: "active" };
  let rightsQuery = { status: "all", page: 1 };
  let rightsEntries = [];
  let auditEntries = [];
  let auditQuery = {};
  let featureFlags = [];
  let customAdminRoles = [];
  let permissionCatalog = [];
  let privilege = { active: false, tier: "standing", minutesRemaining: 0, googleReauthRecent: false };
  const REQUEST_TIMEOUT_MS = 12000;
  const PREFERENCES_KEY = "hh.admin-galaxy.preferences.v1";
  const PLANETS = Object.freeze([
    { id: "dashboard", icon: "MC", label: "Mission Control", eyebrow: "Điều hành", color: "#63e6ee", permission: "dashboard.view" },
    { id: "identity", icon: "IA", label: "Identity & Access", eyebrow: "Danh tính", color: "#a879ff", permission: "users.view" },
    { id: "security", icon: "SC", label: "Security Center", eyebrow: "Bảo mật", color: "#ff6fae", permission: "security.view" },
    { id: "community", icon: "UC", label: "Users & Community", eyebrow: "Cộng đồng", color: "#59a9ff", permission: "activity.view" },
    { id: "trust", icon: "CT", label: "Content & Trust", eyebrow: "Tin cậy", color: "#ed6be7", permission: "content.manage" },
    { id: "platform", icon: "PR", label: "Platform & Release", eyebrow: "Hạ tầng", color: "#65efae", permission: "platform.view" },
    { id: "growth", icon: "GD", label: "Growth & Data", eyebrow: "Tăng trưởng", color: "#ffd868", permission: "growth.view" }
  ]);
  const VIEW_PLANETS = Object.freeze({
    dashboard: "dashboard",
    identity: "identity",
    power: "identity",
    users: "identity",
    "effective-access": "identity",
    "role-assignments": "identity",
    "role-history": "identity",
    "access-requests": "identity",
    "service-accounts": "identity",
    audit: "identity",
    security: "security",
    privacy: "security",
    incidents: "security",
    sessions: "security",
    devices: "security",
    "adapter-health": "platform",
    integrations: "platform",
    workspace: "platform",
    "ai-operations": "growth",
    "data-governance": "security",
    community: "community",
    activity: "community",
    trust: "trust",
    reports: "trust",
    appeals: "trust",
    content: "trust",
    rights: "trust",
    platform: "platform",
    settings: "platform",
    growth: "growth"
  });
  const THEMES = Object.freeze([
    ["deep-space", "Deep Space Admin"],
    ["aurora", "Aurora Shield"],
    ["cyber", "Cyber Command"],
    ["nebula", "Nebula Rose"],
    ["golden", "Golden Observatory"],
    ["quantum", "Quantum Authority"],
    ["solar-crown", "Solar Crown"],
    ["aurora-command", "Aurora Command"],
    ["black-hole", "Black Hole Security"]
  ]);
  const MOTION_LEVELS = Object.freeze([["static", "Tĩnh"], ["balanced", "Cân bằng"], ["cinematic", "Điện ảnh"]]);
  const TEXT_SCALES = Object.freeze([["standard", "Tiêu chuẩn"], ["comfortable", "Dễ đọc"], ["large", "Lớn"], ["xlarge", "Rất lớn"]]);
  const DENSITY_LEVELS = Object.freeze([["compact", "Gọn"], ["comfortable", "Dễ đọc"], ["spacious", "Rộng"]]);
  const readPreferences = () => {
    try {
      const value = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "{}");
      return {
        theme: THEMES.some(([id]) => id === value.theme) ? value.theme : "deep-space",
        motion: MOTION_LEVELS.some(([id]) => id === value.motion) ? value.motion : "balanced",
        textScale: TEXT_SCALES.some(([id]) => id === value.textScale) ? value.textScale : "comfortable",
        density: DENSITY_LEVELS.some(([id]) => id === value.density) ? value.density : "comfortable"
      };
    } catch {
      return { theme: "deep-space", motion: "balanced", textScale: "comfortable", density: "comfortable" };
    }
  };
  let preferences = readPreferences();

  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const dateText = (value) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("vi-VN"); };
  const durationText = (seconds) => { const value = Math.max(0, Number(seconds || 0)); return value < 60 ? `${value}s` : value < 3600 ? `${Math.floor(value / 60)}m ${value % 60}s` : `${Math.floor(value / 3600)}h ${Math.floor(value % 3600 / 60)}m`; };
  const metaText = (meta) => {
    if (!meta) return "";
    return [meta.kind, meta.form, meta.fieldCount ? `${meta.fieldCount} trường` : "", meta.lengthBucket ? `độ dài ${meta.lengthBucket}` : "", meta.interactionBucket ? `tương tác ${meta.interactionBucket}` : "", meta.durationBucket || "", meta.valid === false ? "chưa hợp lệ" : ""].filter(Boolean).join(" · ");
  };
  const moneyText = (value) => `${Math.max(0, Number(value || 0)).toLocaleString("vi-VN")} ₫`;
  const notice = (message, type = "success") => window.HHCommunity?.notice?.(message, type);
  const has = (permission) => Boolean(access?.permissions?.includes("*") || access?.permissions?.includes(permission));
  const planetForView = (view) => VIEW_PLANETS[view] || "dashboard";
  const statusLabel = (status) => ({ operational: "Ổn định", warning: "Cần theo dõi", critical: "Nghiêm trọng", "not-configured": "Chưa kết nối", not_configured: "Chưa cấu hình", configured: "Đã cấu hình · chưa verify", write_ready: "Đã verify write", health_failed: "Health thất bại", degraded: "Suy giảm", disabled: "Đã vô hiệu hóa", new: "Mới", investigating: "Đang điều tra", mitigated: "Đã giảm thiểu", resolved: "Đã giải quyết", queued: "Đang chờ", running: "Đang chạy", paused: "Tạm dừng", failed: "Thất bại", cancelled: "Đã hủy", executing: "Đang thực thi", execution_failed: "Cần kiểm tra thủ công", approved_waiting_adapter: "Đã duyệt · chờ adapter", executed: "Đã thực thi" }[status] || String(status || "Không rõ"));

  async function api(view = "me", options = {}) {
    if (!API_BASE) throw new Error("Backend Community Admin chưa được cấu hình.");
    const token = window.HHAuthSession?.token?.() || "";
    if (!token) throw new Error("Bạn cần đăng nhập để mở Community Admin.");
    const query = new URLSearchParams({ view, ...(options.query || {}) });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(`${API_BASE}/api/community-admin?${query}`, {
        method: options.method || "GET",
        headers: { Authorization: `Bearer ${token}`, ...(options.body ? { "Content-Type": "application/json" } : {}) },
        body: options.body ? JSON.stringify(options.body) : undefined,
        cache: "no-store",
        signal: controller.signal
      });
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("Máy chủ phản hồi quá chậm. Hãy bấm Thử lại sau vài giây.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
    const data = await response.json().catch(() => ({}));
    if (data.privilege) privilege = { ...privilege, ...data.privilege };
    if (Array.isArray(data.customRoles)) customAdminRoles = data.customRoles;
    if (Array.isArray(data.permissionCatalog)) permissionCatalog = data.permissionCatalog;
    if (!response.ok) {
      const error = new Error(data.error || "Community Admin không phản hồi.");
      error.status = response.status;
      error.code = data.code || "";
      throw error;
    }
    return data;
  }

  function modal(title, content, submitLabel = "Xác nhận") {
    document.querySelector("[data-community-admin-modal]")?.remove();
    const dialog = document.createElement("dialog");
    dialog.className = "hh-admin-modal";
    dialog.dataset.communityAdminModal = "";
    dialog.innerHTML = `<form><header><div><small>COMMUNITY ADMIN</small><strong>${esc(title)}</strong></div><button type="button" data-admin-modal-close>×</button></header><main>${content}</main><footer><button type="button" data-admin-modal-close>Hủy</button><button type="submit" class="primary">${esc(submitLabel)}</button></footer></form>`;
    document.body.append(dialog);
    dialog.querySelectorAll("[data-admin-modal-close]").forEach((button) => button.addEventListener("click", () => { dialog.close(); dialog.remove(); }));
    dialog.addEventListener("cancel", () => dialog.remove(), { once: true });
    dialog.showModal();
    return dialog;
  }

  function beginFormSubmission(form, pendingLabel = "Đang xử lý…") {
    if (!form || form.dataset.submitting === "true") return null;
    form.dataset.submitting = "true";
    const button = form.querySelector('button[type="submit"]');
    const originalLabel = button?.textContent || "";
    if (button) { button.disabled = true; button.textContent = pendingLabel; }
    return () => {
      if (!form.isConnected) return;
      form.dataset.submitting = "false";
      if (button) { button.disabled = false; button.textContent = originalLabel; }
    };
  }

  function shell(content, title = "Galaxy Mission Control", description = "Điều hành toàn bộ HH Platform bằng dữ liệu production đã được làm sạch.") {
    const activePlanet = planetForView(activeView);
    const planets = PLANETS.filter((planet) => has(planet.permission));
    const themeOptions = THEMES.map(([id, label]) => `<option value="${id}" ${preferences.theme === id ? "selected" : ""}>${esc(label)}</option>`).join("");
    const motionOptions = MOTION_LEVELS.map(([id, label]) => `<option value="${id}" ${preferences.motion === id ? "selected" : ""}>Hiệu ứng: ${esc(label)}</option>`).join("");
    const textOptions = TEXT_SCALES.map(([id, label]) => `<option value="${id}" ${preferences.textScale === id ? "selected" : ""}>Chữ: ${esc(label)}</option>`).join("");
    const densityOptions = DENSITY_LEVELS.map(([id, label]) => `<option value="${id}" ${preferences.density === id ? "selected" : ""}>Bảng: ${esc(label)}</option>`).join("");
    const privilegeMinutes = privilege.expiresAt ? Math.max(0, Math.ceil((new Date(privilege.expiresAt).getTime() - Date.now()) / 60000)) : 0;
    return `<section class="hh-admin-app hh-admin-galaxy" data-admin-theme="${esc(preferences.theme)}" data-admin-motion="${esc(preferences.motion)}" data-admin-text="${esc(preferences.textScale)}" data-admin-density="${esc(preferences.density)}" data-admin-planet="${esc(activePlanet)}">
      <span class="hh-admin-stardust" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
      <header class="hh-admin-galaxy-header">
        <div class="hh-admin-galaxy-brand"><span class="hh-admin-core-mark" aria-hidden="true" data-hh-galaxy-logo data-galaxy-logo-size="54px"><img class="hh-galaxy-logo-fallback" src="assets/brand/hh-galaxy-star-static.svg?v=1" alt="" width="54" height="54"></span><div><small>HH ADMIN GALAXY · SERVER RBAC</small><h5>${esc(title)}</h5><p>${esc(description)}</p></div></div>
        <div class="hh-admin-galaxy-controls">
          <label><span class="sr-only">Chủ đề Admin Galaxy</span><select data-admin-theme-select aria-label="Chủ đề Admin Galaxy">${themeOptions}</select></label>
          <label><span class="sr-only">Mức hiệu ứng</span><select data-admin-motion-select aria-label="Mức hiệu ứng">${motionOptions}</select></label>
          <label><span class="sr-only">Cỡ chữ Admin Galaxy</span><select data-admin-text-select aria-label="Cỡ chữ Admin Galaxy">${textOptions}</select></label>
          <label><span class="sr-only">Mật độ bảng Admin Galaxy</span><select data-admin-density-select aria-label="Mật độ bảng Admin Galaxy">${densityOptions}</select></label>
          <span class="hh-admin-role">${esc((access?.roles || []).join(" · "))}</span>
          <button type="button" data-admin-command aria-keyshortcuts="Control+K">⌘ Tìm nhanh</button>
          ${has("reports.export") ? '<button type="button" data-admin-export>⇩ Xuất báo cáo</button>' : ""}
        </div>
      </header>
      <section class="hh-admin-root-crown" aria-label="Root Authority status">
        <span><i></i><small>PRODUCTION</small><strong>hoang8.com</strong></span>
        <span><i></i><small>AUTHORITY</small><strong>${esc(access?.tier === "root" ? "Root Super Admin" : access?.tier === "super" ? "Super Admin" : "Delegated Admin")}</strong></span>
        <span class="${privilege.active ? "active" : "standing"}"><i></i><small>PRIVILEGE SESSION</small><strong>${privilege.active ? `Nâng cao · còn ${privilegeMinutes} phút` : "Quyền thường trực"}</strong></span>
        <span><i></i><small>APPROVAL POLICY</small><strong>2 Super Admin</strong></span>
        ${has("privileges.activate") && !privilege.active ? '<button type="button" data-admin-privilege-activate>⚡ Kích hoạt quyền nâng cao</button>' : '<button type="button" data-admin-view="power">Mở Root Console →</button>'}
      </section>
      <div class="hh-admin-galaxy-layout">
        <nav class="hh-admin-planets" aria-label="Bảy khu vực quản trị">${planets.map((planet, index) => `<button type="button" data-admin-view="${planet.id}" class="${activePlanet === planet.id ? "active" : ""}" style="--planet:${planet.color}" aria-current="${activePlanet === planet.id ? "page" : "false"}"><i><b>${planet.icon}</b><em></em></i><span><small>0${index + 1} · ${esc(planet.eyebrow)}</small><strong>${esc(planet.label)}</strong></span></button>`).join("")}<footer><i>◈</i><span><strong>Privacy boundary</strong><small>Không hiển thị secret, mật khẩu, raw prompt hoặc tin nhắn riêng.</small></span></footer></nav>
        <main data-admin-content tabindex="-1">${content}</main>
      </div>
    </section>`;
  }

  function subnav(items) {
    return `<nav class="hh-admin-subnav" aria-label="Công cụ trong khu vực">${items.filter((item) => !item[2] || has(item[2])).map(([id, label]) => `<button type="button" data-admin-view="${id}" class="${activeView === id ? "active" : ""}">${esc(label)}</button>`).join("")}</nav>`;
  }

  function loading(label = "Đang tải dữ liệu quản trị...") {
    return `<section class="hh-admin-loading"><i></i><strong>${esc(label)}</strong></section>`;
  }

  async function renderDashboard(initialData = null) {
    panelRef.innerHTML = shell(loading("Đang đồng bộ Mission Control..."));
    const data = initialData || await api("mission");
    if (data.access?.admin) access = data.access;
    const score = Math.max(0, Math.min(100, Number(data.healthScore || 0)));
    const healthState = score >= 90 ? "operational" : score >= 65 ? "warning" : "critical";
    const metrics = [
      ["Người dùng", data.metrics?.totalUsers, "◎"],
      ["Online realtime", data.metrics?.onlineVisitors, "●"],
      ["Incident mở", data.metrics?.openIncidents, "!"],
      ["Trust queue", data.metrics?.pendingTrust, "◇"],
      ["Background jobs", data.metrics?.pendingJobs, "↻"],
      ["Jobs thất bại", data.metrics?.failedJobs, "×"]
    ].map(([label, value, icon]) => `<article><i>${icon}</i><span><small>${esc(label)}</small><strong>${Number(value || 0).toLocaleString("vi-VN")}</strong></span></article>`).join("");
    const missionPlanets = PLANETS.filter((planet) => has(planet.permission)).map((planet, index) => {
      const related = (data.actionQueue || []).filter((item) => item.targetView === planet.id).length;
      const state = related ? ((data.actionQueue || []).some((item) => item.targetView === planet.id && ["critical", "high"].includes(item.severity)) ? "critical" : "warning") : "operational";
      return `<button type="button" data-admin-view="${planet.id}" class="hh-admin-orbit-planet planet-${index + 1} ${state}" style="--planet:${planet.color};--orbit-index:${index}"><i>${planet.icon}</i><span>${esc(planet.label)}</span><b>${related}</b></button>`;
    }).join("");
    const services = (data.services || []).map((item) => `<article class="${esc(item.status)}"><i></i><span><strong>${esc(item.name)}</strong><small>${esc(item.detail)}</small></span><b>${esc(statusLabel(item.status))}</b></article>`).join("");
    const actions = (data.actionQueue || []).map((item) => `<article class="${esc(item.severity)}"><i>${item.severity === "critical" ? "!" : "◇"}</i><span><strong>${esc(item.title)}</strong><small>${esc(item.source)} · ${esc(statusLabel(item.status))}${item.assignee ? ` · ${esc(item.assignee)}` : " · Chưa phân công"}</small><p>${esc(item.description)}</p></span><button type="button" data-admin-view="${esc(item.targetView)}">Mở</button></article>`).join("") || '<p class="hh-admin-empty">Không có công việc khẩn cấp. Các tín hiệu đang ổn định.</p>';
    const changes = (data.recentChanges || []).map((item) => `<article><i>◈</i><span><strong>${esc(item.action)}</strong><small>${esc(item.admin)} · ${esc(item.targetType)} / ${esc(item.targetId)}</small><p>${esc(item.reason || "Thay đổi đã ghi audit")}</p></span><time>${dateText(item.createdAt)}</time></article>`).join("") || '<p class="hh-admin-empty">Chưa có thay đổi quản trị.</p>';
    const content = `<section class="hh-admin-mission" data-health="${healthState}">
      <section class="hh-admin-mission-map">
        <header><span><small>GALAXY MISSION CONTROL</small><strong>HH Platform đang ${healthState === "operational" ? "vận hành ổn định" : healthState === "warning" ? "cần theo dõi" : "có vấn đề ưu tiên"}</strong></span><b class="${healthState}"><i></i>${esc(statusLabel(healthState))}</b></header>
        <div class="hh-admin-orbit-system">
          <span class="hh-admin-orbit-ring ring-one"></span><span class="hh-admin-orbit-ring ring-two"></span><span class="hh-admin-orbit-ring ring-three"></span>
          <div class="hh-admin-core-star ${Number(data.metrics?.criticalIncidents || 0) ? "has-flare" : ""}" style="--score:${score}"><i data-hh-galaxy-logo data-galaxy-logo-size="70px"><img class="hh-galaxy-logo-fallback" src="assets/brand/hh-galaxy-star-static.svg?v=1" alt="" width="70" height="70"></i><span><strong>${score}</strong><small>HEALTH SCORE</small></span></div>
          ${missionPlanets}
        </div>
        <footer>${metrics}</footer>
      </section>
      <aside class="hh-admin-action-queue">
        <header><span><small>PRIORITY SIGNALS</small><strong>Action Queue</strong></span><b>${Number(data.actionQueue?.length || 0)} việc</b></header>
        ${data.continueIncident ? `<button class="hh-admin-continue" type="button" data-admin-view="${esc(data.continueIncident.targetView)}"><i>▶</i><span><strong>Tiếp tục xử lý sự cố gần nhất</strong><small>${esc(data.continueIncident.title)}</small></span></button>` : ""}
        <div>${actions}</div>
      </aside>
    </section>
    <section class="hh-admin-command-grid">
      <article class="hh-admin-service-reactor"><header><span><small>LIVE SERVICE MATRIX</small><strong>Sức khỏe nền tảng</strong></span><time>${dateText(data.generatedAt)}</time></header><div>${services}</div></article>
      <article class="hh-admin-change-stream"><header><span><small>AUDITED CHANGE STREAM</small><strong>Thay đổi gần nhất</strong></span><button type="button" data-admin-view="audit">Mở audit</button></header><div>${changes}</div></article>
    </section>
    <section class="hh-admin-deploy-strip"><span><i></i><strong>${esc(data.deployment?.provider || "Deployment")}</strong><small>${esc(data.deployment?.environment || "production")} · ${esc((data.deployment?.commitSha || "commit chưa xác định").slice(0, 8))}</small></span><p>${esc(data.deployment?.commitMessage || "Thông tin deployment được đọc từ runtime, không phỏng đoán.")}</p><button type="button" data-admin-view="platform">Platform & Release →</button></section>`;
    panelRef.innerHTML = shell(content, "Galaxy Mission Control", "Sức khỏe website, incident, hành động ưu tiên và thay đổi production trong một quỹ đạo.");
  }

  async function renderIdentity() {
    panelRef.innerHTML = shell(loading("Đang xác minh danh tính và ma trận quyền..."), "Identity & Access");
    const data = await api("identity");
    const metrics = [
      ["Tổng tài khoản", data.metrics?.totalUsers, "◎"],
      ["Phiên hợp lệ", data.metrics?.activeSessions, "◉"],
      ["Quản trị viên", data.metrics?.administrators, "A"],
      ["Tài khoản hạn chế", data.metrics?.lockedAccounts, "!"]
    ].map(([label, value, icon]) => `<article><i>${icon}</i><small>${esc(label)}</small><strong>${Number(value || 0).toLocaleString("vi-VN")}</strong></article>`).join("");
    const users = (data.users || []).map((item) => `<article><i>${item.avatar ? `<img src="${esc(item.avatar)}" alt="">` : esc((item.name || "HH").slice(0, 2).toUpperCase())}</i><span><strong>${esc(item.name || "Chưa đặt tên")}</strong><small>${esc(item.email)} · ${esc(item.provider)} · ${item.verified ? "Đã xác minh" : "Chưa xác minh"}</small></span><b class="${esc(item.status)}">${esc(item.roles.join(", ") || item.status)}</b><button type="button" data-admin-user-open="${esc(item.id)}">Mở hồ sơ</button></article>`).join("") || '<p class="hh-admin-empty">Chưa có tài khoản.</p>';
    const roles = (data.roles || []).map((role) => `<article class="${role.id === "owner" ? "owner" : ""}"><header><span><i>${role.id === "owner" ? "★" : "◇"}</i><strong>${esc(role.label)}</strong></span><b>${role.permissionCount === "all" ? "Toàn quyền" : `${Number(role.permissionCount)} quyền`}</b></header><p>${role.permissions.includes("*") ? "Toàn bộ hành động quản trị, chỉ cấp từ allowlist phía server." : role.permissions.map((permission) => `<code>${esc(permission)}</code>`).join("")}</p></article>`).join("");
    const policyChecks = [
      ["Google verified identity", data.policy?.googleVerificationRequired],
      ["Owner từ môi trường server", data.policy?.ownerSource === "server-environment"],
      ["Chặn quản trị tài khoản ngang/cao hơn", data.policy?.equalOrHigherRoleProtection],
      ["Bắt buộc lý do cho hành động nhạy cảm", data.policy?.reasonRequiredForSensitiveActions],
      ["Audit bất biến theo chuỗi SHA-256", data.policy?.immutableAuditChain],
      ["Hai người duyệt thao tác tối quan trọng", Number(data.policy?.criticalActionApprovals || 0) === 2]
    ].map(([label, ready]) => `<span class="${ready ? "ready" : "missing"}"><i>${ready ? "✓" : "!"}</i>${esc(label)}</span>`).join("");
    const content = `${governanceNav()}
      <section class="hh-admin-identity-metrics">${metrics}</section>
      <section class="hh-admin-identity-grid">
        <article class="hh-admin-access-policy"><header><span><small>ZERO-TRUST ACCESS</small><strong>Chính sách danh tính</strong></span><b>${Number(data.policy?.ownerCount || 0)} Super Admin</b></header><div>${policyChecks}</div><p>Hai Super Admin hiện tại được xác định từ email Google đã xác minh. Vai trò giao diện không thể tự cấp quyền.</p></article>
        <article class="hh-admin-recent-users"><header><span><small>RECENT IDENTITIES</small><strong>Tài khoản gần đây</strong></span><button type="button" data-admin-view="users">Quản lý tất cả</button></header><div>${users}</div></article>
      </section>
      <section class="hh-admin-role-matrix"><header><span><small>PRIVILEGE MATRIX</small><strong>Vai trò và quyền theo tác vụ</strong></span><p>Owner không thể được cấp từ Admin Panel.</p></header><div>${roles}</div></section>`;
    panelRef.innerHTML = shell(content, "Identity & Access", "Danh tính Google đã xác minh, phiên đăng nhập và quyền chi tiết theo từng tác vụ.");
  }

  function governanceNav() {
    return subnav([
      ["identity", "Tổng quan IAM"],
      ["effective-access", "Effective Access", "users.view"],
      ["role-assignments", "Role Assignments", "users.roles"],
      ["access-requests", "Access Requests", "users.roles"],
      ["role-history", "Role History", "users.roles"],
      ["service-accounts", "Service Accounts", "identity.service-accounts.manage"],
      ["sessions", "Sessions & Devices", "users.view"],
      ["power", "Root Authority", "dashboard.view"]
    ]);
  }

  function securityNav() {
    return subnav([["security", "Findings"], ["privacy", "Privacy & Consent", "privacy.view"], ["sessions", "Sessions & Devices", "users.view"], ["adapter-health", "Adapter Health", "platform.view"], ["audit", "Audit log", "audit.view"]]);
  }

  function platformNav() {
    return subnav([["platform", "Platform Health"], ["workspace", "Workspaces", "platform.view"], ["adapter-health", "Adapter Health", "platform.view"], ["integrations", "Integration Registry", "platform.view"], ["settings", "Flags & Config", "config.manage"], ["audit", "Release Audit", "audit.view"]]);
  }

  function governanceCard(label, value, detail, tone = "cyan") {
    return `<article class="hh-admin-governance-metric ${esc(tone)}"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(detail)}</span></article>`;
  }

  async function renderGovernance(view = activeView) {
    panelRef.innerHTML = shell(loading("Đang hợp nhất quyền, phiên và governance..."), "Identity Governance");
    const data = await api(view);
    if (["access-governance", "effective-access", "role-assignments", "role-history", "access-requests"].includes(view)) {
      const accessData = data.effectiveAccess || {};
      const assignments = Array.isArray(data.assignments) ? data.assignments : [];
      const requests = Array.isArray(data.requests) ? data.requests : [];
      const permissionRows = (accessData.permissions || []).map((permission) => `<span class="hh-admin-chip">${esc(permission)}</span>`).join("") || '<span class="hh-admin-empty">Chưa có permission hiệu lực.</span>';
      const assignmentRows = assignments.map((item) => `<article class="hh-admin-governance-row ${esc(item.status)}"><span><strong>${esc(item.roleId)}</strong><small>v${Number(item.roleVersion || 1)} · ${esc(item.scope?.type || "global")} ${esc(item.workspaceId || "")}</small></span><span><small>Cấp lúc</small><b>${dateText(item.grantedAt)}</b></span><span><small>Hết hạn</small><b>${item.expiresAt ? dateText(item.expiresAt) : "Không hết hạn"}</b></span><span><small>Trạng thái</small><b>${esc(statusLabel(item.status))}</b></span>${item.status === "active" && has("users.roles") ? `<button type="button" data-admin-assignment-revoke="${esc(item.id)}" data-admin-assignment-user="${esc(item.userId)}">Thu hồi</button>` : ""}</article>`).join("") || '<p class="hh-admin-empty">Chưa có assignment nào.</p>';
      const requestRows = requests.map((item) => `<article class="hh-admin-governance-row ${esc(item.status)}"><span><strong>${esc(item.permission)}</strong><small>${esc(item.action)} · ${esc(item.scope?.type || "global")}</small></span><span><small>Người yêu cầu</small><b>${esc(item.requesterId || "-")}</b></span><span><small>Lý do</small><b>${esc(item.reason || "-")}</b></span><span><small>Trạng thái</small><b>${esc(statusLabel(item.status))}</b></span>${item.status === "pending" && has("users.roles") ? `<button type="button" data-admin-access-decision="approve" data-admin-access-request-id="${esc(item.id)}">Duyệt</button><button type="button" data-admin-access-decision="reject" data-admin-access-request-id="${esc(item.id)}">Từ chối</button>` : ""}</article>`).join("") || '<p class="hh-admin-empty">Chưa có access request.</p>';
      const title = view === "effective-access" ? "Effective Access" : view === "role-assignments" ? "Role Assignments" : view === "access-requests" ? "Access Requests" : view === "role-history" ? "Role History" : "Access Governance";
      const body = `<section class="hh-admin-governance-metrics">${governanceCard("Vai trò hiệu lực", String((accessData.roles || []).length), "Bao gồm role server và role custom", "violet")}${governanceCard("Permission", accessData.permissionCount === "all" ? "ALL" : String(accessData.permissionCount || 0), "Tính từ policy server-side", "cyan")}${governanceCard("Assignments", String(assignments.length), "Có scope và thời hạn", "green")}${governanceCard("Access requests", String(requests.length), "Được ghi audit", "gold")}</section>
        <section class="hh-admin-governance-grid"><article class="hh-admin-governance-panel"><header><span><small>EFFECTIVE PERMISSIONS</small><strong>Quyền đang có</strong></span><b>${esc(accessData.source || "server")}</b></header><div class="hh-admin-chip-list">${permissionRows}</div></article><article class="hh-admin-governance-panel"><header><span><small>TARGET</small><strong>${esc(data.target?.name || data.target?.email || "Tài khoản hiện tại")}</strong></span><button type="button" data-admin-access-request>Yêu cầu quyền</button></header><p class="hh-admin-governance-note">Scope được áp dụng ở backend. Không hiển thị secret, token hoặc dữ liệu riêng tư.</p><div class="hh-admin-governance-facts"><span><small>User ID</small><b>${esc(data.target?.id || "-")}</b></span><span><small>Role</small><b>${esc((accessData.roles || []).join(", ") || "member")}</b></span></div></article></section>
        <section class="hh-admin-governance-panel"><header><span><small>${view === "access-requests" ? "REQUEST QUEUE" : "ROLE ASSIGNMENTS"}</small><strong>${view === "access-requests" ? "Yêu cầu truy cập" : "Assignment và thời hạn"}</strong></span>${has("users.roles") ? '<button type="button" data-admin-assignment-create>＋ Gán custom role</button>' : ""}</header><div class="hh-admin-governance-list">${view === "access-requests" ? requestRows : assignmentRows}</div></section>
        <section class="hh-admin-governance-panel"><header><span><small>ROLE DEFINITIONS</small><strong>Phiên bản role đã publish</strong></span><span>${Number((data.definitions || []).length)} definitions</span></header><div class="hh-admin-governance-list">${(data.definitions || []).map((item) => `<article class="hh-admin-governance-row"><span><strong>${esc(item.name || item.roleId)}</strong><small>${esc(item.roleId)} · v${Number(item.version || 1)}</small></span><span><small>Status</small><b>${esc(statusLabel(item.status))}</b></span><span><small>Quyền</small><b>${Number((item.permissions || []).length)}</b></span><span><small>Cập nhật</small><b>${dateText(item.updatedAt)}</b></span></article>`).join("") || '<p class="hh-admin-empty">Chưa có version custom role.</p>'}</div></section>`;
      panelRef.innerHTML = shell(`${governanceNav()}${body}`, title, "Phân quyền theo role, scope, thời hạn và audit; mọi quyết định đều được backend kiểm tra lại.");
      return;
    }
    if (["adapter-health", "integrations"].includes(view)) {
      const adapters = data.adapters || [];
      const rows = adapters.map((item) => `<article class="hh-admin-adapter-row ${esc(item.state)}"><span class="hh-admin-adapter-orb">${item.canExecute ? "✓" : item.configured ? "◇" : "!"}</span><span><strong>${esc(item.label)}</strong><small>${esc(item.id)} · ${item.requiredEnv?.length ? `Cần ${item.requiredEnv.join(", ")}` : "Không có secret client"}</small></span><b>${item.stale ? "Health stale" : esc(statusLabel(item.state === "configured" ? "warning" : item.state))}</b><span><small>Last check</small><b>${item.lastCheckedAt ? dateText(item.lastCheckedAt) : "Chưa kiểm tra"}</b></span><button type="button" data-admin-adapter-health="${esc(item.id)}">Kiểm tra cấu hình</button></article>`).join("") || '<p class="hh-admin-empty">Chưa có adapter.</p>';
      panelRef.innerHTML = shell(`${platformNav()}<section class="hh-admin-governance-metrics">${governanceCard("Adapter", String(adapters.length), "Registry server-side", "violet")}${governanceCard("Configured", String(adapters.filter((item) => item.configured).length), "Có đủ biến môi trường", "green")}${governanceCard("Write ready", String(adapters.filter((item) => item.canExecute).length), "Chỉ khi đã verify write", "cyan")}${governanceCard("Verified", "0", "Chưa tự tuyên bố provider verified", "gold")}</section><section class="hh-admin-governance-panel"><header><span><small>ADAPTER REGISTRY</small><strong>Trạng thái kết nối production</strong></span><b>Không trả secret</b></header><div class="hh-admin-adapter-list">${rows}</div></section><section class="hh-admin-boundary"><i>◈</i><span><strong>Configuration-only health check</strong><small>“Đã cấu hình” không đồng nghĩa đã kiểm tra kết nối hoặc đã thực thi thành công. Mutation provider chỉ chạy qua adapter contract và approval phù hợp.</small></span></section>`, view === "integrations" ? "Integration Registry" : "Adapter Health", "Registry adapter minh bạch: chưa cấu hình, đã cấu hình, health check và write verification được tách riêng.");
      return;
    }
    if (view === "service-accounts") {
      const accounts = data.serviceAccounts || [];
      const rows = accounts.map((item) => `<article class="hh-admin-governance-row ${esc(item.status)}"><span><strong>${esc(item.name)}</strong><small>${esc(item.environment)} · ${esc(item.workspaceId || "global")}</small></span><span><small>Scope</small><b>${Number(item.scopes?.length || 0)} quyền</b></span><span><small>Token</small><b>${Number(item.tokenCount || 0)} active</b></span><span><small>Hết hạn</small><b>${item.expiresAt ? dateText(item.expiresAt) : "Không hết hạn"}</b></span><span><small>Tạo lúc</small><b>${dateText(item.createdAt)}</b></span>${item.status === "active" && has("identity.service-accounts.manage") ? `<button type="button" data-admin-service-rotate="${esc(item.id)}">Xoay token</button><button type="button" data-admin-service-revoke="${esc(item.id)}">Thu hồi</button>` : ""}</article>`).join("") || '<p class="hh-admin-empty">Chưa có service account.</p>';
      panelRef.innerHTML = shell(`${governanceNav()}<section class="hh-admin-governance-panel"><header><span><small>NON-HUMAN IDENTITIES</small><strong>Service Accounts & API Tokens</strong></span>${has("identity.service-accounts.manage") ? '<button type="button" data-admin-service-account-create>＋ Tạo service account</button>' : ""}</header><p class="hh-admin-governance-note">Token chỉ hiển thị đúng một lần sau khi tạo. Audit và API không bao giờ trả plaintext token.</p><div class="hh-admin-governance-list">${rows}</div></section>`, "Service Accounts", "Danh tính máy chủ, scope, workspace binding, expiration và token rotation an toàn.");
      return;
    }
    if (["sessions", "devices"].includes(view)) {
      const sessions = data.sessions || [];
      const rows = sessions.map((item) => `<article class="hh-admin-governance-row ${item.revokedAt ? "revoked" : "active"}"><span><strong>${esc(item.device || "Thiết bị không xác định")}</strong><small>${esc(item.browser || "Browser")} · ${esc(item.provider || "session")}</small></span><span><small>Hoạt động</small><b>${dateText(item.lastSeenAt)}</b></span><span><small>Hết hạn</small><b>${dateText(item.expiresAt)}</b></span><span><small>Network</small><b>Đã che</b></span>${!item.revokedAt && !item.current && has("sessions.revoke") ? `<button type="button" data-admin-session-revoke="${esc(item.id)}">Thu hồi</button>` : `<b>${item.revokedAt ? "Đã thu hồi" : "Phiên hiện tại"}</b>`}</article>`).join("") || '<p class="hh-admin-empty">Không có phiên đang hoạt động.</p>';
      panelRef.innerHTML = shell(`${securityNav()}<section class="hh-admin-governance-panel"><header><span><small>SESSION CENTER</small><strong>Sessions & Devices</strong></span><b>IP và token luôn được che</b></header><div class="hh-admin-governance-list">${rows}</div></section>`, "Sessions & Devices", "Thu hồi từng phiên, theo dõi thiết bị và giữ nguyên ranh giới dữ liệu riêng tư.");
      return;
    }
    if (view === "workspace") {
      const workspaces = data.workspaces || [];
      const rows = workspaces.map((item) => `<article class="hh-admin-governance-row ${esc(item.status)}"><span><strong>${esc(item.name || item.slug || item.id)}</strong><small>${esc(item.slug || item.id)} · owner ${esc(item.ownerId || "-")}</small></span><span><small>Members</small><b>${Number(item.memberCount || 0)}</b></span><span><small>Modules</small><b>${Number(item.moduleIds?.length || 0)}</b></span><span><small>AI budget</small><b>${Number(item.aiBudget || 0).toLocaleString("vi-VN")}</b></span><span><small>Status</small><b>${esc(statusLabel(item.status))}</b></span></article>`).join("") || '<p class="hh-admin-empty">Chưa có workspace.</p>';
      panelRef.innerHTML = shell(`${platformNav()}<section class="hh-admin-governance-panel"><header><span><small>WORKSPACE MANAGER</small><strong>Workspace & Organization</strong></span>${has("platform.manage") ? '<button type="button" data-admin-workspace-create>＋ Tạo workspace</button>' : '<b>Owner/workspace isolation</b>'}</header><p class="hh-admin-governance-note">Dữ liệu workspace được cách ly bằng ownerId + workspaceId. Thay đổi ownership hoặc xóa workspace cần workflow elevated/dual approval.</p><div class="hh-admin-governance-list">${rows}</div></section>`, "Workspace Manager", "Workspace, module access, quota, AI budget và audit được quản lý tách biệt.");
      return;
    }
    if (view === "ai-operations") {
      const providers = data.providers || [];
      const rows = providers.map((item) => `<article class="hh-admin-governance-row"><span><strong>${esc(item.provider)}</strong><small>${Number(item.requests || 0).toLocaleString("vi-VN")} requests</small></span><span><small>Units</small><b>${Number(item.units || 0).toLocaleString("vi-VN")}</b></span><span><small>Lỗi</small><b>${Number(item.failures || 0)}</b></span><span><small>Window</small><b>${Number(data.windowDays || 30)} ngày</b></span></article>`).join("") || '<p class="hh-admin-empty">Chưa có usage AI.</p>';
      const budgets = (data.budgets || []).map((item) => `<span class="hh-admin-chip"><strong>${esc(item.key)}</strong> · ${esc(String(item.value))}</span>`).join("") || '<span class="hh-admin-empty">Chưa có budget policy.</span>';
      panelRef.innerHTML = shell(`${subnav([["growth", "Growth Overview"], ["ai-operations", "AI Operations"], ["adapter-health", "Adapter Health", "platform.view"], ["data-governance", "Data Governance", "privacy.view"]])}<section class="hh-admin-governance-panel"><header><span><small>AI OPERATIONS · 30D</small><strong>Provider health và budget</strong></span><b>API keys không hiển thị</b></header><div class="hh-admin-governance-list">${rows}</div><div class="hh-admin-chip-list">${budgets}</div></section>`, "AI Operations", "Usage, lỗi, budget và fallback ở dạng aggregate; không hiển thị prompt hoặc khóa API.");
      return;
    }
    if (view === "data-governance") {
      const policies = data.policies || [];
      panelRef.innerHTML = shell(`${securityNav()}<section class="hh-admin-governance-panel"><header><span><small>DATA GOVERNANCE</small><strong>Retention, legal hold và privacy boundary</strong></span><b>Không có raw content</b></header><div class="hh-admin-governance-list">${policies.map((item) => `<article class="hh-admin-governance-row"><span><strong>${esc(item.key)}</strong><small>${esc(String(item.value))}</small></span><span><small>Cập nhật</small><b>${dateText(item.updatedAt)}</b></span><span><small>Consumer</small><b>${esc(item.enforcementState || "no_consumer")}</b></span></article>`).join("") || '<p class="hh-admin-empty">Chưa có data policy.</p>'}</div><section class="hh-admin-boundary"><i>◈</i><span><strong>Privacy boundary</strong><small>Không hiển thị mật khẩu, token, IP đầy đủ, raw prompt, private message hoặc nội dung chat.</small></span></section></section>`, "Data Governance", "Minh bạch retention và ranh giới dữ liệu; quyết định cuối cùng luôn ở server.");
    }
  }

  async function renderPower() {
    panelRef.innerHTML = shell(loading("Đang mở Root Authority Console..."), "Root Authority Console");
    const [data, identity] = await Promise.all([api("control-plane"), api("identity")]);
    customAdminRoles = identity.customRoles || [];
    const capabilityGroups = [...new Set((data.capabilities || []).map((item) => item.group))];
    const capabilities = capabilityGroups.map((group) => {
      const items = (data.capabilities || []).filter((item) => item.group === group);
      return `<article class="hh-admin-power-sector"><header><span><small>${esc(group.toUpperCase())}</small><strong>${esc(group)}</strong></span><b>${items.filter((item) => item.connected).length}/${items.length} adapter</b></header><div>${items.map((item) => `<section class="${esc(item.tier)} ${item.connected ? "connected" : "adapter-needed"}"><i>${item.tier === "critical" ? "!" : item.connected ? "✓" : "◇"}</i><span><strong>${esc(item.label)}</strong><small>${esc(item.adapterLabel)} · ${item.tier === "critical" ? "phê duyệt kép" : "quyền tạm thời"}</small></span>${item.allowed ? `<button type="button" data-admin-control="${esc(item.id)}" data-control-tier="${esc(item.tier)}" data-control-connected="${item.connected ? "true" : "false"}">${item.tier === "critical" ? "Tạo yêu cầu" : "Điều khiển"}</button>` : '<b class="denied">Không có quyền</b>'}</section>`).join("")}</div></article>`;
    }).join("");
    const adapters = (data.adapters || []).map((item, index) => `<article class="${item.connected ? "connected" : "missing"}" style="--satellite-index:${index}"><i>${item.connected ? "✓" : "◇"}</i><span><strong>${esc(item.label)}</strong><small>${esc(item.id)} · ${item.connected ? "đã kết nối" : "cần cấu hình server"}</small></span></article>`).join("");
    const approvals = (data.approvals || []).map((item) => `<article class="${esc(item.status)}"><i>${item.tier === "critical" ? "!" : "◇"}</i><span><strong>${esc(item.label)}</strong><small>${esc(item.requestedBy?.email)} · ${Number(item.approvals?.length || 0)}/${Number(item.requiredApprovals || 2)} phê duyệt</small><p>${esc(item.reason)}</p></span><div><b>${esc(item.status)}</b>${item.canApprove && has("approvals.approve") ? `<button type="button" data-admin-approval="${esc(item.id)}" data-approval-decision="approve">Phê duyệt</button><button type="button" data-admin-approval="${esc(item.id)}" data-approval-decision="reject">Từ chối</button>` : item.status === "pending" ? "<small>Chờ Super Admin còn lại</small>" : ""}</div></article>`).join("") || '<p class="hh-admin-empty">Không có yêu cầu tối quan trọng đang chờ.</p>';
    const policies = (data.policies || []).map((item) => `<article class="${item.enforcementState === "no_consumer" ? "warning" : ""}"><i>◆</i><span><strong>${esc(item.key)}</strong><small>${esc(String(item.value))} · ${dateText(item.updatedAt)}</small><small>${item.enforcementState === "no_consumer" ? "Chưa có enforcement consumer" : `Consumer: ${esc(item.consumer || "server")}`}</small></span></article>`).join("") || '<p class="hh-admin-empty">Chưa có chính sách điều khiển tùy chỉnh.</p>';
    const permissionGroups = [...new Set((identity.permissionCatalog || []).map((item) => item.group))].map((group, index) => {
      const permissions = (identity.permissionCatalog || []).filter((item) => item.group === group);
      const critical = permissions.filter((item) => item.tier === "critical").length;
      return `<article style="--constellation-index:${index}"><i>${String(index + 1).padStart(2, "0")}</i><span><strong>${esc(group)}</strong><small>${permissions.length} quyền · ${critical} tối quan trọng</small></span><b>${critical ? "!" : "✓"}</b></article>`;
    }).join("");
    const roles = customAdminRoles.map((role) => `<article><span><strong>${esc(role.name)}</strong><small>custom:${esc(role.key)} · v${Number(role.version || 1)} · ${role.permissions.length} quyền · ${esc(role.status || "active")}</small></span><b class="${Number(role.simulation?.riskScore || 0) >= 50 ? "high" : ""}">Risk ${Number(role.simulation?.riskScore || 0)}</b>${has("roles.custom.manage") ? `<button type="button" data-admin-role-lifecycle="publish" data-admin-role-key="${esc(role.key)}">Publish</button><button type="button" data-admin-role-lifecycle="disable" data-admin-role-key="${esc(role.key)}">Disable</button><button type="button" data-admin-role-lifecycle="rollback" data-admin-role-key="${esc(role.key)}" data-admin-role-version="${Number(role.version || 1)}">Rollback</button>` : ""}</article>`).join("") || '<p class="hh-admin-empty">Chưa tạo vai trò tùy chỉnh.</p>';
    const content = `${subnav([["identity", "IAM Overview"], ["power", "Root Authority"], ["users", "Người dùng", "users.view"], ["audit", "Tamper-evident Audit", "audit.view"]])}
      <section class="hh-admin-root-hero">
        <div><small>ROOT AUTHORITY SESSION</small><strong>${privilege.active ? `Quyền nâng cao đang hoạt động · ${Number(privilege.minutesRemaining || 0)} phút` : "Đang dùng quyền thường trực"}</strong><p>Quyền nâng cao cần đăng nhập Google gần đây; thao tác tối quan trọng cần hai Super Admin khác nhau.</p><span><b>${privilege.googleReauthRecent ? "Google reauth sẵn sàng" : "Cần đăng nhập lại Google"}</b><b>Tamper-evident SHA-256 chain</b></span></div>
        <aside><i>⚡</i><strong>Privilege Elevation</strong><p>15, 30 hoặc 60 phút. Tự hết hạn và luôn lưu lý do.</p>${privilege.active ? `<b>Hết hạn ${dateText(privilege.expiresAt)}</b>` : '<button type="button" data-admin-privilege-activate>Kích hoạt quyền nâng cao</button>'}</aside>
      </section>
      <section class="hh-admin-safety-strip" aria-label="Bảo vệ vận hành Admin">
        <article><i>01</i><span><strong>Atomic approval claim</strong><small>Một yêu cầu chỉ có một tiến trình được quyền thực thi.</small></span></article>
        <article><i>02</i><span><strong>Network metadata shield</strong><small>IP và User-Agent mặc định được che theo quyền.</small></span></article>
        <article><i>03</i><span><strong>Truthful audit integrity</strong><small>Phát hiện chỉnh sửa; chưa tuyên bố WORM hoặc immutable.</small></span></article>
        <article><i>04</i><span><strong>Manual recovery state</strong><small>Lỗi adapter được giữ để điều tra, không tự chạy lại mù quáng.</small></span></article>
      </section>
      <section class="hh-admin-root-grid">
        <article class="hh-admin-permission-constellation"><header><span><small>PERMISSION CONSTELLATION</small><strong>Bản đồ quyền toàn hệ thống</strong></span><div><button type="button" data-admin-permission-simulate>Permission Simulator</button><button type="button" data-admin-custom-role>Tạo custom role</button></div></header><div>${permissionGroups}</div></article>
        <article class="hh-admin-infrastructure-map"><header><span><small>LIVE INFRASTRUCTURE MAP</small><strong>Provider và adapter</strong></span><b>${Number(data.infrastructure?.databaseCollections || 0)} collections</b></header><div><span class="hh-admin-infra-core"><i data-hh-galaxy-logo data-galaxy-logo-size="38px"><img class="hh-galaxy-logo-fallback" src="assets/brand/hh-galaxy-star-static.svg?v=1" alt="" width="38" height="38"></i><strong>${esc(data.infrastructure?.environment || "production")}</strong></span>${adapters}</div></article>
      </section>
      <section class="hh-admin-power-grid">${capabilities}</section>
      <section class="hh-admin-approval-grid">
        <article class="hh-admin-approval-queue"><header><span><small>DUAL CONTROL</small><strong>Yêu cầu cần hai Super Admin</strong></span><b>${Number(data.approvals?.length || 0)} hồ sơ</b></header><div>${approvals}</div></article>
        <article class="hh-admin-policy-stream"><header><span><small>ACTIVE CONTROL POLICIES</small><strong>Chính sách đang lưu</strong></span><b>Không chứa secret</b></header><div>${policies}</div></article>
      </section>
      <section class="hh-admin-custom-role-strip"><header><span><small>CUSTOM ADMIN ROLES</small><strong>Vai trò tùy chỉnh đang hoạt động</strong></span><button type="button" data-admin-custom-role>＋ Tạo vai trò</button></header><div>${roles}</div></section>`;
    panelRef.innerHTML = shell(content, "Root Authority Console", "Quyền tùy chỉnh, nâng quyền tạm thời, phê duyệt kép và điều khiển hạ tầng trong một trung tâm.");
  }

  async function renderSecurity() {
    panelRef.innerHTML = shell(loading("Đang hợp nhất phát hiện bảo mật..."), "Security Command Center");
    const [data, incidents] = await Promise.all([api("security"), api("incidents")]);
    const postureLabels = {
      ownerAllowlistConfigured: ["Owner allowlist", "Chỉ cấp owner từ biến môi trường"],
      jwtConfigured: ["JWT secret", "Secret tối thiểu 32 ký tự"],
      otpSecretConfigured: ["OTP signing", "Khóa ký OTP độc lập"],
      captchaConfigured: ["Adaptive CAPTCHA", "Bật khi đăng nhập có dấu hiệu bất thường"],
      securityEmailConfigured: ["Security email", "Cảnh báo thiết bị và khôi phục tài khoản"],
      passkeyConfigured: ["Passkey", "WebAuthn theo đúng domain"],
      originPolicyConfigured: ["Origin policy", "Allowlist CORS và chống CSRF"]
    };
    const checks = Object.entries(postureLabels).map(([key, [label, detail]]) => {
      const enabled = Boolean(data.posture?.[key]);
      return `<article class="${enabled ? "ready" : "missing"}"><i>${enabled ? "✓" : "!"}</i><span><strong>${esc(label)}</strong><small>${esc(detail)}</small></span><b>${enabled ? "Sẵn sàng" : "Cần cấu hình"}</b></article>`;
    }).join("");
    const metrics = [
      ["Phiên đang hoạt động", data.metrics?.activeSessions, "cyan", "S"],
      ["Đăng nhập lỗi · 24h", data.metrics?.failedLogins24h, "red", "!"],
      ["Tài khoản hạn chế", data.metrics?.lockedAccounts, "gold", "L"],
      ["Audit · 7 ngày", data.metrics?.auditEvents7d, "green", "A"]
    ].map(([label, value, color, icon]) => `<article class="${color}"><i>${icon}</i><small>${esc(label)}</small><strong>${Number(value || 0).toLocaleString("vi-VN")}</strong><span>Dữ liệu hệ thống thật</span></article>`).join("");
    const events = (data.recentSecurityEvents || []).map((item) => `<article><i class="${item.success === false ? "error" : ""}"></i><span><strong>${esc(item.type || "auth:event")}</strong><small>${esc(item.reason || `${item.browser || "Browser"} · ${item.platform || "Thiết bị"}`)}</small></span><time>${dateText(item.createdAt)}</time></article>`).join("") || '<p class="hh-admin-empty">Chưa có sự kiện xác thực gần đây.</p>';
    const findings = (incidents.findings || []).map((item) => `<article class="${esc(item.severity)} ${esc(item.status)}"><header><span><i>${item.severity === "critical" ? "!" : "◇"}</i><b>${esc(item.severity.toUpperCase())}</b><small>${esc(item.source)}</small></span><em>${esc(statusLabel(item.status))}</em></header><strong>${esc(item.title)}</strong><p>${esc(item.description)}</p><dl><div><dt>Đối tượng</dt><dd>${esc(item.targetType)} · ${esc(item.targetId)}</dd></div><div><dt>Phụ trách</dt><dd>${esc(item.assignee || "Chưa phân công")}</dd></div><div><dt>Phát hiện</dt><dd>${dateText(item.detectedAt)}</dd></div></dl><footer><span>${esc(item.suggestedAction)}</span>${has("incidents.manage") ? `<button type="button" data-admin-incident="${esc(item.signalKey)}" data-incident-status="${esc(item.status)}" data-incident-assignee="${esc(item.assignee)}">Điều tra</button>` : ""}</footer></article>`).join("") || '<p class="hh-admin-empty">Không có finding đang hoạt động.</p>';
    const severity = ["critical", "high", "medium", "low"].map((level) => `<article class="${level}"><i></i><small>${level.toUpperCase()}</small><strong>${Number(incidents.summary?.[level] || 0)}</strong></article>`).join("");
    const focusFinding = (incidents.findings || [])[0];
    const investigation = focusFinding ? `<section class="hh-admin-investigation-workspace">
      <article><header><small>FINDING</small><strong>${esc(focusFinding.title)}</strong></header><p>${esc(focusFinding.description)}</p><dl><div><dt>Severity</dt><dd>${esc(focusFinding.severity)}</dd></div><div><dt>Resource</dt><dd>${esc(focusFinding.targetType)} · ${esc(focusFinding.targetId)}</dd></div></dl></article>
      <article><header><small>TIMELINE / LOGS</small><strong>Bằng chứng đã làm sạch</strong></header><div>${(focusFinding.timeline || []).map((entry) => `<span><i></i><strong>${esc(statusLabel(entry.status))}</strong><small>${esc(entry.note)} · ${dateText(entry.at)}</small></span>`).join("") || "<p>Chưa có cập nhật điều tra. Raw token, IP và secret không được đưa vào giao diện.</p>"}</div></article>
      <article><header><small>ACTION & AUDIT</small><strong>Bước xử lý an toàn</strong></header><p>${esc(focusFinding.suggestedAction)}</p><span><b>${esc(focusFinding.assignee || "Chưa phân công")}</b><small>${esc(statusLabel(focusFinding.status))}</small></span>${has("incidents.manage") ? `<button type="button" data-admin-incident="${esc(focusFinding.signalKey)}" data-incident-status="${esc(focusFinding.status)}" data-incident-assignee="${esc(focusFinding.assignee)}">Mở hồ sơ điều tra</button>` : ""}</article>
    </section>` : "";
    const content = `${securityNav()}
      <section class="hh-admin-severity-strip">${severity}</section>
      ${investigation}
      <section class="hh-admin-finding-layout">
        <article class="hh-admin-findings"><header><span><small>THREAT FINDINGS</small><strong>Cảnh báo và điều tra</strong></span><b>${Number(incidents.summary?.investigating || 0)} đang điều tra</b></header><div>${findings}</div></article>
        <aside class="hh-admin-security-side">
          <article class="hh-admin-security-posture"><header><div><small>SECURITY POSTURE</small><strong>Lớp bảo vệ production</strong></div><span>${Number(data.posture?.ownerEmailCount || 0) + Number(data.posture?.ownerIdCount || 0)} owner</span></header><div>${checks}</div></article>
          <article class="hh-admin-emergency"><header><small>EMERGENCY CONTROLS</small><strong>Điều khiển khẩn cấp</strong></header><button type="button" data-admin-view="users"><i>⊘</i><span><b>Thu hồi phiên tài khoản</b><small>Chọn đúng người dùng và ghi lý do</small></span></button><button type="button" data-admin-view="platform"><i>⚡</i><span><b>Feature kill switch</b><small>Tắt provider hoặc module theo cờ</small></span></button><p>Không có thao tác nguy hiểm nào được tự động áp dụng.</p></article>
        </aside>
      </section>
      <section class="hh-admin-metrics hh-admin-security-metrics">${metrics}</section>
      <section class="hh-admin-security-grid"><article class="hh-admin-event-timeline"><header><div><small>AUTHENTICATION EVENTS</small><strong>Đăng nhập và cảnh báo gần đây</strong></div><span>Không hiển thị mật khẩu hoặc secret</span></header><div>${events}</div></article></section>`;
    panelRef.innerHTML = shell(content, "Security Command Center", "Phát hiện, phân loại, điều tra và lưu timeline xử lý từ tín hiệu production đã làm sạch.");
  }

  async function renderPrivacy() {
    panelRef.innerHTML = shell(loading("Đang tải sổ đồng ý quyền riêng tư..."), "Privacy & Consent");
    const data = await api("privacy");
    const metrics = [
      ["Lựa chọn · 30 ngày", data.metrics?.decisions30d, "cyan", "◌"],
      ["Cho phép phân tích", data.metrics?.analyticsGranted30d, "green", "✓"],
      ["Cho phép cá nhân hóa", data.metrics?.personalizationGranted30d, "pink", "✦"],
      ["Từ chối tùy chọn", data.metrics?.declinedOptional30d, "gold", "—"]
    ].map(([label, value, color, icon]) => `<article class="${color}"><i>${icon}</i><small>${esc(label)}</small><strong>${Number(value || 0).toLocaleString("vi-VN")}</strong><span>Dữ liệu đồng ý, không phải cookie thô</span></article>`).join("");
    const inventory = (data.inventory || []).map((item) => `<article><header><strong>${esc(item.name)}</strong><b>${esc(item.type)}</b></header><p>${esc(item.purpose)}</p><footer><span>${esc(item.category)}</span><span>${esc(item.retention)}</span><span>${item.readableByJavaScript ? "Có thể đọc ở trình duyệt" : "HttpOnly · không đọc bằng JS"}</span></footer></article>`).join("") || '<p class="hh-admin-empty">Chưa có danh mục lưu trữ.</p>';
    const recent = (data.recent || []).map((item) => `<article><i class="${item.analytics ? "granted" : "declined"}"></i><span><strong>${esc(item.subject || "Khách ẩn danh")}</strong><small>${esc(item.kind)} · ${esc(item.source || "privacy-center")}</small></span><div><b>Analytics ${item.analytics ? "bật" : "tắt"}</b><b>Cá nhân hóa ${item.personalization ? "bật" : "tắt"}</b></div><time>${dateText(item.createdAt)}</time></article>`).join("") || '<p class="hh-admin-empty">Chưa có lựa chọn trong 30 ngày.</p>';
    const content = `${subnav([["security", "Findings", "security.view"], ["privacy", "Privacy & Consent"], ["audit", "Audit log", "audit.view"]])}<section class="hh-admin-metrics hh-admin-privacy-metrics">${metrics}</section><section class="hh-admin-privacy-grid"><article class="hh-admin-privacy-inventory"><header><div><small>FIRST-PARTY INVENTORY</small><strong>Website đang lưu gì</strong></div><span>Policy ${esc(data.policyVersion || "privacy-v1")}</span></header><div>${inventory}</div></article><article class="hh-admin-privacy-decisions"><header><div><small>CONSENT AUDIT</small><strong>Lựa chọn gần đây</strong></div><span>TTL 365 ngày</span></header><div>${recent}</div></article></section><section class="hh-admin-privacy-boundary"><i>◈</i><div><strong>Ranh giới quản trị</strong><p>Admin chỉ xem thống kê, loại dữ liệu và lựa chọn đã đồng ý. Không hiển thị mật khẩu, token, cookie value, raw IP, phím gõ, prompt, nội dung chat riêng hoặc cookie bên thứ ba.</p></div></section>`;
    panelRef.innerHTML = shell(content, "Privacy & Consent", "Kiểm soát dữ liệu first-party minh bạch, tối thiểu và có thể audit.");
  }

  function rankingMarkup(items, empty = "Chưa đủ dữ liệu") {
    const rows = Array.isArray(items) ? items : [];
    const max = Math.max(1, ...rows.map((item) => Number(item.count || 0)));
    return rows.map((item, index) => `<div><b>${String(index + 1).padStart(2, "0")}</b><span><strong>${esc(item.name)}</strong><i style="--value:${Math.max(4, Math.round(Number(item.count || 0) / max * 100))}%"></i></span><em>${Number(item.count || 0).toLocaleString("vi-VN")}</em></div>`).join("") || `<p class="hh-admin-empty">${esc(empty)}</p>`;
  }

  async function renderActivity({ silent = false } = {}) {
    clearTimeout(activityTimer);
    if (!silent) panelRef.innerHTML = shell(loading("Đang kết nối Users & Community realtime..."), "Users & Community");
    const data = await api("activity");
    if (!["activity", "community"].includes(activeView)) return;
    const summaryCards = [
      ["Đang hoạt động · 5 phút", data.summary?.active5, "green", "●"],
      ["Phiên · 30 phút", data.summary?.active30, "cyan", "◉"],
      ["Tài khoản online", data.summary?.registered5, "cyan", "◎"],
      ["Sự kiện · 30 phút", data.summary?.eventCount30, "pink", "↗"],
      ["Biểu mẫu đã gửi", data.summary?.formSubmits30, "green", "✓"],
      ["Lỗi xác thực form", data.summary?.validationErrors30, "red", "×"],
      ["Phiên đồng ý analytics", data.summary?.consented30, "gold", "✓"],
      ["Tín hiệu cần xem", data.summary?.riskCount, "red", "!"]
    ].map(([label, value, color, icon]) => `<article class="${color}"><i>${icon}</i><small>${label}</small><strong>${Number(value || 0).toLocaleString("vi-VN")}</strong><span>Cập nhật ${new Date(data.generatedAt).toLocaleTimeString("vi-VN")}</span></article>`).join("");
    const sessions = (data.activeSessions || []).map((item) => `<article class="hh-admin-live-session ${item.activityState}"><header><i>${item.avatar ? `<img src="${esc(item.avatar)}" alt="">` : esc((item.name || "HH").slice(0, 2).toUpperCase())}<b></b></i><span><strong>${esc(item.name)}</strong><small>${esc(item.email || (item.kind === "registered" ? "Tài khoản" : "Khách ẩn danh"))}</small></span><em>${esc(item.activityState === "idle" ? "Đang rảnh" : item.activityState === "background" ? "Nền" : "Đang dùng")}</em></header><div><code>${esc(item.route)}</code><span>${esc(item.module)}</span><span>${esc(item.label || "Chỉ ghi nhận trang hiện tại")}</span></div><footer><span>${esc(item.device)} · ${esc(item.browser)} · ${esc(item.viewport)}</span><time>${durationText(item.activeSeconds)} · ${dateText(item.lastSeenAt)}</time>${item.userId ? `<button type="button" data-admin-user-open="${esc(item.userId)}">Quản lý</button>` : ""}</footer></article>`).join("") || '<p class="hh-admin-empty">Chưa có phiên nào trong 30 phút gần nhất.</p>';
    const timeline = (data.timeline || []).map((item) => `<article><i class="${esc(item.type)}"></i><span><strong>${esc(item.label || item.action || item.type)}</strong><small>${esc(item.name)} · ${esc(item.module)} · <code>${esc(item.route)}</code>${metaText(item.meta) ? ` · ${esc(metaText(item.meta))}` : ""}</small></span><time>${dateText(item.createdAt)}</time></article>`).join("") || '<p class="hh-admin-empty">Sự kiện chi tiết chỉ xuất hiện khi người dùng đã đồng ý analytics.</p>';
    const risks = (data.riskSignals || []).map((item) => `<article class="${esc(item.level)}"><i>!</i><span><strong>${esc(item.reason)}</strong><small>${Number(item.events || 0)} sự kiện · ${Number(item.errors || 0)} lỗi · phiên ${esc(item.sessionId.slice(-8))}</small></span>${item.userId ? `<button type="button" data-admin-user-open="${esc(item.userId)}">Kiểm tra</button>` : ""}</article>`).join("") || '<p class="hh-admin-empty">Không phát hiện tần suất bất thường trong 5 phút gần nhất.</p>';
    const content = `${subnav([["community", "Live Community"], ["users", "Hồ sơ người dùng", "users.view"], ["reports", "Báo cáo", "reports.manage"]])}<section class="hh-admin-metrics hh-admin-live-metrics">${summaryCards}</section><section class="hh-admin-live-toolbar"><div><i></i><span><strong>Live monitor đang chạy</strong><small>Tự làm mới mỗi 15 giây · dữ liệu chi tiết lưu 30 ngày</small></span></div><button type="button" data-admin-activity-refresh>↻ Làm mới ngay</button></section><section class="hh-admin-behavior-grid"><article class="hh-admin-live-sessions"><header><div><small>REALTIME SESSIONS</small><strong>Người dùng đang làm gì</strong></div><span>${Number(data.summary?.active5 || 0)} live</span></header><div>${sessions}</div></article><aside class="hh-admin-rankings"><article><header><small>TOP ROUTES</small><strong>Trang được mở</strong></header>${rankingMarkup(data.topRoutes)}</article><article><header><small>TOP FEATURES</small><strong>Module được dùng</strong></header>${rankingMarkup(data.topModules)}</article><article><header><small>TOP ACTIONS</small><strong>Thao tác phổ biến</strong></header>${rankingMarkup(data.topActions)}</article></aside><article class="hh-admin-event-timeline"><header><div><small>PRIVACY-SAFE EVENT STREAM</small><strong>Dòng hoạt động đã làm sạch</strong></div><span>Không có nội dung nhập</span></header><div>${timeline}</div></article><article class="hh-admin-risk-signals"><header><div><small>HEURISTIC ALERTS</small><strong>Tín hiệu cần kiểm tra</strong></div><span>Không tự động kết luận vi phạm</span></header><div>${risks}</div></article></section>`;
    panelRef.innerHTML = shell(content, "Users & Community", "Quan sát realtime, hành trình, hồ sơ người dùng và tín hiệu cần hỗ trợ trong cùng một khu vực.");
    activityTimer = setTimeout(() => { if (["activity", "community"].includes(activeView)) renderActivity({ silent: true }).catch(() => {}); }, 15000);
  }

  async function renderUsers(query = {}) {
    userQuery = { ...userQuery, ...query };
    panelRef.innerHTML = shell(loading("Đang tải danh sách người dùng..."), "Quản lý người dùng");
    const data = await api("users", { query: userQuery });
    const rows = (data.users || []).map((item) => `<tr><td><span class="hh-admin-user"><i>${item.avatar ? `<img src="${esc(item.avatar)}" alt="">` : esc((item.name || "HH").slice(0, 2).toUpperCase())}</i><span><strong>${esc(item.name || "Chưa đặt tên")}</strong><small>${esc(item.email)}</small></span></span></td><td><span class="hh-admin-status ${esc(item.status)}">${esc(item.status)}</span></td><td>${item.verified ? "Đã xác minh" : "Chưa xác minh"}</td><td>${esc(item.roles.join(", ") || "member")}</td><td>${dateText(item.lastLoginAt)}</td><td><button type="button" data-admin-user-open="${esc(item.id)}">Quản lý</button></td></tr>`).join("") || '<tr><td colspan="6">Không tìm thấy tài khoản phù hợp.</td></tr>';
    const content = `${subnav([["identity", "Tổng quan IAM"], ["users", "Người dùng"], ["community", "Hoạt động live", "activity.view"], ["audit", "Audit quyền", "audit.view"]])}<form class="hh-admin-toolbar" data-admin-user-search><label><span>⌕</span><input name="q" value="${esc(userQuery.q || "")}" placeholder="Tìm tên hoặc email"></label><select name="status"><option value="all">Mọi trạng thái</option>${["active","locked","suspended","banned"].map((value) => `<option value="${value}" ${userQuery.status === value ? "selected" : ""}>${value}</option>`).join("")}</select><select name="role"><option value="all">Mọi vai trò</option>${["super_admin","admin","security_admin","release_manager","content_moderator","support","analyst"].map((value) => `<option value="${value}" ${userQuery.role === value ? "selected" : ""}>${value}</option>`).join("")}</select><button type="submit">Tìm kiếm</button></form><section class="hh-admin-table"><table><thead><tr><th>Tài khoản</th><th>Trạng thái</th><th>Xác minh</th><th>Vai trò</th><th>Hoạt động gần nhất</th><th></th></tr></thead><tbody>${rows}</tbody></table></section><footer class="hh-admin-pagination"><span>${Number(data.pagination?.total || 0).toLocaleString("vi-VN")} tài khoản</span><div><button type="button" data-admin-users-page="${Math.max(1, Number(data.pagination?.page || 1) - 1)}" ${Number(data.pagination?.page || 1) <= 1 ? "disabled" : ""}>Trước</button><b>${Number(data.pagination?.page || 1)}/${Number(data.pagination?.pages || 1)}</b><button type="button" data-admin-users-page="${Math.min(Number(data.pagination?.pages || 1), Number(data.pagination?.page || 1) + 1)}" ${Number(data.pagination?.page || 1) >= Number(data.pagination?.pages || 1) ? "disabled" : ""}>Sau</button></div></footer>`;
    panelRef.innerHTML = shell(content, "Quản lý người dùng", "Tìm kiếm, khóa, đình chỉ, xác minh và thu hồi phiên theo quyền.");
  }

  async function openUser(userId) {
    const data = await api("user", { query: { id: userId } });
    const item = data.user;
    const moderation = (data.moderation || []).map((entry) => `<article><i></i><span><strong>${esc(entry.action)}</strong><small>${esc(entry.admin?.name || "Admin")} · ${dateText(entry.createdAt)}</small><p>${esc(entry.reason || "Không có ghi chú")}</p></span></article>`).join("") || "<p>Chưa có lịch sử kiểm duyệt.</p>";
    const actions = `${has("users.moderate") ? `<button type="button" data-admin-user-action="status" data-user-id="${esc(item.id)}">Đổi trạng thái</button><button type="button" data-admin-user-action="verify" data-user-id="${esc(item.id)}" data-user-verified="${item.verified ? "true" : "false"}">${item.verified ? "Bỏ xác minh" : "Xác minh"}</button>` : ""}${has("sessions.revoke") ? `<button type="button" data-admin-user-action="revoke" data-user-id="${esc(item.id)}">Thu hồi mọi phiên</button>` : ""}${has("users.features") ? `<button type="button" data-admin-user-action="features" data-user-id="${esc(item.id)}" data-user-features="${esc((item.restrictedFeatures || []).join(","))}">Giới hạn tính năng</button>` : ""}${has("users.roles") ? `<button type="button" data-admin-user-action="roles" data-user-id="${esc(item.id)}">Phân quyền</button>` : ""}`;
    const sessions = (data.sessions || []).map((entry) => `<article><i><b></b></i><span><strong>${esc(entry.device)} · ${esc(entry.browser)}</strong><small>${esc(entry.route)} · ${durationText(entry.activeSeconds)} · ${dateText(entry.lastSeenAt)}</small></span></article>`).join("") || "<p>Chưa ghi nhận phiên gần đây.</p>";
    const activity = (data.activity || []).slice(0, 20).map((entry) => `<article><i class="${esc(entry.type)}"></i><span><strong>${esc(entry.label || entry.action || entry.type)}</strong><small>${esc(entry.module)} · ${esc(entry.route)}${metaText(entry.meta) ? ` · ${esc(metaText(entry.meta))}` : ""} · ${dateText(entry.createdAt)}</small></span></article>`).join("") || "<p>Chưa có sự kiện chi tiết hoặc người dùng chưa đồng ý analytics.</p>";
    const restricted = (item.restrictedFeatures || []).map((feature) => `<b>${esc(feature)}</b>`).join("") || "<span>Không giới hạn module nào.</span>";
    const dialog = modal("Hồ sơ vận hành người dùng", `<section class="hh-admin-user-detail"><header><i>${item.avatar ? `<img src="${esc(item.avatar)}" alt="">` : esc((item.name || "HH").slice(0, 2).toUpperCase())}</i><span><strong>${esc(item.name)}</strong><small>${esc(item.email)}</small><b class="hh-admin-status ${esc(item.status)}">${esc(item.status)}</b></span></header><div class="hh-admin-user-facts"><span><small>Provider</small><strong>${esc(item.provider)}</strong></span><span><small>Vai trò</small><strong>${esc(item.roles.join(", ") || "member")}</strong></span><span><small>Tạo lúc</small><strong>${dateText(item.createdAt)}</strong></span><span><small>Đăng nhập</small><strong>${dateText(item.lastLoginAt)}</strong></span></div><div class="hh-admin-user-actions">${actions}</div><section class="hh-admin-restrictions"><strong>Module đang giới hạn</strong><div>${restricted}</div></section><section class="hh-admin-boundary"><strong>Dữ liệu bị giới hạn</strong><span>Timeline có metadata biểu mẫu theo nhóm nhưng không chứa ký tự gõ, giá trị form, nội dung prompt/chat, mật khẩu hoặc token.</span></section><div class="hh-admin-user-observability"><section><h6>Phiên & thiết bị gần đây</h6><div>${sessions}</div></section><section><h6>Dòng hoạt động</h6><div>${activity}</div></section></div><section class="hh-admin-moderation"><h6>Lịch sử kiểm duyệt</h6>${moderation}</section></section>`, "Đóng");
    dialog.querySelector("footer .primary")?.addEventListener("click", () => { dialog.close(); dialog.remove(); });
  }

  async function userAction(userId, mode, currentVerified = false, currentFeatures = []) {
    if (mode === "roles") await ensurePermissionCatalog();
    const labels = { status: "Cập nhật trạng thái", verify: "Xác minh tài khoản", revoke: "Thu hồi toàn bộ phiên", roles: "Phân quyền hệ thống", features: "Giới hạn quyền dùng tính năng" };
    const roleChoices = [
      ...["super_admin","admin","security_admin","release_manager","content_moderator","support","analyst"].map((role) => [role, role]),
      ...customAdminRoles.map((role) => [`custom:${role.key}`, `${role.name} · custom`])
    ];
    const content = `${mode === "status" ? '<label><span>Trạng thái</span><select name="status"><option value="active">Hoạt động / mở khóa</option><option value="locked">Khóa</option><option value="suspended">Tạm đình chỉ</option><option value="banned">Cấm</option></select></label><label><span>Đình chỉ đến</span><input name="suspendedUntil" type="datetime-local"></label>' : ""}${mode === "verify" ? `<label><span>Trạng thái xác minh</span><select name="verified"><option value="true" ${currentVerified ? "" : "selected"}>Xác minh tài khoản</option><option value="false" ${currentVerified ? "selected" : ""}>Bỏ xác minh</option></select></label>` : ""}${mode === "roles" ? `<section class="hh-admin-role-picker">${roleChoices.map(([role, label]) => `<label><input name="roles" type="checkbox" value="${esc(role)}"><span>${esc(label)}</span></label>`).join("")}</section>` : ""}${mode === "features" ? `<label class="wide"><span>ID module cần giới hạn</span><textarea name="restrictedFeatures" maxlength="4000" placeholder="Ví dụ: ai-center, media-center, music-ai">${esc(currentFeatures.join("\n"))}</textarea><small>Mỗi dòng hoặc dấu phẩy là một ID module. Để trống để mở lại toàn bộ.</small></label>` : ""}<label class="wide"><span>Lý do bắt buộc</span><textarea name="reason" required minlength="5" maxlength="1000"></textarea></label>`;
    const dialog = modal(labels[mode], content, "Thực hiện");
    dialog.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const action = mode === "status" ? "user:status" : mode === "verify" ? "user:verify" : mode === "revoke" ? "user:revoke-sessions" : mode === "features" ? "user:feature-access" : "user:roles";
      const body = { action, userId, reason: form.get("reason"), status: form.get("status"), suspendedUntil: form.get("suspendedUntil"), verified: form.get("verified") === "true", roles: form.getAll("roles"), restrictedFeatures: String(form.get("restrictedFeatures") || "").split(/[\s,]+/).map((item) => item.trim()).filter(Boolean) };
      try { await api("action", { method: "POST", body }); dialog.close(); dialog.remove(); notice("Thao tác quản trị đã hoàn tất và được ghi audit log."); await renderUsers(); }
      catch (error) { notice(error.message, "error"); }
    });
  }

  async function renderTrust() {
    panelRef.innerHTML = shell(loading("Đang hợp nhất Content & Trust queue..."), "Content & Trust");
    const [reports, appeals, contentData] = await Promise.all([
      api("reports", { query: { status: "all", limit: 20 } }),
      api("appeals", { query: { status: "all", limit: 20 } }),
      api("content", { query: { type: "post", status: "active", limit: 20 } })
    ]);
    const reportItems = reports.items || [];
    const appealItems = appeals.items || [];
    const contentItems = contentData.items || [];
    const openReports = reportItems.filter((item) => ["pending", "escalated"].includes(item.status || "pending"));
    const openAppeals = appealItems.filter((item) => ["pending", "escalated"].includes(item.status || "pending"));
    const metrics = [
      ["Report đang mở", openReports.length, "!"],
      ["Kháng nghị đang mở", openAppeals.length, "↺"],
      ["Nội dung đã tải", contentItems.length, "▤"],
      ["Hồ sơ cần quyết định", openReports.length + openAppeals.length, "◇"]
    ].map(([label, value, icon]) => `<article><i>${icon}</i><small>${esc(label)}</small><strong>${Number(value || 0)}</strong></article>`).join("");
    const queue = [
      ...openReports.map((item) => ({ ...item, kind: "reports", label: "Report" })),
      ...openAppeals.map((item) => ({ ...item, kind: "appeals", label: "Kháng nghị" }))
    ].sort((left, right) => new Date(left.createdAt || 0) - new Date(right.createdAt || 0)).slice(0, 16).map((item) => `<article><i>${item.kind === "reports" ? "!" : "↺"}</i><span><small>${esc(item.label)} · ${esc(item.targetType || "Hồ sơ")}</small><strong>${esc(item.category || item.reason || "Yêu cầu kiểm duyệt")}</strong><p>${esc(item.description || item.message || "Không có mô tả")}</p></span><div><b class="${esc(item.status || "pending")}">${esc(item.status || "pending")}</b><time>${dateText(item.createdAt)}</time>${has(item.kind === "reports" ? "reports.manage" : "appeals.manage") ? `<button type="button" data-admin-resolve="${esc(item.id)}" data-kind="${item.kind}">Xử lý</button>` : ""}</div></article>`).join("") || '<p class="hh-admin-empty">Không có hồ sơ cần xử lý.</p>';
    const previews = contentItems.slice(0, 8).map((item) => `<article><header><span><strong>${esc(item.author?.name || "Thành viên HH")}</strong><small>${dateText(item.createdAt)} · ${esc(item.privacy || "public")}</small></span><b>${esc(item.mediaType || "post")}</b></header><p>${esc(item.content || "Nội dung media")}</p><footer><button type="button" data-admin-view="content">Mở kiểm duyệt</button></footer></article>`).join("") || '<p class="hh-admin-empty">Chưa có nội dung.</p>';
    const content = `${subnav([["trust", "Trust Queue"], ["reports", "Reports", "reports.manage"], ["appeals", "Appeals", "appeals.manage"], ["content", "Nội dung", "content.manage"], ["rights", "Quyền Comic Motion", "rights.view"]])}
      <section class="hh-admin-trust-metrics">${metrics}</section>
      <section class="hh-admin-trust-grid">
        <article class="hh-admin-unified-queue"><header><span><small>UNIFIED DECISION QUEUE</small><strong>Report và kháng nghị</strong></span><b>${openReports.length + openAppeals.length} chờ</b></header><div>${queue}</div></article>
        <aside class="hh-admin-trust-advisor"><i>AI</i><strong>Risk Advisor có kiểm soát</strong><p>Chỉ hiển thị gợi ý khi có provider backend và nguồn giải thích. Không tự động kết luận vi phạm hoặc thực hiện gỡ nội dung.</p><span><i></i>Human review bắt buộc</span><span><i></i>Soft delete & restore</span><span><i></i>Audit trước/sau</span></aside>
      </section>
      <section class="hh-admin-content-preview"><header><span><small>CONTENT SAMPLE</small><strong>Nội dung gần đây</strong></span><button type="button" data-admin-view="content">Quản lý nội dung</button></header><div>${previews}</div></section>`;
    panelRef.innerHTML = shell(content, "Content & Trust", "Một hàng đợi cho report, appeal và moderation; mọi quyết định đều có lý do và khả năng khôi phục.");
  }

  async function renderQueue(view) {
    panelRef.innerHTML = shell(loading(), view === "reports" ? "Quản lý báo cáo" : "Quản lý kháng nghị");
    const data = await api(view, { query: { status: "all" } });
    const rows = (data.items || []).map((item) => `<article><header><span><small>${esc(item.targetType || "Hồ sơ")}</small><strong>${esc(item.category || item.reason || "Yêu cầu kiểm duyệt")}</strong></span><b class="hh-admin-status ${esc(item.status || "pending")}">${esc(item.status || "pending")}</b></header><p>${esc(item.description || item.message || "Không có mô tả")}</p><footer><time>${dateText(item.createdAt)}</time>${["pending","escalated"].includes(item.status || "pending") ? `<button type="button" data-admin-resolve="${esc(item.id)}" data-kind="${view}">Xử lý</button>` : ""}</footer></article>`).join("") || '<p class="hh-admin-empty">Không có hồ sơ trong hàng đợi.</p>';
    panelRef.innerHTML = shell(`${subnav([["trust", "Trust Queue"], ["reports", "Reports", "reports.manage"], ["appeals", "Appeals", "appeals.manage"], ["content", "Nội dung", "content.manage"], ["rights", "Quyền Comic Motion", "rights.view"]])}<section class="hh-admin-queue">${rows}</section>`, view === "reports" ? "Quản lý báo cáo" : "Quản lý kháng nghị", "Phân loại, xử lý và lưu lịch sử quyết định.");
  }

  function resolveRecord(id, kind) {
    const dialog = modal(kind === "reports" ? "Xử lý báo cáo" : "Xử lý kháng nghị", '<label><span>Kết quả</span><select name="status"><option value="resolved">Đã giải quyết</option><option value="rejected">Từ chối</option><option value="escalated">Chuyển cấp cao hơn</option></select></label><label class="wide"><span>Kết luận</span><textarea name="resolution" maxlength="1000"></textarea></label><label class="wide"><span>Lý do bắt buộc</span><textarea name="reason" required minlength="5" maxlength="1000"></textarea></label>', "Lưu quyết định");
    dialog.querySelector("form").addEventListener("submit", async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); try { await api("action", { method: "POST", body: { action: kind === "reports" ? "report:resolve" : "appeal:resolve", recordId: id, ...values } }); dialog.close(); dialog.remove(); notice("Quyết định đã được lưu vào audit log."); await renderQueue(kind); } catch (error) { notice(error.message, "error"); } });
  }

  async function renderContent(query = {}) {
    contentQuery = { ...contentQuery, ...query };
    panelRef.innerHTML = shell(loading(), "Quản lý nội dung");
    const data = await api("content", { query: contentQuery });
    const removed = contentQuery.status === "removed";
    const rows = (data.items || []).map((item) => `<article><header><span><strong>${esc(item.author?.name || "Thành viên HH")}</strong><small>${dateText(item.createdAt)} · ${esc(item.privacy || "public")}${item.moderation?.mode ? ` · ${esc(item.moderation.mode)}` : ""}</small></span><div>${removed ? `<button type="button" data-admin-content-action="restore" data-content-id="${esc(item.id)}" data-content-type="${esc(data.type)}">Khôi phục</button>` : `<button type="button" data-admin-content-action="limit" data-content-id="${esc(item.id)}" data-content-type="${esc(data.type)}">Giới hạn phân phối</button><button class="danger" type="button" data-admin-content-action="remove" data-content-id="${esc(item.id)}" data-content-type="${esc(data.type)}">Gỡ nội dung</button>`}</div></header><p>${esc(item.content || "Nội dung media")}</p></article>`).join("") || '<p class="hh-admin-empty">Không có nội dung cần hiển thị.</p>';
    const toolbar = `<form class="hh-admin-toolbar" data-admin-content-filter><select name="type"><option value="post" ${contentQuery.type === "post" ? "selected" : ""}>Bài viết</option><option value="story" ${contentQuery.type === "story" ? "selected" : ""}>Tin</option></select><select name="status"><option value="active" ${contentQuery.status !== "removed" ? "selected" : ""}>Đang hoạt động</option><option value="removed" ${contentQuery.status === "removed" ? "selected" : ""}>Đã gỡ</option></select><button type="submit">Áp dụng</button></form>`;
    panelRef.innerHTML = shell(`${subnav([["trust", "Trust Queue"], ["reports", "Reports", "reports.manage"], ["appeals", "Appeals", "appeals.manage"], ["content", "Nội dung", "content.manage"], ["rights", "Quyền Comic Motion", "rights.view"]])}${toolbar}<section class="hh-admin-content-list">${rows}</section>`, "Quản lý nội dung", "Giới hạn phân phối, gỡ hoặc khôi phục bằng soft delete và lưu đầy đủ lý do.");
  }

  function moderateContent(id, type, mode) {
    const dialog = modal("Kiểm duyệt nội dung", '<label class="wide"><span>Lý do bắt buộc</span><textarea name="reason" required minlength="5" maxlength="1000"></textarea></label>', mode === "remove" ? "Gỡ nội dung" : "Khôi phục");
    dialog.querySelector("form").addEventListener("submit", async (event) => { event.preventDefault(); const reason = new FormData(event.currentTarget).get("reason"); try { await api("action", { method: "POST", body: { action: "content:moderate", targetId: id, targetType: type, mode, reason } }); dialog.close(); dialog.remove(); notice("Nội dung đã được cập nhật và ghi audit log."); await renderContent(); } catch (error) { notice(error.message, "error"); } });
  }

  async function renderRights(query = {}) {
    rightsQuery = { ...rightsQuery, ...query };
    panelRef.innerHTML = shell(loading("Đang đối chiếu hồ sơ quyền và Render Worker..."), "Quyền Comic Motion");
    const data = await api("comic-rights", { query: rightsQuery });
    rightsEntries = data.items || [];
    const summary = data.summary || {};
    const worker = data.worker || {};
    const metrics = [
      ["Tổng hồ sơ", summary.total, "▦"],
      ["Chờ kiểm tra", summary.submitted, "◇"],
      ["Đã duyệt", summary.approved, "✓"],
      ["Từ chối", summary.denied, "×"],
      ["Đã thu hồi", summary.revoked, "!"],
      ["Trusted có thể đồng bộ", summary.trustedCatalogEligible, "↻"]
    ].map(([label, value, icon]) => `<article><i>${icon}</i><small>${esc(label)}</small><strong>${Number(value || 0).toLocaleString("vi-VN")}</strong></article>`).join("");
    const missing = (worker.missing || []).map((item) => `<code>${esc(item)}</code>`).join("");
    const workerCard = `<section class="hh-admin-rights-worker ${worker.connected ? "connected" : "disconnected"}">
      <header><span><small>COMIC MOTION RENDER WORKER</small><strong>${worker.connected ? "Đã kết nối và xác minh" : "Chưa kết nối"}</strong></span><b><i></i>${esc(worker.status || "Chưa kết nối")}</b></header>
      <div><span><small>FFmpeg</small><strong>${worker.ffmpeg ? "Sẵn sàng" : "Chưa xác nhận"}</strong></span><span><small>Phiên bản</small><strong>${esc(worker.version || "-")}</strong></span><span><small>Queue</small><strong>${Number(worker.queueDepth || 0)}</strong></span><span><small>Kiểm tra</small><strong>${dateText(worker.checkedAt)}</strong></span></div>
      ${missing ? `<p>Thiếu cấu hình Vercel: ${missing}</p>` : ""}
      ${worker.fallback ? `<p>${esc(worker.fallback)}</p>` : ""}
      <footer><button type="button" data-admin-rights-worker-test>Kiểm tra lại kết nối</button><button type="button" data-admin-route="/davinci-resolve/comic-motion">Mở Comic Motion</button></footer>
    </section>`;
    const rows = rightsEntries.map((item) => {
      const evidenceReady = Boolean(item.evidenceUrl && item.evidenceHash && item.evidenceId);
      const canReview = has("rights.review");
      const approved = item.reviewStatus === "approved" && !item.revokedAt;
      return `<article class="hh-admin-rights-record ${esc(item.status)}">
        <header><span><small>${esc(item.provider || "imported")} · ${esc(item.licenseCode)}</small><strong>${esc(item.seriesId || "Chưa có series")}</strong><code>${esc(item.chapterId || "Toàn bộ series")}</code></span><b class="hh-admin-status ${esc(item.reviewStatus)}">${esc(item.reviewStatus || item.status)}</b></header>
        <div class="hh-admin-rights-facts"><span><small>Thương mại</small><strong>${item.commercialUseAllowed ? "Có" : "Chưa"}</strong></span><span><small>Phái sinh</small><strong>${item.derivativesAllowed ? "Có" : "Chưa"}</strong></span><span><small>Lãnh thổ</small><strong>${esc(item.territory || "Chưa rõ")}</strong></span><span><small>Bằng chứng</small><strong>${evidenceReady ? "Đủ metadata" : "Chưa đủ"}</strong></span></div>
        <p>${esc((item.reasons || [])[0] || item.attributionText || "Chưa có ghi chú kiểm duyệt.")}</p>
        <footer><div>${item.sourceUrl ? `<a href="${esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">Nguồn gốc ↗</a>` : ""}${item.evidenceUrl ? `<a href="${esc(item.evidenceUrl)}" target="_blank" rel="noopener noreferrer">Bằng chứng ↗</a>` : ""}${item.licenseUrl ? `<a href="${esc(item.licenseUrl)}" target="_blank" rel="noopener noreferrer">Giấy phép ↗</a>` : ""}</div>${canReview ? `<nav>${!approved ? `<button type="button" data-admin-rights-action="approve" data-rights-id="${esc(item.id)}">Duyệt có bằng chứng</button><button type="button" data-admin-rights-action="deny" data-rights-id="${esc(item.id)}">Từ chối</button>` : `<button class="danger" type="button" data-admin-rights-action="revoke" data-rights-id="${esc(item.id)}">Thu hồi</button>`}</nav>` : ""}</footer>
      </article>`;
    }).join("") || '<p class="hh-admin-empty">Chưa có hồ sơ quyền Comic Motion phù hợp bộ lọc.</p>';
    const pagination = data.pagination || {};
    const filters = `<form class="hh-admin-toolbar hh-admin-rights-filter" data-admin-rights-filter><label><span>⌕</span><input name="q" value="${esc(rightsQuery.q || "")}" placeholder="Series, chapter, provider, license"></label><select name="status">${[["all","Mọi trạng thái"],["submitted","Chờ kiểm tra"],["approved","Đã duyệt"],["denied","Từ chối"],["revoked","Thu hồi"],["manual-review","Cần duyệt thủ công"]].map(([value,label]) => `<option value="${value}" ${rightsQuery.status === value ? "selected" : ""}>${label}</option>`).join("")}</select><button type="submit">Lọc hồ sơ</button>${has("rights.review") ? '<button type="button" data-admin-rights-trusted-sync>Đồng bộ mục đạt trusted preflight</button>' : ""}</form>`;
    const content = `${subnav([["trust", "Trust Queue"], ["reports", "Reports", "reports.manage"], ["appeals", "Appeals", "appeals.manage"], ["content", "Nội dung", "content.manage"], ["rights", "Quyền Comic Motion", "rights.view"]])}
      <section class="hh-admin-trust-metrics hh-admin-rights-metrics">${metrics}</section>
      ${workerCard}
      <section class="hh-admin-rights-policy"><i>⚖</i><span><strong>Không duyệt hàng loạt nguồn không rõ quyền</strong><small>Đồng bộ tự động chỉ áp dụng bản ghi khớp manifest tin cậy phía máy chủ. OTruyen, MangaDex, Unknown, NC, ND và repository license vẫn bị cách ly.</small></span></section>
      ${filters}
      <section class="hh-admin-rights-list">${rows}</section>
      <footer class="hh-admin-pagination"><span>${Number(pagination.total || 0).toLocaleString("vi-VN")} hồ sơ</span><div><button type="button" data-admin-rights-page="${Math.max(1, Number(pagination.page || 1) - 1)}" ${Number(pagination.page || 1) <= 1 ? "disabled" : ""}>Trước</button><b>${Number(pagination.page || 1)}/${Number(pagination.pages || 1)}</b><button type="button" data-admin-rights-page="${Math.min(Number(pagination.pages || 1), Number(pagination.page || 1) + 1)}" ${Number(pagination.page || 1) >= Number(pagination.pages || 1) ? "disabled" : ""}>Sau</button></div></footer>`;
    panelRef.innerHTML = shell(content, "Comic Rights Review Console", "Đối chiếu quyền chuyển thể, bằng chứng, trạng thái worker và audit trước khi bất kỳ chương nào được render.");
  }

  function reviewComicRights(recordId, mode) {
    const item = rightsEntries.find((entry) => String(entry.id) === String(recordId));
    if (!item) return notice("Không tìm thấy hồ sơ quyền trong trang hiện tại.", "error");
    if (mode !== "approve") {
      const dialog = modal(mode === "revoke" ? "Thu hồi quyền Comic Motion" : "Từ chối hồ sơ quyền", `<section class="wide hh-admin-rights-decision"><p>${esc(item.seriesId)} · ${esc(item.chapterId || "toàn bộ series")}</p><label><span>Lý do bắt buộc</span><textarea name="reason" required minlength="5" maxlength="1000"></textarea></label></section>`, mode === "revoke" ? "Thu hồi và chặn job" : "Từ chối và chặn job");
      dialog.querySelector("form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const done = beginFormSubmission(event.currentTarget);
        if (!done) return;
        try {
          const reason = new FormData(event.currentTarget).get("reason");
          await api("action", { method: "POST", body: { action: `comic-rights:${mode}`, recordId, reason } });
          dialog.close(); dialog.remove(); notice(mode === "revoke" ? "Đã thu hồi quyền, chặn job và ẩn artifact liên quan." : "Đã từ chối hồ sơ và chặn job liên quan.");
          await renderRights();
        } catch (error) { done(); notice(error.message, "error"); }
      });
      return;
    }
    const licenseOptions = ["CC0-1.0","CC-BY-2.0","CC-BY-2.5","CC-BY-3.0","CC-BY-4.0","CC-BY-SA-3.0","CC-BY-SA-4.0","OWNED"].map((value) => `<option value="${value}" ${item.licenseCode === value ? "selected" : ""}>${value}</option>`).join("");
    const dialog = modal("Duyệt quyền bằng chứng", `<section class="wide hh-admin-rights-review-form"><div class="hh-admin-rights-warning"><i>!</i><span><strong>Quyết định pháp lý có audit</strong><small>Chỉ duyệt sau khi đã mở và đối chiếu trang nguồn, giấy phép, tác giả và file bằng chứng. Không nhập hash giả.</small></span></div><label><span>Mã giấy phép</span><select name="licenseCode">${licenseOptions}</select></label><label><span>Tác giả/chủ sở hữu</span><input name="author" maxlength="240" value="${esc(item.author || "")}" required></label><label class="wide"><span>URL nguồn HTTPS</span><input name="sourceUrl" type="url" value="${esc(item.sourceUrl || "")}" required></label><label class="wide"><span>URL giấy phép chuẩn</span><input name="licenseUrl" type="url" value="${esc(item.licenseUrl || "")}" placeholder="https://creativecommons.org/licenses/by/4.0/"></label><label class="wide"><span>URL bằng chứng đã lưu</span><input name="evidenceUrl" type="url" value="${esc(item.evidenceUrl || "")}" required></label><label><span>Mã hồ sơ bằng chứng</span><input name="evidenceId" maxlength="160" value="${esc(item.evidenceId || "")}" required></label><label><span>SHA-256 bằng chứng</span><input name="evidenceHash" pattern="[A-Fa-f0-9]{64}" maxlength="64" value="${esc(item.evidenceHash || "")}" required></label><label class="wide"><span>Nội dung ghi công</span><textarea name="attributionText" maxlength="2000">${esc(item.attributionText || "")}</textarea></label><section class="wide hh-admin-rights-checks"><label><input type="checkbox" name="commercialUseAllowed" ${item.commercialUseAllowed ? "checked" : ""}><span>Cho phép thương mại</span></label><label><input type="checkbox" name="derivativesAllowed" ${item.derivativesAllowed ? "checked" : ""}><span>Cho phép phái sinh/video</span></label><label><input type="checkbox" name="redistributionAllowed" ${item.redistributionAllowed ? "checked" : ""}><span>Cho phép phân phối</span></label></section><label class="wide"><span>Lý do quyết định</span><textarea name="reason" required minlength="5" maxlength="1000"></textarea></label></section>`, "Duyệt và mở khóa job");
    dialog.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const done = beginFormSubmission(event.currentTarget);
      if (!done) return;
      const form = new FormData(event.currentTarget);
      const body = Object.fromEntries(form);
      body.action = "comic-rights:approve";
      body.recordId = recordId;
      body.territory = "worldwide";
      body.commercialUseAllowed = form.has("commercialUseAllowed");
      body.derivativesAllowed = form.has("derivativesAllowed");
      body.redistributionAllowed = form.has("redistributionAllowed");
      try {
        await api("action", { method: "POST", body });
        dialog.close(); dialog.remove(); notice("Hồ sơ đã được duyệt, ghi decision hash và mở khóa job bị chặn.");
        await renderRights();
      } catch (error) { done(); notice(error.message, "error"); }
    });
  }

  async function syncTrustedComicRights() {
    const dialog = modal("Đồng bộ trusted preflight", '<section class="wide hh-admin-rights-decision"><p>Máy chủ chỉ duyệt các bản ghi khớp manifest nguồn chính thức đã được kiểm tra. Mọi nguồn còn lại tiếp tục ở trạng thái chờ duyệt.</p><label><span>Lý do bắt buộc</span><textarea name="reason" required minlength="5" maxlength="1000">Đồng bộ các bản ghi khớp trusted catalog phía máy chủ</textarea></label></section>', "Đồng bộ an toàn");
    dialog.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const done = beginFormSubmission(event.currentTarget);
      if (!done) return;
      try {
        const reason = new FormData(event.currentTarget).get("reason");
        const data = await api("action", { method: "POST", body: { action: "comic-rights:trusted-sync", reason } });
        dialog.close(); dialog.remove(); notice(`Đã duyệt ${Number(data.approvedCount || 0)} hồ sơ trusted; bỏ qua ${Number(data.skippedCount || 0)} hồ sơ chưa đủ bằng chứng.`);
        await renderRights();
      } catch (error) { done(); notice(error.message, "error"); }
    });
  }

  async function renderAudit(query = {}) {
    auditQuery = { ...auditQuery, ...query };
    panelRef.innerHTML = shell(loading(), "Audit log");
    const [data, integrityData] = await Promise.all([api("audit", { query: auditQuery }), api("audit-integrity")]);
    auditEntries = data.items || [];
    const rows = auditEntries.map((item) => `<tr><td><strong>${esc(item.action)}</strong><small>${esc(item.targetType)} · ${esc(item.targetId)}</small></td><td>${esc(item.admin?.name || "Admin")}<small>${esc(item.admin?.email || "")}</small></td><td>${esc(item.reason || "-")}</td><td>${esc(item.ip || "-")}</td><td>${dateText(item.createdAt)}</td><td><button type="button" data-admin-audit-open="${esc(item.id)}">Chi tiết</button></td></tr>`).join("") || '<tr><td colspan="6">Chưa có audit log.</td></tr>';
    const filters = `<form class="hh-admin-toolbar hh-admin-audit-filters" data-admin-audit-filter><label><span>⌕</span><input name="q" value="${esc(auditQuery.q || "")}" placeholder="Tìm toàn bộ audit"></label><input name="actor" value="${esc(auditQuery.actor || "")}" placeholder="Email admin"><input name="action" value="${esc(auditQuery.action || "")}" placeholder="Hành động"><input name="target" value="${esc(auditQuery.target || "")}" placeholder="Đối tượng"><input name="from" type="date" value="${esc(auditQuery.from || "")}" aria-label="Từ ngày"><input name="to" type="date" value="${esc(auditQuery.to || "")}" aria-label="Đến ngày"><button type="submit">Lọc audit</button></form>`;
    const auditIntegrity = integrityData.integrity || {};
    const integrityState = auditIntegrity.valid === false ? "critical" : auditIntegrity.completeToHead ? "verified" : "partial";
    const integrityLabel = auditIntegrity.valid === false ? "Phát hiện sai lệch" : auditIntegrity.completeToHead ? "Đã kiểm tra toàn chuỗi" : "Mẫu gần nhất hợp lệ";
    const integrity = `<section class="hh-admin-audit-integrity ${integrityState}"><i>◆</i><span><strong>Tamper-evident Audit Chain · ${esc(integrityLabel)}</strong><small>${Number(auditIntegrity.checkedEntries || 0)}/${Number(auditIntegrity.totalEntries || 0)} bản ghi được kiểm tra · không phải WORM · chưa có external anchor</small></span><div>${has("audit.access-review") ? '<button type="button" data-admin-audit-checkpoint>Checkpoint chain</button>' : ""}<button type="button" data-admin-access-review>Hoàn tất Access Review tháng</button></div></section>`;
    panelRef.innerHTML = shell(`${subnav([["identity", "Identity & Access", "users.view"], ["power", "Root Authority", "dashboard.view"], ["security", "Security", "security.view"], ["platform", "Platform", "platform.view"], ["audit", "Audit log"]])}${filters}${integrity}<section class="hh-admin-table"><table><thead><tr><th>Hành động</th><th>Admin</th><th>Lý do</th><th>${data.networkAccess?.raw ? "IP" : "IP đã che"}</th><th>Thời gian</th><th></th></tr></thead><tbody>${rows}</tbody></table></section>`, "Tamper-evident Audit Log", "Lọc theo admin, hành động, đối tượng và thời gian; dữ liệu mạng được che nếu không có quyền chuyên biệt.");
  }

  function openAudit(id) {
    const item = auditEntries.find((entry) => String(entry.id) === String(id));
    if (!item) return;
    const pretty = (value) => esc(JSON.stringify(value ?? null, null, 2));
    const dialog = modal("Chi tiết audit log", `<section class="wide hh-admin-audit-detail"><div><span><small>Admin</small><strong>${esc(item.admin?.name || "Admin")}</strong><code>${esc(item.admin?.email || "")}</code></span><span><small>Vai trò</small><strong>${esc((item.roles || []).join(", "))}</strong></span><span><small>IP</small><strong>${esc(item.ip || "-")}</strong></span><span><small>Thời gian</small><strong>${dateText(item.createdAt)}</strong></span></div><p><b>${esc(item.action)}</b> · ${esc(item.targetType)} / ${esc(item.targetId)}</p><p>${esc(item.reason || "Không có lý do")}</p><label><span>User agent</span><code>${esc(item.userAgent || "-")}</code></label><section><article><strong>Trước thay đổi</strong><pre>${pretty(item.before)}</pre></article><article><strong>Sau thay đổi</strong><pre>${pretty(item.after)}</pre></article></section></section>`, "Đóng");
    dialog.querySelector("footer .primary")?.addEventListener("click", () => { dialog.close(); dialog.remove(); });
  }

  async function renderPlatform() {
    panelRef.innerHTML = shell(loading("Đang kiểm tra deployment, provider và queue..."), "Platform & Release");
    const data = await api("platform");
    featureFlags = data.flags || [];
    const services = (data.services || []).map((item) => `<article class="${esc(item.status)}"><i></i><span><strong>${esc(item.name)}</strong><small>${esc(item.detail)}</small></span><b>${esc(statusLabel(item.status))}</b></article>`).join("");
    const providers = Object.entries(data.providers || {}).map(([key, item]) => `<article class="${item.configured ? "operational" : "not-configured"}"><i>${item.configured ? "✓" : "＋"}</i><span><strong>${esc(key)}</strong><small>${esc(item.detail)}</small></span><b>${esc(statusLabel(item.status))}</b></article>`).join("");
    const jobs = (data.jobs || []).map((item) => {
      const controls = [
        ...(["queued", "running"].includes(item.status) ? [["pause", "Pause"], ["cancel", "Cancel"]] : []),
        ...(["failed", "paused", "cancelled"].includes(item.status) ? [["retry", "Retry"]] : []),
        ["duplicate", "Duplicate"]
      ];
      return `<article class="${esc(item.status)}"><header><span><i></i><strong>${esc(item.type)}</strong></span><b>${esc(statusLabel(item.status))}</b></header><div><span><small>Provider</small><strong>${esc(item.provider)}</strong></span><span><small>Attempts</small><strong>${Number(item.attempts || 0)}</strong></span><span><small>Progress</small><strong>${Number(item.progress || 0)}%</strong></span><time>${dateText(item.updatedAt || item.createdAt)}</time></div>${item.sanitizedError ? `<p>${esc(item.sanitizedError)}</p>` : ""}<footer>${has("platform.manage") ? controls.map(([operation, label]) => `<button type="button" data-admin-job="${esc(item.id)}" data-job-operation="${operation}">${label}</button>`).join("") : ""}</footer></article>`;
    }).join("") || '<p class="hh-admin-empty">Queue hiện không có background job.</p>';
    const flags = featureFlags.map((item) => `<article><span><i class="${item.enabled ? "on" : ""}"></i><strong>${esc(item.key)}</strong><small>${esc(item.description || "Feature flag runtime")}</small><small>${item.enforcementState === "no_consumer" ? "Chưa có enforcement consumer" : `Consumer: ${esc(item.consumer || "server")}`}</small></span><div><b>${item.enabled ? "Bật" : "Tắt"} · ${Number(item.rollout || 0)}%</b>${has("flags.manage") ? `<button type="button" data-admin-flag-toggle="${esc(item.key)}">${item.enabled ? "Kill switch" : "Bật lại"}</button>` : ""}</div></article>`).join("") || '<p class="hh-admin-empty">Chưa có feature flag.</p>';
    const usage = (data.gatewayUsage || []).map((item) => `<article><span><strong>${esc(item.provider || "provider")}</strong><small>${esc(item.outcome || "unknown")}</small></span><b>${Number(item.requests || 0)} requests</b><em>${Number(item.units || 0).toLocaleString("vi-VN")} units</em></article>`).join("") || '<p class="hh-admin-empty">Chưa có lưu lượng gateway trong 24 giờ.</p>';
    const content = `${subnav([["platform", "Platform Health"], ["settings", "Flags & Config", "config.manage"], ["audit", "Release Audit", "audit.view"]])}
      <section class="hh-admin-release-hero">
        <div><small>CURRENT PRODUCTION</small><strong>${esc(data.deployment?.provider || "Deployment")} · ${esc(data.deployment?.environment || "production")}</strong><p>${esc(data.deployment?.commitMessage || "Runtime chưa cung cấp nội dung commit.")}</p><span><code>${esc((data.deployment?.commitSha || "unknown").slice(0, 12))}</code><b>${esc(data.deployment?.region || "auto region")}</b></span></div>
        <aside><i>↺</i><strong>Rollback Guard</strong><p>Rollback production chỉ được mở sau bước xác thực lại bằng Google và phải ghi lý do.</p><button type="button" disabled title="Cần adapter Vercel và Google reauthentication">Cần xác thực lại Google</button></aside>
      </section>
      <section class="hh-admin-platform-grid">
        <article class="hh-admin-platform-services"><header><span><small>INFRASTRUCTURE MATRIX</small><strong>Dịch vụ nền tảng</strong></span><time>${dateText(data.generatedAt)}</time></header><div>${services}</div></article>
        <article class="hh-admin-provider-grid"><header><span><small>PROVIDER ROUTER</small><strong>Kết nối production</strong></span><b>Không hiển thị khóa</b></header><div>${providers}</div></article>
      </section>
      <section class="hh-admin-job-console"><header><span><small>BACKGROUND OPERATIONS</small><strong>Render & Generation Queue</strong></span><b>Pause · Retry · Cancel · Duplicate</b></header><div>${jobs}</div></section>
      <section class="hh-admin-platform-lower">
        <article class="hh-admin-flag-console"><header><span><small>CONTROL PLANE</small><strong>Feature flags</strong></span><button type="button" data-admin-view="settings">Cấu hình</button></header><div>${flags}</div></article>
        <article class="hh-admin-gateway-usage"><header><span><small>24H USAGE</small><strong>API gateway</strong></span><b>Dữ liệu tổng hợp</b></header><div>${usage}</div></article>
      </section>`;
    panelRef.innerHTML = shell(content, "Platform & Release", "Deployment, API provider, queue và feature flag với trạng thái thật và audit bắt buộc.");
  }

  async function renderGrowth() {
    panelRef.innerHTML = shell(loading("Đang tổng hợp Growth & Data an toàn..."), "Growth & Data");
    const data = await api("growth");
    const metrics = [
      ["Online", data.metrics?.online, "●"],
      ["Tổng người dùng", data.metrics?.totalUsers, "◎"],
      ["Người dùng mới · 7d", data.metrics?.newUsers7d, "+"],
      ["Page views · 30d", data.metrics?.pageViews30d, "↗"],
      ["Conversions · 30d", data.metrics?.conversions30d, "◇"],
      ["Form completion", `${Number(data.metrics?.submitRate || 0)}%`, "✓"]
    ].map(([label, value, icon]) => `<article><i>${icon}</i><small>${esc(label)}</small><strong>${typeof value === "number" ? value.toLocaleString("vi-VN") : esc(value)}</strong></article>`).join("");
    const maxFunnel = Math.max(1, ...(data.funnel || []).map((item) => Number(item.value || 0)));
    const funnel = (data.funnel || []).map((item, index) => `<article style="--funnel:${Math.max(3, Math.round(Number(item.value || 0) / maxFunnel * 100))}%"><span><i>0${index + 1}</i><strong>${esc(item.label)}</strong></span><b>${Number(item.value || 0).toLocaleString("vi-VN")}</b><em></em></article>`).join("");
    const maxCohort = Math.max(1, ...(data.cohorts || []).map((item) => Number(item.users || 0)));
    const cohorts = (data.cohorts || []).map((item) => `<article><b style="--value:${Math.max(4, Math.round(Number(item.users || 0) / maxCohort * 100))}%"></b><strong>${Number(item.users || 0)}</strong><small>${esc(item.date.slice(5))}</small></article>`).join("") || '<p class="hh-admin-empty">Chưa đủ dữ liệu cohort 7 ngày.</p>';
    const payments = (data.payments?.byStatus || []).map((item) => `<article><i></i><span><strong>${esc(item.status)}</strong><small>${Number(item.count || 0)} giao dịch</small></span><b>${moneyText(item.amount)}</b></article>`).join("") || '<p class="hh-admin-empty">Chưa có giao dịch trong 30 ngày.</p>';
    const aiUsage = (data.aiUsage || []).map((item) => `<article><span><strong>${esc(item.provider)}</strong><small>${Number(item.requests || 0)} requests · ${Number(item.failures || 0)} lỗi</small></span><b>${Number(item.units || 0).toLocaleString("vi-VN")} units</b></article>`).join("") || '<p class="hh-admin-empty">Chưa có usage từ AI gateway.</p>';
    const content = `${subnav([["growth", "Growth Overview"], ["ai-operations", "AI Operations"], ["community", "Realtime", "activity.view"], ["privacy", "Consent", "privacy.view"], ["data-governance", "Data Governance", "privacy.view"]])}
      <section class="hh-admin-growth-metrics">${metrics}</section>
      <section class="hh-admin-growth-grid">
        <article class="hh-admin-funnel"><header><span><small>CONVERSION JOURNEY · 30D</small><strong>Funnel thực tế</strong></span><button type="button" data-admin-route="/analytics">Mở Phân tích</button></header><div>${funnel}</div></article>
        <article class="hh-admin-cohort"><header><span><small>NEW USER COHORT · 7D</small><strong>Nhịp tăng trưởng</strong></span><b>Không định danh</b></header><div>${cohorts}</div></article>
        <article class="hh-admin-growth-routes"><header><span><small>DISCOVERY</small><strong>Top routes</strong></span><b>${Number(data.metrics?.events30d || 0).toLocaleString("vi-VN")} events</b></header>${rankingMarkup(data.topRoutes)}</article>
      </section>
      <section class="hh-admin-business-grid">
        <article class="hh-admin-payment-health"><header><span><small>PAYOS · 30D</small><strong>Thanh toán & đối soát</strong></span><b class="${data.payments?.configured ? "ready" : "missing"}">${data.payments?.configured ? "Đã kết nối" : "Chưa kết nối"}</b></header><div>${payments}</div><footer>Không trả về email, orderCode, số tài khoản hoặc chi tiết giao dịch cá nhân.</footer></article>
        <article class="hh-admin-ai-cost"><header><span><small>AI PROVIDER USAGE · 30D</small><strong>Chi phí theo usage unit</strong></span><b>Không phỏng đoán tiền</b></header><div>${aiUsage}</div></article>
        <article class="hh-admin-search-console"><i>G</i><span><small>SEARCH CONSOLE</small><strong>${data.searchConsole?.configured ? "Đã khai báo property" : "Chưa kết nối dữ liệu SEO"}</strong><p>${esc(data.searchConsole?.note)}</p>${data.searchConsole?.property ? `<code>${esc(data.searchConsole.property)}</code>` : ""}</span></article>
      </section>
      <section class="hh-admin-data-boundary"><i>◈</i><span><strong>Aggregate-only analytics</strong><small>Không trả về danh tính, raw prompt, chi tiết thanh toán hoặc dữ liệu riêng tư trong Growth & Data.</small></span>${has("reports.export") ? '<button type="button" data-admin-export>Xuất báo cáo an toàn</button>' : ""}</section>`;
    panelRef.innerHTML = shell(content, "Growth & Data", "Funnel, cohort, PayOS, SEO và AI usage ở dạng tổng hợp, có trạng thái kết nối minh bạch.");
  }

  async function renderSettings() {
    panelRef.innerHTML = shell(loading(), "Cấu hình hệ thống");
    const data = await api("settings");
    featureFlags = data.flags || [];
    const flags = featureFlags.map((item) => `<article><span><strong>${esc(item.key)}</strong><small>${esc(item.description || "Feature flag")}</small><small>${item.enforcementState === "no_consumer" ? "Chưa có enforcement consumer" : `Consumer: ${esc(item.consumer || "server")}`}</small></span><div><b class="${item.enabled ? "enabled" : ""}">${item.enabled ? "Bật" : "Tắt"} · ${Number(item.rollout || 0)}%</b><button type="button" data-admin-flag-toggle="${esc(item.key)}">${item.enabled ? "Tắt khẩn cấp" : "Bật lại"}</button></div></article>`).join("") || '<p class="hh-admin-empty">Chưa có feature flag.</p>';
    const keywords = (data.keywords || []).map((item) => `<span>${esc(item.value)} · ${esc(item.severity || "review")}</span>`).join("") || "Chưa có từ khóa";
    const content = `${subnav([["platform", "Platform Health", "platform.view"], ["settings", "Flags & Config"], ["audit", "Release Audit", "audit.view"]])}<section class="hh-admin-settings"><article><header><strong>Feature flags</strong><button type="button" data-admin-setting="flag">＋ Thêm</button></header><div>${flags}</div></article><article><header><strong>Từ khóa kiểm duyệt</strong><button type="button" data-admin-setting="keyword">＋ Thêm</button></header><p class="hh-admin-keywords">${keywords}</p></article>${has("templates.manage") ? '<article><header><strong>Email template</strong><button type="button" data-admin-setting="template">＋ Cập nhật</button></header><p>Mẫu email được quản lý theo khóa và có audit log.</p></article>' : ""}<article><header><strong>Cấu hình runtime</strong><div><button type="button" data-admin-setting="category">＋ Danh mục</button><button type="button" data-admin-setting="config">＋ Cấu hình</button></div></header><p>${Number(data.config?.length || 0)} cấu hình · ${Number(data.categories?.length || 0)} danh mục</p></article></section>`;
    panelRef.innerHTML = shell(content, "Cấu hình hệ thống", "Feature flags, từ khóa, danh mục và email template.");
  }

  function updateSetting(kind) {
    const content = kind === "flag" ? '<label><span>Khóa</span><input name="key" required maxlength="100"></label><label><span>Rollout %</span><input name="rollout" type="number" min="0" max="100" value="100"></label><label class="wide"><span>Mô tả</span><textarea name="description" maxlength="500"></textarea></label><label class="hh-admin-check"><input name="enabled" type="checkbox" checked><span>Bật feature</span></label>' : kind === "keyword" ? '<label><span>Từ khóa</span><input name="value" required maxlength="100"></label><label><span>Mức độ</span><select name="severity"><option value="review">Cần xem xét</option><option value="block">Chặn</option><option value="warning">Cảnh báo</option></select></label>' : kind === "template" ? '<label><span>Khóa mẫu</span><input name="key" required maxlength="100"></label><label class="wide"><span>Tiêu đề</span><input name="subject" maxlength="240"></label><label class="wide"><span>HTML</span><textarea name="html" maxlength="20000"></textarea></label>' : kind === "category" ? '<label><span>Khóa danh mục</span><input name="key" required maxlength="100"></label><label><span>Tên hiển thị</span><input name="name" required maxlength="160"></label><label><span>Thứ tự</span><input name="order" type="number" value="0"></label>' : '<label><span>Khóa cấu hình</span><input name="key" required maxlength="100"></label><label class="wide"><span>Giá trị</span><textarea name="value" maxlength="4000"></textarea></label>';
    const dialog = modal("Cập nhật cấu hình", `${content}<label class="wide"><span>Lý do bắt buộc</span><textarea name="reason" required minlength="5" maxlength="1000"></textarea></label>`, "Lưu cấu hình");
    dialog.querySelector("form").addEventListener("submit", async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const values = Object.fromEntries(form); if (kind === "flag") values.enabled = form.has("enabled"); const action = kind === "flag" ? "feature-flag:update" : kind === "keyword" ? "keyword:update" : kind === "template" ? "email-template:update" : kind === "category" ? "category:update" : "config:update"; try { await api("action", { method: "POST", body: { action, ...values } }); dialog.close(); dialog.remove(); notice("Cấu hình đã được lưu và ghi audit log."); await renderSettings(); } catch (error) { notice(error.message, "error"); } });
  }

  function toggleFlag(key) {
    const item = featureFlags.find((flag) => flag.key === key);
    if (!item) return;
    const nextEnabled = !item.enabled;
    const dialog = modal(nextEnabled ? "Bật lại tính năng" : "Tắt tính năng khẩn cấp", `<section class="wide hh-admin-kill-switch"><strong>${esc(item.key)}</strong><p>${esc(item.description || "Feature flag runtime")}</p><span>${nextEnabled ? "Tính năng sẽ được mở theo rollout hiện tại." : "Kill switch sẽ tắt tính năng cho toàn bộ người dùng."}</span></section><label class="wide"><span>Lý do bắt buộc</span><textarea name="reason" required minlength="5" maxlength="1000"></textarea></label>`, nextEnabled ? "Bật tính năng" : "Kích hoạt kill switch");
    dialog.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const reason = new FormData(event.currentTarget).get("reason");
      try { await api("action", { method: "POST", body: { action: "feature-flag:update", key: item.key, enabled: nextEnabled, rollout: Number(item.rollout || 0), description: item.description || "", reason } }); dialog.close(); dialog.remove(); notice("Kill switch đã cập nhật và ghi audit log."); await renderSettings(); }
      catch (error) { notice(error.message, "error"); }
    });
  }

  function createAuditCheckpoint() {
    const dialog = modal("Tạo audit checkpoint", `<section class="wide hh-admin-boundary"><i>◆</i><span><strong>Database checkpoint</strong><small>Ghi hash head hiện tại vào communityAuditCheckpoints. Đây chưa phải external/WORM anchor.</small></span></section><label class="wide"><span>Lý do checkpoint</span><textarea name="reason" required minlength="5" maxlength="1000"></textarea></label>`, "Tạo checkpoint");
    dialog.querySelector("form").addEventListener("submit", async (event) => { event.preventDefault(); const reason = new FormData(event.currentTarget).get("reason"); try { await api("action", { method: "POST", body: { action: "audit:checkpoint", reason } }); dialog.close(); dialog.remove(); notice("Đã tạo audit checkpoint nội bộ."); await renderAudit(); } catch (error) { notice(error.message, "error"); } });
  }

  async function openAccessRequest() {
    const catalog = permissionCatalog.length ? permissionCatalog : (await api("identity")).permissionCatalog || [];
    const options = catalog.map((item) => `<option value="${esc(item.id)}">${esc(item.label || item.id)} · ${esc(item.id)}</option>`).join("");
    const dialog = modal("Yêu cầu quyền truy cập", `<label class="wide"><span>Permission</span><select name="permission" required>${options}</select></label><label><span>Scope</span><select name="scopeType"><option value="global">Global</option><option value="workspace">Workspace</option><option value="module">Module</option><option value="account">Account</option></select></label><label><span>Workspace / resource ID</span><input name="scopeId" maxlength="180" placeholder="Bỏ trống nếu global"></label><label><span>Hết hạn</span><input name="expiresAt" type="datetime-local"></label><label class="wide"><span>Lý do bắt buộc</span><textarea name="reason" required minlength="5" maxlength="1000"></textarea></label>`, "Gửi yêu cầu");
    dialog.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const scope = values.scopeId ? { type: values.scopeType, [`${values.scopeType === "content-source" ? "contentSource" : values.scopeType}Ids`]: [values.scopeId] } : { type: values.scopeType };
      try { await api("action", { method: "POST", body: { action: "access:request", permission: values.permission, scope, expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : null, reason: values.reason } }); dialog.close(); dialog.remove(); notice("Access request đã gửi và được ghi audit."); await renderGovernance("access-requests"); }
      catch (error) { notice(error.message, "error"); }
    });
  }

  function decideAccessRequest(requestId, decision) {
    const title = decision === "approve" ? "Duyệt access request" : "Từ chối access request";
    const dialog = modal(title, `<section class="wide hh-admin-boundary"><i>${decision === "approve" ? "✓" : "!"}</i><span><strong>${esc(requestId)}</strong><small>${decision === "approve" ? "Permission grant sẽ được tạo theo scope và thời hạn của request." : "Request sẽ bị từ chối và không tạo grant."}</small></span></section><label class="wide"><span>Lý do quyết định</span><textarea name="reason" required minlength="5" maxlength="1000"></textarea></label>`, decision === "approve" ? "Duyệt và cấp quyền" : "Từ chối");
    dialog.querySelector("form").addEventListener("submit", async (event) => { event.preventDefault(); const reason = new FormData(event.currentTarget).get("reason"); try { await api("action", { method: "POST", body: { action: `access:${decision}`, requestId, reason } }); dialog.close(); dialog.remove(); notice(decision === "approve" ? "Access request đã được duyệt và tạo grant." : "Access request đã bị từ chối."); await renderGovernance("access-requests"); } catch (error) { notice(error.message, "error"); } });
  }

  async function openAssignmentCreator() {
    const data = await api("effective-access");
    const definitions = (data.definitions || []).filter((item) => item.status === "active" && item.roleId.startsWith("custom:"));
    if (!definitions.length) { notice("Chưa có custom role active để gán.", "error"); return; }
    const options = definitions.map((item) => `<option value="${esc(item.roleId)}">${esc(item.name || item.roleId)} · v${Number(item.version || 1)}</option>`).join("");
    const dialog = modal("Gán custom role", `<label><span>User ID</span><input name="userId" required maxlength="180" placeholder="ObjectId tài khoản đích"></label><label><span>Workspace ID</span><input name="workspaceId" maxlength="180"></label><label class="wide"><span>Custom role</span><select name="roleId" required>${options}</select></label><label><span>Scope</span><select name="scopeType"><option value="global">Global</option><option value="workspace">Workspace</option><option value="module">Module</option><option value="account">Account</option></select></label><label><span>Hết hạn</span><input name="expiresAt" type="datetime-local"></label><label class="wide"><span>Lý do bắt buộc</span><textarea name="reason" required minlength="5" maxlength="1000"></textarea></label>`, "Gán role");
    dialog.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const scopeId = values.workspaceId;
      const scope = scopeId ? { type: values.scopeType, workspaceIds: values.scopeType === "workspace" ? [scopeId] : [], moduleIds: values.scopeType === "module" ? [scopeId] : [], accountIds: values.scopeType === "account" ? [scopeId] : [] } : { type: values.scopeType };
      try { await api("action", { method: "POST", body: { action: "assignment:create", userId: values.userId, roleId: values.roleId, workspaceId: values.workspaceId, scope, expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : null, reason: values.reason } }); dialog.close(); dialog.remove(); notice("Role assignment đã tạo và có scope."); await renderGovernance("role-assignments"); }
      catch (error) { notice(error.message, "error"); }
    });
  }

  function revokeAssignment(assignmentId, userId) {
    const dialog = modal("Thu hồi role assignment", `<section class="wide hh-admin-boundary"><i>!</i><span><strong>Thu hồi quyền ngay</strong><small>Assignment sẽ chuyển sang revoked và không còn được tính vào effective access.</small></span></section><label class="wide"><span>Lý do bắt buộc</span><textarea name="reason" required minlength="5" maxlength="1000"></textarea></label>`, "Thu hồi");
    dialog.querySelector("form").addEventListener("submit", async (event) => { event.preventDefault(); const reason = new FormData(event.currentTarget).get("reason"); try { await api("action", { method: "POST", body: { action: "assignment:revoke", assignmentId, userId, reason } }); dialog.close(); dialog.remove(); notice("Assignment đã thu hồi."); await renderGovernance("role-assignments"); } catch (error) { notice(error.message, "error"); } });
  }

  function createServiceAccount() {
    const dialog = modal("Tạo service account", `<label><span>Tên</span><input name="name" required minlength="3" maxlength="120"></label><label><span>Environment</span><select name="environment"><option value="production">production</option><option value="preview">preview</option><option value="development">development</option></select></label><label><span>Workspace ID</span><input name="workspaceId" maxlength="180"></label><label><span>Hết hạn</span><input name="expiresAt" type="datetime-local"></label><label class="wide"><span>Scopes (mỗi dòng một scope)</span><textarea name="scopes" placeholder="platform.view\ncontent.manage"></textarea></label><label class="wide"><span>Lý do bắt buộc</span><textarea name="reason" required minlength="5" maxlength="1000"></textarea></label>`, "Tạo và hiển thị token một lần");
    dialog.querySelector("form").addEventListener("submit", async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); try { const result = await api("action", { method: "POST", body: { action: "service-account:create", name: values.name, environment: values.environment, workspaceId: values.workspaceId, expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : null, scopes: String(values.scopes || "").split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean), reason: values.reason } }); dialog.close(); dialog.remove(); const tokenDialog = modal("Token hiển thị một lần", `<section class="wide hh-admin-token-reveal"><strong>${esc(result.token || "")}</strong><small>Hãy lưu token ngay. Máy chủ không thể hiển thị lại plaintext token này.</small><button type="button" data-admin-copy-token>Copy token</button></section>`, "Đã hiểu"); tokenDialog.querySelector("[data-admin-copy-token]")?.addEventListener("click", async () => { await navigator.clipboard?.writeText(result.token || ""); notice("Đã copy token vào clipboard."); }); await renderGovernance("service-accounts"); } catch (error) { notice(error.message, "error"); } });
  }

  function rotateServiceAccount(serviceAccountId, revoke = false) {
    const title = revoke ? "Thu hồi service account" : "Xoay API token";
    const dialog = modal(title, `<section class="wide hh-admin-boundary"><i>${revoke ? "!" : "↻"}</i><span><strong>${esc(serviceAccountId)}</strong><small>${revoke ? "Tất cả token active sẽ bị vô hiệu hóa." : "Token cũ sẽ bị thu hồi và token mới chỉ hiển thị một lần."}</small></span></section><label class="wide"><span>Lý do bắt buộc</span><textarea name="reason" required minlength="5" maxlength="1000"></textarea></label>`, revoke ? "Thu hồi" : "Xoay token");
    dialog.querySelector("form").addEventListener("submit", async (event) => { event.preventDefault(); const reason = new FormData(event.currentTarget).get("reason"); try { const result = await api("action", { method: "POST", body: { action: revoke ? "service-account:revoke" : "service-account:rotate", serviceAccountId, reason } }); dialog.close(); dialog.remove(); if (result.token) { const reveal = modal("Token mới hiển thị một lần", `<section class="wide hh-admin-token-reveal"><strong>${esc(result.token)}</strong><small>Lưu token ngay; server không thể hiển thị lại plaintext token.</small><button type="button" data-admin-copy-token>Copy token</button></section>`, "Đã hiểu"); reveal.querySelector("[data-admin-copy-token]")?.addEventListener("click", async () => { await navigator.clipboard?.writeText(result.token); notice("Đã copy token."); }); } else notice(revoke ? "Service account đã thu hồi." : "Token đã xoay."); await renderGovernance("service-accounts"); } catch (error) { notice(error.message, "error"); } });
  }

  function revokeSession(sessionId) {
    const dialog = modal("Thu hồi phiên đăng nhập", `<section class="wide hh-admin-boundary"><i>◈</i><span><strong>${esc(sessionId)}</strong><small>IP, token và nội dung phiên không được hiển thị.</small></span></section><label class="wide"><span>Lý do bắt buộc</span><textarea name="reason" required minlength="5" maxlength="1000"></textarea></label>`, "Thu hồi phiên");
    dialog.querySelector("form").addEventListener("submit", async (event) => { event.preventDefault(); const reason = new FormData(event.currentTarget).get("reason"); try { await api("action", { method: "POST", body: { action: "session:revoke", sessionId, reason } }); dialog.close(); dialog.remove(); notice("Phiên đã thu hồi."); await renderGovernance("sessions"); } catch (error) { notice(error.message, "error"); } });
  }

  async function healthCheckAdapter(adapterId) {
    try { const result = await api("action", { method: "POST", body: { action: "adapter:health-check", adapterId } }); notice(result.note || "Đã kiểm tra cấu hình adapter."); await renderGovernance("adapter-health"); } catch (error) { notice(error.message, "error"); }
  }

  function createWorkspace() {
    const dialog = modal("Tạo workspace", `<label><span>Tên workspace</span><input name="name" required minlength="3" maxlength="160"></label><label><span>Slug</span><input name="slug" maxlength="100" placeholder="tu-dong-tao-neu-bo-trong"></label><label><span>Owner ID</span><input name="ownerId" maxlength="180"></label><label><span>AI budget</span><input name="aiBudget" type="number" min="0" value="0"></label><label><span>Storage limit (bytes)</span><input name="storageLimit" type="number" min="0" value="0"></label><label class="wide"><span>Module IDs (mỗi dòng)</span><textarea name="moduleIds"></textarea></label><label class="wide"><span>Lý do bắt buộc</span><textarea name="reason" required minlength="5" maxlength="1000"></textarea></label>`, "Tạo workspace");
    dialog.querySelector("form").addEventListener("submit", async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); try { await api("action", { method: "POST", body: { action: "workspace:update", ...values, aiBudget: Number(values.aiBudget || 0), storageLimit: Number(values.storageLimit || 0), moduleIds: String(values.moduleIds || "").split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean) } }); dialog.close(); dialog.remove(); notice("Workspace đã tạo và ghi audit."); await renderGovernance("workspace"); } catch (error) { notice(error.message, "error"); } });
  }

  function startGoogleReauthentication() {
    try { sessionStorage.setItem("hh-auth-return-to", "#/admin"); } catch {}
    location.assign(`${API_BASE}/api/auth/google?returnTo=${encodeURIComponent(location.origin)}`);
  }

  function activatePrivilege() {
    const reauth = privilege.googleReauthRecent
      ? '<span class="hh-admin-elevation-ready">✓ Google vừa xác minh danh tính</span>'
      : '<button type="button" class="hh-admin-google-reauth" data-admin-google-reauth>Đăng nhập lại bằng Google trước</button>';
    const dialog = modal("Kích hoạt quyền nâng cao", `<section class="wide hh-admin-elevation-preview"><i>⚡</i><span><strong>Temporary Privilege Elevation</strong><p>Quyền tự hết hạn, không thay đổi vai trò thường trực và mọi hành động đều được ghi audit.</p>${reauth}</span></section><label><span>Thời hạn</span><select name="durationMinutes"><option value="15">15 phút</option><option value="30" selected>30 phút</option><option value="60">60 phút</option></select></label><label class="wide"><span>Lý do kích hoạt</span><textarea name="reason" required minlength="5" maxlength="1000" placeholder="Công việc cụ thể cần quyền nâng cao"></textarea></label>`, "Kích hoạt quyền");
    dialog.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const release = beginFormSubmission(event.currentTarget, "Đang kích hoạt…");
      if (!release) return;
      const values = Object.fromEntries(new FormData(event.currentTarget));
      try {
        const data = await api("action", { method: "POST", body: { action: "privilege:activate", ...values, durationMinutes: Number(values.durationMinutes) } });
        privilege = data.privilege || privilege;
        dialog.close();
        dialog.remove();
        notice(`Quyền nâng cao đã kích hoạt trong ${Number(values.durationMinutes)} phút.`);
        await render(activeView);
      } catch (error) {
        notice(error.message, "error");
      } finally {
        release();
      }
    });
  }

  async function ensurePermissionCatalog() {
    if (permissionCatalog.length) return permissionCatalog;
    const data = await api("identity");
    permissionCatalog = data.permissionCatalog || [];
    customAdminRoles = data.customRoles || [];
    return permissionCatalog;
  }

  async function openPermissionSimulator() {
    await ensurePermissionCatalog();
    const groups = [...new Set(permissionCatalog.map((item) => item.group))];
    const fields = groups.map((group) => `<fieldset><legend>${esc(group)}</legend>${permissionCatalog.filter((item) => item.group === group).map((item) => `<label class="${esc(item.tier)}"><input name="permissions" type="checkbox" value="${esc(item.id)}"><span><strong>${esc(item.label)}</strong><small>${esc(item.id)} · ${esc(item.tier)}</small></span></label>`).join("")}</fieldset>`).join("");
    const dialog = modal("Permission Simulator", `<section class="wide hh-admin-simulator-intro"><strong>Kiểm tra quyền trước khi cấp</strong><p>Simulator chỉ phân tích; không ghi vai trò hoặc thay đổi quyền của bất kỳ tài khoản nào.</p></section><section class="wide hh-admin-permission-picker">${fields}</section><output class="wide hh-admin-simulator-result" aria-live="polite">Chọn quyền rồi bấm Phân tích.</output>`, "Phân tích quyền");
    dialog.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const permissions = new FormData(event.currentTarget).getAll("permissions");
      try {
        const data = await api("action", { method: "POST", body: { action: "permission:simulate", permissions } });
        const result = data.simulation || {};
        const output = dialog.querySelector(".hh-admin-simulator-result");
        output.innerHTML = `<span class="${Number(result.riskScore || 0) >= 60 ? "critical" : Number(result.riskScore || 0) >= 30 ? "elevated" : "standing"}"><strong>Risk score ${Number(result.riskScore || 0)}/100</strong><small>${Number(result.newAccess?.length || 0)} quyền mới · ${Number(result.elevated?.length || 0)} nâng cao · ${Number(result.critical?.length || 0)} tối quan trọng</small></span>${(result.conflicts || []).map((item) => `<p>⚠ ${esc(item)}</p>`).join("") || "<p>Không phát hiện xung đột quyền.</p>"}`;
      } catch (error) {
        notice(error.message, "error");
      }
    });
  }

  async function openCustomRole() {
    await ensurePermissionCatalog();
    const groups = [...new Set(permissionCatalog.map((item) => item.group))];
    const fields = groups.map((group) => `<fieldset><legend>${esc(group)}</legend>${permissionCatalog.filter((item) => item.group === group).map((item) => `<label class="${esc(item.tier)}"><input name="permissions" type="checkbox" value="${esc(item.id)}"><span><strong>${esc(item.label)}</strong><small>${esc(item.id)}</small></span></label>`).join("")}</fieldset>`).join("");
    const dialog = modal("Tạo vai trò quản trị tùy chỉnh", `<label><span>Mã vai trò</span><input name="key" required minlength="3" maxlength="32" pattern="[a-z][a-z0-9_-]{2,31}" placeholder="security_operator"></label><label><span>Tên hiển thị</span><input name="name" required minlength="3" maxlength="120" placeholder="Security Operator"></label><label class="wide"><span>Mô tả phạm vi</span><textarea name="description" maxlength="500"></textarea></label><section class="wide hh-admin-permission-picker">${fields}</section><label class="wide"><span>Lý do tạo/cập nhật</span><textarea name="reason" required minlength="5" maxlength="1000"></textarea></label>`, "Lưu custom role");
    dialog.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const body = { action: "custom-role:save", key: form.get("key"), name: form.get("name"), description: form.get("description"), permissions: form.getAll("permissions"), reason: form.get("reason") };
      try {
        await api("action", { method: "POST", body });
        dialog.close();
        dialog.remove();
        notice("Vai trò tùy chỉnh đã được lưu vào audit chain phát hiện chỉnh sửa.");
        await renderPower();
      } catch (error) {
        notice(error.message, "error");
      }
    });
  }

  function controlAction(actionId, tier, connected) {
    const booleanActions = new Set(["platform.maintenance", "payos.lock", "ai.provider", "content.lock-publishing"]);
    const valueField = booleanActions.has(actionId)
      ? '<label><span>Trạng thái mới</span><select name="value"><option value="true">Bật / khóa</option><option value="false">Tắt / mở lại</option></select></label>'
      : '<label><span>Giá trị hoặc phiên bản</span><input name="value" maxlength="240" placeholder="Giá trị an toàn, không nhập secret"></label>';
    const dialog = modal(tier === "critical" ? "Tạo yêu cầu phê duyệt kép" : "Điều khiển Root Console", `<section class="wide hh-admin-control-preview ${esc(tier)}"><header><span><small>${esc(tier.toUpperCase())}</small><strong>${esc(actionId)}</strong></span><b>${connected ? "Adapter sẵn sàng" : "Cần adapter server"}</b></header><div><article><small>TRƯỚC</small><strong>Cấu hình production hiện tại</strong><p>Giá trị bí mật không được tải về trình duyệt.</p></article><i>→</i><article><small>SAU</small><strong>Thay đổi theo yêu cầu bên dưới</strong><p>${tier === "critical" ? "Chỉ chạy sau phê duyệt của Super Admin thứ hai." : "Cần privilege session còn hiệu lực."}</p></article></div></section><label><span>Đối tượng</span><input name="target" maxlength="160" placeholder="provider, domain, môi trường hoặc resource ID"></label>${valueField}<label class="wide"><span>Ghi chú runbook</span><textarea name="note" maxlength="500"></textarea></label><label class="wide"><span>Lý do bắt buộc</span><textarea name="reason" required minlength="5" maxlength="1000"></textarea></label>`, tier === "critical" ? "Gửi yêu cầu 2 người" : "Preview và thực hiện");
    dialog.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const release = beginFormSubmission(event.currentTarget, tier === "critical" ? "Đang tạo yêu cầu…" : "Đang thực thi…");
      if (!release) return;
      const values = Object.fromEntries(new FormData(event.currentTarget));
      if (booleanActions.has(actionId)) values.value = values.value === "true";
      const apiAction = tier === "critical" ? "approval:request" : "control:execute";
      try {
        const data = await api("action", { method: "POST", body: { action: apiAction, actionId, ...values } });
        dialog.close();
        dialog.remove();
        notice(tier === "critical" ? "Đã tạo yêu cầu; cần Super Admin còn lại phê duyệt." : data.result?.detail || "Điều khiển đã được ghi nhận.");
        await renderPower();
      } catch (error) {
        notice(error.message, "error");
      } finally {
        release();
      }
    });
  }

  function roleLifecycle(action, key, version = "") {
    const label = action === "publish" ? "Publish phiên bản role" : action === "disable" ? "Disable custom role" : "Rollback custom role";
    const extra = action === "rollback" ? `<label><span>Version cần rollback</span><input name="version" type="number" min="1" value="${esc(version)}" required></label>` : "";
    const dialog = modal(label, `${extra}<section class="wide hh-admin-boundary"><i>${action === "disable" ? "!" : "↻"}</i><span><strong>custom:${esc(key)}</strong><small>Thay đổi role có thể ảnh hưởng nhiều assignment; luôn ghi audit và yêu cầu elevated session.</small></span></section><label class="wide"><span>Lý do bắt buộc</span><textarea name="reason" required minlength="5" maxlength="1000"></textarea></label>`, action === "disable" ? "Disable role" : action === "rollback" ? "Rollback role" : "Publish role");
    dialog.querySelector("form").addEventListener("submit", async (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); try { await api("action", { method: "POST", body: { action: `role:${action}`, key, version: values.version, reason: values.reason } }); dialog.close(); dialog.remove(); notice("Vòng đời custom role đã cập nhật."); await renderPower(); } catch (error) { notice(error.message, "error"); } });
  }

  function decideApproval(requestId, decision) {
    const dialog = modal(decision === "approve" ? "Phê duyệt thao tác tối quan trọng" : "Từ chối yêu cầu", `<section class="wide hh-admin-kill-switch"><strong>${esc(requestId)}</strong><p>Super Admin yêu cầu và Super Admin quyết định phải là hai tài khoản khác nhau.</p><span>Quyết định được nối vào audit chain phát hiện chỉnh sửa; chỉ một tiến trình được quyền thực thi.</span></section><label class="wide"><span>Lý do quyết định</span><textarea name="reason" required minlength="5" maxlength="1000"></textarea></label>`, decision === "approve" ? "Phê duyệt và thực thi" : "Từ chối");
    dialog.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const release = beginFormSubmission(event.currentTarget, decision === "approve" ? "Đang nhận quyền thực thi…" : "Đang từ chối…");
      if (!release) return;
      const reason = new FormData(event.currentTarget).get("reason");
      try {
        const data = await api("action", { method: "POST", body: { action: decision === "approve" ? "approval:approve" : "approval:reject", requestId, reason } });
        dialog.close();
        dialog.remove();
        notice(data.approval?.result?.detail || "Quyết định đã được ghi audit.");
        await renderPower();
      } catch (error) {
        notice(error.message, "error");
      } finally {
        release();
      }
    });
  }

  function completeAccessReview() {
    const dialog = modal("Hoàn tất Access Review tháng", '<section class="wide hh-admin-kill-switch"><strong>Monthly Access Review</strong><p>Hệ thống sẽ thống kê quản trị viên, custom role, tài khoản quản trị bị khóa và lưu snapshot vào audit.</p></section><label class="wide"><span>Kết luận và lý do</span><textarea name="reason" required minlength="5" maxlength="1000"></textarea></label>', "Hoàn tất review");
    dialog.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const reason = new FormData(event.currentTarget).get("reason");
      try {
        await api("action", { method: "POST", body: { action: "access-review:complete", reason } });
        dialog.close();
        dialog.remove();
        notice("Access Review tháng đã hoàn tất và được ghi audit.");
        await renderAudit();
      } catch (error) {
        notice(error.message, "error");
      }
    });
  }

  function openCommandPalette() {
    const commands = [
      ["dashboard", "Mission Control", "Sức khỏe website và action queue"],
      ["power", "Root Authority", "Quyền, adapter và phê duyệt kép"],
      ["identity", "Identity & Access", "Vai trò và danh tính Google"],
      ["users", "Tìm người dùng", "Khóa, xác minh và thu hồi phiên"],
      ["security", "Security Findings", "Điều tra cảnh báo production"],
      ["rights", "Comic Rights Console", "Bằng chứng, giấy phép và Render Worker"],
      ["platform", "Platform & Release", "Deployment, queue và provider"],
      ["audit", "Tamper-evident Audit", "Lọc hành động trước/sau"],
      ["growth", "Growth & Data", "PayOS, funnel và AI usage"]
    ];
    const dialog = modal("Admin Command Palette", `<label class="wide hh-admin-command-search"><span>⌕</span><input data-admin-command-search autofocus placeholder="Tìm người dùng, incident, deployment hoặc công cụ"></label><section class="wide hh-admin-command-results">${commands.map(([view, label, detail]) => `<button type="button" data-admin-view="${view}" data-command-text="${esc(`${label} ${detail}`.toLowerCase())}"><i>→</i><span><strong>${esc(label)}</strong><small>${esc(detail)}</small></span></button>`).join("")}</section>`, "Đóng");
    dialog.querySelector("[data-admin-command-search]")?.addEventListener("input", (event) => {
      const query = String(event.target.value || "").trim().toLowerCase();
      dialog.querySelectorAll("[data-command-text]").forEach((button) => { button.hidden = Boolean(query && !button.dataset.commandText.includes(query)); });
    });
    dialog.querySelector("footer .primary")?.addEventListener("click", () => { dialog.close(); dialog.remove(); });
  }

  function updateIncident(signalKey, currentStatus = "new", currentAssignee = "") {
    const content = `<label><span>Trạng thái</span><select name="status">${[["new", "Mới"], ["investigating", "Đang điều tra"], ["mitigated", "Đã giảm thiểu"], ["resolved", "Đã giải quyết"]].map(([value, label]) => `<option value="${value}" ${currentStatus === value ? "selected" : ""}>${label}</option>`).join("")}</select></label><label><span>Người phụ trách</span><input name="assignee" maxlength="180" value="${esc(currentAssignee)}" placeholder="Email quản trị viên"></label><label class="wide"><span>Kết luận hoặc hướng xử lý</span><textarea name="resolution" maxlength="1000"></textarea></label><label class="wide"><span>Ghi chú timeline bắt buộc</span><textarea name="reason" required minlength="5" maxlength="1000"></textarea></label>`;
    const dialog = modal("Cập nhật incident", content, "Lưu vào timeline");
    dialog.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      try {
        await api("action", { method: "POST", body: { action: "incident:update", signalKey, ...values } });
        dialog.close();
        dialog.remove();
        notice("Incident đã cập nhật và ghi audit log.");
        await renderSecurity();
      } catch (error) {
        notice(error.message, "error");
      }
    });
  }

  function updateJob(jobId, operation) {
    const labels = { pause: "Tạm dừng job", retry: "Chạy lại job", cancel: "Hủy job", duplicate: "Nhân bản job" };
    const dialog = modal(labels[operation] || "Cập nhật job", `<section class="wide hh-admin-kill-switch"><strong>${esc(jobId)}</strong><p>Payload, token và secret của job không được hiển thị trong Admin Panel.</p><span>Thao tác ${esc(operation)} sẽ được ghi đầy đủ vào audit log.</span></section><label class="wide"><span>Lý do bắt buộc</span><textarea name="reason" required minlength="5" maxlength="1000"></textarea></label>`, "Xác nhận");
    dialog.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const reason = new FormData(event.currentTarget).get("reason");
      try {
        await api("action", { method: "POST", body: { action: "queue-job:update", jobId, operation, reason } });
        dialog.close();
        dialog.remove();
        notice("Background job đã được cập nhật.");
        await renderPlatform();
      } catch (error) {
        notice(error.message, "error");
      }
    });
  }

  async function render(view = activeView) {
    clearTimeout(activityTimer);
    const previousPlanet = planetForView(activeView);
    activeView = view;
    if (panelRef && previousPlanet !== planetForView(view) && preferences.motion !== "static" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      panelRef.classList.add("is-admin-wormhole");
      setTimeout(() => panelRef?.classList.remove("is-admin-wormhole"), preferences.motion === "cinematic" ? 380 : 260);
    }
    if (view === "dashboard") return renderDashboard();
    if (view === "identity") return renderIdentity();
    if (view === "power") return renderPower();
    if (["effective-access", "role-assignments", "role-history", "access-requests", "service-accounts", "sessions", "devices", "adapter-health", "integrations", "workspace", "ai-operations", "data-governance"].includes(view)) return renderGovernance(view);
    if (view === "security") return renderSecurity();
    if (view === "privacy") return renderPrivacy();
    if (["activity", "community"].includes(view)) return renderActivity();
    if (view === "users") return renderUsers();
    if (view === "trust") return renderTrust();
    if (["reports", "appeals"].includes(view)) return renderQueue(view);
    if (view === "content") return renderContent();
    if (view === "rights") return renderRights();
    if (view === "platform") return renderPlatform();
    if (view === "growth") return renderGrowth();
    if (view === "audit") return renderAudit();
    if (view === "settings") return renderSettings();
  }

  async function discoverAccess({ force = false } = {}) {
    const token = window.HHAuthSession?.token?.() || "";
    if (!token || !API_BASE) { access = null; accessToken = token; return null; }
    if (!force && access && accessToken === token) return access;
    accessToken = token;
    try { const data = await api("me"); access = data.access?.admin ? data.access : null; }
    catch { access = null; }
    return access;
  }

  async function ensureNav() {
    clearTimeout(navTimer);
    navTimer = setTimeout(async () => {
      const currentAccess = await discoverAccess();
      const nav = document.querySelector("[data-community-center] .hh-v2-nav");
      const topNav = document.querySelector("[data-community-center] .hh-social-tabs");
      const existing = nav?.querySelector('[data-social-v2-view="admin"]');
      const topExisting = topNav?.querySelector('[data-social-v2-view="admin"]');
      if (!currentAccess) { existing?.remove(); topExisting?.remove(); return; }
      if (nav && !existing) nav.insertAdjacentHTML("beforeend", '<button type="button" data-social-v2-view="admin" style="--item:#f4d76d"><i>⚙</i><span>Community Admin</span><b hidden>0</b></button>');
      if (topNav && !topExisting) topNav.insertAdjacentHTML("beforeend", '<button type="button" data-social-v2-view="admin"><span>⚙</span>Quản trị</button>');
    }, 80);
  }

  async function mount(panel) {
    panelRef = panel;
    const data = await api("mission");
    if (!data.access?.admin) throw new Error("Tài khoản không có quyền truy cập Community Admin.");
    access = data.access;
    accessToken = window.HHAuthSession?.token?.() || "";
    activeView = "dashboard";
    await renderDashboard(data);
  }

  document.addEventListener("click", async (event) => {
    if (!event.target.closest(".hh-admin-app, .hh-admin-modal")) return;
    const view = event.target.closest("[data-admin-view]"); if (view) { document.querySelector("[data-community-admin-modal]")?.remove(); await render(view.dataset.adminView).catch((error) => notice(error.message, "error")); return; }
    if (event.target.closest("[data-admin-command]")) { openCommandPalette(); return; }
    if (event.target.closest("[data-admin-privilege-activate]")) { activatePrivilege(); return; }
    if (event.target.closest("[data-admin-google-reauth]")) { startGoogleReauthentication(); return; }
    if (event.target.closest("[data-admin-permission-simulate]")) { await openPermissionSimulator().catch((error) => notice(error.message, "error")); return; }
    if (event.target.closest("[data-admin-custom-role]")) { await openCustomRole().catch((error) => notice(error.message, "error")); return; }
    const roleLifecycleAction = event.target.closest("[data-admin-role-lifecycle]"); if (roleLifecycleAction) { roleLifecycle(roleLifecycleAction.dataset.adminRoleLifecycle, roleLifecycleAction.dataset.adminRoleKey, roleLifecycleAction.dataset.adminRoleVersion); return; }
    if (event.target.closest("[data-admin-access-request]")) { await openAccessRequest().catch((error) => notice(error.message, "error")); return; }
    const accessDecision = event.target.closest("[data-admin-access-decision]"); if (accessDecision) { decideAccessRequest(accessDecision.dataset.adminAccessRequestId, accessDecision.dataset.adminAccessDecision); return; }
    if (event.target.closest("[data-admin-assignment-create]")) { await openAssignmentCreator().catch((error) => notice(error.message, "error")); return; }
    const assignmentRevoke = event.target.closest("[data-admin-assignment-revoke]"); if (assignmentRevoke) { revokeAssignment(assignmentRevoke.dataset.adminAssignmentRevoke, assignmentRevoke.dataset.adminAssignmentUser); return; }
    if (event.target.closest("[data-admin-service-account-create]")) { createServiceAccount(); return; }
    const serviceRotate = event.target.closest("[data-admin-service-rotate]"); if (serviceRotate) { rotateServiceAccount(serviceRotate.dataset.adminServiceRotate); return; }
    const serviceRevoke = event.target.closest("[data-admin-service-revoke]"); if (serviceRevoke) { rotateServiceAccount(serviceRevoke.dataset.adminServiceRevoke, true); return; }
    const sessionRevoke = event.target.closest("[data-admin-session-revoke]"); if (sessionRevoke) { revokeSession(sessionRevoke.dataset.adminSessionRevoke); return; }
    const adapterHealth = event.target.closest("[data-admin-adapter-health]"); if (adapterHealth) { await healthCheckAdapter(adapterHealth.dataset.adminAdapterHealth); return; }
    if (event.target.closest("[data-admin-workspace-create]")) { createWorkspace(); return; }
    const control = event.target.closest("[data-admin-control]"); if (control) { controlAction(control.dataset.adminControl, control.dataset.controlTier, control.dataset.controlConnected === "true"); return; }
    const approval = event.target.closest("[data-admin-approval]"); if (approval) { decideApproval(approval.dataset.adminApproval, approval.dataset.approvalDecision); return; }
    if (event.target.closest("[data-admin-access-review]")) { completeAccessReview(); return; }
    if (event.target.closest("[data-admin-audit-checkpoint]")) { createAuditCheckpoint(); return; }
    const open = event.target.closest("[data-admin-user-open]"); if (open) { await openUser(open.dataset.adminUserOpen).catch((error) => notice(error.message, "error")); return; }
    const action = event.target.closest("[data-admin-user-action]"); if (action) { document.querySelector("[data-community-admin-modal]")?.remove(); await userAction(action.dataset.userId, action.dataset.adminUserAction, action.dataset.userVerified === "true", String(action.dataset.userFeatures || "").split(",").filter(Boolean)).catch((error) => notice(error.message, "error")); return; }
    const page = event.target.closest("[data-admin-users-page]"); if (page) { await renderUsers({ page: page.dataset.adminUsersPage }); return; }
    const resolve = event.target.closest("[data-admin-resolve]"); if (resolve) { resolveRecord(resolve.dataset.adminResolve, resolve.dataset.kind); return; }
    const content = event.target.closest("[data-admin-content-action]"); if (content) { moderateContent(content.dataset.contentId, content.dataset.contentType, content.dataset.adminContentAction); return; }
    const rightsAction = event.target.closest("[data-admin-rights-action]"); if (rightsAction) { reviewComicRights(rightsAction.dataset.rightsId, rightsAction.dataset.adminRightsAction); return; }
    const rightsPage = event.target.closest("[data-admin-rights-page]"); if (rightsPage) { await renderRights({ page: rightsPage.dataset.adminRightsPage }).catch((error) => notice(error.message, "error")); return; }
    if (event.target.closest("[data-admin-rights-trusted-sync]")) { syncTrustedComicRights(); return; }
    if (event.target.closest("[data-admin-rights-worker-test]")) { await renderRights().catch((error) => notice(error.message, "error")); return; }
    const incident = event.target.closest("[data-admin-incident]"); if (incident) { updateIncident(incident.dataset.adminIncident, incident.dataset.incidentStatus, incident.dataset.incidentAssignee); return; }
    const job = event.target.closest("[data-admin-job]"); if (job) { updateJob(job.dataset.adminJob, job.dataset.jobOperation); return; }
    const setting = event.target.closest("[data-admin-setting]"); if (setting) { updateSetting(setting.dataset.adminSetting); return; }
    const flag = event.target.closest("[data-admin-flag-toggle]"); if (flag) { toggleFlag(flag.dataset.adminFlagToggle); return; }
    const audit = event.target.closest("[data-admin-audit-open]"); if (audit) { openAudit(audit.dataset.adminAuditOpen); return; }
    const route = event.target.closest("[data-admin-route]"); if (route) { window.location.hash = `#${route.dataset.adminRoute}`; return; }
    if (event.target.closest("[data-admin-activity-refresh]")) { await renderActivity().catch((error) => notice(error.message, "error")); return; }
    if (event.target.closest("[data-admin-export]")) { try { const data = await api("export", { query: { reason: "Xuất báo cáo vận hành Community" } }); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })); link.download = `hh-community-report-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); notice("Đã xuất báo cáo không chứa mật khẩu hoặc tin nhắn riêng."); } catch (error) { notice(error.message, "error"); } }
  });

  document.addEventListener("submit", async (event) => {
    const userForm = event.target.closest("[data-admin-user-search]");
    if (userForm) {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(userForm));
      await renderUsers({ ...values, page: 1 }).catch((error) => notice(error.message, "error"));
      return;
    }
    const contentForm = event.target.closest("[data-admin-content-filter]");
    if (contentForm) {
      event.preventDefault();
      await renderContent(Object.fromEntries(new FormData(contentForm))).catch((error) => notice(error.message, "error"));
      return;
    }
    const rightsForm = event.target.closest("[data-admin-rights-filter]");
    if (rightsForm) {
      event.preventDefault();
      await renderRights({ ...Object.fromEntries(new FormData(rightsForm)), page: 1 }).catch((error) => notice(error.message, "error"));
      return;
    }
    const auditForm = event.target.closest("[data-admin-audit-filter]");
    if (auditForm) {
      event.preventDefault();
      await renderAudit(Object.fromEntries(new FormData(auditForm))).catch((error) => notice(error.message, "error"));
    }
  });

  document.addEventListener("change", (event) => {
    const theme = event.target.closest("[data-admin-theme-select]");
    const motion = event.target.closest("[data-admin-motion-select]");
    const textScale = event.target.closest("[data-admin-text-select]");
    const density = event.target.closest("[data-admin-density-select]");
    if (!theme && !motion && !textScale && !density) return;
    if (theme) preferences.theme = THEMES.some(([id]) => id === theme.value) ? theme.value : "deep-space";
    if (motion) preferences.motion = MOTION_LEVELS.some(([id]) => id === motion.value) ? motion.value : "balanced";
    if (textScale) preferences.textScale = TEXT_SCALES.some(([id]) => id === textScale.value) ? textScale.value : "comfortable";
    if (density) preferences.density = DENSITY_LEVELS.some(([id]) => id === density.value) ? density.value : "comfortable";
    try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); } catch {}
    const app = panelRef?.querySelector(".hh-admin-galaxy");
    if (app) {
      app.dataset.adminTheme = preferences.theme;
      app.dataset.adminMotion = preferences.motion;
      app.dataset.adminText = preferences.textScale;
      app.dataset.adminDensity = preferences.density;
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k" || !panelRef?.querySelector(".hh-admin-galaxy")) return;
    event.preventDefault();
    openCommandPalette();
  });

  const observer = new MutationObserver(ensureNav);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("storage", (event) => { if (event.key === "hh-auth-user") { access = null; ensureNav(); } });
  window.addEventListener("hh:auth-ready", () => { access = null; ensureNav(); });
  ensureNav();

  window.HHCommunityAdmin = Object.freeze({
    mount,
    refresh: () => panelRef ? render(activeView) : Promise.resolve(),
    refreshAccess: () => discoverAccess({ force: true }),
    access: () => access
  });
})();
