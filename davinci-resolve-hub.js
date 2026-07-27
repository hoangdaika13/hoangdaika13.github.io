(() => {
  "use strict";

  const STORAGE_KEY = "hh.davinci.resolve.v1";
  const SESSION_KEY = "hh.davinci.resolve.bridge-key";
  const DEFAULT_ENDPOINT = "http://127.0.0.1:8765";
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const formatDuration = (seconds) => {
    if (!seconds || seconds < 0) return "—";
    const value = Math.round(seconds);
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const secs = value % 60;
    return [hours, minutes, secs].map((item) => String(item).padStart(2, "0")).join(":");
  };
  const formatBytes = (bytes) => {
    let value = Math.max(0, number(bytes));
    for (const unit of ["B", "KB", "MB", "GB", "TB"]) {
      if (value < 1024 || unit === "TB") return `${value.toFixed(unit === "B" ? 0 : 1)} ${unit}`;
      value /= 1024;
    }
    return "0 B";
  };

  const DEFAULT_CONFIG = Object.freeze({
    image_source: "",
    overlay_file: "",
    music_source: "",
    output_dir: "",
    timeline_name: "PN_kenh_trang_BATCH",
    width: 1080,
    height: 1920,
    fps: 24,
    still_seconds: 5,
    scaling: "Fill (đầy khung)",
    zoom: 1,
    motion: "Không",
    overlay_blend: "Screen",
    overlay_opacity: 85.5,
    workflow: "Trực tiếp",
    render_preset: "",
    render_format: "mp4",
    render_codec: "H264",
    bitrate_kbps: 25000,
    replace_existing: false,
    loop_audio: true,
    cleanup_temp_timelines: false,
    multi_folder_mode: true,
    skip_existing: true,
    prevent_sleep: true,
    detailed_actions: true,
    action_delay_ms: 0,
    drx_file: "",
    fusion_comp_file: "",
    resume_enabled: true,
    deep_verify: true,
    duration_tolerance_seconds: 1,
    max_retries: 2,
    retry_backoff_seconds: 2,
    template_timeline_name: "",
    template_mode: "Replace V1 placeholders",
    template_track_index: 1,
    use_profiles: false,
    profiles_file: "",
    schedule_enabled: false,
    schedule_start: "",
    batch_size: 25,
    pause_between_batches_seconds: 0,
    stall_timeout_minutes: 30,
    notification_channel: "none",
    notify_success: true,
    notify_failure: true,
    intermediate_policy: "keep",
    move_verified_outputs: false,
    gpu_temperature_limit_c: 88,
    minimum_free_disk_gb: 5
  });

  const DEFAULT_PROFILES = Object.freeze({
    profiles: [
      {
        name: "TikTok", enabled: true, width: 1080, height: 1920, fps: 30,
        render_format: "mp4", render_codec: "H264", bitrate_kbps: 18000,
        overlay_file: "", music_source: "", output_dir: "", render_preset: "",
        workflow: "Trực tiếp", suffix: "TikTok", priority: 10
      },
      {
        name: "YouTube", enabled: true, width: 1920, height: 1080, fps: 30,
        render_format: "mp4", render_codec: "H265", bitrate_kbps: 30000,
        overlay_file: "", music_source: "", output_dir: "", render_preset: "",
        workflow: "Trực tiếp", suffix: "YouTube", priority: 20
      }
    ]
  });

  const SELECTS = {
    scaling: ["Dùng thiết lập project", "Crop", "Fit (không cắt ảnh)", "Fill (đầy khung)", "Stretch"],
    motion: ["Không", "Zoom in", "Zoom out", "Pan trái → phải", "Pan phải → trái"],
    overlay_blend: ["Normal", "Add", "Multiply", "Screen", "Overlay", "Soft Light", "Lighten", "Linear Dodge"],
    workflow: ["Trực tiếp", "2 giai đoạn (giống video)"],
    render_format: ["mp4", "mov", "mxf"],
    render_codec: ["H264", "H265", "ProRes", "DNxHR"],
    notification_channel: ["none", "telegram", "slack", "email"],
    intermediate_policy: ["keep", "delete_verified", "zip_then_delete"]
  };

  const FORM_GROUPS = [
    {
      id: "sources", label: "01 · Nguồn & dự án", description: "Đường dẫn được Resolve Desktop đọc trực tiếp trên Windows.",
      fields: [
        ["image_source", "Nguồn ảnh / thư mục gốc", "text"],
        ["overlay_file", "Video overlay", "text"],
        ["music_source", "Thư mục / file nhạc", "text"],
        ["output_dir", "Thư mục xuất", "text"],
        ["timeline_name", "Tên timeline / video", "text"],
        ["multi_folder_mode", "Mỗi thư mục con = một video", "boolean"],
        ["skip_existing", "Xác minh rồi bỏ qua output có sẵn", "boolean"]
      ]
    },
    {
      id: "timeline", label: "02 · Timeline & template", description: "Clone template và thay V1 placeholder như editor thao tác trong Resolve.",
      fields: [
        ["width", "Chiều rộng", "number", 16, 7680, 1],
        ["height", "Chiều cao", "number", 16, 7680, 1],
        ["fps", "FPS", "number", 1, 120, 0.001],
        ["still_seconds", "Giây / ảnh", "number", 0.1, 3600, 0.1],
        ["scaling", "Scaling", "select"],
        ["zoom", "Zoom", "number", 0.1, 100, 0.01],
        ["motion", "Chuyển động", "select"],
        ["template_timeline_name", "Template timeline", "text"],
        ["template_track_index", "Placeholder track V", "number", 1, 32, 1],
        ["drx_file", "Color Grade .drx", "text"],
        ["fusion_comp_file", "Fusion .comp / .setting", "text"]
      ]
    },
    {
      id: "render", label: "03 · Overlay, audio & Deliver", description: "Thiết lập V2, A1/A2 và Render Queue.",
      fields: [
        ["overlay_blend", "Blend overlay", "select"],
        ["overlay_opacity", "Opacity overlay (%)", "number", 0, 100, 0.1],
        ["loop_audio", "Lặp nhạc tới hết video", "boolean"],
        ["workflow", "Workflow", "select"],
        ["render_preset", "Render preset", "text"],
        ["render_format", "Format", "select"],
        ["render_codec", "Codec", "select"],
        ["bitrate_kbps", "Bitrate (Kb/s)", "number", 100, 500000, 100],
        ["replace_existing", "Cho phép thay file hiện có", "boolean"],
        ["cleanup_temp_timelines", "Xóa timeline trung gian do tool tạo", "boolean"]
      ]
    },
    {
      id: "resilience", label: "04 · Chạy dài hạn", description: "Checkpoint, retry, scheduler và watchdog cho phiên vài giờ.",
      fields: [
        ["resume_enabled", "Checkpoint / Resume", "boolean"],
        ["max_retries", "Retry mỗi action", "number", 0, 10, 1],
        ["retry_backoff_seconds", "Retry backoff (giây)", "number", 0, 300, 0.5],
        ["stall_timeout_minutes", "Watchdog đứng yên (phút)", "number", 0, 240, 1],
        ["schedule_enabled", "Hẹn giờ bắt đầu", "boolean"],
        ["schedule_start", "Lịch YYYY-MM-DD HH:MM", "text"],
        ["batch_size", "Số job / batch", "number", 1, 500, 1],
        ["pause_between_batches_seconds", "Nghỉ giữa batch (giây)", "number", 0, 86400, 1],
        ["prevent_sleep", "Giữ Windows thức", "boolean"],
        ["gpu_temperature_limit_c", "Dừng khi GPU ≥ °C", "number", 50, 110, 1],
        ["minimum_free_disk_gb", "Dung lượng tối thiểu (GB)", "number", 1, 1000, 0.5]
      ]
    },
    {
      id: "verify", label: "05 · Hậu kiểm & thông báo", description: "FFprobe, frame cuối, thư mục cách ly và báo trạng thái.",
      fields: [
        ["deep_verify", "Decode frame cuối", "boolean"],
        ["duration_tolerance_seconds", "Sai số duration (giây)", "number", 0.1, 30, 0.1],
        ["intermediate_policy", "File trung gian", "select"],
        ["move_verified_outputs", "Chuyển file đạt vào _verified", "boolean"],
        ["notification_channel", "Kênh thông báo", "select"],
        ["notify_success", "Báo thành công", "boolean"],
        ["notify_failure", "Báo lỗi", "boolean"],
        ["detailed_actions", "Ghi chi tiết từng action", "boolean"],
        ["action_delay_ms", "Độ trễ log action (ms)", "number", 0, 5000, 50]
      ]
    }
  ];

  const GRAPH_NODES = [
    ["PRECHECK", "Kiểm tra ảnh, nhạc, overlay, project, codec và dung lượng"],
    ["PRODUCE", "Import Media → clone timeline → V1/V2/A1 → Deliver"],
    ["VERIFY", "FFprobe stream, FPS, resolution, duration và frame cuối"],
    ["INTERMEDIATE", "Giữ, xóa hoặc nén clip trung gian sau khi verified"],
    ["NOTIFY", "Telegram, Slack hoặc email theo biến môi trường desktop"]
  ];

  let activeRoot = null;
  let pollTimer = 0;
  let state = loadState();

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        endpoint: saved.endpoint || DEFAULT_ENDPOINT,
        config: { ...clone(DEFAULT_CONFIG), ...(saved.config || {}) },
        profiles: saved.profiles || clone(DEFAULT_PROFILES),
        view: saved.view || "command",
        connected: false,
        busy: false,
        task: "",
        progress: 0,
        progressText: "Bridge chưa kết nối",
        dashboard: {},
        result: {},
        events: [],
        lastEventId: 0,
        error: ""
      };
    } catch {
      return {
        endpoint: DEFAULT_ENDPOINT, config: clone(DEFAULT_CONFIG), profiles: clone(DEFAULT_PROFILES),
        view: "command", connected: false, busy: false, task: "", progress: 0,
        progressText: "Bridge chưa kết nối", dashboard: {}, result: {}, events: [],
        lastEventId: 0, error: ""
      };
    }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      endpoint: state.endpoint,
      config: state.config,
      profiles: state.profiles,
      view: state.view
    }));
  }

  const bridgeKey = () => sessionStorage.getItem(SESSION_KEY) || "";
  async function api(path, options = {}) {
    const response = await fetch(`${state.endpoint}${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        "X-H-Cosmic-Key": bridgeKey(),
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });
    let payload = {};
    try { payload = await response.json(); } catch { payload = {}; }
    if (!response.ok) throw new Error(payload.error || `Bridge HTTP ${response.status}`);
    return payload;
  }

  function fieldMarkup(field) {
    const [name, label, type, min, max, step] = field;
    const value = state.config[name];
    if (type === "boolean") {
      return `<label class="dr-toggle"><input type="checkbox" data-dr-field="${name}" ${value ? "checked" : ""}><span></span><b>${escapeHtml(label)}</b></label>`;
    }
    if (type === "select") {
      return `<label class="dr-field"><span>${escapeHtml(label)}</span><select data-dr-field="${name}">${(SELECTS[name] || []).map((option) => `<option value="${escapeHtml(option)}" ${String(value) === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select></label>`;
    }
    return `<label class="dr-field ${type === "text" ? "dr-field--wide" : ""}"><span>${escapeHtml(label)}</span><input type="${type}" data-dr-field="${name}" value="${escapeHtml(value)}" ${min != null ? `min="${min}"` : ""} ${max != null ? `max="${max}"` : ""} ${step != null ? `step="${step}"` : ""}></label>`;
  }

  function formGroupMarkup(group) {
    return `<section class="dr-form-group" id="dr-${group.id}"><header><span>${group.label}</span><p>${group.description}</p></header><div>${group.fields.map(fieldMarkup).join("")}</div></section>`;
  }

  function actionGraphMarkup() {
    const latest = new Map();
    state.events.filter((event) => event.kind === "action").forEach((event) => {
      const action = event.payload || {};
      const root = String(action.code || "").split(".")[0];
      if (root) latest.set(root, action);
    });
    return GRAPH_NODES.map(([id, description], index) => {
      const event = latest.get(id);
      const status = event?.status || (state.busy && index === 0 ? "running" : "pending");
      return `<article class="dr-graph-node is-${escapeHtml(status)}"><i>${String(index + 1).padStart(2, "0")}</i><div><strong>${id}</strong><p>${escapeHtml(event?.detail || description)}</p></div><span>${status === "done" ? "PASS" : status === "error" ? "ERROR" : status === "running" ? "RUNNING" : "WAIT"}</span></article>${index < GRAPH_NODES.length - 1 ? '<b class="dr-graph-link">↓</b>' : ""}`;
    }).join("");
  }

  function eventMarkup() {
    const events = state.events.slice(-120).reverse();
    if (!events.length) return '<div class="dr-empty"><b>Chưa có sự kiện</b><span>Kết nối Desktop Bridge và chạy PRECHECK để xem từng hành động.</span></div>';
    return events.map((event) => {
      const payload = event.payload || {};
      const title = event.kind === "action" ? `${payload.code || "ACTION"} · ${payload.action || ""}` : event.kind.toUpperCase();
      const detail = typeof payload === "string" ? payload : payload.detail || payload.message || payload.text || "";
      return `<article class="dr-event is-${escapeHtml(payload.status || event.kind)}"><time>${new Date(event.at).toLocaleTimeString("vi-VN")}</time><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(detail)}</p></div></article>`;
    }).join("");
  }

  function dashboardMarkup() {
    const metric = state.dashboard || {};
    return [
      ["JOB HIỆN TẠI", metric.current_job || state.task || "—"],
      ["HOÀN TẤT / LỖI", `${metric.completed_jobs || 0} / ${metric.failed_jobs || 0}`],
      ["ETA", formatDuration(metric.eta_seconds)],
      ["TỐC ĐỘ", `${number(metric.jobs_per_hour).toFixed(1)} job/h`],
      ["GPU", metric.gpu_temperature_c ? `${number(metric.gpu_utilization).toFixed(0)}% · ${number(metric.gpu_temperature_c).toFixed(0)}°C` : "Chưa có dữ liệu"],
      ["Ổ ĐĨA", metric.disk_free_bytes ? `${formatBytes(metric.disk_free_bytes)} trống` : "—"]
    ].map(([label, value]) => `<div><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
  }

  function commandView() {
    const result = state.result || {};
    return `<section class="dr-view dr-command-view">
      <div class="dr-command-grid">
        <section class="dr-panel dr-live-panel">
          <header><div><span>MISSION CONTROL</span><h3>Phiên sản xuất hàng loạt</h3></div><b class="${state.connected ? "is-online" : ""}">${state.connected ? "BRIDGE ONLINE" : "BRIDGE OFFLINE"}</b></header>
          <div class="dr-live-metrics">${dashboardMarkup()}</div>
          <div class="dr-progress"><i style="width:${Math.round(number(state.progress) * 100)}%"></i></div>
          <div class="dr-progress-copy"><strong>${escapeHtml(state.progressText)}</strong><span>${Math.round(number(state.progress) * 100)}%</span></div>
          <div class="dr-primary-actions">
            <button class="is-precheck" type="button" data-dr-run="preflight" ${!state.connected || state.busy ? "disabled" : ""}>PRECHECK</button>
            <button type="button" data-dr-run="build" ${!state.connected || state.busy ? "disabled" : ""}>Tạo timeline</button>
            <button type="button" data-dr-run="queue" ${!state.connected || state.busy ? "disabled" : ""}>Đưa vào Queue</button>
            <button class="is-primary" type="button" data-dr-run="render" ${!state.connected || state.busy ? "disabled" : ""}>Làm toàn bộ + Render</button>
            <button type="button" data-dr-run="resume" ${!state.connected || state.busy ? "disabled" : ""}>Resume</button>
            <button class="is-danger" type="button" data-dr-run="cancel" ${!state.connected || !state.busy ? "disabled" : ""}>Hủy an toàn</button>
          </div>
          ${state.error ? `<p class="dr-error">${escapeHtml(state.error)}</p>` : ""}
          ${Object.keys(result).length ? `<div class="dr-result"><span>KẾT QUẢ GẦN NHẤT</span><strong>${escapeHtml(result.status || (result.failures?.length ? "Có lỗi" : "Hoàn tất"))}</strong><p>${escapeHtml(result.report_path || result.error || `${result.jobs?.length || 0} job`)}</p></div>` : ""}
        </section>
        <section class="dr-panel dr-graph"><header><div><span>ACTION GRAPH</span><h3>Điều kiện · Retry · Rollback</h3></div><button type="button" data-dr-view="audit">Xem audit</button></header><div>${actionGraphMarkup()}</div></section>
      </div>
      <section class="dr-panel dr-events"><header><div><span>HUMAN ACTION BLUEPRINT</span><h3>Nhật ký hành động giống editor trong Resolve</h3></div><button type="button" data-dr-clear-log>Xóa log hiển thị</button></header><div data-dr-event-list>${eventMarkup()}</div></section>
    </section>`;
  }

  function configView() {
    return `<section class="dr-view dr-config-view">
      <header class="dr-view-header"><div><span>PRODUCTION CONFIGURATION</span><h2>Toàn bộ cấu hình H Cosmic Studio</h2><p>Thay đổi được lưu cục bộ. Khi Bridge online, nút Đồng bộ sẽ ghi vào cấu hình desktop.</p></div><div><button type="button" data-dr-export-config>Xuất JSON</button><label>Nhập JSON<input type="file" accept="application/json" data-dr-import-config></label><button class="is-primary" type="button" data-dr-save-config>Đồng bộ Desktop</button></div></header>
      <div class="dr-form-stack">${FORM_GROUPS.map(formGroupMarkup).join("")}</div>
    </section>`;
  }

  function profilesView() {
    return `<section class="dr-view dr-profiles-view">
      <header class="dr-view-header"><div><span>MULTI-PROFILE MATRIX</span><h2>Một nguồn, nhiều nền tảng</h2><p>Mỗi profile có resolution, codec, overlay, nhạc, output, suffix và priority riêng.</p></div><div><button type="button" data-dr-profile-template>Nạp mẫu TikTok + YouTube</button><button type="button" data-dr-export-profiles>Xuất profiles.json</button></div></header>
      <section class="dr-panel dr-profile-editor"><div class="dr-profile-help"><h3>production_profiles.json</h3><p>Giá trị rỗng kế thừa cấu hình chính. Desktop Bridge đọc file tại đường dẫn Windows trong trường <b>Profiles file</b>.</p><label class="dr-toggle"><input type="checkbox" data-dr-field="use_profiles" ${state.config.use_profiles ? "checked" : ""}><span></span><b>Dùng nhiều profile trong phiên</b></label><label class="dr-field"><span>Đường dẫn profiles_file trên máy</span><input type="text" data-dr-field="profiles_file" value="${escapeHtml(state.config.profiles_file)}"></label></div><textarea data-dr-profiles spellcheck="false">${escapeHtml(JSON.stringify(state.profiles, null, 2))}</textarea></section>
      <div class="dr-profile-cards">${(state.profiles.profiles || []).map((profile) => `<article><span>${escapeHtml(profile.name || "Profile")}</span><strong>${profile.width || "inherit"} × ${profile.height || "inherit"}</strong><p>${escapeHtml(profile.render_codec || "inherit")} · ${escapeHtml(profile.fps || "inherit")} fps · priority ${escapeHtml(profile.priority ?? 100)}</p><small>${escapeHtml(profile.output_dir || "Kế thừa thư mục xuất")}</small></article>`).join("")}</div>
    </section>`;
  }

  function auditView() {
    const checks = [
      "Ảnh tồn tại, đọc được, không trùng tên và không có ký tự cấm",
      "Hướng ảnh, FPS project, resolution và codec Resolve",
      "Độ dài overlay, playlist nhạc và khả năng lặp",
      "DRX, Fusion comp, output đã tồn tại và dung lượng ổ đĩa",
      "Video/audio stream, FPS, resolution, duration và frame cuối",
      "Manifest nguyên tử sau từng action; output lỗi vào _retry hoặc _failed"
    ];
    return `<section class="dr-view dr-audit-view">
      <header class="dr-view-header"><div><span>QUALITY & RECOVERY</span><h2>Preflight, manifest và hậu kiểm</h2><p>Không video nào được coi là hoàn tất chỉ vì Render Queue báo Complete.</p></div><button class="is-primary" type="button" data-dr-run="preflight" ${!state.connected || state.busy ? "disabled" : ""}>Chạy PRECHECK ngay</button></header>
      <div class="dr-audit-grid">
        <section class="dr-panel"><header><div><span>PRECHECK</span><h3>PASS / WARNING / BLOCKED</h3></div></header><ol>${checks.map((check, index) => `<li><i>${String(index + 1).padStart(2, "0")}</i><span>${escapeHtml(check)}</span></li>`).join("")}</ol></section>
        <section class="dr-panel dr-manifest-card"><header><div><span>CHECKPOINT</span><h3>Resume chính xác từng job</h3></div></header><pre>{
  "job": "Video_023__TikTok",
  "status": "stage_1_rendered",
  "last_action": "PRODUCE",
  "attempt": 1,
  "output": "Video_023_TikTok.mp4"
}</pre><p>Manifest: <b>&lt;output&gt;/.hcosmic/manifests/</b></p><p>Phân loại: <b>_verified / _retry / _failed</b></p></section>
      </div>
      <section class="dr-panel dr-security"><div><span>LOCAL BRIDGE SECURITY</span><h3>Website không nhận quyền hệ thống trực tiếp</h3><p>Bridge chỉ lắng nghe trên 127.0.0.1, yêu cầu mã ghép nối, chỉ chấp nhận origin nhhoang13all.xyz và không lưu mã vào localStorage.</p></div><a href="/downloads/h-cosmic-davinci-resolve.zip" download>Tải H Cosmic Studio Desktop</a></section>
    </section>`;
  }

  function viewMarkup() {
    if (state.view === "config") return configView();
    if (state.view === "profiles") return profilesView();
    if (state.view === "audit") return auditView();
    return commandView();
  }

  function rootMarkup() {
    return `<section class="dr-hub" data-dr-hub>
      <header class="dr-hero">
        <div class="dr-hero__brand"><span class="dr-h-logo"><b>H</b><i></i></span><div><small>HH COSMIC PRODUCTION SYSTEM</small><h1>Davinci Resolve</h1><p>Điều khiển H Cosmic Studio, sản xuất hàng loạt và hậu kiểm Resolve từ một trung tâm chỉ huy.</p></div></div>
        <div class="dr-bridge-card">
          <div><span class="${state.connected ? "is-online" : ""}"></span><b>${state.connected ? "Desktop Bridge đã kết nối" : "Desktop Bridge chưa kết nối"}</b><small>${escapeHtml(state.endpoint)}</small></div>
          <label><span>Mã ghép nối</span><input type="password" data-dr-bridge-key placeholder="8 ký tự" value="${escapeHtml(bridgeKey())}" autocomplete="one-time-code"></label>
          <button class="${state.connected ? "is-connected" : ""}" type="button" data-dr-connect>${state.connected ? "Ngắt kết nối" : "Kết nối Resolve"}</button>
        </div>
      </header>
      <nav class="dr-nav" aria-label="Davinci Resolve">
        ${[
          ["command", "Mission Control", "Live"],
          ["config", "Cấu hình sản xuất", "50 tùy chọn"],
          ["profiles", "Multi-profile", "TikTok · YouTube"],
          ["audit", "Preflight & Recovery", "P0–P2"]
        ].map(([id, label, meta]) => `<button class="${state.view === id ? "is-active" : ""}" type="button" data-dr-view="${id}"><span>${label}</span><small>${meta}</small></button>`).join("")}
        <a href="/downloads/h-cosmic-davinci-resolve.zip" download><span>Tải Desktop Tool</span><small>Windows · Resolve</small></a>
      </nav>
      <main data-dr-main>${viewMarkup()}</main>
      <div class="dr-toast" data-dr-toast role="status" aria-live="polite" hidden></div>
    </section>`;
  }

  function render(full = false) {
    if (!activeRoot) return;
    if (full) {
      activeRoot.innerHTML = rootMarkup();
      return;
    }
    const main = activeRoot.querySelector("[data-dr-main]");
    if (main) main.innerHTML = viewMarkup();
    activeRoot.querySelectorAll("[data-dr-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.drView === state.view));
    const status = activeRoot.querySelector(".dr-bridge-card");
    if (status) {
      const dot = status.querySelector("div>span");
      dot?.classList.toggle("is-online", state.connected);
      const title = status.querySelector("div>b");
      if (title) title.textContent = state.connected ? "Desktop Bridge đã kết nối" : "Desktop Bridge chưa kết nối";
      const connect = status.querySelector("[data-dr-connect]");
      if (connect) {
        connect.textContent = state.connected ? "Ngắt kết nối" : "Kết nối Resolve";
        connect.classList.toggle("is-connected", state.connected);
      }
    }
  }

  function toast(message, kind = "success") {
    const node = activeRoot?.querySelector("[data-dr-toast]");
    if (!node) return;
    node.textContent = message;
    node.dataset.kind = kind;
    node.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { node.hidden = true; }, 4200);
  }

  function download(name, value, type = "application/json") {
    const url = URL.createObjectURL(new Blob([value], { type }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function readForm() {
    activeRoot?.querySelectorAll("[data-dr-field]").forEach((input) => {
      const key = input.dataset.drField;
      if (!(key in state.config)) return;
      state.config[key] = input.type === "checkbox" ? input.checked : input.type === "number" ? number(input.value, state.config[key]) : input.value;
    });
    const profiles = activeRoot?.querySelector("[data-dr-profiles]");
    if (profiles) {
      try { state.profiles = JSON.parse(profiles.value); profiles.setCustomValidity(""); }
      catch { profiles.setCustomValidity("JSON profile chưa hợp lệ."); }
    }
    persist();
  }

  async function connect() {
    if (state.connected) {
      state.connected = false;
      state.busy = false;
      clearTimeout(pollTimer);
      sessionStorage.removeItem(SESSION_KEY);
      render(true);
      toast("Đã ngắt phiên ghép nối.");
      return;
    }
    const keyInput = activeRoot.querySelector("[data-dr-bridge-key]");
    const key = String(keyInput?.value || "").trim().toUpperCase();
    if (!key) return toast("Nhập mã ghép nối hiển thị trong H Cosmic Studio.", "error");
    sessionStorage.setItem(SESSION_KEY, key);
    try {
      await api("/api/health");
      const config = await api("/api/config");
      state.config = { ...clone(DEFAULT_CONFIG), ...config };
      state.connected = true;
      state.error = "";
      persist();
      render(true);
      toast("Đã kết nối H Cosmic Studio trên máy này.");
      pollStatus();
    } catch (error) {
      sessionStorage.removeItem(SESSION_KEY);
      state.connected = false;
      state.error = error.message;
      render(true);
      toast(`${error.message} Hãy bật Website Bridge trong tool desktop.`, "error");
    }
  }

  async function pollStatus() {
    clearTimeout(pollTimer);
    if (!state.connected) return;
    try {
      const payload = await api(`/api/status?after=${state.lastEventId}`);
      state.busy = Boolean(payload.busy);
      state.task = payload.task || "";
      state.progress = number(payload.progress);
      state.progressText = payload.progress_text || "Sẵn sàng";
      state.dashboard = payload.dashboard || {};
      state.result = payload.result || {};
      state.error = payload.error || "";
      state.lastEventId = number(payload.last_event_id, state.lastEventId);
      if (payload.events?.length) state.events = [...state.events, ...payload.events].slice(-1000);
      render();
    } catch (error) {
      state.connected = false;
      state.busy = false;
      state.error = error.message;
      render(true);
      toast("Mất kết nối Desktop Bridge.", "error");
      return;
    }
    pollTimer = setTimeout(pollStatus, state.busy ? 1200 : 3500);
  }

  async function saveConfig() {
    readForm();
    if (!state.connected) return toast("Đã lưu cấu hình trên trình duyệt. Kết nối Bridge để đồng bộ desktop.");
    try {
      await api("/api/config", { method: "POST", body: { config: state.config } });
      toast("Đã đồng bộ cấu hình vào H Cosmic Studio.");
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function run(action) {
    readForm();
    if (!state.connected) return toast("Desktop Bridge chưa kết nối.", "error");
    try {
      if (action === "cancel") {
        await api("/api/cancel", { method: "POST", body: {} });
        toast("Đã yêu cầu dừng an toàn.");
      } else if (action === "preflight") {
        await api("/api/preflight", { method: "POST", body: { config: state.config } });
        state.busy = true;
        state.task = "preflight";
        toast("PRECHECK đã bắt đầu.");
      } else {
        if (action === "resume") state.config.resume_enabled = true;
        await api("/api/run", {
          method: "POST",
          body: { action: action === "resume" ? "render" : action, config: state.config }
        });
        state.busy = true;
        state.task = action;
        toast(`${action === "render" || action === "resume" ? "Render" : "Tác vụ"} đã bắt đầu.`);
      }
      render();
      pollStatus();
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function importConfig(file) {
    try {
      const value = JSON.parse(await file.text());
      state.config = { ...clone(DEFAULT_CONFIG), ...value };
      persist();
      render();
      toast("Đã nhập cấu hình.");
    } catch {
      toast("File cấu hình không phải JSON hợp lệ.", "error");
    }
  }

  function bind(root) {
    root.addEventListener("click", (event) => {
      const view = event.target.closest("[data-dr-view]");
      if (view) {
        readForm();
        state.view = view.dataset.drView;
        persist();
        render();
        return;
      }
      if (event.target.closest("[data-dr-connect]")) return connect();
      const action = event.target.closest("[data-dr-run]");
      if (action) return run(action.dataset.drRun);
      if (event.target.closest("[data-dr-save-config]")) return saveConfig();
      if (event.target.closest("[data-dr-export-config]")) {
        readForm();
        return download("h-cosmic-production-config.json", JSON.stringify(state.config, null, 2));
      }
      if (event.target.closest("[data-dr-profile-template]")) {
        state.profiles = clone(DEFAULT_PROFILES);
        persist();
        render();
        return toast("Đã nạp profile TikTok và YouTube.");
      }
      if (event.target.closest("[data-dr-export-profiles]")) {
        readForm();
        return download("production_profiles.json", JSON.stringify(state.profiles, null, 2));
      }
      if (event.target.closest("[data-dr-clear-log]")) {
        state.events = [];
        render();
      }
    });
    root.addEventListener("change", (event) => {
      if (event.target.matches("[data-dr-field]")) readForm();
      if (event.target.matches("[data-dr-import-config]") && event.target.files?.[0]) importConfig(event.target.files[0]);
      if (event.target.matches("[data-dr-profiles]")) {
        readForm();
        render();
      }
    });
    root.addEventListener("input", (event) => {
      if (event.target.matches("[data-dr-field]")) readForm();
    });
  }

  function mount(host, options = {}) {
    if (!host) return;
    unmount();
    activeRoot = host;
    state = loadState();
    if (options.view && ["command", "config", "profiles", "audit"].includes(options.view)) state.view = options.view;
    host.innerHTML = rootMarkup();
    bind(host);
    if (bridgeKey()) connect();
  }

  function unmount() {
    clearTimeout(pollTimer);
    if (activeRoot) activeRoot.replaceChildren();
    activeRoot = null;
  }

  window.HHDavinciResolveHub = { mount, unmount, defaults: clone(DEFAULT_CONFIG) };
  const pending = document.querySelector("[data-davinci-resolve-host]");
  if (pending) mount(pending, { view: pending.dataset.davinciResolveView || "command" });
})();
