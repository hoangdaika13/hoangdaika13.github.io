(function (global, factory) {
  "use strict";
  const api = factory(global || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (global) global.HHHomeGalaxyOperations = api;
  if (global?.document) api.autoMount();
})(typeof globalThis !== "undefined" ? globalThis : this, function createGalaxyOperations(global) {
  "use strict";

  const VERSION = "3.0.0";
  const KEYS = Object.freeze({
    todos: "hh.command-center.todos.v2",
    notes: "hh.dashboard.sticky-notes.v1",
    files: "hh.command-center.files.v1",
    projects: "hh-project-center",
    planning: "hh-work-center-v2",
    orchestrator: "hh.platform.orchestrator.v2",
    activity: "hh.home.galaxy.activity.v2",
    ai: "hh-ai-center-advanced-v1",
    creative: "hh.creative-os.v1",
    communication: "hh.communication.intelligence.v1",
    health: "hh.home.health.samples.v1",
    recent: "hh.app-shell.recent",
    selection: "hh.home.galaxy.selection.v1"
  });
  const PLANET_ROUTES = Object.freeze({
    creative: "/create/ai-center",
    work: "/work",
    media: "/media-design",
    dev: "/dev-tools",
    communication: "/communication",
    learning: "/learn",
    analytics: "/analytics",
    system: "/settings"
  });
  const FILTERS = Object.freeze([
    ["all", "Tất cả"],
    ["creative", "AI"],
    ["work", "Công việc"],
    ["dev", "Deployment"],
    ["communication", "Giao tiếp"],
    ["system", "Hệ thống"]
  ]);
  const instances = new WeakMap();
  let autoObserver = null;

  const asArray = (value) => Array.isArray(value) ? value : [];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const text = (value, limit = 240) => String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[character]));
  const dateValue = (value) => {
    const parsed = new Date(value || 0).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const day = (value = Date.now()) => new Date(value).toISOString().slice(0, 10);
  const uid = (prefix) => `${prefix}-${global.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
  const read = (key, fallback) => {
    try {
      const parsed = JSON.parse(global.localStorage?.getItem?.(key) || "null");
      return parsed == null ? fallback : parsed;
    } catch { return fallback; }
  };
  const write = (key, value) => {
    try { global.localStorage?.setItem?.(key, JSON.stringify(value)); return true; }
    catch { return false; }
  };
  const relative = (value) => {
    const elapsed = Math.max(0, Date.now() - dateValue(value));
    if (elapsed < 60_000) return "Vừa xong";
    if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} phút trước`;
    if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} giờ trước`;
    return new Date(value).toLocaleDateString("vi-VN");
  };
  const routeForPlanet = (id) => PLANET_ROUTES[id] || "/home";
  const taskDone = (task) => task?.completed === true || ["done", "completed"].includes(String(task?.status || task?.column || "").toLowerCase());
  const taskDue = (task) => text(task?.deadline || task?.due || task?.dueAt, 20).slice(0, 10);
  const projectName = (project) => text(project?.name || project?.title, 100) || "Dự án chưa đặt tên";
  const emit = (name, payload = {}) => {
    try {
      if (global.HHEventBus?.emit) global.HHEventBus.emit(name, payload);
      else global.dispatchEvent?.(new CustomEvent("hh:event", { detail: { eventName: name, payload, meta: { timestamp: Date.now() } } }));
    } catch {}
  };

  function uniqueById(items) {
    const found = new Set();
    return items.filter((item) => {
      const id = text(item?.id, 100);
      if (!id || found.has(id)) return false;
      found.add(id);
      return true;
    });
  }

  function projectSnapshot() {
    const legacy = read(KEYS.projects, {});
    const planning = read(KEYS.planning, {});
    const projects = uniqueById([...asArray(planning.projects), ...asArray(legacy.projects)]);
    const tasks = uniqueById([...asArray(planning.tasks), ...asArray(legacy.tasks)]);
    return {
      activeProjectId: text(planning.activeProjectId || legacy.activeProject || legacy.activeProjectId, 100),
      projects,
      tasks
    };
  }

  function commandSnapshot() {
    const today = day();
    const todos = asArray(read(KEYS.todos, []));
    const notes = asArray(read(KEYS.notes, []));
    const projects = projectSnapshot();
    const orchestrator = read(KEYS.orchestrator, {});
    const jobs = asArray(orchestrator.jobs);
    const open = todos.filter((item) => !taskDone(item));
    const overdue = open.filter((item) => taskDue(item) && taskDue(item) < today);
    const todayTasks = open.filter((item) => taskDue(item) === today);
    const latestNote = [...notes].sort((a, b) => dateValue(b.updatedAt || b.createdAt || b.id) - dateValue(a.updatedAt || a.createdAt || a.id))[0] || null;
    const activeProject = projects.projects.find((item) => String(item.id) === projects.activeProjectId)
      || projects.projects.find((item) => !["done", "completed", "archived"].includes(String(item.status || "").toLowerCase()))
      || null;
    const activeJobs = jobs.filter((item) => ["queued", "running", "waiting"].includes(item?.state));
    const failedJobs = jobs.filter((item) => item?.state === "failed");
    return { today, todos, open, overdue, todayTasks, notes, latestNote, projects, activeProject, jobs, activeJobs, failedJobs };
  }

  function healthSnapshot() {
    const history = read(KEYS.health, {});
    const latest = Object.entries(history?.endpoints || {}).map(([id, samples]) => ({ id, ...(asArray(samples).at(-1) || {}) }));
    const slowest = [...latest].sort((a, b) => Number(b.latency || 0) - Number(a.latency || 0))[0] || null;
    return {
      latest,
      slowest,
      slow: Number(slowest?.latency || 0) > 1200,
      online: latest.filter((item) => item.state === "online").length,
      total: latest.length
    };
  }

  function aiRunningCount() {
    const ai = read(KEYS.ai, {});
    const creative = read(KEYS.creative, {});
    const orchestrator = read(KEYS.orchestrator, {});
    const statuses = new Set(["queued", "running", "processing", "waiting"]);
    const aiRuns = asArray(ai.runs).filter((item) => statuses.has(item?.status)).length;
    const creativeRuns = asArray(creative.runs).filter((item) => statuses.has(item?.status)).length;
    const jobs = asArray(orchestrator.jobs).filter((item) => statuses.has(item?.state) && /ai|creative|prompt/i.test(`${item?.type || ""} ${item?.area || ""}`)).length;
    return aiRuns + creativeRuns + jobs;
  }

  function statusSnapshot(instance) {
    const command = commandSnapshot();
    const communication = read(KEYS.communication, {});
    const activities = asArray(read(KEYS.activity, []));
    const health = healthSnapshot();
    const unread = asArray(communication.notifications).filter((item) => item && !item.read).length;
    const deployment = activities.find((item) => /deployment|deploy/i.test(`${item?.type || ""} ${item?.text || ""}`));
    const aiRunning = aiRunningCount();
    const poorVitals = instance.shell.querySelectorAll('[data-hgm-widget="vitals"].is-unsupported').length
      ? null
      : /cần cải thiện|poor/i.test(instance.shell.querySelector('[data-hgm-widget="vitals"]')?.innerText || "");
    return [
      { id: "ai", icon: "✦", label: "AI", value: aiRunning ? `${aiRunning} đang chạy` : "Không chạy", route: "/create/ai-center", tone: "#ff59d6", active: aiRunning > 0 },
      { id: "today", icon: "□", label: "Hôm nay", value: `${command.todayTasks.length} task`, route: "/work", tone: "#baff62", active: command.todayTasks.length > 0 },
      { id: "messages", icon: "◌", label: "Tin nhắn", value: `${unread} chưa đọc`, route: "/communication", tone: "#67efbd", active: unread > 0 },
      { id: "deploy", icon: "↥", label: "Deploy", value: deployment ? relative(deployment.createdAt) : "Chưa có sự kiện", route: "/dev-tools", tone: deployment?.type === "deployment-failed" ? "#ff704d" : "#58f3ff", active: Boolean(deployment) },
      { id: "endpoint", icon: "↯", label: "Endpoint", value: health.slow ? `${Math.round(health.slowest.latency)} ms` : health.total ? `${health.online}/${health.total} ổn` : "Chưa đo", route: "/analytics", tone: health.slow ? "#ff914d" : "#ffbd5a", active: health.slow },
      { id: "vitals", icon: "V", label: "Web Vitals", value: poorVitals == null ? "Không hỗ trợ" : poorVitals ? "Cần xem" : "Ổn định", route: "/analytics", tone: "#a986ff", active: poorVitals === true }
    ];
  }

  function taskStateClass(task, today = day()) {
    if (taskDone(task)) return "is-done";
    const due = taskDue(task);
    if (due && due < today) return "is-overdue";
    if (due && due <= day(Date.now() + 2 * 86_400_000)) return "is-due";
    return "is-open";
  }

  function portalMarkup(snapshot) {
    const lastNote = snapshot.latestNote ? text(snapshot.latestNote.text || snapshot.latestNote.title, 120) : "Chưa có ghi chú gần đây";
    const project = snapshot.activeProject ? projectName(snapshot.activeProject) : "Chưa có dự án đang thực hiện";
    const projectProgress = snapshot.activeProject ? `${clamp(snapshot.activeProject.progress, 0, 100)}%` : "—";
    const jobText = snapshot.activeJobs.length || snapshot.failedJobs.length
      ? `${snapshot.activeJobs.length} đang xử lý · ${snapshot.failedJobs.length} lỗi`
      : "Chưa có tác vụ nền";
    return `<section class="hgo-command${snapshot.overdue.length ? " has-overdue" : ""}" data-hgo-command aria-labelledby="hgoCommandTitle">
      <div class="hgo-command-visual" aria-hidden="true"><i></i><b></b><span>H</span><em></em></div>
      <div class="hgo-command-copy">
        <span class="hgo-eyebrow"><i></i> QUANTUM COMMAND GATE · REAL WORKSPACE</span>
        <h2 id="hgoCommandTitle">Command Center</h2>
        <p>${snapshot.overdue.length ? `${snapshot.overdue.length} task đang quá hạn và cần xử lý.` : snapshot.open.length ? `${snapshot.open.length} task đang mở trong Todo Workspace.` : "Chưa có công việc gần đây."}</p>
        <div class="hgo-command-metrics">
          <article><span>ĐANG MỞ</span><strong>${snapshot.open.length}</strong><small>${snapshot.todayTasks.length} đến hạn hôm nay</small></article>
          <article class="${snapshot.overdue.length ? "is-alert" : ""}"><span>QUÁ HẠN</span><strong>${snapshot.overdue.length}</strong><small>${snapshot.overdue.length ? "Cần ưu tiên" : "Không có cảnh báo"}</small></article>
          <article><span>DỰ ÁN HIỆN TẠI</span><strong>${esc(projectProgress)}</strong><small>${esc(project)}</small></article>
          <article class="${snapshot.failedJobs.length ? "is-alert" : ""}"><span>BACKGROUND JOBS</span><strong>${snapshot.activeJobs.length}</strong><small>${esc(jobText)}</small></article>
        </div>
        <div class="hgo-command-context">
          <span><i>N</i><b>Ghi chú mới nhất</b><em>${esc(lastNote)}</em></span>
          <span><i>P</i><b>Dự án đang thực hiện</b><em>${esc(project)}</em></span>
        </div>
        <div class="hgo-command-actions">
          <button type="button" data-hgo-capture="task">＋ Tạo task</button>
          <button type="button" data-hgo-capture="note">N Tạo ghi chú</button>
          <button type="button" data-hgo-continue>▷ Tiếp tục công việc</button>
          <button type="button" class="is-primary" data-hgo-route="/work">Mở Command Center →</button>
        </div>
        <form class="hgo-capture" data-hgo-capture-form hidden>
          <label><span data-hgo-capture-label>Tạo nhanh</span><input data-hgo-capture-input maxlength="500" autocomplete="off" required></label>
          <button type="submit">Lưu vào workspace</button><button type="button" data-hgo-capture-close>Hủy</button>
        </form>
      </div>
      <div class="hgo-command-tasks" data-hgo-command-tasks>
        <header><span>TASK SIGNALS</span><small>Đánh dấu hoàn thành ngay tại đây</small></header>
        ${snapshot.open.length ? snapshot.open.slice(0, 4).map((task) => `<label class="${taskStateClass(task)}"><input type="checkbox" data-hgo-complete-task="${esc(task.id)}"><i></i><span><b>${esc(text(task.title, 110))}</b><small>${esc(taskDue(task) || "Không deadline")} · ${esc(text(task.category || task.priority || "Công việc", 40))}</small></span></label>`).join("") : '<p class="hgo-empty">Chưa có công việc gần đây.</p>'}
      </div>
    </section>`;
  }

  function renderPortal(instance) {
    if (!instance.portal?.isConnected) return;
    if (instance.portal?.querySelector("[data-hgo-capture-form]:not([hidden])")) return;
    const snapshot = commandSnapshot();
    instance.portal.outerHTML = portalMarkup(snapshot);
    instance.portal = instance.shell.querySelector("[data-hgo-command]");
    instance.shell.classList.toggle("hgo-has-overdue", snapshot.overdue.length > 0);
  }

  function workMapData() {
    const snapshot = projectSnapshot();
    const projects = snapshot.projects.slice(0, 6);
    const projectIds = new Set(projects.map((item) => String(item.id)));
    const tasks = snapshot.tasks.filter((item) => projectIds.has(String(item.projectId || item.project))).slice(0, 20);
    const projectPositions = new Map();
    const taskPositions = new Map();
    projects.forEach((project, index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / Math.max(1, projects.length);
      projectPositions.set(String(project.id), { x: 500 + Math.cos(angle) * 290, y: 300 + Math.sin(angle) * 210 });
    });
    projects.forEach((project) => {
      const related = tasks.filter((task) => String(task.projectId || task.project) === String(project.id));
      const origin = projectPositions.get(String(project.id));
      related.forEach((task, index) => {
        const angle = index * Math.PI * 2 / Math.max(1, related.length);
        taskPositions.set(String(task.id), { x: origin.x + Math.cos(angle) * 72, y: origin.y + Math.sin(angle) * 58 });
      });
    });
    return { ...snapshot, projects, tasks, projectPositions, taskPositions };
  }

  function mapMarkup() {
    const data = workMapData();
    if (!data.projects.length) {
      return `<section class="hgo-work-map" data-hgo-map aria-labelledby="hgoMapTitle"><header><div><span>WORK GALAXY MAP</span><h2 id="hgoMapTitle">Bản đồ thiên hà công việc</h2><p>Project Center chưa có dữ liệu được lưu.</p></div><button type="button" data-hgo-route="/work/project-center">Tạo dự án đầu tiên</button></header><div class="hgo-map-empty"><i>✦</i><strong>Chưa có cụm sao dự án</strong><p>Khi bạn tạo project và dependency thật, chúng sẽ xuất hiện tại đây.</p></div></section>`;
    }
    const projectLines = data.tasks.map((task) => {
      const from = data.projectPositions.get(String(task.projectId || task.project));
      const to = data.taskPositions.get(String(task.id));
      return from && to ? `<line class="is-project-link" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"></line>` : "";
    }).join("");
    const dependencyLines = data.tasks.flatMap((task) => asArray(task.dependsOn).map((dependencyId) => {
      const from = data.taskPositions.get(String(dependencyId));
      const to = data.taskPositions.get(String(task.id));
      return from && to ? `<line class="is-dependency" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"></line>` : "";
    })).join("");
    const projectNodes = data.projects.map((project, index) => {
      const position = data.projectPositions.get(String(project.id));
      const progress = clamp(project.progress, 0, 100);
      return `<button type="button" class="hgo-project-star" data-hgo-project="${esc(project.id)}" data-hgo-route="/work/project-center" style="--x:${position.x / 10}%;--y:${position.y / 6}%;--star:${esc(project.color || ["#58f3ff", "#ff59d6", "#baff62", "#a986ff"][index % 4])}" aria-label="Mở dự án ${esc(projectName(project))}">
        <i><b>${esc(projectName(project).slice(0, 2).toUpperCase())}</b><em></em></i><strong>${esc(projectName(project))}</strong><small>${progress}% · ${esc(text(project.status || "Đang thực hiện", 40))}</small>
      </button>`;
    }).join("");
    const taskNodes = data.tasks.map((task) => {
      const position = data.taskPositions.get(String(task.id));
      const state = taskStateClass(task);
      return `<button type="button" class="hgo-task-star ${state}" data-hgo-task="${esc(task.id)}" data-hgo-project="${esc(task.projectId || task.project)}" data-hgo-route="/work/project-center" style="--x:${position.x / 10}%;--y:${position.y / 6}%" aria-label="${esc(text(task.title, 100))}: ${state === "is-done" ? "đã hoàn thành" : state === "is-overdue" ? "quá hạn" : state === "is-due" ? "sắp đến hạn" : "đang mở"}"><i></i><span>${esc(text(task.title, 58))}</span></button>`;
    }).join("");
    return `<section class="hgo-work-map" data-hgo-map aria-labelledby="hgoMapTitle">
      <header><div><span>WORK GALAXY MAP · ${data.projects.length} PROJECT</span><h2 id="hgoMapTitle">Bản đồ thiên hà công việc</h2><p>Cụm sao, vệ tinh và dependency được dựng từ Project Center.</p></div><div class="hgo-map-legend"><span class="is-done">Hoàn thành</span><span class="is-due">Sắp đến hạn</span><span class="is-overdue">Quá hạn</span></div></header>
      <div class="hgo-map-canvas">
        <svg viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">${projectLines}${dependencyLines}</svg>
        <div class="hgo-map-core" aria-hidden="true"><span>WORK</span><i></i></div>
        ${projectNodes}${taskNodes}
      </div>
      <footer><span>Đường liền: task thuộc project</span><span>Đường xung: dependency thật</span><button type="button" data-hgo-route="/work/project-center">Mở Project Center →</button></footer>
    </section>`;
  }

  function renderMap(instance) {
    if (!instance.map?.isConnected) return;
    instance.map.outerHTML = mapMarkup();
    instance.map = instance.shell.querySelector("[data-hgo-map]");
  }

  function ringMarkup(instance) {
    const statuses = statusSnapshot(instance);
    return `<div class="hgo-status-ring" data-hgo-status-ring aria-label="Cosmic Status Ring">${statuses.map((item, index) => `<button type="button" class="${item.active ? "is-active" : ""}" data-hgo-route="${item.route}" style="--ring:${item.tone};--ring-index:${index}" aria-label="${esc(`${item.label}: ${item.value}`)}"><span>${item.icon}</span><b>${esc(item.label)}</b><small>${esc(item.value)}</small></button>`).join("")}</div>`;
  }

  function renderRing(instance) {
    const current = instance.shell.querySelector("[data-hgo-status-ring]");
    if (current) current.outerHTML = ringMarkup(instance);
    else instance.shell.querySelector(".hgm-solar")?.insertAdjacentHTML("beforeend", ringMarkup(instance));
  }

  function categoryForActivity(item) {
    const planet = String(item?.planet || "");
    const type = String(item?.type || "");
    if (planet === "creative" || /ai/.test(type)) return "creative";
    if (planet === "work" || /task|project|note/.test(type)) return "work";
    if (planet === "dev" || /deploy/.test(type)) return "dev";
    if (planet === "communication" || /message|realtime/.test(type)) return "communication";
    return "system";
  }

  function activityTone(item) {
    if (/failed|error|warning|offline/.test(item?.type || "")) return "error";
    if (/completed|ready|online|success/.test(item?.type || "")) return "success";
    if (/running|created|updated/.test(item?.type || "")) return "active";
    return "neutral";
  }

  function timelineMarkup(instance) {
    const all = asArray(read(KEYS.activity, []));
    const visible = all.filter((item) => instance.timelineFilter === "all" || categoryForActivity(item) === instance.timelineFilter).slice(0, 18);
    return `<section class="hgo-timeline" data-hgo-timeline aria-labelledby="hgoTimelineTitle">
      <header><div><span>GALAXY TIMELINE · EVENT BUS</span><h2 id="hgoTimelineTitle">Dòng thời gian vũ trụ</h2><p>Chỉ hiển thị hoạt động đã thực sự được module ghi nhận.</p></div><nav aria-label="Lọc hoạt động">${FILTERS.map(([id, label]) => `<button type="button" data-hgo-filter="${id}" aria-pressed="${instance.timelineFilter === id}">${label}</button>`).join("")}</nav></header>
      <div class="hgo-timeline-list">${visible.length ? visible.map((item) => {
        const tone = activityTone(item);
        return `<article class="is-${tone} ${item.read ? "is-read" : ""}">
          <i><b></b></i><time datetime="${esc(item.createdAt)}">${esc(relative(item.createdAt))}</time>
          <div><small>${esc(text(item.source || categoryForActivity(item), 70))}</small><strong>${esc(text(item.text, 160))}</strong><span>${esc(text(item.type || "event", 60))}</span></div>
          <button type="button" data-hgo-activity="${esc(item.id)}" data-hgo-route="${esc(item.route || routeForPlanet(item.planet))}">Tiếp tục →</button>
        </article>`;
      }).join("") : '<div class="hgo-empty"><strong>Chưa có hoạt động phù hợp</strong><p>Timeline không tạo lịch sử giả. Hãy thực hiện một tác vụ để ghi sự kiện.</p></div>'}</div>
    </section>`;
  }

  function renderTimeline(instance) {
    if (!instance.timeline?.isConnected) return;
    instance.timeline.outerHTML = timelineMarkup(instance);
    instance.timeline = instance.shell.querySelector("[data-hgo-timeline]");
  }

  function recentRoute() {
    const recent = asArray(read(KEYS.recent, []));
    const entry = recent.find((item) => typeof item === "string" || item?.route || item?.id);
    if (typeof entry === "string") return entry.startsWith("/") ? entry : `/${entry}`;
    return text(entry?.route, 160) || (entry?.id ? `/${text(entry.id, 120)}` : "");
  }

  function navigatorMarkup() {
    const commands = [
      "Hôm nay tôi cần làm gì?",
      "Mở task quá hạn",
      "Tiếp tục dự án gần nhất",
      "Kiểm tra website",
      "Tìm asset vừa tải lên",
      "Bật Focus 25 phút"
    ];
    return `<button type="button" class="hgo-navigator-core" data-hgo-navigator-open aria-label="Mở trợ lý H Navigator"><span>H</span><b>NAV</b></button>
      <aside class="hgo-navigator" data-hgo-navigator hidden>
        <button type="button" class="hgo-navigator-backdrop" data-hgo-navigator-close aria-label="Đóng H Navigator"></button>
        <section role="dialog" aria-modal="true" aria-labelledby="hgoNavigatorTitle">
          <header><div><span>H NAVIGATOR · LOCAL COMMAND ROUTER</span><h2 id="hgoNavigatorTitle">Tôi có thể đưa bạn đến đúng nơi.</h2><p>Lệnh được phân tích trên thiết bị và gọi đúng module hiện có.</p></div><button type="button" data-hgo-navigator-close aria-label="Đóng">×</button></header>
      <div class="hgo-navigator-suggestions">${commands.map((command) => `<button type="button" data-hgo-navigator-command="${esc(command)}">${esc(command)}</button>`).join("")}</div>
          <form data-hgo-navigator-form><label><span>Nhập lệnh cho H</span><input data-hgo-navigator-input maxlength="180" autocomplete="off" placeholder="Ví dụ: Mở task quá hạn"></label><button type="submit">Thực hiện ↗</button></form>
          <div class="hgo-navigator-result" data-hgo-navigator-result role="status" aria-live="polite"><i>H</i><p>Chọn một lệnh hoặc nhập yêu cầu điều hướng.</p></div>
        </section>
      </aside>`;
  }

  function navigatorResult(instance, message, tone = "") {
    const node = instance.shell.querySelector("[data-hgo-navigator-result]");
    if (!node) return;
    node.dataset.tone = tone;
    node.querySelector("p").textContent = text(message, 240);
  }

  async function executeNavigator(instance, input) {
    const command = text(input, 180).toLowerCase();
    const snapshot = commandSnapshot();
    if (!command) return navigatorResult(instance, "Hãy nhập một lệnh để tiếp tục.", "warning");
    if (/hôm nay|cần làm|ưu tiên/.test(command)) {
      const message = snapshot.overdue.length
        ? `Bạn có ${snapshot.overdue.length} task quá hạn và ${snapshot.todayTasks.length} task đến hạn hôm nay.`
        : snapshot.todayTasks.length ? `Bạn có ${snapshot.todayTasks.length} task đến hạn hôm nay.` : snapshot.open.length ? `Không có deadline hôm nay; còn ${snapshot.open.length} task đang mở.` : "Chưa có công việc gần đây.";
      navigatorResult(instance, message, snapshot.overdue.length ? "warning" : "success");
      return;
    }
    if (/quá hạn|overdue/.test(command)) {
      if (!snapshot.overdue.length) return navigatorResult(instance, "Không có task quá hạn để mở.", "success");
      write(KEYS.selection, { type: "todo", id: snapshot.overdue[0].id, source: "h-navigator", at: new Date().toISOString() });
      navigatorResult(instance, `Đang mở task “${text(snapshot.overdue[0].title, 100)}”.`);
      return openWormhole(instance, "/work", snapshot.overdue[0].title);
    }
    if (/dự án|project|gần nhất/.test(command)) {
      const project = snapshot.activeProject || snapshot.projects.projects[0];
      if (!project) return navigatorResult(instance, "Chưa có dự án được lưu trong Project Center.", "warning");
      write(KEYS.selection, { type: "project", id: project.id, source: "h-navigator", at: new Date().toISOString() });
      navigatorResult(instance, `Đang mở dự án “${projectName(project)}”.`);
      return openWormhole(instance, "/work/project-center", projectName(project));
    }
    if (/health|website|endpoint|kiểm tra/.test(command)) {
      navigatorResult(instance, "Đang chạy Website Health từ bảng điều khiển hiện có.");
      global.document.querySelector("[data-hhhf-refresh]")?.click?.();
      instance.shell.querySelector('[data-hgm-action="health"]')?.click?.();
      return;
    }
    if (/asset|tệp|file/.test(command)) {
      const file = asArray(read(KEYS.files, []))[0];
      if (!file) return navigatorResult(instance, "Chưa có asset nào trong kho tệp gần đây.", "warning");
      write(KEYS.selection, { type: "asset", id: file.id, name: text(file.name, 160), source: "h-navigator", at: new Date().toISOString() });
      navigatorResult(instance, `Đang mở asset “${text(file.name, 100)}”.`);
      return openWormhole(instance, "/media-design", file.name);
    }
    if (/focus|tập trung|25/.test(command)) {
      const focus = global.document.querySelector("[data-home-health-focus-host] [data-hhhf-toggle]");
      if (focus) {
        focus.click();
        navigatorResult(instance, "Đã bật phiên tập trung 25 phút.", "success");
        emit("focus:started", { title: "Focus 25 phút", source: "h-navigator" });
      } else navigatorResult(instance, "Focus Mode chưa sẵn sàng. Hãy thử lại sau khi trang tải xong.", "warning");
      return;
    }
    if (/ai|sáng tạo/.test(command)) return openWormhole(instance, "/create/ai-center", "AI Center");
    if (/tin nhắn|giao tiếp/.test(command)) return openWormhole(instance, "/communication", "Giao tiếp");
    navigatorResult(instance, "H chưa nhận ra lệnh này. Bạn có thể dùng tìm kiếm toàn hệ thống.", "warning");
  }

  function focusContent(planetId) {
    const activities = asArray(read(KEYS.activity, [])).filter((item) => item.planet === planetId).slice(0, 12);
    const command = commandSnapshot();
    const health = healthSnapshot();
    const queues = {
      creative: aiRunningCount() ? [`${aiRunningCount()} tác vụ AI đang xử lý`] : [],
      work: [...command.overdue.slice(0, 3).map((item) => text(item.title, 90)), ...command.todayTasks.slice(0, 2).map((item) => text(item.title, 90))],
      media: asArray(read(KEYS.files, [])).slice(0, 3).map((item) => text(item.name, 90)),
      dev: command.failedJobs.slice(0, 3).map((item) => text(item.type || item.error, 90)),
      communication: asArray(read(KEYS.communication, {}).notifications).filter((item) => !item.read).slice(0, 3).map((item) => text(item.title || item.message, 90)),
      learning: [],
      analytics: health.slowest ? [`${health.slowest.id}: ${Math.round(health.slowest.latency)} ms`] : [],
      system: global.navigator?.onLine === false ? ["Thiết bị đang offline"] : []
    };
    const warnings = {
      creative: aiRunningCount() ? [] : ["Không có tác vụ AI đang chạy"],
      work: command.overdue.length ? [`${command.overdue.length} task quá hạn`] : [],
      media: asArray(read(KEYS.files, [])).length ? [] : ["Chưa có asset gần đây"],
      dev: command.failedJobs.length ? [`${command.failedJobs.length} background job thất bại`] : [],
      communication: global.navigator?.onLine === false ? ["Mất kết nối mạng"] : [],
      learning: ["Chỉ hiển thị tín hiệu khi Learning OS ghi dữ liệu"],
      analytics: health.slow ? [`Endpoint ${health.slowest.id} đang chậm`] : [],
      system: global.navigator?.onLine === false ? ["Thiết bị offline"] : []
    };
    const suggestions = {
      creative: aiRunningCount() ? "Theo dõi tác vụ AI đang xử lý." : "Mở AI Center để bắt đầu nội dung mới.",
      work: command.overdue.length ? "Xử lý task quá hạn trước khi mở thêm công việc." : command.open.length ? "Tiếp tục task gần deadline nhất." : "Tạo task đầu tiên cho hôm nay.",
      media: "Mở Media & Design để quản lý asset gần nhất.",
      dev: command.failedJobs.length ? "Mở System để kiểm tra job thất bại." : "Chạy Website Health trước khi deployment tiếp theo.",
      communication: "Mở Unified Inbox để xử lý tín hiệu chưa đọc.",
      learning: "Tiếp tục bài học hoặc nội dung cần ôn.",
      analytics: health.slow ? "Kiểm tra endpoint chậm trong Website Health." : "Theo dõi Web Vitals của phiên hiện tại.",
      system: "Kiểm tra PWA, quyền và bộ nhớ website."
    };
    const bins = Array.from({ length: 12 }, (_, index) => {
      const from = Date.now() - (12 - index) * 3_600_000;
      const to = from + 3_600_000;
      return activities.filter((item) => dateValue(item.createdAt) >= from && dateValue(item.createdAt) < to).length;
    });
    const max = Math.max(1, ...bins);
    return { activities, queue: queues[planetId] || [], warnings: warnings[planetId] || [], suggestion: suggestions[planetId] || "Mở workspace để tiếp tục.", spark: bins.map((value, index) => `${index * 10.9},${38 - value / max * 32}`).join(" ") };
  }

  function enhanceFocus(instance) {
    const panel = instance.shell.querySelector("[data-hgm-focus]");
    if (!panel || panel.querySelector("[data-hgo-focus-tabs]")) return;
    const planetId = instance.shell.dataset.focusPlanet;
    if (!planetId) return;
    const data = focusContent(planetId);
    panel.classList.add("hgo-hologram");
    panel.querySelector(".hgm-focus-status")?.insertAdjacentHTML("afterend", `<nav class="hgo-focus-tabs" data-hgo-focus-tabs role="tablist" aria-label="Lớp dữ liệu Focus Galaxy">
      <button type="button" role="tab" aria-selected="true" data-hgo-focus-tab="overview">Tổng quan</button>
      <button type="button" role="tab" aria-selected="false" data-hgo-focus-tab="queue">Cần xử lý <b>${data.queue.length}</b></button>
      <button type="button" role="tab" aria-selected="false" data-hgo-focus-tab="history">Lịch sử <b>${data.activities.length}</b></button>
      <button type="button" role="tab" aria-selected="false" data-hgo-focus-tab="signal">Tín hiệu</button>
    </nav>
    <div class="hgo-focus-layers">
      <section data-hgo-focus-pane="overview"><strong>Đề xuất tiếp theo</strong><p>${esc(data.suggestion)}</p><button type="button" data-hgo-route="${routeForPlanet(planetId)}">Thực hiện →</button></section>
      <section data-hgo-focus-pane="queue" hidden>${data.queue.length ? data.queue.map((item) => `<p><i></i>${esc(item)}</p>`).join("") : "<p>Chưa có công việc cần xử lý.</p>"}</section>
      <section data-hgo-focus-pane="history" hidden>${data.activities.length ? data.activities.slice(0, 6).map((item) => `<p><i></i><span>${esc(text(item.text, 120))}</span><time>${esc(relative(item.createdAt))}</time></p>`).join("") : "<p>Chưa có lịch sử thật trong hành tinh này.</p>"}</section>
      <section data-hgo-focus-pane="signal" hidden><svg viewBox="0 0 120 42" preserveAspectRatio="none" aria-label="Hoạt động trong 12 giờ"><polyline points="${data.spark}"></polyline></svg><div>${data.warnings.length ? data.warnings.map((item) => `<p class="is-warning">⚠ ${esc(item)}</p>`).join("") : "<p>Không có cảnh báo mới.</p>"}</div></section>
    </div>`);
  }

  function bodyOverlay() {
    let overlay = global.document.querySelector("[data-hgo-wormhole]");
    if (overlay) return overlay;
    global.document.body.insertAdjacentHTML("beforeend", `<aside class="hgo-wormhole" data-hgo-wormhole hidden aria-live="polite">
      <canvas aria-hidden="true"></canvas><div class="hgo-wormhole-core"><span>H</span><i></i><b></b></div>
      <section><small>WORMHOLE NAVIGATION</small><strong data-hgo-wormhole-label>Đang chuẩn bị workspace</strong><p data-hgo-wormhole-status>Kiểm tra tài nguyên đích…</p><button type="button" data-hgo-wormhole-retry hidden>Thử lại</button></section>
    </aside>`);
    overlay = global.document.querySelector("[data-hgo-wormhole]");
    return overlay;
  }

  async function prepareRoute(route) {
    const loader = global.HHAssetLoader;
    if (!loader?.ensureForRoute || loader.isRouteReady?.(route)) return true;
    await loader.ensureForRoute(route);
    return true;
  }

  function waitForRoute(route, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      const check = () => {
        if (global.document.querySelector(".app-runtime-error")) return reject(new Error("Workspace báo lỗi khi tải."));
        const loading = global.document.querySelector(".app-route-loader");
        const current = decodeURIComponent(global.location.hash.replace(/^#/, "") || "/home");
        if (current === route && !loading) return resolve(true);
        if (Date.now() - started > timeout) return reject(new Error("Workspace chưa sẵn sàng."));
        setTimeout(check, 80);
      };
      check();
    });
  }

  async function openWormhole(instance, route, label = "") {
    const safeRoute = /^\/[a-z0-9/_-]+$/i.test(String(route || "")) ? String(route) : "/home";
    if (instance.wormholeBusy) return false;
    instance.wormholeBusy = true;
    if (instance.shell.dataset.effectWormhole === "false") {
      try {
        await prepareRoute(safeRoute);
        global.location.hash = `#${safeRoute}`;
        await waitForRoute(safeRoute);
        return true;
      } catch {
        global.location.hash = `#${safeRoute}`;
        return false;
      } finally {
        instance.wormholeBusy = false;
      }
    }
    const overlay = bodyOverlay();
    overlay.hidden = false;
    overlay.dataset.phase = "preparing";
    overlay.querySelector("[data-hgo-wormhole-label]").textContent = text(label, 100) || "Đang chuẩn bị workspace";
    overlay.querySelector("[data-hgo-wormhole-status]").textContent = "Kiểm tra tài nguyên đích…";
    overlay.querySelector("[data-hgo-wormhole-retry]").hidden = true;
    try {
      await prepareRoute(safeRoute);
      overlay.dataset.phase = "opening";
      overlay.querySelector("[data-hgo-wormhole-status]").textContent = "Đường hầm đã ổn định · đang dịch chuyển";
      await new Promise((resolve) => setTimeout(resolve, global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? 0 : 380));
      global.location.hash = `#${safeRoute}`;
      await waitForRoute(safeRoute);
      overlay.dataset.phase = "ready";
      overlay.querySelector("[data-hgo-wormhole-status]").textContent = "Workspace đã sẵn sàng";
      setTimeout(() => { overlay.hidden = true; overlay.dataset.phase = ""; }, 280);
      return true;
    } catch (error) {
      overlay.dataset.phase = "error";
      overlay.querySelector("[data-hgo-wormhole-status]").textContent = text(error?.message || "Không thể mở workspace", 140);
      const retry = overlay.querySelector("[data-hgo-wormhole-retry]");
      retry.hidden = false;
      retry.dataset.route = safeRoute;
      retry.dataset.label = text(label, 100);
      return false;
    } finally {
      instance.wormholeBusy = false;
    }
  }

  function showNova(instance, anchor = instance.portal) {
    if (!anchor || ["static", "off"].includes(instance.shell.dataset.motion) || instance.shell.dataset.effectNova === "false") return;
    const rect = anchor.getBoundingClientRect();
    const shellRect = instance.shell.getBoundingClientRect();
    const nova = instance.shell.querySelector("[data-hgo-nova]");
    nova.style.setProperty("--nova-x", `${rect.left - shellRect.left + rect.width * .32}px`);
    nova.style.setProperty("--nova-y", `${rect.top - shellRect.top + rect.height * .45}px`);
    nova.innerHTML = Array.from({ length: 16 }, (_, index) => `<i style="--nova-angle:${index * 22.5}deg"></i>`).join("");
    nova.classList.remove("is-active");
    global.requestAnimationFrame(() => nova.classList.add("is-active"));
    setTimeout(() => nova.classList.remove("is-active"), 900);
  }

  function notificationMarkup(item) {
    const tone = item?.type === "deployment-failed" ? "error" : item?.type === "deployment-ready" ? "success" : item?.planet || "system";
    return `<button type="button" class="hgo-event-comet is-${esc(tone)}" data-hgo-event-comet data-hgo-activity="${esc(item.id)}" data-hgo-route="${esc(item.route || routeForPlanet(item.planet))}" style="--event:${esc(item.planet === "communication" ? "#67efbd" : item.planet === "creative" ? "#ff59d6" : item.type === "deployment-failed" ? "#ff704d" : "#58f3ff")}"><i></i><span><small>${esc(text(item.source || "Galaxy Event", 60))}</small><strong>${esc(text(item.text, 130))}</strong></span><b>→</b></button>`;
  }

  function detectNotification(instance) {
    const latest = asArray(read(KEYS.activity, []))[0];
    if (!latest || latest.read || latest.id === instance.lastActivityId) return;
    instance.lastActivityId = latest.id;
    const old = instance.shell.querySelector("[data-hgo-event-comet]");
    old?.remove();
    if (instance.shell.dataset.effectComet !== "false") {
      instance.shell.insertAdjacentHTML("beforeend", notificationMarkup(latest));
      const node = instance.shell.querySelector("[data-hgo-event-comet]");
      global.requestAnimationFrame(() => node?.classList.add("is-flying"));
      setTimeout(() => node?.classList.remove("is-flying"), 5200);
    }
    if (latest.type === "task-completed") showNova(instance);
    if (latest.type === "deployment-ready") instance.shell.dataset.deployState = "success";
    if (latest.type === "deployment-failed") instance.shell.dataset.deployState = "failed";
  }

  function markActivityRead(id) {
    const items = asArray(read(KEYS.activity, []));
    write(KEYS.activity, items.map((item) => String(item.id) === String(id) ? { ...item, read: true } : item));
  }

  async function refreshCosmosState(instance, force = false) {
    const hour = new Date().getHours();
    instance.shell.dataset.cosmicPeriod = hour < 6 || hour >= 19 ? "night" : hour < 11 ? "morning" : hour < 16 ? "day" : "sunset";
    instance.shell.dataset.network = global.navigator?.onLine === false ? "offline" : "online";
    if (!force && Date.now() - instance.healthCheckedAt < 60_000) return;
    instance.healthCheckedAt = Date.now();
    try {
      const response = await global.fetch("/api/health", { cache: "no-store", credentials: "include", headers: { Accept: "application/json" } });
      const payload = await response.json().catch(() => ({}));
      instance.shell.dataset.cosmosHealth = response.ok && payload?.ok === true ? "healthy" : "warning";
    } catch { instance.shell.dataset.cosmosHealth = "warning"; }
  }

  function hideLegacyRecent(instance) {
    const candidates = [...global.document.querySelectorAll("[data-shell-view='home'] section")];
    const target = candidates.find((node) => /Quay lại đúng nơi bạn đang làm/i.test(node.textContent || ""));
    if (target && !target.closest("[data-hgo-timeline]")) target.dataset.hgoReplaced = "true";
  }

  function saveCapture(instance, type, value) {
    const clean = text(value, type === "task" ? 180 : 500);
    if (!clean) return false;
    if (type === "task") {
      const todos = asArray(read(KEYS.todos, []));
      const task = { id: uid("todo"), title: clean, priority: "medium", category: "Galaxy Command", deadline: day(), reminder: "", repeat: "none", completed: false, reminded: false, createdAt: Date.now() };
      todos.unshift(task);
      write(KEYS.todos, todos);
      emit("task:created", { title: clean, id: task.id, source: "quantum-command-gate" });
    } else {
      const notes = asArray(read(KEYS.notes, []));
      const note = { id: uid("note"), text: clean, color: "#75f2d0", x: 32 + notes.length % 8 * 34, y: 30 + notes.length % 5 * 28, rotate: notes.length % 3 - 1, pinned: false, tags: "quantum-command", reminder: "", preview: false, updatedAt: Date.now() };
      notes.push(note);
      write(KEYS.notes, notes.slice(-30));
      emit("note:created", { title: clean.slice(0, 100), id: note.id, source: "quantum-command-gate" });
    }
    global.dispatchEvent?.(new CustomEvent("hh:command-center-sync"));
    instance.captureType = "";
    renderPortal(instance);
    return true;
  }

  function completeTask(instance, id) {
    const todos = asArray(read(KEYS.todos, []));
    const target = todos.find((item) => String(item.id) === String(id));
    if (!target || taskDone(target)) return false;
    target.completed = true;
    target.completedAt = Date.now();
    write(KEYS.todos, todos);
    emit("task:completed", { title: text(target.title, 120), id: target.id, source: "quantum-command-gate" });
    global.dispatchEvent?.(new CustomEvent("hh:command-center-sync"));
    showNova(instance);
    setTimeout(() => renderPortal(instance), 180);
    return true;
  }

  function storeSelection(target) {
    if (target.dataset.hgoProject) write(KEYS.selection, { type: target.dataset.hgoTask ? "task" : "project", id: target.dataset.hgoTask || target.dataset.hgoProject, projectId: target.dataset.hgoProject, source: "work-galaxy-map", at: new Date().toISOString() });
  }

  function onClick(instance, event) {
    const target = event.target;
    const routeTarget = target.closest("[data-hgo-route],[data-hgm-open-workspace]");
    if (routeTarget) {
      event.preventDefault();
      event.stopImmediatePropagation();
      storeSelection(routeTarget);
      const route = routeTarget.dataset.hgoRoute || routeTarget.dataset.hgmOpenWorkspace && routeForPlanet(routeTarget.dataset.hgmOpenWorkspace);
      if (routeTarget.dataset.hgoActivity) markActivityRead(routeTarget.dataset.hgoActivity);
      return openWormhole(instance, route, routeTarget.innerText);
    }
    const capture = target.closest("[data-hgo-capture]");
    if (capture) {
      instance.captureType = capture.dataset.hgoCapture;
      const form = instance.portal.querySelector("[data-hgo-capture-form]");
      form.hidden = false;
      form.querySelector("[data-hgo-capture-label]").textContent = instance.captureType === "task" ? "Task mới trong Todo Workspace" : "Sticky Note mới";
      form.querySelector("input").placeholder = instance.captureType === "task" ? "Việc cần hoàn thành..." : "Nội dung ghi chú...";
      form.querySelector("input").focus();
      return;
    }
    if (target.closest("[data-hgo-capture-close]")) {
      instance.captureType = "";
      target.closest("form").hidden = true;
      return;
    }
    const complete = target.closest("[data-hgo-complete-task]");
    if (complete) return completeTask(instance, complete.dataset.hgoCompleteTask);
    if (target.closest("[data-hgo-continue]")) {
      const route = recentRoute();
      if (route) return openWormhole(instance, route, "Công việc gần nhất");
      const project = commandSnapshot().activeProject;
      if (project) {
        write(KEYS.selection, { type: "project", id: project.id, source: "command-gate", at: new Date().toISOString() });
        return openWormhole(instance, "/work/project-center", projectName(project));
      }
      return openWormhole(instance, "/work", "Command Center");
    }
    const filter = target.closest("[data-hgo-filter]");
    if (filter) {
      instance.timelineFilter = filter.dataset.hgoFilter;
      renderTimeline(instance);
      return;
    }
    const focusTab = target.closest("[data-hgo-focus-tab]");
    if (focusTab) {
      const panel = focusTab.closest("[data-hgm-focus]");
      panel.querySelectorAll("[data-hgo-focus-tab]").forEach((button) => button.setAttribute("aria-selected", String(button === focusTab)));
      panel.querySelectorAll("[data-hgo-focus-pane]").forEach((pane) => { pane.hidden = pane.dataset.hgoFocusPane !== focusTab.dataset.hgoFocusTab; });
      return;
    }
    if (target.closest("[data-hgo-navigator-open]")) {
      const navigator = instance.shell.querySelector("[data-hgo-navigator]");
      navigator.hidden = false;
      setTimeout(() => navigator.querySelector("[data-hgo-navigator-input]")?.focus(), 0);
      return;
    }
    if (target.closest("[data-hgo-navigator-close]")) {
      instance.shell.querySelector("[data-hgo-navigator]").hidden = true;
      return;
    }
    const command = target.closest("[data-hgo-navigator-command]");
    if (command) return executeNavigator(instance, command.dataset.hgoNavigatorCommand);
    const comet = target.closest("[data-hgo-event-comet]");
    if (comet) {
      markActivityRead(comet.dataset.hgoActivity);
      return openWormhole(instance, comet.dataset.hgoRoute, comet.innerText);
    }
  }

  function onSubmit(instance, event) {
    const captureForm = event.target.closest("[data-hgo-capture-form]");
    if (captureForm) {
      event.preventDefault();
      const input = captureForm.querySelector("[data-hgo-capture-input]");
      const value = input.value;
      captureForm.hidden = true;
      if (saveCapture(instance, instance.captureType, value)) input.value = "";
      else captureForm.hidden = false;
      return;
    }
    const navigatorForm = event.target.closest("[data-hgo-navigator-form]");
    if (navigatorForm) {
      event.preventDefault();
      executeNavigator(instance, navigatorForm.querySelector("[data-hgo-navigator-input]").value);
    }
  }

  function bind(instance) {
    global.document.addEventListener("click", (event) => onClick(instance, event), { capture: true, signal: instance.controller.signal });
    instance.shell.addEventListener("submit", (event) => onSubmit(instance, event), { signal: instance.controller.signal });
    global.addEventListener("hh:event", () => setTimeout(() => {
      detectNotification(instance);
      renderPortal(instance);
      renderTimeline(instance);
      renderRing(instance);
    }, 40), { signal: instance.controller.signal });
    global.addEventListener("online", () => refreshCosmosState(instance, true), { signal: instance.controller.signal });
    global.addEventListener("offline", () => refreshCosmosState(instance, true), { signal: instance.controller.signal });
    global.addEventListener("hh:runtime-issue", (event) => {
      const overlay = global.document.querySelector("[data-hgo-wormhole]");
      if (!overlay || overlay.hidden) return;
      overlay.dataset.phase = "error";
      overlay.querySelector("[data-hgo-wormhole-status]").textContent = text(event.detail?.message || "Workspace gặp lỗi", 140);
      overlay.querySelector("[data-hgo-wormhole-retry]").hidden = false;
    }, { signal: instance.controller.signal });
    global.document.addEventListener("click", (event) => {
      const retry = event.target.closest("[data-hgo-wormhole-retry]");
      if (!retry) return;
      const overlay = retry.closest("[data-hgo-wormhole]");
      overlay.hidden = true;
      openWormhole(instance, retry.dataset.route, retry.dataset.label);
    }, { signal: instance.controller.signal });
    instance.focusObserver = new global.MutationObserver(() => enhanceFocus(instance));
    const focusHost = instance.shell.querySelector("[data-hgm-focus-host]");
    if (focusHost) instance.focusObserver.observe(focusHost, { childList: true, subtree: true });
  }

  function mount(root = global.document?.querySelector?.("[data-hgc-root].hgm-active")) {
    if (!root || instances.has(root)) return instances.get(root)?.api || false;
    const shell = root.querySelector("[data-hgm-shell]");
    if (!shell) return false;
    const controller = new AbortController();
    const instance = {
      root,
      shell,
      controller,
      portal: null,
      map: null,
      timeline: null,
      timelineFilter: "all",
      captureType: "",
      lastActivityId: asArray(read(KEYS.activity, []))[0]?.id || "",
      wormholeBusy: false,
      healthCheckedAt: 0
    };
    root.classList.add("hgo-active");
    shell.dataset.operations = "v3";
    const activity = shell.querySelector(".hgm-activity");
    activity?.insertAdjacentHTML("afterend", portalMarkup(commandSnapshot()));
    instance.portal = shell.querySelector("[data-hgo-command]");
    const hero = shell.querySelector(".hgm-hero");
    hero?.insertAdjacentHTML("afterend", `${mapMarkup()}${timelineMarkup(instance)}`);
    instance.map = shell.querySelector("[data-hgo-map]");
    instance.timeline = shell.querySelector("[data-hgo-timeline]");
    shell.querySelector(".hgm-solar")?.insertAdjacentHTML("beforeend", `${ringMarkup(instance)}${navigatorMarkup()}`);
    shell.insertAdjacentHTML("beforeend", '<div class="hgo-nova" data-hgo-nova aria-hidden="true"></div>');
    hideLegacyRecent(instance);
    bind(instance);
    enhanceFocus(instance);
    refreshCosmosState(instance, true);
    instance.interval = setInterval(() => {
      if (!instance.root.isConnected) {
        unmount(instance.root);
        return;
      }
      if (global.document.hidden) return;
      renderPortal(instance);
      renderRing(instance);
      renderTimeline(instance);
      detectNotification(instance);
      refreshCosmosState(instance);
    }, 5000);
    instances.set(root, instance);
    const api = Object.freeze({
      version: VERSION,
      refresh: () => {
        renderPortal(instance);
        renderMap(instance);
        renderRing(instance);
        renderTimeline(instance);
        refreshCosmosState(instance, true);
      },
      command: () => JSON.parse(JSON.stringify(commandSnapshot())),
      map: () => {
        const data = workMapData();
        return { projects: data.projects, tasks: data.tasks };
      },
      navigate: (route, label) => openWormhole(instance, route, label),
      destroy: () => unmount(root)
    });
    instance.api = api;
    return api;
  }

  function unmount(root) {
    const instance = instances.get(root);
    if (!instance) return false;
    instance.controller.abort();
    clearInterval(instance.interval);
    instance.focusObserver?.disconnect();
    root.classList.remove("hgo-active");
    root.querySelectorAll("[data-hgo-command],[data-hgo-map],[data-hgo-timeline],[data-hgo-status-ring],[data-hgo-navigator-open],[data-hgo-navigator],[data-hgo-nova],[data-hgo-event-comet]").forEach((node) => node.remove());
    instances.delete(root);
    return true;
  }

  function autoMount() {
    const attach = () => {
      const root = global.document?.querySelector?.("[data-hgc-root].hgm-active");
      if (!root) return false;
      return Boolean(mount(root));
    };
    const start = () => {
      attach();
      if (!global.MutationObserver || autoObserver) return;
      autoObserver = new global.MutationObserver(attach);
      autoObserver.observe(global.document.documentElement, { childList: true, subtree: true });
    };
    if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
    global.addEventListener?.("hh:assets-ready", (event) => { if (event.detail?.route === "/home") setTimeout(attach, 0); });
    global.addEventListener?.("hashchange", () => { if (global.location.hash.includes("/home")) setTimeout(attach, 80); });
    return true;
  }

  return Object.freeze({
    VERSION,
    KEYS,
    projectSnapshot,
    commandSnapshot,
    healthSnapshot,
    mount,
    unmount,
    autoMount
  });
});
