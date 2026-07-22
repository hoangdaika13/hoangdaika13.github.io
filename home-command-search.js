(function homeCommandSearchBootstrap(globalScope, factory) {
  "use strict";

  const api = factory(globalScope || globalThis);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope) globalScope.HHHomeCommandSearch = api;
  if (globalScope && globalScope.document) api.autoMount();
})(typeof globalThis !== "undefined" ? globalThis : this, function createHomeCommandSearch(globalScope) {
  "use strict";

  const VERSION = 2;
  const STORAGE_KEY = "hh.home-command-search.v2";
  const TODO_KEY = "hh.command-center.todos.v2";
  const NOTE_KEY = "hh.dashboard.sticky-notes.v1";
  const MAX_RESULTS = 60;
  const MAX_SOURCE_ITEMS = 120;
  const SENSITIVE_FIELDS = /password|passcode|secret|token|api.?key|authorization|credential|cookie/i;
  const mounted = new WeakMap();

  const ROUTES = Object.freeze([
    ["Trang chủ", "/home", "Điều hành", "home dashboard command center hôm nay"],
    ["AI Center", "/create/ai-center", "Sáng tạo", "ai chat prompt model"],
    ["Kịch bản AI", "/create/ai-script", "Sáng tạo", "script kịch bản viết nội dung"],
    ["Creator Studio", "/create/creator-studio", "Sáng tạo", "content thumbnail seo"],
    ["Media Center", "/create/media-center", "Sáng tạo", "media video audio library"],
    ["Music Production Studio", "/music-ai/studio", "Âm nhạc", "music nhạc daw composer mix master"],
    ["Photo Editor", "/media-design/photo-editor", "Media & Design", "photoshop ảnh layer mask"],
    ["Video Editor", "/media-design/video-editor", "Media & Design", "davinci premiere video timeline"],
    ["Media & Design", "/media-design", "Media & Design", "ảnh video pdf qr color typography"],
    ["Thiết kế đồ họa", "/graphic-design", "Thiết kế", "vector motion character 3d prototype"],
    ["DEV Command Center", "/dev-tools", "DEV", "developer json api regex database code git"],
    ["Project Center", "/work/project-center", "Công việc", "project task kanban roadmap timeline"],
    ["Cloud Storage", "/work/cloud-storage", "Công việc", "file folder upload storage"],
    ["Download Center", "/work/download-center", "Công việc", "download media social queue"],
    ["Knowledge Center", "/work/knowledge-center", "Công việc", "wiki article markdown knowledge"],
    ["Team Collaboration", "/work/team-collaboration", "Công việc", "team board member task comment"],
    ["Giao tiếp", "/communication", "Giao tiếp", "communication overview inbox community"],
    ["Community", "/communication/community", "Giao tiếp", "community social post member"],
    ["Unified Inbox", "/communication/unified-inbox", "Giao tiếp", "message mention ticket unread"],
    ["Messenger Pro", "/communication/messenger", "Giao tiếp", "chat dm group room"],
    ["Learning Home", "/learn/home", "Học tập", "learning lesson review mastery"],
    ["HH English", "/english", "Học tập", "english a0 c2 vocabulary speaking"],
    ["Analytics", "/analytics", "Phân tích", "traffic insight report"],
    ["Security Center", "/analytics/security-center", "Hệ thống", "security session device audit"],
    ["Cài đặt", "/settings", "Hệ thống", "settings profile theme privacy"],
    ["Ủng hộ nhà phát triển", "/support", "Hệ thống", "support donate vietqr"]
  ]);

  const COMMANDS = Object.freeze([
    { id: "command:create-todo", title: "Tạo công việc", description: "Thêm nhanh một việc vào Todo Workspace.", category: "Lệnh", source: "command", aliases: ["todo", "task", "việc mới", "add task"], action: "create-todo" },
    { id: "command:create-note", title: "Tạo ghi chú", description: "Thêm Sticky Note mới trên Trang chủ.", category: "Lệnh", source: "command", aliases: ["note", "ghi chú", "sticky", "add note"], action: "create-note" },
    { id: "command:continue", title: "Tiếp tục công việc gần nhất", description: "Mở lại module được sử dụng gần đây nhất.", category: "Lệnh", source: "command", aliases: ["continue", "resume", "gần đây"], action: "continue-recent" },
    { id: "command:focus-todo", title: "Mở Todo hôm nay", description: "Đi tới widget Todo trên Command Center.", category: "Lệnh", source: "command", aliases: ["today", "todo hôm nay"], action: "cc:focus:todo" },
    { id: "command:focus-notes", title: "Mở Sticky Notes", description: "Đi tới khu vực ghi chú trên Command Center.", category: "Lệnh", source: "command", aliases: ["notes", "sticky notes"], action: "cc:focus:notes" }
  ]);

  const SOURCE_ADAPTERS = Object.freeze([
    { key: "hh-project-center", category: "Dự án", source: "project", route: "/work/project-center", arrays: ["projects", "tasks", "milestones", "bugs"] },
    { key: NOTE_KEY, category: "Ghi chú", source: "notes", route: "/home", arrays: [""] },
    { key: "hh-chat-notes", category: "Ghi chú", source: "notes", route: "/communication/messenger", arrays: [""] },
    { key: "hh.command-center.files.v1", category: "Tệp & Media", source: "files", route: "/home", arrays: [""] },
    { key: "hh-work-center-files-v1", category: "Tệp & Media", source: "files", route: "/work/cloud-storage", arrays: [""] },
    { key: "hh-download-history", category: "Tệp & Media", source: "files", route: "/work/download-center", arrays: [""] },
    { key: "hh.learning.os.v1", category: "Học tập", source: "learning", route: "/learn/home", arrays: ["lessons", "assignments", "skills", "reviews", "history"] },
    { key: "hh.english.state.v1", category: "Học tập", source: "learning", route: "/english", arrays: ["lessons", "reviews", "history", "vocabulary"] },
    { key: "hh.communication.command.v1", category: "Giao tiếp", source: "community", route: "/communication/unified-inbox", arrays: ["items", "conversations", "notices"] },
    { key: "hh.communication.messenger.v1", category: "Giao tiếp", source: "community", route: "/communication/messenger", arrays: ["rooms"], nestedArrays: ["members"] }
  ]);

  const ALIAS_MAP = Object.freeze({
    ps: "photo editor", photoshop: "photo editor", pr: "video editor", premiere: "video editor",
    resolve: "video editor", yt: "youtube", music: "music production studio", nhac: "music production studio",
    dev: "dev command center", code: "dev command center", wiki: "knowledge center", chat: "messenger pro",
    inbox: "unified inbox", hoc: "learning home", english: "hh english", home: "trang chu"
  });

  function normalizeText(value) {
    return String(value == null ? "" : value)
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
      .toLocaleLowerCase("vi").replace(/[^a-z0-9\s._:/-]/g, " ").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function readJson(storage, key, fallback) {
    try {
      const raw = storage && storage.getItem ? storage.getItem(key) : null;
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) { return fallback; }
  }

  function writeJson(storage, key, value) {
    try { storage && storage.setItem && storage.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { return false; }
  }

  function cleanDate(value) {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toISOString() : "";
  }

  function makeSearchItem(input) {
    const item = input && typeof input === "object" ? input : {};
    const title = String(item.title || item.name || item.label || "Mục chưa đặt tên").slice(0, 180);
    const description = String(item.description || item.detail || item.preview || item.text || item.content || "").replace(/\s+/g, " ").trim().slice(0, 280);
    const route = String(item.route || "").startsWith("/") ? String(item.route) : "";
    const aliases = Array.isArray(item.aliases) ? item.aliases.map(String).slice(0, 16) : [];
    const id = String(item.id || `${item.source || "item"}:${normalizeText(title).replace(/\s+/g, "-")}`).slice(0, 220);
    const searchText = normalizeText([title, description, item.category, item.source, route, item.key, ...aliases].join(" "));
    return {
      id, title, description, route,
      category: String(item.category || "Khác").slice(0, 60),
      source: String(item.source || "local").slice(0, 60),
      sourceLabel: String(item.sourceLabel || item.source || "Thiết bị này").slice(0, 80),
      date: cleanDate(item.date || item.updatedAt || item.createdAt || item.timestamp || item.savedAt),
      action: String(item.action || ""), aliases, searchText,
      meta: item.meta && typeof item.meta === "object" ? item.meta : {}
    };
  }

  function routeItems() {
    return ROUTES.map(([title, route, category, aliases]) => makeSearchItem({
      id: `route:${route}`, title, route, category, source: "navigation", sourceLabel: "Điều hướng HH",
      description: `Mở ${title} trong HH Platform.`, aliases: String(aliases).split(" ")
    }));
  }

  function valueAtPath(value, path) {
    if (!path) return Array.isArray(value) ? value : [];
    return path.split(".").reduce((current, part) => current && current[part], value);
  }

  function recordText(record) {
    if (!record || typeof record !== "object") return "";
    const fields = ["title", "name", "label", "filename", "fileName", "text", "preview", "description", "content", "body", "term"];
    return fields.map((key) => SENSITIVE_FIELDS.test(key) ? "" : record[key]).find((value) => typeof value === "string" && value.trim()) || "";
  }

  function extractAdapterItems(storage, adapter) {
    const value = readJson(storage, adapter.key, null);
    if (value == null) return [];
    const rows = adapter.arrays.flatMap((path) => {
      const candidate = valueAtPath(value, path);
      return Array.isArray(candidate) ? candidate : [];
    }).slice(0, MAX_SOURCE_ITEMS);
    return rows.flatMap((record, index) => {
      if (typeof record === "string") return makeSearchItem({
        id: `${adapter.key}:${index}`, title: record.slice(0, 100), description: record,
        category: adapter.category, source: adapter.source, sourceLabel: "Dữ liệu trên thiết bị", route: adapter.route
      });
      if (!record || typeof record !== "object") return [];
      const title = recordText(record);
      const detail = [record.description, record.preview, record.status, record.priority, record.category, record.type]
        .filter((entry) => typeof entry === "string" && entry !== title).join(" · ");
      const primary = title ? [makeSearchItem({
        id: `${adapter.key}:${record.id || index}`, title, description: detail,
        category: adapter.category, source: adapter.source, sourceLabel: "Dữ liệu trên thiết bị", route: record.route || adapter.route,
        date: record.updatedAt || record.createdAt || record.timestamp || record.savedAt || record.due,
        aliases: Array.isArray(record.tags) ? record.tags : [], meta: { localKey: adapter.key, recordId: record.id || "" }
      })] : [];
      const nested = (adapter.nestedArrays || []).flatMap((field) => Array.isArray(record[field]) ? record[field] : []).slice(0, 80).map((nestedRecord, nestedIndex) => {
        const nestedTitle = recordText(nestedRecord);
        if (!nestedTitle) return null;
        return makeSearchItem({
          id: `${adapter.key}:${record.id || index}:${nestedRecord.id || nestedIndex}`,
          title: nestedTitle,
          description: `${title ? `${title} · ` : ""}${nestedRecord.role || "Thành viên"}`,
          category: "Thành viên", source: adapter.source, sourceLabel: "Danh bạ cộng đồng",
          route: adapter.route, date: record.lastActive || record.updatedAt,
          meta: { localKey: adapter.key, recordId: nestedRecord.id || "", parentId: record.id || "" }
        });
      }).filter(Boolean);
      return [...primary, ...nested];
    }).filter(Boolean);
  }

  function moduleItems(scope) {
    const modules = Array.isArray(scope && scope.HH_PLATFORM_MODULES) ? scope.HH_PLATFORM_MODULES : [];
    return modules.slice(0, 160).map((module) => makeSearchItem({
      id: `module:${module.id || module.title}`, title: module.title || module.name || module.id,
      description: module.description || (module.features || []).join(" · "), category: module.group || "Công cụ",
      source: "module", sourceLabel: "Thư viện module", route: module.route || "",
      aliases: [module.id, ...(Array.isArray(module.features) ? module.features : [])]
    }));
  }

  function domRouteItems(documentRef) {
    if (!documentRef || !documentRef.querySelectorAll) return [];
    const seen = new Set();
    return Array.from(documentRef.querySelectorAll("[data-app-route]")).map((node) => {
      const route = node.dataset && node.dataset.appRoute;
      if (!route || seen.has(route)) return null;
      seen.add(route);
      const title = (node.getAttribute("aria-label") || node.textContent || route).replace(/\s+/g, " ").trim();
      return makeSearchItem({ id: `dom:${route}`, title, route, category: "Điều hướng", source: "navigation", sourceLabel: "Giao diện hiện tại" });
    }).filter(Boolean);
  }

  function commandCenterItems(scope) {
    let values = [];
    try { values = scope && scope.HHCommandCenter && scope.HHCommandCenter.searchItems ? scope.HHCommandCenter.searchItems() : []; }
    catch (_) { values = []; }
    return (Array.isArray(values) ? values : []).slice(0, 80).map((item, index) => makeSearchItem({
      ...item, id: `cc:${item.action || item.route || index}`, category: item.type || "Command Center",
      source: "command-center", sourceLabel: "Command Center"
    }));
  }

  function recentModuleItems(storage, index) {
    const recent = readJson(storage, "hh.app-shell.recent", []);
    if (!Array.isArray(recent)) return [];
    const byToken = new Map();
    index.forEach((item) => {
      [item.id, item.route, item.meta && item.meta.moduleId].filter(Boolean).forEach((key) => byToken.set(String(key).replace(/^module:/, ""), item));
      const routePart = item.route.split("/").filter(Boolean).at(-1);
      if (routePart) byToken.set(routePart, item);
    });
    return recent.map((token, position) => {
      const found = byToken.get(String(token));
      return found ? { ...found, id: `recent:${found.id}`, category: "Gần đây", source: "recent", sourceLabel: "Lịch sử sử dụng", meta: { ...found.meta, recentRank: position } } : null;
    }).filter(Boolean);
  }

  function dedupe(items) {
    const output = [];
    const keys = new Set();
    items.forEach((raw) => {
      const item = makeSearchItem(raw);
      const key = `${item.route}|${normalizeText(item.title)}|${item.action}`;
      if (!item.title || keys.has(key)) return;
      keys.add(key); output.push(item);
    });
    return output;
  }

  function buildIndex(options = {}) {
    const scope = options.scope || globalScope;
    const documentRef = options.document || (scope && scope.document);
    const storage = options.storage || (scope && scope.localStorage);
    const base = dedupe([
      ...COMMANDS.map(makeSearchItem), ...routeItems(), ...moduleItems(scope),
      ...domRouteItems(documentRef), ...commandCenterItems(scope),
      ...SOURCE_ADAPTERS.flatMap((adapter) => extractAdapterItems(storage, adapter))
    ]);
    return dedupe([...recentModuleItems(storage, base), ...base]);
  }

  function expandQuery(query) {
    const normalized = normalizeText(query);
    const expanded = ALIAS_MAP[normalized] || normalized.split(" ").map((token) => ALIAS_MAP[token] || token).join(" ");
    return { normalized, expanded, tokens: expanded.split(" ").filter(Boolean) };
  }

  function dateMatches(dateValue, dateFilter, now = Date.now()) {
    if (!dateFilter || dateFilter === "any") return true;
    if (!dateValue) return false;
    const stamp = new Date(dateValue).getTime();
    if (!Number.isFinite(stamp)) return false;
    const age = Math.max(0, now - stamp);
    if (dateFilter === "today") return new Date(stamp).toDateString() === new Date(now).toDateString();
    if (dateFilter === "week") return age <= 7 * 86400000;
    if (dateFilter === "month") return age <= 31 * 86400000;
    return true;
  }

  function scoreItem(item, queryInfo, state) {
    const usage = Number(state.usage && state.usage[item.id]) || 0;
    const historyIndex = (state.history || []).findIndex((entry) => entry.id === item.id);
    let score = Math.min(usage, 20) * 2 + (historyIndex >= 0 ? Math.max(0, 16 - historyIndex) : 0);
    if (!queryInfo.tokens.length) return score + (item.source === "recent" ? 28 : item.source === "command" ? 12 : 0);
    if (normalizeText(item.title) === queryInfo.expanded) score += 130;
    else if (normalizeText(item.title).startsWith(queryInfo.expanded)) score += 90;
    else if (item.searchText.includes(queryInfo.expanded)) score += 55;
    queryInfo.tokens.forEach((token) => {
      if (normalizeText(item.title).includes(token)) score += 24;
      else if (item.searchText.includes(token)) score += 9;
    });
    return score;
  }

  function searchIndex(index, query = "", filters = {}, state = {}, now = Date.now()) {
    const queryInfo = expandQuery(query);
    const category = filters.category || "all";
    const source = filters.source || "all";
    const date = filters.date || "any";
    const mode = filters.mode || "all";
    return index.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (source !== "all" && item.source !== source) return false;
      if (!dateMatches(item.date, date, now)) return false;
      if (mode === "recent" && !(state.history || []).some((entry) => entry.id === item.id) && item.source !== "recent") return false;
      if (mode === "used" && !(Number(state.usage && state.usage[item.id]) > 0)) return false;
      return !queryInfo.tokens.length || queryInfo.tokens.every((token) => item.searchText.includes(token));
    }).map((item) => ({ ...item, score: scoreItem(item, queryInfo, state) }))
      .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title, "vi"))
      .slice(0, MAX_RESULTS);
  }

  function defaultState(storage) {
    const value = readJson(storage, STORAGE_KEY, {});
    return {
      history: Array.isArray(value.history) ? value.history.slice(0, 30) : [],
      queries: Array.isArray(value.queries) ? value.queries.slice(0, 20) : [],
      usage: value.usage && typeof value.usage === "object" ? value.usage : {},
      filters: value.filters && typeof value.filters === "object" ? value.filters : { category: "all", source: "all", date: "any", mode: "all" }
    };
  }

  function rememberExecution(storage, state, item, query) {
    const entry = { id: item.id, title: item.title, route: item.route, action: item.action, at: new Date().toISOString() };
    state.history = [entry, ...state.history.filter((row) => row.id !== item.id)].slice(0, 30);
    state.usage[item.id] = Math.min(9999, (Number(state.usage[item.id]) || 0) + 1);
    const cleanQuery = String(query || "").trim();
    if (cleanQuery) state.queries = [cleanQuery, ...state.queries.filter((row) => row !== cleanQuery)].slice(0, 20);
    writeJson(storage, STORAGE_KEY, state);
    return state;
  }

  function appendFallback(storage, key, item, limit) {
    const rows = readJson(storage, key, []);
    const next = Array.isArray(rows) ? rows : [];
    next.unshift(item);
    writeJson(storage, key, next.slice(0, limit));
  }

  function dispatchCancelable(scope, name, detail) {
    if (!scope || !scope.dispatchEvent || typeof scope.CustomEvent !== "function") return false;
    const event = new scope.CustomEvent(name, { detail, cancelable: true });
    scope.dispatchEvent(event);
    return event.defaultPrevented;
  }

  function createFallbackTodo(storage, title = "Công việc mới") {
    const item = { id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: String(title).slice(0, 180), priority: "medium", category: "Command", deadline: new Date().toISOString().slice(0, 10), reminder: "", repeat: "none", completed: false, reminded: false, createdAt: Date.now() };
    appendFallback(storage, TODO_KEY, item, 200);
    return item;
  }

  function createFallbackNote(storage, text = "Ghi chú mới") {
    const notes = readJson(storage, NOTE_KEY, []);
    const count = Array.isArray(notes) ? notes.length : 0;
    const item = { id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: String(text).slice(0, 1000), color: ["#fff17a", "#75f2d0", "#ff91d9", "#9cb8ff"][count % 4], x: 28 + (count * 31) % 360, y: 28 + (count * 29) % 130, rotate: 0, pinned: false, tags: "command-palette", reminder: "", preview: false, updatedAt: Date.now() };
    appendFallback(storage, NOTE_KEY, item, 30);
    return item;
  }

  function createController(options = {}) {
    const scope = options.scope || globalScope;
    const documentRef = options.document || scope.document;
    const storage = options.storage || scope.localStorage;
    const palette = options.palette || documentRef.getElementById("commandPalette");
    if (!palette) return null;
    const input = palette.querySelector("#commandPaletteInput");
    const resultsHost = palette.querySelector("#commandPaletteResults");
    const countNode = palette.querySelector("#commandPaletteCount");
    if (!input || !resultsHost) return null;

    const state = defaultState(storage);
    let index = [];
    let results = [];
    let selectedIndex = 0;
    let refreshTimer = 0;

    palette.classList.add("hcs-enhanced");
    palette.dataset.commandSearchVersion = String(VERSION);

    const filterBar = documentRef.createElement("div");
    filterBar.className = "hcs-filterbar";
    filterBar.setAttribute("aria-label", "Bộ lọc tìm kiếm");
    filterBar.innerHTML = `<div class="hcs-modes" role="tablist" aria-label="Chế độ kết quả"><button type="button" data-hcs-mode="all" role="tab">Tất cả</button><button type="button" data-hcs-mode="recent" role="tab">Gần đây</button><button type="button" data-hcs-mode="used" role="tab">Dùng nhiều</button></div><div class="hcs-filters"><label>Nhóm<select data-hcs-filter="category" aria-label="Lọc theo nhóm"><option value="all">Tất cả</option></select></label><label>Nguồn<select data-hcs-filter="source" aria-label="Lọc theo nguồn"><option value="all">Mọi nguồn</option></select></label><label>Thời gian<select data-hcs-filter="date" aria-label="Lọc theo thời gian"><option value="any">Mọi lúc</option><option value="today">Hôm nay</option><option value="week">7 ngày</option><option value="month">30 ngày</option></select></label></div>`;

    const body = documentRef.createElement("div");
    body.className = "hcs-body";
    const actionPanel = documentRef.createElement("aside");
    actionPanel.className = "hcs-action-panel";
    actionPanel.setAttribute("aria-label", "Hành động theo ngữ cảnh");
    actionPanel.setAttribute("aria-live", "polite");
    resultsHost.parentNode.insertBefore(filterBar, resultsHost);
    resultsHost.parentNode.insertBefore(body, resultsHost);
    body.append(resultsHost, actionPanel);

    function syncFilterOptions() {
      const categories = [...new Set(index.map((item) => item.category))].sort((a, b) => a.localeCompare(b, "vi"));
      const sources = [...new Set(index.map((item) => item.source))].sort((a, b) => a.localeCompare(b, "vi"));
      const category = filterBar.querySelector('[data-hcs-filter="category"]');
      const source = filterBar.querySelector('[data-hcs-filter="source"]');
      category.innerHTML = `<option value="all">Tất cả</option>${categories.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
      source.innerHTML = `<option value="all">Mọi nguồn</option>${sources.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
      state.filters.category = categories.includes(state.filters.category) ? state.filters.category : "all";
      state.filters.source = sources.includes(state.filters.source) ? state.filters.source : "all";
      state.filters.date = ["any", "today", "week", "month"].includes(state.filters.date) ? state.filters.date : "any";
      state.filters.mode = ["all", "recent", "used"].includes(state.filters.mode) ? state.filters.mode : "all";
      category.value = state.filters.category;
      source.value = state.filters.source;
      filterBar.querySelector('[data-hcs-filter="date"]').value = state.filters.date;
    }

    function renderActionPanel() {
      const item = results[selectedIndex];
      if (!item) {
        actionPanel.innerHTML = `<div class="hcs-action-empty"><i>⌕</i><strong>Không có hành động</strong><span>Thử từ khóa hoặc bộ lọc khác.</span></div>`;
        return;
      }
      const primary = item.action === "create-todo" ? "Tạo công việc" : item.action === "create-note" ? "Tạo ghi chú" : item.action === "continue-recent" ? "Tiếp tục" : "Mở";
      actionPanel.innerHTML = `<div class="hcs-action-icon">${escapeHtml(item.category.slice(0, 2).toUpperCase())}</div><small>${escapeHtml(item.category)} · ${escapeHtml(item.sourceLabel)}</small><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description || "Mở nội dung này trong HH Platform.")}</p><dl><div><dt>Nguồn</dt><dd>${escapeHtml(item.source)}</dd></div><div><dt>Đã dùng</dt><dd>${Number(state.usage[item.id]) || 0} lần</dd></div>${item.date ? `<div><dt>Cập nhật</dt><dd>${new Date(item.date).toLocaleDateString("vi-VN")}</dd></div>` : ""}</dl><div class="hcs-action-buttons"><button type="button" data-hcs-run="primary">${escapeHtml(primary)} <kbd>Enter</kbd></button>${item.route && item.route !== "/home" ? `<button type="button" data-hcs-run="home">Về Trang chủ</button>` : ""}</div>`;
    }

    function render() {
      results = searchIndex(index, input.value, state.filters, state);
      selectedIndex = Math.min(selectedIndex, Math.max(0, results.length - 1));
      if (countNode) countNode.textContent = `${results.length} kết quả · ${index.length} mục đã lập chỉ mục`;
      filterBar.querySelectorAll("[data-hcs-mode]").forEach((button) => {
        const active = button.dataset.hcsMode === (state.filters.mode || "all");
        button.classList.toggle("is-active", active); button.setAttribute("aria-selected", String(active));
      });
      resultsHost.innerHTML = results.length ? results.map((item, position) => `<button type="button" role="option" data-hh-search-id="${escapeHtml(item.id)}" aria-selected="${position === selectedIndex}" class="hcs-result ${position === selectedIndex ? "is-selected" : ""}"><span class="hcs-result-type">${escapeHtml(item.category)}</span><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.description || item.sourceLabel)}</small></div><em>${escapeHtml(item.source === "recent" ? "Gần đây" : item.sourceLabel)}</em><b>↵</b></button>`).join("") : `<div class="hcs-empty"><i>⌕</i><strong>Chưa tìm thấy kết quả</strong><p>Thử tên module, dự án, ghi chú, bài học hoặc một lệnh như “tạo công việc”.</p><button type="button" data-hcs-clear>Xóa bộ lọc</button></div>`;
      renderActionPanel();
    }

    function refresh() {
      index = buildIndex({ scope, document: documentRef, storage });
      syncFilterOptions(); render();
    }

    function select(position) {
      if (!results.length) return;
      selectedIndex = (position + results.length) % results.length;
      resultsHost.querySelectorAll("[data-hh-search-id]").forEach((node, indexValue) => {
        const active = indexValue === selectedIndex;
        node.classList.toggle("is-selected", active); node.setAttribute("aria-selected", String(active));
        if (active) node.scrollIntoView({ block: "nearest" });
      });
      renderActionPanel();
    }

    function close() {
      if (palette.open && typeof palette.close === "function") palette.close();
    }

    function navigate(route) {
      if (!route) return;
      const next = `#${route}`;
      if (scope.location.hash === next) scope.dispatchEvent(new scope.HashChangeEvent("hashchange"));
      else scope.location.hash = next;
    }

    async function execute(item = results[selectedIndex]) {
      if (!item) return false;
      rememberExecution(storage, state, item, input.value);
      const detail = { source: "command-palette-v2", item, query: input.value };
      if (dispatchCancelable(scope, "hh:command-search-execute", detail)) return true;
      close();
      if (item.action === "create-todo" || item.action === "create-note") {
        const kind = item.action === "create-todo" ? "todo" : "note";
        const handled = dispatchCancelable(scope, `hh:command-create-${kind}`, detail);
        if (!handled && scope.HHCommandCenter && typeof scope.HHCommandCenter.runAction === "function") {
          await Promise.resolve(scope.HHCommandCenter.runAction(kind === "todo" ? "cc:create-task" : "cc:add-note"));
        } else if (!handled) {
          kind === "todo" ? createFallbackTodo(storage) : createFallbackNote(storage);
          scope.dispatchEvent(new scope.CustomEvent("hh:command-center-sync", { detail }));
          navigate("/home");
        }
      } else if (item.action === "continue-recent") {
        const recent = index.find((entry) => entry.source === "recent" && entry.route);
        navigate(recent ? recent.route : "/home");
      } else if (item.action && item.action.startsWith("cc:")) {
        if (scope.HHCommandCenter && typeof scope.HHCommandCenter.runAction === "function") await Promise.resolve(scope.HHCommandCenter.runAction(item.action.slice(3)));
        else navigate("/home");
      } else if (item.action && scope.HHCommandCenter && typeof scope.HHCommandCenter.runAction === "function") {
        await Promise.resolve(scope.HHCommandCenter.runAction(item.action));
      } else if (item.route) navigate(item.route);
      scope.dispatchEvent(new scope.CustomEvent("hh:command-search-complete", { detail }));
      return true;
    }

    function setFilter(name, value) {
      state.filters[name] = value;
      writeJson(storage, STORAGE_KEY, state); selectedIndex = 0; render();
    }

    input.addEventListener("input", () => { selectedIndex = 0; render(); });
    filterBar.addEventListener("click", (event) => {
      const mode = event.target.closest("[data-hcs-mode]");
      if (mode) setFilter("mode", mode.dataset.hcsMode);
    });
    filterBar.addEventListener("change", (event) => {
      const filter = event.target.closest("[data-hcs-filter]");
      if (filter) setFilter(filter.dataset.hcsFilter, filter.value);
    });
    resultsHost.addEventListener("pointermove", (event) => {
      const option = event.target.closest("[data-hh-search-id]");
      if (option) select(results.findIndex((item) => item.id === option.dataset.hhSearchId));
    });
    resultsHost.addEventListener("click", (event) => {
      const clear = event.target.closest("[data-hcs-clear]");
      const option = event.target.closest("[data-hh-search-id]");
      if (!clear && !option) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (clear) {
        state.filters = { category: "all", source: "all", date: "any", mode: "all" };
        input.value = ""; syncFilterOptions(); render(); input.focus();
      } else execute(results.find((item) => item.id === option.dataset.hhSearchId));
    }, true);
    actionPanel.addEventListener("click", (event) => {
      const action = event.target.closest("[data-hcs-run]");
      if (!action) return;
      if (action.dataset.hcsRun === "home") { close(); navigate("/home"); }
      else execute();
    });

    const keyHandler = (event) => {
      if (!palette.open) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); close(); return; }
      if (!["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.key === "ArrowDown") select(selectedIndex + 1);
      else if (event.key === "ArrowUp") select(selectedIndex - 1);
      else execute();
    };
    documentRef.addEventListener("keydown", keyHandler, true);

    const observer = typeof scope.MutationObserver === "function" ? new scope.MutationObserver(() => {
      if (!palette.open) return;
      clearTimeout(refreshTimer); refreshTimer = setTimeout(refresh, 0);
    }) : null;
    observer && observer.observe(palette, { attributes: true, attributeFilter: ["open"] });

    const storageHandler = (event) => {
      if (event.key === STORAGE_KEY) return;
      if (SOURCE_ADAPTERS.some((adapter) => adapter.key === event.key) || event.key === "hh.app-shell.recent") refresh();
    };
    scope.addEventListener && scope.addEventListener("storage", storageHandler);
    const refreshHandler = () => refresh();
    scope.addEventListener && scope.addEventListener("hh:modules-ready", refreshHandler);
    scope.addEventListener && scope.addEventListener("hh:command-center-sync", refreshHandler);

    refresh();
    const controller = {
      version: VERSION, palette, refresh, render, execute, getIndex: () => index.slice(), getResults: () => results.slice(),
      destroy() {
        observer && observer.disconnect(); clearTimeout(refreshTimer);
        documentRef.removeEventListener("keydown", keyHandler, true);
        scope.removeEventListener && scope.removeEventListener("storage", storageHandler);
        scope.removeEventListener && scope.removeEventListener("hh:modules-ready", refreshHandler);
        scope.removeEventListener && scope.removeEventListener("hh:command-center-sync", refreshHandler);
        filterBar.remove(); actionPanel.remove();
        if (body.parentNode) body.parentNode.insertBefore(resultsHost, body);
        body.remove(); palette.classList.remove("hcs-enhanced"); delete palette.dataset.commandSearchVersion;
      }
    };
    mounted.set(palette, controller);
    return controller;
  }

  function mount(options = {}) {
    const scope = options.scope || globalScope;
    const documentRef = options.document || scope.document;
    const palette = options.palette || (documentRef && documentRef.getElementById("commandPalette"));
    if (!palette) return null;
    return mounted.get(palette) || createController({ ...options, scope, document: documentRef, palette });
  }

  function autoMount() {
    const documentRef = globalScope.document;
    const start = () => mount({ scope: globalScope, document: documentRef });
    if (documentRef.readyState === "loading") documentRef.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
  }

  return Object.freeze({
    VERSION, STORAGE_KEY, TODO_KEY, NOTE_KEY, ROUTES, COMMANDS, SOURCE_ADAPTERS, ALIAS_MAP,
    normalizeText, makeSearchItem, extractAdapterItems, buildIndex, expandQuery, dateMatches,
    searchIndex, defaultState, rememberExecution, createFallbackTodo, createFallbackNote,
    mount, autoMount
  });
});
