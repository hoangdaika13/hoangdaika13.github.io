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
  let auditEntries = [];
  let featureFlags = [];
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
    users: "identity",
    audit: "identity",
    security: "security",
    privacy: "security",
    incidents: "security",
    community: "community",
    activity: "community",
    trust: "trust",
    reports: "trust",
    appeals: "trust",
    content: "trust",
    platform: "platform",
    settings: "platform",
    growth: "growth"
  });
  const THEMES = Object.freeze([
    ["deep-space", "Deep Space Admin"],
    ["aurora", "Aurora Shield"],
    ["cyber", "Cyber Command"],
    ["nebula", "Nebula Rose"],
    ["golden", "Golden Observatory"]
  ]);
  const MOTION_LEVELS = Object.freeze([["static", "Tĩnh"], ["balanced", "Cân bằng"], ["cinematic", "Điện ảnh"]]);
  const readPreferences = () => {
    try {
      const value = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "{}");
      return {
        theme: THEMES.some(([id]) => id === value.theme) ? value.theme : "deep-space",
        motion: MOTION_LEVELS.some(([id]) => id === value.motion) ? value.motion : "balanced"
      };
    } catch {
      return { theme: "deep-space", motion: "balanced" };
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
  const statusLabel = (status) => ({ operational: "Ổn định", warning: "Cần theo dõi", critical: "Nghiêm trọng", "not-configured": "Chưa kết nối", new: "Mới", investigating: "Đang điều tra", mitigated: "Đã giảm thiểu", resolved: "Đã giải quyết", queued: "Đang chờ", running: "Đang chạy", paused: "Tạm dừng", failed: "Thất bại", cancelled: "Đã hủy" }[status] || String(status || "Không rõ"));

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

  function shell(content, title = "Galaxy Mission Control", description = "Điều hành toàn bộ HH Platform bằng dữ liệu production đã được làm sạch.") {
    const activePlanet = planetForView(activeView);
    const planets = PLANETS.filter((planet) => has(planet.permission));
    const themeOptions = THEMES.map(([id, label]) => `<option value="${id}" ${preferences.theme === id ? "selected" : ""}>${esc(label)}</option>`).join("");
    const motionOptions = MOTION_LEVELS.map(([id, label]) => `<option value="${id}" ${preferences.motion === id ? "selected" : ""}>Hiệu ứng: ${esc(label)}</option>`).join("");
    return `<section class="hh-admin-app hh-admin-galaxy" data-admin-theme="${esc(preferences.theme)}" data-admin-motion="${esc(preferences.motion)}" data-admin-planet="${esc(activePlanet)}">
      <span class="hh-admin-stardust" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
      <header class="hh-admin-galaxy-header">
        <div class="hh-admin-galaxy-brand"><span class="hh-admin-core-mark" aria-hidden="true">HH<i></i></span><div><small>HH ADMIN GALAXY · SERVER RBAC</small><h5>${esc(title)}</h5><p>${esc(description)}</p></div></div>
        <div class="hh-admin-galaxy-controls">
          <label><span class="sr-only">Chủ đề Admin Galaxy</span><select data-admin-theme-select aria-label="Chủ đề Admin Galaxy">${themeOptions}</select></label>
          <label><span class="sr-only">Mức hiệu ứng</span><select data-admin-motion-select aria-label="Mức hiệu ứng">${motionOptions}</select></label>
          <span class="hh-admin-role">${esc((access?.roles || []).join(" · "))}</span>
          ${has("reports.export") ? '<button type="button" data-admin-export>⇩ Xuất báo cáo</button>' : ""}
        </div>
      </header>
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
          <div class="hh-admin-core-star ${Number(data.metrics?.criticalIncidents || 0) ? "has-flare" : ""}" style="--score:${score}"><i>HH</i><span><strong>${score}</strong><small>HEALTH SCORE</small></span></div>
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
      ["Bắt buộc lý do cho hành động nhạy cảm", data.policy?.reasonRequiredForSensitiveActions]
    ].map(([label, ready]) => `<span class="${ready ? "ready" : "missing"}"><i>${ready ? "✓" : "!"}</i>${esc(label)}</span>`).join("");
    const content = `${subnav([["identity", "Tổng quan IAM"], ["users", "Người dùng", "users.view"], ["audit", "Audit quyền", "audit.view"]])}
      <section class="hh-admin-identity-metrics">${metrics}</section>
      <section class="hh-admin-identity-grid">
        <article class="hh-admin-access-policy"><header><span><small>ZERO-TRUST ACCESS</small><strong>Chính sách danh tính</strong></span><b>${Number(data.policy?.ownerCount || 0)} Super Admin</b></header><div>${policyChecks}</div><p>Hai Super Admin hiện tại được xác định từ email Google đã xác minh. Vai trò giao diện không thể tự cấp quyền.</p></article>
        <article class="hh-admin-recent-users"><header><span><small>RECENT IDENTITIES</small><strong>Tài khoản gần đây</strong></span><button type="button" data-admin-view="users">Quản lý tất cả</button></header><div>${users}</div></article>
      </section>
      <section class="hh-admin-role-matrix"><header><span><small>PRIVILEGE MATRIX</small><strong>Vai trò và quyền theo tác vụ</strong></span><p>Owner không thể được cấp từ Admin Panel.</p></header><div>${roles}</div></section>`;
    panelRef.innerHTML = shell(content, "Identity & Access", "Danh tính Google đã xác minh, phiên đăng nhập và quyền chi tiết theo từng tác vụ.");
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
    const content = `${subnav([["security", "Findings"], ["privacy", "Privacy & Consent", "privacy.view"], ["audit", "Audit log", "audit.view"]])}
      <section class="hh-admin-severity-strip">${severity}</section>
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

  function userAction(userId, mode, currentVerified = false, currentFeatures = []) {
    const labels = { status: "Cập nhật trạng thái", verify: "Xác minh tài khoản", revoke: "Thu hồi toàn bộ phiên", roles: "Phân quyền hệ thống", features: "Giới hạn quyền dùng tính năng" };
    const content = `${mode === "status" ? '<label><span>Trạng thái</span><select name="status"><option value="active">Hoạt động / mở khóa</option><option value="locked">Khóa</option><option value="suspended">Tạm đình chỉ</option><option value="banned">Cấm</option></select></label><label><span>Đình chỉ đến</span><input name="suspendedUntil" type="datetime-local"></label>' : ""}${mode === "verify" ? `<label><span>Trạng thái xác minh</span><select name="verified"><option value="true" ${currentVerified ? "" : "selected"}>Xác minh tài khoản</option><option value="false" ${currentVerified ? "selected" : ""}>Bỏ xác minh</option></select></label>` : ""}${mode === "roles" ? `<section class="hh-admin-role-picker">${["super_admin","admin","security_admin","release_manager","content_moderator","support","analyst"].map((role) => `<label><input name="roles" type="checkbox" value="${role}"><span>${role}</span></label>`).join("")}</section>` : ""}${mode === "features" ? `<label class="wide"><span>ID module cần giới hạn</span><textarea name="restrictedFeatures" maxlength="4000" placeholder="Ví dụ: ai-center, media-center, music-ai">${esc(currentFeatures.join("\n"))}</textarea><small>Mỗi dòng hoặc dấu phẩy là một ID module. Để trống để mở lại toàn bộ.</small></label>` : ""}<label class="wide"><span>Lý do bắt buộc</span><textarea name="reason" required minlength="5" maxlength="1000"></textarea></label>`;
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
    const content = `${subnav([["trust", "Trust Queue"], ["reports", "Reports", "reports.manage"], ["appeals", "Appeals", "appeals.manage"], ["content", "Nội dung", "content.manage"]])}
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
    panelRef.innerHTML = shell(`${subnav([["trust", "Trust Queue"], ["reports", "Reports", "reports.manage"], ["appeals", "Appeals", "appeals.manage"], ["content", "Nội dung", "content.manage"]])}<section class="hh-admin-queue">${rows}</section>`, view === "reports" ? "Quản lý báo cáo" : "Quản lý kháng nghị", "Phân loại, xử lý và lưu lịch sử quyết định.");
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
    panelRef.innerHTML = shell(`${subnav([["trust", "Trust Queue"], ["reports", "Reports", "reports.manage"], ["appeals", "Appeals", "appeals.manage"], ["content", "Nội dung", "content.manage"]])}${toolbar}<section class="hh-admin-content-list">${rows}</section>`, "Quản lý nội dung", "Giới hạn phân phối, gỡ hoặc khôi phục bằng soft delete và lưu đầy đủ lý do.");
  }

  function moderateContent(id, type, mode) {
    const dialog = modal("Kiểm duyệt nội dung", '<label class="wide"><span>Lý do bắt buộc</span><textarea name="reason" required minlength="5" maxlength="1000"></textarea></label>', mode === "remove" ? "Gỡ nội dung" : "Khôi phục");
    dialog.querySelector("form").addEventListener("submit", async (event) => { event.preventDefault(); const reason = new FormData(event.currentTarget).get("reason"); try { await api("action", { method: "POST", body: { action: "content:moderate", targetId: id, targetType: type, mode, reason } }); dialog.close(); dialog.remove(); notice("Nội dung đã được cập nhật và ghi audit log."); await renderContent(); } catch (error) { notice(error.message, "error"); } });
  }

  async function renderAudit() {
    panelRef.innerHTML = shell(loading(), "Audit log");
    const data = await api("audit");
    auditEntries = data.items || [];
    const rows = auditEntries.map((item) => `<tr><td><strong>${esc(item.action)}</strong><small>${esc(item.targetType)} · ${esc(item.targetId)}</small></td><td>${esc(item.admin?.name || "Admin")}<small>${esc(item.admin?.email || "")}</small></td><td>${esc(item.reason || "-")}</td><td>${esc(item.ip || "-")}</td><td>${dateText(item.createdAt)}</td><td><button type="button" data-admin-audit-open="${esc(item.id)}">Chi tiết</button></td></tr>`).join("") || '<tr><td colspan="6">Chưa có audit log.</td></tr>';
    panelRef.innerHTML = shell(`${subnav([["identity", "Identity & Access", "users.view"], ["security", "Security", "security.view"], ["platform", "Platform", "platform.view"], ["audit", "Audit log"]])}<section class="hh-admin-table"><table><thead><tr><th>Hành động</th><th>Admin</th><th>Lý do</th><th>IP</th><th>Thời gian</th><th></th></tr></thead><tbody>${rows}</tbody></table></section>`, "Audit log", "Theo dõi admin, hành động, đối tượng, IP, user agent và dữ liệu trước/sau.");
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
    const flags = featureFlags.map((item) => `<article><span><i class="${item.enabled ? "on" : ""}"></i><strong>${esc(item.key)}</strong><small>${esc(item.description || "Feature flag runtime")}</small></span><div><b>${item.enabled ? "Bật" : "Tắt"} · ${Number(item.rollout || 0)}%</b>${has("flags.manage") ? `<button type="button" data-admin-flag-toggle="${esc(item.key)}">${item.enabled ? "Kill switch" : "Bật lại"}</button>` : ""}</div></article>`).join("") || '<p class="hh-admin-empty">Chưa có feature flag.</p>';
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
    const content = `${subnav([["growth", "Growth Overview"], ["community", "Realtime", "activity.view"], ["privacy", "Consent", "privacy.view"]])}
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
    const flags = featureFlags.map((item) => `<article><span><strong>${esc(item.key)}</strong><small>${esc(item.description || "Feature flag")}</small></span><div><b class="${item.enabled ? "enabled" : ""}">${item.enabled ? "Bật" : "Tắt"} · ${Number(item.rollout || 0)}%</b><button type="button" data-admin-flag-toggle="${esc(item.key)}">${item.enabled ? "Tắt khẩn cấp" : "Bật lại"}</button></div></article>`).join("") || '<p class="hh-admin-empty">Chưa có feature flag.</p>';
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
    if (view === "security") return renderSecurity();
    if (view === "privacy") return renderPrivacy();
    if (["activity", "community"].includes(view)) return renderActivity();
    if (view === "users") return renderUsers();
    if (view === "trust") return renderTrust();
    if (["reports", "appeals"].includes(view)) return renderQueue(view);
    if (view === "content") return renderContent();
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
    const view = event.target.closest("[data-admin-view]"); if (view) { await render(view.dataset.adminView).catch((error) => notice(error.message, "error")); return; }
    const open = event.target.closest("[data-admin-user-open]"); if (open) { await openUser(open.dataset.adminUserOpen).catch((error) => notice(error.message, "error")); return; }
    const action = event.target.closest("[data-admin-user-action]"); if (action) { document.querySelector("[data-community-admin-modal]")?.remove(); userAction(action.dataset.userId, action.dataset.adminUserAction, action.dataset.userVerified === "true", String(action.dataset.userFeatures || "").split(",").filter(Boolean)); return; }
    const page = event.target.closest("[data-admin-users-page]"); if (page) { await renderUsers({ page: page.dataset.adminUsersPage }); return; }
    const resolve = event.target.closest("[data-admin-resolve]"); if (resolve) { resolveRecord(resolve.dataset.adminResolve, resolve.dataset.kind); return; }
    const content = event.target.closest("[data-admin-content-action]"); if (content) { moderateContent(content.dataset.contentId, content.dataset.contentType, content.dataset.adminContentAction); return; }
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
    }
  });

  document.addEventListener("change", (event) => {
    const theme = event.target.closest("[data-admin-theme-select]");
    const motion = event.target.closest("[data-admin-motion-select]");
    if (!theme && !motion) return;
    if (theme) preferences.theme = THEMES.some(([id]) => id === theme.value) ? theme.value : "deep-space";
    if (motion) preferences.motion = MOTION_LEVELS.some(([id]) => id === motion.value) ? motion.value : "balanced";
    try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); } catch {}
    const app = panelRef?.querySelector(".hh-admin-galaxy");
    if (app) {
      app.dataset.adminTheme = preferences.theme;
      app.dataset.adminMotion = preferences.motion;
    }
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
