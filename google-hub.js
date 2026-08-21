(function initHHGoogleHub(scope, factory) {
  const api = factory(scope);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (scope) scope.HHGoogleHub = api;
})(typeof window !== "undefined" ? window : globalThis, function createHHGoogleHub(scope) {
  "use strict";

  let session = null;
  const MODES = Object.freeze([
    { id: "home", icon: "⌂", label: "Khám phá", copy: "Lịch sử, trang đã lưu và dịch vụ thường dùng" },
    { id: "web", icon: "G", label: "Trang web", copy: "Kết quả web tổng hợp" },
    { id: "images", icon: "▧", label: "Hình ảnh", copy: "Thư viện hình ảnh trực quan" },
    { id: "news", icon: "N", label: "Tin tức", copy: "Nội dung mới trong bảy ngày" },
    { id: "academic", icon: "A", label: "Học thuật", copy: "PDF, tài liệu và Google Scholar" },
    { id: "translate", icon: "文", label: "Dịch", copy: "Mở nhanh Google Dịch" }
  ]);
  const SERVICES = Object.freeze([
    ["N", "Google News", "https://news.google.com/topstories?hl=vi&gl=VN&ceid=VN:vi", "Tin mới"],
    ["I", "Google Images", "https://images.google.com/", "Hình ảnh"],
    ["M", "Google Maps", "https://maps.google.com/", "Bản đồ"],
    ["文", "Google Dịch", "https://translate.google.com/", "Dịch thuật"],
    ["S", "Google Scholar", "https://scholar.google.com/", "Học thuật"],
    ["@", "Gmail", "https://mail.google.com/", "Email"],
    ["D", "Google Drive", "https://drive.google.com/", "Tệp"],
    ["C", "Google Calendar", "https://calendar.google.com/", "Lịch"],
    ["K", "Google Keep", "https://keep.google.com/", "Ghi chú"]
  ]);

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const core = () => scope.HHSearchPlatform;

  function modeMeta(id) { return MODES.find((item) => item.id === id) || MODES[1]; }

  function navigationMarkup(active) {
    return `<nav class="gh-navigation" aria-label="Không gian Google">${MODES.map((item) => `<button type="button" data-gh-mode="${item.id}" class="${active === item.id ? "is-active" : ""}"><i>${item.icon}</i><span><strong>${item.label}</strong><small>${item.copy}</small></span></button>`).join("")}</nav>`;
  }

  function serviceMarkup() {
    return `<div class="gh-service-grid">${SERVICES.map(([icon, name, url, label], index) => `<a href="${url}" target="_blank" rel="noopener" style="--service-index:${index}"><i>${icon}</i><span><strong>${name}</strong><small>${label}</small></span><b>↗</b></a>`).join("")}</div>`;
  }

  function recentMarkup(items) {
    if (!items.length) return '<div class="gh-empty-small"><i>⌕</i><p>Chưa có lượt tìm kiếm Google trên thiết bị này.</p></div>';
    return `<div class="gh-recent-list">${items.slice(0, 8).map((item) => `<button type="button" data-gh-query="${esc(item.query)}"><i>↗</i><span><strong>${esc(item.query)}</strong><small>${new Date(item.at).toLocaleString("vi-VN")}</small></span></button>`).join("")}</div>`;
  }

  function savedMarkup(items) {
    if (!items.length) return '<div class="gh-empty-small"><i>☆</i><p>Chưa lưu website. Nút “Lưu” sẽ xuất hiện trong từng kết quả.</p></div>';
    return `<div class="gh-saved-list">${items.slice(0, 8).map((item) => `<article><img src="${esc(core().faviconFor(item.url))}" alt=""><a href="${esc(item.url)}" target="_blank" rel="noopener"><strong>${esc(item.title)}</strong><small>${esc(item.displayUrl || item.url)}</small></a><button type="button" data-gh-unsave="${esc(item.url)}" title="Bỏ lưu">×</button></article>`).join("")}</div>`;
  }

  function homeMarkup() {
    const searches = core().list("searches").filter((item) => item.provider === "google");
    const saved = core().list("webSaved");
    return `<section class="gh-home" data-gh-home>
      <header><div><span>GOOGLE DISCOVERY GALAXY</span><h2>Mọi lối tìm kiếm trong một cockpit.</h2><p>Tìm nhanh trên web, chuyển sang hình ảnh, tài liệu hoặc dịch vụ Google mà không rời cấu trúc HH Platform.</p></div><div class="gh-orbit-mark" aria-hidden="true"><i></i><i></i><i></i><i></i><b>G</b></div></header>
      <section class="gh-home-section"><div class="gh-section-title"><span>DỊCH VỤ</span><h3>Mở công cụ thường dùng</h3></div>${serviceMarkup()}</section>
      <div class="gh-home-columns"><section><div class="gh-section-title"><span>GẦN ĐÂY</span><h3>Tìm kiếm trên thiết bị</h3></div>${recentMarkup(searches)}</section><section><div class="gh-section-title"><span>ĐÃ LƯU</span><h3>Website quan trọng</h3></div>${savedMarkup(saved)}</section></div>
    </section>`;
  }

  function inspectorMarkup() {
    const searches = core().list("searches").filter((item) => item.provider === "google").slice(0, 6);
    const saved = core().list("webSaved").slice(0, 6);
    return `<header><div><span>THÔNG TIN</span><h3>Ngữ cảnh Google</h3></div><button type="button" data-gh-inspector-close aria-label="Đóng thông tin">×</button></header>
      <section><small>TRẠNG THÁI</small><div class="gh-health" data-gh-health><i></i><span><strong>Đang kiểm tra</strong><small>Search API và Google Free</small></span></div></section>
      <section><small>TÌM GẦN ĐÂY</small>${recentMarkup(searches)}</section>
      <section><small>TRANG ĐÃ LƯU · ${saved.length}</small>${savedMarkup(saved)}</section>
      <footer><button type="button" data-gh-clear-history>Xóa lịch sử Google</button><p>Lịch sử và trang đã lưu chỉ nằm trên thiết bị này.</p></footer>`;
  }

  function shellMarkup(state) {
    return `<section class="google-hub" data-google-hub data-mode="${state.mode}">
      <div class="gh-ambient" aria-hidden="true"><i></i><i></i><i></i><i></i><b></b></div>
      <header class="gh-topbar">
        <button class="gh-brand" type="button" data-gh-mode="home"><span>G</span><div><small>HH SEARCH UNIVERSE</small><strong>Google Center</strong></div></button>
        <form class="gh-search" data-gh-search-form><span>⌕</span><input type="search" name="q" value="${esc(state.query)}" placeholder="Tìm website, hình ảnh, tin tức hoặc tài liệu…" autocomplete="off" required><button type="button" data-gh-voice aria-label="Tìm bằng giọng nói">◉</button><button type="submit">Tìm kiếm</button></form>
        <div class="gh-top-actions"><button type="button" data-gh-inspector-open aria-label="Mở thông tin">ⓘ</button><a href="https://www.google.com/" target="_blank" rel="noopener">Google ↗</a></div>
      </header>
      <div class="gh-grid">
        <aside class="gh-sidebar"><div><span>KHÔNG GIAN</span><button type="button" data-gh-sidebar-close aria-label="Đóng danh mục">×</button></div>${navigationMarkup(state.mode)}<footer><i></i><span><strong>SafeSearch</strong><small>Đang ${core().preferences().googleSafe ? "bật" : "tắt"}</small></span><button type="button" data-gh-safe aria-pressed="${core().preferences().googleSafe}">${core().preferences().googleSafe ? "Bật" : "Tắt"}</button></footer></aside>
        <main class="gh-main"><div class="gh-mobile-context"><button type="button" data-gh-sidebar-open>☰ Danh mục</button><span>${modeMeta(state.mode).label}</span><button type="button" data-gh-inspector-open>ⓘ</button></div><div class="gh-main-scroll" data-gh-main-scroll>${state.mode === "home" ? homeMarkup() : resultWorkspaceMarkup(state)}</div></main>
        <aside class="gh-inspector" aria-hidden="true" data-gh-inspector>${inspectorMarkup()}</aside>
      </div>
      <div class="gh-toast" role="status" aria-live="polite" data-gh-toast hidden></div>
    </section>`;
  }

  function resultWorkspaceMarkup(state) {
    const mode = modeMeta(state.mode);
    const isImage = state.mode === "images";
    return `<section class="gh-results-workspace">
      <header class="gh-result-head"><div><span>${esc(mode.label.toUpperCase())}</span><h2>${isImage ? "Khám phá bằng hình ảnh" : state.mode === "news" ? "Tin mới theo chủ đề" : state.mode === "academic" ? "Tài liệu và nguồn học thuật" : state.mode === "translate" ? "Dịch nhanh nội dung" : "Kết quả tìm kiếm"}</h2><p data-gh-meta>${state.status || "Nhập nội dung phía trên để bắt đầu."}</p></div><button type="button" data-gh-filter-toggle>Bộ lọc <b>${state.filtersOpen ? "−" : "+"}</b></button></header>
      <section class="gh-filterbar ${state.filtersOpen ? "is-open" : ""}" data-gh-filterbar>
        <label>Thời gian<select data-gh-filter="date"><option value="">Mọi thời gian</option><option value="d1">24 giờ</option><option value="d7">7 ngày</option><option value="m1">1 tháng</option><option value="y1">1 năm</option></select></label>
        <label>Loại tệp<select data-gh-filter="file"><option value="">Tất cả</option><option value="pdf">PDF</option><option value="docx">Word</option><option value="xlsx">Excel</option><option value="pptx">PowerPoint</option></select></label>
        <label>Website<input type="text" data-gh-filter="site" placeholder="example.com"></label>
        <button type="button" data-gh-reset-filter>Đặt lại</button>
      </section>
      ${state.mode === "translate" ? translateMarkup(state.query) : `<div class="gh-results ${isImage ? "is-images" : ""}" data-gh-results>${emptyResultMarkup(state.mode)}</div><footer class="gh-pager" data-gh-pager hidden><button type="button" data-gh-page="prev">‹ Trang trước</button><span>Trang <b data-gh-page-label>${state.page}</b></span><button type="button" data-gh-page="next">Trang sau ›</button></footer>`}
    </section>`;
  }

  function translateMarkup(query) {
    const url = `https://translate.google.com/?sl=auto&tl=vi&text=${encodeURIComponent(query || "")}&op=translate`;
    return `<section class="gh-translate"><div class="gh-translate-orb"><span>文</span><i></i><i></i></div><div><small>GOOGLE TRANSLATE</small><h3>Dịch văn bản bằng dịch vụ chính thức</h3><p>HH không tự nhận là dịch vụ Google. Nội dung sẽ chỉ được gửi khi bạn chủ động mở Google Dịch.</p><textarea data-gh-translate-text placeholder="Nhập nội dung cần dịch…">${esc(query)}</textarea><a data-gh-translate-link href="${url}" target="_blank" rel="noopener">Mở Google Dịch ↗</a></div></section>`;
  }

  function emptyResultMarkup(mode) {
    const isImage = mode === "images";
    return `<div class="gh-empty"><div><i></i><i></i><i></i><i></i><b>${isImage ? "▧" : "G"}</b></div><h3>${isImage ? "Image Gallery đang chờ" : "Sẵn sàng tìm kiếm"}</h3><p>${isImage ? "Nhập chủ đề để dựng thư viện hình ảnh có nguồn." : "Kết quả sẽ có favicon, mô tả, nguồn và hành động lưu riêng."}</p></div>`;
  }

  function toast(message, type = "success") {
    if (!session?.host) return;
    const node = session.host.querySelector("[data-gh-toast]");
    node.textContent = message;
    node.dataset.type = type;
    node.hidden = false;
    clearTimeout(session.toastTimer);
    session.toastTimer = setTimeout(() => { node.hidden = true; }, 2400);
  }

  function setBusy(busy, message = "") {
    if (!session) return;
    session.state.busy = busy;
    const hub = session.host.querySelector("[data-google-hub]");
    hub?.classList.toggle("is-loading", busy);
    const submit = session.host.querySelector("[data-gh-search-form] button[type=submit]");
    if (submit) { submit.disabled = busy; submit.textContent = busy ? "Đang tìm…" : "Tìm kiếm"; }
    const meta = session.host.querySelector("[data-gh-meta]");
    if (meta && message) meta.textContent = message;
    if (busy) renderSkeleton();
  }

  function renderSkeleton() {
    const results = session?.host.querySelector("[data-gh-results]");
    if (!results) return;
    results.replaceChildren();
    results.classList.toggle("is-images", session.state.mode === "images");
    for (let index = 0; index < (session.state.mode === "images" ? 8 : 5); index += 1) {
      const node = document.createElement("div");
      node.className = session.state.mode === "images" ? "gh-skeleton gh-skeleton--image" : "gh-skeleton";
      node.innerHTML = "<i></i><span><b></b><b></b><b></b></span>";
      results.append(node);
    }
  }

  function renderResultItems(data) {
    const results = session.host.querySelector("[data-gh-results]");
    if (!results) return;
    const items = Array.isArray(data.items) ? data.items : [];
    results.replaceChildren();
    results.classList.toggle("is-images", data.kind === "images");
    const meta = session.host.querySelector("[data-gh-meta]");
    if (meta) meta.textContent = `${core().formatNumber(data.total)} kết quả cho “${data.query}” · Trang ${data.page || session.state.page}${data.searchTime ? ` · ${Number(data.searchTime).toFixed(2)} giây` : ""}`;
    const pager = session.host.querySelector("[data-gh-pager]");
    if (pager) {
      pager.hidden = !items.length;
      pager.querySelector('[data-gh-page="prev"]').disabled = !data.hasPrevious;
      pager.querySelector('[data-gh-page="next"]').disabled = !data.hasNext;
      pager.querySelector("[data-gh-page-label]").textContent = String(data.page || session.state.page);
    }
    if (!items.length) {
      results.innerHTML = '<div class="gh-empty"><div><b>?</b></div><h3>Không tìm thấy kết quả</h3><p>Hãy thử cụm từ ngắn hơn hoặc đặt lại bộ lọc.</p></div>';
      return;
    }
    items.forEach((item, index) => results.append(data.kind === "images" ? imageCard(item, index) : webCard(item, index)));
  }

  function webCard(item, index) {
    const article = document.createElement("article");
    article.className = "gh-web-result";
    article.style.setProperty("--result-index", index);
    const saved = core().list("webSaved").some((entry) => entry.url === item.url);
    article.innerHTML = `<header><img src="${esc(core().faviconFor(item.url))}" alt=""><span><strong>${esc(item.displayUrl || "Website")}</strong><small>${esc(item.url)}</small></span></header><a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.title || item.url)}</a><p>${esc(item.snippet || "Mở kết quả để xem nội dung đầy đủ.")}</p><footer><button type="button" data-gh-save-result class="${saved ? "is-active" : ""}">${saved ? "★ Đã lưu" : "☆ Lưu"}</button><button type="button" data-gh-copy-url>Sao chép</button><a href="${esc(item.url)}" target="_blank" rel="noopener">Mở trang ↗</a></footer>`;
    article.querySelector("[data-gh-save-result]").addEventListener("click", (event) => {
      const active = core().toggleWebSaved(item);
      event.currentTarget.classList.toggle("is-active", active);
      event.currentTarget.textContent = active ? "★ Đã lưu" : "☆ Lưu";
      renderInspector();
      toast(active ? "Đã lưu website." : "Đã bỏ website khỏi danh sách.");
    });
    article.querySelector("[data-gh-copy-url]").addEventListener("click", (event) => copyUrl(item.url, event.currentTarget));
    return article;
  }

  function imageCard(item, index) {
    const article = document.createElement("article");
    article.className = "gh-image-result";
    article.style.setProperty("--result-index", index);
    article.innerHTML = `<a href="${esc(item.originalImage || item.url)}" target="_blank" rel="noopener"><img src="${esc(item.image || item.originalImage)}" alt="${esc(item.title || "Kết quả hình ảnh")}" loading="lazy"><span>↗</span></a><div><strong>${esc(item.title || "Hình ảnh")}</strong><small>${esc(item.displayUrl || "Nguồn ảnh")}${item.width ? ` · ${item.width}×${item.height}` : ""}</small><button type="button" data-gh-save-result>☆ Lưu nguồn</button></div>`;
    article.querySelector("[data-gh-save-result]").addEventListener("click", (event) => {
      const active = core().toggleWebSaved(item);
      event.currentTarget.textContent = active ? "★ Đã lưu" : "☆ Lưu nguồn";
      event.currentTarget.classList.toggle("is-active", active);
      renderInspector();
    });
    return article;
  }

  async function copyUrl(value, button) {
    try { await navigator.clipboard.writeText(value); button.textContent = "Đã chép"; setTimeout(() => { button.textContent = "Sao chép"; }, 1200); }
    catch { toast("Trình duyệt chưa cho phép sao chép.", "error"); }
  }

  function filtersForMode() {
    const state = session.state;
    const filters = { ...state.filters, page: state.page, safe: core().preferences().googleSafe, kind: state.mode === "images" ? "images" : "web" };
    if (state.mode === "news" && !filters.date) filters.date = "d7";
    if (state.mode === "academic" && !filters.file) filters.file = "pdf";
    return filters;
  }

  async function runSearch(query = session.state.query) {
    if (!session || session.state.busy) return;
    const value = core().cleanText(query, 180);
    if (!value) return focus();
    session.state.query = value;
    const input = session.host.querySelector('[data-gh-search-form] input');
    if (input) input.value = value;
    if (session.state.mode === "home") setMode("web", false, false);
    if (session.state.mode === "translate") {
      const main = session.host.querySelector("[data-gh-main-scroll]");
      main.innerHTML = resultWorkspaceMarkup(session.state);
      bindDynamicValues();
      return;
    }
    setBusy(true, `Đang tìm “${value}”…`);
    try {
      const data = await core().searchGoogle(value, filtersForMode());
      if (data.fallback && data.source === "programmable-search-element") {
        const results = session.host.querySelector("[data-gh-results]");
        session.host.querySelector("[data-gh-meta]").textContent = "Google miễn phí đang hoạt động · kết quả do Google Search Element hiển thị.";
        await core().renderGoogleCse(results, value);
      } else renderResultItems(data);
      session.state.lastData = data;
      session.state.page = Number(data.page || session.state.page);
      renderInspector();
    } catch (error) { renderError(value, error); }
    finally { setBusy(false); }
  }

  function renderError(query, error) {
    const results = session.host.querySelector("[data-gh-results]");
    if (!results) return;
    results.innerHTML = `<div class="gh-error"><span>!</span><div><h3>Chưa tải được kết quả</h3><p>${esc(error?.message || "Dịch vụ tìm kiếm chưa phản hồi.")}</p><div><button type="button" data-gh-retry>Thử lại</button><a href="https://www.google.com/search?q=${encodeURIComponent(query)}" target="_blank" rel="noopener">Mở Google ↗</a></div></div></div>`;
    session.host.querySelector("[data-gh-meta]").textContent = "Dữ liệu đã nhập vẫn được giữ lại.";
    results.querySelector("[data-gh-retry]")?.addEventListener("click", () => runSearch(query));
  }

  function setMode(mode, resetPage = true, autoSearch = true) {
    if (!session || !MODES.some((item) => item.id === mode)) return;
    session.state.mode = mode;
    if (resetPage) session.state.page = 1;
    const hub = session.host.querySelector("[data-google-hub]");
    hub.dataset.mode = mode;
    session.host.querySelectorAll("[data-gh-mode]").forEach((button) => button.classList.toggle("is-active", button.dataset.ghMode === mode));
    const main = session.host.querySelector("[data-gh-main-scroll]");
    main.innerHTML = mode === "home" ? homeMarkup() : resultWorkspaceMarkup(session.state);
    bindDynamicValues();
    if (autoSearch && mode !== "home" && session.state.query) runSearch(session.state.query);
  }

  function bindDynamicValues() {
    if (!session) return;
    Object.entries(session.state.filters).forEach(([key, value]) => {
      const input = session.host.querySelector(`[data-gh-filter="${key}"]`);
      if (input) input.value = value;
    });
    const translate = session.host.querySelector("[data-gh-translate-text]");
    if (translate) translate.addEventListener("input", () => {
      session.state.query = translate.value.slice(0, 180);
      const link = session.host.querySelector("[data-gh-translate-link]");
      link.href = `https://translate.google.com/?sl=auto&tl=vi&text=${encodeURIComponent(session.state.query)}&op=translate`;
    });
  }

  function renderInspector() {
    if (!session) return;
    const node = session.host.querySelector("[data-gh-inspector]");
    if (!node) return;
    node.innerHTML = inspectorMarkup();
    checkHealth();
  }

  async function checkHealth() {
    const node = session?.host.querySelector("[data-gh-health]");
    if (!node) return;
    const health = await core().health();
    if (!session?.host.contains(node)) return;
    const online = Boolean(health.services?.google) || Boolean(core().GOOGLE_CSE_ID);
    node.classList.toggle("is-online", online);
    node.querySelector("strong").textContent = online ? "Google sẵn sàng" : "Chưa kết nối API";
    node.querySelector("small").textContent = health.services?.google ? "Search API trực tuyến" : core().GOOGLE_CSE_ID ? "Google Free sẵn sàng" : "Cần cấu hình Search Engine";
  }

  function startVoice() {
    const Recognition = scope.SpeechRecognition || scope.webkitSpeechRecognition;
    if (!Recognition) return toast("Trình duyệt chưa hỗ trợ nhập giọng nói.", "error");
    const recognition = new Recognition();
    recognition.lang = "vi-VN";
    const button = session.host.querySelector("[data-gh-voice]");
    button.classList.add("is-listening");
    recognition.addEventListener("result", (event) => {
      const query = event.results?.[0]?.[0]?.transcript || "";
      session.state.query = query;
      session.host.querySelector('[data-gh-search-form] input').value = query;
      runSearch(query);
    });
    recognition.addEventListener("end", () => button.classList.remove("is-listening"));
    recognition.start();
  }

  function onClick(event) {
    const mode = event.target.closest("[data-gh-mode]");
    if (mode) { setMode(mode.dataset.ghMode); closeDrawers(); return; }
    const query = event.target.closest("[data-gh-query]");
    if (query) { session.state.query = query.dataset.ghQuery; setMode("web"); return; }
    const unsave = event.target.closest("[data-gh-unsave]");
    if (unsave) {
      const item = core().list("webSaved").find((entry) => entry.url === unsave.dataset.ghUnsave);
      if (item) core().toggleWebSaved(item);
      if (session.state.mode === "home") setMode("home"); else renderInspector();
      return;
    }
    if (event.target.closest("[data-gh-voice]")) return startVoice();
    if (event.target.closest("[data-gh-inspector-open]")) return toggleInspector(true);
    if (event.target.closest("[data-gh-inspector-close]")) return toggleInspector(false);
    if (event.target.closest("[data-gh-sidebar-open]")) return session.host.querySelector("[data-google-hub]").classList.add("is-sidebar-open");
    if (event.target.closest("[data-gh-sidebar-close]")) return session.host.querySelector("[data-google-hub]").classList.remove("is-sidebar-open");
    if (event.target.closest("[data-gh-filter-toggle]")) { session.state.filtersOpen = !session.state.filtersOpen; session.host.querySelector("[data-gh-filterbar]")?.classList.toggle("is-open", session.state.filtersOpen); return; }
    if (event.target.closest("[data-gh-reset-filter]")) { session.state.filters = { date: "", file: "", site: "" }; bindDynamicValues(); if (session.state.query) runSearch(); return; }
    if (event.target.closest("[data-gh-safe]")) { const value = !core().preferences().googleSafe; core().updatePreferences({ googleSafe: value }); session.host.querySelector("[data-gh-safe]").textContent = value ? "Bật" : "Tắt"; if (session.state.query && session.state.mode !== "translate") runSearch(); return; }
    const page = event.target.closest("[data-gh-page]");
    if (page) { session.state.page = Math.max(1, session.state.page + (page.dataset.ghPage === "next" ? 1 : -1)); runSearch(); return; }
    if (event.target.closest("[data-gh-clear-history]")) { core().clearSearches("google"); renderInspector(); }
  }

  function onSubmit(event) {
    if (!event.target.matches("[data-gh-search-form]")) return;
    event.preventDefault();
    session.state.page = 1;
    runSearch(new FormData(event.target).get("q"));
  }

  function onChange(event) {
    const input = event.target.closest("[data-gh-filter]");
    if (!input) return;
    session.state.filters[input.dataset.ghFilter] = input.value.trim();
    session.state.page = 1;
    if (session.state.query) runSearch();
  }

  function toggleInspector(open) {
    const hub = session?.host.querySelector("[data-google-hub]");
    hub?.classList.toggle("is-inspector-open", open);
    const node = session?.host.querySelector("[data-gh-inspector]");
    node?.setAttribute("aria-hidden", String(!open));
  }

  function closeDrawers() {
    session?.host.querySelector("[data-google-hub]")?.classList.remove("is-sidebar-open");
  }

  function focus() {
    session?.host.querySelector('[data-gh-search-form] input')?.focus({ preventScroll: true });
  }

  function mount(host) {
    if (!host || !core()) return false;
    unmount();
    const pending = core().consumePending("google");
    const state = { mode: pending?.query ? "web" : "home", query: pending?.query || "", page: 1, filtersOpen: false, filters: { date: "", file: "", site: "" }, busy: false, status: "" };
    host.innerHTML = shellMarkup(state);
    session = { host, state, toastTimer: 0, onClick, onSubmit, onChange, onPending: (event) => { if (event.detail?.provider !== "google") return; state.query = core().cleanText(event.detail.query, 180); setMode("web"); focus(); } };
    host.addEventListener("click", onClick);
    host.addEventListener("submit", onSubmit);
    host.addEventListener("change", onChange);
    scope.addEventListener("hh:search-pending", session.onPending);
    bindDynamicValues();
    checkHealth();
    if (state.query) requestAnimationFrame(() => runSearch(state.query));
    return true;
  }

  function unmount() {
    if (!session) return;
    clearTimeout(session.toastTimer);
    session.host.removeEventListener("click", session.onClick);
    session.host.removeEventListener("submit", session.onSubmit);
    session.host.removeEventListener("change", session.onChange);
    scope.removeEventListener("hh:search-pending", session.onPending);
    session = null;
  }

  return Object.freeze({ version: "1.0.0", mount, unmount, focus, runSearch });
});
