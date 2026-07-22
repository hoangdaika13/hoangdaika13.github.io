(() => {
  "use strict";

  const PROJECT_KEY = "hh-project-center";
  const WIKI_KEY = "hh-knowledge-center";
  const EXTENSION_KEY = "hh-extension-suite-v1";
  const DOWNLOAD_KEY = "hh-download-history";
  const STORE_CART_KEY = "hh-store-cart";
  const WORK_KEY = "hh-work-center-v2";
  const LEGACY_WORK_KEY = "hh-work-center-v1";
  const WORK_SCHEMA_VERSION = 2;
  const FILE_META_KEY = "hh-work-center-files-v1";
  const DB_NAME = "hh-work-center";
  const DB_STORE = "files";
  const MAX_FILE_SIZE = 100 * 1024 * 1024;

  const DEFAULT_PROJECTS = [
    { id: "portfolio", name: "HH Neon Platform", status: "Đang phát triển", progress: 82, priority: "Cao", due: "2026-08-01", description: "Website cá nhân, AI Center, Media Center và cộng đồng.", color: "#ff5dc8" },
    { id: "script-ai", name: "Kịch bản AI", status: "Đang thử nghiệm", progress: 68, priority: "Cao", due: "2026-08-15", description: "Công cụ viết và quản lý kịch bản đa nền tảng.", color: "#62e9f2" },
    { id: "voice", name: "HH Voice Studio", status: "Bản ổn định", progress: 94, priority: "Trung bình", due: "2026-07-30", description: "Text/SRT, chia part, voice trình duyệt và humanize.", color: "#f5db6d" }
  ];
  const DEFAULT_TASKS = [
    { id: "task-home", title: "Hoàn thiện trải nghiệm trang chủ", column: "doing", priority: "Cao", project: "portfolio", due: new Date().toISOString().slice(0, 10) },
    { id: "task-community", title: "Kiểm tra Community trên mobile", column: "review", priority: "Trung bình", project: "portfolio", due: new Date(Date.now() + 86400000).toISOString().slice(0, 10) },
    { id: "task-release", title: "Chuẩn bị ghi chú phát hành", column: "todo", priority: "Thấp", project: "script-ai", due: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) }
  ];
  const DEFAULT_ARTICLES = [
    { id: "deploy", title: "Deploy GitHub Pages và Vercel", category: "Hướng dẫn", tags: ["github", "vercel"], bookmark: true, updated: new Date().toISOString().slice(0, 10), content: "# Deploy website HH\n\nGhi chú triển khai và kiểm tra website." },
    { id: "ai-prompts", title: "Cấu trúc prompt AI hiệu quả", category: "AI", tags: ["prompt", "ai"], bookmark: false, updated: new Date().toISOString().slice(0, 10), content: "# Prompt AI hiệu quả\n\nVai trò, mục tiêu, ngữ cảnh và đầu ra." }
  ];

  const WORKSPACES = [
    { id: "project-center", icon: "P", label: "Lập kế hoạch", title: "Project Center", description: "Kanban, roadmap, issue, deadline và changelog.", route: "/work/project-center", accent: "cyan", features: ["Kanban", "Roadmap", "Bugs"] },
    { id: "cloud-storage", icon: "C", label: "Tệp & thư mục", title: "Cloud Storage", description: "Upload, preview, chia sẻ và kho tệp cá nhân.", route: "/work/cloud-storage", accent: "blue", features: ["Upload", "Folders", "Share"] },
    { id: "download-center", icon: "D", label: "Tài nguyên", title: "Download Center", description: "Phân tích liên kết, hàng đợi và lịch sử tải.", route: "/work/download-center", accent: "yellow", features: ["Analyze", "Queue", "History"] },
    { id: "knowledge-center", icon: "K", label: "Tài liệu", title: "Knowledge Center", description: "Wiki Markdown, tags, bookmark và tìm kiếm.", route: "/work/knowledge-center", accent: "pink", features: ["Markdown", "Search", "Export"] },
    { id: "store", icon: "S", label: "Sản phẩm số", title: "Store", description: "Thư viện sản phẩm, giỏ hàng và đơn đặt hàng.", route: "/work/store", accent: "orange", features: ["Products", "Cart", "Orders"] },
    { id: "wishlist-compare", icon: "W", label: "Ra quyết định", title: "Wishlist & Compare", description: "Lưu lựa chọn và so sánh tối đa ba sản phẩm.", route: "/work/wishlist-compare", accent: "violet", features: ["Wishlist", "Compare", "Saved"] },
    { id: "team-collaboration", icon: "T", label: "Làm việc nhóm", title: "Team Collaboration", description: "Phân công, trạng thái, bình luận và đồng bộ nhóm.", route: "/work/team-collaboration", accent: "green", features: ["Board", "Members", "Comments"] },
    { id: "form-builder", icon: "F", label: "Thu thập dữ liệu", title: "Form Builder", description: "Tạo biểu mẫu, xem trước và xuất phản hồi CSV.", route: "/work/form-builder", accent: "rose", features: ["Fields", "Preview", "CSV"] },
    { id: "workflow-automation", icon: "A", label: "Tự động hóa", title: "Workflow Automation", description: "Trigger, điều kiện, hành động và lịch sử chạy.", route: "/work/workflow-automation", accent: "lime", features: ["Trigger", "Rules", "Runs"] }
  ];

  let host = null;
  let clockTimer = 0;
  let focusTimer = 0;
  let fileDragDepth = 0;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || "") || fallback; } catch { return fallback; }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const day = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  const formatDate = (value, options = { day: "2-digit", month: "short" }) => {
    const date = value ? new Date(`${value}T12:00:00`) : null;
    return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat("vi-VN", options).format(date) : "Chưa đặt";
  };
  const formatBytes = (bytes = 0) => {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
  };
  const projectState = () => {
    const state = read(PROJECT_KEY, {});
    if (!Array.isArray(state.projects) || !state.projects.length) state.projects = structuredClone(DEFAULT_PROJECTS);
    if (!Array.isArray(state.tasks) || !state.tasks.length) state.tasks = structuredClone(DEFAULT_TASKS);
    state.activity = Array.isArray(state.activity) ? state.activity : [];
    return state;
  };
  const wikiState = () => {
    const state = read(WIKI_KEY, {});
    if (!Array.isArray(state.articles) || !state.articles.length) state.articles = structuredClone(DEFAULT_ARTICLES);
    return state;
  };
  const extensionState = () => read(EXTENSION_KEY, {});
  const planningDefaults = () => ({
    schemaVersion: WORK_SCHEMA_VERSION,
    revision: 0,
    adapter: { mode: "local", status: "Local-first · chưa kết nối adapter", lastSyncAt: "" },
    projects: [], tasks: [], milestones: [],
    cycles: [{ id: "cycle-current", name: "Cycle hiện tại", start: day(), end: day(14), goal: "Ưu tiên việc quan trọng", status: "planned" }],
    capacities: {}, meetings: [], actionItems: [], calendar: [],
    focusMinutes: 25, focusRemaining: 1500, focusRunning: false, focusEnd: 0, focusSessions: 0, taskFilter: "open"
  });
  const normalizePlanning = (raw = {}) => {
    const projects = Array.isArray(raw.projects) && raw.projects.length ? raw.projects : structuredClone(DEFAULT_PROJECTS);
    const tasks = Array.isArray(raw.tasks) && raw.tasks.length ? raw.tasks : structuredClone(DEFAULT_TASKS);
    return { ...planningDefaults(), ...raw, projects: projects.map((item) => ({ ...item, capacity: Number(item.capacity || 40) })), tasks: tasks.map((item) => ({ ...item, projectId: item.projectId || item.project || projects[0]?.id, status: item.status || item.column || "todo", column: item.column || item.status || "todo", estimate: Number(item.estimate || 1), dependsOn: Array.isArray(item.dependsOn) ? item.dependsOn : [], due: item.due || "" })), milestones: Array.isArray(raw.milestones) ? raw.milestones : [], capacities: raw.capacities && typeof raw.capacities === "object" ? raw.capacities : {}, meetings: Array.isArray(raw.meetings) ? raw.meetings : [], actionItems: Array.isArray(raw.actionItems) ? raw.actionItems : [], calendar: Array.isArray(raw.calendar) ? raw.calendar : [] };
  };
  const planningState = () => {
    const stored = read(WORK_KEY, null) || read(LEGACY_WORK_KEY, {});
    const state = normalizePlanning(stored);
    const legacy = projectState();
    // Keep quick-capture/project-center changes visible without overwriting
    // planning-only fields such as cycle, estimate or dependency metadata.
    const projects = [...state.projects, ...(legacy.projects || []).filter((item) => !state.projects.some((current) => current.id === item.id))];
    const tasks = [...state.tasks, ...(legacy.tasks || []).filter((item) => !state.tasks.some((current) => current.id === item.id))];
    return normalizePlanning({ ...state, projects, tasks });
  };
  const writePlanning = (next) => {
    const state = normalizePlanning(typeof next === "function" ? next(planningState()) : next);
    const result = { ...state, schemaVersion: WORK_SCHEMA_VERSION, revision: Number(state.revision || 0) + 1, updatedAt: new Date().toISOString() };
    localStorage.setItem(WORK_KEY, JSON.stringify(result));
    const legacy = projectState();
    legacy.projects = result.projects;
    legacy.tasks = result.tasks.map((task) => ({ ...task, project: task.projectId, column: task.column || task.status }));
    write(PROJECT_KEY, legacy);
    return result;
  };
  const workState = () => ({ ...planningDefaults(), ...planningState() });
  const planningDaysUntil = (value, today = new Date()) => { if (!value) return null; const date = new Date(`${String(value).slice(0, 10)}T12:00:00`); if (Number.isNaN(date.getTime())) return null; const base = new Date(today.getFullYear(), today.getMonth(), today.getDate()); return Math.ceil((date - base) / 86400000); };
  const detectPlanningRisks = (state, today = new Date()) => {
    const risks = [];
    (state.tasks || []).forEach((task) => {
      const days = planningDaysUntil(task.due, today);
      if (task.status !== "done" && days !== null && days < 0) risks.push({ level: "high", title: task.title, reason: `Trễ ${Math.abs(days)} ngày`, type: "deadline" });
      if (task.status !== "done" && days !== null && days >= 0 && days <= 2) risks.push({ level: "medium", title: task.title, reason: `Còn ${days} ngày`, type: "deadline" });
      const blocked = (task.dependsOn || []).some((id) => (state.tasks || []).find((item) => item.id === id)?.status !== "done");
      if (blocked && task.status !== "done") risks.push({ level: "high", title: task.title, reason: "Đang chờ dependency", type: "dependency" });
    });
    (state.milestones || []).forEach((item) => { const days = planningDaysUntil(item.due, today); if (item.status !== "done" && days !== null && days < 0) risks.push({ level: "high", title: item.name, reason: "Milestone đã quá hạn", type: "milestone" }); });
    (state.actionItems || []).forEach((item) => { const days = planningDaysUntil(item.due, today); if (item.status !== "done" && days !== null && days < 0) risks.push({ level: "medium", title: item.title, reason: "Action item quá hạn", type: "meeting" }); });
    const workload = {};
    (state.tasks || []).filter((task) => task.status !== "done").forEach((task) => { const person = task.assignee || "Chưa phân công"; workload[person] = (workload[person] || 0) + Number(task.estimate || 1); });
    Object.entries(workload).forEach(([person, hours]) => { const capacity = Number(state.capacities?.[person] || state.projects?.[0]?.capacity || 40); if (hours > capacity) risks.push({ level: "high", title: person, reason: `${hours}h vượt capacity ${capacity}h`, type: "capacity" }); });
    return risks;
  };
  const planningTimeline = (state) => [...(state.tasks || []).filter((item) => item.due).map((item) => ({ date: item.due, type: "Task", title: item.title, detail: item.assignee || "Chưa phân công" })), ...(state.milestones || []).filter((item) => item.due).map((item) => ({ date: item.due, type: "Milestone", title: item.name, detail: `${item.progress || 0}%` })), ...(state.meetings || []).filter((item) => item.date).map((item) => ({ date: item.date, type: "Meeting", title: item.title, detail: item.attendees || "" }))].sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 20);

  const workspaceMetric = (id) => {
    const projects = projectState();
    const wiki = wikiState();
    const ext = extensionState();
    const map = {
      "project-center": [projects.projects.length, "dự án"],
      "cloud-storage": [read(FILE_META_KEY, []).length, "tệp thiết bị"],
      "download-center": [read(DOWNLOAD_KEY, []).length, "lượt gần đây"],
      "knowledge-center": [wiki.articles.length, "bài viết"],
      store: [read(STORE_CART_KEY, []).length, "trong giỏ"],
      "wishlist-compare": [(ext["wishlist-compare"]?.wishlist || []).length, "đã lưu"],
      "team-collaboration": [(ext["team-collaboration"]?.tasks || []).length, "việc nhóm"],
      "form-builder": [(ext["form-builder"]?.responses || []).length, "phản hồi"],
      "workflow-automation": [(ext["workflow-automation"]?.workflows || []).length, "workflow"]
    };
    return map[id] || [0, "mục"];
  };

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 11) return "Chào buổi sáng";
    if (hour < 18) return "Chào buổi chiều";
    return "Chào buổi tối";
  }

  function userName() {
    const user = read("hh-auth-user", {});
    return user.name || user.displayName || "bạn";
  }

  function getStats() {
    const projects = projectState();
    const tasks = projects.tasks || [];
    const open = tasks.filter((task) => task.column !== "done");
    const done = tasks.filter((task) => task.column === "done");
    const overdue = open.filter((task) => task.due && task.due < day()).length;
    const average = projects.projects.length ? Math.round(projects.projects.reduce((sum, item) => sum + Number(item.progress || 0), 0) / projects.projects.length) : 0;
    return { projects: projects.projects.length, open: open.length, done: done.length, overdue, average };
  }

  function workspaceCards() {
    return WORKSPACES.map((item) => {
      const [value, label] = workspaceMetric(item.id);
      return `<article class="work-space-card work-accent--${item.accent}" data-workspace-card data-search-text="${esc(`${item.title} ${item.description} ${item.features.join(" ")}`.toLowerCase())}">
        <header><span>${item.icon}</span><div><small>${esc(item.label)}</small><h3>${esc(item.title)}</h3></div><button type="button" data-work-route="${item.route}" aria-label="Mở ${esc(item.title)}">↗</button></header>
        <p>${esc(item.description)}</p>
        <div class="work-space-card__features">${item.features.map((feature) => `<span>${feature}</span>`).join("")}</div>
        <footer><strong>${value}</strong><span>${label}</span><button type="button" data-work-route="${item.route}">Mở workspace</button></footer>
      </article>`;
    }).join("");
  }

  function taskRows() {
    const state = projectState();
    const filter = workState().taskFilter;
    const tasks = [...state.tasks].filter((task) => {
      if (filter === "done") return task.column === "done";
      if (filter === "today") return task.due === day();
      if (filter === "overdue") return task.column !== "done" && task.due && task.due < day();
      return task.column !== "done";
    }).sort((a, b) => String(a.due || "9999").localeCompare(String(b.due || "9999"))).slice(0, 8);
    if (!tasks.length) return `<div class="work-empty"><span>✓</span><strong>Không có việc trong bộ lọc này</strong><p>Tạo việc mới bằng Quick Capture.</p></div>`;
    return tasks.map((task) => {
      const project = state.projects.find((item) => item.id === task.project);
      const overdue = task.column !== "done" && task.due && task.due < day();
      return `<article class="work-task ${task.column === "done" ? "is-done" : ""}" data-work-task="${esc(task.id)}">
        <button type="button" data-work-task-toggle="${esc(task.id)}" aria-label="${task.column === "done" ? "Mở lại" : "Hoàn thành"} công việc">${task.column === "done" ? "✓" : ""}</button>
        <div><strong>${esc(task.title)}</strong><span><i data-priority="${esc(task.priority || "Trung bình")}"></i>${esc(project?.name || "Không thuộc dự án")}</span></div>
        <time class="${overdue ? "is-overdue" : ""}" datetime="${esc(task.due || "")}">${overdue ? "Quá hạn · " : ""}${formatDate(task.due)}</time>
        <button type="button" data-work-task-delete="${esc(task.id)}" aria-label="Xóa công việc">×</button>
      </article>`;
    }).join("");
  }

  function projectRows() {
    const state = projectState();
    return state.projects.slice(0, 5).map((project) => {
      const remaining = Math.ceil((new Date(`${project.due}T23:59:59`) - Date.now()) / 86400000);
      const status = remaining < 0 ? "Trễ hạn" : remaining <= 7 ? `${remaining} ngày` : project.status;
      return `<button class="work-project-row" type="button" data-work-route="/work/project-center" style="--project:${esc(project.color || "#62e9f2")}">
        <i></i><div><strong>${esc(project.name)}</strong><span>${esc(project.priority)} · ${esc(status)}</span></div><div class="work-progress"><span><i style="width:${Math.max(0, Math.min(100, project.progress || 0))}%"></i></span><b>${Number(project.progress || 0)}%</b></div>
      </button>`;
    }).join("");
  }

  function knowledgeRows() {
    const articles = [...wikiState().articles].sort((a, b) => String(b.updated).localeCompare(String(a.updated))).slice(0, 4);
    return articles.map((article) => `<button class="work-knowledge-row" type="button" data-work-route="/work/knowledge-center"><span>${article.bookmark ? "★" : "K"}</span><div><strong>${esc(article.title)}</strong><small>${esc(article.category || "Ghi chú")} · ${formatDate(article.updated)}</small></div><b>›</b></button>`).join("");
  }

  function activityRows() {
    const projects = projectState();
    const ext = extensionState();
    const rows = [
      ...(projects.activity || []).map((text, index) => ({ text, type: "project", time: Date.now() - index * 1800000 })),
      ...(ext["team-collaboration"]?.activity || []).map((item, index) => ({ text: item.text || item.title || String(item), type: "team", time: new Date(item.createdAt || Date.now() - index * 2400000).getTime() })),
      ...(ext["workflow-automation"]?.runs || []).map((item) => ({ text: `${item.name}: ${item.message}`, type: item.ok ? "automation" : "warning", time: new Date(item.createdAt).getTime() }))
    ].sort((a, b) => b.time - a.time).slice(0, 7);
    if (!rows.length) rows.push({ text: "Work Center đã sẵn sàng cho phiên làm việc mới.", type: "system", time: Date.now() });
    return rows.map((item) => `<article><i data-kind="${item.type}"></i><div><strong>${esc(item.text)}</strong><span>${new Intl.RelativeTimeFormat("vi", { numeric: "auto" }).format(Math.min(0, Math.round((item.time - Date.now()) / 60000)), "minute")}</span></div></article>`).join("");
  }

  function deadlineRows() {
    const state = projectState();
    const items = [
      ...state.tasks.filter((task) => task.column !== "done" && task.due).map((task) => ({ title: task.title, due: task.due, type: "Việc" })),
      ...state.projects.filter((project) => project.due && project.progress < 100).map((project) => ({ title: project.name, due: project.due, type: "Dự án" }))
    ].sort((a, b) => a.due.localeCompare(b.due)).slice(0, 5);
    return items.map((item) => `<button type="button" data-work-route="/work/project-center"><time datetime="${esc(item.due)}"><b>${new Date(`${item.due}T12:00:00`).getDate()}</b><span>Th${new Date(`${item.due}T12:00:00`).getMonth() + 1}</span></time><div><small>${item.type}</small><strong>${esc(item.title)}</strong></div><span>${item.due < day() ? "Trễ" : item.due === day() ? "Hôm nay" : formatDate(item.due)}</span></button>`).join("") || `<div class="work-empty compact"><strong>Không có deadline</strong></div>`;
  }

  function focusMarkup() {
    const state = workState();
    const total = Math.max(60, Number(state.focusMinutes || 25) * 60);
    const remaining = state.focusRunning && state.focusEnd ? Math.max(0, Math.ceil((state.focusEnd - Date.now()) / 1000)) : Math.min(total, Number(state.focusRemaining || total));
    const progress = Math.round((1 - remaining / total) * 100);
    return `<section class="work-focus" data-work-focus style="--focus-progress:${progress * 3.6}deg">
      <div class="work-focus__dial"><span><strong data-focus-time>${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}</strong><small>FOCUS</small></span></div>
      <div><span>Không gian tập trung</span><h3>Một việc. Một nhịp.</h3><p><b>${state.focusSessions || 0}</b> phiên hoàn tất hôm nay</p><div><button type="button" data-focus-toggle>${state.focusRunning ? "Tạm dừng" : "Bắt đầu"}</button><button type="button" data-focus-reset>Đặt lại</button><select data-focus-minutes aria-label="Thời lượng tập trung"><option value="15" ${state.focusMinutes === 15 ? "selected" : ""}>15 phút</option><option value="25" ${state.focusMinutes === 25 ? "selected" : ""}>25 phút</option><option value="45" ${state.focusMinutes === 45 ? "selected" : ""}>45 phút</option><option value="60" ${state.focusMinutes === 60 ? "selected" : ""}>60 phút</option></select></div></div>
    </section>`;
  }

  function captureDialog() {
    const projects = projectState().projects;
    return `<dialog class="work-dialog" data-work-dialog aria-labelledby="workDialogTitle">
      <form method="dialog"><button type="submit" aria-label="Đóng">×</button></form>
      <div><header><span>QUICK CAPTURE</span><h2 id="workDialogTitle">Ghi lại và bắt đầu ngay</h2><p>Tạo đầu việc, dự án hoặc ghi chú mà không rời dashboard.</p></header>
        <label>Loại nội dung<select data-capture-type><option value="task">Công việc</option><option value="project">Dự án</option><option value="note">Ghi chú Wiki</option></select></label>
        <label>Tiêu đề<input data-capture-title maxlength="140" placeholder="Bạn muốn hoàn thành điều gì?"></label>
        <label>Mô tả<textarea data-capture-details rows="4" placeholder="Thêm bối cảnh, checklist hoặc nội dung..."></textarea></label>
        <div class="work-dialog__grid"><label data-capture-project-wrap>Dự án<select data-capture-project>${projects.map((project) => `<option value="${esc(project.id)}">${esc(project.name)}</option>`).join("")}</select></label><label data-capture-priority-wrap>Ưu tiên<select data-capture-priority><option>Cao</option><option selected>Trung bình</option><option>Thấp</option></select></label><label data-capture-due-wrap>Deadline<input type="date" data-capture-due value="${day(1)}"></label><label data-capture-category-wrap hidden>Danh mục<input data-capture-category value="Ghi chú"></label></div>
        <footer><span data-capture-status>Sẵn sàng lưu trên thiết bị.</span><button type="button" data-capture-save>Tạo nội dung</button></footer>
      </div>
    </dialog>`;
  }

  function planningMarkup() {
    const state = planningState();
    const risks = detectPlanningRisks(state);
    const projects = state.projects || [];
    const tasks = state.tasks || [];
    const activeCycle = (state.cycles || []).find((cycle) => cycle.status !== "done") || state.cycles?.[0];
    const responseItems = extensionState()["form-builder"]?.responses || [];
    const projectOptions = projects.map((project) => `<option value="${esc(project.id)}">${esc(project.name)}</option>`).join("");
    const dependencyOptions = tasks.filter((task) => task.status !== "done").map((task) => `<option value="${esc(task.id)}">${esc(task.title)}</option>`).join("");
    const capacityRows = Object.entries(tasks.filter((task) => task.status !== "done").reduce((acc, task) => { const person = task.assignee || "Chưa phân công"; acc[person] = (acc[person] || 0) + Number(task.estimate || 1); return acc; }, {})).map(([person, hours]) => { const capacity = Number(state.capacities?.[person] || projects[0]?.capacity || 40); const ratio = Math.round(hours / capacity * 100); return `<article><div><strong>${esc(person)}</strong><span>${hours}h / ${capacity}h</span></div><i style="--capacity:${Math.min(150, ratio)}%"><b></b></i><small>${ratio > 100 ? "Quá tải" : ratio > 80 ? "Gần đầy" : "Còn chỗ"}</small></article>`; }).join("");
    const timeline = planningTimeline(state);
    return `<section class="work-planning" data-work-planning aria-label="Lập kế hoạch công việc"><header class="work-planning__head"><div><span>PLANNING LAYER · schema ${WORK_SCHEMA_VERSION}</span><h2>Project → cycle → task</h2><p>Lưu local-first, revision ${state.revision || 0}. ${esc(state.adapter?.status || "Adapter chưa cấu hình")}</p></div><div><button type="button" data-planning-export>Xuất JSON</button><button type="button" data-planning-sync>Kiểm tra adapter</button></div></header><nav class="work-planning__tabs" role="tablist" aria-label="Planning views"><button class="is-active" type="button" role="tab" aria-selected="true" data-planning-tab="plan">Plan</button><button type="button" role="tab" aria-selected="false" data-planning-tab="capacity">Capacity & dependency</button><button type="button" role="tab" aria-selected="false" data-planning-tab="timeline">Lịch & timeline</button><button type="button" role="tab" aria-selected="false" data-planning-tab="meeting">Meeting → actions</button><button type="button" role="tab" aria-selected="false" data-planning-tab="risk">Risk detector <b>${risks.length}</b></button></nav><section class="work-planning__pane is-active" data-planning-pane="plan"><div class="work-planning__grid"><form class="work-planning__card" data-planning-project-form><header><span>PROJECT</span><h3>Tạo project</h3></header><label>Tên project<input name="name" required maxlength="120" autocomplete="off" placeholder="Ví dụ: Website v3"></label><div class="work-planning__two"><label>Owner<input name="owner" maxlength="80" placeholder="Tên người phụ trách"></label><label>Capacity (giờ)<input name="capacity" type="number" min="1" max="1000" value="40"></label></div><div class="work-planning__two"><label>Bắt đầu<input name="start" type="date" value="${day()}"></label><label>Deadline<input name="due" type="date"></label></div><button type="submit">＋ Tạo project</button></form><form class="work-planning__card" data-planning-task-form><header><span>TASK</span><h3>Thêm task</h3></header><label>Tên task<input name="title" required maxlength="180" autocomplete="off" placeholder="Một việc có thể giao"></label><div class="work-planning__two"><label>Project<select name="projectId">${projectOptions}</select></label><label>Người phụ trách<input name="assignee" maxlength="80" placeholder="Tên hoặc email"></label></div><div class="work-planning__two"><label>Estimate (giờ)<input name="estimate" type="number" min="0.25" max="500" step="0.25" value="1"></label><label>Deadline<input name="due" type="date"></label></div><label>Dependency (tuỳ chọn)<select name="dependsOn" multiple size="3">${dependencyOptions || "<option disabled>Chưa có task để phụ thuộc</option>"}</select></label><button type="submit">＋ Tạo task</button></form><form class="work-planning__card" data-planning-cycle-form><header><span>CYCLE</span><h3>Chu kỳ làm việc</h3></header><label>Tên cycle<input name="name" required maxlength="100" value="${esc(activeCycle?.name || "Cycle mới")}"></label><div class="work-planning__two"><label>Bắt đầu<input name="start" type="date" value="${esc(activeCycle?.start || day())}"></label><label>Kết thúc<input name="end" type="date" value="${esc(activeCycle?.end || day(14))}"></label></div><label>Mục tiêu<input name="goal" maxlength="180" value="${esc(activeCycle?.goal || "")}"></label><button type="submit">＋ Tạo cycle</button></form></div><div class="work-planning__summary"><article><strong>${projects.length}</strong><span>Projects</span></article><article><strong>${tasks.filter((task) => task.status !== "done").length}</strong><span>Task đang mở</span></article><article><strong>${(state.milestones || []).length}</strong><span>Milestone</span></article><article><strong>${activeCycle ? esc(activeCycle.name) : "—"}</strong><span>Cycle hiện tại</span></article></div></section><section class="work-planning__pane" data-planning-pane="capacity"><div class="work-planning__grid"><article class="work-planning__card"><header><span>CAPACITY</span><h3>Workload theo người</h3></header><div class="work-capacity-list">${capacityRows || "<p>Chưa có task đang mở.</p>"}</div><button type="button" data-planning-capacity>Đặt capacity mặc định</button></article><article class="work-planning__card"><header><span>DEPENDENCY</span><h3>Luồng phụ thuộc</h3></header><div class="work-dependency-list">${tasks.filter((task) => task.dependsOn?.length).map((task) => `<article><strong>${esc(task.title)}</strong><span>${task.dependsOn.map((id) => esc(tasks.find((item) => item.id === id)?.title || id)).join(", ")}</span></article>`).join("") || "<p>Chưa có dependency. Chọn dependency khi tạo task.</p>"}</div></article></div><div class="work-planning__card"><header><span>MILESTONE</span><h3>Milestone đang theo dõi</h3></header><form data-planning-milestone-form class="work-planning__inline-form"><input name="name" required maxlength="140" placeholder="Tên milestone"><input name="due" type="date"><select name="projectId">${projectOptions}</select><input name="progress" type="number" min="0" max="100" value="0" aria-label="Tiến độ %"><button type="submit">＋ Thêm milestone</button></form><div class="work-milestone-list">${(state.milestones || []).map((item) => `<article><strong>${esc(item.name)}</strong><span>${esc(item.due || "Chưa đặt ngày")} · ${Number(item.progress || 0)}%</span></article>`).join("") || "<p>Chưa có milestone.</p>"}</div></div></section><section class="work-planning__pane" data-planning-pane="timeline"><div class="work-planning__card"><header><span>CALENDAR ADAPTER</span><h3>Lịch & timeline</h3><p>Lịch nội bộ chỉ hiển thị dữ liệu đã lưu; chưa giả lập Google/Outlook.</p></header><div class="work-timeline">${timeline.map((item) => `<article><time datetime="${esc(item.date)}">${esc(item.date)}</time><span>${esc(item.type)}</span><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small></article>`).join("") || "<p>Chưa có item có ngày.</p>"}</div></div></section><section class="work-planning__pane" data-planning-pane="meeting"><div class="work-planning__grid"><form class="work-planning__card" data-planning-meeting-form><header><span>MEETING</span><h3>Ghi cuộc họp</h3></header><label>Tiêu đề<input name="title" required maxlength="160" placeholder="Planning sprint"></label><label>Ngày giờ<input name="date" type="datetime-local" required></label><label>Người tham gia<input name="attendees" maxlength="240" placeholder="team@example.com"></label><label>Ghi chú<textarea name="notes" maxlength="1200" rows="3"></textarea></label><button type="submit">＋ Lưu meeting</button></form><form class="work-planning__card" data-planning-action-form><header><span>ACTION ITEM</span><h3>Meeting → action</h3></header><label>Việc cần làm<input name="title" required maxlength="180" placeholder="Chốt owner cho release"></label><div class="work-planning__two"><label>Người phụ trách<input name="assignee" maxlength="80"></label><label>Hạn xử lý<input name="due" type="date"></label></div><label>Meeting<select name="meetingId"><option value="">Không gắn meeting</option>${(state.meetings || []).map((item) => `<option value="${esc(item.id)}">${esc(item.title)}</option>`).join("")}</select></label><button type="submit">＋ Thêm action item</button></form></div><div class="work-action-list">${(state.actionItems || []).map((item) => `<article><label><input type="checkbox" data-planning-action-done="${esc(item.id)}" ${item.status === "done" ? "checked" : ""}><span><strong>${esc(item.title)}</strong><small>${esc(item.assignee || "Chưa giao")} · ${esc(item.due || "Chưa đặt hạn")}</small></span></label></article>`).join("") || "<p>Chưa có action item.</p>"}</div></section><section class="work-planning__pane" data-planning-pane="risk"><div class="work-risk-summary"><strong>${risks.length} nguy cơ</strong><span>Deadline · dependency · capacity · milestone · meeting action</span></div><div class="work-risk-list">${risks.map((risk) => `<article class="risk-${esc(risk.level)}"><b>${esc(risk.level.toUpperCase())}</b><div><strong>${esc(risk.title)}</strong><span>${esc(risk.reason)}</span></div><small>${esc(risk.type)}</small></article>`).join("") || "<p>Chưa phát hiện nguy cơ theo dữ liệu hiện tại.</p>"}</div></section><section class="work-planning__card work-form-import"><header><span>FORM → TASK</span><h3>Chuyển phản hồi thành task</h3></header><div>${responseItems.slice(0, 8).map((item) => `<article><span>#${esc(item.id || "response")}</span><strong>${esc(Object.values(item.data || {}).join(" · ").slice(0, 120) || "Phản hồi trống")}</strong><button type="button" data-form-response-task="${esc(item.id)}">Tạo task</button></article>`).join("") || "<p>Chưa có phản hồi form cục bộ.</p>"}</div></section></section></section>`;
  }

  function render() {
    if (!host) return;
    const stats = getStats();
    const completed = stats.done + stats.open ? Math.round(stats.done / (stats.done + stats.open) * 100) : 0;
    host.innerHTML = `<section class="work-center" aria-label="Trung tâm công việc HH">
      <div class="work-aurora" aria-hidden="true"><i></i><i></i><i></i></div>
      <header class="work-hero">
        <div class="work-hero__copy"><span><i></i> WORK OPERATING SYSTEM</span><h2>${greeting()}, <b>${esc(userName())}</b></h2><p>Quản lý dự án, tài liệu, tệp và tự động hóa trong một luồng làm việc thống nhất.</p><div><button type="button" data-work-capture>＋ Quick Capture</button><button type="button" data-work-route="/work/project-center">Mở Project Center</button></div></div>
        <div class="work-hero__status"><time data-work-clock>--:--</time><span data-work-date>Đang tải ngày...</span><div><i></i><b>${navigator.onLine ? "Đang trực tuyến" : "Ngoại tuyến"}</b><span>${stats.open} việc đang mở</span></div></div>
      </header>

      <section class="work-command"><label><span>⌕</span><input type="search" data-work-search placeholder="Tìm dự án, công việc, Wiki hoặc workspace..." autocomplete="off"><kbd>Ctrl K</kbd></label><div data-work-search-results hidden></div><button type="button" data-work-capture><span>＋</span>Tạo mới</button></section>

      ${planningMarkup()}

      <section class="work-kpis" aria-label="Tổng quan công việc">
        <article><span>Dự án đang quản lý</span><strong>${stats.projects}</strong><small><i style="width:${stats.average}%"></i>Tiến độ TB ${stats.average}%</small></article>
        <article><span>Đầu việc đang mở</span><strong>${stats.open}</strong><small><i style="width:${Math.min(100, stats.open * 12)}%"></i>${stats.overdue ? `${stats.overdue} việc quá hạn` : "Đúng tiến độ"}</small></article>
        <article><span>Hoàn thành</span><strong>${completed}%</strong><small><i style="width:${completed}%"></i>${stats.done} việc đã xong</small></article>
        <article><span>Dữ liệu thiết bị</span><strong>${read(FILE_META_KEY, []).length}</strong><small><i style="width:${Math.min(100, read(FILE_META_KEY, []).length * 8)}%"></i>Tệp làm việc cục bộ</small></article>
      </section>

      <div class="work-layout">
        <main>
          <section class="work-panel work-my-day"><header><div><span>MY DAY</span><h2>Việc cần tập trung</h2></div><nav>${[["open", "Đang mở"], ["today", "Hôm nay"], ["overdue", "Quá hạn"], ["done", "Đã xong"]].map(([id, label]) => `<button type="button" class="${workState().taskFilter === id ? "is-active" : ""}" data-task-filter="${id}">${label}</button>`).join("")}</nav><button type="button" data-work-capture aria-label="Thêm công việc">＋</button></header><div data-work-task-list>${taskRows()}</div></section>
          <section class="work-panel work-projects"><header><div><span>PORTFOLIO</span><h2>Sức khỏe dự án</h2></div><button type="button" data-work-route="/work/project-center">Xem tất cả ↗</button></header><div>${projectRows()}</div></section>
          <section class="work-workspaces"><header><div><span>CONNECTED WORKSPACES</span><h2>Toàn bộ công cụ công việc</h2><p>Mỗi workspace có dữ liệu và luồng thao tác riêng, được kết nối tại đây.</p></div><b>9 ứng dụng</b></header><div data-workspace-grid>${workspaceCards()}</div><div class="work-no-results" data-workspace-empty hidden>Không có workspace phù hợp.</div></section>
        </main>
        <aside>
          ${focusMarkup()}
          <section class="work-panel work-deadlines"><header><div><span>LỊCH SẮP TỚI</span><h2>Deadline</h2></div><button type="button" data-work-route="/work/project-center">Mở lịch</button></header><div>${deadlineRows()}</div></section>
          <section class="work-panel work-files"><header><div><span>DEVICE VAULT</span><h2>Tệp làm việc</h2></div><button type="button" data-work-route="/work/cloud-storage">Cloud ↗</button></header><label data-work-dropzone><input type="file" data-work-file-input multiple><span>⇧</span><strong>Thả tệp hoặc bấm để chọn</strong><small>Lưu riêng trên thiết bị · tối đa 100 MB/tệp</small></label><div data-work-file-list><p>Đang đọc kho tệp...</p></div></section>
          <section class="work-panel work-knowledge"><header><div><span>KNOWLEDGE</span><h2>Wiki gần đây</h2></div><button type="button" data-work-route="/work/knowledge-center">Viết bài</button></header><div>${knowledgeRows()}</div></section>
          <section class="work-panel work-activity"><header><div><span>LIVE ACTIVITY</span><h2>Dòng hoạt động</h2></div><button type="button" data-work-activity-clear>Dọn</button></header><div>${activityRows()}</div></section>
        </aside>
      </div>
      ${captureDialog()}
      <div class="work-toast" data-work-toast role="status" aria-live="polite"></div>
    </section>`;
    bindRoot();
    updateClock();
    startFocusTicker();
    renderDeviceFiles();
  }

  function bindRoot() {
    const root = host?.querySelector(".work-center");
    if (!root) return;
    root.addEventListener("click", handleClick);
    root.addEventListener("input", handleInput);
    root.addEventListener("change", handleChange);
    root.addEventListener("submit", handleSubmit);
    const dropzone = root.querySelector("[data-work-dropzone]");
    ["dragenter", "dragover"].forEach((type) => dropzone.addEventListener(type, (event) => { event.preventDefault(); fileDragDepth += 1; dropzone.classList.add("is-dragging"); }));
    ["dragleave", "drop"].forEach((type) => dropzone.addEventListener(type, (event) => { event.preventDefault(); fileDragDepth = Math.max(0, fileDragDepth - 1); if (!fileDragDepth || type === "drop") dropzone.classList.remove("is-dragging"); if (type === "drop") saveFiles(event.dataTransfer?.files); }));
  }

  function handleClick(event) {
    const planningTab = event.target.closest("[data-planning-tab]");
    if (planningTab) { const planning = planningTab.closest("[data-work-planning]"); planning?.querySelectorAll("[data-planning-tab]").forEach((item) => { const active = item === planningTab; item.classList.toggle("is-active", active); item.setAttribute("aria-selected", String(active)); }); planning?.querySelectorAll("[data-planning-pane]").forEach((pane) => pane.classList.toggle("is-active", pane.dataset.planningPane === planningTab.dataset.planningTab)); return; }
    if (event.target.closest("[data-planning-export]")) { exportPlanning(); return; }
    if (event.target.closest("[data-planning-sync]")) { planningSync(); return; }
    if (event.target.closest("[data-planning-capacity]")) { writePlanning((state) => ({ ...state, projects: state.projects.map((project) => ({ ...project, capacity: Number(project.capacity || 40) })), capacities: Object.fromEntries(Object.keys(state.capacities || {}).map((person) => [person, Number(state.capacities[person] || 40)])) })); render(); showToast("Đã đặt capacity mặc định 40 giờ cho dữ liệu local."); return; }
    if (event.target.closest("[data-form-response-task]")) { createTaskFromResponse(event.target.closest("[data-form-response-task]").dataset.formResponseTask); return; }
    const route = event.target.closest("[data-work-route]");
    if (route) { location.hash = `#${route.dataset.workRoute}`; return; }
    if (event.target.closest("[data-work-capture]")) { openCapture(); return; }
    if (event.target.closest("[data-capture-save]")) { saveCapture(); return; }
    const taskToggle = event.target.closest("[data-work-task-toggle]");
    if (taskToggle) { toggleTask(taskToggle.dataset.workTaskToggle); return; }
    const taskDelete = event.target.closest("[data-work-task-delete]");
    if (taskDelete) { deleteTask(taskDelete.dataset.workTaskDelete); return; }
    const filter = event.target.closest("[data-task-filter]");
    if (filter) { const state = workState(); state.taskFilter = filter.dataset.taskFilter; write(WORK_KEY, state); render(); return; }
    const fileDownload = event.target.closest("[data-file-download]");
    if (fileDownload) { downloadStoredFile(fileDownload.dataset.fileDownload); return; }
    const fileDelete = event.target.closest("[data-file-delete]");
    if (fileDelete) { deleteStoredFile(fileDelete.dataset.fileDelete); return; }
    if (event.target.closest("[data-focus-toggle]")) { toggleFocus(); return; }
    if (event.target.closest("[data-focus-reset]")) { resetFocus(); return; }
    if (event.target.closest("[data-work-activity-clear]")) { const state = projectState(); state.activity = []; write(PROJECT_KEY, state); render(); showToast("Đã dọn hoạt động cục bộ."); }
  }

  function handleInput(event) {
    if (event.target.matches("[data-work-search]")) renderSearch(event.target.value);
  }

  function handleChange(event) {
    if (event.target.matches("[data-work-file-input]")) { saveFiles(event.target.files); event.target.value = ""; }
    if (event.target.matches("[data-capture-type]")) updateCaptureFields(event.target.value);
    if (event.target.matches("[data-focus-minutes]")) { const state = workState(); state.focusMinutes = Number(event.target.value); state.focusRemaining = state.focusMinutes * 60; state.focusRunning = false; state.focusEnd = 0; write(WORK_KEY, state); render(); }
    if (event.target.matches("[data-planning-action-done]")) { const id = event.target.dataset.planningActionDone; writePlanning((state) => ({ ...state, actionItems: state.actionItems.map((item) => item.id === id ? { ...item, status: event.target.checked ? "done" : "todo" } : item) })); render(); }
  }

  function formValue(form, name) { return String(form.elements[name]?.value || "").trim(); }
  function selectedValues(form, name) { return [...(form.elements[name]?.selectedOptions || [])].map((option) => option.value).filter(Boolean); }
  function handleSubmit(event) {
    const form = event.target.closest("[data-work-planning] form");
    if (!form) return;
    event.preventDefault();
    const state = planningState();
    if (form.matches("[data-planning-project-form]")) {
      const name = formValue(form, "name"); if (!name) return;
      const project = { id: uid("project"), name, owner: formValue(form, "owner"), capacity: Math.max(1, Number(formValue(form, "capacity") || 40)), start: formValue(form, "start") || day(), due: formValue(form, "due"), status: "active", progress: 0, priority: "normal", description: "", color: ["#62e9f2", "#ff5dc8", "#f5db6d", "#8d7cff"][state.projects.length % 4] };
      writePlanning((current) => ({ ...current, projects: [project, ...(current.projects || [])] })); render(); showToast(`Đã tạo project “${name}”.`); return;
    }
    if (form.matches("[data-planning-task-form]")) {
      const title = formValue(form, "title"); if (!title) return;
      const projectId = formValue(form, "projectId") || state.projects[0]?.id;
      const task = { id: uid("task"), title, projectId, project: projectId, assignee: formValue(form, "assignee"), due: formValue(form, "due"), estimate: Math.max(.25, Number(formValue(form, "estimate") || 1)), dependsOn: selectedValues(form, "dependsOn"), status: "todo", column: "todo", priority: "normal", createdAt: new Date().toISOString() };
      writePlanning((current) => ({ ...current, tasks: [task, ...(current.tasks || [])] })); render(); showToast(`Đã tạo task “${title}”.`); return;
    }
    if (form.matches("[data-planning-cycle-form]")) {
      const name = formValue(form, "name"); if (!name) return;
      const cycle = { id: uid("cycle"), name, start: formValue(form, "start"), end: formValue(form, "end"), goal: formValue(form, "goal"), status: "planned" };
      writePlanning((current) => ({ ...current, cycles: [cycle, ...(current.cycles || [])] })); render(); showToast(`Đã tạo cycle “${name}”.`); return;
    }
    if (form.matches("[data-planning-milestone-form]")) {
      const name = formValue(form, "name"); if (!name) return;
      const milestone = { id: uid("milestone"), name, due: formValue(form, "due"), projectId: formValue(form, "projectId"), progress: Math.max(0, Math.min(100, Number(formValue(form, "progress") || 0))), status: "open" };
      writePlanning((current) => ({ ...current, milestones: [milestone, ...(current.milestones || [])] })); render(); showToast(`Đã thêm milestone “${name}”.`); return;
    }
    if (form.matches("[data-planning-meeting-form]")) {
      const title = formValue(form, "title"); if (!title) return;
      const meeting = { id: uid("meeting"), title, date: formValue(form, "date"), attendees: formValue(form, "attendees"), notes: formValue(form, "notes"), createdAt: new Date().toISOString() };
      writePlanning((current) => ({ ...current, meetings: [meeting, ...(current.meetings || [])] })); render(); showToast(`Đã lưu meeting “${title}”.`); return;
    }
    if (form.matches("[data-planning-action-form]")) {
      const title = formValue(form, "title"); if (!title) return;
      const action = { id: uid("action"), title, assignee: formValue(form, "assignee"), due: formValue(form, "due"), meetingId: formValue(form, "meetingId"), status: "todo", createdAt: new Date().toISOString() };
      writePlanning((current) => ({ ...current, actionItems: [action, ...(current.actionItems || [])] })); render(); showToast(`Đã thêm action item “${title}”.`); return;
    }
  }

  function createTaskFromResponse(responseId) {
    const response = (extensionState()["form-builder"]?.responses || []).find((item) => String(item.id) === String(responseId));
    if (!response) return showToast("Không tìm thấy phản hồi form cục bộ.", "error");
    const values = Object.entries(response.data || {}).map(([key, value]) => `${key}: ${value}`).join(" · ");
    const task = { id: uid("task"), title: `Xử lý phản hồi ${response.id || "form"}`, description: values, projectId: planningState().projects[0]?.id, project: planningState().projects[0]?.id, status: "todo", column: "todo", priority: "normal", estimate: 1, due: "", dependsOn: [], source: { type: "form-response", id: response.id }, createdAt: new Date().toISOString() };
    writePlanning((state) => ({ ...state, tasks: [task, ...(state.tasks || [])] })); render(); showToast("Đã chuyển phản hồi thành task local.");
  }

  function exportPlanning() {
    const data = JSON.stringify(planningState(), null, 2);
    const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(new Blob([data], { type: "application/json" })); anchor.download = `hh-work-center-${day()}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(anchor.href), 1000); showToast("Đã xuất snapshot Work Center.");
  }

  async function planningSync() {
    const adapter = window.HH_WORK_ADAPTER;
    if (!adapter || typeof adapter.sync !== "function") { writePlanning((state) => ({ ...state, adapter: { mode: "local", status: "Local-first · adapter chưa cấu hình", lastSyncAt: "" } })); showToast("Chưa cấu hình adapter lịch/nhóm; dữ liệu vẫn lưu trên thiết bị."); return; }
    try { const result = await adapter.sync(planningState()); writePlanning((state) => ({ ...state, ...(result || {}), adapter: { mode: "remote", status: "Đã đồng bộ qua adapter", lastSyncAt: new Date().toISOString() } })); render(); showToast("Đã đồng bộ qua adapter được cấu hình."); } catch (error) { showToast(`Adapter lỗi: ${error.message}`, "error"); }
  }

  function renderSearch(rawQuery) {
    const query = rawQuery.trim().toLowerCase();
    const results = host.querySelector("[data-work-search-results]");
    const cards = host.querySelectorAll("[data-workspace-card]");
    cards.forEach((card) => { card.hidden = Boolean(query) && !card.dataset.searchText.includes(query); });
    host.querySelector("[data-workspace-empty]").hidden = [...cards].some((card) => !card.hidden);
    if (!query) { results.hidden = true; results.innerHTML = ""; return; }
    const projects = projectState();
    const wiki = wikiState();
    const items = [
      ...WORKSPACES.map((item) => ({ type: "Workspace", title: item.title, detail: item.description, route: item.route, key: `${item.title} ${item.description} ${item.features.join(" ")}` })),
      ...projects.projects.map((item) => ({ type: "Dự án", title: item.name, detail: `${item.progress}% · ${item.status}`, route: "/work/project-center", key: `${item.name} ${item.description} ${item.status}` })),
      ...projects.tasks.map((item) => ({ type: "Công việc", title: item.title, detail: `${item.priority} · ${item.column}`, route: "/work/project-center", key: `${item.title} ${item.priority}` })),
      ...wiki.articles.map((item) => ({ type: "Wiki", title: item.title, detail: `${item.category} · ${(item.tags || []).join(", ")}`, route: "/work/knowledge-center", key: `${item.title} ${item.category} ${(item.tags || []).join(" ")} ${item.content}` }))
    ].filter((item) => item.key.toLowerCase().includes(query)).slice(0, 8);
    results.innerHTML = items.length ? items.map((item) => `<button type="button" data-work-route="${item.route}"><span>${item.type}</span><div><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small></div><b>↗</b></button>`).join("") : `<p>Không tìm thấy “${esc(rawQuery)}”.</p>`;
    results.hidden = false;
  }

  function openCapture(type = "task") {
    const dialog = host?.querySelector("[data-work-dialog]");
    if (!dialog) return;
    dialog.querySelector("[data-capture-type]").value = type;
    updateCaptureFields(type);
    dialog.showModal();
    requestAnimationFrame(() => dialog.querySelector("[data-capture-title]")?.focus());
  }

  function updateCaptureFields(type) {
    const dialog = host?.querySelector("[data-work-dialog]");
    if (!dialog) return;
    dialog.querySelector("[data-capture-project-wrap]").hidden = type !== "task";
    dialog.querySelector("[data-capture-priority-wrap]").hidden = type === "note";
    dialog.querySelector("[data-capture-due-wrap]").hidden = type === "note";
    dialog.querySelector("[data-capture-category-wrap]").hidden = type !== "note";
  }

  function saveCapture() {
    const dialog = host.querySelector("[data-work-dialog]");
    const title = dialog.querySelector("[data-capture-title]").value.trim();
    const details = dialog.querySelector("[data-capture-details]").value.trim();
    const status = dialog.querySelector("[data-capture-status]");
    if (!title) { status.textContent = "Hãy nhập tiêu đề trước khi tạo."; dialog.querySelector("[data-capture-title]").focus(); return; }
    const type = dialog.querySelector("[data-capture-type]").value;
    if (type === "task") {
      const state = projectState();
      state.tasks.unshift({ id: uid("task"), title, description: details, column: "todo", priority: dialog.querySelector("[data-capture-priority]").value, project: dialog.querySelector("[data-capture-project]").value, due: dialog.querySelector("[data-capture-due]").value, createdAt: new Date().toISOString() });
      state.activity.unshift(`Tạo công việc “${title}”`);
      write(PROJECT_KEY, state);
    } else if (type === "project") {
      const state = projectState();
      const id = uid("project");
      state.projects.unshift({ id, name: title, description: details, status: "Đang phát triển", progress: 0, priority: dialog.querySelector("[data-capture-priority]").value, due: dialog.querySelector("[data-capture-due]").value, color: ["#62e9f2", "#ff5dc8", "#f5db6d", "#8d7cff"][state.projects.length % 4] });
      state.activeProject = id;
      state.activity.unshift(`Tạo dự án “${title}”`);
      write(PROJECT_KEY, state);
    } else {
      const state = wikiState();
      const article = { id: uid("article"), title, category: dialog.querySelector("[data-capture-category]").value.trim() || "Ghi chú", tags: ["quick-capture"], bookmark: false, updated: day(), content: `# ${title}\n\n${details || "Bắt đầu ghi lại kiến thức tại đây."}` };
      state.articles.unshift(article);
      state.activeArticle = article.id;
      write(WIKI_KEY, state);
    }
    dialog.close();
    render();
    showToast(type === "task" ? "Đã tạo công việc mới." : type === "project" ? "Đã tạo dự án mới." : "Đã lưu vào Knowledge Center.");
  }

  function toggleTask(id) {
    const state = projectState();
    const task = state.tasks.find((item) => item.id === id);
    if (!task) return;
    task.column = task.column === "done" ? "todo" : "done";
    state.activity.unshift(`${task.column === "done" ? "Hoàn thành" : "Mở lại"} “${task.title}”`);
    write(PROJECT_KEY, state);
    render();
  }

  function deleteTask(id) {
    const state = projectState();
    const task = state.tasks.find((item) => item.id === id);
    state.tasks = state.tasks.filter((item) => item.id !== id);
    if (task) state.activity.unshift(`Xóa công việc “${task.title}”`);
    write(PROJECT_KEY, state);
    render();
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function databaseAction(mode, callback) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DB_STORE, mode);
      const store = transaction.objectStore(DB_STORE);
      const result = callback(store);
      transaction.oncomplete = () => { db.close(); resolve(result?.result); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    });
  }

  async function saveFiles(fileList) {
    const files = [...(fileList || [])].slice(0, 20);
    if (!files.length) return;
    const accepted = files.filter((file) => file.size <= MAX_FILE_SIZE);
    if (!accepted.length) return showToast("Tệp vượt giới hạn 100 MB.", "error");
    showToast(`Đang lưu ${accepted.length} tệp trên thiết bị...`);
    const meta = read(FILE_META_KEY, []);
    for (const file of accepted) {
      const id = uid("file");
      await databaseAction("readwrite", (store) => store.put({ id, name: file.name, type: file.type || "application/octet-stream", size: file.size, createdAt: new Date().toISOString(), blob: file }));
      meta.unshift({ id, name: file.name, type: file.type || "Tệp", size: file.size, createdAt: new Date().toISOString() });
    }
    write(FILE_META_KEY, meta.slice(0, 100));
    await renderDeviceFiles();
    showToast(`Đã lưu ${accepted.length} tệp. Dữ liệu không rời thiết bị.`);
  }

  async function renderDeviceFiles() {
    const list = host?.querySelector("[data-work-file-list]");
    if (!list) return;
    const files = read(FILE_META_KEY, []).slice(0, 6);
    list.innerHTML = files.length ? files.map((file) => `<article><span>${/image/.test(file.type) ? "IMG" : /video/.test(file.type) ? "VID" : /pdf/.test(file.type) ? "PDF" : "FILE"}</span><div><strong title="${esc(file.name)}">${esc(file.name)}</strong><small>${formatBytes(file.size)} · ${new Date(file.createdAt).toLocaleDateString("vi-VN")}</small></div><button type="button" data-file-download="${file.id}" aria-label="Tải ${esc(file.name)}">↓</button><button type="button" data-file-delete="${file.id}" aria-label="Xóa ${esc(file.name)}">×</button></article>`).join("") : `<div class="work-empty compact"><strong>Kho thiết bị đang trống</strong><p>Kéo tệp vào vùng phía trên để bắt đầu.</p></div>`;
  }

  async function downloadStoredFile(id) {
    try {
      const record = await new Promise(async (resolve, reject) => {
        const db = await openDatabase();
        const transaction = db.transaction(DB_STORE, "readonly");
        const request = transaction.objectStore(DB_STORE).get(id);
        request.onsuccess = () => { db.close(); resolve(request.result); };
        request.onerror = () => { db.close(); reject(request.error); };
      });
      if (!record?.blob) throw new Error("Không tìm thấy dữ liệu tệp.");
      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(record.blob);
      anchor.download = record.name;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(anchor.href), 1500);
      showToast(`Đang tải ${record.name}.`);
    } catch (error) { showToast(error.message, "error"); }
  }

  async function deleteStoredFile(id) {
    try {
      await databaseAction("readwrite", (store) => store.delete(id));
      write(FILE_META_KEY, read(FILE_META_KEY, []).filter((file) => file.id !== id));
      await renderDeviceFiles();
      showToast("Đã xóa tệp khỏi thiết bị.");
    } catch (error) { showToast(error.message, "error"); }
  }

  function updateClock() {
    clearInterval(clockTimer);
    const tick = () => {
      const now = new Date();
      const clock = host?.querySelector("[data-work-clock]");
      const date = host?.querySelector("[data-work-date]");
      if (clock) clock.textContent = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      if (date) date.textContent = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(now);
    };
    tick();
    clockTimer = setInterval(tick, 1000);
  }

  function toggleFocus() {
    const state = workState();
    if (state.focusRunning) {
      state.focusRemaining = Math.max(0, Math.ceil((state.focusEnd - Date.now()) / 1000));
      state.focusRunning = false;
      state.focusEnd = 0;
    } else {
      if (!state.focusRemaining) state.focusRemaining = state.focusMinutes * 60;
      state.focusRunning = true;
      state.focusEnd = Date.now() + state.focusRemaining * 1000;
    }
    write(WORK_KEY, state);
    render();
  }

  function resetFocus() {
    const state = workState();
    state.focusRemaining = state.focusMinutes * 60;
    state.focusRunning = false;
    state.focusEnd = 0;
    write(WORK_KEY, state);
    render();
  }

  function startFocusTicker() {
    clearInterval(focusTimer);
    const tick = () => {
      const state = workState();
      if (!state.focusRunning) return;
      const remaining = Math.max(0, Math.ceil((state.focusEnd - Date.now()) / 1000));
      const time = host?.querySelector("[data-focus-time]");
      if (time) time.textContent = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
      const dial = host?.querySelector("[data-work-focus]");
      if (dial) dial.style.setProperty("--focus-progress", `${Math.round((1 - remaining / (state.focusMinutes * 60)) * 360)}deg`);
      if (!remaining) {
        state.focusRunning = false;
        state.focusEnd = 0;
        state.focusRemaining = state.focusMinutes * 60;
        state.focusSessions = Number(state.focusSessions || 0) + 1;
        write(WORK_KEY, state);
        showToast("Hoàn thành một phiên tập trung. Nghỉ một chút nhé.");
        if ("Notification" in window && Notification.permission === "granted") new Notification("HH Work Center", { body: "Phiên tập trung đã hoàn thành." });
        render();
      }
    };
    focusTimer = setInterval(tick, 1000);
  }

  function showToast(message, kind = "success") {
    const toast = host?.querySelector("[data-work-toast]");
    if (!toast) return;
    toast.textContent = message;
    toast.dataset.kind = kind;
    toast.classList.add("is-visible");
    clearTimeout(Number(toast.dataset.timer || 0));
    toast.dataset.timer = String(setTimeout(() => toast.classList.remove("is-visible"), 2800));
  }

  function mount(target) {
    unmount();
    host = target;
    render();
  }

  function unmount() {
    clearInterval(clockTimer);
    clearInterval(focusTimer);
    clockTimer = 0;
    focusTimer = 0;
    fileDragDepth = 0;
    if (host) host.replaceChildren();
    host = null;
  }

  window.HHWorkCenter = { mount, unmount, refresh: render, openCapture };
})();
