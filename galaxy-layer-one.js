(function galaxyLayerOneBootstrap(root, factory) {
  "use strict";

  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHGalaxyLayerOne = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createGalaxyLayerOne(globalScope) {
  "use strict";

  const VERSION = 1;
  const STORAGE_KEY = "hh.galaxy.layer-one.v1";
  const EVENT_PREFIX = "hh:galaxy:layer-one";
  const MAX_ITEMS = 120;
  const MAX_EVENTS = 300;

  const ICONS = Object.freeze({
    home: "<path d=\"M3 11.5 12 4l9 7.5v8a1.5 1.5 0 0 1-1.5 1.5h-5v-6h-5v6h-5A1.5 1.5 0 0 1 3 19.5z\"/>",
    ai: "<path d=\"M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1\"/><circle cx=\"12\" cy=\"12\" r=\"4\"/>",
    music: "<path d=\"M9 18V6l10-2v12\"/><circle cx=\"6.5\" cy=\"18\" r=\"2.5\"/><circle cx=\"16.5\" cy=\"16\" r=\"2.5\"/>",
    video: "<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"3\"/><path d=\"m10 9 6 3-6 3z\"/>",
    creator: "<path d=\"M4 20h16M6 16l7-7 3 3-7 7H6zM14.5 7.5l2-2a1.4 1.4 0 0 1 2 0l.5.5a1.4 1.4 0 0 1 0 2l-2 2\"/>",
    games: "<path d=\"M8 8h8a5 5 0 0 1 4.8 6.4l-1 3.4a2 2 0 0 1-3.2 1l-2.2-1.8H9.6l-2.2 1.8a2 2 0 0 1-3.2-1l-1-3.4A5 5 0 0 1 8 8z\"/><path d=\"M7 11v4m-2-2h4m7-1h.01m2 2h.01\"/>",
    dev: "<path d=\"m8 9-4 3 4 3m8-6 4 3-4 3m-2-9-4 12\"/>",
    learning: "<path d=\"m3 9 9-5 9 5-9 5z\"/><path d=\"M7 12.5V17c3 2 7 2 10 0v-4.5M21 9v6\"/>",
    community: "<circle cx=\"9\" cy=\"8\" r=\"3\"/><circle cx=\"17\" cy=\"9\" r=\"2.5\"/><path d=\"M3.5 20v-2a5.5 5.5 0 0 1 11 0v2m1-5a4 4 0 0 1 5 4v1\"/>",
    tools: "<path d=\"m14 6 4-4 4 4-4 4zM2 18l4-4 4 4-4 4zM14 18l4-4 4 4-4 4zM2 6l4-4 4 4-4 4z\"/><path d=\"M8 8l8 8m0-8-8 8\"/>",
    analytics: "<path d=\"M4 20V10m5 10V4m6 16v-7m5 7V7\"/>",
    settings: "<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z\"/>",
    search: "<circle cx=\"11\" cy=\"11\" r=\"7\"/><path d=\"m20 20-4-4\"/>",
    menu: "<path d=\"M4 7h16M4 12h16M4 17h16\"/>",
    close: "<path d=\"m6 6 12 12M18 6 6 18\"/>",
    arrow: "<path d=\"m9 18 6-6-6-6\"/>",
    plus: "<path d=\"M12 5v14M5 12h14\"/>",
    database: "<ellipse cx=\"12\" cy=\"5\" rx=\"8\" ry=\"3\"/><path d=\"M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7\"/>",
    download: "<path d=\"M12 3v12m-5-5 5 5 5-5M4 21h16\"/>",
    upload: "<path d=\"M12 17V5m-5 5 5-5 5 5M4 21h16\"/>",
    bell: "<path d=\"M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4\"/>",
    help: "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M9.8 9a2.4 2.4 0 1 1 3.6 2.1c-1 .6-1.4 1.1-1.4 2.4M12 17h.01\"/>"
  });

  function icon(name, className) {
    const body = ICONS[name] || ICONS.home;
    return "<svg class=\"" + (className || "hgl1-icon") + "\" viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\">" + body + "</svg>";
  }

  function freezeManifest(list) {
    return Object.freeze(list.map(function freezeEntry(entry) {
      return Object.freeze({
        id: entry.id,
        route: entry.route,
        label: entry.label,
        title: entry.title,
        eyebrow: entry.eyebrow,
        description: entry.description,
        icon: entry.icon,
        tone: entry.tone,
        keywords: Object.freeze(entry.keywords.slice())
      });
    }));
  }

  const routeManifest = freezeManifest([
    { id: "home", route: "/home", label: "Trang chủ", title: "HH Galaxy", eyebrow: "Bản đồ điều hướng", description: "Khám phá các không gian độc lập trong HH Galaxy.", icon: "home", tone: "violet", keywords: ["trang chủ", "bản đồ", "galaxy"] },
    { id: "ai", route: "/galaxy/ai", label: "AI Universe", title: "AI Universe", eyebrow: "Không gian trí tuệ nhân tạo", description: "Quản lý prompt, ghi chú và kết nối AI theo cấu hình của bạn.", icon: "ai", tone: "violet", keywords: ["ai", "prompt", "hội thoại", "trí tuệ nhân tạo"] },
    { id: "music", route: "/galaxy/music", label: "Music Planet", title: "Music Planet", eyebrow: "Xưởng âm thanh cục bộ", description: "Tổ chức tệp âm thanh, playlist và metadata trên thiết bị.", icon: "music", tone: "pink", keywords: ["nhạc", "music", "audio", "playlist"] },
    { id: "video", route: "/galaxy/video", label: "Video Planet", title: "Video Planet", eyebrow: "Không gian video", description: "Chuẩn bị media, caption, thumbnail và dự án video độc lập.", icon: "video", tone: "rose", keywords: ["video", "media", "caption", "thumbnail"] },
    { id: "creator", route: "/galaxy/creator", label: "Creator Studio", title: "Creator Studio", eyebrow: "Quy trình sáng tạo nội dung", description: "Điều phối chín bước sản xuất trong workspace lớp 1.", icon: "creator", tone: "violet", keywords: ["creator", "sáng tạo", "pipeline", "kịch bản"] },
    { id: "games", route: "/galaxy/games", label: "Games World", title: "Games World", eyebrow: "Thư viện trò chơi", description: "Quản lý game web, save cục bộ và tùy chọn trợ năng.", icon: "games", tone: "green", keywords: ["game", "trò chơi", "save", "sandbox"] },
    { id: "dev", route: "/galaxy/dev", label: "Dev Planet", title: "Dev Planet", eyebrow: "Không gian phát triển", description: "Lưu snippet, dự án code và thử nghiệm trong sandbox.", icon: "dev", tone: "yellow", keywords: ["dev", "code", "json", "api", "snippet"] },
    { id: "learning", route: "/galaxy/learning", label: "Learning Star", title: "Learning Star", eyebrow: "Học tập chủ động", description: "Ghi chú, flashcard, quiz và tiến độ dựa trên hoạt động thật.", icon: "learning", tone: "amber", keywords: ["học", "khóa học", "quiz", "flashcard"] },
    { id: "community", route: "/galaxy/community", label: "Community", title: "Community", eyebrow: "Không gian cộng đồng", description: "Soạn bài, quản lý nhóm và sự kiện; realtime cần backend thật.", icon: "community", tone: "pink", keywords: ["cộng đồng", "bài viết", "nhóm", "sự kiện"] },
    { id: "tools", route: "/galaxy/tools", label: "Tools Galaxy", title: "Tools Galaxy", eyebrow: "Tiện ích cục bộ", description: "Xử lý văn bản và JSON trực tiếp trong trình duyệt.", icon: "tools", tone: "cyan", keywords: ["công cụ", "tools", "json", "văn bản"] },
    { id: "analytics", route: "/galaxy/analytics", label: "Analytics", title: "Analytics", eyebrow: "Số liệu HH Galaxy", description: "Chỉ tổng hợp dữ liệu lớp 1 thật được lưu trên thiết bị.", icon: "analytics", tone: "blue", keywords: ["analytics", "thống kê", "dữ liệu", "csv"] },
    { id: "settings", route: "/galaxy/settings", label: "Cài đặt", title: "Cài đặt Galaxy", eyebrow: "Quyền riêng tư và giao diện", description: "Thiết lập riêng cho lớp 1, sao lưu và khôi phục dữ liệu.", icon: "settings", tone: "slate", keywords: ["cài đặt", "settings", "backup", "quyền riêng tư"] }
  ]);

  const routes = Object.freeze(routeManifest.map(function routeOf(entry) { return entry.route; }));
  const routeSet = new Set(routes);

  const MODULES = Object.freeze({
    "/galaxy/ai": Object.freeze({
      kind: "prompt", createLabel: "Tạo prompt cục bộ", fileAccept: ".txt,.md,.json,text/plain,application/json",
      status: "Chưa cấu hình nhà cung cấp AI", statusTone: "warning",
      features: Object.freeze([
        Object.freeze(["Thư viện prompt", "Lưu, tìm kiếm và xuất prompt ngay trên thiết bị.", "available"]),
        Object.freeze(["Hội thoại AI", "Cần backend proxy và nhà cung cấp được cấu hình.", "unconfigured"]),
        Object.freeze(["Đính kèm tài liệu", "Nhập metadata tệp; nội dung không tự gửi ra ngoài.", "available"])
      ])
    }),
    "/galaxy/music": Object.freeze({
      kind: "audio-project", createLabel: "Tạo dự án âm thanh", fileAccept: "audio/*",
      status: "Thư viện cục bộ sẵn sàng", statusTone: "local",
      features: Object.freeze([
        Object.freeze(["Thư viện âm thanh", "Nhập metadata tệp âm thanh từ thiết bị.", "available"]),
        Object.freeze(["Quyền microphone", "Chỉ được hỏi khi bạn chủ động kiểm tra.", "permission"]),
        Object.freeze(["Biên tập nhiều track", "Cần editor âm thanh chuyên dụng được gắn vào module.", "unconfigured"])
      ])
    }),
    "/galaxy/video": Object.freeze({
      kind: "video-project", createLabel: "Tạo dự án video", fileAccept: "video/*,image/*,.srt,.vtt",
      status: "Thư viện media cục bộ sẵn sàng", statusTone: "local",
      features: Object.freeze([
        Object.freeze(["Media library", "Nhập metadata video, ảnh và caption.", "available"]),
        Object.freeze(["Thumbnail & caption", "Theo dõi đầu việc trong dự án cục bộ.", "available"]),
        Object.freeze(["Timeline editor", "Cần editor video chuyên dụng được gắn vào module.", "unconfigured"])
      ])
    }),
    "/galaxy/games": Object.freeze({
      kind: "game-save", createLabel: "Tạo hồ sơ game", fileAccept: ".json,application/json",
      status: "Save game chỉ lưu trên thiết bị", statusTone: "local",
      features: Object.freeze([
        Object.freeze(["Save cục bộ", "Tạo và xuất hồ sơ save riêng trên trình duyệt.", "available"]),
        Object.freeze(["Game sandbox", "Chỉ khả dụng khi game web đã cung cấp runtime an toàn.", "unconfigured"]),
        Object.freeze(["Trợ năng", "Tùy chọn chuyển động được kế thừa từ Cài đặt Galaxy.", "available"])
      ])
    }),
    "/galaxy/dev": Object.freeze({
      kind: "code-project", createLabel: "Tạo snippet", fileAccept: ".html,.css,.js,.json,.md,text/*,application/json",
      status: "Workspace cục bộ, không thực thi mã tự động", statusTone: "local",
      features: Object.freeze([
        Object.freeze(["Snippet manager", "Tạo, tìm kiếm và xuất metadata dự án code.", "available"]),
        Object.freeze(["JSON formatter", "Mở trong Tools Galaxy và xử lý hoàn toàn cục bộ.", "available"]),
        Object.freeze(["Preview sandbox", "Cần runtime sandbox chuyên dụng trước khi chạy mã.", "unconfigured"])
      ])
    }),
    "/galaxy/learning": Object.freeze({
      kind: "learning-note", createLabel: "Tạo ghi chú học tập", fileAccept: ".txt,.md,.json,text/plain,application/json",
      status: "Tiến độ chỉ tính từ dữ liệu người dùng", statusTone: "local",
      features: Object.freeze([
        Object.freeze(["Ghi chú & bookmark", "Lưu tài liệu học tập cục bộ.", "available"]),
        Object.freeze(["Flashcard & quiz", "Cần nội dung do người dùng tạo hoặc khóa học được nhập.", "available"]),
        Object.freeze(["Chứng nhận", "Không cấp chứng nhận nếu chưa có tiêu chí và kết quả thật.", "unconfigured"])
      ])
    }),
    "/galaxy/community": Object.freeze({
      kind: "community-draft", createLabel: "Soạn bản nháp", fileAccept: ".txt,.md,.json,text/plain,application/json",
      status: "Ngoại tuyến cục bộ; realtime chưa cấu hình", statusTone: "warning",
      features: Object.freeze([
        Object.freeze(["Bản nháp bài viết", "Soạn và lưu bản nháp trên thiết bị.", "available"]),
        Object.freeze(["Nhóm & sự kiện", "Chỉ hiển thị sau khi backend trả dữ liệu thật.", "unconfigured"]),
        Object.freeze(["Realtime", "Không kết nối cho tới khi có dịch vụ backend hợp lệ.", "unconfigured"])
      ])
    })
  });

  function freezeTemplate(template) {
    return Object.freeze({
      id: template.id,
      route: template.route,
      title: template.title,
      kind: template.kind,
      description: template.description,
      isDemo: true,
      source: "local-template",
      templateVersion: "1.0.0",
      editable: false
    });
  }

  const templates = Object.freeze([
    freezeTemplate({ id: "template-ai-prompts", route: "/galaxy/ai", title: "Bản mẫu · Bộ prompt Khám phá ý tưởng", kind: "prompt", description: "Cấu trúc prompt có mục tiêu, ngữ cảnh và tiêu chí đầu ra." }),
    freezeTemplate({ id: "template-piano-rain", route: "/galaxy/music", title: "Bản nhạc mẫu · Piano Chill in the Rain", kind: "audio-project", description: "Khung metadata cho một dự án nhạc thư giãn." }),
    freezeTemplate({ id: "template-forest-video", route: "/galaxy/video", title: "Video mẫu · Forest Night Ambience", kind: "video-project", description: "Checklist media, caption và thumbnail cho video ambience." }),
    freezeTemplate({ id: "template-space-journey", route: "/galaxy/creator", title: "Dự án mẫu · AI Space Journey", kind: "creator-project", description: "Quy trình chín bước để chuẩn bị một nội dung khám phá vũ trụ." }),
    freezeTemplate({ id: "template-game-save", route: "/galaxy/games", title: "Bản mẫu · Hồ sơ game cục bộ", kind: "game-save", description: "Cấu trúc save không chứa điểm số hoặc thành tích giả." }),
    freezeTemplate({ id: "template-galaxy-landing", route: "/galaxy/dev", title: "Dự án code mẫu · Galaxy Landing Page", kind: "code-project", description: "Bộ đầu việc HTML, CSS và accessibility cho landing page." }),
    freezeTemplate({ id: "template-learning", route: "/galaxy/learning", title: "Khóa học mẫu · Nền tảng sáng tạo số", kind: "learning-note", description: "Khung ghi chú và mục tiêu; không chứa tiến độ giả." }),
    freezeTemplate({ id: "template-community", route: "/galaxy/community", title: "Bản mẫu · Bài giới thiệu cộng đồng", kind: "community-draft", description: "Bản nháp cục bộ, chưa được đăng và không có tương tác giả." }),
    freezeTemplate({ id: "template-tools", route: "/galaxy/tools", title: "Bản mẫu · Checklist xử lý dữ liệu", kind: "tool-note", description: "Các bước kiểm tra đầu vào trước khi dùng tiện ích cục bộ." })
  ]);

  const templateByRoute = new Map(templates.map(function mapTemplate(template) {
    return [template.route, template];
  }));

  function normalizeRoute(input) {
    let value = String(input || "/home").trim();
    if (/^https?:\/\//i.test(value)) {
      try {
        const UrlCtor = globalScope.URL || (typeof URL === "function" ? URL : null);
        const parsed = UrlCtor ? new UrlCtor(value) : null;
        value = parsed ? (parsed.hash ? parsed.hash.slice(1) : parsed.pathname) : "/home";
      } catch (_) {
        value = "/home";
      }
    }
    if (value.charAt(0) === "#") value = value.slice(1);
    value = value.split("?")[0].split("#")[0] || "/home";
    value = value.charAt(0) === "/" ? value : "/" + value;
    value = value.replace(/\/{2,}/g, "/");
    if (value.length > 1) value = value.replace(/\/+$/, "");
    return value || "/home";
  }

  function findRoute(input) {
    const route = normalizeRoute(input);
    const exact = routeManifest.find(function exactRoute(entry) { return entry.route === route; });
    if (exact) return exact;
    return routeManifest
      .filter(function prefixRoute(entry) {
        return entry.route !== "/home" && route.indexOf(entry.route + "/") === 0;
      })
      .sort(function longestFirst(a, b) { return b.route.length - a.route.length; })[0] || null;
  }

  function canHandle(input) {
    return Boolean(findRoute(input));
  }

  function normalizedSearchText(value) {
    return String(value || "")
      .toLocaleLowerCase("vi")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .trim();
  }

  function searchRoutes(query, limit) {
    const needle = normalizedSearchText(query);
    if (!needle) return Object.freeze([]);
    const terms = needle.split(/\s+/).filter(Boolean);
    const results = routeManifest.map(function scoreEntry(entry, index) {
      const label = normalizedSearchText(entry.label);
      const haystack = normalizedSearchText([entry.label, entry.title, entry.eyebrow, entry.description].concat(entry.keywords).join(" "));
      if (!terms.every(function containsTerm(term) { return haystack.indexOf(term) >= 0; })) {
        return { entry: entry, score: 0, index: index };
      }
      let score = 0;
      terms.forEach(function scoreTerm(term) {
        if (label === term) score += 12;
        else if (label.indexOf(term) === 0) score += 8;
        else if (label.indexOf(term) >= 0) score += 5;
        if (haystack.indexOf(term) >= 0) score += 2;
      });
      return { entry: entry, score: score, index: index };
    }).filter(function positive(result) {
      return result.score > 0;
    }).sort(function resultOrder(a, b) {
      return b.score - a.score || a.index - b.index;
    }).slice(0, Math.max(1, Math.min(Number(limit) || 6, 12))).map(function resultEntry(result) {
      return result.entry;
    });
    return Object.freeze(results);
  }

  function defaultSettings() {
    return {
      theme: "cosmic",
      effects: "balanced",
      contrast: "standard",
      reducedMotion: "system",
      analyticsConsent: false
    };
  }

  function emptyState() {
    return {
      version: VERSION,
      settings: defaultSettings(),
      items: [],
      events: []
    };
  }

  function resolveStorage(candidate) {
    if (candidate) return candidate;
    try { return globalScope.localStorage || null; }
    catch (_) { return null; }
  }

  function safeDate(value) {
    const time = Date.parse(String(value || ""));
    return Number.isFinite(time) ? new Date(time).toISOString() : new Date().toISOString();
  }

  function sanitizeSettings(value) {
    const source = value && typeof value === "object" ? value : {};
    const defaults = defaultSettings();
    return {
      theme: ["cosmic", "midnight"].includes(source.theme) ? source.theme : defaults.theme,
      effects: ["quiet", "balanced", "rich"].includes(source.effects) ? source.effects : defaults.effects,
      contrast: ["standard", "high"].includes(source.contrast) ? source.contrast : defaults.contrast,
      reducedMotion: ["system", "on", "off"].includes(source.reducedMotion) ? source.reducedMotion : defaults.reducedMotion,
      analyticsConsent: source.analyticsConsent === true
    };
  }

  function sanitizeItem(value) {
    if (!value || typeof value !== "object") return null;
    const match = findRoute(value.route);
    if (!match || ["/home", "/galaxy/analytics", "/galaxy/settings"].includes(match.route)) return null;
    const title = String(value.title || "").trim().slice(0, 160);
    if (!title) return null;
    const metaSource = value.meta && typeof value.meta === "object" ? value.meta : {};
    const meta = {
      fileName: String(metaSource.fileName || "").slice(0, 180),
      fileType: String(metaSource.fileType || "").slice(0, 120),
      fileSize: Math.max(0, Math.min(Number(metaSource.fileSize) || 0, Number.MAX_SAFE_INTEGER)),
      copiedFrom: String(metaSource.copiedFrom || "").slice(0, 100)
    };
    return {
      id: String(value.id || createId()).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 96) || createId(),
      route: match.route,
      title: title,
      kind: String(value.kind || "document").slice(0, 60),
      description: String(value.description || "").slice(0, 500),
      isDemo: false,
      source: value.source === "user-copy" ? "user-copy" : "user",
      editable: true,
      createdAt: safeDate(value.createdAt),
      updatedAt: safeDate(value.updatedAt || value.createdAt),
      meta: meta
    };
  }

  function sanitizeEvent(value) {
    if (!value || typeof value !== "object") return null;
    const allowed = new Set(["route-view", "item-create", "item-delete", "data-export", "data-import", "permission-check"]);
    const type = String(value.type || "");
    if (!allowed.has(type)) return null;
    const match = value.route ? findRoute(value.route) : null;
    return {
      id: String(value.id || createId()).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 96) || createId(),
      type: type,
      route: match ? match.route : "",
      at: safeDate(value.at)
    };
  }

  function sanitizeState(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      version: VERSION,
      settings: sanitizeSettings(source.settings),
      items: (Array.isArray(source.items) ? source.items : []).map(sanitizeItem).filter(Boolean).slice(-MAX_ITEMS),
      events: (Array.isArray(source.events) ? source.events : []).map(sanitizeEvent).filter(Boolean).slice(-MAX_EVENTS)
    };
  }

  function inspectLocalState(candidate) {
    const storage = resolveStorage(candidate);
    if (!storage) return { status: "unsupported", data: emptyState(), error: "STORAGE_UNAVAILABLE" };
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return { status: "ready", data: emptyState(), error: null };
      const parsed = JSON.parse(raw);
      return { status: "ready", data: sanitizeState(parsed), error: null };
    } catch (_) {
      return { status: "error", data: emptyState(), error: "STORAGE_READ_FAILED" };
    }
  }

  function collectLocalState(candidate) {
    return inspectLocalState(candidate).data;
  }

  function writeLocalState(value, candidate) {
    const storage = resolveStorage(candidate);
    if (!storage) return false;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(sanitizeState(value)));
      return true;
    } catch (_) {
      return false;
    }
  }

  function createId() {
    try {
      if (globalScope.crypto && typeof globalScope.crypto.randomUUID === "function") {
        return globalScope.crypto.randomUUID();
      }
    } catch (_) {
      /* A time-and-random local id remains adequate for non-security records. */
    }
    return "hgl1-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function recordEvent(type, route, candidate) {
    const result = inspectLocalState(candidate);
    if (result.status !== "ready" || result.data.settings.analyticsConsent !== true) return false;
    const event = sanitizeEvent({ id: createId(), type: type, route: route, at: new Date().toISOString() });
    if (!event) return false;
    result.data.events.push(event);
    result.data.events = result.data.events.slice(-MAX_EVENTS);
    return writeLocalState(result.data, candidate);
  }

  function createLocalItem(route, title, candidate, details) {
    const match = findRoute(route);
    if (!match || ["/home", "/galaxy/analytics", "/galaxy/settings"].includes(match.route)) return null;
    const cleanTitle = String(title || "").trim().slice(0, 160);
    if (!cleanTitle) return null;
    const result = inspectLocalState(candidate);
    if (result.status !== "ready") return null;
    const moduleDefinition = MODULES[match.route];
    const input = details && typeof details === "object" ? details : {};
    const now = new Date().toISOString();
    const item = sanitizeItem({
      id: createId(),
      route: match.route,
      title: cleanTitle,
      kind: input.kind || (moduleDefinition ? moduleDefinition.kind : match.id + "-document"),
      description: input.description || "",
      source: input.source || "user",
      createdAt: now,
      updatedAt: now,
      meta: input.meta || {}
    });
    if (!item) return null;
    result.data.items.push(item);
    result.data.items = result.data.items.slice(-MAX_ITEMS);
    if (!writeLocalState(result.data, candidate)) return null;
    recordEvent("item-create", match.route, candidate);
    return item;
  }

  function copyTemplate(route, candidate) {
    const match = findRoute(route);
    const template = match ? templateByRoute.get(match.route) : null;
    if (!template) return null;
    return createLocalItem(match.route, template.title.replace(/^.+?·\s*/, ""), candidate, {
      kind: template.kind,
      description: template.description,
      source: "user-copy",
      meta: { copiedFrom: template.id }
    });
  }

  function deleteLocalItem(id, candidate) {
    const cleanId = String(id || "");
    const result = inspectLocalState(candidate);
    if (result.status !== "ready") return false;
    const existing = result.data.items.find(function findItem(item) { return item.id === cleanId; });
    if (!existing) return false;
    result.data.items = result.data.items.filter(function keepItem(item) { return item.id !== cleanId; });
    if (!writeLocalState(result.data, candidate)) return false;
    recordEvent("item-delete", existing.route, candidate);
    return true;
  }

  function serializeBackup(candidate) {
    const state = collectLocalState(candidate);
    return JSON.stringify({
      schema: "hh-galaxy-layer-one-backup",
      version: VERSION,
      exportedAt: new Date().toISOString(),
      data: state
    }, null, 2);
  }

  function importBackup(text, candidate) {
    const sourceText = String(text || "");
    if (!sourceText || sourceText.length > 2 * 1024 * 1024) {
      return { ok: false, error: "BACKUP_SIZE_INVALID", imported: 0 };
    }
    try {
      const parsed = JSON.parse(sourceText);
      if (!parsed || parsed.schema !== "hh-galaxy-layer-one-backup" || Number(parsed.version) !== VERSION || !parsed.data) {
        return { ok: false, error: "BACKUP_SCHEMA_INVALID", imported: 0 };
      }
      const sanitized = sanitizeState(parsed.data);
      if (!writeLocalState(sanitized, candidate)) {
        return { ok: false, error: "BACKUP_WRITE_FAILED", imported: 0 };
      }
      recordEvent("data-import", "/galaxy/settings", candidate);
      return { ok: true, error: null, imported: sanitized.items.length };
    } catch (_) {
      return { ok: false, error: "BACKUP_JSON_INVALID", imported: 0 };
    }
  }

  function summarizeAnalytics(stateInput) {
    const state = sanitizeState(stateInput || emptyState());
    const consent = state.settings.analyticsConsent === true;
    const events = consent ? state.events : [];
    const routeViews = events.filter(function routeView(event) { return event.type === "route-view"; });
    const moduleRoutes = new Set(routeViews.map(function eventRoute(event) { return event.route; }).filter(Boolean));
    return Object.freeze({
      consent: consent,
      localItems: state.items.length,
      trackedEvents: events.length,
      exports: events.filter(function exportEvent(event) { return event.type === "data-export"; }).length,
      visitedModules: moduleRoutes.size,
      latestEvents: Object.freeze(events.slice(-12).reverse())
    });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatLocalTime(value) {
    const parsed = Date.parse(String(value || ""));
    if (!Number.isFinite(parsed)) return "Không rõ thời điểm";
    try {
      return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(parsed));
    } catch (_) {
      return new Date(parsed).toISOString();
    }
  }

  function navMarkup(activeRoute, mobileOnly) {
    const links = routeManifest.filter(function mobileRoutes(entry) {
      return !mobileOnly || ["home", "ai", "creator", "tools", "settings"].includes(entry.id);
    }).map(function navEntry(entry) {
      const active = entry.route === activeRoute;
      return "<a class=\"hgl1-nav__link hgl1-tone--" + entry.tone + "\" href=\"#" + entry.route + "\" data-hgl1-route=\"" + entry.route + "\" aria-current=\"" + (active ? "page" : "false") + "\">" +
        "<span class=\"hgl1-nav__icon\">" + icon(entry.icon) + "</span>" +
        "<span class=\"hgl1-nav__label\">" + escapeHtml(entry.label) + "</span>" +
        (mobileOnly ? "" : "<span class=\"hgl1-nav__arrow\">" + icon("arrow") + "</span>") +
      "</a>";
    }).join("");
    return links;
  }

  function searchBoxMarkup(compact) {
    const label = compact ? "Tìm trong HH Galaxy" : "Tìm kiếm chức năng lớp 1";
    return "<div class=\"hgl1-search" + (compact ? " hgl1-search--topbar" : "") + "\" data-hgl1-search-shell>" +
      icon("search", "hgl1-search__icon") +
      "<label class=\"hgl1-sr-only\">" + label + "</label>" +
      "<input type=\"search\" autocomplete=\"off\" spellcheck=\"false\" data-hgl1-global-search placeholder=\"" + label + "\" aria-controls=\"hgl1-search-results-" + (compact ? "top" : "side") + "\" aria-expanded=\"false\"/>" +
      "<kbd>⌘K</kbd>" +
      "<div class=\"hgl1-search__results\" id=\"hgl1-search-results-" + (compact ? "top" : "side") + "\" data-hgl1-search-results hidden></div>" +
    "</div>";
  }

  function statePanel(status, message) {
    const safeStatus = ["loading", "empty", "error", "offline", "permission", "success"].includes(status) ? status : "empty";
    const titles = {
      loading: "Đang đọc dữ liệu cục bộ",
      empty: "Chưa có dữ liệu người dùng",
      error: "Không thể đọc dữ liệu",
      offline: "Đang ngoại tuyến",
      permission: "Chưa được cấp quyền",
      success: "Đã hoàn thành"
    };
    if (safeStatus === "loading") {
      return "<section class=\"hgl1-state hgl1-state--loading\" data-state=\"loading\" aria-live=\"polite\" aria-busy=\"true\"><div class=\"hgl1-skeleton hgl1-skeleton--title\"></div><div class=\"hgl1-skeleton\"></div><div class=\"hgl1-skeleton\"></div><span class=\"hgl1-sr-only\">" + titles.loading + "</span></section>";
    }
    return "<section class=\"hgl1-state hgl1-state--" + safeStatus + "\" data-state=\"" + safeStatus + "\" role=\"status\"><span class=\"hgl1-state__orb\" aria-hidden=\"true\"></span><div><h2>" + titles[safeStatus] + "</h2><p>" + escapeHtml(message || "") + "</p></div></section>";
  }

  function templateMarkup(route) {
    const template = templateByRoute.get(route);
    if (!template) return "";
    return "<article class=\"hgl1-document hgl1-document--template\" data-is-demo=\"true\" data-source=\"" + template.source + "\" data-template-version=\"" + template.templateVersion + "\" data-editable=\"false\">" +
      "<div class=\"hgl1-document__visual hgl1-document__visual--" + escapeHtml(findRoute(route).tone) + "\" aria-hidden=\"true\">" + icon(findRoute(route).icon) + "<span></span></div>" +
      "<div class=\"hgl1-document__body\"><div class=\"hgl1-document__meta\"><span class=\"hgl1-badge hgl1-badge--demo\">Bản mẫu</span><span>" + escapeHtml(template.kind) + "</span></div>" +
      "<h3>" + escapeHtml(template.title) + "</h3><p>" + escapeHtml(template.description) + "</p>" +
      "<button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"copy-template\" data-route=\"" + route + "\">Tạo bản sao</button></div>" +
    "</article>";
  }

  function itemMarkup(item) {
    const entry = findRoute(item.route);
    return "<article class=\"hgl1-document\" data-hgl1-item data-filter-text=\"" + escapeHtml(normalizedSearchText(item.title + " " + item.description)) + "\">" +
      "<div class=\"hgl1-document__visual hgl1-document__visual--" + escapeHtml(entry ? entry.tone : "slate") + "\" aria-hidden=\"true\">" + icon(entry ? entry.icon : "database") + "<span></span></div>" +
      "<div class=\"hgl1-document__body\"><div class=\"hgl1-document__meta\"><span class=\"hgl1-badge hgl1-badge--local\">Cục bộ</span><span>" + escapeHtml(item.kind) + "</span></div>" +
      "<h3>" + escapeHtml(item.title) + "</h3><p>" + (item.description ? escapeHtml(item.description) : "Tài liệu người dùng, không có số liệu minh họa.") + "</p>" +
      "<div class=\"hgl1-document__footer\"><time datetime=\"" + escapeHtml(item.updatedAt) + "\">" + escapeHtml(formatLocalTime(item.updatedAt)) + "</time>" +
      "<button class=\"hgl1-icon-button hgl1-icon-button--danger\" type=\"button\" data-hgl1-action=\"delete-item\" data-item-id=\"" + escapeHtml(item.id) + "\" aria-label=\"Xóa " + escapeHtml(item.title) + "\">" + icon("close") + "</button></div></div>" +
    "</article>";
  }

  function featureMarkup(features) {
    return features.map(function featureCard(feature) {
      const state = feature[2];
      const labels = { available: "Cục bộ", unconfigured: "Chưa cấu hình", permission: "Theo yêu cầu" };
      return "<article class=\"hgl1-feature\" data-capability=\"" + state + "\"><span class=\"hgl1-feature__signal\" aria-hidden=\"true\"></span><div><span class=\"hgl1-feature__state\">" + labels[state] + "</span><h3>" + escapeHtml(feature[0]) + "</h3><p>" + escapeHtml(feature[1]) + "</p></div></article>";
    }).join("");
  }

  function moduleMarkup(entry, state) {
    const definition = MODULES[entry.route];
    const items = state.items.filter(function routeItems(item) { return item.route === entry.route; }).slice().reverse();
    const userItems = items.map(itemMarkup).join("");
    const importControl = definition.fileAccept ? "<button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"trigger-file\" data-route=\"" + entry.route + "\">" + icon("upload") + " Nhập tệp</button><input class=\"hgl1-sr-only\" type=\"file\" data-hgl1-module-file data-route=\"" + entry.route + "\" accept=\"" + escapeHtml(definition.fileAccept) + "\"/>" : "";
    const permissionControl = entry.route === "/galaxy/music" ? "<button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"check-microphone\">Kiểm tra microphone</button>" : "";
    return "<section class=\"hgl1-page hgl1-page--module\" data-module=\"" + entry.id + "\">" +
      "<header class=\"hgl1-page-head\"><div><span class=\"hgl1-eyebrow\">" + escapeHtml(entry.eyebrow) + "</span><h1>" + escapeHtml(entry.title) + "</h1><p>" + escapeHtml(entry.description) + "</p></div>" +
      "<div class=\"hgl1-page-head__actions\"><button class=\"hgl1-button hgl1-button--primary\" type=\"button\" data-hgl1-action=\"focus-create\">" + icon("plus") + " " + escapeHtml(definition.createLabel) + "</button>" + importControl + permissionControl + "</div></header>" +
      "<div class=\"hgl1-status-strip\"><span class=\"hgl1-status-dot hgl1-status-dot--" + definition.statusTone + "\"></span><span>" + escapeHtml(definition.status) + "</span><b>Dữ liệu riêng của lớp 1</b></div>" +
      "<section class=\"hgl1-feature-grid\" aria-label=\"Khả năng module\">" + featureMarkup(definition.features) + "</section>" +
      "<section class=\"hgl1-library\"><div class=\"hgl1-section-head\"><div><span class=\"hgl1-kicker\">Workspace</span><h2>Tài liệu của bạn</h2></div><label class=\"hgl1-filter\">" + icon("search") + "<span class=\"hgl1-sr-only\">Lọc tài liệu</span><input type=\"search\" data-hgl1-item-filter placeholder=\"Lọc theo tên...\"/></label></div>" +
      "<form class=\"hgl1-create-form\" data-hgl1-create-form data-route=\"" + entry.route + "\"><label for=\"hgl1-title-" + entry.id + "\">Tên tài liệu mới</label><div><input id=\"hgl1-title-" + entry.id + "\" name=\"title\" maxlength=\"160\" required placeholder=\"Nhập tên rõ ràng...\"/><button class=\"hgl1-button hgl1-button--primary\" type=\"submit\">Lưu cục bộ</button></div></form>" +
      "<div class=\"hgl1-document-grid\" data-hgl1-item-list>" + templateMarkup(entry.route) + userItems + "</div>" +
      (items.length ? "" : statePanel("empty", "Chưa có tài liệu người dùng. Bản mẫu bên trên không được tính là dữ liệu thật.")) +
      "</section></section>";
  }

  function homeMarkup() {
    return "<section class=\"hgl1-page hgl1-page--home\" aria-labelledby=\"hgl1-home-title\"><div class=\"hgl1-home-intro\"><span class=\"hgl1-eyebrow\">Bản đồ lớp 1</span><h1 id=\"hgl1-home-title\">Khám phá HH Galaxy</h1><p>Bản đồ hiện có được gắn vào vùng này qua host contract; shell không tạo thêm cổng sang sản phẩm khác.</p></div>" +
      "<div class=\"hgl1-delegated-host hgl1-delegated-host--home\" data-hh-galaxy-home-host data-route=\"/home\" role=\"region\" aria-label=\"Bản đồ HH Galaxy\"><div class=\"hgl1-delegated-placeholder\"><span class=\"hgl1-orbit\" aria-hidden=\"true\"></span><div><h2>Đang chuẩn bị bản đồ Galaxy</h2><p>Host sẵn sàng cho trình dựng bản đồ hiện có.</p></div></div></div></section>";
  }

  function creatorMarkup() {
    return "<section class=\"hgl1-page hgl1-page--creator\"><header class=\"hgl1-page-head\"><div><span class=\"hgl1-eyebrow\">Creator Studio</span><h1>Không gian sáng tạo lớp 1</h1><p>Shell dành toàn bộ vùng nội dung bên dưới cho Creator Studio chuyên dụng; module này sở hữu pipeline, dự án, lịch và thống kê của chính nó.</p></div></header>" +
      "<section class=\"hgl1-creator-host-shell\" aria-label=\"Creator Studio lớp 1\"><div class=\"hgl1-delegated-host hgl1-delegated-host--creator\" data-hh-galaxy-creator-host data-route=\"/galaxy/creator\" aria-label=\"Creator Studio workspace\"><div class=\"hgl1-delegated-placeholder\" data-hgl1-creator-placeholder><span class=\"hgl1-orbit\" aria-hidden=\"true\"></span><div><h2>Đang chuẩn bị Creator Studio</h2><p>Host sẵn sàng cho module Creator lớp 1. Không sử dụng dữ liệu hoặc component của lớp 2.</p></div></div></div></section></section>";
  }

  function toolsMarkup(state) {
    const items = state.items.filter(function toolsItem(item) { return item.route === "/galaxy/tools"; }).slice().reverse();
    return "<section class=\"hgl1-page hgl1-page--tools\"><header class=\"hgl1-page-head\"><div><span class=\"hgl1-eyebrow\">Tiện ích cục bộ</span><h1>Tools Galaxy</h1><p>Xử lý đầu vào ngay trong trình duyệt; nội dung không được tự động gửi ra mạng.</p></div><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"export-route\" data-route=\"/galaxy/tools\">" + icon("download") + " Xuất ghi chú</button></header>" +
      "<div class=\"hgl1-tools-grid\"><article class=\"hgl1-tool\"><div class=\"hgl1-tool__head\">" + icon("tools") + "<div><span class=\"hgl1-badge hgl1-badge--local\">Cục bộ</span><h2>Phân tích văn bản</h2></div></div><label for=\"hgl1-text-tool\">Nội dung</label><textarea id=\"hgl1-text-tool\" data-hgl1-text-tool rows=\"9\" placeholder=\"Nhập văn bản cần đếm...\"></textarea><button class=\"hgl1-button hgl1-button--primary\" type=\"button\" data-hgl1-action=\"analyze-text\">Phân tích</button><output class=\"hgl1-tool__output\" data-hgl1-text-output aria-live=\"polite\">Chưa có kết quả.</output></article>" +
      "<article class=\"hgl1-tool\"><div class=\"hgl1-tool__head\">" + icon("dev") + "<div><span class=\"hgl1-badge hgl1-badge--local\">Cục bộ</span><h2>JSON Formatter</h2></div></div><label for=\"hgl1-json-tool\">JSON đầu vào</label><textarea id=\"hgl1-json-tool\" data-hgl1-json-tool rows=\"9\" spellcheck=\"false\" placeholder=\"{ &quot;hello&quot;: &quot;galaxy&quot; }\"></textarea><button class=\"hgl1-button hgl1-button--primary\" type=\"button\" data-hgl1-action=\"format-json\">Định dạng</button><output class=\"hgl1-tool__output hgl1-tool__output--code\" data-hgl1-json-output aria-live=\"polite\">Chưa có kết quả.</output></article></div>" +
      "<section class=\"hgl1-library\"><div class=\"hgl1-section-head\"><div><span class=\"hgl1-kicker\">Lịch sử do bạn lưu</span><h2>Ghi chú công cụ</h2></div></div><form class=\"hgl1-create-form\" data-hgl1-create-form data-route=\"/galaxy/tools\"><label for=\"hgl1-title-tools\">Tên ghi chú</label><div><input id=\"hgl1-title-tools\" name=\"title\" maxlength=\"160\" required/><button class=\"hgl1-button hgl1-button--primary\" type=\"submit\">Lưu</button></div></form><div class=\"hgl1-document-grid\">" + templateMarkup("/galaxy/tools") + items.map(itemMarkup).join("") + "</div></section></section>";
  }

  function analyticsMarkup(state) {
    const summary = summarizeAnalytics(state);
    const events = summary.latestEvents.map(function eventRow(event) {
      const route = findRoute(event.route);
      const typeLabels = { "route-view": "Mở module", "item-create": "Tạo tài liệu", "item-delete": "Xóa tài liệu", "data-export": "Xuất dữ liệu", "data-import": "Nhập dữ liệu", "permission-check": "Kiểm tra quyền" };
      return "<tr><td>" + escapeHtml(typeLabels[event.type] || event.type) + "</td><td>" + escapeHtml(route ? route.label : "Galaxy") + "</td><td><time datetime=\"" + escapeHtml(event.at) + "\">" + escapeHtml(formatLocalTime(event.at)) + "</time></td></tr>";
    }).join("");
    return "<section class=\"hgl1-page hgl1-page--analytics\"><header class=\"hgl1-page-head\"><div><span class=\"hgl1-eyebrow\">Số liệu lớp 1</span><h1>Analytics</h1><p>Không đọc nội dung tài liệu và không trộn bản mẫu vào thống kê.</p></div><div class=\"hgl1-page-head__actions\"><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"export-analytics-json\" " + (summary.consent ? "" : "disabled title=\"Bật consent để xuất sự kiện\"") + ">JSON</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"export-analytics-csv\" " + (summary.consent ? "" : "disabled title=\"Bật consent để xuất sự kiện\"") + ">CSV</button></div></header>" +
      "<section class=\"hgl1-consent\"><div><span class=\"hgl1-kicker\">Quyền riêng tư</span><h2>Analytics cục bộ</h2><p>" + (summary.consent ? "Đang ghi các thao tác tối thiểu trên thiết bị này." : "Đang tắt. Không có sự kiện điều hướng mới nào được ghi.") + "</p></div><label class=\"hgl1-switch\"><input type=\"checkbox\" data-hgl1-setting=\"analyticsConsent\" " + (summary.consent ? "checked" : "") + "/><span aria-hidden=\"true\"></span><b>" + (summary.consent ? "Đã bật" : "Đang tắt") + "</b></label></section>" +
      "<section class=\"hgl1-metric-grid\" aria-label=\"Thống kê cục bộ\"><article><span>Tài liệu người dùng</span><strong>" + summary.localItems + "</strong><small>Không gồm bản mẫu</small></article><article><span>Module đã mở</span><strong>" + summary.visitedModules + "</strong><small>Chỉ khi có consent</small></article><article><span>Sự kiện đã lưu</span><strong>" + summary.trackedEvents + "</strong><small>Tối đa " + MAX_EVENTS + " bản ghi</small></article><article><span>Lần xuất dữ liệu</span><strong>" + summary.exports + "</strong><small>Tính từ sự kiện thật</small></article></section>" +
      "<section class=\"hgl1-table-card\"><div class=\"hgl1-section-head\"><div><span class=\"hgl1-kicker\">Gần đây</span><h2>Nhật ký tối thiểu</h2></div></div>" +
      (events ? "<div class=\"hgl1-table-wrap\"><table><thead><tr><th>Hoạt động</th><th>Module</th><th>Thời điểm</th></tr></thead><tbody>" + events + "</tbody></table></div>" : statePanel("empty", summary.consent ? "Chưa có sự kiện thật nào được ghi." : "Bật Analytics nếu bạn muốn lưu thống kê tối thiểu.")) +
      "</section></section>";
  }

  function settingsMarkup(state) {
    const settings = state.settings;
    return "<section class=\"hgl1-page hgl1-page--settings\"><header class=\"hgl1-page-head\"><div><span class=\"hgl1-eyebrow\">Thiết lập lớp 1</span><h1>Cài đặt Galaxy</h1><p>Các lựa chọn này không thay đổi thiết lập của sản phẩm khác.</p></div></header>" +
      "<div class=\"hgl1-settings-grid\"><section class=\"hgl1-settings-card\"><span class=\"hgl1-kicker\">Giao diện</span><h2>Trải nghiệm hiển thị</h2><label>Chủ đề<select data-hgl1-setting=\"theme\"><option value=\"cosmic\" " + (settings.theme === "cosmic" ? "selected" : "") + ">Cosmic</option><option value=\"midnight\" " + (settings.theme === "midnight" ? "selected" : "") + ">Midnight</option></select></label><label>Mức hiệu ứng<select data-hgl1-setting=\"effects\"><option value=\"quiet\" " + (settings.effects === "quiet" ? "selected" : "") + ">Tĩnh</option><option value=\"balanced\" " + (settings.effects === "balanced" ? "selected" : "") + ">Cân bằng</option><option value=\"rich\" " + (settings.effects === "rich" ? "selected" : "") + ">Nổi bật</option></select></label><label>Độ tương phản<select data-hgl1-setting=\"contrast\"><option value=\"standard\" " + (settings.contrast === "standard" ? "selected" : "") + ">Tiêu chuẩn</option><option value=\"high\" " + (settings.contrast === "high" ? "selected" : "") + ">Cao</option></select></label><label>Giảm chuyển động<select data-hgl1-setting=\"reducedMotion\"><option value=\"system\" " + (settings.reducedMotion === "system" ? "selected" : "") + ">Theo hệ thống</option><option value=\"on\" " + (settings.reducedMotion === "on" ? "selected" : "") + ">Luôn bật</option><option value=\"off\" " + (settings.reducedMotion === "off" ? "selected" : "") + ">Luôn tắt</option></select></label></section>" +
      "<section class=\"hgl1-settings-card\"><span class=\"hgl1-kicker\">Dữ liệu</span><h2>Sao lưu & khôi phục</h2><p>Bản sao lưu chỉ gồm cài đặt, tài liệu người dùng và sự kiện đã được consent. Không bao gồm bản mẫu.</p><div class=\"hgl1-settings-actions\"><button class=\"hgl1-button hgl1-button--primary\" type=\"button\" data-hgl1-action=\"export-backup\">" + icon("download") + " Xuất JSON</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"trigger-backup-import\">" + icon("upload") + " Nhập JSON</button><input class=\"hgl1-sr-only\" type=\"file\" accept=\"application/json,.json\" data-hgl1-backup-file/></div><dl><div><dt>Tài liệu người dùng</dt><dd>" + state.items.length + "</dd></div><div><dt>Sự kiện consent</dt><dd>" + (settings.analyticsConsent ? state.events.length : 0) + "</dd></div><div><dt>Kho lưu trữ</dt><dd>" + escapeHtml(STORAGE_KEY) + "</dd></div></dl></section>" +
      "<section class=\"hgl1-settings-card hgl1-settings-card--wide\"><span class=\"hgl1-kicker\">Analytics</span><h2>Consent rõ ràng</h2><div class=\"hgl1-setting-row\"><div><p>Cho phép lưu sự kiện điều hướng và thao tác tối thiểu trên thiết bị.</p><small>Nội dung tài liệu không được đưa vào sự kiện.</small></div><label class=\"hgl1-switch\"><input type=\"checkbox\" data-hgl1-setting=\"analyticsConsent\" " + (settings.analyticsConsent ? "checked" : "") + "/><span aria-hidden=\"true\"></span><b>" + (settings.analyticsConsent ? "Đã bật" : "Đang tắt") + "</b></label></div></section></div></section>";
  }

  function routeContent(entry, state, ui) {
    if (ui && ui.status === "loading") return statePanel("loading");
    if (ui && ui.status === "error") return statePanel("error", ui.message || "Vui lòng kiểm tra quyền lưu trữ của trình duyệt.");
    if (entry.route === "/home") return homeMarkup();
    if (entry.route === "/galaxy/creator") return creatorMarkup(state);
    if (entry.route === "/galaxy/tools") return toolsMarkup(state);
    if (entry.route === "/galaxy/analytics") return analyticsMarkup(state);
    if (entry.route === "/galaxy/settings") return settingsMarkup(state);
    return moduleMarkup(entry, state);
  }

  function viewMarkup(routeInput, stateInput, uiInput) {
    const entry = findRoute(routeInput) || routeManifest[0];
    const state = sanitizeState(stateInput || emptyState());
    const ui = uiInput && typeof uiInput === "object" ? uiInput : {};
    const online = typeof ui.online === "boolean" ? ui.online : null;
    const displayName = String(ui.userName || "Hồ sơ cục bộ").trim().slice(0, 80) || "Hồ sơ cục bộ";
    const initial = escapeHtml(displayName.charAt(0).toLocaleUpperCase("vi") || "H");
    const networkLabel = online === false ? "Ngoại tuyến" : online === true ? "Mạng trình duyệt khả dụng" : "Chưa kiểm tra mạng";
    const storageStatus = ui.storageStatus === "unsupported" ? "Lưu trữ không khả dụng" : ui.storageStatus === "error" ? "Lỗi lưu trữ" : "Dữ liệu trên thiết bị";
    return "<div class=\"hh-galaxy-app\" data-hh-layer=\"galaxy\" data-route=\"" + entry.route + "\" data-theme=\"" + state.settings.theme + "\" data-effects=\"" + state.settings.effects + "\" data-contrast=\"" + state.settings.contrast + "\" data-reduced-motion=\"" + state.settings.reducedMotion + "\">" +
      "<a class=\"hgl1-skip-link\" href=\"#hgl1-main\">Bỏ qua điều hướng</a><div class=\"hgl1-cosmos\" aria-hidden=\"true\"><i></i><i></i><i></i></div>" +
      "<aside class=\"hgl1-sidebar\" id=\"hgl1-sidebar\" aria-label=\"Điều hướng HH Galaxy\"><div class=\"hgl1-sidebar__head\"><div class=\"hgl1-product-mark\"><span>" + icon("home") + "</span><div><b>HH GALAXY MAP</b><small>Lớp 1 · Không gian độc lập</small></div></div><button class=\"hgl1-icon-button hgl1-sidebar__close\" type=\"button\" data-hgl1-action=\"close-drawer\" aria-label=\"Đóng menu\">" + icon("close") + "</button><div class=\"hgl1-brand\"><span>HH</span><div><b>HOANG8.COM</b><small>Galaxy Workspace</small></div></div>" + searchBoxMarkup(false) + "</div>" +
      "<nav class=\"hgl1-nav\">" + navMarkup(entry.route, false) + "</nav><div class=\"hgl1-sidebar__footer\"><a class=\"hgl1-customize\" href=\"#/galaxy/settings\" data-hgl1-route=\"/galaxy/settings\"><span>" + icon("settings") + "</span><div><b>Tùy chỉnh Galaxy</b><small>Màu sắc, chuyển động và quyền riêng tư</small></div>" + icon("arrow") + "</a><div class=\"hgl1-profile\"><span class=\"hgl1-avatar\">" + initial + "</span><div><b>" + escapeHtml(displayName) + "</b><small>" + storageStatus + "</small></div></div></div></aside>" +
      "<button class=\"hgl1-backdrop\" type=\"button\" data-hgl1-action=\"close-drawer\" aria-label=\"Đóng menu\" tabindex=\"-1\"></button>" +
      "<div class=\"hgl1-shell\"><header class=\"hgl1-topbar\"><button class=\"hgl1-icon-button hgl1-menu-button\" type=\"button\" data-hgl1-action=\"open-drawer\" aria-controls=\"hgl1-sidebar\" aria-expanded=\"false\" aria-label=\"Mở menu\">" + icon("menu") + "</button><div class=\"hgl1-breadcrumb\"><span>HH Galaxy</span><b>/</b><strong>" + escapeHtml(entry.label) + "</strong></div>" + searchBoxMarkup(true) + "<div class=\"hgl1-topbar__status\" title=\"" + networkLabel + "\"><span class=\"" + (online === false ? "is-offline" : "") + "\"></span><b>" + escapeHtml(networkLabel) + "</b></div><button class=\"hgl1-icon-button\" type=\"button\" data-hgl1-action=\"show-empty-notifications\" aria-label=\"Thông báo: chưa có dữ liệu\">" + icon("bell") + "</button><button class=\"hgl1-icon-button\" type=\"button\" data-hgl1-action=\"show-help\" aria-label=\"Trợ giúp\">" + icon("help") + "</button><span class=\"hgl1-avatar hgl1-avatar--small\" aria-label=\"" + escapeHtml(displayName) + "\">" + initial + "</span></header>" +
      "<main class=\"hgl1-main\" id=\"hgl1-main\" tabindex=\"-1\">" + (ui.storageStatus === "error" || ui.storageStatus === "unsupported" ? "<div class=\"hgl1-alert\" role=\"alert\">" + escapeHtml(storageStatus) + ". Các thao tác lưu sẽ bị vô hiệu nếu trình duyệt không cấp quyền.</div>" : "") + routeContent(entry, state, ui) + "</main>" +
      "<nav class=\"hgl1-mobile-nav\" aria-label=\"Điều hướng nhanh\">" + navMarkup(entry.route, true) + "</nav></div>" +
      "<div class=\"hgl1-toast\" data-hgl1-toast role=\"status\" aria-live=\"polite\" hidden></div></div>";
  }

  let runtime = null;

  function emit(name, detail) {
    if (!globalScope.dispatchEvent || typeof globalScope.CustomEvent !== "function") return null;
    const event = new globalScope.CustomEvent(EVENT_PREFIX + ":" + name, { detail: detail });
    globalScope.dispatchEvent(event);
    return event;
  }

  function currentRoute() {
    try {
      return normalizeRoute(globalScope.location && (globalScope.location.hash || globalScope.location.pathname));
    } catch (_) {
      return "/home";
    }
  }

  function resolveHost(candidate) {
    const doc = globalScope.document;
    if (!doc) return null;
    if (candidate && candidate.nodeType === 1) return candidate;
    if (typeof candidate === "string") return doc.querySelector(candidate);
    return doc.querySelector("[data-hh-galaxy-layer-one-host]") || doc.querySelector(".app-workspace");
  }

  function listen(target, type, handler, options) {
    if (!target || typeof target.addEventListener !== "function" || !runtime) return;
    target.addEventListener(type, handler, options);
    runtime.cleanups.push(function removeListener() {
      target.removeEventListener(type, handler, options);
    });
  }

  function cleanupDelegate() {
    if (!runtime) return;
    const cleanups = runtime.delegateCleanups.splice(0).reverse();
    cleanups.forEach(function runCleanup(cleanup) {
      try { cleanup(); } catch (_) { /* Detached extension hosts are harmless. */ }
    });
  }

  function registerDelegateCleanup(value) {
    if (!runtime) return;
    if (typeof value === "function") runtime.delegateCleanups.push(value);
    else if (value && typeof value.unmount === "function") runtime.delegateCleanups.push(function unmountController() { value.unmount(); });
  }

  function mountRouteDelegate() {
    if (!runtime) return;
    cleanupDelegate();
    const app = runtime.host.querySelector(".hh-galaxy-app");
    const context = {
      route: runtime.route,
      storage: runtime.storage,
      layer: "galaxy",
      embedded: true
    };
    if (runtime.route === "/home") {
      const homeHost = app && app.querySelector("[data-hh-galaxy-home-host]");
      if (!homeHost) return;
      let claimed = false;
      if (typeof runtime.options.mountHome === "function") {
        const delegatedHome = runtime.options.mountHome(homeHost, context);
        registerDelegateCleanup(delegatedHome);
        claimed = delegatedHome !== false;
      }
      const detail = {
        host: homeHost,
        route: "/home",
        claimed: claimed,
        claim: function claim(cleanup) {
          this.claimed = true;
          registerDelegateCleanup(cleanup);
        }
      };
      emit("home-host-ready", detail);
      claimed = detail.claimed;
      if (!claimed && globalScope.HHGalaxyHomeAI && typeof globalScope.HHGalaxyHomeAI.mount === "function") {
        const mounted = globalScope.HHGalaxyHomeAI.mount(homeHost, context);
        if (mounted !== false) {
          registerDelegateCleanup(function releaseExistingHome() {
            globalScope.HHGalaxyHomeAI.unmount && globalScope.HHGalaxyHomeAI.unmount(homeHost);
          });
        }
      }
      return;
    }
    if (runtime.route === "/galaxy/creator") {
      const creatorHost = app && app.querySelector("[data-hh-galaxy-creator-host]");
      if (!creatorHost) return;
      let creatorClaimed = false;
      if (typeof runtime.options.mountCreator === "function") {
        const delegatedCreator = runtime.options.mountCreator(creatorHost, context);
        registerDelegateCleanup(delegatedCreator);
        creatorClaimed = delegatedCreator !== false;
      }
      const detail = {
        host: creatorHost,
        route: "/galaxy/creator",
        claimed: creatorClaimed,
        claim: function claim(cleanup) {
          this.claimed = true;
          registerDelegateCleanup(cleanup);
        }
      };
      emit("creator-host-ready", detail);
    }
  }

  function applyPreferences(app, settings) {
    if (!app) return;
    app.dataset.theme = settings.theme;
    app.dataset.effects = settings.effects;
    app.dataset.contrast = settings.contrast;
    app.dataset.reducedMotion = settings.reducedMotion;
  }

  function render() {
    if (!runtime) return false;
    const inspection = inspectLocalState(runtime.storage);
    runtime.localState = inspection.data;
    runtime.storageStatus = inspection.status;
    const online = typeof globalScope.navigator === "object" && typeof globalScope.navigator.onLine === "boolean" ? globalScope.navigator.onLine : null;
    runtime.host.innerHTML = viewMarkup(runtime.route, runtime.localState, {
      online: online,
      userName: runtime.options.user && (runtime.options.user.displayName || runtime.options.user.name),
      storageStatus: runtime.storageStatus,
      status: runtime.viewStatus,
      message: runtime.viewMessage
    });
    runtime.app = runtime.host.querySelector(".hh-galaxy-app");
    applyPreferences(runtime.app, runtime.localState.settings);
    mountRouteDelegate();
    runtime.reason = inspection.status === "ready" ? "ready" : inspection.error;
    return true;
  }

  function showToast(message, tone) {
    if (!runtime || !runtime.app) return;
    const toast = runtime.app.querySelector("[data-hgl1-toast]");
    if (!toast) return;
    toast.textContent = String(message || "");
    toast.dataset.tone = tone || "info";
    toast.hidden = false;
    if (runtime.toastTimer) globalScope.clearTimeout && globalScope.clearTimeout(runtime.toastTimer);
    runtime.toastTimer = globalScope.setTimeout ? globalScope.setTimeout(function hideToast() {
      if (toast) toast.hidden = true;
    }, 3600) : 0;
  }

  function setDrawer(open) {
    if (!runtime || !runtime.app) return;
    runtime.app.dataset.drawerOpen = String(Boolean(open));
    const toggle = runtime.app.querySelector("[data-hgl1-action=\"open-drawer\"]");
    if (toggle) toggle.setAttribute("aria-expanded", String(Boolean(open)));
  }

  function navigate(route) {
    const match = findRoute(route);
    if (!match || !runtime) return false;
    setDrawer(false);
    if (typeof runtime.options.navigate === "function") {
      runtime.options.navigate(match.route, { source: "galaxy-layer-one", layer: "galaxy" });
    } else {
      try { globalScope.location.hash = "#" + match.route; } catch (_) { /* syncRoute below remains usable. */ }
    }
    syncRoute(match.route);
    return true;
  }

  function searchResultsMarkup(results) {
    if (!results.length) return "<div class=\"hgl1-search__empty\">Không có chức năng lớp 1 phù hợp.</div>";
    return results.map(function result(entry, index) {
      return "<button type=\"button\" data-hgl1-search-route=\"" + entry.route + "\" data-result-index=\"" + index + "\"><span class=\"hgl1-nav__icon hgl1-tone--" + entry.tone + "\">" + icon(entry.icon) + "</span><span><b>" + escapeHtml(entry.label) + "</b><small>" + escapeHtml(entry.eyebrow) + "</small></span>" + icon("arrow") + "</button>";
    }).join("");
  }

  function updateGlobalSearch(input) {
    const shell = input.closest("[data-hgl1-search-shell]");
    const resultsHost = shell && shell.querySelector("[data-hgl1-search-results]");
    if (!resultsHost) return;
    const results = searchRoutes(input.value, 7);
    resultsHost.innerHTML = searchResultsMarkup(results);
    resultsHost.hidden = !String(input.value || "").trim();
    input.setAttribute("aria-expanded", String(!resultsHost.hidden));
  }

  function updateItemFilter(input) {
    if (!runtime || !runtime.app) return;
    const library = input.closest(".hgl1-library");
    const needle = normalizedSearchText(input.value);
    const items = library ? library.querySelectorAll("[data-hgl1-item]") : [];
    Array.prototype.forEach.call(items, function filterItem(item) {
      item.hidden = Boolean(needle) && normalizedSearchText(item.getAttribute("data-filter-text")).indexOf(needle) < 0;
    });
  }

  function downloadText(fileName, text, type) {
    if (!globalScope.document || typeof globalScope.Blob !== "function" || !globalScope.URL || typeof globalScope.URL.createObjectURL !== "function") return false;
    const url = globalScope.URL.createObjectURL(new globalScope.Blob([text], { type: type || "application/json;charset=utf-8" }));
    const anchor = globalScope.document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.hidden = true;
    globalScope.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    if (globalScope.setTimeout) globalScope.setTimeout(function releaseUrl() { globalScope.URL.revokeObjectURL(url); }, 0);
    return true;
  }

  function exportRoute(route) {
    if (!runtime) return false;
    const match = findRoute(route);
    if (!match) return false;
    const state = collectLocalState(runtime.storage);
    const items = state.items.filter(function matchRoute(item) { return item.route === match.route; });
    const payload = JSON.stringify({ schema: "hh-galaxy-module-export", version: VERSION, route: match.route, exportedAt: new Date().toISOString(), items: items }, null, 2);
    const ok = downloadText("hh-galaxy-" + match.id + ".json", payload);
    if (ok) recordEvent("data-export", match.route, runtime.storage);
    return ok;
  }

  function exportAnalytics(format) {
    if (!runtime) return false;
    const state = collectLocalState(runtime.storage);
    const summary = summarizeAnalytics(state);
    if (!summary.consent) return false;
    let body = "";
    let type = "";
    let name = "";
    if (format === "csv") {
      const rows = [["type", "route", "at"]].concat(state.events.map(function eventCells(event) { return [event.type, event.route, event.at]; }));
      body = rows.map(function csvRow(row) {
        return row.map(function csvCell(cell) { return "\"" + String(cell).replace(/"/g, "\"\"") + "\""; }).join(",");
      }).join("\r\n");
      type = "text/csv;charset=utf-8";
      name = "hh-galaxy-analytics.csv";
    } else {
      body = JSON.stringify({ schema: "hh-galaxy-analytics", version: VERSION, events: state.events }, null, 2);
      type = "application/json;charset=utf-8";
      name = "hh-galaxy-analytics.json";
    }
    const ok = downloadText(name, body, type);
    if (ok) recordEvent("data-export", "/galaxy/analytics", runtime.storage);
    return ok;
  }

  async function importSelectedFile(input) {
    if (!runtime || !input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    const match = findRoute(input.dataset.route);
    if (!match) return;
    const item = createLocalItem(match.route, file.name, runtime.storage, {
      description: "Metadata tệp được nhập từ thiết bị. Nội dung tệp không được tải lên.",
      meta: { fileName: file.name, fileType: file.type, fileSize: file.size }
    });
    if (item) {
      render();
      showToast("Đã lưu metadata tệp trên thiết bị.", "success");
    } else {
      showToast("Không thể lưu metadata tệp.", "error");
    }
  }

  async function importBackupFile(input) {
    if (!runtime || !input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    if (file.size > 2 * 1024 * 1024) {
      showToast("Tệp sao lưu vượt quá giới hạn 2 MB.", "error");
      return;
    }
    try {
      const text = await file.text();
      const result = importBackup(text, runtime.storage);
      if (!result.ok) {
        showToast("Tệp sao lưu không hợp lệ: " + result.error, "error");
        return;
      }
      render();
      showToast("Đã khôi phục " + result.imported + " tài liệu người dùng.", "success");
    } catch (_) {
      showToast("Không thể đọc tệp sao lưu.", "error");
    }
  }

  async function checkMicrophone() {
    if (!runtime) return;
    const media = globalScope.navigator && globalScope.navigator.mediaDevices;
    if (!media || typeof media.getUserMedia !== "function") {
      showToast("Trình duyệt không hỗ trợ kiểm tra microphone.", "error");
      return;
    }
    try {
      const stream = await media.getUserMedia({ audio: true });
      stream.getTracks().forEach(function stopTrack(track) { track.stop(); });
      recordEvent("permission-check", "/galaxy/music", runtime.storage);
      showToast("Microphone đã được cấp quyền. Luồng kiểm tra đã dừng.", "success");
    } catch (error) {
      const denied = error && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError");
      showToast(denied ? "Bạn chưa cấp quyền microphone." : "Không thể kiểm tra microphone trên thiết bị này.", "error");
    }
  }

  function handleClick(event) {
    if (!runtime || !runtime.app) return;
    const routeLink = event.target.closest("[data-hgl1-route]");
    if (routeLink) {
      event.preventDefault();
      navigate(routeLink.dataset.hgl1Route);
      return;
    }
    const searchRoute = event.target.closest("[data-hgl1-search-route]");
    if (searchRoute) {
      event.preventDefault();
      navigate(searchRoute.dataset.hgl1SearchRoute);
      return;
    }
    const control = event.target.closest("[data-hgl1-action]");
    if (!control) return;
    const action = control.dataset.hgl1Action;
    if (action === "open-drawer") setDrawer(true);
    else if (action === "close-drawer") setDrawer(false);
    else if (action === "focus-create") {
      const input = runtime.app.querySelector("[data-hgl1-create-form] input[name=\"title\"]");
      input && input.focus();
    } else if (action === "copy-template") {
      const item = copyTemplate(control.dataset.route, runtime.storage);
      render();
      showToast(item ? "Đã tạo bản sao có thể chỉnh sửa." : "Không thể tạo bản sao.", item ? "success" : "error");
    } else if (action === "delete-item") {
      const confirmed = typeof globalScope.confirm === "function" ? globalScope.confirm("Xóa tài liệu cục bộ này?") : false;
      if (confirmed) {
        const deleted = deleteLocalItem(control.dataset.itemId, runtime.storage);
        render();
        showToast(deleted ? "Đã xóa tài liệu cục bộ." : "Không thể xóa tài liệu.", deleted ? "success" : "error");
      }
    } else if (action === "trigger-file") {
      const input = runtime.app.querySelector("[data-hgl1-module-file][data-route=\"" + control.dataset.route + "\"]");
      input && input.click();
    } else if (action === "trigger-backup-import") {
      const input = runtime.app.querySelector("[data-hgl1-backup-file]");
      input && input.click();
    } else if (action === "export-route") {
      showToast(exportRoute(control.dataset.route) ? "Đã tạo tệp xuất." : "Trình duyệt không hỗ trợ tải tệp.", "info");
    } else if (action === "export-backup") {
      const ok = downloadText("hh-galaxy-layer-one-backup.json", serializeBackup(runtime.storage));
      if (ok) recordEvent("data-export", "/galaxy/settings", runtime.storage);
      showToast(ok ? "Đã tạo bản sao lưu JSON." : "Trình duyệt không hỗ trợ tải tệp.", ok ? "success" : "error");
    } else if (action === "export-analytics-json") {
      showToast(exportAnalytics("json") ? "Đã xuất Analytics JSON." : "Cần bật consent trước khi xuất.", "info");
    } else if (action === "export-analytics-csv") {
      showToast(exportAnalytics("csv") ? "Đã xuất Analytics CSV." : "Cần bật consent trước khi xuất.", "info");
    } else if (action === "check-microphone") {
      checkMicrophone();
    } else if (action === "analyze-text") {
      const input = runtime.app.querySelector("[data-hgl1-text-tool]");
      const output = runtime.app.querySelector("[data-hgl1-text-output]");
      const text = input ? input.value : "";
      const words = text.trim() ? text.trim().split(/\s+/u).length : 0;
      const lines = text ? text.split(/\r?\n/).length : 0;
      if (output) output.textContent = "Ký tự: " + text.length + " · Từ: " + words + " · Dòng: " + lines;
    } else if (action === "format-json") {
      const input = runtime.app.querySelector("[data-hgl1-json-tool]");
      const output = runtime.app.querySelector("[data-hgl1-json-output]");
      try {
        const parsed = JSON.parse(input ? input.value : "");
        if (output) {
          output.textContent = JSON.stringify(parsed, null, 2);
          output.dataset.tone = "success";
        }
      } catch (_) {
        if (output) {
          output.textContent = "JSON không hợp lệ. Hãy kiểm tra dấu ngoặc và dấu phẩy.";
          output.dataset.tone = "error";
        }
      }
    } else if (action === "show-empty-notifications") {
      showToast("Chưa có dữ liệu thông báo thật.", "info");
    } else if (action === "show-help") {
      showToast("Dùng ô tìm kiếm để mở một trong 12 khu vực độc lập của HH Galaxy.", "info");
    }
  }

  function handleSubmit(event) {
    const form = event.target.closest("[data-hgl1-create-form]");
    if (!form || !runtime) return;
    event.preventDefault();
    const input = form.querySelector("input[name=\"title\"]");
    const item = createLocalItem(form.dataset.route, input && input.value, runtime.storage);
    if (!item) {
      showToast("Nhập tên hợp lệ và kiểm tra quyền lưu trữ.", "error");
      return;
    }
    render();
    showToast("Đã lưu tài liệu cục bộ.", "success");
  }

  function handleInput(event) {
    if (event.target.matches("[data-hgl1-global-search]")) updateGlobalSearch(event.target);
    else if (event.target.matches("[data-hgl1-item-filter]")) updateItemFilter(event.target);
  }

  function handleChange(event) {
    if (!runtime) return;
    const target = event.target;
    if (target.matches("[data-hgl1-module-file]")) {
      importSelectedFile(target);
      return;
    }
    if (target.matches("[data-hgl1-backup-file]")) {
      importBackupFile(target);
      return;
    }
    if (!target.matches("[data-hgl1-setting]")) return;
    const state = collectLocalState(runtime.storage);
    const key = target.dataset.hgl1Setting;
    if (!Object.hasOwn(defaultSettings(), key)) return;
    state.settings[key] = target.type === "checkbox" ? target.checked : target.value;
    state.settings = sanitizeSettings(state.settings);
    if (!writeLocalState(state, runtime.storage)) {
      showToast("Không thể lưu cài đặt.", "error");
      return;
    }
    render();
    showToast("Đã lưu cài đặt Galaxy.", "success");
  }

  function closeSearches() {
    if (!runtime || !runtime.app) return;
    const hosts = runtime.app.querySelectorAll("[data-hgl1-search-results]");
    Array.prototype.forEach.call(hosts, function closeHost(host) { host.hidden = true; });
    const inputs = runtime.app.querySelectorAll("[data-hgl1-global-search]");
    Array.prototype.forEach.call(inputs, function closeInput(input) { input.setAttribute("aria-expanded", "false"); });
  }

  function handleKeydown(event) {
    if (!runtime || !runtime.app) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
      event.preventDefault();
      const input = runtime.app.querySelector(".hgl1-topbar [data-hgl1-global-search]") || runtime.app.querySelector("[data-hgl1-global-search]");
      input && input.focus();
      return;
    }
    if (event.key === "Escape") {
      setDrawer(false);
      closeSearches();
      return;
    }
    if (event.key === "Enter" && event.target.matches("[data-hgl1-global-search]")) {
      const first = event.target.closest("[data-hgl1-search-shell]").querySelector("[data-hgl1-search-route]");
      if (first) {
        event.preventDefault();
        navigate(first.dataset.hgl1SearchRoute);
      }
    }
  }

  function syncRoute(input) {
    const match = findRoute(input);
    if (!match) return null;
    if (!runtime) return match;
    const changed = runtime.route !== match.route;
    runtime.route = match.route;
    runtime.viewStatus = null;
    runtime.viewMessage = "";
    if (changed) recordEvent("route-view", match.route, runtime.storage);
    render();
    emit("route-change", { route: match.route, id: match.id, layer: "galaxy" });
    return match;
  }

  function unmount() {
    if (!runtime) return false;
    const active = runtime;
    cleanupDelegate();
    active.cleanups.splice(0).reverse().forEach(function runCleanup(cleanup) {
      try { cleanup(); } catch (_) { /* Detached browser targets are harmless. */ }
    });
    if (active.toastTimer && globalScope.clearTimeout) globalScope.clearTimeout(active.toastTimer);
    if (active.host) {
      active.host.innerHTML = "";
      if (active.originalFragment) active.host.appendChild(active.originalFragment);
      if (active.hadHostAttribute) active.host.setAttribute("data-hh-galaxy-layer-one-host", active.hostAttributeValue || "");
      else active.host.removeAttribute("data-hh-galaxy-layer-one-host");
    }
    runtime = null;
    emit("unmounted", { version: VERSION });
    return true;
  }

  function mount(hostOrOptions, maybeOptions) {
    const isElement = hostOrOptions && hostOrOptions.nodeType === 1;
    const isSelector = typeof hostOrOptions === "string";
    const options = isElement || isSelector ? (maybeOptions || {}) : (hostOrOptions || {});
    const host = resolveHost(isElement || isSelector ? hostOrOptions : options.host);
    if (!host) return false;
    const requested = findRoute(options.route || currentRoute());
    if (!requested) return false;
    if (runtime && runtime.host === host) {
      runtime.options = Object.assign({}, runtime.options, options);
      return Boolean(syncRoute(requested.route));
    }
    if (runtime) unmount();

    const doc = globalScope.document;
    let originalFragment = null;
    if (doc && typeof doc.createDocumentFragment === "function") {
      originalFragment = doc.createDocumentFragment();
      while (host.firstChild) originalFragment.appendChild(host.firstChild);
    }
    runtime = {
      host: host,
      app: null,
      route: requested.route,
      options: options,
      storage: resolveStorage(options.storage),
      localState: emptyState(),
      storageStatus: "ready",
      reason: "mounting",
      viewStatus: options.status || null,
      viewMessage: options.message || "",
      originalFragment: originalFragment,
      hadHostAttribute: host.hasAttribute("data-hh-galaxy-layer-one-host"),
      hostAttributeValue: host.getAttribute("data-hh-galaxy-layer-one-host"),
      cleanups: [],
      delegateCleanups: [],
      toastTimer: 0
    };
    host.setAttribute("data-hh-galaxy-layer-one-host", "v" + VERSION);
    listen(host, "click", handleClick);
    listen(host, "submit", handleSubmit);
    listen(host, "input", handleInput);
    listen(host, "change", handleChange);
    listen(host, "keydown", handleKeydown);
    listen(globalScope, "hashchange", function onHashChange() {
      const next = findRoute(currentRoute());
      if (next) syncRoute(next.route);
    });
    listen(globalScope, "online", render);
    listen(globalScope, "offline", render);
    render();
    recordEvent("route-view", requested.route, runtime.storage);
    emit("mounted", { version: VERSION, route: requested.route, layer: "galaxy" });
    return true;
  }

  function getState() {
    if (!runtime) {
      return Object.freeze({ mounted: false, route: null, storageStatus: "idle", reason: "not-mounted", layer: "galaxy" });
    }
    return Object.freeze({
      mounted: true,
      route: runtime.route,
      storageStatus: runtime.storageStatus,
      reason: runtime.reason,
      layer: "galaxy",
      localItems: runtime.localState.items.length,
      analyticsConsent: runtime.localState.settings.analyticsConsent
    });
  }

  const api = Object.freeze({
    version: VERSION,
    storageKey: STORAGE_KEY,
    eventPrefix: EVENT_PREFIX,
    routes: routes,
    routeManifest: routeManifest,
    templates: templates,
    normalizeRoute: normalizeRoute,
    canHandle: canHandle,
    searchRoutes: searchRoutes,
    collectLocalState: collectLocalState,
    inspectLocalState: inspectLocalState,
    writeLocalState: writeLocalState,
    createLocalItem: createLocalItem,
    copyTemplate: copyTemplate,
    deleteLocalItem: deleteLocalItem,
    serializeBackup: serializeBackup,
    importBackup: importBackup,
    summarizeAnalytics: summarizeAnalytics,
    viewMarkup: viewMarkup,
    mount: mount,
    unmount: unmount,
    syncRoute: syncRoute,
    getState: getState
  });

  return api;
});
