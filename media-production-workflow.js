(function (globalScope, factory) {
  "use strict";
  const api = factory(globalScope || globalThis);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope) globalScope.HHMediaProductionWorkflow = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (globalScope) {
  "use strict";

  const SCHEMA = "hh.media-production.v1";
  const STATE_KEY = SCHEMA;
  const VERSION = 1;
  const TIMELINE_SCHEMA = "hh.media-timeline.v1";
  const LIMITS = Object.freeze({ tracks: 16, clips: 500, subtitles: 1000, comments: 500, jobs: 100, history: 100, versions: 50, text: 2000 });
  const activeInstances = new Set();
  const REMOTE_STATUSES = new Set(["queued", "running", "completed", "failed", "canceled"]);

  function now() { return new Date().toISOString(); }
  function uid(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`; }
  function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }
  function cleanText(value, max, fallback) {
    const text = String(value == null ? "" : value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max || LIMITS.text);
    return text || fallback || "";
  }
  function safeId(value, fallback) { return cleanText(value, 100, fallback).replace(/[^a-zA-Z0-9._:-]/g, "-"); }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }
  function clone(value) {
    if (value == null) return value;
    if (typeof structuredClone === "function") return structuredClone(value);
    if (Array.isArray(value)) return value.map(clone);
    if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
    return value;
  }

  function secondsToTimecode(seconds, fps) {
    const rate = Math.round(clamp(fps, 1, 120, 30));
    const frames = Math.max(0, Math.round(clamp(seconds, 0, 86400, 0) * rate));
    const hours = Math.floor(frames / (rate * 3600));
    const minutes = Math.floor(frames / (rate * 60)) % 60;
    const wholeSeconds = Math.floor(frames / rate) % 60;
    const remainder = frames % rate;
    return [hours, minutes, wholeSeconds, remainder].map((value) => String(value).padStart(2, "0")).join(":");
  }

  function timecodeToSeconds(value, fps) {
    if (typeof value === "number") return clamp(value, 0, 86400, 0);
    const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) throw new Error("Timecode phải có dạng HH:MM:SS:FF.");
    const rate = Math.round(clamp(fps, 1, 120, 30));
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    const frames = Number(match[4] || 0);
    if (minutes > 59 || seconds > 59 || frames >= rate) throw new Error("Timecode nằm ngoài giới hạn timeline.");
    return hours * 3600 + minutes * 60 + seconds + frames / rate;
  }

  function normalizeClip(input, index) {
    const source = input && typeof input === "object" ? input : {};
    const sourceIn = clamp(source.sourceIn, 0, 86400, 0);
    const sourceOut = Math.max(sourceIn + 0.04, clamp(source.sourceOut, sourceIn + 0.04, 86400, sourceIn + 5));
    return {
      id: safeId(source.id, `clip-${index + 1}`),
      assetId: safeId(source.assetId, "missing-asset"),
      trackId: safeId(source.trackId, "v1"),
      name: cleanText(source.name, 240, `Clip ${index + 1}`),
      start: clamp(source.start, 0, 86400, 0),
      sourceIn,
      sourceOut,
      playbackRate: clamp(source.playbackRate, 0.1, 16, 1),
      muted: Boolean(source.muted),
      effects: (Array.isArray(source.effects) ? source.effects : []).slice(0, 50).map((effect, effectIndex) => ({
        id: safeId(effect?.id, `effect-${effectIndex + 1}`),
        type: cleanText(effect?.type, 80, "adjustment"),
        enabled: effect?.enabled !== false,
        params: effect?.params && typeof effect.params === "object" ? clone(effect.params) : {}
      }))
    };
  }

  function normalizeSegments(segments, fps) {
    return (Array.isArray(segments) ? segments : []).slice(0, LIMITS.subtitles).map((segment, index) => {
      const start = clamp(segment?.start, 0, 86400, 0);
      const end = Math.max(start + 0.05, clamp(segment?.end, start + 0.05, 86400, start + 2));
      return {
        id: safeId(segment?.id, `subtitle-${index + 1}`),
        start,
        end,
        timecode: secondsToTimecode(start, fps),
        text: cleanText(segment?.text, 1000, "[Không có nội dung]"),
        confidence: clamp(segment?.confidence, 0, 1, null),
        speaker: cleanText(segment?.speaker, 80)
      };
    }).sort((a, b) => a.start - b.start);
  }

  function normalizeTimeline(input) {
    const source = input && typeof input === "object" ? input : {};
    const fps = Math.round(clamp(source.fps, 1, 120, 30));
    const tracks = (Array.isArray(source.tracks) ? source.tracks : [{ id: "v1", name: "Video 1", kind: "video" }, { id: "a1", name: "Audio 1", kind: "audio" }])
      .slice(0, LIMITS.tracks).map((track, index) => ({ id: safeId(track?.id, `track-${index + 1}`), name: cleanText(track?.name, 100, `Track ${index + 1}`), kind: ["video", "audio", "subtitle"].includes(track?.kind) ? track.kind : "video", locked: Boolean(track?.locked) }));
    return {
      schema: TIMELINE_SCHEMA,
      id: safeId(source.id, uid("timeline")),
      fps,
      revision: Math.max(1, Math.floor(Number(source.revision) || 1)),
      tracks,
      clips: (Array.isArray(source.clips) ? source.clips : []).slice(0, LIMITS.clips).map(normalizeClip),
      subtitles: normalizeSegments(source.subtitles, fps),
      history: (Array.isArray(source.history) ? source.history : []).slice(-LIMITS.history).map((item) => ({ id: safeId(item?.id, uid("edit")), type: cleanText(item?.type, 80, "edit"), at: item?.at || now(), detail: cleanText(item?.detail, 300) }))
    };
  }

  function applyTimelineEdit(timeline, operation) {
    const before = normalizeTimeline(timeline);
    const next = clone(before);
    const edit = operation && typeof operation === "object" ? operation : {};
    const type = cleanText(edit.type, 80);
    let detail = "";
    if (type === "add-clip") {
      if (next.clips.length >= LIMITS.clips) throw new Error("Timeline đã đạt giới hạn clip.");
      const clip = normalizeClip({ ...edit.clip, id: edit.clip?.id || uid("clip") }, next.clips.length);
      next.clips.push(clip);
      detail = `Thêm ${clip.name}`;
    } else if (["trim", "move", "effect", "remove"].includes(type)) {
      const index = next.clips.findIndex((clip) => clip.id === edit.clipId);
      if (index < 0) throw new Error("Không tìm thấy clip cần chỉnh.");
      const clip = next.clips[index];
      if (type === "trim") {
        const sourceIn = clamp(edit.sourceIn, 0, clip.sourceOut - 0.04, clip.sourceIn);
        const sourceOut = clamp(edit.sourceOut, sourceIn + 0.04, 86400, clip.sourceOut);
        next.clips[index] = normalizeClip({ ...clip, sourceIn, sourceOut }, index);
        detail = `Trim ${clip.name}; media nguồn không đổi`;
      } else if (type === "move") {
        next.clips[index] = normalizeClip({ ...clip, start: edit.start ?? clip.start, trackId: edit.trackId || clip.trackId }, index);
        detail = `Di chuyển ${clip.name}`;
      } else if (type === "effect") {
        next.clips[index] = normalizeClip({ ...clip, effects: [...clip.effects, { ...edit.effect, id: edit.effect?.id || uid("effect") }] }, index);
        detail = `Thêm hiệu ứng không phá hủy cho ${clip.name}`;
      } else {
        next.clips.splice(index, 1);
        detail = `Gỡ ${clip.name} khỏi timeline; media nguồn vẫn còn trong Media Bin`;
      }
    } else if (type === "split") {
      const index = next.clips.findIndex((clip) => clip.id === edit.clipId);
      if (index < 0) throw new Error("Không tìm thấy clip cần cắt.");
      const clip = next.clips[index];
      const at = clamp(edit.at, clip.start + 0.04, clip.start + (clip.sourceOut - clip.sourceIn) / clip.playbackRate - 0.04, null);
      if (at == null) throw new Error("Điểm cắt phải nằm bên trong clip.");
      const sourceCut = clip.sourceIn + (at - clip.start) * clip.playbackRate;
      const left = normalizeClip({ ...clip, sourceOut: sourceCut }, index);
      const right = normalizeClip({ ...clip, id: uid("clip"), start: at, sourceIn: sourceCut, name: `${clip.name} B` }, index + 1);
      next.clips.splice(index, 1, left, right);
      detail = `Tách ${clip.name} tại ${secondsToTimecode(at, next.fps)}`;
    } else throw new Error("Thao tác timeline không được hỗ trợ.");
    next.revision = before.revision + 1;
    next.history = [...before.history, { id: uid("edit"), type, at: now(), detail }].slice(-LIMITS.history);
    return normalizeTimeline(next);
  }

  function createReviewComment(input, fps) {
    const source = input && typeof input === "object" ? input : {};
    const seconds = timecodeToSeconds(source.seconds ?? source.timecode ?? "00:00:00:00", fps || 30);
    return {
      id: safeId(source.id, uid("review")),
      seconds,
      timecode: secondsToTimecode(seconds, fps || 30),
      author: cleanText(source.author, 100, "Người duyệt"),
      text: cleanText(source.text, 1000),
      status: source.status === "resolved" ? "resolved" : "open",
      createdAt: source.createdAt || now(),
      resolvedAt: source.status === "resolved" ? (source.resolvedAt || now()) : null
    };
  }

  function updateReviewComment(comments, id, patch, fps) {
    return (Array.isArray(comments) ? comments : []).map((comment) => {
      if (comment.id !== id) return createReviewComment(comment, fps);
      return createReviewComment({ ...comment, ...patch, resolvedAt: patch?.status === "resolved" ? now() : null }, fps);
    }).slice(0, LIMITS.comments);
  }

  function normalizeReviewComment(input, fps) {
    try { return createReviewComment(input, fps); }
    catch (_) { return createReviewComment({ ...input, seconds: 0 }, fps); }
  }

  function normalizeTimelineVersion(input, index) {
    const source = input && typeof input === "object" ? input : {};
    const timeline = normalizeTimeline(source.timeline);
    return {
      id: safeId(source.id, `version-${index + 1}`),
      label: cleanText(source.label, 120, `Phiên bản revision ${timeline.revision}`),
      note: cleanText(source.note, 500),
      createdAt: source.createdAt || now(),
      timeline,
      reviews: (Array.isArray(source.reviews) ? source.reviews : []).slice(0, LIMITS.comments).map((comment) => normalizeReviewComment(comment, timeline.fps))
    };
  }

  function createTimelineVersion(stateInput, input) {
    const state = normalizeState(stateInput);
    const options = input && typeof input === "object" ? input : {};
    const version = normalizeTimelineVersion({
      id: options.id || uid("version"),
      label: options.label || `Revision ${state.timeline.revision}`,
      note: options.note || `Snapshot trước khi chỉnh sửa revision ${state.timeline.revision}.`,
      createdAt: options.createdAt || now(),
      timeline: state.timeline,
      reviews: state.reviews
    }, state.versions.length);
    return normalizeState({ ...state, versions: [...state.versions, version].slice(-LIMITS.versions) });
  }

  function restoreTimelineVersion(stateInput, versionId) {
    const state = normalizeState(stateInput);
    const version = state.versions.find((item) => item.id === safeId(versionId));
    if (!version) throw new Error("Không tìm thấy phiên bản timeline cần khôi phục.");
    const restoreEntry = {
      id: uid("edit"),
      type: "restore-version",
      at: now(),
      detail: `Khôi phục ${version.label}; bản nguồn vẫn được giữ trong lịch sử phiên bản`
    };
    const timeline = normalizeTimeline({
      ...version.timeline,
      id: state.timeline.id,
      revision: state.timeline.revision + 1,
      history: [...state.timeline.history, restoreEntry].slice(-LIMITS.history)
    });
    return normalizeState({ ...state, timeline, reviews: version.reviews });
  }

  function safeOutputUrl(value, base) {
    if (!value) return "";
    try {
      const url = new URL(String(value), base || globalScope.location?.href || "http://localhost/");
      const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
      return url.protocol === "https:" || (url.protocol === "http:" && local) ? url.toString() : "";
    } catch (_) { return ""; }
  }

  function normalizeJob(input, kind) {
    const source = input && typeof input === "object" ? input : {};
    const allowed = new Set(["queued", "running", "completed", "failed", "canceled", "needs-adapter", "missing-source", "unsupported", "partial"]);
    return {
      id: safeId(source.id, uid(kind || "job")), kind: cleanText(source.kind, 40, kind || "job"),
      name: cleanText(source.name, 240, "Tác vụ media"), status: allowed.has(source.status) ? source.status : "queued",
      progress: clamp(source.progress, 0, 1, 0), message: cleanText(source.message, 500), createdAt: source.createdAt || now(), updatedAt: source.updatedAt || now(),
      remoteId: safeId(source.remoteId), outputUrl: safeOutputUrl(source.outputUrl), assetId: safeId(source.assetId),
      segments: normalizeSegments(source.segments, source.fps || 30), output: source.output instanceof Blob ? source.output : null
    };
  }

  function normalizeState(input) {
    const source = input && typeof input === "object" ? input : {};
    return {
      schema: SCHEMA, version: VERSION, projectId: safeId(source.projectId),
      activePanel: ["bin", "timeline", "transcription", "batch", "review", "render"].includes(source.activePanel) ? source.activePanel : "bin",
      timeline: normalizeTimeline(source.timeline),
      reviews: (Array.isArray(source.reviews) ? source.reviews : []).slice(0, LIMITS.comments).map((comment) => normalizeReviewComment(comment, source.timeline?.fps || 30)),
      proxyJobs: (Array.isArray(source.proxyJobs) ? source.proxyJobs : []).slice(-LIMITS.jobs).map((job) => normalizeJob(job, "proxy")),
      transcriptionJobs: (Array.isArray(source.transcriptionJobs) ? source.transcriptionJobs : []).slice(-LIMITS.jobs).map((job) => normalizeJob(job, "transcription")),
      batchJobs: (Array.isArray(source.batchJobs) ? source.batchJobs : []).slice(-LIMITS.jobs).map((job) => normalizeJob(job, "image")),
      renderQueue: (Array.isArray(source.renderQueue) ? source.renderQueue : []).slice(-LIMITS.jobs).map((job) => normalizeJob(job, "render")),
      versions: (Array.isArray(source.versions) ? source.versions : []).slice(-LIMITS.versions).map(normalizeTimelineVersion),
      updatedAt: now()
    };
  }

  function createStateStore(storage) {
    const target = storage || globalScope.localStorage;
    return Object.freeze({
      load() {
        if (!target?.getItem) return normalizeState({});
        try { return normalizeState(JSON.parse(target.getItem(STATE_KEY) || "{}")); } catch (_) { return normalizeState({}); }
      },
      save(value) {
        const normalized = normalizeState(value);
        if (target?.setItem) {
          const persistable = clone(normalized);
          [...persistable.proxyJobs, ...persistable.transcriptionJobs, ...persistable.batchJobs, ...persistable.renderQueue].forEach((job) => { job.output = null; });
          try { target.setItem(STATE_KEY, JSON.stringify(persistable)); } catch (_) { /* Storage may be blocked or full. */ }
        }
        return normalized;
      }
    });
  }

  function resolveAdapter(candidate, method) {
    return candidate && typeof candidate[method] === "function" ? candidate : null;
  }

  async function runProxyJob(asset, adapter, options) {
    const job = normalizeJob({ kind: "proxy", name: `Proxy · ${asset?.name || "video"}`, assetId: asset?.id, status: "queued" }, "proxy");
    if (!(asset?.blob instanceof Blob)) return normalizeJob({ ...job, status: "missing-source", message: "Không có binary nguồn trên thiết bị; hãy relink trước." }, "proxy");
    const engine = resolveAdapter(adapter, "proxyVideo");
    if (!engine) return normalizeJob({ ...job, status: "needs-adapter", message: "Cần adapter FFmpeg/WebCodecs để tạo proxy thật. Chưa có tệp proxy nào được tạo." }, "proxy");
    try {
      const result = await engine.proxyVideo(asset.blob, { asset: clone({ ...asset, blob: null }), scale: clamp(options?.scale, 0.1, 1, 0.5), codec: cleanText(options?.codec, 80, "video/webm") });
      const output = result instanceof Blob ? result : result?.blob;
      if (!(output instanceof Blob) || !output.size) throw new Error("Adapter không trả về tệp proxy hợp lệ.");
      return normalizeJob({ ...job, status: "completed", progress: 1, output, message: `Đã tạo proxy thật (${output.size} byte).` }, "proxy");
    } catch (error) { return normalizeJob({ ...job, status: "failed", message: error?.message || "Tạo proxy thất bại." }, "proxy"); }
  }

  function createLocalTranscriptionAdapter(scope) {
    const engine = scope?.HHLocalMediaTranscriber;
    if (!engine || typeof engine.transcribe !== "function") return null;
    return Object.freeze({ name: cleanText(engine.name, 100, "Local transcription adapter"), async transcribe(blob, options) { return engine.transcribe(blob, options); } });
  }

  async function runTranscriptionJob(asset, adapter, options) {
    const job = normalizeJob({ kind: "transcription", name: `Phụ đề · ${asset?.name || "media"}`, assetId: asset?.id, status: "queued", fps: options?.fps }, "transcription");
    if (!(asset?.blob instanceof Blob)) return normalizeJob({ ...job, status: "missing-source", message: "Không có binary audio/video để phiên âm." }, "transcription");
    const engine = resolveAdapter(adapter, "transcribe");
    if (!engine) return normalizeJob({ ...job, status: "needs-adapter", message: "Chưa cài local transcriber hoặc adapter phiên âm. Không tạo phụ đề giả." }, "transcription");
    try {
      const result = await engine.transcribe(asset.blob, { language: cleanText(options?.language, 12, "vi"), asset: clone({ ...asset, blob: null }) });
      const segments = normalizeSegments(Array.isArray(result) ? result : result?.segments, options?.fps || 30);
      if (!segments.length) throw new Error("Adapter hoàn tất nhưng không trả về đoạn thoại hợp lệ.");
      return normalizeJob({ ...job, status: "completed", progress: 1, segments, message: `Đã nhận ${segments.length} đoạn phụ đề từ adapter.` }, "transcription");
    } catch (error) { return normalizeJob({ ...job, status: "failed", message: error?.message || "Phiên âm thất bại." }, "transcription"); }
  }

  function toWebVtt(segments) {
    const stamp = (seconds) => {
      const milliseconds = Math.round(clamp(seconds, 0, 86400, 0) * 1000);
      const hours = Math.floor(milliseconds / 3600000);
      const minutes = Math.floor(milliseconds / 60000) % 60;
      const secs = Math.floor(milliseconds / 1000) % 60;
      const ms = milliseconds % 1000;
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
    };
    return `WEBVTT\n\n${normalizeSegments(segments, 30).map((segment, index) => `${index + 1}\n${stamp(segment.start)} --> ${stamp(segment.end)}\n${segment.text.replace(/\r?\n/g, " ")}\n`).join("\n")}`;
  }

  function parseHexColor(value) {
    const match = String(value || "").match(/^#([\da-f]{6})$/i);
    if (!match) return [255, 255, 255];
    return [0, 2, 4].map((offset) => parseInt(match[1].slice(offset, offset + 2), 16));
  }

  async function transformImageLocal(file, specification, env) {
    const scope = env || globalScope;
    if (!(file instanceof Blob)) throw new Error("Nguồn ảnh không hợp lệ.");
    if (typeof scope.createImageBitmap !== "function") throw new Error("Trình duyệt không hỗ trợ giải mã ảnh cục bộ.");
    const bitmap = await scope.createImageBitmap(file);
    const spec = specification || {};
    const maxWidth = Math.round(clamp(spec.width, 1, 16384, bitmap.width));
    const maxHeight = Math.round(clamp(spec.height, 1, 16384, bitmap.height));
    const ratio = spec.fit === "stretch" ? null : Math.min(maxWidth / bitmap.width, maxHeight / bitmap.height, spec.upscale ? Infinity : 1);
    const width = Math.max(1, Math.round(ratio == null ? maxWidth : bitmap.width * ratio));
    const height = Math.max(1, Math.round(ratio == null ? maxHeight : bitmap.height * ratio));
    const canvas = typeof scope.OffscreenCanvas === "function" ? new scope.OffscreenCanvas(width, height) : scope.document?.createElement?.("canvas");
    if (!canvas) { bitmap.close?.(); throw new Error("Canvas xử lý ảnh không khả dụng."); }
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: spec.operation === "remove-background" });
    if (!context) { bitmap.close?.(); throw new Error("Không mở được canvas 2D."); }
    context.drawImage(bitmap, 0, 0, width, height); bitmap.close?.();
    if (spec.operation === "remove-background") {
      const image = context.getImageData(0, 0, width, height);
      const target = parseHexColor(spec.background || "#ffffff");
      const threshold = clamp(spec.threshold, 0, 442, 48);
      for (let index = 0; index < image.data.length; index += 4) {
        const distance = Math.hypot(image.data[index] - target[0], image.data[index + 1] - target[1], image.data[index + 2] - target[2]);
        if (distance <= threshold) image.data[index + 3] = Math.round(255 * distance / Math.max(1, threshold));
      }
      context.putImageData(image, 0, 0);
    }
    const type = spec.operation === "remove-background" ? "image/png" : (["image/png", "image/jpeg", "image/webp"].includes(spec.type) ? spec.type : "image/webp");
    const quality = clamp(spec.quality, 0.1, 1, 0.9);
    if (typeof canvas.convertToBlob === "function") return canvas.convertToBlob({ type, quality });
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Không mã hóa được ảnh đầu ra.")), type, quality));
  }

  async function runImageBatch(files, specification, adapter, env) {
    const list = [...(files || [])].slice(0, 50);
    if (!list.length) return [];
    const engine = resolveAdapter(adapter, "transformImage");
    return Promise.all(list.map(async (file) => {
      const job = normalizeJob({ kind: "image", name: cleanText(file?.name, 240, "Ảnh"), status: "queued" }, "image");
      try {
        const result = engine ? await engine.transformImage(file, clone(specification || {})) : await transformImageLocal(file, specification, env);
        const output = result instanceof Blob ? result : result?.blob;
        if (!(output instanceof Blob) || !output.size) throw new Error("Không nhận được ảnh đầu ra hợp lệ.");
        return normalizeJob({ ...job, status: "completed", progress: 1, output, message: `Đã tạo output thật (${output.size} byte).` }, "image");
      } catch (error) {
        const unsupported = /không hỗ trợ|không khả dụng/i.test(error?.message || "");
        return normalizeJob({ ...job, status: unsupported ? "unsupported" : "failed", message: error?.message || "Xử lý ảnh thất bại." }, "image");
      }
    }));
  }

  function validateEndpoint(endpoint) {
    if (!endpoint) throw new Error("Chưa cấu hình endpoint render phía máy chủ.");
    let url;
    try { url = new URL(endpoint, globalScope.location?.href || "http://localhost/"); } catch (_) { throw new Error("Endpoint render không hợp lệ."); }
    if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "::1"].includes(url.hostname)) throw new Error("Endpoint render phải dùng HTTPS (trừ localhost).");
    return url.toString().replace(/\/$/, "");
  }

  function createServerRenderAdapter(options) {
    const endpoint = validateEndpoint(options?.endpoint);
    const fetchImpl = options?.fetchImpl || globalScope.fetch;
    if (typeof fetchImpl !== "function") throw new Error("Fetch API không khả dụng cho render server.");
    const request = async (path, init) => {
      const response = await fetchImpl(`${endpoint}${path}`, { credentials: "omit", cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(options?.headers || {}), ...(init?.headers || {}) } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(cleanText(body?.message, 500, `Render server trả HTTP ${response.status}.`));
      return body;
    };
    const normalizeRemote = (body, fallbackId) => {
      const status = REMOTE_STATUSES.has(body?.status) ? body.status : "queued";
      if (!body?.id && !fallbackId) throw new Error("Render server không trả job id.");
      const outputUrl = safeOutputUrl(body?.outputUrl, endpoint);
      if (status === "completed" && !outputUrl) throw new Error("Render server báo hoàn tất nhưng thiếu output URL HTTPS hợp lệ.");
      return { id: safeId(body?.id || fallbackId), status, progress: clamp(body?.progress, 0, 1, status === "completed" ? 1 : 0), outputUrl, message: cleanText(body?.message, 500) };
    };
    return Object.freeze({
      kind: "server", endpoint,
      async enqueue(payload) { return normalizeRemote(await request("/jobs", { method: "POST", body: JSON.stringify(payload) })); },
      async status(id) { return normalizeRemote(await request(`/jobs/${encodeURIComponent(safeId(id))}`, { method: "GET" }), id); },
      async cancel(id) { return normalizeRemote(await request(`/jobs/${encodeURIComponent(safeId(id))}`, { method: "DELETE" }), id); }
    });
  }

  async function enqueueRenderJob(adapter, payload) {
    const job = normalizeJob({ kind: "render", name: cleanText(payload?.name, 240, "Server render"), status: "queued" }, "render");
    if (!resolveAdapter(adapter, "enqueue")) return normalizeJob({ ...job, status: "needs-adapter", message: "Chưa cấu hình render server; chưa gửi tác vụ." }, "render");
    try {
      const remote = await adapter.enqueue({ schema: SCHEMA, version: VERSION, projectId: safeId(payload?.projectId), timeline: normalizeTimeline(payload?.timeline), preset: cleanText(payload?.preset, 80, "web-1080p"), name: cleanText(payload?.name, 240, "HH render") });
      return normalizeJob({ ...job, remoteId: remote.id, status: remote.status, progress: remote.progress, outputUrl: remote.outputUrl, message: remote.message || `Render server: ${remote.status}.` }, "render");
    } catch (error) { return normalizeJob({ ...job, status: "failed", message: error?.message || "Không gửi được render job." }, "render"); }
  }

  async function refreshRenderJob(adapter, job) {
    const current = normalizeJob(job, "render");
    if (!current.remoteId || !resolveAdapter(adapter, "status")) return normalizeJob({ ...current, status: current.remoteId ? "needs-adapter" : current.status, message: current.remoteId ? "Không có adapter để đọc trạng thái server." : current.message }, "render");
    try {
      const remote = await adapter.status(current.remoteId);
      return normalizeJob({ ...current, status: remote.status, progress: remote.progress, outputUrl: remote.outputUrl, message: remote.message || `Render server: ${remote.status}.`, updatedAt: now() }, "render");
    } catch (error) { return normalizeJob({ ...current, status: "failed", message: error?.message || "Không đọc được trạng thái render." }, "render"); }
  }

  async function cancelRenderJob(adapter, job) {
    const current = normalizeJob(job, "render");
    if (!current.remoteId || !resolveAdapter(adapter, "cancel")) return normalizeJob({ ...current, status: current.remoteId ? "needs-adapter" : current.status, message: current.remoteId ? "Không có adapter để hủy tác vụ trên server." : current.message }, "render");
    try {
      const remote = await adapter.cancel(current.remoteId);
      return normalizeJob({ ...current, status: remote.status, progress: remote.progress, outputUrl: remote.outputUrl, message: remote.message || `Render server: ${remote.status}.`, updatedAt: now() }, "render");
    } catch (error) { return normalizeJob({ ...current, status: "failed", message: error?.message || "Không hủy được render job." }, "render"); }
  }

  function statusLabel(status) {
    return ({ queued: "Đang chờ", running: "Đang chạy", completed: "Hoàn tất", failed: "Thất bại", canceled: "Đã hủy", "needs-adapter": "Cần adapter", "missing-source": "Thiếu nguồn", unsupported: "Không hỗ trợ", partial: "Một phần" })[status] || status;
  }

  async function mount(host, options) {
    if (!host || typeof host.querySelector !== "function") throw new TypeError("HHMediaProductionWorkflow.mount cần host DOM hợp lệ.");
    await unmount(host);
    const documentScope = host.ownerDocument;
    const controller = new AbortController();
    const stateStore = createStateStore(options?.storage);
    let state = stateStore.load();
    let assets = [];
    let project = null;
    let batchFiles = [];
    const outputs = new Map();
    const mediaApi = options?.mediaApi || globalScope.HHUniversalMediaProject;
    const mediaStore = options?.mediaStore || mediaApi?.createStore?.(options?.mediaStoreOptions);
    const ownedMediaStore = Boolean(mediaStore && !options?.mediaStore);
    const transcriptionAdapter = options?.transcriptionAdapter || globalScope.HHMediaAdapters?.transcription || createLocalTranscriptionAdapter(globalScope);
    const proxyAdapter = options?.proxyAdapter || globalScope.HHMediaAdapters?.proxy;
    const imageAdapter = options?.imageAdapter || globalScope.HHMediaAdapters?.image;
    let renderAdapter = options?.renderAdapter || globalScope.HHMediaAdapters?.render || null;
    if (!renderAdapter && options?.renderEndpoint) {
      try { renderAdapter = createServerRenderAdapter({ endpoint: options.renderEndpoint, fetchImpl: options.fetchImpl }); } catch (_) { renderAdapter = null; }
    }
    const instance = { host, controller, mediaStore, ownedMediaStore, outputs };
    activeInstances.add(instance);

    host.classList.add("hh-media-workflow");
    host.innerHTML = `<section class="hmpw-shell" aria-label="Media Production Workflow">
      <header class="hmpw-header"><div><small>HH MEDIA · PRODUCTION</small><h2>Workflow hậu kỳ trung thực</h2><p>Media Bin dùng chung, timeline không phá hủy và adapter có kiểm chứng.</p></div><span data-hmpw-storage>Đang kết nối Media Bin…</span></header>
      <nav class="hmpw-tabs" role="tablist" aria-label="Công cụ hậu kỳ">${[
        ["bin", "Media Bin"], ["timeline", "Timeline"], ["transcription", "Phụ đề"], ["batch", "Batch ảnh"], ["review", "Review"], ["render", "Render queue"]
      ].map(([id, label]) => `<button type="button" role="tab" data-hmpw-tab="${id}" aria-selected="${state.activePanel === id}">${label}</button>`).join("")}</nav>
      <div class="hmpw-status" role="status" aria-live="polite" data-hmpw-status>Sẵn sàng.</div>
      <main class="hmpw-content" data-hmpw-content></main>
    </section>`;
    const content = host.querySelector("[data-hmpw-content]");
    const signal = controller.signal;
    const listen = (target, type, handler) => target?.addEventListener(type, handler, { signal });
    const announce = (message, tone) => { const node = host.querySelector("[data-hmpw-status]"); if (node) { node.textContent = message; node.dataset.tone = tone || "info"; } };
    const persist = () => { state = stateStore.save(state); render(); };
    const assetOptions = (kinds) => assets.filter((asset) => !kinds || kinds.includes(asset.kind)).map((asset) => `<option value="${escapeHtml(asset.id)}">${escapeHtml(asset.name)}</option>`).join("");
    const jobCard = (job, actions) => `<article class="hmpw-job" data-status="${escapeHtml(job.status)}"><div><strong>${escapeHtml(job.name)}</strong><small>${escapeHtml(statusLabel(job.status))} · ${Math.round(job.progress * 100)}%</small></div><p>${escapeHtml(job.message || "Chưa có thông báo.")}</p>${actions || ""}</article>`;

    function binPanel() {
      return `<section class="hmpw-panel"><header><div><small>SHARED INDEXEDDB</small><h3>Media Bin dùng chung</h3></div><label class="hmpw-file">Thêm media<input type="file" multiple data-hmpw-import></label></header><div class="hmpw-assets">${assets.length ? assets.map((asset) => `<article><div><b>${escapeHtml(asset.kind?.toUpperCase?.() || "FILE")}</b><span><strong>${escapeHtml(asset.name)}</strong><small>${Math.round((asset.size || 0) / 1024)} KB · ${escapeHtml(asset.availability)}</small></span></div>${asset.kind === "video" ? `<button type="button" data-hmpw-proxy="${escapeHtml(asset.id)}">Tạo proxy</button>` : ""}</article>`).join("") : `<p class="hmpw-empty">Chưa có asset. Tệp nhập ở đây cũng xuất hiện trong Universal Media Project.</p>`}</div><div class="hmpw-jobs">${state.proxyJobs.slice().reverse().map((job) => jobCard(job, job.status === "completed" && outputs.has(job.id) ? `<button type="button" data-hmpw-download="${job.id}">Tải proxy</button>` : "")).join("")}</div></section>`;
    }
    function timelinePanel() {
      const versions = state.versions.slice().reverse();
      return `<section class="hmpw-panel"><header><div><small>${escapeHtml(state.timeline.schema)} · REV ${state.timeline.revision}</small><h3>Timeline không phá hủy</h3></div><div class="hmpw-inline"><select data-hmpw-timeline-asset aria-label="Asset thêm vào timeline">${assetOptions(["video", "audio", "image", "svg"])}</select><button type="button" data-hmpw-add-clip>Thêm clip</button><button type="button" data-hmpw-create-version>Lưu phiên bản</button></div></header><p class="hmpw-note">Trim, split, move và effect chỉ thay tham chiếu; binary trong Media Bin không bị sửa.</p><div class="hmpw-timeline">${state.timeline.clips.length ? state.timeline.clips.map((clip) => `<article><span>${escapeHtml(secondsToTimecode(clip.start, state.timeline.fps))}</span><div><strong>${escapeHtml(clip.name)}</strong><small>${escapeHtml(clip.trackId)} · nguồn ${clip.sourceIn.toFixed(2)}–${clip.sourceOut.toFixed(2)}s · ${clip.effects.length} effect</small></div><button type="button" data-hmpw-split="${clip.id}">Split giữa</button><button type="button" data-hmpw-remove-clip="${clip.id}">Gỡ</button></article>`).join("") : `<p class="hmpw-empty">Chưa có clip trên timeline.</p>`}</div><section class="hmpw-versions" aria-label="Lịch sử phiên bản timeline"><header><div><small>VERSION HISTORY</small><strong>${versions.length} phiên bản có thể khôi phục</strong></div><span>Khôi phục tạo revision mới, không ghi đè snapshot.</span></header><div>${versions.length ? versions.map((version) => `<article><div><strong>${escapeHtml(version.label)}</strong><small>${escapeHtml(version.note || "Snapshot timeline và review")} · ${escapeHtml(new Date(version.createdAt).toLocaleString("vi-VN"))}</small></div><b>REV ${version.timeline.revision}</b><button type="button" data-hmpw-restore-version="${escapeHtml(version.id)}">Khôi phục</button></article>`).join("") : `<p class="hmpw-empty">Lưu phiên bản trước một thay đổi lớn để có thể quay lại cả timeline và nhận xét review.</p>`}</div></section></section>`;
    }
    function transcriptionPanel() {
      return `<section class="hmpw-panel"><header><div><small>${transcriptionAdapter ? `ADAPTER · ${escapeHtml(transcriptionAdapter.name || "local/custom")}` : "ADAPTER · CHƯA CẤU HÌNH"}</small><h3>Transcription & subtitle</h3></div><div class="hmpw-inline"><select data-hmpw-transcript-asset aria-label="Audio hoặc video cần phiên âm">${assetOptions(["audio", "video"])}</select><select data-hmpw-language aria-label="Ngôn ngữ"><option value="vi">Tiếng Việt</option><option value="en">English</option></select><button type="button" data-hmpw-transcribe>Phiên âm</button></div></header><p class="hmpw-note">Chỉ báo hoàn tất khi local transcriber/adapter trả segment thật. Web Speech live không được giả làm phiên âm tệp.</p><div class="hmpw-jobs">${state.transcriptionJobs.slice().reverse().map((job) => jobCard(job, job.status === "completed" ? `<button type="button" data-hmpw-vtt="${job.id}">Tải WebVTT</button>` : "")).join("") || `<p class="hmpw-empty">Chưa có tác vụ phiên âm.</p>`}</div></section>`;
    }
    function batchPanel() {
      return `<section class="hmpw-panel"><header><div><small>LOCAL CANVAS / ADAPTER</small><h3>Batch resize, xóa nền & chuyển định dạng</h3></div><label class="hmpw-file">Chọn ảnh<input type="file" accept="image/*" multiple data-hmpw-batch-files></label></header><div class="hmpw-form"><label>Thao tác<select data-hmpw-batch-operation><option value="resize">Resize + convert</option><option value="remove-background">Xóa nền theo màu</option></select></label><label>Rộng tối đa<input type="number" min="1" max="16384" value="1920" data-hmpw-width></label><label>Cao tối đa<input type="number" min="1" max="16384" value="1080" data-hmpw-height></label><label>Định dạng<select data-hmpw-format><option value="image/webp">WebP</option><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option></select></label><label>Màu nền<input type="color" value="#ffffff" data-hmpw-background></label><label>Ngưỡng<input type="number" min="0" max="442" value="48" data-hmpw-threshold></label><button type="button" data-hmpw-run-batch>Chạy ${batchFiles.length ? `${batchFiles.length} ảnh` : "batch"}</button></div><div class="hmpw-jobs">${state.batchJobs.slice().reverse().map((job) => jobCard(job, job.status === "completed" && outputs.has(job.id) ? `<button type="button" data-hmpw-download="${job.id}">Tải ảnh</button>` : "")).join("") || `<p class="hmpw-empty">Chưa có batch job.</p>`}</div></section>`;
    }
    function reviewPanel() {
      return `<section class="hmpw-panel"><header><div><small>TIMECODE REVIEW</small><h3>Review theo khung hình</h3></div></header><form class="hmpw-review-form" data-hmpw-review-form><label>Timecode<input value="00:00:00:00" pattern="[0-9]{1,2}:[0-9]{2}:[0-9]{2}:[0-9]{2}" data-hmpw-timecode required></label><label>Tên<input maxlength="100" value="Người duyệt" data-hmpw-author required></label><label>Nhận xét<textarea maxlength="1000" data-hmpw-comment required></textarea></label><button type="submit">Gắn nhận xét</button></form><div class="hmpw-reviews">${state.reviews.slice().sort((a, b) => a.seconds - b.seconds).map((comment) => `<article data-status="${comment.status}"><time>${escapeHtml(comment.timecode)}</time><div><strong>${escapeHtml(comment.author)}</strong><p>${escapeHtml(comment.text)}</p></div><button type="button" data-hmpw-resolve="${comment.id}">${comment.status === "resolved" ? "Mở lại" : "Đã xử lý"}</button></article>`).join("") || `<p class="hmpw-empty">Chưa có nhận xét.</p>`}</div></section>`;
    }
    function renderPanel() {
      return `<section class="hmpw-panel"><header><div><small>${renderAdapter ? "SERVER ADAPTER · CONNECTED" : "SERVER ADAPTER · CHƯA CẤU HÌNH"}</small><h3>Render queue phía máy chủ</h3></div></header><div class="hmpw-form"><label>Tên output<input maxlength="240" value="HH media export" data-hmpw-render-name></label><label>Preset<select data-hmpw-render-preset><option value="web-1080p">Web 1080p</option><option value="vertical-1080x1920">Vertical 1080×1920</option><option value="archive-master">Archive master</option></select></label><button type="button" data-hmpw-enqueue-render>Gửi lên server</button></div><p class="hmpw-note">Queue chỉ phản ánh response thật từ server. “Completed” bắt buộc có output URL.</p><div class="hmpw-jobs">${state.renderQueue.slice().reverse().map((job) => jobCard(job, `<span class="hmpw-job-actions">${["queued", "running"].includes(job.status) ? `<button type="button" data-hmpw-poll="${job.id}">Cập nhật</button><button type="button" data-hmpw-cancel="${job.id}">Hủy trên server</button>` : ""}${job.status === "completed" && job.outputUrl ? `<a href="${escapeHtml(job.outputUrl)}" target="_blank" rel="noopener noreferrer">Mở output</a>` : ""}</span>`)).join("") || `<p class="hmpw-empty">Chưa có render job.</p>`}</div></section>`;
    }
    function render() {
      host.querySelectorAll("[data-hmpw-tab]").forEach((button) => { const active = button.dataset.hmpwTab === state.activePanel; button.setAttribute("aria-selected", String(active)); button.tabIndex = active ? 0 : -1; });
      const panels = { bin: binPanel, timeline: timelinePanel, transcription: transcriptionPanel, batch: batchPanel, review: reviewPanel, render: renderPanel };
      content.innerHTML = panels[state.activePanel]();
    }

    async function refreshAssets() {
      if (!mediaStore) { host.querySelector("[data-hmpw-storage]").textContent = "Universal Media store chưa được nạp"; render(); return; }
      const ready = await mediaStore.ready();
      project = state.projectId ? await mediaStore.getProject(state.projectId) : null;
      if (!project) project = (await mediaStore.listProjects())[0] || await mediaStore.saveProject({ name: "Universal Media Project" });
      state.projectId = project.id;
      assets = await mediaStore.listAssets(project.id);
      state = stateStore.save(state);
      host.querySelector("[data-hmpw-storage]").textContent = ready.backend === "indexeddb" ? `${assets.length} asset · IndexedDB dùng chung` : `${assets.length} asset · bộ nhớ phiên`;
      render();
    }

    listen(host, "click", async (event) => {
      const tab = event.target.closest("[data-hmpw-tab]");
      if (tab) { state.activePanel = tab.dataset.hmpwTab; persist(); return; }
      const proxy = event.target.closest("[data-hmpw-proxy]");
      if (proxy) {
        const asset = assets.find((item) => item.id === proxy.dataset.hmpwProxy);
        announce("Đang yêu cầu adapter tạo proxy…");
        let job = await runProxyJob(asset, proxyAdapter, { scale: 0.5 });
        if (job.output) outputs.set(job.id, job.output);
        if (job.status === "completed" && mediaStore && project) {
          const stem = cleanText(asset.name.replace(/\.[^.]+$/, ""), 180, "video");
          const proxyAsset = await mediaStore.saveAsset({ projectId: project.id, folderId: asset.folderId, name: `${stem}.proxy.webm`, type: job.output.type || "video/webm", size: job.output.size, tags: ["proxy"], references: [asset.id], metadata: { proxyFor: asset.id, scale: 0.5, generatedAt: now(), adapter: cleanText(proxyAdapter?.name, 100, "custom") }, blob: job.output });
          await mediaStore.updateAsset(asset.id, { metadata: { ...(asset.metadata || {}), proxyAssetId: proxyAsset.id, proxyStatus: "ready" } });
          assets = await mediaStore.listAssets(project.id);
          job = normalizeJob({ ...job, message: `${job.message} Đã lưu vào Media Bin chung.` }, "proxy");
        }
        state.proxyJobs.push(job); persist(); announce(job.message, job.status === "completed" ? "success" : "warning"); return;
      }
      if (event.target.closest("[data-hmpw-add-clip]")) {
        const id = host.querySelector("[data-hmpw-timeline-asset]")?.value;
        const asset = assets.find((item) => item.id === id);
        if (!asset) { announce("Hãy chọn một asset hợp lệ.", "error"); return; }
        const duration = clamp(asset.metadata?.duration, 0.04, 86400, asset.kind === "image" || asset.kind === "svg" ? 5 : 10);
        state.timeline = applyTimelineEdit(state.timeline, { type: "add-clip", clip: { assetId: asset.id, name: asset.name, trackId: asset.kind === "audio" ? "a1" : "v1", sourceOut: duration } });
        persist(); announce("Đã thêm tham chiếu clip; asset nguồn không bị sửa.", "success"); return;
      }
      if (event.target.closest("[data-hmpw-create-version]")) {
        state = createTimelineVersion(state);
        persist(); announce(`Đã lưu snapshot revision ${state.timeline.revision}; timeline và review có thể khôi phục.`, "success"); return;
      }
      const restoreVersion = event.target.closest("[data-hmpw-restore-version]");
      if (restoreVersion) {
        try {
          state = restoreTimelineVersion(state, restoreVersion.dataset.hmpwRestoreVersion);
          persist(); announce(`Đã khôi phục thành revision ${state.timeline.revision} mà không xóa lịch sử phiên bản.`, "success");
        } catch (error) { announce(error.message, "error"); }
        return;
      }
      const split = event.target.closest("[data-hmpw-split]");
      if (split) { const clip = state.timeline.clips.find((item) => item.id === split.dataset.hmpwSplit); state.timeline = applyTimelineEdit(state.timeline, { type: "split", clipId: clip.id, at: clip.start + (clip.sourceOut - clip.sourceIn) / clip.playbackRate / 2 }); persist(); return; }
      const remove = event.target.closest("[data-hmpw-remove-clip]");
      if (remove) { state.timeline = applyTimelineEdit(state.timeline, { type: "remove", clipId: remove.dataset.hmpwRemoveClip }); persist(); return; }
      if (event.target.closest("[data-hmpw-transcribe]")) {
        const asset = assets.find((item) => item.id === host.querySelector("[data-hmpw-transcript-asset]")?.value);
        announce("Đang chờ transcription adapter…");
        const job = await runTranscriptionJob(asset, transcriptionAdapter, { language: host.querySelector("[data-hmpw-language]")?.value, fps: state.timeline.fps });
        state.transcriptionJobs.push(job);
        if (job.status === "completed") state.timeline = normalizeTimeline({ ...state.timeline, revision: state.timeline.revision + 1, subtitles: [...state.timeline.subtitles, ...job.segments] });
        persist(); announce(job.message, job.status === "completed" ? "success" : "warning"); return;
      }
      if (event.target.closest("[data-hmpw-run-batch]")) {
        if (!batchFiles.length) { announce("Hãy chọn ít nhất một ảnh.", "error"); return; }
        const specification = { operation: host.querySelector("[data-hmpw-batch-operation]")?.value, width: host.querySelector("[data-hmpw-width]")?.value, height: host.querySelector("[data-hmpw-height]")?.value, type: host.querySelector("[data-hmpw-format]")?.value, background: host.querySelector("[data-hmpw-background]")?.value, threshold: host.querySelector("[data-hmpw-threshold]")?.value };
        announce(`Đang xử lý ${batchFiles.length} ảnh cục bộ…`);
        const jobs = await runImageBatch(batchFiles, specification, imageAdapter, globalScope);
        jobs.forEach((job) => { if (job.output) outputs.set(job.id, job.output); });
        state.batchJobs.push(...jobs); persist();
        const completed = jobs.filter((job) => job.status === "completed").length;
        announce(`${completed}/${jobs.length} ảnh có output thật.`, completed === jobs.length ? "success" : "warning"); return;
      }
      const resolve = event.target.closest("[data-hmpw-resolve]");
      if (resolve) { const current = state.reviews.find((item) => item.id === resolve.dataset.hmpwResolve); state.reviews = updateReviewComment(state.reviews, current.id, { status: current.status === "resolved" ? "open" : "resolved" }, state.timeline.fps); persist(); return; }
      if (event.target.closest("[data-hmpw-enqueue-render]")) {
        announce("Đang gửi render job…");
        const job = await enqueueRenderJob(renderAdapter, { projectId: state.projectId, timeline: state.timeline, preset: host.querySelector("[data-hmpw-render-preset]")?.value, name: host.querySelector("[data-hmpw-render-name]")?.value });
        state.renderQueue.push(job); persist(); announce(job.message, ["queued", "running", "completed"].includes(job.status) ? "success" : "warning"); return;
      }
      const poll = event.target.closest("[data-hmpw-poll]");
      if (poll) {
        const index = state.renderQueue.findIndex((job) => job.id === poll.dataset.hmpwPoll);
        state.renderQueue[index] = await refreshRenderJob(renderAdapter, state.renderQueue[index]); persist(); announce(state.renderQueue[index].message); return;
      }
      const cancel = event.target.closest("[data-hmpw-cancel]");
      if (cancel) {
        const index = state.renderQueue.findIndex((job) => job.id === cancel.dataset.hmpwCancel);
        state.renderQueue[index] = await cancelRenderJob(renderAdapter, state.renderQueue[index]); persist(); announce(state.renderQueue[index].message, state.renderQueue[index].status === "canceled" ? "success" : "warning"); return;
      }
      const vtt = event.target.closest("[data-hmpw-vtt]");
      if (vtt) { const job = state.transcriptionJobs.find((item) => item.id === vtt.dataset.hmpwVtt); downloadBlob(new Blob([toWebVtt(job.segments)], { type: "text/vtt;charset=utf-8" }), `${job.name}.vtt`); return; }
      const download = event.target.closest("[data-hmpw-download]");
      if (download && outputs.has(download.dataset.hmpwDownload)) { const job = [...state.proxyJobs, ...state.batchJobs].find((item) => item.id === download.dataset.hmpwDownload); downloadBlob(outputs.get(job.id), job.name); }
    });

    listen(host, "change", async (event) => {
      if (event.target.matches("[data-hmpw-import]")) {
        if (!mediaStore || !project) { announce("Media Bin chưa sẵn sàng.", "error"); return; }
        const files = [...(event.target.files || [])].slice(0, 100);
        for (const file of files) {
          const metadata = mediaApi?.extractMetadata ? await mediaApi.extractMetadata(file, globalScope) : {};
          await mediaStore.saveAsset({ projectId: project.id, name: file.name, type: file.type, size: file.size, lastModified: file.lastModified, metadata, blob: file });
        }
        event.target.value = ""; await refreshAssets(); announce(`Đã thêm ${files.length} tệp vào Media Bin dùng chung.`, "success");
      }
      if (event.target.matches("[data-hmpw-batch-files]")) { batchFiles = [...(event.target.files || [])].slice(0, 50); render(); announce(`Đã chọn ${batchFiles.length} ảnh.`); }
    });

    listen(host, "submit", (event) => {
      if (!event.target.matches("[data-hmpw-review-form]")) return;
      event.preventDefault();
      try {
        const comment = createReviewComment({ timecode: host.querySelector("[data-hmpw-timecode]")?.value, author: host.querySelector("[data-hmpw-author]")?.value, text: host.querySelector("[data-hmpw-comment]")?.value }, state.timeline.fps);
        if (!comment.text) throw new Error("Nhận xét không được để trống.");
        state.reviews.push(comment); persist(); announce(`Đã gắn nhận xét tại ${comment.timecode}.`, "success");
      } catch (error) { announce(error.message, "error"); }
    });

    listen(host.querySelector("[data-hmpw-tablist]"), "keydown", () => {});
    listen(host, "keydown", (event) => {
      const tab = event.target.closest("[data-hmpw-tab]");
      if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const tabs = [...host.querySelectorAll("[data-hmpw-tab]")];
      const current = tabs.indexOf(tab);
      const index = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      event.preventDefault(); tabs[index].click(); tabs[index].focus();
    });

    function downloadBlob(blob, filename) {
      if (!(blob instanceof Blob) || !globalScope.URL?.createObjectURL) return announce("Output không còn trong phiên này.", "warning");
      const url = globalScope.URL.createObjectURL(blob);
      const anchor = documentScope.createElement("a");
      anchor.href = url; anchor.download = cleanText(filename, 160, "hh-media-output").replace(/[\\/:*?"<>|]+/g, "-"); anchor.click();
      globalScope.setTimeout(() => globalScope.URL.revokeObjectURL(url), 0);
    }

    render();
    await refreshAssets().catch((error) => { host.querySelector("[data-hmpw-storage]").textContent = "Media Bin không khả dụng"; announce(error.message, "error"); });
    return Object.freeze({ getState: () => clone(state), refreshAssets, async unmount() { await unmount(host); } });
  }

  async function unmount(host) {
    const targets = [...activeInstances].filter((instance) => !host || instance.host === host);
    for (const instance of targets) {
      instance.controller.abort();
      instance.outputs.clear();
      instance.host.classList.remove("hh-media-workflow");
      instance.host.innerHTML = "";
      activeInstances.delete(instance);
      if (instance.ownedMediaStore) await instance.mediaStore?.close?.().catch(() => {});
    }
  }

  return Object.freeze({
    SCHEMA, STATE_KEY, VERSION, TIMELINE_SCHEMA, LIMITS,
    escapeHtml, secondsToTimecode, timecodeToSeconds, normalizeTimeline, applyTimelineEdit,
    createReviewComment, updateReviewComment, normalizeTimelineVersion, createTimelineVersion, restoreTimelineVersion, normalizeState, createStateStore,
    runProxyJob, createLocalTranscriptionAdapter, runTranscriptionJob, toWebVtt,
    transformImageLocal, runImageBatch, createServerRenderAdapter, enqueueRenderJob, refreshRenderJob, cancelRenderJob,
    mount, unmount
  });
});
