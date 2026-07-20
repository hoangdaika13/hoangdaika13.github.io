(function initHHP0Platform(global) {
  "use strict";

  const VERSION = "1.0.0";
  const STORAGE = Object.freeze({
    searchRecords: "hh-p0-search-records",
    recentSearches: "hh-p0-search-recent",
    savedSearches: "hh-p0-search-saved",
    widgetLayout: "hh-widgets-engine",
    widgetQueue: "hh-p0-widget-sync-queue"
  });
  const NOTIFICATION_FILTERS = Object.freeze([
    ["all", "Tất cả"],
    ["unread", "Chưa đọc"],
    ["project", "Dự án"],
    ["chat", "Chat"],
    ["ai", "AI"],
    ["system", "Hệ thống"]
  ]);
  const SEARCH_TYPES = Object.freeze(["all", "project", "chat", "wiki", "file", "media", "module", "setting"]);
  const MAX_RECENT_SEARCHES = 8;
  const MAX_SAVED_SEARCHES = 12;
  const MAX_QUEUE_ATTEMPTS = 8;
  const RETRY_BASE_MS = 15000;
  const roots = new Set();
  const widgetQueues = new WeakMap();
  let widgetSyncAdapter = null;
  let observer = null;

  const asArray = (value) => Array.isArray(value) ? value : [];
  const asText = (value) => value == null ? "" : String(value);
  const normalized = (value) => asText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const unique = (values) => [...new Set(values.filter(Boolean))];
  const nowISO = () => new Date().toISOString();
  const uid = () => global.crypto?.randomUUID?.() || `p0-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const escapeHTML = (value) => asText(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
  const safeParse = (value, fallback) => {
    try { return JSON.parse(value); } catch { return fallback; }
  };
  const safeHref = (value) => {
    const candidate = asText(value).trim();
    if (!candidate) return "";
    if (candidate.startsWith("#/") || candidate.startsWith("/")) return candidate;
    try {
      const url = new URL(candidate, global.location?.href || "https://hh.local/");
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  };
  const debounce = (callback, delay = 140) => {
    let timer = 0;
    return (...args) => {
      global.clearTimeout(timer);
      timer = global.setTimeout(() => callback(...args), delay);
    };
  };

  function readStorage(storage, key, fallback) {
    try { return safeParse(storage?.getItem?.(key) || "", fallback); } catch { return fallback; }
  }

  function writeStorage(storage, key, value) {
    try {
      storage?.setItem?.(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function getStorage() {
    try { return global.localStorage; } catch { return null; }
  }

  function actorFromStorage(storage = getStorage()) {
    const candidates = ["hh-current-user", "hh-auth-user", "hh-user", "hh-session-user"];
    let actor = {};
    for (const key of candidates) {
      const value = readStorage(storage, key, null);
      if (value && typeof value === "object") {
        actor = value.user && typeof value.user === "object" ? value.user : value;
        break;
      }
    }
    const workspaceIds = unique([
      ...asArray(actor.workspaceIds),
      ...asArray(actor.workspaces).map((item) => typeof item === "string" ? item : item?.id),
      actor.workspaceId
    ].map(asText));
    return {
      id: asText(actor.id || actor._id || actor.userId || actor.email || "anonymous"),
      role: asText(actor.role || "member").toLowerCase(),
      roles: unique([actor.role, ...asArray(actor.roles)].map((item) => asText(item).toLowerCase())),
      workspaceIds
    };
  }

  function canReadRecord(record, actor = actorFromStorage()) {
    if (!record || typeof record !== "object") return false;
    const policy = record.permissions || record.access || {};
    const visibility = asText(policy.visibility || record.visibility || "workspace").toLowerCase();
    const actorId = asText(actor.id);
    const roles = unique([actor.role, ...asArray(actor.roles)].map((item) => asText(item).toLowerCase()));
    const deniedUsers = asArray(policy.deniedUserIds || policy.deniedUsers).map(asText);
    if (actorId && deniedUsers.includes(actorId)) return false;

    const ownerId = asText(record.ownerId || policy.ownerId);
    if (actorId && ownerId === actorId) return true;
    if (visibility === "public") return true;

    const allowedUsers = asArray(policy.allowedUserIds || policy.users).map(asText);
    if (actorId && allowedUsers.includes(actorId)) return true;
    const allowedRoles = asArray(policy.allowedRoles || policy.roles).map((item) => asText(item).toLowerCase());
    if (allowedRoles.some((role) => roles.includes(role))) return true;
    if (visibility === "private" || visibility === "restricted") return false;

    const recordWorkspace = asText(record.workspaceId || policy.workspaceId);
    const allowedWorkspaces = asArray(policy.allowedWorkspaceIds || policy.workspaces).map(asText);
    const actorWorkspaces = asArray(actor.workspaceIds).map(asText);
    if (recordWorkspace) return actorWorkspaces.includes(recordWorkspace) || allowedWorkspaces.some((id) => actorWorkspaces.includes(id));
    if (allowedWorkspaces.length) return allowedWorkspaces.some((id) => actorWorkspaces.includes(id));

    // Existing local records have no policy metadata. They remain readable only on this device.
    return !record.permissions && !record.access;
  }

  function normalizeSearchRecord(record, index = 0) {
    if (!record || typeof record !== "object") return null;
    const type = normalized(record.type || record.kind || "module").replace(/\s+/g, "-");
    const title = asText(record.title || record.name).trim();
    if (!title) return null;
    const createdAt = asText(record.createdAt || record.updatedAt || record.date || "");
    return {
      ...record,
      id: asText(record.id || record._id || `${type}-${index}-${normalized(title).replace(/\s+/g, "-")}`),
      type,
      title,
      description: asText(record.description || record.summary || record.content || "").trim(),
      creator: asText(record.creator || record.createdBy?.name || record.author?.name || record.createdBy || record.author || "Không rõ"),
      creatorId: asText(record.creatorId || record.createdBy?.id || record.author?.id || ""),
      workspace: asText(record.workspace || record.workspaceName || record.workspaceId || "Cá nhân"),
      workspaceId: asText(record.workspaceId || ""),
      createdAt,
      source: asText(record.source || record.sourceLabel || type),
      href: safeHref(record.href || record.url || record.route || ""),
      permissions: record.permissions || record.access || null,
      searchText: normalized([title, record.description, record.summary, record.content, record.creator, record.workspace, record.tags?.join?.(" ")].join(" "))
    };
  }

  function isWithinDate(record, dateFilter, currentDate = new Date()) {
    if (!dateFilter || dateFilter === "all") return true;
    const timestamp = Date.parse(record.createdAt);
    if (!Number.isFinite(timestamp)) return false;
    const age = currentDate.getTime() - timestamp;
    const limits = { today: 86400000, week: 604800000, month: 2592000000, year: 31536000000 };
    return age >= 0 && age <= (limits[dateFilter] || Number.POSITIVE_INFINITY);
  }

  function filterSearchRecords(records, options = {}, actor = actorFromStorage()) {
    const query = normalized(options.query || "");
    const terms = query.split(/\s+/).filter(Boolean);
    return asArray(records)
      .map(normalizeSearchRecord)
      .filter(Boolean)
      .filter((record) => canReadRecord(record, actor))
      .filter((record) => !options.type || options.type === "all" || record.type === options.type)
      .filter((record) => !options.creator || options.creator === "all" || normalized(record.creator) === normalized(options.creator))
      .filter((record) => !options.workspace || options.workspace === "all" || normalized(record.workspace) === normalized(options.workspace) || record.workspaceId === options.workspace)
      .filter((record) => isWithinDate(record, options.date || "all"))
      .filter((record) => terms.every((term) => record.searchText.includes(term)))
      .sort((a, b) => {
        if (options.sort === "date") return (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0);
        if (options.sort === "name") return a.title.localeCompare(b.title, "vi");
        return Number(b.pinned || false) - Number(a.pinned || false);
      });
  }

  function collectSearchRecords(panel, storage = getStorage()) {
    const records = [
      ...asArray(global.HH_P0_SEARCH_RECORDS),
      ...asArray(readStorage(storage, STORAGE.searchRecords, []))
    ];
    panel?.querySelectorAll?.("[data-smart-item]").forEach((node) => {
      const parsed = safeParse(node.dataset.smartItem || "", null);
      if (parsed) records.push(parsed);
    });
    panel?.ownerDocument?.querySelectorAll?.("[data-module-id]").forEach((node) => {
      const title = node.querySelector("h3,h4,h5,strong")?.textContent?.trim();
      if (title) records.push({
        id: node.dataset.moduleId,
        type: "module",
        title,
        description: node.querySelector("p")?.textContent?.trim() || "Module HH Platform",
        workspace: "HH Platform",
        source: "Module local",
        href: `#/${node.dataset.moduleId}`
      });
    });
    const seen = new Set();
    return records.map(normalizeSearchRecord).filter((record) => record && !seen.has(record.id) && seen.add(record.id));
  }

  function createSyncQueue(storage, key = STORAGE.widgetQueue) {
    const read = () => asArray(readStorage(storage, key, [])).filter((job) => job && job.id);
    const write = (jobs) => writeStorage(storage, key, jobs);
    return {
      list: read,
      enqueue(type, payload) {
        const jobs = read();
        const existing = jobs.find((job) => job.type === type && job.state !== "syncing");
        const next = {
          id: existing?.id || uid(),
          type,
          payload,
          state: "pending",
          attempts: existing?.attempts || 0,
          createdAt: existing?.createdAt || nowISO(),
          updatedAt: nowISO(),
          retryAt: 0,
          lastError: ""
        };
        const output = existing ? jobs.map((job) => job.id === existing.id ? next : job) : [...jobs, next];
        write(output);
        return next;
      },
      async flush(adapter, online = true) {
        const jobs = read();
        if (!online) return { status: "offline", pending: jobs.length, synced: 0 };
        if (typeof adapter !== "function") return { status: "adapter-required", pending: jobs.length, synced: 0 };
        let synced = 0;
        const output = [];
        for (const job of jobs) {
          if ((job.retryAt || 0) > Date.now()) { output.push(job); continue; }
          try {
            const response = await adapter({ ...job, state: "syncing" });
            if (response === true || response?.ok === true || response?.acknowledged === true) {
              synced += 1;
              continue;
            }
            throw new Error(response?.error || "Adapter chưa xác nhận đồng bộ");
          } catch (error) {
            const attempts = Math.min(MAX_QUEUE_ATTEMPTS, Number(job.attempts || 0) + 1);
            output.push({
              ...job,
              state: "pending",
              attempts,
              updatedAt: nowISO(),
              retryAt: Date.now() + Math.min(300000, RETRY_BASE_MS * (2 ** Math.max(0, attempts - 1))),
              lastError: asText(error?.message || error)
            });
          }
        }
        write(output);
        return { status: output.length ? "pending" : "synced", pending: output.length, synced };
      },
      clear() { write([]); }
    };
  }

  function validateLayoutDocument(documentValue) {
    if (!documentValue || typeof documentValue !== "object") throw new Error("Tệp layout không hợp lệ.");
    if (Number(documentValue.schemaVersion) !== 1) throw new Error("Phiên bản layout chưa được hỗ trợ.");
    if (!documentValue.layout || typeof documentValue.layout !== "object" || Array.isArray(documentValue.layout)) throw new Error("Layout phải là một object.");
    return {
      schemaVersion: 1,
      exportedAt: asText(documentValue.exportedAt || nowISO()),
      layout: documentValue.layout
    };
  }

  function createStateNode(owner, className) {
    const node = owner.ownerDocument.createElement("div");
    node.className = className;
    node.setAttribute("role", "status");
    node.setAttribute("aria-live", "polite");
    return node;
  }

  function setState(node, state, message) {
    if (!node) return;
    node.dataset.state = state;
    node.innerHTML = state === "loading"
      ? `<span class="p0-spinner" aria-hidden="true"></span><span>${escapeHTML(message)}</span>`
      : `<span>${escapeHTML(message)}</span>`;
    node.hidden = !message;
  }

  function inferNotificationType(item) {
    const explicit = normalized(item.dataset.notificationCategory || item.dataset.notificationType || "");
    if (["project", "chat", "ai", "system"].includes(explicit)) return explicit;
    const text = normalized(item.textContent);
    if (/chat|tin nhan|messenger|channel|community/.test(text)) return "chat";
    if (/ai|gemini|prompt|model|automation/.test(text)) return "ai";
    if (/project|du an|task|deadline|roadmap|team/.test(text)) return "project";
    return "system";
  }

  function enhanceNotifications(panel) {
    if (!panel || panel.dataset.p0Notification === "ready") return;
    panel.dataset.p0Notification = "ready";
    const navigation = panel.querySelector(".notification-nav") || panel.querySelector("aside");
    const list = panel.querySelector("[data-notification-list]");
    if (!navigation || !list) return;

    const toolbar = panel.ownerDocument.createElement("section");
    toolbar.className = "p0-notification-toolbar";
    toolbar.setAttribute("aria-label", "Lọc thông báo");
    toolbar.innerHTML = `
      <header><strong>Ưu tiên</strong><span data-p0-notification-summary></span></header>
      <div role="group">${NOTIFICATION_FILTERS.map(([id, label], index) => `
        <button type="button" data-p0-notification-filter="${id}" aria-pressed="${index === 0}">
          <span>${label}</span><b data-p0-notification-count="${id}">0</b>
        </button>`).join("")}</div>`;
    navigation.prepend(toolbar);
    const status = createStateNode(panel, "p0-notification-state");
    list.before(status);
    setState(status, "loading", "Đang phân loại thông báo…");

    const applyFilter = (filter = "all") => {
      const items = [...list.querySelectorAll("[data-notification-item]")];
      const counts = { all: items.length, unread: 0, project: 0, chat: 0, ai: 0, system: 0 };
      let visible = 0;
      items.forEach((item) => {
        const category = inferNotificationType(item);
        item.dataset.notificationCategory = category;
        const unread = !item.classList.contains("read") && item.dataset.read !== "true";
        counts[category] += 1;
        if (unread) counts.unread += 1;
        const show = filter === "all" || (filter === "unread" ? unread : category === filter);
        item.hidden = !show;
        if (show) visible += 1;
      });
      toolbar.querySelectorAll("[data-p0-notification-count]").forEach((node) => {
        node.textContent = counts[node.dataset.p0NotificationCount] || 0;
      });
      toolbar.querySelector("[data-p0-notification-summary]").textContent = `${counts.unread} chưa đọc`;
      setState(status, visible ? "ready" : "empty", visible ? "" : "Không có thông báo trong bộ lọc này.");
    };

    toolbar.addEventListener("click", (event) => {
      const button = event.target.closest("[data-p0-notification-filter]");
      if (!button) return;
      toolbar.querySelectorAll("[data-p0-notification-filter]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
      applyFilter(button.dataset.p0NotificationFilter);
    });
    list.addEventListener("click", () => global.setTimeout(() => {
      const active = toolbar.querySelector('[aria-pressed="true"]');
      applyFilter(active?.dataset.p0NotificationFilter || "all");
    }, 0));
    const listObserver = new MutationObserver(() => {
      const active = toolbar.querySelector('[aria-pressed="true"]');
      applyFilter(active?.dataset.p0NotificationFilter || "all");
    });
    listObserver.observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-read"] });
    applyFilter();
  }

  function renderSelectOptions(select, values, current, allLabel) {
    select.innerHTML = `<option value="all">${escapeHTML(allLabel)}</option>${unique(values).sort((a, b) => a.localeCompare(b, "vi")).map((value) => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join("")}`;
    select.value = unique(values).includes(current) ? current : "all";
  }

  function updateSearchMemory(panel, records) {
    const storage = getStorage();
    const recent = asArray(readStorage(storage, STORAGE.recentSearches, []));
    const saved = asArray(readStorage(storage, STORAGE.savedSearches, []));
    const recentHost = panel.querySelector("[data-p0-search-recent]");
    const savedHost = panel.querySelector("[data-p0-search-saved]");
    const build = (items, action, empty) => items.length ? items.map((item) => `<button type="button" data-${action}="${escapeHTML(item.query)}"><span>${escapeHTML(item.query)}</span><small>${escapeHTML(item.type || "all")}</small></button>`).join("") : `<p>${escapeHTML(empty)}</p>`;
    recentHost.innerHTML = build(recent, "p0-recent-query", "Chưa có tìm kiếm gần đây.");
    savedHost.innerHTML = build(saved, "p0-saved-query", "Chưa lưu tìm kiếm nào.");
    panel.querySelector("[data-p0-search-index-count]").textContent = `${records.length} bản ghi local`;
  }

  function enhanceSmartSearch(panel) {
    if (!panel || panel.dataset.p0SmartSearch === "ready") return;
    panel.dataset.p0SmartSearch = "ready";
    const queryInput = panel.querySelector("[data-smart-query]");
    const resultsHost = panel.querySelector("[data-smart-results]");
    const previewHost = panel.querySelector("[data-smart-preview]");
    const resultsPanel = resultsHost?.closest(".smart-results") || resultsHost?.parentElement;
    if (!queryInput || !resultsHost || !previewHost || !resultsPanel) return;

    const controls = panel.ownerDocument.createElement("section");
    controls.className = "p0-search-controls";
    controls.setAttribute("aria-label", "Bộ lọc tìm kiếm nâng cao");
    controls.innerHTML = `
      <label>Loại<select data-p0-search-type>${SEARCH_TYPES.map((type) => `<option value="${type}">${type === "all" ? "Tất cả loại" : type}</option>`).join("")}</select></label>
      <label>Ngày<select data-p0-search-date><option value="all">Mọi thời gian</option><option value="today">Hôm nay</option><option value="week">7 ngày</option><option value="month">30 ngày</option><option value="year">1 năm</option></select></label>
      <label>Người tạo<select data-p0-search-creator><option value="all">Mọi người</option></select></label>
      <label>Workspace<select data-p0-search-workspace><option value="all">Mọi workspace</option></select></label>
      <button type="button" class="p0-action" data-p0-save-search>Lưu tìm kiếm</button>
      <button type="button" class="p0-icon-action" data-p0-clear-search aria-label="Xóa bộ lọc" title="Xóa bộ lọc">×</button>`;
    const meta = panel.ownerDocument.createElement("div");
    meta.className = "p0-search-meta";
    meta.innerHTML = `<span data-p0-search-index-count></span><span>Chỉ hiện dữ liệu được phép đọc</span>`;
    const stateNode = createStateNode(panel, "p0-search-state");
    resultsPanel.insertBefore(controls, resultsHost);
    resultsPanel.insertBefore(meta, resultsHost);
    resultsPanel.insertBefore(stateNode, resultsHost);

    const side = panel.querySelector(".smart-search-filters");
    if (side) {
      const memory = panel.ownerDocument.createElement("section");
      memory.className = "p0-search-memory";
      memory.innerHTML = `<strong>Tìm gần đây</strong><div data-p0-search-recent></div><strong>Đã lưu</strong><div data-p0-search-saved></div>`;
      side.append(memory);
    } else {
      const memory = panel.ownerDocument.createElement("section");
      memory.className = "p0-search-memory p0-search-memory--inline";
      memory.innerHTML = `<strong>Tìm gần đây</strong><div data-p0-search-recent></div><strong>Đã lưu</strong><div data-p0-search-saved></div>`;
      resultsPanel.append(memory);
    }

    let index = [];
    const refreshIndex = () => {
      try {
        setState(stateNode, "loading", "Đang cập nhật chỉ mục local…");
        index = collectSearchRecords(panel);
        const currentCreator = controls.querySelector("[data-p0-search-creator]").value;
        const currentWorkspace = controls.querySelector("[data-p0-search-workspace]").value;
        renderSelectOptions(controls.querySelector("[data-p0-search-creator]"), index.map((record) => record.creator), currentCreator, "Mọi người");
        renderSelectOptions(controls.querySelector("[data-p0-search-workspace]"), index.map((record) => record.workspace), currentWorkspace, "Mọi workspace");
        updateSearchMemory(panel, index);
      } catch (error) {
        setState(stateNode, "error", `Không thể đọc chỉ mục: ${error.message}`);
      }
    };

    const currentFilters = () => ({
      query: queryInput.value,
      type: controls.querySelector("[data-p0-search-type]").value,
      date: controls.querySelector("[data-p0-search-date]").value,
      creator: controls.querySelector("[data-p0-search-creator]").value,
      workspace: controls.querySelector("[data-p0-search-workspace]").value,
      sort: panel.querySelector("[data-smart-sort]")?.value || "relevance"
    });

    const remember = (filters) => {
      if (!filters.query.trim()) return;
      const storage = getStorage();
      const recent = asArray(readStorage(storage, STORAGE.recentSearches, [])).filter((item) => normalized(item.query) !== normalized(filters.query));
      writeStorage(storage, STORAGE.recentSearches, [{ ...filters, at: nowISO() }, ...recent].slice(0, MAX_RECENT_SEARCHES));
    };

    const render = () => {
      try {
        const filters = currentFilters();
        const results = filterSearchRecords(index, filters);
        const summary = panel.querySelector("[data-smart-summary]");
        if (summary) summary.textContent = `${results.length} kết quả có quyền truy cập`;
        if (!results.length) {
          resultsHost.innerHTML = `<div class="p0-empty"><span aria-hidden="true">⌕</span><strong>Không có kết quả phù hợp</strong><p>Đổi từ khóa hoặc bộ lọc. Dữ liệu không có quyền đọc sẽ không xuất hiện.</p></div>`;
          setState(stateNode, "empty", "Không tìm thấy dữ liệu được phép đọc.");
        } else {
          setState(stateNode, "ready", "");
          resultsHost.innerHTML = results.slice(0, 100).map((record) => `
            <button class="p0-smart-result" type="button" data-p0-search-result="${escapeHTML(record.id)}">
              <span>${escapeHTML(record.type.toUpperCase())}</span>
              <div><strong>${escapeHTML(record.title)}</strong><p>${escapeHTML(record.description || "Không có mô tả")}</p><small>${escapeHTML(record.workspace)} · ${escapeHTML(record.creator)}</small></div>
              <b aria-hidden="true">›</b>
            </button>`).join("");
        }
        resultsHost.__p0Records = results;
        updateSearchMemory(panel, index);
      } catch (error) {
        resultsHost.innerHTML = "";
        setState(stateNode, "error", `Tìm kiếm gặp lỗi: ${error.message}`);
      }
    };
    const scheduleRender = debounce(() => global.requestAnimationFrame?.(render) || render(), 120);

    queryInput.addEventListener("input", scheduleRender);
    queryInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        remember(currentFilters());
        updateSearchMemory(panel, index);
      }
    });
    controls.addEventListener("change", render);
    panel.querySelector("[data-smart-sort]")?.addEventListener("change", render);
    controls.addEventListener("click", (event) => {
      if (event.target.closest("[data-p0-clear-search]")) {
        queryInput.value = "";
        controls.querySelectorAll("select").forEach((select) => { select.value = "all"; });
        render();
      }
      if (event.target.closest("[data-p0-save-search]")) {
        const filters = currentFilters();
        if (!filters.query.trim()) {
          setState(stateNode, "error", "Nhập từ khóa trước khi lưu tìm kiếm.");
          return;
        }
        const storage = getStorage();
        const saved = asArray(readStorage(storage, STORAGE.savedSearches, [])).filter((item) => normalized(item.query) !== normalized(filters.query));
        writeStorage(storage, STORAGE.savedSearches, [{ ...filters, at: nowISO() }, ...saved].slice(0, MAX_SAVED_SEARCHES));
        updateSearchMemory(panel, index);
        setState(stateNode, "ready", "Đã lưu tìm kiếm trên thiết bị này.");
      }
    });
    panel.addEventListener("click", (event) => {
      const resultButton = event.target.closest("[data-p0-search-result]");
      if (resultButton) {
        const record = asArray(resultsHost.__p0Records).find((item) => item.id === resultButton.dataset.p0SearchResult);
        if (!record) return;
        remember(currentFilters());
        updateSearchMemory(panel, index);
        previewHost.innerHTML = `
          <div class="p0-preview-source"><span>${escapeHTML(record.type)}</span><b>${escapeHTML(record.source)}</b></div>
          <h5>${escapeHTML(record.title)}</h5>
          <p>${escapeHTML(record.description || "Không có mô tả")}</p>
          <dl><div><dt>Người tạo</dt><dd>${escapeHTML(record.creator)}</dd></div><div><dt>Workspace</dt><dd>${escapeHTML(record.workspace)}</dd></div><div><dt>Ngày</dt><dd>${escapeHTML(record.createdAt || "Không rõ")}</dd></div></dl>
          ${record.href ? `<a class="p0-action" href="${escapeHTML(record.href)}" data-p0-open-source>Mở nguồn</a>` : `<span class="p0-source-unavailable">Nguồn chỉ có trên thiết bị này</span>`}`;
        return;
      }
      if (event.target.closest("[data-smart-suggestion]")) global.setTimeout(render, 0);
      const memoryButton = event.target.closest("[data-p0-recent-query],[data-p0-saved-query]");
      if (memoryButton) {
        queryInput.value = memoryButton.dataset.p0RecentQuery || memoryButton.dataset.p0SavedQuery || "";
        render();
        queryInput.focus();
      }
    });

    refreshIndex();
    render();
    panel.__p0RefreshSearch = () => { refreshIndex(); render(); };
  }

  function readWidgetLayout(panel, storage = getStorage()) {
    const stored = readStorage(storage, STORAGE.widgetLayout, {});
    const toggles = {};
    panel.querySelectorAll("[data-widget-toggle]").forEach((input) => { toggles[input.dataset.widgetToggle] = Boolean(input.checked); });
    return { ...stored, ...toggles };
  }

  function applyWidgetLayout(panel, layout) {
    panel.querySelectorAll("[data-widget-toggle]").forEach((input) => {
      if (Object.prototype.hasOwnProperty.call(layout, input.dataset.widgetToggle)) input.checked = Boolean(layout[input.dataset.widgetToggle]);
    });
  }

  function updateWidgetUI(panel, queue, status, message = "") {
    const pending = queue.list();
    panel.querySelector("[data-p0-widget-queue-count]").textContent = `${pending.length} chờ`;
    const online = typeof global.navigator?.onLine === "boolean" ? global.navigator.onLine : true;
    const network = panel.querySelector("[data-p0-widget-network]");
    network.textContent = online ? "Online" : "Offline";
    network.dataset.online = String(online);
    const state = panel.querySelector("[data-p0-widget-state]");
    const defaultMessage = pending.length
      ? (widgetSyncAdapter ? "Layout đang chờ đồng bộ thật." : "Đã lưu local; cần backend adapter để đồng bộ nhiều thiết bị.")
      : "Layout trên thiết bị đã cập nhật.";
    setState(state, status || (pending.length ? "pending" : "ready"), message || defaultMessage);
  }

  function enhanceWidgets(panel) {
    if (!panel || panel.dataset.p0Widgets === "ready") return;
    panel.dataset.p0Widgets = "ready";
    const storage = getStorage();
    const queue = createSyncQueue(storage);
    widgetQueues.set(panel, queue);
    const hero = panel.querySelector(".suite-hero") || panel.firstElementChild;
    const controls = panel.ownerDocument.createElement("section");
    controls.className = "p0-widget-sync";
    controls.innerHTML = `
      <div class="p0-widget-sync__status"><span data-p0-widget-network>Online</span><b data-p0-widget-queue-count>0 chờ</b></div>
      <div class="p0-widget-sync__actions">
        <button type="button" class="p0-action" data-p0-widget-retry>Thử đồng bộ</button>
        <button type="button" class="p0-action" data-p0-widget-export>Xuất layout</button>
        <button type="button" class="p0-action" data-p0-widget-import>Nhập layout</button>
        <input type="file" accept="application/json,.json" data-p0-widget-file hidden aria-label="Chọn tệp layout JSON">
      </div>`;
    const state = createStateNode(panel, "p0-widget-state");
    state.dataset.p0WidgetState = "";
    if (hero) hero.after(controls, state); else panel.prepend(controls, state);

    const enqueueLayout = debounce(() => {
      const layout = readWidgetLayout(panel, storage);
      queue.enqueue("layout:update", { schemaVersion: 1, layout, deviceUpdatedAt: nowISO() });
      updateWidgetUI(panel, queue, "pending");
      if (global.navigator?.onLine !== false && widgetSyncAdapter) flushPanelQueue(panel);
    }, 220);

    panel.addEventListener("change", (event) => {
      if (event.target.matches("[data-widget-toggle]")) enqueueLayout();
    });
    controls.addEventListener("click", async (event) => {
      if (event.target.closest("[data-p0-widget-retry]")) await flushPanelQueue(panel, true);
      if (event.target.closest("[data-p0-widget-import]")) controls.querySelector("[data-p0-widget-file]").click();
      if (event.target.closest("[data-p0-widget-export]")) {
        const documentValue = { schemaVersion: 1, exportedAt: nowISO(), layout: readWidgetLayout(panel, storage) };
        const blob = new Blob([JSON.stringify(documentValue, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = panel.ownerDocument.createElement("a");
        anchor.href = url;
        anchor.download = `hh-widget-layout-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        global.setTimeout(() => URL.revokeObjectURL(url), 0);
        setState(state, "ready", "Đã xuất layout JSON từ dữ liệu local.");
      }
    });
    controls.querySelector("[data-p0-widget-file]").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        setState(state, "loading", "Đang kiểm tra layout…");
        const documentValue = validateLayoutDocument(safeParse(await file.text(), null));
        if (!writeStorage(storage, STORAGE.widgetLayout, documentValue.layout)) throw new Error("Trình duyệt không cho phép lưu layout.");
        applyWidgetLayout(panel, documentValue.layout);
        queue.enqueue("layout:import", { ...documentValue, importedAt: nowISO() });
        updateWidgetUI(panel, queue, "pending", "Đã nhập layout và xếp hàng đồng bộ.");
      } catch (error) {
        setState(state, "error", error.message);
      } finally {
        event.target.value = "";
      }
    });
    updateWidgetUI(panel, queue);
  }

  async function flushPanelQueue(panel, manual = false) {
    const queue = widgetQueues.get(panel);
    if (!queue) return { status: "missing", pending: 0, synced: 0 };
    setState(panel.querySelector("[data-p0-widget-state]"), "loading", "Đang kiểm tra hàng đợi đồng bộ…");
    const online = typeof global.navigator?.onLine === "boolean" ? global.navigator.onLine : true;
    const result = await queue.flush(widgetSyncAdapter, online);
    const messages = {
      offline: "Thiết bị đang offline. Hàng đợi sẽ thử lại khi có mạng.",
      "adapter-required": "Chưa có backend sync adapter. Layout vẫn được lưu local.",
      synced: `Đồng bộ thật thành công ${result.synced} thay đổi.`,
      pending: `Đã đồng bộ ${result.synced}; còn ${result.pending} thay đổi chờ thử lại.`
    };
    updateWidgetUI(panel, queue, result.status === "synced" ? "ready" : result.status, messages[result.status]);
    if (manual && result.status === "adapter-required") panel.querySelector("[data-p0-widget-retry]")?.focus();
    return result;
  }

  function scan(root = global.document) {
    if (!root?.querySelectorAll) return;
    roots.add(root);
    const includeRoot = (selector) => root.matches?.(selector) ? [root] : [];
    [...includeRoot("[data-notification]"), ...root.querySelectorAll("[data-notification]")].forEach(enhanceNotifications);
    [...includeRoot("[data-smart-search]"), ...root.querySelectorAll("[data-smart-search]")].forEach(enhanceSmartSearch);
    [...includeRoot("[data-widgets-engine]"), ...root.querySelectorAll("[data-widgets-engine]")].forEach(enhanceWidgets);
  }

  function start() {
    if (!global.document) return;
    scan(global.document);
    observer ||= new MutationObserver((mutations) => mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
      if (node.nodeType === 1) scan(node);
    })));
    observer.observe(global.document.documentElement, { childList: true, subtree: true });
    global.addEventListener("online", () => {
      global.document.querySelectorAll("[data-widgets-engine]").forEach((panel) => {
        updateWidgetUI(panel, widgetQueues.get(panel));
        if (widgetSyncAdapter) flushPanelQueue(panel);
      });
    });
    global.addEventListener("offline", () => global.document.querySelectorAll("[data-widgets-engine]").forEach((panel) => updateWidgetUI(panel, widgetQueues.get(panel), "offline")));
    global.setInterval(() => {
      if (!widgetSyncAdapter || global.navigator?.onLine === false || global.document.hidden) return;
      global.document.querySelectorAll("[data-widgets-engine]").forEach((panel) => {
        if (widgetQueues.get(panel)?.list().length) flushPanelQueue(panel);
      });
    }, 30000);
  }

  const api = {
    version: VERSION,
    init: scan,
    canReadRecord,
    normalizeSearchRecord,
    filterSearchRecords,
    createSyncQueue,
    validateLayoutDocument,
    setSearchRecords(records) {
      if (!Array.isArray(records)) throw new TypeError("Search records phải là một mảng.");
      global.HH_P0_SEARCH_RECORDS = records;
      writeStorage(getStorage(), STORAGE.searchRecords, records);
      global.document?.querySelectorAll?.("[data-smart-search]").forEach((panel) => panel.__p0RefreshSearch?.());
    },
    registerWidgetSyncAdapter(adapter) {
      if (adapter != null && typeof adapter !== "function") throw new TypeError("Widget sync adapter phải là function.");
      widgetSyncAdapter = adapter || null;
      if (widgetSyncAdapter) global.document?.querySelectorAll?.("[data-widgets-engine]").forEach((panel) => flushPanelQueue(panel));
    },
    flushWidgetQueue() {
      return Promise.all([...global.document?.querySelectorAll?.("[data-widgets-engine]") || []].map((panel) => flushPanelQueue(panel, true)));
    }
  };

  global.HHP0 = Object.assign(global.HHP0 || {}, api);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global.document) {
    if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
  }
})(typeof window !== "undefined" ? window : globalThis);
