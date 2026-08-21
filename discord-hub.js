(function initHHDiscordHub(scope, factory) {
  const api = factory(scope);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (scope) scope.HHDiscordHub = api;
})(typeof window !== "undefined" ? window : globalThis, function createHHDiscordHub(scope) {
  "use strict";

  const SAVED_KEY = "hh.discord.saved-messages.v2";
  const PREFS_KEY = "hh.discord.preferences.v2";
  const READ_KEY = "hh.discord.read-state.v1";
  const DRAFT_KEY = "hh.discord.drafts.v1";
  const SYNC_ACTIVE_MS = 5000;
  const SYNC_IDLE_MS = 12000;
  const FILE_LIMIT = 1_500_000;
  const FILE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf", "text/plain"]);
  const VIEWS = new Set(["home", "inbox", "saved", "activity", "settings"]);
  let session = null;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const initials = (value) => String(value || "D").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const date = (value) => { try { return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(new Date(value)); } catch { return ""; } };
  const currentToken = () => scope.HHAuthSession?.token?.() || "";
  const readJson = (key, fallback) => { try { const parsed = JSON.parse(localStorage.getItem(key) || "null"); return parsed && typeof parsed === "object" ? parsed : fallback; } catch { return fallback; } };
  const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const prefs = () => ({ sync: "adaptive", notifications: false, compact: false, animation: "balanced", ...readJson(PREFS_KEY, {}) });
  const readSaved = () => { const value = readJson(SAVED_KEY, []); return Array.isArray(value) ? value : []; };
  const writeSaved = (items) => writeJson(SAVED_KEY, items.slice(0, 300));
  const isSaved = (id) => readSaved().some((item) => item.id === id);

  async function api(path, options = {}) {
    if (!session?.apiBase) throw new Error("Backend Discord chưa được cấu hình.");
    const response = await fetch(`${session.apiBase}/api/discord/${path}`, {
      method: options.method || "GET", credentials: "include", cache: "no-store",
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(currentToken() ? { Authorization: `Bearer ${currentToken()}` } : {}) },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(data.error || `Discord API HTTP ${response.status}`); error.code = data.code || ""; error.status = response.status; throw error; }
    return data;
  }

  function profileMarkup(connection) {
    if (!connection) return '<span class="dh-avatar">?</span><span><strong>Chưa kết nối</strong><small>Discord OAuth</small></span>';
    return `${connection.avatar ? `<img class="dh-avatar" src="${esc(connection.avatar)}" alt="">` : `<span class="dh-avatar">${esc(initials(connection.username))}</span>`}<span><strong>${esc(connection.username)}</strong><small>@${esc(connection.handle)}</small></span>`;
  }

  function shellMarkup() {
    return `<section class="discord-hub" data-discord-hub>
      <div class="dh-ambient" aria-hidden="true"><i></i><i></i><i></i><i></i><b></b><em></em></div>
      <header class="dh-topbar">
        <button class="dh-brand" type="button" data-dh-view="home"><span><i></i><b>HH</b></span><div><small>COMMUNITY ORBIT</small><strong>Discord Center</strong></div></button>
        <label class="dh-search"><span>⌕</span><input type="search" data-dh-search placeholder="Tìm kênh, người gửi hoặc nội dung…" autocomplete="off"><kbd>Ctrl K</kbd></label>
        <div class="dh-top-actions"><span class="dh-live-pill" data-dh-live-pill><i></i> Live 5s</span><button type="button" data-dh-refresh title="Đồng bộ">↻</button><button type="button" data-dh-inspector title="Trust Center">ⓘ</button><div class="dh-profile" data-dh-profile>${profileMarkup(null)}</div></div>
      </header>
      <div class="dh-cockpit">
        <aside class="dh-guild-rail"><button class="is-active dh-home-orb" type="button" data-dh-view="home" title="Trang chủ Discord"><b>HH</b></button><div data-dh-guilds></div><button type="button" data-dh-invite title="Thêm hoặc cập nhật quyền bot HH">＋</button></aside>
        <aside class="dh-channel-panel">
          <header><div><small>DISCORD WORKSPACE</small><strong data-dh-context-title>Trung tâm kết nối</strong></div><button type="button" data-dh-channels-close aria-label="Đóng">×</button></header>
          <nav class="dh-primary-nav"><button class="is-active" type="button" data-dh-view="home"><i>⌂</i><span>Trang chủ<small>Server và trạng thái</small></span></button><button type="button" data-dh-view="inbox"><i>◇</i><span>Chưa đọc<small data-dh-unread-label>Không có cập nhật</small></span></button><button type="button" data-dh-view="saved"><i>☆</i><span>Đã lưu<small>Kho cá nhân trên thiết bị</small></span></button><button type="button" data-dh-view="activity"><i>↗</i><span>Hoạt động<small>Nhật ký bảo mật 90 ngày</small></span></button><button type="button" data-dh-view="settings"><i>⚙</i><span>Tích hợp<small>OAuth, quyền và riêng tư</small></span></button></nav>
          <div class="dh-channel-list" data-dh-channels><div class="dh-side-empty"><span>#</span><p>Chọn một server để xem kênh và thread bot HH được phép truy cập.</p></div></div>
          <footer><i data-dh-presence></i><span><strong data-dh-connection-label>Đang kiểm tra</strong><small data-dh-connection-copy>OAuth và bot Discord</small></span></footer>
        </aside>
        <main class="dh-main">
          <div class="dh-mobile-bar"><button type="button" data-dh-channels-open>☰ Kênh</button><strong data-dh-mobile-title>Discord Center</strong><button type="button" data-dh-inspector>ⓘ</button></div>
          <header class="dh-room-head"><div><span data-dh-room-icon>✦</span><div><strong data-dh-room-title>Discord Center</strong><small data-dh-room-topic>Kết nối cộng đồng Discord với HH Platform</small></div></div><div><button type="button" data-dh-thread-create hidden>＋ Thread</button><button type="button" data-dh-refresh>↻ Đồng bộ</button><a href="https://discord.com/app" target="_blank" rel="noopener">Mở Discord ↗</a></div></header>
          <section class="dh-content" data-dh-content><div class="dh-loading"><i></i><strong>Đang kiểm tra kết nối Discord…</strong><small>Token luôn nằm ở backend được mã hóa.</small></div></section>
          <form class="dh-composer" data-dh-composer hidden><div class="dh-compose-context" data-dh-compose-context hidden><span data-dh-compose-context-label></span><button type="button" data-dh-compose-context-clear aria-label="Đóng">×</button></div><input type="file" data-dh-file accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain" hidden><button type="button" data-dh-attach title="Đính kèm ảnh, PDF hoặc TXT tối đa 1,5 MB">＋</button><textarea rows="1" maxlength="2000" data-dh-message placeholder="Nhắn bằng HH Discord Bot…"></textarea><span data-dh-count>0/2000</span><button type="submit" data-dh-send>Gửi ➤</button><small>Tên gửi: HH Discord Bot · mentions bị tắt · Enter để gửi, Shift+Enter xuống dòng.</small></form>
        </main>
        <aside class="dh-inspector" data-dh-inspector-panel aria-hidden="true"><header><div><small>TRUST CENTER</small><strong>Tích hợp Discord</strong></div><button type="button" data-dh-inspector-close>×</button></header><div data-dh-inspector-body></div></aside>
      </div><div class="dh-toast" role="status" aria-live="polite" data-dh-toast hidden></div>
    </section>`;
  }

  function connectMarkup(status = {}) {
    const configured = status.configured !== false;
    const authRequired = status.authRequired === true;
    return `<section class="dh-welcome"><div class="dh-discord-core" aria-hidden="true"><i></i><i></i><i></i><span>HH</span></div><div><small>HH × DISCORD</small><h2>Cộng đồng Discord trong một quỹ đạo an toàn.</h2><p>Liên kết bằng OAuth chính thức, sau đó mời bot HH vào đúng server. Không dùng mật khẩu Discord, user token hay self-bot.</p><div class="dh-welcome-actions"><button class="dh-primary" type="button" data-dh-connect ${configured && !authRequired ? "" : "disabled"}>${authRequired ? "Đăng nhập HH để kết nối" : configured ? "Kết nối Discord" : "Discord OAuth chưa cấu hình"}</button><a href="https://discord.com/developers/docs/topics/oauth2" target="_blank" rel="noopener">Quyền & OAuth ↗</a></div><div class="dh-trust-row"><span><b>✓</b> OAuth chính thức</span><span><b>✓</b> AES-256-GCM</span><span><b>✓</b> Không self-bot</span><span><b>✓</b> Cô lập theo tài khoản</span></div></div></section><section class="dh-feature-grid"><article><i>◎</i><strong>Danh tính riêng tư</strong><p>Hồ sơ Discord chỉ hiện với tài khoản HH đã liên kết.</p></article><article><i>#</i><strong>Kênh có kiểm soát</strong><p>Đọc, trả lời, thread và reaction theo quyền bot thực tế.</p></article><article><i>✦</i><strong>Live Sync thích ứng</strong><p>Đồng bộ nhanh khi mở, tự giảm khi tab ẩn hoặc máy yếu.</p></article></section>`;
  }

  function homeMarkup() {
    const { status, guilds } = session.state;
    if (!status?.connection) return connectMarkup(status || {});
    const installed = guilds.filter((item) => item.botInstalled).length;
    const unread = unreadChannels().length;
    return `<section class="dh-dashboard"><header><div><small>DISCORD MISSION CONTROL</small><h2>Xin chào, ${esc(status.connection.username)}</h2><p>Chọn server để đọc kênh, mở thread, reaction, trả lời và chia sẻ tệp bằng bot HH.</p></div><div class="dh-account-hero">${profileMarkup(status.connection)}<b>OAuth đã xác minh</b></div></header><div class="dh-metric-grid"><article><span>SERVER LIÊN KẾT</span><strong>${guilds.length}</strong><small>Dữ liệu từ Discord API</small></article><article><span>BOT SẴN SÀNG</span><strong>${installed}</strong><small>Server có thể mở workspace</small></article><article><span>CHƯA ĐỌC</span><strong>${unread}</strong><small>Theo thiết bị hiện tại</small></article><article><span>LIVE SYNC</span><strong>5s</strong><small>Tự giảm khi tab ẩn</small></article></div><div class="dh-home-columns"><section><header><span>SERVER CỦA BẠN</span><button type="button" data-dh-invite>＋ Cập nhật bot</button></header>${guilds.length ? `<div class="dh-server-cards">${guilds.slice(0, 12).map(guildCard).join("")}</div>` : '<div class="dh-empty-card"><b>◎</b><p>Chưa tìm thấy server trong quyền OAuth.</p></div>'}</section><section class="dh-security-card"><span>KHẢ NĂNG 2.0</span><h3>Thật, rõ quyền, dễ thu hồi</h3><ul><li><b>Bot</b><span>Đọc · gửi · reply · reaction</span></li><li><b>Thread</b><span>Tạo và tham gia công khai</span></li><li><b>Tệp</b><span>Ảnh · PDF · TXT ≤ 1,5 MB</span></li><li><b>Audit</b><span>Lịch sử thao tác 90 ngày</span></li></ul><button type="button" data-dh-view="settings">Mở Trust Center</button></section></div></section>`;
  }

  function guildCard(guild) {
    return `<button type="button" data-dh-guild="${guild.id}" class="${guild.botInstalled ? "is-ready" : ""}">${guild.icon ? `<img src="${esc(guild.icon)}" alt="">` : `<i>${esc(initials(guild.name))}</i>`}<span><strong>${esc(guild.name)}</strong><small>${guild.botInstalled ? "Bot HH đã sẵn sàng" : guild.canManage ? "Có thể cài bot HH" : "Chưa có quyền quản lý"}</small></span><b>${guild.botInstalled ? "Mở →" : "Thiết lập"}</b></button>`;
  }

  function unreadChannels() {
    const read = readJson(READ_KEY, {});
    return session.state.channels.filter((channel) => channel.lastMessageId && read[channel.id] !== channel.lastMessageId);
  }

  function inboxMarkup() {
    const items = unreadChannels();
    return `<section class="dh-saved"><header><small>ORBIT INBOX</small><h2>Cập nhật chưa đọc</h2><p>Trạng thái chỉ lưu trên thiết bị. HH không sao chép nội dung tin nhắn vào cơ sở dữ liệu riêng.</p></header>${items.length ? `<div class="dh-inbox-grid">${items.map((item) => `<button type="button" data-dh-channel="${item.id}"><i>${[10, 11, 12].includes(item.type) ? "⌁" : "#"}</i><span><strong>${esc(item.name)}</strong><small>${esc(item.topic || "Có cập nhật mới")}</small></span><b>Mở →</b></button>`).join("")}</div>` : '<div class="dh-empty"><span>✓</span><h3>Bạn đã xem hết</h3><p>Chọn một server để đồng bộ các kênh bot được phép đọc.</p></div>'}</section>`;
  }

  function savedMarkup() {
    const items = readSaved();
    return `<section class="dh-saved"><header><small>PERSONAL VAULT</small><h2>Tin nhắn đã lưu</h2><p>Chỉ lưu trên thiết bị hiện tại và không đồng bộ ngược lên Discord.</p></header>${items.length ? `<div class="dh-saved-list">${items.map((item) => messageMarkup(item, true)).join("")}</div>` : '<div class="dh-empty"><span>☆</span><h3>Chưa có tin nhắn đã lưu</h3><p>Chọn ngôi sao cạnh tin nhắn quan trọng.</p></div>'}</section>`;
  }

  function activityMarkup() {
    const events = session.state.audit;
    const labels = { "oauth.connected": "Kết nối OAuth", "message.sent_as_bot": "Gửi tin nhắn", "message.attachment_sent": "Gửi tệp", "message.edited_as_bot": "Sửa tin bot", "message.deleted_as_bot": "Xóa tin bot", "reaction.added": "Thêm reaction", "reaction.removed": "Bỏ reaction", "thread.created": "Tạo thread", "connection.disconnected": "Ngắt kết nối" };
    return `<section class="dh-activity"><header><div><small>SECURITY LEDGER</small><h2>Hoạt động Discord</h2><p>Nhật ký tối giản theo tài khoản HH, tự xóa sau ${session.state.auditRetention || 90} ngày.</p></div><button type="button" data-dh-audit-refresh>↻ Làm mới</button></header>${events.length ? `<div class="dh-timeline">${events.map((item) => `<article><i></i><div><strong>${esc(labels[item.action] || item.action)}</strong><small>${esc(item.target || "Discord Center")}</small></div><time>${date(item.createdAt)}</time><b>${esc(item.result || "ok")}</b></article>`).join("")}</div>` : '<div class="dh-empty"><span>↗</span><h3>Chưa có hoạt động</h3><p>Nhật ký sẽ xuất hiện sau các thao tác OAuth, gửi tin, reaction hoặc thread.</p></div>'}</section>`;
  }

  function settingsMarkup() {
    const { status } = session.state;
    if (!status?.connection) return connectMarkup(status || {});
    const value = prefs();
    const capability = (active, title, copy) => `<li class="${active ? "is-on" : ""}"><i>${active ? "✓" : "—"}</i><span><strong>${title}</strong><small>${copy}</small></span></li>`;
    return `<section class="dh-settings"><header><small>INTEGRATION & PRIVACY</small><h2>Trust Center Discord</h2><p>Mọi secret nằm trên server; giao diện chỉ nhận dữ liệu đã lọc theo tài khoản HH hiện tại.</p></header><div class="dh-settings-grid"><section><h3>Tài khoản liên kết</h3><div class="dh-linked-account">${profileMarkup(status.connection)}<b>Hoạt động</b></div><dl><div><dt>Scopes OAuth</dt><dd>${status.connection.scopes.map(esc).join(" · ") || "identify · guilds"}</dd></div><div><dt>Kết nối</dt><dd>${date(status.connection.connectedAt)}</dd></div><div><dt>Gửi dưới tên</dt><dd>HH Discord Bot</dd></div></dl><button class="dh-danger" type="button" data-dh-disconnect>Ngắt kết nối và thu hồi token</button></section><section><h3>Khả năng hiện tại</h3><ul class="dh-capabilities">${capability(status.capabilities.identity, "Danh tính OAuth", "Chỉ tài khoản HH hiện tại")}${capability(status.capabilities.messages, "Kênh và lịch sử", "Theo quyền bot trên server")}${capability(status.capabilities.attachments, "Tệp đính kèm", "Kiểm tra MIME · tối đa 1,5 MB")}${capability(status.capabilities.reactions, "Reaction và reply", "Không tự mention thành viên")}${capability(status.capabilities.threads, "Thread công khai", "Cần quyền server tương ứng")}${capability(status.capabilities.adaptiveSync, "Live Sync thích ứng", "5 giây khi mở · giảm khi ẩn")}${capability(false, "Voice và DM cá nhân", "Chỉ dùng trong Discord chính thức")}</ul><button class="dh-primary" type="button" data-dh-invite>Mời hoặc cập nhật quyền bot</button></section><section class="dh-preference-card"><h3>Trải nghiệm trên thiết bị</h3><label><span><strong>Thông báo trình duyệt</strong><small>Chỉ báo tên kênh, không đưa nội dung riêng tư vào thông báo.</small></span><input type="checkbox" data-dh-pref="notifications" ${value.notifications ? "checked" : ""}><i></i></label><label><span><strong>Giao diện gọn</strong><small>Giảm khoảng cách khi theo dõi nhiều tin.</small></span><input type="checkbox" data-dh-pref="compact" ${value.compact ? "checked" : ""}><i></i></label><label class="dh-select-row"><span><strong>Chuyển động</strong><small>Tự tắt khi tab ẩn và theo reduced motion.</small></span><select data-dh-pref="animation"><option value="static" ${value.animation === "static" ? "selected" : ""}>Tĩnh</option><option value="balanced" ${value.animation === "balanced" ? "selected" : ""}>Cân bằng</option><option value="cinematic" ${value.animation === "cinematic" ? "selected" : ""}>Điện ảnh</option></select></label></section><section class="dh-privacy-card"><h3>Giới hạn an toàn</h3><ul><li>Không đọc hoặc gửi DM cá nhân.</li><li>Không dùng user token hay mật khẩu Discord.</li><li>Chỉ sửa/xóa tin do chính bot HH gửi.</li><li>Bot chỉ thấy kênh Discord cấp quyền.</li><li>Ngắt kết nối sẽ thu hồi OAuth token.</li></ul></section></div></section>`;
  }

  function messageMarkup(message, savedView = false) {
    const saved = isSaved(message.id);
    const files = Array.isArray(message.attachments) && message.attachments.length ? `<div class="dh-attachments">${message.attachments.map((item) => `<a href="${esc(item.url)}" target="_blank" rel="noopener"><i>${String(item.contentType).startsWith("image/") ? "▧" : "◇"}</i><span><strong>${esc(item.filename)}</strong><small>${Math.max(1, Math.round(Number(item.size || 0) / 1024))} KB</small></span></a>`).join("")}</div>` : "";
    const reactions = Array.isArray(message.reactions) && message.reactions.length ? `<div class="dh-reactions">${message.reactions.map((reaction) => `<button type="button" data-dh-react="${esc(reaction.emoji)}" class="${reaction.me ? "is-mine" : ""}">${esc(reaction.label)} <b>${reaction.count}</b></button>`).join("")}</div>` : "";
    const controls = savedView ? `<button type="button" data-dh-save-message title="Bỏ lưu">★</button>` : `<button type="button" data-dh-reply title="Trả lời">↩</button><button type="button" data-dh-react="👍" title="Thích">👍</button><button type="button" data-dh-react="✨" title="Tỏa sáng">✨</button><button type="button" data-dh-copy-message title="Sao chép">⧉</button><button type="button" data-dh-save-message title="${saved ? "Bỏ lưu" : "Lưu"}">${saved ? "★" : "☆"}</button>${message.canManage ? '<button type="button" data-dh-edit-message title="Sửa tin bot">✎</button><button type="button" data-dh-delete-message title="Xóa tin bot">×</button>' : ""}`;
    return `<article class="dh-message ${message.author?.bot ? "is-bot" : ""}" data-dh-message-id="${esc(message.id)}" data-dh-message-search="${esc(`${message.author?.username || ""} ${message.content || ""}`.toLowerCase())}">${message.author?.avatar ? `<img src="${esc(message.author.avatar)}" alt="">` : `<span class="dh-message-avatar">${esc(initials(message.author?.username))}</span>`}<div><header><strong>${esc(message.author?.username || "Discord")}</strong>${message.author?.bot ? "<b>BOT</b>" : ""}<time>${date(message.timestamp)}</time><span class="dh-message-actions">${controls}</span></header>${message.replyTo?.messageId ? '<small class="dh-reply-note">↩ Tin trả lời</small>' : ""}<p>${esc(message.content || (files ? "" : "Tin nhắn không có nội dung văn bản."))}</p>${files}${reactions}${savedView ? `<small class="dh-saved-source">#${esc(message.channelName || "Discord")} · ${esc(message.guildName || "Server")}</small>` : ""}</div></article>`;
  }

  function messagesMarkup() {
    const messages = session.state.messages;
    const older = session.state.hasMore ? '<button class="dh-load-older" type="button" data-dh-load-older>↑ Tải tin cũ hơn</button>' : "";
    if (!messages.length) return '<div class="dh-empty"><span>#</span><h3>Kênh chưa có tin nhắn</h3><p>Bot HH chỉ thấy nội dung Discord cho phép đọc.</p></div>';
    return `${older}<div class="dh-message-stream">${messages.map((item) => messageMarkup(item)).join("")}</div>`;
  }

  function setContent(markup) { const node = session?.host.querySelector("[data-dh-content]"); if (node) node.innerHTML = markup; }
  function setBusy(busy, message = "Đang đồng bộ Discord…") { session.state.busy = busy; session.host.querySelector("[data-discord-hub]")?.classList.toggle("is-busy", busy); if (busy) setContent(`<div class="dh-loading"><i></i><strong>${esc(message)}</strong><small>Vui lòng giữ workspace đang mở.</small></div>`); }
  function toast(message, type = "success") { const node = session?.host.querySelector("[data-dh-toast]"); if (!node) return; node.textContent = message; node.dataset.type = type; node.hidden = false; clearTimeout(session.toastTimer); session.toastTimer = setTimeout(() => { node.hidden = true; }, 3200); }

  function renderGuilds() {
    const node = session.host.querySelector("[data-dh-guilds]");
    node.innerHTML = session.state.guilds.map((guild) => `<button type="button" data-dh-guild="${guild.id}" class="${session.state.guild?.id === guild.id ? "is-active" : ""} ${guild.botInstalled ? "is-ready" : ""}" title="${esc(guild.name)}">${guild.icon ? `<img src="${esc(guild.icon)}" alt="">` : `<b>${esc(initials(guild.name))}</b>`}<i></i></button>`).join("");
  }

  function renderChannels() {
    const node = session.host.querySelector("[data-dh-channels]");
    const guild = session.state.guild;
    session.host.querySelector("[data-dh-context-title]").textContent = guild?.name || "Trung tâm kết nối";
    if (!guild) { node.innerHTML = '<div class="dh-side-empty"><span>#</span><p>Chọn một server để xem các kênh bot HH được phép truy cập.</p></div>'; return; }
    if (!guild.botInstalled) { node.innerHTML = '<div class="dh-side-empty"><span>＋</span><p>Bot HH chưa có mặt trong server này.</p><button type="button" data-dh-invite>Thêm bot HH</button></div>'; return; }
    const read = readJson(READ_KEY, {});
    const markup = (items, label, icon) => items.length ? `<span class="dh-list-label">${label} · ${items.length}</span>${items.map((channel) => `<button type="button" data-dh-channel="${channel.id}" class="${session.state.channel?.id === channel.id ? "is-active" : ""} ${channel.lastMessageId && read[channel.id] !== channel.lastMessageId ? "has-unread" : ""}"><i>${icon}</i><span><strong>${esc(channel.name)}</strong><small>${esc(channel.topic || (icon === "#" ? "Kênh Discord" : "Thread Discord"))}</small></span><b></b></button>`).join("")}` : "";
    const channels = session.state.channels.filter((item) => ![10, 11, 12].includes(item.type));
    const threads = session.state.channels.filter((item) => [10, 11, 12].includes(item.type));
    node.innerHTML = markup(channels, "KÊNH VĂN BẢN", "#") + markup(threads, "THREAD ĐANG HOẠT ĐỘNG", "⌁") || '<div class="dh-side-empty"><span>#</span><p>Không có kênh văn bản bot được phép xem.</p></div>';
    updateUnreadLabel();
  }

  function updateUnreadLabel() { const count = unreadChannels().length; const label = session.host.querySelector("[data-dh-unread-label]"); if (label) label.textContent = count ? `${count} kênh có cập nhật` : "Không có cập nhật"; }
  function updateHeaders(title, topic = "") { session.host.querySelector("[data-dh-room-title]").textContent = title; session.host.querySelector("[data-dh-mobile-title]").textContent = title; session.host.querySelector("[data-dh-room-topic]").textContent = topic; }

  function renderInspector() {
    const { status, guild, channel } = session.state;
    const body = session.host.querySelector("[data-dh-inspector-body]"); if (!body) return;
    const type = channel ? ([10, 11, 12].includes(channel.type) ? "Thread" : "Kênh văn bản") : "—";
    body.innerHTML = `<section><small>KẾT NỐI</small><div class="dh-inspector-status ${status?.connection ? "is-on" : ""}"><i></i><span><strong>${status?.connection ? "Discord đã liên kết" : "Chưa liên kết"}</strong><small>${status?.connection ? `@${esc(status.connection.handle)}` : "Cần OAuth identify + guilds"}</small></span></div></section><section><small>NGỮ CẢNH</small><dl><div><dt>Server</dt><dd>${esc(guild?.name || "Chưa chọn")}</dd></div><div><dt>Kênh</dt><dd>${esc(channel ? `#${channel.name}` : "Chưa chọn")}</dd></div><div><dt>Loại</dt><dd>${type}</dd></div><div><dt>Đồng bộ</dt><dd>Thích ứng · 5–12 giây</dd></div><div><dt>Gửi dưới tên</dt><dd>HH Discord Bot</dd></div></dl></section><section><small>QUYỀN HIỆN TẠI</small><p>Xem kênh · đọc lịch sử · gửi tin · reply · reaction · tệp · thread. Quyền thực tế vẫn do từng kênh Discord quyết định.</p></section><section><small>NGUYÊN TẮC AN TOÀN</small><p>Không đọc DM, không dùng mật khẩu hoặc user token, không tự mention, chỉ sửa/xóa tin do bot HH gửi.</p></section><footer><a href="https://support.discord.com/hc/en-us/articles/206029707" target="_blank" rel="noopener">Tìm hiểu quyền server ↗</a></footer>`;
  }

  function applyPreferences() {
    const value = prefs(); const hub = session?.host.querySelector("[data-discord-hub]"); if (!hub) return;
    hub.classList.toggle("is-compact", value.compact); hub.dataset.motion = value.animation;
  }

  async function loadStatus() {
    setBusy(true, "Đang xác minh OAuth và bot Discord…");
    try {
      session.state.status = await api("status"); session.host.querySelector("[data-dh-profile]").innerHTML = profileMarkup(session.state.status.connection);
      const online = Boolean(session.state.status.connection); session.host.querySelector("[data-dh-presence]").classList.toggle("is-on", online);
      session.host.querySelector("[data-dh-connection-label]").textContent = online ? "Discord đã kết nối" : "Chưa kết nối";
      session.host.querySelector("[data-dh-connection-copy]").textContent = online ? (session.state.status.botConfigured ? "OAuth + HH Bot" : "OAuth · bot chưa cấu hình") : "OAuth bảo mật";
      if (online) await loadGuilds(); else { session.state.guilds = []; renderGuilds(); setContent(homeMarkup()); }
    } catch (error) { session.state.status = { configured: error.status === 401 || error.code === "AUTH_REQUIRED", authRequired: error.status === 401 || error.code === "AUTH_REQUIRED", connection: null }; setContent(connectMarkup(session.state.status)); }
    finally { session.state.busy = false; session.host.querySelector("[data-discord-hub]")?.classList.remove("is-busy"); renderInspector(); scheduleSync(); }
  }

  async function loadGuilds() { const data = await api("guilds"); session.state.guilds = data.guilds || []; renderGuilds(); if (session.state.view === "home") setContent(homeMarkup()); }

  async function selectGuild(id) {
    const guild = session.state.guilds.find((item) => item.id === id); if (!guild) return;
    session.state.guild = guild; session.state.channel = null; session.state.channels = []; session.state.messages = []; session.state.replyTo = null; session.state.file = null;
    renderGuilds(); renderChannels(); renderInspector(); resetComposer(); closeMobilePanels();
    if (!guild.botInstalled) { setView("home"); toast("Hãy mời hoặc cập nhật quyền bot HH cho server này.", "error"); return; }
    updateHeaders(guild.name, "Đang tải kênh và thread bot HH có thể truy cập…"); setBusy(true, `Đang tải workspace ${guild.name}…`);
    try { const [channelData, threadData] = await Promise.all([api(`guilds/${guild.id}/channels`), api(`guilds/${guild.id}/threads`).catch(() => ({ threads: [] }))]); const map = new Map([...(channelData.channels || []), ...(threadData.threads || [])].map((item) => [item.id, item])); session.state.channels = [...map.values()]; renderChannels(); setContent(`<div class="dh-empty"><span>✦</span><h3>${esc(guild.name)}</h3><p>Chọn kênh hoặc thread bên trái để bắt đầu.</p></div>`); }
    catch (error) { setContent(`<div class="dh-error"><span>!</span><h3>Không mở được server</h3><p>${esc(error.message)}</p><button type="button" data-dh-invite>Kiểm tra quyền bot</button></div>`); }
    finally { session.state.busy = false; session.host.querySelector("[data-discord-hub]")?.classList.remove("is-busy"); }
  }

  async function selectChannel(id) {
    const channel = session.state.channels.find((item) => item.id === id); if (!channel || !session.state.guild) return;
    session.state.channel = channel; session.state.view = "channel"; session.state.messages = []; session.state.replyTo = null; session.state.file = null;
    renderChannels(); closeMobilePanels(); resetComposer(); updateHeaders(`#${channel.name}`, channel.topic || `${session.state.guild.name} · Tin nhắn qua HH Discord Bot`);
    session.host.querySelector("[data-dh-room-icon]").textContent = [10, 11, 12].includes(channel.type) ? "⌁" : "#"; session.host.querySelector("[data-dh-thread-create]").hidden = Number(channel.type) !== 0; session.host.querySelector("[data-dh-composer]").hidden = false;
    const drafts = readJson(DRAFT_KEY, {}); const input = session.host.querySelector("[data-dh-message]"); input.value = String(drafts[channel.id] || ""); autoSize(input); updateCount(); await loadMessages(); renderInspector(); scheduleSync();
  }

  async function loadMessages({ silent = false, older = false } = {}) {
    if (!session.state.channel || session.state.loadingMessages) return;
    session.state.loadingMessages = true; const content = session.host.querySelector("[data-dh-content]"); const nearBottom = content.scrollHeight - content.scrollTop - content.clientHeight < 140; const previousIds = new Set(session.state.messages.map((item) => item.id)); const oldest = older ? session.state.messages[0]?.id : "";
    if (!silent && !older) setBusy(true, `Đang tải #${session.state.channel.name}…`);
    try {
      const data = await api(`channels/${session.state.channel.id}/messages?guildId=${encodeURIComponent(session.state.guild.id)}&limit=40${oldest ? `&before=${encodeURIComponent(oldest)}` : ""}`);
      if (older) { const height = content.scrollHeight; const map = new Map([...(data.messages || []), ...session.state.messages].map((item) => [item.id, item])); session.state.messages = [...map.values()]; session.state.hasMore = Boolean(data.hasMore); setContent(messagesMarkup()); applySearch(); requestAnimationFrame(() => { content.scrollTop = content.scrollHeight - height; }); }
      else { const incoming = data.messages || []; const newItems = incoming.filter((item) => !previousIds.has(item.id)); session.state.messages = incoming; session.state.hasMore = Boolean(data.hasMore); setContent(messagesMarkup()); applySearch(); if (!silent || nearBottom) requestAnimationFrame(() => { const node = session.host.querySelector("[data-dh-content]"); if (node) node.scrollTop = node.scrollHeight; }); if (newItems.length && silent && (!nearBottom || document.hidden)) notifyChannel(newItems.length); if (!document.hidden && (nearBottom || !silent)) markChannelRead(incoming.at(-1)?.id || session.state.channel.lastMessageId); }
    } catch (error) { if (!silent && !older) setContent(`<div class="dh-error"><span>!</span><h3>Không đọc được kênh</h3><p>${esc(error.message)}</p><button type="button" data-dh-refresh>Thử lại</button></div>`); else if (!silent) toast(error.message, "error"); }
    finally { session.state.loadingMessages = false; session.state.busy = false; session.host.querySelector("[data-discord-hub]")?.classList.remove("is-busy"); }
  }

  function markChannelRead(messageId) { if (!session.state.channel || !messageId) return; const read = readJson(READ_KEY, {}); read[session.state.channel.id] = messageId; writeJson(READ_KEY, read); session.state.channel.lastMessageId = messageId; renderChannels(); }
  function notifyChannel(count) { const value = prefs(); if (!value.notifications || scope.Notification?.permission !== "granted") return; try { new Notification("HH Discord Center", { body: `${count} cập nhật mới trong #${session.state.channel?.name || "Discord"}.`, tag: `hh-discord-${session.state.channel?.id || "channel"}`, silent: true }); } catch {} }

  function setView(view) {
    if (!session || !VIEWS.has(view)) return; session.state.view = view; clearSync(); session.host.querySelector("[data-dh-composer]").hidden = true; session.host.querySelector("[data-dh-thread-create]").hidden = true; session.host.querySelectorAll("[data-dh-view]").forEach((node) => node.classList.toggle("is-active", node.dataset.dhView === view));
    const meta = { home: ["✦", "Discord Center", "Kết nối cộng đồng Discord với HH Platform"], inbox: ["◇", "Cập nhật chưa đọc", "Theo dõi trên thiết bị hiện tại"], saved: ["☆", "Tin nhắn đã lưu", "Kho cá nhân chỉ trên thiết bị này"], activity: ["↗", "Hoạt động Discord", "Audit log riêng tư trong 90 ngày"], settings: ["⚙", "Trust Center Discord", "Quyền, OAuth, bot và bảo mật"] }[view]; session.host.querySelector("[data-dh-room-icon]").textContent = meta[0]; updateHeaders(meta[1], meta[2]);
    setContent(view === "home" ? homeMarkup() : view === "inbox" ? inboxMarkup() : view === "saved" ? savedMarkup() : view === "activity" ? activityMarkup() : settingsMarkup()); if (view === "activity") loadAudit(); closeMobilePanels();
  }

  async function loadAudit() { try { const data = await api("audit"); session.state.audit = data.events || []; session.state.auditRetention = data.retentionDays || 90; if (session.state.view === "activity") setContent(activityMarkup()); } catch (error) { if (session.state.view === "activity") setContent(`<div class="dh-error"><span>!</span><h3>Không tải được hoạt động</h3><p>${esc(error.message)}</p><button type="button" data-dh-audit-refresh>Thử lại</button></div>`); } }
  async function connect() { try { const data = await api("oauth/start", { method: "POST", body: { frontendOrigin: location.origin, returnHash: "#/discord" } }); location.assign(data.authorizationUrl); } catch (error) { toast(error.message, "error"); } }
  async function inviteBot() { try { const data = await api("bot/invite"); window.open(data.invitationUrl, "_blank", "noopener,noreferrer"); toast("Chọn server và xác nhận các quyền hiển thị trên Discord."); } catch (error) { toast(error.message, "error"); } }

  async function disconnect() {
    if (!confirm("Ngắt kết nối Discord, thu hồi OAuth token và xóa token đã mã hóa?")) return;
    try { await api("disconnect", { method: "DELETE" }); session.state = { ...session.state, status: { configured: true, connection: null }, guilds: [], channels: [], messages: [], guild: null, channel: null, view: "home" }; renderGuilds(); renderChannels(); setContent(connectMarkup(session.state.status)); session.host.querySelector("[data-dh-profile]").innerHTML = profileMarkup(null); toast("Đã ngắt kết nối Discord."); } catch (error) { toast(error.message, "error"); }
  }

  function resetComposer() { if (!session) return; session.state.replyTo = null; session.state.file = null; const context = session.host.querySelector("[data-dh-compose-context]"); if (context) context.hidden = true; const file = session.host.querySelector("[data-dh-file]"); if (file) file.value = ""; }
  function setReply(message) { session.state.replyTo = message; session.state.file = null; const context = session.host.querySelector("[data-dh-compose-context]"); context.hidden = false; session.host.querySelector("[data-dh-compose-context-label]").textContent = `↩ Trả lời ${message.author?.username || "Discord"}: ${String(message.content || "Tệp đính kèm").slice(0, 90)}`; session.host.querySelector("[data-dh-message]").focus({ preventScroll: true }); }
  function setAttachment(file) { if (!file) return; if (!FILE_TYPES.has(file.type) || file.size > FILE_LIMIT) { toast("Chỉ hỗ trợ PNG, JPG, GIF, WebP, PDF hoặc TXT tối đa 1,5 MB.", "error"); return; } session.state.file = file; session.state.replyTo = null; const context = session.host.querySelector("[data-dh-compose-context]"); context.hidden = false; session.host.querySelector("[data-dh-compose-context-label]").textContent = `◇ ${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB`; }
  function fileBase64(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "").split(",")[1] || ""); reader.onerror = () => reject(new Error("Không đọc được tệp.")); reader.readAsDataURL(file); }); }

  async function sendMessage(form) {
    const input = form.querySelector("[data-dh-message]"); const content = input.value.trim(); if ((!content && !session.state.file) || !session.state.channel) return;
    const button = form.querySelector("[data-dh-send]"); const hadFile = Boolean(session.state.file); button.disabled = true; button.textContent = hadFile ? "Đang tải…" : "Đang gửi…";
    try { const body = { guildId: session.state.guild.id, content, replyTo: session.state.replyTo?.id || "" }; let data; if (session.state.file) { body.filename = session.state.file.name; body.contentType = session.state.file.type; body.base64 = await fileBase64(session.state.file); data = await api(`channels/${session.state.channel.id}/messages/upload`, { method: "POST", body }); } else data = await api(`channels/${session.state.channel.id}/messages/send`, { method: "POST", body }); input.value = ""; const drafts = readJson(DRAFT_KEY, {}); delete drafts[session.state.channel.id]; writeJson(DRAFT_KEY, drafts); autoSize(input); resetComposer(); updateCount(); session.state.messages.push(data.message); setContent(messagesMarkup()); requestAnimationFrame(() => { const node = session.host.querySelector("[data-dh-content]"); node.scrollTop = node.scrollHeight; }); markChannelRead(data.message.id); toast(hadFile ? "Đã gửi tệp bằng HH Discord Bot." : "Đã gửi bằng HH Discord Bot."); }
    catch (error) { toast(error.message, "error"); }
    finally { button.disabled = false; button.textContent = "Gửi ➤"; input.focus({ preventScroll: true }); }
  }

  async function toggleReaction(message, emoji) { const current = (message.reactions || []).find((item) => item.emoji === emoji || item.label === emoji); try { await api(`channels/${session.state.channel.id}/messages/${message.id}/reactions`, { method: "POST", body: { guildId: session.state.guild.id, emoji, remove: Boolean(current?.me) } }); await loadMessages({ silent: true }); toast(current?.me ? "Đã bỏ reaction." : "Đã thêm reaction."); } catch (error) { toast(error.message, "error"); } }
  async function editMessage(message) { const next = prompt("Sửa tin nhắn do HH Discord Bot gửi:", message.content || ""); if (next === null || !next.trim() || next.trim() === message.content) return; try { const data = await api(`channels/${session.state.channel.id}/messages/${message.id}`, { method: "PATCH", body: { guildId: session.state.guild.id, content: next.trim() } }); session.state.messages = session.state.messages.map((item) => item.id === message.id ? data.message : item); setContent(messagesMarkup()); toast("Đã cập nhật tin nhắn bot."); } catch (error) { toast(error.message, "error"); } }
  async function deleteMessage(message) { if (!confirm("Xóa vĩnh viễn tin nhắn này khỏi Discord? Chỉ tin do HH Bot gửi mới được phép xóa.")) return; try { await api(`channels/${session.state.channel.id}/messages/${message.id}`, { method: "DELETE", body: { guildId: session.state.guild.id } }); session.state.messages = session.state.messages.filter((item) => item.id !== message.id); setContent(messagesMarkup()); toast("Đã xóa tin nhắn bot."); } catch (error) { toast(error.message, "error"); } }
  async function createThread() { if (!session.state.channel || Number(session.state.channel.type) !== 0) return; const name = prompt("Tên thread công khai mới:", "Chủ đề mới"); if (!name?.trim()) return; try { const data = await api(`channels/${session.state.channel.id}/threads`, { method: "POST", body: { guildId: session.state.guild.id, name: name.trim(), autoArchiveDuration: 1440 } }); session.state.channels.push(data.thread); renderChannels(); toast(`Đã tạo thread “${data.thread.name}”.`); } catch (error) { toast(error.message, "error"); } }

  function toggleSaved(messageId) { const message = session.state.messages.find((item) => item.id === messageId) || readSaved().find((item) => item.id === messageId); if (!message) return; let saved = readSaved(); const exists = saved.some((item) => item.id === messageId); saved = exists ? saved.filter((item) => item.id !== messageId) : [{ ...message, guildName: session.state.guild?.name || message.guildName, channelName: session.state.channel?.name || message.channelName, savedAt: new Date().toISOString() }, ...saved]; writeSaved(saved); if (session.state.view === "saved") setContent(savedMarkup()); else setContent(messagesMarkup()); toast(exists ? "Đã bỏ lưu tin nhắn." : "Đã lưu tin nhắn trên thiết bị."); }
  function applySearch() { const query = String(session.host.querySelector("[data-dh-search]")?.value || "").trim().toLowerCase(); session.host.querySelectorAll("[data-dh-message-search]").forEach((node) => { node.hidden = Boolean(query && !node.dataset.dhMessageSearch.includes(query)); }); session.host.querySelectorAll("[data-dh-channel]").forEach((node) => { node.hidden = Boolean(query && !node.textContent.toLowerCase().includes(query)); }); }

  async function updatePreference(node) {
    const value = prefs(); const key = node.dataset.dhPref;
    if (key === "notifications" && node.checked) { if (!("Notification" in scope)) { node.checked = false; toast("Trình duyệt không hỗ trợ thông báo.", "error"); return; } const permission = scope.Notification.permission === "granted" ? "granted" : await scope.Notification.requestPermission(); if (permission !== "granted") { node.checked = false; toast("Bạn chưa cấp quyền thông báo.", "error"); } }
    value[key] = node.type === "checkbox" ? node.checked : node.value; writeJson(PREFS_KEY, value); applyPreferences(); scheduleSync(); toast("Đã lưu tùy chọn trên thiết bị.");
  }

  function autoSize(input) { input.style.height = "auto"; input.style.height = `${Math.min(128, input.scrollHeight)}px`; }
  function updateCount() { const input = session?.host.querySelector("[data-dh-message]"); const count = session?.host.querySelector("[data-dh-count]"); if (input && count) count.textContent = `${input.value.length}/2000`; }
  function toggleInspector(open) { const hub = session.host.querySelector("[data-discord-hub]"); hub.classList.toggle("is-inspector-open", open); session.host.querySelector("[data-dh-inspector-panel]").setAttribute("aria-hidden", String(!open)); }
  function closeMobilePanels() { session?.host.querySelector("[data-discord-hub]")?.classList.remove("is-channels-open"); }
  function clearSync() { if (session?.syncTimer) clearTimeout(session.syncTimer); if (session) session.syncTimer = 0; }
  function scheduleSync() { clearSync(); if (!session?.state.channel || session.state.view !== "channel") return; const delay = document.hidden || prefs().sync === "relaxed" ? SYNC_IDLE_MS : SYNC_ACTIVE_MS; session.syncTimer = setTimeout(async () => { if (!document.hidden || prefs().sync !== "paused") await loadMessages({ silent: true }); scheduleSync(); }, delay); const pill = session.host.querySelector("[data-dh-live-pill]"); if (pill) pill.lastChild.textContent = document.hidden ? " Live 12s" : " Live 5s"; }
  async function copyMessage(message) { try { await navigator.clipboard.writeText(message.content || ""); toast("Đã sao chép tin nhắn."); } catch { toast("Trình duyệt chưa cho phép sao chép.", "error"); } }
  function messageFromEvent(event) { const article = event.target.closest("[data-dh-message-id]"); return article ? session.state.messages.find((item) => item.id === article.dataset.dhMessageId) || readSaved().find((item) => item.id === article.dataset.dhMessageId) : null; }

  function onClick(event) {
    const view = event.target.closest("[data-dh-view]"); if (view) return setView(view.dataset.dhView);
    const guild = event.target.closest("[data-dh-guild]"); if (guild) return selectGuild(guild.dataset.dhGuild);
    const channel = event.target.closest("[data-dh-channel]"); if (channel) return selectChannel(channel.dataset.dhChannel);
    const message = messageFromEvent(event);
    if (message && event.target.closest("[data-dh-save-message]")) return toggleSaved(message.id);
    if (message && event.target.closest("[data-dh-reply]")) return setReply(message);
    if (message && event.target.closest("[data-dh-copy-message]")) return copyMessage(message);
    const react = event.target.closest("[data-dh-react]"); if (message && react) return toggleReaction(message, react.dataset.dhReact);
    if (message && event.target.closest("[data-dh-edit-message]")) return editMessage(message);
    if (message && event.target.closest("[data-dh-delete-message]")) return deleteMessage(message);
    if (event.target.closest("[data-dh-load-older]")) return loadMessages({ older: true });
    if (event.target.closest("[data-dh-connect]")) return connect();
    if (event.target.closest("[data-dh-invite]")) return inviteBot();
    if (event.target.closest("[data-dh-disconnect]")) return disconnect();
    if (event.target.closest("[data-dh-thread-create]")) return createThread();
    if (event.target.closest("[data-dh-attach]")) return session.host.querySelector("[data-dh-file]").click();
    if (event.target.closest("[data-dh-compose-context-clear]")) return resetComposer();
    if (event.target.closest("[data-dh-audit-refresh]")) return loadAudit();
    if (event.target.closest("[data-dh-refresh]")) return session.state.channel ? loadMessages() : loadStatus();
    if (event.target.closest("[data-dh-inspector]")) return toggleInspector(true);
    if (event.target.closest("[data-dh-inspector-close]")) return toggleInspector(false);
    if (event.target.closest("[data-dh-channels-open]")) return session.host.querySelector("[data-discord-hub]").classList.add("is-channels-open");
    if (event.target.closest("[data-dh-channels-close]")) return closeMobilePanels();
  }

  function onSubmit(event) { if (!event.target.matches("[data-dh-composer]")) return; event.preventDefault(); sendMessage(event.target); }
  function onInput(event) { if (event.target.matches("[data-dh-search]")) return applySearch(); if (event.target.matches("[data-dh-message]")) { autoSize(event.target); updateCount(); if (session.state.channel) { const drafts = readJson(DRAFT_KEY, {}); if (event.target.value) drafts[session.state.channel.id] = event.target.value; else delete drafts[session.state.channel.id]; writeJson(DRAFT_KEY, drafts); } } }
  function onChange(event) { if (event.target.matches("[data-dh-file]")) setAttachment(event.target.files?.[0]); if (event.target.matches("[data-dh-pref]")) updatePreference(event.target); }
  function onKeydown(event) { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); focus(); } if (event.target.matches("[data-dh-message]") && event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.target.closest("form").requestSubmit(); } if (event.key === "Escape") { toggleInspector(false); closeMobilePanels(); } }
  function onVisibility() { session?.host.querySelector("[data-discord-hub]")?.classList.toggle("is-tab-hidden", document.hidden); scheduleSync(); }
  function focus() { session?.host.querySelector(session.state.channel ? "[data-dh-message]" : "[data-dh-search]")?.focus({ preventScroll: true }); }

  function mount(host, options = {}) {
    if (!host) return false; unmount(); host.innerHTML = shellMarkup();
    session = { host, apiBase: String(options.apiBase || scope.HH_API_BASE || location.origin).replace(/\/$/, ""), state: { status: null, guilds: [], channels: [], messages: [], audit: [], auditRetention: 90, guild: null, channel: null, replyTo: null, file: null, hasMore: false, view: "home", busy: false, loadingMessages: false }, toastTimer: 0, syncTimer: 0, onClick, onSubmit, onInput, onChange, onKeydown, onVisibility };
    host.addEventListener("click", onClick); host.addEventListener("submit", onSubmit); host.addEventListener("input", onInput); host.addEventListener("change", onChange); host.addEventListener("keydown", onKeydown); document.addEventListener("visibilitychange", onVisibility); applyPreferences();
    const oauthResult = new URLSearchParams(location.search).get("discord"); if (oauthResult === "connected") { toast("Đã kết nối tài khoản Discord."); history.replaceState({}, document.title, `${location.pathname}#/discord`); } else if (oauthResult) { toast(`Discord OAuth chưa hoàn tất: ${oauthResult}`, "error"); history.replaceState({}, document.title, `${location.pathname}#/discord`); }
    loadStatus(); return true;
  }

  function unmount() { if (!session) return; clearSync(); clearTimeout(session.toastTimer); session.host.removeEventListener("click", session.onClick); session.host.removeEventListener("submit", session.onSubmit); session.host.removeEventListener("input", session.onInput); session.host.removeEventListener("change", session.onChange); session.host.removeEventListener("keydown", session.onKeydown); document.removeEventListener("visibilitychange", session.onVisibility); session = null; }
  return Object.freeze({ version: "2.0.0", mount, unmount, focus });
});
