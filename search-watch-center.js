(() => {
  "use strict";

  const API_BASE = String(window.HH_REALTIME_URL || "").replace(/\/$/, "");
  const STORAGE = {
    recent: "hh.search-watch.youtube-recent",
    favorites: "hh.search-watch.youtube-favorites",
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
    currentVideo: null,
    lastQuery: { google: "", youtube: "" }
  };
  let root;

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
              <a href="https://music.youtube.com/" target="_blank" rel="noopener"><b>Y</b><span>YouTube Music</span><i>↗</i></a>
            </section>
            <section><small>LỊCH SỬ TÌM KIẾM</small><div class="swh-history" data-swh-history></div><button class="swh-clear" type="button" data-swh-clear-history>Xóa lịch sử</button></section>
            <section><small>WEB ĐÃ LƯU</small><div class="swh-history" data-web-saved></div></section>
            <section class="swh-privacy"><b>Khóa được bảo vệ</b><p>API key chỉ chạy trên Vercel. Lịch sử và mục đã lưu nằm trong thiết bị này.</p></section>
          </aside>
          <main class="swh-main">
            <section class="swh-panel active" data-swh-panel="google">
              <div class="swh-panel-heading"><div><small>GOOGLE DISCOVERY</small><h3>Tìm đúng thông tin, ngay trong HH</h3><p>Tra cứu web, tài liệu và hình ảnh qua Programmable Search API.</p></div><div class="swh-segment"><button class="active" type="button" data-google-kind="web">Trang web</button><button type="button" data-google-kind="images">Hình ảnh</button></div></div>
              <div class="swh-filterbar">
                <label>Thời gian<select data-google-date><option value="">Mọi thời gian</option><option value="d1">24 giờ</option><option value="d7">7 ngày</option><option value="m1">1 tháng</option><option value="y1">1 năm</option></select></label>
                <label>Tệp<select data-google-file><option value="">Tất cả</option><option value="pdf">PDF</option><option value="docx">Word</option><option value="xlsx">Excel</option><option value="pptx">PowerPoint</option></select></label>
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
              </div>
              <form class="swh-search-form swh-search-form--youtube" data-search-form="youtube"><span>▶</span><input type="search" name="q" autocomplete="off" placeholder="Tìm video hoặc dán link YouTube..." required><button class="swh-voice" type="button" data-voice="youtube" title="Tìm bằng giọng nói" aria-label="Tìm bằng giọng nói">◉</button><button class="swh-submit" type="submit">Tìm / Phát</button></form>
              <div class="swh-player-shell" data-youtube-player hidden>
                <div class="swh-player"><iframe title="YouTube player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
                <div class="swh-now-playing"><div><small>ĐANG PHÁT TRONG HH PLAYER</small><h4 data-player-title></h4><p data-player-channel></p></div><div><button type="button" data-player-share>Chia sẻ</button><button type="button" data-player-open>Mở YouTube</button><button type="button" data-player-favorite>Lưu video</button></div></div>
              </div>
              <div class="swh-library-row"><section><header><b>Xem gần đây</b><button type="button" data-clear-recent>Xóa</button></header><div data-youtube-recent></div></section><section><header><b>Đã lưu</b><span data-favorite-count>0 video</span></header><div data-youtube-favorites></div></section></div>
              <div class="swh-query-meta"><span data-youtube-meta>Dán liên kết để phát ngay hoặc tìm video bằng API.</span><div data-youtube-pager hidden><button type="button" data-youtube-page="prev">‹ Trước</button><button type="button" data-youtube-page="next">Sau ›</button></div></div>
              <div class="swh-results swh-video-results" data-results="youtube"><div class="swh-empty"><b>▶</b><h4>YouTube ngay trong HH</h4><p>Tìm video, xem thời lượng và lượt xem, phát ngay hoặc xây thư viện cá nhân.</p><div class="swh-empty-chips"><span>HD</span><span>Phụ đề</span><span>Thư viện</span></div></div></div>
            </section>
          </main>
        </div>
        <footer class="swh-footer"><span><i></i> HH secure server proxy</span><p>Google và YouTube là dịch vụ của Google LLC. HH sử dụng API và trình phát nhúng chính thức.</p><div><kbd>Alt G</kbd><kbd>Alt Y</kbd><kbd>Esc</kbd></div></footer>
      </div>`;
    document.body.appendChild(root);
    bindHub();
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
      params.set("safe", root.querySelector("[data-google-safe]").checked ? "active" : "off");
    } else {
      params.set("order", root.querySelector("[data-youtube-order]").value);
      params.set("duration", root.querySelector("[data-youtube-duration]").value);
      params.set("definition", root.querySelector("[data-youtube-definition]").value);
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
    title.textContent = error.code === "SEARCH_NOT_CONFIGURED" ? "API chưa được cấu hình trên Vercel" : "Chưa tải được kết quả";
    const copy = document.createElement("p");
    copy.textContent = error.code === "SEARCH_NOT_CONFIGURED"
      ? `${provider === "google" ? "Google Search cần GOOGLE_SEARCH_API_KEY và GOOGLE_SEARCH_ENGINE_ID" : "YouTube cần YOUTUBE_API_KEY"}. Khóa chỉ đặt ở Vercel, không nhập vào HTML.`
      : error.message;
    const actions = document.createElement("div");
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Thử lại";
    retry.addEventListener("click", () => runSearch(provider, query));
    const external = document.createElement("a");
    external.target = "_blank";
    external.rel = "noopener";
    external.href = provider === "google" ? `https://www.google.com/search?q=${encodeURIComponent(query)}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    external.textContent = `Mở ${provider === "google" ? "Google" : "YouTube"}`;
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
    const items = Array.isArray(data.items) ? data.items : [];
    state.youtubeNextToken = data.nextPageToken || "";
    state.youtubePreviousToken = data.previousPageToken || "";
    root.querySelector("[data-youtube-meta]").textContent = `${formatNumber(data.total)} video cho “${data.query}” · ${items.length} video trên trang này`;
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
    const save = createAction(isFavorite(video.id) ? "Đã lưu" : "Lưu", (event) => {
      event.stopPropagation();
      toggleFavorite(video);
      save.textContent = isFavorite(video.id) ? "Đã lưu" : "Lưu";
      save.classList.toggle("active", isFavorite(video.id));
    }, isFavorite(video.id));
    content.append(title, meta, badges, save);
    article.append(media, content);
    const playVideo = () => loadVideo(video);
    article.addEventListener("click", playVideo);
    article.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); playVideo(); }
    });
    return article;
  }

  function loadVideo(video) {
    state.currentVideo = video;
    const shell = root.querySelector("[data-youtube-player]");
    shell.querySelector("iframe").src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}?autoplay=1&playsinline=1&rel=0`;
    root.querySelector("[data-player-title]").textContent = video.title;
    root.querySelector("[data-player-channel]").textContent = [video.channel || "YouTube", video.views ? `${formatNumber(video.views)} lượt xem` : ""].filter(Boolean).join(" · ");
    shell.hidden = false;
    writeStore(STORAGE.recent, [video, ...readStore(STORAGE.recent).filter((item) => item.id !== video.id)].slice(0, 20));
    renderLibraries();
    updatePlayerFavorite();
    shell.scrollIntoView({ behavior: "smooth", block: "start" });
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
    const button = root.querySelector("[data-player-favorite]");
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
    root.querySelector("[data-player-favorite]").addEventListener("click", () => toggleFavorite(state.currentVideo));
    root.querySelector("[data-player-open]").addEventListener("click", () => {
      if (state.currentVideo?.id) window.open(`https://www.youtube.com/watch?v=${encodeURIComponent(state.currentVideo.id)}`, "_blank", "noopener");
    });
    root.querySelector("[data-player-share]").addEventListener("click", (event) => {
      if (!state.currentVideo?.id) return;
      const url = `https://youtu.be/${state.currentVideo.id}`;
      if (navigator.share) navigator.share({ title: state.currentVideo.title, url }).catch(() => {});
      else copyText(url, event.currentTarget);
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

  function init() {
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
