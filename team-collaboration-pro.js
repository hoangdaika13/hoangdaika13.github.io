(() => {
  "use strict";

  const KEY = "hh-team-collaboration-pro";
  const STATUS = Object.freeze({ backlog: "Backlog", todo: "Cần làm", doing: "Đang làm", review: "Đang duyệt", done: "Hoàn tất" });
  const STATUS_ORDER = ["todo", "doing", "review", "done"];
  const PRIORITY = Object.freeze({ low: "Thấp", normal: "Bình thường", high: "Cao", urgent: "Khẩn cấp" });
  const ROLE_RANK = Object.freeze({ viewer: 0, commenter: 1, editor: 2, owner: 3 });
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const attr = (value) => esc(value).replace(/`/g, "&#96;");
  const taskId = (task) => String(task?._id || task?.id || "");
  const read = () => {
    try { return { view: "board", search: "", selectedTaskId: "", history: {}, activity: [], ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
    catch { return { view: "board", search: "", selectedTaskId: "", history: {}, activity: [] }; }
  };
  const save = (value) => localStorage.setItem(KEY, JSON.stringify(value));
  const patchState = (change) => { const next = { ...read(), ...change }; save(next); return next; };
  const apiBase = () => String(window.HH_REALTIME_URL || "").replace(/\/$/, "");
  const auth = () => localStorage.getItem("hh-auth-token") || "";
  const request = async (options = {}) => {
    const response = await fetch(`${apiBase()}/api/team/board${options.query || ""}`, {
      method: options.method || "GET",
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(auth() ? { Authorization: `Bearer ${auth()}` } : {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  };
  const can = (board, required) => ROLE_RANK[board?.role || "viewer"] >= ROLE_RANK[required];
  const initial = (name) => esc((name || "HH").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase());
  const isoDay = (value) => value ? String(value).slice(0, 10) : "";
  const toDate = (value) => { const date = value ? new Date(`${isoDay(value)}T12:00:00`) : null; return date && !Number.isNaN(date.valueOf()) ? date : null; };
  const formatDate = (value) => { const date = toDate(value); return date ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date) : "Chưa đặt"; };
  const formatTime = (value) => { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.valueOf()) ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date) : "Vừa xong"; };
  const formatEstimate = (minutes) => {
    const value = Number(minutes) || 0;
    if (!value) return "Chưa ước lượng";
    if (value < 60) return `${value} phút`;
    const hours = Math.round(value / 6) / 10;
    return `${hours} giờ`;
  };
  const progress = (task) => {
    const items = task.subtasks || [];
    return items.length ? Math.round(items.filter((item) => item.done).length / items.length * 100) : task.status === "done" ? 100 : 0;
  };
  const dueState = (task) => {
    const due = toDate(task.dueDate);
    if (!due || task.status === "done") return "";
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Math.ceil((due - today) / 86400000);
    return days < 0 ? "overdue" : days <= 2 ? "soon" : "";
  };
  const currentRoot = () => document.querySelector('[data-extension-suite="team-collaboration"]');
  const setStatus = (root, message, tone = "") => {
    const node = root?.querySelector("[data-tc-status]");
    if (node) { node.textContent = message; node.dataset.tone = tone; }
  };
  const taskById = (data, id) => (data.tasks || []).find((item) => taskId(item) === String(id));
  const filteredTasks = (data) => {
    const query = String(data.search || "").trim().toLocaleLowerCase("vi");
    if (!query) return data.tasks || [];
    return (data.tasks || []).filter((task) => [task.title, task.description, task.assignee, ...(task.labels || [])].join(" ").toLocaleLowerCase("vi").includes(query));
  };
  const dependencyNames = (task, data) => (task.dependencies || []).map((id) => taskById(data, id)?.title || "Công việc đã ẩn");

  function taskCard(task, data) {
    const id = taskId(task); const value = progress(task); const dependencies = dependencyNames(task, data); const editable = can(data.board, "editor");
    return `<article class="tc-card priority-${attr(task.priority || "normal")}" data-tc-task="${attr(id)}" data-tc-open-task="${attr(id)}" ${editable ? "draggable=\"true\"" : ""} tabindex="0">
      <header><span class="tc-priority">${esc(PRIORITY[task.priority] || PRIORITY.normal)}</span><button type="button" data-tc-open-task="${attr(id)}" aria-label="Mở chi tiết">•••</button></header>
      <strong>${esc(task.title)}</strong><p>${esc(task.description || "Chưa có mô tả")}</p>
      ${dependencies.length ? `<small class="tc-dependency">Phụ thuộc: ${dependencies.map(esc).join(", ")}</small>` : ""}
      <div class="tc-progress" aria-label="Tiến độ ${value}%"><i style="--tc-progress:${value}%"></i></div>
      <div class="tc-card-meta"><span>${esc(task.assignee || "Chưa phân công")}</span><time class="${dueState(task)}">${esc(formatDate(task.dueDate))}</time></div>
      <footer><span>${(task.subtasks || []).filter((item) => item.done).length}/${(task.subtasks || []).length} subtask</span><span>${esc(formatEstimate(task.estimateMinutes))}</span><span>${task.comments?.length || 0} bình luận</span></footer>
    </article>`;
  }

  function boardView(data, tasks) {
    const columns = STATUS_ORDER.map((status) => {
      const items = tasks.filter((task) => task.status === status);
      return `<section class="tc-column" data-tc-drop-status="${status}"><header><div><i></i><strong>${esc(STATUS[status])}</strong></div><span>${items.length}</span></header><div>${items.map((task) => taskCard(task, data)).join("") || `<p class="tc-empty">Thả công việc vào đây</p>`}</div></section>`;
    }).join("");
    const backlog = tasks.filter((task) => task.status === "backlog");
    return `<section class="tc-view tc-board-view" data-tc-view-panel="board">${backlog.length ? `<details class="tc-backlog"><summary>Backlog <b>${backlog.length}</b></summary><div>${backlog.map((task) => taskCard(task, data)).join("")}</div></details>` : ""}<div class="tc-kanban">${columns}</div></section>`;
  }

  function listView(data, tasks) {
    const rows = tasks.map((task) => `<button class="tc-list-row" type="button" data-tc-open-task="${attr(taskId(task))}"><span><i class="priority-${attr(task.priority)}"></i><strong>${esc(task.title)}</strong></span><span>${esc(STATUS[task.status] || task.status)}</span><span>${esc(task.assignee || "Chưa giao")}</span><span>${esc(formatEstimate(task.estimateMinutes))}</span><time class="${dueState(task)}">${esc(formatDate(task.dueDate))}</time><span>${progress(task)}%</span></button>`).join("");
    return `<section class="tc-view tc-list-view" data-tc-view-panel="list"><header><span>Công việc</span><span>Trạng thái</span><span>Phụ trách</span><span>Ước lượng</span><span>Deadline</span><span>Tiến độ</span></header>${rows || `<p class="tc-empty">Không có công việc phù hợp.</p>`}</section>`;
  }

  function calendarView(data, tasks) {
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const days = Array.from({ length: 14 }, (_, index) => { const date = new Date(today); date.setDate(today.getDate() + index); return date; });
    return `<section class="tc-view tc-calendar-view" data-tc-view-panel="calendar"><header><div><span>Hai tuần tới</span><strong>${esc(formatDate(days[0].toISOString()))} – ${esc(formatDate(days[13].toISOString()))}</strong></div><p>Kéo kế hoạch về một nhịp nhìn dễ kiểm soát.</p></header><div class="tc-calendar-grid">${days.map((date) => {
      const key = date.toISOString().slice(0, 10); const items = tasks.filter((task) => isoDay(task.dueDate) === key);
      return `<article class="${date.toDateString() === today.toDateString() ? "is-today" : ""}"><header><span>${new Intl.DateTimeFormat("vi-VN", { weekday: "short" }).format(date)}</span><b>${date.getDate()}</b></header><div>${items.map((task) => `<button type="button" class="priority-${attr(task.priority)}" data-tc-open-task="${attr(taskId(task))}">${esc(task.title)}</button>`).join("") || "<small>Trống</small>"}</div></article>`;
    }).join("")}</div><div class="tc-unscheduled"><strong>Chưa có deadline</strong>${tasks.filter((task) => !task.dueDate).map((task) => `<button type="button" data-tc-open-task="${attr(taskId(task))}">${esc(task.title)}</button>`).join("") || "<span>Không có</span>"}</div></section>`;
  }

  function timelineView(data, tasks) {
    const dated = tasks.filter((task) => toDate(task.dueDate)).sort((a, b) => toDate(a.dueDate) - toDate(b.dueDate));
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const rows = dated.map((task) => {
      const due = toDate(task.dueDate); const offset = Math.max(0, Math.min(27, Math.round((due - today) / 86400000))); const duration = Math.max(1, Math.min(14, Math.ceil((Number(task.estimateMinutes) || 480) / 480)));
      return `<button class="tc-timeline-row" type="button" data-tc-open-task="${attr(taskId(task))}"><span><strong>${esc(task.title)}</strong><small>${esc(task.assignee || "Chưa giao")}</small></span><div><i class="priority-${attr(task.priority)}" style="--tc-offset:${offset};--tc-duration:${duration}"><b>${progress(task)}%</b></i></div><time>${esc(formatDate(task.dueDate))}</time></button>`;
    }).join("");
    return `<section class="tc-view tc-timeline-view" data-tc-view-panel="timeline"><header><span>Công việc</span><div>${Array.from({ length: 5 }, (_, index) => `<b>Tuần ${index + 1}</b>`).join("")}</div><span>Deadline</span></header>${rows || `<p class="tc-empty">Đặt deadline để hiển thị trên Timeline.</p>`}</section>`;
  }

  function activityPanel(data) {
    const items = (data.activity || []).slice(0, 12);
    return `<section class="tc-activity"><header><span>HOẠT ĐỘNG</span><b>${items.length}</b></header><div>${items.map((item) => `<article><i></i><div><strong>${esc(item.summary || item.action)}</strong><small>${esc(item.actor?.name || "Thành viên")} · ${esc(formatTime(item.createdAt))}</small></div></article>`).join("") || `<p>Chưa có hoạt động.</p>`}</div></section>`;
  }

  function memberPanel(data) {
    const owner = can(data.board, "owner");
    return `<section class="tc-members"><header><span>THÀNH VIÊN</span>${owner ? `<button type="button" data-tc-share>+ Mời</button>` : `<small>${esc(data.board.role)}</small>`}</header>${(data.board?.members || []).map((item) => `<article class="tc-member"><b>${initial(item.name)}</b><div><strong>${esc(item.name || "Thành viên")}</strong><small>${esc(item.role || "viewer")}</small></div>${owner && item.role !== "owner" ? `<select data-tc-member-role="${attr(item.userId)}" aria-label="Quyền của ${attr(item.name)}">${["viewer", "commenter", "editor"].map((value) => `<option value="${value}" ${item.role === value ? "selected" : ""}>${value}</option>`).join("")}</select>` : `<i></i>`}</article>`).join("")}</section>`;
  }

  function inspector(data) {
    const task = taskById(data, data.selectedTaskId);
    if (!task) return "";
    const editable = can(data.board, "editor"); const commentable = can(data.board, "commenter"); const history = data.history?.[taskId(task)] || task.versions || [];
    return `<aside class="tc-inspector" data-tc-inspector><header><div><span>CÔNG VIỆC · V${Number(task.version) || 1}</span><h5>${esc(task.title)}</h5></div><button type="button" data-tc-close-task aria-label="Đóng">×</button></header>
      <div class="tc-inspector-scroll">
        <section class="tc-edit-grid">
          <label>Tiêu đề<input data-tc-edit-title value="${attr(task.title)}" ${editable ? "" : "disabled"}></label>
          <label>Trạng thái<select data-tc-edit-status ${editable ? "" : "disabled"}>${Object.entries(STATUS).map(([value, label]) => `<option value="${value}" ${task.status === value ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></label>
          <label>Người phụ trách<select data-tc-edit-assignee ${editable ? "" : "disabled"}><option value="">Chưa phân công</option>${(data.board.members || []).map((member) => `<option value="${attr(member.userId)}" data-name="${attr(member.name)}" ${String(task.assigneeId) === String(member.userId) || (!task.assigneeId && task.assignee === member.name) ? "selected" : ""}>${esc(member.name)}</option>`).join("")}</select></label>
          <label>Deadline<input type="date" data-tc-edit-due value="${attr(isoDay(task.dueDate))}" ${editable ? "" : "disabled"}></label>
          <label>Ưu tiên<select data-tc-edit-priority ${editable ? "" : "disabled"}>${Object.entries(PRIORITY).map(([value, label]) => `<option value="${value}" ${task.priority === value ? "selected" : ""}>${esc(label)}</option>`).join("")}</select></label>
          <label>Ước lượng (phút)<input type="number" min="0" max="100000" data-tc-edit-estimate value="${Number(task.estimateMinutes) || 0}" ${editable ? "" : "disabled"}></label>
          <label class="wide">Mô tả<textarea rows="4" data-tc-edit-description ${editable ? "" : "disabled"}>${esc(task.description || "")}</textarea></label>
        </section>
        ${editable ? `<div class="tc-inspector-actions"><button class="primary" type="button" data-tc-save-task="${attr(taskId(task))}">Lưu thay đổi</button><button class="danger" type="button" data-tc-delete-task="${attr(taskId(task))}">${data.pendingDeleteTaskId === taskId(task) ? "Xác nhận xóa" : "Xóa"}</button></div>` : `<p class="tc-permission-note">Vai trò ${esc(data.board.role)} chỉ được ${commentable ? "xem và bình luận" : "xem"}.</p>`}
        <section class="tc-inspector-section"><header><strong>Subtask</strong><span>${(task.subtasks || []).filter((item) => item.done).length}/${(task.subtasks || []).length}</span></header><div class="tc-subtasks">${(task.subtasks || []).map((item) => `<label><input type="checkbox" data-tc-toggle-subtask="${attr(item.id)}" ${item.done ? "checked" : ""} ${editable ? "" : "disabled"}><span>${esc(item.title)}</span><small>${esc(item.assignee || "")}</small>${editable ? `<button type="button" data-tc-remove-subtask="${attr(item.id)}" aria-label="Xóa subtask">×</button>` : ""}</label>`).join("") || `<p>Chưa có subtask.</p>`}</div>${editable ? `<div class="tc-inline-form"><input data-tc-subtask-title placeholder="Thêm subtask..."><button type="button" data-tc-add-subtask="${attr(taskId(task))}">Thêm</button></div>` : ""}</section>
        <section class="tc-inspector-section"><header><strong>Dependency</strong><span>${(task.dependencies || []).length}</span></header><div class="tc-dependencies">${(data.tasks || []).filter((item) => taskId(item) !== taskId(task)).map((item) => `<label><input type="checkbox" data-tc-dependency="${attr(taskId(item))}" ${(task.dependencies || []).map(String).includes(taskId(item)) ? "checked" : ""} ${editable ? "" : "disabled"}><span>${esc(item.title)}</span><small>${esc(STATUS[item.status])}</small></label>`).join("") || `<p>Chưa có công việc khác.</p>`}</div>${editable ? `<button type="button" data-tc-save-dependencies="${attr(taskId(task))}">Lưu dependency</button>` : ""}</section>
        <section class="tc-inspector-section"><header><strong>Bình luận & mention</strong><span>${task.comments?.length || 0}</span></header><div class="tc-comments">${(task.comments || []).map((item) => `<article><b>${initial(item.author?.name)}</b><div><strong>${esc(item.author?.name || "Thành viên")}</strong><p>${esc(item.text)}</p><small>${esc(formatTime(item.createdAt))}</small></div></article>`).join("") || `<p>Chưa có bình luận.</p>`}</div>${commentable ? `<div class="tc-inline-form"><input data-tc-comment-input placeholder="Viết bình luận, dùng @tên để mention..."><button type="button" data-tc-save-comment="${attr(taskId(task))}">Gửi</button></div>` : ""}</section>
        <section class="tc-inspector-section"><header><strong>Lịch sử phiên bản</strong><span>${history.length}</span></header><div class="tc-history">${history.map((item) => `<article><div><strong>Phiên bản ${Number(item.version) || 1}</strong><small>${esc(item.reason || "Cập nhật công việc")} · ${esc(formatTime(item.createdAt))}</small></div>${editable ? `<button type="button" data-tc-restore-version="${attr(item.id)}">Khôi phục</button>` : ""}</article>`).join("") || `<p>Chưa có phiên bản trước.</p>`}</div></section>
      </div>
    </aside>`;
  }

  function createPanel(data) {
    if (!can(data.board, "editor")) return `<section class="tc-create tc-create-locked"><strong>Chế độ ${esc(data.board.role)}</strong><p>Bạn có thể ${can(data.board, "commenter") ? "xem và bình luận" : "xem"}; chỉ editor hoặc owner mới tạo và chỉnh sửa task.</p></section>`;
    return `<details class="tc-create"><summary><span>＋</span><strong>Tạo công việc</strong><small>Task · Subtask · Dependency · Estimate</small></summary><div class="tc-create-body"><div class="tc-fields"><label>Tên công việc<input data-tc-title placeholder="Việc cần hoàn thành"></label><label>Người phụ trách<select data-tc-assignee><option value="">Chưa phân công</option>${(data.board.members || []).map((member) => `<option value="${attr(member.userId)}" data-name="${attr(member.name)}">${esc(member.name)}</option>`).join("")}</select></label><label>Deadline<input data-tc-due type="date"></label><label>Ưu tiên<select data-tc-priority>${Object.entries(PRIORITY).map(([value, label]) => `<option value="${value}">${esc(label)}</option>`).join("")}</select></label><label>Ước lượng (phút)<input data-tc-estimate type="number" min="0" value="60"></label><label>Dependency<select data-tc-dependency-create><option value="">Không có</option>${(data.tasks || []).map((task) => `<option value="${attr(taskId(task))}">${esc(task.title)}</option>`).join("")}</select></label></div><label>Mô tả<textarea data-tc-description rows="3" placeholder="Mục tiêu, tiêu chí hoàn thành, link tài liệu..."></textarea></label><footer><button class="primary" type="button" data-tc-add>Thêm vào workspace</button><button type="button" data-tc-export>Xuất JSON</button></footer></div></details>`;
  }

  function render(root, data = read()) {
    const board = data.board; const tasks = filteredTasks(data); const done = (data.tasks || []).filter((task) => task.status === "done").length; const estimate = (data.tasks || []).reduce((sum, task) => sum + (Number(task.estimateMinutes) || 0), 0);
    root.innerHTML = `<section class="tc-app">
      <header class="tc-hero"><div><span>HH TEAM OS · SHARED WORKSPACE</span><h4>${esc(board?.name || "Team Collaboration")}</h4><p>${esc(board?.description || "Lập kế hoạch, giao việc, thảo luận và kiểm soát thay đổi trong một nguồn dữ liệu chung.")}</p></div><div class="tc-hero-actions">${board ? `${can(board, "owner") ? `<button type="button" data-tc-share>Chia sẻ</button>` : ""}<button type="button" data-tc-sync>Đồng bộ</button>` : `<button class="primary" type="button" data-tc-create>＋ Tạo workspace</button>`}</div></header>
      <div class="tc-stats"><article><b>${data.tasks?.length || 0}</b><span>Công việc</span></article><article><b>${done}</b><span>Hoàn tất</span></article><article><b>${board?.members?.length || 0}</b><span>Thành viên</span></article><article><b>${esc(formatEstimate(estimate))}</b><span>Tổng estimate</span></article></div>
      ${board ? `<nav class="tc-workspace-nav" aria-label="Chế độ xem"><div>${[["board", "Board"], ["list", "List"], ["calendar", "Calendar"], ["timeline", "Timeline"]].map(([value, label]) => `<button type="button" data-tc-view="${value}" class="${data.view === value ? "is-active" : ""}">${label}</button>`).join("")}</div><label><span>⌕</span><input data-tc-search value="${attr(data.search || "")}" placeholder="Tìm task, assignee, label..."></label><button type="button" data-tc-export>Xuất JSON</button></nav>
        <div class="tc-layout"><aside class="tc-sidebar">${memberPanel(data)}${activityPanel(data)}<section class="tc-automation"><header><span>AUTOMATION</span><small>Server-side</small></header>${[["completeOnSubtasks", "Hoàn tất khi xong mọi subtask"], ["reopenOnSubtask", "Mở lại khi subtask chưa xong"], ["startOnAssignee", "Bắt đầu khi giao người phụ trách"]].map(([key, label]) => `<label><input type="checkbox" data-tc-automation="${key}" ${board.automations?.[key] ? "checked" : ""} ${can(board, "editor") ? "" : "disabled"}><span>${label}</span></label>`).join("")}</section></aside><main>${createPanel(data)}${data.view === "list" ? listView(data, tasks) : data.view === "calendar" ? calendarView(data, tasks) : data.view === "timeline" ? timelineView(data, tasks) : boardView(data, tasks)}</main>${inspector(data)}</div>` : `<section class="tc-onboard"><div><span>TEAM OS</span><h5>Bắt đầu workspace chung</h5><p>Tạo một board riêng có phân quyền viewer, commenter, editor và owner. Link mời không làm lộ dữ liệu trước khi người dùng đăng nhập.</p></div><label>Tên workspace<input data-tc-board-name placeholder="Ví dụ: HH Platform Sprint"></label><label>Mô tả<textarea data-tc-board-description rows="3" placeholder="Mục tiêu của nhóm..."></textarea></label><button class="primary" type="button" data-tc-create>Tạo workspace</button></section>`}
      <footer class="tc-footer"><span data-tc-status>${board ? "Sẵn sàng cộng tác." : "Tạo workspace để bắt đầu."}</span><small>MongoDB · Permission-aware · Versioned</small></footer>
    </section>`;
  }

  const replaceTask = (data, task) => ({ ...data, tasks: (data.tasks || []).map((item) => taskId(item) === taskId(task) ? task : item) });
  const hydrate = async (root) => {
    const local = read();
    if (!local.board?.id) return render(root, local);
    try {
      const data = await request({ query: `?boardId=${encodeURIComponent(local.board.id)}` });
      const next = { ...local, board: data.board, tasks: data.tasks || [], activity: data.activity || [] };
      save(next); render(root, next);
    } catch (error) { render(root, local); setStatus(root, error.message, "error"); }
  };
  const loadHistory = async (root, id) => {
    const local = read();
    if (!local.board?.id || !id) return;
    try {
      const data = await request({ query: `?boardId=${encodeURIComponent(local.board.id)}&action=task-history&taskId=${encodeURIComponent(id)}` });
      const next = patchState({ history: { ...(read().history || {}), [id]: data.versions || [] } }); render(root, next);
    } catch (error) { setStatus(root, error.message, "error"); }
  };
  const joinFromLink = async (root) => {
    const params = new URLSearchParams(location.search); const boardId = params.get("tc-board"); const shareToken = params.get("tc-token");
    if (!boardId || !shareToken || read().board?.id === boardId) return false;
    const data = await request({ method: "POST", body: { action: "join-board", boardId, shareToken } });
    save({ ...read(), board: data.board, tasks: [], activity: [] }); history.replaceState({}, "", `${location.pathname}${location.hash}`); await hydrate(root); return true;
  };
  const mount = (root) => {
    if (!root || root.dataset.tcMounted) return;
    root.dataset.tcMounted = "1";
    joinFromLink(root).catch((error) => { render(root, read()); setStatus(root, error.message, "error"); }).then((joined) => { if (!joined) hydrate(root); });
  };
  const download = (name, data) => { const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })); anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(anchor.href), 500); };
  const selectedOption = (select) => ({ id: select?.value || "", name: select?.selectedOptions?.[0]?.dataset.name || "" });
  const mutate = async (root, body, options = {}) => {
    setStatus(root, options.pending || "Đang lưu thay đổi...");
    const data = await request({ method: "POST", body });
    let local = read();
    if (data.board) local = { ...local, board: data.board };
    if (data.task) local = replaceTask(local, data.task);
    if (data.deleted) local = { ...local, tasks: (local.tasks || []).filter((item) => taskId(item) !== data.taskId), selectedTaskId: "", pendingDeleteTaskId: "" };
    save(local); render(root, local); setStatus(root, options.done || "Đã lưu thay đổi.", "success");
    if (options.refresh) await hydrate(root);
    return data;
  };

  document.addEventListener("input", (event) => {
    const root = event.target.closest('[data-extension-suite="team-collaboration"]');
    if (!root || !event.target.matches("[data-tc-search]")) return;
    const value = event.target.value; const next = patchState({ search: value });
    const main = root.querySelector(".tc-layout>main");
    if (main) main.innerHTML = `${createPanel(next)}${next.view === "list" ? listView(next, filteredTasks(next)) : next.view === "calendar" ? calendarView(next, filteredTasks(next)) : next.view === "timeline" ? timelineView(next, filteredTasks(next)) : boardView(next, filteredTasks(next))}`;
  });

  document.addEventListener("change", async (event) => {
    const root = event.target.closest('[data-extension-suite="team-collaboration"]');
    if (!root) return;
    const local = read();
    try {
      if (event.target.matches("[data-tc-member-role]")) {
        await mutate(root, { action: "update-member-role", boardId: local.board.id, userId: event.target.dataset.tcMemberRole, role: event.target.value }, { done: "Đã cập nhật quyền thành viên.", refresh: true });
      }
      if (event.target.matches("[data-tc-automation]")) {
        const automations = { ...(local.board.automations || {}), [event.target.dataset.tcAutomation]: event.target.checked };
        const data = await request({ method: "POST", body: { action: "update-automation", boardId: local.board.id, automations } });
        const next = { ...read(), board: { ...read().board, automations: data.automations } }; save(next); render(root, next); setStatus(root, "Đã cập nhật automation.", "success");
      }
      if (event.target.matches("[data-tc-toggle-subtask]")) {
        await mutate(root, { action: "toggle-subtask", boardId: local.board.id, taskId: local.selectedTaskId, subtaskId: event.target.dataset.tcToggleSubtask, done: event.target.checked }, { done: "Đã cập nhật subtask.", refresh: true });
      }
    } catch (error) { setStatus(root, error.message, "error"); await hydrate(root); }
  });

  document.addEventListener("click", async (event) => {
    const root = event.target.closest('[data-extension-suite="team-collaboration"]');
    if (!root) return;
    const local = read(); const board = local.board;
    try {
      const view = event.target.closest("[data-tc-view]");
      if (view) { render(root, patchState({ view: view.dataset.tcView, selectedTaskId: "" })); return; }
      if (event.target.closest("[data-tc-create]")) {
        const name = root.querySelector("[data-tc-board-name]")?.value.trim() || "Nhóm HH"; const description = root.querySelector("[data-tc-board-description]")?.value.trim() || "";
        const data = await request({ method: "POST", body: { action: "create-board", name, description } }); save({ ...read(), board: data.board, tasks: [], activity: [] }); await hydrate(root); return;
      }
      if (event.target.closest("[data-tc-sync]")) { await hydrate(root); setStatus(root, "Đã đồng bộ dữ liệu mới nhất.", "success"); return; }
      if (event.target.closest("[data-tc-share]")) {
        if (!board?.shareToken) throw new Error("Chỉ owner mới tạo được link mời.");
        const link = `${location.origin}${location.pathname}?tc-board=${encodeURIComponent(board.id)}&tc-token=${encodeURIComponent(board.shareToken)}#/work/team-collaboration`;
        await navigator.clipboard.writeText(link); setStatus(root, "Đã sao chép link mời an toàn.", "success"); return;
      }
      if (event.target.closest("[data-tc-add]")) {
        const assignee = selectedOption(root.querySelector("[data-tc-assignee]")); const dependency = root.querySelector("[data-tc-dependency-create]")?.value;
        const data = await request({ method: "POST", body: { action: "create-task", boardId: board.id, title: root.querySelector("[data-tc-title]").value, description: root.querySelector("[data-tc-description]").value, assignee: assignee.name, assigneeId: assignee.id, dueDate: root.querySelector("[data-tc-due]").value, priority: root.querySelector("[data-tc-priority]").value, estimateMinutes: root.querySelector("[data-tc-estimate]").value, dependencies: dependency ? [dependency] : [] } });
        save({ ...local, tasks: [data.task, ...(local.tasks || [])] }); render(root, read()); setStatus(root, "Đã tạo công việc.", "success"); return;
      }
      if (event.target.closest("[data-tc-export]")) { download("hh-team-workspace.json", { board: local.board, tasks: local.tasks, activity: local.activity }); return; }
      if (event.target.closest("[data-tc-close-task]")) { render(root, patchState({ selectedTaskId: "", pendingDeleteTaskId: "" })); return; }

      const move = event.target.closest("[data-tc-move]");
      if (move) { const current = taskById(local, move.dataset.tcTask); const index = STATUS_ORDER.indexOf(current.status); const status = STATUS_ORDER[Math.max(0, Math.min(STATUS_ORDER.length - 1, index + Number(move.dataset.tcMove)))]; await mutate(root, { action: "update-task", boardId: board.id, taskId: taskId(current), status, reason: "Di chuyển trên Board" }, { done: `Đã chuyển sang ${STATUS[status]}.`, refresh: true }); return; }

      const open = event.target.closest("[data-tc-open-task]");
      if (open) { const id = open.dataset.tcOpenTask || open.closest("[data-tc-task]")?.dataset.tcTask; render(root, patchState({ selectedTaskId: id, pendingDeleteTaskId: "" })); loadHistory(root, id); return; }

      const saveTask = event.target.closest("[data-tc-save-task]");
      if (saveTask) {
        const inspector = saveTask.closest("[data-tc-inspector]"); const assignee = selectedOption(inspector.querySelector("[data-tc-edit-assignee]"));
        await mutate(root, { action: "update-task", boardId: board.id, taskId: saveTask.dataset.tcSaveTask, title: inspector.querySelector("[data-tc-edit-title]").value, description: inspector.querySelector("[data-tc-edit-description]").value, status: inspector.querySelector("[data-tc-edit-status]").value, priority: inspector.querySelector("[data-tc-edit-priority]").value, assignee: assignee.name, assigneeId: assignee.id, dueDate: inspector.querySelector("[data-tc-edit-due]").value, estimateMinutes: inspector.querySelector("[data-tc-edit-estimate]").value, reason: "Chỉnh sửa từ task inspector" }, { done: "Đã lưu công việc.", refresh: true }); return;
      }

      const addSubtask = event.target.closest("[data-tc-add-subtask]");
      if (addSubtask) { const input = addSubtask.parentElement.querySelector("[data-tc-subtask-title]"); if (!input.value.trim()) return; await mutate(root, { action: "add-subtask", boardId: board.id, taskId: addSubtask.dataset.tcAddSubtask, title: input.value }, { done: "Đã thêm subtask.", refresh: true }); return; }
      const removeSubtask = event.target.closest("[data-tc-remove-subtask]");
      if (removeSubtask) { await mutate(root, { action: "remove-subtask", boardId: board.id, taskId: local.selectedTaskId, subtaskId: removeSubtask.dataset.tcRemoveSubtask }, { done: "Đã xóa subtask.", refresh: true }); return; }
      const dependencies = event.target.closest("[data-tc-save-dependencies]");
      if (dependencies) { const values = [...dependencies.closest(".tc-inspector-section").querySelectorAll("[data-tc-dependency]:checked")].map((input) => input.dataset.tcDependency); await mutate(root, { action: "set-dependencies", boardId: board.id, taskId: dependencies.dataset.tcSaveDependencies, dependencies: values, reason: "Cập nhật dependency" }, { done: "Đã lưu dependency.", refresh: true }); return; }
      const comment = event.target.closest("[data-tc-save-comment]");
      if (comment) { const input = comment.parentElement.querySelector("[data-tc-comment-input]"); if (!input.value.trim()) return; await mutate(root, { action: "comment", boardId: board.id, taskId: comment.dataset.tcSaveComment, comment: input.value }, { done: "Đã gửi bình luận.", refresh: true }); return; }
      const restore = event.target.closest("[data-tc-restore-version]");
      if (restore) { await mutate(root, { action: "restore-task-version", boardId: board.id, taskId: local.selectedTaskId, versionId: restore.dataset.tcRestoreVersion, reason: "Khôi phục từ lịch sử" }, { done: "Đã khôi phục phiên bản.", refresh: true }); await loadHistory(root, local.selectedTaskId); return; }
      const remove = event.target.closest("[data-tc-delete-task]");
      if (remove) {
        if (local.pendingDeleteTaskId !== remove.dataset.tcDeleteTask) { render(root, patchState({ pendingDeleteTaskId: remove.dataset.tcDeleteTask })); setStatus(root, "Nhấn Xác nhận xóa để hoàn tất."); return; }
        await mutate(root, { action: "delete-task", boardId: board.id, taskId: remove.dataset.tcDeleteTask, reason: "Xóa từ task inspector" }, { done: "Đã xóa công việc.", refresh: true }); return;
      }
    } catch (error) { setStatus(root, error.message, "error"); }
  });

  document.addEventListener("keydown", (event) => {
    const open = event.target.closest?.("[data-tc-open-task]");
    if (open && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); open.click(); }
  });
  document.addEventListener("dragstart", (event) => { const card = event.target.closest?.("[data-tc-task]"); if (card && event.dataTransfer) { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/tc-task", card.dataset.tcTask); } });
  document.addEventListener("dragover", (event) => { if (event.target.closest?.("[data-tc-drop-status]")) event.preventDefault(); });
  document.addEventListener("drop", async (event) => {
    const column = event.target.closest?.("[data-tc-drop-status]"); const root = event.target.closest?.('[data-extension-suite="team-collaboration"]');
    if (!column || !root || !event.dataTransfer) return;
    event.preventDefault(); const id = event.dataTransfer.getData("text/tc-task"); const local = read();
    try { await mutate(root, { action: "update-task", boardId: local.board.id, taskId: id, status: column.dataset.tcDropStatus, reason: "Kéo thả trên Board" }, { done: `Đã chuyển sang ${STATUS[column.dataset.tcDropStatus]}.`, refresh: true }); }
    catch (error) { setStatus(root, error.message, "error"); }
  });

  const observer = new MutationObserver(() => mount(currentRoot()));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  mount(currentRoot());
})();
