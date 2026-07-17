(() => {
  "use strict";

  const MODULES = [
    {
      id: "search",
      icon: "G",
      eyebrow: "Tìm kiếm & xem",
      title: "Google + YouTube",
      description: "Tìm web và hình ảnh bằng Google Search Element/API chính thức; xem video bằng YouTube Player.",
      features: ["Web & hình ảnh", "Hàng đợi video", "Mini-player & PiP"],
      accent: "cyan",
      action: "search"
    },
    {
      id: "community",
      icon: "◎",
      eyebrow: "Mạng xã hội",
      title: "Community",
      description: "Bảng tin, bài viết, media, bình luận, nhóm và Messenger HH theo thời gian thực.",
      features: ["Bảng tin", "Nhóm & bạn bè", "Messenger"],
      accent: "pink",
      route: "/communication/community"
    },
    {
      id: "notifications",
      icon: "◉",
      eyebrow: "Cập nhật",
      title: "Notification Center",
      description: "Theo dõi thông báo cộng đồng, công việc, email và lịch trong một luồng ưu tiên.",
      features: ["Bộ lọc", "Đánh dấu đã đọc", "Ưu tiên"],
      accent: "yellow",
      route: "/communication/notification-center"
    },
    {
      id: "dashboard",
      icon: "ID",
      eyebrow: "Tài khoản",
      title: "User Dashboard",
      description: "Hồ sơ, hoạt động, nội dung đã lưu và các thiết lập hiển thị của bạn.",
      features: ["Hồ sơ", "Đã lưu", "Hoạt động"],
      accent: "violet",
      route: "/communication/user-dashboard"
    },
    {
      id: "feedback",
      icon: "✦",
      eyebrow: "Góp ý",
      title: "Feedback & Survey",
      description: "Gửi phản hồi, tham gia khảo sát và theo dõi các đề xuất đã đóng góp.",
      features: ["Phản hồi nhanh", "Khảo sát", "Lịch sử"],
      accent: "lime",
      route: "/communication/feedback-survey"
    },
    {
      id: "helpdesk",
      icon: "?",
      eyebrow: "Hỗ trợ",
      title: "Helpdesk / Ticketing",
      description: "Tạo yêu cầu hỗ trợ, đính kèm bằng chứng và theo dõi tiến độ xử lý.",
      features: ["Tạo ticket", "Trạng thái", "Tệp đính kèm"],
      accent: "orange",
      route: "/communication/helpdesk-ticketing"
    },
    {
      id: "referral",
      icon: "↗",
      eyebrow: "Kết nối",
      title: "Referral & Affiliate",
      description: "Quản lý liên kết giới thiệu, lượt truy cập và phần thưởng của cộng đồng HH.",
      features: ["Link cá nhân", "Thống kê", "Phần thưởng"],
      accent: "blue",
      route: "/communication/referral-affiliate"
    }
  ];

  const readArray = (key) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
  }[character]));

  function serviceCard(module) {
    const action = module.action === "search"
      ? 'data-search-watch-open="google"'
      : `data-app-route="${module.route}"`;
    return `<article class="comm-module comm-module--${module.accent}" data-comm-module="${module.id}">
      <div class="comm-module__top"><span class="comm-module__icon" aria-hidden="true">${module.icon}</span><span class="comm-module__status"><i></i>Sẵn sàng</span></div>
      <small>${module.eyebrow}</small>
      <h3>${module.title}</h3>
      <p>${module.description}</p>
      <div class="comm-module__features">${module.features.map((feature) => `<span>${feature}</span>`).join("")}</div>
      <button type="button" ${action}><span>Mở workspace</span><b aria-hidden="true">→</b></button>
    </article>`;
  }

  function updateClock(host) {
    const clock = host.querySelector("[data-comm-clock]");
    const date = host.querySelector("[data-comm-date]");
    if (!clock || !date) return;
    const now = new Date();
    clock.textContent = now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    date.textContent = now.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "long" });
  }

  async function updateServices(host, apiBase) {
    const status = host.querySelector("[data-comm-api-status]");
    const google = host.querySelector("[data-comm-google-status]");
    const youtube = host.querySelector("[data-comm-youtube-status]");
    if (!status || !apiBase) {
      if (status) status.textContent = "Chưa kết nối backend";
      return;
    }
    try {
      const response = await fetch(`${apiBase.replace(/\/$/, "")}/api/search/google?health=1`, { headers: { Accept: "application/json" }, cache: "no-store" });
      const data = await response.json();
      const onlineCount = [data.services?.google, data.services?.youtube].filter(Boolean).length;
      status.textContent = `${onlineCount}/2 dịch vụ tìm kiếm sẵn sàng`;
      google.textContent = data.services?.google ? "Trực tuyến" : "Cần cấu hình";
      youtube.textContent = data.services?.youtube ? "Trực tuyến" : "Cần cấu hình";
      google.closest("li")?.classList.toggle("is-online", Boolean(data.services?.google));
      youtube.closest("li")?.classList.toggle("is-online", Boolean(data.services?.youtube));
    } catch {
      status.textContent = "Backend đang ngoại tuyến";
    }
  }

  function mount(host, options = {}) {
    if (!host) return;
    if (window.HHCommunicationOverview?._clockTimer) window.clearInterval(window.HHCommunicationOverview._clockTimer);
    const recentVideos = readArray("hh.search-watch.youtube-recent");
    const favorites = readArray("hh.search-watch.youtube-favorites");
    const queue = readArray("hh.search-watch.youtube-queue");
    const searches = readArray("hh.search-watch.history");
    host.innerHTML = `<section class="communication-overview" aria-label="Tổng quan Giao tiếp">
      <header class="comm-hero">
        <div class="comm-hero__copy">
          <span class="comm-kicker"><i></i> COMMUNICATION WORKSPACE</span>
          <h2>Kết nối, tìm kiếm và chia sẻ<br>trong một nhịp làm việc.</h2>
          <p>Mở đúng công cụ bạn cần mà không phải rời HH Platform. Mỗi module bên dưới là một workspace độc lập.</p>
          <div class="comm-hero__actions">
            <button class="comm-primary" type="button" data-search-watch-open="google"><b>G</b>Tìm trên Google</button>
            <button type="button" data-search-watch-open="youtube"><b>▶</b>Mở YouTube</button>
            <button type="button" data-app-route="/communication/community"><b>◎</b>Vào Community</button>
          </div>
        </div>
        <div class="comm-hero__pulse" aria-label="Trạng thái workspace">
          <div class="comm-orbit" aria-hidden="true"><i></i><i></i><i></i><span>HH</span></div>
          <div><strong data-comm-clock>--:--:--</strong><span data-comm-date>Đang đồng bộ thời gian</span></div>
          <p><i></i><span data-comm-api-status>Đang kiểm tra dịch vụ...</span></p>
        </div>
      </header>

      <section class="comm-metrics" aria-label="Thống kê nhanh">
        <article><span>⌕</span><div><small>Lịch sử tìm kiếm</small><strong>${searches.length}</strong></div></article>
        <article><span>▶</span><div><small>Đã xem gần đây</small><strong>${recentVideos.length}</strong></div></article>
        <article><span>★</span><div><small>Video đã lưu</small><strong>${favorites.length}</strong></div></article>
        <article><span>≡</span><div><small>Trong hàng đợi</small><strong>${queue.length}</strong></div></article>
      </section>

      <div class="comm-section-heading"><div><span>7 WORKSPACES</span><h2>Chọn nơi bạn muốn bắt đầu</h2></div><label><span>⌕</span><input type="search" data-comm-filter placeholder="Tìm module giao tiếp..."></label></div>
      <div class="comm-module-grid" data-comm-modules>${MODULES.map(serviceCard).join("")}</div>

      <section class="comm-bottom-grid">
        <article class="comm-service-monitor"><header><div><span>LIVE STATUS</span><h3>Dịch vụ tìm kiếm</h3></div><button type="button" data-comm-refresh aria-label="Kiểm tra lại dịch vụ">↻</button></header><ul><li><i></i><div><strong>Google Search</strong><small>Web, hình ảnh và tài liệu</small></div><b data-comm-google-status>Đang kiểm tra</b></li><li><i></i><div><strong>YouTube Data API</strong><small>Tìm kiếm và metadata video</small></div><b data-comm-youtube-status>Đang kiểm tra</b></li><li class="is-online"><i></i><div><strong>YouTube Player</strong><small>NoCookie embed & Picture-in-Picture</small></div><b>Khả dụng</b></li></ul></article>
        <article class="comm-recent"><header><div><span>TIẾP TỤC XEM</span><h3>Video gần đây</h3></div><button type="button" data-search-watch-open="youtube">Mở thư viện</button></header><div>${recentVideos.slice(0, 3).map((video) => `<button type="button" data-comm-video="${escapeHtml(video.id)}"><img src="${escapeHtml(video.thumbnail || `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`)}" alt="" loading="lazy"><span><strong>${escapeHtml(video.title || "Video YouTube")}</strong><small>${escapeHtml(video.channel || "YouTube")}</small></span><b>▶</b></button>`).join("") || '<p>Chưa có video gần đây. Hãy mở YouTube và phát video đầu tiên.</p>'}</div></article>
      </section>
    </section>`;

    const tick = () => updateClock(host);
    tick();
    const clockTimer = window.setInterval(tick, 1000);
    window.HHCommunicationOverview._clockTimer = clockTimer;
    updateServices(host, options.apiBase || window.HH_REALTIME_URL || "");

    host.querySelector("[data-comm-filter]")?.addEventListener("input", (event) => {
      const query = event.currentTarget.value.trim().toLocaleLowerCase("vi");
      host.querySelectorAll("[data-comm-module]").forEach((card) => {
        card.hidden = Boolean(query) && !card.textContent.toLocaleLowerCase("vi").includes(query);
      });
    });
    host.querySelector("[data-comm-refresh]")?.addEventListener("click", () => updateServices(host, options.apiBase || window.HH_REALTIME_URL || ""));
    host.querySelectorAll("[data-comm-video]").forEach((button) => button.addEventListener("click", () => window.HHSearchWatch?.play(button.dataset.commVideo)));
  }

  function unmount() {
    if (window.HHCommunicationOverview?._clockTimer) window.clearInterval(window.HHCommunicationOverview._clockTimer);
    if (window.HHCommunicationOverview) window.HHCommunicationOverview._clockTimer = 0;
  }

  window.HHCommunicationOverview = { mount, unmount, _clockTimer: 0 };
})();
