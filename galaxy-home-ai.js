(function (root, factory) {
  "use strict";

  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHGalaxyHomeAI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (globalScope) {
  "use strict";

  const VERSION = "1.0.0";
  const HOME_PREF_KEY = "hh.galaxy.home.preferences.v1";
  const FOCUS_KEY = "hh.galaxy.dashboard.focus.v1";
  const TASK_KEY = "hh.command-center.todos.v2";
  const NOTE_KEY = "hh.dashboard.sticky-notes.v1";
  const PROJECT_KEYS = Object.freeze(["hh.creative-os.v1", "hh-project-center"]);
  const ROUTES = Object.freeze(["/home", "/home/dashboard", "/create/ai-center", "/chat-ai"]);
  const PLANETS = Object.freeze([
    { id: "ai", label: "AI Universe", route: "/create/ai-center", short: "AI", tone: "amber", x: 20, y: 27, size: 108 },
    { id: "music", label: "Music Planet", route: "/music-ai", short: "MU", tone: "cyan", x: 38, y: 11, size: 98 },
    { id: "video", label: "Video Planet", route: "/davinci-resolve", short: "VI", tone: "orange", x: 68, y: 14, size: 102 },
    { id: "creator", label: "Creator Studio", route: "/create", short: "CR", tone: "violet", x: 83, y: 29, size: 108 },
    { id: "dev", label: "Dev Planet", route: "/dev-tools", short: "DV", tone: "blue", x: 81, y: 68, size: 102 },
    { id: "community", label: "Community", route: "/communication/community", short: "CO", tone: "aqua", x: 67, y: 82, size: 96 },
    { id: "tools", label: "Tools Galaxy", route: "/work", short: "TO", tone: "violet", x: 48, y: 88, size: 92 },
    { id: "learn", label: "Learning Star", route: "/learn", short: "LE", tone: "blue", x: 26, y: 77, size: 102 },
    { id: "games", label: "Games World", route: "/play", short: "GA", tone: "pink", x: 13, y: 57, size: 98 }
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

  function collectLocalData(storage = globalScope.localStorage, scope = globalScope) {
    const auth = readRecord(storage, "hh-auth-user");
    const tasks = readRecord(storage, TASK_KEY);
    const notes = readRecord(storage, NOTE_KEY);
    const favorites = readRecord(storage, "hh-module-favorites");
    const activity = readRecord(storage, "hh.command-center.activity.v1");
    const weather = readRecord(storage, "hh.dashboard.weather.v1");
    const projects = firstProjectCollection(storage);
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
    if (isObject(provided.capability)) result.capability = { ...result.capability, ...provided.capability };
    if (isObject(provided.evidence)) result.evidence = { ...result.evidence, ...provided.evidence };
    Object.defineProperty(result, "_raw", { enumerable: false, value: local._raw || {} });
    return result;
  }

  function initials(name) {
    return String(name || "HH").trim().split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase().slice(0, 2) || "HH";
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

  function homeMarkup(data) {
    const projectsAvailable = Boolean(data.evidence.projects);
    const tasksAvailable = Boolean(data.evidence.tasks);
    const completed = asArray(data.tasks).filter((task) => task.completed).length;
    const taskValue = tasksAvailable ? `${completed}/${data.tasks.length}` : "";
    const moduleValue = data.evidence.modules ? String(data.modules.length) : "";
    return `<section class="gha-app gha-home" data-gha-root data-gha-view="home">
      ${topbarMarkup("HH Galaxy Map", "Khám phá chức năng ngay trong website", "home")}
      ${sidebarMarkup("home")}
      <main class="gha-stage">
        <section class="gha-map" data-gha-map aria-labelledby="gha-home-title">
          <div class="gha-map__stars" aria-hidden="true"></div><div class="gha-map__nebula" aria-hidden="true"></div>
          <header class="gha-map__heading"><span>HH GALAXY MAP · LIVE NAVIGATION</span><h1 id="gha-home-title">Vũ trụ số của bạn</h1><p>Mỗi hành tinh là một chức năng thật. Chọn bằng chuột, cảm ứng hoặc bàn phím.</p></header>
          <div class="gha-orbits" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
          <button class="gha-core" type="button" data-gha-route="/home/dashboard" aria-label="Mở Dashboard cá nhân"><span>HH</span><strong>HH CORE</strong><small>Dashboard cá nhân</small></button>
          <div class="gha-planets" role="navigation" aria-label="Bản đồ các chức năng">${PLANETS.map((planet, index) => `<button class="gha-planet gha-planet--${planet.tone}" type="button" data-gha-route="${planet.route}" data-gha-planet="${planet.id}" style="--x:${planet.x}%;--y:${planet.y}%;--size:${planet.size}px;--delay:${index * -1.8}s"><span aria-hidden="true">${planet.short}</span><strong>${planet.label}</strong><small>Mở chức năng</small></button>`).join("")}</div>
          <div class="gha-map__controls" aria-label="Điều khiển bản đồ"><button type="button" data-gha-action="zoom-out" aria-label="Thu nhỏ bản đồ">−</button><output data-gha-zoom>100%</output><button type="button" data-gha-action="zoom-in" aria-label="Phóng to bản đồ">＋</button><button type="button" data-gha-action="reset-view">Đặt lại</button><button type="button" data-gha-action="fullscreen">Toàn màn hình</button></div>
          <div class="gha-map__metrics" aria-label="Số liệu thật">${metricMarkup("Dự án", String(data.projects.length), projectsAvailable, "/work/projects-tasks")}${metricMarkup("Công việc", taskValue, tasksAvailable, "/home/dashboard")}${metricMarkup("Module đã nạp", moduleValue, data.evidence.modules, "/home/dashboard")}</div>
          <p class="gha-source"><span class="gha-live-dot"></span>${escapeHtml(sourceLabel(data))}</p>
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

  function dashboardMarkup(data) {
    const name = String(data.account?.name || "Thành viên HH").trim();
    const note = data.notes[0]?.text || "";
    return `<section class="gha-app gha-dashboard" data-gha-root data-gha-view="dashboard">
      ${topbarMarkup("Dashboard cá nhân", "Widget dùng dữ liệu thật và trạng thái rõ ràng", "dashboard")}
      ${sidebarMarkup("home")}
      <main class="gha-stage">
        <section class="gha-dashboard__head"><div class="gha-avatar">${data.account?.avatar ? `<img src="${escapeHtml(data.account.avatar)}" alt="">` : escapeHtml(initials(name))}</div><div><span>DASHBOARD CÁ NHÂN</span><h1>${escapeHtml(name)}</h1><p>${escapeHtml(sourceLabel(data))}</p></div><div class="gha-dashboard__clock"><strong data-gha-clock>--:--</strong><small data-gha-date>Đang lấy giờ thiết bị</small></div></section>
        <section class="gha-widget-grid" aria-label="Các widget cá nhân">
          <article class="gha-widget gha-widget--tasks"><header><div><span>HÔM NAY</span><h2>Nhiệm vụ</h2></div><button type="button" data-gha-route="/work/projects-tasks">Mở đầy đủ</button></header>${taskListMarkup(data)}</article>
          <article class="gha-widget gha-widget--projects"><header><div><span>WORKSPACE</span><h2>Dự án gần đây</h2></div><button type="button" data-gha-route="/work/projects-tasks">Projects</button></header>${projectListMarkup(data)}</article>
          <article class="gha-widget gha-widget--weather"><header><div><span>DỮ LIỆU ĐÃ LƯU</span><h2>Thời tiết</h2></div><i data-state="${data.weather ? "ready" : "empty"}">${data.weather ? "Có dữ liệu" : "Chưa cấu hình"}</i></header>${weatherMarkup(data)}</article>
          <article class="gha-widget gha-widget--focus"><header><div><span>FOCUS</span><h2>Pomodoro</h2></div><button type="button" data-gha-action="focus-reset">Đặt lại</button></header><div class="gha-focus-ring"><strong data-gha-focus-time>25:00</strong><span data-gha-focus-state>Sẵn sàng</span></div><button class="gha-primary" type="button" data-gha-action="focus-toggle">Bắt đầu</button><small data-gha-focus-count>0 phiên hoàn thành</small></article>
          <article class="gha-widget gha-widget--notes"><header><div><span>LOCAL-FIRST</span><h2>Ghi chú nhanh</h2></div><i data-state="${data.evidence.notes ? "ready" : "empty"}">${data.evidence.notes ? "Đã kết nối" : "Sẽ tạo khi lưu"}</i></header><label><span class="gha-sr-only">Nội dung ghi chú</span><textarea data-gha-note maxlength="4000" placeholder="Viết ghi chú trên thiết bị...">${escapeHtml(note)}</textarea></label><footer><small data-gha-note-status>${note ? "Đang hiển thị ghi chú đã lưu" : "Chưa có ghi chú"}</small><button type="button" data-gha-action="save-note">Lưu ghi chú</button></footer></article>
          <article class="gha-widget gha-widget--storage"><header><div><span>TRÌNH DUYỆT</span><h2>Lưu trữ website</h2></div><i data-gha-storage-state data-state="loading">Đang đo</i></header><div class="gha-storage-meter"><span data-gha-storage-bar style="--usage:0%"></span></div><strong data-gha-storage-value>Đang đọc Storage API…</strong><small data-gha-storage-detail>Không thay thế dung lượng ổ đĩa hệ điều hành.</small></article>
          <article class="gha-widget gha-widget--activity"><header><div><span>GẦN ĐÂY</span><h2>Hoạt động</h2></div><button type="button" data-gha-route="/recent">Xem tất cả</button></header>${data.evidence.activity && data.activity.length ? `<ol>${data.activity.slice(0, 5).map((item) => `<li>${escapeHtml(typeof item === "string" ? item : item.action || item.title || "Hoạt động đã lưu")}</li>`).join("")}</ol>` : emptyState("Chưa có hoạt động đã lưu.", null)}</article>
          <article class="gha-widget gha-widget--status"><header><div><span>CAPABILITY</span><h2>Trạng thái thật</h2></div><span class="gha-live-dot"></span></header><dl><div><dt>Kết nối mạng</dt><dd data-gha-network-detail>Đang kiểm tra</dd></div><div><dt>Chat AI engine</dt><dd data-state="${escapeHtml(data.capability.chat)}">${data.capability.chat === "ready" ? "Có sẵn" : "Cần tải module"}</dd></div><div><dt>Module đã nạp</dt><dd>${data.evidence.modules ? data.modules.length : "Chưa xác minh"}</dd></div></dl></article>
        </section>
      </main>
    </section>`;
  }

  function capabilityText(value) {
    return ({ ready: "Sẵn sàng", loading: "Đang kiểm tra", offline: "Ngoại tuyến", error: "Có lỗi", "configuration-required": "Cần cấu hình", unknown: "Chưa xác minh" })[value] || "Mở workspace";
  }

  function aiMarkup(data) {
    const providerState = String(data.capability?.aiProvider || data.capability?.provider || "unknown");
    const providerLabel = capabilityText(providerState);
    return `<section class="gha-app gha-ai" data-gha-root data-gha-view="ai">
      ${topbarMarkup("AI Universe", "Lối vào trực tiếp tới các công cụ AI của HH", "ai")}
      ${sidebarMarkup("ai")}
      <main class="gha-stage">
        <section class="gha-ai-world" aria-labelledby="gha-ai-title">
          <div class="gha-map__stars" aria-hidden="true"></div><div class="gha-ai-world__nebula" aria-hidden="true"></div>
          <div class="gha-ai-world__copy"><span>GALAXY EXPLORER · AI UNIVERSE</span><h1 id="gha-ai-title">AI UNIVERSE</h1><p>Nơi các công cụ AI đang có trong HH Platform được tổ chức thành những điểm đến rõ ràng.</p><div class="gha-ai-world__actions"><button class="gha-primary" type="button" data-gha-route="/chat-ai">Mở HH AI Copilot</button><button type="button" data-gha-route="/create/prompt-studio">Prompt Studio</button></div><section><h2>Trạng thái provider</h2><strong data-state="${escapeHtml(providerState)}">${escapeHtml(providerLabel)}</strong><p>${providerState === "ready" ? "Nguồn AI đã báo sẵn sàng qua dữ liệu được cấp." : "Trạng thái không được giả lập; hãy mở công cụ để kiểm tra provider."}</p></section></div>
          <button class="gha-ai-core" type="button" data-gha-route="/chat-ai" aria-label="Mở HH AI Copilot"><span aria-hidden="true">AI</span><strong>AI UNIVERSE</strong><small>HH Copilot</small></button>
          <div class="gha-ai-destinations" role="navigation" aria-label="Công cụ AI">${AI_DESTINATIONS.map((destination, index) => `<button type="button" data-gha-route="${destination.route}" style="--x:${destination.x}%;--y:${destination.y}%;--delay:${index * -2.1}s"><span aria-hidden="true">${destination.glyph}</span><strong>${destination.label}</strong><small>${destination.description}</small></button>`).join("")}</div>
          <footer class="gha-ai-world__facts"><span><b>Điều hướng</b> Route nội bộ</span><span><b>Dữ liệu</b> Local/API được cấp</span><span><b>Chat</b> Engine hiện có</span><span><b>Fallback</b> Trạng thái rõ ràng</span></footer>
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
    const toggle = runtime.host.querySelector('[data-gha-action="focus-toggle"]');
    if (time) time.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    if (state) state.textContent = runtime.focus.running ? "Đang tập trung" : "Sẵn sàng";
    if (count) count.textContent = `${runtime.focus.completed} phiên hoàn thành`;
    if (toggle) toggle.textContent = runtime.focus.running ? "Tạm dừng" : "Bắt đầu";
  }

  async function updateStorageEstimate(runtime) {
    const stateNode = runtime.host.querySelector("[data-gha-storage-state]");
    const valueNode = runtime.host.querySelector("[data-gha-storage-value]");
    const detailNode = runtime.host.querySelector("[data-gha-storage-detail]");
    const barNode = runtime.host.querySelector("[data-gha-storage-bar]");
    if (!stateNode || !valueNode) return;
    if (typeof globalScope.navigator?.storage?.estimate !== "function") {
      stateNode.dataset.state = "unsupported";
      stateNode.textContent = "Không hỗ trợ";
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
      valueNode.textContent = `${formatter.format(usedMb)} / ${formatter.format(quotaMb)}`;
      if (detailNode) detailNode.textContent = `${(usage / quota * 100).toFixed(1)}% quota dành cho website đã dùng.`;
      if (barNode) barNode.style.setProperty("--usage", `${clamp(usage / quota * 100, 0, 100)}%`);
      runtime.state.storage = { supported: true, usage, quota };
    } catch {
      stateNode.dataset.state = "error";
      stateNode.textContent = "Không đọc được";
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
    if (!event.target.matches?.("[data-gha-search]")) return;
    const query = event.target.value.trim().toLocaleLowerCase("vi");
    runtime.host.querySelectorAll("[data-gha-planet], .gha-ai-destinations [data-gha-route]").forEach((node) => {
      node.hidden = Boolean(query && !node.textContent.toLocaleLowerCase("vi").includes(query));
    });
  }

  function handleKeydown(runtime, event) {
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !/input|textarea|select/i.test(event.target.tagName)) {
      event.preventDefault();
      runtime.host.querySelector("[data-gha-search]")?.focus();
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

  function bindRuntime(runtime) {
    const signal = runtime.controller.signal;
    runtime.host.addEventListener("click", (event) => handleClick(runtime, event), { signal });
    runtime.host.addEventListener("change", (event) => handleChange(runtime, event), { signal });
    runtime.host.addEventListener("input", (event) => handleInput(runtime, event), { signal });
    runtime.host.addEventListener("keydown", (event) => handleKeydown(runtime, event), { signal });
    globalScope.addEventListener?.("online", () => updateNetwork(runtime), { signal });
    globalScope.addEventListener?.("offline", () => updateNetwork(runtime), { signal });
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
    applyMapZoom(runtime);
    updateNetwork(runtime);
    updateClock(runtime);
    updateFocus(runtime);
    if (runtime.route === "/home/dashboard") updateStorageEstimate(runtime);
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
