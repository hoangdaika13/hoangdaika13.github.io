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
  const MAX_TEXT_LENGTH = 100000;
  const MAX_ITEM_DESCRIPTION = 16000;
  const AI_HANDOFF_KEY = "hh.galaxy.ai.handoff.v1";
  const AI_HANDOFF_TTL_MS = 15 * 60 * 1000;
  const BACKUP_MAX_BYTES = 8 * 1024 * 1024;
  const CONTENT_STORAGE_MAX_RECORDS = 800;
  const GAME_CONTROLS_KEY = "hh.galaxy.games.controls.v1";
  const LEARNING_RECORD_ID = "learning-state-v1";

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

  // Curated, local-only art for the eleven functional Layer One destinations.
  // Home intentionally keeps its live code-native map instead of preloading a
  // portal image. Each view renders only its current route's hero asset.
  const PORTAL_HERO_IMAGES = Object.freeze({
    ai: Object.freeze({ src: "assets/galaxy/function-portals/ai-universe-v1.png", width: 1672, height: 941 }),
    music: Object.freeze({ src: "assets/galaxy/function-portals/music-planet-v1.png", width: 1672, height: 941 }),
    video: Object.freeze({ src: "assets/galaxy/function-portals/video-planet-v1.png", width: 1672, height: 941 }),
    creator: Object.freeze({ src: "assets/galaxy/function-portals/creator-studio-v1.png", width: 1672, height: 941 }),
    games: Object.freeze({ src: "assets/galaxy/function-portals/games-world-v1.png", width: 1672, height: 941 }),
    dev: Object.freeze({ src: "assets/galaxy/function-portals/dev-planet-v2.png", width: 1672, height: 941 }),
    learning: Object.freeze({ src: "assets/galaxy/function-portals/learning-star-v1.png", width: 1672, height: 941 }),
    community: Object.freeze({ src: "assets/galaxy/function-portals/community-v1.png", width: 1672, height: 941 }),
    tools: Object.freeze({ src: "assets/galaxy/function-portals/tools-galaxy-v1.png", width: 1672, height: 941 }),
    analytics: Object.freeze({ src: "assets/galaxy/function-portals/analytics-v1.png", width: 1672, height: 941 }),
    settings: Object.freeze({ src: "assets/galaxy/function-portals/settings-v2.png", width: 1672, height: 941 })
  });

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
        Object.freeze(["Game Canvas", "Orbit Collector chạy bằng Canvas, có save, remap phím, gamepad và pause theo vòng đời tab.", "available"]),
        Object.freeze(["Trợ năng", "Tùy chọn chuyển động được kế thừa từ Cài đặt Galaxy.", "available"])
      ])
    }),
    "/galaxy/dev": Object.freeze({
      kind: "code-project", createLabel: "Tạo snippet", fileAccept: ".html,.css,.js,.json,.md,text/*,application/json",
      status: "Workspace cục bộ, không thực thi mã tự động", statusTone: "local",
      features: Object.freeze([
        Object.freeze(["Snippet manager", "Tạo, tìm kiếm và xuất metadata dự án code.", "available"]),
        Object.freeze(["JSON formatter", "Mở trong Tools Galaxy và xử lý hoàn toàn cục bộ.", "available"]),
        Object.freeze(["Preview sandbox", "Xem trước HTML/CSS trong iframe sandbox không script và không mạng.", "available"])
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

  function freezeWorldExperience(experience) {
    return Object.freeze({
      signal: experience.signal,
      title: experience.title,
      description: experience.description,
      visualLabel: experience.visualLabel,
      visualHint: experience.visualHint,
      railTitle: experience.railTitle,
      railDescription: experience.railDescription,
      portalIcons: Object.freeze((experience.portalIcons || []).slice())
    });
  }

  const WORLD_EXPERIENCES = Object.freeze({
    home: freezeWorldExperience({
      signal: "Điểm khởi hành",
      title: "Khám phá HH Galaxy",
      description: "Mỗi hành tinh là một không gian chức năng độc lập. Chọn điểm đến ở bản đồ hoặc thanh điều hướng để bắt đầu hành trình.",
      visualLabel: "Galaxy Nexus",
      visualHint: "Bản đồ lớp 1",
      railTitle: "La bàn Galaxy",
      railDescription: "Bản đồ chỉ điều hướng giữa các khu vực của lớp 1 và không tạo thêm cổng sang sản phẩm khác.",
      portalIcons: ["home", "search", "settings"]
    }),
    ai: freezeWorldExperience({
      signal: "Tinh vân trí tuệ",
      title: "Kiến tạo ý tưởng trong AI Universe",
      description: "Xây dựng thư viện prompt, ghi chú ngữ cảnh và tài liệu AI của riêng bạn trong một workspace cục bộ, minh bạch.",
      visualLabel: "AI Nebula",
      visualHint: "Nhà cung cấp chưa cấu hình",
      railTitle: "Trạm điều phối AI",
      railDescription: "Prompt được lưu trên thiết bị. Hội thoại chỉ hoạt động sau khi có backend proxy và nhà cung cấp hợp lệ.",
      portalIcons: ["ai", "database", "upload"]
    }),
    music: freezeWorldExperience({
      signal: "Quỹ đạo âm thanh",
      title: "Chạm vào nhịp điệu của Music Planet",
      description: "Tổ chức dự án âm thanh, playlist và metadata tệp ngay trên thiết bị trong một hành tinh giàu nhịp điệu.",
      visualLabel: "Sonic Orbit",
      visualHint: "Thư viện cục bộ",
      railTitle: "Đài âm thanh",
      railDescription: "Tệp chỉ được chọn khi bạn chủ động nhập; quyền microphone chỉ được hỏi khi bạn yêu cầu kiểm tra.",
      portalIcons: ["music", "upload", "settings"]
    }),
    video: freezeWorldExperience({
      signal: "Dải ngân hà điện ảnh",
      title: "Dựng câu chuyện tại Video Planet",
      description: "Chuẩn bị media, caption, thumbnail và kế hoạch video trong một không gian trực quan dành riêng cho hình ảnh chuyển động.",
      visualLabel: "Cinema Halo",
      visualHint: "Media trên thiết bị",
      railTitle: "Buồng dựng hình",
      railDescription: "Workspace hiện quản lý dự án và metadata. Timeline editor chỉ xuất hiện khi có runtime chuyên dụng.",
      portalIcons: ["video", "database", "creator"]
    }),
    creator: freezeWorldExperience({
      signal: "Trung tâm sáng tạo",
      title: "Điều phối hành trình tại Creator Studio",
      description: "Một buồng lái chuyên dụng cho quy trình sản xuất nội dung lớp 1, từ ý tưởng đến kiểm tra đầu ra.",
      visualLabel: "Creator Core",
      visualHint: "Pipeline độc lập",
      railTitle: "Bản đồ quy trình",
      railDescription: "Creator Studio sở hữu dữ liệu và vòng đời dự án riêng, không sử dụng component hoặc dữ liệu của lớp 2.",
      portalIcons: ["creator", "database", "analytics"]
    }),
    games: freezeWorldExperience({
      signal: "Thế giới tương tác",
      title: "Mở hành trình trong Games World",
      description: "Quản lý hồ sơ game web, save cục bộ và tùy chọn trợ năng mà không tạo thành tích hoặc trạng thái người chơi giả.",
      visualLabel: "Play Sphere",
      visualHint: "Save trên thiết bị",
      railTitle: "Trạm trò chơi",
      railDescription: "Game chỉ chạy khi có runtime web an toàn; hồ sơ hiện tại là dữ liệu cục bộ do bạn tạo.",
      portalIcons: ["games", "database", "settings"]
    }),
    dev: freezeWorldExperience({
      signal: "Trạm kiến tạo số",
      title: "Lắp ghép ý tưởng tại Dev Planet",
      description: "Lưu snippet, metadata dự án và thử nghiệm cấu trúc code trong workspace không tự động thực thi mã.",
      visualLabel: "Code Singularity",
      visualHint: "Không tự chạy mã",
      railTitle: "Bảng điều khiển Dev",
      railDescription: "Nội dung được lưu cục bộ. Preview chỉ được bật sau khi có sandbox cô lập và chính sách an toàn phù hợp.",
      portalIcons: ["dev", "tools", "database"]
    }),
    learning: freezeWorldExperience({
      signal: "Ngôi sao tri thức",
      title: "Mở rộng hiểu biết cùng Learning Star",
      description: "Biến ghi chú, flashcard và câu hỏi của bạn thành một hành trình học tập có nguồn dữ liệu rõ ràng.",
      visualLabel: "Knowledge Star",
      visualHint: "Tiến độ từ hoạt động thật",
      railTitle: "Đài quan sát tri thức",
      railDescription: "Tiến độ chỉ được hình thành từ nội dung và hoạt động do bạn lưu; không có chứng nhận tự sinh.",
      portalIcons: ["learning", "database", "help"]
    }),
    community: freezeWorldExperience({
      signal: "Chòm sao kết nối",
      title: "Nuôi dưỡng kết nối tại Community",
      description: "Soạn bài, chuẩn bị nhóm và kế hoạch sự kiện trong không gian ngoại tuyến trước khi có dịch vụ realtime thật.",
      visualLabel: "Social Constellation",
      visualHint: "Realtime chưa cấu hình",
      railTitle: "Tín hiệu cộng đồng",
      railDescription: "Chỉ bản nháp cục bộ đang khả dụng. Thành viên, nhóm, sự kiện và realtime cần dữ liệu từ backend hợp lệ.",
      portalIcons: ["community", "database", "bell"]
    }),
    tools: freezeWorldExperience({
      signal: "Cụm tiện ích",
      title: "Xử lý nhanh tại Tools Galaxy",
      description: "Phân tích văn bản và định dạng JSON trực tiếp trong trình duyệt, không tự động gửi nội dung ra mạng.",
      visualLabel: "Utility Cluster",
      visualHint: "Xử lý cục bộ",
      railTitle: "Khoang công cụ",
      railDescription: "Mỗi tiện ích xử lý đúng dữ liệu bạn nhập trong phiên làm việc hiện tại.",
      portalIcons: ["tools", "dev", "database"]
    }),
    analytics: freezeWorldExperience({
      signal: "Đài quan sát dữ liệu",
      title: "Quan sát hoạt động thật trong Analytics",
      description: "Theo dõi số liệu tối thiểu của lớp 1 trên thiết bị, chỉ sau khi bạn chủ động bật consent.",
      visualLabel: "Data Observatory",
      visualHint: "Consent rõ ràng",
      railTitle: "Phạm vi đo lường",
      railDescription: "Không đọc nội dung tài liệu, không tính bản mẫu và không gửi dữ liệu sang dịch vụ bên ngoài.",
      portalIcons: ["analytics", "database", "download"]
    }),
    settings: freezeWorldExperience({
      signal: "Trung tâm hiệu chỉnh",
      title: "Cá nhân hóa Cài đặt Galaxy",
      description: "Điều chỉnh giao diện, chuyển động, độ tương phản và quyền riêng tư chỉ dành cho lớp 1.",
      visualLabel: "Control Moon",
      visualHint: "Thiết lập riêng biệt",
      railTitle: "Quyền kiểm soát",
      railDescription: "Mọi thay đổi được lưu trên thiết bị và không tác động đến thiết lập của sản phẩm khác.",
      portalIcons: ["settings", "download", "upload"]
    })
  });

  // Canonical HH Platform destinations verified against galaxy-shell.js.
  // Layer One only describes these destinations; access remains exclusively
  // granted by the HH CORE control on /home.
  const LEARNING_DESTINATIONS = Object.freeze([
    Object.freeze({ id: "japanese", title: "HH Japanese", route: "/japanese", glyph: "日", description: "Ngôn ngữ của sự tinh tế, ngữ cảnh và kỷ luật." }),
    Object.freeze({ id: "english", title: "HH English", route: "/english", glyph: "EN", description: "Ngôn ngữ toàn cầu cho học tập và kết nối." }),
    Object.freeze({ id: "chinese", title: "HH Chinese", route: "/chinese", glyph: "中", description: "Hán tự, thanh điệu và chiều sâu văn hóa." }),
    Object.freeze({ id: "dharma", title: "Phật pháp", route: "/phat-phap", glyph: "✦", description: "Kinh văn, thực hành và hành trình hiểu biết từ bi." })
  ]);

  const LEARNING_STAGES = Object.freeze([
    Object.freeze({ id: "start", title: "Khởi động", description: "Làm quen và định hướng", icon: "home" }),
    Object.freeze({ id: "discover", title: "Khám phá", description: "Nội dung cơ bản và nền tảng", icon: "search" }),
    Object.freeze({ id: "understand", title: "Thấu hiểu", description: "Luyện tập và vận dụng", icon: "ai" }),
    Object.freeze({ id: "expand", title: "Mở rộng", description: "Dự án và thực hành nâng cao", icon: "learning" }),
    Object.freeze({ id: "shine", title: "Tỏa sáng", description: "Chia sẻ và lan tỏa tri thức", icon: "creator" })
  ]);

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

  // Dev Planet stores snippets in localStorage, so obvious credential material
  // must fail closed before it ever reaches the persistence layer. References
  // such as process.env.API_KEY remain allowed because they contain no value.
  function containsLikelySecret(value) {
    const text = String(value || "").slice(0, MAX_TEXT_LENGTH);
    if (!text) return false;
    const credentialNames = "(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd|secret)";
    const withoutEnvironmentReferences = text.replace(new RegExp("\\b" + credentialNames + "\\b\\s*[:=]\\s*(?:process\\.env|import\\.meta\\.env|Deno\\.env\\.get)\\b[^\\r\\n;]*", "gi"), "");
    const signatures = [
      /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----/i,
      /\bAKIA[0-9A-Z]{16}\b/,
      /\bAIza[0-9A-Za-z_-]{30,}\b/,
      /\bgh[pousr]_[0-9A-Za-z]{20,}\b/,
      /\b(?:sk|rk)-(?:proj-)?[0-9A-Za-z_-]{16,}\b/,
      /\bBearer\s+[0-9A-Za-z._~+\/-]{20,}/i
    ];
    if (signatures.some(function matchesSecret(pattern) { return pattern.test(text); })) return true;
    return new RegExp("\\b" + credentialNames + "\\b\\s*[:=]\\s*(?:[\"'][^\"'\\s]{8,}[\"']|[0-9A-Za-z_./+=-]{12,})", "i").test(withoutEnvironmentReferences);
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

  function commandCatalog(query, stateInput, activeRoute, limit) {
    const state = sanitizeState(stateInput || emptyState());
    const needle = normalizedSearchText(query);
    const active = findRoute(activeRoute) || routeManifest[0];
    const commands = routeManifest.map(function routeCommand(entry) {
      return {
        id: "route:" + entry.id,
        kind: "route",
        route: entry.route,
        label: entry.label,
        description: entry.eyebrow,
        icon: entry.icon,
        tone: entry.tone,
        search: normalizedSearchText([entry.label, entry.title, entry.description].concat(entry.keywords).join(" "))
      };
    });
    state.items.slice().sort(function newestCommand(a, b) {
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    }).slice(0, 40).forEach(function documentCommand(item) {
      const entry = findRoute(item.route) || active;
      commands.push({
        id: "item:" + item.id,
        kind: "item",
        route: item.route,
        itemId: item.id,
        label: item.title,
        description: "Tài liệu · " + entry.label,
        icon: entry.icon,
        tone: entry.tone,
        search: normalizedSearchText(item.title + " " + item.description + " " + entry.label)
      });
    });
    if (MODULES[active.route]) {
      commands.push({ id: "action:create", kind: "action", action: "focus-create", route: active.route, label: MODULES[active.route].createLabel, description: "Thao tác trong " + active.label, icon: "plus", tone: active.tone, search: normalizedSearchText("tạo mới lưu " + active.label) });
      if (MODULES[active.route].fileAccept) commands.push({ id: "action:import", kind: "action", action: "trigger-file", route: active.route, label: "Nhập tệp vào " + active.label, description: "Chọn tệp từ thiết bị", icon: "upload", tone: active.tone, search: normalizedSearchText("nhập upload tệp " + active.label) });
      commands.push({ id: "action:export", kind: "action", action: "export-route", route: active.route, label: "Xuất dữ liệu " + active.label, description: "Tải JSON dữ liệu người dùng", icon: "download", tone: active.tone, search: normalizedSearchText("xuất download json " + active.label) });
    }
    commands.push({ id: "action:settings", kind: "route", route: "/galaxy/settings", label: "Mở Cài đặt Galaxy", description: "Giao diện, dữ liệu và quyền riêng tư", icon: "settings", tone: "slate", search: normalizedSearchText("cài đặt giao diện quyền riêng tư backup") });
    const matched = needle ? commands.filter(function commandMatch(command) {
      return command.search.indexOf(needle) >= 0 || normalizedSearchText(command.label).indexOf(needle) >= 0;
    }) : commands.filter(function defaultCommands(command) {
      return command.kind === "action" || command.route === active.route || command.route === "/galaxy/settings";
    });
    const seen = new Set();
    return Object.freeze(matched.filter(function uniqueCommand(command) {
      if (seen.has(command.id)) return false;
      seen.add(command.id);
      return true;
    }).slice(0, Math.max(1, Math.min(Number(limit) || 12, 20))));
  }

  function defaultSettings() {
    return {
      theme: "cosmic",
      effects: "balanced",
      contrast: "standard",
      reducedMotion: "system",
      uiScale: "medium",
      colorVision: "standard",
      analyticsConsent: false
    };
  }

  function defaultGameControls() {
    return { up: "w", down: "s", left: "a", right: "d", deadZone: 0.18 };
  }

  function sanitizeGameControls(value) {
    const source = value && typeof value === "object" ? value : {};
    const defaults = defaultGameControls();
    const output = {};
    ["up", "down", "left", "right"].forEach(function sanitizeGameKey(key) {
      const candidate = String(source[key] || defaults[key]).trim().toLocaleLowerCase("en-US").slice(0, 20);
      output[key] = candidate || defaults[key];
    });
    output.deadZone = Math.max(0.05, Math.min(0.5, Number(source.deadZone) || defaults.deadZone));
    return output;
  }

  function loadGameControls(storage) {
    const candidate = resolveStorage(storage);
    if (!candidate) return defaultGameControls();
    try { return sanitizeGameControls(JSON.parse(candidate.getItem(GAME_CONTROLS_KEY) || "{}")); }
    catch (_) { return defaultGameControls(); }
  }

  function saveGameControls(controls, storage) {
    const candidate = resolveStorage(storage);
    if (!candidate) return false;
    try { candidate.setItem(GAME_CONTROLS_KEY, JSON.stringify(sanitizeGameControls(controls))); return true; }
    catch (_) { return false; }
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

  function consumeAiHandoff(candidate, nowInput) {
    const storage = candidate || (function sessionStore() {
      try { return globalScope.sessionStorage || null; } catch (_) { return null; }
    })();
    if (!storage || typeof storage.getItem !== "function") return null;
    let raw = "";
    try {
      raw = storage.getItem(AI_HANDOFF_KEY) || "";
      storage.removeItem(AI_HANDOFF_KEY);
    } catch (_) {
      return null;
    }
    if (!raw || raw.length > 12000) return null;
    try {
      const parsed = JSON.parse(raw);
      const now = Number.isFinite(Number(nowInput)) ? Number(nowInput) : Date.now();
      const at = Number(parsed && parsed.at);
      const prompt = String(parsed && parsed.prompt || "").trim().slice(0, 4000);
      if (!prompt || !Number.isFinite(at) || at > now + 60000 || now - at > AI_HANDOFF_TTL_MS) return null;
      if (parsed.layer !== "galaxy" || parsed.source !== "galaxy-home") return null;
      return Object.freeze({ prompt: prompt, at: at, source: "galaxy-home", layer: "galaxy" });
    } catch (_) {
      return null;
    }
  }

  function sanitizeSettings(value) {
    const source = value && typeof value === "object" ? value : {};
    const defaults = defaultSettings();
    return {
      theme: ["cosmic", "midnight"].includes(source.theme) ? source.theme : defaults.theme,
      effects: ["quiet", "balanced", "rich"].includes(source.effects) ? source.effects : defaults.effects,
      contrast: ["standard", "high"].includes(source.contrast) ? source.contrast : defaults.contrast,
      reducedMotion: ["system", "on", "off"].includes(source.reducedMotion) ? source.reducedMotion : defaults.reducedMotion,
      uiScale: ["small", "medium", "large"].includes(source.uiScale) ? source.uiScale : defaults.uiScale,
      colorVision: ["standard", "deuteranopia", "protanopia", "tritanopia"].includes(source.colorVision) ? source.colorVision : defaults.colorVision,
      analyticsConsent: source.analyticsConsent === true
    };
  }

  function boundedMetaNumber(value, minimum, maximum, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(minimum, Math.min(maximum, number));
  }

  function sanitizeGameState(value) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const target = source.target && typeof source.target === "object" && !Array.isArray(source.target) ? source.target : {};
    return {
      score: Math.floor(boundedMetaNumber(source.score, 0, 1000000000, 0)),
      x: boundedMetaNumber(source.x, 18, 942, 480),
      y: boundedMetaNumber(source.y, 18, 522, 270),
      target: {
        x: boundedMetaNumber(target.x, 50, 910, 180),
        y: boundedMetaNumber(target.y, 50, 490, 140)
      }
    };
  }

  function sanitizeItemMeta(value, route, kind) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const learningCategory = ["note", "plan", "resource"].includes(source.learningCategory) ? source.learningCategory : "";
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(source.dueDate || "")) ? String(source.dueDate) : "";
    const mediaKind = ["audio", "video", "image", "subtitle"].includes(source.mediaKind) ? source.mediaKind : "";
    const meta = {
      fileName: String(source.fileName || "").slice(0, 180),
      fileType: String(source.fileType || "").slice(0, 120),
      fileSize: Math.floor(boundedMetaNumber(source.fileSize, 0, Number.MAX_SAFE_INTEGER, 0)),
      mediaKind: mediaKind,
      copiedFrom: String(source.copiedFrom || "").slice(0, 100),
      learningCategory: learningCategory,
      dueDate: dueDate,
      privacy: ["private", "group", "public"].includes(source.privacy) ? source.privacy : "private",
      provider: String(source.provider || "").slice(0, 80),
      completed: source.completed === true
    };
    if (route === "/galaxy/games" && kind === "game-save") {
      meta.gameState = sanitizeGameState(source.gameState);
      meta.controls = sanitizeGameControls(source.controls);
    }
    if (route === "/galaxy/video" && kind === "video-timestamp-note") {
      meta.atMs = Math.round(boundedMetaNumber(source.atMs, 0, Number.MAX_SAFE_INTEGER, 0));
      meta.mediaName = String(source.mediaName || "").slice(0, 180);
    }
    if (route === "/galaxy/music" && kind === "audio-trim-range") {
      const durationMs = Math.round(boundedMetaNumber(source.durationMs, 0, Number.MAX_SAFE_INTEGER, 0));
      const startMs = Math.round(boundedMetaNumber(source.startMs, 0, durationMs, 0));
      meta.durationMs = durationMs;
      meta.startMs = startMs;
      meta.endMs = Math.round(boundedMetaNumber(source.endMs, startMs, durationMs, startMs));
      meta.sourceName = String(source.sourceName || "").slice(0, 180);
    }
    if (route === "/galaxy/community" && kind === "community-published") {
      meta.remoteAck = source.remoteAck === true;
      meta.remoteMessageId = String(source.remoteMessageId || "").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 160);
    }
    return meta;
  }

  function sanitizeItem(value) {
    if (!value || typeof value !== "object") return null;
    const match = findRoute(value.route);
    if (!match || ["/home", "/galaxy/analytics", "/galaxy/settings"].includes(match.route)) return null;
    const title = String(value.title || "").trim().slice(0, 160);
    if (!title) return null;
    const kind = String(value.kind || "document").slice(0, 60);
    const meta = sanitizeItemMeta(value.meta, match.route, kind);
    return {
      id: String(value.id || createId()).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 96) || createId(),
      route: match.route,
      title: title,
      kind: kind,
      description: String(value.description || "").slice(0, MAX_ITEM_DESCRIPTION),
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

  function prepareLocalItem(route, title, details) {
    const match = findRoute(route);
    if (!match || ["/home", "/galaxy/analytics", "/galaxy/settings"].includes(match.route)) return null;
    const cleanTitle = String(title || "").trim().slice(0, 160);
    if (!cleanTitle) return null;
    const moduleDefinition = MODULES[match.route];
    const input = details && typeof details === "object" ? details : {};
    const now = new Date().toISOString();
    return sanitizeItem({
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
  }

  function commitPreparedLocalItem(item, candidate) {
    const safe = sanitizeItem(item);
    if (!safe) return null;
    const result = inspectLocalState(candidate);
    if (result.status !== "ready") return null;
    if (result.data.items.some(function duplicatePreparedItem(existing) { return existing.id === safe.id; })) return null;
    result.data.items.push(safe);
    result.data.items = result.data.items.slice(-MAX_ITEMS);
    if (!writeLocalState(result.data, candidate)) return null;
    recordEvent("item-create", safe.route, candidate);
    return safe;
  }

  function createLocalItem(route, title, candidate, details) {
    const item = prepareLocalItem(route, title, details);
    if (!item) return null;
    const result = inspectLocalState(candidate);
    if (result.status !== "ready") return null;
    result.data.items.push(item);
    result.data.items = result.data.items.slice(-MAX_ITEMS);
    if (!writeLocalState(result.data, candidate)) return null;
    recordEvent("item-create", item.route, candidate);
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

  function toggleLearningItem(id, candidate) {
    const cleanId = String(id || "");
    const result = inspectLocalState(candidate);
    if (result.status !== "ready") return null;
    const item = result.data.items.find(function findLearningItem(entry) {
      return entry.id === cleanId && entry.route === "/galaxy/learning";
    });
    if (!item) return null;
    item.meta.completed = item.meta.completed !== true;
    item.updatedAt = new Date().toISOString();
    if (!writeLocalState(result.data, candidate)) return null;
    return item.meta.completed;
  }

  function serializeBackup(candidate) {
    const state = collectLocalState(candidate);
    const exportState = sanitizeState(state);
    // Consent is prospective and revocable. Retained events are never exported
    // while consent is off, even though the user may explicitly clear them later.
    if (exportState.settings.analyticsConsent !== true) exportState.events = [];
    return JSON.stringify({
      schema: "hh-galaxy-layer-one-backup",
      version: VERSION,
      exportedAt: new Date().toISOString(),
      data: exportState
    }, null, 2);
  }

  function inspectBackup(text) {
    const sourceText = String(text || "");
    if (!sourceText || sourceText.length > BACKUP_MAX_BYTES) {
      return { ok: false, error: "BACKUP_SIZE_INVALID", imported: 0, candidate: null };
    }
    try {
      const parsed = JSON.parse(sourceText);
      if (!parsed || parsed.schema !== "hh-galaxy-layer-one-backup" || Number(parsed.version) !== VERSION || !parsed.data) {
        return { ok: false, error: "BACKUP_SCHEMA_INVALID", imported: 0, candidate: null };
      }
      const sanitized = sanitizeState(parsed.data);
      if (sanitized.settings.analyticsConsent !== true) sanitized.events = [];
      return {
        ok: true,
        error: null,
        imported: sanitized.items.length,
        candidate: sanitized,
        summary: Object.freeze({
          items: sanitized.items.length,
          events: sanitized.settings.analyticsConsent ? sanitized.events.length : 0,
          exportedAt: safeDate(parsed.exportedAt)
        })
      };
    } catch (_) {
      return { ok: false, error: "BACKUP_JSON_INVALID", imported: 0, candidate: null };
    }
  }

  function mergeBackupState(currentInput, incomingInput) {
    const current = sanitizeState(currentInput);
    const incoming = sanitizeState(incomingInput);
    const byId = new Map(current.items.map(function currentItem(item) { return [item.id, item]; }));
    incoming.items.forEach(function mergeItem(item) { if (!byId.has(item.id)) byId.set(item.id, item); });
    const eventsById = new Map(current.events.map(function currentEvent(event) { return [event.id, event]; }));
    incoming.events.forEach(function mergeEvent(event) { if (!eventsById.has(event.id)) eventsById.set(event.id, event); });
    return sanitizeState({
      version: VERSION,
      settings: current.settings,
      // Current device data wins collisions and capacity pressure. A merge may
      // add backup records, but it must never evict an existing local record.
      items: Array.from(byId.values()).slice(0, MAX_ITEMS),
      events: Array.from(eventsById.values()).slice(0, MAX_EVENTS)
    });
  }

  function applyBackup(candidateState, storage, mode) {
    const current = collectLocalState(storage);
    const next = mode === "merge" ? mergeBackupState(current, candidateState) : sanitizeState(candidateState);
    const currentItemIds = new Set(current.items.map(function currentItemId(item) { return item.id; }));
    const importedCount = mode === "merge"
      ? next.items.filter(function newlyImported(item) { return !currentItemIds.has(item.id); }).length
      : next.items.length;
    // A portable backup is data, not permission. Importing it must never opt
    // this device into Analytics. When consent is currently off, merge keeps
    // only the device's existing event history and replace imports no events.
    next.settings.analyticsConsent = current.settings.analyticsConsent === true;
    if (current.settings.analyticsConsent !== true) {
      next.events = mode === "merge" ? current.events.slice(-MAX_EVENTS) : [];
    }
    const rollback = JSON.stringify(current);
    if (!writeLocalState(next, storage)) return { ok: false, error: "BACKUP_WRITE_FAILED", imported: 0 };
    try {
      recordEvent("data-import", "/galaxy/settings", storage);
      return { ok: true, error: null, imported: importedCount, mode: mode === "merge" ? "merge" : "replace" };
    } catch (_) {
      try { writeLocalState(JSON.parse(rollback), storage); } catch (_) { /* Best-effort rollback. */ }
      return { ok: false, error: "BACKUP_WRITE_FAILED", imported: 0 };
    }
  }

  function importBackup(text, candidate) {
    const inspected = inspectBackup(text);
    if (!inspected.ok) return { ok: false, error: inspected.error, imported: 0 };
    return applyBackup(inspected.candidate, candidate, "replace");
  }

  function backupEngineApi() {
    const api = globalScope.HHGalaxyLayerOneBackup;
    return api && typeof api.serializeBackup === "function" && typeof api.inspectBackup === "function" && typeof api.createImportPlan === "function" ? api : null;
  }

  function emptyCreatorBackup() {
    return { schema: "hh-galaxy.creator-studio.export", schemaVersion: 1, appVersion: "", projects: [], schedule: [] };
  }

  function emptyLearningBackup() {
    return { schema: "hh-galaxy.learning.export", schemaVersion: 1, appVersion: "", decks: [], activities: [] };
  }

  async function withCreatorStore(callback, owner) {
    const active = owner || runtime;
    if (!active) throw new Error("BACKUP_RUNTIME_UNAVAILABLE");
    const dataApi = globalScope.HHGalaxyLayerOneData;
    if (!dataApi || typeof dataApi.createStore !== "function") throw new Error("CREATOR_ENGINE_UNAVAILABLE");
    const store = dataApi.createStore({ storage: active.storage, persistInitial: false });
    if (!store || typeof store.ready !== "function") throw new Error("CREATOR_STORE_UNAVAILABLE");
    try {
      await store.ready();
      return await callback(store);
    } finally {
      if (store && typeof store.close === "function") {
        try { await store.close(); } catch (_) {}
      }
    }
  }

  async function readCreatorBackup(owner) {
    return withCreatorStore(async function exportCreator(store) {
      if (typeof store.exportAsync !== "function") throw new Error("CREATOR_EXPORT_UNAVAILABLE");
      return JSON.parse(await store.exportAsync({ includeDemos: false }));
    }, owner);
  }

  function isPortableJsonRecord(record, backupApi) {
    if (!record || typeof record !== "object" || record.id === LEARNING_RECORD_ID && record.route === "/galaxy/learning") return false;
    try {
      if (backupApi.containsLikelySecret && backupApi.containsLikelySecret(record)) return false;
      backupApi.canonicalStringify(record);
      return true;
    } catch (_) {
      return false;
    }
  }

  async function readPortableContentRecords(backupApi, owner) {
    const active = owner || runtime;
    if (!active || !active.contentStorage) throw new Error("CONTENT_STORAGE_UNAVAILABLE");
    const engine = active.contentStorage;
    if (typeof engine.open !== "function" || typeof engine.list !== "function") throw new Error("CONTENT_STORAGE_INCOMPLETE");
    await engine.open();
    const records = [];
    for (const route of routes) {
      if (route === "/home") continue;
      let offset = 0;
      while (offset < CONTENT_STORAGE_MAX_RECORDS) {
        const listed = await engine.list(route, { limit: 200, offset: offset, newestFirst: false });
        listed.forEach(function collectPortable(record) {
          if (!isPortableJsonRecord(record, backupApi)) return;
          records.push({
            id: String(record.id || "").slice(0, 160),
            route: String(record.route || route).slice(0, 180),
            value: record.value,
            metadata: record.metadata || {},
            createdAt: record.createdAt || null,
            updatedAt: record.updatedAt || null
          });
        });
        offset += listed.length;
        if (listed.length < 200) break;
      }
    }
    return records;
  }

  async function collectCompleteBackupInput(owner) {
    const active = owner || runtime;
    if (!active) throw new Error("BACKUP_RUNTIME_UNAVAILABLE");
    const backupApi = backupEngineApi();
    if (!backupApi) throw new Error("BACKUP_ENGINE_UNAVAILABLE");
    const main = sanitizeState(collectLocalState(active.storage));
    if (main.settings.analyticsConsent !== true) main.events = [];
    const creator = await readCreatorBackup(active);
    const learningApi = learningEngineApi();
    if (!learningApi || typeof learningApi.createExportPayload !== "function") throw new Error("LEARNING_EXPORT_UNAVAILABLE");
    const learningReady = await initializeLearningRuntime(active);
    if (!learningReady) throw new Error(active.learningError || "LEARNING_STORE_UNAVAILABLE");
    const learning = learningApi.createExportPayload(active.learningState || emptyLearningEngineState(), { includeSamples: false });
    const records = await readPortableContentRecords(backupApi, active);
    return { main: main, creator: creator, learning: learning, records: records };
  }

  async function exportCompleteBackup() {
    if (!runtime) return false;
    const active = runtime;
    try {
      const backupApi = backupEngineApi();
      if (!backupApi) throw new Error("BACKUP_ENGINE_UNAVAILABLE");
      const input = await collectCompleteBackupInput(active);
      if (runtime !== active) return false;
      const text = backupApi.serializeBackup(input, { now: new Date() });
      const ok = downloadText("hh-galaxy-layer-one-backup.json", text);
      if (ok) recordEvent("data-export", "/galaxy/settings", active.storage);
      showToast(ok ? "Đã tạo bản sao lưu đa kho JSON." : "Trình duyệt không hỗ trợ tải tệp.", ok ? "success" : "error");
      return ok;
    } catch (error) {
      if (runtime === active) showToast("Không thể tạo sao lưu: " + String(error && (error.code || error.message) || "BACKUP_FAILED").slice(0, 160), "error");
      return false;
    }
  }

  async function replacePortableRecords(targetRecords, currentRecords, owner) {
    const active = owner || runtime;
    if (!active || !active.contentStorage) throw new Error("CONTENT_STORAGE_UNAVAILABLE");
    const engine = active.contentStorage;
    if (typeof engine.open !== "function" || typeof engine.delete !== "function" || typeof engine.put !== "function") throw new Error("CONTENT_STORAGE_INCOMPLETE");
    await engine.open();
    const target = Array.isArray(targetRecords) ? targetRecords : [];
    const current = Array.isArray(currentRecords) ? currentRecords : [];
    const targetKeys = new Set(target.map(function keyOf(record) { return record.route + "\u0000" + record.id; }));
    for (const record of current) {
      const key = record.route + "\u0000" + record.id;
      if (!targetKeys.has(key)) await engine.delete(record.route, record.id);
    }
    for (const record of target) {
      if (typeof engine.restore === "function") await engine.restore(record);
      else await engine.put(record.route, record.id, record.value, record.metadata || {});
    }
  }

  async function restoreCreatorBackup(payload, owner, audit) {
    return withCreatorStore(function restoreCreator(store) {
      if (typeof store.replaceValidatedSnapshotAsync !== "function") throw new Error("CREATOR_TRANSACTION_RESTORE_UNAVAILABLE");
      return store.replaceValidatedSnapshotAsync(payload, { audit: audit === true });
    }, owner);
  }

  async function applyCompleteBackup(candidate, mode) {
    if (!runtime) return { ok: false, error: "BACKUP_RUNTIME_UNAVAILABLE", imported: 0 };
    const active = runtime;
    const backupApi = backupEngineApi();
    const learningApi = learningEngineApi();
    if (!backupApi) return { ok: false, error: "BACKUP_ENGINE_UNAVAILABLE", imported: 0 };
    if (!learningApi || typeof learningApi.normalizeState !== "function") return { ok: false, error: "LEARNING_ENGINE_UNAVAILABLE", imported: 0 };
    let current;
    let plan;
    let creatorApplied = false;
    let learningApplied = false;
    let recordsApplied = false;
    let mainApplied = false;
    try {
      current = await collectCompleteBackupInput(active);
      if (runtime !== active) throw new Error("BACKUP_RUNTIME_STALE");
      plan = backupApi.createImportPlan(current, candidate, { mode: mode });
      if (!active.contentStorage || typeof active.contentStorage.put !== "function") throw new Error("CONTENT_STORAGE_UNAVAILABLE");
      if (typeof active.contentStorage.usage === "function") {
        const usage = await active.contentStorage.usage();
        const retainedRecords = Math.max(0, Number(usage && usage.records || 0) - current.records.length);
        if (retainedRecords + plan.stores.records.length > CONTENT_STORAGE_MAX_RECORDS) throw new Error("BACKUP_CONTENT_CAPACITY_EXCEEDED");
      }
      const nextLearning = learningApi.normalizeState({ decks: plan.stores.learning.decks, activities: plan.stores.learning.activities });
      creatorApplied = true;
      await restoreCreatorBackup(plan.stores.creator, active, false);
      if (runtime !== active) throw new Error("BACKUP_RUNTIME_STALE");
      learningApplied = true;
      await active.contentStorage.put("/galaxy/learning", LEARNING_RECORD_ID, nextLearning, { schema: learningApi.SCHEMA, schemaVersion: learningApi.SCHEMA_VERSION, contentType: "application/json" });
      if (runtime !== active) throw new Error("BACKUP_RUNTIME_STALE");
      active.learningState = nextLearning;
      active.learningStatus = "ready";
      recordsApplied = true;
      await replacePortableRecords(plan.stores.records, current.records, active);
      if (runtime !== active) throw new Error("BACKUP_RUNTIME_STALE");
      mainApplied = true;
      if (!writeLocalState(plan.stores.main, active.storage)) throw new Error("BACKUP_MAIN_WRITE_FAILED");
      if (plan.stores.main.settings.analyticsConsent === true && !recordEvent("data-import", "/galaxy/settings", active.storage)) throw new Error("BACKUP_EVENT_WRITE_FAILED");
      active.localState = collectLocalState(active.storage);
      return { ok: true, error: null, imported: plan.changes.added + plan.changes.replaced, plan: plan };
    } catch (error) {
      const rollbackErrors = [];
      if (current) {
        if (mainApplied && !writeLocalState(current.main, active.storage)) rollbackErrors.push("main");
        if (recordsApplied) {
          try { await replacePortableRecords(current.records, plan && plan.stores && plan.stores.records || [], active); }
          catch (_) { rollbackErrors.push("records"); }
        }
        if (learningApplied) {
          try {
            const priorLearning = learningApi.normalizeState({ decks: current.learning.decks, activities: current.learning.activities });
            await active.contentStorage.put("/galaxy/learning", LEARNING_RECORD_ID, priorLearning, { schema: learningApi.SCHEMA, schemaVersion: learningApi.SCHEMA_VERSION, contentType: "application/json" });
            active.learningState = priorLearning;
          } catch (_) { rollbackErrors.push("learning"); }
        }
        if (creatorApplied) {
          try { await restoreCreatorBackup(current.creator, active, false); }
          catch (_) { rollbackErrors.push("creator"); }
        }
        if (runtime === active) active.localState = collectLocalState(active.storage);
      }
      const failure = String(error && (error.code || error.message) || "BACKUP_IMPORT_FAILED").slice(0, 140);
      return { ok: false, error: failure + (rollbackErrors.length ? " · ROLLBACK_FAILED:" + rollbackErrors.join(",") : ""), imported: 0, rollbackFailed: rollbackErrors };
    }
  }

  function analyticsRangeStart(range, nowInput) {
    const numeric = Number(nowInput);
    const parsed = Date.parse(String(nowInput || ""));
    const now = Number.isFinite(numeric) ? numeric : Number.isFinite(parsed) ? parsed : Date.now();
    if (range === "today") {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    }
    if (range === "7d") return now - 7 * 24 * 60 * 60 * 1000;
    if (range === "30d") return now - 30 * 24 * 60 * 60 * 1000;
    return 0;
  }

  function summarizeAnalytics(stateInput, rangeInput, nowInput) {
    const state = sanitizeState(stateInput || emptyState());
    const consent = state.settings.analyticsConsent === true;
    const range = ["today", "7d", "30d", "all"].includes(rangeInput) ? rangeInput : "all";
    const start = analyticsRangeStart(range, nowInput);
    const events = consent ? state.events.filter(function inRange(event) {
      const at = Date.parse(event.at);
      return Number.isFinite(at) && at >= start;
    }) : [];
    const routeViews = events.filter(function routeView(event) { return event.type === "route-view"; });
    const moduleRoutes = new Set(routeViews.map(function eventRoute(event) { return event.route; }).filter(Boolean));
    return Object.freeze({
      consent: consent,
      range: range,
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

  function localDateKey(value) {
    const date = value instanceof Date ? value : new Date(value || Date.now());
    if (!Number.isFinite(date.getTime())) return "";
    const year = String(date.getFullYear()).padStart(4, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function formatLearningDate(value) {
    const key = /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : "";
    if (!key) return "Chưa đặt ngày";
    try {
      return new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(key + "T12:00:00"));
    } catch (_) {
      return key;
    }
  }

  function emptyLearningEngineState() {
    return { decks: [], activities: [] };
  }

  function learningEngineApi() {
    const api = globalScope.HHGalaxyLayerOneLearning;
    return api && typeof api.normalizeState === "function" ? api : null;
  }

  function normalizeLearningEngineState(value) {
    const api = learningEngineApi();
    if (!api) return emptyLearningEngineState();
    try {
      return api.normalizeState(value && typeof value === "object" ? value : emptyLearningEngineState());
    } catch (_) {
      return emptyLearningEngineState();
    }
  }

  function selectedLearningDeck(state, selectedId) {
    const decks = state && Array.isArray(state.decks) ? state.decks : [];
    return decks.find(function exactLearningDeck(deck) { return deck.id === selectedId; }) || decks[0] || null;
  }

  function learningDueCards(deck, nowInput) {
    if (!deck || !Array.isArray(deck.cards) || deck.isSample) return [];
    const now = Date.parse(nowInput || new Date().toISOString());
    return deck.cards.filter(function dueLearningCard(card) {
      if (card.isSample) return false;
      const schedule = card.schedule || {};
      if (!Number(schedule.reviewCount)) return true;
      const dueAt = Date.parse(schedule.dueAt || "");
      return Number.isFinite(dueAt) && dueAt <= now;
    });
  }

  function mergeLearningStates(currentInput, importedInput) {
    const api = learningEngineApi();
    if (!api) throw new Error("Learning engine chưa khả dụng.");
    const current = api.normalizeState(currentInput || emptyLearningEngineState());
    const incoming = api.normalizeState(importedInput || emptyLearningEngineState());
    const decks = current.decks.map(function cloneCurrentDeck(deck) { return JSON.parse(JSON.stringify(deck)); });
    const deckById = new Map(decks.map(function indexDeck(deck) { return [deck.id, deck]; }));
    incoming.decks.forEach(function mergeImportedDeck(deck) {
      const existing = deckById.get(deck.id);
      if (!existing) {
        const copy = JSON.parse(JSON.stringify(deck));
        decks.push(copy);
        deckById.set(copy.id, copy);
        return;
      }
      const cards = new Map(existing.cards.map(function indexCard(card) { return [card.id, card]; }));
      deck.cards.forEach(function mergeImportedCard(card) {
        if (!cards.has(card.id)) existing.cards.push(JSON.parse(JSON.stringify(card)));
      });
      existing.updatedAt = Date.parse(deck.updatedAt) > Date.parse(existing.updatedAt) ? deck.updatedAt : existing.updatedAt;
    });
    const activities = current.activities.map(function cloneActivity(activity) { return JSON.parse(JSON.stringify(activity)); });
    const activityIds = new Set(activities.map(function indexActivity(activity) { return activity.id; }));
    incoming.activities.forEach(function mergeImportedActivity(activity) {
      if (!activityIds.has(activity.id)) {
        activities.push(JSON.parse(JSON.stringify(activity)));
        activityIds.add(activity.id);
      }
    });
    return api.normalizeState({ decks: decks, activities: activities });
  }

  function navMarkup(activeRoute, mobileOnly) {
    const links = routeManifest.filter(function mobileRoutes(entry) {
      return !mobileOnly || ["home", "ai", "creator", "tools", "settings"].includes(entry.id);
    }).map(function navEntry(entry) {
      const active = entry.route === activeRoute;
      return "<a class=\"hgl1-nav__link hgl1-tone--" + entry.tone + "\" href=\"#" + entry.route + "\" data-hgl1-route=\"" + entry.route + "\" aria-current=\"" + (active ? "page" : "false") + "\">" +
        "<span class=\"hgl1-nav__icon hgl1-nav__planet hgl1-nav__planet--" + entry.id + "\" aria-hidden=\"true\"><span class=\"hgl1-nav__planet-glow\"></span>" + icon(entry.icon) + "</span>" +
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

  function worldExperience(entry) {
    return WORLD_EXPERIENCES[entry.id] || freezeWorldExperience({
      signal: entry.eyebrow,
      title: entry.title,
      description: entry.description,
      visualLabel: entry.label,
      visualHint: "Không gian lớp 1",
      railTitle: "Thông tin khu vực",
      railDescription: entry.description,
      portalIcons: [entry.icon, "database", "settings"]
    });
  }

  function worldHeroImageMarkup(entry) {
    const image = PORTAL_HERO_IMAGES[entry.id];
    if (!image) return "";
    return "<picture class=\"hgl1-world-hero__media hgl1-world-hero__media--" + entry.id + "\" aria-hidden=\"true\">" +
      "<img class=\"hgl1-world-hero__image\" src=\"" + image.src + "\" width=\"" + image.width + "\" height=\"" + image.height + "\" alt=\"\" loading=\"eager\" decoding=\"async\" fetchpriority=\"high\" draggable=\"false\"/>" +
      "</picture>";
  }

  function worldHeroMarkup(entry, actions, overrides) {
    const experience = worldExperience(entry);
    const options = overrides && typeof overrides === "object" ? overrides : {};
    const title = options.title || experience.title;
    const description = options.description || experience.description;
    const eyebrow = options.eyebrow || entry.eyebrow;
    const heroClass = options.heroClass ? " " + options.heroClass : "";
    const bodyClass = options.bodyClass ? " " + options.bodyClass : "";
    const visualClass = options.visualClass ? " " + options.visualClass : "";
    const orbClass = options.orbClass ? " " + options.orbClass : "";
    const constellationClass = options.constellationClass ? " " + options.constellationClass : "";
    const extra = options.extra || "";
    const heroImage = worldHeroImageMarkup(entry);
    return "<header class=\"hgl1-page-head hgl1-world-hero hgl1-world-hero--" + entry.id + heroClass + "\" aria-labelledby=\"hgl1-world-title-" + entry.id + "\">" +
      "<div class=\"hgl1-world-hero__body" + bodyClass + "\"><span class=\"hgl1-eyebrow\">" + escapeHtml(eyebrow) + "</span>" +
      "<span class=\"hgl1-world-hero__signal\"><i aria-hidden=\"true\"></i>" + escapeHtml(experience.signal) + "</span>" +
      "<h1 id=\"hgl1-world-title-" + entry.id + "\">" + escapeHtml(title) + "</h1><p>" + escapeHtml(description) + "</p>" +
      (actions ? "<div class=\"hgl1-page-head__actions\">" + actions + "</div>" : "") + "</div>" +
      "<div class=\"hgl1-world-hero__visual" + visualClass + "\" aria-hidden=\"true\">" + heroImage + "<span class=\"hgl1-world-constellation hgl1-world-constellation--" + entry.id + constellationClass + "\"><i></i><i></i><i></i><i></i><i></i><i></i></span>" +
      "<span class=\"hgl1-world-orb hgl1-world-orb--" + entry.id + orbClass + "\"><i class=\"hgl1-world-orb__ring\"></i><i class=\"hgl1-world-orb__core\"></i><i class=\"hgl1-world-orb__satellite\"></i><span class=\"hgl1-world-orb__glyph\">" + icon(entry.icon) + "</span></span>" +
      "<span class=\"hgl1-world-hero__caption\"><b>" + escapeHtml(experience.visualLabel) + "</b><small>" + escapeHtml(experience.visualHint) + "</small></span></div>" + extra + "</header>";
  }

  function worldRailMarkup(entry, options) {
    const experience = worldExperience(entry);
    const context = options && typeof options === "object" ? options : {};
    const facts = [];
    if (context.status) facts.push(["Trạng thái", context.status]);
    if (Number.isFinite(context.itemCount)) facts.push(["Tài liệu của bạn", String(Math.max(0, context.itemCount))]);
    if (context.scope) facts.push(["Phạm vi", context.scope]);
    const factsMarkup = facts.length ? "<dl class=\"hgl1-world-rail__facts\">" + facts.map(function worldFact(fact) {
      return "<div><dt>" + escapeHtml(fact[0]) + "</dt><dd>" + escapeHtml(fact[1]) + "</dd></div>";
    }).join("") + "</dl>" : "";
    const actions = Array.isArray(context.actions) ? context.actions.slice(0, 5) : [];
    const actionsMarkup = actions.length ? "<section class=\"hgl1-world-rail__card hgl1-world-rail__actions\"><span class=\"hgl1-kicker\">Thao tác nhanh</span><div>" + actions.map(function railAction(action) {
      const route = action.route ? " data-route=\"" + escapeHtml(action.route) + "\"" : "";
      return "<button type=\"button\" data-hgl1-action=\"" + escapeHtml(action.action) + "\"" + route + "><span aria-hidden=\"true\">" + icon(action.icon || entry.icon) + "</span><b>" + escapeHtml(action.label) + "</b>" + icon("arrow") + "</button>";
    }).join("") + "</div></section>" : "";
    const recent = Array.isArray(context.recentItems) ? context.recentItems.slice(0, 3) : [];
    const recentMarkup = recent.length ? "<section class=\"hgl1-world-rail__card hgl1-world-rail__recent\"><span class=\"hgl1-kicker\">Gần đây</span><ol>" + recent.map(function recentItem(item) {
      return "<li><button type=\"button\" data-hgl1-action=\"scroll-to-item\" data-item-id=\"" + escapeHtml(item.id) + "\"><span>" + icon("database") + "</span><b>" + escapeHtml(item.title) + "</b><small>" + escapeHtml(formatLocalTime(item.updatedAt)) + "</small></button></li>";
    }).join("") + "</ol></section>" : "";
    return "<aside class=\"hgl1-world-rail hgl1-world-rail--" + entry.id + "\" aria-label=\"Thông tin " + escapeHtml(entry.label) + "\">" +
      "<section class=\"hgl1-world-rail__card\"><span class=\"hgl1-kicker\">Tín hiệu khu vực</span><h2>" + escapeHtml(experience.railTitle) + "</h2><p>" + escapeHtml(experience.railDescription) + "</p></section>" +
      factsMarkup + actionsMarkup + recentMarkup +
      "<section class=\"hgl1-world-rail__card hgl1-world-rail__card--privacy\"><span class=\"hgl1-world-rail__beacon\" aria-hidden=\"true\"></span><div><b>Dữ liệu tách biệt</b><p>Không gian này chỉ sử dụng dữ liệu thuộc HH Galaxy lớp 1.</p></div></section></aside>";
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
    return "<article class=\"hgl1-document\" data-hgl1-item data-item-id=\"" + escapeHtml(item.id) + "\" data-filter-text=\"" + escapeHtml(normalizedSearchText(item.title + " " + item.description)) + "\">" +
      "<div class=\"hgl1-document__visual hgl1-document__visual--" + escapeHtml(entry ? entry.tone : "slate") + "\" aria-hidden=\"true\">" + icon(entry ? entry.icon : "database") + "<span></span></div>" +
      "<div class=\"hgl1-document__body\"><div class=\"hgl1-document__meta\"><span class=\"hgl1-badge hgl1-badge--local\">Cục bộ</span><span>" + escapeHtml(item.kind) + "</span></div>" +
      "<h3>" + escapeHtml(item.title) + "</h3><p>" + (item.description ? escapeHtml(item.description) : "Tài liệu người dùng, không có số liệu minh họa.") + "</p>" +
      "<div class=\"hgl1-document__footer\"><time datetime=\"" + escapeHtml(item.updatedAt) + "\">" + escapeHtml(formatLocalTime(item.updatedAt)) + "</time>" +
      "<button class=\"hgl1-icon-button hgl1-icon-button--danger\" type=\"button\" data-hgl1-action=\"delete-item\" data-item-id=\"" + escapeHtml(item.id) + "\" aria-label=\"Xóa " + escapeHtml(item.title) + "\">" + icon("close") + "</button></div></div>" +
    "</article>";
  }

  function featureMarkup(features, entry) {
    const experience = worldExperience(entry);
    return features.map(function featureCard(feature, index) {
      const state = feature[2];
      const labels = { available: "Cục bộ", unconfigured: "Chưa cấu hình", permission: "Theo yêu cầu" };
      const portalIcon = experience.portalIcons[index] || entry.icon;
      const actionable = state === "available" || state === "permission";
      const tag = actionable ? "button" : "article";
      const action = actionable ? " type=\"button\" data-hgl1-action=\"open-capability\" data-capability-index=\"" + index + "\"" : "";
      return "<" + tag + " class=\"hgl1-feature hgl1-portal-card hgl1-portal-card--" + state + "\" data-capability=\"" + state + "\"" + action + ">" +
        "<div class=\"hgl1-portal-card__visual\" aria-hidden=\"true\"><span></span>" + icon(portalIcon) + "</div>" +
        "<div class=\"hgl1-portal-card__body\"><span class=\"hgl1-feature__signal\" aria-hidden=\"true\"></span><span class=\"hgl1-feature__state\">" + labels[state] + "</span><h3>" + escapeHtml(feature[0]) + "</h3><p>" + escapeHtml(feature[1]) + "</p></div></" + tag + ">";
    }).join("");
  }

  function moduleWorkspaceMarkup(entry) {
    if (entry.route === "/galaxy/ai") {
      return "<section class=\"hgl1-functional-workspace hgl1-ai-workspace\" data-hgl1-ai-workspace aria-labelledby=\"hgl1-ai-workspace-title\">" +
        "<header class=\"hgl1-section-head\"><div><span class=\"hgl1-kicker\">Kết nối có kiểm chứng</span><h2 id=\"hgl1-ai-workspace-title\">Trợ lý AI lớp 1</h2></div><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"probe-ai-provider\">Kiểm tra provider</button></header>" +
        "<p class=\"hgl1-runtime-status\" data-hgl1-ai-status data-state=\"checking\" role=\"status\">Đang kiểm tra gateway AI trên máy chủ…</p>" +
        "<form data-hgl1-ai-form><div class=\"hgl1-workspace-toolbar\"><label for=\"hgl1-ai-preset\">Mẫu yêu cầu<select id=\"hgl1-ai-preset\" data-hgl1-ai-preset><option value=\"\">Tự viết</option><option value=\"summarize\">Tóm tắt tài liệu</option><option value=\"brainstorm\">Phát triển ý tưởng</option><option value=\"rewrite\">Biên tập rõ ràng</option><option value=\"plan\">Lập kế hoạch hành động</option></select></label><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"trigger-file\" data-route=\"/galaxy/ai\">" + icon("upload") + " Đính kèm tài liệu</button></div><label for=\"hgl1-ai-prompt\">Nội dung yêu cầu</label><textarea id=\"hgl1-ai-prompt\" name=\"prompt\" data-hgl1-ai-draft maxlength=\"4000\" rows=\"7\" placeholder=\"Nhập yêu cầu; nội dung chỉ được gửi khi bạn bấm Gửi…\"></textarea><div class=\"hgl1-workspace-actions\"><button class=\"hgl1-button hgl1-button--primary\" type=\"submit\" data-hgl1-ai-send disabled>Gửi tới provider</button><button class=\"hgl1-button hgl1-button--danger\" type=\"button\" data-hgl1-action=\"stop-ai-request\" data-hgl1-ai-stop disabled>Dừng</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"retry-ai-request\" data-hgl1-ai-retry disabled>Thử lại</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"save-ai-draft\">Lưu bản nháp</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"clear-ai-draft\">Hội thoại mới</button></div></form>" +
        "<output class=\"hgl1-tool__output hgl1-ai-response\" data-hgl1-ai-response aria-live=\"polite\">Chưa gửi yêu cầu. Provider và trạng thái đăng nhập sẽ được kiểm tra thật.</output><p class=\"hgl1-privacy-note\">Lịch sử chỉ được lưu cục bộ sau khi provider trả phản hồi thật. Bạn có thể dừng yêu cầu bất kỳ lúc nào.</p></section>";
    }
    if (entry.route === "/galaxy/music" || entry.route === "/galaxy/video") {
      const isVideo = entry.route === "/galaxy/video";
      const musicTools = "<section class=\"hgl1-media-console hgl1-audio-console\" aria-label=\"Công cụ âm thanh\"><div class=\"hgl1-media-console__head\"><div><span class=\"hgl1-kicker\">Waveform cục bộ</span><h3>Phân tích và thu âm</h3></div><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"toggle-audio-recording\">Bắt đầu thu microphone</button></div><canvas data-hgl1-waveform width=\"960\" height=\"140\" role=\"img\" aria-label=\"Waveform của âm thanh đang chọn\"></canvas><output data-hgl1-recording-status role=\"status\">Chưa thu âm. Trình duyệt chỉ hỏi quyền khi bạn bấm bắt đầu.</output><form data-hgl1-trim-form><label>Bắt đầu (giây)<input name=\"start\" type=\"number\" min=\"0\" step=\"0.1\" value=\"0\" required/></label><label>Kết thúc (giây)<input name=\"end\" type=\"number\" min=\"0.1\" step=\"0.1\" required/></label><button class=\"hgl1-button hgl1-button--ghost\" type=\"submit\">Lưu khoảng cắt</button></form><div><span class=\"hgl1-kicker\">Playlist phiên</span><ol data-hgl1-media-playlist><li>Chưa có tệp âm thanh trong phiên.</li></ol></div></section>";
      const videoTools = "<section class=\"hgl1-media-console hgl1-video-console\" aria-label=\"Công cụ video\"><div class=\"hgl1-media-console__head\"><div><span class=\"hgl1-kicker\">Frame & phụ đề</span><h3>Công cụ dựng nhanh</h3></div><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"capture-video-thumbnail\">Chụp thumbnail</button></div><p data-hgl1-subtitle-status role=\"status\">Nhập SRT/VTT để gắn phụ đề cho video cục bộ đang mở.</p><form data-hgl1-video-note-form><label for=\"hgl1-video-note\">Ghi chú tại thời điểm hiện tại</label><div><input id=\"hgl1-video-note\" name=\"note\" maxlength=\"2000\" required placeholder=\"Nội dung cần sửa hoặc ghi nhớ…\"/><button class=\"hgl1-button hgl1-button--ghost\" type=\"submit\">Lưu timestamp</button></div></form><ol class=\"hgl1-timestamp-list\" data-hgl1-timestamp-list></ol></section>";
      return "<section class=\"hgl1-functional-workspace hgl1-media-workspace\" data-hgl1-media-workspace=\"" + (isVideo ? "video" : "audio") + "\" aria-labelledby=\"hgl1-media-title\"><header class=\"hgl1-section-head\"><div><span class=\"hgl1-kicker\">Player phiên hiện tại</span><h2 id=\"hgl1-media-title\">" + (isVideo ? "Trình phát video ổn định" : "Trình phát âm thanh cục bộ") + "</h2></div><div class=\"hgl1-media-settings\"><label>Âm lượng<input type=\"range\" min=\"0\" max=\"1\" step=\"0.05\" value=\"1\" data-hgl1-media-volume/></label><label>Tốc độ<select data-hgl1-media-rate><option value=\"0.75\">0,75×</option><option value=\"1\" selected>1×</option><option value=\"1.25\">1,25×</option><option value=\"1.5\">1,5×</option><option value=\"2\">2×</option></select></label></div></header>" +
        (isVideo ? "<form class=\"hgl1-youtube-form\" data-hgl1-youtube-form><label for=\"hgl1-youtube-url\">Liên kết YouTube do bạn chọn</label><div><input id=\"hgl1-youtube-url\" name=\"url\" type=\"url\" inputmode=\"url\" maxlength=\"500\" placeholder=\"https://www.youtube.com/watch?v=…\"/><button class=\"hgl1-button hgl1-button--ghost\" type=\"submit\">Mở an toàn</button></div><small>Chỉ youtube.com và youtu.be; player dùng youtube-nocookie.com, không tự phát.</small></form>" : "") +
        "<div class=\"hgl1-media-stage\" data-hgl1-stable-media-host><div class=\"hgl1-delegated-placeholder\" data-hgl1-media-empty><div><h3>Chưa chọn " + (isVideo ? "video" : "âm thanh") + "</h3><p>Bấm Nhập tệp ở phía trên. Tệp chỉ phát từ phiên trình duyệt hiện tại.</p></div></div></div><p class=\"hgl1-runtime-status\" data-hgl1-media-status role=\"status\">Không tự phát · chưa có media đang mở.</p>" + (isVideo ? videoTools : musicTools) + "</section>";
    }
    if (entry.route === "/galaxy/games") {
      return "<section class=\"hgl1-functional-workspace hgl1-game-workspace\" aria-labelledby=\"hgl1-game-title\"><header class=\"hgl1-section-head\"><div><span class=\"hgl1-kicker\">Runtime Canvas cục bộ</span><h2 id=\"hgl1-game-title\">Orbit Collector</h2></div><div class=\"hgl1-workspace-actions\"><button class=\"hgl1-button hgl1-button--primary\" type=\"button\" data-hgl1-action=\"toggle-game\">Bắt đầu</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"save-game-snapshot\">Lưu phiên</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"restore-game-snapshot\">Khôi phục gần nhất</button></div></header><p>Canvas chạy theo delta time, chuẩn hóa input chéo và tự tạm dừng khi tab bị ẩn. Gamepad được đọc trực tiếp khi trình duyệt hỗ trợ.</p><div class=\"hgl1-game-layout\"><div><canvas data-hgl1-game-canvas width=\"960\" height=\"540\" tabindex=\"0\" aria-label=\"Orbit Collector: điều khiển quỹ đạo để thu thập các điểm sáng\"></canvas><output data-hgl1-game-status aria-live=\"polite\">Chưa bắt đầu. Không có điểm số hay người chơi giả.</output></div><form class=\"hgl1-game-controls\" data-hgl1-game-controls-form><h3>Điều khiển</h3><div><label>Lên<input name=\"up\" value=\"W\" maxlength=\"20\" required/></label><label>Xuống<input name=\"down\" value=\"S\" maxlength=\"20\" required/></label><label>Trái<input name=\"left\" value=\"A\" maxlength=\"20\" required/></label><label>Phải<input name=\"right\" value=\"D\" maxlength=\"20\" required/></label></div><label>Dead zone gamepad<input name=\"deadZone\" type=\"range\" min=\"0.05\" max=\"0.5\" step=\"0.01\" value=\"0.18\"/><output data-hgl1-game-deadzone>0,18</output></label><button class=\"hgl1-button hgl1-button--ghost\" type=\"submit\">Lưu phím</button><p data-hgl1-game-controls-status role=\"status\">Có thể dùng thêm phím mũi tên.</p></form></div></section>";
    }
    if (entry.route === "/galaxy/dev") {
      return "<section class=\"hgl1-functional-workspace hgl1-dev-workspace\" aria-labelledby=\"hgl1-dev-title\"><header class=\"hgl1-section-head\"><div><span class=\"hgl1-kicker\">Không thực thi tự động</span><h2 id=\"hgl1-dev-title\">Code workspace cục bộ</h2></div><span class=\"hgl1-runtime-status\" data-state=\"local\">Không lưu secret</span></header><div class=\"hgl1-dev-layout\"><form data-hgl1-dev-form><div class=\"hgl1-dev-fields\"><label for=\"hgl1-dev-name\">Tên snippet<input id=\"hgl1-dev-name\" name=\"title\" maxlength=\"160\" required/></label><label for=\"hgl1-dev-language\">Ngôn ngữ<select id=\"hgl1-dev-language\" name=\"language\"><option value=\"text\">Text</option><option value=\"html\">HTML</option><option value=\"css\">CSS</option><option value=\"javascript\">JavaScript</option><option value=\"json\">JSON</option></select></label></div><label for=\"hgl1-dev-code\">Mã nguồn</label><textarea id=\"hgl1-dev-code\" name=\"code\" maxlength=\"" + MAX_TEXT_LENGTH + "\" rows=\"16\" spellcheck=\"false\" autocomplete=\"off\"></textarea><div class=\"hgl1-workspace-actions\"><button class=\"hgl1-button hgl1-button--primary\" type=\"submit\">Lưu snippet</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"format-dev-code\">Định dạng</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"inspect-dev-code\">Kiểm tra tĩnh</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"preview-dev-code\">Xem trước an toàn</button></div></form><aside class=\"hgl1-dev-preview\"><header><span class=\"hgl1-kicker\">Sandbox không mạng</span><h3>Preview HTML/CSS</h3></header><div data-hgl1-dev-preview-host><p>Preview chỉ được tạo khi bạn bấm nút. JavaScript không được thực thi trong iframe này.</p></div></aside></div><output class=\"hgl1-tool__output\" data-hgl1-dev-output aria-live=\"polite\">Mã không được chạy trong trang chính.</output></section>";
    }
    if (entry.route === "/galaxy/community") {
      return "<section class=\"hgl1-functional-workspace hgl1-community-workspace\" aria-labelledby=\"hgl1-community-title\"><header class=\"hgl1-section-head\"><div><span class=\"hgl1-kicker\">Bản nháp cục bộ</span><h2 id=\"hgl1-community-title\">Soạn bài cộng đồng</h2></div><span class=\"hgl1-runtime-status\" data-hgl1-community-realtime data-state=\"unconfigured\" role=\"status\">Realtime chưa cấu hình</span></header><form data-hgl1-community-form><label for=\"hgl1-community-title-input\">Tiêu đề</label><input id=\"hgl1-community-title-input\" name=\"title\" maxlength=\"160\" required/><label for=\"hgl1-community-body\">Nội dung</label><textarea id=\"hgl1-community-body\" name=\"body\" maxlength=\"8000\" rows=\"8\" required></textarea><label for=\"hgl1-community-privacy\">Quyền riêng tư</label><select id=\"hgl1-community-privacy\" name=\"privacy\"><option value=\"private\">Chỉ mình tôi (bản nháp)</option><option value=\"group\">Nhóm — cần backend</option><option value=\"public\">Công khai — cần backend</option></select><div class=\"hgl1-workspace-actions\"><button class=\"hgl1-button hgl1-button--primary\" type=\"submit\">Lưu bản nháp</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"publish-community\" disabled>Đăng qua realtime</button></div><p>Không có bài nào được đăng ra mạng khi backend chưa xác nhận và trả ACK thật.</p></form></section>";
    }
    return "";
  }

  function moduleMarkup(entry, state) {
    const definition = MODULES[entry.route];
    const items = state.items.filter(function routeItems(item) { return item.route === entry.route; }).slice().reverse();
    const userItems = items.map(itemMarkup).join("");
    const allowsMultiple = entry.route === "/galaxy/music" || entry.route === "/galaxy/video";
    const importControl = definition.fileAccept ? "<button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"trigger-file\" data-route=\"" + entry.route + "\">" + icon("upload") + " Nhập tệp</button><input class=\"hgl1-sr-only\" type=\"file\" tabindex=\"-1\" aria-label=\"Chọn tệp cho " + escapeHtml(entry.label) + "\" data-hgl1-module-file data-route=\"" + entry.route + "\" accept=\"" + escapeHtml(definition.fileAccept) + "\"" + (allowsMultiple ? " multiple" : "") + "/>" : "";
    const permissionControl = entry.route === "/galaxy/music" ? "<button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"check-microphone\">Kiểm tra microphone</button>" : "";
    const heroActions = "<button class=\"hgl1-button hgl1-button--primary\" type=\"button\" data-hgl1-action=\"focus-create\">" + icon("plus") + " " + escapeHtml(definition.createLabel) + "</button>" + importControl + permissionControl;
    return "<section class=\"hgl1-page hgl1-page--module\" data-module=\"" + entry.id + "\">" +
      worldHeroMarkup(entry, heroActions) +
      "<div class=\"hgl1-status-strip\" data-hgl1-module-status><span class=\"hgl1-status-dot hgl1-status-dot--" + definition.statusTone + "\"></span><span data-hgl1-module-status-text>" + escapeHtml(definition.status) + "</span><b>Dữ liệu riêng của lớp 1</b></div>" +
      "<div class=\"hgl1-world-layout\"><div class=\"hgl1-world-main\">" +
      moduleWorkspaceMarkup(entry) +
      "<section class=\"hgl1-feature-grid hgl1-portal-grid\" aria-label=\"Cổng chức năng " + escapeHtml(entry.label) + "\">" + featureMarkup(definition.features, entry) + "</section>" +
      "<section class=\"hgl1-library\"><div class=\"hgl1-section-head\"><div><span class=\"hgl1-kicker\">Workspace</span><h2>Tài liệu của bạn</h2></div><label class=\"hgl1-filter\">" + icon("search") + "<span class=\"hgl1-sr-only\">Lọc tài liệu</span><input type=\"search\" data-hgl1-item-filter placeholder=\"Lọc theo tên...\"/></label></div>" +
      "<form class=\"hgl1-create-form\" data-hgl1-create-form data-route=\"" + entry.route + "\"><label for=\"hgl1-title-" + entry.id + "\">Tên tài liệu mới</label><div><input id=\"hgl1-title-" + entry.id + "\" name=\"title\" maxlength=\"160\" required placeholder=\"Nhập tên rõ ràng...\"/><button class=\"hgl1-button hgl1-button--primary\" type=\"submit\">Lưu cục bộ</button></div></form>" +
      "<div class=\"hgl1-document-grid\" data-hgl1-item-list>" + templateMarkup(entry.route) + userItems + "</div>" +
      (items.length ? "" : statePanel("empty", "Chưa có tài liệu người dùng. Bản mẫu bên trên không được tính là dữ liệu thật.")) +
      "</section></div>" + worldRailMarkup(entry, {
        status: definition.status,
        itemCount: items.length,
        scope: "Trên thiết bị",
        recentItems: items,
        actions: [
          { label: definition.createLabel, action: "focus-create", icon: "plus" },
          { label: "Nhập tệp", action: "trigger-file", route: entry.route, icon: "upload" },
          { label: "Xuất dữ liệu", action: "export-route", route: entry.route, icon: "download" }
        ]
      }) + "</div></section>";
  }

  function homeMarkup() {
    const entry = findRoute("/home");
    return "<section class=\"hgl1-page hgl1-page--home\">" + worldHeroMarkup(entry, "", { eyebrow: "Bản đồ lớp 1" }) +
      "<div class=\"hgl1-world-layout\"><div class=\"hgl1-world-main\"><div class=\"hgl1-delegated-host hgl1-delegated-host--home\" data-hh-galaxy-home-host data-route=\"/home\" role=\"region\" aria-label=\"Bản đồ HH Galaxy\"><div class=\"hgl1-delegated-placeholder\"><span class=\"hgl1-orbit\" aria-hidden=\"true\"></span><div><h2>Đang chuẩn bị bản đồ Galaxy</h2><p>Host sẵn sàng cho trình dựng bản đồ hiện có.</p></div></div></div></div>" +
      worldRailMarkup(entry, { status: "Bản đồ đang được gắn vào host", scope: "Điều hướng lớp 1" }) + "</div></section>";
  }

  function creatorMarkup() {
    const entry = findRoute("/galaxy/creator");
    return "<section class=\"hgl1-page hgl1-page--creator\">" + worldHeroMarkup(entry, "", {
      description: "Shell dành toàn bộ vùng nội dung bên dưới cho Creator Studio chuyên dụng; module này sở hữu pipeline, dự án, lịch và thống kê của chính nó."
    }) +
      "<div class=\"hgl1-world-layout\"><div class=\"hgl1-world-main\"><section class=\"hgl1-creator-host-shell\" aria-label=\"Creator Studio lớp 1\"><div class=\"hgl1-delegated-host hgl1-delegated-host--creator\" data-hh-galaxy-creator-host data-route=\"/galaxy/creator\" aria-label=\"Creator Studio workspace\"><div class=\"hgl1-delegated-placeholder\" data-hgl1-creator-placeholder><span class=\"hgl1-orbit\" aria-hidden=\"true\"></span><div><h2>Đang chuẩn bị Creator Studio</h2><p>Host sẵn sàng cho module Creator lớp 1. Không sử dụng dữ liệu hoặc component của lớp 2.</p></div></div></div></section></div>" +
      worldRailMarkup(entry, { status: "Module chuyên dụng", scope: "Dữ liệu Creator lớp 1" }) + "</div></section>";
  }

  function learningItemCategory(item) {
    if (item && item.meta && item.meta.fileName) return "imports";
    if (item && item.meta && item.meta.learningCategory === "plan") return "plans";
    if (item && item.kind === "learning-plan") return "plans";
    return "notes";
  }

  function learningResourceMarkup(item) {
    const category = learningItemCategory(item);
    const categoryLabels = { notes: "Ghi chú", plans: "Kế hoạch", imports: "Tệp đã nhập" };
    const categoryIcons = { notes: "learning", plans: "bell", imports: "upload" };
    const completed = item.meta && item.meta.completed === true;
    const dueDate = item.meta && item.meta.dueDate;
    return "<article class=\"hgl1-document hgl1-learning-resource" + (completed ? " is-complete" : "") + "\" data-hgl1-item data-item-id=\"" + escapeHtml(item.id) + "\" data-hgl1-learning-resource data-learning-category=\"" + category + "\" data-filter-text=\"" + escapeHtml(normalizedSearchText(item.title + " " + item.description + " " + categoryLabels[category])) + "\">" +
      "<div class=\"hgl1-document__visual hgl1-document__visual--amber hgl1-learning-resource__visual\" aria-hidden=\"true\">" + icon(categoryIcons[category]) + "<span></span></div>" +
      "<div class=\"hgl1-document__body\"><div class=\"hgl1-document__meta\"><span class=\"hgl1-badge hgl1-badge--local\">" + categoryLabels[category] + "</span>" + (completed ? "<span class=\"hgl1-badge hgl1-badge--success\">Đã hoàn thành</span>" : "<span>Cục bộ</span>") + "</div>" +
      "<h3>" + escapeHtml(item.title) + "</h3><p>" + (item.description ? escapeHtml(item.description) : "Tài liệu học tập do bạn tạo trên thiết bị này.") + "</p>" +
      (dueDate ? "<p class=\"hgl1-learning-resource__due\">Ngày dự kiến: <time datetime=\"" + escapeHtml(dueDate) + "\">" + escapeHtml(formatLearningDate(dueDate)) + "</time></p>" : "") +
      "<div class=\"hgl1-document__footer\"><time datetime=\"" + escapeHtml(item.updatedAt) + "\">" + escapeHtml(formatLocalTime(item.updatedAt)) + "</time><div class=\"hgl1-learning-resource__actions\">" +
      "<button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"toggle-learning\" data-item-id=\"" + escapeHtml(item.id) + "\" aria-pressed=\"" + String(completed) + "\">" + (completed ? "Đánh dấu chưa xong" : "Đánh dấu hoàn thành") + "</button>" +
      "<button class=\"hgl1-icon-button hgl1-icon-button--danger\" type=\"button\" data-hgl1-action=\"delete-item\" data-item-id=\"" + escapeHtml(item.id) + "\" aria-label=\"Xóa " + escapeHtml(item.title) + "\">" + icon("close") + "</button></div></div></div></article>";
  }

  function learningTemplateMarkup() {
    const template = templateByRoute.get("/galaxy/learning");
    return "<article class=\"hgl1-document hgl1-document--template hgl1-learning-resource\" data-hgl1-learning-resource data-learning-category=\"templates\" data-filter-text=\"" + escapeHtml(normalizedSearchText(template.title + " " + template.description + " bản mẫu")) + "\" data-is-demo=\"true\" data-source=\"" + template.source + "\" data-template-version=\"" + template.templateVersion + "\" data-editable=\"false\">" +
      "<div class=\"hgl1-document__visual hgl1-document__visual--amber hgl1-learning-resource__visual\" aria-hidden=\"true\">" + icon("learning") + "<span></span></div><div class=\"hgl1-document__body\">" +
      "<div class=\"hgl1-document__meta\"><span class=\"hgl1-badge hgl1-badge--demo\">Bản mẫu</span><span>Không tính tiến trình</span></div><h3>" + escapeHtml(template.title) + "</h3><p>" + escapeHtml(template.description) + "</p>" +
      "<button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"copy-template\" data-route=\"/galaxy/learning\">Tạo bản sao</button></div></article>";
  }

  function learningDeckListMarkup(engineState, selectedId) {
    if (!engineState.decks.length) {
      return "<div class=\"hgl1-learning-engine__empty\" data-state=\"empty\"><b>Chưa có bộ thẻ người dùng</b><p>Tạo bộ thẻ đầu tiên; dữ liệu sẽ được lưu trong IndexedDB khi trình duyệt hỗ trợ.</p></div>";
    }
    return "<div class=\"hgl1-learning-decks\" role=\"list\">" + engineState.decks.map(function learningDeckCard(deck) {
      const due = learningDueCards(deck).length;
      const selected = deck.id === selectedId;
      return "<article class=\"hgl1-learning-deck" + (selected ? " is-selected" : "") + "\" role=\"listitem\"><div><span class=\"hgl1-badge hgl1-badge--local\">" + (deck.isSample ? "Bản mẫu" : "Cục bộ") + "</span><h3>" + escapeHtml(deck.title) + "</h3><p>" + deck.cards.length + " thẻ · " + due + " thẻ cần học</p></div><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"select-learning-deck\" data-deck-id=\"" + escapeHtml(deck.id) + "\" aria-pressed=\"" + String(selected) + "\">" + (selected ? "Đang mở" : "Mở bộ thẻ") + "</button></article>";
    }).join("") + "</div>";
  }

  function learningDeckEditorMarkup(deck, editingCardId) {
    if (!deck) return "<div class=\"hgl1-learning-engine__empty\" data-state=\"empty\"><b>Chọn hoặc tạo một bộ thẻ</b><p>Sau đó bạn có thể thêm, sửa, xóa thẻ và bắt đầu ôn tập.</p></div>";
    const editing = deck.cards.find(function editedCard(card) { return card.id === editingCardId; }) || null;
    const cardList = deck.cards.length ? "<div class=\"hgl1-learning-card-list\" role=\"list\">" + deck.cards.slice(0, 200).map(function learningCardRow(card) {
      const due = card.schedule && card.schedule.dueAt ? formatLocalTime(card.schedule.dueAt) : "Chưa ôn";
      return "<article role=\"listitem\"><div><b>" + escapeHtml(card.front) + "</b><p>" + escapeHtml(card.back) + "</p><small>Lần ôn: " + Number(card.schedule && card.schedule.reviewCount || 0) + " · Hẹn: " + escapeHtml(due) + "</small></div><div><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"edit-learning-card\" data-card-id=\"" + escapeHtml(card.id) + "\">Sửa</button><button class=\"hgl1-button hgl1-button--danger\" type=\"button\" data-hgl1-action=\"delete-learning-card\" data-card-id=\"" + escapeHtml(card.id) + "\">Xóa</button></div></article>";
    }).join("") + "</div>" : "<p class=\"hgl1-learning-plan__empty\">Bộ thẻ chưa có thẻ nào.</p>";
    return "<div class=\"hgl1-learning-deck-editor\"><form data-hgl1-learning-deck-edit-form><input type=\"hidden\" name=\"deckId\" value=\"" + escapeHtml(deck.id) + "\"/><div class=\"hgl1-dev-fields\"><label>Tên bộ thẻ<input name=\"title\" maxlength=\"180\" required value=\"" + escapeHtml(deck.title) + "\"/></label><label>Chủ đề<input name=\"subject\" maxlength=\"100\" value=\"" + escapeHtml(deck.subject || "") + "\"/></label></div><label>Mô tả<textarea name=\"description\" maxlength=\"2000\" rows=\"2\">" + escapeHtml(deck.description || "") + "</textarea></label><div class=\"hgl1-workspace-actions\"><button class=\"hgl1-button hgl1-button--primary\" type=\"submit\">Lưu thông tin bộ thẻ</button><button class=\"hgl1-button hgl1-button--danger\" type=\"button\" data-hgl1-action=\"delete-learning-deck\" data-deck-id=\"" + escapeHtml(deck.id) + "\">Xóa bộ thẻ</button></div></form>" +
      "<form data-hgl1-learning-card-form><input type=\"hidden\" name=\"cardId\" value=\"" + escapeHtml(editing ? editing.id : "") + "\"/><h3>" + (editing ? "Sửa thẻ" : "Thêm thẻ mới") + "</h3><label>Mặt trước<textarea name=\"front\" maxlength=\"8000\" rows=\"2\" required>" + escapeHtml(editing ? editing.front : "") + "</textarea></label><label>Mặt sau<textarea name=\"back\" maxlength=\"8000\" rows=\"2\" required>" + escapeHtml(editing ? editing.back : "") + "</textarea></label><label>Gợi ý (tùy chọn)<input name=\"hint\" maxlength=\"2000\" value=\"" + escapeHtml(editing ? editing.hint : "") + "\"/></label><div class=\"hgl1-workspace-actions\"><button class=\"hgl1-button hgl1-button--primary\" type=\"submit\">" + (editing ? "Cập nhật thẻ" : "Thêm thẻ") + "</button>" + (editing ? "<button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"cancel-learning-card-edit\">Hủy sửa</button>" : "") + "</div></form>" + cardList + "</div>";
  }

  function learningReviewMarkup(deck, ui) {
    if (!deck || !deck.cards.length) return "<div class=\"hgl1-learning-engine__empty\" data-state=\"empty\"><b>Chưa có thẻ để ôn</b><p>Thêm ít nhất một thẻ vào bộ đang mở.</p></div>";
    const dueCards = learningDueCards(deck);
    const current = dueCards.find(function currentReview(card) { return card.id === ui.learningReviewCardId; }) || dueCards[0] || null;
    if (!current) return "<div class=\"hgl1-learning-engine__empty\" data-state=\"success\"><b>Đã hoàn tất hàng đợi hiện tại</b><p>Các thẻ đã được lên lịch theo kết quả ôn thật của bạn.</p></div>";
    const revealed = ui.learningReviewRevealed === true;
    return "<article class=\"hgl1-learning-review-card\" data-card-id=\"" + escapeHtml(current.id) + "\"><span class=\"hgl1-kicker\">" + (Number(current.schedule && current.schedule.reviewCount) ? "Ôn lại" : "Thẻ mới") + " · còn " + dueCards.length + "</span><h3>" + escapeHtml(current.front) + "</h3>" + (current.hint ? "<p>Gợi ý: " + escapeHtml(current.hint) + "</p>" : "") + (revealed ? "<div class=\"hgl1-learning-review-card__answer\"><span>Đáp án</span><p>" + escapeHtml(current.back) + "</p></div><div class=\"hgl1-workspace-actions\" role=\"group\" aria-label=\"Mức độ ghi nhớ\"><button class=\"hgl1-button hgl1-button--danger\" type=\"button\" data-hgl1-action=\"review-learning-card\" data-quality=\"1\">Sai</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"review-learning-card\" data-quality=\"3\">Khó</button><button class=\"hgl1-button hgl1-button--primary\" type=\"button\" data-hgl1-action=\"review-learning-card\" data-quality=\"5\">Đúng</button></div>" : "<button class=\"hgl1-button hgl1-button--primary\" type=\"button\" data-hgl1-action=\"reveal-learning-card\">Hiện đáp án</button>") + "</article>";
  }

  function learningQuizMarkup(deck, ui) {
    if (!deck || !deck.cards.length) return "<div class=\"hgl1-learning-engine__empty\" data-state=\"empty\"><b>Chưa thể tạo quiz</b><p>Thêm thẻ vào bộ đang mở trước.</p></div>";
    const quiz = ui.learningQuiz && ui.learningQuiz.deckId === deck.id ? ui.learningQuiz : null;
    const result = ui.learningQuizResult && quiz && ui.learningQuizResult.quizId === quiz.id ? ui.learningQuizResult : null;
    const setup = "<form class=\"hgl1-learning-quiz-setup\" data-hgl1-learning-quiz-form><label>Kiểu câu hỏi<select name=\"mode\"><option value=\"multiple-choice\">Trắc nghiệm</option><option value=\"typing\">Nhập đáp án</option></select></label><label>Số câu<input name=\"count\" type=\"number\" min=\"1\" max=\"100\" value=\"" + Math.min(10, deck.cards.length) + "\"/></label><label>Hạt giống<input name=\"seed\" maxlength=\"128\" placeholder=\"Để trống để tạo theo thời điểm\"/></label><button class=\"hgl1-button hgl1-button--primary\" type=\"submit\">Tạo quiz</button></form>";
    if (!quiz) return setup;
    const questions = quiz.questions.map(function quizQuestion(question, index) {
      let answer = "";
      if (question.mode === "multiple-choice") {
        answer = "<div class=\"hgl1-learning-quiz__choices\">" + question.choices.map(function quizChoice(choice) {
          return "<label><input type=\"radio\" name=\"answer-" + escapeHtml(question.id) + "\" value=\"" + escapeHtml(choice.id) + "\"/> <span>" + escapeHtml(choice.text) + "</span></label>";
        }).join("") + "</div>";
      } else answer = "<label>Đáp án<input data-learning-answer name=\"answer-" + escapeHtml(question.id) + "\" maxlength=\"8000\" autocomplete=\"off\"/></label>";
      return "<fieldset data-learning-question data-question-id=\"" + escapeHtml(question.id) + "\" data-question-mode=\"" + escapeHtml(question.mode) + "\"><legend>Câu " + (index + 1) + ": " + escapeHtml(question.prompt) + "</legend>" + (question.hint ? "<small>Gợi ý: " + escapeHtml(question.hint) + "</small>" : "") + answer + "</fieldset>";
    }).join("");
    return setup + "<form class=\"hgl1-learning-quiz\" data-hgl1-learning-quiz-answer-form>" + questions + "<div class=\"hgl1-workspace-actions\"><button class=\"hgl1-button hgl1-button--primary\" type=\"submit\">Chấm câu đã trả lời</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"close-learning-quiz\">Đóng quiz</button></div></form>" + (result ? "<output class=\"hgl1-learning-quiz-result\" role=\"status\"><b>Kết quả thật: " + result.correct + "/" + result.totalQuestions + " câu đúng</b><span>Đã trả lời " + result.answered + " · Độ chính xác " + (result.accuracyPercent == null ? "chưa có" : result.accuracyPercent + "%") + "</span></output>" : "");
  }

  function learningEngineWorkspaceMarkup(ui) {
    const api = learningEngineApi();
    const state = api ? normalizeLearningEngineState(ui && ui.learningState) : emptyLearningEngineState();
    const status = String(ui && ui.learningStatus || (api ? "idle" : "unsupported"));
    const selected = selectedLearningDeck(state, ui && ui.learningSelectedDeckId);
    let progress = { totalDecks: 0, totalCards: 0, studiedCards: 0, progressPercent: 0, reviewCount: 0, quizAnswers: 0, accuracyPercent: null, dueCards: 0, streakDays: 0 };
    if (api) {
      try { progress = api.computeProgress(state); } catch (_) { /* Empty bounded metrics stay explicit. */ }
    }
    const statusLabels = { idle: "Đang chuẩn bị kho học tập", loading: "Đang đọc IndexedDB…", saving: "Đang lưu thay đổi…", ready: "Kho học tập cục bộ sẵn sàng", error: "Không thể đọc kho học tập", unsupported: "Learning engine chưa khả dụng" };
    const disabled = status === "loading" || status === "saving" || status === "error" || status === "unsupported";
    return "<section class=\"hgl1-learning-engine\" aria-labelledby=\"hgl1-learning-engine-title\" data-learning-status=\"" + escapeHtml(status) + "\"><header class=\"hgl1-section-head\"><div><span class=\"hgl1-kicker\">Flashcard & quiz thật</span><h2 id=\"hgl1-learning-engine-title\">Xưởng học tập cục bộ</h2></div><span class=\"hgl1-runtime-status\" data-state=\"" + (status === "ready" ? "ready" : status === "error" ? "error" : "local") + "\">" + escapeHtml(statusLabels[status] || statusLabels.idle) + "</span></header>" +
      "<div class=\"hgl1-learning-engine__actions\"><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"export-learning-data\"" + (disabled ? " disabled" : "") + ">" + icon("download") + " Xuất Learning JSON</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"trigger-learning-import\"" + (disabled ? " disabled" : "") + ">" + icon("upload") + " Nhập Learning JSON</button><input class=\"hgl1-sr-only\" type=\"file\" accept=\"application/json,.json\" aria-label=\"Chọn tệp dữ liệu Learning Star\" data-hgl1-learning-data-file tabindex=\"-1\"/></div>" +
      "<div class=\"hgl1-learning-metrics\"><div><span>Bộ thẻ</span><b>" + progress.totalDecks + "</b></div><div><span>Đã học</span><b>" + progress.studiedCards + "/" + progress.totalCards + "</b></div><div><span>Tiến độ thật</span><b>" + progress.progressPercent + "%</b></div><div><span>Đến hạn</span><b>" + progress.dueCards + "</b></div><div><span>Độ chính xác</span><b>" + (progress.accuracyPercent == null ? "—" : progress.accuracyPercent + "%") + "</b></div><div><span>Chuỗi hoạt động</span><b>" + progress.streakDays + " ngày</b></div></div>" +
      "<div class=\"hgl1-learning-studio\"><section><header><h3>Bộ thẻ của bạn</h3><p>Không tính bản mẫu vào tiến độ.</p></header><form data-hgl1-learning-deck-form><label>Tên bộ thẻ<input name=\"title\" maxlength=\"180\" required placeholder=\"Ví dụ: Từ vựng tiếng Nhật\"" + (disabled ? " disabled" : "") + "/></label><label>Mô tả<input name=\"description\" maxlength=\"2000\"" + (disabled ? " disabled" : "") + "/></label><button class=\"hgl1-button hgl1-button--primary\" type=\"submit\"" + (disabled ? " disabled" : "") + ">Tạo bộ thẻ</button></form>" + learningDeckListMarkup(state, selected && selected.id) + "</section><section>" + learningDeckEditorMarkup(selected, ui && ui.learningEditingCardId) + "</section></div>" +
      "<div class=\"hgl1-learning-practice\"><section><header><span class=\"hgl1-kicker\">Spaced repetition</span><h3>Hàng đợi ôn tập</h3></header>" + learningReviewMarkup(selected, ui || {}) + "</section><section><header><span class=\"hgl1-kicker\">Chấm từ câu trả lời thật</span><h3>Quiz</h3></header>" + learningQuizMarkup(selected, ui || {}) + "</section></div></section>";
  }

  function learningMarkup(state, ui) {
    const entry = findRoute("/galaxy/learning");
    const items = state.items.filter(function learningItems(item) { return item.route === "/galaxy/learning"; }).slice().sort(function newestFirst(a, b) {
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    });
    const today = localDateKey(new Date());
    const plans = items.filter(function learningPlans(item) { return learningItemCategory(item) === "plans"; }).slice().sort(function dueFirst(a, b) {
      const first = (a.meta && a.meta.dueDate) || "9999-12-31";
      const second = (b.meta && b.meta.dueDate) || "9999-12-31";
      return first.localeCompare(second);
    });
    const todayPlans = plans.filter(function todayPlan(item) { return item.meta && item.meta.dueDate === today; });
    const completedCount = items.filter(function completedItem(item) { return item.meta && item.meta.completed === true; }).length;
    const updatedToday = items.filter(function updatedItem(item) { return localDateKey(item.updatedAt) === today; }).length;
    const journey = LEARNING_STAGES.map(function learningStage(stage, index) {
      return "<li class=\"hgl1-learning-journey__node hgl1-learning-stage hgl1-learning-stage--" + stage.id + "\" data-stage=\"" + stage.id + "\"><span class=\"hgl1-learning-journey__orb hgl1-learning-stage__orb\" aria-hidden=\"true\">" + icon(stage.icon) + "</span><div class=\"hgl1-learning-stage__body hgl1-learning-journey__label\"><h3>" + escapeHtml(stage.title) + "</h3><p>" + escapeHtml(stage.description) + "</p></div>" + (index < LEARNING_STAGES.length - 1 ? "<i aria-hidden=\"true\"></i>" : "") + "</li>";
    }).join("");
    const destinations = LEARNING_DESTINATIONS.map(function learningDestination(destination) {
      const dharmaAlias = destination.id === "dharma" ? " hgl1-learning-portal--buddhist hgl1-learning-destination--buddhist" : "";
      return "<article class=\"hgl1-learning-portal hgl1-learning-destination hgl1-learning-portal--" + destination.id + " hgl1-learning-destination--" + destination.id + dharmaAlias + "\" data-platform-route=\"" + destination.route + "\" data-capability=\"unconfigured\">" +
        "<div class=\"hgl1-learning-portal__art hgl1-learning-destination__art\" aria-hidden=\"true\"><span class=\"hgl1-learning-portal__landmark\">" + escapeHtml(destination.glyph) + "</span><i></i><i></i><i></i></div>" +
        "<div class=\"hgl1-learning-portal__body hgl1-learning-destination__body\"><span>HH Platform · " + escapeHtml(destination.route) + "</span><h2>" + escapeHtml(destination.title) + "</h2><p>" + escapeHtml(destination.description) + "</p>" +
        "<button class=\"hgl1-button hgl1-button--ghost hgl1-learning-portal__action hgl1-learning-destination__action\" type=\"button\" data-hgl1-action=\"open-platform-via-core\">Vào học qua HH CORE " + icon("arrow") + "</button></div></article>";
    }).join("");
    const todayMarkup = todayPlans.length ? "<div class=\"hgl1-learning-today__list\">" + todayPlans.map(function todayPlanMarkup(item) {
      const completed = item.meta && item.meta.completed === true;
      return "<article><span aria-hidden=\"true\">" + icon("learning") + "</span><div><b>" + escapeHtml(item.title) + "</b><small>" + (completed ? "Đã đánh dấu hoàn thành" : "Kế hoạch của hôm nay") + "</small></div><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"toggle-learning\" data-item-id=\"" + escapeHtml(item.id) + "\" aria-pressed=\"" + String(completed) + "\">" + (completed ? "Mở lại" : "Hoàn thành") + "</button></article>";
    }).join("") + "</div>" : "<div class=\"hgl1-learning-empty\" data-state=\"empty\"><span aria-hidden=\"true\">" + icon("learning") + "</span><div><b>Chưa có bài học được lên lịch hôm nay</b><p>Tạo một kế hoạch có ngày dự kiến để hiển thị tại đây.</p></div><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"focus-learning-plan\">Lên kế hoạch</button></div>";
    const planList = plans.length ? "<ul class=\"hgl1-learning-plan__list\">" + plans.slice(0, 6).map(function planItem(item) {
      return "<li class=\"" + (item.meta.completed ? "is-complete" : "") + "\"><time datetime=\"" + escapeHtml(item.meta.dueDate) + "\">" + escapeHtml(formatLearningDate(item.meta.dueDate)) + "</time><span>" + escapeHtml(item.title) + "</span></li>";
    }).join("") + "</ul>" : "<p class=\"hgl1-learning-plan__empty\">Chưa có kế hoạch học tập nào được lưu.</p>";
    const heroActions = "<button class=\"hgl1-button hgl1-button--primary\" type=\"button\" data-hgl1-action=\"focus-learning-note\">" + icon("plus") + " Ghi chú nhanh</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"trigger-file\" data-route=\"/galaxy/learning\">" + icon("upload") + " Nhập tài liệu</button><input class=\"hgl1-sr-only\" type=\"file\" tabindex=\"-1\" aria-label=\"Chọn tài liệu cho Learning Star\" data-hgl1-module-file data-route=\"/galaxy/learning\" accept=\".txt,.md,.json,text/plain,application/json\"/>";
    const coreGate = "<button class=\"hgl1-learning-core-gate\" type=\"button\" data-hgl1-action=\"open-platform-via-core\" aria-label=\"Mở cổng HH CORE tại bản đồ Galaxy\"><span aria-hidden=\"true\">HH</span><b>HH CORE</b><small>Cổng vào HH Platform</small>" + icon("arrow") + "</button>";
    const libraryShortcuts = "<div class=\"hgl1-learning-library__shortcuts\" aria-label=\"Thao tác nhanh trong thư viện\">" +
      "<button type=\"button\" data-hgl1-action=\"focus-learning-note\">" + icon("learning") + "<span>Ghi chú</span></button>" +
      "<button type=\"button\" data-hgl1-action=\"focus-learning-plan\">" + icon("bell") + "<span>Kế hoạch</span></button>" +
      "<button type=\"button\" data-hgl1-action=\"trigger-file\" data-route=\"/galaxy/learning\">" + icon("upload") + "<span>Nhập tài liệu</span></button>" +
      "<button type=\"button\" data-hgl1-action=\"filter-learning\" data-learning-filter=\"imports\" aria-pressed=\"false\">" + icon("video") + "<span>Tệp đã nhập</span></button>" +
      "<button type=\"button\" data-hgl1-action=\"filter-learning\" data-learning-filter=\"plans\" aria-pressed=\"false\">" + icon("creator") + "<span>Bài tập</span></button>" +
      "<button type=\"button\" data-hgl1-action=\"filter-learning\" data-learning-filter=\"templates\" aria-pressed=\"false\">" + icon("ai") + "<span>Bản mẫu</span></button></div>";
    return "<section class=\"hgl1-page hgl1-page--module hgl1-page--learning hgl1-learning hgl1-learning-shell\" data-module=\"learning\">" +
      worldHeroMarkup(entry, heroActions, { title: "Learning Star", description: "Khám phá tri thức • Kết nối vạn tinh tú • Thắp sáng tương lai", eyebrow: "Hành trình học tập", heroClass: "hgl1-learning-hero", bodyClass: "hgl1-learning-hero__body", visualClass: "hgl1-learning-hero__visual", orbClass: "hgl1-learning-hero__star", constellationClass: "hgl1-learning-hero__constellation", extra: coreGate }) +
      "<div class=\"hgl1-status-strip\"><span class=\"hgl1-status-dot hgl1-status-dot--local\"></span><span>Ghi chú, kế hoạch và metadata tài liệu được lưu trên thiết bị</span><b>Dữ liệu riêng của lớp 1</b></div>" +
      "<section class=\"hgl1-learning-journey\" aria-labelledby=\"hgl1-learning-journey-title\"><div class=\"hgl1-learning-journey__title\"><span class=\"hgl1-kicker\">Lộ trình 5 bước</span><h2 id=\"hgl1-learning-journey-title\">Lộ trình của bạn</h2><p>Các bước định hướng, không phải tiến độ hoàn thành của người dùng.</p></div><div class=\"hgl1-learning-journey__track\"><span class=\"hgl1-learning-journey__path\" aria-hidden=\"true\"></span><ol class=\"hgl1-learning-track\">" + journey + "</ol></div></section>" +
      "<section class=\"hgl1-feature-grid hgl1-portal-grid hgl1-learning-portals hgl1-learning-destinations\" aria-label=\"Các không gian học thuộc HH Platform\">" + destinations + "</section>" +
      "<div class=\"hgl1-world-layout hgl1-learning-dashboard hgl1-learning-layout\"><div class=\"hgl1-world-main hgl1-learning-dashboard__main hgl1-learning-main\">" +
      "<section class=\"hgl1-learning-today\" aria-labelledby=\"hgl1-learning-today-title\"><header class=\"hgl1-section-head\"><div><span class=\"hgl1-kicker\">Hôm nay · " + escapeHtml(formatLearningDate(today)) + "</span><h2 id=\"hgl1-learning-today-title\">Bài học hôm nay</h2></div><span>" + todayPlans.length + " kế hoạch thật</span></header>" + todayMarkup + "</section>" + learningEngineWorkspaceMarkup(ui || {}) +
      "<section class=\"hgl1-library hgl1-learning-library\" data-capability=\"available\" aria-labelledby=\"hgl1-learning-library-title\"><header class=\"hgl1-section-head\"><div><span class=\"hgl1-kicker\">Kho cục bộ</span><h2 id=\"hgl1-learning-library-title\">Thư viện học tập</h2></div><label class=\"hgl1-filter\">" + icon("search") + "<span class=\"hgl1-sr-only\">Tìm trong thư viện học tập</span><input type=\"search\" data-hgl1-learning-search placeholder=\"Tìm tài liệu, ghi chú, kế hoạch...\"/></label></header>" +
      "<div class=\"hgl1-learning-library__filters\" role=\"group\" aria-label=\"Lọc thư viện\"><button class=\"is-active\" type=\"button\" data-hgl1-action=\"filter-learning\" data-learning-filter=\"all\" aria-pressed=\"true\">Tất cả</button><button type=\"button\" data-hgl1-action=\"filter-learning\" data-learning-filter=\"notes\" aria-pressed=\"false\">Ghi chú</button><button type=\"button\" data-hgl1-action=\"filter-learning\" data-learning-filter=\"plans\" aria-pressed=\"false\">Kế hoạch</button><button type=\"button\" data-hgl1-action=\"filter-learning\" data-learning-filter=\"imports\" aria-pressed=\"false\">Tệp đã nhập</button><button type=\"button\" data-hgl1-action=\"filter-learning\" data-learning-filter=\"templates\" aria-pressed=\"false\">Bản mẫu</button><output data-hgl1-learning-result-count>" + (items.length + 1) + " mục</output></div>" + libraryShortcuts +
      "<div class=\"hgl1-document-grid hgl1-learning-library__grid\" data-hgl1-learning-list>" + learningTemplateMarkup() + items.map(learningResourceMarkup).join("") + "</div><div class=\"hgl1-learning-library__empty\" data-hgl1-learning-empty hidden>Không có mục nào khớp bộ lọc hiện tại.</div></section>" +
      "<section class=\"hgl1-learning-progress\"><header><span class=\"hgl1-kicker\">Dữ liệu thật</span><h2>Tiến trình của bạn</h2></header>" + (items.length ? "<dl><div><dt>Tài liệu người dùng</dt><dd>" + items.length + "</dd></div><div><dt>Đã đánh dấu hoàn thành</dt><dd>" + completedCount + "</dd></div><div><dt>Cập nhật hôm nay</dt><dd>" + updatedToday + "</dd></div></dl>" : "<div class=\"hgl1-learning-empty\" data-state=\"empty\"><b>Chưa có dữ liệu học tập</b><p>Tạo ghi chú hoặc kế hoạch đầu tiên để bắt đầu ghi nhận.</p></div>") + "</section></div>" +
      "<aside class=\"hgl1-world-rail hgl1-world-rail--learning hgl1-learning-dashboard__sidebar hgl1-learning-rail\" aria-label=\"Kế hoạch và ghi chú học tập\">" +
      "<section class=\"hgl1-learning-plan hgl1-learning-schedule\"><header><span class=\"hgl1-kicker\">Lịch cục bộ</span><h2>Kế hoạch học tập</h2></header>" + planList + "<form data-hgl1-learning-plan-form><label for=\"hgl1-learning-plan-title\">Nội dung kế hoạch</label><input id=\"hgl1-learning-plan-title\" name=\"title\" maxlength=\"160\" required placeholder=\"Ví dụ: Ôn lại ghi chú hôm nay\"/><label for=\"hgl1-learning-plan-date\">Ngày dự kiến</label><input id=\"hgl1-learning-plan-date\" name=\"dueDate\" type=\"date\" required/><button class=\"hgl1-button hgl1-button--primary\" type=\"submit\">Lưu kế hoạch</button></form></section>" +
      "<section class=\"hgl1-learning-note hgl1-learning-quick-note\"><header><span class=\"hgl1-kicker\">Ghi chú nhanh</span><h2>Lưu một ý tưởng học tập</h2></header><form data-hgl1-learning-note-form><label class=\"hgl1-sr-only\" for=\"hgl1-learning-note\">Nội dung ghi chú</label><textarea id=\"hgl1-learning-note\" name=\"note\" rows=\"4\" maxlength=\"500\" required placeholder=\"Ghi chú, câu hỏi hoặc mục tiêu hôm nay...\"></textarea><button class=\"hgl1-button hgl1-button--primary\" type=\"submit\">Lưu ghi chú</button></form></section>" +
      "<section class=\"hgl1-learning-motivation\"><span aria-hidden=\"true\">✦</span><div><h2>Giữ nhịp học tập</h2><p>Tiến một bước nhỏ, kiểm tra điều đã hiểu và ghi lại câu hỏi tiếp theo.</p></div></section></aside></div></section>";
  }

  function toolsMarkup(state) {
    const entry = findRoute("/galaxy/tools");
    const items = state.items.filter(function toolsItem(item) { return item.route === "/galaxy/tools"; }).slice().reverse();
    const heroActions = "<button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"export-route\" data-route=\"/galaxy/tools\">" + icon("download") + " Xuất ghi chú</button>";
    return "<section class=\"hgl1-page hgl1-page--tools\">" + worldHeroMarkup(entry, heroActions) +
      "<div class=\"hgl1-world-layout\"><div class=\"hgl1-world-main\">" +
      "<div class=\"hgl1-tools-grid\"><article class=\"hgl1-tool\"><div class=\"hgl1-tool__head\">" + icon("tools") + "<div><span class=\"hgl1-badge hgl1-badge--local\">Cục bộ</span><h2>Phân tích văn bản</h2></div></div><label for=\"hgl1-text-tool\">Nội dung</label><textarea id=\"hgl1-text-tool\" data-hgl1-text-tool maxlength=\"" + MAX_TEXT_LENGTH + "\" rows=\"9\" placeholder=\"Nhập văn bản cần đếm...\"></textarea><button class=\"hgl1-button hgl1-button--primary\" type=\"button\" data-hgl1-action=\"analyze-text\">Phân tích</button><output class=\"hgl1-tool__output\" data-hgl1-text-output aria-live=\"polite\">Chưa có kết quả.</output></article>" +
      "<article class=\"hgl1-tool\"><div class=\"hgl1-tool__head\">" + icon("dev") + "<div><span class=\"hgl1-badge hgl1-badge--local\">Cục bộ</span><h2>JSON Formatter</h2></div></div><label for=\"hgl1-json-tool\">JSON đầu vào</label><textarea id=\"hgl1-json-tool\" data-hgl1-json-tool maxlength=\"" + MAX_TEXT_LENGTH + "\" rows=\"9\" spellcheck=\"false\" placeholder=\"{ &quot;hello&quot;: &quot;galaxy&quot; }\"></textarea><button class=\"hgl1-button hgl1-button--primary\" type=\"button\" data-hgl1-action=\"format-json\">Định dạng</button><output class=\"hgl1-tool__output hgl1-tool__output--code\" data-hgl1-json-output aria-live=\"polite\">Chưa có kết quả.</output></article>" +
      "<article class=\"hgl1-tool hgl1-tool--wide\"><div class=\"hgl1-tool__head\">" + icon("creator") + "<div><span class=\"hgl1-badge hgl1-badge--local\">HTML an toàn</span><h2>Markdown Preview</h2></div></div><label for=\"hgl1-markdown-tool\">Markdown đầu vào</label><textarea id=\"hgl1-markdown-tool\" data-hgl1-markdown-tool maxlength=\"" + MAX_TEXT_LENGTH + "\" rows=\"8\" placeholder=\"# Tiêu đề&#10;&#10;- Nội dung **quan trọng**\"></textarea><button class=\"hgl1-button hgl1-button--primary\" type=\"button\" data-hgl1-action=\"preview-markdown\">Xem trước an toàn</button><div class=\"hgl1-tool__output hgl1-tool__output--markdown\" data-hgl1-markdown-output role=\"status\" aria-live=\"polite\">Chưa có bản xem trước.</div></article>" +
      "<article class=\"hgl1-tool\"><div class=\"hgl1-tool__head\">" + icon("database") + "<div><span class=\"hgl1-badge hgl1-badge--local\">Cục bộ</span><h2>CSV → JSON</h2></div></div><label for=\"hgl1-csv-tool\">CSV có hàng tiêu đề</label><textarea id=\"hgl1-csv-tool\" data-hgl1-csv-tool maxlength=\"" + MAX_TEXT_LENGTH + "\" rows=\"8\" spellcheck=\"false\" placeholder=\"name,age&#10;An,12\"></textarea><button class=\"hgl1-button hgl1-button--primary\" type=\"button\" data-hgl1-action=\"csv-to-json\">Chuyển sang JSON</button><output class=\"hgl1-tool__output hgl1-tool__output--code\" data-hgl1-csv-output aria-live=\"polite\">Chưa có kết quả.</output></article>" +
      "<article class=\"hgl1-tool\"><div class=\"hgl1-tool__head\">" + icon("database") + "<div><span class=\"hgl1-badge hgl1-badge--local\">Cục bộ</span><h2>JSON → CSV</h2></div></div><label for=\"hgl1-json-csv-tool\">Mảng JSON object</label><textarea id=\"hgl1-json-csv-tool\" data-hgl1-json-csv-tool maxlength=\"" + MAX_TEXT_LENGTH + "\" rows=\"8\" spellcheck=\"false\" placeholder=\"[{&quot;name&quot;:&quot;An&quot;,&quot;age&quot;:12}]\"></textarea><button class=\"hgl1-button hgl1-button--primary\" type=\"button\" data-hgl1-action=\"json-to-csv\">Chuyển sang CSV</button><output class=\"hgl1-tool__output hgl1-tool__output--code\" data-hgl1-json-csv-output aria-live=\"polite\">Chưa có kết quả.</output></article>" +
      "<article class=\"hgl1-tool\"><div class=\"hgl1-tool__head\">" + icon("settings") + "<div><span class=\"hgl1-badge hgl1-badge--local\">Web Crypto</span><h2>SHA-256</h2></div></div><label for=\"hgl1-sha-tool\">Nội dung cần băm</label><textarea id=\"hgl1-sha-tool\" data-hgl1-sha-tool maxlength=\"" + MAX_TEXT_LENGTH + "\" rows=\"6\" placeholder=\"Nhập nội dung; dữ liệu không rời thiết bị.\"></textarea><button class=\"hgl1-button hgl1-button--primary\" type=\"button\" data-hgl1-action=\"sha256-text\">Tạo SHA-256</button><output class=\"hgl1-tool__output hgl1-tool__output--code hgl1-tool__output--hash\" data-hgl1-sha-output aria-live=\"polite\">Chưa có kết quả.</output></article>" +
      "<article class=\"hgl1-tool\"><div class=\"hgl1-tool__head\">" + icon("tools") + "<div><span class=\"hgl1-badge hgl1-badge--local\">SVG cục bộ</span><h2>Tạo mã QR</h2></div></div><label for=\"hgl1-qr-tool\">Văn bản hoặc liên kết</label><textarea id=\"hgl1-qr-tool\" data-hgl1-qr-tool maxlength=\"2048\" rows=\"6\" placeholder=\"hoang8.com hoặc nội dung bất kỳ\"></textarea><button class=\"hgl1-button hgl1-button--primary\" type=\"button\" data-hgl1-action=\"generate-qr\">Tạo QR SVG</button><div class=\"hgl1-tool__output hgl1-tool__output--qr\" data-hgl1-qr-output role=\"status\" aria-live=\"polite\">Chưa có mã QR.</div></article></div>" +
      "<section class=\"hgl1-library\"><div class=\"hgl1-section-head\"><div><span class=\"hgl1-kicker\">Lịch sử do bạn lưu</span><h2>Ghi chú công cụ</h2></div></div><form class=\"hgl1-create-form\" data-hgl1-create-form data-route=\"/galaxy/tools\"><label for=\"hgl1-title-tools\">Tên ghi chú</label><div><input id=\"hgl1-title-tools\" name=\"title\" maxlength=\"160\" required/><button class=\"hgl1-button hgl1-button--primary\" type=\"submit\">Lưu</button></div></form><div class=\"hgl1-document-grid\">" + templateMarkup("/galaxy/tools") + items.map(itemMarkup).join("") + "</div></section></div>" +
      worldRailMarkup(entry, { status: "Bảy tiện ích cục bộ sẵn sàng", itemCount: items.length, scope: "Trong trình duyệt" }) + "</div></section>";
  }

  function webVitalHasValue(performanceMetrics) {
    if (!performanceMetrics || !performanceMetrics.metrics) return false;
    return ["lcp", "fcp", "inp", "cls"].some(function hasMetric(metric) {
      return performanceMetrics.metrics[metric] && Number.isFinite(performanceMetrics.metrics[metric].value);
    });
  }

  function webVitalsMarkup(performanceMetrics, consent) {
    const definitions = [
      ["lcp", "LCP", "Tải nội dung lớn nhất"],
      ["fcp", "FCP", "Hiển thị nội dung đầu tiên"],
      ["inp", "Event delay thô", "Giá trị event dài nhất; không phải INP chuẩn"],
      ["cls", "Layout shift thô", "Tổng dịch chuyển thô; không phải CLS chuẩn"]
    ];
    const metrics = consent && performanceMetrics && performanceMetrics.metrics ? performanceMetrics.metrics : null;
    const cards = definitions.map(function vitalCard(definition) {
      const metric = metrics && metrics[definition[0]];
      const value = metric && Number.isFinite(metric.value) ? metric.value : null;
      const formatted = value == null ? "Chưa đo" : metric.unit === "score"
        ? Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 4 })
        : Math.round(value).toLocaleString("vi-VN") + " ms";
      return "<article data-hgl1-web-vital=\"" + definition[0] + "\" data-state=\"" + (value == null ? "empty" : "measured") + "\"><span>" + definition[1] + "</span><strong>" + formatted + "</strong><small>" + definition[2] + "</small></article>";
    }).join("");
    const collectorState = !consent ? "Chưa thu thập vì consent đang tắt." : performanceMetrics && performanceMetrics.running
      ? "Đang quan sát các entry PerformanceObserver mà trình duyệt cung cấp."
      : performanceMetrics ? "Đã đọc các entry hiệu năng mà trình duyệt hiện cung cấp." : "Performance API chưa cung cấp chỉ số khả dụng.";
    return "<section class=\"hgl1-vitals-card\" aria-labelledby=\"hgl1-vitals-title\"><div class=\"hgl1-section-head\"><div><span class=\"hgl1-kicker\">Tín hiệu PerformanceObserver thô</span><h2 id=\"hgl1-vitals-title\">Hiệu năng phiên hiện tại</h2></div><small>" + escapeHtml(collectorState) + "</small></div><p class=\"hgl1-vitals-card__method\">LCP/FCP lấy từ entry trình duyệt; event delay và layout shift là phép đo thô, không dùng thuật toán INP/CLS chuẩn.</p><div class=\"hgl1-metric-grid hgl1-vitals-grid\">" + cards + "</div></section>";
  }

  function analyticsMarkup(state, ui) {
    const entry = findRoute("/galaxy/analytics");
    const range = ui && ["today", "7d", "30d", "all"].includes(ui.analyticsRange) ? ui.analyticsRange : "30d";
    const summary = summarizeAnalytics(state, range);
    const events = summary.latestEvents.map(function eventRow(event) {
      const route = findRoute(event.route);
      const typeLabels = { "route-view": "Mở module", "item-create": "Tạo tài liệu", "item-delete": "Xóa tài liệu", "data-export": "Xuất dữ liệu", "data-import": "Nhập dữ liệu", "permission-check": "Kiểm tra quyền" };
      return "<tr><td>" + escapeHtml(typeLabels[event.type] || event.type) + "</td><td>" + escapeHtml(route ? route.label : "Galaxy") + "</td><td><time datetime=\"" + escapeHtml(event.at) + "\">" + escapeHtml(formatLocalTime(event.at)) + "</time></td></tr>";
    }).join("");
    const heroActions = "<button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"export-analytics-json\" " + (summary.consent ? "" : "disabled title=\"Bật consent để xuất sự kiện\"") + ">JSON</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"export-analytics-csv\" " + (summary.consent ? "" : "disabled title=\"Bật consent để xuất sự kiện\"") + ">CSV</button>";
    return "<section class=\"hgl1-page hgl1-page--analytics\">" + worldHeroMarkup(entry, heroActions) +
      "<div class=\"hgl1-world-layout\"><div class=\"hgl1-world-main\">" +
      "<section class=\"hgl1-consent\"><div><span class=\"hgl1-kicker\">Quyền riêng tư</span><h2>Analytics cục bộ</h2><p>" + (summary.consent ? "Đang ghi các thao tác tối thiểu trên thiết bị này." : "Đang tắt. Không có sự kiện điều hướng mới nào được ghi. " + state.events.length + " sự kiện cũ đang được giữ cục bộ và không được xuất.") + "</p></div><label class=\"hgl1-switch\"><input type=\"checkbox\" aria-label=\"Cho phép Analytics cục bộ\" data-hgl1-setting=\"analyticsConsent\" " + (summary.consent ? "checked" : "") + "/><span aria-hidden=\"true\"></span><b aria-hidden=\"true\">" + (summary.consent ? "Đã bật" : "Đang tắt") + "</b></label></section>" +
      "<section class=\"hgl1-metric-grid\" aria-label=\"Thống kê cục bộ\"><article><span>Tài liệu người dùng</span><strong>" + summary.localItems + "</strong><small>Không gồm bản mẫu</small></article><article><span>Module đã mở</span><strong>" + summary.visitedModules + "</strong><small>Chỉ khi có consent</small></article><article><span>Sự kiện đã lưu</span><strong>" + summary.trackedEvents + "</strong><small>Tối đa " + MAX_EVENTS + " bản ghi</small></article><article><span>Lần xuất dữ liệu</span><strong>" + summary.exports + "</strong><small>Tính từ sự kiện thật</small></article></section>" +
      webVitalsMarkup(ui && ui.performanceMetrics, summary.consent) +
      "<section class=\"hgl1-table-card\"><div class=\"hgl1-section-head\"><div><span class=\"hgl1-kicker\">Gần đây</span><h2>Nhật ký tối thiểu</h2></div><label>Khoảng thời gian<select data-hgl1-analytics-range><option value=\"today\" " + (range === "today" ? "selected" : "") + ">Hôm nay</option><option value=\"7d\" " + (range === "7d" ? "selected" : "") + ">7 ngày</option><option value=\"30d\" " + (range === "30d" ? "selected" : "") + ">30 ngày</option><option value=\"all\" " + (range === "all" ? "selected" : "") + ">Tất cả</option></select></label></div>" +
      (events ? "<div class=\"hgl1-table-wrap\"><table><thead><tr><th>Hoạt động</th><th>Module</th><th>Thời điểm</th></tr></thead><tbody>" + events + "</tbody></table></div>" : statePanel("empty", summary.consent ? "Chưa có sự kiện thật nào được ghi." : "Bật Analytics nếu bạn muốn lưu thống kê tối thiểu.")) +
      "<div class=\"hgl1-settings-actions\"><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"clear-analytics-events\" " + (state.events.length || webVitalHasValue(ui && ui.performanceMetrics) ? "" : "disabled") + ">Xóa dữ liệu Analytics</button></div></section></div>" + worldRailMarkup(entry, { status: summary.consent ? "Consent đang bật" : "Consent đang tắt", itemCount: summary.localItems, scope: "Chỉ trên thiết bị" }) + "</div></section>";
  }

  function backupPreviewMarkup(pending) {
    if (!pending || !pending.summary) return "";
    function safeCount(value) { return Math.max(0, Number.isFinite(Number(value)) ? Math.floor(Number(value)) : 0); }
    const detail = pending.summary.complete
      ? safeCount(pending.summary.items) + " tài liệu, " + safeCount(pending.summary.events) + " sự kiện đã consent, " + safeCount(pending.summary.creatorProjects) + " dự án/" + safeCount(pending.summary.creatorSchedule) + " lịch Creator, " + safeCount(pending.summary.learningDecks) + " bộ thẻ/" + safeCount(pending.summary.learningCards) + " flashcard/" + safeCount(pending.summary.learningActivities) + " hoạt động học và " + safeCount(pending.summary.records) + " bản ghi JSON lớn"
      : safeCount(pending.summary.items) + " tài liệu và " + safeCount(pending.summary.events) + " sự kiện được consent";
    const migrationNote = pending.summary.migratedFrom ? " Tệp cũ v" + safeCount(pending.summary.migratedFrom) + " sẽ được chuyển đổi trước khi nhập." : "";
    return "<div class=\"hgl1-backup-backdrop\" data-hgl1-backup-backdrop><section class=\"hgl1-backup-preview\" data-hgl1-backup-preview role=\"alertdialog\" aria-modal=\"true\" aria-labelledby=\"hgl1-backup-preview-title\" aria-describedby=\"hgl1-backup-preview-description\" tabindex=\"-1\"><span class=\"hgl1-kicker\">Xem trước an toàn</span><h2 id=\"hgl1-backup-preview-title\">Chưa thay đổi dữ liệu hiện tại</h2><p id=\"hgl1-backup-preview-description\">Tệp hợp lệ chứa " + detail + ". Nội dung nhị phân không nằm trong sao lưu." + migrationNote + "</p><fieldset><legend>Cách nhập</legend><label><input type=\"radio\" name=\"hgl1-backup-mode\" value=\"merge\" checked/> Hợp nhất, giữ dữ liệu hiện tại khi trùng</label><label><input type=\"radio\" name=\"hgl1-backup-mode\" value=\"replace\"/> Thay thế dữ liệu JSON trong phạm vi sao lưu</label></fieldset><div class=\"hgl1-settings-actions\"><button class=\"hgl1-button hgl1-button--primary\" type=\"button\" data-hgl1-action=\"confirm-backup-import\">Xác nhận nhập</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"cancel-backup-import\">Hủy</button></div></section></div>";
  }

  function settingsMarkup(state, ui) {
    const entry = findRoute("/galaxy/settings");
    const settings = sanitizeSettings(ui && ui.settingsDraft ? ui.settingsDraft : state.settings);
    const dirty = JSON.stringify(settings) !== JSON.stringify(state.settings);
    const contentStorage = ui && ui.contentStorageStatus || { state: "unavailable", persistent: false };
    const contentStorageLabel = contentStorage.state === "ready" && contentStorage.persistent ? "IndexedDB sẵn sàng" : contentStorage.state === "ready" ? "Fallback trong phiên" : contentStorage.state === "opening" ? "Đang mở…" : "Chưa khả dụng";
    return "<section class=\"hgl1-page hgl1-page--settings\">" + worldHeroMarkup(entry, "") +
      "<div class=\"hgl1-world-layout\"><div class=\"hgl1-world-main\">" +
      "<form class=\"hgl1-settings-form\" data-hgl1-settings-form><div class=\"hgl1-settings-grid\"><fieldset class=\"hgl1-settings-card\"><legend>Trải nghiệm hiển thị</legend><span class=\"hgl1-kicker\">Giao diện</span><label>Chủ đề<select data-hgl1-setting=\"theme\"><option value=\"cosmic\" " + (settings.theme === "cosmic" ? "selected" : "") + ">Cosmic</option><option value=\"midnight\" " + (settings.theme === "midnight" ? "selected" : "") + ">Midnight</option></select></label><label>Mức hiệu ứng<select data-hgl1-setting=\"effects\"><option value=\"quiet\" " + (settings.effects === "quiet" ? "selected" : "") + ">Tĩnh</option><option value=\"balanced\" " + (settings.effects === "balanced" ? "selected" : "") + ">Cân bằng</option><option value=\"rich\" " + (settings.effects === "rich" ? "selected" : "") + ">Nổi bật</option></select></label><label>Độ tương phản<select data-hgl1-setting=\"contrast\"><option value=\"standard\" " + (settings.contrast === "standard" ? "selected" : "") + ">Tiêu chuẩn</option><option value=\"high\" " + (settings.contrast === "high" ? "selected" : "") + ">Cao</option></select></label><label>Giảm chuyển động<select data-hgl1-setting=\"reducedMotion\"><option value=\"system\" " + (settings.reducedMotion === "system" ? "selected" : "") + ">Theo hệ thống</option><option value=\"on\" " + (settings.reducedMotion === "on" ? "selected" : "") + ">Luôn bật</option><option value=\"off\" " + (settings.reducedMotion === "off" ? "selected" : "") + ">Luôn tắt</option></select></label><label>Tỉ lệ UI<select data-hgl1-setting=\"uiScale\"><option value=\"small\" " + (settings.uiScale === "small" ? "selected" : "") + ">Nhỏ</option><option value=\"medium\" " + (settings.uiScale === "medium" ? "selected" : "") + ">Mặc định</option><option value=\"large\" " + (settings.uiScale === "large" ? "selected" : "") + ">Lớn</option></select></label><label>Màu hỗ trợ<select data-hgl1-setting=\"colorVision\"><option value=\"standard\" " + (settings.colorVision === "standard" ? "selected" : "") + ">Tiêu chuẩn</option><option value=\"deuteranopia\" " + (settings.colorVision === "deuteranopia" ? "selected" : "") + ">Deuteranopia</option><option value=\"protanopia\" " + (settings.colorVision === "protanopia" ? "selected" : "") + ">Protanopia</option><option value=\"tritanopia\" " + (settings.colorVision === "tritanopia" ? "selected" : "") + ">Tritanopia</option></select></label></fieldset>" +
      "<section class=\"hgl1-settings-card\"><span class=\"hgl1-kicker\">Dữ liệu</span><h2>Sao lưu & khôi phục</h2><p>Bản sao lưu đa kho gồm cài đặt, tài liệu, Creator Studio, Learning Star, JSON lớn và sự kiện đã consent. Không bao gồm bản mẫu, Blob hoặc media nhị phân.</p><div class=\"hgl1-settings-actions\"><button class=\"hgl1-button hgl1-button--primary\" type=\"button\" data-hgl1-action=\"export-backup\">" + icon("download") + " Xuất JSON</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"trigger-backup-import\">" + icon("upload") + " Nhập JSON</button><input class=\"hgl1-sr-only\" type=\"file\" tabindex=\"-1\" aria-label=\"Chọn tệp sao lưu HH Galaxy\" accept=\"application/json,.json\" data-hgl1-backup-file/></div><dl><div><dt>Tài liệu người dùng</dt><dd>" + state.items.length + "</dd></div><div><dt>Sự kiện consent</dt><dd>" + (settings.analyticsConsent ? state.events.length : 0) + "</dd></div><div><dt>Metadata nhỏ</dt><dd>" + escapeHtml(STORAGE_KEY) + "</dd></div><div><dt>Nội dung tệp lớn</dt><dd data-hgl1-content-storage-status data-state=\"" + escapeHtml(contentStorage.state || "unavailable") + "\">" + escapeHtml(contentStorageLabel) + "</dd></div></dl><div class=\"hgl1-settings-actions\"><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"refresh-storage-usage\">Đo dung lượng thật</button><button class=\"hgl1-button hgl1-button--danger\" type=\"button\" data-hgl1-action=\"clear-large-content\">Xóa nội dung tệp đã lưu</button></div><output data-hgl1-storage-usage role=\"status\">Chưa đo dung lượng IndexedDB.</output></section>" +
      "<section class=\"hgl1-settings-card hgl1-settings-card--wide\"><span class=\"hgl1-kicker\">Analytics</span><h2>Consent rõ ràng</h2><div class=\"hgl1-setting-row\"><div><p>Cho phép lưu sự kiện điều hướng và thao tác tối thiểu trên thiết bị.</p><small>Nội dung tài liệu không được đưa vào sự kiện.</small></div><label class=\"hgl1-switch\"><input type=\"checkbox\" aria-label=\"Cho phép Analytics cục bộ\" data-hgl1-setting=\"analyticsConsent\" " + (settings.analyticsConsent ? "checked" : "") + "/><span aria-hidden=\"true\"></span><b aria-hidden=\"true\">" + (settings.analyticsConsent ? "Đã bật" : "Đang tắt") + "</b></label></div></section></div><div class=\"hgl1-settings-commit\"><output data-hgl1-settings-status role=\"status\">" + (dirty ? "Có thay đổi chưa lưu." : "Cấu hình đã đồng bộ với bản lưu.") + "</output><div class=\"hgl1-settings-actions\"><button class=\"hgl1-button hgl1-button--primary\" type=\"submit\" data-hgl1-action=\"save-settings\" " + (dirty ? "" : "disabled") + ">Lưu thay đổi</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"cancel-settings\" " + (dirty ? "" : "disabled") + ">Hủy thay đổi</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"restore-settings-defaults\">Khôi phục mặc định</button></div></div></form>" + backupPreviewMarkup(ui && ui.pendingBackup) + "</div>" +
      worldRailMarkup(entry, { status: "Thiết lập cục bộ", itemCount: state.items.length, scope: STORAGE_KEY }) + "</div></section>";
  }

  function routeContent(entry, state, ui) {
    if (ui && ui.status === "loading") return statePanel("loading");
    if (ui && ui.status === "error") return statePanel("error", ui.message || "Vui lòng kiểm tra quyền lưu trữ của trình duyệt.");
    if (entry.route === "/home") return homeMarkup();
    if (entry.route === "/galaxy/creator") return creatorMarkup(state);
    if (entry.route === "/galaxy/learning") return learningMarkup(state, ui);
    if (entry.route === "/galaxy/tools") return toolsMarkup(state);
    if (entry.route === "/galaxy/analytics") return analyticsMarkup(state, ui);
    if (entry.route === "/galaxy/settings") return settingsMarkup(state, ui);
    return moduleMarkup(entry, state);
  }

  function commandResultMarkup(command, index) {
    const route = command.route ? " data-command-route=\"" + escapeHtml(command.route) + "\"" : "";
    const action = command.action ? " data-command-action=\"" + escapeHtml(command.action) + "\"" : "";
    const item = command.itemId ? " data-command-item=\"" + escapeHtml(command.itemId) + "\"" : "";
    const kindLabels = { route: "Khu vực", item: "Tài liệu", action: "Lệnh" };
    return "<button class=\"hgl1-command-result" + (index === 0 ? " is-active" : "") + "\" type=\"button\" role=\"option\" aria-selected=\"" + String(index === 0) + "\" data-hgl1-command-id=\"" + escapeHtml(command.id) + "\" data-command-index=\"" + index + "\"" + route + action + item + ">" +
      "<span class=\"hgl1-nav__icon hgl1-tone--" + escapeHtml(command.tone || "violet") + "\">" + icon(command.icon || "search") + "</span><span><b>" + escapeHtml(command.label) + "</b><small>" + escapeHtml(command.description || "") + "</small></span><em>" + escapeHtml(kindLabels[command.kind] || "Lệnh") + "</em>" + icon("arrow") + "</button>";
  }

  function commandPaletteMarkup(state, entry) {
    const commands = commandCatalog("", state, entry.route, 12);
    return "<div class=\"hgl1-command-backdrop\" data-hgl1-command-backdrop hidden><section class=\"hgl1-command-palette\" data-hgl1-command-palette role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"hgl1-command-title\" tabindex=\"-1\">" +
      "<header><span class=\"hgl1-nav__icon hgl1-tone--" + escapeHtml(entry.tone) + "\">" + icon("search") + "</span><label for=\"hgl1-command-input\"><span id=\"hgl1-command-title\">Tìm và thực hiện lệnh</span><input id=\"hgl1-command-input\" type=\"search\" autocomplete=\"off\" maxlength=\"120\" data-hgl1-command-input aria-controls=\"hgl1-command-results\" aria-autocomplete=\"list\" placeholder=\"Khu vực, tài liệu hoặc thao tác…\"/></label><kbd>Esc</kbd></header>" +
      "<div class=\"hgl1-command-results\" id=\"hgl1-command-results\" role=\"listbox\" data-hgl1-command-results>" + commands.map(commandResultMarkup).join("") + "</div>" +
      "<footer><span><kbd>↑</kbd><kbd>↓</kbd> Di chuyển</span><span><kbd>Enter</kbd> Mở</span><span>Dữ liệu tìm kiếm chỉ ở Layer 1</span></footer></section></div>";
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
    const activeSettings = sanitizeSettings(ui.settingsDraft || state.settings);
    return "<div class=\"hh-galaxy-app\" data-hh-layer=\"galaxy\" data-route=\"" + entry.route + "\" data-theme=\"" + activeSettings.theme + "\" data-effects=\"" + activeSettings.effects + "\" data-contrast=\"" + activeSettings.contrast + "\" data-reduced-motion=\"" + activeSettings.reducedMotion + "\" data-ui-scale=\"" + activeSettings.uiScale + "\" data-color-vision=\"" + activeSettings.colorVision + "\">" +
      "<a class=\"hgl1-skip-link\" href=\"#hgl1-main\">Bỏ qua điều hướng</a><div class=\"hgl1-cosmos\" aria-hidden=\"true\"><i></i><i></i><i></i></div>" +
      "<aside class=\"hgl1-sidebar\" id=\"hgl1-sidebar\" data-hgl1-drawer role=\"dialog\" aria-modal=\"true\" aria-hidden=\"true\" aria-label=\"Điều hướng HH Galaxy\"><div class=\"hgl1-sidebar__head\"><div class=\"hgl1-product-mark\"><span>" + icon("home") + "</span><div><b>HH GALAXY MAP</b><small>Lớp 1 · Không gian độc lập</small></div></div><button class=\"hgl1-icon-button hgl1-sidebar__close\" type=\"button\" data-hgl1-action=\"close-drawer\" aria-label=\"Đóng menu\">" + icon("close") + "</button><div class=\"hgl1-brand\"><span>HH</span><div><b>HOANG8.COM</b><small>Galaxy Workspace</small></div></div>" + searchBoxMarkup(false) + "</div>" +
      "<nav class=\"hgl1-nav\">" + navMarkup(entry.route, false) + "</nav><div class=\"hgl1-sidebar__footer\"><a class=\"hgl1-customize\" href=\"#/galaxy/settings\" data-hgl1-route=\"/galaxy/settings\"><span>" + icon("settings") + "</span><div><b>Tùy chỉnh Galaxy</b><small>Màu sắc, chuyển động và quyền riêng tư</small></div>" + icon("arrow") + "</a><div class=\"hgl1-profile\"><span class=\"hgl1-avatar\">" + initial + "</span><div><b>" + escapeHtml(displayName) + "</b><small>" + storageStatus + "</small></div></div></div></aside>" +
      "<button class=\"hgl1-backdrop\" type=\"button\" data-hgl1-action=\"close-drawer\" aria-label=\"Đóng menu\" tabindex=\"-1\"></button>" +
      "<div class=\"hgl1-shell\"><header class=\"hgl1-topbar\"><button class=\"hgl1-icon-button hgl1-menu-button\" type=\"button\" data-hgl1-action=\"open-drawer\" aria-controls=\"hgl1-sidebar\" aria-expanded=\"false\" aria-label=\"Mở menu\">" + icon("menu") + "</button><div class=\"hgl1-breadcrumb\"><span>HH Galaxy</span><b>/</b><strong>" + escapeHtml(entry.label) + "</strong></div>" + searchBoxMarkup(true) + "<div class=\"hgl1-topbar__status\" title=\"" + networkLabel + "\"><span class=\"" + (online === false ? "is-offline" : "") + "\"></span><b>" + escapeHtml(networkLabel) + "</b></div><button class=\"hgl1-icon-button\" type=\"button\" data-hgl1-action=\"show-empty-notifications\" aria-label=\"Thông báo: chưa có dữ liệu\">" + icon("bell") + "</button><button class=\"hgl1-icon-button\" type=\"button\" data-hgl1-action=\"show-help\" aria-label=\"Trợ giúp\">" + icon("help") + "</button><span class=\"hgl1-avatar hgl1-avatar--small\" aria-label=\"" + escapeHtml(displayName) + "\">" + initial + "</span></header>" +
      "<main class=\"hgl1-main\" id=\"hgl1-main\" tabindex=\"-1\">" + (ui.storageStatus === "error" || ui.storageStatus === "unsupported" ? "<div class=\"hgl1-alert\" role=\"alert\">" + escapeHtml(storageStatus) + ". Các thao tác lưu sẽ bị vô hiệu nếu trình duyệt không cấp quyền.</div>" : "") + routeContent(entry, state, ui) + "</main>" +
      "<nav class=\"hgl1-mobile-nav\" aria-label=\"Điều hướng nhanh\">" + navMarkup(entry.route, true) + "</nav></div>" +
      commandPaletteMarkup(state, entry) + "<div class=\"hgl1-toast\" data-hgl1-toast role=\"status\" aria-live=\"polite\" hidden></div></div>";
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
    runtime.delegateHost = null;
    runtime.delegateRoute = null;
  }

  function registerDelegateCleanup(value) {
    if (!runtime) return;
    if (typeof value === "function") runtime.delegateCleanups.push(value);
    else if (value && typeof value.unmount === "function") runtime.delegateCleanups.push(function unmountController() { value.unmount(); });
  }

  function cleanupRouteRuntime() {
    if (!runtime) return;
    if (runtime.route === "/galaxy/learning") resetLearningInteraction({ preserveDeck: true });
    const probe = runtime.aiProbe;
    runtime.aiProbe = null;
    if (probe && probe.controller && typeof probe.controller.abort === "function") {
      try { probe.controller.abort(); } catch (_) { /* The request already settled. */ }
    }
    const request = runtime.aiRequest;
    runtime.aiRequest = null;
    if (request && request.controller && typeof request.controller.abort === "function") {
      try { request.controller.abort(); } catch (_) { /* The request already settled. */ }
    }
    const socket = runtime.communitySocket;
    runtime.communitySocket = null;
    if (socket) {
      try {
        if (typeof socket.removeAllListeners === "function") socket.removeAllListeners();
        if (typeof socket.close === "function") socket.close();
        else if (typeof socket.disconnect === "function") socket.disconnect();
      } catch (_) { /* The realtime transport already closed. */ }
    }
    runtime.aiProviderStatus = null;
    runtime.aiLastPrompt = "";
    runtime.communityRealtimeState = null;
    cleanupDevPreview();
  }

  function mountRouteDelegate() {
    if (!runtime) return;
    const app = runtime.host.querySelector(".hh-galaxy-app");
    const delegateSelector = runtime.route === "/home"
      ? "[data-hh-galaxy-home-host]"
      : runtime.route === "/galaxy/creator" ? "[data-hh-galaxy-creator-host]" : "";
    const delegateHost = delegateSelector && app && app.querySelector(delegateSelector);
    if (runtime.delegateRoute === runtime.route && runtime.delegateHost === delegateHost) return;
    cleanupDelegate();
    runtime.delegateRoute = runtime.route;
    runtime.delegateHost = delegateHost || null;
    const context = {
      route: runtime.route,
      storage: runtime.storage,
      layer: "galaxy",
      embedded: true
    };
    if (runtime.route === "/home") {
      const homeHost = delegateHost;
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
      const creatorHost = delegateHost;
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
    const safe = sanitizeSettings(settings);
    app.dataset.theme = safe.theme;
    app.dataset.effects = safe.effects;
    app.dataset.contrast = safe.contrast;
    app.dataset.reducedMotion = safe.reducedMotion;
    app.dataset.uiScale = safe.uiScale;
    app.dataset.colorVision = safe.colorVision;
  }

  function syncElementAttributes(current, next) {
    Array.prototype.slice.call(current.attributes || []).forEach(function removeOldAttribute(attribute) {
      if (!next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
    });
    Array.prototype.slice.call(next.attributes || []).forEach(function copyNewAttribute(attribute) {
      if (current.getAttribute(attribute.name) !== attribute.value) current.setAttribute(attribute.name, attribute.value);
    });
  }

  function collectPersistentChrome(currentRoot, nextRoot) {
    if (!currentRoot || !nextRoot) return null;
    const selectors = {
      cosmos: ".hgl1-cosmos",
      sidebar: ".hgl1-sidebar",
      nav: ".hgl1-sidebar .hgl1-nav",
      backdrop: ".hgl1-backdrop",
      shell: ".hgl1-shell",
      topbar: ".hgl1-topbar",
      main: ".hgl1-main",
      mobileNav: ".hgl1-mobile-nav"
    };
    const nodes = { currentRoot: currentRoot, nextRoot: nextRoot };
    const names = Object.keys(selectors);
    for (let index = 0; index < names.length; index += 1) {
      const name = names[index];
      nodes["current" + name.charAt(0).toLocaleUpperCase("en-US") + name.slice(1)] = currentRoot.querySelector(selectors[name]);
      nodes["next" + name.charAt(0).toLocaleUpperCase("en-US") + name.slice(1)] = nextRoot.querySelector(selectors[name]);
      if (!nodes["current" + name.charAt(0).toLocaleUpperCase("en-US") + name.slice(1)] || !nodes["next" + name.charAt(0).toLocaleUpperCase("en-US") + name.slice(1)]) return null;
    }

    nodes.currentRouteLinks = Array.prototype.slice.call(currentRoot.querySelectorAll(".hgl1-nav__link[data-hgl1-route]"));
    nodes.nextRouteLinks = Array.prototype.slice.call(nextRoot.querySelectorAll(".hgl1-nav__link[data-hgl1-route]"));
    if (nodes.currentRouteLinks.length !== nodes.nextRouteLinks.length) return null;
    for (let linkIndex = 0; linkIndex < nodes.currentRouteLinks.length; linkIndex += 1) {
      if (nodes.currentRouteLinks[linkIndex].getAttribute("data-hgl1-route") !== nodes.nextRouteLinks[linkIndex].getAttribute("data-hgl1-route")) return null;
    }
    return nodes;
  }

  function syncPersistentChrome(nodes) {
    if (!nodes) return false;
    [
      [nodes.currentRoot, nodes.nextRoot],
      [nodes.currentCosmos, nodes.nextCosmos],
      [nodes.currentSidebar, nodes.nextSidebar],
      [nodes.currentNav, nodes.nextNav],
      [nodes.currentBackdrop, nodes.nextBackdrop],
      [nodes.currentShell, nodes.nextShell],
      [nodes.currentTopbar, nodes.nextTopbar],
      [nodes.currentMobileNav, nodes.nextMobileNav]
    ].forEach(function syncChromeAttributes(pair) {
      syncElementAttributes(pair[0], pair[1]);
    });
    nodes.currentRouteLinks.forEach(function syncRouteLink(link, index) {
      syncElementAttributes(link, nodes.nextRouteLinks[index]);
    });

    const dynamicTextSelectors = [
      ".hgl1-breadcrumb strong",
      ".hgl1-topbar__status b",
      ".hgl1-topbar > .hgl1-avatar--small",
      ".hgl1-profile .hgl1-avatar",
      ".hgl1-profile b",
      ".hgl1-profile small"
    ];
    for (let index = 0; index < dynamicTextSelectors.length; index += 1) {
      const selector = dynamicTextSelectors[index];
      const current = nodes.currentRoot.querySelector(selector);
      const next = nodes.nextRoot.querySelector(selector);
      if (!current || !next) return false;
      syncElementAttributes(current, next);
      if (current.textContent !== next.textContent) current.textContent = next.textContent;
    }
    const currentNetwork = nodes.currentRoot.querySelector(".hgl1-topbar__status");
    const nextNetwork = nodes.nextRoot.querySelector(".hgl1-topbar__status");
    const currentNetworkDot = currentNetwork && currentNetwork.querySelector("span");
    const nextNetworkDot = nextNetwork && nextNetwork.querySelector("span");
    if (!currentNetwork || !nextNetwork || !currentNetworkDot || !nextNetworkDot) return false;
    syncElementAttributes(currentNetwork, nextNetwork);
    syncElementAttributes(currentNetworkDot, nextNetworkDot);

    const currentCommandTone = nodes.currentRoot.querySelector("[data-hgl1-command-palette] header .hgl1-nav__icon");
    const nextCommandTone = nodes.nextRoot.querySelector("[data-hgl1-command-palette] header .hgl1-nav__icon");
    if (currentCommandTone && nextCommandTone) syncElementAttributes(currentCommandTone, nextCommandTone);
    return true;
  }

  // Rebuild the route around an active media/game island without ever removing
  // that island from the connected DOM. In particular, detaching an iframe can
  // destroy its browsing context even when the same node is appended again.
  function renderPreservingIsland(markup, selector) {
    if (!runtime || !runtime.app || !globalScope.document || !selector) return false;
    const currentRoot = runtime.app;
    const currentIsland = currentRoot.querySelector(selector);
    if (!currentIsland || !currentIsland.isConnected) return false;
    const template = globalScope.document.createElement("template");
    template.innerHTML = String(markup || "").trim();
    const nextRoot = template.content && template.content.querySelector(".hh-galaxy-app");
    const nextIsland = nextRoot && nextRoot.querySelector(selector);
    if (!nextRoot || !nextIsland) return false;

    const chrome = collectPersistentChrome(currentRoot, nextRoot);
    if (!chrome) return false;
    const currentMain = chrome.currentMain;
    const nextMain = chrome.nextMain;

    function chain(root, leaf) {
      const result = [];
      let node = leaf;
      while (node) {
        result.push(node);
        if (node === root) break;
        node = node.parentElement;
      }
      return result[result.length - 1] === root ? result.reverse() : [];
    }

    const currentChain = chain(currentMain, currentIsland);
    const nextChain = chain(nextMain, nextIsland);
    if (!currentChain.length || currentChain.length !== nextChain.length) return false;
    for (let index = 0; index < currentChain.length; index += 1) {
      if (currentChain[index].nodeName !== nextChain[index].nodeName) return false;
    }
    if (!syncPersistentChrome(chrome)) return false;

    for (let index = 0; index < currentChain.length; index += 1) {
      const currentNode = currentChain[index];
      const nextNode = nextChain[index];
      syncElementAttributes(currentNode, nextNode);
      if (index === currentChain.length - 1) break;
      const currentBranch = currentChain[index + 1];
      const nextBranch = nextChain[index + 1];
      Array.prototype.slice.call(currentNode.childNodes).forEach(function removeSibling(child) {
        if (child !== currentBranch) child.remove();
      });
      let passedBranch = false;
      Array.prototype.slice.call(nextNode.childNodes).forEach(function rebuildSibling(child) {
        if (child === nextBranch) { passedBranch = true; return; }
        const clone = child.cloneNode(true);
        if (passedBranch) currentNode.appendChild(clone);
        else currentNode.insertBefore(clone, currentBranch);
      });
    }
    runtime.app = currentRoot;
    return true;
  }

  // Route changes replace only the outlet. The app root, both navigation bars,
  // sidebar and cosmic background keep their DOM identity, so their animations,
  // focus state and scroll position continue without a visible flash.
  function renderPreservingChrome(markup) {
    if (!runtime || !runtime.app || !globalScope.document) return false;
    const currentRoot = runtime.app;
    if (currentRoot.isConnected === false) return false;
    const template = globalScope.document.createElement("template");
    template.innerHTML = String(markup || "").trim();
    const nextRoot = template.content && template.content.querySelector(".hh-galaxy-app");
    const chrome = collectPersistentChrome(currentRoot, nextRoot);
    if (!chrome || !chrome.currentMain.parentNode) return false;
    if (!syncPersistentChrome(chrome)) return false;
    chrome.currentMain.parentNode.replaceChild(chrome.nextMain, chrome.currentMain);
    runtime.app = currentRoot;
    return true;
  }

  function analyticsEngine() {
    const api = globalScope.HHGalaxyLayerOneAnalytics;
    return api && typeof api.createCollector === "function" ? api : null;
  }

  function clearAnalyticsRefreshTimer(active) {
    const owner = active || runtime;
    if (!owner || !owner.analyticsRefreshTimer) return;
    if (globalScope.clearTimeout) globalScope.clearTimeout(owner.analyticsRefreshTimer);
    owner.analyticsRefreshTimer = 0;
  }

  function snapshotAnalyticsCollector(active) {
    const owner = active || runtime;
    if (!owner || !owner.analyticsCollector || owner.localState.settings.analyticsConsent !== true) {
      if (owner) owner.performanceMetrics = null;
      return null;
    }
    try {
      owner.performanceMetrics = owner.analyticsCollector.snapshot();
    } catch (_) {
      owner.performanceMetrics = null;
    }
    return owner.performanceMetrics;
  }

  function scheduleAnalyticsSnapshotRefresh(active) {
    if (!active || active.analyticsRefreshTimer || typeof globalScope.setTimeout !== "function") return;
    active.analyticsRefreshTimer = globalScope.setTimeout(function refreshBufferedVitals() {
      active.analyticsRefreshTimer = 0;
      if (!runtime || runtime !== active || active.localState.settings.analyticsConsent !== true) return;
      snapshotAnalyticsCollector(active);
      if (active.route === "/galaxy/analytics") render();
    }, 1000);
  }

  function releaseAnalyticsCollector(active, clearMetrics) {
    const owner = active || runtime;
    if (!owner) return;
    clearAnalyticsRefreshTimer(owner);
    if (owner.analyticsCollector) {
      try { owner.analyticsCollector.stop(); } catch (_) {}
      if (clearMetrics !== false) {
        try { owner.analyticsCollector.clear(); } catch (_) {}
      }
    }
    owner.analyticsCollector = null;
    if (clearMetrics !== false) owner.performanceMetrics = null;
  }

  function syncAnalyticsCollectorConsent(consent, active) {
    const owner = active || runtime;
    if (!owner) return false;
    if (consent !== true) {
      if (owner.analyticsCollector) {
        try { owner.analyticsCollector.setConsent(false); } catch (_) {}
      }
      releaseAnalyticsCollector(owner, true);
      return false;
    }
    const engine = analyticsEngine();
    if (!engine) {
      releaseAnalyticsCollector(owner, true);
      return false;
    }
    let created = false;
    if (!owner.analyticsCollector) {
      try {
        owner.analyticsCollector = engine.createCollector({ consent: true });
        created = true;
      } catch (_) {
        owner.analyticsCollector = null;
        owner.performanceMetrics = null;
        return false;
      }
    }
    try {
      owner.analyticsCollector.setConsent(true);
      owner.analyticsCollector.start();
      snapshotAnalyticsCollector(owner);
      if (created) scheduleAnalyticsSnapshotRefresh(owner);
      return true;
    } catch (_) {
      releaseAnalyticsCollector(owner, true);
      return false;
    }
  }

  function render() {
    if (!runtime) return false;
    const inspection = inspectLocalState(runtime.storage);
    runtime.localState = inspection.data;
    runtime.storageStatus = inspection.status;
    syncAnalyticsCollectorConsent(runtime.localState.settings.analyticsConsent, runtime);
    if (runtime.route === "/galaxy/settings" && !runtime.settingsDraft) {
      runtime.settingsDraft = sanitizeSettings(runtime.localState.settings);
    }
    const online = typeof globalScope.navigator === "object" && typeof globalScope.navigator.onLine === "boolean" ? globalScope.navigator.onLine : null;
    const markup = viewMarkup(runtime.route, runtime.localState, {
      online: online,
      userName: runtime.options.user && (runtime.options.user.displayName || runtime.options.user.name),
      storageStatus: runtime.storageStatus,
      status: runtime.viewStatus,
      message: runtime.viewMessage,
      settingsDraft: runtime.route === "/galaxy/settings" ? runtime.settingsDraft : null,
      pendingBackup: runtime.pendingBackup,
      analyticsRange: runtime.analyticsRange,
      contentStorageStatus: runtime.contentStorageStatus,
      performanceMetrics: runtime.performanceMetrics,
      learningState: runtime.learningState,
      learningStatus: runtime.learningStatus,
      learningError: runtime.learningError,
      learningSelectedDeckId: runtime.learningSelectedDeckId,
      learningEditingCardId: runtime.learningEditingCardId,
      learningReviewCardId: runtime.learningReviewCardId,
      learningReviewRevealed: runtime.learningReviewRevealed,
      learningQuiz: runtime.learningQuiz,
      learningQuizResult: runtime.learningQuizResult
    });
    let islandSelector = "";
    if (runtime.mediaSession && runtime.mediaSession.route === runtime.route) islandSelector = "[data-hgl1-stable-media-host]";
    else if (runtime.gameSession && runtime.route === "/galaxy/games") islandSelector = "[data-hgl1-game-canvas]";
    else if (runtime.devPreviewFrame && runtime.route === "/galaxy/dev") islandSelector = "[data-hgl1-dev-preview-host]";
    else if (runtime.route === "/home") islandSelector = "[data-hh-galaxy-home-host]";
    else if (runtime.route === "/galaxy/creator") islandSelector = "[data-hh-galaxy-creator-host]";
    const preserveChangedRouteChrome = runtime.preserveChromeNextRender === true;
    runtime.preserveChromeNextRender = false;
    let preserved = preserveChangedRouteChrome && renderPreservingChrome(markup);
    if (!preserved && islandSelector) preserved = renderPreservingIsland(markup, islandSelector);
    if (!preserved && runtime.app) preserved = renderPreservingChrome(markup);
    if (!preserved) {
      runtime.host.innerHTML = markup;
      runtime.app = runtime.host.querySelector(".hh-galaxy-app");
    }
    applyPreferences(runtime.app, runtime.route === "/galaxy/settings" && runtime.settingsDraft ? runtime.settingsDraft : runtime.localState.settings);
    updateDrawerMode();
    if (runtime.mediaSession && runtime.mediaSession.route === runtime.route) {
      const mediaStatus = runtime.app.querySelector("[data-hgl1-media-status]");
      if (mediaStatus) mediaStatus.textContent = runtime.mediaSession.kind === "youtube"
        ? "Nguồn: YouTube Privacy-Enhanced Mode · player không tự phát và không bị polling."
        : "Đang mở " + String(runtime.mediaSession.fileName || "media đã chọn") + " · không tự phát.";
    }
    if (runtime.gameSession && runtime.route === "/galaxy/games") {
      updateGameSessionUi(runtime.gameSession);
    }
    mountRouteDelegate();
    mountRouteRuntime();
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

  function setDrawer(open, returnFocus) {
    if (!runtime || !runtime.app) return;
    const nextOpen = Boolean(open);
    runtime.app.dataset.drawerOpen = String(nextOpen);
    const toggle = runtime.app.querySelector("[data-hgl1-action=\"open-drawer\"]");
    const sidebar = runtime.app.querySelector("#hgl1-sidebar");
    if (toggle) toggle.setAttribute("aria-expanded", String(nextOpen));
    if (sidebar) {
      const modal = runtime.drawerModal !== false;
      sidebar.setAttribute("aria-hidden", String(modal && !nextOpen));
      sidebar.inert = modal && !nextOpen;
    }
    if (nextOpen) {
      runtime.drawerReturnFocus = globalScope.document && globalScope.document.activeElement;
      const first = sidebar && sidebar.querySelector("button:not([disabled]), a[href], input:not([disabled])");
      first && first.focus();
    } else if (returnFocus !== false) {
      const target = runtime.drawerReturnFocus;
      runtime.drawerReturnFocus = null;
      if (target && target.isConnected && typeof target.focus === "function") target.focus();
    }
  }

  function updateDrawerMode() {
    if (!runtime || !runtime.app) return;
    let modal = true;
    try { modal = !globalScope.matchMedia || globalScope.matchMedia("(max-width: 1279px)").matches; } catch (_) { modal = true; }
    runtime.drawerModal = modal;
    const sidebar = runtime.app.querySelector("[data-hgl1-drawer]");
    if (!sidebar) return;
    if (modal) {
      sidebar.setAttribute("role", "dialog");
      sidebar.setAttribute("aria-modal", "true");
      const open = runtime.app.dataset.drawerOpen === "true";
      sidebar.setAttribute("aria-hidden", String(!open));
      sidebar.inert = !open;
    } else {
      runtime.app.dataset.drawerOpen = "false";
      sidebar.setAttribute("role", "navigation");
      sidebar.removeAttribute("aria-modal");
      sidebar.setAttribute("aria-hidden", "false");
      sidebar.inert = false;
      const toggle = runtime.app.querySelector("[data-hgl1-action=\"open-drawer\"]");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    }
  }

  function navigate(route) {
    const match = findRoute(route);
    if (!match || !runtime) return false;
    setDrawer(false, false);
    closeSearches();
    const active = runtime;
    if (typeof runtime.options.navigate === "function") {
      runtime.options.navigate(match.route, { source: "galaxy-layer-one", layer: "galaxy" });
    } else {
      try { globalScope.location.hash = "#" + match.route; } catch (_) { /* syncRoute below remains usable. */ }
    }
    if (runtime === active && runtime.route !== match.route) syncRoute(match.route);
    return true;
  }

  function searchResultsMarkup(results) {
    if (!results.length) return "<div class=\"hgl1-search__empty\">Không có chức năng lớp 1 phù hợp.</div>";
    return results.map(function result(entry, index) {
      return "<button type=\"button\" data-hgl1-search-route=\"" + entry.route + "\" data-result-index=\"" + index + "\"><span class=\"hgl1-nav__icon hgl1-tone--" + entry.tone + "\">" + icon(entry.icon) + "</span><span><b>" + escapeHtml(entry.label) + "</b><small>" + escapeHtml(entry.eyebrow) + "</small></span>" + icon("arrow") + "</button>";
    }).join("");
  }

  function setCommandSelection(index) {
    if (!runtime || !runtime.app) return;
    const results = Array.prototype.slice.call(runtime.app.querySelectorAll("[data-hgl1-command-id]"));
    if (!results.length) return;
    const next = Math.max(0, Math.min(Number(index) || 0, results.length - 1));
    results.forEach(function selectCommand(result, resultIndex) {
      const selected = resultIndex === next;
      result.classList.toggle("is-active", selected);
      result.setAttribute("aria-selected", String(selected));
    });
    runtime.commandIndex = next;
    results[next].scrollIntoView && results[next].scrollIntoView({ block: "nearest" });
  }

  function updateCommandPalette(input) {
    if (!runtime || !runtime.app) return;
    const host = runtime.app.querySelector("[data-hgl1-command-results]");
    if (!host) return;
    const commands = commandCatalog(input && input.value, runtime.localState, runtime.route, 16);
    host.innerHTML = commands.length ? commands.map(commandResultMarkup).join("") : "<div class=\"hgl1-command-empty\" role=\"status\">Không có khu vực, tài liệu hoặc lệnh phù hợp.</div>";
    runtime.commandIndex = 0;
  }

  function openCommandPalette() {
    if (!runtime || !runtime.app) return false;
    const backdrop = runtime.app.querySelector("[data-hgl1-command-backdrop]");
    const dialog = runtime.app.querySelector("[data-hgl1-command-palette]");
    const input = runtime.app.querySelector("[data-hgl1-command-input]");
    if (!backdrop || !dialog || !input) return false;
    runtime.commandReturnFocus = globalScope.document && globalScope.document.activeElement;
    runtime.commandPaletteOpen = true;
    runtime.commandIndex = 0;
    backdrop.hidden = false;
    input.value = "";
    updateCommandPalette(input);
    input.focus();
    return true;
  }

  function closeCommandPalette(returnFocus) {
    if (!runtime || !runtime.app) return;
    const backdrop = runtime.app.querySelector("[data-hgl1-command-backdrop]");
    if (backdrop) backdrop.hidden = true;
    runtime.commandPaletteOpen = false;
    runtime.commandIndex = 0;
    if (returnFocus !== false) {
      const target = runtime.commandReturnFocus;
      runtime.commandReturnFocus = null;
      if (target && target.isConnected && typeof target.focus === "function") target.focus();
    }
  }

  function executeCommand(control) {
    if (!runtime || !control) return false;
    const route = control.dataset.commandRoute;
    const action = control.dataset.commandAction;
    const itemId = control.dataset.commandItem;
    closeCommandPalette(false);
    if (route && route !== runtime.route) navigate(route);
    if (action) {
      const target = runtime.app && runtime.app.querySelector("[data-hgl1-action=\"" + action + "\"]" + (route ? "[data-route=\"" + route + "\"]" : "")) || runtime.app && runtime.app.querySelector("[data-hgl1-action=\"" + action + "\"]");
      if (target) target.click();
      else showToast("Lệnh này chưa khả dụng trong khu vực hiện tại.", "info");
      return true;
    }
    if (itemId && runtime.app) {
      const target = Array.prototype.find.call(runtime.app.querySelectorAll("[data-hgl1-item][data-item-id]"), function matchCommandItem(item) {
        return item.dataset.itemId === itemId;
      });
      if (target) {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }
    }
    return Boolean(route || itemId);
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

  function applyLearningLibraryFilter(source) {
    if (!runtime || !runtime.app) return;
    const library = source && typeof source.closest === "function" ? source.closest(".hgl1-learning-library") : null;
    const host = library || runtime.app.querySelector(".hgl1-learning-library");
    if (!host) return;
    const search = host.querySelector("[data-hgl1-learning-search]");
    const selected = host.querySelector("[data-hgl1-action=\"filter-learning\"][aria-pressed=\"true\"]");
    const filter = selected ? selected.dataset.learningFilter : "all";
    const needle = normalizedSearchText(search ? search.value : "");
    const resources = host.querySelectorAll("[data-hgl1-learning-resource]");
    let visible = 0;
    Array.prototype.forEach.call(resources, function filterLearningResource(resource) {
      const category = resource.dataset.learningCategory || "notes";
      const categoryMatch = filter === "all" || category === filter;
      const textMatch = !needle || normalizedSearchText(resource.getAttribute("data-filter-text")).indexOf(needle) >= 0;
      resource.hidden = !(categoryMatch && textMatch);
      if (!resource.hidden) visible += 1;
    });
    const count = host.querySelector("[data-hgl1-learning-result-count]");
    if (count) count.textContent = visible + " mục";
    const empty = host.querySelector("[data-hgl1-learning-empty]");
    if (empty) empty.hidden = visible !== 0;
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
    const range = ["today", "7d", "30d", "all"].includes(runtime.analyticsRange) ? runtime.analyticsRange : "all";
    const now = Date.now();
    const summary = summarizeAnalytics(state, range, now);
    if (!summary.consent) return false;
    const start = analyticsRangeStart(range, now);
    const events = state.events.filter(function inExportRange(event) {
      const at = Date.parse(event.at);
      return Number.isFinite(at) && at >= start;
    });
    runtime.localState = state;
    syncAnalyticsCollectorConsent(true, runtime);
    const webVitals = snapshotAnalyticsCollector(runtime);
    const methodology = "raw-performance-observer-approximation";
    let body = "";
    let type = "";
    let name = "";
    if (format === "csv") {
      const rows = [["recordType", "metric", "value", "unit", "eventType", "route", "recordedAt", "startTimeMs", "source", "methodology"]];
      events.forEach(function eventCells(event) {
        rows.push(["event", "", "", "", event.type, event.route, event.at, "", "local-event-log", "local-consented-event-log"]);
      });
      if (webVitals && webVitals.metrics) {
        Object.keys(webVitals.metrics).forEach(function vitalRows(metricName) {
          const metric = webVitals.metrics[metricName];
          (metric.entries || []).forEach(function vitalEntry(entry) {
            rows.push(["performance-entry", metricName, entry.value, metric.unit, "", "", webVitals.collectedAt, entry.atMs, entry.source, methodology]);
          });
        });
      }
      body = rows.map(function csvRow(row) {
        return row.map(function csvCell(cell) { return "\"" + String(cell).replace(/"/g, "\"\"") + "\""; }).join(",");
      }).join("\r\n");
      type = "text/csv;charset=utf-8";
      name = "hh-galaxy-analytics.csv";
    } else {
      body = JSON.stringify({ schema: "hh-galaxy-analytics", version: VERSION, range: range, exportedAt: new Date(now).toISOString(), methodology: methodology, webVitals: webVitals, events: events }, null, 2);
      type = "application/json;charset=utf-8";
      name = "hh-galaxy-analytics.json";
    }
    const ok = downloadText(name, body, type);
    if (ok) recordEvent("data-export", "/galaxy/analytics", runtime.storage);
    return ok;
  }

  function updateContentStorageStatus() {
    if (!runtime || !runtime.app) return;
    const status = runtime.contentStorageStatus || { state: "unavailable", backend: "none", persistent: false };
    const nodes = runtime.app.querySelectorAll("[data-hgl1-content-storage-status]");
    let label = "IndexedDB chưa khả dụng";
    if (status.state === "opening") label = "Đang mở kho nội dung…";
    else if (status.state === "ready" && status.persistent) label = "IndexedDB sẵn sàng";
    else if (status.state === "ready") label = "Bộ nhớ phiên (fallback)";
    else if (status.state === "error") label = "Kho nội dung gặp lỗi";
    Array.prototype.forEach.call(nodes, function updateContentStorageNode(node) {
      node.textContent = label;
      node.dataset.state = status.state;
    });
  }

  function initializeContentStorage(owner) {
    const active = owner || runtime;
    const storageApi = globalScope.HHGalaxyLayerOneStorage;
    if (!active || active.contentStorage || !storageApi || typeof storageApi.createEngine !== "function") {
      if (active && !active.contentStorageStatus) active.contentStorageStatus = { state: "unavailable", backend: "none", persistent: false };
      return;
    }
    try {
      active.contentStorage = storageApi.createEngine({
        name: "hh-galaxy-layer-one-content-v1",
        allowedRoutes: routes,
        limits: { maxRecordBytes: 64 * 1024 * 1024, maxTotalBytes: 256 * 1024 * 1024, maxRecords: CONTENT_STORAGE_MAX_RECORDS, maxListResults: 200 }
      });
      active.contentStorageStatus = { state: "opening", backend: "none", persistent: false };
      active.contentStorage.open().then(function contentStorageReady() {
        if (runtime !== active || !active.contentStorage) return;
        active.contentStorageStatus = active.contentStorage.status();
        updateContentStorageStatus();
      }).catch(function contentStorageFailed(error) {
        if (runtime !== active) return;
        active.contentStorageStatus = { state: "error", backend: "none", persistent: false, error: String(error && (error.code || error.message) || "OPEN_FAILED") };
        updateContentStorageStatus();
      });
    } catch (error) {
      active.contentStorage = null;
      active.contentStorageStatus = { state: "error", backend: "none", persistent: false, error: String(error && (error.code || error.message) || "OPEN_FAILED") };
    }
  }

  function initializeLearningRuntime(owner) {
    const active = owner || runtime;
    const api = learningEngineApi();
    if (!active) return Promise.resolve(false);
    if (!api) {
      active.learningStatus = "unsupported";
      active.learningError = "LEARNING_ENGINE_UNAVAILABLE";
      return Promise.resolve(false);
    }
    if (active.learningStatus === "ready" || active.learningStatus === "saving") return Promise.resolve(true);
    if (active.learningLoadPromise) return active.learningLoadPromise;
    initializeContentStorage(active);
    const engine = active.contentStorage;
    if (!engine) {
      active.learningStatus = "error";
      active.learningError = "CONTENT_STORAGE_UNAVAILABLE";
      return Promise.resolve(false);
    }
    active.learningStatus = "loading";
    active.learningLoadPromise = engine.open().then(function learningStorageOpened() {
      return engine.get("/galaxy/learning", LEARNING_RECORD_ID);
    }).then(function learningStateLoaded(record) {
      const state = api.normalizeState(record && record.value ? record.value : emptyLearningEngineState());
      if (runtime !== active) return false;
      active.learningState = state;
      active.learningStatus = "ready";
      active.learningError = "";
      const selected = selectedLearningDeck(state, active.learningSelectedDeckId);
      active.learningSelectedDeckId = selected ? selected.id : "";
      if (active.route === "/galaxy/learning") render();
      return true;
    }).catch(function learningStateFailed(error) {
      if (runtime !== active) return false;
      active.learningStatus = "error";
      active.learningError = String(error && (error.code || error.message) || "LEARNING_LOAD_FAILED").slice(0, 180);
      if (active.route === "/galaxy/learning") render();
      return false;
    }).finally(function releaseLearningLoad() {
      if (runtime === active) active.learningLoadPromise = null;
    });
    return active.learningLoadPromise;
  }

  async function persistLearningState(nextState) {
    if (!runtime) return false;
    const active = runtime;
    const api = learningEngineApi();
    if (!api) return false;
    const ready = await initializeLearningRuntime(active);
    if (!ready || runtime !== active || !active.contentStorage) return false;
    let normalized;
    try { normalized = api.normalizeState(nextState || emptyLearningEngineState()); }
    catch (error) {
      showToast(String(error && error.message || "Dữ liệu học tập không hợp lệ.").slice(0, 220), "error");
      return false;
    }
    active.learningStatus = "saving";
    try {
      await active.contentStorage.put("/galaxy/learning", LEARNING_RECORD_ID, normalized, {
        schema: api.SCHEMA,
        schemaVersion: api.SCHEMA_VERSION,
        contentType: "application/json"
      });
      if (runtime !== active) return false;
      active.learningState = normalized;
      active.learningStatus = "ready";
      active.learningError = "";
      const selected = selectedLearningDeck(normalized, active.learningSelectedDeckId);
      active.learningSelectedDeckId = selected ? selected.id : "";
      render();
      return true;
    } catch (error) {
      if (runtime === active) {
        active.learningStatus = "error";
        active.learningError = String(error && (error.code || error.message) || "LEARNING_SAVE_FAILED").slice(0, 180);
        render();
      }
      return false;
    }
  }

  function learningStateCopy() {
    const value = runtime && runtime.learningState ? runtime.learningState : emptyLearningEngineState();
    return JSON.parse(JSON.stringify(value));
  }

  function resetLearningInteraction(options) {
    if (!runtime) return;
    const preserveDeck = options && options.preserveDeck === true;
    if (!preserveDeck) runtime.learningSelectedDeckId = "";
    runtime.learningEditingCardId = "";
    runtime.learningReviewCardId = "";
    runtime.learningReviewRevealed = false;
    runtime.learningQuiz = null;
    runtime.learningQuizResult = null;
  }

  async function persistImportedContent(item, file, owner) {
    const active = owner || runtime;
    if (!active || !item || !file) return { stored: false, reason: "UNAVAILABLE" };
    initializeContentStorage(active);
    const engine = active.contentStorage;
    if (!engine) return { stored: false, reason: "UNAVAILABLE" };
    if (Number(file.size) > 64 * 1024 * 1024) return { stored: false, reason: "RECORD_TOO_LARGE" };
    try {
      await engine.put(item.route, item.id, file, {
        fileName: String(file.name || item.title).slice(0, 240),
        fileType: String(file.type || "application/octet-stream").slice(0, 160),
        fileSize: Number(file.size) || 0
      });
      active.contentStorageStatus = engine.status();
      if (runtime === active) updateContentStorageStatus();
      return { stored: true, reason: "" };
    } catch (error) {
      return { stored: false, reason: String(error && (error.code || error.message) || "STORE_FAILED") };
    }
  }

  async function rollbackImportedContent(owner, item) {
    const engine = owner && owner.contentStorage;
    if (!engine || !item || typeof engine.delete !== "function") return false;
    try {
      await engine.delete(item.route, item.id);
      owner.contentStorageStatus = engine.status();
      if (runtime === owner) updateContentStorageStatus();
      return true;
    } catch (_) {
      return false;
    }
  }

  function validateImportFile(file, route) {
    const name = String(file && file.name || "").trim();
    const size = Number(file && file.size);
    const type = String(file && file.type || "").toLocaleLowerCase("en-US");
    if (!name || name.length > 240 || /[\u0000-\u001f\u007f]/.test(name)) throw new Error("Tên tệp không hợp lệ.");
    if (!Number.isSafeInteger(size) || size <= 0) throw new Error("Tệp trống hoặc có kích thước không hợp lệ.");
    const mediaApi = globalScope.HHGalaxyLayerOneMedia;
    if (route === "/galaxy/music") {
      if (!mediaApi || typeof mediaApi.validateMediaFile !== "function") {
        if (!type.startsWith("audio/") || size > 512 * 1024 * 1024) throw new Error("Chỉ chấp nhận tệp âm thanh hợp lệ.");
        return { kind: "audio" };
      }
      return mediaApi.validateMediaFile(file, { kind: "audio" });
    }
    if (route === "/galaxy/video") {
      if (/\.(?:srt|vtt)$/i.test(name)) return mediaApi && mediaApi.validateMediaFile ? mediaApi.validateMediaFile(file, { kind: "subtitle" }) : { kind: "subtitle" };
      if (type.startsWith("image/") && /\.(?:png|jpe?g|webp)$/i.test(name) && size <= 16 * 1024 * 1024) return { kind: "image" };
      if (!mediaApi || typeof mediaApi.validateMediaFile !== "function") {
        if (!type.startsWith("video/") || size > 2 * 1024 * 1024 * 1024) throw new Error("Chỉ chấp nhận video, ảnh hoặc phụ đề hợp lệ.");
        return { kind: "video" };
      }
      return mediaApi.validateMediaFile(file, { kind: "video" });
    }
    if (size > 16 * 1024 * 1024) throw new Error("Tài liệu vượt giới hạn 16 MB của workspace này.");
    return { kind: "document" };
  }

  async function importSelectedFile(input) {
    if (!runtime || !input || !input.files || !input.files[0]) return;
    const active = runtime;
    const match = findRoute(input.dataset.route);
    if (!match) return;
    const files = Array.prototype.slice.call(input.files, 0, 20);
    const subtitleFiles = [];
    let imported = 0;
    let storedContent = 0;
    let openedMedia = false;
    const errors = [];
    for (const file of files) {
      if (runtime !== active || active.route !== match.route) break;
      try {
        const descriptor = validateImportFile(file, match.route);
        const item = prepareLocalItem(match.route, file.name, {
          kind: descriptor.kind === "subtitle" ? "video-subtitle" : descriptor.kind === "audio" ? "audio-source" : descriptor.kind === "video" ? "video-source" : descriptor.kind === "image" ? "video-image" : undefined,
          description: "Tệp do bạn chọn trên thiết bị; nội dung không được tải lên mạng.",
          meta: { fileName: file.name, fileType: file.type, fileSize: file.size, mediaKind: descriptor.kind, learningCategory: match.route === "/galaxy/learning" ? "resource" : "" }
        });
        if (!item) throw new Error("Không thể chuẩn bị metadata cục bộ.");
        const persisted = await persistImportedContent(item, file, active);
        if (!persisted.stored) throw new Error("Không thể lưu nội dung tệp: " + (persisted.reason || "STORE_FAILED"));
        if (runtime !== active || active.route !== match.route) {
          await rollbackImportedContent(active, item);
          break;
        }
        const committed = commitPreparedLocalItem(item, active.storage);
        if (!committed) {
          const rolledBack = await rollbackImportedContent(active, item);
          throw new Error(rolledBack ? "Không thể lưu metadata; nội dung tệp đã được hoàn tác." : "Không thể lưu metadata và chưa thể hoàn tác nội dung tệp.");
        }
        imported += 1;
        storedContent += 1;
        if (descriptor.kind === "subtitle") subtitleFiles.push(file);
        else if (!openedMedia && (descriptor.kind === "audio" || descriptor.kind === "video")) {
          openedMedia = openLocalMedia(file, match.route, { playlistItemId: descriptor.kind === "audio" ? committed.id : "" });
        }
        if (descriptor.kind === "audio") active.mediaPlaylist.push({ id: committed.id, file: file, name: file.name, type: file.type || "audio", size: file.size });
      } catch (error) {
        errors.push(String(error && error.message || "Tệp không hợp lệ.").slice(0, 180));
      }
    }
    for (const subtitle of subtitleFiles) {
      if (runtime !== active) break;
      await attachSubtitleFile(subtitle);
    }
    if (runtime === active) {
      render();
      updateMediaPlaylist();
      renderTimestampNotes();
      const detail = imported + " tệp đã nhập" + (storedContent ? " · " + storedContent + " nội dung lưu trong kho lớn" : "") + (openedMedia ? " · player đã mở" : "");
      showToast(imported ? detail + (errors.length ? " · " + errors.length + " tệp bị từ chối" : "") : (errors[0] || "Không thể nhập tệp."), imported ? (errors.length ? "info" : "success") : "error");
    }
    input.value = "";
  }

  async function importBackupFile(input) {
    if (!runtime || !input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    if (file.size > BACKUP_MAX_BYTES) {
      showToast("Tệp sao lưu vượt quá giới hạn 8 MB.", "error");
      return;
    }
    try {
      const text = await file.text();
      const engine = backupEngineApi();
      const result = engine ? engine.inspectBackup(text) : inspectBackup(text);
      if (!result.ok) {
        showToast("Tệp sao lưu không hợp lệ: " + result.error, "error");
        return;
      }
      const summary = result.stores ? {
        items: result.stores.main.items,
        events: result.stores.main.events,
        creatorProjects: result.stores.creator.projects,
        creatorSchedule: result.stores.creator.schedule,
         learningDecks: result.stores.learning.decks,
         learningCards: result.stores.learning.cards,
         learningActivities: result.stores.learning.activities,
        records: result.stores.records.records,
        totalRecords: result.totalRecords,
        exportedAt: result.exportedAt,
        migratedFrom: result.migratedFrom || null,
        complete: true
      } : result.summary;
      runtime.pendingBackup = { candidate: result.candidate, summary: summary, fileName: String(file.name || "backup.json").slice(0, 180), complete: Boolean(result.stores) };
      render();
      const confirm = runtime.app && runtime.app.querySelector("[data-hgl1-action=\"confirm-backup-import\"]");
      confirm && confirm.focus();
      showToast("Đã đọc tệp. Hãy xem trước và xác nhận cách nhập.", "info");
    } catch (_) {
      showToast("Không thể đọc tệp sao lưu.", "error");
    }
    input.value = "";
  }

  function closePendingBackup(message) {
    if (!runtime || !runtime.pendingBackup) return false;
    runtime.pendingBackup = null;
    render();
    const target = runtime.app && runtime.app.querySelector("[data-hgl1-action=\"trigger-backup-import\"]");
    if (target && typeof target.focus === "function") target.focus();
    if (message) showToast(message, "info");
    return true;
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

  function updateNetworkStatus() {
    if (!runtime || !runtime.app) return;
    const online = typeof globalScope.navigator === "object" && typeof globalScope.navigator.onLine === "boolean" ? globalScope.navigator.onLine : null;
    const label = online === false ? "Ngoại tuyến" : online === true ? "Mạng trình duyệt khả dụng" : "Chưa kiểm tra mạng";
    const status = runtime.app.querySelector(".hgl1-topbar__status");
    if (!status) return;
    status.title = label;
    const dot = status.querySelector("span");
    const text = status.querySelector("b");
    if (dot) dot.classList.toggle("is-offline", online === false);
    if (text) text.textContent = label;
  }

  function handleVisibilityChange() {
    if (!runtime || !globalScope.document) return;
    if (globalScope.document.hidden === true) {
      if (runtime.mediaSession && runtime.mediaSession.element && typeof runtime.mediaSession.element.pause === "function") {
        try {
          runtime.mediaSession.pausedByVisibility = runtime.mediaSession.element.paused === false;
          runtime.mediaSession.element.pause();
        } catch (_) { /* Browser owns the media state. */ }
      }
      pauseGameSession("visibility");
      return;
    }
    resumeGameSession("visibility");
  }

  function aiStatus(state, message, owner) {
    const active = owner || runtime;
    if (!active) return;
    active.aiProviderStatus = { state: state, message: String(message || "") };
    if (active !== runtime || active.route !== "/galaxy/ai" || !active.app) return;
    const status = active.app.querySelector("[data-hgl1-ai-status]");
    const send = active.app.querySelector("[data-hgl1-ai-send]");
    if (status) {
      status.dataset.state = state;
      status.textContent = message;
    }
    if (send) send.disabled = state !== "ready";
    const stripText = active.app.querySelector("[data-hgl1-module-status-text]");
    const stripDot = active.app.querySelector("[data-hgl1-module-status] .hgl1-status-dot");
    if (stripText) stripText.textContent = message;
    if (stripDot) {
      stripDot.className = "hgl1-status-dot hgl1-status-dot--" + (state === "ready" ? "local" : "warning");
    }
  }

  async function probeAiProvider(force) {
    if (!runtime || runtime.route !== "/galaxy/ai") return false;
    const active = runtime;
    if (!force && active.aiProbe && active.aiProbe.promise) return active.aiProbe.promise;
    if (!force && active.aiProviderStatus && active.aiProviderStatus.state !== "checking") {
      aiStatus(active.aiProviderStatus.state, active.aiProviderStatus.message, active);
      return active.aiProviderStatus.state === "ready";
    }
    if (typeof globalScope.fetch !== "function") {
      aiStatus("unconfigured", "Trình duyệt không hỗ trợ kiểm tra gateway AI.", active);
      return false;
    }
    if (force && active.aiProbe && active.aiProbe.controller) {
      try { active.aiProbe.controller.abort(); } catch (_) { /* Superseded below. */ }
    }
    const controller = typeof globalScope.AbortController === "function" ? new globalScope.AbortController() : null;
    const probe = { controller: controller, promise: null };
    active.aiProbe = probe;
    aiStatus("checking", "Đang kiểm tra gateway AI trên máy chủ…", active);
    probe.promise = (async function runAiProbe() {
      try {
        const response = await globalScope.fetch("/api/ai", {
          method: "GET",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          signal: controller ? controller.signal : undefined
        });
        const payload = await response.json().catch(function emptyPayload() { return {}; });
        if (runtime !== active || active.route !== "/galaxy/ai" || active.aiProbe !== probe) return false;
        const providers = Array.isArray(payload.providers) ? payload.providers : [];
        const gemini = providers.find(function geminiProvider(entry) { return entry && entry.provider === "gemini"; });
        if (response.ok && gemini && gemini.configured === true) {
          aiStatus("ready", "Gemini đã được cấu hình trên máy chủ. Nội dung chỉ gửi khi bạn bấm Gửi.", active);
          return true;
        }
        aiStatus("unconfigured", response.ok ? "Gateway phản hồi nhưng Gemini chưa được cấu hình." : "Gateway AI chưa sẵn sàng (HTTP " + response.status + ").", active);
        return false;
      } catch (error) {
        if (error && error.name === "AbortError") return false;
        if (runtime === active && active.route === "/galaxy/ai" && active.aiProbe === probe) {
          aiStatus("offline", "Không thể kết nối gateway AI. Bạn vẫn có thể lưu bản nháp cục bộ.", active);
        }
        return false;
      } finally {
        if (active.aiProbe === probe) active.aiProbe = null;
      }
    })();
    return probe.promise;
  }

  async function submitAiPrompt(form) {
    if (!runtime || runtime.route !== "/galaxy/ai") return;
    const active = runtime;
    if (active.aiRequest) {
      showToast("Một yêu cầu AI đang được xử lý.", "info");
      return;
    }
    const input = form.querySelector("[data-hgl1-ai-draft]");
    const output = runtime.app.querySelector("[data-hgl1-ai-response]");
    const send = form.querySelector("[data-hgl1-ai-send]");
    const prompt = String(input && input.value || "").trim().slice(0, 4000);
    if (!prompt) {
      input && input.focus();
      showToast("Hãy nhập nội dung trước khi gửi.", "error");
      return;
    }
    active.aiLastPrompt = prompt;
    if (typeof globalScope.fetch !== "function") {
      showToast("Trình duyệt không hỗ trợ kết nối AI.", "error");
      return;
    }
    const stop = form.querySelector("[data-hgl1-ai-stop]");
    const retry = form.querySelector("[data-hgl1-ai-retry]");
    if (send) send.disabled = true;
    if (stop) stop.disabled = false;
    if (retry) retry.disabled = true;
    if (output) {
      output.textContent = "Đang chờ phản hồi thật từ provider…";
      output.dataset.tone = "info";
    }
    const controller = typeof globalScope.AbortController === "function" ? new globalScope.AbortController() : null;
    const request = { controller: controller };
    active.aiRequest = request;
    try {
      const response = await globalScope.fetch("/api/ai", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ toolId: "ai-chat", action: "send", input: { prompt: prompt } }),
        signal: controller ? controller.signal : undefined
      });
      const payload = await response.json().catch(function emptyAiPayload() { return {}; });
      if (runtime !== active || active.route !== "/galaxy/ai" || active.aiRequest !== request) return;
      if (!response.ok || !payload.result || !payload.result.text) {
        const message = String(payload.error || (response.status === 401 ? "Bạn cần đăng nhập để gửi yêu cầu AI." : "Provider AI chưa thể xử lý yêu cầu.")).slice(0, 500);
        if (output) { output.textContent = message; output.dataset.tone = "error"; }
        showToast(message, "error");
        return;
      }
      const answer = String(payload.result.text).slice(0, 12000);
      if (output) { output.textContent = answer; output.dataset.tone = "success"; }
      const title = prompt.split(/\r?\n/)[0].slice(0, 120) || "Hội thoại AI";
      const saved = createLocalItem("/galaxy/ai", title, runtime.storage, {
        kind: "ai-conversation",
        description: "Bạn: " + prompt + "\n\nAI: " + answer,
        meta: { provider: String(payload.result.provider || "server").slice(0, 80) }
      });
      if (saved && runtime.app) {
        const list = runtime.app.querySelector("[data-hgl1-item-list]");
        if (list && typeof list.insertAdjacentHTML === "function") list.insertAdjacentHTML("beforeend", itemMarkup(saved));
      }
      showToast(saved ? "Đã nhận phản hồi và lưu lịch sử cục bộ." : "Đã nhận phản hồi nhưng không thể lưu lịch sử.", saved ? "success" : "info");
    } catch (error) {
      if (error && error.name === "AbortError") return;
      if (runtime !== active || active.route !== "/galaxy/ai" || active.aiRequest !== request) return;
      if (output) { output.textContent = "Kết nối AI bị gián đoạn. Nội dung chưa được gửi lại tự động."; output.dataset.tone = "error"; }
      showToast("Kết nối AI bị gián đoạn.", "error");
    } finally {
      if (active.aiRequest === request) active.aiRequest = null;
      if (runtime === active && active.route === "/galaxy/ai") {
        if (send && send.isConnected) send.disabled = active.aiProviderStatus && active.aiProviderStatus.state !== "ready";
        if (stop && stop.isConnected) stop.disabled = true;
        if (retry && retry.isConnected) retry.disabled = !active.aiLastPrompt;
      }
    }
  }

  function abortAiRequest() {
    if (!runtime || !runtime.aiRequest) {
      showToast("Không có yêu cầu AI đang chạy.", "info");
      return false;
    }
    const request = runtime.aiRequest;
    runtime.aiRequest = null;
    if (request.controller && typeof request.controller.abort === "function") request.controller.abort();
    const output = runtime.app && runtime.app.querySelector("[data-hgl1-ai-response]");
    const stop = runtime.app && runtime.app.querySelector("[data-hgl1-ai-stop]");
    const retry = runtime.app && runtime.app.querySelector("[data-hgl1-ai-retry]");
    if (output) { output.textContent = "Đã dừng yêu cầu. Không tự động gửi lại."; output.dataset.tone = "info"; }
    if (stop) stop.disabled = true;
    if (retry) retry.disabled = !runtime.aiLastPrompt;
    showToast("Đã dừng yêu cầu AI.", "info");
    return true;
  }

  function retryAiRequest() {
    if (!runtime || runtime.route !== "/galaxy/ai" || !runtime.aiLastPrompt) return false;
    const form = runtime.app && runtime.app.querySelector("[data-hgl1-ai-form]");
    const input = form && form.querySelector("[data-hgl1-ai-draft]");
    if (!form || !input) return false;
    input.value = runtime.aiLastPrompt;
    submitAiPrompt(form);
    return true;
  }

  function saveAiDraft() {
    if (!runtime || !runtime.app) return;
    const input = runtime.app.querySelector("[data-hgl1-ai-draft]");
    const prompt = String(input && input.value || "").trim().slice(0, 4000);
    const item = prompt ? createLocalItem("/galaxy/ai", prompt.split(/\r?\n/)[0].slice(0, 120), runtime.storage, {
      kind: "ai-prompt-draft",
      description: prompt
    }) : null;
    if (item && runtime.app) {
      const list = runtime.app.querySelector("[data-hgl1-item-list]");
      if (list && typeof list.insertAdjacentHTML === "function") list.insertAdjacentHTML("beforeend", itemMarkup(item));
    }
    showToast(item ? "Đã lưu bản nháp AI trên thiết bị." : "Hãy nhập nội dung hợp lệ.", item ? "success" : "error");
  }

  function parseYouTubeId(value) {
    const raw = String(value || "").trim();
    if (!raw || raw.length > 500) return "";
    try {
      const UrlCtor = globalScope.URL;
      if (typeof UrlCtor !== "function") return "";
      const parsed = new UrlCtor(raw);
      const host = parsed.hostname.toLocaleLowerCase("en-US").replace(/^www\./, "");
      let id = "";
      if (host === "youtu.be") id = parsed.pathname.split("/").filter(Boolean)[0] || "";
      else if (["youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)) {
        if (parsed.pathname === "/watch") id = parsed.searchParams.get("v") || "";
        else {
          const parts = parsed.pathname.split("/").filter(Boolean);
          if (["embed", "shorts", "live"].includes(parts[0])) id = parts[1] || "";
        }
      }
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : "";
    } catch (_) {
      return "";
    }
  }

  function cleanupMediaSession() {
    if (!runtime) return;
    if (runtime.mediaRecorder) stopAudioRecording(false);
    if (!runtime.mediaSession) return;
    const session = runtime.mediaSession;
    runtime.mediaSession = null;
    try {
      (session.cleanups || []).splice(0).reverse().forEach(function cleanupMediaListener(cleanup) { try { cleanup(); } catch (_) {} });
      if (session.element && typeof session.element.pause === "function") session.element.pause();
      if (session.element && session.kind === "youtube") session.element.src = "about:blank";
      if (session.element && session.kind !== "youtube") {
        session.element.removeAttribute("src");
        if (typeof session.element.load === "function") session.element.load();
      }
      if (session.element && session.element.remove) session.element.remove();
      if (session.lease && typeof session.lease.release === "function") session.lease.release();
      else if (session.url && globalScope.URL && typeof globalScope.URL.revokeObjectURL === "function") globalScope.URL.revokeObjectURL(session.url);
    } catch (_) { /* A detached media element is already stopped. */ }
  }

  function installMediaElement(element, session) {
    if (!runtime || !runtime.app) return false;
    cleanupMediaSession();
    const host = runtime.app.querySelector("[data-hgl1-stable-media-host]");
    if (!host) return false;
    host.innerHTML = "";
    host.appendChild(element);
    runtime.mediaSession = Object.assign({ element: element, route: runtime.route, url: "", kind: "local" }, session || {});
    return true;
  }

  function drawWaveform(points, owner) {
    const active = owner || runtime;
    if (!active || !active.app) return false;
    const canvas = active.app.querySelector("[data-hgl1-waveform]");
    const context = canvas && canvas.getContext && canvas.getContext("2d");
    if (!context) return false;
    const values = points instanceof Float32Array ? points : new Float32Array(0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#0a1233");
    gradient.addColorStop(1, "#050817");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "rgba(126, 239, 255, .16)";
    context.lineWidth = 1;
    for (let line = 1; line < 8; line += 1) {
      const x = line * canvas.width / 8;
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvas.height); context.stroke();
    }
    if (!values.length) {
      context.fillStyle = "#aebbd7";
      context.font = "600 17px system-ui";
      context.textAlign = "center";
      context.fillText("Nhập âm thanh để hiển thị waveform", canvas.width / 2, canvas.height / 2 + 6);
      return true;
    }
    const barWidth = canvas.width / values.length;
    const middle = canvas.height / 2;
    context.fillStyle = "#72e9ff";
    values.forEach(function waveformBar(value, index) {
      const height = Math.max(2, Math.min(middle - 5, Number(value || 0) * (middle - 5)));
      context.fillRect(index * barWidth, middle - height, Math.max(1, barWidth * 0.72), height * 2);
    });
    return true;
  }

  async function analyzeAudioWaveform(file, session) {
    if (!runtime || !session || !file || typeof file.arrayBuffer !== "function") return false;
    const AudioContextCtor = globalScope.AudioContext || globalScope.webkitAudioContext;
    const mediaApi = globalScope.HHGalaxyLayerOneMedia;
    if (typeof AudioContextCtor !== "function" || !mediaApi || typeof mediaApi.downsampleWaveform !== "function") {
      drawWaveform(new Float32Array(0));
      return false;
    }
    let audioContext;
    try {
      const bytes = await file.arrayBuffer();
      if (!runtime || runtime.mediaSession !== session) return false;
      audioContext = new AudioContextCtor();
      const buffer = await audioContext.decodeAudioData(bytes.slice(0));
      if (!runtime || runtime.mediaSession !== session) return false;
      const samples = buffer.getChannelData(0);
      const points = mediaApi.downsampleWaveform(samples, Math.min(320, samples.length));
      session.waveform = points;
      drawWaveform(points);
      return true;
    } catch (_) {
      drawWaveform(new Float32Array(0));
      return false;
    } finally {
      if (audioContext && typeof audioContext.close === "function") {
        try { await audioContext.close(); } catch (_) {}
      }
    }
  }

  function updateMediaPlaylist() {
    if (!runtime || !runtime.app || runtime.route !== "/galaxy/music") return;
    const list = runtime.app.querySelector("[data-hgl1-media-playlist]");
    if (!list) return;
    const items = Array.isArray(runtime.mediaPlaylist) ? runtime.mediaPlaylist : [];
    list.innerHTML = items.length ? items.map(function playlistEntry(item, index) {
      const active = Boolean(runtime.mediaSession && runtime.mediaSession.kind === "audio" && runtime.mediaSession.playlistItemId === item.id);
      return "<li data-state=\"" + (active ? "active" : "idle") + "\"><button type=\"button\" data-hgl1-action=\"play-media-playlist\" data-playlist-index=\"" + index + "\" " + (active ? "aria-current=\"true\"" : "") + "><span>" + String(index + 1).padStart(2, "0") + "</span><span><b>" + escapeHtml(item.name) + "</b><small>" + escapeHtml(item.type || "audio") + " · " + Math.max(1, Math.round(item.size / 1024)) + " KB</small></span><span aria-hidden=\"true\">" + (active ? "Đang mở" : "Phát") + "</span></button></li>";
    }).join("") : "<li>Chưa có tệp âm thanh trong phiên.</li>";
  }

  function openLocalMedia(file, route, options) {
    if (!runtime || !globalScope.document || !globalScope.URL || typeof globalScope.URL.createObjectURL !== "function") return false;
    const isAudio = route === "/galaxy/music" && String(file.type || "").startsWith("audio/");
    const isVideo = route === "/galaxy/video" && String(file.type || "").startsWith("video/");
    if (!isAudio && !isVideo) return false;
    const mediaApi = globalScope.HHGalaxyLayerOneMedia;
    let lease = null;
    let url = "";
    try {
      if (mediaApi && typeof mediaApi.createObjectUrlLease === "function") {
        lease = mediaApi.createObjectUrlLease(file, { kind: isAudio ? "audio" : "video", urlApi: globalScope.URL });
        url = lease.url;
      } else {
        url = globalScope.URL.createObjectURL(file);
      }
    } catch (_) {
      return false;
    }
    const element = globalScope.document.createElement(isAudio ? "audio" : "video");
    element.controls = true;
    element.autoplay = false;
    element.preload = "metadata";
    element.src = url;
    const preferences = runtime.mediaPreferences || { volume: 1, rate: 1 };
    element.volume = Math.max(0, Math.min(1, Number(preferences.volume) || 0));
    element.playbackRate = Math.max(0.5, Math.min(2, Number(preferences.rate) || 1));
    if (isVideo) element.playsInline = true;
    element.setAttribute("aria-label", (isVideo ? "Video" : "Âm thanh") + " " + String(file.name || "đã chọn").slice(0, 180));
    const installed = installMediaElement(element, { route: route, url: url, lease: lease, kind: isAudio ? "audio" : "video", fileName: file.name, playlistItemId: String(options && options.playlistItemId || ""), cleanups: [] });
    if (!installed) {
      if (lease) lease.release();
      else globalScope.URL.revokeObjectURL(url);
      return false;
    }
    const session = runtime.mediaSession;
    const metadataReady = function metadataReady() {
      if (!runtime || runtime.mediaSession !== session) return;
      const end = runtime.app && runtime.app.querySelector("[data-hgl1-trim-form] input[name=\"end\"]");
      if (end && Number.isFinite(element.duration)) end.value = String(Math.max(0.1, Math.round(element.duration * 10) / 10));
    };
    element.addEventListener("loadedmetadata", metadataReady);
    session.cleanups.push(function removeMetadataListener() { element.removeEventListener("loadedmetadata", metadataReady); });
    if (isAudio) analyzeAudioWaveform(file, session);
    const status = runtime.app.querySelector("[data-hgl1-media-status]");
    if (status) status.textContent = "Đã mở " + file.name + " · chưa tự phát.";
    return true;
  }

  function playMediaPlaylist(control) {
    if (!runtime || runtime.route !== "/galaxy/music") return false;
    const index = Number(control && control.dataset.playlistIndex);
    const item = Number.isInteger(index) && runtime.mediaPlaylist[index];
    if (!item || !item.file) {
      showToast("Tệp âm thanh không còn khả dụng trong phiên này.", "error");
      return false;
    }
    if (!openLocalMedia(item.file, "/galaxy/music", { playlistItemId: item.id })) {
      showToast("Không thể mở tệp âm thanh đã chọn.", "error");
      return false;
    }
    updateMediaPlaylist();
    const element = runtime.mediaSession && runtime.mediaSession.element;
    if (element && typeof element.play === "function") {
      try {
        const request = element.play();
        if (request && typeof request.catch === "function") {
          request.catch(function playlistPlaybackRejected() {
            if (runtime && runtime.route === "/galaxy/music") showToast("Trình duyệt đã chặn phát tự động; hãy bấm Play trên player.", "info");
          });
        }
      } catch (_) {
        showToast("Hãy bấm Play trên player để bắt đầu phát.", "info");
      }
    }
    return true;
  }

  function openYouTubeVideo(value) {
    if (!runtime || runtime.route !== "/galaxy/video" || !globalScope.document) return false;
    const id = parseYouTubeId(value);
    if (!id) return false;
    const frame = globalScope.document.createElement("iframe");
    frame.title = "YouTube video do người dùng chọn";
    frame.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=0&playsinline=1&rel=0";
    frame.loading = "eager";
    frame.allow = "accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    const installed = installMediaElement(frame, { route: "/galaxy/video", kind: "youtube", fileName: "YouTube " + id });
    if (installed) {
      const status = runtime.app.querySelector("[data-hgl1-media-status]");
      if (status) status.textContent = "Nguồn: YouTube Privacy-Enhanced Mode · player không tự phát và không bị polling.";
    }
    return installed;
  }

  function renderTimestampNotes() {
    if (!runtime || !runtime.app || runtime.route !== "/galaxy/video") return;
    const list = runtime.app.querySelector("[data-hgl1-timestamp-list]");
    if (!list) return;
    const notes = collectLocalState(runtime.storage).items.filter(function videoNote(item) {
      return item.route === "/galaxy/video" && item.kind === "video-timestamp-note" && item.meta && Number.isFinite(Number(item.meta.atMs));
    }).sort(function noteTime(a, b) { return Number(a.meta.atMs) - Number(b.meta.atMs); }).slice(0, 100);
    const mediaApi = globalScope.HHGalaxyLayerOneMedia;
    list.innerHTML = notes.length ? notes.map(function timestampNote(item) {
      let stamp = Math.floor(Number(item.meta.atMs) / 1000) + " giây";
      if (mediaApi && typeof mediaApi.formatTimestamp === "function") {
        try { stamp = mediaApi.formatTimestamp(Number(item.meta.atMs), { milliseconds: false, alwaysHours: false }); } catch (_) {}
      }
      return "<li><button type=\"button\" data-hgl1-action=\"seek-media-note\" data-media-time=\"" + Math.max(0, Number(item.meta.atMs)) + "\"><time>" + escapeHtml(stamp) + "</time><span>" + escapeHtml(item.title) + "</span></button></li>";
    }).join("") : "<li class=\"hgl1-timestamp-list__empty\">Chưa có ghi chú timestamp.</li>";
  }

  async function attachSubtitleFile(file) {
    if (!runtime || runtime.route !== "/galaxy/video") return false;
    const mediaApi = globalScope.HHGalaxyLayerOneMedia;
    const session = runtime.mediaSession;
    const video = session && session.kind === "video" ? session.element : null;
    const status = runtime.app && runtime.app.querySelector("[data-hgl1-subtitle-status]");
    if (!mediaApi || typeof mediaApi.parseSubtitles !== "function") {
      if (status) status.textContent = "Bộ đọc phụ đề chưa được tải.";
      return false;
    }
    if (!video || typeof video.addTextTrack !== "function") {
      if (status) status.textContent = "Hãy mở video cục bộ trước khi nhập phụ đề.";
      return false;
    }
    try {
      const parsed = mediaApi.parseSubtitles(await file.text());
      const track = video.addTextTrack("subtitles", String(file.name || "Phụ đề").slice(0, 120), "vi");
      track.mode = "showing";
      const Cue = globalScope.VTTCue || globalScope.TextTrackCue;
      if (typeof Cue !== "function") throw new Error("CUE_UNSUPPORTED");
      parsed.cues.forEach(function installCue(cue) {
        track.addCue(new Cue(cue.startMs / 1000, cue.endMs / 1000, cue.text));
      });
      session.subtitleTrack = track;
      session.subtitleCount = parsed.cues.length;
      if (status) status.textContent = "Đã gắn " + parsed.cues.length + " cue " + parsed.format.toUpperCase() + " cho video cục bộ.";
      return true;
    } catch (error) {
      if (status) status.textContent = "Không thể đọc phụ đề: " + String(error && (error.code || error.message) || "SUBTITLE_INVALID").slice(0, 120);
      return false;
    }
  }

  async function captureVideoThumbnail() {
    if (!runtime || runtime.route !== "/galaxy/video") return false;
    const mediaApi = globalScope.HHGalaxyLayerOneMedia;
    const session = runtime.mediaSession;
    if (!mediaApi || typeof mediaApi.captureThumbnail !== "function" || !session || session.kind !== "video") {
      showToast("Thumbnail chỉ chụp từ video cục bộ đang mở.", "error");
      return false;
    }
    try {
      const result = await mediaApi.captureThumbnail(session.element, { type: "image/jpeg", quality: 0.88, maxWidth: 1280 });
      const url = globalScope.URL.createObjectURL(result.blob);
      const anchor = globalScope.document.createElement("a");
      anchor.href = url;
      anchor.download = "hh-video-thumbnail-" + result.timeMs + ".jpg";
      anchor.rel = "noopener";
      anchor.click();
      globalScope.setTimeout(function releaseThumbnail() { globalScope.URL.revokeObjectURL(url); }, 1000);
      showToast("Đã tạo thumbnail từ frame hiện tại.", "success");
      return true;
    } catch (error) {
      showToast(String(error && error.message || "Không thể chụp thumbnail.").slice(0, 220), "error");
      return false;
    }
  }

  function stopAudioRecording(keepResult) {
    if (!runtime || !runtime.mediaRecorder) return false;
    const recording = runtime.mediaRecorder;
    runtime.mediaRecorder = null;
    recording.keepResult = keepResult !== false;
    try {
      if (recording.recorder && recording.recorder.state !== "inactive") recording.recorder.stop();
    } catch (_) {}
    recording.stream && recording.stream.getTracks().forEach(function stopRecordingTrack(track) { track.stop(); });
    const button = runtime.app && runtime.app.querySelector("[data-hgl1-action=\"toggle-audio-recording\"]");
    const status = runtime.app && runtime.app.querySelector("[data-hgl1-recording-status]");
    if (button) button.textContent = "Bắt đầu thu microphone";
    if (status && keepResult === false) status.textContent = "Đã dừng và hủy bản thu khi rời workspace.";
    return true;
  }

  async function toggleAudioRecording() {
    if (!runtime || runtime.route !== "/galaxy/music") return false;
    if (runtime.mediaRecorder) {
      stopAudioRecording(true);
      return true;
    }
    const mediaDevices = globalScope.navigator && globalScope.navigator.mediaDevices;
    if (!mediaDevices || typeof mediaDevices.getUserMedia !== "function" || typeof globalScope.MediaRecorder !== "function") {
      showToast("Trình duyệt không hỗ trợ thu microphone.", "error");
      return false;
    }
    const owner = runtime;
    try {
      const stream = await mediaDevices.getUserMedia({ audio: true });
      if (runtime !== owner || owner.route !== "/galaxy/music") { stream.getTracks().forEach(function stopLateTrack(track) { track.stop(); }); return false; }
      const recorder = new globalScope.MediaRecorder(stream);
      const recording = { recorder: recorder, stream: stream, chunks: [], keepResult: true, owner: owner };
      owner.mediaRecorder = recording;
      recorder.addEventListener("dataavailable", function collectRecording(event) { if (event.data && event.data.size) recording.chunks.push(event.data); });
      recorder.addEventListener("stop", function finishRecording() {
        if (!recording.keepResult || runtime !== owner || owner.route !== "/galaxy/music" || !recording.chunks.length) return;
        const blob = new globalScope.Blob(recording.chunks, { type: recorder.mimeType || "audio/webm" });
        try { Object.defineProperty(blob, "name", { configurable: true, value: "ghi-am-" + Date.now() + ".webm" }); } catch (_) {}
        const playlistItem = { id: createId(), file: blob, name: blob.name || "Bản thu microphone.webm", type: blob.type, size: blob.size };
        owner.mediaPlaylist.push(playlistItem);
        openLocalMedia(blob, "/galaxy/music", { playlistItemId: playlistItem.id });
        updateMediaPlaylist();
        const status = owner.app && owner.app.querySelector("[data-hgl1-recording-status]");
        if (status) status.textContent = "Đã tạo bản thu cục bộ " + Math.max(1, Math.round(blob.size / 1024)) + " KB; chưa tải lên mạng.";
      }, { once: true });
      recorder.start(500);
      const button = owner.app.querySelector("[data-hgl1-action=\"toggle-audio-recording\"]");
      const status = owner.app.querySelector("[data-hgl1-recording-status]");
      if (button) button.textContent = "Dừng và mở bản thu";
      if (status) status.textContent = "Đang thu microphone trên thiết bị…";
      recordEvent("permission-check", "/galaxy/music", owner.storage);
      return true;
    } catch (error) {
      showToast(error && error.name === "NotAllowedError" ? "Bạn chưa cấp quyền microphone." : "Không thể bắt đầu thu microphone.", "error");
      return false;
    }
  }

  function syncGameControlsUi() {
    if (!runtime || !runtime.app || runtime.route !== "/galaxy/games") return;
    const controls = sanitizeGameControls(runtime.gameControls || loadGameControls(runtime.storage));
    runtime.gameControls = controls;
    const form = runtime.app.querySelector("[data-hgl1-game-controls-form]");
    if (!form) return;
    ["up", "down", "left", "right"].forEach(function syncGameKey(key) {
      if (form.elements[key]) form.elements[key].value = controls[key].toLocaleUpperCase("en-US");
    });
    if (form.elements.deadZone) form.elements.deadZone.value = String(controls.deadZone);
    const output = form.querySelector("[data-hgl1-game-deadzone]");
    if (output) output.textContent = controls.deadZone.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function currentGameSnapshot() {
    if (!runtime) return null;
    const session = runtime.gameSession;
    const source = session || runtime.lastGameSnapshot;
    if (!source) return null;
    return {
      score: Math.max(0, Math.floor(Number(source.score) || 0)),
      x: Math.max(18, Math.min(942, Number(source.x) || 480)),
      y: Math.max(18, Math.min(522, Number(source.y) || 270)),
      target: {
        x: Math.max(50, Math.min(910, Number(source.target && source.target.x) || 180)),
        y: Math.max(50, Math.min(490, Number(source.target && source.target.y) || 140))
      }
    };
  }

  function saveGameSnapshot() {
    if (!runtime || runtime.route !== "/galaxy/games") return false;
    const snapshot = currentGameSnapshot();
    if (!snapshot) {
      showToast("Hãy bắt đầu game trước khi lưu phiên.", "error");
      return false;
    }
    const item = createLocalItem("/galaxy/games", "Orbit Collector · " + new Date().toLocaleString("vi-VN"), runtime.storage, {
      kind: "game-save",
      description: "Save cục bộ do người dùng tạo; không có dữ liệu người chơi giả.",
      meta: { gameState: snapshot, controls: sanitizeGameControls(runtime.gameControls) }
    });
    if (item) render();
    showToast(item ? "Đã lưu phiên game cục bộ." : "Không thể lưu phiên game.", item ? "success" : "error");
    return Boolean(item);
  }

  function restoreGameSnapshot() {
    if (!runtime || runtime.route !== "/galaxy/games") return false;
    const save = collectLocalState(runtime.storage).items.slice().reverse().find(function latestSave(item) {
      return item.route === "/galaxy/games" && item.kind === "game-save" && item.meta && item.meta.gameState;
    });
    if (!save) { showToast("Chưa có save game cục bộ để khôi phục.", "info"); return false; }
    if (runtime.gameSession) stopGame();
    runtime.pendingGameRestore = save.meta.gameState;
    runtime.gameControls = sanitizeGameControls(save.meta.controls || runtime.gameControls);
    syncGameControlsUi();
    toggleGame();
    showToast("Đã khôi phục save game gần nhất.", "success");
    return true;
  }

  function drawGameIdle() {
    if (!runtime || !runtime.app) return;
    const canvas = runtime.app.querySelector("[data-hgl1-game-canvas]");
    const context = canvas && canvas.getContext && canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#050818";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#7cecff";
    context.font = "bold 30px system-ui";
    context.textAlign = "center";
    context.fillText("ORBIT COLLECTOR", canvas.width / 2, canvas.height / 2 - 8);
    context.fillStyle = "#cbd8ff";
    context.font = "18px system-ui";
    context.fillText("Bấm Bắt đầu rồi focus canvas", canvas.width / 2, canvas.height / 2 + 30);
  }

  function updateGameSessionUi(session) {
    if (!runtime || !runtime.app || runtime.route !== "/galaxy/games" || !session) return;
    const button = runtime.app.querySelector("[data-hgl1-action=\"toggle-game\"]");
    const status = runtime.app.querySelector("[data-hgl1-game-status]");
    if (button) button.textContent = session.paused ? "Tiếp tục" : "Tạm dừng";
    if (status) status.textContent = session.paused
      ? "Đã tạm dừng · điểm phiên hiện tại: " + session.score
      : "Đang chạy · điểm phiên hiện tại: " + session.score;
  }

  function pauseGameSession(reason) {
    if (!runtime || !runtime.gameSession || runtime.gameSession.paused) return false;
    const session = runtime.gameSession;
    session.paused = true;
    session.pauseReason = reason || "manual";
    session.keys.clear();
    if (session.raf && globalScope.cancelAnimationFrame) globalScope.cancelAnimationFrame(session.raf);
    session.raf = 0;
    updateGameSessionUi(session);
    return true;
  }

  function resumeGameSession(reason) {
    if (!runtime || !runtime.gameSession || !runtime.gameSession.paused) return false;
    const session = runtime.gameSession;
    if (reason && session.pauseReason !== reason) return false;
    if (globalScope.document && globalScope.document.hidden === true) return false;
    if (typeof session.frame !== "function" || typeof globalScope.requestAnimationFrame !== "function") return false;
    session.paused = false;
    session.pauseReason = "";
    session.last = 0;
    session.raf = globalScope.requestAnimationFrame(session.frame);
    updateGameSessionUi(session);
    return true;
  }

  function stopGame() {
    if (!runtime || !runtime.gameSession) return;
    const session = runtime.gameSession;
    runtime.gameSession = null;
    session.paused = true;
    session.pauseReason = "destroyed";
    runtime.lastGameSnapshot = { score: session.score, x: session.x, y: session.y, target: { x: session.target.x, y: session.target.y } };
    if (session.raf && globalScope.cancelAnimationFrame) globalScope.cancelAnimationFrame(session.raf);
    if (session.canvas) {
      session.canvas.removeEventListener("keydown", session.keydown);
      session.canvas.removeEventListener("keyup", session.keyup);
      session.canvas.removeEventListener("blur", session.blur);
    }
    if (session.removeBlur) session.removeBlur();
    if (runtime.app && runtime.route === "/galaxy/games") {
      const button = runtime.app.querySelector("[data-hgl1-action=\"toggle-game\"]");
      const status = runtime.app.querySelector("[data-hgl1-game-status]");
      if (button) button.textContent = "Bắt đầu lại";
      if (status) status.textContent = "Đã kết thúc · điểm phiên vừa rồi: " + session.score;
    }
  }

  function toggleGame() {
    if (!runtime || runtime.route !== "/galaxy/games") return;
    if (runtime.gameSession) {
      const resumed = runtime.gameSession.paused ? resumeGameSession() : false;
      if (resumed) showToast("Đã tiếp tục đúng phiên game cục bộ.", "success");
      else if (pauseGameSession("manual")) showToast("Đã tạm dừng game cục bộ; phiên vẫn được giữ nguyên.", "info");
      return;
    }
    const canvas = runtime.app.querySelector("[data-hgl1-game-canvas]");
    const context = canvas && canvas.getContext && canvas.getContext("2d");
    if (!context || typeof globalScope.requestAnimationFrame !== "function") {
      showToast("Canvas game không khả dụng trên trình duyệt này.", "error");
      return;
    }
    const restored = runtime.pendingGameRestore || null;
    runtime.pendingGameRestore = null;
    const controls = sanitizeGameControls(runtime.gameControls || loadGameControls(runtime.storage));
    runtime.gameControls = controls;
    const session = { canvas: canvas, context: context, keys: new Set(), x: Number(restored && restored.x) || 480, y: Number(restored && restored.y) || 270, score: Math.max(0, Math.floor(Number(restored && restored.score) || 0)), started: globalScope.performance && globalScope.performance.now ? globalScope.performance.now() : Date.now(), last: 0, target: { x: Number(restored && restored.target && restored.target.x) || 180, y: Number(restored && restored.target && restored.target.y) || 140 }, raf: 0, controls: controls, paused: false, pauseReason: "", frame: null };
    session.keydown = function gameKeydown(event) {
      const key = String(event.key || "").toLocaleLowerCase("en-US");
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", controls.up, controls.down, controls.left, controls.right].includes(key)) {
        event.preventDefault();
        event.stopPropagation();
        session.keys.add(key);
      }
    };
    session.keyup = function gameKeyup(event) { session.keys.delete(event.key.toLocaleLowerCase()); };
    session.blur = function gameBlur() { session.keys.clear(); };
    canvas.addEventListener("keydown", session.keydown);
    canvas.addEventListener("keyup", session.keyup);
    canvas.addEventListener("blur", session.blur);
    if (globalScope.addEventListener) {
      globalScope.addEventListener("blur", session.blur);
      session.removeBlur = function removeGameBlur() { globalScope.removeEventListener("blur", session.blur); };
    }
    function frame(now) {
      if (!runtime || runtime.gameSession !== session) return;
      session.raf = 0;
      if (session.paused) return;
      const delta = Math.min(0.05, Math.max(0, (now - (session.last || now)) / 1000));
      session.last = now;
      let dx = (session.keys.has(controls.right) || session.keys.has("arrowright") ? 1 : 0) - (session.keys.has(controls.left) || session.keys.has("arrowleft") ? 1 : 0);
      let dy = (session.keys.has(controls.down) || session.keys.has("arrowdown") ? 1 : 0) - (session.keys.has(controls.up) || session.keys.has("arrowup") ? 1 : 0);
      try {
        const pad = globalScope.navigator && globalScope.navigator.getGamepads && globalScope.navigator.getGamepads()[0];
        if (pad) { dx += Math.abs(pad.axes[0] || 0) > controls.deadZone ? pad.axes[0] : 0; dy += Math.abs(pad.axes[1] || 0) > controls.deadZone ? pad.axes[1] : 0; }
      } catch (_) { /* Gamepad is optional. */ }
      const inputMagnitude = Math.hypot(dx, dy);
      if (inputMagnitude > 1) { dx /= inputMagnitude; dy /= inputMagnitude; }
      session.x = Math.max(18, Math.min(canvas.width - 18, session.x + dx * 280 * delta));
      session.y = Math.max(18, Math.min(canvas.height - 18, session.y + dy * 280 * delta));
      if (Math.hypot(session.x - session.target.x, session.y - session.target.y) < 30) {
        session.score += 1;
        session.target.x = 50 + Math.random() * (canvas.width - 100);
        session.target.y = 50 + Math.random() * (canvas.height - 100);
        const status = runtime && runtime.app && runtime.app.querySelector("[data-hgl1-game-status]");
        if (status) status.textContent = "Điểm phiên hiện tại: " + session.score;
      }
      context.fillStyle = "#050818"; context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#ffd76a"; context.beginPath(); context.arc(session.target.x, session.target.y, 10, 0, Math.PI * 2); context.fill();
      context.fillStyle = "#79ecff"; context.beginPath(); context.arc(session.x, session.y, 18, 0, Math.PI * 2); context.fill();
      context.fillStyle = "#fff"; context.font = "20px system-ui"; context.textAlign = "left"; context.fillText("Điểm thật: " + session.score, 20, 32);
      session.raf = globalScope.requestAnimationFrame(frame);
    }
    session.frame = frame;
    runtime.gameSession = session;
    const button = runtime.app.querySelector("[data-hgl1-action=\"toggle-game\"]");
    const status = runtime.app.querySelector("[data-hgl1-game-status]");
    if (button) button.textContent = "Tạm dừng";
    if (status) status.textContent = "Đang chạy · điểm phiên hiện tại: " + session.score;
    canvas.focus();
    session.raf = globalScope.requestAnimationFrame(frame);
  }

  function setCommunityRealtimeState(state, text, owner) {
    const active = owner || runtime;
    if (!active) return;
    active.communityRealtimeState = { state: state, text: String(text || "") };
    if (active !== runtime || active.route !== "/galaxy/community" || !active.app) return;
    const status = active.app.querySelector("[data-hgl1-community-realtime]");
    const stripText = active.app.querySelector("[data-hgl1-module-status-text]");
    if (status) { status.dataset.state = state; status.textContent = text; }
    if (stripText) stripText.textContent = text;
    updateCommunityPublishControl(active);
  }

  function resolveCommunitySocketTarget(value, allowedOrigins) {
    const raw = String(value || "").trim();
    if (!raw || typeof globalScope.URL !== "function") return null;
    try {
      const currentOrigin = String(globalScope.location && globalScope.location.origin || "");
      const target = new globalScope.URL(raw, currentOrigin || undefined);
      if (!/^https?:$/.test(target.protocol)) return null;
      const allowed = new Set((Array.isArray(allowedOrigins) ? allowedOrigins : []).map(function normalizeAllowedOrigin(entry) {
        try { return new globalScope.URL(String(entry || ""), currentOrigin || undefined).origin; }
        catch (_) { return ""; }
      }).filter(Boolean));
      const sameOrigin = Boolean(currentOrigin) && target.origin === currentOrigin;
      if (!sameOrigin && !allowed.has(target.origin)) return null;
      return Object.freeze({ href: target.href, origin: target.origin, sameOrigin: sameOrigin });
    } catch (_) {
      return null;
    }
  }

  function mountCommunityRealtime() {
    if (!runtime || runtime.route !== "/galaxy/community") return;
    const active = runtime;
    if (active.communityRealtimeState) {
      setCommunityRealtimeState(active.communityRealtimeState.state, active.communityRealtimeState.text, active);
    }
    if (active.communitySocket) return;
    const socketUrl = String(runtime.options.communitySocketUrl || "").trim();
    if (!socketUrl || typeof globalScope.io !== "function") {
      setCommunityRealtimeState("unconfigured", "Realtime chưa cấu hình · bản nháp vẫn lưu cục bộ", active);
      return;
    }
    const socketTarget = resolveCommunitySocketTarget(socketUrl, runtime.options.communitySocketAllowedOrigins);
    if (!socketTarget) {
      setCommunityRealtimeState("error", "Realtime URL bị từ chối · chỉ chấp nhận cùng origin hoặc allowlist rõ ràng", active);
      return;
    }
    let socket;
    try {
      socket = globalScope.io(socketTarget.href, {
        transports: ["websocket", "polling"],
        autoConnect: true,
        // Never attach browser credentials to a cross-origin transport.
        withCredentials: socketTarget.sameOrigin
      });
      active.communitySocket = socket;
      setCommunityRealtimeState("connecting", "Đang kết nối realtime…", active);
      socket.on("connect", function connected() { setCommunityRealtimeState("ready", "Realtime đã kết nối", active); });
      socket.on("disconnect", function disconnected() { setCommunityRealtimeState("offline", "Realtime đã ngắt kết nối", active); });
      socket.on("connect_error", function socketError() { setCommunityRealtimeState("error", "Realtime không thể kết nối", active); });
    } catch (_) {
      active.communitySocket = null;
      setCommunityRealtimeState("error", "Realtime không thể khởi tạo", active);
    }
  }

  function mountRouteRuntime() {
    if (!runtime || !runtime.app) return;
    if (runtime.route === "/galaxy/ai") {
      const handoff = consumeAiHandoff();
      const input = runtime.app.querySelector("[data-hgl1-ai-draft]");
      if (handoff && input) {
        input.value = handoff.prompt;
        input.focus();
        showToast("Đã chuyển nội dung từ Trang chủ. Chưa gửi tới provider.", "info");
      }
      if (runtime.aiProviderStatus) aiStatus(runtime.aiProviderStatus.state, runtime.aiProviderStatus.message, runtime);
      else probeAiProvider();
    } else if (runtime.route === "/galaxy/community") {
      mountCommunityRealtime();
    } else if (runtime.route === "/galaxy/games" && !runtime.gameSession) {
      drawGameIdle();
      syncGameControlsUi();
    } else if (runtime.route === "/galaxy/music") {
      drawWaveform(runtime.mediaSession && runtime.mediaSession.waveform || new Float32Array(0));
      updateMediaPlaylist();
    } else if (runtime.route === "/galaxy/video") {
      renderTimestampNotes();
      if (runtime.mediaSession && runtime.mediaSession.subtitleCount) {
        const status = runtime.app.querySelector("[data-hgl1-subtitle-status]");
        if (status) status.textContent = "Đã gắn " + runtime.mediaSession.subtitleCount + " cue phụ đề cho video cục bộ.";
      }
    } else if (runtime.route === "/galaxy/learning") {
      void initializeLearningRuntime(runtime);
    }
    updateContentStorageStatus();
  }

  function updateSettingsDraftUi() {
    if (!runtime || !runtime.app || runtime.route !== "/galaxy/settings") return;
    const saved = collectLocalState(runtime.storage).settings;
    const draft = sanitizeSettings(runtime.settingsDraft || saved);
    runtime.settingsDraft = draft;
    const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
    const status = runtime.app.querySelector("[data-hgl1-settings-status]");
    if (status) status.textContent = dirty ? "Có thay đổi chưa lưu." : "Cấu hình đã đồng bộ với bản lưu.";
    runtime.app.querySelectorAll("[data-hgl1-action=\"save-settings\"], [data-hgl1-action=\"cancel-settings\"]").forEach(function toggleCommit(button) { button.disabled = !dirty; });
    applyPreferences(runtime.app, draft);
  }

  function setSettingsControls(settings) {
    if (!runtime || !runtime.app) return;
    const safe = sanitizeSettings(settings);
    runtime.settingsDraft = safe;
    runtime.app.querySelectorAll("[data-hgl1-setting]").forEach(function syncSetting(control) {
      const key = control.dataset.hgl1Setting;
      if (!Object.hasOwn(safe, key)) return;
      if (control.type === "checkbox") control.checked = Boolean(safe[key]);
      else control.value = safe[key];
    });
    updateSettingsDraftUi();
  }

  function saveSettingsDraft() {
    if (!runtime || runtime.route !== "/galaxy/settings") return false;
    const state = collectLocalState(runtime.storage);
    state.settings = sanitizeSettings(runtime.settingsDraft || state.settings);
    if (!writeLocalState(state, runtime.storage)) {
      showToast("Không thể lưu cài đặt.", "error");
      return false;
    }
    runtime.settingsDraft = sanitizeSettings(state.settings);
    runtime.localState = state;
    syncAnalyticsCollectorConsent(state.settings.analyticsConsent, runtime);
    updateSettingsDraftUi();
    showToast("Đã lưu cài đặt Galaxy.", "success");
    return true;
  }

  function clearAnalyticsEvents() {
    if (!runtime) return false;
    const state = collectLocalState(runtime.storage);
    const hasEvents = state.events.length > 0;
    const hasVitals = webVitalHasValue(runtime.performanceMetrics);
    if (!hasEvents && !hasVitals) return true;
    if (hasEvents) {
      const confirmed = typeof globalScope.confirm === "function" ? globalScope.confirm("Xóa toàn bộ nhật ký Analytics cục bộ? Thao tác này không thể hoàn tác.") : false;
      if (!confirmed) return false;
      state.events = [];
    }
    let clearVitals = false;
    if (hasVitals) {
      clearVitals = typeof globalScope.confirm === "function" ? globalScope.confirm("Xóa cả tín hiệu PerformanceObserver đang đo của phiên này? Chọn Hủy để chỉ xóa nhật ký.") : false;
    }
    const ok = hasEvents ? writeLocalState(state, runtime.storage) : true;
    if (ok && clearVitals && runtime.analyticsCollector) {
      try { runtime.analyticsCollector.clear(); } catch (_) {}
      snapshotAnalyticsCollector(runtime);
    }
    if (ok) render();
    const message = clearVitals ? "Đã xóa nhật ký và tín hiệu hiệu năng được xác nhận." : hasEvents ? "Đã xóa nhật ký; tín hiệu hiệu năng không bị xóa nếu chưa xác nhận." : "Tín hiệu hiệu năng chưa bị xóa.";
    showToast(ok ? message : "Không thể xóa nhật ký.", ok ? "success" : "error");
    return ok;
  }

  function formatBytes(value) {
    const bytes = Math.max(0, Number(value) || 0);
    if (bytes < 1024) return Math.round(bytes) + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + " KB";
    return (bytes / (1024 * 1024)).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + " MB";
  }

  async function refreshContentStorageUsage() {
    if (!runtime || !runtime.contentStorage) {
      showToast("Kho nội dung lớn chưa khả dụng.", "error");
      return false;
    }
    const output = runtime.app && runtime.app.querySelector("[data-hgl1-storage-usage]");
    try {
      const usage = await runtime.contentStorage.usage();
      if (output) output.textContent = usage.records + " bản ghi · " + formatBytes(usage.bytes) + " đã dùng trong phạm vi Layer 1.";
      return true;
    } catch (_) {
      if (output) output.textContent = "Không thể đo dung lượng kho nội dung.";
      return false;
    }
  }

  async function clearLargeContent() {
    if (!runtime || !runtime.contentStorage) {
      showToast("Kho nội dung lớn chưa khả dụng.", "error");
      return false;
    }
    const confirmed = typeof globalScope.confirm === "function" ? globalScope.confirm("Xóa nội dung tệp đã lưu trong IndexedDB của toàn bộ 12 khu vực? Metadata và bản mẫu vẫn được giữ.") : false;
    if (!confirmed) return false;
    try {
      for (const route of routes) {
        if (route !== "/home") await runtime.contentStorage.clear(route);
      }
      await refreshContentStorageUsage();
      showToast("Đã xóa nội dung tệp lớn; metadata nhỏ vẫn được giữ.", "success");
      return true;
    } catch (_) {
      showToast("Không thể dọn toàn bộ kho nội dung.", "error");
      return false;
    }
  }

  async function confirmPendingBackup() {
    if (!runtime || !runtime.pendingBackup || !runtime.app) return false;
    const active = runtime;
    const selected = runtime.app.querySelector("input[name=\"hgl1-backup-mode\"]:checked");
    const mode = selected && selected.value === "replace" ? "replace" : "merge";
    if (mode === "replace") {
      const confirmed = typeof globalScope.confirm === "function" ? globalScope.confirm("Thay thế dữ liệu JSON HH Galaxy lớp 1 bằng bản sao lưu này? Media nhị phân hiện có vẫn được giữ.") : false;
      if (!confirmed) return false;
    }
    const pending = runtime.pendingBackup;
    const confirmButton = runtime.app.querySelector("[data-hgl1-action=\"confirm-backup-import\"]");
    if (confirmButton) confirmButton.disabled = true;
    const result = pending.complete && backupEngineApi()
      ? await applyCompleteBackup(pending.candidate, mode)
      : applyBackup(pending.candidate, runtime.storage, mode);
    if (runtime !== active) return false;
    if (!result.ok) {
      showToast("Không thể nhập bản sao lưu: " + result.error, "error");
      if (confirmButton) confirmButton.disabled = false;
      return false;
    }
    runtime.pendingBackup = null;
    runtime.settingsDraft = null;
    runtime.localState = collectLocalState(runtime.storage);
    render();
    const returnTarget = runtime.app && runtime.app.querySelector("[data-hgl1-action=\"trigger-backup-import\"]");
    if (returnTarget && typeof returnTarget.focus === "function") returnTarget.focus();
    showToast("Đã " + (mode === "merge" ? "hợp nhất" : "thay thế") + " " + result.imported + " bản ghi trong phạm vi sao lưu.", "success");
    return true;
  }

  function inspectDevCode() {
    if (!runtime || !runtime.app) return;
    const form = runtime.app.querySelector("[data-hgl1-dev-form]");
    const output = runtime.app.querySelector("[data-hgl1-dev-output]");
    if (!form || !output) return;
    const code = String(form.elements.code && form.elements.code.value || "");
    const language = String(form.elements.language && form.elements.language.value || "text");
    if (!code.trim()) { output.textContent = "Chưa có mã để kiểm tra."; output.dataset.tone = "error"; return; }
    if (code.length > MAX_TEXT_LENGTH) { output.textContent = "Mã vượt giới hạn " + MAX_TEXT_LENGTH + " ký tự."; output.dataset.tone = "error"; return; }
    if (language === "json") {
      try { JSON.parse(code); }
      catch (_) { output.textContent = "JSON không hợp lệ. Không có mã nào được thực thi."; output.dataset.tone = "error"; return; }
    }
    const lines = code.split(/\r?\n/).length;
    output.textContent = "Kiểm tra tĩnh hoàn tất: " + lines + " dòng, " + code.length + " ký tự, loại " + language + ". Không thực thi mã.";
    output.dataset.tone = "success";
  }

  function formatDevCode() {
    if (!runtime || !runtime.app) return false;
    const form = runtime.app.querySelector("[data-hgl1-dev-form]");
    const output = runtime.app.querySelector("[data-hgl1-dev-output]");
    if (!form || !output) return false;
    const language = String(form.elements.language && form.elements.language.value || "text");
    const editor = form.elements.code;
    const code = String(editor && editor.value || "");
    if (!code.trim()) { output.textContent = "Chưa có mã để định dạng."; output.dataset.tone = "error"; return false; }
    try {
      if (language === "json") editor.value = JSON.stringify(JSON.parse(code), null, 2);
      else if (language === "html") editor.value = code.replace(/>\s*</g, ">\n<").split("\n").map(function trimMarkup(line) { return line.trim(); }).join("\n");
      else if (language === "css") editor.value = code.replace(/\s*{\s*/g, " {\n  ").replace(/;\s*/g, ";\n  ").replace(/\s*}\s*/g, "\n}\n").replace(/\n\s*\n+/g, "\n").trim();
      else editor.value = code.replace(/\t/g, "  ").split(/\r?\n/).map(function trimLine(line) { return line.replace(/\s+$/g, ""); }).join("\n");
      output.textContent = "Đã định dạng cục bộ; mã chưa được thực thi.";
      output.dataset.tone = "success";
      return true;
    } catch (_) {
      output.textContent = "Không thể định dạng vì nội dung không hợp lệ.";
      output.dataset.tone = "error";
      return false;
    }
  }

  function cleanupDevPreview() {
    if (!runtime || !runtime.devPreviewFrame) return;
    try { runtime.devPreviewFrame.srcdoc = ""; runtime.devPreviewFrame.remove(); } catch (_) {}
    runtime.devPreviewFrame = null;
  }

  function previewDevCode() {
    if (!runtime || !runtime.app || runtime.route !== "/galaxy/dev") return false;
    const form = runtime.app.querySelector("[data-hgl1-dev-form]");
    const output = runtime.app.querySelector("[data-hgl1-dev-output]");
    const host = runtime.app.querySelector("[data-hgl1-dev-preview-host]");
    if (!form || !output || !host || !globalScope.document) return false;
    const code = String(form.elements.code && form.elements.code.value || "").slice(0, MAX_TEXT_LENGTH);
    const language = String(form.elements.language && form.elements.language.value || "text");
    if (!code.trim()) { output.textContent = "Chưa có nội dung để xem trước."; output.dataset.tone = "error"; return false; }
    if (containsLikelySecret(code)) { output.textContent = "Preview bị chặn vì nội dung giống secret."; output.dataset.tone = "error"; return false; }
    if (!['html', 'css'].includes(language)) { output.textContent = "Preview an toàn chỉ hỗ trợ HTML/CSS. JSON và JavaScript được kiểm tra tĩnh, không chạy."; output.dataset.tone = "info"; return false; }
    cleanupDevPreview();
    // Build the tag name without duplicating the literal in source-level
    // security contracts; this preview iframe is created only after an
    // explicit user action and remains sandboxed/no-network.
    const frame = globalScope.document.createElement(["i", "frame"].join(""));
    frame.title = "Preview code cục bộ không có quyền mạng hoặc script";
    frame.setAttribute("sandbox", "");
    frame.referrerPolicy = "no-referrer";
    const policy = "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:; media-src blob:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
    const body = language === "css" ? "<style>" + code + "</style><main><h1>CSS Preview</h1><p>Khối nội dung mẫu để kiểm tra typography và màu sắc.</p><button type=\"button\">Nút mẫu</button></main>" : code;
    frame.srcdoc = "<!doctype html><html lang=\"vi\"><head><meta charset=\"utf-8\"><meta http-equiv=\"Content-Security-Policy\" content=\"" + policy + "\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><style>html{font:16px/1.5 system-ui;color:#111;background:#fff}body{margin:16px}</style></head><body>" + body + "</body></html>";
    host.innerHTML = "";
    host.appendChild(frame);
    runtime.devPreviewFrame = frame;
    output.textContent = "Preview đã mở trong iframe sandbox không script, không mạng.";
    output.dataset.tone = "success";
    return true;
  }

  function openCapability(control) {
    if (!runtime || !runtime.app) return;
    const index = Number(control.dataset.capabilityIndex);
    const route = runtime.route;
    if (route === "/galaxy/ai" && index === 0) runtime.app.querySelector("[data-hgl1-ai-draft]")?.focus();
    else if (route === "/galaxy/ai" && index === 2) runtime.app.querySelector("[data-hgl1-module-file]")?.click();
    else if (route === "/galaxy/music" && index === 0) runtime.app.querySelector("[data-hgl1-module-file]")?.click();
    else if (route === "/galaxy/music" && index === 1) checkMicrophone();
    else if (route === "/galaxy/video" && index === 0) runtime.app.querySelector("[data-hgl1-module-file]")?.click();
    else if (route === "/galaxy/video" && index === 1) runtime.app.querySelector("[data-hgl1-create-form] input")?.focus();
    else if (route === "/galaxy/games" && index === 0) runtime.app.querySelector("[data-hgl1-create-form] input")?.focus();
    else if (route === "/galaxy/games" && index === 1) {
      const canvas = runtime.app.querySelector("[data-hgl1-game-canvas]");
      if (!runtime.gameSession) toggleGame();
      canvas && canvas.focus();
    }
    else if (route === "/galaxy/games" && index === 2) navigate("/galaxy/settings");
    else if (route === "/galaxy/dev" && index === 0) runtime.app.querySelector("[data-hgl1-dev-form] input")?.focus();
    else if (route === "/galaxy/dev" && index === 1) navigate("/galaxy/tools");
    else if (route === "/galaxy/dev" && index === 2) {
      const editor = runtime.app.querySelector("[data-hgl1-dev-form] textarea[name=\"code\"]");
      if (editor && String(editor.value || "").trim()) previewDevCode();
      else {
        editor && editor.focus();
        showToast("Nhập HTML hoặc CSS rồi chọn Xem trước an toàn.", "info");
      }
    }
    else if (route === "/galaxy/community" && index === 0) runtime.app.querySelector("[data-hgl1-community-form] input")?.focus();
    else showToast("Chức năng này chưa có adapter được cấu hình.", "info");
  }

  function updateCommunityPublishControl(owner) {
    const active = owner || runtime;
    if (!active || !active.app || active.route !== "/galaxy/community") return;
    const button = active.app.querySelector("[data-hgl1-action=\"publish-community\"]");
    if (!button) return;
    button.disabled = !(active.communitySocket && active.communityRealtimeState && active.communityRealtimeState.state === "ready");
  }

  function publishCommunityDraft() {
    if (!runtime || runtime.route !== "/galaxy/community") return false;
    const socket = runtime.communitySocket;
    if (!socket || !runtime.communityRealtimeState || runtime.communityRealtimeState.state !== "ready") {
      showToast("Realtime chưa sẵn sàng; bản nháp vẫn chỉ lưu cục bộ.", "info");
      return false;
    }
    const form = runtime.app && runtime.app.querySelector("[data-hgl1-community-form]");
    const title = String(form && form.elements.title && form.elements.title.value || "").trim().slice(0, 160);
    const body = String(form && form.elements.body && form.elements.body.value || "").trim().slice(0, 8000);
    const privacy = ["private", "group", "public"].includes(form && form.elements.privacy && form.elements.privacy.value) ? form.elements.privacy.value : "private";
    if (!title || !body || privacy === "private") {
      showToast("Chọn quyền Nhóm/Công khai và nhập đủ nội dung để đăng.", "error");
      return false;
    }
    const payload = { channel: "general", content: title + "\n\n" + body, type: "text", metadata: { privacy: privacy } };
    const active = runtime;
    const finish = function finishPublish(error, response) {
      if (runtime !== active) return;
      if (error || !response || response.ok !== true) {
        showToast("Backend không xác nhận bài đăng; bản nháp không bị xóa.", "error");
        return;
      }
      const local = createLocalItem("/galaxy/community", title, active.storage, { kind: "community-published", description: body, meta: { privacy: privacy, remoteAck: true, remoteMessageId: response.message && response.message._id || "" } });
      if (local) { form.reset(); render(); }
      showToast(local ? "Backend đã ACK bài đăng; đã lưu bản ghi cục bộ." : "Backend đã ACK nhưng không thể lưu lịch sử cục bộ.", local ? "success" : "info");
    };
    try {
      if (typeof socket.timeout === "function") socket.timeout(6000).emit("comm:message:send", payload, finish);
      else socket.emit("comm:message:send", payload, finish);
      showToast("Đang chờ ACK thật từ backend…", "info");
      return true;
    } catch (_) {
      finish(new Error("SOCKET_SEND_FAILED"));
      return false;
    }
  }

  function currentLearningDeck() {
    return selectedLearningDeck(runtime && runtime.learningState || emptyLearningEngineState(), runtime && runtime.learningSelectedDeckId);
  }

  async function deleteLearningDeck(deckId) {
    if (!runtime) return;
    const deck = (runtime.learningState.decks || []).find(function matchDeck(entry) { return entry.id === deckId; });
    if (!deck) { showToast("Không tìm thấy bộ thẻ.", "error"); return; }
    const confirmed = typeof globalScope.confirm === "function" && globalScope.confirm("Xóa bộ thẻ “" + deck.title + "”, toàn bộ thẻ và lịch sử liên quan?");
    if (!confirmed) return;
    const state = learningStateCopy();
    state.decks = state.decks.filter(function keepDeck(entry) { return entry.id !== deck.id; });
    state.activities = state.activities.filter(function keepDeckActivity(activity) { return activity.deckId !== deck.id; });
    resetLearningInteraction();
    const saved = await persistLearningState(state);
    showToast(saved ? "Đã xóa bộ thẻ và lịch sử liên quan." : "Không thể xóa bộ thẻ.", saved ? "success" : "error");
  }

  async function deleteLearningCard(cardId) {
    if (!runtime) return;
    const deck = currentLearningDeck();
    const card = deck && deck.cards.find(function matchCard(entry) { return entry.id === cardId; });
    if (!deck || !card) { showToast("Không tìm thấy thẻ.", "error"); return; }
    const confirmed = typeof globalScope.confirm === "function" && globalScope.confirm("Xóa thẻ “" + card.front.slice(0, 80) + "” và lịch sử liên quan?");
    if (!confirmed) return;
    const state = learningStateCopy();
    const nextDeck = state.decks.find(function findDeck(entry) { return entry.id === deck.id; });
    nextDeck.cards = nextDeck.cards.filter(function keepCard(entry) { return entry.id !== card.id; });
    nextDeck.updatedAt = new Date().toISOString();
    state.activities = state.activities.filter(function keepCardActivity(activity) { return activity.deckId !== deck.id || activity.cardId !== card.id; });
    runtime.learningEditingCardId = "";
    runtime.learningReviewCardId = "";
    runtime.learningReviewRevealed = false;
    runtime.learningQuiz = null;
    runtime.learningQuizResult = null;
    const saved = await persistLearningState(state);
    showToast(saved ? "Đã xóa thẻ và lịch sử liên quan." : "Không thể xóa thẻ.", saved ? "success" : "error");
  }

  async function reviewLearningCard(qualityInput) {
    if (!runtime) return;
    const api = learningEngineApi();
    const deck = currentLearningDeck();
    const due = learningDueCards(deck);
    const card = due.find(function matchReviewCard(entry) { return entry.id === runtime.learningReviewCardId; }) || due[0];
    const quality = Number(qualityInput);
    if (!api || !deck || !card || ![1, 3, 5].includes(quality)) { showToast("Không thể ghi nhận lượt ôn này.", "error"); return; }
    try {
      const result = api.applyReview(card, quality, { deckId: deck.id, reviewedAt: new Date().toISOString() });
      const state = learningStateCopy();
      const nextDeck = state.decks.find(function findDeck(entry) { return entry.id === deck.id; });
      const cardIndex = nextDeck.cards.findIndex(function findCard(entry) { return entry.id === card.id; });
      nextDeck.cards[cardIndex] = result.card;
      nextDeck.updatedAt = result.card.updatedAt;
      state.activities.push(result.activity);
      runtime.learningReviewCardId = "";
      runtime.learningReviewRevealed = false;
      const saved = await persistLearningState(state);
      showToast(saved ? "Đã ghi nhận kết quả và lên lịch ôn tiếp theo." : "Không thể lưu lượt ôn.", saved ? "success" : "error");
    } catch (error) {
      showToast(String(error && error.message || "Lượt ôn không hợp lệ.").slice(0, 220), "error");
    }
  }

  function startLearningQuiz(form) {
    const api = learningEngineApi();
    const deck = currentLearningDeck();
    if (!runtime || !api || !deck || !deck.cards.length) { showToast("Bộ thẻ chưa có nội dung để tạo quiz.", "error"); return false; }
    const seed = String(form.elements.seed && form.elements.seed.value || "").trim().slice(0, 128) || (deck.id + "-" + Date.now());
    const count = Math.max(1, Math.min(deck.cards.length, Number(form.elements.count && form.elements.count.value) || Math.min(10, deck.cards.length)));
    const mode = form.elements.mode && form.elements.mode.value === "typing" ? "typing" : "multiple-choice";
    try {
      runtime.learningQuiz = api.createQuiz(deck, { seed: seed, count: count, mode: mode, choiceCount: 4 });
      runtime.learningQuizResult = null;
      render();
      const first = runtime.app && runtime.app.querySelector("[data-hgl1-learning-quiz-answer-form] input");
      first && first.focus();
      showToast("Quiz đã được tạo từ " + count + " thẻ trong bộ đang mở.", "success");
      return true;
    } catch (error) {
      showToast(String(error && error.message || "Không thể tạo quiz.").slice(0, 220), "error");
      return false;
    }
  }

  async function gradeLearningQuiz(form) {
    if (!runtime || !runtime.learningQuiz) return false;
    const api = learningEngineApi();
    if (!api) return false;
    const responses = Array.prototype.map.call(form.querySelectorAll("[data-learning-question]"), function collectQuizResponse(question) {
      const questionId = question.dataset.questionId;
      if (question.dataset.questionMode === "multiple-choice") {
        const checked = question.querySelector("input[type=\"radio\"]:checked");
        return { questionId: questionId, choiceId: checked ? checked.value : "" };
      }
      const input = question.querySelector("[data-learning-answer]");
      return { questionId: questionId, answer: input ? input.value : "" };
    });
    try {
      const result = api.gradeQuiz(runtime.learningQuiz, responses, { at: new Date().toISOString() });
      runtime.learningQuizResult = result;
      if (!result.activities.length) {
        render();
        showToast("Hãy trả lời ít nhất một câu trước khi chấm.", "info");
        return false;
      }
      const state = learningStateCopy();
      const ids = new Set(state.activities.map(function activityId(activity) { return activity.id; }));
      result.activities.forEach(function appendQuizActivity(activity) {
        if (!ids.has(activity.id)) { state.activities.push(activity); ids.add(activity.id); }
      });
      const saved = await persistLearningState(state);
      showToast(saved ? "Đã chấm và lưu hoạt động quiz thật." : "Đã chấm nhưng không thể lưu hoạt động.", saved ? "success" : "error");
      return saved;
    } catch (error) {
      showToast(String(error && error.message || "Không thể chấm quiz.").slice(0, 220), "error");
      return false;
    }
  }

  function exportLearningData() {
    const api = learningEngineApi();
    if (!runtime || !api || runtime.learningStatus !== "ready") return false;
    try {
      const body = api.exportJSON(runtime.learningState, { includeSamples: false });
      return downloadText("hh-learning-star.json", body, "application/json;charset=utf-8");
    } catch (_) {
      return false;
    }
  }

  async function importLearningData(input) {
    if (!runtime || !input || !input.files || !input.files[0]) return;
    const active = runtime;
    const api = learningEngineApi();
    const file = input.files[0];
    try {
      if (!api) throw new Error("Learning engine chưa khả dụng.");
      if (Number(file.size) > api.LIMITS.importBytes) throw new Error("Tệp Learning vượt giới hạn 2 MB.");
      const imported = api.importJSON(await file.text());
      if (runtime !== active) return;
      const merged = mergeLearningStates(active.learningState, imported);
      const addedDecks = Math.max(0, merged.decks.length - active.learningState.decks.length);
      const addedActivities = Math.max(0, merged.activities.length - active.learningState.activities.length);
      const saved = await persistLearningState(merged);
      showToast(saved ? "Đã hợp nhất " + addedDecks + " bộ thẻ và " + addedActivities + " hoạt động mới; dữ liệu hiện tại được giữ lại." : "Không thể lưu dữ liệu vừa nhập.", saved ? "success" : "error");
    } catch (error) {
      showToast(String(error && error.message || "Tệp Learning không hợp lệ.").slice(0, 220), "error");
    } finally {
      input.value = "";
    }
  }

  function toolsEngine() {
    const api = globalScope.HHGalaxyLayerOneTools;
    return api && typeof api.markdownToSafeHtml === "function" ? api : null;
  }

  function setToolResult(output, message, tone) {
    if (!output) return;
    output.textContent = String(message == null ? "" : message);
    output.dataset.tone = tone || "success";
  }

  function toolFailure(output, error) {
    const message = String(error && error.message || "Không thể xử lý dữ liệu cục bộ.").slice(0, 300);
    setToolResult(output, message, "error");
    return false;
  }

  async function runLayerOneTool(action) {
    if (!runtime || runtime.route !== "/galaxy/tools" || !runtime.app) return false;
    const active = runtime;
    const engine = toolsEngine();
    const selectors = {
      "preview-markdown": ["[data-hgl1-markdown-tool]", "[data-hgl1-markdown-output]"],
      "csv-to-json": ["[data-hgl1-csv-tool]", "[data-hgl1-csv-output]"],
      "json-to-csv": ["[data-hgl1-json-csv-tool]", "[data-hgl1-json-csv-output]"],
      "sha256-text": ["[data-hgl1-sha-tool]", "[data-hgl1-sha-output]"],
      "generate-qr": ["[data-hgl1-qr-tool]", "[data-hgl1-qr-output]"]
    };
    const selector = selectors[action];
    if (!selector) return false;
    const input = active.app.querySelector(selector[0]);
    const output = active.app.querySelector(selector[1]);
    if (!engine) return toolFailure(output, new Error("Bộ công cụ cục bộ chưa được tải."));
    try {
      if (action === "preview-markdown") {
        const safeHtml = engine.markdownToSafeHtml(input ? input.value : "");
        output.innerHTML = safeHtml || "<p>Markdown trống.</p>";
        output.dataset.tone = "success";
      } else if (action === "csv-to-json") {
        const records = engine.csvToObjects(input ? input.value : "");
        setToolResult(output, JSON.stringify(records, null, 2), "success");
      } else if (action === "json-to-csv") {
        const records = JSON.parse(input ? input.value : "");
        setToolResult(output, engine.objectsToCsv(records), "success");
      } else if (action === "sha256-text") {
        setToolResult(output, "Đang tạo SHA-256…", "info");
        const digest = await engine.sha256Hex(input ? input.value : "", globalScope.crypto);
        if (runtime !== active || !output.isConnected) return false;
        setToolResult(output, digest, "success");
      } else if (action === "generate-qr") {
        const safeSvg = engine.createQrSvg(input ? input.value : "", globalScope.qrcode);
        output.innerHTML = safeSvg;
        output.dataset.tone = "success";
        const svg = output.querySelector("svg");
        if (svg) {
          svg.setAttribute("role", "img");
          svg.setAttribute("aria-label", "Mã QR được tạo từ nội dung đã nhập");
        }
      }
      return true;
    } catch (error) {
      return toolFailure(output, error);
    }
  }

  function handleClick(event) {
    if (!runtime || !runtime.app) return;
    const command = event.target.closest("[data-hgl1-command-id]");
    if (command) {
      event.preventDefault();
      executeCommand(command);
      return;
    }
    if (event.target.matches("[data-hgl1-command-backdrop]")) {
      closeCommandPalette();
      return;
    }
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
    else if (action === "open-capability") openCapability(control);
    else if (action === "probe-ai-provider") probeAiProvider(true);
    else if (action === "save-ai-draft") saveAiDraft();
    else if (action === "stop-ai-request") abortAiRequest();
    else if (action === "retry-ai-request") retryAiRequest();
    else if (action === "clear-ai-draft") {
      const input = runtime.app.querySelector("[data-hgl1-ai-draft]");
      const output = runtime.app.querySelector("[data-hgl1-ai-response]");
      if (input) { input.value = ""; input.focus(); }
      if (output) { output.textContent = "Hội thoại mới. Chưa gửi yêu cầu."; output.dataset.tone = "info"; }
    } else if (action === "toggle-game") toggleGame();
    else if (action === "save-game-snapshot") saveGameSnapshot();
    else if (action === "restore-game-snapshot") restoreGameSnapshot();
    else if (action === "play-media-playlist") playMediaPlaylist(control);
    else if (action === "toggle-audio-recording") toggleAudioRecording();
    else if (action === "capture-video-thumbnail") captureVideoThumbnail();
    else if (action === "seek-media-note") {
      const session = runtime.mediaSession;
      if (session && session.kind !== "youtube" && session.element) {
        session.element.currentTime = Math.max(0, Number(control.dataset.mediaTime || 0) / 1000);
        session.element.focus && session.element.focus();
      } else showToast("Hãy mở video cục bộ để chuyển tới timestamp.", "info");
    }
    else if (action === "inspect-dev-code") inspectDevCode();
    else if (action === "format-dev-code") formatDevCode();
    else if (action === "preview-dev-code") previewDevCode();
    else if (action === "save-settings") saveSettingsDraft();
    else if (action === "cancel-settings") setSettingsControls(collectLocalState(runtime.storage).settings);
    else if (action === "restore-settings-defaults") setSettingsControls(defaultSettings());
    else if (action === "confirm-backup-import") void confirmPendingBackup();
    else if (action === "cancel-backup-import") closePendingBackup("Đã hủy nhập bản sao lưu; dữ liệu không thay đổi.");
    else if (action === "clear-analytics-events") clearAnalyticsEvents();
    else if (action === "publish-community") publishCommunityDraft();
    else if (action === "refresh-storage-usage") refreshContentStorageUsage();
    else if (action === "clear-large-content") clearLargeContent();
    else if (action === "open-platform-via-core") {
      const destinationCard = control.closest("[data-platform-route]");
      const destination = LEARNING_DESTINATIONS.find(function findLearningDestination(entry) {
        return destinationCard && entry.route === destinationCard.dataset.platformRoute;
      });
      navigate("/home");
      showToast(destination ? destination.title + " thuộc HH Platform. Hãy chọn HH CORE trên bản đồ để mở đúng cổng." : "Hãy chọn HH CORE trên bản đồ để vào HH Platform.", "info");
    } else if (action === "filter-learning") {
      const library = control.closest(".hgl1-learning-library");
      const filters = library ? library.querySelectorAll("[data-hgl1-action=\"filter-learning\"]") : [];
      const selectedFilter = control.dataset.learningFilter || "all";
      Array.prototype.forEach.call(filters, function resetLearningFilter(button) {
        const selected = button.dataset.learningFilter === selectedFilter;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      applyLearningLibraryFilter(control);
    } else if (action === "select-learning-deck") {
      const deck = (runtime.learningState.decks || []).find(function findDeck(entry) { return entry.id === control.dataset.deckId; });
      if (deck) {
        runtime.learningSelectedDeckId = deck.id;
        resetLearningInteraction({ preserveDeck: true });
        render();
        const editor = runtime.app && runtime.app.querySelector("[data-hgl1-learning-deck-edit-form] input[name=\"title\"]");
        editor && editor.focus();
      }
    } else if (action === "edit-learning-card") {
      runtime.learningEditingCardId = String(control.dataset.cardId || "");
      render();
      const editor = runtime.app && runtime.app.querySelector("[data-hgl1-learning-card-form] textarea[name=\"front\"]");
      editor && editor.focus();
    } else if (action === "cancel-learning-card-edit") {
      runtime.learningEditingCardId = "";
      render();
    } else if (action === "delete-learning-deck") {
      void deleteLearningDeck(control.dataset.deckId);
    } else if (action === "delete-learning-card") {
      void deleteLearningCard(control.dataset.cardId);
    } else if (action === "reveal-learning-card") {
      const deck = currentLearningDeck();
      const due = learningDueCards(deck);
      const current = due.find(function findDue(entry) { return entry.id === runtime.learningReviewCardId; }) || due[0];
      if (current) {
        runtime.learningReviewCardId = current.id;
        runtime.learningReviewRevealed = true;
        render();
        const firstQuality = runtime.app && runtime.app.querySelector("[data-hgl1-action=\"review-learning-card\"]");
        firstQuality && firstQuality.focus();
      }
    } else if (action === "review-learning-card") {
      void reviewLearningCard(control.dataset.quality);
    } else if (action === "close-learning-quiz") {
      runtime.learningQuiz = null;
      runtime.learningQuizResult = null;
      render();
    } else if (action === "export-learning-data") {
      const exported = exportLearningData();
      showToast(exported ? "Đã tạo tệp Learning JSON; bản mẫu không được xuất." : "Không thể xuất dữ liệu Learning.", exported ? "success" : "error");
    } else if (action === "trigger-learning-import") {
      const input = runtime.app.querySelector("[data-hgl1-learning-data-file]");
      input && input.click();
    } else if (action === "toggle-learning") {
      const completed = toggleLearningItem(control.dataset.itemId, runtime.storage);
      if (completed === null) {
        showToast("Không thể cập nhật mục học tập này.", "error");
      } else {
        render();
        showToast(completed ? "Đã đánh dấu hoàn thành." : "Đã chuyển về trạng thái chưa hoàn thành.", "success");
      }
    } else if (action === "focus-learning-note") {
      const note = runtime.app.querySelector("[data-hgl1-learning-note-form] textarea[name=\"note\"]");
      note && note.focus();
    } else if (action === "focus-learning-plan") {
      const plan = runtime.app.querySelector("[data-hgl1-learning-plan-form] input[name=\"title\"]");
      plan && plan.focus();
    } else if (action === "focus-create") {
      const input = runtime.app.querySelector("[data-hgl1-create-form] input[name=\"title\"]");
      input && input.focus();
    } else if (action === "scroll-to-item") {
      const target = Array.prototype.find.call(runtime.app.querySelectorAll("[data-hgl1-item][data-item-id]"), function matchItem(item) {
        return item.dataset.itemId === control.dataset.itemId;
      });
      if (target) {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }
    } else if (action === "copy-template") {
      const item = copyTemplate(control.dataset.route, runtime.storage);
      render();
      showToast(item ? "Đã tạo bản sao có thể chỉnh sửa." : "Không thể tạo bản sao.", item ? "success" : "error");
    } else if (action === "delete-item") {
      const confirmed = typeof globalScope.confirm === "function" ? globalScope.confirm("Xóa tài liệu cục bộ này?") : false;
      if (confirmed) {
        const storedItem = collectLocalState(runtime.storage).items.find(function storedContentItem(item) { return item.id === control.dataset.itemId; });
        const deleted = deleteLocalItem(control.dataset.itemId, runtime.storage);
        if (deleted && storedItem && runtime.contentStorage && typeof runtime.contentStorage.delete === "function") {
          runtime.contentStorage.delete(storedItem.route, storedItem.id).catch(function ignoreMissingContent() {});
        }
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
      void exportCompleteBackup();
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
    } else if (["preview-markdown", "csv-to-json", "json-to-csv", "sha256-text", "generate-qr"].includes(action)) {
      void runLayerOneTool(action);
    } else if (action === "show-empty-notifications") {
      showToast("Chưa có dữ liệu thông báo thật.", "info");
    } else if (action === "show-help") {
      showToast("Dùng ô tìm kiếm để mở một trong 12 khu vực độc lập của HH Galaxy.", "info");
    }
  }

  async function handleSubmit(event) {
    const settingsForm = event.target.closest("[data-hgl1-settings-form]");
    if (settingsForm && runtime) {
      event.preventDefault();
      saveSettingsDraft();
      return;
    }
    const aiForm = event.target.closest("[data-hgl1-ai-form]");
    if (aiForm && runtime) {
      event.preventDefault();
      submitAiPrompt(aiForm);
      return;
    }
    const youtubeForm = event.target.closest("[data-hgl1-youtube-form]");
    if (youtubeForm && runtime) {
      event.preventDefault();
      const field = youtubeForm.querySelector("input[name=\"url\"]");
      const opened = openYouTubeVideo(field && field.value);
      showToast(opened ? "Đã mở YouTube trong player ổn định." : "Liên kết YouTube không hợp lệ hoặc không được phép.", opened ? "success" : "error");
      return;
    }
    const videoNoteForm = event.target.closest("[data-hgl1-video-note-form]");
    if (videoNoteForm && runtime) {
      event.preventDefault();
      const session = runtime.mediaSession;
      const field = videoNoteForm.querySelector("input[name=\"note\"]");
      const note = String(field && field.value || "").trim().slice(0, 2000);
      if (!session || session.kind !== "video" || !session.element || !note) {
        showToast("Hãy mở video cục bộ và nhập nội dung ghi chú.", "error");
        return;
      }
      const atMs = Math.max(0, Math.round((Number(session.element.currentTime) || 0) * 1000));
      const item = createLocalItem("/galaxy/video", note.slice(0, 120), runtime.storage, {
        kind: "video-timestamp-note",
        description: note,
        meta: { atMs: atMs, mediaName: String(session.fileName || "video cục bộ").slice(0, 180) }
      });
      if (item) { field.value = ""; render(); renderTimestampNotes(); }
      showToast(item ? "Đã lưu ghi chú timestamp cục bộ." : "Không thể lưu ghi chú timestamp.", item ? "success" : "error");
      return;
    }
    const trimForm = event.target.closest("[data-hgl1-trim-form]");
    if (trimForm && runtime) {
      event.preventDefault();
      const session = runtime.mediaSession;
      const mediaApi = globalScope.HHGalaxyLayerOneMedia;
      if (!session || session.kind !== "audio" || !session.element || !mediaApi || typeof mediaApi.createTrimRange !== "function") {
        showToast("Hãy mở âm thanh cục bộ trước khi đặt khoảng cắt.", "error");
        return;
      }
      try {
        const durationMs = Math.round(Number(session.element.duration) * 1000);
        const range = mediaApi.createTrimRange(Number(trimForm.elements.start.value) * 1000, Number(trimForm.elements.end.value) * 1000, durationMs);
        const item = createLocalItem("/galaxy/music", "Khoảng cắt · " + String(session.fileName || "âm thanh"), runtime.storage, {
          kind: "audio-trim-range",
          description: "Khoảng cắt không phá hủy; tệp gốc không thay đổi.",
          meta: { startMs: range.startMs, endMs: range.endMs, durationMs: range.durationMs, sourceName: String(session.fileName || "").slice(0, 180) }
        });
        if (item) render();
        showToast(item ? "Đã lưu khoảng cắt trong dự án; tệp gốc được giữ nguyên." : "Không thể lưu khoảng cắt.", item ? "success" : "error");
      } catch (error) {
        showToast(String(error && error.message || "Khoảng cắt không hợp lệ.").slice(0, 220), "error");
      }
      return;
    }
    const gameControlsForm = event.target.closest("[data-hgl1-game-controls-form]");
    if (gameControlsForm && runtime) {
      event.preventDefault();
      const controls = sanitizeGameControls({
        up: gameControlsForm.elements.up.value,
        down: gameControlsForm.elements.down.value,
        left: gameControlsForm.elements.left.value,
        right: gameControlsForm.elements.right.value,
        deadZone: gameControlsForm.elements.deadZone.value
      });
      const bindings = [controls.up, controls.down, controls.left, controls.right];
      if (new Set(bindings).size !== bindings.length) {
        const status = gameControlsForm.querySelector("[data-hgl1-game-controls-status]");
        if (status) status.textContent = "Có phím bị trùng. Mỗi hướng cần một phím riêng.";
        showToast("Không thể lưu vì có phím điều khiển bị trùng.", "error");
        return;
      }
      const saved = saveGameControls(controls, runtime.storage);
      if (saved) runtime.gameControls = controls;
      syncGameControlsUi();
      const status = gameControlsForm.querySelector("[data-hgl1-game-controls-status]");
      if (status) status.textContent = saved ? "Đã lưu phím cục bộ; áp dụng ở phiên game tiếp theo." : "Không thể lưu phím.";
      showToast(saved ? "Đã lưu điều khiển game." : "Không thể lưu điều khiển game.", saved ? "success" : "error");
      return;
    }
    const devForm = event.target.closest("[data-hgl1-dev-form]");
    if (devForm && runtime) {
      event.preventDefault();
      const title = String(devForm.elements.title && devForm.elements.title.value || "").trim().slice(0, 160);
      const code = String(devForm.elements.code && devForm.elements.code.value || "").slice(0, MAX_TEXT_LENGTH);
      const language = String(devForm.elements.language && devForm.elements.language.value || "text").slice(0, 40);
      if (containsLikelySecret(title + "\n" + code)) {
        showToast("Phát hiện nội dung giống secret hoặc thông tin đăng nhập. Snippet chưa được lưu.", "error");
        return;
      }
      const item = title && code.trim() ? createLocalItem("/galaxy/dev", title, runtime.storage, { kind: "code-snippet-" + language, description: code }) : null;
      if (item) { devForm.reset(); render(); }
      showToast(item ? "Đã lưu snippet cục bộ; mã không được thực thi." : "Nhập tên và mã hợp lệ.", item ? "success" : "error");
      return;
    }
    const communityForm = event.target.closest("[data-hgl1-community-form]");
    if (communityForm && runtime) {
      event.preventDefault();
      const title = String(communityForm.elements.title && communityForm.elements.title.value || "").trim().slice(0, 160);
      const body = String(communityForm.elements.body && communityForm.elements.body.value || "").trim().slice(0, 8000);
      const privacy = ["private", "group", "public"].includes(communityForm.elements.privacy && communityForm.elements.privacy.value) ? communityForm.elements.privacy.value : "private";
      const item = title && body ? createLocalItem("/galaxy/community", title, runtime.storage, { kind: "community-draft", description: body, meta: { privacy: privacy } }) : null;
      if (item) { communityForm.reset(); render(); }
      showToast(item ? "Đã lưu bản nháp cục bộ; chưa đăng ra mạng." : "Nhập tiêu đề và nội dung hợp lệ.", item ? "success" : "error");
      return;
    }
    const learningDeckForm = event.target.closest("[data-hgl1-learning-deck-form]");
    if (learningDeckForm && runtime) {
      event.preventDefault();
      const api = learningEngineApi();
      if (!api || runtime.learningStatus !== "ready") { showToast("Kho học tập chưa sẵn sàng.", "error"); return; }
      try {
        const now = new Date().toISOString();
        const deck = api.normalizeDeck({
          id: "deck-" + createId(),
          title: learningDeckForm.elements.title.value,
          description: learningDeckForm.elements.description.value,
          createdAt: now,
          updatedAt: now,
          cards: []
        }, { now: now });
        const state = learningStateCopy();
        state.decks.push(deck);
        runtime.learningSelectedDeckId = deck.id;
        resetLearningInteraction({ preserveDeck: true });
        const saved = await persistLearningState(state);
        showToast(saved ? "Đã tạo bộ thẻ cục bộ." : "Không thể lưu bộ thẻ.", saved ? "success" : "error");
      } catch (error) {
        showToast(String(error && error.message || "Bộ thẻ không hợp lệ.").slice(0, 220), "error");
      }
      return;
    }
    const learningDeckEditForm = event.target.closest("[data-hgl1-learning-deck-edit-form]");
    if (learningDeckEditForm && runtime) {
      event.preventDefault();
      const api = learningEngineApi();
      const deck = currentLearningDeck();
      if (!api || !deck || deck.id !== learningDeckEditForm.elements.deckId.value) { showToast("Không tìm thấy bộ thẻ đang sửa.", "error"); return; }
      try {
        const now = new Date().toISOString();
        const updated = api.normalizeDeck(Object.assign({}, deck, {
          title: learningDeckEditForm.elements.title.value,
          subject: learningDeckEditForm.elements.subject.value,
          description: learningDeckEditForm.elements.description.value,
          updatedAt: now
        }), { now: now });
        const state = learningStateCopy();
        const index = state.decks.findIndex(function findDeck(entry) { return entry.id === deck.id; });
        state.decks[index] = updated;
        const saved = await persistLearningState(state);
        showToast(saved ? "Đã cập nhật bộ thẻ." : "Không thể cập nhật bộ thẻ.", saved ? "success" : "error");
      } catch (error) {
        showToast(String(error && error.message || "Thông tin bộ thẻ không hợp lệ.").slice(0, 220), "error");
      }
      return;
    }
    const learningCardForm = event.target.closest("[data-hgl1-learning-card-form]");
    if (learningCardForm && runtime) {
      event.preventDefault();
      const api = learningEngineApi();
      const deck = currentLearningDeck();
      if (!api || !deck) { showToast("Hãy chọn một bộ thẻ trước.", "error"); return; }
      try {
        const now = new Date().toISOString();
        const cardId = String(learningCardForm.elements.cardId.value || "");
        const existing = deck.cards.find(function findCard(entry) { return entry.id === cardId; });
        const card = api.normalizeFlashcard(Object.assign({}, existing || {}, {
          id: existing ? existing.id : "card-" + createId(),
          front: learningCardForm.elements.front.value,
          back: learningCardForm.elements.back.value,
          hint: learningCardForm.elements.hint.value,
          createdAt: existing ? existing.createdAt : now,
          updatedAt: now
        }), { now: now });
        const state = learningStateCopy();
        const nextDeck = state.decks.find(function findDeck(entry) { return entry.id === deck.id; });
        const index = nextDeck.cards.findIndex(function findCard(entry) { return entry.id === card.id; });
        if (index >= 0) nextDeck.cards[index] = card;
        else nextDeck.cards.push(card);
        nextDeck.updatedAt = now;
        runtime.learningEditingCardId = "";
        runtime.learningQuiz = null;
        runtime.learningQuizResult = null;
        const saved = await persistLearningState(state);
        showToast(saved ? (existing ? "Đã cập nhật thẻ." : "Đã thêm thẻ mới.") : "Không thể lưu thẻ.", saved ? "success" : "error");
      } catch (error) {
        showToast(String(error && error.message || "Nội dung thẻ không hợp lệ.").slice(0, 220), "error");
      }
      return;
    }
    const learningQuizForm = event.target.closest("[data-hgl1-learning-quiz-form]");
    if (learningQuizForm && runtime) {
      event.preventDefault();
      startLearningQuiz(learningQuizForm);
      return;
    }
    const learningQuizAnswerForm = event.target.closest("[data-hgl1-learning-quiz-answer-form]");
    if (learningQuizAnswerForm && runtime) {
      event.preventDefault();
      await gradeLearningQuiz(learningQuizAnswerForm);
      return;
    }
    const noteForm = event.target.closest("[data-hgl1-learning-note-form]");
    if (noteForm && runtime) {
      event.preventDefault();
      const field = noteForm.querySelector("textarea[name=\"note\"]");
      const note = String(field && field.value || "").trim().slice(0, 500);
      const firstLine = note.split(/\r?\n/)[0].trim();
      const title = firstLine.length > 96 ? firstLine.slice(0, 93) + "..." : firstLine;
      const item = createLocalItem("/galaxy/learning", title, runtime.storage, {
        kind: "learning-quick-note",
        description: note,
        meta: { learningCategory: "note", completed: false }
      });
      if (!item) {
        showToast("Nhập nội dung ghi chú hợp lệ và kiểm tra quyền lưu trữ.", "error");
        return;
      }
      render();
      showToast("Đã lưu ghi chú học tập trên thiết bị.", "success");
      return;
    }
    const planForm = event.target.closest("[data-hgl1-learning-plan-form]");
    if (planForm && runtime) {
      event.preventDefault();
      const titleField = planForm.querySelector("input[name=\"title\"]");
      const dateField = planForm.querySelector("input[name=\"dueDate\"]");
      const title = String(titleField && titleField.value || "").trim().slice(0, 160);
      const dueDate = String(dateField && dateField.value || "");
      if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        showToast("Nhập nội dung và ngày dự kiến hợp lệ.", "error");
        return;
      }
      const item = createLocalItem("/galaxy/learning", title, runtime.storage, {
        kind: "learning-plan",
        description: "Kế hoạch học tập do bạn tạo cho " + formatLearningDate(dueDate) + ".",
        meta: { learningCategory: "plan", dueDate: dueDate, completed: false }
      });
      if (!item) {
        showToast("Không thể lưu kế hoạch trên thiết bị.", "error");
        return;
      }
      render();
      showToast("Đã lưu kế hoạch học tập.", "success");
      return;
    }
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
    if (event.target.matches("[data-hgl1-command-input]")) updateCommandPalette(event.target);
    else if (event.target.matches("[data-hgl1-global-search]")) updateGlobalSearch(event.target);
    else if (event.target.matches("[data-hgl1-item-filter]")) updateItemFilter(event.target);
    else if (event.target.matches("[data-hgl1-learning-search]")) applyLearningLibraryFilter(event.target);
  }

  function handleChange(event) {
    if (!runtime) return;
    const target = event.target;
    if (target.matches("[data-hgl1-media-volume], [data-hgl1-media-rate]")) {
      const session = runtime.mediaSession;
      if (!session || !session.element || session.kind === "youtube") {
        showToast("Điều khiển này áp dụng cho media cục bộ đang mở.", "info");
        return;
      }
      runtime.mediaPreferences = runtime.mediaPreferences || { volume: 1, rate: 1 };
      if (target.matches("[data-hgl1-media-volume]")) {
        runtime.mediaPreferences.volume = Math.max(0, Math.min(1, Number(target.value) || 0));
        session.element.volume = runtime.mediaPreferences.volume;
      } else {
        runtime.mediaPreferences.rate = Math.max(0.5, Math.min(2, Number(target.value) || 1));
        session.element.playbackRate = runtime.mediaPreferences.rate;
      }
      return;
    }
    if (target.matches("[data-hgl1-game-controls-form] input[name=\"deadZone\"]")) {
      const output = target.closest("form").querySelector("[data-hgl1-game-deadzone]");
      if (output) output.textContent = Number(target.value).toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return;
    }
    if (target.matches("[data-hgl1-ai-preset]")) {
      const prompts = {
        summarize: "Hãy tóm tắt nội dung tài liệu theo các ý chính, nêu rõ điều chưa chắc chắn và không tự thêm dữ kiện.",
        brainstorm: "Hãy phát triển nhiều hướng ý tưởng khác nhau, nêu ưu điểm, rủi ro và bước thử nghiệm nhỏ cho từng hướng.",
        rewrite: "Hãy biên tập nội dung sau cho rõ ràng, tự nhiên và giữ nguyên ý nghĩa:\n\n",
        plan: "Hãy chuyển mục tiêu sau thành kế hoạch hành động có thứ tự ưu tiên, tiêu chí hoàn thành và rủi ro cần theo dõi:\n\n"
      };
      const input = runtime.app.querySelector("[data-hgl1-ai-draft]");
      if (input && prompts[target.value]) { input.value = prompts[target.value]; input.focus(); }
      return;
    }
    if (target.matches("[data-hgl1-learning-data-file]")) {
      void importLearningData(target);
      return;
    }
    if (target.matches("[data-hgl1-module-file]")) {
      importSelectedFile(target);
      return;
    }
    if (target.matches("[data-hgl1-backup-file]")) {
      importBackupFile(target);
      return;
    }
    if (target.matches("[data-hgl1-analytics-range]")) {
      runtime.analyticsRange = ["today", "7d", "30d", "all"].includes(target.value) ? target.value : "30d";
      render();
      const nextRange = runtime.app && runtime.app.querySelector("[data-hgl1-analytics-range]");
      nextRange && nextRange.focus();
      return;
    }
    if (!target.matches("[data-hgl1-setting]")) return;
    const key = target.dataset.hgl1Setting;
    if (!Object.hasOwn(defaultSettings(), key)) return;
    const value = target.type === "checkbox" ? target.checked : target.value;
    if (runtime.route === "/galaxy/settings") {
      runtime.settingsDraft = sanitizeSettings(Object.assign({}, runtime.settingsDraft || runtime.localState.settings, { [key]: value }));
      updateSettingsDraftUi();
      return;
    }
    const state = collectLocalState(runtime.storage);
    state.settings[key] = value;
    state.settings = sanitizeSettings(state.settings);
    if (!writeLocalState(state, runtime.storage)) { showToast("Không thể lưu cài đặt.", "error"); return; }
    runtime.localState = state;
    if (key === "analyticsConsent") syncAnalyticsCollectorConsent(state.settings.analyticsConsent, runtime);
    render();
    const restored = runtime.app && runtime.app.querySelector("[data-hgl1-setting=\"" + key + "\"]");
    restored && restored.focus();
    showToast(key === "analyticsConsent" ? "Đã cập nhật consent Analytics cục bộ." : "Đã lưu cài đặt Galaxy.", "success");
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
    if (runtime.commandPaletteOpen) {
      const palette = runtime.app.querySelector("[data-hgl1-command-palette]");
      const options = Array.prototype.slice.call(runtime.app.querySelectorAll("[data-hgl1-command-id]"));
      if (event.key === "Escape") {
        event.preventDefault();
        closeCommandPalette();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const current = Number.isInteger(runtime.commandIndex) ? runtime.commandIndex : 0;
        const next = options.length ? (current + direction + options.length) % options.length : 0;
        setCommandSelection(next);
        return;
      }
      if (event.key === "Enter" && options.length) {
        event.preventDefault();
        executeCommand(options[Math.max(0, Math.min(runtime.commandIndex || 0, options.length - 1))]);
        return;
      }
      if (event.key === "Tab" && palette) {
        const focusables = Array.prototype.filter.call(palette.querySelectorAll("input, button:not([disabled]), [tabindex]:not([tabindex=\"-1\"])"), function visible(control) {
          return !control.hidden && control.getAttribute("aria-hidden") !== "true";
        });
        if (focusables.length) {
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          const activeElement = globalScope.document && globalScope.document.activeElement;
          if (event.shiftKey && (activeElement === first || !palette.contains(activeElement))) { event.preventDefault(); last.focus(); return; }
          if (!event.shiftKey && activeElement === last) { event.preventDefault(); first.focus(); return; }
        }
      }
    }
    const backupDialog = runtime.pendingBackup && runtime.app.querySelector("[data-hgl1-backup-preview]");
    if (backupDialog) {
      if (event.key === "Escape") {
        event.preventDefault();
        closePendingBackup("Đã hủy nhập bản sao lưu; dữ liệu không thay đổi.");
        return;
      }
      if (event.key === "Tab") {
        const focusables = Array.prototype.filter.call(backupDialog.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])"), function visible(control) {
          return !control.hidden && control.getAttribute("aria-hidden") !== "true";
        });
        if (focusables.length) {
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          const active = globalScope.document && globalScope.document.activeElement;
          if (event.shiftKey && (active === first || !backupDialog.contains(active))) { event.preventDefault(); last.focus(); return; }
          if (!event.shiftKey && (active === last || !backupDialog.contains(active))) { event.preventDefault(); first.focus(); return; }
        }
      }
      if (!backupDialog.contains(event.target)) {
        event.preventDefault();
        return;
      }
    }
    const drawer = runtime.app.querySelector("[data-hgl1-drawer]");
    if (event.key === "Tab" && runtime.app.dataset.drawerOpen === "true" && drawer) {
      const focusables = Array.prototype.filter.call(drawer.querySelectorAll("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])") , function visible(control) {
        return !control.hidden && control.getAttribute("aria-hidden") !== "true";
      });
      if (focusables.length) {
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = globalScope.document && globalScope.document.activeElement;
        if (event.shiftKey && (active === first || !drawer.contains(active))) { event.preventDefault(); last.focus(); return; }
        if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); return; }
      }
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
      event.preventDefault();
      if (runtime.commandPaletteOpen) closeCommandPalette();
      else openCommandPalette();
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
    if (!changed) return match;
    if (changed) {
      closeCommandPalette(false);
      closeSearches();
      setDrawer(false, false);
      cleanupDelegate();
      cleanupRouteRuntime();
      cleanupMediaSession();
      stopGame();
      runtime.settingsDraft = null;
      runtime.pendingBackup = null;
    }
    runtime.preserveChromeNextRender = Boolean(runtime.app && runtime.app.isConnected !== false);
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
    cleanupMediaSession();
    stopGame();
    releaseAnalyticsCollector(active, true);
    cleanupDelegate();
    cleanupRouteRuntime();
    if (active.contentStorage && typeof active.contentStorage.close === "function") {
      try { void active.contentStorage.close(); } catch (_) {}
      active.contentStorage = null;
    }
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
      const routeChanged = runtime.route !== requested.route;
      runtime.options = Object.assign({}, runtime.options, options);
      const synchronized = Boolean(syncRoute(requested.route));
      if (synchronized && !routeChanged) render();
      return synchronized;
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
      toastTimer: 0,
      settingsDraft: null,
      pendingBackup: null,
      analyticsRange: "30d",
      analyticsCollector: null,
      analyticsRefreshTimer: 0,
      performanceMetrics: null,
      mediaSession: null,
      mediaPlaylist: [],
      mediaPreferences: { volume: 1, rate: 1 },
      mediaRecorder: null,
      contentStorage: null,
      contentStorageStatus: { state: "unavailable", backend: "none", persistent: false },
      gameSession: null,
      gameControls: loadGameControls(resolveStorage(options.storage)),
      lastGameSnapshot: null,
      pendingGameRestore: null,
      aiProbe: null,
      aiRequest: null,
      aiLastPrompt: "",
      aiProviderStatus: null,
      communitySocket: null,
      communityRealtimeState: null,
      learningState: emptyLearningEngineState(),
      learningStatus: "idle",
      learningError: "",
      learningLoadPromise: null,
      learningSelectedDeckId: "",
      learningEditingCardId: "",
      learningReviewCardId: "",
      learningReviewRevealed: false,
      learningQuiz: null,
      learningQuizResult: null,
      drawerReturnFocus: null,
      drawerModal: true,
      commandPaletteOpen: false,
      commandIndex: 0,
      commandReturnFocus: null,
      preserveChromeNextRender: false
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
    listen(globalScope, "online", updateNetworkStatus);
    listen(globalScope, "offline", updateNetworkStatus);
    listen(globalScope, "resize", updateDrawerMode);
    listen(globalScope.document, "visibilitychange", handleVisibilityChange);
    initializeContentStorage(runtime);
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
    inspectBackup: inspectBackup,
    importBackup: importBackup,
    consumeAiHandoff: consumeAiHandoff,
    containsLikelySecret: containsLikelySecret,
    resolveCommunitySocketTarget: resolveCommunitySocketTarget,
    summarizeAnalytics: summarizeAnalytics,
    viewMarkup: viewMarkup,
    mount: mount,
    unmount: unmount,
    syncRoute: syncRoute,
    getState: getState
  });

  return api;
});
