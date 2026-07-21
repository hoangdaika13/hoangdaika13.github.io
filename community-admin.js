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

  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const dateText = (value) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("vi-VN"); };
  const durationText = (seconds) => { const value = Math.max(0, Number(seconds || 0)); return value < 60 ? `${value}s` : value < 3600 ? `${Math.floor(value / 60)}m ${value % 60}s` : `${Math.floor(value / 3600)}h ${Math.floor(value % 3600 / 60)}m`; };
  const metaText = (meta) => {
    if (!meta) return "";
    return [meta.kind, meta.form, meta.fieldCount ? `${meta.fieldCount} trường` : "", meta.lengthBucket ? `độ dài ${meta.lengthBucket}` : "", meta.interactionBucket ? `tương tác ${meta.interactionBucket}` : "", meta.durationBucket || "", meta.valid === false ? "chưa hợp lệ" : ""].filter(Boolean).join(" · ");
  };
  const notice = (message, type = "success") => window.HHCommunity?.notice?.(message, type);
  const has = (permission) => Boolean(access?.permissions?.includes("*") || access?.permissions?.includes(permission));

  async function api(view = "me", options = {}) {
    if (!API_BASE) throw new Error("Backend Community Admin chưa được cấu hình.");
    const token = window.HHAuthSession?.token?.() || "";
    if (!token) throw new Error("Bạn cần đăng nhập để mở Community Admin.");
    const query = new URLSearchParams({ view, ...(options.query || {}) });
    const response = await fetch(`${API_BASE}/api/community-admin?${query}`, {
      method: options.method || "GET",
      headers: { Authorization: `Bearer ${token}`, ...(options.body ? { "Content-Type": "application/json" } : {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Community Admin không phản hồi.");
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

  function shell(content, title = "Trung tâm quản trị", description = "Vận hành Community theo vai trò và audit log.") {
    const tabs = [
      ["dashboard", "⌂", "Tổng quan", "dashboard.view"],
      ["activity", "◉", "Hoạt động live", "activity.view"],
      ["users", "◎", "Người dùng", "users.view"],
      ["reports", "!", "Báo cáo", "reports.manage"],
      ["appeals", "↺", "Kháng nghị", "appeals.manage"],
      ["content", "▤", "Nội dung", "content.manage"],
      ["settings", "⚙", "Cấu hình", "config.manage"],
      ["audit", "◈", "Audit log", "audit.view"]
    ].filter(([, , , permission]) => has(permission));
    return `<section class="hh-admin-app"><header><div><small>ADMIN APPLICATION · RBAC</small><h5>${esc(title)}</h5><p>${esc(description)}</p></div><div><span class="hh-admin-role">${esc((access?.roles || []).join(" · "))}</span>${has("reports.export") ? '<button type="button" data-admin-export>Xuất báo cáo</button>' : ""}</div></header><div class="hh-admin-privacy"><i>◈</i><span><strong>Quan sát có giới hạn và có trách nhiệm</strong><small>Lưu loại biểu mẫu, nhóm độ dài, số tương tác và kết quả; không lưu ký tự gõ, giá trị form, prompt, mật khẩu, token hay tin nhắn riêng.</small></span></div><nav>${tabs.map(([id, icon, label]) => `<button type="button" data-admin-view="${id}" class="${activeView === id ? "active" : ""}"><i>${icon}</i><span>${label}</span></button>`).join("")}</nav><main data-admin-content>${content}</main></section>`;
  }

  function loading(label = "Đang tải dữ liệu quản trị...") {
    return `<section class="hh-admin-loading"><i></i><strong>${esc(label)}</strong></section>`;
  }

  async function renderDashboard() {
    panelRef.innerHTML = shell(loading());
    const data = await api("dashboard");
    const labels = {
      totalUsers: ["Tổng người dùng", "◎", "cyan"], onlineVisitors: ["Online realtime", "●", "green"], onlineRegistered: ["Online đăng nhập", "◉", "cyan"], activeUsers: ["Đã đăng nhập 15 phút", "◌", "green"], newUsers: ["Người dùng mới", "+", "pink"],
      newPosts: ["Bài viết mới", "▤", "gold"], newMessages: ["Tin nhắn 24h", "◌", "cyan"], mediaUploads: ["Media upload", "▧", "pink"],
      pendingReports: ["Báo cáo chờ", "!", "red"], lockedAccounts: ["Tài khoản khóa", "⊘", "red"], groups: ["Nhóm", "G", "green"],
      pages: ["Trang", "P", "cyan"], events: ["Sự kiện", "E", "gold"], marketplace: ["Marketplace", "M", "pink"],
      pendingJobs: ["Queue jobs", "↻", "cyan"], failedJobs: ["Jobs lỗi", "×", "red"]
    };
    const cards = Object.entries(labels).map(([key, [label, icon, color]]) => `<article class="${color}"><i>${icon}</i><small>${label}</small><strong>${Number(data.metrics?.[key] || 0).toLocaleString("vi-VN")}</strong><span>Cập nhật ${new Date(data.system?.generatedAt).toLocaleTimeString("vi-VN")}</span></article>`).join("");
    const errors = (data.recentErrors || []).map((item) => `<article><i>!</i><span><strong>${esc(item.type || "system:error")}</strong><small>${esc(item.path || "Hệ thống")} · ${dateText(item.createdAt)}</small></span></article>`).join("") || '<p class="hh-admin-empty">Không ghi nhận lỗi gần đây.</p>';
    const presence = (data.activeVisitors || []).map((item) => `<article><i>${item.avatar ? `<img src="${esc(item.avatar)}" alt="">` : esc((item.name || "HH").slice(0, 2).toUpperCase())}</i><span><strong>${esc(item.name)}</strong><small>${esc(item.email || (item.kind === "registered" ? "Đã đăng nhập" : "Khách ẩn danh"))}</small></span><code>${esc(item.page || "/")}</code><time>${dateText(item.lastSeenAt)}</time></article>`).join("") || '<p class="hh-admin-empty">Chưa có người truy cập trong 2 phút gần nhất.</p>';
    const content = `<section class="hh-admin-metrics">${cards}</section><section class="hh-admin-dashboard-grid"><article class="hh-admin-system"><header><div><small>SYSTEM HEALTH</small><strong>Tình trạng hệ thống</strong></div><span class="${data.system?.queue === "operational" ? "online" : "warning"}">${data.system?.queue === "operational" ? "Ổn định" : "Cần kiểm tra"}</span></header>${[["Frontend","operational"],["API",data.system?.api],["Database",data.system?.database],["Queue",data.system?.queue],["Authentication","operational"],["Storage","operational"]].map(([name, state]) => `<div><i class="${state === "operational" ? "online" : "warning"}"></i><strong>${name}</strong><span>${state === "operational" ? "Hoạt động" : "Suy giảm"}</span></div>`).join("")}<footer>Database latency: <b>${Number(data.system?.databaseLatencyMs || 0)} ms</b></footer></article><article class="hh-admin-errors"><header><div><small>OBSERVABILITY</small><strong>Lỗi gần đây</strong></div></header>${errors}</article><article class="hh-admin-presence"><header><div><small>REALTIME PRESENCE · 2 PHÚT</small><strong>Người đang sử dụng website</strong></div><span>${Number(data.metrics?.onlineVisitors || 0)} online</span></header><div>${presence}</div></article></section>`;
    panelRef.innerHTML = shell(content);
  }

  function rankingMarkup(items, empty = "Chưa đủ dữ liệu") {
    const rows = Array.isArray(items) ? items : [];
    const max = Math.max(1, ...rows.map((item) => Number(item.count || 0)));
    return rows.map((item, index) => `<div><b>${String(index + 1).padStart(2, "0")}</b><span><strong>${esc(item.name)}</strong><i style="--value:${Math.max(4, Math.round(Number(item.count || 0) / max * 100))}%"></i></span><em>${Number(item.count || 0).toLocaleString("vi-VN")}</em></div>`).join("") || `<p class="hh-admin-empty">${esc(empty)}</p>`;
  }

  async function renderActivity({ silent = false } = {}) {
    clearTimeout(activityTimer);
    if (!silent) panelRef.innerHTML = shell(loading("Đang kết nối dòng hoạt động realtime..."), "Behavior Center");
    const data = await api("activity");
    if (activeView !== "activity") return;
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
    const content = `<section class="hh-admin-metrics hh-admin-live-metrics">${summaryCards}</section><section class="hh-admin-live-toolbar"><div><i></i><span><strong>Live monitor đang chạy</strong><small>Tự làm mới mỗi 15 giây · dữ liệu chi tiết lưu 30 ngày</small></span></div><button type="button" data-admin-activity-refresh>↻ Làm mới ngay</button></section><section class="hh-admin-behavior-grid"><article class="hh-admin-live-sessions"><header><div><small>REALTIME SESSIONS</small><strong>Người dùng đang làm gì</strong></div><span>${Number(data.summary?.active5 || 0)} live</span></header><div>${sessions}</div></article><aside class="hh-admin-rankings"><article><header><small>TOP ROUTES</small><strong>Trang được mở</strong></header>${rankingMarkup(data.topRoutes)}</article><article><header><small>TOP FEATURES</small><strong>Module được dùng</strong></header>${rankingMarkup(data.topModules)}</article><article><header><small>TOP ACTIONS</small><strong>Thao tác phổ biến</strong></header>${rankingMarkup(data.topActions)}</article></aside><article class="hh-admin-event-timeline"><header><div><small>PRIVACY-SAFE EVENT STREAM</small><strong>Dòng hoạt động đã làm sạch</strong></div><span>Không có nội dung nhập</span></header><div>${timeline}</div></article><article class="hh-admin-risk-signals"><header><div><small>HEURISTIC ALERTS</small><strong>Tín hiệu cần kiểm tra</strong></div><span>Không tự động kết luận vi phạm</span></header><div>${risks}</div></article></section>`;
    panelRef.innerHTML = shell(content, "Behavior Center", "Quan sát hành trình theo thời gian thực, phát hiện tín hiệu bất thường và mở nhanh công cụ kiểm soát tài khoản.");
    activityTimer = setTimeout(() => { if (activeView === "activity") renderActivity({ silent: true }).catch(() => {}); }, 15000);
  }

  async function renderUsers(query = {}) {
    userQuery = { ...userQuery, ...query };
    panelRef.innerHTML = shell(loading("Đang tải danh sách người dùng..."), "Quản lý người dùng");
    const data = await api("users", { query: userQuery });
    const rows = (data.users || []).map((item) => `<tr><td><span class="hh-admin-user"><i>${item.avatar ? `<img src="${esc(item.avatar)}" alt="">` : esc((item.name || "HH").slice(0, 2).toUpperCase())}</i><span><strong>${esc(item.name || "Chưa đặt tên")}</strong><small>${esc(item.email)}</small></span></span></td><td><span class="hh-admin-status ${esc(item.status)}">${esc(item.status)}</span></td><td>${item.verified ? "Đã xác minh" : "Chưa xác minh"}</td><td>${esc(item.roles.join(", ") || "member")}</td><td>${dateText(item.lastLoginAt)}</td><td><button type="button" data-admin-user-open="${esc(item.id)}">Quản lý</button></td></tr>`).join("") || '<tr><td colspan="6">Không tìm thấy tài khoản phù hợp.</td></tr>';
    const content = `<form class="hh-admin-toolbar" data-admin-user-search><label><span>⌕</span><input name="q" value="${esc(userQuery.q || "")}" placeholder="Tìm tên hoặc email"></label><select name="status"><option value="all">Mọi trạng thái</option>${["active","locked","suspended","banned"].map((value) => `<option value="${value}" ${userQuery.status === value ? "selected" : ""}>${value}</option>`).join("")}</select><select name="role"><option value="all">Mọi vai trò</option>${["super_admin","admin","moderator","support","analyst"].map((value) => `<option value="${value}" ${userQuery.role === value ? "selected" : ""}>${value}</option>`).join("")}</select><button type="submit">Tìm kiếm</button></form><section class="hh-admin-table"><table><thead><tr><th>Tài khoản</th><th>Trạng thái</th><th>Xác minh</th><th>Vai trò</th><th>Hoạt động gần nhất</th><th></th></tr></thead><tbody>${rows}</tbody></table></section><footer class="hh-admin-pagination"><span>${Number(data.pagination?.total || 0).toLocaleString("vi-VN")} tài khoản</span><div><button type="button" data-admin-users-page="${Math.max(1, Number(data.pagination?.page || 1) - 1)}" ${Number(data.pagination?.page || 1) <= 1 ? "disabled" : ""}>Trước</button><b>${Number(data.pagination?.page || 1)}/${Number(data.pagination?.pages || 1)}</b><button type="button" data-admin-users-page="${Math.min(Number(data.pagination?.pages || 1), Number(data.pagination?.page || 1) + 1)}" ${Number(data.pagination?.page || 1) >= Number(data.pagination?.pages || 1) ? "disabled" : ""}>Sau</button></div></footer>`;
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
    const content = `${mode === "status" ? '<label><span>Trạng thái</span><select name="status"><option value="active">Hoạt động / mở khóa</option><option value="locked">Khóa</option><option value="suspended">Tạm đình chỉ</option><option value="banned">Cấm</option></select></label><label><span>Đình chỉ đến</span><input name="suspendedUntil" type="datetime-local"></label>' : ""}${mode === "verify" ? `<label><span>Trạng thái xác minh</span><select name="verified"><option value="true" ${currentVerified ? "" : "selected"}>Xác minh tài khoản</option><option value="false" ${currentVerified ? "selected" : ""}>Bỏ xác minh</option></select></label>` : ""}${mode === "roles" ? `<section class="hh-admin-role-picker">${["super_admin","admin","moderator","support","analyst"].map((role) => `<label><input name="roles" type="checkbox" value="${role}"><span>${role}</span></label>`).join("")}</section>` : ""}${mode === "features" ? `<label class="wide"><span>ID module cần giới hạn</span><textarea name="restrictedFeatures" maxlength="4000" placeholder="Ví dụ: ai-center, media-center, music-ai">${esc(currentFeatures.join("\n"))}</textarea><small>Mỗi dòng hoặc dấu phẩy là một ID module. Để trống để mở lại toàn bộ.</small></label>` : ""}<label class="wide"><span>Lý do bắt buộc</span><textarea name="reason" required minlength="5" maxlength="1000"></textarea></label>`;
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

  async function renderQueue(view) {
    panelRef.innerHTML = shell(loading(), view === "reports" ? "Quản lý báo cáo" : "Quản lý kháng nghị");
    const data = await api(view, { query: { status: "all" } });
    const rows = (data.items || []).map((item) => `<article><header><span><small>${esc(item.targetType || "Hồ sơ")}</small><strong>${esc(item.category || item.reason || "Yêu cầu kiểm duyệt")}</strong></span><b class="hh-admin-status ${esc(item.status || "pending")}">${esc(item.status || "pending")}</b></header><p>${esc(item.description || item.message || "Không có mô tả")}</p><footer><time>${dateText(item.createdAt)}</time>${["pending","escalated"].includes(item.status || "pending") ? `<button type="button" data-admin-resolve="${esc(item.id)}" data-kind="${view}">Xử lý</button>` : ""}</footer></article>`).join("") || '<p class="hh-admin-empty">Không có hồ sơ trong hàng đợi.</p>';
    panelRef.innerHTML = shell(`<section class="hh-admin-queue">${rows}</section>`, view === "reports" ? "Quản lý báo cáo" : "Quản lý kháng nghị", "Phân loại, xử lý và lưu lịch sử quyết định.");
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
    panelRef.innerHTML = shell(`${toolbar}<section class="hh-admin-content-list">${rows}</section>`, "Quản lý nội dung", "Giới hạn phân phối, gỡ hoặc khôi phục bằng soft delete và lưu đầy đủ lý do.");
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
    panelRef.innerHTML = shell(`<section class="hh-admin-table"><table><thead><tr><th>Hành động</th><th>Admin</th><th>Lý do</th><th>IP</th><th>Thời gian</th><th></th></tr></thead><tbody>${rows}</tbody></table></section>`, "Audit log", "Theo dõi admin, hành động, đối tượng, IP, user agent và dữ liệu trước/sau.");
  }

  function openAudit(id) {
    const item = auditEntries.find((entry) => String(entry.id) === String(id));
    if (!item) return;
    const pretty = (value) => esc(JSON.stringify(value ?? null, null, 2));
    const dialog = modal("Chi tiết audit log", `<section class="wide hh-admin-audit-detail"><div><span><small>Admin</small><strong>${esc(item.admin?.name || "Admin")}</strong><code>${esc(item.admin?.email || "")}</code></span><span><small>Vai trò</small><strong>${esc((item.roles || []).join(", "))}</strong></span><span><small>IP</small><strong>${esc(item.ip || "-")}</strong></span><span><small>Thời gian</small><strong>${dateText(item.createdAt)}</strong></span></div><p><b>${esc(item.action)}</b> · ${esc(item.targetType)} / ${esc(item.targetId)}</p><p>${esc(item.reason || "Không có lý do")}</p><label><span>User agent</span><code>${esc(item.userAgent || "-")}</code></label><section><article><strong>Trước thay đổi</strong><pre>${pretty(item.before)}</pre></article><article><strong>Sau thay đổi</strong><pre>${pretty(item.after)}</pre></article></section></section>`, "Đóng");
    dialog.querySelector("footer .primary")?.addEventListener("click", () => { dialog.close(); dialog.remove(); });
  }

  async function renderSettings() {
    panelRef.innerHTML = shell(loading(), "Cấu hình hệ thống");
    const data = await api("settings");
    featureFlags = data.flags || [];
    const flags = featureFlags.map((item) => `<article><span><strong>${esc(item.key)}</strong><small>${esc(item.description || "Feature flag")}</small></span><div><b class="${item.enabled ? "enabled" : ""}">${item.enabled ? "Bật" : "Tắt"} · ${Number(item.rollout || 0)}%</b><button type="button" data-admin-flag-toggle="${esc(item.key)}">${item.enabled ? "Tắt khẩn cấp" : "Bật lại"}</button></div></article>`).join("") || '<p class="hh-admin-empty">Chưa có feature flag.</p>';
    const keywords = (data.keywords || []).map((item) => `<span>${esc(item.value)} · ${esc(item.severity || "review")}</span>`).join("") || "Chưa có từ khóa";
    const content = `<section class="hh-admin-settings"><article><header><strong>Feature flags</strong><button type="button" data-admin-setting="flag">＋ Thêm</button></header><div>${flags}</div></article><article><header><strong>Từ khóa kiểm duyệt</strong><button type="button" data-admin-setting="keyword">＋ Thêm</button></header><p class="hh-admin-keywords">${keywords}</p></article>${has("templates.manage") ? '<article><header><strong>Email template</strong><button type="button" data-admin-setting="template">＋ Cập nhật</button></header><p>Mẫu email được quản lý theo khóa và có audit log.</p></article>' : ""}<article><header><strong>Cấu hình runtime</strong><div><button type="button" data-admin-setting="category">＋ Danh mục</button><button type="button" data-admin-setting="config">＋ Cấu hình</button></div></header><p>${Number(data.config?.length || 0)} cấu hình · ${Number(data.categories?.length || 0)} danh mục</p></article></section>`;
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

  async function render(view = activeView) {
    clearTimeout(activityTimer);
    activeView = view;
    if (view === "dashboard") return renderDashboard();
    if (view === "activity") return renderActivity();
    if (view === "users") return renderUsers();
    if (["reports", "appeals"].includes(view)) return renderQueue(view);
    if (view === "content") return renderContent();
    if (view === "audit") return renderAudit();
    if (view === "settings") return renderSettings();
  }

  async function discoverAccess() {
    const token = window.HHAuthSession?.token?.() || "";
    if (!token || !API_BASE) { access = null; accessToken = token; return null; }
    if (access && accessToken === token) return access;
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
    const currentAccess = await discoverAccess();
    if (!currentAccess) throw new Error("Tài khoản không có quyền truy cập Community Admin.");
    activeView = "dashboard";
    await renderDashboard();
  }

  document.addEventListener("click", async (event) => {
    if (!event.target.closest(".hh-admin-app, .hh-admin-modal")) return;
    const view = event.target.closest("[data-admin-view]"); if (view) { await render(view.dataset.adminView).catch((error) => notice(error.message, "error")); return; }
    const open = event.target.closest("[data-admin-user-open]"); if (open) { await openUser(open.dataset.adminUserOpen).catch((error) => notice(error.message, "error")); return; }
    const action = event.target.closest("[data-admin-user-action]"); if (action) { document.querySelector("[data-community-admin-modal]")?.remove(); userAction(action.dataset.userId, action.dataset.adminUserAction, action.dataset.userVerified === "true", String(action.dataset.userFeatures || "").split(",").filter(Boolean)); return; }
    const page = event.target.closest("[data-admin-users-page]"); if (page) { await renderUsers({ page: page.dataset.adminUsersPage }); return; }
    const resolve = event.target.closest("[data-admin-resolve]"); if (resolve) { resolveRecord(resolve.dataset.adminResolve, resolve.dataset.kind); return; }
    const content = event.target.closest("[data-admin-content-action]"); if (content) { moderateContent(content.dataset.contentId, content.dataset.contentType, content.dataset.adminContentAction); return; }
    const setting = event.target.closest("[data-admin-setting]"); if (setting) { updateSetting(setting.dataset.adminSetting); return; }
    const flag = event.target.closest("[data-admin-flag-toggle]"); if (flag) { toggleFlag(flag.dataset.adminFlagToggle); return; }
    const audit = event.target.closest("[data-admin-audit-open]"); if (audit) { openAudit(audit.dataset.adminAuditOpen); return; }
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

  const observer = new MutationObserver(ensureNav);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("storage", (event) => { if (event.key === "hh-auth-user") { access = null; ensureNav(); } });
  window.addEventListener("hh:auth-ready", () => { access = null; ensureNav(); });
  ensureNav();

  window.HHCommunityAdmin = Object.freeze({ mount, refresh: () => panelRef ? render(activeView) : Promise.resolve(), access: () => access });
})();
