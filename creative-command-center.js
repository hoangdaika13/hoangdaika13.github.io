(function (globalScope, factory) {
  "use strict";

  const core = globalScope?.HHCreativeCore || (typeof module !== "undefined" && module.exports ? require("./creative-os-core.js") : null);
  const api = factory(core);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope) globalScope.HHCreativeCommandCenter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (CreativeCore) {
  "use strict";

  const instances = new WeakMap();
  const TABS = Object.freeze([
    ["brief", "Brief"], ["prompt", "Prompt"], ["script", "Kịch bản"],
    ["storyboard", "Storyboard"], ["assets", "Asset"], ["version", "Phiên bản"], ["publish", "Xuất bản"]
  ]);
  const STATUS_LABELS = Object.freeze({ draft: "Bản nháp", review: "Đang duyệt", approved: "Đã duyệt", published: "Đã xuất bản" });
  const PUBLISH_LABELS = Object.freeze({ draft: "Bản nháp", scheduled: "Đã lên lịch", publishing: "Đang đăng", published: "Đã đăng", failed: "Lỗi" });
  const CREATIVE_TEMPLATES = Object.freeze([
    { id: "youtube-series", icon: "YT", title: "YouTube Series", accent: "cyan", description: "Kịch bản dài, storyboard, thumbnail và lịch phát hành.", platform: "YouTube", format: "Video series 16:9", tone: "Cuốn hút, rõ ràng, giữ chân", goal: "Xây một series video nhất quán từ ý tưởng đến lịch xuất bản." },
    { id: "social-campaign", icon: "SC", title: "Social Campaign", accent: "pink", description: "Một concept thành Post, Story, Reel và nội dung quảng bá.", platform: "Đa nền tảng", format: "Post, Story, Reel, Short", tone: "Năng động, đúng Brand Voice", goal: "Tạo chiến dịch đa định dạng với thông điệp và nhận diện thống nhất." },
    { id: "product-launch", icon: "PL", title: "Product Launch", accent: "amber", description: "Brief sản phẩm, key visual, landing page và video giới thiệu.", platform: "Website", format: "Launch kit đa phương tiện", tone: "Cao cấp, thuyết phục", goal: "Chuẩn bị trọn bộ tài sản và nội dung cho một đợt ra mắt sản phẩm." },
    { id: "podcast-show", icon: "PC", title: "Podcast Show", accent: "violet", description: "Outline, lời dẫn, audio, artwork và lịch phát sóng.", platform: "Podcast", format: "Audio episode và social cut", tone: "Tự nhiên, gần gũi", goal: "Sản xuất tập podcast có cấu trúc, nhận diện và nội dung quảng bá đi kèm." }
  ]);
  const PIPELINE_STEPS = Object.freeze([
    { id: "brief", label: "Brief", tab: "brief", complete: (project) => Boolean(project?.brief?.product && project?.brief?.audience && project?.brief?.goal) },
    { id: "prompt", label: "Prompt", tab: "prompt", complete: (project) => Boolean(project?.prompts?.length) },
    { id: "script", label: "Kịch bản", tab: "script", complete: (project) => Boolean(project?.scripts?.length) },
    { id: "storyboard", label: "Storyboard", tab: "storyboard", complete: (project) => Boolean(project?.storyboard?.length) },
    { id: "assets", label: "Asset", tab: "assets", complete: (project) => Boolean(project?.assets?.length) },
    { id: "publish", label: "Xuất bản", tab: "publish", complete: (project) => Boolean(project?.publishing?.length) }
  ]);

  function escapeHTML(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[char]);
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function dateValue(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toISOString().slice(0, 10);
  }

  function dateTimeValue(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function formatDate(value, withTime = false) {
    if (!value) return "Chưa đặt";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHTML(value);
    return new Intl.DateTimeFormat("vi-VN", withTime
      ? { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "short", year: "numeric" }).format(date);
  }

  function formatBytes(value) {
    const size = Number(value || 0);
    if (size < 1024) return `${size} B`;
    if (size < 1048576) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1048576).toFixed(1)} MB`;
  }

  function formatCost(value) {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "USD", maximumFractionDigits: 3 }).format(Number(value || 0));
  }

  function projectProgress(project) {
    const explicit = Number(project?.analytics?.progress || 0);
    if (explicit > 0) return Math.min(100, Math.max(0, Math.round(explicit)));
    const checks = [
      project?.brief?.product, project?.brief?.audience, project?.brief?.goal,
      project?.prompts?.length, project?.scripts?.length, project?.storyboard?.length,
      project?.assets?.length, project?.publishing?.length
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }

  function calculateMetrics(state) {
    const projects = Array.isArray(state?.projects) ? state.projects : [];
    const runs = Array.isArray(state?.runs) ? state.runs : [];
    const deadlines = projects.filter((project) => project.brief?.deadline && new Date(project.brief.deadline) >= new Date()).length;
    const assets = projects.reduce((sum, project) => sum + (project.assets?.length || 0), 0);
    const publishing = projects.reduce((sum, project) => sum + (project.publishing?.filter((item) => item.status === "scheduled").length || 0), 0);
    const averageProgress = projects.length ? Math.round(projects.reduce((sum, project) => sum + projectProgress(project), 0) / projects.length) : 0;
    const estimatedCost = runs.reduce((sum, run) => sum + Number(run.estimatedCost || 0), 0);
    return { projects: projects.length, deadlines, assets, publishing, averageProgress, runs: runs.length, estimatedCost };
  }

  function metricCard(icon, label, value, note, tone) {
    return `<article class="cco-metric cco-tone-${tone}"><span aria-hidden="true">${escapeHTML(icon)}</span><div><small>${escapeHTML(label)}</small><strong>${escapeHTML(value)}</strong><p>${escapeHTML(note)}</p></div></article>`;
  }

  function filteredProjects(state, query = "", filter = "all") {
    const needle = String(query || "").trim().toLocaleLowerCase("vi");
    return state.projects.filter((project) => {
      const matchesText = !needle || [project.name, project.brief?.product, project.brief?.platform, project.brief?.audience]
        .some((value) => String(value || "").toLocaleLowerCase("vi").includes(needle));
      const status = project.review?.status || "draft";
      return matchesText && (filter === "all" || filter === status);
    });
  }

  function projectListMarkup(state, query, filter) {
    const projects = filteredProjects(state, query, filter);
    if (!projects.length) return `<div class="cco-empty"><span aria-hidden="true">⌕</span><strong>Không tìm thấy dự án</strong><p>Đổi từ khóa, bộ lọc hoặc tạo một dự án mới.</p></div>`;
    return projects.map((project) => {
      const progress = projectProgress(project);
      const status = project.review?.status || "draft";
      return `<article class="cco-project-row">
        <button type="button" class="cco-project-main" data-action="open-project" data-project-id="${escapeHTML(project.id)}">
          <span class="cco-project-monogram" aria-hidden="true">${escapeHTML(project.name.slice(0, 2).toUpperCase())}</span>
          <span class="cco-project-copy"><strong>${escapeHTML(project.name)}</strong><small>${escapeHTML(project.brief?.product || "Chưa có sản phẩm")} · ${escapeHTML(project.brief?.platform || "Chưa chọn nền tảng")}</small></span>
          <span class="cco-project-status is-${escapeHTML(status)}">${escapeHTML(STATUS_LABELS[status] || status)}</span>
        </button>
        <div class="cco-project-progress"><span><i style="width:${progress}%"></i></span><b>${progress}%</b><time>${formatDate(project.updatedAt)}</time></div>
      </article>`;
    }).join("");
  }

  function recentAssets(state) {
    const assets = state.projects.flatMap((project) => (project.assets || []).map((asset) => ({ ...asset, projectName: project.name })))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);
    if (!assets.length) return `<div class="cco-empty is-compact"><span aria-hidden="true">＋</span><strong>Chưa có asset</strong><p>Thêm ảnh, video hoặc âm thanh trong dự án.</p></div>`;
    return assets.map((asset) => `<div class="cco-asset-row"><span aria-hidden="true">${asset.type.startsWith("image") ? "IMG" : asset.type.startsWith("video") ? "VID" : asset.type.startsWith("audio") ? "AUD" : "FILE"}</span><div><strong>${escapeHTML(asset.name)}</strong><small>${escapeHTML(asset.projectName)} · ${formatBytes(asset.size)}</small></div><time>${formatDate(asset.createdAt)}</time></div>`).join("");
  }

  function publishingSchedule(state) {
    const items = state.projects.flatMap((project) => (project.publishing || []).map((item) => ({ ...item, projectName: project.name })))
      .filter((item) => item.scheduledAt).sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)).slice(0, 7);
    if (!items.length) return `<div class="cco-empty is-compact"><span aria-hidden="true">CAL</span><strong>Lịch đang trống</strong><p>Đặt lịch trong tab Xuất bản của dự án.</p></div>`;
    return items.map((item) => `<div class="cco-calendar-row"><time><b>${new Date(item.scheduledAt).getDate()}</b><small>${new Intl.DateTimeFormat("vi-VN", { month: "short" }).format(new Date(item.scheduledAt))}</small></time><div><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.platform)} · ${escapeHTML(item.projectName)}</small></div><span class="is-${escapeHTML(item.status)}">${escapeHTML(PUBLISH_LABELS[item.status] || item.status)}</span></div>`).join("");
  }

  function pipelineState(project) {
    if (!project) return { completed: 0, percent: 0, steps: [] };
    const steps = PIPELINE_STEPS.map((step) => ({ ...step, done: step.complete(project) }));
    const completed = steps.filter((step) => step.done).length;
    return { completed, percent: Math.round((completed / steps.length) * 100), steps };
  }

  function actionQueue(project) {
    if (!project) return [];
    const actions = [];
    const pushTab = (id, title, description, tab, tone) => actions.push({ id, title, description, tab, tone });
    if (!project.brief?.product || !project.brief?.audience || !project.brief?.goal) pushTab("brief", "Hoàn thiện Creative Brief", "Bổ sung sản phẩm, đối tượng và mục tiêu để các bước sau bám đúng định hướng.", "brief", "cyan");
    if (!project.prompts?.length) pushTab("prompt", "Tạo prompt gốc", "Lưu model, seed và negative prompt để kết quả có thể tái tạo.", "prompt", "violet");
    if (!project.scripts?.length) pushTab("script", "Viết kịch bản đầu tiên", "Chuyển brief thành cấu trúc nội dung có thể sản xuất.", "script", "pink");
    if (!project.storyboard?.length) pushTab("storyboard", "Dựng storyboard", "Chia kịch bản thành cảnh, thời lượng, góc máy và âm thanh.", "storyboard", "amber");
    if (!project.assets?.length) pushTab("assets", "Thêm asset tham chiếu", "Kéo ảnh, video hoặc âm thanh từ thiết bị vào Universal Project.", "assets", "green");
    if (project.review?.status === "draft" && actions.length < 4) actions.push({ id: "review", title: "Chuẩn bị vòng duyệt", description: "Mở Creative Review để comment, so sánh và khóa bản được duyệt.", route: "/create/review", tone: "violet" });
    if (!project.publishing?.length && actions.length < 4) pushTab("publish", "Lập lịch xuất bản", "Tạo đầu việc phát hành theo nền tảng và thời gian dự kiến.", "publish", "cyan");
    return actions.slice(0, 4);
  }

  function templatesMarkup() {
    return CREATIVE_TEMPLATES.map((template) => `<button type="button" class="cco-template is-${template.accent}" data-action="create-template" data-template="${template.id}">
      <span aria-hidden="true">${template.icon}</span>
      <div><strong>${escapeHTML(template.title)}</strong><p>${escapeHTML(template.description)}</p><small>${escapeHTML(template.platform)} · ${escapeHTML(template.format)}</small></div>
      <b aria-hidden="true">+</b>
    </button>`).join("");
  }

  function creativeLaunchpad(state, active) {
    const pipeline = pipelineState(active);
    const actions = actionQueue(active);
    return `<section class="cco-launchpad" aria-labelledby="cco-launchpad-title">
      <header class="cco-launchpad-head">
        <div><p class="cco-eyebrow">CREATIVE LAUNCHPAD</p><h2 id="cco-launchpad-title">${active ? escapeHTML(active.name) : "Bắt đầu từ một quy trình rõ ràng"}</h2><p>${active ? `${pipeline.completed}/${PIPELINE_STEPS.length} chặng đã có dữ liệu thật trong Universal Project.` : "Chọn mẫu để tạo sẵn brief và cấu trúc dự án. Bạn có thể chỉnh mọi trường sau khi tạo."}</p></div>
        ${active ? `<div class="cco-readiness" aria-label="Mức sẵn sàng ${pipeline.percent}%"><strong>${pipeline.percent}%</strong><span><i style="width:${pipeline.percent}%"></i></span><small>Production readiness</small></div>` : ""}
      </header>
      ${active ? `<div class="cco-pipeline" aria-label="Creative pipeline">${pipeline.steps.map((step, index) => `<button type="button" class="${step.done ? "is-done" : ""}" data-action="open-project-tab" data-tab="${step.tab}"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHTML(step.label)}</strong><small>${step.done ? "Đã có dữ liệu" : "Cần thực hiện"}</small></button>`).join("")}</div>` : ""}
      <div class="cco-launchpad-grid">
        <section class="cco-template-panel"><div class="cco-mini-head"><div><span>MẪU DỰ ÁN</span><strong>Tạo nhanh và chỉnh tự do</strong></div><small>${CREATIVE_TEMPLATES.length} workflow</small></div><div class="cco-template-grid">${templatesMarkup()}</div></section>
        <section class="cco-action-panel"><div class="cco-mini-head"><div><span>HÀNH ĐỘNG TIẾP THEO</span><strong>${active ? "Tập trung đúng việc cần làm" : "Mở công cụ sáng tạo"}</strong></div></div>
          ${active && actions.length ? `<div class="cco-action-list">${actions.map((action) => `<button type="button" class="is-${action.tone}" data-action="${action.route ? "open-route" : "open-project-tab"}" ${action.route ? `data-route="${action.route}"` : `data-tab="${action.tab}"`}><span>${action.id.slice(0, 2).toUpperCase()}</span><div><strong>${escapeHTML(action.title)}</strong><p>${escapeHTML(action.description)}</p></div><b aria-hidden="true">→</b></button>`).join("")}</div>` : `<div class="cco-module-grid">
            <button type="button" data-action="open-route" data-route="/create/moodboard"><span>MB</span><strong>Moodboard</strong><small>Gom concept và tham chiếu</small></button>
            <button type="button" data-action="open-route" data-route="/create/workflow"><span>WF</span><strong>Workflow</strong><small>Nối pipeline bằng node</small></button>
            <button type="button" data-action="open-route" data-route="/create/repurpose"><span>RE</span><strong>Repurpose</strong><small>Nhân bản đa định dạng</small></button>
            <button type="button" data-action="open-route" data-route="/create/publishing"><span>PB</span><strong>Publishing</strong><small>Lập lịch đa nền tảng</small></button>
          </div>`}
        </section>
      </div>
      ${active ? `<label class="cco-asset-inbox"><input type="file" data-overview-asset-input multiple accept="image/*,video/*,audio/*,.pdf,.txt,.md"><span>＋</span><div><strong>Asset Inbox</strong><small>Chọn ảnh, video, audio hoặc tài liệu từ thiết bị để thêm ngay vào dự án đang mở.</small></div><b>Chọn tệp</b></label>` : ""}
    </section>`;
  }

  function renderOverview(state, options = {}) {
    const metrics = calculateMetrics(state);
    const active = state.projects.find((project) => project.id === state.activeProjectId) || state.projects[0];
    return `<section class="hh-creative-os" data-creative-command-center data-view="overview">
      <header class="cco-hero">
        <div><p class="cco-eyebrow">HH CREATIVE OS · LOCAL WORKSPACE</p><h1>Creative Command Center</h1><p>Điều phối dự án, tài nguyên, AI và lịch xuất bản từ một nguồn dữ liệu thống nhất trên thiết bị.</p></div>
        <div class="cco-hero-actions">
          <span><i aria-hidden="true"></i>Tự lưu cục bộ</span>
          <button type="button" class="cco-primary" data-action="focus-create">Tạo dự án</button>
        </div>
      </header>
      <div class="cco-metrics" aria-label="Chỉ số Creative OS">
        ${metricCard("PJ", "Dự án", metrics.projects, `${metrics.deadlines} deadline sắp tới`, "cyan")}
        ${metricCard("AI", "Lượt chạy AI", metrics.runs, formatCost(metrics.estimatedCost), "violet")}
        ${metricCard("AS", "Asset", metrics.assets, "Trong tất cả dự án", "amber")}
        ${metricCard("PB", "Đã lên lịch", metrics.publishing, "Nội dung chờ xuất bản", "green")}
        ${metricCard("%", "Tiến độ", `${metrics.averageProgress}%`, "Trung bình workspace", "pink")}
      </div>
      ${creativeLaunchpad(state, active)}
      <div class="cco-dashboard-grid">
        <section class="cco-projects-panel" aria-labelledby="cco-projects-title">
          <header class="cco-section-head"><div><p class="cco-eyebrow">WORKSPACE</p><h2 id="cco-projects-title">Dự án đang làm</h2></div><span>${metrics.projects}/${CreativeCore?.MAX_PROJECTS || 50}</span></header>
          <div class="cco-project-tools">
            <label class="cco-search"><span aria-hidden="true">⌕</span><input type="search" data-project-search placeholder="Tìm tên, sản phẩm, nền tảng..." value="${escapeHTML(options.query || "")}" aria-label="Tìm dự án"></label>
            <label><span class="sr-only">Lọc trạng thái</span><select data-project-filter aria-label="Lọc dự án theo trạng thái"><option value="all">Tất cả trạng thái</option><option value="draft">Bản nháp</option><option value="review">Đang duyệt</option><option value="approved">Đã duyệt</option><option value="published">Đã xuất bản</option></select></label>
          </div>
          <div class="cco-project-list" data-project-list>${projectListMarkup(state, options.query, options.filter)}</div>
        </section>
        <aside class="cco-quick-panel" aria-labelledby="cco-create-title">
          <header class="cco-section-head"><div><p class="cco-eyebrow">QUICK CREATE</p><h2 id="cco-create-title">Khởi tạo nhanh</h2></div></header>
          <form data-quick-create>
            <label>Tên dự án<input name="name" required maxlength="180" placeholder="Ví dụ: Series du lịch Việt Nam"></label>
            <div class="cco-field-pair"><label>Nền tảng<select name="platform"><option>YouTube</option><option>TikTok</option><option>Facebook</option><option>Instagram</option><option>Website</option><option>Podcast</option></select></label><label>Deadline<input name="deadline" type="date"></label></div>
            <label>Mục tiêu<textarea name="goal" rows="3" maxlength="1000" placeholder="Kết quả cần đạt của dự án"></textarea></label>
            <button class="cco-primary" type="submit">Tạo và mở dự án</button>
          </form>
          ${active ? `<button type="button" class="cco-continue" data-action="open-project" data-project-id="${escapeHTML(active.id)}"><span>Tiếp tục gần nhất</span><strong>${escapeHTML(active.name)}</strong><small>${projectProgress(active)}% hoàn thành</small></button>` : ""}
        </aside>
        <section class="cco-assets-panel"><header class="cco-section-head"><div><p class="cco-eyebrow">LIBRARY</p><h2>Asset gần đây</h2></div></header><div class="cco-asset-list">${recentAssets(state)}</div></section>
        <section class="cco-calendar-panel"><header class="cco-section-head"><div><p class="cco-eyebrow">PUBLISHING</p><h2>Lịch xuất bản</h2></div></header><div class="cco-calendar-list">${publishingSchedule(state)}</div></section>
      </div>
      <div class="cco-toast" data-toast role="status" aria-live="polite"></div>
    </section>`;
  }

  function field(label, path, value, options = {}) {
    const attributes = `data-project-path="${escapeHTML(path)}" ${options.required ? "required" : ""} ${options.maxlength ? `maxlength="${options.maxlength}"` : ""}`;
    if (options.type === "textarea") return `<label>${escapeHTML(label)}<textarea ${attributes} rows="${options.rows || 4}" placeholder="${escapeHTML(options.placeholder || "")}">${escapeHTML(value || "")}</textarea></label>`;
    if (options.type === "select") return `<label>${escapeHTML(label)}<select ${attributes}>${options.choices.map((choice) => `<option value="${escapeHTML(choice)}" ${choice === value ? "selected" : ""}>${escapeHTML(choice)}</option>`).join("")}</select></label>`;
    return `<label>${escapeHTML(label)}<input ${attributes} type="${escapeHTML(options.type || "text")}" value="${escapeHTML(options.type === "date" ? dateValue(value) : value || "")}" placeholder="${escapeHTML(options.placeholder || "")}"></label>`;
  }

  function briefPanel(project) {
    const brief = project.brief || {};
    return `<div class="cco-editor-grid">
      ${field("Sản phẩm / dịch vụ", "brief.product", brief.product, { required: true, maxlength: 300, placeholder: "Bạn đang truyền thông điều gì?" })}
      ${field("Đối tượng", "brief.audience", brief.audience, { maxlength: 500, placeholder: "Ai sẽ xem nội dung?" })}
      ${field("Mục tiêu", "brief.goal", brief.goal, { type: "textarea", rows: 4, maxlength: 2000, placeholder: "Kết quả cụ thể cần đạt" })}
      ${field("Nền tảng", "brief.platform", brief.platform, { type: "select", choices: ["", "YouTube", "TikTok", "Facebook", "Instagram", "Website", "Podcast", "Đa nền tảng"] })}
      ${field("Deadline", "brief.deadline", brief.deadline, { type: "date" })}
      ${field("Tone", "brief.tone", brief.tone, { maxlength: 300, placeholder: "Chân thật, nhanh, chuyên gia..." })}
      ${field("CTA", "brief.cta", brief.cta, { maxlength: 500, placeholder: "Hành động mong muốn" })}
      ${field("Định dạng", "brief.format", brief.format, { maxlength: 200, placeholder: "Video dài, Shorts, bài viết..." })}
      <div class="cco-span-2">${field("Mô tả chi tiết", "brief.description", brief.description, { type: "textarea", rows: 7, maxlength: 8000, placeholder: "Bối cảnh, yêu cầu bắt buộc và điều cần tránh" })}</div>
    </div>`;
  }

  function textCollection(project, type) {
    const isPrompt = type === "prompts";
    const items = project[type] || [];
    return `<div class="cco-collection-head"><div><h3>${isPrompt ? "Thư viện prompt" : "Kịch bản"}</h3><p>${isPrompt ? "Lưu prompt, model, negative prompt và seed theo từng phiên bản." : "Soạn nhiều kịch bản trong cùng một dự án."}</p></div><button type="button" data-action="add-item" data-collection="${type}">Thêm ${isPrompt ? "prompt" : "kịch bản"}</button></div>
      <div class="cco-document-list">${items.length ? items.map((item, index) => `<article class="cco-document">
        <header><span>${String(index + 1).padStart(2, "0")}</span><input aria-label="Tiêu đề" data-item-field="title" data-collection="${type}" data-item-id="${escapeHTML(item.id)}" value="${escapeHTML(item.title)}"><button type="button" data-action="remove-item" data-collection="${type}" data-item-id="${escapeHTML(item.id)}" aria-label="Xóa ${escapeHTML(item.title)}">×</button></header>
        <textarea aria-label="Nội dung" data-item-field="content" data-collection="${type}" data-item-id="${escapeHTML(item.id)}" rows="10">${escapeHTML(item.content)}</textarea>
        ${isPrompt ? `<div class="cco-document-meta"><label>Model<input data-item-field="model" data-collection="prompts" data-item-id="${escapeHTML(item.id)}" value="${escapeHTML(item.model)}"></label><label>Seed<input data-item-field="seed" data-collection="prompts" data-item-id="${escapeHTML(item.id)}" value="${escapeHTML(item.seed)}"></label><label class="cco-wide">Negative prompt<input data-item-field="negative" data-collection="prompts" data-item-id="${escapeHTML(item.id)}" value="${escapeHTML(item.negative)}"></label></div>` : `<small>${item.content.trim() ? item.content.trim().split(/\s+/).length : 0} từ · Cập nhật ${formatDate(item.updatedAt, true)}</small>`}
      </article>`).join("") : `<div class="cco-empty"><span aria-hidden="true">＋</span><strong>Chưa có ${isPrompt ? "prompt" : "kịch bản"}</strong><p>Thêm tài liệu đầu tiên để bắt đầu.</p></div>`}</div>`;
  }

  function storyboardPanel(project) {
    const items = project.storyboard || [];
    return `<div class="cco-collection-head"><div><h3>Storyboard Studio</h3><p>Mỗi cảnh lưu thoại, thời lượng, góc máy, chuyển động và âm thanh.</p></div><button type="button" data-action="add-item" data-collection="storyboard">Thêm cảnh</button></div>
      <div class="cco-shot-list">${items.length ? items.map((item, index) => `<article class="cco-shot"><header><span>CẢNH ${index + 1}</span><input aria-label="Tên cảnh" data-item-field="title" data-collection="storyboard" data-item-id="${escapeHTML(item.id)}" value="${escapeHTML(item.title)}"><button type="button" data-action="remove-item" data-collection="storyboard" data-item-id="${escapeHTML(item.id)}" aria-label="Xóa cảnh">×</button></header><div class="cco-shot-grid"><label>Mô tả<textarea rows="4" data-item-field="description" data-collection="storyboard" data-item-id="${escapeHTML(item.id)}">${escapeHTML(item.description)}</textarea></label><label>Thoại<textarea rows="4" data-item-field="dialogue" data-collection="storyboard" data-item-id="${escapeHTML(item.id)}">${escapeHTML(item.dialogue)}</textarea></label><label>Thời lượng (giây)<input type="number" min="0" max="7200" data-item-field="duration" data-collection="storyboard" data-item-id="${escapeHTML(item.id)}" value="${escapeHTML(item.duration)}"></label><label>Góc máy<input data-item-field="camera" data-collection="storyboard" data-item-id="${escapeHTML(item.id)}" value="${escapeHTML(item.camera)}"></label><label>Chuyển động<input data-item-field="motion" data-collection="storyboard" data-item-id="${escapeHTML(item.id)}" value="${escapeHTML(item.motion)}"></label><label>Âm thanh<input data-item-field="audio" data-collection="storyboard" data-item-id="${escapeHTML(item.id)}" value="${escapeHTML(item.audio)}"></label></div></article>`).join("") : `<div class="cco-empty"><span aria-hidden="true">SB</span><strong>Storyboard đang trống</strong><p>Thêm cảnh rồi sắp xếp nội dung sản xuất.</p></div>`}</div>`;
  }

  function assetsPanel(project) {
    const assets = project.assets || [];
    return `<div class="cco-asset-drop" data-asset-drop tabindex="0"><input type="file" data-asset-input multiple accept="image/*,video/*,audio/*,.pdf,.txt,.md"><span aria-hidden="true">＋</span><strong>Chọn hoặc thả asset vào đây</strong><p>Ảnh, video, âm thanh và tài liệu. Tệp trên 450 KB chỉ lưu metadata để bảo vệ dung lượng trình duyệt.</p></div>
      <div class="cco-asset-grid">${assets.length ? assets.map((asset) => `<article><span aria-hidden="true">${asset.type.startsWith("image") ? "IMG" : asset.type.startsWith("video") ? "VID" : asset.type.startsWith("audio") ? "AUD" : "FILE"}</span><div><strong>${escapeHTML(asset.name)}</strong><small>${escapeHTML(asset.type)} · ${formatBytes(asset.size)}</small><p>${asset.source ? "Đã lưu bản xem trước cục bộ" : "Metadata cục bộ"}</p></div></article>`).join("") : ""}</div>`;
  }

  function versionsPanel(project) {
    const versions = project.versions || [];
    return `<div class="cco-collection-head"><div><h3>Lịch sử phiên bản</h3><p>Snapshot nằm trong project JSON và không đồng bộ cloud.</p></div><button type="button" data-action="snapshot">Tạo snapshot</button></div><div class="cco-version-list">${versions.length ? versions.map((version, index) => `<article><span>${String(versions.length - index).padStart(2, "0")}</span><div><strong>${escapeHTML(version.label)}</strong><p>${escapeHTML(version.note || "Không có ghi chú")}</p></div><time>${formatDate(version.createdAt, true)}</time></article>`).join("") : `<div class="cco-empty"><span aria-hidden="true">VER</span><strong>Chưa có snapshot</strong><p>Tạo một mốc trước khi thay đổi lớn.</p></div>`}</div>`;
  }

  function publishingPanel(project) {
    const items = project.publishing || [];
    return `<div class="cco-publish-layout"><form data-publish-form><h3>Lên lịch nội dung</h3><label>Tiêu đề<input name="title" required maxlength="240"></label><div class="cco-field-pair"><label>Nền tảng<select name="platform"><option>YouTube</option><option>TikTok</option><option>Facebook</option><option>Instagram</option><option>Website</option><option>Podcast</option></select></label><label>Ngày giờ<input name="scheduledAt" required type="datetime-local"></label></div><button type="submit">Thêm vào lịch</button><p>Creative OS chỉ lưu kế hoạch. Việc đăng thật cần kết nối API và quyền riêng của từng nền tảng.</p></form><div class="cco-publish-list">${items.length ? items.map((item) => `<article><span class="is-${escapeHTML(item.status)}">${escapeHTML(item.platform.slice(0, 2).toUpperCase())}</span><div><strong>${escapeHTML(item.title)}</strong><small>${formatDate(item.scheduledAt, true)}</small></div><b>${escapeHTML(PUBLISH_LABELS[item.status] || item.status)}</b></article>`).join("") : `<div class="cco-empty is-compact"><span aria-hidden="true">CAL</span><strong>Chưa lên lịch</strong><p>Thêm nội dung bằng biểu mẫu bên cạnh.</p></div>`}</div></div>`;
  }

  function editorPanel(project, tab) {
    if (tab === "brief") return briefPanel(project);
    if (tab === "prompt") return textCollection(project, "prompts");
    if (tab === "script") return textCollection(project, "scripts");
    if (tab === "storyboard") return storyboardPanel(project);
    if (tab === "assets") return assetsPanel(project);
    if (tab === "version") return versionsPanel(project);
    return publishingPanel(project);
  }

  function renderProject(state, options = {}) {
    const project = state.projects.find((item) => item.id === (options.projectId || state.activeProjectId));
    if (!project) return `<section class="hh-creative-os" data-creative-command-center data-view="project"><div class="cco-empty is-page"><span aria-hidden="true">PJ</span><strong>Chưa chọn dự án</strong><p>Quay lại tổng quan để tạo hoặc mở một dự án.</p><button type="button" data-action="back-overview">Về tổng quan</button></div><div class="cco-toast" data-toast role="status" aria-live="polite"></div></section>`;
    const tab = TABS.some(([id]) => id === options.tab) ? options.tab : "brief";
    const progress = projectProgress(project);
    return `<section class="hh-creative-os" data-creative-command-center data-view="project">
      <header class="cco-project-header">
        <button type="button" class="cco-icon-button" data-action="back-overview" aria-label="Về tổng quan">←</button>
        <span class="cco-project-monogram" aria-hidden="true">${escapeHTML(project.name.slice(0, 2).toUpperCase())}</span>
        <div class="cco-project-title"><p class="cco-eyebrow">UNIVERSAL CREATIVE PROJECT</p><h1>${escapeHTML(project.name)}</h1><small>Cập nhật ${formatDate(project.updatedAt, true)}</small></div>
        <div class="cco-project-score"><span><i style="width:${progress}%"></i></span><strong>${progress}%</strong></div>
        <div class="cco-project-actions"><button type="button" data-action="import">Nhập JSON</button><button type="button" data-action="export">Xuất JSON</button><input type="file" hidden data-import-input accept="application/json,.json"></div>
      </header>
      <div class="cco-project-meta">
        <label>Tên dự án<input data-project-path="name" maxlength="180" value="${escapeHTML(project.name)}"></label>
        <label>Tiến độ<input data-project-path="analytics.progress" type="range" min="0" max="100" value="${progress}"><output data-progress-output>${progress}%</output></label>
        <label>Trạng thái<select data-project-path="review.status">${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${project.review.status === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
        <span class="cco-autosave" data-autosave-status><i></i>Đã lưu trên thiết bị</span>
      </div>
      <nav class="cco-tabs" role="tablist" aria-label="Khu vực dự án">${TABS.map(([id, label]) => `<button type="button" role="tab" aria-selected="${id === tab}" tabindex="${id === tab ? "0" : "-1"}" data-tab="${id}">${escapeHTML(label)}<span>${id === "prompt" ? project.prompts.length : id === "script" ? project.scripts.length : id === "storyboard" ? project.storyboard.length : id === "assets" ? project.assets.length : id === "version" ? project.versions.length : id === "publish" ? project.publishing.length : ""}</span></button>`).join("")}</nav>
      <main class="cco-editor" role="tabpanel" tabindex="0" data-editor-panel>${editorPanel(project, tab)}</main>
      <footer class="cco-local-note"><span aria-hidden="true">●</span><strong>Local-first</strong><p>Dữ liệu được lưu trong trình duyệt này. Hãy xuất JSON định kỳ để tự sao lưu.</p></footer>
      <div class="cco-toast" data-toast role="status" aria-live="polite"></div>
    </section>`;
  }

  function mergePatch(base, patch) {
    const result = { ...(base || {}) };
    Object.entries(patch || {}).forEach(([key, value]) => {
      result[key] = value && typeof value === "object" && !Array.isArray(value) ? mergePatch(result[key], value) : value;
    });
    return result;
  }

  function pathPatch(path, value) {
    return String(path).split(".").reverse().reduce((result, key) => ({ [key]: result }), value);
  }

  function notify(instance, message, type = "success") {
    const node = instance.root.querySelector("[data-toast]");
    if (!node) return;
    node.textContent = message;
    node.dataset.type = type;
    node.classList.add("is-visible");
    clearTimeout(instance.toastTimer);
    instance.toastTimer = setTimeout(() => node.classList.remove("is-visible"), 2600);
  }

  function render(instance) {
    const state = instance.store.getState();
    instance.root.innerHTML = instance.view === "project"
      ? renderProject(state, { projectId: instance.projectId, tab: instance.tab })
      : renderOverview(state, { query: instance.query, filter: instance.filter });
    if (instance.view === "overview") {
      const select = instance.root.querySelector("[data-project-filter]");
      if (select) select.value = instance.filter;
    }
  }

  function flushAutosave(instance) {
    clearTimeout(instance.autosaveTimer);
    if (!instance.pendingPatch || !instance.projectId) return;
    const patch = instance.pendingPatch;
    instance.pendingPatch = null;
    instance.skipRender = true;
    instance.store.updateProject(instance.projectId, patch);
    const status = instance.root.querySelector("[data-autosave-status]");
    if (status) status.innerHTML = "<i></i>Đã lưu trên thiết bị";
  }

  function queueAutosave(instance, patch) {
    instance.pendingPatch = mergePatch(instance.pendingPatch, patch);
    const status = instance.root.querySelector("[data-autosave-status]");
    if (status) status.innerHTML = "<i></i>Đang tự lưu...";
    clearTimeout(instance.autosaveTimer);
    instance.autosaveTimer = setTimeout(() => flushAutosave(instance), 450);
  }

  function currentProject(instance) {
    return instance.store.getState().projects.find((project) => project.id === instance.projectId);
  }

  function updateCollection(instance, target) {
    const project = currentProject(instance);
    const collection = target.dataset.collection;
    const itemId = target.dataset.itemId;
    const fieldName = target.dataset.itemField;
    if (!project || !collection || !fieldName || !Array.isArray(project[collection])) return;
    const next = project[collection].map((item) => item.id === itemId ? { ...item, [fieldName]: target.type === "number" ? Number(target.value) : target.value, updatedAt: new Date().toISOString() } : item);
    queueAutosave(instance, { [collection]: next });
  }

  function addCollectionItem(instance, collection) {
    flushAutosave(instance);
    const project = currentProject(instance);
    if (!project) return;
    const now = new Date().toISOString();
    const defaults = {
      prompts: { id: uid("prompt"), title: `Prompt ${project.prompts.length + 1}`, content: "", model: "", negative: "", seed: "", createdAt: now },
      scripts: { id: uid("script"), title: `Kịch bản ${project.scripts.length + 1}`, content: "", language: "vi", status: "draft", createdAt: now, updatedAt: now },
      storyboard: { id: uid("shot"), title: `Cảnh ${project.storyboard.length + 1}`, description: "", dialogue: "", duration: 5, camera: "", motion: "", audio: "", order: project.storyboard.length }
    };
    if (!defaults[collection]) return;
    instance.store.updateProject(project.id, { [collection]: [...project[collection], defaults[collection]] });
  }

  function removeCollectionItem(instance, collection, itemId) {
    flushAutosave(instance);
    const project = currentProject(instance);
    if (!project || !Array.isArray(project[collection])) return;
    instance.store.updateProject(project.id, { [collection]: project[collection].filter((item) => item.id !== itemId) });
  }

  function downloadProject(instance) {
    flushAutosave(instance);
    const project = currentProject(instance);
    if (!project || typeof Blob === "undefined" || typeof URL === "undefined") return notify(instance, "Trình duyệt không hỗ trợ tải tệp.", "error");
    const blob = new Blob([instance.store.exportProject(project.id)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.name.replace(/[^a-zA-Z0-9\u00c0-\u024f_-]+/g, "-").slice(0, 80) || "creative-project"}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(instance, "Đã xuất bản sao dự án.");
  }

  function readFile(file, asDataUrl = false) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Không thể đọc tệp."));
      if (asDataUrl) reader.readAsDataURL(file); else reader.readAsText(file, "utf-8");
    });
  }

  async function addFiles(instance, files) {
    const project = currentProject(instance);
    if (!project) return;
    for (const file of Array.from(files || []).slice(0, 20)) {
      const source = file.size <= 450000 && /^(?:image|audio|video)\//.test(file.type) ? await readFile(file, true).catch(() => "") : "";
      instance.store.addAsset(project.id, { id: uid("asset"), name: file.name, type: file.type, size: file.size, source, kind: file.type.split("/")[0] || "file", createdAt: new Date().toISOString() });
    }
    notify(instance, "Đã thêm asset vào dự án.");
  }

  function handleClick(instance, event) {
    const button = event.target.closest("button");
    if (!button || !instance.root.contains(button)) return;
    try {
      if (button.dataset.action === "create-template") {
        const template = CREATIVE_TEMPLATES.find((item) => item.id === button.dataset.template);
        if (!template) throw new Error("Không tìm thấy mẫu dự án.");
        const project = instance.store.createProject({
          name: `${template.title} · ${new Date().toLocaleDateString("vi-VN")}`,
          brief: {
            product: template.title,
            platform: template.platform,
            format: template.format,
            tone: template.tone,
            goal: template.goal,
            description: template.description
          }
        });
        instance.view = "project";
        instance.projectId = project.id;
        instance.tab = "brief";
        instance.store.setActiveProject(project.id);
        render(instance);
      } else if (button.dataset.action === "open-project-tab") {
        const project = currentProject(instance);
        if (!project) throw new Error("Hãy tạo hoặc chọn một dự án trước.");
        flushAutosave(instance);
        instance.view = "project";
        instance.projectId = project.id;
        instance.tab = button.dataset.tab || "brief";
        instance.store.setActiveProject(project.id);
        render(instance);
      } else if (button.dataset.action === "open-route") {
        const route = String(button.dataset.route || "");
        if (!route.startsWith("/create/")) throw new Error("Đường dẫn Creative không hợp lệ.");
        if (typeof window !== "undefined") window.location.hash = `#${route}`;
      } else if (button.dataset.tab) {
        flushAutosave(instance);
        instance.tab = button.dataset.tab;
        render(instance);
      } else if (button.dataset.action === "focus-create") {
        instance.root.querySelector("[data-quick-create] input")?.focus();
      } else if (button.dataset.action === "open-project") {
        instance.view = "project";
        instance.projectId = button.dataset.projectId;
        instance.tab = "brief";
        instance.store.setActiveProject(instance.projectId);
      } else if (button.dataset.action === "back-overview") {
        flushAutosave(instance);
        instance.view = "overview";
        render(instance);
      } else if (button.dataset.action === "add-item") {
        addCollectionItem(instance, button.dataset.collection);
      } else if (button.dataset.action === "remove-item") {
        removeCollectionItem(instance, button.dataset.collection, button.dataset.itemId);
      } else if (button.dataset.action === "snapshot") {
        flushAutosave(instance);
        instance.store.snapshotProject(instance.projectId, `Snapshot ${new Date().toLocaleString("vi-VN")}`, "Tạo thủ công trong Command Center");
      } else if (button.dataset.action === "export") {
        downloadProject(instance);
      } else if (button.dataset.action === "import") {
        instance.root.querySelector("[data-import-input]")?.click();
      }
    } catch (err) {
      notify(instance, err.message || "Không thể hoàn tất tác vụ.", "error");
    }
  }

  function handleInput(instance, event) {
    const target = event.target;
    if (target.matches("[data-project-search]")) {
      instance.query = target.value;
      clearTimeout(instance.searchTimer);
      instance.searchTimer = setTimeout(() => {
        const list = instance.root.querySelector("[data-project-list]");
        if (list) list.innerHTML = projectListMarkup(instance.store.getState(), instance.query, instance.filter);
      }, 120);
      return;
    }
    if (target.dataset.projectPath) {
      const value = target.type === "range" ? Number(target.value) : target.value;
      queueAutosave(instance, pathPatch(target.dataset.projectPath, value));
      if (target.type === "range") {
        const output = instance.root.querySelector("[data-progress-output]");
        if (output) output.textContent = `${target.value}%`;
      }
      return;
    }
    if (target.dataset.itemField) updateCollection(instance, target);
  }

  async function handleChange(instance, event) {
    const target = event.target;
    try {
      if (target.matches("[data-project-filter]")) {
        instance.filter = target.value;
        const list = instance.root.querySelector("[data-project-list]");
        if (list) list.innerHTML = projectListMarkup(instance.store.getState(), instance.query, instance.filter);
      } else if (target.matches("[data-import-input]") && target.files?.[0]) {
        const data = await readFile(target.files[0]);
        const project = instance.store.importProject(data);
        instance.projectId = project.id;
        instance.view = "project";
        instance.tab = "brief";
        render(instance);
      } else if (target.matches("[data-asset-input]") && target.files?.length) {
        await addFiles(instance, target.files);
      } else if (target.matches("[data-overview-asset-input]") && target.files?.length) {
        await addFiles(instance, target.files);
      }
    } catch (err) {
      notify(instance, err.message || "Không thể đọc tệp.", "error");
    }
  }

  function handleSubmit(instance, event) {
    if (event.target.matches("[data-quick-create]")) {
      event.preventDefault();
      const data = new FormData(event.target);
      try {
        const project = instance.store.createProject({ name: data.get("name"), brief: { platform: data.get("platform"), deadline: data.get("deadline"), goal: data.get("goal") } });
        instance.view = "project";
        instance.projectId = project.id;
        instance.tab = "brief";
        render(instance);
      } catch (err) {
        notify(instance, err.message || "Không thể tạo dự án.", "error");
      }
    } else if (event.target.matches("[data-publish-form]")) {
      event.preventDefault();
      flushAutosave(instance);
      const project = currentProject(instance);
      const data = new FormData(event.target);
      if (!project) return;
      instance.store.updateProject(project.id, { publishing: [...project.publishing, { id: uid("publish"), title: data.get("title"), platform: data.get("platform"), scheduledAt: new Date(data.get("scheduledAt")).toISOString(), status: "scheduled", createdAt: new Date().toISOString() }] });
    }
  }

  function handleKeydown(instance, event) {
    const tab = event.target.closest("[role=tab]");
    if (tab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const tabs = Array.from(instance.root.querySelectorAll("[role=tab]"));
      let index = tabs.indexOf(tab);
      if (event.key === "Home") index = 0;
      else if (event.key === "End") index = tabs.length - 1;
      else index = (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      tabs[index].click();
      instance.root.querySelector(`[data-tab="${tabs[index].dataset.tab}"]`)?.focus();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && instance.view === "project") {
      event.preventDefault();
      flushAutosave(instance);
      notify(instance, "Đã lưu dự án trên thiết bị.");
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n" && instance.view === "overview") {
      event.preventDefault();
      instance.root.querySelector("[data-quick-create] input")?.focus();
    }
    if (event.key === "/" && instance.view === "overview" && !/^(?:INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) {
      event.preventDefault();
      instance.root.querySelector("[data-project-search]")?.focus();
    }
  }

  function mount(root, options = {}) {
    if (!root || typeof root.querySelector !== "function") throw new TypeError("HHCreativeCommandCenter.mount cần một root DOM hợp lệ.");
    if (!CreativeCore) throw new Error("HHCreativeCore phải được tải trước Creative Command Center.");
    unmount(root);
    const store = options.store || CreativeCore.createStore();
    const state = store.getState();
    const view = options.view === "project" ? "project" : "overview";
    const instance = {
      root, store, view, tab: options.tab || "brief", projectId: options.projectId || state.activeProjectId,
      query: "", filter: "all", pendingPatch: null, skipRender: false, autosaveTimer: 0,
      searchTimer: 0, toastTimer: 0
    };
    instance.onClick = (event) => handleClick(instance, event);
    instance.onInput = (event) => handleInput(instance, event);
    instance.onChange = (event) => handleChange(instance, event);
    instance.onSubmit = (event) => handleSubmit(instance, event);
    instance.onKeydown = (event) => handleKeydown(instance, event);
    instance.onDragOver = (event) => { if (event.target.closest("[data-asset-drop]")) event.preventDefault(); };
    instance.onDrop = (event) => { if (event.target.closest("[data-asset-drop]")) { event.preventDefault(); addFiles(instance, event.dataTransfer?.files).catch((err) => notify(instance, err.message, "error")); } };
    root.addEventListener("click", instance.onClick);
    root.addEventListener("input", instance.onInput);
    root.addEventListener("change", instance.onChange);
    root.addEventListener("submit", instance.onSubmit);
    root.addEventListener("keydown", instance.onKeydown);
    root.addEventListener("dragover", instance.onDragOver);
    root.addEventListener("drop", instance.onDrop);
    instance.unsubscribe = store.subscribe(() => {
      if (instance.skipRender) { instance.skipRender = false; return; }
      render(instance);
    });
    instances.set(root, instance);
    render(instance);
    return { store, setView(nextView, projectId) { flushAutosave(instance); instance.view = nextView === "project" ? "project" : "overview"; if (projectId) { instance.projectId = projectId; store.setActiveProject(projectId); } else render(instance); }, unmount: () => unmount(root) };
  }

  function unmount(root) {
    const instance = instances.get(root);
    if (!instance) return false;
    flushAutosave(instance);
    clearTimeout(instance.searchTimer);
    clearTimeout(instance.toastTimer);
    instance.unsubscribe?.();
    root.removeEventListener("click", instance.onClick);
    root.removeEventListener("input", instance.onInput);
    root.removeEventListener("change", instance.onChange);
    root.removeEventListener("submit", instance.onSubmit);
    root.removeEventListener("keydown", instance.onKeydown);
    root.removeEventListener("dragover", instance.onDragOver);
    root.removeEventListener("drop", instance.onDrop);
    instances.delete(root);
    return true;
  }

  return Object.freeze({
    mount,
    unmount,
    renderOverview,
    renderProject,
    calculateMetrics,
    projectProgress,
    pipelineState,
    actionQueue,
    escapeHTML
  });
});
