(function (globalScope, factory) {
  "use strict";
  const api = factory(globalScope);
  if (typeof module === "object" && module.exports) module.exports = api;
  globalScope.HHCreativeCollaborationOS = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (globalScope) {
  "use strict";

  const VERSION = 1;
  const STORAGE_KEY = "hh.creative-collaboration.v1";
  const FORMAT = "hh-creative-collaboration-report";
  const STATUSES = Object.freeze(["draft", "review", "approved", "published"]);
  const TRANSITIONS = Object.freeze({
    draft: Object.freeze(["review"]),
    review: Object.freeze(["draft", "approved"]),
    approved: Object.freeze(["review", "published"]),
    published: Object.freeze([])
  });
  const LIMITS = Object.freeze({
    projects: 20,
    threads: 200,
    replies: 80,
    chat: 300,
    presence: 30,
    locks: 120,
    changes: 250,
    audit: 600,
    title: 160,
    comment: 4000,
    message: 3000,
    reason: 800,
    snapshotBytes: 750000,
    changeBytes: 50000,
    auditDetailsBytes: 20000
  });
  const SOCKET_EVENTS = Object.freeze({
    JOIN: "creative:join",
    LEAVE: "creative:leave",
    PRESENCE: "creative:presence",
    CURSOR: "creative:cursor",
    CHAT: "creative:chat",
    LOCK: "creative:lock",
    UNLOCK: "creative:lock-release",
    CHANGE: "creative:change",
    DECISION: "creative:change-decision",
    REVIEW: "creative:review"
  });
  const instances = typeof WeakMap === "function" ? new WeakMap() : new Map();

  function clone(value) {
    if (value == null) return value;
    if (typeof structuredClone === "function") {
      try { return structuredClone(value); } catch (_) { /* JSON fallback */ }
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
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, Math.max(0, maxLength || 1000));
  }

  function normalizeSocketUrl(value) {
    const requested = cleanText(value, 500);
    if (!requested || typeof URL !== "function") return "";
    try {
      const parsed = new URL(requested);
      const localHost = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname);
      if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && localHost)) return "";
      return parsed.origin;
    } catch (_) { return ""; }
  }

  function clamp(value, min, max) {
    const parsed = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : min));
  }

  function safeTimestamp(value, fallback) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
  }

  function makeId(prefix) {
    if (globalScope.crypto && typeof globalScope.crypto.randomUUID === "function") {
      return `${prefix}-${globalScope.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function createError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function bounded(items, limit) {
    return Array.isArray(items) ? items.slice(Math.max(0, items.length - limit)) : [];
  }

  function byteLength(value) {
    let json;
    try { json = JSON.stringify(value == null ? null : value); }
    catch (_) { return Number.POSITIVE_INFINITY; }
    if (json === undefined) json = "undefined";
    if (typeof TextEncoder === "function") return new TextEncoder().encode(json).length;
    return unescape(encodeURIComponent(json)).length;
  }

  function publicUser(input) {
    const user = input && typeof input === "object" ? input : {};
    const requestedId = cleanText(user.id || user._id || user.uid, 120);
    const id = !requestedId || ["__proto__", "prototype", "constructor"].includes(requestedId) ? "local-user" : requestedId;
    return {
      id,
      name: cleanText(user.name || user.displayName || "Người dùng cục bộ", 100),
      avatar: cleanText(user.avatar || user.photoURL, 500),
      color: /^#[0-9a-f]{6}$/i.test(String(user.color || "")) ? String(user.color) : "#62d7e7"
    };
  }

  function normalizePoint(point) {
    const value = point && typeof point === "object" ? point : {};
    return {
      x: Number(clamp(value.x, 0, 1).toFixed(6)),
      y: Number(clamp(value.y, 0, 1).toFixed(6))
    };
  }

  function normalizeTimecode(value) {
    const text = cleanText(value, 20);
    if (!text) return "00:00:00:00";
    const parts = text.split(":").map((part) => clamp(parseInt(part, 10) || 0, 0, 99));
    while (parts.length < 4) parts.unshift(0);
    return parts.slice(-4).map((part) => String(part).padStart(2, "0")).join(":");
  }

  function normalizeSnapshot(input, label) {
    const source = input && typeof input === "object" ? input : {};
    const data = Object.prototype.hasOwnProperty.call(source, "data") ? source.data : source;
    if (byteLength(data) > LIMITS.snapshotBytes) throw createError("SNAPSHOT_TOO_LARGE", "Snapshot vượt giới hạn an toàn 750 KB.");
    return {
      id: cleanText(source.id, 140) || makeId("snapshot"),
      label: cleanText(source.label, 120) || label,
      createdAt: safeTimestamp(source.createdAt, new Date().toISOString()),
      data: clone(data || {})
    };
  }

  function diffData(before, after) {
    const changes = [];
    function visit(left, right, path, depth) {
      if (Object.is(left, right)) return;
      if (changes.length >= LIMITS.changes) return;
      if (depth > 30) {
        changes.push({ path, type: "changed", before: "[depth-limit]", after: "[depth-limit]" });
        return;
      }
      const leftObject = left && typeof left === "object";
      const rightObject = right && typeof right === "object";
      if (leftObject && rightObject && Array.isArray(left) === Array.isArray(right)) {
        const keys = Array.isArray(left)
          ? Array.from({ length: Math.max(left.length, right.length) }, (_, index) => index)
          : Array.from(new Set(Object.keys(left).concat(Object.keys(right)))).sort();
        keys.forEach((key) => {
          const nextPath = Array.isArray(left) ? `${path}[${key}]` : `${path}.${key}`;
          if (!Object.prototype.hasOwnProperty.call(left, key)) {
            changes.push({ path: nextPath, type: "added", before: undefined, after: clone(right[key]) });
          } else if (!Object.prototype.hasOwnProperty.call(right, key)) {
            changes.push({ path: nextPath, type: "removed", before: clone(left[key]), after: undefined });
          } else visit(left[key], right[key], nextPath, depth + 1);
        });
        return;
      }
      changes.push({
        path,
        type: left === undefined ? "added" : right === undefined ? "removed" : "changed",
        before: clone(left),
        after: clone(right)
      });
    }
    visit(before, after, "$", 0);
    return changes.slice(0, LIMITS.changes);
  }

  function canTransition(from, to) {
    return Boolean(TRANSITIONS[from] && TRANSITIONS[from].includes(to));
  }

  function defaultProject(projectId, actor, now) {
    const timestamp = now();
    const before = normalizeSnapshot({ data: {
      canvas: { width: 1920, height: 1080, background: "#101827" },
      layers: [{ id: "title", name: "Tiêu đề", text: "Creative OS", x: 0.08, y: 0.12, width: 0.52, height: 0.16, fill: "#62d7e7" }]
    } }, "Phiên bản trước");
    const after = normalizeSnapshot({ data: {
      canvas: { width: 1920, height: 1080, background: "#121021" },
      layers: [
        { id: "title", name: "Tiêu đề", text: "Creative OS Review", x: 0.08, y: 0.12, width: 0.62, height: 0.16, fill: "#fc5caf" },
        { id: "cta", name: "CTA", text: "Khám phá", x: 0.08, y: 0.68, width: 0.22, height: 0.1, fill: "#f6d365" }
      ]
    } }, "Phiên bản hiện tại");
    return {
      id: cleanText(projectId, 120) || "creative-main",
      title: "Chiến dịch Creative OS",
      status: "draft",
      requestChanges: null,
      snapshots: { before, after },
      threads: [],
      chat: [],
      presence: [{ ...publicUser(actor), online: true, lastSeenAt: timestamp }],
      cursors: {},
      locks: [],
      timelineChanges: [],
      audit: [],
      createdAt: timestamp,
      updatedAt: timestamp
    };
  }

  function normalizeEnvelope(input, actor, now) {
    const source = input && typeof input === "object" ? input : {};
    const projects = Array.isArray(source.projects) ? source.projects.slice(-LIMITS.projects) : [];
    return {
      version: VERSION,
      projects: projects.map((project) => normalizeProject(project, actor, now)),
      activeProjectId: cleanText(source.activeProjectId, 120),
      savedAt: safeTimestamp(source.savedAt, now())
    };
  }

  function normalizeProject(project, actor, now) {
    const fallback = defaultProject(project && project.id, actor, now);
    const source = project && typeof project === "object" ? project : {};
    const status = STATUSES.includes(source.status) ? source.status : "draft";
    const snapshots = source.snapshots && typeof source.snapshots === "object" ? source.snapshots : fallback.snapshots;
    const threads = bounded(source.threads, LIMITS.threads).map((thread) => ({
      id: cleanText(thread && thread.id, 180) || makeId("thread"),
      frame: Math.round(clamp(thread && thread.frame, 0, 999999)),
      timecode: normalizeTimecode(thread && thread.timecode),
      ...normalizePoint(thread),
      body: cleanText(thread && thread.body, LIMITS.comment),
      author: publicUser(thread && thread.author),
      replies: bounded(thread && thread.replies, LIMITS.replies).map((reply) => ({
        id: cleanText(reply && reply.id, 180) || makeId("reply"),
        body: cleanText(reply && reply.body, LIMITS.comment),
        author: publicUser(reply && reply.author),
        createdAt: safeTimestamp(reply && reply.createdAt, now())
      })),
      resolved: Boolean(thread && thread.resolved),
      createdAt: safeTimestamp(thread && thread.createdAt, now()),
      updatedAt: safeTimestamp(thread && thread.updatedAt, now())
    }));
    const chat = bounded(source.chat, LIMITS.chat).map((message) => ({
      id: cleanText(message && message.id, 180) || makeId("message"),
      body: cleanText(message && message.body, LIMITS.message),
      author: publicUser(message && message.author),
      createdAt: safeTimestamp(message && message.createdAt, now())
    }));
    const presence = bounded(source.presence, LIMITS.presence).map((member) => ({
      ...publicUser(member),
      online: Boolean(member && member.online),
      lastSeenAt: safeTimestamp(member && member.lastSeenAt, now())
    }));
    const locks = bounded(source.locks, LIMITS.locks).map((lock) => ({
      id: cleanText(lock && lock.id, 180) || makeId("lock"),
      targetId: cleanText(lock && lock.targetId, 180),
      targetType: lock && lock.targetType === "scene" ? "scene" : "layer",
      owner: publicUser(lock && lock.owner),
      createdAt: safeTimestamp(lock && lock.createdAt, now())
    })).filter((lock) => lock.targetId);
    const timelineChanges = bounded(source.timelineChanges, LIMITS.changes).map((change) => ({
      id: cleanText(change && change.id, 180) || makeId("change"),
      path: cleanText(change && change.path, 300),
      before: byteLength(change && change.before) <= LIMITS.changeBytes ? clone(change && change.before) : "[size-limit]",
      after: byteLength(change && change.after) <= LIMITS.changeBytes ? clone(change && change.after) : "[size-limit]",
      summary: cleanText(change && change.summary, 240),
      status: ["pending", "accepted", "rejected"].includes(change && change.status) ? change.status : "pending",
      author: publicUser(change && change.author),
      createdAt: safeTimestamp(change && change.createdAt, now()),
      decidedAt: change && change.decidedAt ? safeTimestamp(change.decidedAt, null) : null,
      decidedBy: change && change.decidedBy ? publicUser(change.decidedBy) : null
    })).filter((change) => change.path);
    const audit = [];
    bounded(source.audit, LIMITS.audit).forEach((entry, index) => {
      audit.push({
        id: cleanText(entry && entry.id, 180) || makeId("audit"),
        sequence: index + 1,
        previousId: index ? audit[index - 1].id : null,
        type: cleanText(entry && entry.type, 100),
        actor: publicUser(entry && entry.actor),
        details: byteLength(entry && entry.details || {}) <= LIMITS.auditDetailsBytes ? clone(entry && entry.details || {}) : { truncated: true },
        createdAt: safeTimestamp(entry && entry.createdAt, now())
      });
    });
    const cursors = {};
    Object.values(source.cursors && typeof source.cursors === "object" ? source.cursors : {}).slice(-LIMITS.presence).forEach((cursor) => {
      const identity = publicUser(cursor && cursor.user);
      cursors[identity.id] = {
        user: identity,
        ...normalizePoint(cursor),
        context: cleanText(cursor && cursor.context, 120),
        updatedAt: safeTimestamp(cursor && cursor.updatedAt, now())
      };
    });
    return {
      ...fallback,
      id: cleanText(source.id, 120) || fallback.id,
      title: cleanText(source.title, LIMITS.title) || fallback.title,
      status,
      requestChanges: source.requestChanges ? {
        reason: cleanText(source.requestChanges.reason, LIMITS.reason),
        actor: publicUser(source.requestChanges.actor),
        createdAt: safeTimestamp(source.requestChanges.createdAt, now())
      } : null,
      snapshots: {
        before: normalizeSnapshot(snapshots.before || fallback.snapshots.before, "Phiên bản trước"),
        after: normalizeSnapshot(snapshots.after || fallback.snapshots.after, "Phiên bản hiện tại")
      },
      threads,
      chat,
      presence,
      cursors,
      locks,
      timelineChanges,
      audit,
      createdAt: safeTimestamp(source.createdAt, fallback.createdAt),
      updatedAt: safeTimestamp(source.updatedAt, fallback.updatedAt)
    };
  }

  function createStore(options) {
    const settings = options || {};
    const storage = Object.prototype.hasOwnProperty.call(settings, "storage")
      ? settings.storage
      : globalScope.localStorage;
    const currentUser = publicUser(settings.currentUser);
    const now = typeof settings.now === "function" ? settings.now : () => new Date().toISOString();
    const idFactory = typeof settings.idFactory === "function" ? settings.idFactory : makeId;
    const listeners = new Set();
    let persistenceError = "";
    let state;

    try {
      const stored = storage && storage.getItem ? JSON.parse(storage.getItem(STORAGE_KEY) || "null") : null;
      state = normalizeEnvelope(settings.initialState || stored, currentUser, now);
    } catch (error) {
      persistenceError = cleanText(error && error.message, 300) || "Không đọc được dữ liệu cục bộ.";
      state = normalizeEnvelope(settings.initialState, currentUser, now);
    }
    const requestedProjectId = cleanText(settings.projectId, 120);
    let requestedProject = requestedProjectId ? state.projects.find((project) => project.id === requestedProjectId) : null;
    if (requestedProjectId && !requestedProject && state.projects.length < LIMITS.projects) {
      requestedProject = defaultProject(requestedProjectId, currentUser, now);
      requestedProject.title = cleanText(settings.projectTitle, LIMITS.title) || requestedProject.title;
      state.projects.push(requestedProject);
      state.activeProjectId = requestedProject.id;
    } else if (requestedProject) {
      state.activeProjectId = requestedProject.id;
      if (settings.projectTitle && requestedProject.title === "Chiến dịch Creative OS") requestedProject.title = cleanText(settings.projectTitle, LIMITS.title);
    } else if (!state.projects.length) {
      const project = defaultProject(requestedProjectId || "creative-main", currentUser, now);
      project.title = cleanText(settings.projectTitle, LIMITS.title) || project.title;
      state.projects.push(project);
      state.activeProjectId = project.id;
    }
    if (!state.projects.some((project) => project.id === state.activeProjectId)) state.activeProjectId = state.projects[0].id;

    function notifyListeners() {
      const snapshot = clone(state);
      listeners.forEach((listener) => {
        try { listener(snapshot); } catch (_) { /* isolate consumers */ }
      });
    }

    function persist() {
      state.savedAt = now();
      try {
        if (storage && storage.setItem) storage.setItem(STORAGE_KEY, JSON.stringify(state));
        persistenceError = "";
      } catch (error) {
        persistenceError = cleanText(error && error.message, 300) || "Không lưu được dữ liệu cục bộ.";
      }
      notifyListeners();
    }

    function projectRef(projectId) {
      const id = cleanText(projectId || state.activeProjectId, 120);
      const project = state.projects.find((item) => item.id === id);
      if (!project) throw createError("PROJECT_NOT_FOUND", "Không tìm thấy dự án Creative OS.");
      return project;
    }

    function appendAudit(project, type, actor, details) {
      const previous = project.audit[project.audit.length - 1] || null;
      const entry = {
        id: idFactory("audit"),
        sequence: previous ? previous.sequence + 1 : 1,
        previousId: previous ? previous.id : null,
        type: cleanText(type, 100),
        actor: publicUser(actor || currentUser),
        details: clone(details || {}),
        createdAt: now()
      };
      project.audit = bounded(project.audit.concat(entry), LIMITS.audit);
      project.updatedAt = entry.createdAt;
      return entry;
    }

    function ensureEditable(project) {
      if (project.status === "approved" || project.status === "published") {
        throw createError("REVIEW_LOCKED", "Bản đã duyệt hoặc xuất bản đang được khóa.");
      }
    }

    function ensureText(value, limit, code, message) {
      const result = cleanText(value, limit);
      if (!result) throw createError(code, message);
      return result;
    }

    const api = {
      getState() { return clone(state); },
      getProject(projectId) { return clone(projectRef(projectId)); },
      getPersistence() { return { type: storage && storage.setItem ? "localStorage" : "memory", key: STORAGE_KEY, version: VERSION, error: persistenceError }; },
      subscribe(listener) {
        if (typeof listener !== "function") return function () {};
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      setActiveProject(projectId) {
        projectRef(projectId);
        state.activeProjectId = cleanText(projectId, 120);
        persist();
        return api.getProject(projectId);
      },
      createProject(input, actor) {
        if (state.projects.length >= LIMITS.projects) throw createError("PROJECT_LIMIT", "Đã đạt giới hạn dự án cục bộ.");
        const source = input && typeof input === "object" ? input : {};
        const project = defaultProject(source.id || idFactory("project"), actor || currentUser, now);
        project.title = cleanText(source.title, LIMITS.title) || "Dự án sáng tạo mới";
        if (source.before || source.after) {
          project.snapshots = {
            before: normalizeSnapshot(source.before || {}, "Phiên bản trước"),
            after: normalizeSnapshot(source.after || {}, "Phiên bản hiện tại")
          };
        }
        appendAudit(project, "project.created", actor, { title: project.title });
        state.projects.push(project);
        state.activeProjectId = project.id;
        persist();
        return clone(project);
      },
      updateSnapshots(projectId, snapshots, actor) {
        const project = projectRef(projectId);
        ensureEditable(project);
        const source = snapshots && typeof snapshots === "object" ? snapshots : {};
        project.snapshots = {
          before: normalizeSnapshot(source.before || project.snapshots.before, "Phiên bản trước"),
          after: normalizeSnapshot(source.after || project.snapshots.after, "Phiên bản hiện tại")
        };
        const changes = diffData(project.snapshots.before.data, project.snapshots.after.data);
        appendAudit(project, "review.snapshots-updated", actor, { changes: changes.length });
        persist();
        return changes;
      },
      compare(projectId) {
        const project = projectRef(projectId);
        return diffData(project.snapshots.before.data, project.snapshots.after.data);
      },
      addThread(projectId, input, actor) {
        const project = projectRef(projectId);
        if (project.threads.length >= LIMITS.threads) throw createError("THREAD_LIMIT", "Đã đạt giới hạn luồng bình luận.");
        const source = input && typeof input === "object" ? input : {};
        const requestedId = cleanText(source.id, 180);
        const existing = requestedId && project.threads.find((item) => item.id === requestedId);
        if (existing) return clone(existing);
        const point = normalizePoint(source.point || source);
        const thread = {
          id: requestedId || idFactory("thread"),
          frame: Math.round(clamp(source.frame, 0, 999999)),
          timecode: normalizeTimecode(source.timecode),
          x: point.x,
          y: point.y,
          body: ensureText(source.body, LIMITS.comment, "COMMENT_REQUIRED", "Hãy nhập nội dung bình luận."),
          author: publicUser(actor || currentUser),
          replies: [],
          resolved: false,
          createdAt: now(),
          updatedAt: now()
        };
        project.threads.push(thread);
        appendAudit(project, "review.thread-created", actor, { threadId: thread.id, frame: thread.frame, timecode: thread.timecode });
        persist();
        return clone(thread);
      },
      addReply(projectId, threadId, input, actor) {
        const project = projectRef(projectId);
        const thread = project.threads.find((item) => item.id === cleanText(threadId, 160));
        if (!thread) throw createError("THREAD_NOT_FOUND", "Không tìm thấy luồng bình luận.");
        if (thread.replies.length >= LIMITS.replies) throw createError("REPLY_LIMIT", "Luồng đã đạt giới hạn phản hồi.");
        const requestedId = cleanText(input && input.id, 180);
        const existing = requestedId && thread.replies.find((item) => item.id === requestedId);
        if (existing) return clone(existing);
        const reply = {
          id: requestedId || idFactory("reply"),
          body: ensureText(input && input.body, LIMITS.comment, "COMMENT_REQUIRED", "Hãy nhập nội dung phản hồi."),
          author: publicUser(actor || currentUser),
          createdAt: now()
        };
        thread.replies.push(reply);
        thread.updatedAt = reply.createdAt;
        appendAudit(project, "review.reply-created", actor, { threadId: thread.id, replyId: reply.id });
        persist();
        return clone(reply);
      },
      resolveThread(projectId, threadId, resolved, actor) {
        const project = projectRef(projectId);
        const thread = project.threads.find((item) => item.id === cleanText(threadId, 160));
        if (!thread) throw createError("THREAD_NOT_FOUND", "Không tìm thấy luồng bình luận.");
        thread.resolved = resolved !== false;
        thread.updatedAt = now();
        appendAudit(project, thread.resolved ? "review.thread-resolved" : "review.thread-reopened", actor, { threadId: thread.id });
        persist();
        return clone(thread);
      },
      transition(projectId, nextStatus, actor) {
        const project = projectRef(projectId);
        const next = cleanText(nextStatus, 30).toLowerCase();
        if (!STATUSES.includes(next) || !canTransition(project.status, next)) {
          throw createError("INVALID_TRANSITION", `Không thể chuyển từ ${project.status} sang ${next || "trạng thái rỗng"}.`);
        }
        if (next === "approved" && project.threads.some((thread) => !thread.resolved)) {
          throw createError("OPEN_THREADS", "Hãy xử lý toàn bộ bình luận trước khi duyệt.");
        }
        const previous = project.status;
        project.status = next;
        project.requestChanges = null;
        appendAudit(project, "review.status-changed", actor, { before: previous, after: next, locked: next === "approved" || next === "published" });
        persist();
        return clone(project);
      },
      requestChanges(projectId, reason, actor) {
        const project = projectRef(projectId);
        if (project.status !== "review" && project.status !== "approved") {
          throw createError("INVALID_TRANSITION", "Chỉ có thể yêu cầu sửa khi đang review hoặc đã duyệt.");
        }
        const previous = project.status;
        project.status = previous === "approved" ? "review" : "draft";
        project.requestChanges = {
          reason: ensureText(reason, LIMITS.reason, "REASON_REQUIRED", "Hãy nhập lý do yêu cầu chỉnh sửa."),
          actor: publicUser(actor || currentUser),
          createdAt: now()
        };
        appendAudit(project, "review.changes-requested", actor, { before: previous, after: project.status, reason: project.requestChanges.reason });
        persist();
        return clone(project);
      },
      setPresence(projectId, user, online) {
        const project = projectRef(projectId);
        const identity = publicUser(user);
        const existing = project.presence.find((item) => item.id === identity.id);
        const next = { ...identity, online: online !== false, lastSeenAt: now() };
        if (existing) Object.assign(existing, next);
        else project.presence.push(next);
        project.presence = bounded(project.presence, LIMITS.presence);
        persist();
        return clone(next);
      },
      setCursor(projectId, user, point, context) {
        const project = projectRef(projectId);
        const identity = publicUser(user);
        const cursor = {
          user: identity,
          ...normalizePoint(point),
          context: cleanText(context, 120),
          updatedAt: now()
        };
        project.cursors[identity.id] = cursor;
        const keys = Object.keys(project.cursors);
        if (keys.length > LIMITS.presence) keys.slice(0, keys.length - LIMITS.presence).forEach((key) => delete project.cursors[key]);
        notifyListeners();
        return clone(cursor);
      },
      addChat(projectId, input, actor) {
        const project = projectRef(projectId);
        const source = input && typeof input === "object" ? input : {};
        const requestedId = cleanText(source.id, 180);
        const existing = requestedId && project.chat.find((item) => item.id === requestedId);
        if (existing) return clone(existing);
        const message = {
          id: requestedId || idFactory("message"),
          body: ensureText(source.body, LIMITS.message, "MESSAGE_REQUIRED", "Hãy nhập tin nhắn dự án."),
          author: publicUser(actor || currentUser),
          createdAt: now()
        };
        project.chat = bounded(project.chat.concat(message), LIMITS.chat);
        appendAudit(project, "collaboration.chat-sent", actor, { messageId: message.id });
        persist();
        return clone(message);
      },
      acquireLock(projectId, input, actor) {
        const project = projectRef(projectId);
        const source = input && typeof input === "object" ? input : {};
        const targetId = ensureText(source.targetId, 180, "LOCK_TARGET_REQUIRED", "Hãy chọn layer hoặc scene cần khóa.");
        const targetType = source.targetType === "scene" ? "scene" : "layer";
        const identity = publicUser(actor || currentUser);
        const requestedId = cleanText(source.id, 180);
        const existing = project.locks.find((lock) => (requestedId && lock.id === requestedId) || (lock.targetId === targetId && lock.targetType === targetType));
        if (existing && existing.owner.id !== identity.id) throw createError("LOCK_CONFLICT", `${targetType} đang được ${existing.owner.name} sử dụng.`);
        if (existing) return clone(existing);
        const lock = { id: requestedId || idFactory("lock"), targetId, targetType, owner: identity, createdAt: now() };
        project.locks = bounded(project.locks.concat(lock), LIMITS.locks);
        appendAudit(project, "collaboration.lock-acquired", actor, { lockId: lock.id, targetId, targetType });
        persist();
        return clone(lock);
      },
      releaseLock(projectId, lockId, actor, force) {
        const project = projectRef(projectId);
        const identity = publicUser(actor || currentUser);
        const index = project.locks.findIndex((lock) => lock.id === cleanText(lockId, 180));
        if (index < 0) throw createError("LOCK_NOT_FOUND", "Không tìm thấy khóa.");
        const lock = project.locks[index];
        if (!force && lock.owner.id !== identity.id) throw createError("LOCK_OWNER_REQUIRED", "Chỉ chủ sở hữu khóa mới có thể mở khóa.");
        project.locks.splice(index, 1);
        appendAudit(project, "collaboration.lock-released", actor, { lockId: lock.id, targetId: lock.targetId, forced: Boolean(force) });
        persist();
        return clone(lock);
      },
      addTimelineChange(projectId, input, actor) {
        const project = projectRef(projectId);
        ensureEditable(project);
        const source = input && typeof input === "object" ? input : {};
        if (byteLength(source.before) > LIMITS.changeBytes || byteLength(source.after) > LIMITS.changeBytes) {
          throw createError("CHANGE_TOO_LARGE", "Thay đổi timeline vượt giới hạn an toàn 50 KB.");
        }
        const requestedId = cleanText(source.id, 180);
        const existing = requestedId && project.timelineChanges.find((item) => item.id === requestedId);
        if (existing) return clone(existing);
        const change = {
          id: requestedId || idFactory("change"),
          path: ensureText(source.path, 300, "CHANGE_PATH_REQUIRED", "Thiếu đường dẫn thay đổi."),
          before: clone(source.before),
          after: clone(source.after),
          summary: cleanText(source.summary, 240) || "Thay đổi timeline",
          status: "pending",
          author: publicUser(actor || currentUser),
          createdAt: now(),
          decidedAt: null,
          decidedBy: null
        };
        project.timelineChanges = bounded(project.timelineChanges.concat(change), LIMITS.changes);
        appendAudit(project, "collaboration.change-proposed", actor, { changeId: change.id, path: change.path });
        persist();
        return clone(change);
      },
      decideTimelineChange(projectId, changeId, decision, actor) {
        const project = projectRef(projectId);
        ensureEditable(project);
        const change = project.timelineChanges.find((item) => item.id === cleanText(changeId, 180));
        if (!change) throw createError("CHANGE_NOT_FOUND", "Không tìm thấy thay đổi timeline.");
        if (change.status !== "pending") throw createError("CHANGE_DECIDED", "Thay đổi đã được xử lý.");
        if (decision !== "accepted" && decision !== "rejected") throw createError("INVALID_DECISION", "Quyết định không hợp lệ.");
        change.status = decision;
        change.decidedAt = now();
        change.decidedBy = publicUser(actor || currentUser);
        appendAudit(project, `collaboration.change-${decision}`, actor, { changeId: change.id, path: change.path });
        persist();
        return clone(change);
      },
      applyRemote(projectId, eventName, payload) {
        const project = projectRef(projectId);
        const source = payload && typeof payload === "object" ? payload : {};
        if (eventName === SOCKET_EVENTS.PRESENCE) return api.setPresence(project.id, source.user, source.online);
        if (eventName === SOCKET_EVENTS.CURSOR) return api.setCursor(project.id, source.user, source.point, source.context);
        if (eventName === SOCKET_EVENTS.CHAT) return api.addChat(project.id, source, source.user || source.author);
        if (eventName === SOCKET_EVENTS.LOCK) return api.acquireLock(project.id, source, source.user);
        if (eventName === SOCKET_EVENTS.UNLOCK) {
          const existing = project.locks.find((lock) => lock.id === cleanText(source.lockId, 180));
          return existing ? api.releaseLock(project.id, existing.id, source.user, Boolean(source.force)) : null;
        }
        if (eventName === SOCKET_EVENTS.CHANGE) return api.addTimelineChange(project.id, source, source.user);
        if (eventName === SOCKET_EVENTS.DECISION) {
          const change = project.timelineChanges.find((item) => item.id === cleanText(source.changeId, 180));
          if (!change || change.status === source.decision) return change ? clone(change) : null;
          return api.decideTimelineChange(project.id, source.changeId, source.decision, source.user);
        }
        if (eventName === SOCKET_EVENTS.REVIEW) {
          if (source.action === "thread-created" && source.thread) return api.addThread(project.id, source.thread, source.user || source.thread.author);
          if (source.action === "reply-created" && source.reply) return api.addReply(project.id, source.threadId, source.reply, source.user || source.reply.author);
          if (source.action === "thread") {
            const thread = project.threads.find((item) => item.id === cleanText(source.threadId, 180));
            if (!thread || thread.resolved === Boolean(source.resolved)) return thread ? clone(thread) : null;
            return api.resolveThread(project.id, thread.id, Boolean(source.resolved), source.user);
          }
          if (source.action === "status") {
            if (project.status === source.status) return clone(project);
            return api.transition(project.id, source.status, source.user);
          }
          if (source.action === "changes-requested") {
            if (project.requestChanges && project.requestChanges.reason === cleanText(source.reason, LIMITS.reason)) return clone(project);
            return api.requestChanges(project.id, source.reason, source.user);
          }
        }
        return null;
      },
      getAudit(projectId) { return clone(projectRef(projectId).audit); },
      exportReport(projectId, format) {
        const project = projectRef(projectId);
        const changes = diffData(project.snapshots.before.data, project.snapshots.after.data);
        const report = {
          format: FORMAT,
          version: VERSION,
          generatedAt: now(),
          project: clone(project),
          summary: {
            status: project.status,
            openThreads: project.threads.filter((thread) => !thread.resolved).length,
            changes: changes.length,
            pendingTimelineChanges: project.timelineChanges.filter((change) => change.status === "pending").length
          },
          changes
        };
        if (String(format).toLowerCase() !== "html") return JSON.stringify(report, null, 2);
        const threadRows = project.threads.map((thread) => `<tr><td>${escapeHtml(thread.timecode)}</td><td>${escapeHtml(thread.author.name)}</td><td>${escapeHtml(thread.body)}</td><td>${thread.resolved ? "Đã xử lý" : "Đang mở"}</td></tr>`).join("");
        const diffRows = changes.map((change) => `<tr><td>${escapeHtml(change.path)}</td><td>${escapeHtml(change.type)}</td><td><code>${escapeHtml(JSON.stringify(change.before))}</code></td><td><code>${escapeHtml(JSON.stringify(change.after))}</code></td></tr>`).join("");
        return `<!doctype html><html lang="vi"><meta charset="utf-8"><title>${escapeHtml(project.title)} - Review report</title><style>body{font:14px system-ui;margin:32px;color:#17202a}table{border-collapse:collapse;width:100%;margin:16px 0}th,td{border:1px solid #ccd5df;padding:8px;text-align:left;vertical-align:top}code{white-space:pre-wrap;word-break:break-word}</style><h1>${escapeHtml(project.title)}</h1><p>Trạng thái: <strong>${escapeHtml(project.status)}</strong></p><h2>Bình luận</h2><table><thead><tr><th>Timecode</th><th>Người gửi</th><th>Nội dung</th><th>Trạng thái</th></tr></thead><tbody>${threadRows}</tbody></table><h2>Before / After</h2><table><thead><tr><th>Đường dẫn</th><th>Loại</th><th>Trước</th><th>Sau</th></tr></thead><tbody>${diffRows}</tbody></table></html>`;
      }
    };
    persist();
    return api;
  }

  function createSocketProtocol(options) {
    const settings = options || {};
    const projectId = cleanText(settings.projectId, 120) || "creative-main";
    const user = publicUser(settings.currentUser);
    return {
      events: SOCKET_EVENTS,
      join() { return { projectId, user }; },
      leave() { return { projectId, userId: user.id }; },
      wrap(type, payload) {
        if (!Object.values(SOCKET_EVENTS).includes(type)) throw createError("SOCKET_EVENT_DENIED", "Sự kiện realtime không được phép.");
        return { projectId, user, payload: clone(payload || {}) };
      }
    };
  }

  function loadSocketFactory(socketUrl) {
    if (typeof globalScope.io === "function") return Promise.resolve(globalScope.io);
    if (!globalScope.document || !socketUrl) return Promise.reject(createError("SOCKET_UNAVAILABLE", "Socket.io client chưa khả dụng."));
    return new Promise((resolve, reject) => {
      const base = String(socketUrl).replace(/\/$/, "");
      const existing = globalScope.document.querySelector("script[data-hh-creative-socket]");
      if (existing) {
        existing.addEventListener("load", () => typeof globalScope.io === "function" ? resolve(globalScope.io) : reject(createError("SOCKET_UNAVAILABLE", "Socket.io client không hợp lệ.")), { once: true });
        existing.addEventListener("error", () => reject(createError("SOCKET_UNAVAILABLE", "Không tải được Socket.io client.")), { once: true });
        return;
      }
      const script = globalScope.document.createElement("script");
      script.dataset.hhCreativeSocket = "true";
      script.async = true;
      script.src = `${base}/socket.io/socket.io.js`;
      script.onload = () => typeof globalScope.io === "function" ? resolve(globalScope.io) : reject(createError("SOCKET_UNAVAILABLE", "Socket.io client không hợp lệ."));
      script.onerror = () => reject(createError("SOCKET_UNAVAILABLE", "Không tải được Socket.io client."));
      globalScope.document.head.appendChild(script);
    });
  }

  function createRealtimeClient(options) {
    const settings = options || {};
    const requestedSocketUrl = cleanText(settings.socketUrl, 500);
    const socketUrl = normalizeSocketUrl(requestedSocketUrl);
    const protocol = createSocketProtocol(settings);
    const listeners = new Set();
    const bindings = [];
    let socket = null;
    let ownSocket = false;
    let disposed = false;
    let state = socketUrl ? "connecting" : "local";
    let error = socketUrl ? "" : requestedSocketUrl ? "URL Socket.io không an toàn hoặc không hợp lệ. Đang dùng chế độ cục bộ một người." : "Chưa cấu hình Socket.io. Đang dùng chế độ cục bộ một người.";

    function notify() {
      const snapshot = client.getState();
      listeners.forEach((listener) => {
        try { listener(snapshot); } catch (_) { /* isolate consumers */ }
      });
    }

    function setState(next, message) {
      state = next;
      error = cleanText(message, 400);
      notify();
    }

    function on(eventName, handler) {
      if (!socket || typeof socket.on !== "function") return;
      socket.on(eventName, handler);
      bindings.push([eventName, handler]);
    }

    function bindSocket(nextSocket) {
      socket = nextSocket;
      ownSocket = true;
      on("connect", () => {
        if (disposed) return;
        setState("realtime", "");
        socket.emit(SOCKET_EVENTS.JOIN, protocol.join());
      });
      on("disconnect", (reason) => {
        if (disposed) return;
        setState("reconnecting", cleanText(reason, 240) || "Kết nối bị gián đoạn, đang thử lại.");
      });
      on("connect_error", (connectionError) => {
        if (disposed) return;
        setState("local", cleanText(connectionError && connectionError.message, 300) || "Không kết nối được realtime. Đang dùng cục bộ một người.");
      });
      Object.values(SOCKET_EVENTS).filter((eventName) => eventName !== SOCKET_EVENTS.JOIN && eventName !== SOCKET_EVENTS.LEAVE).forEach((eventName) => {
        on(eventName, (payload) => {
          if (disposed || state !== "realtime") return;
          if (typeof settings.onEvent === "function") {
            const eventPayload = payload && payload.payload
              ? { ...payload.payload, user: publicUser(payload.user || payload.payload.user) }
              : payload;
            settings.onEvent(eventName, eventPayload);
          }
        });
      });
      if (socket.connected) {
        setState("realtime", "");
        socket.emit(SOCKET_EVENTS.JOIN, protocol.join());
      }
    }

    const client = {
      getState() { return { mode: state, realtime: state === "realtime", secure: socketUrl.startsWith("https:"), error, socketUrl: socketUrl || "" }; },
      subscribe(listener) {
        if (typeof listener !== "function") return function () {};
        listeners.add(listener);
        listener(client.getState());
        return () => listeners.delete(listener);
      },
      async connect() {
        if (!socketUrl || disposed) {
          setState("local", requestedSocketUrl ? "URL Socket.io không an toàn hoặc không hợp lệ. Đang dùng chế độ cục bộ một người." : "Chưa cấu hình Socket.io. Đang dùng chế độ cục bộ một người.");
          return client.getState();
        }
        setState("connecting", "");
        try {
          const factory = settings.socketFactory || await loadSocketFactory(socketUrl);
          const nextSocket = typeof factory === "function" ? factory(socketUrl, { transports: ["websocket", "polling"], withCredentials: true }) : factory;
          if (!nextSocket || typeof nextSocket.on !== "function" || typeof nextSocket.emit !== "function") throw createError("SOCKET_UNAVAILABLE", "Socket.io client không hợp lệ.");
          bindSocket(nextSocket);
        } catch (connectionError) {
          setState("local", cleanText(connectionError && connectionError.message, 300) || "Không kết nối được realtime. Đang dùng cục bộ một người.");
        }
        return client.getState();
      },
      emit(eventName, payload) {
        if (state !== "realtime" || !socket || typeof socket.emit !== "function") return false;
        socket.emit(eventName, protocol.wrap(eventName, payload));
        return true;
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        if (socket && state === "realtime" && typeof socket.emit === "function") socket.emit(SOCKET_EVENTS.LEAVE, protocol.leave());
        bindings.forEach(([eventName, handler]) => {
          if (socket && typeof socket.off === "function") socket.off(eventName, handler);
        });
        bindings.length = 0;
        if (ownSocket && socket && typeof socket.disconnect === "function") socket.disconnect();
        listeners.clear();
        socket = null;
        state = "disposed";
      }
    };
    return client;
  }

  function colorForStatus(status) {
    return ({ draft: "neutral", review: "warning", approved: "success", published: "live" })[status] || "neutral";
  }

  function statusLabel(status) {
    return ({ draft: "Bản nháp", review: "Đang review", approved: "Đã duyệt", published: "Đã xuất bản" })[status] || status;
  }

  function shortValue(value) {
    if (value === undefined) return "Không có";
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return cleanText(text, 120) || "Rỗng";
  }

  function downloadText(filename, text, mime) {
    if (!globalScope.document || typeof Blob !== "function" || !globalScope.URL || !globalScope.URL.createObjectURL) return false;
    const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
    const url = globalScope.URL.createObjectURL(blob);
    const anchor = globalScope.document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    globalScope.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    globalScope.URL.revokeObjectURL(url);
    return true;
  }

  function createController(root, options) {
    const settings = options || {};
    const currentUser = publicUser(settings.currentUser);
    const universalState = settings.store && typeof settings.store.getState === "function" ? settings.store.getState() : null;
    const universalProject = Array.isArray(universalState && universalState.projects)
      ? universalState.projects.find((item) => item.id === (settings.projectId || universalState.activeProjectId)) || universalState.projects[0]
      : null;
    const requestedProjectId = cleanText(settings.projectId || universalProject?.id, 120);
    const store = settings.store && typeof settings.store.getProject === "function"
      ? settings.store
      : createStore({ currentUser, projectId: requestedProjectId, projectTitle: universalProject?.name });
    let view = settings.view === "collaboration" ? "collaboration" : "review";
    let projectId = requestedProjectId || store.getState().activeProjectId;
    let network = { mode: settings.socketUrl ? "connecting" : "local", realtime: false, error: settings.socketUrl ? "" : "Chưa cấu hình Socket.io. Đang dùng chế độ cục bộ một người." };
    let destroyed = false;
    let notice = "";
    let noticeKind = "info";
    let requestOpen = false;
    const disposers = [];
    const realtime = createRealtimeClient({
      socketUrl: settings.socketUrl,
      apiBase: settings.apiBase,
      projectId,
      currentUser,
      socketFactory: settings.socketFactory,
      onEvent(eventName, payload) {
        try { store.applyRemote(projectId, eventName, payload); }
        catch (error) { showNotice(error.message, "error"); }
      }
    });

    function project() { return store.getProject(projectId); }
    function showNotice(message, kind) {
      notice = cleanText(message, 500);
      noticeKind = kind || "info";
      render();
    }
    function metric(value, label) { return `<div class="cco-metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`; }
    function modeBadge() {
      const label = network.realtime ? "Realtime đã kết nối" : network.mode === "connecting" ? "Đang kết nối" : network.mode === "reconnecting" ? "Đang kết nối lại" : "Cục bộ một người";
      return `<span class="cco-live-badge" data-mode="${escapeHtml(network.mode)}" role="status" aria-live="polite"><i aria-hidden="true"></i>${escapeHtml(label)}</span>`;
    }
    function header(projectData) {
      return `<header class="cco-header">
        <div class="cco-brand"><span class="cco-brand-mark" aria-hidden="true">CO</span><div><span>CREATIVE OS</span><h2>Review & Collaboration</h2></div></div>
        <nav class="cco-view-tabs" role="tablist" aria-label="Workspace Creative OS">
          <button type="button" role="tab" aria-selected="${view === "review"}" class="${view === "review" ? "is-active" : ""}" data-cco-view="review">Review</button>
          <button type="button" role="tab" aria-selected="${view === "collaboration"}" class="${view === "collaboration" ? "is-active" : ""}" data-cco-view="collaboration">Cộng tác</button>
        </nav>
        <div class="cco-head-status">${modeBadge()}<span class="cco-user">${escapeHtml(currentUser.name)}</span></div>
      </header>
      <section class="cco-project-bar">
        <div><span class="cco-kicker">DỰ ÁN ĐANG DUYỆT</span><h3>${escapeHtml(projectData.title)}</h3></div>
        <span class="cco-status" data-tone="${colorForStatus(projectData.status)}">${escapeHtml(statusLabel(projectData.status))}</span>
        <div class="cco-project-actions">
          <button type="button" data-cco-action="export-json">Xuất JSON</button>
          <button type="button" data-cco-action="export-html">Xuất báo cáo</button>
        </div>
      </section>`;
    }
    function noticeView() {
      if (!notice && !network.error) return "";
      const text = notice || network.error;
      return `<div class="cco-notice" data-kind="${escapeHtml(notice ? noticeKind : "info")}" role="status"><span>${escapeHtml(text)}</span><button type="button" data-cco-action="dismiss" aria-label="Đóng thông báo">×</button></div>`;
    }
    function reviewActions(projectData) {
      const openThreads = projectData.threads.filter((thread) => !thread.resolved).length;
      return `<section class="cco-review-actions" aria-label="Quy trình phê duyệt">
        <div class="cco-status-rail">${STATUSES.map((status, index) => `<span class="${status === projectData.status ? "is-current" : STATUSES.indexOf(projectData.status) > index ? "is-done" : ""}"><i>${index + 1}</i>${escapeHtml(statusLabel(status))}</span>`).join("")}</div>
        <div class="cco-action-group">
          ${projectData.status === "draft" ? `<button class="is-primary" data-cco-transition="review">Gửi review</button>` : ""}
          ${projectData.status === "review" ? `<button data-cco-action="request-changes">Yêu cầu sửa</button><button class="is-primary" data-cco-transition="approved" ${openThreads ? "disabled title=\"Còn bình luận chưa xử lý\"" : ""}>Duyệt bản này</button>` : ""}
          ${projectData.status === "approved" ? `<button data-cco-action="request-changes">Mở lại để sửa</button><button class="is-primary" data-cco-transition="published">Xác nhận xuất bản</button>` : ""}
          ${projectData.status === "published" ? `<span class="cco-lock-note">Bản xuất bản đã khóa</span>` : ""}
        </div>
      </section>${requestOpen ? `<form class="cco-request-form" data-cco-request-form><label>Lý do yêu cầu chỉnh sửa<input name="reason" maxlength="${LIMITS.reason}" required autofocus value="Cần điều chỉnh trước khi xuất bản"></label><div><button type="button" data-cco-action="cancel-request">Hủy</button><button type="submit" class="is-primary">Gửi yêu cầu</button></div></form>` : ""}`;
    }
    function previewArt(snapshot, label) {
      const data = snapshot && snapshot.data || {};
      const layers = Array.isArray(data.layers) ? data.layers.slice(0, 8) : [];
      const background = data.canvas && /^#[0-9a-f]{3,8}$/i.test(data.canvas.background) ? data.canvas.background : "#101827";
      return `<article class="cco-preview-card"><div class="cco-preview-head"><strong>${escapeHtml(label)}</strong><span>${layers.length} layer</span></div><div class="cco-artboard" style="--art-bg:${escapeHtml(background)}">${layers.map((layer, index) => {
        const x = clamp(layer.x, 0, 1) * 100;
        const y = clamp(layer.y, 0, 1) * 100;
        const width = clamp(layer.width, 0.05, 1) * 100;
        const height = clamp(layer.height, 0.03, 1) * 100;
        const fill = /^#[0-9a-f]{3,8}$/i.test(String(layer.fill || "")) ? layer.fill : index % 2 ? "#62d7e7" : "#fc5caf";
        return `<span class="cco-art-layer" style="left:${x}%;top:${y}%;width:${width}%;height:${height}%;--layer-fill:${escapeHtml(fill)}">${escapeHtml(layer.text || layer.name || "")}</span>`;
      }).join("")}</div></article>`;
    }
    function threadCard(thread) {
      return `<article class="cco-thread ${thread.resolved ? "is-resolved" : ""}" data-thread-id="${escapeHtml(thread.id)}">
        <header><span class="cco-avatar">${escapeHtml(thread.author.name.slice(0, 2).toUpperCase())}</span><div><strong>${escapeHtml(thread.author.name)}</strong><small>Frame ${thread.frame} · ${escapeHtml(thread.timecode)}</small></div><button type="button" data-cco-resolve="${escapeHtml(thread.id)}">${thread.resolved ? "Mở lại" : "Xử lý"}</button></header>
        <p>${escapeHtml(thread.body)}</p>
        ${thread.replies.map((reply) => `<div class="cco-reply"><b>${escapeHtml(reply.author.name)}</b><span>${escapeHtml(reply.body)}</span></div>`).join("")}
        <form class="cco-reply-form" data-thread-id="${escapeHtml(thread.id)}"><label class="cco-sr" for="reply-${escapeHtml(thread.id)}">Phản hồi</label><input id="reply-${escapeHtml(thread.id)}" name="body" maxlength="${LIMITS.comment}" placeholder="Phản hồi luồng này..."><button type="submit">Gửi</button></form>
      </article>`;
    }
    function reviewView(projectData) {
      const changes = store.compare(projectId);
      const openThreads = projectData.threads.filter((thread) => !thread.resolved).length;
      return `<main class="cco-review-layout">
        <section class="cco-main-column">
          ${reviewActions(projectData)}
          ${projectData.requestChanges ? `<div class="cco-change-request"><strong>Yêu cầu chỉnh sửa</strong><span>${escapeHtml(projectData.requestChanges.reason)}</span></div>` : ""}
          <div class="cco-preview-grid">${previewArt(projectData.snapshots.before, "BEFORE")}${previewArt(projectData.snapshots.after, "AFTER")}</div>
          <section class="cco-diff-panel"><header><div><span class="cco-kicker">BEFORE / AFTER</span><h3>${changes.length} thay đổi dữ liệu</h3></div><span class="cco-lock-note">${projectData.status === "approved" || projectData.status === "published" ? "Đang khóa nội dung" : "Có thể tiếp tục chỉnh sửa"}</span></header><div class="cco-diff-list">${changes.length ? changes.slice(0, 18).map((change) => `<div><code>${escapeHtml(change.path)}</code><span data-type="${escapeHtml(change.type)}">${escapeHtml(change.type)}</span><small>${escapeHtml(shortValue(change.before))}</small><b>→</b><small>${escapeHtml(shortValue(change.after))}</small></div>`).join("") : `<p class="cco-empty">Hai phiên bản chưa có khác biệt.</p>`}</div></section>
        </section>
        <aside class="cco-review-sidebar">
          <section class="cco-summary-grid">${metric(projectData.threads.length, "Luồng")}${metric(openThreads, "Đang mở")}${metric(changes.length, "Thay đổi")}</section>
          <form class="cco-comment-form" data-cco-comment-form>
            <div><span class="cco-kicker">COMMENT THEO FRAME</span><h3>Ghim nhận xét</h3></div>
            <div class="cco-form-row"><label>Frame<input name="frame" type="number" min="0" max="999999" value="0"></label><label>Timecode<input name="timecode" value="00:00:00:00" pattern="[0-9:]+"></label></div>
            <label>Nội dung<textarea name="body" maxlength="${LIMITS.comment}" required placeholder="Mô tả phần cần sửa..."></textarea></label>
            <input name="x" type="hidden" value="0.5"><input name="y" type="hidden" value="0.5">
            <button type="submit" class="is-primary">Thêm bình luận</button>
          </form>
          <section class="cco-thread-list"><header><strong>Luồng review</strong><span>${openThreads} đang mở</span></header>${projectData.threads.length ? projectData.threads.slice().reverse().map(threadCard).join("") : `<p class="cco-empty">Chưa có bình luận. Thêm nhận xét theo frame để bắt đầu.</p>`}</section>
        </aside>
      </main>`;
    }
    function collaborationView(projectData) {
      const activeUsers = projectData.presence.filter((member) => member.online);
      const pending = projectData.timelineChanges.filter((change) => change.status === "pending");
      return `<main class="cco-collab-layout">
        <aside class="cco-presence-panel">
          <div class="cco-panel-heading"><span class="cco-kicker">TEAM SPACE</span><h3>Thành viên</h3><span>${activeUsers.length} online</span></div>
          <div class="cco-presence-list">${projectData.presence.map((member) => `<div class="cco-person"><span class="cco-avatar ${member.online ? "is-online" : ""}">${escapeHtml(member.name.slice(0, 2).toUpperCase())}</span><div><strong>${escapeHtml(member.name)}</strong><small>${member.online ? "Đang hoạt động" : "Vắng mặt"}</small></div></div>`).join("")}</div>
          <div class="cco-local-truth"><strong>${network.realtime ? "Realtime đang hoạt động" : "Phiên cục bộ riêng tư"}</strong><p>${network.realtime ? "Presence và thay đổi đang được đồng bộ qua Socket.io." : "Không có dữ liệu người khác được tải. Cấu hình Socket.io để cộng tác nhiều người."}</p></div>
        </aside>
        <section class="cco-canvas-column">
          <div class="cco-canvas-toolbar"><button type="button" data-cco-action="lock-title">Khóa layer Tiêu đề</button><button type="button" data-cco-action="lock-scene">Khóa scene 01</button><button type="button" data-cco-action="propose-change">Đề xuất thay đổi</button><span>${projectData.locks.length} khóa · ${pending.length} chờ duyệt</span></div>
          <div class="cco-collab-canvas" data-cco-canvas tabindex="0" aria-label="Canvas cộng tác, di chuyển con trỏ để chia sẻ vị trí">
            <div class="cco-scene"><span>SCENE 01</span><h3>Creative launch</h3><p>Không gian duyệt timeline, layer và phiên bản chung.</p><b>LIVE WORKSPACE</b></div>
            ${Object.values(projectData.cursors).filter((cursor) => cursor.user.id !== currentUser.id).map((cursor) => `<span class="cco-cursor" style="left:${cursor.x * 100}%;top:${cursor.y * 100}%;--cursor:${escapeHtml(cursor.user.color)}"><i></i><em>${escapeHtml(cursor.user.name)}</em></span>`).join("")}
          </div>
          <section class="cco-locks"><header><strong>Layer & scene lock</strong><span>Tránh ghi đè công việc</span></header>${projectData.locks.length ? projectData.locks.map((lock) => `<div><span class="cco-lock-icon">L</span><p><strong>${escapeHtml(lock.targetId)}</strong><small>${escapeHtml(lock.targetType)} · ${escapeHtml(lock.owner.name)}</small></p>${lock.owner.id === currentUser.id ? `<button type="button" data-cco-unlock="${escapeHtml(lock.id)}">Mở khóa</button>` : ""}</div>`).join("") : `<p class="cco-empty">Chưa có layer hoặc scene nào bị khóa.</p>`}</section>
          <section class="cco-change-panel"><header><div><span class="cco-kicker">TIMELINE DIFF</span><h3>Thay đổi chờ duyệt</h3></div><span>${pending.length} pending</span></header>${projectData.timelineChanges.length ? projectData.timelineChanges.slice().reverse().map((change) => `<article data-state="${escapeHtml(change.status)}"><div><code>${escapeHtml(change.path)}</code><strong>${escapeHtml(change.summary)}</strong><small>${escapeHtml(change.author.name)} · ${escapeHtml(change.status)}</small></div><p><span>${escapeHtml(shortValue(change.before))}</span><b>→</b><span>${escapeHtml(shortValue(change.after))}</span></p>${change.status === "pending" ? `<footer><button data-cco-change="${escapeHtml(change.id)}" data-decision="rejected">Từ chối</button><button class="is-primary" data-cco-change="${escapeHtml(change.id)}" data-decision="accepted">Chấp nhận</button></footer>` : ""}</article>`).join("") : `<p class="cco-empty">Chưa có thay đổi timeline.</p>`}</section>
        </section>
        <aside class="cco-chat-panel">
          <div class="cco-panel-heading"><span class="cco-kicker">PROJECT CHAT</span><h3>Trao đổi dự án</h3><span>${projectData.chat.length} tin</span></div>
          <div class="cco-chat-list" aria-live="polite">${projectData.chat.length ? projectData.chat.map((message) => `<article class="${message.author.id === currentUser.id ? "is-own" : ""}"><span class="cco-avatar">${escapeHtml(message.author.name.slice(0, 2).toUpperCase())}</span><div><strong>${escapeHtml(message.author.name)}</strong><p>${escapeHtml(message.body)}</p><small>${escapeHtml(new Date(message.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }))}</small></div></article>`).join("") : `<p class="cco-empty">Tin nhắn dự án chỉ hiển thị trong workspace này.</p>`}</div>
          <form class="cco-chat-form" data-cco-chat-form><label class="cco-sr" for="cco-chat-input">Nhắn tin dự án</label><textarea id="cco-chat-input" name="body" maxlength="${LIMITS.message}" required placeholder="Nhắn cho nhóm..."></textarea><button type="submit" class="is-primary">Gửi</button></form>
        </aside>
      </main>`;
    }
    function render() {
      if (destroyed || !root) return;
      const projectData = project();
      root.innerHTML = `<section class="cco-shell" data-hh-creative-collaboration data-view="${escapeHtml(view)}">${header(projectData)}${noticeView()}${view === "review" ? reviewView(projectData) : collaborationView(projectData)}<footer class="cco-footer"><span>Dữ liệu local-first · ${escapeHtml(STORAGE_KEY)}</span><span>${network.realtime ? network.secure ? "Socket.io đang truyền qua TLS" : "Socket.io local development" : "Không tuyên bố realtime khi chưa kết nối"}</span></footer></section>`;
    }
    function emit(eventName, payload) { realtime.emit(eventName, payload); }
    function act(action) {
      try {
        if (action === "dismiss") { notice = ""; render(); return; }
        if (action === "export-json" || action === "export-html") {
          const format = action === "export-html" ? "html" : "json";
          const text = store.exportReport(projectId, format);
          if (!downloadText(`creative-review-${projectId}.${format}`, text, format === "html" ? "text/html;charset=utf-8" : "application/json;charset=utf-8")) showNotice("Báo cáo đã được tạo nhưng trình duyệt không hỗ trợ tải tệp tự động.", "info");
          return;
        }
        if (action === "request-changes") { requestOpen = true; render(); return; }
        if (action === "cancel-request") { requestOpen = false; render(); return; }
        if (action === "lock-title" || action === "lock-scene") {
          const lock = store.acquireLock(projectId, { targetId: action === "lock-title" ? "title" : "scene-01", targetType: action === "lock-title" ? "layer" : "scene" }, currentUser);
          emit(SOCKET_EVENTS.LOCK, lock);
          return;
        }
        if (action === "propose-change") {
          const change = store.addTimelineChange(projectId, { path: "$.timeline.scene-01.duration", before: 8, after: 10, summary: "Kéo dài scene mở đầu thêm 2 giây" }, currentUser);
          emit(SOCKET_EVENTS.CHANGE, change);
        }
      } catch (error) { showNotice(error.message, "error"); }
    }
    function onClick(event) {
      const viewButton = event.target.closest("[data-cco-view]");
      if (viewButton) { view = viewButton.dataset.ccoView === "collaboration" ? "collaboration" : "review"; render(); return; }
      const actionButton = event.target.closest("[data-cco-action]");
      if (actionButton) { act(actionButton.dataset.ccoAction); return; }
      const transitionButton = event.target.closest("[data-cco-transition]");
      if (transitionButton) {
        try { const updated = store.transition(projectId, transitionButton.dataset.ccoTransition, currentUser); emit(SOCKET_EVENTS.REVIEW, { action: "status", status: updated.status }); }
        catch (error) { showNotice(error.message, "error"); }
        return;
      }
      const resolveButton = event.target.closest("[data-cco-resolve]");
      if (resolveButton) {
        try {
          const thread = project().threads.find((item) => item.id === resolveButton.dataset.ccoResolve);
          store.resolveThread(projectId, resolveButton.dataset.ccoResolve, !thread.resolved, currentUser);
          emit(SOCKET_EVENTS.REVIEW, { action: "thread", threadId: thread.id, resolved: !thread.resolved });
        } catch (error) { showNotice(error.message, "error"); }
        return;
      }
      const unlockButton = event.target.closest("[data-cco-unlock]");
      if (unlockButton) {
        try { const lock = store.releaseLock(projectId, unlockButton.dataset.ccoUnlock, currentUser); emit(SOCKET_EVENTS.UNLOCK, { lockId: lock.id }); }
        catch (error) { showNotice(error.message, "error"); }
        return;
      }
      const changeButton = event.target.closest("[data-cco-change]");
      if (changeButton) {
        try { const change = store.decideTimelineChange(projectId, changeButton.dataset.ccoChange, changeButton.dataset.decision, currentUser); emit(SOCKET_EVENTS.DECISION, { changeId: change.id, decision: change.status }); }
        catch (error) { showNotice(error.message, "error"); }
      }
    }
    function onSubmit(event) {
      const form = event.target;
      if (!form || form.tagName !== "FORM") return;
      event.preventDefault();
      const data = new globalScope.FormData(form);
      try {
        if (form.matches("[data-cco-request-form]")) {
          const reason = data.get("reason");
          const updated = store.requestChanges(projectId, reason, currentUser);
          requestOpen = false;
          emit(SOCKET_EVENTS.REVIEW, { action: "changes-requested", status: updated.status, reason: cleanText(reason, LIMITS.reason) });
        } else if (form.matches("[data-cco-comment-form]")) {
          const thread = store.addThread(projectId, { frame: data.get("frame"), timecode: data.get("timecode"), body: data.get("body"), point: { x: data.get("x"), y: data.get("y") } }, currentUser);
          emit(SOCKET_EVENTS.REVIEW, { action: "thread-created", thread });
        } else if (form.matches(".cco-reply-form")) {
          const reply = store.addReply(projectId, form.dataset.threadId, { body: data.get("body") }, currentUser);
          emit(SOCKET_EVENTS.REVIEW, { action: "reply-created", threadId: form.dataset.threadId, reply });
        } else if (form.matches("[data-cco-chat-form]")) {
          const message = store.addChat(projectId, { body: data.get("body") }, currentUser);
          emit(SOCKET_EVENTS.CHAT, message);
        }
        form.reset();
      } catch (error) { showNotice(error.message, "error"); }
    }
    let lastCursorSent = 0;
    function onPointerMove(event) {
      const canvas = event.target.closest("[data-cco-canvas]");
      if (!canvas) return;
      const time = Date.now();
      if (time - lastCursorSent < 60) return;
      lastCursorSent = time;
      const rect = canvas.getBoundingClientRect();
      const point = normalizePoint({ x: (event.clientX - rect.left) / Math.max(1, rect.width), y: (event.clientY - rect.top) / Math.max(1, rect.height) });
      emit(SOCKET_EVENTS.CURSOR, { point, context: "scene-01" });
    }
    function onKeyDown(event) {
      if (event.key === "Escape" && (notice || requestOpen)) { notice = ""; requestOpen = false; render(); return; }
      if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && event.target.matches("[role=tab]")) {
        event.preventDefault();
        view = view === "review" ? "collaboration" : "review";
        render();
        const next = root.querySelector(`[data-cco-view="${view}"]`);
        if (next) next.focus();
      }
    }

    root.addEventListener("click", onClick);
    root.addEventListener("submit", onSubmit);
    root.addEventListener("pointermove", onPointerMove);
    root.addEventListener("keydown", onKeyDown);
    disposers.push(() => root.removeEventListener("click", onClick));
    disposers.push(() => root.removeEventListener("submit", onSubmit));
    disposers.push(() => root.removeEventListener("pointermove", onPointerMove));
    disposers.push(() => root.removeEventListener("keydown", onKeyDown));
    disposers.push(store.subscribe(() => render()));
    disposers.push(realtime.subscribe((next) => { network = next; render(); }));
    realtime.connect();
    render();

    return {
      store,
      realtime,
      setView(nextView) { view = nextView === "collaboration" ? "collaboration" : "review"; render(); },
      getView() { return view; },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        realtime.dispose();
        disposers.splice(0).reverse().forEach((dispose) => {
          try { dispose(); } catch (_) { /* best-effort cleanup */ }
        });
        if (root) root.innerHTML = "";
      }
    };
  }

  function mount(root, options) {
    if (!root || typeof root.addEventListener !== "function") throw createError("ROOT_REQUIRED", "Cần phần tử DOM để mount Creative Collaboration OS.");
    unmount(root);
    const controller = createController(root, options || {});
    instances.set(root, controller);
    return controller;
  }

  function unmount(root) {
    const controller = root && instances.get(root);
    if (!controller) return false;
    controller.destroy();
    instances.delete(root);
    return true;
  }

  return Object.freeze({
    VERSION,
    STORAGE_KEY,
    FORMAT,
    STATUSES,
    TRANSITIONS,
    LIMITS,
    SOCKET_EVENTS,
    escapeHtml,
    cleanText,
    normalizeSocketUrl,
    publicUser,
    normalizePoint,
    normalizeTimecode,
    diffData,
    canTransition,
    createStore,
    createSocketProtocol,
    createRealtimeClient,
    mount,
    unmount
  });
});
