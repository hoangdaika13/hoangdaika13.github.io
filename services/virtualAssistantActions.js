(function initVirtualAssistantActions(globalScope, factory) {
  "use strict";
  const api = factory(globalScope || {});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope) globalScope.HHVirtualAssistantActions = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function virtualAssistantActionsFactory(globalScope) {
  "use strict";

  const VERSION = 1;
  const RISKS = Object.freeze({
    read: { label: "Chỉ xem", confirmation: false },
    navigate: { label: "Mở chức năng", confirmation: false },
    "write-local": { label: "Thay đổi trên thiết bị", confirmation: true },
    external: { label: "Tác động dịch vụ bên ngoài", confirmation: true },
    destructive: { label: "Thao tác nhạy cảm", confirmation: true }
  });

  const ROUTES = Object.freeze([
    { id: "home", route: "/home", label: "Trang chủ", aliases: ["trang chủ", "home", "hôm nay"] },
    { id: "work", route: "/work", label: "Công việc", aliases: ["công việc", "nhiệm vụ", "dự án", "work"] },
    { id: "learning", route: "/learn", label: "Học tập lớp 1–12", aliases: ["học tập", "trường học", "lớp 1", "lớp 12"] },
    { id: "english", route: "/english", label: "HH English", aliases: ["hh english", "tiếng anh", "english"] },
    { id: "japanese", route: "/japanese", label: "HH Japanese", aliases: ["hh japanese", "tiếng nhật", "japanese"] },
    { id: "tools", route: "/davinci-resolve", label: "Tool", aliases: ["tool", "công cụ", "davinci"] },
    { id: "social", route: "/social-media-tools", label: "Công cụ truyền thông xã hội", aliases: ["truyền thông xã hội", "social media", "social"] },
    { id: "youtube", route: "/davinci-resolve/youtube", label: "YouTube Creator Galaxy", aliases: ["youtube creator", "youtube"] },
    { id: "youtube-batch", route: "/davinci-resolve/youtube-batch", label: "YouTube Batch", aliases: ["youtube batch", "đăng youtube hàng loạt", "upload youtube"] },
    { id: "tiktok", route: "/davinci-resolve/tiktok", label: "TikTok Creator", aliases: ["tiktok creator", "tiktok"] },
    { id: "facebook", route: "/davinci-resolve/facebook", label: "Facebook Command Center", aliases: ["facebook page", "facebook"] },
    { id: "thumbnail", route: "/davinci-resolve/image-text", label: "Text on Image Studio", aliases: ["thumbnail", "chèn chữ vào ảnh", "text on image"] },
    { id: "ai-video", route: "/davinci-resolve/ai-video-remake", label: "AI Video Remake", aliases: ["ai video", "video remake", "thay nhân vật video"] },
    { id: "media", route: "/media-design", label: "Media Design", aliases: ["media design", "chỉnh ảnh", "media"] },
    { id: "graphic", route: "/graphic-design", label: "Graphic Design", aliases: ["graphic design", "thiết kế đồ họa"] },
    { id: "music-ai", route: "/music-ai", label: "AI Music", aliases: ["làm nhạc ai", "ai music", "tạo nhạc"] },
    { id: "character", route: "/character-3d", label: "Nhân vật 3D", aliases: ["nhân vật 3d", "character 3d", "avatar 3d"] },
    { id: "comic-reader", route: "/comic-reader", label: "Đọc truyện", aliases: ["đọc truyện", "truyện tranh", "sách"] },
    { id: "comic-motion", route: "/comic-motion-studio", label: "Comic Motion", aliases: ["comic motion", "truyện chuyển động"] },
    { id: "cinema", route: "/cinema", label: "Phim", aliases: ["xem phim", "phim"] },
    { id: "music", route: "/music", label: "Nhạc mở", aliases: ["nghe nhạc", "nhạc mở", "nhạc miễn phí"] },
    { id: "game", route: "/entertainment", label: "Game", aliases: ["game", "trò chơi", "giải trí"] },
    { id: "communication", route: "/communication", label: "Liên lạc", aliases: ["liên lạc", "tin nhắn", "communication"] },
    { id: "create", route: "/create", label: "Creative OS", aliases: ["creative os", "tạo nội dung"] },
    { id: "analytics", route: "/analytics", label: "Phân tích", aliases: ["phân tích", "analytics", "web vitals"] },
    { id: "dev", route: "/dev-tools", label: "DEV", aliases: ["dev tools", "lập trình", "developer"] },
    { id: "system", route: "/system", label: "Hệ thống", aliases: ["hệ thống", "cài đặt", "system"] },
    { id: "copyright", route: "/copyright", label: "Bản quyền", aliases: ["bản quyền", "copyright", "giấy phép"] },
    { id: "support", route: "/support", label: "Hỗ trợ", aliases: ["hỗ trợ", "ủng hộ nhà phát triển", "support"] },
    { id: "admin", route: "/admin", label: "Admin Panel", aliases: ["admin panel", "quản trị"] }
  ]);
  const ROUTE_SET = new Set(ROUTES.map(item => item.route));

  const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().replace(/[.,!?;]+/g, " ").replace(/\s+/g, " ").trim();
  const cleanText = (value, limit = 500) => String(value == null ? "" : value).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
  const safeRoute = route => ROUTE_SET.has(String(route || ""));
  const makePlan = input => ({ matched: true, createdAt: new Date().toISOString(), ...input, confirmationRequired: RISKS[input.risk]?.confirmation === true });
  const noMatch = () => ({ matched: false, id: "unknown", risk: "read", confirmationRequired: false });

  function scopeOf(context = {}) {
    return { ownerId: cleanText(context.owner || "guest", 72), learnerProfileId: cleanText(context.profile || "default", 72) };
  }

  function prepare(input, context = {}) {
    const raw = cleanText(input, 600);
    const text = normalize(raw);
    const scope = scopeOf(context);
    if (!text) return noMatch();

    if (/^(hom nay.*viec|viec.*hom nay|nhiem vu.*hom nay)/.test(text)) return makePlan({ id: "today.read", title: "Đọc việc hôm nay", summary: context.taskCount ? `Bạn còn ${context.taskCount} công việc chưa hoàn thành.` : "Hôm nay chưa có công việc tồn đọng.", risk: "read", scope, payload: {} });
    if (/bai hoc.*den han|on tap.*den han/.test(text)) return makePlan({ id: "learning.read-due", title: "Đọc bài đến hạn", summary: context.lessonDue ? `Bạn có ${context.lessonDue} bài học hoặc thẻ ôn đến hạn.` : "Hiện không có bài học đến hạn trong dữ liệu đã lưu.", risk: "read", scope, payload: {} });
    if (/thong bao.*moi|doc thong bao/.test(text)) return makePlan({ id: "notifications.read", title: "Đọc thông báo", summary: context.unreadCount ? `Bạn có ${context.unreadCount} thông báo chưa đọc.` : "Bạn không có thông báo chưa đọc.", risk: "read", scope, payload: {} });
    if (/trang thai website|backend|api health|trang thai mang/.test(text)) return makePlan({ id: "system.read-health", title: "Kiểm tra trạng thái", summary: `Mạng đang ${context.online ? "trực tuyến" : "ngoại tuyến"}. Backend: ${cleanText(context.apiStatus || "chưa có dữ liệu", 120)}.`, risk: "read", scope, payload: {} });

    const taskMatch = raw.match(/(?:thêm|tạo)(?: cho tôi)?(?: một)?\s*(?:công việc|nhiệm vụ|task)(?: mới)?(?: là|:)?\s+(.+)/i);
    if (taskMatch) {
      const title = cleanText(taskMatch[1], 180);
      if (title.length >= 2) return makePlan({ id: "task.create-local", title: "Tạo công việc", summary: `Thêm “${title}” vào danh sách công việc trên thiết bị này.`, risk: "write-local", scope, payload: { title, priority: "medium", category: "Hikari" } });
    }
    const noteMatch = raw.match(/(?:ghi chú|lưu ghi chú)(?: lại)?(?: là|:)?\s+(.+)/i);
    if (noteMatch) {
      const body = cleanText(noteMatch[1], 1000);
      if (body.length >= 2) return makePlan({ id: "note.create-local", title: "Lưu ghi chú riêng", summary: `Lưu ghi chú “${body.slice(0, 110)}${body.length > 110 ? "…" : ""}” cho hồ sơ hiện tại.`, risk: "write-local", scope, payload: { body } });
    }
    const focusMatch = text.match(/(?:bat|tao|hen)?\s*(?:pomodoro|tap trung|hen gio)\s*(\d{1,3})\s*phut/);
    if (focusMatch) {
      const minutes = Math.max(1, Math.min(180, Number(focusMatch[1]) || 25));
      return makePlan({ id: "focus.start-local", title: "Bắt đầu tập trung", summary: `Bắt đầu bộ đếm tập trung ${minutes} phút trên thiết bị này.`, risk: "write-local", scope, payload: { minutes } });
    }

    if (/(dang|upload|xuat ban|len lich).*(youtube|tiktok|facebook)|gui (email|thu|tin nhan)/.test(text)) {
      const target = text.includes("tiktok") ? ROUTES.find(item => item.id === "tiktok") : text.includes("facebook") ? ROUTES.find(item => item.id === "facebook") : text.includes("email") || text.includes("gui thu") ? ROUTES.find(item => item.id === "communication") : ROUTES.find(item => item.id === "youtube-batch");
      return makePlan({ id: "external.open-workflow", title: `Chuẩn bị tác vụ tại ${target.label}`, summary: `Hikari sẽ mở ${target.label} và chuyển yêu cầu sang quy trình có kiểm tra tài khoản, quyền và trạng thái backend. Hikari không tự đăng hoặc gửi thay bạn.`, risk: "external", route: target.route, scope, payload: { request: raw, target: target.id } });
    }
    if (/(xoa|huy|thu hoi|doi quyen|rieng tu).*(video|bai|kenh|tai khoan|du lieu|lich|quyen)|xoa (het|tat ca)/.test(text)) {
      const target = text.includes("quyen") || text.includes("rieng tu") || text.includes("tai khoan") ? ROUTES.find(item => item.id === "system") : text.includes("video") || text.includes("kenh") ? ROUTES.find(item => item.id === "tools") : ROUTES.find(item => item.id === "work");
      return makePlan({ id: "destructive.open-tool", title: "Mở công cụ để kiểm tra thao tác nhạy cảm", summary: `Hikari không tự xóa hoặc đổi quyền. Sau khi xác nhận, Hikari chỉ mở ${target.label} để bạn kiểm tra đúng đối tượng và xác nhận lần cuối tại công cụ.`, risk: "destructive", route: target.route, scope, payload: { request: raw, target: target.id } });
    }

    const wantsNavigation = /^(mo|den|dua toi|di toi|truy cap|xem)\b/.test(text) || /\b(mo|truy cap)\b/.test(text);
    if (wantsNavigation) {
      const route = ROUTES.find(item => item.aliases.some(alias => text.includes(normalize(alias))));
      if (route) return makePlan({ id: `navigate.${route.id}`, title: `Mở ${route.label}`, summary: `Chuyển tới ${route.label}.`, risk: "navigate", route: route.route, scope, payload: { target: route.id } });
    }
    if (/tiep tuc cong viec|mo cong cu gan nhat/.test(text)) {
      const recentRoute = safeRoute(context.recentRoute) ? context.recentRoute : "/home";
      const route = ROUTES.find(item => item.route === recentRoute) || ROUTES[0];
      return makePlan({ id: "navigate.recent", title: "Tiếp tục công việc", summary: `Mở lại ${route.label}.`, risk: "navigate", route: route.route, scope, payload: { target: route.id } });
    }
    return noMatch();
  }

  function readArray(storage, key) {
    try { const value = JSON.parse(storage?.getItem?.(key) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; }
  }
  function writeArray(storage, key, items) { storage?.setItem?.(key, JSON.stringify(items)); }
  function scopedKey(kind, scope) { return `hh.hikari.${kind}.v2:${scope.ownerId}:${scope.learnerProfileId}`; }
  function assertScope(plan, runtime) {
    const current = scopeOf(runtime.context || {});
    if (plan.scope?.ownerId !== current.ownerId || plan.scope?.learnerProfileId !== current.learnerProfileId) throw new Error("Hồ sơ đã thay đổi. Hãy yêu cầu Hikari chuẩn bị lại thao tác.");
  }
  function audit(plan, runtime, status) {
    const key = scopedKey("audit", plan.scope);
    const rows = readArray(runtime.storage, key);
    rows.push({ id: `hva-audit-${Date.now().toString(36)}`, actionId: plan.id, risk: plan.risk, status, route: safeRoute(plan.route) ? plan.route : "", at: new Date().toISOString() });
    writeArray(runtime.storage, key, rows.slice(-200));
    globalScope.dispatchEvent?.(new CustomEvent("hh:assistant-action", { detail: { actionId: plan.id, risk: plan.risk, status, scope: { ...plan.scope } } }));
  }

  async function execute(plan, runtime = {}) {
    if (!plan?.matched || !RISKS[plan.risk]) throw new Error("Hành động Hikari không hợp lệ.");
    assertScope(plan, runtime);
    if (plan.confirmationRequired && runtime.confirmed !== true) return { ok: false, status: "awaiting-confirmation", completed: false, reply: plan.summary };
    if (["write-local", "external", "destructive"].includes(plan.risk) && runtime.permissions?.allowLocalActions === false) throw new Error("Hồ sơ này đang tắt quyền thao tác của Hikari.");

    if (plan.risk === "read") { audit(plan, runtime, "read"); return { ok: true, status: "completed", completed: true, reply: plan.summary }; }
    if (plan.risk === "navigate") {
      if (!safeRoute(plan.route) || runtime.navigate?.(plan.route) !== true) throw new Error("Không thể mở chức năng được yêu cầu.");
      audit(plan, runtime, "navigated"); return { ok: true, status: "navigated", completed: true, reply: `Đã mở ${plan.title.replace(/^Mở\s+/i, "")}.` };
    }
    if (plan.id === "task.create-local") {
      const item = { id: `hikari-task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, title: plan.payload.title, priority: plan.payload.priority, category: plan.payload.category, deadline: "", reminder: "", repeat: "none", completed: false, createdAt: Date.now(), ownerId: plan.scope.ownerId, learnerProfileId: plan.scope.learnerProfileId, source: "hikari" };
      const canonical = readArray(runtime.storage, "hh.command-center.todos.v2"); canonical.unshift(item); writeArray(runtime.storage, "hh.command-center.todos.v2", canonical.slice(0, 1000));
      const scoped = readArray(runtime.storage, scopedKey("tasks", plan.scope)); scoped.unshift(item); writeArray(runtime.storage, scopedKey("tasks", plan.scope), scoped.slice(0, 500));
      audit(plan, runtime, "completed"); globalScope.dispatchEvent?.(new CustomEvent("hh:tasks-changed", { detail: { source: "hikari", scope: { ...plan.scope } } }));
      return { ok: true, status: "completed", completed: true, reply: `Đã thêm công việc “${plan.payload.title}”.` };
    }
    if (plan.id === "note.create-local") {
      const rows = readArray(runtime.storage, scopedKey("notes", plan.scope)); rows.unshift({ id: `hikari-note-${Date.now().toString(36)}`, body: plan.payload.body, createdAt: new Date().toISOString() }); writeArray(runtime.storage, scopedKey("notes", plan.scope), rows.slice(0, 300));
      audit(plan, runtime, "completed"); return { ok: true, status: "completed", completed: true, reply: "Đã lưu ghi chú riêng cho hồ sơ hiện tại." };
    }
    if (plan.id === "focus.start-local") {
      const value = { minutes: plan.payload.minutes, startedAt: Date.now(), endsAt: Date.now() + plan.payload.minutes * 60000, ownerId: plan.scope.ownerId, learnerProfileId: plan.scope.learnerProfileId };
      runtime.storage?.setItem?.(scopedKey("focus", plan.scope), JSON.stringify(value));
      audit(plan, runtime, "completed"); globalScope.dispatchEvent?.(new CustomEvent("hh:assistant-focus-start", { detail: { minutes: plan.payload.minutes, scope: { ...plan.scope } } }));
      return { ok: true, status: "completed", completed: true, reply: `Đã bắt đầu phiên tập trung ${plan.payload.minutes} phút.` };
    }
    if (["external.open-workflow", "destructive.open-tool"].includes(plan.id)) {
      if (!safeRoute(plan.route) || runtime.navigate?.(plan.route) !== true) throw new Error("Không thể mở công cụ đích.");
      audit(plan, runtime, "handoff");
      return { ok: true, status: "handoff", completed: false, reply: plan.risk === "destructive" ? "Đã mở đúng công cụ. Chưa có dữ liệu nào bị xóa hoặc thay đổi quyền." : "Đã mở quy trình chính thức. Tác vụ bên ngoài chưa được thực hiện cho tới khi công cụ và backend xác nhận." };
    }
    throw new Error("Hành động này chưa có bộ thực thi thật.");
  }

  function catalog() { return ROUTES.map(item => ({ id: `navigate.${item.id}`, label: item.label, route: item.route, risk: "navigate", scope: "platform" })); }
  return Object.freeze({ VERSION, RISKS, ROUTES, safeRoute, normalize, prepare, execute, catalog, scopedKey });
});
