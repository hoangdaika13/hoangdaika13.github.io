(() => {
  "use strict";

  const STORAGE_KEY = "hh.comic-motion-studio.v1";
  const DB_NAME = "hh-comic-motion-media";
  const DB_STORE = "assets";
  const MAX_SCENES = 120;
  const MAX_FILE_BYTES = 40 * 1024 * 1024;
  const SERIES_RESUME_KEY = "hh.comic-motion-series-resume.v1";
  const SERIES_LIBRARY_KEY = "hh.comic-motion-series-library.v1";
  const TASK_CENTER_KEY = "hh.comic-motion-task-center.v1";
  const QUALITY_PRESETS = Object.freeze({
    "720p": { width: 1280, height: 720, label: "720p" },
    "1080p": { width: 1920, height: 1080, label: "1080p" },
    "1440p": { width: 2560, height: 1440, label: "1440p" },
    "4K": { width: 3840, height: 2160, label: "4K" }
  });
  const CAMERA_PRESETS = Object.freeze([
    { id: "conversation", label: "Hội thoại", mode: "zoom-in", startScale: 1.02, endScale: 1.08, effect: "still" },
    { id: "action", label: "Hành động", mode: "kenburns", startScale: 1.04, endScale: 1.2, effect: "action" },
    { id: "comedy", label: "Hài", mode: "pan-right", startScale: 1.01, endScale: 1.08, effect: "bounce" },
    { id: "mystery", label: "Bí ẩn", mode: "zoom-out", startScale: 1.18, endScale: 1.02, effect: "vignette" },
    { id: "romance", label: "Lãng mạn", mode: "kenburns", startScale: 1.01, endScale: 1.1, effect: "soft" }
  ]);
  const FORMATS = Object.freeze({
    landscape: { label: "Ngang 16:9", width: 1920, height: 1080 },
    portrait: { label: "Short 9:16", width: 1080, height: 1920 },
    square: { label: "Vuông 1:1", width: 1080, height: 1080 }
  });
  const MOTIONS = Object.freeze([
    { id: "kenburns", label: "Ken Burns" },
    { id: "zoom-in", label: "Zoom vào" },
    { id: "zoom-out", label: "Zoom ra" },
    { id: "pan-left", label: "Pan trái" },
    { id: "pan-right", label: "Pan phải" },
    { id: "still", label: "Đứng yên" }
  ]);

  let root = null;
  let controller = null;
  let apiBase = "";
  let state = null;
  let assets = new Map();
  let objectUrls = new Map();
  let imageCache = new Map();
  let previewFrame = 0;
  let previewStarted = 0;
  let previewOffset = 0;
  let previewPlaying = false;
  let recorder = null;
  let renderCancelled = false;
  let autosaveTimer = 0;
  let undoStack = [];
  let redoStack = [];
  let mountEpoch = 0;
  let sourceBusy = false;
  let sourceController = null;
  let sourcePause = false;
  let sourceProgress = null;
  let sourcePreviewUrl = "";
  let sourceToastTimer = 0;
  let focusedSection = "workspace";
  let sourceInspection = null;
  let sourceRetryContext = null;
  let sourceLibrary = [];
  let sourceTasks = [];
  let taskTicker = 0;
  let commandPaletteOpen = false;
  let seriesCheckTimer = 0;
  let sourceCurrentConcurrency = 3;
  let sourceAdaptive = true;
  let sourceLatencyEma = 0;
  let chapterPreviewUrls = new Map();
  let libraryCheckCursor = 0;

  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const naturalCompare = (a, b) => String(a).localeCompare(String(b), "vi", { numeric: true, sensitivity: "base" });
  const ownerId = () => {
    const runtime = window.HHAuthz?.currentUser?.();
    let user = runtime;
    if (!user) try { user = JSON.parse(localStorage.getItem("hh-auth-user") || "null"); } catch { user = null; }
    return String(user?.id || user?._id || "guest").replace(/[^a-z0-9_-]/gi, "").slice(0, 80) || "guest";
  };
  const privateKey = () => `${STORAGE_KEY}:${ownerId()}`;
  const defaultDialogue = () => ({ id: uid("line"), speakerId: "narrator", text: "", voiceId: "browser", emotion: "neutral", rate: 1, pitch: 1, pause: 0.35, audioAssetId: "", duration: 0, alignment: null });
  const defaultScene = (assetId = "", name = "Trang mới", order = 0) => ({
    id: uid("scene"), order, assetId, name: String(name).slice(0, 180), duration: 4, locked: false,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    camera: { mode: "kenburns", startScale: 1, endScale: 1.12, focusX: 0.5, focusY: 0.5 },
    dialogues: [defaultDialogue()], currentDialogueId: "", subtitle: true, sfx: ""
  });
  const defaultState = () => ({
    version: 2, projectId: uid("comic"), name: "Dự án truyện mới", currentSceneId: "",
    sourceManifest: { sourceType: "local", sourceUrl: "", domain: "", title: "", rightsAttested: false, attestedAt: "" },
    format: { ...FORMATS.landscape, id: "landscape", quality: "1080p", fps: 24 }, scenes: [],
    speakers: [
      { id: "narrator", name: "Người kể chuyện", voiceId: "browser" },
      { id: "character-1", name: "Nhân vật 1", voiceId: "browser" },
      { id: "character-2", name: "Nhân vật 2", voiceId: "browser" }
    ],
    ttsVoices: [], musicAssetId: "", musicVolume: 0.16, ducking: 0.45,
    uiMode: "basic", ocrLanguages: ["vie", "eng"], pronunciation: {}, watermarkAssetId: "", watermarkOpacity: 0.72,
    introAssetId: "", outroAssetId: "", introDuration: 2, outroDuration: 2,
    renderQueue: [], revision: 1, updatedAt: new Date().toISOString()
  });

  function normalizeDialogue(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      id: String(source.id || uid("line")).slice(0, 100), speakerId: String(source.speakerId || "narrator").slice(0, 100),
      text: String(source.text || "").slice(0, 5000), voiceId: String(source.voiceId || "browser").slice(0, 160),
      emotion: ["neutral", "warm", "sad", "angry", "excited", "whisper"].includes(source.emotion) ? source.emotion : "neutral",
      rate: clamp(source.rate || 1, 0.5, 2), pitch: clamp(source.pitch || 1, 0.5, 2), pause: clamp(source.pause ?? 0.35, 0, 5),
      audioAssetId: String(source.audioAssetId || "").slice(0, 120), duration: clamp(source.duration || 0, 0, 3600), alignment: source.alignment || null,
      confidence: Number.isFinite(Number(source.confidence)) ? Number(source.confidence) : null,
      cacheKey: String(source.cacheKey || "").slice(0, 128), waveform: Array.isArray(source.waveform) ? source.waveform.slice(0, 96).map((value) => clamp(value, 0, 1)) : []
    };
  }
  function normalizeScene(value, index = 0) {
    const source = value && typeof value === "object" ? value : {};
    const crop = source.crop || {};
    const camera = source.camera || {};
    return {
      id: String(source.id || uid("scene")).slice(0, 100), order: index, assetId: String(source.assetId || "").slice(0, 120),
      name: String(source.name || `Trang ${index + 1}`).slice(0, 180), duration: clamp(source.duration || 4, 0.5, 180), locked: Boolean(source.locked),
      crop: { x: clamp(crop.x, 0, 1), y: clamp(crop.y, 0, 1), width: clamp(crop.width || 1, 0.05, 1), height: clamp(crop.height || 1, 0.05, 1) },
      camera: {
        mode: MOTIONS.some((item) => item.id === camera.mode) ? camera.mode : "kenburns",
        startScale: clamp(camera.startScale || 1, 1, 2.5), endScale: clamp(camera.endScale || 1.12, 1, 2.5),
        focusX: clamp(camera.focusX ?? 0.5, 0, 1), focusY: clamp(camera.focusY ?? 0.5, 0, 1)
      },
      dialogues: (Array.isArray(source.dialogues) && source.dialogues.length ? source.dialogues : [defaultDialogue()]).slice(0, 40).map(normalizeDialogue),
      currentDialogueId: String(source.currentDialogueId || "").slice(0, 100),
      subtitle: source.subtitle !== false, sfx: String(source.sfx || "").slice(0, 160),
      effect: ["still", "action", "bounce", "vignette", "soft"].includes(source.effect) ? source.effect : "still",
      ocrConfidence: Number.isFinite(Number(source.ocrConfidence)) ? Number(source.ocrConfidence) : null,
      ocrBoxes: Array.isArray(source.ocrBoxes) ? source.ocrBoxes.slice(0, 400) : []
    };
  }
  function normalizeState(value) {
    const base = defaultState();
    const source = value && typeof value === "object" ? value : {};
    const formatId = Object.hasOwn(FORMATS, source.format?.id) ? source.format.id : "landscape";
    const scenes = Array.isArray(source.scenes) ? source.scenes.slice(0, MAX_SCENES).map(normalizeScene) : [];
    return {
      ...base, ...source,
      projectId: String(source.projectId || base.projectId).slice(0, 100), name: String(source.name || base.name).slice(0, 180),
      currentSceneId: scenes.some((scene) => scene.id === source.currentSceneId) ? source.currentSceneId : scenes[0]?.id || "",
      sourceManifest: { ...base.sourceManifest, ...(source.sourceManifest || {}) },
      format: { ...formatFor(formatId, Object.hasOwn(QUALITY_PRESETS, source.format?.quality) ? source.format.quality : "1080p"), fps: [24, 25, 30, 60].includes(Number(source.format?.fps)) ? Number(source.format.fps) : 24 },
      scenes, speakers: (Array.isArray(source.speakers) ? source.speakers : base.speakers).slice(0, 20).map((speaker, index) => ({ id: String(speaker.id || `speaker-${index}`).slice(0, 100), name: String(speaker.name || `Nhân vật ${index + 1}`).slice(0, 120), voiceId: String(speaker.voiceId || "browser").slice(0, 160) })),
      ttsVoices: (Array.isArray(source.ttsVoices) ? source.ttsVoices : []).slice(0, 100).map((voice) => ({ id: String(voice.id || "").slice(0, 160), name: String(voice.name || "Voice").slice(0, 120), category: String(voice.category || "").slice(0, 80) })).filter((voice) => voice.id),
      musicAssetId: String(source.musicAssetId || "").slice(0, 120), musicVolume: clamp(source.musicVolume ?? 0.16, 0, 1), ducking: clamp(source.ducking ?? 0.45, 0, 1),
      uiMode: source.uiMode === "advanced" ? "advanced" : "basic",
      ocrLanguages: (Array.isArray(source.ocrLanguages) ? source.ocrLanguages : base.ocrLanguages).filter((language) => ["vie", "eng", "jpn", "chi_sim"].includes(language)).slice(0, 4).length ? (Array.isArray(source.ocrLanguages) ? source.ocrLanguages : base.ocrLanguages).filter((language) => ["vie", "eng", "jpn", "chi_sim"].includes(language)).slice(0, 4) : ["vie"],
      pronunciation: source.pronunciation && typeof source.pronunciation === "object" ? Object.fromEntries(Object.entries(source.pronunciation).slice(0, 200).map(([key, value]) => [String(key).slice(0, 100), String(value).slice(0, 160)])) : {},
      watermarkAssetId: String(source.watermarkAssetId || "").slice(0, 120), watermarkOpacity: clamp(source.watermarkOpacity ?? 0.72, 0, 1),
      introAssetId: String(source.introAssetId || "").slice(0, 120), outroAssetId: String(source.outroAssetId || "").slice(0, 120), introDuration: clamp(source.introDuration ?? 2, 0.5, 15), outroDuration: clamp(source.outroDuration ?? 2, 0.5, 15),
      renderQueue: Array.isArray(source.renderQueue) ? source.renderQueue.slice(0, 20).map((item) => ({ id: String(item.id || uid("render")), quality: Object.hasOwn(QUALITY_PRESETS, item.quality) ? item.quality : "1080p", formatId: Object.hasOwn(FORMATS, item.formatId) ? item.formatId : formatId, fps: [24, 30, 60].includes(Number(item.fps)) ? Number(item.fps) : 24, status: ["queued", "running", "done", "error"].includes(item.status) ? item.status : "queued", error: String(item.error || "").slice(0, 240) })) : [],
      revision: Math.max(1, Number(source.revision || 1)), updatedAt: source.updatedAt || base.updatedAt
    };
  }
  function loadState() {
    try { return normalizeState(JSON.parse(localStorage.getItem(privateKey()) || "null")); }
    catch { return normalizeState(null); }
  }
  function saveState() {
    state.updatedAt = new Date().toISOString();
    try { localStorage.setItem(privateKey(), JSON.stringify(state)); } catch {}
    const statusNode = root?.querySelector("[data-cms-save-status]");
    if (statusNode) statusNode.textContent = `Đã tự lưu · ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
  }
  function scheduleSave() { clearTimeout(autosaveTimer); autosaveTimer = setTimeout(saveState, 250); }
  function snapshot() { return JSON.stringify(state); }
  function checkpoint() {
    undoStack.push(snapshot());
    if (undoStack.length > 40) undoStack.shift();
    redoStack = [];
  }
  function restore(serialized) {
    state = normalizeState(JSON.parse(serialized));
    saveState(); render();
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error("Trình duyệt không hỗ trợ kho media cục bộ."));
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Không mở được kho media."));
    });
  }
  async function dbRequest(mode, operation) {
    const db = await Promise.race([openDb(), new Promise((_, reject) => setTimeout(() => reject(new Error("Kho media phản hồi quá chậm.")), 3000))]);
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(DB_STORE, mode);
        const request = operation(transaction.objectStore(DB_STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  }
  const dbPut = (record) => dbRequest("readwrite", (store) => store.put(record));
  const dbDelete = (id) => dbRequest("readwrite", (store) => store.delete(id));
  const dbAll = () => dbRequest("readonly", (store) => store.getAll());
  async function refreshAssets(expectedEpoch = mountEpoch) {
    const expectedOwner = ownerId();
    const expectedProject = state?.projectId;
    const rows = await dbAll().catch(() => []);
    if (expectedEpoch !== mountEpoch || !root) return false;
    assets = new Map(rows.filter((row) => row.ownerId === expectedOwner && row.projectId === expectedProject).map((row) => [row.id, row]));
    for (const url of objectUrls.values()) URL.revokeObjectURL(url);
    objectUrls.clear(); imageCache.clear();
    return true;
  }
  async function storeBlob(blob, name, kind = "image", metadata = {}) {
    const id = uid("cms-asset");
    await dbPut({ id, ownerId: ownerId(), projectId: state.projectId, name: String(name || id).slice(0, 240), type: blob.type || "application/octet-stream", size: blob.size, kind, createdAt: new Date().toISOString(), ...metadata, blob });
    return id;
  }
  function assetUrl(assetId) {
    if (!assetId || !assets.has(assetId)) return "";
    if (!objectUrls.has(assetId)) objectUrls.set(assetId, URL.createObjectURL(assets.get(assetId).blob));
    return objectUrls.get(assetId);
  }
  async function imageFor(assetId) {
    if (imageCache.has(assetId)) return imageCache.get(assetId);
    const url = assetUrl(assetId);
    if (!url) return null;
    const image = new Image();
    image.decoding = "async";
    const promise = new Promise((resolve, reject) => { image.onload = () => resolve(image); image.onerror = () => reject(new Error("Không đọc được ảnh.")); });
    image.src = url;
    imageCache.set(assetId, promise);
    return promise;
  }

  function activeScene() { return state.scenes.find((scene) => scene.id === state.currentSceneId) || state.scenes[0] || null; }
  function activeDialogue(scene = activeScene()) { return scene?.dialogues?.find((line) => line.id === scene.currentDialogueId) || scene?.dialogues?.[0] || null; }
  function dialogueTimeline(scene) {
    const lines = scene?.dialogues || [];
    const weights = lines.map((line) => Math.max(0.8, line.duration || line.text.trim().split(/\s+/).filter(Boolean).length / 2.6 + line.pause));
    const totalWeight = weights.reduce((sum, value) => sum + value, 0) || 1;
    let cursor = 0;
    return lines.map((line, index) => {
      const duration = scene.duration * weights[index] / totalWeight;
      const item = { line, start: cursor, duration, end: cursor + duration };
      cursor += duration; return item;
    });
  }
  function dialogueAtTime(scene, localTime) { return dialogueTimeline(scene).find((item) => localTime < item.end) || dialogueTimeline(scene).at(-1) || null; }
  function totalDuration() { return state.scenes.reduce((sum, scene) => sum + scene.duration, 0); }
  function sceneAtTime(seconds) {
    let cursor = 0;
    for (const scene of state.scenes) {
      if (seconds < cursor + scene.duration) return { scene, localTime: seconds - cursor, start: cursor };
      cursor += scene.duration;
    }
    const scene = state.scenes.at(-1);
    return scene ? { scene, localTime: scene.duration, start: Math.max(0, cursor - scene.duration) } : null;
  }
  function formatTime(seconds, srt = false) {
    const safe = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const secs = Math.floor(safe % 60);
    const millis = Math.floor((safe % 1) * 1000);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}${srt ? "," : "."}${String(millis).padStart(3, "0")}`;
  }
  function status(message, type = "info") {
    const node = root?.querySelector("[data-cms-status]");
    if (!node) return;
    node.textContent = message; node.dataset.type = type;
  }
  function notify(message, type = "info") {
    status(message, type);
    const toast = root?.querySelector("[data-cms-toast]");
    if (toast) {
      toast.textContent = message;
      toast.dataset.type = type;
      toast.hidden = false;
      clearTimeout(sourceToastTimer);
      sourceToastTimer = setTimeout(() => { if (toast.isConnected) toast.hidden = true; }, 5200);
    }
    if (["success", "error"].includes(type) && window.Notification?.permission === "granted") {
      try { new Notification("Comic Motion Studio", { body: message }); } catch {}
    }
  }
  function updateSourceProgress(patch = {}) {
    sourceProgress = { ...(sourceProgress || {}), ...patch };
    const panel = root?.querySelector("[data-cms-source-progress]");
    if (!panel) return;
    panel.hidden = sourceProgress.visible === false;
    const total = Math.max(1, Number(sourceProgress.total) || 1);
    const completed = Math.max(0, Number(sourceProgress.completed) || 0);
    const failed = Math.max(0, Number(sourceProgress.failed) || 0);
    const progress = Math.min(100, Math.round(completed / total * 100));
    const bar = panel.querySelector("[data-cms-progress-bar]"); if (bar) { bar.value = progress; bar.max = 100; }
    const label = panel.querySelector("[data-cms-progress-label]"); if (label) label.textContent = `${progress}% · ${completed}/${total} ảnh`;
    const chapter = panel.querySelector("[data-cms-progress-chapter]"); if (chapter) chapter.textContent = sourceProgress.chapter || "Đang chuẩn bị…";
    const counters = panel.querySelector("[data-cms-progress-counters]"); if (counters) counters.textContent = `Hoàn tất ${completed} · Lỗi ${failed} · Còn lại ${Math.max(0, total - completed - failed)}`;
    const preview = panel.querySelector("[data-cms-progress-preview]");
    if (preview && sourceProgress.previewUrl) { preview.src = sourceProgress.previewUrl; preview.hidden = false; }
    const pause = panel.querySelector("[data-cms-source-pause]"); if (pause) pause.textContent = sourcePause ? "Tiếp tục" : "Tạm dừng";
    const retry = panel.querySelector("[data-cms-source-retry]"); if (retry) retry.hidden = failed === 0;
  }
  function resetSourcePreview() {
    if (sourcePreviewUrl) URL.revokeObjectURL(sourcePreviewUrl);
    sourcePreviewUrl = "";
  }
  function seriesResumeKey(url) { return `${SERIES_RESUME_KEY}:${ownerId()}:${String(url || "")}`; }
  function loadSeriesResume(url) {
    try { return JSON.parse(localStorage.getItem(seriesResumeKey(url)) || "{}") || {}; } catch { return {}; }
  }
  function saveSeriesResume(url, record) {
    try { localStorage.setItem(seriesResumeKey(url), JSON.stringify(record)); } catch {}
  }
  function loadSourceLibrary() {
    try { sourceLibrary = JSON.parse(localStorage.getItem(`${SERIES_LIBRARY_KEY}:${ownerId()}`) || "[]").filter((item) => item && item.url).slice(0, 300); } catch { sourceLibrary = []; }
    return sourceLibrary;
  }
  function saveSourceLibrary() {
    try { localStorage.setItem(`${SERIES_LIBRARY_KEY}:${ownerId()}`, JSON.stringify(sourceLibrary.slice(0, 300))); } catch {}
  }
  function upsertSourceLibrary(source, chapters = []) {
    if (!source?.url) return;
    const normalizedUrl = String(source.url);
    const existing = sourceLibrary.find((item) => item.url === normalizedUrl);
    const latest = chapters.reduce((max, chapter) => Math.max(max, Number(chapter.number) || 0), 0);
    const oldLatest = Number(existing?.latestChapter) || 0;
    const discovered = oldLatest ? chapters.filter((chapter) => Number(chapter.number) > oldLatest).length : 0;
    const record = { ...(existing || {}), url: normalizedUrl, title: String(source.title || existing?.title || normalizedUrl).slice(0, 220), domain: String(source.domain || existing?.domain || "").slice(0, 160), chapterCount: chapters.length || existing?.chapterCount || 0, previousLatestChapter: oldLatest, latestChapter: latest || existing?.latestChapter || 0, lastCheckedAt: new Date().toISOString(), newCount: discovered };
    sourceLibrary = [record, ...sourceLibrary.filter((item) => item.url !== normalizedUrl)].slice(0, 300);
    saveSourceLibrary();
  }
  function loadTaskCenter() {
    try { sourceTasks = JSON.parse(localStorage.getItem(`${TASK_CENTER_KEY}:${ownerId()}`) || "[]").filter(Boolean).slice(0, 100); } catch { sourceTasks = []; }
    return sourceTasks;
  }
  function saveTaskCenter() {
    try { localStorage.setItem(`${TASK_CENTER_KEY}:${ownerId()}`, JSON.stringify(sourceTasks.slice(0, 100))); } catch {}
  }
  function upsertSourceTask(task) {
    const index = sourceTasks.findIndex((item) => item.id === task.id);
    sourceTasks[index < 0 ? sourceTasks.length : index] = { ...(index < 0 ? {} : sourceTasks[index]), ...task, updatedAt: new Date().toISOString() };
    sourceTasks = sourceTasks.slice(-100);
    saveTaskCenter();
    updateTaskCenter();
  }
  function updateTaskCenter() {
    const panel = root?.querySelector("[data-cms-task-center]");
    if (!panel) return;
    const active = sourceTasks.filter((task) => ["queued", "running", "paused"].includes(task.status));
    panel.querySelector("[data-cms-task-count]").textContent = String(active.length);
    panel.querySelector("[data-cms-task-list]").innerHTML = sourceTasks.slice(-8).reverse().map((task) => `<li data-task-status="${esc(task.status)}"><span>${esc(task.title || "Tải truyện")}</span><small>${esc(task.statusLabel || task.status)} · ${Number(task.completed || 0)}/${Math.max(1, Number(task.total || 1))}${task.bytes ? ` · ${(task.bytes / 1024 / 1024).toFixed(1)} MB` : ""}</small></li>`).join("") || "<li class=\"cms-task-empty\">Chưa có tác vụ</li>";
  }
  function formatFor(formatId, quality = "1080p") {
    const base = FORMATS[formatId] || FORMATS.landscape;
    const preset = QUALITY_PRESETS[quality] || QUALITY_PRESETS["1080p"];
    const ratio = base.width / base.height;
    const width = base.width >= base.height ? preset.width : preset.height;
    const height = Math.round(width / ratio);
    return { ...base, width, height, id: formatId, quality };
  }
  async function checkSourceLibraryUpdates() {
    if (sourceBusy || !sourceLibrary.length || !navigator.onLine) return;
    const candidates = Array.from({ length: Math.min(12, sourceLibrary.length) }, (_, offset) => sourceLibrary[(libraryCheckCursor + offset) % sourceLibrary.length]);
    libraryCheckCursor = (libraryCheckCursor + candidates.length) % sourceLibrary.length;
    let changed = false;
    for (const record of candidates) {
      try {
        const response = await api({ action: "inspect-series", url: record.url, rightsAttested: true });
        const result = await response.json();
        const chapters = Array.isArray(result.chapters) ? result.chapters : [];
        const latest = chapters.reduce((max, chapter) => Math.max(max, Number(chapter.number) || 0), 0);
        const oldLatest = Number(record.latestChapter) || 0;
        record.newCount = Math.max(0, chapters.filter((chapter) => Number(chapter.number) > oldLatest).length);
        record.chapterCount = chapters.length; record.latestChapter = latest; record.lastCheckedAt = new Date().toISOString();
        if (record.newCount > 0 && latest > oldLatest) notify(`${record.title}: có ${record.newCount} chương mới.`, "success");
        changed = true;
      } catch {}
    }
    if (changed) { saveSourceLibrary(); render(); }
  }
  function authHeaders() {
    const token = window.HHAuthSession?.token?.() || "";
    return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  }
  async function api(payload, signal = controller?.signal) {
    const response = await fetch(`${apiBase}/api/media/comic-source`, { method: "POST", credentials: "include", headers: authHeaders(), body: JSON.stringify(payload), signal });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Máy chủ trả về HTTP ${response.status}.`);
    }
    return response;
  }

  function capabilities() {
    const capture = Boolean(window.HTMLCanvasElement?.prototype?.captureStream && window.MediaRecorder);
    const supported = (list) => list.find((mime) => !MediaRecorder?.isTypeSupported || MediaRecorder.isTypeSupported(mime)) || "";
    return {
      capture,
      mp4Mime: capture ? supported(['video/mp4;codecs="avc1.42E01E,mp4a.40.2"', "video/mp4"]) : "",
      webmMime: capture ? supported(["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]) : ""
    };
  }

  function sourceDialogMarkup() {
    // Replaces the former “Tải ảnh từ website được cấp phép” form; no license code or proof field is requested.
    return `<dialog class="cms-source-dialog" data-cms-source-dialog>
      <form method="dialog" data-cms-source-form>
        <header><div><small>COMIC SOURCE</small><h3>Tải ảnh truyện</h3><p>Dán URL một chương hoặc trang danh sách truyện. Tool chỉ đọc HTML công khai trong phạm vi URL đã chọn, không vượt CAPTCHA, anti-bot hoặc giới hạn truy cập.</p></div><button type="button" data-cms-close-source aria-label="Đóng">×</button></header>
        <label>URL HTTPS<input type="url" name="url" required placeholder="https://website-cua-ban.vn/truyen/chuong-01"></label>
        <div class="cms-form-grid"><label>Phạm vi tải<select name="sourceType"><option value="auto">Tự nhận diện</option><option value="chapter">Một chương</option><option value="series">Toàn bộ truyện</option></select></label><label>Đầu ra<select name="sourceMode"><option value="download">Tải toàn bộ về máy</option><option value="import">Nhập vào project</option><option value="both">Tải về + nhập project</option></select></label></div>
        <p class="cms-source-ack">Khi bấm <strong>Kiểm tra và tải</strong>, bạn xác nhận mình sở hữu hoặc được phép tải nội dung từ URL đã nhập. Xác nhận được ghi nhận tự động, không cần giấy phép hoặc mã bằng chứng.</p>
        <section class="cms-series-preview" data-cms-series-preview hidden><header><strong>Danh sách chương</strong><span data-cms-series-count>Chưa kiểm tra</span></header><div class="cms-series-toolbar"><button type="button" data-cms-series-select-all>Chọn tất cả</button><button type="button" data-cms-series-select-new>Chỉ chương mới</button><label>Từ<input type="number" min="0" data-cms-series-from></label><label>Đến<input type="number" min="0" data-cms-series-to></label><span data-cms-series-selected>0 đã chọn</span></div><div class="cms-series-list" data-cms-series-list></div></section>
        <div class="cms-source-download-settings"><label>Luồng tải <output data-cms-concurrency-output>3</output><input type="range" name="concurrency" min="1" max="6" step="1" value="3" data-cms-concurrency></label><label class="cms-check"><input type="checkbox" name="adaptive" checked><span>Tự giảm tốc khi mạng chậm</span></label></div>
        <section class="cms-source-progress" data-cms-source-progress ${sourceProgress?.visible ? "" : "hidden"}><div class="cms-progress-head"><strong>Tiến trình tải</strong><span data-cms-progress-label>0%</span></div><progress data-cms-progress-bar value="0" max="100"></progress><strong data-cms-progress-chapter>Đang chuẩn bị…</strong><small data-cms-progress-counters>Hoàn tất 0 · Lỗi 0 · Còn lại 0</small><img data-cms-progress-preview alt="Ảnh đang tải" hidden><div class="cms-inline-actions"><button type="button" data-cms-source-pause>Tạm dừng</button><button type="button" data-cms-source-minimize>Ẩn xuống Task Center</button><button type="button" data-cms-source-cancel>Hủy tải</button><button type="button" data-cms-source-retry hidden>Thử lại lỗi</button></div></section>
        <footer><button type="button" data-cms-close-source>Hủy</button><button class="cms-primary" type="submit" value="default">${sourceInspection ? "Bắt đầu tải" : "Kiểm tra danh sách"}</button></footer>
      </form>
    </dialog>`;
  }

  function sceneCard(scene, index) {
    const asset = assets.get(scene.assetId);
    return `<article class="cms-scene-card ${scene.id === state.currentSceneId ? "is-active" : ""}" data-cms-scene="${esc(scene.id)}" draggable="true">
      <button type="button" data-cms-select-scene="${esc(scene.id)}"><span>${String(index + 1).padStart(2, "0")}</span>${asset ? `<img src="${esc(assetUrl(scene.assetId))}" alt="">` : "<i>Ảnh</i>"}<div><strong>${esc(scene.name)}</strong><small>${scene.duration.toFixed(1)}s · ${scene.locked ? "Đã khóa" : "Có thể sửa"}</small></div></button>
      <button type="button" data-cms-remove-scene="${esc(scene.id)}" aria-label="Xóa cảnh">×</button>
    </article>`;
  }

  function inspectorMarkup(scene) {
    if (!scene) return `<div class="cms-empty"><strong>Chưa có cảnh</strong><p>Thêm ảnh, folder, ZIP/CBZ hoặc PDF để bắt đầu.</p></div>`;
    const line = activeDialogue(scene);
    return `<div class="cms-inspector-scroll">
      <section class="cms-panel"><header><div><small>SCENE INSPECTOR</small><h3>${esc(scene.name)}</h3></div><label class="cms-switch"><input type="checkbox" data-cms-field="locked" ${scene.locked ? "checked" : ""}><span>Khóa</span></label></header>
        <label>Thời lượng cảnh <output data-cms-duration-output>${scene.duration.toFixed(1)} giây</output><input type="range" min="0.5" max="30" step="0.1" value="${scene.duration}" data-cms-field="duration"></label>
        <label>Chuyển động camera<select data-cms-camera="mode">${MOTIONS.map((item) => `<option value="${item.id}" ${scene.camera.mode === item.id ? "selected" : ""}>${item.label}</option>`).join("")}</select></label>
        <div class="cms-form-grid"><label>Tiêu điểm X<input type="range" min="0" max="1" step="0.01" value="${scene.camera.focusX}" data-cms-camera="focusX"></label><label>Tiêu điểm Y<input type="range" min="0" max="1" step="0.01" value="${scene.camera.focusY}" data-cms-camera="focusY"></label></div>
        <div class="cms-inline-actions"><button type="button" data-cms-action="detect-panels">Tách panel theo khoảng trắng</button><button type="button" data-cms-action="ocr">OCR Việt + Anh</button></div>
      </section>
      <section class="cms-panel"><header><div><small>SCRIPT & VOICE</small><h3>Lời thoại chính</h3></div><button type="button" data-cms-action="add-speaker">+ Nhân vật</button></header>
        <div class="cms-dialogue-tabs">${scene.dialogues.map((item, index) => `<button type="button" class="${item.id === line.id ? "is-active" : ""}" data-cms-select-line="${esc(item.id)}">${index + 1}. ${esc(state.speakers.find((speaker) => speaker.id === item.speakerId)?.name || "Người nói")}</button>`).join("")}<button type="button" data-cms-action="add-line">+ Câu thoại</button></div>
        <div class="cms-form-grid"><label>Người nói<select data-cms-line="speakerId">${state.speakers.map((speaker) => `<option value="${esc(speaker.id)}" ${line.speakerId === speaker.id ? "selected" : ""}>${esc(speaker.name)}</option>`).join("")}</select></label><label>Cảm xúc<select data-cms-line="emotion">${[["neutral","Trung tính"],["warm","Ấm áp"],["sad","Buồn"],["angry","Giận dữ"],["excited","Hào hứng"],["whisper","Thì thầm"]].map(([id,label]) => `<option value="${id}" ${line.emotion === id ? "selected" : ""}>${label}</option>`).join("")}</select></label></div>
        <label>Nội dung<textarea rows="6" maxlength="5000" data-cms-line="text" placeholder="Nhập lời kể hoặc lời thoại…">${esc(line.text)}</textarea><small>${line.text.length}/5000</small></label>
        <div class="cms-form-grid"><label>Tốc độ<input type="range" min="0.5" max="2" step="0.05" value="${line.rate}" data-cms-line="rate"></label><label>Cao độ<input type="range" min="0.5" max="2" step="0.05" value="${line.pitch}" data-cms-line="pitch"></label></div>
        <label>Voice kết xuất<select data-cms-line="voiceId"><option value="browser" ${line.voiceId === "browser" ? "selected" : ""}>Giọng trình duyệt · chỉ nghe thử</option>${state.ttsVoices.map((voice) => `<option value="${esc(voice.id)}" ${line.voiceId === voice.id ? "selected" : ""}>ElevenLabs · ${esc(voice.name)}</option>`).join("")}</select></label>
        <div class="cms-inline-actions"><button type="button" data-cms-action="preview-voice">Nghe thử</button><button type="button" data-cms-action="load-voices">Tải voice ElevenLabs</button><button class="cms-primary" type="button" data-cms-action="generate-voice">Tạo voice để render</button>${scene.dialogues.length > 1 ? `<button type="button" data-cms-action="remove-line">Xóa câu này</button>` : ""}</div>
        <label class="cms-check"><input type="checkbox" data-cms-field="subtitle" ${scene.subtitle ? "checked" : ""}><span>Hiện phụ đề đúng thời gian cảnh</span></label>
        <p class="cms-capability ${line.audioAssetId ? "is-ready" : ""}">${line.audioAssetId ? "Voice kết xuất đã sẵn sàng và sẽ được ghép vào video." : "Giọng trình duyệt chỉ dùng nghe thử. Hãy tạo/upload voice thật trước khi xuất có âm thanh."}</p>
      </section>
      <section class="cms-panel"><small>AUDIO STUDIO</small><h3>Nhạc và ducking</h3>
        <label>Nhạc nền<input type="file" accept="audio/*" data-cms-music-file></label>
        <div class="cms-form-grid"><label>Âm lượng<input type="range" min="0" max="1" step="0.01" value="${state.musicVolume}" data-cms-project="musicVolume"></label><label>Giảm nhạc khi thoại<input type="range" min="0" max="1" step="0.01" value="${state.ducking}" data-cms-project="ducking"></label></div>
        <small>${state.musicAssetId && assets.has(state.musicAssetId) ? `Đang dùng: ${esc(assets.get(state.musicAssetId).name)}` : "Chưa có nhạc nền"}</small>
      </section>
    </div>`;
  }

  function scenePickerMarkup(scene) {
    return `<label class="cms-scene-picker">Cảnh đang chỉnh<select data-cms-scene-select>${state.scenes.map((item, index) => `<option value="${esc(item.id)}" ${item.id === scene?.id ? "selected" : ""}>${String(index + 1).padStart(2, "0")} · ${esc(item.name)}</option>`).join("")}</select></label>`;
  }
  function sourcePaneMarkup() {
    return `<section class="cms-module-pane" data-cms-pane="source"><header class="cms-pane-header"><div><small>SOURCE PAGES</small><h2>Ảnh & chương</h2></div><span class="cms-badge">${state.scenes.length}/${MAX_SCENES}</span></header>
      <div class="cms-source-actions"><label>+ Ảnh<input type="file" accept="image/png,image/jpeg,image/webp" multiple data-cms-images></label><label>+ Folder<input type="file" accept="image/*" multiple webkitdirectory data-cms-folder></label><label>Gói/PDF<input type="file" accept=".zip,.cbz,.pdf,.hhcomic,application/pdf,application/zip" data-cms-package></label><button type="button" data-cms-action="open-source">Tải website</button></div>
      <div class="cms-scenes cms-scenes--pane">${state.scenes.map(sceneCard).join("") || `<div class="cms-empty"><strong>Thả ảnh vào đây</strong><p>PNG, JPG, WebP, folder, ZIP, CBZ hoặc PDF.</p></div>`}</div>
      <div class="cms-rights"><strong>Nguồn nội dung</strong><span>${state.sourceManifest.rightsAttested ? `Đã xác nhận · ${esc(state.sourceManifest.title || state.sourceManifest.domain || "website")}` : "Nguồn cục bộ · bạn chịu trách nhiệm về quyền sử dụng"}</span></div>
      <section class="cms-panel cms-library-panel"><header><div><small>SERIES LIBRARY</small><h3>Truyện đang theo dõi</h3></div><button type="button" data-cms-action="check-library">↻ Kiểm tra</button></header>${sourceLibrary.length ? `<ul class="cms-library-list">${sourceLibrary.slice(0, 20).map((item) => `<li><div><strong>${esc(item.title)}</strong><small>${item.chapterCount || 0} chương · kiểm tra ${item.lastCheckedAt ? esc(new Date(item.lastCheckedAt).toLocaleDateString("vi-VN")) : "chưa có"}</small></div>${item.newCount ? `<button type="button" class="cms-new-badge" data-cms-library-download="${esc(item.url)}">${item.newCount} mới</button>` : "<span class=\"cms-muted-dot\">●</span>"}</li>`).join("")}</ul>` : `<div class="cms-empty cms-empty--small">Chưa có series nào. Khi kiểm tra một URL truyện, nó sẽ được thêm vào đây.</div>`}</section><section class="cms-panel cms-advanced"><small>BULK FOLLOW</small><h3>Thêm nhiều truyện</h3><label>Mỗi dòng một URL HTTPS<textarea rows="4" data-cms-library-urls placeholder="https://website/truyen-a/&#10;https://website/truyen-b/"></textarea></label><button type="button" data-cms-action="add-library-urls">Thêm vào thư viện</button></section>
    </section>`;
  }
  function scriptPaneMarkup(scene) {
    const line = activeDialogue(scene);
    if (!scene || !line) return `<section class="cms-module-pane" data-cms-pane="script"><div class="cms-empty"><strong>Chọn một cảnh để chỉnh kịch bản</strong></div></section>`;
    return `<section class="cms-module-pane" data-cms-pane="script"><header class="cms-pane-header"><div><small>SCRIPT</small><h2>Kịch bản & OCR</h2></div>${scenePickerMarkup(scene)}</header>
      <section class="cms-panel"><div class="cms-inline-actions"><button type="button" data-cms-action="build-storyboard">Tự dựng storyboard</button><button type="button" data-cms-action="detect-panels">Tách panel</button><button type="button" data-cms-action="ocr">OCR ngôn ngữ đã chọn</button></div><div class="cms-form-grid"><label>Ngôn ngữ OCR<select multiple size="4" data-cms-project="ocrLanguages">${[["vie","Tiếng Việt"],["eng","English"],["jpn","日本語"],["chi_sim","简体中文"]].map(([id,label]) => `<option value="${id}" ${state.ocrLanguages.includes(id) ? "selected" : ""}>${label}</option>`).join("")}</select></label><div class="cms-confidence-card"><strong>Độ tin cậy</strong><span class="cms-confidence-value">${scene.ocrConfidence == null ? "Chưa chạy OCR" : `${Math.round(scene.ocrConfidence)}%`}</span><small>${scene.ocrConfidence != null && scene.ocrConfidence < 70 ? "Cần kiểm tra lại" : "Dữ liệu hiện tại"}</small></div></div></section>
      <section class="cms-panel"><header><div><small>SCENE</small><h3>${esc(scene.name)}</h3></div><label class="cms-switch"><input type="checkbox" data-cms-field="locked" ${scene.locked ? "checked" : ""}><span>Khóa</span></label></header><label>Thời lượng <output data-cms-duration-output>${scene.duration.toFixed(1)} giây</output><input type="range" min="0.5" max="180" step="0.1" value="${scene.duration}" data-cms-field="duration"></label><label class="cms-check"><input type="checkbox" data-cms-field="subtitle" ${scene.subtitle ? "checked" : ""}><span>Hiện phụ đề</span></label></section>
      <section class="cms-panel"><header><div><small>DIALOGUE</small><h3>Lời thoại</h3></div><button type="button" data-cms-action="add-line">+ Câu</button></header><div class="cms-dialogue-tabs">${scene.dialogues.map((item, index) => `<button type="button" class="${item.id === line.id ? "is-active" : ""}" data-cms-select-line="${esc(item.id)}">${index + 1}</button>`).join("")}</div><label>Người nói<select data-cms-line="speakerId">${state.speakers.map((speaker) => `<option value="${esc(speaker.id)}" ${line.speakerId === speaker.id ? "selected" : ""}>${esc(speaker.name)}</option>`).join("")}</select></label><label>Nội dung<textarea rows="9" maxlength="5000" data-cms-line="text" placeholder="Nhập hoặc kiểm tra nội dung OCR…">${esc(line.text)}</textarea><small>${line.text.length}/5000 · ${line.confidence != null ? `OCR ${Math.round(line.confidence)}%` : "Chưa có độ tin cậy"}</small></label></section>
    </section>`;
  }
  function voicePaneMarkup(scene) {
    const line = activeDialogue(scene);
    if (!scene || !line) return `<section class="cms-module-pane" data-cms-pane="voice"><div class="cms-empty"><strong>Chọn một cảnh để chỉnh voice</strong></div></section>`;
    return `<section class="cms-module-pane" data-cms-pane="voice"><header class="cms-pane-header"><div><small>VOICE STUDIO</small><h2>Voice & âm thanh</h2></div>${scenePickerMarkup(scene)}</header><section class="cms-panel"><div class="cms-dialogue-tabs">${scene.dialogues.map((item, index) => `<button type="button" class="${item.id === line.id ? "is-active" : ""}" data-cms-select-line="${esc(item.id)}">${index + 1}. ${esc(state.speakers.find((speaker) => speaker.id === item.speakerId)?.name || "Người nói")}</button>`).join("")}</div><div class="cms-form-grid"><label>Người nói<select data-cms-line="speakerId">${state.speakers.map((speaker) => `<option value="${esc(speaker.id)}" ${line.speakerId === speaker.id ? "selected" : ""}>${esc(speaker.name)}</option>`).join("")}</select></label><label>Cảm xúc<select data-cms-line="emotion">${[["neutral","Trung tính"],["warm","Ấm áp"],["sad","Buồn"],["angry","Giận dữ"],["excited","Hào hứng"],["whisper","Thì thầm"]].map(([id,label]) => `<option value="${id}" ${line.emotion === id ? "selected" : ""}>${label}</option>`).join("")}</select></label></div><label>Nội dung<textarea rows="7" maxlength="5000" data-cms-line="text">${esc(line.text)}</textarea></label><div class="cms-form-grid"><label>Tốc độ<input type="range" min="0.5" max="2" step="0.05" value="${line.rate}" data-cms-line="rate"></label><label>Cao độ<input type="range" min="0.5" max="2" step="0.05" value="${line.pitch}" data-cms-line="pitch"></label></div><label>Voice<select data-cms-line="voiceId"><option value="browser" ${line.voiceId === "browser" ? "selected" : ""}>Giọng trình duyệt · nghe thử</option>${state.ttsVoices.map((voice) => `<option value="${esc(voice.id)}" ${line.voiceId === voice.id ? "selected" : ""}>${esc(voice.name)}</option>`).join("")}</select></label><div class="cms-inline-actions"><button type="button" data-cms-action="preview-voice">Nghe thử</button><button type="button" data-cms-action="load-voices">Tải danh sách voice</button><button class="cms-primary" type="button" data-cms-action="generate-voice">Tạo/cache voice</button></div>${line.audioAssetId ? `<div class="cms-waveform" data-cms-waveform="${esc(line.audioAssetId)}">${(line.waveform || Array(48).fill(0.35)).map((value) => `<i style="height:${Math.round(clamp(value,0.08,1)*100)}%"></i>`).join("")}</div>` : "<p class=\"cms-capability\">Chưa có voice kết xuất.</p>"}</section><section class="cms-panel cms-advanced"><small>PRONUNCIATION</small><h3>Từ điển cách đọc</h3><label>Mỗi dòng: từ=cách đọc<textarea rows="4" data-cms-pronunciation placeholder="Nax=Nắc\nH-Central=Hát Central">${esc(Object.entries(state.pronunciation).map(([key,value]) => `${key}=${value}`).join("\n"))}</textarea></label></section><section class="cms-panel"><small>AUDIO MIX</small><h3>Nhạc nền & ducking</h3><label>Nhạc nền<input type="file" accept="audio/*" data-cms-music-file></label><div class="cms-form-grid"><label>Âm lượng<input type="range" min="0" max="1" step="0.01" value="${state.musicVolume}" data-cms-project="musicVolume"></label><label>Giảm nhạc khi thoại<input type="range" min="0" max="1" step="0.01" value="${state.ducking}" data-cms-project="ducking"></label></div></section></section>`;
  }
  function motionPaneMarkup(scene) {
    if (!scene) return `<section class="cms-module-pane" data-cms-pane="motion"><div class="cms-empty"><strong>Chọn một cảnh để chỉnh chuyển động</strong></div></section>`;
    return `<section class="cms-module-pane" data-cms-pane="motion"><header class="cms-pane-header"><div><small>MOTION DESIGN</small><h2>Camera điện ảnh</h2></div>${scenePickerMarkup(scene)}</header><section class="cms-panel"><strong>Preset chuyển động</strong><div class="cms-preset-grid">${CAMERA_PRESETS.map((preset) => `<button type="button" data-cms-camera-preset="${preset.id}" class="${scene.camera.mode === preset.mode && scene.effect === preset.effect ? "is-active" : ""}">${preset.label}</button>`).join("")}</div><label>Chuyển động<select data-cms-camera="mode">${MOTIONS.map((item) => `<option value="${item.id}" ${scene.camera.mode === item.id ? "selected" : ""}>${item.label}</option>`).join("")}</select></label><div class="cms-form-grid"><label>Tiêu điểm X<input type="range" min="0" max="1" step="0.01" value="${scene.camera.focusX}" data-cms-camera="focusX"></label><label>Tiêu điểm Y<input type="range" min="0" max="1" step="0.01" value="${scene.camera.focusY}" data-cms-camera="focusY"></label></div><div class="cms-form-grid"><label>Scale đầu<input type="range" min="1" max="2.5" step="0.01" value="${scene.camera.startScale}" data-cms-camera="startScale"></label><label>Scale cuối<input type="range" min="1" max="2.5" step="0.01" value="${scene.camera.endScale}" data-cms-camera="endScale"></label></div><label>Hiệu ứng<select data-cms-scene-effect><option value="still" ${scene.effect === "still" ? "selected" : ""}>Tĩnh</option><option value="action" ${scene.effect === "action" ? "selected" : ""}>Action · impact nhẹ</option><option value="bounce" ${scene.effect === "bounce" ? "selected" : ""}>Bounce hài</option><option value="vignette" ${scene.effect === "vignette" ? "selected" : ""}>Bí ẩn · vignette</option><option value="soft" ${scene.effect === "soft" ? "selected" : ""}>Mềm · romance</option></select></label></section><section class="cms-panel"><header><small>WATERMARK</small><h3>Brand overlay</h3></header><label>Ảnh watermark<input type="file" accept="image/png,image/webp" data-cms-watermark-file></label><label>Độ trong<input type="range" min="0.1" max="1" step="0.01" value="${state.watermarkOpacity}" data-cms-project="watermarkOpacity"></label></section></section>`;
  }
  function exportPaneMarkup(caps) {
    return `<section class="cms-module-pane" data-cms-pane="export"><header class="cms-pane-header"><div><small>EXPORT</small><h2>Xuất video</h2></div><span class="cms-badge">${state.renderQueue.filter((item) => item.status === "queued").length} chờ</span></header><section class="cms-panel"><div class="cms-form-grid"><label>Khung hình<select data-cms-project="format">${Object.entries(FORMATS).map(([id, value]) => `<option value="${id}" ${state.format.id === id ? "selected" : ""}>${value.label}</option>`).join("")}</select></label><label>Chất lượng<select data-cms-project="quality">${Object.entries(QUALITY_PRESETS).map(([id, value]) => `<option value="${id}" ${state.format.quality === id ? "selected" : ""}>${value.label}</option>`).join("")}</select></label></div><label>FPS<select data-cms-project="fps">${[24,30,60].map((fps) => `<option value="${fps}" ${state.format.fps === fps ? "selected" : ""}>${fps} FPS</option>`).join("")}</select></label><div class="cms-inline-actions"><button type="button" data-cms-action="preview-10">Preview 10 giây</button><button type="button" data-cms-action="enqueue-render">Thêm vào hàng đợi</button><button class="cms-primary" type="button" data-cms-action="render">Xuất ngay · ${caps.mp4Mime ? "MP4" : "WebM"}</button></div><div class="cms-inline-actions"><button type="button" data-cms-action="export-subtitles-srt">Tải SRT</button><button type="button" data-cms-action="export-subtitles-vtt">Tải WebVTT</button><button type="button" data-cms-action="export-project">Lưu .hhcomic</button></div></section><section class="cms-panel cms-advanced"><small>INTRO / OUTRO</small><h3>Chèn trực tiếp vào timeline</h3><div class="cms-form-grid"><label>Intro ảnh<input type="file" accept="image/*" data-cms-intro-file></label><label>Outro ảnh<input type="file" accept="image/*" data-cms-outro-file></label></div><div class="cms-form-grid"><label>Intro (giây)<input type="number" min="0.5" max="15" step="0.5" value="${state.introDuration}" data-cms-project="introDuration"></label><label>Outro (giây)<input type="number" min="0.5" max="15" step="0.5" value="${state.outroDuration}" data-cms-project="outroDuration"></label></div></section><section class="cms-panel"><small>RENDER QUEUE</small><h3>Hàng đợi kết xuất</h3><ul class="cms-render-queue">${state.renderQueue.map((item) => `<li><span>${esc(item.formatId)} · ${esc(item.quality)} · ${item.fps} FPS</span><small>${esc(item.status)}${item.error ? ` · ${esc(item.error)}` : ""}</small>${item.status === "error" ? `<button type="button" data-cms-retry-render="${esc(item.id)}">Thử lại</button>` : ""}</li>`).join("") || "<li class=\"cms-task-empty\">Chưa có job render</li>"}</ul></section></section>`;
  }
  function workspacePaneMarkup(scene, caps) {
    if (focusedSection === "source" || focusedSection === "workspace") return sourcePaneMarkup();
    if (focusedSection === "script") return scriptPaneMarkup(scene);
    if (focusedSection === "voice") return voicePaneMarkup(scene);
    if (focusedSection === "motion") return motionPaneMarkup(scene);
    if (focusedSection === "timeline") return `<section class="cms-module-pane cms-module-pane--timeline" data-cms-pane="timeline">${timelineMarkup()}</section>`;
    if (focusedSection === "export") return exportPaneMarkup(caps);
    return sourcePaneMarkup();
  }

  function timelineMarkup() {
    let cursor = 0;
    const total = Math.max(1, totalDuration());
    const clips = state.scenes.map((scene, index) => {
      const left = cursor / total * 100;
      const width = scene.duration / total * 100;
      cursor += scene.duration;
      return `<button type="button" class="cms-clip ${scene.id === state.currentSceneId ? "is-active" : ""}" style="--clip-left:${left}%;--clip-width:${width}%;--clip-color:hsl(${(index * 47 + 188) % 360} 75% 58%)" data-cms-select-scene="${esc(scene.id)}"><b>${index + 1}</b><span>${esc(scene.name)}</span><small>${scene.duration.toFixed(1)}s</small></button>`;
    }).join("");
    return `<div class="cms-timeline-head"><strong>Timeline</strong><span>${state.scenes.length} cảnh · ${totalDuration().toFixed(1)} giây</span><div><button type="button" data-cms-action="undo" ${undoStack.length ? "" : "disabled"}>↶ Hoàn tác</button><button type="button" data-cms-action="redo" ${redoStack.length ? "" : "disabled"}>↷ Làm lại</button></div></div>
      <div class="cms-track"><label>Image</label><div>${clips}</div></div>
      <div class="cms-track cms-track--simple"><label>Camera</label><div>${state.scenes.map((scene) => `<span style="flex:${scene.duration}">${esc(MOTIONS.find((item) => item.id === scene.camera.mode)?.label || "Still")}</span>`).join("")}</div></div>
      <div class="cms-track cms-track--simple"><label>Voice</label><div>${state.scenes.map((scene) => `<span class="${scene.dialogues.some((line) => line.audioAssetId) ? "is-ready" : ""}" style="flex:${scene.duration}">${scene.dialogues.filter((line) => line.audioAssetId).length || "—"}</span>`).join("")}</div></div>`;
  }

  function render() {
    if (!root) return;
    const caps = capabilities();
    const scene = activeScene();
    root.innerHTML = `<section class="cms-app" data-cms-focus="${esc(focusedSection)}" data-cms-mode="${esc(state.uiMode)}">
      <header class="cms-topbar"><div class="cms-brand"><small>COMIC MOTION STUDIO</small><input value="${esc(state.name)}" maxlength="180" data-cms-project="name" aria-label="Tên dự án"><span data-cms-save-status>Đã tự lưu</span></div><nav class="cms-section-nav" aria-label="Khu vực làm việc"><button type="button" data-cms-section="source" class="${focusedSection === "source" || focusedSection === "workspace" ? "is-active" : ""}">Nguồn</button><button type="button" data-cms-section="script" class="${focusedSection === "script" ? "is-active" : ""}">Kịch bản</button><button type="button" data-cms-section="voice" class="${focusedSection === "voice" ? "is-active" : ""}">Voice</button><button type="button" data-cms-section="motion" class="${focusedSection === "motion" ? "is-active" : ""}">Chuyển động</button><button type="button" data-cms-section="timeline" class="${focusedSection === "timeline" ? "is-active" : ""}">Timeline</button><button type="button" data-cms-section="export" class="${focusedSection === "export" ? "is-active" : ""}">Xuất video</button></nav><div class="cms-top-actions"><button type="button" data-cms-action="toggle-mode">${state.uiMode === "advanced" ? "Advanced" : "Basic"}</button><button type="button" data-cms-action="command-palette">Ctrl K</button><button type="button" data-cms-action="preview-10">Preview</button><button type="button" data-cms-action="render" class="cms-primary">Xuất ${caps.mp4Mime ? "MP4" : "WebM"}</button></div></header>
      <div class="cms-workspace cms-workspace-v2"><section class="cms-module-shell">${workspacePaneMarkup(scene, caps)}</section><main class="cms-preview"><div class="cms-stage"><canvas width="${state.format.width}" height="${state.format.height}" data-cms-canvas></canvas><div class="cms-safe-zone" aria-hidden="true"></div><div class="cms-stage-empty" ${scene ? "hidden" : ""}><strong>Preview video</strong><p>Thêm trang truyện để xem chuyển động camera.</p></div></div><div class="cms-transport"><button type="button" data-cms-action="play">${previewPlaying ? "❚❚" : "▶"}</button><input type="range" min="0" max="${Math.max(0.1, totalDuration())}" step="0.01" value="${previewOffset}" data-cms-scrubber><span data-cms-time>${formatTime(previewOffset)} / ${formatTime(totalDuration())}</span><button type="button" data-cms-action="thumbnail">Thumbnail</button></div><div class="cms-render-info"><span>${state.format.width}×${state.format.height} · ${state.format.fps} FPS</span><span>${caps.mp4Mime ? "MP4 khả dụng" : caps.webmMime ? "WebM thật" : "Render không khả dụng"}</span></div></main></div>
      <footer class="cms-timeline cms-timeline--compact">${focusedSection === "timeline" ? "" : timelineMarkup()}</footer><div class="cms-status" data-cms-status data-type="info">Sẵn sàng. Dự án được lưu riêng theo tài khoản.</div><div class="cms-toast" data-cms-toast data-type="info" hidden role="status" aria-live="polite"></div><aside class="cms-task-center" data-cms-task-center><header><strong>Task Center</strong><span data-cms-task-count>0</span></header><ul data-cms-task-list></ul><button type="button" data-cms-action="request-notifications">Bật thông báo Windows</button></aside>${sourceDialogMarkup()}<dialog class="cms-command-dialog" data-cms-command-dialog><form method="dialog"><input autofocus placeholder="Tìm thao tác…" data-cms-command-input><div data-cms-command-results><button type="button" data-cms-command="source">Mở Nguồn</button><button type="button" data-cms-command="script">Mở Kịch bản</button><button type="button" data-cms-command="voice">Mở Voice</button><button type="button" data-cms-command="motion">Mở Chuyển động</button><button type="button" data-cms-command="timeline">Mở Timeline</button><button type="button" data-cms-command="export">Mở Xuất video</button><button type="button" data-cms-command="storyboard">Tự dựng storyboard</button></div></form></dialog>
    </section>`;
    drawCurrent();
    if (sourceProgress) updateSourceProgress(sourceProgress);
    updateTaskCenter();
  }

  async function drawScene(context, scene, localTime = 0, canvas = context.canvas) {
    context.save();
    context.fillStyle = "#08090d"; context.fillRect(0, 0, canvas.width, canvas.height);
    const image = await imageFor(scene?.assetId).catch(() => null);
    if (image) {
      const progress = clamp(localTime / Math.max(scene.duration, 0.01), 0, 1);
      if (scene.effect === "action") context.translate(Math.sin(progress * Math.PI * 18) * canvas.width * 0.0025, Math.cos(progress * Math.PI * 14) * canvas.height * 0.0025);
      if (scene.effect === "bounce") context.translate(0, -Math.abs(Math.sin(progress * Math.PI * 3)) * canvas.height * 0.008);
      if (scene.effect === "soft") context.filter = "saturate(1.04) contrast(.98)";
      let startScale = scene.camera.startScale, endScale = scene.camera.endScale;
      let panX = 0, panY = 0;
      if (scene.camera.mode === "zoom-out") { startScale = scene.camera.endScale; endScale = scene.camera.startScale; }
      if (scene.camera.mode === "still") { startScale = 1; endScale = 1; }
      if (scene.camera.mode === "pan-left") panX = (0.5 - progress) * 0.18;
      if (scene.camera.mode === "pan-right") panX = (progress - 0.5) * 0.18;
      const scale = startScale + (endScale - startScale) * (progress * progress * (3 - 2 * progress));
      const crop = scene.crop;
      const sx0 = crop.x * image.naturalWidth, sy0 = crop.y * image.naturalHeight;
      const sw0 = crop.width * image.naturalWidth, sh0 = crop.height * image.naturalHeight;
      const targetRatio = canvas.width / canvas.height, sourceRatio = sw0 / sh0;
      let sw = sw0, sh = sh0;
      if (sourceRatio > targetRatio) sw = sh * targetRatio; else sh = sw / targetRatio;
      sw /= scale; sh /= scale;
      const focusX = clamp(scene.camera.focusX + panX, 0, 1), focusY = clamp(scene.camera.focusY + panY, 0, 1);
      const sx = clamp(sx0 + focusX * sw0 - sw / 2, sx0, sx0 + sw0 - sw);
      const sy = clamp(sy0 + focusY * sh0 - sh / 2, sy0, sy0 + sh0 - sh);
      context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const vignette = context.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.15, canvas.width / 2, canvas.height / 2, canvas.width * 0.75);
      vignette.addColorStop(0, "rgba(0,0,0,0)"); vignette.addColorStop(1, "rgba(0,0,0,.24)");
      context.fillStyle = vignette; context.fillRect(0, 0, canvas.width, canvas.height);
      context.filter = "none";
      if (scene.effect === "action" && Math.abs(progress - 0.5) < 0.035) { context.fillStyle = `rgba(255,246,220,${0.16 * (1 - Math.abs(progress - 0.5) / 0.035)})`; context.fillRect(-20, -20, canvas.width + 40, canvas.height + 40); }
      if (scene.effect === "vignette") { context.fillStyle = "rgba(7,9,18,.12)"; context.fillRect(-20, -20, canvas.width + 40, canvas.height + 40); }
    }
    if (state.watermarkAssetId) {
      const watermark = await imageFor(state.watermarkAssetId).catch(() => null);
      if (watermark) { const width = canvas.width * 0.14; const height = width * watermark.naturalHeight / Math.max(1, watermark.naturalWidth); context.globalAlpha = state.watermarkOpacity; context.drawImage(watermark, canvas.width - width - canvas.width * 0.025, canvas.height - height - canvas.height * 0.035, width, height); context.globalAlpha = 1; }
    }
    const timedLine = dialogueAtTime(scene, localTime)?.line || activeDialogue(scene);
    if (scene?.subtitle && timedLine?.text) drawSubtitle(context, timedLine.text, canvas);
    context.restore();
  }
  function wrapLines(context, text, maxWidth) {
    const words = String(text).trim().split(/\s+/); const lines = []; let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (context.measureText(next).width > maxWidth && line) { lines.push(line); line = word; }
      else line = next;
    }
    if (line) lines.push(line);
    return lines.slice(0, 4);
  }
  function drawSubtitle(context, text, canvas) {
    const size = Math.max(28, Math.round(canvas.height * 0.043));
    context.font = `700 ${size}px system-ui, sans-serif`; context.textAlign = "center"; context.textBaseline = "middle";
    const lines = wrapLines(context, text, canvas.width * 0.78);
    const lineHeight = size * 1.28, height = lines.length * lineHeight + size;
    const y = canvas.height * 0.84 - height / 2;
    context.fillStyle = "rgba(0,0,0,.68)"; context.beginPath(); context.roundRect(canvas.width * 0.08, y, canvas.width * 0.84, height, size * 0.45); context.fill();
    context.lineWidth = Math.max(3, size * 0.11); context.strokeStyle = "rgba(0,0,0,.88)"; context.fillStyle = "#fff";
    lines.forEach((line, index) => { const lineY = y + size * 0.7 + index * lineHeight; context.strokeText(line, canvas.width / 2, lineY); context.fillText(line, canvas.width / 2, lineY); });
  }
  async function drawCurrent() {
    const canvas = root?.querySelector("[data-cms-canvas]");
    const scene = activeScene();
    if (!canvas || !scene) return;
    await drawScene(canvas.getContext("2d"), scene, 0, canvas);
  }
  async function previewTick(now) {
    if (!previewPlaying || !root) return;
    const elapsed = previewOffset + (now - previewStarted) / 1000;
    const total = totalDuration();
    if (!total || elapsed >= total) { previewPlaying = false; previewOffset = 0; render(); return; }
    const position = sceneAtTime(elapsed);
    if (position) {
      state.currentSceneId = position.scene.id;
      const canvas = root.querySelector("[data-cms-canvas]");
      if (canvas) await drawScene(canvas.getContext("2d"), position.scene, position.localTime, canvas);
      const scrubber = root.querySelector("[data-cms-scrubber]"); if (scrubber) scrubber.value = String(elapsed);
      const time = root.querySelector("[data-cms-time]"); if (time) time.textContent = `${formatTime(elapsed)} / ${formatTime(total)}`;
    }
    previewFrame = requestAnimationFrame(previewTick);
  }

  async function importImageBlobs(entries, sourceManifest = null, options = {}) {
    const room = MAX_SCENES - state.scenes.length;
    const accepted = entries.filter((entry) => entry.blob?.type?.startsWith("image/") && entry.blob.size <= MAX_FILE_BYTES).slice(0, room).sort((a, b) => naturalCompare(a.name, b.name));
    if (!accepted.length) throw new Error("Không tìm thấy ảnh PNG, JPG hoặc WebP hợp lệ.");
    checkpoint();
    for (const entry of accepted) {
      const assetId = await storeBlob(entry.blob, entry.name, "image");
      state.scenes.push(defaultScene(assetId, entry.name.replace(/\.[^.]+$/, ""), state.scenes.length));
    }
    if (sourceManifest) state.sourceManifest = { ...state.sourceManifest, ...sourceManifest };
    state.currentSceneId ||= state.scenes[0]?.id || "";
    state.revision += 1; saveState(); await refreshAssets();
    if (!options.deferRender) { render(); status(`Đã thêm ${accepted.length} trang và sắp xếp theo tên tệp.`, "success"); }
    return accepted.length;
  }
  async function importImageFiles(fileList) {
    const files = [...fileList].filter((file) => file.type.startsWith("image/"));
    return importImageBlobs(files.map((file) => ({ name: file.webkitRelativePath || file.name, blob: file })));
  }
  async function importArchive(file) {
    if (!window.JSZip) throw new Error("Bộ đọc ZIP/CBZ chưa tải xong. Hãy làm mới trang.");
    if (file.size > 350 * 1024 * 1024) throw new Error("ZIP/CBZ phải nhỏ hơn 350 MB.");
    status("Đang giải nén ảnh trong trình duyệt…");
    const zip = await window.JSZip.loadAsync(file);
    const entries = Object.values(zip.files).filter((entry) => !entry.dir && /\.(png|jpe?g|webp)$/i.test(entry.name)).sort((a, b) => naturalCompare(a.name, b.name)).slice(0, MAX_SCENES);
    const blobs = [];
    for (const entry of entries) {
      const extension = entry.name.split(".").pop().toLowerCase();
      const type = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
      blobs.push({ name: entry.name, blob: await entry.async("blob", (meta) => status(`Đang giải nén ${entry.name} · ${Math.round(meta.percent)}%`)).then((blob) => new Blob([blob], { type })) });
    }
    return importImageBlobs(blobs, { sourceType: /\.cbz$/i.test(file.name) ? "cbz" : "zip", sourceUrl: file.name });
  }
  async function importPdf(file) {
    if (file.size > 200 * 1024 * 1024) throw new Error("PDF phải nhỏ hơn 200 MB.");
    status("Đang tải bộ đọc PDF và kết xuất từng trang…");
    const pdfjs = await import("./vendor/pdf.min.mjs?v=4.10.38");
    pdfjs.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.mjs?v=4.10.38";
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const entries = [];
    for (let index = 1; index <= Math.min(pdf.numPages, MAX_SCENES); index += 1) {
      status(`Đang chuyển PDF: trang ${index}/${Math.min(pdf.numPages, MAX_SCENES)}…`);
      const page = await pdf.getPage(index); const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas"); canvas.width = viewport.width; canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
      entries.push({ name: `page-${String(index).padStart(4, "0")}.jpg`, blob });
      page.cleanup();
    }
    await pdf.destroy();
    return importImageBlobs(entries, { sourceType: "pdf", sourceUrl: file.name });
  }
  async function importProject(file) {
    if (!window.JSZip) throw new Error("Bộ đọc project chưa tải xong.");
    if (file.size > 500 * 1024 * 1024) throw new Error("Project .hhcomic phải nhỏ hơn 500 MB.");
    status("Đang mở project .hhcomic…");
    const zip = await window.JSZip.loadAsync(file);
    const manifestEntry = zip.file("project.json");
    if (!manifestEntry) throw new Error("Project thiếu project.json.");
    const importedState = normalizeState(JSON.parse(await manifestEntry.async("text")));
    checkpoint(); state = importedState;
    const referenced = new Set([
      ...state.scenes.flatMap((scene) => [scene.assetId, ...scene.dialogues.map((line) => line.audioAssetId)]),
      state.musicAssetId
    ].filter(Boolean));
    for (const assetId of referenced) {
      const entry = Object.values(zip.files).find((item) => !item.dir && item.name.startsWith(`assets/${assetId}-`));
      if (!entry) continue;
      const blob = await entry.async("blob");
      const extension = entry.name.split(".").pop().toLowerCase();
      const type = ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", webm: "audio/webm" })[extension] || "application/octet-stream";
      await dbPut({ id: assetId, ownerId: ownerId(), projectId: state.projectId, name: entry.name.split("/").pop(), type, size: blob.size, kind: type.startsWith("image/") ? "image" : "audio", createdAt: new Date().toISOString(), blob: new Blob([blob], { type }) });
    }
    state.revision += 1; saveState(); await refreshAssets(); render(); status(`Đã mở ${state.scenes.length} cảnh từ project .hhcomic.`, "success");
  }

  async function waitForSourceResume(signal) {
    while (sourcePause) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      await new Promise((resolve) => setTimeout(resolve, 140));
    }
  }
  async function fetchAuthorizedImages(result, signal, options = {}) {
    // V1 compatibility reference: Math.min(3, images.length); V2 supports adaptive 1–6 workers.
    const images = Array.isArray(result?.images) ? result.images : [];
    const downloaded = options.keepBlobs === false ? [] : new Array(images.length);
    let cursor = 0;
    let completed = 0;
    const chapterLabel = options.chapterLabel || result.source?.title || "Chương hiện tại";
    if (sourceProgress) updateSourceProgress({ total: (Number(sourceProgress.total) || 0) + images.length, chapter: chapterLabel });
    const worker = async () => {
      while (cursor < images.length) {
        await waitForSourceResume(signal);
        const position = cursor;
        cursor += 1;
        const image = images[position];
        if (options.skipFingerprints?.[image.fingerprint]) {
          completed += 1;
          if (sourceProgress) updateSourceProgress({ completed: (Number(sourceProgress.completed) || 0) + 1, chapter: chapterLabel });
          continue;
        }
        let lastError = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            const startedAt = performance.now();
            const assetResponse = await api({ action: "fetch-image", token: image.token }, signal);
            const blob = await assetResponse.blob();
            const extension = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
            const entry = { name: `page-${String(position + 1).padStart(4, "0")}.${extension}`, blob, alt: image.alt || "", fingerprint: image.fingerprint || "", checksum: await blobChecksum(blob) };
            if (options.keepBlobs === false) { if (options.onEntry) await options.onEntry(entry, image, position); }
            else downloaded[position] = entry;
            if (options.keepBlobs !== false && options.onEntry) await options.onEntry(entry, image, position);
            completed += 1;
            if (options.taskId) { const task = sourceTasks.find((item) => item.id === options.taskId); upsertSourceTask({ id: options.taskId, status: sourcePause ? "paused" : "running", statusLabel: `${chapterLabel} · ảnh ${completed}/${images.length}`, imageCompleted: completed, imageTotal: images.length, bytes: Number(task?.bytes || 0) + blob.size }); }
            if (sourceProgress) {
              const previewUrl = URL.createObjectURL(blob);
              if (sourcePreviewUrl) URL.revokeObjectURL(sourcePreviewUrl);
              sourcePreviewUrl = previewUrl;
              updateSourceProgress({ completed: (Number(sourceProgress.completed) || 0) + 1, previewUrl, chapter: chapterLabel });
            }
            status(`Đang tải ${chapterLabel} · ảnh ${completed}/${images.length}…`);
            const latency = performance.now() - startedAt;
            sourceLatencyEma = sourceLatencyEma ? sourceLatencyEma * 0.8 + latency * 0.2 : latency;
            if (sourceAdaptive && sourceLatencyEma > 2600 && sourceCurrentConcurrency > 1) sourceCurrentConcurrency -= 1;
            else if (sourceAdaptive && sourceLatencyEma < 850 && sourceCurrentConcurrency < Math.max(1, Number(options.concurrency) || 3)) sourceCurrentConcurrency += 1;
            lastError = null;
            break;
          } catch (error) {
            lastError = error;
            if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * (2 ** attempt)));
          }
        }
        if (lastError) {
          if (sourceProgress) updateSourceProgress({ failed: (Number(sourceProgress.failed) || 0) + 1, chapter: chapterLabel });
          throw lastError;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(sourceCurrentConcurrency || options.concurrency || 3, images.length) }, worker));
    return downloaded.filter(Boolean);
  }

  async function downloadSourceArchive(entries, result, options = {}) {
    if (!window.JSZip) throw new Error("Bộ đóng gói ZIP chưa tải xong. Hãy làm mới trang.");
    const zip = new window.JSZip();
    const folder = zip.folder("images");
    entries.forEach((entry) => folder.file(entry.name, entry.blob));
    zip.file("source-manifest.json", JSON.stringify({
      schemaVersion: 1,
      downloadedAt: new Date().toISOString(),
      source: result.source,
      policy: result.policy,
      rights: { attested: true, attestedAt: result.source?.inspectedAt || new Date().toISOString() },
      images: entries.map((entry, index) => ({ index: index + 1, file: `images/${entry.name}`, mimeType: entry.blob.type, bytes: entry.blob.size, alt: entry.alt }))
    }, null, 2));
    status(`Đang đóng gói ${entries.length} ảnh thành ZIP…`);
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } }, (meta) => status(`Đang đóng gói ZIP · ${Math.round(meta.percent)}%…`));
    const archiveName = safeFilename(result.source?.title || new URL(result.source?.url || location.href).pathname.split("/").filter(Boolean).pop() || "comic-chapter");
    downloadBlob(blob, `${archiveName}-images.zip`);
  }

  async function blobChecksum(blob) {
    const subtle = window.crypto?.subtle;
    if (!subtle) return "";
    const digest = await subtle.digest("SHA-256", await blob.arrayBuffer());
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  async function writeDirectoryEntry(directory, entry) {
    if (!directory?.getFileHandle) return false;
    const file = await directory.getFileHandle(entry.name, { create: true });
    const writable = await file.createWritable();
    await writable.write(entry.blob);
    await writable.close();
    return true;
  }
  async function writeChapterDirectoryManifest(directory, chapter, entries, source, sequenceFingerprint = "") {
    if (!directory?.getFileHandle) return false;
    const manifest = { schemaVersion: 2, downloadedAt: new Date().toISOString(), source, chapter: { number: chapter.number, title: chapter.title, url: chapter.url }, sequenceFingerprint, images: entries.map((entry, index) => ({ index: index + 1, file: entry.name, mimeType: entry.blob?.type || entry.type || "image/jpeg", bytes: entry.blob?.size || entry.bytes || 0, alt: entry.alt || "", checksum: entry.checksum || "", fingerprint: entry.fingerprint || "" })) };
    const manifestFile = await directory.getFileHandle("chapter.json", { create: true });
    const manifestWriter = await manifestFile.createWritable();
    await manifestWriter.write(JSON.stringify(manifest, null, 2));
    await manifestWriter.close();
    return true;
  }
  async function writeChapterDirectory(directory, chapter, entries, source) {
    if (!directory?.getDirectoryHandle) return false;
    const folder = await directory.getDirectoryHandle(`Chap-${String(chapter.number).padStart(3, "0")}`, { create: true });
    for (const entry of entries) await writeDirectoryEntry(folder, entry);
    return writeChapterDirectoryManifest(folder, chapter, entries, source);
  }
  async function writeSeriesProject(directory, source, chapters) {
    if (!directory?.getFileHandle || !window.JSZip) return false;
    const zip = new window.JSZip();
    const project = normalizeState({ ...state, projectId: uid("comic"), name: source?.title || state.name, scenes: [], currentSceneId: "", sourceManifest: { ...source, sourceType: "downloaded-series", rightsAttested: true, attestedAt: source?.inspectedAt || new Date().toISOString() } });
    zip.file("project.json", JSON.stringify(project, null, 2));
    zip.file("external-media.json", JSON.stringify({ schemaVersion: 1, folderLayout: "Chap-NNN/page-NNNN.ext", chapters }, null, 2));
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 5 } });
    const file = await directory.getFileHandle("Project.hhcomic", { create: true }); const writer = await file.createWritable(); await writer.write(blob); await writer.close(); return true;
  }

  function renderSeriesPreview(chapters) {
    const section = root?.querySelector("[data-cms-series-preview]");
    const list = section?.querySelector("[data-cms-series-list]");
    const count = section?.querySelector("[data-cms-series-count]");
    if (!section || !list) return;
    section.hidden = false;
    const libraryRecord = sourceLibrary.find((item) => item.url === sourceInspection?.source?.url);
    if (count) count.textContent = `${chapters.length} chương · ${libraryRecord?.newCount ? `${libraryRecord.newCount} mới` : "đã kiểm tra"}`;
    list.innerHTML = chapters.map((chapter) => `<label class="cms-series-row" data-cms-series-row data-cms-series-number="${Number(chapter.number) || 0}"><input type="checkbox" checked data-cms-series-chapter="${esc(chapter.url)}" data-cms-series-number="${Number(chapter.number) || 0}"><span class="cms-series-thumb" data-cms-series-thumb="${esc(chapter.url)}">${Number(chapter.number) || "?"}</span><span>${esc(chapter.title || `Chương ${chapter.number}`)}</span><button type="button" data-cms-preview-chapter="${esc(chapter.url)}">Preview</button></label>`).join("");
    updateSeriesSelection();
    chapters.slice(0, 6).forEach((chapter, index) => setTimeout(() => previewSeriesChapter(chapter.url), index * 160));
  }

  function updateSeriesSelection() {
    const section = root?.querySelector("[data-cms-series-preview]");
    if (!section) return;
    const selected = section.querySelectorAll("[data-cms-series-chapter]:checked").length;
    const output = section.querySelector("[data-cms-series-selected]"); if (output) output.textContent = `${selected} đã chọn`;
  }
  function selectedSeriesChapters() {
    const selected = new Set([...root.querySelectorAll("[data-cms-series-chapter]:checked")].map((input) => input.dataset.cmsSeriesChapter));
    return (sourceInspection?.chapters || []).filter((chapter) => selected.has(chapter.url));
  }
  async function inspectSeriesSource(form, signal, data) {
    updateSourceProgress({ visible: false, chapter: "Đang đọc danh sách chương…" });
    const response = await api({ action: "inspect-series", url: data.get("url"), rightsAttested: true }, signal);
    sourceInspection = await response.json();
    sourceInspection.requestedUrl = String(data.get("url") || "");
    upsertSourceLibrary(sourceInspection.source, sourceInspection.chapters || []);
    renderSeriesPreview(sourceInspection.chapters || []);
    const submit = form.querySelector("button[type=submit]"); if (submit) submit.textContent = "Bắt đầu tải";
    status(`Đã tìm thấy ${sourceInspection.chapters?.length || 0} chương. Chọn phạm vi rồi bấm Bắt đầu tải.`, "success");
    return "inspected";
  }
  async function previewSeriesChapter(url) {
    const chapter = sourceInspection?.chapters?.find((item) => item.url === url);
    const target = root?.querySelector(`[data-cms-series-thumb="${CSS.escape(url)}"]`);
    if (!chapter || !target) return;
    target.textContent = "…";
    try {
      const response = await api({ action: "inspect-chapter", token: chapter.token });
      const result = await response.json();
      const first = result.images?.[0]; if (!first) throw new Error("Chương chưa có ảnh preview.");
      const imageResponse = await api({ action: "fetch-image", token: first.token });
      const blob = await imageResponse.blob();
      const oldUrl = chapterPreviewUrls.get(url); if (oldUrl) URL.revokeObjectURL(oldUrl);
      const previewUrl = URL.createObjectURL(blob); chapterPreviewUrls.set(url, previewUrl);
      target.innerHTML = `<img src="${esc(previewUrl)}" alt="">`;
      target.classList.add("is-loaded");
    } catch (error) { target.textContent = "!"; target.title = error?.message || "Không có preview"; }
  }

  async function chooseSeriesDirectory() {
    if (!window.showDirectoryPicker) return null;
    try { return await window.showDirectoryPicker({ mode: "readwrite", id: "comic-motion-download" }); }
    catch (error) { if (error?.name === "AbortError") throw error; return null; }
  }

  async function importSeries(form, signal, data) {
    const seriesUrl = String(data.get("url") || "");
    const sourceMode = String(data.get("sourceMode") || "download");
    if (!sourceInspection || sourceInspection.requestedUrl !== seriesUrl) return inspectSeriesSource(form, signal, data);
    let directory = null;
    if (["download", "both"].includes(sourceMode)) { const baseDirectory = await chooseSeriesDirectory(); directory = baseDirectory?.getDirectoryHandle ? await baseDirectory.getDirectoryHandle(safeFilename(sourceInspection.source?.title || "comic-series"), { create: true }) : null; }
    updateSourceProgress({ visible: true, total: 0, completed: 0, failed: 0, chapter: "Đang chuẩn bị tải…" });
    const result = sourceInspection;
    let chapters = selectedSeriesChapters();
    const fromValue = root.querySelector("[data-cms-series-from]")?.value ?? ""; const toValue = root.querySelector("[data-cms-series-to]")?.value ?? "";
    const from = fromValue === "" ? null : Number(fromValue); const to = toValue === "" ? null : Number(toValue);
    if (from != null || to != null) chapters = chapters.filter((chapter) => (from == null || Number(chapter.number) >= from) && (to == null || Number(chapter.number) <= to));
    if (!chapters.length) throw new Error("Hãy chọn ít nhất một chương để tải.");
    const fallbackZip = directory || !["download", "both"].includes(sourceMode) ? null : (window.JSZip ? new window.JSZip() : null);
    if (!directory && ["download", "both"].includes(sourceMode) && !fallbackZip) throw new Error("Trình duyệt không hỗ trợ lưu thư mục hoặc ZIP.");
    const resume = loadSeriesResume(seriesUrl);
    const completedChapters = new Set(Array.isArray(resume.completedChapters) ? resume.completedChapters : []);
    const previousFingerprints = resume.images && typeof resume.images === "object" ? resume.images : {};
    const desiredConcurrency = clamp(data.get("concurrency") || 3, 1, 6);
    sourceCurrentConcurrency = desiredConcurrency;
    sourceAdaptive = data.get("adaptive") === "on";
    const taskId = uid("download");
    upsertSourceTask({ id: taskId, title: result.source?.title || "Tải truyện", status: "running", statusLabel: "Đang tải", total: chapters.length, completed: 0, failed: 0 });
    sourceRetryContext = { taskId, form, seriesUrl, sourceMode, directory, fallbackZip, result, chapters, previousFingerprints, completedChapters };
    const chapterManifests = [];
    let importedCount = 0;
    for (let index = 0; index < chapters.length; index += 1) {
      await waitForSourceResume(signal);
      const chapter = chapters[index];
      updateSourceProgress({ chapter: `Chương ${chapter.number} · ${index + 1}/${chapters.length}` });
      if (completedChapters.has(chapter.url) && !directory) { status(`Bỏ qua chương ${chapter.number}: đã tải ở lần trước.`); upsertSourceTask({ id: taskId, statusLabel: `Bỏ qua chương ${chapter.number}`, total: chapters.length, completed: index + 1 }); continue; }
      const chapterResult = await (await api({ action: "inspect-chapter", token: chapter.token }, signal)).json();
      const sameSequence = previousFingerprints[chapter.url]?.sequenceFingerprint && previousFingerprints[chapter.url].sequenceFingerprint === chapterResult.policy?.sequenceFingerprint;
      if (sameSequence && directory) { completedChapters.add(chapter.url); chapterManifests.push({ number: chapter.number, title: chapter.title, url: chapter.url, images: Object.keys(previousFingerprints[chapter.url]?.images || {}).length, sequenceFingerprint: chapterResult.policy?.sequenceFingerprint || "", unchanged: true }); status(`Bỏ qua chương ${chapter.number}: nội dung chưa thay đổi.`); upsertSourceTask({ id: taskId, statusLabel: `Chương ${chapter.number} không đổi`, total: chapters.length, completed: index + 1 }); continue; }
      const chapterDirectory = directory ? await directory.getDirectoryHandle(`Chap-${String(chapter.number).padStart(3, "0")}`, { create: true }) : null;
      const keepBlobs = Boolean(fallbackZip || ["import", "both"].includes(sourceMode));
      const chapterImages = [];
      const previousImages = previousFingerprints[chapter.url]?.images && typeof previousFingerprints[chapter.url].images === "object" ? previousFingerprints[chapter.url].images : {};
      const entries = await fetchAuthorizedImages(chapterResult, signal, { chapterLabel: `Chương ${chapter.number}`, taskId, concurrency: sourceCurrentConcurrency, keepBlobs, skipFingerprints: directory && !keepBlobs ? previousImages : {}, onEntry: async (entry, image) => {
        if (chapterDirectory) await writeDirectoryEntry(chapterDirectory, entry);
        chapterImages.push(keepBlobs ? { ...entry, fingerprint: image.fingerprint || "" } : { name: entry.name, type: entry.blob.type, bytes: entry.blob.size, alt: entry.alt, checksum: entry.checksum, fingerprint: image.fingerprint || "" });
        previousImages[image.fingerprint || ""] = { name: entry.name, type: entry.blob.type, bytes: entry.blob.size, alt: entry.alt, checksum: entry.checksum || "", fingerprint: image.fingerprint || "" };
        saveSeriesResume(seriesUrl, { completedChapters: [...completedChapters], images: previousFingerprints, updatedAt: new Date().toISOString() });
      } });
      const finalEntries = keepBlobs ? entries : chapterResult.images.map((image, position) => previousImages[image.fingerprint] ? { ...previousImages[image.fingerprint] } : chapterImages[position]).filter(Boolean);
      const checksums = Object.fromEntries(Object.entries(previousImages).map(([fingerprint, entry]) => [fingerprint, entry.checksum || ""]));
      chapterManifests.push({ number: chapter.number, title: chapter.title, url: chapter.url, images: finalEntries.length, sequenceFingerprint: chapterResult.policy?.sequenceFingerprint || "", checksums });
      if (directory) await writeChapterDirectoryManifest(chapterDirectory, chapter, finalEntries, result.source, chapterResult.policy?.sequenceFingerprint || "");
      if (fallbackZip) {
        const folder = fallbackZip.folder(`Chap-${String(chapter.number).padStart(3, "0")}`);
        finalEntries.forEach((entry) => folder.file(entry.name, entry.blob));
        fallbackZip.file(`Chap-${String(chapter.number).padStart(3, "0")}/chapter-manifest.json`, JSON.stringify({ chapter, images: finalEntries.map((entry) => ({ file: entry.name, bytes: entry.blob.size, alt: entry.alt, checksum: entry.checksum || "" })) }, null, 2));
      }
      if (["import", "both"].includes(sourceMode) && importedCount < MAX_SCENES) importedCount += await importImageBlobs(finalEntries, { ...result.source, sourceType: "authorized-series", sourceUrl: seriesUrl, rightsAttested: true, attestedAt: result.source.inspectedAt }, { deferRender: true });
      completedChapters.add(chapter.url);
      previousFingerprints[chapter.url] = { sequenceFingerprint: chapterResult.policy?.sequenceFingerprint || "", images: previousImages, checksums };
      saveSeriesResume(seriesUrl, { completedChapters: [...completedChapters], images: previousFingerprints, updatedAt: new Date().toISOString() });
      upsertSourceTask({ id: taskId, statusLabel: `Chương ${chapter.number}`, total: chapters.length, completed: index + 1, failed: 0 });
    }
    if (fallbackZip && ["download", "both"].includes(sourceMode)) {
      fallbackZip.file("manifest.json", JSON.stringify({ schemaVersion: 2, downloadedAt: new Date().toISOString(), source: result.source, chapters: chapterManifests }, null, 2));
      status("Đang đóng gói toàn bộ truyện thành ZIP…");
      const blob = await fallbackZip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 5 } }, (meta) => status(`Đang đóng gói ZIP · ${Math.round(meta.percent)}%…`));
      downloadBlob(blob, `${safeFilename(result.source?.title || "comic-series")}-series.zip`);
    } else if (directory) {
      const rootManifest = await directory.getFileHandle("manifest.json", { create: true });
      const writer = await rootManifest.createWritable(); await writer.write(JSON.stringify({ schemaVersion: 2, downloadedAt: new Date().toISOString(), source: result.source, chapters: chapterManifests }, null, 2)); await writer.close();
      await writeSeriesProject(directory, result.source, chapterManifests);
    }
    if (["import", "both"].includes(sourceMode)) { state.revision += 1; saveState(); await refreshAssets(); render(); }
    updateSourceProgress({ chapter: "Hoàn tất toàn bộ truyện", completed: sourceProgress?.completed || 0 });
    upsertSourceTask({ id: taskId, status: "done", statusLabel: "Hoàn tất", total: chapters.length, completed: chapters.length, failed: 0 });
    const libraryRecord = sourceLibrary.find((item) => item.url === result.source?.url); if (libraryRecord) { libraryRecord.newCount = 0; libraryRecord.previousLatestChapter = libraryRecord.latestChapter; saveSourceLibrary(); }
    notify(`Đã hoàn tất ${completedChapters.size}/${chapters.length} chương${directory ? " vào thư mục đã chọn" : " và tạo ZIP"}.`, "success");
    sourceRetryContext = null;
  }

  async function importWebsite(form, signal) {
    const data = new FormData(form);
    const url = String(data.get("url") || "");
    const selectedType = String(data.get("sourceType") || "auto");
    const isSeries = selectedType === "series" || (selectedType === "auto" && !/(?:chap(?:ter)?|chuong|chương)[-_\s]?\d+/i.test(url));
    if (isSeries) return importSeries(form, signal, data);
    updateSourceProgress({ visible: true, total: 0, completed: 0, failed: 0, chapter: "Đang đọc chương…" });
    status("Đang kiểm tra nguồn và tải ảnh của chương…");
    const response = await api({ action: "inspect", url, rightsAttested: true }, signal);
    const result = await response.json();
    const sourceMode = String(data.get("sourceMode") || "import");
    const imported = await fetchAuthorizedImages(result, signal, { chapterLabel: result.source?.title || "Chương hiện tại" });
    if (["download", "both"].includes(sourceMode)) await downloadSourceArchive(imported, result);
    if (["import", "both"].includes(sourceMode)) {
      await importImageBlobs(imported, { ...result.source, sourceType: "authorized-url", rightsAttested: true, attestedAt: result.source.inspectedAt });
    }
    updateSourceProgress({ chapter: "Hoàn tất chương" });
    notify(`Đã hoàn tất ${imported.length} ảnh${sourceMode === "import" ? " và thêm vào project" : " về máy"}.`, "success");
  }

  async function detectPanels(scene) {
    const image = await imageFor(scene.assetId);
    if (!image) throw new Error("Cảnh chưa có ảnh.");
    const sampleWidth = 320, sampleHeight = Math.max(320, Math.round(image.naturalHeight / image.naturalWidth * sampleWidth));
    const canvas = document.createElement("canvas"); canvas.width = sampleWidth; canvas.height = sampleHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true }); context.drawImage(image, 0, 0, sampleWidth, sampleHeight);
    const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
    const gutters = [];
    for (let y = 1; y < sampleHeight - 1; y += 1) {
      let bright = 0, variance = 0, previous = 0;
      for (let x = 0; x < sampleWidth; x += 4) {
        const index = (y * sampleWidth + x) * 4; const lum = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
        bright += lum > 238 || lum < 14 ? 1 : 0; variance += Math.abs(lum - previous); previous = lum;
      }
      if (bright / (sampleWidth / 4) > 0.88 && variance / (sampleWidth / 4) < 48) gutters.push(y);
    }
    const cuts = [0];
    for (let i = 0; i < gutters.length; i += 1) {
      const start = gutters[i]; while (i + 1 < gutters.length && gutters[i + 1] <= gutters[i] + 2) i += 1;
      const middle = (start + gutters[i]) / 2;
      if (middle - cuts.at(-1) > sampleHeight * 0.12) cuts.push(middle);
    }
    if (sampleHeight - cuts.at(-1) > sampleHeight * 0.12) cuts.push(sampleHeight);
    if (cuts.length <= 2) throw new Error("Không tìm thấy khoảng trắng đủ rõ để tách panel. Bạn vẫn có thể chỉnh tiêu điểm camera thủ công.");
    checkpoint();
    const index = state.scenes.indexOf(scene);
    const panels = [];
    for (let i = 0; i < cuts.length - 1; i += 1) {
      const panel = normalizeScene({ ...scene, id: uid("panel"), name: `${scene.name} · Panel ${i + 1}`, crop: { x: 0, y: cuts[i] / sampleHeight, width: 1, height: (cuts[i + 1] - cuts[i]) / sampleHeight }, locked: false }, index + i);
      panels.push(panel);
    }
    state.scenes.splice(index, 1, ...panels); state.currentSceneId = panels[0].id; saveState(); render();
    status(`Đã tách thành ${panels.length} panel bằng phân tích khoảng trắng cục bộ.`, "success");
  }

  async function createOcrWorker() {
    const languages = (state.ocrLanguages.length ? state.ocrLanguages : ["vie"]).join("+");
    status(`Đang khởi tạo OCR ${languages} trên thiết bị…`);
    return window.Tesseract.createWorker(languages, 1, {
      workerPath: "./vendor/tesseract-worker.min.js?v=6.0.1",
      corePath: "./vendor/tesseract-core-simd-lstm.wasm.js?v=6.0.0",
      langPath: "./vendor/tessdata",
      logger(message) { if (message?.progress != null) status(`OCR · ${String(message.status || "đang xử lý")} · ${Math.round(message.progress * 100)}%`); }
    });
  }
  function bestCameraFocus(boxes, imageWidth, imageHeight) {
    if (!boxes.length || !imageWidth || !imageHeight) return { x: 0.5, y: 0.48 };
    const points = [[.24,.25],[.5,.25],[.76,.25],[.24,.5],[.5,.5],[.76,.5],[.24,.75],[.5,.75],[.76,.75]];
    let best = points[4], bestScore = -1;
    for (const point of points) {
      const score = boxes.reduce((sum, box) => { const x = ((box.x0 + box.x1) / 2) / imageWidth; const y = ((box.y0 + box.y1) / 2) / imageHeight; return sum + Math.hypot(point[0] - x, point[1] - y); }, 0);
      if (score > bestScore) { bestScore = score; best = point; }
    }
    return { x: best[0], y: best[1] };
  }
  async function detectFaceFocus(image) {
    if (!image || typeof window.FaceDetector !== "function") return null;
    try { const faces = await new window.FaceDetector({ fastMode: true, maxDetectedFaces: 8 }).detect(image); const face = faces.sort((a, b) => (b.boundingBox.width * b.boundingBox.height) - (a.boundingBox.width * a.boundingBox.height))[0]; if (!face) return null; return { x: clamp((face.boundingBox.x + face.boundingBox.width / 2) / image.naturalWidth, 0, 1), y: clamp((face.boundingBox.y + face.boundingBox.height / 2) / image.naturalHeight, 0, 1) }; } catch { return null; }
  }
  function storyboardPresetFor(text, index) {
    const value = String(text || "").toLowerCase();
    if ((value.match(/!/g) || []).length >= 2 || /đánh|giết|chạy|nổ|attack|fight/.test(value)) return CAMERA_PRESETS.find((item) => item.id === "action");
    if (/yêu|tim|nhớ|love|kiss/.test(value)) return CAMERA_PRESETS.find((item) => item.id === "romance");
    if (/bí mật|bóng tối|chết|mystery|dark/.test(value)) return CAMERA_PRESETS.find((item) => item.id === "mystery");
    return CAMERA_PRESETS[index % 3 === 0 ? 0 : 2];
  }
  async function recognizeText(scene, options = {}) {
    if (!scene?.assetId || !assets.has(scene.assetId)) throw new Error("Cảnh chưa có ảnh để nhận diện chữ.");
    if (!window.Tesseract?.createWorker) throw new Error("Bộ OCR chưa tải xong. Hãy làm mới trang.");
    const worker = options.worker || await createOcrWorker();
    try {
      const result = await worker.recognize(assetUrl(scene.assetId));
      const text = String(result?.data?.text || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      if (!text) throw new Error("OCR chưa nhận diện được chữ rõ ràng trong cảnh này.");
      if (!options.batch) checkpoint();
      const confidence = clamp(result?.data?.confidence ?? 0, 0, 100);
      const words = Array.isArray(result?.data?.words) ? result.data.words : [];
      scene.ocrConfidence = confidence;
      scene.ocrBoxes = words.map((word) => ({ text: String(word.text || "").slice(0, 80), confidence: clamp(word.confidence || 0, 0, 100), x0: Number(word.bbox?.x0 || 0), y0: Number(word.bbox?.y0 || 0), x1: Number(word.bbox?.x1 || 0), y1: Number(word.bbox?.y1 || 0) })).slice(0, 400);
      const paragraphs = text.split(/\n{2,}/).map((part) => part.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean).slice(0, 12);
      const prior = scene.dialogues || [];
      scene.dialogues = paragraphs.map((paragraph, index) => normalizeDialogue({ ...(prior[index] || defaultDialogue()), id: prior[index]?.id || uid("line"), text: paragraph.slice(0, 5000), speakerId: /^(?:[“"'「『]|[^:]{1,24}:)/.test(paragraph) ? "character-1" : "narrator", audioAssetId: "", alignment: null, confidence }));
      scene.currentDialogueId = scene.dialogues[0].id;
      scene.duration = clamp(Math.max(3, text.split(/\s+/).length / 2.6), 0.5, 180);
      const image = await imageFor(scene.assetId).catch(() => null);
      const focus = await detectFaceFocus(image) || bestCameraFocus(scene.ocrBoxes, image?.naturalWidth || 0, image?.naturalHeight || 0); scene.camera.focusX = focus.x; scene.camera.focusY = focus.y;
      if (!options.batch) { saveState(); render(); status(`OCR hoàn tất · độ tin cậy ${Math.round(confidence)}%.`, confidence < 70 ? "error" : "success"); }
      return { text, confidence };
    } finally { if (!options.worker) await worker.terminate(); }
  }
  async function buildStoryboard() {
    if (!state.scenes.length) throw new Error("Hãy thêm ảnh trước khi tự dựng storyboard.");
    const worker = await createOcrWorker();
    checkpoint();
    let completed = 0, failed = 0;
    try {
      for (let index = 0; index < state.scenes.length; index += 1) {
        const scene = state.scenes[index]; status(`Storyboard · cảnh ${index + 1}/${state.scenes.length}…`);
        try { const result = await recognizeText(scene, { worker, batch: true }); const preset = storyboardPresetFor(result.text, index); scene.camera = { ...scene.camera, mode: preset.mode, startScale: preset.startScale, endScale: preset.endScale }; scene.effect = preset.effect; completed += 1; }
        catch { failed += 1; }
      }
    } finally { await worker.terminate(); }
    saveState(); render(); notify(`Storyboard hoàn tất ${completed}/${state.scenes.length} cảnh${failed ? ` · ${failed} cảnh cần kiểm tra thủ công` : ""}.`, failed ? "info" : "success");
  }

  function speechPreview(line) {
    if (!line?.text) throw new Error("Hãy nhập lời thoại trước.");
    if (line.audioAssetId && assets.has(line.audioAssetId)) {
      const audio = new Audio(assetUrl(line.audioAssetId)); audio.playbackRate = line.rate; return audio.play();
    }
    if (!("speechSynthesis" in window)) throw new Error("Trình duyệt không hỗ trợ nghe thử giọng đọc.");
    speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(line.text); utterance.lang = "vi-VN"; utterance.rate = line.rate; utterance.pitch = line.pitch; speechSynthesis.speak(utterance);
  }
  async function loadVoices() {
    status("Đang tải danh sách giọng ElevenLabs…");
    const result = await (await api({ action: "voices" })).json();
    if (!result.voices?.length) throw new Error("Tài khoản ElevenLabs chưa có voice khả dụng.");
    checkpoint();
    state.ttsVoices = result.voices.map((voice) => ({ id: voice.id, name: voice.name, category: voice.category }));
    const current = activeDialogue();
    const selected = state.ttsVoices.find((voice) => voice.id === current.voiceId) || state.ttsVoices[0];
    current.voiceId = selected.id;
    const speaker = state.speakers.find((item) => item.id === current.speakerId);
    if (speaker) { speaker.voiceId = selected.id; speaker.name = `${speaker.name.split(" · ")[0]} · ${selected.name}`; }
    saveState(); render(); status(`Đã chọn voice ${selected.name}. Có thể đổi voice bằng cách gán cho từng nhân vật ở các lần tải tiếp theo.`, "success");
  }
  function applyPronunciation(text) {
    let output = String(text || "");
    for (const [word, spoken] of Object.entries(state.pronunciation)) output = output.replace(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu"), spoken);
    return output;
  }
  async function stableTextKey(value) {
    const data = new TextEncoder().encode(String(value || ""));
    if (!window.crypto?.subtle) return btoa(unescape(encodeURIComponent(String(value || "")))).slice(0, 120);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  async function waveformForBlob(blob, bars = 48) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return [];
    const context = new AudioCtx();
    try {
      const buffer = await context.decodeAudioData(await blob.arrayBuffer()); const channel = buffer.getChannelData(0); const step = Math.max(1, Math.floor(channel.length / bars)); const output = [];
      for (let index = 0; index < bars; index += 1) { let peak = 0; const end = Math.min(channel.length, (index + 1) * step); for (let cursor = index * step; cursor < end; cursor += Math.max(1, Math.floor(step / 120))) peak = Math.max(peak, Math.abs(channel[cursor])); output.push(clamp(peak * 2.2, 0.08, 1)); }
      return output;
    } finally { await context.close().catch(() => {}); }
  }
  async function generateVoice() {
    const scene = activeScene(), line = activeDialogue(scene);
    if (!line?.text) throw new Error("Hãy nhập lời thoại trước.");
    if (!line.voiceId || line.voiceId === "browser") throw new Error("Hãy tải và chọn voice ElevenLabs. Giọng trình duyệt không thể thu vào video an toàn.");
    const spokenText = applyPronunciation(line.text);
    const cacheKey = await stableTextKey(JSON.stringify({ text: spokenText, voiceId: line.voiceId, rate: line.rate, pitch: line.pitch, emotion: line.emotion }));
    const cached = [...assets.values()].find((asset) => asset.kind === "voice" && asset.cacheKey === cacheKey);
    if (cached) { checkpoint(); line.audioAssetId = cached.id; line.cacheKey = cacheKey; line.waveform = Array.isArray(cached.waveform) ? cached.waveform : []; saveState(); render(); return status("Đã dùng voice cache, không gọi API lại.", "success"); }
    status("Đang tạo voice có timestamp…");
    const result = await (await api({ action: "tts", text: spokenText, voiceId: line.voiceId, rate: line.rate, pitch: line.pitch, emotion: line.emotion })).json();
    const bytes = Uint8Array.from(atob(result.audioBase64), (char) => char.charCodeAt(0));
    const blob = new Blob([bytes], { type: result.mimeType || "audio/mpeg" });
    checkpoint();
    if (line.audioAssetId) await dbDelete(line.audioAssetId).catch(() => {});
    const waveform = await waveformForBlob(blob);
    line.audioAssetId = await storeBlob(blob, `${scene.name}-voice.mp3`, "voice", { cacheKey, waveform }); line.alignment = result.alignment || null; line.cacheKey = cacheKey; line.waveform = waveform;
    const audio = document.createElement("audio"); audio.preload = "metadata"; audio.src = URL.createObjectURL(blob);
    await new Promise((resolve) => { audio.onloadedmetadata = resolve; audio.onerror = resolve; });
    if (Number.isFinite(audio.duration)) { line.duration = audio.duration; scene.duration = clamp(scene.dialogues.reduce((sum, item) => sum + Math.max(0.8, item.duration || item.text.trim().split(/\s+/).filter(Boolean).length / 2.6) + item.pause, 0), 0.5, 180); }
    URL.revokeObjectURL(audio.src); saveState(); await refreshAssets(); render(); status("Voice đã tạo và đồng bộ thời lượng cảnh.", "success");
  }

  async function decodeAudio(audioContext, assetId) {
    const asset = assets.get(assetId); if (!asset?.blob) return null;
    return audioContext.decodeAudioData(await asset.blob.arrayBuffer());
  }
  async function prepareAudio(duration, stream) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return { tracks: [], start() {}, stop() {} };
    const context = new AudioCtx(); const destination = context.createMediaStreamDestination(); const compressor = context.createDynamicsCompressor(); compressor.threshold.value = -16; compressor.knee.value = 18; compressor.ratio.value = 3; compressor.attack.value = 0.006; compressor.release.value = 0.22; compressor.connect(destination); const sources = [];
    let cursor = 0;
    for (const scene of state.scenes) {
      for (const item of dialogueTimeline(scene)) {
        const line = item.line;
        if (!line.audioAssetId) continue;
        const buffer = await decodeAudio(context, line.audioAssetId).catch(() => null);
        if (buffer) { const source = context.createBufferSource(); const gain = context.createGain(); source.buffer = buffer; gain.gain.value = 1; source.connect(gain).connect(compressor); sources.push({ source, when: cursor + item.start }); }
      }
      cursor += scene.duration;
      if (cursor >= duration) break;
    }
    if (state.musicAssetId) {
      const buffer = await decodeAudio(context, state.musicAssetId).catch(() => null);
      if (buffer) { const source = context.createBufferSource(); const gain = context.createGain(); source.buffer = buffer; source.loop = true; gain.gain.value = state.musicVolume * (state.scenes.some((scene) => scene.dialogues.some((line) => line.audioAssetId)) ? state.ducking : 1); source.connect(gain).connect(compressor); sources.push({ source, when: 0, music: true }); }
    }
    destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    return {
      tracks: destination.stream.getAudioTracks(),
      async start() { await context.resume(); const base = context.currentTime + 0.06; sources.forEach((item) => item.source.start(base + item.when)); },
      stop() { sources.forEach((item) => { try { item.source.stop(); } catch {} }); context.close().catch(() => {}); }
    };
  }
  async function renderVideo(limitSeconds = 0) {
    const caps = capabilities();
    const mime = caps.mp4Mime || caps.webmMime;
    if (!caps.capture || !mime) throw new Error("Trình duyệt này không hỗ trợ Canvas MediaRecorder.");
    if (!state.scenes.length) throw new Error("Dự án chưa có cảnh.");
    const duration = Math.min(totalDuration(), limitSeconds || totalDuration());
    if (!duration) throw new Error("Timeline đang trống.");
    const canvas = document.createElement("canvas"); canvas.width = state.format.width; canvas.height = state.format.height;
    const context = canvas.getContext("2d"); const stream = canvas.captureStream(state.format.fps);
    const audio = await prepareAudio(duration, stream);
    const chunks = []; renderCancelled = false;
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: state.format.width >= 1920 ? 12_000_000 : 8_000_000 });
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    const finished = new Promise((resolve, reject) => { recorder.onstop = resolve; recorder.onerror = () => reject(recorder.error || new Error("Render thất bại.")); });
    recorder.start(1000); await audio.start(); const started = performance.now();
    status(`Đang render ${duration.toFixed(1)} giây theo thời gian thực…`);
    await new Promise((resolve) => {
      const tick = async (now) => {
        const elapsed = Math.min(duration, (now - started) / 1000); const position = sceneAtTime(elapsed);
        if (position) await drawScene(context, position.scene, position.localTime, canvas);
        status(`Đang render ${Math.round(elapsed / duration * 100)}% · ${formatTime(elapsed)} / ${formatTime(duration)}`);
        if (renderCancelled || elapsed >= duration) return resolve();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    recorder.stop(); audio.stop(); await finished; recorder = null;
    if (renderCancelled) throw new Error("Đã hủy render.");
    const blob = new Blob(chunks, { type: mime });
    const extension = mime.includes("mp4") ? "mp4" : "webm";
    downloadBlob(blob, `${safeFilename(state.name)}-${limitSeconds ? "preview" : "video"}.${extension}`);
    notify(`Đã kết xuất ${extension.toUpperCase()} thật · ${(blob.size / 1024 / 1024).toFixed(1)} MB.`, "success");
  }

  function enqueueRender() {
    if (!state.scenes.length) throw new Error("Dự án chưa có cảnh để đưa vào hàng đợi.");
    checkpoint(); state.renderQueue.push({ id: uid("render"), quality: state.format.quality || "1080p", formatId: state.format.id, fps: state.format.fps, status: "queued", error: "" }); state.renderQueue = state.renderQueue.slice(-20); saveState(); render(); status("Đã thêm cấu hình hiện tại vào hàng đợi render.", "success");
  }
  async function runRenderQueue() {
    if (recorder?.state === "recording") return;
    for (const job of state.renderQueue.filter((item) => item.status === "queued")) {
      const previous = { ...state.format };
      job.status = "running"; job.error = ""; state.format = { ...formatFor(job.formatId, job.quality), fps: job.fps }; saveState(); render();
      try { await renderVideo(); job.status = "done"; }
      catch (error) { job.status = "error"; job.error = String(error?.message || "Render thất bại").slice(0, 240); }
      finally { state.format = previous; saveState(); render(); }
    }
  }
  function retryRender(id) { const job = state.renderQueue.find((item) => item.id === id); if (!job) return; job.status = "queued"; job.error = ""; saveState(); render(); return runRenderQueue(); }
  function downloadSubtitles(type) {
    const mime = type === "srt" ? "application/x-subrip" : "text/vtt";
    downloadBlob(new Blob([subtitleText(type)], { type: `${mime};charset=utf-8` }), `${safeFilename(state.name)}.${type}`);
    status(`Đã xuất phụ đề ${type.toUpperCase()}.`, "success");
  }

  function safeFilename(value) { return String(value || "comic-motion").normalize("NFKD").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "comic-motion"; }
  function downloadBlob(blob, name) { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); }
  function subtitleText(type = "srt") {
    let cursor = 0, index = 1; const lines = [];
    if (type === "vtt") lines.push("WEBVTT", "");
    for (const scene of state.scenes) {
      for (const item of dialogueTimeline(scene)) {
        const text = item.line.text.trim(); if (!text) continue;
        if (type === "srt") lines.push(String(index));
        lines.push(`${formatTime(cursor + item.start, type === "srt")} --> ${formatTime(cursor + item.end, type === "srt")}`, text, ""); index += 1;
      }
      cursor += scene.duration;
    }
    return lines.join("\n");
  }
  async function exportProject() {
    if (!window.JSZip) throw new Error("Bộ đóng gói dự án chưa tải xong.");
    const zip = new JSZip(); const manifest = structuredClone(state); manifest.exportedAt = new Date().toISOString();
    zip.file("project.json", JSON.stringify(manifest, null, 2));
    const folder = zip.folder("assets");
    for (const asset of assets.values()) folder.file(`${asset.id}-${safeFilename(asset.name)}.${asset.type.split("/")[1]?.replace("jpeg", "jpg") || "bin"}`, asset.blob);
    zip.file("subtitles.srt", subtitleText("srt")); zip.file("subtitles.vtt", subtitleText("vtt"));
    status("Đang đóng gói project và asset…");
    downloadBlob(await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } }), `${safeFilename(state.name)}.hhcomic`);
    status("Đã xuất project .hhcomic kèm asset và phụ đề.", "success");
  }
  async function downloadThumbnail() {
    const canvas = root.querySelector("[data-cms-canvas]"); if (!canvas || !activeScene()) throw new Error("Chưa có cảnh để lấy thumbnail.");
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png")); downloadBlob(blob, `${safeFilename(state.name)}-thumbnail.png`);
  }

  async function handleFiles(target) {
    if (target.matches("[data-cms-images],[data-cms-folder]")) return importImageFiles(target.files || []);
    if (target.matches("[data-cms-package]")) {
      const file = target.files?.[0]; if (!file) return;
      if (/\.hhcomic$/i.test(file.name)) return importProject(file);
      if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") return importPdf(file);
      return importArchive(file);
    }
    if (target.matches("[data-cms-music-file]")) {
      const file = target.files?.[0]; if (!file || !file.type.startsWith("audio/")) throw new Error("Hãy chọn một tệp âm thanh hợp lệ.");
      checkpoint(); if (state.musicAssetId) await dbDelete(state.musicAssetId).catch(() => {});
      state.musicAssetId = await storeBlob(file, file.name, "music"); saveState(); await refreshAssets(); render(); status("Đã thêm nhạc nền.", "success");
    }
    if (target.matches("[data-cms-watermark-file]")) {
      const file = target.files?.[0]; if (!file || !file.type.startsWith("image/")) throw new Error("Hãy chọn watermark PNG hoặc WebP.");
      checkpoint(); if (state.watermarkAssetId) await dbDelete(state.watermarkAssetId).catch(() => {}); state.watermarkAssetId = await storeBlob(file, file.name, "watermark"); saveState(); await refreshAssets(); render(); status("Đã thêm watermark vào preview và video.", "success");
    }
    if (target.matches("[data-cms-intro-file],[data-cms-outro-file]")) {
      const file = target.files?.[0]; if (!file || !file.type.startsWith("image/")) throw new Error("Intro/outro hiện hỗ trợ ảnh PNG, JPG hoặc WebP.");
      checkpoint(); const assetId = await storeBlob(file, file.name, target.matches("[data-cms-intro-file]") ? "intro" : "outro"); const isIntro = target.matches("[data-cms-intro-file]"); const scene = defaultScene(assetId, isIntro ? "Intro" : "Outro", isIntro ? 0 : state.scenes.length); scene.duration = isIntro ? state.introDuration : state.outroDuration; if (isIntro) state.scenes.unshift(scene); else state.scenes.push(scene); state.scenes.forEach((item, index) => { item.order = index; }); state.currentSceneId = scene.id; saveState(); await refreshAssets(); render(); status(`Đã chèn ${isIntro ? "intro" : "outro"} vào timeline.`, "success");
    }
  }
  function updateInput(target) {
    const scene = activeScene(), line = activeDialogue(scene);
    if (target.matches("[data-cms-command-input]")) { const query = target.value.trim().toLowerCase(); root.querySelectorAll("[data-cms-command]").forEach((button) => { button.hidden = query && !button.textContent.toLowerCase().includes(query); }); return; }
    if (target.matches("[data-cms-scene-select]")) { state.currentSceneId = target.value; saveState(); render(); return; }
    if (target.matches("[data-cms-pronunciation]")) { state.pronunciation = Object.fromEntries(String(target.value || "").split(/\r?\n/).map((line) => line.split("=")).filter((parts) => parts.length >= 2 && parts[0].trim()).slice(0, 200).map((parts) => [parts.shift().trim().slice(0,100), parts.join("=").trim().slice(0,160)])); scheduleSave(); return; }
    if (target.matches("[data-cms-project]")) {
      const key = target.dataset.cmsProject;
      if (key === "format") state.format = { ...formatFor(target.value, state.format.quality), fps: state.format.fps };
      else if (key === "quality") state.format = { ...formatFor(state.format.id, target.value), fps: state.format.fps };
      else if (key === "fps") state.format.fps = Number(target.value);
      else if (key === "ocrLanguages") state.ocrLanguages = [...target.selectedOptions].map((option) => option.value).filter(Boolean);
      else state[key] = ["musicVolume", "ducking", "watermarkOpacity", "introDuration", "outroDuration"].includes(key) ? Number(target.value) : target.value;
      scheduleSave(); if (["format", "quality", "fps"].includes(key)) render(); return;
    }
    if (target.matches("[data-cms-scene-effect]")) { checkpoint(); scene.effect = target.value; scheduleSave(); drawCurrent(); return; }
    if (!scene || scene.locked && !target.matches('[data-cms-field="locked"]')) return status("Cảnh đã khóa. Mở khóa trước khi chỉnh sửa.", "error");
    if (target.matches("[data-cms-field]")) {
      checkpoint(); const key = target.dataset.cmsField; scene[key] = target.type === "checkbox" ? target.checked : Number(target.value);
      if (key === "duration") root.querySelector("[data-cms-duration-output]").textContent = `${scene.duration.toFixed(1)} giây`;
      scheduleSave(); drawCurrent(); return;
    }
    if (target.matches("[data-cms-camera]")) {
      checkpoint(); const key = target.dataset.cmsCamera; scene.camera[key] = key === "mode" ? target.value : Number(target.value); scheduleSave(); drawCurrent(); return;
    }
    if (target.matches("[data-cms-line]")) {
      checkpoint(); const key = target.dataset.cmsLine; line[key] = ["rate", "pitch", "pause"].includes(key) ? Number(target.value) : target.value;
      if (key === "text") { line.audioAssetId = ""; line.alignment = null; }
      if (key === "voiceId") { const speaker = state.speakers.find((item) => item.id === line.speakerId); if (speaker) speaker.voiceId = line.voiceId; }
      if (key === "speakerId") { const speaker = state.speakers.find((item) => item.id === line.speakerId); if (speaker?.voiceId) line.voiceId = speaker.voiceId; }
      scheduleSave(); drawCurrent(); return;
    }
  }
  async function handleClick(event) {
    if (event.target.closest("[data-cms-close-source]")) {
      sourceController?.abort();
      sourcePause = false;
      root.querySelector("[data-cms-source-dialog]")?.close();
      return;
    }
    if (event.target.closest("[data-cms-source-cancel]")) {
      sourcePause = false;
      sourceController?.abort();
      if (sourceRetryContext?.taskId) upsertSourceTask({ id: sourceRetryContext.taskId, status: "cancelled", statusLabel: "Đã hủy" });
      notify("Đã gửi yêu cầu hủy tải nguồn ảnh.", "info");
      return;
    }
    if (event.target.closest("[data-cms-source-minimize]")) { root.querySelector("[data-cms-source-dialog]")?.close(); status("Tác vụ vẫn tiếp tục trong Task Center.", "success"); return; }
    if (event.target.closest("[data-cms-source-pause]")) {
      sourcePause = !sourcePause;
      if (sourceRetryContext?.taskId) upsertSourceTask({ id: sourceRetryContext.taskId, status: sourcePause ? "paused" : "running", statusLabel: sourcePause ? "Đã tạm dừng" : "Đang tiếp tục" });
      updateSourceProgress();
      status(sourcePause ? "Đã tạm dừng tải. Bấm Tiếp tục để chạy tiếp." : "Đang tiếp tục tải nguồn ảnh…");
      return;
    }
    if (event.target.closest("[data-cms-source-retry]")) return retryFailedSource();
    const sectionToggle = event.target.closest("[data-cms-section]");
    if (sectionToggle) {
      focusedSection = sectionToggle.dataset.cmsSection || "workspace";
      render();
      return;
    }
    if (event.target.closest("[data-cms-series-select-all]")) {
      root.querySelectorAll("[data-cms-series-chapter]").forEach((input) => { input.checked = true; }); updateSeriesSelection(); return;
    }
    if (event.target.closest("[data-cms-series-select-new]")) {
      const record = sourceLibrary.find((item) => item.url === sourceInspection?.source?.url);
      const latest = Number(record?.previousLatestChapter) || 0;
      root.querySelectorAll("[data-cms-series-chapter]").forEach((input) => { input.checked = Number(input.dataset.cmsSeriesNumber) > latest; }); updateSeriesSelection(); return;
    }
    const previewChapter = event.target.closest("[data-cms-preview-chapter]");
    if (previewChapter) return previewSeriesChapter(previewChapter.dataset.cmsPreviewChapter);
    const cameraPreset = event.target.closest("[data-cms-camera-preset]");
    if (cameraPreset) { const scene = activeScene(); const preset = CAMERA_PRESETS.find((item) => item.id === cameraPreset.dataset.cmsCameraPreset); if (!scene || !preset) return; checkpoint(); scene.camera = { ...scene.camera, mode: preset.mode, startScale: preset.startScale, endScale: preset.endScale }; scene.effect = preset.effect; saveState(); render(); return; }
    const libraryDownload = event.target.closest("[data-cms-library-download]");
    if (libraryDownload) { sourceInspection = null; const dialog = root.querySelector("[data-cms-source-dialog]"); dialog?.showModal(); const url = dialog?.querySelector('[name="url"]'); if (url) url.value = libraryDownload.dataset.cmsLibraryDownload; const type = dialog?.querySelector('[name="sourceType"]'); if (type) type.value = "series"; return; }
    const retryRenderButton = event.target.closest("[data-cms-retry-render]"); if (retryRenderButton) return retryRender(retryRenderButton.dataset.cmsRetryRender);
    const commandButton = event.target.closest("[data-cms-command]");
    if (commandButton) { const command = commandButton.dataset.cmsCommand; root.querySelector("[data-cms-command-dialog]")?.close(); if (["source","script","voice","motion","timeline","export"].includes(command)) { focusedSection = command; render(); return; } if (command === "storyboard") return buildStoryboard(); }
    const selectLine = event.target.closest("[data-cms-select-line]");
    if (selectLine) { const scene = activeScene(); if (scene) { scene.currentDialogueId = selectLine.dataset.cmsSelectLine; saveState(); render(); } return; }
    const select = event.target.closest("[data-cms-select-scene]");
    if (select) { state.currentSceneId = select.dataset.cmsSelectScene; previewOffset = state.scenes.slice(0, state.scenes.findIndex((scene) => scene.id === state.currentSceneId)).reduce((sum, scene) => sum + scene.duration, 0); saveState(); render(); return; }
    const remove = event.target.closest("[data-cms-remove-scene]");
    if (remove) {
      const scene = state.scenes.find((item) => item.id === remove.dataset.cmsRemoveScene); if (!scene || scene.locked) return status("Không thể xóa cảnh đang khóa.", "error");
      checkpoint(); state.scenes = state.scenes.filter((item) => item !== scene); state.currentSceneId = state.scenes[0]?.id || ""; await dbDelete(scene.assetId).catch(() => {}); saveState(); await refreshAssets(); render(); return;
    }
    const action = event.target.closest("[data-cms-action]")?.dataset.cmsAction; if (!action) return;
    if (action === "open-source") { sourceInspection = null; sourceProgress = { visible: false }; resetSourcePreview(); const dialog = root.querySelector("[data-cms-source-dialog]"); dialog?.showModal(); updateSourceProgress(sourceProgress); return; }
    if (action === "toggle-mode") { state.uiMode = state.uiMode === "advanced" ? "basic" : "advanced"; saveState(); render(); return; }
    if (action === "command-palette") { root.querySelector("[data-cms-command-dialog]")?.showModal(); return; }
    if (action === "request-notifications") { if (!("Notification" in window)) return status("Trình duyệt không hỗ trợ thông báo hệ thống.", "error"); const permission = await Notification.requestPermission(); status(permission === "granted" ? "Đã bật thông báo Windows." : "Thông báo chưa được cấp quyền.", permission === "granted" ? "success" : "error"); return; }
    if (action === "check-library") return checkSourceLibraryUpdates();
    if (action === "add-library-urls") { const textarea = root.querySelector("[data-cms-library-urls]"); const urls = String(textarea?.value || "").split(/\s+/).filter((value) => { try { return new URL(value).protocol === "https:"; } catch { return false; } }).slice(0, 300); for (const url of urls) if (!sourceLibrary.some((item) => item.url === url)) sourceLibrary.push({ url, title: url, domain: new URL(url).hostname, chapterCount: 0, latestChapter: 0, previousLatestChapter: 0, newCount: 0, lastCheckedAt: "" }); sourceLibrary = sourceLibrary.slice(0, 300); saveSourceLibrary(); render(); status(`Đã thêm ${urls.length} URL vào thư viện.`, "success"); return; }
    if (action === "build-storyboard") return buildStoryboard();
    if (action === "enqueue-render") { enqueueRender(); return runRenderQueue(); }
    if (action === "export-subtitles-srt") return downloadSubtitles("srt");
    if (action === "export-subtitles-vtt") return downloadSubtitles("vtt");
    if (action === "play") {
      previewPlaying = !previewPlaying;
      if (previewPlaying) { previewStarted = performance.now(); previewFrame = requestAnimationFrame(previewTick); } else { cancelAnimationFrame(previewFrame); previewOffset += (performance.now() - previewStarted) / 1000; }
      render(); return;
    }
    if (action === "preview-10") return renderVideo(10);
    if (action === "render") return renderVideo();
    if (action === "export-project") return exportProject();
    if (action === "thumbnail") return downloadThumbnail();
    if (action === "detect-panels") return detectPanels(activeScene());
    if (action === "ocr") return recognizeText(activeScene());
    if (action === "preview-voice") return speechPreview(activeDialogue());
    if (action === "load-voices") return loadVoices();
    if (action === "generate-voice") return generateVoice();
    if (action === "add-speaker") { checkpoint(); const name = `Nhân vật ${state.speakers.length}`; state.speakers.push({ id: uid("speaker"), name, voiceId: "browser" }); saveState(); render(); return; }
    if (action === "add-line") { const scene = activeScene(); if (!scene || scene.dialogues.length >= 40) return; checkpoint(); const line = defaultDialogue(); scene.dialogues.push(line); scene.currentDialogueId = line.id; saveState(); render(); return; }
    if (action === "remove-line") { const scene = activeScene(), line = activeDialogue(scene); if (!scene || !line || scene.dialogues.length <= 1) return; checkpoint(); scene.dialogues = scene.dialogues.filter((item) => item !== line); scene.currentDialogueId = scene.dialogues[0].id; if (line.audioAssetId) await dbDelete(line.audioAssetId).catch(() => {}); saveState(); await refreshAssets(); render(); return; }
    if (action === "undo" && undoStack.length) { redoStack.push(snapshot()); restore(undoStack.pop()); return; }
    if (action === "redo" && redoStack.length) { undoStack.push(snapshot()); restore(redoStack.pop()); }
  }
  async function handleSubmit(event) {
    if (!event.target.matches("[data-cms-source-form]")) return;
    event.preventDefault();
    if (sourceBusy) return status("Nguồn ảnh đang được xử lý. Hãy chờ tác vụ hiện tại hoàn tất.");
    const form = event.target;
    const operationController = new AbortController();
    sourceController = operationController;
    sourcePause = false;
    sourceBusy = true;
    form.setAttribute("aria-busy", "true");
    form.querySelectorAll("button:not([data-cms-close-source]), input, select").forEach((control) => { control.disabled = true; });
    try {
      const outcome = await importWebsite(form, operationController.signal);
      if (outcome !== "inspected") form.closest("dialog")?.close();
    } catch (error) {
      if (error?.name === "AbortError") {
        notify("Đã hủy tác vụ nhập nguồn ảnh.", "info");
        return;
      }
      if (sourceRetryContext?.taskId) {
        const needsVerification = /(?:403|429|captcha|anti.?bot|xác minh)/i.test(error?.message || "");
        upsertSourceTask({ id: sourceRetryContext.taskId, status: needsVerification ? "paused" : "error", statusLabel: needsVerification ? "Cần xác minh trên website nguồn" : "Có lỗi · có thể thử lại", error: error?.message || "Tải thất bại" });
        updateSourceProgress({ failed: Math.max(1, Number(sourceProgress?.failed) || 0), chapter: "Tác vụ gặp lỗi · bấm Thử lại lỗi" });
      }
      notify(error?.message || "Không thể tải nguồn ảnh.", "error");
      throw error;
    } finally {
      if (sourceController === operationController) sourceController = null;
      sourceBusy = false;
      if (form.isConnected) {
        form.removeAttribute("aria-busy");
        form.querySelectorAll("button, input, select").forEach((control) => { control.disabled = false; });
      }
    }
  }
  async function retryFailedSource() {
    if (!sourceRetryContext?.form || sourceBusy) return;
    const form = sourceRetryContext.form;
    const retryController = new AbortController();
    sourceController = retryController; sourceBusy = true; sourcePause = false;
    try { await importSeries(form, retryController.signal, new FormData(form)); notify("Đã thử lại tác vụ tải.", "success"); }
    catch (error) { notify(error?.message || "Thử lại thất bại.", "error"); }
    finally { sourceBusy = false; sourceController = null; }
  }
  function handleDrag(event) {
    const card = event.target.closest("[data-cms-scene]"); if (!card) return;
    if (event.type === "dragstart") event.dataTransfer.setData("text/plain", card.dataset.cmsScene);
    if (event.type === "dragover") event.preventDefault();
    if (event.type === "drop") {
      event.preventDefault(); const fromId = event.dataTransfer.getData("text/plain"), toId = card.dataset.cmsScene;
      const from = state.scenes.findIndex((scene) => scene.id === fromId), to = state.scenes.findIndex((scene) => scene.id === toId);
      if (from < 0 || to < 0 || from === to) return;
      checkpoint(); const [moved] = state.scenes.splice(from, 1); state.scenes.splice(to, 0, moved); state.scenes.forEach((scene, index) => { scene.order = index; }); saveState(); render();
    }
  }

  async function mount(host, mountOptions = {}) {
    unmount();
    const epoch = ++mountEpoch;
    root = host; apiBase = String(mountOptions.apiBase || window.HH_CONFIG?.API_BASE || "").replace(/\/$/, ""); state = loadState(); loadSourceLibrary(); loadTaskCenter(); controller = new AbortController(); const listenerOptions = { signal: controller.signal };
    root.addEventListener("click", (event) => handleClick(event).catch((error) => status(error.message, "error")), listenerOptions);
    root.addEventListener("input", updateInput, listenerOptions);
    root.addEventListener("change", (event) => {
      if (event.target.matches("[data-cms-series-chapter]")) updateSeriesSelection();
      if (event.target.matches("[data-cms-concurrency]")) { const output = root.querySelector("[data-cms-concurrency-output]"); if (output) output.textContent = event.target.value; }
      handleFiles(event.target).catch((error) => status(error.message, "error"));
    }, listenerOptions);
    root.addEventListener("submit", (event) => handleSubmit(event).catch((error) => status(error.message, "error")), listenerOptions);
    root.addEventListener("dragstart", handleDrag, listenerOptions); root.addEventListener("dragover", handleDrag, listenerOptions); root.addEventListener("drop", handleDrag, listenerOptions);
    root.addEventListener("input", (event) => {
      if (!event.target.matches("[data-cms-scrubber]")) return;
      previewOffset = Number(event.target.value); const position = sceneAtTime(previewOffset); if (position) { state.currentSceneId = position.scene.id; drawScene(root.querySelector("[data-cms-canvas]").getContext("2d"), position.scene, position.localTime); }
    }, listenerOptions);
    window.addEventListener("hh:auth-change", async () => { state = loadState(); if (await refreshAssets(epoch)) render(); }, listenerOptions);
    window.addEventListener("keydown", (event) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName || "");
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); root?.querySelector("[data-cms-command-dialog]")?.showModal(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !typing) { event.preventDefault(); if (event.shiftKey && redoStack.length) { undoStack.push(snapshot()); restore(redoStack.pop()); } else if (undoStack.length) { redoStack.push(snapshot()); restore(undoStack.pop()); } return; }
      if (!typing && /^[1-6]$/.test(event.key)) { focusedSection = ["source","script","voice","motion","timeline","export"][Number(event.key) - 1]; render(); }
    }, listenerOptions);
    if (!await refreshAssets(epoch) || epoch !== mountEpoch || root !== host || controller?.signal.aborted) return false;
    render();
    clearInterval(seriesCheckTimer);
    seriesCheckTimer = setInterval(() => { checkSourceLibraryUpdates().catch(() => {}); }, 30 * 60 * 1000);
    updateTaskCenter();
    return true;
  }
  function unmount() {
    mountEpoch += 1;
    sourceBusy = false;
    clearInterval(seriesCheckTimer); seriesCheckTimer = 0;
    clearTimeout(taskTicker); taskTicker = 0;
    sourceController?.abort(); sourceController = null;
    previewPlaying = false; cancelAnimationFrame(previewFrame); clearTimeout(autosaveTimer); renderCancelled = true;
    if (recorder?.state === "recording") recorder.stop(); recorder = null; window.speechSynthesis?.cancel?.(); controller?.abort(); controller = null;
    for (const url of objectUrls.values()) URL.revokeObjectURL(url); objectUrls.clear(); imageCache.clear();
    for (const url of chapterPreviewUrls.values()) URL.revokeObjectURL(url); chapterPreviewUrls.clear();
    resetSourcePreview();
    if (root) root.innerHTML = ""; root = null;
  }

  window.HHComicMotionStudio = Object.freeze({ mount, unmount, normalizeState, normalizeScene, capabilities, extractSubtitles: subtitleText, formats: FORMATS });
  window.dispatchEvent(new CustomEvent("hh:comic-motion-ready"));
})();
