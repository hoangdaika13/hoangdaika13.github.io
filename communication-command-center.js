(function communicationCommandCenterFactory(globalScope) {
  "use strict";

  const STORAGE_KEY = "hh.communication.command.v1";
  const VERSION = 1;
  const VIEWS = Object.freeze(["command-center", "unified-inbox"]);
  const ITEM_TYPES = new Set(["dm", "group", "channel", "comment", "mention", "ticket"]);
  const FILTERS = new Set(["all", "unread", "mentions", "pinned", "archived"]);
  const MAX_ITEMS = 300;
  const MAX_TEXT = 420;

  let active = null;

  const safeText = (value, limit = MAX_TEXT) => String(value == null ? "" : value).slice(0, limit);
  const escapeHtml = (value) => safeText(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || 0));
  const makeId = (prefix = "item") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  function normalizeTimestamp(value) {
    const parsed = new Date(value || Date.now());
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  function normalizeItem(input, index = 0) {
    const raw = input && typeof input === "object" ? input : {};
    const type = ITEM_TYPES.has(raw.type) ? raw.type : "dm";
    const id = safeText(raw.id || `${type}-${index}-${Date.now()}`, 100);
    return {
      id,
      type,
      title: safeText(raw.title || raw.sender || "Cuộc trò chuyện", 120),
      sender: safeText(raw.sender || raw.title || "Thành viên HH", 100),
      avatar: safeText(raw.avatar || "", 500),
      preview: safeText(raw.preview || raw.body || "", 280),
      timestamp: normalizeTimestamp(raw.timestamp),
      unread: Boolean(raw.unread),
      mentioned: Boolean(raw.mentioned || type === "mention"),
      pinned: Boolean(raw.pinned),
      archived: Boolean(raw.archived),
      snoozedUntil: raw.snoozedUntil ? normalizeTimestamp(raw.snoozedUntil) : "",
      priority: ["low", "normal", "high", "urgent"].includes(raw.priority) ? raw.priority : "normal",
      conversationId: safeText(raw.conversationId || raw.channelId || id, 100),
      route: safeText(raw.route || "", 240),
      source: safeText(raw.source || "local", 40),
      selected: Boolean(raw.selected)
    };
  }

  function normalizeConversation(input, index = 0) {
    const raw = input && typeof input === "object" ? input : {};
    return {
      id: safeText(raw.id || `conversation-${index}`, 100),
      name: safeText(raw.name || raw.title || "Cuộc trò chuyện", 100),
      preview: safeText(raw.preview || "", 180),
      avatar: safeText(raw.avatar || "", 500),
      online: Boolean(raw.online),
      unread: clamp(raw.unread, 0, 999),
      timestamp: normalizeTimestamp(raw.timestamp),
      favorite: Boolean(raw.favorite)
    };
  }

  function normalizeNotice(input, index = 0) {
    const raw = input && typeof input === "object" ? input : {};
    return {
      id: safeText(raw.id || `notice-${index}`, 100),
      title: safeText(raw.title || "Thông báo", 120),
      body: safeText(raw.body || raw.preview || "", 240),
      tone: ["info", "success", "warning", "danger"].includes(raw.tone) ? raw.tone : "info",
      important: raw.important !== false,
      timestamp: normalizeTimestamp(raw.timestamp)
    };
  }

  function seedState() {
    const now = Date.now();
    return {
      version: VERSION,
      mode: "local-fallback",
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      onlineUsers: 0,
      upcomingCalls: [{ id: "call-creative", title: "Creative Room: nghe bản phối", startsAt: new Date(now + 42 * 60 * 1000).toISOString(), participants: 5 }],
      supportRequests: 2,
      conversations: [
        { id: "conv-team", name: "Nhóm HH Creative", preview: "Minh vừa gửi bản storyboard mới", online: false, unread: 3, favorite: true, timestamp: new Date(now - 4 * 60 * 1000).toISOString() },
        { id: "conv-lan", name: "Lan Anh", preview: "Mình đã duyệt thumbnail rồi nhé", online: false, unread: 1, favorite: true, timestamp: new Date(now - 19 * 60 * 1000).toISOString() },
        { id: "conv-support", name: "Hỗ trợ HH", preview: "Ticket của bạn đã được tiếp nhận", online: false, unread: 0, favorite: false, timestamp: new Date(now - 75 * 60 * 1000).toISOString() }
      ],
      notices: [
        { id: "notice-room", title: "Phòng sáng tạo bắt đầu sau 42 phút", body: "5 thành viên đã xác nhận tham gia.", tone: "warning", important: true, timestamp: new Date(now - 2 * 60 * 1000).toISOString() },
        { id: "notice-local", title: "Dữ liệu đang ở chế độ cục bộ", body: "Kết nối adapter realtime để đồng bộ nhiều thiết bị.", tone: "info", important: true, timestamp: new Date(now).toISOString() }
      ],
      items: [
        { id: "dm-lan", type: "dm", title: "Lan Anh", sender: "Lan Anh", preview: "Mình đã duyệt thumbnail rồi nhé.", timestamp: new Date(now - 3 * 60 * 1000).toISOString(), unread: true, pinned: true, conversationId: "conv-lan" },
        { id: "mention-design", type: "mention", title: "# media-design", sender: "Minh", preview: "@bạn xem giúp bố cục mobile trước khi duyệt.", timestamp: new Date(now - 8 * 60 * 1000).toISOString(), unread: true, mentioned: true, priority: "high", conversationId: "channel-design" },
        { id: "group-creative", type: "group", title: "HH Creative", sender: "Hà", preview: "Đã tải lên storyboard-v3.pdf", timestamp: new Date(now - 16 * 60 * 1000).toISOString(), unread: true, conversationId: "conv-team" },
        { id: "ticket-upload", type: "ticket", title: "Ticket #1042", sender: "Helpdesk", preview: "Lỗi tải video đang được kiểm tra.", timestamp: new Date(now - 31 * 60 * 1000).toISOString(), unread: true, priority: "urgent", conversationId: "ticket-1042" },
        { id: "comment-project", type: "comment", title: "Project Center", sender: "Quang", preview: "Đã bình luận vào mốc phát hành tuần này.", timestamp: new Date(now - 54 * 60 * 1000).toISOString(), unread: false, conversationId: "project-release" },
        { id: "channel-learning", type: "channel", title: "# english-club", sender: "Mai", preview: "Tối nay luyện speaking lúc 20:00.", timestamp: new Date(now - 88 * 60 * 1000).toISOString(), unread: false, archived: true, conversationId: "channel-learning" }
      ],
      ui: { filter: "all", search: "", activeId: "dm-lan", selectedIds: [], replyDrafts: {}, forwardOpen: false },
      lastAction: ""
    };
  }

  function normalizeState(input) {
    const raw = input && typeof input === "object" ? input : {};
    const ui = raw.ui && typeof raw.ui === "object" ? raw.ui : {};
    const items = Array.isArray(raw.items) ? raw.items.slice(0, MAX_ITEMS).map(normalizeItem) : [];
    const ids = new Set(items.map((item) => item.id));
    return {
      version: VERSION,
      mode: raw.mode === "adapter" ? "adapter" : "local-fallback",
      createdAt: normalizeTimestamp(raw.createdAt),
      updatedAt: normalizeTimestamp(raw.updatedAt),
      onlineUsers: clamp(raw.onlineUsers, 0, 9999),
      upcomingCalls: (Array.isArray(raw.upcomingCalls) ? raw.upcomingCalls : []).slice(0, 30).map((call, index) => ({
        id: safeText(call && call.id || `call-${index}`, 100),
        title: safeText(call && call.title || "Cuộc gọi", 120),
        startsAt: normalizeTimestamp(call && call.startsAt),
        participants: clamp(call && call.participants, 0, 999)
      })),
      supportRequests: clamp(raw.supportRequests, 0, 9999),
      conversations: (Array.isArray(raw.conversations) ? raw.conversations : []).slice(0, 80).map(normalizeConversation),
      notices: (Array.isArray(raw.notices) ? raw.notices : []).slice(0, 40).map(normalizeNotice),
      items,
      ui: {
        filter: FILTERS.has(ui.filter) ? ui.filter : "all",
        search: safeText(ui.search, 100),
        activeId: ids.has(ui.activeId) ? ui.activeId : (items[0] && items[0].id || ""),
        selectedIds: (Array.isArray(ui.selectedIds) ? ui.selectedIds : []).filter((id) => ids.has(id)).slice(0, MAX_ITEMS),
        replyDrafts: Object.fromEntries(Object.entries(ui.replyDrafts && typeof ui.replyDrafts === "object" ? ui.replyDrafts : {}).slice(0, 50).map(([key, value]) => [safeText(key, 100), safeText(value, 500)])),
        forwardOpen: Boolean(ui.forwardOpen)
      },
      lastAction: safeText(raw.lastAction, 160)
    };
  }

  function getStorage(scope) {
    try { return scope && scope.localStorage ? scope.localStorage : null; } catch { return null; }
  }

  function loadState(scope = globalScope) {
    const storage = getStorage(scope);
    if (!storage) return normalizeState(seedState());
    try {
      const value = storage.getItem(STORAGE_KEY);
      if (!value) {
        const seeded = normalizeState(seedState());
        storage.setItem(STORAGE_KEY, JSON.stringify(seeded));
        return seeded;
      }
      const saved = normalizeState(JSON.parse(value));
      return normalizeState({
        ...saved,
        mode: "local-fallback",
        onlineUsers: 0,
        conversations: saved.conversations.map((conversation) => ({ ...conversation, online: false }))
      });
    } catch {
      return normalizeState(seedState());
    }
  }

  function isConfirmedAdapterPayload(payload) {
    const data = payload && typeof payload === "object" ? payload : {};
    const state = data.connection && typeof data.connection === "object" ? data.connection.state : "";
    return data.ok !== false && (data.connected === true || state === "connected");
  }

  function saveState(state, scope = globalScope) {
    state.updatedAt = new Date().toISOString();
    const storage = getStorage(scope);
    if (!storage) return false;
    try { storage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state))); return true; } catch { return false; }
  }

  function mergeAdapterData(state, payload) {
    const data = payload && typeof payload === "object" ? payload : {};
    const connected = isConfirmedAdapterPayload(data);
    const byId = new Map(state.items.map((item) => [item.id, item]));
    if (Array.isArray(data.items)) {
      data.items.map(normalizeItem).forEach((item) => byId.set(item.id, { ...byId.get(item.id), ...item, source: safeText(data.source || item.source || "adapter", 40) }));
    }
    return normalizeState({
      ...state,
      mode: connected ? "adapter" : "local-fallback",
      items: Array.from(byId.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, MAX_ITEMS),
      onlineUsers: connected && data.onlineUsers != null ? data.onlineUsers : 0,
      upcomingCalls: Array.isArray(data.upcomingCalls) ? data.upcomingCalls : state.upcomingCalls,
      supportRequests: data.supportRequests == null ? state.supportRequests : data.supportRequests,
      conversations: (Array.isArray(data.conversations) ? data.conversations : state.conversations).map((conversation) => ({ ...conversation, online: connected && Boolean(conversation.online) })),
      notices: Array.isArray(data.notices) ? data.notices : state.notices
    });
  }

  function emit(name, detail, scope = globalScope) {
    if (!scope || typeof scope.dispatchEvent !== "function") return false;
    try {
      const EventCtor = scope.CustomEvent || (typeof CustomEvent === "function" && CustomEvent);
      scope.dispatchEvent(EventCtor ? new EventCtor(name, { detail }) : { type: name, detail });
      return true;
    } catch { return false; }
  }

  function supports(view) { return VIEWS.includes(String(view || "")); }

  function initials(name) {
    return safeText(name).trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toLocaleUpperCase("vi") || "HH";
  }

  function relativeTime(value, now = Date.now()) {
    const delta = new Date(value).getTime() - now;
    const absolute = Math.abs(delta);
    if (absolute < 60_000) return "Vừa xong";
    const formatter = typeof Intl !== "undefined" && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat("vi", { numeric: "auto" }) : null;
    const units = absolute < 3_600_000 ? ["minute", 60_000] : absolute < 86_400_000 ? ["hour", 3_600_000] : ["day", 86_400_000];
    const count = Math.round(delta / units[1]);
    return formatter ? formatter.format(count, units[0]) : `${Math.abs(count)} ${units[0]}`;
  }

  function itemTypeLabel(type) {
    return ({ dm: "Tin riêng", group: "Nhóm", channel: "Kênh", comment: "Bình luận", mention: "Nhắc đến", ticket: "Hỗ trợ" })[type] || "Tin nhắn";
  }

  function itemIcon(type) {
    return ({ dm: "↗", group: "◎", channel: "#", comment: "◌", mention: "@", ticket: "?" })[type] || "•";
  }

  function modeBadge(state) {
    const adapter = state.mode === "adapter";
    return `<span class="hcc-mode ${adapter ? "is-connected" : ""}"><i></i>${adapter ? "Adapter đang cấp dữ liệu" : "Dữ liệu cục bộ trên thiết bị"}</span>`;
  }

  function avatarMarkup(entity, extraClass = "") {
    const image = safeText(entity.avatar || "", 500);
    return image
      ? `<span class="hcc-avatar ${extraClass}"><img src="${escapeHtml(image)}" alt=""></span>`
      : `<span class="hcc-avatar ${extraClass}" aria-hidden="true">${escapeHtml(initials(entity.name || entity.title || entity.sender))}</span>`;
  }

  function commandView(state) {
    const unread = state.items.filter((item) => item.unread && (!item.snoozedUntil || new Date(item.snoozedUntil) <= new Date())).length;
    const nextCall = state.upcomingCalls.slice().sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0];
    const favorites = state.conversations.filter((conversation) => conversation.favorite).slice(0, 6);
    const recent = state.conversations.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5);
    const notices = state.notices.filter((notice) => notice.important).slice(0, 4);
    return `<section class="hcc hcc-command" aria-labelledby="hcc-title">
      <header class="hcc-hero">
        <div class="hcc-hero__copy">
          <span class="hcc-kicker">COMMUNICATION COMMAND CENTER</span>
          <h2 id="hcc-title">Mọi cuộc trò chuyện,<br><em>đúng nơi cần chú ý.</em></h2>
          <p>Theo dõi tin chưa đọc, người đang hoạt động, cuộc gọi và hỗ trợ trong một không gian thống nhất.</p>
          <div class="hcc-hero__actions">
            <button class="is-primary" type="button" data-hcc-quick="message"><span>＋</span>Nhắn tin</button>
            <button type="button" data-hcc-view="unified-inbox"><span>⌁</span>Mở hộp thư</button>
          </div>
        </div>
        <div class="hcc-radar" aria-label="Tình trạng kết nối">
          <div class="hcc-radar__orb" aria-hidden="true"><i></i><i></i><i></i><strong>HH</strong></div>
          ${modeBadge(state)}
          <small>${state.mode === "adapter" ? "Dữ liệu ngoài đã được hợp nhất." : "Chưa có backend realtime; thay đổi chỉ lưu trên trình duyệt này."}</small>
        </div>
      </header>

      <section class="hcc-metrics" aria-label="Chỉ số giao tiếp">
        <article class="hcc-metric hcc-metric--pink"><span>✦</span><div><small>Tin chưa đọc</small><strong>${unread}</strong><p>${state.items.filter((item) => item.mentioned && item.unread).length} lượt nhắc đến</p></div></article>
        <article class="hcc-metric hcc-metric--cyan"><span>◉</span><div><small>Đang online</small><strong>${state.mode === "adapter" ? state.onlineUsers : "—"}</strong><p>${state.mode === "adapter" ? "Adapter đã xác nhận" : "Chưa xác nhận realtime"}</p></div></article>
        <article class="hcc-metric hcc-metric--yellow"><span>◷</span><div><small>Cuộc gọi sắp tới</small><strong>${state.upcomingCalls.length}</strong><p>${nextCall ? `${escapeHtml(relativeTime(nextCall.startsAt))} · ${nextCall.participants} người` : "Chưa có lịch"}</p></div></article>
        <article class="hcc-metric hcc-metric--lime"><span>?</span><div><small>Yêu cầu hỗ trợ</small><strong>${state.supportRequests}</strong><p>Đang chờ xử lý</p></div></article>
      </section>

      <section class="hcc-quick" aria-labelledby="hcc-quick-title">
        <div class="hcc-section-head"><div><span>THAO TÁC NHANH</span><h3 id="hcc-quick-title">Bắt đầu trong một nhịp</h3></div><small>Mọi nút phát sự kiện cho engine tương ứng.</small></div>
        <div class="hcc-quick__grid">
          ${[["message","↗","Tin nhắn mới","Mở cuộc trò chuyện riêng"],["group","◎","Tạo nhóm","Mời và phân quyền thành viên"],["room","◉","Mở phòng","Voice, video hoặc cùng làm việc"],["post","✦","Đăng bài","Chia sẻ với cộng đồng"],["poll","≡","Tạo khảo sát","Thu thập ý kiến nhanh"]].map(([action, icon, title, body]) => `<button type="button" data-hcc-quick="${action}"><b>${icon}</b><span><strong>${title}</strong><small>${body}</small></span><i>→</i></button>`).join("")}
        </div>
      </section>

      <div class="hcc-dashboard-grid">
        <section class="hcc-panel hcc-recent" aria-labelledby="hcc-recent-title">
          <div class="hcc-section-head"><div><span>GẦN ĐÂY</span><h3 id="hcc-recent-title">Cuộc trò chuyện</h3></div><button type="button" data-hcc-view="unified-inbox">Xem tất cả</button></div>
          <div class="hcc-conversation-list">${recent.map((conversation) => `<button type="button" data-hcc-open-conversation="${escapeHtml(conversation.id)}">${avatarMarkup(conversation)}<span><strong>${escapeHtml(conversation.name)}</strong><small>${escapeHtml(conversation.preview || "Chưa có tin nhắn")}</small></span><time>${escapeHtml(relativeTime(conversation.timestamp))}</time>${conversation.unread ? `<b>${conversation.unread}</b>` : ""}</button>`).join("") || '<p class="hcc-empty">Chưa có cuộc trò chuyện gần đây.</p>'}</div>
        </section>
        <section class="hcc-panel hcc-favorites" aria-labelledby="hcc-favorite-title">
          <div class="hcc-section-head"><div><span>YÊU THÍCH</span><h3 id="hcc-favorite-title">Nhóm ưu tiên</h3></div><small>${favorites.length} đã ghim</small></div>
          <div class="hcc-favorite-grid">${favorites.map((conversation) => `<button type="button" data-hcc-open-conversation="${escapeHtml(conversation.id)}">${avatarMarkup(conversation, conversation.online ? "is-online" : "")}<strong>${escapeHtml(conversation.name)}</strong><small>${conversation.online ? "Đang hoạt động" : "Ngoại tuyến"}</small></button>`).join("") || '<p class="hcc-empty">Ghim nhóm quan trọng để truy cập nhanh.</p>'}</div>
        </section>
        <section class="hcc-panel hcc-notices" aria-labelledby="hcc-notice-title">
          <div class="hcc-section-head"><div><span>QUAN TRỌNG</span><h3 id="hcc-notice-title">Thông báo cần chú ý</h3></div><small>${notices.length} cập nhật</small></div>
          <div class="hcc-notice-list">${notices.map((notice) => `<article class="is-${notice.tone}"><i></i><div><strong>${escapeHtml(notice.title)}</strong><p>${escapeHtml(notice.body)}</p></div><time>${escapeHtml(relativeTime(notice.timestamp))}</time></article>`).join("") || '<p class="hcc-empty">Không có thông báo quan trọng.</p>'}</div>
        </section>
      </div>
      <p class="hcc-live" role="status" aria-live="polite">${escapeHtml(state.lastAction || (state.mode === "adapter" ? "Dữ liệu giao tiếp đã được đồng bộ." : "Sẵn sàng ở chế độ cục bộ."))}</p>
    </section>`;
  }

  function filteredItems(state) {
    const now = Date.now();
    const query = state.ui.search.trim().toLocaleLowerCase("vi");
    return state.items.filter((item) => {
      const snoozed = item.snoozedUntil && new Date(item.snoozedUntil).getTime() > now;
      if (snoozed && state.ui.filter !== "archived") return false;
      if (state.ui.filter === "unread" && !item.unread) return false;
      if (state.ui.filter === "mentions" && !item.mentioned) return false;
      if (state.ui.filter === "pinned" && !item.pinned) return false;
      if (state.ui.filter === "archived" && !item.archived) return false;
      if (state.ui.filter !== "archived" && item.archived) return false;
      if (query && !`${item.title} ${item.sender} ${item.preview} ${item.type}`.toLocaleLowerCase("vi").includes(query)) return false;
      return true;
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  function inboxRow(item, state, index) {
    const active = state.ui.activeId === item.id;
    const selected = state.ui.selectedIds.includes(item.id);
    return `<article class="hcc-inbox-row ${item.unread ? "is-unread" : ""} ${active ? "is-active" : ""}" data-hcc-row="${escapeHtml(item.id)}" role="option" aria-selected="${active}" tabindex="${active || (!state.ui.activeId && index === 0) ? "0" : "-1"}">
      <label class="hcc-check"><input type="checkbox" data-hcc-select="${escapeHtml(item.id)}" ${selected ? "checked" : ""}><span aria-hidden="true"></span><span class="sr-only">Chọn ${escapeHtml(item.title)}</span></label>
      <span class="hcc-type hcc-type--${item.type}" aria-hidden="true">${itemIcon(item.type)}</span>
      <div class="hcc-row-copy"><div><strong>${escapeHtml(item.title)}</strong>${item.pinned ? '<span title="Đã ghim">◆</span>' : ""}${item.mentioned ? '<b>@ bạn</b>' : ""}</div><p><span>${escapeHtml(item.sender)}</span> · ${escapeHtml(item.preview || "Không có nội dung xem trước")}</p></div>
      <div class="hcc-row-meta"><time>${escapeHtml(relativeTime(item.timestamp))}</time><span>${escapeHtml(itemTypeLabel(item.type))}</span></div>
      ${item.unread ? '<i class="hcc-unread-dot" aria-label="Chưa đọc"></i>' : ""}
    </article>`;
  }

  function inboxDetail(item, state) {
    if (!item) return `<section class="hcc-inbox-detail hcc-inbox-detail--empty"><div><span>⌁</span><h3>Chọn một mục trong hộp thư</h3><p>Nội dung, trả lời nhanh và hành động sẽ xuất hiện tại đây.</p></div></section>`;
    const draft = state.ui.replyDrafts[item.id] || "";
    return `<section class="hcc-inbox-detail" aria-labelledby="hcc-detail-title">
      <header>${avatarMarkup({ name: item.sender, avatar: item.avatar })}<div><small>${escapeHtml(itemTypeLabel(item.type))}</small><h3 id="hcc-detail-title">${escapeHtml(item.title)}</h3><p>${escapeHtml(item.sender)} · ${escapeHtml(relativeTime(item.timestamp))}</p></div><button type="button" data-hcc-item-action="pin" data-id="${escapeHtml(item.id)}" aria-pressed="${item.pinned}">${item.pinned ? "Bỏ ghim" : "Ghim"}</button></header>
      <div class="hcc-message-card"><span>${escapeHtml(initials(item.sender))}</span><div><strong>${escapeHtml(item.sender)}</strong><time>${new Date(item.timestamp).toLocaleString("vi-VN")}</time><p>${escapeHtml(item.preview || "Không có nội dung xem trước.")}</p></div></div>
      <div class="hcc-detail-actions" aria-label="Hành động tin nhắn">
        <button type="button" data-hcc-item-action="${item.unread ? "read" : "unread"}" data-id="${escapeHtml(item.id)}">${item.unread ? "Đánh dấu đã đọc" : "Đánh dấu chưa đọc"}</button>
        <button type="button" data-hcc-item-action="snooze" data-id="${escapeHtml(item.id)}">Nhắc lại sau 1 giờ</button>
        <button type="button" data-hcc-item-action="archive" data-id="${escapeHtml(item.id)}">${item.archived ? "Bỏ lưu trữ" : "Lưu trữ"}</button>
        <button type="button" data-hcc-item-action="forward" data-id="${escapeHtml(item.id)}">Chuyển tiếp</button>
      </div>
      <form class="hcc-reply" data-hcc-reply-form="${escapeHtml(item.id)}"><label for="hcc-reply-${escapeHtml(item.id)}">Trả lời nhanh</label><textarea id="hcc-reply-${escapeHtml(item.id)}" data-hcc-reply-draft="${escapeHtml(item.id)}" rows="4" maxlength="500" placeholder="Nhập phản hồi…">${escapeHtml(draft)}</textarea><div><small>${draft.length}/500 · Ctrl + Enter để gửi</small><button type="submit" ${draft.trim() ? "" : "disabled"}>Gửi trả lời</button></div></form>
      ${state.ui.forwardOpen ? forwardDialog(state, item) : ""}
    </section>`;
  }

  function forwardDialog(state, item) {
    const targets = state.conversations.filter((conversation) => conversation.id !== item.conversationId).slice(0, 12);
    return `<div class="hcc-forward" role="dialog" aria-modal="true" aria-labelledby="hcc-forward-title"><div><header><div><small>CHUYỂN TIẾP</small><h3 id="hcc-forward-title">Chọn cuộc trò chuyện</h3></div><button type="button" data-hcc-close-forward aria-label="Đóng">×</button></header><p>“${escapeHtml(item.preview)}”</p><div>${targets.map((target) => `<button type="button" data-hcc-forward-target="${escapeHtml(target.id)}" data-id="${escapeHtml(item.id)}">${avatarMarkup(target)}<span><strong>${escapeHtml(target.name)}</strong><small>${escapeHtml(target.preview || "Sẵn sàng nhận tin")}</small></span></button>`).join("") || '<p class="hcc-empty">Chưa có cuộc trò chuyện đích.</p>'}</div></div></div>`;
  }

  function inboxView(state) {
    const items = filteredItems(state);
    const activeItem = state.items.find((item) => item.id === state.ui.activeId) || items[0] || null;
    const selectedCount = state.ui.selectedIds.length;
    const filterCounts = {
      all: state.items.filter((item) => !item.archived).length,
      unread: state.items.filter((item) => item.unread && !item.archived).length,
      mentions: state.items.filter((item) => item.mentioned && !item.archived).length,
      pinned: state.items.filter((item) => item.pinned && !item.archived).length,
      archived: state.items.filter((item) => item.archived).length
    };
    return `<section class="hcc hcc-inbox" aria-labelledby="hcc-inbox-title">
      <header class="hcc-inbox-head"><div><button type="button" data-hcc-view="command-center" aria-label="Về Command Center">←</button><div><span>UNIFIED INBOX</span><h2 id="hcc-inbox-title">Hộp thư hợp nhất</h2><p>DM, nhóm, kênh, bình luận, mention và ticket trong một luồng.</p></div></div><div>${modeBadge(state)}<button type="button" data-hcc-refresh>↻ Đồng bộ</button></div></header>
      <div class="hcc-inbox-tools">
        <label class="hcc-search"><span>⌕</span><input type="search" data-hcc-search value="${escapeHtml(state.ui.search)}" placeholder="Tìm người gửi, nội dung hoặc loại tin…" aria-label="Tìm trong hộp thư"><kbd>/</kbd></label>
        <div class="hcc-filter-tabs" role="tablist" aria-label="Bộ lọc hộp thư">${[["all","Tất cả"],["unread","Chưa đọc"],["mentions","Nhắc đến"],["pinned","Đã ghim"],["archived","Lưu trữ"]].map(([id, label]) => `<button type="button" role="tab" data-hcc-filter="${id}" aria-selected="${state.ui.filter === id}">${label}<span>${filterCounts[id]}</span></button>`).join("")}</div>
      </div>
      ${selectedCount ? `<div class="hcc-selection" role="toolbar" aria-label="Thao tác với mục đã chọn"><strong>${selectedCount} đã chọn</strong><button type="button" data-hcc-bulk="read">Đã đọc</button><button type="button" data-hcc-bulk="unread">Chưa đọc</button><button type="button" data-hcc-bulk="snooze">Nhắc sau</button><button type="button" data-hcc-bulk="archive">Lưu trữ</button><button type="button" data-hcc-clear-selection>Bỏ chọn</button></div>` : ""}
      <div class="hcc-inbox-layout">
        <section class="hcc-inbox-list" aria-label="Danh sách hộp thư"><div class="hcc-inbox-list__head"><strong>${items.length} mục</strong><span>Dùng ↑ ↓ để di chuyển · Space để chọn</span></div><div role="listbox" data-hcc-list aria-label="Các mục giao tiếp">${items.map((item, index) => inboxRow(item, state, index)).join("") || '<div class="hcc-empty-state"><span>✓</span><h3>Không có mục phù hợp</h3><p>Hãy thử bộ lọc khác hoặc xóa từ khóa tìm kiếm.</p></div>'}</div></section>
        ${inboxDetail(activeItem, state)}
      </div>
      <p class="hcc-live" role="status" aria-live="polite">${escapeHtml(state.lastAction || `${items.length} mục đang hiển thị.`)}</p>
    </section>`;
  }

  function render(runtime, focusId) {
    if (!runtime || !runtime.host) return;
    runtime.host.innerHTML = runtime.view === "unified-inbox" ? inboxView(runtime.state) : commandView(runtime.state);
    if (focusId) runtime.host.querySelector && runtime.host.querySelector(`[data-hcc-row="${cssEscape(focusId)}"]`)?.focus();
  }

  function cssEscape(value) {
    if (globalScope.CSS && typeof globalScope.CSS.escape === "function") return globalScope.CSS.escape(value);
    return safeText(value, 100).replace(/(["\\])/g, "\\$1");
  }

  function persistAndRender(runtime, message, focusId) {
    runtime.state.lastAction = safeText(message, 160);
    saveState(runtime.state, runtime.scope);
    render(runtime, focusId);
  }

  function requestAdapterData(runtime) {
    let responded = false;
    const respond = (payload) => {
      responded = true;
      runtime.state = mergeAdapterData(runtime.state, payload);
      persistAndRender(runtime, isConfirmedAdapterPayload(payload)
        ? "Adapter đã xác nhận kết nối và dữ liệu đã được hợp nhất."
        : "Đã nhận dữ liệu nhưng adapter chưa xác nhận kết nối; presence vẫn ngoại tuyến.");
    };
    emit("hh:communication:request-data", { version: VERSION, source: "command-center", views: VIEWS.slice(), respond }, runtime.scope);
    if (!responded) {
      runtime.state.lastAction = "Đã gửi yêu cầu đồng bộ; chưa có adapter realtime phản hồi.";
      render(runtime);
    }
  }

  function dispatchAction(runtime, action, payload = {}) {
    emit("hh:communication:action", { version: VERSION, action, payload, source: "command-center", timestamp: new Date().toISOString() }, runtime.scope);
  }

  function switchView(runtime, view) {
    if (!supports(view)) return;
    runtime.view = view;
    runtime.options.view = view;
    dispatchAction(runtime, "navigate", { view });
    emit("hh:communication:navigate", { view, route: `/communication/${view}` }, runtime.scope);
    render(runtime);
  }

  function updateItem(runtime, id, patch) {
    const index = runtime.state.items.findIndex((item) => item.id === id);
    if (index < 0) return null;
    runtime.state.items[index] = normalizeItem({ ...runtime.state.items[index], ...patch }, index);
    return runtime.state.items[index];
  }

  function handleItemAction(runtime, action, id) {
    const item = runtime.state.items.find((entry) => entry.id === id);
    if (!item) return;
    if (action === "read" || action === "unread") {
      updateItem(runtime, id, { unread: action === "unread" });
      dispatchAction(runtime, "message:read-state", { id, unread: action === "unread" });
      persistAndRender(runtime, action === "unread" ? "Đã đánh dấu chưa đọc." : "Đã đánh dấu đã đọc.", id);
    } else if (action === "pin") {
      updateItem(runtime, id, { pinned: !item.pinned });
      dispatchAction(runtime, "message:pin", { id, pinned: !item.pinned });
      persistAndRender(runtime, item.pinned ? "Đã bỏ ghim." : "Đã ghim mục giao tiếp.", id);
    } else if (action === "archive") {
      updateItem(runtime, id, { archived: !item.archived });
      dispatchAction(runtime, "message:archive", { id, archived: !item.archived });
      persistAndRender(runtime, item.archived ? "Đã đưa mục trở lại hộp thư." : "Đã lưu trữ mục.");
    } else if (action === "snooze") {
      const snoozedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      updateItem(runtime, id, { snoozedUntil });
      dispatchAction(runtime, "message:snooze", { id, snoozedUntil });
      persistAndRender(runtime, "Đã tạm ẩn mục trong 1 giờ.");
    } else if (action === "forward") {
      runtime.state.ui.activeId = id;
      runtime.state.ui.forwardOpen = true;
      persistAndRender(runtime, "Chọn cuộc trò chuyện để chuyển tiếp.");
    }
  }

  function handleBulk(runtime, action) {
    const selected = new Set(runtime.state.ui.selectedIds);
    const snoozedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    runtime.state.items = runtime.state.items.map((item) => {
      if (!selected.has(item.id)) return item;
      if (action === "read") return { ...item, unread: false };
      if (action === "unread") return { ...item, unread: true };
      if (action === "snooze") return { ...item, snoozedUntil };
      if (action === "archive") return { ...item, archived: true };
      return item;
    }).map(normalizeItem);
    dispatchAction(runtime, `bulk:${action}`, { ids: Array.from(selected), snoozedUntil: action === "snooze" ? snoozedUntil : "" });
    runtime.state.ui.selectedIds = [];
    persistAndRender(runtime, `Đã cập nhật ${selected.size} mục.`);
  }

  function handleClick(runtime, event) {
    const target = event.target && typeof event.target.closest === "function" ? event.target : null;
    if (!target) return;
    const viewButton = target.closest("[data-hcc-view]");
    if (viewButton) return switchView(runtime, viewButton.dataset.hccView);
    const quick = target.closest("[data-hcc-quick]");
    if (quick) {
      const labels = { message: "Mở luồng tạo tin nhắn.", group: "Mở luồng tạo nhóm.", room: "Mở luồng tạo phòng.", post: "Mở trình đăng bài.", poll: "Mở trình tạo khảo sát." };
      dispatchAction(runtime, `quick:${quick.dataset.hccQuick}`, {});
      return persistAndRender(runtime, labels[quick.dataset.hccQuick] || "Đã gửi thao tác nhanh.");
    }
    const conversation = target.closest("[data-hcc-open-conversation]");
    if (conversation) {
      dispatchAction(runtime, "conversation:open", { conversationId: conversation.dataset.hccOpenConversation });
      return persistAndRender(runtime, "Đã gửi yêu cầu mở cuộc trò chuyện.");
    }
    const filter = target.closest("[data-hcc-filter]");
    if (filter) {
      runtime.state.ui.filter = FILTERS.has(filter.dataset.hccFilter) ? filter.dataset.hccFilter : "all";
      return persistAndRender(runtime, `Đang lọc: ${filter.textContent.trim()}.`);
    }
    const row = target.closest("[data-hcc-row]");
    if (row && !target.closest("[data-hcc-select]")) {
      runtime.state.ui.activeId = row.dataset.hccRow;
      updateItem(runtime, row.dataset.hccRow, { unread: false });
      dispatchAction(runtime, "inbox:open", { id: row.dataset.hccRow });
      return persistAndRender(runtime, "Đã mở mục trong hộp thư.", row.dataset.hccRow);
    }
    const itemAction = target.closest("[data-hcc-item-action]");
    if (itemAction) return handleItemAction(runtime, itemAction.dataset.hccItemAction, itemAction.dataset.id);
    const bulk = target.closest("[data-hcc-bulk]");
    if (bulk) return handleBulk(runtime, bulk.dataset.hccBulk);
    if (target.closest("[data-hcc-clear-selection]")) {
      runtime.state.ui.selectedIds = [];
      return persistAndRender(runtime, "Đã bỏ chọn tất cả.");
    }
    if (target.closest("[data-hcc-refresh]")) return requestAdapterData(runtime);
    if (target.closest("[data-hcc-close-forward]")) {
      runtime.state.ui.forwardOpen = false;
      return persistAndRender(runtime, "Đã đóng bảng chuyển tiếp.");
    }
    const forward = target.closest("[data-hcc-forward-target]");
    if (forward) {
      runtime.state.ui.forwardOpen = false;
      dispatchAction(runtime, "message:forward", { id: forward.dataset.id, targetConversationId: forward.dataset.hccForwardTarget });
      return persistAndRender(runtime, "Đã gửi yêu cầu chuyển tiếp.");
    }
  }

  function handleChange(runtime, event) {
    const select = event.target && event.target.matches && event.target.matches("[data-hcc-select]") ? event.target : null;
    if (!select) return;
    const ids = new Set(runtime.state.ui.selectedIds);
    if (select.checked) ids.add(select.dataset.hccSelect); else ids.delete(select.dataset.hccSelect);
    runtime.state.ui.selectedIds = Array.from(ids);
    persistAndRender(runtime, `${ids.size} mục đang được chọn.`, select.dataset.hccSelect);
  }

  function handleInput(runtime, event) {
    const target = event.target;
    if (target && target.matches && target.matches("[data-hcc-search]")) {
      runtime.state.ui.search = safeText(target.value, 100);
      saveState(runtime.state, runtime.scope);
      render(runtime);
    } else if (target && target.matches && target.matches("[data-hcc-reply-draft]")) {
      runtime.state.ui.replyDrafts[target.dataset.hccReplyDraft] = safeText(target.value, 500);
      saveState(runtime.state, runtime.scope);
      const form = target.closest("form");
      const button = form && form.querySelector("button[type=submit]");
      if (button) button.disabled = !target.value.trim();
      const counter = form && form.querySelector("small");
      if (counter) counter.textContent = `${target.value.length}/500 · Ctrl + Enter để gửi`;
    }
  }

  function sendReply(runtime, id) {
    const text = safeText(runtime.state.ui.replyDrafts[id] || "", 500).trim();
    if (!text) return;
    const item = updateItem(runtime, id, { preview: `Bạn: ${text}`, unread: false, timestamp: new Date().toISOString() });
    runtime.state.ui.replyDrafts[id] = "";
    dispatchAction(runtime, "message:reply", { id, conversationId: item && item.conversationId, text });
    persistAndRender(runtime, "Đã lưu trả lời cục bộ và gửi yêu cầu; chờ adapter xác nhận gửi.", id);
  }

  function handleSubmit(runtime, event) {
    const form = event.target && event.target.matches && event.target.matches("[data-hcc-reply-form]") ? event.target : null;
    if (!form) return;
    event.preventDefault();
    sendReply(runtime, form.dataset.hccReplyForm);
  }

  function handleKeydown(runtime, event) {
    const target = event.target;
    if (event.key === "/" && runtime.view === "unified-inbox" && !(target && /INPUT|TEXTAREA/.test(target.tagName || ""))) {
      event.preventDefault();
      runtime.host.querySelector && runtime.host.querySelector("[data-hcc-search]")?.focus();
      return;
    }
    if (target && target.matches && target.matches("[data-hcc-reply-draft]") && event.key === "Enter" && event.ctrlKey) {
      event.preventDefault();
      return sendReply(runtime, target.dataset.hccReplyDraft);
    }
    const row = target && target.closest ? target.closest("[data-hcc-row]") : null;
    if (!row) return;
    const rows = Array.from(runtime.host.querySelectorAll ? runtime.host.querySelectorAll("[data-hcc-row]") : []);
    const index = rows.indexOf(row);
    let nextIndex = index;
    if (event.key === "ArrowDown") nextIndex = Math.min(rows.length - 1, index + 1);
    else if (event.key === "ArrowUp") nextIndex = Math.max(0, index - 1);
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = rows.length - 1;
    else if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      const ids = new Set(runtime.state.ui.selectedIds);
      if (ids.has(row.dataset.hccRow)) ids.delete(row.dataset.hccRow); else ids.add(row.dataset.hccRow);
      runtime.state.ui.selectedIds = Array.from(ids);
      return persistAndRender(runtime, `${ids.size} mục đang được chọn.`, row.dataset.hccRow);
    } else if (event.key === "Enter") {
      event.preventDefault();
      runtime.state.ui.activeId = row.dataset.hccRow;
      updateItem(runtime, row.dataset.hccRow, { unread: false });
      return persistAndRender(runtime, "Đã mở mục trong hộp thư.", row.dataset.hccRow);
    } else return;
    event.preventDefault();
    const next = rows[nextIndex];
    if (next) {
      runtime.state.ui.activeId = next.dataset.hccRow;
      render(runtime, next.dataset.hccRow);
    }
  }

  function handleExternalData(runtime, event) {
    runtime.state = mergeAdapterData(runtime.state, event && event.detail);
    persistAndRender(runtime, isConfirmedAdapterPayload(event && event.detail)
      ? "Đã nhận cập nhật từ adapter đang kết nối."
      : "Đã nhận dữ liệu cục bộ; chưa có xác nhận kết nối realtime.");
  }

  function mount(host, options = {}) {
    if (!host) return null;
    unmount();
    const scope = options.scope || globalScope;
    const view = supports(options.view) ? options.view : "command-center";
    const runtime = { host, options: { ...options, view }, view, scope, state: loadState(scope), listeners: [] };
    const on = (target, type, handler) => {
      if (!target || typeof target.addEventListener !== "function") return;
      target.addEventListener(type, handler);
      runtime.listeners.push([target, type, handler]);
    };
    on(host, "click", (event) => handleClick(runtime, event));
    on(host, "change", (event) => handleChange(runtime, event));
    on(host, "input", (event) => handleInput(runtime, event));
    on(host, "submit", (event) => handleSubmit(runtime, event));
    on(host, "keydown", (event) => handleKeydown(runtime, event));
    on(scope, "hh:communication:data", (event) => handleExternalData(runtime, event));
    active = runtime;
    render(runtime);
    requestAdapterData(runtime);
    return { view, refresh: () => requestAdapterData(runtime), getState: () => normalizeState(runtime.state) };
  }

  function unmount() {
    if (!active) return false;
    active.listeners.forEach(([target, type, handler]) => {
      if (target && typeof target.removeEventListener === "function") target.removeEventListener(type, handler);
    });
    if (active.host) active.host.innerHTML = "";
    active = null;
    return true;
  }

  const publicApi = Object.freeze({ supports, mount, unmount });
  if (globalScope) globalScope.HHCommunicationCommandCenter = publicApi;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = Object.freeze({
      STORAGE_KEY, VERSION, VIEWS, supports, normalizeItem, normalizeState, isConfirmedAdapterPayload, mergeAdapterData,
      filteredItems, relativeTime, seedState, loadState, saveState, publicApi
    });
  }
})(typeof window !== "undefined" ? window : globalThis);
