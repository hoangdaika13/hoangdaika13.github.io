(function platformHomeBootstrap(root, factory) {
  "use strict";
  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHPlatformHome = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPlatformHome(global) {
  "use strict";

  const ROUTE = "/platform";
  // Descriptions explain scope, not service readiness. Routes, names, counts
  // and children come exclusively from the application's navigation registry.
  const DESCRIPTIONS = Object.freeze({
    "chat-ai": "Hội thoại nhiều lượt, nghiên cứu có nguồn, phân tích ảnh/PDF, viết và hỗ trợ lập trình.",
    create: "Biến ý tưởng thành nội dung: brief, kịch bản, prompt, media, cộng tác và xuất bản.",
    draw: "Vẽ bằng ánh sáng, đối xứng, phản chiếu và chuyển động. Tạo tác phẩm ngay trong trình duyệt.",
    "music-ai": "Từ giai điệu đầu tiên đến bản phối: sáng tác, loop, thu âm, mix, master và visualizer.",
    "comic-motion": "Đưa khung truyện vào chuyển động với cảnh, camera, nhân vật và hiệu ứng điện ảnh.",
    "media-design": "Không gian sản xuất ảnh, video, audio, tài liệu, thumbnail và tài nguyên đa phương tiện.",
    "graphic-design": "Vector, typography, animation 2D, 3D, mockup, nhân vật, prototype và component.",
    google: "Tìm kiếm và khám phá web, hình ảnh, tin tức và tài liệu theo nhu cầu của bạn.",
    "youtube-main": "Khám phá video, trình phát và thư viện YouTube trong một không gian riêng.",
    discord: "Kết nối cộng đồng, server và kênh Discord qua các tích hợp hiện có.",
    communication: "Inbox, messenger, forum, phòng trực tiếp, thông báo và công cụ cộng tác.",
    remote: "Chia sẻ màn hình máy tính và điện thoại bằng WebRTC, mã phiên và PIN một lần.",
    "cosmic-observatory": "Hệ Mặt Trời 3D, bầu trời đêm, DSN, ngoại hành tinh, nhiệm vụ và dữ liệu thiên văn.",
    "play-center": "Arcade, party, truyện tương tác, escape room, nhịp điệu, thú cưng, chill và quiz.",
    "eonwild-game": "Khám phá thế giới sinh tồn, loài, hệ sinh thái, thời đại địa chất, dòng gene và replay.",
    "comic-reader": "Thư viện truyện và sách có nguồn; tìm kiếm, theo dõi, lịch sử và nhiều chế độ đọc.",
    cinema: "Khám phá phim Public Domain và Creative Commons với nguồn và điều kiện giấy phép.",
    "music-library": "Nghe nhạc mở, tạo playlist và tra cứu tác giả, nguồn cùng giấy phép sử dụng.",
    fortune: "Tarot, 64 quẻ, bản đồ sao, thần số và nhật ký chiêm nghiệm; dành cho giải trí, suy ngẫm.",
    work: "Dự án, task, board, lịch, Gantt, roadmap, đội nhóm, tri thức và quy trình tự động.",
    "davinci-resolve": "Dựng video, tạo thumbnail, phụ đề, xử lý batch và công cụ YouTube, Facebook, TikTok.",
    dev: "Code, API, dữ liệu, Git, delivery, bảo mật, quan sát hệ thống và tiện ích lập trình.",
    insights: "Đọc báo cáo, hiệu suất, Web Vitals và tín hiệu vận hành từ nguồn dữ liệu thực tế.",
    copyright: "Quản lý nguồn, quyền sử dụng, giấy phép, ghi công và quy trình tiếp nhận khiếu nại.",
    learn: "Lộ trình, môn học, luyện tập, kiểm tra và thư viện với tiến độ của chính bạn.",
    english: "Học theo CEFR: từ vựng, phát âm, nghe, nói, đọc, viết và tiếng Anh chuyên ngành.",
    japanese: "Vietnamese Core, Can-do, JLPT/JF, Kanji, Smart Reader, hội thoại và ôn tập SRS.",
    chinese: "Luyện Pinyin, thanh điệu, Hán tự, từ vựng, ngữ pháp và đọc hiểu theo lộ trình.",
    "phat-phap": "Kinh điển có nguồn, tu học, tra cứu, thiền, tụng niệm, pháp thoại và nhật ký riêng tư.",
    admin: "Trung tâm quản trị dành riêng cho tài khoản có quyền Admin đã được xác minh.",
    system: "Giao diện, quyền riêng tư, PWA, widget, dữ liệu, sao lưu và khôi phục.",
    support: "Gửi phản hồi, tìm trợ giúp, theo dõi định hướng và đóng góp cho nhà phát triển."
  });
  const PROVIDER_IDS = new Set(["chat-ai", "music-ai", "comic-motion", "fortune"]);
  const NETWORK_IDS = new Set(["google", "youtube-main", "discord", "communication", "remote", "cinema", "music-library", "comic-reader", "support"]);
  const RECIPES = Object.freeze([
    ["content", "Sáng tạo nội dung", "Từ ý tưởng đến bản phát hành", ["create", "media-design", "davinci-resolve", "copyright"]],
    ["video", "Làm video", "Chuẩn bị · dựng · hoàn thiện", ["create", "comic-motion", "davinci-resolve", "youtube-main"]],
    ["language", "Học ngoại ngữ", "Chọn ngôn ngữ, giữ nhịp mỗi ngày", ["learn", "english", "japanese", "chinese"]],
    ["work", "Quản lý công việc", "Tổ chức việc, kết nối đội nhóm", ["work", "communication", "dev", "insights"]],
    ["code", "Lập trình", "Ý tưởng, mã nguồn và quan sát", ["dev", "chat-ai", "work", "insights"]],
    ["play", "Giải trí", "Một khoảng nghỉ cho riêng bạn", ["play-center", "eonwild-game", "music-library", "cosmic-observatory"]],
    ["connect", "Kết nối cộng đồng", "Tìm không gian cùng chia sẻ", ["communication", "discord", "remote"]]
  ]);
  const list = (value) => Array.isArray(value) ? value : [];
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().trim();
  const safeRoute = (value) => /^\/(?!\/)[a-z0-9/-]+$/.test(String(value)) && !/^\/(home|galaxy)(\/|$)/.test(value);
  const color = (value) => /^#[a-f\d]{6}$/i.test(value || "") ? value : "#71e8f3";

  function buildCatalog(sections, groups, options = {}) {
    const seen = new Set();
    return list(sections).map((section) => ({
      id: String(section.id), label: String(section.label), icon: String(section.icon || "✦"),
      accent: color(section.accent), secondary: color(section.accentSecondary),
      items: list(section.groupIds).map((id) => list(groups).find((group) => group.id === id)).filter((group) => {
        if (!group || !safeRoute(group.route) || seen.has(group.route)) return false;
        seen.add(group.route);
        return true;
      }).map((group) => {
        const children = list(options.children?.(group)).filter((item) => safeRoute(item.route));
        const uniqueChildren = [...new Map(children.map((item) => [item.route, item])).values()];
        return {
          id: group.id, label: group.label, route: group.route, icon: group.icon || "◇",
          accent: color(group.accent || section.accent), group: section.label, section: section.id,
          description: DESCRIPTIONS[group.id] || group.description || `Khám phá các công cụ trong ${group.label}.`,
          keywords: String(options.aliases?.[group.id] || ""), children: uniqueChildren,
          adminOnly: group.adminOnly === true, locked: group.adminOnly === true && options.admin !== true
        };
      })
    })).filter((section) => section.items.length);
  }

  function filterCatalog(catalog, query = "", section = "all", favoritesOnly = false, favorites = []) {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    return catalog.flatMap((group) => group.items).filter((item) => {
      const text = normalize([item.label, item.description, item.group, item.keywords, ...item.children.map((child) => `${child.title} ${child.description || ""}`)].join(" "));
      return (section === "all" || item.section === section) && (!favoritesOnly || favorites.includes(item.route)) && words.every((word) => text.includes(word));
    });
  }

  function capability(item, online) {
    if (item.adminOnly) return { label: "Admin", detail: item.locked ? "Cần quyền Admin đã xác minh." : "Quyền Admin được xác minh bởi phiên hiện tại." };
    if (item.id === "draw") return { label: "Cục bộ", detail: "Canvas chạy trong trình duyệt; khả năng xuất phụ thuộc thiết bị." };
    if (PROVIDER_IDS.has(item.id)) return { label: "Cần xác minh provider", detail: "Kiểm tra cấu hình trong workspace; trang chủ không gọi AI hoặc gửi nội dung." };
    if (NETWORK_IDS.has(item.id)) return { label: online ? "Cần kết nối dịch vụ" : "Cần kết nối mạng", detail: "Trạng thái mạng không chứng minh backend/OAuth sẵn sàng. Kết nối khi bạn chủ động mở công cụ." };
    return { label: "Theo từng công cụ", detail: "Có thao tác trên thiết bị; AI, realtime và đồng bộ cần provider/backend tương ứng." };
  }

  // Never enumerate storage or reuse the Layer One snapshot. Only this known
  // Layer Two project schema is read, and only its display metadata is returned.
  function readProjectSummaries(storage) {
    try {
      const raw = storage?.getItem("hh.creative-os.v1");
      if (!raw) return { status: "empty", projects: [] };
      if (raw.length > 4_500_000) return { status: "error", projects: [] };
      const data = JSON.parse(raw);
      if (data?.version !== 1 || !Array.isArray(data.projects)) return { status: "error", projects: [] };
      const projects = data.projects.filter((item) => item && !item.isTemplate && !item.template && !item.isDemo && !/^(sample|demo|template)(-|$)/i.test(item.id || "") && typeof item.name === "string")
        .sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0)).slice(0, 3)
        .map((item) => ({ title: item.name.slice(0, 180), updatedAt: item.updatedAt || null }));
      return { status: projects.length ? "ready" : "empty", projects };
    } catch { return { status: "error", projects: [] }; }
  }

  function link(route, label, className = "", extra = "") {
    return `<a class="${className}" href="#${escape(route)}" data-php-route="${escape(route)}" ${extra}>${label}</a>`;
  }
  const heading = (number, eyebrow, title, description = "") => `<header class="php-heading"><div><span class="php-eyebrow">${number} / ${eyebrow}</span><h2>${title}</h2></div>${description ? `<p>${description}</p>` : ""}</header>`;

  function cardMarkup(item, online, favorites, pins) {
    const status = capability(item, online);
    const children = item.locked ? [] : item.children;
    return `<article class="php-card" data-php-card="${escape(item.route)}" style="--php-accent:${item.accent}">
      <div class="php-card-top"><span class="php-icon" aria-hidden="true">${escape(item.icon)}</span><span class="php-badge" title="${escape(status.detail)}">${escape(status.label)}</span></div>
      <small class="php-group-label">${escape(item.group)}</small><h3>${escape(item.label)}</h3><p>${escape(item.description)}</p>
      <div class="php-card-preview">${children.slice(0, 3).map((child) => `<span>${escape(child.title)}</span>`).join("") || `<span>${escape(status.detail)}</span>`}</div>
      ${children.length ? `<details class="php-tools"><summary>${children.length} công cụ & không gian con</summary><div>${children.map((child) => link(child.route, `${escape(child.title)} <span aria-hidden="true">↗</span>`, "", child.description ? `title="${escape(child.description)}"` : "")).join("")}</div></details>` : ""}
      <div class="php-card-actions">${item.locked ? '<span class="php-locked">Chỉ dành cho Admin</span>' : link(item.route, 'Mở workspace <span aria-hidden="true">↗</span>', "php-open")}
      <button type="button" data-php-favorite="${escape(item.route)}" aria-label="Yêu thích ${escape(item.label)}" aria-pressed="${favorites.includes(item.route)}" ${item.locked ? "disabled" : ""} title="Yêu thích">${favorites.includes(item.route) ? "♥" : "♡"}</button>
      <button type="button" data-php-pin="${escape(item.route)}" aria-label="Ghim ${escape(item.label)}" aria-pressed="${pins.includes(item.route)}" ${item.locked ? "disabled" : ""} title="Ghim vào sidebar (tối đa 5)">${pins.includes(item.route) ? "★" : "☆"}</button></div>
    </article>`;
  }

  function markup(catalog, data = {}) {
    const items = catalog.flatMap((group) => group.items);
    const quick = ["create", "chat-ai", "work", "learn"].map((id) => items.find((item) => item.id === id)).filter(Boolean);
    return `<div class="php" data-platform-home>
      <a class="php-skip" href="#php-catalog" data-php-jump="php-catalog">Đến danh mục chức năng</a>
      <section class="php-hero" aria-labelledby="php-title">
        <div class="php-stardust" aria-hidden="true"></div><div class="php-hero-copy"><span class="php-eyebrow"><i></i> HH PLATFORM · LỚP 2</span>
        <p class="php-hero-overline">MỘT ĐIỂM ĐẾN. VÔ HẠN KHẢ NĂNG.</p><h1 id="php-title" tabindex="-1">Vũ trụ công cụ số<br><em>của bạn.</em></h1>
        <p class="php-hero-description">Sáng tạo điều khác biệt. Học thêm mỗi ngày.<br>Làm việc, kết nối và khám phá — trong một không gian.</p>
        <div class="php-hero-actions"><button class="php-primary" type="button" data-php-jump="php-catalog">Khám phá ${items.length} chức năng <span aria-hidden="true">↗</span></button>${link("/chat-ai", "Hỏi HH AI ✦", "php-secondary")}</div>
        <button class="php-resume" type="button" data-php-jump="php-command">Tiếp tục công việc gần đây <span aria-hidden="true">↓</span></button>
        <div class="php-hero-facts"><span><b>${catalog.length}</b> không gian kết nối</span><span><b>${items.length}</b> chức năng trong registry</span><span><b>01</b> cổng HH CORE</span></div></div>
        <div class="php-cosmos" role="group" aria-label="Bản đồ sáu nhóm chức năng Lớp 2">
          <div class="php-orbit php-orbit-one" aria-hidden="true"></div><div class="php-orbit php-orbit-two" aria-hidden="true"></div><div class="php-orbit php-orbit-three" aria-hidden="true"></div>
          <button class="php-core" type="button" data-php-jump="php-catalog" aria-label="HH CORE — khám phá toàn bộ chức năng"><span>HH</span><strong>CORE</strong><small>YOUR DIGITAL UNIVERSE</small></button>
          ${catalog.map((group, index) => `<button class="php-planet php-planet-${index}" type="button" data-php-group-jump="${escape(group.id)}" style="--php-accent:${group.accent};--php-delay:-${index * 1.3}s" title="${escape(group.items.map((item) => item.label).join(" · "))}"><i aria-hidden="true">${escape(group.icon)}</i><span>${escape(group.label)}<small>${group.items.length} chức năng <b aria-hidden="true">↗</b></small></span></button>`).join("")}
          <span class="php-cosmos-caption">CHỌN MỘT KHÔNG GIAN ĐỂ KHỞI HÀNH</span>
        </div>
      </section>
      <div class="php-status-strip" aria-label="Trạng thái thực tế"><span data-php-network></span><span data-php-storage></span><span>◇ Provider: kiểm tra trong workspace</span><button type="button" data-php-jump="php-privacy">Dữ liệu thuộc quyền kiểm soát của bạn ↗</button></div>

      <section id="php-command" class="php-section" tabindex="-1">${heading("01", "COMMAND CENTER", `Xin chào, ${escape(data.userName || "bạn")} <span class="php-greeting-star">✦</span>`, "Tiếp nối điều đang làm. Hoặc bắt đầu một ý tưởng mới.")}
        <div class="php-command-grid"><article class="php-panel php-launch"><span class="php-eyebrow">BẠN MUỐN BẮT ĐẦU TỪ ĐÂU?</span><div class="php-quick-grid">${quick.map((item) => link(item.route, `<i aria-hidden="true">${escape(item.icon)}</i><span>${escape(item.label)}</span><b aria-hidden="true">↗</b>`, "php-quick", `style="--php-accent:${item.accent}"`)).join("")}</div><button class="php-command-search" type="button" data-command-open><span>⌕ Tìm công cụ, dự án, hướng dẫn…</span><kbd>Ctrl / ⌘ K</kbd></button></article>
        <article class="php-panel"><span class="php-eyebrow">WORKSPACE GẦN ĐÂY</span><div data-php-recent></div></article>
        <article class="php-panel"><span class="php-eyebrow">GÓC LÀM VIỆC CỦA BẠN</span><div data-php-personal></div></article></div>
      </section>

      <section id="php-catalog" class="php-section" tabindex="-1">${heading("02", "EXPLORE YOUR PLATFORM", "Mọi công cụ. Một vũ trụ.", "Khám phá theo nhu cầu — mỗi lựa chọn là một workspace riêng.")}
        <div class="php-catalog-toolbar"><label class="php-search"><span aria-hidden="true">⌕</span><input type="search" data-php-search aria-label="Tìm chức năng Lớp 2" placeholder="Tìm tên, mô tả hoặc công cụ con…" autocomplete="off"><kbd>/</kbd></label><button type="button" data-php-favorites-filter aria-pressed="false">♡ Yêu thích</button></div>
        <div class="php-filters" role="group" aria-label="Lọc nhóm chức năng"><button type="button" data-php-filter="all" aria-pressed="true">Tất cả <b>${items.length}</b></button>${catalog.map((group) => `<button type="button" data-php-filter="${escape(group.id)}" aria-pressed="false" style="--php-accent:${group.accent}"><i></i>${escape(group.label)} <b>${group.items.length}</b></button>`).join("")}</div>
        <div class="php-result-row"><p data-php-results role="status" aria-live="polite"></p><span>Danh mục tự đồng bộ từ registry · Admin có khóa quyền</span></div>
        <div class="php-cards">${items.map((item) => cardMarkup(item, data.online !== false, list(data.favorites), list(data.pins))).join("")}</div>
        <div class="php-empty" data-php-no-results hidden><span>⌕</span><h3>Chưa tìm thấy chức năng phù hợp</h3><p>Thử từ khóa ngắn hơn, tên công cụ con hoặc bỏ bộ lọc.</p><button type="button" data-php-reset>Hiện tất cả chức năng</button></div>
      </section>

      <section class="php-section" id="php-paths">${heading("03", "START SOMETHING GREAT", "Bạn muốn làm gì hôm nay?", "Một lộ trình ngắn, những công cụ đúng việc. Bạn quyết định từng bước.")}
        <div class="php-recipes">${RECIPES.map(([id, label, note]) => `<button type="button" data-php-recipe="${id}" aria-pressed="false" aria-controls="php-recipe-steps"><span>${escape(label)}</span><small>${escape(note)}</small><b aria-hidden="true">↗</b></button>`).join("")}</div>
        <div id="php-recipe-steps" class="php-recipe-steps" aria-live="polite"><p>Chọn một mục tiêu để xem các bước gợi ý. Không có tác vụ nào tự chạy.</p></div>
      </section>

      <section class="php-section php-privacy" id="php-privacy" tabindex="-1"><div><span class="php-eyebrow">BUILT AROUND YOUR CONTROL</span><h2>Không gian của bạn.<br><em>Dữ liệu của bạn.</em></h2><p>Trang chủ chỉ đọc metadata cần thiết trên thiết bị. Không gọi AI, không xin microphone/camera và không gửi nội dung ra ngoài.</p>${link("/settings", "Quản lý dữ liệu & quyền riêng tư ↗", "php-secondary")}</div><div class="php-trust-grid">
        <article><i>01</i><h3>Local-first</h3><p>Yêu thích, ghim và gần đây dùng kho sidebar theo tài khoản. Dự án vẫn nằm trong workspace sở hữu nó.</p></article>
        <article><i>02</i><h3>Hai lớp độc lập</h3><p>Không đọc kho Galaxy Lớp 1. HH CORE giữ ranh giới truy cập và nút Về Galaxy đóng quyền của phiên.</p></article>
        <article><i>03</i><h3>Kết nối có chủ đích</h3><p>AI, realtime, upload và đồng bộ cần backend/provider. Trạng thái được kiểm tra trong từng workspace khi bạn sử dụng.</p></article>
        <article><i>04</i><h3>Không số liệu giả</h3><p>Không ghi analytics mới tại đây. Không tính bản mẫu thành dự án; không suy đoán người online, doanh thu hay tiến độ.</p></article>
      </div></section>
      <footer class="php-footer"><div><strong>HH<span>PLATFORM</span></strong><small>Vũ trụ công cụ số của bạn · ${escape(data.release || "Lớp 2")}</small></div><nav aria-label="Liên kết cuối trang">${link("/system", "Hệ thống")}${link("/settings", "Quyền riêng tư")}${link("/copyright", "Bản quyền")}${link("/support", "Trợ giúp & ủng hộ")}<button type="button" data-hh-core-exit>← Về HH Galaxy</button></nav></footer>
      <p class="php-toast" data-php-toast role="status" aria-live="polite" hidden></p>
    </div>`;
  }

  let current = null;
  function unmount() {
    if (!current) return;
    current.cleanup.forEach((remove) => remove());
    current = null;
  }

  function mount(host, options = {}) {
    unmount();
    if (!host || !global.document) return false;
    const catalog = buildCatalog(options.sections, options.groups, options);
    if (!catalog.length) return false;
    const items = catalog.flatMap((section) => section.items);
    const allowed = new Set(items.filter((item) => !item.locked).flatMap((item) => [item.route, ...item.children.map((child) => child.route)]));
    ["/chat-ai", "/settings", "/system", "/copyright", "/support"].forEach((route) => allowed.add(route));
    const state = { query: "", section: "all", favoritesOnly: false, favorites: list(options.getFavorites?.()), pins: list(options.getPins?.()) };
    const runtime = { host, cleanup: [] };
    current = runtime;
    host.innerHTML = markup(catalog, { userName: options.user?.name || options.user?.nickname, online: global.navigator?.onLine, favorites: state.favorites, pins: state.pins, release: options.release });
    const root = host.querySelector("[data-platform-home]");
    const on = (target, type, handler, config) => { target?.addEventListener?.(type, handler, config); runtime.cleanup.push(() => target?.removeEventListener?.(type, handler, config)); };
    const notify = (text) => { const node = root.querySelector("[data-php-toast]"); node.hidden = false; node.textContent = text; };
    const reduced = global.matchMedia?.("(prefers-reduced-motion: reduce)");
    let cosmos = null;
    const settings = () => {
      try { return JSON.parse(options.storage?.getItem("hh.settings-studio.v1") || "null")?.settings || {}; } catch { return {}; }
    };
    const motion = () => {
      const prefs = settings();
      const weak = global.navigator?.connection?.saveData || (global.navigator?.deviceMemory && global.navigator.deviceMemory <= 4) || (global.navigator?.hardwareConcurrency && global.navigator.hardwareConcurrency <= 4);
      root.dataset.motion = reduced?.matches || prefs.accessibility?.reducedMotion || prefs.motion?.level === "static" || global.document.body.classList.contains("app-reduce-motion") || weak ? "static" : "balanced";
      root.dataset.contrast = prefs.accessibility?.highContrast || global.document.body.dataset.appContrast === "high" ? "high" : "standard";
      root.dataset.paused = String(global.document.hidden);
      cosmos?.sync?.();
    };
    const jump = (id) => {
      const node = root.querySelector(`#${id}`), scroller = root.closest(".app-main");
      if (!node) return;
      const behavior = root.dataset.motion === "static" ? "auto" : "smooth";
      if (scroller) scroller.scrollTo({ top: scroller.scrollTop + node.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 24, behavior });
      else node.scrollIntoView({ behavior, block: "start" });
      node.focus({ preventScroll: true });
    };
    const navigate = (route) => {
      if (!allowed.has(route) || !safeRoute(route)) return notify("Điểm đến không thuộc danh mục được phép của Lớp 2.");
      if ((route === "/admin" || route.startsWith("/admin/")) && options.isAdmin?.() !== true) return notify("Tài khoản chưa có quyền Admin.");
      options.navigate?.(route);
    };
    const updateFilter = () => {
      const matches = filterCatalog(catalog, state.query, state.section, state.favoritesOnly, state.favorites);
      const routes = new Set(matches.map((item) => item.route));
      root.querySelectorAll("[data-php-card]").forEach((node) => { node.hidden = !routes.has(node.dataset.phpCard); });
      root.querySelectorAll("[data-php-filter]").forEach((node) => node.setAttribute("aria-pressed", String(node.dataset.phpFilter === state.section)));
      root.querySelector("[data-php-favorites-filter]").setAttribute("aria-pressed", String(state.favoritesOnly));
      root.querySelector("[data-php-results]").textContent = `${matches.length} / ${items.length} chức năng${matches.some((item) => item.locked) ? " · Admin cần quyền riêng" : ""}`;
      root.querySelector("[data-php-no-results]").hidden = matches.length !== 0;
    };
    const personal = () => {
      state.favorites = list(options.getFavorites?.()); state.pins = list(options.getPins?.());
      const recent = list(options.getRecent?.()).map((route) => items.find((item) => item.route === route && !item.locked)).filter(Boolean).slice(0, 4);
      root.querySelector("[data-php-recent]").innerHTML = recent.length ? recent.map((item) => link(item.route, `<i aria-hidden="true">${escape(item.icon)}</i><span>${escape(item.label)}</span><b aria-hidden="true">↗</b>`, "php-recent-link")).join("") : '<div class="php-small-empty"><span>◌</span><strong>Hành trình bắt đầu từ đây</strong><p>Mở một workspace để tiếp tục nhanh ở lần sau.</p></div>';
      const favorites = items.filter((item) => !item.locked && state.favorites.includes(item.route));
      const snapshot = readProjectSummaries(options.storage);
      root.querySelector("[data-php-personal]").innerHTML = `<div class="php-personal-favorites"><small>${favorites.length} chức năng yêu thích</small>${favorites.slice(0, 4).map((item) => link(item.route, escape(item.label))).join("") || '<p>Chạm ♡ trên một thẻ để lưu vào đây.</p>'}</div><div class="php-projects"><small>Dự án Creative OS · trên thiết bị</small>${snapshot.projects.map((project) => link("/create", escape(project.title), "php-project-link", 'title="Mở Sáng tạo để chọn dự án"')).join("") || `<p>${snapshot.status === "error" ? "Chưa đọc được metadata dự án. Dữ liệu gốc không bị thay đổi." : "Chưa có dự án đã lưu trong kho này."}</p>`}</div>`;
      root.querySelectorAll("[data-php-favorite], [data-php-pin]").forEach((node) => {
        const favorite = node.hasAttribute("data-php-favorite"), active = (favorite ? state.favorites : state.pins).includes(favorite ? node.dataset.phpFavorite : node.dataset.phpPin);
        node.setAttribute("aria-pressed", String(active)); node.textContent = favorite ? (active ? "♥" : "♡") : (active ? "★" : "☆");
      });
      updateFilter();
    };
    const status = () => {
      const online = global.navigator?.onLine;
      root.querySelector("[data-php-network]").textContent = online === false ? "◌ Trình duyệt ngoại tuyến" : online === true ? "● Trình duyệt có mạng" : "◌ Chưa xác định mạng";
      let accessible = false;
      try { accessible = !!options.storage && options.storage.getItem("hh.settings-studio.v1") !== undefined; } catch { /* Read-only probe; no storage mutation. */ }
      root.querySelector("[data-php-storage]").textContent = accessible ? "▣ Có thể đọc kho trên thiết bị" : "▣ Kho trên thiết bị không khả dụng";
      root.querySelectorAll("[data-php-card]").forEach((node) => {
        const item = items.find((entry) => entry.route === node.dataset.phpCard), badge = node.querySelector(".php-badge"), value = capability(item, online);
        badge.textContent = value.label; badge.title = value.detail;
      });
    };
    on(root, "input", (event) => { if (event.target.matches("[data-php-search]")) { state.query = event.target.value; updateFilter(); } });
    on(root, "click", (event) => {
      const control = event.target.closest("button, a"); if (!control || !root.contains(control)) return;
      if (control.hasAttribute("data-php-route")) { event.preventDefault(); navigate(control.dataset.phpRoute); }
      else if (control.hasAttribute("data-php-jump")) { event.preventDefault(); jump(control.dataset.phpJump); }
      else if (control.hasAttribute("data-php-filter") || control.hasAttribute("data-php-group-jump")) {
        state.section = control.dataset.phpFilter || control.dataset.phpGroupJump;
        if (control.hasAttribute("data-php-group-jump")) { state.query = ""; state.favoritesOnly = false; root.querySelector("[data-php-search]").value = ""; jump("php-catalog"); }
        updateFilter();
      } else if (control.hasAttribute("data-php-favorites-filter")) { state.favoritesOnly = !state.favoritesOnly; updateFilter(); }
      else if (control.hasAttribute("data-php-reset")) { state.query = ""; state.section = "all"; state.favoritesOnly = false; root.querySelector("[data-php-search]").value = ""; updateFilter(); root.querySelector("[data-php-search]").focus(); }
      else if (control.hasAttribute("data-php-favorite") || control.hasAttribute("data-php-pin")) {
        const favorite = control.hasAttribute("data-php-favorite"), route = favorite ? control.dataset.phpFavorite : control.dataset.phpPin;
        if (!allowed.has(route)) return;
        try {
          const result = favorite ? options.toggleFavorite?.(route) : options.togglePin?.(route);
          if (result === false || result === undefined) notify("Chưa lưu được. Ghim tối đa 5 mục; hãy kiểm tra quyền lưu trữ.");
          else notify(favorite ? "Đã cập nhật yêu thích trên thiết bị." : "Đã cập nhật ghim trong sidebar.");
        } catch { notify("Trình duyệt không cho phép lưu thay đổi. Dữ liệu cũ được giữ nguyên."); }
        personal();
      } else if (control.hasAttribute("data-php-recipe")) {
        const recipe = RECIPES.find(([id]) => id === control.dataset.phpRecipe); if (!recipe) return;
        const steps = recipe[3].map((id) => items.find((item) => item.id === id && !item.locked)).filter(Boolean);
        root.querySelectorAll("[data-php-recipe]").forEach((button) => button.setAttribute("aria-pressed", String(button === control)));
        root.querySelector("#php-recipe-steps").innerHTML = `<h3>Lộ trình: ${escape(recipe[1])}</h3><ol>${steps.map((item, index) => `<li>${link(item.route, `<b>${String(index + 1).padStart(2, "0")}</b><span>${escape(item.label)}</span><i aria-hidden="true">↗</i>`)}</li>`).join("")}</ol><p>Các bước là gợi ý điều hướng; không tự gọi provider, tạo dự án hay xuất bản.</p>`;
      }
    });
    on(global.document, "keydown", (event) => {
      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest?.("input, textarea, select, [contenteditable=true]")) { event.preventDefault(); event.stopPropagation(); jump("php-catalog"); root.querySelector("[data-php-search]").focus(); }
    }, true);
    on(global, "online", status); on(global, "offline", status);
    on(global, "hh:settings-saved", () => { motion(); personal(); });
    on(global, "hh:preferences-change", motion);
    on(global, "hh:workspace-settings-applied", motion);
    on(global, "storage", (event) => { if (event.key?.startsWith("hh.sidebar.") || event.key === "hh.creative-os.v1") personal(); if (event.key === "hh.settings-studio.v1") motion(); });
    on(global.document, "visibilitychange", motion); on(reduced, "change", motion);
    on(global, "hashchange", () => { if ((global.location.hash || "").split("?")[0] !== `#${ROUTE}`) unmount(); });
    motion(); personal(); status();
    cosmos = global.HHHomeCosmosMotion?.mount?.(root, { stage: root.querySelector(".php-hero"), variant: "platform", center: ".php-core", mode: () => root.dataset.motion });
    runtime.cleanup.push(() => cosmos?.destroy?.());
    root.querySelector("#php-title").focus({ preventScroll: true });
    return true;
  }

  return Object.freeze({ version: 1, route: ROUTE, buildCatalog, filterCatalog, capability, readProjectSummaries, markup, mount, unmount, recipes: RECIPES });
});
