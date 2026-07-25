(() => {
  "use strict";

  const galaxy = document.querySelector("[data-hh-galaxy]");
  if (!galaxy) return;

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
      description: "Tổng quan ngày, Command Center, thời tiết, thiết bị và các lối tắt quan trọng.",
      features: ["Dashboard", "Command Center", "Weather & AQI", "Sticky Notes"]
    },
    system: {
      icon: "⚙",
      title: "Hệ thống",
      kicker: "CẤU HÌNH NỀN TẢNG",
      count: "7 MỤC",
      route: "#/system",
      description: "Điều chỉnh giao diện, quyền riêng tư, PWA, widget, thông báo và trạng thái hệ thống.",
      features: ["Settings", "PWA Center", "Widget Engine", "Diagnostics"]
    },
    creative: {
      icon: "✦",
      title: "Sáng tạo",
      kicker: "AI CREATIVE UNIVERSE",
      count: "25 MỤC",
      route: "#/create",
      description: "Biến ý tưởng thành nội dung bằng AI, prompt, chiến dịch và quy trình xuất bản tự động.",
      features: ["AI Center", "Creator Studio", "Prompt Lab", "Automation"]
    },
    music: {
      icon: "♫",
      title: "Làm nhạc AI",
      kicker: "MUSIC PRODUCTION",
      count: "26 MỤC",
      route: "#/music-ai",
      description: "Sáng tác, phối khí, dựng loop, mix & master và tạo visualizer cho bản nhạc.",
      features: ["AI Composer", "DAW Workspace", "Mix & Master", "Visualizer"]
    },
    media: {
      icon: "◈",
      title: "Media & Design",
      kicker: "MEDIA PRODUCTION",
      count: "22 MỤC",
      route: "#/media-design",
      description: "Không gian sản xuất ảnh, video, thumbnail, nội dung đa phương tiện và xuất bản.",
      features: ["Photo Editor", "Video Studio", "Thumbnail Lab", "Publishing"]
    },
    graphic: {
      icon: "✺",
      title: "Thiết kế đồ họa",
      kicker: "GRAPHIC DESIGN",
      count: "25 MỤC",
      route: "#/graphic-design",
      description: "Thiết kế vector, typography, nhân vật, mockup, chuyển động và hệ thống component.",
      features: ["Vector Core", "Typography", "Mockup", "Motion Design"]
    },
    dev: {
      icon: "⌘",
      title: "DEV",
      kicker: "DEVELOPER TOOLKIT",
      count: "34 MỤC",
      route: "#/dev-tools",
      description: "Bộ công cụ lập trình, API, Git, regex, cơ sở dữ liệu, bảo mật và chẩn đoán.",
      features: ["API Studio", "Git Workspace", "Regex Database", "Security"]
    },
    work: {
      icon: "□",
      title: "Công việc",
      kicker: "WORK OPERATIONS",
      count: "9 MỤC",
      route: "#/work",
      description: "Quản lý dự án, task, tài liệu, cửa hàng số, tệp tải xuống và tiến độ nhóm.",
      features: ["Project Center", "Task Flow", "Digital Store", "Cloud Files"]
    },
    communication: {
      icon: "◌",
      title: "Giao tiếp",
      kicker: "COMMUNICATION HUB",
      count: "21 MỤC",
      route: "#/communication",
      description: "Kết nối cộng đồng qua messenger, forum, phòng trực tiếp và trung tâm thông báo.",
      features: ["Community", "Messenger", "Forum", "Live Room"]
    },
    entertainment: {
      icon: "◉",
      title: "Giải trí",
      kicker: "ENTERTAINMENT",
      count: "3 MỤC",
      route: "#/entertainment",
      description: "Thư giãn với game center, arcade và hành trình khám phá không gian ASTRA.",
      features: ["Game Center", "Arcade", "ASTRA Space", "Realtime Play"]
    },
    analytics: {
      icon: "↗",
      title: "Phân tích",
      kicker: "INSIGHTS & ANALYTICS",
      count: "8 MỤC",
      route: "#/analytics",
      description: "Theo dõi hành trình, hiệu suất, Web Vitals, báo cáo và tín hiệu vận hành.",
      features: ["Realtime Insights", "Web Vitals", "Reports", "Admin Panel"]
    },
    learning: {
      icon: "◫",
      title: "Học tập",
      kicker: "LEARNING PLATFORM",
      count: "17 MỤC",
      route: "#/learn",
      description: "Xây dựng lộ trình học, lớp học, bài luyện tập, ôn tập và kho kiến thức.",
      features: ["Learning Paths", "Classroom", "Review", "Knowledge Center"]
    },
    english: {
      icon: "E",
      title: "HH English",
      kicker: "ENGLISH AI COACH",
      count: "A1 → C2",
      route: "#/english",
      description: "Học tiếng Anh theo CEFR, luyện phát âm, hội thoại nghề nghiệp và lộ trình cá nhân.",
      features: ["CEFR Courses", "Voice Coach", "Career English", "Placement"]
    },
    support: {
      icon: "♥",
      title: "Ủng hộ HH",
      kicker: "SUPPORT THE CREATOR",
      count: "KẾT NỐI",
      route: "#/support",
      description: "Ủng hộ nhà phát triển, gửi phản hồi, xem roadmap và kết nối trung tâm hỗ trợ.",
      features: ["Ủng hộ", "Feedback", "Roadmap", "Support Center"]
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
    write("[data-hh-galaxy-index]", `HÀNH TINH ${String(planets.indexOf(planet) + 1).padStart(2, "0")} / ${String(planets.length).padStart(2, "0")}`);
    write("[data-hh-galaxy-icon]", data.icon);
    write("[data-hh-galaxy-kicker]", data.kicker);
    write("[data-hh-galaxy-title]", data.title);
    write("[data-hh-galaxy-count]", data.count);
    write("[data-hh-galaxy-description]", data.description);
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
      detail: { key, route: data.route, title: data.title, pinned: pin }
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
