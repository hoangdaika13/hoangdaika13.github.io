(function (global, factory) {
  "use strict";
  const api = factory(global || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (global) global.HHHomeGalaxyMission = api;
  if (global?.document) api.autoMount();
})(typeof globalThis !== "undefined" ? globalThis : this, function createHomeGalaxyMission(global) {
  "use strict";

  const VERSION = "2.0.0";
  const PREF_KEY = "hh.home.galaxy.preferences.v2";
  const LEGACY_PREF_KEY = "hh.home.galaxy.preferences.v1";
  const ACTIVITY_KEY = "hh.home.galaxy.activity.v2";
  const SYNC_META_KEY = "hh.home.galaxy.sync.v1";
  const TODO_KEY = "hh.command-center.todos.v2";
  const EVENT_KEY = "hh.command-center.events.v1";
  const NOTE_KEY = "hh.dashboard.sticky-notes.v1";
  const FILE_KEY = "hh.command-center.files.v1";
  const PROJECT_KEY = "hh-project-center";
  const AI_KEY = "hh-ai-center-advanced-v1";
  const CREATIVE_KEY = "hh.creative-os.v1";
  const MEDIA_PAGE_KEY = "hh.media-design.page.v1";
  const COMMUNICATION_KEY = "hh.communication.intelligence.v1";
  const LEARNING_KEY = "hh.learning.os.v1";
  const ANALYTICS_KEY = "hh.insights.analytics.v3";
  const SYSTEM_KEY = "hh.system.center.v1";
  const RECENT_KEY = "hh.app-shell.recent";
  const WEATHER_KEY = "hh.dashboard.weather.v2";
  const ORCHESTRATOR_KEY = "hh.platform.orchestrator.v2";
  const MAX_ACTIVITY = 80;
  const MAX_WIDGETS = 10;
  const instances = new WeakMap();

  const PLANETS = Object.freeze([
    { id: "creative", icon: "✦", label: "AI & Sáng tạo", route: "/create", color: "#ff59d6" },
    { id: "work", icon: "□", label: "Công việc", route: "/work", color: "#baff62" },
    { id: "media", icon: "◈", label: "Media & Design", route: "/media-design", color: "#a986ff" },
    { id: "dev", icon: "⌘", label: "DEV", route: "/dev-tools", color: "#58f3ff" },
    { id: "communication", icon: "◌", label: "Giao tiếp", route: "/communication", color: "#67efbd" },
    { id: "learning", icon: "◫", label: "Học tập", route: "/learn", color: "#ffbd5a" },
    { id: "analytics", icon: "↗", label: "Phân tích", route: "/analytics", color: "#ff7f9d" },
    { id: "system", icon: "⚙", label: "Hệ thống", route: "/settings", color: "#7ea8ff" }
  ]);

  const WIDGETS = Object.freeze([
    { id: "weather", icon: "◒", label: "Thời tiết & AQI", color: "#58f3ff" },
    { id: "performance", icon: "⌁", label: "FPS & độ trễ tab", color: "#ff59d6" },
    { id: "vitals", icon: "V", label: "Core Web Vitals", color: "#a986ff" },
    { id: "resources", icon: "R", label: "Request & tài nguyên", color: "#ffbd5a" },
    { id: "api", icon: "↯", label: "API Health", color: "#67efbd" },
    { id: "services", icon: "S", label: "Dịch vụ backend", color: "#baff62" },
    { id: "storage", icon: "◇", label: "Bộ nhớ website", color: "#9d8cff" },
    { id: "pwa", icon: "P", label: "PWA & cache", color: "#7ea8ff" },
    { id: "network", icon: "↗", label: "Mạng trực tiếp", color: "#58efc1" },
    { id: "sync", icon: "◷", label: "Đồng bộ gần nhất", color: "#ffb956" }
  ]);

  const ACTIONS = Object.freeze([
    { id: "task", icon: "+", label: "Tạo task" },
    { id: "ai", icon: "✦", label: "Mở AI Center" },
    { id: "asset", icon: "⇧", label: "Tải asset" },
    { id: "note", icon: "N", label: "Tạo ghi chú" },
    { id: "recent", icon: "◷", label: "Tiếp tục gần nhất" },
    { id: "health", icon: "↻", label: "Kiểm tra Health" },
    { id: "search", icon: "⌕", label: "Tìm toàn hệ thống" },
    { id: "focus", icon: "◎", label: "Tập trung 25 phút" }
  ]);

  const DEFAULT_PREFS = Object.freeze({
    version: 2,
    theme: "neon",
    motion: "balanced",
    stars: 64,
    sound: false,
    hideUnsupported: false,
    defaultPlanet: "creative",
    planetOrder: PLANETS.map((item) => item.id),
    widgetOrder: WIDGETS.map((item) => item.id),
    widgets: WIDGETS.map((item) => item.id),
    widgetSizes: Object.fromEntries(WIDGETS.map((item) => [item.id, "medium"])),
    pinnedActions: ["task", "ai", "note", "search"],
    updatedAt: 0
  });

  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[character]));
  const cleanText = (value, limit = 240) => String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
  const asArray = (value) => Array.isArray(value) ? value : [];
  const uid = (prefix = "item") => `${prefix}-${global.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`;
  const nowIso = () => new Date().toISOString();
  const dateValue = (value) => {
    const time = new Date(value || 0).getTime();
    return Number.isFinite(time) ? time : 0;
  };
  const dayKey = (value = Date.now()) => new Date(value).toISOString().slice(0, 10);
  const relativeTime = (value) => {
    const elapsed = Math.max(0, Date.now() - dateValue(value));
    if (elapsed < 60_000) return "Vừa xong";
    if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} phút trước`;
    if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} giờ trước`;
    return new Date(value).toLocaleDateString("vi-VN");
  };
  const formatBytes = (value) => {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes < 0) return "Không hỗ trợ";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let amount = bytes;
    let index = 0;
    while (amount >= 1024 && index < units.length - 1) { amount /= 1024; index += 1; }
    return `${amount >= 100 || index === 0 ? Math.round(amount) : amount.toFixed(1)} ${units[index]}`;
  };
  const formatMetricMs = (value) => Number.isFinite(Number(value)) ? `${Math.round(Number(value))} ms` : "Chưa đo";
  const bytesOf = (value) => {
    try { return new TextEncoder().encode(typeof value === "string" ? value : JSON.stringify(value)).byteLength; }
    catch { return String(value ?? "").length * 2; }
  };

  function readJson(key, fallback, storage = global.localStorage) {
    try {
      const raw = storage?.getItem?.(key);
      return raw == null || raw === "" ? fallback : (JSON.parse(raw) ?? fallback);
    } catch { return fallback; }
  }

  function writeJson(key, value, storage = global.localStorage) {
    try { storage?.setItem?.(key, JSON.stringify(value)); return true; }
    catch { return false; }
  }

  function safeOrder(value, catalog, fallback) {
    const allowed = new Set(catalog.map((item) => item.id));
    const current = asArray(value).filter((id) => allowed.has(id));
    return [...new Set([...current, ...fallback.filter((id) => allowed.has(id))])];
  }

  function normalizePrefs(raw = {}) {
    const legacy = raw && typeof raw === "object" ? raw : {};
    const validSize = (value) => ["small", "medium", "large"].includes(value) ? value : "medium";
    const allowedWidgets = new Set(WIDGETS.map((item) => item.id));
    const allowedActions = new Set(ACTIONS.map((item) => item.id));
    const widgetSizes = {};
    WIDGETS.forEach((widget) => { widgetSizes[widget.id] = validSize(legacy.widgetSizes?.[widget.id]); });
    return {
      version: 2,
      theme: ["neon", "purple", "solar", "deep"].includes(legacy.theme) ? legacy.theme : DEFAULT_PREFS.theme,
      motion: ["static", "balanced", "cinematic"].includes(legacy.motion) ? legacy.motion : DEFAULT_PREFS.motion,
      stars: clamp(legacy.stars ?? DEFAULT_PREFS.stars, 20, 100),
      sound: legacy.sound === true,
      hideUnsupported: legacy.hideUnsupported === true,
      defaultPlanet: PLANETS.some((item) => item.id === legacy.defaultPlanet) ? legacy.defaultPlanet : DEFAULT_PREFS.defaultPlanet,
      planetOrder: safeOrder(legacy.planetOrder || legacy.planets, PLANETS, DEFAULT_PREFS.planetOrder),
      widgetOrder: safeOrder(legacy.widgetOrder || legacy.widgets, WIDGETS, DEFAULT_PREFS.widgetOrder),
      widgets: Array.isArray(legacy.widgets)
        ? [...new Set(legacy.widgets.filter((id) => allowedWidgets.has(id)))]
        : [...DEFAULT_PREFS.widgets],
      widgetSizes,
      pinnedActions: Array.isArray(legacy.pinnedActions)
        ? [...new Set(legacy.pinnedActions.filter((id) => allowedActions.has(id)))].slice(0, 4)
        : [...DEFAULT_PREFS.pinnedActions],
      updatedAt: Math.max(0, Number(legacy.updatedAt) || 0)
    };
  }

  function readPrefs() {
    const current = readJson(PREF_KEY, null);
    if (current) return normalizePrefs(current);
    const legacy = readJson(LEGACY_PREF_KEY, {});
    const legacyWidgetIds = new Set(["weather", "performance", "memory", "network", "health", "sync"]);
    const newlyIntroduced = WIDGETS.map((item) => item.id).filter((id) => !legacyWidgetIds.has(id));
    const migrated = normalizePrefs({
      ...legacy,
      widgets: [...asArray(legacy.widgets), ...newlyIntroduced]
    });
    writeJson(PREF_KEY, migrated);
    return migrated;
  }

  function savePrefs(instance, options = {}) {
    instance.prefs = normalizePrefs({ ...instance.prefs, updatedAt: options.keepTimestamp ? instance.prefs.updatedAt : Date.now() });
    writeJson(PREF_KEY, instance.prefs);
    applyPreferenceState(instance);
    if (!options.silent) announce(instance, "Đã lưu cấu hình Galaxy trên thiết bị.", "success");
    if (options.sync !== false && isSignedIn()) scheduleAccountSync(instance, "push");
  }

  function currentUser() {
    const user = readJson("hh-auth-user", {});
    return user && typeof user === "object" ? user : {};
  }

  function isSignedIn() {
    const user = currentUser();
    const token = global.HHAuthSession?.token?.();
    return Boolean(token || user.email || (user.id && user.guest !== true && user.role !== "guest"));
  }

  function apiHeaders() {
    const token = global.HHAuthSession?.token?.() || "";
    return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  }

  function navigate(route) {
    if (!/^\/[a-z0-9/_-]+$/i.test(String(route || ""))) return;
    global.location.hash = `#${route}`;
  }

  function emitEvent(name, payload = {}) {
    try {
      if (global.HHEventBus?.emit) global.HHEventBus.emit(name, payload);
      else global.dispatchEvent?.(new CustomEvent("hh:event", { detail: { eventName: name, payload, meta: { name, timestamp: Date.now() } } }));
    } catch {}
  }

  function readActivity() {
    const value = readJson(ACTIVITY_KEY, []);
    return asArray(value).filter((item) => item && PLANETS.some((planet) => planet.id === item.planet)).slice(0, MAX_ACTIVITY);
  }

  function saveActivity(items) {
    writeJson(ACTIVITY_KEY, asArray(items).slice(0, MAX_ACTIVITY));
  }

  function activityForPlanet(planet) {
    return PLANETS.find((item) => item.id === planet) || PLANETS[7];
  }

  function addActivity(instance, input = {}, effects = true) {
    const planet = activityForPlanet(input.planet);
    const text = cleanText(input.text, 180);
    if (!text) return null;
    const signature = cleanText(input.signature || `${input.type || "update"}:${planet.id}:${text}`, 260);
    const existing = instance.activities.find((item) => item.signature === signature && Date.now() - dateValue(item.createdAt) < 90_000);
    if (existing) return existing;
    const item = {
      id: uid("activity"),
      type: cleanText(input.type || "update", 60),
      planet: planet.id,
      text,
      route: /^\/[a-z0-9/_-]+$/i.test(String(input.route || "")) ? input.route : planet.route,
      source: cleanText(input.source || "HH Event Bus", 80),
      createdAt: input.createdAt || nowIso(),
      read: input.read === true,
      signature
    };
    instance.activities = [item, ...instance.activities].slice(0, MAX_ACTIVITY);
    saveActivity(instance.activities);
    renderActivity(instance);
    renderPlanets(instance);
    if (effects && !item.read) {
      showComet(instance, item);
      if (item.type === "task-completed") showBurst(instance, "work");
      if (item.type === "deployment-ready") setAurora(instance, "ready");
      if (item.type === "deployment-failed") setAurora(instance, "failed");
    }
    return item;
  }

  function markPlanetRead(instance, planetId) {
    let changed = false;
    instance.activities = instance.activities.map((item) => {
      if (item.planet !== planetId || item.read) return item;
      changed = true;
      return { ...item, read: true };
    });
    if (changed) saveActivity(instance.activities);
  }

  function period() {
    const hour = new Date().getHours();
    if (hour < 5) return { id: "night", greeting: "Chào đêm muộn" };
    if (hour < 11) return { id: "morning", greeting: "Chào buổi sáng" };
    if (hour < 14) return { id: "noon", greeting: "Chào buổi trưa" };
    if (hour < 18) return { id: "afternoon", greeting: "Chào buổi chiều" };
    return { id: "evening", greeting: "Chào buổi tối" };
  }

  function userName() {
    const user = currentUser();
    return cleanText(user.name || user.nickname || "Khách HH", 60);
  }

  function localStorageBytes() {
    try {
      let total = 0;
      for (let index = 0; index < global.localStorage.length; index += 1) {
        const key = global.localStorage.key(index);
        if (key) total += bytesOf(key) + bytesOf(global.localStorage.getItem(key) || "");
      }
      return total;
    } catch { return null; }
  }

  function newestTimestamp(values) {
    return Math.max(0, ...values.flatMap((value) => {
      if (Array.isArray(value)) return value.map((item) => dateValue(item?.updatedAt || item?.createdAt || item?.time));
      return [dateValue(value?.updatedAt || value?.createdAt || value?.time)];
    }));
  }

  function projectProgress(projectState) {
    const projects = asArray(projectState?.projects);
    if (!projects.length) return null;
    const values = projects.map((item) => Number(item?.progress)).filter(Number.isFinite);
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  }

  function countDeepAssets(value, depth = 0) {
    if (depth > 4 || value == null) return { count: 0, bytes: 0 };
    if (Array.isArray(value)) return value.reduce((total, item) => {
      const next = countDeepAssets(item, depth + 1);
      return { count: total.count + next.count, bytes: total.bytes + next.bytes };
    }, { count: 0, bytes: 0 });
    if (typeof value !== "object") return { count: 0, bytes: 0 };
    let count = 0;
    let bytes = 0;
    Object.entries(value).forEach(([key, item]) => {
      if (/assets?|files?|media/i.test(key) && Array.isArray(item)) {
        count += item.length;
        bytes += item.reduce((sum, asset) => sum + Math.max(0, Number(asset?.size) || 0), 0);
      } else {
        const next = countDeepAssets(item, depth + 1);
        count += next.count;
        bytes += next.bytes;
      }
    });
    return { count, bytes };
  }

  function collectPlanetData(instance) {
    const now = Date.now();
    const today = dayKey(now);
    const ai = readJson(AI_KEY, {});
    const creative = readJson(CREATIVE_KEY, {});
    const todos = asArray(readJson(TODO_KEY, []));
    const projects = readJson(PROJECT_KEY, {});
    const files = asArray(readJson(FILE_KEY, []));
    const mediaPage = readJson(MEDIA_PAGE_KEY, {});
    const communication = readJson(COMMUNICATION_KEY, {});
    const events = asArray(readJson(EVENT_KEY, []));
    const learning = readJson(LEARNING_KEY, {});
    const analytics = readJson(ANALYTICS_KEY, {});
    const system = readJson(SYSTEM_KEY, {});
    const orchestrator = readJson(ORCHESTRATOR_KEY, {});

    const aiRuns = asArray(ai.runs);
    const aiVersions = aiRuns.flatMap((run) => asArray(run?.versions));
    const creativeProjects = asArray(creative.projects);
    const drafts = creativeProjects.reduce((sum, project) => {
      const scripts = asArray(project?.scripts).filter((item) => item?.status === "draft").length;
      const publishing = asArray(project?.publishing).filter((item) => item?.status === "draft").length;
      return sum + scripts + publishing;
    }, 0);
    const recentAi = aiVersions.filter((version) => version?.status === "success" && now - dateValue(version.createdAt) <= 7 * 86_400_000).length;
    const runningAi = aiVersions.filter((version) => ["queued", "running"].includes(version?.status)).length
      + asArray(orchestrator.jobs).filter((job) => /ai|gemini|creative/i.test(`${job?.type} ${job?.name}`) && ["queued", "running"].includes(job?.state || job?.status)).length;

    const activeTasks = todos.filter((item) => item && !item.completed && item.status !== "done" && item.column !== "done");
    const todayTasks = activeTasks.filter((item) => String(item.deadline || item.due || "").slice(0, 10) === today).length;
    const overdue = activeTasks.filter((item) => {
      const due = String(item.deadline || item.due || "").slice(0, 10);
      return due && due < today;
    }).length;
    const progress = projectProgress(projects);

    const creativeAssets = countDeepAssets(creative);
    const fileBytes = files.reduce((sum, item) => sum + Math.max(0, Number(item?.size) || 0), 0);
    const latestFile = [...files].sort((a, b) => dateValue(b.modified || b.updatedAt) - dateValue(a.modified || a.updatedAt))[0];
    const mediaCount = creativeAssets.count + files.length;
    const mediaBytes = creativeAssets.bytes + fileBytes;
    const recentMedia = cleanText(mediaPage.active || latestFile?.name || creativeProjects[0]?.name || "", 90);

    const health = instance.health || {};
    const healthServices = health.payload?.health || {};
    const devErrors = asArray(orchestrator.errors).length
      + asArray(orchestrator.jobs).filter((job) => ["failed", "error"].includes(job?.state || job?.status)).length;
    const apiOnline = Number(instance.healthEndpoints?.reachable || 0);
    const apiTotal = Number(instance.healthEndpoints?.total || 0);
    const gitLabel = instance.git?.sha ? `main · ${instance.git.sha}` : "Chưa đọc GitHub";
    const deployLabel = instance.deployment?.ok === true ? "Production online" : instance.deployment?.ok === false ? "Production lỗi" : "Đang kiểm tra";

    const notifications = asArray(communication.notifications);
    const unread = notifications.filter((item) => item && !item.read && (!item.snoozedUntil || Number(item.snoozedUntil) < now)).length;
    const upcoming = events.filter((item) => {
      const time = dateValue(item.date || item.startAt || item.createdAt);
      return time >= now && time <= now + 7 * 86_400_000;
    }).length;
    const realtimeConnected = Boolean(global.HHRealtimeSocket?.connected || global.HHCalls?.available?.());

    const reviews = asArray(learning.reviews);
    const dueReviews = reviews.filter((item) => dateValue(item?.dueAt) <= now && !item?.completed).length;
    const lesson = cleanText(learning.activeLessonId || "", 90);
    const streak = Math.max(0, Number(learning.streak?.count) || 0);

    const analyticsEvents = asArray(analytics.events);
    const pageViews = analyticsEvents.filter((item) => item?.type === "page_view").length;
    const vitalValues = instance.vitals || {};
    const poorVitals = Object.values(vitalValues).filter((item) => item?.rating === "poor").length;
    const slowEndpoint = Number(instance.healthEndpoints?.slowest?.latency || 0);

    const pwa = Boolean(global.navigator?.serviceWorker?.controller);
    const permissionValues = Object.values(instance.permissions || {});
    const grantedPermissions = permissionValues.filter((value) => value === "granted").length;
    const systemUsage = instance.storage?.usage;
    const cacheVersion = instance.pwa?.cacheNames?.[0] || "Chưa có cache";

    const dataset = {
      creative: {
        status: runningAi ? `${runningAi} tác vụ đang chạy` : drafts || aiRuns.length ? "Workspace có dữ liệu" : "Chưa có hoạt động",
        metrics: [
          ["Bản nháp", drafts || "0"],
          ["AI run 7 ngày", recentAi || "0"],
          ["Đang xử lý", runningAi || "0"]
        ],
        detail: aiRuns.length || creativeProjects.length ? `${aiRuns.length} AI run và ${creativeProjects.length} dự án sáng tạo được lưu thật trên thiết bị.` : "Chưa có AI run hoặc dự án sáng tạo được lưu.",
        alert: runningAi > 0,
        updatedAt: newestTimestamp([aiRuns, creativeProjects])
      },
      work: {
        status: overdue ? `${overdue} task quá hạn` : activeTasks.length ? `${activeTasks.length} task đang mở` : "Chưa có hoạt động",
        metrics: [
          ["Hôm nay", todayTasks || "0"],
          ["Quá hạn", overdue || "0"],
          ["Tiến độ dự án", progress == null ? "Chưa có" : `${progress}%`]
        ],
        detail: activeTasks.length ? `Có ${activeTasks.length} task chưa hoàn thành trong Todo Workspace.` : "Todo Workspace chưa có task đang mở.",
        alert: overdue > 0,
        updatedAt: newestTimestamp([todos, asArray(projects.projects)])
      },
      media: {
        status: mediaCount ? `${mediaCount} asset đã lập chỉ mục` : "Chưa có hoạt động",
        metrics: [
          ["Gần nhất", recentMedia || "Chưa có"],
          ["Asset", mediaCount || "0"],
          ["Dung lượng", mediaBytes ? formatBytes(mediaBytes) : "Chưa có"]
        ],
        detail: mediaCount ? "Số liệu lấy từ Creative OS và Recent Files; chỉ metadata/dung lượng thật được cộng." : "Chưa có asset hoặc dự án media được lưu.",
        alert: false,
        updatedAt: newestTimestamp([files, creativeProjects])
      },
      dev: {
        status: instance.deployment?.ok === false ? "Production cần chú ý" : apiTotal ? `${apiOnline}/${apiTotal} endpoint hoạt động` : "Đang kiểm tra backend",
        metrics: [
          ["API", apiTotal ? `${apiOnline}/${apiTotal}` : "Chưa đo"],
          ["Lỗi gần đây", devErrors || "0"],
          ["Git", gitLabel]
        ],
        detail: `${deployLabel}. ${healthServices.database?.connected ? "MongoDB đã xác nhận kết nối." : "MongoDB chưa xác nhận kết nối."}`,
        alert: devErrors > 0 || instance.deployment?.ok === false,
        updatedAt: Math.max(dateValue(instance.git?.date), dateValue(health.checkedAt))
      },
      communication: {
        status: unread ? `${unread} tin chưa đọc` : realtimeConnected ? "Realtime đang kết nối" : notifications.length ? "Không có tin mới" : "Chưa có hoạt động",
        metrics: [
          ["Chưa đọc", unread || "0"],
          ["Sự kiện 7 ngày", upcoming || "0"],
          ["Cuộc gọi", realtimeConnected ? "Sẵn sàng" : "Chưa kết nối"]
        ],
        detail: notifications.length ? `${notifications.length} thông báo trong Communication Intelligence.` : "Chưa có thông báo được lưu.",
        alert: false,
        updatedAt: newestTimestamp([notifications, events])
      },
      learning: {
        status: lesson ? `Đang học ${lesson}` : reviews.length || streak ? "Đã có tiến trình học" : "Chưa có hoạt động",
        metrics: [
          ["Bài hiện tại", lesson || "Chưa chọn"],
          ["Chuỗi ngày", streak ? `${streak} ngày` : "0"],
          ["Cần ôn", dueReviews || "0"]
        ],
        detail: lesson || reviews.length ? "Tiến trình lấy trực tiếp từ Learning OS trên thiết bị." : "Learning OS chưa có bài học hoặc lịch ôn.",
        alert: dueReviews > 0,
        updatedAt: dateValue(learning.updatedAt)
      },
      analytics: {
        status: poorVitals || slowEndpoint > 1200 ? "Có tín hiệu hiệu suất cần xem" : pageViews || Object.keys(vitalValues).length ? "Đang đo phiên này" : "Chưa có hoạt động",
        metrics: [
          ["Page view đã lưu", pageViews || "0"],
          ["Web Vitals", Object.keys(vitalValues).length ? `${Object.keys(vitalValues).length}/5` : "Chưa đo"],
          ["Endpoint chậm", slowEndpoint ? formatMetricMs(slowEndpoint) : "Chưa đo"]
        ],
        detail: analyticsEvents.length ? "Chỉ hiển thị analytics đã được lưu sau khi người dùng đồng ý." : "Chưa có analytics được phép lưu; Web Vitals phiên hiện tại vẫn được đo cục bộ.",
        alert: poorVitals > 0 || slowEndpoint > 1200,
        updatedAt: newestTimestamp([analyticsEvents, Object.values(vitalValues)])
      },
      system: {
        status: pwa ? "PWA đang được kiểm soát" : "PWA chưa có controller",
        metrics: [
          ["PWA", pwa ? "Hoạt động" : "Chưa điều khiển"],
          ["Quyền đã cấp", `${grantedPermissions}/${permissionValues.length || 0}`],
          ["Lưu trữ", Number.isFinite(systemUsage) ? formatBytes(systemUsage) : "Chưa đo"]
        ],
        detail: `${cacheVersion}. Thiết lập hệ thống ${Object.keys(system.preferences || {}).length ? "đã có dữ liệu" : "chưa được tùy chỉnh"}.`,
        alert: !pwa && global.location?.protocol === "https:",
        updatedAt: Math.max(dateValue(system.updatedAt), dateValue(instance.storage?.checkedAt))
      }
    };

    dataset.creative.processing = runningAi > 0;
    dataset.work.overdue = overdue;
    dataset.analytics.slow = slowEndpoint > 1200;
    return dataset;
  }

  function metricRating(name, value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "unknown";
    const limits = { LCP: [2500, 4000], INP: [200, 500], CLS: [.1, .25], FCP: [1800, 3000], TTFB: [800, 1800] }[name];
    if (!limits) return "unknown";
    return number <= limits[0] ? "good" : number <= limits[1] ? "needs-improvement" : "poor";
  }

  function setVital(instance, name, value, source = "PerformanceObserver") {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return;
    const normalized = name === "CLS" ? Number(amount.toFixed(4)) : Math.round(amount);
    instance.vitals[name] = { name, value: normalized, rating: metricRating(name, normalized), source, measuredAt: nowIso() };
  }

  function startPerformanceObservers(instance) {
    const performanceApi = global.performance;
    const Observer = global.PerformanceObserver;
    const supported = asArray(Observer?.supportedEntryTypes);
    instance.performanceSupport = { observer: Boolean(Observer), entries: supported };
    const navigation = performanceApi?.getEntriesByType?.("navigation")?.[0];
    if (navigation) {
      if (Number.isFinite(navigation.responseStart)) setVital(instance, "TTFB", navigation.responseStart, "Navigation Timing");
      instance.loadTime = Math.round(navigation.loadEventEnd || navigation.duration || 0);
    }
    const fcp = performanceApi?.getEntriesByName?.("first-contentful-paint")?.[0];
    if (fcp) setVital(instance, "FCP", fcp.startTime, "Paint Timing");
    if (!Observer) return;
    const observe = (type, callback, extra = {}) => {
      if (!supported.includes(type)) return;
      try {
        const observer = new Observer((list) => callback(list.getEntries()));
        observer.observe({ type, buffered: true, ...extra });
        instance.observers.push(observer);
      } catch {}
    };
    observe("paint", (entries) => {
      const entry = entries.find((item) => item.name === "first-contentful-paint");
      if (entry) setVital(instance, "FCP", entry.startTime);
    });
    observe("largest-contentful-paint", (entries) => {
      const entry = entries[entries.length - 1];
      if (entry) setVital(instance, "LCP", entry.startTime);
    });
    let cls = 0;
    observe("layout-shift", (entries) => {
      entries.forEach((entry) => { if (!entry.hadRecentInput) cls += Number(entry.value || 0); });
      setVital(instance, "CLS", cls);
    });
    let inp = 0;
    observe("event", (entries) => {
      entries.forEach((entry) => { inp = Math.max(inp, Number(entry.duration || 0)); });
      if (inp) setVital(instance, "INP", inp);
    }, { durationThreshold: 40 });
    observe("resource", () => scanResources(instance));
  }

  function scanResources(instance) {
    const items = asArray(global.performance?.getEntriesByType?.("resource")).filter((entry) => {
      try { return new URL(entry.name).origin === global.location.origin || /^https:/.test(entry.name); }
      catch { return false; }
    });
    const slowest = [...items].sort((a, b) => Number(b.duration) - Number(a.duration))[0];
    const heaviest = [...items].sort((a, b) => Number(b.transferSize || b.encodedBodySize) - Number(a.transferSize || a.encodedBodySize))[0];
    instance.resources = {
      count: items.length,
      slowest: slowest ? { name: cleanText(slowest.name.split("/").pop() || slowest.name, 80), duration: Math.round(slowest.duration) } : null,
      heaviest: heaviest ? { name: cleanText(heaviest.name.split("/").pop() || heaviest.name, 80), bytes: Number(heaviest.transferSize || heaviest.encodedBodySize || 0) } : null,
      checkedAt: nowIso()
    };
  }

  async function readStorageSnapshot(instance) {
    const result = {
      supported: false,
      usage: null,
      quota: null,
      localBytes: localStorageBytes(),
      cacheCount: 0,
      cacheBytes: 0,
      indexedDbCount: null,
      checkedAt: nowIso()
    };
    try {
      if (typeof global.navigator?.storage?.estimate === "function") {
        const estimate = await global.navigator.storage.estimate();
        result.supported = true;
        result.usage = Number(estimate.usage || 0);
        result.quota = Number(estimate.quota || 0);
      }
    } catch {}
    try {
      if (global.caches?.keys) {
        const names = await global.caches.keys();
        result.cacheCount = names.length;
        for (const name of names.slice(0, 12)) {
          const cache = await global.caches.open(name);
          const responses = await cache.matchAll();
          result.cacheBytes += responses.slice(0, 80).reduce((sum, response) => sum + Math.max(0, Number(response.headers.get("content-length")) || 0), 0);
        }
      }
    } catch {}
    try {
      if (typeof global.indexedDB?.databases === "function") {
        const databases = await global.indexedDB.databases();
        result.indexedDbCount = databases.length;
      }
    } catch {}
    instance.storage = result;
    return result;
  }

  async function readPwaSnapshot(instance) {
    const snapshot = { supported: "serviceWorker" in (global.navigator || {}), controlled: Boolean(global.navigator?.serviceWorker?.controller), cacheNames: [], checkedAt: nowIso() };
    try { if (global.caches?.keys) snapshot.cacheNames = await global.caches.keys(); } catch {}
    instance.pwa = snapshot;
    return snapshot;
  }

  async function readPermissions(instance) {
    const values = {};
    const names = ["notifications", "camera", "microphone", "geolocation"];
    for (const name of names) {
      if (name === "notifications") {
        values[name] = "Notification" in global ? global.Notification.permission : "unsupported";
        continue;
      }
      try {
        values[name] = global.navigator?.permissions?.query ? (await global.navigator.permissions.query({ name })).state : "unsupported";
      } catch { values[name] = "unsupported"; }
    }
    instance.permissions = values;
  }

  async function fetchHealth(instance, force = false) {
    if (!force && Date.now() - instance.healthFetchedAt < 30_000) return instance.health;
    instance.healthFetchedAt = Date.now();
    const started = global.performance?.now?.() || Date.now();
    try {
      const response = await global.fetch("/api/health", { cache: "no-store", credentials: "include", headers: { Accept: "application/json" } });
      const latency = (global.performance?.now?.() || Date.now()) - started;
      const payload = await response.json().catch(() => ({}));
      instance.health = { ok: response.ok && payload?.ok === true, status: response.status, latency: Math.round(latency), payload, checkedAt: nowIso(), error: "" };
    } catch (error) {
      instance.health = { ok: false, status: 0, latency: Math.round((global.performance?.now?.() || Date.now()) - started), payload: null, checkedAt: nowIso(), error: cleanText(error?.message || "Không kết nối", 120) };
    }
    return instance.health;
  }

  async function fetchGit(instance) {
    if (Date.now() - instance.gitFetchedAt < 300_000) return instance.git;
    instance.gitFetchedAt = Date.now();
    try {
      const response = await global.fetch("https://api.github.com/repos/hoangdaika13/hoangdaika13.github.io/commits?per_page=1", { headers: { Accept: "application/vnd.github+json" } });
      const payload = await response.json();
      const commit = asArray(payload)[0];
      instance.git = response.ok && commit ? { sha: String(commit.sha).slice(0, 7), date: commit.commit?.committer?.date, message: cleanText(commit.commit?.message, 100) } : null;
    } catch { instance.git = null; }
    return instance.git;
  }

  async function checkDeployment(instance) {
    if (Date.now() - instance.deploymentFetchedAt < 60_000) return instance.deployment;
    instance.deploymentFetchedAt = Date.now();
    const started = global.performance?.now?.() || Date.now();
    try {
      const response = await global.fetch(`${global.location.origin}/?health=${Date.now()}`, { method: "HEAD", cache: "no-store" });
      instance.deployment = { ok: response.ok, status: response.status, latency: Math.round((global.performance?.now?.() || Date.now()) - started), checkedAt: nowIso() };
    } catch {
      instance.deployment = { ok: false, status: 0, latency: Math.round((global.performance?.now?.() || Date.now()) - started), checkedAt: nowIso() };
    }
    return instance.deployment;
  }

  function readHealthEndpoints(instance) {
    const history = readJson("hh.home.health.samples.v1", {});
    const endpointEntries = Object.entries(history?.endpoints || {});
    const latest = endpointEntries.map(([id, samples]) => ({ id, ...(asArray(samples).at(-1) || {}) }));
    const reachable = latest.filter((item) => ["online", "limited"].includes(item.state) || (item.status >= 200 && item.status < 500)).length;
    const slowest = [...latest].sort((a, b) => Number(b.latency) - Number(a.latency))[0] || null;
    instance.healthEndpoints = { total: latest.length, reachable, slowest, updatedAt: history?.updatedAt || null };
  }

  function collectLiveData(instance) {
    const weatherCache = readJson(WEATHER_KEY, {});
    const temperature = weatherCache?.payload?.weather?.current?.temperature_2m;
    const aqi = weatherCache?.payload?.air?.current?.us_aqi;
    const weatherDom = global.document.querySelector(".dashboard-weather-main strong")?.textContent?.trim();
    const aqiDom = global.document.querySelector(".dashboard-aqi strong")?.textContent?.trim();
    const connection = global.navigator?.connection || global.navigator?.mozConnection || global.navigator?.webkitConnection;
    const heap = global.performance?.memory;
    const vitalList = ["LCP", "CLS", "INP"].map((name) => instance.vitals[name]).filter(Boolean);
    const services = instance.health?.payload?.health || {};
    const servicePairs = [
      ["MongoDB", services.database?.connected],
      ["Realtime", services.realtime?.connected],
      ["Gemini", services.ai?.gemini]
    ];
    const serviceReady = servicePairs.filter(([, ready]) => ready === true).length;
    const serviceKnown = servicePairs.filter(([, ready]) => typeof ready === "boolean").length;
    const resources = instance.resources || {};
    const storage = instance.storage || {};
    const pwa = instance.pwa || {};
    const health = instance.health || {};
    const networkSupported = Boolean(connection);
    const heapSupported = Boolean(heap && Number.isFinite(Number(heap.usedJSHeapSize)));
    const performanceValue = instance.fps == null ? "Đang đo FPS" : `${instance.fps} FPS · ${instance.tabLag == null ? "—" : `${instance.tabLag} ms`}`;
    const performanceMeta = heapSupported ? `${formatBytes(heap.usedJSHeapSize)} JS heap` : "Trình duyệt không cung cấp JS heap";
    const vitalValue = vitalList.length
      ? vitalList.map((item) => `${item.name} ${item.name === "CLS" ? item.value : `${item.value}ms`}`).join(" · ")
      : "Chưa có Web Vitals";
    const vitalMeta = instance.performanceSupport?.observer
      ? `${Object.keys(instance.vitals).length}/5 metric được hỗ trợ`
      : "Trình duyệt không cung cấp PerformanceObserver";
    const storageValue = storage.supported ? `${formatBytes(storage.usage)} / ${formatBytes(storage.quota)}` : "Không có Storage Estimate";
    const indexedDbText = storage.indexedDbCount == null ? "IndexedDB: không cung cấp danh sách" : `IndexedDB: ${storage.indexedDbCount} DB`;
    const networkValue = global.navigator?.onLine === false
      ? "Offline"
      : networkSupported
        ? `${connection.downlink != null ? `${connection.downlink} Mbps` : String(connection.effectiveType || "Online").toUpperCase()}`
        : "Online";
    const networkMeta = networkSupported
      ? `${String(connection.effectiveType || "không rõ").toUpperCase()}${connection.rtt != null ? ` · RTT ${connection.rtt} ms` : ""}`
      : "Trình duyệt không cung cấp Network Information API";
    const weatherSupported = Boolean(weatherDom || Number.isFinite(temperature));
    const apiSupported = Boolean(health.checkedAt);
    const servicesSupported = Boolean(instance.health?.payload?.health);
    const resourceSupported = Boolean(resources.count);
    const pwaSupported = Boolean(pwa.supported);
    return {
      weather: {
        supported: weatherSupported,
        value: weatherDom || (Number.isFinite(temperature) ? `${Math.round(temperature)}°C` : "Đang tải"),
        meta: aqiDom || (Number.isFinite(aqi) ? `AQI ${Math.round(aqi)}` : "AQI chưa có"),
        detail: weatherSupported ? `${weatherCache?.location?.name || "Vị trí đã chọn"} · dữ liệu Open-Meteo/CAMS được cache trên thiết bị.` : "Chưa nhận được dữ liệu thời tiết.",
        score: Number.isFinite(aqi) ? clamp(100 - aqi / 3, 0, 100) : 40
      },
      performance: {
        supported: instance.fps != null,
        value: performanceValue,
        meta: performanceMeta,
        detail: `${instance.fps == null ? "FPS đang được đo bằng requestAnimationFrame." : `Chất lượng hiệu ứng tự động: ${instance.quality}.`} ${heapSupported ? "Bộ nhớ là JS heap, không phải RAM hệ điều hành." : "JS heap không được trình duyệt công bố."}`,
        score: clamp((instance.fps || 0) * 1.6, 0, 100)
      },
      vitals: {
        supported: instance.performanceSupport?.observer === true,
        value: vitalValue,
        meta: vitalMeta,
        detail: `Load ${instance.loadTime ? formatMetricMs(instance.loadTime) : "chưa hoàn tất"}. ${vitalList.some((item) => item.rating === "poor") ? "Có metric cần cải thiện." : "Chỉ số lấy trực tiếp từ phiên hiện tại."}`,
        score: vitalList.length ? clamp(100 - vitalList.filter((item) => item.rating === "poor").length * 35 - vitalList.filter((item) => item.rating === "needs-improvement").length * 14, 0, 100) : 0
      },
      resources: {
        supported: resourceSupported,
        value: resources.slowest ? `${resources.slowest.duration} ms · ${formatBytes(resources.heaviest?.bytes || 0)}` : "Chưa có request",
        meta: resources.slowest ? `${resources.count} resource · chậm nhất ${resources.slowest.name}` : "Resource Timing chưa có dữ liệu",
        detail: resources.heaviest ? `Asset nặng nhất: ${resources.heaviest.name} (${formatBytes(resources.heaviest.bytes)}).` : "Chưa có tài nguyên đủ dữ liệu transferSize.",
        score: resources.slowest ? clamp(100 - resources.slowest.duration / 35, 0, 100) : 0
      },
      api: {
        supported: apiSupported,
        value: apiSupported ? `${health.status || "ERR"} · ${health.latency} ms` : "Đang kiểm tra",
        meta: health.ok ? "Backend đã xác nhận" : health.error || "Backend chưa xác nhận",
        detail: health.ok ? "Kết quả trực tiếp từ /api/health." : "Không coi endpoint là hoạt động khi máy chủ chưa trả response hợp lệ.",
        score: health.ok ? clamp(100 - health.latency / 20, 0, 100) : 0
      },
      services: {
        supported: servicesSupported,
        value: servicesSupported ? `${serviceReady}/${serviceKnown} kết nối` : "Chưa có dữ liệu",
        meta: servicePairs.map(([label, ready]) => `${label}: ${ready === true ? "OK" : ready === false ? "chưa kết nối" : "không rõ"}`).join(" · "),
        detail: "MongoDB, realtime và Gemini chỉ hiện OK khi backend xác nhận.",
        score: serviceKnown ? serviceReady / serviceKnown * 100 : 0
      },
      storage: {
        supported: storage.supported === true || storage.localBytes != null,
        value: storageValue,
        meta: `Cache ${storage.cacheCount || 0} · ${indexedDbText} · Local ${formatBytes(storage.localBytes)}`,
        detail: `Cache có Content-Length: ${formatBytes(storage.cacheBytes)}. Storage Estimate là tổng mức sử dụng; trình duyệt không tách chính xác dung lượng IndexedDB.`,
        score: storage.quota ? clamp(100 - storage.usage / storage.quota * 100, 0, 100) : 50
      },
      pwa: {
        supported: pwaSupported,
        value: pwa.controlled ? "Service Worker active" : pwaSupported ? "Chưa có controller" : "Không hỗ trợ",
        meta: pwa.cacheNames?.length ? `${pwa.cacheNames.length} cache · ${pwa.cacheNames[0]}` : "Chưa có cache",
        detail: pwaSupported ? "Trạng thái lấy từ navigator.serviceWorker và Cache Storage." : "Trình duyệt không hỗ trợ Service Worker.",
        score: pwa.controlled ? 100 : pwaSupported ? 45 : 0
      },
      network: {
        supported: global.navigator?.onLine !== false,
        value: networkValue,
        meta: networkMeta,
        detail: networkSupported ? "Dữ liệu do Network Information API cung cấp." : "Chỉ xác nhận online/offline; không tự ước lượng băng thông.",
        score: global.navigator?.onLine === false ? 0 : connection?.downlink != null ? clamp(connection.downlink * 8, 15, 100) : 50
      },
      sync: {
        supported: true,
        value: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        meta: instance.syncStatus || (isSignedIn() ? "Đang chờ đồng bộ tài khoản" : "Khách · lưu trên thiết bị"),
        detail: isSignedIn() ? "Cấu hình được đồng bộ qua bản ghi riêng của tài khoản khi backend sẵn sàng." : "Chế độ khách chỉ lưu cấu hình trên thiết bị này.",
        score: new Date().getSeconds() / 60 * 100
      }
    };
  }

  function sparkPoints(history) {
    const data = [...Array(Math.max(0, 18 - history.length)).fill(history[0] || 0), ...history.slice(-18)];
    return data.map((value, index) => `${(index / 17) * 120},${25 - clamp(value, 0, 100) / 100 * 21}`).join(" ");
  }

  function widgetMarkup(instance, widget, data) {
    const size = instance.prefs.widgetSizes[widget.id] || "medium";
    const unsupported = data?.supported === false;
    const hidden = !instance.prefs.widgets.includes(widget.id) || (instance.prefs.hideUnsupported && unsupported);
    return `<article class="hgm-live-card is-${size}${unsupported ? " is-unsupported" : ""}" data-hgm-widget="${widget.id}" data-size="${size}" draggable="true" style="--widget:${widget.color}" ${hidden ? "hidden" : ""}>
      <button type="button" data-hgm-live-open="${widget.id}" aria-expanded="false">
        <span class="hgm-satellite"><i>${widget.icon}</i><b></b></span>
        <span class="hgm-live-copy"><small>${escapeHtml(widget.label)}</small><strong>${escapeHtml(data?.value || "Đang đồng bộ")}</strong><em>${escapeHtml(data?.meta || "Chưa có dữ liệu")}</em></span>
        <svg viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true"><polyline points="${sparkPoints(instance.histories[widget.id] || [])}"></polyline></svg>
      </button>
      <div class="hgm-live-detail" role="region" aria-label="Chi tiết ${escapeHtml(widget.label)}"><p>${escapeHtml(data?.detail || "Chưa có chi tiết.")}</p><span>${unsupported ? "Không được trình duyệt hoặc backend hỗ trợ" : "Dữ liệu trực tiếp · không mô phỏng"}</span></div>
    </article>`;
  }

  function planetMarkup(instance, planet, index) {
    const data = instance.planetData?.[planet.id];
    const unread = instance.activities.filter((item) => item.planet === planet.id && !item.read).length;
    const active = instance.focusPlanet === planet.id;
    const status = data?.status || "Đang đọc dữ liệu";
    return `<button class="hgm-planet hgm-planet--${index + 1}${unread ? " has-signal" : ""}${data?.alert ? " has-alert" : ""}${data?.processing ? " is-processing" : ""}${active ? " is-selected" : ""}" type="button" data-hgm-planet="${planet.id}" style="--planet:${planet.color};--planet-index:${index}" aria-pressed="${active}" aria-label="${escapeHtml(`${planet.label}: ${status}`)}">
      <span class="hgm-planet-sphere"><i>${planet.icon}</i><b></b><em></em></span>
      <strong>${escapeHtml(planet.label)}</strong>
      <small>${escapeHtml(status)}</small>
      ${unread ? `<span class="hgm-signal-count">${unread}</span>` : ""}
    </button>`;
  }

  function activityButton(item, duplicate = false) {
    const planet = activityForPlanet(item.planet);
    const attributes = duplicate ? 'tabindex="-1" aria-hidden="true"' : `data-hgm-activity-id="${escapeHtml(item.id)}"`;
    return `<button type="button" class="is-${planet.id}${item.read ? " is-read" : ""}" ${attributes} style="--activity:${planet.color}"><span>${planet.icon}</span><b>${escapeHtml(item.text)}</b><time>${escapeHtml(relativeTime(item.createdAt))}</time><i>→</i></button>`;
  }

  function focusMarkup(instance) {
    const planet = PLANETS.find((item) => item.id === instance.focusPlanet);
    if (!planet) return "";
    const data = instance.planetData?.[planet.id];
    const activities = instance.activities.filter((item) => item.planet === planet.id).slice(0, 4);
    return `<aside class="hgm-focus-panel" data-hgm-focus style="--focus:${planet.color}" aria-label="Chi tiết ${escapeHtml(planet.label)}">
      <header><span><i>${planet.icon}</i><small>FOCUS GALAXY</small><strong>${escapeHtml(planet.label)}</strong></span><button type="button" data-hgm-focus-close aria-label="Đóng chi tiết">×</button></header>
      <p class="hgm-focus-status">${escapeHtml(data?.status || "Chưa có hoạt động")}</p>
      <div class="hgm-focus-metrics">${asArray(data?.metrics).map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join("")}</div>
      <p class="hgm-focus-detail">${escapeHtml(data?.detail || "Chưa có dữ liệu chi tiết.")}</p>
      <section><span>LỊCH SỬ THẬT</span>${activities.length ? activities.map((item) => `<p><i></i><b>${escapeHtml(item.text)}</b><time>${escapeHtml(relativeTime(item.createdAt))}</time></p>`).join("") : "<p>Chưa có hoạt động được ghi nhận.</p>"}</section>
      <footer><button type="button" class="is-primary" data-hgm-open-workspace="${planet.id}">Mở workspace</button><button type="button" data-hgm-pin-planet="${planet.id}">${instance.prefs.defaultPlanet === planet.id ? "Đang mặc định" : "Đặt mặc định"}</button><button type="button" data-hgm-hide-signal="${planet.id}">Ẩn tín hiệu này</button></footer>
    </aside>`;
  }

  function dockMarkup(instance) {
    return `<div class="hgm-dock" data-hgm-dock aria-label="Cosmic Command Dock">
      <button class="hgm-dock-core" type="button" data-hgm-dock-toggle aria-expanded="false"><span>H</span><b>COMMAND</b></button>
      <div class="hgm-dock-actions">${instance.prefs.pinnedActions.map((id) => {
        const action = ACTIONS.find((item) => item.id === id);
        return action ? `<button type="button" data-hgm-action="${action.id}" title="${escapeHtml(action.label)}"><span>${action.icon}</span><b>${escapeHtml(action.label)}</b></button>` : "";
      }).join("")}</div>
      <form class="hgm-quick-form" data-hgm-quick-form hidden>
        <label><span data-hgm-quick-label>Tạo nhanh</span><input data-hgm-quick-input maxlength="240" autocomplete="off"></label>
        <button type="submit">Lưu</button><button type="button" data-hgm-quick-close>Hủy</button>
      </form>
      <input type="file" multiple data-hgm-asset-input hidden>
    </div>`;
  }

  function settingWidgetMarkup(instance, id) {
    const widget = WIDGETS.find((item) => item.id === id);
    if (!widget) return "";
    return `<li draggable="true" data-hgm-setting-widget="${widget.id}">
      <span class="hgm-drag" aria-hidden="true">⋮⋮</span>
      <label><input type="checkbox" data-hgm-widget-toggle="${widget.id}" ${instance.prefs.widgets.includes(widget.id) ? "checked" : ""}><b>${widget.icon}</b><em>${escapeHtml(widget.label)}</em></label>
      <select data-hgm-widget-size="${widget.id}" aria-label="Kích thước ${escapeHtml(widget.label)}"><option value="small" ${instance.prefs.widgetSizes[widget.id] === "small" ? "selected" : ""}>Nhỏ</option><option value="medium" ${instance.prefs.widgetSizes[widget.id] === "medium" ? "selected" : ""}>Vừa</option><option value="large" ${instance.prefs.widgetSizes[widget.id] === "large" ? "selected" : ""}>Lớn</option></select>
      <span class="hgm-order-buttons"><button type="button" data-hgm-widget-move="${widget.id}" data-direction="-1" aria-label="Đưa ${escapeHtml(widget.label)} lên">↑</button><button type="button" data-hgm-widget-move="${widget.id}" data-direction="1" aria-label="Đưa ${escapeHtml(widget.label)} xuống">↓</button></span>
    </li>`;
  }

  function settingsMarkup(instance) {
    return `<aside class="hgm-settings" data-hgm-settings hidden>
      <button class="hgm-settings-backdrop" type="button" data-hgm-settings-close aria-label="Đóng cá nhân hóa"></button>
      <section class="hgm-settings-panel" role="dialog" aria-modal="true" aria-labelledby="hgmSettingsTitle">
        <header><div><small>GALAXY CONTROL V2</small><h3 id="hgmSettingsTitle">Cá nhân hóa sâu</h3><p data-hgm-sync-label>${isSignedIn() ? "Tài khoản · sẵn sàng đồng bộ" : "Khách · chỉ lưu trên thiết bị"}</p></div><button type="button" data-hgm-settings-close aria-label="Đóng">×</button></header>
        <div class="hgm-setting-section"><span>Tinh vân</span><div class="hgm-choice">${[["neon", "Neon"], ["purple", "Purple"], ["solar", "Solar Fire"], ["deep", "Deep Space"]].map(([id, label]) => `<button type="button" data-hgm-theme="${id}" aria-pressed="${instance.prefs.theme === id}">${label}</button>`).join("")}</div></div>
        <div class="hgm-setting-section"><span>Chuyển động</span><div class="hgm-choice">${[["static", "Tĩnh"], ["balanced", "Cân bằng"], ["cinematic", "Điện ảnh"]].map(([id, label]) => `<button type="button" data-hgm-motion="${id}" aria-pressed="${instance.prefs.motion === id}">${label}</button>`).join("")}</div></div>
        <label class="hgm-range"><span>Mật độ sao <b>${instance.prefs.stars}%</b></span><input type="range" min="20" max="100" step="10" value="${instance.prefs.stars}" data-hgm-stars></label>
        <label class="hgm-switch"><input type="checkbox" data-hgm-sound ${instance.prefs.sound ? "checked" : ""}><i></i><span><b>Âm thanh không gian</b><small>Mặc định tắt; chỉ phát sau tương tác</small></span></label>
        <label class="hgm-switch"><input type="checkbox" data-hgm-hide-unsupported ${instance.prefs.hideUnsupported ? "checked" : ""}><i></i><span><b>Ẩn chỉ số không hỗ trợ</b><small>Có thể bật lại bất cứ lúc nào</small></span></label>
        <label class="hgm-select"><span>Hành tinh mặc định</span><select data-hgm-default-planet>${PLANETS.map((planet) => `<option value="${planet.id}" ${instance.prefs.defaultPlanet === planet.id ? "selected" : ""}>${escapeHtml(planet.label)}</option>`).join("")}</select></label>
        <div class="hgm-setting-section"><span>Widget LIVE ORBIT · kéo thả để sắp xếp</span><ul class="hgm-widget-settings" data-hgm-widget-settings>${instance.prefs.widgetOrder.map((id) => settingWidgetMarkup(instance, id)).join("")}</ul></div>
        <div class="hgm-setting-section"><span>Ghim tối đa 4 hành động</span><div class="hgm-action-settings">${ACTIONS.map((action) => `<label><input type="checkbox" data-hgm-action-toggle="${action.id}" ${instance.prefs.pinnedActions.includes(action.id) ? "checked" : ""}><i>${action.icon}</i><b>${escapeHtml(action.label)}</b></label>`).join("")}</div></div>
        <div class="hgm-settings-tools"><button type="button" data-hgm-export>Xuất JSON</button><label>Nhập JSON<input type="file" accept="application/json,.json" data-hgm-import hidden></label><button type="button" data-hgm-account-sync ${isSignedIn() ? "" : "disabled"}>Đồng bộ tài khoản</button><button type="button" data-hgm-reset>Khôi phục mặc định</button></div>
        <footer><span data-hgm-settings-status role="status" aria-live="polite"></span><button type="button" class="is-primary" data-hgm-settings-close>Hoàn tất</button></footer>
      </section>
    </aside>`;
  }

  function markup(instance) {
    const currentPeriod = period();
    return `<div class="hgm-shell" data-hgm-shell>
      <canvas class="hgm-cosmos" data-hgm-canvas aria-hidden="true"></canvas>
      <div class="hgm-nebula" aria-hidden="true"></div>
      <div class="hgm-aurora" data-hgm-aurora aria-hidden="true"></div>
      <section class="hgm-live" aria-labelledby="hgmLiveTitle">
        <header><div><span><i></i> LIVE ORBIT · REAL DATA</span><h2 id="hgmLiveTitle">Trung tâm tín hiệu trực tiếp</h2><p>Chỉ số từ trình duyệt, backend và dữ liệu bạn thật sự đã tạo.</p></div><div><b data-hgm-online>ONLINE</b><button type="button" data-hgm-settings-open>⚙ Cá nhân hóa</button></div></header>
        <div class="hgm-live-deck" data-hgm-live-deck></div>
      </section>
      <section class="hgm-activity" aria-label="Galaxy Activity Stream">
        <header><span>GALAXY ACTIVITY</span><b>EVENT BUS</b><button type="button" data-hgm-read-all>Đánh dấu đã đọc</button></header>
        <div class="hgm-activity-window"><div class="hgm-activity-track" data-hgm-activity></div></div>
      </section>
      <section class="hgm-hero" data-hgm-hero aria-labelledby="hgmHeroTitle">
        <div class="hgm-copy">
          <span class="hgm-kicker"><i></i> HH GALAXY MISSION CONTROL</span>
          <h2 id="hgmHeroTitle"><span>${currentPeriod.greeting}</span>, <b>${escapeHtml(userName())}</b></h2>
          <p>Mỗi hành tinh là một trung tâm chức năng thật. Chọn hành tinh để xem dữ liệu, lịch sử và hành động đúng workspace.</p>
          <div class="hgm-summary"><span><i></i><b data-hgm-summary>Đang tổng hợp hệ thống</b></span><time data-hgm-clock>--:--:--</time></div>
          <div class="hgm-copy-actions"><button type="button" class="is-primary" data-hgm-open-workspace="${instance.prefs.defaultPlanet}">Mở hành tinh mặc định</button><button type="button" data-hgm-settings-open>Điều chỉnh vũ trụ</button></div>
        </div>
        <div class="hgm-solar" data-hgm-solar>
          <div class="hgm-orbit hgm-orbit--1"></div><div class="hgm-orbit hgm-orbit--2"></div><div class="hgm-orbit hgm-orbit--3"></div><div class="hgm-orbit hgm-orbit--4"></div>
          <div class="hgm-energy" data-hgm-energy aria-hidden="true"></div>
          <div class="hgm-sun"><span>H</span><i></i><b></b><em></em></div>
          <div class="hgm-planets" data-hgm-planets></div>
          ${dockMarkup(instance)}
        </div>
        <div class="hgm-focus-host" data-hgm-focus-host></div>
      </section>
      ${settingsMarkup(instance)}
      <div class="hgm-burst" data-hgm-burst aria-hidden="true"></div>
      <div class="hgm-comet" data-hgm-comet aria-hidden="true"><i></i><span></span></div>
      <div class="hgm-toast" data-hgm-toast role="status" aria-live="polite"></div>
      <input type="file" accept="application/json,.json" data-hgm-hidden-import hidden>
    </div>`;
  }

  function applyPreferenceState(instance) {
    const shell = instance.shell;
    if (!shell) return;
    instance.root.dataset.hgcTheme = instance.prefs.theme;
    instance.root.dataset.hgcMotion = instance.prefs.motion;
    shell.dataset.theme = instance.prefs.theme;
    shell.dataset.motion = instance.prefs.motion;
    shell.style.setProperty("--hgm-star-density", String(instance.prefs.stars / 100));
    renderLive(instance);
    renderPlanets(instance);
    const dock = shell.querySelector("[data-hgm-dock]");
    if (dock) {
      dock.outerHTML = dockMarkup(instance);
      bindDockActions(instance);
    }
    const settings = shell.querySelector("[data-hgm-settings]");
    if (settings && !settings.hidden) settings.outerHTML = settingsMarkup(instance).replace('data-hgm-settings hidden', "data-hgm-settings");
  }

  function renderLive(instance) {
    const deck = instance.shell?.querySelector("[data-hgm-live-deck]");
    if (!deck) return;
    instance.liveData = collectLiveData(instance);
    Object.entries(instance.liveData).forEach(([id, item]) => {
      instance.histories[id] ||= [];
      instance.histories[id].push(clamp(item.score, 0, 100));
      instance.histories[id] = instance.histories[id].slice(-18);
    });
    deck.innerHTML = instance.prefs.widgetOrder.slice(0, MAX_WIDGETS).map((id) => {
      const widget = WIDGETS.find((item) => item.id === id);
      return widget ? widgetMarkup(instance, widget, instance.liveData[id]) : "";
    }).join("");
  }

  function renderPlanets(instance) {
    const host = instance.shell?.querySelector("[data-hgm-planets]");
    if (!host) return;
    instance.planetData = collectPlanetData(instance);
    const order = instance.prefs.planetOrder.map((id) => PLANETS.find((planet) => planet.id === id)).filter(Boolean);
    host.innerHTML = order.map((planet, index) => planetMarkup(instance, planet, index)).join("");
    instance.shell.classList.toggle("has-ai-energy", Boolean(instance.planetData.creative?.processing));
    instance.shell.classList.toggle("has-overdue", Boolean(instance.planetData.work?.overdue));
    instance.shell.classList.toggle("has-slow-endpoint", Boolean(instance.planetData.analytics?.slow));
    const focusHost = instance.shell.querySelector("[data-hgm-focus-host]");
    if (focusHost) focusHost.innerHTML = focusMarkup(instance);
    const unread = instance.activities.filter((item) => !item.read).length;
    const summary = instance.shell.querySelector("[data-hgm-summary]");
    if (summary) summary.textContent = unread ? `${unread} tín hiệu mới · chất lượng ${instance.quality}` : `Không có tín hiệu mới · chất lượng ${instance.quality}`;
  }

  function renderActivity(instance) {
    const track = instance.shell?.querySelector("[data-hgm-activity]");
    if (!track) return;
    const items = instance.activities.slice(0, 12);
    if (!items.length) {
      track.innerHTML = '<span class="hgm-activity-empty">Chưa có sự kiện mới. Activity Stream chỉ ghi nhận hoạt động thật.</span>';
      return;
    }
    const row = items.map((item) => activityButton(item)).join("");
    const clone = items.map((item) => activityButton(item, true)).join("");
    track.innerHTML = `${row}<span class="hgm-activity-copy" aria-hidden="true">${clone}</span>`;
  }

  function announce(instance, message, tone = "") {
    const node = instance.shell?.querySelector("[data-hgm-toast]");
    if (!node) return;
    node.textContent = cleanText(message, 180);
    node.dataset.tone = tone;
    node.classList.add("is-visible");
    clearTimeout(instance.toastTimer);
    instance.toastTimer = setTimeout(() => node.classList.remove("is-visible"), 2600);
    const settingsStatus = instance.shell.querySelector("[data-hgm-settings-status]");
    if (settingsStatus) settingsStatus.textContent = cleanText(message, 180);
  }

  function showBurst(instance, planetId) {
    if (instance.prefs.motion === "static") return;
    const planet = instance.shell?.querySelector(`[data-hgm-planet="${planetId}"]`);
    const burst = instance.shell?.querySelector("[data-hgm-burst]");
    if (!planet || !burst) return;
    const shellRect = instance.shell.getBoundingClientRect();
    const rect = planet.getBoundingClientRect();
    burst.style.setProperty("--x", `${rect.left - shellRect.left + rect.width / 2}px`);
    burst.style.setProperty("--y", `${rect.top - shellRect.top + rect.height / 2}px`);
    burst.innerHTML = Array.from({ length: instance.quality === "low" ? 8 : 18 }, (_, index) => `<i style="--a:${index * (360 / (instance.quality === "low" ? 8 : 18))}deg"></i>`).join("");
    burst.classList.remove("is-active");
    global.requestAnimationFrame?.(() => burst.classList.add("is-active"));
    setTimeout(() => burst.classList.remove("is-active"), 800);
  }

  function showComet(instance, activity) {
    if (instance.prefs.motion === "static" || global.document.hidden) return;
    const comet = instance.shell?.querySelector("[data-hgm-comet]");
    const planet = activityForPlanet(activity.planet);
    if (!comet) return;
    comet.style.setProperty("--comet", planet.color);
    comet.querySelector("span").textContent = activity.text;
    comet.classList.remove("is-active");
    global.requestAnimationFrame?.(() => comet.classList.add("is-active"));
    setTimeout(() => comet.classList.remove("is-active"), 3000);
  }

  function setAurora(instance, state) {
    const aurora = instance.shell?.querySelector("[data-hgm-aurora]");
    if (!aurora) return;
    aurora.dataset.state = state;
    clearTimeout(instance.auroraTimer);
    instance.auroraTimer = setTimeout(() => { aurora.dataset.state = ""; }, 5000);
  }

  function playTone(instance, frequency = 520) {
    if (!instance.prefs.sound) return;
    try {
      instance.audio ||= new (global.AudioContext || global.webkitAudioContext)();
      const oscillator = instance.audio.createOscillator();
      const gain = instance.audio.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, instance.audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(.04, instance.audio.currentTime + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, instance.audio.currentTime + .11);
      oscillator.connect(gain).connect(instance.audio.destination);
      oscillator.start();
      oscillator.stop(instance.audio.currentTime + .12);
    } catch {}
  }

  function openFocus(instance, planetId) {
    if (!PLANETS.some((planet) => planet.id === planetId)) return;
    instance.focusPlanet = planetId;
    instance.shell.dataset.focusPlanet = planetId;
    instance.shell.classList.add("is-focus");
    markPlanetRead(instance, planetId);
    renderActivity(instance);
    renderPlanets(instance);
    playTone(instance, 440 + PLANETS.findIndex((planet) => planet.id === planetId) * 35);
    const panel = instance.shell.querySelector("[data-hgm-focus]");
    if (global.innerWidth <= 700) panel?.scrollIntoView?.({ behavior: instance.prefs.motion === "static" ? "auto" : "smooth", block: "end" });
  }

  function closeFocus(instance) {
    instance.focusPlanet = "";
    delete instance.shell.dataset.focusPlanet;
    instance.shell.classList.remove("is-focus");
    renderPlanets(instance);
  }

  function quickForm(instance, type) {
    const form = instance.shell.querySelector("[data-hgm-quick-form]");
    const label = form?.querySelector("[data-hgm-quick-label]");
    const input = form?.querySelector("[data-hgm-quick-input]");
    if (!form || !label || !input) return;
    instance.quickType = type;
    form.hidden = false;
    label.textContent = type === "task" ? "Công việc mới" : "Ghi chú mới";
    input.placeholder = type === "task" ? "Việc cần hoàn thành..." : "Ý tưởng hoặc thông tin cần nhớ...";
    input.value = "";
    input.focus();
  }

  function saveQuick(instance, type, text) {
    const value = cleanText(text, type === "task" ? 180 : 1000);
    if (!value) return false;
    if (type === "task") {
      const tasks = asArray(readJson(TODO_KEY, []));
      tasks.unshift({ id: uid("todo"), title: value, priority: "medium", category: "Galaxy Dock", deadline: dayKey(), reminder: "", repeat: "none", completed: false, reminded: false, createdAt: Date.now() });
      writeJson(TODO_KEY, tasks);
      emitEvent("task:created", { title: value, source: "galaxy-dock" });
    } else {
      const notes = asArray(readJson(NOTE_KEY, []));
      const colors = ["#fff17a", "#75f2d0", "#ff91d9", "#9cb8ff", "#ffb56f", "#c8ff78"];
      notes.push({ id: uid("note"), text: value, color: colors[notes.length % colors.length], x: 24 + (notes.length * 37) % 420, y: 26 + (notes.length * 31) % 120, rotate: (notes.length % 3 - 1) * .8, pinned: false, tags: "galaxy-dock", reminder: "", preview: false, updatedAt: Date.now() });
      writeJson(NOTE_KEY, notes.slice(-30));
      emitEvent("note:created", { title: value.slice(0, 80), source: "galaxy-dock" });
      addActivity(instance, { type: "note-created", planet: "work", text: `Đã tạo ghi chú: ${value.slice(0, 70)}`, route: "/home", source: "Cosmic Command Dock", signature: `note:${notes.at(-1).id}` });
    }
    global.dispatchEvent?.(new CustomEvent("hh:command-center-sync"));
    return true;
  }

  function startFocusSession(instance) {
    const button = global.document.querySelector("[data-home-health-focus-host] [data-hhhf-toggle]");
    if (button) {
      button.click();
      addActivity(instance, { type: "focus-started", planet: "work", text: "Đã bắt đầu phiên tập trung 25 phút", route: "/home", source: "Focus Mode", signature: `focus:${Math.floor(Date.now() / 60000)}` });
      announce(instance, "Focus Mode 25 phút đã bắt đầu.", "success");
      return;
    }
    navigate("/home");
    announce(instance, "Khu vực Focus đang được tải; hãy bấm Bắt đầu tại Focus Mode.", "");
  }

  async function runHealthCheck(instance) {
    announce(instance, "Đang kiểm tra Website Health...", "");
    global.document.querySelector("[data-hhhf-refresh]")?.click?.();
    await Promise.all([fetchHealth(instance, true), checkDeployment(instance)]);
    readHealthEndpoints(instance);
    await refresh(instance, { effects: true });
    const text = instance.health?.ok ? `Website Health phản hồi ${instance.health.latency} ms` : "Website Health chưa xác nhận kết nối";
    addActivity(instance, { type: instance.health?.ok ? "health-ready" : "health-warning", planet: "analytics", text, route: "/analytics", source: "/api/health", signature: `health:${instance.health?.status}:${Math.round((instance.health?.latency || 0) / 50)}` }, false);
    announce(instance, text, instance.health?.ok ? "success" : "warning");
  }

  async function handleAction(instance, actionId) {
    const action = ACTIONS.find((item) => item.id === actionId);
    if (!action) return;
    playTone(instance, 520);
    if (actionId === "task" || actionId === "note") return quickForm(instance, actionId);
    if (actionId === "ai") return navigate("/create/ai-center");
    if (actionId === "asset") return instance.shell.querySelector("[data-hgm-asset-input]")?.click();
    if (actionId === "recent") return navigate("/recent");
    if (actionId === "health") return runHealthCheck(instance);
    if (actionId === "search") {
      const command = global.document.querySelector("[data-command-open]");
      if (command) command.click(); else navigate("/tools");
      return;
    }
    if (actionId === "focus") return startFocusSession(instance);
  }

  function saveAssetMetadata(instance, files) {
    const list = asArray(readJson(FILE_KEY, []));
    Array.from(files || []).slice(0, 20).forEach((file) => {
      list.unshift({ id: uid("file"), name: cleanText(file.name, 200), extension: cleanText(file.name.split(".").pop() || "file", 20), size: Math.max(0, Number(file.size) || 0), modified: file.lastModified || Date.now(), favorite: false, source: "galaxy-dock" });
    });
    writeJson(FILE_KEY, list.slice(0, 50));
    global.dispatchEvent?.(new CustomEvent("hh:command-center-sync"));
    emitEvent("media:asset-added", { count: files?.length || 0, source: "galaxy-dock" });
    announce(instance, `Đã lưu metadata của ${files?.length || 0} asset. File gốc không bị tải lên ngoài ý muốn.`, "success");
  }

  function downloadJson(filename, payload) {
    const url = global.URL?.createObjectURL?.(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }));
    if (!url) throw new Error("Trình duyệt không hỗ trợ tải JSON.");
    const anchor = global.document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => global.URL.revokeObjectURL(url), 1000);
  }

  async function importPreferences(instance, file) {
    if (!file || file.size > 128_000) throw new Error("Tệp cấu hình không hợp lệ hoặc vượt 128 KB.");
    const payload = JSON.parse(await file.text());
    if (payload?.schema !== "hh-home-galaxy-preferences" || Number(payload.version) !== 2) throw new Error("Đây không phải cấu hình Galaxy V2.");
    instance.prefs = normalizePrefs(payload.preferences);
    savePrefs(instance, { sync: false });
    rerenderSettings(instance);
    announce(instance, "Đã nhập cấu hình Galaxy hợp lệ.", "success");
  }

  function rerenderSettings(instance) {
    const settings = instance.shell.querySelector("[data-hgm-settings]");
    if (!settings) return;
    const wasOpen = !settings.hidden;
    settings.outerHTML = settingsMarkup(instance).replace(wasOpen ? 'data-hgm-settings hidden' : "__none__", wasOpen ? "data-hgm-settings" : "__none__");
  }

  async function syncAccount(instance, mode = "auto") {
    if (!isSignedIn() || instance.syncing) {
      if (!isSignedIn()) instance.syncStatus = "Khách · lưu trên thiết bị";
      return false;
    }
    instance.syncing = true;
    instance.syncStatus = "Đang đồng bộ tài khoản";
    renderLive(instance);
    try {
      const response = await global.fetch("/api/modules/home-galaxy/items", { credentials: "include", headers: apiHeaders() });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const remote = asArray(payload.items).find((item) => item?.type === "preferences-v2");
      const remotePrefs = remote?.data?.preferences ? normalizePrefs(remote.data.preferences) : null;
      if (remotePrefs && (mode === "pull" || (mode === "auto" && remotePrefs.updatedAt > instance.prefs.updatedAt))) {
        instance.prefs = remotePrefs;
        writeJson(PREF_KEY, instance.prefs);
        applyPreferenceState(instance);
        instance.syncStatus = `Đã nhận cấu hình tài khoản · ${new Date(remotePrefs.updatedAt).toLocaleString("vi-VN")}`;
      } else {
        const body = JSON.stringify({ title: "Galaxy Preferences V2", type: "preferences-v2", data: { preferences: instance.prefs } });
        const method = remote?._id ? "PATCH" : "POST";
        const target = remote?._id ? `/api/modules/home-galaxy/items?id=${encodeURIComponent(remote._id)}` : "/api/modules/home-galaxy/items";
        const saved = await global.fetch(target, { method, credentials: "include", headers: apiHeaders(), body });
        if (!saved.ok) throw new Error(`HTTP ${saved.status}`);
        instance.syncStatus = "Đã đồng bộ với tài khoản";
      }
      writeJson(SYNC_META_KEY, { checkedAt: nowIso(), status: "ready" });
      announce(instance, instance.syncStatus, "success");
      return true;
    } catch (error) {
      instance.syncStatus = `Chỉ lưu trên thiết bị · ${cleanText(error?.message || "backend chưa sẵn sàng", 80)}`;
      writeJson(SYNC_META_KEY, { checkedAt: nowIso(), status: "local", error: cleanText(error?.message, 80) });
      if (mode !== "auto") announce(instance, "Không thể đồng bộ tài khoản; cấu hình trên thiết bị vẫn an toàn.", "warning");
      return false;
    } finally {
      instance.syncing = false;
      renderLive(instance);
    }
  }

  function scheduleAccountSync(instance, mode = "auto") {
    clearTimeout(instance.syncTimer);
    instance.syncTimer = setTimeout(() => syncAccount(instance, mode), mode === "auto" ? 700 : 250);
  }

  function mapEventToActivity(detail = {}) {
    const name = cleanText(detail.eventName || detail.meta?.name, 100).toLowerCase();
    const payload = detail.payload || {};
    const title = cleanText(payload.title || payload.name || payload.message, 100);
    if (/task.*complete|todo.*complete/.test(name)) return { type: "task-completed", planet: "work", text: `Hoàn thành task${title ? `: ${title}` : ""}`, route: "/work", source: "HH Event Bus" };
    if (/task.*create|todo.*create/.test(name)) return { type: "task-created", planet: "work", text: `Task mới${title ? `: ${title}` : ""}`, route: "/work", source: "HH Event Bus" };
    if (/project.*update/.test(name)) return { type: "project-updated", planet: "work", text: `Dự án vừa cập nhật${title ? `: ${title}` : ""}`, route: "/work", source: "HH Event Bus" };
    if (/ai.*complete|ai.*success/.test(name)) return { type: "ai-completed", planet: "creative", text: `AI vừa hoàn tất${title ? `: ${title}` : ""}`, route: "/create/ai-center", source: "HH Event Bus" };
    if (/communication.*notification|message.*new/.test(name)) return { type: "message-new", planet: "communication", text: `Tin nhắn mới${title ? `: ${title}` : ""}`, route: "/communication/messenger", source: "HH Event Bus" };
    if (/deployment.*ready/.test(name)) return { type: "deployment-ready", planet: "dev", text: "Deployment production đã sẵn sàng", route: "/dev-tools", source: "HH Event Bus" };
    if (/deployment.*fail/.test(name)) return { type: "deployment-failed", planet: "dev", text: "Deployment production thất bại", route: "/dev-tools", source: "HH Event Bus" };
    if (/media.*asset/.test(name)) return { type: "asset-added", planet: "media", text: `Asset mới${title ? `: ${title}` : ""}`, route: "/media-design", source: "HH Event Bus" };
    if (/learning.*complete|lesson.*complete/.test(name)) return { type: "lesson-completed", planet: "learning", text: `Đã hoàn thành bài học${title ? `: ${title}` : ""}`, route: "/learn", source: "HH Event Bus" };
    return null;
  }

  function dataSignatures(instance) {
    const planets = collectPlanetData(instance);
    const todos = asArray(readJson(TODO_KEY, []));
    const projects = readJson(PROJECT_KEY, {});
    const ai = readJson(AI_KEY, {});
    const communication = readJson(COMMUNICATION_KEY, {});
    const weather = readJson(WEATHER_KEY, {});
    return {
      taskCompleted: todos.filter((item) => item?.completed).length,
      taskCount: todos.length,
      projectUpdated: newestTimestamp(asArray(projects.projects)),
      aiSuccess: asArray(ai.runs).flatMap((run) => asArray(run?.versions)).filter((item) => item?.status === "success").length,
      unread: asArray(communication.notifications).filter((item) => item && !item.read).length,
      weatherTemp: Math.round(Number(weather?.payload?.weather?.current?.temperature_2m) || 0),
      weatherAqi: Math.round(Number(weather?.payload?.air?.current?.us_aqi) || 0),
      deployment: instance.deployment?.ok,
      healthSlow: Number(instance.healthEndpoints?.slowest?.latency || 0),
      planets
    };
  }

  function detectRealChanges(instance) {
    const next = dataSignatures(instance);
    const previous = instance.signatures;
    instance.signatures = next;
    if (!previous) return;
    if (next.taskCompleted > previous.taskCompleted) {
      addActivity(instance, { type: "task-completed", planet: "work", text: "Một task vừa được hoàn thành", route: "/work", source: "Todo Workspace", signature: `task-completed:${next.taskCompleted}` });
    } else if (next.taskCount > previous.taskCount) {
      addActivity(instance, { type: "task-created", planet: "work", text: "Todo Workspace có task mới", route: "/work", source: "Todo Workspace", signature: `task-count:${next.taskCount}` });
    }
    if (next.projectUpdated > previous.projectUpdated && previous.projectUpdated > 0) {
      addActivity(instance, { type: "project-updated", planet: "work", text: "Dự án vừa được cập nhật", route: "/work", source: "Project Center", signature: `project:${next.projectUpdated}` });
    }
    if (next.aiSuccess > previous.aiSuccess) {
      addActivity(instance, { type: "ai-completed", planet: "creative", text: "AI vừa hoàn tất nội dung mới", route: "/create/ai-center", source: "AI Center", signature: `ai:${next.aiSuccess}` });
    }
    if (next.unread > previous.unread) {
      addActivity(instance, { type: "message-new", planet: "communication", text: `${next.unread} thông báo chưa đọc`, route: "/communication", source: "Communication Intelligence", signature: `unread:${next.unread}` });
    }
    if (previous.weatherTemp && Math.abs(next.weatherTemp - previous.weatherTemp) >= 2) {
      addActivity(instance, { type: "weather-changed", planet: "analytics", text: `Nhiệt độ thay đổi ${previous.weatherTemp}°C → ${next.weatherTemp}°C`, route: "/home", source: "Open-Meteo", signature: `temp:${next.weatherTemp}` });
    }
    if (previous.weatherAqi && Math.abs(next.weatherAqi - previous.weatherAqi) >= 15) {
      addActivity(instance, { type: "aqi-changed", planet: "analytics", text: `AQI thay đổi ${previous.weatherAqi} → ${next.weatherAqi}`, route: "/home", source: "CAMS", signature: `aqi:${next.weatherAqi}` });
    }
    if (previous.deployment !== undefined && next.deployment !== previous.deployment) {
      addActivity(instance, { type: next.deployment ? "deployment-ready" : "deployment-failed", planet: "dev", text: next.deployment ? "Production đã phản hồi trở lại" : "Production không phản hồi", route: "/dev-tools", source: "Production probe", signature: `deploy:${next.deployment}:${Date.now()}` });
    }
    if (next.healthSlow > 1200 && previous.healthSlow <= 1200) {
      addActivity(instance, { type: "health-warning", planet: "analytics", text: `Endpoint chậm ${Math.round(next.healthSlow)} ms`, route: "/analytics", source: "Website Health", signature: `slow:${Math.round(next.healthSlow / 100)}` });
    }
  }

  function startAdaptiveQuality(instance) {
    let frames = 0;
    let last = global.performance?.now?.() || Date.now();
    let lagExpected = Date.now() + 1000;
    const frame = (time) => {
      if (instance.destroyed) return;
      if (!global.document.hidden) frames += 1;
      if (time - last >= 1000) {
        const fps = Math.round(frames * 1000 / Math.max(1, time - last));
        instance.fps = fps;
        instance.quality = fps < 35 ? "low" : fps < 52 ? "medium" : "high";
        instance.shell.dataset.quality = instance.quality;
        frames = 0;
        last = time;
      }
      instance.frame = global.requestAnimationFrame?.(frame);
    };
    instance.frame = global.requestAnimationFrame?.(frame);
    instance.lagTimer = setInterval(() => {
      const now = Date.now();
      instance.tabLag = Math.max(0, now - lagExpected);
      lagExpected = now + 1000;
    }, 1000);
  }

  function startCanvas(instance) {
    const canvas = instance.shell.querySelector("[data-hgm-canvas]");
    const context = canvas?.getContext?.("2d", { alpha: true });
    if (!canvas || !context) return;
    const stars = [];
    const reset = () => {
      const ratio = Math.min(2, global.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      stars.length = 0;
      const count = Math.round((instance.prefs.stars || 60) * (instance.quality === "low" ? .45 : instance.quality === "medium" ? .72 : 1.05));
      for (let index = 0; index < count; index += 1) stars.push({ x: Math.random() * rect.width, y: Math.random() * rect.height, z: .25 + Math.random() * .75, r: .4 + Math.random() * 1.3, hue: [188, 214, 276, 328, 44][index % 5] });
    };
    reset();
    const ResizeObserverType = global.ResizeObserver;
    if (ResizeObserverType) {
      instance.resizeObserver = new ResizeObserverType(reset);
      instance.resizeObserver.observe(canvas);
    }
    let previous = 0;
    const draw = (time) => {
      if (instance.destroyed) return;
      if (global.document.hidden || instance.prefs.motion === "static") {
        instance.canvasFrame = global.requestAnimationFrame?.(draw);
        return;
      }
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      context.clearRect(0, 0, width, height);
      const speed = instance.prefs.motion === "cinematic" ? .035 : .014;
      stars.forEach((star) => {
        star.y += speed * star.z * Math.min(32, time - previous || 16);
        if (star.y > height + 3) { star.y = -3; star.x = Math.random() * width; }
        context.beginPath();
        context.fillStyle = `hsla(${star.hue},90%,76%,${.25 + star.z * .58})`;
        context.arc(star.x + instance.pointerX * star.z * 8, star.y + instance.pointerY * star.z * 6, star.r * star.z, 0, Math.PI * 2);
        context.fill();
      });
      previous = time;
      instance.canvasFrame = global.requestAnimationFrame?.(draw);
    };
    instance.canvasFrame = global.requestAnimationFrame?.(draw);
    instance.resetCanvas = reset;
  }

  function openSettings(instance, open) {
    const settings = instance.shell.querySelector("[data-hgm-settings]");
    if (!settings) return;
    settings.hidden = !open;
    if (open) setTimeout(() => settings.querySelector("[data-hgm-settings-close]")?.focus(), 0);
  }

  function moveWidget(instance, id, direction) {
    const order = [...instance.prefs.widgetOrder];
    const index = order.indexOf(id);
    const target = clamp(index + Number(direction), 0, order.length - 1);
    if (index < 0 || index === target) return;
    const [item] = order.splice(index, 1);
    order.splice(target, 0, item);
    instance.prefs.widgetOrder = order;
    savePrefs(instance);
    rerenderSettings(instance);
  }

  function onClick(instance, event) {
    const target = event.target;
    if (target.closest("[data-hgm-settings-open]")) return openSettings(instance, true);
    if (target.closest("[data-hgm-settings-close]")) return openSettings(instance, false);
    if (target.closest("[data-hgm-focus-close]")) return closeFocus(instance);
    const planet = target.closest("[data-hgm-planet]");
    if (planet) return openFocus(instance, planet.dataset.hgmPlanet);
    const openWorkspace = target.closest("[data-hgm-open-workspace]");
    if (openWorkspace) {
      const item = PLANETS.find((planetItem) => planetItem.id === openWorkspace.dataset.hgmOpenWorkspace);
      if (item) navigate(item.route);
      return;
    }
    const pin = target.closest("[data-hgm-pin-planet]");
    if (pin) {
      instance.prefs.defaultPlanet = pin.dataset.hgmPinPlanet;
      savePrefs(instance);
      renderPlanets(instance);
      return;
    }
    const hideSignal = target.closest("[data-hgm-hide-signal]");
    if (hideSignal) {
      markPlanetRead(instance, hideSignal.dataset.hgmHideSignal);
      renderActivity(instance);
      renderPlanets(instance);
      announce(instance, "Đã ẩn tín hiệu đã xem.", "success");
      return;
    }
    const live = target.closest("[data-hgm-live-open]");
    if (live) {
      const card = live.closest("[data-hgm-widget]");
      const expanded = live.getAttribute("aria-expanded") === "true";
      instance.shell.querySelectorAll("[data-hgm-live-open]").forEach((button) => button.setAttribute("aria-expanded", "false"));
      instance.shell.querySelectorAll("[data-hgm-widget]").forEach((item) => item.classList.remove("is-expanded"));
      if (!expanded) { live.setAttribute("aria-expanded", "true"); card?.classList.add("is-expanded"); }
      return;
    }
    const activity = target.closest("[data-hgm-activity-id]");
    if (activity) {
      const item = instance.activities.find((row) => row.id === activity.dataset.hgmActivityId);
      if (item) {
        instance.activities = instance.activities.map((row) => row.id === item.id ? { ...row, read: true } : row);
        saveActivity(instance.activities);
        navigate(item.route);
      }
      return;
    }
    if (target.closest("[data-hgm-read-all]")) {
      instance.activities = instance.activities.map((item) => ({ ...item, read: true }));
      saveActivity(instance.activities);
      renderActivity(instance);
      renderPlanets(instance);
      return;
    }
    const action = target.closest("[data-hgm-action]");
    if (action) {
      const actionId = action.getAttribute("data-hgm-action");
      if (actionId === "task" || actionId === "note") return quickForm(instance, actionId);
      return handleAction(instance, actionId);
    }
    if (target.closest("[data-hgm-dock-toggle]")) {
      const dock = target.closest("[data-hgm-dock]");
      dock?.classList.toggle("is-open");
      target.closest("[data-hgm-dock-toggle]")?.setAttribute("aria-expanded", String(dock?.classList.contains("is-open")));
      return;
    }
    if (target.closest("[data-hgm-quick-close]")) {
      target.closest("form").hidden = true;
      return;
    }
    const theme = target.closest("[data-hgm-theme]");
    if (theme) { instance.prefs.theme = theme.dataset.hgmTheme; savePrefs(instance); rerenderSettings(instance); instance.resetCanvas?.(); return; }
    const motion = target.closest("[data-hgm-motion]");
    if (motion) { instance.prefs.motion = motion.dataset.hgmMotion; savePrefs(instance); rerenderSettings(instance); return; }
    const move = target.closest("[data-hgm-widget-move]");
    if (move) return moveWidget(instance, move.dataset.hgmWidgetMove, move.dataset.direction);
    if (target.closest("[data-hgm-export]")) {
      try { downloadJson(`hh-galaxy-config-${dayKey()}.json`, { schema: "hh-home-galaxy-preferences", version: 2, exportedAt: nowIso(), preferences: instance.prefs }); announce(instance, "Đã xuất cấu hình JSON.", "success"); }
      catch (error) { announce(instance, error.message, "warning"); }
      return;
    }
    if (target.closest("[data-hgm-account-sync]")) return syncAccount(instance, "auto");
    if (target.closest("[data-hgm-reset]")) {
      instance.prefs = normalizePrefs(DEFAULT_PREFS);
      savePrefs(instance);
      rerenderSettings(instance);
      instance.resetCanvas?.();
    }
  }

  function onChange(instance, event) {
    const input = event.target;
    if (input.matches("[data-hgm-asset-input]")) {
      if (input.files?.length) saveAssetMetadata(instance, input.files);
      input.value = "";
      return;
    }
    if (input.matches("[data-hgm-import]")) {
      const file = input.files?.[0];
      if (file) importPreferences(instance, file).catch((error) => announce(instance, error.message, "warning"));
      input.value = "";
      return;
    }
    if (input.matches("[data-hgm-stars]")) {
      instance.prefs.stars = clamp(input.value, 20, 100);
      savePrefs(instance);
      rerenderSettings(instance);
      instance.resetCanvas?.();
      return;
    }
    if (input.matches("[data-hgm-sound]")) {
      instance.prefs.sound = input.checked;
      savePrefs(instance);
      if (input.checked) playTone(instance, 580);
      return;
    }
    if (input.matches("[data-hgm-hide-unsupported]")) {
      instance.prefs.hideUnsupported = input.checked;
      savePrefs(instance);
      return;
    }
    if (input.matches("[data-hgm-default-planet]")) {
      instance.prefs.defaultPlanet = input.value;
      savePrefs(instance);
      return;
    }
    if (input.matches("[data-hgm-widget-toggle]")) {
      const id = input.dataset.hgmWidgetToggle;
      instance.prefs.widgets = input.checked ? [...new Set([...instance.prefs.widgets, id])] : instance.prefs.widgets.filter((item) => item !== id);
      savePrefs(instance);
      return;
    }
    if (input.matches("[data-hgm-widget-size]")) {
      instance.prefs.widgetSizes[input.dataset.hgmWidgetSize] = input.value;
      savePrefs(instance);
      return;
    }
    if (input.matches("[data-hgm-action-toggle]")) {
      const id = input.dataset.hgmActionToggle;
      if (input.checked && instance.prefs.pinnedActions.length >= 4) {
        input.checked = false;
        announce(instance, "Chỉ có thể ghim tối đa 4 hành động.", "warning");
        return;
      }
      instance.prefs.pinnedActions = input.checked ? [...new Set([...instance.prefs.pinnedActions, id])] : instance.prefs.pinnedActions.filter((item) => item !== id);
      savePrefs(instance);
    }
  }

  function onSubmit(instance, event) {
    const form = event.target.closest("[data-hgm-quick-form]");
    if (!form) return;
    event.preventDefault();
    const input = form.querySelector("[data-hgm-quick-input]");
    if (saveQuick(instance, instance.quickType, input?.value)) {
      form.hidden = true;
      refresh(instance, { effects: false });
      announce(instance, instance.quickType === "task" ? "Đã tạo task trong Todo Workspace." : "Đã tạo Sticky Note.", "success");
    } else input?.focus();
  }

  function onDragStart(instance, event) {
    const widget = event.target.closest("[data-hgm-widget],[data-hgm-setting-widget]");
    if (!widget) return;
    instance.draggedWidget = widget.dataset.hgmWidget || widget.dataset.hgmSettingWidget;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", instance.draggedWidget);
  }

  function onDragOver(instance, event) {
    if (instance.draggedWidget && event.target.closest("[data-hgm-widget],[data-hgm-setting-widget]")) event.preventDefault();
  }

  function onDrop(instance, event) {
    const target = event.target.closest("[data-hgm-widget],[data-hgm-setting-widget]");
    const targetId = target?.dataset.hgmWidget || target?.dataset.hgmSettingWidget;
    if (!targetId || !instance.draggedWidget || targetId === instance.draggedWidget) return;
    event.preventDefault();
    const order = [...instance.prefs.widgetOrder];
    const from = order.indexOf(instance.draggedWidget);
    const to = order.indexOf(targetId);
    if (from >= 0 && to >= 0) {
      const [moved] = order.splice(from, 1);
      order.splice(to, 0, moved);
      instance.prefs.widgetOrder = order;
      savePrefs(instance);
      rerenderSettings(instance);
    }
    instance.draggedWidget = "";
  }

  function bind(instance) {
    const shell = instance.shell;
    shell.addEventListener("click", (event) => onClick(instance, event));
    shell.addEventListener("change", (event) => onChange(instance, event));
    shell.addEventListener("submit", (event) => onSubmit(instance, event));
    shell.addEventListener("dragstart", (event) => onDragStart(instance, event));
    shell.addEventListener("dragover", (event) => onDragOver(instance, event));
    shell.addEventListener("drop", (event) => onDrop(instance, event));
    shell.addEventListener("pointermove", (event) => {
      if (instance.prefs.motion === "static") return;
      const rect = shell.getBoundingClientRect();
      instance.pointerX = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1) - .5;
      instance.pointerY = clamp((event.clientY - rect.top) / Math.max(1, Math.min(rect.height, global.innerHeight)), 0, 1) - .5;
      shell.style.setProperty("--hgm-pointer-x", `${(instance.pointerX + .5) * 100}%`);
      shell.style.setProperty("--hgm-pointer-y", `${(instance.pointerY + .5) * 100}%`);
    }, { passive: true });
    shell.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeFocus(instance);
        openSettings(instance, false);
      }
    });
    global.addEventListener("hh:event", (event) => {
      const mapped = mapEventToActivity(event.detail);
      if (mapped) {
        addActivity(instance, { ...mapped, signature: `${event.detail?.eventName}:${event.detail?.meta?.timestamp || Date.now()}` });
        instance.signatures = dataSignatures(instance);
      }
    }, { signal: instance.controller.signal });
    global.addEventListener("hh:communication:notification", (event) => {
      addActivity(instance, { type: "message-new", planet: "communication", text: `Tin nhắn mới${event.detail?.title ? `: ${cleanText(event.detail.title, 90)}` : ""}`, route: "/communication", source: "Communication Intelligence", signature: `communication:${event.detail?.id || Date.now()}` });
    }, { signal: instance.controller.signal });
    global.addEventListener("hh:realtime-ready", () => {
      addActivity(instance, { type: "realtime-ready", planet: "communication", text: "Realtime server đã kết nối", route: "/communication", source: "Socket.IO", signature: `realtime:ready:${Math.floor(Date.now() / 60000)}` });
      refresh(instance);
    }, { signal: instance.controller.signal });
    global.addEventListener("hh:realtime-offline", () => {
      addActivity(instance, { type: "realtime-offline", planet: "communication", text: "Realtime server đang ngoại tuyến", route: "/communication", source: "Socket.IO", signature: `realtime:offline:${Math.floor(Date.now() / 60000)}` });
      refresh(instance);
    }, { signal: instance.controller.signal });
    global.addEventListener("hh:auth-change", () => {
      instance.syncStatus = isSignedIn() ? "Đang kiểm tra cấu hình tài khoản" : "Khách · lưu trên thiết bị";
      scheduleAccountSync(instance, "auto");
      refresh(instance);
    }, { signal: instance.controller.signal });
    global.addEventListener("online", () => { addActivity(instance, { type: "network-online", planet: "system", text: "Kết nối mạng đã trở lại", route: "/settings", source: "Navigator", signature: `online:${Math.floor(Date.now() / 60000)}` }); refresh(instance); }, { signal: instance.controller.signal });
    global.addEventListener("offline", () => { addActivity(instance, { type: "network-offline", planet: "system", text: "Trình duyệt đang offline", route: "/settings", source: "Navigator", signature: `offline:${Math.floor(Date.now() / 60000)}` }); refresh(instance); }, { signal: instance.controller.signal });
    global.document.addEventListener("visibilitychange", () => {
      shell.dataset.paused = String(global.document.hidden);
    }, { signal: instance.controller.signal });
    bindDockActions(instance);
  }

  function bindDockActions(instance) {
    instance.shell.querySelectorAll("[data-hgm-action]").forEach((button) => {
      if (button.dataset.hgmBound === "true") return;
      button.dataset.hgmBound = "true";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const actionId = button.getAttribute("data-hgm-action");
        if (actionId === "task" || actionId === "note") quickForm(instance, actionId);
        else handleAction(instance, actionId);
      }, { signal: instance.controller.signal });
    });
  }

  async function refresh(instance, options = {}) {
    if (!instance || instance.destroyed || instance.refreshing) return;
    instance.refreshing = true;
    try {
      scanResources(instance);
      readHealthEndpoints(instance);
      await Promise.allSettled([
        readStorageSnapshot(instance),
        readPwaSnapshot(instance),
        readPermissions(instance),
        fetchHealth(instance, options.force),
        fetchGit(instance),
        checkDeployment(instance)
      ]);
      instance.root.dataset.hgcPeriod = period().id;
      const online = instance.shell.querySelector("[data-hgm-online]");
      if (online) online.textContent = global.navigator?.onLine === false ? "OFFLINE" : "ONLINE";
      const clock = instance.shell.querySelector("[data-hgm-clock]");
      if (clock) clock.textContent = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      detectRealChanges(instance);
      renderLive(instance);
      renderPlanets(instance);
      if (options.effects && instance.deployment?.ok) setAurora(instance, "ready");
    } finally {
      instance.refreshing = false;
    }
  }

  function mount(root = global.document?.querySelector?.("[data-hgc-root]")) {
    if (!root || instances.has(root)) return instances.get(root)?.api || false;
    const controller = new AbortController();
    const instance = {
      root,
      shell: null,
      prefs: readPrefs(),
      activities: readActivity(),
      histories: Object.fromEntries(WIDGETS.map((item) => [item.id, []])),
      vitals: {},
      resources: {},
      storage: {},
      pwa: {},
      permissions: {},
      health: {},
      healthEndpoints: {},
      git: null,
      deployment: null,
      quality: "high",
      fps: null,
      tabLag: null,
      pointerX: 0,
      pointerY: 0,
      observers: [],
      controller,
      destroyed: false,
      refreshing: false,
      focusPlanet: "",
      signatures: null,
      syncStatus: isSignedIn() ? "Đang kiểm tra cấu hình tài khoản" : "Khách · lưu trên thiết bị",
      healthFetchedAt: 0,
      gitFetchedAt: 0,
      deploymentFetchedAt: 0
    };
    root.classList.add("hgm-active");
    root.innerHTML = markup(instance);
    instance.shell = root.querySelector("[data-hgm-shell]");
    instances.set(root, instance);
    bind(instance);
    startPerformanceObservers(instance);
    scanResources(instance);
    startAdaptiveQuality(instance);
    startCanvas(instance);
    instance.signatures = dataSignatures(instance);
    renderActivity(instance);
    renderLive(instance);
    renderPlanets(instance);
    refresh(instance, { force: true });
    instance.interval = setInterval(() => {
      if (!global.document.hidden) refresh(instance);
    }, 5000);
    instance.remoteInterval = setInterval(() => {
      if (!global.document.hidden) refresh(instance, { force: true });
    }, 60_000);
    if (isSignedIn()) scheduleAccountSync(instance, "auto");
    const api = Object.freeze({
      version: VERSION,
      refresh: () => refresh(instance, { force: true }),
      preferences: () => JSON.parse(JSON.stringify(instance.prefs)),
      planetData: () => JSON.parse(JSON.stringify(instance.planetData || {})),
      liveData: () => JSON.parse(JSON.stringify(instance.liveData || {})),
      activity: () => JSON.parse(JSON.stringify(instance.activities)),
      openPlanet: (id) => openFocus(instance, id),
      sync: () => syncAccount(instance, "auto"),
      destroy: () => unmount(root)
    });
    instance.api = api;
    return api;
  }

  function unmount(root) {
    const instance = instances.get(root);
    if (!instance) return false;
    instance.destroyed = true;
    instance.controller.abort();
    clearInterval(instance.interval);
    clearInterval(instance.remoteInterval);
    clearInterval(instance.lagTimer);
    clearTimeout(instance.syncTimer);
    global.cancelAnimationFrame?.(instance.frame);
    global.cancelAnimationFrame?.(instance.canvasFrame);
    instance.observers.forEach((observer) => observer.disconnect?.());
    instance.resizeObserver?.disconnect?.();
    instance.audio?.close?.();
    root.classList.remove("hgm-active");
    root.innerHTML = "";
    instances.delete(root);
    return true;
  }

  function autoMount() {
    const attach = () => {
      const root = global.document?.querySelector?.("[data-hgc-root]");
      if (!root) return false;
      mount(root);
      return true;
    };
    const start = () => {
      if (attach() || !global.MutationObserver) return;
      const observer = new global.MutationObserver(() => { if (attach()) observer.disconnect(); });
      observer.observe(global.document.documentElement, { childList: true, subtree: true });
    };
    if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
    global.addEventListener?.("hh:assets-ready", (event) => { if (event.detail?.route === "/home") setTimeout(attach, 0); });
    global.addEventListener?.("hashchange", () => { if (global.location.hash.includes("/home")) setTimeout(attach, 0); });
    return true;
  }

  return Object.freeze({
    VERSION,
    PREF_KEY,
    ACTIVITY_KEY,
    PLANETS,
    WIDGETS,
    ACTIONS,
    normalizePrefs,
    collectPlanetData,
    metricRating,
    mount,
    unmount,
    autoMount
  });
});
