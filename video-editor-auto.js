(() => {
  "use strict";

  const PROJECT_KEY = "hh.video-editor.project.v1";
  const BACKUP_KEY = "hh.video-editor.auto.backup.v1";
  const DRAFT_KEY = "hh.video-editor.auto.draft.v1";
  const DB_NAME = "hh-video-editor-media";
  const DB_STORE = "assets";
  const DEFAULT_SETTINGS = Object.freeze({
    preset: "source",
    targetDuration: 0,
    title: "",
    color: true,
    transitions: true,
    normalizeAudio: true,
    createMarkers: true
  });
  const PRESETS = Object.freeze({
    source: { label: "Giữ tỷ lệ nguồn", width: 1920, height: 1080 },
    landscape: { label: "YouTube · 16:9", width: 1920, height: 1080 },
    vertical: { label: "Reels/TikTok · 9:16", width: 1080, height: 1920 },
    square: { label: "Social · 1:1", width: 1080, height: 1080 }
  });

  let root = null;
  let controller = null;
  let assets = [];
  let analysis = [];
  let plan = null;
  let busy = false;

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const uid = (prefix) => `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  const formatBytes = (value) => {
    let size = Math.max(0, Number(value) || 0);
    for (const unit of ["B", "KB", "MB", "GB"]) {
      if (size < 1024 || unit === "GB") return `${size.toFixed(unit === "B" ? 0 : 1)} ${unit}`;
      size /= 1024;
    }
    return "0 B";
  };
  const formatTime = (value) => {
    const seconds = Math.max(0, Math.round(Number(value) || 0));
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  };
  const assetKind = (asset) => {
    const type = String(asset?.type || asset?.file?.type || "");
    if (type.startsWith("video")) return "video";
    if (type.startsWith("audio")) return "audio";
    if (type.startsWith("image")) return "image";
    return "unsupported";
  };
  const settings = () => {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}") };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  };
  const saveSettings = (next) => localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...settings(), ...next }));

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error("Trình duyệt không hỗ trợ IndexedDB."));
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(DB_STORE)) {
          request.result.createObjectStore(DB_STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Không thể mở Media Pool."));
    });
  }

  async function listAssets() {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const request = db.transaction(DB_STORE).objectStore(DB_STORE).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error || new Error("Không thể đọc Media Pool."));
      });
    } finally {
      db.close();
    }
  }

  function samplePixels(canvas) {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Thiết bị không cung cấp Canvas 2D.");
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let red = 0;
    let green = 0;
    let blue = 0;
    let luminance = 0;
    let saturation = 0;
    let count = 0;
    const lumas = [];
    for (let index = 0; index < pixels.length; index += 16) {
      const r = pixels[index] / 255;
      const g = pixels[index + 1] / 255;
      const b = pixels[index + 2] / 255;
      const luma = .2126 * r + .7152 * g + .0722 * b;
      red += r;
      green += g;
      blue += b;
      luminance += luma;
      saturation += Math.max(r, g, b) - Math.min(r, g, b);
      lumas.push(luma);
      count += 1;
    }
    const average = luminance / Math.max(1, count);
    const variance = lumas.reduce((sum, value) => sum + (value - average) ** 2, 0) / Math.max(1, count);
    return {
      red: red / Math.max(1, count),
      green: green / Math.max(1, count),
      blue: blue / Math.max(1, count),
      luminance: average,
      saturation: saturation / Math.max(1, count),
      contrast: Math.sqrt(variance)
    };
  }

  async function analyzeImage(file) {
    if (!(file instanceof Blob)) throw new Error("Asset không còn dữ liệu file.");
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (window.createImageBitmap) {
      const bitmap = await createImageBitmap(file);
      try {
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      } finally {
        bitmap.close?.();
      }
    } else {
      const url = URL.createObjectURL(file);
      try {
        const image = new Image();
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = () => reject(new Error("Không giải mã được ảnh."));
          image.src = url;
        });
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    return samplePixels(canvas);
  }

  async function analyzeVideo(file, duration) {
    if (!(file instanceof Blob)) throw new Error("Asset không còn dữ liệu file.");
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Hết thời gian đọc metadata video.")), 12000);
        video.onloadedmetadata = () => {
          clearTimeout(timer);
          resolve();
        };
        video.onerror = () => {
          clearTimeout(timer);
          reject(new Error("Codec video không được trình duyệt hỗ trợ."));
        };
        video.src = url;
      });
      const actualDuration = Number.isFinite(video.duration) ? video.duration : Number(duration) || 0;
      const seekTime = Math.max(0, Math.min(actualDuration * .35, Math.max(0, actualDuration - .05)));
      if (seekTime > 0) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("Không đọc được khung hình mẫu.")), 12000);
          video.onseeked = () => {
            clearTimeout(timer);
            resolve();
          };
          video.onerror = () => {
            clearTimeout(timer);
            reject(new Error("Không giải mã được khung hình video."));
          };
          video.currentTime = seekTime;
        });
      }
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 90;
      canvas.getContext("2d", { willReadFrequently: true }).drawImage(video, 0, 0, canvas.width, canvas.height);
      return {
        ...samplePixels(canvas),
        duration: actualDuration,
        width: video.videoWidth,
        height: video.videoHeight
      };
    } finally {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    }
  }

  function analyzeWaveform(asset) {
    const peaks = Array.isArray(asset?.waveform) ? asset.waveform.map((value) => Math.abs(Number(value) || 0)) : [];
    if (!peaks.length) return { waveformAvailable: false, peak: null, average: null };
    return {
      waveformAvailable: true,
      peak: Math.max(...peaks),
      average: peaks.reduce((sum, value) => sum + value, 0) / peaks.length
    };
  }

  async function analyzeAsset(asset) {
    const kind = assetKind(asset);
    const base = {
      id: asset.id,
      name: asset.name || "Asset",
      kind,
      size: Number(asset.size) || asset.file?.size || 0,
      duration: Number(asset.duration) || 0,
      status: "ready",
      measuredAt: new Date().toISOString()
    };
    if (kind === "unsupported") return { ...base, status: "unsupported", message: "Định dạng chưa được hỗ trợ." };
    try {
      if (kind === "image") return { ...base, ...(await analyzeImage(asset.file)) };
      if (kind === "video") {
        const visual = await analyzeVideo(asset.file, asset.duration);
        return { ...base, ...visual, ...analyzeWaveform(asset), duration: visual.duration || base.duration };
      }
      return { ...base, ...analyzeWaveform(asset) };
    } catch (error) {
      return { ...base, status: "failed", message: error?.message || String(error) };
    }
  }

  function chooseEffect(metric) {
    if (!metric || metric.status !== "ready" || metric.kind === "audio") return "none";
    if (metric.luminance < .28 || metric.contrast < .12) return "cinema";
    if (metric.saturation < .16) return "vivid";
    if (metric.blue > metric.red * 1.16) return "cool";
    if (metric.red > metric.blue * 1.16) return "warm";
    return "none";
  }

  function normalizedVolume(metric) {
    if (!metric || metric.status !== "ready" || !Number.isFinite(metric.peak) || metric.peak <= 0) return 1;
    return clamp(.92 / metric.peak, .45, 1.5);
  }

  function sourceResolution(visuals) {
    const firstVideo = visuals.find((entry) => Number(entry.metric?.width) && Number(entry.metric?.height));
    if (!firstVideo) return PRESETS.landscape;
    const width = Number(firstVideo.metric.width);
    const height = Number(firstVideo.metric.height);
    if (height > width * 1.12) return PRESETS.vertical;
    if (Math.abs(width - height) < Math.max(width, height) * .14) return PRESETS.square;
    return PRESETS.landscape;
  }

  function buildPlan(assetRows, metrics, options = {}) {
    const config = { ...DEFAULT_SETTINGS, ...options };
    const metricMap = new Map(metrics.map((item) => [item.id, item]));
    const supported = assetRows
      .map((asset) => ({ asset, kind: assetKind(asset), metric: metricMap.get(asset.id) }))
      .filter((entry) => entry.kind !== "unsupported" && entry.metric?.status === "ready");
    const visuals = supported.filter((entry) => entry.kind === "video" || entry.kind === "image");
    const audio = supported.filter((entry) => entry.kind === "audio");
    if (!visuals.length) throw new Error("Media Pool chưa có video hoặc ảnh có thể giải mã.");

    const requested = Math.max(0, Number(config.targetDuration) || 0);
    const natural = visuals.reduce((sum, entry) => sum + (entry.kind === "image" ? 4 : Math.max(.2, Number(entry.metric.duration || entry.asset.duration) || 4)), 0);
    const target = requested || natural;
    const scale = requested && natural > requested ? requested / natural : 1;
    const dimensions = config.preset === "source" ? sourceResolution(visuals) : (PRESETS[config.preset] || PRESETS.landscape);
    const clips = [];
    const markers = [];
    let cursor = 0;

    for (const [index, entry] of visuals.entries()) {
      const sourceDuration = entry.kind === "image" ? 4 : Math.max(.2, Number(entry.metric.duration || entry.asset.duration) || 4);
      let duration = sourceDuration * scale;
      if (requested) duration = Math.min(duration, Math.max(.2, target - cursor));
      if (duration <= .19 || cursor >= target) break;
      const fade = config.transitions && index > 0 ? Math.min(.35, duration / 4) : 0;
      const volume = config.normalizeAudio ? normalizedVolume(entry.metric) : 1;
      const clip = {
        id: uid("clip"),
        assetId: entry.asset.id,
        name: entry.asset.name || `Clip ${index + 1}`,
        start: cursor,
        in: 0,
        out: duration,
        speed: 1,
        volume,
        muted: false,
        fadeIn: fade,
        fadeOut: config.transitions ? Math.min(.35, duration / 4) : 0,
        opacity: 1,
        scale: 100,
        x: 0,
        y: 0,
        rotation: 0,
        cropTop: 0,
        cropRight: 0,
        cropBottom: 0,
        cropLeft: 0,
        blend: "Normal",
        effect: config.color ? chooseEffect(entry.metric) : "none",
        track: "V1",
        color: entry.kind === "image" ? "#d36bd5" : ["#4b9fe9", "#8f74ed", "#e263ad", "#e39a52"][index % 4],
        keyframes: entry.kind === "image" ? [
          { time: 0, x: 0, y: 0, scale: 100, rotation: 0, opacity: 1, volume: 1 },
          { time: duration, x: 0, y: 0, scale: 106, rotation: 0, opacity: 1, volume: 1 }
        ] : []
      };
      clips.push(clip);
      if (config.createMarkers) markers.push({ id: uid("marker"), time: cursor, name: `Cảnh ${index + 1}`, color: "#62ecf2" });
      cursor += duration;
    }

    if (audio.length) {
      const entry = audio[0];
      const sourceDuration = Math.max(.2, Number(entry.metric.duration || entry.asset.duration) || cursor);
      clips.push({
        id: uid("clip"),
        assetId: entry.asset.id,
        name: entry.asset.name || "Nhạc nền",
        start: 0,
        in: 0,
        out: Math.min(sourceDuration, cursor),
        speed: 1,
        volume: config.normalizeAudio ? normalizedVolume(entry.metric) : 1,
        muted: false,
        fadeIn: config.transitions ? .6 : 0,
        fadeOut: config.transitions ? Math.min(1, cursor / 5) : 0,
        opacity: 1,
        scale: 100,
        x: 0,
        y: 0,
        rotation: 0,
        cropTop: 0,
        cropRight: 0,
        cropBottom: 0,
        cropLeft: 0,
        blend: "Normal",
        effect: "none",
        track: "A1",
        color: "#48c99c",
        keyframes: []
      });
    }

    const titles = config.title.trim() ? [{
      id: uid("title"),
      name: "Auto Title",
      kind: "title",
      text: config.title.trim(),
      start: 0,
      duration: Math.min(4.5, Math.max(2, cursor)),
      size: dimensions.height > dimensions.width ? 54 : 68,
      color: "#ffffff",
      background: "#0a1026",
      position: "center"
    }] : [];
    const previous = readProject();
    const project = {
      schemaVersion: 2,
      name: config.title.trim() || previous?.name || `Auto Sequence ${new Date().toLocaleDateString("vi-VN")}`,
      width: dimensions.width,
      height: dimensions.height,
      fps: Number(previous?.fps) || 30,
      zoom: clamp(900 / Math.max(1, cursor), 6, 40),
      playhead: 0,
      tool: "select",
      snap: true,
      clips,
      titles,
      markers,
      selected: clips[0]?.id || "",
      disabledTracks: [],
      lockedTracks: [],
      monitorMode: "program",
      history: [],
      historyIndex: -1,
      savedAt: new Date().toISOString(),
      autoDirector: {
        version: 1,
        createdAt: new Date().toISOString(),
        sourceAssets: supported.map((entry) => entry.asset.id),
        preset: config.preset,
        requestedDuration: requested || null,
        actualDuration: cursor,
        measuredAssets: metrics.filter((item) => item.status === "ready").length
      }
    };
    return {
      project,
      summary: {
        visuals: clips.filter((clip) => clip.track === "V1").length,
        audio: clips.filter((clip) => clip.track === "A1").length,
        titles: titles.length,
        duration: cursor,
        resolution: `${dimensions.width}×${dimensions.height}`,
        effects: clips.filter((clip) => clip.effect !== "none").length
      }
    };
  }

  function readProject() {
    try {
      const project = JSON.parse(localStorage.getItem(PROJECT_KEY) || "null");
      return project && typeof project === "object" ? project : null;
    } catch {
      return null;
    }
  }

  function applyPlan(nextPlan) {
    if (!nextPlan?.project?.clips?.length) throw new Error("Kế hoạch chưa có clip để áp dụng.");
    const previous = localStorage.getItem(PROJECT_KEY);
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: new Date().toISOString(), project: previous }));
    localStorage.setItem(PROJECT_KEY, JSON.stringify(nextPlan.project));
    window.dispatchEvent(new CustomEvent("hh:video-project-change", { detail: { project: nextPlan.project, auto: true } }));
    window.dispatchEvent(new CustomEvent("hh:video-auto-applied", { detail: { project: nextPlan.project } }));
    return nextPlan.project;
  }

  function restoreBackup() {
    const backup = JSON.parse(localStorage.getItem(BACKUP_KEY) || "null");
    if (!backup || !Object.hasOwn(backup, "project")) throw new Error("Chưa có timeline cũ để khôi phục.");
    if (backup.project) localStorage.setItem(PROJECT_KEY, backup.project);
    else localStorage.removeItem(PROJECT_KEY);
    window.dispatchEvent(new CustomEvent("hh:video-project-change", { detail: { project: readProject(), restored: true } }));
    window.dispatchEvent(new CustomEvent("hh:video-auto-applied", { detail: { project: readProject(), restored: true } }));
  }

  function status(message, kind = "info") {
    const node = root?.querySelector("[data-va-status]");
    if (!node) return;
    node.textContent = message;
    node.dataset.state = kind;
  }

  function setBusy(value) {
    busy = value;
    root?.toggleAttribute("data-busy", value);
    root?.querySelectorAll("[data-va-action]").forEach((button) => {
      if (button.dataset.vaAction !== "cancel") button.disabled = value;
    });
  }

  function renderAssets() {
    const target = root?.querySelector("[data-va-assets]");
    if (!target) return;
    if (!assets.length) {
      target.innerHTML = `<div class="va-empty"><strong>Media Pool đang trống</strong><span>Mở Media Pool để nhập video, ảnh hoặc âm thanh thật trước khi quét.</span><button type="button" data-va-action="media">Mở Media Pool</button></div>`;
      return;
    }
    const metricMap = new Map(analysis.map((item) => [item.id, item]));
    target.innerHTML = assets.map((asset) => {
      const metric = metricMap.get(asset.id);
      const kind = assetKind(asset);
      const state = metric?.status || "waiting";
      const visual = Number.isFinite(metric?.luminance)
        ? `Sáng ${Math.round(metric.luminance * 100)}% · Màu ${Math.round(metric.saturation * 100)}%`
        : metric?.waveformAvailable
          ? `Peak ${Math.round(metric.peak * 100)}% · TB ${Math.round(metric.average * 100)}%`
          : metric?.message || "Chờ phân tích";
      return `<article data-state="${escapeHtml(state)}">
        <span class="va-kind">${kind === "video" ? "VD" : kind === "image" ? "IM" : kind === "audio" ? "AU" : "?"}</span>
        <div><strong title="${escapeHtml(asset.name)}">${escapeHtml(asset.name)}</strong><small>${formatBytes(asset.size || asset.file?.size)} · ${formatTime(metric?.duration || asset.duration)}</small></div>
        <p>${escapeHtml(visual)}</p><b>${state === "ready" ? "Sẵn sàng" : state === "failed" ? "Lỗi" : state === "unsupported" ? "Không hỗ trợ" : "Chưa quét"}</b>
      </article>`;
    }).join("");
  }

  function renderPlan() {
    const target = root?.querySelector("[data-va-plan]");
    if (!target) return;
    if (!plan) {
      target.innerHTML = `<div class="va-empty"><strong>Chưa có kế hoạch dựng</strong><span>Quét media rồi bấm “Tạo timeline tự động”.</span></div>`;
      return;
    }
    const summary = plan.summary;
    const visualClips = plan.project.clips.filter((clip) => clip.track === "V1");
    target.innerHTML = `
      <div class="va-plan-summary">
        <span><b>${summary.visuals}</b> cảnh</span><span><b>${summary.audio}</b> audio</span>
        <span><b>${summary.effects}</b> chỉnh màu</span><span><b>${formatTime(summary.duration)}</b> thời lượng</span>
        <span><b>${summary.resolution}</b> đầu ra</span>
      </div>
      <div class="va-mini-timeline">
        ${visualClips.map((clip, index) => `<article style="--clip:${escapeHtml(clip.color)};--width:${Math.max(8, (clip.out - clip.in) / Math.max(.1, summary.duration) * 100)}%"><b>${index + 1}</b><span>${escapeHtml(clip.name)}</span><small>${formatTime(clip.out - clip.in)} · ${escapeHtml(clip.effect)}</small></article>`).join("")}
      </div>
      <div class="va-plan-actions">
        <button type="button" data-va-action="apply" class="is-primary">Áp dụng vào timeline</button>
        <button type="button" data-va-action="edit">Mở Edit sau khi áp dụng</button>
      </div>`;
  }

  function readForm() {
    const form = root?.querySelector("[data-va-form]");
    if (!form) return settings();
    return {
      preset: form.elements.preset.value,
      targetDuration: Math.max(0, Number(form.elements.targetDuration.value) || 0),
      title: form.elements.title.value,
      color: form.elements.color.checked,
      transitions: form.elements.transitions.checked,
      normalizeAudio: form.elements.normalizeAudio.checked,
      createMarkers: form.elements.createMarkers.checked
    };
  }

  async function refreshAssets() {
    try {
      assets = await listAssets();
      renderAssets();
      status(assets.length ? `Đã tìm thấy ${assets.length} asset thật trong Media Pool.` : "Media Pool chưa có dữ liệu.", assets.length ? "success" : "warning");
    } catch (error) {
      assets = [];
      renderAssets();
      status(error?.message || String(error), "error");
    }
  }

  async function scan() {
    if (busy) return;
    setBusy(true);
    analysis = [];
    plan = null;
    renderPlan();
    try {
      assets = await listAssets();
      if (!assets.length) throw new Error("Media Pool đang trống. Hãy nhập media trước.");
      for (let index = 0; index < assets.length; index += 1) {
        status(`Đang phân tích ${index + 1}/${assets.length}: ${assets[index].name}…`);
        analysis.push(await analyzeAsset(assets[index]));
        renderAssets();
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      const ready = analysis.filter((item) => item.status === "ready").length;
      const failed = analysis.length - ready;
      status(`Đã đo xong ${ready}/${analysis.length} asset${failed ? ` · ${failed} asset lỗi/không hỗ trợ` : ""}.`, failed ? "warning" : "success");
    } catch (error) {
      status(error?.message || String(error), "error");
    } finally {
      setBusy(false);
      renderAssets();
    }
  }

  function makePlan() {
    if (busy) return;
    try {
      if (!analysis.length) throw new Error("Hãy quét media trước khi tạo timeline.");
      const form = readForm();
      saveSettings(form);
      plan = buildPlan(assets, analysis, form);
      renderPlan();
      status(`Đã tạo kế hoạch ${plan.summary.visuals} cảnh từ dữ liệu thật. Hãy xem trước rồi áp dụng.`, "success");
    } catch (error) {
      plan = null;
      renderPlan();
      status(error?.message || String(error), "error");
    }
  }

  function markup() {
    const draft = settings();
    return `<section class="va-tool">
      <header class="va-hero">
        <div class="va-orb" aria-hidden="true"><b>H</b><i></i></div>
        <div><small>TOOL · LOCAL-FIRST AUTOMATION</small><h2>Auto Video Director</h2>
          <p>Tự động quét media thật, đo sáng–màu–waveform, tạo timeline, cân âm lượng, thêm chuyển cảnh và chuẩn bị project để xuất.</p>
        </div>
        <ol><li><b>1</b> Quét</li><li><b>2</b> Lập kế hoạch</li><li><b>3</b> Xem trước</li><li><b>4</b> Áp dụng</li></ol>
      </header>
      <div class="va-layout">
        <aside class="va-control">
          <header><span>AUTO PIPELINE</span><strong>Thiết lập đầu ra</strong></header>
          <form data-va-form>
            <label>Định dạng khung hình<select name="preset">
              ${Object.entries(PRESETS).map(([id, item]) => `<option value="${id}" ${draft.preset === id ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
            </select></label>
            <label>Thời lượng tối đa (giây)<input name="targetDuration" type="number" min="0" step="1" value="${Number(draft.targetDuration) || 0}"><small>Nhập 0 để giữ toàn bộ thời lượng nguồn.</small></label>
            <label>Tiêu đề mở đầu<input name="title" maxlength="120" value="${escapeHtml(draft.title)}" placeholder="Để trống nếu không cần"></label>
            <div class="va-switches">
              <label><input type="checkbox" name="color" ${draft.color ? "checked" : ""}><span></span><b>Tự cân phong cách màu</b></label>
              <label><input type="checkbox" name="transitions" ${draft.transitions ? "checked" : ""}><span></span><b>Fade giữa các cảnh</b></label>
              <label><input type="checkbox" name="normalizeAudio" ${draft.normalizeAudio ? "checked" : ""}><span></span><b>Chuẩn hóa âm lượng</b></label>
              <label><input type="checkbox" name="createMarkers" ${draft.createMarkers ? "checked" : ""}><span></span><b>Tạo marker từng cảnh</b></label>
            </div>
          </form>
          <div class="va-primary-actions">
            <button type="button" data-va-action="scan">1 · Quét media thật</button>
            <button type="button" data-va-action="plan" class="is-primary">2 · Tạo timeline tự động</button>
          </div>
          <button type="button" data-va-action="restore" class="va-restore">Khôi phục timeline trước Auto</button>
        </aside>
        <main class="va-work">
          <section class="va-panel"><header><div><span>MEDIA ANALYSIS</span><strong>Dữ liệu đo trực tiếp trên thiết bị</strong></div><button type="button" data-va-action="refresh">Làm mới danh sách</button></header><div class="va-assets" data-va-assets></div></section>
          <section class="va-panel"><header><div><span>AUTO EDIT PLAN</span><strong>Kế hoạch trước khi ghi vào project</strong></div><em>Không tự áp dụng khi chưa xác nhận</em></header><div class="va-plan" data-va-plan></div></section>
        </main>
      </div>
      <footer><span data-va-status role="status" aria-live="polite">Đang đọc Media Pool…</span><b>File media không rời khỏi thiết bị trong bước phân tích.</b></footer>
    </section>`;
  }

  function bind() {
    controller = new AbortController();
    root.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-va-action]");
      if (!button) return;
      const action = button.dataset.vaAction;
      if (action === "scan") return scan();
      if (action === "plan") return makePlan();
      if (action === "refresh") return refreshAssets();
      if (action === "media") {
        location.hash = "#/davinci-resolve/media";
        return;
      }
      if (action === "edit") {
        location.hash = "#/davinci-resolve/edit";
        return;
      }
      if (action === "apply") {
        try {
          applyPlan(plan);
          status(`Đã ghi ${plan.summary.visuals} cảnh vào project thật. Có thể mở Edit để kiểm tra và xuất.`, "success");
        } catch (error) {
          status(error?.message || String(error), "error");
        }
        return;
      }
      if (action === "restore") {
        try {
          restoreBackup();
          plan = null;
          renderPlan();
          status("Đã khôi phục timeline trước lần Auto gần nhất.", "success");
        } catch (error) {
          status(error?.message || String(error), "error");
        }
      }
    }, { signal: controller.signal });
    root.addEventListener("change", () => saveSettings(readForm()), { signal: controller.signal });
  }

  function mount(host) {
    unmount();
    if (!host) return;
    root = host;
    root.innerHTML = markup();
    bind();
    renderPlan();
    refreshAssets();
  }

  function unmount() {
    controller?.abort();
    controller = null;
    if (root) root.innerHTML = "";
    root = null;
    assets = [];
    analysis = [];
    plan = null;
    busy = false;
  }

  window.HHVideoAutoTool = {
    mount,
    unmount,
    listAssets,
    analyzeAsset,
    buildPlan,
    applyPlan,
    restoreBackup,
    chooseEffect,
    normalizedVolume
  };
})();
