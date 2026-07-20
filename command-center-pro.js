(function () {
  "use strict";

  const rootId = "commandCenterProRoot";
  const KEYS = {
    todos: "hh.command-center.todos.v2",
    events: "hh.command-center.events.v1",
    bookmarks: "hh.command-center.bookmarks.v1",
    files: "hh.command-center.files.v1",
    activity: "hh.command-center.activity.v1",
    pomodoro: "hh.command-center.pomodoro.v1",
    theme: "hh.command-center.theme.v1",
    quote: "hh.command-center.quote.v1",
    news: "hh.command-center.news.v1",
    layout: "hh.command-center.layout.v3",
    preset: "hh.command-center.preset.v1"
  };
  const NOTES_KEY = "hh.dashboard.sticky-notes.v1";
  const themes = ["dark", "light", "cyberpunk", "ocean", "aurora", "emerald", "purple", "sunset", "neon", "glass"];
  const widgetSizes = ["small", "medium", "large"];
  const widgetCatalog = [
    ["google", "Google Hub", "medium"], ["ai", "AI Assistant", "medium"],
    ["todo", "Todo Workspace", "medium"], ["calendar", "Calendar", "medium"],
    ["server", "Server Status", "small"], ["activity", "Recent Activity", "small"],
    ["projects", "Projects", "small"], ["launch", "Quick Launch", "medium"],
    ["bookmarks", "Bookmarks", "medium"], ["files", "Recent Files", "small"],
    ["pomodoro", "Pomodoro", "small"], ["music", "Music Focus", "small"],
    ["news", "Technology Feed", "large"]
  ];
  const layoutPresets = {
    focus: {
      label: "Tập trung",
      icon: "◎",
      widgets: ["todo", "pomodoro", "calendar", "projects", "activity"],
      sizes: { todo: "large", pomodoro: "small", calendar: "medium", projects: "medium", activity: "small" }
    },
    creative: {
      label: "Sáng tạo",
      icon: "✦",
      widgets: ["ai", "google", "music", "launch", "bookmarks", "news"],
      sizes: { ai: "medium", google: "medium", music: "small", launch: "medium", bookmarks: "medium", news: "large" }
    },
    manage: {
      label: "Quản lý",
      icon: "▦",
      widgets: ["projects", "todo", "calendar", "server", "activity", "files"],
      sizes: { projects: "medium", todo: "medium", calendar: "medium", server: "small", activity: "small", files: "small" }
    },
    learn: {
      label: "Học tập",
      icon: "◇",
      widgets: ["google", "ai", "pomodoro", "bookmarks", "news"],
      sizes: { google: "medium", ai: "medium", pomodoro: "small", bookmarks: "medium", news: "large" }
    }
  };
  const quotes = [
    "Mỗi bản phát hành tốt bắt đầu từ một thay đổi nhỏ nhưng rõ mục tiêu.",
    "Đơn giản không phải ít tính năng; đó là mọi thứ đều có đúng vị trí.",
    "Tập trung vào việc quan trọng nhất, rồi làm nó tốt hơn hôm qua.",
    "Ý tưởng chỉ thật sự có giá trị khi được biến thành một trải nghiệm dùng được.",
    "Tiến bộ đều đặn luôn bền hơn một ngày làm việc quá sức."
  ];
  const quickApps = [
    ["Google", "G", "https://www.google.com/", "#5ce8f2", "#7cffcf"],
    ["YouTube", "▶", "https://www.youtube.com/", "#ff667f", "#ff3d9f"],
    ["Maps", "M", "https://maps.google.com/", "#66e59b", "#55a6ff"],
    ["Translate", "文", "https://translate.google.com/", "#63a7ff", "#65e4ff"],
    ["Scholar", "S", "https://scholar.google.com/", "#8ba8ff", "#bd8cff"],
    ["Gmail", "M", "https://mail.google.com/", "#ff6f7d", "#ffc95b"],
    ["Drive", "D", "https://drive.google.com/", "#5ce8f2", "#d9ff66"],
    ["Docs", "D", "https://docs.google.com/", "#6da9ff", "#61eaff"],
    ["Sheets", "S", "https://sheets.google.com/", "#63e6a7", "#a9ff6b"],
    ["Calendar", "C", "https://calendar.google.com/", "#72aaff", "#ff6b86"],
    ["Keep", "K", "https://keep.google.com/", "#ffe360", "#ffaf54"],
    ["Gemini", "✦", "https://gemini.google.com/", "#8c9bff", "#fa71d5"],
    ["Lens", "L", "https://lens.google.com/", "#58e9e0", "#ff8bd4"],
    ["Chrome", "C", "https://www.google.com/chrome/", "#67dca7", "#ffcf62"]
  ];
  const launchApps = [
    ["ChatGPT", "AI", "https://chatgpt.com/"], ["Claude", "CL", "https://claude.ai/"],
    ["Gemini", "✦", "https://gemini.google.com/"], ["GitHub", "GH", "https://github.com/"],
    ["Vercel", "▲", "https://vercel.com/"], ["Cloudflare", "CF", "https://dash.cloudflare.com/"],
    ["Canva", "CA", "https://www.canva.com/"], ["Figma", "FI", "https://www.figma.com/"],
    ["Discord", "DC", "https://discord.com/app"], ["Messenger", "MS", "https://www.messenger.com/"],
    ["Facebook", "FB", "https://www.facebook.com/"], ["YouTube", "YT", "https://www.youtube.com/"],
    ["VS Code", "VS", "https://vscode.dev/"], ["StackOverflow", "SO", "https://stackoverflow.com/"]
  ];
  const serverChecks = [
    ["Frontend", () => `${location.origin}/?health=${Date.now()}`],
    ["Backend", () => apiUrl("/api/store/products")],
    ["API", () => apiUrl("/api/donations")],
    ["Database", () => apiUrl("/api/donations")],
    ["Storage", () => apiUrl("/api/storage/files")],
    ["Authentication", () => apiUrl("/api/auth/me")]
  ];
  const state = {
    initialized: false,
    todoFilter: "all",
    calendarDate: new Date(),
    pomodoroTimer: null,
    pomodoroSeconds: 25 * 60,
    pomodoroMode: "focus",
    github: null,
    statHistory: Array.from({ length: 8 }, () => []),
    layoutDragId: ""
  };

  const byId = (id) => document.getElementById(id);
  const root = () => byId(rootId);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const uid = (prefix = "item") => `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || "") ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const debounce = (callback, wait = 180) => { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => callback(...args), wait); }; };
  const formatDate = (value, options = {}) => value ? new Date(value).toLocaleDateString("vi-VN", options) : "Chưa đặt";
  const formatTime = (value) => new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const hostname = (value) => { try { return new URL(value).hostname; } catch { return "Liên kết đã lưu"; } };
  const apiBase = () => String(window.HH_REALTIME_URL || "").replace(/\/$/, "");
  const apiUrl = (path) => `${apiBase()}${path}` || path;

  function toast(title, message, icon = "✦") {
    let stack = document.querySelector(".cc-toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "cc-toast-stack";
      document.body.append(stack);
    }
    const node = document.createElement("div");
    node.className = "cc-toast";
    node.innerHTML = `<i>${escapeHtml(icon)}</i><div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span></div>`;
    stack.append(node);
    setTimeout(() => node.remove(), 3600);
  }

  function requestText({ title, message = "", value = "", placeholder = "", type = "text" }) {
    let dialog = document.querySelector(".cc-modal");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.className = "cc-modal";
      document.body.append(dialog);
    }
      dialog.innerHTML = `<form method="dialog"><header><h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p></header><input class="cc-input" name="value" type="${escapeHtml(type)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" required><menu><button class="cc-button" value="cancel" type="submit" formnovalidate>Hủy</button><button class="cc-button cc-button--primary" value="confirm" type="submit">Xác nhận</button></menu></form>`;
    return new Promise((resolve) => {
      dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm" ? dialog.querySelector('[name="value"]')?.value.trim() || "" : null), { once: true });
      dialog.returnValue = "";
      dialog.showModal();
      requestAnimationFrame(() => dialog.querySelector("input")?.focus());
    });
  }

  function logActivity(action, icon = "✦", color = "#5ce8f2") {
    const items = read(KEYS.activity, []);
    write(KEYS.activity, [{ id: uid("activity"), action, icon, color, time: Date.now() }, ...items].slice(0, 40));
    renderActivity();
  }

  function user() {
    return read("hh-auth-user", {});
  }

  function projectState() {
    const data = read("hh-project-center", {});
    if (Array.isArray(data.projects)) return data;
    return {
      projects: [
        { id: "platform", name: "HH Platform", progress: 82, deadline: "2026-08-01", priority: "Cao", status: "Đang phát triển", color: "#5ce8f2" },
        { id: "script-ai", name: "Kịch bản AI", progress: 74, deadline: "2026-07-28", priority: "Cao", status: "Hoàn thiện", color: "#ff63c8" },
        { id: "voice", name: "HH Voice Studio", progress: 65, deadline: "2026-08-15", priority: "Vừa", status: "Đang thử nghiệm", color: "#b8ff62" }
      ], activity: []
    };
  }

  function ensureDefaults() {
    if (!read(KEYS.todos, null)) write(KEYS.todos, [
      { id: uid("todo"), title: "Kiểm tra dashboard Command Center", priority: "high", category: "Website", deadline: new Date().toISOString().slice(0, 10), repeat: "none", completed: false, createdAt: Date.now() },
      { id: uid("todo"), title: "Xem tiến độ các dự án", priority: "medium", category: "Dự án", deadline: "", repeat: "weekly", completed: false, createdAt: Date.now() }
    ]);
    if (!read(KEYS.bookmarks, null)) write(KEYS.bookmarks, [
      { id: uid("bookmark"), title: "Nhhoang · HH Neon Platform", url: "https://nhhoang13all.xyz/", category: "Cá nhân", favorite: true },
      { id: uid("bookmark"), title: "GitHub", url: "https://github.com/hoangdaika13", category: "Developer", favorite: true }
    ]);
    if (!read(KEYS.events, null)) write(KEYS.events, []);
    if (!read(KEYS.files, null)) write(KEYS.files, []);
  }

  function defaultLayout() {
    return widgetCatalog.map(([id, label, size], order) => ({ id, label, size, order, pinned: false, hidden: false }));
  }

  function normalizeLayout(raw) {
    const source = Array.isArray(raw) ? raw : Array.isArray(raw?.widgets) ? raw.widgets : [];
    const saved = new Map(source.filter((item) => item && typeof item.id === "string").map((item) => [item.id, item]));
    return defaultLayout().map((fallback) => {
      const item = saved.get(fallback.id) || {};
      return {
        ...fallback,
        size: widgetSizes.includes(item.size) ? item.size : fallback.size,
        order: Number.isFinite(Number(item.order)) ? Number(item.order) : fallback.order,
        pinned: Boolean(item.pinned),
        hidden: Boolean(item.hidden)
      };
    }).sort((a, b) => a.order - b.order).map((item, order) => ({ ...item, order }));
  }

  function readLayout() {
    return normalizeLayout(read(KEYS.layout, null));
  }

  function announceLayout(message) {
    const live = byId("ccLayoutStatus");
    if (live) live.textContent = message;
  }

  function layoutToolbarMarkup() {
    return `<section class="cc-layout-toolbar cc-reveal" aria-label="Bố cục Command Center">
      <div class="cc-layout-toolbar__intro"><span>WORKSPACE</span><strong>Bố cục linh hoạt</strong><small>Kéo widget, đổi kích thước hoặc dùng preset.</small></div>
      <nav class="cc-layout-presets" aria-label="Preset bố cục">${Object.entries(layoutPresets).map(([id, preset]) => `<button type="button" data-layout-preset="${id}" aria-pressed="false"><i aria-hidden="true">${preset.icon}</i><span>${preset.label}</span></button>`).join("")}</nav>
      <details class="cc-layout-library" data-layout-menu>
        <summary><span>Tùy chỉnh widget</span><b id="ccHiddenWidgetCount">0 ẩn</b></summary>
        <div class="cc-layout-library__panel">
          <header><div><strong>Thư viện widget</strong><small>Hiện lại, đặt lại hoặc xuất bố cục.</small></div><div><button type="button" data-layout-show-all>Hiện tất cả</button><button type="button" data-layout-reset>Đặt lại</button></div></header>
          <div id="ccWidgetLibrary" class="cc-widget-library"></div>
        </div>
      </details>
      <span class="cc-sr-only" id="ccLayoutStatus" aria-live="polite"></span>
    </section>`;
  }

  function installWidgetControls() {
    root()?.querySelectorAll("[data-cc-widget]").forEach((widget) => {
      const id = widget.dataset.ccWidget;
      const header = widget.querySelector(":scope > header");
      if (!header || header.querySelector("[data-widget-controls]")) return;
      widget.setAttribute("aria-label", `${widgetCatalog.find((item) => item[0] === id)?.[1] || id} widget`);
      const controls = document.createElement("div");
      controls.className = "cc-widget-controls";
      controls.dataset.widgetControls = id;
      controls.setAttribute("role", "toolbar");
      controls.setAttribute("aria-label", `Điều khiển widget ${id}`);
      controls.innerHTML = `<button type="button" draggable="true" data-widget-drag="${id}" title="Kéo để sắp xếp" aria-label="Kéo hoặc dùng phím mũi tên để di chuyển" aria-grabbed="false">↕</button><button type="button" data-widget-pin="${id}" title="Ghim widget" aria-label="Ghim widget">◇</button><button type="button" data-widget-size="${id}" title="Đổi kích thước" aria-label="Đổi kích thước widget">M</button><button type="button" data-widget-hide="${id}" title="Ẩn widget" aria-label="Ẩn widget">×</button>`;
      header.append(controls);
    });
  }

  function renderWidgetLibrary(layout) {
    const library = byId("ccWidgetLibrary");
    if (!library) return;
    const sorted = [...layout].sort((a, b) => Number(b.hidden) - Number(a.hidden) || a.order - b.order);
    library.innerHTML = sorted.map((item) => `<button type="button" data-widget-visibility="${item.id}" aria-pressed="${!item.hidden}"><i aria-hidden="true">${item.hidden ? "+" : "✓"}</i><span><strong>${escapeHtml(item.label)}</strong><small>${item.hidden ? "Đang ẩn · bấm để hiện" : `${item.pinned ? "Đã ghim · " : ""}${item.size}`}</small></span></button>`).join("");
    const count = layout.filter((item) => item.hidden).length;
    if (byId("ccHiddenWidgetCount")) byId("ccHiddenWidgetCount").textContent = `${count} ẩn`;
  }

  function applyLayout(layout = readLayout(), { persist = false, announce = "" } = {}) {
    const normalized = normalizeLayout(layout);
    if (persist) write(KEYS.layout, normalized);
    const grid = root()?.querySelector(".cc-grid");
    if (!grid) return normalized;
    [...normalized].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.order - b.order).forEach((item) => {
      const widget = grid.querySelector(`[data-cc-widget="${CSS.escape(item.id)}"]`);
      if (!widget) return;
      widget.hidden = item.hidden;
      widget.dataset.widgetSize = item.size;
      widget.classList.toggle("is-pinned", item.pinned);
      widget.setAttribute("aria-hidden", String(item.hidden));
      grid.append(widget);
      const pin = widget.querySelector("[data-widget-pin]");
      const size = widget.querySelector("[data-widget-size]");
      if (pin) { pin.textContent = item.pinned ? "◆" : "◇"; pin.setAttribute("aria-pressed", String(item.pinned)); pin.title = item.pinned ? "Bỏ ghim widget" : "Ghim widget"; }
      if (size) { size.textContent = item.size === "small" ? "S" : item.size === "large" ? "L" : "M"; size.dataset.currentSize = item.size; }
    });
    const activePreset = read(KEYS.preset, "custom");
    root()?.querySelectorAll("[data-layout-preset]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.layoutPreset === activePreset)));
    renderWidgetLibrary(normalized);
    if (announce) announceLayout(announce);
    return normalized;
  }

  function saveCustomLayout(layout, message) {
    write(KEYS.preset, "custom");
    return applyLayout(layout, { persist: true, announce: message });
  }

  function applyPreset(id) {
    const preset = layoutPresets[id];
    if (!preset) return;
    const rank = new Map(preset.widgets.map((widget, index) => [widget, index]));
    const layout = defaultLayout().map((item) => ({
      ...item,
      order: rank.has(item.id) ? rank.get(item.id) : preset.widgets.length + item.order,
      size: preset.sizes[item.id] || item.size,
      pinned: false,
      hidden: !rank.has(item.id)
    }));
    write(KEYS.preset, id);
    applyLayout(layout, { persist: true, announce: `Đã áp dụng preset ${preset.label}.` });
    logActivity(`Đã áp dụng bố cục ${preset.label}`, preset.icon, "#5ce8f2");
    toast("Đã đổi bố cục", `Preset ${preset.label} đã sẵn sàng.`, preset.icon);
  }

  function updateWidget(id, updater, message) {
    const layout = readLayout();
    const item = layout.find((entry) => entry.id === id);
    if (!item) return;
    updater(item, layout);
    saveCustomLayout(layout, message);
  }

  function moveWidget(id, direction) {
    const layout = readLayout().sort((a, b) => a.order - b.order);
    const index = layout.findIndex((item) => item.id === id);
    const target = clamp(index + direction, 0, layout.length - 1);
    if (index < 0 || index === target) return;
    const targetPinned = layout[target].pinned;
    const [moved] = layout.splice(index, 1);
    moved.pinned = targetPinned;
    layout.splice(target, 0, moved);
    layout.forEach((item, order) => { item.order = order; });
    saveCustomLayout(layout, `Đã chuyển ${moved.label} sang vị trí ${target + 1}.`);
    root()?.querySelector(`[data-widget-drag="${CSS.escape(id)}"]`)?.focus();
  }

  function reorderWidgets(sourceId, targetId) {
    const layout = readLayout().sort((a, b) => a.order - b.order);
    const from = layout.findIndex((item) => item.id === sourceId);
    const to = layout.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    const targetPinned = layout[to].pinned;
    const [moved] = layout.splice(from, 1);
    moved.pinned = targetPinned;
    layout.splice(to, 0, moved);
    layout.forEach((item, order) => { item.order = order; });
    saveCustomLayout(layout, `Đã đặt ${moved.label} ở vị trí ${to + 1}.`);
  }

  function mountHero() {
    const hero = document.querySelector(".dashboard-hero-pro");
    if (!hero || hero.querySelector(".cc-hero-profile")) return;
    const account = user();
    const name = account.name || "Thành viên HH";
    const initials = name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase() || "HH";
    const profile = document.createElement("div");
    profile.className = "cc-hero-profile";
    profile.innerHTML = `<span class="cc-hero-avatar">${account.avatar ? `<img src="${escapeHtml(account.avatar)}" alt="Avatar ${escapeHtml(name)}">` : escapeHtml(initials)}</span><div><strong>${escapeHtml(name)}</strong><small id="ccHeroGoal">Mục tiêu: hoàn thành công việc hôm nay</small></div><div class="cc-hero-minis"><span id="ccHeroWeather">Thời tiết đang tải</span><span id="ccHeroCpu">CPU --</span><span id="ccHeroRam">RAM --</span><span id="ccHeroBattery">Pin --</span></div><div class="cc-hero-progress"><span>Tiến độ</span><span class="cc-progress"><i id="ccHeroProgress"></i></span><b id="ccHeroProgressText">0%</b></div>`;
    hero.append(profile);
    const copy = hero.querySelector(".dashboard-hero-copy");
    if (copy && !byId("ccHeroQuote")) {
      const quote = document.createElement("div");
      quote.className = "cc-hero-quote";
      quote.innerHTML = `<span id="ccHeroQuote"></span><button type="button" data-quote-next title="Đổi câu trích dẫn" aria-label="Đổi câu trích dẫn">↻</button>`;
      copy.append(quote);
    }
    renderQuote();
    updateHeroProgress();
  }

  function renderQuote(next = false) {
    let index = Number(read(KEYS.quote, 0));
    if (next) index = (index + 1) % quotes.length;
    write(KEYS.quote, index);
    if (byId("ccHeroQuote")) byId("ccHeroQuote").textContent = `“${quotes[index]}”`;
  }

  function updateHeroProgress() {
    const todos = read(KEYS.todos, []);
    const today = new Date().toISOString().slice(0, 10);
    const relevant = todos.filter((item) => !item.deadline || item.deadline === today);
    const done = relevant.filter((item) => item.completed).length;
    const progress = relevant.length ? Math.round(done / relevant.length * 100) : 0;
    if (byId("ccHeroProgress")) byId("ccHeroProgress").style.width = `${progress}%`;
    if (byId("ccHeroProgressText")) byId("ccHeroProgressText").textContent = `${progress}%`;
    if (byId("ccHeroGoal")) byId("ccHeroGoal").textContent = relevant.length ? `${done}/${relevant.length} mục tiêu hôm nay` : "Tạo mục tiêu đầu tiên cho hôm nay";
  }

  const statCard = (label, icon, valueId, metaId, color, index) => `<article class="cc-stat cc-reveal" style="--stat-color:${color}"><header><span>${label}</span><i>${icon}</i></header><strong id="${valueId}">--</strong><small id="${metaId}">Đang đồng bộ</small><svg viewBox="0 0 100 22" preserveAspectRatio="none" aria-hidden="true"><polyline id="ccStatGraph${index}" points="0,20 100,20"></polyline></svg></article>`;

  function markup() {
    const googleApps = quickApps.map((app) => `<a class="cc-app" href="${app[2]}" target="_blank" rel="noopener" style="--app-a:${app[3]};--app-b:${app[4]}" title="Mở ${app[0]}"><i>${app[1]}</i><span>${app[0]}</span></a>`).join("");
    const launch = launchApps.map((app, index) => `<a class="cc-app" href="${app[2]}" target="_blank" rel="noopener" style="--app-a:${index % 3 === 0 ? "#5ce8f2" : index % 3 === 1 ? "#ff63c8" : "#b8ff62"};--app-b:#8f83ff"><i>${app[1]}</i><span>${app[0]}</span></a>`).join("");
    return `
      ${layoutToolbarMarkup()}
      <section class="cc-stats" aria-label="Chỉ số nhanh">
        ${statCard("CPU", "C", "ccCpu", "ccCpuMeta", "#5ce8f2", 0)}
        ${statCard("RAM", "R", "ccRam", "ccRamMeta", "#ff63c8", 1)}
        ${statCard("GPU", "G", "ccGpu", "ccGpuMeta", "#9f8cff", 2)}
        ${statCard("DISK", "D", "ccDisk", "ccDiskMeta", "#b8ff62", 3)}
        ${statCard("INTERNET", "↗", "ccNet", "ccNetMeta", "#63e6a7", 4)}
        ${statCard("GITHUB", "GH", "ccGithub", "ccGithubMeta", "#7da8ff", 5)}
        ${statCard("STORAGE", "S", "ccStorage", "ccStorageMeta", "#ffc75c", 6)}
        ${statCard("TASKS", "✓", "ccTasks", "ccTasksMeta", "#ff7b91", 7)}
      </section>
      <div class="cc-grid">
        <section class="cc-section cc-span-7 cc-reveal" data-cc-widget="google"><header><div><small>Quick Access Hub</small><h3>Google Workspace & dịch vụ nhanh</h3></div><button type="button" data-search-watch-open="google">Mở trung tâm</button></header><form class="cc-google-search" data-google-search><input class="cc-input" name="query" type="search" placeholder="Tìm Google ngay trong HH Platform..." autocomplete="off"><button class="cc-button cc-button--primary" type="submit">Tìm kiếm</button></form><div class="cc-app-grid">${googleApps}</div></section>
        <section class="cc-section cc-span-5 cc-reveal" data-cc-widget="ai"><header><div><small>AI Assistant</small><h3>Trợ lý tác vụ nhanh</h3></div><button type="button" data-app-route="/create/ai-center">AI Center</button></header><div class="cc-ai-body"><textarea class="cc-textarea" id="ccAiInput" placeholder="Dán văn bản, câu hỏi hoặc đoạn code..."></textarea><div class="cc-ai-actions">${["Tóm tắt","Dịch","Giải thích","Tạo nội dung","Sửa code","Tìm kiếm"].map((label) => `<button class="cc-button" type="button" data-ai-action="${label}">${label}</button>`).join("")}</div><div class="cc-ai-result" id="ccAiResult">Chọn một tác vụ. Tóm tắt ngắn chạy ngay trên thiết bị; các tác vụ AI chuyên sâu sẽ được chuyển sang AI Center với nội dung đã chuẩn bị.</div></div></section>

        <section class="cc-section cc-span-7 cc-reveal" data-cc-widget="todo"><header><div><small>Todo Workspace</small><h3>Công việc & tiến độ hôm nay</h3></div><button type="button" data-todo-clear-complete>Dọn mục đã xong</button></header><form class="cc-form-row" data-todo-form><input class="cc-input" name="title" required maxlength="140" placeholder="Thêm công việc mới..."><select class="cc-select" name="priority"><option value="medium">Ưu tiên vừa</option><option value="high">Ưu tiên cao</option><option value="low">Ưu tiên thấp</option></select><input class="cc-input" name="category" maxlength="30" placeholder="Danh mục"><input class="cc-input" name="deadline" type="date" title="Deadline"><input class="cc-input" name="reminder" type="datetime-local" title="Nhắc lịch"><select class="cc-select" name="repeat"><option value="none">Không lặp</option><option value="daily">Hàng ngày</option><option value="weekly">Hàng tuần</option><option value="monthly">Hàng tháng</option></select><button class="cc-button cc-button--primary" type="submit">Thêm</button></form><div class="cc-todo-toolbar"><button class="is-active" type="button" data-todo-filter="all">Tất cả</button><button type="button" data-todo-filter="today">Hôm nay</button><button type="button" data-todo-filter="tomorrow">Ngày mai</button><button type="button" data-todo-filter="week">Tuần này</button><button type="button" data-todo-filter="completed">Đã xong</button><input class="cc-input" id="ccTodoSearch" type="search" placeholder="Lọc công việc..." style="width:min(180px,100%);height:29px"></div><div class="cc-todo-progress"><span>Tiến độ</span><span class="cc-progress"><i id="ccTodoProgress"></i></span><b id="ccTodoProgressText">0%</b></div><div class="cc-todo-list" id="ccTodoList"></div></section>
        <section class="cc-section cc-span-5 cc-reveal" data-cc-widget="calendar"><header><div><small>Calendar</small><h3>Lịch, deadline & sự kiện</h3></div><button type="button" data-calendar-add>＋ Sự kiện</button></header><div class="cc-calendar"><div class="cc-calendar-main"><div class="cc-calendar-nav"><button class="cc-icon-button" type="button" data-calendar-prev>‹</button><strong id="ccCalendarTitle"></strong><button class="cc-icon-button" type="button" data-calendar-next>›</button></div><div class="cc-calendar-week">${["T2","T3","T4","T5","T6","T7","CN"].map((day) => `<span>${day}</span>`).join("")}</div><div class="cc-calendar-days" id="ccCalendarDays"></div></div><aside class="cc-calendar-events"><h4>Sắp tới</h4><div id="ccCalendarEvents"></div></aside></div></section>

        <section class="cc-section cc-span-4 cc-reveal" data-cc-widget="server"><header><div><small>Server Status</small><h3>Tình trạng dịch vụ</h3></div><button type="button" data-server-refresh>Làm mới</button></header><div class="cc-server-list" id="ccServerList"></div></section>
        <section class="cc-section cc-span-4 cc-reveal" data-cc-widget="activity"><header><div><small>Recent Activity</small><h3>Dòng thời gian hoạt động</h3></div><button type="button" data-activity-clear>Xóa lịch sử</button></header><div class="cc-activity-list" id="ccActivityList"></div></section>
        <section class="cc-section cc-span-4 cc-reveal" data-cc-widget="projects"><header><div><small>Projects</small><h3>Tiến độ dự án</h3></div><button type="button" data-app-route="/work/project-center">Quản lý</button></header><div class="cc-project-list" id="ccProjectList"></div></section>

        <section class="cc-section cc-span-7 cc-reveal" data-cc-widget="launch"><header><div><small>Quick Launch</small><h3>Ứng dụng thường dùng</h3></div><button type="button" data-command-open>Ctrl K</button></header><div class="cc-app-grid">${launch}</div></section>
        <section class="cc-section cc-span-5 cc-reveal" data-cc-widget="bookmarks"><header><div><small>Bookmarks</small><h3>Website đã ghim</h3></div><button type="button" data-bookmark-add>＋ Thêm</button></header><div class="cc-bookmark-list" id="ccBookmarkList"></div></section>

        <section class="cc-section cc-span-4 cc-reveal" data-cc-widget="files"><header><div><small>Recent Files</small><h3>Tệp gần đây trên thiết bị</h3></div><label class="cc-button" style="display:grid;place-items:center;cursor:pointer">Chọn tệp<input type="file" data-file-pick multiple hidden></label></header><div class="cc-file-list" id="ccFileList"></div></section>
        <section class="cc-section cc-span-4 cc-reveal" data-cc-widget="pomodoro"><header><div><small>Pomodoro</small><h3>Phiên tập trung</h3></div><button type="button" data-pomodoro-mode>Focus 25</button></header><div class="cc-pomodoro"><span class="cc-pomodoro-time" id="ccPomodoroTime">25:00</span><div class="cc-pomodoro-controls"><button class="cc-button cc-button--primary" type="button" data-pomodoro-toggle>Bắt đầu</button><button class="cc-button" type="button" data-pomodoro-reset>Đặt lại</button></div><small id="ccPomodoroStats">0 phiên tập trung hoàn thành hôm nay</small></div></section>
        <section class="cc-section cc-span-4 cc-reveal" data-cc-widget="music"><header><div><small>Music Focus</small><h3>Nhạc nền làm việc</h3></div><a href="https://music.youtube.com/" target="_blank" rel="noopener" class="cc-button" style="display:grid;place-items:center;text-decoration:none">Mở Music</a></header><div class="cc-music"><div class="cc-music-now"><span class="cc-music-art">♫</span><div><strong id="ccMusicTitle">HH Focus Radio</strong><small id="ccMusicStatus">Sẵn sàng phát nhạc nền</small></div></div><div class="cc-music-controls"><button class="cc-icon-button" type="button" data-music-prev title="Bài trước">‹</button><button class="cc-icon-button" type="button" data-music-toggle title="Phát / tạm dừng">▶</button><button class="cc-icon-button" type="button" data-music-next title="Bài tiếp">›</button><a class="cc-icon-button" href="https://open.spotify.com/" target="_blank" rel="noopener" title="Spotify" style="text-decoration:none">S</a><input id="ccMusicVolume" type="range" min="0" max="100" value="58" aria-label="Âm lượng"></div></div></section>

        <section class="cc-section cc-span-12 cc-reveal" data-cc-widget="news"><header><div><small>Technology Feed</small><h3>AI, lập trình, GitHub & công nghệ</h3></div><button type="button" data-news-refresh>Tải tin mới</button></header><div class="cc-news-list" id="ccNewsList"><div class="cc-empty">Tin tức sẽ được tải khi widget xuất hiện để tiết kiệm dữ liệu.</div></div></section>
      </div>`;
  }

  function graph(index, value) {
    const history = state.statHistory[index];
    history.push(clamp(Number(value) || 0, 0, 100));
    if (history.length > 18) history.shift();
    const points = history.map((item, i) => `${history.length === 1 ? 0 : i / (history.length - 1) * 100},${20 - item / 100 * 18}`).join(" ");
    const node = byId(`ccStatGraph${index}`);
    if (node) node.setAttribute("points", points || "0,20 100,20");
  }

  async function updateStats() {
    const lag = await new Promise((resolve) => { const start = performance.now(); setTimeout(() => resolve(performance.now() - start), 90); });
    const cpu = clamp(Math.round((lag - 90) * 2.2), 2, 100);
    const memory = performance.memory;
    const ramPercent = memory?.jsHeapSizeLimit ? memory.usedJSHeapSize / memory.jsHeapSizeLimit * 100 : 0;
    const fpsNode = byId("dashboardGpuValue");
    const fps = Number(fpsNode?.textContent?.match(/\d+/)?.[0]) || 60;
    let storage = { usage: 0, quota: 0 };
    try { storage = await navigator.storage?.estimate?.() || storage; } catch {}
    const connection = navigator.connection || {};
    const todos = read(KEYS.todos, []);
    const done = todos.filter((item) => item.completed).length;
    const storagePercent = storage.quota ? storage.usage / storage.quota * 100 : 0;
    const values = [
      ["ccCpu", `${cpu}%`, "ccCpuMeta", `${navigator.hardwareConcurrency || "?"} luồng · độ trễ tab`, cpu],
      ["ccRam", memory ? `${Math.round(memory.usedJSHeapSize / 1048576)} MB` : `~${navigator.deviceMemory || "?"} GB`, "ccRamMeta", memory ? "JS heap của tab" : "Ước lượng thiết bị", ramPercent || 28],
      ["ccGpu", `${fps} FPS`, "ccGpuMeta", (byId("dashboardGpuMeta")?.textContent || "WebGL renderer").slice(0, 34), fps / 60 * 100],
      ["ccDisk", `${storagePercent.toFixed(1)}%`, "ccDiskMeta", storage.quota ? `${Math.round(storage.usage / 1048576)} MB web data` : "Storage API giới hạn", storagePercent],
      ["ccNet", navigator.onLine ? (connection.downlink ? `${connection.downlink} Mbps` : "Online") : "Offline", "ccNetMeta", connection.effectiveType ? `${connection.effectiveType.toUpperCase()} · RTT ${connection.rtt || "?"}ms` : "Kết nối trình duyệt", navigator.onLine ? 82 : 0],
      ["ccGithub", state.github ? `${state.github.stars}★` : "Đang tải", "ccGithubMeta", state.github ? `${state.github.branch} · cập nhật ${state.github.updated}` : "GitHub public API", state.github ? 92 : 20],
      ["ccStorage", storage.usage ? `${Math.round(storage.usage / 1048576)} MB` : "Local", "ccStorageMeta", storage.quota ? `Quota ${Math.round(storage.quota / 1073741824)} GB` : "Dữ liệu trên thiết bị", storagePercent],
      ["ccTasks", `${done}/${todos.length}`, "ccTasksMeta", `${todos.filter((item) => !item.completed).length} việc còn lại`, todos.length ? done / todos.length * 100 : 0]
    ];
    values.forEach((item, index) => {
      if (byId(item[0])) byId(item[0]).textContent = item[1];
      if (byId(item[2])) byId(item[2]).textContent = item[3];
      graph(index, item[4]);
    });
    if (byId("ccHeroCpu")) byId("ccHeroCpu").textContent = `CPU ${cpu}%`;
    if (byId("ccHeroRam")) byId("ccHeroRam").textContent = memory ? `RAM ${Math.round(memory.usedJSHeapSize / 1048576)} MB` : `RAM ~${navigator.deviceMemory || "?"} GB`;
  }

  async function loadGithubStats() {
    try {
      const response = await fetch("https://api.github.com/repos/hoangdaika13/hoangdaika13.github.io", { headers: { Accept: "application/vnd.github+json" } });
      if (!response.ok) throw new Error();
      const data = await response.json();
      state.github = { stars: data.stargazers_count || 0, branch: data.default_branch || "main", updated: formatDate(data.pushed_at, { day: "2-digit", month: "2-digit" }) };
      updateStats();
      renderNotifications();
    } catch {
      state.github = { stars: 0, branch: "main", updated: "offline cache" };
    }
  }

  async function loadBattery() {
    if (!navigator.getBattery) {
      if (byId("ccHeroBattery")) byId("ccHeroBattery").textContent = "Pin riêng tư";
      return;
    }
    try {
      const battery = await navigator.getBattery();
      const update = () => { if (byId("ccHeroBattery")) byId("ccHeroBattery").textContent = `Pin ${Math.round(battery.level * 100)}%${battery.charging ? " ⚡" : ""}`; };
      update();
      battery.addEventListener("levelchange", update);
      battery.addEventListener("chargingchange", update);
    } catch {}
  }

  function watchHeroWeather() {
    const weather = byId("dashboardWeatherCurrent");
    if (!weather || !byId("ccHeroWeather")) return;
    const update = () => {
      const place = weather.querySelector("h4")?.textContent;
      const temperature = weather.querySelector(".dashboard-weather-main strong")?.textContent;
      if (place || temperature) byId("ccHeroWeather").textContent = [place, temperature].filter(Boolean).join(" · ");
    };
    update();
    new MutationObserver(update).observe(weather, { childList: true, subtree: true, characterData: true });
  }

  function todoFilter(item) {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const tomorrowDate = new Date(now); tomorrowDate.setDate(now.getDate() + 1);
    const tomorrow = tomorrowDate.toISOString().slice(0, 10);
    const weekDate = new Date(now); weekDate.setDate(now.getDate() + 7);
    const search = (byId("ccTodoSearch")?.value || "").trim().toLowerCase();
    if (search && !`${item.title} ${item.category}`.toLowerCase().includes(search)) return false;
    if (state.todoFilter === "today") return item.deadline === today;
    if (state.todoFilter === "tomorrow") return item.deadline === tomorrow;
    if (state.todoFilter === "week") return item.deadline && item.deadline >= today && item.deadline <= weekDate.toISOString().slice(0, 10);
    if (state.todoFilter === "completed") return item.completed;
    return true;
  }

  function renderTodos() {
    const list = byId("ccTodoList");
    if (!list) return;
    const todos = read(KEYS.todos, []);
    const filtered = todos.filter(todoFilter);
    const priority = { high: ["Cao", "#ff6688"], medium: ["Vừa", "#ffc75c"], low: ["Thấp", "#62e6b0"] };
    list.innerHTML = filtered.length ? filtered.map((item) => `<article class="cc-todo ${item.completed ? "is-complete" : ""}" draggable="true" data-todo-id="${item.id}" style="--priority:${priority[item.priority]?.[1] || "#5ce8f2"}"><input type="checkbox" data-todo-toggle ${item.completed ? "checked" : ""} aria-label="Đánh dấu hoàn thành"><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.category || "Chung")} · ${priority[item.priority]?.[0] || "Vừa"} · ${item.deadline ? formatDate(`${item.deadline}T12:00:00`, { day: "2-digit", month: "2-digit" }) : "Không deadline"}${item.reminder ? ` · Nhắc ${formatTime(item.reminder)}` : ""}${item.repeat && item.repeat !== "none" ? ` · Lặp ${escapeHtml(item.repeat)}` : ""}</small></div><menu><button class="cc-icon-button" type="button" data-todo-edit title="Sửa">✎</button><button class="cc-icon-button" type="button" data-todo-delete title="Xóa">×</button></menu></article>`).join("") : `<div class="cc-empty">Không có công việc trong bộ lọc này.</div>`;
    const done = todos.filter((item) => item.completed).length;
    const progress = todos.length ? Math.round(done / todos.length * 100) : 0;
    if (byId("ccTodoProgress")) byId("ccTodoProgress").style.width = `${progress}%`;
    if (byId("ccTodoProgressText")) byId("ccTodoProgressText").textContent = `${progress}%`;
    updateHeroProgress();
    renderNotifications();
  }

  function checkReminders() {
    const now = Date.now();
    const items = read(KEYS.todos, []);
    let changed = false;
    items.forEach((item) => {
      if (!item.completed && item.reminder && !item.reminded && new Date(item.reminder).getTime() <= now) {
        item.reminded = true;
        changed = true;
        toast("Nhắc việc", item.title, "◇");
        if ("Notification" in window && Notification.permission === "granted") new Notification("HH Platform · Nhắc việc", { body: item.title });
      }
    });
    if (changed) write(KEYS.todos, items);
  }

  function renderNotifications() {
    const container = document.querySelector("#notificationDrawer .app-drawer__content");
    if (!container) return;
    let dynamic = container.querySelector("[data-cc-notifications]");
    if (!dynamic) {
      dynamic = document.createElement("div");
      dynamic.dataset.ccNotifications = "";
      container.prepend(dynamic);
    }
    const todos = read(KEYS.todos, []);
    const today = new Date().toISOString().slice(0, 10);
    const due = todos.filter((item) => !item.completed && item.deadline && item.deadline <= today);
    dynamic.innerHTML = `<article class="app-notice ${due.length ? "app-notice--new" : ""}"><span>✓</span><div><strong>${due.length ? `${due.length} công việc cần chú ý` : "Todo đã được đồng bộ"}</strong><p>${due.length ? escapeHtml(due.slice(0, 2).map((item) => item.title).join(" · ")) : "Không có deadline quá hạn hôm nay."}</p><time>Command Center</time></div></article><article class="app-notice"><span>GH</span><div><strong>GitHub ${state.github ? "đã kết nối dữ liệu công khai" : "đang đồng bộ"}</strong><p>${state.github ? `${state.github.branch} · cập nhật ${state.github.updated}` : "Đang đọc trạng thái repository công khai."}</p><time>GitHub</time></div></article><article class="app-notice"><span>◇</span><div><strong>Tích hợp Mail và Discord</strong><p>Cần OAuth/API tương ứng trước khi website có thể đọc thông báo thật.</p><time>Quyền riêng tư được giữ nguyên</time></div></article>`;
  }

  function renderCalendar() {
    const daysNode = byId("ccCalendarDays");
    if (!daysNode) return;
    const view = state.calendarDate;
    const year = view.getFullYear();
    const month = view.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const start = new Date(year, month, 1 - startOffset);
    const today = new Date().toISOString().slice(0, 10);
    const events = calendarEvents();
    if (byId("ccCalendarTitle")) byId("ccCalendarTitle").textContent = new Date(year, month, 1).toLocaleDateString("vi-VN", { month: "long", year: "numeric" });
    daysNode.innerHTML = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start); date.setDate(start.getDate() + index);
      const iso = date.toISOString().slice(0, 10);
      const count = events.filter((item) => item.date === iso).length;
      return `<button class="cc-day ${date.getMonth() !== month ? "is-outside" : ""} ${iso === today ? "is-today" : ""} ${count ? "has-event" : ""}" type="button" data-calendar-date="${iso}" title="${count ? `${count} sự kiện` : "Thêm sự kiện"}">${date.getDate()}</button>`;
    }).join("");
    const upcoming = events.filter((item) => item.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);
    byId("ccCalendarEvents").innerHTML = upcoming.length ? upcoming.map((item) => `<article class="cc-event" style="--event-color:${item.color || "#5ce8f2"}"><strong>${escapeHtml(item.title)}</strong><small>${formatDate(`${item.date}T12:00:00`, { weekday: "short", day: "2-digit", month: "2-digit" })} · ${escapeHtml(item.type || "Sự kiện")}</small></article>`).join("") : `<div class="cc-empty">Chưa có sự kiện sắp tới.</div>`;
  }

  function calendarEvents() {
    const custom = read(KEYS.events, []);
    const todos = read(KEYS.todos, []).filter((item) => item.deadline).map((item) => ({ id: `todo-${item.id}`, title: item.title, date: item.deadline, type: "Deadline", color: item.completed ? "#62e6b0" : "#ff6688" }));
    const projects = projectState().projects?.filter((item) => item.deadline).map((item) => ({ id: `project-${item.id}`, title: item.name || item.title, date: item.deadline, type: "Dự án", color: item.color || "#9f8cff" })) || [];
    return [...custom, ...todos, ...projects];
  }

  async function checkServers() {
    const list = byId("ccServerList");
    if (!list) return;
    list.innerHTML = [...serverChecks.map(([name]) => name), "Cache", "Ping"].map((name) => `<article class="cc-server" data-status="checking"><i class="cc-led"></i><div><strong>${name}</strong><small>Đang kiểm tra...</small><span class="cc-progress"><i style="width:35%"></i></span></div><b>--</b></article>`).join("");
    const rows = [...list.querySelectorAll(".cc-server")];
    await Promise.all(serverChecks.map(async ([name, getUrl], index) => {
      const started = performance.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      let online = false;
      let status = "Không phản hồi";
      try {
        const response = await fetch(getUrl(), { signal: controller.signal, cache: "no-store", credentials: "omit" });
        online = response.status < 500;
        status = `HTTP ${response.status}`;
      } catch (error) { status = error.name === "AbortError" ? "Quá thời gian" : "Mất kết nối"; }
      clearTimeout(timer);
      const ms = Math.round(performance.now() - started);
      rows[index].dataset.status = online ? "online" : "offline";
      rows[index].querySelector("small").textContent = online ? `${status} · hoạt động` : status;
      rows[index].querySelector("b").textContent = `${ms}ms`;
      rows[index].querySelector(".cc-progress i").style.width = `${clamp(100 - ms / 20, 8, 100)}%`;
    }));
    const cacheIndex = serverChecks.length;
    const cacheAvailable = "caches" in window;
    rows[cacheIndex].dataset.status = cacheAvailable ? "online" : "offline";
    rows[cacheIndex].querySelector("small").textContent = cacheAvailable ? "Service Worker cache sẵn sàng" : "Cache API không hỗ trợ";
    rows[cacheIndex].querySelector("b").textContent = cacheAvailable ? "OK" : "--";
    rows[cacheIndex].querySelector(".cc-progress i").style.width = cacheAvailable ? "100%" : "0%";
    const pingRow = rows[cacheIndex + 1];
    const navigation = performance.getEntriesByType("navigation")[0];
    const ping = Math.round(navigation?.responseStart || 0);
    pingRow.dataset.status = navigator.onLine ? "online" : "offline";
    pingRow.querySelector("small").textContent = "Phản hồi tài liệu hiện tại";
    pingRow.querySelector("b").textContent = ping ? `${ping}ms` : "N/A";
    pingRow.querySelector(".cc-progress i").style.width = `${clamp(100 - ping / 20, 10, 100)}%`;
  }

  function renderActivity() {
    const list = byId("ccActivityList");
    if (!list) return;
    const projectActivity = (projectState().activity || []).slice(0, 6).map((action, index) => ({ id: `project-${index}`, action: String(action), icon: "P", color: "#9f8cff", time: Date.now() - (index + 1) * 3600000 }));
    const activities = [...read(KEYS.activity, []), ...projectActivity].sort((a, b) => b.time - a.time).slice(0, 12);
    list.innerHTML = activities.length ? activities.map((item) => `<article class="cc-activity" style="--activity-color:${item.color || "#5ce8f2"}"><i>${escapeHtml(item.icon || "✦")}</i><div><strong>${escapeHtml(item.action)}</strong><small>${new Date(item.time).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</small></div></article>`).join("") : `<div class="cc-empty">Hoạt động mới sẽ xuất hiện tại đây.</div>`;
  }

  function renderProjects() {
    const list = byId("ccProjectList");
    if (!list) return;
    const projects = projectState().projects || [];
    list.innerHTML = projects.length ? projects.slice(0, 6).map((item, index) => {
      const name = item.name || item.title || `Dự án ${index + 1}`;
      const progress = clamp(Number(item.progress) || 0, 0, 100);
      return `<article class="cc-project" style="--item-color:${item.color || "#5ce8f2"}"><i>${escapeHtml(name.slice(0, 2).toUpperCase())}</i><div><strong>${escapeHtml(name)}</strong><span class="cc-progress"><i style="width:${progress}%"></i></span><small>${progress}% · ${escapeHtml(item.status || item.priority || "Đang thực hiện")} · ${item.deadline ? formatDate(`${item.deadline}T12:00:00`, { day: "2-digit", month: "2-digit" }) : "Không deadline"}</small></div><b class="cc-label">${escapeHtml(item.priority || "Vừa")}</b></article>`;
    }).join("") : `<div class="cc-empty">Chưa có dự án. Mở Project Center để tạo dự án đầu tiên.</div>`;
  }

  function renderBookmarks() {
    const list = byId("ccBookmarkList");
    if (!list) return;
    const items = read(KEYS.bookmarks, []);
    list.innerHTML = items.length ? items.map((item) => `<article class="cc-bookmark" data-bookmark-id="${item.id}"><i>${escapeHtml(item.title.slice(0, 2).toUpperCase())}</i><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.category || "Website")} · ${escapeHtml(hostname(item.url))}</small></div><span class="cc-list-actions"><a class="cc-icon-button" href="${escapeHtml(item.url)}" target="_blank" rel="noopener" title="Mở" style="text-decoration:none">↗</a><button class="cc-icon-button" type="button" data-bookmark-delete title="Xóa">×</button></span></article>`).join("") : `<div class="cc-empty">Chưa ghim website nào.</div>`;
  }

  function renderFiles() {
    const list = byId("ccFileList");
    if (!list) return;
    const items = read(KEYS.files, []);
    list.innerHTML = items.length ? items.map((item) => `<article class="cc-file" data-file-id="${item.id}"><i>${escapeHtml((item.extension || "FILE").slice(0, 3).toUpperCase())}</i><div><strong>${escapeHtml(item.name)}</strong><small>${Math.max(1, Math.round(item.size / 1024))} KB · ${formatTime(item.modified)}</small></div><button class="cc-icon-button" type="button" data-file-favorite title="Yêu thích">${item.favorite ? "★" : "☆"}</button></article>`).join("") : `<div class="cc-empty">Chọn tệp từ máy tính hoặc điện thoại. Vì quyền riêng tư, trình duyệt chỉ lưu metadata, không tự tải lại nội dung tệp.</div>`;
  }

  function summarize(text) {
    const sentences = text.match(/[^.!?\n]+[.!?]?/g)?.map((item) => item.trim()).filter(Boolean) || [];
    if (!sentences.length) return "Hãy nhập nội dung trước khi tóm tắt.";
    const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
    const frequencies = words.reduce((map, word) => { if (word.length > 3) map[word] = (map[word] || 0) + 1; return map; }, {});
    return sentences.map((sentence, index) => ({ sentence, index, score: (sentence.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).reduce((score, word) => score + (frequencies[word] || 0), 0) })).sort((a, b) => b.score - a.score).slice(0, Math.min(3, sentences.length)).sort((a, b) => a.index - b.index).map((item) => `• ${item.sentence}`).join("\n");
  }

  function handleAi(action) {
    const input = byId("ccAiInput")?.value.trim() || "";
    const output = byId("ccAiResult");
    if (action === "Tóm tắt") {
      output.textContent = summarize(input);
      logActivity("Đã tóm tắt nội dung trong AI Assistant", "AI", "#9f8cff");
      return;
    }
    if (action === "Tìm kiếm") {
      if (!input) return toast("Thiếu nội dung", "Nhập từ khóa cần tìm.", "⌕");
      if (window.HHSearchWatch?.open) window.HHSearchWatch.open("google", input);
      else window.open(`https://www.google.com/search?q=${encodeURIComponent(input)}`, "_blank", "noopener");
      return;
    }
    if (!input) return toast("Thiếu nội dung", "Nhập nội dung để chuẩn bị tác vụ AI.", "AI");
    const prompts = {
      "Dịch": `Dịch nội dung sau sang tiếng Anh tự nhiên, giữ nguyên ý nghĩa:\n\n${input}`,
      "Giải thích": `Giải thích nội dung sau rõ ràng, có ví dụ dễ hiểu:\n\n${input}`,
      "Tạo nội dung": `Tạo nội dung hoàn chỉnh dựa trên yêu cầu sau:\n\n${input}`,
      "Sửa code": `Phân tích, sửa lỗi và tối ưu đoạn code sau. Giải thích thay đổi quan trọng:\n\n${input}`
    };
    sessionStorage.setItem("hh.ai.quick-prompt", prompts[action] || input);
    output.textContent = `Prompt đã được chuẩn bị cho ${action}. Đang mở AI Center...`;
    logActivity(`Đã tạo prompt ${action}`, "AI", "#9f8cff");
    setTimeout(() => { location.hash = "#/create/ai-center"; }, 350);
  }

  function renderPomodoro() {
    const minutes = Math.floor(state.pomodoroSeconds / 60);
    const seconds = state.pomodoroSeconds % 60;
    if (byId("ccPomodoroTime")) byId("ccPomodoroTime").textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    const saved = read(KEYS.pomodoro, { sessions: [] });
    const today = new Date().toISOString().slice(0, 10);
    const count = (saved.sessions || []).filter((item) => item.date === today).length;
    if (byId("ccPomodoroStats")) byId("ccPomodoroStats").textContent = `${count} phiên tập trung hoàn thành hôm nay`;
  }

  function togglePomodoro() {
    const button = document.querySelector("[data-pomodoro-toggle]");
    if (state.pomodoroTimer) {
      clearInterval(state.pomodoroTimer);
      state.pomodoroTimer = null;
      if (button) button.textContent = "Tiếp tục";
      return;
    }
    if (button) button.textContent = "Tạm dừng";
    state.pomodoroTimer = setInterval(() => {
      state.pomodoroSeconds -= 1;
      if (state.pomodoroSeconds <= 0) {
        clearInterval(state.pomodoroTimer);
        state.pomodoroTimer = null;
        const saved = read(KEYS.pomodoro, { sessions: [] });
        if (state.pomodoroMode === "focus") saved.sessions = [...(saved.sessions || []), { date: new Date().toISOString().slice(0, 10), endedAt: Date.now() }].slice(-100);
        write(KEYS.pomodoro, saved);
        toast("Hết giờ", state.pomodoroMode === "focus" ? "Đã hoàn thành một phiên tập trung." : "Giờ nghỉ đã kết thúc.", "◷");
        state.pomodoroMode = state.pomodoroMode === "focus" ? "break" : "focus";
        state.pomodoroSeconds = state.pomodoroMode === "focus" ? 25 * 60 : 5 * 60;
        if (button) button.textContent = "Bắt đầu";
        logActivity("Hoàn thành phiên Pomodoro", "◷", "#ffc75c");
      }
      renderPomodoro();
    }, 1000);
  }

  async function loadNews(force = false) {
    const list = byId("ccNewsList");
    if (!list) return;
    const cached = read(KEYS.news, null);
    if (!force && cached?.items && Date.now() - cached.savedAt < 30 * 60 * 1000) return renderNews(cached.items);
    list.innerHTML = `<div class="cc-empty">Đang tải tin mới từ cộng đồng DEV...</div>`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9000);
      const response = await fetch("https://dev.to/api/articles?per_page=8&top=7", { signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const items = await response.json();
      write(KEYS.news, { items, savedAt: Date.now() });
      renderNews(items);
    } catch {
      if (cached?.items) renderNews(cached.items);
      else list.innerHTML = `<div class="cc-empty">Chưa tải được tin tức. Kiểm tra mạng rồi chọn “Tải tin mới”.</div>`;
    }
  }

  function renderNews(items) {
    const list = byId("ccNewsList");
    if (!list) return;
    list.innerHTML = items.slice(0, 8).map((item) => `<article class="cc-news">${item.cover_image ? `<img src="${escapeHtml(item.cover_image)}" alt="" loading="lazy">` : `<i class="cc-hero-avatar" style="width:58px;height:42px;border-radius:5px">DEV</i>`}<div><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener"><strong>${escapeHtml(item.title)}</strong></a><small>${escapeHtml(item.user?.name || "DEV Community")} · ${item.reading_time_minutes || 1} phút đọc · ${item.positive_reactions_count || 0} phản ứng</small></div><a class="cc-icon-button" href="${escapeHtml(item.url)}" target="_blank" rel="noopener" title="Đọc bài" style="text-decoration:none">↗</a></article>`).join("");
  }

  function installThemeUi() {
    let panel = document.querySelector(".cc-theme-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "cc-theme-panel";
      panel.innerHTML = `<header>Giao diện Command Center</header>${themes.map((theme) => `<button type="button" data-theme-value="${theme}">${theme[0].toUpperCase()}${theme.slice(1)}</button>`).join("")}`;
      document.body.append(panel);
    }
    applyTheme(read(KEYS.theme, "aurora"));
  }

  function applyTheme(theme) {
    const value = themes.includes(theme) ? theme : "aurora";
    document.body.dataset.dashboardTheme = value;
    write(KEYS.theme, value);
    document.querySelectorAll("[data-theme-value]").forEach((button) => button.classList.toggle("is-active", button.dataset.themeValue === value));
  }

  function cycleTheme() {
    const current = document.body.dataset.dashboardTheme || "aurora";
    applyTheme(themes[(themes.indexOf(current) + 1) % themes.length]);
    toast("Đã đổi giao diện", document.body.dataset.dashboardTheme, "◐");
  }

  async function createTaskFromCommand() {
    const title = await requestText({ title: "Tạo công việc nhanh", message: "Công việc được thêm vào Todo Workspace và lưu trên thiết bị.", placeholder: "Việc cần hoàn thành..." });
    if (!title) return false;
    const items = read(KEYS.todos, []);
    items.unshift({ id: uid("todo"), title, priority: "medium", category: "Command", deadline: new Date().toISOString().slice(0, 10), reminder: "", repeat: "none", completed: false, reminded: false, createdAt: Date.now() });
    write(KEYS.todos, items);
    renderTodos();
    renderCalendar();
    updateHeroProgress();
    updateStats();
    logActivity(`Đã tạo nhanh công việc: ${title}`, "+", "#5ce8f2");
    toast("Đã tạo công việc", title, "+");
    return true;
  }

  async function addNoteFromCommand() {
    const text = await requestText({ title: "Thêm ghi chú nhanh", message: "Ghi chú được đưa vào Sticky Notes trên trang chủ.", placeholder: "Ý tưởng, thông tin cần nhớ..." });
    if (!text) return false;
    const notes = read(NOTES_KEY, []);
    const colors = ["#fff17a", "#75f2d0", "#ff91d9", "#9cb8ff", "#ffb56f", "#c8ff78"];
    notes.push({ id: uid("note"), text, color: colors[notes.length % colors.length], x: 24 + (notes.length * 37) % 420, y: 26 + (notes.length * 31) % 120, rotate: (notes.length % 3 - 1) * .8, pinned: false, tags: "command-center", reminder: "", preview: false, updatedAt: Date.now() });
    write(NOTES_KEY, notes.slice(-30));
    window.dispatchEvent(new CustomEvent("hh:command-center-sync"));
    logActivity(`Đã thêm ghi chú nhanh: ${text.slice(0, 54)}`, "N", "#ff63c8");
    toast("Đã thêm ghi chú", "Mở khu vực Sticky Notes để chỉnh sửa.", "N");
    return true;
  }

  function exportCommandCenterData() {
    const data = Object.fromEntries(Object.entries(KEYS).map(([name, key]) => [name, read(key, null)]));
    const payload = { schema: "hh-command-center-export", version: 3, exportedAt: new Date().toISOString(), data, stickyNotes: read(NOTES_KEY, []) };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `hh-command-center-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
    logActivity("Đã xuất dữ liệu Command Center", "⇩", "#b8ff62");
    toast("Đã xuất dữ liệu", "Tệp JSON đã được tải về máy.", "⇩");
  }

  function wireReveal() {
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(".cc-reveal").forEach((node) => node.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
    }), { rootMargin: "80px", threshold: .06 });
    document.querySelectorAll(".cc-reveal").forEach((node) => observer.observe(node));
    const news = document.querySelector('[data-cc-widget="news"]');
    if (news) {
      const lazy = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) { loadNews(); lazy.disconnect(); }
      }, { rootMargin: "300px" });
      lazy.observe(news);
    }
  }

  function wireMouseLight() {
    const dashboard = document.querySelector(".dashboard-home.dashboard-aurora");
    if (!dashboard || matchMedia("(pointer: coarse)").matches) return;
    let frame = 0;
    dashboard.addEventListener("pointermove", (event) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const rect = dashboard.getBoundingClientRect();
        dashboard.style.setProperty("--mouse-x", `${event.clientX - rect.left}px`);
        dashboard.style.setProperty("--mouse-y", `${event.clientY - rect.top}px`);
        frame = 0;
      });
    }, { passive: true });
  }

  async function handleClick(event) {
    if (event.target.closest("[data-quote-next]")) return renderQuote(true);
    if (event.target.closest("[data-dashboard-theme-cycle]")) return cycleTheme();
    if (event.target.closest("[data-dashboard-theme-menu]")) return document.querySelector(".cc-theme-panel")?.classList.toggle("is-open");
    const theme = event.target.closest("[data-theme-value]");
    if (theme) { applyTheme(theme.dataset.themeValue); theme.closest(".cc-theme-panel")?.classList.remove("is-open"); return; }
    if (event.target.closest("[data-dashboard-fullscreen]")) {
      if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.();
      return;
    }
    if (event.target.closest("[data-dashboard-language]")) return toast("Ngôn ngữ", "Giao diện hiện dùng tiếng Việt. Mở Cài đặt để quản lý i18n.", "VI");
    if (event.target.closest("[data-dashboard-shortcuts]")) return toast("Phím tắt", "Ctrl K: tìm kiếm · Esc: đóng · Enter: mở mục đang chọn.", "⌘");

    const preset = event.target.closest("[data-layout-preset]");
    if (preset) return applyPreset(preset.dataset.layoutPreset);
    if (event.target.closest("[data-layout-show-all]")) {
      const layout = readLayout().map((item) => ({ ...item, hidden: false }));
      return saveCustomLayout(layout, "Đã hiện tất cả widget.");
    }
    if (event.target.closest("[data-layout-reset]")) {
      write(KEYS.preset, "custom");
      applyLayout(defaultLayout(), { persist: true, announce: "Đã khôi phục bố cục mặc định." });
      return toast("Đã đặt lại bố cục", "Tất cả widget trở về vị trí mặc định.", "↺");
    }
    const visibility = event.target.closest("[data-widget-visibility]");
    if (visibility) return updateWidget(visibility.dataset.widgetVisibility, (item) => { item.hidden = !item.hidden; }, `${visibility.getAttribute("aria-pressed") === "true" ? "Đã ẩn" : "Đã hiện"} widget.`);
    const pin = event.target.closest("[data-widget-pin]");
    if (pin) return updateWidget(pin.dataset.widgetPin, (item) => { item.pinned = !item.pinned; }, pin.getAttribute("aria-pressed") === "true" ? "Đã bỏ ghim widget." : "Đã ghim widget lên đầu.");
    const size = event.target.closest("[data-widget-size]");
    if (size) return updateWidget(size.dataset.widgetSize, (item) => { item.size = widgetSizes[(widgetSizes.indexOf(item.size) + 1) % widgetSizes.length]; }, "Đã đổi kích thước widget.");
    const hide = event.target.closest("[data-widget-hide]");
    if (hide) return updateWidget(hide.dataset.widgetHide, (item) => { item.hidden = true; }, "Đã ẩn widget. Có thể hiện lại trong Tùy chỉnh widget.");

    const ai = event.target.closest("[data-ai-action]");
    if (ai) return handleAi(ai.dataset.aiAction);
    const filter = event.target.closest("[data-todo-filter]");
    if (filter) {
      state.todoFilter = filter.dataset.todoFilter;
      document.querySelectorAll("[data-todo-filter]").forEach((button) => button.classList.toggle("is-active", button === filter));
      return renderTodos();
    }
    const todo = event.target.closest("[data-todo-id]");
    if (todo) {
      const items = read(KEYS.todos, []);
      const index = items.findIndex((item) => item.id === todo.dataset.todoId);
      if (index < 0) return;
      if (event.target.closest("[data-todo-toggle]")) { items[index].completed = event.target.checked; write(KEYS.todos, items); logActivity(`${items[index].completed ? "Hoàn thành" : "Mở lại"}: ${items[index].title}`, "✓", "#62e6b0"); renderTodos(); updateStats(); renderCalendar(); return; }
      if (event.target.closest("[data-todo-delete]")) { const [removed] = items.splice(index, 1); write(KEYS.todos, items); logActivity(`Đã xóa công việc: ${removed.title}`, "×", "#ff6688"); renderTodos(); updateStats(); renderCalendar(); return; }
      if (event.target.closest("[data-todo-edit]")) {
        const title = await requestText({ title: "Sửa công việc", message: "Tên mới được lưu ngay trên thiết bị.", value: items[index].title });
        if (title?.trim()) { items[index].title = title.trim(); write(KEYS.todos, items); renderTodos(); }
        return;
      }
    }
    if (event.target.closest("[data-todo-clear-complete]")) { write(KEYS.todos, read(KEYS.todos, []).filter((item) => !item.completed)); renderTodos(); updateStats(); return; }
    if (event.target.closest("[data-calendar-prev]")) { state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() - 1, 1); return renderCalendar(); }
    if (event.target.closest("[data-calendar-next]")) { state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + 1, 1); return renderCalendar(); }
    const calendarDate = event.target.closest("[data-calendar-date]");
    if (calendarDate || event.target.closest("[data-calendar-add]")) {
      const date = calendarDate?.dataset.calendarDate || new Date().toISOString().slice(0, 10);
      const title = await requestText({ title: "Tạo sự kiện", message: `Ngày ${formatDate(`${date}T12:00:00`)}`, placeholder: "Họp, sinh nhật, deadline..." });
      if (title?.trim()) { const items = read(KEYS.events, []); items.push({ id: uid("event"), title: title.trim(), date, type: "Sự kiện", color: "#ff63c8" }); write(KEYS.events, items); logActivity(`Đã thêm sự kiện: ${title.trim()}`, "C", "#ff63c8"); renderCalendar(); }
      return;
    }
    if (event.target.closest("[data-server-refresh]")) return checkServers();
    if (event.target.closest("[data-activity-clear]")) { write(KEYS.activity, []); return renderActivity(); }
    if (event.target.closest("[data-bookmark-add]")) {
      const url = await requestText({ title: "Ghim website", message: "Địa chỉ phải bắt đầu bằng https://", placeholder: "https://example.com", type: "url" });
      if (!url) return;
      try {
        const parsed = new URL(url);
        if (!/^https?:$/.test(parsed.protocol)) throw new Error();
        const title = await requestText({ title: "Tên bookmark", message: parsed.hostname, value: parsed.hostname }) || parsed.hostname;
        const items = read(KEYS.bookmarks, []); items.unshift({ id: uid("bookmark"), title: title.trim(), url: parsed.href, category: "Website", favorite: true }); write(KEYS.bookmarks, items); renderBookmarks(); logActivity(`Đã ghim website: ${title}`, "☆", "#ffc75c");
      } catch { toast("Địa chỉ không hợp lệ", "Hãy nhập URL bắt đầu bằng http:// hoặc https://.", "!"); }
      return;
    }
    const bookmark = event.target.closest("[data-bookmark-id]");
    if (bookmark && event.target.closest("[data-bookmark-delete]")) { write(KEYS.bookmarks, read(KEYS.bookmarks, []).filter((item) => item.id !== bookmark.dataset.bookmarkId)); return renderBookmarks(); }
    const file = event.target.closest("[data-file-id]");
    if (file && event.target.closest("[data-file-favorite]")) { const items = read(KEYS.files, []); const item = items.find((entry) => entry.id === file.dataset.fileId); if (item) item.favorite = !item.favorite; write(KEYS.files, items); return renderFiles(); }
    if (event.target.closest("[data-pomodoro-toggle]")) return togglePomodoro();
    if (event.target.closest("[data-pomodoro-reset]")) { if (state.pomodoroTimer) clearInterval(state.pomodoroTimer); state.pomodoroTimer = null; state.pomodoroSeconds = state.pomodoroMode === "focus" ? 25 * 60 : 5 * 60; document.querySelector("[data-pomodoro-toggle]").textContent = "Bắt đầu"; return renderPomodoro(); }
    if (event.target.closest("[data-pomodoro-mode]")) { state.pomodoroMode = state.pomodoroMode === "focus" ? "break" : "focus"; state.pomodoroSeconds = state.pomodoroMode === "focus" ? 25 * 60 : 5 * 60; event.target.closest("[data-pomodoro-mode]").textContent = state.pomodoroMode === "focus" ? "Focus 25" : "Nghỉ 5"; return renderPomodoro(); }
    if (event.target.closest("[data-news-refresh]")) return loadNews(true);
    if (event.target.closest("[data-music-toggle]")) { byId("musicToggle")?.click(); syncMusic(); return; }
    if (event.target.closest("[data-music-next]")) { byId("musicNext")?.click(); setTimeout(syncMusic, 80); return; }
    if (event.target.closest("[data-music-prev]")) {
      const tracks = [...document.querySelectorAll(".track-button")];
      const active = tracks.findIndex((item) => item.classList.contains("active"));
      tracks[(active - 1 + tracks.length) % tracks.length]?.click();
      setTimeout(syncMusic, 80);
    }
  }

  function handleSubmit(event) {
    const google = event.target.closest("[data-google-search]");
    if (google) {
      event.preventDefault();
      const query = new FormData(google).get("query")?.trim();
      if (!query) return;
      if (window.HHSearchWatch?.open) window.HHSearchWatch.open("google", query);
      else window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank", "noopener");
      logActivity(`Tìm Google: ${query}`, "G", "#5ce8f2");
      return;
    }
    const todo = event.target.closest("[data-todo-form]");
    if (todo) {
      event.preventDefault();
      const data = new FormData(todo);
      const title = String(data.get("title") || "").trim();
      if (!title) return;
      const items = read(KEYS.todos, []);
      items.unshift({ id: uid("todo"), title, priority: data.get("priority"), category: String(data.get("category") || "Chung").trim() || "Chung", deadline: data.get("deadline"), reminder: data.get("reminder"), repeat: data.get("repeat") || "none", completed: false, reminded: false, createdAt: Date.now() });
      write(KEYS.todos, items); todo.reset(); renderTodos(); renderCalendar(); updateStats(); logActivity(`Đã thêm công việc: ${title}`, "＋", "#5ce8f2");
    }
  }

  function handleChange(event) {
    if (event.target.matches("[data-file-pick]")) {
      const items = read(KEYS.files, []);
      [...event.target.files].forEach((file) => items.unshift({ id: uid("file"), name: file.name, extension: file.name.split(".").pop() || "file", size: file.size, modified: file.lastModified || Date.now(), favorite: false }));
      write(KEYS.files, items.slice(0, 30)); renderFiles(); logActivity(`Đã chọn ${event.target.files.length} tệp gần đây`, "F", "#ffc75c"); event.target.value = "";
    }
    if (event.target.id === "ccMusicVolume") {
      const source = byId("musicVolume");
      if (source) { source.value = event.target.value; source.dispatchEvent(new Event("input", { bubbles: true })); }
    }
  }

  function syncMusic() {
    if (byId("ccMusicStatus")) byId("ccMusicStatus").textContent = byId("musicStatus")?.textContent || "Điều khiển nhạc nền HH";
    const active = document.querySelector(".track-button.active strong")?.textContent;
    if (active && byId("ccMusicTitle")) byId("ccMusicTitle").textContent = active;
    const volume = byId("musicVolume");
    if (volume && byId("ccMusicVolume")) byId("ccMusicVolume").value = volume.value;
  }

  function wireDragging() {
    let dragged = null;
    root()?.addEventListener("dragstart", (event) => { const item = event.target.closest("[data-todo-id]"); if (item) { dragged = item.dataset.todoId; event.dataTransfer.effectAllowed = "move"; } });
    root()?.addEventListener("dragover", (event) => { if (dragged && event.target.closest("[data-todo-id]")) event.preventDefault(); });
    root()?.addEventListener("drop", (event) => {
      const target = event.target.closest("[data-todo-id]");
      if (!dragged || !target || dragged === target.dataset.todoId) return;
      event.preventDefault();
      const items = read(KEYS.todos, []);
      const from = items.findIndex((item) => item.id === dragged);
      const to = items.findIndex((item) => item.id === target.dataset.todoId);
      const [moved] = items.splice(from, 1); items.splice(to, 0, moved); write(KEYS.todos, items); dragged = null; renderTodos();
    });
  }

  function wireWidgetLayout() {
    const host = root();
    if (!host) return;
    host.addEventListener("dragstart", (event) => {
      const handle = event.target.closest("[data-widget-drag]");
      if (!handle) return;
      state.layoutDragId = handle.dataset.widgetDrag;
      handle.setAttribute("aria-grabbed", "true");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", state.layoutDragId);
      handle.closest("[data-cc-widget]")?.classList.add("is-widget-dragging");
    });
    host.addEventListener("dragover", (event) => {
      const target = event.target.closest("[data-cc-widget]");
      if (!state.layoutDragId || !target || target.dataset.ccWidget === state.layoutDragId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      host.querySelectorAll(".is-widget-drop-target").forEach((node) => node.classList.remove("is-widget-drop-target"));
      target.classList.add("is-widget-drop-target");
    });
    host.addEventListener("drop", (event) => {
      const target = event.target.closest("[data-cc-widget]");
      if (!state.layoutDragId || !target) return;
      event.preventDefault();
      reorderWidgets(state.layoutDragId, target.dataset.ccWidget);
      state.layoutDragId = "";
      host.querySelectorAll("[data-widget-drag]").forEach((handle) => handle.setAttribute("aria-grabbed", "false"));
      host.querySelectorAll(".is-widget-dragging,.is-widget-drop-target").forEach((node) => node.classList.remove("is-widget-dragging", "is-widget-drop-target"));
    });
    host.addEventListener("dragend", () => {
      state.layoutDragId = "";
      host.querySelectorAll("[data-widget-drag]").forEach((handle) => handle.setAttribute("aria-grabbed", "false"));
      host.querySelectorAll(".is-widget-dragging,.is-widget-drop-target").forEach((node) => node.classList.remove("is-widget-dragging", "is-widget-drop-target"));
    });
    host.addEventListener("keydown", (event) => {
      const handle = event.target.closest("[data-widget-drag]");
      if (!handle || !["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === "Home" ? -999 : event.key === "End" ? 999 : ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1;
      moveWidget(handle.dataset.widgetDrag, direction);
    });
  }

  function enhanceCommandPalette() {
    window.HHCommandCenter = {
      searchItems: () => [
        ["Tạo công việc", "Thêm task nhanh vào Todo Workspace", "cc:create-task"],
        ["Thêm ghi chú", "Tạo Sticky Note mới trên trang chủ", "cc:add-note"],
        ["Đổi giao diện", "Chuyển sang theme Command Center tiếp theo", "cc:cycle-theme"],
        ["Xuất dữ liệu", "Tải task, lịch, bookmark, layout và ghi chú", "cc:export"],
        ["Mở Project Center", "Đi đến không gian quản lý dự án", "route:/work/project-center"],
        ["Todo", "Thêm và quản lý công việc", "todo"], ["Lịch", "Xem lịch và deadline", "calendar"],
        ["Server Status", "Kiểm tra dịch vụ", "server"], ["Pomodoro", "Bắt đầu phiên tập trung", "pomodoro"],
        ["Bookmarks", "Mở website đã ghim", "bookmarks"], ["Recent Files", "Xem tệp gần đây", "files"],
        ["Quick Launch", "Mở ứng dụng nhanh", "launch"], ["Tin công nghệ", "Đọc feed mới", "news"]
      ].map(([title, description, target]) => ({ type: "Command Center", title, description, key: `${title} ${description}`, action: target.includes(":") ? target : `focus:${target}` })),
      async runAction(action) {
        if (action === "cc:create-task") return createTaskFromCommand();
        if (action === "cc:add-note") return addNoteFromCommand();
        if (action === "cc:cycle-theme") return cycleTheme();
        if (action === "cc:export") return exportCommandCenterData();
        if (action.startsWith("route:")) { location.hash = `#${action.slice(6)}`; return; }
        if (action.startsWith("focus:")) {
          location.hash = "#/home";
          setTimeout(() => {
            const id = action.slice(6);
            const item = readLayout().find((entry) => entry.id === id);
            if (item?.hidden) updateWidget(id, (widget) => { widget.hidden = false; }, `Đã hiện ${item.label}.`);
            document.querySelector(`[data-cc-widget="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 120);
        }
      }
    };
  }

  function init() {
    if (state.initialized || !root()) return;
    state.initialized = true;
    ensureDefaults();
    root().innerHTML = markup();
    installWidgetControls();
    applyLayout(readLayout(), { persist: true });
    mountHero();
    installThemeUi();
    wireReveal();
    wireMouseLight();
    wireDragging();
    wireWidgetLayout();
    enhanceCommandPalette();
    document.addEventListener("click", handleClick);
    document.addEventListener("submit", handleSubmit);
    document.addEventListener("change", handleChange);
    window.addEventListener("hh:toast", (event) => toast(event.detail?.title || "HH Platform", event.detail?.message || "Đã cập nhật.", event.detail?.icon || "✦"));
    byId("ccTodoSearch")?.addEventListener("input", debounce(renderTodos));
    renderTodos(); renderCalendar(); renderActivity(); renderProjects(); renderBookmarks(); renderFiles(); renderPomodoro();
    checkServers(); updateStats(); syncMusic(); loadGithubStats(); loadBattery(); watchHeroWeather();
    setInterval(updateStats, 2600);
    setInterval(syncMusic, 3000);
    checkReminders();
    setInterval(checkReminders, 30000);
    setInterval(checkServers, 5 * 60 * 1000);
    window.addEventListener("online", updateStats);
    window.addEventListener("offline", updateStats);
    if (!read(KEYS.activity, []).length) logActivity("Command Center Pro đã sẵn sàng", "✦", "#5ce8f2");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  window.addEventListener("hh:auth-change", () => {
    if (!state.initialized) return init();
    document.querySelector(".cc-hero-profile")?.remove();
    mountHero();
  });
  window.addEventListener("hh:command-center-sync", () => {
    if (!state.initialized) return;
    renderTodos();
    renderCalendar();
    renderActivity();
    updateStats();
  });
  window.addEventListener("hashchange", () => {
    if (!location.hash.includes("/home")) return;
    requestAnimationFrame(() => {
      renderTodos();
      renderCalendar();
      renderActivity();
      updateStats();
    });
  });
})();
