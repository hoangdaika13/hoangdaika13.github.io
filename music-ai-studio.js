(function () {
  "use strict";

  const STORAGE_KEY = "hh.music-ai-studio.v1";
  const VIEWS = [
    { id: "project", label: "Xưởng sản xuất", icon: "01" },
    { id: "app-center", label: "AI Apps", icon: "02" },
    { id: "concept-lab", label: "Concept", icon: "03" },
    { id: "image-lab", label: "Tạo ảnh", icon: "04" },
    { id: "music-lab", label: "Tạo nhạc", icon: "05" },
    { id: "veo-lab", label: "Tạo video", icon: "06" },
    { id: "render-lab", label: "Render", icon: "07" },
    { id: "prompt-studio", label: "Prompt đồng bộ", icon: "08" },
    { id: "loop-builder", label: "Loop 1–5 giờ", icon: "09" },
    { id: "audio-qa", label: "Kiểm âm", icon: "10" },
    { id: "chapters", label: "Tracklist & chapter", icon: "11" },
    { id: "youtube-pack", label: "Gói YouTube", icon: "12" },
    { id: "youtube-publisher", label: "Đăng YouTube", icon: "13" },
    { id: "publish-checklist", label: "Kiểm tra xuất bản", icon: "14" }
  ];
  const APP_VIEWS = new Set(["app-center", "concept-lab", "image-lab", "music-lab", "veo-lab", "render-lab"]);

  const PRESETS = {
    piano: {
      label: "Relax Piano",
      bpm: 62,
      mood: "peaceful, warm, intimate and deeply relaxing",
      instruments: "felt piano, soft room ambience, subtle warm pads, no percussion",
      scene: "a warm piano beside a rain-covered window in a quiet mountain cabin at night",
      palette: "deep navy, warm amber, soft teal",
      title: "Relaxing Piano for Sleep, Study & Stress Relief"
    },
    meditation: {
      label: "Thiền & Ngủ sâu",
      bpm: 52,
      mood: "serene, spacious, restorative and meditative",
      instruments: "soft singing bowls, airy pads, distant water, sparse felt piano, no drums",
      scene: "a moonlit zen garden with a still lake, gentle mist and distant mountains",
      palette: "midnight blue, jade, moon silver",
      title: "Deep Meditation Music for Sleep, Calm & Inner Peace"
    },
    jazz: {
      label: "Slow Jazz Café",
      bpm: 82,
      mood: "cozy, elegant, nostalgic and unhurried",
      instruments: "warm jazz piano, upright bass, brushed drums, mellow saxophone used sparingly",
      scene: "a small neon jazz café on a rainy city street, empty tables and warm window light",
      palette: "burgundy, gold, midnight cyan",
      title: "Cozy Night Jazz Café – Relax, Work & Unwind"
    },
    lofi: {
      label: "Lofi Focus",
      bpm: 74,
      mood: "dreamy, focused, nostalgic and gently uplifting",
      instruments: "dusty electric piano, mellow bass, soft vinyl texture, restrained lofi drums",
      scene: "a cozy attic studio overlooking a futuristic rainy city, desk lamp and plants",
      palette: "violet, cyan, rose pink",
      title: "Lofi Beats for Study, Focus & Late Night Work"
    }
  };

  const PUBLISH_CHECKS = [
    ["rightsMusic", "Đã kiểm tra quyền thương mại của nhạc và lưu bằng chứng"],
    ["rightsVisual", "Ảnh/video không vi phạm bản quyền, không còn watermark"],
    ["loopVisual", "Điểm đầu và cuối chuyển động khớp, không giật khi loop"],
    ["audioPeak", "Đã kiểm âm: không clipping, không tiếng nổ hoặc khoảng lặng ngoài ý muốn"],
    ["fullWatch", "Đã xem/nghe thử đầu, giữa, cuối bản dựng"],
    ["chapterRule", "Chapter bắt đầu 00:00, có ít nhất 3 mục và mỗi mục dài ≥ 10 giây"],
    ["verified", "Kênh YouTube đã xác minh để tải video dài hơn 15 phút"],
    ["metadata", "Đã có tiêu đề, mô tả, thumbnail, tag và playlist"],
    ["privateUpload", "Đã tải thử ở chế độ Riêng tư/Không công khai trước khi phát hành"]
  ];

  const defaultState = () => ({
    project: {
      name: "HH Relax Session 01",
      genre: "piano",
      hours: 3,
      bpm: PRESETS.piano.bpm,
      mood: PRESETS.piano.mood,
      instruments: PRESETS.piano.instruments,
      scene: PRESETS.piano.scene,
      palette: PRESETS.piano.palette,
      masterMinutes: 30,
      visualSeconds: 8,
      resolution: "1080p",
      fps: 30,
      visualType: "video"
    },
    chapters: [
      { name: "Rainy Window", duration: "30:00" },
      { name: "Quiet Keys", duration: "30:00" },
      { name: "Moonlit Room", duration: "30:00" },
      { name: "Deep Rest", duration: "30:00" },
      { name: "Soft Morning", duration: "30:00" },
      { name: "Peaceful Return", duration: "30:00" }
    ],
    checklist: {},
    media: { visualName: "", visualDuration: 0, audioName: "", audioDuration: 0 },
    smartLoop: {
      targetDuration: "03:00:00",
      mode: "auto",
      transitionSeconds: 0.8,
      interpolation: true,
      analysis: null
    },
    automation: {
      idea: "Một đêm mưa yên tĩnh trong cabin trên núi, piano ấm áp để ngủ và thư giãn",
      trackSeconds: 60,
      plan: "",
      operationName: "",
      lastRunAt: "",
      lastError: "",
      stages: {}
    },
    qa: null,
    updatedAt: new Date().toISOString()
  });

  let host = null;
  let state = defaultState();
  let view = "project";
  let controller = null;
  let audioContext = null;
  let visualUrl = "";
  let audioUrl = "";
  let generatedImage = null;
  let generatedAudio = null;
  let generatedVideo = null;
  let providerStatus = null;
  let pipelineRunning = false;
  let pipelineCancelled = false;
  const ASSET_DB = "hh-music-ai-assets-v1";

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || min));
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const formatDuration = (seconds) => {
    const safe = Math.max(0, Math.round(number(seconds)));
    const h = Math.floor(safe / 3600);
    const m = Math.floor((safe % 3600) / 60);
    const s = safe % 60;
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  };
  const parseDuration = (value) => {
    const parts = String(value || "").trim().split(":").map(Number);
    if (!parts.length || parts.some((part) => !Number.isFinite(part) || part < 0)) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0];
  };

  function loadState() {
    const base = defaultState();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return base;
      return {
        ...base,
        ...saved,
        project: { ...base.project, ...(saved.project || {}) },
        media: { ...base.media, ...(saved.media || {}) },
        smartLoop: { ...base.smartLoop, targetDuration: saved.smartLoop?.targetDuration || `${clamp(saved.project?.hours || base.project.hours, 1, 8)}:00:00`, ...(saved.smartLoop || {}) },
        automation: { ...base.automation, ...(saved.automation || {}), stages: { ...base.automation.stages, ...(saved.automation?.stages || {}) } },
        chapters: Array.isArray(saved.chapters) && saved.chapters.length ? saved.chapters : base.chapters,
        checklist: { ...(saved.checklist || {}) }
      };
    } catch {
      return base;
    }
  }

  function saveState() {
    state.updatedAt = new Date().toISOString();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  function assetDatabase() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error("Trình duyệt không hỗ trợ IndexedDB."));
      const request = indexedDB.open(ASSET_DB, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("assets")) request.result.createObjectStore("assets");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Không mở được kho media."));
    });
  }

  async function storeAsset(kind, blob) {
    const db = await assetDatabase();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("assets", "readwrite");
      transaction.objectStore("assets").put(blob, kind);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }

  async function readAsset(kind) {
    const db = await assetDatabase();
    const value = await new Promise((resolve, reject) => {
      const request = db.transaction("assets", "readonly").objectStore("assets").get(kind);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return value;
  }

  function base64ToBlob(data, mimeType) {
    const binary = atob(String(data || "").replace(/^data:[^;]+;base64,/, ""));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: mimeType || "application/octet-stream" });
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
      reader.onerror = () => reject(reader.error || new Error("Không đọc được media."));
      reader.readAsDataURL(blob);
    });
  }

  function replaceAssetUrl(asset, blob) {
    if (asset?.url) URL.revokeObjectURL(asset.url);
    return { blob, url: URL.createObjectURL(blob), mimeType: blob.type || "application/octet-stream" };
  }

  async function restoreGeneratedAssets() {
    try {
      const [image, audio, video] = await Promise.all([readAsset("image"), readAsset("audio"), readAsset("video")]);
      if (image instanceof Blob) generatedImage = replaceAssetUrl(generatedImage, image);
      if (audio instanceof Blob) generatedAudio = replaceAssetUrl(generatedAudio, audio);
      if (video instanceof Blob) generatedVideo = replaceAssetUrl(generatedVideo, video);
      if (host && view === "project") render();
    } catch {}
  }

  function apiBase() {
    return String(window.HH_REALTIME_URL || location.origin).replace(/\/$/, "");
  }

  function authHeaders(json = true) {
    const token = window.HHAuthSession?.token?.() || "";
    return { ...(json ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  }

  async function musicApi(actionType, input = "", meta = {}) {
    const response = await fetch(`${apiBase()}/api/modules/music-ai/actions`, {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ actionType, input, meta }),
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || `Music AI API lỗi HTTP ${response.status}.`);
      error.code = data.code || "MUSIC_AI_API_ERROR";
      error.status = response.status;
      throw error;
    }
    return data;
  }

  async function refreshProviders(shouldRender = true) {
    try {
      const response = await fetch(`${apiBase()}/api/modules/music-ai/actions`, { headers: authHeaders(false), cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      providerStatus = await response.json();
    } catch (error) {
      providerStatus = { canRunMedia: false, providers: {}, error: `Không kết nối backend: ${error.message}` };
    }
    if (shouldRender && host && view === "project") render();
    return providerStatus;
  }

  function setPipelineStage(id, status, detail = "") {
    state.automation.stages[id] = { status, detail, updatedAt: new Date().toISOString() };
    saveState();
    if (host && view === "project") render();
  }

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function projectMath() {
    const project = state.project;
    const targetSeconds = clamp(project.hours, 1, 5) * 3600;
    const audioSeconds = Math.max(60, clamp(project.masterMinutes, 1, 600) * 60);
    const visualSeconds = Math.max(1, clamp(project.visualSeconds, 1, 600));
    const videoMbps = project.resolution === "2160p" ? 45 : project.resolution === "1440p" ? 16 : 8;
    const outputGb = (targetSeconds * (videoMbps + 0.384)) / 8 / 1024;
    return {
      targetSeconds,
      audioSeconds,
      visualSeconds,
      audioLoops: Math.ceil(targetSeconds / audioSeconds),
      visualLoops: project.visualType === "image" ? 1 : Math.ceil(targetSeconds / visualSeconds),
      videoMbps,
      outputGb
    };
  }

  function promptPack() {
    const p = state.project;
    const preset = PRESETS[p.genre] || PRESETS.piano;
    const duration = `${clamp(p.hours, 1, 5)}-hour`;
    return {
      image: `Create a premium cinematic 16:9 YouTube background for a ${preset.label} channel. Scene: ${p.scene}. Mood: ${p.mood}. Color palette: ${p.palette}. Rich atmospheric depth, realistic soft lighting, tasteful composition, crisp focal details, subtle foreground and background layers, generous negative space for an optional title, no text, no logo, no watermark, no deformed objects. The frame must be animation-friendly: stable geometry, locked perspective, no people close to camera, natural elements that can move subtly. Ultra-detailed, polished, calm, 4K landscape.`,
      motion: `Animate this still image as a seamless ${clamp(p.visualSeconds, 4, 20)}-second ambient loop for a ${duration} relaxation video. Keep the camera completely locked. Add only slow cyclical micro-motion: gentle rain or drifting particles, very subtle light breathing, soft steam or fog, tiny plant movement and restrained reflections. Preserve every object, face and architectural line. No cuts, no zoom, no pan, no camera shake, no morphing, no new objects, no sudden brightness change, no text. Match the final frame to the first frame in motion, lighting and composition for an invisible loop. Calm cinematic motion, 16:9, ${p.resolution}, ${p.fps} fps.`,
      music: `Instrumental ${preset.label} for a long-form YouTube relaxation session. ${p.mood}. Tempo ${clamp(p.bpm, 40, 120)} BPM. Instrumentation: ${p.instruments}. Create a memorable but unobtrusive motif, gentle dynamics, warm spacious mix, clean low end and natural stereo depth. No vocals, no spoken word, no abrupt transitions, no dramatic risers, no harsh high frequencies, no sudden percussion fills. Build a smooth beginning and ending that can crossfade cleanly. Target a ${clamp(p.masterMinutes, 5, 120)}-minute master made of evolving sections with subtle variation so repetition is not obvious. Original composition; do not imitate a named artist or copyrighted song.`,
      thumbnail: `Design a high-click-through YouTube thumbnail based on: ${p.scene}. ${p.palette} palette, cinematic contrast, one unmistakable focal point, premium lighting, clean 16:9 composition, readable at phone size. Reserve one uncluttered area for 2–4 words of large title text, but generate no text, logo or watermark. Make it emotionally calming, distinctive and not visually noisy.`,
      negative: "watermark, logo, text, subtitles, camera movement, zoom, flicker, morphing, warped architecture, duplicated objects, extra limbs, sudden motion, harsh contrast, oversaturation, low resolution, compression artifacts"
    };
  }

  function chapterOutput() {
    let cursor = 0;
    const valid = state.chapters.map((item) => ({ name: String(item.name || "Untitled").trim(), seconds: parseDuration(item.duration) })).filter((item) => item.seconds > 0);
    const lines = valid.map((item) => {
      const line = `${formatDuration(cursor)} ${item.name}`;
      cursor += item.seconds;
      return line;
    });
    return { lines, total: cursor, valid, okay: lines.length >= 3 && valid.every((item) => item.seconds >= 10) && lines[0]?.startsWith("0:00") };
  }

  function youtubePack() {
    const p = state.project;
    const preset = PRESETS[p.genre] || PRESETS.piano;
    const hours = clamp(p.hours, 1, 5);
    const chapters = chapterOutput().lines.join("\n");
    const focus = p.genre === "meditation" ? "sleep, meditation and stress relief" : p.genre === "jazz" ? "relaxing, working and late-night ambience" : p.genre === "lofi" ? "study, focus and deep work" : "sleep, study and relaxation";
    const title = `${preset.title} | ${hours} Hour${hours > 1 ? "s" : ""}`;
    const description = `${title}\n\nA carefully crafted ${preset.label.toLowerCase()} session for ${focus}. Put on your headphones, lower the volume and let this original soundscape stay with you.\n\n🎧 Best for: ${focus}\n⏱ Duration: ${hours} hour${hours > 1 ? "s" : ""}\n🎼 Tempo: ${p.bpm} BPM\n🎨 Visual: ${p.scene}\n\nTRACKLIST\n${chapters || "0:00 Full session"}\n\nIf this session helps you, save it to a playlist and return whenever you need a quieter space.\n\n#RelaxingMusic #${p.genre === "lofi" ? "Lofi" : p.genre === "jazz" ? "Jazz" : p.genre === "meditation" ? "MeditationMusic" : "RelaxingPiano"} #StudyMusic #SleepMusic`;
    const tags = [preset.label, "relaxing music", "study music", "sleep music", "focus music", "ambient music", `${hours} hour music`, "calm music", "stress relief", "background music", "HH Music"].join(", ");
    return { title, description, tags, thumbnailText: p.genre === "meditation" ? "DEEP PEACE" : p.genre === "jazz" ? "NIGHT JAZZ" : p.genre === "lofi" ? "FOCUS MODE" : "QUIET PIANO" };
  }

  function smartLoopTargetSeconds() {
    const parsed = parseDuration(state.smartLoop?.targetDuration);
    return Math.round(clamp(parsed || projectMath().targetSeconds, 5, 8 * 3600));
  }

  function resolvedSmartLoopMode() {
    if (state.project.visualType === "image") return "direct";
    if (state.smartLoop.mode !== "auto") return state.smartLoop.mode;
    const analysis = state.smartLoop.analysis;
    if (!analysis) return "crossfade";
    if (analysis.seamScore >= 86) return "direct";
    if (analysis.motionEnergy <= 18 && analysis.seamScore < 55) return "pingpong";
    return "crossfade";
  }

  function smartLoopProfile() {
    const p = state.project;
    const math = projectMath();
    const mode = resolvedSmartLoopMode();
    const duration = Math.max(1, number(state.media.visualDuration, number(p.visualSeconds, 8)));
    const maxTransition = Math.max(.15, Math.min(1.5, duration / 3));
    const transition = clamp(state.smartLoop.transitionSeconds, .15, maxTransition);
    const size = p.resolution === "2160p" ? "3840:2160" : p.resolution === "1440p" ? "2560:1440" : "1920:1080";
    const interpolate = state.smartLoop.interpolation
      ? `minterpolate=fps=${p.fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,`
      : `fps=${p.fps},`;
    const normalize = `${interpolate}settb=AVTB,scale=${size}:force_original_aspect_ratio=increase,crop=${size},format=yuv420p`;
    let prepare = "";
    let unitDuration = duration;
    if (p.visualType !== "image" && mode === "crossfade") {
      const rotateAt = Math.min(duration / 2, Math.max(transition + .12, 1));
      const offset = Math.max(.01, duration - rotateAt - transition);
      unitDuration = Math.max(.5, duration - transition);
      prepare = `ffmpeg -y -i "visual.mp4" -filter_complex "[0:v]${normalize},split=2[tail0][head0];[tail0]trim=start=${rotateAt.toFixed(3)},setpts=PTS-STARTPTS[tail];[head0]trim=end=${rotateAt.toFixed(3)},setpts=PTS-STARTPTS[head];[tail][head]xfade=transition=fade:duration=${transition.toFixed(3)}:offset=${offset.toFixed(3)}[loopv]" -map "[loopv]" -an -c:v libx264 -preset slow -crf 17 -movflags +faststart "seamless-loop.mp4"`;
    } else if (p.visualType !== "image" && mode === "pingpong") {
      unitDuration = duration * 2;
      prepare = `ffmpeg -y -i "visual.mp4" -filter_complex "[0:v]${normalize},split=2[forward][reverse0];[reverse0]reverse,setpts=PTS-STARTPTS[reverse];[forward][reverse]concat=n=2:v=1:a=0[loopv]" -map "[loopv]" -an -c:v libx264 -preset slow -crf 17 -movflags +faststart "seamless-loop.mp4"`;
    }
    return { mode, duration, transition, size, prepare, unitDuration, videoRate: `${math.videoMbps}M` };
  }

  function ffmpegCommand() {
    const p = state.project;
    const math = projectMath();
    const profile = smartLoopProfile();
    const visualFile = p.visualType === "image" ? "cover.png" : profile.prepare ? "seamless-loop.mp4" : "visual.mp4";
    const visualInput = p.visualType === "image" ? `-loop 1 -i "${visualFile}"` : `-stream_loop -1 -i "${visualFile}"`;
    const output = String(p.name || "hh-relax").replace(/[\\/:*?"<>|]/g, "-");
    const render = `ffmpeg ${visualInput} -stream_loop -1 -i "music.wav" -t ${smartLoopTargetSeconds()} -map 0:v:0 -map 1:a:0 -vf "scale=${profile.size}:force_original_aspect_ratio=increase,crop=${profile.size},format=yuv420p" -r ${p.fps} -c:v libx264 -preset slow -crf 18 -maxrate ${profile.videoRate} -bufsize ${math.videoMbps * 2}M -c:a aac -b:a 384k -ar 48000 -movflags +faststart -shortest "${output}.mp4"`;
    return [profile.prepare, render].filter(Boolean).join("\r\n");
  }

  function smartLoopBat() {
    const commands = ffmpegCommand().split(/\r?\n/).filter(Boolean);
    const steps = commands.flatMap((command, index) => [
      `echo [${index + 1}/${commands.length}] ${index === 0 && commands.length > 1 ? "Tao seamless loop-unit" : "Render video dai"}...`,
      command,
      "if errorlevel 1 goto :error"
    ]);
    return [
      "@echo off",
      "setlocal",
      "chcp 65001 >nul",
      "where ffmpeg >nul 2>nul",
      "if errorlevel 1 (echo Khong tim thay FFmpeg trong PATH. & goto :error)",
      ...steps,
      "echo.",
      "echo HOAN TAT - video da duoc tao.",
      "goto :done",
      ":error",
      "echo.",
      "echo DUNG DO LOI - kiem tra ten visual.mp4, music.wav va FFmpeg.",
      ":done",
      "pause"
    ].join("\r\n");
  }

  const cardMetric = (value, label, tone = "") => `<article class="mai-metric ${tone}"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></article>`;
  const field = (label, key, type = "text", attrs = "") => `<label class="mai-field"><span>${label}</span><input type="${type}" data-project-field="${key}" value="${escapeHtml(state.project[key])}" ${attrs}></label>`;
  const selectField = (label, key, options) => `<label class="mai-field"><span>${label}</span><select data-project-field="${key}">${options.map(([value, text]) => `<option value="${value}" ${String(state.project[key]) === String(value) ? "selected" : ""}>${text}</option>`).join("")}</select></label>`;

  function headerHtml() {
    const progress = Math.round(Object.values(state.checklist || {}).filter(Boolean).length / PUBLISH_CHECKS.length * 100);
    const current = VIEWS.find((item) => item.id === view) || VIEWS[0];
    if (APP_VIEWS.has(view) || view === "youtube-publisher") return "";
    if (view !== "project") return `<header class="mai-context-header">
      <div><p><i></i> HH MUSIC WORKSPACE</p><h2>${current.label}</h2><span>${state.project.name} · ${state.project.genre} · ${state.project.hours} giờ</span></div>
      <aside><button type="button" data-app-route="/music-ai/project">Về Xưởng sản xuất</button>${cardMetric(`${progress}%`, "Sẵn sàng", progress === 100 ? "is-good" : "")}</aside>
    </header>`;
    return `<header class="mai-hero">
      <div><p><i></i> HH MUSIC PRODUCTION OS</p><h2>Làm nhạc AI <em>từ ý tưởng đến YouTube</em></h2><span>Ảnh → chuyển động → nhạc → loop 1–5 giờ → kiểm âm → xuất bản.</span></div>
      <aside>${cardMetric(`${state.project.hours}H`, "Thời lượng")}${cardMetric(`${state.project.bpm}`, "BPM")}${cardMetric(`${progress}%`, "Sẵn sàng", progress === 100 ? "is-good" : "")}</aside>
    </header>`;
  }

  function automationView() {
    const automation = state.automation;
    const providers = providerStatus?.providers || {};
    const providerRows = [
      ["concept", "AI Concept", "Lập production brief và đồng bộ prompt"],
      ["image", "Gemini Images", "Tạo ảnh 16:9 ngay trong web"],
      ["music", "Eleven Music", "Tạo track instrumental 48 kHz"],
      ["video", "Google Veo", "Animate ảnh thành clip 8 giây"],
      ["renderer", "Render 1–5 giờ", "FFmpeg worker cho file cuối"]
    ];
    const stageRows = [
      ["concept", "Production brief"],
      ["image", "Ảnh nền 16:9"],
      ["music", "Track instrumental"],
      ["video", "Clip chuyển động"],
      ["package", "Gói dựng & YouTube"]
    ];
    const completed = stageRows.filter(([id]) => automation.stages?.[id]?.status === "done").length;
    const statusLabel = (status) => ({ idle: "Chờ", running: "Đang chạy", done: "Hoàn tất", blocked: "Chưa kết nối", error: "Lỗi", skipped: "Bỏ qua" }[status] || "Chờ");
    const assetButtons = [
      generatedImage ? `<button type="button" data-download-generated="image">Tải ảnh JPG</button>` : "",
      generatedAudio ? `<button type="button" data-download-generated="audio">Tải nhạc MP3</button>` : "",
      generatedVideo ? `<button type="button" data-download-generated="video">Tải video Veo</button>` : ""
    ].filter(Boolean).join("");
    return `<section class="mai-auto mai-panel">
      <header class="mai-auto__head"><div><p><i></i> ONE-CLICK AI PRODUCER</p><h3>Nhập một ý tưởng, hệ thống tự chạy cả dây chuyền</h3><span>AI lập concept, tạo ảnh, nhạc, chuyển động và đóng gói dự án mà không phải chuyển qua nhiều website.</span></div><div class="mai-auto__progress"><strong>${completed}/5</strong><span>${pipelineRunning ? "Đang sản xuất" : "Tiến độ"}</span></div></header>
      <div class="mai-auto__connections">${providerRows.map(([id, label, note]) => { const item = providers[id]; const ready = Boolean(item?.configured) && (id === "concept" || providerStatus?.canRunMedia); return `<article class="${ready ? "is-connected" : "is-missing"}"><i>${ready ? "✓" : "!"}</i><span><strong>${label}</strong><small>${item?.model || note}</small></span><b>${ready ? "Đã nối" : item?.configured ? "Cần quyền admin" : "Chưa cấu hình"}</b></article>`; }).join("")}</div>
      ${providerStatus?.error ? `<div class="mai-auto__notice is-error">${escapeHtml(providerStatus.error)}</div>` : ""}
      <div class="mai-auto__body">
        <section class="mai-auto__brief">
          <label><span>Ý tưởng video</span><textarea rows="4" data-automation-field="idea" placeholder="Ví dụ: cabin piano trong đêm mưa để ngủ sâu...">${escapeHtml(automation.idea)}</textarea></label>
          <div><label><span>Track mẫu</span><select data-automation-field="trackSeconds"><option value="30" ${automation.trackSeconds === 30 ? "selected" : ""}>30 giây · thử nhanh</option><option value="60" ${automation.trackSeconds === 60 ? "selected" : ""}>60 giây · cân bằng</option><option value="120" ${automation.trackSeconds === 120 ? "selected" : ""}>120 giây · chất lượng</option></select></label><label><span>Đầu ra</span><input value="${state.project.hours} giờ · ${state.project.resolution} · ${state.project.genre}" readonly></label></div>
          <div class="mai-auto__actions"><button class="mai-primary" type="button" data-run-auto ${pipelineRunning ? "disabled" : ""}>${pipelineRunning ? "Đang chạy…" : "▶ Chạy tự động toàn bộ"}</button>${pipelineRunning ? `<button type="button" data-stop-auto>Dừng sau bước hiện tại</button>` : ""}<button type="button" data-refresh-providers>Kiểm tra kết nối</button></div>
          <small>Media tính phí chỉ chạy cho tài khoản quản trị để tránh người khác tiêu hao credit API của bạn.</small>
        </section>
        <aside class="mai-auto__stages">${stageRows.map(([id, label], index) => { const stage = automation.stages?.[id] || { status: "idle", detail: "" }; return `<article class="is-${stage.status || "idle"}"><i>${String(index + 1).padStart(2, "0")}</i><span><strong>${label}</strong><small>${escapeHtml(stage.detail || "Sẵn sàng")}</small></span><b>${statusLabel(stage.status)}</b></article>`; }).join("")}</aside>
      </div>
      ${(generatedImage || generatedAudio || generatedVideo || automation.plan) ? `<section class="mai-auto__outputs"><div class="mai-auto__preview">${generatedVideo ? `<video src="${generatedVideo.url}" controls loop muted playsinline></video>` : generatedImage ? `<img src="${generatedImage.url}" alt="Ảnh AI đã tạo">` : `<div><span>Chưa có hình ảnh</span></div>`}${generatedAudio ? `<audio src="${generatedAudio.url}" controls></audio>` : `<div><span>Chưa có audio</span></div>`}</div><div class="mai-auto__result"><p>PRODUCTION BRIEF</p><pre>${escapeHtml(automation.plan || "Đang chờ AI lập kế hoạch…")}</pre><div>${assetButtons}<button type="button" data-download-production-pack>Tải gói dựng</button></div></div></section>` : ""}
      ${automation.lastError ? `<div class="mai-auto__notice is-error"><strong>Pipeline dừng:</strong> ${escapeHtml(automation.lastError)}</div>` : ""}
      <footer><span>Dữ liệu media được lưu trong IndexedDB trên thiết bị này.</span><span>Gemini/Veo dùng chung pool khóa máy chủ · Eleven Music dùng khóa riêng.</span></footer>
    </section>`;
  }

  function projectView() {
    const p = state.project;
    const math = projectMath();
    const preset = PRESETS[p.genre] || PRESETS.piano;
    const workflowSteps = [
      ["app-center", "AI Apps", "Mở riêng Concept, Image, Music, Veo hoặc Render Lab."],
      ["prompt-studio", "Prompt đồng bộ", "Tạo một bộ prompt cùng ngôn ngữ hình ảnh và âm thanh."],
      ["loop-builder", "Loop 1–5 giờ", "Tính loop và xuất lệnh FFmpeg dùng ngay."],
      ["audio-qa", "Kiểm âm", "Đọc file thật, đo peak/RMS và phát hiện clipping."],
      ["chapters", "Tracklist & chapter", "Tạo timestamp đúng chuẩn chapter YouTube."],
      ["youtube-pack", "Gói YouTube", "Sinh tiêu đề, mô tả, tag và file metadata."],
      ["youtube-publisher", "Đăng YouTube", "Chọn video, kênh, lịch phát và upload bằng OAuth."],
      ["publish-checklist", "Kiểm tra xuất bản", "Chốt quyền sử dụng và QA trước khi public."]
    ];
    const steps = workflowSteps.map((item, index) => `<button class="mai-flow-card" type="button" data-app-route="/music-ai/${item[0]}"><i>${String(index + 2).padStart(2, "0")}</i><span><strong>${item[1]}</strong><small>${item[2]}</small></span><b>→</b></button>`).join("");
    return `<section class="mai-view">
      ${automationView()}
      <div class="mai-section-head"><div><p>PROJECT BLUEPRINT</p><h3>Thiết lập một lần, dùng cho cả dây chuyền</h3><span>Mọi prompt, phép tính loop và nội dung xuất bản tự cập nhật theo dự án này.</span></div><button class="mai-primary" type="button" data-action="save-project">Lưu dự án</button></div>
      <div class="mai-layout mai-layout--project">
        <form class="mai-panel mai-project-form" onsubmit="return false">
          <div class="mai-form-grid">
            ${field("Tên dự án", "name")}
            ${selectField("Thể loại", "genre", Object.entries(PRESETS).map(([id, item]) => [id, item.label]))}
            ${field("Thời lượng video (giờ)", "hours", "number", 'min="1" max="5" step="1"')}
            ${field("Tempo (BPM)", "bpm", "number", 'min="40" max="120"')}
            ${field("Master audio (phút)", "masterMinutes", "number", 'min="5" max="120"')}
            ${field("Clip chuyển động (giây)", "visualSeconds", "number", 'min="4" max="20"')}
            ${selectField("Độ phân giải", "resolution", [["1080p", "1080p · nhanh & cân bằng"], ["1440p", "1440p · nét hơn"], ["2160p", "4K · cao nhất"]])}
            ${selectField("Khung hình", "fps", [[24, "24 fps · cinematic"], [30, "30 fps · YouTube"]])}
            ${selectField("Nguồn hình", "visualType", [["video", "Video Kling / Veo"], ["image", "Ảnh tĩnh có ambience"]])}
          </div>
          <label class="mai-field mai-field--wide"><span>Cảm xúc</span><textarea rows="2" data-project-field="mood">${escapeHtml(p.mood)}</textarea></label>
          <label class="mai-field mai-field--wide"><span>Nhạc cụ & texture</span><textarea rows="2" data-project-field="instruments">${escapeHtml(p.instruments)}</textarea></label>
          <label class="mai-field mai-field--wide"><span>Bối cảnh hình ảnh</span><textarea rows="2" data-project-field="scene">${escapeHtml(p.scene)}</textarea></label>
          <label class="mai-field mai-field--wide"><span>Bảng màu</span><input data-project-field="palette" value="${escapeHtml(p.palette)}"></label>
          <div class="mai-inline-actions"><button type="button" data-action="apply-preset">Áp preset ${escapeHtml(preset.label)}</button><button type="button" data-action="export-project">Xuất dự án JSON</button><label class="mai-file-button">Nhập JSON<input type="file" accept="application/json" data-project-import></label></div>
        </form>
        <aside class="mai-panel mai-plan">
          <p>LIVE PRODUCTION PLAN</p><h4>${escapeHtml(p.name)}</h4>
          <div class="mai-metrics">${cardMetric(formatDuration(math.targetSeconds), "Timeline")}${cardMetric(`${math.audioLoops}×`, "Loop audio")}${cardMetric(p.visualType === "image" ? "Tĩnh" : `${math.visualLoops}×`, "Loop hình")}${cardMetric(`~${math.outputGb.toFixed(1)} GB`, "File ước tính")}</div>
          <div class="mai-quality-note"><i>!</i><p><strong>Cách nhanh mà vẫn chất lượng</strong><span>Tạo master nhạc 30–60 phút có nhiều section rồi mới lặp. Clip hình 8–10 giây phải khớp frame đầu/cuối. 1080p30 là lựa chọn nhanh; 4K có thể tạo file rất lớn.</span></p></div>
          <button class="mai-primary mai-primary--wide" type="button" data-app-route="/music-ai/prompt-studio">Tạo bộ prompt đồng bộ →</button>
        </aside>
      </div>
      <section class="mai-workflow"><div class="mai-section-head"><div><p>ONE PROJECT · SEVEN STAGES</p><h3>Quy trình không bỏ sót bước</h3></div></div><div class="mai-flow-grid">${steps}</div></section>
      ${modelLibrary()}
    </section>`;
  }

  function modelLibrary() {
    const models = [
      ["ChatGPT Images", "Tạo ảnh nền và thumbnail cùng style", "IMG", "https://chatgpt.com/", "Ảnh"],
      ["Kling AI", "Image-to-video cho chuyển động môi trường", "K", "https://app.klingai.com/global/", "Motion"],
      ["Google Flow / Veo", "Tạo shot điện ảnh và clip ambience", "V", "https://labs.google/fx/tools/flow", "Motion"],
      ["Eleven Music", "Nhạc instrumental theo prompt/composition plan", "11", "https://elevenlabs.io/music", "Music"],
      ["Stable Audio", "Tạo, biến thể và chỉnh đoạn nhạc", "SA", "https://stability.ai/stable-audio", "Music"],
      ["MusicGen", "Model mở text/melody-to-music chạy local", "MG", "https://github.com/facebookresearch/audiocraft", "Local"],
      ["Demucs", "Tách vocal, drum, bass và stem để hậu kỳ", "DS", "https://github.com/facebookresearch/demucs", "Audio"],
      ["FFmpeg", "Ghép loop và encode video dài tự động", "FF", "https://ffmpeg.org/download.html", "Render"]
    ];
    return `<section class="mai-models"><div class="mai-section-head"><div><p>AI MUSIC TOOLCHAIN</p><h3>Các model/công cụ nên thêm vào hệ thống</h3><span>Mỗi công cụ có một nhiệm vụ cụ thể; bấm để mở đúng nơi làm việc.</span></div></div><div class="mai-model-grid">${models.map((item) => `<a href="${item[3]}" target="_blank" rel="noreferrer"><i>${item[2]}</i><span><small>${item[4]}</small><strong>${item[0]}</strong><em>${item[1]}</em></span><b>↗</b></a>`).join("")}</div></section>`;
  }

  function promptView() {
    const prompts = promptPack();
    const blocks = [
      ["image", "01 · Ảnh nền ChatGPT", "Dùng để tạo key visual 16:9 ổn định"],
      ["motion", "02 · Chuyển động Kling / Veo", "Khóa camera và thiết kế loop vô hình"],
      ["music", "03 · Nhạc AI", "Master có biến đổi nhẹ, không lộ cảm giác lặp"],
      ["thumbnail", "04 · Thumbnail", "Một điểm nhìn mạnh, đọc tốt trên điện thoại"],
      ["negative", "Negative prompt", "Dán vào nơi hỗ trợ negative prompt"]
    ];
    return `<section class="mai-view"><div class="mai-section-head"><div><p>SYNCED PROMPT SYSTEM</p><h3>Một concept, bốn prompt không lệch phong cách</h3><span>Prompt được tạo bằng tiếng Anh để dễ dùng với các model hình, video và nhạc.</span></div><button class="mai-primary" type="button" data-copy-all-prompts>Sao chép tất cả</button></div>
      <div class="mai-prompt-grid">${blocks.map(([key, title, note]) => `<article class="mai-panel mai-prompt"><header><span><strong>${title}</strong><small>${note}</small></span><button type="button" data-copy-text="${key}">Sao chép</button></header><textarea readonly rows="${key === "negative" ? 4 : 10}" data-prompt-output="${key}">${escapeHtml(prompts[key])}</textarea></article>`).join("")}</div>
      <div class="mai-provider-bar"><span>Mở nhanh:</span><a href="https://chatgpt.com/" target="_blank" rel="noreferrer">ChatGPT ↗</a><a href="https://app.klingai.com/global/" target="_blank" rel="noreferrer">Kling ↗</a><a href="https://labs.google/fx/tools/flow" target="_blank" rel="noreferrer">Flow / Veo ↗</a><a href="https://elevenlabs.io/music" target="_blank" rel="noreferrer">Eleven Music ↗</a></div>
      <div class="mai-next"><p><strong>Mẹo để nhanh hơn:</strong> lưu key visual tốt nhất làm ảnh tham chiếu cố định cho cả series; chỉ đổi thời tiết, thời gian trong ngày và đạo cụ. Điều này giúp thumbnail và video nhận diện cùng một kênh.</p><button type="button" data-app-route="/music-ai/loop-builder">Tiếp: dựng loop →</button></div>
    </section>`;
  }

  function loopView() {
    const profile = smartLoopProfile();
    const analysis = state.smartLoop.analysis;
    const command = ffmpegCommand();
    const modeNames = { direct: "Nối thẳng", crossfade: "Smart Crossfade", pingpong: "Ping-pong mềm" };
    const targetSeconds = smartLoopTargetSeconds();
    const visualLoops = state.project.visualType === "image" ? 1 : Math.ceil(targetSeconds / Math.max(.5, profile.unitDuration));
    return `<section class="mai-view"><div class="mai-section-head"><div><p>SMART SEAMLESS LOOP</p><h3>Biến clip ngắn thành chuyển động dài không khựng</h3><span>Tải clip 5 giây, chọn thời lượng; hệ thống đo điểm nối và tự chọn kỹ thuật loop phù hợp.</span></div><button class="mai-primary" type="button" data-copy-command>Sao chép lệnh dựng</button></div>
      <section class="mai-panel mai-smart-loop-controls">
        <header><div><p>LOOP ENGINE</p><strong>${modeNames[profile.mode]} · ${formatDuration(targetSeconds)}</strong></div><span class="is-${analysis ? analysis.seamScore >= 70 ? "good" : analysis.seamScore >= 45 ? "medium" : "low" : "waiting"}">${analysis ? `${analysis.seamScore}% liền mạch` : "Chờ clip"}</span></header>
        <div class="mai-smart-loop-form">
          <label><span>Thời lượng đầu ra</span><input data-smart-loop-field="targetDuration" value="${escapeHtml(state.smartLoop.targetDuration)}" placeholder="03:00:00"><small>HH:MM:SS · tối đa 8 giờ</small></label>
          <label><span>Chế độ nối</span><select data-smart-loop-field="mode"><option value="auto" ${state.smartLoop.mode === "auto" ? "selected" : ""}>Tự động thông minh</option><option value="crossfade" ${state.smartLoop.mode === "crossfade" ? "selected" : ""}>Smart Crossfade</option><option value="pingpong" ${state.smartLoop.mode === "pingpong" ? "selected" : ""}>Ping-pong mềm</option><option value="direct" ${state.smartLoop.mode === "direct" ? "selected" : ""}>Nối thẳng</option></select><small>Auto dựa trên phân tích đầu–cuối</small></label>
          <label><span>Vùng chuyển tiếp</span><input type="number" min="0.15" max="1.5" step="0.05" data-smart-loop-field="transitionSeconds" value="${escapeHtml(state.smartLoop.transitionSeconds)}"><small>Khuyến nghị 0.6–1.0 giây</small></label>
          <label class="mai-smart-toggle"><input type="checkbox" data-smart-loop-field="interpolation" ${state.smartLoop.interpolation ? "checked" : ""}><span><strong>Nội suy chuyển động</strong><small>Motion-compensated · mượt hơn, render nặng hơn</small></span></label>
        </div>
      </section>
      <div class="mai-layout">
        <section class="mai-panel mai-media-inputs">
          <label class="mai-drop"><input type="file" accept="image/*,video/mp4,video/webm" data-visual-file><i>◎</i><strong>Chọn clip 5 giây hoặc ảnh</strong><span>${escapeHtml(state.media.visualName || "MP4, WebM, PNG, JPG · tự phân tích khi tải")}</span></label>
          <label class="mai-drop"><input type="file" accept="audio/*" data-loop-audio-file><i>♫</i><strong>Chọn master nhạc</strong><span>${escapeHtml(state.media.audioName || "WAV, MP3, M4A")}</span></label>
          <div class="mai-preview-grid">${visualUrl ? (state.project.visualType === "image" ? `<img src="${visualUrl}" alt="Xem trước hình nền">` : `<video src="${visualUrl}" muted loop controls playsinline></video>`) : `<div><span>Chưa chọn hình</span></div>`}${audioUrl ? `<audio src="${audioUrl}" controls></audio>` : `<div><span>Chưa chọn audio</span></div>`}</div>
        </section>
        <aside class="mai-panel mai-loop-math"><p>LOOP CALCULATOR</p><div class="mai-metrics">${cardMetric(formatDuration(targetSeconds), "Đích")}${cardMetric(state.media.visualDuration ? `${state.media.visualDuration.toFixed(2)}s` : `${state.project.visualSeconds}s`, "Clip gốc")}${cardMetric(`${profile.unitDuration.toFixed(2)}s`, "Loop-unit")}${cardMetric(`${visualLoops}×`, "Số vòng")}</div>
          <ul><li>Đổi clip thành <b>${state.project.visualType === "image" ? "cover.png" : "visual.mp4"}</b>.</li><li>Đổi master thành <b>music.wav</b>.</li><li>Chạy file .BAT; Smart Loop sẽ tạo <b>seamless-loop.mp4</b> trước khi dựng video dài.</li></ul>
        </aside>
      </div>
      ${analysis ? `<section class="mai-panel mai-seam-analysis"><header><div><p>FRAME INTELLIGENCE</p><strong>Phân tích chuyển động đầu–cuối</strong></div><span>${escapeHtml(analysis.recommendation)}</span></header><div class="mai-seam-analysis__body"><div class="mai-seam-frames"><figure><img src="${analysis.startFrame}" alt="Khung hình đầu"><figcaption>Đầu clip</figcaption></figure><figure><img src="${analysis.endFrame}" alt="Khung hình cuối"><figcaption>Cuối clip</figcaption></figure></div><div class="mai-seam-scores">${cardMetric(`${analysis.seamScore}%`, "Khớp hình", analysis.seamScore >= 70 ? "is-good" : "is-warn")}${cardMetric(`${analysis.motionEnergy}%`, "Năng lượng motion")}${cardMetric(`${analysis.brightnessJump}%`, "Nhảy sáng", analysis.brightnessJump <= 12 ? "is-good" : "is-warn")}</div><p>${escapeHtml(analysis.detail)}</p></div></section>` : `<div class="mai-quality-note"><i>AI</i><p><strong>Tải clip để bắt đầu phân tích</strong><span>Trình duyệt lấy mẫu bốn khung hình cục bộ, không tải clip lên máy chủ. Kết quả quyết định nối thẳng, crossfade hay ping-pong.</span></p></div>`}
      <article class="mai-panel mai-command"><header><div><p>FFMPEG · ${profile.prepare ? "2 BƯỚC · " : ""}H.264 + AAC 48KHZ</p><strong>${modeNames[profile.mode]} · xuất video ${formatDuration(targetSeconds)}</strong></div><button type="button" data-download-bat>Tải Smart Loop .BAT</button></header><pre><code>${escapeHtml(command)}</code></pre></article>
      <div class="mai-quality-note"><i>i</i><p><strong>Chuyển động dài mà không lộ vòng lặp</strong><span>Crossfade xoay điểm cắt vào giữa clip rồi hòa cuối–đầu; ping-pong phù hợp với mưa, khói, ánh sáng và chuyển động chậm. Nội suy motion làm mượt frame nhưng sẽ render lâu hơn.</span></p></div>
    </section>`;
  }

  function qaView() {
    const qa = state.qa;
    return `<section class="mai-view"><div class="mai-section-head"><div><p>BROWSER AUDIO QA</p><h3>Kiểm tra file nhạc ngay trên máy</h3><span>File không được tải lên máy chủ. Trình duyệt đọc metadata và mẫu âm thanh cục bộ.</span></div></div>
      <div class="mai-layout"><label class="mai-drop mai-drop--large"><input type="file" accept="audio/*" data-qa-file><i>⌁</i><strong>Chọn master WAV / MP3 để phân tích</strong><span>Tối đa khuyến nghị 250 MB để tránh đầy bộ nhớ trình duyệt</span></label>
      <aside class="mai-panel mai-qa-summary">${qa ? `<p>ANALYSIS RESULT</p><h4>${escapeHtml(qa.name)}</h4><div class="mai-metrics">${cardMetric(formatDuration(qa.duration), "Thời lượng")}${cardMetric(`${qa.sampleRate / 1000} kHz`, "Sample rate", qa.sampleRate === 48000 ? "is-good" : "")}${cardMetric(`${qa.peakDb.toFixed(1)} dBFS`, "Peak", qa.peakDb <= -1 ? "is-good" : "is-warn")}${cardMetric(`${qa.rmsDb.toFixed(1)} dBFS`, "RMS ước tính")}</div>` : `<div class="mai-empty"><i>♫</i><strong>Chưa có kết quả</strong><span>Chọn file để bắt đầu.</span></div>`}</aside></div>
      ${qa ? `<article class="mai-panel mai-wave"><header><div><p>WAVEFORM SAMPLE</p><strong>${qa.channels} kênh · ${qa.clippingPercent.toFixed(3)}% mẫu gần clipping</strong></div><span class="${qa.peakDb <= -1 && qa.clippingPercent === 0 ? "is-pass" : "is-warning"}">${qa.peakDb <= -1 && qa.clippingPercent === 0 ? "ĐẠT" : "CẦN KIỂM TRA"}</span></header><canvas data-waveform width="1200" height="220"></canvas><div class="mai-qa-advice"><p><b>Peak:</b> nên chừa headroom, tránh vượt -1 dBFS.</p><p><b>48 kHz:</b> phù hợp đầu ra YouTube.</p><p><b>RMS:</b> chỉ là ước tính, không thay thế phép đo loudness LUFS chuyên dụng.</p></div></article>` : ""}
      <div class="mai-next"><p><strong>Quy trình tốt:</strong> kiểm tra master ngắn trước, sửa clipping/độ ồn, sau đó mới dựng video nhiều giờ để không phải render lại.</p><button type="button" data-app-route="/music-ai/chapters">Tiếp: làm tracklist →</button></div>
    </section>`;
  }

  function chaptersView() {
    const output = chapterOutput();
    return `<section class="mai-view"><div class="mai-section-head"><div><p>TRACKLIST BUILDER</p><h3>Chapter hợp lệ chỉ trong vài giây</h3><span>Nhập thời lượng từng track; timestamp tiếp theo được cộng tự động.</span></div><button class="mai-primary" type="button" data-copy-chapters>Sao chép chapter</button></div>
      <div class="mai-layout mai-layout--chapters"><section class="mai-panel mai-track-editor"><header><span>Tên track</span><span>Thời lượng</span><i></i></header>${state.chapters.map((item, index) => `<div class="mai-track-row"><input aria-label="Tên track ${index + 1}" data-chapter-name="${index}" value="${escapeHtml(item.name)}"><input aria-label="Thời lượng track ${index + 1}" data-chapter-duration="${index}" value="${escapeHtml(item.duration)}" placeholder="30:00"><button type="button" data-remove-chapter="${index}" aria-label="Xóa track">×</button></div>`).join("")}<button class="mai-add-row" type="button" data-add-chapter>+ Thêm track</button></section>
      <aside class="mai-panel mai-chapter-output"><header><div><p>YOUTUBE CHAPTERS</p><strong data-chapter-ready>${output.okay ? "Sẵn sàng để dán" : "Cần ít nhất 3 chapter ≥ 10 giây"}</strong></div><span data-chapter-status class="${output.okay ? "is-pass" : "is-warning"}">${formatDuration(output.total)}</span></header><textarea readonly rows="15" data-chapter-output>${escapeHtml(output.lines.join("\n"))}</textarea><small>Quy tắc: dòng đầu 00:00, ít nhất 3 timestamp tăng dần, mỗi chapter tối thiểu 10 giây.</small></aside></div>
      <div class="mai-next"><p><strong>Tip giữ chân người xem:</strong> đặt tên track giàu hình ảnh, không dùng “Track 01”. Với video 3 giờ, chapter 20–40 phút dễ theo dõi mà không làm mô tả quá dài.</p><button type="button" data-app-route="/music-ai/youtube-pack">Tiếp: tạo gói YouTube →</button></div>
    </section>`;
  }

  function youtubeView() {
    const pack = youtubePack();
    const math = projectMath();
    return `<section class="mai-view"><div class="mai-section-head"><div><p>YOUTUBE LAUNCH PACK</p><h3>Metadata và cấu hình xuất bản đã sẵn sàng</h3><span>Sinh từ blueprint và tracklist hiện tại; vẫn nên chỉnh lại theo cá tính kênh.</span></div><button class="mai-primary" type="button" data-download-youtube>Tải gói .TXT</button></div>
      <div class="mai-youtube-grid">
        <article class="mai-panel mai-output"><header><strong>Tiêu đề</strong><button type="button" data-copy-youtube="title">Sao chép</button></header><textarea rows="3" readonly data-youtube-output="title">${escapeHtml(pack.title)}</textarea><small>${pack.title.length}/100 ký tự</small></article>
        <article class="mai-panel mai-output"><header><strong>Chữ thumbnail</strong><button type="button" data-copy-youtube="thumbnailText">Sao chép</button></header><textarea rows="3" readonly data-youtube-output="thumbnailText">${escapeHtml(pack.thumbnailText)}</textarea><small>Giữ 2–4 từ để đọc tốt trên điện thoại.</small></article>
        <article class="mai-panel mai-output mai-output--wide"><header><strong>Mô tả + chapter</strong><button type="button" data-copy-youtube="description">Sao chép</button></header><textarea rows="17" readonly data-youtube-output="description">${escapeHtml(pack.description)}</textarea></article>
        <article class="mai-panel mai-output mai-output--wide"><header><strong>Tags</strong><button type="button" data-copy-youtube="tags">Sao chép</button></header><textarea rows="4" readonly data-youtube-output="tags">${escapeHtml(pack.tags)}</textarea></article>
      </div>
      <section class="mai-panel mai-export-spec"><div><p>RECOMMENDED EXPORT</p><h4>${state.project.resolution} · ${state.project.fps} FPS · 16:9</h4><span>MP4 · H.264 progressive · AAC stereo 48 kHz · Fast Start</span></div><div class="mai-metrics">${cardMetric(`${math.videoMbps} Mbps`, "Video SDR")}${cardMetric("384 kbps", "Audio stereo")}${cardMetric(`~${math.outputGb.toFixed(1)} GB`, "Kích thước")}</div><button class="mai-primary" type="button" data-app-route="/music-ai/youtube-publisher">Đăng tự động →</button></section>
    </section>`;
  }

  function youtubePublisherView() {
    return `<section class="mai-view mai-view--youtube-publisher"><div data-youtube-publisher-host></div></section>`;
  }

  function modularAppView() {
    return `<section class="mai-view mai-view--modular-app"><div data-music-ai-app-host></div></section>`;
  }

  function publishView() {
    const completed = PUBLISH_CHECKS.filter(([key]) => Boolean(state.checklist[key])).length;
    const percent = Math.round(completed / PUBLISH_CHECKS.length * 100);
    return `<section class="mai-view"><div class="mai-section-head"><div><p>FINAL RELEASE GATE</p><h3>Không public trước khi đủ các bước quan trọng</h3><span>Checklist lưu trên thiết bị và đi cùng dự án hiện tại.</span></div><span class="mai-score ${percent === 100 ? "is-complete" : ""}">${completed}/${PUBLISH_CHECKS.length} · ${percent}%</span></div>
      <div class="mai-layout"><section class="mai-panel mai-checklist">${PUBLISH_CHECKS.map(([key, label], index) => `<label class="${state.checklist[key] ? "is-done" : ""}"><input type="checkbox" data-publish-check="${key}" ${state.checklist[key] ? "checked" : ""}><i>${String(index + 1).padStart(2, "0")}</i><span>${label}</span><b>✓</b></label>`).join("")}</section>
      <aside class="mai-panel mai-release"><div class="mai-ring" style="--progress:${percent * 3.6}deg"><span><strong>${percent}%</strong><small>READY</small></span></div><h4>${percent === 100 ? "Sẵn sàng xuất bản" : "Còn bước cần hoàn tất"}</h4><p>${percent === 100 ? "Hãy tải Riêng tư trước, kiểm tra xử lý HD rồi mới chuyển Công khai." : "Hoàn thành lần lượt; ưu tiên quyền sử dụng, loop và kiểm âm."}</p><a class="mai-primary mai-primary--wide ${percent === 100 ? "" : "is-disabled"}" href="${percent === 100 ? "https://studio.youtube.com/" : "#"}" ${percent === 100 ? 'target="_blank" rel="noreferrer"' : 'aria-disabled="true"'}>Mở YouTube Studio</a><button type="button" data-reset-checklist>Đặt lại checklist</button></aside></div>
      <div class="mai-quality-note"><i>!</i><p><strong>Quan trọng về bản quyền</strong><span>Giữ hóa đơn/gói sử dụng và điều khoản thương mại tại thời điểm tạo của từng dịch vụ. Không yêu cầu model bắt chước nghệ sĩ hoặc bài hát có bản quyền.</span></p></div>
    </section>`;
  }

  function render() {
    if (!host) return;
    const content = ({
      project: projectView,
      "app-center": modularAppView,
      "concept-lab": modularAppView,
      "image-lab": modularAppView,
      "music-lab": modularAppView,
      "veo-lab": modularAppView,
      "render-lab": modularAppView,
      "prompt-studio": promptView,
      "loop-builder": loopView,
      "audio-qa": qaView,
      chapters: chaptersView,
      "youtube-pack": youtubeView,
      "youtube-publisher": youtubePublisherView,
      "publish-checklist": publishView
    }[view] || projectView)();
    const standalone = APP_VIEWS.has(view) || view === "youtube-publisher";
    host.innerHTML = `<div class="music-ai-studio ${standalone ? "is-standalone-app" : ""}">${headerHtml()}<main>${content}</main><div class="mai-toast" data-mai-toast role="status" aria-live="polite"></div></div>`;
    if (view === "youtube-publisher") {
      window.HHYouTubePublisher?.mount?.(host.querySelector("[data-youtube-publisher-host]"), {
        apiBase: apiBase(),
        pack: youtubePack(),
        project: state.project
      });
    }
    if (APP_VIEWS.has(view)) {
      window.HHMusicAIApps?.mount?.(host.querySelector("[data-music-ai-app-host]"), {
        view,
        apiBase: apiBase(),
        project: state.project,
        prompts: promptPack()
      });
    }
    if (view === "audio-qa" && state.qa?.waveform) requestAnimationFrame(drawWaveform);
  }

  function toast(message, type = "success") {
    const node = host?.querySelector("[data-mai-toast]");
    if (!node) return;
    node.textContent = message;
    node.dataset.type = type;
    node.classList.add("is-visible");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("is-visible"), 2600);
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const area = document.createElement("textarea");
      area.value = value;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    toast("Đã sao chép vào clipboard.");
  }

  function download(content, name, type = "text/plain;charset=utf-8") {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function safeProjectName() {
    return String(state.project.name || "hh-music-ai").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "hh-music-ai";
  }

  async function fetchGeneratedVideo(uri) {
    const encoded = btoa(uri).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const response = await fetch(`${apiBase()}/api/modules/music-ai/actions?media=veo&uri=${encodeURIComponent(encoded)}`, { headers: authHeaders(false), cache: "no-store" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Không tải được video Veo (HTTP ${response.status}).`);
    }
    return response.blob();
  }

  async function runAutomaticPipeline() {
    if (pipelineRunning) return;
    pipelineRunning = true;
    pipelineCancelled = false;
    state.automation.lastError = "";
    state.automation.lastRunAt = new Date().toISOString();
    state.automation.stages = {};
    saveState();
    render();
    const pack = promptPack();
    try {
      const health = await refreshProviders(false);
      setPipelineStage("concept", "running", "Gemini đang lập production brief…");
      const planResponse = await musicApi("music-plan", JSON.stringify({ idea: state.automation.idea, project: state.project, prompts: pack }), { config: state.project, creativity: 72 });
      state.automation.plan = planResponse.action?.output || "Production brief đã được tạo.";
      setPipelineStage("concept", "done", `${planResponse.action?.model || "HH AI"} · brief đã đồng bộ`);
      if (pipelineCancelled) throw new Error("Đã dừng theo yêu cầu.");

      if (health?.providers?.image?.configured && health.canRunMedia) {
        setPipelineStage("image", "running", "Gemini Images đang tạo ảnh 16:9…");
        const imageResponse = await musicApi("music-image", pack.image, {});
        const imageBlob = base64ToBlob(imageResponse.media.data, imageResponse.media.mimeType);
        generatedImage = replaceAssetUrl(generatedImage, imageBlob);
        await storeAsset("image", imageBlob);
        state.media.visualName = `${safeProjectName()}-cover.jpg`;
        setPipelineStage("image", "done", `${imageResponse.media.model} · ảnh đã lưu trên thiết bị`);
      } else {
        setPipelineStage("image", "blocked", health?.providers?.image?.configured ? "Đăng nhập tài khoản quản trị để dùng credit" : "Cần GEMINI_API_KEYS có quyền tạo ảnh");
      }
      if (pipelineCancelled) throw new Error("Đã dừng theo yêu cầu.");

      if (health?.providers?.music?.configured && health.canRunMedia) {
        setPipelineStage("music", "running", `Eleven Music đang tạo ${state.automation.trackSeconds} giây…`);
        const trackResponse = await musicApi("music-track", pack.music, { durationSeconds: state.automation.trackSeconds });
        const audioBlob = base64ToBlob(trackResponse.media.data, trackResponse.media.mimeType);
        generatedAudio = replaceAssetUrl(generatedAudio, audioBlob);
        await storeAsset("audio", audioBlob);
        state.media.audioName = `${safeProjectName()}-track.mp3`;
        state.media.audioDuration = Number(trackResponse.media.durationSeconds || state.automation.trackSeconds);
        setPipelineStage("music", "done", `${trackResponse.media.model} · instrumental đã sẵn sàng`);
      } else {
        setPipelineStage("music", "blocked", health?.providers?.music?.configured ? "Đăng nhập tài khoản quản trị để tạo nhạc" : "Cần ELEVENLABS_API_KEY trên Vercel");
      }
      if (pipelineCancelled) throw new Error("Đã dừng theo yêu cầu.");

      if (health?.providers?.video?.configured && health.canRunMedia && generatedImage?.blob) {
        setPipelineStage("video", "running", "Đang gửi ảnh sang Veo…");
        const imageData = await blobToBase64(generatedImage.blob);
        const startResponse = await musicApi("music-video-start", pack.motion, { imageData, imageMimeType: generatedImage.mimeType, resolution: state.project.resolution === "1080p" ? "1080p" : "720p" });
        state.automation.operationName = startResponse.operation.name;
        saveState();
        let videoResult = null;
        for (let attempt = 1; attempt <= 75 && !pipelineCancelled; attempt += 1) {
          if (attempt > 1) await delay(8000);
          const statusResponse = await musicApi("music-video-status", "", { operationName: state.automation.operationName });
          if (statusResponse.operation.error) throw new Error(statusResponse.operation.error);
          if (statusResponse.operation.done && statusResponse.operation.ready) { videoResult = statusResponse.operation; break; }
          if (attempt === 1 || attempt % 3 === 0) setPipelineStage("video", "running", `Veo đang dựng clip · lần kiểm tra ${attempt}`);
        }
        if (pipelineCancelled) throw new Error("Đã dừng theo yêu cầu.");
        if (!videoResult?.mediaUri) throw new Error("Veo chưa hoàn thành trong 10 phút. Mã tiến trình đã được lưu để thử lại.");
        setPipelineStage("video", "running", "Đang tải clip Veo về thiết bị…");
        const videoBlob = await fetchGeneratedVideo(videoResult.mediaUri);
        generatedVideo = replaceAssetUrl(generatedVideo, videoBlob);
        await storeAsset("video", videoBlob);
        state.media.visualName = `${safeProjectName()}-veo.mp4`;
        state.media.visualDuration = 8;
        state.project.visualType = "video";
        setPipelineStage("video", "done", "Clip Veo 8 giây đã lưu trên thiết bị");
      } else {
        const detail = !generatedImage ? "Cần ảnh đầu vào trước khi tạo chuyển động" : health?.providers?.video?.configured ? "Đăng nhập tài khoản quản trị để tạo video" : "Cần GEMINI_API_KEYS có quyền Veo";
        setPipelineStage("video", "blocked", detail);
      }

      setPipelineStage("package", "running", "Đang tạo lệnh render và metadata YouTube…");
      state.checklist.metadata = true;
      state.automation.lastError = "";
      saveState();
      setPipelineStage("package", "done", health?.providers?.renderer?.configured ? "Render Worker đã kết nối · gói dựng sẵn sàng" : "Gói FFmpeg + YouTube đã sẵn sàng tải");
      toast("Pipeline đã chạy xong các dịch vụ đang kết nối.");
    } catch (error) {
      state.automation.lastError = String(error.message || error);
      Object.entries(state.automation.stages || {}).forEach(([id, stage]) => {
        if (stage?.status === "running") {
          state.automation.stages[id] = { status: "error", detail: state.automation.lastError };
        }
      });
      saveState();
      toast(state.automation.lastError, "error");
    } finally {
      pipelineRunning = false;
      if (host && view === "project") render();
    }
  }

  function downloadProductionPack() {
    const name = safeProjectName();
    const youtube = youtubePack();
    const manifest = {
      project: state.project,
      smartLoop: { ...state.smartLoop, targetSeconds: smartLoopTargetSeconds(), resolvedMode: resolvedSmartLoopMode() },
      automation: { ...state.automation, stages: state.automation.stages },
      prompts: promptPack(),
      youtube,
      chapters: chapterOutput().lines,
      renderCommand: ffmpegCommand(),
      generatedAssets: { image: Boolean(generatedImage), audio: Boolean(generatedAudio), video: Boolean(generatedVideo) }
    };
    download(JSON.stringify(manifest, null, 2), `${name}-production.json`, "application/json");
    download(smartLoopBat(), `${name}-render.bat`, "application/x-bat");
    download(`TITLE\n${youtube.title}\n\nDESCRIPTION\n${youtube.description}\n\nTAGS\n${youtube.tags}\n`, `${name}-youtube.txt`);
    if (generatedImage) downloadBlob(generatedImage.blob, `${name}-cover.jpg`);
    if (generatedAudio) downloadBlob(generatedAudio.blob, `${name}-track.mp3`);
    if (generatedVideo) downloadBlob(generatedVideo.blob, `${name}-veo.mp4`);
    toast("Đã tải gói sản xuất và các media hiện có.");
  }

  function applyPreset() {
    const preset = PRESETS[state.project.genre] || PRESETS.piano;
    Object.assign(state.project, { bpm: preset.bpm, mood: preset.mood, instruments: preset.instruments, scene: preset.scene, palette: preset.palette });
    saveState();
    render();
    toast(`Đã áp preset ${preset.label}.`);
  }

  function updateProjectField(target) {
    const key = target.dataset.projectField;
    if (!key) return;
    const previousHours = state.project.hours;
    const numeric = ["hours", "bpm", "masterMinutes", "visualSeconds", "fps"].includes(key);
    state.project[key] = numeric ? number(target.value, state.project[key]) : target.value;
    if (key === "hours" && parseDuration(state.smartLoop.targetDuration) === Number(previousHours) * 3600) {
      state.smartLoop.targetDuration = `${clamp(state.project.hours, 1, 8)}:00:00`;
    }
    saveState();
    updateProjectPreview();
  }

  function updateProjectPreview() {
    if (!host || view !== "project") return;
    const math = projectMath();
    const heroValues = [`${state.project.hours}H`, `${state.project.bpm}`];
    host.querySelectorAll(".mai-hero aside .mai-metric strong").forEach((node, index) => {
      if (heroValues[index] !== undefined) node.textContent = heroValues[index];
    });
    const plan = host.querySelector(".mai-plan");
    const planValues = [formatDuration(math.targetSeconds), `${math.audioLoops}×`, state.project.visualType === "image" ? "Tĩnh" : `${math.visualLoops}×`, `~${math.outputGb.toFixed(1)} GB`];
    plan?.querySelectorAll(".mai-metric strong").forEach((node, index) => { if (planValues[index] !== undefined) node.textContent = planValues[index]; });
    const title = plan?.querySelector("h4");
    if (title) title.textContent = state.project.name;
  }

  function updateChapterPreview() {
    if (!host || view !== "chapters") return;
    const output = chapterOutput();
    const area = host.querySelector("[data-chapter-output]");
    const ready = host.querySelector("[data-chapter-ready]");
    const status = host.querySelector("[data-chapter-status]");
    if (area) area.value = output.lines.join("\n");
    if (ready) ready.textContent = output.okay ? "Sẵn sàng để dán" : "Cần ít nhất 3 chapter ≥ 10 giây";
    if (status) {
      status.textContent = formatDuration(output.total);
      status.className = output.okay ? "is-pass" : "is-warning";
    }
  }

  function seekVideoFrame(video, time) {
    return new Promise((resolve, reject) => {
      const target = Math.max(0, Math.min(Number(video.duration) - .01, time));
      const timer = setTimeout(() => reject(new Error("Hết thời gian đọc khung hình.")), 5000);
      const complete = () => { clearTimeout(timer); video.removeEventListener("seeked", complete); resolve(); };
      video.addEventListener("seeked", complete, { once: true });
      video.currentTime = target;
    });
  }

  async function captureVideoFrame(video, time) {
    await seekVideoFrame(video, time);
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return {
      pixels: context.getImageData(0, 0, canvas.width, canvas.height).data,
      preview: canvas.toDataURL("image/jpeg", .72)
    };
  }

  function frameDifference(first, second) {
    let difference = 0;
    let brightnessFirst = 0;
    let brightnessSecond = 0;
    let samples = 0;
    for (let index = 0; index < first.length; index += 4) {
      const firstLuma = first[index] * .2126 + first[index + 1] * .7152 + first[index + 2] * .0722;
      const secondLuma = second[index] * .2126 + second[index + 1] * .7152 + second[index + 2] * .0722;
      difference += Math.abs(first[index] - second[index]) + Math.abs(first[index + 1] - second[index + 1]) + Math.abs(first[index + 2] - second[index + 2]);
      brightnessFirst += firstLuma;
      brightnessSecond += secondLuma;
      samples += 1;
    }
    return {
      difference: difference / Math.max(1, samples * 3 * 255) * 100,
      brightnessJump: Math.abs(brightnessFirst - brightnessSecond) / Math.max(1, samples * 255) * 100
    };
  }

  async function analyzeVideoLoop(video) {
    const duration = Number(video.duration) || 0;
    if (duration < .8) throw new Error("Clip cần dài ít nhất 0.8 giây để phân tích loop.");
    const edge = Math.min(.08, duration * .015);
    const gap = Math.min(.35, duration * .08);
    const start = await captureVideoFrame(video, edge);
    const startMotion = await captureVideoFrame(video, Math.min(duration / 2, edge + gap));
    const endMotion = await captureVideoFrame(video, Math.max(duration / 2, duration - edge - gap));
    const end = await captureVideoFrame(video, duration - edge);
    const seam = frameDifference(start.pixels, end.pixels);
    const startEnergy = frameDifference(start.pixels, startMotion.pixels).difference;
    const endEnergy = frameDifference(endMotion.pixels, end.pixels).difference;
    const seamScore = Math.round(Math.max(0, 100 - seam.difference * 2.2));
    const motionEnergy = Math.round(Math.min(100, (startEnergy + endEnergy) * 2.4));
    const brightnessJump = Math.round(Math.min(100, seam.brightnessJump * 2));
    let recommendation = "Smart Crossfade";
    let detail = "Đầu và cuối khác nhau; xoay điểm cắt rồi hòa chuyển động sẽ che mối nối tốt nhất.";
    if (seamScore >= 86) {
      recommendation = "Nối thẳng";
      detail = "Khung hình đầu và cuối đã rất gần nhau; có thể nối trực tiếp để giữ hình nét nhất.";
    } else if (motionEnergy <= 18 && seamScore < 55) {
      recommendation = "Ping-pong mềm";
      detail = "Chuyển động chậm nhưng hai đầu lệch nhiều; chạy tiến–lùi sẽ kín điểm nối hơn crossfade dài.";
    }
    state.smartLoop.analysis = {
      seamScore,
      motionEnergy,
      brightnessJump,
      recommendation,
      detail,
      duration: Number(duration.toFixed(3)),
      startFrame: start.preview,
      endFrame: end.preview,
      analyzedAt: new Date().toISOString()
    };
  }

  function readMediaMetadata(file, kind) {
    const oldUrl = kind === "visual" ? visualUrl : audioUrl;
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    const url = URL.createObjectURL(file);
    if (kind === "visual") visualUrl = url; else audioUrl = url;
    const isImage = file.type.startsWith("image/");
    if (kind === "visual" && isImage) {
      state.project.visualType = "image";
      state.media.visualName = file.name;
      state.media.visualDuration = 0;
      state.smartLoop.analysis = null;
      saveState();
      render();
      return;
    }
    const element = document.createElement(kind === "visual" ? "video" : "audio");
    element.preload = kind === "visual" ? "auto" : "metadata";
    element.onloadedmetadata = async () => {
      if (kind === "visual") {
        state.project.visualType = "video";
        state.media.visualName = file.name;
        state.media.visualDuration = Number(element.duration) || 0;
        state.smartLoop.analysis = null;
        toast("Đang phân tích chuyển động đầu–cuối…");
        try { await analyzeVideoLoop(element); } catch (error) { toast(error.message || "Không phân tích được clip.", "error"); }
      } else {
        state.media.audioName = file.name;
        state.media.audioDuration = Number(element.duration) || 0;
      }
      saveState();
      render();
      toast(kind === "visual" && state.smartLoop.analysis ? "Đã phân tích và chọn chế độ Smart Loop." : "Đã đọc thời lượng file.");
    };
    element.onerror = () => toast("Không thể đọc metadata file này.", "error");
    element.src = url;
  }

  async function analyzeAudio(file) {
    if (file.size > 250 * 1024 * 1024) {
      toast("File trên 250 MB có thể làm trình duyệt thiếu bộ nhớ.", "error");
      return;
    }
    toast("Đang giải mã và lấy mẫu audio…");
    try {
      audioContext?.close?.();
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const buffer = await audioContext.decodeAudioData(await file.arrayBuffer());
      const maxSamples = 1200000;
      const stride = Math.max(1, Math.floor(buffer.length * buffer.numberOfChannels / maxSamples));
      let peak = 0;
      let sum = 0;
      let sampled = 0;
      let clipping = 0;
      const width = 600;
      const waveform = new Array(width).fill(0);
      for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        const samples = buffer.getChannelData(channel);
        for (let i = 0; i < samples.length; i += stride) {
          const absolute = Math.abs(samples[i]);
          peak = Math.max(peak, absolute);
          sum += samples[i] * samples[i];
          sampled += 1;
          if (absolute >= 0.999) clipping += 1;
          const bucket = Math.min(width - 1, Math.floor(i / samples.length * width));
          waveform[bucket] = Math.max(waveform[bucket], absolute);
        }
      }
      state.qa = {
        name: file.name,
        duration: buffer.duration,
        sampleRate: buffer.sampleRate,
        channels: buffer.numberOfChannels,
        peakDb: peak > 0 ? 20 * Math.log10(peak) : -120,
        rmsDb: sampled ? 20 * Math.log10(Math.sqrt(sum / sampled) || 1e-9) : -120,
        clippingPercent: sampled ? clipping / sampled * 100 : 0,
        waveform
      };
      saveState();
      render();
      toast("Phân tích hoàn tất.");
    } catch (error) {
      toast(`Không phân tích được: ${error.message || error}`, "error");
    }
  }

  function drawWaveform() {
    const canvas = host?.querySelector("[data-waveform]");
    const points = state.qa?.waveform;
    if (!canvas || !points?.length) return;
    const context = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);
    const gradient = context.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "#64ecff");
    gradient.addColorStop(0.5, "#b77bff");
    gradient.addColorStop(1, "#ff6eb6");
    context.fillStyle = "rgba(100,236,255,.06)";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = gradient;
    context.lineWidth = 2;
    context.beginPath();
    points.forEach((point, index) => {
      const x = index / (points.length - 1) * width;
      const amplitude = point * height * 0.44;
      context.moveTo(x, height / 2 - amplitude);
      context.lineTo(x, height / 2 + amplitude);
    });
    context.stroke();
  }

  function handleInput(event) {
    const target = event.target;
    if (target.matches("[data-project-field]")) updateProjectField(target);
    if (target.matches("[data-smart-loop-field]")) {
      const key = target.dataset.smartLoopField;
      state.smartLoop[key] = target.type === "checkbox" ? target.checked : key === "transitionSeconds" ? Number(target.value) : target.value;
      saveState();
      clearTimeout(handleInput.smartLoopTimer);
      handleInput.smartLoopTimer = setTimeout(() => {
        if (host && view === "loop-builder") render();
      }, 550);
    }
    if (target.matches("[data-automation-field]")) {
      const key = target.dataset.automationField;
      state.automation[key] = key === "trackSeconds" ? Number(target.value) : target.value;
      saveState();
    }
    if (target.matches("[data-chapter-name]")) {
      state.chapters[Number(target.dataset.chapterName)].name = target.value;
      saveState();
      updateChapterPreview();
    }
    if (target.matches("[data-chapter-duration]")) {
      state.chapters[Number(target.dataset.chapterDuration)].duration = target.value;
      saveState();
      updateChapterPreview();
    }
  }

  function handleChange(event) {
    const target = event.target;
    if (target.matches("[data-smart-loop-field]")) {
      clearTimeout(handleInput.smartLoopTimer);
      const key = target.dataset.smartLoopField;
      state.smartLoop[key] = target.type === "checkbox" ? target.checked : key === "transitionSeconds" ? Number(target.value) : target.value;
      if (key === "targetDuration" && !parseDuration(target.value)) state.smartLoop.targetDuration = "01:00:00";
      saveState();
      render();
      return;
    }
    if (target.matches("[data-automation-field]")) {
      const key = target.dataset.automationField;
      state.automation[key] = key === "trackSeconds" ? Number(target.value) : target.value;
      saveState();
      return;
    }
    if (target.matches("[data-project-field]")) {
      updateProjectField(target);
      if (target.dataset.projectField === "genre") applyPreset(); else render();
      return;
    }
    if (target.matches("[data-publish-check]")) {
      state.checklist[target.dataset.publishCheck] = target.checked;
      saveState();
      render();
      return;
    }
    if (target.matches("[data-visual-file]") && target.files[0]) readMediaMetadata(target.files[0], "visual");
    if (target.matches("[data-loop-audio-file]") && target.files[0]) readMediaMetadata(target.files[0], "audio");
    if (target.matches("[data-qa-file]") && target.files[0]) analyzeAudio(target.files[0]);
    if (target.matches("[data-project-import]") && target.files[0]) {
      target.files[0].text().then((text) => {
        const imported = JSON.parse(text);
        const base = defaultState();
        state = { ...base, ...imported, project: { ...base.project, ...(imported.project || {}) }, media: { ...base.media, ...(imported.media || {}) }, smartLoop: { ...base.smartLoop, ...(imported.smartLoop || {}) } };
        saveState();
        render();
        toast("Đã nhập dự án.");
      }).catch(() => toast("File dự án không hợp lệ.", "error"));
    }
  }

  function handleClick(event) {
    const button = event.target.closest("button, [data-action], [data-copy-text]");
    if (!button) return;
    if (button.dataset.action === "apply-preset") applyPreset();
    if (button.dataset.action === "save-project") { saveState(); toast("Dự án đã lưu trên thiết bị."); }
    if (button.dataset.action === "export-project") download(JSON.stringify(state, null, 2), `${state.project.name.replace(/[^a-z0-9_-]+/gi, "-")}.hhmusic.json`, "application/json");
    if (button.hasAttribute("data-run-auto")) runAutomaticPipeline();
    if (button.hasAttribute("data-stop-auto")) { pipelineCancelled = true; toast("Pipeline sẽ dừng sau tác vụ hiện tại."); }
    if (button.hasAttribute("data-refresh-providers")) { refreshProviders().then(() => toast("Đã cập nhật trạng thái kết nối.")); }
    if (button.dataset.downloadGenerated) {
      const asset = { image: generatedImage, audio: generatedAudio, video: generatedVideo }[button.dataset.downloadGenerated];
      const extension = button.dataset.downloadGenerated === "image" ? "jpg" : button.dataset.downloadGenerated === "audio" ? "mp3" : "mp4";
      if (asset?.blob) downloadBlob(asset.blob, `${safeProjectName()}-${button.dataset.downloadGenerated}.${extension}`);
    }
    if (button.hasAttribute("data-download-production-pack")) downloadProductionPack();
    if (button.hasAttribute("data-copy-all-prompts")) {
      const pack = promptPack();
      copyText(Object.entries(pack).map(([key, text]) => `${key.toUpperCase()}\n${text}`).join("\n\n"));
    }
    if (button.dataset.copyText) copyText(promptPack()[button.dataset.copyText]);
    if (button.hasAttribute("data-copy-command")) copyText(ffmpegCommand());
    if (button.hasAttribute("data-download-bat")) download(smartLoopBat(), `${state.project.name.replace(/[^a-z0-9_-]+/gi, "-")}-render.bat`, "application/x-bat");
    if (button.hasAttribute("data-add-chapter")) { state.chapters.push({ name: `Track ${state.chapters.length + 1}`, duration: "30:00" }); saveState(); render(); }
    if (button.dataset.removeChapter !== undefined) { state.chapters.splice(Number(button.dataset.removeChapter), 1); saveState(); render(); }
    if (button.hasAttribute("data-copy-chapters")) copyText(chapterOutput().lines.join("\n"));
    if (button.dataset.copyYoutube) copyText(youtubePack()[button.dataset.copyYoutube]);
    if (button.hasAttribute("data-download-youtube")) {
      const pack = youtubePack();
      download(`TITLE\n${pack.title}\n\nTHUMBNAIL TEXT\n${pack.thumbnailText}\n\nDESCRIPTION\n${pack.description}\n\nTAGS\n${pack.tags}\n`, `${state.project.name.replace(/[^a-z0-9_-]+/gi, "-")}-youtube.txt`);
    }
    if (button.hasAttribute("data-reset-checklist")) { state.checklist = {}; saveState(); render(); }
  }

  function mount(nextHost, options = {}) {
    unmount();
    host = nextHost;
    state = loadState();
    view = VIEWS.some((item) => item.id === options.view) ? options.view : "project";
    controller = new AbortController();
    host.addEventListener("input", handleInput, { signal: controller.signal });
    host.addEventListener("change", handleChange, { signal: controller.signal });
    host.addEventListener("click", handleClick, { signal: controller.signal });
    render();
    if (view === "project") {
      refreshProviders();
      restoreGeneratedAssets();
    }
  }

  function unmount() {
    window.HHYouTubePublisher?.unmount?.();
    window.HHMusicAIApps?.unmount?.();
    controller?.abort();
    controller = null;
    audioContext?.close?.();
    audioContext = null;
    if (visualUrl) URL.revokeObjectURL(visualUrl);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    visualUrl = "";
    audioUrl = "";
    host = null;
  }

  window.HHMusicAIStudio = { mount, unmount, views: VIEWS.map((item) => ({ ...item })) };
})();
