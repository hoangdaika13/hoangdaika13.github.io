(function galaxyDomainViewsBootstrap(global) {
  "use strict";

  const VERSION = 3;
  const STORAGE_KEY = "hh.galaxy.domain-views.v1";
  const MAX_DESKTOP_WINDOWS = 3;
  const instances = new WeakMap();
  const mountedRoots = new Set();

  const ROUTES = Object.freeze({
    creator: Object.freeze({
      id: "creator",
      canonical: "/create/workflow",
      aliases: Object.freeze(["/create", "/galaxy/creator-pipeline", "/galaxy/creator"]),
      title: "Creator Pipeline",
      eyebrow: "QUY TRÌNH SÁNG TẠO NỘI DUNG"
    }),
    automation: Object.freeze({
      id: "automation",
      canonical: "/work/automation-lab",
      aliases: Object.freeze(["/galaxy/automation-builder"]),
      title: "Automation Builder",
      eyebrow: "TỰ ĐỘNG HÓA CÓ KIỂM SOÁT"
    }),
    projects: Object.freeze({
      id: "projects",
      canonical: "/work/projects-tasks",
      aliases: Object.freeze(["/galaxy/project-hub"]),
      title: "Project Hub & Media Vault",
      eyebrow: "DỰ ÁN VÀ TÀI NGUYÊN CỦA BẠN"
    }),
    community: Object.freeze({
      id: "community",
      canonical: "/communication/community",
      aliases: Object.freeze(["/galaxy/community-showcase", "/galaxy/community"]),
      title: "Community Showcase",
      eyebrow: "CỘNG ĐỒNG HH"
    }),
    ambient: Object.freeze({
      id: "ambient",
      canonical: "/music/ambient",
      aliases: Object.freeze(["/music", "/galaxy/ambient-room", "/galaxy/music"]),
      title: "Ambient Room",
      eyebrow: "PHÒNG ÂM THANH TẬP TRUNG"
    }),
    desktop: Object.freeze({
      id: "desktop",
      canonical: "/system/desktop",
      aliases: Object.freeze(["/galaxy/web-desktop"]),
      title: "HH Web Desktop",
      eyebrow: "KHÔNG GIAN ĐA NHIỆM TÙY CHỌN"
    })
  });

  const VIEW_NAV = Object.freeze([
    { id: "creator", label: "Pipeline", icon: "✦" },
    { id: "automation", label: "Automation", icon: "⌘" },
    { id: "projects", label: "Projects", icon: "▣" },
    { id: "community", label: "Community", icon: "◎" },
    { id: "ambient", label: "Ambient", icon: "♫" },
    { id: "desktop", label: "Desktop", icon: "⌗" }
  ]);

  /* The Galaxy surface keeps one predictable navigation rail on every
   * immersive workspace.  The rail points at the real feature routes; it is
   * deliberately separate from the legacy accordion sidebar so a module can
   * be used without stacking two navigation systems on top of each other. */
  const GALAXY_PORTAL_NAV = Object.freeze([
    { id: "home", label: "Trang chủ", route: "/home", icon: "⌂" },
    { id: "ai", label: "AI Universe", route: "/galaxy/ai", icon: "✦" },
    { id: "music", label: "Music Planet", route: "/galaxy/music", icon: "♫" },
    { id: "video", label: "Video Planet", route: "/galaxy/video", icon: "▣" },
    { id: "creator", label: "Creator Studio", route: "/galaxy/creator", icon: "⌘" },
    { id: "games", label: "Games World", route: "/galaxy/games", icon: "♧" },
    { id: "dev", label: "Dev Planet", route: "/galaxy/dev", icon: "</>" },
    { id: "learning", label: "Learning Star", route: "/galaxy/learning", icon: "◇" },
    { id: "community", label: "Community", route: "/galaxy/community", icon: "◎" },
    { id: "tools", label: "Tools Galaxy", route: "/galaxy/tools", icon: "⌘" },
    { id: "analytics", label: "Analytics", route: "/galaxy/analytics", icon: "⌁" },
    { id: "settings", label: "Cài đặt", route: "/galaxy/settings", icon: "⚙" }
  ]);

  function portalNavActive(view) {
    if (view === "ambient") return "music";
    if (view === "creator") return "creator";
    if (view === "community") return "community";
    if (view === "automation" || view === "projects" || view === "desktop") return "tools";
    return view;
  }

  function portalSidebarMarkup(view) {
    const active = portalNavActive(view);
    return `<aside class="gdv-portal-sidebar" aria-label="Galaxy navigation">
      <a class="gdv-portal-brand" href="#/home" data-gdv-route="/home" aria-label="HH Galaxy — Trang chủ"><span aria-hidden="true">HH</span><strong>HOANG8.COM</strong><small>GALAXY OS</small></a>
      <label class="gdv-portal-search"><span aria-hidden="true">⌕</span><input type="search" data-gdv-nav-search maxlength="80" placeholder="Tìm trong Galaxy…" aria-label="Tìm trong Galaxy"></label>
      <nav class="gdv-portal-nav" aria-label="Các không gian HH">${GALAXY_PORTAL_NAV.map((item) => `<button type="button" data-gdv-route="${item.route}" data-gdv-nav-item="${item.id}"${active === item.id ? ' aria-current="page"' : ""}><i aria-hidden="true">${item.icon}</i><span>${escapeHtml(item.label)}</span></button>`).join("")}</nav>
      <section class="gdv-portal-upgrade"><span aria-hidden="true">✧</span><strong>Nâng cấp Galaxy</strong><p>Mở thêm không gian sáng tạo và lưu trữ.</p><button type="button" data-gdv-route="/settings">Xem tùy chọn →</button></section>
      <footer class="gdv-portal-profile"><span aria-hidden="true">HH</span><div><strong>Thành viên HH</strong><small>Local-first workspace</small></div></footer>
    </aside>`;
  }

  const ENGINE_TARGETS = Object.freeze({
    automation: Object.freeze({ route: "/work/automation-lab", fallbackRoute: "/work/workflow-automation", label: "Automation Lab" }),
    projects: Object.freeze({ route: "/work/projects-tasks", fallbackRoute: "/work/project-center", label: "Projects & Tasks" }),
    community: Object.freeze({ route: "/communication/community", fallbackRoute: "/communication/command-center", label: "Community" })
  });

  const CREATOR_STAGES = Object.freeze([
    { number: 1, icon: "✧", title: "Idea", note: "Mở Idea Lab để phát triển ý tưởng", route: "/create/idea-lab", tone: "gold" },
    { number: 2, icon: "≡", title: "Script", note: "Viết và quản lý kịch bản", route: "/create/ai-script", tone: "magenta" },
    { number: 3, icon: "▧", title: "Image", note: "Tạo hoặc chỉnh hình ảnh", route: "/media-design/ai-task-center", tone: "blue" },
    { number: 4, icon: "◉", title: "Voice", note: "Giọng đọc, dubbing và phụ đề", route: "/create/audio-dubbing", tone: "pink" },
    { number: 5, icon: "♫", title: "Music", note: "Sáng tác và kiểm âm", route: "/music-ai", tone: "violet" },
    { number: 6, icon: "▶", title: "Video", note: "Dựng video trong HH Video Studio", route: "/davinci-resolve", tone: "cyan" },
    { number: 7, icon: "▤", title: "Thumbnail", note: "Thiết kế ảnh đại diện", route: "/media-design/photo-workspace", tone: "orange" },
    { number: 8, icon: "⌕", title: "SEO", note: "Metadata và kiểm tra YouTube", route: "/davinci-resolve/youtube", tone: "mint" },
    { number: 9, icon: "↗", title: "Publish", note: "Lịch và cổng duyệt xuất bản", route: "/create/publishing", tone: "violet" }
  ]);

  const PROJECT_TOOLS = Object.freeze([
    { icon: "▣", title: "Projects & Tasks", note: "List, board, timeline và milestone", engine: "projects" },
    { icon: "◈", title: "Universal Project", note: "Brief, asset và phiên bản sáng tạo", route: "/create/project" },
    { icon: "▧", title: "Media Bin", note: "Quản lý metadata và media offline", route: "/media-design/asset-manager" },
    { icon: "☁", title: "Cloud Storage", note: "Tệp cục bộ và adapter cloud", route: "/work/cloud-storage" },
    { icon: "◎", title: "Review Studio", note: "Annotation, so sánh và phê duyệt", route: "/media-design/review-studio" },
    { icon: "⇩", title: "Export & Publishing", note: "Preflight, quyền và manifest", route: "/media-design/export-workspace" }
  ]);

  const COMMUNITY_TOOLS = Object.freeze([
    { icon: "◎", title: "Bảng tin cộng đồng", note: "Bài đăng và tác phẩm từ backend", engine: "community" },
    { icon: "✉", title: "Messenger", note: "Nhắn tin và trạng thái realtime", route: "/communication/messenger" },
    { icon: "#", title: "Channels", note: "Kênh thảo luận theo chủ đề", route: "/communication/channels" },
    { icon: "◫", title: "Forum", note: "Chủ đề dài và tìm kiếm", route: "/communication/forum" },
    { icon: "◉", title: "Live Room", note: "Phòng trực tiếp và cuộc gọi", route: "/communication/live-room" },
    { icon: "◇", title: "Moderation", note: "Báo cáo, chặn và an toàn", route: "/communication/moderation" }
  ]);

  const DESKTOP_APPS = Object.freeze([
    { id: "ai", icon: "AI", title: "HH AI Copilot", note: "Trợ lý và lịch sử hội thoại", route: "/chat-ai", accent: "#9b72ff" },
    { id: "code", icon: "</>", title: "Code Nebula", note: "Code, sandbox, preview và test", route: "/dev-tools/code-nebula", accent: "#4fdff7" },
    { id: "music", icon: "♫", title: "Music Planet", note: "Thư viện và xưởng sản xuất", route: "/music-ai", accent: "#e968ff" },
    { id: "projects", icon: "▣", title: "Project Manager", note: "Dự án, task và milestone", route: "/work/projects-tasks", accent: "#ffb34f" },
    { id: "community", icon: "◎", title: "Community", note: "Bảng tin và messenger", route: "/communication/community", accent: "#64e6b2" },
    { id: "media", icon: "▧", title: "Media Vault", note: "Asset, review và xuất bản", route: "/media-design", accent: "#5d8cff" }
  ]);

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[character]);
  }

  function clone(value) {
    if (value == null) return value;
    try { return JSON.parse(JSON.stringify(value)); } catch { return null; }
  }

  function safeMediaUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw, global.location?.href || "https://hoang8.com/");
      return ["http:", "https:", "blob:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function cleanRoute(value) {
    const raw = String(value || "").replace(/^#/, "").split("?")[0].split(";")[0].trim();
    if (!raw) return "/create/workflow";
    const route = raw.startsWith("/") ? raw : `/${raw}`;
    return route.length > 1 ? route.replace(/\/+$/, "") : route;
  }

  function routeDefinition(value) {
    const route = cleanRoute(value);
    return Object.values(ROUTES).find((item) => item.canonical === route || item.aliases.includes(route)) || null;
  }

  function canHandle(route, options = {}) {
    const definition = routeDefinition(route);
    if (!definition) return false;
    return options.includeAliases !== false || definition.canonical === cleanRoute(route);
  }

  function safeRead(key, fallback = null) {
    try {
      const raw = global.localStorage?.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function readPreferences() {
    const raw = safeRead(STORAGE_KEY, {});
    const mix = raw && typeof raw.mix === "object" ? raw.mix : {};
    return {
      version: VERSION,
      desktopEnabled: raw?.desktopEnabled === true,
      ambientScene: ["rainy", "cafe", "cozy", "forest", "deep"].includes(raw?.ambientScene) ? raw.ambientScene : "rainy",
      mix: {
        rain: clamp(mix.rain, 0, 1, 0.62),
        wind: clamp(mix.wind, 0, 1, 0.22),
        fire: clamp(mix.fire, 0, 1, 0.14),
        focus: clamp(mix.focus, 0, 1, 0.18)
      },
      timerMinutes: [15, 25, 45, 60].includes(Number(raw?.timerMinutes)) ? Number(raw.timerMinutes) : 25
    };
  }

  function savePreferences(preferences) {
    const payload = {
      version: VERSION,
      desktopEnabled: preferences.desktopEnabled === true,
      ambientScene: preferences.ambientScene,
      mix: preferences.mix,
      timerMinutes: preferences.timerMinutes,
      updatedAt: new Date().toISOString()
    };
    try { global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch {}
  }

  function clamp(value, minimum, maximum, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
  }

  function browserCapabilities(options = {}) {
    const supplied = options.capabilities && typeof options.capabilities === "object" ? options.capabilities : {};
    let localStorageReady = false;
    try {
      const probe = "hh.galaxy.capability-probe";
      global.localStorage?.setItem(probe, "1");
      global.localStorage?.removeItem(probe);
      localStorageReady = Boolean(global.localStorage);
    } catch {}
    const apiBase = String(options.apiBase || global.HH_REALTIME_URL || "").trim();
    const online = typeof global.navigator?.onLine === "boolean" ? global.navigator.onLine : true;
    const communityVerified = supplied.community === true || supplied.community === "ready";
    const automationVerified = supplied.automation === true || supplied.automation === "ready" || Boolean(global.HHWorkCenter?.supports?.("automation-lab"));
    return {
      localStorage: localStorageReady ? "ready" : "unsupported",
      indexedDB: global.indexedDB ? "ready" : "unsupported",
      storageEstimate: typeof global.navigator?.storage?.estimate === "function" ? "loading" : "unsupported",
      audio: global.AudioContext || global.webkitAudioContext ? "idle" : "unsupported",
      community: !online ? "offline" : (communityVerified ? "ready" : (apiBase ? "degraded" : "configuration-required")),
      cloud: supplied.cloud === true || supplied.cloud === "ready" ? "ready" : "configuration-required",
      automation: automationVerified ? "ready" : "configuration-required",
      desktop: "idle"
    };
  }

  function capabilityLabel(status) {
    return ({
      ready: "Sẵn sàng",
      idle: "Chờ bạn bật",
      loading: "Đang kiểm tra",
      empty: "Chưa có dữ liệu",
      offline: "Đang ngoại tuyến",
      "permission-required": "Cần cấp quyền",
      unsupported: "Không được hỗ trợ",
      "configuration-required": "Cần cấu hình",
      degraded: "Đang giới hạn",
      error: "Có lỗi"
    })[status] || "Chưa xác định";
  }

  function collectLocalData(options = {}) {
    const supplied = options.data && typeof options.data === "object" ? options.data : {};
    const creative = safeRead("hh.creative-os.v1", {});
    const work = safeRead("hh-work-center-v2", {});
    const legacyProjects = safeRead("hh-project-center", {});
    const suppliedProjects = Array.isArray(supplied.projects) ? supplied.projects : [];
    const sourceProjects = [
      ...(Array.isArray(creative?.projects) ? creative.projects.map((item) => ({ ...item, source: "Creative OS" })) : []),
      ...(Array.isArray(work?.projects) ? work.projects.map((item) => ({ ...item, source: "Work Center" })) : []),
      ...(Array.isArray(legacyProjects?.projects) ? legacyProjects.projects.map((item) => ({ ...item, source: "Project Center" })) : []),
      ...suppliedProjects.map((item) => ({ ...item, source: item.source || "Provider" }))
    ];
    const seen = new Set();
    const projects = sourceProjects.filter((item) => {
      if (!item || typeof item !== "object") return false;
      const key = String(item.id || `${item.source}:${item.name || item.title || ""}`);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 24);
    const automationRuns = Array.isArray(supplied.automationRuns)
      ? supplied.automationRuns
      : (Array.isArray(work?.automationRuns) ? work.automationRuns : []);
    const automations = Array.isArray(supplied.automations)
      ? supplied.automations
      : (Array.isArray(work?.automations) ? work.automations : []);
    const communityItems = Array.isArray(supplied.communityItems) ? supplied.communityItems.slice(0, 12) : [];
    return { projects, automationRuns: automationRuns.slice(0, 12), automations: automations.slice(0, 12), communityItems };
  }

  function addListener(instance, target, type, listener, options) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, listener, options);
    instance.cleanup.push(() => target.removeEventListener(type, listener, options));
  }

  function headerActionsMarkup(view) {
    if (view === "projects") return `<button class="gdv-button" type="button" data-gdv-route="/media-design">Media Vault</button><button class="gdv-button gdv-button--primary" type="button" data-gdv-engine="projects">+ Dự án</button>`;
    if (view === "automation") return `<button class="gdv-button" type="button" data-gdv-route="/create/ai-automation">AI Automation</button><button class="gdv-button gdv-button--primary" type="button" data-gdv-engine="automation">Mở Builder</button>`;
    if (view === "creator") return `<button class="gdv-button" type="button" data-gdv-route="/create/overview">Tổng quan</button><button class="gdv-button gdv-button--primary" type="button" data-gdv-route="/create/project">+ Dự án</button>`;
    if (view === "ambient") return `<button class="gdv-button" type="button" data-gdv-route="/music-ai">Music Planet</button>`;
    return "";
  }

  function headerMarkup(definition) {
    return `<header class="gdv-header gdv-header--${definition.id}">
      <div class="gdv-header__title">
        <span class="gdv-orb" aria-hidden="true"><i></i></span>
        <div><p>${escapeHtml(definition.eyebrow)}</p><h2>${escapeHtml(definition.title)}</h2></div>
      </div>
      <label class="gdv-command-search"><span aria-hidden="true">⌕</span><input type="search" data-gdv-global-search maxlength="80" placeholder="Tìm module, dự án, công cụ…" aria-label="Tìm trong không gian hiện tại"><kbd>⌘K</kbd></label>
      <div class="gdv-header-tools">${headerActionsMarkup(definition.id)}<details class="gdv-space-switcher"><summary aria-label="Chuyển không gian Galaxy"><span aria-hidden="true">✦</span> Không gian</summary><nav class="gdv-view-nav" aria-label="Chuyển không gian Galaxy">
        ${VIEW_NAV.map((item) => {
          const route = ROUTES[item.id].aliases.find((alias) => alias.startsWith("/galaxy/")) || ROUTES[item.id].canonical;
          const current = item.id === definition.id;
          return `<button type="button" data-gdv-route="${route}"${current ? ' aria-current="page" disabled' : ""}><span aria-hidden="true">${item.icon}</span>${escapeHtml(item.label)}</button>`;
        }).join("")}
      </nav></details></div>
    </header>`;
  }

  function statusPill(status, label) {
    return `<span class="gdv-status gdv-status--${escapeHtml(status)}"><i aria-hidden="true"></i>${escapeHtml(label || capabilityLabel(status))}</span>`;
  }

  function frameMarkup(instance, body) {
    const definition = ROUTES[instance.view];
    return `<section class="gdv" data-gdv-root data-gdv-view="${definition.id}" aria-labelledby="gdv-title-${definition.id}">
      <div class="gdv-space" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      ${portalSidebarMarkup(definition.id)}
      ${headerMarkup(definition).replace(`<h2>`, `<h2 id="gdv-title-${definition.id}">`)}
      <div class="gdv-body">${body}</div>
      <p class="gdv-sr-live" data-gdv-live aria-live="polite" aria-atomic="true"></p>
    </section>`;
  }

  function creatorMarkup(instance) {
    const projects = instance.data.projects;
    const projectSummary = projects.length
      ? `${projects.length} dự án cục bộ/provider đã được đọc`
      : "Chưa có dự án trong kho dữ liệu đã kết nối";
    const projectCards = projects.slice(0, 3).map((project, index) => {
      const thumbnail = safeMediaUrl(project.thumbnail || project.cover || project.preview);
      const destination = project.source === "Creative OS" ? 'data-gdv-route="/create/project"' : 'data-gdv-engine="projects"';
      return `<article class="gdv-creator-project" data-gdv-filterable="${escapeHtml(`${project.name || project.title || "dự án"} ${project.source || ""}`)}"><div class="gdv-creator-project__media gdv-creator-project__media--${index % 3}">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="">` : `<span aria-hidden="true">${CREATOR_STAGES[(index * 3) % CREATOR_STAGES.length].icon}</span>`}<small>${escapeHtml(project.source || "Kho cục bộ")}</small></div><div><strong>${escapeHtml(project.name || project.title || "Dự án không tên")}</strong><p>${escapeHtml(project.description || "Tiếp tục trong workspace chuyên trách để bảo toàn dữ liệu và phiên bản.")}</p><button type="button" ${destination}>Mở dự án →</button></div></article>`;
    }).join("");
    return frameMarkup(instance, `<section class="gdv-panel gdv-pipeline gdv-creator-pipeline" aria-labelledby="gdv-pipeline-title">
      <header><div><span>PRODUCTION PATH</span><h3 id="gdv-pipeline-title">Idea → Script → Media → Publish</h3></div>${statusPill(projects.length ? "ready" : "empty", projectSummary)}</header>
      <ol class="gdv-pipeline__grid">
        ${CREATOR_STAGES.map((stage) => `<li>
          <button type="button" class="gdv-stage gdv-stage--${stage.tone}" data-gdv-route="${stage.route}" aria-label="Bước ${stage.number}: ${escapeHtml(stage.title)}. ${escapeHtml(stage.note)}">
            <small>${stage.number}</small><span aria-hidden="true">${stage.icon}</span><strong>${escapeHtml(stage.title)}</strong><em>${escapeHtml(stage.note)}</em><b>Mở →</b>
          </button>
        </li>`).join("")}
      </ol>
      <footer><span><i></i>Không có bước nào tự đánh dấu hoàn thành.</span><button type="button" data-gdv-route="/create/rights">Kiểm tra Rights & Provenance</button></footer>
    </section>
    <div class="gdv-creator-lower">
      <section class="gdv-panel gdv-creator-projects"><header><div><span>CONNECTED PROJECTS</span><h3>Dự án gần đây</h3></div><button type="button" data-gdv-route="/create/project">Xem tất cả →</button></header>${projectCards || `<div class="gdv-empty gdv-empty--creator"><span>✦</span><strong>Chưa có dự án thực</strong><p>Tạo dự án trong Universal Project; màn hình Pipeline không chèn dự án hoặc tiến độ mẫu.</p><button type="button" data-gdv-route="/create/project">Tạo dự án đầu tiên</button></div>`}</section>
      <aside class="gdv-panel gdv-creator-context"><header><div><span>PROJECT CONTEXT</span><h3>Ngữ cảnh đang kết nối</h3></div></header><dl><div><dt>Dự án đọc được</dt><dd>${projects.length}</dd></div><div><dt>Kho dữ liệu</dt><dd>${statusPill(instance.capabilities.localStorage)}</dd></div><div><dt>Media workflow</dt><dd><button type="button" data-gdv-route="/media-design">Mở</button></dd></div><div><dt>Rights & Provenance</dt><dd><button type="button" data-gdv-route="/create/rights">Kiểm tra</button></dd></div></dl><p>Script, ảnh, giọng nói, nhạc và video giữ storage cùng lifecycle riêng trong từng module.</p></aside>
    </div>
    <section class="gdv-tool-strip gdv-creator-tools" aria-label="Công cụ và phím tắt Creator">${CREATOR_STAGES.slice(0, 8).map((stage) => `<button type="button" data-gdv-route="${stage.route}"><span aria-hidden="true">${stage.icon}</span><strong>${escapeHtml(stage.title)}</strong><small>${escapeHtml(stage.note)}</small><i>→</i></button>`).join("")}</section>`);
  }

  function automationMarkup(instance) {
    const runs = instance.data.automationRuns;
    const automations = instance.data.automations;
    const state = instance.capabilities.automation;
    const blueprint = [
      ["01", "✧", "Idea input", "Nhận brief do bạn cung cấp"],
      ["02", "≡", "AI script", "Soạn nội dung trong engine"],
      ["03", "▧", "Image", "Tạo hoặc chọn hình ảnh"],
      ["04", "◉", "Voice", "Tạo giọng đọc được duyệt"],
      ["05", "♫", "Music", "Chọn nhạc có quyền sử dụng"],
      ["06", "▶", "Video", "Dựng và kiểm tra video"],
      ["07", "▤", "Thumbnail", "Thiết kế ảnh đại diện"],
      ["08", "⌕", "SEO", "Kiểm tra metadata"],
      ["09", "↗", "Publish", "Duyệt trước khi xuất bản"]
    ];
    return frameMarkup(instance, `<div class="gdv-automation-workspace">
      <aside class="gdv-panel gdv-template-library"><header><div><span>TEMPLATE LIBRARY</span><h3>Luồng đã lưu</h3></div>${statusPill(automations.length ? "ready" : "empty", automations.length ? `${automations.length} luồng` : "Kho trống")}</header><label><span aria-hidden="true">⌕</span><input type="search" data-gdv-automation-search placeholder="Tìm automation…" aria-label="Tìm automation đã lưu"></label>${automations.length ? `<ul>${automations.slice(0, 8).map((item) => `<li data-gdv-filterable="${escapeHtml(`${item.name || item.title || "automation"} ${item.status || ""}`)}"><button type="button" data-gdv-engine="automation"><span>⌘</span><div><strong>${escapeHtml(item.name || item.title || "Automation")}</strong><small>${escapeHtml(item.status || "Đã lưu")}</small></div><i>→</i></button></li>`).join("")}</ul>` : `<div class="gdv-empty"><span>⌘</span><strong>Chưa có automation</strong><p>Tạo luồng đầu tiên trong Automation Lab; thư viện không chèn template giả.</p><button type="button" data-gdv-engine="automation">Mở engine</button></div>`}<footer><button type="button" data-gdv-engine="automation">+ Tạo automation mới</button></footer></aside>
      <section class="gdv-panel gdv-automation-canvas" aria-labelledby="gdv-automation-title">
        <header><div><span>CONTROLLED DAG · BLUEPRINT</span><h3 id="gdv-automation-title">Quy trình automation</h3></div>${statusPill(state)}</header>
        <div class="gdv-node-flow gdv-node-flow--blueprint" role="list" aria-label="Cấu trúc automation minh họa, không phải lượt chạy">${blueprint.map((node) => `<article role="listitem"><i>${node[0]}</i><span>${node[1]}</span><div><strong>${node[2]}</strong><p>${node[3]}</p></div><small>Chưa xác nhận cấu hình</small></article>`).join("")}</div>
        <aside class="gdv-honesty-note"><span aria-hidden="true">ⓘ</span><p><strong>Không có tiến độ minh họa.</strong> Chỉ run thật từ Work Center mới xuất hiện ở bảng trạng thái.</p></aside>
      </section>
      <aside class="gdv-panel gdv-run-panel gdv-execution-panel"><header><div><span>EXECUTION STATUS</span><h3>Lượt chạy thật</h3></div>${statusPill(runs.length ? "ready" : "empty", runs.length ? `${runs.length} bản ghi` : "Chưa có log")}</header>${runs.length ? `<ol>${runs.slice(0, 8).map((item, index) => `<li><span>${index + 1}</span><div><strong>${escapeHtml(item.name || item.automationName || item.automationId || "Automation")}</strong><small>${escapeHtml(formatDate(item.finishedAt || item.startedAt || item.createdAt))}</small></div>${statusPill(String(item.status || "idle").toLowerCase(), item.status || "Chưa rõ")}</li>`).join("")}</ol>` : `<div class="gdv-empty"><span>◷</span><strong>Chưa có execution log</strong><p>Không hiển thị thời gian hoặc phần trăm giả khi engine chưa trả dữ liệu.</p></div>`}<footer><button type="button" data-gdv-engine="automation">Xem log trong engine →</button></footer></aside>
    </div>`);
  }

  function projectMarkup(instance) {
    const projects = instance.data.projects;
    const cloud = instance.capabilities.cloud;
    const cards = projects.slice(0, 8).map((project, index) => {
      const thumbnail = safeMediaUrl(project.thumbnail || project.cover || project.preview);
      const destination = project.source === "Creative OS" ? 'data-gdv-route="/create/project"' : 'data-gdv-engine="projects"';
      const searchText = `${project.name || project.title || "dự án"} ${project.source || ""} ${project.description || ""}`;
      return `<article class="gdv-vault-card" data-gdv-filterable="${escapeHtml(searchText)}"><button type="button" ${destination} aria-label="Mở ${escapeHtml(project.name || project.title || "dự án")}"><div class="gdv-vault-card__media gdv-vault-card__media--${index % 4}">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="">` : `<span aria-hidden="true">${escapeHtml(project.icon || ["✦", "HH", "▧", "◎"][index % 4])}</span>`}<small>PROJECT</small></div><div class="gdv-vault-card__copy"><strong>${escapeHtml(project.name || project.title || "Dự án không tên")}</strong><p>${escapeHtml(project.description || "Mở workspace gốc để xem nội dung và phiên bản.")}</p><small>${escapeHtml(project.source || "Kho cục bộ")}</small><i>→</i></div></button></article>`;
    }).join("");
    return frameMarkup(instance, `<div class="gdv-project-layout gdv-project-layout--vault">
      <main class="gdv-project-main">
      <section class="gdv-panel gdv-project-list" aria-labelledby="gdv-project-title">
        <header><div><span>CONNECTED DATA</span><h3 id="gdv-project-title">Tất cả dự án</h3></div>${statusPill(projects.length ? "ready" : "empty", projects.length ? `${projects.length} dự án` : "Kho trống")}</header>
        <div class="gdv-vault-toolbar"><label><span aria-hidden="true">⌕</span><input type="search" data-gdv-project-search placeholder="Tìm dự án, nguồn, mô tả…" aria-label="Tìm dự án"></label><div><button type="button" data-gdv-project-view="grid" aria-pressed="true">▦ Grid</button><button type="button" data-gdv-project-view="list" aria-pressed="false">☷ List</button></div></div>
        ${cards ? `<div class="gdv-vault-grid" data-gdv-project-view-mode="grid">${cards}</div>` : `<div class="gdv-empty"><span>▣</span><strong>Chưa có project thực</strong><p>Tạo project trong Work Center hoặc Universal Project. Project Hub không chèn card, ảnh hoặc dung lượng mẫu.</p><button type="button" data-gdv-route="/create/project">Tạo project</button></div>`}
      </section>
      ${projects.length ? `<section class="gdv-panel gdv-project-table"><header><div><span>RECENT FILES</span><h3>Danh sách dự án đã kết nối</h3></div><button type="button" data-gdv-engine="projects">Quản lý →</button></header><div class="gdv-table" role="table" aria-label="Danh sách dự án"><div role="row"><b role="columnheader">Tên</b><b role="columnheader">Nguồn</b><b role="columnheader">Mở</b></div>${projects.slice(0, 8).map((project) => `<div role="row" data-gdv-filterable="${escapeHtml(`${project.name || project.title || "dự án"} ${project.source || ""}`)}"><span role="cell">${escapeHtml(project.name || project.title || "Dự án không tên")}</span><span role="cell">${escapeHtml(project.source || "Kho cục bộ")}</span><button type="button" role="cell" ${project.source === "Creative OS" ? 'data-gdv-route="/create/project"' : 'data-gdv-engine="projects"'}>Mở →</button></div>`).join("")}</div></section>` : ""}
      </main>
      <aside class="gdv-side-stack">
        <section class="gdv-panel gdv-storage-card"><header><div><span>BROWSER STORAGE</span><h3>Dung lượng cục bộ</h3></div>${statusPill(instance.capabilities.storageEstimate)}</header><div data-gdv-storage-estimate class="gdv-storage-value"><strong>Đang kiểm tra…</strong><small>Storage API của trình duyệt</small></div><div class="gdv-meter"><i data-gdv-storage-meter style="--value:0"></i></div><p data-gdv-storage-note>Không dùng phần trăm minh họa.</p></section>
        <section class="gdv-panel gdv-recent-card"><header><div><span>RECENT ACTIVITY</span><h3>Dữ liệu gần đây</h3></div></header>${projects.length ? `<ul>${projects.slice(0, 5).map((project) => `<li><span>✦</span><div><strong>${escapeHtml(project.name || project.title || "Dự án")}</strong><small>${escapeHtml(project.source || "Kho cục bộ")}</small></div></li>`).join("")}</ul>` : `<p>Chưa có hoạt động dự án để hiển thị.</p>`}</section>
        <section class="gdv-panel gdv-cloud-card"><header><div><span>CLOUD ADAPTER</span><h3>Đồng bộ nhà cung cấp</h3></div>${statusPill(cloud)}</header><p>${cloud === "ready" ? "Adapter cloud đã được phía tích hợp xác nhận sẵn sàng." : "Google Drive, Dropbox hoặc OneDrive chỉ được báo kết nối sau OAuth thành công."}</p><button type="button" data-gdv-route="/work/cloud-storage">Quản lý kết nối</button></section>
      </aside>
    </div>
    <section class="gdv-tool-strip" aria-label="Công cụ quản lý dự án và media">${PROJECT_TOOLS.map((tool) => `<button type="button" ${tool.engine ? `data-gdv-engine="${tool.engine}"` : `data-gdv-route="${tool.route}"`}><span aria-hidden="true">${tool.icon}</span><strong>${escapeHtml(tool.title)}</strong><small>${escapeHtml(tool.note)}</small><i>→</i></button>`).join("")}</section>`);
  }

  function communityMarkup(instance) {
    const capability = instance.capabilities.community;
    const items = instance.data.communityItems;
    const message = capability === "ready"
      ? "Backend Community đã được cấu hình. Mở bảng tin để tải dữ liệu mới nhất."
      : capability === "offline"
        ? "Thiết bị đang ngoại tuyến. Nội dung mới không được giả lập từ cache."
        : capability === "degraded"
          ? "Địa chỉ backend đã có nhưng health check chưa được adapter tích hợp xác nhận."
          : "Cần cấu hình HH_REALTIME_URL hoặc apiBase để tải bài viết, follower và lượt thích thật.";
    return frameMarkup(instance, `<section class="gdv-hero gdv-hero--community">
      <div><span class="gdv-kicker">COMMUNITY · BACKEND-AWARE</span><h3>Chia sẻ tác phẩm và kết nối,<br><em>không có tương tác giả.</em></h3><p>${escapeHtml(message)}</p></div>
      <div class="gdv-hero__actions"><button class="gdv-button gdv-button--primary" type="button" data-gdv-engine="community">Mở Community</button><button class="gdv-button" type="button" data-gdv-route="/communication/messenger">Messenger</button></div>
    </section>
    <div class="gdv-community-layout">
      <section class="gdv-panel gdv-showcase" aria-labelledby="gdv-showcase-title">
        <header><div><span>SHOWCASE FEED</span><h3 id="gdv-showcase-title">Tác phẩm từ nguồn đã kết nối</h3></div>${statusPill(capability)}</header>
        ${items.length ? `<div class="gdv-showcase-grid">${items.map((item) => { const thumbnail = safeMediaUrl(item.thumbnail); return `<article><div class="gdv-showcase-media">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="">` : `<span aria-hidden="true">✦</span>`}</div><strong>${escapeHtml(item.title || "Tác phẩm")}</strong><small>${escapeHtml(item.authorName || item.author || "Thành viên HH")}</small><button type="button" data-gdv-engine="community">Xem trong Community</button></article>`; }).join("")}</div>` : `<div class="gdv-empty gdv-empty--showcase"><span>◎</span><strong>Chưa tải dữ liệu Showcase</strong><p>${escapeHtml(message)}</p><button type="button" data-gdv-engine="community">Mở bảng tin thật</button></div>`}
      </section>
      <aside class="gdv-panel gdv-community-status"><header><div><span>CAPABILITY</span><h3>Trạng thái dịch vụ</h3></div></header><dl><div><dt>Community API</dt><dd>${statusPill(capability)}</dd></div><div><dt>Realtime</dt><dd>${statusPill(capability === "ready" ? "ready" : capability)}</dd></div><div><dt>Like / Follow</dt><dd>${statusPill(capability === "ready" ? "ready" : capability)}</dd></div><div><dt>Moderation</dt><dd>${statusPill(capability === "ready" ? "ready" : capability)}</dd></div></dl><p>Chỉ số thành viên, follower, like và leaderboard không xuất hiện khi backend chưa trả dữ liệu.</p></aside>
    </div>
    <section class="gdv-tool-strip gdv-tool-strip--community" aria-label="Không gian Community">${COMMUNITY_TOOLS.map((tool) => `<button type="button" ${tool.engine ? `data-gdv-engine="${tool.engine}"` : `data-gdv-route="${tool.route}"`}><span aria-hidden="true">${tool.icon}</span><strong>${escapeHtml(tool.title)}</strong><small>${escapeHtml(tool.note)}</small><i>→</i></button>`).join("")}</section>`);
  }

  function ambientMarkup(instance) {
    const mix = instance.preferences.mix;
    const sceneButtons = [
      ["rainy", "☂", "Rainy Study"], ["cafe", "☕", "Café Sáng"], ["cozy", "♨", "Đêm Ấm"], ["forest", "♧", "Cabin Rừng"], ["deep", "◌", "Trạm Không Gian"]
    ];
    return frameMarkup(instance, `<div class="gdv-ambient-experience">
      <section class="gdv-ambient-scene" data-gdv-scene-active="${instance.preferences.ambientScene}" aria-labelledby="gdv-ambient-title">
        <div class="gdv-rain" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="gdv-ambient-copy"><span class="gdv-kicker">PROCEDURAL WEB AUDIO</span><h3 id="gdv-ambient-title">Ambient Room <i aria-hidden="true">▥</i></h3><strong>Phòng âm thanh tập trung</strong><p>Âm thanh tạo cục bộ bằng Web Audio và chỉ khởi động sau thao tác của bạn.</p></div>
        <section class="gdv-panel gdv-mixer gdv-mixer--overlay"><header><div><span>LIVE MIXER</span><h3>Mix âm thanh ambient</h3></div>${statusPill(instance.capabilities.audio, instance.capabilities.audio === "idle" ? "Chưa bật" : undefined)}</header>
          ${ambientSlider("rain", "☂", "Mưa", mix.rain)}
          ${ambientSlider("wind", "≋", "Gió", mix.wind)}
          ${ambientSlider("fire", "♨", "Lửa nhỏ", mix.fire)}
          ${ambientSlider("focus", "◉", "Focus tone", mix.focus)}
          <button class="gdv-button gdv-button--primary gdv-audio-start" type="button" data-gdv-audio-toggle>${instance.capabilities.audio === "unsupported" ? "Trình duyệt không hỗ trợ" : "Bật âm thanh"}</button>
          <p class="gdv-audio-disclosure">Tín hiệu tạo trong trình duyệt; không sử dụng file âm thanh chưa rõ giấy phép.</p>
        </section>
        <canvas data-gdv-waveform width="960" height="180" aria-label="Dạng sóng của âm thanh đang phát"></canvas>
        <section class="gdv-panel gdv-timer gdv-timer--overlay" aria-labelledby="gdv-timer-title"><header><div><span>FOCUS TIMER</span><h3 id="gdv-timer-title">Pomodoro</h3></div></header><div class="gdv-timer__ring" role="timer" aria-labelledby="gdv-timer-title"><strong data-gdv-timer-text>${formatTimer(instance.timer.remaining)}</strong><small data-gdv-timer-state>Chưa bắt đầu</small></div><div class="gdv-timer__presets">${[15, 25, 45, 60].map((minutes) => `<button type="button" data-gdv-timer-minutes="${minutes}" aria-label="Đặt Pomodoro ${minutes} phút" aria-pressed="${minutes === instance.preferences.timerMinutes}">${minutes}</button>`).join("")}</div><button class="gdv-button gdv-button--primary" type="button" data-gdv-timer-toggle>Bắt đầu</button><button class="gdv-link-button" type="button" data-gdv-timer-reset>Đặt lại</button></section>
        <div class="gdv-scene-picker" role="group" aria-label="Preset không gian">${sceneButtons.map(([id, icon, label]) => `<button type="button" data-gdv-scene="${id}" aria-pressed="${instance.preferences.ambientScene === id}"><span>${icon}</span>${escapeHtml(label)}</button>`).join("")}</div>
      </section>
    </div>
    <footer class="gdv-ambient-dock"><div><span class="gdv-orb gdv-orb--small" aria-hidden="true"><i></i></span><div><strong data-gdv-now-playing>Âm thanh chưa bật</strong><small>Ambient Room · procedural local audio</small></div></div><div class="gdv-ambient-dock__transport"><button type="button" data-gdv-audio-toggle data-gdv-audio-compact aria-label="Bật âm thanh">▶</button><button type="button" data-gdv-route="/music-ai">Mở Music Planet →</button></div></footer>`);
  }

  function ambientSlider(id, icon, label, value) {
    const percent = Math.round(value * 100);
    return `<label class="gdv-mix-row"><span aria-hidden="true">${icon}</span><strong>${escapeHtml(label)}</strong><input type="range" min="0" max="100" value="${percent}" data-gdv-mix="${id}" aria-label="Âm lượng ${escapeHtml(label)}"><output data-gdv-mix-output="${id}">${percent}%</output></label>`;
  }

  function desktopConsentMarkup() {
    return `<section class="gdv-desktop-consent"><span class="gdv-desktop-planet" aria-hidden="true"><i></i></span><div><span class="gdv-kicker">OPT-IN WORKSPACE</span><h3>Bật HH Web Desktop?</h3><p>Chế độ này tạo các cửa sổ launcher trong cùng trang. Resource Governor giới hạn tối đa ${MAX_DESKTOP_WINDOWS} cửa sổ preview, tạm dừng preview nền khi tab ẩn và không tự mount nhiều engine nặng.</p><ul><li>Không tự phát âm thanh hoặc video</li><li>Không mở module khi chưa chọn</li><li>Có thể tắt và xóa layout bất cứ lúc nào</li></ul><button class="gdv-button gdv-button--primary" type="button" data-gdv-desktop-enable>Bật Web Desktop</button></div></section>`;
  }

  function desktopWorkspaceMarkup(instance) {
    return `<section class="gdv-web-desktop" aria-label="HH Web Desktop">
      <div class="gdv-desktop-wallpaper" aria-hidden="true"><i></i><i></i></div>
      <header class="gdv-desktop-topbar"><div><span class="gdv-orb gdv-orb--small" aria-hidden="true"><i></i></span><strong>HH Web Desktop</strong></div><div>${statusPill(instance.desktop.visible ? "ready" : "degraded", instance.desktop.visible ? "Governor hoạt động" : "Tab nền · preview tạm dừng")}<button type="button" data-gdv-desktop-disable>Tắt Desktop</button></div></header>
      <div class="gdv-desktop-windows" data-gdv-desktop-windows>${instance.desktop.windows.length ? instance.desktop.windows.map((id) => desktopWindowMarkup(id, instance.desktop.activeId)).join("") : `<div class="gdv-desktop-empty"><span>✦</span><strong>Chọn ứng dụng từ dock</strong><p>Cửa sổ là launcher nhẹ; engine đầy đủ chỉ mở khi bạn nhấn “Đi tới ứng dụng”.</p></div>`}</div>
      <nav class="gdv-desktop-dock" aria-label="Ứng dụng Web Desktop">${DESKTOP_APPS.map((app) => `<button type="button" data-gdv-desktop-app="${app.id}" style="--app:${app.accent}" aria-label="Mở launcher ${escapeHtml(app.title)}"><span>${escapeHtml(app.icon)}</span><small>${escapeHtml(app.title)}</small></button>`).join("")}</nav>
    </section>`;
  }

  function desktopWindowMarkup(id, activeId) {
    const app = DESKTOP_APPS.find((item) => item.id === id);
    if (!app) return "";
    return `<article class="gdv-desktop-window${activeId === id ? " is-active" : ""}" data-gdv-window="${app.id}" style="--window:${app.accent}" tabindex="0">
      <header><div><span>${escapeHtml(app.icon)}</span><strong>${escapeHtml(app.title)}</strong></div><button type="button" data-gdv-window-close="${app.id}" aria-label="Đóng launcher ${escapeHtml(app.title)}">×</button></header>
      <div><span class="gdv-window-orbit" aria-hidden="true"><i></i></span><h3>${escapeHtml(app.title)}</h3><p>${escapeHtml(app.note)}</p><small>${activeId === id ? "Foreground preview" : "Preview đang nghỉ"}</small></div>
      <footer><button type="button" data-gdv-route="${app.route}">Đi tới ứng dụng →</button></footer>
    </article>`;
  }

  function desktopMarkup(instance) {
    return frameMarkup(instance, `<section class="gdv-hero gdv-hero--desktop">
      <div><span class="gdv-kicker">RESOURCE-GOVERNED</span><h3>Desktop đa cửa sổ,<br><em>chỉ khi bạn chủ động bật.</em></h3><p>Các launcher không nhân đôi engine, AudioContext hoặc dữ liệu của module.</p></div><div class="gdv-hero__actions"><button class="gdv-button" type="button" data-gdv-route="/system">System Center</button></div>
    </section><div data-gdv-desktop-stage>${instance.preferences.desktopEnabled ? desktopWorkspaceMarkup(instance) : desktopConsentMarkup()}</div>`);
  }

  function render(instance) {
    const renderer = ({ creator: creatorMarkup, automation: automationMarkup, projects: projectMarkup, community: communityMarkup, ambient: ambientMarkup, desktop: desktopMarkup })[instance.view];
    instance.root.innerHTML = renderer(instance);
  }

  function formatDate(value) {
    if (!value) return "Chưa ghi nhận";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Chưa ghi nhận" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
  }

  function formatBytes(value) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes < 0) return "Không khả dụng";
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let number = bytes / 1024;
    let unit = units[0];
    for (let index = 1; index < units.length && number >= 1024; index += 1) {
      number /= 1024;
      unit = units[index];
    }
    return `${number.toFixed(number >= 10 ? 1 : 2)} ${unit}`;
  }

  function formatTimer(seconds) {
    const safe = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
  }

  function announce(instance, message) {
    const live = instance.root.querySelector("[data-gdv-live]");
    if (!live) return;
    live.textContent = "";
    global.requestAnimationFrame?.(() => { if (instances.get(instance.root) === instance) live.textContent = String(message || ""); });
  }

  function emitMediaPlayback(active) {
    if (!global.dispatchEvent || typeof global.CustomEvent !== "function") return;
    try {
      global.dispatchEvent(new global.CustomEvent("hh:media-playback", { detail: { active: Boolean(active), source: "galaxy-ambient-room" } }));
    } catch {}
  }

  function navigate(instance, route) {
    const next = cleanRoute(route);
    if (!next.startsWith("/") || next.startsWith("//")) return false;
    if (typeof instance.options.navigate === "function") instance.options.navigate(next);
    else if (global.location) global.location.hash = `#${next}`;
    return true;
  }

  function launchEngine(instance, engineId) {
    const target = ENGINE_TARGETS[engineId];
    if (!target) return false;
    if (typeof instance.options.openEngine === "function") {
      try {
        const handled = instance.options.openEngine({
          id: engineId,
          route: target.route,
          fallbackRoute: target.fallbackRoute,
          label: target.label,
          host: instance.root
        });
        if (handled && typeof handled.catch === "function") handled.catch((error) => {
          instance.errors.push(String(error?.message || error));
          announce(instance, `Không thể mở ${target.label}.`);
        });
        if (handled !== false) return true;
      } catch (error) {
        instance.errors.push(String(error?.message || error));
        announce(instance, `Không thể mở ${target.label}.`);
        return false;
      }
    }
    return navigate(instance, target.fallbackRoute);
  }

  async function updateStorageEstimate(instance) {
    if (instance.view !== "projects" || typeof global.navigator?.storage?.estimate !== "function") return;
    try {
      const estimate = await global.navigator.storage.estimate();
      if (instances.get(instance.root) !== instance) return;
      const usage = Number(estimate?.usage);
      const quota = Number(estimate?.quota);
      const percentage = Number.isFinite(usage) && Number.isFinite(quota) && quota > 0 ? Math.min(100, Math.max(0, (usage / quota) * 100)) : null;
      instance.capabilities.storageEstimate = percentage == null ? "degraded" : "ready";
      instance.storage = { usage: Number.isFinite(usage) ? usage : null, quota: Number.isFinite(quota) ? quota : null, percentage };
      const value = instance.root.querySelector("[data-gdv-storage-estimate]");
      const meter = instance.root.querySelector("[data-gdv-storage-meter]");
      const note = instance.root.querySelector("[data-gdv-storage-note]");
      const status = instance.root.querySelector(".gdv-storage-card .gdv-status");
      if (value) value.innerHTML = percentage == null ? `<strong>Không khả dụng</strong><small>Trình duyệt không trả quota</small>` : `<strong>${formatBytes(usage)} / ${formatBytes(quota)}</strong><small>${percentage.toFixed(1)}% dung lượng trình duyệt đã dùng</small>`;
      if (meter) meter.style.setProperty("--value", String(percentage || 0));
      if (note) note.textContent = percentage == null ? "Storage API không cung cấp đủ dữ liệu trên thiết bị này." : "Số liệu trực tiếp từ navigator.storage.estimate().";
      if (status) { status.className = `gdv-status gdv-status--${instance.capabilities.storageEstimate}`; status.lastChild.textContent = capabilityLabel(instance.capabilities.storageEstimate); }
    } catch (error) {
      if (instances.get(instance.root) !== instance) return;
      instance.capabilities.storageEstimate = "error";
      instance.errors.push(String(error?.message || error));
      const note = instance.root.querySelector("[data-gdv-storage-note]");
      if (note) note.textContent = "Không thể đọc Storage API. Hãy kiểm tra quyền của trình duyệt.";
    }
  }

  function createNoiseBuffer(context, kind) {
    const duration = 2;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const channel = buffer.getChannelData(0);
    let brown = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      if (kind === "wind") {
        brown = (brown + 0.02 * white) / 1.02;
        channel[index] = brown * 3.5;
      } else if (kind === "fire") {
        channel[index] = Math.random() > 0.992 ? white * 0.9 : white * 0.04;
      } else channel[index] = white * 0.45;
    }
    return buffer;
  }

  function startAmbientAudio(instance) {
    if (instance.audio || instance.capabilities.audio === "unsupported") return;
    const AudioContextCtor = global.AudioContext || global.webkitAudioContext;
    if (!AudioContextCtor) return;
    let context = null;
    const startedNodes = [];
    try {
      context = new AudioContextCtor();
      const master = context.createGain();
      const analyser = context.createAnalyser();
      master.gain.value = 0.55;
      analyser.fftSize = 512;
      master.connect(analyser);
      analyser.connect(context.destination);
      const sources = {};
      ["rain", "wind", "fire"].forEach((id) => {
        const source = context.createBufferSource();
        const filter = context.createBiquadFilter();
        const gain = context.createGain();
        source.buffer = createNoiseBuffer(context, id);
        source.loop = true;
        filter.type = id === "rain" ? "highpass" : "lowpass";
        filter.frequency.value = id === "rain" ? 900 : (id === "wind" ? 520 : 1800);
        gain.gain.value = instance.preferences.mix[id];
        source.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        source.start();
        startedNodes.push(source);
        sources[id] = { source, gain, filter };
      });
      const focusGain = context.createGain();
      focusGain.gain.value = instance.preferences.mix.focus * 0.16;
      focusGain.connect(master);
      const focusOscillators = [110, 164.81, 220].map((frequency, index) => {
        const oscillator = context.createOscillator();
        const voiceGain = context.createGain();
        oscillator.type = index ? "sine" : "triangle";
        oscillator.frequency.value = frequency;
        voiceGain.gain.value = index ? 0.22 : 0.34;
        oscillator.connect(voiceGain);
        voiceGain.connect(focusGain);
        oscillator.start();
        startedNodes.push(oscillator);
        return { source: oscillator, gain: voiceGain };
      });
      sources.focus = { gain: focusGain, oscillators: focusOscillators };
      instance.audio = { context, master, analyser, sources, running: true };
      instance.capabilities.audio = "loading";
      updateAudioUi(instance);
      Promise.resolve(context.resume()).then(() => {
        if (instance.audio?.context !== context || instances.get(instance.root) !== instance) return;
        instance.capabilities.audio = "ready";
        updateAudioUi(instance);
        drawWaveform(instance);
        emitMediaPlayback(true);
        announce(instance, "Đã bật âm thanh Ambient Room.");
      }).catch((error) => {
        if (instance.audio?.context === context) stopAmbientAudio(instance);
        instance.capabilities.audio = "error";
        instance.errors.push(String(error?.message || error));
        updateAudioUi(instance);
        announce(instance, "Không thể khởi động Web Audio trên trình duyệt này.");
      });
    } catch (error) {
      startedNodes.forEach((node) => { try { node.stop(); } catch {} });
      closeAudioContext(context);
      instance.audio = null;
      instance.capabilities.audio = "error";
      instance.errors.push(String(error?.message || error));
      updateAudioUi(instance);
      announce(instance, "Không thể khởi động Web Audio trên trình duyệt này.");
    }
  }

  function closeAudioContext(context) {
    if (!context || typeof context.close !== "function") return;
    try {
      const closing = context.close();
      if (closing && typeof closing.catch === "function") closing.catch(() => {});
    } catch {}
  }

  function stopAmbientAudio(instance) {
    if (!instance.audio) return;
    cancelWaveform(instance);
    const audio = instance.audio;
    instance.audio = null;
    audio.running = false;
    Object.values(audio.sources).forEach((entry) => {
      try { entry.source?.stop(); } catch {}
      (entry.oscillators || []).forEach((voice) => { try { voice.source.stop(); } catch {} });
      try { entry.source?.disconnect(); } catch {}
      try { entry.filter?.disconnect(); } catch {}
      try { entry.gain?.disconnect(); } catch {}
      (entry.oscillators || []).forEach((voice) => {
        try { voice.source.disconnect(); } catch {}
        try { voice.gain.disconnect(); } catch {}
      });
    });
    try { audio.master.disconnect(); } catch {}
    try { audio.analyser.disconnect(); } catch {}
    closeAudioContext(audio.context);
    emitMediaPlayback(false);
    instance.capabilities.audio = (global.AudioContext || global.webkitAudioContext) ? "idle" : "unsupported";
    updateAudioUi(instance);
  }

  function updateAudioUi(instance) {
    const buttons = instance.root.querySelectorAll("[data-gdv-audio-toggle]");
    const playing = instance.root.querySelector("[data-gdv-now-playing]");
    const status = instance.root.querySelector(".gdv-mixer .gdv-status");
    buttons.forEach((button) => {
      const compact = button.hasAttribute("data-gdv-audio-compact");
      button.textContent = compact
        ? (instance.audio ? "Ⅱ" : "▶")
        : (instance.audio ? "Tắt âm thanh" : (instance.capabilities.audio === "unsupported" ? "Trình duyệt không hỗ trợ" : "Bật âm thanh"));
      button.setAttribute("aria-pressed", String(Boolean(instance.audio)));
      button.setAttribute("aria-label", instance.audio ? "Tắt âm thanh" : "Bật âm thanh");
      button.disabled = instance.capabilities.audio === "unsupported";
    });
    if (playing) playing.textContent = instance.audio && instance.capabilities.audio === "ready" ? "Procedural ambient đang phát" : (instance.capabilities.audio === "loading" ? "Đang khởi động Web Audio" : "Âm thanh chưa bật");
    if (status) {
      status.className = `gdv-status gdv-status--${instance.capabilities.audio}`;
      status.lastChild.textContent = instance.audio && instance.capabilities.audio === "ready" ? "Đang phát" : capabilityLabel(instance.capabilities.audio);
    }
  }

  function setMix(instance, id, value) {
    if (!Object.hasOwn(instance.preferences.mix, id)) return;
    const normalized = clamp(value, 0, 100, 0) / 100;
    instance.preferences.mix[id] = normalized;
    savePreferences(instance.preferences);
    const output = instance.root.querySelector(`[data-gdv-mix-output="${id}"]`);
    if (output) output.textContent = `${Math.round(normalized * 100)}%`;
    const entry = instance.audio?.sources[id];
    const now = instance.audio?.context?.currentTime || 0;
    const target = id === "focus" ? normalized * 0.16 : normalized;
    if (entry?.gain?.gain) entry.gain.gain.setTargetAtTime(target, now, 0.04);
  }

  function applyScene(instance, scene) {
    const presets = {
      rainy: { rain: 0.68, wind: 0.2, fire: 0.12, focus: 0.18 },
      cafe: { rain: 0.36, wind: 0.08, fire: 0.2, focus: 0.23 },
      cozy: { rain: 0.18, wind: 0.08, fire: 0.42, focus: 0.1 },
      forest: { rain: 0.31, wind: 0.36, fire: 0.08, focus: 0.14 },
      deep: { rain: 0.14, wind: 0.1, fire: 0.04, focus: 0.48 }
    };
    if (!presets[scene]) return;
    instance.preferences.ambientScene = scene;
    Object.entries(presets[scene]).forEach(([id, value]) => {
      const input = instance.root.querySelector(`[data-gdv-mix="${id}"]`);
      if (input) input.value = String(Math.round(value * 100));
      setMix(instance, id, value * 100);
    });
    instance.root.querySelectorAll("[data-gdv-scene]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.gdvScene === scene)));
    const sceneElement = instance.root.querySelector("[data-gdv-scene-active]");
    if (sceneElement) sceneElement.dataset.gdvSceneActive = scene;
    savePreferences(instance.preferences);
    announce(instance, `Đã chọn preset ${scene}.`);
  }

  function drawWaveform(instance) {
    cancelWaveform(instance);
    if (!instance.audio || instance.pausedByVisibility) return;
    const canvas = instance.root.querySelector("[data-gdv-waveform]");
    const context2d = canvas?.getContext?.("2d");
    if (!canvas || !context2d) return;
    const data = new Uint8Array(instance.audio.analyser.fftSize);
    const draw = () => {
      if (!instance.audio || instance.pausedByVisibility || instances.get(instance.root) !== instance) return;
      instance.audio.analyser.getByteTimeDomainData(data);
      const width = canvas.width;
      const height = canvas.height;
      context2d.clearRect(0, 0, width, height);
      const gradient = context2d.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, "#53d7ff");
      gradient.addColorStop(0.5, "#b95cff");
      gradient.addColorStop(1, "#ff6fcf");
      context2d.strokeStyle = gradient;
      context2d.lineWidth = 3;
      context2d.beginPath();
      const slice = width / data.length;
      data.forEach((sample, index) => {
        const x = index * slice;
        const y = (sample / 255) * height;
        if (!index) context2d.moveTo(x, y); else context2d.lineTo(x, y);
      });
      context2d.stroke();
      instance.waveformFrame = global.requestAnimationFrame(draw);
    };
    instance.waveformFrame = global.requestAnimationFrame(draw);
  }

  function cancelWaveform(instance) {
    if (instance.waveformFrame) global.cancelAnimationFrame?.(instance.waveformFrame);
    instance.waveformFrame = 0;
  }

  function updateTimer(instance) {
    if (instance.timer.running) {
      instance.timer.remaining = Math.max(0, Math.ceil((instance.timer.endsAt - Date.now()) / 1000));
      if (instance.timer.remaining <= 0) {
        instance.timer.running = false;
        instance.timer.endsAt = 0;
        if (instance.timer.interval) global.clearInterval(instance.timer.interval);
        instance.timer.interval = 0;
        announce(instance, "Phiên tập trung đã hoàn thành.");
      }
    }
    const text = instance.root.querySelector("[data-gdv-timer-text]");
    const state = instance.root.querySelector("[data-gdv-timer-state]");
    const toggle = instance.root.querySelector("[data-gdv-timer-toggle]");
    if (text) text.textContent = formatTimer(instance.timer.remaining);
    const completed = !instance.timer.running && instance.timer.remaining <= 0;
    if (state) state.textContent = instance.timer.running ? "Đang tập trung" : (completed ? "Đã hoàn thành" : (instance.timer.remaining < instance.preferences.timerMinutes * 60 ? "Đã tạm dừng" : "Chưa bắt đầu"));
    if (toggle) {
      toggle.textContent = instance.timer.running ? "Tạm dừng" : (completed ? "Bắt đầu lại" : "Bắt đầu");
      toggle.setAttribute("aria-label", instance.timer.running ? "Tạm dừng Pomodoro" : (completed ? "Bắt đầu lại Pomodoro" : "Bắt đầu Pomodoro"));
    }
  }

  function toggleTimer(instance) {
    if (instance.timer.running) {
      instance.timer.remaining = Math.max(0, Math.ceil((instance.timer.endsAt - Date.now()) / 1000));
      instance.timer.running = false;
      instance.timer.endsAt = 0;
      if (instance.timer.interval) global.clearInterval(instance.timer.interval);
      instance.timer.interval = 0;
    } else {
      if (instance.timer.remaining <= 0) instance.timer.remaining = instance.preferences.timerMinutes * 60;
      instance.timer.running = true;
      instance.timer.endsAt = Date.now() + instance.timer.remaining * 1000;
    }
    if (instance.timer.running && !instance.timer.interval) instance.timer.interval = global.setInterval(() => updateTimer(instance), 500);
    updateTimer(instance);
  }

  function resetTimer(instance, minutes = instance.preferences.timerMinutes) {
    instance.preferences.timerMinutes = minutes;
    instance.timer.running = false;
    instance.timer.endsAt = 0;
    instance.timer.remaining = minutes * 60;
    if (instance.timer.interval) global.clearInterval(instance.timer.interval);
    instance.timer.interval = 0;
    savePreferences(instance.preferences);
    instance.root.querySelectorAll("[data-gdv-timer-minutes]").forEach((button) => button.setAttribute("aria-pressed", String(Number(button.dataset.gdvTimerMinutes) === minutes)));
    updateTimer(instance);
    announce(instance, `Đã đặt hẹn giờ ${minutes} phút.`);
  }

  function updateDesktopStage(instance, focusSelector = "") {
    const stage = instance.root.querySelector("[data-gdv-desktop-stage]");
    if (!stage) return;
    stage.innerHTML = instance.preferences.desktopEnabled ? desktopWorkspaceMarkup(instance) : desktopConsentMarkup();
    if (focusSelector) global.requestAnimationFrame?.(() => instance.root.querySelector(focusSelector)?.focus({ preventScroll: true }));
  }

  function updateDesktopVisibilityUi(instance) {
    const status = instance.root.querySelector(".gdv-desktop-topbar .gdv-status");
    if (status) {
      const next = instance.desktop.visible ? "ready" : "degraded";
      status.className = `gdv-status gdv-status--${next}`;
      status.lastChild.textContent = instance.desktop.visible ? "Governor hoạt động" : "Tab nền · preview tạm dừng";
    }
    instance.root.querySelectorAll("[data-gdv-window]").forEach((windowElement) => {
      const note = windowElement.querySelector("div > small");
      if (note) note.textContent = instance.desktop.visible && instance.desktop.activeId === windowElement.dataset.gdvWindow ? "Foreground preview" : "Preview đang nghỉ";
    });
  }

  function openDesktopApp(instance, id) {
    if (!DESKTOP_APPS.some((item) => item.id === id)) return;
    const windows = instance.desktop.windows.filter((item) => item !== id);
    windows.push(id);
    while (windows.length > MAX_DESKTOP_WINDOWS) windows.shift();
    instance.desktop.windows = windows;
    instance.desktop.activeId = id;
    updateDesktopStage(instance, `[data-gdv-window="${id}"]`);
    announce(instance, `Đã mở launcher ${DESKTOP_APPS.find((item) => item.id === id).title}.`);
  }

  function closeDesktopApp(instance, id) {
    instance.desktop.windows = instance.desktop.windows.filter((item) => item !== id);
    if (instance.desktop.activeId === id) instance.desktop.activeId = instance.desktop.windows.at(-1) || "";
    const nextFocus = instance.desktop.activeId ? `[data-gdv-window="${instance.desktop.activeId}"]` : `[data-gdv-desktop-app="${id}"]`;
    updateDesktopStage(instance, nextFocus);
  }

  function handleClick(instance, event) {
    const engineButton = event.target.closest("[data-gdv-engine]");
    if (engineButton && instance.root.contains(engineButton)) {
      event.preventDefault();
      launchEngine(instance, engineButton.dataset.gdvEngine);
      return;
    }
    const routeButton = event.target.closest("[data-gdv-route]");
    if (routeButton && instance.root.contains(routeButton)) {
      event.preventDefault();
      navigate(instance, routeButton.dataset.gdvRoute);
      return;
    }
    if (event.target.closest("[data-gdv-audio-toggle]")) {
      if (instance.audio) { stopAmbientAudio(instance); announce(instance, "Đã tắt âm thanh Ambient Room."); }
      else startAmbientAudio(instance);
      return;
    }
    const scene = event.target.closest("[data-gdv-scene]");
    if (scene) { applyScene(instance, scene.dataset.gdvScene); return; }
    if (event.target.closest("[data-gdv-timer-toggle]")) { toggleTimer(instance); return; }
    if (event.target.closest("[data-gdv-timer-reset]")) { resetTimer(instance); return; }
    const timerPreset = event.target.closest("[data-gdv-timer-minutes]");
    if (timerPreset) { resetTimer(instance, Number(timerPreset.dataset.gdvTimerMinutes)); return; }
    const projectView = event.target.closest("[data-gdv-project-view]");
    if (projectView) {
      const mode = projectView.dataset.gdvProjectView === "list" ? "list" : "grid";
      const grid = instance.root.querySelector("[data-gdv-project-view-mode]");
      if (grid) grid.dataset.gdvProjectViewMode = mode;
      instance.root.querySelectorAll("[data-gdv-project-view]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.gdvProjectView === mode)));
      announce(instance, `Đã chuyển Project Hub sang chế độ ${mode === "list" ? "danh sách" : "lưới"}.`);
      return;
    }
    if (event.target.closest("[data-gdv-desktop-enable]")) {
      instance.preferences.desktopEnabled = true;
      instance.capabilities.desktop = "ready";
      savePreferences(instance.preferences);
      updateDesktopStage(instance, "[data-gdv-desktop-app]");
      announce(instance, "Đã bật HH Web Desktop.");
      return;
    }
    if (event.target.closest("[data-gdv-desktop-disable]")) {
      instance.preferences.desktopEnabled = false;
      instance.desktop.windows = [];
      instance.desktop.activeId = "";
      instance.capabilities.desktop = "idle";
      savePreferences(instance.preferences);
      updateDesktopStage(instance, "[data-gdv-desktop-enable]");
      announce(instance, "Đã tắt HH Web Desktop.");
      return;
    }
    const desktopApp = event.target.closest("[data-gdv-desktop-app]");
    if (desktopApp) { openDesktopApp(instance, desktopApp.dataset.gdvDesktopApp); return; }
    const closeWindow = event.target.closest("[data-gdv-window-close]");
    if (closeWindow) { closeDesktopApp(instance, closeWindow.dataset.gdvWindowClose); return; }
    const windowElement = event.target.closest("[data-gdv-window]");
    if (windowElement) {
      instance.desktop.activeId = windowElement.dataset.gdvWindow;
      updateDesktopStage(instance);
    }
  }

  function handleInput(instance, event) {
    const slider = event.target.closest("[data-gdv-mix]");
    if (slider) setMix(instance, slider.dataset.gdvMix, slider.value);
    const navSearch = event.target.closest("[data-gdv-nav-search]");
    if (navSearch) {
      const query = String(navSearch.value || "").trim().toLocaleLowerCase("vi-VN");
      instance.root.querySelectorAll("[data-gdv-nav-item]").forEach((item) => {
        const label = String(item.textContent || "").toLocaleLowerCase("vi-VN");
        item.hidden = Boolean(query && !label.includes(query));
      });
    }
    const globalSearch = event.target.closest("[data-gdv-global-search]");
    const projectSearch = event.target.closest("[data-gdv-project-search]");
    const automationSearch = event.target.closest("[data-gdv-automation-search]");
    const filterInput = projectSearch || automationSearch || globalSearch;
    if (filterInput) {
      const query = String(filterInput.value || "").trim().toLocaleLowerCase("vi-VN");
      instance.root.querySelectorAll("[data-gdv-filterable]").forEach((item) => {
        const haystack = String(item.dataset.gdvFilterable || item.textContent || "").toLocaleLowerCase("vi-VN");
        item.hidden = Boolean(query && !haystack.includes(query));
      });
      if (globalSearch) {
        instance.root.querySelectorAll("[data-gdv-nav-item]").forEach((item) => {
          const label = String(item.textContent || "").toLocaleLowerCase("vi-VN");
          item.hidden = Boolean(query && !label.includes(query));
        });
      }
    }
  }

  function handleVisibility(instance) {
    instance.pausedByVisibility = Boolean(global.document?.hidden);
    instance.desktop.visible = !instance.pausedByVisibility;
    instance.root.dataset.gdvVisibility = instance.pausedByVisibility ? "hidden" : "visible";
    if (instance.pausedByVisibility) cancelWaveform(instance); else if (instance.audio) drawWaveform(instance);
    if (instance.timer.running) updateTimer(instance);
    if (instance.view === "desktop" && instance.preferences.desktopEnabled) updateDesktopVisibilityUi(instance);
  }

  function mount(root, options = {}) {
    if (!root || typeof root.querySelector !== "function") throw new TypeError("HHGalaxyDomainViews.mount cần một root element hợp lệ.");
    unmount(root);
    const definition = routeDefinition(options.route || global.location?.hash || "/create/workflow");
    if (!definition) throw new Error("Route không thuộc HH Galaxy Domain Views.");
    const preferences = readPreferences();
    const instance = {
      root,
      options,
      view: definition.id,
      route: definition.canonical,
      mountedAt: new Date().toISOString(),
      preferences,
      capabilities: browserCapabilities(options),
      data: collectLocalData(options),
      cleanup: [],
      errors: [],
      storage: null,
      audio: null,
      waveformFrame: 0,
      pausedByVisibility: Boolean(global.document?.hidden),
      timer: { running: false, endsAt: 0, remaining: preferences.timerMinutes * 60, interval: 0 },
      desktop: { windows: [], activeId: "", visible: !global.document?.hidden }
    };
    root.classList.add("gdv-host");
    root.dataset.gdvMounted = definition.id;
    root.dataset.gdvVisibility = instance.pausedByVisibility ? "hidden" : "visible";
    instances.set(root, instance);
    mountedRoots.add(root);
    render(instance);
    addListener(instance, root, "click", (event) => handleClick(instance, event));
    addListener(instance, root, "input", (event) => handleInput(instance, event));
    addListener(instance, global.document, "visibilitychange", () => handleVisibility(instance));
    addListener(instance, global, "online", () => {
      const supplied = options.capabilities && typeof options.capabilities === "object" ? options.capabilities : {};
      const verified = supplied.community === true || supplied.community === "ready";
      instance.capabilities.community = verified ? "ready" : (String(options.apiBase || global.HH_REALTIME_URL || "").trim() ? "degraded" : "configuration-required");
      if (instance.view === "community") render(instance);
    });
    addListener(instance, global, "offline", () => {
      instance.capabilities.community = "offline";
      if (instance.view === "community") render(instance);
    });
    updateStorageEstimate(instance);
    return {
      route: definition.canonical,
      view: definition.id,
      navigate: (route) => navigate(instance, route),
      getState: () => getState(root),
      unmount: () => unmount(root)
    };
  }

  function unmount(root) {
    if (!root) {
      [...mountedRoots].forEach((entry) => unmount(entry));
      return;
    }
    const instance = instances.get(root);
    if (!instance) return;
    stopAmbientAudio(instance);
    cancelWaveform(instance);
    if (instance.timer.interval) global.clearInterval(instance.timer.interval);
    instance.timer.interval = 0;
    instance.timer.running = false;
    instance.timer.endsAt = 0;
    instance.cleanup.splice(0).reverse().forEach((cleanup) => { try { cleanup(); } catch {} });
    instances.delete(root);
    mountedRoots.delete(root);
    root.classList.remove("gdv-host");
    delete root.dataset.gdvMounted;
    delete root.dataset.gdvVisibility;
    root.replaceChildren();
  }

  function stateFor(instance) {
    return {
      version: VERSION,
      view: instance.view,
      route: instance.route,
      mountedAt: instance.mountedAt,
      capabilities: clone(instance.capabilities),
      projectCount: instance.data.projects.length,
      automationCount: instance.data.automations.length,
      automationRunCount: instance.data.automationRuns.length,
      communityItemCount: instance.data.communityItems.length,
      storage: clone(instance.storage),
      audio: { active: Boolean(instance.audio), state: instance.audio?.context?.state || instance.capabilities.audio },
      timer: { running: instance.timer.running, remaining: instance.timer.running ? Math.max(0, Math.ceil((instance.timer.endsAt - Date.now()) / 1000)) : instance.timer.remaining },
      desktop: clone(instance.desktop),
      errors: [...instance.errors]
    };
  }

  function getState(root) {
    if (root) {
      const instance = instances.get(root);
      return instance ? stateFor(instance) : null;
    }
    return [...mountedRoots].map((entry) => instances.get(entry)).filter(Boolean).map(stateFor);
  }

  const api = Object.freeze({
    version: VERSION,
    routes: ROUTES,
    mount,
    unmount,
    canHandle,
    getState
  });

  global.HHGalaxyDomainViews = api;
})(typeof window !== "undefined" ? window : globalThis);
