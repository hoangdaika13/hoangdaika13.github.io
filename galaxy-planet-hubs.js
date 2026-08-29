(function galaxyPlanetHubsBootstrap(global, factory) {
  "use strict";

  var api = factory(global || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (global) global.HHGalaxyPlanetHubs = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function galaxyPlanetHubsFactory(global) {
  "use strict";

  /**
   * The Planet Hubs are intentionally a small, dependency-free adapter.  The
   * shell can load this file lazily and hand it any router/data provider.  No
   * demo counters are generated here: capability labels are either supplied
   * by the host or remain explicitly unconfigured.
   */
  var VERSION = "1.0.0";
  var mounted = new Set();

  var SIDEBAR_ITEMS = Object.freeze([
    { id: "home", label: "Trang chủ", icon: "⌂", route: "/home" },
    { id: "ai", label: "AI Universe", icon: "✦", route: "/galaxy/ai" },
    { id: "music", label: "Music Planet", icon: "♫", route: "/galaxy/music" },
    { id: "video", label: "Video Planet", icon: "▣", route: "/galaxy/video" },
    { id: "creator", label: "Creator Studio", icon: "✧", route: "/galaxy/creator" },
    { id: "games", label: "Games World", icon: "⌁", route: "/galaxy/games" },
    { id: "dev", label: "Dev Planet", icon: "</>", route: "/galaxy/dev" },
    { id: "learning", label: "Learning Star", icon: "◇", route: "/galaxy/learning" },
    { id: "community", label: "Community", icon: "♧", route: "/galaxy/community" },
    { id: "tools", label: "Tools Galaxy", icon: "⌘", route: "/galaxy/tools" },
    { id: "analytics", label: "Analytics", icon: "▥", route: "/galaxy/analytics" },
    { id: "settings", label: "Cài đặt", icon: "⚙", route: "/galaxy/settings" }
  ]);

  var HUBS = Object.freeze({
    "/galaxy/ai": Object.freeze({
      id: "ai", label: "AI Universe", eyebrow: "AI UNIVERSE", icon: "✦", accent: "#b275ff", accent2: "#5b9cff",
      title: "Một vũ trụ cho mọi tác vụ AI", description: "Mở đúng công cụ cho hội thoại, prompt, hình ảnh và trung tâm AI của HH.",
      cards: Object.freeze([
        card("chat", "HH AI Copilot", "Hỏi đáp, lập kế hoạch và làm việc với hội thoại", "✦", "/chat-ai", "local", ["chat", "assistant"]),
        card("center", "AI Center", "Điều phối các tác vụ AI trong một workspace", "AI", "/create/ai-center", "local", ["workspace", "orchestration"]),
        card("prompt", "Prompt Studio", "Tạo prompt có cấu trúc, phiên bản và biến đầu vào", "⌘", "/create/prompt-studio", "local", ["prompt", "template"]),
        card("image", "AI Task Center", "Quản lý tác vụ hình ảnh và trạng thái provider", "▧", "/media-design/ai-task-center", "provider", ["image", "provider"])
      ])
    }),
    "/galaxy/music": Object.freeze({
      id: "music", label: "Music Planet", eyebrow: "MUSIC PLANET", icon: "♫", accent: "#ec6dff", accent2: "#6e7bff",
      title: "Xưởng âm thanh trong quỹ đạo HH", description: "Từ phòng ambient đến sản xuất nhạc AI, mỗi lối vào giữ một vai trò riêng.",
      cards: Object.freeze([
        card("ambient", "Ambient Room", "Mixer Web Audio, scene tập trung và Pomodoro", "◌", "/music/ambient", "local", ["focus", "audio"]),
        card("studio", "Music AI Studio", "Sáng tác, phối khí và xuất bản với engine nhạc", "♫", "/music-ai", "provider", ["music", "studio"]),
        card("library", "Nhạc", "Thư viện nhạc có nguồn và điều kiện giấy phép rõ ràng", "▤", "/music", "content", ["library", "license"])
      ])
    }),
    "/galaxy/video": Object.freeze({
      id: "video", label: "Video Planet", eyebrow: "VIDEO PLANET", icon: "▣", accent: "#ff9b61", accent2: "#ff5fc3",
      title: "Trạm dựng hình ảnh và chuyển động", description: "Chọn một engine video, xem phim hợp pháp hoặc mở không gian YouTube bên trong HH.",
      cards: Object.freeze([
        card("resolve", "HH Video Studio", "Media Pool, timeline, màu, audio, phụ đề và xuất video", "▣", "/davinci-resolve", "local", ["edit", "timeline"]),
        card("youtube", "YouTube Creator Galaxy", "Player và các workspace YouTube dùng API chính thức", "▶", "/youtube", "provider", ["youtube", "api"]),
        card("cinema", "Phim", "Kho phim công cộng và Creative Commons đã kiểm tra nguồn", "◉", "/cinema", "content", ["cinema", "licensed"])
      ])
    }),
    "/galaxy/creator": Object.freeze({
      id: "creator", label: "Creator Studio", eyebrow: "CREATOR STUDIO", icon: "✧", accent: "#d874ff", accent2: "#6b8cff",
      title: "Dòng chảy sáng tạo từ ý tưởng tới xuất bản", description: "Mỗi công cụ là một điểm đến độc lập; dữ liệu chỉ kết nối khi engine đích hỗ trợ.",
      cards: Object.freeze([
        card("workflow", "Creator Workflow", "Xây pipeline ý tưởng, script, media, voice và publish", "✧", "/create/workflow", "local", ["pipeline", "creator"]),
        card("projects", "Project Hub", "Quản lý dự án, file, phiên bản và tài nguyên", "▣", "/galaxy/project-hub", "local", ["project", "vault"]),
        card("automation", "Automation Builder", "Thiết kế luồng tự động và chạy thử có kiểm soát", "⌘", "/galaxy/automation-builder", "provider", ["automation", "workflow"])
      ])
    }),
    "/galaxy/games": Object.freeze({
      id: "games", label: "Games World", eyebrow: "GAMES WORLD", icon: "⌁", accent: "#69e7ff", accent2: "#bb6cff",
      title: "Các thế giới tương tác của HH", description: "Chọn một trò chơi hoặc trải nghiệm giải trí; trạng thái tải được báo rõ theo engine.",
      cards: Object.freeze([
        card("play", "HH Play", "Kho trò chơi và trải nghiệm tương tác", "⌁", "/play", "local", ["games", "play"]),
        card("eonwild", "EonWild", "Sinh tồn động vật, bản đồ theo kỷ nguyên và hệ sinh thái", "◈", "/game", "local", ["survival", "wildlife"]),
        card("comics", "HH Comics", "Tìm, theo dõi và đọc truyện trong reader một trang", "▤", "/comic-reader", "content", ["reader", "comics"])
      ])
    }),
    "/galaxy/dev": Object.freeze({
      id: "dev", label: "Dev Planet", eyebrow: "DEV PLANET", icon: "</>", accent: "#62eab7", accent2: "#57a6ff",
      title: "Bộ công cụ DEV có điểm đến rõ ràng", description: "Mở Developer Galaxy hoặc một workspace chuyên sâu. Công cụ cần backend sẽ hiển thị yêu cầu cấu hình.",
      cards: Object.freeze([
        card("dev", "Developer Galaxy", "Tổng quan code, API, dữ liệu, Git và observability", "</>", "/dev-tools", "local", ["developer", "hub"]),
        card("code", "Code Nebula", "Editor, sandbox, preview và kiểm thử code", "CN", "/dev-tools/code-nebula", "local", ["code", "sandbox"]),
        card("api", "API Pulsar", "REST, GraphQL, WebSocket, mock và monitor", "AP", "/dev-tools/api-pulsar", "provider", ["api", "realtime"]),
        card("data", "Data Core", "JSON, SQL, schema và migration", "DC", "/dev-tools/data-core", "local", ["data", "schema"]),
        card("git", "Git Orbit", "Branch, commit, diff, merge và cộng tác", "GO", "/dev-tools/git-orbit", "provider", ["git", "delivery"]),
        card("security", "Security Shield", "Secret, crypto, dependency và policy", "SS", "/dev-tools/security-shield", "local", ["security", "policy"]),
        card("observe", "Observability Radar", "Logs, traces, Web Vitals và incident", "OR", "/dev-tools/observability-radar", "provider", ["observability", "monitor"])
      ])
    }),
    "/galaxy/learning": Object.freeze({
      id: "learning", label: "Learning Star", eyebrow: "LEARNING STAR", icon: "◇", accent: "#ffcf65", accent2: "#5fd4ff",
      title: "Trạm học tập và ngôn ngữ", description: "Đi thẳng tới lớp học, từ điển hoặc lộ trình ngôn ngữ phù hợp với mục tiêu của bạn.",
      cards: Object.freeze([
        card("learn", "Học tập", "Trung tâm bài học, tiến độ và ôn tập", "◇", "/learn", "local", ["learning", "progress"]),
        card("english", "HH English", "CEFR, từ vựng, nói, viết và lộ trình nghề nghiệp", "E", "/english", "local", ["english", "cefr"]),
        card("japanese", "HH Japanese", "Kanji, ngữ pháp, đọc hiểu và luyện JLPT", "日", "/japanese", "local", ["japanese", "jlpt"]),
        card("chinese", "HH Chinese", "Pinyin, thanh điệu, chữ Hán và hội thoại", "中", "/chinese", "local", ["chinese", "pinyin"]),
        card("dharma", "Phật Pháp", "Kinh văn, giáo lý, thực hành và thư viện nghe", "法", "/phat-phap", "content", ["dharma", "scripture"])
      ])
    }),
    "/galaxy/community": Object.freeze({
      id: "community", label: "Community", eyebrow: "COMMUNITY", icon: "♧", accent: "#5ce8be", accent2: "#68a9ff",
      title: "Không gian kết nối có kiểm soát", description: "Mỗi kênh giao tiếp mở đúng engine; quyền riêng tư và trạng thái realtime không bị giả lập.",
      cards: Object.freeze([
        card("community", "Community", "Bảng tin, bài đăng và hoạt động cộng đồng", "♧", "/communication/community", "provider", ["feed", "realtime"]),
        card("messenger", "Messenger", "Nhắn tin riêng, trạng thái và lịch sử cuộc trò chuyện", "✉", "/communication/messenger", "provider", ["messenger", "realtime"]),
        card("channels", "Channels", "Kênh thảo luận theo chủ đề và quyền truy cập", "#", "/communication/channels", "provider", ["channels", "moderation"]),
        card("live", "Live Room", "Phòng trực tiếp, âm thanh và cuộc gọi", "◉", "/communication/live-room", "provider", ["live", "voice"])
      ])
    }),
    "/galaxy/tools": Object.freeze({
      id: "tools", label: "Tools Galaxy", eyebrow: "TOOLS GALAXY", icon: "⌘", accent: "#a779ff", accent2: "#54d9ff",
      title: "Kho công cụ và workspace dùng hằng ngày", description: "Tập trung các điểm đến vận hành, dự án, automation, desktop và khám phá vũ trụ.",
      cards: Object.freeze([
        card("projects", "Project Hub", "Dự án, task, file và phiên bản", "▣", "/galaxy/project-hub", "local", ["project", "tasks"]),
        card("automation", "Automation Builder", "Luồng tự động, approval và lịch chạy", "⌘", "/galaxy/automation-builder", "provider", ["automation", "jobs"]),
        card("desktop", "HH Web Desktop", "Không gian đa nhiệm tùy chọn trong trình duyệt", "▦", "/system/desktop", "local", ["desktop", "workspace"]),
        card("universe", "Vũ trụ", "Bầu trời, hệ mặt trời 3D và dữ liệu thiên văn", "✺", "/universe", "provider", ["astronomy", "3d"])
      ])
    }),
    "/galaxy/analytics": Object.freeze({
      id: "analytics", label: "Analytics", eyebrow: "ANALYTICS", icon: "▥", accent: "#ffba6b", accent2: "#7b83ff",
      title: "Đọc dữ liệu thật, không số liệu minh họa", description: "Mở trung tâm phân tích để xem dữ liệu trình duyệt, hoạt động local và các API đã được cấu hình.",
      cards: Object.freeze([
        card("analytics", "Analytics Center", "Traffic cục bộ, hiệu suất và hoạt động module", "▥", "/analytics", "local", ["analytics", "metrics"])
      ])
    }),
    "/galaxy/settings": Object.freeze({
      id: "settings", label: "Cài đặt", eyebrow: "SETTINGS", icon: "⚙", accent: "#9aa8ff", accent2: "#62e7d4",
      title: "Cấu hình HH theo cách bạn làm việc", description: "Kiểm soát tài khoản, bảo mật và tùy chọn giao diện. Dữ liệu nhạy cảm luôn do engine đích xử lý.",
      cards: Object.freeze([
        card("account", "Tài khoản", "Hồ sơ, phiên đăng nhập và tùy chọn cá nhân", "◎", "/settings/account", "provider", ["account", "profile"]),
        card("security", "Security Center", "Phiên, thiết bị và chính sách bảo mật", "◇", "/settings/security-center", "provider", ["security", "privacy"]),
        card("settings", "Cài đặt nền tảng", "Giao diện, thông báo, dữ liệu và trợ năng", "⚙", "/settings", "local", ["preferences", "accessibility"])
      ])
    })
  });

  var routes = Object.freeze(Object.keys(HUBS));

  function card(id, title, description, icon, route, capability, tags) {
    return Object.freeze({ id: id, title: title, description: description, icon: icon, route: route, capability: capability, tags: Object.freeze(tags || []) });
  }

  function normalizeRoute(value) {
    var raw = String(value == null ? "/galaxy/ai" : value).trim();
    raw = raw.replace(/^#/, "").split("?")[0].split(";")[0];
    if (!raw) raw = "/galaxy/ai";
    if (raw.charAt(0) !== "/") raw = "/" + raw;
    return raw.length > 1 ? raw.replace(/\/+$/, "") : raw;
  }

  function canHandle(route) {
    return routes.indexOf(normalizeRoute(route)) !== -1;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function asObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function readCapability(data, item) {
    var source = asObject(data);
    var capabilities = asObject(source.capabilities || source.capability);
    var value = capabilities[item.route] || capabilities[item.id] || capabilities[item.capability];
    if (value && typeof value === "object") value = value.status || value.state;
    value = String(value || "").toLowerCase();
    if (["ready", "available", "online", "connected", "configured"].indexOf(value) !== -1) return "ready";
    if (["offline", "unavailable", "error"].indexOf(value) !== -1) return "offline";
    if (["loading", "checking"].indexOf(value) !== -1) return "checking";
    if (item.capability === "provider") return "needs-config";
    return "ready-to-open";
  }

  function capabilityText(status) {
    return ({
      ready: "Sẵn sàng",
      "ready-to-open": "Mở engine nội bộ",
      "needs-config": "Cần cấu hình nếu dùng API",
      checking: "Đang kiểm tra",
      offline: "Đang ngoại tuyến"
    })[status] || "Chưa xác định";
  }

  function capabilityClass(status) {
    return status === "needs-config" ? "is-config" : status === "offline" ? "is-offline" : status === "checking" ? "is-checking" : "is-ready";
  }

  function currentHub(route) {
    return HUBS[normalizeRoute(route)] || HUBS[routes[0]];
  }

  function safeNavigate(runtime, route) {
    var target = normalizeRoute(route);
    if (!target) return false;
    var navigate = runtime.options && runtime.options.navigate;
    if (typeof navigate !== "function") {
      navigate = global.HHRouter && (global.HHRouter.navigate || global.HHRouter.go);
    }
    if (typeof navigate !== "function") navigate = global.navigateTo || global.handleAppRoute;
    if (typeof navigate === "function") {
      try { navigate(target, { source: "galaxy-planet-hubs" }); return true; } catch (error) { /* fall through to hash navigation */ }
    }
    try {
      if (global.location) {
        global.location.hash = "#" + target;
        return true;
      }
    } catch (error) { /* a restricted test location is allowed */ }
    return false;
  }

  function markup(route, data) {
    var hub = currentHub(route);
    var source = asObject(data);
    var account = asObject(source.account);
    var displayName = String(account.name || account.displayName || "HH Core").trim().slice(0, 64) || "HH Core";
    var nav = SIDEBAR_ITEMS.map(function (item) {
      // Hub definitions intentionally stay immutable and do not need a
      // duplicate `route` field. Derive the active key from the canonical
      // `/galaxy/<id>` path so a missing/undefined hub.route can never make
      // the active state disappear.
      var active = item.route === route || (item.id !== "home" && item.route === "/galaxy/" + hub.id);
      var current = active ? ' aria-current="page"' : "";
      return '<button type="button" class="ghph-nav-item' + (active ? ' is-active' : '') + '" data-ghph-nav-item="' + escapeHtml(item.id) + '" data-ghph-nav-route="' + escapeHtml(item.route) + '"' + current + '><span class="ghph-nav-icon" aria-hidden="true">' + escapeHtml(item.icon) + '</span><span>' + escapeHtml(item.label) + '</span></button>';
    }).join("");
    var cards = hub.cards.map(function (item) {
      var status = readCapability(source, item);
      var search = (item.title + " " + item.description + " " + item.tags.join(" ")).toLowerCase();
      return '<article class="ghph-card ' + capabilityClass(status) + '" data-ghph-card data-ghph-card-id="' + escapeHtml(item.id) + '" data-ghph-route="' + escapeHtml(item.route) + '" data-ghph-capability="' + escapeHtml(item.capability) + '" data-ghph-status="' + status + '" data-ghph-search="' + escapeHtml(search) + '"><div class="ghph-card-top"><span class="ghph-card-icon" aria-hidden="true">' + escapeHtml(item.icon) + '</span><span class="ghph-capability ' + capabilityClass(status) + '"><i aria-hidden="true"></i>' + escapeHtml(capabilityText(status)) + '</span></div><h3>' + escapeHtml(item.title) + '</h3><p>' + escapeHtml(item.description) + '</p><div class="ghph-card-footer"><span class="ghph-route-label">' + escapeHtml(item.route) + '</span><button type="button" class="ghph-open" data-ghph-open-route="' + escapeHtml(item.route) + '" data-ghph-route="' + escapeHtml(item.route) + '">Mở <span aria-hidden="true">→</span></button></div></article>';
    }).join("");
    return '<section class="ghph-app" data-ghph-root data-ghph-route="' + escapeHtml(route) + '" style="--ghph-accent:' + escapeHtml(hub.accent) + ';--ghph-accent-2:' + escapeHtml(hub.accent2) + '" aria-label="' + escapeHtml(hub.label) + '"><header class="ghph-topbar"><button type="button" class="ghph-mobile-toggle" data-ghph-toggle aria-expanded="false" aria-controls="ghph-sidebar"><span aria-hidden="true">☰</span><span class="ghph-visually-hidden">Mở menu</span></button><button type="button" class="ghph-brand" data-ghph-nav-route="/home"><span class="ghph-brand-mark" aria-hidden="true">HH</span><span class="ghph-brand-copy"><strong>HOANG8.COM</strong><small>HH GALAXY</small></span></button><label class="ghph-global-search" aria-label="Tìm trong HH Galaxy"><span aria-hidden="true">⌕</span><input type="search" data-ghph-search placeholder="Tìm công cụ, chức năng, dự án..." autocomplete="off"><kbd>Ctrl K</kbd></label><div class="ghph-top-actions"><span class="ghph-online is-local"><i aria-hidden="true"></i><span>HH CORE</span><b>Local-first</b></span><button type="button" class="ghph-icon-button" data-ghph-top-action="theme" aria-label="Đổi giao diện">◐</button><button type="button" class="ghph-icon-button" data-ghph-top-action="help" aria-label="Trợ giúp">?</button><button type="button" class="ghph-user"><span class="ghph-user-avatar" aria-hidden="true">' + escapeHtml(displayName.slice(0, 1).toUpperCase()) + '</span><span>' + escapeHtml(displayName) + '</span><span aria-hidden="true">⌄</span></button></div></header><div class="ghph-body"><aside id="ghph-sidebar" class="ghph-sidebar" data-ghph-sidebar aria-label="Điều hướng HH Galaxy"><div class="ghph-sidebar-search"><label aria-label="Tìm chức năng"><span aria-hidden="true">⌕</span><input type="search" data-ghph-sidebar-search placeholder="Tìm chức năng..." autocomplete="off"></label><small>12 chức năng</small></div><nav class="ghph-nav" data-ghph-nav>' + nav + '</nav><div class="ghph-sidebar-footer"><div class="ghph-core-card"><span class="ghph-core-orbit" aria-hidden="true">✦</span><div><strong>HH Core</strong><small>Không gian trung tâm</small></div><button type="button" data-ghph-nav-route="/home/dashboard" aria-label="Mở HH Core">→</button></div><small class="ghph-build-label">HH Galaxy · capability-first</small></div></aside><main class="ghph-main" data-ghph-main tabindex="-1"><div class="ghph-breadcrumb"><button type="button" data-ghph-nav-route="/home">Trang chủ</button><span aria-hidden="true">/</span><span>' + escapeHtml(hub.label) + '</span></div><header class="ghph-hero"><div class="ghph-hero-icon" aria-hidden="true">' + escapeHtml(hub.icon) + '</div><div><p class="ghph-eyebrow">' + escapeHtml(hub.eyebrow) + '</p><h1>' + escapeHtml(hub.title) + '</h1><p>' + escapeHtml(hub.description) + '</p></div><div class="ghph-hero-actions"><button type="button" class="ghph-quiet-button" data-ghph-refresh>↻ Làm mới</button><button type="button" class="ghph-primary-button" data-ghph-nav-route="/home/dashboard">HH Core <span aria-hidden="true">→</span></button></div></header><section class="ghph-toolbar" aria-label="Lọc chức năng"><div class="ghph-toolbar-title"><strong>Điểm đến của ' + escapeHtml(hub.label) + '</strong><span data-ghph-result-count aria-live="polite">' + hub.cards.length + ' chức năng</span></div><div class="ghph-filters"><label class="ghph-filter-search" aria-label="Lọc trong mục này"><span aria-hidden="true">⌕</span><input type="search" data-ghph-card-search placeholder="Lọc trong mục này..." autocomplete="off"></label><label class="ghph-filter-select"><span class="ghph-visually-hidden">Trạng thái</span><select data-ghph-status-filter aria-label="Lọc theo trạng thái"><option value="all">Tất cả trạng thái</option><option value="ready">Sẵn sàng</option><option value="ready-to-open">Mở engine nội bộ</option><option value="needs-config">Cần cấu hình</option><option value="offline">Ngoại tuyến</option></select></label></div></section><div class="ghph-card-grid" data-ghph-card-grid>' + cards + '</div><div class="ghph-empty" data-ghph-empty hidden><span aria-hidden="true">⌕</span><strong>Không tìm thấy điểm đến</strong><p>Thử từ khóa khác hoặc chọn lại bộ lọc.</p><button type="button" data-ghph-clear-filter>Xóa bộ lọc</button></div><footer class="ghph-main-footer"><span><i aria-hidden="true"></i> Chỉ hiển thị capability do engine cung cấp</span><span>HH Galaxy Planet Hubs · v' + escapeHtml(VERSION) + '</span></footer></main></div></section>';
  }

  function eventTarget(event) {
    return event && (event.target || event.srcElement);
  }

  function closest(target, selector, root) {
    if (!target) return null;
    var node = target;
    while (node && node !== root) {
      if (node.matches && node.matches(selector)) return node;
      node = node.parentNode;
    }
    return root && root.matches && root.matches(selector) ? root : null;
  }

  function bind(runtime) {
    var root = runtime.root;
    var signal = runtime.controller && runtime.controller.signal;
    var listeners = runtime.listeners;
    function on(target, type, handler, options) {
      if (!target || typeof target.addEventListener !== "function") return;
      var opts = options || {};
      if (signal && typeof signal === "object") opts.signal = signal;
      try { target.addEventListener(type, handler, opts); } catch (error) { target.addEventListener(type, handler); listeners.push([target, type, handler, opts]); }
    }
    on(root, "click", function (event) {
      var target = eventTarget(event);
      var routeButton = closest(target, "[data-ghph-nav-route], [data-ghph-open-route]", root);
      if (routeButton) {
        event.preventDefault && event.preventDefault();
        var route = routeButton.getAttribute("data-ghph-nav-route") || routeButton.getAttribute("data-ghph-open-route");
        if (route) safeNavigate(runtime, route);
        if (routeButton.hasAttribute && routeButton.hasAttribute("data-ghph-nav-route") && root.classList && root.classList.contains("is-menu-open")) toggleMenu(runtime, false);
        return;
      }
      if (closest(target, "[data-ghph-toggle]", root)) { toggleMenu(runtime); return; }
      if (closest(target, "[data-ghph-refresh]", root)) { resetFilters(runtime); return; }
      if (closest(target, ".ghph-user", root)) { safeNavigate(runtime, "/settings/account"); return; }
      var topAction = closest(target, "[data-ghph-top-action]", root);
      if (topAction) {
        var action = topAction.getAttribute("data-ghph-top-action");
        if (action === "theme" && root.classList) {
          var dim = root.classList.toggle("is-dim");
          topAction.setAttribute("aria-pressed", String(dim));
        }
        if (action === "help") {
          safeNavigate(runtime, "/support");
        }
        return;
      }
      if (closest(target, "[data-ghph-clear-filter]", root)) {
        resetFilters(runtime);
      }
    });
    on(root, "input", function (event) {
      var target = eventTarget(event);
      if (target && target.matches && target.matches("[data-ghph-search]")) {
        var localSearch = root.querySelector && root.querySelector("[data-ghph-card-search]");
        if (localSearch && localSearch.value !== target.value) localSearch.value = target.value;
      }
      if (target && target.matches && target.matches("[data-ghph-card-search]")) {
        var headerSearch = root.querySelector && root.querySelector("[data-ghph-search]");
        if (headerSearch && headerSearch.value !== target.value) headerSearch.value = target.value;
      }
      if (target && target.matches && (target.matches("[data-ghph-search]") || target.matches("[data-ghph-card-search]") || target.matches("[data-ghph-sidebar-search]"))) applyFilters(runtime);
    });
    on(root, "change", function (event) {
      var target = eventTarget(event);
      if (target && target.matches && target.matches("[data-ghph-status-filter]")) applyFilters(runtime);
    });
    on(root, "keydown", function (event) {
      var target = eventTarget(event);
      var typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      if (event.key === "Escape" && !typing) toggleMenu(runtime, false);
      if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === "k") {
        event.preventDefault && event.preventDefault();
        var search = root.querySelector && root.querySelector("[data-ghph-search]");
        if (search && typeof search.focus === "function") search.focus();
      }
      if (event.key === "Escape" && typing && target && target.matches && target.matches("[data-ghph-search], [data-ghph-card-search]")) {
        target.value = "";
        applyFilters(runtime);
      }
    });
    var doc = root.ownerDocument || global.document;
    on(doc, "click", function (event) {
      if (!root.classList || !root.classList.contains("is-menu-open")) return;
      var target = eventTarget(event);
      if (target && root.contains && !root.contains(target)) toggleMenu(runtime, false);
    });
    runtime.listeners = listeners;
  }

  function toggleMenu(runtime, force) {
    var root = runtime.root;
    if (!root || !root.classList) return;
    var next = typeof force === "boolean" ? force : !root.classList.contains("is-menu-open");
    root.classList.toggle("is-menu-open", next);
    var button = root.querySelector && root.querySelector("[data-ghph-toggle]");
    if (button) button.setAttribute("aria-expanded", String(next));
  }

  function applyFilters(runtime) {
    var root = runtime.root;
    if (!root || !root.querySelectorAll) return;
    var sidebarInput = root.querySelector("[data-ghph-sidebar-search]");
    var navQuery = String(sidebarInput && sidebarInput.value || "").trim().toLowerCase();
    Array.prototype.slice.call(root.querySelectorAll(".ghph-nav-item")).forEach(function (node) {
      var navText = String(node.textContent || "").trim().toLowerCase();
      node.hidden = Boolean(navQuery && navText.indexOf(navQuery) === -1);
    });
    var searchInput = root.querySelector("[data-ghph-card-search]") || root.querySelector("[data-ghph-search]");
    var statusInput = root.querySelector("[data-ghph-status-filter]");
    var query = String(searchInput && searchInput.value || "").trim().toLowerCase();
    var status = String(statusInput && statusInput.value || "all");
    var cards = Array.prototype.slice.call(root.querySelectorAll("[data-ghph-card]"));
    var visible = 0;
    cards.forEach(function (node) {
      var matchesText = !query || String(node.getAttribute("data-ghph-search") || "").indexOf(query) !== -1;
      var matchesStatus = status === "all" || node.getAttribute("data-ghph-status") === status;
      var show = matchesText && matchesStatus;
      node.hidden = !show;
      if (show) visible += 1;
    });
    var empty = root.querySelector("[data-ghph-empty]");
    if (empty) empty.hidden = visible !== 0;
    var count = root.querySelector("[data-ghph-result-count]");
    if (count) count.textContent = visible + " chức năng";
  }

  function resetFilters(runtime) {
    var root = runtime.root;
    if (!root || !root.querySelectorAll) return;
    Array.prototype.slice.call(root.querySelectorAll("[data-ghph-search], [data-ghph-card-search], [data-ghph-sidebar-search]")).forEach(function (input) { input.value = ""; });
    var status = root.querySelector("[data-ghph-status-filter]");
    if (status) status.value = "all";
    applyFilters(runtime);
  }

  function mount(root, options) {
    options = options || {};
    if (!root || typeof root !== "object") return false;
    var route = normalizeRoute(options.route || (global.location && global.location.hash) || routes[0]);
    if (!canHandle(route)) return false;
    unmount(root);
    var runtime = {
      root: root,
      route: route,
      options: options,
      data: asObject(options.data),
      controller: typeof AbortController === "function" ? new AbortController() : null,
      listeners: [],
      mounted: true
    };
    root.innerHTML = markup(route, runtime.data);
    if (root.dataset) {
      root.dataset.ghphMounted = "true";
      root.dataset.ghphRoute = route;
    }
    bind(runtime);
    applyFilters(runtime);
    mounted.add(runtime);
    return true;
  }

  function unmount(root) {
    var found = false;
    Array.from(mounted).forEach(function (runtime) {
      if (!root || runtime.root === root) {
        found = true;
        runtime.mounted = false;
        if (runtime.controller) runtime.controller.abort();
        runtime.listeners.forEach(function (entry) {
          try { entry[0].removeEventListener(entry[1], entry[2], entry[3]); } catch (error) { /* best effort */ }
        });
        if (runtime.root) {
          if (runtime.root.dataset) {
            delete runtime.root.dataset.ghphMounted;
            delete runtime.root.dataset.ghphRoute;
          }
          try { runtime.root.innerHTML = ""; } catch (error) { /* read-only test host */ }
        }
        mounted.delete(runtime);
      }
    });
    return found;
  }

  function getState() {
    var list = Array.from(mounted);
    if (!list.length) return { mounted: false, route: null, count: 0 };
    return { mounted: true, route: list[0].route, count: list.length };
  }

  return Object.freeze({
    VERSION: VERSION,
    routes: routes,
    ROUTES: HUBS,
    SIDEBAR_ITEMS: SIDEBAR_ITEMS,
    normalizeRoute: normalizeRoute,
    canHandle: canHandle,
    markup: markup,
    viewMarkup: markup,
    render: markup,
    mount: mount,
    unmount: unmount,
    getState: getState
  });
});
