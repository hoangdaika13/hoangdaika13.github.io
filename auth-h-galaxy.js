(() => {
  "use strict";

  const galaxy = document.querySelector("[data-hh-galaxy]");
  if (!galaxy) return;

  const gate = galaxy.closest("#authGate");
  const planets = [...galaxy.querySelectorAll("[data-hh-galaxy-key]")];
  const inspector = galaxy.querySelector("#hhGalaxyInspector");
  const featureNodes = [...galaxy.querySelectorAll("[data-hh-galaxy-features] li")];

  const categories = Object.freeze({
    home: {
      icon: "⌂",
      title: "Trang chủ",
      kicker: "TRUNG TÂM ĐIỀU KHIỂN",
      count: "1 MỤC",
      route: "#/home",
      accent: "#ffd76b",
      accent2: "#ff6e8f",
      description: "Tổng quan ngày, Command Center, thời tiết, thiết bị và các lối tắt quan trọng.",
      detail: "Theo dõi nhịp làm việc, mở nhanh tác vụ đang ưu tiên và gom các tín hiệu quan trọng vào một màn hình.",
      features: ["Dashboard", "Command Center", "Weather & AQI", "Sticky Notes", "Quick Actions"]
    },
    character: {
      icon: "3D",
      title: "Nhân vật 3D",
      kicker: "REALTIME CHARACTER STUDIO",
      count: "STUDIO 3D",
      route: "#/character-3d",
      accent: "#ff718a",
      accent2: "#8f6dff",
      description: "Tạo, điều khiển, diễn hoạt và xuất nhân vật 3D nguyên bản ngay trên website.",
      detail: "Viewport WebGL, rig, biểu cảm, giọng nói, lip-sync và quy trình xuất asset được gom trong một studio.",
      features: ["Character Studio", "Rig & Animation", "Expression", "Voice Lip-sync", "GLB Export"]
    },
    social: {
      icon: "SM",
      title: "Công cụ truyền thông xã hội",
      kicker: "SOCIAL CREATOR GALAXY",
      count: "85 TOOL",
      route: "#/social-media-tools",
      accent: "#63ead8",
      accent2: "#4a8cff",
      description: "Hệ sinh thái 85 công cụ nội dung, media, xuất bản, phân tích và quản lý đa nền tảng.",
      detail: "Preview trực tiếp, Tool Contract riêng, media pipeline và API chính thức khi tài khoản đã cấp quyền.",
      features: ["Live Preview", "Media Pipeline", "Publishing Hub", "Analytics", "Rights Manifest"]
    },
    system: {
      icon: "⚙",
      title: "Hệ thống",
      kicker: "CẤU HÌNH NỀN TẢNG",
      count: "7 MỤC",
      route: "#/system",
      accent: "#55f1ff",
      accent2: "#72ffa8",
      description: "Điều chỉnh giao diện, quyền riêng tư, PWA, widget, thông báo và trạng thái hệ thống.",
      detail: "Cá nhân hóa trải nghiệm, kiểm tra sức khỏe ứng dụng và quản lý các quyền hoạt động trên từng thiết bị.",
      features: ["Settings", "PWA Center", "Widget Engine", "Diagnostics", "Privacy"]
    },
    creative: {
      icon: "✦",
      title: "Sáng tạo",
      kicker: "AI CREATIVE UNIVERSE",
      count: "25 MỤC",
      route: "#/create",
      accent: "#ff68cf",
      accent2: "#9d72ff",
      description: "Biến ý tưởng thành nội dung bằng AI, prompt, chiến dịch và quy trình xuất bản tự động.",
      detail: "Từ brief ban đầu đến nội dung hoàn chỉnh: lên ý tưởng, tạo tài sản, tổ chức phiên bản và chuẩn bị xuất bản.",
      features: ["AI Center", "Creator Studio", "Prompt Lab", "Automation", "Campaign Flow"]
    },
    music: {
      icon: "♫",
      title: "Làm nhạc AI",
      kicker: "MUSIC PRODUCTION",
      count: "26 MỤC",
      route: "#/music-ai",
      accent: "#ffb35f",
      accent2: "#ff4c75",
      description: "Sáng tác, phối khí, dựng loop, mix & master và tạo visualizer cho bản nhạc.",
      detail: "Phát triển bài hát theo từng lớp âm thanh, quản lý project và hoàn thiện bản phát hành trong cùng một studio.",
      features: ["AI Composer", "DAW Workspace", "Mix & Master", "Visualizer", "Publishing"]
    },
    tools: {
      icon: "H",
      title: "Tool",
      kicker: "CREATOR TOOL UNIVERSE",
      count: "10 HỆ TOOL",
      route: "#/davinci-resolve",
      accent: "#6be8ff",
      accent2: "#786cff",
      description: "Bộ công cụ video, YouTube, Facebook, TikTok, thumbnail, phụ đề và tự động hóa sáng tạo.",
      detail: "Kết nối các studio chuyên biệt với hàng đợi, media library và luồng xuất bản dùng được thật.",
      features: ["Video Studio", "YouTube Galaxy", "Facebook Center", "TikTok Galaxy", "AI Video"]
    },
    comicMotion: {
      icon: "CM",
      title: "Comic Motion",
      kicker: "COMIC MOTION STUDIO",
      count: "STUDIO",
      route: "#/comic-motion-studio",
      accent: "#ffb15d",
      accent2: "#ff6978",
      description: "Biến khung truyện và hình ảnh thành cảnh chuyển động, camera và hiệu ứng điện ảnh.",
      detail: "Tổ chức panel, timing, chuyển cảnh, phụ đề và xuất video từ một project không phá hủy.",
      features: ["Panel Motion", "Camera", "FX", "Subtitle", "Video Export"]
    },
    comicReader: {
      icon: "CR",
      title: "Đọc truyện",
      kicker: "HH COMICS READER",
      count: "THƯ VIỆN",
      route: "#/comic-reader",
      accent: "#ff8f70",
      accent2: "#ff4eaa",
      description: "Kho truyện và sách có nguồn, tìm kiếm, theo dõi, lịch sử và nhiều chế độ đọc.",
      detail: "Catalog, API được phép, thư viện cá nhân và reader responsive được quản lý trong một nơi.",
      features: ["Catalog", "Reader", "Theo dõi", "Lịch sử", "Nguồn hợp lệ"]
    },
    media: {
      icon: "◈",
      title: "Media & Design",
      kicker: "MEDIA PRODUCTION",
      count: "22 MỤC",
      route: "#/media-design",
      accent: "#a8ff68",
      accent2: "#4de9ff",
      description: "Không gian sản xuất ảnh, video, thumbnail, nội dung đa phương tiện và xuất bản.",
      detail: "Xử lý media theo quy trình có cấu trúc, xem trước nhiều định dạng và chuẩn hóa đầu ra cho từng nền tảng.",
      features: ["Photo Editor", "Video Studio", "Thumbnail Lab", "Publishing", "Asset Library"]
    },
    graphic: {
      icon: "✺",
      title: "Thiết kế đồ họa",
      kicker: "GRAPHIC DESIGN",
      count: "25 MỤC",
      route: "#/graphic-design",
      accent: "#c49aff",
      accent2: "#6d7cff",
      description: "Thiết kế vector, typography, nhân vật, mockup, chuyển động và hệ thống component.",
      detail: "Xây dựng thiết kế không phá hủy, tái sử dụng component và xuất nhiều phiên bản từ một nguồn sáng tạo.",
      features: ["Vector Core", "Typography", "Mockup", "Motion Design", "Components"]
    },
    dev: {
      icon: "⌘",
      title: "DEV",
      kicker: "DEVELOPER TOOLKIT",
      count: "34 MỤC",
      route: "#/dev-tools",
      accent: "#66d7ff",
      accent2: "#6f86ff",
      description: "Bộ công cụ lập trình, API, Git, regex, cơ sở dữ liệu, bảo mật và chẩn đoán.",
      detail: "Thiết kế, kiểm thử và chẩn đoán luồng kỹ thuật với các workspace chuyên biệt cho quá trình phát triển.",
      features: ["API Studio", "Git Workspace", "Regex Database", "Security", "Diagnostics"]
    },
    work: {
      icon: "□",
      title: "Công việc",
      kicker: "WORK OPERATIONS",
      count: "9 MỤC",
      route: "#/work",
      accent: "#ff79d7",
      accent2: "#b66dff",
      description: "Quản lý dự án, task, tài liệu, cửa hàng số, tệp tải xuống và tiến độ nhóm.",
      detail: "Lập kế hoạch, theo dõi tiến độ, lưu bằng chứng công việc và chuyển giao đầu ra trong một luồng thống nhất.",
      features: ["Project Center", "Task Flow", "Digital Store", "Cloud Files", "Team Board"]
    },
    communication: {
      icon: "◌",
      title: "Giao tiếp",
      kicker: "COMMUNICATION HUB",
      count: "21 MỤC",
      route: "#/communication",
      accent: "#5ff5dc",
      accent2: "#48bfff",
      description: "Kết nối cộng đồng qua messenger, forum, phòng trực tiếp và trung tâm thông báo.",
      detail: "Trao đổi theo phòng, theo dõi hội thoại quan trọng và cộng tác trực tiếp mà không rời khỏi HH Platform.",
      features: ["Community", "Messenger", "Forum", "Live Room", "Notifications"]
    },
    entertainment: {
      icon: "◉",
      title: "Game",
      kicker: "GAME UNIVERSE",
      count: "30 GAME",
      route: "#/entertainment",
      accent: "#ffd46a",
      accent2: "#ff754f",
      description: "Thư giãn với game center, arcade và hành trình khám phá không gian ASTRA.",
      detail: "Khám phá trải nghiệm tương tác, thử thách điểm số và những hành trình vũ trụ có thể chơi ngay trên trình duyệt.",
      features: ["Game Center", "Arcade", "ASTRA Space", "Realtime Play", "Achievements"]
    },
    cinema: {
      icon: "▶",
      title: "Phim",
      kicker: "OPEN CINEMA",
      count: "PHIM MỞ",
      route: "#/cinema",
      accent: "#7b8cff",
      accent2: "#bc6cff",
      description: "Thư viện phim công cộng và phim có giấy phép mở với hồ sơ quyền minh bạch.",
      detail: "Mỗi phim đi cùng nguồn, giấy phép, ghi công, player và trạng thái kiểm duyệt trước khi xuất bản.",
      features: ["Open Films", "Player", "Subtitle", "Attribution", "Rights Registry"]
    },
    musicLibrary: {
      icon: "♪",
      title: "Nhạc",
      kicker: "OPEN MUSIC LIBRARY",
      count: "NHẠC MỞ",
      route: "#/music",
      accent: "#54e6bd",
      accent2: "#45a4ff",
      description: "Nghe và tải nhạc Public Domain hoặc Creative Commons đã lưu nguồn và giấy phép.",
      detail: "Playlist, Creator Mode và License Pack giúp tìm đúng bản nhạc phù hợp cho từng nội dung.",
      features: ["Playlist", "Creator Mode", "License Pack", "Credits", "Global Music"]
    },
    copyright: {
      icon: "©",
      title: "Bản quyền",
      kicker: "RIGHTS & COMPLIANCE",
      count: "KIỂM DUYỆT",
      route: "#/copyright",
      accent: "#f7c86a",
      accent2: "#ff8a62",
      description: "Trung tâm kiểm tra quyền, hồ sơ nguồn, ghi công và tiếp nhận khiếu nại nội dung.",
      detail: "Quản lý bằng chứng giấy phép, trạng thái duyệt và quy trình tạm gỡ an toàn cho từng asset.",
      features: ["Rights Registry", "License Gate", "Attribution", "Takedown", "Evidence"]
    },
    analytics: {
      icon: "↗",
      title: "Phân tích",
      kicker: "INSIGHTS & ANALYTICS",
      count: "8 MỤC",
      route: "#/analytics",
      accent: "#69c8ff",
      accent2: "#6575ff",
      description: "Theo dõi hành trình, hiệu suất, Web Vitals, báo cáo và tín hiệu vận hành.",
      detail: "Biến dữ liệu hoạt động thành tín hiệu dễ đọc để phát hiện xu hướng, điểm nghẽn và cơ hội cải thiện.",
      features: ["Realtime Insights", "Web Vitals", "Reports", "Admin Panel", "Journey Map"]
    },
    learning: {
      icon: "◫",
      title: "Học tập",
      kicker: "LEARNING PLATFORM",
      count: "17 MỤC",
      route: "#/learn",
      accent: "#f19aff",
      accent2: "#8d72ff",
      description: "Xây dựng lộ trình học, lớp học, bài luyện tập, ôn tập và kho kiến thức.",
      detail: "Học theo lộ trình rõ ràng, luyện tập theo bước và lưu tiến độ để tiếp tục đúng nơi bạn đã dừng.",
      features: ["Learning Paths", "Classroom", "Review", "Knowledge Center", "Study Coach"]
    },
    english: {
      icon: "E",
      title: "HH English",
      kicker: "ENGLISH AI COACH",
      count: "A1 → C2",
      route: "#/english",
      accent: "#d8ff78",
      accent2: "#55e58b",
      description: "Học tiếng Anh theo CEFR, luyện phát âm, hội thoại nghề nghiệp và lộ trình cá nhân.",
      detail: "Kết hợp bài học theo cấp độ, luyện giọng nói và ngữ cảnh nghề nghiệp để tạo kế hoạch học phù hợp.",
      features: ["CEFR Courses", "Voice Coach", "Career English", "Placement", "Vocabulary"]
    },
    japanese: {
      icon: "日",
      title: "HH Japanese",
      kicker: "JAPANESE OS V3",
      count: "N5 → N1 · JF",
      route: "#/japanese",
      accent: "#ff6b8a",
      accent2: "#9d6bff",
      description: "Học tiếng Nhật theo Can-do với Vietnamese Core, JLPT/JF, Kanji Graph, Smart Reader và hội thoại.",
      detail: "Tra cứu Nhật–Việt, học offline, luyện mora và shadowing, mô phỏng JLPT, theo dõi SRS và tiến độ giao tiếp trong một lộ trình.",
      features: ["Vietnamese Core", "Kanji Graph", "Smart Reader", "JLPT Simulator", "Life in Japan"]
    },
    fortune: {
      icon: "☾",
      title: "Xem bói",
      kicker: "REFLECTION & SYMBOLS",
      count: "15 CÔNG CỤ",
      route: "#/fortune",
      accent: "#a983ff",
      accent2: "#54dce5",
      description: "Tarot 1–10 lá, 64 quẻ, bản đồ sao, thần số, lịch chiêm nghiệm và Gemini Reflection Copilot.",
      detail: "Mỗi kết quả có giải thích nhiều tầng, công thức, seed và giới hạn rõ ràng; dữ liệu nhạy cảm mặc định chỉ nằm trong phiên.",
      features: ["Tarot Studio", "Kinh Dịch 64 quẻ", "Bản đồ sao", "Lịch chiêm nghiệm", "Gemini Copilot"]
    },
    chatAI: {
      icon: "AI",
      title: "Chat AI",
      kicker: "GEMINI MULTIMODAL",
      count: "6 CHẾ ĐỘ",
      route: "#/chat-ai",
      accent: "#71e9ff",
      accent2: "#866fff",
      description: "Trò chuyện Gemini nhiều lượt, nghiên cứu có nguồn, phân tích ảnh/PDF, viết và lập trình.",
      detail: "API key được giữ trên Vercel; lịch sử tách theo tài khoản, có chế độ riêng tư, nhánh hội thoại, giọng nói và xuất dữ liệu.",
      features: ["Gemini 3.6", "Google Search", "Ảnh & PDF", "Code", "Voice"]
    },
    support: {
      icon: "♥",
      title: "Ủng hộ HH",
      kicker: "SUPPORT THE CREATOR",
      count: "KẾT NỐI",
      route: "#/support",
      accent: "#ff8a6c",
      accent2: "#ff5ca8",
      description: "Ủng hộ nhà phát triển, gửi phản hồi, xem roadmap và kết nối trung tâm hỗ trợ.",
      detail: "Đồng hành cùng quá trình phát triển HH, góp ý cho tính năng tiếp theo và nhận hỗ trợ khi cần.",
      features: ["Ủng hộ", "Feedback", "Roadmap", "Support Center", "Creator Updates"]
    }
  });

  let pinnedKey = planets[0]?.dataset.hhGalaxyKey || "home";

  const write = (selector, value) => {
    const node = galaxy.querySelector(selector);
    if (node) node.textContent = value;
  };

  const selectPlanet = (key, { pin = false, focus = false } = {}) => {
    const data = categories[key];
    const planet = planets.find((item) => item.dataset.hhGalaxyKey === key);
    if (!data || !planet) return false;
    if (pin) pinnedKey = key;

    planets.forEach((item) => {
      const active = item === planet;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
      item.tabIndex = active ? 0 : -1;
      item.closest(".hh-galaxy-orbit")?.classList.toggle("is-selected-orbit", active);
    });

    galaxy.dataset.activeCategory = key;
    galaxy.style.setProperty("--galaxy-accent", data.accent);
    galaxy.style.setProperty("--galaxy-accent-2", data.accent2);
    gate?.style.setProperty("--auth-planet-accent", data.accent);
    gate?.style.setProperty("--auth-planet-accent-2", data.accent2);
    if (gate) gate.dataset.hhPlanetTheme = key;
    inspector?.setAttribute("data-theme", key);
    write("[data-hh-galaxy-index]", `HÀNH TINH ${String(planets.indexOf(planet) + 1).padStart(2, "0")} / ${String(planets.length).padStart(2, "0")}`);
    write("[data-hh-galaxy-icon]", data.icon);
    write("[data-hh-galaxy-kicker]", data.kicker);
    write("[data-hh-galaxy-title]", data.title);
    write("[data-hh-galaxy-count]", data.count);
    write("[data-hh-galaxy-description]", data.description);
    write("[data-hh-galaxy-detail]", data.detail);
    write("[data-hh-galaxy-route]", data.route);
    featureNodes.forEach((node, index) => {
      node.textContent = data.features[index] || "";
      node.hidden = !data.features[index];
    });

    planets.forEach((item) => {
      const itemData = categories[item.dataset.hhGalaxyKey];
      if (itemData) {
        item.setAttribute("aria-label", `${itemData.title}: ${itemData.description}`);
        item.title = `${itemData.title} · ${itemData.count}`;
      }
    });

    if (focus) planet.focus({ preventScroll: true });
    galaxy.dispatchEvent(new CustomEvent("hh:galaxy-category-change", {
      detail: { key, route: data.route, title: data.title, accent: data.accent, accent2: data.accent2, pinned: pin }
    }));
    return true;
  };

  galaxy.addEventListener("pointerover", (event) => {
    const planet = event.target.closest?.("[data-hh-galaxy-key]");
    if (!planet || planet.contains(event.relatedTarget)) return;
    selectPlanet(planet.dataset.hhGalaxyKey);
  });

  galaxy.addEventListener("pointerout", (event) => {
    const planet = event.target.closest?.("[data-hh-galaxy-key]");
    if (!planet || planet.contains(event.relatedTarget)) return;
    selectPlanet(pinnedKey);
  });

  galaxy.addEventListener("focusin", (event) => {
    const planet = event.target.closest?.("[data-hh-galaxy-key]");
    if (planet) selectPlanet(planet.dataset.hhGalaxyKey);
  });

  galaxy.addEventListener("focusout", (event) => {
    if (!event.relatedTarget?.closest?.("[data-hh-galaxy]")) selectPlanet(pinnedKey);
  });

  galaxy.addEventListener("click", (event) => {
    const planet = event.target.closest?.("[data-hh-galaxy-key]");
    if (planet) selectPlanet(planet.dataset.hhGalaxyKey, { pin: true, focus: true });
  });

  galaxy.addEventListener("keydown", (event) => {
    const planet = event.target.closest?.("[data-hh-galaxy-key]");
    if (!planet || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const current = Math.max(0, planets.indexOf(planet));
    let next = current;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (current - 1 + planets.length) % planets.length;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (current + 1) % planets.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = planets.length - 1;
    selectPlanet(planets[next].dataset.hhGalaxyKey, { pin: true, focus: true });
  });

  selectPlanet(pinnedKey, { pin: true });
  window.HHHGalaxy = Object.freeze({
    categories,
    select: (key) => selectPlanet(key, { pin: true }),
    current: () => pinnedKey
  });
})();
