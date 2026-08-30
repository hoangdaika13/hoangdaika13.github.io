(function (root, factory) {
  "use strict";

  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHGalaxyHomeAI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (globalScope) {
  "use strict";

  const VERSION = "1.1.0";
  const HOME_PREF_KEY = "hh.galaxy.home.preferences.v1";
  const FOCUS_KEY = "hh.galaxy.dashboard.focus.v1";
  const TASK_KEY = "hh.command-center.todos.v2";
  const NOTE_KEY = "hh.dashboard.sticky-notes.v1";
  const NOTIFICATION_KEY = "hh-notification-center";
  const PROJECT_KEYS = Object.freeze(["hh.creative-os.v1", "hh-project-center"]);
  const ROUTES = Object.freeze(["/home", "/home/dashboard", "/create/ai-center", "/chat-ai"]);
  const PLANETS = Object.freeze([
    { id: "music", label: "Music Planet", note: "Nhạc và âm thanh", route: "/galaxy/music", tone: "cyan", x: 27.96, y: 13.47, size: 82 },
    { id: "video", label: "Video Planet", note: "Video và điện ảnh", route: "/galaxy/video", tone: "orange", x: 58.82, y: 15.9, size: 72 },
    { id: "creator", label: "Creator Studio", note: "Không gian sáng tạo", route: "/galaxy/creator", tone: "violet", x: 75.14, y: 30.09, size: 80 },
    { id: "dev", label: "Dev Planet", note: "Code và công cụ", route: "/galaxy/dev", tone: "blue", x: 74.57, y: 51.29, size: 78 },
    { id: "community", label: "Community", note: "Kết nối cộng đồng", route: "/galaxy/community", tone: "aqua", x: 61.42, y: 65.47, size: 78 },
    { id: "tools", label: "Tools Galaxy", note: "Tiện ích chuyên dụng", route: "/galaxy/tools", tone: "violet", x: 40.32, y: 73.21, size: 82 },
    { id: "learn", label: "Learning Star", note: "Học tập và ngôn ngữ", route: "/galaxy/learning", tone: "blue", x: 22.4, y: 62.75, size: 82 },
    { id: "games", label: "Games World", note: "Trò chơi và giải trí", route: "/galaxy/games", tone: "pink", x: 8.45, y: 45.56, size: 78 },
    { id: "ai", label: "AI Universe", note: "AI và trợ lý", route: "/galaxy/ai", tone: "amber", x: 14.96, y: 27.79, size: 82 }
  ]);
  const HOME_NAV_ITEMS = Object.freeze([
    { id: "home", label: "Trang chủ", route: "/home" },
    { id: "ai", label: "AI Universe", route: "/galaxy/ai" },
    { id: "music", label: "Music Planet", route: "/galaxy/music" },
    { id: "video", label: "Video Planet", route: "/galaxy/video" },
    { id: "creator", label: "Creator Studio", route: "/galaxy/creator" },
    { id: "games", label: "Games World", route: "/galaxy/games" },
    { id: "dev", label: "Dev Planet", route: "/galaxy/dev" },
    { id: "learn", label: "Learning Star", route: "/galaxy/learning" },
    { id: "community", label: "Community", route: "/galaxy/community" },
    { id: "tools", label: "Tools Galaxy", route: "/galaxy/tools" },
    { id: "analytics", label: "Analytics", route: "/galaxy/analytics" },
    { id: "settings", label: "Cài đặt", route: "/galaxy/settings" }
  ]);
  const AI_DESTINATIONS = Object.freeze([
    { id: "chat", label: "AI Chat", description: "Trò chuyện bằng engine HH AI hiện có", route: "/chat-ai", glyph: "CH", x: 72, y: 17 },
    { id: "prompt", label: "Prompt Studio", description: "Thiết kế prompt có cấu trúc", route: "/create/prompt-studio", glyph: "PR", x: 82, y: 42 },
    { id: "image", label: "Image AI", description: "Mở AI Task Center cho hình ảnh", route: "/media-design/ai-task-center", glyph: "IM", x: 76, y: 68 },
    { id: "script", label: "Script Generator", description: "Viết và quản lý kịch bản", route: "/create/ai-script", glyph: "SC", x: 61, y: 82 }
  ]);

  let activeRuntime = null;

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[character]));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const asArray = (value) => Array.isArray(value) ? value : [];
  const isObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));

  function formatDate(value, withTime = false) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    try {
      return withTime
        ? date.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })
        : date.toLocaleDateString("vi-VN");
    } catch {
      return "";
    }
  }

  function normalizeRoute(value) {
    const raw = String(value || "/home").trim().replace(/^#/, "").split("?")[0].split("#")[0] || "/home";
    const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
    return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : withSlash;
  }

  function canHandle(value) {
    const route = normalizeRoute(value);
    return route === "/home" || route === "/home/dashboard" || route === "/create/ai-center" || route === "/chat-ai" || route.startsWith("/chat-ai/");
  }

  function readRecord(storage, key) {
    try {
      const raw = storage?.getItem?.(key);
      if (raw == null) return { found: false, value: null };
      return { found: true, value: JSON.parse(raw) };
    } catch {
      return { found: false, value: null, invalid: true };
    }
  }

  function writeRecord(storage, key, value) {
    try {
      storage?.setItem?.(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function normalizeTask(task, index) {
    if (!isObject(task)) return null;
    const title = String(task.title || task.text || "").trim().slice(0, 240);
    if (!title) return null;
    return {
      id: String(task.id || `task-${index}`),
      title,
      completed: Boolean(task.completed ?? task.done),
      category: String(task.category || "").trim().slice(0, 80),
      deadline: String(task.deadline || "").trim().slice(0, 40),
      rawIndex: index
    };
  }

  function normalizeProject(project, index) {
    if (!isObject(project)) return null;
    const name = String(project.name || project.title || "").trim().slice(0, 180);
    if (!name) return null;
    const progressValue = Number(project.progress ?? project.completion);
    return {
      id: String(project.id || project._id || `project-${index}`),
      name,
      progress: Number.isFinite(progressValue) ? clamp(progressValue, 0, 100) : null,
      updatedAt: project.updatedAt || project.updated || null
    };
  }

  function normalizeNote(note, index) {
    if (typeof note === "string") return note.trim() ? { id: `note-${index}`, text: note.trim().slice(0, 4000), pinned: false } : null;
    if (!isObject(note)) return null;
    const text = String(note.text || note.content || "").trim().slice(0, 4000);
    return text ? { id: String(note.id || `note-${index}`), text, pinned: Boolean(note.pinned), updatedAt: note.updatedAt || null } : null;
  }

  function firstProjectCollection(storage) {
    for (const key of PROJECT_KEYS) {
      const record = readRecord(storage, key);
      if (!record.found || !isObject(record.value)) continue;
      const candidates = [record.value.projects, record.value.items, record.value.data?.projects];
      const collection = candidates.find(Array.isArray);
      if (collection) return { key, items: collection.map(normalizeProject).filter(Boolean), found: true };
    }
    return { key: null, items: [], found: false };
  }

  function readNotificationSnapshot(storage) {
    const record = readRecord(storage, NOTIFICATION_KEY);
    const inbox = asArray(record.value?.inbox).filter((item) => isObject(item));
    return {
      unreadCount: clamp(inbox.filter((item) => !item.read).length, 0, 999),
      totalCount: clamp(inbox.length, 0, 999),
      found: record.found && Array.isArray(record.value?.inbox)
    };
  }

  function collectLocalData(storage = globalScope.localStorage, scope = globalScope) {
    const storedAuth = readRecord(storage, "hh-auth-user");
    const sessionAuth = storedAuth.found ? { found: false, value: null } : readRecord(scope.sessionStorage, "hh.auth.guest-user");
    let runtimeAuth = { found: false, value: null };
    if (!storedAuth.found && !sessionAuth.found && typeof scope.HHAuthz?.currentUser === "function") {
      try {
        const value = scope.HHAuthz.currentUser();
        runtimeAuth = { found: isObject(value), value };
      } catch { /* Authentication adapters may not be ready during first paint. */ }
    }
    const auth = storedAuth.found ? storedAuth : sessionAuth.found ? sessionAuth : runtimeAuth;
    const tasks = readRecord(storage, TASK_KEY);
    const notes = readRecord(storage, NOTE_KEY);
    const favorites = readRecord(storage, "hh-module-favorites");
    const activity = readRecord(storage, "hh.command-center.activity.v1");
    const weather = readRecord(storage, "hh.dashboard.weather.v1");
    const projects = firstProjectCollection(storage);
    const notifications = readNotificationSnapshot(storage);
    const taskItems = asArray(tasks.value).map(normalizeTask).filter(Boolean);
    const noteItems = asArray(notes.value).map(normalizeNote).filter(Boolean).sort((left, right) => Number(right.pinned) - Number(left.pinned));
    const weatherPayload = isObject(weather.value?.payload) ? weather.value.payload : {};
    const currentWeather = isObject(weatherPayload.weather?.current) ? weatherPayload.weather.current : {};
    const modules = asArray(scope.HH_PLATFORM_MODULES).filter((item) => isObject(item) && item.id);
    const local = {
      account: auth.found && isObject(auth.value) ? {
        name: String(auth.value.name || auth.value.displayName || "").trim().slice(0, 120),
        avatar: String(auth.value.avatar || auth.value.picture || "").trim(),
        email: String(auth.value.email || "").trim().slice(0, 180)
      } : null,
      projects: projects.items,
      tasks: taskItems,
      notes: noteItems,
      favorites: asArray(favorites.value).filter((item) => typeof item === "string").slice(0, 100),
      activity: asArray(activity.value).filter((item) => typeof item === "string" || isObject(item)).slice(0, 20),
      weather: weather.found && Number.isFinite(Number(currentWeather.temperature_2m)) ? {
        temperature: Number(currentWeather.temperature_2m),
        humidity: Number.isFinite(Number(currentWeather.relative_humidity_2m)) ? Number(currentWeather.relative_humidity_2m) : null,
        windSpeed: Number.isFinite(Number(currentWeather.wind_speed_10m)) ? Number(currentWeather.wind_speed_10m) : null,
        location: String(weather.value?.location?.name || "").trim().slice(0, 120),
        observedAt: weather.value?.savedAt || weather.value?.updatedAt || null
      } : null,
      notifications,
      modules,
      capability: {
        chat: typeof scope.HHChatAI?.mount === "function" ? "ready" : "configuration-required",
        online: typeof scope.navigator?.onLine === "boolean" ? scope.navigator.onLine : null
      },
      evidence: {
        account: auth.found,
        projects: projects.found,
        tasks: tasks.found,
        notes: notes.found,
        favorites: favorites.found,
        activity: activity.found,
        weather: weather.found,
        notifications: notifications.found,
        modules: Array.isArray(scope.HH_PLATFORM_MODULES)
      },
      source: "local"
    };
    Object.defineProperty(local, "_raw", {
      enumerable: false,
      value: { taskItems: asArray(tasks.value), noteItems: asArray(notes.value), projectKey: projects.key }
    });
    return local;
  }

  function mergeData(local, provided) {
    if (!isObject(provided)) return local;
    const result = { ...local, source: String(provided.source || "passed-api") };
    for (const key of ["projects", "tasks", "notes", "favorites", "activity", "modules"]) {
      if (!Object.prototype.hasOwnProperty.call(provided, key)) continue;
      if (key === "projects") result[key] = asArray(provided[key]).map(normalizeProject).filter(Boolean);
      else if (key === "tasks") result[key] = asArray(provided[key]).map((item, index) => {
        const task = normalizeTask(item, index);
        if (task) delete task.rawIndex;
        return task;
      }).filter(Boolean);
      else if (key === "notes") result[key] = asArray(provided[key]).map(normalizeNote).filter(Boolean);
      else result[key] = asArray(provided[key]);
      result.evidence = { ...result.evidence, [key]: true };
    }
    if (Object.prototype.hasOwnProperty.call(provided, "account")) {
      result.account = isObject(provided.account) ? { ...provided.account } : null;
      result.evidence = { ...result.evidence, account: true };
    }
    if (Object.prototype.hasOwnProperty.call(provided, "weather")) {
      result.weather = isObject(provided.weather) ? { ...provided.weather } : null;
      result.evidence = { ...result.evidence, weather: true };
    }
    if (Object.prototype.hasOwnProperty.call(provided, "notifications")) {
      const value = isObject(provided.notifications) ? provided.notifications : {};
      result.notifications = {
        unreadCount: clamp(value.unreadCount, 0, 999),
        totalCount: clamp(value.totalCount, 0, 999),
        found: Boolean(value.found)
      };
      result.evidence = { ...result.evidence, notifications: Boolean(value.found) };
    }
    if (isObject(provided.capability)) result.capability = { ...result.capability, ...provided.capability };
    if (isObject(provided.evidence)) result.evidence = { ...result.evidence, ...provided.evidence };
    Object.defineProperty(result, "_raw", { enumerable: false, value: local._raw || {} });
    return result;
  }

  function initials(name) {
    return String(name || "HH").trim().split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase().slice(0, 2) || "HH";
  }

  function safeImageUrl(value) {
    const url = String(value || "").trim();
    if (!url || url.length > 2048) return "";
    if (/^(?:https?:\/\/|\/[^/]|\.\.?\/)/i.test(url)) return escapeHtml(url);
    if (/^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(url) && url.length <= 1048576) return escapeHtml(url);
    return "";
  }

  function iconMarkup(id, className = "") {
    const icons = {
      home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10M9 20v-6h6v6"/>',
      ai: '<rect x="5" y="5" width="14" height="14" rx="3"/><path d="M9 9h6v6H9zM9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/>',
      music: '<path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
      video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
      creator: '<path d="m12 3 2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8z"/>',
      games: '<path d="M7.5 8h9a5 5 0 0 1 4.6 6.9l-1.3 3.2a2.2 2.2 0 0 1-3.7.7L14.5 17h-5l-1.6 1.8a2.2 2.2 0 0 1-3.7-.7l-1.3-3.2A5 5 0 0 1 7.5 8Z"/><path d="M8 11v4m-2-2h4m6-1h.01m2 2h.01"/>',
      dev: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9"/>',
      learn: '<path d="m3 9 9-5 9 5-9 5z"/><path d="M7 12v4c2.8 2.2 7.2 2.2 10 0v-4m4-3v7"/>',
      community: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20v-2a5 5 0 0 1 10 0v2m1.5-5.5A4.5 4.5 0 0 1 21 18.6V20"/>',
      tools: '<path d="m14 6 4-4 4 4-4 4M2 18l4 4 4-4-4-4zM8 16l8-8"/><path d="m4 4 16 16"/>',
      analytics: '<path d="M4 20V10m5 10V4m6 16v-7m5 7V7M2 20h20"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
      user: '<circle cx="12" cy="8" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
      resource: '<path d="m12 3 8 4-8 4-8-4zM4 12l8 4 8-4M4 17l8 4 8-4"/>',
      globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
      bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
      compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
      fullscreen: '<path d="M8 3H3v5m13-5h5v5M8 21H3v-5m13 5h5v-5"/>',
      send: '<path d="m3 11 18-8-8 18-2-8zM11 13l4-4"/>',
      chevron: '<path d="m9 18 6-6-6-6"/>',
      diamond: '<path d="m12 2 9 8-9 12L3 10zM3 10h18M8 2l-2 8 6 12 6-12-2-8"/>',
      folder: '<path d="M3 6h7l2 2h9v11H3z"/>',
      layers: '<path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
      activity: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
      task: '<path d="M9 5h11v15H4V5h2m3 7 2 2 4-5"/><path d="M8 3h8v4H8z"/>'
    };
    const body = icons[id] || icons.globe;
    return `<svg${className ? ` class="${escapeHtml(className)}"` : ""} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
  }

  function accountAvatarMarkup(account, className = "") {
    const name = String(account?.name || "Thành viên HH").trim();
    const avatar = safeImageUrl(account?.avatar);
    return `<span${className ? ` class="${escapeHtml(className)}"` : ""}>${avatar ? `<img src="${avatar}" alt="">` : escapeHtml(initials(name))}</span>`;
  }

  function sourceLabel(data) {
    if (data.source === "local") return "Dữ liệu trên thiết bị";
    if (data.source === "loading") return "Đang đồng bộ nguồn được cấp";
    return "Dữ liệu từ nguồn đã kết nối";
  }

  function metricMarkup(label, value, available, route) {
    const content = available ? escapeHtml(value) : "—";
    const state = available ? "ready" : "empty";
    return `<button class="gha-metric" type="button" data-gha-route="${escapeHtml(route)}" data-state="${state}"><span>${escapeHtml(label)}</span><strong>${content}</strong><small>${available ? "Dữ liệu hiện có" : "Chưa có dữ liệu"}</small></button>`;
  }

  function topbarMarkup(title, subtitle, active) {
    return `<header class="gha-topbar">
      <a class="gha-brand" href="#/home" data-gha-route="/home" aria-label="Về Home Galaxy"><span aria-hidden="true">HH</span><b>HOANG8.COM</b></a>
      <label class="gha-search"><span aria-hidden="true">⌕</span><input type="search" data-gha-search placeholder="Tìm trong không gian này..." aria-label="Tìm trong không gian này"><kbd>⌘K</kbd></label>
      <div class="gha-topbar__copy"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(subtitle)}</small></div>
      <nav aria-label="Điều hướng nhanh"><button type="button" data-gha-route="/home" ${active === "home" ? 'aria-current="page"' : ""}>Bản đồ</button><button type="button" data-gha-route="/home/dashboard" ${active === "dashboard" ? 'aria-current="page"' : ""}>Dashboard</button><button type="button" data-gha-route="/create/ai-center" ${active === "ai" ? 'aria-current="page"' : ""}>AI</button></nav>
    </header>`;
  }

  function sidebarMarkup(active) {
    const items = [
      ["home", "Home Galaxy", "/home", "HG"], ["ai", "AI Universe", "/create/ai-center", "AI"], ["music", "Music Planet", "/music-ai", "MU"],
      ["video", "Video Planet", "/davinci-resolve", "VI"], ["creator", "Creator Studio", "/create", "CR"], ["games", "Games World", "/play", "GA"],
      ["dev", "Dev Planet", "/dev-tools", "DV"], ["learn", "Learning Star", "/learn", "LE"], ["community", "Community", "/communication/community", "CO"], ["tools", "Tools Galaxy", "/work", "TO"]
    ];
    return `<aside class="gha-sidebar"><div class="gha-sidebar__title"><span>HH GALAXY</span><small>Điều hướng chức năng</small></div><nav aria-label="Các không gian HH">${items.map(([id, label, route, glyph]) => `<button type="button" data-gha-route="${route}" ${active === id ? 'aria-current="page"' : ""}><i aria-hidden="true">${glyph}</i><span>${label}</span></button>`).join("")}</nav><footer><span class="gha-live-dot" aria-hidden="true"></span><div><strong data-gha-network>Đang kiểm tra</strong><small>Trạng thái trình duyệt</small></div></footer></aside>`;
  }

  function homeSidebarMarkup(data) {
    const account = data.account;
    const name = String(account?.name || "Thành viên HH").trim().slice(0, 120);
    const accountDetail = String(account?.email || (data.evidence.account ? "Tài khoản HH" : "Chưa đăng nhập")).trim().slice(0, 180);
    return `<aside class="gha-sidebar gha-home-sidebar" aria-label="Điều hướng HH Galaxy">
      <a class="gha-home-brand" href="#/home" data-gha-route="/home" aria-label="HOANG8.COM — Trang chủ">
        <span class="gha-home-brand__mark" aria-hidden="true">HH</span>
        <strong>HOANG8.COM</strong>
        <small>PRO</small>
      </a>
      <label class="gha-search gha-home-search">
        ${iconMarkup("globe")}
        <span class="gha-sr-only">Tìm chức năng trong Galaxy</span>
        <input type="search" data-gha-search autocomplete="off" maxlength="80" placeholder="Tìm kiếm trong galaxy..." aria-label="Tìm chức năng trong Galaxy">
        <kbd>⌘K</kbd>
      </label>
      <nav class="gha-home-nav" aria-label="Các không gian HH">${HOME_NAV_ITEMS.map((item) => `<button type="button" data-gha-route="${escapeHtml(item.route)}" data-gha-nav-item="${escapeHtml(item.id)}" data-gha-searchable ${item.id === "home" ? 'aria-current="page"' : ""}>${iconMarkup(item.id)}<span>${escapeHtml(item.label)}</span>${item.id === "home" ? iconMarkup("chevron", "gha-home-nav__arrow") : ""}</button>`).join("")}</nav>
      <p class="gha-home-search-empty" data-gha-search-empty hidden role="status">Không tìm thấy chức năng phù hợp.</p>
      <section class="gha-home-customize" aria-labelledby="gha-customize-title">
        ${iconMarkup("diamond")}
        <div><h2 id="gha-customize-title">Tùy chỉnh Galaxy</h2><p>Màu sắc, chuyển động và bố cục theo cách của bạn.</p></div>
        <button type="button" data-gha-route="/settings">Mở cài đặt ${iconMarkup("chevron")}</button>
      </section>
      <button class="gha-home-profile" type="button" data-user-menu-toggle aria-haspopup="menu" aria-expanded="false" aria-label="Mở menu tài khoản của ${escapeHtml(name)}">
        ${accountAvatarMarkup(account, "gha-home-profile__avatar")}
        <span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(accountDetail)}</small></span>
        <i aria-hidden="true">⌄</i>
      </button>
    </aside>`;
  }

  function homeTopbarMarkup(data) {
    const account = data.account;
    const name = String(account?.name || "Tài khoản").trim().slice(0, 120);
    const unreadCount = clamp(data.notifications?.unreadCount, 0, 999);
    const notificationBadge = unreadCount ? `<span class="gha-home-notification__badge" aria-label="${unreadCount} thông báo chưa đọc">${unreadCount > 99 ? "99+" : unreadCount}</span>` : "";
    return `<header class="gha-topbar gha-home-topbar">
      <div class="gha-home-topbar__title">${iconMarkup("globe")}<span><strong>HH GALAXY MAP 3D <i>BETA</i></strong><small>Khám phá vũ trụ số · Kết nối không giới hạn</small></span></div>
      <section class="gha-home-player" aria-label="Lối tắt đến trình phát nhạc">
        <button class="gha-home-player__cover" type="button" data-gha-route="/music/ambient" aria-label="Mở Ambient Room">${iconMarkup("music")}</button>
        <button class="gha-home-player__copy" type="button" data-gha-route="/music/ambient"><strong>Ambient Room</strong><small>Trình phát nhạc HH</small></button>
        <div class="gha-home-player__controls">
          <button type="button" data-gha-route="/music/ambient" aria-label="Mở danh sách nhạc"><span aria-hidden="true">|◀</span></button>
          <button type="button" data-gha-route="/music/ambient" aria-label="Mở trình phát nhạc"><span aria-hidden="true">▶</span></button>
          <button type="button" data-gha-route="/music/ambient" aria-label="Mở bài tiếp theo"><span aria-hidden="true">▶|</span></button>
        </div>
        <span class="gha-home-player__wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
        <small class="gha-home-player__state">Mở player</small>
      </section>
      <div class="gha-home-topbar__actions">
        <button class="gha-home-notification" type="button" data-notification-toggle aria-haspopup="true" aria-expanded="false" aria-label="Mở thông báo">${iconMarkup("bell")}${notificationBadge}</button>
        <button class="gha-home-user" type="button" data-user-menu-toggle aria-haspopup="menu" aria-expanded="false" aria-label="Mở menu tài khoản của ${escapeHtml(name)}">${accountAvatarMarkup(account, "gha-home-user__avatar")}<span>${escapeHtml(name)}</span><i aria-hidden="true">⌄</i></button>
      </div>
    </header>`;
  }

  function planetIconMarkup(id) {
    return `<span class="gha-planet__sphere" aria-hidden="true">${iconMarkup(id)}</span>`;
  }

  function homeMetricMarkup(icon, label, value, detail, available, route) {
    return `<button class="gha-home-stat" type="button" data-gha-route="${escapeHtml(route)}" data-state="${available ? "ready" : "empty"}">
      <span class="gha-home-stat__icon" aria-hidden="true">${iconMarkup(icon)}</span>
      <span><small>${escapeHtml(label)}</small><strong>${available ? escapeHtml(value) : "—"}</strong><em>${available ? escapeHtml(detail) : "Chưa có dữ liệu"}</em></span>
    </button>`;
  }

  function homeTimelineMarkup(data) {
    const items = data.evidence.activity ? asArray(data.activity).slice(0, 2) : [];
    const content = items.length ? `<ol>${items.map((item) => {
      const label = typeof item === "string" ? item : String(item.action || item.title || item.label || "Hoạt động đã lưu");
      const time = typeof item === "string" ? "" : formatDate(item.at || item.createdAt || item.updatedAt, true);
      return `<li><span aria-hidden="true">${iconMarkup("activity")}</span><div><strong>${escapeHtml(label.slice(0, 180))}</strong><small>${time ? escapeHtml(time) : "Đã lưu trên thiết bị"}</small></div></li>`;
    }).join("")}</ol>` : `<div class="gha-home-timeline__empty" data-state="empty"><span>${iconMarkup("activity")}</span><p>Chưa có hoạt động đã lưu.</p></div>`;
    return `<aside class="gha-home-timeline" aria-labelledby="gha-timeline-title"><header><h2 id="gha-timeline-title">Galaxy Timeline</h2><button type="button" data-gha-route="/analytics">Xem tất cả ${iconMarkup("chevron")}</button></header>${content}</aside>`;
  }

  function homeDockMarkup(data) {
    const projectsAvailable = Boolean(data.evidence.projects);
    const tasksAvailable = Boolean(data.evidence.tasks);
    const taskCount = asArray(data.tasks).length;
    const completedTasks = asArray(data.tasks).filter((task) => task.completed).length;
    return `<footer class="gha-home-dock" aria-label="Trạng thái và dữ liệu Galaxy">
      <section class="gha-home-status" aria-labelledby="gha-status-title">
        <header><span class="gha-live-dot" aria-hidden="true"></span><div><h2 id="gha-status-title">Galaxy Status</h2><strong data-gha-network>Đang kiểm tra</strong></div></header>
        <p data-gha-network-copy>Kết nối trình duyệt</p>
        <small>${escapeHtml(sourceLabel(data))}</small>
      </section>
      <section class="gha-home-stats" aria-label="Số liệu thật của tài khoản">
        ${homeMetricMarkup("user", "Thành viên", "1", "Tài khoản đang hoạt động", Boolean(data.evidence.account), "/settings")}
        ${homeMetricMarkup("folder", "Dự án", String(asArray(data.projects).length), "Trong workspace", projectsAvailable, "/work/projects-tasks")}
        <button class="gha-home-stat gha-home-stat--storage" type="button" data-gha-route="/settings" data-state="loading">
          <span class="gha-home-stat__icon" aria-hidden="true">${iconMarkup("resource")}</span>
          <span><small>Tài nguyên</small><strong data-gha-storage-value>—</strong><em data-gha-storage-detail>Đang đọc Storage API…</em><i data-gha-storage-state data-state="loading">Đang đo</i><b data-gha-storage-bar style="--usage:0%"></b></span>
        </button>
        <button class="gha-home-stat" type="button" data-gha-route="/analytics" data-state="${tasksAvailable ? "ready" : "empty"}">
          <span class="gha-home-stat__icon" aria-hidden="true">${iconMarkup("activity")}</span>
          <span><small>Hoạt động</small><strong>${tasksAvailable ? escapeHtml(`${completedTasks}/${taskCount}`) : "—"}</strong><em>${tasksAvailable ? "Công việc hoàn thành" : "Chưa có dữ liệu"}</em></span>
        </button>
      </section>
      ${homeTimelineMarkup(data)}
    </footer>`;
  }

  function homeMarkup(data) {
    return `<section class="gha-app gha-home" data-gha-root data-gha-view="home">
      ${homeSidebarMarkup(data)}
      ${homeTopbarMarkup(data)}
      <main class="gha-stage">
        <section class="gha-map" data-gha-map aria-labelledby="gha-home-title">
          <h1 id="gha-home-title" class="gha-sr-only">HH Galaxy Map 3D</h1>
          <div class="gha-system" data-gha-system>
            <div class="gha-map__stars" aria-hidden="true"></div><div class="gha-map__nebula" aria-hidden="true"></div>
            <div class="gha-orbits" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
            <button class="gha-core" type="button" data-gha-entry="hh-core" data-gha-route="/home/dashboard" style="--x:44.51%;--y:39.4%;--size:148px" aria-label="Mở HH Core và vào Dashboard cá nhân"><span aria-hidden="true">HH</span><strong>HH CORE</strong><small>Trái tim của vũ trụ HH</small></button>
            <div class="gha-planets" role="navigation" aria-label="Bản đồ các chức năng">${PLANETS.map((planet, index) => `<button class="gha-planet gha-planet--${planet.tone}" type="button" data-gha-route="${escapeHtml(planet.route)}" data-gha-planet="${escapeHtml(planet.id)}" data-gha-searchable style="--x:${planet.x}%;--y:${planet.y}%;--size:${planet.size}px;--delay:${index * -1.8}s" aria-label="Mở ${escapeHtml(planet.label)} — ${escapeHtml(planet.note)}">${planetIconMarkup(planet.id)}<strong>${escapeHtml(planet.label)}</strong><small>${escapeHtml(planet.note)}</small></button>`).join("")}</div>
            <form class="gha-home-prompt" data-gha-ai-form autocomplete="off"><label class="gha-sr-only" for="gha-home-prompt-input">Hỏi HH AI</label><span aria-hidden="true">⌕</span><input id="gha-home-prompt-input" data-gha-ai-input type="text" maxlength="1600" placeholder="Nhập câu hỏi hoặc gõ / để mở nhanh..." aria-describedby="gha-home-prompt-hint"><small id="gha-home-prompt-hint" class="gha-sr-only">Nội dung sẽ được chuyển an toàn tới HH AI Copilot.</small><button type="submit" aria-label="Gửi câu hỏi tới HH AI">${iconMarkup("send")}</button></form>
            <div class="gha-map__controls" aria-label="Điều khiển bản đồ">
              <button type="button" data-gha-action="reset-view" aria-label="Đặt lại hướng nhìn">${iconMarkup("compass")}</button>
              <div><button type="button" data-gha-action="zoom-in" aria-label="Phóng to bản đồ">＋</button><output data-gha-zoom aria-live="polite">100%</output><button type="button" data-gha-action="zoom-out" aria-label="Thu nhỏ bản đồ">−</button></div>
              <button type="button" data-gha-action="fullscreen" aria-label="Bật chế độ toàn màn hình" aria-pressed="false">${iconMarkup("fullscreen")}</button>
            </div>
          </div>
          ${homeDockMarkup(data)}
        </section>
      </main>
    </section>`;
  }

  function emptyState(label, route, actionLabel) {
    return `<div class="gha-empty"><span>◇</span><p>${escapeHtml(label)}</p>${route ? `<button type="button" data-gha-route="${escapeHtml(route)}">${escapeHtml(actionLabel || "Mở chức năng")}</button>` : ""}</div>`;
  }

  function taskListMarkup(data) {
    if (!data.evidence.tasks) return emptyState("Chưa có kho công việc cục bộ.", "/work/projects-tasks", "Tạo công việc");
    if (!data.tasks.length) return emptyState("Kho công việc đang trống.", "/work/projects-tasks", "Thêm công việc");
    return `<div class="gha-task-list">${data.tasks.slice(0, 7).map((task) => {
      const writable = Number.isInteger(task.rawIndex);
      return `<label title="${writable ? "Lưu thay đổi trên thiết bị" : "Dữ liệu chỉ đọc; mở workspace để chỉnh sửa"}"><input type="checkbox" ${writable ? `data-gha-task="${task.rawIndex}"` : 'disabled aria-disabled="true"'} ${task.completed ? "checked" : ""}><span><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.category || (task.deadline ? `Hạn ${task.deadline}` : writable ? "Công việc" : "Dữ liệu chỉ đọc"))}</small></span></label>`;
    }).join("")}</div>`;
  }

  function projectListMarkup(data) {
    if (!data.evidence.projects) return emptyState("Chưa tìm thấy kho dự án đã lưu.", "/work/projects-tasks", "Mở Projects");
    if (!data.projects.length) return emptyState("Kho dự án đang trống.", "/work/projects-tasks", "Tạo dự án");
    return `<div class="gha-project-list">${data.projects.slice(0, 4).map((project) => {
      const updated = project.updatedAt ? formatDate(project.updatedAt) : "";
      return `<button type="button" data-gha-route="/work/projects-tasks"><span><strong>${escapeHtml(project.name)}</strong><small>${updated ? `Cập nhật ${escapeHtml(updated)}` : "Dự án đã lưu"}</small></span>${Number.isFinite(project.progress) ? `<output>${Math.round(project.progress)}%</output>` : ""}</button>`;
    }).join("")}</div>`;
  }

  function weatherMarkup(data) {
    if (!data.evidence.weather || !data.weather) return emptyState("Chưa có dữ liệu thời tiết đã xác minh.", null);
    const weather = data.weather;
    const observed = weather.observedAt ? formatDate(weather.observedAt, true) : "";
    return `<div class="gha-weather"><strong>${Math.round(Number(weather.temperature))}°C</strong><span>${escapeHtml(weather.location || "Vị trí đã lưu")}</span><dl>${weather.humidity != null ? `<div><dt>Độ ẩm</dt><dd>${Math.round(Number(weather.humidity))}%</dd></div>` : ""}${weather.windSpeed != null ? `<div><dt>Gió</dt><dd>${Math.round(Number(weather.windSpeed))} km/h</dd></div>` : ""}</dl><small>${observed ? `Nguồn lưu lúc ${escapeHtml(observed)}` : "Dữ liệu nguồn được cấp"}</small></div>`;
  }

  function dashboardMetricMarkup(icon, label, value, detail, available, route, extra = "") {
    return `<button class="gha-dashboard-metric" type="button" data-gha-route="${escapeHtml(route)}" data-state="${available ? "ready" : "empty"}">
      <span aria-hidden="true">${iconMarkup(icon)}</span>
      <span><small>${escapeHtml(label)}</small><strong${extra}>${available ? escapeHtml(value) : "—"}</strong><em>${available ? escapeHtml(detail) : "Chưa có dữ liệu"}</em></span>
    </button>`;
  }

  function dashboardActivityMarkup(data) {
    if (!data.evidence.activity || !data.activity.length) return emptyState("Chưa có hoạt động đã lưu.", null);
    return `<ol>${data.activity.slice(0, 5).map((item) => {
      const label = typeof item === "string" ? item : String(item.action || item.title || item.label || "Hoạt động đã lưu");
      const time = typeof item === "string" ? "" : formatDate(item.at || item.createdAt || item.updatedAt, true);
      return `<li><span aria-hidden="true">${iconMarkup("activity")}</span><div><strong>${escapeHtml(label.slice(0, 180))}</strong><small>${time ? escapeHtml(time) : "Đã lưu trên thiết bị"}</small></div></li>`;
    }).join("")}</ol>`;
  }

  function dashboardMarkup(data) {
    const name = String(data.account?.name || "Thành viên HH").trim();
    const note = data.notes[0]?.text || "";
    const projectCount = asArray(data.projects).length;
    const taskCount = asArray(data.tasks).length;
    const completedTasks = asArray(data.tasks).filter((task) => task.completed).length;
    const favoriteCount = asArray(data.favorites).length;
    return `<section class="gha-app gha-dashboard" data-gha-root data-gha-view="dashboard">
      ${topbarMarkup("Dashboard cá nhân", "Widget dùng dữ liệu thật và trạng thái rõ ràng", "dashboard")}
      ${sidebarMarkup("home")}
      <main class="gha-stage">
        <header class="gha-dashboard-toolbar">
          <div><span>HH CORE · KHÔNG GIAN CÁ NHÂN</span><h1>Dashboard cá nhân</h1><p>Tổng hợp dữ liệu đã lưu, công việc và công cụ trên thiết bị của bạn.</p></div>
          <div><button type="button" data-gha-route="/work/projects-tasks">${iconMarkup("task")} Mở công việc</button><button class="gha-primary" type="button" data-gha-route="/settings">${iconMarkup("settings")} Tùy chỉnh</button></div>
        </header>
        <section class="gha-dashboard__head">
          <div class="gha-dashboard-profile"><div class="gha-avatar">${data.account?.avatar ? `<img src="${escapeHtml(data.account.avatar)}" alt="">` : escapeHtml(initials(name))}</div><div><span>Xin chào</span><h2>${escapeHtml(name)}</h2><p>${escapeHtml(sourceLabel(data))}</p></div></div>
          <div class="gha-dashboard-metrics" aria-label="Số liệu cá nhân đã xác minh">
            ${dashboardMetricMarkup("folder", "Dự án", String(projectCount), "Trong workspace", Boolean(data.evidence.projects), "/work/projects-tasks")}
            ${dashboardMetricMarkup("task", "Nhiệm vụ", `${completedTasks}/${taskCount}`, "Đã hoàn thành", Boolean(data.evidence.tasks), "/work/projects-tasks")}
            ${dashboardMetricMarkup("diamond", "Yêu thích", String(favoriteCount), "Module đã đánh dấu", Boolean(data.evidence.favorites), "/favorites")}
            ${dashboardMetricMarkup("activity", "Focus", "0", "Phiên hoàn thành", true, "/home/dashboard", ' data-gha-focus-metric')}
          </div>
          <div class="gha-dashboard__clock"><strong data-gha-clock>--:--</strong><small data-gha-date>Đang lấy giờ thiết bị</small></div>
        </section>
        <section class="gha-widget-grid" aria-label="Các widget cá nhân">
          <article class="gha-widget gha-widget--weather"><header><div><span>MÔI TRƯỜNG ĐÃ LƯU</span><h2>Thời tiết</h2></div><i data-state="${data.weather ? "ready" : "empty"}">${data.weather ? "Có dữ liệu" : "Chưa cấu hình"}</i></header>${weatherMarkup(data)}</article>
          <article class="gha-widget gha-widget--projects"><header><div><span>WORKSPACE</span><h2>Dự án gần đây</h2></div><button type="button" data-gha-route="/work/projects-tasks">Xem tất cả</button></header>${projectListMarkup(data)}</article>
          <article class="gha-widget gha-widget--tasks"><header><div><span>HÔM NAY</span><h2>Nhiệm vụ</h2></div><button type="button" data-gha-route="/work/projects-tasks">Mở đầy đủ</button></header>${taskListMarkup(data)}</article>
          <article class="gha-widget gha-widget--storage"><header><div><span>TRÌNH DUYỆT</span><h2>Lưu trữ website</h2></div><i data-gha-storage-state data-state="loading">Đang đo</i></header><div class="gha-storage-meter"><span data-gha-storage-bar style="--usage:0%"></span></div><strong data-gha-storage-value>Đang đọc Storage API…</strong><small data-gha-storage-detail>Không thay thế dung lượng ổ đĩa hệ điều hành.</small></article>
          <article class="gha-widget gha-widget--activity"><header><div><span>DÒNG THỜI GIAN</span><h2>Hoạt động gần đây</h2></div><button type="button" data-gha-route="/recent">Xem tất cả</button></header>${dashboardActivityMarkup(data)}</article>
          <article class="gha-widget gha-widget--notes"><header><div><span>LOCAL-FIRST</span><h2>Ghi chú nhanh</h2></div><i data-state="${data.evidence.notes ? "ready" : "empty"}">${data.evidence.notes ? "Có dữ liệu" : "Sẽ tạo khi lưu"}</i></header><label><span class="gha-sr-only">Nội dung ghi chú</span><textarea data-gha-note maxlength="4000" placeholder="Viết ghi chú trên thiết bị...">${escapeHtml(note)}</textarea></label><footer><small data-gha-note-status>${note ? "Đang hiển thị ghi chú đã lưu" : "Chưa có ghi chú"}</small><button type="button" data-gha-action="save-note">Lưu ghi chú</button></footer></article>
          <article class="gha-widget gha-widget--focus"><header><div><span>FOCUS</span><h2>Pomodoro</h2></div><button type="button" data-gha-action="focus-reset">Đặt lại</button></header><div class="gha-focus-ring"><strong data-gha-focus-time>25:00</strong><span data-gha-focus-state>Sẵn sàng</span></div><button class="gha-primary" type="button" data-gha-action="focus-toggle">Bắt đầu</button><small data-gha-focus-count>0 phiên hoàn thành</small></article>
          <article class="gha-widget gha-widget--status"><header><div><span>CAPABILITY</span><h2>Trạng thái thật</h2></div><span class="gha-live-dot"></span></header><dl><div><dt>Kết nối mạng</dt><dd data-gha-network-detail>Đang kiểm tra</dd></div><div><dt>Chat AI engine</dt><dd data-state="${escapeHtml(data.capability.chat)}">${data.capability.chat === "ready" ? "Có sẵn" : "Cần tải module"}</dd></div><div><dt>Module đã nạp</dt><dd>${data.evidence.modules ? data.modules.length : "Chưa xác minh"}</dd></div></dl></article>
        </section>
        <footer class="gha-dashboard-foot"><span>${iconMarkup("layers")} Widget chỉ hiển thị dữ liệu có nguồn</span><button type="button" data-gha-route="/settings">Quản lý dữ liệu và bố cục</button></footer>
      </main>
    </section>`;
  }

  function capabilityText(value) {
    return ({ ready: "Sẵn sàng", loading: "Đang kiểm tra", offline: "Ngoại tuyến", error: "Có lỗi", "configuration-required": "Cần cấu hình", unknown: "Chưa xác minh" })[value] || "Mở workspace";
  }

  function copilotModuleMarkup(icon, title, detail, route, state, stateLabel) {
    return `<button type="button" data-gha-route="${escapeHtml(route)}" data-gha-searchable><span aria-hidden="true">${iconMarkup(icon)}</span><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></span><i data-state="${escapeHtml(state)}">${escapeHtml(stateLabel)}</i></button>`;
  }

  function copilotInsightMarkup(data) {
    const insights = [];
    if (data.evidence.tasks) {
      const total = data.tasks.length;
      const done = data.tasks.filter((task) => task.completed).length;
      insights.push({ icon: "task", title: total ? `${done}/${total} nhiệm vụ hoàn thành` : "Kho nhiệm vụ đang trống", detail: total ? "Tiến độ lấy từ công việc trên thiết bị" : "Tạo nhiệm vụ đầu tiên trong Work Center", route: "/work/projects-tasks", progress: total ? Math.round(done / total * 100) : 0 });
    }
    if (data.evidence.projects) {
      const project = data.projects[0];
      insights.push({ icon: "folder", title: project ? project.name : "Kho dự án đang trống", detail: project ? "Mở dự án gần nhất để tiếp tục" : "Tạo dự án đầu tiên trong Project Hub", route: "/work/projects-tasks", progress: Number.isFinite(project?.progress) ? Math.round(project.progress) : null });
    }
    if (data.evidence.notes) insights.push({ icon: "layers", title: `${data.notes.length} ghi chú đã lưu`, detail: "Dữ liệu local-first trên thiết bị", route: "/home/dashboard", progress: null });
    if (!insights.length) return `<div class="gha-copilot-empty"><span>${iconMarkup("activity")}</span><strong>Chưa có gợi ý từ dữ liệu cá nhân</strong><p>Khi bạn tạo nhiệm vụ, dự án hoặc ghi chú, Copilot sẽ hiển thị lối tắt phù hợp tại đây.</p></div>`;
    return `<div class="gha-copilot-insights">${insights.slice(0, 3).map((item) => `<button type="button" data-gha-route="${escapeHtml(item.route)}"><span aria-hidden="true">${iconMarkup(item.icon)}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small>${Number.isFinite(item.progress) ? `<i style="--progress:${clamp(item.progress, 0, 100)}%"><b>${clamp(item.progress, 0, 100)}%</b></i>` : ""}</span></button>`).join("")}</div>`;
  }

  function aiMarkup(data) {
    const providerState = String(data.capability?.aiProvider || data.capability?.provider || "unknown");
    const providerLabel = capabilityText(providerState);
    const chatState = String(data.capability?.chat || "configuration-required");
    const chatLabel = capabilityText(chatState);
    return `<section class="gha-app gha-ai" data-gha-root data-gha-view="ai">
      ${topbarMarkup("HH AI Copilot", "Trợ lý trung tâm và lối vào công cụ AI của HH", "ai")}
      ${sidebarMarkup("ai")}
      <main class="gha-stage">
        <section class="gha-ai-world gha-copilot" aria-labelledby="gha-ai-title">
          <div class="gha-map__stars" aria-hidden="true"></div><div class="gha-ai-world__nebula" aria-hidden="true"></div>
          <header class="gha-copilot__head"><div><span>AI UNIVERSE · TRỢ LÝ TRUNG TÂM</span><h1 id="gha-ai-title">HH AI COPILOT</h1></div><div><i data-state="${escapeHtml(chatState)}"><b></b>${escapeHtml(chatLabel)}</i><button type="button" data-gha-route="/chat-ai/new">+ Cuộc trò chuyện mới</button></div></header>
          <div class="gha-copilot__layout">
            <section class="gha-copilot__hero">
              <div class="gha-copilot-orbit-stage"><button class="gha-ai-core gha-copilot-orb" type="button" data-gha-route="/chat-ai" aria-label="Mở HH AI Copilot"><span aria-hidden="true"><i></i><i></i></span><strong>HH</strong><small>AI COPILOT</small></button></div>
              <div class="gha-copilot__intro"><h2>Tôi có thể giúp gì cho bạn?</h2><p>Hỏi đáp, lập kế hoạch hoặc mở đúng công cụ trong HH Platform. Copilot không giả lập provider hay kết quả chưa được tạo.</p></div>
              <div class="gha-ai-destinations gha-copilot-actions" role="navigation" aria-label="Công cụ AI">${AI_DESTINATIONS.map((destination) => `<button type="button" data-gha-route="${destination.route}" data-gha-searchable><span aria-hidden="true">${escapeHtml(destination.glyph)}</span><strong>${escapeHtml(destination.label)}</strong><small>${escapeHtml(destination.description)}</small></button>`).join("")}<button type="button" data-gha-route="/work/automation-lab" data-gha-searchable><span aria-hidden="true">AU</span><strong>Tự động hóa</strong><small>Xây workflow với trạng thái thực thi rõ ràng</small></button><button type="button" data-gha-route="/analytics" data-gha-searchable><span aria-hidden="true">AN</span><strong>Phân tích</strong><small>Mở dữ liệu và báo cáo hiện có</small></button></div>
              <form class="gha-copilot-prompt" data-gha-ai-form autocomplete="off"><label class="gha-sr-only" for="gha-copilot-prompt-input">Nhập yêu cầu cho HH AI Copilot</label><input id="gha-copilot-prompt-input" data-gha-ai-input type="text" maxlength="1600" placeholder="Nhập yêu cầu của bạn..." aria-describedby="gha-copilot-prompt-hint"><small id="gha-copilot-prompt-hint">Nội dung được chuyển tới engine Chat AI hiện có.</small><button type="submit" aria-label="Gửi yêu cầu tới HH AI Copilot">${iconMarkup("send")}</button></form>
              <div class="gha-copilot-chips" aria-label="Gợi ý nhanh"><span>Gợi ý nhanh</span><button type="button" data-gha-route="/work/projects-tasks">Lập kế hoạch từ dự án</button><button type="button" data-gha-route="/create/prompt-studio">Thiết kế prompt</button><button type="button" data-gha-route="/galaxy/tools">Tìm công cụ phù hợp</button></div>
            </section>
            <aside class="gha-copilot__rail">
              <section><header><div><span>MODULE</span><h2>Copilot có thể mở</h2></div><i data-state="${escapeHtml(providerState)}">Provider: ${escapeHtml(providerLabel)}</i></header><div class="gha-copilot-modules">${copilotModuleMarkup("layers", "Notes Galaxy", "Ghi chú và ý tưởng", "/home/dashboard", data.evidence.notes ? "ready" : "unknown", data.evidence.notes ? "Có dữ liệu" : "Chưa có dữ liệu")}${copilotModuleMarkup("music", "Music Planet", "Nhạc và âm thanh", "/galaxy/music", "unknown", "Mở module")}${copilotModuleMarkup("folder", "Projects Hub", "Dự án và tiến độ", "/work/projects-tasks", data.evidence.projects ? "ready" : "unknown", data.evidence.projects ? "Có dữ liệu" : "Chưa có dữ liệu")}${copilotModuleMarkup("globe", "Weather Star", "Thời tiết đã lưu", "/home/dashboard", data.evidence.weather ? "ready" : "unknown", data.evidence.weather ? "Có dữ liệu" : "Chưa có dữ liệu")}${copilotModuleMarkup("tools", "Creator Tools", "Công cụ sáng tạo", "/galaxy/creator", "unknown", "Mở module")}</div></section>
              <section><header><div><span>LOCAL-FIRST</span><h2>Gợi ý từ dữ liệu của bạn</h2></div></header>${copilotInsightMarkup(data)}</section>
            </aside>
          </div>
          <footer class="gha-ai-world__facts"><span><b>Điều hướng</b> Route nội bộ</span><span><b>Dữ liệu</b> Local/API được cấp</span><span><b>Chat engine</b> ${escapeHtml(chatLabel)}</span><span><b>Provider</b> ${escapeHtml(providerLabel)}</span></footer>
        </section>
      </main>
    </section>`;
  }

  function chatMarkup() {
    return `<section class="gha-app gha-chat" data-gha-root data-gha-view="chat">
      <header class="gha-chat__bar"><a class="gha-brand" href="#/home" data-gha-route="/home"><span aria-hidden="true">HH</span><b>HOANG8.COM</b></a><div><span>AI UNIVERSE</span><strong>HH AI Copilot</strong></div><nav aria-label="Công cụ AI liên quan"><button type="button" data-gha-route="/create/ai-center">AI Universe</button><button type="button" data-gha-route="/create/prompt-studio">Prompt Studio</button><button type="button" data-gha-route="/create/ai-script">Kịch bản</button></nav><i data-gha-engine-state data-state="loading">Đang gắn engine</i></header>
      <main class="gha-chat__stage"><div class="gha-chat__aurora" aria-hidden="true"></div><div class="gha-chat__engine" data-gha-chat-engine aria-live="off"></div><section class="gha-chat__missing" data-gha-chat-missing hidden role="status"><span>AI</span><h1>Chat AI chưa được tải</h1><p>Adapter Galaxy không tạo cuộc trò chuyện giả. Hãy tải engine Chat AI hiện có rồi thử lại.</p><button type="button" data-gha-action="retry-chat">Thử gắn lại</button></section></main>
    </section>`;
  }

  function viewMarkup(route, data) {
    if (route === "/home") return homeMarkup(data);
    if (route === "/home/dashboard") return dashboardMarkup(data);
    if (route === "/create/ai-center") return aiMarkup(data);
    return chatMarkup();
  }

  function currentRouteFromLocation() {
    return normalizeRoute(globalScope.location?.hash || "/home");
  }

  function navigate(runtime, route) {
    const destination = normalizeRoute(route);
    if (typeof runtime.options.navigate === "function") {
      runtime.options.navigate(destination);
      return;
    }
    if (globalScope.location) globalScope.location.hash = `#${destination}`;
  }

  function readHomePrefs(storage) {
    const value = readRecord(storage, HOME_PREF_KEY).value;
    return { version: 1, zoom: clamp(value?.zoom || 1, 0.72, 1.45) };
  }

  function applyMapZoom(runtime) {
    const map = runtime.host.querySelector("[data-gha-map]");
    if (!map) return;
    map.style.setProperty("--gha-map-scale", String(runtime.preferences.zoom));
    const output = map.querySelector("[data-gha-zoom]");
    if (output) output.textContent = `${Math.round(runtime.preferences.zoom * 100)}%`;
  }

  function updateNetwork(runtime) {
    const online = typeof globalScope.navigator?.onLine === "boolean" ? globalScope.navigator.onLine : null;
    runtime.state.online = online;
    runtime.host.querySelectorAll("[data-gha-network]").forEach((node) => { node.textContent = online == null ? "Không hỗ trợ" : online ? "Đang trực tuyến" : "Ngoại tuyến"; node.dataset.state = online == null ? "unknown" : online ? "ready" : "offline"; });
    runtime.host.querySelectorAll("[data-gha-network-detail]").forEach((node) => { node.textContent = online == null ? "Không hỗ trợ" : online ? "Trực tuyến" : "Ngoại tuyến"; node.dataset.state = online == null ? "unknown" : online ? "ready" : "offline"; });
    runtime.host.querySelectorAll("[data-gha-network-copy]").forEach((node) => {
      node.textContent = online == null ? "Không đọc được trạng thái kết nối" : online ? "Kết nối trình duyệt đang hoạt động" : "Nội dung cục bộ vẫn khả dụng";
    });
  }

  function updateClock(runtime) {
    const now = new Date();
    runtime.host.querySelectorAll("[data-gha-clock]").forEach((node) => { node.textContent = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }); });
    runtime.host.querySelectorAll("[data-gha-date]").forEach((node) => { node.textContent = now.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }); });
  }

  function readFocus(storage) {
    const record = readRecord(storage, FOCUS_KEY).value;
    const durationSeconds = clamp(record?.durationSeconds || 1500, 60, 7200);
    return {
      version: 1,
      durationSeconds,
      remainingSeconds: clamp(record?.remainingSeconds ?? durationSeconds, 0, durationSeconds),
      running: Boolean(record?.running),
      startedAt: Number(record?.startedAt) || 0,
      completed: clamp(record?.completed || 0, 0, 100000)
    };
  }

  function focusSnapshot(runtime, now = Date.now()) {
    const focus = runtime.focus;
    if (!focus.running || !focus.startedAt) return focus;
    const elapsed = Math.max(0, Math.floor((now - focus.startedAt) / 1000));
    if (elapsed < focus.remainingSeconds) return { ...focus, remainingSeconds: focus.remainingSeconds - elapsed, startedAt: now };
    return { ...focus, remainingSeconds: focus.durationSeconds, running: false, startedAt: 0, completed: focus.completed + 1 };
  }

  function persistFocus(runtime) {
    writeRecord(runtime.storage, FOCUS_KEY, runtime.focus);
  }

  function updateFocus(runtime) {
    if (runtime.route !== "/home/dashboard") return;
    const next = focusSnapshot(runtime);
    if (next !== runtime.focus) {
      runtime.focus = next;
      persistFocus(runtime);
    }
    const minutes = Math.floor(runtime.focus.remainingSeconds / 60);
    const seconds = runtime.focus.remainingSeconds % 60;
    const time = runtime.host.querySelector("[data-gha-focus-time]");
    const state = runtime.host.querySelector("[data-gha-focus-state]");
    const count = runtime.host.querySelector("[data-gha-focus-count]");
    const metric = runtime.host.querySelector("[data-gha-focus-metric]");
    const toggle = runtime.host.querySelector('[data-gha-action="focus-toggle"]');
    if (time) time.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    if (state) state.textContent = runtime.focus.running ? "Đang tập trung" : "Sẵn sàng";
    if (count) count.textContent = `${runtime.focus.completed} phiên hoàn thành`;
    if (metric) metric.textContent = String(runtime.focus.completed);
    if (toggle) toggle.textContent = runtime.focus.running ? "Tạm dừng" : "Bắt đầu";
  }

  async function updateStorageEstimate(runtime) {
    const stateNode = runtime.host.querySelector("[data-gha-storage-state]");
    const valueNode = runtime.host.querySelector("[data-gha-storage-value]");
    const detailNode = runtime.host.querySelector("[data-gha-storage-detail]");
    const barNode = runtime.host.querySelector("[data-gha-storage-bar]");
    if (!stateNode || !valueNode) return;
    const metricNode = stateNode.closest?.(".gha-home-stat");
    if (typeof globalScope.navigator?.storage?.estimate !== "function") {
      stateNode.dataset.state = "unsupported";
      stateNode.textContent = "Không hỗ trợ";
      if (metricNode) metricNode.dataset.state = "unsupported";
      valueNode.textContent = "Storage API không khả dụng";
      if (detailNode) detailNode.textContent = "Trình duyệt này không cung cấp phép đo dung lượng website.";
      return;
    }
    try {
      const estimate = await globalScope.navigator.storage.estimate();
      if (runtime !== activeRuntime || runtime.controller.signal.aborted) return;
      const usage = Number(estimate.usage);
      const quota = Number(estimate.quota);
      if (!Number.isFinite(usage) || !Number.isFinite(quota) || quota <= 0) throw new Error("STORAGE_ESTIMATE_INVALID");
      const formatter = new Intl.NumberFormat("vi-VN", { style: "unit", unit: "megabyte", maximumFractionDigits: 1 });
      const usedMb = usage / 1048576;
      const quotaMb = quota / 1048576;
      stateNode.dataset.state = "ready";
      stateNode.textContent = "Storage API";
      if (metricNode) metricNode.dataset.state = "ready";
      valueNode.textContent = `${formatter.format(usedMb)} / ${formatter.format(quotaMb)}`;
      if (detailNode) detailNode.textContent = `${(usage / quota * 100).toFixed(1)}% quota dành cho website đã dùng.`;
      if (barNode) barNode.style.setProperty("--usage", `${clamp(usage / quota * 100, 0, 100)}%`);
      runtime.state.storage = { supported: true, usage, quota };
    } catch {
      stateNode.dataset.state = "error";
      stateNode.textContent = "Không đọc được";
      if (metricNode) metricNode.dataset.state = "error";
      valueNode.textContent = "Không có số liệu dung lượng";
      if (detailNode) detailNode.textContent = "Không thay thế bằng số liệu giả.";
      runtime.state.storage = { supported: false };
    }
  }

  function toggleTask(runtime, rawIndex, completed) {
    const record = readRecord(runtime.storage, TASK_KEY);
    if (!record.found || !Array.isArray(record.value)) return false;
    const index = Number(rawIndex);
    if (!Number.isInteger(index) || index < 0 || index >= record.value.length || !isObject(record.value[index])) return false;
    const task = record.value[index];
    record.value[index] = Object.prototype.hasOwnProperty.call(task, "completed") ? { ...task, completed } : { ...task, done: completed };
    if (!writeRecord(runtime.storage, TASK_KEY, record.value)) return false;
    const local = collectLocalData(runtime.storage, globalScope);
    runtime.data = mergeData(local, runtime.options.data);
    runtime.state.lastAction = "task-updated";
    try { globalScope.dispatchEvent?.(new globalScope.CustomEvent("hh:command-center-sync", { detail: { source: "galaxy-dashboard", taskIndex: index } })); } catch { /* Event APIs may be unavailable. */ }
    return true;
  }

  function saveNote(runtime) {
    const textarea = runtime.host.querySelector("[data-gha-note]");
    const status = runtime.host.querySelector("[data-gha-note-status]");
    const text = String(textarea?.value || "").trim().slice(0, 4000);
    const record = readRecord(runtime.storage, NOTE_KEY);
    const notes = Array.isArray(record.value) ? record.value.slice(0, 100) : [];
    const firstPinned = notes.findIndex((note) => isObject(note) && note.pinned);
    const index = firstPinned >= 0 ? firstPinned : notes.length ? 0 : -1;
    if (index >= 0) notes[index] = { ...notes[index], text, updatedAt: Date.now() };
    else notes.push({ id: `galaxy-note-${Date.now()}`, text, pinned: true, color: "#9b7cff", updatedAt: Date.now() });
    const saved = writeRecord(runtime.storage, NOTE_KEY, notes);
    if (status) { status.textContent = saved ? "Đã lưu trên thiết bị" : "Không thể ghi dữ liệu trên thiết bị"; status.dataset.state = saved ? "ready" : "error"; }
    runtime.state.lastAction = saved ? "note-saved" : "note-error";
    if (saved) {
      try { globalScope.dispatchEvent?.(new globalScope.CustomEvent("hh:command-center-sync", { detail: { source: "galaxy-dashboard", kind: "note" } })); } catch { /* Event APIs may be unavailable. */ }
    }
    return saved;
  }

  async function toggleFullscreen(runtime) {
    const target = runtime.host.querySelector("[data-gha-map]") || runtime.host;
    try {
      if (globalScope.document?.fullscreenElement) await globalScope.document.exitFullscreen?.();
      else if (typeof target.requestFullscreen === "function") await target.requestFullscreen();
      else runtime.state.fullscreen = "unsupported";
    } catch {
      runtime.state.fullscreen = "error";
    }
  }

  function updateFullscreenState(runtime) {
    const active = Boolean(globalScope.document?.fullscreenElement);
    runtime.state.fullscreen = active ? "active" : "inactive";
    runtime.host.querySelectorAll('[data-gha-action="fullscreen"]').forEach((button) => {
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute("aria-label", active ? "Thoát chế độ toàn màn hình" : "Bật chế độ toàn màn hình");
    });
  }

  function submitHomePrompt(runtime, form) {
    const input = form?.querySelector?.("[data-gha-ai-input]");
    const prompt = String(input?.value || "").trim().slice(0, 1600);
    if (!prompt) {
      input?.focus?.();
      input?.setAttribute?.("aria-invalid", "true");
      return false;
    }
    input.removeAttribute?.("aria-invalid");
    const payload = { prompt, at: Date.now(), source: "galaxy-home" };
    try {
      globalScope.sessionStorage?.setItem?.("hh.chat-ai.handoff.v1", JSON.stringify(payload));
      runtime.state.lastAction = "chat-handoff";
    } catch {
      runtime.state.lastAction = "chat-handoff-storage-error";
    }
    navigate(runtime, "/chat-ai");
    return true;
  }

  function setEngineState(runtime, state, label) {
    const node = runtime.host.querySelector("[data-gha-engine-state]");
    if (node) { node.dataset.state = state; node.textContent = label; }
    const missing = runtime.host.querySelector("[data-gha-chat-missing]");
    const engine = runtime.host.querySelector("[data-gha-chat-engine]");
    if (missing) missing.hidden = state === "ready" || state === "loading";
    if (engine) engine.hidden = state === "error" || state === "configuration-required";
    runtime.state.baseMounted = state === "ready";
    runtime.state.capability = state;
  }

  async function mountChatEngine(runtime) {
    if (runtime.route !== "/chat-ai" && !runtime.route.startsWith("/chat-ai/")) return;
    const engineHost = runtime.host.querySelector("[data-gha-chat-engine]");
    const baseMount = runtime.options.baseMount;
    if (!engineHost || typeof baseMount !== "function") {
      setEngineState(runtime, "configuration-required", "Engine chưa được cấp");
      return;
    }
    setEngineState(runtime, "loading", "Đang gắn engine");
    try {
      const result = await baseMount(engineHost, { ...runtime.options.baseOptions, route: runtime.route, newSession: runtime.route.endsWith("/new") });
      if (runtime !== activeRuntime || runtime.controller.signal.aborted) {
        result?.unmount?.();
        return;
      }
      if (result === false) throw new Error("CHAT_ENGINE_REJECTED");
      runtime.baseController = result && typeof result === "object" ? result : null;
      setEngineState(runtime, "ready", "Engine hiện có");
    } catch (error) {
      runtime.state.error = String(error?.message || "CHAT_ENGINE_MOUNT_FAILED");
      setEngineState(runtime, "error", "Không thể gắn engine");
    }
  }

  function handleClick(runtime, event) {
    const routeButton = event.target.closest?.("[data-gha-route]");
    if (routeButton) {
      event.preventDefault();
      navigate(runtime, routeButton.dataset.ghaRoute);
      return;
    }
    const action = event.target.closest?.("[data-gha-action]")?.dataset.ghaAction;
    if (!action) return;
    if (action === "zoom-in" || action === "zoom-out") {
      runtime.preferences.zoom = clamp(runtime.preferences.zoom + (action === "zoom-in" ? 0.1 : -0.1), 0.72, 1.45);
      writeRecord(runtime.storage, HOME_PREF_KEY, runtime.preferences);
      applyMapZoom(runtime);
    } else if (action === "reset-view") {
      runtime.preferences.zoom = 1;
      writeRecord(runtime.storage, HOME_PREF_KEY, runtime.preferences);
      applyMapZoom(runtime);
    } else if (action === "fullscreen") toggleFullscreen(runtime);
    else if (action === "focus-toggle") {
      runtime.focus = focusSnapshot(runtime);
      runtime.focus.running = !runtime.focus.running;
      runtime.focus.startedAt = runtime.focus.running ? Date.now() : 0;
      persistFocus(runtime);
      updateFocus(runtime);
    } else if (action === "focus-reset") {
      runtime.focus = { ...runtime.focus, remainingSeconds: runtime.focus.durationSeconds, running: false, startedAt: 0 };
      persistFocus(runtime);
      updateFocus(runtime);
    } else if (action === "save-note") saveNote(runtime);
    else if (action === "retry-chat") mountChatEngine(runtime);
  }

  function handleChange(runtime, event) {
    if (event.target.matches?.("[data-gha-task]")) toggleTask(runtime, event.target.dataset.ghaTask, Boolean(event.target.checked));
  }

  function handleInput(runtime, event) {
    if (event.target.matches?.("[data-gha-ai-input]")) {
      event.target.removeAttribute?.("aria-invalid");
      return;
    }
    if (!event.target.matches?.("[data-gha-search]")) return;
    const query = event.target.value.trim().toLocaleLowerCase("vi");
    let matches = 0;
    const nodes = runtime.host.querySelectorAll("[data-gha-searchable], .gha-ai-destinations [data-gha-route]");
    nodes.forEach((node) => {
      const visible = !query || node.textContent.toLocaleLowerCase("vi").includes(query);
      node.hidden = !visible;
      if (visible) matches += 1;
    });
    const empty = runtime.host.querySelector("[data-gha-search-empty]");
    if (empty) empty.hidden = !query || matches > 0;
  }

  function handleKeydown(runtime, event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase("vi") === "k") {
      event.preventDefault();
      runtime.host.querySelector("[data-gha-search]")?.focus();
      return;
    }
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !/input|textarea|select/i.test(event.target.tagName)) {
      event.preventDefault();
      runtime.host.querySelector(runtime.route === "/home" ? "[data-gha-ai-input]" : "[data-gha-search]")?.focus();
      return;
    }
    const planet = event.target.closest?.("[data-gha-planet]");
    if (!planet || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    const planets = [...runtime.host.querySelectorAll("[data-gha-planet]:not([hidden])")];
    const current = planets.indexOf(planet);
    if (current < 0) return;
    event.preventDefault();
    const delta = ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1;
    planets[(current + delta + planets.length) % planets.length]?.focus();
  }

  function handleSubmit(runtime, event) {
    const form = event.target.closest?.("[data-gha-ai-form]");
    if (!form) return;
    event.preventDefault();
    submitHomePrompt(runtime, form);
  }

  /* The host is also observed by the outer Galaxy shell. Attach a small,
     route-local listener to controls that do not carry a navigation target so
     shell delegation cannot swallow map actions or the AI handoff submit. The
     AbortSignal keeps these listeners disposable on every route transition. */
  function bindHomeControls(runtime) {
    if (runtime.route !== "/home") return;
    const signal = runtime.controller.signal;
    runtime.host.querySelectorAll?.("[data-gha-action]").forEach((button) => {
      const onAction = (event) => {
        const action = button.dataset?.ghaAction || "";
        event.stopPropagation?.();
        event.preventDefault?.();
        if (action === "zoom-in" || action === "zoom-out") {
          runtime.preferences.zoom = clamp(runtime.preferences.zoom + (action === "zoom-in" ? 0.1 : -0.1), 0.72, 1.45);
          writeRecord(runtime.storage, HOME_PREF_KEY, runtime.preferences);
          applyMapZoom(runtime);
          runtime.state.lastAction = action;
          return;
        }
        if (action === "reset-view") {
          runtime.preferences.zoom = 1;
          writeRecord(runtime.storage, HOME_PREF_KEY, runtime.preferences);
          applyMapZoom(runtime);
          runtime.state.lastAction = action;
          return;
        }
        handleClick(runtime, event);
      };
      /* Use a direct handler as well as delegation: the surrounding shell can
         re-render or intercept bubbling events while the map remains mounted. */
      button.onclick = onAction;
    });
    runtime.host.querySelectorAll?.("[data-gha-ai-form]").forEach((form) => {
      form.addEventListener?.("submit", (event) => {
        event.preventDefault?.();
        event.stopPropagation?.();
        handleSubmit(runtime, event);
      }, { signal });
    });
  }

  function bindRuntime(runtime) {
    const signal = runtime.controller.signal;
    runtime.host.addEventListener("click", (event) => handleClick(runtime, event), { signal });
    runtime.host.addEventListener("change", (event) => handleChange(runtime, event), { signal });
    runtime.host.addEventListener("input", (event) => handleInput(runtime, event), { signal });
    runtime.host.addEventListener("keydown", (event) => handleKeydown(runtime, event), { signal });
    runtime.host.addEventListener("submit", (event) => handleSubmit(runtime, event), { signal });
    globalScope.addEventListener?.("online", () => updateNetwork(runtime), { signal });
    globalScope.addEventListener?.("offline", () => updateNetwork(runtime), { signal });
    globalScope.document?.addEventListener?.("fullscreenchange", () => updateFullscreenState(runtime), { signal });
    globalScope.document?.addEventListener?.("visibilitychange", () => {
      runtime.state.paused = Boolean(globalScope.document.hidden);
      runtime.host.setAttribute?.("data-gha-paused", String(runtime.state.paused));
      updateFocus(runtime);
    }, { signal });
  }

  function refreshView(runtime) {
    runtime.host.innerHTML = viewMarkup(runtime.route, runtime.data);
    runtime.host.dataset.ghaHomeAiHost = "";
    runtime.host.dataset.ghaRoute = runtime.route;
    bindHomeControls(runtime);
    applyMapZoom(runtime);
    updateNetwork(runtime);
    updateClock(runtime);
    updateFocus(runtime);
    updateFullscreenState(runtime);
    if (runtime.route === "/home" || runtime.route === "/home/dashboard") updateStorageEstimate(runtime);
  }

  async function loadPassedData(runtime) {
    const loader = runtime.options.loadData || runtime.options.dataProvider;
    if (typeof loader !== "function") return;
    runtime.state.dataState = "loading";
    try {
      const provided = await loader({ route: runtime.route, signal: runtime.controller.signal, local: runtime.data });
      if (runtime !== activeRuntime || runtime.controller.signal.aborted) return;
      runtime.data = mergeData(collectLocalData(runtime.storage, globalScope), provided);
      runtime.options.data = provided;
      runtime.state.dataState = "ready";
      if (runtime.route === "/chat-ai" || runtime.route.startsWith("/chat-ai/")) return;
      refreshView(runtime);
    } catch (error) {
      if (runtime.controller.signal.aborted) return;
      runtime.state.dataState = "error";
      runtime.state.error = String(error?.message || "DATA_PROVIDER_FAILED");
    }
  }

  function mount(host, options = {}) {
    if (!host || typeof host.querySelector !== "function") return false;
    const route = normalizeRoute(options.route || currentRouteFromLocation());
    if (!canHandle(route)) return false;
    unmount();
    const storage = options.storage || globalScope.localStorage;
    const local = collectLocalData(storage, globalScope);
    const runtime = {
      host,
      route,
      options,
      storage,
      data: mergeData(local, options.data),
      preferences: readHomePrefs(storage),
      focus: readFocus(storage),
      controller: new AbortController(),
      baseController: null,
      clockTimer: 0,
      focusTimer: 0,
      state: { mounted: true, route, view: route === "/home" ? "home" : route === "/home/dashboard" ? "dashboard" : route === "/create/ai-center" ? "ai" : "chat", paused: Boolean(globalScope.document?.hidden), online: null, baseMounted: false, capability: "ready", dataState: options.loadData || options.dataProvider ? "loading" : "ready", storage: null, error: null, lastAction: null }
    };
    activeRuntime = runtime;
    refreshView(runtime);
    bindRuntime(runtime);
    runtime.clockTimer = globalScope.setInterval?.(() => updateClock(runtime), 30000) || 0;
    runtime.focusTimer = globalScope.setInterval?.(() => updateFocus(runtime), 1000) || 0;
    if (route === "/chat-ai" || route.startsWith("/chat-ai/")) mountChatEngine(runtime);
    loadPassedData(runtime);
    return true;
  }

  function unmount(host) {
    const runtime = activeRuntime;
    if (!runtime || (host && host !== runtime.host)) return false;
    runtime.controller.abort();
    if (runtime.clockTimer) globalScope.clearInterval?.(runtime.clockTimer);
    if (runtime.focusTimer) globalScope.clearInterval?.(runtime.focusTimer);
    runtime.baseController?.unmount?.();
    runtime.baseController?.destroy?.();
    if (typeof runtime.options.baseUnmount === "function") {
      try { runtime.options.baseUnmount(runtime.host.querySelector?.("[data-gha-chat-engine]")); } catch { /* Base cleanup is best-effort. */ }
    }
    runtime.host.removeAttribute?.("data-gha-home-ai-host");
    runtime.host.removeAttribute?.("data-gha-route");
    runtime.state.mounted = false;
    if (activeRuntime === runtime) activeRuntime = null;
    return true;
  }

  function getState() {
    if (!activeRuntime) return { mounted: false, route: null, view: null, capability: "idle", dataState: "idle", baseMounted: false, paused: false, online: null, error: null };
    const state = activeRuntime.state;
    return {
      mounted: state.mounted,
      route: state.route,
      view: state.view,
      capability: state.capability,
      dataState: state.dataState,
      baseMounted: state.baseMounted,
      paused: state.paused,
      online: state.online,
      storageSupported: state.storage?.supported ?? null,
      lastAction: state.lastAction,
      error: state.error
    };
  }

  return Object.freeze({
    VERSION,
    ROUTES,
    PLANETS,
    HOME_NAV_ITEMS,
    AI_DESTINATIONS,
    HOME_PREF_KEY,
    FOCUS_KEY,
    TASK_KEY,
    NOTE_KEY,
    normalizeRoute,
    canHandle,
    collectLocalData,
    mergeData,
    viewMarkup,
    mount,
    unmount,
    getState
  });
});
