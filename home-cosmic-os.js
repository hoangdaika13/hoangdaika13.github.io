(function (global, factory) {
  "use strict";
  try {
    const api = factory(global || {});
    if (typeof module === "object" && module.exports) module.exports = api;
    if (global) global.HHHomeCosmicOS = api;
    if (global?.document) api.autoMount();
  } catch (error) {
    try { global?.console?.error?.("HHHomeCosmicOS failed to mount", error); } catch {}
    throw error;
  }
})(typeof window !== "undefined" ? window : typeof self !== "undefined" ? self : typeof globalThis !== "undefined" ? globalThis : this, function createHomeCosmicOS(global) {
  "use strict";

  const VERSION = "2.0.0";
  const STORAGE_PREFIX = "hh.home.cosmic-os.v1";
  const schemaVersion = 2;
  const MAX_IMPORT_BYTES = 512 * 1024;
  const COSMIC_DB = "hh-cosmic-os";
  const COSMIC_DB_STORE = "collections";
  const GUEST_FLAG_KEY = "hh.auth.guest";
  const GUEST_USER_KEY = "hh.auth.guest-user";
  const ANONYMOUS_ID_KEY = "hh.anonymous-id.v1";
  const STORES = Object.freeze({
    auth: "hh-auth-user",
    todos: "hh.command-center.todos.v2",
    notes: "hh.dashboard.sticky-notes.v1",
    projects: "hh-project-center",
    planning: "hh-work-center-v2",
    orchestrator: "hh.platform.orchestrator.v2",
    background: "hh.background.jobs.v1",
    activity: "hh.home.galaxy.activity.v2",
    communication: "hh.communication.intelligence.v1",
    recent: "hh.app-shell.recent",
    learning: "hh.learning.os.v1",
    english: "hh.english.state.v1",
    japanese: "hh.japanese.state.v1",
    japaneseOs: "hh.japanese.os.v5",
    youtube: "hh.youtube-publisher.v1",
    youtubeFleet: "hh.youtube-channel-fleet.v1",
    facebook: "hh.facebook-page-command-center.v1",
    comic: "hh.comic-motion-series-resume.v1",
    comicTasks: "hh.comic-motion-task-center.v1",
    issues: "hh.runtime.issues.v1",
    backup: "hh.system.backup.v1"
  });
  const TABS = Object.freeze([
    ["brief", "Hôm nay", "☀"],
    ["inbox", "Hộp thư", "◇"],
    ["queue", "Hàng đợi", "⇣"],
    ["workspace", "Workspace", "▦"],
    ["automation", "Tự động", "↻"],
    ["tools", "Tiện ích", "✦"],
    ["mission", "Hệ thống", "⌁"],
    ["profiles", "Cấu hình", "◉"]
  ]);
  const PROFILES = Object.freeze([
    ["auto", "Tự động", "Tự thích ứng theo thời gian và tín hiệu thật"],
    ["work", "Công việc", "Ưu tiên task, lịch, dự án và Focus"],
    ["learning", "Học tập", "HH English, HH Japanese và lịch ôn"],
    ["creative", "Sáng tạo", "Ý tưởng, thumbnail, media và xuất bản"],
    ["website", "Quản trị web", "Backend, API, OAuth và Web Vitals"],
    ["family", "Gia đình", "Lịch chung, ghi chú và hoạt động nhẹ nhàng"]
  ]);
  const PIPELINE = Object.freeze([
    ["idea", "Ý tưởng", "/create/ai-center"],
    ["script", "Kịch bản", "/create/ai-center"],
    ["voice", "Voice", "/music-ai"],
    ["image", "Ảnh", "/media-design"],
    ["thumbnail", "Thumbnail", "/davinci-resolve/image-text"],
    ["render", "Render", "/media-design"],
    ["review", "Kiểm tra", "/work"],
    ["publish", "Đăng", "/davinci-resolve/youtube"]
  ]);
  const SCENES = Object.freeze([
    { id: "video", icon: "▶", label: "Bắt đầu làm video", steps: [["Mở dự án", "/work/project-center"], ["Viết kịch bản", "/create/ai-center"], ["Thiết kế thumbnail", "/davinci-resolve/image-text"], ["Chuẩn bị lịch đăng", "/davinci-resolve/youtube"]] },
    { id: "publish", icon: "↥", label: "Đăng nội dung hôm nay", steps: [["Kiểm tra hàng đợi", "/home"], ["Mở YouTube Studio", "/davinci-resolve/youtube"], ["Mở Facebook", "/davinci-resolve/facebook"]] },
    { id: "learn", icon: "◫", label: "Học nhanh 15 phút", steps: [["Mở bài ôn", "/learn/review"], ["Kiểm tra từ sai", "/learn/review"]] },
    { id: "health", icon: "⌁", label: "Kiểm tra website", steps: [["Đo frontend/backend", "/home"], ["Mở Website Health", "/analytics"]] },
    { id: "night", icon: "☾", label: "Chuẩn bị đi ngủ", steps: [["Xem việc ngày mai", "/work"], ["Lưu ghi chú cuối ngày", "/home"]] },
    { id: "backup", icon: "▣", label: "Backup cuối ngày", steps: [["Kiểm tra dữ liệu local", "/settings"], ["Mở trung tâm backup", "/settings"]] }
  ]);
  const ROUTE_LABELS = Object.freeze({
    "/work": "Công việc", "/work/project-center": "Project Center", "/learn/review": "Bài học đến hạn",
    "/learn/english": "HH English", "/learn/japanese": "HH Japanese", "/media-design": "Media & Design",
    "/davinci-resolve/image-text": "Thumbnail Studio", "/davinci-resolve/youtube": "YouTube Studio",
    "/davinci-resolve/facebook": "Facebook Center", "/comic-reader": "Đọc truyện",
    "/music-ai": "Music AI", "/create/ai-center": "AI Center", "/analytics": "Website Health", "/settings": "Hệ thống"
  });
  const instances = new WeakMap();
  let observer = null;
  let mountedRoot = null;
  let anonymousOwnerId = "";

  const asArray = (value) => Array.isArray(value) ? value : [];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const clean = (value, limit = 240) => String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[character]));
  const escapeSelectorValue = (value) => {
    const text = String(value ?? "");
    if (global.CSS?.escape) return global.CSS.escape(text);
    return text.replace(/[\u0000-\u001f\u007f"\\]/g, (character) => `\\${character.codePointAt(0).toString(16)} `);
  };
  const clone = (value) => { try { return JSON.parse(JSON.stringify(value)); } catch { return null; } };
  const uid = (prefix = "hco") => `${prefix}-${global.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`;
  const timestamp = (value) => {
    const parsed = new Date(value || 0).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const nowIso = () => new Date().toISOString();
  const dateKey = (value = Date.now()) => new Date(value).toISOString().slice(0, 10);
  const readJson = (key, fallback) => {
    try { const value = JSON.parse(global.localStorage?.getItem?.(key) || "null"); return value == null ? fallback : value; }
    catch { return fallback; }
  };
  const readSessionJson = (key, fallback) => {
    try { const value = JSON.parse(global.sessionStorage?.getItem?.(key) || "null"); return value == null ? fallback : value; }
    catch { return fallback; }
  };
  const writeJson = (key, value) => {
    try { global.localStorage?.setItem?.(key, JSON.stringify(value)); return true; }
    catch { return false; }
  };
  const unique = (items, key = (item) => item?.id) => {
    const seen = new Set();
    return items.filter((item) => {
      const id = clean(key(item), 160);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };
  const relative = (value) => {
    const at = timestamp(value);
    if (!at) return "Chưa có thời gian";
    const delta = Date.now() - at;
    if (delta < 60_000) return "Vừa xong";
    if (delta < 3_600_000) return `${Math.max(1, Math.floor(delta / 60_000))} phút trước`;
    if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} giờ trước`;
    return new Date(at).toLocaleDateString("vi-VN");
  };

  function currentIdentity() {
    const guestActive = global.sessionStorage?.getItem?.(GUEST_FLAG_KEY) === "1";
    if (guestActive) return { ...readSessionJson(GUEST_USER_KEY, {}), guest: true };
    return readJson(STORES.auth, {});
  }

  function anonymousScope() {
    if (anonymousOwnerId) return anonymousOwnerId;
    const stored = clean(readJson(ANONYMOUS_ID_KEY, ""), 80).replace(/[^a-z0-9._-]/gi, "-");
    anonymousOwnerId = stored ? `guest-${stored.replace(/^guest-/, "")}` : uid("guest").toLowerCase().replace(/[^a-z0-9._-]/g, "-");
    if (!stored) writeJson(ANONYMOUS_ID_KEY, anonymousOwnerId.replace(/^guest-/, ""));
    return anonymousOwnerId;
  }

  function ownerScope(owner = null) {
    const user = owner && typeof owner === "object" ? owner : currentIdentity();
    const serverId = clean(user?.id || user?._id || user?.sub, 120);
    if (serverId) return serverId.toLowerCase().replace(/[^a-z0-9@._-]/g, "-") || anonymousScope();
    return anonymousScope();
  }

  function hasAuthenticatedOwner() {
    const user = currentIdentity();
    return Boolean((user?.id || user?._id || user?.sub) && user?.guest !== true && global.sessionStorage?.getItem?.(GUEST_FLAG_KEY) !== "1");
  }

  function isSensitiveClipboard(value) {
    const text = String(value || "");
    return /(?:password|passwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|bearer)\s*[:=]/i.test(text)
      || /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)
      || /\b(?:sk|ghp|github_pat|AIza)[-_A-Za-z0-9]{20,}\b/.test(text)
      || /\b(?:\d[ -]*?){13,19}\b/.test(text);
  }

  function safeHandoffPayload(input = {}) {
    const createdAt = timestamp(input.createdAt) || Date.now();
    return Object.freeze({
      id: clean(input.id, 100) || uid("handoff"),
      type: clean(input.type, 40) || "home",
      stateId: clean(input.stateId, 120) || clean(input.id, 120) || uid("state"),
      route: /^\/[a-z0-9/_-]+(?:\?[a-z0-9_=&-]+)?$/i.test(String(input.route || "")) ? String(input.route) : "/home",
      label: clean(input.label, 100) || "Tiếp tục trên thiết bị khác",
      ownerId: clean(input.ownerId, 80) || "guest",
      createdAt: new Date(createdAt).toISOString(),
      expiresAt: new Date(Math.min(createdAt + 24 * 60 * 60 * 1000, timestamp(input.expiresAt) || Infinity)).toISOString()
    });
  }

  function priorityReason(item, now = Date.now()) {
    const due = timestamp(item?.dueAt || item?.deadline || item?.due);
    const progress = clamp(item?.progress, 0, 100);
    if (item?.blocked) return "Được ưu tiên vì đang bị chặn và cần xử lý điều kiện phụ thuộc.";
    if (due && due < now) return `Được ưu tiên vì đã quá hạn ${Math.max(1, Math.ceil((now - due) / 3_600_000))} giờ.`;
    if (due && due - now <= 60 * 60 * 1000) return `Được ưu tiên vì còn ${Math.max(1, Math.ceil((due - now) / 60_000))} phút tới hạn.`;
    if (due && due - now <= 24 * 60 * 60 * 1000) return "Được ưu tiên vì đến hạn trong 24 giờ tới.";
    if (progress >= 80 && progress < 100) return `Được ưu tiên vì đã hoàn thành ${progress}% và sắp kết thúc.`;
    if (Number(item?.importance || item?.priority) >= 3 || /high|urgent|critical/i.test(String(item?.priority || ""))) return "Được ưu tiên vì được đánh dấu quan trọng.";
    return "Được ưu tiên từ thứ tự công việc và hoạt động gần đây của bạn.";
  }

  function priorityScore(item, now = Date.now()) {
    const due = timestamp(item?.dueAt || item?.deadline || item?.due);
    const progress = clamp(item?.progress, 0, 100);
    let score = Number(item?.importance || 0) * 18;
    if (/urgent|critical/i.test(String(item?.priority || ""))) score += 70;
    else if (/high/i.test(String(item?.priority || ""))) score += 45;
    if (item?.blocked) score += 58;
    if (due) {
      const hours = (due - now) / 3_600_000;
      if (hours < 0) score += 120 + Math.min(60, Math.abs(hours));
      else if (hours <= 1) score += 100;
      else if (hours <= 24) score += 72 - hours;
      else if (hours <= 72) score += 30;
    }
    if (progress >= 80 && progress < 100) score += 34;
    score += Math.min(20, timestamp(item?.updatedAt || item?.createdAt) / Math.max(1, now) * 20);
    return Number(score.toFixed(2));
  }

  function rankPriorities(items, now = Date.now()) {
    return asArray(items).map((item, index) => ({ ...item, priorityScore: priorityScore(item, now), priorityReason: priorityReason(item, now), _order: index }))
      .sort((a, b) => b.priorityScore - a.priorityScore || a._order - b._order)
      .map(({ _order, ...item }) => item);
  }

  function missionStatus(check = {}) {
    if (check.supported === false) return { state: "unsupported", label: "Không được hỗ trợ", verified: false };
    if (check.pending === true || check.state === "checking") return { state: "checking", label: "Đang kiểm tra", verified: false };
    if (check.ok === true && (check.verified === true || check.responded === true || Number.isFinite(Number(check.latency)))) {
      return { state: "online", label: "Hoạt động", verified: true };
    }
    if (check.ok === false || /offline|failed|error/i.test(String(check.state || ""))) return { state: "offline", label: "Gián đoạn", verified: true };
    if (/degraded|slow|warning/i.test(String(check.state || ""))) return { state: "degraded", label: "Cần kiểm tra", verified: true };
    return { state: "unknown", label: "Chưa xác minh", verified: false };
  }

  function resolveCapabilityState(evidence = {}) {
    if (evidence?.supported === false) return { state: "unsupported", available: false, label: "Không được hỗ trợ" };
    if (evidence?.requiresConnection === true && evidence?.connected !== true) return { state: "needs-connection", available: false, label: "Cần kết nối" };
    if (evidence?.verified === true && (evidence?.local === true || evidence?.connected === true || evidence?.available === true)) {
      return { state: evidence.local === true ? "local" : "available", available: true, label: evidence.local === true ? "Sẵn sàng cục bộ" : "Đã xác minh" };
    }
    return { state: "unknown", available: false, label: "Chưa xác minh" };
  }

  const sensitiveExportKey = (key) => /(?:owner(?:id)?|learnerprofileid|e-?mail|password|passphrase|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|cookie|credential|sessionid)/i.test(String(key || ""));

  function containsSensitiveKey(value, depth = 0) {
    if (!value || typeof value !== "object" || depth > 12) return false;
    if (Array.isArray(value)) return value.some((item) => containsSensitiveKey(item, depth + 1));
    return Object.entries(value).some(([key, child]) => sensitiveExportKey(key) || containsSensitiveKey(child, depth + 1));
  }

  function redactForExport(value, depth = 0) {
    if (depth > 12) return null;
    if (value == null || ["string", "number", "boolean"].includes(typeof value)) return typeof value === "string" ? clean(value, 20_000) : value;
    if (Array.isArray(value)) return value.slice(0, 2_000).map((item) => redactForExport(item, depth + 1));
    if (typeof value !== "object") return null;
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !sensitiveExportKey(key))
      .slice(0, 500)
      .map(([key, child]) => [clean(key, 100), redactForExport(child, depth + 1)]));
  }

  function safeExportPayload(input = {}) {
    return redactForExport(input) || {};
  }

  function validateImportPayload(payload) {
    let size = Infinity;
    try { size = new TextEncoder().encode(JSON.stringify(payload)).byteLength; } catch {}
    if (!payload || typeof payload !== "object" || size > MAX_IMPORT_BYTES) return { ok: false, valid: false, reason: "Tệp không hợp lệ hoặc vượt quá 512 KB." };
    if (payload.schema !== "hh-home-cosmic-os" || ![1, schemaVersion].includes(Number(payload.version))) return { ok: false, valid: false, reason: "Schema hoặc phiên bản không được hỗ trợ." };
    if (!payload.data || typeof payload.data !== "object" || containsSensitiveKey(payload.data)) return { ok: false, valid: false, reason: "Dữ liệu chứa trường nhạy cảm hoặc sai cấu trúc." };
    return { ok: true, valid: true, data: normalizeState(payload.data) };
  }

  function openCosmicDb() {
    if (!global.indexedDB) return Promise.resolve(null);
    return new Promise((resolve) => {
      const request = global.indexedDB.open(COSMIC_DB, schemaVersion);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(COSMIC_DB_STORE)) db.createObjectStore(COSMIC_DB_STORE, { keyPath: "id" });
        // migration: v1 local snapshots are normalized when first persisted.
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
  }

  async function persistLargeCollections(instance, model) {
    const db = await openCosmicDb();
    if (!db || instance.destroyed) return false;
    const payloads = [
      { id: `${instance.storageKey}:workspace`, kind: "workspace", items: safeExportPayload(model.continueStack || []), updatedAt: Date.now() },
      { id: `${instance.storageKey}:activity`, kind: "activity", items: safeExportPayload(model.source?.activities || []), updatedAt: Date.now() },
      { id: `${instance.storageKey}:queue`, kind: "queue", items: safeExportPayload(queueRows(model)), updatedAt: Date.now() }
    ];
    return new Promise((resolve) => {
      const tx = db.transaction(COSMIC_DB_STORE, "readwrite");
      const store = tx.objectStore(COSMIC_DB_STORE);
      payloads.forEach((row) => store.put(row));
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { db.close(); resolve(false); };
      tx.onabort = () => { db.close(); resolve(false); };
    });
  }

  function normalizeState(source = {}) {
    const profileIds = new Set(PROFILES.map((item) => item[0]));
    const tabIds = new Set(TABS.map((item) => item[0]));
    const pipeline = Object.fromEntries(PIPELINE.map(([id]) => [id, ["todo", "doing", "done"].includes(source.pipeline?.[id]) ? source.pipeline[id] : "todo"]));
    return {
      schema: "hh-home-cosmic-os",
      version: schemaVersion,
      activeTab: tabIds.has(source.activeTab) ? source.activeTab : "brief",
      profile: profileIds.has(source.profile) ? source.profile : "auto",
      inboxRead: source.inboxRead && typeof source.inboxRead === "object" ? source.inboxRead : {},
      inboxPinned: asArray(source.inboxPinned).map((id) => clean(id, 120)).slice(0, 100),
      inboxSnoozed: source.inboxSnoozed && typeof source.inboxSnoozed === "object" ? source.inboxSnoozed : {},
      captures: asArray(source.captures).slice(0, 80),
      clipboard: asArray(source.clipboard).filter((item) => item && !isSensitiveClipboard(item.text)).slice(0, 30),
      automations: asArray(source.automations).slice(0, 30),
      pipeline,
      focus: {
        duration: clamp(source.focus?.duration || 25 * 60, 5 * 60, 120 * 60),
        endAt: timestamp(source.focus?.endAt), running: source.focus?.running === true,
        taskId: clean(source.focus?.taskId, 120), completed: Number(source.focus?.completed || 0)
      },
      restorePreviewId: clean(source.restorePreviewId, 140),
      lastSnapshot: source.lastSnapshot && typeof source.lastSnapshot === "object" ? source.lastSnapshot : {},
      lastVisitAt: timestamp(source.lastVisitAt),
      ambient: source.ambient !== false,
      screensaver: source.screensaver !== false,
      screensaverDelay: clamp(source.screensaverDelay || 300, 120, 1800),
      compact: source.compact === true,
      inspectorOpen: source.inspectorOpen !== false,
      sidebarCollapsed: source.sidebarCollapsed === true,
      settings: {
        motion: ["static", "balanced", "cinematic"].includes(source.settings?.motion) ? source.settings.motion : "balanced",
        fontScale: clamp(source.settings?.fontScale || 1, .9, 1.3),
        contrast: ["normal", "high"].includes(source.settings?.contrast) ? source.settings.contrast : "normal",
        density: ["compact", "comfortable", "spacious"].includes(source.settings?.density) ? source.settings.density : "comfortable",
        language: ["vi", "en"].includes(source.settings?.language) ? source.settings.language : "vi",
        notifications: source.settings?.notifications !== false,
        offline: source.settings?.offline !== false,
        reducedEffectsWhileTyping: source.settings?.reducedEffectsWhileTyping !== false
      },
      updatedAt: timestamp(source.updatedAt) || Date.now()
    };
  }

  function storageKey(owner = null, learnerProfileId = currentLearnerProfile()) { return scopedKey(ownerScope(owner), learnerProfileId); }
  function stateKey(owner = null) { return storageKey(owner, currentLearnerProfile()); }

  function taskDone(task) {
    return task?.completed === true || ["done", "completed", "archived"].includes(String(task?.state || task?.status || task?.column || "").toLowerCase());
  }

  function taskDue(task) { return timestamp(task?.dueAt || task?.deadline || task?.due || task?.scheduledAt); }
  function itemTitle(item, fallback = "Mục chưa đặt tên") { return clean(item?.title || item?.name || item?.label || item?.text, 140) || fallback; }
  function routeForRecent(item) {
    if (typeof item === "object" && /^\//.test(String(item.route || ""))) return String(item.route);
    const value = clean(typeof item === "string" ? item : item?.id || item?.moduleId, 100).toLowerCase();
    const direct = Object.keys(ROUTE_LABELS).find((route) => route === value || route.slice(1) === value);
    if (direct) return direct;
    if (/japanese|jlpt/.test(value)) return "/learn/japanese";
    if (/english|cefr/.test(value)) return "/learn/english";
    if (/thumbnail|image-text/.test(value)) return "/davinci-resolve/image-text";
    if (/youtube|publisher/.test(value)) return "/davinci-resolve/youtube";
    if (/facebook/.test(value)) return "/davinci-resolve/facebook";
    if (/comic|reader|truyen/.test(value)) return "/comic-reader";
    if (/music/.test(value)) return "/music-ai";
    if (/media|design|photo|video/.test(value)) return "/media-design";
    if (/work|task|project/.test(value)) return "/work";
    if (/analytics|health|insight/.test(value)) return "/analytics";
    if (/system|setting/.test(value)) return "/settings";
    if (/ai|creative/.test(value)) return "/create/ai-center";
    return "/home";
  }

  function belongsToOwner(item, owner = ownerScope()) {
    if (!item || typeof item !== "object") return true;
    const recordOwner = clean(item.ownerId || item.userId || item.accountId || item.owner?.id, 120);
    // Legacy guest records predate owner metadata and remain usable only in
    // the local guest workspace. Authenticated accounts must never inherit
    // an unowned record from another browser identity.
    if (!hasAuthenticatedOwner()) return !recordOwner || recordOwner === owner;
    return recordOwner === owner;
  }

  function ownedArray(value, owner = ownerScope()) {
    return asArray(value).filter((item) => belongsToOwner(item, owner));
  }

  function ownedContainer(value, owner = ownerScope()) {
    if (Array.isArray(value)) return ownedArray(value, owner);
    if (!value || typeof value !== "object") return value;
    const containerOwner = clean(value.ownerId || value.userId || value.accountId, 120);
    if (hasAuthenticatedOwner() && containerOwner && containerOwner !== owner) return {};
    const copy = { ...value };
    Object.keys(copy).forEach((key) => { if (Array.isArray(copy[key])) copy[key] = ownedArray(copy[key], owner); });
    return copy;
  }

  function sourceSnapshot() {
    const owner = ownerScope();
    const todos = ownedArray(readJson(STORES.todos, []), owner);
    const planning = ownedContainer(readJson(STORES.planning, {}), owner);
    const projectsStore = ownedContainer(readJson(STORES.projects, {}), owner);
    const orchestrator = ownedContainer(readJson(STORES.orchestrator, {}), owner);
    const background = ownedContainer(readJson(STORES.background, {}), owner);
    const communication = ownedContainer(readJson(STORES.communication, {}), owner);
    const learning = ownedContainer(readJson(STORES.learning, {}), owner);
    const english = ownedContainer(readJson(STORES.english, {}), owner);
    const japanese = ownedContainer(readJson(STORES.japanese, {}), owner);
    const japaneseOs = ownedContainer(readJson(STORES.japaneseOs, {}), owner);
    const youtube = ownedContainer(readJson(STORES.youtube, {}), owner);
    const facebook = ownedContainer(readJson(STORES.facebook, {}), owner);
    const comic = ownedContainer(readJson(STORES.comic, {}), owner);
    const comicTasks = ownedContainer(readJson(STORES.comicTasks, {}), owner);
    const issues = ownedContainer(readJson(STORES.issues, {}), owner);
    const tasks = unique([...todos, ...asArray(planning.tasks), ...asArray(projectsStore.tasks)], (item) => item?.id || `${itemTitle(item)}:${taskDue(item)}`);
    const projects = unique([...asArray(planning.projects), ...asArray(projectsStore.projects)], (item) => item?.id || itemTitle(item));
    const jobs = unique([...asArray(orchestrator.jobs), ...asArray(background.jobs), ...asArray(comicTasks.jobs), ...asArray(youtube.queue), ...asArray(facebook.queue)], (item) => item?.id || `${itemTitle(item)}:${item?.createdAt || item?.state}`);
    const notifications = asArray(communication.notifications);
    const recent = ownedArray(readJson(STORES.recent, []), owner);
    const activities = ownedArray(readJson(STORES.activity, []), owner);
    const runtimeIssues = ownedArray(issues.items || issues.issues || issues, owner);
    return { todos, planning, projectsStore, orchestrator, background, communication, learning, english, japanese, japaneseOs, youtube, facebook, comic, comicTasks, tasks, projects, jobs, notifications, recent, activities, runtimeIssues };
  }

  function jobState(job) { return String(job?.state || job?.status || "queued").toLowerCase(); }
  function learningDue(snapshot) {
    const candidates = [
      ...asArray(snapshot.learning.reviewQueue), ...asArray(snapshot.learning.due),
      ...asArray(snapshot.english.reviewQueue), ...asArray(snapshot.english.srs),
      ...asArray(snapshot.japanese.reviewQueue), ...asArray(snapshot.japanese.srs),
      ...asArray(snapshot.japaneseOs.reviewQueue), ...asArray(snapshot.japaneseOs.srs)
    ];
    return unique(candidates.filter((item) => {
      const due = timestamp(item?.dueAt || item?.nextReview || item?.due);
      return item && (!due || due <= Date.now());
    }), (item) => item?.id || item?.term || item?.word || itemTitle(item));
  }

  function activeProject(snapshot) {
    const selectedId = clean(snapshot.planning.activeProjectId || snapshot.projectsStore.activeProjectId || snapshot.projectsStore.activeProject, 120);
    return snapshot.projects.find((item) => String(item.id) === selectedId)
      || snapshot.projects.find((item) => !["done", "completed", "archived"].includes(String(item.status || "").toLowerCase())) || null;
  }

  function counters(snapshot) {
    const openTasks = snapshot.tasks.filter((item) => !taskDone(item));
    const doneTasks = snapshot.tasks.filter(taskDone);
    const activeJobs = snapshot.jobs.filter((item) => ["queued", "running", "processing", "waiting", "paused"].includes(jobState(item)));
    const failedJobs = snapshot.jobs.filter((item) => ["failed", "error"].includes(jobState(item)));
    const completedJobs = snapshot.jobs.filter((item) => ["done", "completed", "success"].includes(jobState(item)));
    const unread = snapshot.notifications.filter((item) => item && item.read !== true);
    const dueLearning = learningDue(snapshot);
    const comicUpdates = snapshot.jobs.filter((item) => /comic|chapter|truy/i.test(`${item?.type || ""} ${itemTitle(item)}`) && !["done", "completed"].includes(jobState(item)));
    const siteIssues = snapshot.runtimeIssues.filter((item) => !["resolved", "done"].includes(String(item?.status || "").toLowerCase()));
    return { openTasks, doneTasks, activeJobs, failedJobs, completedJobs, unread, dueLearning, comicUpdates, siteIssues };
  }

  function buildPriorities(snapshot, count) {
    const today = Date.now();
    const taskItems = count.openTasks.map((task) => ({
      id: clean(task.id, 120) || uid("task"), type: "task", title: itemTitle(task),
      description: clean(task.description || task.note, 180), dueAt: taskDue(task),
      progress: task.progress, priority: task.priority, importance: task.importance,
      blocked: task.blocked === true || String(task.status || "").toLowerCase() === "blocked",
      updatedAt: task.updatedAt || task.createdAt, route: "/work"
    }));
    const failed = count.failedJobs.map((job) => ({
      id: `job:${clean(job.id, 100) || itemTitle(job)}`, type: "job", title: `Xử lý lỗi: ${itemTitle(job)}`,
      description: clean(job.error || job.message, 180), importance: 4, blocked: true,
      updatedAt: job.updatedAt || job.createdAt, route: job.route || "/work"
    }));
    const learning = count.dueLearning.slice(0, 3).map((item) => ({
      id: `learn:${clean(item.id || item.term || item.word, 100)}`, type: "learning", title: itemTitle(item, "Bài ôn đến hạn"),
      description: "Đang chờ trong hàng ôn tập của bạn.", importance: 2, dueAt: timestamp(item.dueAt || item.nextReview) || today,
      route: /japan|kanji|kana/i.test(`${item?.source || ""} ${item?.language || ""}`) ? "/learn/japanese" : "/learn/review"
    }));
    return rankPriorities([...taskItems, ...failed, ...learning], today).slice(0, 12);
  }

  function buildContinueStack(snapshot, count) {
    const rows = [];
    snapshot.recent.forEach((item, index) => {
      const route = routeForRecent(item);
      const label = clean(typeof item === "object" ? item.label || item.title || item.name : "", 100) || ROUTE_LABELS[route] || clean(item, 80) || "Workspace gần đây";
      rows.push({ id: `recent:${route}:${index}`, type: "recent", icon: "◷", title: label, meta: clean(item?.meta || item?.description, 120) || "Đã mở gần đây", route, progress: clamp(item?.progress, 0, 100), at: item?.updatedAt || item?.at || 0 });
    });
    const project = activeProject(snapshot);
    if (project) rows.push({ id: `project:${project.id || itemTitle(project)}`, type: "project", icon: "□", title: itemTitle(project), meta: "Dự án đang thực hiện", route: "/work/project-center", progress: clamp(project.progress, 0, 100), at: project.updatedAt });
    if (count.dueLearning.length) rows.push({ id: "learning:due", type: "lesson", icon: "◫", title: `${count.dueLearning.length} mục học đang đến hạn`, meta: "Tiếp tục hàng ôn tập", route: "/learn/review", progress: clamp(snapshot.learning.progress || snapshot.english.progress || snapshot.japanese.progress, 0, 100) });
    if (snapshot.comic && Object.keys(snapshot.comic).length) rows.push({ id: "comic:resume", type: "comic", icon: "CR", title: itemTitle(snapshot.comic, "Truyện đang đọc"), meta: clean(snapshot.comic.chapterLabel || snapshot.comic.chapter, 100) || "Tiếp tục chương gần nhất", route: "/comic-reader", progress: clamp(snapshot.comic.progress, 0, 100), at: snapshot.comic.updatedAt });
    count.activeJobs.slice(0, 2).forEach((job) => rows.push({ id: `job:${job.id || itemTitle(job)}`, type: "job", icon: "⇣", title: itemTitle(job), meta: `${jobState(job)} · ${clamp(job.progress, 0, 100)}%`, route: job.route || "/work", progress: clamp(job.progress, 0, 100), at: job.updatedAt }));
    return unique(rows, (item) => item.id).sort((a, b) => timestamp(b.at) - timestamp(a.at)).slice(0, 5);
  }

  function buildInbox(snapshot, count, state) {
    const rows = [];
    count.unread.forEach((item) => rows.push({
      id: `notice:${clean(item.id, 100) || uid("notice")}`, type: "notification", icon: "◇", title: itemTitle(item, "Thông báo mới"),
      meta: clean(item.message || item.description, 180), route: item.route || "/communication/notifications", at: item.createdAt || item.at
    }));
    count.failedJobs.forEach((item) => rows.push({
      id: `failed:${clean(item.id, 100) || itemTitle(item)}`, type: "queue", icon: "!", title: `Tác vụ lỗi: ${itemTitle(item)}`,
      meta: clean(item.error || item.message, 180) || "Có thể thử lại từ hàng đợi.", route: item.route || "/work", at: item.updatedAt || item.createdAt
    }));
    count.openTasks.filter((item) => taskDue(item) && taskDue(item) < Date.now()).forEach((item) => rows.push({
      id: `overdue:${clean(item.id, 100) || itemTitle(item)}`, type: "task", icon: "□", title: itemTitle(item),
      meta: `Đã quá hạn · ${new Date(taskDue(item)).toLocaleString("vi-VN")}`, route: "/work", at: item.updatedAt || item.createdAt
    }));
    count.dueLearning.slice(0, 5).forEach((item) => rows.push({
      id: `review:${clean(item.id || item.term || item.word, 100)}`, type: "learning", icon: "◫", title: itemTitle(item, "Mục học đến hạn"),
      meta: "Đang chờ ôn tập", route: "/learn/review", at: item.dueAt || item.nextReview
    }));
    count.comicUpdates.forEach((item) => rows.push({ id: `comic:${clean(item.id, 100) || itemTitle(item)}`, type: "comic", icon: "CR", title: itemTitle(item), meta: "Có cập nhật truyện mới", route: "/comic-reader", at: item.updatedAt || item.createdAt }));
    count.siteIssues.slice(0, 5).forEach((item) => rows.push({ id: `issue:${clean(item.id, 100) || itemTitle(item)}`, type: "system", icon: "⌁", title: itemTitle(item, "Cảnh báo hệ thống"), meta: clean(item.message || item.detail, 180), route: "/analytics", at: item.createdAt || item.at }));
    return unique(rows, (item) => item.id).map((item) => ({
      ...item, read: Boolean(state.inboxRead[item.id]), pinned: state.inboxPinned.includes(item.id),
      snoozedUntil: timestamp(state.inboxSnoozed[item.id])
    })).filter((item) => item.snoozedUntil <= Date.now()).sort((a, b) => Number(b.pinned) - Number(a.pinned) || timestamp(b.at) - timestamp(a.at));
  }

  function buildCalendar(snapshot, count) {
    const rows = [];
    count.openTasks.forEach((item) => { const at = taskDue(item); if (at) rows.push({ id: `task:${item.id || itemTitle(item)}`, type: "task", title: itemTitle(item), at, route: "/work" }); });
    const localEvent = readJson(`hh.home.live-widgets.v1.calendar:${ownerScope()}`, {});
    if (localEvent?.at) rows.push({ id: "local-event", type: "calendar", title: itemTitle(localEvent, "Sự kiện đã lưu"), at: timestamp(localEvent.at), route: "/home" });
    asArray(snapshot.youtube.scheduled || snapshot.youtube.queue).forEach((item) => { const at = timestamp(item.publishAt || item.scheduledAt); if (at) rows.push({ id: `youtube:${item.id || itemTitle(item)}`, type: "youtube", title: itemTitle(item), at, route: "/davinci-resolve/youtube" }); });
    asArray(snapshot.facebook.scheduled || snapshot.facebook.queue).forEach((item) => { const at = timestamp(item.publishAt || item.scheduledAt); if (at) rows.push({ id: `facebook:${item.id || itemTitle(item)}`, type: "facebook", title: itemTitle(item), at, route: "/davinci-resolve/facebook" }); });
    count.dueLearning.slice(0, 8).forEach((item) => rows.push({ id: `learn:${item.id || item.term || itemTitle(item)}`, type: "learning", title: itemTitle(item, "Ôn tập"), at: timestamp(item.dueAt || item.nextReview) || Date.now(), route: "/learn/review" }));
    return unique(rows, (item) => item.id).sort((a, b) => a.at - b.at).slice(0, 40);
  }

  function snapshotCounters(count) {
    return {
      openTasks: count.openTasks.length, doneTasks: count.doneTasks.length, activeJobs: count.activeJobs.length,
      failedJobs: count.failedJobs.length, completedJobs: count.completedJobs.length, unread: count.unread.length,
      learningDue: count.dueLearning.length, comicUpdates: count.comicUpdates.length, siteIssues: count.siteIssues.length
    };
  }

  function whatChanged(previous, current) {
    const rows = [];
    const delta = (key) => Number(current[key] || 0) - Number(previous?.[key] || 0);
    if (delta("doneTasks") > 0) rows.push(`${delta("doneTasks")} công việc đã hoàn thành`);
    if (delta("completedJobs") > 0) rows.push(`${delta("completedJobs")} upload/render đã hoàn tất`);
    if (delta("comicUpdates") > 0) rows.push(`${delta("comicUpdates")} cập nhật truyện mới`);
    if (delta("siteIssues") > 0) rows.push(`${delta("siteIssues")} cảnh báo website mới`);
    if (delta("learningDue") > 0) rows.push(`${delta("learningDue")} mục học mới đến hạn`);
    if (delta("unread") > 0) rows.push(`${delta("unread")} thông báo chưa đọc mới`);
    return rows;
  }

  function liveSnapshot() {
    try { return global.HHHomeLiveWidgets?.snapshot?.() || {}; }
    catch { return {}; }
  }

  function buildMission(live = liveSnapshot()) {
    const integrations = live.integrations && typeof live.integrations === "object" ? live.integrations : {};
    const integration = (id) => {
      const value = integrations[id];
      if (value === true || value?.ok === true || /ready|online|configured|active/i.test(String(value?.state || value || ""))) return { ok: true, verified: true };
      if (value === false || /failed|offline|error/i.test(String(value?.state || value || ""))) return { ok: false, verified: true };
      return { state: "unknown" };
    };
    const networkOnline = global.navigator?.onLine !== false;
    return [
      { id: "frontend", label: "Frontend", detail: Number.isFinite(Number(live.http)) ? `${Math.round(live.http)} ms HTTP` : "Chưa đo phản hồi HTTP", ...missionStatus(Number.isFinite(Number(live.http)) ? { ok: true, latency: Number(live.http) } : { pending: networkOnline }) },
      { id: "backend", label: "Backend API", detail: Number.isFinite(Number(live.api)) ? `${Math.round(live.api)} ms` : "Chưa có phản hồi API", ...missionStatus(Number.isFinite(Number(live.api)) ? { ok: true, latency: Number(live.api) } : { ok: networkOnline ? undefined : false }) },
      { id: "network", label: "Mạng trình duyệt", detail: clean(live.networkStatus, 90) || (networkOnline ? "Online" : "Offline"), ...missionStatus({ ok: networkOnline, responded: true }) },
      { id: "pwa", label: "Service Worker/PWA", detail: clean(live.serviceWorker, 90) || "Chưa kiểm tra", ...missionStatus(/active|ready|hoạt động|sẵn sàng/i.test(String(live.serviceWorker || "")) ? { ok: true, verified: true } : { state: "unknown" }) },
      { id: "storage", label: "Storage/Cache", detail: live.storage?.usage != null ? `${Math.round(Number(live.storage.usage) / 1048576)} MB đang dùng` : "Chưa được trình duyệt cung cấp", ...missionStatus(live.storage ? { ok: true, verified: true } : { supported: Boolean(global.navigator?.storage) }) },
      { id: "database", label: "Database", detail: "Chỉ xác minh từ Backend Health", ...missionStatus({ state: "unknown" }) },
      { id: "oauth", label: "OAuth", detail: "Không đọc token ở frontend", ...missionStatus({ state: "unknown" }) },
      { id: "vercel", label: "Vercel deployment", detail: "Chưa có probe deployment trong phiên", ...missionStatus({ state: "unknown" }) },
      { id: "web-vitals", label: "Web Vitals", detail: "Chưa đủ dữ liệu phiên", ...missionStatus({ state: "unknown" }) },
      { id: "openai", label: "OpenAI", detail: "Trạng thái cấu hình server", ...missionStatus(integration("openai")) },
      { id: "gemini", label: "Gemini", detail: "Trạng thái cấu hình server", ...missionStatus(integration("gemini")) },
      { id: "youtube", label: "YouTube OAuth", detail: "Riêng theo tài khoản", ...missionStatus(integration("youtube")) },
      { id: "facebook", label: "Facebook OAuth", detail: "Riêng theo tài khoản", ...missionStatus(integration("facebook")) },
      { id: "resend", label: "Resend", detail: "Dịch vụ email server", ...missionStatus(integration("resend")) }
    ];
  }

  function deriveModel(state) {
    const source = sourceSnapshot();
    const count = counters(source);
    const priorities = buildPriorities(source, count);
    const continueStack = buildContinueStack(source, count);
    const inbox = buildInbox(source, count, state);
    const currentCounters = snapshotCounters(count);
    const changed = state.lastVisitAt ? whatChanged(state.lastSnapshot, currentCounters) : [];
    const calendar = buildCalendar(source, count);
    const mission = buildMission();
    return { source, count, priorities, continueStack, inbox, currentCounters, changed, calendar, mission, project: activeProject(source) };
  }

  /* Public queue transition contract. It never invents completion: only a
     compatible state transition is returned, with the original checkpoint. */
  function transitionQueueItem(item, action) {
    const current = clone(item) || {};
    const state = jobState(current);
    const next = { ...current };
    if (action === "pause" && ["running", "processing", "waiting"].includes(state)) next.state = "paused";
    else if (action === "resume" && state === "paused") next.state = "running";
    else if (action === "retry" && ["failed", "error"].includes(state)) {
      next.state = "queued";
      next.retryFrom = Number(current.failedStep ?? current.currentStep ?? current.step ?? 0) || 0;
      next.attempt = (Number(current.attempt) || 0) + 1;
      next.error = "";
    } else return current;
    next.updatedAt = nowIso();
    return next;
  }

  function scopedKey(ownerId = "guest", learnerProfileId = "default") {
    const safeOwner = clean(ownerId || "guest", 100).replace(/[^a-z0-9@._-]/gi, "-") || "guest";
    const safeProfile = clean(learnerProfileId || "default", 100).replace(/[^a-z0-9@._-]/gi, "-") || "default";
    return `${STORAGE_PREFIX}:${safeOwner}:${safeProfile}`;
  }

  function currentLearnerProfile() {
    const user = currentIdentity();
    return clean(user?.learnerProfileId || user?.profileId || readJson("hh.auth.last-profile", "default"), 100) || "default";
  }

  function collectMorningBrief(model) {
    const { count, priorities, continueStack, mission } = model;
    const importantTask = priorities.find((item) => item.type === "task") || null;
    const nextEvent = model.calendar.find((item) => item.at >= Date.now()) || null;
    const lessonDue = count.dueLearning[0] || null;
    const activeTransfer = count.activeJobs[0] || null;
    const pendingPublish = count.activeJobs.find((item) => /publish|upload|youtube|facebook/i.test(`${item?.type || ""} ${itemTitle(item)}`)) || null;
    const comicUpdate = count.comicUpdates[0] || null;
    const websiteWarning = mission.find((item) => ["offline", "degraded"].includes(item.state)) || null;
    let nextAction = importantTask ? { title: itemTitle(importantTask), route: importantTask.route || "/work", reason: importantTask.priorityReason } : null;
    if (!nextAction && activeTransfer) nextAction = { title: "Theo dõi tác vụ đang chạy", route: "/home", reason: "Có một quy trình cần tiếp tục theo dõi." };
    if (!nextAction && lessonDue) nextAction = { title: itemTitle(lessonDue, "Ôn tập hôm nay"), route: "/learn/review", reason: "Bài học đang đến hạn." };
    if (!nextAction) nextAction = { title: "Khám phá một workspace", route: "/home", reason: "Chưa có việc gấp được ghi nhận." };
    return {
      "important-task": importantTask, "next-event": nextEvent, "lesson-due": lessonDue,
      "active-transfer": activeTransfer, "pending-publish": pendingPublish, "comic-update": comicUpdate,
      "website-warning": websiteWarning, "next-action": nextAction, continueStack
    };
  }

  function collectContinueStack(model) { return model.continueStack.slice(0, 5); }
  function collectUniversalInbox(model) { return model.inbox; }
  function collectWhatsNew(model, state) { return { rows: model.changed, lastVisitAt: state.lastVisitAt, counters: model.currentCounters }; }
  function suggestCaptureDestination(type, value = "") {
    const textValue = String(value).toLowerCase();
    if (type === "link" || /^https?:\/\//.test(textValue)) return { destination: "recent", label: "Lưu link vào Gần đây" };
    if (type === "vocabulary") return { destination: "learning", label: /japan|kanji|日本|nhật|kana|hiragana|katakana|jlpt/i.test(textValue) ? "Lưu vào HH Japanese" : "Lưu vào HH English" };
    if (type === "event") return { destination: "calendar", label: "Lưu vào lịch mini" };
    if (type === "file" || type === "image" || type === "recording") return { destination: "device-vault", label: "Lưu metadata vào Device Vault" };
    if (type === "idea") return { destination: "creative", label: "Lưu ý tưởng vào Sáng tạo" };
    if (type === "note") return { destination: "notes", label: "Lưu vào Sticky Notes" };
    return { destination: "work", label: "Tạo task trong Công việc" };
  }

  const commandRegistry = Object.freeze([
    { id: "open-japanese", phrases: ["mở hh japanese", "mở japanese", "japanese"], label: "Mở HH Japanese", route: "/japanese" },
    { id: "continue-thumbnail", phrases: ["tiếp tục thumbnail", "mở thumbnail hôm qua", "thumbnail"], label: "Tiếp tục thumbnail", route: "/davinci-resolve/image-text" },
    { id: "create-task", phrases: ["tạo công việc", "tạo task", "thêm task"], label: "Tạo công việc", action: "capture-task" },
    { id: "unpublished-video", phrases: ["video chưa đăng", "tìm video chưa đăng", "video chờ đăng"], label: "Tìm video chưa đăng", route: "/davinci-resolve/youtube" },
    { id: "backend-health", phrases: ["kiểm tra backend", "website health", "kiểm tra website"], label: "Kiểm tra backend", route: "/analytics" },
    { id: "continue-comic", phrases: ["đọc tiếp truyện", "đọc truyện", "tiếp tục truyện"], label: "Đọc tiếp truyện", route: "/comic-reader" },
    { id: "focus-mode", phrases: ["bật focus", "focus mode", "tập trung"], label: "Bật Focus 25 phút", action: "focus" }
  ]);

  function commandPreview(query, model) {
    const normalizedQuery = clean(query, 160).toLowerCase();
    if (!normalizedQuery) return commandRegistry.slice(0, 5).map((item) => ({ ...item, reason: "Lệnh nhanh" }));
    return commandRegistry.filter((item) => item.phrases.some((phrase) => normalizedQuery.includes(phrase) || phrase.includes(normalizedQuery)))
      .map((item) => ({ ...item, reason: item.action === "focus" ? "Không đổi route · mở Focus trong trang chủ" : `Mở ${ROUTE_LABELS[item.route] || item.route}` }));
  }

  function constellationProgress(model) {
    const completed = model.count.doneTasks.length;
    const projectsCompleted = model.source.projects.filter((item) => /done|completed|archived/i.test(String(item.status || ""))).length;
    const vocabularyLearned = Number(model.source.learning.learned || model.source.learning.mastered || model.source.english.learned || model.source.japanese.learned || 0) || 0;
    const contentPublished = [model.source.youtube, model.source.facebook].reduce((total, data) => total + asArray(data.published || data.history).length, 0);
    const focusMinutes = Number(readJson(`${STORAGE_PREFIX}:focus:${ownerScope()}`, {}).minutes || 0) || 0;
    const values = {
      tasksCompleted: completed, vocabularyLearned, contentPublished, projectsCompleted, focusMinutes,
      skillsUnlocked: Number(model.source.learning.skillsUnlocked || model.source.japaneseOs.skillsUnlocked || 0) || 0
    };
    const score = (a, b) => clamp(Math.round((a / Math.max(1, b)) * 100), 0, 100);
    return { ...values, percentages: {
      work: score(completed, completed + model.count.openTasks.length),
      learning: clamp(Math.round(Math.min(100, vocabularyLearned / 20)), 0, 100),
      creative: score(contentPublished + projectsCompleted, contentPublished + projectsCompleted + model.count.activeJobs.length + 1)
    } };
  }

  const QUEUE_KINDS = Object.freeze(["upload", "download", "render", "ocr", "ai", "import", "sync", "backup"]);
  const CONTINUE_KINDS = Object.freeze(["project", "lesson", "upload", "thumbnail", "comic"]);
  const SCENE_IDS = Object.freeze(["start-video", "publish-today", "quick-study", "check-website", "prepare-sleep", "end-day-backup"]);
  const MINI_CAPABILITIES = Object.freeze(["mini-minimize", "mini-pin", "mini-resize", "mini-snap"]);
  const SERVICE_IDS = Object.freeze(["frontend", "backend", "database", "oauth", "youtube", "facebook", "resend", "gemini", "openai", "vercel", "service-worker", "web-vitals"]);
  const SIGNAL_CLASSES = Object.freeze(["signal-deadline", "signal-transfer", "signal-backend-error", "signal-comic", "signal-learning", "signal-recent"]);
  const HANDOFF_TYPES = Object.freeze(["lesson", "comic", "note", "upload", "task"]);
  const FOCUS_TOOLS = Object.freeze(["focus-cockpit", "pomodoro", "focus-file", "focus-music", "focus-note", "focus-progress", "complete-focus", "switch-focus"]);
  const TIME_MACHINE_KINDS = Object.freeze(["opened", "file-edited", "setting-changed", "task-completed", "error", "ai-created", "restore-preview"]);
  const PROJECT_FIELDS = Object.freeze(["progress", "deadline", "members", "blocked", "recentFile", "lastOpenedAt", "relatedTools"]);
  // Explicit capability contracts keep the coordinator honest and make the
  // source of each dashboard card inspectable by the UI and test harness.
  const AUTOMATION_CALENDAR_SOURCES = Object.freeze(["personal", "deadline", "youtube", "facebook", "learning", "render", "comic", "website"]);
  const LEARNING_PULSE_FIELDS = Object.freeze(["english", "japanese", "reviewsDue", "weakSkill", "nextLesson", "quick-study-5", "quick-study-10", "quick-study-15"]);
  const COSMIC_CONCIERGE_ACTIONS = Object.freeze(["summarize-day", "find-tool", "explain-warning", "next-step", "create-plan", "draft-content"]);
  const MINI_WINDOW_TYPES = Object.freeze(["calculator", "notes", "music", "calendar", "timer", "image-viewer", "download-queue", "api-monitor"]);
  const AMBIENT_DESKTOP_SIGNALS = Object.freeze(["ambient-desktop", "weather", "work-mode", "website-status", "music-playing", "season"]);
  const SECURITY_BEACON_SIGNALS = Object.freeze(["session", "new-device", "microphone", "geolocation", "oauth-expiry", "account-connection", "last-backup", "local-only"]);
  const RESTORE_POLICY = Object.freeze({ restorePreview: "restore-preview", requiresConfirmation: true, confirmRestore: "restore-confirm" });
  const CLIPBOARD_POLICY = "clipboard-expires";
  const COMMAND_SHORTCUT = "Control+KeyK";
  const ambientSound = false;
  let qrLibraryPromise = null;

  function itemDate(value) {
    const at = timestamp(value);
    return at ? new Date(at).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Chưa có lịch";
  }

  function queueLabel(job) {
    const type = clean(job?.type || job?.kind || job?.area, 40).toLowerCase();
    if (/download|chapter|comic/.test(type)) return "download";
    if (/render|export|video/.test(type)) return "render";
    if (/ocr|text/.test(type)) return "ocr";
    if (/ai|prompt|gemini|openai/.test(type)) return "ai";
    if (/import|parse/.test(type)) return "import";
    if (/sync|cloud|oauth/.test(type)) return "sync";
    if (/backup|archive/.test(type)) return "backup";
    return /upload|publish|youtube|facebook/.test(type) ? "upload" : "sync";
  }

  function queueRows(model) {
    return model.source.jobs.map((job) => ({
      ...job, id: clean(job.id, 120) || uid("job"), kind: queueLabel(job), state: jobState(job),
      title: itemTitle(job, "Tác vụ nền"), progress: clamp(job.progress, 0, 100),
      route: job.route || (/youtube|publish/.test(queueLabel(job)) ? "/davinci-resolve/youtube" : "/work"),
      updatedAt: job.updatedAt || job.createdAt
    }));
  }
  function collectActiveQueue(model) { return queueRows(model).filter((item) => !["done", "completed", "success"].includes(item.state)); }

  function renderBrief(model, state) {
    const brief = collectMorningBrief(model);
    const changed = collectWhatsNew(model, state);
    const priority = model.priorities[0];
    const summary = priority ? priority.priorityReason : "Chưa có việc gấp được ghi nhận trong các nguồn dữ liệu hiện tại.";
    const briefRows = [
      ["important-task", "□", "Việc quan trọng", brief["important-task"] ? itemTitle(brief["important-task"]) : "Chưa có việc cần gấp", brief["important-task"]?.priorityReason || "Các task đang mở sẽ xuất hiện ở đây."],
      ["next-event", "◷", "Lịch sắp tới", brief["next-event"] ? itemTitle(brief["next-event"]) : "Chưa có lịch gần", brief["next-event"] ? itemDate(brief["next-event"].at) : "Các mốc có ngày sẽ xuất hiện ở đây."],
      ["lesson-due", "◫", "Bài học đến hạn", brief["lesson-due"] ? itemTitle(brief["lesson-due"]) : "Chưa có bài ôn", brief["lesson-due"] ? "Mở hàng ôn tập để tiếp tục." : "HH English và HH Japanese chưa có mục đến hạn."],
      ["active-transfer", "⇣", "Đang xử lý", brief["active-transfer"] ? itemTitle(brief["active-transfer"]) : "Không có tác vụ nền", brief["active-transfer"] ? `${jobState(brief["active-transfer"])} · ${clamp(brief["active-transfer"].progress, 0, 100)}%` : "Upload, download và render đều đang rảnh."],
      ["website-warning", "⌁", "Website", brief["website-warning"] ? brief["website-warning"].label : "Website chưa có cảnh báo", brief["website-warning"] ? brief["website-warning"].detail : "Chỉ hiển thị sau khi có phản hồi kiểm tra thật."]
    ];
    return `<div class="hco-brief" data-hco-morning-brief>
      <div class="hco-brief-hero"><div><small>MORNING BRIEF · DỮ LIỆU THẬT</small><h3>Chào ngày mới</h3><p>${escapeHtml(summary)}</p></div><button type="button" class="is-primary" data-hco-start-day>▶ Bắt đầu ngày mới</button></div>
      <div class="hco-brief-grid">${briefRows.map(([kind, icon, label, title, meta]) => `<article class="hco-brief-card" data-hco-brief-item="${kind}"><span>${icon}</span><div><small>${label}</small><strong>${escapeHtml(title)}</strong><em>${escapeHtml(meta)}</em></div></article>`).join("")}</div>
      <section class="hco-whats-new" data-hco-whats-new><header><div><small>DELTA SINCE LAST VISIT</small><h4>Có gì mới từ lần truy cập trước?</h4></div><button type="button" data-hco-mark-visit>Đã xem</button></header>${changed.rows.length ? `<ul>${changed.rows.map((row) => `<li><i></i>${escapeHtml(row)}</li>`).join("")}</ul>` : `<p>Chưa có thay đổi mới được ghi nhận kể từ lần truy cập trước.</p>`}</section>
      <section class="hco-priority"><header><div><small>SMART PRIORITY ENGINE</small><h4>Việc nên làm tiếp theo</h4></div><span>${model.priorities.length} mục</span></header>${model.priorities.slice(0, 4).map((item) => `<button type="button" class="hco-priority-row" data-hco-route="${escapeHtml(item.route)}"><i>${item.type === "task" ? "□" : item.type === "learning" ? "◫" : "!"}</i><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.priorityReason)}</small></span><b>${item.progress != null ? `${clamp(item.progress, 0, 100)}%` : "→"}</b></button>`).join("") || `<p class="hco-empty">Không có mục ưu tiên.</p>`}</section>
      <section class="hco-continue" data-hco-continue-stack><header><div><small>CONTINUE STACK</small><h4>Tiếp tục nội dung đang làm dở</h4></div><span>${model.continueStack.length}/5</span></header>${model.continueStack.map((item) => `<button type="button" data-hco-continue="${escapeHtml(item.id)}" data-hco-route="${escapeHtml(item.route)}"><i>${escapeHtml(item.icon)}</i><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.meta)}${item.progress ? ` · ${item.progress}%` : ""}</small></span><b>→</b></button>`).join("") || `<p class="hco-empty">Chưa có phiên đang làm dở. Khi mở workspace, hành trình sẽ được ghi ở đây.</p>`}</section>
    </div>`;
  }

  function renderInbox(model, state) {
    const origins = ["system", "youtube", "facebook", "work", "learning", "website", "download", "render", "comic"];
    const unread = model.inbox.filter((item) => !item.read).length;
    return `<div class="hco-inbox" data-hco-inbox><header class="hco-panel-hero"><div><small>UNIVERSAL INBOX · ${unread} CHƯA ĐỌC</small><h3>Một hộp thư cho toàn hệ thống</h3><p>Thông báo được gom từ các module hiện có và vẫn giữ nguồn gốc để bạn kiểm tra.</p></div><button type="button" data-hco-inbox-refresh>↻ Làm mới</button></header><nav class="hco-filter-row" aria-label="Nguồn thông báo">${origins.map((origin) => `<button type="button" data-hco-inbox-filter="${origin}">${origin}</button>`).join("")}<button type="button" data-hco-inbox-filter="all" aria-pressed="true">Tất cả</button></nav><div class="hco-inbox-list">${model.inbox.slice(0, 12).map((item) => `<article class="hco-inbox-item${item.read ? " is-read" : ""}${item.pinned ? " is-pinned" : ""}" data-hco-inbox-item="${escapeHtml(item.id)}" data-hco-origin="${escapeHtml(item.origin || item.type)}"><i>${escapeHtml(item.icon)}</i><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.meta || "Không có mô tả")}</p><time>${escapeHtml(relative(item.at))}</time></div><div class="hco-item-actions"><button type="button" data-hco-inbox-action="mark-read">${item.read ? "Chưa đọc" : "Đã đọc"}</button><button type="button" data-hco-inbox-action="snooze">Hoãn 1 giờ</button><button type="button" data-hco-inbox-action="pin">${item.pinned ? "Bỏ ghim" : "Ghim"}</button><button type="button" data-hco-inbox-action="to-task">→ Task</button></div></article>`).join("") || `<p class="hco-empty">Hộp thư đang trống. Khi có dữ liệu thật, mục mới sẽ xuất hiện ở đây.</p>`}</div></div>`;
  }

  function renderQueue(model) {
    const rows = queueRows(model);
    return `<div class="hco-queue" data-hco-queue><header class="hco-panel-hero"><div><small>ACTIVE QUEUE CENTER · ${rows.filter((item) => ["running", "processing", "queued", "waiting", "paused"].includes(item.state)).length} ĐANG THEO DÕI</small><h3>Tác vụ nền và điểm tiếp tục</h3><p>Pause, resume và retry giữ nguyên checkpoint thật khi nguồn dữ liệu hỗ trợ.</p></div><button type="button" data-hco-queue-refresh>↻ Quét lại</button></header><div class="hco-queue-kinds">${QUEUE_KINDS.map((kind) => `<span data-hco-queue-kind="${kind}">${kind}</span>`).join("")}</div><div class="hco-queue-list">${rows.slice(0, 14).map((item) => { const canPause = ["running", "processing", "waiting"].includes(item.state); const canResume = item.state === "paused"; const canRetry = ["failed", "error"].includes(item.state); return `<article class="hco-queue-item is-${escapeHtml(item.state)}" data-hco-queue-item="${escapeHtml(item.id)}"><i>${item.kind === "upload" ? "↥" : item.kind === "download" ? "⇣" : item.kind === "render" ? "◈" : item.kind === "ocr" ? "A" : "✦"}</i><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.kind)} · ${escapeHtml(item.state)} · ${item.progress}%</small><progress max="100" value="${item.progress}"></progress></div><div class="hco-item-actions"><button type="button" data-hco-queue-action="pause" ${canPause ? "" : "disabled"}>Pause</button><button type="button" data-hco-queue-action="resume" ${canResume ? "" : "disabled"}>Resume</button><button type="button" data-hco-queue-action="retry" ${canRetry ? "" : "disabled"}>Retry</button><button type="button" data-hco-queue-action="open">Chi tiết</button></div></article>`; }).join("") || `<p class="hco-empty">Chưa có upload, download, render, OCR, AI, import, sync hoặc backup đang chạy.</p>`}</div></div>`;
  }

  function renderWorkspace(model, state) {
    const focus = state.focus;
    const focusRemaining = focus.running && focus.endAt ? Math.max(0, Math.ceil((focus.endAt - Date.now()) / 1000)) : focus.duration;
    const project = model.project;
    const progress = constellationProgress(model);
    const splitPresets = [
      ["calendar-work", "Lịch + Công việc", "calendar", "work", "/work"],
      ["thumbnail-title", "Thumbnail + AI tiêu đề", "thumbnail", "title", "/davinci-resolve/image-text"],
      ["youtube-schedule", "YouTube + Lịch đăng", "youtube", "schedule", "/davinci-resolve/youtube"],
      ["english-dictionary", "HH English + Từ điển", "english", "dictionary", "/learn/english"],
      ["comic-notes", "Đọc truyện + Ghi chú", "comic", "notes", "/comic-reader"],
      ["upload-channel", "Upload + Kênh", "upload", "channel", "/davinci-resolve/youtube"]
    ];
    return `<div class="hco-workspace" data-hco-workspace><section class="hco-focus-cockpit" data-hco-focus-cockpit data-hco-focus-center><header><div><small>FOCUS ORBIT · ${focus.running ? "ĐANG TẬP TRUNG" : "SẴN SÀNG"}</small><h3>Một nhiệm vụ, một phiên hoàn chỉnh</h3></div><button type="button" data-hco-focus-mode ${focus.running ? "data-hco-focus-pause" : "data-hco-focus-start"}>${focus.running ? "Tạm dừng" : "Bắt đầu Focus"}</button><button type="button" data-hco-focus-resume ${focus.running ? "hidden" : ""}>Tiếp tục</button></header><div class="hco-focus-grid"><strong data-hco-focus-time>${String(Math.floor(focusRemaining / 60)).padStart(2, "0")}:${String(focusRemaining % 60).padStart(2, "0")}</strong><div><p data-hco-focus-task>${escapeHtml(model.priorities[0]?.title || "Chọn một việc để bắt đầu")}</p><small data-hco-focus-progress data-hco-focus-stats>${focus.completed || 0} phiên hoàn thành · ${focus.duration / 60} phút</small></div><button type="button" data-hco-focus-action="complete-focus">Hoàn thành</button><button type="button" data-hco-focus-action="switch-focus">Chuyển việc</button></div><div class="hco-focus-tools"><button type="button" data-hco-focus-file>＋ File liên quan</button><button type="button" data-hco-focus-notification-shield aria-pressed="false">◇ Chặn nhắc nội bộ</button><button type="button" data-hco-open-mini="music">♫ Nhạc tập trung</button><button type="button" data-hco-open-mini="notes">N Ghi chú nhanh</button><span>Tiến độ phiên: ${focus.running ? "đang chạy" : "chưa bắt đầu"}</span></div></section><section class="hco-split-workspace" data-hco-split-workspace><header><div><small>SPLIT WORKSPACE · KHÔNG MỞ CỬA SỔ MỚI</small><h3>Mở hai ngữ cảnh ngay tại trang chủ</h3></div><span>Snap</span></header><div class="hco-split-grid">${splitPresets.map(([id, label, left, right, route]) => `<button type="button" data-hco-split-preset="${id}" data-hco-route="${route}"><i>${left === "calendar" ? "◷" : left === "thumbnail" ? "TX" : left === "youtube" ? "YT" : left === "english" ? "E" : left === "comic" ? "CR" : "↥"}</i><strong>${label}</strong><small>${left} + ${right}</small></button>`).join("")}</div><div class="hco-split-preview" data-hco-split-preview hidden></div></section><section class="hco-project-pulse" data-hco-project-pulse><header><div><small>PROJECT PULSE</small><h3>${escapeHtml(project ? itemTitle(project) : "Chưa có dự án hiện tại")}</h3></div><button type="button" data-hco-route="/work/project-center">Mở Project Center</button></header><div class="hco-pulse-metrics"><span><b>${project ? `${clamp(project.progress, 0, 100)}%` : "—"}</b><small>Tiến độ</small></span><span><b>${model.count.openTasks.length}</b><small>Task mở</small></span><span><b>${model.count.siteIssues.length}</b><small>Bị chặn/cảnh báo</small></span><span><b>${project?.members?.length || 0}</b><small>Thành viên</small></span></div><p>File gần đây: ${escapeHtml(itemTitle(project?.recentFile || {}, "Chưa có file mới"))} · Công cụ liên quan: ${escapeHtml(project?.tool || "Project Center")}</p></section><section class="hco-content-pipeline" data-hco-content-pipeline><header><div><small>CONTENT PIPELINE</small><h3>Ý tưởng → Kịch bản → Voice → Ảnh → Thumbnail → Render → Kiểm tra → Đăng</h3></div><button type="button" data-hco-pipeline-reset>Đặt lại</button></header><div class="hco-pipeline-track">${PIPELINE.map(([id, label, route]) => `<button type="button" class="is-${state.pipeline[id]}" data-hco-pipeline-step="${id}" data-hco-route="${route}"><i>${state.pipeline[id] === "done" ? "✓" : state.pipeline[id] === "doing" ? "●" : "○"}</i><strong>${label}</strong></button>`).join("")}</div></section><section class="hco-learning-pulse" data-hco-learning-pulse><header><div><small>LEARNING PULSE</small><h3>Học tập không gây áp lực</h3></div><span>${model.count.dueLearning.length} mục đến hạn</span></header><div class="hco-learning-grid"><span><b>${Number(model.source.english.progress || 0)}%</b><small>HH English</small></span><span><b>${Number(model.source.japanese.progress || model.source.japaneseOs.progress || 0)}%</b><small>HH Japanese</small></span><span><b>${model.count.dueLearning.length}</b><small>Reviews due</small></span><span><b>${escapeHtml(itemTitle(model.source.learning.weakSkill || {}, "Chưa có dữ liệu"))}</b><small>Kỹ năng cần luyện</small></span></div><div class="hco-quick-study"><button type="button" data-hco-route="/learn/review" data-hco-quick-study="5">5 phút</button><button type="button" data-hco-route="/learn/review" data-hco-quick-study="10">10 phút</button><button type="button" data-hco-route="/learn/review" data-hco-quick-study="15">15 phút</button></div></section></div>`;
  }

  function renderAutomation(model, state) {
    const sceneState = (scene) => state.automations.find((item) => item.sceneId === scene.id) || { state: "queued", step: 0 };
    const sceneRows = state.automations.map((run) => ({
      title: SCENES.find((scene) => scene.id === run.sceneId)?.label || run.sceneId,
      state: run.state,
      retryFrom: run.retryFrom,
      at: run.updatedAt || run.startedAt
    }));
    const jobRows = model.source.jobs.map((job) => ({ title: itemTitle(job), state: jobState(job), retryFrom: job.failedStep ?? job.currentStep, at: job.updatedAt || job.createdAt }));
    const radarRows = [...sceneRows, ...jobRows].sort((a, b) => timestamp(b.at) - timestamp(a.at)).slice(0, 8);
    return `<div class="hco-automation" data-hco-automation><section data-hco-automation-scenes><header class="hco-panel-hero"><div><small>AUTOMATION SCENES</small><h3>Chuỗi thao tác có checkpoint</h3><p>Chạy từng bước, cần xác nhận trước hành động gửi, xóa hoặc publish.</p></div></header><div class="hco-scene-grid">${SCENES.map((scene) => { const run = sceneState(scene); const currentStep = scene.steps[Math.min(run.step || 0, scene.steps.length - 1)]?.[0]; return `<button type="button" data-hco-scene="${scene.id}" class="is-${escapeHtml(run.state)}"><i>${scene.icon}</i><strong>${scene.label}</strong><small>${run.state === "running" ? `${escapeHtml(currentStep)} · bước ${run.step + 1}/${scene.steps.length}` : run.state === "completed" ? "Đã hoàn tất · bấm để chạy lại" : "Bấm để bắt đầu và kiểm tra từng bước"}</small></button>`; }).join("")}</div></section><section class="hco-automation-radar" data-hco-automation-radar><header><div><small>AUTOMATION RADAR</small><h3>Quy trình đang chạy</h3></div><button type="button" data-hco-automation-refresh>↻</button></header><div>${radarRows.map((row) => `<p class="is-${escapeHtml(row.state)}"><i></i><span>${escapeHtml(row.title)}<small>${escapeHtml(row.state)}${row.retryFrom != null ? ` · retryFrom ${row.retryFrom}` : ""}</small></span></p>`).join("") || `<p class="hco-empty">Chưa có running, queued, failed hoặc needs-confirmation.</p>`}</div><footer><span>Trạng thái: running · queued · failed · needs-confirmation · completed</span><b data-hco-automation-log>${state.automations.length} scene đã lưu</b></footer></section><section class="hco-smart-calendar" data-hco-smart-calendar data-hco-calendar-sources="${AUTOMATION_CALENDAR_SOURCES.join(" ")}"><header><div><small>SMART CALENDAR</small><h3>Lịch hợp nhất</h3></div><div class="hco-calendar-tabs"><button type="button" data-hco-calendar-view="day" aria-pressed="true">Ngày</button><button type="button" data-hco-calendar-view="week">Tuần</button><button type="button" data-hco-calendar-view="timeline">24h</button></div></header><div class="hco-calendar-day" data-hco-calendar-view-panel="day">${model.calendar.slice(0, 8).map((item) => `<button type="button" data-hco-route="${escapeHtml(item.route)}"><time>${escapeHtml(itemDate(item.at))}</time><span>${escapeHtml(item.title)}</span><small>${escapeHtml(item.type)}</small></button>`).join("") || `<p class="hco-empty">Chưa có deadline, lịch YouTube/Facebook, lịch học, render, truyện hoặc sự kiện website.</p>`}</div><div class="hco-calendar-week" data-hco-calendar-view-panel="week" hidden><p>Tuần này có <strong>${model.calendar.length}</strong> mốc được lấy từ dữ liệu hiện có.</p></div><div class="hco-calendar-timeline" data-hco-calendar-view-panel="timeline" hidden><p>Timeline 24 giờ sẽ ưu tiên mốc gần nhất: <strong>${model.calendar[0] ? escapeHtml(model.calendar[0].title) : "chưa có"}</strong>.</p></div></section></div>`;
  }

  function activityIdentity(item, index = 0) {
    return clean(item?.id || item?.eventId || item?.createdAt || item?.at || `history-${index}`, 120);
  }

  function renderTools(model, state) {
    const clipboard = state.clipboard.slice(0, 8);
    const timeline = model.source.activities.slice(0, 8).map((item, index) => ({ ...item, id: activityIdentity(item, index) }));
    return `<div class="hco-tools" data-hco-tools><section class="hco-capture-panel" data-hco-quick-capture><header><div><small>QUICK CAPTURE · LOCAL FIRST</small><h3>Ghi nhanh một ý tưởng</h3></div><button type="button" data-hco-capture-open>＋ Capture</button></header><p>Nhập task, note, idea, link, file, image, recording, event hoặc vocabulary. Hệ thống chỉ lưu sau khi bạn xác nhận.</p><button type="button" class="hco-drop-zone" data-hco-global-drop-zone><span>⇩</span><strong>Global Drop Zone</strong><small>Kéo file vào đây rồi chọn thumbnail, OCR, convert, upload-video, add-project, audio-analysis, backup hoặc device-vault.</small></button><div class="hco-drop-choices" data-hco-drop-choices hidden>${[["thumbnail", "Mở Thumbnail"], ["ocr", "Chạy OCR"], ["convert", "Chuyển đổi file"], ["upload-video", "Upload video"], ["add-project", "Thêm vào dự án"], ["audio-analysis", "Phân tích âm thanh"], ["backup", "Backup"], ["device-vault", "Device Vault"]].map(([id, label]) => `<button type="button" data-hco-drop-choice="${id}">${label}</button>`).join("")}</div></section><section class="hco-smart-clipboard" data-hco-smart-clipboard><header><div><small>SMART CLIPBOARD · LOCAL ONLY</small><h3>Lịch sử clipboard</h3></div><button type="button" data-hco-clipboard-read>Đọc clipboard</button></header><p class="hco-privacy-copy">Chỉ đọc sau thao tác chủ động. Secret, password, token và private key sẽ bị loại bỏ.</p><div class="hco-clipboard-list">${clipboard.map((item) => `<article data-hco-clipboard-item="${escapeHtml(item.id)}"><span>${escapeHtml(item.text)}</span><small>${escapeHtml(relative(item.createdAt))}</small><button type="button" data-hco-clipboard-pin="${escapeHtml(item.id)}">${item.pinned ? "★" : "☆"}</button><button type="button" data-hco-clipboard-delete="${escapeHtml(item.id)}">×</button></article>`).join("") || `<p class="hco-empty">Chưa có nội dung clipboard an toàn.</p>`}</div></section><section class="hco-mini-launcher" data-hco-mini-launcher><header><div><small>COSMIC MINI WINDOWS</small><h3>Mở tiện ích tại chỗ</h3></div><span>Minimize · Pin · Resize · Snap</span></header><div>${[["calculator", "Máy tính", "＋"], ["notes", "Sticky Notes", "N"], ["music", "Nhạc", "♫"], ["calendar", "Lịch", "◷"], ["timer", "Timer", "◉"], ["image-viewer", "Trình xem ảnh", "▣"], ["download-queue", "Download queue", "⇣"], ["api-monitor", "API monitor", "⌁"]].map(([id, label, icon]) => `<button type="button" data-hco-open-mini="${id}"><i>${icon}</i><span>${label}</span></button>`).join("")}</div></section><section class="hco-handoff-panel" data-hco-cross-device-handoff><header><div><small>CROSS-DEVICE HANDOFF</small><h3>Tiếp tục trên điện thoại</h3></div><button type="button" data-hco-handoff-create>⌁ Tạo QR</button></header><p>QR chỉ chứa handoffId vô nghĩa, không chứa token hoặc mật khẩu. Cần đăng nhập cùng tài khoản trên thiết bị đích.</p><div data-hco-handoff-output><span>Chưa tạo handoff.</span></div></section><section class="hco-time-machine" data-hco-activity-time-machine><header><div><small>ACTIVITY TIME MACHINE</small><h3>Lịch sử hoạt động có thể xem lại</h3></div><button type="button" data-hco-time-filter="all">Tất cả</button></header><div>${timeline.map((item) => `<article data-hco-history-kind="${escapeHtml(item.type || "opened")}"><i>${escapeHtml(item.icon || "◷")}</i><span><strong>${escapeHtml(item.text || itemTitle(item))}</strong><small>${escapeHtml(item.source || "Activity Bus")} · ${escapeHtml(relative(item.createdAt || item.at))}</small></span><button type="button" data-hco-restore-preview="${escapeHtml(item.id || "")}">Xem trước</button></article>`).join("") || `<p class="hco-empty">Chưa có opened, file-edited, setting-changed, task-completed, error hoặc ai-created trong lịch sử.</p>`}</div><p class="hco-restore-note">Restore chỉ mở preview và cần xác nhận; không tự phục hồi dữ liệu.</p></section></div>`;
  }

  function renderMission(model) {
    const constellation = constellationProgress(model);
    return `<div class="hco-mission" data-hco-website-mission-control><section class="hco-mission-grid"><header class="hco-panel-hero"><div><small>WEBSITE MISSION CONTROL · REAL PROBES</small><h3>Trạng thái hệ thống</h3><p>Frontend, backend, database, OAuth và Web Vitals chỉ được đánh dấu hoạt động sau phản hồi xác minh.</p></div><button type="button" data-hco-mission-refresh>↻ Kiểm tra lại</button></header><div class="hco-service-grid">${model.mission.map((item) => `<article class="is-${escapeHtml(item.state)}" data-hco-service="${escapeHtml(item.id)}"><i></i><div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></div><b>${escapeHtml(item.label === "Service Worker/PWA" ? "service-worker" : item.state)}</b></article>`).join("")}</div></section><section class="hco-security-beacon" data-hco-security-beacon><header><div><small>PRIVACY &amp; SECURITY BEACON</small><h3>Bảo mật theo tài khoản</h3></div><span class="is-safe">LOCAL / OWNER SCOPED</span></header><ul><li><i>◉</i><span>Phiên đăng nhập<small>${global.HHAuthSession?.token?.() ? "Đã xác thực trong phiên" : "Khách hoặc chưa có token"}</small></span></li><li><i>◇</i><span>Thiết bị mới<small>Kiểm tra trong Security Center khi có phiên khác</small></span></li><li><i>⌁</i><span>Microphone / geolocation<small>Chỉ xin quyền sau thao tác chủ động</small></span></li><li><i>↻</i><span>OAuth expiry<small>Không đọc token ở frontend</small></span></li><li><i>▣</i><span>Last backup<small>${escapeHtml(relative(readJson(STORES.backup, {})?.updatedAt))}</small></span></li><li><i>□</i><span>Local-only<small>Clipboard và file metadata không tự gửi lên server</small></span></li></ul></section><section class="hco-constellation-progress" data-hco-constellation-progress><header><div><small>CONSTELLATION PROGRESS</small><h3>Chòm sao tiến độ thật</h3></div><span>Không áp lực streak</span></header><div class="hco-progress-stars">${[["work", "Công việc", constellation.percentages.work, constellation.tasksCompleted], ["learning", "Học tập", constellation.percentages.learning, constellation.vocabularyLearned], ["creative", "Sáng tạo", constellation.percentages.creative, constellation.contentPublished]].map(([id, label, percent, value]) => `<article data-hco-star="${id}"><i style="--progress:${percent}%"></i><strong>${label}</strong><b>${percent}%</b><small>${value} hoạt động ghi nhận</small></article>`).join("")}</div></section></div>`;
  }

  function renderProfiles(state) {
    const setting = state.settings;
    return `<div class="hco-profiles" data-hco-home-profiles data-hco-settings>
      <section class="hco-profile-picker"><header><div><small>HOME PROFILES · PHẠM VI TÀI KHOẢN</small><h3>Chọn không gian làm việc</h3></div><span>Không mất tiến độ</span></header><div>${PROFILES.map(([id, label, description]) => `<button type="button" class="${state.profile === id ? "is-active" : ""}" data-hco-profile="${id}"><i>${id === "work" ? "□" : id === "learning" ? "◫" : id === "creative" ? "✦" : id === "website" ? "⌁" : id === "family" ? "♥" : "H"}</i><span><strong>${label}</strong><small>${description}</small></span></button>`).join("")}</div></section>
      <section class="hco-settings-grid" aria-label="Cấu hình Cosmic OS">
        <article data-hco-settings-appearance><small>GIAO DIỆN</small><h3>Khả năng đọc</h3><label>Mật độ<select data-hco-setting="density"><option value="compact" ${setting.density === "compact" ? "selected" : ""}>Gọn</option><option value="comfortable" ${setting.density === "comfortable" ? "selected" : ""}>Cân bằng</option><option value="spacious" ${setting.density === "spacious" ? "selected" : ""}>Rộng</option></select></label><label>Cỡ chữ<input type="range" min="0.9" max="1.3" step="0.05" value="${setting.fontScale}" data-hco-setting="fontScale"><output>${Math.round(setting.fontScale * 100)}%</output></label><label>Tương phản<select data-hco-setting="contrast"><option value="normal" ${setting.contrast === "normal" ? "selected" : ""}>Tiêu chuẩn</option><option value="high" ${setting.contrast === "high" ? "selected" : ""}>Cao</option></select></label></article>
        <article data-hco-settings-motion><small>CHUYỂN ĐỘNG</small><h3>Hiệu ứng có kiểm soát</h3><label>Chế độ<select data-hco-setting="motion"><option value="static" ${setting.motion === "static" ? "selected" : ""}>Tĩnh</option><option value="balanced" ${setting.motion === "balanced" ? "selected" : ""}>Cân bằng</option><option value="cinematic" ${setting.motion === "cinematic" ? "selected" : ""}>Điện ảnh</option></select></label><label><input type="checkbox" data-hco-setting="reducedEffectsWhileTyping" ${setting.reducedEffectsWhileTyping ? "checked" : ""}> Giảm glow khi nhập liệu</label></article>
        <article data-hco-settings-language><small>NGÔN NGỮ &amp; THỜI GIAN</small><h3>Hiển thị địa phương</h3><label>Ngôn ngữ<select data-hco-setting="language"><option value="vi" ${setting.language === "vi" ? "selected" : ""}>Tiếng Việt</option><option value="en" ${setting.language === "en" ? "selected" : ""}>English</option></select></label><p>Múi giờ được lấy từ thiết bị: ${escapeHtml(Intl.DateTimeFormat().resolvedOptions().timeZone || "Thiết bị")}</p></article>
        <article data-hco-settings-notifications><small>THÔNG BÁO</small><h3>Chỉ báo trong HH Platform</h3><label><input type="checkbox" data-hco-setting="notifications" ${setting.notifications ? "checked" : ""}> Cho phép nhắc việc nội bộ</label><p>Trình duyệt chỉ được hỏi quyền sau thao tác chủ động.</p></article>
        <article data-hco-settings-privacy><small>QUYỀN RIÊNG TƯ</small><h3>Local-first</h3><p>Clipboard, ghi chú nhanh và metadata file không tự rời thiết bị. Không hiển thị mã tài khoản trong giao diện.</p><button type="button" data-hco-permission-open>Mở Permission Observatory</button></article>
        <article data-hco-settings-offline><small>OFFLINE &amp; CACHE</small><h3>Dùng khi mất mạng</h3><label><input type="checkbox" data-hco-setting="offline" ${setting.offline ? "checked" : ""}> Cho phép cache workspace hỗ trợ offline</label><button type="button" data-hco-cache-audit>Kiểm tra dung lượng</button></article>
        <article data-hco-settings-shortcuts><small>PHÍM TẮT</small><h3>Điều hướng nhanh</h3><p><kbd>Ctrl/⌘ K</kbd> tìm toàn hệ thống · <kbd>Esc</kbd> đóng sheet · phím mũi tên đổi module.</p></article>
        <article data-hco-settings-accessibility><small>TRỢ NĂNG</small><h3>Điều khiển rõ ràng</h3><p>Hỗ trợ bàn phím, focus hiển thị, đọc trạng thái và prefers-reduced-motion.</p></article>
      </section>
      <section class="hco-data-center" data-hco-settings-data><header><div><small>DATA &amp; RECOVERY CENTER</small><h3>Sao lưu cấu hình an toàn</h3></div><span>Schema v${schemaVersion}</span></header><p>Dữ liệu đồng bộ: profile, tab, pipeline và tùy chọn hiển thị. Clipboard, file, secret và thông tin định danh không được xuất hoặc đồng bộ.</p><div><button type="button" data-hco-export>Xuất JSON</button><button type="button" data-hco-import>Nhập JSON</button><button type="button" data-hco-checkpoint>Tạo checkpoint</button><button type="button" data-hco-delete-data data-hco-confirmation="required">Xóa dữ liệu…</button></div><input type="file" accept="application/json,.json" data-hco-import-input hidden></section>
      <section class="hco-context-panel" data-hco-context-aware><header><div><small>CONTEXT-AWARE HOMEPAGE</small><h3>Đang thích ứng theo tín hiệu</h3></div><button type="button" data-hco-ambient-toggle>${state.ambient ? "Ambient: Bật" : "Ambient: Tắt"}</button></header><p data-hco-context-copy>Buổi sáng · ưu tiên lịch và việc quan trọng. Khi có active-upload, website-incident hoặc near-deadline, hệ thống sẽ đẩy tín hiệu liên quan lên trước.</p><div class="hco-context-signals"><span>morning</span><span>work-hours</span><span>evening</span><span>active-upload</span><span>website-incident</span><span>near-deadline</span></div></section>
      <section class="hco-screensaver-settings" data-hco-cosmic-screensaver><header><div><small>COSMIC SCREENSAVER</small><h3>Màn hình chờ thiên hà</h3></div><button type="button" data-hco-screensaver-toggle>${state.screensaver ? "Đang bật" : "Đang tắt"}</button></header><p>Tự xuất hiện sau ${Math.round(state.screensaverDelay / 60)} phút không thao tác, dừng khi tab bị ẩn và thoát bằng chuột hoặc bàn phím.</p></section>
    </div>`;
  }

  function tabMarkup(instance, model) {
    const tab = instance.state.activeTab;
    if (tab === "brief") return renderBrief(model, instance.state);
    if (tab === "inbox") return renderInbox(model, instance.state);
    if (tab === "queue") return renderQueue(model);
    if (tab === "workspace") return renderWorkspace(model, instance.state);
    if (tab === "automation") return renderAutomation(model, instance.state);
    if (tab === "tools") return renderTools(model, instance.state);
    if (tab === "mission") return renderMission(model);
    return renderProfiles(instance.state);
  }


  function inspectorMarkup(instance, model) {
    const active = TABS.find((item) => item[0] === instance.state.activeTab) || TABS[0];
    const permissionKinds = [["microphone", "Microphone"], ["camera", "Camera"], ["clipboard-read", "Clipboard"], ["notifications", "Thông báo"]];
    return `<div class="hco-inspector-content">
      <header><small>NGỮ CẢNH HIỆN TẠI</small><h3>${escapeHtml(active[1])}</h3><button type="button" data-hco-inspector-close aria-label="Đóng bảng ngữ cảnh" title="Đóng bảng ngữ cảnh">×</button></header>
      <section aria-label="route tool project setting command" data-hco-universal-search><label>Tìm xuyên HH Platform<input type="search" data-hco-universal-search-input placeholder="Công cụ, dự án, cài đặt…" autocomplete="off"></label><div data-hco-universal-search-results aria-live="polite"></div></section>
      <section data-hco-context-actions><small>HÀNH ĐỘNG PHÙ HỢP</small><button type="button" data-hco-capture-open>＋ Ghi nhanh</button><button type="button" data-hco-command-open>Mở Command Palette</button><button type="button" data-hco-dashboard-customize>Tùy chỉnh dashboard</button><button type="button" data-hco-dashboard-reset>Khôi phục mặc định</button></section>
      <section data-hco-smart-priority><small>SMART PRIORITY</small><strong>${escapeHtml(model.priorities[0]?.title || "Không có việc khẩn cấp")}</strong><p data-hco-priority-reason>${escapeHtml(model.priorities[0]?.priorityReason || "Chưa có dữ liệu đủ để xếp hạng.")}</p></section>
      <section data-hco-permission-center><small>PERMISSION OBSERVATORY</small><h3>Quyền của trình duyệt</h3>${permissionKinds.map(([id, label]) => `<article data-hco-permission="${id}"><span><strong>${label}</strong><small data-hco-permission-state>Chưa kiểm tra</small></span><button type="button" data-hco-permission-check="${id}">Kiểm tra</button><button type="button" data-hco-permission-help="${id}">Cách thu hồi</button></article>`).join("")}</section>
      <section data-hco-recovery-center><small>RECOVERY CENTER</small><h3>Khôi phục có xem trước</h3><p>Checkpoint cục bộ gần nhất: ${escapeHtml(relative(instance.state.lastSnapshot?.createdAt))}</p><button type="button" data-hco-recovery-checkpoint>Tạo checkpoint</button><button type="button" data-hco-recovery-preview>Xem trước checkpoint</button><button type="button" data-hco-recovery-confirm data-hco-recovery-candidate="checkpoint" disabled>Khôi phục sau preview</button></section>
      <section data-hco-activity-center><small>ACTIVITY TIMELINE</small><h3>Thao tác gần đây</h3><label>Lọc<select data-hco-activity-filter><option value="all">Tất cả</option><option value="error">Lỗi</option><option value="task-completed">Hoàn thành</option></select></label><button type="button" data-hco-activity-undo data-hco-undoable="false" disabled>Hoàn tác khi an toàn</button></section>
      <section data-hco-security-center><small>SECURITY CENTER</small><h3>Bảo mật phiên</h3><p>Không đưa thông tin đăng nhập vào HTML, URL hoặc bản xuất. Phiên và quyền nhạy cảm do trình duyệt kiểm soát.</p><button type="button" data-hco-route="/settings/security-center">Mở trung tâm bảo mật</button></section>
    </div>`;
  }

  function shellMarkup(instance, model) {
    const tabs = TABS.map(([id, label, icon]) => `<button type="button" data-hco-nav-item data-hco-tab="${id}" aria-current="${instance.state.activeTab === id ? "page" : "false"}" aria-selected="${instance.state.activeTab === id}"><i aria-hidden="true">${icon}</i><span>${label}</span><b>${id === "inbox" ? model.count.unread.length || "" : id === "queue" ? model.count.activeJobs.length || "" : ""}</b></button>`).join("");
    return `<div class="hco-root" data-hco-root data-context-aware data-hco-profile="${escapeHtml(instance.state.profile)}" data-hco-motion="${escapeHtml(instance.state.settings.motion)}" data-hco-density="${escapeHtml(instance.state.settings.density)}" data-hco-contrast="${escapeHtml(instance.state.settings.contrast)}" style="--hco-font-scale:${instance.state.settings.fontScale}">
      <section class="hco-command-deck ${instance.state.sidebarCollapsed ? "is-sidebar-collapsed" : ""} ${instance.state.inspectorOpen ? "is-inspector-open" : ""}" data-hco-command-deck aria-labelledby="hcoTitle">
        <header class="hco-command-header"><div><small>HH COSMIC OS V2 · MISSION CONTROL</small><h2 id="hcoTitle">Trung tâm điều khiển cá nhân</h2><p data-hco-status aria-live="polite">Đã tổng hợp dữ liệu cục bộ hiện có.</p></div><div class="hco-command-actions">
          <button type="button" data-hco-command-open aria-label="Mở tìm kiếm toàn hệ thống" title="Tìm kiếm · Ctrl K">⌕</button>
          <button type="button" data-hco-focus-open aria-label="Mở Focus Orbit" title="Focus Orbit">◉</button>
          <button type="button" data-hco-notifications-open aria-label="Mở hộp thư thông báo" title="Thông báo">◇</button>
          <button type="button" data-hco-profile-open aria-label="Mở cấu hình cá nhân" title="Hồ sơ và cấu hình">H</button>
          <button type="button" data-hco-refresh aria-label="Làm mới dữ liệu Cosmic OS" title="Làm mới dữ liệu">↻</button>
          <button type="button" data-hco-inspector-toggle aria-label="Bật hoặc tắt bảng ngữ cảnh" title="Bảng ngữ cảnh" aria-expanded="${instance.state.inspectorOpen}" aria-controls="hcoInspector">◫</button>
        </div></header>
        <div class="hco-deck-body">
          <nav class="hco-sidebar" aria-label="Điều hướng Cosmic OS" data-hco-sidebar><header><strong>Điều hướng</strong><button type="button" data-hco-sidebar-collapse aria-label="Thu gọn điều hướng" title="Thu gọn điều hướng">⇤</button></header><div>${tabs}</div><footer><button type="button" data-hco-capture-open>＋ Quick Capture</button><small>Local-first · dữ liệu lớn dùng IndexedDB</small></footer></nav>
          <main class="hco-workspace-scroll" data-hco-workspace-scroll data-hco-panel role="main" aria-label="Workspace Cosmic OS" tabindex="-1">${tabMarkup(instance, model)}</main>
          <aside class="hco-inspector" id="hcoInspector" data-hco-inspector aria-label="Ngữ cảnh và hành động" ${instance.state.inspectorOpen ? "" : "hidden"}>${inspectorMarkup(instance, model)}</aside>
        </div>
        <footer class="hco-status-bar" data-hco-status-bar><span data-hco-footer-status aria-live="polite">Local-first</span><span>Offline: ${instance.state.settings.offline ? "sẵn sàng" : "tắt"}</span><span>Tác vụ nền: ${model.count.activeJobs.length}</span><span data-hco-storage-status>Dung lượng: chưa kiểm tra</span><span>Bảo mật ✓</span><button type="button" data-hco-sync>Đồng bộ cấu hình</button></footer>
        <nav class="hco-mobile-nav" data-hco-mobile-nav aria-label="Điều hướng Cosmic OS trên điện thoại"><button type="button" data-hco-mobile-destination="brief">☀<span>Hôm nay</span></button><button type="button" data-hco-mobile-destination="inbox">◇<span>Hộp thư</span></button><button type="button" data-hco-mobile-destination="workspace">▦<span>Workspace</span></button><button type="button" data-hco-mobile-destination="search">⌕<span>Tìm kiếm</span></button><button type="button" data-hco-mobile-destination="more">•••<span>Thêm</span></button></nav>
        <aside class="hco-mobile-sidebar-sheet" data-hco-mobile-sidebar-sheet hidden aria-label="Danh mục Cosmic OS"><header><strong>Danh mục</strong><button type="button" data-hco-sheet-close aria-label="Đóng danh mục">×</button></header>${tabs}</aside>
        <aside class="hco-inspector-sheet" data-hco-inspector-sheet hidden aria-label="Ngữ cảnh Cosmic OS trên điện thoại"><header><strong>Ngữ cảnh</strong><button type="button" data-hco-sheet-close aria-label="Đóng bảng ngữ cảnh">×</button></header>${inspectorMarkup(instance, model)}</aside>
        <span class="hco-tooltip" data-hco-tooltip-role="tooltip" role="tooltip" hidden></span>
      </section>
      <aside class="hco-concierge hco-cosmic-concierge" data-hco-concierge data-hco-cosmic-concierge hidden><header><div><small>COSMIC CONCIERGE · LOCAL ROUTER</small><h3>H có thể giúp gì?</h3></div><button type="button" data-hco-concierge-close aria-label="Đóng Command Palette">×</button></header><form data-hco-command-form><input data-hco-command-input placeholder="Ví dụ: kiểm tra backend" autocomplete="off"><button type="submit">Control</button></form><div data-hco-command-preview role="status">Nhập lệnh để xem preview trước khi mở.</div><div class="hco-concierge-actions"><button type="button" data-hco-concierge-action="summarize-day">Tóm tắt ngày</button><button type="button" data-hco-concierge-action="find-tool">Tìm công cụ</button><button type="button" data-hco-concierge-action="explain-warning">Giải thích cảnh báo</button><button type="button" data-hco-concierge-action="next-step">Đề xuất bước tiếp</button><button type="button" data-hco-concierge-action="create-plan">Tạo kế hoạch</button><button type="button" data-hco-concierge-action="draft-content">Soạn nội dung</button></div></aside>
      <aside class="hco-screensaver" data-hco-screensaver-overlay hidden aria-label="Cosmic Screensaver"><div><span>H</span><small>COSMIC SCREENSAVER</small><strong data-hco-screen-clock>--:--</strong><p data-hco-screen-next>Không có sự kiện tiếp theo</p><button type="button" data-hco-screensaver-exit>Tiếp tục</button></div></aside>
      <aside class="hco-capture-dialog" data-hco-capture-dialog hidden aria-label="Quick Capture"><header><div><small>QUICK CAPTURE · CẦN XÁC NHẬN</small><h3>Lưu nhanh vào HH Platform</h3></div><button type="button" data-hco-capture-close aria-label="Đóng Quick Capture">×</button></header><form data-hco-capture-form><label>Loại nội dung<select data-hco-capture-type><option value="task">task</option><option value="note">note</option><option value="idea">idea</option><option value="link">link</option><option value="file">file</option><option value="image">image</option><option value="recording">recording</option><option value="event">event</option><option value="vocabulary">vocabulary</option></select></label><label>Nội dung<textarea data-hco-capture-input maxlength="1000" required placeholder="Viết nội dung…"></textarea></label><label class="hco-capture-file">File tùy chọn<input type="file" data-hco-capture-file></label><p data-hco-capture-suggestion>Hệ thống sẽ đề xuất nơi lưu sau khi bạn nhập.</p><footer><button type="button" data-hco-capture-close>Hủy</button><button type="submit" class="is-primary" data-hco-capture-confirm>Xác nhận và lưu</button></footer></form></aside>
      <input type="file" data-hco-drop-input hidden multiple><div class="hco-mini-windows" data-hco-mini-windows></div>
    </div>`;
  }

  function saveState(instance, options = {}) {
    instance.state = normalizeState({ ...instance.state, updatedAt: Date.now() });
    writeJson(instance.storageKey || stateKey(), instance.state);
    if (!options.silent) setStatus(instance, options.message || "Đã lưu trên thiết bị của tài khoản hiện tại.", "success");
    global.dispatchEvent?.(new CustomEvent("hh:home-data-change", { detail: { source: "cosmic-os", scope: "current-account", timestamp: Date.now() } }));
  }

  function setStatus(instance, message, tone = "") {
    const text = clean(message, 220);
    instance.root?.querySelector("[data-hco-status]")?.replaceChildren(global.document.createTextNode(text));
    const footer = instance.root?.querySelector("[data-hco-footer-status]");
    if (footer) { footer.textContent = text; footer.dataset.tone = tone; }
  }

  function navigate(route) {
    const safe = String(route || "");
    if (!/^\/[a-z0-9/_-]+(?:\?[a-z0-9_=&-]+)?$/i.test(safe)) return false;
    global.location.hash = `#${safe}`;
    return true;
  }

  function emit(name, payload = {}) {
    try {
      if (global.HHEventBus?.emit) global.HHEventBus.emit(name, payload);
      else global.dispatchEvent?.(new CustomEvent("hh:event", { detail: { eventName: name, payload, meta: { timestamp: Date.now() } } }));
    } catch {}
  }

  function modelFor(instance) { instance.model = deriveModel(instance.state); return instance.model; }

  function syncOuterMobileNavigation(instance) {
    const nav = global.document?.querySelector?.(".app-mobile-nav");
    if (!nav) return;
    if (!instance.appMobileNav) instance.appMobileNav = { node: nav, value: nav.style.getPropertyValue("display"), priority: nav.style.getPropertyPriority("display") };
    const compact = global.matchMedia?.("(max-width: 768px)")?.matches === true;
    if (compact && (!global.location.hash || /^#\/home(?:$|[/?])/.test(global.location.hash))) nav.style.setProperty("display", "none", "important");
    else if (instance.appMobileNav.value) nav.style.setProperty("display", instance.appMobileNav.value, instance.appMobileNav.priority);
    else nav.style.removeProperty("display");
  }

  function refreshPanel(instance, options = {}) {
    if (!instance.root?.isConnected) return;
    const model = modelFor(instance);
    const panel = instance.root.querySelector("[data-hco-panel]");
    const scrollTop = panel?.scrollTop || 0;
    const focusToken = global.document.activeElement?.getAttribute?.("data-hco-setting") || global.document.activeElement?.getAttribute?.("data-hco-universal-search-input");
    if (panel) {
      panel.innerHTML = tabMarkup(instance, model);
      panel.scrollTop = scrollTop;
    }
    instance.root.querySelectorAll("[data-hco-inspector],[data-hco-inspector-sheet]").forEach((inspector) => {
      if (inspector.matches("[data-hco-inspector]")) inspector.innerHTML = inspectorMarkup(instance, model);
      else inspector.innerHTML = `<header><strong>Ngữ cảnh</strong><button type="button" data-hco-sheet-close aria-label="Đóng bảng ngữ cảnh">×</button></header>${inspectorMarkup(instance, model)}`;
    });
    if (focusToken) instance.root.querySelector(`[data-hco-setting="${escapeSelectorValue(focusToken)}"],[data-hco-universal-search-input]`)?.focus?.({ preventScroll: true });
    const badge = instance.root.querySelector("[data-hco-badge]");
    if (badge) badge.textContent = model.count.unread.length + model.count.activeJobs.length || "";
    applyContext(instance, model);
    applySignals(instance, model);
    if (options.message) setStatus(instance, options.message, options.tone || "");
  }

  function openOS(instance, tab = instance.state.activeTab || "brief") {
    instance.state.activeTab = TABS.some((item) => item[0] === tab) ? tab : "brief";
    instance.lastFocus = global.document.activeElement;
    instance.root.dataset.hcoOverlayOpen = "true";
    instance.root.querySelectorAll("[data-hco-tab]").forEach((button) => {
      const active = button.dataset.hcoTab === instance.state.activeTab;
      button.setAttribute("aria-selected", String(active));
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    refreshPanel(instance);
    instance.root.querySelector("[data-hco-workspace-scroll]")?.focus?.({ preventScroll: true });
  }

  function closeOS(instance) {
    instance.root.querySelectorAll("[data-hco-mobile-sidebar-sheet],[data-hco-inspector-sheet]").forEach((node) => { node.hidden = true; });
    instance.root.classList.remove("is-sheet-open");
    instance.root.dataset.hcoOverlayOpen = "true";
    instance.lastFocus?.focus?.();
  }

  function openConcierge(instance) {
    const node = instance.root.querySelector("[data-hco-concierge]");
    if (!node) return;
    node.hidden = false;
    node.querySelector("[data-hco-command-input]")?.focus();
  }

  function closeConcierge(instance) { instance.root.querySelector("[data-hco-concierge]")?.setAttribute("hidden", ""); }

  function markVisit(instance) {
    const model = modelFor(instance);
    instance.state.lastSnapshot = model.currentCounters;
    instance.state.lastVisitAt = Date.now();
    saveState(instance, { silent: true });
    refreshPanel(instance, { message: "Đã đánh dấu các thay đổi là đã xem.", tone: "success" });
  }

  function updateTodayCards(instance) {
    const root = instance.root;
    const model = modelFor(instance);
    const brief = collectMorningBrief(model);
    const set = (kind, title, meta) => {
      root.querySelector(`[data-hgc-today-title="${kind}"]`)?.replaceChildren(global.document.createTextNode(clean(title, 100)));
      root.querySelector(`[data-hgc-today-meta="${kind}"]`)?.replaceChildren(global.document.createTextNode(clean(meta, 180)));
    };
    set("tasks", brief["important-task"] ? itemTitle(brief["important-task"]) : `${model.count.openTasks.length} việc cần làm`, brief["important-task"]?.priorityReason || (model.count.openTasks.length ? "Có task đang mở trong Công việc" : "Chưa có việc tồn đọng"));
    set("calendar", brief["next-event"] ? itemTitle(brief["next-event"]) : "Chưa có lịch gần", brief["next-event"] ? itemDate(brief["next-event"].at) : "Các mốc có ngày sẽ xuất hiện ở đây");
    set("learning", `${model.count.dueLearning.length} bài đến hạn`, model.count.dueLearning.length ? "Mở hàng ôn tập để tiếp tục" : "Không có bài ôn đang chờ");
    set("continue", model.continueStack[0]?.title || "Chưa có phiên gần đây", model.continueStack[0]?.meta || "Mở một công cụ để lưu hành trình");
    set("notifications", `${model.count.unread.length} thông báo mới`, model.count.unread.length ? "Có mục cần bạn xem" : "Hộp thư đã được xử lý");
    const button = root.querySelector("[data-hgc-continue-main]");
    if (button && model.continueStack[0]) button.dataset.hgcRoute = model.continueStack[0].route;
  }

  function applyContext(instance, model) {
    const hour = new Date().getHours();
    const period = hour < 6 ? "night" : hour < 11 ? "morning" : hour < 18 ? "work-hours" : "evening";
    const activeUpload = model.count.activeJobs.some((item) => /upload|publish|transfer/i.test(`${item?.type || ""} ${itemTitle(item)}`));
    const websiteIncident = model.mission.some((item) => ["offline", "degraded"].includes(item.state));
    const nearDeadline = model.priorities.some((item) => timestamp(item.dueAt) && timestamp(item.dueAt) - Date.now() < 86_400_000);
    const root = instance.root;
    root.dataset.hcoContext = period;
    root.dataset.hcoContextAware = "true";
    root.dataset.hcoSignals = [period, activeUpload ? "active-upload" : "", websiteIncident ? "website-incident" : "", nearDeadline ? "near-deadline" : ""].filter(Boolean).join(" ");
    root.dataset.hcoAmbient = String(instance.state.ambient);
    const copy = root.querySelector("[data-hco-context-copy]");
    if (copy) copy.textContent = `${period === "morning" ? "Buổi sáng · ưu tiên lịch và việc quan trọng." : period === "work-hours" ? "Giờ làm việc · ưu tiên dự án và Focus." : period === "evening" ? "Buổi tối · ưu tiên học tập, giải trí và tổng kết." : "Ban đêm · giữ thông tin tối thiểu và nhẹ mắt."} ${activeUpload ? "Đang có active-upload." : ""} ${websiteIncident ? "Website đang có website-incident." : ""} ${nearDeadline ? "Có near-deadline cần xem." : ""}`;
  }

  function applySignals(instance, model) {
    const root = instance.root;
    const signals = {
      deadline: model.count.openTasks.some((item) => taskDue(item) && taskDue(item) - Date.now() < 86_400_000),
      transfer: model.count.activeJobs.length > 0,
      backendError: model.mission.some((item) => item.id === "backend" && item.state === "offline"),
      comic: model.count.comicUpdates.length > 0,
      learning: model.count.dueLearning.length > 0,
      recent: model.continueStack.length > 0
    };
    root.dataset.hcoSignals = Object.entries(signals).filter(([, value]) => value).map(([key]) => `signal-${key}`).join(" ");
    const planetAliases = { work: "deadline", learning: "learning", analytics: "backendError", system: "backendError", comic: "comic" };
    Object.entries(planetAliases).forEach(([planet, signal]) => {
      const node = root.querySelector(`[data-hgc-planet="${planet}"],[data-hgm-planet="${planet}"]`);
      if (!node) return;
      node.classList.toggle(`hco-signal-${signal}`, Boolean(signals[signal]));
      node.dataset.hcoSignal = signals[signal] ? signal : "";
    });
  }

  function findAndMutateJob(jobId, action) {
    const stores = [STORES.orchestrator, STORES.background, STORES.comicTasks, STORES.youtube, STORES.facebook];
    for (const key of stores) {
      const raw = readJson(key, null);
      if (!raw) continue;
      const list = Array.isArray(raw) ? raw : Array.isArray(raw.jobs) ? raw.jobs : Array.isArray(raw.queue) ? raw.queue : null;
      if (!list) continue;
      const index = list.findIndex((item) => String(item?.id) === String(jobId));
      if (index < 0) continue;
      const next = transitionQueueItem(list[index], action);
      if (next === list[index] && next.state === list[index].state) return { changed: false, item: next, key };
      list[index] = next;
      if (Array.isArray(raw)) writeJson(key, list); else if (Array.isArray(raw.jobs)) { raw.jobs = list; writeJson(key, raw); } else { raw.queue = list; writeJson(key, raw); }
      return { changed: true, item: next, key };
    }
    return { changed: false, item: null, key: "" };
  }

  function queueAction(instance, item, action) {
    if (!item) return;
    if (global.HHPlatformRuntime?.transitionJob && ["pause", "resume", "retry"].includes(action)) {
      try {
        const result = global.HHPlatformRuntime.transitionJob(item.id, action);
        if (result) { emit("hh:orchestrator:change", { id: item.id, action, result }); refreshPanel(instance, { message: `Đã ${action} tác vụ ${item.title}.`, tone: "success" }); return; }
      } catch {}
    }
    const result = findAndMutateJob(item.id, action);
    if (!result.changed) { setStatus(instance, `Tác vụ không hỗ trợ ${action} từ nguồn hiện tại.`, "warning"); return; }
    emit("hh:orchestrator:change", { id: item.id, action, state: result.item.state, retryFrom: result.item.retryFrom });
    refreshPanel(instance, { message: action === "retry" ? `Đã retry từ bước ${result.item.retryFrom || 0}.` : `Đã chuyển tác vụ sang ${result.item.state}.`, tone: "success" });
  }

  function startFocus(instance) {
    const model = modelFor(instance);
    const task = model.priorities[0];
    instance.state.focus = { ...instance.state.focus, running: true, taskId: task?.id || "", endAt: Date.now() + instance.state.focus.duration * 1000 };
    saveState(instance, { silent: true });
    emit("hh:focus-mode-change", { active: true, duration: instance.state.focus.duration, taskId: instance.state.focus.taskId });
    refreshPanel(instance, { message: `Focus bắt đầu trong ${Math.round(instance.state.focus.duration / 60)} phút.`, tone: "success" });
  }

  function pauseFocus(instance) {
    const remaining = instance.state.focus.running ? Math.max(60, Math.ceil((instance.state.focus.endAt - Date.now()) / 1000)) : instance.state.focus.duration;
    instance.state.focus = { ...instance.state.focus, running: false, duration: remaining, endAt: 0 };
    saveState(instance, { silent: true });
    emit("hh:focus-mode-change", { active: false, paused: true });
    refreshPanel(instance, { message: "Focus đã tạm dừng; thời gian còn lại được lưu.", tone: "success" });
  }

  function completeFocus(instance) {
    instance.state.focus = { ...instance.state.focus, running: false, endAt: 0, completed: (instance.state.focus.completed || 0) + 1, duration: 25 * 60 };
    if (instance.state.focus.taskId) {
      const todos = asArray(readJson(STORES.todos, []));
      const task = todos.find((item) => String(item.id) === String(instance.state.focus.taskId));
      if (task) { task.completed = true; task.status = "completed"; task.completedAt = nowIso(); writeJson(STORES.todos, todos); }
    }
    saveState(instance, { message: "Đã hoàn thành phiên Focus và lưu tiến độ.", tone: "success" });
    emit("hh:focus-mode-change", { active: false, completed: true });
  }

  function switchFocus(instance) {
    const model = modelFor(instance);
    const next = model.priorities.find((item) => item.id !== instance.state.focus.taskId) || model.priorities[0];
    instance.state.focus.taskId = next?.id || "";
    instance.state.focus.running = false;
    instance.state.focus.endAt = 0;
    saveState(instance, { message: next ? `Đã chuyển sang ${next.title}.` : "Chưa có task khác để chuyển.", tone: next ? "success" : "warning" });
  }

  function captureOpen(instance, defaults = {}) {
    const dialog = instance.root.querySelector("[data-hco-capture-dialog]");
    if (!dialog) return;
    dialog.hidden = false;
    const type = dialog.querySelector("[data-hco-capture-type]");
    const input = dialog.querySelector("[data-hco-capture-input]");
    if (defaults.type) type.value = defaults.type;
    if (defaults.text != null) input.value = defaults.text;
    updateCaptureSuggestion(instance);
    input.focus();
  }

  function updateCaptureSuggestion(instance) {
    const dialog = instance.root.querySelector("[data-hco-capture-dialog]");
    if (!dialog) return;
    const type = dialog.querySelector("[data-hco-capture-type]")?.value || "task";
    const value = dialog.querySelector("[data-hco-capture-input]")?.value || "";
    const suggestion = suggestCaptureDestination(type, value);
    const target = dialog.querySelector("[data-hco-capture-suggestion]");
    if (target) target.textContent = `Đề xuất: ${suggestion.label}. Bạn vẫn cần bấm “Xác nhận và lưu”.`;
  }

  function saveCapture(instance) {
    const dialog = instance.root.querySelector("[data-hco-capture-dialog]");
    const type = dialog?.querySelector("[data-hco-capture-type]")?.value || "task";
    const value = clean(dialog?.querySelector("[data-hco-capture-input]")?.value, 1000);
    const file = dialog?.querySelector("[data-hco-capture-file]")?.files?.[0];
    if (!value && !file) { setStatus(instance, "Hãy nhập nội dung hoặc chọn file trước khi lưu.", "warning"); return; }
    const record = { id: uid("capture"), type, text: value || file.name, file: file ? { name: clean(file.name, 180), size: file.size, type: clean(file.type, 80), lastModified: file.lastModified } : null, createdAt: nowIso(), ownerId: ownerScope() };
    if (type === "task") {
      const todos = asArray(readJson(STORES.todos, []));
      todos.unshift({ id: record.id, title: record.text, status: "open", completed: false, createdAt: record.createdAt, ownerId: ownerScope(), source: "cosmic-capture" });
      writeJson(STORES.todos, todos.slice(0, 500));
    } else if (type === "note" || type === "idea") {
      const notes = asArray(readJson(STORES.notes, []));
      notes.unshift({ id: record.id, title: type === "idea" ? "Ý tưởng mới" : "Ghi chú mới", text: record.text, createdAt: record.createdAt, updatedAt: record.createdAt, ownerId: ownerScope(), source: "cosmic-capture" });
      writeJson(STORES.notes, notes.slice(0, 200));
    } else if (type === "event") {
      writeJson(`hh.home.live-widgets.v1.calendar:${ownerScope()}`, { title: record.text, at: record.createdAt, source: "cosmic-capture" });
    } else {
      instance.state.captures.unshift(record);
      instance.state.captures = instance.state.captures.slice(0, 80);
    }
    saveState(instance, { silent: true });
    dialog.hidden = true;
    emit("hh:home-data-change", { type: "capture", capture: { id: record.id, type, hasFile: Boolean(file) } });
    refreshPanel(instance, { message: `Đã lưu ${type} vào ${suggestCaptureDestination(type, record.text).label}.`, tone: "success" });
  }

  async function readClipboard(instance) {
    try {
      if (!global.navigator?.clipboard?.readText) throw new Error("Trình duyệt không cung cấp Clipboard API.");
      const value = await global.navigator.clipboard.readText();
      if (!value.trim()) throw new Error("Clipboard đang trống.");
      if (isSensitiveClipboard(value)) { setStatus(instance, "Đã bỏ qua nội dung nhạy cảm trong clipboard.", "warning"); return; }
      instance.state.clipboard.unshift({ id: uid("clip"), text: clean(value, 600), createdAt: nowIso(), expiresAt: Date.now() + 7 * 86_400_000, pinned: false });
      instance.state.clipboard = instance.state.clipboard.slice(0, 30);
      saveState(instance, { message: "Đã lưu một mục clipboard an toàn trên thiết bị.", tone: "success" });
      refreshPanel(instance);
    } catch (error) { setStatus(instance, clean(error?.message || "Không thể đọc clipboard.", 180), "warning"); }
  }

  function calculateExpression(value) {
    const input = String(value || "").replace(/\s+/g, "");
    if (!input || !/^[0-9+\-*/().%]+$/.test(input) || input.length > 80) throw new Error("Biểu thức không an toàn.");
    const tokens = input.match(/\d+(?:\.\d+)?|[()+\-*/%]/g) || [];
    const values = [];
    const operators = [];
    const precedence = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2 };
    const apply = () => {
      const op = operators.pop();
      const right = Number(values.pop());
      const left = Number(values.pop());
      if (!Number.isFinite(left) || !Number.isFinite(right)) throw new Error("Biểu thức không hợp lệ.");
      if (op === "/" && right === 0) throw new Error("Không thể chia cho 0.");
      values.push(op === "+" ? left + right : op === "-" ? left - right : op === "*" ? left * right : op === "/" ? left / right : left % right);
    };
    tokens.forEach((token) => {
      if (/^\d/.test(token)) values.push(Number(token));
      else if (token === "(") operators.push(token);
      else if (token === ")") { while (operators.length && operators.at(-1) !== "(") apply(); operators.pop(); }
      else { while (operators.length && operators.at(-1) !== "(" && precedence[operators.at(-1)] >= precedence[token]) apply(); operators.push(token); }
    });
    while (operators.length) { if (operators.at(-1) === "(") throw new Error("Thiếu dấu đóng ngoặc."); apply(); }
    const result = Number(values[0]);
    if (!Number.isFinite(result)) throw new Error("Biểu thức không hợp lệ.");
    return String(Math.round(result * 1e8) / 1e8);
  }

  function miniMarkup(id, model, instance) {
    const title = { calculator: "Máy tính", notes: "Sticky Notes", music: "Nhạc tập trung", calendar: "Lịch mini", timer: "Timer", "image-viewer": "Trình xem ảnh", "download-queue": "Download queue", "api-monitor": "API monitor" }[id] || "Tiện ích";
    let body = "";
    if (id === "calculator") body = `<output data-hco-calc-output>0</output><input data-hco-calc-input placeholder="2 + 2 * 5" inputmode="decimal"><div class="hco-calc-buttons"><button type="button" data-hco-calc-run>=</button><button type="button" data-hco-calc-clear>C</button></div>`;
    else if (id === "notes") body = `<textarea data-hco-mini-note maxlength="1000" placeholder="Ghi chú nhanh…">${escapeHtml(instance.state.captures.find((item) => item.type === "note")?.text || "")}</textarea><button type="button" data-hco-mini-note-save>Lưu ghi chú</button>`;
    else if (id === "music") body = `<p>Nhạc tập trung chỉ mở khi bạn chọn một audio đã có.</p><input type="file" accept="audio/*" data-hco-mini-audio><audio controls data-hco-mini-audio-player hidden></audio>`;
    else if (id === "calendar") body = `<div class="hco-mini-calendar-list">${model.calendar.slice(0, 6).map((item) => `<button type="button" data-hco-route="${escapeHtml(item.route)}"><time>${escapeHtml(itemDate(item.at))}</time><span>${escapeHtml(item.title)}</span></button>`).join("") || "<p>Chưa có sự kiện.</p>"}</div>`;
    else if (id === "timer") body = `<strong class="hco-timer-value" data-hco-timer-value>05:00</strong><div><button type="button" data-hco-timer="start">Bắt đầu</button><button type="button" data-hco-timer="reset">Đặt lại</button></div>`;
    else if (id === "image-viewer") body = `<label class="hco-mini-file">Chọn ảnh<input type="file" accept="image/*" data-hco-image-file></label><img data-hco-image-preview alt="Preview ảnh local" hidden>`;
    else if (id === "download-queue") body = `<p>${model.count.activeJobs.filter((item) => queueLabel(item) === "download").length} download đang theo dõi.</p><button type="button" data-hco-open-tab="queue">Mở hàng đợi</button>`;
    else body = `<p>HTTP: ${escapeHtml(model.mission.find((item) => item.id === "frontend")?.detail || "Chưa đo")}</p><p>Backend: ${escapeHtml(model.mission.find((item) => item.id === "backend")?.detail || "Chưa đo")}</p><button type="button" data-hco-open-tab="mission">Mở Mission Control</button>`;
    return `<article class="hco-mini-window" data-hco-mini-window="${id}" data-hco-mini-state="normal"><header><span>✦</span><div><small>COSMIC MINI WINDOW</small><strong>${title}</strong></div><button type="button" data-hco-mini-minimize="${id}" aria-label="Thu nhỏ">−</button><button type="button" data-hco-mini-pin="${id}" aria-label="Ghim">☆</button><button type="button" data-hco-mini-close="${id}" aria-label="Đóng">×</button></header><div class="hco-mini-body">${body}</div><footer><button type="button" data-hco-mini-resize="${id}">Resize</button><button type="button" data-hco-mini-snap="${id}">Snap</button></footer></article>`;
  }

  function openMini(instance, id) {
    const host = instance.root.querySelector("[data-hco-mini-windows]");
    if (!host || !MINI_WINDOW_TYPES.includes(id)) return;
    const selector = `[data-hco-mini-window="${escapeSelectorValue(id)}"]`;
    const existing = host.querySelector(selector);
    if (existing) { existing.hidden = false; existing.dataset.hcoMiniState = "normal"; return; }
    host.insertAdjacentHTML("beforeend", miniMarkup(id, modelFor(instance), instance));
    bindMini(instance, host.querySelector(selector));
  }

  function bindMini(instance, node) {
    if (!node || node.dataset.hcoBound === "true") return;
    node.dataset.hcoBound = "true";
    node.querySelector("[data-hco-calc-run]")?.addEventListener("click", () => {
      const input = node.querySelector("[data-hco-calc-input]");
      try { node.querySelector("[data-hco-calc-output]").textContent = calculateExpression(input.value); }
      catch (error) { node.querySelector("[data-hco-calc-output]").textContent = clean(error.message, 80); }
    });
    node.querySelector("[data-hco-calc-clear]")?.addEventListener("click", () => { node.querySelector("[data-hco-calc-input]").value = ""; node.querySelector("[data-hco-calc-output]").textContent = "0"; });
    node.querySelector("[data-hco-mini-note-save]")?.addEventListener("click", () => {
      const textValue = clean(node.querySelector("[data-hco-mini-note]")?.value, 1000);
      const notes = asArray(readJson(STORES.notes, []));
      notes.unshift({ id: uid("note"), title: "Sticky Note", text: textValue, createdAt: nowIso(), updatedAt: nowIso(), ownerId: ownerScope(), source: "cosmic-mini-window" });
      writeJson(STORES.notes, notes.slice(0, 200));
      setStatus(instance, "Đã lưu Sticky Note.", "success");
    });
    node.querySelector("[data-hco-mini-audio]")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0]; if (!file) return;
      const player = node.querySelector("[data-hco-mini-audio-player]"); player.src = URL.createObjectURL(file); player.hidden = false;
      player.addEventListener("ended", () => URL.revokeObjectURL(player.src), { once: true });
    });
    node.querySelector("[data-hco-image-file]")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0]; if (!file) return;
      const image = node.querySelector("[data-hco-image-preview]"); image.src = URL.createObjectURL(file); image.hidden = false;
    });
    node.querySelectorAll("[data-hco-timer]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.hcoTimer === "start") {
        let remaining = 300; const output = node.querySelector("[data-hco-timer-value]");
        clearInterval(node._hcoTimer); node._hcoTimer = setInterval(() => { remaining = Math.max(0, remaining - 1); output.textContent = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`; if (!remaining) clearInterval(node._hcoTimer); }, 1000);
      } else { clearInterval(node._hcoTimer); node.querySelector("[data-hco-timer-value]").textContent = "05:00"; }
    }));
  }

  function ensureQrLibrary() {
    if (global.qrcode) return Promise.resolve(true);
    if (!global.document) return Promise.resolve(false);
    if (qrLibraryPromise) return qrLibraryPromise;
    qrLibraryPromise = new Promise((resolve) => {
      let settled = false;
      const finish = () => { if (!settled) { settled = true; resolve(Boolean(global.qrcode)); } };
      const timeout = setTimeout(finish, 8000);
      const done = () => { clearTimeout(timeout); finish(); };
      const existing = global.document.querySelector('script[data-hco-qr-library]');
      if (existing) { existing.addEventListener("load", done, { once: true }); existing.addEventListener("error", done, { once: true }); return; }
      const script = global.document.createElement("script");
      script.src = "vendor/qrcode.js?v=2.0.4";
      script.dataset.hcoQrLibrary = "true";
      script.addEventListener("load", done, { once: true });
      script.addEventListener("error", done, { once: true });
      global.document.head.appendChild(script);
    });
    return qrLibraryPromise;
  }

  async function createHandoff(instance) {
    const output = instance.root.querySelector("[data-hco-handoff-output]");
    if (!hasAuthenticatedOwner()) { if (output) output.innerHTML = "<span>Cần đăng nhập để tạo handoff an toàn theo tài khoản.</span>"; return; }
    const payload = safeHandoffPayload({ type: "home", stateId: uid("state"), ownerId: ownerScope(), route: "/home", label: "Trang chủ HH Platform" });
    const handoffId = payload.id;
    const url = `https://hoang8.com/#/home?handoff=${encodeURIComponent(handoffId)}`;
    if (output) output.innerHTML = "<span>Đang tạo phiên handoff bảo mật…</span>";
    try {
      if (!global.fetch) throw new Error("Trình duyệt không hỗ trợ kết nối handoff.");
      const response = await global.fetch("/api/modules/home-galaxy/items", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: payload.label, type: "cosmic-handoff-v1", data: payload }) });
      if (!response?.ok) throw new Error(`Máy chủ chưa lưu handoff (${response?.status || "offline"}).`);
      const qrReady = await ensureQrLibrary();
      if (output) output.innerHTML = `<div class="hco-qr" data-hco-qr><canvas width="180" height="180"></canvas><code>${escapeHtml(url)}</code><button type="button" data-hco-copy-handoff>Copy link</button></div>`;
      const canvas = output?.querySelector("canvas");
      if (canvas && qrReady && global.qrcode) {
        try { const qr = global.qrcode(0, "M"); qr.addData(url); qr.make(); const ctx = canvas.getContext("2d"); const count = qr.getModuleCount(); const cell = 180 / count; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 180, 180); ctx.fillStyle = "#07121f"; for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) if (qr.isDark(row, col)) ctx.fillRect(Math.floor(col * cell), Math.floor(row * cell), Math.ceil(cell), Math.ceil(cell)); } catch {}
      } else if (canvas) {
        canvas.hidden = true;
      }
      setStatus(instance, qrReady ? "Đã tạo handoff có hạn 24 giờ; QR không chứa token." : "Đã tạo link handoff, nhưng thư viện QR chưa tải được; hãy dùng Copy link.", qrReady ? "success" : "warning");
    } catch (error) {
      if (output) output.innerHTML = `<span>${escapeHtml(clean(error?.message || "Không thể tạo handoff.", 180))}</span>`;
      setStatus(instance, "Không tạo QR vì máy chủ chưa xác nhận lưu phiên handoff.", "warning");
    }
  }

  function runScene(instance, sceneId) {
    const scene = SCENES.find((item) => item.id === sceneId);
    if (!scene) return;
    const existing = instance.state.automations.find((item) => item.sceneId === sceneId);
    if (existing?.state === "running") { advanceScene(instance, sceneId); return; }
    const next = existing ? { ...existing, state: existing.state === "completed" ? "queued" : "running", step: existing.state === "completed" ? 0 : existing.step } : { id: uid("automation"), sceneId, state: "running", step: 0, startedAt: nowIso(), log: [] };
    next.state = "running";
    next.updatedAt = nowIso();
    instance.state.automations = [next, ...instance.state.automations.filter((item) => item.sceneId !== sceneId)].slice(0, 30);
    saveState(instance, { silent: true });
    const step = scene.steps[next.step];
    setStatus(instance, step ? `${scene.label}: ${step[0]}. Bấm “Mở bước” để tiếp tục.` : `${scene.label} đã sẵn sàng.`, "success");
    refreshPanel(instance);
  }

  function advanceScene(instance, sceneId) {
    const scene = SCENES.find((item) => item.id === sceneId);
    const run = instance.state.automations.find((item) => item.sceneId === sceneId);
    if (!scene || !run) return;
    const completedStep = scene.steps[Math.min(run.step, scene.steps.length - 1)];
    run.log = [...asArray(run.log), { step: run.step, label: completedStep?.[0] || "Bước", state: "completed", at: nowIso() }].slice(-40);
    if (run.step >= scene.steps.length - 1) run.state = "completed";
    else { run.step += 1; run.state = "running"; }
    run.updatedAt = nowIso();
    saveState(instance, { message: run.state === "completed" ? "Automation scene đã hoàn tất." : `Đã chuyển tới bước ${run.step + 1}.`, tone: "success" });
    refreshPanel(instance);
  }

  async function refreshMission(instance) {
    try {
      const probeResult = await global.fetch?.(`/api/health?cosmic_probe=${Date.now()}`, { cache: "no-store", credentials: "include" });
      const response = probeResult;
      const verifiedAt = response?.ok ? nowIso() : "";
      instance.healthCheckedAt = verifiedAt;
      instance.lastCheckedAt = verifiedAt;
      const data = response?.ok ? await response.json().catch(() => ({})) : {};
      instance.healthData = { ...data, responseOk: Boolean(response?.ok), verifiedAt };
      global.HHHomeLiveWidgets?.refresh?.();
      refreshPanel(instance, { message: response?.ok ? "Đã nhận phản hồi kiểm tra website." : "Website Health chưa phản hồi; trạng thái được giữ là chưa xác minh.", tone: response?.ok ? "success" : "warning" });
    } catch (error) { setStatus(instance, `Không thể kiểm tra website: ${clean(error?.message || "lỗi kết nối", 120)}`, "warning"); }
  }

  function showDropChoices(instance, files) {
    instance.pendingDrop = asArray(files).map((file) => ({ name: clean(file.name, 180), size: file.size, type: clean(file.type, 80), lastModified: file.lastModified }));
    const choices = instance.root.querySelector("[data-hco-drop-choices]");
    if (choices) choices.hidden = false;
    openOS(instance, "tools");
    setStatus(instance, `${instance.pendingDrop.length} file đã nhận local. Hãy chọn đích xử lý.`, "success");
  }

  function chooseDropAction(instance, action) {
    const files = instance.pendingDrop || [];
    const route = { thumbnail: "/davinci-resolve/image-text", ocr: "/media-design", convert: "/media-design", "upload-video": "/davinci-resolve/youtube", "add-project": "/work/project-center", "audio-analysis": "/music-ai", backup: "/settings", "device-vault": "/settings" }[action] || "/home";
    instance.state.captures.unshift({ id: uid("drop"), type: action, files, createdAt: nowIso(), ownerId: ownerScope() });
    instance.pendingDrop = [];
    saveState(instance, { silent: true });
    if (action === "device-vault" || action === "backup") { setStatus(instance, `Đã lưu metadata ${files.length} file local; mở ${action}.`, "success"); refreshPanel(instance); return; }
    closeOS(instance);
    navigate(route);
  }

  function renderMini(instance, id) { openMini(instance, id); }

  function handleCommand(instance, query) {
    const matches = commandPreview(query, modelFor(instance));
    const preview = instance.root.querySelector("[data-hco-command-preview]");
    const command = matches[0];
    if (!command) { if (preview) preview.textContent = "Chưa tìm thấy lệnh phù hợp. Hãy thử “kiểm tra backend” hoặc “đọc tiếp truyện”."; return; }
    if (command.action === "capture-task") { closeConcierge(instance); captureOpen(instance, { type: "task" }); return; }
    if (command.action === "focus") { closeConcierge(instance); openOS(instance, "workspace"); startFocus(instance); return; }
    closeConcierge(instance);
    navigate(command.route);
  }

  function updateCommandPreview(instance, query) {
    const node = instance.root.querySelector("[data-hco-command-preview]");
    if (!node) return;
    const matches = commandPreview(query, modelFor(instance));
    node.innerHTML = matches.length ? matches.slice(0, 5).map((item) => `<button type="button" data-hco-command-pick="${item.id}"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.reason || "Lệnh local")}</small></button>`).join("") : "Không có preview phù hợp.";
  }

  function handleConciergeAction(instance, action) {
    const model = modelFor(instance);
    const node = instance.root.querySelector("[data-hco-command-preview]");
    const brief = collectMorningBrief(model);
    const messages = {
      "summarize-day": `Hôm nay có ${model.count.openTasks.length} task mở, ${model.count.unread.length} thông báo chưa đọc và ${model.count.activeJobs.length} tác vụ đang chạy.`,
      "find-tool": "Bạn có thể mở Command Palette để tìm HH Japanese, Thumbnail Studio, YouTube hoặc Đọc truyện.",
      "explain-warning": model.mission.filter((item) => ["offline", "degraded"].includes(item.state)).map((item) => `${item.label}: ${item.detail}`).join(" · ") || "Chưa có cảnh báo đã xác minh.",
      "next-step": brief["next-action"].reason,
      "create-plan": "Đã mở Automation để bạn chọn một scene và kiểm tra từng bước.",
      "draft-content": "AI chỉ tạo bản nháp sau khi bạn mở AI Center và xác nhận nội dung."
    };
    if (node) node.textContent = messages[action] || "Chưa có đề xuất.";
    if (action === "create-plan") { closeConcierge(instance); openOS(instance, "automation"); }
    if (action === "draft-content") { closeConcierge(instance); navigate("/create/ai-center"); }
  }

  function updateFocusClock(instance) {
    const node = instance.root?.querySelector("[data-hco-focus-time]");
    if (!node) return;
    const seconds = instance.state.focus.running ? Math.max(0, Math.ceil((instance.state.focus.endAt - Date.now()) / 1000)) : instance.state.focus.duration;
    node.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    if (instance.state.focus.running && seconds <= 0) completeFocus(instance);
  }

  function resetIdle(instance) {
    clearTimeout(instance.idleTimeout);
    instance.idleTimeout = setTimeout(() => {
      if (!instance.state.screensaver || global.document?.hidden) return resetIdle(instance);
      const overlay = instance.root.querySelector("[data-hco-screensaver-overlay]");
      if (!overlay) return;
      overlay.hidden = false;
      overlay.querySelector("[data-hco-screen-clock]").textContent = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
      const next = modelFor(instance).calendar.find((item) => item.at >= Date.now());
      overlay.querySelector("[data-hco-screen-next]").textContent = next ? `next-event · ${next.title} · ${itemDate(next.at)}` : "Không có next-event đang chờ";
    }, instance.state.screensaverDelay * 1000);
  }

  function closeScreensaver(instance) {
    const overlay = instance.root.querySelector("[data-hco-screensaver-overlay]");
    if (overlay) overlay.hidden = true;
    resetIdle(instance);
  }

  function showRestorePreview(instance, button) {
    const requestedId = clean(button?.dataset?.hcoRestorePreview, 120);
    const activities = modelFor(instance).source.activities;
    const item = activities.find((entry, index) => activityIdentity(entry, index) === requestedId)
      || activities.find((entry) => itemTitle(entry) === button?.closest("article")?.querySelector("strong")?.textContent);
    const title = itemTitle(item || {}, button?.closest("article")?.querySelector("strong")?.textContent || "Hoạt động đã chọn");
    const route = item ? routeForRecent(item) : "/home";
    instance.restoreCandidate = Object.freeze({
      id: requestedId || activityIdentity(item), title, route,
      type: clean(item?.type, 50) || "opened", requiresConfirmation: RESTORE_POLICY.requiresConfirmation
    });
    const host = instance.root.querySelector("[data-hco-activity-time-machine]");
    if (!host) return;
    let preview = host.querySelector("[data-hco-restore-confirm]");
    if (!preview) {
      preview = global.document.createElement("section");
      preview.className = "hco-restore-confirm";
      preview.dataset.hcoRestoreConfirm = "preview";
      host.appendChild(preview);
    }
    preview.hidden = false;
    preview.innerHTML = `<strong>${escapeHtml(title)}</strong><p>Loại: ${escapeHtml(instance.restoreCandidate.type)} · nguồn mở lại: ${escapeHtml(ROUTE_LABELS[route] || route)}.</p><small>Time Machine không tự ghi đè dữ liệu. Bạn phải xác nhận trước khi mở workspace nguồn để kiểm tra và phục hồi.</small><footer><button type="button" data-hco-restore-cancel>Hủy</button><button type="button" data-hco-restore-confirm-action>Xác nhận mở nguồn</button></footer>`;
    setStatus(instance, "Đã tạo bản xem trước; chưa có dữ liệu nào bị thay đổi.", "warning");
  }

  function confirmRestore(instance) {
    const candidate = instance.restoreCandidate;
    if (!candidate?.requiresConfirmation) { setStatus(instance, "Không có bản xem trước đang chờ xác nhận.", "warning"); return; }
    instance.restoreCandidate = null;
    instance.root.querySelector("[data-hco-restore-confirm]")?.setAttribute("hidden", "");
    setStatus(instance, `Đã xác nhận mở nguồn của “${candidate.title}”; lịch sử vẫn được giữ nguyên.`, "success");
    if (candidate.route !== "/home") { closeOS(instance); navigate(candidate.route); }
  }

  function cancelRestore(instance) {
    instance.restoreCandidate = null;
    instance.root.querySelector("[data-hco-restore-confirm]")?.setAttribute("hidden", "");
    setStatus(instance, "Đã hủy bản xem trước; không có dữ liệu nào bị thay đổi.", "success");
  }

  function applyPresentationSettings(instance) {
    const node = instance.hcoRoot;
    if (!node) return;
    node.dataset.hcoMotion = instance.state.settings.motion;
    node.dataset.hcoDensity = instance.state.settings.density;
    node.dataset.hcoContrast = instance.state.settings.contrast;
    node.style.setProperty("--hco-font-scale", instance.state.settings.fontScale);
  }

  function exportCosmicState(instance) {
    const payload = {
      schema: "hh-home-cosmic-os",
      version: schemaVersion,
      exportedAt: nowIso(),
      data: safeExportPayload({
        activeTab: instance.state.activeTab,
        profile: instance.state.profile,
        pipeline: instance.state.pipeline,
        settings: instance.state.settings,
        lastSnapshot: instance.state.lastSnapshot
      })
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = global.document.createElement("a");
    anchor.href = url;
    anchor.download = `hh-cosmic-os-${dateKey()}.json`;
    anchor.rel = "noopener";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setStatus(instance, "Đã xuất cấu hình an toàn; dữ liệu riêng tư đã được loại bỏ.", "success");
  }

  async function importCosmicFile(instance, file) {
    if (!file || file.size > MAX_IMPORT_BYTES) { setStatus(instance, "Tệp nhập vượt quá 512 KB hoặc không tồn tại.", "warning"); return; }
    try {
      const payload = JSON.parse(await file.text());
      const validation = validateImportPayload(payload);
      if (!validation.ok) throw new Error(validation.reason);
      instance.state = normalizeState({ ...instance.state, ...validation.data });
      saveState(instance, { silent: true });
      applyPresentationSettings(instance);
      refreshPanel(instance, { message: "Đã nhập cấu hình Cosmic OS hợp lệ.", tone: "success" });
    } catch (error) { setStatus(instance, clean(error?.message || "Không thể đọc tệp cấu hình.", 180), "warning"); }
  }

  function createCheckpoint(instance) {
    instance.state.lastSnapshot = {
      createdAt: nowIso(),
      data: safeExportPayload({ activeTab: instance.state.activeTab, profile: instance.state.profile, pipeline: instance.state.pipeline, settings: instance.state.settings })
    };
    saveState(instance, { message: "Đã tạo checkpoint cục bộ.", tone: "success" });
    refreshPanel(instance);
  }

  async function inspectPermission(instance, name) {
    let state = "unsupported";
    try {
      if (name === "notifications" && "Notification" in global) state = global.Notification.permission || "default";
      else if (global.navigator.permissions?.query) state = (await global.navigator.permissions.query({ name })).state || "unknown";
    } catch { state = "unsupported"; }
    instance.root.querySelectorAll(`[data-hco-permission="${escapeSelectorValue(name)}"] [data-hco-permission-state]`).forEach((node) => { node.textContent = state; });
    setStatus(instance, `Quyền ${name}: ${state}. Thu hồi quyền trong cài đặt của trình duyệt.`, state === "granted" ? "success" : "warning");
  }

  function searchCosmic(instance, query) {
    const value = clean(query, 120).toLowerCase();
    const routeRows = Object.entries(ROUTE_LABELS).map(([route, label]) => ({ kind: "route", id: route, label, route }));
    const commandRows = commandRegistry.map((item) => ({ kind: "command", id: item.id, label: item.label, command: item.phrases[0] }));
    const rows = value ? [...routeRows, ...commandRows].filter((item) => `${item.label} ${item.id}`.toLowerCase().includes(value)).slice(0, 8) : [];
    instance.root.querySelectorAll("[data-hco-universal-search-results]").forEach((host) => {
      host.innerHTML = rows.map((item) => item.kind === "route"
        ? `<button type="button" data-hco-route="${escapeHtml(item.route)}"><strong>${escapeHtml(item.label)}</strong><small>route · ${escapeHtml(item.route)}</small></button>`
        : `<button type="button" data-hco-search-command="${escapeHtml(item.command)}"><strong>${escapeHtml(item.label)}</strong><small>command · ${escapeHtml(item.id)}</small></button>`).join("") || (value ? `<p>Không tìm thấy. Thử tên công cụ, route, project, setting hoặc command.</p>` : "");
    });
  }

  function trapFocus(surface, event) {
    if (event.key !== "Tab" || !surface || surface.hidden) return false;
    const controls = [...surface.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((node) => !node.hidden);
    if (!controls.length) return false;
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && global.document.activeElement === first) { event.preventDefault(); last.focus(); return true; }
    if (!event.shiftKey && global.document.activeElement === last) { event.preventDefault(); first.focus(); return true; }
    return false;
  }

  function bindEvents(instance) {
    const root = instance.root;
    root.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const tab = target.closest("[data-hco-tab]");
      if (tab) {
        instance.state.activeTab = tab.dataset.hcoTab;
        saveState(instance, { silent: true });
        root.querySelectorAll("[data-hco-tab]").forEach((button) => {
          const active = button.dataset.hcoTab === instance.state.activeTab;
          button.setAttribute("aria-selected", String(active));
          button.setAttribute("aria-current", active ? "page" : "false");
        });
        refreshPanel(instance);
        return;
      }
      if (target.closest("[data-hco-command-open]")) { openConcierge(instance); return; }
      if (target.closest("[data-hco-focus-open]")) { openOS(instance, "workspace"); return; }
      if (target.closest("[data-hco-notifications-open]")) { openOS(instance, "inbox"); return; }
      if (target.closest("[data-hco-profile-open]")) { openOS(instance, "profiles"); return; }
      if (target.closest("[data-hco-sidebar-collapse]")) {
        instance.state.sidebarCollapsed = !instance.state.sidebarCollapsed;
        root.querySelector("[data-hco-command-deck]")?.classList.toggle("is-sidebar-collapsed", instance.state.sidebarCollapsed);
        saveState(instance, { silent: true }); return;
      }
      if (target.closest("[data-hco-inspector-toggle]")) {
        if (global.matchMedia?.("(max-width: 768px)")?.matches) {
          const sheet = root.querySelector("[data-hco-inspector-sheet]");
          if (sheet) { instance.lastFocus = target.closest("[data-hco-inspector-toggle]"); sheet.hidden = false; root.classList.add("is-sheet-open"); sheet.querySelector("button")?.focus(); }
          return;
        }
        instance.state.inspectorOpen = !instance.state.inspectorOpen;
        const deck = root.querySelector("[data-hco-command-deck]");
        deck?.classList.toggle("is-inspector-open", instance.state.inspectorOpen);
        const inspector = root.querySelector("[data-hco-inspector]");
        if (inspector) inspector.hidden = !instance.state.inspectorOpen;
        root.querySelector("[data-hco-inspector-toggle]")?.setAttribute("aria-expanded", String(instance.state.inspectorOpen));
        saveState(instance, { silent: true }); return;
      }
      if (target.closest("[data-hco-inspector-close]")) {
        instance.state.inspectorOpen = false;
        root.querySelector("[data-hco-command-deck]")?.classList.remove("is-inspector-open");
        const inspector = root.querySelector("[data-hco-inspector]"); if (inspector) inspector.hidden = true;
        root.querySelector("[data-hco-inspector-toggle]")?.setAttribute("aria-expanded", "false");
        saveState(instance, { silent: true }); return;
      }
      const mobileDestination = target.closest("[data-hco-mobile-destination]");
      if (mobileDestination) {
        const destination = mobileDestination.dataset.hcoMobileDestination;
        if (["brief", "inbox", "workspace"].includes(destination)) openOS(instance, destination);
        else if (destination === "search") openConcierge(instance);
        else { const sheet = root.querySelector("[data-hco-mobile-sidebar-sheet]"); if (sheet) { instance.lastFocus = mobileDestination; sheet.hidden = false; root.classList.add("is-sheet-open"); sheet.querySelector("button")?.focus(); } }
        return;
      }
      if (target.closest("[data-hco-sheet-close]")) { const sheet = target.closest("[data-hco-mobile-sidebar-sheet],[data-hco-inspector-sheet]"); if (sheet) sheet.hidden = true; root.classList.remove("is-sheet-open"); instance.lastFocus?.focus?.(); return; }
      if (target.closest("button[data-hco-open]")) { openOS(instance, instance.state.activeTab); return; }
      const openTab = target.closest("[data-hco-open-tab]");
      if (openTab) { openOS(instance, openTab.dataset.hcoOpenTab); return; }
      if (target.closest("[data-hco-close]")) { closeOS(instance); closeConcierge(instance); return; }
      if (target.closest("[data-hco-refresh]")) { modelFor(instance); updateTodayCards(instance); refreshPanel(instance, { message: "Đã làm mới dữ liệu trang chủ.", tone: "success" }); return; }
      if (target.closest("[data-hco-start-day]")) { const first = modelFor(instance).priorities[0]; if (first?.route && first.route !== "/home") { closeOS(instance); navigate(first.route); } else openOS(instance, "workspace"); return; }
      if (target.closest("[data-hco-mark-visit]")) { markVisit(instance); return; }
      const continueNode = target.closest("[data-hco-continue]");
      if (continueNode) { closeOS(instance); navigate(continueNode.dataset.hcoRoute || "/home"); return; }
      const inboxAction = target.closest("[data-hco-inbox-action]");
      if (inboxAction) { handleInboxAction(instance, inboxAction.closest("[data-hco-inbox-item]"), inboxAction.dataset.hcoInboxAction); return; }
      if (target.closest("[data-hco-inbox-refresh]")) { refreshPanel(instance, { message: "Đã quét lại Universal Inbox.", tone: "success" }); return; }
      const inboxFilter = target.closest("[data-hco-inbox-filter]");
      if (inboxFilter) { root.querySelectorAll("[data-hco-inbox-filter]").forEach((button) => button.setAttribute("aria-pressed", String(button === inboxFilter))); root.querySelectorAll("[data-hco-inbox-item]").forEach((item) => { item.hidden = inboxFilter.dataset.hcoInboxFilter !== "all" && item.dataset.hcoOrigin !== inboxFilter.dataset.hcoInboxFilter; }); return; }
      const queueActionNode = target.closest("[data-hco-queue-action]");
      if (queueActionNode) { const itemNode = queueActionNode.closest("[data-hco-queue-item]"); const item = queueRows(modelFor(instance)).find((row) => row.id === itemNode?.dataset.hcoQueueItem); if (queueActionNode.dataset.hcoQueueAction === "open") { closeOS(instance); navigate(item?.route || "/work"); } else queueAction(instance, item, queueActionNode.dataset.hcoQueueAction); return; }
      if (target.closest("[data-hco-queue-refresh]")) { refreshPanel(instance, { message: "Đã quét lại Active Queue.", tone: "success" }); return; }
      if (target.closest("[data-hco-focus-mode]")) { instance.state.focus.running ? pauseFocus(instance) : startFocus(instance); return; }
      if (target.closest("[data-hco-focus-start],[data-hco-focus-resume]")) { startFocus(instance); return; }
      if (target.closest("[data-hco-focus-pause]")) { pauseFocus(instance); return; }
      const shield = target.closest("[data-hco-focus-notification-shield]");
      if (shield) { const active = shield.getAttribute("aria-pressed") !== "true"; shield.setAttribute("aria-pressed", String(active)); shield.textContent = active ? "◆ Đang chặn nhắc nội bộ" : "◇ Chặn nhắc nội bộ"; setStatus(instance, active ? "Đã tạm ẩn thông báo nội bộ trong phiên Focus." : "Đã bật lại thông báo nội bộ.", "success"); return; }
      const focusAction = target.closest("[data-hco-focus-action]");
      if (focusAction) { focusAction.dataset.hcoFocusAction === "complete-focus" ? completeFocus(instance) : switchFocus(instance); return; }
      const split = target.closest("[data-hco-split-preset]");
      if (split) { const preview = root.querySelector("[data-hco-split-preview]"); if (preview) { preview.hidden = false; preview.innerHTML = `<strong>${escapeHtml(split.textContent.trim())}</strong><p>Hai ngữ cảnh được giữ trong cùng trang. Nút mở từng module vẫn dùng route thật.</p><button type="button" data-hco-route="${escapeHtml(split.dataset.hcoRoute)}">Mở workspace chính</button>`; } return; }
      const pipeline = target.closest("[data-hco-pipeline-step]");
      if (pipeline) { const id = pipeline.dataset.hcoPipelineStep; const current = instance.state.pipeline[id]; instance.state.pipeline[id] = current === "done" ? "todo" : current === "doing" ? "done" : "doing"; saveState(instance, { silent: true }); refreshPanel(instance, { message: `Pipeline: ${id} → ${instance.state.pipeline[id]}.`, tone: "success" }); return; }
      if (target.closest("[data-hco-pipeline-reset]")) { instance.state.pipeline = Object.fromEntries(PIPELINE.map(([id]) => [id, "todo"])); saveState(instance, { silent: true }); refreshPanel(instance, { message: "Đã đặt lại Content Pipeline.", tone: "success" }); return; }
      const scene = target.closest("[data-hco-scene]");
      if (scene) { runScene(instance, scene.dataset.hcoScene); return; }
      if (target.closest("[data-hco-automation-refresh]")) { refreshPanel(instance, { message: "Đã làm mới Automation Radar.", tone: "success" }); return; }
      const calendarView = target.closest("[data-hco-calendar-view]");
      if (calendarView) { root.querySelectorAll("[data-hco-calendar-view]").forEach((button) => button.setAttribute("aria-pressed", String(button === calendarView))); root.querySelectorAll("[data-hco-calendar-view-panel]").forEach((panel) => { panel.hidden = panel.dataset.hcoCalendarViewPanel !== calendarView.dataset.hcoCalendarView; }); return; }
      if (target.closest("[data-hco-capture-open]")) { captureOpen(instance); return; }
      if (target.closest("[data-hco-capture-close]")) { root.querySelector("[data-hco-capture-dialog]").hidden = true; return; }
      if (target.closest("[data-hco-clipboard-read]")) { readClipboard(instance); return; }
      const clipPin = target.closest("[data-hco-clipboard-pin]");
      if (clipPin) { const item = instance.state.clipboard.find((entry) => entry.id === clipPin.dataset.hcoClipboardPin); if (item) item.pinned = !item.pinned; saveState(instance, { silent: true }); refreshPanel(instance); return; }
      const clipDelete = target.closest("[data-hco-clipboard-delete]");
      if (clipDelete) { instance.state.clipboard = instance.state.clipboard.filter((entry) => entry.id !== clipDelete.dataset.hcoClipboardDelete); saveState(instance, { message: "Đã xóa mục clipboard local.", tone: "success" }); refreshPanel(instance); return; }
      if (target.closest("[data-hco-global-drop-zone]")) { root.querySelector("[data-hco-drop-input]")?.click(); return; }
      const dropChoice = target.closest("[data-hco-drop-choice]");
      if (dropChoice) { chooseDropAction(instance, dropChoice.dataset.hcoDropChoice); return; }
      const miniOpen = target.closest("[data-hco-open-mini]");
      if (miniOpen) { renderMini(instance, miniOpen.dataset.hcoOpenMini); return; }
      const miniClose = target.closest("[data-hco-mini-close]");
      if (miniClose) { const node = root.querySelector(`[data-hco-mini-window="${escapeSelectorValue(miniClose.dataset.hcoMiniClose)}"]`); node?.remove(); return; }
      const miniMin = target.closest("[data-hco-mini-minimize]");
      if (miniMin) { const node = root.querySelector(`[data-hco-mini-window="${escapeSelectorValue(miniMin.dataset.hcoMiniMinimize)}"]`); if (node) { node.dataset.hcoMiniState = node.dataset.hcoMiniState === "minimized" ? "normal" : "minimized"; } return; }
      const miniPin = target.closest("[data-hco-mini-pin]");
      if (miniPin) { const node = root.querySelector(`[data-hco-mini-window="${escapeSelectorValue(miniPin.dataset.hcoMiniPin)}"]`); node?.classList.toggle("is-pinned"); return; }
      const miniResize = target.closest("[data-hco-mini-resize]");
      if (miniResize) { const node = root.querySelector(`[data-hco-mini-window="${escapeSelectorValue(miniResize.dataset.hcoMiniResize)}"]`); node?.classList.toggle("is-large"); return; }
      const miniSnap = target.closest("[data-hco-mini-snap]");
      if (miniSnap) { const node = root.querySelector(`[data-hco-mini-window="${escapeSelectorValue(miniSnap.dataset.hcoMiniSnap)}"]`); node?.classList.toggle("is-snapped"); return; }
      if (target.closest("[data-hco-handoff-create]")) { createHandoff(instance); return; }
      if (target.closest("[data-hco-copy-handoff]")) { const code = target.closest("[data-hco-qr]")?.querySelector("code")?.textContent || ""; global.navigator?.clipboard?.writeText?.(code).then(() => setStatus(instance, "Đã copy link handoff.", "success")).catch(() => setStatus(instance, "Không thể copy tự động; hãy chọn link.", "warning")); return; }
      const searchCommand = target.closest("[data-hco-search-command]");
      if (searchCommand) { handleCommand(instance, searchCommand.dataset.hcoSearchCommand); return; }
      const permissionCheck = target.closest("[data-hco-permission-check]");
      if (permissionCheck) { inspectPermission(instance, permissionCheck.dataset.hcoPermissionCheck); return; }
      const permissionHelp = target.closest("[data-hco-permission-help]");
      if (permissionHelp) { setStatus(instance, `Mở cài đặt quyền của trình duyệt để thu hồi ${permissionHelp.dataset.hcoPermissionHelp}; trang web không thể tự sửa trạng thái quyền.`, "warning"); return; }
      if (target.closest("[data-hco-permission-open]")) { instance.state.inspectorOpen = true; root.querySelector("[data-hco-command-deck]")?.classList.add("is-inspector-open"); const inspector = root.querySelector("[data-hco-inspector]"); if (inspector) inspector.hidden = false; root.querySelector("[data-hco-permission-center]")?.scrollIntoView?.({ block: "nearest" }); return; }
      if (target.closest("[data-hco-export]")) { exportCosmicState(instance); return; }
      if (target.closest("[data-hco-import]")) { root.querySelector("[data-hco-import-input]")?.click(); return; }
      if (target.closest("[data-hco-checkpoint],[data-hco-recovery-checkpoint]")) { createCheckpoint(instance); return; }
      if (target.closest("[data-hco-recovery-preview]")) {
        const button = root.querySelector("[data-hco-recovery-confirm]");
        if (button && instance.state.lastSnapshot?.data) button.disabled = false;
        setStatus(instance, instance.state.lastSnapshot?.data ? "Đã xem trước checkpoint; bấm Khôi phục để áp dụng." : "Chưa có checkpoint để xem trước.", "warning"); return;
      }
      if (target.closest("[data-hco-recovery-confirm]")) {
        if (!instance.state.lastSnapshot?.data) { setStatus(instance, "Chưa có checkpoint hợp lệ.", "warning"); return; }
        instance.state = normalizeState({ ...instance.state, ...instance.state.lastSnapshot.data, lastSnapshot: instance.state.lastSnapshot });
        saveState(instance, { silent: true }); applyPresentationSettings(instance); refreshPanel(instance, { message: "Đã khôi phục checkpoint sau bước xem trước.", tone: "success" }); return;
      }
      if (target.closest("[data-hco-cache-audit]")) {
        global.navigator?.storage?.estimate?.().then((estimate) => { const used = Math.round(Number(estimate.usage || 0) / 1048576); const quota = Math.round(Number(estimate.quota || 0) / 1048576); root.querySelectorAll("[data-hco-storage-status]").forEach((node) => { node.textContent = `Dung lượng: ${used}/${quota || "?"} MB`; }); setStatus(instance, `Đang dùng ${used} MB trên ${quota || "chưa rõ"} MB quota trình duyệt.`, "success"); }).catch(() => setStatus(instance, "Trình duyệt chưa cung cấp ước tính dung lượng.", "warning")); return;
      }
      const deleteData = target.closest("[data-hco-delete-data]");
      if (deleteData) {
        if (deleteData.dataset.hcoAwaiting !== "true") { deleteData.dataset.hcoAwaiting = "true"; deleteData.textContent = "Bấm lần nữa để xác nhận"; setStatus(instance, "Xác nhận lần hai để xóa cấu hình Cosmic OS trên thiết bị.", "warning"); setTimeout(() => { delete deleteData.dataset.hcoAwaiting; deleteData.textContent = "Xóa dữ liệu…"; }, 5_000); return; }
        try { global.localStorage?.removeItem?.(instance.storageKey); } catch {}
        instance.state = normalizeState({}); saveState(instance, { silent: true }); applyPresentationSettings(instance); refreshPanel(instance, { message: "Đã xóa và khôi phục cấu hình Cosmic OS mặc định.", tone: "success" }); return;
      }
      if (target.closest("[data-hco-dashboard-customize]")) { openOS(instance, "profiles"); setStatus(instance, "Chọn mật độ, cỡ chữ và bố cục trong Cấu hình.", "success"); return; }
      if (target.closest("[data-hco-dashboard-reset]")) { instance.state.sidebarCollapsed = false; instance.state.inspectorOpen = true; instance.state.settings = normalizeState({}).settings; saveState(instance, { silent: true }); applyPresentationSettings(instance); refreshPanel(instance, { message: "Đã khôi phục bố cục mặc định.", tone: "success" }); return; }
      const profile = target.closest("button[data-hco-profile]");
      if (profile) { instance.state.profile = profile.dataset.hcoProfile; saveState(instance, { silent: true }); if (instance.hcoRoot) instance.hcoRoot.dataset.hcoProfile = instance.state.profile; refreshPanel(instance, { message: `Đã chuyển Home Profile: ${profile.textContent.trim()}.`, tone: "success" }); return; }
      if (target.closest("[data-hco-ambient-toggle]")) { instance.state.ambient = !instance.state.ambient; saveState(instance, { silent: true }); refreshPanel(instance); return; }
      if (target.closest("[data-hco-screensaver-toggle]")) { instance.state.screensaver = !instance.state.screensaver; saveState(instance, { silent: true }); resetIdle(instance); refreshPanel(instance); return; }
      if (target.closest("[data-hco-screensaver-exit]")) { closeScreensaver(instance); return; }
      if (target.closest("[data-hco-mission-refresh]")) { refreshMission(instance); return; }
      if (target.closest("[data-hco-sync]")) { syncState(instance); return; }
      if (target.closest("[data-hco-concierge-close]")) { closeConcierge(instance); return; }
      const conciergeAction = target.closest("[data-hco-concierge-action]");
      if (conciergeAction) { handleConciergeAction(instance, conciergeAction.dataset.hcoConciergeAction); return; }
      const commandPick = target.closest("[data-hco-command-pick]");
      if (commandPick) { const cmd = commandRegistry.find((item) => item.id === commandPick.dataset.hcoCommandPick); if (cmd) handleCommand(instance, cmd.phrases[0]); return; }
      if (target.closest("[data-hco-restore-confirm-action]")) { confirmRestore(instance); return; }
      if (target.closest("[data-hco-restore-cancel]")) { cancelRestore(instance); return; }
      const restorePreview = target.closest("[data-hco-restore-preview]");
      if (restorePreview) { showRestorePreview(instance, restorePreview); return; }
      const routeNode = target.closest("[data-hco-route]");
      if (routeNode && !target.closest("button[disabled]")) { const route = routeNode.dataset.hcoRoute; closeOS(instance); navigate(route); }
    });
    root.addEventListener("submit", (event) => {
      const target = event.target;
      if (target.closest("[data-hco-capture-form]")) { event.preventDefault(); saveCapture(instance); return; }
      if (target.closest("[data-hco-command-form]")) { event.preventDefault(); handleCommand(instance, target.querySelector("[data-hco-command-input]")?.value || ""); }
    });
    root.addEventListener("input", (event) => {
      if (event.target.matches?.("[data-hco-capture-input],[data-hco-capture-type]")) updateCaptureSuggestion(instance);
      if (event.target.matches?.("[data-hco-command-input]")) updateCommandPreview(instance, event.target.value);
      if (event.target.matches?.("[data-hco-universal-search-input]")) searchCosmic(instance, event.target.value);
      if (event.target.matches?.('[data-hco-setting="fontScale"]')) {
        instance.state.settings.fontScale = clamp(event.target.value, .9, 1.3);
        event.target.parentElement?.querySelector("output")?.replaceChildren(global.document.createTextNode(`${Math.round(instance.state.settings.fontScale * 100)}%`));
        applyPresentationSettings(instance);
      }
    });
    root.addEventListener("change", (event) => {
      if (event.target.matches?.("[data-hco-drop-input]")) { const files = [...(event.target.files || [])]; if (files.length) showDropChoices(instance, files); event.target.value = ""; }
      if (event.target.matches?.("[data-hco-import-input]")) { const file = event.target.files?.[0]; if (file) importCosmicFile(instance, file); event.target.value = ""; return; }
      const settingName = event.target.getAttribute?.("data-hco-setting");
      if (settingName && Object.hasOwn(instance.state.settings, settingName)) {
        instance.state.settings[settingName] = event.target.type === "checkbox" ? event.target.checked : settingName === "fontScale" ? clamp(event.target.value, .9, 1.3) : clean(event.target.value, 40);
        saveState(instance, { silent: true }); applyPresentationSettings(instance);
        setStatus(instance, "Đã áp dụng tùy chọn giao diện.", "success");
      }
    });
    ["dragenter", "dragover"].forEach((name) => root.addEventListener(name, (event) => { event.preventDefault(); root.classList.add("is-dragging"); }));
    root.addEventListener("dragleave", (event) => { if (event.target === root) root.classList.remove("is-dragging"); });
    root.addEventListener("drop", (event) => { event.preventDefault(); root.classList.remove("is-dragging"); const files = [...(event.dataTransfer?.files || [])]; if (files.length) showDropChoices(instance, files); });
    root.addEventListener("pointermove", () => { closeScreensaver(instance); resetIdle(instance); }, { passive: true });
    root.addEventListener("keydown", (event) => {
      const activeSurface = [...root.querySelectorAll("[data-hco-mobile-sidebar-sheet],[data-hco-inspector-sheet],[data-hco-concierge],[data-hco-capture-dialog]")].find((node) => !node.hidden);
      if (trapFocus(activeSurface, event)) return;
      if (COMMAND_SHORTCUT === "Control+KeyK" && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openConcierge(instance); }
      if (event.key === "Escape") { closeScreensaver(instance); closeConcierge(instance); const capture = root.querySelector("[data-hco-capture-dialog]"); if (capture) capture.hidden = true; closeOS(instance); }
      if (event.target.matches?.("[data-hco-tab]") && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        const current = TABS.findIndex((item) => item[0] === event.target.dataset.hcoTab);
        const next = TABS[(current + (event.key === "ArrowRight" ? 1 : -1) + TABS.length) % TABS.length][0];
        instance.state.activeTab = next;
        saveState(instance, { silent: true });
        root.querySelectorAll("[data-hco-tab]").forEach((button) => { const active = button.dataset.hcoTab === next; button.setAttribute("aria-selected", String(active)); button.setAttribute("aria-current", active ? "page" : "false"); });
        refreshPanel(instance);
        const nextTab = root.querySelector(`[data-hco-tab="${next}"]`);
        nextTab?.focus();
        nextTab?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      }
    });
    global.document?.addEventListener?.("visibilitychange", () => { if (!global.document.hidden) { resetIdle(instance); refreshPanel(instance); } }, { signal: instance.controller.signal });
    global.addEventListener?.("resize", () => syncOuterMobileNavigation(instance), { signal: instance.controller.signal, passive: true });
    ["hh:event", "hh:home-data-change", "hh:orchestrator:change", "hh:command-center-sync", "hh:focus-mode-change", "hh:communication:notification", "storage"].forEach((name) => global.addEventListener?.(name, () => { if (!global.document?.hidden) { updateTodayCards(instance); if (instance.root.dataset.hcoOverlayOpen === "true") refreshPanel(instance); } }, { signal: instance.controller.signal }));
    global.addEventListener?.("hh:auth-change", () => {
      if (instance.destroyed) return;
      const nextStorageKey = stateKey();
      if (nextStorageKey !== instance.storageKey) {
        const currentRoot = instance.root;
        unmount(currentRoot);
        mount(currentRoot);
        return;
      }
      if (!global.document?.hidden) refreshPanel(instance);
    }, { signal: instance.controller.signal });
  }

  async function syncState(instance) {
    if (!hasAuthenticatedOwner()) { setStatus(instance, "Guest chỉ lưu local; đăng nhập để đồng bộ theo tài khoản.", "warning"); return; }
    try {
      const payload = { title: "HH Cosmic OS State", type: "cosmic-os-state-v2", data: { schemaVersion, profile: instance.state.profile, activeTab: instance.state.activeTab, pipeline: instance.state.pipeline, settings: safeExportPayload(instance.state.settings), updatedAt: nowIso() } };
      const response = await global.fetch?.("/api/modules/home-galaxy/items", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response?.ok) throw new Error("Server chưa xác nhận đồng bộ.");
      setStatus(instance, "Đã đồng bộ cấu hình an toàn theo tài khoản.", "success");
    } catch (error) { setStatus(instance, clean(error?.message || "Đồng bộ chưa sẵn sàng.", 180), "warning"); }
  }

  function mount(root = global.document?.querySelector?.("[data-hgc-root].hgc-v4")) {
    if (!root || !root.matches?.("[data-hgc-root]")) return false;
    if (mountedRoot && mountedRoot !== root) unmount(mountedRoot);
    const existing = root.querySelector("[data-hco-root]");
    if (existing && instances.has(root)) return instances.get(root).api;
    if (existing) existing.remove();
    const activeStorageKey = stateKey();
    const storedState = readJson(activeStorageKey, {});
    const state = normalizeState(storedState);
    if (!Object.hasOwn(storedState || {}, "inspectorOpen") && global.matchMedia?.("(max-width: 1499px)")?.matches) state.inspectorOpen = false;
    const instance = { root, state, storageKey: activeStorageKey, model: null, controller: new AbortController(), idleTimeout: 0, focusTimer: 0, lastFocus: null, healthData: null, healthCheckedAt: "", pendingDrop: [], destroyed: false };
    instance.model = deriveModel(state);
    root.insertAdjacentHTML("beforeend", shellMarkup(instance, instance.model));
    instance.hcoRoot = root.querySelector("[data-hco-root]");
    instance.root.dataset.hcoOverlayOpen = "true";
    root.classList.add("hco-command-host");
    root.closest?.(".app-main")?.classList.add("hco-command-active");
    applyPresentationSettings(instance);
    syncOuterMobileNavigation(instance);
    instance.launcher = instance.hcoRoot?.querySelector("button[data-hco-open]") || null;
    const commandControls = root.querySelector(".hgc-command-controls");
    if (instance.launcher && commandControls) {
      instance.launcher.classList.add("is-commandbar");
      commandControls.append(instance.launcher);
    }
    bindEvents(instance);
    instance.hcoRoot.querySelectorAll("[data-hco-mini-window]").forEach((node) => bindMini(instance, node));
    instances.set(root, instance);
    updateTodayCards(instance);
    applyContext(instance, instance.model);
    applySignals(instance, instance.model);
    persistLargeCollections(instance, instance.model).catch?.(() => false);
    instance.focusTimer = setInterval(() => { if (!global.document?.hidden) updateFocusClock(instance); }, 1000);
    resetIdle(instance);
    mountedRoot = root;
    return instance.api || (instance.api = Object.freeze({
      version: VERSION,
      open: (tab = "brief") => openOS(instance, tab),
      close: () => closeOS(instance),
      refresh: () => refreshPanel(instance),
      snapshot: () => clone(deriveModel(instance.state)),
      state: () => clone(instance.state),
      sync: () => syncState(instance),
      destroy: () => unmount(root)
    }));
  }

  function unmount(root) {
    const instance = instances.get(root);
    if (!instance) return false;
    instance.destroyed = true;
    instance.controller.abort();
    clearTimeout(instance.idleTimeout);
    clearInterval(instance.focusTimer);
    instance.hcoRoot?.querySelectorAll("[data-hco-mini-window]").forEach((node) => { clearInterval(node._hcoTimer); });
    instance.launcher?.remove();
    instance.hcoRoot?.remove();
    if (instance.appMobileNav?.node) {
      if (instance.appMobileNav.value) instance.appMobileNav.node.style.setProperty("display", instance.appMobileNav.value, instance.appMobileNav.priority);
      else instance.appMobileNav.node.style.removeProperty("display");
    }
    root.classList.remove("hco-command-host");
    root.closest?.(".app-main")?.classList.remove("hco-command-active");
    instances.delete(root);
    if (mountedRoot === root) mountedRoot = null;
    return true;
  }

  function findActiveRoot() {
    return global.document?.querySelector?.('[data-hgc-root].hgc-v4');
  }

  function autoMount() {
    const attach = () => { const root = findActiveRoot(); if (root) mount(root); return Boolean(root); };
    observer?.disconnect?.();
    observer = typeof global.MutationObserver === "function" ? new global.MutationObserver(() => { attach(); }) : null;
    if (observer) {
      observer.observe(global.document.documentElement, { childList: true, subtree: true });
      // Keep watching: the V4 command host intentionally rebuilds itself once
      // after the enhancement group is ready. A one-shot observer would leave
      // Cosmic OS detached from the replacement root.
      observer.takeRecords?.();
    }
    attach();
    global.addEventListener?.("hh:assets-ready", (event) => { if (event.detail?.route === "/home") setTimeout(attach, 120); });
    global.addEventListener?.("hh:asset-group-ready", (event) => { if (event.detail?.group === "home-enhancements") setTimeout(attach, 180); });
    global.addEventListener?.("hashchange", () => {
      if (/^#\/home(?:$|[/?])/.test(global.location.hash) || !global.location.hash) setTimeout(attach, 100);
      else if (mountedRoot) unmount(mountedRoot);
    });
    return true;
  }

  return Object.freeze({
    VERSION,
    version: VERSION,
    STORAGE_PREFIX,
    STORES,
    TABS,
    PROFILES,
    PIPELINE,
    SCENES,
    ownerScope,
    scopedKey,
    normalizeState,
    priorityScore,
    priorityReason,
    rankPriorities,
    missionStatus,
    resolveCapabilityState,
    capabilityState: resolveCapabilityState,
    validateImportPayload,
    validateCosmicImport: validateImportPayload,
    safeExportPayload,
    createSafeExportPayload: safeExportPayload,
    safeHandoffPayload,
    isSensitiveClipboard,
    transitionQueueItem,
    collectMorningBrief,
    collectContinueStack,
    collectUniversalInbox,
    collectWhatsNew,
    suggestCaptureDestination,
    commandRegistry,
    mount,
    unmount,
    autoMount
  });
});
