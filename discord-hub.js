(function initHHDiscordHub(scope, factory) {
  const api = factory(scope);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (scope) scope.HHDiscordHub = api;
})(typeof window !== "undefined" ? window : globalThis, function createHHDiscordHub(scope) {
  "use strict";

  const SAVED_KEY = "hh.discord.saved-messages.v1";
  let session = null;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const initials = (value) => String(value || "D").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const date = (value) => { try { return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(new Date(value)); } catch { return ""; } };
  const currentToken = () => scope.HHAuthSession?.token?.() || "";

  function readSaved() { try { const value = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } }
  function writeSaved(items) { try { localStorage.setItem(SAVED_KEY, JSON.stringify(items.slice(0, 200))); } catch {} }
  function isSaved(id) { return readSaved().some((item) => item.id === id); }

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
      <div class="dh-ambient" aria-hidden="true"><i></i><i></i><i></i><i></i><b></b></div>
      <header class="dh-topbar">
        <button class="dh-brand" type="button" data-dh-view="home"><span><i></i><b>HH</b></span><div><small>COMMUNITY LINK</small><strong>Discord Center</strong></div></button>
        <label class="dh-search"><span>⌕</span><input type="search" data-dh-search placeholder="Tìm kênh hoặc tin nhắn…" autocomplete="off"><kbd>Ctrl K</kbd></label>
        <div class="dh-top-actions"><button type="button" data-dh-refresh title="Làm mới">↻</button><button type="button" data-dh-inspector title="Thông tin tích hợp">ⓘ</button><div class="dh-profile" data-dh-profile>${profileMarkup(null)}</div></div>
      </header>
      <div class="dh-cockpit">
        <aside class="dh-guild-rail"><button class="is-active dh-home-orb" type="button" data-dh-view="home" title="Trang chủ Discord"><b>HH</b></button><div data-dh-guilds></div><button type="button" data-dh-invite title="Thêm bot HH vào server">＋</button></aside>
        <aside class="dh-channel-panel">
          <header><div><small>DISCORD WORKSPACE</small><strong data-dh-context-title>Trung tâm kết nối</strong></div><button type="button" data-dh-channels-close aria-label="Đóng">×</button></header>
          <nav class="dh-primary-nav"><button class="is-active" type="button" data-dh-view="home"><i>⌂</i><span>Trang chủ<small>Trạng thái và thiết lập</small></span></button><button type="button" data-dh-view="saved"><i>☆</i><span>Đã lưu<small>Tin nhắn trên thiết bị</small></span></button><button type="button" data-dh-view="settings"><i>⚙</i><span>Tích hợp<small>OAuth, bot và quyền</small></span></button></nav>
          <div class="dh-channel-list" data-dh-channels><div class="dh-side-empty"><span>#</span><p>Chọn một server để xem các kênh bot HH được phép truy cập.</p></div></div>
          <footer><i data-dh-presence></i><span><strong data-dh-connection-label>Đang kiểm tra</strong><small data-dh-connection-copy>OAuth và bot Discord</small></span></footer>
        </aside>
        <main class="dh-main">
          <div class="dh-mobile-bar"><button type="button" data-dh-channels-open>☰ Kênh</button><strong data-dh-mobile-title>Discord Center</strong><button type="button" data-dh-inspector>ⓘ</button></div>
          <header class="dh-room-head" data-dh-room-head><div><span data-dh-room-icon>✦</span><div><strong data-dh-room-title>Discord Center</strong><small data-dh-room-topic>Kết nối cộng đồng Discord với HH Platform</small></div></div><div><button type="button" data-dh-refresh>↻ Đồng bộ</button><a href="https://discord.com/app" target="_blank" rel="noopener">Mở Discord ↗</a></div></header>
          <section class="dh-content" data-dh-content><div class="dh-loading"><i></i><strong>Đang kiểm tra kết nối Discord…</strong><small>Token luôn nằm ở backend được mã hóa.</small></div></section>
          <form class="dh-composer" data-dh-composer hidden><button type="button" data-dh-attach disabled title="Tệp đính kèm sẽ được bổ sung sau khi có kho lưu trữ">＋</button><textarea rows="1" maxlength="2000" data-dh-message placeholder="Nhắn bằng HH Discord Bot…"></textarea><span data-dh-count>0/2000</span><button type="submit" data-dh-send>Gửi ➤</button><small>Tin nhắn được gửi với tên HH Discord Bot · mentions bị tắt để chống spam.</small></form>
        </main>
        <aside class="dh-inspector" data-dh-inspector-panel aria-hidden="true"><header><div><small>TRUST CENTER</small><strong>Tích hợp Discord</strong></div><button type="button" data-dh-inspector-close>×</button></header><div data-dh-inspector-body></div></aside>
      </div>
      <div class="dh-toast" role="status" aria-live="polite" data-dh-toast hidden></div>
    </section>`;
  }

  function connectMarkup(status = {}) {
    const configured = status.configured !== false;
    const authRequired = status.authRequired === true;
    return `<section class="dh-welcome">
      <div class="dh-discord-core" aria-hidden="true"><i></i><i></i><i></i><span>HH</span></div>
      <div><small>HH × DISCORD</small><h2>Mang cộng đồng Discord vào cùng một quỹ đạo.</h2><p>Liên kết tài khoản để xem các server của bạn. Sau khi mời bot HH, bạn có thể đọc kênh được cấp quyền và gửi tin nhắn ngay trong workspace này.</p>
      <div class="dh-welcome-actions"><button class="dh-primary" type="button" data-dh-connect ${configured && !authRequired ? "" : "disabled"}>${authRequired ? "Đăng nhập HH để kết nối" : configured ? "Kết nối Discord" : "Discord OAuth chưa cấu hình"}</button><a href="https://discord.com/developers/docs/topics/oauth2" target="_blank" rel="noopener">Quyền & OAuth ↗</a></div>
      <div class="dh-trust-row"><span><b>✓</b> OAuth chính thức</span><span><b>✓</b> Token mã hóa</span><span><b>✓</b> Không self-bot</span><span><b>✓</b> Quyền theo server</span></div></div>
    </section><section class="dh-feature-grid"><article><i>◎</i><strong>Danh tính Discord</strong><p>Hiển thị hồ sơ và server đã được chính bạn cấp quyền.</p></article><article><i>#</i><strong>Kênh có kiểm soát</strong><p>Chỉ kênh bot HH nhìn thấy và có lịch sử mới tải được.</p></article><article><i>➤</i><strong>Gửi bằng bot HH</strong><p>Không giả mạo tài khoản cá nhân; mention bị vô hiệu mặc định.</p></article></section>`;
  }

  function homeMarkup() {
    const { status, guilds } = session.state;
    if (!status?.connection) return connectMarkup(status || {});
    const installed = guilds.filter((item) => item.botInstalled).length;
    return `<section class="dh-dashboard">
      <header><div><small>DISCORD MISSION CONTROL</small><h2>Xin chào, ${esc(status.connection.username)}</h2><p>Tài khoản đã liên kết. Chọn một server ở thanh quỹ đạo để mở channel workspace.</p></div><div class="dh-account-hero">${profileMarkup(status.connection)}<b>Đã xác minh OAuth</b></div></header>
      <div class="dh-metric-grid"><article><span>SERVER CỦA BẠN</span><strong>${guilds.length}</strong><small>Dữ liệu từ Discord API</small></article><article><span>BOT ĐÃ CÓ MẶT</span><strong>${installed}</strong><small>Server có thể mở kênh</small></article><article><span>CHẾ ĐỘ TIN NHẮN</span><strong>${status.botConfigured ? "BOT" : "—"}</strong><small>${status.botConfigured ? "An toàn, không giả mạo" : "Chưa cấu hình bot"}</small></article><article><span>REALTIME</span><strong>REST</strong><small>Đồng bộ nhẹ mỗi 12 giây</small></article></div>
      <div class="dh-home-columns"><section><header><span>SERVER SẴN SÀNG</span><button type="button" data-dh-invite>＋ Thêm bot</button></header>${guilds.length ? `<div class="dh-server-cards">${guilds.slice(0, 8).map((guild) => `<button type="button" data-dh-guild="${guild.id}" class="${guild.botInstalled ? "is-ready" : ""}">${guild.icon ? `<img src="${esc(guild.icon)}" alt="">` : `<i>${esc(initials(guild.name))}</i>`}<span><strong>${esc(guild.name)}</strong><small>${guild.botInstalled ? "Bot HH đã sẵn sàng" : "Cần thêm bot HH"}</small></span><b>${guild.botInstalled ? "Mở →" : "Thiết lập"}</b></button>`).join("")}</div>` : '<div class="dh-empty-card"><b>◎</b><p>Chưa tìm thấy server trong quyền OAuth hiện tại.</p></div>'}</section>
      <section class="dh-security-card"><span>BẢO MẬT KẾT NỐI</span><h3>Quyền tối thiểu, trạng thái minh bạch</h3><ul><li><b>identify</b><span>Đọc tên và avatar Discord</span></li><li><b>guilds</b><span>Liệt kê server bạn tham gia</span></li><li><b>bot</b><span>Đọc/gửi chỉ nơi server cho phép</span></li></ul><button type="button" data-dh-view="settings">Xem cấu hình tích hợp</button></section></div>
    </section>`;
  }

  function savedMarkup() {
    const items = readSaved();
    return `<section class="dh-saved"><header><small>PERSONAL VAULT</small><h2>Tin nhắn đã lưu</h2><p>Dữ liệu này chỉ được lưu trên thiết bị hiện tại, không đồng bộ ngược lên Discord.</p></header>${items.length ? `<div class="dh-saved-list">${items.map((item) => messageMarkup(item, true)).join("")}</div>` : '<div class="dh-empty"><span>☆</span><h3>Chưa có tin nhắn đã lưu</h3><p>Mở một kênh và chọn biểu tượng ngôi sao cạnh tin nhắn quan trọng.</p></div>'}</section>`;
  }

  function settingsMarkup() {
    const { status } = session.state;
    if (!status?.connection) return connectMarkup(status || {});
    const capability = (active, title, copy) => `<li class="${active ? "is-on" : ""}"><i>${active ? "✓" : "—"}</i><span><strong>${title}</strong><small>${copy}</small></span></li>`;
    return `<section class="dh-settings"><header><small>INTEGRATION & PRIVACY</small><h2>Quản lý kết nối Discord</h2><p>Mọi secret nằm trên server. Ngắt kết nối sẽ thu hồi user token khi Discord phản hồi và xóa token đã mã hóa.</p></header><div class="dh-settings-grid"><section><h3>Tài khoản đã liên kết</h3><div class="dh-linked-account">${profileMarkup(status.connection)}<b>Hoạt động</b></div><dl><div><dt>Scopes</dt><dd>${status.connection.scopes.map(esc).join(" · ") || "identify · guilds"}</dd></div><div><dt>Kết nối</dt><dd>${date(status.connection.connectedAt)}</dd></div><div><dt>Gửi tin</dt><dd>HH Discord Bot</dd></div></dl><button class="dh-danger" type="button" data-dh-disconnect>Ngắt kết nối Discord</button></section><section><h3>Khả năng hiện tại</h3><ul class="dh-capabilities">${capability(status.capabilities.identity, "Danh tính OAuth", "Đăng nhập và hồ sơ Discord")}${capability(status.capabilities.guilds, "Danh sách server", "Chỉ server tài khoản tham gia")}${capability(status.capabilities.channels, "Kênh và lịch sử", "Theo quyền bot trên server")}${capability(status.capabilities.sendAsBot, "Gửi tin nhắn", "Hiển thị rõ là bot HH")}${capability(status.capabilities.gatewayRealtime, "Discord Gateway realtime", "Chưa bật; đang dùng REST polling nhẹ")}${capability(status.capabilities.voice, "Voice / video", "Discord API không nhúng full client")}</ul><button class="dh-primary" type="button" data-dh-invite ${status.botConfigured ? "" : "disabled"}>Mời bot HH vào server</button></section></div></section>`;
  }

  function messageMarkup(message, savedView = false) {
    const saved = isSaved(message.id);
    const files = Array.isArray(message.attachments) && message.attachments.length ? `<div class="dh-attachments">${message.attachments.map((item) => `<a href="${esc(item.url)}" target="_blank" rel="noopener"><i>◇</i><span><strong>${esc(item.filename)}</strong><small>${Math.max(1, Math.round(Number(item.size || 0) / 1024))} KB</small></span></a>`).join("")}</div>` : "";
    return `<article class="dh-message ${message.author?.bot ? "is-bot" : ""}" data-dh-message-id="${esc(message.id)}" data-dh-message-search="${esc(`${message.author?.username || ""} ${message.content || ""}`.toLowerCase())}">${message.author?.avatar ? `<img src="${esc(message.author.avatar)}" alt="">` : `<span class="dh-message-avatar">${esc(initials(message.author?.username))}</span>`}<div><header><strong>${esc(message.author?.username || "Discord")}</strong>${message.author?.bot ? "<b>BOT</b>" : ""}<time>${date(message.timestamp)}</time><button type="button" data-dh-save-message title="${saved ? "Bỏ lưu" : "Lưu tin nhắn"}">${saved ? "★" : "☆"}</button></header><p>${esc(message.content || (files ? "" : "Tin nhắn không có nội dung văn bản."))}</p>${files}${savedView ? `<small class="dh-saved-source">#${esc(message.channelName || "Discord")} · ${esc(message.guildName || "Server")}</small>` : ""}</div></article>`;
  }

  function messagesMarkup() {
    const messages = session.state.messages;
    if (!messages.length) return '<div class="dh-empty"><span>#</span><h3>Kênh chưa có tin nhắn</h3><p>Bot HH chỉ thấy nội dung Discord cho phép đọc.</p></div>';
    return `<div class="dh-message-stream">${messages.map((item) => messageMarkup(item)).join("")}</div>`;
  }

  function setContent(markup) { const node = session?.host.querySelector("[data-dh-content]"); if (node) node.innerHTML = markup; }
  function setBusy(busy, message = "Đang đồng bộ Discord…") { session.state.busy = busy; session.host.querySelector("[data-discord-hub]")?.classList.toggle("is-busy", busy); if (busy) setContent(`<div class="dh-loading"><i></i><strong>${esc(message)}</strong><small>Vui lòng giữ workspace đang mở.</small></div>`); }
  function toast(message, type = "success") { const node = session?.host.querySelector("[data-dh-toast]"); if (!node) return; node.textContent = message; node.dataset.type = type; node.hidden = false; clearTimeout(session.toastTimer); session.toastTimer = setTimeout(() => { node.hidden = true; }, 2800); }

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
    node.innerHTML = session.state.channels.length ? `<span class="dh-list-label">KÊNH VĂN BẢN · ${session.state.channels.length}</span>${session.state.channels.map((channel) => `<button type="button" data-dh-channel="${channel.id}" class="${session.state.channel?.id === channel.id ? "is-active" : ""}"><i>#</i><span><strong>${esc(channel.name)}</strong><small>${esc(channel.topic || "Kênh Discord")}</small></span></button>`).join("")}` : '<div class="dh-side-empty"><span>#</span><p>Không có kênh văn bản bot được phép xem.</p></div>';
  }

  function updateHeaders(title, topic = "") {
    session.host.querySelector("[data-dh-room-title]").textContent = title;
    session.host.querySelector("[data-dh-mobile-title]").textContent = title;
    session.host.querySelector("[data-dh-room-topic]").textContent = topic;
  }

  function renderInspector() {
    const { status, guild, channel } = session.state;
    const body = session.host.querySelector("[data-dh-inspector-body]");
    body.innerHTML = `<section><small>KẾT NỐI</small><div class="dh-inspector-status ${status?.connection ? "is-on" : ""}"><i></i><span><strong>${status?.connection ? "Discord đã liên kết" : "Chưa liên kết"}</strong><small>${status?.connection ? `@${esc(status.connection.handle)}` : "Cần OAuth identify + guilds"}</small></span></div></section><section><small>NGỮ CẢNH</small><dl><div><dt>Server</dt><dd>${esc(guild?.name || "Chưa chọn")}</dd></div><div><dt>Kênh</dt><dd>${esc(channel ? `#${channel.name}` : "Chưa chọn")}</dd></div><div><dt>Đồng bộ</dt><dd>REST · 12 giây</dd></div><div><dt>Gửi dưới tên</dt><dd>HH Discord Bot</dd></div></dl></section><section><small>NGUYÊN TẮC AN TOÀN</small><p>HH không đọc DM tùy ý, không lấy mật khẩu Discord và không dùng user token để tự động gửi tin. Mọi thao tác vẫn chịu quyền của server Discord.</p></section><footer><a href="https://support.discord.com/hc/en-us/articles/206029707" target="_blank" rel="noopener">Tìm hiểu quyền server ↗</a></footer>`;
  }

  async function loadStatus() {
    setBusy(true, "Đang xác minh OAuth và bot Discord…");
    try {
      session.state.status = await api("status");
      session.host.querySelector("[data-dh-profile]").innerHTML = profileMarkup(session.state.status.connection);
      const online = Boolean(session.state.status.connection);
      session.host.querySelector("[data-dh-presence]").classList.toggle("is-on", online);
      session.host.querySelector("[data-dh-connection-label]").textContent = online ? "Discord đã kết nối" : "Chưa kết nối";
      session.host.querySelector("[data-dh-connection-copy]").textContent = online ? (session.state.status.botConfigured ? "OAuth + HH Bot" : "OAuth · bot chưa cấu hình") : "OAuth bảo mật";
      if (online) await loadGuilds(); else { session.state.guilds = []; renderGuilds(); setContent(homeMarkup()); }
    } catch (error) {
      session.state.status = { configured: error.status === 401 || error.code === "AUTH_REQUIRED", authRequired: error.status === 401 || error.code === "AUTH_REQUIRED", connection: null };
      setContent(connectMarkup(session.state.status));
    } finally { session.state.busy = false; session.host.querySelector("[data-discord-hub]")?.classList.remove("is-busy"); renderInspector(); }
  }

  async function loadGuilds() {
    const data = await api("guilds");
    session.state.guilds = data.guilds || [];
    renderGuilds();
    if (session.state.view === "home") setContent(homeMarkup());
  }

  async function selectGuild(id) {
    const guild = session.state.guilds.find((item) => item.id === id);
    if (!guild) return;
    session.state.guild = guild; session.state.channel = null; session.state.channels = []; session.state.messages = [];
    renderGuilds(); renderChannels(); renderInspector(); closeMobilePanels();
    if (!guild.botInstalled) { setView("home"); toast("Hãy mời bot HH vào server để mở kênh.", "error"); return; }
    updateHeaders(guild.name, "Đang tải danh sách kênh bot HH có thể truy cập…");
    setBusy(true, `Đang tải kênh của ${guild.name}…`);
    try { const data = await api(`guilds/${guild.id}/channels`); session.state.channels = data.channels || []; renderChannels(); setContent(`<div class="dh-empty"><span>#</span><h3>${esc(guild.name)}</h3><p>Chọn một kênh ở bên trái để đọc lịch sử và trò chuyện bằng bot HH.</p></div>`); }
    catch (error) { setContent(`<div class="dh-error"><span>!</span><h3>Không mở được server</h3><p>${esc(error.message)}</p><button type="button" data-dh-invite>Kiểm tra quyền bot</button></div>`); }
    finally { session.state.busy = false; session.host.querySelector("[data-discord-hub]")?.classList.remove("is-busy"); }
  }

  async function selectChannel(id) {
    const channel = session.state.channels.find((item) => item.id === id);
    if (!channel) return;
    session.state.channel = channel; session.state.view = "channel"; renderChannels(); closeMobilePanels();
    updateHeaders(`#${channel.name}`, channel.topic || `${session.state.guild.name} · Tin nhắn qua HH Discord Bot`);
    session.host.querySelector("[data-dh-room-icon]").textContent = "#";
    session.host.querySelector("[data-dh-composer]").hidden = false;
    await loadMessages(); startPolling(); renderInspector();
  }

  async function loadMessages({ silent = false } = {}) {
    if (!session.state.channel || session.state.loadingMessages) return;
    session.state.loadingMessages = true;
    const content = session.host.querySelector("[data-dh-content]");
    const nearBottom = content.scrollHeight - content.scrollTop - content.clientHeight < 120;
    if (!silent) setBusy(true, `Đang tải #${session.state.channel.name}…`);
    try {
      const data = await api(`channels/${session.state.channel.id}/messages?guildId=${encodeURIComponent(session.state.guild.id)}&limit=40`);
      session.state.messages = data.messages || [];
      setContent(messagesMarkup());
      applySearch();
      if (!silent || nearBottom) requestAnimationFrame(() => { const node = session.host.querySelector("[data-dh-content]"); if (node) node.scrollTop = node.scrollHeight; });
    } catch (error) { if (!silent) setContent(`<div class="dh-error"><span>!</span><h3>Không đọc được kênh</h3><p>${esc(error.message)}</p><button type="button" data-dh-refresh>Thử lại</button></div>`); }
    finally { session.state.loadingMessages = false; session.state.busy = false; session.host.querySelector("[data-discord-hub]")?.classList.remove("is-busy"); }
  }

  function setView(view) {
    if (!session || !["home", "saved", "settings"].includes(view)) return;
    session.state.view = view; stopPolling();
    session.host.querySelector("[data-dh-composer]").hidden = true;
    session.host.querySelectorAll("[data-dh-view]").forEach((node) => node.classList.toggle("is-active", node.dataset.dhView === view));
    session.host.querySelector("[data-dh-room-icon]").textContent = view === "saved" ? "☆" : view === "settings" ? "⚙" : "✦";
    updateHeaders(view === "saved" ? "Tin nhắn đã lưu" : view === "settings" ? "Tích hợp Discord" : "Discord Center", view === "home" ? "Kết nối cộng đồng Discord với HH Platform" : view === "saved" ? "Kho cá nhân chỉ trên thiết bị này" : "Quyền, OAuth, bot và bảo mật");
    setContent(view === "saved" ? savedMarkup() : view === "settings" ? settingsMarkup() : homeMarkup());
    closeMobilePanels();
  }

  async function connect() {
    try { const data = await api("oauth/start", { method: "POST", body: { frontendOrigin: location.origin, returnHash: "#/discord" } }); location.assign(data.authorizationUrl); }
    catch (error) { toast(error.message, "error"); }
  }

  async function inviteBot() {
    try { const data = await api("bot/invite"); window.open(data.invitationUrl, "_blank", "noopener,noreferrer"); toast("Chọn server và xác nhận ba quyền tối thiểu trên Discord."); }
    catch (error) { toast(error.message, "error"); }
  }

  async function disconnect() {
    if (!confirm("Ngắt kết nối Discord và thu hồi token đã lưu?")) return;
    try { await api("disconnect", { method: "DELETE" }); session.state = { ...session.state, status: { configured: true, connection: null }, guilds: [], channels: [], messages: [], guild: null, channel: null, view: "home" }; renderGuilds(); renderChannels(); setContent(connectMarkup(session.state.status)); session.host.querySelector("[data-dh-profile]").innerHTML = profileMarkup(null); toast("Đã ngắt kết nối Discord."); }
    catch (error) { toast(error.message, "error"); }
  }

  async function sendMessage(form) {
    const input = form.querySelector("[data-dh-message]"); const content = input.value.trim();
    if (!content || !session.state.channel) return;
    const button = form.querySelector("[data-dh-send]"); button.disabled = true; button.textContent = "Đang gửi…";
    try { const data = await api(`channels/${session.state.channel.id}/messages/send`, { method: "POST", body: { guildId: session.state.guild.id, content } }); input.value = ""; autoSize(input); session.host.querySelector("[data-dh-count]").textContent = "0/2000"; session.state.messages.push(data.message); setContent(messagesMarkup()); requestAnimationFrame(() => { const node = session.host.querySelector("[data-dh-content]"); node.scrollTop = node.scrollHeight; }); toast("Đã gửi bằng HH Discord Bot."); }
    catch (error) { toast(error.message, "error"); }
    finally { button.disabled = false; button.textContent = "Gửi ➤"; input.focus({ preventScroll: true }); }
  }

  function toggleSaved(messageId) {
    const message = session.state.messages.find((item) => item.id === messageId) || readSaved().find((item) => item.id === messageId);
    if (!message) return;
    let saved = readSaved(); const exists = saved.some((item) => item.id === messageId);
    saved = exists ? saved.filter((item) => item.id !== messageId) : [{ ...message, guildName: session.state.guild?.name || message.guildName, channelName: session.state.channel?.name || message.channelName, savedAt: new Date().toISOString() }, ...saved];
    writeSaved(saved);
    if (session.state.view === "saved") setContent(savedMarkup()); else session.host.querySelectorAll(`[data-dh-message-id="${CSS.escape(messageId)}"] [data-dh-save-message]`).forEach((node) => { node.textContent = exists ? "☆" : "★"; });
    toast(exists ? "Đã bỏ lưu tin nhắn." : "Đã lưu tin nhắn trên thiết bị.");
  }

  function applySearch() { const query = String(session.host.querySelector("[data-dh-search]")?.value || "").trim().toLowerCase(); session.host.querySelectorAll("[data-dh-message-search]").forEach((node) => { node.hidden = Boolean(query && !node.dataset.dhMessageSearch.includes(query)); }); session.host.querySelectorAll("[data-dh-channel]").forEach((node) => { node.hidden = Boolean(query && !node.textContent.toLowerCase().includes(query)); }); }
  function autoSize(input) { input.style.height = "auto"; input.style.height = `${Math.min(128, input.scrollHeight)}px`; }
  function toggleInspector(open) { const hub = session.host.querySelector("[data-discord-hub]"); hub.classList.toggle("is-inspector-open", open); session.host.querySelector("[data-dh-inspector-panel]").setAttribute("aria-hidden", String(!open)); }
  function closeMobilePanels() { session?.host.querySelector("[data-discord-hub]")?.classList.remove("is-channels-open"); }
  function startPolling() { stopPolling(); session.pollTimer = setInterval(() => { if (!document.hidden && session?.state.channel) loadMessages({ silent: true }); }, 12000); }
  function stopPolling() { if (session?.pollTimer) clearInterval(session.pollTimer); if (session) session.pollTimer = 0; }

  function onClick(event) {
    const view = event.target.closest("[data-dh-view]"); if (view) return setView(view.dataset.dhView);
    const guild = event.target.closest("[data-dh-guild]"); if (guild) return selectGuild(guild.dataset.dhGuild);
    const channel = event.target.closest("[data-dh-channel]"); if (channel) return selectChannel(channel.dataset.dhChannel);
    const message = event.target.closest("[data-dh-message-id]"); if (message && event.target.closest("[data-dh-save-message]")) return toggleSaved(message.dataset.dhMessageId);
    if (event.target.closest("[data-dh-connect]")) return connect();
    if (event.target.closest("[data-dh-invite]")) return inviteBot();
    if (event.target.closest("[data-dh-disconnect]")) return disconnect();
    if (event.target.closest("[data-dh-refresh]")) return session.state.channel ? loadMessages() : loadStatus();
    if (event.target.closest("[data-dh-inspector]")) return toggleInspector(true);
    if (event.target.closest("[data-dh-inspector-close]")) return toggleInspector(false);
    if (event.target.closest("[data-dh-channels-open]")) return session.host.querySelector("[data-discord-hub]").classList.add("is-channels-open");
    if (event.target.closest("[data-dh-channels-close]")) return closeMobilePanels();
  }

  function onSubmit(event) { if (!event.target.matches("[data-dh-composer]")) return; event.preventDefault(); sendMessage(event.target); }
  function onInput(event) { if (event.target.matches("[data-dh-search]")) return applySearch(); if (event.target.matches("[data-dh-message]")) { autoSize(event.target); session.host.querySelector("[data-dh-count]").textContent = `${event.target.value.length}/2000`; } }
  function onKeydown(event) { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); focus(); } if (event.target.matches("[data-dh-message]") && event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.target.closest("form").requestSubmit(); } }
  function focus() { session?.host.querySelector(session.state.channel ? "[data-dh-message]" : "[data-dh-search]")?.focus({ preventScroll: true }); }

  function mount(host, options = {}) {
    if (!host) return false;
    unmount(); host.innerHTML = shellMarkup();
    session = { host, apiBase: String(options.apiBase || scope.HH_API_BASE || location.origin).replace(/\/$/, ""), state: { status: null, guilds: [], channels: [], messages: [], guild: null, channel: null, view: "home", busy: false, loadingMessages: false }, toastTimer: 0, pollTimer: 0, onClick, onSubmit, onInput, onKeydown };
    host.addEventListener("click", onClick); host.addEventListener("submit", onSubmit); host.addEventListener("input", onInput); host.addEventListener("keydown", onKeydown);
    const oauthResult = new URLSearchParams(location.search).get("discord");
    if (oauthResult === "connected") { toast("Đã kết nối tài khoản Discord."); history.replaceState({}, document.title, `${location.pathname}#/discord`); }
    else if (oauthResult) { toast(`Discord OAuth chưa hoàn tất: ${oauthResult}`, "error"); history.replaceState({}, document.title, `${location.pathname}#/discord`); }
    loadStatus(); return true;
  }

  function unmount() { if (!session) return; stopPolling(); clearTimeout(session.toastTimer); session.host.removeEventListener("click", session.onClick); session.host.removeEventListener("submit", session.onSubmit); session.host.removeEventListener("input", session.onInput); session.host.removeEventListener("keydown", session.onKeydown); session = null; }
  return Object.freeze({ version: "1.0.0", mount, unmount, focus });
});
