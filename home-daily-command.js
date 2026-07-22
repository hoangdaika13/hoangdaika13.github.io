(function (global, factory) {
  "use strict";

  const api = factory(global);
  global.HHHomeDailyCommand = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global.document) api.start();
})(typeof window !== "undefined" ? window : globalThis, function createHomeDailyCommand(global) {
  "use strict";

  const SELECTORS = Object.freeze({
    home: '[data-shell-view="home"]',
    hero: ".dashboard-hero-pro"
  });
  const KEYS = Object.freeze({
    account: "hh-auth-user",
    todos: "hh.command-center.todos.v2",
    focus: "hh.command-center.pomodoro.v1",
    weather: "hh.dashboard.weather.v1",
    projects: "hh-project-center",
    music: "hh.music-ai-studio.v1",
    musicApps: "hh.music-ai.apps.v1",
    mediaPage: "hh.media-design.page.v1",
    mediaHistory: "hh-media-design-history",
    photo: "hh.photo.pro.v2",
    video: "hh.resolve-web-studio.v1",
    videoLegacy: "hh.video-editor.project.v1",
    learning: "hh.learning.os.v1",
    messenger: "hh.communication.messenger.v1",
    communication: "hh.communication.intelligence.v1",
    recent: "hh.app-shell.recent",
    aiConsent: "hh.home-daily.ai-consent.v1",
    operations: "hh.home.daily-command.v3",
    creativePublishing: "hh.creative-publishing.v1",
    youtubePublisher: "hh.youtube-publisher.v1",
    musicPublishing: "hh.music.publishing-rights.v1"
  });
  const CATEGORY_META = Object.freeze({
    project: { icon: "PR", tone: "cyan", label: "Dự án" },
    music: { icon: "MU", tone: "pink", label: "Âm nhạc" },
    design: { icon: "DE", tone: "violet", label: "Thiết kế" },
    learning: { icon: "LE", tone: "lime", label: "Học tập" },
    communication: { icon: "CO", tone: "amber", label: "Giao tiếp" }
  });
  const state = { started: false, timer: 0, lastHome: null };

  function cleanText(value, limit = 160) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, limit);
  }

  function read(storage, key, fallback) {
    try {
      const raw = storage && storage.getItem(key);
      if (raw == null || raw === "") return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch {
      return fallback;
    }
  }

  function has(storage, key) {
    try { return storage && storage.getItem(key) != null; } catch { return false; }
  }

  function write(storage, key, value) {
    try { storage && storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function toTime(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const parsed = Date.parse(value || "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function newestTime() {
    return Math.max(0, ...Array.from(arguments).flat(Infinity).map((value) => {
      if (value && typeof value === "object") {
        return toTime(value.updatedAt || value.savedAt || value.modifiedAt || value.createdAt || value.endedAt || value.at);
      }
      return toTime(value);
    }));
  }

  function periodFor(date = new Date()) {
    const hour = date.getHours();
    if (hour < 5) return { id: "night", greeting: "Chào buổi tối" };
    if (hour < 12) return { id: "morning", greeting: "Chào buổi sáng" };
    if (hour < 18) return { id: "afternoon", greeting: "Chào buổi chiều" };
    return { id: "evening", greeting: "Chào buổi tối" };
  }

  function dayProgress(date = new Date()) {
    const elapsed = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
    return clamp(Math.round(elapsed / 86400 * 100), 0, 100);
  }

  function focusMinutes(storage, date = new Date()) {
    const focus = read(storage, KEYS.focus, {});
    const day = date.toISOString().slice(0, 10);
    return asArray(focus.sessions).reduce((minutes, session) => {
      const endedAt = toTime(session.endedAt);
      const sessionDay = cleanText(session.date || session.day || "", 10) || (endedAt ? new Date(endedAt).toISOString().slice(0, 10) : "");
      if (sessionDay !== day) return minutes;
      return minutes + clamp(session.minutes || session.durationMinutes || 25, 1, 240);
    }, 0);
  }

  function topTask(storage, now = Date.now()) {
    const todos = asArray(read(storage, KEYS.todos, []));
    const weight = { high: 0, urgent: 0, medium: 1, normal: 1, low: 2 };
    return todos.filter((item) => item && !item.completed && cleanText(item.title)).sort((left, right) => {
      const leftDue = toTime(left.deadline) || Number.MAX_SAFE_INTEGER;
      const rightDue = toTime(right.deadline) || Number.MAX_SAFE_INTEGER;
      const leftLate = leftDue < now ? -1 : 0;
      const rightLate = rightDue < now ? -1 : 0;
      return leftLate - rightLate || (weight[left.priority] ?? 1) - (weight[right.priority] ?? 1) || leftDue - rightDue;
    })[0] || null;
  }

  function dayStamp(value = Date.now()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function dueTime(item) {
    return toTime(item && (item.deadline || item.due || item.dueDate || item.endDate || item.scheduledAt || item.publishAt));
  }

  function collectTodayPlan(storage = global.localStorage, now = Date.now()) {
    const today = dayStamp(now);
    const weight = { urgent: 0, high: 0, cao: 0, medium: 1, normal: 1, "trung bình": 1, low: 2, "thấp": 2 };
    const commandTasks = asArray(read(storage, KEYS.todos, [])).map((item, index) => ({
      id: cleanText(item && (item.id || `command-${index}`), 100),
      source: "command",
      title: cleanText(item && item.title, 120),
      priority: cleanText(item && item.priority || "normal", 30).toLowerCase(),
      due: cleanText(item && (item.deadline || item.due), 40),
      completed: Boolean(item && item.completed),
      route: "/home"
    }));
    const projectState = read(storage, KEYS.projects, {});
    const projectTasks = asArray(projectState.tasks).map((item, index) => ({
      id: cleanText(item && (item.id || `project-${index}`), 100),
      source: "project",
      title: cleanText(item && item.title, 120),
      priority: cleanText(item && item.priority || "normal", 30).toLowerCase(),
      due: cleanText(item && (item.deadline || item.due), 40),
      completed: Boolean(item && (item.completed || item.column === "done" || item.status === "done")),
      route: "/work/project-center"
    }));
    const open = [...commandTasks, ...projectTasks].filter((item) => item.title && !item.completed);
    const dueNow = open.filter((item) => item.due && dayStamp(item.due) <= today);
    const candidates = dueNow.length ? dueNow : open;
    return candidates.sort((left, right) => {
      const leftLate = left.due && dayStamp(left.due) < today ? -1 : 0;
      const rightLate = right.due && dayStamp(right.due) < today ? -1 : 0;
      return leftLate - rightLate || (weight[left.priority] ?? 1) - (weight[right.priority] ?? 1) || (dueTime(left) || Number.MAX_SAFE_INTEGER) - (dueTime(right) || Number.MAX_SAFE_INTEGER);
    }).slice(0, 6).map((item) => ({ ...item, overdue: Boolean(item.due && dayStamp(item.due) < today) }));
  }

  function collectPriorityNotifications(storage = global.localStorage) {
    const state = read(storage, KEYS.communication, {});
    const unread = asArray(state.notifications).filter((item) => item && !item.read).map((item, index) => ({
      id: cleanText(item.id || `notification-${index}`, 100),
      title: cleanText(item.title || item.message || item.subject || "Thông báo", 120),
      detail: cleanText(item.detail || item.description || item.channel || item.source || "Giao tiếp", 140),
      priority: cleanText(item.priority || item.level || "normal", 30).toLowerCase(),
      timestamp: newestTime(item),
      route: /^\/[a-z0-9/_-]+$/i.test(item.route || "") ? item.route : "/communication/notifications"
    }));
    const important = unread.filter((item) => ["important", "urgent", "high", "critical", "cao", "khẩn"].includes(item.priority));
    return (important.length ? important : unread).sort((left, right) => right.timestamp - left.timestamp).slice(0, 4);
  }

  function collectAtRiskProjects(storage = global.localStorage, now = Date.now()) {
    const projects = asArray(read(storage, KEYS.projects, {}).projects);
    const today = Date.parse(dayStamp(now) + "T00:00:00Z");
    return projects.map((item, index) => {
      const deadline = dueTime(item);
      const progress = clamp(item && item.progress, 0, 100);
      if (!deadline || progress >= 100) return null;
      const deadlineDay = Date.parse(dayStamp(deadline) + "T00:00:00Z");
      const days = Math.round((deadlineDay - today) / 86400000);
      if (days > 7) return null;
      return {
        id: cleanText(item.id || `project-${index}`, 100),
        title: cleanText(item.name || item.title || "Dự án", 120),
        progress,
        deadline: new Date(deadline).toISOString(),
        days,
        risk: days < 0 ? "overdue" : days <= 2 ? "critical" : "soon",
        route: "/work/project-center"
      };
    }).filter(Boolean).sort((left, right) => left.days - right.days || left.progress - right.progress).slice(0, 4);
  }

  function collectApiQuotas(storage = global.localStorage) {
    const publishing = read(storage, KEYS.creativePublishing, {});
    return asArray(publishing.providers).map((item, index) => {
      const limit = Math.max(0, Number(item && item.quotaLimit) || 0);
      const used = Math.max(0, Number(item && item.quotaUsed) || 0);
      const percent = limit ? clamp(Math.round(used / limit * 100), 0, 100) : null;
      return {
        id: cleanText(item.id || `provider-${index}`, 100),
        label: cleanText(item.label || item.name || item.id || "Provider", 80),
        configured: Boolean(item.configured),
        status: cleanText(item.status || (item.configured ? "ready" : "not-configured"), 40),
        used,
        limit,
        percent,
        severity: percent == null ? "unknown" : percent >= 90 ? "critical" : percent >= 75 ? "warning" : "healthy",
        route: "/create/providers"
      };
    }).sort((left, right) => (right.percent ?? -1) - (left.percent ?? -1)).slice(0, 5);
  }

  function collectYouTubeSchedule(storage = global.localStorage, now = Date.now()) {
    const publishing = read(storage, KEYS.creativePublishing, {});
    const youtubeDraft = read(storage, KEYS.youtubePublisher, {});
    const music = read(storage, KEYS.musicPublishing, {});
    const items = asArray(publishing.queue).filter((item) => item && item.platform === "youtube" && item.scheduledAt && ["scheduled", "queued", "draft"].includes(item.status)).map((item, index) => ({
      id: cleanText(item.id || `creative-youtube-${index}`, 100),
      title: cleanText(item.title || "Nội dung YouTube", 120),
      publishAt: item.scheduledAt,
      status: cleanText(item.status || "scheduled", 30),
      route: "/create/publishing"
    }));
    if (youtubeDraft.privacyMode === "schedule" && youtubeDraft.publishAt) items.push({
      id: "youtube-publisher-draft",
      title: cleanText(youtubeDraft.title || "Bản nháp YouTube", 120),
      publishAt: youtubeDraft.publishAt,
      status: "draft",
      route: "/music-ai/youtube-publisher"
    });
    const musicDraft = music.publishDraft || music.draft || {};
    if ((musicDraft.privacy === "schedule" || musicDraft.privacyMode === "schedule") && (musicDraft.scheduleAt || musicDraft.publishAt)) items.push({
      id: "music-release-draft",
      title: cleanText(musicDraft.title || "Lịch phát Music AI", 120),
      publishAt: musicDraft.scheduleAt || musicDraft.publishAt,
      status: "draft",
      route: "/music-ai/publish"
    });
    const seen = new Set();
    return items.filter((item) => {
      const time = toTime(item.publishAt);
      const signature = `${item.title}|${time}`;
      if (!time || time < now - 3600000 || seen.has(signature)) return false;
      seen.add(signature);
      return true;
    }).sort((left, right) => toTime(left.publishAt) - toTime(right.publishAt)).slice(0, 5);
  }

  function recommendNextAction(snapshot) {
    const data = snapshot || {};
    const overdueProject = asArray(data.projects).find((item) => item.risk === "overdue");
    if (overdueProject) return { id: "recover-project", eyebrow: "RỦI RO DEADLINE", title: `Gỡ trễ cho ${overdueProject.title}`, detail: `Dự án đã trễ ${Math.abs(overdueProject.days)} ngày và đang ở ${overdueProject.progress}%. Mở timeline để điều chỉnh phạm vi hoặc deadline.`, label: "Mở dự án", route: overdueProject.route };
    const urgentTask = asArray(data.plan).find((item) => item.overdue || ["urgent", "high", "cao", "khẩn"].includes(item.priority));
    if (urgentTask) return { id: "focus-task", eyebrow: "HÀNH ĐỘNG TIẾP THEO", title: urgentTask.title, detail: urgentTask.overdue ? "Việc này đã quá hạn. Hoàn thành hoặc đổi kế hoạch trước khi mở thêm công việc." : "Đây là việc ưu tiên cao nhất từ kế hoạch hôm nay.", label: "Bắt đầu", route: urgentTask.route };
    const quota = asArray(data.quotas).find((item) => item.severity === "critical");
    if (quota) return { id: "quota-guard", eyebrow: "BẢO VỆ HẠN MỨC", title: `Kiểm tra ${quota.label}`, detail: `Đã dùng ${quota.percent}% hạn mức đã công bố. Xem Provider Router trước khi chạy tác vụ mới.`, label: "Xem quota", route: quota.route };
    const notification = asArray(data.notifications)[0];
    if (notification) return { id: "review-notification", eyebrow: "THÔNG BÁO ƯU TIÊN", title: notification.title, detail: notification.detail, label: "Xem thông báo", route: notification.route };
    const scheduled = asArray(data.youtube)[0];
    if (scheduled) return { id: "youtube-preflight", eyebrow: "LỊCH PHÁT YOUTUBE", title: scheduled.title, detail: `Kiểm tra metadata và thumbnail trước ${formatDateTime(scheduled.publishAt)}.`, label: "Kiểm tra lịch", route: scheduled.route };
    return { id: "plan-day", eyebrow: "TRỢ LÝ HÀNH ĐỘNG", title: "Lập việc quan trọng tiếp theo", detail: "Không có cảnh báo cục bộ. Mở Công việc để tạo task, deadline hoặc dự án cho hôm nay.", label: "Mở Công việc", route: "/work" };
  }

  function collectOperations(storage = global.localStorage, now = Date.now()) {
    const snapshot = {
      plan: collectTodayPlan(storage, now),
      notifications: collectPriorityNotifications(storage),
      projects: collectAtRiskProjects(storage, now),
      quotas: collectApiQuotas(storage),
      youtube: collectYouTubeSchedule(storage, now)
    };
    snapshot.recommendation = recommendNextAction(snapshot);
    return snapshot;
  }

  function weatherText(storage) {
    const cache = read(storage, KEYS.weather, {});
    const payload = cache.payload || cache;
    const weather = payload.weather || payload;
    const current = weather.current || weather.current_weather || {};
    const temperature = current.temperature_2m ?? current.temperature;
    const location = cleanText(cache.location?.name || payload.location?.name || "", 40);
    if (!Number.isFinite(Number(temperature))) return "Chưa có dữ liệu thời tiết";
    return `${location || "Thời tiết"} · ${Math.round(Number(temperature))}°C`;
  }

  function initials(name) {
    const parts = cleanText(name || "HH", 80).split(" ").filter(Boolean);
    return parts.slice(-2).map((part) => part.charAt(0)).join("").toUpperCase() || "HH";
  }

  function safeImage(value) {
    const source = cleanText(value, 2000);
    return /^(https:\/\/|blob:|data:image\/(?:png|jpeg|jpg|webp|gif);base64,)/i.test(source) ? source : "";
  }

  function recentHint(storage, patterns) {
    const recent = asArray(read(storage, KEYS.recent, [])).map((item) => cleanText(item, 100).toLowerCase());
    return recent.some((item) => patterns.some((pattern) => item.includes(pattern)));
  }

  function normalizeItem(category, title, detail, route, timestamp, meaningful = true) {
    if (!meaningful || !cleanText(title)) return null;
    return {
      category,
      title: cleanText(title, 100),
      detail: cleanText(detail, 150),
      route: /^\/[a-z0-9/_-]+$/i.test(route) ? route : "/home",
      timestamp: Number(timestamp) || 0,
      meta: CATEGORY_META[category]
    };
  }

  function projectItem(storage) {
    const data = read(storage, KEYS.projects, {});
    const projects = asArray(data.projects);
    if (!has(storage, KEYS.projects) || !projects.length) return null;
    const active = projects.find((item) => String(item.id) === String(data.activeProject)) || [...projects].sort((a, b) => newestTime(b) - newestTime(a))[0];
    return normalizeItem("project", active.name || active.title || "Dự án", `${active.status || "Đang thực hiện"}${Number.isFinite(Number(active.progress)) ? ` · ${clamp(active.progress, 0, 100)}%` : ""}`, "/work/project-center", newestTime(active, data));
  }

  function musicItem(storage) {
    const data = read(storage, KEYS.music, {});
    const apps = read(storage, KEYS.musicApps, {});
    const exists = has(storage, KEYS.music) || has(storage, KEYS.musicApps) || recentHint(storage, ["music", "composer", "lyrics"]);
    if (!exists) return null;
    const project = data.project || apps.project || {};
    const title = project.name || project.title || data.title || "Music Production Studio";
    const stage = data.workspace || data.activeWorkspace || apps.active || "Dự án âm nhạc đang lưu trên thiết bị";
    return normalizeItem("music", title, stage, "/music-ai/studio", newestTime(data, project, apps));
  }

  function designItem(storage) {
    const candidates = [];
    const photo = read(storage, KEYS.photo, {});
    if (has(storage, KEYS.photo)) candidates.push(normalizeItem("design", photo.name || "Photo Editor", `${asArray(photo.layers).length} layer · bản chỉnh sửa cục bộ`, "/media-design/photo-editor", newestTime(photo)));
    const video = read(storage, KEYS.video, {});
    if (has(storage, KEYS.video)) candidates.push(normalizeItem("design", video.project?.name || video.name || "Video Editor", `${asArray(video.pro?.clips || video.clips).length} clip · timeline cục bộ`, "/media-design/video-editor", newestTime(video, video.project)));
    const legacyVideo = read(storage, KEYS.videoLegacy, {});
    if (has(storage, KEYS.videoLegacy)) candidates.push(normalizeItem("design", legacyVideo.name || "Video Editor", `${asArray(legacyVideo.clips).length} clip · dự án đã lưu`, "/media-design/video-editor", newestTime(legacyVideo)));
    const history = asArray(read(storage, KEYS.mediaHistory, []));
    const latest = [...history].sort((a, b) => newestTime(b) - newestTime(a))[0];
    if (latest) candidates.push(normalizeItem("design", latest.title || latest.tool || "Media & Design", latest.detail || latest.tool || "Hoạt động gần đây", "/media-design", newestTime(latest)));
    const page = read(storage, KEYS.mediaPage, {});
    if (has(storage, KEYS.mediaPage) && (page.active || asArray(page.recent).length)) {
      const tool = cleanText(page.active || page.recent[0] || "Media & Design", 80);
      const slug = ({ "Photo Editor": "photo-editor", "Video Editor": "video-editor" })[tool];
      candidates.push(normalizeItem("design", tool, "Workspace gần nhất", slug ? `/media-design/${slug}` : "/media-design", newestTime(page)));
    }
    return candidates.filter(Boolean).sort((a, b) => b.timestamp - a.timestamp)[0] || null;
  }

  function learningItem(storage) {
    const data = read(storage, KEYS.learning, {});
    if (!has(storage, KEYS.learning)) return null;
    const active = cleanText(data.activeLessonId || "Bài học đang học", 100);
    const level = cleanText(data.profile?.level || "", 12);
    const progress = data.progress?.[data.activeLessonId];
    return normalizeItem("learning", active.replace(/-/g, " "), `${level ? `Trình độ ${level}` : "Lộ trình cá nhân"}${progress?.status === "started" ? " · đang học" : ""}`, "/learn/lesson", newestTime(data, progress));
  }

  function communicationItem(storage) {
    const messenger = read(storage, KEYS.messenger, {});
    const intelligence = read(storage, KEYS.communication, {});
    const exists = has(storage, KEYS.messenger) || has(storage, KEYS.communication) || recentHint(storage, ["community", "messenger", "communication"]);
    if (!exists) return null;
    const rooms = asArray(messenger.rooms || messenger.conversations || messenger.threads);
    const room = rooms.find((item) => String(item.id) === String(messenger.activeRoomId || messenger.activeConversationId)) || [...rooms].sort((a, b) => newestTime(b) - newestTime(a))[0];
    const unread = asArray(intelligence.notifications).filter((item) => !item.read).length;
    return normalizeItem("communication", room?.name || room?.title || "Messenger HH", room ? `${asArray(room.messages).length} tin nhắn${unread ? ` · ${unread} chưa đọc` : ""}` : `${unread} thông báo chưa đọc`, "/communication/messenger", newestTime(room, messenger, intelligence));
  }

  function collectRecentWork(storage = global.localStorage) {
    return [projectItem(storage), musicItem(storage), designItem(storage), learningItem(storage), communicationItem(storage)]
      .filter(Boolean)
      .sort((left, right) => right.timestamp - left.timestamp)
      .slice(0, 4);
  }

  function automatedSummary(storage = global.localStorage, now = Date.now()) {
    const todos = asArray(read(storage, KEYS.todos, [])).filter((item) => item && !item.completed);
    const projects = asArray(read(storage, KEYS.projects, {}).projects);
    const notifications = asArray(read(storage, KEYS.communication, {}).notifications).filter((item) => !item.read);
    const learning = read(storage, KEYS.learning, {});
    const dueReviews = asArray(learning.reviews).filter((item) => toTime(item.dueAt) && toTime(item.dueAt) <= now).length;
    const overdueProjects = projects.filter((item) => {
      const due = toTime(item.deadline || item.due);
      return due && due < now && Number(item.progress || 0) < 100;
    });
    const lines = [];
    if (todos.length) lines.push(`${todos.length} công việc chưa hoàn thành`);
    if (overdueProjects.length) lines.push(`${overdueProjects.length} dự án đã qua deadline`);
    if (notifications.length) lines.push(`${notifications.length} thông báo chưa đọc`);
    if (dueReviews) lines.push(`${dueReviews} nội dung đến hạn ôn tập`);
    if (!lines.length) return "Chưa có cảnh báo từ dữ liệu cục bộ. Hãy thêm task, dự án hoặc lịch học để nhận tóm tắt hữu ích hơn.";
    return `Hôm nay bạn có ${lines.slice(0, 3).join(", ")}. ${todos.length ? `Ưu tiên tiếp theo: ${cleanText(topTask(storage, now)?.title || "xem danh sách công việc", 80)}.` : ""}`.trim();
  }

  function formatRelative(timestamp, now = Date.now()) {
    if (!timestamp) return "Đã lưu trên thiết bị";
    const minutes = Math.max(0, Math.round((now - timestamp) / 60000));
    if (minutes < 2) return "Vừa cập nhật";
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    return new Date(timestamp).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function formatDateTime(value) {
    const timestamp = toTime(value);
    if (!timestamp) return "chưa đặt lịch";
    return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
  }

  function make(tag, className, text) {
    const node = global.document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function button(label, route, className = "") {
    const node = make("button", className, label);
    node.type = "button";
    node.dataset.hdcRoute = route;
    return node;
  }

  function buildDailyZone() {
    const zone = make("section", "hdc-daily", null);
    zone.dataset.hdcDaily = "";
    zone.setAttribute("aria-label", "Tổng quan ngày hôm nay");
    zone.innerHTML = [
      '<div class="hdc-identity"><span class="hdc-avatar" data-hdc-avatar></span><div><small data-hdc-period-label>DAILY COMMAND</small><strong data-hdc-greeting>Chào bạn</strong><span data-hdc-weather>Chưa có dữ liệu thời tiết</span></div></div>',
      '<div class="hdc-day"><div><span>Tiến độ ngày</span><b data-hdc-day-value>0%</b></div><i><span data-hdc-day-progress></span></i><small><b data-hdc-focus>0 phút</b> tập trung hôm nay</small></div>',
      '<div class="hdc-top-task"><small>ƯU TIÊN TIẾP THEO</small><strong data-hdc-task>Chưa có công việc</strong><span data-hdc-task-meta>Thêm task để bắt đầu ngày làm việc.</span></div>',
      '<div class="hdc-resume"><button type="button" data-hdc-resume>Tiếp tục công việc gần nhất <span aria-hidden="true">→</span></button><small data-hdc-resume-meta>Chưa có phiên gần đây</small></div>',
      '<div class="hdc-brief"><div><small>TÓM TẮT TỰ ĐỘNG · TRÊN THIẾT BỊ</small><strong>HH Morning Brief</strong></div><p data-hdc-summary></p><button type="button" data-hdc-ai-action></button></div>'
    ].join("");
    return zone;
  }

  function buildContinueZone() {
    const zone = make("section", "hdc-continue", null);
    zone.dataset.hdcContinue = "";
    zone.innerHTML = '<header><div><small>TIẾP TỤC CÔNG VIỆC</small><h3>Quay lại đúng nơi bạn đang làm</h3></div><span data-hdc-recent-count>0 hoạt động</span></header><div class="hdc-recent-grid" data-hdc-recent-list aria-live="polite"></div>';
    return zone;
  }

  function buildOperationsZone() {
    const zone = make("section", "hdc-operations", null);
    zone.dataset.hdcOperations = "";
    zone.setAttribute("aria-label", "Trung tâm điều hành hôm nay");
    zone.innerHTML = [
      '<header class="hdc-operations-head"><div><small>HOME OPERATIONS</small><h3>Hôm nay cần xử lý gì?</h3><p>Tổng hợp minh bạch từ dữ liệu đã lưu trên thiết bị. Không đọc mật khẩu, token hoặc nội dung riêng tư.</p></div><button type="button" data-hdc-refresh-operations>Làm mới dữ liệu</button></header>',
      '<div class="hdc-assistant" data-hdc-assistant aria-live="polite"></div>',
      '<div class="hdc-operations-grid">',
      '<section class="hdc-operation-card is-plan"><header><div><small>KẾ HOẠCH HÔM NAY</small><h4>Việc cần làm</h4></div><span data-hdc-plan-count>0 việc</span></header><div class="hdc-operation-list" data-hdc-plan></div><footer><button type="button" data-hdc-route="/work">Mở Công việc</button></footer></section>',
      '<section class="hdc-operation-card is-alert"><header><div><small>ƯU TIÊN</small><h4>Thông báo cần xem</h4></div><span data-hdc-notification-count>0 mới</span></header><div class="hdc-operation-list" data-hdc-notifications></div><footer><button type="button" data-hdc-route="/communication/notifications">Trung tâm thông báo</button></footer></section>',
      '<section class="hdc-operation-card is-risk"><header><div><small>PROJECT WATCH</small><h4>Dự án sắp trễ</h4></div><span data-hdc-project-count>0 rủi ro</span></header><div class="hdc-operation-list" data-hdc-projects></div><footer><button type="button" data-hdc-route="/work/project-center">Mở timeline</button></footer></section>',
      '<section class="hdc-operation-card is-quota"><header><div><small>API GUARD</small><h4>Hạn mức đã cấu hình</h4></div><span data-hdc-quota-count>Chưa có adapter</span></header><div class="hdc-operation-list" data-hdc-quotas></div><footer><button type="button" data-hdc-route="/create/providers">Provider Router</button></footer></section>',
      '<section class="hdc-operation-card is-youtube"><header><div><small>YOUTUBE CALENDAR</small><h4>Lịch phát sắp tới</h4></div><span data-hdc-youtube-count>0 lịch</span></header><div class="hdc-operation-list" data-hdc-youtube></div><footer><button type="button" data-hdc-route="/music-ai/youtube-publisher">Mở YouTube Publisher</button></footer></section>',
      '</div>',
      '<p class="hdc-operation-status" data-hdc-operation-status role="status" aria-live="polite"></p>'
    ].join("");
    return zone;
  }

  function emptyOperation(message, detail) {
    const empty = make("div", "hdc-operation-empty");
    empty.append(make("strong", "", message), make("span", "", detail));
    return empty;
  }

  function operationCopy(title, detail, meta) {
    const copy = make("div", "hdc-operation-copy");
    copy.append(make("strong", "", title), make("span", "", detail));
    if (meta) copy.append(make("small", "", meta));
    return copy;
  }

  function renderPlan(home, items) {
    const list = home.querySelector("[data-hdc-plan]");
    const count = home.querySelector("[data-hdc-plan-count]");
    if (!list || !count) return;
    list.replaceChildren();
    count.textContent = `${items.length} việc`;
    if (!items.length) return list.append(emptyOperation("Chưa có kế hoạch", "Task đã tạo sẽ xuất hiện ở đây; HH không tự dựng dữ liệu mẫu."));
    items.forEach((item) => {
      const row = make("article", `hdc-operation-row ${item.overdue ? "is-critical" : ""}`);
      const toggle = make("button", "hdc-task-toggle", item.completed ? "✓" : "");
      toggle.type = "button";
      toggle.dataset.hdcToggleTask = item.id;
      toggle.dataset.hdcTaskSource = item.source;
      toggle.setAttribute("aria-label", `Đánh dấu hoàn thành: ${item.title}`);
      toggle.setAttribute("aria-pressed", String(item.completed));
      row.append(toggle, operationCopy(item.title, item.overdue ? "Đã quá hạn" : item.due ? `Hạn ${formatDateTime(item.due)}` : "Chưa đặt hạn", cleanText(item.priority || "normal", 30)));
      const open = button("Mở", item.route, "hdc-inline-action");
      open.setAttribute("aria-label", `Mở ${item.title}`);
      row.append(open);
      list.append(row);
    });
  }

  function renderNotifications(home, items) {
    const list = home.querySelector("[data-hdc-notifications]");
    const count = home.querySelector("[data-hdc-notification-count]");
    if (!list || !count) return;
    list.replaceChildren();
    count.textContent = `${items.length} mới`;
    if (!items.length) return list.append(emptyOperation("Không có ưu tiên mới", "Chỉ hiển thị thông báo chưa đọc từ Communication."));
    items.forEach((item) => {
      const row = make("article", "hdc-operation-row");
      row.append(operationCopy(item.title, item.detail, item.priority));
      const action = make("button", "hdc-inline-action", "Đã xem");
      action.type = "button";
      action.dataset.hdcReadNotification = item.id;
      action.setAttribute("aria-label", `Đánh dấu đã xem: ${item.title}`);
      row.append(action);
      list.append(row);
    });
  }

  function renderProjects(home, items) {
    const list = home.querySelector("[data-hdc-projects]");
    const count = home.querySelector("[data-hdc-project-count]");
    if (!list || !count) return;
    list.replaceChildren();
    count.textContent = `${items.length} rủi ro`;
    if (!items.length) return list.append(emptyOperation("Không có dự án sắp trễ", "Dự án có deadline trong 7 ngày sẽ được theo dõi tại đây."));
    items.forEach((item) => {
      const row = make("button", `hdc-risk-row is-${item.risk}`);
      row.type = "button";
      row.dataset.hdcRoute = item.route;
      const status = item.days < 0 ? `Trễ ${Math.abs(item.days)} ngày` : item.days === 0 ? "Hạn hôm nay" : `Còn ${item.days} ngày`;
      row.append(operationCopy(item.title, status, `${item.progress}% hoàn thành`));
      const meter = make("i", "hdc-mini-meter");
      const fill = make("span");
      fill.style.width = `${item.progress}%`;
      meter.append(fill);
      row.append(meter);
      list.append(row);
    });
  }

  function renderQuotas(home, items) {
    const list = home.querySelector("[data-hdc-quotas]");
    const count = home.querySelector("[data-hdc-quota-count]");
    if (!list || !count) return;
    list.replaceChildren();
    count.textContent = items.length ? `${items.length} provider` : "Chưa có adapter";
    if (!items.length) return list.append(emptyOperation("Chưa có số liệu quota", "Cấu hình provider ở backend; Trang chủ không giả lập hạn mức."));
    items.forEach((item) => {
      const row = make("article", `hdc-quota-row is-${item.severity}`);
      const text = item.percent == null ? (item.configured ? "Không đặt hạn mức" : "Chưa cấu hình") : `${item.percent}% đã dùng`;
      row.append(operationCopy(item.label, text, item.status));
      const meter = make("i", "hdc-mini-meter");
      const fill = make("span");
      fill.style.width = `${item.percent || 0}%`;
      meter.append(fill);
      row.append(meter);
      list.append(row);
    });
  }

  function renderYouTube(home, items) {
    const list = home.querySelector("[data-hdc-youtube]");
    const count = home.querySelector("[data-hdc-youtube-count]");
    if (!list || !count) return;
    list.replaceChildren();
    count.textContent = `${items.length} lịch`;
    if (!items.length) return list.append(emptyOperation("Chưa có lịch phát", "Chỉ hiển thị lịch YouTube đã lưu hoặc đã xếp hàng thật."));
    items.forEach((item) => {
      const row = make("button", "hdc-schedule-row");
      row.type = "button";
      row.dataset.hdcRoute = item.route;
      row.append(operationCopy(item.title, formatDateTime(item.publishAt), item.status));
      row.append(make("span", "hdc-schedule-arrow", "→"));
      list.append(row);
    });
  }

  function renderAssistant(home, recommendation) {
    const holder = home.querySelector("[data-hdc-assistant]");
    if (!holder || !recommendation) return;
    holder.replaceChildren();
    const mark = make("span", "hdc-assistant-mark", "HH");
    mark.setAttribute("aria-hidden", "true");
    const copy = make("div", "hdc-assistant-copy");
    copy.append(make("small", "", recommendation.eyebrow), make("h4", "", recommendation.title), make("p", "", recommendation.detail));
    const action = button(recommendation.label, recommendation.route, "hdc-assistant-action");
    action.dataset.hdcRecommendation = recommendation.id;
    holder.append(mark, copy, action);
  }

  function renderOperations(home, snapshot) {
    if (!home.querySelector("[data-hdc-operations]")) return;
    renderAssistant(home, snapshot.recommendation);
    renderPlan(home, snapshot.plan);
    renderNotifications(home, snapshot.notifications);
    renderProjects(home, snapshot.projects);
    renderQuotas(home, snapshot.quotas);
    renderYouTube(home, snapshot.youtube);
  }

  function renderAvatar(zone, account) {
    const holder = zone.querySelector("[data-hdc-avatar]");
    holder.replaceChildren();
    const imageSource = safeImage(account.avatar);
    if (imageSource) {
      const image = make("img");
      image.src = imageSource;
      image.alt = `Ảnh đại diện của ${cleanText(account.name || "người dùng", 60)}`;
      image.width = 44;
      image.height = 44;
      holder.append(image);
    } else holder.textContent = initials(account.name || account.nickname);
  }

  function renderRecent(home, items) {
    const list = home.querySelector("[data-hdc-recent-list]");
    const count = home.querySelector("[data-hdc-recent-count]");
    if (!list || !count) return;
    list.replaceChildren();
    count.textContent = `${items.length} hoạt động`;
    if (!items.length) {
      const empty = make("div", "hdc-empty");
      empty.innerHTML = '<span aria-hidden="true">＋</span><div><strong>Chưa có công việc gần đây</strong><p>Mở một dự án, bài học hoặc trình biên tập; HH sẽ ghi nhớ trên thiết bị này.</p></div>';
      empty.append(button("Khám phá workspace", "/home", "hdc-secondary"));
      list.append(empty);
      return;
    }
    items.forEach((item) => {
      const article = make("article", `hdc-recent-card is-${item.meta.tone}`);
      const icon = make("span", "hdc-recent-icon", item.meta.icon);
      icon.setAttribute("aria-hidden", "true");
      const copy = make("div", "hdc-recent-copy");
      copy.append(make("small", "", item.meta.label), make("strong", "", item.title), make("p", "", item.detail), make("time", "", formatRelative(item.timestamp)));
      article.append(icon, copy, button("Mở tiếp", item.route, "hdc-open"));
      list.append(article);
    });
  }

  function refresh(home = global.document?.querySelector(SELECTORS.home)) {
    if (!home) return false;
    const zone = home.querySelector("[data-hdc-daily]");
    if (!zone) return mount(home);
    const storage = global.localStorage;
    const now = new Date();
    const period = periodFor(now);
    const account = read(storage, KEYS.account, {});
    const name = cleanText(account.name || account.nickname || "bạn", 60);
    const task = topTask(storage, now.getTime());
    const recent = collectRecentWork(storage);
    const progress = dayProgress(now);
    const consent = read(storage, KEYS.aiConsent, false) === true;

    home.dataset.hdcPeriod = period.id;
    renderAvatar(zone, account);
    zone.querySelector("[data-hdc-greeting]").textContent = `${period.greeting}, ${name}`;
    zone.querySelector("[data-hdc-period-label]").textContent = `${now.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" })} · DAILY COMMAND`;
    zone.querySelector("[data-hdc-weather]").textContent = weatherText(storage);
    zone.querySelector("[data-hdc-day-value]").textContent = `${progress}%`;
    zone.querySelector("[data-hdc-day-progress]").style.width = `${progress}%`;
    zone.querySelector("[data-hdc-focus]").textContent = `${focusMinutes(storage, now)} phút`;
    zone.querySelector("[data-hdc-task]").textContent = task ? cleanText(task.title, 100) : "Chưa có công việc ưu tiên";
    zone.querySelector("[data-hdc-task-meta]").textContent = task ? `${cleanText(task.category || "Công việc", 40)}${task.deadline ? ` · hạn ${cleanText(task.deadline, 20)}` : ""}` : "Thêm task trong Command Center để bắt đầu.";
    zone.querySelector("[data-hdc-resume-meta]").textContent = recent[0] ? `${recent[0].meta.label} · ${recent[0].title}` : "Chưa có phiên gần đây";
    zone.querySelector("[data-hdc-resume]").dataset.hdcRoute = recent[0]?.route || "/home";

    const summary = zone.querySelector("[data-hdc-summary]");
    const action = zone.querySelector("[data-hdc-ai-action]");
    summary.textContent = consent ? automatedSummary(storage, now.getTime()) : "Tóm tắt tự động đang tắt. Cho phép HH tổng hợp task, deadline, thông báo và lịch ôn ngay trên thiết bị này.";
    action.textContent = consent ? "Làm mới" : "Cho phép tóm tắt cục bộ";
    action.dataset.hdcAiAction = consent ? "refresh" : "consent";
    renderRecent(home, recent);
    renderOperations(home, collectOperations(storage, now.getTime()));
    state.lastHome = home;
    return true;
  }

  function mount(home = global.document?.querySelector(SELECTORS.home)) {
    if (!home) return false;
    const hero = home.querySelector(SELECTORS.hero);
    if (!hero) return false;
    home.classList.add("hdc-home-enhanced");
    if (!hero.querySelector("[data-hdc-daily]")) hero.append(buildDailyZone());
    if (!home.querySelector("[data-hdc-continue]")) hero.insertAdjacentElement("afterend", buildContinueZone());
    if (!home.querySelector("[data-hdc-operations]")) home.querySelector("[data-hdc-continue]").insertAdjacentElement("afterend", buildOperationsZone());
    bindHome(home);
    return refresh(home);
  }

  function navigate(route) {
    if (!/^\/[a-z0-9/_-]+$/i.test(route || "")) return;
    global.location.hash = `#${route}`;
  }

  function operationState(storage = global.localStorage) {
    const value = read(storage, KEYS.operations, {});
    return {
      version: 3,
      lastAction: cleanText(value.lastAction, 80),
      lastActionAt: cleanText(value.lastActionAt, 40),
      refreshCount: clamp(value.refreshCount, 0, 100000)
    };
  }

  function recordOperation(action, storage = global.localStorage) {
    const current = operationState(storage);
    return write(storage, KEYS.operations, { ...current, version: 3, lastAction: cleanText(action, 80), lastActionAt: new Date().toISOString() });
  }

  function togglePlanItem(storage, source, id) {
    if (source === "command") {
      const items = asArray(read(storage, KEYS.todos, []));
      let changed = false;
      const next = items.map((item, index) => {
        const itemId = cleanText(item && (item.id || `command-${index}`), 100);
        if (itemId !== id) return item;
        changed = true;
        return { ...item, completed: !item.completed, completedAt: item.completed ? "" : new Date().toISOString() };
      });
      return changed && write(storage, KEYS.todos, next);
    }
    if (source === "project") {
      const projectState = read(storage, KEYS.projects, {});
      let changed = false;
      projectState.tasks = asArray(projectState.tasks).map((item, index) => {
        const itemId = cleanText(item && (item.id || `project-${index}`), 100);
        if (itemId !== id) return item;
        changed = true;
        const completed = item.completed || item.column === "done" || item.status === "done";
        return { ...item, completed: !completed, column: completed ? "todo" : "done", updatedAt: new Date().toISOString() };
      });
      if (changed) projectState.updatedAt = new Date().toISOString();
      return changed && write(storage, KEYS.projects, projectState);
    }
    return false;
  }

  function markNotificationRead(storage, id) {
    const communication = read(storage, KEYS.communication, {});
    let changed = false;
    communication.notifications = asArray(communication.notifications).map((item, index) => {
      const itemId = cleanText(item && (item.id || `notification-${index}`), 100);
      if (itemId !== id) return item;
      changed = true;
      return { ...item, read: true, readAt: new Date().toISOString() };
    });
    if (changed) communication.updatedAt = new Date().toISOString();
    return changed && write(storage, KEYS.communication, communication);
  }

  function announce(home, message) {
    const node = home.querySelector("[data-hdc-operation-status]");
    if (node) node.textContent = message;
  }

  function bindHome(home) {
    if (home.dataset.hdcBound === "true") return;
    home.dataset.hdcBound = "true";
    home.addEventListener("click", (event) => {
      const routeButton = event.target.closest("[data-hdc-route]");
      if (routeButton) {
        event.preventDefault();
        if (routeButton.dataset.hdcRecommendation) recordOperation(`recommendation:${routeButton.dataset.hdcRecommendation}`);
        navigate(routeButton.dataset.hdcRoute);
        return;
      }
      const taskButton = event.target.closest("[data-hdc-toggle-task]");
      if (taskButton) {
        const changed = togglePlanItem(global.localStorage, taskButton.dataset.hdcTaskSource, taskButton.dataset.hdcToggleTask);
        recordOperation(changed ? "task-completed" : "task-not-found");
        refresh(home);
        announce(home, changed ? "Đã cập nhật công việc trong nguồn dữ liệu gốc." : "Không tìm thấy công việc để cập nhật.");
        return;
      }
      const notificationButton = event.target.closest("[data-hdc-read-notification]");
      if (notificationButton) {
        const changed = markNotificationRead(global.localStorage, notificationButton.dataset.hdcReadNotification);
        recordOperation(changed ? "notification-read" : "notification-not-found");
        refresh(home);
        announce(home, changed ? "Đã đánh dấu thông báo là đã xem." : "Không tìm thấy thông báo để cập nhật.");
        return;
      }
      if (event.target.closest("[data-hdc-refresh-operations]")) {
        const current = operationState(global.localStorage);
        write(global.localStorage, KEYS.operations, { ...current, version: 3, refreshCount: current.refreshCount + 1, lastAction: "manual-refresh", lastActionAt: new Date().toISOString() });
        refresh(home);
        announce(home, "Đã đọc lại dữ liệu cục bộ mới nhất.");
        return;
      }
      const aiButton = event.target.closest("[data-hdc-ai-action]");
      if (!aiButton) return;
      if (aiButton.dataset.hdcAiAction === "consent") write(global.localStorage, KEYS.aiConsent, true);
      refresh(home);
    });
  }

  function scheduleMount() {
    global.clearTimeout(state.timer);
    state.timer = global.setTimeout(() => mount(), 0);
  }

  function start() {
    if (state.started || !global.document) return;
    state.started = true;
    if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", scheduleMount, { once: true });
    else scheduleMount();
    global.addEventListener?.("hashchange", scheduleMount);
    global.addEventListener?.("pageshow", scheduleMount);
    global.addEventListener?.("hh:auth-change", scheduleMount);
    global.addEventListener?.("storage", (event) => {
      if (!event.key || Object.values(KEYS).includes(event.key)) refresh();
    });
    global.setInterval?.(() => {
      const home = global.document.querySelector(SELECTORS.home);
      if (home && home.isConnected) refresh(home);
    }, 60000);
  }

  return Object.freeze({
    start,
    mount,
    refresh,
    collectRecentWork,
    automatedSummary,
    collectTodayPlan,
    collectPriorityNotifications,
    collectAtRiskProjects,
    collectApiQuotas,
    collectYouTubeSchedule,
    collectOperations,
    recommendNextAction,
    togglePlanItem,
    markNotificationRead,
    cleanText,
    periodFor,
    dayProgress,
    keys: KEYS
  });
});
