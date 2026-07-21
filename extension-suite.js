(() => {
  "use strict";

  const IDS = [
    "modern-ui-kit", "i18n", "accessibility-center", "gamification", "onboarding-tour",
    "feedback-survey", "helpdesk-ticketing", "status-page", "feature-flag-dashboard",
    "cookie-consent-manager", "data-export-import", "referral-affiliate", "wishlist-compare",
    "team-collaboration", "form-builder", "workflow-automation"
  ];
  const STORE_KEY = "hh-extension-suite-v1";
  const DIRECTION_MIGRATION_KEY = "hh-layout-direction-v2";
  const API_BASE = window.HH_REALTIME_URL || "";
  const enc = encodeURIComponent;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const now = () => new Date().toISOString();
  const uid = (prefix = "item") => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const readAll = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); } catch { return {}; } };
  const writeAll = (value) => localStorage.setItem(STORE_KEY, JSON.stringify(value));
  const getState = (id, fallback = {}) => ({ ...fallback, ...(readAll()[id] || {}) });
  const setState = (id, next) => { const all = readAll(); all[id] = typeof next === "function" ? next(all[id] || {}) : next; writeAll(all); return all[id]; };
  const token = () => window.HHAuthSession?.token?.() || "";
  const currentUser = () => { try { return JSON.parse(localStorage.getItem("hh-auth-user") || "{}"); } catch { return {}; } };
  const download = (name, content, type = "application/json;charset=utf-8") => { const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(new Blob([content], { type })); anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(anchor.href), 1000); };
  const copy = async (value) => { await navigator.clipboard.writeText(String(value || "")); };
  const api = async (path, options = {}) => {
    if (!API_BASE) throw new Error("Backend Vercel chưa được cấu hình.");
    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method || "GET",
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  };
  const moduleApi = (id, options = {}) => api(`/api/modules/${enc(id)}/items${options.query || ""}`, options);
  const status = (root, message, kind = "") => { const node = root?.querySelector("[data-ext-status]"); if (node) { node.textContent = message; node.dataset.kind = kind; } };
  const rerender = (root) => { const id = root?.dataset.extensionSuite; const module = (window.HH_PLATFORM_MODULES || []).find((item) => item.id === id); if (root && module) root.outerHTML = workspace(module); };

  const frame = (module, body, stats = []) => `<section class="extension-workspace" data-extension-suite="${esc(module.id)}" style="--ext-accent:${esc(module.accent || "#5eead4")}">
    <header class="ext-hero"><div><span>MODULE ${String(module.order || IDS.indexOf(module.id) + 25).padStart(2, "0")}</span><h4>${esc(module.title)}</h4><p>${esc(module.description)}</p></div><div class="ext-health"><i></i><strong>Sẵn sàng</strong><small>${module.requiresBackend ? "MongoDB + Local" : "Trên thiết bị"}</small></div></header>
    ${stats.length ? `<div class="ext-stats">${stats.map(([value, label]) => `<article><strong>${esc(value)}</strong><span>${esc(label)}</span></article>`).join("")}</div>` : ""}
    <div class="ext-body">${body}</div><footer class="ext-footer"><span data-ext-status>Sẵn sàng thao tác.</span><small>Tự động lưu · ${new Date().toLocaleTimeString("vi-VN")}</small></footer></section>`;
  const panel = (title, content, extra = "") => `<section class="ext-panel ${extra}"><header><div><span>WORKSPACE</span><h5>${esc(title)}</h5></div></header>${content}</section>`;
  const button = (label, action, extra = "") => `<button class="ext-button ${extra}" type="button" data-ext-action="${action}">${label}</button>`;

  const defaults = {
    "modern-ui-kit": { accent: "#54e6df", glass: 12, density: "comfortable", motion: true, theme: "dark" },
    i18n: { locale: "vi", rtl: false, history: [] },
    "accessibility-center": { font: 100, contrast: false, reduceMotion: false, underline: false, focus: true },
    gamification: { xp: 120, streak: 1, claimed: {}, badges: ["Người mới"], lastVisit: "" },
    "onboarding-tour": { completed: false, step: 0 },
    "feedback-survey": { responses: [] },
    "helpdesk-ticketing": { tickets: [], filter: "all" },
    "status-page": { checks: [], incidents: [], maintenance: [] },
    "feature-flag-dashboard": { flags: { neon: true, music: true, communityV2: true, compact: false, advanced: true }, rollout: 100, disabledModules: [] },
    "cookie-consent-manager": { necessary: true, functional: true, analytics: false, personalization: true, marketing: false, notifications: false, updatedAt: "" },
    "data-export-import": { snapshots: [], pendingImport: null },
    "referral-affiliate": { code: "", clicks: 0, leads: 0, campaigns: [] },
    "wishlist-compare": { wishlist: ["voice-lite"], compare: ["voice-lite", "voice-full"] },
    "team-collaboration": { tasks: [], members: [], activity: [] },
    "form-builder": { title: "Đăng ký nhận thông tin", fields: [{ id: "name", label: "Họ tên", type: "text", required: true }, { id: "email", label: "Email", type: "email", required: true }], responses: [] },
    "workflow-automation": { workflows: [], runs: [] }
  };

  const uiMarkup = (module) => { const state = getState(module.id, defaults[module.id]); return frame(module,
    panel("Điều khiển giao diện", `<div class="ext-form-grid"><label>Chế độ<select data-ext-field="theme"><option value="dark" ${state.theme === "dark" ? "selected" : ""}>Tối</option><option value="light" ${state.theme === "light" ? "selected" : ""}>Sáng</option><option value="system" ${state.theme === "system" ? "selected" : ""}>Theo hệ thống</option></select></label><label>Màu nhấn<input type="color" data-ext-field="accent" value="${esc(state.accent)}"></label><label>Độ mờ kính <b data-ext-range-value>${state.glass}px</b><input type="range" min="0" max="28" value="${state.glass}" data-ext-field="glass"></label><label>Mật độ<select data-ext-field="density"><option value="comfortable" ${state.density === "comfortable" ? "selected" : ""}>Thoải mái</option><option value="compact" ${state.density === "compact" ? "selected" : ""}>Gọn</option></select></label></div><label class="ext-switch"><input type="checkbox" data-ext-field="motion" ${state.motion ? "checked" : ""}><span>Hiệu ứng chuyển động</span></label><div class="ext-actions">${button("Áp dụng", "ui-apply", "primary")}${button("Mở Command Palette", "ui-palette")}${button("Khôi phục", "ui-reset")}</div>`),
    [[state.theme.toUpperCase(), "Theme"], [`${state.glass}px`, "Glass blur"], [state.motion ? "ON" : "OFF", "Motion"]]); };

  const i18nMarkup = (module) => { const state = getState(module.id, defaults[module.id]); return frame(module,
    `<div class="ext-two-col">${panel("Ngôn ngữ hệ thống", `<div class="ext-segments">${[["vi", "Tiếng Việt"], ["en", "English"], ["ja", "日本語"]].map(([id, label]) => `<button type="button" class="${state.locale === id ? "active" : ""}" data-ext-locale="${id}">${label}</button>`).join("")}</div><label class="ext-switch"><input type="checkbox" data-ext-field="rtl" ${state.rtl ? "checked" : ""}><span>Bố cục RTL</span></label><div class="ext-locale-sample"><strong>${new Intl.DateTimeFormat(state.locale).format(new Date())}</strong><span>${new Intl.NumberFormat(state.locale).format(1234567.89)}</span></div>${button("Áp dụng toàn hệ thống", "locale-apply", "primary")}`)}${panel("Dịch nhanh trên thiết bị", `<label>Văn bản<textarea rows="5" data-ext-translate-input placeholder="Nhập một cụm từ giao diện..."></textarea></label><div class="ext-actions"><select data-ext-translate-target><option value="en">Sang English</option><option value="vi">Sang Tiếng Việt</option></select>${button("Dịch", "locale-translate", "primary")}</div><output class="ext-output" data-ext-translate-output>Chưa có nội dung.</output>`)}</div>`,
    [[state.locale.toUpperCase(), "Ngôn ngữ"], [state.rtl ? "RTL" : "LTR", "Hướng chữ"], [String(state.history?.length || 0), "Lịch sử"]]); };

  const accessibilityMarkup = (module) => { const state = getState(module.id, defaults[module.id]); const options = [["contrast", "Tương phản cao"], ["reduceMotion", "Giảm chuyển động"], ["underline", "Gạch chân liên kết"], ["focus", "Viền focus bàn phím"]]; return frame(module,
    `<div class="ext-two-col">${panel("Cài đặt trợ năng", `<label>Cỡ chữ <b>${state.font}%</b><input type="range" min="85" max="140" step="5" value="${state.font}" data-ext-field="font"></label><div class="ext-toggle-list">${options.map(([id, label]) => `<label class="ext-switch"><input type="checkbox" data-ext-field="${id}" ${state[id] ? "checked" : ""}><span>${label}</span></label>`).join("")}</div><div class="ext-actions">${button("Áp dụng", "access-apply", "primary")}${button("Đọc thử", "access-speak")}${button("Đặt lại", "access-reset")}</div>`)}${panel("Kiểm tra trực tiếp", `<div class="ext-access-preview" tabindex="0"><span>ACCESSIBILITY PREVIEW</span><h5>Nội dung rõ ràng và dễ sử dụng</h5><p>Dùng phím Tab để kiểm tra thứ tự focus. Mọi điều khiển đều có nhãn và trạng thái dễ nhận biết.</p><a href="#/learn/accessibility-center">Liên kết mẫu</a><button type="button">Nút mẫu</button></div>`)}</div>`,
    [[`${state.font}%`, "Cỡ chữ"], [state.contrast ? "ON" : "OFF", "Tương phản"], [state.reduceMotion ? "ON" : "OFF", "Giảm motion"]]); };

  const quests = [{ id: "visit", label: "Mở trang hôm nay", xp: 20 }, { id: "profile", label: "Cập nhật hồ sơ", xp: 30 }, { id: "community", label: "Khám phá cộng đồng", xp: 25 }, { id: "tool", label: "Sử dụng một module", xp: 15 }];
  const gamificationMarkup = (module) => { const state = getState(module.id, defaults[module.id]); const level = Math.floor(state.xp / 200) + 1; return frame(module,
    `<div class="ext-two-col">${panel("Tiến trình của bạn", `<div class="ext-level"><strong>LV ${level}</strong><div><span>${state.xp % 200}/200 XP đến cấp tiếp theo</span><i style="--value:${(state.xp % 200) / 2}%"></i></div></div><div class="ext-badges">${(state.badges || []).map((item) => `<span>◆ ${esc(item)}</span>`).join("")}</div>`)}${panel("Nhiệm vụ hôm nay", `<div class="ext-quest-list">${quests.map((quest) => `<article><div><strong>${esc(quest.label)}</strong><span>+${quest.xp} XP</span></div><button type="button" data-ext-quest="${quest.id}" ${state.claimed?.[quest.id] === new Date().toDateString() ? "disabled" : ""}>${state.claimed?.[quest.id] === new Date().toDateString() ? "Đã nhận" : "Nhận XP"}</button></article>`).join("")}</div>`)}</div>${panel("Bảng xếp hạng", `<div class="ext-ranking">${[[currentUser().name || "Bạn", state.xp], ["HH Creator", 720], ["Neon Member", 540], ["AI Explorer", 360]].sort((a, b) => b[1] - a[1]).map(([name, xp], index) => `<p><b>${index + 1}</b><span>${esc(name)}</span><strong>${xp} XP</strong></p>`).join("")}</div>`)}`,
    [[String(state.xp), "Tổng XP"], [String(level), "Cấp độ"], [`${state.streak} ngày`, "Streak"]]); };

  const onboardingMarkup = (module) => { const state = getState(module.id, defaults[module.id]); return frame(module,
    `<div class="ext-two-col">${panel("Tour dành cho người mới", `<div class="ext-tour-card"><span>${state.completed ? "HOÀN THÀNH" : "SẴN SÀNG"}</span><h5>Khám phá HH Platform trong 6 bước</h5><p>Đi qua sidebar, tìm kiếm, workspace, profile, Community và cài đặt dữ liệu.</p><div class="ext-actions">${button(state.completed ? "Xem lại tour" : "Bắt đầu tour", "tour-start", "primary")}${button("Đánh dấu hoàn tất", "tour-complete")}</div></div>`)}${panel("Checklist khởi động", `<ol class="ext-checklist"><li class="done">Đăng nhập tài khoản</li><li class="${state.completed ? "done" : ""}">Làm quen điều hướng</li><li>Chọn công cụ yêu thích</li><li>Hoàn thiện hồ sơ</li><li>Tham gia Community</li></ol>`)}</div>`,
    [[state.completed ? "100%" : `${Math.round((state.step || 0) / 6 * 100)}%`, "Tiến độ"], ["06", "Bước"], [state.completed ? "DONE" : "NEW", "Trạng thái"]]); };

  const feedbackMarkup = (module) => { const state = getState(module.id, defaults[module.id]); const score = state.responses?.length ? (state.responses.reduce((sum, item) => sum + Number(item.score), 0) / state.responses.length).toFixed(1) : "--"; return frame(module,
    `<div class="ext-two-col">${panel("Gửi đánh giá", `<div class="ext-nps" role="group" aria-label="Điểm NPS">${Array.from({ length: 11 }, (_, index) => `<button type="button" data-ext-nps="${index}">${index}</button>`).join("")}</div><div class="ext-form-grid"><label>Chủ đề<select data-feedback-category><option>Giao diện</option><option>Chức năng</option><option>Hiệu năng</option><option>Hỗ trợ</option></select></label><label class="ext-switch"><input type="checkbox" data-feedback-anonymous><span>Gửi ẩn danh</span></label></div><label>Nội dung<textarea rows="5" data-feedback-message placeholder="Điều gì đang tốt và điều gì cần cải thiện?"></textarea></label>${button("Gửi phản hồi", "feedback-submit", "primary")}`)}${panel("Phản hồi gần đây", `<div class="ext-feed">${(state.responses || []).slice(0, 6).map((item) => `<article><strong>${item.score}/10 · ${esc(item.category)}</strong><p>${esc(item.message)}</p><small>${new Date(item.createdAt).toLocaleString("vi-VN")}</small></article>`).join("") || "<p>Chưa có phản hồi trên thiết bị này.</p>"}</div>`)}</div>`,
    [[String(state.responses?.length || 0), "Phản hồi"], [score, "Điểm TB"], ["NPS", "Thang đo"]]); };

  const ticketMarkup = (module) => { const state = getState(module.id, defaults[module.id]); const tickets = state.tickets || []; return frame(module,
    `<div class="ext-two-col">${panel("Tạo yêu cầu hỗ trợ", `<label>Tiêu đề<input data-ticket-subject placeholder="Ví dụ: Không tải được HH Voice Studio"></label><div class="ext-form-grid"><label>Mức độ<select data-ticket-priority><option value="normal">Bình thường</option><option value="high">Cao</option><option value="urgent">Khẩn cấp</option></select></label><label>Email liên hệ<input type="email" data-ticket-email value="${esc(currentUser().email || "")}"></label></div><label>Mô tả<textarea rows="5" data-ticket-message placeholder="Mô tả lỗi, thiết bị và bước gây lỗi..."></textarea></label><div class="ext-actions">${button("Gửi ticket", "ticket-submit", "primary")}${button("Tải lại", "ticket-refresh")}</div>`)}${panel("Ticket của bạn", `<div class="ext-filter-row">${["all", "open", "pending", "closed"].map((value) => `<button type="button" data-ticket-filter="${value}" class="${state.filter === value ? "active" : ""}">${value === "all" ? "Tất cả" : value}</button>`).join("")}</div><div class="ext-ticket-list" data-ticket-list>${tickets.filter((item) => state.filter === "all" || item.status === state.filter).map((item) => ticketRow(item)).join("") || "<p>Chưa có ticket.</p>"}</div>`)}</div>`,
    [[String(tickets.filter((item) => item.status === "open").length), "Đang mở"], [String(tickets.filter((item) => item.status === "pending").length), "Đang xử lý"], [String(tickets.filter((item) => item.status === "closed").length), "Đã đóng"]]); };
  const ticketRow = (item) => `<article><div><strong>${esc(item.subject)}</strong><span>${esc(item.priority || "normal")} · ${new Date(item.createdAt).toLocaleString("vi-VN")}</span></div><b data-status="${esc(item.status)}">${esc(item.status)}</b>${item.status !== "closed" ? `<button type="button" data-ticket-close="${esc(item._id || item.id)}">Đóng</button>` : ""}</article>`;

  const statusMarkup = (module) => { const state = getState(module.id, defaults[module.id]); const latest = state.checks?.at(0); return frame(module,
    `${panel("Dịch vụ trực tiếp", `<div class="ext-service-grid" data-status-services>${["Website GitHub Pages", "API Vercel", "MongoDB Community"].map((name, index) => `<article><i class="${latest?.services?.[index]?.ok ? "online" : ""}"></i><div><strong>${name}</strong><span>${latest ? `${latest.services?.[index]?.latency || 0} ms` : "Chưa kiểm tra"}</span></div><b>${latest ? (latest.services?.[index]?.ok ? "Hoạt động" : "Gián đoạn") : "Chờ"}</b></article>`).join("")}</div><div class="ext-actions">${button("Kiểm tra ngay", "status-check", "primary")}${button("Xuất báo cáo", "status-export")}</div>`)}<div class="ext-two-col">${panel("Thông báo sự cố", `<label>Tiêu đề<input data-incident-title placeholder="Mô tả sự cố hoặc bảo trì"></label><label>Loại<select data-incident-type><option value="incident">Sự cố</option><option value="maintenance">Bảo trì</option></select></label>${button("Đăng thông báo", "incident-add")}`)}${panel("Lịch sử", `<div class="ext-feed">${[...(state.incidents || []), ...(state.maintenance || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8).map((item) => `<article><strong>${esc(item.title)}</strong><p>${item.type === "maintenance" ? "Bảo trì theo kế hoạch" : "Đang theo dõi sự cố"}</p><small>${new Date(item.createdAt).toLocaleString("vi-VN")}</small></article>`).join("") || "<p>Không có sự cố đang hoạt động.</p>"}</div>`)}</div>`,
    [[latest ? `${latest.uptime}%` : "--", "Uptime phiên"], [latest ? `${latest.average} ms` : "--", "Phản hồi TB"], [String(state.incidents?.length || 0), "Sự cố"]]); };

  const flagDefinitions = [["neon", "Neon nâng cao"], ["music", "Nhạc nền"], ["communityV2", "Community V2"], ["compact", "Card gọn"], ["advanced", "Công cụ nâng cao"]];
  const flagsMarkup = (module) => { const state = getState(module.id, defaults[module.id]); const modules = (window.HH_PLATFORM_MODULES || []).filter((item) => !IDS.includes(item.id)); return frame(module,
    `<div class="ext-two-col">${panel("Runtime flags", `<div class="ext-flag-list">${flagDefinitions.map(([id, label]) => `<label><span><strong>${label}</strong><small>${id}</small></span><input type="checkbox" data-feature-flag="${id}" ${state.flags?.[id] ? "checked" : ""}></label>`).join("")}</div><label>Tỷ lệ rollout <b>${state.rollout}%</b><input type="range" min="0" max="100" step="5" value="${state.rollout}" data-ext-field="rollout"></label>${button("Áp dụng flags", "flags-apply", "primary")}`)}${panel("Bật/tắt module", `<label>Chọn module<select data-module-toggle-select>${modules.map((item) => `<option value="${item.id}">${esc(item.title)}</option>`).join("")}</select></label><div class="ext-actions">${button("Đổi trạng thái", "module-toggle")}${button("Bật lại tất cả", "module-enable-all")}</div><div class="ext-disabled-list">${(state.disabledModules || []).map((id) => `<span>${esc((modules.find((item) => item.id === id) || {}).title || id)}</span>`).join("") || "<p>Không có module bị tắt.</p>"}</div>`)}</div>`,
    [[String(Object.values(state.flags || {}).filter(Boolean).length), "Flags ON"], [`${state.rollout}%`, "Rollout"], [String(state.disabledModules?.length || 0), "Module OFF"]]); };

  const consentMarkup = (module) => { const state = getState(module.id, defaults[module.id]); const rows = [["necessary", "Cần thiết", "Đăng nhập, bảo mật và điều hướng"], ["functional", "Chức năng", "Ghi nhớ cài đặt và nội dung"], ["analytics", "Phân tích", "Đếm lượt sử dụng ẩn danh"], ["personalization", "Cá nhân hóa", "Gợi ý module phù hợp"], ["marketing", "Tiếp thị", "Chiến dịch và referral"], ["notifications", "Thông báo", "Push notification từ trình duyệt"]]; return frame(module,
    `<div class="ext-two-col">${panel("Quyền riêng tư", `<div class="ext-consent-list">${rows.map(([id, label, desc]) => `<label><span><strong>${label}</strong><small>${desc}</small></span><input type="checkbox" data-consent="${id}" ${state[id] ? "checked" : ""} ${id === "necessary" ? "disabled" : ""}></label>`).join("")}</div><div class="ext-actions">${button("Lưu lựa chọn", "consent-save", "primary")}${button("Chỉ cần thiết", "consent-minimal")}</div>`)}${panel("Biên nhận đồng ý", `<div class="ext-receipt"><span>Lần cập nhật</span><strong>${state.updatedAt ? new Date(state.updatedAt).toLocaleString("vi-VN") : "Chưa lưu"}</strong><p>Mọi lựa chọn được lưu trên thiết bị và có thể thay đổi bất kỳ lúc nào.</p></div><div class="ext-actions">${button("Xuất biên nhận", "consent-export")}${button("Dọn dữ liệu tùy chọn", "consent-clear")}</div>`)}</div>`,
    [[String(rows.filter(([id]) => state[id]).length), "Đã cho phép"], [state.analytics ? "ON" : "OFF", "Analytics"], [state.marketing ? "ON" : "OFF", "Marketing"]]); };

  const backupMarkup = (module) => { const state = getState(module.id, defaults[module.id]); const size = (JSON.stringify(localStorage).length / 1024).toFixed(1); return frame(module,
    `<div class="ext-two-col">${panel("Tạo bản sao lưu", `<div class="ext-category-list">${[["profile", "Hồ sơ"], ["modules", "Dữ liệu module"], ["community", "Community"], ["settings", "Cài đặt"], ["all", "Toàn bộ localStorage"]].map(([id, label], index) => `<label><input type="checkbox" data-backup-category="${id}" ${index === 4 ? "checked" : ""}><span>${label}</span></label>`).join("")}</div><div class="ext-actions">${button("Tải JSON", "backup-export", "primary")}${button("Tạo snapshot", "backup-snapshot")}</div>`)}${panel("Nhập và khôi phục", `<label class="ext-file-picker"><input type="file" accept="application/json,.json" data-backup-file><span>Chọn tệp backup từ thiết bị</span></label><output class="ext-output" data-backup-preview>${state.pendingImport ? `${Object.keys(state.pendingImport).length} khóa sẵn sàng khôi phục` : "Chưa chọn tệp."}</output><div class="ext-actions">${button("Khôi phục dữ liệu", "backup-restore", "primary")}${button("Hủy bản nhập", "backup-cancel")}</div>`)}</div>${panel("Snapshot gần đây", `<div class="ext-snapshot-list">${(state.snapshots || []).slice(0, 5).map((item) => `<article><div><strong>${new Date(item.createdAt).toLocaleString("vi-VN")}</strong><span>${item.keys} khóa · ${item.size} KB</span></div><button type="button" data-snapshot-download="${item.id}">Tải</button></article>`).join("") || "<p>Chưa có snapshot.</p>"}</div>`)}`,
    [[`${size} KB`, "Dung lượng"], [String(Object.keys(localStorage).length), "Khóa dữ liệu"], [String(state.snapshots?.length || 0), "Snapshot"]]); };

  const referralMarkup = (module) => { const state = ensureReferralState(); const link = `${location.origin}${location.pathname}?ref=${enc(state.code)}#/home`; return frame(module,
    `<div class="ext-two-col">${panel("Liên kết giới thiệu", `<div class="ext-referral-code"><span>Mã của bạn</span><strong>${esc(state.code)}</strong></div><label>Liên kết<input readonly value="${esc(link)}" data-referral-link></label><div class="ext-actions">${button("Sao chép", "referral-copy", "primary")}${button("Chia sẻ", "referral-share")}${button("Tạo mã mới", "referral-regenerate")}</div>`)}${panel("Tạo chiến dịch", `<label>Tên chiến dịch<input data-campaign-name placeholder="Ví dụ: Chia sẻ HH Voice Studio"></label><label>Hoa hồng dự kiến (%)<input type="number" min="0" max="50" value="10" data-campaign-rate></label>${button("Tạo chiến dịch", "campaign-add", "primary")}<div class="ext-campaign-list">${(state.campaigns || []).map((item) => `<article><strong>${esc(item.name)}</strong><span>${item.rate}% · ${item.clicks || 0} click</span></article>`).join("") || "<p>Chưa có chiến dịch.</p>"}</div>`)}</div>`,
    [[String(state.clicks || 0), "Lượt click"], [String(state.leads || 0), "Đăng ký"], [`${((state.leads || 0) * 15000).toLocaleString("vi-VN")}đ`, "Ước tính"]]); };

  const products = [
    { id: "voice-lite", name: "HH Voice Studio Lite", price: 0, platform: "Windows", version: "3.1", features: ["Text/SRT", "Voice trình duyệt", "Portable"] },
    { id: "voice-full", name: "HH Voice Studio Full", price: 149000, platform: "Windows", version: "Full", features: ["Batch", "Humanize", "Nhiều voice"] },
    { id: "script-ai", name: "Kịch bản AI", price: 0, platform: "Web", version: "2026", features: ["Rewrite", "Gemini prompt", "Series"] },
    { id: "piano", name: "HuyHoang Piano", price: 0, platform: "Web/Windows", version: "Neon", features: ["Piano", "Effects", "Recording"] }
  ];
  const wishlistMarkup = (module) => { const state = getState(module.id, defaults[module.id]); const selected = products.filter((item) => state.compare?.includes(item.id)); return frame(module,
    `${panel("Sản phẩm và công cụ", `<div class="ext-product-grid">${products.map((item) => `<article><span>${item.platform}</span><h5>${item.name}</h5><p>${item.features.join(" · ")}</p><strong>${item.price ? `${item.price.toLocaleString("vi-VN")}đ` : "Miễn phí"}</strong><footer><button type="button" data-wishlist="${item.id}">${state.wishlist?.includes(item.id) ? "♥ Đã lưu" : "♡ Lưu"}</button><label><input type="checkbox" data-compare="${item.id}" ${state.compare?.includes(item.id) ? "checked" : ""}> So sánh</label></footer></article>`).join("")}</div>`)}${panel("Bảng so sánh", selected.length ? `<div class="ext-compare-table"><div><b>Tiêu chí</b>${selected.map((item) => `<strong>${item.name}</strong>`).join("")}</div>${[["Giá", ...selected.map((item) => item.price ? `${item.price.toLocaleString("vi-VN")}đ` : "Miễn phí")], ["Nền tảng", ...selected.map((item) => item.platform)], ["Phiên bản", ...selected.map((item) => item.version)], ["Tính năng", ...selected.map((item) => item.features.join(", "))]].map((row) => `<div>${row.map((cell) => `<span>${esc(cell)}</span>`).join("")}</div>`).join("")}</div>` : "<p>Chọn tối đa 3 sản phẩm để so sánh.</p>")}`,
    [[String(state.wishlist?.length || 0), "Wishlist"], [String(state.compare?.length || 0), "Đang so sánh"], [String(products.length), "Sản phẩm"]]); };

  const taskCard = (item) => `<article class="ext-task" data-task-id="${esc(item.id || item._id)}"><span>${esc(item.priority || "normal")}</span><strong>${esc(item.title)}</strong><p>${esc(item.assignee || "Chưa phân công")}</p><footer><button type="button" data-task-move="back">←</button><button type="button" data-task-comment>＋ Bình luận</button><button type="button" data-task-move="next">→</button></footer>${item.comment ? `<small>${esc(item.comment)}</small>` : ""}</article>`;
  const teamMarkup = (module) => { const state = getState(module.id, defaults[module.id]); const tasks = state.tasks || []; return frame(module,
    `${panel("Tạo công việc nhóm", `<div class="ext-form-grid three"><label>Tên công việc<input data-team-title placeholder="Nhập việc cần hoàn thành"></label><label>Người phụ trách<input data-team-assignee placeholder="Tên hoặc email"></label><label>Ưu tiên<select data-team-priority><option>normal</option><option>high</option><option>urgent</option></select></label></div><div class="ext-actions">${button("Thêm vào bảng", "team-add", "primary")}${button("Đồng bộ", "team-sync")}${button("Xuất bảng", "team-export")}</div>`)}<div class="ext-kanban">${[["todo", "Cần làm"], ["doing", "Đang làm"], ["done", "Hoàn tất"]].map(([id, label]) => `<section><header><strong>${label}</strong><span>${tasks.filter((item) => item.status === id).length}</span></header><div>${tasks.filter((item) => item.status === id).map(taskCard).join("") || "<p>Chưa có việc</p>"}</div></section>`).join("")}</div>`,
    [[String(tasks.length), "Công việc"], [String(tasks.filter((item) => item.status === "done").length), "Hoàn tất"], [String(new Set(tasks.map((item) => item.assignee).filter(Boolean)).size), "Thành viên"]]); };

  const fieldRow = (field, index) => `<article data-form-field="${field.id}"><span>${index + 1}</span><input value="${esc(field.label)}" data-form-label><select data-form-type><option value="text" ${field.type === "text" ? "selected" : ""}>Text</option><option value="email" ${field.type === "email" ? "selected" : ""}>Email</option><option value="tel" ${field.type === "tel" ? "selected" : ""}>Điện thoại</option><option value="textarea" ${field.type === "textarea" ? "selected" : ""}>Nội dung dài</option><option value="rating" ${field.type === "rating" ? "selected" : ""}>Đánh giá</option></select><label><input type="checkbox" data-form-required ${field.required ? "checked" : ""}> Bắt buộc</label><button type="button" data-form-remove>×</button></article>`;
  const formPreview = (state) => `<form class="ext-generated-form" data-generated-form><h5>${esc(state.title)}</h5>${(state.fields || []).map((field) => `<label><span>${esc(field.label)}${field.required ? " *" : ""}</span>${field.type === "textarea" ? `<textarea name="${field.id}" ${field.required ? "required" : ""}></textarea>` : field.type === "rating" ? `<select name="${field.id}" ${field.required ? "required" : ""}><option value="">Chọn điểm</option>${[1, 2, 3, 4, 5].map((n) => `<option>${n}</option>`).join("")}</select>` : `<input type="${field.type}" name="${field.id}" ${field.required ? "required" : ""}>`}</label>`).join("")}<button class="ext-button primary" type="submit">Gửi biểu mẫu thử</button></form>`;
  const formBuilderMarkup = (module) => { const state = getState(module.id, defaults[module.id]); return frame(module,
    `<div class="ext-two-col wide-left">${panel("Thiết kế biểu mẫu", `<label>Tên biểu mẫu<input value="${esc(state.title)}" data-form-title></label><div class="ext-field-builder">${(state.fields || []).map(fieldRow).join("")}</div><div class="ext-actions">${button("Thêm trường", "form-add-field")}${button("Lưu thiết kế", "form-save", "primary")}${button("Xuất schema", "form-export")}</div>`)}${panel("Xem trước trực tiếp", formPreview(state))}</div>${panel("Phản hồi thử", `<div class="ext-response-list">${(state.responses || []).slice(0, 8).map((item, index) => `<article><strong>#${state.responses.length - index}</strong><pre>${esc(JSON.stringify(item.data, null, 2))}</pre><small>${new Date(item.createdAt).toLocaleString("vi-VN")}</small></article>`).join("") || "<p>Chưa có phản hồi thử.</p>"}</div><div class="ext-actions">${button("Xuất CSV", "form-export-csv")}${button("Xóa phản hồi", "form-clear-responses")}</div>`)}`,
    [[String(state.fields?.length || 0), "Trường"], [String(state.responses?.length || 0), "Phản hồi"], ["LIVE", "Preview"]]); };

  const workflowMarkup = (module) => { const state = getState(module.id, defaults[module.id]); return frame(module,
    `<div class="ext-two-col">${panel("Tạo workflow", `<label>Tên workflow<input data-workflow-name placeholder="Ví dụ: Xử lý feedback mới"></label><div class="ext-flow-builder"><label>WHEN<select data-workflow-trigger><option value="manual">Chạy thủ công</option><option value="login">Khi đăng nhập</option><option value="feedback">Khi có feedback</option><option value="daily">Mỗi ngày</option></select></label><span>→</span><label>IF<input data-workflow-condition placeholder="Từ khóa hoặc để trống"></label><span>→</span><label>THEN<select data-workflow-action><option value="notify">Tạo thông báo</option><option value="save">Lưu nhật ký</option><option value="xp">Cộng 10 XP</option><option value="export">Xuất tệp kết quả</option></select></label></div>${button("Lưu workflow", "workflow-add", "primary")}`)}${panel("Workflow đang hoạt động", `<div class="ext-workflow-list">${(state.workflows || []).map((item) => `<article data-workflow-id="${item.id}"><label><input type="checkbox" data-workflow-toggle ${item.enabled ? "checked" : ""}><span><strong>${esc(item.name)}</strong><small>${esc(item.trigger)} → ${esc(item.action)}</small></span></label><div><button type="button" data-workflow-run>Chạy</button><button type="button" data-workflow-delete>×</button></div></article>`).join("") || "<p>Chưa có workflow.</p>"}</div>`)}</div>${panel("Nhật ký chạy", `<div class="ext-run-log">${(state.runs || []).slice(0, 10).map((item) => `<p><i class="${item.ok ? "online" : ""}"></i><span>${esc(item.name)}<small>${esc(item.message)}</small></span><time>${new Date(item.createdAt).toLocaleTimeString("vi-VN")}</time></p>`).join("") || "<p>Chưa có lần chạy.</p>"}</div>`)}`,
    [[String(state.workflows?.length || 0), "Workflow"], [String(state.workflows?.filter((item) => item.enabled).length || 0), "Đang bật"], [String(state.runs?.length || 0), "Lần chạy"]]); };

  const renderers = {
    "modern-ui-kit": uiMarkup, i18n: i18nMarkup, "accessibility-center": accessibilityMarkup,
    gamification: gamificationMarkup, "onboarding-tour": onboardingMarkup, "feedback-survey": feedbackMarkup,
    "helpdesk-ticketing": ticketMarkup, "status-page": statusMarkup, "feature-flag-dashboard": flagsMarkup,
    "cookie-consent-manager": consentMarkup, "data-export-import": backupMarkup, "referral-affiliate": referralMarkup,
    "wishlist-compare": wishlistMarkup, "team-collaboration": teamMarkup, "form-builder": formBuilderMarkup,
    "workflow-automation": workflowMarkup
  };
  const workspace = (module) => renderers[module.id]?.(module) || "";

  function applyUi(state = getState("modern-ui-kit", defaults["modern-ui-kit"])) {
    document.documentElement.style.setProperty("--accent", state.accent);
    document.documentElement.style.setProperty("--ext-glass", `${state.glass}px`);
    document.body.classList.toggle("ext-light-theme", state.theme === "light" || (state.theme === "system" && matchMedia("(prefers-color-scheme: light)").matches));
    document.body.classList.toggle("ext-compact-density", state.density === "compact");
    document.body.classList.toggle("ext-reduced-motion", !state.motion);
  }
  function applyAccessibility(state = getState("accessibility-center", defaults["accessibility-center"])) {
    document.documentElement.style.setProperty("--ext-root-font-size", `${16 * state.font / 100}px`);
    document.body.classList.toggle("ext-high-contrast", state.contrast);
    document.body.classList.toggle("ext-reduced-motion", state.reduceMotion || !getState("modern-ui-kit", defaults["modern-ui-kit"]).motion);
    document.body.classList.toggle("ext-underline-links", state.underline);
    document.body.classList.toggle("ext-focus-visible", state.focus);
  }
  function applyFlags(state = getState("feature-flag-dashboard", defaults["feature-flag-dashboard"])) {
    Object.entries(state.flags || {}).forEach(([id, enabled]) => document.body.classList.toggle(`feature-${id}`, Boolean(enabled)));
    localStorage.setItem("hh-disabled-modules", JSON.stringify(state.disabledModules || []));
    document.querySelectorAll("#moduleGrid [data-module-id]").forEach((card) => { card.classList.toggle("ext-module-disabled", state.disabledModules?.includes(card.dataset.moduleId)); });
  }
  function applyLocale(state = getState("i18n", defaults.i18n)) {
    if (localStorage.getItem(DIRECTION_MIGRATION_KEY) !== "2") {
      state = { ...state, rtl: false };
      setState("i18n", state);
      localStorage.setItem(DIRECTION_MIGRATION_KEY, "2");
    }
    document.documentElement.lang = state.locale;
    document.documentElement.dir = state.rtl ? "rtl" : "ltr";
    const dictionary = { en: { "Trang chủ": "Home", "Sáng tạo": "Create", "Công việc": "Work", "Giao tiếp": "Communication", "Phân tích": "Analytics", "Học tập": "Learning", "Hệ thống": "System", "Yêu thích": "Favorites", "Gần đây": "Recent", "Cài đặt": "Settings" }, vi: {} };
    document.querySelectorAll(".app-sidebar__item b,.app-header button,.app-page-header button").forEach((node) => {
      const label = node.children.length ? node.querySelector("[data-i18n-text]") : node;
      if (!label) return;
      if (!label.dataset.viText) label.dataset.viText = label.textContent.trim();
      label.textContent = dictionary[state.locale]?.[label.dataset.viText] || label.dataset.viText;
    });
  }
  function ensureReferralState() {
    const state = getState("referral-affiliate", defaults["referral-affiliate"]);
    if (!state.code) { const source = currentUser().email || currentUser().name || crypto.randomUUID(); state.code = `HH${Array.from(new TextEncoder().encode(source)).reduce((sum, item) => (sum * 31 + item) >>> 0, 7).toString(36).toUpperCase().slice(0, 8)}`; setState("referral-affiliate", state); }
    return state;
  }
  const translateLocal = (text, target) => {
    const pairs = { "trang chủ": "home", "cài đặt": "settings", "đăng nhập": "sign in", "đăng ký": "create account", "cộng đồng": "community", "tìm kiếm": "search", "yêu thích": "favorites", "tải xuống": "download", "hỗ trợ": "support", "home": "trang chủ", "settings": "cài đặt", "sign in": "đăng nhập", "create account": "đăng ký", "community": "cộng đồng", "search": "tìm kiếm", "favorites": "yêu thích", "download": "tải xuống", "support": "hỗ trợ" };
    const normalized = text.trim().toLowerCase();
    return pairs[normalized] || (target === "en" ? `[Local EN] ${text}` : `[Dịch cục bộ] ${text}`);
  };

  const fieldValue = (root, selector) => root.querySelector(selector)?.value?.trim() || "";
  const saveFields = (root, id, names) => setState(id, (previous) => { const next = { ...defaults[id], ...previous }; names.forEach((name) => { const node = root.querySelector(`[data-ext-field="${name}"]`); if (node) next[name] = node.type === "checkbox" ? node.checked : node.type === "range" ? Number(node.value) : node.value; }); return next; });

  async function handleAction(root, action, target) {
    const id = root.dataset.extensionSuite;
    if (action === "ui-apply") { applyUi(saveFields(root, id, ["theme", "accent", "glass", "density", "motion"])); status(root, "Đã áp dụng UI Kit toàn hệ thống.", "success"); }
    if (action === "ui-reset") { setState(id, defaults[id]); applyUi(defaults[id]); rerender(root); }
    if (action === "ui-palette") document.querySelector("[data-shell-command]")?.click();
    if (action === "locale-apply") { const state = saveFields(root, id, ["rtl"]); applyLocale(state); status(root, "Đã cập nhật ngôn ngữ và hướng giao diện.", "success"); }
    if (action === "locale-translate") { const input = fieldValue(root, "[data-ext-translate-input]"); const targetLocale = fieldValue(root, "[data-ext-translate-target]"); const output = translateLocal(input, targetLocale); root.querySelector("[data-ext-translate-output]").textContent = output; setState(id, (state) => ({ ...defaults[id], ...state, history: [{ input, output, createdAt: now() }, ...(state.history || [])].slice(0, 20) })); }
    if (action === "access-apply") { applyAccessibility(saveFields(root, id, ["font", "contrast", "reduceMotion", "underline", "focus"])); status(root, "Đã áp dụng cấu hình trợ năng.", "success"); }
    if (action === "access-reset") { setState(id, defaults[id]); applyAccessibility(defaults[id]); rerender(root); }
    if (action === "access-speak") { speechSynthesis.cancel(); const speech = new SpeechSynthesisUtterance("HH Platform đang kiểm tra chế độ đọc màn hình."); speech.lang = "vi-VN"; speechSynthesis.speak(speech); }
    if (action === "tour-start") startTour();
    if (action === "tour-complete") { setState(id, (state) => ({ ...defaults[id], ...state, completed: true, step: 6 })); rerender(root); }
    if (action === "feedback-submit") await submitFeedback(root);
    if (action === "ticket-submit") await submitTicket(root);
    if (action === "ticket-refresh") await loadTickets(root);
    if (action === "status-check") await checkServices(root);
    if (action === "status-export") download("hh-system-status.json", JSON.stringify(getState(id, defaults[id]), null, 2));
    if (action === "incident-add") { const title = fieldValue(root, "[data-incident-title]"); if (!title) return status(root, "Hãy nhập tiêu đề thông báo.", "error"); const type = fieldValue(root, "[data-incident-type]"); setState(id, (state) => ({ ...defaults[id], ...state, [type === "maintenance" ? "maintenance" : "incidents"]: [{ id: uid(type), title, type, createdAt: now() }, ...(state[type === "maintenance" ? "maintenance" : "incidents"] || [])] })); rerender(root); }
    if (action === "flags-apply") { const state = getState(id, defaults[id]); state.flags = Object.fromEntries([...root.querySelectorAll("[data-feature-flag]")].map((node) => [node.dataset.featureFlag, node.checked])); state.rollout = Number(root.querySelector('[data-ext-field="rollout"]')?.value || 100); setState(id, state); applyFlags(state); status(root, "Feature flags đã có hiệu lực.", "success"); }
    if (action === "module-toggle") { const moduleId = fieldValue(root, "[data-module-toggle-select]"); setState(id, (state) => { const disabled = state.disabledModules || []; return { ...defaults[id], ...state, disabledModules: disabled.includes(moduleId) ? disabled.filter((item) => item !== moduleId) : [...disabled, moduleId] }; }); applyFlags(); rerender(root); }
    if (action === "module-enable-all") { setState(id, (state) => ({ ...defaults[id], ...state, disabledModules: [] })); applyFlags(); rerender(root); }
    if (action === "consent-save") saveConsent(root);
    if (action === "consent-minimal") { setState(id, { ...defaults[id], functional: false, personalization: false, updatedAt: now() }); localStorage.setItem("hh-tracking-consent", "no"); rerender(root); }
    if (action === "consent-export") download("hh-consent-receipt.json", JSON.stringify({ user: currentUser().email || "anonymous", consent: getState(id, defaults[id]) }, null, 2));
    if (action === "consent-clear") { ["hh-feature-lab", "hh-platform-favorites", "hh-referral-visit"].forEach((key) => localStorage.removeItem(key)); status(root, "Đã dọn dữ liệu tùy chọn; tài khoản và nội dung vẫn được giữ.", "success"); }
    if (action === "backup-export") exportBackup(root);
    if (action === "backup-snapshot") createSnapshot(root);
    if (action === "backup-restore") restoreBackup(root);
    if (action === "backup-cancel") { setState(id, (state) => ({ ...defaults[id], ...state, pendingImport: null })); rerender(root); }
    if (action === "referral-copy") { await copy(fieldValue(root, "[data-referral-link]")); status(root, "Đã sao chép liên kết giới thiệu.", "success"); }
    if (action === "referral-share") { const url = fieldValue(root, "[data-referral-link]"); if (navigator.share) await navigator.share({ title: "HH Platform", text: "Tham gia HH Platform cùng tôi", url }); else await copy(url); }
    if (action === "referral-regenerate") { setState(id, (state) => ({ ...defaults[id], ...state, code: `HH${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}` })); rerender(root); }
    if (action === "campaign-add") { const name = fieldValue(root, "[data-campaign-name]"); if (!name) return status(root, "Nhập tên chiến dịch.", "error"); const rate = Number(root.querySelector("[data-campaign-rate]")?.value || 0); setState(id, (state) => ({ ...defaults[id], ...state, campaigns: [{ id: uid("campaign"), name, rate, clicks: 0, createdAt: now() }, ...(state.campaigns || [])] })); rerender(root); }
    if (action === "team-add") await addTeamTask(root);
    if (action === "team-sync") await syncTeamTasks(root);
    if (action === "team-export") download("hh-team-board.json", JSON.stringify(getState(id, defaults[id]), null, 2));
    if (action === "form-add-field") { setState(id, (state) => ({ ...defaults[id], ...state, fields: [...(state.fields || []), { id: uid("field"), label: "Trường mới", type: "text", required: false }] })); rerender(root); }
    if (action === "form-save") { saveFormSchema(root); rerender(root); }
    if (action === "form-export") { saveFormSchema(root); download("hh-form-schema.json", JSON.stringify(getState(id, defaults[id]), null, 2)); }
    if (action === "form-export-csv") exportResponses(root);
    if (action === "form-clear-responses") { setState(id, (state) => ({ ...defaults[id], ...state, responses: [] })); rerender(root); }
    if (action === "workflow-add") addWorkflow(root);
  }

  async function submitFeedback(root) {
    const scoreNode = root.querySelector("[data-ext-nps].active");
    const message = fieldValue(root, "[data-feedback-message]");
    if (!scoreNode || !message) return status(root, "Chọn điểm và nhập nội dung phản hồi.", "error");
    const item = { id: uid("feedback"), score: Number(scoreNode.dataset.extNps), category: fieldValue(root, "[data-feedback-category]"), message, anonymous: root.querySelector("[data-feedback-anonymous]")?.checked, createdAt: now() };
    setState("feedback-survey", (state) => ({ ...defaults["feedback-survey"], ...state, responses: [item, ...(state.responses || [])].slice(0, 100) }));
    try { await moduleApi("feedback-survey", { method: "POST", body: { title: `${item.category}: ${item.score}/10`, type: "feedback", data: item } }); } catch {}
    runTriggeredWorkflows("feedback", `${item.category} ${item.message}`);
    rerender(root);
  }
  async function submitTicket(root) {
    const subject = fieldValue(root, "[data-ticket-subject]"); const message = fieldValue(root, "[data-ticket-message]");
    if (!subject || !message) return status(root, "Nhập tiêu đề và mô tả ticket.", "error");
    status(root, "Đang gửi ticket...");
    try { await api("/api/helpdesk/tickets", { method: "POST", body: { subject, message, email: fieldValue(root, "[data-ticket-email]"), priority: fieldValue(root, "[data-ticket-priority]") } }); await loadTickets(root); }
    catch (error) { status(root, error.message, "error"); }
  }
  async function loadTickets(root) {
    status(root, "Đang đồng bộ ticket...");
    try { const data = await api("/api/helpdesk/tickets"); setState("helpdesk-ticketing", (state) => ({ ...defaults["helpdesk-ticketing"], ...state, tickets: data.tickets || [] })); rerender(root); }
    catch (error) { status(root, error.message, "error"); }
  }
  async function checkServices(root) {
    status(root, "Đang đo phản hồi dịch vụ...");
    const endpoints = [location.origin, `${API_BASE}/api/auth/providers`, `${API_BASE}/api/community`];
    const services = await Promise.all(endpoints.map(async (url) => { const started = performance.now(); try { const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}health=${Date.now()}`, { cache: "no-store" }); return { ok: response.ok, latency: Math.round(performance.now() - started) }; } catch { return { ok: false, latency: Math.round(performance.now() - started) }; } }));
    const successful = services.filter((item) => item.ok); const latest = { createdAt: now(), services, uptime: Math.round(successful.length / services.length * 10000) / 100, average: successful.length ? Math.round(successful.reduce((sum, item) => sum + item.latency, 0) / successful.length) : 0 };
    setState("status-page", (state) => ({ ...defaults["status-page"], ...state, checks: [latest, ...(state.checks || [])].slice(0, 50) })); rerender(root);
  }
  function saveConsent(root) {
    const state = { ...defaults["cookie-consent-manager"], updatedAt: now() }; root.querySelectorAll("[data-consent]").forEach((node) => { state[node.dataset.consent] = node.checked; }); setState("cookie-consent-manager", state); localStorage.setItem("hh-tracking-consent", state.analytics ? "yes" : "no"); rerender(root);
  }
  const backupData = (excludeSuite = false) => Object.fromEntries(Object.keys(localStorage).filter((key) => !excludeSuite || key !== STORE_KEY).map((key) => [key, localStorage.getItem(key)]));
  function exportBackup(root) {
    const selected = [...root.querySelectorAll("[data-backup-category]:checked")].map((node) => node.dataset.backupCategory);
    const all = backupData();
    const groups = {
      profile: ["hh-auth-user", "hh-user-dashboard", "hh-chat-profile"],
      modules: ["hh-platform-module-state", "hh-extension-suite-v1", "hh-feature-engine-state", "hh-media-library"],
      community: ["hh-community-state", "hh-chat-", "hh-module-favorites"],
      settings: ["hh.app-shell", "hh-theme", "hh-color", "hh-tracking", "hh-music"]
    };
    const data = selected.includes("all") || !selected.length ? all : Object.fromEntries(Object.entries(all).filter(([key]) => selected.some((group) => (groups[group] || []).some((prefix) => key.startsWith(prefix)))));
    download(`hh-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2));
    status(root, `Đã xuất ${Object.keys(data).length} khóa dữ liệu.`, "success");
  }
  function createSnapshot(root) { const data = backupData(true); const raw = JSON.stringify(data); const item = { id: uid("snapshot"), createdAt: now(), keys: Object.keys(data).length, size: (raw.length / 1024).toFixed(1), data }; setState("data-export-import", (state) => ({ ...defaults["data-export-import"], ...state, snapshots: [item, ...(state.snapshots || [])].slice(0, 5) })); rerender(root); }
  function restoreBackup(root) { const state = getState("data-export-import", defaults["data-export-import"]); if (!state.pendingImport) return status(root, "Chưa có bản nhập để khôi phục.", "error"); Object.entries(state.pendingImport).forEach(([key, value]) => localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value))); setState("data-export-import", { ...state, pendingImport: null }); status(root, `Đã khôi phục ${Object.keys(state.pendingImport).length} khóa. Hãy tải lại trang.`, "success"); }
  async function addTeamTask(root) { const title = fieldValue(root, "[data-team-title]"); if (!title) return status(root, "Nhập tên công việc.", "error"); const item = { id: uid("task"), title, assignee: fieldValue(root, "[data-team-assignee]"), priority: fieldValue(root, "[data-team-priority]"), status: "todo", createdAt: now() }; setState("team-collaboration", (state) => ({ ...defaults["team-collaboration"], ...state, tasks: [item, ...(state.tasks || [])] })); try { await moduleApi("team-collaboration", { method: "POST", body: { title, type: "task", data: item } }); } catch {} rerender(root); }
  async function syncTeamTasks(root) { try { const data = await moduleApi("team-collaboration"); const remote = (data.items || []).filter((item) => item.type === "task").map((item) => ({ ...item.data, remoteId: item._id })); setState("team-collaboration", (state) => ({ ...defaults["team-collaboration"], ...state, tasks: [...remote, ...(state.tasks || []).filter((item) => !remote.some((remoteItem) => remoteItem.id === item.id))] })); rerender(root); } catch (error) { status(root, error.message, "error"); } }
  function saveFormSchema(root) { const current = getState("form-builder", defaults["form-builder"]); const fields = [...root.querySelectorAll("[data-form-field]")].map((row) => ({ id: row.dataset.formField, label: fieldValue(row, "[data-form-label]"), type: fieldValue(row, "[data-form-type]"), required: row.querySelector("[data-form-required]")?.checked })); setState("form-builder", { ...current, title: fieldValue(root, "[data-form-title]") || current.title, fields }); }
  function exportResponses(root) { const responses = getState("form-builder", defaults["form-builder"]).responses || []; const keys = [...new Set(responses.flatMap((item) => Object.keys(item.data || {})))]; const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`; const csv = [keys.map(quote).join(","), ...responses.map((item) => keys.map((key) => quote(item.data[key])).join(","))].join("\n"); download("hh-form-responses.csv", csv, "text/csv;charset=utf-8"); status(root, `Đã xuất ${responses.length} phản hồi.`, "success"); }
  function addWorkflow(root) { const name = fieldValue(root, "[data-workflow-name]"); if (!name) return status(root, "Nhập tên workflow.", "error"); const item = { id: uid("workflow"), name, trigger: fieldValue(root, "[data-workflow-trigger]"), condition: fieldValue(root, "[data-workflow-condition]"), action: fieldValue(root, "[data-workflow-action]"), enabled: true, createdAt: now() }; setState("workflow-automation", (state) => ({ ...defaults["workflow-automation"], ...state, workflows: [item, ...(state.workflows || [])] })); rerender(root); }

  const tourSteps = [
    [".app-header", "Thanh điều khiển", "Tìm kiếm, mở nhanh và quản lý tài khoản tại đây."],
    [".app-sidebar", "Điều hướng", "Các module được chia theo nhóm công việc."],
    ["[data-shell-command]", "Command Palette", "Mở mọi công cụ nhanh bằng Ctrl + K."],
    ["#appWorkspace", "Workspace", "Mỗi module có không gian thao tác riêng."],
    [".app-user-button", "Tài khoản", "Quản lý hồ sơ, dữ liệu và đăng xuất."],
    [".app-sidebar__group:last-child", "Ủng hộ", "Theo dõi hoạt động phát triển và ủng hộ dự án."]
  ];
  function startTour(index = 0) {
    document.querySelector(".ext-tour-overlay")?.remove(); const [selector, title, text] = tourSteps[index]; const target = document.querySelector(selector); if (!target) return;
    target.classList.add("ext-tour-focus"); const overlay = document.createElement("div"); overlay.className = "ext-tour-overlay"; overlay.innerHTML = `<section><span>BƯỚC ${index + 1}/${tourSteps.length}</span><h4>${title}</h4><p>${text}</p><footer><button type="button" data-tour-skip>Bỏ qua</button>${index ? `<button type="button" data-tour-prev>Quay lại</button>` : ""}<button class="primary" type="button" data-tour-next>${index === tourSteps.length - 1 ? "Hoàn tất" : "Tiếp theo"}</button></footer></section>`; document.body.append(overlay);
    const rect = target.getBoundingClientRect(); const card = overlay.querySelector("section"); card.style.top = `${Math.min(innerHeight - 220, Math.max(20, rect.bottom + 16))}px`; card.style.left = `${Math.min(innerWidth - 380, Math.max(20, rect.left))}px`;
    const finish = (complete = false) => { target.classList.remove("ext-tour-focus"); overlay.remove(); if (complete) setState("onboarding-tour", { ...defaults["onboarding-tour"], completed: true, step: 6 }); };
    overlay.onclick = (event) => { if (event.target.closest("[data-tour-skip]")) finish(); if (event.target.closest("[data-tour-prev]")) { finish(); startTour(index - 1); } if (event.target.closest("[data-tour-next]")) { finish(index === tourSteps.length - 1); if (index < tourSteps.length - 1) startTour(index + 1); } };
  }

  document.addEventListener("click", (event) => {
    const root = event.target.closest("[data-extension-suite]"); if (!root) return;
    const locale = event.target.closest("[data-ext-locale]"); if (locale) { setState("i18n", (state) => ({ ...defaults.i18n, ...state, locale: locale.dataset.extLocale })); rerender(root); return; }
    const nps = event.target.closest("[data-ext-nps]"); if (nps) { root.querySelectorAll("[data-ext-nps]").forEach((node) => node.classList.toggle("active", node === nps)); return; }
    const quest = event.target.closest("[data-ext-quest]"); if (quest) { setState("gamification", (state) => { const next = { ...defaults.gamification, ...state, claimed: { ...(state.claimed || {}), [quest.dataset.extQuest]: new Date().toDateString() } }; next.xp += quests.find((item) => item.id === quest.dataset.extQuest)?.xp || 0; if (next.xp >= 200 && !next.badges.includes("Người khám phá")) next.badges.push("Người khám phá"); return next; }); rerender(root); return; }
    const snapshotDownload = event.target.closest("[data-snapshot-download]"); if (snapshotDownload) { const item = getState("data-export-import", defaults["data-export-import"]).snapshots?.find((entry) => entry.id === snapshotDownload.dataset.snapshotDownload); if (item) download(`hh-snapshot-${item.createdAt.slice(0, 10)}.json`, JSON.stringify(item.data, null, 2)); return; }
    const ticketFilter = event.target.closest("[data-ticket-filter]"); if (ticketFilter) { setState("helpdesk-ticketing", (state) => ({ ...defaults["helpdesk-ticketing"], ...state, filter: ticketFilter.dataset.ticketFilter })); rerender(root); return; }
    const ticketClose = event.target.closest("[data-ticket-close]"); if (ticketClose) { api(`/api/helpdesk/tickets?id=${enc(ticketClose.dataset.ticketClose)}`, { method: "PATCH", body: { status: "closed" } }).then(() => loadTickets(root)).catch((error) => status(root, error.message, "error")); return; }
    const wishlist = event.target.closest("[data-wishlist]"); if (wishlist) { setState("wishlist-compare", (state) => { const list = state.wishlist || []; return { ...defaults["wishlist-compare"], ...state, wishlist: list.includes(wishlist.dataset.wishlist) ? list.filter((id) => id !== wishlist.dataset.wishlist) : [...list, wishlist.dataset.wishlist] }; }); rerender(root); return; }
    const taskMove = event.target.closest("[data-task-move]"); if (taskMove) { const card = taskMove.closest("[data-task-id]"); let changed; setState("team-collaboration", (state) => ({ ...defaults["team-collaboration"], ...state, tasks: (state.tasks || []).map((item) => { if (String(item.id || item._id) !== card.dataset.taskId) return item; const order = ["todo", "doing", "done"]; const position = order.indexOf(item.status); changed = { ...item, status: order[Math.max(0, Math.min(2, position + (taskMove.dataset.taskMove === "next" ? 1 : -1)))] }; return changed; }) })); if (changed?.remoteId) moduleApi("team-collaboration", { method: "PATCH", query: `?id=${enc(changed.remoteId)}`, body: { title: changed.title, type: "task", data: changed } }).catch(() => {}); rerender(root); return; }
    const taskComment = event.target.closest("[data-task-comment]"); if (taskComment) { const card = taskComment.closest("[data-task-id]"); const box = document.createElement("div"); box.className = "ext-inline-comment"; box.innerHTML = `<input placeholder="Nhập bình luận..."><button type="button">Lưu</button>`; card.append(box); box.querySelector("input").focus(); box.querySelector("button").onclick = () => { const value = box.querySelector("input").value.trim(); if (value) setState("team-collaboration", (state) => ({ ...defaults["team-collaboration"], ...state, tasks: (state.tasks || []).map((item) => String(item.id || item._id) === card.dataset.taskId ? { ...item, comment: value } : item) })); rerender(root); }; return; }
    const formRemove = event.target.closest("[data-form-remove]"); if (formRemove) { const field = formRemove.closest("[data-form-field]"); setState("form-builder", (state) => ({ ...defaults["form-builder"], ...state, fields: (state.fields || []).filter((item) => item.id !== field.dataset.formField) })); rerender(root); return; }
    const workflow = event.target.closest("[data-workflow-id]"); if (workflow) {
      if (event.target.closest("[data-workflow-delete]")) setState("workflow-automation", (state) => ({ ...defaults["workflow-automation"], ...state, workflows: (state.workflows || []).filter((item) => item.id !== workflow.dataset.workflowId) }));
      if (event.target.closest("[data-workflow-run]")) runWorkflow(workflow.dataset.workflowId);
      rerender(root); return;
    }
    const action = event.target.closest("[data-ext-action]"); if (action) handleAction(root, action.dataset.extAction, action).catch((error) => status(root, error.message, "error"));
  });

  document.addEventListener("change", (event) => {
    const root = event.target.closest("[data-extension-suite]"); if (!root) return;
    if (event.target.matches("[data-compare]")) { const id = event.target.dataset.compare; setState("wishlist-compare", (state) => { let list = state.compare || []; list = event.target.checked ? [...new Set([...list, id])].slice(-3) : list.filter((item) => item !== id); return { ...defaults["wishlist-compare"], ...state, compare: list }; }); rerender(root); }
    if (event.target.matches("[data-backup-file]")) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const parsed = JSON.parse(reader.result); if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error(); setState("data-export-import", (state) => ({ ...defaults["data-export-import"], ...state, pendingImport: parsed })); rerender(root); } catch { status(root, "Tệp JSON không hợp lệ.", "error"); } }; reader.readAsText(file); }
    if (event.target.matches("[data-workflow-toggle]")) { const itemRoot = event.target.closest("[data-workflow-id]"); setState("workflow-automation", (state) => ({ ...defaults["workflow-automation"], ...state, workflows: (state.workflows || []).map((item) => item.id === itemRoot.dataset.workflowId ? { ...item, enabled: event.target.checked } : item) })); }
  });

  document.addEventListener("input", (event) => {
    const root = event.target.closest('[data-extension-suite="form-builder"]'); if (!root) return;
    if (event.target.matches("[data-form-title]")) { const heading = root.querySelector("[data-generated-form] h5"); if (heading) heading.textContent = event.target.value || "Biểu mẫu chưa đặt tên"; }
    if (event.target.matches("[data-form-label]")) { const rows = [...root.querySelectorAll("[data-form-field]")]; const index = rows.indexOf(event.target.closest("[data-form-field]")); const preview = root.querySelectorAll("[data-generated-form] label > span")[index]; if (preview) preview.textContent = `${event.target.value || "Trường chưa đặt tên"}${rows[index].querySelector("[data-form-required]")?.checked ? " *" : ""}`; }
  });

  document.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-generated-form]"); if (!form) return; event.preventDefault(); const root = form.closest("[data-extension-suite]"); const values = Object.fromEntries(new FormData(form)); setState("form-builder", (state) => ({ ...defaults["form-builder"], ...state, responses: [{ id: uid("response"), data: values, createdAt: now() }, ...(state.responses || [])] })); rerender(root);
  });

  function runWorkflow(workflowId, context = "") {
    const state = getState("workflow-automation", defaults["workflow-automation"]); const flow = state.workflows.find((item) => item.id === workflowId); if (!flow || !flow.enabled) return;
    const matched = !flow.condition || String(context).toLowerCase().includes(flow.condition.toLowerCase());
    if (!matched) { setState("workflow-automation", { ...state, runs: [{ id: uid("run"), name: flow.name, ok: false, message: "Bỏ qua vì điều kiện không khớp.", createdAt: now() }, ...(state.runs || [])].slice(0, 50) }); return; }
    let message = `Đã chạy hành động ${flow.action}.`; if (flow.action === "notify" && "Notification" in window && Notification.permission === "granted") new Notification(flow.name, { body: message });
    if (flow.action === "xp") setState("gamification", (game) => ({ ...defaults.gamification, ...game, xp: (game.xp || 0) + 10 }));
    if (flow.action === "export") download(`${flow.id}-run.txt`, `${flow.name}\n${message}\n${new Date().toLocaleString("vi-VN")}`, "text/plain;charset=utf-8");
    setState("workflow-automation", { ...state, runs: [{ id: uid("run"), name: flow.name, ok: true, message, createdAt: now() }, ...(state.runs || [])].slice(0, 50) });
  }
  function runTriggeredWorkflows(trigger, context = "") {
    const state = getState("workflow-automation", defaults["workflow-automation"]);
    (state.workflows || []).filter((item) => item.enabled && item.trigger === trigger).forEach((item) => runWorkflow(item.id, context));
  }

  async function hydrate(root) {
    const id = root.dataset.extensionSuite;
    if (id === "helpdesk-ticketing" && !root.dataset.hydrated) { root.dataset.hydrated = "1"; await loadTickets(root); }
    if (id === "status-page" && !getState(id, defaults[id]).checks?.length) checkServices(root).catch(() => {});
    if (id === "referral-affiliate" && !root.dataset.hydrated) {
      root.dataset.hydrated = "1";
      const state = ensureReferralState();
      try { const data = await moduleApi(id, { query: `?code=${enc(state.code)}` }); setState(id, { ...state, clicks: data.stats?.clicks || 0, leads: data.stats?.leads || 0 }); rerender(root); } catch {}
    }
  }
  function mount(grid, modules) {
    const stored = readAll();
    let seeded = false;
    IDS.forEach((id) => {
      if (stored[id]) return;
      stored[id] = JSON.parse(JSON.stringify(defaults[id]));
      seeded = true;
    });
    if (seeded) writeAll(stored);
    if (!sessionStorage.getItem("hh-workflow-login-run") && token()) { sessionStorage.setItem("hh-workflow-login-run", "1"); runTriggeredWorkflows("login", currentUser().email || "login"); }
    const dailyKey = `hh-workflow-daily-${new Date().toDateString()}`;
    if (!localStorage.getItem(dailyKey)) { localStorage.setItem(dailyKey, "1"); runTriggeredWorkflows("daily", new Date().toDateString()); }
    const game = getState("gamification", defaults.gamification);
    const today = new Date().toDateString();
    if (game.lastVisit !== today) {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      setState("gamification", { ...game, lastVisit: today, streak: game.lastVisit === yesterday ? (game.streak || 0) + 1 : 1 });
    }
    modules.filter((module) => IDS.includes(module.id)).forEach((module) => {
      const card = grid.querySelector(`[data-module-id="${CSS.escape(module.id)}"]`); const body = card?.querySelector(".module-row-body");
      if (!body) return; body.innerHTML = workspace(module); body.classList.add("module-row-body--extension"); hydrate(body.querySelector("[data-extension-suite]")).catch(() => {});
    });
    applyUi(); applyAccessibility(); applyFlags(); applyLocale();
  }

  const referral = new URLSearchParams(location.search).get("ref");
  if (referral && sessionStorage.getItem("hh-referral-visit") !== referral) {
    sessionStorage.setItem("hh-referral-visit", referral);
    localStorage.setItem("hh-referral-code", referral);
    moduleApi("referral-affiliate", { method: "POST", body: { title: referral, type: "click", data: { code: referral, page: location.href, createdAt: now() } } }).catch(() => {});
  }
  let leadAttempts = 0;
  const leadTimer = setInterval(() => {
    const code = localStorage.getItem("hh-referral-code");
    if (++leadAttempts > 20 || !code || sessionStorage.getItem("hh-referral-lead") === code) return leadAttempts > 20 && clearInterval(leadTimer);
    if (!token()) return;
    sessionStorage.setItem("hh-referral-lead", code);
    moduleApi("referral-affiliate", { method: "POST", body: { title: code, type: "lead", data: { code, createdAt: now() } } }).catch(() => sessionStorage.removeItem("hh-referral-lead"));
    clearInterval(leadTimer);
  }, 1500);
  window.HHExtensionSuite = { supports: (id) => IDS.includes(id), mount, render: workspace, applyUi, applyAccessibility, applyFlags, applyLocale };
})();
