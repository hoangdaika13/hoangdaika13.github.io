(function attachGalaxyLayerOneMedia(root, factory) {
  "use strict";
  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHGalaxyLayerOneMedia = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createGalaxyLayerOneMedia(globalScope) {
  "use strict";

  const VERSION = "1.0.0";
  const LIMITS = Object.freeze({
    audioBytes: 512 * 1024 * 1024,
    videoBytes: 2 * 1024 * 1024 * 1024,
    subtitleBytes: 2 * 1024 * 1024,
    subtitleCues: 5000,
    cueTextLength: 4000,
    notes: 500,
    noteTextLength: 2000,
    waveformSamples: 50 * 1000 * 1000,
    waveformPoints: 4096,
    thumbnailPixels: 4096 * 4096
  });

  const TYPES = Object.freeze({
    audio: Object.freeze({
      extensions: Object.freeze(["mp3", "wav", "ogg", "oga", "m4a", "aac", "flac", "opus", "webm"]),
      mimePrefixes: Object.freeze(["audio/"]),
      maxBytes: LIMITS.audioBytes
    }),
    video: Object.freeze({
      extensions: Object.freeze(["mp4", "webm", "ogv", "mov", "m4v"]),
      mimePrefixes: Object.freeze(["video/"]),
      maxBytes: LIMITS.videoBytes
    }),
    subtitle: Object.freeze({
      extensions: Object.freeze(["srt", "vtt"]),
      mimeTypes: Object.freeze(["text/vtt", "application/x-subrip", "application/srt", "text/srt", "text/plain"]),
      maxBytes: LIMITS.subtitleBytes
    })
  });

  function mediaError(code, message) {
    const error = new Error(message);
    error.name = "HHGalaxyMediaError";
    error.code = code;
    return error;
  }

  function assertFinite(value, code, message) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw mediaError(code, message);
    return number;
  }

  function extensionOf(name) {
    const match = String(name || "").trim().toLowerCase().match(/\.([a-z0-9]{1,12})$/);
    return match ? match[1] : "";
  }

  function classifyFile(file, requestedKind) {
    const extension = extensionOf(file && file.name);
    const mime = String(file && file.type || "").trim().toLowerCase().split(";")[0];
    if (requestedKind && TYPES[requestedKind].extensions.includes(extension) && mimeMatchesKind(mime, requestedKind)) return requestedKind;
    if (TYPES.subtitle.extensions.includes(extension)) return "subtitle";
    const extensionKinds = ["audio", "video"].filter(function supports(kind) { return TYPES[kind].extensions.includes(extension); });
    if (extensionKinds.length === 1) return extensionKinds[0];
    if (extensionKinds.includes("audio") && TYPES.audio.mimePrefixes.some(function matches(prefix) { return mime.startsWith(prefix); })) return "audio";
    if (extensionKinds.includes("video") && TYPES.video.mimePrefixes.some(function matches(prefix) { return mime.startsWith(prefix); })) return "video";
    return "";
  }

  function mimeMatchesKind(mime, kind) {
    if (!mime) return true;
    if (kind === "subtitle") return TYPES.subtitle.mimeTypes.includes(mime);
    return TYPES[kind].mimePrefixes.some(function matches(prefix) { return mime.startsWith(prefix); });
  }

  function validateMediaFile(file, options) {
    const input = options && typeof options === "object" ? options : {};
    if (!file || typeof file !== "object") throw mediaError("FILE_REQUIRED", "Chưa chọn tệp media cục bộ.");
    const name = String(file.name || "").trim();
    if (!name || name.length > 240 || /[\u0000-\u001f\u007f]/.test(name)) {
      throw mediaError("FILE_NAME_INVALID", "Tên tệp media không hợp lệ.");
    }
    const size = assertFinite(file.size, "FILE_SIZE_INVALID", "Không đọc được kích thước tệp media.");
    if (!Number.isSafeInteger(size) || size <= 0) throw mediaError("FILE_SIZE_INVALID", "Tệp media trống hoặc có kích thước không hợp lệ.");
    const extension = extensionOf(name);
    const mimeType = String(file.type || "").trim().toLowerCase().split(";")[0];
    const requestedKind = ["audio", "video", "subtitle"].includes(input.kind) ? input.kind : "";
    const kind = classifyFile(file, requestedKind);
    if (!kind || (requestedKind && requestedKind !== kind)) throw mediaError("FILE_TYPE_UNSUPPORTED", "Định dạng tệp media không được hỗ trợ.");
    if (!TYPES[kind].extensions.includes(extension)) throw mediaError("FILE_EXTENSION_UNSUPPORTED", "Phần mở rộng tệp media không được hỗ trợ.");
    if (!mimeMatchesKind(mimeType, kind)) throw mediaError("FILE_MIME_MISMATCH", "MIME của tệp không khớp với loại media.");
    const configuredLimit = Number(input.maxBytes);
    const maxBytes = Number.isSafeInteger(configuredLimit) && configuredLimit > 0
      ? Math.min(configuredLimit, TYPES[kind].maxBytes)
      : TYPES[kind].maxBytes;
    if (size > maxBytes) throw mediaError("FILE_TOO_LARGE", "Tệp media vượt quá giới hạn dung lượng cho phép.");
    return Object.freeze({ kind: kind, name: name, extension: extension, mimeType: mimeType, size: size, maxBytes: maxBytes });
  }

  function utf8ByteLength(value) {
    const text = String(value || "");
    if (typeof TextEncoder === "function") return new TextEncoder().encode(text).byteLength;
    if (typeof Buffer === "function") return Buffer.byteLength(text, "utf8");
    return unescape(encodeURIComponent(text)).length;
  }

  function parseTimestamp(value) {
    const source = String(value || "").trim();
    const match = source.match(/^(?:(\d{1,3}):)?(\d{1,2}):(\d{2})[,.](\d{3})$/);
    if (!match) return null;
    const hours = Number(match[1] || 0);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    const millis = Number(match[4]);
    if (minutes > 59 || seconds > 59) return null;
    const total = ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis;
    return Number.isSafeInteger(total) ? total : null;
  }

  function formatTimestamp(milliseconds, options) {
    const input = options && typeof options === "object" ? options : {};
    const value = assertFinite(milliseconds, "TIMESTAMP_INVALID", "Mốc thời gian không hợp lệ.");
    if (value < 0) throw mediaError("TIMESTAMP_INVALID", "Mốc thời gian không được âm.");
    const rounded = Math.floor(value);
    const hours = Math.floor(rounded / 3600000);
    const minutes = Math.floor((rounded % 3600000) / 60000);
    const seconds = Math.floor((rounded % 60000) / 1000);
    const millis = rounded % 1000;
    const separator = input.srt === true ? "," : ".";
    const includeHours = input.alwaysHours !== false || hours > 0;
    const clock = (includeHours ? String(hours).padStart(2, "0") + ":" : "")
      + String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
    return input.milliseconds === false ? clock : clock + separator + String(millis).padStart(3, "0");
  }

  function timingLine(line) {
    const match = String(line || "").match(/^\s*((?:\d{1,3}:)?\d{1,2}:\d{2}[,.]\d{3})\s*-->\s*((?:\d{1,3}:)?\d{1,2}:\d{2}[,.]\d{3})(?:\s+.*)?$/);
    if (!match) return null;
    const startMs = parseTimestamp(match[1]);
    const endMs = parseTimestamp(match[2]);
    if (startMs === null || endMs === null || endMs <= startMs) return null;
    return { startMs: startMs, endMs: endMs };
  }

  function parseSubtitles(text, options) {
    const input = options && typeof options === "object" ? options : {};
    const source = String(text == null ? "" : text).replace(/^\uFEFF/, "").replace(/\u0000/g, "");
    const maxBytes = Math.min(Number(input.maxBytes) || LIMITS.subtitleBytes, LIMITS.subtitleBytes);
    const maxCues = Math.min(Number(input.maxCues) || LIMITS.subtitleCues, LIMITS.subtitleCues);
    if (!source.trim()) return Object.freeze({ format: "unknown", cues: Object.freeze([]) });
    if (utf8ByteLength(source) > maxBytes) throw mediaError("SUBTITLE_TOO_LARGE", "Tệp phụ đề vượt quá giới hạn dung lượng.");
    const format = /^\s*WEBVTT(?:\s|$)/i.test(source) ? "vtt" : "srt";
    const normalized = source.replace(/\r\n?/g, "\n");
    const blocks = normalized.split(/\n{2,}/);
    const cues = [];
    for (let index = 0; index < blocks.length; index += 1) {
      const lines = blocks[index].split("\n").map(function trimEnd(line) { return line.trimEnd(); });
      while (lines.length && !lines[0].trim()) lines.shift();
      if (!lines.length || /^WEBVTT(?:\s|$)/i.test(lines[0])) continue;
      let timingIndex = lines.findIndex(function findTiming(line) { return line.includes("-->"); });
      if (timingIndex < 0 || timingIndex > 1) continue;
      const timing = timingLine(lines[timingIndex]);
      if (!timing) throw mediaError("SUBTITLE_TIMING_INVALID", "Phụ đề chứa mốc thời gian không hợp lệ.");
      const cueText = lines.slice(timingIndex + 1).join("\n").trim();
      if (!cueText) continue;
      if (cueText.length > LIMITS.cueTextLength) throw mediaError("SUBTITLE_CUE_TOO_LONG", "Một cue phụ đề vượt quá giới hạn ký tự.");
      if (cues.length >= maxCues) throw mediaError("SUBTITLE_TOO_MANY_CUES", "Phụ đề vượt quá giới hạn số cue.");
      cues.push(Object.freeze({
        id: timingIndex === 1 ? String(lines[0]).trim().slice(0, 120) : String(cues.length + 1),
        startMs: timing.startMs,
        endMs: timing.endMs,
        text: cueText
      }));
    }
    cues.sort(function chronological(a, b) { return a.startMs - b.startMs || a.endMs - b.endMs; });
    return Object.freeze({ format: format, cues: Object.freeze(cues) });
  }

  function createTimestampNotes(seed, options) {
    const input = options && typeof options === "object" ? options : {};
    const maxNotes = Math.min(Number(input.maxNotes) || LIMITS.notes, LIMITS.notes);
    const now = typeof input.now === "function" ? input.now : Date.now;
    let serial = 0;
    const idFactory = typeof input.idFactory === "function" ? input.idFactory : function defaultId() {
      serial += 1;
      return "media-note-" + Number(now()).toString(36) + "-" + serial.toString(36);
    };
    let notes = [];

    function normalize(note, preserveId) {
      const atMs = Math.floor(assertFinite(note && note.atMs, "NOTE_TIMESTAMP_INVALID", "Mốc ghi chú không hợp lệ."));
      if (atMs < 0) throw mediaError("NOTE_TIMESTAMP_INVALID", "Mốc ghi chú không được âm.");
      const text = String(note && note.text || "").trim();
      if (!text || text.length > LIMITS.noteTextLength) throw mediaError("NOTE_TEXT_INVALID", "Nội dung ghi chú không hợp lệ.");
      const rawId = preserveId ? String(note && note.id || "") : String(idFactory());
      const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 96);
      if (!id) throw mediaError("NOTE_ID_INVALID", "ID ghi chú không hợp lệ.");
      return { id: id, atMs: atMs, text: text };
    }

    (Array.isArray(seed) ? seed : []).slice(0, maxNotes).forEach(function load(note) {
      const normalized = normalize(note, true);
      if (!notes.some(function duplicate(item) { return item.id === normalized.id; })) notes.push(normalized);
    });

    function snapshot() {
      return Object.freeze(notes.slice().sort(function byTime(a, b) { return a.atMs - b.atMs || a.id.localeCompare(b.id); })
        .map(function immutable(note) { return Object.freeze({ id: note.id, atMs: note.atMs, text: note.text }); }));
    }

    return Object.freeze({
      list: snapshot,
      add: function add(atMs, text) {
        if (notes.length >= maxNotes) throw mediaError("NOTES_LIMIT_REACHED", "Đã đạt giới hạn ghi chú timestamp.");
        const note = normalize({ atMs: atMs, text: text }, false);
        if (notes.some(function duplicate(item) { return item.id === note.id; })) throw mediaError("NOTE_ID_DUPLICATE", "ID ghi chú đã tồn tại.");
        notes.push(note);
        return Object.freeze({ id: note.id, atMs: note.atMs, text: note.text });
      },
      update: function update(id, patch) {
        const index = notes.findIndex(function find(note) { return note.id === String(id); });
        if (index < 0) return null;
        const next = normalize({ id: notes[index].id, atMs: patch && patch.atMs != null ? patch.atMs : notes[index].atMs, text: patch && patch.text != null ? patch.text : notes[index].text }, true);
        notes[index] = next;
        return Object.freeze({ id: next.id, atMs: next.atMs, text: next.text });
      },
      remove: function remove(id) {
        const before = notes.length;
        notes = notes.filter(function keep(note) { return note.id !== String(id); });
        return notes.length !== before;
      },
      clear: function clear() { notes = []; },
      toJSON: function toJSON() { return snapshot().map(function plain(note) { return { id: note.id, atMs: note.atMs, text: note.text }; }); }
    });
  }

  function downsampleWaveform(samples, pointCount) {
    if (!(samples instanceof Float32Array)) throw mediaError("WAVEFORM_INPUT_INVALID", "Waveform cần Float32Array.");
    if (!samples.length || samples.length > LIMITS.waveformSamples) throw mediaError("WAVEFORM_SIZE_INVALID", "Số mẫu waveform không hợp lệ.");
    const requested = Math.floor(assertFinite(pointCount, "WAVEFORM_POINTS_INVALID", "Số điểm waveform không hợp lệ."));
    if (requested < 1 || requested > LIMITS.waveformPoints) throw mediaError("WAVEFORM_POINTS_INVALID", "Số điểm waveform vượt giới hạn.");
    const count = Math.min(requested, samples.length);
    const output = new Float32Array(count);
    for (let point = 0; point < count; point += 1) {
      const start = Math.floor(point * samples.length / count);
      const end = Math.max(start + 1, Math.floor((point + 1) * samples.length / count));
      let peak = 0;
      for (let index = start; index < end; index += 1) {
        const value = Number.isFinite(samples[index]) ? Math.min(1, Math.abs(samples[index])) : 0;
        if (value > peak) peak = value;
      }
      output[point] = peak;
    }
    return output;
  }

  function createTrimRange(startMs, endMs, durationMs) {
    const duration = Math.floor(assertFinite(durationMs, "TRIM_DURATION_INVALID", "Thời lượng media không hợp lệ."));
    const start = Math.floor(assertFinite(startMs, "TRIM_RANGE_INVALID", "Điểm bắt đầu trim không hợp lệ."));
    const end = Math.floor(assertFinite(endMs, "TRIM_RANGE_INVALID", "Điểm kết thúc trim không hợp lệ."));
    if (duration <= 0 || start < 0 || end <= start || end > duration) throw mediaError("TRIM_RANGE_INVALID", "Khoảng trim nằm ngoài thời lượng media.");
    return Object.freeze({ startMs: start, endMs: end, durationMs: duration, lengthMs: end - start });
  }

  function createObjectUrlLease(file, options) {
    const descriptor = validateMediaFile(file, options);
    const environment = options && options.urlApi || globalScope.URL;
    if (!environment || typeof environment.createObjectURL !== "function" || typeof environment.revokeObjectURL !== "function") {
      throw mediaError("OBJECT_URL_UNAVAILABLE", "Trình duyệt không hỗ trợ Object URL cục bộ.");
    }
    const url = environment.createObjectURL(file);
    if (!/^blob:/i.test(String(url || ""))) {
      try { environment.revokeObjectURL(url); } catch (_) { /* Best effort for an invalid provider. */ }
      throw mediaError("OBJECT_URL_INVALID", "Object URL cục bộ không hợp lệ.");
    }
    let released = false;
    return Object.freeze({
      descriptor: descriptor,
      url: String(url),
      release: function release() {
        if (released) return false;
        released = true;
        environment.revokeObjectURL(url);
        return true;
      },
      isReleased: function isReleased() { return released; }
    });
  }

  function captureThumbnail(video, options) {
    const input = options && typeof options === "object" ? options : {};
    const doc = input.document || globalScope.document;
    if (!doc || typeof doc.createElement !== "function") return Promise.reject(mediaError("CANVAS_UNAVAILABLE", "Canvas không khả dụng trong môi trường hiện tại."));
    if (!video || typeof video !== "object") return Promise.reject(mediaError("VIDEO_REQUIRED", "Chưa có video để chụp thumbnail."));
    const source = String(video.currentSrc || video.src || "");
    if (/^https?:/i.test(source)) return Promise.reject(mediaError("REMOTE_SOURCE_FORBIDDEN", "Không chụp thumbnail từ URL từ xa."));
    const sourceWidth = Math.floor(Number(video.videoWidth));
    const sourceHeight = Math.floor(Number(video.videoHeight));
    if (sourceWidth <= 0 || sourceHeight <= 0) return Promise.reject(mediaError("VIDEO_FRAME_UNAVAILABLE", "Video chưa có frame sẵn sàng."));
    const maxWidth = Math.max(1, Math.min(Math.floor(Number(input.maxWidth) || 1280), 1920));
    const scale = Math.min(1, maxWidth / sourceWidth);
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    if (width * height > LIMITS.thumbnailPixels) return Promise.reject(mediaError("THUMBNAIL_TOO_LARGE", "Thumbnail vượt giới hạn số pixel."));
    const canvas = doc.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = typeof canvas.getContext === "function" ? canvas.getContext("2d", { alpha: false }) : null;
    if (!context || typeof context.drawImage !== "function") return Promise.reject(mediaError("CANVAS_CONTEXT_UNAVAILABLE", "Không thể tạo Canvas 2D."));
    try { context.drawImage(video, 0, 0, width, height); }
    catch (_) { return Promise.reject(mediaError("THUMBNAIL_CAPTURE_FAILED", "Không thể đọc frame video hiện tại.")); }
    if (typeof canvas.toBlob !== "function") return Promise.reject(mediaError("CANVAS_EXPORT_UNAVAILABLE", "Canvas không hỗ trợ xuất ảnh an toàn."));
    const type = ["image/jpeg", "image/png", "image/webp"].includes(input.type) ? input.type : "image/jpeg";
    const quality = Math.max(0.1, Math.min(Number(input.quality) || 0.86, 1));
    return new Promise(function exportCanvas(resolve, reject) {
      canvas.toBlob(function onBlob(blob) {
        if (!blob) { reject(mediaError("THUMBNAIL_EXPORT_FAILED", "Không thể xuất thumbnail.")); return; }
        resolve(Object.freeze({ blob: blob, width: width, height: height, timeMs: Math.max(0, Math.round((Number(video.currentTime) || 0) * 1000)), type: type }));
      }, type, quality);
    });
  }

  return Object.freeze({
    VERSION: VERSION,
    LIMITS: LIMITS,
    TYPES: TYPES,
    validateMediaFile: validateMediaFile,
    parseTimestamp: parseTimestamp,
    formatTimestamp: formatTimestamp,
    parseSubtitles: parseSubtitles,
    createTimestampNotes: createTimestampNotes,
    downsampleWaveform: downsampleWaveform,
    createTrimRange: createTrimRange,
    createObjectUrlLease: createObjectUrlLease,
    captureThumbnail: captureThumbnail
  });
});
