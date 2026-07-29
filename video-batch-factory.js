(() => {
  "use strict";

  const STORAGE_KEY = "hh.video-batch-factory.v2";
  const LEGACY_STORAGE_KEY = "hh.video-batch-factory.v1";
  const DB_NAME = "hh-video-editor-media";
  const DB_STORE = "assets";
  const MAX_ROWS = 250;
  const MAX_LIBRARY_FILES = 500;
  const MAX_DURATION = 43_200;
  const MAX_INPUT_SIZE = 2 * 1024 * 1024 * 1024;
  const PRESETS = Object.freeze([
    { id: "youtube", name: "YouTube Full HD", width: 1920, height: 1080, duration: 3600, fps: 30, accent: "#6be8ff", background: "#071020", layout: "left", motion: "cinematic" },
    { id: "short", name: "Short Full HD 9:16", width: 1080, height: 1920, duration: 3600, fps: 30, accent: "#ff65c8", background: "#130923", layout: "center", motion: "pulse" },
    { id: "square", name: "Social Square", width: 1080, height: 1080, duration: 3600, fps: 30, accent: "#9d7cff", background: "#090d1c", layout: "center", motion: "orbit" },
    { id: "quote", name: "YouTube 2K", width: 2560, height: 1440, duration: 3600, fps: 30, accent: "#ffd56a", background: "#110b20", layout: "center", motion: "drift" },
    { id: "promo", name: "YouTube 4K", width: 3840, height: 2160, duration: 3600, fps: 30, accent: "#56e6b1", background: "#061612", layout: "left", motion: "cinematic" },
    { id: "news", name: "Vertical 4K", width: 2160, height: 3840, duration: 3600, fps: 30, accent: "#ff765f", background: "#150a0a", layout: "left", motion: "slide" }
  ]);
  const COLOR_PRESETS = Object.freeze([
    { id: "auto", name: "Tự gợi ý theo ảnh", filter: "none", accent: "#6be8ff" },
    { id: "natural", name: "Natural Clean", filter: "brightness(1.02) contrast(1.04) saturate(1.05)", accent: "#d8f4ff" },
    { id: "cinematic", name: "Cinematic Teal–Orange", filter: "brightness(.98) contrast(1.14) saturate(1.2) sepia(.12) hue-rotate(-8deg)", accent: "#ff9c67" },
    { id: "neon", name: "Neon Galaxy", filter: "brightness(1.06) contrast(1.16) saturate(1.45) hue-rotate(8deg)", accent: "#ff65c8" },
    { id: "aurora", name: "Aurora Cyan", filter: "brightness(1.05) contrast(1.08) saturate(1.26) hue-rotate(15deg)", accent: "#55f0df" },
    { id: "solar", name: "Solar Fire", filter: "brightness(1.05) contrast(1.12) saturate(1.3) sepia(.22) hue-rotate(-14deg)", accent: "#ff9c55" },
    { id: "moonlight", name: "Blue Moonlight", filter: "brightness(.94) contrast(1.1) saturate(.92) hue-rotate(18deg)", accent: "#80a8ff" },
    { id: "emerald", name: "Emerald Cosmos", filter: "brightness(1.02) contrast(1.1) saturate(1.2) hue-rotate(35deg)", accent: "#59e9a9" },
    { id: "vintage", name: "Vintage Film", filter: "brightness(.98) contrast(1.08) saturate(.78) sepia(.3)", accent: "#e0ba78" },
    { id: "pastel", name: "Pastel Dream", filter: "brightness(1.08) contrast(.92) saturate(.9) sepia(.08)", accent: "#efafe7" },
    { id: "mono", name: "Monochrome Pro", filter: "grayscale(1) contrast(1.16) brightness(1.02)", accent: "#e5e9f2" },
    { id: "punch", name: "High Contrast Social", filter: "brightness(1.04) contrast(1.24) saturate(1.3)", accent: "#ffe56b" }
  ]);
  const DEFAULT_STATE = Object.freeze({
    presetId: "youtube",
    template: {
      ...PRESETS[0], format: "mp4", bitrate: 8_000_000,
      colorPreset: "auto", colorIntensity: 100, imageMotion: "kenburns",
      effectOpacity: 90, effectMode: "random", musicMode: "shuffle",
      musicVolume: 70, musicFade: .5, musicPitch: 0,
      bassGain: 0, midGain: 0, trebleGain: 0,
      bassFrequency: 120, midFrequency: 1000, trebleFrequency: 8000,
      renderEngine: "auto", renderProfile: "balanced"
    },
    rows: [],
    jobs: [],
    autoDownload: false,
    saveToMediaPool: true,
    outputDirectoryName: ""
  });

  let root = null;
  let controller = null;
  let state = null;
  let assets = [];
  let outputUrls = new Map();
  let running = false;
  let cancelRequested = false;
  let recorder = null;
  let frameId = 0;
  let outputDirectoryHandle = null;
  let gpuStatus = { state: "checking", label: "Đang nhận diện GPU", vendor: "" };

  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const formatBytes = (value) => {
    let size = Math.max(0, Number(value) || 0);
    for (const unit of ["B", "KB", "MB", "GB"]) {
      if (size < 1024 || unit === "GB") return `${size.toFixed(unit === "B" ? 0 : 1)} ${unit}`;
      size /= 1024;
    }
    return "0 B";
  };
  const ownerId = () => {
    const runtime = window.HHAuthz?.currentUser?.();
    let user = runtime;
    if (!user) {
      try { user = JSON.parse(localStorage.getItem("hh-auth-user") || "null"); } catch { user = null; }
    }
    return String(user?.id || user?._id || "guest").replace(/[^a-z0-9_-]/gi, "").slice(0, 80) || "guest";
  };
  const privateKey = (base = STORAGE_KEY) => `${base}:${ownerId()}`;

  state = loadState();

  function normalizeTemplate(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      id: String(source.id || "custom").slice(0, 40),
      name: String(source.name || "Sườn tùy chỉnh").slice(0, 100),
      width: source.width === undefined ? 1920 : clamp(source.width, 320, 3840),
      height: source.height === undefined ? 1080 : clamp(source.height, 320, 3840),
      duration: source.duration === undefined ? 3600 : clamp(source.duration, 1, MAX_DURATION),
      fps: [24, 25, 30, 50, 60].includes(Number(source.fps)) ? Number(source.fps) : 30,
      accent: /^#[\da-f]{6}$/i.test(source.accent) ? source.accent : "#6be8ff",
      background: /^#[\da-f]{6}$/i.test(source.background) ? source.background : "#071020",
      layout: ["left", "center"].includes(source.layout) ? source.layout : "left",
      motion: ["cinematic", "pulse", "orbit", "drift", "slide", "none"].includes(source.motion) ? source.motion : "cinematic",
      format: source.format === "mov" ? "mov" : "mp4",
      bitrate: source.bitrate === undefined ? 8_000_000 : clamp(source.bitrate, 1_000_000, 80_000_000)
      ,
      colorPreset: COLOR_PRESETS.some((item) => item.id === source.colorPreset) ? source.colorPreset : "auto",
      colorIntensity: source.colorIntensity === undefined ? 100 : clamp(source.colorIntensity, 0, 100),
      imageMotion: ["kenburns", "zoom", "pan", "float", "none"].includes(source.imageMotion) ? source.imageMotion : "kenburns",
      effectOpacity: source.effectOpacity === undefined ? 90 : clamp(source.effectOpacity, 0, 100),
      effectMode: ["random", "shuffle", "none"].includes(source.effectMode) ? source.effectMode : "random",
      musicMode: ["random", "shuffle", "none"].includes(source.musicMode) ? source.musicMode : "shuffle",
      musicVolume: source.musicVolume === undefined ? 70 : clamp(source.musicVolume, 0, 100),
      musicFade: source.musicFade === undefined ? .5 : clamp(source.musicFade, 0, 5),
      musicPitch: source.musicPitch === undefined ? 0 : clamp(source.musicPitch, -12, 12),
      bassGain: source.bassGain === undefined ? 0 : clamp(source.bassGain, -12, 12),
      midGain: source.midGain === undefined ? 0 : clamp(source.midGain, -12, 12),
      trebleGain: source.trebleGain === undefined ? 0 : clamp(source.trebleGain, -12, 12),
      bassFrequency: source.bassFrequency === undefined ? 120 : clamp(source.bassFrequency, 40, 500),
      midFrequency: source.midFrequency === undefined ? 1000 : clamp(source.midFrequency, 250, 5000),
      trebleFrequency: source.trebleFrequency === undefined ? 8000 : clamp(source.trebleFrequency, 2000, 16000),
      renderEngine: ["auto", "gpu", "compatibility"].includes(source.renderEngine) ? source.renderEngine : "auto",
      renderProfile: ["fast", "balanced", "high", "cinematic"].includes(source.renderProfile) ? source.renderProfile : "balanced"
    };
  }

  function normalizeRow(value, index = 0) {
    const source = value && typeof value === "object" ? value : {};
    return {
      id: String(source.id || uid("row")).slice(0, 100),
      order: Math.max(0, Number(source.order ?? index)),
      title: String(source.title || `Video ${index + 1}`).slice(0, 180),
      subtitle: String(source.subtitle || "").slice(0, 300),
      cta: String(source.cta || "").slice(0, 120),
      accent: /^#[\da-f]{6}$/i.test(source.accent) ? source.accent : "",
      sourceId: String(source.sourceId || "").slice(0, 120),
      sourceName: String(source.sourceName || "").slice(0, 240),
      colorPreset: COLOR_PRESETS.some((item) => item.id === source.colorPreset) ? source.colorPreset : "",
      suggestedColor: COLOR_PRESETS.some((item) => item.id === source.suggestedColor) ? source.suggestedColor : "natural",
      duration: source.duration ? clamp(source.duration, 1, MAX_DURATION) : 0
    };
  }

  function normalizeJob(value) {
    const source = value && typeof value === "object" ? value : {};
    const status = ["queued", "processing", "completed", "failed", "cancelled"].includes(source.status) ? source.status : "queued";
    return {
      id: String(source.id || uid("job")).slice(0, 100),
      rowId: String(source.rowId || "").slice(0, 100),
      title: String(source.title || "Video").slice(0, 180),
      status: status === "processing" ? "queued" : status,
      progress: status === "completed" ? 100 : clamp(source.progress, 0, 100),
      outputAssetId: String(source.outputAssetId || "").slice(0, 120),
      outputName: String(source.outputName || "").slice(0, 240),
      outputSize: Math.max(0, Number(source.outputSize || 0)),
      outputMime: String(source.outputMime || "").slice(0, 120),
      musicId: String(source.musicId || "").slice(0, 120),
      effectId: String(source.effectId || "").slice(0, 120),
      error: String(source.error || "").slice(0, 300),
      createdAt: source.createdAt || new Date().toISOString(),
      completedAt: source.completedAt || null
    };
  }

  function normalizeState(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      ...DEFAULT_STATE,
      ...source,
      outputDirectoryName: String(source.outputDirectoryName || "").slice(0, 160),
      template: normalizeTemplate(source.template || DEFAULT_STATE.template),
      rows: Array.isArray(source.rows) ? source.rows.slice(0, MAX_ROWS).map(normalizeRow) : [],
      jobs: Array.isArray(source.jobs) ? source.jobs.slice(0, MAX_ROWS * 2).map(normalizeJob) : []
    };
  }

  function loadState() {
    try {
      const current = localStorage.getItem(privateKey());
      const legacy = current ? null : localStorage.getItem(privateKey(LEGACY_STORAGE_KEY));
      if (legacy) localStorage.setItem(privateKey(), legacy);
      return normalizeState(JSON.parse(current || legacy || "null"));
    }
    catch { return normalizeState(null); }
  }

  function saveState() {
    try { localStorage.setItem(privateKey(), JSON.stringify(state)); } catch {}
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error("Trình duyệt không hỗ trợ IndexedDB."));
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Không mở được Media Pool."));
    });
  }

  async function dbAll() {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const request = db.transaction(DB_STORE, "readonly").objectStore(DB_STORE).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  }

  async function dbPut(item) {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(DB_STORE, "readwrite");
        transaction.objectStore(DB_STORE).put(item);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
    } finally { db.close(); }
  }

  async function dbDelete(id) {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(DB_STORE, "readwrite");
        transaction.objectStore(DB_STORE).delete(id);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
    } finally { db.close(); }
  }

  async function replaceAssetSource(source) {
    const existing = (await dbAll().catch(() => [])).filter((item) => item.ownerId === ownerId() && item.source === source);
    await Promise.all(existing.map((item) => dbDelete(item.id)));
  }

  async function refreshAssets() {
    const all = await dbAll().catch(() => []);
    assets = all.filter((item) => item.ownerId === ownerId() && (
      item.source === "batch-video-input" || item.source === "batch-video-music"
      || item.source === "batch-video-effect" || item.source === "batch-video-output"
    ));
    outputUrls.forEach((url) => URL.revokeObjectURL(url));
    outputUrls.clear();
    assets.filter((item) => item.source === "batch-video-output" && item.file instanceof Blob).forEach((item) => {
      outputUrls.set(item.id, URL.createObjectURL(item.file));
    });
  }

  function capabilities() {
    const capture = Boolean(window.HTMLCanvasElement?.prototype?.captureStream);
    const recorderReady = Boolean(window.MediaRecorder && capture);
    const supported = (candidates) => candidates.find((mime) => (
      !window.MediaRecorder?.isTypeSupported || window.MediaRecorder.isTypeSupported(mime)
    )) || "";
    const helperValue = window.HHVideoExport?.resolveRecorderMime?.('video/mp4;codecs="avc1.424028,mp4a.40.2"');
    const helperMp4 = typeof helperValue === "string" ? helperValue : helperValue?.mime || "";
    const mp4Mime = helperMp4.startsWith("video/mp4") ? helperMp4 : supported([
      'video/mp4;codecs="avc1.424028,mp4a.40.2"',
      'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
      "video/mp4"
    ]);
    const movMime = supported([
      'video/quicktime;codecs="avc1.424028,mp4a.40.2"',
      "video/quicktime"
    ]);
    return {
      capture, recorderReady, mp4Mime, movMime,
      indexedDb: Boolean(window.indexedDB),
      audio: Boolean(window.AudioContext || window.webkitAudioContext),
      folderInput: "webkitdirectory" in document.createElement("input"),
      outputDirectory: typeof window.showDirectoryPicker === "function",
      gpu: gpuStatus
    };
  }

  async function detectGpu() {
    if (!navigator.gpu?.requestAdapter) {
      gpuStatus = { state: "fallback", label: "WebGPU không hỗ trợ · dùng Canvas/codec trình duyệt", vendor: "" };
      return gpuStatus;
    }
    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
      if (!adapter) throw new Error("Không có adapter");
      const info = adapter.info || {};
      const raw = [info.vendor, info.architecture, info.device, info.description].filter(Boolean).join(" ");
      gpuStatus = {
        state: "ready",
        label: raw ? `GPU hiệu năng cao: ${raw}` : "GPU hiệu năng cao đã được trình duyệt cấp",
        vendor: raw
      };
    } catch {
      gpuStatus = { state: "fallback", label: "Không nhận được WebGPU · dùng Canvas/codec trình duyệt", vendor: "" };
    }
    return gpuStatus;
  }

  function status(message, kind = "info") {
    const node = root?.querySelector("[data-bvf-status]");
    if (!node) return;
    node.textContent = message;
    node.dataset.state = kind;
  }

  function sourceAssets() {
    return assets.filter((item) => item.source === "batch-video-input");
  }

  function musicAssets() {
    return assets.filter((item) => item.source === "batch-video-music");
  }

  function effectAssets() {
    return assets.filter((item) => item.source === "batch-video-effect");
  }

  function colorOptions(selected = "") {
    return COLOR_PRESETS.map((item) => `<option value="${item.id}" ${selected === item.id ? "selected" : ""}>${esc(item.name)}</option>`).join("");
  }

  function inputOptions(selected = "") {
    return `<option value="">Nền vũ trụ của sườn</option>${sourceAssets().map((item) => (
      `<option value="${esc(item.id)}" ${item.id === selected ? "selected" : ""}>${esc(item.name)} · ${formatBytes(item.size)}</option>`
    )).join("")}`;
  }

  function templateMarkup() {
    const template = state.template;
    return `<section class="bvf-panel bvf-template">
      <header><div><small>MASTER TEMPLATE</small><h3>Sườn video dùng chung</h3></div><span>${template.width}×${template.height} · ${template.fps} FPS</span></header>
      <div class="bvf-preset-grid">${PRESETS.map((preset) => `<button type="button" data-bvf-preset="${preset.id}" class="${state.presetId === preset.id ? "is-active" : ""}"><i style="--preset:${preset.accent}"></i><strong>${esc(preset.name)}</strong><small>${preset.width}×${preset.height}</small></button>`).join("")}</div>
      <div class="bvf-fields">
        <label>Tên sườn<input data-bvf-template="name" value="${esc(template.name)}" maxlength="100"></label>
        <label>Độ phân giải<select data-bvf-resolution><option value="1920x1080" ${template.width === 1920 && template.height === 1080 ? "selected" : ""}>Full HD · 1920×1080</option><option value="2560x1440" ${template.width === 2560 && template.height === 1440 ? "selected" : ""}>2K · 2560×1440</option><option value="3840x2160" ${template.width === 3840 && template.height === 2160 ? "selected" : ""}>4K · 3840×2160</option><option value="1280x720" ${template.width === 1280 && template.height === 720 ? "selected" : ""}>HD · 1280×720</option><option value="1080x1920" ${template.width === 1080 && template.height === 1920 ? "selected" : ""}>Full HD dọc · 1080×1920</option><option value="1440x2560" ${template.width === 1440 && template.height === 2560 ? "selected" : ""}>2K dọc · 1440×2560</option><option value="2160x3840" ${template.width === 2160 && template.height === 3840 ? "selected" : ""}>4K dọc · 2160×3840</option><option value="1080x1080" ${template.width === 1080 && template.height === 1080 ? "selected" : ""}>Vuông · 1080×1080</option></select></label>
        <label>Thời lượng mặc định (phút)<input type="number" min="1" max="720" step="1" data-bvf-duration-minutes value="${Math.round(template.duration / 60)}"></label>
        <label>FPS<select data-bvf-template="fps">${[24,25,30,50,60].map((fps) => `<option ${template.fps === fps ? "selected" : ""}>${fps}</option>`).join("")}</select></label>
        <label>Định dạng<select data-bvf-template="format"><option value="mp4" ${template.format === "mp4" ? "selected" : ""}>MP4 H.264 · YouTube</option><option value="mov" ${template.format === "mov" ? "selected" : ""}>MOV H.264 · nếu trình duyệt hỗ trợ</option></select></label>
        <label>Bitrate<select data-bvf-template="bitrate">${[[8_000_000,"8 Mbps"],[12_000_000,"12 Mbps"],[20_000_000,"20 Mbps"],[35_000_000,"35 Mbps · 2K"],[60_000_000,"60 Mbps · 4K"],[80_000_000,"80 Mbps · 4K cao"]].map(([value,label]) => `<option value="${value}" ${template.bitrate === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
        <label>Hồ sơ render<select data-bvf-render-profile>${[["fast","Nhanh"],["balanced","Cân bằng"],["high","Chất lượng cao"],["cinematic","Điện ảnh"]].map(([value,label]) => `<option value="${value}" ${template.renderProfile === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
        <label>Engine<select data-bvf-template="renderEngine"><option value="auto" ${template.renderEngine === "auto" ? "selected" : ""}>Tự động · ưu tiên GPU</option><option value="gpu" ${template.renderEngine === "gpu" ? "selected" : ""}>GPU hiệu năng cao</option><option value="compatibility" ${template.renderEngine === "compatibility" ? "selected" : ""}>Tương thích</option></select></label>
        <label>Màu nền<input type="color" data-bvf-template="background" value="${template.background}"></label>
        <label>Màu tín hiệu<input type="color" data-bvf-template="accent" value="${template.accent}"></label>
        <label>Kiểu chuyển động<select data-bvf-template="motion">${["cinematic","pulse","orbit","drift","slide","none"].map((value) => `<option value="${value}" ${template.motion === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
        <label>Chuyển động ảnh<select data-bvf-template="imageMotion"><option value="kenburns" ${template.imageMotion === "kenburns" ? "selected" : ""}>Ken Burns</option><option value="zoom" ${template.imageMotion === "zoom" ? "selected" : ""}>Zoom pulse</option><option value="pan" ${template.imageMotion === "pan" ? "selected" : ""}>Pan ngang</option><option value="float" ${template.imageMotion === "float" ? "selected" : ""}>Float</option><option value="none" ${template.imageMotion === "none" ? "selected" : ""}>Tĩnh</option></select></label>
        <label>Phong cách màu<select data-bvf-template="colorPreset">${colorOptions(template.colorPreset)}</select></label>
        <label>Cường độ màu ${template.colorIntensity}%<input type="range" min="0" max="100" data-bvf-template="colorIntensity" value="${template.colorIntensity}"></label>
        <label>Overlay Screen ${template.effectOpacity}%<input type="range" min="0" max="100" data-bvf-template="effectOpacity" value="${template.effectOpacity}"></label>
        <label>Chọn hiệu ứng<select data-bvf-template="effectMode"><option value="random" ${template.effectMode === "random" ? "selected" : ""}>Ngẫu nhiên</option><option value="shuffle" ${template.effectMode === "shuffle" ? "selected" : ""}>Trộn không lặp</option><option value="none" ${template.effectMode === "none" ? "selected" : ""}>Tắt</option></select></label>
        <label>Chọn nhạc<select data-bvf-template="musicMode"><option value="random" ${template.musicMode === "random" ? "selected" : ""}>Ngẫu nhiên</option><option value="shuffle" ${template.musicMode === "shuffle" ? "selected" : ""}>Trộn không lặp</option><option value="none" ${template.musicMode === "none" ? "selected" : ""}>Tắt</option></select></label>
        <label>Âm lượng nhạc ${template.musicVolume}%<input type="range" min="0" max="100" data-bvf-template="musicVolume" value="${template.musicVolume}"></label>
        <label>Fade nhạc<input type="number" min="0" max="5" step=".1" data-bvf-template="musicFade" value="${template.musicFade}"></label>
        <label>Độ cao nhạc ${template.musicPitch > 0 ? "+" : ""}${template.musicPitch} bán âm<input type="range" min="-12" max="12" step="1" data-bvf-template="musicPitch" value="${template.musicPitch}"></label>
        <label>Bass ${template.bassGain > 0 ? "+" : ""}${template.bassGain} dB<input type="range" min="-12" max="12" step="1" data-bvf-template="bassGain" value="${template.bassGain}"></label>
        <label>Tần số Bass ${template.bassFrequency} Hz<input type="range" min="40" max="500" step="10" data-bvf-template="bassFrequency" value="${template.bassFrequency}"></label>
        <label>Mid ${template.midGain > 0 ? "+" : ""}${template.midGain} dB<input type="range" min="-12" max="12" step="1" data-bvf-template="midGain" value="${template.midGain}"></label>
        <label>Tần số Mid ${template.midFrequency} Hz<input type="range" min="250" max="5000" step="50" data-bvf-template="midFrequency" value="${template.midFrequency}"></label>
        <label>Treble ${template.trebleGain > 0 ? "+" : ""}${template.trebleGain} dB<input type="range" min="-12" max="12" step="1" data-bvf-template="trebleGain" value="${template.trebleGain}"></label>
        <label>Tần số Treble ${template.trebleFrequency} Hz<input type="range" min="2000" max="16000" step="250" data-bvf-template="trebleFrequency" value="${template.trebleFrequency}"></label>
      </div>
      <div class="bvf-action-row"><button data-bvf-action="export-template">Xuất sườn JSON</button><label class="bvf-file">Nhập sườn JSON<input type="file" accept=".json,application/json" data-bvf-template-file></label><button data-bvf-action="preview">Cập nhật preview</button></div>
      <div class="bvf-output-options">
        <label><input type="checkbox" data-bvf-option="saveToMediaPool" ${state.saveToMediaPool ? "checked" : ""}> Lưu file xuất vào Media Pool</label>
        <label><input type="checkbox" data-bvf-option="autoDownload" ${state.autoDownload ? "checked" : ""}> Tự tải từng file sau khi render</label>
        <button type="button" data-bvf-action="select-output-folder">Chọn thư mục lưu</button>
        <span data-bvf-output-folder>${esc(state.outputDirectoryName || "Chưa chọn · lưu Media Pool/tải xuống")}</span>
      </div>
      <p class="bvf-honesty">Đầu ra chỉ gồm hình/video, nhạc và hiệu ứng đã chọn — không chèn chữ, logo hay watermark. GPU dùng WebGL2 cho scale, color grade và Screen effect; trình duyệt tự quyết định encoder phần cứng. Với video dài, hãy chọn thư mục lưu để ghi từng phần trực tiếp và tránh giữ toàn bộ file trong RAM.</p>
    </section>`;
  }

  function dataMarkup() {
    return `<section class="bvf-panel bvf-data">
      <header><div><small>DATA MERGE · ${state.rows.length}/${MAX_ROWS}</small><h3>Danh sách video cần tạo</h3></div><span>Mỗi dòng → một video</span></header>
      <div class="bvf-import-bar">
        <label class="bvf-file is-folder">Chọn folder ảnh · mỗi ảnh 1 video<input type="file" multiple webkitdirectory directory accept="image/*" data-bvf-image-folder></label>
        <label class="bvf-file">Thêm ảnh/video lẻ<input type="file" multiple accept="image/*,video/mp4,video/webm,video/quicktime" data-bvf-assets></label>
        <label class="bvf-file is-folder">Chọn folder nhạc<input type="file" multiple webkitdirectory directory accept="audio/*" data-bvf-music-folder></label>
        <label class="bvf-file is-folder">Chọn folder hiệu ứng Screen<input type="file" multiple webkitdirectory directory accept="image/*,video/*" data-bvf-effect-folder></label>
        <label class="bvf-file">Nhập CSV/JSON<input type="file" accept=".csv,.json,text/csv,application/json" data-bvf-data-file></label>
        <button data-bvf-action="sample-csv">Tải CSV mẫu</button>
        <button data-bvf-action="add-row">+ Thêm dòng</button>
      </div>
      <div class="bvf-folder-summary"><span>${sourceAssets().length} ảnh/video</span><span>${musicAssets().length} bản nhạc</span><span>${effectAssets().length} hiệu ứng Screen</span></div>
      <div class="bvf-table-wrap"><table><thead><tr><th>#</th><th>Media</th><th>Thời lượng (phút)</th><th>Màu</th><th></th></tr></thead><tbody>${state.rows.length ? state.rows.map((row, index) => `<tr data-bvf-row="${esc(row.id)}">
        <td>${index + 1}</td>
        <td><select data-bvf-row-field="sourceId">${inputOptions(row.sourceId)}</select></td>
        <td><input type="number" min="1" max="720" placeholder="${Math.round(state.template.duration / 60)}" data-bvf-row-duration-minutes value="${row.duration ? Math.round(row.duration / 60) : ""}"></td>
        <td><select data-bvf-row-field="colorPreset"><option value="">Theo sườn</option>${colorOptions(row.colorPreset)}</select></td>
        <td><button data-bvf-remove-row="${esc(row.id)}" aria-label="Xóa dòng">×</button></td>
      </tr>`).join("") : `<tr><td colspan="5"><p>Chưa có dữ liệu. Chọn folder ảnh để tự tạo một video cho mỗi ảnh.</p></td></tr>`}</tbody></table></div>
      <p class="bvf-honesty">Tên file nguồn chỉ dùng để đặt tên file xuất, không được vẽ lên khung hình. Mỗi ảnh tạo một video độc lập với thời lượng, màu và nhạc đã chọn.</p>
    </section>`;
  }

  function queueMarkup() {
    const completed = state.jobs.filter((item) => item.status === "completed").length;
    const failed = state.jobs.filter((item) => item.status === "failed").length;
    return `<section class="bvf-panel bvf-queue">
      <header><div><small>RENDER QUEUE · ${completed} XONG · ${failed} LỖI</small><h3>Hàng đợi kết xuất</h3></div><span>${running ? "Đang chạy" : "Sẵn sàng"}</span></header>
      <div class="bvf-preflight" data-bvf-preflight></div>
      <div class="bvf-queue-actions"><button data-bvf-action="build-queue">Tạo lại hàng đợi</button><button class="is-primary" data-bvf-action="render-all" ${running ? "disabled" : ""}>Render tất cả</button><button data-bvf-action="cancel" ${running ? "" : "disabled"}>Dừng sau job hiện tại</button><button data-bvf-action="download-all" ${completed ? "" : "disabled"}>Tải tất cả file xong</button></div>
      <div class="bvf-job-list">${state.jobs.length ? state.jobs.map((job) => {
        const url = outputUrls.get(job.outputAssetId);
        const musicName = musicAssets().find((item) => item.id === job.musicId)?.name || "Không nhạc";
        const effectName = effectAssets().find((item) => item.id === job.effectId)?.name || "Không effect";
        return `<article class="is-${job.status}" data-bvf-job="${esc(job.id)}"><i>${job.status === "completed" ? "✓" : job.status === "failed" ? "!" : job.status === "processing" ? "●" : "○"}</i><div><strong>${esc(job.title)}</strong><small>${esc(job.error || job.outputName || `${job.status} · ♫ ${musicName} · FX ${effectName}`)}${job.outputSize ? ` · ${formatBytes(job.outputSize)}` : ""}</small><span><b style="width:${job.progress}%"></b></span></div><em>${Math.round(job.progress)}%</em>${url ? `<a href="${esc(url)}" download="${esc(job.outputName)}">Tải</a>` : job.status === "failed" || job.status === "cancelled" ? `<button data-bvf-retry="${esc(job.id)}">Thử lại</button>` : ""}</article>`;
      }).join("") : "<p>Chưa có hàng đợi. Mỗi dòng dữ liệu sẽ trở thành một job.</p>"}</div>
    </section>`;
  }

  function render() {
    if (!root) return;
    const caps = capabilities();
    root.innerHTML = `<section class="bvf-shell">
      <header class="bvf-hero"><div class="bvf-core"><b>H</b><i></i></div><div><small>TOOL · BATCH VIDEO FACTORY</small><h2>Video sạch, sẵn sàng tải lên YouTube</h2><p>Mỗi ảnh thành một video MP4/MOV không chữ, không logo, không watermark; mặc định 60 phút và hỗ trợ Full HD, 2K, 4K.</p></div><aside><span class="is-${caps.recorderReady && caps.mp4Mime ? "ready" : "unsupported"}">${caps.recorderReady && caps.mp4Mime ? "MP4 sẵn sàng" : "Thiếu encoder MP4"}</span><small>${esc(caps.gpu.label)} · ${caps.movMime ? "MP4 + MOV" : "MP4"}</small></aside></header>
      <section class="bvf-live"><article><span>ẢNH/VIDEO</span><strong>${sourceAssets().length}</strong></article><article><span>NHẠC</span><strong>${musicAssets().length}</strong></article><article><span>SCREEN FX</span><strong>${effectAssets().length}</strong></article><article><span>THỜI LƯỢNG ƯỚC TÍNH</span><strong>${Math.ceil(state.rows.reduce((sum,row) => sum + (row.duration || state.template.duration), 0) / 60)} phút</strong></article><article><span>THƯ MỤC LƯU</span><strong>${esc(state.outputDirectoryName || "Media Pool")}</strong></article></section>
      <div class="bvf-layout"><main>${templateMarkup()}${dataMarkup()}</main><aside><section class="bvf-panel bvf-preview"><header><div><small>LIVE PREVIEW</small><h3>Khung đầu ra sạch</h3></div><span>Không logo/chữ</span></header><canvas data-bvf-canvas width="${state.template.width}" height="${state.template.height}"></canvas><p>Preview chỉ gồm media, chuyển động, color grade và Screen effect đã chọn.</p></section>${queueMarkup()}</aside></div>
      <footer><span data-bvf-status role="status" aria-live="polite">Sẵn sàng · file nguồn và kết quả nằm trong Media Pool của thiết bị này.</span><span>Render trình duyệt chạy theo thời lượng thật; tab cần được giữ hoạt động.</span></footer>
    </section>`;
    drawPreview();
    renderPreflight();
  }

  function drawCover(ctx, media, width, height, scale = 1) {
    const sourceWidth = media.videoWidth || media.naturalWidth || width;
    const sourceHeight = media.videoHeight || media.naturalHeight || height;
    const ratio = Math.max(width / sourceWidth, height / sourceHeight) * scale;
    const drawWidth = sourceWidth * ratio;
    const drawHeight = sourceHeight * ratio;
    ctx.drawImage(media, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  }

  function resolvedColorPreset(row) {
    const requested = row?.colorPreset || state.template.colorPreset;
    if (requested !== "auto") return COLOR_PRESETS.find((item) => item.id === requested) || COLOR_PRESETS[1];
    const suggested = row?.suggestedColor || "natural";
    return COLOR_PRESETS.find((item) => item.id === suggested) || COLOR_PRESETS[1];
  }

  function colorFilter(row) {
    const preset = resolvedColorPreset(row);
    if (state.template.colorIntensity >= 99) return preset.filter;
    if (state.template.colorIntensity <= 1) return "none";
    const strength = state.template.colorIntensity / 100;
    return `${preset.filter} opacity(${.72 + strength * .28})`;
  }

  function imageMotion(progress) {
    const mode = state.template.imageMotion;
    if (mode === "kenburns") return { scale: 1.02 + progress * .1, x: (progress - .5) * -.035, y: (progress - .5) * -.018 };
    if (mode === "zoom") return { scale: 1.03 + Math.sin(progress * Math.PI) * .08, x: 0, y: 0 };
    if (mode === "pan") return { scale: 1.09, x: (progress - .5) * .09, y: 0 };
    if (mode === "float") return { scale: 1.05, x: Math.sin(progress * Math.PI * 2) * .018, y: Math.cos(progress * Math.PI * 2) * .018 };
    return { scale: 1, x: 0, y: 0 };
  }

  function colorParameters(row) {
    const id = resolvedColorPreset(row).id;
    return ({
      natural: [1.02, 1.04, 1.05, 1, 1, 1],
      cinematic: [.99, 1.14, 1.2, 1.08, .98, .9],
      neon: [1.05, 1.17, 1.45, 1.04, .95, 1.12],
      aurora: [1.04, 1.08, 1.26, .9, 1.08, 1.1],
      solar: [1.05, 1.12, 1.3, 1.12, 1.02, .86],
      moonlight: [.95, 1.1, .92, .85, .95, 1.15],
      emerald: [1.02, 1.1, 1.2, .88, 1.12, .96],
      vintage: [.98, 1.08, .78, 1.08, 1.01, .84],
      pastel: [1.08, .92, .9, 1.05, .98, 1.05],
      mono: [1.02, 1.16, 0, 1, 1, 1],
      punch: [1.04, 1.24, 1.3, 1, 1, 1]
    })[id] || [1.02, 1.04, 1.05, 1, 1, 1];
  }

  function createGpuCompositor(width, height) {
    const gpuCanvas = document.createElement("canvas");
    gpuCanvas.width = width; gpuCanvas.height = height;
    const gl = gpuCanvas.getContext("webgl2", {
      alpha: false, antialias: false, desynchronized: true,
      preserveDrawingBuffer: true, powerPreference: "high-performance"
    });
    if (!gl) return null;
    const vertexSource = `#version 300 es
      in vec2 a_position; out vec2 v_uv;
      void main(){ v_uv=(a_position+1.0)*0.5; gl_Position=vec4(a_position,0.0,1.0); }`;
    const fragmentSource = `#version 300 es
      precision highp float; in vec2 v_uv; out vec4 outColor;
      uniform sampler2D u_source; uniform sampler2D u_effect;
      uniform vec2 u_uvScale; uniform vec2 u_uvOffset;
      uniform vec3 u_tint; uniform vec3 u_grade;
      uniform float u_effectOpacity; uniform bool u_hasEffect;
      void main(){
        vec2 uv=(v_uv-.5)*u_uvScale+.5+u_uvOffset;
        vec3 color=texture(u_source,clamp(uv,0.0,1.0)).rgb;
        float light=dot(color,vec3(.299,.587,.114));
        color=mix(vec3(light),color,u_grade.z);
        color=(color-.5)*u_grade.y+.5;
        color=clamp(color*u_grade.x*u_tint,0.0,1.0);
        if(u_hasEffect){
          vec3 fx=texture(u_effect,v_uv).rgb;
          vec3 screened=1.0-(1.0-color)*(1.0-fx);
          color=mix(color,screened,u_effectOpacity);
        }
        outColor=vec4(color,1.0);
      }`;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    try {
      const program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      const makeTexture = (unit) => {
        const texture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return texture;
      };
      const sourceTexture = makeTexture(0);
      const effectTexture = makeTexture(1);
      gl.uniform1i(gl.getUniformLocation(program, "u_source"), 0);
      gl.uniform1i(gl.getUniformLocation(program, "u_effect"), 1);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      return {
        canvas: gpuCanvas,
        draw(source, effect, progress, row) {
          if (!source) return null;
          const sourceWidth = source.videoWidth || source.naturalWidth || width;
          const sourceHeight = source.videoHeight || source.naturalHeight || height;
          const sourceAspect = sourceWidth / sourceHeight;
          const targetAspect = width / height;
          const movement = imageMotion(progress);
          const uvScale = sourceAspect > targetAspect
            ? [targetAspect / sourceAspect / movement.scale, 1 / movement.scale]
            : [1 / movement.scale, sourceAspect / targetAspect / movement.scale];
          const params = colorParameters(row);
          const strength = state.template.colorIntensity / 100;
          const grade = [1 + (params[0] - 1) * strength, 1 + (params[1] - 1) * strength, 1 + (params[2] - 1) * strength];
          const tint = [1 + (params[3] - 1) * strength, 1 + (params[4] - 1) * strength, 1 + (params[5] - 1) * strength];
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
          let hasEffect = false;
          if (effect) {
            gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, effectTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, effect);
            hasEffect = true;
          }
          gl.uniform2f(gl.getUniformLocation(program, "u_uvScale"), uvScale[0], uvScale[1]);
          gl.uniform2f(gl.getUniformLocation(program, "u_uvOffset"), movement.x, -movement.y);
          gl.uniform3fv(gl.getUniformLocation(program, "u_grade"), grade);
          gl.uniform3fv(gl.getUniformLocation(program, "u_tint"), tint);
          gl.uniform1f(gl.getUniformLocation(program, "u_effectOpacity"), state.template.effectOpacity / 100);
          gl.uniform1i(gl.getUniformLocation(program, "u_hasEffect"), hasEffect && state.template.effectMode !== "none" ? 1 : 0);
          gl.viewport(0, 0, width, height);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
          return gpuCanvas;
        },
        destroy() {
          gl.deleteTexture(sourceTexture); gl.deleteTexture(effectTexture);
          gl.deleteBuffer(buffer); gl.deleteProgram(program);
        }
      };
    } catch { return null; }
  }

  function drawFrame(canvas, row, progress = 0, media = null, effect = null, precomposited = false) {
    const ctx = canvas._bvfContext || (canvas._bvfContext = canvas.getContext("2d", {
      alpha: false, desynchronized: state.template.renderEngine !== "compatibility"
    }));
    const template = state.template;
    const width = canvas.width;
    const height = canvas.height;
    const accent = row?.accent || template.accent;
    const motion = template.motion;
    const drift = motion === "drift" || motion === "cinematic" ? 1 + progress * .035 : 1;
    ctx.clearRect(0, 0, width, height);
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, template.background);
    gradient.addColorStop(.58, "#10152f");
    gradient.addColorStop(1, accent);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    if (media) {
      const movement = precomposited ? { scale: 1, x: 0, y: 0 } : imageMotion(progress);
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.filter = precomposited ? "none" : colorFilter(row);
      ctx.translate(width * movement.x, height * movement.y);
      drawCover(ctx, media, width, height, movement.scale * (precomposited ? 1 : drift));
      ctx.restore();
    }
    if (!precomposited && effect && state.template.effectMode !== "none" && state.template.effectOpacity > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = state.template.effectOpacity / 100;
      drawCover(ctx, effect, width, height, 1.01);
      ctx.restore();
    }
  }

  async function mediaForAsset(assetId) {
    const asset = assets.find((item) => item.id === assetId && item.file instanceof Blob);
    if (!asset) return null;
    const url = URL.createObjectURL(asset.file);
    if (asset.type?.startsWith("image/")) {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error(`Không đọc được ảnh ${asset.name}.`));
        image.src = url;
      });
      return { element: image, url, type: "image" };
    }
    if (asset.type?.startsWith("audio/") || asset.source === "batch-video-music") {
      const audio = document.createElement("audio");
      audio.src = url;
      audio.preload = "auto";
      audio.loop = true;
      await new Promise((resolve, reject) => {
        audio.onloadeddata = resolve;
        audio.onerror = () => reject(new Error(`Không đọc được nhạc ${asset.name}.`));
        audio.load();
      });
      return { element: audio, url, type: "audio" };
    }
    const video = document.createElement("video");
    video.src = url;
    video.preload = "auto";
    video.playsInline = true;
    video.loop = true;
    await new Promise((resolve, reject) => {
      video.onloadeddata = resolve;
      video.onerror = () => reject(new Error(`Không đọc được video ${asset.name}.`));
      video.load();
    });
    return { element: video, url, type: "video" };
  }

  const mediaForRow = (row) => mediaForAsset(row.sourceId);

  function drawPreview() {
    const canvas = root?.querySelector("[data-bvf-canvas]");
    if (!canvas) return;
    canvas.width = state.template.width;
    canvas.height = state.template.height;
    const row = state.rows[0] || normalizeRow({ title: "preview" });
    drawFrame(canvas, row, .25);
    if (row.sourceId) {
      Promise.all([
        mediaForRow(row),
        state.template.effectMode === "none" ? Promise.resolve(null) : mediaForAsset(effectAssets()[0]?.id)
      ]).then(([media, effect]) => {
        if (!root?.isConnected || !media) return;
        drawFrame(canvas, row, .25, media.element, effect?.element || null);
        URL.revokeObjectURL(media.url);
        if (effect?.url) URL.revokeObjectURL(effect.url);
      }).catch(() => {});
    }
  }

  function preflight() {
    const caps = capabilities();
    const template = state.template;
    const requestedMov = template.format === "mov";
    const actualMime = requestedMov ? caps.movMime : caps.mp4Mime;
    const checks = [
      { label: "Canvas captureStream", pass: caps.capture, detail: caps.capture ? "Sẵn sàng" : "Thiết bị không hỗ trợ" },
      { label: "MediaRecorder", pass: caps.recorderReady, detail: caps.recorderReady ? "Sẵn sàng" : "Thiết bị không hỗ trợ" },
      { label: requestedMov ? "MOV H.264" : "MP4 H.264", pass: Boolean(actualMime), detail: actualMime || (requestedMov ? "Trình duyệt không có encoder MOV · hãy chọn MP4" : "Trình duyệt không có encoder MP4") },
      { label: "Dữ liệu đầu vào", pass: state.rows.length > 0, detail: `${state.rows.length} biến thể` },
      { label: "Media liên kết", pass: state.rows.every((row) => !row.sourceId || assets.some((asset) => asset.id === row.sourceId)), detail: "Asset thiếu sẽ chặn job tương ứng" },
      { label: "Nhạc nền", pass: state.template.musicMode === "none" || !musicAssets().length || caps.audio, detail: musicAssets().length ? `${musicAssets().length} bài · ${state.template.musicMode}` : "Không có nhạc · video sẽ không có nhạc nền" },
      { label: "GPU", pass: state.template.renderEngine !== "gpu" || caps.gpu.state === "ready", detail: caps.gpu.label },
      { label: "Thư mục đầu ra", pass: true, detail: outputDirectoryHandle ? `${state.outputDirectoryName} · ghi trực tiếp từng phần` : template.duration > 600 ? "Nên chọn thư mục cho video dài để tránh đầy RAM" : "Media Pool hoặc tải xuống" },
      { label: "Media Pool", pass: caps.indexedDb || !state.saveToMediaPool, detail: caps.indexedDb ? "Lưu file thật" : "Không hỗ trợ" }
    ];
    return { checks, ready: checks.every((item) => item.pass), mime: actualMime };
  }

  function renderPreflight() {
    const host = root?.querySelector("[data-bvf-preflight]");
    if (!host) return;
    const result = preflight();
    host.innerHTML = result.checks.map((item) => `<span class="${item.pass ? "is-ready" : "is-blocked"}"><i>${item.pass ? "✓" : "!"}</i><b>${esc(item.label)}</b><small>${esc(item.detail)}</small></span>`).join("");
  }

  function updateJob(job, patch) {
    Object.assign(job, patch);
    saveState();
    const row = root?.querySelector(`[data-bvf-job="${job.id}"]`);
    if (!row) return;
    row.className = `is-${job.status}`;
    row.querySelector("i").textContent = job.status === "completed" ? "✓" : job.status === "failed" ? "!" : job.status === "processing" ? "●" : "○";
    row.querySelector("em").textContent = `${Math.round(job.progress)}%`;
    row.querySelector("span b").style.width = `${job.progress}%`;
    const detail = row.querySelector("small");
    if (detail) detail.textContent = job.error || job.outputName || job.status;
  }

  function outputNameForJob(job, mime) {
    const extension = /^video\/quicktime/i.test(mime) ? "mov" : /^video\/mp4/i.test(mime) ? "mp4" : "";
    if (!extension) throw new Error("Encoder không trả về MP4/MOV hợp lệ. File không được lưu với đuôi giả.");
    const safeName = job.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "batch-video";
    return `${safeName}-${job.id.slice(-5)}.${extension}`;
  }

  async function openOutputSink(outputName) {
    if (!outputDirectoryHandle) return null;
    const permission = await outputDirectoryHandle.queryPermission?.({ mode: "readwrite" });
    const granted = permission === "granted" || await outputDirectoryHandle.requestPermission?.({ mode: "readwrite" }) === "granted";
    if (!granted) throw new Error("Trình duyệt chưa cho phép ghi vào thư mục đã chọn.");
    const fileHandle = await outputDirectoryHandle.getFileHandle(outputName, { create: true });
    return { fileHandle, writable: await fileHandle.createWritable() };
  }

  async function storeOutput(job, blob, mime, options = {}) {
    const outputName = options.outputName || outputNameForJob(job, mime);
    const file = options.file instanceof File ? options.file : new File([blob], outputName, { type: mime });
    const assetId = uid("batch-output");
    if (outputDirectoryHandle && !options.directWritten) {
      const sink = await openOutputSink(outputName);
      await sink.writable.write(file);
      await sink.writable.close();
    }
    if (state.saveToMediaPool) {
      await dbPut({
        id: assetId,
        ownerId: ownerId(),
        name: outputName,
        type: mime,
        size: file.size,
        duration: state.rows.find((item) => item.id === job.rowId)?.duration || state.template.duration,
        width: state.template.width,
        height: state.template.height,
        source: "batch-video-output",
        batchJobId: job.id,
        musicId: job.musicId,
        effectId: job.effectId,
        colorPreset: state.rows.find((item) => item.id === job.rowId)?.colorPreset || state.template.colorPreset,
        outputDirectory: state.outputDirectoryName || "",
        createdAt: new Date().toISOString(),
        file
      });
    }
    const url = URL.createObjectURL(file);
    outputUrls.set(assetId, url);
    window.dispatchEvent(new CustomEvent("hh:media-asset-created", { detail: { id: assetId, name: outputName, source: "batch-video-factory" } }));
    return { assetId, outputName, size: file.size, mime, url };
  }

  async function renderJob(job) {
    const row = state.rows.find((item) => item.id === job.rowId);
    if (!row) throw new Error("Dòng dữ liệu của job không còn tồn tại.");
    if (row.sourceId && !assets.some((asset) => asset.id === row.sourceId)) throw new Error("Asset nguồn bị thiếu hoặc đã bị xóa.");
    const caps = capabilities();
    const mime = state.template.format === "mov" ? caps.movMime : caps.mp4Mime;
    if (!caps.recorderReady || !mime) {
      throw new Error(state.template.format === "mov"
        ? "Trình duyệt này không có encoder MOV. Hãy chọn MP4 H.264."
        : "Trình duyệt này không có encoder MP4 H.264 tương thích.");
    }
    const jobDuration = row.duration || state.template.duration;
    const canvas = document.createElement("canvas");
    canvas.width = state.template.width;
    canvas.height = state.template.height;
    const gpuCompositor = state.template.renderEngine === "compatibility"
      ? null
      : createGpuCompositor(canvas.width, canvas.height);
    if (state.template.renderEngine === "gpu" && !gpuCompositor) throw new Error("Không tạo được WebGL2 high-performance context trên GPU.");
    const stream = canvas.captureStream(state.template.fps);
    const media = await mediaForRow(row);
    const effect = job.effectId ? await mediaForAsset(job.effectId) : null;
    const music = job.musicId ? await mediaForAsset(job.musicId) : null;
    let audioContext = null;
    let musicGain = null;
    if ((media?.type === "video" || music?.type === "audio") && (window.AudioContext || window.webkitAudioContext)) {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        await audioContext.resume();
        const destination = audioContext.createMediaStreamDestination();
        if (media?.type === "video") {
          const source = audioContext.createMediaElementSource(media.element);
          const originalGain = audioContext.createGain();
          originalGain.gain.value = music ? .18 : 1;
          source.connect(originalGain).connect(destination);
        }
        if (music?.type === "audio") {
          const musicSource = audioContext.createMediaElementSource(music.element);
          const bass = audioContext.createBiquadFilter();
          bass.type = "lowshelf";
          bass.frequency.value = state.template.bassFrequency;
          bass.gain.value = state.template.bassGain;
          const mid = audioContext.createBiquadFilter();
          mid.type = "peaking";
          mid.frequency.value = state.template.midFrequency;
          mid.Q.value = 1;
          mid.gain.value = state.template.midGain;
          const treble = audioContext.createBiquadFilter();
          treble.type = "highshelf";
          treble.frequency.value = state.template.trebleFrequency;
          treble.gain.value = state.template.trebleGain;
          musicGain = audioContext.createGain();
          musicGain.gain.value = state.template.musicVolume / 100;
          musicSource.connect(bass).connect(mid).connect(treble).connect(musicGain).connect(destination);
        }
        destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      } catch {}
    }
    const outputName = outputNameForJob(job, mime);
    const outputSink = await openOutputSink(outputName);
    const chunks = [];
    let writeChain = Promise.resolve();
    let directBytes = 0;
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: state.template.bitrate });
    recorder.ondataavailable = (event) => {
      if (!event.data?.size) return;
      if (outputSink) {
        directBytes += event.data.size;
        writeChain = writeChain.then(() => outputSink.writable.write(event.data));
      } else chunks.push(event.data);
    };
    const stopped = new Promise((resolve, reject) => {
      recorder.onstop = resolve;
      recorder.onerror = (event) => reject(event.error || new Error("MediaRecorder gặp lỗi."));
    });
    updateJob(job, { status: "processing", progress: 0, error: "" });
    cancelRequested = false;
    const startedAt = performance.now();
    recorder.start(500);
    if (media?.type === "video") {
      media.element.currentTime = 0;
      await media.element.play().catch(() => {});
    }
    if (effect?.type === "video") {
      effect.element.currentTime = 0;
      effect.element.muted = true;
      await effect.element.play().catch(() => {});
    }
    if (music?.type === "audio") {
      music.element.currentTime = 0;
      music.element.preservesPitch = false;
      music.element.playbackRate = Math.pow(2, state.template.musicPitch / 12);
      await music.element.play().catch(() => {});
      if (audioContext && musicGain && state.template.musicFade > 0) {
        const fade = Math.min(state.template.musicFade, jobDuration / 2);
        musicGain.gain.setValueAtTime(state.template.musicVolume / 100, audioContext.currentTime);
        musicGain.gain.setValueAtTime(state.template.musicVolume / 100, audioContext.currentTime + Math.max(0, jobDuration - fade));
        musicGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + jobDuration);
      }
    }
    let lastProgressUpdate = 0;
    await new Promise((resolve) => {
      const frame = (now) => {
        const elapsed = (now - startedAt) / 1000;
        const progress = Math.min(1, elapsed / jobDuration);
        const composed = gpuCompositor?.draw(media?.element || null, effect?.element || null, progress, row);
        drawFrame(
          canvas, row, progress,
          composed || media?.element || null,
          composed ? null : effect?.element || null,
          Boolean(composed)
        );
        if (now - lastProgressUpdate >= 500 || progress >= 1) {
          updateJob(job, { progress: progress * 100 });
          lastProgressUpdate = now;
        }
        if (progress >= 1 || cancelRequested) return resolve();
        frameId = requestAnimationFrame(frame);
      };
      frameId = requestAnimationFrame(frame);
    });
    if (media?.type === "video") media.element.pause();
    if (effect?.type === "video") effect.element.pause();
    if (music?.type === "audio") music.element.pause();
    if (recorder.state !== "inactive") recorder.stop();
    await stopped;
    await writeChain;
    stream.getTracks().forEach((track) => track.stop());
    if (audioContext) await audioContext.close().catch(() => {});
    if (media?.url) URL.revokeObjectURL(media.url);
    if (effect?.url) URL.revokeObjectURL(effect.url);
    if (music?.url) URL.revokeObjectURL(music.url);
    gpuCompositor?.destroy();
    recorder = null;
    if (cancelRequested) {
      if (outputSink) await outputSink.writable.abort().catch(() => {});
      throw Object.assign(new Error("Đã hủy theo yêu cầu."), { cancelled: true });
    }
    let blob;
    let directFile = null;
    if (outputSink) {
      await outputSink.writable.close();
      directFile = await outputSink.fileHandle.getFile();
      blob = directFile;
    } else blob = new Blob(chunks, { type: mime.split(";")[0] });
    if (!(blob.size || directBytes)) throw new Error("File kết quả rỗng.");
    const output = await storeOutput(job, blob, mime.split(";")[0], {
      outputName,
      file: directFile,
      directWritten: Boolean(outputSink)
    });
    updateJob(job, {
      status: "completed",
      progress: 100,
      outputAssetId: output.assetId,
      outputName: output.outputName,
      outputSize: output.size,
      outputMime: output.mime,
      completedAt: new Date().toISOString()
    });
    if (state.autoDownload) downloadUrl(output.url, output.outputName);
    window.dispatchEvent(new CustomEvent("hh:video-batch-status", { detail: { jobId: job.id, status: "completed", outputAssetId: output.assetId } }));
  }

  async function runQueue() {
    if (running) return;
    const check = preflight();
    if (!check.ready) return status("Preflight chưa đạt. Hãy xử lý các mục màu đỏ trước khi render.", "error");
    running = true;
    cancelRequested = false;
    render();
    status("Đang bắt đầu hàng đợi render tuần tự…", "success");
    for (const job of state.jobs.filter((item) => ["queued", "failed", "cancelled"].includes(item.status))) {
      if (cancelRequested) break;
      try {
        await renderJob(job);
      } catch (error) {
        updateJob(job, {
          status: error.cancelled ? "cancelled" : "failed",
          error: error.message,
          progress: error.cancelled ? job.progress : 0
        });
        window.dispatchEvent(new CustomEvent("hh:video-batch-status", { detail: { jobId: job.id, status: error.cancelled ? "cancelled" : "failed", message: error.message } }));
      }
    }
    running = false;
    cancelRequested = false;
    await refreshAssets();
    render();
    status(`Hàng đợi hoàn tất: ${state.jobs.filter((item) => item.status === "completed").length}/${state.jobs.length} video.`, "success");
  }

  function buildQueue() {
    const shuffledMusic = [...musicAssets()].sort(() => Math.random() - .5);
    const shuffledEffects = [...effectAssets()].sort(() => Math.random() - .5);
    state.jobs = state.rows.map((row, index) => normalizeJob({
      id: uid("job"),
      rowId: row.id,
      title: row.title,
      musicId: state.template.musicMode === "none" || !shuffledMusic.length ? "" : state.template.musicMode === "shuffle"
        ? shuffledMusic[index % shuffledMusic.length].id
        : shuffledMusic[Math.floor(Math.random() * shuffledMusic.length)].id,
      effectId: state.template.effectMode === "none" || !shuffledEffects.length ? "" : state.template.effectMode === "shuffle"
        ? shuffledEffects[index % shuffledEffects.length].id
        : shuffledEffects[Math.floor(Math.random() * shuffledEffects.length)].id,
      status: "queued",
      progress: 0,
      createdAt: new Date().toISOString()
    }));
    saveState();
    render();
    status(`Đã tạo ${state.jobs.length} job từ sườn ${state.template.name}.`, "success");
  }

  function parseCsv(text) {
    const rows = [];
    let current = "";
    let quoted = false;
    let record = [];
    const records = [];
    const input = String(text || "").replace(/^\uFEFF/, "");
    for (let index = 0; index < input.length; index += 1) {
      const char = input[index];
      if (char === '"') {
        if (quoted && input[index + 1] === '"') { current += '"'; index += 1; }
        else quoted = !quoted;
      } else if (char === "," && !quoted) { record.push(current); current = ""; }
      else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && input[index + 1] === "\n") index += 1;
        record.push(current); current = "";
        if (record.some((value) => value.trim())) records.push(record);
        record = [];
      } else current += char;
    }
    record.push(current);
    if (record.some((value) => value.trim())) records.push(record);
    if (!records.length) return [];
    const headers = records.shift().map((value) => value.trim().toLowerCase());
    records.slice(0, MAX_ROWS).forEach((values, index) => {
      const item = Object.fromEntries(headers.map((header, cell) => [header, values[cell]?.trim() || ""]));
      rows.push(normalizeRow({
        title: item.title || item.tieu_de,
        subtitle: item.subtitle || item.dong_phu,
        cta: item.cta,
        accent: item.accent || item.color,
        sourceName: item.sourcename || item.media || item.file
      }, index));
    });
    return rows;
  }

  function resolveSourceNames(rows) {
    return rows.map((row) => {
      const match = sourceAssets().find((asset) => asset.name.toLowerCase() === row.sourceName.toLowerCase());
      return match ? { ...row, sourceId: match.id, sourceName: match.name } : row;
    });
  }

  function downloadUrl(url, name) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    downloadUrl(url, name);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const isImage = (file) => file.type.startsWith("image/") || /\.(png|jpe?g|webp|avif|gif)$/i.test(file.name);
  const isVideo = (file) => file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
  const isAudio = (file) => file.type.startsWith("audio/") || /\.(mp3|m4a|aac|wav|ogg|opus|flac)$/i.test(file.name);
  const inferredType = (file) => file.type || (
    /\.mp3$/i.test(file.name) ? "audio/mpeg"
      : /\.(m4a|aac)$/i.test(file.name) ? "audio/mp4"
        : /\.wav$/i.test(file.name) ? "audio/wav"
          : /\.(ogg|opus)$/i.test(file.name) ? "audio/ogg"
            : /\.webm$/i.test(file.name) ? "video/webm"
              : /\.(mp4|m4v|mov)$/i.test(file.name) ? "video/mp4"
                : /\.png$/i.test(file.name) ? "image/png"
                  : /\.(jpe?g)$/i.test(file.name) ? "image/jpeg"
                    : /\.webp$/i.test(file.name) ? "image/webp"
                      : "application/octet-stream"
  );

  async function suggestColorForFile(file) {
    if (!isImage(file) || !window.createImageBitmap) return "natural";
    try {
      const bitmap = await createImageBitmap(file, { resizeWidth: 32, resizeHeight: 32 });
      const canvas = document.createElement("canvas");
      canvas.width = 32; canvas.height = 32;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(bitmap, 0, 0, 32, 32);
      bitmap.close?.();
      const pixels = context.getImageData(0, 0, 32, 32).data;
      let red = 0; let green = 0; let blue = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        red += pixels[index]; green += pixels[index + 1]; blue += pixels[index + 2];
      }
      const count = pixels.length / 4;
      red /= count; green /= count; blue /= count;
      const brightness = red * .299 + green * .587 + blue * .114;
      const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
      if (brightness < 65) return "aurora";
      if (spread < 20) return "punch";
      if (red > blue + 28) return "cinematic";
      if (blue > red + 25) return "solar";
      if (green > red + 20) return "emerald";
      if (brightness > 205) return "pastel";
      return "natural";
    } catch { return "natural"; }
  }

  async function storeInputFiles(files, source, predicate) {
    const limit = source === "batch-video-input" ? MAX_ROWS : MAX_LIBRARY_FILES;
    const accepted = [...files].filter((file) => predicate(file) && file.size <= MAX_INPUT_SIZE).slice(0, limit);
    const stored = [];
    for (const file of accepted) {
      const id = uid("batch-input");
      const record = {
        id,
        ownerId: ownerId(),
        name: file.name,
        type: inferredType(file),
        size: file.size,
        source,
        relativePath: String(file.webkitRelativePath || "").slice(0, 500),
        createdAt: new Date().toISOString(),
        file
      };
      await dbPut(record);
      stored.push(record);
    }
    return stored;
  }

  async function importImageFolder(files) {
    await replaceAssetSource("batch-video-input");
    const stored = await storeInputFiles(files, "batch-video-input", isImage);
    await refreshAssets();
    state.rows = [];
    for (const [index, asset] of stored.entries()) {
      const original = [...files].find((file) => file.name === asset.name);
      const suggestedColor = original ? await suggestColorForFile(original) : "natural";
      state.rows.push(normalizeRow({
        title: asset.name.replace(/\.[^.]+$/, ""),
        sourceId: asset.id,
        sourceName: asset.name,
        suggestedColor
      }, index));
    }
    state.jobs = [];
    saveState(); render();
    status(`Đã tạo ${stored.length} video từ ${stored.length} ảnh trong folder.`, stored.length ? "success" : "error");
  }

  async function importMusicFolder(files) {
    await replaceAssetSource("batch-video-music");
    const stored = await storeInputFiles(files, "batch-video-music", isAudio);
    state.jobs = [];
    saveState(); await refreshAssets(); render();
    status(`Đã thêm ${stored.length} bản nhạc. Hàng đợi mới sẽ trộn nhạc ${state.template.musicMode}.`, stored.length ? "success" : "error");
  }

  async function importEffectFolder(files) {
    await replaceAssetSource("batch-video-effect");
    const stored = await storeInputFiles(files, "batch-video-effect", (file) => isImage(file) || isVideo(file));
    state.jobs = [];
    saveState(); await refreshAssets(); render();
    status(`Đã thêm ${stored.length} overlay. Khi render sẽ ghép Screen ở ${state.template.effectOpacity}%.`, stored.length ? "success" : "error");
  }

  async function importAssets(files) {
    const stored = await storeInputFiles(files, "batch-video-input", (file) => isImage(file) || isVideo(file));
    await refreshAssets();
    const unassigned = state.rows.filter((row) => !row.sourceId);
    stored.forEach((asset, index) => {
      if (unassigned[index]) {
        unassigned[index].sourceId = asset.id;
        unassigned[index].sourceName = asset.name;
      } else if (state.rows.length < MAX_ROWS) {
        state.rows.push(normalizeRow({ title: asset.name.replace(/\.[^.]+$/, ""), sourceId: asset.id, sourceName: asset.name }, state.rows.length));
      }
    });
    saveState();
    render();
    status(`Đã nhập ${stored.length} asset thật vào Media Pool.`, stored.length ? "success" : "error");
  }

  async function handleFileChange(event) {
    const target = event.target;
    if (target.matches("[data-bvf-image-folder]")) return importImageFolder(target.files || []);
    if (target.matches("[data-bvf-music-folder]")) return importMusicFolder(target.files || []);
    if (target.matches("[data-bvf-effect-folder]")) return importEffectFolder(target.files || []);
    if (target.matches("[data-bvf-assets]")) return importAssets(target.files || []);
    if (target.matches("[data-bvf-template-file]")) {
      const file = target.files?.[0];
      if (!file || file.size > 512 * 1024) throw new Error("Sườn JSON phải nhỏ hơn 512 KB.");
      state.template = normalizeTemplate(JSON.parse(await file.text()));
      state.presetId = "custom";
      saveState(); render(); status("Đã nhập sườn JSON.", "success"); return;
    }
    if (target.matches("[data-bvf-data-file]")) {
      const file = target.files?.[0];
      if (!file || file.size > 2 * 1024 * 1024) throw new Error("File dữ liệu phải nhỏ hơn 2 MB.");
      const text = await file.text();
      let rows;
      if (/\.json$/i.test(file.name)) {
        const parsed = JSON.parse(text);
        rows = (Array.isArray(parsed) ? parsed : parsed.rows || []).slice(0, MAX_ROWS).map(normalizeRow);
      } else rows = parseCsv(text);
      state.rows = resolveSourceNames(rows);
      state.jobs = [];
      saveState(); render(); status(`Đã nhập ${state.rows.length} dòng dữ liệu.`, "success");
    }
  }

  function handleInput(event) {
    const target = event.target;
    if (target.matches("[data-bvf-duration-minutes]")) {
      state.template.duration = clamp(Number(target.value) * 60, 60, MAX_DURATION);
      state.presetId = "custom";
      saveState();
      renderPreflight();
      return;
    }
    if (target.matches("[data-bvf-template]")) {
      const key = target.dataset.bvfTemplate;
      const numeric = [
        "duration", "fps", "bitrate", "colorIntensity", "effectOpacity", "musicVolume", "musicFade",
        "musicPitch", "bassGain", "midGain", "trebleGain",
        "bassFrequency", "midFrequency", "trebleFrequency"
      ].includes(key);
      state.template[key] = numeric ? Number(target.value) : target.value;
      state.template = normalizeTemplate(state.template);
      state.presetId = "custom";
      saveState();
      drawPreview();
      renderPreflight();
      return;
    }
    if (target.matches("[data-bvf-resolution]")) {
      [state.template.width, state.template.height] = target.value.split("x").map(Number);
      state.presetId = "custom";
      saveState(); drawPreview(); return;
    }
    if (target.matches("[data-bvf-render-profile]")) {
      const profiles = {
        fast: { fps: 24, bitrate: 8_000_000 },
        balanced: { fps: 30, bitrate: 12_000_000 },
        high: { fps: 30, bitrate: 35_000_000 },
        cinematic: { fps: 60, bitrate: 60_000_000 }
      };
      const profile = profiles[target.value] || profiles.balanced;
      state.template = normalizeTemplate({ ...state.template, ...profile, renderProfile: target.value });
      saveState(); render();
      return status(`Đã áp dụng hồ sơ render ${target.options[target.selectedIndex]?.text || target.value}.`, "success");
    }
    if (target.matches("[data-bvf-option]")) {
      state[target.dataset.bvfOption] = target.checked;
      saveState();
      return;
    }
    const rowElement = target.closest("[data-bvf-row]");
    if (rowElement && target.matches("[data-bvf-row-duration-minutes]")) {
      const row = state.rows.find((item) => item.id === rowElement.dataset.bvfRow);
      if (!row) return;
      row.duration = target.value ? clamp(Number(target.value) * 60, 60, MAX_DURATION) : 0;
      saveState();
      renderPreflight();
      return;
    }
    if (rowElement && target.matches("[data-bvf-row-field]")) {
      const row = state.rows.find((item) => item.id === rowElement.dataset.bvfRow);
      if (!row) return;
      row[target.dataset.bvfRowField] = target.value;
      if (target.dataset.bvfRowField === "duration") row.duration = target.value ? clamp(target.value, 1, MAX_DURATION) : 0;
      if (target.dataset.bvfRowField === "sourceId") row.sourceName = assets.find((item) => item.id === target.value)?.name || "";
      saveState();
      if (state.rows[0]?.id === row.id) drawPreview();
      renderPreflight();
    }
  }

  async function handleClick(event) {
    const preset = event.target.closest("[data-bvf-preset]");
    if (preset) {
      const value = PRESETS.find((item) => item.id === preset.dataset.bvfPreset);
      if (!value) return;
      state.presetId = value.id;
      state.template = normalizeTemplate({ ...state.template, ...value });
      saveState(); render(); return status(`Đã áp dụng sườn ${value.name}.`, "success");
    }
    const remove = event.target.closest("[data-bvf-remove-row]");
    if (remove) {
      state.rows = state.rows.filter((item) => item.id !== remove.dataset.bvfRemoveRow);
      state.jobs = state.jobs.filter((job) => state.rows.some((row) => row.id === job.rowId));
      saveState(); render(); return;
    }
    const retry = event.target.closest("[data-bvf-retry]");
    if (retry) {
      const job = state.jobs.find((item) => item.id === retry.dataset.bvfRetry);
      if (job) updateJob(job, { status: "queued", progress: 0, error: "" });
      return runQueue();
    }
    const action = event.target.closest("[data-bvf-action]")?.dataset.bvfAction;
    if (!action) return;
    if (action === "add-row") {
      if (state.rows.length >= MAX_ROWS) return status(`Giới hạn ${MAX_ROWS} video mỗi batch.`, "error");
      state.rows.push(normalizeRow({}, state.rows.length)); saveState(); render(); return;
    }
    if (action === "build-queue") return buildQueue();
    if (action === "render-all") {
      if (!state.jobs.length) buildQueue();
      return runQueue();
    }
    if (action === "cancel") {
      cancelRequested = true;
      if (recorder?.state === "recording") status("Đang dừng an toàn sau frame hiện tại…", "error");
      return;
    }
    if (action === "preview") { drawPreview(); return status("Đã cập nhật preview từ sườn và dòng đầu tiên.", "success"); }
    if (action === "select-output-folder") {
      if (typeof window.showDirectoryPicker !== "function") return status("Trình duyệt này chưa hỗ trợ chọn thư mục lưu. File vẫn được lưu vào Media Pool hoặc tải xuống.", "error");
      outputDirectoryHandle = await window.showDirectoryPicker({ mode: "readwrite", id: "hh-batch-video-output" });
      state.outputDirectoryName = outputDirectoryHandle.name || "Thư mục đã chọn";
      saveState(); render();
      return status(`Sẽ ghi trực tiếp file hoàn thành vào ${state.outputDirectoryName}.`, "success");
    }
    if (action === "export-template") {
      return downloadBlob(new Blob([JSON.stringify({ version: 1, template: state.template }, null, 2)], { type: "application/json" }), "hh-video-template.json");
    }
    if (action === "sample-csv") {
      return downloadBlob(new Blob(["title,subtitle,cta,accent,sourceName\nVideo 1,Dòng phụ 1,Xem ngay,#6be8ff,background-1.jpg\nVideo 2,Dòng phụ 2,Đăng ký,#ff65c8,background-2.mp4\n"], { type: "text/csv;charset=utf-8" }), "hh-batch-video-sample.csv");
    }
    if (action === "download-all") {
      state.jobs.filter((job) => job.status === "completed").forEach((job, index) => {
        const url = outputUrls.get(job.outputAssetId);
        if (url) setTimeout(() => downloadUrl(url, job.outputName), index * 350);
      });
    }
  }

  async function mount(host) {
    unmount();
    root = host;
    state = loadState();
    outputDirectoryHandle = null;
    state.outputDirectoryName = "";
    controller = new AbortController();
    const options = { signal: controller.signal };
    root.addEventListener("click", (event) => handleClick(event).catch((error) => status(error.message, "error")), options);
    root.addEventListener("input", handleInput, options);
    root.addEventListener("change", (event) => handleFileChange(event).catch((error) => status(error.message, "error")), options);
    window.addEventListener("hh:auth-change", async () => {
      cancelRequested = true;
      state = loadState();
      await refreshAssets();
      render();
    }, options);
    render();
    await refreshAssets();
    await detectGpu();
    render();
  }

  function unmount() {
    cancelRequested = true;
    cancelAnimationFrame(frameId);
    if (recorder?.state === "recording") recorder.stop();
    recorder = null;
    outputDirectoryHandle = null;
    running = false;
    controller?.abort();
    controller = null;
    outputUrls.forEach((url) => URL.revokeObjectURL(url));
    outputUrls.clear();
    if (root) root.innerHTML = "";
    root = null;
  }

  window.HHVideoBatchFactory = Object.freeze({
    mount,
    unmount,
    presets: PRESETS,
    normalizeTemplate,
    normalizeRow,
    parseCsv,
    capabilities,
    colorPresets: COLOR_PRESETS
  });
  window.dispatchEvent(new CustomEvent("hh:video-batch-ready"));
})();
