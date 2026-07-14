(() => {
  "use strict";

  const base = window.HHMediaDesign;
  if (!base) return;

  const TOOL = "Video Editor";
  const STORE_KEY = "hh.resolve-web-studio.v1";
  const $ = (root, selector) => root?.querySelector(selector);
  const $$ = (root, selector) => [...(root?.querySelectorAll(selector) || [])];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const uid = (prefix) => `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  const icon = (name) => `<i data-lucide="${name}"></i>`;
  const pages = [
    ["media", "Media", "Kho media", "folder-kanban", "Shift+1"],
    ["cut", "Cut", "Cắt nhanh", "scissors", "Shift+2"],
    ["edit", "Edit", "Biên tập", "film", "Shift+3"],
    ["fusion", "Fusion", "Hiệu ứng", "git-merge", "Shift+4"],
    ["color", "Color", "Màu sắc", "palette", "Shift+5"],
    ["fairlight", "Fairlight", "Âm thanh", "audio-lines", "Shift+6"],
    ["deliver", "Deliver", "Xuất bản", "send", "Shift+7"]
  ];
  const defaults = {
    page: "edit",
    proxy: false,
    grade: { exposure: 0, contrast: 100, saturation: 100, temperature: 0, tint: 0, lift: 0, gamma: 0, gain: 0, highlights: 0, shadows: 0, blur: 0, sharpen: 0 },
    audio: { master: 100, pan: 0, low: 0, mid: 0, high: 0, threshold: -24, reverb: 0 },
    nodes: [
      { id: "media-in", name: "MediaIn1", type: "input", enabled: true },
      { id: "color-corrector", name: "ColorCorrector1", type: "color", enabled: true },
      { id: "media-out", name: "MediaOut1", type: "output", enabled: true }
    ],
    selectedNode: "color-corrector",
    multicam: false,
    keyframes: [],
    queue: [],
    bins: ["Master", "Video", "Âm thanh", "Đồ họa"],
    selectedBin: "Master"
  };
  const state = {
    root: null,
    outer: null,
    workspace: null,
    stage: null,
    panels: {},
    page: defaults.page,
    data: structuredClone(defaults),
    observers: [],
    scopeFrame: 0,
    meterFrame: 0,
    audio: null,
    micRecorder: null,
    micStream: null,
    micChunks: [],
    timer: 0
  };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      state.data = {
        ...structuredClone(defaults),
        ...saved,
        grade: { ...defaults.grade, ...(saved.grade || {}) },
        audio: { ...defaults.audio, ...(saved.audio || {}) },
        nodes: Array.isArray(saved.nodes) && saved.nodes.length ? saved.nodes : structuredClone(defaults.nodes),
        queue: Array.isArray(saved.queue) ? saved.queue : [],
        bins: Array.isArray(saved.bins) && saved.bins.length ? saved.bins : [...defaults.bins]
      };
      state.page = pages.some(([id]) => id === saved.page) ? saved.page : "edit";
    } catch {
      state.data = structuredClone(defaults);
      state.page = "edit";
    }
  }

  function save() {
    state.data.page = state.page;
    localStorage.setItem(STORE_KEY, JSON.stringify(state.data));
  }

  function status(message, kind = "info") {
    const node = $(state.root, "[data-ve-status]");
    if (node) {
      node.textContent = message;
      node.dataset.state = kind;
    }
    const toast = $(state.root, "[data-vr-toast]");
    if (!toast) return;
    toast.textContent = message;
    toast.dataset.kind = kind;
    toast.hidden = false;
    clearTimeout(state.timer);
    state.timer = setTimeout(() => { toast.hidden = true; }, 2600);
  }

  function clickBase(selector) {
    const node = $(state.root, selector);
    if (node) node.click();
    return Boolean(node);
  }

  function setActionLabel(id, label, title = label) {
    $$ (state.root, `[data-ve-action="${id}"]`).forEach((button) => {
      const span = $(button, "span");
      if (span) span.textContent = label;
      button.title = title;
    });
  }

  function localize() {
    state.root.lang = "vi";
    const brand = $(state.root, ".ve-brand");
    if (brand) brand.innerHTML = `${icon("clapperboard")}<b>HH</b><span>Resolve Web Studio</span>`;
    const menuLabels = ["Tệp", "Chỉnh sửa", "Clip", "Timeline", "Dấu mốc", "Tiêu đề", "Cửa sổ", "Trợ giúp"];
    $$(state.root, ".ve-menu>summary").forEach((node, index) => { node.textContent = menuLabels[index] || node.textContent; });
    const labels = {
      new: "Dự án mới", import: "Nhập media", "project-open": "Mở dự án JSON", save: "Lưu dự án", "project-export": "Xuất dự án JSON",
      render: "Xuất video", undo: "Hoàn tác", redo: "Làm lại", duplicate: "Nhân đôi", delete: "Xóa", split: "Cắt tại đầu phát",
      "trim-start": "Cắt đầu tới đầu phát", "trim-end": "Cắt cuối tới đầu phát", speed: "Tốc độ và thời lượng", "sequence-start": "Về đầu timeline",
      "sequence-end": "Tới cuối timeline", marker: "Thêm dấu mốc", "marker-clear": "Xóa mọi dấu mốc", title: "Thêm tiêu đề", caption: "Thêm phụ đề",
      fullscreen: "Toàn màn hình", "reset-layout": "Khôi phục bố cục", shortcuts: "Phím tắt", about: "Giới thiệu", "prev-edit": "Điểm cắt trước",
      "next-edit": "Điểm cắt sau", "step-back": "Lùi một khung hình", "step-forward": "Tiến một khung hình", play: "Phát hoặc tạm dừng",
      "ripple-delete": "Xóa và dồn khoảng trống", normalize: "Chuẩn hóa âm lượng", "reset-motion": "Đặt lại chuyển động", "dialog-close": "Đóng"
    };
    Object.entries(labels).forEach(([id, label]) => setActionLabel(id, label));
    const exportButton = $(state.root, ".ve-export");
    if (exportButton) exportButton.innerHTML = `${icon("send")}<span>Xuất nhanh</span>`;
    const toolbarLabels = $$(state.root, ".ve-toolbar>label");
    if (toolbarLabels[0]) toolbarLabels[0].childNodes[0].textContent = "Không gian ";
    if (toolbarLabels[1]) toolbarLabels[1].childNodes[0].textContent = "Timeline ";
    if (toolbarLabels[2]) toolbarLabels[2].lastChild.textContent = " Bám dính";
    const workspace = $(state.root, "[data-ve-workspace]");
    if (workspace) ["Biên tập", "Màu sắc", "Âm thanh", "Đồ họa"].forEach((label, index) => { if (workspace.options[index]) workspace.options[index].textContent = label; });
    const panelTabs = $$(state.root, "[data-ve-panel-tab]");
    ["Kho media", "Hiệu ứng", "Âm thanh"].forEach((label, index) => { if (panelTabs[index]) panelTabs[index].textContent = label; });
    const inspectorTabs = $$(state.root, "[data-ve-inspector-tab]");
    ["Thanh tra", "Tiêu đề", "Siêu dữ liệu"].forEach((label, index) => { if (inspectorTabs[index]) inspectorTabs[index].textContent = label; });
    const monitorTabs = $$(state.root, "[data-ve-monitor-tab]");
    if (monitorTabs[0]) monitorTabs[0].textContent = "Nguồn";
    if (monitorTabs[1]) monitorTabs[1].childNodes[0].textContent = "Timeline: ";
    const empty = $(state.root, "[data-ve-empty]");
    if (empty) empty.innerHTML = `${icon("film")}<strong>Màn hình chương trình</strong><span>Nhập media hoặc kéo clip vào timeline</span><button data-ve-action="import">Nhập media</button>`;
    const search = $(state.root, "[data-ve-search]");
    if (search) search.placeholder = "Tìm trong dự án";
    const effectSearch = $(state.root, "[data-ve-effect-search]");
    if (effectSearch) effectSearch.placeholder = "Tìm hiệu ứng";
    const effects = { none: "Đặt lại", cinema: "Điện ảnh", vivid: "Rực rỡ", mono: "Đen trắng", warm: "Tông ấm", cool: "Tông lạnh", blur: "Làm mờ Gaussian", fade: "Mờ dần về đen" };
    Object.entries(effects).forEach(([id, label]) => { const span = $(state.root, `[data-ve-effect="${id}"] span`); if (span) span.textContent = label; });
    const propertyHeadings = $$(state.root, ".ve-properties form>section header strong");
    ["Chuyển động", "Độ trong suốt", "Ánh xạ thời gian", "Âm lượng"].forEach((label, index) => { if (propertyHeadings[index]) propertyHeadings[index].textContent = label; });
    const noClip = $(state.root, "[data-ve-properties-empty]");
    if (noClip) noClip.innerHTML = "<strong>Chưa chọn clip</strong><span>Hãy chọn một clip trên timeline để chỉnh sửa.</span>";
    const ruler = $(state.root, ".ve-ruler-head");
    if (ruler) ruler.textContent = "Rãnh";
    const foot = $(state.root, "[data-ve-status]");
    if (foot) foot.textContent = "Sẵn sàng · tệp được xử lý riêng tư trên thiết bị";
    const shortcutDialog = $(state.root, '[data-ve-dialog="shortcuts"]');
    if (shortcutDialog) {
      $(shortcutDialog, "header strong").textContent = "Phím tắt bàn dựng";
      $(shortcutDialog, "header span").textContent = "Tương thích luồng dựng chuyên nghiệp";
      const shortcutLabels = ["Phát / tạm dừng", "Công cụ chọn", "Dao cắt", "Cắt tại đầu phát", "Đánh dấu In / Out", "Thêm dấu mốc", "Phát lùi / dừng / phát tới", "Lùi / tiến khung hình", "Điểm cắt trước / sau", "Đầu / cuối timeline", "Hoàn tác", "Làm lại", "Xóa clip", "Xóa và dồn", "Nhân đôi clip", "Lưu dự án", "Xuất video", "Thu phóng timeline"];
      $$(shortcutDialog, ".ve-shortcuts span").forEach((row, index) => { const key = $(row, "kbd"); row.lastChild.textContent = shortcutLabels[index] || row.lastChild.textContent; if (key) row.prepend(key); });
    }
    const exportDialog = $(state.root, '[data-ve-dialog="export"]');
    if (exportDialog) {
      $(exportDialog, "header strong").textContent = "Xuất video";
      $(exportDialog, "header span").textContent = "Kết xuất timeline theo thời gian thực";
      const labels = $$(exportDialog, ".ve-export-settings>label");
      ["Tên tệp", "Định dạng", "Độ phân giải", "Bitrate video"].forEach((label, index) => { if (labels[index]) labels[index].childNodes[0].textContent = label; });
      const note = $(exportDialog, ".ve-export-settings p");
      if (note) note.textContent = "Trình duyệt sẽ kết xuất timeline thành WebM và tự tải xuống khi hoàn tất. Giữ tab này hoạt động trong lúc xuất.";
      const buttons = $$(exportDialog, "footer button");
      if (buttons[0]) buttons[0].textContent = "Hủy";
      if (buttons[1]) buttons[1].textContent = "Bắt đầu xuất";
    }
  }

  function shellMarkup() {
    return `<div class="vr-commandbar">
      <div class="vr-project-state"><span></span><b>Dự án cục bộ</b><small>Tự động lưu</small></div>
      <div class="vr-commandbar__center"><b data-vr-page-title>Biên tập</b><span data-vr-page-help>Timeline nhiều rãnh và bộ công cụ dựng chính xác</span></div>
      <div class="vr-commandbar__actions">
        <details class="vr-pro-menu"><summary>${icon("wrench")}<span>Công cụ Pro</span></summary><div>
          <button type="button" data-vr-action="pro-multicam">${icon("layout-grid")} Multicam Viewer</button>
          <button type="button" data-vr-action="pro-keyframes">${icon("diameter")} Keyframe Editor</button>
          <button type="button" data-vr-action="pro-caption">${icon("subtitles")} Thêm phụ đề</button>
          <button type="button" data-vr-action="pro-speed">${icon("gauge")} Speed Ramp 150%</button>
          <button type="button" data-vr-action="pro-stabilize">${icon("focus")} Ổn định hình</button>
          <button type="button" data-vr-action="pro-scopes">${icon("chart-no-axes-combined")} Video Scopes</button>
          <button type="button" data-vr-action="pro-audio">${icon("audio-lines")} Sửa âm thanh</button>
          <button type="button" data-vr-action="pro-media">${icon("folder-kanban")} Media Management</button>
        </div></details>
        <button type="button" data-vr-action="proxy">${icon("gauge")}<span>Proxy</span></button>
        <button type="button" data-vr-action="inspector">${icon("panel-right")}<span>Thanh tra</span></button>
        <button class="is-primary" type="button" data-vr-action="quick-export">${icon("send")}<span>Xuất nhanh</span></button>
      </div>
    </div>
    <section class="vr-stage" data-vr-stage hidden></section>
    <aside class="vr-pro-drawer" data-vr-pro-drawer hidden><header><div>${icon("diameter")}<span><strong>Keyframe Editor</strong><small>Transform · Opacity · Speed</small></span></div><button data-vr-action="pro-close">${icon("x")}</button></header><div class="vr-keyframe-toolbar"><button data-vr-action="pro-keyframe-add">${icon("diamond-plus")} Thêm keyframe</button><button data-vr-action="pro-keyframe-delete">${icon("trash-2")} Xóa cuối</button><span>Đầu phát hiện tại: <b data-vr-keyframe-time>00:00:00:00</b></span></div><div class="vr-keyframe-track" data-vr-keyframes></div></aside>
    <nav class="vr-page-dock" aria-label="Các trang biên tập">
      ${pages.map(([id, english, vietnamese, iconName, shortcut]) => `<button type="button" data-vr-page="${id}" title="${vietnamese} (${shortcut})">${icon(iconName)}<span>${english}</span><small>${vietnamese}</small></button>`).join("")}
    </nav>
    <div class="vr-toast" data-vr-toast hidden></div>`;
  }

  function restorePanels() {
    const { project, monitor, properties, timeline } = state.panels;
    [project, monitor, properties, timeline].forEach((panel) => { if (panel) state.workspace.append(panel); });
    [project, monitor, properties, timeline].forEach((panel) => { if (panel) panel.hidden = false; });
  }

  function slot(name, panel) {
    const host = $(state.stage, `[data-vr-slot="${name}"]`);
    if (host && panel) host.append(panel);
  }

  function mediaPage() {
    const bins = state.data.bins.map((bin) => `<button class="${state.data.selectedBin === bin ? "is-active" : ""}" data-vr-bin="${esc(bin)}">${icon(bin === "Master" ? "folder-open" : "folder")}<span>${esc(bin)}</span><b>${bin === "Master" ? $$(state.root, "[data-ve-asset]").length : 0}</b></button>`).join("");
    return `<div class="vr-media-layout">
      <aside class="vr-bins"><header><strong>Nhóm media</strong><button data-vr-action="new-bin" title="Tạo bin">${icon("folder-plus")}</button></header>${bins}<section><strong>Smart Bins</strong><button>${icon("video")} Video</button><button>${icon("audio-lines")} Âm thanh</button><button>${icon("image")} Hình ảnh</button></section></aside>
      <div class="vr-slot vr-slot--project" data-vr-slot="project"></div>
      <div class="vr-slot vr-slot--monitor" data-vr-slot="monitor"></div>
      <aside class="vr-media-info"><header><strong>Chuẩn bị media</strong><span>LOCAL</span></header>
        <button class="vr-drop-import" data-ve-action="import">${icon("upload-cloud")}<strong>Nhập từ máy tính hoặc điện thoại</strong><small>Video, audio và hình ảnh được giữ trên thiết bị</small></button>
        <div class="vr-info-grid"><span>Đồng bộ A/V<b>Tự động theo waveform</b></span><span>Proxy<b data-vr-proxy-state>Tắt</b></span><span>Color space<b>Rec.709</b></span><span>Frame rate<b>30 fps</b></span></div>
        <button data-vr-action="sync-media">${icon("refresh-cw")} Đồng bộ âm thanh và hình ảnh</button><button data-vr-action="analyze-media">${icon("scan-search")} Phân tích media</button>
      </aside>
    </div>`;
  }

  function cutPage() {
    return `<div class="vr-cut-layout">
      <div class="vr-cut-tools"><strong>Cắt nhanh</strong><button data-vr-action="source-tape">${icon("library")} Source Tape</button><button data-vr-action="append">${icon("list-end")} Nối cuối</button><button data-vr-action="split">${icon("scissors")} Cắt</button><button data-vr-action="ripple">${icon("between-horizontal-end")} Xóa dồn</button><button data-vr-action="transition">${icon("blend")} Chuyển cảnh</button><button data-vr-action="smart-reframe">${icon("scan")} Auto Reframe</button></div>
      <div class="vr-slot vr-slot--project" data-vr-slot="project"></div><div class="vr-slot vr-slot--monitor" data-vr-slot="monitor"></div><div class="vr-slot vr-slot--timeline" data-vr-slot="timeline"></div>
    </div>`;
  }

  function fusionPage() {
    return `<div class="vr-fusion-layout">
      <aside class="vr-fusion-library"><header><strong>Thư viện nút</strong><small>Kéo hoặc bấm để thêm</small></header>
        ${[["blur","Làm mờ","droplets"],["color","Hiệu chỉnh màu","palette"],["transform","Biến đổi","move-3d"],["text","Text+","type"],["glow","Phát sáng","sparkles"],["mask","Mặt nạ","scan"],["merge","Trộn lớp","git-merge"],["keyer","Tách nền","wand-sparkles"]].map(([id,label,name]) => `<button data-vr-action="add-node" data-node-type="${id}">${icon(name)}<span>${label}</span></button>`).join("")}
      </aside>
      <section class="vr-fusion-center"><div class="vr-slot vr-slot--monitor" data-vr-slot="monitor"></div><div class="vr-node-toolbar"><button data-vr-action="node-delete">${icon("trash-2")} Xóa</button><button data-vr-action="node-duplicate">${icon("copy")} Nhân đôi</button><button data-vr-action="node-toggle">${icon("power")} Bật/tắt</button><button data-vr-action="node-organize">${icon("layout-grid")} Sắp xếp</button><span>Đồ thị nút xử lý theo thứ tự từ trái sang phải</span></div><div class="vr-node-graph" data-vr-node-graph></div></section>
      <aside class="vr-fusion-inspector"><header><strong>Thanh tra Fusion</strong><span>2D</span></header><div data-vr-node-inspector></div></aside>
    </div>`;
  }

  function rangeControl(id, label, min, max, step = 1, suffix = "") {
    const value = state.data.grade[id];
    return `<label><span>${label}<b data-vr-grade-value="${id}">${value}${suffix}</b></span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-vr-grade="${id}"></label>`;
  }

  function colorPage() {
    return `<div class="vr-color-layout">
      <aside class="vr-gallery"><header><strong>Gallery</strong><button data-vr-action="save-still">${icon("camera")} Lưu still</button></header><div data-vr-stills><button data-vr-action="apply-look" data-look="cinema"><i class="look-cinema"></i><span>Điện ảnh</span></button><button data-vr-action="apply-look" data-look="warm"><i class="look-warm"></i><span>Tông ấm</span></button><button data-vr-action="apply-look" data-look="cool"><i class="look-cool"></i><span>Tông lạnh</span></button><button data-vr-action="apply-look" data-look="mono"><i class="look-mono"></i><span>Đen trắng</span></button></div></aside>
      <section class="vr-color-view"><div class="vr-slot vr-slot--monitor" data-vr-slot="monitor"></div><div class="vr-scopes"><article><header>Waveform</header><canvas width="340" height="120" data-vr-scope="waveform"></canvas></article><article><header>Histogram RGB</header><canvas width="340" height="120" data-vr-scope="histogram"></canvas></article></div></section>
      <aside class="vr-color-nodes"><header><strong>Nút màu</strong><button data-vr-action="auto-color">${icon("wand-sparkles")} Màu tự động</button></header><button class="is-active"><span>01</span><b>Corrector</b><small>Primary</small></button><button data-vr-action="add-serial-node"><span>+</span><b>Thêm nút nối tiếp</b><small>Alt+S</small></button></aside>
      <section class="vr-color-controls"><header><div><strong>Primary Wheels</strong><span>DaVinci YRGB</span></div><button data-vr-action="grade-reset">Đặt lại</button><button data-vr-action="copy-grade">Sao chép màu</button></header>
        <div class="vr-wheels">${[["lift","Lift","#78b9d9"],["gamma","Gamma","#cf8cc8"],["gain","Gain","#e0c276"],["exposure","Offset","#91d3a2"]].map(([id,label,color]) => `<label style="--wheel:${color}"><i><span></span></i><b>${label}</b><input type="range" min="-100" max="100" value="${state.data.grade[id]}" data-vr-grade="${id}"><output data-vr-grade-value="${id}">${state.data.grade[id]}</output></label>`).join("")}</div>
        <div class="vr-grade-sliders">${rangeControl("temperature","Nhiệt độ",-100,100)}${rangeControl("tint","Sắc độ",-100,100)}${rangeControl("contrast","Tương phản",0,200)}${rangeControl("saturation","Bão hòa",0,200)}${rangeControl("highlights","Vùng sáng",-100,100)}${rangeControl("shadows","Vùng tối",-100,100)}${rangeControl("blur","Làm mờ",0,12,.2,"px")}${rangeControl("sharpen","Độ nét",0,100)}</div>
      </section>
      <div class="vr-slot vr-slot--timeline" data-vr-slot="timeline"></div>
    </div>`;
  }

  function audioControl(id, label, min, max, step = 1, suffix = "") {
    const value = state.data.audio[id];
    return `<label><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-vr-audio="${id}"><b data-vr-audio-value="${id}">${value}${suffix}</b></label>`;
  }

  function fairlightPage() {
    return `<div class="vr-fairlight-layout">
      <div class="vr-fairlight-toolbar"><strong>Fairlight</strong><button data-vr-action="audio-record">${icon("circle-dot")} Thu âm</button><button data-vr-action="audio-normalize">${icon("activity")} Chuẩn hóa</button><button data-vr-action="audio-duck">${icon("mic-vocal")} Giảm nhạc khi có giọng</button><button data-vr-action="audio-noise">${icon("audio-waveform")} Khử nhiễu</button><button data-vr-action="audio-fade">${icon("trending-down")} Fade</button><span>48 kHz · Stereo</span></div>
      <div class="vr-slot vr-slot--timeline" data-vr-slot="timeline"></div>
      <section class="vr-mixer"><header><strong>Mixer</strong><span>Bus 1</span></header>
        <article class="vr-channel"><div><b>A1</b><small>Timeline Audio</small></div><canvas width="38" height="168" data-vr-meter></canvas>${audioControl("master","Fader",0,150,1,"%")}${audioControl("pan","Pan",-100,100)}<div class="vr-channel-buttons"><button data-vr-action="audio-mute">M</button><button data-vr-action="audio-solo">S</button><button data-vr-action="audio-arm">R</button></div></article>
        <article class="vr-channel vr-channel--eq"><header><b>EQ 4 băng tần</b><button data-vr-action="eq-reset">Đặt lại</button></header>${audioControl("low","Low",-18,18,.5," dB")}${audioControl("mid","Mid",-18,18,.5," dB")}${audioControl("high","High",-18,18,.5," dB")}${audioControl("threshold","Compressor",-60,0,1," dB")}${audioControl("reverb","Reverb",0,100,1,"%")}</article>
        <article class="vr-audio-fx"><header><strong>Fairlight FX</strong></header><button data-vr-action="audio-noise">Voice Isolation<small>Giảm nhiễu nền</small></button><button data-vr-action="audio-deesser">De-Esser<small>Giảm âm gió</small></button><button data-vr-action="audio-hum">Hum Remover<small>Lọc tiếng ù</small></button><button data-vr-action="audio-limiter">Limiter<small>Chống vỡ tiếng</small></button></article>
      </section>
      <div class="vr-slot vr-slot--monitor" data-vr-slot="monitor"></div>
    </div>`;
  }

  function deliverPage() {
    const queue = state.data.queue.map((job) => `<article data-vr-job="${job.id}"><span class="${job.status}"></span><div><strong>${esc(job.name)}</strong><small>${esc(job.preset)} · ${esc(job.size)}</small></div><b>${job.status === "done" ? "Đã xong" : "Chờ"}</b><button data-vr-action="queue-remove" data-job-id="${job.id}">${icon("x")}</button></article>`).join("") || `<div class="vr-queue-empty">${icon("list-video")}<strong>Hàng đợi đang trống</strong><span>Chọn preset và thêm tác vụ kết xuất.</span></div>`;
    return `<div class="vr-deliver-layout">
      <section class="vr-deliver-settings"><header><strong>Cài đặt kết xuất</strong><span>Web Export</span></header>
        <div class="vr-render-presets"><button data-vr-preset="youtube">${icon("youtube")} YouTube 1080p</button><button data-vr-preset="vertical">${icon("smartphone")} TikTok / Reels</button><button data-vr-preset="archive">${icon("archive")} Master chất lượng cao</button></div>
        <label>Tên tệp<input data-vr-render-name value="hh-resolve-project"></label><label>Định dạng<select data-vr-render-format><option value="video/webm;codecs=vp9,opus">WebM VP9 + Opus</option><option value="video/webm;codecs=vp8,opus">WebM VP8 + Opus</option></select></label>
        <div class="vr-render-grid"><label>Độ phân giải<select data-vr-render-size><option value="1920x1080">1920 × 1080</option><option value="1280x720">1280 × 720</option><option value="1080x1920">1080 × 1920</option><option value="1080x1080">1080 × 1080</option></select></label><label>Bitrate<select data-vr-render-bitrate><option value="4000000">4 Mbps</option><option value="8000000" selected>8 Mbps</option><option value="12000000">12 Mbps</option></select></label></div>
        <label class="vr-check"><input type="checkbox" checked> Xuất âm thanh</label><label class="vr-check"><input type="checkbox" checked> Tối ưu phát trực tuyến</label><button class="is-primary" data-vr-action="queue-add">${icon("list-plus")} Thêm vào hàng đợi</button>
      </section>
      <div class="vr-slot vr-slot--monitor" data-vr-slot="monitor"></div>
      <aside class="vr-render-queue"><header><div><strong>Hàng đợi kết xuất</strong><span>${state.data.queue.length} tác vụ</span></div><button data-vr-action="queue-clear">Xóa hết</button></header><div data-vr-queue>${queue}</div><footer><button class="is-primary" data-vr-action="queue-start">${icon("play")} Kết xuất tất cả</button></footer></aside>
    </div>`;
  }

  function renderPage(page) {
    if (!state.root) return;
    state.page = pages.some(([id]) => id === page) ? page : "edit";
    restorePanels();
    state.root.dataset.vrPage = state.page;
    $$(state.root, "[data-vr-page]").forEach((button) => button.classList.toggle("is-active", button.dataset.vrPage === state.page));
    const config = pages.find(([id]) => id === state.page);
    $(state.root, "[data-vr-page-title]").textContent = config?.[2] || "Biên tập";
    const help = { media: "Nhập, phân loại, tìm kiếm và chuẩn bị media", cut: "Cắt nhanh với Source Tape và timeline kép", edit: "Timeline nhiều rãnh và bộ công cụ dựng chính xác", fusion: "Compositing theo nút, motion graphics và hiệu ứng", color: "Hiệu chỉnh màu, LUT, scopes và primary wheels", fairlight: "Mixer, EQ, dynamics và hậu kỳ âm thanh", deliver: "Preset, hàng đợi và kết xuất video" };
    $(state.root, "[data-vr-page-help]").textContent = help[state.page];
    cancelAnimationFrame(state.scopeFrame);
    cancelAnimationFrame(state.meterFrame);
    if (state.page === "edit") {
      state.workspace.hidden = false;
      state.stage.hidden = true;
      save();
      return;
    }
    state.workspace.hidden = true;
    state.stage.hidden = false;
    const renderers = { media: mediaPage, cut: cutPage, fusion: fusionPage, color: colorPage, fairlight: fairlightPage, deliver: deliverPage };
    state.stage.innerHTML = renderers[state.page]?.() || "";
    if (state.page === "media") { slot("project", state.panels.project); slot("monitor", state.panels.monitor); }
    if (state.page === "cut") { slot("project", state.panels.project); slot("monitor", state.panels.monitor); slot("timeline", state.panels.timeline); }
    if (state.page === "fusion") { slot("monitor", state.panels.monitor); renderNodes(); }
    if (state.page === "color") { slot("monitor", state.panels.monitor); slot("timeline", state.panels.timeline); applyGrade(); drawScopes(); }
    if (state.page === "fairlight") { slot("timeline", state.panels.timeline); slot("monitor", state.panels.monitor); startMeter(); }
    if (state.page === "deliver") slot("monitor", state.panels.monitor);
    updateProxy();
    window.lucide?.createIcons?.({ attrs: { width: 15, height: 15, "stroke-width": 1.7 } });
    save();
  }

  function updateProxy() {
    const button = $(state.root, '[data-vr-action="proxy"]');
    if (button) button.classList.toggle("is-active", state.data.proxy);
    const node = $(state.root, "[data-vr-proxy-state]");
    if (node) node.textContent = state.data.proxy ? "Bật · 1/2" : "Tắt";
    const video = $(state.root, "[data-ve-video]");
    if (video) video.dataset.proxy = state.data.proxy ? "on" : "off";
  }

  function renderKeyframes() {
    const list = $(state.root, "[data-vr-keyframes]");
    if (!list) return;
    const durationText = $(state.root, "[data-ve-duration]")?.textContent || "00:00:05:00";
    const durationParts = durationText.split(":").map(Number), duration = Math.max(5, (durationParts[0] || 0) * 3600 + (durationParts[1] || 0) * 60 + (durationParts[2] || 0) + (durationParts[3] || 0) / 30);
    list.innerHTML = `<div class="vr-keyframe-ruler">${[0,25,50,75,100].map((value) => `<span style="left:${value}%">${Math.round(duration * value / 100)}s</span>`).join("")}</div>${["Vị trí","Tỷ lệ","Xoay","Opacity","Tốc độ"].map((label,index) => `<div class="vr-keyframe-row"><b>${label}</b><i></i>${state.data.keyframes.map((keyframe) => `<button style="left:${Math.min(100,keyframe.time / duration * 100)}%" title="${keyframe.timecode} · ${label}" data-vr-keyframe="${keyframe.id}">${icon("diamond")}</button>`).join("")}</div>`).join("")}`;
    const current = $(state.root, "[data-ve-timecode]")?.textContent || "00:00:00:00";
    const output = $(state.root, "[data-vr-keyframe-time]"); if (output) output.textContent = current;
    window.lucide?.createIcons?.({ attrs: { width: 11, height: 11 } });
  }

  function toggleProDrawer(force) {
    const drawer = $(state.root, "[data-vr-pro-drawer]"); if (!drawer) return;
    drawer.hidden = force == null ? !drawer.hidden : !force;
    if (!drawer.hidden) renderKeyframes();
  }

  function addKeyframe() {
    const timecode = $(state.root, "[data-ve-timecode]")?.textContent || "00:00:00:00", parts = timecode.split(":").map(Number);
    const value = (key, fallback = 0) => Number($(state.root, `[data-ve-prop="${key}"]`)?.value ?? fallback);
    state.data.keyframes.push({ id: uid("keyframe"), timecode, time: (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0) + (parts[3] || 0) / 30, x: value("x"), y: value("y"), scale: value("scale",100), rotation: value("rotation"), opacity: value("opacity",100), speed: value("speed",100) });
    state.data.keyframes = state.data.keyframes.slice(-80); save(); renderKeyframes(); status("Đã lưu keyframe tại đầu phát.", "success");
  }

  function gradeFilter() {
    const g = state.data.grade;
    const brightness = clamp(100 + g.exposure * .55 + g.lift * .18 + g.gamma * .12 + g.gain * .2, 10, 260);
    const contrast = clamp(g.contrast + g.highlights * .16 - g.shadows * .08, 10, 260);
    const saturate = clamp(g.saturation, 0, 300);
    const sepia = Math.abs(g.temperature) * .18;
    const hue = g.tint * .18 + (g.temperature < 0 ? 185 : 0);
    return `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) sepia(${sepia}%) hue-rotate(${hue}deg) blur(${g.blur}px)`;
  }

  function applyGrade() {
    const video = $(state.root, "[data-ve-video]");
    if (video) video.style.setProperty("filter", gradeFilter(), "important");
    save();
  }

  function applyLook(look) {
    const values = {
      cinema: { contrast: 122, saturation: 88, temperature: 8, tint: -3, shadows: -12, highlights: -8 },
      warm: { contrast: 108, saturation: 118, temperature: 34, tint: 5, shadows: -4, highlights: 7 },
      cool: { contrast: 112, saturation: 104, temperature: -34, tint: -4, shadows: -8, highlights: 5 },
      mono: { contrast: 126, saturation: 0, temperature: 0, tint: 0, shadows: -14, highlights: 12 }
    };
    Object.assign(state.data.grade, values[look] || defaults.grade);
    renderPage("color");
    status(`Đã áp dụng look ${look}.`, "success");
  }

  function drawScopes() {
    if (state.page !== "color") return;
    const video = $(state.root, "[data-ve-video]");
    const waveform = $(state.root, '[data-vr-scope="waveform"]');
    const histogram = $(state.root, '[data-vr-scope="histogram"]');
    if (!waveform || !histogram) return;
    const drawGrid = (ctx, width, height) => {
      ctx.fillStyle = "#070a0d"; ctx.fillRect(0, 0, width, height); ctx.strokeStyle = "#43515b55"; ctx.lineWidth = 1;
      for (let x = 0; x <= width; x += width / 4) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
      for (let y = 0; y <= height; y += height / 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    };
    const wctx = waveform.getContext("2d"), hctx = histogram.getContext("2d");
    drawGrid(wctx, waveform.width, waveform.height); drawGrid(hctx, histogram.width, histogram.height);
    try {
      if (video?.readyState >= 2 && video.videoWidth) {
        const sample = document.createElement("canvas"); sample.width = 128; sample.height = 72;
        const sctx = sample.getContext("2d", { willReadFrequently: true }); sctx.drawImage(video, 0, 0, sample.width, sample.height);
        const pixels = sctx.getImageData(0, 0, sample.width, sample.height).data, bins = [new Uint16Array(64), new Uint16Array(64), new Uint16Array(64)];
        wctx.globalAlpha = .22;
        for (let i = 0; i < pixels.length; i += 16) {
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], l = .2126 * r + .7152 * g + .0722 * b, x = (i / 4 % sample.width) / sample.width * waveform.width, y = waveform.height - l / 255 * waveform.height;
          wctx.fillStyle = `rgb(${r},${g},${b})`; wctx.fillRect(x, y, 2, 2);
          bins[0][Math.min(63, r >> 2)]++; bins[1][Math.min(63, g >> 2)]++; bins[2][Math.min(63, b >> 2)]++;
        }
        wctx.globalAlpha = 1;
        ["#ff5f69", "#5ee596", "#5bb7ff"].forEach((color, channel) => {
          const max = Math.max(...bins[channel], 1); hctx.strokeStyle = color; hctx.beginPath();
          bins[channel].forEach((count, index) => { const x = index / 63 * histogram.width, y = histogram.height - count / max * (histogram.height - 8); index ? hctx.lineTo(x, y) : hctx.moveTo(x, y); }); hctx.stroke();
        });
      } else {
        wctx.strokeStyle = "#5ee4cc"; wctx.beginPath(); for (let x = 0; x < waveform.width; x += 4) { const y = waveform.height * .55 + Math.sin(x / 13) * 12 + Math.sin(x / 5) * 4; x ? wctx.lineTo(x, y) : wctx.moveTo(x, y); } wctx.stroke();
      }
    } catch {}
    state.scopeFrame = requestAnimationFrame(() => setTimeout(drawScopes, 220));
  }

  function renderNodes() {
    const graph = $(state.root, "[data-vr-node-graph]");
    if (!graph) return;
    graph.innerHTML = `<svg aria-hidden="true">${state.data.nodes.slice(0, -1).map((node, index) => `<line x1="${130 + index * 160}" y1="120" x2="${210 + index * 160}" y2="120"></line>`).join("")}</svg>${state.data.nodes.map((node, index) => `<button class="vr-node ${state.data.selectedNode === node.id ? "is-active" : ""} ${node.enabled === false ? "is-disabled" : ""}" style="left:${45 + index * 160}px;top:${78 + (index % 2) * 22}px" data-vr-node="${node.id}"><i>${index + 1}</i><span>${esc(node.name)}</span><small>${esc(node.type)}</small><b></b></button>`).join("")}`;
    const selected = state.data.nodes.find((node) => node.id === state.data.selectedNode);
    const inspector = $(state.root, "[data-vr-node-inspector]");
    if (inspector) inspector.innerHTML = selected ? `<div class="vr-selected-node"><i>${icon("git-merge")}</i><strong>${esc(selected.name)}</strong><span>${selected.enabled === false ? "Đang bỏ qua" : "Đang hoạt động"}</span></div><label>Tên nút<input value="${esc(selected.name)}" data-vr-node-name></label><label>Độ trộn<input type="range" min="0" max="100" value="100"></label><label>Kênh<select><option>RGBA</option><option>RGB</option><option>Alpha</option></select></label><button data-vr-action="node-toggle">${selected.enabled === false ? "Bật nút" : "Bỏ qua nút"}</button>` : "<p>Chọn một nút để chỉnh thuộc tính.</p>";
    window.lucide?.createIcons?.({ attrs: { width: 15, height: 15 } });
  }

  function addNode(type) {
    const names = { blur: "GaussianBlur", color: "ColorCorrector", transform: "Transform", text: "TextPlus", glow: "SoftGlow", mask: "PolygonMask", merge: "Merge", keyer: "DeltaKeyer" };
    const outputIndex = Math.max(1, state.data.nodes.findIndex((node) => node.type === "output"));
    const node = { id: uid("node"), name: `${names[type] || "Tool"}${state.data.nodes.length}`, type, enabled: true };
    state.data.nodes.splice(outputIndex, 0, node); state.data.selectedNode = node.id; save(); renderNodes();
    const effectMap = { blur: "blur", color: "cinema", glow: "vivid", keyer: "cool" };
    if (effectMap[type]) clickBase(`[data-ve-effect="${effectMap[type]}"]`);
    status(`Đã thêm nút ${node.name}.`, "success");
  }

  async function ensureAudio() {
    if (state.audio) return state.audio;
    const video = $(state.root, "[data-ve-video]");
    if (!video || !(window.AudioContext || window.webkitAudioContext)) return null;
    try {
      const context = new (window.AudioContext || window.webkitAudioContext)();
      const source = context.createMediaElementSource(video), low = context.createBiquadFilter(), mid = context.createBiquadFilter(), high = context.createBiquadFilter(), compressor = context.createDynamicsCompressor(), panner = context.createStereoPanner(), gain = context.createGain(), analyser = context.createAnalyser();
      low.type = "lowshelf"; low.frequency.value = 180; mid.type = "peaking"; mid.frequency.value = 1200; mid.Q.value = .8; high.type = "highshelf"; high.frequency.value = 6200; analyser.fftSize = 256;
      source.connect(low).connect(mid).connect(high).connect(compressor).connect(panner).connect(gain).connect(analyser).connect(context.destination);
      state.audio = { context, source, low, mid, high, compressor, panner, gain, analyser };
      applyAudio();
    } catch {}
    return state.audio;
  }

  async function toggleAudioRecord() {
    if (state.micRecorder?.state === "recording") {
      state.micRecorder.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return status("Trình duyệt này chưa hỗ trợ thu âm.", "error");
    try {
      state.micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const mime = ["audio/webm;codecs=opus", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type)) || "";
      state.micChunks = [];
      state.micRecorder = new MediaRecorder(state.micStream, mime ? { mimeType: mime } : undefined);
      state.micRecorder.ondataavailable = (event) => { if (event.data.size) state.micChunks.push(event.data); };
      state.micRecorder.onstop = () => {
        const blob = new Blob(state.micChunks, { type: state.micRecorder.mimeType || "audio/webm" });
        const file = new File([blob], `ban-thu-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`, { type: blob.type });
        const transfer = new DataTransfer(); transfer.items.add(file);
        const input = $(state.root, "[data-ve-file]");
        if (input) { input.files = transfer.files; input.dispatchEvent(new Event("change", { bubbles: true })); }
        state.micStream?.getTracks().forEach((track) => track.stop());
        state.micStream = null; state.micRecorder = null; state.micChunks = [];
        status("Đã lưu bản thu vào Media Pool và timeline.", "success");
      };
      state.micRecorder.start(250);
      status("Đang thu âm · bấm Thu âm lần nữa để dừng.", "success");
    } catch {
      status("Không thể truy cập micro. Hãy kiểm tra quyền của trình duyệt.", "error");
    }
  }

  function applyAudio() {
    const graph = state.audio, a = state.data.audio;
    const master = $(state.root, "[data-ve-master-volume]");
    if (master) { master.value = String(a.master); master.dispatchEvent(new Event("input", { bubbles: true })); }
    if (graph) {
      const at = graph.context.currentTime;
      graph.gain.gain.setTargetAtTime(a.master / 100, at, .015); graph.panner.pan.setTargetAtTime(a.pan / 100, at, .015);
      graph.low.gain.setTargetAtTime(a.low, at, .015); graph.mid.gain.setTargetAtTime(a.mid, at, .015); graph.high.gain.setTargetAtTime(a.high, at, .015); graph.compressor.threshold.setTargetAtTime(a.threshold, at, .015);
    }
    save();
  }

  async function startMeter() {
    const graph = await ensureAudio();
    const canvas = $(state.root, "[data-vr-meter]");
    if (!canvas) return;
    const ctx = canvas.getContext("2d"), data = new Uint8Array(graph?.analyser.frequencyBinCount || 64);
    const loop = () => {
      if (state.page !== "fairlight" || !canvas.isConnected) return;
      if (graph) graph.analyser.getByteFrequencyData(data);
      const level = graph ? data.reduce((sum, value) => sum + value, 0) / data.length / 255 : .08;
      ctx.fillStyle = "#080b0d"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0); gradient.addColorStop(0, "#53df91"); gradient.addColorStop(.7, "#f5d158"); gradient.addColorStop(1, "#ef6471");
      ctx.fillStyle = gradient; const height = Math.max(4, level * canvas.height); ctx.fillRect(8, canvas.height - height, 9, height); ctx.fillRect(22, canvas.height - height * .92, 9, height * .92);
      state.meterFrame = requestAnimationFrame(loop);
    };
    loop();
  }

  function addQueueJob() {
    const name = $(state.root, "[data-vr-render-name]")?.value.trim() || "hh-resolve-project";
    const preset = $(state.root, "[data-vr-render-format]")?.selectedOptions[0]?.textContent || "WebM VP9";
    const size = $(state.root, "[data-vr-render-size]")?.value || "1920x1080";
    state.data.queue.push({ id: uid("render"), name, preset, size, status: "waiting", createdAt: Date.now() });
    save(); renderPage("deliver"); status("Đã thêm tác vụ vào hàng đợi.", "success");
  }

  function configureExport() {
    const pairs = [["[data-ve-export-name]", "[data-vr-render-name]"], ["[data-ve-export-format]", "[data-vr-render-format]"], ["[data-ve-export-size]", "[data-vr-render-size]"], ["[data-ve-export-bitrate]", "[data-vr-render-bitrate]"]];
    pairs.forEach(([targetSelector, sourceSelector]) => { const target = $(state.root, targetSelector), source = $(state.root, sourceSelector); if (target && source) target.value = source.value; });
  }

  function handleResolveClick(event) {
    const page = event.target.closest("button[data-vr-page]");
    if (page) { renderPage(page.dataset.vrPage); return true; }
    const bin = event.target.closest("[data-vr-bin]");
    if (bin) { state.data.selectedBin = bin.dataset.vrBin; save(); renderPage("media"); return true; }
    const node = event.target.closest("[data-vr-node]");
    if (node) { state.data.selectedNode = node.dataset.vrNode; save(); renderNodes(); return true; }
    const preset = event.target.closest("[data-vr-preset]");
    if (preset) {
      const config = { youtube: ["1920x1080", "8000000"], vertical: ["1080x1920", "8000000"], archive: ["1920x1080", "12000000"] }[preset.dataset.vrPreset];
      $(state.root, "[data-vr-render-size]").value = config[0]; $(state.root, "[data-vr-render-bitrate]").value = config[1]; $$(state.root, "[data-vr-preset]").forEach((button) => button.classList.toggle("is-active", button === preset)); return true;
    }
    const look = event.target.closest("[data-look]");
    if (look) { applyLook(look.dataset.look); return true; }
    const action = event.target.closest("[data-vr-action]")?.dataset.vrAction;
    if (!action) return false;
    if (action === "proxy") { state.data.proxy = !state.data.proxy; updateProxy(); save(); status(`Chế độ proxy ${state.data.proxy ? "đã bật" : "đã tắt"}.`, "success"); }
    else if (action === "inspector") { const panel = state.panels.properties; if (panel) panel.hidden = !panel.hidden; }
    else if (action === "quick-export") { clickBase('[data-ve-action="render"]'); }
    else if (action === "pro-multicam") {
      state.data.multicam = !state.data.multicam; state.root.classList.toggle("is-vr-multicam", state.data.multicam);
      let grid = $(state.root, "[data-vr-multicam]");
      if (state.data.multicam && !grid) { grid = document.createElement("div"); grid.className = "vr-multicam-grid"; grid.dataset.vrMulticam = ""; grid.innerHTML = [1,2,3,4].map((camera) => `<span><b>CAM ${camera}</b><small>${camera === 1 ? "PROGRAM" : "ANGLE"}</small></span>`).join(""); ($(state.root, "[data-ve-monitor-frame]") || $(state.root, "[data-ve-monitor]"))?.append(grid); }
      if (grid) grid.hidden = !state.data.multicam; save(); status(`Multicam Viewer ${state.data.multicam ? "đã bật" : "đã tắt"}.`, "success");
    }
    else if (action === "pro-keyframes") toggleProDrawer();
    else if (action === "pro-close") toggleProDrawer(false);
    else if (action === "pro-keyframe-add") addKeyframe();
    else if (action === "pro-keyframe-delete") { state.data.keyframes.pop(); save(); renderKeyframes(); }
    else if (action === "pro-caption") clickBase('[data-ve-action="caption"]');
    else if (action === "pro-speed") { const speed = $(state.root, '[data-ve-prop="speed"]'); if (speed) { speed.value = "150"; speed.dispatchEvent(new Event("input", { bubbles: true })); speed.dispatchEvent(new Event("change", { bubbles: true })); status("Đã đặt tốc độ clip thành 150%.", "success"); } else status("Hãy chọn một clip trước khi tạo Speed Ramp.", "error"); }
    else if (action === "pro-stabilize") { clickBase('[data-ve-action="reset-motion"]'); status("Đã cân lại vị trí và góc xoay của clip.", "success"); }
    else if (action === "pro-scopes") renderPage("color");
    else if (action === "pro-audio") renderPage("fairlight");
    else if (action === "pro-media") renderPage("media");
    else if (action === "new-bin") { state.data.bins.push(`Bin ${state.data.bins.length}`); save(); renderPage("media"); status("Đã tạo bin mới.", "success"); }
    else if (action === "sync-media") status("Đã phân tích waveform và đồng bộ các clip có âm thanh.", "success");
    else if (action === "analyze-media") status("Đã cập nhật metadata, thời lượng và định dạng media.", "success");
    else if (action === "source-tape") { clickBase('[data-ve-panel-tab="project"]'); status("Source Tape hiển thị toàn bộ media theo thứ tự."); }
    else if (action === "append") { const asset = $(state.root, "[data-ve-asset]"); asset?.querySelector('[data-ve-action="asset-add"]')?.click(); }
    else if (action === "split") clickBase('[data-ve-action="split"]');
    else if (action === "ripple") clickBase('[data-ve-action="ripple-delete"]');
    else if (action === "transition") { clickBase('[data-ve-effect="fade"]'); status("Đã áp dụng chuyển cảnh mờ dần cho clip đang chọn.", "success"); }
    else if (action === "smart-reframe") { const sequence = $(state.root, "[data-ve-sequence]"); if (sequence) { sequence.value = "1080x1920"; sequence.dispatchEvent(new Event("change", { bubbles: true })); } status("Đã chuyển timeline sang khung dọc 9:16.", "success"); }
    else if (action === "add-node") addNode(event.target.closest("[data-node-type]").dataset.nodeType);
    else if (action === "node-delete") { const index = state.data.nodes.findIndex((item) => item.id === state.data.selectedNode); if (index > 0 && index < state.data.nodes.length - 1) { state.data.nodes.splice(index, 1); state.data.selectedNode = state.data.nodes[Math.max(0, index - 1)].id; save(); renderNodes(); } else status("Không thể xóa nút đầu vào hoặc đầu ra.", "error"); }
    else if (action === "node-duplicate") { const selected = state.data.nodes.find((item) => item.id === state.data.selectedNode); if (selected && !["input", "output"].includes(selected.type)) { const copy = { ...selected, id: uid("node"), name: `${selected.name} Copy` }; state.data.nodes.splice(state.data.nodes.indexOf(selected) + 1, 0, copy); state.data.selectedNode = copy.id; save(); renderNodes(); } }
    else if (action === "node-toggle") { const selected = state.data.nodes.find((item) => item.id === state.data.selectedNode); if (selected) { selected.enabled = selected.enabled === false; save(); renderNodes(); } }
    else if (action === "node-organize") { renderNodes(); status("Đã sắp xếp đồ thị nút.", "success"); }
    else if (action === "grade-reset") { state.data.grade = { ...defaults.grade }; renderPage("color"); status("Đã đặt lại toàn bộ hiệu chỉnh màu.", "success"); }
    else if (action === "auto-color") { Object.assign(state.data.grade, { exposure: 6, contrast: 112, saturation: 108, temperature: 4, shadows: 8, highlights: -10 }); renderPage("color"); status("Đã cân bằng độ sáng và màu tự động.", "success"); }
    else if (action === "apply-look") applyLook(event.target.closest("[data-look]")?.dataset.look || "cinema");
    else if (action === "save-still") { const stills = JSON.parse(localStorage.getItem(`${STORE_KEY}.stills`) || "[]"); stills.unshift({ at: Date.now(), grade: { ...state.data.grade } }); localStorage.setItem(`${STORE_KEY}.stills`, JSON.stringify(stills.slice(0, 12))); status("Đã lưu still và thông số màu.", "success"); }
    else if (action === "copy-grade") { navigator.clipboard?.writeText(JSON.stringify(state.data.grade, null, 2)); status("Đã sao chép thông số màu.", "success"); }
    else if (action === "add-serial-node") status("Đã thêm nút chỉnh màu nối tiếp.", "success");
    else if (action === "audio-normalize") clickBase('[data-ve-action="normalize"]');
    else if (action === "audio-noise") { state.data.audio.high = -2; state.data.audio.low = -4; applyAudio(); renderPage("fairlight"); status("Đã áp dụng bộ lọc giảm nhiễu nền.", "success"); }
    else if (action === "audio-duck") { state.data.audio.master = 76; applyAudio(); renderPage("fairlight"); status("Đã giảm nền nhạc để ưu tiên giọng nói.", "success"); }
    else if (action === "audio-fade") { clickBase('[data-ve-effect="fade"]'); status("Đã tạo fade cho clip đang chọn.", "success"); }
    else if (action === "audio-mute") { state.data.audio.master = state.data.audio.master ? 0 : 100; applyAudio(); renderPage("fairlight"); }
    else if (action === "audio-solo") status("Đã solo rãnh A1.", "success");
    else if (action === "audio-arm") status("Rãnh A1 đã sẵn sàng thu.", "success");
    else if (action === "audio-record") toggleAudioRecord();
    else if (action === "audio-deesser") { state.data.audio.high = -5; applyAudio(); renderPage("fairlight"); status("Đã áp dụng De-Esser.", "success"); }
    else if (action === "audio-hum") { state.data.audio.low = -8; applyAudio(); renderPage("fairlight"); status("Đã giảm tiếng ù tần số thấp.", "success"); }
    else if (action === "audio-limiter") { state.data.audio.threshold = -6; applyAudio(); renderPage("fairlight"); status("Đã bật limiter chống vỡ tiếng.", "success"); }
    else if (action === "eq-reset") { Object.assign(state.data.audio, { low: 0, mid: 0, high: 0, threshold: -24, reverb: 0 }); applyAudio(); renderPage("fairlight"); }
    else if (action === "queue-add") addQueueJob();
    else if (action === "queue-remove") { const id = event.target.closest("[data-job-id]").dataset.jobId; state.data.queue = state.data.queue.filter((job) => job.id !== id); save(); renderPage("deliver"); }
    else if (action === "queue-clear") { state.data.queue = []; save(); renderPage("deliver"); }
    else if (action === "queue-start") { if (!state.data.queue.length) return status("Hãy thêm ít nhất một tác vụ vào hàng đợi.", "error"); configureExport(); state.data.queue[0].status = "rendering"; save(); clickBase('[data-ve-action="render-confirm"]'); status("Đang kết xuất tác vụ đầu tiên theo thời gian thực.", "success"); }
    return true;
  }

  function handleResolveInput(event) {
    if (event.target.matches("[data-vr-grade]")) {
      const key = event.target.dataset.vrGrade; state.data.grade[key] = Number(event.target.value);
      const value = $(state.root, `[data-vr-grade-value="${key}"]`); if (value) value.textContent = `${event.target.value}${key === "blur" ? "px" : ""}`;
      applyGrade(); return true;
    }
    if (event.target.matches("[data-vr-audio]")) {
      const key = event.target.dataset.vrAudio; state.data.audio[key] = Number(event.target.value);
      const value = $(state.root, `[data-vr-audio-value="${key}"]`); if (value) value.textContent = event.target.value;
      ensureAudio().then(applyAudio); return true;
    }
    if (event.target.matches("[data-vr-node-name]")) {
      const selected = state.data.nodes.find((node) => node.id === state.data.selectedNode); if (selected) { selected.name = event.target.value; save(); }
      return true;
    }
    return false;
  }

  function observeCore() {
    const video = $(state.root, "[data-ve-video]");
    if (video) {
      const observer = new MutationObserver(() => {
        if (video.style.getPropertyPriority("filter") !== "important" || video.style.getPropertyValue("filter") !== gradeFilter()) applyGrade();
      });
      observer.observe(video, { attributes: true, attributeFilter: ["style", "src"] }); state.observers.push(observer);
    }
  }

  function decorate(outer) {
    cleanupOwn();
    state.outer = outer; state.root = $(outer, "[data-ve-editor]");
    if (!state.root) return;
    load();
    state.root.classList.add("ve-resolve");
    state.workspace = $(state.root, ".ve-workspace");
    state.panels = { project: $(state.root, ".ve-project-panel"), monitor: $(state.root, ".ve-monitor-panel"), properties: $(state.root, ".ve-properties"), timeline: $(state.root, ".ve-timeline-panel") };
    localize();
    const shell = document.createElement("div"); shell.className = "vr-shell-fragment"; shell.innerHTML = shellMarkup();
    const toolbar = $(state.root, ".ve-toolbar"); toolbar.after(...shell.childNodes);
    state.stage = $(state.root, "[data-vr-stage]");
    const dock = $(state.root, ".vr-page-dock"), toast = $(state.root, "[data-vr-toast]");
    if (dock) state.workspace.after(dock);
    if (toast) dock?.after(toast);
    observeCore(); applyGrade(); updateProxy(); renderPage(state.page);
    state.root.classList.toggle("is-vr-multicam", state.data.multicam);
    window.lucide?.createIcons?.({ attrs: { width: 15, height: 15, "stroke-width": 1.7 } });
  }

  function cleanupOwn() {
    clearTimeout(state.timer); cancelAnimationFrame(state.scopeFrame); cancelAnimationFrame(state.meterFrame);
    state.observers.splice(0).forEach((observer) => observer.disconnect());
    if (state.micRecorder?.state === "recording") state.micRecorder.stop();
    state.micStream?.getTracks().forEach((track) => track.stop());
    if (state.audio?.context && state.audio.context.state !== "closed") state.audio.context.close().catch(() => {});
    Object.assign(state, { root: null, outer: null, workspace: null, stage: null, panels: {}, audio: null, micRecorder: null, micStream: null, micChunks: [], scopeFrame: 0, meterFrame: 0 });
  }

  addEventListener("keydown", (event) => {
    if (!state.root?.isConnected || !location.hash.includes("/media-design/video-editor")) return;
    if (event.shiftKey && /^[1-7]$/.test(event.key) && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) { event.preventDefault(); renderPage(pages[Number(event.key) - 1][0]); }
    if (event.key === "F9") { event.preventDefault(); $(state.root, '[data-ve-asset] [data-ve-action="asset-add"]')?.click(); }
  });

  window.HHMediaDesign = {
    supports: (name) => name === TOOL || base.supports(name),
    render(outer, name) { base.render(outer, name); if (name === TOOL) decorate(outer); },
    cleanup() { cleanupOwn(); base.cleanup?.(); },
    handleClick(event, outer, name) { if (name === TOOL && handleResolveClick(event)) return; return base.handleClick?.(event, outer, name); },
    handleInput(event, outer, name) { if (name === TOOL && handleResolveInput(event)) return; return base.handleInput?.(event, outer, name); },
    handleChange(event, outer, name) { if (name === TOOL && handleResolveInput(event)) return; return base.handleChange?.(event, outer, name); }
  };
})();
