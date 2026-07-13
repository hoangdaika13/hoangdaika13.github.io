(() => {
  "use strict";

  const API_BASE = String(window.HH_REALTIME_URL || "").replace(/\/$/, "");
  const STORAGE = {
    recent: "hh.search-watch.youtube-recent",
    favorites: "hh.search-watch.youtube-favorites",
    searches: "hh.search-watch.history"
  };
  const state = { tab: "google", googleKind: "web", googlePage: 1, currentVideo: null, busy: false };
  let root;

  function readStore(key, fallback = []) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return Array.isArray(value) ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage can be disabled. */ }
  }

  function rememberSearch(provider, query) {
    const item = { provider, query, at: new Date().toISOString() };
    const next = [item, ...readStore(STORAGE.searches).filter((entry) => !(entry.provider === provider && entry.query === query))].slice(0, 12);
    writeStore(STORAGE.searches, next);
    renderSearchHistory();
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("vi-VN", { notation: Number(value) > 999999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(Number(value) || 0);
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
    } catch { /* It is a search query, not a URL. */ }
    return "";
  }

  function makeVideoFromId(id) {
    return { id, title: `Video YouTube ${id}`, channel: "YouTube", description: "Mở từ đường dẫn hoặc mã video.", thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, publishedAt: "" };
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
          <div class="swh-header-actions"><span class="swh-connection"><i></i> Dịch vụ trực tuyến</span><button class="swh-icon-button" type="button" data-swh-close aria-label="Đóng trung tâm tìm kiếm" title="Đóng">×</button></div>
        </header>
        <nav class="swh-tabs" aria-label="Chọn dịch vụ">
          <button class="active" type="button" data-swh-tab="google"><b>G</b><span>Google Search<small>Tìm web và hình ảnh</small></span></button>
          <button type="button" data-swh-tab="youtube"><b>▶</b><span>YouTube<small>Tìm và xem video</small></span></button>
        </nav>
        <div class="swh-body">
          <aside class="swh-sidebar">
            <section><small>TRUY CẬP NHANH</small>
              <a href="https://news.google.com/topstories?hl=vi&gl=VN&ceid=VN:vi" target="_blank" rel="noopener"><b>N</b><span>Google News</span></a>
              <a href="https://images.google.com/" target="_blank" rel="noopener"><b>I</b><span>Google Images</span></a>
              <a href="https://maps.google.com/" target="_blank" rel="noopener"><b>M</b><span>Google Maps</span></a>
              <a href="https://music.youtube.com/" target="_blank" rel="noopener"><b>Y</b><span>YouTube Music</span></a>
            </section>
            <section><small>LỊCH SỬ TÌM KIẾM</small><div class="swh-history" data-swh-history></div><button class="swh-clear" type="button" data-swh-clear-history>Xóa lịch sử</button></section>
            <section class="swh-privacy"><b>Riêng tư theo thiết kế</b><p>Khóa API nằm trên Vercel. Lịch sử chỉ lưu trong trình duyệt này.</p></section>
          </aside>
          <main class="swh-main">
            <section class="swh-panel active" data-swh-panel="google">
              <div class="swh-panel-heading"><div><small>GOOGLE DISCOVERY</small><h3>Tìm thông tin mà không rời HH</h3></div><div class="swh-segment"><button class="active" type="button" data-google-kind="web">Trang web</button><button type="button" data-google-kind="images">Hình ảnh</button></div></div>
              <form class="swh-search-form" data-search-form="google"><span>G</span><input type="search" name="q" autocomplete="off" placeholder="Tìm website, tài liệu, tin tức..." required><button type="submit">Tìm kiếm</button></form>
              <div class="swh-query-meta"><span data-google-meta>Nhập từ khóa để bắt đầu tìm kiếm.</span><div data-google-pager hidden><button type="button" data-google-page="prev">‹ Trước</button><button type="button" data-google-page="next">Sau ›</button></div></div>
              <div class="swh-results" data-results="google"><div class="swh-empty"><b>G</b><h4>Google Search trong HH Platform</h4><p>Kết quả được trình bày gọn, dễ đọc và mở trang gốc bằng một lần bấm.</p></div></div>
            </section>
            <section class="swh-panel" data-swh-panel="youtube">
              <div class="swh-panel-heading"><div><small>YOUTUBE PLAYER</small><h3>Tìm, xem và lưu video ngay trong website</h3></div><div class="swh-youtube-filters"><select data-youtube-order aria-label="Sắp xếp"><option value="relevance">Phù hợp nhất</option><option value="date">Mới nhất</option><option value="viewCount">Nhiều lượt xem</option><option value="rating">Đánh giá cao</option></select><select data-youtube-duration aria-label="Thời lượng"><option value="any">Mọi thời lượng</option><option value="short">Dưới 4 phút</option><option value="medium">4-20 phút</option><option value="long">Trên 20 phút</option></select></div></div>
              <form class="swh-search-form swh-search-form--youtube" data-search-form="youtube"><span>▶</span><input type="search" name="q" autocomplete="off" placeholder="Tìm video hoặc dán link YouTube..." required><button type="submit">Tìm / Phát</button></form>
              <div class="swh-player-shell" data-youtube-player hidden>
                <div class="swh-player"><iframe title="YouTube player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
                <div class="swh-now-playing"><div><small>ĐANG PHÁT</small><h4 data-player-title></h4><p data-player-channel></p></div><button type="button" data-player-favorite>Lưu video</button></div>
              </div>
              <div class="swh-library-row"><section><header><b>Xem gần đây</b><button type="button" data-clear-recent>Xóa</button></header><div data-youtube-recent></div></section><section><header><b>Đã lưu</b><span data-favorite-count>0 video</span></header><div data-youtube-favorites></div></section></div>
              <div class="swh-results swh-video-results" data-results="youtube"><div class="swh-empty"><b>▶</b><h4>Sẵn sàng phát YouTube</h4><p>Dán link video để xem ngay hoặc tìm theo từ khóa khi API đã được kết nối.</p></div></div>
            </section>
          </main>
        </div>
        <footer class="swh-footer"><span><i></i> HH secure proxy</span><p>Google và YouTube là dịch vụ của Google LLC. HH chỉ sử dụng API và trình phát nhúng chính thức.</p><kbd>ESC</kbd></footer>
      </div>`;
    document.body.appendChild(root);
    bindHub();
    renderSearchHistory();
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
    const input = root.querySelector(`[data-search-form="${state.tab}"] input`);
    if (query && input) {
      input.value = query;
      runSearch(state.tab, query);
    }
  }

  function closeHub() {
    if (!root) return;
    root.classList.remove("open");
    root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("search-watch-open");
  }

  function setLoading(provider, loading, message = "") {
    state.busy = loading;
    const panel = root.querySelector(`[data-swh-panel="${provider}"]`);
    panel?.classList.toggle("loading", loading);
    const button = panel?.querySelector("[data-search-form] button[type=submit]");
    if (button) {
      button.disabled = loading;
      button.textContent = loading ? "Đang tìm..." : provider === "youtube" ? "Tìm / Phát" : "Tìm kiếm";
    }
    if (provider === "google" && message) root.querySelector("[data-google-meta]").textContent = message;
  }

  async function fetchSearch(provider, query) {
    if (!API_BASE) throw new Error("Máy chủ tìm kiếm chưa được khai báo.");
    const params = new URLSearchParams({ q: query });
    if (provider === "google") {
      params.set("kind", state.googleKind);
      params.set("page", String(state.googlePage));
    } else {
      params.set("order", root.querySelector("[data-youtube-order]").value);
      params.set("duration", root.querySelector("[data-youtube-duration]").value);
    }
    const response = await fetch(`${API_BASE}/api/search/${provider}?${params}`, { headers: { Accept: "application/json" }, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || "Không thể tải kết quả tìm kiếm.");
      error.code = data.code || "";
      error.required = data.required || [];
      throw error;
    }
    return data;
  }

  async function runSearch(provider, rawQuery) {
    const query = String(rawQuery || "").trim().slice(0, 180);
    if (!query || state.busy) return;
    if (provider === "youtube") {
      const videoId = parseYouTubeId(query);
      if (videoId) {
        const video = makeVideoFromId(videoId);
        rememberSearch(provider, query);
        loadVideo(video);
        return;
      }
    }
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
    const card = document.createElement("div");
    card.className = "swh-service-error";
    const title = document.createElement("h4");
    title.textContent = error.code === "SEARCH_NOT_CONFIGURED" ? "Cần kết nối API một lần" : "Chưa tải được kết quả";
    const copy = document.createElement("p");
    copy.textContent = error.code === "SEARCH_NOT_CONFIGURED"
      ? `${provider === "google" ? "Google Search" : "YouTube Search"} cần khóa API chính thức trên Vercel. Phần xem video bằng link vẫn dùng được ngay.`
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
    if (provider === "google") root.querySelector("[data-google-meta]").textContent = "Máy chủ cần được cấu hình để hiển thị kết quả tại đây.";
  }

  function renderGoogle(data) {
    const results = root.querySelector('[data-results="google"]');
    results.replaceChildren();
    const items = Array.isArray(data.items) ? data.items : [];
    root.querySelector("[data-google-meta]").textContent = `${formatNumber(data.total)} kết quả cho “${data.query}” · Trang ${data.page}`;
    root.querySelector("[data-google-pager]").hidden = !items.length;
    results.classList.toggle("swh-image-grid", data.kind === "images");
    if (!items.length) return renderEmpty(results, "Không tìm thấy kết quả phù hợp", "Hãy thử một cụm từ ngắn hoặc cách viết khác.", "G");
    items.forEach((item) => {
      const article = document.createElement("article");
      article.className = data.kind === "images" ? "swh-image-result" : "swh-google-result";
      if (item.image) {
        const image = document.createElement("img");
        image.src = item.image;
        image.alt = "";
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
      content.append(site, title, snippet);
      article.append(content);
      results.append(article);
    });
  }

  function renderYouTube(data) {
    const results = root.querySelector('[data-results="youtube"]');
    results.replaceChildren();
    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) return renderEmpty(results, "Không tìm thấy video", "Hãy thử chủ đề hoặc từ khóa khác.", "▶");
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
    image.alt = "";
    image.loading = "lazy";
    const play = document.createElement("span");
    play.textContent = "▶";
    media.append(image, play);
    const content = document.createElement("div");
    const title = document.createElement("h4");
    title.textContent = video.title;
    const meta = document.createElement("p");
    meta.textContent = [video.channel, formatDate(video.publishedAt)].filter(Boolean).join(" · ");
    const description = document.createElement("small");
    description.textContent = video.description || "Phát video trong HH Player.";
    const save = document.createElement("button");
    save.type = "button";
    save.textContent = isFavorite(video.id) ? "Đã lưu" : "Lưu";
    save.addEventListener("click", (event) => { event.stopPropagation(); toggleFavorite(video); save.textContent = isFavorite(video.id) ? "Đã lưu" : "Lưu"; });
    content.append(title, meta, description, save);
    article.append(media, content);
    const playVideo = () => loadVideo(video);
    article.addEventListener("click", playVideo);
    article.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); playVideo(); } });
    return article;
  }

  function loadVideo(video) {
    state.currentVideo = video;
    const shell = root.querySelector("[data-youtube-player]");
    const iframe = shell.querySelector("iframe");
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}?autoplay=1&playsinline=1&rel=0`;
    root.querySelector("[data-player-title]").textContent = video.title;
    root.querySelector("[data-player-channel]").textContent = video.channel || "YouTube";
    shell.hidden = false;
    const recent = [video, ...readStore(STORAGE.recent).filter((item) => item.id !== video.id)].slice(0, 20);
    writeStore(STORAGE.recent, recent);
    renderLibraries();
    updatePlayerFavorite();
    shell.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
    button.classList.toggle("saved", isFavorite(state.currentVideo.id));
    button.textContent = isFavorite(state.currentVideo.id) ? "Đã lưu" : "Lưu video";
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
    items.slice(0, 5).forEach((video) => {
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
    if (!items.length) {
      const empty = document.createElement("p");
      empty.textContent = "Chưa có lượt tìm kiếm";
      container.append(empty);
      return;
    }
    items.slice(0, 7).forEach((item) => {
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

  function bindHub() {
    root.querySelectorAll("[data-swh-close]").forEach((button) => button.addEventListener("click", closeHub));
    root.querySelectorAll("[data-swh-tab]").forEach((button) => button.addEventListener("click", () => setTab(button.dataset.swhTab)));
    root.querySelectorAll("[data-search-form]").forEach((form) => form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (form.dataset.searchForm === "google") state.googlePage = 1;
      runSearch(form.dataset.searchForm, new FormData(form).get("q"));
    }));
    root.querySelectorAll("[data-google-kind]").forEach((button) => button.addEventListener("click", () => {
      state.googleKind = button.dataset.googleKind;
      state.googlePage = 1;
      root.querySelectorAll("[data-google-kind]").forEach((item) => item.classList.toggle("active", item === button));
      const query = root.querySelector('[data-search-form="google"] input').value;
      if (query) runSearch("google", query);
    }));
    root.querySelectorAll("[data-google-page]").forEach((button) => button.addEventListener("click", () => {
      state.googlePage = button.dataset.googlePage === "next" ? Math.min(10, state.googlePage + 1) : Math.max(1, state.googlePage - 1);
      runSearch("google", root.querySelector('[data-search-form="google"] input').value);
    }));
    root.querySelector("[data-player-favorite]").addEventListener("click", () => toggleFavorite(state.currentVideo));
    root.querySelector("[data-clear-recent]").addEventListener("click", () => { writeStore(STORAGE.recent, []); renderLibraries(); });
    root.querySelector("[data-swh-clear-history]").addEventListener("click", () => { writeStore(STORAGE.searches, []); renderSearchHistory(); });
  }

  function wireLaunchers() {
    const liveForm = document.getElementById("googleLiveSearch");
    const liveInput = document.getElementById("googleLiveQuery");
    if (liveForm) {
      liveForm.addEventListener("submit", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        openHub("google", liveInput?.value || "");
      }, true);
      const launcher = document.createElement("button");
      launcher.className = "button ghost interactive swh-inline-launcher";
      launcher.type = "button";
      launcher.textContent = "Google + YouTube";
      launcher.addEventListener("click", () => openHub("google", liveInput?.value || ""));
      liveForm.append(launcher);
    }
    document.querySelectorAll("[data-open-search-hub]").forEach((button) => button.addEventListener("click", () => openHub(button.dataset.openSearchHub || "google")));
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
    window.HHSearchWatch = { open: openHub, close: closeHub, play: (value) => { const id = parseYouTubeId(value); openHub("youtube"); if (id) loadVideo(makeVideoFromId(id)); } };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
