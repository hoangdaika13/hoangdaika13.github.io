(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const STORAGE_KEY = "hh.graphic-review.v1";
  const FORMAT = "hh-graphic-review-report";
  const STYLE_ID = "hh-graphic-review-style-v1";
  const STATUSES = Object.freeze(["draft", "review", "approved", "published"]);
  const STATUS_LABELS = Object.freeze({
    draft: "Bản nháp",
    review: "Chờ duyệt",
    approved: "Đã duyệt",
    published: "Đã xuất bản"
  });
  const TRANSITIONS = Object.freeze({
    draft: Object.freeze(["review"]),
    review: Object.freeze(["draft", "approved"]),
    approved: Object.freeze(["review", "published"]),
    published: Object.freeze([])
  });
  const PERMISSIONS = Object.freeze(["view", "comment", "download"]);
  const ROLES = Object.freeze(["viewer", "commenter", "editor", "owner"]);
  const ROLE_CAPABILITIES = Object.freeze({
    viewer: Object.freeze(["view"]),
    commenter: Object.freeze(["view", "comment"]),
    editor: Object.freeze(["view", "comment", "edit", "compare", "transition"]),
    owner: Object.freeze(["view", "comment", "edit", "compare", "transition", "publish", "manage"])
  });
  const mounted = typeof WeakMap === "function" ? new WeakMap() : new Map();

  function clone(value) {
    if (value === undefined) return undefined;
    if (typeof globalScope.structuredClone === "function") {
      try { return globalScope.structuredClone(value); } catch (_) { /* JSON fallback */ }
    }
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function cleanText(value, maxLength) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .trim()
      .slice(0, maxLength || 4000);
  }

  function makeError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function clamp(value, min, max) {
    const number = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(number) ? number : min));
  }

  function normalizePoint(input) {
    return {
      x: Number(clamp(input && input.x, 0, 1).toFixed(6)),
      y: Number(clamp(input && input.y, 0, 1).toFixed(6))
    };
  }

  function positionFromEvent(event, node) {
    if (!node || typeof node.getBoundingClientRect !== "function") return { x: 0.5, y: 0.5 };
    const rect = node.getBoundingClientRect();
    return normalizePoint({
      x: (Number(event && event.clientX) - rect.left) / Math.max(1, rect.width),
      y: (Number(event && event.clientY) - rect.top) / Math.max(1, rect.height)
    });
  }

  function randomId(prefix, cryptoImpl) {
    const cryptoApi = cryptoImpl === undefined ? globalScope.crypto : cryptoImpl;
    if (cryptoApi && typeof cryptoApi.randomUUID === "function") return `${prefix}-${cryptoApi.randomUUID()}`;
    if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      cryptoApi.getRandomValues(bytes);
      return `${prefix}-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    }
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }

  function normalizeAuthor(author) {
    return {
      id: cleanText(author && author.id, 160) || "local-user",
      name: cleanText(author && author.name, 160) || "Người dùng cục bộ"
    };
  }

  function normalizeRole(value, fallback) {
    const role = cleanText(value, 24).toLowerCase();
    return ROLES.includes(role) ? role : (fallback || "viewer");
  }

  function canRole(role, capability) {
    return Boolean(ROLE_CAPABILITIES[normalizeRole(role)]?.includes(cleanText(capability, 32).toLowerCase()));
  }

  function normalizeCommentTarget(input) {
    const source = input && typeof input === "object" ? input : {};
    const kind = source.kind === "timeline" || source.target === "timeline" || Number.isFinite(Number(source.timeMs)) ? "timeline" : "frame";
    return kind === "timeline"
      ? { kind, sequenceId: cleanText(source.sequenceId, 160), timeMs: Math.round(clamp(source.timeMs, 0, 86400000)) }
      : { kind, frameId: cleanText(source.frameId || source.artboardId, 160) || "canvas", ...normalizePoint(source) };
  }

  function normalizePermissions(input) {
    const permissions = {
      view: !input || input.view !== false,
      comment: Boolean(input && input.comment),
      download: Boolean(input && input.download)
    };
    if (permissions.comment || permissions.download) permissions.view = true;
    return permissions;
  }

  function canTransition(from, to) {
    return Boolean(TRANSITIONS[from] && TRANSITIONS[from].includes(to));
  }

  function valueType(value) {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value === "object" ? "object" : typeof value;
  }

  function diffData(before, after) {
    const changes = [];
    const visit = (left, right, path) => {
      if (Object.is(left, right)) return;
      const leftType = valueType(left);
      const rightType = valueType(right);
      if (leftType === "object" && rightType === "object") {
        const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
        keys.forEach((key) => {
          const nextPath = /^[A-Za-z_$][\w$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
          if (!Object.prototype.hasOwnProperty.call(left, key)) changes.push({ path: nextPath, type: "added", before: undefined, after: clone(right[key]) });
          else if (!Object.prototype.hasOwnProperty.call(right, key)) changes.push({ path: nextPath, type: "removed", before: clone(left[key]), after: undefined });
          else visit(left[key], right[key], nextPath);
        });
        return;
      }
      if (leftType === "array" && rightType === "array") {
        const length = Math.max(left.length, right.length);
        for (let index = 0; index < length; index += 1) {
          const nextPath = `${path}[${index}]`;
          if (index >= left.length) changes.push({ path: nextPath, type: "added", before: undefined, after: clone(right[index]) });
          else if (index >= right.length) changes.push({ path: nextPath, type: "removed", before: clone(left[index]), after: undefined });
          else visit(left[index], right[index], nextPath);
        }
        return;
      }
      changes.push({ path, type: left === undefined ? "added" : right === undefined ? "removed" : "changed", before: clone(left), after: clone(right) });
    };
    visit(before, after, "$");
    return changes;
  }

  function normalizeSnapshot(input, fallbackLabel, idFactory) {
    const source = input && typeof input === "object" ? input : {};
    const data = Object.prototype.hasOwnProperty.call(source, "data") ? source.data : source;
    return {
      id: cleanText(source.id, 200) || idFactory("snapshot"),
      label: cleanText(source.label, 200) || fallbackLabel,
      createdAt: source.createdAt ? new Date(source.createdAt).toISOString() : null,
      data: clone(data == null ? {} : data)
    };
  }

  function safeColor(value, fallback) {
    const color = String(value || "");
    return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\))$/i.test(color) ? color : fallback;
  }

  function canvasData(snapshot) {
    const value = snapshot && Object.prototype.hasOwnProperty.call(snapshot, "data") ? snapshot.data : snapshot;
    return value && typeof value === "object" ? value : {};
  }

  function drawSnapshotRegion(context, snapshot, region, options) {
    const data = canvasData(snapshot);
    const canvasMeta = data.canvas && typeof data.canvas === "object" ? data.canvas : {};
    const sourceWidth = Math.max(1, Number(canvasMeta.width) || 1920);
    const sourceHeight = Math.max(1, Number(canvasMeta.height) || 1080);
    const ratio = sourceWidth / sourceHeight;
    const padding = 14;
    let width = Math.max(1, region.width - padding * 2);
    let height = width / ratio;
    if (height > region.height - padding * 2) {
      height = Math.max(1, region.height - padding * 2);
      width = height * ratio;
    }
    const left = region.x + (region.width - width) / 2;
    const top = region.y + (region.height - height) / 2;
    context.fillStyle = options && options.surface || "#0d1722";
    context.fillRect(region.x, region.y, region.width, region.height);
    context.fillStyle = safeColor(canvasMeta.background || data.background, "#f5f7fa");
    context.fillRect(left, top, width, height);
    const layers = Array.isArray(data.layers) ? data.layers : [];
    layers.slice(0, 120).forEach((layer, index) => {
      if (!layer || layer.visible === false) return;
      const x = Number(layer.x);
      const y = Number(layer.y);
      const layerWidth = Number(layer.width);
      const layerHeight = Number(layer.height);
      const normalizedX = Number.isFinite(x) ? (Math.abs(x) <= 1 ? x : x / sourceWidth) : 0.08 + (index % 5) * 0.04;
      const normalizedY = Number.isFinite(y) ? (Math.abs(y) <= 1 ? y : y / sourceHeight) : 0.1 + (index % 7) * 0.06;
      const normalizedWidth = Number.isFinite(layerWidth) ? (Math.abs(layerWidth) <= 1 ? layerWidth : layerWidth / sourceWidth) : 0.42;
      const normalizedHeight = Number.isFinite(layerHeight) ? (Math.abs(layerHeight) <= 1 ? layerHeight : layerHeight / sourceHeight) : 0.12;
      const drawX = left + clamp(normalizedX, 0, 1) * width;
      const drawY = top + clamp(normalizedY, 0, 1) * height;
      const drawWidth = Math.max(2, clamp(normalizedWidth, 0.005, 1) * width);
      const drawHeight = Math.max(2, clamp(normalizedHeight, 0.005, 1) * height);
      context.globalAlpha = clamp(layer.opacity == null ? 1 : layer.opacity, 0, 1);
      context.fillStyle = safeColor(layer.fill || layer.color || layer.background, index % 2 ? "#56cfe1" : "#ff5d8f");
      context.fillRect(drawX, drawY, drawWidth, drawHeight);
      const label = cleanText(layer.text || layer.name, 80);
      if (label && drawWidth > 35 && drawHeight > 12 && typeof context.fillText === "function") {
        context.globalAlpha = 1;
        context.fillStyle = safeColor(layer.textColor, "#081018");
        context.font = "600 10px system-ui, sans-serif";
        context.fillText(label.slice(0, 34), drawX + 5, drawY + Math.min(drawHeight - 4, 14), Math.max(1, drawWidth - 10));
      }
    });
    context.globalAlpha = 1;
    context.strokeStyle = "#62778a";
    context.lineWidth = 1;
    context.strokeRect(left + 0.5, top + 0.5, Math.max(0, width - 1), Math.max(0, height - 1));
  }

  function prepareCanvas(canvas, options) {
    if (!canvas || typeof canvas.getContext !== "function") return null;
    const context = canvas.getContext("2d");
    if (!context) return null;
    const cssWidth = Math.max(1, Number(options && options.width) || canvas.clientWidth || canvas.width || 360);
    const cssHeight = Math.max(1, Number(options && options.height) || canvas.clientHeight || canvas.height || 210);
    const pixelRatio = clamp(options && options.pixelRatio == null ? (globalScope.devicePixelRatio || 1) : options.pixelRatio, 1, 3);
    canvas.width = Math.round(cssWidth * pixelRatio);
    canvas.height = Math.round(cssHeight * pixelRatio);
    if (canvas.style) {
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
    }
    if (typeof context.setTransform === "function") context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    return { context, width: cssWidth, height: cssHeight };
  }

  function renderSnapshotPreview(canvas, snapshot, options) {
    const prepared = prepareCanvas(canvas, options || {});
    if (!prepared) return { supported: false, reason: "Canvas 2D không khả dụng trên thiết bị này." };
    prepared.context.clearRect(0, 0, prepared.width, prepared.height);
    drawSnapshotRegion(prepared.context, snapshot, { x: 0, y: 0, width: prepared.width, height: prepared.height }, options || {});
    return { supported: true, width: prepared.width, height: prepared.height };
  }

  function renderDiffPreview(canvas, before, after, options) {
    const settings = options || {};
    const prepared = prepareCanvas(canvas, settings);
    const changes = diffData(canvasData(before), canvasData(after));
    if (!prepared) return { supported: false, reason: "Canvas 2D không khả dụng trên thiết bị này.", changes };
    const { context, width, height } = prepared;
    context.clearRect(0, 0, width, height);
    const half = width / 2;
    drawSnapshotRegion(context, before, { x: 0, y: 0, width: half, height }, settings);
    drawSnapshotRegion(context, after, { x: half, y: 0, width: half, height }, settings);
    context.fillStyle = "#0b121a";
    context.fillRect(half - 1, 0, 2, height);
    return { supported: true, changes, width, height };
  }

  function bytesToBase64(bytes) {
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    if (typeof globalScope.btoa === "function") return globalScope.btoa(binary);
    if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
    throw makeError("ENCODING_UNSUPPORTED", "Thiết bị không hỗ trợ mã hóa Base64.");
  }

  function base64ToBytes(value) {
    if (typeof globalScope.atob === "function") {
      const binary = globalScope.atob(value);
      return Uint8Array.from(binary, (character) => character.charCodeAt(0));
    }
    if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(value, "base64"));
    throw makeError("ENCODING_UNSUPPORTED", "Thiết bị không hỗ trợ giải mã Base64.");
  }

  function encodeUtf8(value) {
    if (typeof TextEncoder === "function") return new TextEncoder().encode(value);
    const encoded = unescape(encodeURIComponent(value));
    return Uint8Array.from(encoded, (character) => character.charCodeAt(0));
  }

  async function hashPassword(password, cryptoImpl, saltBytes) {
    const value = String(password == null ? "" : password);
    if (!value) return null;
    const cryptoApi = cryptoImpl === undefined ? globalScope.crypto : cryptoImpl;
    if (!cryptoApi || !cryptoApi.subtle || typeof cryptoApi.getRandomValues !== "function") {
      throw makeError("WEB_CRYPTO_UNSUPPORTED", "Không thể bảo vệ link bằng mật khẩu vì Web Crypto/PBKDF2 không khả dụng.");
    }
    const salt = saltBytes ? new Uint8Array(saltBytes) : cryptoApi.getRandomValues(new Uint8Array(16));
    const key = await cryptoApi.subtle.importKey("raw", encodeUtf8(value), "PBKDF2", false, ["deriveBits"]);
    const iterations = 120000;
    const bits = await cryptoApi.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
    return { algorithm: "PBKDF2-SHA-256", iterations, salt: bytesToBase64(salt), hash: bytesToBase64(new Uint8Array(bits)) };
  }

  function constantTimeEqual(left, right) {
    if (left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
    return difference === 0;
  }

  async function verifyPassword(password, descriptor, cryptoImpl) {
    if (!descriptor) return true;
    if (descriptor.algorithm !== "PBKDF2-SHA-256") return false;
    const cryptoApi = cryptoImpl === undefined ? globalScope.crypto : cryptoImpl;
    if (!cryptoApi || !cryptoApi.subtle) throw makeError("WEB_CRYPTO_UNSUPPORTED", "Web Crypto không khả dụng để xác minh mật khẩu.");
    const salt = base64ToBytes(descriptor.salt);
    const key = await cryptoApi.subtle.importKey("raw", encodeUtf8(String(password == null ? "" : password)), "PBKDF2", false, ["deriveBits"]);
    const bits = await cryptoApi.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: descriptor.iterations }, key, 256);
    return constantTimeEqual(new Uint8Array(bits), base64ToBytes(descriptor.hash));
  }

  function emptyEnvelope() {
    return { version: VERSION, reviews: [], shareLinks: [] };
  }

  function createStore(options) {
    const settings = options || {};
    const now = typeof settings.now === "function" ? settings.now : () => new Date();
    const cryptoApi = Object.prototype.hasOwnProperty.call(settings, "crypto") ? settings.crypto : globalScope.crypto;
    let storage = null;
    try {
      storage = Object.prototype.hasOwnProperty.call(settings, "storage") ? settings.storage : globalScope.localStorage;
      if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") storage = null;
    } catch (_) { storage = null; }
    let persistence = storage ? "localStorage" : "memory";
    let persistenceError = "";
    let state = emptyEnvelope();

    if (storage) {
      try {
        const raw = storage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && parsed.version === VERSION && Array.isArray(parsed.reviews) && Array.isArray(parsed.shareLinks)) state = parsed;
      } catch (error) {
        persistenceError = "Không đọc được dữ liệu review cục bộ; phiên này dùng bộ nhớ tạm.";
        persistence = "memory";
        storage = null;
      }
    }

    const isoNow = () => {
      const value = now();
      return (value instanceof Date ? value : new Date(value)).toISOString();
    };
    const idFactory = (prefix) => randomId(prefix, cryptoApi);
    const save = () => {
      if (!storage) return;
      try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); }
      catch (_) {
        persistenceError = "Không thể ghi localStorage; thay đổi mới chỉ còn trong phiên hiện tại.";
        persistence = "memory";
        storage = null;
      }
    };
    const requireReview = (reviewId) => {
      const review = state.reviews.find((item) => item.id === reviewId);
      if (!review) throw makeError("REVIEW_NOT_FOUND", "Không tìm thấy review.");
      if (!Array.isArray(review.versions)) review.versions = [];
      if (!Array.isArray(review.participants)) review.participants = [];
      return review;
    };
    const requireThread = (review, threadId) => {
      const thread = review.threads.find((item) => item.id === threadId);
      if (!thread) throw makeError("THREAD_NOT_FOUND", "Không tìm thấy luồng bình luận.");
      return thread;
    };
    const touch = (review) => { review.updatedAt = isoNow(); };
    const audit = (review, type, actor, details) => {
      const previous = review.activity[review.activity.length - 1];
      const entry = {
        id: idFactory("activity"),
        sequence: review.activity.length + 1,
        previousId: previous ? previous.id : null,
        type,
        actor: normalizeAuthor(actor),
        details: clone(details || {}),
        createdAt: isoNow()
      };
      review.activity.push(entry);
      touch(review);
      return entry;
    };

    function createReview(input) {
      const source = input || {};
      const createdAt = isoNow();
      const review = {
        id: cleanText(source.id, 200) || idFactory("review"),
        projectId: cleanText(source.projectId, 200),
        title: cleanText(source.title, 240) || "Review thiết kế chưa đặt tên",
        description: cleanText(source.description, 4000),
        status: "draft",
        snapshots: {
          before: normalizeSnapshot(source.before || (source.snapshots && source.snapshots.before), "Trước", idFactory),
          after: normalizeSnapshot(source.after || (source.snapshots && source.snapshots.after), "Sau", idFactory)
        },
        threads: [],
        versions: [],
        participants: [{ ...normalizeAuthor(source.actor), role: "owner" }],
        activity: [],
        createdAt,
        updatedAt: createdAt
      };
      review.versions.push({ id: idFactory("version"), label: "Phiên bản ban đầu", snapshot: clone(review.snapshots.after), createdAt, createdBy: normalizeAuthor(source.actor) });
      if (state.reviews.some((item) => item.id === review.id)) throw makeError("DUPLICATE_REVIEW", "Mã review đã tồn tại.");
      audit(review, "review.created", source.actor, { status: review.status });
      state.reviews.push(review);
      save();
      return clone(review);
    }

    function getReview(reviewId) { return clone(state.reviews.find((item) => item.id === reviewId)); }
    function listReviews() { return clone(state.reviews.slice().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))); }

    function updateSnapshots(reviewId, snapshots, actor) {
      const review = requireReview(reviewId);
      if (review.status === "published") throw makeError("REVIEW_LOCKED", "Review đã xuất bản không thể thay snapshot.");
      review.snapshots = {
        before: normalizeSnapshot(snapshots && snapshots.before, "Trước", idFactory),
        after: normalizeSnapshot(snapshots && snapshots.after, "Sau", idFactory)
      };
      const changes = diffData(review.snapshots.before.data, review.snapshots.after.data);
      audit(review, "snapshots.updated", actor, { changeCount: changes.length });
      save();
      return { review: clone(review), changes };
    }

    function compareSnapshots(reviewId) {
      const review = requireReview(reviewId);
      return diffData(review.snapshots.before.data, review.snapshots.after.data);
    }

    function addThread(reviewId, input, actor) {
      const review = requireReview(reviewId);
      const body = cleanText(input && input.body, 4000);
      if (!body) throw makeError("COMMENT_REQUIRED", "Nội dung bình luận không được để trống.");
      const target = normalizeCommentTarget(input);
      const point = target.kind === "frame" ? { x: target.x, y: target.y } : normalizePoint(input);
      const createdAt = isoNow();
      const thread = {
        id: idFactory("thread"),
        x: point.x,
        y: point.y,
        target,
        body,
        author: normalizeAuthor(actor || (input && input.author)),
        createdAt,
        resolved: false,
        resolvedAt: null,
        resolvedBy: null,
        replies: []
      };
      review.threads.push(thread);
      audit(review, "thread.created", thread.author, { threadId: thread.id, x: thread.x, y: thread.y });
      save();
      return clone(thread);
    }

    function addVersion(reviewId, input, actor) {
      const review = requireReview(reviewId);
      if (review.status === "published") throw makeError("REVIEW_LOCKED", "Review đã xuất bản không thể thêm phiên bản.");
      const source = input && typeof input === "object" ? input : {};
      const version = {
        id: cleanText(source.id, 200) || idFactory("version"),
        label: cleanText(source.label, 200) || `Phiên bản ${review.versions.length + 1}`,
        snapshot: normalizeSnapshot(source.snapshot || source.data || review.snapshots.after, "Phiên bản", idFactory),
        createdAt: isoNow(),
        createdBy: normalizeAuthor(actor)
      };
      review.versions.push(version);
      audit(review, "version.created", actor, { versionId: version.id, label: version.label });
      save();
      return clone(version);
    }

    function compareVersions(reviewId, beforeVersionId, afterVersionId) {
      const review = requireReview(reviewId);
      const before = review.versions.find((item) => item.id === beforeVersionId);
      const after = review.versions.find((item) => item.id === afterVersionId);
      if (!before || !after) throw makeError("VERSION_NOT_FOUND", "Không tìm thấy phiên bản cần so sánh.");
      return { before: clone(before), after: clone(after), changes: diffData(before.snapshot.data, after.snapshot.data) };
    }

    function setParticipantRole(reviewId, user, role, actor) {
      const review = requireReview(reviewId);
      const normalizedUser = normalizeAuthor(user);
      const nextRole = normalizeRole(role);
      if (nextRole === "owner" && actor && normalizeRole(actor.role) !== "owner") throw makeError("PERMISSION_DENIED", "Chỉ chủ review được cấp quyền owner.");
      const existing = review.participants.find((item) => item.id === normalizedUser.id);
      if (existing) Object.assign(existing, normalizedUser, { role: nextRole });
      else review.participants.push({ ...normalizedUser, role: nextRole });
      audit(review, "participant.role.changed", actor, { userId: normalizedUser.id, role: nextRole });
      save();
      return clone(review.participants);
    }

    function authorize(reviewId, userId, capability) {
      const review = requireReview(reviewId);
      const participant = review.participants.find((item) => item.id === cleanText(userId, 160));
      return { allowed: canRole(participant?.role || "viewer", capability), role: participant?.role || "viewer", capability: cleanText(capability, 32) };
    }

    function addReply(reviewId, threadId, input, actor) {
      const review = requireReview(reviewId);
      const thread = requireThread(review, threadId);
      const body = cleanText(input && input.body, 4000);
      if (!body) throw makeError("COMMENT_REQUIRED", "Nội dung phản hồi không được để trống.");
      const reply = { id: idFactory("reply"), body, author: normalizeAuthor(actor || (input && input.author)), createdAt: isoNow() };
      thread.replies.push(reply);
      audit(review, "reply.created", reply.author, { threadId, replyId: reply.id });
      save();
      return clone(reply);
    }

    function resolveThread(reviewId, threadId, resolved, actor) {
      const review = requireReview(reviewId);
      const thread = requireThread(review, threadId);
      const nextResolved = resolved !== false;
      thread.resolved = nextResolved;
      thread.resolvedAt = nextResolved ? isoNow() : null;
      thread.resolvedBy = nextResolved ? normalizeAuthor(actor) : null;
      audit(review, nextResolved ? "thread.resolved" : "thread.reopened", actor, { threadId });
      save();
      return clone(thread);
    }

    function transition(reviewId, nextStatus, actor, note) {
      const review = requireReview(reviewId);
      const target = cleanText(nextStatus, 40).toLowerCase();
      if (!STATUSES.includes(target) || !canTransition(review.status, target)) {
        throw makeError("INVALID_TRANSITION", `Không thể chuyển từ ${review.status} sang ${target || "trạng thái rỗng"}.`);
      }
      const previous = review.status;
      review.status = target;
      audit(review, "status.changed", actor, { from: previous, to: target, note: cleanText(note, 1000) });
      save();
      return clone(review);
    }

    async function createShareLink(reviewId, input, actor) {
      const review = requireReview(reviewId);
      const source = input || {};
      let expiresAt = null;
      if (source.expiresAt) {
        const expiry = new Date(source.expiresAt);
        if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= new Date(isoNow()).getTime()) {
          throw makeError("INVALID_EXPIRY", "Hạn dùng của link phải nằm trong tương lai.");
        }
        expiresAt = expiry.toISOString();
      }
      const passwordHash = await hashPassword(source.password, cryptoApi);
      const token = idFactory("share");
      const baseUrl = cleanText(source.baseUrl, 2000) || (() => {
        try { return globalScope.location && globalScope.location.href ? globalScope.location.href.split("#")[0] : "local://hh-graphic-review"; }
        catch (_) { return "local://hh-graphic-review"; }
      })();
      const link = {
        id: idFactory("link"),
        reviewId: review.id,
        token,
        url: `${baseUrl}#hh-review=${encodeURIComponent(token)}`,
        permissions: normalizePermissions(source.permissions),
        expiresAt,
        passwordHash,
        createdAt: isoNow(),
        createdBy: normalizeAuthor(actor),
        revokedAt: null,
        revokedBy: null,
        scope: "local-browser-profile"
      };
      state.shareLinks.push(link);
      audit(review, "share.created", actor, { linkId: link.id, permissions: link.permissions, expiresAt, passwordProtected: Boolean(passwordHash) });
      save();
      return clone(link);
    }

    function listShareLinks(reviewId) {
      return clone(state.shareLinks.filter((link) => link.reviewId === reviewId));
    }

    async function accessShareLink(token, input) {
      const source = input || {};
      const link = state.shareLinks.find((item) => item.token === token || item.id === token);
      if (!link) throw makeError("SHARE_NOT_FOUND", "Link chia sẻ không tồn tại trên hồ sơ trình duyệt này.");
      if (link.revokedAt) throw makeError("SHARE_REVOKED", "Link chia sẻ đã bị thu hồi.");
      if (link.expiresAt && new Date(link.expiresAt).getTime() <= new Date(isoNow()).getTime()) throw makeError("SHARE_EXPIRED", "Link chia sẻ đã hết hạn.");
      const permission = cleanText(source.permission, 40) || "view";
      if (!PERMISSIONS.includes(permission) || !link.permissions[permission]) throw makeError("PERMISSION_DENIED", `Link không có quyền ${permission}.`);
      if (!(await verifyPassword(source.password, link.passwordHash, cryptoApi))) throw makeError("INVALID_PASSWORD", "Mật khẩu link không đúng.");
      const review = requireReview(link.reviewId);
      audit(review, "share.accessed", source.actor, { linkId: link.id, permission });
      save();
      return { review: clone(review), link: clone(link), permission };
    }

    function revokeShareLink(linkId, actor) {
      const link = state.shareLinks.find((item) => item.id === linkId || item.token === linkId);
      if (!link) throw makeError("SHARE_NOT_FOUND", "Không tìm thấy link chia sẻ.");
      if (!link.revokedAt) {
        link.revokedAt = isoNow();
        link.revokedBy = normalizeAuthor(actor);
        const review = requireReview(link.reviewId);
        audit(review, "share.revoked", actor, { linkId: link.id });
        save();
      }
      return clone(link);
    }

    function reportData(reviewId) {
      const review = requireReview(reviewId);
      return {
        format: FORMAT,
        version: VERSION,
        exportedAt: isoNow(),
        review: clone(review),
        changes: diffData(review.snapshots.before.data, review.snapshots.after.data),
        summary: {
          threads: review.threads.length,
          unresolved: review.threads.filter((thread) => !thread.resolved).length,
          activities: review.activity.length
        }
      };
    }

    function exportReport(reviewId, format) {
      const report = reportData(reviewId);
      if (format === "json") return JSON.stringify(report, null, 2);
      const review = report.review;
      const changes = report.changes.map((change) => `<tr><td>${escapeHtml(change.path)}</td><td>${escapeHtml(change.type)}</td><td><code>${escapeHtml(JSON.stringify(change.before))}</code></td><td><code>${escapeHtml(JSON.stringify(change.after))}</code></td></tr>`).join("");
      const threads = review.threads.map((thread, index) => `<article><h3>#${index + 1} · ${thread.resolved ? "Đã xử lý" : "Đang mở"}</h3><p>${escapeHtml(thread.body)}</p><small>${escapeHtml(thread.author.name)} · (${Math.round(thread.x * 100)}%, ${Math.round(thread.y * 100)}%)</small>${thread.replies.map((reply) => `<blockquote><p>${escapeHtml(reply.body)}</p><small>${escapeHtml(reply.author.name)}</small></blockquote>`).join("")}</article>`).join("");
      const activity = review.activity.map((entry) => `<li><time>${escapeHtml(entry.createdAt)}</time> · ${escapeHtml(entry.actor.name)} · ${escapeHtml(entry.type)}</li>`).join("");
      return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(review.title)} · Review report</title><style>body{max-width:1080px;margin:32px auto;padding:0 20px;color:#18222c;background:#fff;font:14px/1.55 system-ui,sans-serif}h1{font-size:28px}header,section{margin-bottom:28px}table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #cbd5df;text-align:left;vertical-align:top}code{white-space:pre-wrap;overflow-wrap:anywhere}article{padding:12px 0;border-bottom:1px solid #d8e0e7}blockquote{margin:8px 0 0 16px;padding-left:12px;border-left:3px solid #58a6b7}@media(max-width:600px){body{margin:16px auto}table{display:block;overflow:auto}}</style></head><body><header><p>${escapeHtml(FORMAT)} v${VERSION}</p><h1>${escapeHtml(review.title)}</h1><p>${escapeHtml(review.description)}</p><strong>${escapeHtml(STATUS_LABELS[review.status])}</strong></header><section><h2>Tóm tắt</h2><p>${report.changes.length} thay đổi · ${report.summary.threads} luồng · ${report.summary.unresolved} chưa xử lý</p></section><section><h2>Diff dữ liệu</h2><table><thead><tr><th>Đường dẫn</th><th>Loại</th><th>Trước</th><th>Sau</th></tr></thead><tbody>${changes || "<tr><td colspan=\"4\">Không có thay đổi.</td></tr>"}</tbody></table></section><section><h2>Bình luận</h2>${threads || "<p>Chưa có bình luận.</p>"}</section><section><h2>Nhật ký</h2><ol>${activity}</ol></section></body></html>`;
    }

    function removeReview(reviewId) {
      const index = state.reviews.findIndex((item) => item.id === reviewId);
      if (index < 0) return false;
      state.reviews.splice(index, 1);
      state.shareLinks = state.shareLinks.filter((link) => link.reviewId !== reviewId);
      save();
      return true;
    }

    return Object.freeze({
      getPersistence: () => ({ type: persistence, key: STORAGE_KEY, version: VERSION, error: persistenceError }),
      createReview, getReview, listReviews, removeReview, updateSnapshots, compareSnapshots,
      addThread, addReply, resolveThread, transition, addVersion, compareVersions, setParticipantRole, authorize,
      createShareLink, listShareLinks, accessShareLink, revokeShareLink,
      reportData, exportReport
    });
  }

  function injectStyles(doc) {
    if (!doc || doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [data-hh-graphic-review]{--gr-bg:#0a0e13;--gr-panel:#111820;--gr-panel2:#17212b;--gr-line:#344453;--gr-text:#f2f5f7;--gr-muted:#9cabb8;--gr-cyan:#5ed0df;--gr-pink:#f06292;--gr-green:#73d39d;--gr-yellow:#edc968;display:block;max-width:100%;min-width:0;overflow:hidden;border:1px solid var(--gr-line);border-radius:8px;background:var(--gr-bg);color:var(--gr-text);font:500 13px/1.45 Inter,system-ui,sans-serif}
      [data-hh-graphic-review] *{box-sizing:border-box;letter-spacing:0}[data-hh-graphic-review] button,[data-hh-graphic-review] input,[data-hh-graphic-review] textarea,[data-hh-graphic-review] select{font:inherit}[data-hh-graphic-review] button{min-height:34px;padding:7px 10px;border:1px solid var(--gr-line);border-radius:6px;background:#16212b;color:var(--gr-text);cursor:pointer}[data-hh-graphic-review] button:hover:not(:disabled){border-color:var(--gr-cyan);background:#1d2b36}[data-hh-graphic-review] button:disabled{opacity:.45;cursor:not-allowed}[data-hh-graphic-review] button.is-primary{border-color:#4bb8c5;background:#4bb8c5;color:#071015;font-weight:800}[data-hh-graphic-review] button.is-danger{border-color:#84445b;color:#ffadca}[data-hh-graphic-review] :is(button,input,textarea,select,[tabindex]):focus-visible{outline:2px solid var(--gr-cyan);outline-offset:2px}[data-hh-graphic-review] input,[data-hh-graphic-review] textarea,[data-hh-graphic-review] select{width:100%;min-width:0;padding:8px 9px;border:1px solid var(--gr-line);border-radius:6px;background:#0b1118;color:var(--gr-text)}[data-hh-graphic-review] textarea{min-height:78px;resize:vertical}[data-hh-graphic-review] label{display:grid;gap:5px;color:var(--gr-muted);font-size:11px}
      .hgr-head{display:flex;align-items:center;gap:12px;min-width:0;padding:12px 14px;border-bottom:1px solid var(--gr-line);background:#0d141b}.hgr-title{min-width:0}.hgr-title h2{margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:17px}.hgr-title p{margin:2px 0 0;color:var(--gr-muted);font-size:10px}.hgr-actions{display:flex;gap:6px;margin-left:auto;overflow:auto}.hgr-status{flex:0 0 auto;padding:5px 8px;border:1px solid var(--gr-line);border-radius:999px;color:var(--gr-yellow);font-size:10px}.hgr-status[data-status="approved"],.hgr-status[data-status="published"]{color:var(--gr-green)}
      .hgr-steps{display:flex;gap:0;padding:8px 14px;border-bottom:1px solid var(--gr-line);overflow:auto;background:#0b1117}.hgr-step{display:flex;align-items:center;gap:6px;min-width:max-content;color:var(--gr-muted);font-size:10px}.hgr-step:not(:last-child)::after{content:"";width:24px;height:1px;margin:0 8px;background:var(--gr-line)}.hgr-step.is-current{color:var(--gr-cyan);font-weight:800}.hgr-step.is-done{color:var(--gr-green)}.hgr-step b{display:grid;place-items:center;width:20px;height:20px;border:1px solid currentColor;border-radius:50%;font-size:9px}
      .hgr-notice{padding:8px 14px;border-bottom:1px solid #365969;background:#10232c;color:#c8f2f5}.hgr-notice[data-kind="error"]{border-color:#764057;background:#2b1720;color:#ffc0d4}.hgr-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;min-height:590px}.hgr-main{display:grid;grid-template-rows:auto minmax(350px,1fr);min-width:0;border-right:1px solid var(--gr-line)}.hgr-toolbar{display:flex;align-items:center;gap:7px;min-width:0;padding:8px 10px;border-bottom:1px solid var(--gr-line);overflow:auto}.hgr-toolbar span{margin-right:auto;color:var(--gr-muted);white-space:nowrap;font-size:10px}.hgr-stage{position:relative;min-width:0;min-height:420px;margin:14px;overflow:hidden;border:1px solid #405567;border-radius:6px;background-color:#101922;background-image:linear-gradient(#1b2833 1px,transparent 1px),linear-gradient(90deg,#1b2833 1px,transparent 1px);background-size:24px 24px;cursor:crosshair}.hgr-artboard{position:absolute;inset:8%;overflow:hidden;border-radius:4px;background:#f4f6f8;color:#10202b;box-shadow:0 14px 36px rgba(0,0,0,.35)}.hgr-art-shape{position:absolute;inset:11% 8% auto auto;width:32%;height:58%;background:#5ed0df}.hgr-art-copy{position:absolute;left:8%;top:16%;max-width:50%}.hgr-art-copy b{display:block;margin-bottom:9px;font-size:clamp(22px,4vw,46px);line-height:1.05}.hgr-art-copy span{color:#50606d}.hgr-pin{position:absolute;z-index:3;display:grid!important;place-items:center;width:28px;min-height:28px!important;padding:0!important;border:2px solid #fff!important;border-radius:50%!important;background:var(--gr-pink)!important;color:#fff!important;font-size:10px;font-weight:900;transform:translate(-50%,-50%)}.hgr-pin.is-resolved{background:#647482!important;opacity:.7}.hgr-draft-pin{position:absolute;z-index:4;width:18px;height:18px;border-radius:50%;background:var(--gr-yellow);transform:translate(-50%,-50%);box-shadow:0 0 0 5px rgba(237,201,104,.22)}
      .hgr-side{min-width:0;background:#0d141b}.hgr-tabs{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid var(--gr-line)}.hgr-tabs button{min-width:0;border:0;border-right:1px solid var(--gr-line);border-radius:0;background:transparent;padding:10px 3px;color:var(--gr-muted);font-size:10px}.hgr-tabs button:last-child{border-right:0}.hgr-tabs button[aria-selected="true"]{color:var(--gr-cyan);box-shadow:inset 0 -2px var(--gr-cyan)}.hgr-panel{height:548px;overflow:auto;padding:11px}.hgr-card{margin-bottom:9px;padding:10px;border:1px solid var(--gr-line);border-radius:7px;background:var(--gr-panel)}.hgr-card.is-active{border-color:var(--gr-pink)}.hgr-card-head{display:flex;align-items:flex-start;gap:8px}.hgr-card-head strong{min-width:0;overflow-wrap:anywhere}.hgr-card-head small{margin-left:auto;color:var(--gr-muted);white-space:nowrap}.hgr-card p{margin:7px 0;overflow-wrap:anywhere}.hgr-card footer,.hgr-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.hgr-card footer small{margin-right:auto;color:var(--gr-muted)}.hgr-reply{margin:7px 0 0 10px;padding:7px 0 0 9px;border-left:2px solid #405667}.hgr-reply p{margin:0}.hgr-reply small{color:var(--gr-muted)}.hgr-form{display:grid;gap:8px}.hgr-empty{padding:28px 12px;text-align:center;color:var(--gr-muted)}
      .hgr-compare{display:grid;gap:10px}.hgr-preview{display:grid;gap:5px}.hgr-preview canvas{display:block;width:100%;height:180px;border:1px solid var(--gr-line);border-radius:6px;background:#0b1118}.hgr-preview span{color:var(--gr-muted);font-size:10px}.hgr-diff-list{display:grid;gap:5px}.hgr-diff{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:7px;border-left:2px solid var(--gr-cyan);background:#101a23}.hgr-diff code{min-width:0;overflow-wrap:anywhere;color:#d8e5ed}.hgr-diff small{color:var(--gr-muted)}.hgr-activity{margin:0;padding:0;list-style:none}.hgr-activity li{position:relative;padding:0 0 13px 17px;border-left:1px solid var(--gr-line)}.hgr-activity li::before{content:"";position:absolute;left:-4px;top:4px;width:7px;height:7px;border-radius:50%;background:var(--gr-cyan)}.hgr-activity b,.hgr-activity small{display:block}.hgr-activity small{color:var(--gr-muted)}.hgr-checks{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.hgr-checks label{display:flex;align-items:center;gap:5px}.hgr-checks input{width:auto}.hgr-link{overflow-wrap:anywhere;color:var(--gr-cyan);font-size:10px}.hgr-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
      @media(max-width:760px){.hgr-grid{grid-template-columns:1fr}.hgr-main{border-right:0;border-bottom:1px solid var(--gr-line)}.hgr-stage{min-height:380px}.hgr-panel{height:auto;max-height:560px}.hgr-title p{display:none}}
      @media(max-width:420px){[data-hh-graphic-review]{border-radius:0}.hgr-head{align-items:flex-start;flex-wrap:wrap}.hgr-actions{width:100%;margin-left:0}.hgr-actions button{flex:1 0 auto}.hgr-status{position:absolute;right:12px;top:12px}.hgr-steps{padding-inline:10px}.hgr-main{grid-template-rows:auto minmax(320px,1fr)}.hgr-toolbar{align-items:flex-start;flex-wrap:wrap}.hgr-toolbar span{width:100%;white-space:normal}.hgr-stage{min-height:320px;margin:8px}.hgr-artboard{inset:6% 4%}.hgr-art-copy{left:7%;top:12%;max-width:60%}.hgr-art-copy b{font-size:25px}.hgr-panel{padding:8px}.hgr-tabs button{font-size:9px}.hgr-checks{grid-template-columns:1fr}}
      @media(prefers-reduced-motion:reduce){[data-hh-graphic-review] *,[data-hh-graphic-review] *::before,[data-hh-graphic-review] *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.001ms!important}}
    `;
    doc.head.appendChild(style);
  }

  function defaultReviewInput(actor) {
    return {
      title: "Duyệt key visual chiến dịch",
      description: "Bản review cục bộ cho vòng phê duyệt thiết kế.",
      actor,
      before: { label: "Trước", data: { canvas: { width: 1200, height: 675, background: "#f5f7fa" }, layers: [{ id: "title", name: "Headline", text: "Create with clarity", x: 0.08, y: 0.18, width: 0.42, height: 0.16, fill: "#5ed0df" }] } },
      after: { label: "Sau", data: { canvas: { width: 1200, height: 675, background: "#f5f7fa" }, layers: [{ id: "title", name: "Headline", text: "Design with clarity", x: 0.08, y: 0.18, width: 0.48, height: 0.16, fill: "#f06292" }, { id: "cta", name: "CTA", text: "Khám phá", x: 0.08, y: 0.62, width: 0.2, height: 0.1, fill: "#73d39d" }] } }
    };
  }

  function downloadText(doc, text, filename, type) {
    if (!doc || !globalScope.URL || typeof globalScope.URL.createObjectURL !== "function") return false;
    const url = globalScope.URL.createObjectURL(new Blob([text], { type }));
    const anchor = doc.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    globalScope.setTimeout(() => globalScope.URL.revokeObjectURL(url), 0);
    return true;
  }

  function mount(root, options) {
    if (!root || typeof root.querySelector !== "function") return null;
    if (mounted.has(root)) return mounted.get(root);
    const settings = options || {};
    const doc = root.ownerDocument || globalScope.document;
    injectStyles(doc);
    const actor = normalizeAuthor(settings.actor);
    const store = settings.store || createStore(settings);
    let review = settings.reviewId ? store.getReview(settings.reviewId) : null;
    if (!review && settings.review) review = store.createReview({ ...settings.review, actor });
    if (!review) review = store.listReviews()[0] || store.createReview(defaultReviewInput(actor));
    let tab = "comments";
    let selectedThreadId = "";
    let pinDraft = null;
    let message = store.getPersistence().error || "";
    let messageKind = message ? "error" : "info";
    let destroyed = false;

    const current = () => store.getReview(review.id);
    const setMessage = (value, kind) => { message = cleanText(value, 1000); messageKind = kind || "info"; };
    const formatDate = (value) => {
      try { return new Date(value).toLocaleString("vi-VN"); } catch (_) { return value; }
    };
    const valuePreview = (value) => {
      const encoded = JSON.stringify(value);
      return encoded === undefined ? "—" : encoded.length > 70 ? `${encoded.slice(0, 67)}…` : encoded;
    };
    const focusAfterRender = (key) => {
      if (!key) return;
      const node = root.querySelector(`[data-hgr-focus="${key}"]`);
      if (node && typeof node.focus === "function") node.focus();
    };

    function headerTemplate(item) {
      const statusIndex = STATUSES.indexOf(item.status);
      const transitions = TRANSITIONS[item.status].map((status) => `<button type="button" class="${status === "approved" || status === "published" ? "is-primary" : ""}" data-hgr-transition="${status}">${escapeHtml(STATUS_LABELS[status])}</button>`).join("");
      return `<header class="hgr-head"><div class="hgr-title"><h2>${escapeHtml(item.title)}</h2><p>Review & Approval · lưu trên thiết bị này</p></div><span class="hgr-status" data-status="${escapeHtml(item.status)}">${escapeHtml(STATUS_LABELS[item.status])}</span><div class="hgr-actions">${transitions}<button type="button" data-hgr-export aria-label="Xuất báo cáo review">Xuất báo cáo</button></div></header><nav class="hgr-steps" aria-label="Tiến trình duyệt">${STATUSES.map((status, index) => `<span class="hgr-step ${index < statusIndex ? "is-done" : index === statusIndex ? "is-current" : ""}"><b>${index + 1}</b>${escapeHtml(STATUS_LABELS[status])}</span>`).join("")}</nav>`;
    }

    function stageTemplate(item) {
      const frameThreads = item.threads.filter((thread) => !thread.target || thread.target.kind === "frame");
      return `<main class="hgr-main"><div class="hgr-toolbar"><span>Ghim góp ý theo frame hoặc chính xác trên timeline.</span><button type="button" data-hgr-timeline-pin>Bình luận timeline</button><button type="button" data-hgr-version>Lưu phiên bản</button><b>${item.threads.filter((thread) => !thread.resolved).length} đang mở</b></div><section class="hgr-stage" data-hgr-canvas tabindex="0" role="region" aria-label="Canvas thiết kế, nhấn Enter để ghim bình luận"><div class="hgr-artboard" aria-hidden="true"><div class="hgr-art-copy"><b>Design with clarity</b><span>Review every detail before publishing.</span></div><div class="hgr-art-shape"></div></div>${frameThreads.map((thread, index) => `<button type="button" class="hgr-pin ${thread.resolved ? "is-resolved" : ""}" style="left:${thread.x * 100}%;top:${thread.y * 100}%" data-hgr-thread="${escapeHtml(thread.id)}" data-hgr-focus="pin-${escapeHtml(thread.id)}" aria-label="Mở bình luận ${index + 1}: ${escapeHtml(thread.body)}">${index + 1}</button>`).join("")}${pinDraft && pinDraft.kind !== "timeline" ? `<span class="hgr-draft-pin" style="left:${pinDraft.x * 100}%;top:${pinDraft.y * 100}%" aria-hidden="true"></span>` : ""}</section></main>`;
    }

    function commentsPanel(item) {
      const draftLabel = pinDraft?.kind === "timeline" ? `Timeline tại ${Math.round(pinDraft.timeMs / 100) / 10}s` : pinDraft ? `Frame tại ${Math.round(pinDraft.x * 100)}%, ${Math.round(pinDraft.y * 100)}%` : "";
      const draftForm = pinDraft ? `<form class="hgr-card hgr-form" data-hgr-comment-form><strong>${escapeHtml(draftLabel)}</strong>${pinDraft.kind === "timeline" ? `<label>Thời điểm (ms)<input type="number" name="timeMs" min="0" max="86400000" value="${pinDraft.timeMs}"></label>` : ""}<label>Nội dung<textarea name="body" maxlength="4000" required data-hgr-focus="comment-body"></textarea></label><div class="hgr-row"><button class="is-primary" type="submit">Ghim bình luận</button><button type="button" data-hgr-cancel-pin>Hủy</button></div></form>` : "";
      const threads = item.threads.map((thread, index) => { const target = thread.target?.kind === "timeline" ? `Timeline · ${Math.round(thread.target.timeMs / 100) / 10}s` : `Frame · ${Math.round(thread.x * 100)}%, ${Math.round(thread.y * 100)}%`; return `<article class="hgr-card ${selectedThreadId === thread.id ? "is-active" : ""}"><div class="hgr-card-head"><strong>#${index + 1} · ${escapeHtml(thread.author.name)}</strong><small>${thread.resolved ? "Đã xử lý" : "Đang mở"}</small></div><p>${escapeHtml(thread.body)}</p><small>${escapeHtml(target)}</small>${thread.replies.map((reply) => `<div class="hgr-reply"><p>${escapeHtml(reply.body)}</p><small>${escapeHtml(reply.author.name)} · ${escapeHtml(formatDate(reply.createdAt))}</small></div>`).join("")}<footer><small>${escapeHtml(formatDate(thread.createdAt))}</small><button type="button" data-hgr-resolve="${escapeHtml(thread.id)}" data-resolved="${thread.resolved}">${thread.resolved ? "Mở lại" : "Đánh dấu xong"}</button></footer><form class="hgr-form" data-hgr-reply-form="${escapeHtml(thread.id)}"><label class="hgr-sr" for="reply-${escapeHtml(thread.id)}">Phản hồi</label><textarea id="reply-${escapeHtml(thread.id)}" name="body" rows="2" maxlength="4000" placeholder="Viết phản hồi…" required></textarea><button type="submit">Trả lời</button></form></article>`; }).join("");
      return `${draftForm}${threads || `<div class="hgr-empty">Chưa có bình luận trên canvas.</div>`}`;
    }

    function comparePanel(item) {
      const changes = store.compareSnapshots(item.id);
      return `<div class="hgr-compare"><div class="hgr-preview"><span>Canvas preview trước / sau</span><canvas data-hgr-diff-canvas aria-label="So sánh canvas trước và sau"></canvas><p data-hgr-canvas-status class="hgr-link"></p></div><strong>${changes.length} thay đổi dữ liệu · ${(item.versions || []).length} phiên bản</strong><div class="hgr-row">${(item.versions || []).slice(-6).map((version) => `<span class="hgr-status">${escapeHtml(version.label)}</span>`).join("")}</div><div class="hgr-diff-list">${changes.slice(0, 100).map((change) => `<div class="hgr-diff"><code>${escapeHtml(change.path)}</code><small>${escapeHtml(change.type)}</small><span>${escapeHtml(valuePreview(change.before))} → ${escapeHtml(valuePreview(change.after))}</span></div>`).join("") || `<div class="hgr-empty">Hai snapshot giống nhau.</div>`}</div></div>`;
    }

    function activityPanel(item) {
      return `<ol class="hgr-activity">${item.activity.slice().reverse().map((entry) => `<li><b>${escapeHtml(entry.actor.name)} · ${escapeHtml(entry.type)}</b><small>#${entry.sequence} · ${escapeHtml(formatDate(entry.createdAt))}</small></li>`).join("")}</ol>`;
    }

    function sharePanel(item) {
      const links = store.listShareLinks(item.id);
      const webCrypto = Object.prototype.hasOwnProperty.call(settings, "crypto") ? settings.crypto : globalScope.crypto;
      const cryptoReady = Boolean(webCrypto && webCrypto.subtle && typeof webCrypto.getRandomValues === "function");
      return `<form class="hgr-card hgr-form" data-hgr-share-form><strong>Tạo link cục bộ</strong><label>Mật khẩu (tùy chọn)<input type="password" name="password" autocomplete="new-password" ${cryptoReady ? "" : "disabled"}></label>${cryptoReady ? "" : `<p class="hgr-link">Web Crypto/PBKDF2 không khả dụng; không thể tạo link có mật khẩu.</p>`}<label>Hết hạn<input type="datetime-local" name="expiresAt"></label><fieldset><legend>Quyền</legend><div class="hgr-checks"><label><input type="checkbox" name="view" checked disabled>Xem</label><label><input type="checkbox" name="comment">Bình luận</label><label><input type="checkbox" name="download">Tải xuống</label></div></fieldset><button type="submit" class="is-primary">Tạo link</button><small>Link chỉ tồn tại trong hồ sơ trình duyệt này, không phải link cloud công khai.</small></form>${links.map((link) => `<article class="hgr-card"><div class="hgr-card-head"><strong>${link.revokedAt ? "Đã thu hồi" : link.expiresAt && new Date(link.expiresAt) <= new Date() ? "Đã hết hạn" : "Đang hoạt động"}</strong><small>${link.passwordHash ? "Có mật khẩu" : "Không mật khẩu"}</small></div><p class="hgr-link">${escapeHtml(link.url)}</p><p>${PERMISSIONS.filter((permission) => link.permissions[permission]).map((permission) => escapeHtml(permission)).join(" · ")}</p><footer><button type="button" data-hgr-copy="${escapeHtml(link.id)}">Sao chép</button><button type="button" class="is-danger" data-hgr-revoke="${escapeHtml(link.id)}" ${link.revokedAt ? "disabled" : ""}>Thu hồi</button></footer></article>`).join("") || `<div class="hgr-empty">Chưa có link chia sẻ.</div>`}`;
    }

    function drawComparison(item) {
      const canvas = root.querySelector("[data-hgr-diff-canvas]");
      if (!canvas) return;
      const result = renderDiffPreview(canvas, item.snapshots.before, item.snapshots.after, { height: 180 });
      const status = root.querySelector("[data-hgr-canvas-status]");
      if (status) status.textContent = result.supported ? "Preview được dựng cục bộ từ dữ liệu layer." : result.reason;
    }

    function render(focusKey) {
      if (destroyed) return;
      review = current();
      const panels = { comments: commentsPanel, compare: comparePanel, activity: activityPanel, share: sharePanel };
      root.setAttribute("data-hh-graphic-review", "");
      root.innerHTML = `${headerTemplate(review)}${message ? `<div class="hgr-notice" data-kind="${escapeHtml(messageKind)}" role="status" aria-live="polite">${escapeHtml(message)}</div>` : ""}<div class="hgr-grid">${stageTemplate(review)}<aside class="hgr-side"><div class="hgr-tabs" role="tablist" aria-label="Chi tiết review">${[["comments", "Bình luận"], ["compare", "So sánh"], ["activity", "Nhật ký"], ["share", "Chia sẻ"]].map(([id, label]) => `<button type="button" role="tab" aria-selected="${tab === id}" tabindex="${tab === id ? "0" : "-1"}" data-hgr-tab="${id}" data-hgr-focus="tab-${id}">${label}</button>`).join("")}</div><div class="hgr-panel" role="tabpanel">${panels[tab](review)}</div></aside></div>`;
      if (tab === "compare") drawComparison(review);
      focusAfterRender(focusKey);
    }

    async function copyLink(linkId) {
      const link = store.listShareLinks(review.id).find((item) => item.id === linkId);
      if (!link) return;
      if (globalScope.navigator && globalScope.navigator.clipboard && typeof globalScope.navigator.clipboard.writeText === "function") {
        await globalScope.navigator.clipboard.writeText(link.url);
        setMessage("Đã sao chép link cục bộ.");
      } else {
        setMessage("Clipboard API không khả dụng. Link vẫn hiển thị để bạn chọn thủ công.", "error");
      }
    }

    const onClick = async (event) => {
      const target = event.target.closest && event.target.closest("button,[data-hgr-canvas]");
      if (!target || !root.contains(target)) return;
      try {
        if (target.dataset.hgrTab) { tab = target.dataset.hgrTab; return render(`tab-${tab}`); }
        if (target.dataset.hgrTransition) { store.transition(review.id, target.dataset.hgrTransition, actor); setMessage(`Đã chuyển sang ${STATUS_LABELS[target.dataset.hgrTransition]}.`); return render(); }
        if (target.dataset.hgrThread) { selectedThreadId = target.dataset.hgrThread; tab = "comments"; return render(`pin-${selectedThreadId}`); }
        if (target.dataset.hgrResolve) { store.resolveThread(review.id, target.dataset.hgrResolve, target.dataset.resolved === "false", actor); return render(); }
        if (target.hasAttribute("data-hgr-cancel-pin")) { pinDraft = null; return render("tab-comments"); }
        if (target.dataset.hgrRevoke) { store.revokeShareLink(target.dataset.hgrRevoke, actor); setMessage("Đã thu hồi link."); return render(); }
        if (target.dataset.hgrCopy) { await copyLink(target.dataset.hgrCopy); return render(); }
        if (target.hasAttribute("data-hgr-timeline-pin")) { pinDraft = { kind: "timeline", sequenceId: "main", timeMs: 0, x: 0.5, y: 0.5 }; tab = "comments"; return render("comment-body"); }
        if (target.hasAttribute("data-hgr-version")) { store.addVersion(review.id, { label: `Phiên bản ${new Date().toLocaleTimeString("vi-VN")}`, snapshot: review.snapshots.after }, actor); setMessage("Đã lưu phiên bản để so sánh."); return render(); }
        if (target.hasAttribute("data-hgr-export")) {
          const html = store.exportReport(review.id, "html");
          const downloaded = downloadText(doc, html, `${review.title.replace(/[^a-z0-9]+/gi, "-") || "review"}-report.html`, "text/html;charset=utf-8");
          setMessage(downloaded ? "Đã xuất báo cáo review." : "Tải file không được hỗ trợ trong môi trường này.", downloaded ? "info" : "error");
          return render();
        }
        if (target.hasAttribute("data-hgr-canvas")) {
          pinDraft = { kind: "frame", frameId: "canvas", ...positionFromEvent(event, target) };
          tab = "comments";
          return render("comment-body");
        }
      } catch (error) { setMessage(error.message, "error"); render(); }
    };

    const onSubmit = async (event) => {
      event.preventDefault();
      try {
        if (event.target.matches("[data-hgr-comment-form]")) {
          const form = new FormData(event.target);
          const thread = store.addThread(review.id, { ...pinDraft, timeMs: pinDraft.kind === "timeline" ? form.get("timeMs") : undefined, body: form.get("body") }, actor);
          selectedThreadId = thread.id;
          pinDraft = null;
          setMessage("Đã ghim bình luận lên canvas.");
          return render(`pin-${thread.id}`);
        }
        if (event.target.matches("[data-hgr-reply-form]")) {
          const form = new FormData(event.target);
          store.addReply(review.id, event.target.dataset.hgrReplyForm, { body: form.get("body") }, actor);
          setMessage("Đã thêm phản hồi.");
          return render();
        }
        if (event.target.matches("[data-hgr-share-form]")) {
          const form = new FormData(event.target);
          const expiryValue = form.get("expiresAt");
          await store.createShareLink(review.id, {
            password: form.get("password"),
            expiresAt: expiryValue ? new Date(expiryValue).toISOString() : null,
            permissions: { view: true, comment: form.has("comment"), download: form.has("download") }
          }, actor);
          setMessage("Đã tạo link cục bộ. Mật khẩu chỉ được lưu dưới dạng PBKDF2 hash.");
          return render();
        }
      } catch (error) { setMessage(error.message, "error"); render(); }
    };

    const onKeydown = (event) => {
      const stage = event.target.closest && event.target.closest("[data-hgr-canvas]");
      if (stage && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        pinDraft = { kind: "frame", frameId: "canvas", x: 0.5, y: 0.5 };
        tab = "comments";
        return render("comment-body");
      }
      if (event.key === "Escape" && pinDraft) { pinDraft = null; render("tab-comments"); return; }
      const activeTab = event.target.closest && event.target.closest("[data-hgr-tab]");
      if (activeTab && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        const index = ["comments", "compare", "activity", "share"].indexOf(activeTab.dataset.hgrTab);
        tab = ["comments", "compare", "activity", "share"][(index + (event.key === "ArrowRight" ? 1 : 3)) % 4];
        render(`tab-${tab}`);
      }
    };

    root.addEventListener("click", onClick);
    root.addEventListener("submit", onSubmit);
    root.addEventListener("keydown", onKeydown);
    render();

    const controller = Object.freeze({
      store,
      getReview: () => current(),
      render,
      setTab(nextTab) { if (["comments", "compare", "activity", "share"].includes(nextTab)) { tab = nextTab; render(); } },
      destroy() {
        destroyed = true;
        root.removeEventListener("click", onClick);
        root.removeEventListener("submit", onSubmit);
        root.removeEventListener("keydown", onKeydown);
        root.replaceChildren();
        root.removeAttribute("data-hh-graphic-review");
        mounted.delete(root);
      }
    });
    mounted.set(root, controller);
    return controller;
  }

  function unmount(root) {
    const controller = mounted.get(root);
    if (!controller) return false;
    controller.destroy();
    return true;
  }

  const api = Object.freeze({
    VERSION, STORAGE_KEY, FORMAT, STATUSES, STATUS_LABELS, TRANSITIONS, PERMISSIONS, ROLES, ROLE_CAPABILITIES,
    escapeHtml, normalizePoint, normalizeCommentTarget, positionFromEvent, normalizeRole, canRole, canTransition, diffData,
    renderSnapshotPreview, renderDiffPreview, hashPassword, verifyPassword,
    normalizePermissions, createStore, mount, unmount
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.HHGraphicReview = api;
}(typeof globalThis !== "undefined" ? globalThis : this));
