(() => {
  "use strict";

  const MODULES = [
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

  function serviceCard(module) {
    return `<article class="comm-module comm-module--${module.accent}" data-comm-module="${module.id}">
      <div class="comm-module__top"><span class="comm-module__icon" aria-hidden="true">${module.icon}</span><span class="comm-module__status"><i></i>Sẵn sàng</span></div>
      <small>${module.eyebrow}</small>
      <h3>${module.title}</h3>
      <p>${module.description}</p>
      <div class="comm-module__features">${module.features.map((feature) => `<span>${feature}</span>`).join("")}</div>
      <button type="button" data-app-route="${module.route}"><span>Mở workspace</span><b aria-hidden="true">→</b></button>
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

  function mount(host, options = {}) {
    if (!host) return;
    if (window.HHCommunicationOverview?._clockTimer) window.clearInterval(window.HHCommunicationOverview._clockTimer);
    host.innerHTML = `<section class="communication-overview" aria-label="Tổng quan Giao tiếp">
      <header class="comm-hero">
        <div class="comm-hero__copy">
          <span class="comm-kicker"><i></i> COMMUNICATION WORKSPACE</span>
          <h2>Trò chuyện, cộng tác và chia sẻ<br>trong một nhịp làm việc.</h2>
          <p>Tin nhắn, cộng đồng, thông báo và hỗ trợ được tổ chức thành từng workspace độc lập, rõ ràng và an toàn.</p>
          <div class="comm-hero__actions">
            <button class="comm-primary" type="button" data-app-route="/communication/messenger"><b>✦</b>Mở Messenger</button>
            <button type="button" data-app-route="/communication/community"><b>◎</b>Vào Community</button>
            <button type="button" data-app-route="/communication/notification-center"><b>◉</b>Xem thông báo</button>
          </div>
        </div>
        <div class="comm-hero__pulse" aria-label="Trạng thái workspace">
          <div class="comm-orbit" aria-hidden="true"><i></i><i></i><i></i><span>HH</span></div>
          <div><strong data-comm-clock>--:--:--</strong><span data-comm-date>Đang đồng bộ thời gian</span></div>
          <p><i></i><span>Communication Hub sẵn sàng</span></p>
        </div>
      </header>

      <section class="comm-metrics" aria-label="Thống kê nhanh">
        <article><span>◎</span><div><small>Cộng đồng</small><strong>Live</strong></div></article>
        <article><span>✦</span><div><small>Tin nhắn</small><strong>Realtime</strong></div></article>
        <article><span>◉</span><div><small>Thông báo</small><strong>Smart</strong></div></article>
        <article><span>?</span><div><small>Hỗ trợ</small><strong>24/7</strong></div></article>
      </section>

      <div class="comm-section-heading"><div><span>6 WORKSPACES</span><h2>Chọn nơi bạn muốn bắt đầu</h2></div><label><span>⌕</span><input type="search" data-comm-filter placeholder="Lọc module giao tiếp..."></label></div>
      <div class="comm-module-grid" data-comm-modules>${MODULES.map(serviceCard).join("")}</div>

      <section class="comm-bottom-grid">
        <article class="comm-service-monitor"><header><div><span>COMMUNICATION STATUS</span><h3>Kết nối và bảo mật</h3></div></header><ul><li class="is-online"><i></i><div><strong>Messenger HH</strong><small>Tin nhắn và đồng bộ phòng</small></div><b>Sẵn sàng</b></li><li class="is-online"><i></i><div><strong>Community</strong><small>Bài viết, nhóm và bình luận</small></div><b>Sẵn sàng</b></li><li class="is-online"><i></i><div><strong>Helpdesk</strong><small>Ticket và tệp đính kèm</small></div><b>Sẵn sàng</b></li></ul></article>
        <article class="comm-recent"><header><div><span>LỐI TẮT</span><h3>Tiếp tục giao tiếp</h3></div></header><div><button type="button" data-app-route="/communication/unified-inbox"><span><strong>Hộp thư chung</strong><small>Tổng hợp nội dung cần xử lý</small></span><b>→</b></button><button type="button" data-app-route="/communication/live-room"><span><strong>Live Room & Calls</strong><small>Gọi và cộng tác thời gian thực</small></span><b>→</b></button><button type="button" data-app-route="/communication/smart-catch-up"><span><strong>Smart Catch-up</strong><small>Nắm lại nội dung quan trọng</small></span><b>→</b></button></div></article>
      </section>
    </section>`;

    const tick = () => updateClock(host);
    tick();
    const clockTimer = window.setInterval(tick, 1000);
    window.HHCommunicationOverview._clockTimer = clockTimer;
    host.querySelector("[data-comm-filter]")?.addEventListener("input", (event) => {
      const query = event.currentTarget.value.trim().toLocaleLowerCase("vi");
      host.querySelectorAll("[data-comm-module]").forEach((card) => {
        card.hidden = Boolean(query) && !card.textContent.toLocaleLowerCase("vi").includes(query);
      });
    });
  }

  function unmount() {
    if (window.HHCommunicationOverview?._clockTimer) window.clearInterval(window.HHCommunicationOverview._clockTimer);
    if (window.HHCommunicationOverview) window.HHCommunicationOverview._clockTimer = 0;
  }

  window.HHCommunicationOverview = { mount, unmount, _clockTimer: 0 };
})();
