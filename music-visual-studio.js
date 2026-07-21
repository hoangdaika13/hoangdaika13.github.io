(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const STORAGE_KEY = "hh.music.visual-studio.v1";
  const VIEW_IDS = Object.freeze(["image-music", "realtime-jam", "visualizer", "video"]);
  const TEMPLATE_SIZES = Object.freeze({
    "16:9": { width: 1280, height: 720, label: "YouTube 16:9", safe: 0.08 },
    "9:16": { width: 720, height: 1280, label: "Shorts 9:16", safe: 0.1 },
    "1:1": { width: 1080, height: 1080, label: "Square 1:1", safe: 0.08 }
  });
  const DEFAULT_STATE = Object.freeze({
    version: VERSION,
    view: "image-music",
    image: {
      fileName: "",
      provider: "local",
      genre: "Cinematic ambient",
      duration: 90,
      instrumental: true,
      brief: "",
      prompt: "",
      analysis: null
    },
    jam: {
      density: 48,
      brightness: 62,
      groove: 54,
      tension: 32,
      bpm: 96,
      key: "C minor",
      instrument: "glass",
      mood: "dreamy",
      automation: []
    },
    visualizer: {
      template: "16:9",
      mode: "hybrid",
      title: "HH AI MUSIC",
      subtitle: "Original visual experience",
      accent: "#70f0ef",
      background: "#070b18",
      lyrics: "",
      showSafeZone: true,
      particleCount: 72,
      fileName: "",
      coverName: ""
    }
  });

  let activeInstance = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, Number(value) || 0));
  }

  function safeText(value, maximum) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .slice(0, maximum || 20000);
  }

  function escapeHtml(value) {
    return safeText(value, 50000)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeAnalysis(value) {
    if (!value || typeof value !== "object") return null;
    return {
      palette: Array.isArray(value.palette) ? value.palette.slice(0, 6).map((color) => safeText(color, 12)) : [],
      luminance: clamp(value.luminance, 0, 100),
      energy: clamp(value.energy, 0, 100),
      saturation: clamp(value.saturation, 0, 100),
      contrast: clamp(value.contrast, 0, 100),
      warmth: clamp(value.warmth, -100, 100),
      mood: safeText(value.mood || "balanced", 60),
      suggestedBpm: Math.round(clamp(value.suggestedBpm || 96, 48, 180))
    };
  }

  function normalizeAutomation(events) {
    if (!Array.isArray(events)) return [];
    return events.slice(-1200).map((event, index) => ({
      id: safeText(event.id || `event-${index}`, 80),
      time: clamp(event.time, 0, 86400000),
      control: ["density", "brightness", "groove", "tension", "mood", "instrument"].includes(event.control) ? event.control : "density",
      value: typeof event.value === "string" ? safeText(event.value, 80) : clamp(event.value, 0, 100)
    })).sort((a, b) => a.time - b.time);
  }

  function normalizeState(input) {
    const source = input && typeof input === "object" ? input : {};
    const image = source.image && typeof source.image === "object" ? source.image : {};
    const jam = source.jam && typeof source.jam === "object" ? source.jam : {};
    const visualizer = source.visualizer && typeof source.visualizer === "object" ? source.visualizer : {};
    return {
      version: VERSION,
      view: VIEW_IDS.includes(source.view) ? source.view : DEFAULT_STATE.view,
      image: {
        fileName: safeText(image.fileName, 180),
        provider: ["local", "lyria", "eleven"].includes(image.provider) ? image.provider : "local",
        genre: safeText(image.genre || DEFAULT_STATE.image.genre, 100),
        duration: Math.round(clamp(image.duration || DEFAULT_STATE.image.duration, 10, 600)),
        instrumental: image.instrumental !== false,
        brief: safeText(image.brief, 12000),
        prompt: safeText(image.prompt, 12000),
        analysis: normalizeAnalysis(image.analysis)
      },
      jam: {
        density: clamp(jam.density == null ? DEFAULT_STATE.jam.density : jam.density, 0, 100),
        brightness: clamp(jam.brightness == null ? DEFAULT_STATE.jam.brightness : jam.brightness, 0, 100),
        groove: clamp(jam.groove == null ? DEFAULT_STATE.jam.groove : jam.groove, 0, 100),
        tension: clamp(jam.tension == null ? DEFAULT_STATE.jam.tension : jam.tension, 0, 100),
        bpm: Math.round(clamp(jam.bpm || DEFAULT_STATE.jam.bpm, 45, 200)),
        key: safeText(jam.key || DEFAULT_STATE.jam.key, 40),
        instrument: ["glass", "bass", "pluck", "pad"].includes(jam.instrument) ? jam.instrument : "glass",
        mood: ["dreamy", "calm", "hopeful", "dark", "energetic"].includes(jam.mood) ? jam.mood : "dreamy",
        automation: normalizeAutomation(jam.automation)
      },
      visualizer: {
        template: TEMPLATE_SIZES[visualizer.template] ? visualizer.template : "16:9",
        mode: ["waveform", "spectrum", "particles", "hybrid"].includes(visualizer.mode) ? visualizer.mode : "hybrid",
        title: safeText(visualizer.title || DEFAULT_STATE.visualizer.title, 120),
        subtitle: safeText(visualizer.subtitle || DEFAULT_STATE.visualizer.subtitle, 180),
        accent: /^#[0-9a-f]{6}$/i.test(visualizer.accent) ? visualizer.accent : DEFAULT_STATE.visualizer.accent,
        background: /^#[0-9a-f]{6}$/i.test(visualizer.background) ? visualizer.background : DEFAULT_STATE.visualizer.background,
        lyrics: safeText(visualizer.lyrics, 30000),
        showSafeZone: visualizer.showSafeZone !== false,
        particleCount: Math.round(clamp(visualizer.particleCount || DEFAULT_STATE.visualizer.particleCount, 12, 180)),
        fileName: safeText(visualizer.fileName, 180),
        coverName: safeText(visualizer.coverName, 180)
      }
    };
  }

  function loadState(storage) {
    try {
      const raw = storage && typeof storage.getItem === "function" ? storage.getItem(STORAGE_KEY) : null;
      return normalizeState(raw ? JSON.parse(raw) : clone(DEFAULT_STATE));
    } catch (_error) {
      return normalizeState(clone(DEFAULT_STATE));
    }
  }

  function saveState(state, storage) {
    try {
      if (storage && typeof storage.setItem === "function") storage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
      return true;
    } catch (_error) {
      return false;
    }
  }

  function rgbToHex(red, green, blue) {
    return `#${[red, green, blue].map((value) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0")).join("")}`;
  }

  function analyzeImageData(imageData, width, height) {
    const data = imageData && imageData.data ? imageData.data : imageData;
    if (!data || !data.length || !width || !height) throw new Error("Dữ liệu ảnh không hợp lệ.");
    const buckets = new Map();
    let luminanceTotal = 0;
    let saturationTotal = 0;
    let warmthTotal = 0;
    let luminanceSquares = 0;
    let samples = 0;
    const stride = Math.max(1, Math.floor((width * height) / 18000));
    for (let pixel = 0; pixel < width * height; pixel += stride) {
      const offset = pixel * 4;
      if ((data[offset + 3] == null ? 255 : data[offset + 3]) < 32) continue;
      const red = data[offset] || 0;
      const green = data[offset + 1] || 0;
      const blue = data[offset + 2] || 0;
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
      const saturation = maximum ? (maximum - minimum) / maximum : 0;
      luminanceTotal += luminance;
      luminanceSquares += luminance * luminance;
      saturationTotal += saturation;
      warmthTotal += (red - blue) / 255;
      samples += 1;
      const quantized = [red, green, blue].map((value) => Math.min(240, Math.floor(value / 32) * 32 + 16));
      const key = quantized.join(",");
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    if (!samples) throw new Error("Ảnh không có pixel hiển thị.");
    const mean = luminanceTotal / samples;
    const variance = Math.max(0, luminanceSquares / samples - mean * mean);
    const contrast = Math.sqrt(variance);
    const saturation = saturationTotal / samples;
    const warmth = warmthTotal / samples;
    const energy = clamp((contrast * 115) + (saturation * 48) + (Math.abs(mean - 0.5) * 16), 0, 100);
    const palette = Array.from(buckets.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([key]) => rgbToHex(...key.split(",").map(Number)));
    const mood = energy > 70
      ? (warmth > 0.08 ? "rực rỡ và giàu năng lượng" : "điện ảnh và mạnh mẽ")
      : energy < 38
        ? (mean < 0.36 ? "trầm, sâu và bí ẩn" : "êm dịu và tối giản")
        : (warmth > 0.1 ? "ấm áp và hoài niệm" : "cân bằng và mơ màng");
    return {
      palette,
      luminance: Math.round(mean * 100),
      energy: Math.round(energy),
      saturation: Math.round(saturation * 100),
      contrast: Math.round(clamp(contrast * 220, 0, 100)),
      warmth: Math.round(clamp(warmth * 100, -100, 100)),
      mood,
      suggestedBpm: Math.round(clamp(58 + energy * 0.95, 55, 156))
    };
  }

  function buildMusicBrief(analysisInput, settingsInput) {
    const analysis = normalizeAnalysis(analysisInput) || normalizeAnalysis({ palette: ["#70f0ef"], luminance: 50, energy: 50, saturation: 50, contrast: 50, warmth: 0, mood: "cân bằng", suggestedBpm: 96 });
    const settings = settingsInput && typeof settingsInput === "object" ? settingsInput : {};
    const palette = analysis.palette.length ? analysis.palette.join(", ") : "màu trung tính";
    const duration = Math.round(clamp(settings.duration || 90, 10, 600));
    const genre = safeText(settings.genre || "Cinematic ambient", 100);
    return {
      brief: [
        `Hướng nhạc: ${genre}.`,
        `Cảm xúc hình ảnh: ${analysis.mood}; năng lượng ${analysis.energy}/100; độ sáng ${analysis.luminance}/100.`,
        `Tempo đề xuất: ${analysis.suggestedBpm} BPM, thời lượng ${duration} giây.`,
        `Bảng màu tham chiếu: ${palette}.`,
        `Cấu trúc: Intro 15% → Build 25% → Main theme 40% → Outro 20%.`
      ].join("\n"),
      prompt: `${genre}, ${analysis.mood}, ${analysis.suggestedBpm} BPM, ${settings.instrumental === false ? "expressive vocal arrangement" : "instrumental"}, cinematic progression inspired by a ${analysis.luminance < 45 ? "low-key" : "luminous"} visual palette (${palette}), original composition, clean dynamics, ${duration} seconds`
    };
  }

  function providerAdapterState(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      local: { id: "local", label: "HH Local Composer", status: "ready", ready: true, detail: "Tạo brief và prompt cục bộ, không tải ảnh lên máy chủ." },
      lyria: {
        id: "lyria", label: "Google Lyria", ready: Boolean(source.lyria && source.lyria.ready),
        status: source.lyria && source.lyria.ready ? "ready" : "access-required",
        detail: source.lyria && source.lyria.ready ? "Connector phía máy chủ đã sẵn sàng." : "Cần quyền Lyria và connector phía máy chủ. Không lưu khóa ở trình duyệt."
      },
      eleven: {
        id: "eleven", label: "Eleven Music", ready: Boolean(source.eleven && source.eleven.ready),
        status: source.eleven && source.eleven.ready ? "ready" : "server-required",
        detail: source.eleven && source.eleven.ready ? "Adapter phía máy chủ đã sẵn sàng." : "Cần adapter Eleven phía máy chủ. API key không được đưa xuống client."
      }
    };
  }

  function serializeAutomation(jamState) {
    return JSON.stringify({
      format: "hh-music-jam-automation",
      version: 1,
      bpm: Math.round(clamp(jamState && jamState.bpm, 45, 200)),
      key: safeText(jamState && jamState.key, 40),
      instrument: safeText(jamState && jamState.instrument, 40),
      mood: safeText(jamState && jamState.mood, 40),
      events: normalizeAutomation(jamState && jamState.automation)
    }, null, 2);
  }

  function parseAutomation(text) {
    const parsed = JSON.parse(String(text || ""));
    if (parsed.format !== "hh-music-jam-automation" || Number(parsed.version) !== 1) throw new Error("Tệp không phải automation HH Music hợp lệ.");
    return {
      bpm: Math.round(clamp(parsed.bpm, 45, 200)),
      key: safeText(parsed.key || "C minor", 40),
      instrument: ["glass", "bass", "pluck", "pad"].includes(parsed.instrument) ? parsed.instrument : "glass",
      mood: ["dreamy", "calm", "hopeful", "dark", "energetic"].includes(parsed.mood) ? parsed.mood : "dreamy",
      automation: normalizeAutomation(parsed.events)
    };
  }

  function visualizerCapabilities(scope) {
    const target = scope || globalScope || {};
    const canvasPrototype = target.HTMLCanvasElement && target.HTMLCanvasElement.prototype;
    return {
      webAudio: Boolean(target.AudioContext || target.webkitAudioContext),
      canvasCapture: Boolean(canvasPrototype && typeof canvasPrototype.captureStream === "function"),
      mediaRecorder: Boolean(target.MediaRecorder),
      recording: Boolean(target.MediaRecorder && canvasPrototype && typeof canvasPrototype.captureStream === "function")
    };
  }

  function templateDimensions(template) {
    return { ...(TEMPLATE_SIZES[template] || TEMPLATE_SIZES["16:9"]) };
  }

  function supports(id) {
    return VIEW_IDS.includes(String(id || ""));
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function downloadBlob(blob, name) {
    if (!globalScope.document || !blob) return;
    const link = globalScope.document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    globalScope.setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  }

  function renderMeter(label, value, modifier) {
    return `<div class="mvs-meter"><span>${escapeHtml(label)}</span><strong>${Math.round(value)}</strong><i><b style="--mvs-level:${clamp(value, 0, 100)}%;${modifier || ""}"></b></i></div>`;
  }

  class MusicVisualStudio {
    constructor(host, options) {
      this.host = host;
      this.options = options || {};
      this.storage = this.options.storage || globalScope.localStorage;
      this.state = loadState(this.storage);
      this.view = supports(this.options.view) ? this.options.view : this.state.view;
      this.state.view = this.view;
      this.providerState = providerAdapterState(this.options.providers || globalScope.HH_MUSIC_PROVIDER_STATUS);
      this.urls = new Set();
      this.imageUrl = "";
      this.coverUrl = "";
      this.audioUrl = "";
      this.coverImage = null;
      this.audioContext = null;
      this.masterGain = null;
      this.filterNode = null;
      this.analyser = null;
      this.mediaSource = null;
      this.mediaDestination = null;
      this.jamTimer = 0;
      this.jamStep = 0;
      this.automationStartedAt = 0;
      this.capturingAutomation = false;
      this.visualRaf = 0;
      this.particles = [];
      this.recorder = null;
      this.recordChunks = [];
      this.recordUrl = "";
      this.objectListeners = [];
      this.boundClick = (event) => this.onClick(event);
      this.boundInput = (event) => this.onInput(event);
      this.boundChange = (event) => this.onChange(event);
      this.boundKeydown = (event) => this.onKeydown(event);
      this.boundDragOver = (event) => this.onDragOver(event);
      this.boundDrop = (event) => this.onDrop(event);
    }

    persist() {
      saveState(this.state, this.storage);
    }

    toast(message, type) {
      const node = this.host && this.host.querySelector("[data-mvs-toast]");
      if (!node) return;
      node.textContent = safeText(message, 300);
      node.dataset.type = type || "info";
      node.classList.add("is-visible");
      clearTimeout(this.toastTimer);
      this.toastTimer = globalScope.setTimeout(() => node.classList.remove("is-visible"), 3200);
    }

    render() {
      this.stopVisualLoop();
      this.host.innerHTML = this.shell();
      this.bind();
      if (this.view === "image-music") this.restoreImageCanvas();
      if (this.view === "visualizer" || this.view === "video") this.initializeVisualizerCanvas();
    }

    shell() {
      const labels = {
        "image-music": ["Image-to-Music", "Biến màu sắc và nhịp điệu thị giác thành một bản chỉ dẫn âm nhạc có thể chỉnh sửa."],
        "realtime-jam": ["Realtime Music Jam", "Biểu diễn bằng XY Pad với synth WebAudio cục bộ và ghi automation theo thời gian thực."],
        visualizer: ["Visualizer Studio", "Waveform, spectrum, particle và lời nhạc phản ứng theo beat trên canvas."],
        video: ["Music Video Builder", "Đóng gói cover, typography, audio và animation thành video WebM ngay trên thiết bị."]
      };
      const current = labels[this.view] || labels["image-music"];
      const tabs = [
        ["image-music", "Ảnh → Nhạc", "IM"],
        ["realtime-jam", "Jam trực tiếp", "JM"],
        ["visualizer", "Visualizer", "VZ"],
        ["video", "Music Video", "MV"]
      ].map(([id, label, icon]) => `<button type="button" class="mvs-tab ${this.view === id ? "is-active" : ""}" data-mvs-view="${id}" aria-pressed="${this.view === id}"><b>${icon}</b><span>${label}</span></button>`).join("");
      return `<section class="mvs" data-mvs-root data-view="${escapeHtml(this.view)}">
        <header class="mvs-hero">
          <div class="mvs-hero__identity"><span class="mvs-logo">MV</span><div><p>HH MUSIC VISUAL LAB · LOCAL FIRST</p><h2>${current[0]}</h2><span>${current[1]}</span></div></div>
          <div class="mvs-hero__status"><i></i><span>Media chỉ được xử lý trên thiết bị</span></div>
        </header>
        <nav class="mvs-tabs" aria-label="Music Visual Studio">${tabs}</nav>
        <main class="mvs-workspace">${this.view === "image-music" ? this.imageWorkspace() : this.view === "realtime-jam" ? this.jamWorkspace() : this.visualizerWorkspace()}</main>
        <div class="mvs-toast" data-mvs-toast role="status" aria-live="polite"></div>
      </section>`;
    }

    imageWorkspace() {
      const image = this.state.image;
      const analysis = image.analysis;
      const providerCards = Object.values(this.providerState).map((provider) => `<button type="button" class="mvs-provider ${image.provider === provider.id ? "is-selected" : ""}" data-mvs-provider="${provider.id}" aria-pressed="${image.provider === provider.id}">
        <span><i class="is-${provider.status}"></i>${escapeHtml(provider.label)}</span><b>${provider.ready ? "Sẵn sàng" : provider.id === "local" ? "Local" : "Cần kết nối"}</b><small>${escapeHtml(provider.detail)}</small>
      </button>`).join("");
      const palette = analysis && analysis.palette.length
        ? analysis.palette.map((color) => `<span class="mvs-swatch" style="--swatch:${escapeHtml(color)}" title="${escapeHtml(color)}"><b>${escapeHtml(color)}</b></span>`).join("")
        : `<span class="mvs-empty-inline">Chưa có bảng màu</span>`;
      return `<div class="mvs-image-layout">
        <section class="mvs-panel mvs-image-source">
          <div class="mvs-panel__head"><div><p>01 · VISUAL INPUT</p><h3>Ảnh tham chiếu</h3></div><span>${image.fileName ? escapeHtml(image.fileName) : "JPG · PNG · WebP"}</span></div>
          <label class="mvs-dropzone" data-mvs-image-drop tabindex="0">
            <input type="file" accept="image/*" data-mvs-image-input>
            <canvas data-mvs-image-canvas width="720" height="480" aria-label="Xem trước ảnh tham chiếu"></canvas>
            <span class="mvs-dropzone__empty"><b>+</b><strong>Chọn hoặc thả ảnh vào đây</strong><small>Ảnh chỉ được giải mã và phân tích trong trình duyệt.</small></span>
          </label>
          <div class="mvs-palette" aria-label="Bảng màu ảnh">${palette}</div>
        </section>
        <section class="mvs-panel mvs-analysis-panel">
          <div class="mvs-panel__head"><div><p>02 · LOCAL VISION</p><h3>Phân tích âm sắc</h3></div><button type="button" class="mvs-button" data-mvs-action="reanalyze" ${this.imageUrl ? "" : "disabled"}>Phân tích lại</button></div>
          <div class="mvs-analysis-grid">
            ${renderMeter("Năng lượng", analysis ? analysis.energy : 0)}
            ${renderMeter("Độ sáng", analysis ? analysis.luminance : 0)}
            ${renderMeter("Bão hòa", analysis ? analysis.saturation : 0)}
            ${renderMeter("Tương phản", analysis ? analysis.contrast : 0)}
          </div>
          <div class="mvs-analysis-summary">
            <span>Mood</span><strong>${analysis ? escapeHtml(analysis.mood) : "Chờ phân tích"}</strong>
            <span>Tempo gợi ý</span><strong>${analysis ? `${analysis.suggestedBpm} BPM` : "-- BPM"}</strong>
          </div>
          <div class="mvs-field-grid">
            <label><span>Thể loại</span><input data-mvs-field="image.genre" value="${escapeHtml(image.genre)}" maxlength="100"></label>
            <label><span>Thời lượng</span><input type="number" min="10" max="600" data-mvs-field="image.duration" value="${image.duration}"></label>
          </div>
          <label class="mvs-check"><input type="checkbox" data-mvs-field="image.instrumental" ${image.instrumental ? "checked" : ""}><span>Instrumental, không tạo lời hát</span></label>
          <button type="button" class="mvs-button mvs-button--primary" data-mvs-action="generate-brief" ${analysis ? "" : "disabled"}>Tạo brief và prompt âm nhạc</button>
        </section>
        <section class="mvs-panel mvs-prompt-panel">
          <div class="mvs-panel__head"><div><p>03 · CREATIVE DIRECTION</p><h3>Music brief</h3></div><button type="button" class="mvs-icon-button" data-mvs-action="copy-prompt" title="Sao chép prompt" aria-label="Sao chép prompt">⧉</button></div>
          <label><span>Brief sản xuất</span><textarea data-mvs-field="image.brief" rows="8" placeholder="Brief sẽ xuất hiện sau khi phân tích ảnh...">${escapeHtml(image.brief)}</textarea></label>
          <label><span>Prompt nhà cung cấp</span><textarea data-mvs-field="image.prompt" rows="6" placeholder="Prompt có thể chỉnh sửa trước khi gửi tới provider...">${escapeHtml(image.prompt)}</textarea></label>
        </section>
        <section class="mvs-panel mvs-provider-panel">
          <div class="mvs-panel__head"><div><p>04 · PROVIDER ROUTER</p><h3>Chọn bộ máy</h3></div><button type="button" class="mvs-button" data-mvs-action="refresh-providers">Làm mới</button></div>
          <div class="mvs-provider-list">${providerCards}</div>
          <div class="mvs-provider-action"><p>${image.provider === "local" ? "HH Local tạo chỉ dẫn sáng tác ngay trên máy." : "Provider bên ngoài chỉ hoạt động khi connector server được cấp quyền."}</p><button type="button" class="mvs-button mvs-button--primary" data-mvs-action="provider-run">${image.provider === "local" ? "Hoàn thiện prompt local" : "Yêu cầu chạy provider"}</button></div>
        </section>
      </div>`;
    }

    jamWorkspace() {
      const jam = this.state.jam;
      const eventRows = jam.automation.slice(-8).reverse().map((event) => `<li><b>${(event.time / 1000).toFixed(2)}s</b><span>${escapeHtml(event.control)}</span><strong>${escapeHtml(event.value)}</strong></li>`).join("");
      return `<div class="mvs-jam-layout">
        <section class="mvs-panel mvs-jam-stage">
          <div class="mvs-panel__head"><div><p>LIVE PERFORMANCE</p><h3>XY Performance Pads</h3></div><span class="mvs-live-state" data-mvs-live-state><i></i>Đang dừng</span></div>
          <div class="mvs-pad-grid">
            ${this.xyPad("tone", "Density", "Brightness", jam.density, jam.brightness)}
            ${this.xyPad("motion", "Groove", "Tension", jam.groove, jam.tension)}
          </div>
          <div class="mvs-jam-controls">
            <label><span>BPM</span><input type="number" min="45" max="200" data-mvs-field="jam.bpm" value="${jam.bpm}"></label>
            <label><span>Tông</span><select data-mvs-field="jam.key">${["C minor", "D minor", "E minor", "F major", "G major", "A minor"].map((key) => `<option ${jam.key === key ? "selected" : ""}>${key}</option>`).join("")}</select></label>
            <label><span>Nhạc cụ</span><select data-mvs-field="jam.instrument">${["glass", "bass", "pluck", "pad"].map((item) => `<option value="${item}" ${jam.instrument === item ? "selected" : ""}>${item}</option>`).join("")}</select></label>
            <label><span>Mood</span><select data-mvs-field="jam.mood">${["dreamy", "calm", "hopeful", "dark", "energetic"].map((item) => `<option value="${item}" ${jam.mood === item ? "selected" : ""}>${item}</option>`).join("")}</select></label>
          </div>
          <div class="mvs-transport">
            <button type="button" class="mvs-transport__primary" data-mvs-action="jam-toggle"><span>▶</span><b>Bắt đầu Local Jam</b></button>
            <button type="button" data-mvs-action="jam-note">Phát nốt thử</button>
            <label><span>Master</span><input type="range" min="0" max="100" value="68" data-mvs-master-volume></label>
          </div>
          <p class="mvs-consent-note">Âm thanh chỉ bắt đầu sau khi bạn bấm nút. Synth WebAudio là phương án local tức thời, không gửi dữ liệu ra ngoài.</p>
        </section>
        <aside class="mvs-panel mvs-automation-panel">
          <div class="mvs-panel__head"><div><p>AUTOMATION</p><h3>Ghi chuyển động</h3></div><span>${jam.automation.length} event</span></div>
          <div class="mvs-automation-actions">
            <button type="button" class="mvs-button ${this.capturingAutomation ? "is-recording" : ""}" data-mvs-action="automation-toggle">● ${this.capturingAutomation ? "Dừng ghi" : "Ghi automation"}</button>
            <button type="button" class="mvs-button" data-mvs-action="automation-play" ${jam.automation.length ? "" : "disabled"}>Phát automation</button>
            <button type="button" class="mvs-button" data-mvs-action="automation-clear" ${jam.automation.length ? "" : "disabled"}>Xóa</button>
          </div>
          <ul class="mvs-event-list">${eventRows || "<li class=\"is-empty\">Di chuyển pad khi đang ghi để tạo automation.</li>"}</ul>
          <div class="mvs-file-actions"><button type="button" data-mvs-action="automation-export">Xuất JSON</button><label>Nhập JSON<input type="file" accept="application/json,.json" data-mvs-automation-input></label></div>
        </aside>
        <aside class="mvs-panel mvs-connector-panel">
          <div class="mvs-panel__head"><div><p>ADVANCED CONNECTOR</p><h3>Lyria RealTime</h3></div><span class="mvs-badge is-access">Cần quyền truy cập</span></div>
          <p>Connector này chỉ sẵn sàng khi tài khoản Google Cloud được cấp quyền Lyria RealTime và backend HH đã cấu hình. Synth local vẫn hoạt động độc lập.</p>
          <div class="mvs-signal-grid"><span>Streaming</span><b>Chưa kết nối</b><span>Credentials</span><b>Chỉ phía server</b><span>Fallback</span><b class="is-ready">WebAudio sẵn sàng</b></div>
          <button type="button" class="mvs-button" data-mvs-action="lyria-request">Kiểm tra connector</button>
        </aside>
      </div>`;
    }

    xyPad(id, xLabel, yLabel, xValue, yValue) {
      return `<div class="mvs-xy-wrap"><div class="mvs-xy-labels"><span>${escapeHtml(yLabel)} <b data-mvs-pad-value="${id}-y">${Math.round(yValue)}</b></span><span>${escapeHtml(xLabel)} <b data-mvs-pad-value="${id}-x">${Math.round(xValue)}</b></span></div><div class="mvs-xy-pad" data-mvs-pad="${id}" tabindex="0" role="slider" aria-label="${escapeHtml(xLabel)} và ${escapeHtml(yLabel)}" aria-valuetext="${Math.round(xValue)}, ${Math.round(yValue)}"><i style="--pad-x:${xValue}%;--pad-y:${100 - yValue}%"></i><span></span></div></div>`;
    }

    visualizerWorkspace() {
      const visualizer = this.state.visualizer;
      const capabilities = visualizerCapabilities(globalScope);
      const dimensions = templateDimensions(visualizer.template);
      const recordLabel = capabilities.recording ? "Ghi WebM" : "Trình duyệt không hỗ trợ ghi WebM";
      return `<div class="mvs-video-layout">
        <section class="mvs-panel mvs-media-bin">
          <div class="mvs-panel__head"><div><p>MEDIA BIN</p><h3>Asset cục bộ</h3></div><span>Không upload</span></div>
          <label class="mvs-media-file"><b>♪</b><span><strong>Âm thanh</strong><small>${visualizer.fileName ? escapeHtml(visualizer.fileName) : "MP3, WAV, M4A, OGG"}</small></span><input type="file" accept="audio/*" data-mvs-audio-input></label>
          <label class="mvs-media-file"><b>▧</b><span><strong>Cover / Thumbnail</strong><small>${visualizer.coverName ? escapeHtml(visualizer.coverName) : "JPG, PNG, WebP"}</small></span><input type="file" accept="image/*" data-mvs-cover-input></label>
          <div class="mvs-template-list" aria-label="Tỷ lệ video">${Object.entries(TEMPLATE_SIZES).map(([id, item]) => `<button type="button" class="${visualizer.template === id ? "is-active" : ""}" data-mvs-template="${id}" aria-pressed="${visualizer.template === id}"><b>${id}</b><span>${item.label}</span></button>`).join("")}</div>
          <label><span>Kiểu visual</span><select data-mvs-field="visualizer.mode">${["hybrid", "waveform", "spectrum", "particles"].map((mode) => `<option value="${mode}" ${visualizer.mode === mode ? "selected" : ""}>${mode}</option>`).join("")}</select></label>
          <label><span>Mật độ particle</span><input type="range" min="12" max="180" data-mvs-field="visualizer.particleCount" value="${visualizer.particleCount}"></label>
        </section>
        <section class="mvs-panel mvs-preview-panel">
          <div class="mvs-panel__head"><div><p>${this.view === "video" ? "MUSIC VIDEO" : "REALTIME CANVAS"}</p><h3>Program Monitor</h3></div><span>${dimensions.width} × ${dimensions.height}</span></div>
          <div class="mvs-canvas-stage"><canvas data-mvs-visual-canvas width="${dimensions.width}" height="${dimensions.height}" aria-label="Xem trước visualizer"></canvas><span class="mvs-record-light" data-mvs-record-light>REC</span></div>
          <audio data-mvs-audio controls preload="metadata"></audio>
          <div class="mvs-video-transport">
            <button type="button" class="mvs-button mvs-button--primary" data-mvs-action="preview-start">▶ Bắt đầu preview</button>
            <button type="button" class="mvs-button" data-mvs-action="preview-stop">■ Dừng</button>
            <button type="button" class="mvs-button" data-mvs-action="record-toggle" ${capabilities.recording ? "" : "disabled"}>● ${recordLabel}</button>
            <a class="mvs-button is-hidden" data-mvs-record-download download="hh-music-visual.webm">Tải WebM</a>
          </div>
        </section>
        <aside class="mvs-panel mvs-inspector">
          <div class="mvs-panel__head"><div><p>INSPECTOR</p><h3>Thiết kế & lời</h3></div><span class="mvs-badge ${capabilities.recording ? "is-ready" : "is-access"}">${capabilities.recording ? "Recorder ready" : "Preview only"}</span></div>
          <label><span>Tiêu đề</span><input data-mvs-field="visualizer.title" value="${escapeHtml(visualizer.title)}" maxlength="120"></label>
          <label><span>Phụ đề</span><input data-mvs-field="visualizer.subtitle" value="${escapeHtml(visualizer.subtitle)}" maxlength="180"></label>
          <div class="mvs-color-fields"><label><span>Accent</span><input type="color" data-mvs-field="visualizer.accent" value="${visualizer.accent}"></label><label><span>Nền</span><input type="color" data-mvs-field="visualizer.background" value="${visualizer.background}"></label></div>
          <label><span>Lời bài hát, mỗi câu một dòng</span><textarea rows="8" data-mvs-field="visualizer.lyrics" placeholder="Câu hát đầu tiên...">${escapeHtml(visualizer.lyrics)}</textarea></label>
          <label class="mvs-check"><input type="checkbox" data-mvs-field="visualizer.showSafeZone" ${visualizer.showSafeZone ? "checked" : ""}><span>Hiển thị vùng an toàn khi preview</span></label>
          <div class="mvs-capability-list"><span>WebAudio <b>${capabilities.webAudio ? "Có" : "Không"}</b></span><span>Canvas stream <b>${capabilities.canvasCapture ? "Có" : "Không"}</b></span><span>MediaRecorder <b>${capabilities.mediaRecorder ? "Có" : "Không"}</b></span></div>
          <button type="button" class="mvs-button" data-mvs-action="open-video-editor">Mở Video Editor nâng cao</button>
        </aside>
      </div>`;
    }

    bind() {
      this.host.addEventListener("click", this.boundClick);
      this.host.addEventListener("input", this.boundInput);
      this.host.addEventListener("change", this.boundChange);
      this.host.addEventListener("keydown", this.boundKeydown);
      this.host.addEventListener("dragover", this.boundDragOver);
      this.host.addEventListener("drop", this.boundDrop);
      this.host.querySelectorAll("[data-mvs-pad]").forEach((pad) => this.bindPad(pad));
    }

    unbind() {
      this.host.removeEventListener("click", this.boundClick);
      this.host.removeEventListener("input", this.boundInput);
      this.host.removeEventListener("change", this.boundChange);
      this.host.removeEventListener("keydown", this.boundKeydown);
      this.host.removeEventListener("dragover", this.boundDragOver);
      this.host.removeEventListener("drop", this.boundDrop);
      this.objectListeners.splice(0).forEach(({ node, type, handler }) => node.removeEventListener(type, handler));
    }

    switchView(view) {
      if (!supports(view) || view === this.view) return;
      this.cleanupRuntime(true);
      this.unbind();
      this.view = view;
      this.state.view = view;
      this.persist();
      this.render();
      this.host.dispatchEvent(new CustomEvent("hh:music-visual-view", { bubbles: true, detail: { view } }));
    }

    onClick(event) {
      const viewButton = event.target.closest("[data-mvs-view]");
      if (viewButton) return this.switchView(viewButton.dataset.mvsView);
      const providerButton = event.target.closest("[data-mvs-provider]");
      if (providerButton) {
        this.state.image.provider = providerButton.dataset.mvsProvider;
        this.persist();
        this.unbind();
        this.render();
        return;
      }
      const templateButton = event.target.closest("[data-mvs-template]");
      if (templateButton) {
        this.cleanupRuntime(true);
        this.state.visualizer.template = templateButton.dataset.mvsTemplate;
        this.persist();
        this.unbind();
        this.render();
        return;
      }
      const actionNode = event.target.closest("[data-mvs-action]");
      if (!actionNode) return;
      const action = actionNode.dataset.mvsAction;
      const actions = {
        reanalyze: () => this.reanalyzeImage(),
        "generate-brief": () => this.generateBrief(),
        "copy-prompt": () => this.copyPrompt(),
        "refresh-providers": () => this.refreshProviders(),
        "provider-run": () => this.runProvider(),
        "jam-toggle": () => this.toggleJam(),
        "jam-note": () => this.playSynthNote(true),
        "automation-toggle": () => this.toggleAutomationCapture(),
        "automation-play": () => this.playAutomation(),
        "automation-clear": () => this.clearAutomation(),
        "automation-export": () => downloadBlob(new Blob([serializeAutomation(this.state.jam)], { type: "application/json" }), "hh-jam-automation.json"),
        "lyria-request": () => this.requestLyriaConnector(),
        "preview-start": () => this.startPreview(),
        "preview-stop": () => this.stopPreview(),
        "record-toggle": () => this.toggleRecording(),
        "open-video-editor": () => this.openVideoEditor()
      };
      if (actions[action]) actions[action]();
    }

    onInput(event) {
      const path = event.target.dataset.mvsField;
      if (!path) return;
      this.updateField(path, event.target);
      if (path.startsWith("visualizer.")) {
        this.drawVisualizer(performance.now());
      }
    }

    onChange(event) {
      if (event.target.matches("[data-mvs-image-input]")) this.loadImage(event.target.files && event.target.files[0]);
      if (event.target.matches("[data-mvs-audio-input]")) this.loadAudio(event.target.files && event.target.files[0]);
      if (event.target.matches("[data-mvs-cover-input]")) this.loadCover(event.target.files && event.target.files[0]);
      if (event.target.matches("[data-mvs-automation-input]")) this.importAutomationFile(event.target.files && event.target.files[0]);
      const path = event.target.dataset.mvsField;
      if (path) {
        this.updateField(path, event.target);
        if (path === "visualizer.mode") this.drawVisualizer(performance.now());
      }
      if (event.target.matches("[data-mvs-master-volume]") && this.masterGain) this.masterGain.gain.setTargetAtTime(clamp(event.target.value, 0, 100) / 100, this.audioContext.currentTime, 0.02);
    }

    onKeydown(event) {
      const dropzone = event.target.closest("[data-mvs-image-drop]");
      if (dropzone && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        dropzone.querySelector("input")?.click();
      }
    }

    onDragOver(event) {
      if (event.target.closest("[data-mvs-image-drop]")) event.preventDefault();
    }

    onDrop(event) {
      if (!event.target.closest("[data-mvs-image-drop]")) return;
      event.preventDefault();
      this.loadImage(event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]);
    }

    updateField(path, input) {
      const [group, field] = path.split(".");
      if (!this.state[group] || !(field in this.state[group])) return;
      let value = input.type === "checkbox" ? input.checked : input.value;
      if (["duration", "bpm", "particleCount"].includes(field)) value = Number(value);
      this.state[group][field] = value;
      this.state = normalizeState(this.state);
      this.persist();
      if (group === "jam" && ["instrument", "mood"].includes(field)) this.captureAutomation(field, value);
    }

    addUrl(url) {
      if (url) this.urls.add(url);
      return url;
    }

    revokeUrl(url) {
      if (!url) return;
      try { URL.revokeObjectURL(url); } catch (_error) {}
      this.urls.delete(url);
    }

    async loadImage(file) {
      if (!file || !file.type.startsWith("image/")) return this.toast("Hãy chọn một tệp ảnh hợp lệ.", "error");
      if (file.size > 24 * 1024 * 1024) return this.toast("Ảnh phải nhỏ hơn 24 MB.", "error");
      this.revokeUrl(this.imageUrl);
      this.imageUrl = this.addUrl(URL.createObjectURL(file));
      this.state.image.fileName = safeText(file.name, 180);
      try {
        await this.analyzeCurrentImage();
        this.persist();
        this.unbind();
        this.render();
        this.toast("Đã phân tích ảnh hoàn toàn trên thiết bị.", "success");
      } catch (error) {
        this.toast(error.message || "Không thể phân tích ảnh.", "error");
      }
    }

    imageFromUrl(url) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Không thể giải mã ảnh."));
        image.src = url;
      });
    }

    async analyzeCurrentImage() {
      if (!this.imageUrl) throw new Error("Chưa có ảnh để phân tích.");
      const image = await this.imageFromUrl(this.imageUrl);
      const width = Math.min(480, image.naturalWidth || image.width);
      const height = Math.max(1, Math.round(width * (image.naturalHeight || image.height) / (image.naturalWidth || image.width)));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0, width, height);
      this.state.image.analysis = analyzeImageData(context.getImageData(0, 0, width, height), width, height);
      const generated = buildMusicBrief(this.state.image.analysis, this.state.image);
      if (!this.state.image.brief) this.state.image.brief = generated.brief;
      if (!this.state.image.prompt) this.state.image.prompt = generated.prompt;
      this.persist();
      return this.state.image.analysis;
    }

    async reanalyzeImage() {
      try {
        await this.analyzeCurrentImage();
        const generated = buildMusicBrief(this.state.image.analysis, this.state.image);
        this.state.image.brief = generated.brief;
        this.state.image.prompt = generated.prompt;
        this.persist();
        this.unbind();
        this.render();
        this.toast("Đã phân tích lại ảnh và cập nhật music brief.", "success");
      } catch (error) {
        this.toast(error.message || "Không thể phân tích lại ảnh.", "error");
      }
    }

    async restoreImageCanvas() {
      if (!this.imageUrl) return;
      const canvas = this.host.querySelector("[data-mvs-image-canvas]");
      if (!canvas) return;
      try {
        const image = await this.imageFromUrl(this.imageUrl);
        const context = canvas.getContext("2d");
        context.clearRect(0, 0, canvas.width, canvas.height);
        const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
        canvas.closest(".mvs-dropzone")?.classList.add("has-media");
      } catch (_error) {}
    }

    generateBrief() {
      if (!this.state.image.analysis) return this.toast("Hãy phân tích ảnh trước.", "error");
      const generated = buildMusicBrief(this.state.image.analysis, this.state.image);
      this.state.image.brief = generated.brief;
      this.state.image.prompt = generated.prompt;
      this.persist();
      this.unbind();
      this.render();
      this.toast("Đã tạo brief mới. Bạn có thể chỉnh sửa tự do.", "success");
    }

    copyPrompt() {
      const text = this.state.image.prompt;
      if (!text) return this.toast("Chưa có prompt để sao chép.", "error");
      if (!navigator.clipboard || !navigator.clipboard.writeText) return this.toast("Clipboard không khả dụng trong trình duyệt này.", "error");
      navigator.clipboard.writeText(text).then(() => this.toast("Đã sao chép prompt.", "success")).catch(() => this.toast("Không thể truy cập clipboard.", "error"));
    }

    async refreshProviders() {
      try {
        if (typeof this.options.getProviderStatus === "function") this.providerState = providerAdapterState(await this.options.getProviderStatus());
        else this.providerState = providerAdapterState(this.options.providers || globalScope.HH_MUSIC_PROVIDER_STATUS);
        this.unbind();
        this.render();
        this.toast("Đã cập nhật trạng thái provider.", "success");
      } catch (error) {
        this.toast(error.message || "Không thể kiểm tra provider.", "error");
      }
    }

    runProvider() {
      const provider = this.providerState[this.state.image.provider];
      if (!provider || provider.id === "local") {
        this.generateBrief();
        return;
      }
      if (!provider.ready) {
        this.host.dispatchEvent(new CustomEvent("hh:music-provider-required", { bubbles: true, detail: { provider: provider.id, view: this.view } }));
        this.toast(provider.detail, "warning");
        return;
      }
      this.host.dispatchEvent(new CustomEvent("hh:music-provider-run", {
        bubbles: true,
        detail: { provider: provider.id, prompt: this.state.image.prompt, brief: this.state.image.brief, duration: this.state.image.duration, instrumental: this.state.image.instrumental }
      }));
      this.toast("Đã gửi yêu cầu tới adapter phía máy chủ.", "success");
    }

    bindPad(pad) {
      const pointer = (event) => {
        if (event.type === "pointermove" && event.buttons !== 1 && !pad.hasPointerCapture(event.pointerId)) return;
        event.preventDefault();
        if (event.type === "pointerdown") pad.setPointerCapture?.(event.pointerId);
        const rect = pad.getBoundingClientRect();
        this.updatePad(pad.dataset.mvsPad, clamp((event.clientX - rect.left) / rect.width * 100, 0, 100), clamp((rect.bottom - event.clientY) / rect.height * 100, 0, 100), pad);
      };
      const keyboard = (event) => {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
        event.preventDefault();
        const id = pad.dataset.mvsPad;
        const xField = id === "tone" ? "density" : "groove";
        const yField = id === "tone" ? "brightness" : "tension";
        const step = event.shiftKey ? 10 : 2;
        const x = this.state.jam[xField] + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0);
        const y = this.state.jam[yField] + (event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0);
        this.updatePad(id, x, y, pad);
      };
      [["pointerdown", pointer], ["pointermove", pointer], ["keydown", keyboard]].forEach(([type, handler]) => {
        pad.addEventListener(type, handler);
        this.objectListeners.push({ node: pad, type, handler });
      });
    }

    updatePad(id, xValue, yValue, pad) {
      const fields = id === "tone" ? ["density", "brightness"] : ["groove", "tension"];
      this.state.jam[fields[0]] = clamp(xValue, 0, 100);
      this.state.jam[fields[1]] = clamp(yValue, 0, 100);
      const knob = pad.querySelector("i");
      if (knob) {
        knob.style.setProperty("--pad-x", `${this.state.jam[fields[0]]}%`);
        knob.style.setProperty("--pad-y", `${100 - this.state.jam[fields[1]]}%`);
      }
      pad.setAttribute("aria-valuetext", `${Math.round(this.state.jam[fields[0]])}, ${Math.round(this.state.jam[fields[1]])}`);
      const xLabel = this.host.querySelector(`[data-mvs-pad-value="${id}-x"]`);
      const yLabel = this.host.querySelector(`[data-mvs-pad-value="${id}-y"]`);
      if (xLabel) xLabel.textContent = Math.round(this.state.jam[fields[0]]);
      if (yLabel) yLabel.textContent = Math.round(this.state.jam[fields[1]]);
      this.captureAutomation(fields[0], this.state.jam[fields[0]]);
      this.captureAutomation(fields[1], this.state.jam[fields[1]]);
      this.updateSynthParameters();
      this.persist();
    }

    ensureAudioContext() {
      if (this.audioContext && this.audioContext.state !== "closed") return this.audioContext;
      const AudioContextClass = globalScope.AudioContext || globalScope.webkitAudioContext;
      if (!AudioContextClass) throw new Error("Trình duyệt không hỗ trợ WebAudio.");
      this.audioContext = new AudioContextClass();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.68;
      this.filterNode = this.audioContext.createBiquadFilter();
      this.filterNode.type = "lowpass";
      this.filterNode.frequency.value = 3600;
      this.filterNode.Q.value = 1.2;
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.filterNode.connect(this.analyser);
      this.analyser.connect(this.masterGain);
      this.masterGain.connect(this.audioContext.destination);
      return this.audioContext;
    }

    async toggleJam() {
      try {
        const context = this.ensureAudioContext();
        if (context.state === "suspended") await context.resume();
        if (this.jamTimer) this.stopJam();
        else this.startJam();
      } catch (error) {
        this.toast(error.message || "Không thể khởi tạo âm thanh.", "error");
      }
    }

    startJam() {
      if (this.jamTimer) return;
      const interval = () => Math.max(75, (60000 / this.state.jam.bpm) / 2);
      const tick = () => {
        this.playSynthNote(false);
        this.jamStep += 1;
        this.jamTimer = globalScope.setTimeout(tick, interval());
      };
      tick();
      const status = this.host.querySelector("[data-mvs-live-state]");
      if (status) { status.classList.add("is-live"); status.innerHTML = "<i></i>Local synth đang chạy"; }
      const button = this.host.querySelector('[data-mvs-action="jam-toggle"] b');
      if (button) button.textContent = "Dừng Local Jam";
    }

    stopJam() {
      clearTimeout(this.jamTimer);
      this.jamTimer = 0;
      const status = this.host.querySelector("[data-mvs-live-state]");
      if (status) { status.classList.remove("is-live"); status.innerHTML = "<i></i>Đang dừng"; }
      const button = this.host.querySelector('[data-mvs-action="jam-toggle"] b');
      if (button) button.textContent = "Bắt đầu Local Jam";
    }

    playSynthNote(force) {
      let context;
      try { context = this.ensureAudioContext(); } catch (error) { this.toast(error.message, "error"); return; }
      if (context.state === "suspended") context.resume();
      const jam = this.state.jam;
      const rootByKey = { "C minor": 130.81, "D minor": 146.83, "E minor": 164.81, "F major": 174.61, "G major": 196, "A minor": 220 };
      const scale = jam.key.includes("minor") ? [1, 1.1892, 1.3348, 1.4983, 1.7818, 2] : [1, 1.1225, 1.2599, 1.4983, 1.6818, 2];
      const densitySkip = Math.max(1, Math.round(5 - jam.density / 25));
      if (!force && this.jamStep % densitySkip !== 0) return;
      const frequency = (rootByKey[jam.key] || 130.81) * scale[this.jamStep % scale.length] * (jam.instrument === "bass" ? 0.5 : 1);
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = { glass: "sine", bass: "sawtooth", pluck: "triangle", pad: "sine" }[jam.instrument] || "sine";
      oscillator.frequency.setValueAtTime(frequency, now);
      if (jam.tension > 62) oscillator.detune.setValueAtTime((jam.tension - 62) * 1.7, now);
      const duration = jam.instrument === "pad" ? 1.8 : jam.instrument === "pluck" ? 0.28 : 0.7;
      const velocity = clamp(0.04 + jam.density / 650, 0.04, 0.2);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(velocity, now + (jam.instrument === "pad" ? 0.18 : 0.012));
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(this.filterNode);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.03);
      this.updateSynthParameters();
    }

    updateSynthParameters() {
      if (!this.filterNode || !this.audioContext) return;
      const frequency = 380 + Math.pow(this.state.jam.brightness / 100, 2) * 11000;
      this.filterNode.frequency.setTargetAtTime(frequency, this.audioContext.currentTime, 0.035);
      this.filterNode.Q.setTargetAtTime(0.4 + this.state.jam.tension / 13, this.audioContext.currentTime, 0.035);
    }

    toggleAutomationCapture() {
      this.capturingAutomation = !this.capturingAutomation;
      if (this.capturingAutomation) {
        this.automationStartedAt = performance.now();
        this.toast("Đang ghi chuyển động pad.", "success");
      } else this.toast("Đã dừng ghi automation.", "info");
      this.unbind();
      this.render();
    }

    captureAutomation(control, value) {
      if (!this.capturingAutomation) return;
      const time = Math.round(performance.now() - this.automationStartedAt);
      const last = this.state.jam.automation[this.state.jam.automation.length - 1];
      if (last && last.control === control && time - last.time < 45) {
        last.time = time;
        last.value = typeof value === "string" ? safeText(value, 80) : Math.round(value * 10) / 10;
      } else {
        this.state.jam.automation.push({ id: uid("auto"), time, control, value: typeof value === "string" ? safeText(value, 80) : Math.round(value * 10) / 10 });
      }
      this.state.jam.automation = normalizeAutomation(this.state.jam.automation);
      this.persist();
    }

    async playAutomation() {
      const events = this.state.jam.automation.slice();
      if (!events.length) return;
      try {
        const context = this.ensureAudioContext();
        if (context.state === "suspended") await context.resume();
        if (!this.jamTimer) this.startJam();
        this.automationTimers = events.map((event) => globalScope.setTimeout(() => {
          this.state.jam[event.control] = event.value;
          const padId = ["density", "brightness"].includes(event.control) ? "tone" : ["groove", "tension"].includes(event.control) ? "motion" : "";
          if (padId) {
            const pad = this.host.querySelector(`[data-mvs-pad="${padId}"]`);
            if (pad) this.updatePad(padId, this.state.jam[padId === "tone" ? "density" : "groove"], this.state.jam[padId === "tone" ? "brightness" : "tension"], pad);
          }
          this.updateSynthParameters();
        }, event.time));
        this.toast("Đang phát lại automation.", "success");
      } catch (error) { this.toast(error.message, "error"); }
    }

    clearAutomation() {
      this.state.jam.automation = [];
      this.persist();
      this.unbind();
      this.render();
      this.toast("Đã xóa automation.", "info");
    }

    async importAutomationFile(file) {
      if (!file || file.size > 2 * 1024 * 1024) return this.toast("Tệp automation không hợp lệ hoặc quá lớn.", "error");
      try {
        const imported = parseAutomation(await file.text());
        this.state.jam = { ...this.state.jam, ...imported };
        this.persist();
        this.unbind();
        this.render();
        this.toast("Đã nhập automation.", "success");
      } catch (error) { this.toast(error.message, "error"); }
    }

    requestLyriaConnector() {
      this.host.dispatchEvent(new CustomEvent("hh:music-lyria-access", { bubbles: true, detail: { capability: "realtime", noClientKeys: true } }));
      this.toast("Lyria RealTime cần quyền truy cập và connector phía máy chủ. Local synth vẫn sẵn sàng.", "warning");
    }

    initializeVisualizerCanvas() {
      const audio = this.host.querySelector("[data-mvs-audio]");
      if (audio && this.audioUrl) audio.src = this.audioUrl;
      if (this.coverUrl) this.loadCoverImageFromUrl(this.coverUrl);
      this.resetParticles();
      this.drawVisualizer(performance.now());
    }

    async loadAudio(file) {
      if (!file || !file.type.startsWith("audio/")) return this.toast("Hãy chọn tệp âm thanh hợp lệ.", "error");
      if (file.size > 500 * 1024 * 1024) return this.toast("Tệp âm thanh phải nhỏ hơn 500 MB.", "error");
      this.stopPreview();
      this.revokeUrl(this.audioUrl);
      this.audioUrl = this.addUrl(URL.createObjectURL(file));
      this.state.visualizer.fileName = safeText(file.name, 180);
      this.persist();
      const audio = this.host.querySelector("[data-mvs-audio]");
      if (audio) { audio.src = this.audioUrl; audio.load(); }
      this.toast("Đã nạp âm thanh cục bộ.", "success");
    }

    async loadCover(file) {
      if (!file || !file.type.startsWith("image/")) return this.toast("Hãy chọn cover ảnh hợp lệ.", "error");
      if (file.size > 30 * 1024 * 1024) return this.toast("Cover phải nhỏ hơn 30 MB.", "error");
      this.revokeUrl(this.coverUrl);
      this.coverUrl = this.addUrl(URL.createObjectURL(file));
      this.state.visualizer.coverName = safeText(file.name, 180);
      this.persist();
      await this.loadCoverImageFromUrl(this.coverUrl);
      this.drawVisualizer(performance.now());
      this.toast("Đã nạp cover cục bộ.", "success");
    }

    async loadCoverImageFromUrl(url) {
      try { this.coverImage = await this.imageFromUrl(url); }
      catch (_error) { this.coverImage = null; }
    }

    async ensureVisualizerAudio() {
      const audio = this.host.querySelector("[data-mvs-audio]");
      if (!audio) throw new Error("Không tìm thấy trình phát âm thanh.");
      const AudioContextClass = globalScope.AudioContext || globalScope.webkitAudioContext;
      if (!AudioContextClass) throw new Error("Trình duyệt không hỗ trợ WebAudio.");
      if (!this.audioContext || this.audioContext.state === "closed") this.audioContext = new AudioContextClass();
      const context = this.audioContext;
      if (!this.mediaSource) {
        this.mediaSource = context.createMediaElementSource(audio);
        this.analyser = context.createAnalyser();
        this.analyser.fftSize = 2048;
        const outputGain = context.createGain();
        outputGain.gain.value = 1;
        this.mediaSource.connect(this.analyser);
        this.analyser.connect(outputGain);
        outputGain.connect(context.destination);
        this.mediaDestination = context.createMediaStreamDestination();
        outputGain.connect(this.mediaDestination);
        this.visualOutputGain = outputGain;
      }
      if (context.state === "suspended") await context.resume();
      return audio;
    }

    async startPreview() {
      try {
        const audio = await this.ensureVisualizerAudio();
        if (this.audioUrl) await audio.play();
        this.startVisualLoop();
        this.toast(this.audioUrl ? "Preview beat-reactive đang chạy." : "Preview đang chạy không có audio.", "success");
      } catch (error) {
        this.startVisualLoop();
        this.toast(error.message || "Preview canvas đang chạy không có audio.", "warning");
      }
    }

    stopPreview() {
      const audio = this.host && this.host.querySelector("[data-mvs-audio]");
      if (audio) audio.pause();
      this.stopVisualLoop();
      this.drawVisualizer(performance.now());
    }

    startVisualLoop() {
      if (this.visualRaf) return;
      const loop = (time) => {
        this.drawVisualizer(time);
        this.visualRaf = globalScope.requestAnimationFrame(loop);
      };
      this.visualRaf = globalScope.requestAnimationFrame(loop);
    }

    stopVisualLoop() {
      if (this.visualRaf) globalScope.cancelAnimationFrame(this.visualRaf);
      this.visualRaf = 0;
    }

    resetParticles() {
      const count = this.state.visualizer.particleCount;
      this.particles = Array.from({ length: count }, (_, index) => ({
        x: ((index * 61) % 997) / 997,
        y: ((index * 113) % 991) / 991,
        size: 0.7 + (index % 7) * 0.32,
        speed: 0.00002 + (index % 9) * 0.000006,
        phase: index * 0.73
      }));
    }

    drawCover(context, canvas) {
      if (!this.coverImage) return;
      const image = this.coverImage;
      const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      context.save();
      context.globalAlpha = 0.38;
      context.filter = "saturate(1.18) contrast(1.08)";
      context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      context.restore();
    }

    spectrumData() {
      if (!this.analyser) return { frequency: new Uint8Array(128), waveform: new Uint8Array(256).fill(128), energy: 0.08 };
      const frequency = new Uint8Array(this.analyser.frequencyBinCount);
      const waveform = new Uint8Array(this.analyser.fftSize);
      this.analyser.getByteFrequencyData(frequency);
      this.analyser.getByteTimeDomainData(waveform);
      const length = Math.min(140, frequency.length);
      let total = 0;
      for (let index = 0; index < length; index += 1) total += frequency[index];
      return { frequency, waveform, energy: total / Math.max(1, length) / 255 };
    }

    drawVisualizer(time) {
      const canvas = this.host && this.host.querySelector("[data-mvs-visual-canvas]");
      if (!canvas) return;
      const context = canvas.getContext("2d");
      const config = this.state.visualizer;
      if (this.particles.length !== config.particleCount) this.resetParticles();
      const audioData = this.spectrumData();
      const beat = Math.max(0.06, audioData.energy);
      context.fillStyle = config.background;
      context.fillRect(0, 0, canvas.width, canvas.height);
      this.drawCover(context, canvas);
      const glow = context.createRadialGradient(canvas.width * 0.5, canvas.height * 0.42, 0, canvas.width * 0.5, canvas.height * 0.42, Math.max(canvas.width, canvas.height) * 0.72);
      glow.addColorStop(0, `${config.accent}${Math.round((0.12 + beat * 0.28) * 255).toString(16).padStart(2, "0")}`);
      glow.addColorStop(0.58, "rgba(126,71,255,.08)");
      glow.addColorStop(1, "rgba(0,0,0,.22)");
      context.fillStyle = glow;
      context.fillRect(0, 0, canvas.width, canvas.height);
      if (["particles", "hybrid"].includes(config.mode)) this.drawParticles(context, canvas, time, beat);
      if (["spectrum", "hybrid"].includes(config.mode)) this.drawSpectrum(context, canvas, audioData.frequency, beat);
      if (["waveform", "hybrid"].includes(config.mode)) this.drawWaveform(context, canvas, audioData.waveform, beat);
      this.drawTypography(context, canvas, beat);
      if (config.showSafeZone) this.drawSafeZone(context, canvas);
    }

    drawParticles(context, canvas, time, beat) {
      context.save();
      context.fillStyle = this.state.visualizer.accent;
      for (const particle of this.particles) {
        const x = particle.x * canvas.width + Math.sin(time * particle.speed + particle.phase) * canvas.width * 0.025;
        const y = (particle.y * canvas.height + time * particle.speed * canvas.height * 0.035) % canvas.height;
        const radius = particle.size * (1 + beat * 2.8) * Math.max(1, canvas.width / 900);
        context.globalAlpha = 0.16 + (particle.size % 1) * 0.45;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }

    drawSpectrum(context, canvas, frequency, beat) {
      const count = Math.min(72, frequency.length || 0);
      const width = canvas.width * 0.7;
      const startX = (canvas.width - width) / 2;
      const gap = width / count;
      context.save();
      context.fillStyle = this.state.visualizer.accent;
      for (let index = 0; index < count; index += 1) {
        const value = (frequency[index * 2] || 18 + Math.sin(index) * 8) / 255;
        const height = Math.max(3, value * canvas.height * 0.17 + beat * canvas.height * 0.025);
        context.globalAlpha = 0.36 + value * 0.64;
        context.fillRect(startX + index * gap, canvas.height * 0.78 - height, Math.max(2, gap * 0.55), height);
      }
      context.restore();
    }

    drawWaveform(context, canvas, waveform, beat) {
      context.save();
      context.strokeStyle = this.state.visualizer.accent;
      context.shadowColor = this.state.visualizer.accent;
      context.shadowBlur = 16 + beat * 42;
      context.lineWidth = Math.max(2, canvas.width / 620);
      context.globalAlpha = 0.86;
      context.beginPath();
      const length = waveform.length || 1;
      for (let index = 0; index < length; index += 1) {
        const x = index / (length - 1 || 1) * canvas.width;
        const normalized = ((waveform[index] == null ? 128 : waveform[index]) - 128) / 128;
        const y = canvas.height * 0.62 + normalized * canvas.height * (0.08 + beat * 0.09);
        if (!index) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.stroke();
      context.restore();
    }

    drawTypography(context, canvas, beat) {
      const config = this.state.visualizer;
      const audio = this.host.querySelector("[data-mvs-audio]");
      const lines = config.lyrics.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      let lyric = "";
      if (lines.length) {
        const duration = audio && Number.isFinite(audio.duration) ? audio.duration : lines.length * 4;
        const current = audio ? audio.currentTime : 0;
        lyric = lines[Math.min(lines.length - 1, Math.floor(current / Math.max(0.5, duration / lines.length)))] || "";
      }
      context.save();
      context.textAlign = "center";
      context.fillStyle = "#ffffff";
      context.shadowColor = "rgba(0,0,0,.8)";
      context.shadowBlur = 18;
      context.font = `800 ${Math.round(canvas.width * 0.064 * (1 + beat * 0.025))}px system-ui, sans-serif`;
      context.fillText(config.title, canvas.width / 2, canvas.height * 0.38, canvas.width * 0.84);
      context.fillStyle = config.accent;
      context.font = `700 ${Math.round(canvas.width * 0.021)}px system-ui, sans-serif`;
      context.fillText(config.subtitle, canvas.width / 2, canvas.height * 0.45, canvas.width * 0.78);
      if (lyric) {
        context.fillStyle = "#ffffff";
        context.font = `650 ${Math.round(canvas.width * 0.027)}px system-ui, sans-serif`;
        context.fillText(lyric, canvas.width / 2, canvas.height * 0.89, canvas.width * 0.82);
      }
      context.restore();
    }

    drawSafeZone(context, canvas) {
      const dimensions = templateDimensions(this.state.visualizer.template);
      const insetX = canvas.width * dimensions.safe;
      const insetY = canvas.height * dimensions.safe;
      context.save();
      context.setLineDash([Math.max(8, canvas.width / 90), Math.max(5, canvas.width / 150)]);
      context.strokeStyle = "rgba(255,255,255,.38)";
      context.lineWidth = Math.max(1, canvas.width / 1000);
      context.strokeRect(insetX, insetY, canvas.width - insetX * 2, canvas.height - insetY * 2);
      context.restore();
    }

    async toggleRecording() {
      if (this.recorder && this.recorder.state === "recording") {
        this.recorder.stop();
        return;
      }
      const capabilities = visualizerCapabilities(globalScope);
      if (!capabilities.recording) return this.toast("MediaRecorder hoặc canvas.captureStream không được hỗ trợ.", "error");
      try {
        const canvas = this.host.querySelector("[data-mvs-visual-canvas]");
        const videoStream = canvas.captureStream(30);
        let tracks = [...videoStream.getVideoTracks()];
        if (this.audioUrl) {
          const audio = await this.ensureVisualizerAudio();
          tracks = tracks.concat(this.mediaDestination.stream.getAudioTracks());
          audio.currentTime = 0;
          await audio.play();
        }
        const stream = new MediaStream(tracks);
        const types = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
        const mimeType = types.find((type) => !MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(type)) || "";
        this.recordChunks = [];
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 6000000 } : undefined);
        this.recorder = recorder;
        recorder.ondataavailable = (event) => { if (event.data && event.data.size) this.recordChunks.push(event.data); };
        recorder.onstop = () => {
          stream.getTracks().forEach((track) => track.stop());
          this.revokeUrl(this.recordUrl);
          const blob = new Blob(this.recordChunks, { type: recorder.mimeType || "video/webm" });
          this.recordUrl = this.addUrl(URL.createObjectURL(blob));
          const link = this.host.querySelector("[data-mvs-record-download]");
          if (link) { link.href = this.recordUrl; link.classList.remove("is-hidden"); link.textContent = `Tải WebM · ${(blob.size / 1048576).toFixed(1)} MB`; }
          this.host.querySelector("[data-mvs-record-light]")?.classList.remove("is-visible");
          this.toast("Đã tạo video WebM cục bộ.", "success");
        };
        recorder.start(1000);
        this.startVisualLoop();
        this.host.querySelector("[data-mvs-record-light]")?.classList.add("is-visible");
        this.toast("Đang ghi canvas và audio thành WebM.", "success");
      } catch (error) {
        this.toast(error.message || "Không thể bắt đầu ghi WebM.", "error");
      }
    }

    openVideoEditor() {
      const route = safeText(this.options.videoEditorRoute || "/media-design/video-editor", 200);
      this.host.dispatchEvent(new CustomEvent("hh:navigate", { bubbles: true, detail: { route } }));
      if (globalScope.location) globalScope.location.hash = route.startsWith("#") ? route : `#${route}`;
    }

    cleanupRuntime(closeAudio) {
      this.stopJam();
      this.stopVisualLoop();
      (this.automationTimers || []).forEach((timer) => clearTimeout(timer));
      this.automationTimers = [];
      if (this.recorder && this.recorder.state === "recording") {
        try {
          this.recorder.ondataavailable = null;
          this.recorder.onstop = null;
          this.recorder.stop();
          this.recorder.stream?.getTracks().forEach((track) => track.stop());
        } catch (_error) {}
      }
      this.recorder = null;
      const audio = this.host && this.host.querySelector("[data-mvs-audio]");
      if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); }
      if (closeAudio !== false && this.audioContext && this.audioContext.state !== "closed") {
        try { this.audioContext.close(); } catch (_error) {}
        this.audioContext = null;
      }
      this.mediaSource = null;
      this.mediaDestination = null;
      this.analyser = null;
      this.masterGain = null;
      this.filterNode = null;
    }

    destroy() {
      clearTimeout(this.toastTimer);
      this.cleanupRuntime(true);
      this.unbind();
      this.urls.forEach((url) => { try { URL.revokeObjectURL(url); } catch (_error) {} });
      this.urls.clear();
      this.imageUrl = "";
      this.coverUrl = "";
      this.audioUrl = "";
      this.recordUrl = "";
      this.coverImage = null;
      if (this.host) this.host.innerHTML = "";
    }
  }

  function mount(host, options) {
    if (!host || typeof host.querySelector !== "function") throw new TypeError("HHMusicVisualStudio.mount cần một host DOM hợp lệ.");
    unmount();
    activeInstance = new MusicVisualStudio(host, options || {});
    activeInstance.render();
    return activeInstance;
  }

  function unmount() {
    if (!activeInstance) return;
    activeInstance.destroy();
    activeInstance = null;
  }

  const publicApi = Object.freeze({ supports, mount, unmount });
  if (globalScope && typeof globalScope === "object") globalScope.HHMusicVisualStudio = publicApi;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      VERSION,
      STORAGE_KEY,
      VIEW_IDS,
      TEMPLATE_SIZES,
      normalizeState,
      normalizeAutomation,
      analyzeImageData,
      buildMusicBrief,
      providerAdapterState,
      serializeAutomation,
      parseAutomation,
      visualizerCapabilities,
      templateDimensions,
      supports
    };
  }
})(typeof window !== "undefined" ? window : globalThis);
