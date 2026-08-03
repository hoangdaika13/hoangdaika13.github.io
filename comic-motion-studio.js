(() => {
  "use strict";

  const STORAGE_KEY = "hh.comic-motion-studio.v1";
  const DB_NAME = "hh-comic-motion-media";
  const DB_STORE = "assets";
  const MAX_SCENES = 120;
  const MAX_FILE_BYTES = 40 * 1024 * 1024;
  const SERIES_RESUME_KEY = "hh.comic-motion-series-resume.v1";
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
    version: 1, projectId: uid("comic"), name: "Dự án truyện mới", currentSceneId: "",
    sourceManifest: { sourceType: "local", sourceUrl: "", domain: "", title: "", rightsAttested: false, attestedAt: "" },
    format: { ...FORMATS.landscape, id: "landscape", fps: 24 }, scenes: [],
    speakers: [
      { id: "narrator", name: "Người kể chuyện", voiceId: "browser" },
      { id: "character-1", name: "Nhân vật 1", voiceId: "browser" },
      { id: "character-2", name: "Nhân vật 2", voiceId: "browser" }
    ],
    ttsVoices: [], musicAssetId: "", musicVolume: 0.16, ducking: 0.45, revision: 1, updatedAt: new Date().toISOString()
  });

  function normalizeDialogue(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      id: String(source.id || uid("line")).slice(0, 100), speakerId: String(source.speakerId || "narrator").slice(0, 100),
      text: String(source.text || "").slice(0, 5000), voiceId: String(source.voiceId || "browser").slice(0, 160),
      emotion: ["neutral", "warm", "sad", "angry", "excited", "whisper"].includes(source.emotion) ? source.emotion : "neutral",
      rate: clamp(source.rate || 1, 0.5, 2), pitch: clamp(source.pitch || 1, 0.5, 2), pause: clamp(source.pause ?? 0.35, 0, 5),
      audioAssetId: String(source.audioAssetId || "").slice(0, 120), duration: clamp(source.duration || 0, 0, 3600), alignment: source.alignment || null
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
      subtitle: source.subtitle !== false, sfx: String(source.sfx || "").slice(0, 160)
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
      format: { ...FORMATS[formatId], id: formatId, fps: [24, 25, 30].includes(Number(source.format?.fps)) ? Number(source.format.fps) : 24 },
      scenes, speakers: (Array.isArray(source.speakers) ? source.speakers : base.speakers).slice(0, 20).map((speaker, index) => ({ id: String(speaker.id || `speaker-${index}`).slice(0, 100), name: String(speaker.name || `Nhân vật ${index + 1}`).slice(0, 120), voiceId: String(speaker.voiceId || "browser").slice(0, 160) })),
      ttsVoices: (Array.isArray(source.ttsVoices) ? source.ttsVoices : []).slice(0, 100).map((voice) => ({ id: String(voice.id || "").slice(0, 160), name: String(voice.name || "Voice").slice(0, 120), category: String(voice.category || "").slice(0, 80) })).filter((voice) => voice.id),
      musicAssetId: String(source.musicAssetId || "").slice(0, 120), musicVolume: clamp(source.musicVolume ?? 0.16, 0, 1), ducking: clamp(source.ducking ?? 0.45, 0, 1),
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
    const db = await openDb();
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
  async function storeBlob(blob, name, kind = "image") {
    const id = uid("cms-asset");
    await dbPut({ id, ownerId: ownerId(), projectId: state.projectId, name: String(name || id).slice(0, 240), type: blob.type || "application/octet-stream", size: blob.size, kind, createdAt: new Date().toISOString(), blob });
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
    if (type === "error" && window.Notification?.permission === "granted") {
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
        <section class="cms-series-preview" data-cms-series-preview hidden><header><strong>Danh sách chương</strong><span data-cms-series-count>Chưa kiểm tra</span></header><div class="cms-series-list" data-cms-series-list></div></section>
        <section class="cms-source-progress" data-cms-source-progress ${sourceProgress?.visible ? "" : "hidden"}><div class="cms-progress-head"><strong>Tiến trình tải</strong><span data-cms-progress-label>0%</span></div><progress data-cms-progress-bar value="0" max="100"></progress><strong data-cms-progress-chapter>Đang chuẩn bị…</strong><small data-cms-progress-counters>Hoàn tất 0 · Lỗi 0 · Còn lại 0</small><img data-cms-progress-preview alt="Ảnh đang tải" hidden><div class="cms-inline-actions"><button type="button" data-cms-source-pause>Tạm dừng</button><button type="button" data-cms-source-cancel>Hủy tải</button><button type="button" data-cms-source-retry hidden>Thử lại lỗi</button></div></section>
        <footer><button type="button" data-cms-close-source>Hủy</button><button class="cms-primary" type="submit" value="default">Kiểm tra và tải</button></footer>
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
    root.innerHTML = `<section class="cms-app" data-cms-focus="${esc(focusedSection)}">
      <header class="cms-topbar"><div><small>COMIC MOTION STUDIO</small><input value="${esc(state.name)}" maxlength="180" data-cms-project="name" aria-label="Tên dự án"><span data-cms-save-status>Đã tự lưu</span></div><nav class="cms-section-nav" aria-label="Khu vực làm việc"><button type="button" data-cms-section="source" class="${focusedSection === "source" ? "is-active" : ""}">Nguồn</button><button type="button" data-cms-section="preview" class="${focusedSection === "preview" ? "is-active" : ""}">Preview</button><button type="button" data-cms-section="voice" class="${focusedSection === "voice" ? "is-active" : ""}">Voice</button><button type="button" data-cms-section="timeline" class="${focusedSection === "timeline" ? "is-active" : ""}">Timeline</button></nav><div class="cms-top-actions"><label>Khung hình<select data-cms-project="format">${Object.entries(FORMATS).map(([id, value]) => `<option value="${id}" ${state.format.id === id ? "selected" : ""}>${value.label}</option>`).join("")}</select></label><button type="button" data-cms-action="preview-10">Xem thử 10 giây</button><button type="button" data-cms-action="export-project">Lưu .hhcomic</button><button class="cms-primary" type="button" data-cms-action="render">Xuất ${caps.mp4Mime ? "MP4" : "WebM"}</button></div></header>
      <div class="cms-workspace">
        <aside class="cms-source"><header><div><small>SOURCE PAGES</small><h3>Ảnh & trang</h3></div><span>${state.scenes.length}/${MAX_SCENES}</span></header>
          <div class="cms-source-actions"><label>+ Ảnh<input type="file" accept="image/png,image/jpeg,image/webp" multiple data-cms-images></label><label>+ Folder<input type="file" accept="image/*" multiple webkitdirectory data-cms-folder></label><label>Gói/PDF<input type="file" accept=".zip,.cbz,.pdf,.hhcomic,application/pdf,application/zip" data-cms-package></label><button type="button" data-cms-action="open-source" aria-label="Tải ảnh từ website" title="Dán URL chương truyện để tải ảnh">Tải website</button></div>
          <div class="cms-scenes">${state.scenes.map(sceneCard).join("") || `<div class="cms-empty"><strong>Thả ảnh vào đây</strong><p>PNG, JPG, WebP, folder, ZIP, CBZ hoặc PDF.</p></div>`}</div>
          <div class="cms-rights"><strong>Nguồn nội dung</strong><span>${state.sourceManifest.rightsAttested ? `Đã xác nhận quyền sử dụng · ${esc(state.sourceManifest.title || state.sourceManifest.domain || "website")}` : "Nguồn cục bộ · bạn chịu trách nhiệm về quyền sử dụng"}</span></div>
        </aside>
        <main class="cms-preview"><div class="cms-stage"><canvas width="${state.format.width}" height="${state.format.height}" data-cms-canvas></canvas><div class="cms-safe-zone" aria-hidden="true"></div><div class="cms-stage-empty" ${scene ? "hidden" : ""}><strong>Preview video</strong><p>Thêm trang truyện để xem chuyển động camera.</p></div></div>
          <div class="cms-transport"><button type="button" data-cms-action="play">${previewPlaying ? "❚❚" : "▶"}</button><input type="range" min="0" max="${Math.max(0.1, totalDuration())}" step="0.01" value="${previewOffset}" data-cms-scrubber><span data-cms-time>${formatTime(previewOffset)} / ${formatTime(totalDuration())}</span><button type="button" data-cms-action="thumbnail">Lấy thumbnail</button></div>
          <div class="cms-render-info"><span>${state.format.width}×${state.format.height} · ${state.format.fps} FPS</span><span>${caps.mp4Mime ? "MP4 khả dụng" : caps.webmMime ? "Trình duyệt chỉ hỗ trợ WebM thật" : "Trình duyệt không hỗ trợ render"}</span></div>
        </main>
        <aside class="cms-inspector">${inspectorMarkup(scene)}</aside>
      </div>
      <footer class="cms-timeline">${timelineMarkup()}</footer>
      <div class="cms-status" data-cms-status data-type="info">Sẵn sàng. Dự án được lưu riêng theo tài khoản.</div><div class="cms-toast" data-cms-toast data-type="info" hidden role="status" aria-live="polite"></div>
      ${sourceDialogMarkup()}
    </section>`;
    drawCurrent();
    if (sourceProgress) updateSourceProgress(sourceProgress);
  }

  async function drawScene(context, scene, localTime = 0, canvas = context.canvas) {
    context.save();
    context.fillStyle = "#08090d"; context.fillRect(0, 0, canvas.width, canvas.height);
    const image = await imageFor(scene?.assetId).catch(() => null);
    if (image) {
      const progress = clamp(localTime / Math.max(scene.duration, 0.01), 0, 1);
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
    const images = Array.isArray(result?.images) ? result.images : [];
    const downloaded = new Array(images.length);
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
        let lastError = null;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            const assetResponse = await api({ action: "fetch-image", token: image.token }, signal);
            const blob = await assetResponse.blob();
            const extension = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
            downloaded[position] = { name: `page-${String(position + 1).padStart(4, "0")}.${extension}`, blob, alt: image.alt || "" };
            completed += 1;
            if (sourceProgress) {
              const previewUrl = URL.createObjectURL(blob);
              if (sourcePreviewUrl) URL.revokeObjectURL(sourcePreviewUrl);
              sourcePreviewUrl = previewUrl;
              updateSourceProgress({ completed: (Number(sourceProgress.completed) || 0) + 1, previewUrl, chapter: chapterLabel });
            }
            status(`Đang tải ${chapterLabel} · ảnh ${completed}/${images.length}…`);
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
    await Promise.all(Array.from({ length: Math.min(3, images.length) }, worker));
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

  async function writeChapterDirectory(directory, chapter, entries, source) {
    if (!directory?.getDirectoryHandle) return false;
    const folder = await directory.getDirectoryHandle(`Chap-${String(chapter.number).padStart(3, "0")}`, { create: true });
    for (const entry of entries) {
      const file = await folder.getFileHandle(entry.name, { create: true });
      const writable = await file.createWritable();
      await writable.write(entry.blob);
      await writable.close();
    }
    const manifest = { schemaVersion: 1, downloadedAt: new Date().toISOString(), source, chapter: { number: chapter.number, title: chapter.title, url: chapter.url }, images: entries.map((entry, index) => ({ index: index + 1, file: entry.name, mimeType: entry.blob.type, bytes: entry.blob.size, alt: entry.alt })) };
    const manifestFile = await folder.getFileHandle("chapter-manifest.json", { create: true });
    const manifestWriter = await manifestFile.createWritable();
    await manifestWriter.write(JSON.stringify(manifest, null, 2));
    await manifestWriter.close();
    return true;
  }

  function renderSeriesPreview(chapters) {
    const section = root?.querySelector("[data-cms-series-preview]");
    const list = section?.querySelector("[data-cms-series-list]");
    const count = section?.querySelector("[data-cms-series-count]");
    if (!section || !list) return;
    section.hidden = false;
    if (count) count.textContent = `${chapters.length} chương · sẽ tải theo thứ tự mới nhất`;
    list.innerHTML = chapters.map((chapter) => `<label class="cms-series-row"><input type="checkbox" checked data-cms-series-chapter="${esc(chapter.url)}"><span>${esc(chapter.title || `Chương ${chapter.number}`)}</span></label>`).join("");
  }

  async function chooseSeriesDirectory() {
    if (!window.showDirectoryPicker) return null;
    try { return await window.showDirectoryPicker({ mode: "readwrite", id: "comic-motion-download" }); }
    catch (error) { if (error?.name === "AbortError") throw error; return null; }
  }

  async function importSeries(form, signal, data) {
    const seriesUrl = String(data.get("url") || "");
    const sourceMode = String(data.get("sourceMode") || "download");
    let directory = null;
    if (["download", "both"].includes(sourceMode)) directory = await chooseSeriesDirectory();
    updateSourceProgress({ visible: true, total: 0, completed: 0, failed: 0, chapter: "Đang đọc danh sách chương…" });
    const response = await api({ action: "inspect-series", url: seriesUrl, rightsAttested: true }, signal);
    const result = await response.json();
    const selectedUrls = new Set([...root.querySelectorAll("[data-cms-series-chapter]:checked")].map((input) => input.dataset.cmsSeriesChapter));
    const chapters = (result.chapters || []).filter((chapter) => !selectedUrls.size || selectedUrls.has(chapter.url));
    if (!chapters.length) throw new Error("Hãy chọn ít nhất một chương để tải.");
    renderSeriesPreview(chapters);
    const fallbackZip = directory || !["download", "both"].includes(sourceMode) ? null : (window.JSZip ? new window.JSZip() : null);
    if (!directory && ["download", "both"].includes(sourceMode) && !fallbackZip) throw new Error("Trình duyệt không hỗ trợ lưu thư mục hoặc ZIP.");
    const resume = loadSeriesResume(seriesUrl);
    const completedChapters = new Set(Array.isArray(resume.completedChapters) ? resume.completedChapters : []);
    const chapterManifests = [];
    let importedCount = 0;
    for (let index = 0; index < chapters.length; index += 1) {
      await waitForSourceResume(signal);
      const chapter = chapters[index];
      updateSourceProgress({ chapter: `Chương ${chapter.number} · ${index + 1}/${chapters.length}` });
      if (completedChapters.has(chapter.url)) { status(`Bỏ qua chương ${chapter.number}: đã tải ở lần trước.`); continue; }
      const chapterResult = await (await api({ action: "inspect-chapter", token: chapter.token }, signal)).json();
      const entries = await fetchAuthorizedImages(chapterResult, signal, { chapterLabel: `Chương ${chapter.number}` });
      chapterManifests.push({ number: chapter.number, title: chapter.title, url: chapter.url, images: entries.length });
      if (directory) await writeChapterDirectory(directory, chapter, entries, result.source);
      if (fallbackZip) {
        const folder = fallbackZip.folder(`Chap-${String(chapter.number).padStart(3, "0")}`);
        entries.forEach((entry) => folder.file(entry.name, entry.blob));
        fallbackZip.file(`Chap-${String(chapter.number).padStart(3, "0")}/chapter-manifest.json`, JSON.stringify({ chapter, images: entries.map((entry) => ({ file: entry.name, bytes: entry.blob.size, alt: entry.alt })) }, null, 2));
      }
      if (["import", "both"].includes(sourceMode) && importedCount < MAX_SCENES) importedCount += await importImageBlobs(entries, { ...result.source, sourceType: "authorized-series", sourceUrl: seriesUrl, rightsAttested: true, attestedAt: result.source.inspectedAt }, { deferRender: true });
      completedChapters.add(chapter.url);
      saveSeriesResume(seriesUrl, { completedChapters: [...completedChapters], updatedAt: new Date().toISOString() });
    }
    if (fallbackZip && ["download", "both"].includes(sourceMode)) {
      fallbackZip.file("series-manifest.json", JSON.stringify({ schemaVersion: 1, downloadedAt: new Date().toISOString(), source: result.source, chapters: chapterManifests }, null, 2));
      status("Đang đóng gói toàn bộ truyện thành ZIP…");
      const blob = await fallbackZip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 5 } }, (meta) => status(`Đang đóng gói ZIP · ${Math.round(meta.percent)}%…`));
      downloadBlob(blob, `${safeFilename(result.source?.title || "comic-series")}-series.zip`);
    } else if (directory) {
      const rootManifest = await directory.getFileHandle("series-manifest.json", { create: true });
      const writer = await rootManifest.createWritable(); await writer.write(JSON.stringify({ schemaVersion: 1, downloadedAt: new Date().toISOString(), source: result.source, chapters: chapterManifests }, null, 2)); await writer.close();
    }
    if (["import", "both"].includes(sourceMode)) { state.revision += 1; saveState(); await refreshAssets(); render(); }
    updateSourceProgress({ chapter: "Hoàn tất toàn bộ truyện", completed: sourceProgress?.completed || 0 });
    notify(`Đã hoàn tất ${completedChapters.size}/${chapters.length} chương${directory ? " vào thư mục đã chọn" : " và tạo ZIP"}.`, "success");
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

  async function recognizeText(scene) {
    if (!scene?.assetId || !assets.has(scene.assetId)) throw new Error("Cảnh chưa có ảnh để nhận diện chữ.");
    if (!window.Tesseract?.createWorker) throw new Error("Bộ OCR chưa tải xong. Hãy làm mới trang.");
    status("Đang khởi tạo OCR Việt + Anh trên thiết bị…");
    const worker = await window.Tesseract.createWorker("vie+eng", 1, {
      workerPath: "./vendor/tesseract-worker.min.js?v=6.0.1",
      corePath: "./vendor/tesseract-core-simd-lstm.wasm.js?v=6.0.0",
      langPath: "./vendor/tessdata",
      logger(message) {
        if (message?.progress != null) status(`OCR · ${String(message.status || "đang xử lý")} · ${Math.round(message.progress * 100)}%`);
      }
    });
    try {
      const result = await worker.recognize(assetUrl(scene.assetId));
      const text = String(result?.data?.text || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      if (!text) throw new Error("OCR chưa nhận diện được chữ rõ ràng trong cảnh này.");
      checkpoint(); const line = activeDialogue(scene); line.text = text.slice(0, 5000); line.audioAssetId = ""; line.alignment = null;
      scene.duration = clamp(Math.max(3, text.split(/\s+/).length / 2.6), 0.5, 180);
      saveState(); render(); status("Đã nhận diện chữ cục bộ. Hãy kiểm tra và sửa lại trước khi tạo voice.", "success");
    } finally { await worker.terminate(); }
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
  async function generateVoice() {
    const scene = activeScene(), line = activeDialogue(scene);
    if (!line?.text) throw new Error("Hãy nhập lời thoại trước.");
    if (!line.voiceId || line.voiceId === "browser") throw new Error("Hãy tải và chọn voice ElevenLabs. Giọng trình duyệt không thể thu vào video an toàn.");
    status("Đang tạo voice có timestamp…");
    const result = await (await api({ action: "tts", text: line.text, voiceId: line.voiceId, rate: line.rate, pitch: line.pitch })).json();
    const bytes = Uint8Array.from(atob(result.audioBase64), (char) => char.charCodeAt(0));
    const blob = new Blob([bytes], { type: result.mimeType || "audio/mpeg" });
    checkpoint();
    if (line.audioAssetId) await dbDelete(line.audioAssetId).catch(() => {});
    line.audioAssetId = await storeBlob(blob, `${scene.name}-voice.mp3`, "voice"); line.alignment = result.alignment || null;
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
    const context = new AudioCtx(); const destination = context.createMediaStreamDestination(); const sources = [];
    let cursor = 0;
    for (const scene of state.scenes) {
      for (const item of dialogueTimeline(scene)) {
        const line = item.line;
        if (!line.audioAssetId) continue;
        const buffer = await decodeAudio(context, line.audioAssetId).catch(() => null);
        if (buffer) { const source = context.createBufferSource(); const gain = context.createGain(); source.buffer = buffer; gain.gain.value = 1; source.connect(gain).connect(destination); sources.push({ source, when: cursor + item.start }); }
      }
      cursor += scene.duration;
      if (cursor >= duration) break;
    }
    if (state.musicAssetId) {
      const buffer = await decodeAudio(context, state.musicAssetId).catch(() => null);
      if (buffer) { const source = context.createBufferSource(); const gain = context.createGain(); source.buffer = buffer; source.loop = true; gain.gain.value = state.musicVolume * (state.scenes.some((scene) => scene.dialogues.some((line) => line.audioAssetId)) ? state.ducking : 1); source.connect(gain).connect(destination); sources.push({ source, when: 0, music: true }); }
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
    status(`Đã kết xuất ${extension.toUpperCase()} thật · ${(blob.size / 1024 / 1024).toFixed(1)} MB.`, "success");
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
  }
  function updateInput(target) {
    const scene = activeScene(), line = activeDialogue(scene);
    if (target.matches("[data-cms-project]")) {
      const key = target.dataset.cmsProject;
      if (key === "format") state.format = { ...FORMATS[target.value], id: target.value, fps: state.format.fps };
      else state[key] = ["musicVolume", "ducking"].includes(key) ? Number(target.value) : target.value;
      scheduleSave(); if (key === "format") render(); return;
    }
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
      notify("Đã gửi yêu cầu hủy tải nguồn ảnh.", "info");
      return;
    }
    if (event.target.closest("[data-cms-source-pause]")) {
      sourcePause = !sourcePause;
      updateSourceProgress();
      status(sourcePause ? "Đã tạm dừng tải. Bấm Tiếp tục để chạy tiếp." : "Đang tiếp tục tải nguồn ảnh…");
      return;
    }
    const sectionToggle = event.target.closest("[data-cms-section]");
    if (sectionToggle) {
      focusedSection = sectionToggle.dataset.cmsSection || "workspace";
      if (root) root.dataset.cmsFocus = focusedSection;
      root.querySelectorAll("[data-cms-section]").forEach((button) => button.classList.toggle("is-active", button === sectionToggle));
      return;
    }
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
    if (action === "open-source") { sourceProgress = { visible: false }; resetSourcePreview(); const dialog = root.querySelector("[data-cms-source-dialog]"); dialog?.showModal(); updateSourceProgress(sourceProgress); return; }
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
      await importWebsite(form, operationController.signal);
      form.closest("dialog")?.close();
    } catch (error) {
      if (error?.name === "AbortError") {
        notify("Đã hủy tác vụ nhập nguồn ảnh.", "info");
        return;
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
    root = host; apiBase = String(mountOptions.apiBase || window.HH_CONFIG?.API_BASE || "").replace(/\/$/, ""); state = loadState(); controller = new AbortController(); const listenerOptions = { signal: controller.signal };
    root.addEventListener("click", (event) => handleClick(event).catch((error) => status(error.message, "error")), listenerOptions);
    root.addEventListener("input", updateInput, listenerOptions);
    root.addEventListener("change", (event) => handleFiles(event.target).catch((error) => status(error.message, "error")), listenerOptions);
    root.addEventListener("submit", (event) => handleSubmit(event).catch((error) => status(error.message, "error")), listenerOptions);
    root.addEventListener("dragstart", handleDrag, listenerOptions); root.addEventListener("dragover", handleDrag, listenerOptions); root.addEventListener("drop", handleDrag, listenerOptions);
    root.addEventListener("input", (event) => {
      if (!event.target.matches("[data-cms-scrubber]")) return;
      previewOffset = Number(event.target.value); const position = sceneAtTime(previewOffset); if (position) { state.currentSceneId = position.scene.id; drawScene(root.querySelector("[data-cms-canvas]").getContext("2d"), position.scene, position.localTime); }
    }, listenerOptions);
    window.addEventListener("hh:auth-change", async () => { state = loadState(); if (await refreshAssets(epoch)) render(); }, listenerOptions);
    if (!await refreshAssets(epoch) || epoch !== mountEpoch || root !== host || controller?.signal.aborted) return false;
    render();
    return true;
  }
  function unmount() {
    mountEpoch += 1;
    sourceBusy = false;
    sourceController?.abort(); sourceController = null;
    previewPlaying = false; cancelAnimationFrame(previewFrame); clearTimeout(autosaveTimer); renderCancelled = true;
    if (recorder?.state === "recording") recorder.stop(); recorder = null; window.speechSynthesis?.cancel?.(); controller?.abort(); controller = null;
    for (const url of objectUrls.values()) URL.revokeObjectURL(url); objectUrls.clear(); imageCache.clear();
    resetSourcePreview();
    if (root) root.innerHTML = ""; root = null;
  }

  window.HHComicMotionStudio = Object.freeze({ mount, unmount, normalizeState, normalizeScene, capabilities, extractSubtitles: subtitleText, formats: FORMATS });
  window.dispatchEvent(new CustomEvent("hh:comic-motion-ready"));
})();
