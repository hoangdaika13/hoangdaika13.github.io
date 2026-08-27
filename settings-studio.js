(() => {
  "use strict";

  const STORAGE_KEY = "hh.settings-studio.v1";
  const HISTORY_KEY = "hh.settings-studio.history.v1";
  const THEME_KEY = "hh.command-center.theme.v1";
  const THEME_PREFERENCES_KEY = "hh.app-theme.preferences.v1";
  const SHELL_KEY = "hh.app-shell.v1";
  const SCHEMA_VERSION = 2;
  const MAX_HISTORY = 12;
  const THEME_IDS = ["cosmic", "midnight", "aurora", "light"];
  const instances = new WeakMap();
  let activeInstance = null;

  const DEFAULTS = Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    appearance: {
      theme: "cosmic", accent: "#72e7ff", glow: "#b176ff", font: "modern",
      textZoom: 100, fontWeight: "regular", radius: "soft", glassOpacity: 72,
      shadow: "balanced", density: "comfortable"
    },
    layout: {
      sidebarCollapsed: false, sidebarAutoHide: false, sidebarWidth: 248,
      showSidebarLabels: true, advancedMode: false, pinnedRoutes: ["/home", "/chat-ai"],
      breadcrumb: "standard", searchPosition: "header", fullscreenWorkspace: false
    },
    motion: {
      level: "balanced", particles: 50, glowIntensity: 55, bloom: 40, speed: 100,
      autoReduce: true, pauseHidden: true, portalSound: false
    },
    accessibility: {
      reducedMotion: false, highContrast: false, underlineLinks: false,
      focusRing: true, colorVision: "default"
    },
    locale: {
      language: "vi", timezone: "Asia/Bangkok", dateFormat: "dd/mm/yyyy",
      timeFormat: "24h", weekStart: "monday", voice: "vi-female"
    },
    performance: {
      graphics: "auto", maxFps: 60, pixelRatio: 1.5, dataSaver: false,
      disableMobileVideo: true
    },
    notifications: {
      email: true, browser: false, inApp: true, security: true, learning: true,
      publishing: true, system: true, quietEnabled: false, quietStart: "22:00", quietEnd: "07:00"
    },
    security: { autoLockMinutes: 0, privacyShield: false },
    data: { syncScope: "device" }
  });

  const SECTIONS = Object.freeze([
    ["overview", "Tổng quan", "◈", "Trạng thái và lối tắt"],
    ["appearance", "Giao diện", "✦", "Màu sắc, chữ và bề mặt"],
    ["layout", "Bố cục", "▦", "Sidebar và điều hướng"],
    ["motion", "Chuyển động", "◎", "Hiệu ứng và animation"],
    ["accessibility", "Trợ năng", "◐", "Khả năng đọc và thao tác"],
    ["locale", "Ngôn ngữ", "文", "Khu vực, thời gian và giọng đọc"],
    ["performance", "Hiệu năng", "↯", "Đồ họa và dữ liệu"],
    ["notifications", "Thông báo", "◇", "Kênh và giờ yên tĩnh"],
    ["security", "Bảo mật", "◆", "Phiên, quyền riêng tư và chẩn đoán"],
    ["data", "Dữ liệu", "⇄", "Đồng bộ, nhập và xuất"]
  ]);

  const ROUTES = Object.freeze([
    ["/home", "Trang chủ"], ["/chat-ai", "Chat AI"], ["/work", "Công việc"],
    ["/learn", "Học tập"], ["/fortune", "Xem bói"], ["/music-ai", "Làm nhạc AI"],
    ["/social-media-tools", "Công cụ truyền thông"], ["/settings/account/profile", "Hồ sơ"]
  ]);

  const OPTIONS = Object.freeze({
    font: [["modern", "Modern · Be Vietnam"], ["clean", "Clean · Segoe UI"], ["rounded", "Rounded · Trebuchet"], ["mono", "Mono · Consolas"]],
    fontWeight: [["regular", "Thông thường"], ["medium", "Vừa"], ["bold", "Đậm"]],
    radius: [["sharp", "Vuông"], ["soft", "Mềm"], ["round", "Tròn"]],
    shadow: [["off", "Tắt"], ["balanced", "Cân bằng"], ["deep", "Chiều sâu cao"]],
    density: [["comfortable", "Thoải mái"], ["compact", "Gọn"], ["spacious", "Rộng"]],
    breadcrumb: [["standard", "Tiêu chuẩn"], ["compact", "Thu gọn"], ["hidden", "Ẩn"]],
    searchPosition: [["header", "Giữa header"], ["start", "Bên trái"], ["compact", "Chỉ biểu tượng"]],
    level: [["static", "Tĩnh"], ["balanced", "Cân bằng"], ["cinematic", "Điện ảnh"]],
    colorVision: [["default", "Mặc định"], ["protanopia", "Đỏ yếu"], ["deuteranopia", "Lục yếu"], ["tritanopia", "Lam yếu"], ["monochrome", "Đơn sắc"]],
    language: [["vi", "Tiếng Việt"], ["en", "English"]],
    timezone: [["Asia/Bangkok", "Việt Nam · UTC+7"], ["Asia/Tokyo", "Tokyo · UTC+9"], ["Europe/London", "London"], ["America/New_York", "New York"], ["UTC", "UTC"]],
    dateFormat: [["dd/mm/yyyy", "31/12/2026"], ["yyyy-mm-dd", "2026-12-31"], ["mm/dd/yyyy", "12/31/2026"]],
    timeFormat: [["24h", "24 giờ"], ["12h", "12 giờ"]],
    weekStart: [["monday", "Thứ Hai"], ["sunday", "Chủ nhật"]],
    voice: [["vi-female", "Nữ Việt Nam · mặc định"], ["vi-male", "Nam Việt Nam"], ["system", "Theo thiết bị"]],
    graphics: [["auto", "Tự động"], ["low", "Tiết kiệm"], ["balanced", "Cân bằng"], ["high", "Chất lượng cao"]],
    syncScope: [["device", "Chỉ thiết bị này"], ["account", "Đồng bộ tài khoản"]],
    autoLockMinutes: [["0", "Không tự khóa"], ["15", "Sau 15 phút"], ["30", "Sau 30 phút"], ["60", "Sau 60 phút"]]
  });

  const FIELDS = Object.freeze({
    appearance: [
      { path: "appearance.theme", label: "Theme", description: "Bốn giao diện được tối ưu cho toàn bộ HH Platform.", type: "theme" },
      { path: "appearance.accent", label: "Màu chủ đạo", description: "Màu nút chính, focus và điểm nhấn.", type: "color" },
      { path: "appearance.glow", label: "Màu hào quang", description: "Màu glow của card và hiệu ứng vũ trụ.", type: "color" },
      { path: "appearance.font", label: "Font chữ", description: "Áp dụng cho toàn bộ giao diện.", type: "select", options: "font" },
      { path: "appearance.textZoom", label: "Cỡ chữ", description: "Điều chỉnh từ 90% đến 150%.", type: "range", min: 90, max: 150, step: 5, suffix: "%" },
      { path: "appearance.fontWeight", label: "Độ đậm chữ", description: "Tăng khả năng đọc mà không đổi font.", type: "select", options: "fontWeight" },
      { path: "appearance.radius", label: "Bo góc", description: "Hình dáng card, menu và nút.", type: "select", options: "radius" },
      { path: "appearance.glassOpacity", label: "Độ trong của kính", description: "Độ đậm bề mặt glassmorphism.", type: "range", min: 35, max: 96, step: 1, suffix: "%" },
      { path: "appearance.shadow", label: "Bóng đổ", description: "Chiều sâu trực quan của workspace.", type: "select", options: "shadow" },
      { path: "appearance.density", label: "Mật độ giao diện", description: "Khoảng cách giữa các thành phần.", type: "select", options: "density" }
    ],
    layout: [
      { path: "layout.sidebarCollapsed", label: "Sidebar thu gọn", description: "Chỉ hiển thị biểu tượng khi mở website.", type: "switch" },
      { path: "layout.sidebarAutoHide", label: "Tự động ẩn sidebar", description: "Mở rộng khi đưa chuột vào cạnh trái.", type: "switch" },
      { path: "layout.sidebarWidth", label: "Chiều rộng sidebar", description: "Thay đổi từ 216px đến 320px.", type: "range", min: 216, max: 320, step: 4, suffix: "px" },
      { path: "layout.showSidebarLabels", label: "Hiển thị tên chức năng", description: "Ẩn nhãn để có không gian rộng hơn.", type: "switch" },
      { path: "layout.advancedMode", label: "Điều hướng nâng cao", description: "Cho phép mở đồng thời nhiều nhóm sidebar.", type: "switch" },
      { path: "layout.pinnedRoutes", label: "Mục được ghim", description: "Chọn tối đa năm lối tắt hiển thị đầu sidebar.", type: "multi" },
      { path: "layout.breadcrumb", label: "Breadcrumb", description: "Chọn cách hiển thị đường dẫn trang.", type: "select", options: "breadcrumb" },
      { path: "layout.searchPosition", label: "Thanh tìm kiếm", description: "Vị trí tìm kiếm toàn hệ thống.", type: "select", options: "searchPosition" },
      { path: "layout.fullscreenWorkspace", label: "Workspace toàn màn hình", description: "Ẩn header và sidebar khi làm việc tập trung.", type: "switch" }
    ],
    motion: [
      { path: "motion.level", label: "Mức hiệu ứng", description: "Tĩnh, cân bằng hoặc điện ảnh.", type: "select", options: "level" },
      { path: "motion.particles", label: "Mật độ particle", description: "Số lượng hạt nền và bụi sáng.", type: "range", min: 0, max: 100, step: 5, suffix: "%" },
      { path: "motion.glowIntensity", label: "Cường độ glow", description: "Độ sáng viền và trạng thái tương tác.", type: "range", min: 0, max: 100, step: 5, suffix: "%" },
      { path: "motion.bloom", label: "Cường độ bloom", description: "Ánh sáng khuếch tán của hiệu ứng 3D.", type: "range", min: 0, max: 100, step: 5, suffix: "%" },
      { path: "motion.speed", label: "Tốc độ chuyển động", description: "Điều chỉnh animation từ 50% đến 150%.", type: "range", min: 50, max: 150, step: 5, suffix: "%" },
      { path: "motion.autoReduce", label: "Tự giảm trên máy yếu", description: "Dựa trên bộ nhớ, CPU và chế độ tiết kiệm dữ liệu.", type: "switch" },
      { path: "motion.pauseHidden", label: "Dừng khi tab bị ẩn", description: "Tiết kiệm pin và tài nguyên nền.", type: "switch" },
      { path: "motion.portalSound", label: "Âm thanh Singularity Gate", description: "Phát một hợp âm ngắn khi cổng tải hoàn tất; mặc định tắt và chỉ chạy sau tương tác.", type: "switch" }
    ],
    accessibility: [
      { path: "accessibility.reducedMotion", label: "Giảm chuyển động", description: "Loại bỏ các chuyển cảnh mạnh và parallax.", type: "switch" },
      { path: "accessibility.highContrast", label: "Tương phản cao", description: "Tăng độ tương phản chữ và đường viền.", type: "switch" },
      { path: "accessibility.underlineLinks", label: "Gạch chân liên kết", description: "Giúp phân biệt liên kết mà không phụ thuộc màu.", type: "switch" },
      { path: "accessibility.focusRing", label: "Viền focus rõ", description: "Hiện viền bàn phím có độ tương phản cao.", type: "switch" },
      { path: "accessibility.colorVision", label: "Hỗ trợ nhận biết màu", description: "Bộ lọc xem trước cho các dạng thị giác màu.", type: "select", options: "colorVision" }
    ],
    locale: [
      { path: "locale.language", label: "Ngôn ngữ", description: "Ngôn ngữ ưu tiên của giao diện.", type: "select", options: "language" },
      { path: "locale.timezone", label: "Múi giờ", description: "Dùng cho lịch, lịch đăng và nhắc việc.", type: "select", options: "timezone" },
      { path: "locale.dateFormat", label: "Định dạng ngày", description: "Cách hiển thị ngày trong toàn hệ thống.", type: "select", options: "dateFormat" },
      { path: "locale.timeFormat", label: "Định dạng giờ", description: "Đồng hồ 12 giờ hoặc 24 giờ.", type: "select", options: "timeFormat" },
      { path: "locale.weekStart", label: "Ngày bắt đầu tuần", description: "Áp dụng cho Calendar và lịch học.", type: "select", options: "weekStart" },
      { path: "locale.voice", label: "Giọng đọc mặc định", description: "Ưu tiên giọng tiếng Việt có trên thiết bị.", type: "select", options: "voice" }
    ],
    performance: [
      { path: "performance.graphics", label: "Chất lượng đồ họa", description: "Tự động chọn theo khả năng của thiết bị.", type: "select", options: "graphics" },
      { path: "performance.maxFps", label: "Giới hạn FPS", description: "Giới hạn tốc độ vẽ của hiệu ứng động.", type: "range", min: 24, max: 120, step: 6, suffix: " FPS" },
      { path: "performance.pixelRatio", label: "Giới hạn pixel ratio", description: "Giảm tải WebGL trên màn hình độ phân giải cao.", type: "range", min: 0.75, max: 2, step: 0.25, suffix: "×" },
      { path: "performance.dataSaver", label: "Tiết kiệm dữ liệu", description: "Giảm preload và chất lượng media nền.", type: "switch" },
      { path: "performance.disableMobileVideo", label: "Tắt video nền trên mobile", description: "Dùng ảnh tĩnh trên màn hình nhỏ.", type: "switch" }
    ],
    notifications: [
      { path: "notifications.email", label: "Email", description: "Nhận thông báo tài khoản qua email đã xác minh.", type: "switch" },
      { path: "notifications.browser", label: "Trình duyệt", description: "Thông báo của hệ điều hành khi đã cấp quyền.", type: "switch" },
      { path: "notifications.inApp", label: "Trong ứng dụng", description: "Hiển thị trong Notification Center.", type: "switch" },
      { path: "notifications.security", label: "Bảo mật và đăng nhập", description: "Sự kiện quan trọng không nên tắt.", type: "switch" },
      { path: "notifications.learning", label: "Học tập", description: "Lịch học, ôn tập và tiến độ.", type: "switch" },
      { path: "notifications.publishing", label: "Xuất bản", description: "Hàng đợi, lỗi và trạng thái xử lý.", type: "switch" },
      { path: "notifications.system", label: "Hệ thống", description: "Bảo trì, cập nhật và tính năng mới.", type: "switch" },
      { path: "notifications.quietEnabled", label: "Không làm phiền", description: "Tạm giữ thông báo không khẩn cấp trong khung giờ đã chọn.", type: "switch" },
      { path: "notifications.quietStart", label: "Bắt đầu giờ yên tĩnh", description: "Giờ địa phương trên thiết bị.", type: "time" },
      { path: "notifications.quietEnd", label: "Kết thúc giờ yên tĩnh", description: "Thông báo tiếp tục sau thời điểm này.", type: "time" }
    ],
    security: [
      { path: "security.autoLockMinutes", label: "Tự khóa phiên khi không hoạt động", description: "Đăng xuất phiên phía máy chủ sau khoảng thời gian không có thao tác.", type: "select", options: "autoLockMinutes" },
      { path: "security.privacyShield", label: "Màn che riêng tư", description: "Che nội dung website khi cửa sổ mất focus; bấm để mở lại khi quay về.", type: "switch" }
    ],
    data: [
      { path: "data.syncScope", label: "Phạm vi lưu", description: "Lưu riêng trên máy hoặc đồng bộ theo tài khoản.", type: "select", options: "syncScope" }
    ]
  });

  const esc = (value) => String(value ?? "").replace(/[<>&"']/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[character]);
  const clone = (value) => typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value)));
  const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; } };
  const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  const getPath = (source, path) => path.split(".").reduce((value, key) => value?.[key], source);
  const setPath = (source, path, value) => {
    const keys = path.split(".");
    let target = source;
    keys.slice(0, -1).forEach((key) => { target[key] = target[key] && typeof target[key] === "object" ? target[key] : {}; target = target[key]; });
    target[keys.at(-1)] = value;
  };
  const deepMerge = (base, source) => {
    const output = clone(base);
    if (!source || typeof source !== "object" || Array.isArray(source)) return output;
    Object.entries(source).forEach(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value) && output[key] && typeof output[key] === "object" && !Array.isArray(output[key])) output[key] = deepMerge(output[key], value);
      else output[key] = clone(value);
    });
    return output;
  };
  const enumValue = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;
  const bool = (value, fallback = false) => typeof value === "boolean" ? value : fallback;
  const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toLowerCase() : fallback;
  const validTime = (value, fallback) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || "")) ? String(value) : fallback;

  function normalize(input) {
    const value = deepMerge(DEFAULTS, input);
    value.schemaVersion = SCHEMA_VERSION;
    value.appearance.theme = enumValue(value.appearance.theme, THEME_IDS, DEFAULTS.appearance.theme);
    value.appearance.accent = color(value.appearance.accent, DEFAULTS.appearance.accent);
    value.appearance.glow = color(value.appearance.glow, DEFAULTS.appearance.glow);
    value.appearance.font = enumValue(value.appearance.font, OPTIONS.font.map(([id]) => id), DEFAULTS.appearance.font);
    value.appearance.textZoom = clamp(value.appearance.textZoom, 90, 150);
    value.appearance.fontWeight = enumValue(value.appearance.fontWeight, OPTIONS.fontWeight.map(([id]) => id), DEFAULTS.appearance.fontWeight);
    value.appearance.radius = enumValue(value.appearance.radius, OPTIONS.radius.map(([id]) => id), DEFAULTS.appearance.radius);
    value.appearance.glassOpacity = clamp(value.appearance.glassOpacity, 35, 96);
    value.appearance.shadow = enumValue(value.appearance.shadow, OPTIONS.shadow.map(([id]) => id), DEFAULTS.appearance.shadow);
    value.appearance.density = enumValue(value.appearance.density, OPTIONS.density.map(([id]) => id), DEFAULTS.appearance.density);
    value.layout.sidebarCollapsed = bool(value.layout.sidebarCollapsed);
    value.layout.sidebarAutoHide = bool(value.layout.sidebarAutoHide);
    value.layout.sidebarWidth = clamp(value.layout.sidebarWidth, 216, 320);
    value.layout.showSidebarLabels = bool(value.layout.showSidebarLabels, true);
    value.layout.advancedMode = bool(value.layout.advancedMode);
    value.layout.pinnedRoutes = [...new Set((Array.isArray(value.layout.pinnedRoutes) ? value.layout.pinnedRoutes : []).filter((route) => ROUTES.some(([id]) => id === route)))].slice(0, 5);
    value.layout.breadcrumb = enumValue(value.layout.breadcrumb, OPTIONS.breadcrumb.map(([id]) => id), DEFAULTS.layout.breadcrumb);
    value.layout.searchPosition = enumValue(value.layout.searchPosition, OPTIONS.searchPosition.map(([id]) => id), DEFAULTS.layout.searchPosition);
    value.layout.fullscreenWorkspace = bool(value.layout.fullscreenWorkspace);
    value.motion.level = enumValue(value.motion.level, OPTIONS.level.map(([id]) => id), DEFAULTS.motion.level);
    ["particles", "glowIntensity", "bloom"].forEach((key) => { value.motion[key] = clamp(value.motion[key], 0, 100); });
    value.motion.speed = clamp(value.motion.speed, 50, 150);
    value.motion.autoReduce = bool(value.motion.autoReduce, true);
    value.motion.pauseHidden = bool(value.motion.pauseHidden, true);
    value.motion.portalSound = bool(value.motion.portalSound, false);
    ["reducedMotion", "highContrast", "underlineLinks", "focusRing"].forEach((key) => { value.accessibility[key] = bool(value.accessibility[key], DEFAULTS.accessibility[key]); });
    value.accessibility.colorVision = enumValue(value.accessibility.colorVision, OPTIONS.colorVision.map(([id]) => id), DEFAULTS.accessibility.colorVision);
    value.locale.language = enumValue(value.locale.language, ["vi", "en"], "vi");
    value.locale.timezone = enumValue(value.locale.timezone, OPTIONS.timezone.map(([id]) => id), DEFAULTS.locale.timezone);
    value.locale.dateFormat = enumValue(value.locale.dateFormat, OPTIONS.dateFormat.map(([id]) => id), DEFAULTS.locale.dateFormat);
    value.locale.timeFormat = enumValue(value.locale.timeFormat, OPTIONS.timeFormat.map(([id]) => id), DEFAULTS.locale.timeFormat);
    value.locale.weekStart = enumValue(value.locale.weekStart, OPTIONS.weekStart.map(([id]) => id), DEFAULTS.locale.weekStart);
    value.locale.voice = enumValue(value.locale.voice, OPTIONS.voice.map(([id]) => id), DEFAULTS.locale.voice);
    value.performance.graphics = enumValue(value.performance.graphics, OPTIONS.graphics.map(([id]) => id), DEFAULTS.performance.graphics);
    value.performance.maxFps = clamp(value.performance.maxFps, 24, 120);
    value.performance.pixelRatio = clamp(value.performance.pixelRatio, .75, 2);
    value.performance.dataSaver = bool(value.performance.dataSaver);
    value.performance.disableMobileVideo = bool(value.performance.disableMobileVideo, true);
    ["email", "browser", "inApp", "security", "learning", "publishing", "system", "quietEnabled"].forEach((key) => { value.notifications[key] = bool(value.notifications[key], DEFAULTS.notifications[key]); });
    value.notifications.quietStart = validTime(value.notifications.quietStart, DEFAULTS.notifications.quietStart);
    value.notifications.quietEnd = validTime(value.notifications.quietEnd, DEFAULTS.notifications.quietEnd);
    value.security.autoLockMinutes = enumValue(Number(value.security.autoLockMinutes), [0, 15, 30, 60], DEFAULTS.security.autoLockMinutes);
    value.security.privacyShield = bool(value.security.privacyShield, DEFAULTS.security.privacyShield);
    value.data.syncScope = enumValue(value.data.syncScope, ["device", "account"], "device");
    return value;
  }

  function fromLegacy() {
    const theme = readJson(THEME_KEY, "cosmic");
    const preferences = readJson(THEME_PREFERENCES_KEY, {});
    const shell = readJson(SHELL_KEY, {});
    const fontScaleMap = { small: 90, medium: 100, large: 110, xlarge: 120 };
    return normalize({
      appearance: {
        theme: THEME_IDS.includes(theme) ? theme : theme === "purple" || theme === "neon" || theme === "cyberpunk" ? "cosmic" : theme === "basic-dark" || theme === "dark" ? "midnight" : theme === "basic-light" ? "light" : "aurora",
        font: preferences.font, textZoom: preferences.textZoom || fontScaleMap[preferences.fontScale], radius: preferences.radius,
        density: preferences.density
      },
      layout: { sidebarCollapsed: shell.collapsed, advancedMode: shell.advanced },
      motion: { level: preferences.effects === "off" ? "static" : preferences.effects === "calm" ? "balanced" : "cinematic" },
      accessibility: { reducedMotion: preferences.reducedMotion, highContrast: preferences.contrast === "high" },
      locale: { language: preferences.language }
    });
  }

  function readStored() {
    const stored = readJson(STORAGE_KEY, null);
    return stored?.settings ? { settings: normalize(stored.settings), savedAt: stored.savedAt || null } : { settings: fromLegacy(), savedAt: null };
  }

  function token() { return String(window.HHAuthSession?.token?.() || "").trim(); }
  async function accountRequest(method = "GET", body) {
    const response = await fetch("/api/account-center", {
      method, credentials: "include", cache: "no-store",
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Không thể đồng bộ (HTTP ${response.status}).`);
    return data;
  }

  function fieldOptions(field) {
    return (OPTIONS[field.options] || []).map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join("");
  }

  function controlMarkup(field) {
    const path = esc(field.path);
    if (field.type === "theme") {
      const themes = [["cosmic", "Cosmic", "Tím · cyan"], ["midnight", "Midnight", "Xanh đêm"], ["aurora", "Aurora", "Lục · lam"], ["light", "Light", "Sáng rõ"]];
      return `<article class="hhs-setting hhs-setting--wide" data-hhs-field-card="${path}"><header><span><strong>${esc(field.label)}</strong><small>${esc(field.description)}</small></span><i data-hhs-changed="${path}" hidden>Đã đổi</i></header><div class="hhs-theme-grid">${themes.map(([id, label, note]) => `<button type="button" data-hhs-theme="${id}"><i></i><span><b>${label}</b><small>${note}</small></span><em>✓</em></button>`).join("")}</div></article>`;
    }
    if (field.type === "multi") {
      return `<article class="hhs-setting hhs-setting--wide" data-hhs-field-card="${path}"><header><span><strong>${esc(field.label)}</strong><small>${esc(field.description)}</small></span><i data-hhs-changed="${path}" hidden>Đã đổi</i></header><div class="hhs-pin-grid">${ROUTES.map(([route, label]) => `<label><input type="checkbox" data-hhs-pin="${esc(route)}"><i>☆</i><span>${esc(label)}</span></label>`).join("")}</div><small class="hhs-field-note" data-hhs-pin-count>0/5 mục đã ghim</small></article>`;
    }
    let control = "";
    if (field.type === "switch") control = `<label class="hhs-switch"><input type="checkbox" data-hhs-input="${path}"><i></i><span data-hhs-switch-label>Đang tắt</span></label>`;
    else if (field.type === "select") control = `<label class="hhs-select"><select data-hhs-input="${path}">${fieldOptions(field)}</select><i>⌄</i></label>`;
    else if (field.type === "range") control = `<label class="hhs-range"><input type="range" min="${field.min}" max="${field.max}" step="${field.step}" data-hhs-input="${path}"><output data-hhs-output="${path}"></output></label>`;
    else if (field.type === "color") control = `<label class="hhs-color"><input type="color" data-hhs-input="${path}"><input type="text" maxlength="7" data-hhs-color-text="${path}" aria-label="Mã màu ${esc(field.label)}"><i></i></label>`;
    else if (field.type === "time") control = `<input class="hhs-time" type="time" data-hhs-input="${path}">`;
    return `<article class="hhs-setting" data-hhs-field-card="${path}"><header><span><strong>${esc(field.label)}</strong><small>${esc(field.description)}</small></span><i data-hhs-changed="${path}" hidden>Đã đổi</i></header>${control}</article>`;
  }

  function panelMarkup(section) {
    const details = SECTIONS.find(([id]) => id === section);
    const fieldList = FIELDS[section] || [];
    let extras = "";
    if (section === "overview") extras = `<div class="hhs-overview-grid"><article><i>✦</i><span><small>Theme hiện tại</small><strong data-hhs-overview-theme>Cosmic</strong></span></article><article><i>◫</i><span><small>Thiết bị</small><strong data-hhs-device>Đang nhận diện</strong></span></article><article><i>◎</i><span><small>Đã tùy chỉnh</small><strong data-hhs-custom-count>0 mục</strong></span></article><article><i>⇄</i><span><small>Lưu dữ liệu</small><strong data-hhs-overview-sync>Thiết bị này</strong></span></article></div><section class="hhs-quick-actions"><button type="button" data-hhs-section="appearance"><i>✦</i><span><strong>Đổi giao diện</strong><small>Màu, chữ và kính</small></span></button><button type="button" data-hhs-section="accessibility"><i>◐</i><span><strong>Kiểm tra trợ năng</strong><small>Tương phản và chuyển động</small></span></button><button type="button" data-app-route="/settings/account/security"><i>⌁</i><span><strong>Bảo mật tài khoản</strong><small>Mở Account Center</small></span></button></section><section class="hhs-health"><header><span><small>CONFIGURATION HEALTH</small><strong>Cấu hình đang hoạt động</strong></span><b data-hhs-health>100%</b></header><div><i></i></div><p data-hhs-health-note>Mọi giá trị đều hợp lệ và có thể khôi phục.</p></section>`;
    if (section === "overview") extras += `<section class="hhs-overview-command"><article class="hhs-security-summary"><header><span><small>SECURITY POSTURE</small><strong>Bảo vệ website và phiên đăng nhập</strong></span><b data-hhs-security-score>Đang kiểm tra</b></header><div data-hhs-security-checks></div><footer><button type="button" data-hhs-security-audit>Kiểm tra lại</button><button type="button" data-hhs-section="security">Mở bảo mật</button></footer></article><article class="hhs-capability-summary"><header><span><small>DEVICE CAPABILITY</small><strong>Khả năng thiết bị hiện tại</strong></span><i>◫</i></header><div><span><b data-hhs-capability="graphics">Đang đo</b><small>Đồ họa</small></span><span><b data-hhs-capability="storage">Đang đo</b><small>Lưu trữ</small></span><span><b data-hhs-capability="notifications">Đang đo</b><small>Thông báo</small></span><span><b data-hhs-capability="speech">Đang đo</b><small>Giọng đọc</small></span></div><button type="button" data-hhs-section="performance">Tối ưu thiết bị</button></article></section>`;
    if (section === "locale") extras += `<div class="hhs-panel-actions"><button type="button" data-hhs-voice-test>▶ Nghe thử giọng Việt</button></div>`;
    if (section === "performance") extras += `<section class="hhs-storage-card"><header><span><small>LOCAL STORAGE</small><strong>Dung lượng trên thiết bị</strong></span><b data-hhs-storage-size>Đang tính…</b></header><div><i data-hhs-storage-bar></i></div><p data-hhs-storage-note>Chỉ đo dữ liệu website được trình duyệt cung cấp.</p><footer><button type="button" data-hhs-storage-persist>Giữ dữ liệu học và project offline</button><button type="button" data-hhs-clear-cache>Xóa cache giao diện an toàn</button></footer></section>`;
    if (section === "notifications") extras += `<section class="hhs-notification-test"><span><strong>Kiểm tra kênh đã bật</strong><small>Gửi thông báo thật tới trình duyệt, ứng dụng và email khi khả dụng.</small></span><button type="button" data-hhs-test-notification>Gửi thông báo thử</button><p data-hhs-notification-status aria-live="polite"></p></section>`;
    if (section === "security") extras += `<section class="hhs-security-command"><article class="hhs-security-score-card"><span><small>CLIENT SECURITY AUDIT</small><strong data-hhs-security-score>Đang kiểm tra</strong><p>Chỉ kiểm tra trạng thái kỹ thuật; không đọc mật khẩu, cookie HttpOnly, token hay nội dung riêng tư.</p></span><button type="button" data-hhs-security-audit>Chạy kiểm tra</button></article><div class="hhs-security-check-list" data-hhs-security-checks></div><div class="hhs-security-actions"><button type="button" data-app-route="/settings/account/security"><i>◆</i><span><strong>Đăng nhập & Passkey</strong><small>Mở trung tâm bảo mật phía máy chủ</small></span></button><button type="button" data-app-route="/settings/account/sessions"><i>▣</i><span><strong>Phiên và thiết bị</strong><small>Thu hồi thiết bị lạ hoặc phiên cũ</small></span></button><button type="button" data-hhs-security-report><i>↓</i><span><strong>Tải báo cáo đã khử danh tính</strong><small>Không gồm email, IP, token hay nội dung</small></span></button><button type="button" data-hhs-clear-legacy-auth><i>⌁</i><span><strong>Dọn thông tin xác thực cũ</strong><small>Xóa token legacy khỏi localStorage nếu còn</small></span></button></div><aside class="hhs-security-boundary"><i>✓</i><span><strong>Ranh giới bảo mật</strong><small>Token phiên mới chỉ ở bộ nhớ hoặc cookie HttpOnly; thao tác nhạy cảm được chuyển sang Account Center và kiểm tra quyền ở server.</small></span></aside></section>`;
    if (section === "data") extras += `<section class="hhs-data-actions"><button type="button" data-hhs-export><i>↓</i><span><strong>Xuất cấu hình</strong><small>JSON có phiên bản schema</small></span></button><button type="button" data-hhs-import-trigger><i>↑</i><span><strong>Nhập cấu hình</strong><small>Kiểm tra trước khi áp dụng</small></span></button><button type="button" data-hhs-clear-local><i>×</i><span><strong>Xóa tùy chỉnh local</strong><small>Không xóa hồ sơ tài khoản</small></span></button><input type="file" accept="application/json,.json" data-hhs-import hidden></section><section class="hhs-history-card"><header><span><small>VERSION HISTORY</small><strong>Phiên bản gần đây</strong></span><b data-hhs-history-count>0 bản</b></header><div data-hhs-history></div></section>`;
    return `<section class="hhs-panel" data-hhs-panel="${section}" ${section === "overview" ? "" : "hidden"}><header class="hhs-panel-head"><span><i>${details?.[2] || "◈"}</i><div><small>HH SETTINGS · ${esc(section.toUpperCase())}</small><h2>${esc(details?.[1] || section)}</h2><p>${esc(details?.[3] || "")}</p></div></span><button type="button" data-hhs-reset-section="${section}" ${section === "overview" ? "data-hhs-reset-all" : ""}>${section === "overview" ? "Khôi phục tất cả" : "Đặt lại mục này"}</button></header>${extras}<div class="hhs-setting-grid">${fieldList.map(controlMarkup).join("")}</div></section>`;
  }

  function previewMarkup() {
    return `<aside class="hhs-preview" data-hhs-preview><header><span><small>LIVE PREVIEW</small><strong>Xem trước trực tiếp</strong></span><div>${[["desktop", "▰"], ["tablet", "▯"], ["mobile", "▯"]].map(([id, icon]) => `<button type="button" data-hhs-device-mode="${id}" aria-label="${id}">${icon}</button>`).join("")}<button type="button" data-hhs-preview-close aria-label="Đóng xem trước">×</button></div></header><div class="hhs-preview-stage"><section data-hhs-preview-frame><header><i></i><span></span><b></b><em></em></header><div><nav><strong>HH</strong><i></i><i></i><i></i><i></i><i></i></nav><main><span>HH PLATFORM</span><h3>Không gian của bạn</h3><p>Giao diện thay đổi ngay khi bạn điều chỉnh.</p><div class="hhs-preview-cards"><article><i></i><strong>Chat AI</strong><small>Sẵn sàng</small></article><article><i></i><strong>Học tập</strong><small>12 bài</small></article><article><i></i><strong>Sáng tạo</strong><small>Studio</small></article></div><button type="button">Bắt đầu trải nghiệm</button></main></div></section></div><footer><span><i></i> Bản xem trước · chưa lưu</span><button type="button" data-hhs-preview-fullscreen>Phóng lớn</button></footer></aside>`;
  }

  function studioMarkup() {
    return `<section class="hhs" data-hh-settings-studio><div class="hhs-nebula" aria-hidden="true"><i></i><i></i><i></i></div><header class="hhs-topbar"><div class="hhs-title"><i>⚙</i><span><small>HH PLATFORM · PERSONALIZATION</small><h1>Cài đặt</h1></span></div><label class="hhs-search"><i>⌕</i><input type="search" data-hhs-search placeholder="Tìm theme, sidebar, thông báo…" autocomplete="off"><kbd>Ctrl F</kbd></label><div class="hhs-sync" data-hhs-sync="device"><i></i><span><small data-hhs-sync-label>Lưu trên thiết bị</small><b data-hhs-sync-time>Chưa đồng bộ tài khoản</b></span></div><button class="hhs-preview-toggle" type="button" data-hhs-preview-toggle>◫ Xem trước</button></header><div class="hhs-search-results" data-hhs-search-results hidden></div><div class="hhs-layout"><nav class="hhs-nav" aria-label="Danh mục cài đặt"><small>DANH MỤC</small>${SECTIONS.map(([id, label, icon, note], index) => `<button type="button" data-hhs-section="${id}" class="${index === 0 ? "is-active" : ""}"><i>${icon}</i><span><strong>${label}</strong><small>${note}</small></span><em>›</em></button>`).join("")}<footer><button type="button" data-app-route="/settings/account/profile"><i>♙</i><span><strong>Account Center</strong><small>Hồ sơ và bảo mật</small></span></button></footer></nav><main class="hhs-content">${SECTIONS.map(([id]) => panelMarkup(id)).join("")}</main>${previewMarkup()}</div><footer class="hhs-actionbar"><span data-hhs-dirty-note><i></i> Không có thay đổi chưa lưu</span><div><button type="button" data-hhs-undo disabled>↶ Hoàn tác</button><button type="button" data-hhs-redo disabled>↷ Làm lại</button><button type="button" data-hhs-reset-draft>Đặt lại</button><button class="is-primary" type="button" data-hhs-save disabled>Lưu thay đổi</button></div></footer><div class="hhs-toast" data-hhs-toast role="status" aria-live="polite" hidden></div></section>`;
  }

  function countCustom(settings) {
    let count = 0;
    Object.keys(FIELDS).forEach((section) => FIELDS[section].forEach((field) => {
      if (JSON.stringify(getPath(settings, field.path)) !== JSON.stringify(getPath(DEFAULTS, field.path))) count += 1;
    }));
    return count;
  }

  function settingsEqual(left, right) { return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right)); }
  function fieldChanged(instance, path) { return JSON.stringify(getPath(instance.draft, path)) !== JSON.stringify(getPath(instance.saved, path)); }

  function showToast(instance, message, type = "success") {
    const toast = instance.root.querySelector("[data-hhs-toast]");
    if (!toast) return;
    clearTimeout(instance.toastTimer);
    toast.hidden = false;
    toast.dataset.type = type;
    toast.textContent = message;
    instance.toastTimer = setTimeout(() => { toast.hidden = true; }, 3600);
  }

  function applySettings(settings, { persist = false } = {}) {
    const value = normalize(settings);
    if (typeof window.HHAppTheme?.applyWorkspaceSettings === "function") {
      window.HHAppTheme.applyWorkspaceSettings(value, { persist });
      window.dispatchEvent(new CustomEvent(persist ? "hh:settings-applied" : "hh:settings-preview", { detail: { settings: clone(value) } }));
      return value;
    }
    const effects = value.motion.level === "static" ? "off" : value.motion.level === "balanced" ? "calm" : "full";
    window.HHAppTheme?.apply?.(value.appearance.theme, { persist });
    window.HHAppTheme?.applyPreferences?.({
      language: value.locale.language, density: value.appearance.density === "spacious" ? "comfortable" : value.appearance.density,
      font: value.appearance.font, fontScale: "medium", textZoom: value.appearance.textZoom,
      radius: value.appearance.radius, contrast: value.accessibility.highContrast ? "high" : "standard",
      effects, reducedMotion: value.accessibility.reducedMotion
    }, { persist });
    const root = document.documentElement;
    root.style.setProperty("--hh-user-accent", value.appearance.accent);
    root.style.setProperty("--hh-user-glow", value.appearance.glow);
    root.style.setProperty("--hh-user-glass", String(value.appearance.glassOpacity / 100));
    root.style.setProperty("--hh-user-sidebar-width", `${value.layout.sidebarWidth}px`);
    root.style.setProperty("--hh-user-motion-speed", String(100 / value.motion.speed));
    root.style.setProperty("--hh-user-particles", String(value.motion.particles / 100));
    root.style.setProperty("--hh-user-glow-intensity", String(value.motion.glowIntensity / 100));
    root.style.setProperty("--hh-user-bloom", String(value.motion.bloom / 100));
    document.body.dataset.hhFontWeight = value.appearance.fontWeight;
    document.body.dataset.hhShadow = value.appearance.shadow;
    document.body.dataset.hhColorVision = value.accessibility.colorVision;
    document.body.dataset.hhGraphics = value.performance.graphics;
    document.body.dataset.hhSearchPosition = value.layout.searchPosition;
    document.body.classList.toggle("app-sidebar-collapsed", matchMedia("(max-width: 760px)").matches || value.layout.sidebarCollapsed);
    document.body.classList.toggle("app-sidebar-auto-hide", value.layout.sidebarAutoHide);
    document.body.classList.toggle("app-sidebar-labels-hidden", !value.layout.showSidebarLabels);
    document.body.classList.toggle("app-advanced-mode", value.layout.advancedMode);
    document.body.classList.toggle("app-workspace-fullscreen", value.layout.fullscreenWorkspace);
    document.body.classList.toggle("app-breadcrumb-compact", value.layout.breadcrumb === "compact");
    document.body.classList.toggle("app-breadcrumb-hidden", value.layout.breadcrumb === "hidden");
    document.body.classList.toggle("app-links-underlined", value.accessibility.underlineLinks);
    document.body.classList.toggle("app-focus-ring-disabled", !value.accessibility.focusRing);
    document.body.classList.toggle("app-density-spacious", value.appearance.density === "spacious");
    document.body.classList.toggle("app-data-saver", value.performance.dataSaver);
    document.body.classList.toggle("app-disable-mobile-video", value.performance.disableMobileVideo);
    document.body.classList.toggle("app-effects-paused", value.motion.pauseHidden && document.hidden);
    document.body.classList.add("hh-settings-applied");
    document.documentElement.lang = value.locale.language;
    if (persist) {
      const shell = readJson(SHELL_KEY, {});
      writeJson(SHELL_KEY, { ...shell, collapsed: value.layout.sidebarCollapsed, advanced: value.layout.advancedMode });
    }
    window.dispatchEvent(new CustomEvent(persist ? "hh:settings-applied" : "hh:settings-preview", { detail: { settings: clone(value) } }));
    return value;
  }

  function updatePreview(instance) {
    const studio = instance.root.querySelector("[data-hh-settings-studio]");
    if (!studio) return;
    studio.style.setProperty("--hhs-accent", instance.draft.appearance.accent);
    studio.style.setProperty("--hhs-glow", instance.draft.appearance.glow);
    studio.style.setProperty("--hhs-glass", String(instance.draft.appearance.glassOpacity / 100));
    studio.dataset.theme = instance.draft.appearance.theme;
    studio.dataset.motion = instance.draft.motion.level;
    studio.dataset.previewDevice = instance.previewDevice;
    const frame = studio.querySelector("[data-hhs-preview-frame]");
    if (frame) {
      frame.dataset.theme = instance.draft.appearance.theme;
      frame.style.setProperty("--preview-radius", instance.draft.appearance.radius === "sharp" ? "3px" : instance.draft.appearance.radius === "round" ? "20px" : "11px");
      frame.style.fontFamily = instance.draft.appearance.font === "mono" ? "Consolas,monospace" : instance.draft.appearance.font === "rounded" ? "Trebuchet MS,sans-serif" : instance.draft.appearance.font === "clean" ? "Segoe UI,sans-serif" : "Be Vietnam Pro,sans-serif";
      frame.style.fontSize = `${instance.draft.appearance.textZoom}%`;
    }
  }

  function syncControls(instance) {
    instance.root.querySelectorAll("[data-hhs-input]").forEach((input) => {
      const value = getPath(instance.draft, input.dataset.hhsInput);
      if (input.type === "checkbox") input.checked = Boolean(value);
      else input.value = String(value);
      if (input.type === "checkbox") input.closest(".hhs-switch")?.querySelector("[data-hhs-switch-label]")?.replaceChildren(document.createTextNode(input.checked ? "Đang bật" : "Đang tắt"));
    });
    instance.root.querySelectorAll("[data-hhs-output]").forEach((output) => {
      const field = Object.values(FIELDS).flat().find((item) => item.path === output.dataset.hhsOutput);
      const value = getPath(instance.draft, output.dataset.hhsOutput);
      output.textContent = `${value}${field?.suffix || ""}`;
    });
    instance.root.querySelectorAll("[data-hhs-color-text]").forEach((input) => { input.value = getPath(instance.draft, input.dataset.hhsColorText); });
    instance.root.querySelectorAll("[data-hhs-theme]").forEach((button) => {
      const active = button.dataset.hhsTheme === instance.draft.appearance.theme;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    instance.root.querySelectorAll("[data-hhs-pin]").forEach((input) => { input.checked = instance.draft.layout.pinnedRoutes.includes(input.dataset.hhsPin); });
    const pinCount = instance.root.querySelector("[data-hhs-pin-count]");
    if (pinCount) pinCount.textContent = `${instance.draft.layout.pinnedRoutes.length}/5 mục đã ghim`;
    instance.root.querySelectorAll("[data-hhs-changed]").forEach((badge) => { badge.hidden = !fieldChanged(instance, badge.dataset.hhsChanged); });
    instance.root.querySelectorAll("[data-hhs-device-mode]").forEach((button) => button.classList.toggle("is-active", button.dataset.hhsDeviceMode === instance.previewDevice));
    updatePreview(instance);
    updateDynamic(instance);
  }

  function formatDate(value) {
    const date = value ? new Date(value) : null;
    return date && Number.isFinite(date.getTime()) ? date.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "Chưa đồng bộ";
  }

  function securitySnapshot(headers = {}) {
    const host = String(location.hostname || "");
    const transportSafe = globalThis.isSecureContext === true && (location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(host));
    const metaCsp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || "";
    const referrerPolicy = document.querySelector('meta[name="referrer"]')?.content || headers.referrer || "";
    const checks = [
      { id: "transport", label: "Kết nối an toàn", ok: transportSafe, detail: transportSafe ? "Secure Context đang hoạt động." : "Hãy dùng HTTPS trên môi trường production." },
      { id: "credential", label: "Không lưu token trong localStorage", ok: !localStorage.getItem("hh-auth-token"), detail: "Phiên mới dùng bộ nhớ và cookie HttpOnly phía máy chủ." },
      { id: "csp", label: "Content Security Policy", ok: /default-src\s+'self'|default-src\s+'none'/.test(headers.csp || metaCsp), detail: "Giới hạn nguồn script, frame và nội dung được phép tải." },
      { id: "referrer", label: "Không gửi referrer ra ngoài", ok: referrerPolicy.toLowerCase() === "no-referrer", detail: "Đường dẫn website không đi kèm liên kết ngoài." },
      { id: "crypto", label: "Web Crypto khả dụng", ok: Boolean(globalThis.crypto?.subtle), detail: "Trình duyệt có primitive mật mã chuẩn cho Passkey và tác vụ an toàn." }
    ];
    const passed = checks.filter((item) => item.ok).length;
    return { generatedAt: new Date().toISOString(), score: Math.round(passed / checks.length * 100), checks };
  }

  function renderSecurityAudit(instance) {
    const audit = instance.securityAudit || securitySnapshot();
    instance.root.querySelectorAll("[data-hhs-security-score]").forEach((node) => { node.textContent = `${audit.score}%`; node.dataset.state = audit.score === 100 ? "safe" : audit.score >= 80 ? "attention" : "risk"; });
    instance.root.querySelectorAll("[data-hhs-security-checks]").forEach((list) => {
      list.innerHTML = audit.checks.map((item) => `<article data-state="${item.ok ? "safe" : "attention"}"><i>${item.ok ? "✓" : "!"}</i><span><strong>${esc(item.label)}</strong><small>${esc(item.detail)}</small></span></article>`).join("");
    });
  }

  async function runSecurityAudit(instance, { announce = false } = {}) {
    let headers = {};
    try {
      const response = await fetch("/api/health", { method: "GET", credentials: "include", cache: "no-store", headers: { Accept: "application/json" } });
      headers = {
        csp: response.headers.get("content-security-policy") || "",
        referrer: response.headers.get("referrer-policy") || "",
        hsts: response.headers.get("strict-transport-security") || ""
      };
    } catch {}
    instance.securityAudit = securitySnapshot(headers);
    renderSecurityAudit(instance);
    if (announce) showToast(instance, instance.securityAudit.score === 100 ? "Kiểm tra bảo mật phía trình duyệt đạt 100%." : `Kiểm tra hoàn tất: ${instance.securityAudit.score}%. Mở từng mục để xem điều cần chú ý.`, instance.securityAudit.score === 100 ? "success" : "warning");
    return instance.securityAudit;
  }

  function updateCapabilities(instance) {
    const values = {
      graphics: navigator.gpu ? "WebGPU + fallback" : "Canvas/WebGL",
      storage: navigator.storage?.estimate ? "Đo được" : "Giới hạn",
      notifications: "Notification" in window ? Notification.permission === "granted" ? "Đã cho phép" : "Sẵn sàng" : "Không hỗ trợ",
      speech: "speechSynthesis" in window ? "Sẵn sàng" : "Không hỗ trợ"
    };
    Object.entries(values).forEach(([key, value]) => instance.root.querySelectorAll(`[data-hhs-capability="${key}"]`).forEach((node) => { node.textContent = value; }));
  }

  async function requestPersistentStorage(instance) {
    if (!navigator.storage?.persist) return showToast(instance, "Trình duyệt này chưa hỗ trợ yêu cầu lưu trữ bền vững.", "warning");
    try {
      const granted = await navigator.storage.persist();
      showToast(instance, granted ? "Đã yêu cầu trình duyệt giữ dữ liệu offline và project cục bộ." : "Trình duyệt chưa cấp lưu trữ bền vững. Dữ liệu hiện tại vẫn được giữ theo hạn mức thông thường.", granted ? "success" : "warning");
      storageEstimate(instance);
    } catch (error) { showToast(instance, `Không thể cập nhật lưu trữ: ${error.message}`, "warning"); }
  }

  function updateDynamic(instance) {
    const dirty = !settingsEqual(instance.draft, instance.saved);
    instance.dirty = dirty;
    const save = instance.root.querySelector("[data-hhs-save]");
    if (save) save.disabled = !dirty || instance.saving;
    const dirtyNote = instance.root.querySelector("[data-hhs-dirty-note]");
    if (dirtyNote) dirtyNote.innerHTML = dirty ? `<i></i> Có thay đổi chưa lưu` : `<i></i> Không có thay đổi chưa lưu`;
    instance.root.querySelector("[data-hhs-undo]")?.toggleAttribute("disabled", !instance.undo.length);
    instance.root.querySelector("[data-hhs-redo]")?.toggleAttribute("disabled", !instance.redo.length);
    const themeLabel = { cosmic: "Cosmic", midnight: "Midnight", aurora: "Aurora", light: "Light" }[instance.draft.appearance.theme];
    const customCount = countCustom(instance.draft);
    const values = {
      "[data-hhs-overview-theme]": themeLabel,
      "[data-hhs-custom-count]": `${customCount} mục`,
      "[data-hhs-overview-sync]": instance.draft.data.syncScope === "account" ? "Tài khoản HH" : "Thiết bị này",
      "[data-hhs-device]": matchMedia("(max-width: 720px)").matches ? "Điện thoại" : matchMedia("(max-width: 1100px)").matches ? "Máy tính bảng" : "Máy tính"
    };
    Object.entries(values).forEach(([selector, value]) => { const node = instance.root.querySelector(selector); if (node) node.textContent = value; });
    const health = instance.root.querySelector("[data-hhs-health]");
    if (health) health.textContent = "100%";
    const sync = instance.root.querySelector(".hhs-sync");
    if (sync) sync.dataset.hhsSync = instance.syncState;
    const syncLabel = instance.root.querySelector("[data-hhs-sync-label]");
    const syncTime = instance.root.querySelector("[data-hhs-sync-time]");
    if (syncLabel) syncLabel.textContent = instance.syncState === "syncing" ? "Đang đồng bộ" : instance.syncState === "synced" ? "Đã đồng bộ" : instance.syncState === "error" ? "Chưa thể đồng bộ" : "Lưu trên thiết bị";
    if (syncTime) syncTime.textContent = instance.syncState === "synced" ? formatDate(instance.syncedAt) : instance.syncState === "error" ? "Bản local vẫn an toàn" : "Thiết bị hiện tại";
    const history = readJson(HISTORY_KEY, []);
    const historyCount = instance.root.querySelector("[data-hhs-history-count]");
    if (historyCount) historyCount.textContent = `${history.length} bản`;
    const historyList = instance.root.querySelector("[data-hhs-history]");
    if (historyList) historyList.innerHTML = history.length ? history.map((item, index) => `<article><span><strong>${esc(item.label || "Cấu hình đã lưu")}</strong><small>${esc(formatDate(item.savedAt))}</small></span><button type="button" data-hhs-restore-history="${index}">Khôi phục</button></article>`).join("") : `<p>Chưa có phiên bản trước. Mỗi lần lưu sẽ tạo một checkpoint cục bộ.</p>`;
    renderSecurityAudit(instance);
    updateCapabilities(instance);
  }

  function setDraft(instance, next, { record = true } = {}) {
    if (record) {
      instance.undo.push(clone(instance.draft));
      if (instance.undo.length > 30) instance.undo.shift();
      instance.redo = [];
    }
    instance.draft = normalize(next);
    applySettings(instance.draft, { persist: false });
    syncControls(instance);
  }

  function updateField(instance, path, value) {
    const next = clone(instance.draft);
    setPath(next, path, value);
    setDraft(instance, next);
  }

  function activateSection(instance, section, focusPath = "") {
    if (!SECTIONS.some(([id]) => id === section)) return;
    instance.activeSection = section;
    instance.root.querySelectorAll("[data-hhs-section]").forEach((button) => button.classList.toggle("is-active", button.dataset.hhsSection === section));
    instance.root.querySelectorAll("[data-hhs-panel]").forEach((panel) => { panel.hidden = panel.dataset.hhsPanel !== section; });
    const results = instance.root.querySelector("[data-hhs-search-results]");
    if (results) results.hidden = true;
    const search = instance.root.querySelector("[data-hhs-search]");
    if (search) search.value = "";
    instance.root.querySelector(".hhs-content")?.scrollTo({ top: 0, behavior: "auto" });
    if (focusPath) requestAnimationFrame(() => instance.root.querySelector(`[data-hhs-field-card="${CSS.escape(focusPath)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  function searchSettings(instance, query) {
    const normalizedQuery = String(query || "").trim().toLocaleLowerCase("vi");
    const container = instance.root.querySelector("[data-hhs-search-results]");
    if (!container) return;
    if (!normalizedQuery) { container.hidden = true; return; }
    const matches = Object.entries(FIELDS).flatMap(([section, fields]) => fields.filter((field) => `${field.label} ${field.description}`.toLocaleLowerCase("vi").includes(normalizedQuery)).map((field) => ({ section, field }))).slice(0, 12);
    container.hidden = false;
    container.innerHTML = `<header><span><small>KẾT QUẢ CÀI ĐẶT</small><strong>${matches.length} kết quả</strong></span><button type="button" data-hhs-search-close>×</button></header><div>${matches.map(({ section, field }) => `<button type="button" data-hhs-search-open="${section}:${esc(field.path)}"><i>${SECTIONS.find(([id]) => id === section)?.[2] || "◈"}</i><span><strong>${esc(field.label)}</strong><small>${esc(field.description)}</small></span><em>›</em></button>`).join("") || `<p>Không tìm thấy thiết lập phù hợp.</p>`}</div>`;
  }

  function download(name, content, type = "application/json") {
    const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
    const link = document.createElement("a");
    link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function save(instance) {
    if (instance.saving || !instance.dirty) return;
    instance.saving = true;
    updateDynamic(instance);
    const previous = clone(instance.saved);
    const next = normalize(instance.draft);
    const savedAt = new Date().toISOString();
    const history = readJson(HISTORY_KEY, []);
    writeJson(HISTORY_KEY, [{ savedAt, label: `Trước khi lưu · ${countCustom(previous)} tùy chỉnh`, settings: previous }, ...history].slice(0, MAX_HISTORY));
    writeJson(STORAGE_KEY, { schemaVersion: SCHEMA_VERSION, savedAt, settings: next });
    instance.saved = clone(next);
    instance.savedAt = savedAt;
    applySettings(next, { persist: true });
    if (next.data.syncScope === "account") {
      instance.syncState = "syncing";
      updateDynamic(instance);
      try {
        const data = await accountRequest("POST", { action: "settings:update", settings: next });
        instance.syncedAt = data.updatedAt || savedAt;
        instance.syncState = "synced";
        showToast(instance, "Đã lưu trên thiết bị và đồng bộ với tài khoản HH.");
      } catch (error) {
        instance.syncState = "error";
        showToast(instance, `Đã giữ bản local. ${error.message}`, "warning");
      }
    } else {
      instance.syncState = "device";
      showToast(instance, "Đã lưu cài đặt trên thiết bị này.");
    }
    instance.saving = false;
    instance.undo = [];
    instance.redo = [];
    syncControls(instance);
    window.dispatchEvent(new CustomEvent("hh:settings-saved", { detail: { settings: clone(next), savedAt } }));
  }

  async function loadRemote(instance) {
    if (!token()) return;
    try {
      const data = await accountRequest();
      const remote = data.workspaceSettings ? normalize(data.workspaceSettings) : null;
      if (!remote) return;
      instance.syncedAt = data.workspaceSettingsUpdatedAt || null;
      if (remote.data.syncScope === "account" && (!instance.savedAt || new Date(instance.syncedAt || 0) > new Date(instance.savedAt || 0))) {
        instance.saved = clone(remote);
        instance.draft = clone(remote);
        instance.savedAt = instance.syncedAt;
        writeJson(STORAGE_KEY, { schemaVersion: SCHEMA_VERSION, savedAt: instance.savedAt, settings: remote });
        applySettings(remote, { persist: true });
        syncControls(instance);
      }
      instance.syncState = remote.data.syncScope === "account" ? "synced" : "device";
      updateDynamic(instance);
    } catch {
      if (instance.draft.data.syncScope === "account") instance.syncState = "error";
      updateDynamic(instance);
    }
  }

  async function storageEstimate(instance) {
    const value = instance.root.querySelector("[data-hhs-storage-size]");
    const bar = instance.root.querySelector("[data-hhs-storage-bar]");
    const note = instance.root.querySelector("[data-hhs-storage-note]");
    if (!navigator.storage?.estimate) {
      if (value) value.textContent = "Không khả dụng";
      if (note) note.textContent = "Trình duyệt không cung cấp Storage Estimate API.";
      return;
    }
    const estimate = await navigator.storage.estimate();
    const used = Number(estimate.usage || 0), quota = Number(estimate.quota || 0);
    const format = (bytes) => bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    if (value) value.textContent = `${format(used)} / ${format(quota)}`;
    if (bar) bar.style.width = `${quota ? Math.min(100, used / quota * 100) : 0}%`;
    if (note) note.textContent = `${quota ? (used / quota * 100).toFixed(2) : 0}% hạn mức trình duyệt đang được sử dụng.`;
  }

  function speakTest(instance) {
    if (!("speechSynthesis" in window)) return showToast(instance, "Thiết bị này chưa hỗ trợ đọc văn bản.", "warning");
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("Xin chào, đây là giọng đọc mặc định của HH Platform.");
    const voices = speechSynthesis.getVoices().filter((voice) => /^vi/i.test(voice.lang));
    const preference = instance.draft.locale.voice;
    const maleHint = /nam|minh|male/i;
    utterance.voice = preference === "system" ? voices[0] : voices.find((voice) => preference === "vi-male" ? maleHint.test(voice.name) : !maleHint.test(voice.name)) || voices[0] || null;
    utterance.lang = "vi-VN";
    utterance.rate = 1;
    speechSynthesis.speak(utterance);
    showToast(instance, utterance.voice ? `Đang dùng ${utterance.voice.name}.` : "Đang dùng giọng Việt mặc định của thiết bị.");
  }

  async function testNotification(instance) {
    const button = instance.root.querySelector("[data-hhs-test-notification]");
    const status = instance.root.querySelector("[data-hhs-notification-status]");
    if (button) button.disabled = true;
    const delivered = [], failed = [];
    if (instance.draft.notifications.inApp) { showToast(instance, "Thông báo thử trong ứng dụng đang hoạt động."); delivered.push("trong ứng dụng"); }
    if (instance.draft.notifications.browser) {
      try {
        if (!("Notification" in window)) throw new Error("không được hỗ trợ");
        const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
        if (permission !== "granted") throw new Error("chưa được cấp quyền");
        new Notification("HH Platform · Thông báo thử", { body: "Kênh thông báo trình duyệt đang hoạt động.", icon: "assets/brand/pwa-192.png?v=1" });
        delivered.push("trình duyệt");
      } catch (error) { failed.push(`trình duyệt: ${error.message}`); }
    }
    if (instance.draft.notifications.email) {
      try {
        const result = await accountRequest("POST", { action: "settings:test-notification" });
        if (!result.delivered) throw new Error("dịch vụ email chưa sẵn sàng");
        delivered.push("email");
      } catch (error) { failed.push(`email: ${error.message}`); }
    }
    if (status) status.textContent = `${delivered.length ? `Đã gửi: ${delivered.join(", ")}.` : "Chưa có kênh nào được gửi."}${failed.length ? ` Chưa gửi được ${failed.join("; ")}.` : ""}`;
    if (button) button.disabled = false;
  }

  async function clearSafeCaches(instance) {
    if (!("caches" in window)) return showToast(instance, "Trình duyệt này không hỗ trợ quản lý cache.", "warning");
    const keys = await caches.keys();
    const targets = keys.filter((key) => /^hh-identity-portal-/i.test(key));
    await Promise.all(targets.map((key) => caches.delete(key)));
    showToast(instance, `Đã xóa ${targets.length} cache giao diện. Dữ liệu tài khoản được giữ nguyên.`);
    storageEstimate(instance);
  }

  function handleInput(instance, target) {
    const path = target.dataset.hhsInput;
    if (!path) return;
    const value = target.type === "checkbox" ? target.checked : target.type === "range" || target.type === "number" ? Number(target.value) : target.value;
    updateField(instance, path, value);
  }

  function bind(instance) {
    instance.onInput = (event) => {
      if (event.target.matches("[data-hhs-input]")) handleInput(instance, event.target);
      if (event.target.matches("[data-hhs-search]")) searchSettings(instance, event.target.value);
      if (event.target.matches("[data-hhs-color-text]")) {
        const path = event.target.dataset.hhsColorText;
        if (/^#[0-9a-f]{6}$/i.test(event.target.value)) updateField(instance, path, event.target.value);
      }
    };
    instance.onChange = async (event) => {
      if (event.target.matches("[data-hhs-import]")) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (file.size > 256 * 1024) return showToast(instance, "Tệp cấu hình vượt quá 256 KB.", "warning");
        try {
          const payload = JSON.parse(await file.text());
          const source = payload.settings || payload;
          if (!source || typeof source !== "object") throw new Error("Cấu trúc tệp không hợp lệ.");
          setDraft(instance, normalize(source));
          showToast(instance, "Đã kiểm tra và nhập cấu hình. Bấm Lưu thay đổi để xác nhận.");
        } catch (error) { showToast(instance, `Không thể nhập: ${error.message}`, "warning"); }
      }
      if (event.target.matches("[data-hhs-pin]")) {
        const routes = new Set(instance.draft.layout.pinnedRoutes);
        if (event.target.checked && routes.size >= 5) { event.target.checked = false; return showToast(instance, "Chỉ có thể ghim tối đa năm mục.", "warning"); }
        if (event.target.checked) routes.add(event.target.dataset.hhsPin); else routes.delete(event.target.dataset.hhsPin);
        updateField(instance, "layout.pinnedRoutes", [...routes]);
      }
    };
    instance.onClick = async (event) => {
      const section = event.target.closest("[data-hhs-section]");
      if (section) return activateSection(instance, section.dataset.hhsSection);
      const theme = event.target.closest("[data-hhs-theme]");
      if (theme) return updateField(instance, "appearance.theme", theme.dataset.hhsTheme);
      const device = event.target.closest("[data-hhs-device-mode]");
      if (device) { instance.previewDevice = device.dataset.hhsDeviceMode; return syncControls(instance); }
      if (event.target.closest("[data-hhs-preview-toggle]")) return instance.root.querySelector("[data-hhs-preview]")?.classList.add("is-open");
      if (event.target.closest("[data-hhs-preview-close]")) return instance.root.querySelector("[data-hhs-preview]")?.classList.remove("is-open");
      if (event.target.closest("[data-hhs-preview-fullscreen]")) return instance.root.querySelector("[data-hhs-preview]")?.classList.toggle("is-expanded");
      if (event.target.closest("[data-hhs-search-close]")) { instance.root.querySelector("[data-hhs-search]").value = ""; return searchSettings(instance, ""); }
      const result = event.target.closest("[data-hhs-search-open]");
      if (result) { const [sectionId, ...path] = result.dataset.hhsSearchOpen.split(":"); return activateSection(instance, sectionId, path.join(":")); }
      if (event.target.closest("[data-hhs-save]")) return save(instance);
      if (event.target.closest("[data-hhs-undo]")) {
        if (!instance.undo.length) return;
        instance.redo.push(clone(instance.draft));
        instance.draft = normalize(instance.undo.pop());
        applySettings(instance.draft, { persist: false });
        return syncControls(instance);
      }
      if (event.target.closest("[data-hhs-redo]")) {
        if (!instance.redo.length) return;
        instance.undo.push(clone(instance.draft));
        instance.draft = normalize(instance.redo.pop());
        applySettings(instance.draft, { persist: false });
        return syncControls(instance);
      }
      if (event.target.closest("[data-hhs-reset-draft]")) return setDraft(instance, instance.saved);
      const resetSection = event.target.closest("[data-hhs-reset-section]");
      if (resetSection) {
        const sectionId = resetSection.dataset.hhsResetSection;
        const next = clone(instance.draft);
        if (sectionId === "overview") Object.assign(next, clone(DEFAULTS)); else next[sectionId] = clone(DEFAULTS[sectionId]);
        return setDraft(instance, next);
      }
      if (event.target.closest("[data-hhs-export]")) {
        download(`hh-settings-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), product: "HH Platform", settings: normalize(instance.draft) }, null, 2));
        return showToast(instance, "Đã xuất tệp cấu hình JSON.");
      }
      if (event.target.closest("[data-hhs-import-trigger]")) return instance.root.querySelector("[data-hhs-import]")?.click();
      if (event.target.closest("[data-hhs-storage-persist]")) return requestPersistentStorage(instance);
      if (event.target.closest("[data-hhs-clear-cache]")) return clearSafeCaches(instance);
      if (event.target.closest("[data-hhs-security-audit]")) return runSecurityAudit(instance, { announce: true });
      if (event.target.closest("[data-hhs-security-report]")) {
        const audit = instance.securityAudit || securitySnapshot();
        download(`hh-security-check-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ schemaVersion: 1, product: "HH Platform", generatedAt: audit.generatedAt, privacy: "Không gồm email, IP, token, cookie, user-agent hoặc nội dung người dùng.", score: audit.score, checks: audit.checks.map(({ id, label, ok, detail }) => ({ id, label, ok, detail })) }, null, 2));
        return showToast(instance, "Đã tải báo cáo bảo mật đã khử danh tính.");
      }
      if (event.target.closest("[data-hhs-clear-legacy-auth]")) {
        const existed = Boolean(localStorage.getItem("hh-auth-token"));
        localStorage.removeItem("hh-auth-token");
        await runSecurityAudit(instance);
        return showToast(instance, existed ? "Đã xóa token legacy khỏi localStorage. Phiên HttpOnly hiện tại không bị ảnh hưởng." : "Không tìm thấy token legacy trong localStorage.");
      }
      if (event.target.closest("[data-hhs-clear-local]")) {
        if (!confirm("Xóa toàn bộ tùy chỉnh giao diện trên thiết bị này? Hồ sơ và dữ liệu tài khoản không bị xóa.")) return;
        [STORAGE_KEY, HISTORY_KEY, THEME_KEY, THEME_PREFERENCES_KEY].forEach((key) => localStorage.removeItem(key));
        instance.saved = clone(DEFAULTS); instance.draft = clone(DEFAULTS); instance.savedAt = null; instance.undo = []; instance.redo = [];
        applySettings(instance.draft, { persist: true }); syncControls(instance);
        return showToast(instance, "Đã xóa tùy chỉnh local và khôi phục mặc định.");
      }
      const restore = event.target.closest("[data-hhs-restore-history]");
      if (restore) {
        const item = readJson(HISTORY_KEY, [])[Number(restore.dataset.hhsRestoreHistory)];
        if (item?.settings) { setDraft(instance, item.settings); showToast(instance, "Đã nạp phiên bản cũ. Bấm Lưu thay đổi để xác nhận."); }
        return;
      }
      if (event.target.closest("[data-hhs-voice-test]")) return speakTest(instance);
      if (event.target.closest("[data-hhs-test-notification]")) return testNotification(instance);
    };
    instance.beforeUnload = (event) => { if (instance.dirty) { event.preventDefault(); event.returnValue = ""; } };
    instance.navigationGuard = (event) => {
      const target = event.target.closest?.("[data-app-route],a[href^='#/']");
      if (!target || !instance.dirty) return;
      if (!confirm("Bạn có thay đổi cài đặt chưa lưu. Rời trang và bỏ các thay đổi này?")) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    instance.visibility = () => { if (instance.draft.motion.pauseHidden) document.body.classList.toggle("app-effects-paused", document.hidden); };
    instance.keydown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f" && instance.root.contains(document.activeElement)) {
        event.preventDefault(); instance.root.querySelector("[data-hhs-search]")?.focus();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.shiftKey && !event.target.matches("input,textarea")) { event.preventDefault(); instance.root.querySelector("[data-hhs-undo]")?.click(); }
      if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z")) && !event.target.matches("input,textarea")) { event.preventDefault(); instance.root.querySelector("[data-hhs-redo]")?.click(); }
    };
    instance.root.addEventListener("input", instance.onInput);
    instance.root.addEventListener("change", instance.onChange);
    instance.root.addEventListener("click", instance.onClick);
    window.addEventListener("beforeunload", instance.beforeUnload);
    document.addEventListener("click", instance.navigationGuard, true);
    document.addEventListener("visibilitychange", instance.visibility);
    document.addEventListener("keydown", instance.keydown);
  }

  function mount(root) {
    if (!root) return false;
    if (activeInstance && activeInstance.root !== root) unmount(activeInstance.root);
    if (instances.has(root) && root.querySelector("[data-hh-settings-studio]")) return true;
    if (instances.has(root)) unmount(root);
    const stored = readStored();
    root.innerHTML = studioMarkup();
    root.closest(".app-main")?.scrollTo({ top: 0, behavior: "auto" });
    const instance = {
      root, saved: clone(stored.settings), draft: clone(stored.settings), savedAt: stored.savedAt,
      undo: [], redo: [], activeSection: "overview", previewDevice: "desktop", syncState: "device",
      syncedAt: null, saving: false, dirty: false, toastTimer: 0, securityAudit: securitySnapshot()
    };
    instances.set(root, instance); activeInstance = instance;
    bind(instance);
    applySettings(instance.draft, { persist: false });
    syncControls(instance);
    storageEstimate(instance);
    runSecurityAudit(instance);
    loadRemote(instance);
    return true;
  }

  function unmount(root = activeInstance?.root) {
    const instance = root ? instances.get(root) : null;
    if (!instance) return;
    if (instance.dirty) applySettings(instance.saved, { persist: false });
    clearTimeout(instance.toastTimer);
    instance.root.removeEventListener("input", instance.onInput);
    instance.root.removeEventListener("change", instance.onChange);
    instance.root.removeEventListener("click", instance.onClick);
    window.removeEventListener("beforeunload", instance.beforeUnload);
    document.removeEventListener("click", instance.navigationGuard, true);
    document.removeEventListener("visibilitychange", instance.visibility);
    document.removeEventListener("keydown", instance.keydown);
    instances.delete(root);
    if (activeInstance === instance) activeInstance = null;
  }

  window.HHSettingsStudio = Object.freeze({ DEFAULTS: clone(DEFAULTS), mount, normalize, unmount });
  window.dispatchEvent(new CustomEvent("hh:settings-studio-ready"));
})();
