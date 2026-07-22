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
    aiConsent: "hh.home-daily.ai-consent.v1"
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
    bindHome(home);
    return refresh(home);
  }

  function navigate(route) {
    if (!/^\/[a-z0-9/_-]+$/i.test(route || "")) return;
    global.location.hash = `#${route}`;
  }

  function bindHome(home) {
    if (home.dataset.hdcBound === "true") return;
    home.dataset.hdcBound = "true";
    home.addEventListener("click", (event) => {
      const routeButton = event.target.closest("[data-hdc-route]");
      if (routeButton) {
        event.preventDefault();
        navigate(routeButton.dataset.hdcRoute);
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
    cleanText,
    periodFor,
    dayProgress,
    keys: KEYS
  });
});
