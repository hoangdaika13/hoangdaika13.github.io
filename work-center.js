(() => {
  "use strict";

  const PROJECT_KEY = "hh-project-center";
  const WIKI_KEY = "hh-knowledge-center";
  const EXTENSION_KEY = "hh-extension-suite-v1";
  const DOWNLOAD_KEY = "hh-download-history";
  const STORE_CART_KEY = "hh-store-cart";
  const WORK_KEY = "hh-work-center-v2";
  const LEGACY_WORK_KEY = "hh-work-center-v1";
  const WORK_SCHEMA_VERSION = 4;
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

  const WORK_PLANETS = Object.freeze([
    { id: "mission-control", icon: "MC", title: "Mission Control", subtitle: "Điều hành hôm nay", route: "/work/mission-control", color: "#62ecf2", accent: "#7cf8ca", description: "Việc cần làm, rủi ro, lịch, focus và trạng thái dữ liệu thật." },
    { id: "projects-tasks", icon: "PT", title: "Projects & Tasks", subtitle: "Thực thi đa góc nhìn", route: "/work/projects-tasks", color: "#8f7cff", accent: "#cf75ff", description: "List, Board, Calendar, Timeline, Gantt, Workload và Milestone." },
    { id: "roadmap-planning", icon: "RP", title: "Roadmap & Planning", subtitle: "Mục tiêu đến kế hoạch", route: "/work/roadmap-planning", color: "#ff70bf", accent: "#ff9f74", description: "Initiative, cycle, dependency, capacity, baseline và risk detector." },
    { id: "team-orbit", icon: "TO", title: "Team Orbit", subtitle: "Cộng tác & năng lực", route: "/work/team-orbit", color: "#5b9dff", accent: "#56e6e0", description: "Workload, capacity, meeting, action item và quyền làm việc nhóm." },
    { id: "knowledge-assets", icon: "KA", title: "Knowledge & Assets", subtitle: "Tri thức & tài nguyên", route: "/work/knowledge-assets", color: "#49e4ad", accent: "#b9f36a", description: "Wiki, tệp thiết bị, biểu mẫu và chín workspace cũ được kết nối." },
    { id: "automation-lab", icon: "AL", title: "Automation Lab", subtitle: "Luồng có kiểm soát", route: "/work/automation-lab", color: "#ff9a62", accent: "#ffe16b", description: "Trigger → condition → action → approval, dry run và lịch sử." },
    { id: "portfolio-observatory", icon: "PO", title: "Portfolio Observatory", subtitle: "Sức khỏe toàn danh mục", route: "/work/portfolio-observatory", color: "#ffd76a", accent: "#ff8c63", description: "Deadline, tiến độ, velocity, workload, rủi ro và snapshot xuất được." }
  ]);
  const WORK_THEMES = Object.freeze({
    aurora: "Aurora Office",
    quantum: "Quantum Workflow",
    nebula: "Nebula Focus",
    cyber: "Cyber Productivity",
    solar: "Solar Planner",
    deep: "Deep Space Calm"
  });
  const TASK_VIEWS = Object.freeze(["list", "board", "calendar", "timeline", "gantt", "workload", "table", "milestones"]);

  let host = null;
  let activeView = "mission-control";
  let clockTimer = 0;
  let focusTimer = 0;
  let taskSearchTimer = 0;
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
    if (!Array.isArray(state.projects)) state.projects = structuredClone(DEFAULT_PROJECTS);
    if (!Array.isArray(state.tasks)) state.tasks = structuredClone(DEFAULT_TASKS);
    state.activity = Array.isArray(state.activity) ? state.activity : [];
    return state;
  };
  const wikiState = () => {
    const state = read(WIKI_KEY, {});
    if (!Array.isArray(state.articles)) state.articles = structuredClone(DEFAULT_ARTICLES);
    return state;
  };
  const extensionState = () => read(EXTENSION_KEY, {});
  const planningDefaults = () => ({
    schemaVersion: WORK_SCHEMA_VERSION,
    revision: 0,
    adapter: { mode: "local", status: "Local-first · chưa kết nối adapter", lastSyncAt: "" },
    initiatives: [], projects: [], tasks: [], milestones: [],
    cycles: [{ id: "cycle-current", name: "Cycle hiện tại", start: day(), end: day(14), goal: "Ưu tiên việc quan trọng", status: "planned" }],
    capacities: {}, meetings: [], actionItems: [], cycleRolloverLog: [], calendar: [],
    universalProject: { id: "work-universe", name: "HH Universal Work Project", goal: "Tập trung công việc quan trọng và hoàn thành đúng hạn", owner: "", status: "active", updatedAt: "" },
    members: [],
    goals: [],
    automations: [],
    automationRuns: [],
    inbox: [],
    savedViews: [],
    activeProjectId: "",
    taskView: "board",
    taskQuery: "",
    theme: "aurora",
    effects: "balanced",
    lastContext: "/work/projects-tasks",
    focusMinutes: 25, focusRemaining: 1500, focusRunning: false, focusEnd: 0, focusSessions: 0, taskFilter: "open"
  });
  const normalizePlanning = (raw = {}) => {
    const projects = Array.isArray(raw.projects) ? raw.projects : structuredClone(DEFAULT_PROJECTS);
    const tasks = Array.isArray(raw.tasks) ? raw.tasks : structuredClone(DEFAULT_TASKS);
    const defaults = planningDefaults();
    const theme = Object.hasOwn(WORK_THEMES, raw.theme) ? raw.theme : defaults.theme;
    const effects = ["static", "balanced", "cinematic"].includes(raw.effects) ? raw.effects : defaults.effects;
    const taskView = TASK_VIEWS.includes(raw.taskView) ? raw.taskView : defaults.taskView;
    return {
      ...defaults,
      ...raw,
      schemaVersion: WORK_SCHEMA_VERSION,
      universalProject: { ...defaults.universalProject, ...(raw.universalProject && typeof raw.universalProject === "object" ? raw.universalProject : {}) },
      initiatives: Array.isArray(raw.initiatives) ? raw.initiatives : [],
      projects: projects.map((item) => ({ ...item, initiativeId: item.initiativeId || "", capacity: Number(item.capacity || 40) })),
      tasks: tasks.map((item) => ({ ...item, projectId: item.projectId || item.project || projects[0]?.id, cycleId: item.cycleId || "", status: item.status || item.column || "todo", column: item.column || item.status || "todo", estimate: Number(item.estimate || 1), dependsOn: Array.isArray(item.dependsOn) ? item.dependsOn : [], due: item.due || "", assignee: item.assignee || "" })),
      milestones: Array.isArray(raw.milestones) ? raw.milestones : [],
      cycles: Array.isArray(raw.cycles) ? raw.cycles : defaults.cycles,
      capacities: raw.capacities && typeof raw.capacities === "object" ? raw.capacities : {},
      meetings: Array.isArray(raw.meetings) ? raw.meetings : [],
      actionItems: Array.isArray(raw.actionItems) ? raw.actionItems : [],
      cycleRolloverLog: Array.isArray(raw.cycleRolloverLog) ? raw.cycleRolloverLog : [],
      calendar: Array.isArray(raw.calendar) ? raw.calendar : [],
      members: Array.isArray(raw.members) ? raw.members : [],
      goals: Array.isArray(raw.goals) ? raw.goals : [],
      automations: Array.isArray(raw.automations) ? raw.automations : [],
      automationRuns: Array.isArray(raw.automationRuns) ? raw.automationRuns : [],
      inbox: Array.isArray(raw.inbox) ? raw.inbox : [],
      savedViews: Array.isArray(raw.savedViews) ? raw.savedViews : [],
      theme,
      effects,
      taskView,
      activeProjectId: raw.activeProjectId && projects.some((item) => item.id === raw.activeProjectId) ? raw.activeProjectId : projects[0]?.id || ""
    };
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
  const addPlanningDays = (value, amount) => {
    const date = new Date(`${String(value || day()).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(date.getTime())) return day(amount);
    date.setDate(date.getDate() + Number(amount || 0));
    return date.toISOString().slice(0, 10);
  };
  const cycleCapacity = (state, cycleId) => {
    const tasks = (state.tasks || []).filter((task) => task.cycleId === cycleId && task.status !== "done");
    const committed = tasks.reduce((sum, task) => sum + Number(task.estimate || 0), 0);
    const people = [...new Set(tasks.map((task) => task.assignee || "Chưa phân công"))];
    const available = people.reduce((sum, person) => sum + Number(state.capacities?.[person] || state.projects?.[0]?.capacity || 40), 0) || Number(state.projects?.[0]?.capacity || 40);
    return { committed, available, percent: available ? Math.round(committed / available * 100) : 0, taskCount: tasks.length };
  };
  const assignOpenTasksToCycle = (rawState, cycleId) => {
    const state = normalizePlanning(rawState);
    if (!(state.cycles || []).some((cycle) => cycle.id === cycleId)) return state;
    return normalizePlanning({ ...state, tasks: state.tasks.map((task) => task.status !== "done" && !task.cycleId ? { ...task, cycleId } : task) });
  };
  const rolloverCycle = (rawState, cycleId, now = new Date()) => {
    const state = normalizePlanning(rawState);
    const source = state.cycles.find((cycle) => cycle.id === cycleId);
    if (!source) return { state, moved: 0, nextCycleId: "" };
    let next = state.cycles.filter((cycle) => cycle.id !== source.id && cycle.status !== "done" && String(cycle.start || "") >= String(source.end || "")).sort((left, right) => String(left.start).localeCompare(String(right.start)))[0];
    const cycles = state.cycles.map((cycle) => cycle.id === source.id ? { ...cycle, status: "done", completedAt: now.toISOString() } : cycle);
    if (!next) {
      const duration = Math.max(1, planningDaysUntil(source.end, new Date(`${source.start || day()}T12:00:00`)) || 14);
      next = { id: uid("cycle"), name: `${source.name || "Cycle"} · tiếp theo`, start: addPlanningDays(source.end || day(), 1), end: addPlanningDays(source.end || day(), duration), goal: source.goal || "", status: "planned" };
      cycles.unshift(next);
    }
    let moved = 0;
    const tasks = state.tasks.map((task) => {
      if (task.status === "done" || task.cycleId !== source.id) return task;
      moved += 1;
      return { ...task, cycleId: next.id, rolloverFrom: source.id, rolloverCount: Number(task.rolloverCount || 0) + 1 };
    });
    const entry = { id: uid("rollover"), fromCycleId: source.id, toCycleId: next.id, moved, createdAt: now.toISOString() };
    return { state: normalizePlanning({ ...state, cycles, tasks, cycleRolloverLog: [entry, ...(state.cycleRolloverLog || [])].slice(0, 100) }), moved, nextCycleId: next.id };
  };
  const extractMeetingActions = (meeting) => String(meeting?.notes || "").split(/\r?\n/).map((line) => line.trim()).map((line) => {
    const match = line.match(/^(?:[-*]\s*)?(?:\[\s?\]|TODO\s*:|ACTION\s*:|HÀNH ĐỘNG\s*:)(.+)$/i);
    return match ? match[1].trim().slice(0, 180) : "";
  }).filter(Boolean).slice(0, 20);
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
    (state.cycles || []).filter((cycle) => cycle.status !== "done").forEach((cycle) => { const capacity = cycleCapacity(state, cycle.id); if (capacity.percent > 100) risks.push({ level: "high", title: cycle.name, reason: `${capacity.committed}h vượt cycle capacity ${capacity.available}h`, type: "cycle-capacity" }); });
    return risks;
  };
  const planningTimeline = (state) => [...(state.tasks || []).filter((item) => item.due).map((item) => ({ date: item.due, type: "Task", title: item.title, detail: item.assignee || "Chưa phân công" })), ...(state.milestones || []).filter((item) => item.due).map((item) => ({ date: item.due, type: "Milestone", title: item.name, detail: `${item.progress || 0}%` })), ...(state.meetings || []).filter((item) => item.date).map((item) => ({ date: item.date, type: "Meeting", title: item.title, detail: item.attendees || "" }))].sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, 20);

  const statusLabel = (status) => ({ todo: "Cần làm", doing: "Đang làm", review: "Chờ duyệt", done: "Hoàn tất" })[status] || status || "Cần làm";
  const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value || 0)));
  const progressAverage = (items) => items.length ? Math.round(items.reduce((sum, item) => sum + clamp(item.progress), 0) / items.length) : 0;
  const workloadByPerson = (state) => {
    const workload = {};
    (state.tasks || []).filter((task) => task.status !== "done").forEach((task) => {
      const person = task.assignee || "Chưa phân công";
      workload[person] = (workload[person] || 0) + Number(task.estimate || 1);
    });
    return workload;
  };
  const workMetrics = (state = planningState()) => {
    const tasks = state.tasks || [];
    const projects = state.projects || [];
    const open = tasks.filter((task) => task.status !== "done");
    const done = tasks.filter((task) => task.status === "done");
    const overdue = open.filter((task) => planningDaysUntil(task.due) < 0);
    const dueSoon = open.filter((task) => { const days = planningDaysUntil(task.due); return days !== null && days >= 0 && days <= 3; });
    const risks = detectPlanningRisks(state);
    const blocked = open.filter((task) => (task.dependsOn || []).some((id) => tasks.find((item) => item.id === id)?.status !== "done"));
    const estimated = tasks.reduce((sum, task) => sum + Number(task.estimate || 0), 0);
    const completedEstimate = done.reduce((sum, task) => sum + Number(task.estimate || 0), 0);
    const completion = tasks.length ? Math.round(done.length / tasks.length * 100) : 0;
    return {
      projects: projects.length,
      open: open.length,
      done: done.length,
      overdue: overdue.length,
      dueSoon: dueSoon.length,
      blocked: blocked.length,
      risks,
      completion,
      average: progressAverage(projects),
      estimated,
      completedEstimate,
      velocity: tasks.length ? Math.round(completedEstimate / Math.max(1, estimated) * 100) : 0,
      meetings: (state.meetings || []).length,
      automations: (state.automations || []).filter((item) => item.enabled).length,
      assets: read(FILE_META_KEY, []).length + wikiState().articles.length
    };
  };
  const planetTelemetry = (planetId, state, metrics = workMetrics(state)) => {
    const activeCycle = (state.cycles || []).find((cycle) => cycle.status !== "done");
    const values = {
      "mission-control": { value: metrics.open, unit: "việc mở", alert: metrics.overdue },
      "projects-tasks": { value: metrics.completion, unit: "% hoàn tất", alert: metrics.blocked },
      "roadmap-planning": { value: (state.milestones || []).length, unit: "milestone", alert: metrics.risks.length },
      "team-orbit": { value: Object.keys(workloadByPerson(state)).length, unit: "thành viên", alert: metrics.risks.filter((risk) => risk.type.includes("capacity")).length },
      "knowledge-assets": { value: metrics.assets, unit: "tài nguyên", alert: 0 },
      "automation-lab": { value: metrics.automations, unit: "đang bật", alert: (state.automationRuns || []).filter((run) => run.status === "failed").length },
      "portfolio-observatory": { value: metrics.average, unit: "% sức khỏe", alert: metrics.overdue }
    };
    const telemetry = values[planetId] || { value: 0, unit: "mục", alert: 0 };
    return { ...telemetry, status: telemetry.alert ? (telemetry.alert > 2 ? "critical" : "watch") : (activeCycle ? "healthy" : "watch") };
  };
  const activeProject = (state) => state.projects.find((project) => project.id === state.activeProjectId) || state.projects[0];
  const projectName = (state, id) => state.projects.find((project) => project.id === id)?.name || "Universal Work Project";
  const currentWorkRoute = () => activeView === "mission-control" ? "/work" : `/work/${activeView}`;

  function rootCrownMarkup(state) {
    const metrics = workMetrics(state);
    const project = activeProject(state);
    return `<header class="work-root-crown">
      <div class="work-root-crown__brand"><span>W</span><div><small>HH WORK GALAXY · SCHEMA ${WORK_SCHEMA_VERSION}</small><strong>${esc(state.universalProject?.name || "Universal Work Project")}</strong></div></div>
      <div class="work-root-crown__status"><span data-status="${navigator.onLine ? "online" : "offline"}"><i></i>${navigator.onLine ? "Local data ready" : "Offline local-first"}</span><b>${metrics.risks.length} cảnh báo</b><time data-work-clock>--:--</time></div>
      <div class="work-root-crown__controls">
        <label><span>Theme</span><select data-work-theme>${Object.entries(WORK_THEMES).map(([id, label]) => `<option value="${id}" ${state.theme === id ? "selected" : ""}>${label}</option>`).join("")}</select></label>
        <label><span>Hiệu ứng</span><select data-work-effects><option value="static" ${state.effects === "static" ? "selected" : ""}>Tĩnh</option><option value="balanced" ${state.effects === "balanced" ? "selected" : ""}>Cân bằng</option><option value="cinematic" ${state.effects === "cinematic" ? "selected" : ""}>Điện ảnh</option></select></label>
      </div>
    </header>`;
  }

  function galaxyNavMarkup(state) {
    const metrics = workMetrics(state);
    return `<nav class="work-galaxy-nav" aria-label="Các hành tinh Công việc">${WORK_PLANETS.map((planet) => {
      const telemetry = planetTelemetry(planet.id, state, metrics);
      const active = planet.id === activeView;
      return `<button type="button" class="${active ? "is-active" : ""}" data-work-route="${planet.route}" data-planet-status="${telemetry.status}" style="--planet:${planet.color};--planet-accent:${planet.accent}" ${active ? "aria-current=page" : ""}><span>${planet.icon}</span><div><strong>${planet.title}</strong><small>${telemetry.value} ${telemetry.unit}</small></div><i></i></button>`;
    }).join("")}</nav>`;
  }

  function commandMarkup() {
    return `<section class="work-command work-command--galaxy"><label><span>⌕</span><input type="search" data-work-search placeholder="Tìm task, project, Wiki hoặc workspace..." autocomplete="off"><kbd>Ctrl K</kbd></label><div data-work-search-results hidden></div><button type="button" data-work-capture><span>＋</span>Tạo mới</button></section>`;
  }

  function projectStarMarkup(state) {
    const metrics = workMetrics(state);
    const project = activeProject(state);
    const progress = clamp(project?.progress ?? metrics.completion);
    return `<section class="work-galaxy-hero" aria-label="Universal Work Project">
      <div class="work-cosmic-field" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="work-galaxy-hero__copy"><span>UNIVERSAL WORK PROJECT</span><h1>${esc(state.universalProject?.name || "HH Work Galaxy")}</h1><p>${esc(state.universalProject?.goal || "Mọi dự án, công việc, tri thức và tự động hóa cùng một quỹ đạo.")}</p><div><button type="button" data-work-continue>▶ Tiếp tục công việc gần nhất</button><button type="button" data-work-capture>＋ Quick Capture</button></div><details class="work-universal-editor"><summary>⚙ Thiết lập Project Star</summary><form data-work-universal-form><label>Tên không gian<input name="name" required maxlength="120" value="${esc(state.universalProject?.name || "")}"></label><label>Mục tiêu<textarea name="goal" maxlength="300" rows="2">${esc(state.universalProject?.goal || "")}</textarea></label><label>Owner<input name="owner" maxlength="100" value="${esc(state.universalProject?.owner || "")}"></label><button type="submit">Lưu Universal Project</button></form></details></div>
      <div class="work-project-star" style="--star-progress:${progress * 3.6}deg"><div><span>${esc(String(project?.name || "HH").slice(0, 2).toUpperCase())}</span><strong>${progress}%</strong><small>PROJECT STAR</small></div><i></i><i></i><i></i></div>
      <div class="work-orbit-system" aria-label="Bảy hành tinh vận hành">${WORK_PLANETS.map((planet, index) => {
        const telemetry = planetTelemetry(planet.id, state, metrics);
        return `<button type="button" data-work-route="${planet.route}" data-planet-status="${telemetry.status}" style="--orbit-index:${index};--planet:${planet.color};--planet-accent:${planet.accent}" title="${esc(planet.description)}"><span>${planet.icon}</span><b>${esc(planet.title)}</b><small>${telemetry.value} ${esc(telemetry.unit)}</small></button>`;
      }).join("")}</div>
    </section>`;
  }

  function metricCardsMarkup(state) {
    const metrics = workMetrics(state);
    return `<section class="work-galaxy-metrics" aria-label="Số liệu công việc thật">
      <article style="--metric:#62ecf2"><span>Đang mở</span><strong>${metrics.open}</strong><small>${metrics.dueSoon} việc đến hạn trong 3 ngày</small><i><b style="width:${Math.min(100, metrics.open * 8)}%"></b></i></article>
      <article style="--metric:#8f7cff"><span>Hoàn thành</span><strong>${metrics.completion}%</strong><small>${metrics.done} task đã đóng</small><i><b style="width:${metrics.completion}%"></b></i></article>
      <article style="--metric:#ff708f"><span>Rủi ro</span><strong>${metrics.risks.length}</strong><small>${metrics.overdue} quá hạn · ${metrics.blocked} bị chặn</small><i><b style="width:${Math.min(100, metrics.risks.length * 18)}%"></b></i></article>
      <article style="--metric:#ffd76a"><span>Portfolio health</span><strong>${metrics.average}%</strong><small>${metrics.projects} dự án đang theo dõi</small><i><b style="width:${metrics.average}%"></b></i></article>
    </section>`;
  }

  function actionQueueMarkup(state) {
    const metrics = workMetrics(state);
    const actions = [
      ...metrics.risks.slice(0, 4).map((risk) => ({ tone: risk.level, title: risk.title, detail: risk.reason, route: "/work/roadmap-planning" })),
      ...(state.actionItems || []).filter((item) => item.status !== "done").slice(0, 3).map((item) => ({ tone: "info", title: item.title, detail: `${item.assignee || "Chưa giao"} · ${item.due || "chưa đặt hạn"}`, route: "/work/team-orbit" }))
    ];
    return `<section class="work-galaxy-panel work-action-queue"><header><div><span>NEXT ACTIONS</span><h2>Việc cần xử lý tiếp</h2></div><b>${actions.length}</b></header><div>${actions.map((item) => `<button type="button" data-work-route="${item.route}" data-tone="${item.tone}"><i></i><div><strong>${esc(item.title)}</strong><small>${esc(item.detail)}</small></div><span>→</span></button>`).join("") || `<div class="work-galaxy-empty"><span>✓</span><strong>Quỹ đạo đang ổn định</strong><small>Chưa có rủi ro hoặc action item đang mở.</small></div>`}</div></section>`;
  }

  function compactTaskMarkup(task, state) {
    const project = projectName(state, task.projectId || task.project);
    const blocked = (task.dependsOn || []).some((id) => state.tasks.find((item) => item.id === id)?.status !== "done");
    return `<article class="work-galaxy-task" data-status="${esc(task.status)}" data-blocked="${blocked}">
      <button type="button" data-work-task-toggle="${esc(task.id)}" aria-label="${task.status === "done" ? "Mở lại" : "Hoàn thành"} ${esc(task.title)}">${task.status === "done" ? "✓" : ""}</button>
      <div><strong>${esc(task.title)}</strong><span>${esc(project)} · ${esc(task.assignee || "Chưa phân công")}</span><small>${task.due ? formatDate(task.due) : "Chưa đặt hạn"} · ${Number(task.estimate || 1)}h${blocked ? " · Đang bị chặn" : ""}</small></div>
      <select data-work-task-status="${esc(task.id)}" aria-label="Trạng thái ${esc(task.title)}">${["todo", "doing", "review", "done"].map((status) => `<option value="${status}" ${task.status === status ? "selected" : ""}>${statusLabel(status)}</option>`).join("")}</select>
      <button type="button" data-work-task-delete="${esc(task.id)}" aria-label="Xóa ${esc(task.title)}">×</button>
    </article>`;
  }

  function missionControlMarkup(state) {
    const tasks = (state.tasks || []).filter((task) => task.status !== "done").sort((left, right) => String(left.due || "9999").localeCompare(String(right.due || "9999"))).slice(0, 6);
    return `${projectStarMarkup(state)}${metricCardsMarkup(state)}
      <div class="work-mission-grid">
        <section class="work-galaxy-panel work-today-panel"><header><div><span>MY ORBIT</span><h2>Việc đang bay gần nhất</h2></div><button type="button" data-work-route="/work/projects-tasks">Tất cả →</button></header><div>${tasks.map((task) => compactTaskMarkup(task, state)).join("") || `<div class="work-galaxy-empty"><span>✦</span><strong>Chưa có việc đang mở</strong><small>Dùng Quick Capture để tạo task đầu tiên.</small></div>`}</div></section>
        <aside>${actionQueueMarkup(state)}${focusMarkup()}</aside>
      </div>
      <section class="work-planet-directory"><header><div><span>WORK GALAXY</span><h2>Bảy hành tinh, một nguồn dữ liệu</h2><p>Mọi tiến độ và cảnh báo đều được tính từ dự án, task, deadline và adapter đã lưu.</p></div></header><div>${WORK_PLANETS.map((planet) => { const telemetry = planetTelemetry(planet.id, state); return `<button type="button" data-work-route="${planet.route}" data-planet-status="${telemetry.status}" style="--planet:${planet.color};--planet-accent:${planet.accent}"><span>${planet.icon}</span><div><small>${esc(planet.subtitle)}</small><strong>${esc(planet.title)}</strong><p>${esc(planet.description)}</p></div><b>${telemetry.value}<small>${esc(telemetry.unit)}</small></b></button>`; }).join("")}</div></section>`;
  }

  function taskWorkspaceMarkup(state) {
    const view = state.taskView;
    const query = String(state.taskQuery || "").trim().toLocaleLowerCase("vi");
    const projectId = state.activeProjectId;
    const tasks = (state.tasks || []).filter((task) => (!projectId || task.projectId === projectId || task.project === projectId) && (!query || `${task.title} ${task.assignee || ""} ${task.priority || ""}`.toLocaleLowerCase("vi").includes(query)));
    const board = `<div class="work-task-board">${["todo", "doing", "review", "done"].map((status) => `<section><header><strong>${statusLabel(status)}</strong><b>${tasks.filter((task) => task.status === status).length}</b></header><div>${tasks.filter((task) => task.status === status).map((task) => compactTaskMarkup(task, state)).join("") || "<p>Chưa có task</p>"}</div></section>`).join("")}</div>`;
    const list = `<div class="work-task-list-view">${tasks.map((task) => compactTaskMarkup(task, state)).join("") || `<div class="work-galaxy-empty"><span>⌕</span><strong>Không có task phù hợp</strong><small>Thử bỏ bộ lọc hoặc tạo task mới.</small></div>`}</div>`;
    const calendarGroups = [...new Set(tasks.map((task) => task.due || "no-date"))].sort();
    const calendar = `<div class="work-calendar-grid">${calendarGroups.map((date) => `<section><header><time>${date === "no-date" ? "Chưa đặt ngày" : formatDate(date, { weekday: "short", day: "2-digit", month: "2-digit" })}</time><b>${tasks.filter((task) => (task.due || "no-date") === date).length}</b></header>${tasks.filter((task) => (task.due || "no-date") === date).map((task) => `<article><i data-status="${task.status}"></i><strong>${esc(task.title)}</strong><small>${esc(task.assignee || "Chưa giao")}</small></article>`).join("")}</section>`).join("")}</div>`;
    const timeline = `<div class="work-gantt"><header><span>Task</span><span>Quỹ đạo thời gian</span><span>Hạn</span></header>${tasks.map((task, index) => { const due = planningDaysUntil(task.due); const width = task.status === "done" ? 100 : clamp(28 + Number(task.estimate || 1) * 7, 24, 90); const start = clamp((index * 13) % 46, 0, 46); return `<article><strong>${esc(task.title)}</strong><div><i style="--gantt-start:${start}%;--gantt-width:${width}%" data-status="${task.status}"><b></b></i></div><time data-overdue="${due !== null && due < 0}">${task.due ? esc(task.due) : "—"}</time></article>`; }).join("") || "<p>Chưa có task để hiển thị.</p>"}</div>`;
    const workload = workloadByPerson({ ...state, tasks });
    const workloadMarkup = `<div class="work-workload-grid">${Object.entries(workload).map(([person, hours]) => { const capacity = Number(state.capacities?.[person] || activeProject(state)?.capacity || 40); const ratio = Math.round(hours / Math.max(1, capacity) * 100); return `<article data-overload="${ratio > 100}"><div><span>${esc(person.slice(0, 2).toUpperCase())}</span><div><strong>${esc(person)}</strong><small>${hours}h / ${capacity}h</small></div><b>${ratio}%</b></div><i><b style="width:${Math.min(100, ratio)}%"></b></i><small>${ratio > 100 ? "Cần cân bằng lại tải" : ratio > 80 ? "Gần đầy capacity" : "Còn năng lực"}</small></article>`; }).join("") || "<p>Chưa có assignee trên task đang mở.</p>"}</div>`;
    const milestoneMarkup = `<div class="work-milestone-galaxy">${(state.milestones || []).map((item, index) => `<article style="--milestone:${clamp(item.progress)}%;--milestone-index:${index}"><span>${String(index + 1).padStart(2, "0")}</span><div><strong>${esc(item.name)}</strong><small>${esc(projectName(state, item.projectId))} · ${item.due ? formatDate(item.due) : "Chưa đặt hạn"}</small><i><b></b></i></div><b>${clamp(item.progress)}%</b></article>`).join("") || `<div class="work-galaxy-empty"><span>◇</span><strong>Chưa có milestone</strong><small>Thêm milestone trong Roadmap & Planning.</small></div>`}</div>`;
    const content = view === "board" ? board : ["calendar"].includes(view) ? calendar : ["timeline", "gantt"].includes(view) ? timeline : view === "workload" ? workloadMarkup : view === "milestones" ? milestoneMarkup : list;
    return `<section class="work-task-workspace"><header class="work-view-toolbar"><div><span>PROJECTS & TASKS</span><h1>Nhiều góc nhìn, cùng một task</h1></div><div><label>Dự án<select data-work-active-project>${state.projects.map((project) => `<option value="${esc(project.id)}" ${project.id === projectId ? "selected" : ""}>${esc(project.name)}</option>`).join("")}</select></label><label>Tìm task<input type="search" data-work-task-query value="${esc(state.taskQuery || "")}" placeholder="Tên, người phụ trách..."></label><button type="button" data-work-capture>＋ Task</button></div></header>
      <nav class="work-view-switcher" aria-label="Góc nhìn công việc">${[["list", "List"], ["board", "Board"], ["calendar", "Calendar"], ["timeline", "Timeline"], ["gantt", "Gantt"], ["workload", "Workload"], ["table", "Table"], ["milestones", "Milestones"]].map(([id, label]) => `<button type="button" data-work-task-view="${id}" class="${view === id ? "is-active" : ""}" aria-pressed="${view === id}">${label}</button>`).join("")}<button type="button" data-work-save-view>＋ Lưu view</button></nav>
      <div class="work-saved-views">${(state.savedViews || []).map((item) => `<button type="button" data-work-apply-view="${esc(item.id)}"><span>✦</span>${esc(item.name)}<small>${esc(item.view)}</small></button>`).join("")}</div>
      ${content}
    </section>`;
  }

  function teamOrbitMarkup(state) {
    const workload = workloadByPerson(state);
    const names = [...new Set([...Object.keys(workload), ...(state.members || []).map((item) => item.name).filter(Boolean)])];
    return `<section class="work-page-intro" style="--page-color:#5b9dff;--page-accent:#56e6e0"><div><span>TEAM ORBIT</span><h1>Năng lực nhóm nhìn thấy được</h1><p>Capacity lấy từ task đang mở; ghi chú họp và action item chỉ được phân tích cục bộ khi bạn chủ động yêu cầu.</p></div><button type="button" data-work-route="/work/projects-tasks">Mở Workload →</button></section>
      <div class="work-team-grid">
        <section class="work-galaxy-panel"><header><div><span>CAPACITY MAP</span><h2>Quỹ đạo thành viên</h2></div><b>${names.length}</b></header><div class="work-team-orbits">${names.map((name, index) => { const hours = Number(workload[name] || 0); const capacity = Number(state.capacities?.[name] || activeProject(state)?.capacity || 40); const ratio = Math.round(hours / Math.max(1, capacity) * 100); return `<article style="--member-index:${index};--load:${Math.min(100, ratio)}%" data-overload="${ratio > 100}"><span>${esc(name.slice(0, 2).toUpperCase())}</span><div><strong>${esc(name)}</strong><small>${hours}h cam kết · ${capacity}h capacity</small><i><b></b></i></div><b>${ratio}%</b></article>`; }).join("") || `<div class="work-galaxy-empty"><span>＋</span><strong>Chưa có thành viên</strong><small>Gán assignee cho task hoặc thêm capacity bên dưới.</small></div>`}</div>
          <form class="work-inline-form" data-work-capacity-form><label>Tên thành viên<input name="person" required maxlength="80" placeholder="Nguyễn Hoàng"></label><label>Capacity/chu kỳ<input name="capacity" type="number" min="1" max="1000" value="40"></label><button type="submit">Lưu capacity</button></form>
        </section>
        <section class="work-galaxy-panel"><header><div><span>MEETING → ACTION</span><h2>Buổi họp gần đây</h2></div><b>${(state.meetings || []).length}</b></header><div class="work-meeting-stream">${(state.meetings || []).slice(0, 6).map((meeting) => `<article><time>${esc(meeting.date || "Chưa đặt")}</time><div><strong>${esc(meeting.title)}</strong><small>${esc(meeting.attendees || "Chưa ghi người tham gia")} · ${extractMeetingActions(meeting).length} action rõ ràng</small></div><button type="button" data-planning-meeting-actions="${esc(meeting.id)}">Tách action</button></article>`).join("") || "<p>Chưa có meeting.</p>"}</div>
          <form class="work-stack-form" data-work-meeting-form><label>Tiêu đề<input name="title" required maxlength="160" placeholder="Weekly sync"></label><div><label>Ngày giờ<input name="date" type="datetime-local" required></label><label>Người tham gia<input name="attendees" maxlength="240"></label></div><label>Ghi chú<textarea name="notes" rows="4" maxlength="1200" placeholder="TODO: Chốt người phụ trách"></textarea></label><button type="submit">Lưu meeting</button></form>
        </section>
      </div>
      <section class="work-galaxy-panel work-action-items"><header><div><span>ACTION ITEMS</span><h2>Cam kết sau cuộc họp</h2></div><b>${(state.actionItems || []).filter((item) => item.status !== "done").length} mở</b></header><div>${(state.actionItems || []).map((item) => `<label><input type="checkbox" data-planning-action-done="${esc(item.id)}" ${item.status === "done" ? "checked" : ""}><span><strong>${esc(item.title)}</strong><small>${esc(item.assignee || "Chưa giao")} · ${esc(item.due || "Chưa đặt hạn")}</small></span></label>`).join("") || "<p>Chưa có action item.</p>"}</div></section>`;
  }

  function knowledgeAssetsMarkup(state) {
    return `<section class="work-page-intro" style="--page-color:#49e4ad;--page-accent:#b9f36a"><div><span>KNOWLEDGE & ASSETS</span><h1>Tri thức, tệp và công cụ cùng quỹ đạo</h1><p>Chín workspace cũ vẫn hoạt động độc lập, nay trở thành vệ tinh của Universal Work Project.</p></div><button type="button" data-work-route="/work/knowledge-center">Viết Wiki →</button></section>
      <section class="work-satellite-grid">${WORKSPACES.map((item, index) => { const [value, label] = workspaceMetric(item.id); return `<button type="button" data-work-route="${item.route}" data-workspace-card data-search-text="${esc(`${item.title} ${item.description} ${item.features.join(" ")}`.toLowerCase())}" style="--satellite-index:${index}"><span class="work-accent--${item.accent}">${item.icon}</span><div><small>${esc(item.label)}</small><strong>${esc(item.title)}</strong><p>${esc(item.description)}</p></div><b>${value}<small>${esc(label)}</small></b></button>`; }).join("")}</section><div data-workspace-empty class="work-galaxy-empty" hidden><strong>Không tìm thấy workspace.</strong></div>
      <div class="work-knowledge-grid">
        <section class="work-galaxy-panel work-files"><header><div><span>DEVICE VAULT</span><h2>Tệp cục bộ</h2></div><b>${read(FILE_META_KEY, []).length}</b></header><label data-work-dropzone><input type="file" data-work-file-input multiple><span>⇧</span><strong>Thả tệp hoặc bấm để chọn</strong><small>Lưu riêng trên thiết bị · tối đa 100 MB/tệp</small></label><div data-work-file-list><p>Đang đọc kho tệp...</p></div></section>
        <section class="work-galaxy-panel"><header><div><span>KNOWLEDGE STREAM</span><h2>Wiki gần đây</h2></div><b>${wikiState().articles.length}</b></header><div class="work-wiki-stream">${wikiState().articles.slice(0, 8).map((item) => `<button type="button" data-work-route="/work/knowledge-center"><span>K</span><div><strong>${esc(item.title)}</strong><small>${esc(item.category)} · ${(item.tags || []).map(esc).join(", ")}</small></div><i>→</i></button>`).join("")}</div></section>
      </div>`;
  }

  function automationLabMarkup(state) {
    const rules = state.automations || [];
    const runs = state.automationRuns || [];
    return `<section class="work-page-intro" style="--page-color:#ff9a62;--page-accent:#ffe16b"><div><span>AUTOMATION LAB</span><h1>Tự động hóa có Preview và lịch sử</h1><p>Dry run chỉ đánh giá dữ liệu cục bộ. Hành động ngoài website chỉ chạy khi có adapter được cấu hình và người dùng phê duyệt.</p></div><button type="button" data-work-route="/work/workflow-automation">Mở Workflow cũ →</button></section>
      <div class="work-automation-grid">
        <form class="work-galaxy-panel work-automation-builder" data-work-automation-form><header><div><span>RULE BUILDER</span><h2>Trigger → condition → action</h2></div><b>LOCAL</b></header><label>Tên quy tắc<input name="name" required maxlength="120" placeholder="Nhắc việc sắp quá hạn"></label><div><label>Trigger<select name="trigger"><option value="task-created">Task được tạo</option><option value="due-soon">Deadline còn 2 ngày</option><option value="status-changed">Trạng thái thay đổi</option><option value="form-response">Có phản hồi Form</option></select></label><label>Điều kiện<select name="condition"><option value="open">Task chưa hoàn thành</option><option value="high-priority">Ưu tiên cao</option><option value="unassigned">Chưa phân công</option><option value="always">Luôn đúng</option></select></label></div><label>Hành động<select name="action"><option value="create-inbox">Tạo mục trong Inbox</option><option value="create-task">Tạo task theo dõi</option><option value="mark-risk">Đánh dấu rủi ro</option><option value="adapter-notify">Gửi qua notification adapter</option></select></label><label class="work-check"><input type="checkbox" name="approval" checked><span>Yêu cầu phê duyệt trước hành động ngoài thiết bị</span></label><button type="submit">＋ Tạo quy tắc</button></form>
        <section class="work-galaxy-panel"><header><div><span>RULE ORBITS</span><h2>Quy tắc đang quản lý</h2></div><b>${rules.length}</b></header><div class="work-rule-list">${rules.map((rule) => `<article data-enabled="${Boolean(rule.enabled)}"><span>${rule.enabled ? "ON" : "OFF"}</span><div><strong>${esc(rule.name)}</strong><small>${esc(rule.trigger)} → ${esc(rule.condition)} → ${esc(rule.action)}</small></div><button type="button" data-work-automation-toggle="${esc(rule.id)}">${rule.enabled ? "Tắt" : "Bật"}</button><button type="button" data-work-automation-dry-run="${esc(rule.id)}">Dry run</button><button type="button" data-work-automation-duplicate="${esc(rule.id)}">Nhân bản</button></article>`).join("") || `<div class="work-galaxy-empty"><span>⚡</span><strong>Chưa có automation</strong><small>Tạo quy tắc đầu tiên bằng builder.</small></div>`}</div></section>
      </div>
      <section class="work-galaxy-panel work-run-history"><header><div><span>RUN HISTORY</span><h2>Lịch sử thực thi có thể kiểm tra</h2></div><b>${runs.length}</b></header><div>${runs.slice(0, 20).map((run) => `<article data-status="${esc(run.status)}"><span>${run.status === "success" ? "✓" : run.status === "failed" ? "!" : "◇"}</span><div><strong>${esc(run.ruleName)}</strong><small>${esc(run.message)} · ${new Date(run.createdAt).toLocaleString("vi-VN")}</small></div><b>${esc(run.mode)}</b>${run.status === "failed" ? `<button type="button" data-work-automation-retry="${esc(run.id)}">Retry</button>` : ""}</article>`).join("") || "<p>Chưa có lượt chạy. Dry run một quy tắc để kiểm tra điều kiện.</p>"}</div></section>`;
  }

  function portfolioMarkup(state) {
    const metrics = workMetrics(state);
    const risks = metrics.risks;
    const maxTasks = Math.max(1, ...state.projects.map((project) => state.tasks.filter((task) => task.projectId === project.id).length));
    return `<section class="work-page-intro" style="--page-color:#ffd76a;--page-accent:#ff8c63"><div><span>PORTFOLIO OBSERVATORY</span><h1>Quan sát danh mục bằng dữ liệu thật</h1><p>Sức khỏe, deadline, workload và velocity được suy ra từ task, estimate, dependency và milestone đã lưu.</p></div><button type="button" data-work-export>Xuất snapshot JSON</button></section>
      ${metricCardsMarkup(state)}
      <div class="work-portfolio-grid">
        <section class="work-galaxy-panel work-portfolio-map"><header><div><span>PROJECT CONSTELLATION</span><h2>Sức khỏe từng dự án</h2></div><b>${state.projects.length}</b></header><div>${state.projects.map((project, index) => { const tasks = state.tasks.filter((task) => task.projectId === project.id || task.project === project.id); const open = tasks.filter((task) => task.status !== "done").length; const overdue = tasks.filter((task) => task.status !== "done" && planningDaysUntil(task.due) < 0).length; const completion = tasks.length ? Math.round(tasks.filter((task) => task.status === "done").length / tasks.length * 100) : clamp(project.progress); return `<button type="button" data-work-select-project="${esc(project.id)}" style="--project:${esc(project.color || "#62ecf2")};--project-size:${Math.max(36, Math.round(tasks.length / maxTasks * 76))}px;--project-index:${index}"><span>${completion}%</span><div><strong>${esc(project.name)}</strong><small>${open} mở · ${overdue} quá hạn · ${Number(project.capacity || 40)}h capacity</small><i><b style="width:${completion}%"></b></i></div></button>`; }).join("")}</div></section>
        <section class="work-galaxy-panel work-risk-radar"><header><div><span>RISK RADAR</span><h2>Điểm cần chú ý</h2></div><b>${risks.length}</b></header><div>${risks.slice(0, 12).map((risk) => `<article data-level="${esc(risk.level)}"><span>${risk.level === "high" ? "!" : "•"}</span><div><strong>${esc(risk.title)}</strong><small>${esc(risk.reason)}</small></div><b>${esc(risk.type)}</b></article>`).join("") || `<div class="work-galaxy-empty"><span>✓</span><strong>Không phát hiện rủi ro</strong><small>Risk detector sẽ cập nhật khi dữ liệu thay đổi.</small></div>`}</div></section>
      </div>
      <section class="work-galaxy-panel work-velocity-panel"><header><div><span>VELOCITY & DELIVERY</span><h2>Khối lượng đã hoàn tất</h2></div><b>${metrics.velocity}% estimate</b></header><div><article><span>Estimate toàn bộ</span><strong>${metrics.estimated}h</strong></article><article><span>Đã hoàn tất</span><strong>${metrics.completedEstimate}h</strong></article><article><span>Task bị chặn</span><strong>${metrics.blocked}</strong></article><article><span>Meeting đã lưu</span><strong>${metrics.meetings}</strong></article></div></section>`;
  }

  function pageMarkup(state) {
    if (activeView === "projects-tasks") return taskWorkspaceMarkup(state);
    if (activeView === "roadmap-planning") return `<section class="work-page-intro" style="--page-color:#ff70bf;--page-accent:#ff9f74"><div><span>ROADMAP & PLANNING</span><h1>Từ mục tiêu đến chu kỳ thực thi</h1><p>Initiative, project, cycle, dependency, capacity, meeting và risk cùng một revision local-first.</p></div><button type="button" data-work-route="/work/portfolio-observatory">Xem portfolio →</button></section>${planningMarkup()}`;
    if (activeView === "team-orbit") return teamOrbitMarkup(state);
    if (activeView === "knowledge-assets") return knowledgeAssetsMarkup(state);
    if (activeView === "automation-lab") return automationLabMarkup(state);
    if (activeView === "portfolio-observatory") return portfolioMarkup(state);
    return missionControlMarkup(state);
  }

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

  function renderPlanningEnhancements() {
    const planning = host?.querySelector("[data-work-planning]");
    if (!planning) return;
    const state = planningState();
    const projectOptions = (state.projects || []).map((project) => `<option value="${esc(project.id)}">${esc(project.name)}</option>`).join("");
    const initiativeRows = (state.initiatives || []).map((item) => `<article><div><strong>${esc(item.name)}</strong><span>${esc(item.owner || "Chưa có owner")} · ${esc(item.target || "Chưa đặt mục tiêu")}</span></div><small>${(item.projectIds || []).length} project</small></article>`).join("") || "<p>Chưa có initiative. Initiative chỉ nhóm các project đã chọn.</p>";
    const cycleRows = (state.cycles || []).map((cycle) => { const capacity = cycleCapacity(state, cycle.id); return `<article class="work-cycle-row"><div><strong>${esc(cycle.name)}</strong><span>${esc(cycle.start || "—")} → ${esc(cycle.end || "—")} · ${capacity.taskCount} task</span></div><b class="${capacity.percent > 100 ? "is-over" : ""}">${capacity.committed}h / ${capacity.available}h</b><button type="button" data-planning-cycle-assign="${esc(cycle.id)}">Gán việc chưa xếp</button>${cycle.status !== "done" ? `<button type="button" data-planning-cycle-rollover="${esc(cycle.id)}">Rollover</button>` : ""}</article>`; }).join("") || "<p>Chưa có cycle.</p>";
    const planPane = planning.querySelector('[data-planning-pane="plan"]');
    planPane?.insertAdjacentHTML("beforeend", `<section class="work-planning__initiative"><form class="work-planning__card" data-planning-initiative-form><header><span>INITIATIVE</span><h3>Nhóm project theo mục tiêu</h3></header><label>Tên initiative<input name="name" required maxlength="140" placeholder="Ví dụ: Tăng trưởng Q3"></label><div class="work-planning__two"><label>Owner<input name="owner" maxlength="80"></label><label>Mục tiêu<input name="target" maxlength="160"></label></div><label>Projects<select name="projectIds" multiple size="4">${projectOptions}</select></label><button type="submit">＋ Tạo initiative</button></form><article class="work-planning__card"><header><span>INITIATIVE MAP</span><h3>Mục tiêu → project</h3></header><div class="work-initiative-list">${initiativeRows}</div></article></section><section class="work-planning__card work-cycle-control"><header><span>CYCLE CONTROL</span><h3>Capacity, assignment & rollover</h3><p>Rollover chỉ chuyển task chưa hoàn thành; task đã xong được giữ nguyên trong cycle cũ.</p></header><div class="work-cycle-list">${cycleRows}</div><small>${(state.cycleRolloverLog || []).length} lần rollover đã lưu trong revision local.</small></section>`);
    const meetingPane = planning.querySelector('[data-planning-pane="meeting"]');
    const meetingRows = (state.meetings || []).map((meeting) => `<article><div><strong>${esc(meeting.title)}</strong><span>${esc(meeting.date || "Chưa đặt ngày")} · ${extractMeetingActions(meeting).length} dòng action rõ ràng</span></div><button type="button" data-planning-meeting-actions="${esc(meeting.id)}">Tách action</button></article>`).join("") || "<p>Chưa có meeting để chuyển đổi.</p>";
    meetingPane?.insertAdjacentHTML("beforeend", `<section class="work-planning__card work-meeting-converter"><header><span>LOCAL PARSER</span><h3>Ghi chú → action items</h3><p>Chỉ chạy khi bạn bấm; nhận dòng bắt đầu bằng TODO:, ACTION: hoặc [ ]. Không gửi nội dung ra ngoài thiết bị.</p></header><div>${meetingRows}</div></section>`);
  }

  function render() {
    if (!host) return;
    const state = planningState();
    host.innerHTML = `<section class="work-center work-galaxy" data-work-active-view="${esc(activeView)}" data-work-theme="${esc(state.theme)}" data-work-effects="${esc(state.effects)}" aria-label="HH Work Galaxy">
      <div class="work-aurora work-aurora--galaxy" aria-hidden="true"><i></i><i></i><i></i><b></b><b></b><b></b></div>
      ${rootCrownMarkup(state)}
      ${galaxyNavMarkup(state)}
      ${commandMarkup()}
      <main class="work-galaxy-page">${pageMarkup(state)}</main>
      ${captureDialog()}
      <div class="work-toast" data-work-toast role="status" aria-live="polite"></div>
    </section>`;
    if (activeView === "roadmap-planning") renderPlanningEnhancements();
    bindRoot();
    updateClock();
    startFocusTicker();
    if (host.querySelector("[data-work-file-list]")) renderDeviceFiles();
  }

  function bindRoot() {
    const root = host?.querySelector(".work-center");
    if (!root) return;
    root.addEventListener("click", handleClick);
    root.addEventListener("input", handleInput);
    root.addEventListener("change", handleChange);
    root.addEventListener("submit", handleSubmit);
    const dropzone = root.querySelector("[data-work-dropzone]");
    if (dropzone) {
      ["dragenter", "dragover"].forEach((type) => dropzone.addEventListener(type, (event) => { event.preventDefault(); fileDragDepth += 1; dropzone.classList.add("is-dragging"); }));
      ["dragleave", "drop"].forEach((type) => dropzone.addEventListener(type, (event) => { event.preventDefault(); fileDragDepth = Math.max(0, fileDragDepth - 1); if (!fileDragDepth || type === "drop") dropzone.classList.remove("is-dragging"); if (type === "drop") saveFiles(event.dataTransfer?.files); }));
    }
  }

  function convertMeetingNotes(meetingId) {
    const state = planningState();
    const meeting = (state.meetings || []).find((item) => item.id === meetingId);
    if (!meeting) return showToast("Không tìm thấy meeting trên thiết bị.", "error");
    const titles = extractMeetingActions(meeting);
    if (!titles.length) return showToast("Không có dòng TODO:, ACTION: hoặc [ ] để chuyển đổi.", "error");
    const existing = new Set((state.actionItems || []).filter((item) => item.meetingId === meetingId).map((item) => String(item.title).toLocaleLowerCase("vi")));
    const additions = titles.filter((title) => !existing.has(title.toLocaleLowerCase("vi"))).map((title) => ({ id: uid("action"), title, assignee: "", due: "", meetingId, status: "todo", source: "meeting-note-local", createdAt: new Date().toISOString() }));
    if (!additions.length) return showToast("Các action rõ ràng đã được tạo trước đó.");
    writePlanning((current) => ({ ...current, actionItems: [...additions, ...(current.actionItems || [])] }));
    render();
    showToast(`Đã tạo ${additions.length} action item từ ghi chú cục bộ.`);
  }

  function updateTaskStatus(taskId, status) {
    if (!["todo", "doing", "review", "done"].includes(status)) return;
    writePlanning((state) => ({
      ...state,
      tasks: state.tasks.map((task) => task.id === taskId ? { ...task, status, column: status, updatedAt: new Date().toISOString() } : task)
    }));
    render();
    showToast(`Đã chuyển task sang “${statusLabel(status)}”.`);
  }

  function evaluateAutomation(rule, state) {
    const openTasks = (state.tasks || []).filter((task) => task.status !== "done");
    const matched = openTasks.filter((task) => {
      if (rule.condition === "high-priority") return ["cao", "high"].includes(String(task.priority || "").toLowerCase());
      if (rule.condition === "unassigned") return !task.assignee;
      if (rule.condition === "open") return task.status !== "done";
      return true;
    });
    return { matched: matched.length, sample: matched.slice(0, 3).map((task) => task.title) };
  }

  function dryRunAutomation(ruleId, mode = "dry-run") {
    const state = planningState();
    const rule = (state.automations || []).find((item) => item.id === ruleId);
    if (!rule) return showToast("Không tìm thấy automation.", "error");
    try {
      const result = evaluateAutomation(rule, state);
      const run = {
        id: uid("run"),
        ruleId: rule.id,
        ruleName: rule.name,
        mode,
        status: "success",
        matched: result.matched,
        message: `${result.matched} task khớp điều kiện; không chạy hành động ngoài thiết bị`,
        createdAt: new Date().toISOString()
      };
      writePlanning((current) => ({ ...current, automationRuns: [run, ...(current.automationRuns || [])].slice(0, 100) }));
      render();
      showToast(`Dry run hoàn tất: ${result.matched} task khớp.`);
    } catch (error) {
      const run = { id: uid("run"), ruleId: rule.id, ruleName: rule.name, mode, status: "failed", message: String(error.message || error).slice(0, 240), createdAt: new Date().toISOString() };
      writePlanning((current) => ({ ...current, automationRuns: [run, ...(current.automationRuns || [])].slice(0, 100) }));
      render();
      showToast("Dry run thất bại; đã ghi lịch sử.", "error");
    }
  }

  function handleClick(event) {
    if (event.target.closest("[data-work-continue]")) {
      const route = planningState().lastContext || "/work/projects-tasks";
      location.hash = `#${route === "/work" ? "/work/projects-tasks" : route}`;
      return;
    }
    const taskView = event.target.closest("[data-work-task-view]");
    if (taskView) { writePlanning((state) => ({ ...state, taskView: taskView.dataset.workTaskView })); render(); return; }
    if (event.target.closest("[data-work-save-view]")) {
      const state = planningState();
      const saved = { id: uid("view"), name: `${statusLabel(state.taskView)} · ${projectName(state, state.activeProjectId)}`, view: state.taskView, projectId: state.activeProjectId, createdAt: new Date().toISOString() };
      writePlanning((current) => ({ ...current, savedViews: [saved, ...(current.savedViews || [])].slice(0, 12) }));
      render();
      showToast("Đã lưu góc nhìn trên thiết bị.");
      return;
    }
    const applyView = event.target.closest("[data-work-apply-view]");
    if (applyView) {
      const saved = planningState().savedViews.find((item) => item.id === applyView.dataset.workApplyView);
      if (saved) writePlanning((state) => ({ ...state, taskView: saved.view, activeProjectId: saved.projectId || state.activeProjectId }));
      render();
      return;
    }
    const selectProject = event.target.closest("[data-work-select-project]");
    if (selectProject) {
      writePlanning((state) => ({ ...state, activeProjectId: selectProject.dataset.workSelectProject, lastContext: "/work/projects-tasks" }));
      location.hash = "#/work/projects-tasks";
      return;
    }
    if (event.target.closest("[data-work-export]")) { exportPlanning(); return; }
    const automationToggle = event.target.closest("[data-work-automation-toggle]");
    if (automationToggle) {
      writePlanning((state) => ({ ...state, automations: state.automations.map((rule) => rule.id === automationToggle.dataset.workAutomationToggle ? { ...rule, enabled: !rule.enabled, updatedAt: new Date().toISOString() } : rule) }));
      render();
      showToast("Đã cập nhật trạng thái automation.");
      return;
    }
    const automationDryRun = event.target.closest("[data-work-automation-dry-run]");
    if (automationDryRun) { dryRunAutomation(automationDryRun.dataset.workAutomationDryRun); return; }
    const automationDuplicate = event.target.closest("[data-work-automation-duplicate]");
    if (automationDuplicate) {
      writePlanning((state) => {
        const source = state.automations.find((rule) => rule.id === automationDuplicate.dataset.workAutomationDuplicate);
        if (!source) return state;
        return { ...state, automations: [{ ...source, id: uid("automation"), name: `${source.name} · bản sao`, enabled: false, createdAt: new Date().toISOString() }, ...state.automations] };
      });
      render();
      showToast("Đã nhân bản quy tắc ở trạng thái tắt.");
      return;
    }
    const automationRetry = event.target.closest("[data-work-automation-retry]");
    if (automationRetry) {
      const run = planningState().automationRuns.find((item) => item.id === automationRetry.dataset.workAutomationRetry);
      if (run) dryRunAutomation(run.ruleId, "retry-dry-run");
      return;
    }
    const planningTab = event.target.closest("[data-planning-tab]");
    if (planningTab) { const planning = planningTab.closest("[data-work-planning]"); planning?.querySelectorAll("[data-planning-tab]").forEach((item) => { const active = item === planningTab; item.classList.toggle("is-active", active); item.setAttribute("aria-selected", String(active)); }); planning?.querySelectorAll("[data-planning-pane]").forEach((pane) => pane.classList.toggle("is-active", pane.dataset.planningPane === planningTab.dataset.planningTab)); return; }
    if (event.target.closest("[data-planning-export]")) { exportPlanning(); return; }
    if (event.target.closest("[data-planning-sync]")) { planningSync(); return; }
    const cycleAssign = event.target.closest("[data-planning-cycle-assign]");
    if (cycleAssign) { writePlanning((state) => assignOpenTasksToCycle(state, cycleAssign.dataset.planningCycleAssign)); render(); showToast("Đã gán task chưa xếp vào cycle đã chọn."); return; }
    const cycleRollover = event.target.closest("[data-planning-cycle-rollover]");
    if (cycleRollover) { let result; writePlanning((state) => { result = rolloverCycle(state, cycleRollover.dataset.planningCycleRollover); return result.state; }); render(); showToast(`Đã rollover ${result?.moved || 0} task chưa hoàn thành.`); return; }
    const meetingActions = event.target.closest("[data-planning-meeting-actions]");
    if (meetingActions) { convertMeetingNotes(meetingActions.dataset.planningMeetingActions); return; }
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
    if (event.target.matches("[data-work-task-query]")) {
      const value = event.target.value;
      clearTimeout(taskSearchTimer);
      taskSearchTimer = setTimeout(() => {
        writePlanning((state) => ({ ...state, taskQuery: value }));
        render();
        const input = host?.querySelector("[data-work-task-query]");
        input?.focus({ preventScroll: true });
        input?.setSelectionRange(value.length, value.length);
      }, 220);
    }
  }

  function handleChange(event) {
    if (event.target.matches("[data-work-file-input]")) { saveFiles(event.target.files); event.target.value = ""; }
    if (event.target.matches("[data-capture-type]")) updateCaptureFields(event.target.value);
    if (event.target.matches("[data-work-theme]")) { writePlanning((state) => ({ ...state, theme: event.target.value })); render(); return; }
    if (event.target.matches("[data-work-effects]")) { writePlanning((state) => ({ ...state, effects: event.target.value })); render(); return; }
    if (event.target.matches("[data-work-active-project]")) { writePlanning((state) => ({ ...state, activeProjectId: event.target.value })); render(); return; }
    if (event.target.matches("[data-work-task-status]")) { updateTaskStatus(event.target.dataset.workTaskStatus, event.target.value); return; }
    if (event.target.matches("[data-focus-minutes]")) { const state = workState(); state.focusMinutes = Number(event.target.value); state.focusRemaining = state.focusMinutes * 60; state.focusRunning = false; state.focusEnd = 0; write(WORK_KEY, state); render(); }
    if (event.target.matches("[data-planning-action-done]")) { const id = event.target.dataset.planningActionDone; writePlanning((state) => ({ ...state, actionItems: state.actionItems.map((item) => item.id === id ? { ...item, status: event.target.checked ? "done" : "todo" } : item) })); render(); }
  }

  function formValue(form, name) { return String(form.elements[name]?.value || "").trim(); }
  function selectedValues(form, name) { return [...(form.elements[name]?.selectedOptions || [])].map((option) => option.value).filter(Boolean); }
  function handleSubmit(event) {
    const form = event.target.closest("form");
    if (!form || !form.closest(".work-center")) return;
    if (form.matches("[data-work-universal-form]")) {
      event.preventDefault();
      const name = formValue(form, "name"); if (!name) return;
      writePlanning((state) => ({ ...state, universalProject: { ...state.universalProject, name, goal: formValue(form, "goal"), owner: formValue(form, "owner"), updatedAt: new Date().toISOString() } }));
      render();
      showToast("Đã cập nhật Universal Work Project.");
      return;
    }
    if (form.matches("[data-work-automation-form]")) {
      event.preventDefault();
      const name = formValue(form, "name"); if (!name) return;
      const rule = { id: uid("automation"), name, trigger: formValue(form, "trigger"), condition: formValue(form, "condition"), action: formValue(form, "action"), approval: Boolean(form.elements.approval?.checked), enabled: true, createdAt: new Date().toISOString() };
      writePlanning((state) => ({ ...state, automations: [rule, ...(state.automations || [])] }));
      render();
      showToast(`Đã tạo automation “${name}”.`);
      return;
    }
    if (form.matches("[data-work-capacity-form]")) {
      event.preventDefault();
      const person = formValue(form, "person"); if (!person) return;
      const capacity = Math.max(1, Number(formValue(form, "capacity") || 40));
      writePlanning((state) => ({ ...state, capacities: { ...state.capacities, [person]: capacity }, members: state.members.some((item) => item.name === person) ? state.members : [...state.members, { id: uid("member"), name: person, role: "Member", createdAt: new Date().toISOString() }] }));
      render();
      showToast(`Đã lưu capacity ${capacity}h cho ${person}.`);
      return;
    }
    if (form.matches("[data-work-meeting-form]")) {
      event.preventDefault();
      const title = formValue(form, "title"); if (!title) return;
      const meeting = { id: uid("meeting"), title, date: formValue(form, "date"), attendees: formValue(form, "attendees"), notes: formValue(form, "notes"), createdAt: new Date().toISOString() };
      writePlanning((state) => ({ ...state, meetings: [meeting, ...(state.meetings || [])] }));
      render();
      showToast(`Đã lưu meeting “${title}”.`);
      return;
    }
    if (!form.closest("[data-work-planning]")) return;
    event.preventDefault();
    const state = planningState();
    if (form.matches("[data-planning-initiative-form]")) {
      const name = formValue(form, "name"); if (!name) return;
      const projectIds = selectedValues(form, "projectIds");
      const initiative = { id: uid("initiative"), name, owner: formValue(form, "owner"), target: formValue(form, "target"), projectIds, status: "active", createdAt: new Date().toISOString() };
      writePlanning((current) => ({ ...current, initiatives: [initiative, ...(current.initiatives || [])], projects: current.projects.map((project) => projectIds.includes(project.id) ? { ...project, initiativeId: initiative.id } : project) })); render(); showToast(`Đã tạo initiative “${name}”.`); return;
    }
    if (form.matches("[data-planning-project-form]")) {
      const name = formValue(form, "name"); if (!name) return;
      const project = { id: uid("project"), name, owner: formValue(form, "owner"), capacity: Math.max(1, Number(formValue(form, "capacity") || 40)), start: formValue(form, "start") || day(), due: formValue(form, "due"), status: "active", progress: 0, priority: "normal", description: "", color: ["#62e9f2", "#ff5dc8", "#f5db6d", "#8d7cff"][state.projects.length % 4] };
      writePlanning((current) => ({ ...current, projects: [project, ...(current.projects || [])] })); render(); showToast(`Đã tạo project “${name}”.`); return;
    }
    if (form.matches("[data-planning-task-form]")) {
      const title = formValue(form, "title"); if (!title) return;
      const projectId = formValue(form, "projectId") || state.projects[0]?.id;
      const activeCycle = (state.cycles || []).find((cycle) => cycle.status !== "done");
      const task = { id: uid("task"), title, projectId, project: projectId, cycleId: activeCycle?.id || "", assignee: formValue(form, "assignee"), due: formValue(form, "due"), estimate: Math.max(.25, Number(formValue(form, "estimate") || 1)), dependsOn: selectedValues(form, "dependsOn"), status: "todo", column: "todo", priority: "normal", createdAt: new Date().toISOString() };
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
    const results = host?.querySelector("[data-work-search-results]");
    if (!results) return;
    const cards = host.querySelectorAll("[data-workspace-card]");
    cards.forEach((card) => { card.hidden = Boolean(query) && !card.dataset.searchText.includes(query); });
    const workspaceEmpty = host.querySelector("[data-workspace-empty]");
    if (workspaceEmpty) workspaceEmpty.hidden = [...cards].some((card) => !card.hidden);
    if (!query) { results.hidden = true; results.innerHTML = ""; return; }
    const projects = planningState();
    const wiki = wikiState();
    const items = [
      ...WORK_PLANETS.map((item) => ({ type: "Hành tinh", title: item.title, detail: item.description, route: item.route, key: `${item.title} ${item.subtitle} ${item.description}` })),
      ...WORKSPACES.map((item) => ({ type: "Workspace", title: item.title, detail: item.description, route: item.route, key: `${item.title} ${item.description} ${item.features.join(" ")}` })),
      ...projects.projects.map((item) => ({ type: "Dự án", title: item.name, detail: `${item.progress}% · ${item.status}`, route: "/work/projects-tasks", key: `${item.name} ${item.description} ${item.status}` })),
      ...projects.tasks.map((item) => ({ type: "Công việc", title: item.title, detail: `${item.priority || "Thường"} · ${statusLabel(item.status)}`, route: "/work/projects-tasks", key: `${item.title} ${item.priority} ${item.assignee || ""}` })),
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
    const state = planningState();
    const task = state.tasks.find((item) => item.id === id);
    if (!task) return;
    const status = task.status === "done" ? "todo" : "done";
    writePlanning((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === id ? { ...item, status, column: status, updatedAt: new Date().toISOString() } : item) }));
    const legacy = projectState();
    legacy.activity.unshift(`${status === "done" ? "Hoàn thành" : "Mở lại"} “${task.title}”`);
    write(PROJECT_KEY, legacy);
    render();
  }

  function deleteTask(id) {
    const state = planningState();
    const task = state.tasks.find((item) => item.id === id);
    writePlanning((current) => ({ ...current, tasks: current.tasks.filter((item) => item.id !== id) }));
    if (task) {
      const legacy = projectState();
      legacy.activity.unshift(`Xóa công việc “${task.title}”`);
      write(PROJECT_KEY, legacy);
    }
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
    if (!("indexedDB" in window)) return showToast("Trình duyệt này không hỗ trợ Device Vault. Hãy dùng trình duyệt Chromium mới.", "error");
    showToast(`Đang lưu ${accepted.length} tệp trên thiết bị...`);
    try {
      const meta = read(FILE_META_KEY, []);
      for (const file of accepted) {
        const id = uid("file");
        await databaseAction("readwrite", (store) => store.put({ id, name: file.name, type: file.type || "application/octet-stream", size: file.size, createdAt: new Date().toISOString(), blob: file }));
        meta.unshift({ id, name: file.name, type: file.type || "Tệp", size: file.size, createdAt: new Date().toISOString() });
      }
      write(FILE_META_KEY, meta.slice(0, 100));
      await renderDeviceFiles();
      showToast(`Đã lưu ${accepted.length} tệp. Dữ liệu không rời thiết bị.`);
    } catch (error) {
      showToast(`Không thể lưu tệp: ${String(error.message || error)}`, "error");
    }
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

  function mount(target, options = {}) {
    unmount();
    host = target;
    const requestedView = String(options.view || "mission-control");
    activeView = WORK_PLANETS.some((planet) => planet.id === requestedView) ? requestedView : "mission-control";
    if (activeView !== "mission-control") {
      const state = planningState();
      const route = currentWorkRoute();
      if (state.lastContext !== route) writePlanning({ ...state, lastContext: route });
    }
    render();
  }

  function unmount() {
    clearInterval(clockTimer);
    clearInterval(focusTimer);
    clearTimeout(taskSearchTimer);
    clockTimer = 0;
    focusTimer = 0;
    taskSearchTimer = 0;
    fileDragDepth = 0;
    if (host) host.replaceChildren();
    host = null;
  }

  window.HHWorkCenter = {
    mount,
    unmount,
    refresh: render,
    openCapture,
    supports: (view) => WORK_PLANETS.some((planet) => planet.id === view),
    views: Object.freeze(Object.fromEntries(WORK_PLANETS.map((planet) => [planet.id, planet]))),
    planning: Object.freeze({ normalizePlanning, cycleCapacity, assignOpenTasksToCycle, rolloverCycle, extractMeetingActions, detectPlanningRisks, workMetrics, evaluateAutomation })
  };
})();
