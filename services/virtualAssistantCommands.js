(function (global) {
  "use strict";

  const ROUTES = Object.freeze({
    home: "/home",
    japanese: "/japanese",
    english: "/english",
    youtubeBatch: "/davinci-resolve/youtube-batch",
    imageText: "/davinci-resolve/image-text",
    tools: "/davinci-resolve",
    work: "/work",
    learning: "/learn/review",
    notifications: "/communication/notifications",
    website: "/analytics"
  });
  const ALLOWED = new Set(Object.values(ROUTES));
  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.,!?]/g, " ").replace(/\s+/g, " ").trim();
  const routeResult = (route, reply) => ({ matched: true, kind: "route", route, reply });
  const controlResult = (control, reply) => ({ matched: true, kind: "control", control, reply });

  function match(input, context = {}) {
    const text = normalize(input);
    if (!text) return { matched: false, kind: "none", reply: "Bạn muốn Hikari giúp việc gì?" };
    if (/^(mo|dua toi den|di den).*hh japanese|tieng nhat/.test(text)) return routeResult(ROUTES.japanese, "Mình sẽ mở HH Japanese cho bạn.");
    if (/^(mo|dua toi den|di den).*hh english|tieng anh/.test(text)) return routeResult(ROUTES.english, "Mình sẽ mở HH English cho bạn.");
    if (/youtube batch|dang youtube hang loat/.test(text)) return routeResult(ROUTES.youtubeBatch, "Đang mở YouTube Batch Publisher.");
    if (/chen chu.*anh|text on image|thumbnail/.test(text)) return routeResult(ROUTES.imageText, "Đây là Text on Image Studio bạn cần.");
    if (/ve trang chu|mo trang chu/.test(text)) return routeResult(ROUTES.home, "Mình đưa bạn về trang chủ.");
    if (/mo cong cu gan nhat|tiep tuc cong viec/.test(text)) {
      const route = ALLOWED.has(context.recentRoute) ? context.recentRoute : ROUTES.home;
      return routeResult(route, route === ROUTES.home ? "Chưa có công cụ an toàn gần đây, mình mở trang chủ." : "Mình mở lại công cụ gần nhất.");
    }
    if (/bai hoc.*den han|on tap.*den han/.test(text)) return { matched: true, kind: "info", reply: context.lessonDue ? `Bạn có ${context.lessonDue} bài học hoặc thẻ ôn đến hạn.` : "Hiện không có bài học nào đến hạn trong dữ liệu đã lưu." };
    if (/hom nay.*viec|viec.*hom nay|nhiem vu.*hom nay/.test(text)) return { matched: true, kind: "info", reply: context.taskCount ? `Hôm nay bạn còn ${context.taskCount} công việc chưa hoàn thành.` : "Danh sách hôm nay chưa có công việc tồn đọng." };
    if (/trang thai website|backend|api health/.test(text)) return { matched: true, kind: "info", reply: `Mạng đang ${context.online ? "trực tuyến" : "ngoại tuyến"}. Backend: ${context.apiStatus || "chưa có dữ liệu"}.` };
    if (/thong bao.*moi|doc thong bao/.test(text)) return { matched: true, kind: "info", reply: context.unreadCount ? `Bạn có ${context.unreadCount} thông báo chưa đọc.` : "Bạn không có thông báo chưa đọc." };
    if (/tat giong|dung noi|im lang/.test(text)) return controlResult("voice-off", "Mình đã tắt giọng nói.");
    if (/bat giong|doc len|noi len/.test(text)) return controlResult("voice-on", "Giọng nói đã được bật sau thao tác của bạn.");
    if (/thu nho|an tro ly/.test(text)) return controlResult("minimize", "Mình sẽ thu nhỏ vào lõi H.");
    if (/mo tro ly|hien tro ly/.test(text)) return controlResult("open", "Hikari đã sẵn sàng.");
    if (/mo cong cu|trung tam cong cu/.test(text)) return routeResult(ROUTES.tools, "Mình mở trung tâm Tool.");
    if (/mo viec|quan ly cong viec/.test(text)) return routeResult(ROUTES.work, "Mình mở trung tâm Công việc.");
    if (/mo bai on|mo hoc tap/.test(text)) return routeResult(ROUTES.learning, "Mình mở bài ôn đến hạn.");
    return { matched: false, kind: "ai", reply: "Mình chưa nhận ra lệnh local này." };
  }

  function safeRoute(route) { return ALLOWED.has(String(route || "")); }
  global.HHVirtualAssistantCommands = Object.freeze({ ROUTES, ALLOWED, normalize, match, safeRoute });
})(window);
