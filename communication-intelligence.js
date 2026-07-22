(() => {
  "use strict";

  const STORAGE_KEY = "hh.communication.intelligence.v1";
  const VIEWS = new Set(["notifications", "universal-search", "smart-catch-up"]);
  const DAY = 86_400_000;

  const DEFAULT_NOTIFICATIONS = [
    {
      id: "welcome",
      source: "HH Platform",
      title: "Communication Intelligence đã sẵn sàng",
      message: "Bạn có thể lọc thông báo, tìm xuyên workspace và tóm tắt phần đã bỏ lỡ ngay trên thiết bị.",
      createdAt: Date.now(),
      read: false,
      priority: "important",
      type: "system",
      sender: "HH Platform",
      channel: "system"
    },
    {
      id: "community-tip",
      source: "Community",
      title: "Mẹo cho hộp thư hợp nhất",
      message: "Đánh dấu người quan trọng để thông báo của họ luôn nổi bật ngoài giờ yên lặng.",
      createdAt: Date.now() - 42 * 60_000,
      read: true,
      priority: "normal",
      type: "mention",
      sender: "HH Team",
      channel: "community"
    }
  ];

  const DEFAULT_INDEX = [
    { id: "channel-community", kind: "channel", title: "Community HH", excerpt: "Bảng tin và thảo luận cộng đồng", sender: "HH Team", workspace: "Giao tiếp", channelId: "community", route: "/communication/community", createdAt: Date.now() - DAY },
    { id: "user-owner", kind: "user", title: "Dung Nguyen", excerpt: "Chủ workspace HH", sender: "Dung Nguyen", workspace: "HH Platform", route: "/communication/user-dashboard", createdAt: Date.now() - DAY * 2 },
    { id: "file-guide", kind: "file", title: "Hướng dẫn Community", excerpt: "Tài liệu bắt đầu dành cho thành viên mới", sender: "HH Team", workspace: "Giao tiếp", channelId: "community", route: "/communication/community", createdAt: Date.now() - DAY * 3 },
    { id: "message-welcome", kind: "message", title: "Chào mừng đến HH Community", excerpt: "Kết nối, chia sẻ và cùng xây dựng hệ sinh thái HH.", sender: "HH Team", workspace: "Giao tiếp", channelId: "community", conversationId: "community", messageId: "message-welcome", reaction: "like", route: "/communication/community", createdAt: Date.now() - 90 * 60_000 }
  ];

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const uid = (prefix = "item") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[character]));
  const normalizeText = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi").trim();
  const asArray = (value) => Array.isArray(value) ? value : [];

  function createDefaultState() {
    return {
      version: 1,
      preferences: {
        quietHours: { enabled: false, start: "22:00", end: "07:00" },
        importantPeople: [],
        mutedChannels: [],
        digest: { enabled: false, cadence: "daily", time: "09:00", includeRead: false },
        pushStatus: "idle"
      },
      notifications: clone(DEFAULT_NOTIFICATIONS),
      notificationFilter: { status: "all", priority: "all", source: "all" },
      search: { query: "", sender: "", date: "all", type: "all", reaction: "", workspace: "all" },
      recentSearches: [],
      catchUpHistory: []
    };
  }

  function normalizeState(value) {
    const defaults = createDefaultState();
    const state = value && typeof value === "object" ? value : {};
    const preferences = state.preferences && typeof state.preferences === "object" ? state.preferences : {};
    const quietHours = preferences.quietHours && typeof preferences.quietHours === "object" ? preferences.quietHours : {};
    return {
      ...defaults,
      ...state,
      version: 1,
      preferences: {
        ...defaults.preferences,
        ...preferences,
        quietHours: { ...defaults.preferences.quietHours, ...quietHours },
        digest: {
          ...defaults.preferences.digest,
          ...(preferences.digest && typeof preferences.digest === "object" ? preferences.digest : {}),
          enabled: Boolean(preferences.digest?.enabled),
          cadence: preferences.digest?.cadence === "weekly" ? "weekly" : "daily",
          time: /^\d{2}:\d{2}$/.test(preferences.digest?.time || "") ? preferences.digest.time : "09:00",
          includeRead: Boolean(preferences.digest?.includeRead)
        },
        importantPeople: asArray(preferences.importantPeople).map(String).filter(Boolean).slice(0, 50),
        mutedChannels: asArray(preferences.mutedChannels).map(String).filter(Boolean).slice(0, 50)
      },
      notifications: Array.isArray(state.notifications) ? state.notifications.map(normalizeNotification).slice(0, 500) : clone(defaults.notifications),
      notificationFilter: { ...defaults.notificationFilter, ...(state.notificationFilter || {}) },
      search: { ...defaults.search, ...(state.search || {}) },
      recentSearches: asArray(state.recentSearches).map(String).filter(Boolean).slice(0, 12),
      catchUpHistory: asArray(state.catchUpHistory).slice(0, 20)
    };
  }

  function normalizeNotification(item, index = 0) {
    const source = String(item?.source || item?.workspace || "HH Platform");
    return {
      id: String(item?.id || item?._id || `notification-${index}`),
      source,
      title: String(item?.title || "Cập nhật mới"),
      message: String(item?.message || item?.body || ""),
      createdAt: Number(new Date(item?.createdAt || item?.time || Date.now())) || Date.now(),
      read: Boolean(item?.read),
      priority: ["important", "urgent"].includes(item?.priority) ? "important" : "normal",
      type: String(item?.type || "update"),
      sender: String(item?.sender || item?.author || source),
      channel: String(item?.channel || item?.channelId || source),
      snoozedUntil: Number(item?.snoozedUntil || 0),
      context: item?.context && typeof item.context === "object" ? item.context : {}
    };
  }

  function readState() {
    try {
      return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
    } catch {
      return createDefaultState();
    }
  }

  function writeState(state) {
    const normalized = normalizeState(state);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)); } catch { /* Storage can be unavailable in private mode. */ }
    return normalized;
  }

  function isQuietNow(preferences, date = new Date()) {
    if (!preferences?.quietHours?.enabled) return false;
    const toMinutes = (value) => {
      const [hours, minutes] = String(value || "00:00").split(":").map(Number);
      return Math.max(0, Math.min(1439, (hours || 0) * 60 + (minutes || 0)));
    };
    const now = date.getHours() * 60 + date.getMinutes();
    const start = toMinutes(preferences.quietHours.start);
    const end = toMinutes(preferences.quietHours.end);
    return start === end ? true : start < end ? now >= start && now < end : now >= start || now < end;
  }

  function visibleNotifications(state, now = Date.now()) {
    const filters = state.notificationFilter;
    const important = new Set(state.preferences.importantPeople.map(normalizeText));
    const muted = new Set(state.preferences.mutedChannels.map(normalizeText));
    return state.notifications
      .filter((item) => !item.snoozedUntil || item.snoozedUntil <= now)
      .filter((item) => filters.status === "all" || (filters.status === "unread" ? !item.read : item.read))
      .filter((item) => filters.priority === "all" || item.priority === filters.priority || (filters.priority === "important" && important.has(normalizeText(item.sender))))
      .filter((item) => filters.source === "all" || item.source === filters.source)
      .filter((item) => !muted.has(normalizeText(item.channel)) || important.has(normalizeText(item.sender)))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  function groupNotifications(items) {
    const groups = new Map();
    asArray(items).forEach((item) => {
      const day = new Date(item.createdAt).toISOString().slice(0, 10);
      const key = `${normalizeText(item.source)}:${normalizeText(item.type)}:${normalizeText(item.title)}:${day}`;
      const group = groups.get(key);
      if (!group) {
        groups.set(key, { ...item, ids: [item.id], count: 1 });
        return;
      }
      group.ids.push(item.id);
      group.count += 1;
      group.read = group.read && item.read;
      group.createdAt = Math.max(group.createdAt, item.createdAt);
      if (item.message && !group.message.includes(item.message)) group.message = `${group.message} · ${item.message}`;
    });
    return [...groups.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  function normalizeIndexItem(item, index = 0) {
    const kind = ["message", "file", "user", "channel", "thread", "comment", "ticket"].includes(item?.kind || item?.type)
      ? (item.kind || item.type)
      : "message";
    return {
      id: String(item?.id || item?._id || `index-${index}`),
      kind,
      title: String(item?.title || item?.name || item?.filename || item?.message || "Kết quả giao tiếp"),
      excerpt: String(item?.excerpt || item?.message || item?.description || item?.content || ""),
      sender: String(item?.sender || item?.author || item?.owner || ""),
      workspace: String(item?.workspace || item?.workspaceName || "Giao tiếp"),
      reaction: String(item?.reaction || asArray(item?.reactions)[0]?.emoji || ""),
      createdAt: Number(new Date(item?.createdAt || item?.updatedAt || Date.now())) || Date.now(),
      route: String(item?.route || "/communication/community"),
      workspaceId: String(item?.workspaceId || ""),
      channelId: String(item?.channelId || item?.channel || ""),
      conversationId: String(item?.conversationId || item?.roomId || ""),
      messageId: String(item?.messageId || (kind === "message" ? item?.id || "" : "")),
      threadId: String(item?.threadId || ""),
      timestamp: Number(item?.timestamp || item?.createdAt || 0) || 0
    };
  }

  const SEMANTIC_GROUPS = Object.freeze([
    ["duyet", "phe duyet", "xac nhan", "chot", "approve", "approval"],
    ["hop", "meeting", "call", "cuoc goi", "phong truc tiep", "live room"],
    ["thiet ke", "thiet", "ke", "design", "giao dien", "ui", "brand", "logo"],
    ["am thanh", "audio", "nhac", "voice", "giong noi", "mix", "master"],
    ["cong viec", "task", "todo", "viec can lam", "action item"],
    ["han", "deadline", "due", "ngay mai", "lich"],
    ["loi", "bug", "error", "su co", "ticket", "ho tro"],
    ["tep", "file", "tai lieu", "document", "asset"]
  ]);

  function semanticVariants(term) {
    const normalized = normalizeText(term);
    const group = SEMANTIC_GROUPS.find((entries) => entries.some((entry) => normalized === entry || entry.includes(normalized) || normalized.includes(entry)));
    return group ? [...new Set([normalized, ...group])] : [normalized];
  }

  function semanticMatch(item, query) {
    const normalized = normalizeIndexItem(item);
    const terms = normalizeText(query).split(/[^a-z0-9]+/).filter((term) => term.length > 1);
    if (!terms.length) return { matches: true, score: 0, matchedTerms: [] };
    const fields = [
      [normalizeText(normalized.title), 6],
      [normalizeText(normalized.excerpt), 3],
      [normalizeText(normalized.sender), 2],
      [normalizeText(`${normalized.workspace} ${normalized.kind}`), 1]
    ];
    const matchedTerms = [];
    let score = 0;
    for (const term of terms) {
      const variants = semanticVariants(term);
      let best = 0;
      let matched = "";
      for (const variant of variants) {
        for (const [field, weight] of fields) {
          if (!field.includes(variant)) continue;
          const exactBonus = variant === term ? 2 : 0;
          if (weight + exactBonus > best) { best = weight + exactBonus; matched = variant; }
        }
      }
      if (!best) return { matches: false, score: 0, matchedTerms: [] };
      score += best;
      matchedTerms.push(matched);
    }
    return { matches: true, score, matchedTerms };
  }

  function filterIndex(items, filters = {}) {
    const sender = normalizeText(filters.sender);
    const reaction = normalizeText(filters.reaction);
    const now = Date.now();
    const dateLimit = filters.date === "today" ? now - DAY : filters.date === "7d" ? now - DAY * 7 : filters.date === "30d" ? now - DAY * 30 : 0;
    return asArray(items).map(normalizeIndexItem).map((item) => ({ item, semantic: semanticMatch(item, filters.query) })).filter(({ item, semantic }) => {
      return semantic.matches
        && (!sender || normalizeText(item.sender).includes(sender))
        && (!reaction || normalizeText(item.reaction).includes(reaction))
        && (!filters.type || filters.type === "all" || item.kind === filters.type)
        && (!filters.workspace || filters.workspace === "all" || item.workspace === filters.workspace)
        && (!dateLimit || item.createdAt >= dateLimit);
    }).sort((a, b) => b.semantic.score - a.semantic.score || b.item.createdAt - a.item.createdAt).map(({ item }) => item);
  }

  function buildNotificationDigest(state, now = Date.now()) {
    const normalized = normalizeState(state);
    const preferences = normalized.preferences.digest;
    const windowMs = preferences.cadence === "weekly" ? DAY * 7 : DAY;
    const scoped = {
      ...normalized,
      notificationFilter: { status: preferences.includeRead ? "all" : "unread", priority: "all", source: "all" }
    };
    const items = visibleNotifications(scoped, now).filter((item) => item.createdAt >= now - windowMs);
    const sources = new Map();
    items.forEach((item) => sources.set(item.source, (sources.get(item.source) || 0) + 1));
    return {
      label: "DIGEST CỤC BỘ",
      generatedAt: now,
      cadence: preferences.cadence,
      total: items.length,
      unread: items.filter((item) => !item.read).length,
      important: items.filter((item) => item.priority === "important").length,
      sources: [...sources.entries()].sort((a, b) => b[1] - a[1]).map(([source, count]) => ({ source, count })),
      items: items.slice(0, 8)
    };
  }

  function normalizeCatchUpAdapterResult(remote) {
    if (!remote || remote.ok !== true || remote.connected !== true || !Array.isArray(remote.summary)) return null;
    const bounded = (items, limit) => asArray(items).map((item) => String(item).slice(0, 600)).filter(Boolean).slice(0, limit);
    return {
      summary: bounded(remote.summary, 8),
      decisions: bounded(remote.decisions, 5),
      actions: bounded(remote.actions, 7),
      participants: bounded(remote.participants, 12),
      sourceCount: Math.max(0, Math.min(1000, Number(remote.sourceCount) || 0)),
      label: remote.ai === true && remote.provider
        ? `BẢN AI · ${String(remote.provider).slice(0, 60).toUpperCase()}`
        : "TÓM TẮT TỪ MÁY CHỦ ĐÃ XÁC NHẬN"
    };
  }

  function splitSentences(text) {
    return String(text || "").replace(/\s+/g, " ").trim().split(/(?<=[.!?…])\s+|\n+/).map((item) => item.trim()).filter((item) => item.length > 12);
  }

  function summarizeExtractive(input, maxSentences = 5) {
    const records = Array.isArray(input) ? input : [{ text: input }];
    const sentences = records.flatMap((record, recordIndex) => splitSentences(record?.text || record?.message || record?.content || "").map((text, sentenceIndex) => ({
      text,
      recordIndex,
      sentenceIndex,
      createdAt: Number(new Date(record?.createdAt || Date.now())) || Date.now(),
      sender: String(record?.sender || record?.author || "")
    })));
    if (!sentences.length) return { summary: [], decisions: [], actions: [], participants: [], sourceCount: records.length };
    const stopWords = new Set("và là có của cho trong một những được với khi đã đang này đó từ tại thì hoặc nhưng để về trên dưới cũng sẽ tôi bạn chúng ta".split(" "));
    const frequencies = new Map();
    sentences.forEach(({ text }) => normalizeText(text).split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !stopWords.has(word)).forEach((word) => frequencies.set(word, (frequencies.get(word) || 0) + 1)));
    const newest = Math.max(...sentences.map((item) => item.createdAt));
    const scored = sentences.map((item, index) => {
      const words = normalizeText(item.text).split(/[^a-z0-9]+/).filter(Boolean);
      const keywordScore = words.reduce((sum, word) => sum + (frequencies.get(word) || 0), 0) / Math.max(8, words.length);
      const recency = Math.max(0, 1 - (newest - item.createdAt) / (DAY * 7));
      const intent = /\b(cần|sẽ|hãy|việc|deadline|quyết định|thống nhất|chốt|todo|task)\b/i.test(item.text) ? 1.2 : 0;
      return { ...item, index, score: keywordScore + recency + intent };
    });
    const picked = scored.sort((a, b) => b.score - a.score || a.index - b.index).slice(0, Math.max(1, Math.min(8, maxSentences))).sort((a, b) => a.index - b.index);
    return {
      summary: picked.map((item) => item.text),
      decisions: sentences.filter((item) => /\b(quyết định|thống nhất|chốt|đồng ý)\b/i.test(item.text)).slice(0, 5).map((item) => item.text),
      actions: sentences.filter((item) => /\b(cần|hãy|sẽ|todo|task|deadline|phụ trách)\b/i.test(item.text)).slice(0, 7).map((item) => item.text),
      participants: [...new Set(records.map((record) => String(record?.sender || record?.author || "").trim()).filter(Boolean))].slice(0, 12),
      sourceCount: records.length
    };
  }

  function relativeTime(value) {
    const difference = Date.now() - Number(value || Date.now());
    if (difference < 60_000) return "Vừa xong";
    if (difference < 3_600_000) return `${Math.floor(difference / 60_000)} phút trước`;
    if (difference < DAY) return `${Math.floor(difference / 3_600_000)} giờ trước`;
    return new Date(value).toLocaleDateString("vi-VN");
  }

  function iconFor(kind) {
    return ({ message: "M", file: "F", user: "U", channel: "#", thread: "T", comment: "C", ticket: "?" })[kind] || "•";
  }

  function sourceOptions(state) {
    return [...new Set(state.notifications.map((item) => item.source))].sort().map((source) => `<option value="${escapeHtml(source)}"${state.notificationFilter.source === source ? " selected" : ""}>${escapeHtml(source)}</option>`).join("");
  }

  function tabs(view) {
    return `<nav class="hci-tabs" aria-label="Communication Intelligence">
      <button type="button" data-hci-view="notifications"${view === "notifications" ? ' aria-current="page"' : ""}><span aria-hidden="true">◉</span>Thông báo</button>
      <button type="button" data-hci-view="universal-search"${view === "universal-search" ? ' aria-current="page"' : ""}><span aria-hidden="true">⌕</span>Tìm kiếm</button>
      <button type="button" data-hci-view="smart-catch-up"${view === "smart-catch-up" ? ' aria-current="page"' : ""}><span aria-hidden="true">✦</span>Catch-up</button>
    </nav>`;
  }

  function digestMarkup(digest) {
    if (!digest) return '<div class="hci-digest-preview"><p>Tạo bản xem trước để gom các cập nhật phù hợp ngay trên thiết bị.</p></div>';
    return `<section class="hci-digest-preview" aria-live="polite"><header><b>${escapeHtml(digest.label)}</b><span>${digest.total} mục · ${digest.important} quan trọng</span></header>${digest.items.length ? `<ol>${digest.items.slice(0, 4).map((item) => `<li><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.source)}</span></li>`).join("")}</ol>` : "<p>Không có cập nhật phù hợp trong kỳ này.</p>"}<small>Không tự gửi ra ngoài thiết bị.</small></section>`;
  }

  function notificationMarkup(state, digest = null) {
    const visible = groupNotifications(visibleNotifications(state));
    const unread = state.notifications.filter((item) => !item.read).length;
    const quiet = isQuietNow(state.preferences);
    return `<section class="hci-panel hci-notifications" data-hci-panel="notifications">
      <header class="hci-section-head"><div><span>SMART NOTIFICATIONS</span><h2>Không bỏ lỡ điều quan trọng</h2><p>Nhóm cập nhật, giảm nhiễu và ưu tiên đúng người. Mọi thiết lập được lưu trên thiết bị này.</p></div><div class="hci-head-status"><b>${unread}</b><span>chưa đọc</span><i class="${quiet ? "is-quiet" : ""}">${quiet ? "Đang giờ yên lặng" : "Đang nhận bình thường"}</i></div></header>
      <div class="hci-toolbar" aria-label="Lọc thông báo">
        <label><span>Trạng thái</span><select data-hci-notification-filter="status"><option value="all">Tất cả</option><option value="unread"${state.notificationFilter.status === "unread" ? " selected" : ""}>Chưa đọc</option><option value="read"${state.notificationFilter.status === "read" ? " selected" : ""}>Đã đọc</option></select></label>
        <label><span>Ưu tiên</span><select data-hci-notification-filter="priority"><option value="all">Mọi mức</option><option value="important"${state.notificationFilter.priority === "important" ? " selected" : ""}>Quan trọng</option><option value="normal"${state.notificationFilter.priority === "normal" ? " selected" : ""}>Thông thường</option></select></label>
        <label><span>Nguồn</span><select data-hci-notification-filter="source"><option value="all">Mọi nguồn</option>${sourceOptions(state)}</select></label>
        <button type="button" data-hci-read-all>Đọc tất cả</button><button class="hci-primary" type="button" data-hci-push>Cho phép Push</button>
      </div>
      <div class="hci-notification-layout">
        <div class="hci-notification-list" role="feed" aria-label="Thông báo">${visible.map((item) => `<article class="hci-notification${item.read ? " is-read" : ""}${item.priority === "important" ? " is-important" : ""}" data-hci-notification-id="${escapeHtml(item.id)}" tabindex="0">
          <span class="hci-source-avatar" aria-hidden="true">${escapeHtml(item.source.slice(0, 2).toUpperCase())}</span><div><header><strong>${escapeHtml(item.title)}${item.count > 1 ? ` <span aria-label="${item.count} thông báo">×${item.count}</span>` : ""}</strong><time datetime="${new Date(item.createdAt).toISOString()}">${relativeTime(item.createdAt)}</time></header><p>${escapeHtml(item.message)}</p><footer><span>${escapeHtml(item.source)}</span><span>${escapeHtml(item.type)}</span>${item.priority === "important" ? "<b>Ưu tiên</b>" : ""}</footer></div>
          <menu><button type="button" data-hci-toggle-read="${escapeHtml(encodeURIComponent(JSON.stringify(item.ids)))}">${item.read ? "Chưa đọc" : "Đã đọc"}</button><button type="button" data-hci-snooze="${escapeHtml(encodeURIComponent(JSON.stringify(item.ids)))}">Nhắc sau 1 giờ</button></menu>
        </article>`).join("") || '<div class="hci-empty"><span>✓</span><h3>Đã xử lý hết</h3><p>Không có thông báo phù hợp bộ lọc hiện tại.</p></div>'}</div>
        <aside class="hci-preferences"><header><span>QUY TẮC CỦA BẠN</span><h3>Tập trung mà vẫn kết nối</h3></header>
          <label class="hci-switch"><input type="checkbox" data-hci-quiet-enabled${state.preferences.quietHours.enabled ? " checked" : ""}><span>Bật giờ yên lặng</span></label>
          <div class="hci-time-grid"><label><span>Từ</span><input type="time" data-hci-quiet-start value="${escapeHtml(state.preferences.quietHours.start)}"></label><label><span>Đến</span><input type="time" data-hci-quiet-end value="${escapeHtml(state.preferences.quietHours.end)}"></label></div>
          <label><span>Người quan trọng</span><input type="text" data-hci-important value="${escapeHtml(state.preferences.importantPeople.join(", "))}" placeholder="Tên, cách nhau bằng dấu phẩy"></label>
          <label><span>Channel đã tắt</span><input type="text" data-hci-muted value="${escapeHtml(state.preferences.mutedChannels.join(", "))}" placeholder="general, music..."></label>
          <fieldset class="hci-digest-settings"><legend>Notification digest</legend><label class="hci-switch"><input type="checkbox" data-hci-digest-enabled${state.preferences.digest.enabled ? " checked" : ""}><span>Bật lịch digest</span></label><div><label><span>Chu kỳ</span><select data-hci-digest-cadence><option value="daily"${state.preferences.digest.cadence === "daily" ? " selected" : ""}>Hằng ngày</option><option value="weekly"${state.preferences.digest.cadence === "weekly" ? " selected" : ""}>Hằng tuần</option></select></label><label><span>Giờ</span><input type="time" data-hci-digest-time value="${escapeHtml(state.preferences.digest.time)}"></label></div><label class="hci-switch"><input type="checkbox" data-hci-digest-include-read${state.preferences.digest.includeRead ? " checked" : ""}><span>Gồm mục đã đọc</span></label><button type="button" data-hci-preview-digest>Tạo digest cục bộ</button></fieldset>
          ${digestMarkup(digest)}
          <button type="button" data-hci-save-preferences>Lưu quy tắc</button><p data-hci-push-status>${escapeHtml(pushStatusText(state.preferences.pushStatus))}</p>
        </aside>
      </div>
    </section>`;
  }

  function searchMarkup(state, items) {
    const results = filterIndex(items, state.search);
    const workspaces = [...new Set(items.map((item) => normalizeIndexItem(item).workspace))].sort();
    return `<section class="hci-panel hci-search" data-hci-panel="universal-search">
      <header class="hci-section-head"><div><span>UNIVERSAL SEMANTIC SEARCH</span><h2>Tìm đúng ngữ cảnh, mở đúng vị trí</h2><p>Tìm tin nhắn, tệp, người dùng, channel và thread bằng điểm liên quan cùng nhóm khái niệm cục bộ. Không dùng AI khi chưa có adapter xác nhận.</p></div><div class="hci-index-health"><i></i><b>${items.length}</b><span>mục đã lập chỉ mục</span></div></header>
      <form class="hci-search-form" data-hci-search-form><label><span aria-hidden="true">⌕</span><input type="search" data-hci-search-query value="${escapeHtml(state.search.query)}" placeholder="Tìm nội dung, người gửi hoặc workspace..." autocomplete="off"><kbd>Enter</kbd></label><button class="hci-primary" type="submit">Tìm kiếm</button></form>
      <div class="hci-search-filters">
        <label><span>Người gửi</span><input type="text" data-hci-search-filter="sender" value="${escapeHtml(state.search.sender)}" placeholder="Tên thành viên"></label>
        <label><span>Thời gian</span><select data-hci-search-filter="date"><option value="all">Mọi thời gian</option><option value="today"${state.search.date === "today" ? " selected" : ""}>Hôm nay</option><option value="7d"${state.search.date === "7d" ? " selected" : ""}>7 ngày</option><option value="30d"${state.search.date === "30d" ? " selected" : ""}>30 ngày</option></select></label>
        <label><span>Loại</span><select data-hci-search-filter="type"><option value="all">Tất cả</option>${["message", "file", "user", "channel", "thread", "comment", "ticket"].map((type) => `<option value="${type}"${state.search.type === type ? " selected" : ""}>${type}</option>`).join("")}</select></label>
        <label><span>Reaction</span><input type="text" data-hci-search-filter="reaction" value="${escapeHtml(state.search.reaction)}" placeholder="like, ❤️..."></label>
        <label><span>Workspace</span><select data-hci-search-filter="workspace"><option value="all">Mọi workspace</option>${workspaces.map((workspace) => `<option value="${escapeHtml(workspace)}"${state.search.workspace === workspace ? " selected" : ""}>${escapeHtml(workspace)}</option>`).join("")}</select></label>
      </div>
      <div class="hci-search-meta"><span><b>${results.length}</b> kết quả</span><button type="button" data-hci-refresh-index>Đồng bộ chỉ mục</button></div>
      <div class="hci-results" role="list" aria-live="polite">${results.map((item) => `<button class="hci-result" type="button" role="listitem" data-hci-result="${escapeHtml(item.id)}"><span class="hci-kind" aria-hidden="true">${iconFor(item.kind)}</span><div><header><strong>${escapeHtml(item.title)}</strong><time>${relativeTime(item.createdAt)}</time></header><p>${escapeHtml(item.excerpt)}</p><footer><span>${escapeHtml(item.kind)}</span>${item.sender ? `<span>${escapeHtml(item.sender)}</span>` : ""}<span>${escapeHtml(item.workspace)}</span>${item.channelId ? `<span>#${escapeHtml(item.channelId)}</span>` : ""}</footer></div><i aria-hidden="true">→</i></button>`).join("") || '<div class="hci-empty"><span>⌕</span><h3>Chưa có kết quả</h3><p>Đổi từ khóa hoặc bộ lọc, rồi thử lại.</p></div>'}</div>
      ${state.recentSearches.length ? `<aside class="hci-recent-searches"><span>Tìm gần đây</span>${state.recentSearches.map((query) => `<button type="button" data-hci-recent-query="${escapeHtml(query)}">${escapeHtml(query)}</button>`).join("")}</aside>` : ""}
    </section>`;
  }

  function catchUpMarkup(state, result = null, status = "") {
    return `<section class="hci-panel hci-catch-up" data-hci-panel="smart-catch-up">
      <header class="hci-section-head"><div><span>SMART CATCH-UP</span><h2>Nắm lại cuộc trò chuyện theo cách minh bạch</h2><p>Bộ tóm tắt cục bộ chọn câu quan trọng theo từ khóa, ý định và thời gian. Đây không phải AI.</p></div><div class="hci-local-badge"><i></i><b>Xử lý cục bộ</b><span>Không gửi nội dung đi</span></div></header>
      <div class="hci-catch-layout"><form data-hci-catch-form><label><span>Nội dung cần nắm lại</span><textarea rows="13" data-hci-catch-input placeholder="Dán đoạn chat hoặc ghi chú cuộc họp, mỗi tin nhắn có thể nằm trên một dòng..."></textarea></label><div><label><span>Số ý chính</span><select data-hci-catch-count><option value="3">3 ý</option><option value="5" selected>5 ý</option><option value="7">7 ý</option></select></label><button type="button" data-hci-catch-index>Dùng dữ liệu đã lập chỉ mục</button><button class="hci-primary" type="submit">Tạo Catch-up</button></div><small>HH chỉ xử lý phần bạn chủ động dán hoặc chọn trong chỉ mục giao tiếp.</small></form>
        <div class="hci-catch-output" aria-live="polite">${result ? catchUpResultMarkup(result) : `<div class="hci-empty"><span>✦</span><h3>Bản tóm tắt sẽ xuất hiện ở đây</h3><p>Ý chính, quyết định và việc cần làm được tách riêng để dễ theo dõi.</p></div>`}<p class="hci-catch-status">${escapeHtml(status)}</p></div></div>
      ${state.catchUpHistory.length ? `<section class="hci-catch-history"><header><span>Lịch sử trên thiết bị</span><button type="button" data-hci-clear-catch-history>Xóa lịch sử</button></header>${state.catchUpHistory.slice(0, 5).map((item) => `<button type="button" data-hci-history-id="${escapeHtml(item.id)}"><span>${escapeHtml(item.label || "Bản tóm tắt cục bộ")}</span><strong>${escapeHtml(item.summary?.[0] || "Không có nội dung")}</strong><time>${relativeTime(item.createdAt)}</time></button>`).join("")}</section>` : ""}
    </section>`;
  }

  function catchUpResultMarkup(result) {
    const list = (items, empty) => asArray(items).length ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p>${empty}</p>`;
    return `<article class="hci-summary"><header><div><span>${escapeHtml(result.label || "TÓM TẮT CỤC BỘ · KHÔNG PHẢI AI")}</span><h3>Những điều cần biết</h3></div><button type="button" data-hci-copy-summary>Sao chép</button></header>${list(result.summary, "Chưa đủ nội dung để tạo ý chính.")}<div class="hci-summary-grid"><section><h4>Quyết định</h4>${list(result.decisions, "Không phát hiện câu quyết định rõ ràng.")}</section><section><h4>Việc cần làm</h4>${list(result.actions, "Không phát hiện việc cần làm rõ ràng.")}</section></div><footer><span>${Number(result.sourceCount || 0)} nguồn</span>${asArray(result.participants).length ? `<span>${result.participants.length} người tham gia</span>` : ""}</footer></article>`;
  }

  function pushStatusText(status) {
    return ({ granted: "Quyền thông báo đã được cấp. Đăng ký máy chủ cần cấu hình Push riêng.", denied: "Bạn đã chặn thông báo trong trình duyệt.", unsupported: "Trình duyệt này không hỗ trợ Push API.", insecure: "Push chỉ hoạt động trên HTTPS hoặc localhost.", idle: "HH chỉ hỏi quyền khi bạn bấm “Cho phép Push”." })[status] || "Trạng thái Push chưa xác định.";
  }

  async function requestIndex(options = {}) {
    const collected = [];
    const addItems = (items) => collected.push(...asArray(items));
    if (typeof options.getIndex === "function") {
      try { addItems(await options.getIndex()); } catch { /* Keep local index available. */ }
    }
    window.dispatchEvent(new CustomEvent("hh:communication:index-request", { detail: { addItems, respond: addItems } }));
    await new Promise((resolve) => window.setTimeout(resolve, 40));
    const unique = new Map([...DEFAULT_INDEX, ...collected].map((item, index) => {
      const normalized = normalizeIndexItem(item, index);
      return [`${normalized.kind}:${normalized.id}`, normalized];
    }));
    return [...unique.values()];
  }

  function jumpTo(item) {
    const detail = {
      id: item.id,
      kind: item.kind,
      route: item.route,
      workspaceId: item.workspaceId,
      channelId: item.channelId,
      conversationId: item.conversationId,
      messageId: item.messageId,
      threadId: item.threadId,
      timestamp: item.timestamp || item.createdAt
    };
    window.dispatchEvent(new CustomEvent("hh:communication:jump", { detail }));
  }

  let activeSession = null;

  async function mount(host, options = {}) {
    if (!host) return;
    unmount();
    const view = VIEWS.has(options.view) ? options.view : "notifications";
    let state = readState();
    let index = await requestIndex(options);
    let catchUpResult = null;
    let digestPreview = null;
    const session = { host, options, view, index, listeners: [] };
    activeSession = session;

    const render = () => {
      if (activeSession !== session) return;
      host.innerHTML = `<section class="hci-shell" data-hci-shell data-view="${session.view}"><header class="hci-hero"><div class="hci-brand"><span aria-hidden="true">CI</span><div><small>HH COMMUNICATION INTELLIGENCE</small><h1>Thông tin đúng lúc, đúng ngữ cảnh.</h1></div></div><p>Thông báo thông minh, tìm kiếm xuyên workspace và Catch-up minh bạch trong một nơi.</p></header>${tabs(session.view)}${session.view === "notifications" ? notificationMarkup(state, digestPreview) : session.view === "universal-search" ? searchMarkup(state, index) : catchUpMarkup(state, catchUpResult, session.status || "")}</section>`;
    };

    const navigate = (next) => {
      if (!VIEWS.has(next)) return;
      if (typeof options.onNavigate === "function") options.onNavigate(next);
      else { session.view = next; render(); }
    };

    const savePreferenceList = (selector) => (host.querySelector(selector)?.value || "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 50);

    const onClick = async (event) => {
      const viewButton = event.target.closest("[data-hci-view]");
      if (viewButton) return navigate(viewButton.dataset.hciView);
      if (event.target.closest("[data-hci-read-all]")) {
        state.notifications = state.notifications.map((item) => ({ ...item, read: true })); state = writeState(state); return render();
      }
      const readButton = event.target.closest("[data-hci-toggle-read]");
      if (readButton) {
        const ids = new Set(JSON.parse(decodeURIComponent(readButton.dataset.hciToggleRead)));
        const shouldRead = state.notifications.filter((item) => ids.has(item.id)).some((item) => !item.read);
        state.notifications = state.notifications.map((item) => ids.has(item.id) ? { ...item, read: shouldRead } : item); state = writeState(state); return render();
      }
      const snoozeButton = event.target.closest("[data-hci-snooze]");
      if (snoozeButton) {
        const ids = new Set(JSON.parse(decodeURIComponent(snoozeButton.dataset.hciSnooze)));
        state.notifications = state.notifications.map((item) => ids.has(item.id) ? { ...item, snoozedUntil: Date.now() + 3_600_000 } : item); state = writeState(state); return render();
      }
      if (event.target.closest("[data-hci-save-preferences]")) {
        state.preferences.quietHours = { enabled: Boolean(host.querySelector("[data-hci-quiet-enabled]")?.checked), start: host.querySelector("[data-hci-quiet-start]")?.value || "22:00", end: host.querySelector("[data-hci-quiet-end]")?.value || "07:00" };
        state.preferences.importantPeople = savePreferenceList("[data-hci-important]");
        state.preferences.mutedChannels = savePreferenceList("[data-hci-muted]");
        state.preferences.digest = {
          enabled: Boolean(host.querySelector("[data-hci-digest-enabled]")?.checked),
          cadence: host.querySelector("[data-hci-digest-cadence]")?.value === "weekly" ? "weekly" : "daily",
          time: host.querySelector("[data-hci-digest-time]")?.value || "09:00",
          includeRead: Boolean(host.querySelector("[data-hci-digest-include-read]")?.checked)
        };
        state = writeState(state); return render();
      }
      if (event.target.closest("[data-hci-preview-digest]")) {
        digestPreview = buildNotificationDigest(state);
        window.dispatchEvent(new CustomEvent("hh:communication:notification-digest", { detail: { generatedAt: digestPreview.generatedAt, cadence: digestPreview.cadence, total: digestPreview.total, unread: digestPreview.unread, important: digestPreview.important, localOnly: true } }));
        return render();
      }
      if (event.target.closest("[data-hci-push]")) {
        if (!window.isSecureContext) state.preferences.pushStatus = "insecure";
        else if (!("Notification" in window) || !("PushManager" in window) || !("serviceWorker" in navigator)) state.preferences.pushStatus = "unsupported";
        else {
          try {
            const permission = await Notification.requestPermission();
            state.preferences.pushStatus = permission === "granted" ? "granted" : "denied";
            window.dispatchEvent(new CustomEvent("hh:communication:push-permission", { detail: { permission } }));
          } catch { state.preferences.pushStatus = "unsupported"; }
        }
        state = writeState(state); return render();
      }
      const resultButton = event.target.closest("[data-hci-result]");
      if (resultButton) {
        const item = index.find((candidate) => candidate.id === resultButton.dataset.hciResult);
        if (item) jumpTo(item);
        return;
      }
      const recentButton = event.target.closest("[data-hci-recent-query]");
      if (recentButton) { state.search.query = recentButton.dataset.hciRecentQuery; state = writeState(state); return render(); }
      if (event.target.closest("[data-hci-refresh-index]")) { index = await requestIndex(options); return render(); }
      if (event.target.closest("[data-hci-catch-index]")) {
        const input = host.querySelector("[data-hci-catch-input]");
        input.value = index.filter((item) => item.kind === "message" || item.kind === "comment").slice(0, 100).map((item) => `${item.sender ? `${item.sender}: ` : ""}${item.excerpt || item.title}`).join("\n");
        input.focus(); return;
      }
      const historyButton = event.target.closest("[data-hci-history-id]");
      if (historyButton) { catchUpResult = state.catchUpHistory.find((item) => item.id === historyButton.dataset.hciHistoryId) || null; return render(); }
      if (event.target.closest("[data-hci-clear-catch-history]")) { state.catchUpHistory = []; state = writeState(state); catchUpResult = null; return render(); }
      if (event.target.closest("[data-hci-copy-summary]") && catchUpResult) {
        const text = [...catchUpResult.summary, ...catchUpResult.decisions.map((item) => `Quyết định: ${item}`), ...catchUpResult.actions.map((item) => `Việc cần làm: ${item}`)].join("\n");
        try { await navigator.clipboard.writeText(text); session.status = "Đã sao chép bản Catch-up."; } catch { session.status = "Không thể truy cập clipboard. Hãy sao chép thủ công."; }
        return render();
      }
    };

    const onChange = (event) => {
      const filter = event.target.closest("[data-hci-notification-filter]");
      if (filter) { state.notificationFilter[filter.dataset.hciNotificationFilter] = filter.value; state = writeState(state); return render(); }
      const searchFilter = event.target.closest("[data-hci-search-filter]");
      if (searchFilter) { state.search[searchFilter.dataset.hciSearchFilter] = searchFilter.value; state = writeState(state); return render(); }
    };

    const onSubmit = async (event) => {
      if (event.target.matches("[data-hci-search-form]")) {
        event.preventDefault();
        state.search.query = host.querySelector("[data-hci-search-query]")?.value.trim() || "";
        if (state.search.query) state.recentSearches = [state.search.query, ...state.recentSearches.filter((item) => item !== state.search.query)].slice(0, 12);
        state = writeState(state); return render();
      }
      if (event.target.matches("[data-hci-catch-form]")) {
        event.preventDefault();
        const text = host.querySelector("[data-hci-catch-input]")?.value.trim() || "";
        if (!text) { session.status = "Hãy dán nội dung hoặc chọn dữ liệu đã lập chỉ mục."; return render(); }
        const count = Number(host.querySelector("[data-hci-catch-count]")?.value || 5);
        session.status = "Đang tạo bản tóm tắt minh bạch..."; render();
        let result = null;
        if (typeof options.catchUpAdapter === "function") {
          try {
            const remote = await options.catchUpAdapter({ text, count });
            result = normalizeCatchUpAdapterResult(remote);
            if (!result) session.status = "Adapter chưa xác nhận kết nối; HH đã chuyển sang tóm tắt cục bộ.";
          } catch { session.status = "Máy chủ không khả dụng; HH đã chuyển sang bộ tóm tắt cục bộ."; }
        }
        if (!result) result = { ...summarizeExtractive(text, count), label: "TÓM TẮT CỤC BỘ · KHÔNG PHẢI AI" };
        catchUpResult = { ...result, id: uid("catchup"), createdAt: Date.now() };
        state.catchUpHistory = [catchUpResult, ...state.catchUpHistory].slice(0, 20);
        state = writeState(state);
        session.status = result.label.startsWith("TÓM TẮT CỤC BỘ") ? "Đã xử lý hoàn toàn trên thiết bị." : "Đã nhận kết quả từ adapter được cấu hình.";
        return render();
      }
    };

    const onNotification = (event) => {
      const incoming = event.detail;
      if (!incoming || typeof incoming !== "object") return;
      state.notifications = [normalizeNotification({ ...incoming, id: incoming.id || uid("notification") }), ...state.notifications].slice(0, 500);
      state = writeState(state);
      if (session.view === "notifications") render();
    };

    host.addEventListener("click", onClick);
    host.addEventListener("change", onChange);
    host.addEventListener("submit", onSubmit);
    window.addEventListener("hh:communication:notification", onNotification);
    session.listeners.push([host, "click", onClick], [host, "change", onChange], [host, "submit", onSubmit], [window, "hh:communication:notification", onNotification]);
    render();
  }

  function unmount() {
    if (!activeSession) return;
    activeSession.listeners.forEach(([target, type, listener]) => target.removeEventListener(type, listener));
    activeSession = null;
  }

  const api = {
    mount,
    unmount,
    summarizeExtractive,
    filterIndex,
    semanticMatch,
    buildNotificationDigest,
    normalizeCatchUpAdapterResult,
    visibleNotifications,
    groupNotifications,
    normalizeState,
    normalizeIndexItem,
    isQuietNow,
    storageKey: STORAGE_KEY
  };
  window.HHCommunicationIntelligence = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
