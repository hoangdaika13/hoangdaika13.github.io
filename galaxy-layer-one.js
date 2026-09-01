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
  const BACKUP_MAX_BYTES = 2 * 1024 * 1024;

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

  function sanitizeItem(value) {
    if (!value || typeof value !== "object") return null;
    const match = findRoute(value.route);
    if (!match || ["/home", "/galaxy/analytics", "/galaxy/settings"].includes(match.route)) return null;
    const title = String(value.title || "").trim().slice(0, 160);
    if (!title) return null;
    const metaSource = value.meta && typeof value.meta === "object" ? value.meta : {};
    const learningCategory = ["note", "plan", "resource"].includes(metaSource.learningCategory) ? metaSource.learningCategory : "";
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(metaSource.dueDate || "")) ? String(metaSource.dueDate) : "";
    const meta = {
      fileName: String(metaSource.fileName || "").slice(0, 180),
      fileType: String(metaSource.fileType || "").slice(0, 120),
      fileSize: Math.max(0, Math.min(Number(metaSource.fileSize) || 0, Number.MAX_SAFE_INTEGER)),
      copiedFrom: String(metaSource.copiedFrom || "").slice(0, 100),
      learningCategory: learningCategory,
      dueDate: dueDate,
      privacy: ["private", "group", "public"].includes(metaSource.privacy) ? metaSource.privacy : "private",
      provider: String(metaSource.provider || "").slice(0, 80),
      completed: metaSource.completed === true
    };
    return {
      id: String(value.id || createId()).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 96) || createId(),
      route: match.route,
      title: title,
      kind: String(value.kind || "document").slice(0, 60),
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
    return "<aside class=\"hgl1-world-rail hgl1-world-rail--" + entry.id + "\" aria-label=\"Thông tin " + escapeHtml(entry.label) + "\">" +
      "<section class=\"hgl1-world-rail__card\"><span class=\"hgl1-kicker\">Tín hiệu khu vực</span><h2>" + escapeHtml(experience.railTitle) + "</h2><p>" + escapeHtml(experience.railDescription) + "</p></section>" +
      factsMarkup +
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
    return "<article class=\"hgl1-document\" data-hgl1-item data-filter-text=\"" + escapeHtml(normalizedSearchText(item.title + " " + item.description)) + "\">" +
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
        "<form data-hgl1-ai-form><label for=\"hgl1-ai-prompt\">Nội dung yêu cầu</label><textarea id=\"hgl1-ai-prompt\" name=\"prompt\" data-hgl1-ai-draft maxlength=\"4000\" rows=\"7\" placeholder=\"Nhập yêu cầu; nội dung chỉ được gửi khi bạn bấm Gửi…\"></textarea><div class=\"hgl1-workspace-actions\"><button class=\"hgl1-button hgl1-button--primary\" type=\"submit\" data-hgl1-ai-send disabled>Gửi tới provider</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"save-ai-draft\">Lưu bản nháp</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"clear-ai-draft\">Hội thoại mới</button></div></form>" +
        "<output class=\"hgl1-tool__output hgl1-ai-response\" data-hgl1-ai-response aria-live=\"polite\">Chưa gửi yêu cầu. Provider và trạng thái đăng nhập sẽ được kiểm tra thật.</output></section>";
    }
    if (entry.route === "/galaxy/music" || entry.route === "/galaxy/video") {
      const isVideo = entry.route === "/galaxy/video";
      return "<section class=\"hgl1-functional-workspace hgl1-media-workspace\" data-hgl1-media-workspace=\"" + (isVideo ? "video" : "audio") + "\" aria-labelledby=\"hgl1-media-title\"><header class=\"hgl1-section-head\"><div><span class=\"hgl1-kicker\">Player phiên hiện tại</span><h2 id=\"hgl1-media-title\">" + (isVideo ? "Trình phát video ổn định" : "Trình phát âm thanh cục bộ") + "</h2></div></header>" +
        (isVideo ? "<form class=\"hgl1-youtube-form\" data-hgl1-youtube-form><label for=\"hgl1-youtube-url\">Liên kết YouTube do bạn chọn</label><div><input id=\"hgl1-youtube-url\" name=\"url\" type=\"url\" inputmode=\"url\" maxlength=\"500\" placeholder=\"https://www.youtube.com/watch?v=…\"/><button class=\"hgl1-button hgl1-button--ghost\" type=\"submit\">Mở an toàn</button></div><small>Chỉ youtube.com và youtu.be; player dùng youtube-nocookie.com, không tự phát.</small></form>" : "") +
        "<div class=\"hgl1-media-stage\" data-hgl1-stable-media-host><div class=\"hgl1-delegated-placeholder\" data-hgl1-media-empty><div><h3>Chưa chọn " + (isVideo ? "video" : "âm thanh") + "</h3><p>Bấm Nhập tệp ở phía trên. Tệp chỉ phát từ phiên trình duyệt hiện tại.</p></div></div></div><p class=\"hgl1-runtime-status\" data-hgl1-media-status role=\"status\">Không tự phát · chưa có media đang mở.</p></section>";
    }
    if (entry.route === "/galaxy/games") {
      return "<section class=\"hgl1-functional-workspace hgl1-game-workspace\" aria-labelledby=\"hgl1-game-title\"><header class=\"hgl1-section-head\"><div><span class=\"hgl1-kicker\">Runtime cục bộ</span><h2 id=\"hgl1-game-title\">Orbit Collector</h2></div><button class=\"hgl1-button hgl1-button--primary\" type=\"button\" data-hgl1-action=\"toggle-game\">Bắt đầu</button></header><p>Dùng phím mũi tên hoặc WASD khi canvas đang được focus; gamepad được đọc khi trình duyệt hỗ trợ.</p><canvas data-hgl1-game-canvas width=\"960\" height=\"540\" tabindex=\"0\" aria-label=\"Orbit Collector: điều khiển quỹ đạo để thu thập các điểm sáng\"></canvas><output data-hgl1-game-status aria-live=\"polite\">Chưa bắt đầu. Không có điểm số hay người chơi giả.</output></section>";
    }
    if (entry.route === "/galaxy/dev") {
      return "<section class=\"hgl1-functional-workspace hgl1-dev-workspace\" aria-labelledby=\"hgl1-dev-title\"><header class=\"hgl1-section-head\"><div><span class=\"hgl1-kicker\">Không thực thi tự động</span><h2 id=\"hgl1-dev-title\">Code workspace cục bộ</h2></div></header><form data-hgl1-dev-form><label for=\"hgl1-dev-name\">Tên snippet</label><input id=\"hgl1-dev-name\" name=\"title\" maxlength=\"160\" required/><label for=\"hgl1-dev-language\">Ngôn ngữ</label><select id=\"hgl1-dev-language\" name=\"language\"><option value=\"text\">Text</option><option value=\"html\">HTML</option><option value=\"css\">CSS</option><option value=\"javascript\">JavaScript</option><option value=\"json\">JSON</option></select><label for=\"hgl1-dev-code\">Mã nguồn</label><textarea id=\"hgl1-dev-code\" name=\"code\" maxlength=\"" + MAX_TEXT_LENGTH + "\" rows=\"12\" spellcheck=\"false\"></textarea><div class=\"hgl1-workspace-actions\"><button class=\"hgl1-button hgl1-button--primary\" type=\"submit\">Lưu snippet</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"inspect-dev-code\">Kiểm tra tĩnh</button></div></form><output class=\"hgl1-tool__output\" data-hgl1-dev-output aria-live=\"polite\">Mã không được chạy trong trang này.</output></section>";
    }
    if (entry.route === "/galaxy/community") {
      return "<section class=\"hgl1-functional-workspace hgl1-community-workspace\" aria-labelledby=\"hgl1-community-title\"><header class=\"hgl1-section-head\"><div><span class=\"hgl1-kicker\">Bản nháp cục bộ</span><h2 id=\"hgl1-community-title\">Soạn bài cộng đồng</h2></div><span class=\"hgl1-runtime-status\" data-hgl1-community-realtime data-state=\"unconfigured\" role=\"status\">Realtime chưa cấu hình</span></header><form data-hgl1-community-form><label for=\"hgl1-community-title-input\">Tiêu đề</label><input id=\"hgl1-community-title-input\" name=\"title\" maxlength=\"160\" required/><label for=\"hgl1-community-body\">Nội dung</label><textarea id=\"hgl1-community-body\" name=\"body\" maxlength=\"8000\" rows=\"8\" required></textarea><label for=\"hgl1-community-privacy\">Quyền riêng tư</label><select id=\"hgl1-community-privacy\" name=\"privacy\"><option value=\"private\">Chỉ mình tôi (bản nháp)</option><option value=\"group\">Nhóm — cần backend</option><option value=\"public\">Công khai — cần backend</option></select><button class=\"hgl1-button hgl1-button--primary\" type=\"submit\">Lưu bản nháp</button><p>Không có bài nào được đăng ra mạng khi backend chưa xác nhận.</p></form></section>";
    }
    return "";
  }

  function moduleMarkup(entry, state) {
    const definition = MODULES[entry.route];
    const items = state.items.filter(function routeItems(item) { return item.route === entry.route; }).slice().reverse();
    const userItems = items.map(itemMarkup).join("");
    const importControl = definition.fileAccept ? "<button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"trigger-file\" data-route=\"" + entry.route + "\">" + icon("upload") + " Nhập tệp</button><input class=\"hgl1-sr-only\" type=\"file\" tabindex=\"-1\" aria-label=\"Chọn tệp cho " + escapeHtml(entry.label) + "\" data-hgl1-module-file data-route=\"" + entry.route + "\" accept=\"" + escapeHtml(definition.fileAccept) + "\"/>" : "";
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
      "</section></div>" + worldRailMarkup(entry, { status: definition.status, itemCount: items.length, scope: "Trên thiết bị" }) + "</div></section>";
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
    return "<article class=\"hgl1-document hgl1-learning-resource" + (completed ? " is-complete" : "") + "\" data-hgl1-item data-hgl1-learning-resource data-learning-category=\"" + category + "\" data-filter-text=\"" + escapeHtml(normalizedSearchText(item.title + " " + item.description + " " + categoryLabels[category])) + "\">" +
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

  function learningMarkup(state) {
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
      "<section class=\"hgl1-learning-today\" aria-labelledby=\"hgl1-learning-today-title\"><header class=\"hgl1-section-head\"><div><span class=\"hgl1-kicker\">Hôm nay · " + escapeHtml(formatLearningDate(today)) + "</span><h2 id=\"hgl1-learning-today-title\">Bài học hôm nay</h2></div><span>" + todayPlans.length + " kế hoạch thật</span></header>" + todayMarkup + "</section>" +
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
      "<article class=\"hgl1-tool\"><div class=\"hgl1-tool__head\">" + icon("dev") + "<div><span class=\"hgl1-badge hgl1-badge--local\">Cục bộ</span><h2>JSON Formatter</h2></div></div><label for=\"hgl1-json-tool\">JSON đầu vào</label><textarea id=\"hgl1-json-tool\" data-hgl1-json-tool maxlength=\"" + MAX_TEXT_LENGTH + "\" rows=\"9\" spellcheck=\"false\" placeholder=\"{ &quot;hello&quot;: &quot;galaxy&quot; }\"></textarea><button class=\"hgl1-button hgl1-button--primary\" type=\"button\" data-hgl1-action=\"format-json\">Định dạng</button><output class=\"hgl1-tool__output hgl1-tool__output--code\" data-hgl1-json-output aria-live=\"polite\">Chưa có kết quả.</output></article></div>" +
      "<section class=\"hgl1-library\"><div class=\"hgl1-section-head\"><div><span class=\"hgl1-kicker\">Lịch sử do bạn lưu</span><h2>Ghi chú công cụ</h2></div></div><form class=\"hgl1-create-form\" data-hgl1-create-form data-route=\"/galaxy/tools\"><label for=\"hgl1-title-tools\">Tên ghi chú</label><div><input id=\"hgl1-title-tools\" name=\"title\" maxlength=\"160\" required/><button class=\"hgl1-button hgl1-button--primary\" type=\"submit\">Lưu</button></div></form><div class=\"hgl1-document-grid\">" + templateMarkup("/galaxy/tools") + items.map(itemMarkup).join("") + "</div></section></div>" +
      worldRailMarkup(entry, { status: "Hai tiện ích cục bộ sẵn sàng", itemCount: items.length, scope: "Trong trình duyệt" }) + "</div></section>";
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
      "<section class=\"hgl1-table-card\"><div class=\"hgl1-section-head\"><div><span class=\"hgl1-kicker\">Gần đây</span><h2>Nhật ký tối thiểu</h2></div><label>Khoảng thời gian<select data-hgl1-analytics-range><option value=\"today\" " + (range === "today" ? "selected" : "") + ">Hôm nay</option><option value=\"7d\" " + (range === "7d" ? "selected" : "") + ">7 ngày</option><option value=\"30d\" " + (range === "30d" ? "selected" : "") + ">30 ngày</option><option value=\"all\" " + (range === "all" ? "selected" : "") + ">Tất cả</option></select></label></div>" +
      (events ? "<div class=\"hgl1-table-wrap\"><table><thead><tr><th>Hoạt động</th><th>Module</th><th>Thời điểm</th></tr></thead><tbody>" + events + "</tbody></table></div>" : statePanel("empty", summary.consent ? "Chưa có sự kiện thật nào được ghi." : "Bật Analytics nếu bạn muốn lưu thống kê tối thiểu.")) +
      "<div class=\"hgl1-settings-actions\"><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"clear-analytics-events\" " + (state.events.length ? "" : "disabled") + ">Xóa nhật ký đã lưu</button></div></section></div>" + worldRailMarkup(entry, { status: summary.consent ? "Consent đang bật" : "Consent đang tắt", itemCount: summary.localItems, scope: "Chỉ trên thiết bị" }) + "</div></section>";
  }

  function backupPreviewMarkup(pending) {
    if (!pending || !pending.summary) return "";
    return "<div class=\"hgl1-backup-backdrop\" data-hgl1-backup-backdrop><section class=\"hgl1-backup-preview\" data-hgl1-backup-preview role=\"alertdialog\" aria-modal=\"true\" aria-labelledby=\"hgl1-backup-preview-title\" aria-describedby=\"hgl1-backup-preview-description\" tabindex=\"-1\"><span class=\"hgl1-kicker\">Xem trước an toàn</span><h2 id=\"hgl1-backup-preview-title\">Chưa thay đổi dữ liệu hiện tại</h2><p id=\"hgl1-backup-preview-description\">Tệp hợp lệ chứa " + pending.summary.items + " tài liệu và " + pending.summary.events + " sự kiện được consent.</p><fieldset><legend>Cách nhập</legend><label><input type=\"radio\" name=\"hgl1-backup-mode\" value=\"merge\" checked/> Hợp nhất với dữ liệu hiện tại</label><label><input type=\"radio\" name=\"hgl1-backup-mode\" value=\"replace\"/> Thay thế toàn bộ dữ liệu lớp 1</label></fieldset><div class=\"hgl1-settings-actions\"><button class=\"hgl1-button hgl1-button--primary\" type=\"button\" data-hgl1-action=\"confirm-backup-import\">Xác nhận nhập</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"cancel-backup-import\">Hủy</button></div></section></div>";
  }

  function settingsMarkup(state, ui) {
    const entry = findRoute("/galaxy/settings");
    const settings = sanitizeSettings(ui && ui.settingsDraft ? ui.settingsDraft : state.settings);
    const dirty = JSON.stringify(settings) !== JSON.stringify(state.settings);
    return "<section class=\"hgl1-page hgl1-page--settings\">" + worldHeroMarkup(entry, "") +
      "<div class=\"hgl1-world-layout\"><div class=\"hgl1-world-main\">" +
      "<form class=\"hgl1-settings-form\" data-hgl1-settings-form><div class=\"hgl1-settings-grid\"><fieldset class=\"hgl1-settings-card\"><legend>Trải nghiệm hiển thị</legend><span class=\"hgl1-kicker\">Giao diện</span><label>Chủ đề<select data-hgl1-setting=\"theme\"><option value=\"cosmic\" " + (settings.theme === "cosmic" ? "selected" : "") + ">Cosmic</option><option value=\"midnight\" " + (settings.theme === "midnight" ? "selected" : "") + ">Midnight</option></select></label><label>Mức hiệu ứng<select data-hgl1-setting=\"effects\"><option value=\"quiet\" " + (settings.effects === "quiet" ? "selected" : "") + ">Tĩnh</option><option value=\"balanced\" " + (settings.effects === "balanced" ? "selected" : "") + ">Cân bằng</option><option value=\"rich\" " + (settings.effects === "rich" ? "selected" : "") + ">Nổi bật</option></select></label><label>Độ tương phản<select data-hgl1-setting=\"contrast\"><option value=\"standard\" " + (settings.contrast === "standard" ? "selected" : "") + ">Tiêu chuẩn</option><option value=\"high\" " + (settings.contrast === "high" ? "selected" : "") + ">Cao</option></select></label><label>Giảm chuyển động<select data-hgl1-setting=\"reducedMotion\"><option value=\"system\" " + (settings.reducedMotion === "system" ? "selected" : "") + ">Theo hệ thống</option><option value=\"on\" " + (settings.reducedMotion === "on" ? "selected" : "") + ">Luôn bật</option><option value=\"off\" " + (settings.reducedMotion === "off" ? "selected" : "") + ">Luôn tắt</option></select></label><label>Tỉ lệ UI<select data-hgl1-setting=\"uiScale\"><option value=\"small\" " + (settings.uiScale === "small" ? "selected" : "") + ">Nhỏ</option><option value=\"medium\" " + (settings.uiScale === "medium" ? "selected" : "") + ">Mặc định</option><option value=\"large\" " + (settings.uiScale === "large" ? "selected" : "") + ">Lớn</option></select></label><label>Màu hỗ trợ<select data-hgl1-setting=\"colorVision\"><option value=\"standard\" " + (settings.colorVision === "standard" ? "selected" : "") + ">Tiêu chuẩn</option><option value=\"deuteranopia\" " + (settings.colorVision === "deuteranopia" ? "selected" : "") + ">Deuteranopia</option><option value=\"protanopia\" " + (settings.colorVision === "protanopia" ? "selected" : "") + ">Protanopia</option><option value=\"tritanopia\" " + (settings.colorVision === "tritanopia" ? "selected" : "") + ">Tritanopia</option></select></label></fieldset>" +
      "<section class=\"hgl1-settings-card\"><span class=\"hgl1-kicker\">Dữ liệu</span><h2>Sao lưu & khôi phục</h2><p>Bản sao lưu chỉ gồm cài đặt, tài liệu người dùng và sự kiện đang được consent. Không bao gồm bản mẫu.</p><div class=\"hgl1-settings-actions\"><button class=\"hgl1-button hgl1-button--primary\" type=\"button\" data-hgl1-action=\"export-backup\">" + icon("download") + " Xuất JSON</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"trigger-backup-import\">" + icon("upload") + " Nhập JSON</button><input class=\"hgl1-sr-only\" type=\"file\" tabindex=\"-1\" aria-label=\"Chọn tệp sao lưu HH Galaxy\" accept=\"application/json,.json\" data-hgl1-backup-file/></div><dl><div><dt>Tài liệu người dùng</dt><dd>" + state.items.length + "</dd></div><div><dt>Sự kiện consent</dt><dd>" + (settings.analyticsConsent ? state.events.length : 0) + "</dd></div><div><dt>Kho lưu trữ</dt><dd>" + escapeHtml(STORAGE_KEY) + "</dd></div></dl></section>" +
      "<section class=\"hgl1-settings-card hgl1-settings-card--wide\"><span class=\"hgl1-kicker\">Analytics</span><h2>Consent rõ ràng</h2><div class=\"hgl1-setting-row\"><div><p>Cho phép lưu sự kiện điều hướng và thao tác tối thiểu trên thiết bị.</p><small>Nội dung tài liệu không được đưa vào sự kiện.</small></div><label class=\"hgl1-switch\"><input type=\"checkbox\" aria-label=\"Cho phép Analytics cục bộ\" data-hgl1-setting=\"analyticsConsent\" " + (settings.analyticsConsent ? "checked" : "") + "/><span aria-hidden=\"true\"></span><b aria-hidden=\"true\">" + (settings.analyticsConsent ? "Đã bật" : "Đang tắt") + "</b></label></div></section></div><div class=\"hgl1-settings-commit\"><output data-hgl1-settings-status role=\"status\">" + (dirty ? "Có thay đổi chưa lưu." : "Cấu hình đã đồng bộ với bản lưu.") + "</output><div class=\"hgl1-settings-actions\"><button class=\"hgl1-button hgl1-button--primary\" type=\"submit\" data-hgl1-action=\"save-settings\" " + (dirty ? "" : "disabled") + ">Lưu thay đổi</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"cancel-settings\" " + (dirty ? "" : "disabled") + ">Hủy thay đổi</button><button class=\"hgl1-button hgl1-button--ghost\" type=\"button\" data-hgl1-action=\"restore-settings-defaults\">Khôi phục mặc định</button></div></div></form>" + backupPreviewMarkup(ui && ui.pendingBackup) + "</div>" +
      worldRailMarkup(entry, { status: "Thiết lập cục bộ", itemCount: state.items.length, scope: STORAGE_KEY }) + "</div></section>";
  }

  function routeContent(entry, state, ui) {
    if (ui && ui.status === "loading") return statePanel("loading");
    if (ui && ui.status === "error") return statePanel("error", ui.message || "Vui lòng kiểm tra quyền lưu trữ của trình duyệt.");
    if (entry.route === "/home") return homeMarkup();
    if (entry.route === "/galaxy/creator") return creatorMarkup(state);
    if (entry.route === "/galaxy/learning") return learningMarkup(state);
    if (entry.route === "/galaxy/tools") return toolsMarkup(state);
    if (entry.route === "/galaxy/analytics") return analyticsMarkup(state, ui);
    if (entry.route === "/galaxy/settings") return settingsMarkup(state, ui);
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
    const activeSettings = sanitizeSettings(ui.settingsDraft || state.settings);
    return "<div class=\"hh-galaxy-app\" data-hh-layer=\"galaxy\" data-route=\"" + entry.route + "\" data-theme=\"" + activeSettings.theme + "\" data-effects=\"" + activeSettings.effects + "\" data-contrast=\"" + activeSettings.contrast + "\" data-reduced-motion=\"" + activeSettings.reducedMotion + "\" data-ui-scale=\"" + activeSettings.uiScale + "\" data-color-vision=\"" + activeSettings.colorVision + "\">" +
      "<a class=\"hgl1-skip-link\" href=\"#hgl1-main\">Bỏ qua điều hướng</a><div class=\"hgl1-cosmos\" aria-hidden=\"true\"><i></i><i></i><i></i></div>" +
      "<aside class=\"hgl1-sidebar\" id=\"hgl1-sidebar\" data-hgl1-drawer role=\"dialog\" aria-modal=\"true\" aria-hidden=\"true\" aria-label=\"Điều hướng HH Galaxy\"><div class=\"hgl1-sidebar__head\"><div class=\"hgl1-product-mark\"><span>" + icon("home") + "</span><div><b>HH GALAXY MAP</b><small>Lớp 1 · Không gian độc lập</small></div></div><button class=\"hgl1-icon-button hgl1-sidebar__close\" type=\"button\" data-hgl1-action=\"close-drawer\" aria-label=\"Đóng menu\">" + icon("close") + "</button><div class=\"hgl1-brand\"><span>HH</span><div><b>HOANG8.COM</b><small>Galaxy Workspace</small></div></div>" + searchBoxMarkup(false) + "</div>" +
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
    runtime.communityRealtimeState = null;
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

    const currentChain = chain(currentRoot, currentIsland);
    const nextChain = chain(nextRoot, nextIsland);
    if (!currentChain.length || currentChain.length !== nextChain.length) return false;
    for (let index = 0; index < currentChain.length; index += 1) {
      if (currentChain[index].nodeName !== nextChain[index].nodeName) return false;
    }

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

  function render() {
    if (!runtime) return false;
    const inspection = inspectLocalState(runtime.storage);
    runtime.localState = inspection.data;
    runtime.storageStatus = inspection.status;
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
      analyticsRange: runtime.analyticsRange
    });
    let islandSelector = "";
    if (runtime.mediaSession && runtime.mediaSession.route === runtime.route) islandSelector = "[data-hgl1-stable-media-host]";
    else if (runtime.gameSession && runtime.route === "/galaxy/games") islandSelector = "[data-hgl1-game-canvas]";
    else if (runtime.route === "/home") islandSelector = "[data-hh-galaxy-home-host]";
    else if (runtime.route === "/galaxy/creator") islandSelector = "[data-hh-galaxy-creator-host]";
    const preserved = islandSelector && renderPreservingIsland(markup, islandSelector);
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
      const gameStatus = runtime.app.querySelector("[data-hgl1-game-status]");
      const gameButton = runtime.app.querySelector("[data-hgl1-action=\"toggle-game\"]");
      if (gameStatus) gameStatus.textContent = "Điểm phiên hiện tại: " + runtime.gameSession.score;
      if (gameButton) gameButton.textContent = "Tạm dừng";
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
    let body = "";
    let type = "";
    let name = "";
    if (format === "csv") {
      const rows = [["type", "route", "at"]].concat(events.map(function eventCells(event) { return [event.type, event.route, event.at]; }));
      body = rows.map(function csvRow(row) {
        return row.map(function csvCell(cell) { return "\"" + String(cell).replace(/"/g, "\"\"") + "\""; }).join(",");
      }).join("\r\n");
      type = "text/csv;charset=utf-8";
      name = "hh-galaxy-analytics.csv";
    } else {
      body = JSON.stringify({ schema: "hh-galaxy-analytics", version: VERSION, range: range, events: events }, null, 2);
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
      meta: { fileName: file.name, fileType: file.type, fileSize: file.size, learningCategory: match.route === "/galaxy/learning" ? "resource" : "" }
    });
    if (item) {
      const mediaOpened = openLocalMedia(file, match.route);
      render();
      showToast(mediaOpened ? "Đã mở media và lưu metadata trên thiết bị." : "Đã lưu metadata tệp trên thiết bị.", "success");
    } else {
      showToast("Không thể lưu metadata tệp.", "error");
    }
    input.value = "";
  }

  async function importBackupFile(input) {
    if (!runtime || !input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    if (file.size > BACKUP_MAX_BYTES) {
      showToast("Tệp sao lưu vượt quá giới hạn 2 MB.", "error");
      return;
    }
    try {
      const text = await file.text();
      const result = inspectBackup(text);
      if (!result.ok) {
        showToast("Tệp sao lưu không hợp lệ: " + result.error, "error");
        return;
      }
      runtime.pendingBackup = { candidate: result.candidate, summary: result.summary, fileName: String(file.name || "backup.json").slice(0, 180) };
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
    if (!runtime || !globalScope.document || globalScope.document.hidden !== true) return;
    if (runtime.mediaSession && runtime.mediaSession.element && typeof runtime.mediaSession.element.pause === "function") {
      try { runtime.mediaSession.element.pause(); } catch (_) { /* Browser owns the media state. */ }
    }
    stopGame();
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
    if (typeof globalScope.fetch !== "function") {
      showToast("Trình duyệt không hỗ trợ kết nối AI.", "error");
      return;
    }
    if (send) send.disabled = true;
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
      if (runtime === active && active.route === "/galaxy/ai" && send && send.isConnected) send.disabled = false;
    }
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
    if (!runtime || !runtime.mediaSession) return;
    const session = runtime.mediaSession;
    runtime.mediaSession = null;
    try {
      if (session.element && typeof session.element.pause === "function") session.element.pause();
      if (session.element && session.kind === "youtube") session.element.src = "about:blank";
      if (session.element && session.kind !== "youtube") {
        session.element.removeAttribute("src");
        if (typeof session.element.load === "function") session.element.load();
      }
      if (session.element && session.element.remove) session.element.remove();
      if (session.url && globalScope.URL && typeof globalScope.URL.revokeObjectURL === "function") globalScope.URL.revokeObjectURL(session.url);
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

  function openLocalMedia(file, route) {
    if (!runtime || !globalScope.document || !globalScope.URL || typeof globalScope.URL.createObjectURL !== "function") return false;
    const isAudio = route === "/galaxy/music" && String(file.type || "").startsWith("audio/");
    const isVideo = route === "/galaxy/video" && String(file.type || "").startsWith("video/");
    if (!isAudio && !isVideo) return false;
    const url = globalScope.URL.createObjectURL(file);
    const element = globalScope.document.createElement(isAudio ? "audio" : "video");
    element.controls = true;
    element.autoplay = false;
    element.preload = "metadata";
    element.src = url;
    if (isVideo) element.playsInline = true;
    element.setAttribute("aria-label", (isVideo ? "Video" : "Âm thanh") + " " + String(file.name || "đã chọn").slice(0, 180));
    const installed = installMediaElement(element, { route: route, url: url, kind: isAudio ? "audio" : "video", fileName: file.name });
    if (!installed) {
      globalScope.URL.revokeObjectURL(url);
      return false;
    }
    const status = runtime.app.querySelector("[data-hgl1-media-status]");
    if (status) status.textContent = "Đã mở " + file.name + " · chưa tự phát.";
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

  function stopGame() {
    if (!runtime || !runtime.gameSession) return;
    const session = runtime.gameSession;
    runtime.gameSession = null;
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
      if (status) status.textContent = "Đã tạm dừng · điểm phiên vừa rồi: " + session.score;
    }
  }

  function toggleGame() {
    if (!runtime || runtime.route !== "/galaxy/games") return;
    if (runtime.gameSession) {
      stopGame();
      showToast("Đã tạm dừng game cục bộ.", "info");
      return;
    }
    const canvas = runtime.app.querySelector("[data-hgl1-game-canvas]");
    const context = canvas && canvas.getContext && canvas.getContext("2d");
    if (!context || typeof globalScope.requestAnimationFrame !== "function") {
      showToast("Canvas game không khả dụng trên trình duyệt này.", "error");
      return;
    }
    const session = { canvas: canvas, context: context, keys: new Set(), x: 480, y: 270, score: 0, started: globalScope.performance && globalScope.performance.now ? globalScope.performance.now() : Date.now(), last: 0, target: { x: 180, y: 140 }, raf: 0 };
    session.keydown = function gameKeydown(event) {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        session.keys.add(event.key.toLocaleLowerCase());
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
      const delta = Math.min(0.05, Math.max(0, (now - (session.last || now)) / 1000));
      session.last = now;
      let dx = (session.keys.has("d") || session.keys.has("arrowright") ? 1 : 0) - (session.keys.has("a") || session.keys.has("arrowleft") ? 1 : 0);
      let dy = (session.keys.has("s") || session.keys.has("arrowdown") ? 1 : 0) - (session.keys.has("w") || session.keys.has("arrowup") ? 1 : 0);
      try {
        const pad = globalScope.navigator && globalScope.navigator.getGamepads && globalScope.navigator.getGamepads()[0];
        if (pad) { dx += Math.abs(pad.axes[0] || 0) > 0.18 ? pad.axes[0] : 0; dy += Math.abs(pad.axes[1] || 0) > 0.18 ? pad.axes[1] : 0; }
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
    runtime.gameSession = session;
    const button = runtime.app.querySelector("[data-hgl1-action=\"toggle-game\"]");
    const status = runtime.app.querySelector("[data-hgl1-game-status]");
    if (button) button.textContent = "Tạm dừng";
    if (status) status.textContent = "Đang chạy · điểm phiên hiện tại: 0";
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
    }
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
    updateSettingsDraftUi();
    showToast("Đã lưu cài đặt Galaxy.", "success");
    return true;
  }

  function clearAnalyticsEvents() {
    if (!runtime) return false;
    const state = collectLocalState(runtime.storage);
    if (!state.events.length) return true;
    const confirmed = typeof globalScope.confirm === "function" ? globalScope.confirm("Xóa toàn bộ nhật ký Analytics cục bộ? Thao tác này không thể hoàn tác.") : false;
    if (!confirmed) return false;
    state.events = [];
    const ok = writeLocalState(state, runtime.storage);
    if (ok) render();
    showToast(ok ? "Đã xóa nhật ký Analytics cục bộ." : "Không thể xóa nhật ký.", ok ? "success" : "error");
    return ok;
  }

  function confirmPendingBackup() {
    if (!runtime || !runtime.pendingBackup || !runtime.app) return false;
    const selected = runtime.app.querySelector("input[name=\"hgl1-backup-mode\"]:checked");
    const mode = selected && selected.value === "replace" ? "replace" : "merge";
    if (mode === "replace") {
      const confirmed = typeof globalScope.confirm === "function" ? globalScope.confirm("Thay thế toàn bộ dữ liệu HH Galaxy lớp 1 bằng bản sao lưu này?") : false;
      if (!confirmed) return false;
    }
    const result = applyBackup(runtime.pendingBackup.candidate, runtime.storage, mode);
    if (!result.ok) {
      showToast("Không thể nhập bản sao lưu: " + result.error, "error");
      return false;
    }
    runtime.pendingBackup = null;
    runtime.settingsDraft = null;
    render();
    const returnTarget = runtime.app && runtime.app.querySelector("[data-hgl1-action=\"trigger-backup-import\"]");
    if (returnTarget && typeof returnTarget.focus === "function") returnTarget.focus();
    showToast("Đã " + (mode === "merge" ? "hợp nhất" : "thay thế") + " " + result.imported + " tài liệu.", "success");
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
    else if (route === "/galaxy/games" && index === 2) navigate("/galaxy/settings");
    else if (route === "/galaxy/dev" && index === 0) runtime.app.querySelector("[data-hgl1-dev-form] input")?.focus();
    else if (route === "/galaxy/dev" && index === 1) navigate("/galaxy/tools");
    else if (route === "/galaxy/community" && index === 0) runtime.app.querySelector("[data-hgl1-community-form] input")?.focus();
    else showToast("Chức năng này chưa có adapter được cấu hình.", "info");
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
    else if (action === "open-capability") openCapability(control);
    else if (action === "probe-ai-provider") probeAiProvider(true);
    else if (action === "save-ai-draft") saveAiDraft();
    else if (action === "clear-ai-draft") {
      const input = runtime.app.querySelector("[data-hgl1-ai-draft]");
      const output = runtime.app.querySelector("[data-hgl1-ai-response]");
      if (input) { input.value = ""; input.focus(); }
      if (output) { output.textContent = "Hội thoại mới. Chưa gửi yêu cầu."; output.dataset.tone = "info"; }
    } else if (action === "toggle-game") toggleGame();
    else if (action === "inspect-dev-code") inspectDevCode();
    else if (action === "save-settings") saveSettingsDraft();
    else if (action === "cancel-settings") setSettingsControls(collectLocalState(runtime.storage).settings);
    else if (action === "restore-settings-defaults") setSettingsControls(defaultSettings());
    else if (action === "confirm-backup-import") confirmPendingBackup();
    else if (action === "cancel-backup-import") closePendingBackup("Đã hủy nhập bản sao lưu; dữ liệu không thay đổi.");
    else if (action === "clear-analytics-events") clearAnalyticsEvents();
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
    if (event.target.matches("[data-hgl1-global-search]")) updateGlobalSearch(event.target);
    else if (event.target.matches("[data-hgl1-item-filter]")) updateItemFilter(event.target);
    else if (event.target.matches("[data-hgl1-learning-search]")) applyLearningLibraryFilter(event.target);
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
    if (changed) {
      cleanupDelegate();
      cleanupRouteRuntime();
      cleanupMediaSession();
      stopGame();
      runtime.settingsDraft = null;
      runtime.pendingBackup = null;
    }
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
    cleanupDelegate();
    cleanupRouteRuntime();
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
      toastTimer: 0,
      settingsDraft: null,
      pendingBackup: null,
      analyticsRange: "30d",
      mediaSession: null,
      gameSession: null,
      aiProbe: null,
      aiRequest: null,
      aiProviderStatus: null,
      communitySocket: null,
      communityRealtimeState: null,
      drawerReturnFocus: null,
      drawerModal: true
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
