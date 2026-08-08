(function initHHComicReaderHub(global) {
  "use strict";

  const STORAGE_KEY = "hh-comic-reader-state-v1";
  const DB_NAME = "hh-comic-reader-library-v1";
  const DB_VERSION = 1;
  const STORE = "series";
  const GENRES = ["Tất cả", "Hành động", "Phiêu lưu", "Fantasy", "Đời thường", "Bí ẩn", "Hài hước", "Lãng mạn", "Sci-fi", "Webtoon"];
  const PALETTES = [
    ["#172d52", "#6ee7ff", "#a970ff"], ["#3d1838", "#ff7fb8", "#ffbd6c"], ["#143a35", "#65e8ad", "#76b9ff"],
    ["#40251d", "#ff9a5f", "#ffd66e"], ["#241943", "#8f7dff", "#ff73c9"], ["#142f43", "#5ed5ff", "#83ffc9"]
  ];

  let host = null;
  let root = null;
  let keyHandler = null;
  let readerObserver = null;
  const blobUrls = new Set();

  const state = {
    catalog: [],
    view: "home",
    activeSeriesId: "",
    activeChapterId: "",
    readerMode: "scroll",
    readerPage: 0,
    query: "",
    genre: "Tất cả",
    sort: "updated",
    follows: new Set(),
    progress: {},
    importing: false
  };

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const naturalCompare = (a, b) => String(a).localeCompare(String(b), "vi", { numeric: true, sensitivity: "base" });
  const slugify = (value) => String(value || "truyen").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "truyen";
  const timeAgo = (timestamp) => {
    const hours = Math.max(1, Math.floor((Date.now() - Number(timestamp || Date.now())) / 3600000));
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return days < 30 ? `${days} ngày trước` : `${Math.floor(days / 30)} tháng trước`;
  };

  function svgUrl(svg) {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function makeCover(title, index) {
    const [base, glow, accent] = PALETTES[index % PALETTES.length];
    const safe = escapeHtml(title);
    return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 850">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${base}"/><stop offset=".55" stop-color="${accent}"/><stop offset="1" stop-color="#07111d"/></linearGradient><radialGradient id="r"><stop stop-color="${glow}" stop-opacity=".8"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient></defs>
      <rect width="600" height="850" fill="url(#g)"/><circle cx="450" cy="230" r="240" fill="url(#r)"/><path d="M0 650 Q140 500 300 650 T600 610 V850 H0Z" fill="#071019" opacity=".78"/><path d="M105 665 Q190 385 300 235 Q390 380 502 665" fill="none" stroke="${glow}" stroke-width="8" opacity=".52"/><circle cx="300" cy="315" r="72" fill="#fff" opacity=".15"/><text x="50" y="720" fill="white" font-family="Arial,sans-serif" font-size="48" font-weight="800">${safe}</text><text x="52" y="766" fill="${glow}" font-family="Arial,sans-serif" font-size="18" letter-spacing="5">HH ORIGINALS</text></svg>`);
  }

  function makePage(series, chapter, page, index) {
    const [base, glow, accent] = PALETTES[index % PALETTES.length];
    const safeTitle = escapeHtml(series);
    const caption = ["Tín hiệu từ chân trời vừa thức giấc.", "Không ai biết cánh cổng dẫn về đâu.", "Một lựa chọn nhỏ có thể đổi cả thiên hà.", "Hành trình thật sự bắt đầu từ đây."][page % 4];
    return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1400">
      <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${base}"/><stop offset="1" stop-color="#050b13"/></linearGradient><radialGradient id="orb"><stop stop-color="${glow}"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient></defs>
      <rect width="900" height="1400" fill="#eef2f5"/><rect x="28" y="28" width="844" height="460" rx="14" fill="url(#bg)"/><circle cx="650" cy="180" r="190" fill="url(#orb)" opacity=".8"/><path d="M28 440 Q230 270 440 430 T872 360 V488 H28Z" fill="#06111b" opacity=".9"/>
      <rect x="28" y="516" width="402" height="520" rx="14" fill="${accent}"/><path d="M90 940 Q170 620 300 590 Q360 770 405 1010" fill="#08121b" opacity=".76"/><circle cx="245" cy="690" r="72" fill="${glow}" opacity=".55"/>
      <rect x="458" y="516" width="414" height="250" rx="14" fill="#0b1926"/><path d="M490 700 L610 560 L720 690 L845 545" fill="none" stroke="${glow}" stroke-width="14" opacity=".8"/>
      <rect x="458" y="794" width="414" height="242" rx="14" fill="${base}"/><circle cx="675" cy="910" r="90" fill="url(#orb)"/>
      <rect x="28" y="1064" width="844" height="308" rx="14" fill="#0a121b"/><text x="70" y="1150" fill="white" font-family="Arial,sans-serif" font-size="29" font-weight="700">${safeTitle} · Chương ${chapter}</text><text x="70" y="1210" fill="#cde7ef" font-family="Arial,sans-serif" font-size="24">${escapeHtml(caption)}</text><text x="70" y="1310" fill="${glow}" font-family="Arial,sans-serif" font-size="18" letter-spacing="3">TRANG ${page + 1}</text>
    </svg>`);
  }

  function demoCatalog() {
    const names = [
      ["Biên Niên Sử Nexus", "Hành động", "Nax Veyra thức tỉnh giữa H-Central và nhận được tín hiệu của chính mình từ tương lai."],
      ["Mùa Hạ Trong Dải Ngân Hà", "Lãng mạn", "Hai người lạc nhau giữa những hành tinh, chỉ còn một bản nhạc dẫn đường."],
      ["Thợ Săn Sao Rơi", "Phiêu lưu", "Đội săn trẻ tuổi truy tìm lõi sao trước khi bóng tối nuốt chửng thành phố."],
      ["Tiệm Trà Cuối Vũ Trụ", "Đời thường", "Một tiệm trà nhỏ phục vụ những vị khách đến từ các dòng thời gian khác nhau."],
      ["Mật Mã Hành Tinh Số 8", "Bí ẩn", "Mỗi đêm, một ký tự mới xuất hiện trên bầu trời và xóa đi một ký ức."],
      ["Học Viện Pháp Sư Neon", "Fantasy", "Lớp học đặc biệt nơi phép thuật được viết bằng ánh sáng và âm nhạc."],
      ["Robot Nhà Tôi Biết Yêu", "Hài hước", "Một robot bảo mẫu vô tình học được cảm xúc từ các bộ phim truyền hình."],
      ["Thành Phố Không Có Bình Minh", "Webtoon", "Những người canh gác đi tìm mặt trời bị đánh cắp khỏi đường chân trời."]
    ];
    return names.map(([title, genre, description], index) => {
      const id = `hh-${index + 1}`;
      const chapters = Array.from({ length: 4 + index % 3 }, (_, chapterIndex) => {
        const number = chapterIndex + 1;
        return {
          id: `${id}-c${number}`,
          number,
          title: number === 1 ? "Khởi đầu" : number === 2 ? "Tín hiệu" : number === 3 ? "Giao điểm" : `Chương ${number}`,
          updatedAt: Date.now() - (chapterIndex + index) * 7200000,
          pages: Array.from({ length: 7 }, (_, page) => makePage(title, number, page, index))
        };
      });
      return { id, title, altTitles: [], author: "HH Originals", cover: makeCover(title, index), genres: [genre, index % 2 ? "Fantasy" : "Sci-fi"], status: index % 3 === 0 ? "Đã hoàn thành" : "Đang cập nhật", description, rating: 4.6 + (index % 4) * 0.1, views: 12000 + index * 8360, updatedAt: Date.now() - index * 5400000, chapters, sourceType: "original", rights: "HH Originals demo" };
    });
  }

  function loadLocalState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      state.follows = new Set(saved.follows || []);
      state.progress = saved.progress || {};
      state.readerMode = saved.readerMode === "page" ? "page" : "scroll";
    } catch {}
  }

  function saveLocalState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ follows: [...state.follows], progress: state.progress, readerMode: state.readerMode })); } catch {}
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!global.indexedDB) return resolve(null);
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function dbPut(record) {
    const db = await openDatabase();
    if (!db) return;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  async function dbGetAll() {
    const db = await openDatabase();
    if (!db) return [];
    const result = await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return result;
  }

  function toObjectUrl(blob) {
    const url = URL.createObjectURL(blob);
    blobUrls.add(url);
    return url;
  }

  function hydrateStoredSeries(record) {
    const series = { ...record };
    series.chapters = (record.chapters || []).map((chapter) => ({ ...chapter, pages: (chapter.pages || []).map((page) => page instanceof Blob ? toObjectUrl(page) : page) }));
    if (series.cover instanceof Blob) series.cover = toObjectUrl(series.cover);
    return series;
  }

  async function loadImportedSeries() {
    try {
      const imported = (await dbGetAll()).map(hydrateStoredSeries);
      const known = new Set(state.catalog.map((series) => series.id));
      imported.forEach((series) => { if (!known.has(series.id)) state.catalog.push(series); });
      if (root?.isConnected) render();
    } catch {}
  }

  function activeSeries() { return state.catalog.find((series) => series.id === state.activeSeriesId) || null; }
  function activeChapter() { return activeSeries()?.chapters?.find((chapter) => chapter.id === state.activeChapterId) || null; }

  function visibleCatalog() {
    const query = state.query.trim().toLocaleLowerCase();
    let result = state.catalog.filter((series) => state.genre === "Tất cả" || series.genres?.includes(state.genre));
    if (query) result = result.filter((series) => `${series.title} ${series.author} ${(series.altTitles || []).join(" ")} ${(series.genres || []).join(" ")}`.toLocaleLowerCase().includes(query));
    result.sort((a, b) => state.sort === "az" ? naturalCompare(a.title, b.title) : state.sort === "rating" ? b.rating - a.rating : b.updatedAt - a.updatedAt);
    return result;
  }

  function formatViews(value) {
    const number = Number(value || 0);
    return number >= 1000000 ? `${(number / 1000000).toFixed(1)}M` : number >= 1000 ? `${Math.round(number / 1000)}K` : String(number);
  }

  function notify(message, tone = "info") {
    const tray = root?.querySelector("[data-cr-toast]");
    if (!tray) return;
    const toast = document.createElement("div");
    toast.className = `cr-toast is-${tone}`;
    toast.textContent = message;
    tray.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("is-visible"));
    setTimeout(() => { toast.classList.remove("is-visible"); setTimeout(() => toast.remove(), 220); }, 3300);
  }

  function seriesCard(series) {
    const latest = series.chapters?.at(-1);
    const progress = state.progress[series.id];
    return `<article class="cr-series-card" data-series="${escapeHtml(series.id)}">
      <div class="cr-cover"><img src="${escapeHtml(series.cover)}" alt="Bìa ${escapeHtml(series.title)}" loading="lazy"><span>${series.status === "Đã hoàn thành" ? "FULL" : "NEW"}</span>${progress ? `<i style="--p:${clamp(progress.percent || 0, 0, 100)}%"></i>` : ""}</div>
      <div class="cr-card-copy"><strong>${escapeHtml(series.title)}</strong><p>${escapeHtml((series.genres || []).slice(0, 2).join(" · "))}</p><div><button type="button" data-read="${escapeHtml(series.id)}" data-chapter="${escapeHtml(latest?.id || "")}">Ch. ${latest?.number || 1}</button><small>${timeAgo(latest?.updatedAt || series.updatedAt)}</small></div></div>
    </article>`;
  }

  function homeView() {
    const visible = visibleCatalog();
    const hero = visible[0] || state.catalog[0];
    const rankings = [...state.catalog].sort((a, b) => b.views - a.views).slice(0, 7);
    return `<div class="cr-home">
      <section class="cr-hero" style="--hero-cover:url('${escapeHtml(hero?.cover || "")}')">
        <div class="cr-hero-copy"><span>HH COMICS · ORIGINAL & LICENSED</span><h1>${escapeHtml(hero?.title || "Thư viện truyện của bạn")}</h1><p>${escapeHtml(hero?.description || "Nhập catalog hoặc CBZ để bắt đầu đọc.")}</p><div>${hero ? `<button type="button" class="is-primary" data-read="${escapeHtml(hero.id)}" data-chapter="${escapeHtml(state.progress[hero.id]?.chapterId || hero.chapters?.[0]?.id || "")}">▶ Đọc ngay</button><button type="button" data-series="${escapeHtml(hero.id)}">Xem chi tiết</button>` : ""}</div></div>
        <div class="cr-hero-cover">${hero ? `<img src="${escapeHtml(hero.cover)}" alt="">` : ""}</div>
      </section>
      <div class="cr-home-grid">
        <section class="cr-catalog-section"><header><div><strong>${state.query || state.genre !== "Tất cả" ? "Kết quả tìm kiếm" : "Mới cập nhật"}</strong><small>${visible.length.toLocaleString("vi-VN")} bộ truyện</small></div><select data-sort><option value="updated">Mới cập nhật</option><option value="rating">Điểm cao</option><option value="az">Tên A–Z</option></select></header>
          <div class="cr-series-grid">${visible.length ? visible.map(seriesCard).join("") : `<div class="cr-empty"><span>⌕</span><strong>Không tìm thấy truyện</strong><small>Thử từ khóa hoặc thể loại khác.</small></div>`}</div>
        </section>
        <aside class="cr-ranking"><header><strong>Top thịnh hành</strong><span>Tuần</span></header>${rankings.map((series, index) => `<button type="button" data-series="${escapeHtml(series.id)}"><b>${String(index + 1).padStart(2, "0")}</b><img src="${escapeHtml(series.cover)}" alt=""><span><strong>${escapeHtml(series.title)}</strong><small>★ ${series.rating.toFixed(1)} · ${formatViews(series.views)} lượt</small></span></button>`).join("")}</aside>
      </div>
    </div>`;
  }

  function detailView(series) {
    if (!series) return homeView();
    const followed = state.follows.has(series.id);
    const progress = state.progress[series.id];
    return `<div class="cr-detail">
      <button type="button" class="cr-back" data-nav="home">← Trở lại kho truyện</button>
      <section class="cr-detail-hero"><img src="${escapeHtml(series.cover)}" alt="Bìa ${escapeHtml(series.title)}"><div><span>${escapeHtml(series.sourceType === "original" ? "HH ORIGINALS" : "THƯ VIỆN ĐÃ NHẬP")}</span><h1>${escapeHtml(series.title)}</h1><p class="cr-detail-author">Tác giả: <strong>${escapeHtml(series.author || "Đang cập nhật")}</strong></p><div class="cr-tags">${(series.genres || []).map((genre) => `<button type="button" data-genre="${escapeHtml(genre)}">${escapeHtml(genre)}</button>`).join("")}</div><p>${escapeHtml(series.description || "Chưa có mô tả.")}</p><div class="cr-detail-actions"><button type="button" class="is-primary" data-read="${escapeHtml(series.id)}" data-chapter="${escapeHtml(progress?.chapterId || series.chapters?.[0]?.id || "")}">▶ ${progress ? "Đọc tiếp" : "Đọc từ đầu"}</button><button type="button" data-follow="${escapeHtml(series.id)}">${followed ? "✓ Đang theo dõi" : "♡ Theo dõi"}</button></div><dl><div><dt>Trạng thái</dt><dd>${escapeHtml(series.status || "Đang cập nhật")}</dd></div><div><dt>Đánh giá</dt><dd>★ ${Number(series.rating || 4.5).toFixed(1)}</dd></div><div><dt>Lượt đọc</dt><dd>${formatViews(series.views)}</dd></div><div><dt>Số chương</dt><dd>${series.chapters?.length || 0}</dd></div></dl></div></section>
      <section class="cr-chapters"><header><div><strong>Danh sách chương</strong><small>${series.chapters?.length || 0} chương · lưu tiến độ tự động</small></div><input type="search" placeholder="Tìm chương…" data-chapter-search></header><div data-chapter-list>${[...(series.chapters || [])].reverse().map((chapter) => `<button type="button" data-read="${escapeHtml(series.id)}" data-chapter="${escapeHtml(chapter.id)}"><span><strong>Chương ${chapter.number}</strong><small>${escapeHtml(chapter.title || "")}</small></span><i>${timeAgo(chapter.updatedAt)}</i><b>${progress?.chapterId === chapter.id ? "Đang đọc" : "Đọc →"}</b></button>`).join("")}</div></section>
    </div>`;
  }

  function libraryView(kind) {
    const ids = kind === "follows" ? [...state.follows] : Object.keys(state.progress).sort((a, b) => state.progress[b].updatedAt - state.progress[a].updatedAt);
    const series = ids.map((id) => state.catalog.find((entry) => entry.id === id)).filter(Boolean);
    return `<div class="cr-library-view"><header><div><span>${kind === "follows" ? "♡" : "◷"}</span><div><h1>${kind === "follows" ? "Truyện đang theo dõi" : "Lịch sử đọc"}</h1><p>Dữ liệu riêng trên thiết bị này.</p></div></div><button type="button" data-nav="home">Khám phá truyện</button></header><div class="cr-series-grid">${series.length ? series.map(seriesCard).join("") : `<div class="cr-empty"><span>${kind === "follows" ? "♡" : "◷"}</span><strong>Chưa có truyện</strong><small>${kind === "follows" ? "Bấm Theo dõi tại trang chi tiết." : "Tiến độ xuất hiện sau khi bạn đọc một chương."}</small></div>`}</div></div>`;
  }

  function sourceView() {
    return `<div class="cr-source-view"><header><span>＋</span><div><h1>Thêm kho truyện của bạn</h1><p>Nhập nội dung do bạn sở hữu hoặc nguồn/API có quyền phân phối.</p></div></header><div class="cr-source-grid">
      <button type="button" data-action="import-cbz"><b>CBZ / ZIP</b><span>Mỗi file thành một bộ truyện; ảnh được lưu offline trong IndexedDB.</span><i>Chọn file →</i></button>
      <button type="button" data-action="import-json"><b>Catalog JSON</b><span>Nhập series, chương, ảnh và metadata theo manifest.</span><i>Chọn JSON →</i></button>
      <button type="button" data-action="sample-json"><b>Tải JSON mẫu</b><span>Schema sẵn để kết nối website hoặc CMS thuộc quyền của bạn.</span><i>Tải mẫu →</i></button>
      <section><b>API / Feed được cấp phép</b><span>Dùng endpoint HTTPS có CORS và trả về cùng schema catalog.</span><div><input type="url" placeholder="https://your-domain.com/comics.json" data-feed-url><button type="button" data-action="import-feed">Kết nối</button></div></section>
    </div><aside><strong>Nguyên tắc nguồn</strong><p>HH Comics không tự vượt CAPTCHA, anti-bot, hotlink protection hoặc crawl hàng loạt website bên thứ ba. Bạn vẫn có thể nhập catalog/API của chính mình và đọc trực tiếp trên web.</p></aside></div>`;
  }

  function readerView(series, chapter) {
    if (!series || !chapter) return detailView(series);
    const chapters = series.chapters || [];
    const chapterIndex = chapters.findIndex((entry) => entry.id === chapter.id);
    const pages = chapter.pages || [];
    state.readerPage = clamp(state.readerPage, 0, Math.max(0, pages.length - 1));
    return `<div class="cr-reader is-${state.readerMode}" data-reader>
      <header class="cr-reader-bar"><button type="button" data-series="${escapeHtml(series.id)}">←</button><div><strong>${escapeHtml(series.title)}</strong><small>Chương ${chapter.number} · ${escapeHtml(chapter.title || "")}</small></div><select data-reader-chapter>${chapters.map((entry) => `<option value="${escapeHtml(entry.id)}"${entry.id === chapter.id ? " selected" : ""}>Chương ${entry.number}</option>`).join("")}</select><div class="cr-reader-modes"><button type="button" data-reader-mode="scroll"${state.readerMode === "scroll" ? ' class="is-active"' : ""}>Cuộn dọc</button><button type="button" data-reader-mode="page"${state.readerMode === "page" ? ' class="is-active"' : ""}>Từng trang</button></div><button type="button" data-action="reader-fullscreen">⛶</button></header>
      <main class="cr-reader-pages" data-reader-pages>${state.readerMode === "scroll" ? pages.map((page, index) => `<figure data-page="${index}"><img src="${escapeHtml(page)}" alt="Trang ${index + 1}" loading="${index < 3 ? "eager" : "lazy"}"><figcaption>${index + 1} / ${pages.length}</figcaption></figure>`).join("") : `<figure data-page="${state.readerPage}"><img src="${escapeHtml(pages[state.readerPage] || "")}" alt="Trang ${state.readerPage + 1}"><figcaption>${state.readerPage + 1} / ${pages.length}</figcaption></figure>`}</main>
      <footer><button type="button" data-reader-nav="prev"${state.readerMode === "page" && state.readerPage > 0 ? "" : chapterIndex > 0 ? "" : " disabled"}>← ${state.readerMode === "page" && state.readerPage > 0 ? "Trang trước" : "Chương trước"}</button><div><span data-reader-progress>${Math.round((state.readerPage + 1) / Math.max(1, pages.length) * 100)}%</span><i style="--p:${Math.round((state.readerPage + 1) / Math.max(1, pages.length) * 100)}%"></i></div><button type="button" data-reader-nav="next"${state.readerMode === "page" && state.readerPage < pages.length - 1 ? "" : chapterIndex < chapters.length - 1 ? "" : " disabled"}>${state.readerMode === "page" && state.readerPage < pages.length - 1 ? "Trang sau" : "Chương sau"} →</button></footer>
    </div>`;
  }

  function shellHtml(content) {
    return `<section class="cr-app">
      <header class="cr-topbar"><button type="button" class="cr-logo" data-nav="home"><span>CR</span><div><strong>HH Comics</strong><small>Đọc truyện online</small></div></button><label class="cr-search"><span>⌕</span><input type="search" value="${escapeHtml(state.query)}" placeholder="Tìm tên truyện, tác giả, thể loại…" data-search></label><nav><button type="button" data-nav="history">◷ Lịch sử</button><button type="button" data-nav="follows">♡ Theo dõi <i>${state.follows.size}</i></button><button type="button" class="is-primary" data-nav="sources">＋ Thêm truyện</button></nav><input hidden type="file" accept=".cbz,.zip,application/zip" multiple data-cbz-input><input hidden type="file" accept=".json,application/json" data-json-input></header>
      <div class="cr-layout"><aside class="cr-sidebar"><strong>Khám phá</strong><button type="button" data-nav="home" class="${state.view === "home" ? "is-active" : ""}">⌂ Trang chủ</button><button type="button" data-nav="follows" class="${state.view === "follows" ? "is-active" : ""}">♡ Theo dõi</button><button type="button" data-nav="history" class="${state.view === "history" ? "is-active" : ""}">◷ Lịch sử</button><strong>Thể loại</strong>${GENRES.map((genre) => `<button type="button" data-genre="${escapeHtml(genre)}" class="${state.genre === genre && state.view === "home" ? "is-active" : ""}">${escapeHtml(genre)}</button>`).join("")}<footer><button type="button" data-nav="sources">＋ Quản lý nguồn</button><small>${state.catalog.length} bộ · ${state.catalog.reduce((sum, series) => sum + (series.chapters?.length || 0), 0)} chương</small></footer></aside><main class="cr-content">${content}</main></div>
      <div class="cr-toast-tray" data-cr-toast></div><div class="cr-importing" data-importing hidden><i></i><strong>Đang nhập truyện…</strong><span>Không đóng trang cho đến khi hoàn tất.</span></div>
    </section>`;
  }

  function render() {
    if (!host) return;
    if (readerObserver) { readerObserver.disconnect(); readerObserver = null; }
    let content;
    if (state.view === "detail") content = detailView(activeSeries());
    else if (state.view === "reader") content = readerView(activeSeries(), activeChapter());
    else if (state.view === "follows" || state.view === "history") content = libraryView(state.view);
    else if (state.view === "sources") content = sourceView();
    else content = homeView();
    host.innerHTML = shellHtml(content);
    root = host.firstElementChild;
    const sort = root.querySelector("[data-sort]");
    if (sort) sort.value = state.sort;
    bindInputs();
    if (state.view === "reader") setupReaderObserver();
  }

  function setImporting(active) {
    state.importing = active;
    const overlay = root?.querySelector("[data-importing]");
    if (overlay) overlay.hidden = !active;
  }

  function normalizeCatalog(data, sourceLabel = "Catalog JSON") {
    const rows = Array.isArray(data) ? data : data?.series;
    if (!Array.isArray(rows)) throw new Error("Catalog cần có mảng series.");
    return rows.slice(0, 5000).map((entry, index) => {
      if (!entry?.title || !Array.isArray(entry.chapters)) throw new Error(`Series ${index + 1} thiếu title hoặc chapters.`);
      const id = String(entry.id || `feed-${slugify(entry.title)}-${index}`);
      const chapters = entry.chapters.slice(0, 5000).map((chapter, chapterIndex) => ({
        id: String(chapter.id || `${id}-c${chapterIndex + 1}`), number: Number(chapter.number ?? chapterIndex + 1), title: String(chapter.title || ""), updatedAt: Date.parse(chapter.updatedAt) || Date.now(), pages: (chapter.pages || []).filter((url) => typeof url === "string" && /^(https?:|blob:|data:)/.test(url)).slice(0, 1000)
      })).filter((chapter) => chapter.pages.length);
      return { id, title: String(entry.title), altTitles: entry.altTitles || [], author: String(entry.author || "Đang cập nhật"), cover: String(entry.cover || chapters[0]?.pages[0] || makeCover(entry.title, index)), genres: Array.isArray(entry.genres) ? entry.genres.map(String) : [], status: String(entry.status || "Đang cập nhật"), description: String(entry.description || ""), rating: clamp(entry.rating || 4.5, 0, 5), views: Math.max(0, Number(entry.views || 0)), updatedAt: Date.parse(entry.updatedAt) || Date.now(), chapters, sourceType: "feed", rights: String(entry.rights || sourceLabel) };
    }).filter((series) => series.chapters.length);
  }

  function mergeCatalog(seriesList) {
    const map = new Map(state.catalog.map((series) => [series.id, series]));
    seriesList.forEach((series) => map.set(series.id, series));
    state.catalog = [...map.values()];
  }

  async function importJsonFile(file) {
    setImporting(true);
    try {
      const series = normalizeCatalog(JSON.parse(await file.text()), file.name);
      mergeCatalog(series);
      state.view = "home";
      render();
      notify(`Đã nhập ${series.length} bộ truyện từ JSON.`, "success");
    } catch (error) { notify(error.message || "Không thể nhập JSON.", "error"); }
    finally { setImporting(false); }
  }

  async function importFeed() {
    const input = root.querySelector("[data-feed-url]");
    const url = input?.value?.trim();
    if (!url || !/^https:\/\//i.test(url)) return notify("Hãy nhập endpoint HTTPS hợp lệ.", "error");
    setImporting(true);
    try {
      const response = await fetch(url, { method: "GET", credentials: "omit", mode: "cors", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Nguồn phản hồi HTTP ${response.status}`);
      const series = normalizeCatalog(await response.json(), new URL(url).hostname);
      mergeCatalog(series);
      state.view = "home";
      render();
      notify(`Đã kết nối ${series.length} bộ truyện.`, "success");
    } catch (error) { notify(error.message || "Không thể kết nối feed. Kiểm tra CORS.", "error"); }
    finally { setImporting(false); }
  }

  async function importCbz(files) {
    if (!global.JSZip) return notify("Engine ZIP chưa sẵn sàng.", "error");
    setImporting(true);
    let added = 0;
    try {
      for (const file of Array.from(files || []).slice(0, 100)) {
        const zip = await global.JSZip.loadAsync(file, { checkCRC32: true });
        const entries = Object.values(zip.files).filter((entry) => !entry.dir && /\.(jpe?g|png|webp|gif|avif)$/i.test(entry.name)).sort((a, b) => naturalCompare(a.name, b.name));
        if (!entries.length) continue;
        const blobs = [];
        for (const entry of entries.slice(0, 2000)) blobs.push(await entry.async("blob"));
        const title = file.name.replace(/\.(cbz|zip)$/i, "");
        const id = `local-${slugify(title)}-${file.size}-${file.lastModified}`;
        const record = { id, title, altTitles: [], author: "Thư viện của bạn", cover: blobs[0], genres: ["Thư viện cá nhân"], status: "Đã nhập", description: `Được nhập từ ${file.name}.`, rating: 5, views: 0, updatedAt: Date.now(), sourceType: "local", rights: "Nội dung do người dùng nhập", chapters: [{ id: `${id}-chapter-1`, number: 1, title: "Chương 1", updatedAt: Date.now(), pages: blobs }] };
        await dbPut(record);
        mergeCatalog([hydrateStoredSeries(record)]);
        added += 1;
      }
      state.view = "home";
      render();
      notify(`Đã nhập và lưu offline ${added} bộ truyện.`, "success");
    } catch (error) { notify(error.message || "Không thể giải nén CBZ/ZIP.", "error"); }
    finally { setImporting(false); }
  }

  function downloadSampleJson() {
    const sample = { format: "hh-comic-catalog", version: 1, series: [{ id: "my-comic", title: "Tên truyện", author: "Tác giả", cover: "https://your-domain.com/cover.jpg", genres: ["Fantasy"], status: "Đang cập nhật", description: "Mô tả", rights: "Tên giấy phép hoặc chủ sở hữu", chapters: [{ id: "chapter-1", number: 1, title: "Khởi đầu", updatedAt: new Date().toISOString(), pages: ["https://your-domain.com/chapter-1/page-001.jpg"] }] }] };
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "hh-comics-catalog-sample.json"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function openSeries(id) {
    state.activeSeriesId = id;
    state.view = "detail";
    render();
  }

  function openReader(seriesId, chapterId) {
    const series = state.catalog.find((entry) => entry.id === seriesId);
    const chapter = series?.chapters?.find((entry) => entry.id === chapterId) || series?.chapters?.[0];
    if (!series || !chapter) return notify("Chương này chưa có ảnh.", "error");
    state.activeSeriesId = series.id;
    state.activeChapterId = chapter.id;
    state.readerPage = state.progress[series.id]?.chapterId === chapter.id ? clamp(state.progress[series.id].page, 0, chapter.pages.length - 1) : 0;
    state.view = "reader";
    updateProgress(state.readerPage);
    render();
  }

  function updateProgress(page) {
    const series = activeSeries(); const chapter = activeChapter(); if (!series || !chapter) return;
    state.readerPage = clamp(page, 0, Math.max(0, chapter.pages.length - 1));
    state.progress[series.id] = { chapterId: chapter.id, page: state.readerPage, percent: Math.round((state.readerPage + 1) / Math.max(1, chapter.pages.length) * 100), updatedAt: Date.now() };
    saveLocalState();
    const label = root?.querySelector("[data-reader-progress]"); if (label) label.textContent = `${state.progress[series.id].percent}%`;
  }

  function readerNavigate(direction) {
    const series = activeSeries(); const chapter = activeChapter(); if (!series || !chapter) return;
    if (state.readerMode === "page") {
      const nextPage = state.readerPage + direction;
      if (nextPage >= 0 && nextPage < chapter.pages.length) { state.readerPage = nextPage; updateProgress(nextPage); return render(); }
    }
    const index = series.chapters.findIndex((entry) => entry.id === chapter.id) + direction;
    if (index >= 0 && index < series.chapters.length) openReader(series.id, series.chapters[index].id);
  }

  function setupReaderObserver() {
    if (state.readerMode !== "scroll" || !("IntersectionObserver" in global)) return;
    readerObserver = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) updateProgress(Number(visible.target.dataset.page || 0));
    }, { root: root.querySelector("[data-reader-pages]"), threshold: [0.45, 0.72] });
    root.querySelectorAll("[data-page]").forEach((page) => readerObserver.observe(page));
  }

  function bindInputs() {
    const cbzInput = root.querySelector("[data-cbz-input]");
    const jsonInput = root.querySelector("[data-json-input]");
    cbzInput.addEventListener("change", () => { importCbz(cbzInput.files); cbzInput.value = ""; });
    jsonInput.addEventListener("change", () => { if (jsonInput.files[0]) importJsonFile(jsonInput.files[0]); jsonInput.value = ""; });
  }

  function handleClick(event) {
    const action = event.target.closest("[data-action]");
    const nav = event.target.closest("[data-nav]");
    const read = event.target.closest("[data-read]");
    const series = event.target.closest("[data-series]");
    const genre = event.target.closest("[data-genre]");
    const follow = event.target.closest("[data-follow]");
    const mode = event.target.closest("[data-reader-mode]");
    const readerNav = event.target.closest("[data-reader-nav]");
    if (read) { event.stopPropagation(); return openReader(read.dataset.read, read.dataset.chapter); }
    if (series) return openSeries(series.dataset.series);
    if (genre) { state.genre = genre.dataset.genre; state.view = "home"; return render(); }
    if (follow) { const id = follow.dataset.follow; state.follows.has(id) ? state.follows.delete(id) : state.follows.add(id); saveLocalState(); return render(); }
    if (nav) { state.view = nav.dataset.nav; if (state.view === "home") { state.query = ""; state.genre = "Tất cả"; } return render(); }
    if (mode) { state.readerMode = mode.dataset.readerMode; saveLocalState(); return render(); }
    if (readerNav) return readerNavigate(readerNav.dataset.readerNav === "prev" ? -1 : 1);
    if (!action) return;
    if (action.dataset.action === "import-cbz") root.querySelector("[data-cbz-input]").click();
    else if (action.dataset.action === "import-json") root.querySelector("[data-json-input]").click();
    else if (action.dataset.action === "sample-json") downloadSampleJson();
    else if (action.dataset.action === "import-feed") importFeed();
    else if (action.dataset.action === "reader-fullscreen") root.querySelector("[data-reader]")?.requestFullscreen?.();
  }

  function handleInput(event) {
    if (event.target.matches("[data-search]")) { state.query = event.target.value; state.view = "home"; clearTimeout(handleInput.timer); handleInput.timer = setTimeout(render, 120); }
    else if (event.target.matches("[data-sort]")) { state.sort = event.target.value; render(); }
    else if (event.target.matches("[data-reader-chapter]")) openReader(state.activeSeriesId, event.target.value);
    else if (event.target.matches("[data-chapter-search]")) {
      const query = event.target.value.toLocaleLowerCase();
      root.querySelectorAll("[data-chapter-list]>button").forEach((button) => button.hidden = !button.textContent.toLocaleLowerCase().includes(query));
    }
  }

  function mount(target) {
    if (!target) return;
    unmount();
    host = target;
    loadLocalState();
    state.catalog = demoCatalog();
    state.view = "home";
    host.addEventListener("click", handleClick);
    host.addEventListener("input", handleInput);
    host.addEventListener("change", handleInput);
    keyHandler = (event) => {
      if (!root?.isConnected || event.target.matches("input,textarea,select,[contenteditable]")) return;
      if (state.view === "reader" && event.key === "ArrowLeft") readerNavigate(-1);
      else if (state.view === "reader" && event.key === "ArrowRight") readerNavigate(1);
      else if (event.key === "Escape" && state.view === "reader") openSeries(state.activeSeriesId);
    };
    global.addEventListener("keydown", keyHandler);
    render();
    loadImportedSeries();
    global.dispatchEvent(new CustomEvent("hh:comic-reader-ready"));
  }

  function unmount() {
    if (readerObserver) readerObserver.disconnect();
    readerObserver = null;
    if (keyHandler) global.removeEventListener("keydown", keyHandler);
    keyHandler = null;
    blobUrls.forEach((url) => URL.revokeObjectURL(url));
    blobUrls.clear();
    if (host) { host.removeEventListener("click", handleClick); host.removeEventListener("input", handleInput); host.removeEventListener("change", handleInput); host.replaceChildren(); }
    host = null;
    root = null;
  }

  global.HHComicReaderHub = Object.freeze({ mount, unmount, version: "1.0.0" });
})(window);
