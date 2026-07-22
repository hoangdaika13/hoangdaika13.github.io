(() => {
  "use strict";

  const STORAGE_KEY = "hh.communication.channels.v1";
  const SCHEMA_VERSION = 1;
  const VIEWS = new Set(["channels", "forum", "onboarding", "moderation"]);
  const ROLE_LABELS = {
    owner: "Owner",
    admin: "Admin",
    moderator: "Moderator",
    member: "Member",
    guest: "Guest"
  };
  const PERMISSIONS = {
    owner: ["read", "post", "reply", "manage-channel", "moderate", "manage-role", "view-audit"],
    admin: ["read", "post", "reply", "manage-channel", "moderate", "manage-role", "view-audit"],
    moderator: ["read", "post", "reply", "moderate", "view-audit"],
    member: ["read", "post", "reply"],
    guest: ["read", "reply"]
  };
  const TYPE_LABELS = { public: "Công khai", private: "Riêng tư", shared: "Chia sẻ" };
  const TYPE_ICONS = { public: "#", private: "◆", shared: "↗" };
  const INTERESTS = ["AI & Công nghệ", "Thiết kế", "Âm nhạc", "Học tập", "Công việc", "Phát triển web"];
  const PERSONAS = ["Người sáng tạo", "Học sinh / sinh viên", "Chuyên gia", "Thành viên cộng đồng"];
  const SHORTENER_HOSTS = new Set(["bit.ly", "tinyurl.com", "t.co", "cutt.ly", "is.gd"]);
  let runtime = null;

  const nowIso = () => new Date().toISOString();
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[character]));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const formatTime = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Vừa xong" : date.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };
  const normalizeView = (view) => {
    const name = String(view || "channels").replace(/^#?\/?/, "").split("/").filter(Boolean).pop() || "channels";
    return VIEWS.has(name) ? name : "channels";
  };
  const hasPermission = (role, permission) => (PERMISSIONS[String(role || "guest").toLowerCase()] || PERMISSIONS.guest).includes(permission);

  function defaultState() {
    const createdAt = nowIso();
    return {
      version: SCHEMA_VERSION,
      activeChannelId: "ch-general",
      channels: [
        { id: "ch-general", name: "sảnh-chung", type: "public", description: "Kết nối và cập nhật nhanh từ cộng đồng HH.", tags: ["Thông báo", "Cộng đồng"], slowModeSeconds: 0, muted: false, ownerId: "member-owner", memberIds: ["member-owner", "member-mod", "member-guest"], createdAt },
        { id: "ch-creative", name: "creative-room", type: "shared", description: "Chia sẻ bản thiết kế, nhạc và quy trình sáng tạo.", tags: ["Thiết kế", "Âm nhạc"], slowModeSeconds: 5, muted: false, ownerId: "member-owner", memberIds: ["member-owner", "member-mod"], createdAt },
        { id: "ch-team", name: "nhóm-dự-án", type: "private", description: "Không gian riêng dành cho thành viên dự án.", tags: ["Dự án"], slowModeSeconds: 15, muted: false, ownerId: "member-owner", memberIds: ["member-owner"], createdAt }
      ],
      members: [
        { id: "member-owner", name: "Hoàng Đại Ka", role: "owner", online: false, blocked: false, muted: false },
        { id: "member-mod", name: "HH Moderator", role: "moderator", online: false, blocked: false, muted: false },
        { id: "member-guest", name: "Thành viên mới", role: "member", online: false, blocked: false, muted: false }
      ],
      posts: [
        { id: "post-guide", channelId: "ch-general", authorId: "member-owner", title: "Bắt đầu với HH Community", body: "Đọc quy tắc, chọn chủ đề phù hợp và dùng thread để cuộc thảo luận không bị trôi.", kind: "guide", tags: ["Hướng dẫn"], solved: true, pinned: true, createdAt, replies: [] },
        { id: "post-welcome", channelId: "ch-general", authorId: "member-mod", title: "Góc góp ý tuần này", body: "Bạn muốn Community có thêm phòng hoặc chủ đề nào? Hãy trả lời ngay trong thread.", kind: "forum", tags: ["Góp ý"], solved: false, pinned: false, createdAt, replies: [
          { id: "reply-seed", authorId: "member-guest", body: "Mình muốn có thêm phòng học nhóm theo chuyên ngành.", createdAt }
        ] }
      ],
      onboarding: { step: 1, interests: [], persona: "", channelIds: ["ch-general"], completed: false },
      moderationQueue: [
        { id: "report-seed", kind: "report", targetId: "post-welcome", reporterId: "member-guest", reason: "Kiểm tra mẫu hàng đợi kiểm duyệt", status: "pending", createdAt }
      ],
      audit: [],
      rateLog: {},
      lastPostAt: {},
      updatedAt: createdAt
    };
  }

  function normalizeState(input) {
    const seed = defaultState();
    const value = input && typeof input === "object" ? input : {};
    const state = {
      ...seed,
      ...value,
      version: SCHEMA_VERSION,
      channels: Array.isArray(value.channels) ? value.channels : seed.channels,
      members: Array.isArray(value.members) ? value.members : seed.members,
      posts: Array.isArray(value.posts) ? value.posts.map((post) => ({ ...post, replies: Array.isArray(post.replies) ? post.replies : [], tags: Array.isArray(post.tags) ? post.tags : [] })) : seed.posts,
      moderationQueue: Array.isArray(value.moderationQueue) ? value.moderationQueue : seed.moderationQueue,
      audit: Array.isArray(value.audit) ? value.audit : [],
      onboarding: { ...seed.onboarding, ...(value.onboarding || {}) },
      rateLog: value.rateLog && typeof value.rateLog === "object" ? value.rateLog : {},
      lastPostAt: value.lastPostAt && typeof value.lastPostAt === "object" ? value.lastPostAt : {}
    };
    if (!state.channels.some((channel) => channel.id === state.activeChannelId)) state.activeChannelId = state.channels[0]?.id || "";
    return state;
  }

  function loadState() {
    try {
      return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
    } catch {
      return defaultState();
    }
  }

  function persist(state) {
    state.updatedAt = nowIso();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Storage can be unavailable in privacy mode. */ }
  }

  function assessLinkRisk(text) {
    const content = String(text || "");
    if (/\b(?:javascript|data|vbscript):/i.test(content)) return { level: "high", label: "Liên kết có giao thức nguy hiểm", blocked: true };
    const urls = content.match(/https?:\/\/[^\s<>()]+/gi) || [];
    if (!urls.length) return { level: "none", label: "Không phát hiện liên kết", blocked: false };
    let shortener = false;
    let insecure = false;
    let ipHost = false;
    for (const raw of urls) {
      try {
        const url = new URL(raw);
        shortener ||= SHORTENER_HOSTS.has(url.hostname.toLowerCase());
        insecure ||= url.protocol === "http:";
        ipHost ||= /^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname);
      } catch { /* Invalid URLs remain a medium-risk input. */ }
    }
    if (shortener || ipHost) return { level: "medium", label: "Liên kết rút gọn hoặc máy chủ IP cần kiểm tra", blocked: false };
    if (insecure) return { level: "medium", label: "Liên kết HTTP không mã hóa", blocked: false };
    return { level: "low", label: `${urls.length} liên kết HTTPS`, blocked: false };
  }

  function appendAudit(state, entry) {
    const record = Object.freeze({
      id: uid("audit"),
      actorId: entry.actorId || "unknown",
      action: entry.action || "unknown",
      targetType: entry.targetType || "record",
      targetId: entry.targetId || "unknown",
      reason: entry.reason || "",
      before: clone(entry.before ?? null),
      after: clone(entry.after ?? null),
      createdAt: nowIso()
    });
    state.audit = [...state.audit, record];
    return record;
  }

  function currentMember() {
    if (!runtime) return null;
    return runtime.state.members.find((member) => member.id === runtime.currentUser.id) || runtime.state.members[0] || null;
  }

  function memberById(id) {
    return runtime?.state.members.find((member) => member.id === id) || { id, name: "Thành viên", role: "guest", online: false };
  }

  function activeChannel() {
    return runtime?.state.channels.find((channel) => channel.id === runtime.state.activeChannelId) || runtime?.state.channels[0] || null;
  }

  function hasConfirmedConnection(options = runtime?.options || {}) {
    try {
      if (options.socket?.connected === true || options.adapter?.connected === true) return true;
      return typeof options.adapter?.isConnected === "function" && options.adapter.isConnected() === true;
    } catch {
      return false;
    }
  }

  function connectionIsLive() {
    return Boolean(runtime?.connectionConfirmed && hasConfirmedConnection(runtime.options));
  }

  function emitAdapter(type, payload) {
    if (!runtime) return;
    const detail = { type, payload: clone(payload), source: "HHCommunicationChannelsForum", timestamp: nowIso() };
    try {
      if (typeof runtime.options.adapter?.emit === "function") runtime.options.adapter.emit(type, detail.payload);
      else if (typeof runtime.options.adapter?.dispatch === "function") runtime.options.adapter.dispatch(detail);
      window.dispatchEvent(new CustomEvent("hh:communication:channels:event", { detail }));
    } catch { /* Local state remains authoritative while adapters reconnect. */ }
  }

  function commit(type, payload, auditEntry) {
    if (!runtime) return;
    if (auditEntry) appendAudit(runtime.state, { actorId: runtime.currentUser.id, ...auditEntry });
    persist(runtime.state);
    emitAdapter(type, payload);
    render();
  }

  function accessibleChannel(channel) {
    if (!channel) return false;
    if (channel.type === "public") return true;
    return channel.memberIds.includes(runtime.currentUser.id) || hasPermission(currentMember()?.role, "moderate");
  }

  function channelButton(channel) {
    const selected = channel.id === runtime.state.activeChannelId;
    const locked = !accessibleChannel(channel);
    return `<button type="button" class="hcf-channel${selected ? " is-active" : ""}" data-channel-id="${esc(channel.id)}" ${locked ? "disabled" : ""} aria-current="${selected ? "page" : "false"}">
      <span aria-hidden="true">${TYPE_ICONS[channel.type] || "#"}</span><span><strong>${esc(channel.name)}</strong><small>${TYPE_LABELS[channel.type] || channel.type}${channel.muted ? " · Đã tắt báo" : ""}</small></span>${locked ? '<i title="Bạn chưa có quyền truy cập">Khóa</i>' : ""}
    </button>`;
  }

  function shell(main, aside = "") {
    const member = currentMember();
    const viewLabels = { channels: "Channels", forum: "Forum", onboarding: "Bắt đầu", moderation: "An toàn" };
    return `<section class="hcf-app" data-hcf-root data-view="${runtime.view}" aria-label="Channel và Forum HH">
      <header class="hcf-hero">
        <div><span class="hcf-kicker">COMMUNICATION · CHANNEL & FORUM</span><h2>Thảo luận rõ ràng,<br><em>không để ý tưởng bị trôi.</em></h2><p>Channel, thread, hướng dẫn và kiểm duyệt trong một workspace local-first.</p></div>
        <div class="hcf-hero-stats"><article><strong>${runtime.state.channels.length}</strong><span>Channel</span></article><article><strong>${runtime.state.posts.length}</strong><span>Chủ đề</span></article><article><strong>${connectionIsLive() ? runtime.state.members.filter((item) => item.online).length : "—"}</strong><span>${connectionIsLive() ? "Online đã xác nhận" : "Chưa có presence"}</span></article></div>
      </header>
      <nav class="hcf-view-tabs" aria-label="Chế độ Channel và Forum">${["channels", "forum", "onboarding", "moderation"].map((view) => `<button type="button" data-view-name="${view}" class="${runtime.view === view ? "is-active" : ""}" aria-current="${runtime.view === view ? "page" : "false"}">${viewLabels[view]}${view === "moderation" && runtime.state.moderationQueue.some((item) => item.status === "pending") ? `<b>${runtime.state.moderationQueue.filter((item) => item.status === "pending").length}</b>` : ""}</button>`).join("")}</nav>
      <div class="hcf-workspace">
        <aside class="hcf-library" aria-label="Danh sách channel">
          <div class="hcf-profile"><span>${esc((member?.name || "HH").split(/\s+/).map((part) => part[0]).slice(-2).join(""))}</span><div><strong>${esc(member?.name || "Thành viên")}</strong><small><i></i>${connectionIsLive() && member?.online ? "Đang online" : "Chưa xác nhận realtime"} · ${ROLE_LABELS[member?.role] || "Guest"}</small></div></div>
          <label class="hcf-search"><span aria-hidden="true">⌕</span><input type="search" data-channel-search placeholder="Tìm channel..." aria-label="Tìm channel"></label>
          <div class="hcf-channel-groups">${["public", "private", "shared"].map((type) => `<section><h3>${TYPE_LABELS[type]} <b>${runtime.state.channels.filter((channel) => channel.type === type).length}</b></h3>${runtime.state.channels.filter((channel) => channel.type === type).map(channelButton).join("") || "<p>Chưa có channel</p>"}</section>`).join("")}</div>
          ${hasPermission(member?.role, "manage-channel") ? '<button type="button" class="hcf-add-channel" data-open-modal="channel">＋ Tạo channel</button>' : ""}
          <div class="hcf-sync" data-connected="${connectionIsLive()}"><i></i><span>${connectionIsLive() ? "Adapter realtime đã xác nhận" : "Local-first · chưa xác nhận backend"}</span></div>
        </aside>
        <main class="hcf-main">${main}</main>
        <aside class="hcf-context">${aside}</aside>
      </div>
      ${renderModal()}
      <div class="hcf-toast" role="status" aria-live="polite" data-hcf-toast></div>
    </section>`;
  }

  function postCard(post, compact = false) {
    const author = memberById(post.authorId);
    const canModerate = hasPermission(currentMember()?.role, "moderate");
    return `<article class="hcf-post${post.pinned ? " is-pinned" : ""}" data-post-card="${esc(post.id)}">
      <header><span class="hcf-avatar">${esc(author.name.slice(0, 2).toUpperCase())}</span><div><strong>${esc(post.title || author.name)}</strong><small>${esc(author.name)} · ${formatTime(post.createdAt)}</small></div><div class="hcf-post-badges">${post.pinned ? "<b>Đã ghim</b>" : ""}${post.solved ? "<b class=\"is-solved\">Đã giải quyết</b>" : ""}${post.kind === "guide" ? "<b class=\"is-guide\">Hướng dẫn</b>" : ""}</div></header>
      <p>${esc(post.body)}</p>
      <div class="hcf-tags">${post.tags.map((tag) => `<span># ${esc(tag)}</span>`).join("")}</div>
      <footer><button type="button" data-thread-id="${esc(post.id)}">${compact ? "Mở thread" : `Phản hồi ${post.replies.length}`}</button><button type="button" data-report-id="${esc(post.id)}">Báo cáo</button>${canModerate ? `<button type="button" data-pin-id="${esc(post.id)}">${post.pinned ? "Bỏ ghim" : "Ghim"}</button><button type="button" data-solve-id="${esc(post.id)}">${post.solved ? "Mở lại" : "Đánh dấu xong"}</button>` : ""}</footer>
    </article>`;
  }

  function channelComposer(channel) {
    const member = currentMember();
    if (!hasPermission(member?.role, "post")) return '<div class="hcf-empty">Vai trò Guest chỉ có thể trả lời trong thread.</div>';
    return `<form class="hcf-composer" data-channel-composer>
      <label><span class="sr-only">Nội dung tin nhắn</span><textarea name="body" rows="3" maxlength="1800" placeholder="Chia sẻ với #${esc(channel.name)}..." required data-risk-input></textarea></label>
      <div class="hcf-risk" data-risk-status data-level="none"><span>✓</span><p>Liên kết sẽ được kiểm tra ngay trên thiết bị.</p></div>
      <footer><div><button type="button" data-insert-text=" #task ">#task</button><button type="button" data-insert-text=" @">@ nhắc</button><span>${channel.slowModeSeconds ? `Slow mode ${channel.slowModeSeconds}s` : "Không giới hạn chậm"}</span></div><button type="submit">Gửi vào channel</button></footer>
    </form>`;
  }

  function threadPanel(post) {
    if (!post) return '<section class="hcf-context-empty"><span>↳</span><h3>Thread tập trung</h3><p>Chọn một chủ đề để đọc và trả lời mà không làm trôi channel.</p></section>';
    return `<section class="hcf-thread"><header><div><span>THREAD</span><h3>${esc(post.title || "Cuộc thảo luận")}</h3></div><button type="button" data-close-thread aria-label="Đóng thread">×</button></header><p>${esc(post.body)}</p><div class="hcf-replies">${post.replies.map((reply) => { const author = memberById(reply.authorId); return `<article><span class="hcf-avatar">${esc(author.name.slice(0, 2).toUpperCase())}</span><div><strong>${esc(author.name)}</strong><p>${esc(reply.body)}</p><small>${formatTime(reply.createdAt)}</small></div></article>`; }).join("") || "<p>Chưa có phản hồi. Hãy bắt đầu thread.</p>"}</div>${hasPermission(currentMember()?.role, "reply") ? `<form data-reply-form="${esc(post.id)}"><textarea name="body" maxlength="1200" placeholder="Trả lời thread..." required data-risk-input></textarea><button type="submit">Gửi</button></form>` : ""}</section>`;
  }

  function renderChannels() {
    const channel = activeChannel();
    if (!channel) return shell('<div class="hcf-empty">Chưa có channel khả dụng.</div>');
    const posts = runtime.state.posts.filter((post) => post.channelId === channel.id && post.kind !== "forum");
    const selected = runtime.state.posts.find((post) => post.id === runtime.ui.threadId);
    const member = currentMember();
    const main = `<header class="hcf-channel-head"><div><span>${TYPE_ICONS[channel.type]}</span><div><small>${TYPE_LABELS[channel.type]} · ${channel.memberIds.length} thành viên</small><h2>${esc(channel.name)}</h2><p>${esc(channel.description)}</p></div></div><button type="button" data-toggle-channel-mute>${channel.muted ? "Bật thông báo" : "Tắt thông báo"}</button></header>
      ${channelComposer(channel)}
      <section class="hcf-feed"><div class="hcf-feed-head"><h3>Dòng thảo luận</h3><span>${posts.length} mục</span></div>${posts.map((post) => postCard(post)).join("") || '<div class="hcf-empty">Channel chưa có nội dung.</div>'}</section>`;
    const aside = `${threadPanel(selected)}<section class="hcf-channel-info"><h3>Quy tắc channel</h3><ul><li>Dùng thread cho cùng một chủ đề.</li><li>Không gửi liên kết hoặc tệp đáng ngờ.</li><li>Tôn trọng slow mode và thành viên khác.</li></ul>${hasPermission(member?.role, "moderate") ? `<label>Slow mode<select data-slow-mode>${[0, 5, 15, 30, 60].map((seconds) => `<option value="${seconds}" ${channel.slowModeSeconds === seconds ? "selected" : ""}>${seconds ? `${seconds} giây` : "Tắt"}</option>`).join("")}</select></label>` : ""}</section>`;
    return shell(main, aside);
  }

  function filteredForumPosts() {
    const query = runtime.ui.forumQuery.toLocaleLowerCase("vi");
    return runtime.state.posts.filter((post) => {
      if (!["forum", "guide"].includes(post.kind)) return false;
      if (runtime.ui.forumFilter === "solved" && !post.solved) return false;
      if (runtime.ui.forumFilter === "open" && post.solved) return false;
      if (runtime.ui.forumFilter === "guide" && post.kind !== "guide") return false;
      if (runtime.ui.forumTag && !post.tags.includes(runtime.ui.forumTag)) return false;
      return !query || `${post.title} ${post.body} ${post.tags.join(" ")}`.toLocaleLowerCase("vi").includes(query);
    });
  }

  function renderForum() {
    const tags = [...new Set(runtime.state.posts.flatMap((post) => post.tags))];
    const posts = filteredForumPosts();
    const selected = runtime.state.posts.find((post) => post.id === runtime.ui.threadId);
    const main = `<header class="hcf-page-head"><div><span>FORUM KNOWLEDGE</span><h2>Hỏi, giải quyết, lưu thành hướng dẫn.</h2><p>Chủ đề có tag và trạng thái để người đến sau tìm đúng câu trả lời.</p></div>${hasPermission(currentMember()?.role, "post") ? '<button type="button" data-open-modal="forum">＋ Tạo chủ đề</button>' : ""}</header>
      <section class="hcf-forum-toolbar"><label><span>⌕</span><input type="search" value="${esc(runtime.ui.forumQuery)}" data-forum-search placeholder="Tìm câu hỏi, tag, nội dung..."></label><select data-forum-filter aria-label="Lọc trạng thái"><option value="all">Tất cả</option><option value="open" ${runtime.ui.forumFilter === "open" ? "selected" : ""}>Đang mở</option><option value="solved" ${runtime.ui.forumFilter === "solved" ? "selected" : ""}>Đã giải quyết</option><option value="guide" ${runtime.ui.forumFilter === "guide" ? "selected" : ""}>Hướng dẫn</option></select></section>
      <div class="hcf-tag-filter"><button type="button" data-forum-tag="" class="${!runtime.ui.forumTag ? "is-active" : ""}">Tất cả tag</button>${tags.map((tag) => `<button type="button" data-forum-tag="${esc(tag)}" class="${runtime.ui.forumTag === tag ? "is-active" : ""}"># ${esc(tag)}</button>`).join("")}</div>
      <section class="hcf-forum-list">${posts.map((post) => postCard(post, true)).join("") || '<div class="hcf-empty">Không có chủ đề phù hợp bộ lọc.</div>'}</section>`;
    return shell(main, `${threadPanel(selected)}<section class="hcf-guide-box"><span>PLAYBOOK</span><h3>Biến câu trả lời tốt thành kiến thức</h3><p>Moderator có thể đánh dấu đã giải quyết, ghim và chuyển chủ đề thành hướng dẫn dùng lại.</p></section>`);
  }

  function onboardingProgress() {
    return `<div class="hcf-onboarding-progress" aria-label="Tiến trình thiết lập">${[1, 2, 3].map((step) => `<span class="${runtime.state.onboarding.step >= step ? "is-done" : ""}"><b>${step}</b>${["Sở thích", "Vai trò", "Channel"][step - 1]}</span>`).join("")}</div>`;
  }

  function renderOnboarding() {
    const onboarding = runtime.state.onboarding;
    let body = "";
    if (onboarding.completed) {
      body = `<section class="hcf-onboarding-done"><span>✓</span><h2>Workspace đã được cá nhân hóa</h2><p>${esc(onboarding.persona)} · ${onboarding.interests.map(esc).join(", ") || "Chưa chọn sở thích"}</p><button type="button" data-restart-onboarding>Thiết lập lại</button><button type="button" data-view-name="channels">Vào channel</button></section>`;
    } else if (onboarding.step === 1) {
      body = `<form data-onboarding-form="interests"><span class="hcf-step-label">BƯỚC 1 / 3</span><h2>Bạn muốn theo dõi điều gì?</h2><p>Chọn ít nhất một chủ đề. Bạn có thể đổi lại bất cứ lúc nào.</p><div class="hcf-choice-grid">${INTERESTS.map((interest) => `<label><input type="checkbox" name="interest" value="${esc(interest)}" ${onboarding.interests.includes(interest) ? "checked" : ""}><span>${esc(interest)}</span></label>`).join("")}</div><footer><span></span><button type="submit">Tiếp tục →</button></footer></form>`;
    } else if (onboarding.step === 2) {
      body = `<form data-onboarding-form="persona"><span class="hcf-step-label">BƯỚC 2 / 3</span><h2>Vai trò sử dụng của bạn</h2><p>Đây là hồ sơ sở thích, không tự thay đổi quyền quản trị.</p><div class="hcf-choice-grid is-persona">${PERSONAS.map((persona) => `<label><input type="radio" name="persona" value="${esc(persona)}" ${onboarding.persona === persona ? "checked" : ""}><span>${esc(persona)}</span></label>`).join("")}</div><footer><button type="button" data-onboarding-back>← Quay lại</button><button type="submit">Tiếp tục →</button></footer></form>`;
    } else {
      body = `<form data-onboarding-form="channels"><span class="hcf-step-label">BƯỚC 3 / 3</span><h2>Chọn channel để bắt đầu</h2><p>Channel riêng tư chỉ xuất hiện khi bạn được mời.</p><div class="hcf-onboarding-channels">${runtime.state.channels.filter(accessibleChannel).map((channel) => `<label><input type="checkbox" name="channel" value="${esc(channel.id)}" ${onboarding.channelIds.includes(channel.id) ? "checked" : ""}><span>${TYPE_ICONS[channel.type]}</span><div><strong>${esc(channel.name)}</strong><small>${esc(channel.description)}</small></div></label>`).join("")}</div><footer><button type="button" data-onboarding-back>← Quay lại</button><button type="submit">Hoàn tất</button></footer></form>`;
    }
    return shell(`<section class="hcf-onboarding">${onboardingProgress()}${body}</section>`, '<section class="hcf-onboarding-note"><span>3 PHÚT</span><h3>Chỉ hiển thị điều hữu ích</h3><p>Onboarding giúp người mới không phải nhìn toàn bộ channel ngay từ lần đầu.</p><ul><li>Sở thích chỉ lưu trên thiết bị.</li><li>Vai trò hồ sơ không cấp quyền admin.</li><li>Có thể thiết lập lại bất cứ lúc nào.</li></ul></section>');
  }

  function queueItem(item) {
    const post = runtime.state.posts.find((entry) => entry.id === item.targetId);
    return `<article class="hcf-report"><header><span>${item.kind === "link-risk" ? "LINK" : "REPORT"}</span><b>${esc(item.status === "pending" ? "Đang chờ" : item.status)}</b></header><h3>${esc(post?.title || "Nội dung được báo cáo")}</h3><p>${esc(item.reason)}</p><small>${formatTime(item.createdAt)} · ID ${esc(item.targetId)}</small>${item.status === "pending" ? `<footer><button type="button" data-moderate-id="${esc(item.id)}" data-decision="dismiss">Bỏ qua</button><button type="button" data-moderate-id="${esc(item.id)}" data-decision="resolved">Đã xử lý</button></footer>` : ""}</article>`;
  }

  function renderModeration() {
    const member = currentMember();
    if (!hasPermission(member?.role, "moderate")) return shell('<section class="hcf-access-denied"><span>◇</span><h2>Khu vực giới hạn</h2><p>Chỉ Owner, Admin và Moderator được mở hàng đợi kiểm duyệt.</p><button type="button" data-view-name="channels">Quay lại channel</button></section>', '<section class="hcf-guide-box"><span>ROLE</span><h3>Quyền của bạn</h3><p>Vai trò hiện tại: <b>' + esc(ROLE_LABELS[member?.role] || "Guest") + '</b></p></section>');
    const queue = runtime.state.moderationQueue;
    const main = `<header class="hcf-page-head"><div><span>TRUST & SAFETY</span><h2>Kiểm duyệt có lý do và có dấu vết.</h2><p>Spam, report và link-risk được xử lý theo vai trò; audit local chỉ được nối thêm.</p></div><button type="button" data-export-audit>Xuất audit JSON</button></header>
      <section class="hcf-safety-metrics"><article><strong>${queue.filter((item) => item.status === "pending").length}</strong><span>Đang chờ</span></article><article><strong>${runtime.state.members.filter((item) => item.blocked).length}</strong><span>Đã chặn</span></article><article><strong>${runtime.state.audit.length}</strong><span>Audit events</span></article><article><strong>5/30s</strong><span>Rate limit local</span></article></section>
      <div class="hcf-moderation-grid"><section><h3>Hàng đợi báo cáo</h3>${queue.map(queueItem).join("") || '<div class="hcf-empty">Hàng đợi sạch.</div>'}</section><section><h3>Thành viên & quyền</h3><div class="hcf-member-table">${runtime.state.members.map((item) => `<article><span class="hcf-avatar">${esc(item.name.slice(0, 2).toUpperCase())}</span><div><strong>${esc(item.name)}</strong><small>${item.online ? "Online" : "Offline"}${item.blocked ? " · Đã chặn" : ""}${item.muted ? " · Đã mute" : ""}</small></div>${hasPermission(member.role, "manage-role") && item.id !== member.id ? `<select data-member-role="${esc(item.id)}" aria-label="Vai trò của ${esc(item.name)}">${Object.entries(ROLE_LABELS).map(([role, label]) => `<option value="${role}" ${item.role === role ? "selected" : ""}>${label}</option>`).join("")}</select>` : `<b>${ROLE_LABELS[item.role]}</b>`}${item.id !== member.id ? `<button type="button" data-member-action="mute" data-member-id="${esc(item.id)}">${item.muted ? "Bỏ mute" : "Mute"}</button><button type="button" data-member-action="block" data-member-id="${esc(item.id)}">${item.blocked ? "Bỏ chặn" : "Chặn"}</button>` : ""}</article>`).join("")}</div></section></div>`;
    const audit = runtime.state.audit.slice(-8).reverse();
    const aside = `<section class="hcf-audit"><header><span>APPEND-ONLY</span><h3>Audit gần đây</h3></header>${audit.map((entry) => `<article><i></i><div><strong>${esc(entry.action)}</strong><p>${esc(entry.targetType)} · ${esc(entry.targetId)}</p><small>${formatTime(entry.createdAt)}</small></div></article>`).join("") || '<p>Chưa có hành động quản trị.</p>'}</section><section class="hcf-permissions"><h3>Phân quyền</h3>${Object.entries(PERMISSIONS).map(([role, permissions]) => `<details><summary>${ROLE_LABELS[role]}</summary><p>${permissions.map(esc).join(" · ")}</p></details>`).join("")}</section>`;
    return shell(main, aside);
  }

  function renderModal() {
    const modal = runtime?.ui.modal;
    if (!modal) return "";
    if (modal.type === "channel") return `<div class="hcf-modal" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="hcf-modal-title"><header><div><span>CHANNEL</span><h2 id="hcf-modal-title">Tạo không gian mới</h2></div><button type="button" data-close-modal aria-label="Đóng">×</button></header><form data-channel-create><label>Tên channel<input name="name" maxlength="40" pattern="[A-Za-z0-9À-ỹ _-]+" required placeholder="ví dụ: nhóm-thiết-kế"></label><label>Kiểu channel<select name="type"><option value="public">Công khai</option><option value="private">Riêng tư</option><option value="shared">Chia sẻ</option></select></label><label>Mô tả<textarea name="description" maxlength="180" required></textarea></label><footer><button type="button" data-close-modal>Hủy</button><button type="submit">Tạo channel</button></footer></form></section></div>`;
    if (modal.type === "forum") return `<div class="hcf-modal" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="hcf-modal-title"><header><div><span>FORUM</span><h2 id="hcf-modal-title">Tạo chủ đề</h2></div><button type="button" data-close-modal aria-label="Đóng">×</button></header><form data-forum-create><label>Tiêu đề<input name="title" maxlength="100" required></label><label>Nội dung<textarea name="body" maxlength="2400" required data-risk-input></textarea></label><label>Tags<input name="tags" maxlength="100" placeholder="Thiết kế, Hỏi đáp"></label><label>Loại<select name="kind"><option value="forum">Thảo luận</option>${hasPermission(currentMember()?.role, "moderate") ? '<option value="guide">Hướng dẫn</option>' : ""}</select></label><div class="hcf-risk" data-risk-status data-level="none"><span>✓</span><p>Liên kết sẽ được kiểm tra ngay trên thiết bị.</p></div><footer><button type="button" data-close-modal>Hủy</button><button type="submit">Đăng chủ đề</button></footer></form></section></div>`;
    if (modal.type === "report") return `<div class="hcf-modal" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="hcf-modal-title"><header><div><span>SAFETY</span><h2 id="hcf-modal-title">Báo cáo nội dung</h2></div><button type="button" data-close-modal aria-label="Đóng">×</button></header><form data-report-form="${esc(modal.postId)}"><label>Lý do<select name="reason"><option>Spam hoặc quảng cáo</option><option>Quấy rối</option><option>Liên kết đáng ngờ</option><option>Nội dung không phù hợp</option></select></label><label>Ghi chú<textarea name="note" maxlength="300" placeholder="Thông tin giúp moderator kiểm tra..."></textarea></label><footer><button type="button" data-close-modal>Hủy</button><button type="submit">Gửi báo cáo</button></footer></form></section></div>`;
    return "";
  }

  function render() {
    if (!runtime?.host) return;
    const renderer = { channels: renderChannels, forum: renderForum, onboarding: renderOnboarding, moderation: renderModeration }[runtime.view] || renderChannels;
    runtime.host.innerHTML = renderer();
    const focusSelector = runtime.ui.focusAfterRender;
    runtime.ui.focusAfterRender = "";
    if (focusSelector) requestAnimationFrame(() => runtime?.host.querySelector(focusSelector)?.focus());
  }

  function toast(message, tone = "info") {
    const node = runtime?.host.querySelector("[data-hcf-toast]");
    if (!node) return;
    node.textContent = message;
    node.dataset.tone = tone;
    node.classList.add("is-visible");
    window.clearTimeout(runtime.toastTimer);
    runtime.toastTimer = window.setTimeout(() => node.classList.remove("is-visible"), 2600);
  }

  function canSubmit(channel) {
    const member = currentMember();
    if (member?.blocked) return { ok: false, message: "Tài khoản đang bị chặn khỏi thảo luận." };
    const key = `${member.id}:${channel.id}`;
    const now = Date.now();
    const recent = (runtime.state.rateLog[key] || []).filter((time) => now - time < 30000);
    runtime.state.rateLog[key] = recent;
    if (recent.length >= 5) return { ok: false, message: "Bạn đã gửi quá nhanh. Hãy chờ trước khi gửi tiếp." };
    const waitMs = channel.slowModeSeconds * 1000 - (now - Number(runtime.state.lastPostAt[key] || 0));
    if (waitMs > 0) return { ok: false, message: `Slow mode: thử lại sau ${Math.ceil(waitMs / 1000)} giây.` };
    recent.push(now);
    runtime.state.lastPostAt[key] = now;
    return { ok: true };
  }

  function saveNewPost({ channelId, title = "", body, kind = "message", tags = [] }) {
    const risk = assessLinkRisk(body);
    if (risk.blocked) return toast(risk.label, "danger");
    const channel = runtime.state.channels.find((item) => item.id === channelId) || activeChannel();
    const allowed = canSubmit(channel);
    if (!allowed.ok) return toast(allowed.message, "warning");
    const post = { id: uid("post"), channelId: channel.id, authorId: runtime.currentUser.id, title, body: body.trim(), kind, tags, solved: false, pinned: false, createdAt: nowIso(), replies: [] };
    runtime.state.posts.unshift(post);
    if (risk.level === "medium") runtime.state.moderationQueue.push({ id: uid("risk"), kind: "link-risk", targetId: post.id, reporterId: "local-safety", reason: risk.label, status: "pending", createdAt: nowIso() });
    commit("channel:post:create", post);
    toast(risk.level === "medium" ? "Đã đăng và chuyển link vào hàng đợi kiểm tra." : "Đã đăng nội dung.", risk.level === "medium" ? "warning" : "success");
  }

  function updateRisk(input) {
    const risk = assessLinkRisk(input.value);
    const form = input.closest("form");
    const status = form?.querySelector("[data-risk-status]");
    if (!status) return;
    status.dataset.level = risk.level;
    status.querySelector("span").textContent = risk.blocked ? "!" : risk.level === "none" ? "✓" : "◇";
    status.querySelector("p").textContent = risk.label;
  }

  function onClick(event) {
    const button = event.target.closest("button");
    if (!button || !runtime?.host.contains(button)) return;
    const view = button.dataset.viewName;
    if (view) { runtime.view = normalizeView(view); runtime.ui.threadId = ""; render(); return; }
    if (button.dataset.channelId) { runtime.state.activeChannelId = button.dataset.channelId; runtime.view = "channels"; persist(runtime.state); render(); return; }
    if (button.dataset.threadId) { runtime.ui.threadId = button.dataset.threadId; render(); return; }
    if (button.hasAttribute("data-close-thread")) { runtime.ui.threadId = ""; render(); return; }
    if (button.dataset.openModal) { runtime.ui.modal = { type: button.dataset.openModal }; render(); runtime.ui.focusAfterRender = "[role=dialog] input, [role=dialog] textarea"; requestAnimationFrame(() => runtime?.host.querySelector("[role=dialog] input, [role=dialog] textarea")?.focus()); return; }
    if (button.hasAttribute("data-close-modal")) { runtime.ui.modal = null; render(); return; }
    if (button.dataset.reportId) { runtime.ui.modal = { type: "report", postId: button.dataset.reportId }; render(); requestAnimationFrame(() => runtime?.host.querySelector("[role=dialog] select")?.focus()); return; }
    if (button.dataset.insertText) { const area = button.closest("form")?.querySelector("textarea"); if (area) { area.setRangeText(button.dataset.insertText, area.selectionStart, area.selectionEnd, "end"); area.focus(); updateRisk(area); } return; }
    if (button.hasAttribute("data-toggle-channel-mute")) { const channel = activeChannel(); const before = channel.muted; channel.muted = !before; commit("channel:notification:update", { channelId: channel.id, muted: channel.muted }, { action: "channel.notification", targetType: "channel", targetId: channel.id, before, after: channel.muted }); return; }
    if (button.dataset.pinId || button.dataset.solveId) {
      const id = button.dataset.pinId || button.dataset.solveId;
      const post = runtime.state.posts.find((item) => item.id === id);
      if (!post || !hasPermission(currentMember()?.role, "moderate")) return;
      const field = button.dataset.pinId ? "pinned" : "solved";
      const before = post[field]; post[field] = !before;
      commit(`forum:${field}`, { postId: id, value: post[field] }, { action: `forum.${field}`, targetType: "post", targetId: id, before, after: post[field] }); return;
    }
    if (button.dataset.forumTag !== undefined) { runtime.ui.forumTag = button.dataset.forumTag; render(); return; }
    if (button.hasAttribute("data-onboarding-back")) { runtime.state.onboarding.step = Math.max(1, runtime.state.onboarding.step - 1); persist(runtime.state); render(); return; }
    if (button.hasAttribute("data-restart-onboarding")) { runtime.state.onboarding = { step: 1, interests: [], persona: "", channelIds: ["ch-general"], completed: false }; persist(runtime.state); render(); return; }
    if (button.dataset.moderateId) {
      const item = runtime.state.moderationQueue.find((entry) => entry.id === button.dataset.moderateId);
      if (!item || !hasPermission(currentMember()?.role, "moderate")) return;
      const before = item.status; item.status = button.dataset.decision;
      commit("moderation:queue:update", { id: item.id, status: item.status }, { action: "moderation.resolve", targetType: item.kind, targetId: item.targetId, reason: item.reason, before, after: item.status }); return;
    }
    if (button.dataset.memberAction) {
      const target = runtime.state.members.find((item) => item.id === button.dataset.memberId);
      if (!target || !hasPermission(currentMember()?.role, "moderate")) return;
      const field = button.dataset.memberAction === "block" ? "blocked" : "muted";
      const before = target[field]; target[field] = !before;
      commit(`moderation:member:${field}`, { memberId: target.id, value: target[field] }, { action: `member.${field}`, targetType: "member", targetId: target.id, before, after: target[field] }); return;
    }
    if (button.hasAttribute("data-export-audit")) {
      const blob = new Blob([JSON.stringify(runtime.state.audit, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `hh-communication-audit-${Date.now()}.json`; link.click(); URL.revokeObjectURL(url); toast("Đã xuất audit log.", "success");
    }
  }

  function onInput(event) {
    if (event.target.matches("[data-risk-input]")) updateRisk(event.target);
    if (event.target.matches("[data-channel-search]")) {
      const query = event.target.value.trim().toLocaleLowerCase("vi");
      runtime.host.querySelectorAll("[data-channel-id]").forEach((button) => { button.hidden = Boolean(query) && !button.textContent.toLocaleLowerCase("vi").includes(query); });
    }
  }

  function onChange(event) {
    if (event.target.matches("[data-forum-filter]")) { runtime.ui.forumFilter = event.target.value; render(); return; }
    if (event.target.matches("[data-slow-mode]")) {
      const channel = activeChannel(); const before = channel.slowModeSeconds; channel.slowModeSeconds = Number(event.target.value) || 0;
      commit("channel:slow-mode", { channelId: channel.id, seconds: channel.slowModeSeconds }, { action: "channel.slow-mode", targetType: "channel", targetId: channel.id, before, after: channel.slowModeSeconds }); return;
    }
    if (event.target.matches("[data-member-role]")) {
      const target = runtime.state.members.find((item) => item.id === event.target.dataset.memberRole);
      if (!target || !hasPermission(currentMember()?.role, "manage-role")) return;
      const before = target.role; target.role = event.target.value;
      commit("moderation:role:update", { memberId: target.id, role: target.role }, { action: "member.role", targetType: "member", targetId: target.id, before, after: target.role });
    }
  }

  function onKeydown(event) {
    if (event.key === "Escape" && runtime?.ui.modal) { runtime.ui.modal = null; render(); }
  }

  function onSubmit(event) {
    const form = event.target.closest("form");
    if (!form || !runtime?.host.contains(form)) return;
    event.preventDefault();
    const data = new FormData(form);
    if (form.matches("[data-channel-composer]")) { saveNewPost({ channelId: activeChannel().id, body: String(data.get("body") || "") }); return; }
    if (form.matches("[data-reply-form]")) {
      const post = runtime.state.posts.find((item) => item.id === form.dataset.replyForm); const body = String(data.get("body") || "").trim(); const risk = assessLinkRisk(body);
      if (!post || !body || risk.blocked) return toast(risk.blocked ? risk.label : "Không tìm thấy thread.", "danger");
      const reply = { id: uid("reply"), authorId: runtime.currentUser.id, body, createdAt: nowIso() }; post.replies.push(reply); commit("channel:thread:reply", { postId: post.id, reply }); return;
    }
    if (form.matches("[data-channel-create]")) {
      if (!hasPermission(currentMember()?.role, "manage-channel")) return;
      const channel = { id: uid("ch"), name: String(data.get("name") || "channel").trim().toLocaleLowerCase("vi").replace(/\s+/g, "-"), type: String(data.get("type") || "public"), description: String(data.get("description") || "").trim(), tags: [], slowModeSeconds: 0, muted: false, ownerId: runtime.currentUser.id, memberIds: [runtime.currentUser.id], createdAt: nowIso() };
      runtime.state.channels.push(channel); runtime.state.activeChannelId = channel.id; runtime.ui.modal = null;
      commit("channel:create", channel, { action: "channel.create", targetType: "channel", targetId: channel.id, before: null, after: channel }); return;
    }
    if (form.matches("[data-forum-create]")) {
      const tags = String(data.get("tags") || "").split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 5);
      runtime.ui.modal = null; saveNewPost({ channelId: runtime.state.channels.find((channel) => channel.type === "public")?.id, title: String(data.get("title") || "").trim(), body: String(data.get("body") || ""), kind: String(data.get("kind") || "forum"), tags }); return;
    }
    if (form.matches("[data-report-form]")) {
      const report = { id: uid("report"), kind: "report", targetId: form.dataset.reportForm, reporterId: runtime.currentUser.id, reason: `${data.get("reason")}${data.get("note") ? ` · ${data.get("note")}` : ""}`, status: "pending", createdAt: nowIso() };
      runtime.state.moderationQueue.push(report); runtime.ui.modal = null; commit("moderation:report:create", report); return;
    }
    if (form.dataset.onboardingForm === "interests") {
      const interests = data.getAll("interest"); if (!interests.length) return toast("Hãy chọn ít nhất một sở thích.", "warning"); runtime.state.onboarding.interests = interests; runtime.state.onboarding.step = 2; persist(runtime.state); render(); return;
    }
    if (form.dataset.onboardingForm === "persona") {
      const persona = String(data.get("persona") || ""); if (!persona) return toast("Hãy chọn vai trò sử dụng.", "warning"); runtime.state.onboarding.persona = persona; runtime.state.onboarding.step = 3; persist(runtime.state); render(); return;
    }
    if (form.dataset.onboardingForm === "channels") {
      const channelIds = data.getAll("channel"); if (!channelIds.length) return toast("Hãy chọn ít nhất một channel.", "warning"); runtime.state.onboarding.channelIds = channelIds; runtime.state.onboarding.completed = true; persist(runtime.state); emitAdapter("onboarding:completed", runtime.state.onboarding); render();
    }
  }

  function onForumSearch(event) {
    if (!event.target.matches("[data-forum-search]")) return;
    runtime.ui.forumQuery = event.target.value;
    window.clearTimeout(runtime.searchTimer);
    runtime.searchTimer = window.setTimeout(() => { runtime.ui.focusAfterRender = "[data-forum-search]"; render(); }, 180);
  }

  function onRemoteSync(event) {
    const next = event.detail?.state;
    if (!next || event.detail?.source === "HHCommunicationChannelsForum") return;
    runtime.connectionConfirmed = event.detail?.connected === true && hasConfirmedConnection(runtime.options);
    runtime.state = normalizeState(next); persist(runtime.state); render();
  }

  function onRealtimeReady(event) {
    const socket = event.detail?.socket;
    if (socket?.connected !== true) return;
    runtime.options.socket = socket;
    runtime.connectionConfirmed = true;
    render();
  }

  function onRealtimeOffline() {
    if (!runtime) return;
    runtime.connectionConfirmed = false;
    render();
  }

  function supports(view) {
    const name = String(view || "").replace(/^#?\/?/, "").split("/").filter(Boolean).pop() || "";
    return VIEWS.has(name);
  }

  function mount(host, options = {}) {
    if (!host) return false;
    unmount();
    const state = loadState();
    const suppliedUser = options.currentUser || { id: "member-owner", name: "Hoàng Đại Ka" };
    if (!state.members.some((member) => member.id === suppliedUser.id)) state.members.push({ id: suppliedUser.id, name: suppliedUser.name || "Thành viên HH", role: "member", online: false, blocked: false, muted: false });
    runtime = {
      host,
      options,
      state,
      currentUser: { id: suppliedUser.id, name: suppliedUser.name || "Thành viên HH" },
      view: normalizeView(options.view),
      ui: { threadId: "", forumQuery: "", forumFilter: "all", forumTag: "", modal: null, focusAfterRender: "" },
      toastTimer: 0,
      searchTimer: 0,
      connectionConfirmed: hasConfirmedConnection(options),
      handlers: { click: onClick, input: onInput, change: onChange, keydown: onKeydown, submit: onSubmit, forumSearch: onForumSearch, sync: onRemoteSync, realtimeReady: onRealtimeReady, realtimeOffline: onRealtimeOffline }
    };
    persist(state);
    host.addEventListener("click", onClick);
    host.addEventListener("input", onInput);
    host.addEventListener("input", onForumSearch);
    host.addEventListener("change", onChange);
    host.addEventListener("keydown", onKeydown);
    host.addEventListener("submit", onSubmit);
    window.addEventListener("hh:communication:channels:sync", onRemoteSync);
    window.addEventListener("hh:realtime-ready", onRealtimeReady);
    window.addEventListener("hh:realtime-offline", onRealtimeOffline);
    render();
    emitAdapter("workspace:mounted", { view: runtime.view });
    return true;
  }

  function unmount() {
    if (!runtime) return;
    const { host, handlers } = runtime;
    host.removeEventListener("click", handlers.click);
    host.removeEventListener("input", handlers.input);
    host.removeEventListener("input", handlers.forumSearch);
    host.removeEventListener("change", handlers.change);
    host.removeEventListener("keydown", handlers.keydown);
    host.removeEventListener("submit", handlers.submit);
    window.removeEventListener("hh:communication:channels:sync", handlers.sync);
    window.removeEventListener("hh:realtime-ready", handlers.realtimeReady);
    window.removeEventListener("hh:realtime-offline", handlers.realtimeOffline);
    window.clearTimeout(runtime.toastTimer);
    window.clearTimeout(runtime.searchTimer);
    runtime = null;
  }

  window.HHCommunicationChannelsForum = {
    supports,
    mount,
    unmount,
    _test: { STORAGE_KEY, defaultState, normalizeState, assessLinkRisk, hasPermission, hasConfirmedConnection, appendAudit, filteredForumPosts: (state, filters = {}) => {
      const query = String(filters.query || "").toLocaleLowerCase("vi");
      return normalizeState(state).posts.filter((post) => ["forum", "guide"].includes(post.kind) && (!filters.status || filters.status === "all" || (filters.status === "solved" ? post.solved : filters.status === "open" ? !post.solved : post.kind === "guide")) && (!filters.tag || post.tags.includes(filters.tag)) && (!query || `${post.title} ${post.body} ${post.tags.join(" ")}`.toLocaleLowerCase("vi").includes(query)));
    } }
  };
})();
