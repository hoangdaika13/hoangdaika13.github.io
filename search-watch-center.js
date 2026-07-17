(() => {
  "use strict";

  const API_BASE = String(window.HH_REALTIME_URL || "").replace(/\/$/, "");
  const STORAGE = {
    recent: "hh.search-watch.youtube-recent",
    favorites: "hh.search-watch.youtube-favorites",
    queue: "hh.search-watch.youtube-queue",
    preferences: "hh.search-watch.preferences",
    searches: "hh.search-watch.history",
    webSaved: "hh.search-watch.web-saved"
  };
  const state = {
    tab: "google",
    busy: false,
    googleKind: "web",
    googlePage: 1,
    youtubePageToken: "",
    youtubeNextToken: "",
    youtubePreviousToken: "",
    youtubeItems: [],
    currentVideo: null,
    privacyShield: true,
    autoplayQueue: false,
    playerRate: 1,
    floating: false,
    floatingMinimized: false,
    pipWindow: null,
    beforePipFloating: false,
    lastQuery: { google: "", youtube: "" }
  };
  let root;
  let playerNode;
  let playerAnchor;
  let floatingDock;

  function readStore(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function writeStore(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage may be disabled. */ }
  }

  function readPreferences() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE.preferences) || "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  function savePreferences() {
    writeStore(STORAGE.preferences, {
      privacyShield: state.privacyShield,
      autoplayQueue: state.autoplayQueue,
      playerRate: state.playerRate
    });
  }

  function rememberSearch(provider, query) {
    const item = { provider, query, at: new Date().toISOString() };
    const next = [item, ...readStore(STORAGE.searches).filter((entry) => !(entry.provider === provider && entry.query === query))].slice(0, 16);
    writeStore(STORAGE.searches, next);
    renderSearchHistory();
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("vi-VN", { notation: Number(value) > 99999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(Number(value) || 0);
  }

  function formatDate(value) {
    if (!value) return "";
    try { return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)); }
    catch { return ""; }
  }

  function isPromotionalVideo(video) {
    const text = `${video?.title || ""} ${video?.description || ""}`.toLowerCase();
    return /(^|\s)(#ad|#sponsored)(\s|$)|paid promotion|sponsored content|được tài trợ|nội dung quảng cáo/.test(text);
  }

  function queueItems() {
    return readStore(STORAGE.queue);
  }

  function isQueued(id) {
    return queueItems().some((item) => item.id === id);
  }

  function toggleQueue(video) {
    if (!video?.id) return;
    const items = queueItems();
    const exists = items.some((item) => item.id === video.id);
    writeStore(STORAGE.queue, exists ? items.filter((item) => item.id !== video.id) : [...items, video].slice(-60));
    renderLibraries();
  }

  function queueIndex() {
    return queueItems().findIndex((item) => item.id === state.currentVideo?.id);
  }

  function playQueueStep(direction) {
    const items = queueItems();
    if (!items.length) return;
    const current = queueIndex();
    const next = current < 0 ? 0 : (current + direction + items.length) % items.length;
    loadVideo(items[next], { scroll: false });
  }

  function playerCommand(func, args = []) {
    const frame = playerNode?.querySelector("#hhYouTubePlayer");
    if (!frame?.contentWindow || !state.currentVideo) return;
    frame.contentWindow.postMessage(JSON.stringify({ event: "command", func, args }), "https://www.youtube-nocookie.com");
  }

  function updatePreferenceControls() {
    if (!root) return;
    const privacy = root.querySelector("[data-privacy-shield]");
    privacy.setAttribute("aria-pressed", String(state.privacyShield));
    privacy.textContent = state.privacyShield ? "Đang bảo vệ" : "Đang ghi lịch sử";
    root.querySelector("[data-privacy-status]").textContent = state.privacyShield
      ? "NoCookie · không lưu lịch sử HH"
      : "NoCookie · có lưu lịch sử HH";
    const autoplay = root.querySelector("[data-autoplay-queue]");
    autoplay.setAttribute("aria-pressed", String(state.autoplayQueue));
    autoplay.classList.toggle("active", state.autoplayQueue);
    const rate = playerNode?.querySelector("[data-player-rate]");
    if (rate) rate.value = String(state.playerRate);
  }

  function parseYouTubeId(value) {
    const input = String(value || "").trim();
    if (/^[\w-]{11}$/.test(input)) return input;
    try {
      const url = new URL(input);
      if (url.hostname === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || "";
      if (/youtube(?:-nocookie)?\.com$/i.test(url.hostname.replace(/^www\./, ""))) {
        if (url.searchParams.get("v")) return url.searchParams.get("v");
        const parts = url.pathname.split("/").filter(Boolean);
        if (["shorts", "embed", "live"].includes(parts[0])) return parts[1] || "";
      }
    } catch { /* Search text, not a URL. */ }
    return "";
  }

  function makeVideoFromId(id) {
    return {
      id,
      title: `Video YouTube ${id}`,
      channel: "YouTube",
      description: "Mở trực tiếp từ liên kết hoặc mã video.",
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      publishedAt: ""
    };
  }

  function updateMiniButton() {
    const button = root?.querySelector("[data-youtube-mini]");
    if (!button) return;
    button.classList.toggle("active", state.floating);
    button.setAttribute("aria-pressed", String(state.floating));
    button.textContent = state.floating ? "▣ Đưa về trung tâm" : "▣ Trình phát mini";
  }

  function placePlayer(floating = false) {
    if (!playerNode || !playerAnchor) return;
    if (floating) {
      floatingDock.querySelector("[data-floating-slot]").append(playerNode);
      floatingDock.hidden = false;
      state.floating = true;
    } else {
      playerAnchor.parentNode?.insertBefore(playerNode, playerAnchor.nextSibling);
      floatingDock.hidden = true;
      floatingDock.classList.remove("is-minimized");
      state.floating = false;
      state.floatingMinimized = false;
    }
    playerNode.classList.remove("swh-mini-player");
    updateMiniButton();
  }

  function activateFloatingPlayer() {
    if (!state.currentVideo || playerNode?.hidden || state.pipWindow) return;
    placePlayer(true);
  }

  function returnPlayerToHub({ open = true } = {}) {
    if (state.pipWindow && !state.pipWindow.closed) state.pipWindow.close();
    placePlayer(false);
    if (open) openHub("youtube");
  }

  function closePlayer() {
    playerCommand("stopVideo");
    const frame = playerNode?.querySelector("iframe");
    if (frame) frame.src = "about:blank";
    placePlayer(false);
    if (playerNode) playerNode.hidden = true;
    state.currentVideo = null;
  }

  function showPlayerStatus(message) {
    const status = playerNode?.querySelector("[data-privacy-status]");
    if (!status) return;
    const previous = status.textContent;
    status.textContent = message;
    window.setTimeout(() => {
      if (status.textContent === message) status.textContent = previous;
    }, 2600);
  }

  async function openDocumentPip() {
    if (!state.currentVideo || playerNode?.hidden) return;
    if (!window.documentPictureInPicture?.requestWindow) {
      activateFloatingPlayer();
      showPlayerStatus("Trình duyệt chưa hỗ trợ PiP nâng cao · đã mở mini-player");
      return;
    }
    try {
      state.beforePipFloating = state.floating;
      const pipWindow = await window.documentPictureInPicture.requestWindow({ width: 520, height: 390 });
      state.pipWindow = pipWindow;
      const style = pipWindow.document.createElement("style");
      style.textContent = `*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#070a10;color:#eef6ff;font-family:system-ui,sans-serif}.swh-player-shell{display:grid;grid-template-rows:minmax(0,1fr) auto auto;width:100%;height:100%;margin:0;overflow:hidden;background:#090d13}.swh-player{min-height:0;background:#000}.swh-player iframe{display:block;width:100%;height:100%;border:0}.swh-player-controls,.swh-now-playing{display:flex;align-items:center;gap:6px;padding:7px 9px;border-top:1px solid #293642;background:#0c121a}.swh-player-controls button,.swh-now-playing button{min-height:30px;border:1px solid #354552;border-radius:5px;background:#121923;color:#c2ced7}.swh-player-controls label{display:flex;align-items:center;gap:5px;color:#8b9aaa;font-size:10px}.swh-player-controls select{height:28px;background:#111923;color:#fff;border:1px solid #354552}.swh-player-controls>span{margin-left:auto;font-size:9px;color:#5ce7ef}.swh-now-playing{justify-content:space-between}.swh-now-playing>div:first-child{min-width:0}.swh-now-playing>div:last-child{display:flex;gap:5px}.swh-now-playing small{font-size:8px;color:#ff6675}.swh-now-playing h4{margin:2px 0;overflow:hidden;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.swh-now-playing p{margin:0;color:#81909e;font-size:9px}`;
      pipWindow.document.head.append(style);
      pipWindow.document.body.append(playerNode);
      floatingDock.hidden = true;
      state.floating = false;
      updateMiniButton();
      pipWindow.addEventListener("pagehide", () => {
        const shouldFloat = state.beforePipFloating || !root.classList.contains("open");
        state.pipWindow = null;
        placePlayer(shouldFloat);
      }, { once: true });
    } catch (error) {
      activateFloatingPlayer();
      showPlayerStatus(error?.name === "NotAllowedError" ? "Hãy cho phép cửa sổ luôn nổi · mini-player đã mở" : "Không mở được PiP · mini-player đã mở");
    }
  }

  function createFloatingDock() {
    floatingDock = document.createElement("aside");
    floatingDock.className = "swh-floating-player";
    floatingDock.hidden = true;
    floatingDock.setAttribute("aria-label", "Trình phát YouTube nổi");
    floatingDock.innerHTML = `<header data-floating-drag><div><i></i><span>HH MINI PLAYER</span></div><nav><button type="button" data-floating-return title="Đưa về YouTube Studio" aria-label="Đưa về YouTube Studio">↗</button><button type="button" data-floating-pip title="Cửa sổ luôn nổi" aria-label="Cửa sổ luôn nổi">▣</button><button type="button" data-floating-minimize title="Thu gọn" aria-label="Thu gọn">−</button><button type="button" data-floating-close title="Đóng trình phát" aria-label="Đóng trình phát">×</button></nav></header><div data-floating-slot></div>`;
    document.body.append(floatingDock);
    floatingDock.querySelector("[data-floating-return]").addEventListener("click", () => returnPlayerToHub());
    floatingDock.querySelector("[data-floating-pip]").addEventListener("click", openDocumentPip);
    floatingDock.querySelector("[data-floating-minimize]").addEventListener("click", () => {
      state.floatingMinimized = !state.floatingMinimized;
      floatingDock.classList.toggle("is-minimized", state.floatingMinimized);
      floatingDock.querySelector("[data-floating-minimize]").textContent = state.floatingMinimized ? "+" : "−";
    });
    floatingDock.querySelector("[data-floating-close]").addEventListener("click", closePlayer);

    const handle = floatingDock.querySelector("[data-floating-drag]");
    let drag = null;
    handle.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      const box = floatingDock.getBoundingClientRect();
      drag = { x: event.clientX, y: event.clientY, left: box.left, top: box.top };
      floatingDock.style.right = "auto";
      floatingDock.style.bottom = "auto";
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener("pointermove", (event) => {
      if (!drag) return;
      const maxLeft = Math.max(0, innerWidth - floatingDock.offsetWidth);
      const maxTop = Math.max(0, innerHeight - floatingDock.offsetHeight);
      floatingDock.style.left = `${Math.min(maxLeft, Math.max(0, drag.left + event.clientX - drag.x))}px`;
      floatingDock.style.top = `${Math.min(maxTop, Math.max(0, drag.top + event.clientY - drag.y))}px`;
    });
    handle.addEventListener("pointerup", () => { drag = null; });
    handle.addEventListener("pointercancel", () => { drag = null; });
  }

  function createHub() {
    root = document.createElement("section");
    root.className = "search-watch-hub";
    root.id = "searchWatchHub";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "searchWatchTitle");
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `
      <div class="swh-backdrop" data-swh-close></div>
      <div class="swh-window">
        <header class="swh-header">
          <div class="swh-brand"><span>HH</span><div><small>SEARCH & WATCH CENTER</small><h2 id="searchWatchTitle">Google và YouTube trong một nơi</h2></div></div>
          <div class="swh-header-actions">
            <span class="swh-api-pill" data-service="google"><i></i> Google API</span>
            <span class="swh-api-pill" data-service="youtube"><i></i> YouTube API</span>
            <button class="swh-icon-button" type="button" data-swh-close aria-label="Đóng" title="Đóng">×</button>
          </div>
        </header>
        <nav class="swh-tabs" aria-label="Chọn dịch vụ">
          <button class="active" type="button" data-swh-tab="google"><b>G</b><span>Google Search<small>Web, tài liệu và hình ảnh</small></span></button>
          <button type="button" data-swh-tab="youtube"><b>▶</b><span>YouTube Studio<small>Tìm, xem và xây thư viện</small></span></button>
        </nav>
        <div class="swh-body">
          <aside class="swh-sidebar">
            <section><small>KHÁM PHÁ NHANH</small>
              <a href="https://news.google.com/topstories?hl=vi&gl=VN&ceid=VN:vi" target="_blank" rel="noopener"><b>N</b><span>Google News</span><i>↗</i></a>
              <a href="https://images.google.com/" target="_blank" rel="noopener"><b>I</b><span>Google Images</span><i>↗</i></a>
              <a href="https://maps.google.com/" target="_blank" rel="noopener"><b>M</b><span>Google Maps</span><i>↗</i></a>
              <a href="https://translate.google.com/" target="_blank" rel="noopener"><b>T</b><span>Google Dịch</span><i>↗</i></a>
              <a href="https://scholar.google.com/" target="_blank" rel="noopener"><b>S</b><span>Google Scholar</span><i>↗</i></a>
              <a href="https://mail.google.com/" target="_blank" rel="noopener"><b>@</b><span>Gmail</span><i>↗</i></a>
              <a href="https://drive.google.com/" target="_blank" rel="noopener"><b>D</b><span>Google Drive</span><i>↗</i></a>
              <a href="https://calendar.google.com/" target="_blank" rel="noopener"><b>C</b><span>Google Calendar</span><i>↗</i></a>
              <a href="https://keep.google.com/" target="_blank" rel="noopener"><b>K</b><span>Google Keep</span><i>↗</i></a>
              <a href="https://gemini.google.com/" target="_blank" rel="noopener"><b>AI</b><span>Gemini</span><i>↗</i></a>
              <a href="https://music.youtube.com/" target="_blank" rel="noopener"><b>Y</b><span>YouTube Music</span><i>↗</i></a>
            </section>
            <section><small>LỊCH SỬ TÌM KIẾM</small><div class="swh-history" data-swh-history></div><button class="swh-clear" type="button" data-swh-clear-history>Xóa lịch sử</button></section>
            <section><small>WEB ĐÃ LƯU</small><div class="swh-history" data-web-saved></div></section>
            <section class="swh-privacy"><b>Chế độ riêng tư</b><p>Dùng YouTube NoCookie và không ghi lịch sử xem vào HH khi được bật. Quảng cáo và điều khiển của YouTube không bị can thiệp.</p><button type="button" data-privacy-shield aria-pressed="true">Đang bảo vệ</button></section>
          </aside>
          <main class="swh-main">
            <section class="swh-panel active" data-swh-panel="google">
              <div class="swh-panel-heading"><div><small>GOOGLE DISCOVERY</small><h3>Tìm đúng thông tin, ngay trong HH</h3><p>Agent Search ưu tiên nguồn đã chọn; tự chuyển sang Programmable Search khi cần.</p></div><div class="swh-segment"><button class="active" type="button" data-google-kind="web">Trang web</button><button type="button" data-google-kind="images">Hình ảnh</button></div></div>
              <div class="swh-filterbar">
                <label>Thời gian<select data-google-date><option value="">Mọi thời gian</option><option value="d1">24 giờ</option><option value="d7">7 ngày</option><option value="m1">1 tháng</option><option value="y1">1 năm</option></select></label>
                <label>Tệp<select data-google-file><option value="">Tất cả</option><option value="pdf">PDF</option><option value="docx">Word</option><option value="xlsx">Excel</option><option value="pptx">PowerPoint</option></select></label>
                <label>Miền<input data-google-site inputmode="url" placeholder="example.com" aria-label="Chỉ tìm trong miền"></label>
                <label class="swh-toggle"><input type="checkbox" data-google-safe checked><span></span>SafeSearch</label>
              </div>
              <form class="swh-search-form" data-search-form="google"><span>G</span><input type="search" name="q" autocomplete="off" placeholder="Tìm website, tài liệu, tin tức..." required><button class="swh-voice" type="button" data-voice="google" title="Tìm bằng giọng nói" aria-label="Tìm bằng giọng nói">◉</button><button class="swh-submit" type="submit">Tìm kiếm</button></form>
              <div class="swh-query-meta"><span data-google-meta>Nhập từ khóa để bắt đầu tìm kiếm.</span><div data-google-pager hidden><button type="button" data-google-page="prev">‹ Trước</button><button type="button" data-google-page="next">Sau ›</button></div></div>
              <div class="swh-results" data-results="google"><div class="swh-empty"><b>G</b><h4>Google Search trong HH Platform</h4><p>Kết quả được trình bày gọn, có thể lưu, sao chép và mở trang gốc bằng một lần bấm.</p><div class="swh-empty-chips"><span>Tài liệu</span><span>Hình ảnh</span><span>SafeSearch</span></div></div></div>
            </section>
            <section class="swh-panel" data-swh-panel="youtube">
              <div class="swh-panel-heading"><div><small>YOUTUBE PLAYER</small><h3>Tìm, xem và quản lý video</h3><p>Phát video ngay trong HH bằng trình nhúng chính thức của YouTube.</p></div></div>
              <div class="swh-filterbar swh-filterbar--youtube">
                <label>Sắp xếp<select data-youtube-order><option value="relevance">Phù hợp nhất</option><option value="date">Mới nhất</option><option value="viewCount">Nhiều lượt xem</option><option value="rating">Đánh giá cao</option></select></label>
                <label>Thời lượng<select data-youtube-duration><option value="any">Tất cả</option><option value="short">Dưới 4 phút</option><option value="medium">4-20 phút</option><option value="long">Trên 20 phút</option></select></label>
                <label>Chất lượng<select data-youtube-definition><option value="any">Mọi chất lượng</option><option value="high">HD</option><option value="standard">SD</option></select></label>
                <label>Thời điểm<select data-youtube-published><option value="any">Mọi thời điểm</option><option value="d1">24 giờ</option><option value="w1">7 ngày</option><option value="m1">30 ngày</option><option value="y1">1 năm</option></select></label>
                <label>Phụ đề<select data-youtube-caption><option value="any">Tất cả</option><option value="closedCaption">Có phụ đề</option><option value="none">Không phụ đề</option></select></label>
                <label>Trạng thái<select data-youtube-event><option value="any">Mọi video</option><option value="live">Đang trực tiếp</option><option value="upcoming">Sắp phát</option><option value="completed">Đã phát xong</option></select></label>
                <label>An toàn<select data-youtube-safe><option value="strict">Nghiêm ngặt</option><option value="moderate" selected>Vừa phải</option><option value="none">Không lọc</option></select></label>
                <label>Khu vực<select data-youtube-region><option value="VN" selected>Việt Nam</option><option value="US">Hoa Kỳ</option><option value="GB">Anh</option><option value="JP">Nhật Bản</option><option value="KR">Hàn Quốc</option></select></label>
                <label>Ngôn ngữ<select data-youtube-language><option value="vi" selected>Tiếng Việt</option><option value="en">English</option><option value="ja">日本語</option><option value="ko">한국어</option></select></label>
              </div>
              <form class="swh-search-form swh-search-form--youtube" data-search-form="youtube"><span>▶</span><input type="search" name="q" autocomplete="off" placeholder="Tìm video hoặc dán link YouTube..." required><button class="swh-voice" type="button" data-voice="youtube" title="Tìm bằng giọng nói" aria-label="Tìm bằng giọng nói">◉</button><button class="swh-submit" type="submit">Tìm / Phát</button></form>
              <div class="swh-youtube-tools" aria-label="Công cụ YouTube">
                <button type="button" data-youtube-random title="Phát ngẫu nhiên một kết quả">⤨ Ngẫu nhiên</button>
                <button type="button" data-youtube-focus aria-pressed="false">◐ Chế độ rạp</button>
                <button type="button" data-youtube-mini aria-pressed="false">▣ Trình phát mini</button>
                <button type="button" data-youtube-pip>▣ Cửa sổ luôn nổi</button>
                <button type="button" data-youtube-import-playlist>＋ Nhập playlist</button>
                <button type="button" data-autoplay-queue aria-pressed="false">↻ Tự phát hàng đợi</button>
                <span data-queue-count>0 trong hàng đợi</span>
              </div>
              <div class="swh-player-shell" data-youtube-player hidden>
                <div class="swh-player"><iframe id="hhYouTubePlayer" title="YouTube player" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
                <div class="swh-player-controls">
                  <button type="button" data-player-previous title="Video trước">◀</button>
                  <button type="button" data-player-play title="Phát">▶</button>
                  <button type="button" data-player-pause title="Tạm dừng">Ⅱ</button>
                  <button type="button" data-player-next title="Video tiếp theo">▶▶</button>
                  <label>Tốc độ<select data-player-rate><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label>
                  <span data-privacy-status>NoCookie · lịch sử riêng tư</span>
                </div>
                <div class="swh-now-playing"><div><small>ĐANG PHÁT TRONG HH PLAYER</small><h4 data-player-title></h4><p data-player-channel></p></div><div><button type="button" data-player-share>Chia sẻ</button><button type="button" data-player-open>Mở YouTube</button><button type="button" data-player-favorite>Lưu video</button></div></div>
              </div>
              <div class="swh-library-row"><section><header><b>Xem gần đây</b><button type="button" data-clear-recent>Xóa</button></header><div data-youtube-recent></div></section><section><header><b>Đã lưu</b><span data-favorite-count>0 video</span></header><div data-youtube-favorites></div></section></div>
              <section class="swh-queue"><header><div><small>WATCH QUEUE</small><b>Hàng đợi thông minh</b></div><button type="button" data-clear-queue>Xóa hàng đợi</button></header><div data-youtube-queue></div></section>
              <div class="swh-query-meta"><span data-youtube-meta>Dán liên kết để phát ngay hoặc tìm video bằng API.</span><div data-youtube-pager hidden><button type="button" data-youtube-page="prev">‹ Trước</button><button type="button" data-youtube-page="next">Sau ›</button></div></div>
              <div class="swh-results swh-video-results" data-results="youtube"><div class="swh-empty"><b>▶</b><h4>YouTube ngay trong HH</h4><p>Tìm video, xem thời lượng và lượt xem, phát ngay hoặc xây thư viện cá nhân.</p><div class="swh-empty-chips"><span>HD</span><span>Phụ đề</span><span>Thư viện</span></div></div></div>
            </section>
          </main>
        </div>
        <footer class="swh-footer"><span><i></i> HH secure server proxy</span><p>Google và YouTube là dịch vụ của Google LLC. HH sử dụng API và trình phát nhúng chính thức.</p><div><kbd>Alt G</kbd><kbd>Alt Y</kbd><kbd>Esc</kbd></div></footer>
      </div>`;
    document.body.appendChild(root);
    playerNode = root.querySelector("[data-youtube-player]");
    playerAnchor = document.createComment("hh-youtube-player-anchor");
    playerNode.before(playerAnchor);
    createFloatingDock();
    bindHub();
    updatePreferenceControls();
    renderSearchHistory();
    renderWebSaved();
    renderLibraries();
  }

  function setTab(tab) {
    state.tab = tab === "youtube" ? "youtube" : "google";
    root.querySelectorAll("[data-swh-tab]").forEach((button) => button.classList.toggle("active", button.dataset.swhTab === state.tab));
    root.querySelectorAll("[data-swh-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.swhPanel === state.tab));
    setTimeout(() => root.querySelector(`[data-search-form="${state.tab}"] input`)?.focus(), 80);
  }

  function openHub(tab = "google", query = "") {
    if (!root) createHub();
    root.classList.add("open");
    root.setAttribute("aria-hidden", "false");
    document.body.classList.add("search-watch-open");
    setTab(tab);
    checkServices();
    const input = root.querySelector(`[data-search-form="${state.tab}"] input`);
    if (query && input) {
      input.value = query;
      runSearch(state.tab, query, { resetPage: true });
    }
  }

  function closeHub() {
    if (!root) return;
    if (state.currentVideo && !state.floating && !state.pipWindow && !playerNode.hidden) activateFloatingPlayer();
    root.classList.remove("open");
    root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("search-watch-open");
  }

  async function checkServices() {
    const pills = [...root.querySelectorAll("[data-service]")];
    pills.forEach((pill) => { pill.className = "swh-api-pill checking"; pill.title = "Đang kiểm tra cấu hình"; });
    if (!API_BASE) {
      pills.forEach((pill) => { pill.className = "swh-api-pill offline"; pill.title = "Chưa khai báo địa chỉ backend"; });
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/search/google?health=1`, { headers: { Accept: "application/json" } });
      const data = await response.json();
      pills.forEach((pill) => {
        const online = Boolean(data.services?.[pill.dataset.service]);
        pill.className = `swh-api-pill ${online ? "online" : "offline"}`;
        pill.title = online ? "API đã sẵn sàng" : "API chưa có biến môi trường trên Vercel";
      });
    } catch {
      pills.forEach((pill) => { pill.className = "swh-api-pill offline"; pill.title = "Không kết nối được backend"; });
    }
  }

  function setLoading(provider, loading, message = "") {
    state.busy = loading;
    const panel = root.querySelector(`[data-swh-panel="${provider}"]`);
    panel?.classList.toggle("loading", loading);
    const button = panel?.querySelector(".swh-submit");
    if (button) {
      button.disabled = loading;
      button.textContent = loading ? "Đang tìm..." : provider === "youtube" ? "Tìm / Phát" : "Tìm kiếm";
    }
    if (message) root.querySelector(`[data-${provider}-meta]`).textContent = message;
    if (loading) renderSkeleton(provider);
  }

  function renderSkeleton(provider) {
    const results = root.querySelector(`[data-results="${provider}"]`);
    results.replaceChildren();
    results.classList.toggle("swh-video-results", provider === "youtube");
    for (let i = 0; i < (provider === "youtube" ? 6 : 5); i += 1) {
      const card = document.createElement("div");
      card.className = provider === "youtube" ? "swh-skeleton swh-skeleton--video" : "swh-skeleton";
      card.innerHTML = "<i></i><span><b></b><b></b><b></b></span>";
      results.append(card);
    }
  }

  async function fetchSearch(provider, query) {
    if (!API_BASE) throw Object.assign(new Error("Backend chưa được khai báo trong config.js."), { code: "BACKEND_NOT_CONFIGURED" });
    const params = new URLSearchParams({ q: query });
    if (provider === "google") {
      params.set("kind", state.googleKind);
      params.set("page", String(state.googlePage));
      params.set("date", root.querySelector("[data-google-date]").value);
      params.set("file", root.querySelector("[data-google-file]").value);
      params.set("site", root.querySelector("[data-google-site]").value.trim());
      params.set("safe", root.querySelector("[data-google-safe]").checked ? "active" : "off");
    } else {
      params.set("order", root.querySelector("[data-youtube-order]").value);
      params.set("duration", root.querySelector("[data-youtube-duration]").value);
      params.set("definition", root.querySelector("[data-youtube-definition]").value);
      params.set("published", root.querySelector("[data-youtube-published]").value);
      params.set("caption", root.querySelector("[data-youtube-caption]").value);
      params.set("event", root.querySelector("[data-youtube-event]").value);
      params.set("safe", root.querySelector("[data-youtube-safe]").value);
      params.set("region", root.querySelector("[data-youtube-region]").value);
      params.set("language", root.querySelector("[data-youtube-language]").value);
      if (state.youtubePageToken) params.set("pageToken", state.youtubePageToken);
    }
    const response = await fetch(`${API_BASE}/api/search/${provider}?${params}`, { headers: { Accept: "application/json" }, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || "Không thể tải kết quả tìm kiếm."), { code: data.code || "", required: data.required || [] });
    return data;
  }

  async function runSearch(provider, rawQuery, options = {}) {
    const query = String(rawQuery || "").trim().slice(0, 180);
    if (!query || state.busy) return;
    if (options.resetPage) {
      state.googlePage = 1;
      state.youtubePageToken = "";
    }
    if (provider === "youtube") {
      const videoId = parseYouTubeId(query);
      if (videoId) {
        rememberSearch(provider, query);
        loadVideo(makeVideoFromId(videoId));
        return;
      }
    }
    state.lastQuery[provider] = query;
    rememberSearch(provider, query);
    setLoading(provider, true, `Đang tìm “${query}”...`);
    try {
      const data = await fetchSearch(provider, query);
      if (provider === "google") renderGoogle(data);
      else renderYouTube(data);
    } catch (error) {
      renderError(provider, query, error);
    } finally {
      setLoading(provider, false);
    }
  }

  function renderError(provider, query, error) {
    const results = root.querySelector(`[data-results="${provider}"]`);
    results.replaceChildren();
    results.classList.remove("swh-image-grid");
    const card = document.createElement("div");
    card.className = "swh-service-error";
    const title = document.createElement("h4");
    title.textContent = error.code === "SEARCH_NOT_CONFIGURED"
      ? "API chưa được cấu hình trên Vercel"
      : error.code === "VERTEX_IMAGE_SEARCH_UNSUPPORTED" ? "Agent Search không hỗ trợ tìm ảnh toàn web" : "Chưa tải được kết quả";
    const copy = document.createElement("p");
    copy.textContent = error.code === "SEARCH_NOT_CONFIGURED"
      ? `${provider === "google" ? "Google Search cần bộ biến Vertex hoặc GOOGLE_SEARCH_API_KEY và GOOGLE_SEARCH_ENGINE_ID" : "YouTube cần YOUTUBE_API_KEY"}. Khóa chỉ đặt ở Vercel, không nhập vào HTML.`
      : error.message;
    const actions = document.createElement("div");
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Thử lại";
    retry.addEventListener("click", () => runSearch(provider, query));
    const external = document.createElement("a");
    external.target = "_blank";
    external.rel = "noopener";
    external.href = provider === "google"
      ? `${error.code === "VERTEX_IMAGE_SEARCH_UNSUPPORTED" ? "https://www.google.com/search?tbm=isch&q=" : "https://www.google.com/search?q="}${encodeURIComponent(query)}`
      : `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    external.textContent = `Mở ${error.code === "VERTEX_IMAGE_SEARCH_UNSUPPORTED" ? "Google Images" : provider === "google" ? "Google" : "YouTube"}`;
    actions.append(retry, external);
    card.append(title, copy, actions);
    results.append(card);
    root.querySelector(`[data-${provider}-meta]`).textContent = "Kiểm tra trạng thái API ở góc trên bên phải.";
    checkServices();
  }

  function createAction(text, handler, active = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.classList.toggle("active", active);
    button.addEventListener("click", handler);
    return button;
  }

  function toggleWebSave(item) {
    const saved = readStore(STORAGE.webSaved);
    const exists = saved.some((entry) => entry.url === item.url);
    writeStore(STORAGE.webSaved, exists ? saved.filter((entry) => entry.url !== item.url) : [item, ...saved].slice(0, 30));
    renderWebSaved();
    return !exists;
  }

  function renderGoogle(data) {
    const results = root.querySelector('[data-results="google"]');
    results.replaceChildren();
    const items = Array.isArray(data.items) ? data.items : [];
    const speed = data.searchTime ? ` · ${Number(data.searchTime).toFixed(2)} giây` : "";
    root.querySelector("[data-google-meta]").textContent = `${formatNumber(data.total)} kết quả cho “${data.query}” · Trang ${data.page}${speed}`;
    const pager = root.querySelector("[data-google-pager]");
    pager.hidden = !items.length;
    pager.querySelector('[data-google-page="prev"]').disabled = !data.hasPrevious;
    pager.querySelector('[data-google-page="next"]').disabled = !data.hasNext;
    results.classList.toggle("swh-image-grid", data.kind === "images");
    if (data.correctedQuery) {
      const suggestion = document.createElement("button");
      suggestion.className = "swh-correction";
      suggestion.type = "button";
      suggestion.textContent = `Tìm với: ${data.correctedQuery}`;
      suggestion.addEventListener("click", () => {
        root.querySelector('[data-search-form="google"] input').value = data.correctedQuery;
        runSearch("google", data.correctedQuery, { resetPage: true });
      });
      results.append(suggestion);
    }
    if (!items.length) return renderEmpty(results, "Không tìm thấy kết quả phù hợp", "Hãy thử cụm từ ngắn hoặc bộ lọc khác.", "G");

    items.forEach((item) => {
      const article = document.createElement("article");
      article.className = data.kind === "images" ? "swh-image-result" : "swh-google-result";
      if (item.image) {
        const image = document.createElement("img");
        image.src = item.image;
        image.alt = item.title || "Kết quả hình ảnh";
        image.loading = "lazy";
        article.append(image);
      }
      const content = document.createElement("div");
      const site = document.createElement("small");
      site.textContent = item.displayUrl || "Website";
      const title = document.createElement("a");
      title.href = item.url;
      title.target = "_blank";
      title.rel = "noopener";
      title.textContent = item.title || item.url;
      const snippet = document.createElement("p");
      snippet.textContent = item.snippet || "Mở kết quả để xem nội dung đầy đủ.";
      const actions = document.createElement("div");
      actions.className = "swh-result-actions";
      const isSaved = readStore(STORAGE.webSaved).some((entry) => entry.url === item.url);
      const save = createAction(isSaved ? "Đã lưu" : "Lưu", () => {
        const saved = toggleWebSave(item);
        save.textContent = saved ? "Đã lưu" : "Lưu";
        save.classList.toggle("active", saved);
      }, isSaved);
      const copy = createAction("Sao chép", () => copyText(item.url, copy));
      actions.append(save, copy);
      content.append(site, title, snippet, actions);
      article.append(content);
      results.append(article);
    });
  }

  function renderYouTube(data) {
    const results = root.querySelector('[data-results="youtube"]');
    results.replaceChildren();
    const incoming = Array.isArray(data.items) ? data.items : [];
    const items = incoming;
    state.youtubeItems = items;
    state.youtubeNextToken = data.nextPageToken || "";
    state.youtubePreviousToken = data.previousPageToken || "";
    root.querySelector("[data-youtube-meta]").textContent = `${formatNumber(data.total)} video cho “${data.query}” · ${items.length} video trên trang này · ${data.region || "VN"}`;
    const pager = root.querySelector("[data-youtube-pager]");
    pager.hidden = !items.length;
    pager.querySelector('[data-youtube-page="prev"]').disabled = !state.youtubePreviousToken;
    pager.querySelector('[data-youtube-page="next"]').disabled = !state.youtubeNextToken;
    if (!items.length) return renderEmpty(results, "Không tìm thấy video", "Hãy thử chủ đề hoặc bộ lọc khác.", "▶");
    items.forEach((video) => results.append(createVideoCard(video)));
  }

  function createVideoCard(video) {
    const article = document.createElement("article");
    article.className = "swh-video-card";
    article.tabIndex = 0;
    const media = document.createElement("div");
    media.className = "swh-video-thumb";
    const image = document.createElement("img");
    image.src = video.thumbnail || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
    image.alt = video.title || "Video YouTube";
    image.loading = "lazy";
    const play = document.createElement("span");
    play.textContent = "▶";
    media.append(image, play);
    if (video.duration) {
      const duration = document.createElement("time");
      duration.textContent = video.duration;
      media.append(duration);
    }
    const content = document.createElement("div");
    const title = document.createElement("h4");
    title.textContent = video.title;
    const meta = document.createElement("p");
    meta.textContent = [video.channel, video.views ? `${formatNumber(video.views)} lượt xem` : "", formatDate(video.publishedAt)].filter(Boolean).join(" · ");
    const badges = document.createElement("div");
    badges.className = "swh-video-badges";
    if (video.definition) badges.append(Object.assign(document.createElement("span"), { textContent: video.definition.toUpperCase() }));
    if (video.captions) badges.append(Object.assign(document.createElement("span"), { textContent: "CC" }));
    if (video.live) badges.append(Object.assign(document.createElement("span"), { textContent: "LIVE" }));
    const actions = document.createElement("div");
    actions.className = "swh-video-actions";
    const queue = createAction(isQueued(video.id) ? "Đã xếp" : "+ Hàng đợi", (event) => {
      event.stopPropagation();
      toggleQueue(video);
      queue.textContent = isQueued(video.id) ? "Đã xếp" : "+ Hàng đợi";
      queue.classList.toggle("active", isQueued(video.id));
    }, isQueued(video.id));
    const save = createAction(isFavorite(video.id) ? "Đã lưu" : "Lưu", (event) => {
      event.stopPropagation();
      toggleFavorite(video);
      save.textContent = isFavorite(video.id) ? "Đã lưu" : "Lưu";
      save.classList.toggle("active", isFavorite(video.id));
    }, isFavorite(video.id));
    actions.append(queue, save);
    if (video.channelId) {
      const channel = createAction("Kênh", (event) => {
        event.stopPropagation();
        window.open(`https://www.youtube.com/channel/${encodeURIComponent(video.channelId)}`, "_blank", "noopener");
      });
      actions.append(channel);
    }
    content.append(title, meta, badges, actions);
    article.append(media, content);
    const playVideo = () => loadVideo(video);
    article.addEventListener("click", playVideo);
    article.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); playVideo(); }
    });
    return article;
  }

  function loadVideo(video, options = {}) {
    state.currentVideo = video;
    const shell = playerNode;
    const origin = location.origin && location.origin !== "null" ? `&origin=${encodeURIComponent(location.origin)}` : "";
    shell.querySelector("iframe").src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}?autoplay=1&playsinline=1&rel=0&enablejsapi=1${origin}`;
    shell.querySelector("[data-player-title]").textContent = video.title;
    shell.querySelector("[data-player-channel]").textContent = [video.channel || "YouTube", video.views ? `${formatNumber(video.views)} lượt xem` : ""].filter(Boolean).join(" · ");
    shell.hidden = false;
    if (!state.privacyShield) writeStore(STORAGE.recent, [video, ...readStore(STORAGE.recent).filter((item) => item.id !== video.id)].slice(0, 20));
    renderLibraries();
    updatePlayerFavorite();
    shell.querySelector("[data-player-rate]").value = String(state.playerRate);
    setTimeout(() => playerCommand("setPlaybackRate", [state.playerRate]), 700);
    if (options.scroll !== false && !state.floating && !state.pipWindow) shell.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function isFavorite(id) {
    return readStore(STORAGE.favorites).some((item) => item.id === id);
  }

  function toggleFavorite(video) {
    if (!video?.id) return;
    const items = readStore(STORAGE.favorites);
    const exists = items.some((item) => item.id === video.id);
    writeStore(STORAGE.favorites, exists ? items.filter((item) => item.id !== video.id) : [video, ...items].slice(0, 40));
    renderLibraries();
    updatePlayerFavorite();
  }

  function updatePlayerFavorite() {
    const button = playerNode?.querySelector("[data-player-favorite]");
    if (!button || !state.currentVideo) return;
    const saved = isFavorite(state.currentVideo.id);
    button.classList.toggle("active", saved);
    button.textContent = saved ? "Đã lưu" : "Lưu video";
  }

  function renderLibraries() {
    if (!root) return;
    renderVideoStrip(root.querySelector("[data-youtube-recent]"), readStore(STORAGE.recent));
    const favorites = readStore(STORAGE.favorites);
    renderVideoStrip(root.querySelector("[data-youtube-favorites]"), favorites);
    root.querySelector("[data-favorite-count]").textContent = `${favorites.length} video`;
    renderQueue();
  }

  function moveQueueItem(index, direction) {
    const items = queueItems();
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    writeStore(STORAGE.queue, items);
    renderQueue();
  }

  async function importPlaylist() {
    const input = root.querySelector('[data-search-form="youtube"] input');
    const playlistId = parsePlaylistId(input?.value);
    const meta = root.querySelector("[data-youtube-meta]");
    if (!playlistId) {
      meta.textContent = "Dán liên kết playlist YouTube hoặc playlist ID vào ô tìm kiếm trước khi nhập.";
      input?.focus();
      return;
    }
    if (!API_BASE) return renderError("youtube", input.value, Object.assign(new Error("Backend chưa được khai báo."), { code: "BACKEND_NOT_CONFIGURED" }));
    meta.textContent = "Đang nhập playlist vào hàng đợi...";
    try {
      const params = new URLSearchParams({ action: "playlist-items", playlistId, maxResults: "50" });
      const response = await fetch(`${API_BASE}/api/search/youtube?${params}`, { headers: { Accept: "application/json" }, cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Không thể đọc playlist.");
      const videos = (data.items || []).map((item) => {
        const id = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId || "";
        const snippet = item.snippet || {};
        return {
          id,
          title: snippet.title || `Video YouTube ${id}`,
          channel: snippet.videoOwnerChannelTitle || snippet.channelTitle || "YouTube",
          description: snippet.description || "",
          thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
          publishedAt: snippet.publishedAt || ""
        };
      }).filter((video) => video.id && video.title !== "Private video" && video.title !== "Deleted video");
      const existing = queueItems();
      const merged = [...existing, ...videos.filter((video) => !existing.some((item) => item.id === video.id))].slice(0, 60);
      writeStore(STORAGE.queue, merged);
      renderLibraries();
      meta.textContent = `Đã nhập ${merged.length - existing.length} video mới từ playlist · ${merged.length} video trong hàng đợi.`;
      if (!state.currentVideo && merged.length) loadVideo(merged[0], { scroll: false });
    } catch (error) {
      meta.textContent = error.message || "Không thể nhập playlist.";
    }
  }

  function parsePlaylistId(value) {
    const input = String(value || "").trim();
    try {
      const url = new URL(input);
      return /^[A-Za-z0-9_-]{10,128}$/.test(url.searchParams.get("list") || "") ? url.searchParams.get("list") : "";
    } catch {
      return /^[A-Za-z0-9_-]{10,128}$/.test(input) ? input : "";
    }
  }

  function renderQueue() {
    const container = root.querySelector("[data-youtube-queue]");
    const items = queueItems();
    root.querySelector("[data-queue-count]").textContent = `${items.length} trong hàng đợi`;
    container.replaceChildren();
    if (!items.length) {
      container.append(Object.assign(document.createElement("p"), { textContent: "Hàng đợi đang trống. Chọn + Hàng đợi ở một video để bắt đầu." }));
      return;
    }
    items.forEach((video, index) => {
      const row = document.createElement("article");
      row.classList.toggle("active", video.id === state.currentVideo?.id);
      const image = document.createElement("img");
      image.src = video.thumbnail || `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`;
      image.alt = "";
      const details = document.createElement("button");
      details.type = "button";
      details.innerHTML = `<small>${String(index + 1).padStart(2, "0")} · ${video.channel || "YouTube"}</small><b></b>`;
      details.querySelector("b").textContent = video.title;
      details.addEventListener("click", () => loadVideo(video));
      const controls = document.createElement("div");
      controls.className = "swh-queue-controls";
      const up = document.createElement("button");
      up.type = "button";
      up.title = "Đưa lên";
      up.textContent = "↑";
      up.disabled = index === 0;
      up.addEventListener("click", () => moveQueueItem(index, -1));
      const down = document.createElement("button");
      down.type = "button";
      down.title = "Đưa xuống";
      down.textContent = "↓";
      down.disabled = index === items.length - 1;
      down.addEventListener("click", () => moveQueueItem(index, 1));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "swh-queue-remove";
      remove.title = "Bỏ khỏi hàng đợi";
      remove.textContent = "×";
      remove.addEventListener("click", () => toggleQueue(video));
      controls.append(up, down, remove);
      row.append(image, details, controls);
      container.append(row);
    });
  }

  function renderVideoStrip(container, items) {
    container.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("small");
      empty.textContent = "Chưa có video";
      container.append(empty);
      return;
    }
    items.slice(0, 6).forEach((video) => {
      const button = document.createElement("button");
      button.type = "button";
      button.title = video.title;
      const image = document.createElement("img");
      image.src = video.thumbnail || `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`;
      image.alt = "";
      const span = document.createElement("span");
      span.textContent = video.title;
      button.append(image, span);
      button.addEventListener("click", () => loadVideo(video));
      container.append(button);
    });
  }

  function renderSearchHistory() {
    if (!root) return;
    const container = root.querySelector("[data-swh-history]");
    container.replaceChildren();
    const items = readStore(STORAGE.searches);
    if (!items.length) return container.append(Object.assign(document.createElement("p"), { textContent: "Chưa có lượt tìm kiếm" }));
    items.slice(0, 8).forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      const badge = document.createElement("b");
      badge.textContent = item.provider === "youtube" ? "Y" : "G";
      const label = document.createElement("span");
      label.textContent = item.query;
      button.append(badge, label);
      button.addEventListener("click", () => openHub(item.provider, item.query));
      container.append(button);
    });
  }

  function renderWebSaved() {
    if (!root) return;
    const container = root.querySelector("[data-web-saved]");
    container.replaceChildren();
    const items = readStore(STORAGE.webSaved);
    if (!items.length) return container.append(Object.assign(document.createElement("p"), { textContent: "Chưa lưu website" }));
    items.slice(0, 5).forEach((item) => {
      const link = document.createElement("a");
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.title = item.title;
      const badge = document.createElement("b");
      badge.textContent = "★";
      const label = document.createElement("span");
      label.textContent = item.title || item.displayUrl;
      link.append(badge, label);
      container.append(link);
    });
  }

  function renderEmpty(container, titleText, copyText, markText) {
    const empty = document.createElement("div");
    empty.className = "swh-empty";
    const mark = document.createElement("b");
    mark.textContent = markText;
    const title = document.createElement("h4");
    title.textContent = titleText;
    const copy = document.createElement("p");
    copy.textContent = copyText;
    empty.append(mark, title, copy);
    container.append(empty);
  }

  async function copyText(value, button) {
    try {
      await navigator.clipboard.writeText(value);
      if (button) {
        const old = button.textContent;
        button.textContent = "Đã chép";
        setTimeout(() => { button.textContent = old; }, 1200);
      }
    } catch { /* Clipboard permission can be denied. */ }
  }

  function startVoice(provider, button) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      button.title = "Trình duyệt này chưa hỗ trợ nhận dạng giọng nói";
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "vi-VN";
    recognition.interimResults = false;
    button.classList.add("listening");
    recognition.addEventListener("result", (event) => {
      const query = event.results?.[0]?.[0]?.transcript || "";
      const input = root.querySelector(`[data-search-form="${provider}"] input`);
      input.value = query;
      runSearch(provider, query, { resetPage: true });
    });
    recognition.addEventListener("end", () => button.classList.remove("listening"));
    recognition.start();
  }

  function bindHub() {
    root.querySelectorAll("[data-swh-close]").forEach((button) => button.addEventListener("click", closeHub));
    root.querySelectorAll("[data-swh-tab]").forEach((button) => button.addEventListener("click", () => setTab(button.dataset.swhTab)));
    root.querySelectorAll("[data-search-form]").forEach((form) => form.addEventListener("submit", (event) => {
      event.preventDefault();
      runSearch(form.dataset.searchForm, new FormData(form).get("q"), { resetPage: true });
    }));
    root.querySelectorAll("[data-voice]").forEach((button) => button.addEventListener("click", () => startVoice(button.dataset.voice, button)));
    root.querySelectorAll("[data-google-kind]").forEach((button) => button.addEventListener("click", () => {
      state.googleKind = button.dataset.googleKind;
      state.googlePage = 1;
      root.querySelectorAll("[data-google-kind]").forEach((item) => item.classList.toggle("active", item === button));
      const query = root.querySelector('[data-search-form="google"] input').value;
      if (query) runSearch("google", query);
    }));
    root.querySelectorAll("[data-google-page]").forEach((button) => button.addEventListener("click", () => {
      state.googlePage = button.dataset.googlePage === "next" ? Math.min(10, state.googlePage + 1) : Math.max(1, state.googlePage - 1);
      runSearch("google", state.lastQuery.google);
    }));
    root.querySelectorAll("[data-youtube-page]").forEach((button) => button.addEventListener("click", () => {
      state.youtubePageToken = button.dataset.youtubePage === "next" ? state.youtubeNextToken : state.youtubePreviousToken;
      runSearch("youtube", state.lastQuery.youtube);
    }));
    playerNode.querySelector("[data-player-favorite]").addEventListener("click", () => toggleFavorite(state.currentVideo));
    playerNode.querySelector("[data-player-open]").addEventListener("click", () => {
      if (state.currentVideo?.id) window.open(`https://www.youtube.com/watch?v=${encodeURIComponent(state.currentVideo.id)}`, "_blank", "noopener");
    });
    playerNode.querySelector("[data-player-share]").addEventListener("click", (event) => {
      if (!state.currentVideo?.id) return;
      const url = `https://youtu.be/${state.currentVideo.id}`;
      if (navigator.share) navigator.share({ title: state.currentVideo.title, url }).catch(() => {});
      else copyText(url, event.currentTarget);
    });
    playerNode.querySelector("#hhYouTubePlayer").addEventListener("load", () => {
      setTimeout(() => {
        playerCommand("addEventListener", ["onStateChange"]);
        playerCommand("setPlaybackRate", [state.playerRate]);
      }, 350);
    });
    playerNode.querySelector("[data-player-play]").addEventListener("click", () => playerCommand("playVideo"));
    playerNode.querySelector("[data-player-pause]").addEventListener("click", () => playerCommand("pauseVideo"));
    playerNode.querySelector("[data-player-previous]").addEventListener("click", () => playQueueStep(-1));
    playerNode.querySelector("[data-player-next]").addEventListener("click", () => playQueueStep(1));
    playerNode.querySelector("[data-player-rate]").addEventListener("change", (event) => {
      state.playerRate = Number(event.currentTarget.value) || 1;
      savePreferences();
      playerCommand("setPlaybackRate", [state.playerRate]);
    });
    root.querySelector("[data-privacy-shield]").addEventListener("click", () => {
      state.privacyShield = !state.privacyShield;
      savePreferences();
      updatePreferenceControls();
      if (state.lastQuery.youtube) runSearch("youtube", state.lastQuery.youtube, { resetPage: true });
    });
    root.querySelector("[data-autoplay-queue]").addEventListener("click", () => {
      state.autoplayQueue = !state.autoplayQueue;
      savePreferences();
      updatePreferenceControls();
    });
    root.querySelector("[data-youtube-random]").addEventListener("click", () => {
      if (!state.youtubeItems.length) return;
      loadVideo(state.youtubeItems[Math.floor(Math.random() * state.youtubeItems.length)]);
    });
    root.querySelector("[data-youtube-focus]").addEventListener("click", (event) => {
      const active = root.classList.toggle("swh-focus");
      event.currentTarget.classList.toggle("active", active);
      event.currentTarget.setAttribute("aria-pressed", String(active));
    });
    root.querySelector("[data-youtube-mini]").addEventListener("click", (event) => {
      if (playerNode.hidden) return;
      if (state.floating) returnPlayerToHub({ open: false });
      else activateFloatingPlayer();
    });
    root.querySelector("[data-youtube-pip]").addEventListener("click", openDocumentPip);
    root.querySelector("[data-youtube-import-playlist]").addEventListener("click", importPlaylist);
    root.querySelector("[data-clear-queue]").addEventListener("click", () => {
      writeStore(STORAGE.queue, []);
      renderLibraries();
    });
    root.querySelector("[data-clear-recent]").addEventListener("click", () => { writeStore(STORAGE.recent, []); renderLibraries(); });
    root.querySelector("[data-swh-clear-history]").addEventListener("click", () => { writeStore(STORAGE.searches, []); renderSearchHistory(); });
  }

  function wireLaunchers() {
    document.addEventListener("click", (event) => {
      const launcher = event.target.closest("[data-search-watch-open]");
      if (!launcher) return;
      event.preventDefault();
      if (window.matchMedia("(max-width: 760px)").matches) document.body.classList.add("app-sidebar-collapsed");
      openHub(launcher.dataset.searchWatchOpen || "google");
    }, true);
    const liveForm = document.getElementById("googleLiveSearch");
    const liveInput = document.getElementById("googleLiveQuery");
    if (liveForm) {
      liveForm.addEventListener("submit", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        openHub("google", liveInput?.value || "");
      }, true);
      if (!liveForm.querySelector(".swh-inline-launcher")) {
        const launcher = document.createElement("button");
        launcher.className = "button ghost interactive swh-inline-launcher";
        launcher.type = "button";
        launcher.textContent = "Google + YouTube";
        launcher.addEventListener("click", () => openHub("google", liveInput?.value || ""));
        liveForm.append(launcher);
      }
    }
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && root?.classList.contains("open")) closeHub();
    if (event.altKey && !event.ctrlKey && !event.metaKey && ["g", "y"].includes(event.key.toLowerCase())) {
      event.preventDefault();
      openHub(event.key.toLowerCase() === "y" ? "youtube" : "google");
    }
  });

  window.addEventListener("message", (event) => {
    if (!/^(https:\/\/www\.)?youtube(?:-nocookie)?\.com$/.test(event.origin)) return;
    let message = event.data;
    try { if (typeof message === "string") message = JSON.parse(message); } catch { return; }
    if (message?.event === "onStateChange" && Number(message.info) === 0 && state.autoplayQueue) playQueueStep(1);
  });

  function init() {
    const preferences = readPreferences();
    state.privacyShield = preferences.privacyShield !== false;
    state.autoplayQueue = preferences.autoplayQueue === true;
    state.playerRate = [0.5, 0.75, 1, 1.25, 1.5, 2].includes(Number(preferences.playerRate)) ? Number(preferences.playerRate) : 1;
    createHub();
    wireLaunchers();
    window.HHSearchWatch = {
      open: openHub,
      close: closeHub,
      refreshStatus: checkServices,
      play: (value) => {
        const id = parseYouTubeId(value);
        openHub("youtube");
        if (id) loadVideo(makeVideoFromId(id));
      }
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
