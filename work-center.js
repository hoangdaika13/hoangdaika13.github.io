(() => {
  "use strict";

  const PROJECT_KEY = "hh-project-center";
  const WIKI_KEY = "hh-knowledge-center";
  const EXTENSION_KEY = "hh-extension-suite-v1";
  const DOWNLOAD_KEY = "hh-download-history";
  const STORE_CART_KEY = "hh-store-cart";
  const WORK_KEY = "hh-work-center-v1";
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
  const workState = () => ({ focusMinutes: 25, focusRemaining: 1500, focusRunning: false, focusEnd: 0, focusSessions: 0, taskFilter: "open", ...read(WORK_KEY, {}) });

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
    const dropzone = root.querySelector("[data-work-dropzone]");
    ["dragenter", "dragover"].forEach((type) => dropzone.addEventListener(type, (event) => { event.preventDefault(); fileDragDepth += 1; dropzone.classList.add("is-dragging"); }));
    ["dragleave", "drop"].forEach((type) => dropzone.addEventListener(type, (event) => { event.preventDefault(); fileDragDepth = Math.max(0, fileDragDepth - 1); if (!fileDragDepth || type === "drop") dropzone.classList.remove("is-dragging"); if (type === "drop") saveFiles(event.dataTransfer?.files); }));
  }

  function handleClick(event) {
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
