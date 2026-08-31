(function (globalScope, factory) {
  "use strict";
  var dataApi = globalScope && globalScope.HHGalaxyLayerOneData;
  if (!dataApi && typeof require === "function") {
    try { dataApi = require("./galaxy-layer-one-data.js"); } catch (error) { /* Browser builds provide the data API globally. */ }
  }
  var api = factory(globalScope || {}, dataApi);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (globalScope) globalScope.HHGalaxyCreatorStudio = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (globalScope, Data) {
  "use strict";

  var VERSION = "1.0.0";
  var ROUTE = "/galaxy/creator";
  var mounted = new Set();
  var instances = new WeakMap();

  var ICONS = Object.freeze({
    sparkles: '<path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z"/><path d="m5 14 .8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z"/><path d="m19 13 .7 1.8 1.8.7-1.8.7L19 18l-.7-1.8-1.8-.7 1.8-.7L19 13Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    download: '<path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"/>',
    upload: '<path d="M12 16V4m0 0 4 4m-4-4L8 8M5 20h14"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    folder: '<path d="M3 7h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d="M3 7V5a2 2 0 0 1 2-2h5l2 2h5"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    projects: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 2v4m8-4v4M3 9h18"/>',
    activity: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M12 13v5m-4 3h8m-6-3h4"/>',
    lightbulb: '<path d="M9 18h6m-5 3h4m3-10a5 5 0 1 0-10 0c0 2 2 3 2 5h6c0-2 2-3 2-5Z"/>',
    "file-pen": '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M14 3v6h6M8 15l5-5 2 2-5 5-3 1 1-3Z"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/>',
    mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/>',
    music: '<path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
    video: '<rect x="3" y="5" width="14" height="14" rx="2"/><path d="m17 10 4-3v10l-4-3v-4Z"/><path d="m9 9 4 3-4 3V9Z"/>',
    layout: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/>',
    rocket: '<path d="M14 5c3-3 6-2 6-2s1 3-2 6l-5 5-4-4 5-5Z"/><path d="m9 10-4 1-2 3 6 1m4-1 1 6 3-2 1-5M7 17l-3 3"/><circle cx="16" cy="7" r="1"/>',
    save: '<path d="M5 3h12l4 4v14H3V3h2Z"/><path d="M7 3v6h10V3M7 21v-8h10v8"/>',
    note: '<path d="M5 3h14a2 2 0 0 1 2 2v10l-6 6H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M15 21v-6h6M7 8h10M7 12h7"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    refresh: '<path d="M20 6v5h-5M4 18v-5h5"/><path d="M18 9a7 7 0 0 0-12-3L4 8m2 7a7 7 0 0 0 12 3l2-2"/>',
    alert: '<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5m0 3h.01"/>'
  });

  function icon(name, label) {
    var body = ICONS[name] || ICONS.sparkles;
    return '<svg class="gcs-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"' + (label ? ' role="img" aria-label="' + escapeHtml(label) + '"' : ' aria-hidden="true"') + '>' + body + '</svg>';
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character];
    });
  }

  function normalizeRoute(value) {
    var route = String(value || ROUTE).trim();
    var hashIndex = route.indexOf("#");
    if (hashIndex >= 0) route = route.slice(hashIndex + 1);
    route = route.split("?")[0].split("&")[0];
    if (!route.startsWith("/")) route = "/" + route;
    return route.replace(/\/+$/, "") || "/";
  }

  function canHandle(route) { return normalizeRoute(route) === ROUTE; }

  function formatDate(value, options) {
    var date = new Date(value || "");
    if (!Number.isFinite(date.getTime())) return "Chưa cập nhật";
    try { return new Intl.DateTimeFormat("vi-VN", options || { dateStyle: "medium", timeStyle: "short" }).format(date); }
    catch (error) { return date.toISOString().slice(0, 16).replace("T", " "); }
  }

  function relativeTime(value, nowValue) {
    var date = new Date(value || "");
    var now = new Date(nowValue || Date.now());
    if (!Number.isFinite(date.getTime()) || !Number.isFinite(now.getTime())) return "Chưa cập nhật";
    var minutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60000));
    if (minutes < 1) return "Vừa cập nhật";
    if (minutes < 60) return "Cập nhật " + minutes + " phút trước";
    var hours = Math.round(minutes / 60);
    if (hours < 24) return "Cập nhật " + hours + " giờ trước";
    return "Cập nhật " + Math.round(hours / 24) + " ngày trước";
  }

  function sameDay(value, reference) {
    var left = new Date(value || "");
    var right = new Date(reference || Date.now());
    return Number.isFinite(left.getTime()) && left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
  }

  function stepById(id) {
    return Data.PIPELINE_STEPS.find(function (step) { return step.id === id; }) || Data.PIPELINE_STEPS[0];
  }

  function stepStatus(id) {
    return Data.STEP_STATUSES.find(function (status) { return status.id === id; }) || Data.STEP_STATUSES[0];
  }

  function badge(project) {
    return project.isDemo ? '<span class="gcs-demo-badge">Bản mẫu</span>' : '<span class="gcs-user-badge">Dữ liệu của bạn</span>';
  }

  function statusPill(statusId) {
    var status = stepStatus(statusId);
    return '<span class="gcs-status-pill" data-status="' + escapeHtml(status.id) + '"><i aria-hidden="true"></i>' + escapeHtml(status.label) + '</span>';
  }

  function progressMarkup(project, compact) {
    var value = Data.progressOf(project);
    return '<div class="gcs-progress' + (compact ? ' gcs-progress--compact' : '') + '" aria-label="Tiến độ ' + value + '%"><span class="gcs-progress__track"><i style="--progress:' + value + '%"></i></span><strong>' + value + '%</strong></div>';
  }

  function pipelineMarkup(project, selectedStepId) {
    var steps = project && project.steps || {};
    return '<ol class="gcs-pipeline" aria-label="Quy trình sáng tạo 9 bước">' + Data.PIPELINE_STEPS.map(function (definition) {
      var status = stepStatus((steps[definition.id] || {}).status);
      var selected = definition.id === selectedStepId;
      return '<li class="gcs-pipeline__item" data-tone="' + definition.tone + '" data-step-state="' + status.id + '"><button type="button" data-gcs-step="' + definition.id + '" aria-label="Bước ' + definition.number + ': ' + escapeHtml(definition.label) + ', ' + escapeHtml(status.label) + '"' + (selected ? ' aria-current="step"' : '') + '><span class="gcs-pipeline__orb">' + icon(definition.icon) + '<i class="gcs-pipeline__check">' + icon("check") + '</i></span><strong>' + definition.number + '. ' + escapeHtml(definition.label) + '</strong><small>' + escapeHtml(definition.title) + '</small></button></li>';
    }).join("") + '</ol>';
  }

  function headerMarkup(runtime, project) {
    var inactive = runtime.modal ? ' inert aria-hidden="true"' : '';
    return '<header class="gcs-topbar"' + inactive + '><div class="gcs-title-lockup"><span class="gcs-title-icon">' + icon("sparkles") + '</span><div><p>HH GALAXY · LỚP 1</p><h2>Creator Pipeline <span>— Quy trình sáng tạo nội dung</span></h2></div></div><label class="gcs-search"><span>' + icon("search") + '</span><input type="search" data-gcs-search placeholder="Tìm dự án của bạn..." autocomplete="off"><kbd>⌘K</kbd></label><div class="gcs-top-actions"><button class="gcs-button gcs-button--quiet" type="button" data-gcs-action="import" aria-label="Nhập JSON">' + icon("upload") + '<span>Nhập JSON</span></button><button class="gcs-button gcs-button--quiet" type="button" data-gcs-action="export" aria-label="Xuất JSON">' + icon("download") + '<span>Xuất JSON</span></button><button class="gcs-button gcs-button--primary" type="button" data-gcs-action="create">' + icon("plus") + '<span>Tạo dự án mới</span></button><input type="file" accept="application/json,.json" data-gcs-import hidden></div></header><section class="gcs-pipeline-panel" aria-labelledby="gcs-pipeline-title"' + inactive + '><div class="gcs-panel-heading"><div><span class="gcs-eyebrow">PIPELINE 9 BƯỚC</span><h2 id="gcs-pipeline-title">' + escapeHtml(project ? project.title : "Chưa có dự án") + '</h2></div>' + (project ? badge(project) : '') + '</div>' + (project ? pipelineMarkup(project, runtime.selectedStepId) : '<div class="gcs-inline-empty">Tạo dự án để bắt đầu quy trình.</div>') + (project ? '<div class="gcs-overall"><span>Tiến độ tổng thể dự án</span>' + progressMarkup(project, false) + '<span class="gcs-current-step">Bước đang chọn: <strong>' + escapeHtml(stepById(runtime.selectedStepId).number + '. ' + stepById(runtime.selectedStepId).label) + '</strong></span></div>' : '') + '</section>';
  }

  function projectCardMarkup(project, nowValue) {
    var current = Data.PIPELINE_STEPS.find(function (step) { return project.steps[step.id].status !== "completed"; }) || Data.PIPELINE_STEPS[Data.PIPELINE_STEPS.length - 1];
    return '<article class="gcs-project-card" data-gcs-project-card data-search="' + escapeHtml((project.title + " " + project.category + " " + project.tags.join(" ")).toLocaleLowerCase("vi-VN")) + '" data-tone="' + escapeHtml(project.accent) + '"><div class="gcs-project-art" aria-hidden="true"><span class="gcs-project-art__planet"></span><span class="gcs-project-art__orbit"></span><span class="gcs-project-type">' + escapeHtml(project.category) + '</span><span class="gcs-project-step">' + escapeHtml(current.label) + '</span></div><div class="gcs-project-body"><div class="gcs-project-meta">' + badge(project) + '<span>' + escapeHtml(current.title) + '</span></div><h3>' + escapeHtml(project.title) + '</h3><p>' + escapeHtml(project.description || "Chưa có mô tả dự án.") + '</p>' + progressMarkup(project, true) + '<footer><span>' + icon("clock") + escapeHtml(relativeTime(project.updatedAt, nowValue)) + '</span><div class="gcs-card-actions">' + (project.isDemo ? '<button type="button" data-gcs-action="clone" data-project-id="' + escapeHtml(project.id) + '">' + icon("copy") + '<span>Tạo bản sao</span></button><button type="button" class="gcs-icon-action" data-gcs-action="hide-demo" data-project-id="' + escapeHtml(project.id) + '" aria-label="Ẩn bản mẫu">' + icon("close") + '</button>' : '') + '<button type="button" data-gcs-action="open" data-project-id="' + escapeHtml(project.id) + '">Mở ' + icon("arrow") + '</button></div></footer></div></article>';
  }

  function scheduleMarkup(runtime, snapshot) {
    var nowValue = runtime.now();
    var userToday = snapshot.schedule.filter(function (item) { return !item.isDemo && item.at && sameDay(item.at, nowValue); }).sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
    var samples = snapshot.schedule.filter(function (item) { return item.isDemo; }).slice(0, 4);
    var items = userToday.length ? userToday : samples;
    return '<section class="gcs-side-card gcs-schedule" aria-labelledby="gcs-schedule-title"><header><div><span class="gcs-eyebrow">KẾ HOẠCH</span><h2 id="gcs-schedule-title">' + (userToday.length ? 'Lịch trình hôm nay' : 'Lịch mẫu') + '</h2></div><button type="button" data-gcs-action="schedule">' + icon("plus") + '<span>Thêm</span></button></header>' + (items.length ? '<ol>' + items.map(function (item) {
      var definition = stepById(item.stepId);
      var time = item.at ? new Date(item.at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : (item.time || "--:--");
      return '<li data-tone="' + definition.tone + '"><time datetime="' + escapeHtml(item.at || item.time || "") + '">' + escapeHtml(time) + '</time><i aria-hidden="true"></i><div><strong>' + escapeHtml(item.title) + '</strong><span>' + escapeHtml(item.note || definition.title) + '</span>' + (item.isDemo ? '<small class="gcs-demo-badge">Dữ liệu mẫu</small>' : '') + '</div><span class="gcs-schedule-icon">' + icon(definition.icon) + '</span></li>';
    }).join("") + '</ol>' : '<div class="gcs-empty-mini"><span>' + icon("calendar") + '</span><strong>Chưa có lịch hôm nay</strong><p>Thêm một mốc công việc để lịch phản ánh dữ liệu của bạn.</p></div>') + '</section>';
  }

  function statsMarkup(runtime) {
    var stats = runtime.store.getStats(runtime.now());
    var definitions = [
      { label: "Dự án của bạn", value: stats.totalProjects, icon: "projects", tone: "violet", note: "Không tính bản mẫu" },
      { label: "Đang thực hiện", value: stats.activeProjects, icon: "activity", tone: "cyan", note: "Có tiến độ 1–99%" },
      { label: "Đã hoàn thành", value: stats.completedProjects, icon: "trophy", tone: "green", note: "Đủ 9 bước" },
      { label: "Bước hoàn tất", value: stats.completedSteps, icon: "check", tone: "gold", note: "Từ dự án của bạn" }
    ];
    return '<section class="gcs-side-card gcs-stats" aria-labelledby="gcs-stats-title"><header><div><span class="gcs-eyebrow">DỮ LIỆU THẬT</span><h2 id="gcs-stats-title">Thống kê nhanh</h2></div><span class="gcs-local-label">Local-first</span></header><div class="gcs-stats-grid">' + definitions.map(function (item) {
      return '<article data-tone="' + item.tone + '"><span>' + icon(item.icon) + '</span><div><small>' + escapeHtml(item.label) + '</small><strong>' + item.value + '</strong><em>' + escapeHtml(item.note) + '</em></div></article>';
    }).join("") + '</div><p class="gcs-stats-note">Không hiển thị lượt xem, doanh thu hoặc người đăng ký khi chưa có nguồn dữ liệu thật.</p></section>';
  }

  function toolsMarkup(project) {
    return '<section class="gcs-tools" aria-labelledby="gcs-tools-title"><header><div><span class="gcs-eyebrow">EDITOR NỘI BỘ LỚP 1</span><h2 id="gcs-tools-title">Công cụ & phím tắt</h2></div><span>Chọn công cụ để mở đúng bước trong dự án</span></header><div class="gcs-tools-grid">' + Data.PIPELINE_STEPS.map(function (step) {
      return '<button type="button" data-gcs-action="tool" data-step-id="' + step.id + '" data-tone="' + step.tone + '"' + (!project ? ' disabled' : '') + '><span>' + icon(step.icon) + '</span><strong>' + escapeHtml(step.label === "SCRIPT" ? "AI Script Writer" : step.label === "IMAGE" ? "Image Board" : step.label === "VOICE" ? "Voice Notes" : step.label === "MUSIC" ? "Music Brief" : step.label === "VIDEO" ? "Video Planner" : step.label === "THUMBNAIL" ? "Thumbnail Maker" : step.label === "SEO" ? "SEO Planner" : step.label === "PUBLISH" ? "Publish Manager" : "Idea Canvas") + '</strong><small>' + escapeHtml(step.title) + '</small></button>';
    }).join("") + '</div></section>';
  }

  function dashboardMarkup(runtime, snapshot, project) {
    var ordered = snapshot.projects.slice().sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
    var visible = ordered.slice(0, 6);
    var userCount = snapshot.projects.filter(function (item) { return !item.isDemo; }).length;
    return '<div class="gcs-dashboard"><div class="gcs-dashboard__main"><section class="gcs-recent" aria-labelledby="gcs-recent-title"><header><div><span class="gcs-eyebrow">WORKSPACE</span><h2 id="gcs-recent-title">Dự án gần đây</h2></div><span class="gcs-count" data-gcs-result-count>' + visible.length + ' mục</span></header>' + (userCount === 0 ? '<div class="gcs-user-empty"><span>' + icon("folder") + '</span><div><strong>Chưa có dự án của bạn</strong><p>Các thẻ có nhãn “Bản mẫu” chỉ để tham khảo và không được tính vào thống kê. Tạo bản sao để bắt đầu chỉnh sửa.</p></div><button class="gcs-button gcs-button--primary" type="button" data-gcs-action="create">' + icon("plus") + 'Tạo dự án</button></div>' : '') + '<div class="gcs-project-grid" data-gcs-project-grid>' + visible.map(function (item) { return projectCardMarkup(item, runtime.now()); }).join("") + '</div><div class="gcs-search-empty" data-gcs-search-empty hidden><span>' + icon("search") + '</span><strong>Không tìm thấy dự án</strong><p>Thử từ khóa khác.</p></div>' + (snapshot.hiddenDemoIds.length ? '<button class="gcs-restore-demo" type="button" data-gcs-action="restore-demos">' + icon("refresh") + 'Khôi phục bản mẫu đã ẩn</button>' : '') + '</section>' + toolsMarkup(project) + '</div><aside class="gcs-dashboard__rail">' + scheduleMarkup(runtime, snapshot) + statsMarkup(runtime) + '</aside></div>';
  }

  function checklistMarkup(project, step) {
    var editable = !project.isDemo && project.editable !== false;
    return '<div class="gcs-checklist"><header><div><h3>Checklist</h3><span>' + step.checklist.filter(function (item) { return item.done; }).length + '/' + step.checklist.length + ' hoàn thành</span></div></header>' + (step.checklist.length ? '<ul>' + step.checklist.map(function (item) {
      return '<li' + (item.done ? ' class="is-done"' : '') + '><label><input type="checkbox" data-gcs-check-toggle="' + escapeHtml(item.id) + '"' + (item.done ? ' checked' : '') + (!editable ? ' disabled' : '') + '><span>' + icon("check") + '</span><em>' + escapeHtml(item.text) + '</em></label>' + (editable ? '<button type="button" data-gcs-action="remove-check" data-check-id="' + escapeHtml(item.id) + '" aria-label="Xóa mục ' + escapeHtml(item.text) + '">' + icon("close") + '</button>' : '') + '</li>';
    }).join("") + '</ul>' : '<p class="gcs-checklist-empty">Chưa có mục kiểm tra.</p>') + (editable ? '<form data-gcs-check-form><label><span class="gcs-sr-only">Thêm mục kiểm tra</span><input name="checkText" maxlength="240" placeholder="Thêm mục kiểm tra..."><button type="submit" aria-label="Thêm mục kiểm tra">' + icon("plus") + '</button></label></form>' : '') + '</div>';
  }

  function editorMarkup(runtime, project) {
    var definition = stepById(runtime.selectedStepId);
    var step = project.steps[definition.id];
    var editable = !project.isDemo && project.editable !== false;
    return '<section class="gcs-editor" aria-labelledby="gcs-editor-title"><header class="gcs-editor__header"><button class="gcs-back" type="button" data-gcs-action="dashboard">' + icon("back") + '<span>Quay lại tổng quan</span></button><div><span class="gcs-eyebrow">DỰ ÁN ĐANG MỞ</span><h2 id="gcs-editor-title">' + escapeHtml(project.title) + '</h2></div><div class="gcs-editor__actions">' + badge(project) + '<span class="gcs-save-state" data-gcs-save-state data-state="saved">' + icon("save") + '<span>' + (editable ? "Đã lưu cục bộ" : "Chỉ đọc") + '</span></span>' + (project.isDemo ? '<button class="gcs-button gcs-button--primary" type="button" data-gcs-action="clone" data-project-id="' + escapeHtml(project.id) + '">' + icon("copy") + 'Tạo bản sao để sửa</button>' : '<button class="gcs-button gcs-button--danger" type="button" data-gcs-action="delete" aria-label="Xóa dự án" data-project-id="' + escapeHtml(project.id) + '">' + icon("trash") + '<span>Xóa dự án</span></button>') + '</div></header>' + (project.isDemo ? '<div class="gcs-readonly-note" role="note">' + icon("eye") + '<div><strong>Đây là bản mẫu chỉ đọc</strong><span>Tạo bản sao để chỉnh sửa nội dung, trạng thái và checklist. Bản mẫu không được tính vào thống kê.</span></div></div>' : '') + '<div class="gcs-project-settings"><label><span>Tên dự án</span><input data-gcs-project-field="title" maxlength="180" value="' + escapeHtml(project.title) + '"' + (!editable ? ' readonly' : '') + '></label><label><span>Mô tả</span><input data-gcs-project-field="description" maxlength="1000" value="' + escapeHtml(project.description) + '"' + (!editable ? ' readonly' : '') + '></label></div><div class="gcs-workspace"><section class="gcs-workspace__canvas" data-tone="' + definition.tone + '" aria-labelledby="gcs-workspace-title"><header><span class="gcs-workspace__icon">' + icon(definition.icon) + '</span><div><span>BƯỚC ' + definition.number + ' / 9</span><h2 id="gcs-workspace-title">' + escapeHtml(definition.label + " · " + definition.title) + '</h2><p>' + escapeHtml(definition.placeholder) + '</p></div>' + statusPill(step.status) + '</header><div class="gcs-workspace__fields"><label><span>Nội dung chính</span><textarea data-gcs-step-field="content" rows="10" maxlength="30000" placeholder="' + escapeHtml(definition.placeholder) + '"' + (!editable ? ' readonly' : '') + '>' + escapeHtml(step.content) + '</textarea></label><label><span>Ghi chú cho bước này</span><textarea data-gcs-step-field="notes" rows="4" maxlength="10000" placeholder="Quyết định, phản hồi hoặc điều cần kiểm tra..."' + (!editable ? ' readonly' : '') + '>' + escapeHtml(step.notes) + '</textarea></label></div></section><aside class="gcs-workspace__aside"><section class="gcs-status-card"><header><h3>Trạng thái bước</h3><span>Cập nhật tiến độ thật</span></header><div role="radiogroup" aria-label="Trạng thái ' + escapeHtml(definition.title) + '">' + Data.STEP_STATUSES.map(function (status) {
      return '<label data-status="' + status.id + '"><input type="radio" name="stepStatus" data-gcs-step-status value="' + status.id + '"' + (step.status === status.id ? ' checked' : '') + (!editable ? ' disabled' : '') + '><span><i></i><strong>' + escapeHtml(status.label) + '</strong><small>' + Math.round(status.weight * 100) + '% trọng số bước</small></span></label>';
    }).join("") + '</div></section>' + checklistMarkup(project, step) + '<section class="gcs-metadata"><h3>Thông tin phiên bản</h3><dl><div><dt>Cập nhật bước</dt><dd>' + escapeHtml(formatDate(step.updatedAt)) + '</dd></div><div><dt>Cập nhật dự án</dt><dd>' + escapeHtml(formatDate(project.updatedAt)) + '</dd></div><div><dt>Nguồn</dt><dd>' + escapeHtml(project.source) + '</dd></div>' + (project.templateVersion ? '<div><dt>Phiên bản mẫu</dt><dd>' + escapeHtml(project.templateVersion) + '</dd></div>' : '') + '</dl></section></aside></div></section>';
  }

  function modalMarkup(runtime) {
    if (!runtime.modal) return "";
    if (runtime.modal === "create") {
      return '<div class="gcs-modal" data-gcs-modal role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="gcs-modal-title"><button class="gcs-modal__close" type="button" data-gcs-action="close-modal" aria-label="Đóng">' + icon("close") + '</button><span class="gcs-modal__icon">' + icon("sparkles") + '</span><h2 id="gcs-modal-title">Tạo dự án Creator mới</h2><p>Đây là dự án riêng của lớp 1 và được lưu cục bộ trên thiết bị này.</p><form data-gcs-create-form><label><span>Tên dự án</span><input name="title" maxlength="180" required autofocus placeholder="Ví dụ: Hành trình qua Dải Ngân Hà"></label><label><span>Loại nội dung</span><select name="category"><option>Nội dung</option><option>AI Visual</option><option>Video</option><option>Âm nhạc</option><option>Podcast</option><option>Giáo dục</option></select></label><label><span>Mô tả ngắn</span><textarea name="description" maxlength="1000" rows="3" placeholder="Mục tiêu và kết quả mong muốn..."></textarea></label><div><button class="gcs-button gcs-button--quiet" type="button" data-gcs-action="close-modal">Hủy</button><button class="gcs-button gcs-button--primary" type="submit">' + icon("plus") + 'Tạo dự án</button></div></form></section></div>';
    }
    if (runtime.modal === "schedule") {
      var min = new Date(runtime.now()).toISOString().slice(0, 16);
      return '<div class="gcs-modal" data-gcs-modal role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="gcs-modal-title"><button class="gcs-modal__close" type="button" data-gcs-action="close-modal" aria-label="Đóng">' + icon("close") + '</button><span class="gcs-modal__icon">' + icon("calendar") + '</span><h2 id="gcs-modal-title">Thêm lịch công việc</h2><p>Lịch này là dữ liệu của bạn; lịch mẫu vẫn được gắn nhãn riêng.</p><form data-gcs-schedule-form><label><span>Tên công việc</span><input name="title" maxlength="180" required autofocus placeholder="Ví dụ: Duyệt bản dựng"></label><label><span>Thời gian</span><input type="datetime-local" name="at" min="' + escapeHtml(min) + '" required></label><label><span>Bước liên quan</span><select name="stepId">' + Data.PIPELINE_STEPS.map(function (step) { return '<option value="' + step.id + '">' + step.number + '. ' + escapeHtml(step.label) + '</option>'; }).join("") + '</select></label><label><span>Ghi chú</span><input name="note" maxlength="500" placeholder="Thông tin cần chuẩn bị..."></label><div><button class="gcs-button gcs-button--quiet" type="button" data-gcs-action="close-modal">Hủy</button><button class="gcs-button gcs-button--primary" type="submit">' + icon("plus") + 'Thêm lịch</button></div></form></section></div>';
    }
    return "";
  }

  function toastMarkup(runtime) {
    if (!runtime.toast) return '<div class="gcs-toast" data-gcs-toast role="status" aria-live="polite" hidden></div>';
    return '<div class="gcs-toast" data-gcs-toast data-kind="' + escapeHtml(runtime.toast.kind || "info") + '" role="status" aria-live="polite">' + icon(runtime.toast.kind === "error" ? "alert" : "check") + '<span>' + escapeHtml(runtime.toast.message) + '</span></div>';
  }

  function renderMarkup(runtime) {
    var snapshot = runtime.store.getSnapshot();
    var project = runtime.activeProjectId && runtime.store.getProject(runtime.activeProjectId);
    if (!project) {
      project = snapshot.projects.find(function (item) { return !item.isDemo; }) || snapshot.projects[0] || null;
      runtime.activeProjectId = project && project.id || null;
    }
    if (project && !project.steps[runtime.selectedStepId]) runtime.selectedStepId = Data.PIPELINE_STEPS[0].id;
    return '<section class="gcs-app" data-gcs-app data-gcs-view="' + escapeHtml(runtime.view) + '"><a class="gcs-skip" href="#gcs-main">Bỏ qua đến nội dung Creator Studio</a>' + headerMarkup(runtime, project) + '<div id="gcs-main" class="gcs-main" role="region" aria-label="Nội dung Creator Studio" tabindex="-1"' + (runtime.modal ? ' inert aria-hidden="true"' : '') + '>' + (runtime.view === "editor" && project ? editorMarkup(runtime, project) : dashboardMarkup(runtime, snapshot, project)) + '</div>' + modalMarkup(runtime) + toastMarkup(runtime) + '</section>';
  }

  function render(runtime, focusSelector) {
    if (!runtime.mounted) return;
    runtime.root.innerHTML = renderMarkup(runtime);
    if (runtime.root.dataset) {
      runtime.root.dataset.gcsMounted = "true";
      runtime.root.dataset.gcsRoute = ROUTE;
    }
    if (focusSelector && runtime.root.querySelector) {
      var focusTarget = runtime.root.querySelector(focusSelector);
      if (focusTarget && typeof focusTarget.focus === "function") focusTarget.focus();
    }
  }

  function emit(runtime, name, detail) {
    var eventName = "hh:galaxy:creator-studio:" + name;
    try {
      if (typeof globalScope.CustomEvent === "function" && typeof globalScope.dispatchEvent === "function") {
        globalScope.dispatchEvent(new globalScope.CustomEvent(eventName, { detail: Object.assign({ route: ROUTE }, detail || {}) }));
      }
    } catch (error) { /* Integration events are best effort. */ }
    if (typeof runtime.options.onEvent === "function") runtime.options.onEvent(eventName, detail || {});
  }

  function setToast(runtime, message, kind) {
    runtime.toast = { message: String(message || ""), kind: kind || "info" };
    var node = runtime.root.querySelector && runtime.root.querySelector("[data-gcs-toast]");
    if (node) {
      node.hidden = false;
      node.dataset.kind = runtime.toast.kind;
      node.innerHTML = icon(kind === "error" ? "alert" : "check") + '<span>' + escapeHtml(runtime.toast.message) + '</span>';
    }
    if (runtime.toastTimer) globalScope.clearTimeout(runtime.toastTimer);
    runtime.toastTimer = globalScope.setTimeout ? globalScope.setTimeout(function () {
      runtime.toast = null;
      var current = runtime.root.querySelector && runtime.root.querySelector("[data-gcs-toast]");
      if (current) current.hidden = true;
    }, 4200) : 0;
  }

  function setSaveState(runtime, state, label) {
    var node = runtime.root.querySelector && runtime.root.querySelector("[data-gcs-save-state]");
    if (!node) return;
    node.dataset.state = state;
    var labelNode = node.querySelector && node.querySelector("span");
    if (labelNode) labelNode.textContent = label;
  }

  function flushAutosave(runtime) {
    if (runtime.autosaveTimer) globalScope.clearTimeout(runtime.autosaveTimer);
    runtime.autosaveTimer = 0;
    var pending = runtime.pendingSave;
    runtime.pendingSave = null;
    if (!pending || !pending.projectId) return false;
    try {
      var project = runtime.store.getProject(pending.projectId);
      if (!project || project.isDemo) return false;
      if (Object.keys(pending.project).length) runtime.store.updateProject(pending.projectId, pending.project);
      Object.keys(pending.steps).forEach(function (stepId) { runtime.store.updateStep(pending.projectId, stepId, pending.steps[stepId]); });
      setSaveState(runtime, "saved", "Đã lưu cục bộ");
      emit(runtime, "autosaved", { projectId: pending.projectId });
      return true;
    } catch (error) {
      setSaveState(runtime, "error", "Không thể lưu");
      setToast(runtime, error.message || "Không thể lưu thay đổi.", "error");
      return false;
    }
  }

  function queueAutosave(runtime, kind, key, value) {
    var project = runtime.store.getProject(runtime.activeProjectId);
    if (!project || project.isDemo || project.editable === false) return;
    if (runtime.pendingSave && runtime.pendingSave.projectId !== project.id) flushAutosave(runtime);
    if (!runtime.pendingSave) runtime.pendingSave = { projectId: project.id, project: {}, steps: {} };
    if (kind === "project") runtime.pendingSave.project[key] = value;
    else {
      if (!runtime.pendingSave.steps[runtime.selectedStepId]) runtime.pendingSave.steps[runtime.selectedStepId] = {};
      runtime.pendingSave.steps[runtime.selectedStepId][key] = value;
    }
    setSaveState(runtime, "saving", "Đang tự động lưu…");
    if (runtime.autosaveTimer) globalScope.clearTimeout(runtime.autosaveTimer);
    runtime.autosaveTimer = globalScope.setTimeout ? globalScope.setTimeout(function () { flushAutosave(runtime); }, runtime.options.autosaveDelay == null ? 650 : Math.max(0, Number(runtime.options.autosaveDelay))) : 0;
  }

  function formValue(form, name) {
    var field = form && form.querySelector && form.querySelector('[name="' + name + '"]');
    return field ? String(field.value || "") : "";
  }

  function openModal(runtime, name) {
    flushAutosave(runtime);
    runtime.modal = name;
    render(runtime, "[data-gcs-modal] input[autofocus]");
  }

  function closeModal(runtime) {
    runtime.modal = null;
    render(runtime, '[data-gcs-action="create"]');
  }

  function chooseFirstIncomplete(project) {
    var step = Data.PIPELINE_STEPS.find(function (definition) { return project.steps[definition.id].status !== "completed"; });
    return (step || Data.PIPELINE_STEPS[Data.PIPELINE_STEPS.length - 1]).id;
  }

  function openProject(runtime, id, stepId) {
    flushAutosave(runtime);
    var project = runtime.store.getProject(id);
    if (!project) return setToast(runtime, "Không tìm thấy dự án.", "error");
    runtime.activeProjectId = project.id;
    runtime.selectedStepId = stepId && project.steps[stepId] ? stepId : chooseFirstIncomplete(project);
    runtime.view = "editor";
    runtime.modal = null;
    render(runtime, "#gcs-main");
    emit(runtime, "project-opened", { projectId: project.id, isDemo: project.isDemo });
  }

  function downloadExport(runtime) {
    var json = runtime.store.exportJSON({ includeDemos: false });
    if (typeof runtime.options.onExport === "function") {
      runtime.options.onExport(json);
      setToast(runtime, "Đã chuẩn bị bản xuất JSON.", "success");
      return;
    }
    var doc = runtime.root.ownerDocument || globalScope.document;
    if (!doc || typeof doc.createElement !== "function" || typeof Blob !== "function" || !globalScope.URL || typeof globalScope.URL.createObjectURL !== "function") {
      setToast(runtime, "Trình duyệt không hỗ trợ tải tệp. Dữ liệu vẫn an toàn cục bộ.", "error");
      return;
    }
    var blobUrl = globalScope.URL.createObjectURL(new Blob([json], { type: "application/json;charset=utf-8" }));
    var link = doc.createElement("a");
    link.href = blobUrl;
    link.download = "hh-galaxy-creator-studio-" + new Date(runtime.now()).toISOString().slice(0, 10) + ".json";
    link.hidden = true;
    (doc.body || runtime.root).appendChild(link);
    link.click();
    link.remove();
    globalScope.setTimeout(function () { globalScope.URL.revokeObjectURL(blobUrl); }, 0);
    setToast(runtime, "Đã xuất dữ liệu dự án của bạn. Bản mẫu không được đưa vào tệp.", "success");
  }

  function handleAction(runtime, button) {
    var action = button.getAttribute("data-gcs-action");
    var projectId = button.getAttribute("data-project-id");
    if (action === "create") return openModal(runtime, "create");
    if (action === "schedule") return openModal(runtime, "schedule");
    if (action === "close-modal") return closeModal(runtime);
    if (action === "dashboard") { flushAutosave(runtime); runtime.view = "dashboard"; render(runtime, "#gcs-main"); return; }
    if (action === "open") return openProject(runtime, projectId);
    if (action === "clone") {
      try {
        var cloned = runtime.store.cloneProject(projectId);
        openProject(runtime, cloned.id);
        setToast(runtime, "Đã tạo bản sao có thể chỉnh sửa.", "success");
        emit(runtime, "project-cloned", { projectId: cloned.id, clonedFrom: projectId });
      } catch (error) { setToast(runtime, error.message, "error"); }
      return;
    }
    if (action === "delete") {
      flushAutosave(runtime);
      var allow = typeof runtime.options.confirm === "function" ? runtime.options.confirm("Xóa dự án này?") : (typeof globalScope.confirm === "function" ? globalScope.confirm("Xóa dự án này? Thao tác không thể hoàn tác.") : false);
      if (!allow) return;
      try { runtime.store.removeProject(projectId); runtime.activeProjectId = null; runtime.view = "dashboard"; render(runtime, "#gcs-main"); setToast(runtime, "Đã xóa dự án và lịch liên quan.", "success"); emit(runtime, "project-deleted", { projectId: projectId }); }
      catch (error) { setToast(runtime, error.message, "error"); }
      return;
    }
    if (action === "hide-demo") { runtime.store.hideDemo(projectId); if (runtime.activeProjectId === projectId) runtime.activeProjectId = null; render(runtime); setToast(runtime, "Đã ẩn bản mẫu. Bạn có thể khôi phục sau.", "success"); return; }
    if (action === "restore-demos") { runtime.store.restoreDemos(); render(runtime); setToast(runtime, "Đã khôi phục các bản mẫu.", "success"); return; }
    if (action === "export") { flushAutosave(runtime); return downloadExport(runtime); }
    if (action === "import") { flushAutosave(runtime); var input = runtime.root.querySelector && runtime.root.querySelector("[data-gcs-import]"); if (input && typeof input.click === "function") input.click(); return; }
    if (action === "tool") {
      var active = runtime.store.getProject(runtime.activeProjectId);
      if (active) openProject(runtime, active.id, button.getAttribute("data-step-id"));
      return;
    }
    if (action === "remove-check") {
      var project = runtime.store.getProject(runtime.activeProjectId);
      if (!project || project.isDemo) return;
      var current = project.steps[runtime.selectedStepId];
      var checkId = button.getAttribute("data-check-id");
      runtime.store.updateStep(project.id, runtime.selectedStepId, { checklist: current.checklist.filter(function (item) { return item.id !== checkId; }) });
      render(runtime);
    }
  }

  function closest(target, selector, root) {
    var node = target;
    while (node) {
      if (node.matches && node.matches(selector)) return node;
      if (node === root) break;
      node = node.parentNode;
    }
    return null;
  }

  function handleClick(runtime, event) {
    var target = event.target || event.srcElement;
    var action = closest(target, "[data-gcs-action]", runtime.root);
    if (action) { event.preventDefault && event.preventDefault(); handleAction(runtime, action); return; }
    var stepButton = closest(target, "[data-gcs-step]", runtime.root);
    if (stepButton) {
      event.preventDefault && event.preventDefault();
      flushAutosave(runtime);
      var project = runtime.store.getProject(runtime.activeProjectId);
      if (!project) return;
      runtime.selectedStepId = stepButton.getAttribute("data-gcs-step");
      if (runtime.view === "editor") render(runtime, ".gcs-workspace__canvas textarea");
      else openProject(runtime, project.id, runtime.selectedStepId);
      return;
    }
    if (runtime.modal && target && target.matches && target.matches("[data-gcs-modal]")) closeModal(runtime);
  }

  function handleInput(runtime, event) {
    var target = event.target || event.srcElement;
    if (target.matches && target.matches("[data-gcs-search]")) {
      var query = String(target.value || "").trim().toLocaleLowerCase("vi-VN");
      var cards = Array.prototype.slice.call(runtime.root.querySelectorAll ? runtime.root.querySelectorAll("[data-gcs-project-card]") : []);
      var count = 0;
      cards.forEach(function (card) { var show = !query || String(card.getAttribute("data-search") || "").indexOf(query) >= 0; card.hidden = !show; if (show) count += 1; });
      var label = runtime.root.querySelector && runtime.root.querySelector("[data-gcs-result-count]");
      if (label) label.textContent = count + " mục";
      var empty = runtime.root.querySelector && runtime.root.querySelector("[data-gcs-search-empty]");
      if (empty) empty.hidden = count !== 0;
      return;
    }
    if (target.matches && target.matches("[data-gcs-project-field]")) queueAutosave(runtime, "project", target.getAttribute("data-gcs-project-field"), target.value);
    if (target.matches && target.matches("[data-gcs-step-field]")) queueAutosave(runtime, "step", target.getAttribute("data-gcs-step-field"), target.value);
  }

  function handleChange(runtime, event) {
    var target = event.target || event.srcElement;
    if (target.matches && target.matches("[data-gcs-step-status]")) {
      flushAutosave(runtime);
      try { runtime.store.updateStep(runtime.activeProjectId, runtime.selectedStepId, { status: target.value }); render(runtime, '[data-gcs-step-status][value="' + target.value + '"]'); }
      catch (error) { setToast(runtime, error.message, "error"); }
      return;
    }
    if (target.matches && target.matches("[data-gcs-check-toggle]")) {
      var project = runtime.store.getProject(runtime.activeProjectId);
      if (!project || project.isDemo) return;
      var step = project.steps[runtime.selectedStepId];
      var checkId = target.getAttribute("data-gcs-check-toggle");
      var checklist = step.checklist.map(function (item) { return item.id === checkId ? Object.assign({}, item, { done: target.checked === true }) : item; });
      runtime.store.updateStep(project.id, runtime.selectedStepId, { checklist: checklist });
      render(runtime, '[data-gcs-check-toggle="' + checkId + '"]');
      return;
    }
    if (target.matches && target.matches("[data-gcs-import]")) {
      var file = target.files && target.files[0];
      if (!file) return;
      Promise.resolve(typeof file.text === "function" ? file.text() : "").then(function (text) {
        var result = runtime.store.importJSON(text, { mode: "merge" });
        runtime.view = "dashboard";
        render(runtime);
        setToast(runtime, "Đã nhập " + result.projects + " dự án và " + result.schedule + " lịch.", "success");
      }).catch(function (error) { setToast(runtime, error.message || "Không thể đọc tệp JSON.", "error"); });
    }
  }

  function handleSubmit(runtime, event) {
    var form = event.target || event.srcElement;
    if (!form.matches) return;
    if (form.matches("[data-gcs-create-form]")) {
      event.preventDefault && event.preventDefault();
      try {
        var project = runtime.store.createProject({ title: formValue(form, "title"), category: formValue(form, "category"), description: formValue(form, "description") });
        runtime.modal = null;
        openProject(runtime, project.id, "idea");
        setToast(runtime, "Đã tạo dự án và bật tự động lưu.", "success");
      } catch (error) { setToast(runtime, error.message, "error"); }
      return;
    }
    if (form.matches("[data-gcs-schedule-form]")) {
      event.preventDefault && event.preventDefault();
      try {
        runtime.store.addSchedule({ title: formValue(form, "title"), at: formValue(form, "at"), stepId: formValue(form, "stepId"), note: formValue(form, "note"), projectId: runtime.activeProjectId });
        runtime.modal = null;
        runtime.view = "dashboard";
        render(runtime);
        setToast(runtime, "Đã thêm lịch công việc.", "success");
      } catch (error) { setToast(runtime, error.message, "error"); }
      return;
    }
    if (form.matches("[data-gcs-check-form]")) {
      event.preventDefault && event.preventDefault();
      var text = formValue(form, "checkText").trim();
      var active = runtime.store.getProject(runtime.activeProjectId);
      if (!text || !active || active.isDemo) return;
      var activeStep = active.steps[runtime.selectedStepId];
      var checklist = activeStep.checklist.concat([{ id: "check-" + Date.now().toString(36), text: text, done: false }]);
      runtime.store.updateStep(active.id, runtime.selectedStepId, { checklist: checklist });
      render(runtime, "[data-gcs-check-form] input");
    }
  }

  function handleKeydown(runtime, event) {
    var target = event.target || event.srcElement;
    var typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
    if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === "s") { event.preventDefault && event.preventDefault(); flushAutosave(runtime); setToast(runtime, "Đã lưu thay đổi cục bộ.", "success"); }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && String(event.key).toLowerCase() === "n") { event.preventDefault && event.preventDefault(); openModal(runtime, "create"); }
    if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === "k") { event.preventDefault && event.preventDefault(); var search = runtime.root.querySelector && runtime.root.querySelector("[data-gcs-search]"); if (search && search.focus) search.focus(); }
    if (runtime.modal && event.key === "Tab" && runtime.root.querySelectorAll) {
      var focusable = Array.prototype.slice.call(runtime.root.querySelectorAll('[data-gcs-modal] button:not([disabled]), [data-gcs-modal] input:not([disabled]), [data-gcs-modal] select:not([disabled]), [data-gcs-modal] textarea:not([disabled]), [data-gcs-modal] [tabindex]:not([tabindex="-1"])'));
      if (focusable.length) {
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        var doc = runtime.root.ownerDocument || globalScope.document;
        if (event.shiftKey && doc && doc.activeElement === first) { event.preventDefault && event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && doc && doc.activeElement === last) { event.preventDefault && event.preventDefault(); first.focus(); }
      }
    }
    if (event.key === "Escape" && runtime.modal) { event.preventDefault && event.preventDefault(); closeModal(runtime); }
    else if (event.key === "Escape" && typing && target.matches && target.matches("[data-gcs-search]")) { target.value = ""; handleInput(runtime, { target: target }); }
  }

  function addListener(runtime, target, type, handler, options) {
    if (!target || typeof target.addEventListener !== "function") return;
    var listenerOptions = Object.assign({}, options || {});
    if (runtime.controller) listenerOptions.signal = runtime.controller.signal;
    try { target.addEventListener(type, handler, listenerOptions); }
    catch (error) { target.addEventListener(type, handler, options || false); runtime.cleanup.push(function () { target.removeEventListener(type, handler, options || false); }); }
  }

  function mount(root, options) {
    options = options || {};
    if (!root || typeof root !== "object" || typeof root.querySelector !== "function") throw new TypeError("HHGalaxyCreatorStudio.mount cần một root DOM hợp lệ.");
    if (!Data || typeof Data.createStore !== "function") throw new Error("HHGalaxyLayerOneData chưa được tải.");
    var route = normalizeRoute(options.route || (globalScope.location && globalScope.location.hash) || ROUTE);
    if (!canHandle(route)) return false;
    unmount(root);
    var store = options.store || Data.createStore({ storage: options.storage, now: options.now, persistInitial: options.persistInitial });
    var snapshot = store.getSnapshot();
    var initialProject = options.projectId && store.getProject(options.projectId) || snapshot.projects.find(function (item) { return !item.isDemo; }) || snapshot.projects[0] || null;
    var runtime = {
      root: root,
      route: ROUTE,
      options: options,
      store: store,
      now: typeof options.now === "function" ? options.now : function () { return new Date(); },
      view: options.view === "editor" && initialProject ? "editor" : "dashboard",
      activeProjectId: initialProject && initialProject.id || null,
      selectedStepId: initialProject ? chooseFirstIncomplete(initialProject) : "idea",
      modal: null,
      toast: null,
      toastTimer: 0,
      autosaveTimer: 0,
      pendingSave: null,
      controller: typeof AbortController === "function" ? new AbortController() : null,
      cleanup: [],
      mounted: true,
      mountedAt: new Date().toISOString()
    };
    if (root.classList) root.classList.add("gcs-host");
    instances.set(root, runtime);
    mounted.add(root);
    render(runtime);
    addListener(runtime, root, "click", function (event) { handleClick(runtime, event); });
    addListener(runtime, root, "input", function (event) { handleInput(runtime, event); });
    addListener(runtime, root, "change", function (event) { handleChange(runtime, event); });
    addListener(runtime, root, "submit", function (event) { handleSubmit(runtime, event); });
    addListener(runtime, root, "keydown", function (event) { handleKeydown(runtime, event); });
    var doc = root.ownerDocument || globalScope.document;
    addListener(runtime, doc, "visibilitychange", function () { if (doc && doc.hidden) flushAutosave(runtime); });
    emit(runtime, "mounted", { storageKind: store.storageKind(), projectCount: snapshot.projects.filter(function (item) { return !item.isDemo; }).length });
    return Object.freeze({
      route: ROUTE,
      getState: function () { return getState(root); },
      openProject: function (id, stepId) { return openProject(runtime, id, stepId); },
      flushAutosave: function () { return flushAutosave(runtime); },
      unmount: function () { return unmount(root); }
    });
  }

  function unmount(root) {
    if (!root) { Array.from(mounted).forEach(function (entry) { unmount(entry); }); return true; }
    var runtime = instances.get(root);
    if (!runtime) return false;
    flushAutosave(runtime);
    runtime.mounted = false;
    if (runtime.controller) runtime.controller.abort();
    runtime.cleanup.splice(0).reverse().forEach(function (cleanup) { try { cleanup(); } catch (error) { /* Best effort cleanup. */ } });
    if (runtime.autosaveTimer) globalScope.clearTimeout(runtime.autosaveTimer);
    if (runtime.toastTimer) globalScope.clearTimeout(runtime.toastTimer);
    runtime.autosaveTimer = 0;
    runtime.toastTimer = 0;
    emit(runtime, "unmounted", {});
    instances.delete(root);
    mounted.delete(root);
    if (root.classList) root.classList.remove("gcs-host");
    if (root.dataset) { delete root.dataset.gcsMounted; delete root.dataset.gcsRoute; }
    if (typeof root.replaceChildren === "function") root.replaceChildren(); else root.innerHTML = "";
    return true;
  }

  function stateFor(runtime) {
    var snapshot = runtime.store.getSnapshot();
    return {
      version: VERSION,
      mounted: runtime.mounted,
      route: runtime.route,
      view: runtime.view,
      activeProjectId: runtime.activeProjectId,
      selectedStepId: runtime.selectedStepId,
      storageKind: runtime.store.storageKind(),
      projectCount: snapshot.projects.filter(function (item) { return !item.isDemo; }).length,
      demoCount: snapshot.projects.filter(function (item) { return item.isDemo; }).length,
      autosavePending: Boolean(runtime.pendingSave),
      mountedAt: runtime.mountedAt
    };
  }

  function getState(root) {
    if (root) { var runtime = instances.get(root); return runtime ? stateFor(runtime) : null; }
    var first = Array.from(mounted)[0];
    if (!first) return { version: VERSION, mounted: false, route: null, view: null, activeProjectId: null, selectedStepId: null, storageKind: null, projectCount: 0, demoCount: 0, autosavePending: false, mountedAt: null };
    return stateFor(instances.get(first));
  }

  var api = Object.freeze({
    VERSION: VERSION,
    ROUTE: ROUTE,
    normalizeRoute: normalizeRoute,
    canHandle: canHandle,
    renderMarkup: renderMarkup,
    mount: mount,
    unmount: unmount,
    getState: getState
  });
  return api;
});
