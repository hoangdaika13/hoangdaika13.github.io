(function musicProductionSuite(globalScope) {
  "use strict";

  const PRIMARY_VIEWS = [
    { id: "composer", label: "Sáng tác", icon: "AI", engine: "HHMusicComposerLyrics" },
    { id: "lyrics", label: "Lời bài hát", icon: "LY", engine: "HHMusicComposerLyrics" },
    { id: "arrange", label: "Phối khí", icon: "AR", engine: "HHMusicDAWWorkspace" },
    { id: "record", label: "Thu âm", icon: "RE", engine: "HHMusicDAWWorkspace" },
    { id: "mix", label: "Mix", icon: "MX", engine: "HHMusicMixMaster" },
    { id: "master", label: "Master", icon: "MA", engine: "HHMusicMixMaster" },
    { id: "video", label: "Video", icon: "VI", engine: "HHMusicVisualStudio" },
    { id: "publish", label: "Xuất bản", icon: "UP", engine: "HHMusicPublishingRights" }
  ];

  const LAB_VIEWS = [
    { id: "musical-brain", label: "HH Musical Brain", description: "BPM, tone, hợp âm, cấu trúc và Song DNA dùng chung.", icon: "MB", engine: "HHMusicIntelligenceEngine" },
    { id: "audio-midi", label: "Audio-to-MIDI 2.0", description: "Phân tích note, hợp âm, quantize và xuất MIDI chuẩn.", icon: "M2", engine: "HHMusicIntelligenceEngine" },
    { id: "session-band", label: "AI Session Band", description: "Sáu nhạc công ảo đi theo Chord Track và vẫn sửa được MIDI.", icon: "SB", engine: "HHMusicGenerativeArrangement" },
    { id: "region-editor", label: "Generative Region", description: "Tạo nhánh, thay đoạn và giữ seed theo cách không phá hủy.", icon: "GR", engine: "HHMusicGenerativeArrangement" },
    { id: "adaptive-soundtrack", label: "Adaptive Soundtrack", description: "Cue sheet theo cảnh, cảm xúc và thời lượng video.", icon: "AS", engine: "HHMusicAdaptiveLibrary" },
    { id: "sample-browser", label: "Semantic Samples", description: "Tìm sample theo mô tả, độ tương tự, BPM, tone và giấy phép.", icon: "SS", engine: "HHMusicAdaptiveLibrary" },
    { id: "mix-doctor", label: "AI Mix Doctor", description: "Chẩn đoán mix, giải thích vấn đề và so sánh A/B minh bạch.", icon: "MD", engine: "HHMusicMixPerformance" },
    { id: "live-performance", label: "Live Performance", description: "Clip scene, MIDI Learn, macro và automation trực tiếp.", icon: "LP", engine: "HHMusicMixPerformance" },
    { id: "project-branches", label: "Project Branches", description: "Nhánh phối, comment timestamp, review và khóa track.", icon: "PB", engine: "HHMusicProjectGovernance" },
    { id: "release-manager", label: "Release Manager", description: "Metadata, split, consent, preflight và provenance manifest.", icon: "RM", engine: "HHMusicProjectGovernance" },
    { id: "stems", label: "Stem & Remix", description: "Tách, cân chỉnh và xuất từng stem đồng bộ.", icon: "SM", engine: "HHMusicAudioLabs" },
    { id: "vocal", label: "Vocal Studio", description: "Thu take, xử lý giọng và căn lời theo thời gian.", icon: "VO", engine: "HHMusicAudioLabs" },
    { id: "sound-design", label: "Sound Design", description: "Tạo ambience, Foley, impact, riser và loop.", icon: "FX", engine: "HHMusicAudioLabs" },
    { id: "image-music", label: "Image-to-Music", description: "Biến màu sắc và bối cảnh ảnh thành music brief.", icon: "IM", engine: "HHMusicVisualStudio" },
    { id: "realtime-jam", label: "Realtime Jam", description: "Biểu diễn mood, groove, density và tension.", icon: "JM", engine: "HHMusicVisualStudio" },
    { id: "visualizer", label: "Visualizer", description: "Waveform, spectrum, particle và lyric animation.", icon: "VZ", engine: "HHMusicVisualStudio" },
    { id: "rights", label: "Rights & Provenance", description: "Nguồn asset, consent, giấy phép và manifest.", icon: "RC", engine: "HHMusicPublishingRights" }
  ];

  const ALL_VIEWS = new Map([...PRIMARY_VIEWS, ...LAB_VIEWS].map((item) => [item.id, item]));
  const STORAGE_KEY = "hh.music.production-suite.v1";
  let activeHost = null;
  let activeEngine = null;
  let activeOptions = {};
  let clockTimer = 0;

  function supports(id) {
    return id === "studio" || ALL_VIEWS.has(id);
  }

  function readState() {
    const fallback = { project: "HH Music Project", bpm: 96, key: "C minor", progress: 32, playing: false };
    try {
      return { ...fallback, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
    } catch (_error) {
      return fallback;
    }
  }

  function writeState(nextState) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch (_error) {
      // The workspace remains usable when storage is unavailable.
    }
  }

  function escapeText(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function capability(name) {
    switch (name) {
      case "audio": return Boolean(globalScope.AudioContext || globalScope.webkitAudioContext);
      case "record": return Boolean(globalScope.MediaRecorder && navigator.mediaDevices?.getUserMedia);
      case "files": return Boolean(globalScope.FileReader && globalScope.Blob);
      case "canvas": return Boolean(globalScope.HTMLCanvasElement);
      case "online": return navigator.onLine;
      default: return false;
    }
  }

  function shellMarkup(view) {
    const active = supports(view) ? view : "studio";
    return `
      <section class="mps-shell" data-mps-view="${escapeText(active)}" aria-label="HH Music Production Studio">
        <header class="mps-header">
          <button class="mps-brand" type="button" data-mps-route="studio" aria-label="Mở tổng quan Music Studio">
            <span class="mps-brand-mark" aria-hidden="true">HH</span>
            <span><strong>Music Production Studio</strong><small>Local-first DAW + AI workflow</small></span>
          </button>
          <div class="mps-project-state" aria-label="Trạng thái dự án">
            <span class="mps-live-dot" aria-hidden="true"></span>
            <span>Autosave</span>
            <time data-mps-clock></time>
          </div>
        </header>
        <nav class="mps-workspace-tabs" role="tablist" aria-label="Workspace sản xuất nhạc">
          ${PRIMARY_VIEWS.map((item) => `
            <button type="button" role="tab" aria-selected="${item.id === active}" class="${item.id === active ? "is-active" : ""}" data-mps-route="${item.id}">
              <span aria-hidden="true">${item.icon}</span><strong>${item.label}</strong>
            </button>`).join("")}
        </nav>
        <div class="mps-stage" data-mps-stage></div>
      </section>`;
  }

  function overviewMarkup() {
    const state = readState();
    const runtime = [
      ["Web Audio", capability("audio")],
      ["Thu micro", capability("record")],
      ["File local", capability("files")],
      ["Canvas video", capability("canvas")],
      ["Kết nối", capability("online")]
    ];
    const steps = [
      ["01", "Brief", "Ý tưởng và mood"],
      ["02", "Compose", "Section và variation"],
      ["03", "Arrange", "Track, take và stem"],
      ["04", "Mix", "Bus, send và automation"],
      ["05", "Deliver", "Rights và xuất bản"]
    ];

    return `
      <div class="mps-overview">
        <section class="mps-hero">
          <div class="mps-hero-copy">
            <p class="mps-kicker">HH AUDIO ENGINE / PROJECT 01</p>
            <h1>Từ ý tưởng đến bản phát hành trong một phòng thu.</h1>
            <p>Sáng tác với AI, biên tập nhiều track, thu giọng, mix, master, dựng visual và chuẩn bị xuất bản mà không làm mất project gốc.</p>
            <div class="mps-hero-actions">
              <button type="button" class="mps-primary" data-mps-route="composer">Bắt đầu sáng tác</button>
              <button type="button" class="mps-secondary" data-mps-route="arrange">Mở timeline</button>
            </div>
          </div>
          <div class="mps-now-playing" aria-label="Dự án hiện tại">
            <div class="mps-artwork" aria-hidden="true"><span></span><span></span><span></span><span></span><i>HH</i></div>
            <div class="mps-project-meta">
              <label>Tên dự án<input data-mps-project value="${escapeText(state.project)}" maxlength="80"></label>
              <div><strong>${escapeText(state.bpm)} BPM</strong><span>${escapeText(state.key)}</span></div>
              <div class="mps-progress"><i style="width:${Number(state.progress) || 0}%"></i></div>
              <small>${Number(state.progress) || 0}% quy trình sản xuất</small>
            </div>
          </div>
        </section>

        <section class="mps-flow" aria-label="Quy trình dự án">
          ${steps.map(([number, title, copy], index) => `<article class="${index === 0 ? "is-current" : ""}"><span>${number}</span><strong>${title}</strong><small>${copy}</small></article>`).join("")}
        </section>

        <div class="mps-dashboard-grid">
          <section class="mps-panel mps-session-panel">
            <div class="mps-panel-head"><div><p class="mps-kicker">SESSION</p><h2>Tiếp tục sản xuất</h2></div><span>5 workspace</span></div>
            <div class="mps-session-list">
              ${PRIMARY_VIEWS.slice(0, 5).map((item, index) => `<button type="button" data-mps-route="${item.id}"><span>${item.icon}</span><div><strong>${item.label}</strong><small>${["Tạo section, seed và bản A/B", "Vần, âm tiết và phiên bản", "Timeline, clip và take lane", "Microphone và vocal take", "Bus, send và automation"][index]}</small></div><i aria-hidden="true">›</i></button>`).join("")}
            </div>
          </section>

          <section class="mps-panel mps-meter-panel">
            <div class="mps-panel-head"><div><p class="mps-kicker">MASTER</p><h2>Output Monitor</h2></div><span>-14 LUFS</span></div>
            <div class="mps-spectrum" aria-hidden="true">${Array.from({ length: 28 }, (_, index) => `<i style="--bar:${18 + ((index * 37) % 76)}%"></i>`).join("")}</div>
            <div class="mps-master-stats"><span><small>True Peak</small><strong>-1.0 dB</strong></span><span><small>Stereo</small><strong>82%</strong></span><span><small>Headroom</small><strong>6 dB</strong></span></div>
            <button type="button" class="mps-wide-action" data-mps-route="master">Mở phòng Master</button>
          </section>
        </div>

        <section class="mps-labs">
          <div class="mps-section-heading"><div><p class="mps-kicker">SPECIALIZED ROOMS</p><h2>Phòng lab chuyên sâu</h2></div><p>Mỗi công cụ chạy độc lập và lưu trạng thái riêng.</p></div>
          <div class="mps-lab-grid">${LAB_VIEWS.map((item) => `
            <button type="button" data-mps-route="${item.id}">
              <span>${item.icon}</span><div><strong>${item.label}</strong><small>${item.description}</small></div><i aria-hidden="true">Mở</i>
            </button>`).join("")}</div>
        </section>

        <section class="mps-runtime">
          <div><p class="mps-kicker">RUNTIME</p><h2>Năng lực thiết bị</h2><small>Quyền micro chỉ được hỏi khi bạn chủ động thu âm.</small></div>
          <div>${runtime.map(([label, ready]) => `<span class="${ready ? "is-ready" : "is-off"}"><i></i>${label}<strong>${ready ? "Sẵn sàng" : "Chưa có"}</strong></span>`).join("")}</div>
        </section>
      </div>`;
  }

  function stopClock() {
    if (clockTimer) globalScope.clearInterval(clockTimer);
    clockTimer = 0;
  }

  function startClock() {
    stopClock();
    const update = () => {
      const clock = activeHost?.querySelector("[data-mps-clock]");
      if (clock) clock.textContent = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());
    };
    update();
    clockTimer = globalScope.setInterval(update, 1000);
  }

  function teardownEngine() {
    if (activeEngine?.unmount) {
      try { activeEngine.unmount(); } catch (_error) { /* A failed child cleanup must not block navigation. */ }
    }
    activeEngine = null;
  }

  function routeTo(view) {
    if (!supports(view)) return;
    if (typeof activeOptions.onNavigate === "function") {
      activeOptions.onNavigate(view);
      return;
    }
    if (activeHost) mount(activeHost, { ...activeOptions, view });
  }

  function bindShell(view) {
    activeHost.querySelectorAll("[data-mps-route]").forEach((button) => {
      button.addEventListener("click", () => routeTo(button.dataset.mpsRoute));
    });
    const projectInput = activeHost.querySelector("[data-mps-project]");
    projectInput?.addEventListener("input", () => writeState({ ...readState(), project: projectInput.value }));
    activeHost.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && view !== "studio") routeTo("studio");
    }, { once: true });
  }

  function renderView(view) {
    const stage = activeHost.querySelector("[data-mps-stage]");
    if (!stage) return;
    if (view === "studio") {
      stage.innerHTML = overviewMarkup();
      return;
    }

    const definition = ALL_VIEWS.get(view);
    const engine = definition ? globalScope[definition.engine] : null;
    if (!engine?.supports?.(view) || typeof engine.mount !== "function") {
      stage.innerHTML = `<section class="mps-engine-error"><strong>Workspace chưa sẵn sàng</strong><p>Không tìm thấy engine ${escapeText(definition?.label || view)}. Hãy tải lại trang để nạp đầy đủ tài nguyên.</p><button type="button" data-mps-route="studio">Về tổng quan</button></section>`;
      return;
    }
    activeEngine = engine;
    engine.mount(stage, { view, onNavigate: routeTo });
  }

  function mount(host, options = {}) {
    if (!host || typeof host.replaceChildren !== "function") return false;
    unmount();
    activeHost = host;
    activeOptions = options || {};
    const requested = supports(options.view) ? options.view : "studio";
    host.innerHTML = shellMarkup(requested);
    bindShell(requested);
    renderView(requested);
    startClock();
    return true;
  }

  function unmount() {
    stopClock();
    teardownEngine();
    if (activeHost) activeHost.replaceChildren();
    activeHost = null;
    activeOptions = {};
  }

  globalScope.HHMusicProductionSuite = Object.freeze({ supports, mount, unmount });
})(window);
