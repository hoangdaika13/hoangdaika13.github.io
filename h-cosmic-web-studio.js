(() => {
  "use strict";

  const BRIDGE = "http://127.0.0.1:8765";
  const AUTO_CONNECT = "h-cosmic-auto-v2";
  const ZIP_URL = "/downloads/H-Cosmic-Studio-Portable-2026.08.03-r26.zip";
  const STORAGE_PREFIX = "hh.h-cosmic-web.r26";
  const SECTION_IDS = ["source", "timeline", "effects", "grade", "render", "enterprise", "blueprint"];
  const NUMBER_FIELDS = new Set([
    "width", "height", "fps", "still_seconds", "video_minutes", "stage1_clip_minutes", "zoom",
    "overlay_opacity", "overlay_speed_percent", "wildlife_default_x_percent", "wildlife_default_y_percent",
    "wildlife_default_scale_percent", "wildlife_speed_percent", "wildlife_opacity", "wildlife_rotation_degrees",
    "bitrate_kbps", "shuffle_seed", "music_minimum_minutes", "audio_pitch_semitones",
    "audio_reference_frequency_hz", "action_delay_ms", "duration_tolerance_seconds", "max_retries",
    "retry_backoff_seconds", "template_track_index", "batch_size", "pause_between_batches_seconds",
    "stall_timeout_minutes", "gpu_temperature_limit_c", "minimum_free_disk_gb"
  ]);
  const BOOL_FIELDS = new Set([
    "one_image_per_video", "random_wildlife", "wildlife_flip_horizontal", "replace_existing", "loop_audio",
    "shuffle_audio", "require_audio", "music_driven_duration", "random_overlay", "cleanup_temp_timelines",
    "multi_folder_mode", "skip_existing", "prevent_sleep", "detailed_actions", "resume_enabled", "deep_verify",
    "use_template_timeline", "use_profiles", "schedule_enabled", "notify_success", "notify_failure",
    "move_verified_outputs"
  ]);
  const DEFAULT_CONFIG = Object.freeze({
    image_source: "", overlay_file: "", music_source: "", output_dir: "", timeline_name: "PN_kenh_trang_BATCH",
    width: 1920, height: 1080, fps: 24, still_seconds: 5, one_image_per_video: true, video_minutes: 60,
    stage1_clip_minutes: 1, scaling: "Fill (đầy khung)", zoom: 1, motion: "Không", overlay_blend: "Screen",
    overlay_opacity: 90, overlay_speed_percent: 100, wildlife_source: "", wildlife_default_x_percent: 50,
    wildlife_default_y_percent: 50, wildlife_default_scale_percent: 60, wildlife_speed_percent: 100,
    wildlife_opacity: 100, wildlife_flip_horizontal: false, wildlife_rotation_degrees: 0, random_wildlife: true,
    wildlife_positions: {},
    workflow: "Trực tiếp", render_preset: "", render_format: "mp4", render_codec: "H264", bitrate_kbps: 10000,
    replace_existing: false, loop_audio: true, shuffle_audio: true, shuffle_seed: 130803, require_audio: true,
    music_driven_duration: true, music_minimum_minutes: 60, audio_pitch_semitones: 0,
    audio_reference_frequency_hz: 0, random_overlay: true, cleanup_temp_timelines: false, multi_folder_mode: false,
    skip_existing: true, prevent_sleep: true, detailed_actions: true, action_delay_ms: 0, drx_file: "",
    color_grade_mode: "Mặc định (không chỉnh màu)", fusion_comp_file: "", resume_enabled: true, deep_verify: true,
    duration_tolerance_seconds: 1, max_retries: 2, retry_backoff_seconds: 2, use_template_timeline: false,
    template_timeline_name: "", template_mode: "Replace V1 placeholders", template_track_index: 1,
    use_profiles: false, profiles_file: "", schedule_enabled: false, schedule_start: "", batch_size: 25,
    pause_between_batches_seconds: 0, stall_timeout_minutes: 30, notification_channel: "none",
    notify_success: true, notify_failure: true, intermediate_policy: "keep", move_verified_outputs: false,
    gpu_temperature_limit_c: 88, minimum_free_disk_gb: 5
  });
  const BLUEPRINT = Object.freeze([
    ["SYS", "Project Manager", "Kết nối Resolve, project và kiểm tra thiết lập scripting"],
    ["PREFLIGHT", "Preflight", "Quét ảnh, nhạc, overlay, codec, FPS, dung lượng và output"],
    ["MEDIA", "Media Pool", "Tạo bin và nhập media theo thứ tự tên tự nhiên"],
    ["EDIT", "Edit", "Tạo timeline V1/V2, loop ảnh, effect và playlist nhạc"],
    ["INSP", "Inspector", "Áp scale, zoom, blend, opacity, speed và vị trí wildlife"],
    ["COLOR", "Color/Fusion", "Áp DRX RapidGrade hoặc Fusion composition khi được bật"],
    ["DELIVER", "Deliver", "Đặt format, codec, bitrate, output và render preset"],
    ["QUEUE", "Render Queue", "Thêm job, chạy tuần tự, checkpoint và resume"],
    ["VERIFY", "FFprobe", "Kiểm tra stream, resolution, FPS, duration và audio"],
    ["REPORT", "Mission Control", "Ghi manifest, enterprise report và thông báo kết quả"]
  ]);

  let root = null;
  let controller = null;
  let pollTimer = 0;
  let accessKey = "";
  let lastEventId = 0;
  let bridgeState = "offline";
  let activeSection = "source";
  let activeMode = "web";

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const currentOwner = () => {
    let user = window.HHAuthz?.currentUser?.();
    if (!user) try { user = JSON.parse(localStorage.getItem("hh-auth-user") || "null"); } catch { user = null; }
    return String(user?.id || user?._id || "guest").replace(/[^a-z0-9_-]/gi, "").slice(0, 80) || "guest";
  };
  const storageKey = () => `${STORAGE_PREFIX}:${currentOwner()}`;
  const label = (text, field) => `<label><span>${text}</span>${field}</label>`;
  const input = (name, placeholder = "", type = "text", attrs = "") => `<input name="${name}" type="${type}" placeholder="${esc(placeholder)}" ${attrs}>`;
  const check = (name, text) => `<label class="hc-check"><input name="${name}" type="checkbox"><span>${text}</span></label>`;
  const select = (name, options) => `<select name="${name}">${options.map(([value, text]) => `<option value="${esc(value)}">${esc(text)}</option>`).join("")}</select>`;

  function readStoredConfig() {
    try { return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(storageKey()) || "{}") }; }
    catch { return { ...DEFAULT_CONFIG }; }
  }
  function writeStoredConfig(config) {
    localStorage.setItem(storageKey(), JSON.stringify(config));
  }
  function formConfig() {
    const form = root?.querySelector("[data-hc-form]");
    const config = { ...DEFAULT_CONFIG };
    if (!form) return config;
    for (const [name] of Object.entries(DEFAULT_CONFIG)) {
      const field = form.elements.namedItem(name);
      if (!field) continue;
      if (BOOL_FIELDS.has(name)) config[name] = Boolean(field.checked);
      else if (name === "wildlife_positions") {
        try { config[name] = JSON.parse(field.value || "{}"); } catch { config[name] = {}; }
      }
      else if (NUMBER_FIELDS.has(name)) config[name] = Number(field.value);
      else config[name] = String(field.value || "").trim();
    }
    return config;
  }
  function applyConfig(config) {
    const form = root?.querySelector("[data-hc-form]");
    if (!form) return;
    for (const [name, value] of Object.entries({ ...DEFAULT_CONFIG, ...(config || {}) })) {
      const field = form.elements.namedItem(name);
      if (!field) continue;
      if (field.type === "checkbox") field.checked = Boolean(value);
      else if (name === "wildlife_positions") field.value = JSON.stringify(value && typeof value === "object" ? value : {}, null, 2);
      else field.value = value ?? "";
    }
    updateEstimate();
  }

  function sourceSection() {
    return `<section data-hc-section="source">
      <header><small>01 · SYSTEM & SOURCE</small><h3>Nguồn sản xuất</h3><p>Nhập đường dẫn Windows mà DaVinci Resolve và bridge trên máy có thể đọc.</p></header>
      <div class="hc-grid hc-grid--2">
        ${label("Thư mục hoặc file ảnh", input("image_source", "D:\\Nguon_Anh"))}
        ${label("Thư mục xuất", input("output_dir", "D:\\Output"))}
        ${label("Nguồn nhạc", input("music_source", "D:\\Music"))}
        ${label("Timeline / tiền tố output", input("timeline_name", "PN_kenh_trang_BATCH"))}
      </div>
      <div class="hc-check-grid">${check("one_image_per_video", "Mỗi ảnh tạo một video độc lập")}${check("multi_folder_mode", "Quét thư mục con")}${check("require_audio", "Bắt buộc có audio")}${check("skip_existing", "Bỏ qua output đã hậu kiểm")}</div>
      <div class="hc-grid hc-grid--3 hc-plan-inputs">
        ${label("Số ảnh dự kiến", input("ui_job_count", "267", "number", "min=1 value=267 data-hc-estimate"))}
        ${label("Workflow", select("workflow", [["Trực tiếp", "Trực tiếp"], ["2 giai đoạn theo lô: V1 toàn bộ -> render -> V2", "2 giai đoạn theo lô · V1 → Render → V2"]]))}
        ${label("Thời lượng video (phút)", input("video_minutes", "60", "number", "min=0.1 step=0.1 data-hc-estimate"))}
      </div>
      <article class="hc-help"><strong>Chọn đường dẫn thế nào?</strong><p>Trình duyệt không được phép tiết lộ đường dẫn đầy đủ của folder. Hãy sao chép đường dẫn từ File Explorer và dán vào đây; bridge cục bộ sẽ kiểm tra thật bằng PRECHECK.</p></article>
    </section>`;
  }

  function timelineSection() {
    return `<section data-hc-section="timeline" hidden>
      <header><small>02 · TIMELINE</small><h3>Khung hình và thời lượng</h3></header>
      <div class="hc-grid hc-grid--4">
        ${label("Rộng", input("width", "1920", "number", "min=16"))}${label("Cao", input("height", "1080", "number", "min=16"))}
        ${label("FPS", input("fps", "24", "number", "min=1 step=0.001"))}${label("Ảnh tĩnh (giây)", input("still_seconds", "5", "number", "min=.1 step=.1"))}
        ${label("Clip V1 (phút)", input("stage1_clip_minutes", "1", "number", "min=.1 step=.1"))}
        ${label("Scaling", select("scaling", [["Fill (đầy khung)", "Fill · đầy khung"], ["Fit (vừa khung)", "Fit · vừa khung"], ["Stretch", "Stretch"]]))}
        ${label("Zoom", input("zoom", "1", "number", "min=.1 max=100 step=.01"))}
        ${label("Motion", select("motion", [["Không", "Không"], ["Zoom in", "Zoom in"], ["Zoom out", "Zoom out"], ["Pan left", "Pan trái"], ["Pan right", "Pan phải"]]))}
      </div>
      <div class="hc-grid hc-grid--2 hc-advanced">
        ${label("Template timeline", input("template_timeline_name", "Tên timeline mẫu"))}
        ${label("Placeholder track", input("template_track_index", "1", "number", "min=1 max=32"))}
        ${label("Template mode", select("template_mode", [["Replace V1 placeholders", "Replace V1 placeholders"], ["Append after template", "Append after template"]]))}
        ${check("use_template_timeline", "Dùng template timeline")}
      </div>
      <div class="hc-check-grid">${check("loop_audio", "Loop audio khi workflow cho phép")}${check("shuffle_audio", "Trộn playlist riêng từng video")}${check("music_driven_duration", "Thời lượng theo playlist nhạc")}${check("cleanup_temp_timelines", "Xóa timeline tạm do phiên này tạo")}</div>
    </section>`;
  }

  function effectsSection() {
    return `<section data-hc-section="effects" hidden>
      <header><small>03 · MOTION & EFFECTS</small><h3>Overlay và chim/bướm alpha</h3><p>Khi có wildlife alpha, tool tự thay thế overlay thường để tránh render trùng lớp.</p></header>
      <div class="hc-grid hc-grid--2">
        ${label("File/thư mục overlay", input("overlay_file", "D:\\Effects"))}${label("Blend mode", select("overlay_blend", [["Screen", "Screen"], ["Add", "Add"], ["Normal", "Normal"], ["Overlay", "Overlay"]]))}
        ${label("Opacity overlay (%)", input("overlay_opacity", "90", "number", "min=0 max=100 step=.1"))}${label("Tốc độ overlay (%)", input("overlay_speed_percent", "100", "number", "min=10 max=400 step=1"))}
        ${label("Nguồn chim/bướm alpha", input("wildlife_source", "D:\\Wildlife_Alpha"))}${label("Kích thước mặc định (%)", input("wildlife_default_scale_percent", "60", "number", "min=1 max=400"))}
        ${label("Tâm X (%)", input("wildlife_default_x_percent", "50", "number", "min=0 max=100 step=.1"))}${label("Tâm Y (%)", input("wildlife_default_y_percent", "50", "number", "min=0 max=100 step=.1"))}
        ${label("Tốc độ wildlife (%)", input("wildlife_speed_percent", "100", "number", "min=10 max=400"))}${label("Opacity wildlife (%)", input("wildlife_opacity", "100", "number", "min=0 max=100"))}
        ${label("Xoay (độ)", input("wildlife_rotation_degrees", "0", "number", "min=-360 max=360 step=.1"))}${label("Seed trộn nhạc", input("shuffle_seed", "130803", "number"))}
      </div>
      <div class="hc-check-grid">${check("random_overlay", "Chọn overlay ngẫu nhiên ổn định")}${check("random_wildlife", "Chọn wildlife ngẫu nhiên ổn định")}${check("wildlife_flip_horizontal", "Lật wildlife ngang")}</div>
      ${label("Vị trí wildlife riêng từng ảnh · JSON", `<textarea name="wildlife_positions" rows="7" spellcheck="false" placeholder='{"cover_001.png":{"x_percent":50,"y_percent":35,"scale_percent":60}}'></textarea>`)}
    </section>`;
  }

  function gradeSection() {
    return `<section data-hc-section="grade" hidden>
      <header><small>04 · COLOR / FUSION / AUDIO</small><h3>Hoàn thiện hình và âm thanh</h3></header>
      <div class="hc-grid hc-grid--2">
        ${label("Chế độ color grade", select("color_grade_mode", [["Mặc định (không chỉnh màu)", "Mặc định · không chỉnh"], ["RapidGrade DRX", "RapidGrade · DRX"], ["Giữ grade template", "Giữ grade template"]]))}
        ${label("Preset DRX", input("drx_file", "D:\\Presets\\grade.drx"))}
        ${label("Fusion .comp", input("fusion_comp_file", "D:\\Presets\\effect.comp"))}
        ${label("Music tối thiểu (phút)", input("music_minimum_minutes", "60", "number", "min=60 step=1"))}
        ${label("Pitch audio (semitone)", input("audio_pitch_semitones", "0", "number", "min=-24 max=24 step=.1"))}
        ${label("Tần số tham chiếu (Hz)", input("audio_reference_frequency_hz", "0", "number", "min=0 max=2000 step=.1"))}
      </div>
      <article class="hc-help"><strong>RapidGrade an toàn</strong><p>DRX được áp bằng Resolve Scripting API; PRECHECK sẽ chặn nếu file không tồn tại hoặc project không tương thích.</p></article>
    </section>`;
  }

  function renderSection() {
    return `<section data-hc-section="render" hidden>
      <header><small>05 · DELIVER & QUEUE</small><h3>Codec, bitrate và hành động</h3></header>
      <div class="hc-grid hc-grid--4">
        ${label("Format", select("render_format", [["mp4", "MP4"], ["mov", "MOV"], ["mxf", "MXF"]]))}
        ${label("Codec", select("render_codec", [["H264", "H.264"], ["H265", "H.265"], ["ProRes", "ProRes"], ["DNxHR", "DNxHR"]]))}
        ${label("Bitrate (Kb/s)", input("bitrate_kbps", "10000", "number", "min=100"))}
        ${label("Render preset", input("render_preset", "Tên preset Resolve"))}
      </div>
      <div class="hc-check-grid">${check("replace_existing", "Cho phép thay output cũ")}${check("deep_verify", "Hậu kiểm sâu bằng FFprobe")}${check("resume_enabled", "Checkpoint và Resume")}${check("prevent_sleep", "Giữ Windows không ngủ")}</div>
      <div class="hc-run-deck">
        <button type="button" data-hc-run="preflight">1. PRECHECK</button>
        <button type="button" data-hc-run="build">2. Chỉ tạo timeline</button>
        <button type="button" data-hc-run="queue">3. Tạo + đưa vào Queue</button>
        <button class="is-primary" type="button" data-hc-run="render">4. Làm toàn bộ + render</button>
        <button class="is-danger" type="button" data-hc-run="cancel">Hủy an toàn</button>
      </div>
      <p class="hc-safety">PRECHECK không sửa Media Pool hoặc timeline. Build không render. Queue không tự bấm Start Render. Chỉ nút Làm toàn bộ + render mới bắt đầu kết xuất.</p>
    </section>`;
  }

  function enterpriseSection() {
    return `<section data-hc-section="enterprise" hidden>
      <header><small>06 · ENTERPRISE RUNTIME</small><h3>Phiên dài, retry và thông báo</h3></header>
      <div class="hc-grid hc-grid--3">
        ${label("Số job mỗi lô", input("batch_size", "25", "number", "min=1 max=500"))}${label("Nghỉ giữa lô (giây)", input("pause_between_batches_seconds", "0", "number", "min=0"))}
        ${label("Stall timeout (phút)", input("stall_timeout_minutes", "30", "number", "min=1"))}${label("Retry tối đa", input("max_retries", "2", "number", "min=0 max=20"))}
        ${label("Retry backoff (giây)", input("retry_backoff_seconds", "2", "number", "min=0 step=.1"))}${label("Dung lượng trống tối thiểu (GB)", input("minimum_free_disk_gb", "5", "number", "min=0 step=.1"))}
        ${label("Giới hạn GPU (°C)", input("gpu_temperature_limit_c", "88", "number", "min=40 max=110"))}${label("Delay từng action (ms)", input("action_delay_ms", "0", "number", "min=0 max=60000"))}
        ${label("Tolerance duration (giây)", input("duration_tolerance_seconds", "1", "number", "min=0 step=.1"))}${label("Thông báo", select("notification_channel", [["none", "Không"], ["telegram", "Telegram"], ["slack", "Slack"], ["email", "Email"]]))}
        ${label("Chính sách file trung gian", select("intermediate_policy", [["keep", "Giữ nguyên"], ["delete_verified", "Xóa sau khi verified"], ["zip_then_delete", "ZIP rồi xóa"]]))}
        ${label("File multi-profile", input("profiles_file", "D:\\Profiles\\production_profiles.json"))}
        ${label("Bắt đầu theo lịch", input("schedule_start", "2026-08-03T23:00", "datetime-local"))}
      </div>
      <div class="hc-check-grid">${check("use_profiles", "Dùng nhiều profile")}${check("schedule_enabled", "Bật lịch bắt đầu")}${check("detailed_actions", "Ghi chi tiết từng action")}${check("move_verified_outputs", "Chuyển output đã verified")}${check("notify_success", "Báo khi thành công")}${check("notify_failure", "Báo khi lỗi")}</div>
    </section>`;
  }

  function blueprintSection() {
    return `<section data-hc-section="blueprint" hidden>
      <header><small>07 · HUMAN ACTION BLUEPRINT</small><h3>Action graph và nhật ký thật</h3><p>Mỗi bước hiển thị API Resolve tương ứng; trạng thái cập nhật từ bridge, không tạo tiến trình giả.</p></header>
      <div class="hc-blueprint">${BLUEPRINT.map(([code, page, action], index) => `<article data-hc-blueprint-step="${code}"><i>${String(index + 1).padStart(2, "0")}</i><div><small>${code} · ${page}</small><strong>${action}</strong></div><span>Chờ</span></article>`).join("")}</div>
      <div class="hc-log-head"><strong>Event log</strong><button type="button" data-hc-clear-log>Xóa log hiển thị</button></div>
      <pre class="hc-log" data-hc-log>Chưa có sự kiện. Kết nối bridge để nhận log từ Resolve.</pre>
    </section>`;
  }

  function markup() {
    return `<section class="hc-studio" data-hc-studio>
      <header class="hc-command">
        <div class="hc-brand"><span>H</span><div><small>H COSMIC STUDIO · 2026.08.03-r26</small><h2>DaVinci Batch Production</h2><p>Mission Control trên web cho batch ảnh → video, timeline, effects, RapidGrade, queue, resume và FFprobe.</p></div></div>
        <div class="hc-top-actions"><div class="hc-mode-switch"><button type="button" data-hc-mode="web" class="is-active">Chạy thật trên Web</button><button type="button" data-hc-mode="resolve">DaVinci Bridge</button></div><button type="button" data-hc-connect>Kết nối Resolve</button><a class="hc-download" href="${ZIP_URL}" download>Tải Portable ZIP · 70.6 MB</a></div>
      </header>
      <section class="hc-web-runtime" data-hc-web-only><div><i></i><span>WEB ENGINE</span><strong>Canvas + MediaRecorder + Web Audio</strong></div><div><span>NGUỒN</span><strong>Ảnh · nhạc · overlay thật</strong></div><div><span>ĐẦU RA</span><strong>MP4 nếu trình duyệt hỗ trợ · WebM tương thích</strong></div><div><span>DỮ LIỆU</span><strong>Local-first · IndexedDB</strong></div></section>
      <section class="hc-bridge" data-hc-bridge data-hc-resolve-only data-state="offline" hidden>
        <div><i></i><span>WEBSITE BRIDGE</span><strong data-hc-bridge-label>Đang tìm bridge trên máy…</strong></div>
        <div><span>RESOLVE</span><strong data-hc-resolve>Chưa kết nối</strong></div>
        <div><span>TÁC VỤ</span><strong data-hc-task>Sẵn sàng</strong></div>
        <div><span>TIẾN TRÌNH</span><strong data-hc-progress-text>0%</strong></div>
        <progress data-hc-progress max="100" value="0"></progress>
      </section>
      <section class="hc-browser-workspace" data-hc-web-engine><header><div><small>H COSMIC WEB ENGINE</small><h3>Sản xuất batch trực tiếp trong trình duyệt</h3><p>Chọn folder ảnh, nhạc và hiệu ứng; tạo hàng đợi rồi render từng video thật. Không cần Python, Resolve hoặc bridge.</p></div><span>Giữ tab hoạt động trong lúc render</span></header><div data-hc-browser-engine></div></section>
      <div class="hc-workspace" data-hc-resolve-only hidden>
        <nav class="hc-nav">${[
          ["source", "01", "Nguồn"], ["timeline", "02", "Timeline"], ["effects", "03", "Hiệu ứng"],
          ["grade", "04", "Color & Audio"], ["render", "05", "Render"], ["enterprise", "06", "Enterprise"], ["blueprint", "07", "Blueprint"]
        ].map(([id, number, text]) => `<button type="button" data-hc-nav="${id}" class="${id === activeSection ? "is-active" : ""}"><b>${number}</b><span>${text}</span></button>`).join("")}
          <div class="hc-nav-foot"><button type="button" data-hc-save>Lưu cấu hình</button><button type="button" data-hc-export>Xuất JSON</button><label>Nhập JSON<input type="file" accept="application/json,.json" data-hc-import></label></div>
        </nav>
        <form class="hc-form" data-hc-form>${sourceSection()}${timelineSection()}${effectsSection()}${gradeSection()}${renderSection()}${enterpriseSection()}${blueprintSection()}</form>
        <aside class="hc-monitor">
          <header><small>MISSION CONTROL</small><h3>Phiên sản xuất</h3></header>
          <div class="hc-orbit"><span data-hc-orbit>H</span><i></i></div>
          <dl><div><dt>Video dự kiến</dt><dd data-hc-estimate-jobs>267</dd></div><div><dt>Thời lượng output</dt><dd data-hc-estimate-hours>267 giờ</dd></div><div><dt>Dung lượng ước tính</dt><dd data-hc-estimate-size>1.20 TB</dd></div><div><dt>Bridge</dt><dd data-hc-monitor-bridge>Offline</dd></div></dl>
          <section class="hc-current"><small>TRẠNG THÁI</small><strong data-hc-current>Sẵn sàng cấu hình</strong><p data-hc-current-detail>PRECHECK trước khi sửa project.</p></section>
          <section class="hc-result" data-hc-result hidden></section>
          <a class="hc-download hc-download--wide" href="${ZIP_URL}" download>Tải trọn bộ H Cosmic Studio r26</a>
          <small class="hc-checksum">SHA-256 · 9C8BE004…DDA11F3</small>
        </aside>
      </div>
    </section>`;
  }

  function setSection(id) {
    activeSection = SECTION_IDS.includes(id) ? id : "source";
    root?.querySelectorAll("[data-hc-nav]").forEach((node) => node.classList.toggle("is-active", node.dataset.hcNav === activeSection));
    root?.querySelectorAll("[data-hc-section]").forEach((node) => { node.hidden = node.dataset.hcSection !== activeSection; });
  }
  async function setMode(mode) {
    activeMode = mode === "resolve" ? "resolve" : "web";
    if (!root) return;
    root.querySelectorAll("[data-hc-mode]").forEach((button) => button.classList.toggle("is-active", button.dataset.hcMode === activeMode));
    root.querySelectorAll("[data-hc-resolve-only]").forEach((node) => { node.hidden = activeMode !== "resolve"; });
    root.querySelectorAll("[data-hc-web-only], [data-hc-web-engine]").forEach((node) => { node.hidden = activeMode !== "web"; });
    const browserHost = root.querySelector("[data-hc-browser-engine]");
    if (activeMode === "web") {
      stopPolling();
      accessKey = "";
      if (browserHost && window.HHVideoBatchFactory?.mount) {
        await window.HHVideoBatchFactory.mount(browserHost);
      } else if (browserHost) {
        browserHost.innerHTML = '<div class="hc-engine-error"><strong>Web Engine chưa tải được.</strong><p>Hãy làm mới trang và thử lại.</p></div>';
      }
      return;
    }
    window.HHVideoBatchFactory?.unmount?.();
    if (browserHost) browserHost.innerHTML = "";
    await claimBridge(false);
  }
  function updateEstimate() {
    if (!root) return;
    const form = root.querySelector("[data-hc-form]");
    const jobs = Math.max(1, Math.round(Number(form?.elements.namedItem("ui_job_count")?.value) || 1));
    const minutes = Math.max(.1, Number(form?.elements.namedItem("video_minutes")?.value) || 60);
    const bitrate = Math.max(100, Number(form?.elements.namedItem("bitrate_kbps")?.value) || 10000);
    const hours = jobs * minutes / 60;
    const bytes = jobs * minutes * 60 * bitrate * 1000 / 8;
    const size = bytes >= 1099511627776 ? `${(bytes / 1099511627776).toFixed(2)} TB` : `${(bytes / 1073741824).toFixed(1)} GB`;
    const set = (selector, text) => { const node = root.querySelector(selector); if (node) node.textContent = text; };
    set("[data-hc-estimate-jobs]", jobs.toLocaleString("vi-VN"));
    set("[data-hc-estimate-hours]", `${hours.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} giờ`);
    set("[data-hc-estimate-size]", size);
  }
  function setBridgeState(state, label, resolveConnected = false) {
    bridgeState = state;
    const panel = root?.querySelector("[data-hc-bridge]");
    if (panel) panel.dataset.state = state;
    const bridgeLabel = root?.querySelector("[data-hc-bridge-label]"); if (bridgeLabel) bridgeLabel.textContent = label;
    const resolveLabel = root?.querySelector("[data-hc-resolve]"); if (resolveLabel) resolveLabel.textContent = resolveConnected ? "Đã kết nối" : "Đang chờ Resolve";
    const monitor = root?.querySelector("[data-hc-monitor-bridge]"); if (monitor) monitor.textContent = state === "online" ? (resolveConnected ? "Online · Resolve sẵn sàng" : "Online · chờ Resolve") : "Offline";
    root?.querySelector("[data-hc-orbit]")?.classList.toggle("is-online", state === "online");
  }
  function currentStatus(title, detail = "", kind = "info") {
    const node = root?.querySelector("[data-hc-current]"); if (node) { node.textContent = title; node.dataset.state = kind; }
    const info = root?.querySelector("[data-hc-current-detail]"); if (info) info.textContent = detail;
  }
  function appendLog(message, kind = "log") {
    const log = root?.querySelector("[data-hc-log]");
    if (!log) return;
    const stamp = new Date().toLocaleTimeString("vi-VN");
    const previous = log.textContent.startsWith("Chưa có sự kiện") ? "" : log.textContent;
    log.textContent = `${previous}${previous ? "\n" : ""}[${stamp}] ${kind.toUpperCase()} · ${message}`.split("\n").slice(-300).join("\n");
    log.scrollTop = log.scrollHeight;
  }

  async function bridgeRequest(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (accessKey) headers["X-H-Cosmic-Key"] = accessKey;
    const response = await fetch(`${BRIDGE}${path}`, { cache: "no-store", ...options, headers, signal: controller?.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Bridge HTTP ${response.status}`);
    return data;
  }
  async function claimBridge(announce = false) {
    try {
      const ping = await bridgeRequest("/api/ping", { method: "GET" });
      if (!ping?.auto_connect) throw new Error("Bridge không hỗ trợ tự kết nối.");
      const claim = await bridgeRequest("/api/claim", { method: "POST", headers: { "X-H-Cosmic-Auto-Connect": AUTO_CONNECT }, body: "{}" });
      accessKey = String(claim.access_key || "");
      if (!accessKey) throw new Error("Bridge không trả mã phiên.");
      const health = await bridgeRequest("/api/health", { method: "GET" });
      setBridgeState("online", "Bridge r26 đã ghép nối tự động", Boolean(health.resolve_connected));
      if (announce) currentStatus("Đã kết nối bridge", health.resolve_connected ? "DaVinci Resolve đã sẵn sàng." : "Hãy mở Resolve và project cần sản xuất.", health.resolve_connected ? "success" : "warning");
      startPolling();
      return true;
    } catch (error) {
      accessKey = "";
      setBridgeState("offline", "Chưa tìm thấy bridge trên máy", false);
      if (announce) currentStatus("Chưa có Website Bridge", "Tải ZIP, chạy INSTALL_H_COSMIC_STUDIO rồi INSTALL_WEBSITE_BRIDGE một lần.", "warning");
      return false;
    }
  }
  async function pollStatus() {
    if (!accessKey || !root?.isConnected) return;
    try {
      const data = await bridgeRequest(`/api/status?after=${lastEventId}`, { method: "GET" });
      lastEventId = Number(data.last_event_id) || lastEventId;
      setBridgeState("online", "Bridge r26 đang hoạt động", Boolean(data.resolve_connected));
      const progress = Math.max(0, Math.min(100, Math.round((Number(data.progress) || 0) * 100)));
      const bar = root.querySelector("[data-hc-progress]"); if (bar) bar.value = progress;
      const progressText = root.querySelector("[data-hc-progress-text]"); if (progressText) progressText.textContent = `${progress}%`;
      const task = root.querySelector("[data-hc-task]"); if (task) task.textContent = data.busy ? (data.task || "Đang chạy") : "Sẵn sàng";
      if (data.progress_text) currentStatus(data.progress_text, data.error || (data.resolve_connected ? "Resolve đang phản hồi bình thường." : "Bridge đang chờ Resolve."), data.error ? "error" : data.busy ? "running" : "success");
      for (const event of data.events || []) consumeEvent(event);
      if (data.result && Object.keys(data.result).length) showResult(data.result);
    } catch (error) {
      accessKey = "";
      setBridgeState("offline", "Bridge đã ngắt kết nối", false);
      stopPolling();
    }
  }
  function startPolling() {
    stopPolling();
    pollStatus();
    pollTimer = window.setInterval(pollStatus, 1800);
  }
  function stopPolling() { window.clearInterval(pollTimer); pollTimer = 0; }
  function consumeEvent(event) {
    const payload = event?.payload;
    if (event.kind === "log") appendLog(String(payload || ""), "log");
    else if (event.kind === "action") {
      const code = String(payload?.code || "ACTION");
      appendLog(`${code} · ${payload?.detail || payload?.action || ""}`, payload?.status || "action");
      const rawPrefix = code.split(".")[0];
      const prefix = ({ PRECHECK: "PREFLIGHT", PLAN: "PREFLIGHT", PROFILE: "PREFLIGHT", TEMPLATE: "EDIT", BATCH: "EDIT", STAGE1: "QUEUE", STAGE2: "EDIT", FUSION: "COLOR", GRAPH: "QUEUE", RETRY: "QUEUE", POST: "VERIFY", HEALTH: "VERIFY", INTERMEDIATE: "VERIFY", CHECKPOINT: "REPORT", NOTIFY: "REPORT" })[rawPrefix] || rawPrefix;
      const step = root?.querySelector(`[data-hc-blueprint-step="${CSS.escape(prefix)}"]`);
      if (step) { const badge = step.querySelector("span"); if (badge) badge.textContent = payload?.status === "done" ? "Xong" : payload?.status === "error" ? "Lỗi" : "Đang chạy"; step.dataset.state = payload?.status || "running"; }
    } else if (event.kind === "error") appendLog(payload?.message || "Tác vụ lỗi", "error");
    else if (event.kind === "done") appendLog("Tác vụ hoàn tất.", "done");
  }
  function showResult(result) {
    const node = root?.querySelector("[data-hc-result]");
    if (!node) return;
    node.hidden = false;
    const status = result.status || (result.failures?.length ? "CÓ LỖI" : "HOÀN TẤT");
    node.innerHTML = `<small>KẾT QUẢ THẬT</small><strong>${esc(status)}</strong><p>${esc(result.report_path || result.reportPath || `${result.videos_completed ?? result.results?.length ?? 0} video hoàn tất`)}</p>`;
  }
  async function ensureBridge() {
    if (accessKey) return true;
    return claimBridge(true);
  }
  async function saveRemoteConfig() {
    const config = formConfig();
    writeStoredConfig(config);
    if (!await ensureBridge()) throw new Error("Website Bridge chưa hoạt động.");
    await bridgeRequest("/api/config", { method: "POST", body: JSON.stringify({ config }) });
    appendLog("Đã lưu cấu hình r26 vào bridge.", "config");
    return config;
  }
  async function runAction(action) {
    if (action === "cancel") {
      if (!await ensureBridge()) return;
      await bridgeRequest("/api/cancel", { method: "POST", body: "{}" });
      currentStatus("Đã yêu cầu dừng an toàn", "Manifest và checkpoint được giữ để Resume.", "warning");
      return;
    }
    try {
      const config = await saveRemoteConfig();
      const endpoint = action === "preflight" ? "/api/preflight" : "/api/run";
      const payload = action === "preflight" ? { config } : { action, config };
      await bridgeRequest(endpoint, { method: "POST", body: JSON.stringify(payload) });
      currentStatus(action === "preflight" ? "Đang PRECHECK" : `Đang chạy ${action.toUpperCase()}`, "Theo dõi chi tiết trong Blueprint và Event log.", "running");
      setSection("blueprint");
      startPolling();
    } catch (error) {
      currentStatus("Không thể bắt đầu tác vụ", error?.message || String(error), "error");
      appendLog(error?.message || String(error), "error");
    }
  }
  function exportConfig() {
    const config = formConfig();
    writeStoredConfig(config);
    const blob = new Blob([JSON.stringify({ schema: "h-cosmic-studio-r26", exportedAt: new Date().toISOString(), config }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "h-cosmic-studio-r26-config.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importConfig(file) {
    const payload = JSON.parse(await file.text());
    const config = payload?.config && typeof payload.config === "object" ? payload.config : payload;
    applyConfig(config); writeStoredConfig(formConfig()); currentStatus("Đã nhập cấu hình", file.name, "success");
  }

  function bind() {
    controller = new AbortController();
    const options = { signal: controller.signal };
    root.addEventListener("click", (event) => {
      const nav = event.target.closest("[data-hc-nav]"); if (nav) return setSection(nav.dataset.hcNav);
      const mode = event.target.closest("[data-hc-mode]"); if (mode) return setMode(mode.dataset.hcMode);
      if (event.target.closest("[data-hc-connect]")) return claimBridge(true);
      const run = event.target.closest("[data-hc-run]"); if (run) return runAction(run.dataset.hcRun);
      if (event.target.closest("[data-hc-save]")) { writeStoredConfig(formConfig()); currentStatus("Đã lưu cấu hình trên trình duyệt", "Dữ liệu được tách riêng theo tài khoản đăng nhập.", "success"); return; }
      if (event.target.closest("[data-hc-export]")) return exportConfig();
      if (event.target.closest("[data-hc-clear-log]")) { const log = root.querySelector("[data-hc-log]"); if (log) log.textContent = "Chưa có sự kiện."; }
    }, options);
    root.addEventListener("input", (event) => { if (event.target.matches("[data-hc-estimate], [name=bitrate_kbps]")) updateEstimate(); }, options);
    root.addEventListener("change", (event) => {
      if (event.target.matches("[data-hc-import]") && event.target.files?.[0]) importConfig(event.target.files[0]).catch((error) => currentStatus("File cấu hình không hợp lệ", error.message, "error"));
      else { writeStoredConfig(formConfig()); updateEstimate(); }
    }, options);
    window.addEventListener("keydown", (event) => { if (event.altKey && /^[1-7]$/.test(event.key)) { event.preventDefault(); setSection(SECTION_IDS[Number(event.key) - 1]); } }, options);
  }

  async function mount(host) {
    unmount();
    if (!host) return;
    root = host;
    root.innerHTML = markup();
    bind();
    applyConfig(readStoredConfig());
    setSection(activeSection);
    await setMode("web");
  }
  function unmount() {
    stopPolling();
    window.HHVideoBatchFactory?.unmount?.();
    controller?.abort(); controller = null;
    if (root) root.innerHTML = "";
    root = null; accessKey = ""; lastEventId = 0; bridgeState = "offline";
  }

  window.HHCosmicWebStudio = Object.freeze({ mount, unmount, formConfig, defaults: DEFAULT_CONFIG, zipUrl: ZIP_URL });
  window.dispatchEvent(new CustomEvent("hh:h-cosmic-web-ready"));
})();
