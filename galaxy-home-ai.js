(function (root, factory) {
  "use strict";

  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHGalaxyHomeAI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (globalScope) {
  "use strict";

  const VERSION = "1.3.0";
  const HOME_PREF_KEY = "hh.galaxy.home.preferences.v1";
  const FOCUS_KEY = "hh.galaxy.dashboard.focus.v1";
  const TASK_KEY = "hh.command-center.todos.v2";
  const NOTE_KEY = "hh.dashboard.sticky-notes.v1";
  const LAYER_ONE_STORAGE_KEY = "hh.galaxy.layer-one.v1";
  const NOTIFICATION_KEY = "hh-notification-center";
  const PROJECT_KEYS = Object.freeze(["hh.creative-os.v1", "hh-project-center"]);
  const GALAXY_DATA_KEYS = Object.freeze({
    projects: "hh.galaxy.projects.v1",
    tasks: "hh.galaxy.tasks.v1",
    notes: "hh.galaxy.notes.v1",
    favorites: "hh.galaxy.favorites.v1",
    activity: "hh.galaxy.activity.v1",
    notifications: "hh.galaxy.notifications.v1"
  });
  const CORE_ENTRY_ROUTE = "/create";
  const AI_ATTACHMENT_CONFIG = Object.freeze({
    databaseName: "hh-galaxy-ai-attachments-v1",
    storeName: "text-attachments",
    databaseVersion: 1,
    maxFiles: 3,
    maxFileBytes: 128 * 1024,
    maxTotalBytes: 256 * 1024,
    maxTextCharacters: 100000,
    maxContextCharacters: 2200,
    maxStoredRecords: 12,
    maxStoredCharacters: 500000,
    accept: ".txt,.md,.json,text/plain,text/markdown,application/json"
  });
  const AI_ATTACHMENT_TYPES = Object.freeze({
    ".txt": Object.freeze(["", "text/plain"]),
    ".md": Object.freeze(["", "text/plain", "text/markdown", "text/x-markdown"]),
    ".json": Object.freeze(["", "text/plain", "text/json", "application/json"])
  });
  const ROUTES = Object.freeze(["/home", "/home/dashboard", "/create/ai-center", "/chat-ai"]);
  const PLANETS = Object.freeze([
    { id: "music", label: "Music Planet", note: "Nhạc và âm thanh", route: "/galaxy/music", tone: "cyan", x: 27.96, y: 13.47, size: 82 },
    { id: "video", label: "Video Planet", note: "Video và điện ảnh", route: "/galaxy/video", tone: "orange", x: 58.82, y: 15.9, size: 72 },
    { id: "creator", label: "Creator Studio", note: "Không gian sáng tạo", route: "/galaxy/creator", tone: "violet", x: 75.14, y: 30.09, size: 80 },
    { id: "dev", label: "Dev Planet", note: "Code và công cụ", route: "/galaxy/dev", tone: "blue", x: 74.57, y: 51.29, size: 78 },
    { id: "community", label: "Community", note: "Kết nối cộng đồng", route: "/galaxy/community", tone: "aqua", x: 61.42, y: 65.47, size: 78 },
    { id: "tools", label: "Tools Galaxy", note: "Tiện ích chuyên dụng", route: "/galaxy/tools", tone: "violet", x: 40.32, y: 73.21, size: 82 },
    { id: "learn", label: "Learning Star", note: "Học tập và ngôn ngữ", route: "/galaxy/learning", tone: "blue", x: 22.4, y: 62.75, size: 82 },
    { id: "games", label: "Games World", note: "Trò chơi và giải trí", route: "/galaxy/games", tone: "pink", x: 8.45, y: 45.56, size: 78 },
    { id: "ai", label: "AI Universe", note: "AI và trợ lý", route: "/galaxy/ai", tone: "amber", x: 14.96, y: 27.79, size: 82 }
  ]);
  const HOME_NAV_ITEMS = Object.freeze([
    { id: "home", label: "Trang chủ", route: "/home" },
    { id: "ai", label: "AI Universe", route: "/galaxy/ai" },
    { id: "music", label: "Music Planet", route: "/galaxy/music" },
    { id: "video", label: "Video Planet", route: "/galaxy/video" },
    { id: "creator", label: "Creator Studio", route: "/galaxy/creator" },
    { id: "games", label: "Games World", route: "/galaxy/games" },
    { id: "dev", label: "Dev Planet", route: "/galaxy/dev" },
    { id: "learn", label: "Learning Star", route: "/galaxy/learning" },
    { id: "community", label: "Community", route: "/galaxy/community" },
    { id: "tools", label: "Tools Galaxy", route: "/galaxy/tools" },
    { id: "analytics", label: "Analytics", route: "/galaxy/analytics" },
    { id: "settings", label: "Cài đặt", route: "/galaxy/settings" }
  ]);
  const AI_DESTINATIONS = Object.freeze([
    { id: "chat", label: "Hỏi đáp nhanh", description: "Giải đáp mọi thắc mắc nhanh chóng", route: "/chat-ai", icon: "activity" },
    { id: "project", label: "Tạo project mới", description: "Khởi tạo dự án với AI hỗ trợ", route: "/work/projects-tasks", icon: "folder" },
    { id: "tools", label: "Tìm tool / app", description: "Tìm kiếm công cụ phù hợp", route: "/galaxy/tools", icon: "globe" },
    { id: "automation", label: "Tự động hóa (AI)", description: "Xây workflow với trạng thái rõ ràng", route: "/work/automation-lab", icon: "settings" },
    { id: "analytics", label: "Phân tích tổng quan", description: "Mở dữ liệu và báo cáo hiện có", route: "/analytics", icon: "analytics" },
    { id: "today", label: "Gợi ý hôm nay", description: "Xem lối tắt từ dữ liệu đã lưu", route: "/home/dashboard", icon: "diamond" }
  ]);

  let activeRuntime = null;
  let attachmentSequence = 0;
  const memoryAttachmentStore = new Map();

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[character]));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const asArray = (value) => Array.isArray(value) ? value : [];
  const isObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));

  function attachmentExtension(value) {
    const match = String(value || "").trim().toLocaleLowerCase("en-US").match(/\.[a-z0-9]+$/);
    return match ? match[0] : "";
  }

  function safeAttachmentName(value) {
    const name = String(value || "tài-liệu.txt").split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f]/g, "").trim();
    return (name || "tài-liệu.txt").slice(0, 160);
  }

  function validateAttachmentMetadata(file, selected = []) {
    if (!file || typeof file !== "object") return { valid: false, reason: "Tệp không hợp lệ." };
    const name = safeAttachmentName(file.name);
    const extension = attachmentExtension(name);
    const mimeType = String(file.type || "").trim().toLocaleLowerCase("en-US").split(";")[0];
    const size = Number(file.size);
    if (!AI_ATTACHMENT_TYPES[extension]) return { valid: false, reason: "Chỉ chấp nhận tệp .txt, .md hoặc .json." };
    if (!AI_ATTACHMENT_TYPES[extension].includes(mimeType)) return { valid: false, reason: `Content-Type của ${name} không phù hợp.` };
    if (!Number.isFinite(size) || size < 0 || size > AI_ATTACHMENT_CONFIG.maxFileBytes) {
      return { valid: false, reason: `${name} vượt quá giới hạn 128 KB.` };
    }
    const current = asArray(selected);
    if (current.length >= AI_ATTACHMENT_CONFIG.maxFiles) return { valid: false, reason: "Chỉ được chọn tối đa 3 tệp." };
    const totalBytes = current.reduce((sum, item) => sum + (Number(item?.size ?? item?.file?.size) || 0), 0) + size;
    if (totalBytes > AI_ATTACHMENT_CONFIG.maxTotalBytes) return { valid: false, reason: "Tổng dung lượng tệp vượt quá 256 KB." };
    return { valid: true, value: Object.freeze({ name, extension, mimeType: mimeType || AI_ATTACHMENT_TYPES[extension].find(Boolean) || "text/plain", size }) };
  }

  function containsPotentialSecret(value) {
    const text = String(value || "");
    if (/-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?(?:PRIVATE KEY|SECRET KEY)-----/i.test(text)) return true;
    if (/\b(?:sk-(?:proj-)?[a-z0-9_-]{20,}|github_pat_[a-z0-9_]{20,}|gh[opusr]_[a-z0-9]{30,}|AKIA[0-9A-Z]{16})\b/i.test(text)) return true;
    const assignment = /\b(api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd)\b\s*["']?\s*[:=]\s*["']?([^\s,"'\]}]{8,})/gi;
    let match;
    while ((match = assignment.exec(text))) {
      if (!/^(?:example|sample|placeholder|replace[_-]?me|your[_-]?(?:key|token|secret)|dummy|test)$/i.test(match[2])) return true;
    }
    return false;
  }

  function sanitizeAttachmentText(value, metadata = {}) {
    const raw = String(value ?? "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    const controls = raw.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g) || [];
    if (raw.includes("\u0000") || (raw.length > 0 && controls.length / raw.length > 0.01)) {
      return { valid: false, reason: `${safeAttachmentName(metadata.name)} có nội dung nhị phân hoặc ký tự điều khiển.` };
    }
    if (raw.length > AI_ATTACHMENT_CONFIG.maxTextCharacters) {
      return { valid: false, reason: `${safeAttachmentName(metadata.name)} có quá nhiều ký tự để xử lý an toàn.` };
    }
    const text = raw.trim();
    if (!text) return { valid: false, reason: `${safeAttachmentName(metadata.name)} không có nội dung văn bản.` };
    if (metadata.extension === ".json") {
      try { JSON.parse(text); } catch { return { valid: false, reason: `${safeAttachmentName(metadata.name)} không phải JSON hợp lệ.` }; }
    }
    if (containsPotentialSecret(text)) return { valid: false, reason: `${safeAttachmentName(metadata.name)} có dấu hiệu chứa secret hoặc thông tin xác thực.` };
    return { valid: true, text };
  }

  function makeAttachmentId() {
    try {
      const generated = globalScope.crypto?.randomUUID?.();
      if (generated) return `ai-text-${generated}`;
    } catch { /* A deterministic fallback is sufficient for local record keys. */ }
    attachmentSequence += 1;
    return `ai-text-${Date.now()}-${attachmentSequence}`;
  }

  async function readSelectedAttachments(files, options = {}) {
    const selected = asArray(Array.from(files || []));
    const records = [];
    let validated = [];
    for (const file of selected) {
      if (options.signal?.aborted) throw Object.assign(new Error("Đã hủy đọc tệp."), { code: "ATTACHMENT_ABORTED" });
      const validation = validateAttachmentMetadata(file, validated);
      if (!validation.valid) throw Object.assign(new Error(validation.reason), { code: "ATTACHMENT_METADATA_INVALID" });
      validated = validated.concat(validation.value);
      if (typeof file.text !== "function") throw Object.assign(new Error(`${validation.value.name} không hỗ trợ đọc văn bản an toàn.`), { code: "ATTACHMENT_TEXT_UNAVAILABLE" });
      const sanitization = sanitizeAttachmentText(await file.text(), validation.value);
      if (!sanitization.valid) throw Object.assign(new Error(sanitization.reason), { code: "ATTACHMENT_CONTENT_INVALID" });
      if (options.signal?.aborted) throw Object.assign(new Error("Đã hủy đọc tệp."), { code: "ATTACHMENT_ABORTED" });
      records.push(Object.freeze({
        id: makeAttachmentId(),
        name: validation.value.name,
        extension: validation.value.extension,
        mimeType: validation.value.mimeType,
        size: validation.value.size,
        text: sanitization.text,
        createdAt: new Date().toISOString()
      }));
    }
    return records;
  }

  function composeAIHandoffPrompt(prompt, records, maxCharacters = 4000) {
    const question = String(prompt || "").trim().slice(0, 1600);
    if (!question || !asArray(records).length) return question;
    const budget = Math.max(0, Math.min(
      AI_ATTACHMENT_CONFIG.maxContextCharacters,
      Math.min(Number(maxCharacters) || 4000, 4000) - question.length - 3
    ));
    if (budget < 80) return question;
    let context = "Tài liệu người dùng đã chủ động đính kèm:\n";
    for (const record of records) {
      const heading = `\n--- ${safeAttachmentName(record?.name)} ---\n`;
      if (context.length + heading.length >= budget) break;
      const remaining = budget - context.length - heading.length;
      const text = String(record?.text || "");
      if (!text) continue;
      context += heading + text.slice(0, remaining);
      if (text.length > remaining && context.length + 24 <= budget) context += "\n[Đã rút gọn nội dung]";
      if (context.length >= budget) break;
    }
    return `${question}\n\n${context.slice(0, budget)}`.slice(0, 4000);
  }

  function storeAiHandoff(storage, payload) {
    if (!storage || typeof storage.setItem !== "function" || !isObject(payload)) return false;
    try {
      const serialized = JSON.stringify(payload);
      if (!serialized || serialized.length > 12000) return false;
      storage.setItem("hh.galaxy.ai.handoff.v1", serialized);
      return true;
    } catch {
      return false;
    }
  }

  function pruneMemoryAttachments() {
    const records = [...memoryAttachmentStore.values()].sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));
    let characters = records.reduce((sum, record) => sum + String(record.text || "").length, 0);
    while (records.length > AI_ATTACHMENT_CONFIG.maxStoredRecords || characters > AI_ATTACHMENT_CONFIG.maxStoredCharacters) {
      const removed = records.shift();
      if (!removed) break;
      memoryAttachmentStore.delete(removed.id);
      characters -= String(removed.text || "").length;
    }
  }

  function openAttachmentDatabase(scope = globalScope) {
    return new Promise((resolve, reject) => {
      if (!scope.indexedDB?.open) return reject(Object.assign(new Error("IndexedDB không khả dụng."), { code: "INDEXEDDB_UNAVAILABLE" }));
      let request;
      try { request = scope.indexedDB.open(AI_ATTACHMENT_CONFIG.databaseName, AI_ATTACHMENT_CONFIG.databaseVersion); }
      catch (error) { reject(error); return; }
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(AI_ATTACHMENT_CONFIG.storeName)) database.createObjectStore(AI_ATTACHMENT_CONFIG.storeName, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Không thể mở IndexedDB."));
      request.onblocked = () => reject(Object.assign(new Error("IndexedDB đang bị khóa bởi phiên khác."), { code: "INDEXEDDB_BLOCKED" }));
    });
  }

  async function persistAttachmentRecords(records, scope = globalScope) {
    const safeRecords = asArray(records).map((record) => {
      if (!isObject(record) || typeof record.text !== "string") return null;
      const name = safeAttachmentName(record.name);
      const extension = attachmentExtension(name);
      const sanitization = sanitizeAttachmentText(record.text, { name, extension });
      if (!sanitization.valid || !AI_ATTACHMENT_TYPES[extension]) return null;
      const mimeType = AI_ATTACHMENT_TYPES[extension].includes(String(record.mimeType || "").toLocaleLowerCase("en-US"))
        ? String(record.mimeType || "").toLocaleLowerCase("en-US")
        : AI_ATTACHMENT_TYPES[extension].find(Boolean) || "text/plain";
      return {
        id: String(record.id || makeAttachmentId()).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120) || makeAttachmentId(),
        name,
        extension,
        mimeType,
        size: clamp(record.size, 0, AI_ATTACHMENT_CONFIG.maxFileBytes),
        text: sanitization.text,
        createdAt: Number.isFinite(Date.parse(String(record.createdAt || ""))) ? new Date(record.createdAt).toISOString() : new Date().toISOString()
      };
    }).filter(Boolean);
    if (!safeRecords.length) return { mode: "none", saved: 0 };
    let database;
    try {
      database = await openAttachmentDatabase(scope);
      await new Promise((resolve, reject) => {
        const transaction = database.transaction(AI_ATTACHMENT_CONFIG.storeName, "readwrite");
        const store = transaction.objectStore(AI_ATTACHMENT_CONFIG.storeName);
        safeRecords.forEach((record) => store.put({ ...record }));
        const request = store.getAll();
        request.onsuccess = () => {
          const all = asArray(request.result).sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));
          let characters = all.reduce((sum, record) => sum + String(record.text || "").length, 0);
          while (all.length > AI_ATTACHMENT_CONFIG.maxStoredRecords || characters > AI_ATTACHMENT_CONFIG.maxStoredCharacters) {
            const removed = all.shift();
            if (!removed) break;
            store.delete(removed.id);
            characters -= String(removed.text || "").length;
          }
        };
        request.onerror = () => { try { transaction.abort(); } catch { /* Transaction may already have failed. */ } };
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || request.error || new Error("Không thể lưu tệp vào IndexedDB."));
        transaction.onabort = () => reject(transaction.error || request.error || new Error("Đã hủy lưu tệp vào IndexedDB."));
      });
      return { mode: "indexeddb", saved: safeRecords.length };
    } catch (error) {
      safeRecords.forEach((record) => memoryAttachmentStore.set(record.id, { ...record }));
      pruneMemoryAttachments();
      return { mode: "memory", saved: safeRecords.length, reason: String(error?.code || error?.message || "INDEXEDDB_FAILED") };
    } finally {
      try { database?.close?.(); } catch { /* Closing is best-effort. */ }
    }
  }

  function resolveAdaptiveExperience(storage, scope = globalScope, overrides = {}) {
    const stored = readRecord(storage, LAYER_ONE_STORAGE_KEY).value?.settings || {};
    const requestedEffects = ["quiet", "balanced", "rich"].includes(overrides.effects) ? overrides.effects
      : ["quiet", "balanced", "rich"].includes(stored.effects) ? stored.effects : "balanced";
    const reducedSetting = ["system", "on", "off"].includes(overrides.reducedMotion) ? overrides.reducedMotion
      : ["system", "on", "off"].includes(stored.reducedMotion) ? stored.reducedMotion : "system";
    const navigator = scope.navigator || {};
    const memory = Number(navigator.deviceMemory);
    const cores = Number(navigator.hardwareConcurrency);
    const saveData = navigator.connection?.saveData === true;
    const low = saveData || (Number.isFinite(memory) && memory > 0 && memory <= 4) || (Number.isFinite(cores) && cores > 0 && cores <= 4);
    const high = !low && Number.isFinite(memory) && memory >= 8 && Number.isFinite(cores) && cores >= 8;
    const deviceTier = low ? "low" : high ? "high" : "mid";
    let systemReduced = false;
    try { systemReduced = Boolean(scope.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches); } catch { /* Treat an unavailable media query as no preference. */ }
    const reduced = reducedSetting === "on" || (reducedSetting === "system" && systemReduced);
    let motion = requestedEffects;
    if (reduced || requestedEffects === "quiet") motion = "quiet";
    else if (deviceTier === "low") motion = requestedEffects === "rich" ? "balanced" : "quiet";
    return Object.freeze({ requestedEffects, reducedSetting, reduced, systemReduced, deviceTier, motion });
  }

  function formatDate(value, withTime = false) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    try {
      return withTime
        ? date.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })
        : date.toLocaleDateString("vi-VN");
    } catch {
      return "";
    }
  }

  function normalizeRoute(value) {
    const raw = String(value || "/home").trim().replace(/^#/, "").split("?")[0].split("#")[0] || "/home";
    const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
    return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : withSlash;
  }

  function canHandle(value) {
    const route = normalizeRoute(value);
    return route === "/home" || route === "/home/dashboard" || route === "/create/ai-center" || route === "/chat-ai" || route.startsWith("/chat-ai/");
  }

  function readRecord(storage, key) {
    try {
      const raw = storage?.getItem?.(key);
      if (raw == null) return { found: false, value: null };
      return { found: true, value: JSON.parse(raw) };
    } catch {
      return { found: false, value: null, invalid: true };
    }
  }

  function writeRecord(storage, key, value) {
    try {
      storage?.setItem?.(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function normalizeTask(task, index) {
    if (!isObject(task)) return null;
    const title = String(task.title || task.text || "").trim().slice(0, 240);
    if (!title) return null;
    return {
      id: String(task.id || `task-${index}`),
      title,
      completed: Boolean(task.completed ?? task.done),
      category: String(task.category || "").trim().slice(0, 80),
      deadline: String(task.deadline || "").trim().slice(0, 40),
      rawIndex: index
    };
  }

  function normalizeProject(project, index) {
    if (!isObject(project)) return null;
    const name = String(project.name || project.title || "").trim().slice(0, 180);
    if (!name) return null;
    const progressValue = Number(project.progress ?? project.completion);
    return {
      id: String(project.id || project._id || `project-${index}`),
      name,
      progress: Number.isFinite(progressValue) ? clamp(progressValue, 0, 100) : null,
      updatedAt: project.updatedAt || project.updated || null
    };
  }

  function normalizeNote(note, index) {
    if (typeof note === "string") return note.trim() ? { id: `note-${index}`, text: note.trim().slice(0, 4000), pinned: false } : null;
    if (!isObject(note)) return null;
    const text = String(note.text || note.content || "").trim().slice(0, 4000);
    return text ? { id: String(note.id || `note-${index}`), text, pinned: Boolean(note.pinned), updatedAt: note.updatedAt || null } : null;
  }

  function normalizeLayerOneItem(item, index) {
    if (!isObject(item) || item.isDemo === true || item.isSample === true) return null;
    const metaSource = isObject(item.meta) ? item.meta : {};
    if (metaSource.isDemo === true || metaSource.isSample === true || item.source === "local-template" || item.source === "sample") return null;
    const route = normalizeRoute(item.route || "");
    if (!HOME_NAV_ITEMS.some((entry) => entry.route === route) || ["/home", "/galaxy/analytics", "/galaxy/settings"].includes(route)) return null;
    const title = String(item.title || item.name || "").trim().slice(0, 160);
    if (!title) return null;
    const createdAt = Number.isFinite(Date.parse(String(item.createdAt || ""))) ? new Date(item.createdAt).toISOString() : null;
    const updatedAt = Number.isFinite(Date.parse(String(item.updatedAt || ""))) ? new Date(item.updatedAt).toISOString() : createdAt;
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(metaSource.dueDate || "")) ? String(metaSource.dueDate) : "";
    return {
      id: String(item.id || `layer-one-item-${index}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 96) || `layer-one-item-${index}`,
      route,
      title,
      kind: String(item.kind || "document").trim().slice(0, 60) || "document",
      description: String(item.description || "").trim().slice(0, 1000),
      createdAt,
      updatedAt,
      meta: {
        completed: metaSource.completed === true,
        dueDate,
        learningCategory: ["note", "plan", "resource"].includes(metaSource.learningCategory) ? metaSource.learningCategory : ""
      }
    };
  }

  function layerOneRouteLabel(route) {
    return HOME_NAV_ITEMS.find((item) => item.route === route)?.label || "HH Galaxy";
  }

  function inspectLayerOneSnapshot(storage) {
    const record = readRecord(storage, LAYER_ONE_STORAGE_KEY);
    if (record.invalid) return { status: "error", items: [], documents: [], tasks: [], projects: [], notes: [], activity: [], analyticsConsent: false };
    if (!record.found) return { status: "empty", items: [], documents: [], tasks: [], projects: [], notes: [], activity: [], analyticsConsent: false };
    if (!isObject(record.value) || (record.value.version != null && Number(record.value.version) !== 1) || !Array.isArray(record.value.items)) {
      return { status: "error", items: [], documents: [], tasks: [], projects: [], notes: [], activity: [], analyticsConsent: false };
    }
    const items = record.value.items.slice(-120).map(normalizeLayerOneItem).filter(Boolean).sort((left, right) => {
      return (Date.parse(right.updatedAt || right.createdAt || "") || 0) - (Date.parse(left.updatedAt || left.createdAt || "") || 0);
    });
    const tasks = items.filter((item) => item.meta.learningCategory === "plan" || /(?:^|[-_])(plan|task|checklist)(?:$|[-_])/i.test(item.kind)).map((item) => ({
      id: item.id,
      title: item.title,
      completed: item.meta.completed,
      category: "Kế hoạch Layer 1",
      deadline: item.meta.dueDate,
      route: item.route,
      updatedAt: item.updatedAt
    }));
    const projects = items.filter((item) => /(?:^|[-_])project(?:$|[-_])/i.test(item.kind)).map((item) => ({
      id: item.id,
      name: item.title,
      progress: null,
      updatedAt: item.updatedAt,
      route: item.route
    }));
    const notes = items.filter((item) => item.meta.learningCategory === "note" || /(?:^|[-_])note(?:$|[-_])/i.test(item.kind)).map((item) => ({
      id: item.id,
      text: item.description || item.title,
      pinned: false,
      updatedAt: item.updatedAt,
      route: item.route
    }));
    const analyticsConsent = record.value.settings?.analyticsConsent === true;
    const activityLabels = {
      "route-view": "Đã mở khu vực",
      "item-create": "Đã tạo tài liệu",
      "item-delete": "Đã xóa tài liệu",
      "data-export": "Đã xuất dữ liệu",
      "data-import": "Đã nhập dữ liệu",
      "permission-check": "Đã kiểm tra quyền"
    };
    const activity = analyticsConsent ? asArray(record.value.events).slice(-300).filter(isObject).map((event) => {
      const route = normalizeRoute(event.route || "");
      const at = Number.isFinite(Date.parse(String(event.at || ""))) ? new Date(event.at).toISOString() : null;
      return { action: activityLabels[event.type] || "Hoạt động Layer 1", title: layerOneRouteLabel(route), route, at };
    }).filter((event) => event.at).sort((left, right) => Date.parse(right.at) - Date.parse(left.at)).slice(0, 20) : [];
    return { status: "ready", items, documents: items.slice(0, 12), tasks, projects, notes, activity, analyticsConsent };
  }

  function firstProjectCollection(storage) {
    for (const key of PROJECT_KEYS) {
      const record = readRecord(storage, key);
      if (!record.found || !isObject(record.value)) continue;
      const candidates = [record.value.projects, record.value.items, record.value.data?.projects];
      const collection = candidates.find(Array.isArray);
      if (collection) return { key, items: collection.map(normalizeProject).filter(Boolean), found: true };
    }
    return { key: null, items: [], found: false };
  }

  function readNotificationSnapshot(storage) {
    const record = readRecord(storage, NOTIFICATION_KEY);
    const inbox = asArray(record.value?.inbox).filter((item) => isObject(item));
    return {
      unreadCount: clamp(inbox.filter((item) => !item.read).length, 0, 999),
      totalCount: clamp(inbox.length, 0, 999),
      found: record.found && Array.isArray(record.value?.inbox)
    };
  }

  function collectLocalData(storage = globalScope.localStorage, scope = globalScope) {
    const storedAuth = readRecord(storage, "hh-auth-user");
    const sessionAuth = storedAuth.found ? { found: false, value: null } : readRecord(scope.sessionStorage, "hh.auth.guest-user");
    let runtimeAuth = { found: false, value: null };
    if (!storedAuth.found && !sessionAuth.found && typeof scope.HHAuthz?.currentUser === "function") {
      try {
        const value = scope.HHAuthz.currentUser();
        runtimeAuth = { found: isObject(value), value };
      } catch { /* Authentication adapters may not be ready during first paint. */ }
    }
    const auth = storedAuth.found ? storedAuth : sessionAuth.found ? sessionAuth : runtimeAuth;
    const tasks = readRecord(storage, TASK_KEY);
    const notes = readRecord(storage, NOTE_KEY);
    const favorites = readRecord(storage, "hh-module-favorites");
    const activity = readRecord(storage, "hh.command-center.activity.v1");
    const weather = readRecord(storage, "hh.dashboard.weather.v1");
    const projects = firstProjectCollection(storage);
    const notifications = readNotificationSnapshot(storage);
    const taskItems = asArray(tasks.value).map(normalizeTask).filter(Boolean);
    const noteItems = asArray(notes.value).map(normalizeNote).filter(Boolean).sort((left, right) => Number(right.pinned) - Number(left.pinned));
    const weatherPayload = isObject(weather.value?.payload) ? weather.value.payload : {};
    const currentWeather = isObject(weatherPayload.weather?.current) ? weatherPayload.weather.current : {};
    const modules = asArray(scope.HH_PLATFORM_MODULES).filter((item) => isObject(item) && item.id);
    const local = {
      account: auth.found && isObject(auth.value) ? {
        name: String(auth.value.name || auth.value.displayName || "").trim().slice(0, 120),
        avatar: String(auth.value.avatar || auth.value.picture || "").trim(),
        email: String(auth.value.email || "").trim().slice(0, 180),
        plan: String(auth.value.plan || auth.value.tier || "").trim().slice(0, 32)
      } : null,
      projects: projects.items,
      tasks: taskItems,
      notes: noteItems,
      favorites: asArray(favorites.value).filter((item) => typeof item === "string").slice(0, 100),
      activity: asArray(activity.value).filter((item) => typeof item === "string" || isObject(item)).slice(0, 20),
      weather: weather.found && Number.isFinite(Number(currentWeather.temperature_2m)) ? {
        temperature: Number(currentWeather.temperature_2m),
        humidity: Number.isFinite(Number(currentWeather.relative_humidity_2m)) ? Number(currentWeather.relative_humidity_2m) : null,
        windSpeed: Number.isFinite(Number(currentWeather.wind_speed_10m)) ? Number(currentWeather.wind_speed_10m) : null,
        location: String(weather.value?.location?.name || "").trim().slice(0, 120),
        observedAt: weather.value?.savedAt || weather.value?.updatedAt || null
      } : null,
      notifications,
      modules,
      capability: {
        chat: typeof scope.HHChatAI?.mount === "function" ? "ready" : "configuration-required",
        online: typeof scope.navigator?.onLine === "boolean" ? scope.navigator.onLine : null
      },
      evidence: {
        account: auth.found,
        projects: projects.found,
        tasks: tasks.found,
        notes: notes.found,
        favorites: favorites.found,
        activity: activity.found,
        weather: weather.found,
        notifications: notifications.found,
        modules: Array.isArray(scope.HH_PLATFORM_MODULES)
      },
      source: "local"
    };
    Object.defineProperty(local, "_raw", {
      enumerable: false,
      value: { taskItems: asArray(tasks.value), noteItems: asArray(notes.value), projectKey: projects.key }
    });
    return local;
  }

  function collectGalaxyLocalData(storage = globalScope.localStorage, scope = globalScope) {
    const platform = collectLocalData(storage, scope);
    const layerOne = inspectLayerOneSnapshot(storage);
    const projectsRecord = readRecord(storage, GALAXY_DATA_KEYS.projects);
    const tasksRecord = readRecord(storage, GALAXY_DATA_KEYS.tasks);
    const notesRecord = readRecord(storage, GALAXY_DATA_KEYS.notes);
    const favoritesRecord = readRecord(storage, GALAXY_DATA_KEYS.favorites);
    const activityRecord = readRecord(storage, GALAXY_DATA_KEYS.activity);
    const notificationRecord = readRecord(storage, GALAXY_DATA_KEYS.notifications);
    const projectItems = Array.isArray(projectsRecord.value)
      ? projectsRecord.value
      : asArray(projectsRecord.value?.projects);
    const notificationItems = Array.isArray(notificationRecord.value)
      ? notificationRecord.value
      : asArray(notificationRecord.value?.inbox);
    const hasCanonicalSnapshot = layerOne.status !== "empty";
    const projects = hasCanonicalSnapshot ? layerOne.projects : projectItems.filter(isObject).map(normalizeProject).filter(Boolean);
    const tasks = hasCanonicalSnapshot ? layerOne.tasks : asArray(tasksRecord.value).map(normalizeTask).filter(Boolean);
    const notes = hasCanonicalSnapshot ? layerOne.notes : asArray(notesRecord.value).map(normalizeNote).filter(Boolean);
    const activity = hasCanonicalSnapshot ? layerOne.activity : asArray(activityRecord.value).filter((item) => typeof item === "string" || isObject(item)).slice(0, 20);
    return {
      ...platform,
      projects,
      tasks,
      notes,
      recentDocuments: layerOne.documents,
      favorites: asArray(favoritesRecord.value).filter((item) => typeof item === "string").slice(0, 100),
      activity,
      notifications: {
        unreadCount: clamp(notificationItems.filter((item) => isObject(item) && !item.read).length, 0, 999),
        totalCount: clamp(notificationItems.length, 0, 999),
        found: notificationRecord.found
      },
      modules: HOME_NAV_ITEMS.map((item) => ({ ...item })),
      capability: {
        ...platform.capability,
        layerOneStorage: layerOne.status,
        aiProvider: "configuration-required",
        analytics: layerOne.analyticsConsent ? "ready" : "disabled"
      },
      evidence: {
        account: platform.evidence.account,
        projects: hasCanonicalSnapshot ? layerOne.status === "ready" : projectsRecord.found,
        tasks: hasCanonicalSnapshot ? layerOne.status === "ready" : tasksRecord.found,
        notes: hasCanonicalSnapshot ? layerOne.status === "ready" : notesRecord.found,
        recentDocuments: layerOne.status === "ready",
        layerOne: layerOne.status === "ready",
        favorites: favoritesRecord.found,
        activity: hasCanonicalSnapshot ? layerOne.analyticsConsent : activityRecord.found,
        weather: false,
        notifications: notificationRecord.found,
        modules: true
      },
      layerOne: { status: layerOne.status, itemCount: layerOne.items.length, analyticsConsent: layerOne.analyticsConsent },
      source: layerOne.status === "ready" ? "layer-one-local" : layerOne.status === "error" ? "layer-one-error" : "local"
    };
  }

  function mergeData(local, provided) {
    if (!isObject(provided)) return local;
    const result = { ...local, source: String(provided.source || "passed-api") };
    for (const key of ["projects", "tasks", "notes", "favorites", "activity", "modules"]) {
      if (!Object.prototype.hasOwnProperty.call(provided, key)) continue;
      if (key === "projects") result[key] = asArray(provided[key]).map(normalizeProject).filter(Boolean);
      else if (key === "tasks") result[key] = asArray(provided[key]).map((item, index) => {
        const task = normalizeTask(item, index);
        if (task) delete task.rawIndex;
        return task;
      }).filter(Boolean);
      else if (key === "notes") result[key] = asArray(provided[key]).map(normalizeNote).filter(Boolean);
      else result[key] = asArray(provided[key]);
      result.evidence = { ...result.evidence, [key]: true };
    }
    if (Object.prototype.hasOwnProperty.call(provided, "account")) {
      result.account = isObject(provided.account) ? { ...provided.account } : null;
      result.evidence = { ...result.evidence, account: true };
    }
    if (Object.prototype.hasOwnProperty.call(provided, "weather")) {
      result.weather = isObject(provided.weather) ? { ...provided.weather } : null;
      result.evidence = { ...result.evidence, weather: true };
    }
    if (Object.prototype.hasOwnProperty.call(provided, "notifications")) {
      const value = isObject(provided.notifications) ? provided.notifications : {};
      result.notifications = {
        unreadCount: clamp(value.unreadCount, 0, 999),
        totalCount: clamp(value.totalCount, 0, 999),
        found: Boolean(value.found)
      };
      result.evidence = { ...result.evidence, notifications: Boolean(value.found) };
    }
    if (isObject(provided.capability)) result.capability = { ...result.capability, ...provided.capability };
    if (isObject(provided.evidence)) result.evidence = { ...result.evidence, ...provided.evidence };
    Object.defineProperty(result, "_raw", { enumerable: false, value: local._raw || {} });
    return result;
  }

  function initials(name) {
    return String(name || "HH").trim().split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase().slice(0, 2) || "HH";
  }

  function safeImageUrl(value) {
    const url = String(value || "").trim();
    if (!url || url.length > 2048) return "";
    if (/^(?:https?:\/\/|\/[^/]|\.\.?\/)/i.test(url)) return escapeHtml(url);
    if (/^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(url) && url.length <= 1048576) return escapeHtml(url);
    return "";
  }

  function iconMarkup(id, className = "") {
    const icons = {
      home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10M9 20v-6h6v6"/>',
      ai: '<rect x="5" y="5" width="14" height="14" rx="3"/><path d="M9 9h6v6H9zM9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m14-6h3m-3 6h3"/>',
      music: '<path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
      video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
      creator: '<path d="m12 3 2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8z"/>',
      games: '<path d="M7.5 8h9a5 5 0 0 1 4.6 6.9l-1.3 3.2a2.2 2.2 0 0 1-3.7.7L14.5 17h-5l-1.6 1.8a2.2 2.2 0 0 1-3.7-.7l-1.3-3.2A5 5 0 0 1 7.5 8Z"/><path d="M8 11v4m-2-2h4m6-1h.01m2 2h.01"/>',
      dev: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9"/>',
      learn: '<path d="m3 9 9-5 9 5-9 5z"/><path d="M7 12v4c2.8 2.2 7.2 2.2 10 0v-4m4-3v7"/>',
      community: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20v-2a5 5 0 0 1 10 0v2m1.5-5.5A4.5 4.5 0 0 1 21 18.6V20"/>',
      tools: '<path d="m14 6 4-4 4 4-4 4M2 18l4 4 4-4-4-4zM8 16l8-8"/><path d="m4 4 16 16"/>',
      analytics: '<path d="M4 20V10m5 10V4m6 16v-7m5 7V7M2 20h20"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
      user: '<circle cx="12" cy="8" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
      resource: '<path d="m12 3 8 4-8 4-8-4zM4 12l8 4 8-4M4 17l8 4 8-4"/>',
      globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
      bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
      compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
      fullscreen: '<path d="M8 3H3v5m13-5h5v5M8 21H3v-5m13 5h5v-5"/>',
      send: '<path d="m3 11 18-8-8 18-2-8zM11 13l4-4"/>',
      clip: '<path d="m20.5 11.5-8.8 8.8a5 5 0 0 1-7.1-7.1l9.2-9.2a3.5 3.5 0 0 1 5 5l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
      chevron: '<path d="m9 18 6-6-6-6"/>',
      diamond: '<path d="m12 2 9 8-9 12L3 10zM3 10h18M8 2l-2 8 6 12 6-12-2-8"/>',
      folder: '<path d="M3 6h7l2 2h9v11H3z"/>',
      layers: '<path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
      activity: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
      task: '<path d="M9 5h11v15H4V5h2m3 7 2 2 4-5"/><path d="M8 3h8v4H8z"/>'
    };
    const body = icons[id] || icons.globe;
    return `<svg${className ? ` class="${escapeHtml(className)}"` : ""} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
  }

  function accountAvatarMarkup(account, className = "") {
    const name = String(account?.name || "Thành viên HH").trim();
    const avatar = safeImageUrl(account?.avatar);
    return `<span${className ? ` class="${escapeHtml(className)}"` : ""}>${avatar ? `<img src="${avatar}" alt="">` : escapeHtml(initials(name))}</span>`;
  }

  function sourceLabel(data) {
    if (data.source === "layer-one-local") return "Snapshot Layer 1 trên thiết bị";
    if (data.source === "layer-one-error") return "Snapshot Layer 1 không đọc được";
    if (data.source === "local") return "Dữ liệu trên thiết bị";
    if (data.source === "loading") return "Đang đồng bộ nguồn được cấp";
    return "Dữ liệu từ nguồn đã kết nối";
  }

  function metricMarkup(label, value, available, route) {
    const content = available ? escapeHtml(value) : "—";
    const state = available ? "ready" : "empty";
    return `<button class="gha-metric" type="button" data-gha-route="${escapeHtml(route)}" data-state="${state}"><span>${escapeHtml(label)}</span><strong>${content}</strong><small>${available ? "Dữ liệu hiện có" : "Chưa có dữ liệu"}</small></button>`;
  }

  function topbarMarkup(title, subtitle, active, data = {}) {
    const account = data.account || null;
    const accountName = String(account?.name || "Tài khoản HH").trim().slice(0, 120);
    const routeControls = active === "dashboard"
      ? `<button type="button" data-gha-route="/work/projects-tasks" aria-label="Mở lịch và công việc">${iconMarkup("task")}</button><button type="button" data-gha-route="/recent" aria-label="Mở hoạt động gần đây">${iconMarkup("bell")}</button><button type="button" data-gha-route="/settings" aria-label="Mở cài đặt giao diện">${iconMarkup("settings")}</button><button class="gha-topbar__account" type="button" data-gha-route="/settings" aria-label="Mở tài khoản ${escapeHtml(accountName)}">${accountAvatarMarkup(account)}<span>${escapeHtml(accountName)}</span></button>`
      : active === "ai"
        ? `<button type="button" data-gha-route="/recent" aria-label="Mở hoạt động gần đây">${iconMarkup("bell")}</button><button class="gha-topbar__account" type="button" data-gha-route="/settings" aria-label="Mở tài khoản ${escapeHtml(accountName)}">${accountAvatarMarkup(account)}<span>${escapeHtml(accountName)}</span></button><button class="gha-topbar__primary" type="button" data-gha-route="/chat-ai/new"><i aria-hidden="true">＋</i><span>+ Cuộc trò chuyện mới</span></button>`
        : `<button type="button" data-gha-route="/home" ${active === "home" ? 'aria-current="page"' : ""}>Bản đồ</button><button type="button" data-gha-route="/home/dashboard" ${active === "dashboard" ? 'aria-current="page"' : ""}>Dashboard</button><button type="button" data-gha-route="/create/ai-center" ${active === "ai" ? 'aria-current="page"' : ""}>AI</button>`;
    return `<header class="gha-topbar">
      <a class="gha-brand" href="#/home" data-gha-route="/home" aria-label="Về Home Galaxy"><span aria-hidden="true">HH</span><b>HOANG8.COM</b></a>
      <label class="gha-search"><span aria-hidden="true">⌕</span><input type="search" data-gha-search placeholder="Tìm kiếm galaxy, công cụ, tài nguyên..." aria-label="Tìm trong không gian này"><kbd>⌘K</kbd></label>
      <div class="gha-topbar__copy"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(subtitle)}</small></div>
      <nav aria-label="Điều hướng nhanh">${routeControls}</nav>
    </header>`;
  }

  function sidebarMarkup(active) {
    const items = [
      ["home", "Home Galaxy", "/home"], ["ai", "AI Universe", "/create/ai-center"], ["music", "Music Planet", "/music-ai"],
      ["video", "Video Planet", "/davinci-resolve"], ["creator", "Creator Studio", "/create"], ["games", "Games World", "/play"],
      ["dev", "Dev Planet", "/dev-tools"], ["learn", "Learning Star", "/learn"], ["community", "Community", "/communication/community"], ["tools", "Tools Galaxy", "/galaxy/tools"]
    ];
    return `<aside class="gha-sidebar"><div class="gha-sidebar__title"><span>HH GALAXY</span><small>Không gian số của bạn</small></div><nav aria-label="Các không gian HH">${items.map(([id, label, route]) => `<button type="button" data-gha-route="${route}" ${active === id ? 'aria-current="page"' : ""}><i aria-hidden="true">${iconMarkup(id)}</i><span>${label}</span></button>`).join("")}</nav><footer><span class="gha-live-dot" aria-hidden="true"></span><div><strong data-gha-network>Đang kiểm tra</strong><small>Trạng thái trình duyệt</small></div></footer></aside>`;
  }

  function homeSidebarMarkup(data) {
    const account = data.account;
    const name = String(account?.name || "Thành viên HH").trim().slice(0, 120);
    const accountDetail = String(account?.email || (data.evidence.account ? "Tài khoản HH" : "Chưa đăng nhập")).trim().slice(0, 180);
    const plan = String(account?.plan || account?.tier || "").trim().toLowerCase();
    const planBadge = ["pro", "premium", "paid"].includes(plan) ? "<small>PRO</small>" : "";
    return `<aside class="gha-sidebar gha-home-sidebar" aria-label="Điều hướng HH Galaxy">
      <a class="gha-home-brand" href="#/home" data-gha-route="/home" aria-label="HOANG8.COM — Trang chủ">
        <span class="gha-home-brand__mark" aria-hidden="true">HH</span>
        <strong>HOANG8.COM</strong>
        ${planBadge}
      </a>
      <label class="gha-search gha-home-search">
        ${iconMarkup("globe")}
        <span class="gha-sr-only">Tìm chức năng trong Galaxy</span>
        <input type="search" data-gha-search autocomplete="off" maxlength="80" placeholder="Tìm kiếm trong galaxy..." aria-label="Tìm chức năng trong Galaxy">
        <kbd>⌘K</kbd>
      </label>
      <nav class="gha-home-nav" aria-label="Các không gian HH">${HOME_NAV_ITEMS.map((item) => `<button type="button" data-gha-route="${escapeHtml(item.route)}" data-gha-nav-item="${escapeHtml(item.id)}" data-gha-searchable ${item.id === "home" ? 'aria-current="page"' : ""}>${iconMarkup(item.id)}<span>${escapeHtml(item.label)}</span>${item.id === "home" ? iconMarkup("chevron", "gha-home-nav__arrow") : ""}</button>`).join("")}</nav>
      <p class="gha-home-search-empty" data-gha-search-empty hidden role="status">Không tìm thấy chức năng phù hợp.</p>
      <section class="gha-home-customize" aria-labelledby="gha-customize-title">
        ${iconMarkup("diamond")}
        <div><h2 id="gha-customize-title">Tùy chỉnh Galaxy</h2><p>Màu sắc, chuyển động và bố cục theo cách của bạn.</p></div>
        <button type="button" data-gha-route="/galaxy/settings">Mở cài đặt ${iconMarkup("chevron")}</button>
      </section>
      <button class="gha-home-profile" type="button" data-user-menu-toggle aria-haspopup="menu" aria-expanded="false" aria-label="Mở menu tài khoản của ${escapeHtml(name)}">
        ${accountAvatarMarkup(account, "gha-home-profile__avatar")}
        <span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(accountDetail)}</small></span>
        <i aria-hidden="true">⌄</i>
      </button>
    </aside>`;
  }

  function homeTopbarMarkup(data) {
    const account = data.account;
    const name = String(account?.name || "Tài khoản").trim().slice(0, 120);
    const unreadCount = clamp(data.notifications?.unreadCount, 0, 999);
    const notificationBadge = unreadCount ? `<span class="gha-home-notification__badge" aria-label="${unreadCount} thông báo chưa đọc">${unreadCount > 99 ? "99+" : unreadCount}</span>` : "";
    return `<header class="gha-topbar gha-home-topbar">
      <div class="gha-home-topbar__title">${iconMarkup("globe")}<span><strong>HH GALAXY MAP 3D <i>BETA</i></strong><small>Khám phá vũ trụ số · Kết nối không giới hạn</small></span></div>
      <section class="gha-home-player" aria-label="Lối tắt đến trình phát nhạc">
        <button class="gha-home-player__cover" type="button" data-gha-route="/galaxy/music" aria-label="Mở Music Planet">${iconMarkup("music")}</button>
        <button class="gha-home-player__copy" type="button" data-gha-route="/galaxy/music"><strong>Music Planet</strong><small>Không gian âm thanh lớp Galaxy</small></button>
        <div class="gha-home-player__controls">
          <button type="button" data-gha-route="/galaxy/music" aria-label="Mở danh sách nhạc"><span aria-hidden="true">|◀</span></button>
          <button type="button" data-gha-route="/galaxy/music" aria-label="Mở trình phát nhạc"><span aria-hidden="true">▶</span></button>
          <button type="button" data-gha-route="/galaxy/music" aria-label="Mở Music Planet"><span aria-hidden="true">▶|</span></button>
        </div>
        <span class="gha-home-player__wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
        <small class="gha-home-player__state">Mở player</small>
      </section>
      <div class="gha-home-topbar__actions">
        <button class="gha-home-notification" type="button" data-gha-route="/galaxy/settings" aria-label="Mở cài đặt thông báo Galaxy">${iconMarkup("bell")}${notificationBadge}</button>
        <button class="gha-home-user" type="button" data-user-menu-toggle aria-haspopup="menu" aria-expanded="false" aria-label="Mở menu tài khoản của ${escapeHtml(name)}">${accountAvatarMarkup(account, "gha-home-user__avatar")}<span>${escapeHtml(name)}</span><i aria-hidden="true">⌄</i></button>
      </div>
    </header>`;
  }

  function planetIconMarkup(id) {
    return `<span class="gha-planet__sphere" aria-hidden="true">${iconMarkup(id)}</span>`;
  }

  function homeMetricMarkup(icon, label, value, detail, available, route) {
    return `<button class="gha-home-stat" type="button" data-gha-route="${escapeHtml(route)}" data-state="${available ? "ready" : "empty"}">
      <span class="gha-home-stat__icon" aria-hidden="true">${iconMarkup(icon)}</span>
      <span><small>${escapeHtml(label)}</small><strong>${available ? escapeHtml(value) : "—"}</strong><em>${available ? escapeHtml(detail) : "Chưa có dữ liệu"}</em></span>
    </button>`;
  }

  function homeTimelineMarkup(data) {
    const pendingTasks = asArray(data.tasks).filter((task) => !task.completed);
    const documents = asArray(data.recentDocuments);
    const rows = [];
    if (pendingTasks[0]) {
      const task = pendingTasks[0];
      rows.push({ icon: "task", title: task.title, detail: task.deadline ? `Kế hoạch · hạn ${formatDate(task.deadline)}` : "Kế hoạch đang thực hiện", route: task.route || "/galaxy/learning", id: task.id });
    }
    for (const document of documents) {
      if (rows.length >= 2) break;
      if (rows.some((row) => row.id === document.id)) continue;
      rows.push({ icon: "folder", title: document.title, detail: `${layerOneRouteLabel(document.route)}${document.updatedAt ? ` · ${formatDate(document.updatedAt, true)}` : ""}`, route: document.route, id: document.id });
    }
    const content = rows.length ? `<ol>${rows.map((item) => `<li><span aria-hidden="true">${iconMarkup(item.icon)}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></div></li>`).join("")}</ol>` : `<div class="gha-home-timeline__empty" data-state="empty"><span>${iconMarkup("activity")}</span><p>Chưa có kế hoạch hoặc tài liệu người dùng.</p></div>`;
    const destination = rows[0]?.route || "/galaxy/creator";
    return `<aside class="gha-home-timeline" aria-labelledby="gha-timeline-title"><header><h2 id="gha-timeline-title">Command Center</h2><button type="button" data-gha-route="${escapeHtml(destination)}">Mở gần nhất ${iconMarkup("chevron")}</button></header>${content}</aside>`;
  }

  function homeDockMarkup(data) {
    const documentsAvailable = Boolean(data.evidence.recentDocuments);
    const tasksAvailable = Boolean(data.evidence.tasks);
    const taskCount = asArray(data.tasks).length;
    const pendingTasks = asArray(data.tasks).filter((task) => !task.completed).length;
    const documents = asArray(data.recentDocuments);
    const layerOneState = String(data.capability?.layerOneStorage || "empty");
    const layerOneLabel = layerOneState === "ready" ? "Sẵn sàng" : layerOneState === "error" ? "Lỗi dữ liệu" : "Chưa khởi tạo";
    const providerState = String(data.capability?.aiProvider || "configuration-required");
    const providerLabel = providerState === "ready" ? "Đã xác minh" : providerState === "loading" ? "Đang kiểm tra" : providerState === "error" ? "Có lỗi" : "Chưa cấu hình";
    return `<footer class="gha-home-dock" aria-label="Trạng thái và dữ liệu Galaxy">
      <section class="gha-home-status" aria-labelledby="gha-status-title">
        <header><span class="gha-live-dot" aria-hidden="true"></span><div><h2 id="gha-status-title">Galaxy Status</h2><strong data-gha-network>Đang kiểm tra</strong></div></header>
        <ul class="gha-home-capabilities" aria-label="Khả năng đang xác minh">
          <li><span>Kho Layer 1</span><b data-state="${escapeHtml(layerOneState)}">${escapeHtml(layerOneLabel)}</b></li>
          <li><span>AI backend</span><b data-state="${escapeHtml(providerState)}">${escapeHtml(providerLabel)}</b></li>
        </ul>
        <p class="gha-sr-only" data-gha-network-copy>Kết nối trình duyệt</p>
        <small>${escapeHtml(sourceLabel(data))}</small>
      </section>
      <section class="gha-home-stats" aria-label="Số liệu thật của tài khoản">
        ${homeMetricMarkup("user", "Tài khoản", "1", "Hồ sơ hiện tại", Boolean(data.evidence.account), "/galaxy/settings")}
        ${homeMetricMarkup("folder", "Tài liệu", String(documents.length), "Do người dùng tạo", documentsAvailable, documents[0]?.route || "/galaxy/creator")}
        <button class="gha-home-stat gha-home-stat--storage" type="button" data-gha-route="/galaxy/settings" data-state="loading">
          <span class="gha-home-stat__icon" aria-hidden="true">${iconMarkup("resource")}</span>
          <span><small>Tài nguyên</small><strong data-gha-storage-value>—</strong><em data-gha-storage-detail>Đang đọc Storage API…</em><i data-gha-storage-state data-state="loading">Đang đo</i><b data-gha-storage-bar style="--usage:0%"></b></span>
        </button>
        <button class="gha-home-stat" type="button" data-gha-route="/galaxy/learning" data-state="${tasksAvailable ? "ready" : "empty"}">
          <span class="gha-home-stat__icon" aria-hidden="true">${iconMarkup("task")}</span>
          <span><small>Kế hoạch</small><strong>${tasksAvailable ? escapeHtml(`${pendingTasks}/${taskCount}`) : "—"}</strong><em>${tasksAvailable ? "Đang làm / tổng" : "Chưa có dữ liệu"}</em></span>
        </button>
      </section>
      ${homeTimelineMarkup(data)}
    </footer>`;
  }

  function homeMarkup(data) {
    return `<section class="gha-app gha-home" data-gha-root data-gha-view="home">
      ${homeSidebarMarkup(data)}
      ${homeTopbarMarkup(data)}
      <main class="gha-stage">
        <section class="gha-map" data-gha-map aria-labelledby="gha-home-title">
          <h1 id="gha-home-title" class="gha-sr-only">HH Galaxy Map 3D</h1>
          <div class="gha-system" data-gha-system>
            <div class="gha-map__stars" aria-hidden="true"></div><div class="gha-map__nebula" aria-hidden="true"></div>
            <div class="gha-orbits" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
            <button class="gha-core" type="button" data-gha-entry="hh-core" data-gha-route="${CORE_ENTRY_ROUTE}" style="--x:44.51%;--y:39.4%;--size:148px" aria-label="Mở HH Core và vào HH Platform"><span aria-hidden="true">HH</span><strong>HH CORE</strong><small>Cổng vào HH Platform</small></button>
            <div class="gha-planets" role="navigation" aria-label="Bản đồ các chức năng">${PLANETS.map((planet, index) => `<button class="gha-planet gha-planet--${planet.tone}" type="button" data-gha-route="${escapeHtml(planet.route)}" data-gha-planet="${escapeHtml(planet.id)}" data-gha-searchable style="--x:${planet.x}%;--y:${planet.y}%;--size:${planet.size}px;--delay:${index * -1.8}s" aria-label="Mở ${escapeHtml(planet.label)} — ${escapeHtml(planet.note)}">${planetIconMarkup(planet.id)}<strong>${escapeHtml(planet.label)}</strong><small>${escapeHtml(planet.note)}</small></button>`).join("")}</div>
            <form class="gha-home-prompt" data-gha-ai-form autocomplete="off"><label class="gha-sr-only" for="gha-home-prompt-input">Hỏi HH AI</label><span aria-hidden="true">⌕</span><input id="gha-home-prompt-input" data-gha-ai-input type="text" maxlength="1600" placeholder="Nhập câu hỏi hoặc gõ / để mở nhanh..." aria-describedby="gha-home-prompt-hint"><small id="gha-home-prompt-hint" class="gha-sr-only">HH Core là cổng duy nhất để mở các chức năng HH Platform.</small><button type="submit" aria-label="Gửi câu hỏi tới HH AI">${iconMarkup("send")}</button></form>
            <p class="gha-home-gateway-notice" data-gha-gateway-notice role="status" aria-live="polite">HH Core là cổng duy nhất để mở lớp chức năng HH Platform.</p>
            <div class="gha-map__controls" aria-label="Điều khiển bản đồ">
              <button type="button" data-gha-action="reset-view" aria-label="Đặt lại hướng nhìn">${iconMarkup("compass")}</button>
              <div><button type="button" data-gha-action="zoom-in" aria-label="Phóng to bản đồ">＋</button><output data-gha-zoom aria-live="polite">100%</output><button type="button" data-gha-action="zoom-out" aria-label="Thu nhỏ bản đồ">−</button></div>
              <button type="button" data-gha-action="fullscreen" aria-label="Bật chế độ toàn màn hình" aria-pressed="false">${iconMarkup("fullscreen")}</button>
            </div>
          </div>
          ${homeDockMarkup(data)}
        </section>
      </main>
    </section>`;
  }

  function emptyState(label, route, actionLabel) {
    return `<div class="gha-empty"><span>◇</span><p>${escapeHtml(label)}</p>${route ? `<button type="button" data-gha-route="${escapeHtml(route)}">${escapeHtml(actionLabel || "Mở chức năng")}</button>` : ""}</div>`;
  }

  function taskListMarkup(data) {
    if (!data.evidence.tasks) return emptyState("Chưa có kho công việc cục bộ.", "/work/projects-tasks", "Tạo công việc");
    if (!data.tasks.length) return emptyState("Kho công việc đang trống.", "/work/projects-tasks", "Thêm công việc");
    return `<div class="gha-task-list">${data.tasks.slice(0, 7).map((task) => {
      const writable = Number.isInteger(task.rawIndex);
      return `<label title="${writable ? "Lưu thay đổi trên thiết bị" : "Dữ liệu chỉ đọc; mở workspace để chỉnh sửa"}"><input type="checkbox" ${writable ? `data-gha-task="${task.rawIndex}"` : 'disabled aria-disabled="true"'} ${task.completed ? "checked" : ""}><span><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.category || (task.deadline ? `Hạn ${task.deadline}` : writable ? "Công việc" : "Dữ liệu chỉ đọc"))}</small></span></label>`;
    }).join("")}</div>`;
  }

  function projectListMarkup(data) {
    if (!data.evidence.projects) return emptyState("Chưa tìm thấy kho dự án đã lưu.", "/work/projects-tasks", "Mở Projects");
    if (!data.projects.length) return emptyState("Kho dự án đang trống.", "/work/projects-tasks", "Tạo dự án");
    return `<div class="gha-project-list">${data.projects.slice(0, 4).map((project) => {
      const updated = project.updatedAt ? formatDate(project.updatedAt) : "";
      return `<button type="button" data-gha-route="/work/projects-tasks"><span><strong>${escapeHtml(project.name)}</strong><small>${updated ? `Cập nhật ${escapeHtml(updated)}` : "Dự án đã lưu"}</small></span>${Number.isFinite(project.progress) ? `<output>${Math.round(project.progress)}%</output>` : ""}</button>`;
    }).join("")}</div>`;
  }

  function weatherMarkup(data) {
    if (!data.evidence.weather || !data.weather) return emptyState("Chưa có dữ liệu thời tiết đã xác minh.", null);
    const weather = data.weather;
    const observed = weather.observedAt ? formatDate(weather.observedAt, true) : "";
    return `<div class="gha-weather"><strong>${Math.round(Number(weather.temperature))}°C</strong><span>${escapeHtml(weather.location || "Vị trí đã lưu")}</span><dl>${weather.humidity != null ? `<div><dt>Độ ẩm</dt><dd>${Math.round(Number(weather.humidity))}%</dd></div>` : ""}${weather.windSpeed != null ? `<div><dt>Gió</dt><dd>${Math.round(Number(weather.windSpeed))} km/h</dd></div>` : ""}</dl><small>${observed ? `Nguồn lưu lúc ${escapeHtml(observed)}` : "Dữ liệu nguồn được cấp"}</small></div>`;
  }

  function dashboardMetricMarkup(icon, label, value, detail, available, route, extra = "") {
    return `<button class="gha-dashboard-metric" type="button" data-gha-route="${escapeHtml(route)}" data-state="${available ? "ready" : "empty"}">
      <span aria-hidden="true">${iconMarkup(icon)}</span>
      <span><small>${escapeHtml(label)}</small><strong${extra}>${available ? escapeHtml(value) : "—"}</strong><em>${available ? escapeHtml(detail) : "Chưa có dữ liệu"}</em></span>
    </button>`;
  }

  function dashboardActivityMarkup(data) {
    if (!data.evidence.activity || !data.activity.length) return emptyState("Chưa có hoạt động đã lưu.", null);
    return `<ol>${data.activity.slice(0, 5).map((item) => {
      const label = typeof item === "string" ? item : String(item.action || item.title || item.label || "Hoạt động đã lưu");
      const time = typeof item === "string" ? "" : formatDate(item.at || item.createdAt || item.updatedAt, true);
      return `<li><span aria-hidden="true">${iconMarkup("activity")}</span><div><strong>${escapeHtml(label.slice(0, 180))}</strong><small>${time ? escapeHtml(time) : "Đã lưu trên thiết bị"}</small></div></li>`;
    }).join("")}</ol>`;
  }

  function dashboardMarkup(data) {
    const name = String(data.account?.name || "Thành viên HH").trim();
    const avatar = safeImageUrl(data.account?.avatar);
    const note = data.notes[0]?.text || "";
    const projectCount = asArray(data.projects).length;
    const taskCount = asArray(data.tasks).length;
    const completedTasks = asArray(data.tasks).filter((task) => task.completed).length;
    const favoriteCount = asArray(data.favorites).length;
    return `<section class="gha-app gha-dashboard" data-gha-root data-gha-view="dashboard">
      ${topbarMarkup("Dashboard cá nhân", "Widget dùng dữ liệu thật và trạng thái rõ ràng", "dashboard", data)}
      ${sidebarMarkup("home")}
      <main class="gha-stage">
        <header class="gha-dashboard-toolbar">
          <div><span>HH CORE · KHÔNG GIAN CÁ NHÂN</span><h1>Dashboard cá nhân · Tùy chỉnh widget</h1><p>Trung tâm điều khiển cá nhân hóa trong vũ trụ số của bạn.</p></div>
          <div><button type="button" data-gha-route="/work/projects-tasks">${iconMarkup("task")} Mở công việc</button><button class="gha-primary" type="button" data-gha-route="/settings">${iconMarkup("settings")} Tùy chỉnh</button></div>
        </header>
        <section class="gha-dashboard__head">
          <div class="gha-dashboard-profile"><div class="gha-avatar">${avatar ? `<img src="${avatar}" alt="">` : escapeHtml(initials(name))}</div><div><span>Xin chào</span><h2>${escapeHtml(name)}</h2><p>${escapeHtml(sourceLabel(data))}</p></div></div>
          <div class="gha-dashboard-metrics" aria-label="Số liệu cá nhân đã xác minh">
            ${dashboardMetricMarkup("folder", "Dự án", String(projectCount), "Trong workspace", Boolean(data.evidence.projects), "/work/projects-tasks")}
            ${dashboardMetricMarkup("task", "Nhiệm vụ", `${completedTasks}/${taskCount}`, "Đã hoàn thành", Boolean(data.evidence.tasks), "/work/projects-tasks", ' data-gha-task-metric')}
            ${dashboardMetricMarkup("diamond", "Yêu thích", String(favoriteCount), "Module đã đánh dấu", Boolean(data.evidence.favorites), "/favorites")}
            ${dashboardMetricMarkup("activity", "Focus", "0", "Phiên hoàn thành", true, "/home/dashboard", ' data-gha-focus-metric')}
          </div>
          <div class="gha-dashboard__clock"><strong data-gha-clock>--:--</strong><small data-gha-date>Đang lấy giờ thiết bị</small></div>
        </section>
        <section class="gha-widget-grid" aria-label="Các widget cá nhân">
          <article class="gha-widget gha-widget--weather"><header><div><span>MÔI TRƯỜNG ĐÃ LƯU</span><h2>Thời tiết</h2></div><i data-state="${data.weather ? "ready" : "empty"}">${data.weather ? "Có dữ liệu" : "Chưa cấu hình"}</i></header>${weatherMarkup(data)}</article>
          <article class="gha-widget gha-widget--projects"><header><div><span>WORKSPACE</span><h2>Dự án gần đây</h2></div><button type="button" data-gha-route="/work/projects-tasks">Xem tất cả</button></header>${projectListMarkup(data)}</article>
          <article class="gha-widget gha-widget--tasks"><header><div><span>HÔM NAY</span><h2>Nhiệm vụ</h2></div><button type="button" data-gha-route="/work/projects-tasks">Mở đầy đủ</button></header>${taskListMarkup(data)}</article>
          <article class="gha-widget gha-widget--storage"><header><div><span>TRÌNH DUYỆT</span><h2>Lưu trữ website</h2></div><i data-gha-storage-state data-state="loading">Đang đo</i></header><div class="gha-storage-meter"><span data-gha-storage-bar style="--usage:0%"></span></div><strong data-gha-storage-value>Đang đọc Storage API…</strong><small data-gha-storage-detail>Không thay thế dung lượng ổ đĩa hệ điều hành.</small></article>
          <article class="gha-widget gha-widget--activity"><header><div><span>DÒNG THỜI GIAN</span><h2>Hoạt động gần đây</h2></div><button type="button" data-gha-route="/recent">Xem tất cả</button></header>${dashboardActivityMarkup(data)}</article>
          <article class="gha-widget gha-widget--notes"><header><div><span>LOCAL-FIRST</span><h2>Ghi chú nhanh</h2></div><i data-state="${data.evidence.notes ? "ready" : "empty"}">${data.evidence.notes ? "Có dữ liệu" : "Sẽ tạo khi lưu"}</i></header><label><span class="gha-sr-only">Nội dung ghi chú</span><textarea data-gha-note maxlength="4000" placeholder="Viết ghi chú trên thiết bị...">${escapeHtml(note)}</textarea></label><footer><small data-gha-note-status>${note ? "Đang hiển thị ghi chú đã lưu" : "Chưa có ghi chú"}</small><button type="button" data-gha-action="save-note">Lưu ghi chú</button></footer></article>
          <article class="gha-widget gha-widget--focus"><header><div><span>FOCUS</span><h2>Pomodoro</h2></div><button type="button" data-gha-action="focus-reset">Đặt lại</button></header><div class="gha-focus-ring"><strong data-gha-focus-time>25:00</strong><span data-gha-focus-state>Sẵn sàng</span></div><button class="gha-primary" type="button" data-gha-action="focus-toggle">Bắt đầu</button><small data-gha-focus-count>0 phiên hoàn thành</small></article>
          <article class="gha-widget gha-widget--status"><header><div><span>CAPABILITY</span><h2>Trạng thái thật</h2></div><span class="gha-live-dot"></span></header><dl><div><dt>Kết nối mạng</dt><dd data-gha-network-detail>Đang kiểm tra</dd></div><div><dt>Chat AI engine</dt><dd data-state="${escapeHtml(data.capability.chat)}">${data.capability.chat === "ready" ? "Có sẵn" : "Cần tải module"}</dd></div><div><dt>Module đã nạp</dt><dd>${data.evidence.modules ? data.modules.length : "Chưa xác minh"}</dd></div></dl></article>
        </section>
        <footer class="gha-dashboard-foot"><span>${iconMarkup("layers")} Widget chỉ hiển thị dữ liệu có nguồn</span><button type="button" data-gha-route="/settings">Quản lý dữ liệu và bố cục</button></footer>
      </main>
      <footer class="gha-dashboard-system" aria-label="Nền tảng Dashboard"><span><b>HH Galaxy</b> Không gian cá nhân</span><span><b>Dữ liệu thật</b> Nguồn được cấp</span><span><b>Local-first</b> Lưu trên thiết bị</span><button type="button" data-gha-route="/settings"><b>Tùy chỉnh</b> Mở cài đặt</button></footer>
    </section>`;
  }

  function capabilityText(value) {
    return ({ ready: "Sẵn sàng", loading: "Đang kiểm tra", offline: "Ngoại tuyến", error: "Có lỗi", "configuration-required": "Cần cấu hình", unknown: "Chưa xác minh" })[value] || "Mở workspace";
  }

  function copilotModuleMarkup(icon, title, detail, route, state, stateLabel) {
    return `<button type="button" data-gha-route="${escapeHtml(route)}" data-gha-searchable><span aria-hidden="true">${iconMarkup(icon)}</span><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></span><i data-state="${escapeHtml(state)}">${escapeHtml(stateLabel)}</i></button>`;
  }

  function copilotInsightMarkup(data) {
    const insights = [];
    if (data.evidence.tasks) {
      const total = data.tasks.length;
      const done = data.tasks.filter((task) => task.completed).length;
      insights.push({ icon: "task", title: total ? `${done}/${total} nhiệm vụ hoàn thành` : "Kho nhiệm vụ đang trống", detail: total ? "Tiến độ lấy từ công việc trên thiết bị" : "Tạo nhiệm vụ đầu tiên trong Work Center", route: "/work/projects-tasks", progress: total ? Math.round(done / total * 100) : 0 });
    }
    if (data.evidence.projects) {
      const project = data.projects[0];
      insights.push({ icon: "folder", title: project ? project.name : "Kho dự án đang trống", detail: project ? "Mở dự án gần nhất để tiếp tục" : "Tạo dự án đầu tiên trong Project Hub", route: "/work/projects-tasks", progress: Number.isFinite(project?.progress) ? Math.round(project.progress) : null });
    }
    if (data.evidence.notes) insights.push({ icon: "layers", title: `${data.notes.length} ghi chú đã lưu`, detail: "Dữ liệu local-first trên thiết bị", route: "/home/dashboard", progress: null });
    if (!insights.length) return `<div class="gha-copilot-empty"><span>${iconMarkup("activity")}</span><strong>Chưa có gợi ý từ dữ liệu cá nhân</strong><p>Khi bạn tạo nhiệm vụ, dự án hoặc ghi chú, Copilot sẽ hiển thị lối tắt phù hợp tại đây.</p></div>`;
    return `<div class="gha-copilot-insights">${insights.slice(0, 3).map((item) => `<button type="button" data-gha-route="${escapeHtml(item.route)}"><span aria-hidden="true">${iconMarkup(item.icon)}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small>${Number.isFinite(item.progress) ? `<i style="--progress:${clamp(item.progress, 0, 100)}%"><b>${clamp(item.progress, 0, 100)}%</b></i>` : ""}</span></button>`).join("")}</div>`;
  }

  function aiMarkup(data) {
    const providerState = String(data.capability?.aiProvider || data.capability?.provider || "unknown");
    const providerLabel = capabilityText(providerState);
    const chatState = String(data.capability?.chat || "configuration-required");
    const chatLabel = capabilityText(chatState);
    return `<section class="gha-app gha-ai" data-gha-root data-gha-view="ai">
      ${topbarMarkup("HH AI Copilot", "Trợ lý trung tâm và lối vào công cụ AI của HH", "ai", data)}
      ${sidebarMarkup("ai")}
      <main class="gha-stage">
        <section class="gha-ai-world gha-copilot" aria-labelledby="gha-ai-title">
          <div class="gha-map__stars" aria-hidden="true"></div><div class="gha-ai-world__nebula" aria-hidden="true"></div>
          <header class="gha-copilot__head"><div><h1 id="gha-ai-title">HH AI COPILOT</h1><span>TRỢ LÝ AI TOÀN NĂNG</span></div><div><i data-state="${escapeHtml(chatState)}"><b></b>${escapeHtml(chatLabel)}</i></div></header>
          <div class="gha-copilot__layout">
            <section class="gha-copilot__hero">
              <div class="gha-copilot-orbit-stage"><button class="gha-ai-core gha-copilot-orb" type="button" data-gha-route="/chat-ai" aria-label="Mở HH AI Copilot"><span aria-hidden="true"><i></i><i></i></span><strong>HH</strong><small>AI COPILOT</small></button></div>
              <div class="gha-copilot__intro"><h2>Tôi có thể giúp gì cho bạn?</h2><p>Trợ lý AI toàn năng của HH — hỗ trợ hỏi đáp, lập kế hoạch và mở đúng công cụ bạn cần.</p></div>
              <div class="gha-ai-destinations gha-copilot-actions" role="navigation" aria-label="Công cụ AI">${AI_DESTINATIONS.map((destination) => `<button type="button" data-gha-route="${destination.route}" data-gha-searchable><span aria-hidden="true">${iconMarkup(destination.icon)}</span><strong>${escapeHtml(destination.label)}</strong><small>${escapeHtml(destination.description)}</small></button>`).join("")}</div>
              <form class="gha-copilot-prompt" data-gha-ai-form autocomplete="off">
                <div class="gha-copilot-prompt__entry"><label class="gha-sr-only" for="gha-copilot-prompt-input">Nhập yêu cầu cho HH AI Copilot</label><input id="gha-copilot-prompt-input" data-gha-ai-input type="text" maxlength="1600" placeholder="Nhập yêu cầu của bạn..." aria-describedby="gha-copilot-prompt-hint gha-ai-attachment-status"><button type="submit" data-gha-ai-submit aria-label="Gửi yêu cầu và tài liệu đã chọn tới HH AI Copilot">${iconMarkup("send")}</button></div>
                <div class="gha-ai-attachment-toolbar"><label class="gha-ai-attachment-button">${iconMarkup("clip")}<span>Đính kèm văn bản</span><input class="gha-sr-only" data-gha-ai-attachment-input type="file" accept="${AI_ATTACHMENT_CONFIG.accept}" multiple></label><small id="gha-copilot-prompt-hint">TXT, Markdown hoặc JSON · tối đa 3 tệp · 128 KB/tệp</small></div>
                <div class="gha-ai-attachment-list" data-gha-ai-attachment-list aria-label="Tệp đang chờ gửi" hidden></div>
                <p class="gha-ai-attachment-status" id="gha-ai-attachment-status" data-gha-ai-attachment-status data-state="idle" role="status" aria-live="polite">Nội dung tệp chỉ được đọc khi bạn bấm Gửi.</p>
              </form>
              <div class="gha-copilot-chips" aria-label="Gợi ý nhanh"><span>Gợi ý nhanh</span><button type="button" data-gha-route="/work/projects-tasks">Lập kế hoạch từ dự án</button><button type="button" data-gha-route="/create/prompt-studio">Thiết kế prompt</button><button type="button" data-gha-route="/galaxy/tools">Tìm công cụ phù hợp</button></div>
            </section>
            <aside class="gha-copilot__rail">
              <section><header><div><span>MODULE</span><h2>Copilot có thể mở</h2></div><i data-state="${escapeHtml(providerState)}">Provider: ${escapeHtml(providerLabel)}</i></header><div class="gha-copilot-modules">${copilotModuleMarkup("layers", "Notes Galaxy", "Ghi chú và ý tưởng", "/home/dashboard", data.evidence.notes ? "ready" : "unknown", data.evidence.notes ? "Có dữ liệu" : "Chưa có dữ liệu")}${copilotModuleMarkup("music", "Music Planet", "Nhạc và âm thanh", "/galaxy/music", "unknown", "Mở module")}${copilotModuleMarkup("folder", "Projects Hub", "Dự án và tiến độ", "/work/projects-tasks", data.evidence.projects ? "ready" : "unknown", data.evidence.projects ? "Có dữ liệu" : "Chưa có dữ liệu")}${copilotModuleMarkup("globe", "Weather Star", "Thời tiết đã lưu", "/home/dashboard", data.evidence.weather ? "ready" : "unknown", data.evidence.weather ? "Có dữ liệu" : "Chưa có dữ liệu")}${copilotModuleMarkup("tools", "Creator Tools", "Công cụ sáng tạo", "/galaxy/creator", "unknown", "Mở module")}</div></section>
              <section><header><div><span>LOCAL-FIRST</span><h2>Gợi ý từ dữ liệu của bạn</h2></div></header>${copilotInsightMarkup(data)}</section>
            </aside>
          </div>
          <footer class="gha-ai-world__facts"><span><b>Điều hướng</b> Route nội bộ</span><span><b>Dữ liệu</b> Local/API được cấp</span><span><b>Chat engine</b> ${escapeHtml(chatLabel)}</span><span><b>Provider</b> ${escapeHtml(providerLabel)}</span></footer>
        </section>
      </main>
    </section>`;
  }

  function chatMarkup() {
    return `<section class="gha-app gha-chat" data-gha-root data-gha-view="chat">
      <header class="gha-chat__bar"><a class="gha-brand" href="#/home" data-gha-route="/home"><span aria-hidden="true">HH</span><b>HOANG8.COM</b></a><div><span>AI UNIVERSE</span><strong>HH AI Copilot</strong></div><nav aria-label="Công cụ AI liên quan"><button type="button" data-gha-route="/create/ai-center">AI Universe</button><button type="button" data-gha-route="/create/prompt-studio">Prompt Studio</button><button type="button" data-gha-route="/create/ai-script">Kịch bản</button></nav><i data-gha-engine-state data-state="loading">Đang gắn engine</i></header>
      <main class="gha-chat__stage"><div class="gha-chat__aurora" aria-hidden="true"></div><div class="gha-chat__engine" data-gha-chat-engine aria-live="off"></div><section class="gha-chat__missing" data-gha-chat-missing hidden role="status"><span>AI</span><h1>Chat AI chưa được tải</h1><p>Adapter Galaxy không tạo cuộc trò chuyện giả. Hãy tải engine Chat AI hiện có rồi thử lại.</p><button type="button" data-gha-action="retry-chat">Thử gắn lại</button></section></main>
    </section>`;
  }

  function viewMarkup(route, data) {
    if (route === "/home") return homeMarkup(data);
    if (route === "/home/dashboard") return dashboardMarkup(data);
    if (route === "/create/ai-center") return aiMarkup(data);
    return chatMarkup();
  }

  function currentRouteFromLocation() {
    return normalizeRoute(globalScope.location?.hash || "/home");
  }

  function navigate(runtime, route) {
    const destination = normalizeRoute(route);
    if (typeof runtime.options.navigate === "function") {
      runtime.options.navigate(destination);
      return;
    }
    if (globalScope.location) globalScope.location.hash = `#${destination}`;
  }

  function notifyGateway(runtime, message, state = "notice") {
    const notice = runtime.host.querySelector?.("[data-gha-gateway-notice]");
    if (!notice) return;
    notice.textContent = String(message || "HH Core là cổng duy nhất để mở lớp chức năng HH Platform.");
    notice.dataset.state = state;
    notice.classList?.remove?.("is-pulsing");
    void notice.offsetWidth;
    notice.classList?.add?.("is-pulsing");
  }

  function enterCore(runtime, destination = CORE_ENTRY_ROUTE) {
    let entered = false;
    try {
      entered = typeof runtime.options.enterCore === "function"
        ? runtime.options.enterCore({ source: "hh-core", route: destination }) !== false
        : false;
    } catch {
      entered = false;
    }
    if (!entered) {
      notifyGateway(runtime, "Không thể mở HH Core trong phiên này. Hãy tải lại trang và thử lại.", "error");
      return false;
    }
    runtime.state.lastAction = "enter-core";
    navigate(runtime, destination);
    return true;
  }

  function readHomePrefs(storage) {
    const value = readRecord(storage, HOME_PREF_KEY).value;
    return { version: 1, zoom: clamp(value?.zoom || 1, 0.72, 1.45) };
  }

  function applyMapZoom(runtime) {
    const map = runtime.host.querySelector("[data-gha-map]");
    if (!map) return;
    map.style.setProperty("--gha-map-scale", String(runtime.preferences.zoom));
    const output = map.querySelector("[data-gha-zoom]");
    if (output) output.textContent = `${Math.round(runtime.preferences.zoom * 100)}%`;
  }

  function updateNetwork(runtime) {
    const online = typeof globalScope.navigator?.onLine === "boolean" ? globalScope.navigator.onLine : null;
    runtime.state.online = online;
    runtime.host.querySelectorAll("[data-gha-network]").forEach((node) => { node.textContent = online == null ? "Không hỗ trợ" : online ? "Đang trực tuyến" : "Ngoại tuyến"; node.dataset.state = online == null ? "unknown" : online ? "ready" : "offline"; });
    runtime.host.querySelectorAll("[data-gha-network-detail]").forEach((node) => { node.textContent = online == null ? "Không hỗ trợ" : online ? "Trực tuyến" : "Ngoại tuyến"; node.dataset.state = online == null ? "unknown" : online ? "ready" : "offline"; });
    runtime.host.querySelectorAll("[data-gha-network-copy]").forEach((node) => {
      node.textContent = online == null ? "Không đọc được trạng thái kết nối" : online ? "Kết nối trình duyệt đang hoạt động" : "Nội dung cục bộ vẫn khả dụng";
    });
  }

  function updateClock(runtime) {
    const now = new Date();
    runtime.host.querySelectorAll("[data-gha-clock]").forEach((node) => { node.textContent = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }); });
    runtime.host.querySelectorAll("[data-gha-date]").forEach((node) => { node.textContent = now.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }); });
  }

  function readFocus(storage) {
    const record = readRecord(storage, FOCUS_KEY).value;
    const durationSeconds = clamp(record?.durationSeconds || 1500, 60, 7200);
    return {
      version: 1,
      durationSeconds,
      remainingSeconds: clamp(record?.remainingSeconds ?? durationSeconds, 0, durationSeconds),
      running: Boolean(record?.running),
      startedAt: Number(record?.startedAt) || 0,
      completed: clamp(record?.completed || 0, 0, 100000)
    };
  }

  function focusSnapshot(runtime, now = Date.now()) {
    const focus = runtime.focus;
    if (!focus.running || !focus.startedAt) return focus;
    const elapsed = Math.max(0, Math.floor((now - focus.startedAt) / 1000));
    if (elapsed < focus.remainingSeconds) return { ...focus, remainingSeconds: focus.remainingSeconds - elapsed, startedAt: now };
    return { ...focus, remainingSeconds: focus.durationSeconds, running: false, startedAt: 0, completed: focus.completed + 1 };
  }

  function persistFocus(runtime) {
    writeRecord(runtime.storage, FOCUS_KEY, runtime.focus);
  }

  function updateFocus(runtime) {
    if (runtime.route !== "/home/dashboard") return;
    const next = focusSnapshot(runtime);
    if (next !== runtime.focus) {
      runtime.focus = next;
      persistFocus(runtime);
    }
    const minutes = Math.floor(runtime.focus.remainingSeconds / 60);
    const seconds = runtime.focus.remainingSeconds % 60;
    const time = runtime.host.querySelector("[data-gha-focus-time]");
    const state = runtime.host.querySelector("[data-gha-focus-state]");
    const count = runtime.host.querySelector("[data-gha-focus-count]");
    const metric = runtime.host.querySelector("[data-gha-focus-metric]");
    const toggle = runtime.host.querySelector('[data-gha-action="focus-toggle"]');
    if (time) time.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    if (state) state.textContent = runtime.focus.running ? "Đang tập trung" : "Sẵn sàng";
    if (count) count.textContent = `${runtime.focus.completed} phiên hoàn thành`;
    if (metric) metric.textContent = String(runtime.focus.completed);
    if (toggle) toggle.textContent = runtime.focus.running ? "Tạm dừng" : "Bắt đầu";
  }

  async function updateStorageEstimate(runtime) {
    const stateNode = runtime.host.querySelector("[data-gha-storage-state]");
    const valueNode = runtime.host.querySelector("[data-gha-storage-value]");
    const detailNode = runtime.host.querySelector("[data-gha-storage-detail]");
    const barNode = runtime.host.querySelector("[data-gha-storage-bar]");
    if (!stateNode || !valueNode) return;
    const metricNode = stateNode.closest?.(".gha-home-stat");
    if (typeof globalScope.navigator?.storage?.estimate !== "function") {
      stateNode.dataset.state = "unsupported";
      stateNode.textContent = "Không hỗ trợ";
      if (metricNode) metricNode.dataset.state = "unsupported";
      valueNode.textContent = "Storage API không khả dụng";
      if (detailNode) detailNode.textContent = "Trình duyệt này không cung cấp phép đo dung lượng website.";
      return;
    }
    try {
      const estimate = await globalScope.navigator.storage.estimate();
      if (runtime !== activeRuntime || runtime.controller.signal.aborted) return;
      const usage = Number(estimate.usage);
      const quota = Number(estimate.quota);
      if (!Number.isFinite(usage) || !Number.isFinite(quota) || quota <= 0) throw new Error("STORAGE_ESTIMATE_INVALID");
      const formatter = new Intl.NumberFormat("vi-VN", { style: "unit", unit: "megabyte", maximumFractionDigits: 1 });
      const usedMb = usage / 1048576;
      const quotaMb = quota / 1048576;
      stateNode.dataset.state = "ready";
      stateNode.textContent = "Storage API";
      if (metricNode) metricNode.dataset.state = "ready";
      valueNode.textContent = `${formatter.format(usedMb)} / ${formatter.format(quotaMb)}`;
      if (detailNode) detailNode.textContent = `${(usage / quota * 100).toFixed(1)}% quota dành cho website đã dùng.`;
      if (barNode) barNode.style.setProperty("--usage", `${clamp(usage / quota * 100, 0, 100)}%`);
      runtime.state.storage = { supported: true, usage, quota };
    } catch {
      stateNode.dataset.state = "error";
      stateNode.textContent = "Không đọc được";
      if (metricNode) metricNode.dataset.state = "error";
      valueNode.textContent = "Không có số liệu dung lượng";
      if (detailNode) detailNode.textContent = "Không thay thế bằng số liệu giả.";
      runtime.state.storage = { supported: false };
    }
  }

  function toggleTask(runtime, rawIndex, completed) {
    const record = readRecord(runtime.storage, TASK_KEY);
    if (!record.found || !Array.isArray(record.value)) return false;
    const index = Number(rawIndex);
    if (!Number.isInteger(index) || index < 0 || index >= record.value.length || !isObject(record.value[index])) return false;
    const task = record.value[index];
    record.value[index] = Object.prototype.hasOwnProperty.call(task, "completed") ? { ...task, completed } : { ...task, done: completed };
    if (!writeRecord(runtime.storage, TASK_KEY, record.value)) return false;
    const local = collectLocalData(runtime.storage, globalScope);
    runtime.data = mergeData(local, runtime.options.data);
    const metric = runtime.host.querySelector?.("[data-gha-task-metric] strong");
    if (metric) {
      const total = asArray(runtime.data.tasks).length;
      const done = asArray(runtime.data.tasks).filter((item) => item.completed).length;
      metric.textContent = `${done}/${total}`;
    }
    runtime.state.lastAction = "task-updated";
    try { globalScope.dispatchEvent?.(new globalScope.CustomEvent("hh:command-center-sync", { detail: { source: "galaxy-dashboard", taskIndex: index } })); } catch { /* Event APIs may be unavailable. */ }
    return true;
  }

  function saveNote(runtime) {
    const textarea = runtime.host.querySelector("[data-gha-note]");
    const status = runtime.host.querySelector("[data-gha-note-status]");
    const text = String(textarea?.value || "").trim().slice(0, 4000);
    const record = readRecord(runtime.storage, NOTE_KEY);
    const notes = Array.isArray(record.value) ? record.value.slice(0, 100) : [];
    const firstPinned = notes.findIndex((note) => isObject(note) && note.pinned);
    const index = firstPinned >= 0 ? firstPinned : notes.length ? 0 : -1;
    if (index >= 0) notes[index] = { ...notes[index], text, updatedAt: Date.now() };
    else notes.push({ id: `galaxy-note-${Date.now()}`, text, pinned: true, color: "#9b7cff", updatedAt: Date.now() });
    const saved = writeRecord(runtime.storage, NOTE_KEY, notes);
    if (status) { status.textContent = saved ? "Đã lưu trên thiết bị" : "Không thể ghi dữ liệu trên thiết bị"; status.dataset.state = saved ? "ready" : "error"; }
    runtime.state.lastAction = saved ? "note-saved" : "note-error";
    if (saved) {
      try { globalScope.dispatchEvent?.(new globalScope.CustomEvent("hh:command-center-sync", { detail: { source: "galaxy-dashboard", kind: "note" } })); } catch { /* Event APIs may be unavailable. */ }
    }
    return saved;
  }

  async function toggleFullscreen(runtime) {
    const target = runtime.host.querySelector("[data-gha-map]") || runtime.host;
    try {
      if (globalScope.document?.fullscreenElement) await globalScope.document.exitFullscreen?.();
      else if (typeof target.requestFullscreen === "function") await target.requestFullscreen();
      else runtime.state.fullscreen = "unsupported";
    } catch {
      runtime.state.fullscreen = "error";
    }
  }

  function updateFullscreenState(runtime) {
    const active = Boolean(globalScope.document?.fullscreenElement);
    runtime.state.fullscreen = active ? "active" : "inactive";
    runtime.host.querySelectorAll('[data-gha-action="fullscreen"]').forEach((button) => {
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute("aria-label", active ? "Thoát chế độ toàn màn hình" : "Bật chế độ toàn màn hình");
    });
  }

  function moduleSkeletonMarkup(route) {
    const kind = route === "/home" ? "home" : route === "/home/dashboard" ? "dashboard" : "ai";
    const label = kind === "home" ? "Đang tải Command Center" : kind === "dashboard" ? "Đang tải Dashboard" : "Đang tải AI Universe";
    const blocks = kind === "home" ? 7 : kind === "dashboard" ? 8 : 6;
    return `<section class="gha-module-skeleton gha-module-skeleton--${kind}" data-gha-module-skeleton aria-label="${label}" aria-busy="true"><span class="gha-sr-only">${label}</span><div class="gha-module-skeleton__hero"><i></i><i></i><i></i></div><div class="gha-module-skeleton__grid">${Array.from({ length: blocks }, (_, index) => `<article style="--skeleton-index:${index}"><i></i><b></b><span></span><span></span></article>`).join("")}</div></section>`;
  }

  function installModuleSkeleton(runtime) {
    if (runtime.state.dataState !== "loading" || runtime.route === "/chat-ai" || runtime.route.startsWith("/chat-ai/")) return;
    const stage = runtime.host.querySelector?.(".gha-stage");
    if (!stage || stage.querySelector?.("[data-gha-module-skeleton]")) return;
    stage.setAttribute?.("aria-busy", "true");
    stage.insertAdjacentHTML?.("afterbegin", moduleSkeletonMarkup(runtime.route));
  }

  function applyAdaptiveExperience(runtime) {
    const adaptive = resolveAdaptiveExperience(runtime.storage, globalScope, {
      effects: runtime.options.effects,
      reducedMotion: runtime.options.reducedMotion
    });
    runtime.adaptive = adaptive;
    runtime.host.dataset.ghaDeviceTier = adaptive.deviceTier;
    runtime.host.dataset.ghaMotion = adaptive.motion;
    runtime.host.dataset.ghaRequestedEffects = adaptive.requestedEffects;
    runtime.host.dataset.ghaReducedMotion = String(adaptive.reduced);
    runtime.host.querySelectorAll?.("[data-gha-root]").forEach((node) => {
      node.dataset.ghaMotion = adaptive.motion;
      node.dataset.ghaDeviceTier = adaptive.deviceTier;
    });
  }

  function setAttachmentStatus(runtime, message, state = "idle") {
    const node = runtime.host.querySelector?.("[data-gha-ai-attachment-status]");
    if (node) {
      node.textContent = String(message || "");
      node.dataset.state = state;
    }
    runtime.state.attachmentStatus = state;
  }

  function renderPendingAttachments(runtime) {
    const container = runtime.host.querySelector?.("[data-gha-ai-attachment-list]");
    if (!container) return;
    const document = container.ownerDocument || globalScope.document;
    container.replaceChildren?.();
    const pending = asArray(runtime.pendingAttachments);
    pending.forEach((attachment) => {
      const chip = document?.createElement?.("span");
      const name = document?.createElement?.("b");
      const size = document?.createElement?.("small");
      const remove = document?.createElement?.("button");
      if (!chip || !name || !size || !remove) return;
      chip.className = "gha-ai-attachment-chip";
      name.textContent = attachment.name;
      size.textContent = `${Math.max(1, Math.ceil(attachment.size / 1024))} KB`;
      remove.type = "button";
      remove.dataset.ghaAttachmentRemove = attachment.id;
      remove.setAttribute("aria-label", `Bỏ tệp ${attachment.name}`);
      remove.textContent = "×";
      chip.append(name, size, remove);
      container.append(chip);
    });
    container.hidden = pending.length === 0;
    if (pending.length) setAttachmentStatus(runtime, `${pending.length} tệp đã chọn. Nội dung chỉ được đọc khi bạn bấm Gửi.`, "ready");
    else setAttachmentStatus(runtime, "Nội dung tệp chỉ được đọc khi bạn bấm Gửi.", "idle");
  }

  function selectAttachments(runtime, fileList) {
    const pending = asArray(runtime.pendingAttachments).slice();
    const messages = [];
    Array.from(fileList || []).forEach((file) => {
      const validation = validateAttachmentMetadata(file, pending);
      if (!validation.valid) { messages.push(validation.reason); return; }
      if (pending.some((item) => item.name === validation.value.name && item.size === validation.value.size)) {
        messages.push(`${validation.value.name} đã được chọn.`);
        return;
      }
      pending.push({ id: makeAttachmentId(), file, ...validation.value });
    });
    runtime.pendingAttachments = pending;
    renderPendingAttachments(runtime);
    if (messages.length) setAttachmentStatus(runtime, messages.join(" "), "error");
    runtime.state.lastAction = pending.length ? "ai-attachments-selected" : "ai-attachments-empty";
    return messages.length === 0;
  }

  function removePendingAttachment(runtime, id) {
    const before = asArray(runtime.pendingAttachments).length;
    runtime.pendingAttachments = asArray(runtime.pendingAttachments).filter((item) => item.id !== String(id || ""));
    renderPendingAttachments(runtime);
    runtime.state.lastAction = before === runtime.pendingAttachments.length ? "ai-attachment-not-found" : "ai-attachment-removed";
  }

  async function submitHomePrompt(runtime, form) {
    const input = form?.querySelector?.("[data-gha-ai-input]");
    const prompt = String(input?.value || "").trim().slice(0, 1600);
    if (!prompt) {
      input?.focus?.();
      input?.setAttribute?.("aria-invalid", "true");
      return false;
    }
    if (runtime.aiHandoffPending) return false;
    input.removeAttribute?.("aria-invalid");
    const submit = form?.querySelector?.("[data-gha-ai-submit], button[type='submit']");
    const selectedFiles = asArray(runtime.pendingAttachments).map((item) => item.file).filter(Boolean);
    runtime.aiHandoffPending = true;
    if (submit) { submit.disabled = true; submit.setAttribute?.("aria-busy", "true"); }
    let records = [];
    let persistence = { mode: "none", saved: 0 };
    try {
      if (selectedFiles.length) {
        setAttachmentStatus(runtime, "Đang đọc và kiểm tra tệp văn bản…", "loading");
        records = await readSelectedAttachments(selectedFiles, { signal: runtime.controller.signal });
        persistence = await persistAttachmentRecords(records, globalScope);
        runtime.state.attachmentStorage = persistence.mode;
        runtime.state.error = null;
        setAttachmentStatus(runtime, persistence.mode === "indexeddb"
          ? "Đã kiểm tra và lưu văn bản an toàn trong IndexedDB."
          : "IndexedDB không khả dụng; văn bản chỉ được giữ tạm trong phiên này.", persistence.mode === "indexeddb" ? "ready" : "fallback");
      }
    } catch (error) {
      if (error?.code !== "ATTACHMENT_ABORTED") setAttachmentStatus(runtime, String(error?.message || "Không thể đọc tệp đính kèm."), "error");
      runtime.state.lastAction = "ai-attachment-rejected";
      runtime.state.error = String(error?.code || error?.message || "ATTACHMENT_FAILED");
      return false;
    } finally {
      runtime.aiHandoffPending = false;
      if (submit) { submit.disabled = false; submit.removeAttribute?.("aria-busy"); }
    }
    if (runtime.controller.signal.aborted) return false;
    const composedPrompt = composeAIHandoffPrompt(prompt, records);
    const payload = {
      prompt: composedPrompt,
      at: Date.now(),
      source: "galaxy-home",
      layer: "galaxy",
      attachments: records.map((record) => ({ id: record.id, name: record.name, mimeType: record.mimeType, size: record.size })),
      attachmentStorage: persistence.mode
    };
    let handoffStored = false;
    try { handoffStored = storeAiHandoff(globalScope.sessionStorage, payload); }
    catch { handoffStored = false; }
    if (!handoffStored) {
      runtime.state.lastAction = "galaxy-ai-handoff-storage-error";
      runtime.state.error = "AI_HANDOFF_STORAGE_UNAVAILABLE";
      setAttachmentStatus(runtime, "Không thể chuyển yêu cầu an toàn sang AI Universe. Nội dung vẫn được giữ trên màn hình này.", "error");
      return false;
    }
    runtime.state.lastAction = "galaxy-ai-handoff";
    runtime.pendingAttachments = [];
    navigate(runtime, "/galaxy/ai");
    return true;
  }

  function setEngineState(runtime, state, label) {
    const node = runtime.host.querySelector("[data-gha-engine-state]");
    if (node) { node.dataset.state = state; node.textContent = label; }
    const missing = runtime.host.querySelector("[data-gha-chat-missing]");
    const engine = runtime.host.querySelector("[data-gha-chat-engine]");
    if (missing) missing.hidden = state === "ready" || state === "loading";
    if (engine) engine.hidden = state === "error" || state === "configuration-required";
    runtime.state.baseMounted = state === "ready";
    runtime.state.capability = state;
  }

  async function mountChatEngine(runtime) {
    if (runtime.route !== "/chat-ai" && !runtime.route.startsWith("/chat-ai/")) return;
    if (runtime.chatMountPromise) return runtime.chatMountPromise;
    const engineHost = runtime.host.querySelector("[data-gha-chat-engine]");
    const baseMount = runtime.options.baseMount;
    if (!engineHost || typeof baseMount !== "function") {
      setEngineState(runtime, "configuration-required", "Engine chưa được cấp");
      return;
    }
    const promise = (async () => {
      setEngineState(runtime, "loading", "Đang gắn engine");
      try {
        const result = await baseMount(engineHost, { ...runtime.options.baseOptions, route: runtime.route, newSession: runtime.route.endsWith("/new") });
        if (runtime !== activeRuntime || runtime.controller.signal.aborted) {
          result?.unmount?.();
          return;
        }
        if (result === false) throw new Error("CHAT_ENGINE_REJECTED");
        runtime.baseController = result && typeof result === "object" ? result : null;
        setEngineState(runtime, "ready", "Engine hiện có");
      } catch (error) {
        if (runtime !== activeRuntime || runtime.controller.signal.aborted) return;
        runtime.state.error = String(error?.message || "CHAT_ENGINE_MOUNT_FAILED");
        setEngineState(runtime, "error", "Không thể gắn engine");
      }
    })();
    runtime.chatMountPromise = promise;
    const clearFlight = () => {
      if (runtime.chatMountPromise === promise) runtime.chatMountPromise = null;
    };
    promise.then(clearFlight, clearFlight);
    return promise;
  }

  function handleClick(runtime, event) {
    const attachmentRemove = event.target.closest?.("[data-gha-attachment-remove]");
    if (attachmentRemove) {
      event.preventDefault?.();
      removePendingAttachment(runtime, attachmentRemove.dataset.ghaAttachmentRemove);
      return;
    }
    const routeButton = event.target.closest?.("[data-gha-route]");
    if (routeButton) {
      event.preventDefault();
      if (runtime.route === "/home") {
        if (routeButton.dataset.ghaEntry === "hh-core") enterCore(runtime, routeButton.dataset.ghaRoute || CORE_ENTRY_ROUTE);
        else if (globalScope.HHCoreGateway?.isGalaxyRoute?.(routeButton.dataset.ghaRoute)
          || HOME_NAV_ITEMS.some((item) => item.route === routeButton.dataset.ghaRoute)) navigate(runtime, routeButton.dataset.ghaRoute);
        else notifyGateway(runtime, "Điểm đến này thuộc HH Core Platform. Chỉ nút HH CORE được phép mở lớp 2.", "blocked");
        return;
      }
      navigate(runtime, routeButton.dataset.ghaRoute);
      return;
    }
    const action = event.target.closest?.("[data-gha-action]")?.dataset.ghaAction;
    if (!action) return;
    if (action === "zoom-in" || action === "zoom-out") {
      runtime.preferences.zoom = clamp(runtime.preferences.zoom + (action === "zoom-in" ? 0.1 : -0.1), 0.72, 1.45);
      writeRecord(runtime.storage, HOME_PREF_KEY, runtime.preferences);
      applyMapZoom(runtime);
    } else if (action === "reset-view") {
      runtime.preferences.zoom = 1;
      writeRecord(runtime.storage, HOME_PREF_KEY, runtime.preferences);
      applyMapZoom(runtime);
    } else if (action === "fullscreen") toggleFullscreen(runtime);
    else if (action === "focus-toggle") {
      runtime.focus = focusSnapshot(runtime);
      runtime.focus.running = !runtime.focus.running;
      runtime.focus.startedAt = runtime.focus.running ? Date.now() : 0;
      persistFocus(runtime);
      updateFocus(runtime);
    } else if (action === "focus-reset") {
      runtime.focus = { ...runtime.focus, remainingSeconds: runtime.focus.durationSeconds, running: false, startedAt: 0 };
      persistFocus(runtime);
      updateFocus(runtime);
    } else if (action === "save-note") saveNote(runtime);
    else if (action === "retry-chat") mountChatEngine(runtime);
  }

  function handleChange(runtime, event) {
    if (event.target.matches?.("[data-gha-ai-attachment-input]")) {
      selectAttachments(runtime, event.target.files);
      try { event.target.value = ""; } catch { /* Some test doubles expose a read-only value. */ }
      return;
    }
    if (event.target.matches?.("[data-gha-task]")) toggleTask(runtime, event.target.dataset.ghaTask, Boolean(event.target.checked));
  }

  function handleInput(runtime, event) {
    if (event.target.matches?.("[data-gha-ai-input]")) {
      event.target.removeAttribute?.("aria-invalid");
      return;
    }
    if (!event.target.matches?.("[data-gha-search]")) return;
    const query = event.target.value.trim().toLocaleLowerCase("vi");
    let matches = 0;
    const nodes = runtime.host.querySelectorAll("[data-gha-searchable], .gha-ai-destinations [data-gha-route]");
    nodes.forEach((node) => {
      const visible = !query || node.textContent.toLocaleLowerCase("vi").includes(query);
      node.hidden = !visible;
      if (visible) matches += 1;
    });
    const empty = runtime.host.querySelector("[data-gha-search-empty]");
    if (empty) empty.hidden = !query || matches > 0;
  }

  function handleKeydown(runtime, event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase("vi") === "k") {
      event.preventDefault();
      runtime.host.querySelector("[data-gha-search]")?.focus();
      return;
    }
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !/input|textarea|select/i.test(event.target.tagName)) {
      event.preventDefault();
      runtime.host.querySelector(runtime.route === "/home" ? "[data-gha-ai-input]" : "[data-gha-search]")?.focus();
      return;
    }
    const planet = event.target.closest?.("[data-gha-planet]");
    if (!planet || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    const planets = [...runtime.host.querySelectorAll("[data-gha-planet]:not([hidden])")];
    const current = planets.indexOf(planet);
    if (current < 0) return;
    event.preventDefault();
    const delta = ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1;
    planets[(current + delta + planets.length) % planets.length]?.focus();
  }

  async function handleSubmit(runtime, event) {
    const form = event.target.closest?.("[data-gha-ai-form]");
    if (!form) return;
    event.preventDefault();
    return submitHomePrompt(runtime, form);
  }

  /* The host is also observed by the outer Galaxy shell. Attach a small,
     route-local listener to controls that do not carry a navigation target so
     shell delegation cannot swallow map actions or the AI handoff submit. The
     AbortSignal keeps these listeners disposable on every route transition. */
  function bindHomeControls(runtime) {
    if (runtime.route !== "/home") return;
    const signal = runtime.controller.signal;
    runtime.host.querySelectorAll?.("[data-gha-action]").forEach((button) => {
      const onAction = (event) => {
        const action = button.dataset?.ghaAction || "";
        event.stopPropagation?.();
        event.preventDefault?.();
        if (action === "zoom-in" || action === "zoom-out") {
          runtime.preferences.zoom = clamp(runtime.preferences.zoom + (action === "zoom-in" ? 0.1 : -0.1), 0.72, 1.45);
          writeRecord(runtime.storage, HOME_PREF_KEY, runtime.preferences);
          applyMapZoom(runtime);
          runtime.state.lastAction = action;
          return;
        }
        if (action === "reset-view") {
          runtime.preferences.zoom = 1;
          writeRecord(runtime.storage, HOME_PREF_KEY, runtime.preferences);
          applyMapZoom(runtime);
          runtime.state.lastAction = action;
          return;
        }
        handleClick(runtime, event);
      };
      /* Use a direct handler as well as delegation: the surrounding shell can
         re-render or intercept bubbling events while the map remains mounted. */
      button.onclick = onAction;
    });
    runtime.host.querySelectorAll?.("[data-gha-ai-form]").forEach((form) => {
      form.addEventListener?.("submit", (event) => {
        event.preventDefault?.();
        event.stopPropagation?.();
        void handleSubmit(runtime, event);
      }, { signal });
    });
  }

  function bindRuntime(runtime) {
    const signal = runtime.controller.signal;
    runtime.host.addEventListener("click", (event) => handleClick(runtime, event), { signal });
    runtime.host.addEventListener("change", (event) => handleChange(runtime, event), { signal });
    runtime.host.addEventListener("input", (event) => handleInput(runtime, event), { signal });
    runtime.host.addEventListener("keydown", (event) => handleKeydown(runtime, event), { signal });
    runtime.host.addEventListener("submit", (event) => handleSubmit(runtime, event), { signal });
    globalScope.addEventListener?.("online", () => updateNetwork(runtime), { signal });
    globalScope.addEventListener?.("offline", () => updateNetwork(runtime), { signal });
    globalScope.addEventListener?.("storage", (event) => {
      if (event?.key && event.key !== LAYER_ONE_STORAGE_KEY) return;
      applyAdaptiveExperience(runtime);
      if (runtime.route === "/home") {
        runtime.data = mergeData(collectGalaxyLocalData(runtime.storage, globalScope), runtime.options.data);
        refreshView(runtime);
      }
    }, { signal });
    try {
      const motionQuery = globalScope.matchMedia?.("(prefers-reduced-motion: reduce)");
      if (motionQuery?.addEventListener) motionQuery.addEventListener("change", () => applyAdaptiveExperience(runtime), { signal });
    } catch { /* Older browsers keep the mount-time preference. */ }
    globalScope.document?.addEventListener?.("fullscreenchange", () => updateFullscreenState(runtime), { signal });
    globalScope.document?.addEventListener?.("visibilitychange", () => {
      runtime.state.paused = Boolean(globalScope.document.hidden);
      runtime.host.setAttribute?.("data-gha-paused", String(runtime.state.paused));
      updateFocus(runtime);
    }, { signal });
  }

  function refreshView(runtime) {
    runtime.host.innerHTML = viewMarkup(runtime.route, runtime.data);
    runtime.host.dataset.ghaHomeAiHost = "";
    runtime.host.dataset.ghaRoute = runtime.route;
    runtime.host.dataset.ghaDataState = runtime.state.dataState;
    bindHomeControls(runtime);
    installModuleSkeleton(runtime);
    applyAdaptiveExperience(runtime);
    renderPendingAttachments(runtime);
    applyMapZoom(runtime);
    updateNetwork(runtime);
    updateClock(runtime);
    updateFocus(runtime);
    updateFullscreenState(runtime);
    if (runtime.route === "/home" || runtime.route === "/home/dashboard") updateStorageEstimate(runtime);
  }

  async function loadPassedData(runtime) {
    const loader = runtime.options.loadData || runtime.options.dataProvider;
    if (typeof loader !== "function") return;
    runtime.state.dataState = "loading";
    try {
      const provided = await loader({ route: runtime.route, signal: runtime.controller.signal, local: runtime.data });
      if (runtime !== activeRuntime || runtime.controller.signal.aborted) return;
      const local = runtime.route === "/home" ? collectGalaxyLocalData(runtime.storage, globalScope) : collectLocalData(runtime.storage, globalScope);
      runtime.data = mergeData(local, provided);
      runtime.options.data = provided;
      runtime.state.dataState = "ready";
      if (runtime.route === "/chat-ai" || runtime.route.startsWith("/chat-ai/")) return;
      refreshView(runtime);
    } catch (error) {
      if (runtime.controller.signal.aborted) return;
      runtime.state.dataState = "error";
      runtime.state.error = String(error?.message || "DATA_PROVIDER_FAILED");
      if (runtime.route !== "/chat-ai" && !runtime.route.startsWith("/chat-ai/")) refreshView(runtime);
    }
  }

  function mount(host, options = {}) {
    if (!host || typeof host.querySelector !== "function") return false;
    const route = normalizeRoute(options.route || currentRouteFromLocation());
    if (!canHandle(route)) return false;
    unmount();
    const storage = options.storage || globalScope.localStorage;
    const local = route === "/home" ? collectGalaxyLocalData(storage, globalScope) : collectLocalData(storage, globalScope);
    const runtime = {
      host,
      route,
      options,
      storage,
      data: mergeData(local, options.data),
      preferences: readHomePrefs(storage),
      focus: readFocus(storage),
      controller: new AbortController(),
      baseController: null,
      pendingAttachments: [],
      aiHandoffPending: false,
      adaptive: null,
      clockTimer: 0,
      focusTimer: 0,
      state: { mounted: true, route, view: route === "/home" ? "home" : route === "/home/dashboard" ? "dashboard" : route === "/create/ai-center" ? "ai" : "chat", paused: Boolean(globalScope.document?.hidden), online: null, baseMounted: false, capability: "ready", dataState: options.loadData || options.dataProvider ? "loading" : "ready", storage: null, attachmentStorage: null, attachmentStatus: "idle", error: null, lastAction: null }
    };
    activeRuntime = runtime;
    refreshView(runtime);
    bindRuntime(runtime);
    runtime.clockTimer = globalScope.setInterval?.(() => updateClock(runtime), 30000) || 0;
    runtime.focusTimer = globalScope.setInterval?.(() => updateFocus(runtime), 1000) || 0;
    if (route === "/chat-ai" || route.startsWith("/chat-ai/")) mountChatEngine(runtime);
    loadPassedData(runtime);
    return true;
  }

  function unmount(host) {
    const runtime = activeRuntime;
    if (!runtime || (host && host !== runtime.host)) return false;
    runtime.controller.abort();
    if (runtime.clockTimer) globalScope.clearInterval?.(runtime.clockTimer);
    if (runtime.focusTimer) globalScope.clearInterval?.(runtime.focusTimer);
    runtime.baseController?.unmount?.();
    runtime.baseController?.destroy?.();
    if (typeof runtime.options.baseUnmount === "function") {
      try { runtime.options.baseUnmount(runtime.host.querySelector?.("[data-gha-chat-engine]")); } catch { /* Base cleanup is best-effort. */ }
    }
    runtime.host.removeAttribute?.("data-gha-home-ai-host");
    runtime.host.removeAttribute?.("data-gha-route");
    runtime.host.removeAttribute?.("data-gha-data-state");
    runtime.host.removeAttribute?.("data-gha-device-tier");
    runtime.host.removeAttribute?.("data-gha-motion");
    runtime.host.removeAttribute?.("data-gha-requested-effects");
    runtime.host.removeAttribute?.("data-gha-reduced-motion");
    runtime.pendingAttachments = [];
    runtime.state.mounted = false;
    if (activeRuntime === runtime) activeRuntime = null;
    return true;
  }

  function getState() {
    if (!activeRuntime) return { mounted: false, route: null, view: null, capability: "idle", dataState: "idle", baseMounted: false, paused: false, online: null, error: null };
    const state = activeRuntime.state;
    return {
      mounted: state.mounted,
      route: state.route,
      view: state.view,
      capability: state.capability,
      dataState: state.dataState,
      baseMounted: state.baseMounted,
      paused: state.paused,
      online: state.online,
      storageSupported: state.storage?.supported ?? null,
      attachmentStorage: state.attachmentStorage,
      attachmentStatus: state.attachmentStatus,
      deviceTier: activeRuntime.adaptive?.deviceTier || null,
      motion: activeRuntime.adaptive?.motion || null,
      lastAction: state.lastAction,
      error: state.error
    };
  }

  return Object.freeze({
    VERSION,
    ROUTES,
    PLANETS,
    HOME_NAV_ITEMS,
    AI_DESTINATIONS,
    GALAXY_DATA_KEYS,
    HOME_PREF_KEY,
    FOCUS_KEY,
    TASK_KEY,
    NOTE_KEY,
    LAYER_ONE_STORAGE_KEY,
    CORE_ENTRY_ROUTE,
    AI_ATTACHMENT_CONFIG,
    normalizeRoute,
    canHandle,
    collectLocalData,
    collectGalaxyLocalData,
    mergeData,
    validateAttachmentMetadata,
    containsPotentialSecret,
    sanitizeAttachmentText,
    readSelectedAttachments,
    composeAIHandoffPrompt,
    storeAiHandoff,
    persistAttachmentRecords,
    resolveAdaptiveExperience,
    moduleSkeletonMarkup,
    viewMarkup,
    mount,
    unmount,
    getState
  });
});
