(function (global, factory) {
  "use strict";

  const api = factory(global || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (global && global.document) global.HHHomeWidgetProjectPulse = api;
})(typeof window !== "undefined" ? window : globalThis, function (global) {
  "use strict";

  const VERSION = 2;
  const STORAGE_PREFIX = "hh.command-center.widget-project-pulse.v2";
  const PROJECT_KEY = "hh-project-center";
  const AUTH_KEY = "hh-auth-user";
  const ROOT_SELECTOR = "#commandCenterProRoot";
  const GRID_SELECTOR = ".cc-grid";
  const SIZES = Object.freeze(["small", "medium", "large"]);
  const VIEW_IDS = Object.freeze(["personal", "work", "creative", "learning"]);
  const PROJECT_VIEWS = Object.freeze(["list", "board", "calendar", "timeline"]);
  const WIDGET_CATALOG = Object.freeze([
    ["project-pulse", "Project Pulse", "large"],
    ["todo", "Việc hôm nay", "large"],
    ["calendar", "Lịch và deadline", "medium"],
    ["projects", "Dự án gần đây", "small"],
    ["activity", "Hoạt động gần đây", "small"],
    ["files", "Tệp gần đây", "small"],
    ["ai", "AI Assistant", "medium"],
    ["google", "Google Hub", "medium"],
    ["launch", "Quick Launch", "medium"],
    ["bookmarks", "Bookmarks", "medium"],
    ["pomodoro", "Pomodoro", "small"],
    ["music", "Music Focus", "small"],
    ["server", "System Health", "small"],
    ["news", "Technology Feed", "large"]
  ]);
  const LAYOUT_DEFINITIONS = Object.freeze({
    personal: {
      label: "Cá nhân",
      icon: "HH",
      visible: WIDGET_CATALOG.map(([id]) => id),
      sizes: { "project-pulse": "large", todo: "medium", calendar: "medium" }
    },
    work: {
      label: "Công việc",
      icon: "CV",
      visible: ["project-pulse", "todo", "calendar", "projects", "activity", "files", "server"],
      sizes: { "project-pulse": "large", todo: "large", calendar: "medium", projects: "medium" }
    },
    creative: {
      label: "Sáng tạo",
      icon: "ST",
      visible: ["project-pulse", "ai", "music", "google", "launch", "bookmarks", "files", "news"],
      sizes: { "project-pulse": "large", ai: "medium", music: "medium", news: "large" }
    },
    learning: {
      label: "Học tập",
      icon: "HT",
      visible: ["project-pulse", "google", "ai", "pomodoro", "bookmarks", "calendar", "news"],
      sizes: { "project-pulse": "large", google: "medium", ai: "medium", news: "large" }
    }
  });

  const runtime = {
    mounted: false,
    root: null,
    grid: null,
    store: null,
    storage: null,
    storageKey: "",
    projectView: "list",
    dragId: "",
    captureTimer: 0,
    observer: null,
    lastProjectSignature: ""
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const safeText = (value, fallback = "") => String(value == null ? fallback : value).trim();
  const safeId = (value, fallback = "item") => safeText(value, fallback).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || fallback;
  const escapeHtml = (value) => String(value == null ? "" : value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const isoDay = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  };
  const todayIso = () => isoDay(new Date());
  const unique = (values) => [...new Set(values.filter(Boolean))];

  function readJson(storage, key, fallback) {
    try {
      const value = JSON.parse(storage.getItem(key) || "null");
      return value == null ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function writeJson(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function userScope(storage) {
    const user = readJson(storage, AUTH_KEY, {});
    const identity = user.id || user._id || user.email || user.username || user.nickname || "guest";
    return safeId(identity, "guest");
  }

  function storageKeyForUser(storage) {
    return `${STORAGE_PREFIX}:${userScope(storage)}`;
  }

  function defaultWidgetItems() {
    return WIDGET_CATALOG.map(([id, label, size], order) => ({
      id,
      label,
      size,
      order,
      mobilePriority: order,
      pinned: id === "project-pulse",
      hidden: false
    }));
  }

  function viewFromDefinition(id, definition) {
    const visible = new Map(definition.visible.map((widgetId, index) => [widgetId, index]));
    return {
      id,
      label: definition.label,
      icon: definition.icon,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      widgets: defaultWidgetItems().map((item) => ({
        ...item,
        size: definition.sizes[item.id] || item.size,
        order: visible.has(item.id) ? visible.get(item.id) : definition.visible.length + item.order,
        mobilePriority: visible.has(item.id) ? visible.get(item.id) : definition.visible.length + item.mobilePriority,
        hidden: !visible.has(item.id),
        pinned: item.id === "project-pulse"
      })).sort((a, b) => a.order - b.order).map((item, order) => ({ ...item, order }))
    };
  }

  function createDefaultStore() {
    const views = {};
    VIEW_IDS.forEach((id) => { views[id] = viewFromDefinition(id, LAYOUT_DEFINITIONS[id]); });
    return {
      schema: "hh-widget-project-pulse",
      version: VERSION,
      activeView: "personal",
      views,
      updatedAt: new Date().toISOString()
    };
  }

  function normalizeWidget(raw, fallback, index) {
    const item = raw && typeof raw === "object" ? raw : {};
    const has = (key) => Object.prototype.hasOwnProperty.call(item, key);
    return {
      id: fallback.id,
      label: safeText(item.label, fallback.label).slice(0, 80),
      size: SIZES.includes(item.size) ? item.size : fallback.size,
      order: has("order") && Number.isFinite(Number(item.order)) ? Number(item.order) : (Number.isFinite(Number(fallback.order)) ? Number(fallback.order) : index),
      mobilePriority: has("mobilePriority") && Number.isFinite(Number(item.mobilePriority)) ? Number(item.mobilePriority) : (Number.isFinite(Number(fallback.mobilePriority)) ? Number(fallback.mobilePriority) : index),
      pinned: has("pinned") ? Boolean(item.pinned) : Boolean(fallback.pinned),
      hidden: has("hidden") ? Boolean(item.hidden) : Boolean(fallback.hidden)
    };
  }

  function normalizeView(raw, fallback, id) {
    const source = raw && typeof raw === "object" ? raw : {};
    const incoming = new Map((Array.isArray(source.widgets) ? source.widgets : []).filter((item) => item && typeof item.id === "string").map((item) => [safeId(item.id), item]));
    const base = fallback || viewFromDefinition(id, LAYOUT_DEFINITIONS.personal);
    const catalog = defaultWidgetItems();
    const widgets = catalog.map((item, index) => normalizeWidget(incoming.get(item.id), base.widgets.find((entry) => entry.id === item.id) || item, index))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.order - b.order)
      .map((item, order) => ({ ...item, order }));
    return {
      id,
      label: safeText(source.label, base.label || "Bố cục").slice(0, 48),
      icon: safeText(source.icon, base.icon || "HH").slice(0, 4),
      createdAt: safeText(source.createdAt, base.createdAt || new Date().toISOString()),
      updatedAt: safeText(source.updatedAt, new Date().toISOString()),
      widgets
    };
  }

  function normalizeStore(raw) {
    const defaults = createDefaultStore();
    const source = raw && typeof raw === "object" ? raw : {};
    const views = {};
    VIEW_IDS.forEach((id) => { views[id] = normalizeView(source.views && source.views[id], defaults.views[id], id); });
    if (source.views && typeof source.views === "object") {
      Object.entries(source.views).forEach(([rawId, view]) => {
        const id = safeId(rawId);
        if (!id || views[id] || Object.keys(views).length >= 16) return;
        views[id] = normalizeView(view, defaults.views.personal, id);
      });
    }
    const activeView = views[safeId(source.activeView)] ? safeId(source.activeView) : "personal";
    return {
      schema: defaults.schema,
      version: VERSION,
      activeView,
      views,
      updatedAt: safeText(source.updatedAt, defaults.updatedAt)
    };
  }

  function cloneView(store, sourceId, label) {
    const normalized = normalizeStore(store);
    const source = normalized.views[sourceId] || normalized.views[normalized.activeView];
    const baseId = safeId(label, "view");
    let id = baseId;
    let suffix = 2;
    while (normalized.views[id]) id = `${baseId}-${suffix++}`;
    normalized.views[id] = {
      ...clone(source),
      id,
      label: safeText(label, `Bố cục ${suffix - 1}`).slice(0, 48),
      icon: "BV",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    normalized.activeView = id;
    normalized.updatedAt = new Date().toISOString();
    return normalized;
  }

  function exportStore(store, scope = "guest") {
    return JSON.stringify({
      schema: "hh-widget-project-pulse-export",
      version: VERSION,
      exportedAt: new Date().toISOString(),
      userScope: safeId(scope, "guest"),
      data: normalizeStore(store)
    }, null, 2);
  }

  function importStore(input) {
    const payload = typeof input === "string" ? JSON.parse(input) : input;
    if (!payload || typeof payload !== "object") throw new Error("Tệp bố cục không hợp lệ.");
    const data = payload.schema === "hh-widget-project-pulse-export" ? payload.data : payload;
    if (!data || typeof data !== "object" || (data.version != null && Number(data.version) > VERSION)) throw new Error("Phiên bản bố cục chưa được hỗ trợ.");
    return normalizeStore(data);
  }

  function normalizeList(value) {
    if (Array.isArray(value)) return unique(value.map((item) => safeText(typeof item === "object" ? item.title || item.name || item.id : item)).filter(Boolean));
    return safeText(value) ? safeText(value).split(/[,;\n]/).map((item) => item.trim()).filter(Boolean) : [];
  }

  function deriveProjectHealth(project, tasks, now = new Date()) {
    const progress = clamp(project.progress, 0, 100);
    const due = isoDay(project.due || project.deadline);
    const today = isoDay(now);
    const daysLeft = due ? Math.ceil((new Date(`${due}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86400000) : null;
    const projectBlockers = normalizeList(project.blockers);
    const taskBlockers = tasks.filter((task) => task.blockedBy || task.blocked || task.status === "blocked").map((task) => safeText(task.title, "Nhiệm vụ bị chặn"));
    const blockers = unique([...projectBlockers, ...taskBlockers]);
    const dependencies = unique([
      ...normalizeList(project.dependencies),
      ...tasks.map((task) => safeText(task.blockedBy)).filter(Boolean)
    ]);
    let tone = "steady";
    let label = "Ổn định";
    if (progress >= 100 || /hoàn|done|complete/i.test(safeText(project.status))) {
      tone = "complete";
      label = "Hoàn tất";
    } else if ((daysLeft != null && daysLeft < 0) || blockers.length >= 3) {
      tone = "critical";
      label = "Cần xử lý";
    } else if (blockers.length || (daysLeft != null && daysLeft <= 3 && progress < 80)) {
      tone = "risk";
      label = "Có rủi ro";
    } else if (progress >= 70) {
      tone = "healthy";
      label = "Tiến triển tốt";
    }
    return { tone, label, progress, due, daysLeft, blockers, dependencies };
  }

  function normalizeProjectState(raw, now = new Date()) {
    const source = raw && typeof raw === "object" ? raw : {};
    const projects = Array.isArray(source.projects) ? source.projects : [];
    const tasks = Array.isArray(source.tasks) ? source.tasks : [];
    const globalMilestones = Array.isArray(source.milestones) ? source.milestones : [];
    return projects.slice(0, 50).map((project, index) => {
      const id = safeId(project.id, `project-${index + 1}`);
      const projectTasks = tasks.filter((task) => safeId(task.project || task.projectId || "") === id);
      const milestones = [...(Array.isArray(project.milestones) ? project.milestones : []), ...globalMilestones.filter((milestone) => !milestone.project || safeId(milestone.project) === id)]
        .map((milestone) => ({ title: safeText(milestone.title || milestone.name, "Cột mốc"), date: isoDay(milestone.date || milestone.due), progress: clamp(milestone.progress, 0, 100) }))
        .filter((milestone) => milestone.date || milestone.title)
        .sort((a, b) => String(a.date || "9999").localeCompare(String(b.date || "9999")));
      const assignees = unique([safeText(project.assignee || project.owner), ...projectTasks.map((task) => safeText(task.assignee))]);
      const health = deriveProjectHealth(project, projectTasks, now);
      const nextMilestone = milestones.find((milestone) => !milestone.date || milestone.date >= isoDay(now)) || milestones[milestones.length - 1] || null;
      return {
        id,
        name: safeText(project.name || project.title, `Dự án ${index + 1}`).slice(0, 140),
        description: safeText(project.description).slice(0, 280),
        status: safeText(project.status, "Đang thực hiện"),
        priority: safeText(project.priority, "Trung bình"),
        color: /^#[0-9a-f]{3,8}$/i.test(safeText(project.color)) ? project.color : "#62d7e7",
        assignee: assignees.join(", ") || "Chưa phân công",
        tasks: projectTasks,
        nextMilestone,
        ...health
      };
    });
  }

  function projectFallback() {
    return {
      projects: [
        { id: "portfolio", name: "HH Neon Platform", status: "Đang phát triển", progress: 82, priority: "Cao", due: "2026-08-01", description: "Website cá nhân, AI Center, Media Center và cộng đồng.", color: "#f05caf", localSample: true },
        { id: "script-ai", name: "Kịch bản AI", status: "Đang thử nghiệm", progress: 68, priority: "Cao", due: "2026-08-15", description: "Công cụ viết và quản lý kịch bản đa nền tảng.", color: "#62d7e7", localSample: true },
        { id: "voice", name: "HH Voice Studio", status: "Bản ổn định", progress: 94, priority: "Trung bình", due: "2026-07-30", description: "Text/SRT, chia part, voice trình duyệt và humanize.", color: "#b9dc68", localSample: true }
      ],
      tasks: [
        { id: "t1", title: "Hoàn thiện Project Center", column: "doing", priority: "Cao", project: "portfolio" },
        { id: "t2", title: "Kiểm tra giao diện mobile", column: "todo", priority: "Cao", project: "portfolio" },
        { id: "t3", title: "Nâng cấp AI Center", column: "done", priority: "Cao", project: "portfolio" },
        { id: "t4", title: "Viết changelog", column: "review", priority: "Trung bình", project: "portfolio" }
      ],
      milestones: [],
      localFallback: true
    };
  }

  function readProjectState(storage) {
    const fallback = projectFallback();
    const saved = readJson(storage, PROJECT_KEY, null);
    if (!saved || !Array.isArray(saved.projects) || !saved.projects.length) {
      return {
        ...fallback,
        ...(saved && typeof saved === "object" ? saved : {}),
        projects: fallback.projects,
        tasks: Array.isArray(saved?.tasks) && saved.tasks.length ? saved.tasks : fallback.tasks,
        localFallback: true
      };
    }
    return saved;
  }

  function formatDate(value) {
    if (!value) return "Chưa đặt";
    try { return new Date(`${value}T12:00:00`).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return value; }
  }

  function projectStatusText(project) {
    if (project.daysLeft == null) return "Chưa có deadline";
    if (project.daysLeft < 0) return `Trễ ${Math.abs(project.daysLeft)} ngày`;
    if (project.daysLeft === 0) return "Đến hạn hôm nay";
    return `Còn ${project.daysLeft} ngày`;
  }

  function pulseEmptyMarkup() {
    return `<div class="hhp-empty"><span aria-hidden="true">PJ</span><strong>Chưa có dự án cục bộ</strong><p>Tạo dự án trong Project Center để theo dõi sức khỏe, deadline và blocker tại đây.</p><button type="button" data-hhp-open-center>Mở Project Center</button></div>`;
  }

  function projectCardMarkup(project, compact = false) {
    return `<article class="hhp-project-card is-${project.healthTone || project.tone}" data-hhp-project-card="${escapeHtml(project.id)}" style="--hhp-project:${escapeHtml(project.color)}">
      <header><span class="hhp-health"><i></i>${escapeHtml(project.label)}</span><span class="hhp-priority">${escapeHtml(project.priority)}</span></header>
      <button class="hhp-project-title" type="button" data-hhp-open-project="${escapeHtml(project.id)}"><strong>${escapeHtml(project.name)}</strong><small>${escapeHtml(project.status)}</small></button>
      <div class="hhp-progress" aria-label="Tiến độ ${project.progress}%"><i style="width:${project.progress}%"></i></div>
      <div class="hhp-project-meta"><span><b>${project.progress}%</b> tiến độ</span><span><b>${escapeHtml(projectStatusText(project))}</b></span>${compact ? "" : `<span><b>${escapeHtml(project.assignee)}</b> phụ trách</span>`}</div>
      ${compact ? "" : `<div class="hhp-signal-row"><span class="${project.blockers.length ? "has-risk" : ""}">${project.blockers.length} blocker</span><span>${project.dependencies.length} phụ thuộc</span><span>${project.nextMilestone ? escapeHtml(project.nextMilestone.title) : "Chưa có milestone"}</span></div>`}
    </article>`;
  }

  function pulseViewMarkup(projects, view) {
    if (!projects.length) return pulseEmptyMarkup();
    if (view === "board") {
      const columns = [["critical", "Cần xử lý"], ["risk", "Có rủi ro"], ["steady", "Ổn định"], ["healthy", "Tiến triển tốt"], ["complete", "Hoàn tất"]];
      return `<div class="hhp-board">${columns.map(([tone, label]) => {
        const items = projects.filter((project) => project.tone === tone);
        return `<section><header><strong>${label}</strong><b>${items.length}</b></header>${items.map((project) => projectCardMarkup(project, true)).join("") || `<p>Không có dự án</p>`}</section>`;
      }).join("")}</div>`;
    }
    if (view === "calendar") {
      const dated = [...projects].sort((a, b) => String(a.due || "9999").localeCompare(String(b.due || "9999")));
      return `<div class="hhp-calendar">${dated.map((project) => `<button type="button" data-hhp-open-project="${escapeHtml(project.id)}" style="--hhp-project:${escapeHtml(project.color)}"><time datetime="${escapeHtml(project.due)}"><b>${project.due ? new Date(`${project.due}T12:00:00`).getDate() : "--"}</b><span>${project.due ? new Date(`${project.due}T12:00:00`).toLocaleDateString("vi-VN", { month: "short" }) : "Chưa hẹn"}</span></time><span><strong>${escapeHtml(project.name)}</strong><small>${escapeHtml(projectStatusText(project))} · ${project.progress}%</small></span><i class="is-${project.tone}"></i></button>`).join("")}</div>`;
    }
    if (view === "timeline") {
      return `<div class="hhp-timeline"><div class="hhp-timeline-scale"><span>Bắt đầu</span><span>Tiến độ</span><span>Deadline</span></div>${projects.map((project) => `<button type="button" data-hhp-open-project="${escapeHtml(project.id)}"><span><strong>${escapeHtml(project.name)}</strong><small>${escapeHtml(project.assignee)}</small></span><i><b style="width:${project.progress}%;--hhp-project:${escapeHtml(project.color)}"></b><em style="left:${project.progress}%">${project.progress}%</em></i><time>${escapeHtml(formatDate(project.due))}</time></button>`).join("")}</div>`;
    }
    return `<div class="hhp-list">${projects.map((project) => projectCardMarkup(project)).join("")}</div>`;
  }

  function pulseMarkup() {
    return `<section class="cc-section cc-span-12 hhp-pulse" data-cc-widget="project-pulse" data-widget-size="large" aria-labelledby="hhpPulseTitle">
      <header class="hhp-pulse-header"><div><small>PROJECT PULSE · LOCAL</small><h3 id="hhpPulseTitle">Sức khỏe dự án</h3><p>Deadline, blocker, dependency và cột mốc từ Project Center.</p></div><div class="hhp-pulse-actions"><button type="button" data-hhp-refresh title="Đọc lại dữ liệu Project Center">Làm mới</button><button type="button" data-hhp-open-center>Mở Project Center</button></div></header>
      <div class="hhp-summary" data-hhp-summary></div>
      <div class="hhp-viewbar" role="toolbar" aria-label="Chế độ xem Project Pulse">${PROJECT_VIEWS.map((view) => `<button type="button" data-hhp-view="${view}" aria-pressed="${view === runtime.projectView}">${({ list: "Danh sách", board: "Board", calendar: "Lịch", timeline: "Timeline" })[view]}</button>`).join("")}</div>
      <div class="hhp-view" data-hhp-view-content></div>
    </section>`;
  }

  function renderPulse() {
    if (!runtime.grid) return;
    let pulse = runtime.grid.querySelector('[data-cc-widget="project-pulse"]');
    if (!pulse) {
      runtime.grid.insertAdjacentHTML("afterbegin", pulseMarkup());
      pulse = runtime.grid.querySelector('[data-cc-widget="project-pulse"]');
    }
    const state = readProjectState(runtime.storage);
    const projects = normalizeProjectState(state);
    const summary = pulse.querySelector("[data-hhp-summary]");
    const risk = projects.filter((project) => ["risk", "critical"].includes(project.tone)).length;
    const blocked = projects.reduce((sum, project) => sum + project.blockers.length, 0);
    const average = projects.length ? Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / projects.length) : 0;
    if (summary) summary.innerHTML = `<article><span>Dự án</span><strong>${projects.length}</strong><small>dữ liệu trên thiết bị</small></article><article><span>Cần chú ý</span><strong>${risk}</strong><small>dựa trên deadline và blocker</small></article><article><span>Blocker</span><strong>${blocked}</strong><small>đang được khai báo</small></article><article><span>Tiến độ TB</span><strong>${average}%</strong><small>không phải dữ liệu realtime</small></article>`;
    const content = pulse.querySelector("[data-hhp-view-content]");
    if (content) content.innerHTML = pulseViewMarkup(projects, runtime.projectView);
    pulse.querySelectorAll("[data-hhp-view]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.hhpView === runtime.projectView)));
    runtime.lastProjectSignature = JSON.stringify(state);
  }

  function currentView() {
    return runtime.store.views[runtime.store.activeView] || runtime.store.views.personal;
  }

  function saveStore(message = "") {
    runtime.store.updatedAt = new Date().toISOString();
    const saved = writeJson(runtime.storage, runtime.storageKey, runtime.store);
    const status = runtime.root && runtime.root.querySelector("[data-hhw-status]");
    if (status) status.textContent = saved ? message || "Bố cục đã lưu trên thiết bị." : "Trình duyệt không cho phép lưu bố cục.";
    if (saved && global.dispatchEvent && global.CustomEvent) global.dispatchEvent(new CustomEvent("hh:widget-layout-v2-change", { detail: { activeView: runtime.store.activeView, userScope: userScope(runtime.storage) } }));
    return saved;
  }

  function inventoryFromDom() {
    if (!runtime.grid) return [];
    return [...runtime.grid.querySelectorAll(":scope > [data-cc-widget]")].map((node, order) => {
      const id = safeId(node.dataset.ccWidget, `widget-${order}`);
      const catalog = WIDGET_CATALOG.find((entry) => entry[0] === id);
      return {
        id,
        label: catalog ? catalog[1] : safeText(node.getAttribute("aria-label") || node.querySelector("h3")?.textContent, id).replace(/\s+widget$/i, ""),
        size: SIZES.includes(node.dataset.widgetSize) ? node.dataset.widgetSize : (catalog ? catalog[2] : "medium"),
        order,
        mobilePriority: order,
        pinned: node.classList.contains("is-pinned"),
        hidden: node.hidden
      };
    });
  }

  function mergeInventory(view) {
    const incoming = new Map(view.widgets.map((item) => [item.id, item]));
    inventoryFromDom().forEach((item) => {
      if (!incoming.has(item.id)) view.widgets.push(item);
    });
    view.widgets = view.widgets.filter((item) => runtime.grid.querySelector(`[data-cc-widget="${global.CSS && CSS.escape ? CSS.escape(item.id) : item.id}"]`));
    return view;
  }

  function applyCurrentView(options = {}) {
    if (!runtime.grid) return;
    const view = mergeInventory(currentView());
    [...view.widgets].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.order - b.order).forEach((item) => {
      const selectorId = global.CSS && CSS.escape ? CSS.escape(item.id) : item.id;
      const node = runtime.grid.querySelector(`[data-cc-widget="${selectorId}"]`);
      if (!node) return;
      node.hidden = item.hidden;
      node.setAttribute("aria-hidden", String(item.hidden));
      node.dataset.widgetSize = item.size;
      node.dataset.mobilePriority = String(item.mobilePriority);
      node.style.setProperty("--hhw-mobile-order", String(item.mobilePriority));
      node.classList.toggle("is-pinned", item.pinned);
      runtime.grid.append(node);
      const pin = node.querySelector("[data-widget-pin]");
      const size = node.querySelector("[data-widget-size]");
      if (pin) pin.setAttribute("aria-pressed", String(item.pinned));
      if (size) size.dataset.currentSize = item.size;
    });
    renderEngineUi();
    if (options.persist) saveStore(options.message || `Đã áp dụng bố cục ${view.label}.`);
  }

  function captureDomAsView(message = "Đã lưu thay đổi widget.") {
    if (!runtime.grid || !runtime.store) return;
    const view = currentView();
    const previous = new Map(view.widgets.map((item) => [item.id, item]));
    view.widgets = inventoryFromDom().map((item) => ({ ...item, mobilePriority: previous.get(item.id)?.mobilePriority ?? item.order }));
    view.updatedAt = new Date().toISOString();
    saveStore(message);
    renderEngineUi();
  }

  function scheduleCapture(message) {
    clearTimeout(runtime.captureTimer);
    runtime.captureTimer = setTimeout(() => captureDomAsView(message), 40);
  }

  function engineMarkup() {
    return `<section class="hhw-engine" data-hhw-engine aria-labelledby="hhwEngineTitle">
      <div class="hhw-engine-main"><div class="hhw-engine-title"><span>WIDGET ENGINE V2</span><strong id="hhwEngineTitle">Không gian theo cách của bạn</strong><small>Layout được lưu riêng cho tài khoản trên thiết bị này.</small></div><nav class="hhw-views" data-hhw-views aria-label="Chọn bố cục dashboard"></nav><div class="hhw-engine-actions"><button type="button" data-hhw-manage aria-expanded="false">Quản lý</button><button type="button" data-hhw-export>Xuất</button><label class="hhw-import">Nhập<input type="file" accept="application/json,.json" data-hhw-import hidden></label><button type="button" data-hhw-restore>Khôi phục</button></div></div>
      <div class="hhw-manager" data-hhw-manager hidden><header><div><strong>Thư viện widget</strong><small>Di chuyển bằng nút hoặc kéo thả; mobile ưu tiên theo thứ tự riêng.</small></div><form data-hhw-clone-form><input name="label" maxlength="48" placeholder="Tên bố cục mới" aria-label="Tên bố cục mới"><button type="submit">Nhân bản view</button></form></header><div class="hhw-manager-grid" data-hhw-manager-grid></div></div>
      <p class="hhw-status" data-hhw-status role="status" aria-live="polite">Bố cục cục bộ đã sẵn sàng.</p>
    </section>`;
  }

  function renderEngineUi() {
    if (!runtime.root || !runtime.store) return;
    const views = runtime.root.querySelector("[data-hhw-views]");
    if (views) views.innerHTML = Object.values(runtime.store.views).map((view) => `<button type="button" data-hhw-view-id="${escapeHtml(view.id)}" aria-pressed="${view.id === runtime.store.activeView}"><i>${escapeHtml(view.icon)}</i><span>${escapeHtml(view.label)}</span></button>`).join("");
    const manager = runtime.root.querySelector("[data-hhw-manager-grid]");
    if (!manager) return;
    const view = currentView();
    manager.innerHTML = [...view.widgets].sort((a, b) => a.order - b.order).map((item, index) => `<article data-hhw-widget-row="${escapeHtml(item.id)}"><span><strong>${escapeHtml(item.label)}</strong><small>${item.hidden ? "Đang ẩn" : `${item.pinned ? "Đã ghim · " : ""}${item.size}`} · mobile ${item.mobilePriority + 1}</small></span><div role="toolbar" aria-label="Quản lý ${escapeHtml(item.label)}"><button type="button" data-hhw-widget-action="toggle" data-widget-id="${escapeHtml(item.id)}" aria-pressed="${!item.hidden}">${item.hidden ? "Hiện" : "Ẩn"}</button><button type="button" data-hhw-widget-action="pin" data-widget-id="${escapeHtml(item.id)}" aria-pressed="${item.pinned}">${item.pinned ? "Bỏ ghim" : "Ghim"}</button><button type="button" data-hhw-widget-action="size" data-widget-id="${escapeHtml(item.id)}">Cỡ ${item.size[0].toUpperCase()}</button><button type="button" data-hhw-widget-action="up" data-widget-id="${escapeHtml(item.id)}" ${index === 0 ? "disabled" : ""} aria-label="Đưa ${escapeHtml(item.label)} lên">↑</button><button type="button" data-hhw-widget-action="down" data-widget-id="${escapeHtml(item.id)}" ${index === view.widgets.length - 1 ? "disabled" : ""} aria-label="Đưa ${escapeHtml(item.label)} xuống">↓</button><button type="button" data-hhw-widget-action="mobile" data-widget-id="${escapeHtml(item.id)}" aria-label="Tăng ưu tiên mobile cho ${escapeHtml(item.label)}">M↑</button></div></article>`).join("");
  }

  function updateWidget(id, action) {
    const view = currentView();
    const sorted = [...view.widgets].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((item) => item.id === id);
    if (index < 0) return;
    const item = sorted[index];
    if (action === "toggle") item.hidden = !item.hidden;
    if (action === "pin") item.pinned = !item.pinned;
    if (action === "size") item.size = SIZES[(SIZES.indexOf(item.size) + 1) % SIZES.length];
    if (action === "mobile") item.mobilePriority = Math.max(0, item.mobilePriority - 1);
    if (action === "up" || action === "down") {
      const target = clamp(index + (action === "up" ? -1 : 1), 0, sorted.length - 1);
      if (target !== index) [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
    }
    sorted.forEach((entry, order) => { entry.order = order; });
    view.widgets = sorted;
    view.updatedAt = new Date().toISOString();
    applyCurrentView({ persist: true, message: `Đã cập nhật ${item.label}.` });
  }

  function switchView(id) {
    if (!runtime.store.views[id]) return;
    runtime.store.activeView = id;
    applyCurrentView({ persist: true, message: `Đã chuyển sang ${runtime.store.views[id].label}.` });
  }

  function restoreDefaults() {
    const active = VIEW_IDS.includes(runtime.store.activeView) ? runtime.store.activeView : "personal";
    runtime.store = createDefaultStore();
    runtime.store.activeView = active;
    applyCurrentView({ persist: true, message: "Đã khôi phục bốn bố cục mặc định." });
  }

  function downloadLayout() {
    const payload = exportStore(runtime.store, userScope(runtime.storage));
    const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `hh-dashboard-layout-${todayIso()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    const status = runtime.root.querySelector("[data-hhw-status]");
    if (status) status.textContent = "Đã xuất bố cục thành tệp JSON.";
  }

  async function importLayout(file) {
    if (!file) return;
    try {
      runtime.store = importStore(await file.text());
      applyCurrentView({ persist: true, message: "Đã nhập và kiểm tra bố cục." });
    } catch (error) {
      const status = runtime.root.querySelector("[data-hhw-status]");
      if (status) status.textContent = error.message || "Không thể nhập bố cục.";
    }
  }

  function openProjectCenter(projectId, view = "overview") {
    const state = readProjectState(runtime.storage);
    if (projectId) state.activeProject = projectId;
    state.projectView = PROJECT_VIEWS.includes(view) ? view : "overview";
    writeJson(runtime.storage, PROJECT_KEY, state);
    if (global.location) global.location.hash = "#/work/project-center";
    if (global.dispatchEvent && global.CustomEvent) global.dispatchEvent(new CustomEvent("hh:project-center-sync", { detail: { projectId, view: state.projectView } }));
  }

  function onClick(event) {
    const viewButton = event.target.closest("[data-hhw-view-id]");
    if (viewButton) return switchView(viewButton.dataset.hhwViewId);
    const manage = event.target.closest("[data-hhw-manage]");
    if (manage) {
      const panel = runtime.root.querySelector("[data-hhw-manager]");
      panel.hidden = !panel.hidden;
      manage.setAttribute("aria-expanded", String(!panel.hidden));
      if (!panel.hidden) panel.querySelector("button, input")?.focus();
      return;
    }
    if (event.target.closest("[data-hhw-export]")) return downloadLayout();
    if (event.target.closest("[data-hhw-restore]")) return restoreDefaults();
    const action = event.target.closest("[data-hhw-widget-action]");
    if (action) return updateWidget(action.dataset.widgetId, action.dataset.hhwWidgetAction);
    const projectView = event.target.closest("[data-hhp-view]");
    if (projectView) {
      runtime.projectView = PROJECT_VIEWS.includes(projectView.dataset.hhpView) ? projectView.dataset.hhpView : "list";
      renderPulse();
      return;
    }
    if (event.target.closest("[data-hhp-refresh]")) return renderPulse();
    if (event.target.closest("[data-hhp-open-center]")) return openProjectCenter("", "overview");
    const project = event.target.closest("[data-hhp-open-project]");
    if (project) return openProjectCenter(project.dataset.hhpOpenProject, runtime.projectView);
    if (event.target.closest("[data-widget-pin],[data-widget-size],[data-widget-hide],[data-widget-visibility],[data-layout-preset],[data-layout-reset],[data-layout-show-all]")) scheduleCapture("Đã đồng bộ thay đổi từ Command Center.");
  }

  function onSubmit(event) {
    const form = event.target.closest("[data-hhw-clone-form]");
    if (!form) return;
    event.preventDefault();
    const label = safeText(new FormData(form).get("label"));
    if (!label) {
      form.querySelector("input")?.focus();
      return;
    }
    runtime.store = cloneView(runtime.store, runtime.store.activeView, label);
    form.reset();
    applyCurrentView({ persist: true, message: `Đã tạo view ${label}; widget DOM không bị nhân bản.` });
  }

  function wireDragPersistence() {
    runtime.grid.addEventListener("dragstart", (event) => {
      const handle = event.target.closest("[data-widget-drag]");
      runtime.dragId = handle ? handle.dataset.widgetDrag : "";
    });
    runtime.grid.addEventListener("drop", () => scheduleCapture("Đã lưu thứ tự kéo thả."));
    runtime.grid.addEventListener("dragend", () => scheduleCapture("Đã lưu thứ tự widget."));
    runtime.grid.addEventListener("keydown", (event) => {
      const handle = event.target.closest("[data-widget-drag]");
      if (handle && ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "Home", "End"].includes(event.key)) scheduleCapture("Đã lưu thứ tự từ bàn phím.");
    });
  }

  function watchProjectStore() {
    global.addEventListener("storage", (event) => {
      if (event.key === PROJECT_KEY) renderPulse();
      if (event.key === AUTH_KEY) remountForUser();
    });
    global.addEventListener("hh:project-center-sync", renderPulse);
    global.addEventListener("hh:command-center-sync", () => {
      const next = JSON.stringify(readProjectState(runtime.storage));
      if (next !== runtime.lastProjectSignature) renderPulse();
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        const next = JSON.stringify(readProjectState(runtime.storage));
        if (next !== runtime.lastProjectSignature) renderPulse();
      }
    });
  }

  function remountForUser() {
    runtime.storageKey = storageKeyForUser(runtime.storage);
    const saved = readJson(runtime.storage, runtime.storageKey, null);
    runtime.store = normalizeStore(saved);
    if (!saved) runtime.store.views.personal.widgets = inventoryFromDom();
    applyCurrentView();
  }

  function mount(rootElement, options = {}) {
    if (runtime.mounted || !rootElement) return false;
    const grid = rootElement.querySelector(GRID_SELECTOR);
    if (!grid) return false;
    runtime.mounted = true;
    runtime.root = rootElement;
    runtime.grid = grid;
    runtime.storage = options.storage || global.localStorage;
    runtime.storageKey = storageKeyForUser(runtime.storage);
    const saved = readJson(runtime.storage, runtime.storageKey, null);
    runtime.store = normalizeStore(saved);
    const existingToolbar = rootElement.querySelector(".cc-layout-toolbar");
    if (!rootElement.querySelector("[data-hhw-engine]")) {
      if (existingToolbar) existingToolbar.insertAdjacentHTML("afterend", engineMarkup());
      else grid.insertAdjacentHTML("beforebegin", engineMarkup());
    }
    renderPulse();
    if (!saved) runtime.store.views.personal.widgets = inventoryFromDom();
    applyCurrentView();
    rootElement.addEventListener("click", onClick);
    rootElement.addEventListener("submit", onSubmit);
    rootElement.querySelector("[data-hhw-import]")?.addEventListener("change", (event) => {
      importLayout(event.target.files && event.target.files[0]);
      event.target.value = "";
    });
    wireDragPersistence();
    watchProjectStore();
    saveStore("Bố cục V2 đã sẵn sàng trên thiết bị này.");
    return true;
  }

  function init(options = {}) {
    if (!global.document) return false;
    const start = () => {
      const root = document.querySelector(options.rootSelector || ROOT_SELECTOR);
      if (mount(root, options)) return;
      runtime.observer = new MutationObserver(() => {
        const delayedRoot = document.querySelector(options.rootSelector || ROOT_SELECTOR);
        if (mount(delayedRoot, options)) runtime.observer.disconnect();
      });
      runtime.observer.observe(document.documentElement, { childList: true, subtree: true });
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
    return true;
  }

  const api = Object.freeze({
    VERSION,
    STORAGE_PREFIX,
    PROJECT_KEY,
    VIEW_IDS,
    PROJECT_VIEWS,
    WIDGET_CATALOG,
    LAYOUT_DEFINITIONS,
    createDefaultStore,
    normalizeStore,
    normalizeView,
    cloneView,
    exportStore,
    importStore,
    normalizeProjectState,
    deriveProjectHealth,
    userScope,
    storageKeyForUser,
    mount,
    init
  });

  if (global.document && !global.__HH_WIDGET_PROJECT_PULSE_NO_AUTO_INIT__) init();
  return api;
});
