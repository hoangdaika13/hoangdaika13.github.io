(function initHHYouTubeHub(scope, factory) {
  const api = factory(scope);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (scope) scope.HHYouTubeHub = api;
})(typeof window !== "undefined" ? window : globalThis, function createHHYouTubeHub(scope) {
  "use strict";

  let session = null;
  const VIEWS = Object.freeze([
    ["home", "⌂", "Trang chủ"], ["results", "⌕", "Khám phá"], ["recent", "◷", "Đã xem"],
    ["saved", "★", "Đã lưu"], ["playlists", "▤", "Playlist"]
  ]);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const core = () => scope.HHSearchPlatform;

  function topbarMarkup(state) {
    return `<header class="yh-topbar">
      <button class="yh-brand" type="button" data-yh-view="home"><span>▶</span><div><small>HH VIDEO UNIVERSE</small><strong>YouTube Center</strong></div></button>
      <form class="yh-search" data-yh-search-form><span>⌕</span><input type="search" name="q" value="${esc(state.query)}" placeholder="Tìm video hoặc dán liên kết YouTube…" autocomplete="off" required><button type="button" data-yh-voice aria-label="Tìm bằng giọng nói">◉</button><button type="submit">Tìm video</button></form>
      <div class="yh-top-actions"><button type="button" data-yh-filter-open>Bộ lọc</button><a href="#/davinci-resolve/youtube">Creator Studio</a><button type="button" data-yh-queue-open aria-label="Mở hàng đợi">≡ <b data-yh-queue-badge>${core().list("queue").length}</b></button></div>
    </header>`;
  }

  function sidebarMarkup(state) {
    const prefs = core().preferences();
    return `<aside class="yh-sidebar"><header><span>THƯ VIỆN</span><button type="button" data-yh-sidebar-close aria-label="Đóng thư viện">×</button></header><nav>${VIEWS.map(([id, icon, label]) => `<button type="button" data-yh-view="${id}" class="${state.view === id ? "is-active" : ""}"><i>${icon}</i><span>${label}</span><b>${id === "recent" ? core().list("recent").length : id === "saved" ? core().list("favorites").length : id === "playlists" ? core().playlists().length : ""}</b></button>`).join("")}</nav>
      <section><small>PHÁT NHANH</small><button type="button" data-yh-queue-play ${core().list("queue").length ? "" : "disabled"}>▶ Phát hàng đợi</button><button type="button" data-yh-import-open>＋ Nhập playlist</button></section>
      <footer><label><span><strong>Riêng tư</strong><small>${prefs.privacyShield ? "Không ghi lịch sử HH" : "Đang ghi lịch sử HH"}</small></span><input type="checkbox" data-yh-privacy ${prefs.privacyShield ? "checked" : ""}><i></i></label><label><span><strong>Tự phát</strong><small>Chuyển video tiếp theo</small></span><input type="checkbox" data-yh-autoplay ${prefs.autoplayQueue ? "checked" : ""}><i></i></label></footer>
    </aside>`;
  }

  function queueMarkup(state) {
    const items = core().list("queue");
    return `<aside class="yh-queue" data-yh-queue><header><div><span>WATCH QUEUE</span><h3>${items.length} video tiếp theo</h3></div><button type="button" data-yh-queue-close aria-label="Đóng hàng đợi">×</button></header>
      <div class="yh-now-mini">${state.current ? `<img src="${esc(state.current.thumbnail)}" alt=""><span><small>ĐANG PHÁT</small><strong>${esc(state.current.title)}</strong></span><i></i>` : '<span><small>CHƯA PHÁT VIDEO</small><strong>Chọn một video để bắt đầu</strong></span>'}</div>
      <div class="yh-queue-list" data-yh-queue-list>${items.length ? items.map((video, index) => queueRow(video, index, state.current?.id)).join("") : '<div class="yh-empty-side"><i>≡</i><p>Hàng đợi đang trống. Chọn “+ Hàng đợi” tại một video.</p></div>'}</div>
      <footer><button type="button" data-yh-clear-queue ${items.length ? "" : "disabled"}>Xóa hàng đợi</button><label>Lặp<input type="checkbox" data-yh-loop ${core().preferences().loopQueue ? "checked" : ""}><i></i></label></footer>
    </aside>`;
  }

  function queueRow(video, index, currentId) {
    return `<article class="${video.id === currentId ? "is-active" : ""}" draggable="true" data-yh-queue-index="${index}" data-yh-video-id="${esc(video.id)}"><span>${String(index + 1).padStart(2, "0")}</span><img src="${esc(video.thumbnail)}" alt=""><button type="button" data-yh-play="${esc(video.id)}"><strong>${esc(video.title)}</strong><small>${esc(video.channel)}</small></button><div><button type="button" data-yh-queue-move="up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-yh-queue-move="down" ${index === core().list("queue").length - 1 ? "disabled" : ""}>↓</button><button type="button" data-yh-queue-remove="${esc(video.id)}">×</button></div></article>`;
  }

  function filtersMarkup(state) {
    const option = (value, label, active) => `<option value="${value}" ${value === active ? "selected" : ""}>${label}</option>`;
    return `<section class="yh-filters" data-yh-filters aria-hidden="${!state.filtersOpen}"><header><div><span>DISCOVERY FILTERS</span><h3>Tinh chỉnh kết quả YouTube</h3></div><button type="button" data-yh-filter-close>×</button></header><div>
      <label>Sắp xếp<select data-yh-filter="order">${option("relevance","Phù hợp nhất",state.filters.order)}${option("date","Mới nhất",state.filters.order)}${option("viewCount","Nhiều lượt xem",state.filters.order)}${option("rating","Đánh giá cao",state.filters.order)}</select></label>
      <label>Thời lượng<select data-yh-filter="duration">${option("any","Tất cả",state.filters.duration)}${option("short","Dưới 4 phút",state.filters.duration)}${option("medium","4–20 phút",state.filters.duration)}${option("long","Trên 20 phút",state.filters.duration)}</select></label>
      <label>Ngày đăng<select data-yh-filter="published">${option("any","Mọi thời điểm",state.filters.published)}${option("d1","24 giờ",state.filters.published)}${option("w1","7 ngày",state.filters.published)}${option("m1","30 ngày",state.filters.published)}${option("y1","1 năm",state.filters.published)}</select></label>
      <label>Phụ đề<select data-yh-filter="caption">${option("any","Tất cả",state.filters.caption)}${option("closedCaption","Có phụ đề",state.filters.caption)}${option("none","Không phụ đề",state.filters.caption)}</select></label>
      <label>Trạng thái<select data-yh-filter="event">${option("any","Mọi video",state.filters.event)}${option("live","Đang trực tiếp",state.filters.event)}${option("upcoming","Sắp phát",state.filters.event)}${option("completed","Đã phát xong",state.filters.event)}</select></label>
      <label>Chất lượng<select data-yh-filter="definition">${option("any","Mọi chất lượng",state.filters.definition)}${option("high","HD",state.filters.definition)}${option("standard","SD",state.filters.definition)}</select></label>
      <label>Khu vực<select data-yh-filter="region">${option("VN","Việt Nam",state.filters.region)}${option("US","Hoa Kỳ",state.filters.region)}${option("GB","Anh",state.filters.region)}${option("JP","Nhật Bản",state.filters.region)}${option("KR","Hàn Quốc",state.filters.region)}</select></label>
      <label>Ngôn ngữ<select data-yh-filter="language">${option("vi","Tiếng Việt",state.filters.language)}${option("en","English",state.filters.language)}${option("ja","日本語",state.filters.language)}${option("ko","한국어",state.filters.language)}</select></label>
    </div><footer><button type="button" data-yh-filter-reset>Đặt lại</button><button type="button" data-yh-filter-apply>Áp dụng bộ lọc</button></footer></section>`;
  }

  function shellMarkup(state) {
    return `<section class="youtube-hub" data-youtube-hub data-view="${state.view}"><div class="yh-ambient" aria-hidden="true"><i></i><i></i><i></i><b></b><b></b></div>${topbarMarkup(state)}<div class="yh-grid">${sidebarMarkup(state)}<main class="yh-main"><div class="yh-mobile-context"><button type="button" data-yh-sidebar-open>☰ Thư viện</button><span>${VIEWS.find((item) => item[0] === state.view)?.[2] || "YouTube"}</span><button type="button" data-yh-queue-open>Hàng đợi · ${core().list("queue").length}</button></div><div class="yh-main-scroll" data-yh-main></div></main>${queueMarkup(state)}</div>${filtersMarkup(state)}<div class="yh-import-dialog" data-yh-import-dialog aria-hidden="true"><div><header><span>NHẬP PLAYLIST</span><button type="button" data-yh-import-close>×</button></header><h3>Đưa playlist vào hàng đợi</h3><p>Dán URL playlist YouTube công khai hoặc playlist ID. Video riêng tư và đã xóa sẽ bị loại bỏ.</p><form data-yh-import-form><input name="playlist" placeholder="https://youtube.com/playlist?list=…" required><button>Nhập playlist</button></form><small data-yh-import-status>Chỉ gọi YouTube Data API sau khi bạn xác nhận.</small></div></div><div class="yh-toast" data-yh-toast role="status" aria-live="polite" hidden></div></section>`;
  }

  function homeMarkup(state) {
    const recent = core().list("recent"), favorites = core().list("favorites"), queue = core().list("queue");
    const continueItems = recent.length ? recent : favorites.length ? favorites : queue;
    return `<section class="yh-home"><header><div><span>YOUTUBE WATCH GALAXY</span><h2>Xem, lưu và tổ chức video theo cách của bạn.</h2><p>Tìm kiếm bằng API chính thức, phát bằng YouTube NoCookie và giữ thư viện cá nhân trên thiết bị.</p><div><button type="button" data-yh-focus-search>⌕ Tìm video</button><a href="#/davinci-resolve/youtube">Mở Creator Studio →</a></div></div><div class="yh-hero-orbit" aria-hidden="true"><i></i><i></i><i></i><b>▶</b><em></em></div></header>
      <section class="yh-stat-grid"><article><i>◷</i><span><small>Đã xem</small><strong>${recent.length}</strong></span></article><article><i>★</i><span><small>Đã lưu</small><strong>${favorites.length}</strong></span></article><article><i>≡</i><span><small>Hàng đợi</small><strong>${queue.length}</strong></span></article><article><i>▤</i><span><small>Playlist</small><strong>${core().playlists().length}</strong></span></article></section>
      <section class="yh-home-section"><header><div><span>TIẾP TỤC XEM</span><h3>${continueItems.length ? "Thư viện của bạn" : "Chưa có hoạt động xem"}</h3></div>${continueItems.length ? `<button type="button" data-yh-view="${recent.length ? "recent" : favorites.length ? "saved" : "results"}">Xem tất cả</button>` : ""}</header>${continueItems.length ? `<div class="yh-filmstrip">${continueItems.slice(0,6).map((video) => compactCard(video)).join("")}</div>` : '<div class="yh-home-empty"><div><i></i><i></i><i></i><b>▶</b></div><h3>Bắt đầu bằng một chủ đề bạn yêu thích</h3><p>Nhập từ khóa phía trên hoặc dán liên kết YouTube để phát ngay.</p><button type="button" data-yh-focus-search>Tìm video đầu tiên</button></div>'}</section>
      <div class="yh-home-columns"><section><header><span>HÀNG ĐỢI</span><h3>Video tiếp theo</h3></header>${queue.length ? `<div class="yh-mini-list">${queue.slice(0,5).map((video,index)=>`<button type="button" data-yh-play="${esc(video.id)}"><span>${String(index+1).padStart(2,"0")}</span><img src="${esc(video.thumbnail)}" alt=""><strong>${esc(video.title)}</strong><b>▶</b></button>`).join("")}</div>` : '<p>Hàng đợi đang trống.</p>'}</section><section><header><span>PLAYLIST</span><h3>Bộ sưu tập cá nhân</h3></header>${playlistSummary()}</section></div>
    </section>`;
  }

  function playlistSummary() {
    const items = core().playlists();
    if (!items.length) return '<div class="yh-playlist-empty"><i>＋</i><p>Tạo playlist đầu tiên để gom video theo chủ đề.</p><button type="button" data-yh-view="playlists">Tạo playlist</button></div>';
    return `<div class="yh-playlist-summary">${items.slice(0,4).map((item) => `<button type="button" data-yh-playlist="${esc(item.id)}"><i>▤</i><span><strong>${esc(item.name)}</strong><small>${item.videos.length} video</small></span><b>→</b></button>`).join("")}</div>`;
  }

  function compactCard(video) {
    return `<article><button type="button" data-yh-play="${esc(video.id)}"><span><img src="${esc(video.thumbnail)}" alt="" loading="lazy"><i>▶</i>${video.duration ? `<time>${esc(video.duration)}</time>` : ""}</span><strong>${esc(video.title)}</strong><small>${esc(video.channel)}</small></button></article>`;
  }

  function playerMarkup(video) {
    if (!video) return "";
    const origin = location.origin && location.origin !== "null" ? `&origin=${encodeURIComponent(location.origin)}` : "";
    return `<section class="yh-player-shell" data-yh-player><header><div><i></i><span>NOW PLAYING · YOUTUBE NOCookie</span></div><nav><button type="button" data-yh-theatre aria-pressed="${session?.state.theatre || false}">◐ Rạp</button><button type="button" data-yh-mini>▣ Mini</button><button type="button" data-yh-pip>▣ PiP</button><button type="button" data-yh-player-close>×</button></nav></header><div class="yh-player-stage"><iframe data-yh-player-frame src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}?autoplay=1&playsinline=1&controls=1&fs=1&rel=0&modestbranding=1&iv_load_policy=3&enablejsapi=1${origin}" title="YouTube · ${esc(video.title)}" loading="eager" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><div class="yh-player-energy" aria-hidden="true"><i></i><i></i><i></i><i></i></div></div><div class="yh-player-controls"><button type="button" data-yh-player-command="previous">◀</button><button type="button" data-yh-player-command="play">▶</button><button type="button" data-yh-player-command="pause">Ⅱ</button><button type="button" data-yh-player-command="next">▶▶</button><label>Tốc độ<select data-yh-rate>${[.5,.75,1,1.25,1.5,2].map((rate)=>`<option value="${rate}" ${core().preferences().playerRate===rate?"selected":""}>${rate}×</option>`).join("")}</select></label><span>${core().preferences().privacyShield ? "NoCookie · riêng tư" : "NoCookie · có lịch sử HH"}</span></div><footer><div><h2>${esc(video.title)}</h2><p>${esc(video.channel)}${video.views ? ` · ${core().formatNumber(video.views)} lượt xem` : ""}</p></div><nav><button type="button" data-yh-favorite="${esc(video.id)}" class="${core().isVideoIn("favorites",video.id)?"is-active":""}">${core().isVideoIn("favorites",video.id)?"★ Đã lưu":"☆ Lưu"}</button><button type="button" data-yh-share>Chia sẻ</button><a href="https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}" target="_blank" rel="noopener">YouTube ↗</a></nav></footer></section>`;
  }

  function resultsMarkup(state) {
    return `<section class="yh-results-workspace"><header class="yh-result-head"><div><span>VIDEO DISCOVERY</span><h2>${state.query ? `Kết quả cho “${esc(state.query)}”` : "Khám phá video"}</h2><p>${esc(state.status || "Nhập chủ đề hoặc dán liên kết để bắt đầu.")}</p></div><button type="button" data-yh-filter-open>Bộ lọc <b>+</b></button></header><div class="yh-video-grid" data-yh-results>${state.results.length ? state.results.map((video,index)=>videoCard(video,index)).join("") : emptyResults()}</div><footer class="yh-pager" ${state.results.length ? "" : "hidden"}><button type="button" data-yh-page="prev" ${state.previousPageToken ? "" : "disabled"}>‹ Trang trước</button><span>${state.results.length} video trên trang</span><button type="button" data-yh-page="next" ${state.nextPageToken ? "" : "disabled"}>Trang sau ›</button></footer></section>`;
  }

  function videoCard(video, index) {
    const favorite = core().isVideoIn("favorites", video.id), queued = core().isVideoIn("queue", video.id);
    return `<article class="yh-video-card" style="--video-index:${index}"><button class="yh-video-media" type="button" data-yh-play="${esc(video.id)}"><img src="${esc(video.thumbnail)}" alt="${esc(video.title)}" loading="lazy"><span>▶</span>${video.duration ? `<time>${esc(video.duration)}</time>` : ""}${video.live ? "<b>LIVE</b>" : video.upcoming ? "<b>UPCOMING</b>" : ""}</button><div><button class="yh-video-title" type="button" data-yh-play="${esc(video.id)}">${esc(video.title)}</button><p>${esc(video.channel)}${video.views ? ` · ${core().formatNumber(video.views)} lượt xem` : ""}${video.publishedAt ? ` · ${core().formatDate(video.publishedAt)}` : ""}</p><div class="yh-badges">${video.definition ? `<span>${esc(video.definition.toUpperCase())}</span>` : ""}${video.captions ? "<span>CC</span>" : ""}</div><footer><button type="button" data-yh-queue-toggle="${esc(video.id)}" class="${queued?"is-active":""}">${queued?"✓ Đã xếp":"＋ Hàng đợi"}</button><button type="button" data-yh-favorite="${esc(video.id)}" class="${favorite?"is-active":""}">${favorite?"★ Đã lưu":"☆ Lưu"}</button><button type="button" data-yh-playlist-add="${esc(video.id)}">＋ Playlist</button></footer></div></article>`;
  }

  function emptyResults() {
    return '<div class="yh-results-empty"><div><i></i><i></i><i></i><b>▶</b><em></em></div><h3>Video Galaxy đang chờ tín hiệu</h3><p>Kết quả sẽ hiển thị dạng lưới cùng thời lượng, lượt xem, phụ đề và hành động thư viện.</p></div>';
  }

  function libraryMarkup(state, kind, title, description) {
    const items = core().list(kind);
    return `<section class="yh-library-view"><header><div><span>THƯ VIỆN CÁ NHÂN</span><h2>${title}</h2><p>${description}</p></div><b>${items.length}</b></header>${items.length ? `<div class="yh-video-grid">${items.map((video,index)=>videoCard(video,index)).join("")}</div>` : `<div class="yh-library-empty"><i>${kind === "recent" ? "◷" : "★"}</i><h3>Chưa có video</h3><p>${kind === "recent" && core().preferences().privacyShield ? "Chế độ riêng tư đang bật nên HH không ghi lịch sử xem." : "Video bạn lưu sẽ xuất hiện tại đây."}</p></div>`}</section>`;
  }

  function playlistsMarkup(state) {
    const items = core().playlists();
    const active = items.find((item) => item.id === state.activePlaylistId) || items[0];
    return `<section class="yh-playlists-view"><header><div><span>PLAYLIST VAULT</span><h2>Tổ chức video theo chủ đề</h2><p>Playlist được lưu cục bộ và không tự đồng bộ lên tài khoản YouTube.</p></div><form data-yh-playlist-form><input name="name" maxlength="80" placeholder="Tên playlist mới" required><button>Tạo playlist</button></form></header><div class="yh-playlist-layout"><nav>${items.map((item)=>`<button type="button" data-yh-playlist="${esc(item.id)}" class="${item.id===active?.id?"is-active":""}"><i>▤</i><span><strong>${esc(item.name)}</strong><small>${item.videos.length} video</small></span></button>`).join("") || '<p>Chưa có playlist.</p>'}</nav><main>${active ? `<header><h3>${esc(active.name)}</h3><span>${active.videos.length} video</span></header>${active.videos.length ? `<div class="yh-video-grid">${active.videos.map((video,index)=>videoCard(video,index)).join("")}</div>` : '<div class="yh-library-empty"><i>＋</i><h3>Playlist đang trống</h3><p>Dùng nút “+ Playlist” trên video để thêm.</p></div>'}` : '<div class="yh-library-empty"><i>▤</i><h3>Tạo playlist đầu tiên</h3><p>Đặt tên ở phía trên để bắt đầu.</p></div>'}</main></div></section>`;
  }

  function mainMarkup(state) {
    if (state.view === "home") return homeMarkup(state);
    if (state.view === "recent") return libraryMarkup(state, "recent", "Video đã xem", "Lịch sử chỉ được ghi khi bạn tắt chế độ riêng tư.");
    if (state.view === "saved") return libraryMarkup(state, "favorites", "Video đã lưu", "Danh sách xem lại riêng trên thiết bị này.");
    if (state.view === "playlists") return playlistsMarkup(state);
    return resultsMarkup(state);
  }

  function renderMain({ preserveScroll = false } = {}) {
    if (!session) return;
    const node = session.host.querySelector("[data-yh-main]");
    const scroll = preserveScroll ? node.scrollTop : 0;
    let playerSlot = node.querySelector("[data-yh-player-slot]");
    let content = node.querySelector("[data-yh-content]");
    if (!playerSlot || !content) {
      node.innerHTML = '<div data-yh-player-slot></div><div data-yh-content></div>';
      playerSlot = node.querySelector("[data-yh-player-slot]");
      content = node.querySelector("[data-yh-content]");
    }
    const currentId = session.state.current?.id || "";
    if (playerSlot.dataset.videoId !== currentId) {
      playerSlot.dataset.videoId = currentId;
      playerSlot.innerHTML = playerMarkup(session.state.current);
    }
    content.innerHTML = mainMarkup(session.state);
    node.scrollTop = scroll;
    session.host.querySelector("[data-youtube-hub]").dataset.view = session.state.view;
    session.host.querySelectorAll("[data-yh-view]").forEach((button)=>button.classList.toggle("is-active",button.dataset.yhView===session.state.view));
  }

  function renderQueue() {
    if (!session) return;
    const old = session.host.querySelector("[data-yh-queue]");
    if (!old) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = queueMarkup(session.state);
    old.replaceWith(wrap.firstElementChild);
    const badge = session.host.querySelector("[data-yh-queue-badge]");
    if (badge) badge.textContent = String(core().list("queue").length);
  }

  function setView(view) {
    if (!VIEWS.some((item)=>item[0]===view)) return;
    session.state.view = view;
    renderMain();
    closeDrawers();
  }

  function findVideo(id) {
    return [session.state.current, ...session.state.results, ...core().list("recent"), ...core().list("favorites"), ...core().list("queue"), ...core().playlists().flatMap((item)=>item.videos)].find((video)=>video?.id===id) || core().normalizeVideo({ id });
  }

  function playVideo(video, { render = true } = {}) {
    const safeVideo = core().normalizeVideo(video);
    if (!safeVideo) return;
    session.state.current = safeVideo;
    core().rememberVideo(safeVideo);
    if (session.state.view === "home") session.state.view = "results";
    if (render) renderMain();
    renderQueue();
    setTimeout(()=>playerCommand("setPlaybackRate",[core().preferences().playerRate]),600);
  }

  function playerCommand(func, args = []) {
    const frame = session?.host.querySelector("[data-yh-player-frame]");
    if (!frame?.contentWindow || !session.state.current) return;
    frame.contentWindow.postMessage(JSON.stringify({ event:"command", func, args }),"https://www.youtube-nocookie.com");
  }

  function playQueueStep(direction) {
    const items = core().list("queue");
    if (!items.length) return toast("Hàng đợi đang trống.","error");
    const current = items.findIndex((item)=>item.id===session.state.current?.id);
    let next = current < 0 ? 0 : current + direction;
    if (next >= items.length) next = core().preferences().loopQueue ? 0 : items.length - 1;
    if (next < 0) next = core().preferences().loopQueue ? items.length - 1 : 0;
    playVideo(items[next]);
  }

  function setBusy(busy, message = "") {
    session.state.busy = busy;
    session.host.querySelector("[data-youtube-hub]")?.classList.toggle("is-loading",busy);
    const submit = session.host.querySelector('[data-yh-search-form] button[type="submit"]');
    if (submit) { submit.disabled=busy; submit.textContent=busy?"Đang tìm…":"Tìm video"; }
    if (message) session.state.status = message;
    if (busy) renderSkeleton();
  }

  function renderSkeleton() {
    if (session.state.view !== "results") session.state.view = "results";
    renderMain();
    const node = session.host.querySelector("[data-yh-results]");
    if (!node) return;
    node.innerHTML = Array.from({length:8},()=>'<div class="yh-skeleton"><i></i><span><b></b><b></b><b></b></span></div>').join("");
  }

  async function runSearch(query = session.state.query, pageToken = "") {
    if (!session || session.state.busy) return;
    const value = core().cleanText(query,180);
    if (!value) return focus();
    session.state.query=value;
    const input=session.host.querySelector('[data-yh-search-form] input');if(input)input.value=value;
    setBusy(true,`Đang tìm “${value}”…`);
    try {
      const data=await core().searchYouTube(value,{...session.state.filters,pageToken});
      session.state.results=data.items||[];
      session.state.nextPageToken=data.nextPageToken||"";
      session.state.previousPageToken=data.previousPageToken||"";
      session.state.status=`${core().formatNumber(data.total)} video · ${session.state.results.length} video trên trang · ${data.region||session.state.filters.region}`;
      session.state.view="results";
      if(data.direct&&session.state.results[0])playVideo(session.state.results[0],{render:false});
      renderMain();
    } catch(error){renderError(error);}
    finally{setBusy(false);}
  }

  function renderError(error) {
    session.state.view="results";
    session.state.results=[];
    renderMain();
    const node=session.host.querySelector("[data-yh-results]");
    node.innerHTML=`<div class="yh-error"><span>!</span><div><h3>Chưa tải được video</h3><p>${esc(error?.message||"YouTube API chưa phản hồi.")}</p><div><button type="button" data-yh-retry>Thử lại</button><a href="https://www.youtube.com/results?search_query=${encodeURIComponent(session.state.query)}" target="_blank" rel="noopener">Mở YouTube ↗</a></div></div></div>`;
  }

  function toggleQueue(video) {
    const active=core().toggleVideo("queue",video);
    renderQueue();syncVideoButtons(video.id);toast(active?"Đã thêm vào hàng đợi.":"Đã bỏ khỏi hàng đợi.");
  }

  function toggleFavorite(video) {
    const active=core().toggleVideo("favorites",video);
    if(session.state.view==="saved"&&!active)renderMain({preserveScroll:true});else syncVideoButtons(video.id);
    renderSidebar();renderQueue();toast(active?"Đã lưu video.":"Đã bỏ video đã lưu.");
  }

  function syncVideoButtons(id) {
    const queued=core().isVideoIn("queue",id),favorite=core().isVideoIn("favorites",id);
    session.host.querySelectorAll(`[data-yh-queue-toggle="${CSS.escape(id)}"]`).forEach((button)=>{button.classList.toggle("is-active",queued);button.textContent=queued?"✓ Đã xếp":"＋ Hàng đợi";});
    session.host.querySelectorAll(`[data-yh-favorite="${CSS.escape(id)}"]`).forEach((button)=>{button.classList.toggle("is-active",favorite);button.textContent=favorite?"★ Đã lưu":"☆ Lưu";});
  }

  function syncAllVideoButtons(){const ids=new Set([...session.state.results,...core().list("favorites"),...core().list("queue")].map((video)=>video.id));ids.forEach(syncVideoButtons)}

  function addPlaylist(video) {
    let items=core().playlists();
    if(!items.length){const created=core().createPlaylist("Xem sau");if(created)items=[created];}
    const target=items.find((item)=>item.id===session.state.activePlaylistId)||items[0];
    if(target&&core().addToPlaylist(target.id,video)){session.state.activePlaylistId=target.id;toast(`Đã thêm vào “${target.name}”.`);if(session.state.view==="playlists")renderMain({preserveScroll:true});}
  }

  async function openPip() {
    const video=session?.state.current;if(!video)return;
    if(!scope.documentPictureInPicture?.requestWindow){session.host.querySelector("[data-youtube-hub]").classList.add("is-mini-player");return toast("Trình duyệt chưa hỗ trợ PiP nâng cao · đã mở mini-player.");}
    try{
      playerCommand("pauseVideo");
      const pip=await scope.documentPictureInPicture.requestWindow({width:520,height:390});
      session.pipWindow=pip;
      const style=pip.document.createElement("style");style.textContent="*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#05070c}iframe{width:100%;height:100%;border:0}";pip.document.head.append(style);
      const frame=pip.document.createElement("iframe"),url=new URL("youtube-pip.html",location.href);url.searchParams.set("v",video.id);url.searchParams.set("rate",String(core().preferences().playerRate));url.searchParams.set("title",video.title);frame.src=url.href;frame.allow="autoplay; encrypted-media; picture-in-picture";pip.document.body.append(frame);
      pip.addEventListener("pagehide",()=>{session.pipWindow=null;renderMain({preserveScroll:true});},{once:true});
    }catch{session.host.querySelector("[data-youtube-hub]").classList.add("is-mini-player");toast("Không mở được PiP · đã chuyển sang mini-player.","error");}
  }

  function shareCurrent() {
    const video=session.state.current;if(!video)return;const url=`https://youtu.be/${video.id}`;
    if(navigator.share)navigator.share({title:video.title,url}).catch(()=>{});else navigator.clipboard.writeText(url).then(()=>toast("Đã sao chép liên kết.")).catch(()=>toast("Không thể sao chép liên kết.","error"));
  }

  function toast(message,type="success") {
    const node=session?.host.querySelector("[data-yh-toast]");if(!node)return;node.textContent=message;node.dataset.type=type;node.hidden=false;clearTimeout(session.toastTimer);session.toastTimer=setTimeout(()=>{node.hidden=true;},2400);
  }

  function startVoice() {
    const Recognition=scope.SpeechRecognition||scope.webkitSpeechRecognition;if(!Recognition)return toast("Trình duyệt chưa hỗ trợ nhập giọng nói.","error");const recognition=new Recognition();recognition.lang="vi-VN";const button=session.host.querySelector("[data-yh-voice]");button.classList.add("is-listening");recognition.addEventListener("result",(event)=>{const query=event.results?.[0]?.[0]?.transcript||"";session.state.query=query;session.host.querySelector('[data-yh-search-form] input').value=query;runSearch(query);});recognition.addEventListener("end",()=>button.classList.remove("is-listening"));recognition.start();
  }

  function closeDrawers(){session?.host.querySelector("[data-youtube-hub]")?.classList.remove("is-sidebar-open","is-queue-open")}
  function focus(){session?.host.querySelector('[data-yh-search-form] input')?.focus({preventScroll:true})}

  function onClick(event) {
    const view=event.target.closest("[data-yh-view]");if(view){setView(view.dataset.yhView);return;}
    if(event.target.closest("[data-yh-focus-search]")){focus();return;}
    if(event.target.closest("[data-yh-voice]")){startVoice();return;}
    if(event.target.closest("[data-yh-sidebar-open]")){session.host.querySelector("[data-youtube-hub]").classList.add("is-sidebar-open");return;}
    if(event.target.closest("[data-yh-sidebar-close]")){session.host.querySelector("[data-youtube-hub]").classList.remove("is-sidebar-open");return;}
    if(event.target.closest("[data-yh-queue-open]")){session.host.querySelector("[data-youtube-hub]").classList.add("is-queue-open");return;}
    if(event.target.closest("[data-yh-queue-close]")){session.host.querySelector("[data-youtube-hub]").classList.remove("is-queue-open");return;}
    if(event.target.closest("[data-yh-filter-open]")){session.state.filtersOpen=true;session.host.querySelector("[data-yh-filters]").setAttribute("aria-hidden","false");session.host.querySelector("[data-youtube-hub]").classList.add("is-filters-open");return;}
    if(event.target.closest("[data-yh-filter-close]")){session.state.filtersOpen=false;session.host.querySelector("[data-yh-filters]").setAttribute("aria-hidden","true");session.host.querySelector("[data-youtube-hub]").classList.remove("is-filters-open");return;}
    if(event.target.closest("[data-yh-filter-reset]")){session.state.filters={order:"relevance",duration:"any",published:"any",caption:"any",event:"any",definition:"any",region:"VN",language:"vi",safe:"moderate"};const old=session.host.querySelector("[data-yh-filters]");const wrap=document.createElement("div");wrap.innerHTML=filtersMarkup(session.state);old.replaceWith(wrap.firstElementChild);return;}
    if(event.target.closest("[data-yh-filter-apply]")){session.state.filtersOpen=false;session.host.querySelector("[data-youtube-hub]").classList.remove("is-filters-open");if(session.state.query)runSearch();return;}
    if(event.target.closest("[data-yh-import-open]")){const dialog=session.host.querySelector("[data-yh-import-dialog]");dialog.setAttribute("aria-hidden","false");session.host.querySelector('[data-yh-import-form] input')?.focus();return;}
    if(event.target.closest("[data-yh-import-close]")){session.host.querySelector("[data-yh-import-dialog]").setAttribute("aria-hidden","true");return;}
    const play=event.target.closest("[data-yh-play]");if(play){playVideo(findVideo(play.dataset.yhPlay));return;}
    const queueToggle=event.target.closest("[data-yh-queue-toggle]");if(queueToggle){toggleQueue(findVideo(queueToggle.dataset.yhQueueToggle));return;}
    const favorite=event.target.closest("[data-yh-favorite]");if(favorite){toggleFavorite(findVideo(favorite.dataset.yhFavorite));return;}
    const playlistAdd=event.target.closest("[data-yh-playlist-add]");if(playlistAdd){addPlaylist(findVideo(playlistAdd.dataset.yhPlaylistAdd));return;}
    const playlist=event.target.closest("[data-yh-playlist]");if(playlist){session.state.activePlaylistId=playlist.dataset.yhPlaylist;session.state.view="playlists";renderMain();return;}
    const move=event.target.closest("[data-yh-queue-move]");if(move){const index=Number(move.closest("[data-yh-queue-index]").dataset.yhQueueIndex);core().reorderQueue(index,index+(move.dataset.yhQueueMove==="down"?1:-1));renderQueue();return;}
    const remove=event.target.closest("[data-yh-queue-remove]");if(remove){toggleQueue(findVideo(remove.dataset.yhQueueRemove));return;}
    if(event.target.closest("[data-yh-clear-queue]")){core().clear("queue");renderQueue();syncAllVideoButtons();return;}
    if(event.target.closest("[data-yh-queue-play]")){const first=core().list("queue")[0];if(first)playVideo(first);return;}
    if(event.target.closest("[data-yh-theatre]")){session.state.theatre=!session.state.theatre;session.host.querySelector("[data-youtube-hub]").classList.toggle("is-theatre",session.state.theatre);return;}
    if(event.target.closest("[data-yh-mini]")){session.host.querySelector("[data-youtube-hub]").classList.toggle("is-mini-player");return;}
    if(event.target.closest("[data-yh-pip]")){openPip();return;}
    if(event.target.closest("[data-yh-player-close]")){playerCommand("stopVideo");session.state.current=null;session.host.querySelector("[data-youtube-hub]").classList.remove("is-mini-player","is-theatre");renderMain({preserveScroll:true});renderQueue();return;}
    const command=event.target.closest("[data-yh-player-command]");if(command){const action=command.dataset.yhPlayerCommand;if(action==="previous")playQueueStep(-1);else if(action==="next")playQueueStep(1);else playerCommand(action==="play"?"playVideo":"pauseVideo");return;}
    if(event.target.closest("[data-yh-share]")){shareCurrent();return;}
    const page=event.target.closest("[data-yh-page]");if(page){runSearch(session.state.query,page.dataset.yhPage==="next"?session.state.nextPageToken:session.state.previousPageToken);return;}
    if(event.target.closest("[data-yh-retry]")){runSearch();}
  }

  function onSubmit(event) {
    if(event.target.matches("[data-yh-search-form]")){event.preventDefault();runSearch(new FormData(event.target).get("q"));return;}
    if(event.target.matches("[data-yh-playlist-form]")){event.preventDefault();const playlist=core().createPlaylist(new FormData(event.target).get("name"));if(playlist){session.state.activePlaylistId=playlist.id;renderMain();toast("Đã tạo playlist.");}return;}
    if(event.target.matches("[data-yh-import-form]")){event.preventDefault();const status=session.host.querySelector("[data-yh-import-status]"),value=new FormData(event.target).get("playlist");status.textContent="Đang đọc playlist công khai…";core().importPlaylist(value).then((result)=>{status.textContent=`Đã thêm ${result.added} video · ${result.total} trong hàng đợi.`;renderQueue();renderMain({preserveScroll:true});}).catch((error)=>{status.textContent=error.message;});}
  }

  function onChange(event) {
    const filter=event.target.closest("[data-yh-filter]");if(filter){session.state.filters[filter.dataset.yhFilter]=filter.value;return;}
    if(event.target.matches("[data-yh-privacy]")){core().updatePreferences({privacyShield:event.target.checked});renderSidebar();return;}
    if(event.target.matches("[data-yh-autoplay]")){core().updatePreferences({autoplayQueue:event.target.checked});return;}
    if(event.target.matches("[data-yh-loop]")){core().updatePreferences({loopQueue:event.target.checked});return;}
    if(event.target.matches("[data-yh-rate]")){const rate=Number(event.target.value)||1;core().updatePreferences({playerRate:rate});playerCommand("setPlaybackRate",[rate]);}
  }

  function renderSidebar(){const old=session.host.querySelector(".yh-sidebar"),wrap=document.createElement("div");wrap.innerHTML=sidebarMarkup(session.state);old.replaceWith(wrap.firstElementChild);}

  function onDragStart(event){const row=event.target.closest("[data-yh-queue-index]");if(!row)return;session.dragIndex=Number(row.dataset.yhQueueIndex);event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",String(session.dragIndex));row.classList.add("is-dragging")}
  function onDragOver(event){const row=event.target.closest("[data-yh-queue-index]");if(!row)return;event.preventDefault();event.dataTransfer.dropEffect="move"}
  function onDrop(event){const row=event.target.closest("[data-yh-queue-index]");if(!row)return;event.preventDefault();const from=Number(event.dataTransfer.getData("text/plain")),to=Number(row.dataset.yhQueueIndex);core().reorderQueue(from,to);renderQueue()}

  function onMessage(event){if(!/^(https:\/\/www\.)?youtube(?:-nocookie)?\.com$/.test(event.origin))return;const frame=session?.host?.querySelector?.("[data-yh-player-frame]");if(!frame||(event.source&&event.source!==frame.contentWindow))return;let message=event.data;try{if(typeof message==="string")message=JSON.parse(message);}catch{return;}if(message?.event==="onStateChange"&&Number(message.info)===0){if(core().preferences().autoplayQueue)playQueueStep(1);else if(core().preferences().loopQueue)playerCommand("playVideo");}}

  function mount(host) {
    if(!host||!core())return false;if(session?.host===host&&host.querySelector?.("[data-youtube-hub]"))return true;unmount();const pending=core().consumePending("youtube");const state={view:pending?.query?"results":"home",query:pending?.query||"",results:[],current:null,status:"",nextPageToken:"",previousPageToken:"",filtersOpen:false,theatre:false,activePlaylistId:"",busy:false,filters:{order:"relevance",duration:"any",published:"any",caption:"any",event:"any",definition:"any",region:"VN",language:"vi",safe:"moderate"}};host.innerHTML=shellMarkup(state);session={host,state,toastTimer:0,dragIndex:-1,onClick,onSubmit,onChange,onDragStart,onDragOver,onDrop,onMessage,onPending:(event)=>{if(event.detail?.provider!=="youtube")return;state.query=core().cleanText(event.detail.query,180);runSearch(state.query);}};renderMain();host.addEventListener("click",onClick);host.addEventListener("submit",onSubmit);host.addEventListener("change",onChange);host.addEventListener("dragstart",onDragStart);host.addEventListener("dragover",onDragOver);host.addEventListener("drop",onDrop);scope.addEventListener("message",onMessage);scope.addEventListener("hh:search-pending",session.onPending);if(state.query)requestAnimationFrame(()=>runSearch(state.query));return true;
  }

  function isMounted(host){return Boolean(session&&(!host||session.host===host)&&session.host.querySelector?.("[data-youtube-hub]"));}
  function ensureMounted(host){return isMounted(host)||mount(host);}

  function unmount(){if(!session)return;clearTimeout(session.toastTimer);if(session.pipWindow&&!session.pipWindow.closed)session.pipWindow.close();session.host.removeEventListener("click",session.onClick);session.host.removeEventListener("submit",session.onSubmit);session.host.removeEventListener("change",session.onChange);session.host.removeEventListener("dragstart",session.onDragStart);session.host.removeEventListener("dragover",session.onDragOver);session.host.removeEventListener("drop",session.onDrop);scope.removeEventListener("message",session.onMessage);scope.removeEventListener("hh:search-pending",session.onPending);session=null;}

  return Object.freeze({version:"1.1.0",mount,unmount,focus,runSearch,isMounted,ensureMounted});
});
