(function fortuneHubModule(globalScope, factory) {
  "use strict";

  const api = factory(globalScope || {});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope && typeof globalScope === "object") globalScope.HHFortuneHub = api;
})(typeof window !== "undefined" ? window : globalThis, function createFortuneHub(globalScope) {
  "use strict";

  const VERSION = "9.6.2";
  const STORAGE_SCHEMA = "hh.fortune.hub.v1";
  const MAX_HISTORY = 80;
  const MAX_JOURNAL = 120;
  const DEFAULT_ORBS = Object.freeze({ conjunction: 8, sextile: 5, square: 7, trine: 7, opposition: 8 });
  const AI_PRIVACY_NOTICE = "Website không tự kèm hồ sơ, ngày sinh, tọa độ hoặc nhật ký khác.";
  const AUTOMATIC_AI_VIEWS = Object.freeze(["tarot", "symbols", "zodiac", "numerology", "iching", "chart", "tuvi", "physiognomy", "dreams", "moon", "sky", "eastern", "compatibility", "session"]);
  const VIEWS = new Set(["today", "profile", "session", "accuracy", "tarot", "academy", "zodiac", "numerology", "iching", "tuvi", "physiognomy", "dreams", "moon", "sky", "calendar", "chart", "eastern", "symbols", "compatibility", "journal", "copilot", "methods", "history"]);
  const SYNODIC_MONTH_DAYS = 29.530588853;
  const REFERENCE_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14, 0);
  const NUMBER_MEANINGS = Object.freeze({
    1: "khởi xướng và tự chủ", 2: "hợp tác và tinh tế", 3: "biểu đạt và sáng tạo", 4: "cấu trúc và bền bỉ", 5: "thay đổi và trải nghiệm", 6: "trách nhiệm và chăm sóc", 7: "chiêm nghiệm và phân tích", 8: "quản trị và kết quả", 9: "nhân văn và hoàn thiện", 11: "trực giác và truyền cảm hứng", 22: "tầm nhìn và năng lực kiến tạo", 33: "phục vụ và lòng trắc ẩn"
  });
  const THEMES = Object.freeze(["cosmic-oracle", "eastern-temple", "moonlit-forest", "arcane-library", "crystal-dream", "blood-moon"]);
  const MOTION_LEVELS = Object.freeze(["static", "balanced", "cinematic"]);
  const LEGACY_THEME_MAP = Object.freeze({ galaxy: "cosmic-oracle", eastern: "eastern-temple", minimal: "crystal-dream", mystic: "cosmic-oracle" });
  const THEME_OPTIONS = Object.freeze([
    ["cosmic-oracle", "Cosmic Oracle", "Tím · cyan · tinh vân"], ["eastern-temple", "Eastern Temple", "Đỏ son · vàng · mực tàu"],
    ["moonlit-forest", "Moonlit Forest", "Rừng đêm · đom đóm"], ["arcane-library", "Arcane Library", "Sách cổ · nến · đồng"],
    ["crystal-dream", "Crystal Dream", "Pha lê · pastel"], ["blood-moon", "Blood Moon", "Đỏ đen điện ảnh"]
  ]);
  const VIEW_VISUALS = Object.freeze({
    today: ["✦", "Đại sảnh Huyền Giới", "observatory"], tarot: ["♢", "Tarot 78", "tarot"], academy: ["▣", "Tarot Academy", "tarot"],
    iching: ["☯", "Kinh Dịch 64 quẻ", "iching"], chart: ["◎", "Astrology Studio", "astrology"], moon: ["☾", "Mặt Trăng", "moon"], sky: ["✺", "Moon & Sky", "moon"],
    numerology: ["#", "Thần số học", "numerology"], symbols: ["ᚠ", "Lenormand · Rune", "runes"], eastern: ["☯", "Hệ phương Đông", "eastern"],
    tuvi: ["紫", "Tử Vi Đẩu Số", "eastern"], physiognomy: ["◌", "Nhân tướng học", "oracle"], dreams: ["☁", "Giấc mơ & biểu tượng", "journal"],
    journal: ["✎", "Nhật ký", "journal"], calendar: ["▦", "Lịch chiêm nghiệm", "journal"], copilot: ["AI", "Reflection Copilot", "oracle"],
    zodiac: ["☼", "Cung & con giáp", "astrology"], compatibility: ["∞", "Tương tác", "oracle"], profile: ["◉", "Hồ sơ phiên", "observatory"],
    session: ["➜", "Phiên tổng hợp", "oracle"], accuracy: ["✓", "Accuracy Lab", "oracle"], methods: ["ⓘ", "Phương pháp", "library"], history: ["◷", "Lịch sử", "library"]
  });
  const OBSERVATORY_GROUPS = Object.freeze([
    { id: "popular", label: "Phổ biến", icon: "✦", items: [["today","✦","Tổng quan"],["tarot","♢","Tarot 78 Studio"],["iching","☯","Kinh Dịch"],["numerology","#","Thần số học"],["zodiac","☼","Cung hoàng đạo"],["session","➜","Xem tổng hợp"]] },
    { id: "astronomy", label: "Thiên văn & lịch", icon: "◎", items: [["chart","◎","Bản đồ sao"],["moon","☾","Pha Mặt Trăng"],["sky","✺","Hành tinh & góc hợp"],["calendar","▦","Lịch âm–dương"],["eastern","☯","Tiết khí & chu kỳ"]] },
    { id: "eastern", label: "Hệ phương Đông", icon: "紫", items: [["tuvi","紫","Tử Vi"],["eastern","☯","Can–Chi & ngũ hành"],["iching","☯","Kinh Dịch 64 quẻ"],["calendar","▦","Lịch phương Đông"],["physiognomy","◌","Nhân tướng học"]] },
    { id: "symbols", label: "Hệ biểu tượng", icon: "ᚠ", items: [["symbols","✧","Lenormand & Rune"],["tarot","♢","Tarot Studio"],["academy","▣","Tarot Academy"],["dreams","☁","Giấc mơ"],["methods","⌘","Symbol Atlas"]] },
    { id: "reflection", label: "Chiêm nghiệm", icon: "✎", items: [["journal","✎","Nhật ký"],["history","◷","Lịch sử phiên"],["compatibility","∞","So sánh kết quả"],["methods","ⓘ","Trung tâm phương pháp"],["accuracy","✓","Accuracy Lab"],["profile","◉","Hồ sơ phiên"]] }
  ]);
  const OBSERVATORY_ATLAS_GROUPS = Object.freeze([
    { id: "start", label: "Bắt đầu", icon: "✦", items: [["today","✦","Tổng quan"],["session","➜","Xem tổng hợp"],["profile","◉","Hồ sơ phiên"],["numerology","#","Thần số học"]] },
    { id: "symbols", label: "Biểu tượng", icon: "ᚠ", items: [["tarot","♢","Tarot 78"],["academy","▣","Tarot Academy"],["symbols","✧","Lenormand & Rune"],["dreams","☁","Giấc mơ"]] },
    { id: "astronomy", label: "Thiên văn & lịch", icon: "◎", items: [["zodiac","☼","Cung & con giáp"],["chart","◎","Bản đồ sao"],["moon","☾","Mặt Trăng 3D"],["sky","✺","Hành tinh & góc hợp"],["calendar","▦","Lịch âm–dương"]] },
    { id: "eastern", label: "Phương Đông", icon: "紫", items: [["iching","☯","Kinh Dịch 64"],["tuvi","紫","Tử Vi"],["eastern","☯","Can–Chi & tiết khí"],["physiognomy","◌","Nhân tướng học"]] },
    { id: "reflection", label: "Chiêm nghiệm", icon: "✎", items: [["compatibility","∞","Tương tác"],["journal","✎","Nhật ký"],["copilot","AI","HH AI Copilot"],["methods","ⓘ","Phương pháp"],["accuracy","✓","Accuracy Lab"],["history","◷","Lịch sử"]] }
  ]);
  const TOOL_LIBRARY_DETAILS = Object.freeze({
    tarot: { tone: "tarot", family: "symbols", badge: "78 lá", beginner: "Rút bài và đặt câu hỏi chiêm nghiệm.", advanced: "Spread 1–10 lá, seed và Result Contract." },
    iching: { tone: "iching", family: "eastern", badge: "64 quẻ", beginner: "Gieo ba đồng xu và đọc cấu trúc quẻ.", advanced: "Quẻ chính, hỗ, biến và sáu hào động." },
    numerology: { tone: "numerology", family: "reflection", badge: "Chỉ số", beginner: "Khám phá các con số từ ngày sinh và tên.", advanced: "Biểu đồ, chu kỳ và trường phái tách biệt." },
    zodiac: { tone: "astrology", family: "astronomy", badge: "12 cung", beginner: "Cung hoàng đạo và con giáp theo ngày sinh.", advanced: "Tropical, sidereal và provenance đầu vào." },
    session: { tone: "oracle", family: "reflection", badge: "Kết hợp", beginner: "Kết hợp nhiều công cụ trong một luồng.", advanced: "Result Contract, HH AI và nhật ký liên kết." },
    chart: { tone: "astrology", family: "astronomy", badge: "Natal", beginner: "Bản đồ sao cá nhân có kiểm tra dữ liệu.", advanced: "Nhà, hành tinh, góc hợp và nhiều hệ tính." },
    moon: { tone: "moon", family: "astronomy", badge: "3D", beginner: "Quan sát pha Mặt Trăng hiện tại.", advanced: "Texture NASA, rise/set và timeline thiên văn." },
    sky: { tone: "moon", family: "astronomy", badge: "Sky", beginner: "Theo dõi hành tinh và các mốc bầu trời.", advanced: "Transit, twilight, eclipse và apsis." },
    calendar: { tone: "journal", family: "astronomy", badge: "Âm–dương", beginner: "Xem lịch, pha trăng và ghi chú theo ngày.", advanced: "Tiết khí, chu kỳ và timeline dữ liệu đã lưu." },
    eastern: { tone: "eastern", family: "eastern", badge: "Can–Chi", beginner: "Can–Chi, ngũ hành và tiết khí.", advanced: "Chu kỳ phương Đông với nguồn và giới hạn rõ." },
    tuvi: { tone: "eastern", family: "eastern", badge: "12 cung", beginner: "Lá số Tử Vi và cách đọc từng cung.", advanced: "Cung, sao, đại vận và dữ liệu lịch tách lớp." },
    physiognomy: { tone: "oracle", family: "eastern", badge: "Tự nhập", beginner: "Tự mô tả đặc điểm để suy ngẫm an toàn.", advanced: "Không nhận diện ảnh; hiển thị giới hạn phương pháp." },
    symbols: { tone: "runes", family: "symbols", badge: "36+24", beginner: "Lenormand và Rune theo trải bài có seed.", advanced: "Grand Tableau, vị trí và lớp biểu tượng." },
    academy: { tone: "tarot", family: "symbols", badge: "Học tập", beginner: "Học Tarot bằng bài ngắn và flashcard.", advanced: "Track, quiz và lịch ôn theo mức tự tin." },
    dreams: { tone: "journal", family: "symbols", badge: "Local", beginner: "Ghi lại giấc mơ và cảm xúc thực tế.", advanced: "Symbol Atlas và phân tích được gắn nhãn AI." },
    compatibility: { tone: "oracle", family: "reflection", badge: "So sánh", beginner: "Đối chiếu hai kết quả theo câu hỏi mở.", advanced: "Tách dữ liệu, biểu tượng và giả định so sánh." },
    journal: { tone: "journal", family: "reflection", badge: "Local-first", beginner: "Ghi chú và theo dõi cảm xúc trên thiết bị.", advanced: "AES-GCM, tìm kiếm và xuất dữ liệu." },
    methods: { tone: "library", family: "reflection", badge: "Nguồn", beginner: "Hiểu công cụ đang tính gì và không tính gì.", advanced: "Engine, công thức, phiên bản và provenance." },
    accuracy: { tone: "oracle", family: "reflection", badge: "QA", beginner: "Kiểm tra đầu vào và độ tin cậy kỹ thuật.", advanced: "Digest, SHA-256, timezone và sai số." },
    history: { tone: "library", family: "reflection", badge: "Đã lưu", beginner: "Mở lại các phiên bạn chủ động lưu.", advanced: "Lọc, so sánh, xuất và quản lý dữ liệu." }
  });
  const TOOL_LIBRARY_FILTERS = Object.freeze([["all","Tất cả","✦"],["symbols","Biểu tượng","♢"],["astronomy","Thiên văn","◎"],["eastern","Phương Đông","☯"],["reflection","Chiêm nghiệm","✎"]]);
  const POPULAR_TOOL_IDS = Object.freeze(["tarot", "iching", "numerology", "moon"]);
  const RESULT_TABS = Object.freeze([
    ["overview", "Tổng quan", "✦"], ["details", "Chi tiết", "▦"], ["deep", "Luận giải sâu", "◇"],
    ["method", "Phương pháp", "⌘"], ["ai", "HH AI", "AI"], ["reflection", "Chiêm nghiệm", "✎"]
  ]);
  const RESULT_TAB_GROUPS = Object.freeze([
    ["results", "KẾT QUẢ", ["overview", "details", "deep"]],
    ["verification", "KIỂM CHỨNG", ["method"]],
    ["support", "HỖ TRỢ", ["ai", "reflection"]]
  ]);
  const FLOW_STEPS = Object.freeze([
    ["input", "Nhập dữ liệu"], ["calculate", "Tính / Rút"], ["interpret", "Luận giải"], ["reflect", "Chiêm nghiệm"]
  ]);
  const PROFILE_CITIES = Object.freeze({
    hanoi: { label: "Hà Nội", latitude: 21.0285, longitude: 105.8542, elevation: 12, timezone: 7, timezoneId: "Asia/Ho_Chi_Minh" },
    hochiminh: { label: "TP. Hồ Chí Minh", latitude: 10.8231, longitude: 106.6297, elevation: 19, timezone: 7, timezoneId: "Asia/Ho_Chi_Minh" },
    danang: { label: "Đà Nẵng", latitude: 16.0544, longitude: 108.2022, elevation: 8, timezone: 7, timezoneId: "Asia/Ho_Chi_Minh" },
    tokyo: { label: "Tokyo", latitude: 35.6762, longitude: 139.6503, elevation: 40, timezone: 9, timezoneId: "Asia/Tokyo" },
    seoul: { label: "Seoul", latitude: 37.5665, longitude: 126.978, elevation: 38, timezone: 9, timezoneId: "Asia/Seoul" },
    paris: { label: "Paris", latitude: 48.8566, longitude: 2.3522, elevation: 35, timezone: 1, timezoneId: "Europe/Paris" },
    newyork: { label: "New York", latitude: 40.7128, longitude: -74.006, elevation: 10, timezone: -5, timezoneId: "America/New_York" }
  });
  function suiteV4() { try { return globalScope.HHFortuneSuiteV4 || (typeof require === "function" ? require("./fortune-suite-v4") : null); } catch (_error) { return null; } }
  function extendedTools() { try { return globalScope.HHFortuneExtendedTools || (typeof require === "function" ? require("./fortune-extended-tools") : null); } catch (_error) { return null; } }
  function accuracyLab() { try { return globalScope.HHFortuneAccuracyLab || (typeof require === "function" ? require("./fortune-accuracy-lab") : null); } catch (_error) { return null; } }
  function astrologyV4() { try { return globalScope.HHFortuneAstrologyV4 || (typeof require === "function" ? require("./fortune-astrology-v4") : null); } catch (_error) { return null; } }
  function tarotCardsForView(reading) {
    return (reading?.cards || []).map((card) => ({
      ...card,
      interpretation: card.reversed ? card.shadow : card.light,
      color: card.color || (card.suit === "Wands" ? "#ff9b75" : card.suit === "Cups" ? "#67d9ff" : card.suit === "Swords" ? "#b6a5ff" : "#f0ca76"),
      question: card.question || "Điều gì trong hình tượng này đáng được đối chiếu với dữ kiện thật?"
    }));
  }
  function ichingForView(result) {
    if (!result?.ok) return null;
    const primary = result.primary || {}; const changed = result.changed || {}; const nuclear = result.nuclear || {};
    return {
      lines: result.lines || [], changing: result.moving || [],
      lower: result.lower, upper: result.upper,
      title: `${primary.title || primary.name || "Quẻ chính"}${primary.structure ? ` · ${primary.structure}` : ""}`,
      changedTitle: `${changed.title || changed.name || "Quẻ biến"}${changed.structure ? ` · ${changed.structure}` : ""}`,
      nuclearTitle: `${nuclear.title || nuclear.name || "Quẻ hỗ"}${nuclear.structure ? ` · ${nuclear.structure}` : ""}`,
      reflection: primary.theme || result.rule || "Đọc cấu trúc quẻ như một câu hỏi mở.",
      question: result.rule || "Hãy đối chiếu hào động với dữ kiện thật."
    };
  }
  const METHOD_CATALOG = Object.freeze([
    { id: "tarot", title: "Rider–Waite–Smith Tarot 78", system: "22 Major + 56 Minor · tên chuẩn Anh–Việt · trải 1/3/5/7/10/12/15 lá", input: "Chủ đề tùy chọn + seed", algorithm: "Fisher-Yates + Mulberry32 từ FNV-1a seed; lá đảo 36%", precision: "Tái tạo chính xác theo cùng seed, số lá và chế độ đảo", nature: "Hình ảnh RWS 1909 public domain; diễn giải HH là biểu tượng", source: "Pamela Colman Smith · Wikimedia Commons · Public Domain Mark 1.0", version: "tarot-rws-78-v2" },
    { id: "zodiac", title: "Cung Mặt Trời", system: "12 đoạn tropical 30° từ điểm xuân phân", input: "Ngày, giờ nếu biết và timezone IANA", algorithm: "Kinh độ Mặt Trời địa tâm từ Astronomy Engine; quét cả ngày khi không biết giờ", precision: "Hiển thị kinh độ, UTC, khoảng biến thiên và cảnh báo ranh giới", nature: "Kinh độ là tính toán; nhãn cung là lớp chiêm tinh biểu tượng", source: "Astronomy Engine MIT · JPL dùng làm baseline ngoài", version: "zodiac-solar-longitude-v2" },
    { id: "chinese", title: "12 con giáp", system: "Tết Âm lịch hoặc Lập Xuân, do người dùng chọn", input: "Ngày sinh + timezone IANA + mốc đổi năm", algorithm: "Intl Chinese relatedYear hoặc Mặt Trời đạt 315°", precision: "Hai phương pháp được giữ riêng và công khai công thức", nature: "Lịch chu kỳ + diễn giải biểu tượng", source: "Intl Chinese Calendar · Astronomy Engine · HKO định nghĩa tiết khí", version: "chinese-boundary-v2" },
    { id: "numerology", title: "Thần số học", system: "Pythagoras hoặc Chaldean, không trộn bảng", input: "Ngày sinh hoặc tên", algorithm: "Cộng chữ số và rút gọn; giữ 11/22/33 theo cấu hình", precision: "Công thức tái tạo được", nature: "Hệ biểu tượng", source: "Bảng ánh xạ hiển thị trong kết quả", version: "number-v3" },
    { id: "iching", title: "Kinh Dịch 64 quẻ", system: "Đồng xu / xác suất cỏ thi / nhập 6 hào · chính/hỗ/biến/đối/đảo", input: "Seed, phương pháp hoặc sáu giá trị 6–9", algorithm: "Đồng xu tổng 6–9; cỏ thi theo phân bố 1/16·5/16·7/16·3/16", precision: "Tái tạo chính xác theo cùng seed và phương pháp", nature: "Cấu trúc cổ điển + diễn giải HH nguyên bản", source: "Tên Hán–Việt; phần giải thích HH tự biên soạn", version: "iching-advanced-v1" },
    { id: "tuvi", title: "Tử Vi Đẩu Số 12 cung", system: "12 cung, Mệnh/Thân, chính tinh, phụ tinh, Tứ Hóa, Tràng Sinh và đại hạn", input: "Ngày dương lịch, giờ địa phương, giới tính theo quy tắc an sao, hiệu chỉnh tháng nhuận", algorithm: "iztro 2.6.0 · bySolar · locale vi-VN; không tự đoán giờ", precision: "Engine lập lá số xác định theo cùng đầu vào; nhiều trường phái có thể khác quy tắc an sao", nature: "Hệ biểu tượng truyền thống; AI chỉ diễn giải cấu trúc đã tính", source: "iztro 2.6.0 · MIT · SylarLong/iztro", version: "ziwei-iztro-v1" },
    { id: "physiognomy", title: "Nhân tướng học tự quan sát", system: "Tự mô tả năm nhóm hình học, tách quan sát khỏi liên tưởng văn hóa", input: "Lựa chọn do người dùng tự nhập; không camera, không ảnh", algorithm: "Tra cứu nội dung HH cục bộ và tạo câu hỏi phản biện", precision: "Không đưa ra độ chính xác sinh trắc học hoặc suy luận tính cách", nature: "Lịch sử văn hóa + tự chiêm nghiệm, không phải khoa học dự báo", source: "HH biên soạn; đối chiếu lịch sử với Chinese Text Project", version: "physiognomy-reflection-v1" },
    { id: "dreams", title: "Giấc mơ & Symbol Journal", system: "Nhận diện từ khóa cục bộ, cảm xúc, bối cảnh và câu hỏi phản tư", input: "Mô tả giấc mơ trong tab hiện tại", algorithm: "Khớp thư viện biểu tượng có giới hạn; không gửi Gemini và không tự lưu", precision: "Không áp một từ điển phổ quát; luôn giữ khả năng không khớp", nature: "Nhật ký biểu tượng, không dự báo hoặc chẩn đoán", source: "Nội dung HH nguyên bản", version: "dream-symbol-local-v1" },
    { id: "moon", title: "Pha Mặt Trăng", system: "Chu kỳ giao hội trung bình", input: "Ngày", algorithm: "29,530588853 ngày từ mốc trăng non UTC", precision: "Xấp xỉ; không dùng cho quan sát chuyên nghiệp", nature: "Thiên văn cho pha; gợi ý nhật ký là biểu tượng", source: "USNO + NASA", version: "moon-v2" },
    { id: "chart", title: "Astrology Studio", system: "Tropical/Sidereal xấp xỉ · Equal/Whole Sign · natal/transit/progression/return/synastry/relocation", input: "Ngày, giờ, IANA timezone, tọa độ, hệ nhà và orb", algorithm: "Astronomy Engine 2.1.19; cung mọc từ thời gian sao; góc hợp theo orb cấu hình", precision: "Vị trí hành tinh theo engine; nhà/cung mọc phụ thuộc tuyệt đối vào dữ liệu sinh", nature: "Vị trí là thiên văn; diễn giải cung/nhà là chiêm tinh", source: "Astronomy Engine MIT · VSOP87/NOVAS/JPL", version: "astrology-v4" },
    { id: "compatibility", title: "Đối chiếu hai hồ sơ", system: "Cung, nguyên tố, con giáp và đường đời đặt cạnh nhau", input: "Hai ngày sinh + bối cảnh", algorithm: "So sánh mô tả và tạo câu hỏi giao tiếp; không tạo điểm số", precision: "Công thức nguồn tái tạo được; câu hỏi là nội dung HH", nature: "Diễn giải biểu tượng trung lập", source: "HH tự biên soạn", version: "compare-v2" },
    { id: "calendar", title: "Lịch chiêm nghiệm", system: "Pha trăng, chu kỳ cá nhân và dữ liệu đã lưu", input: "Ngày neo + ngày sinh tùy chọn", algorithm: "Lịch tuần/tháng/timeline; phép pha trăng và chu kỳ công khai", precision: "Pha trăng xấp xỉ; số ghi chú là dữ liệu thực", nature: "Thiên văn xấp xỉ + dữ liệu local + biểu tượng", source: "USNO/NASA + dữ liệu thiết bị", version: "calendar-v1" },
    { id: "journal", title: "Nhật ký mã hóa", system: "Local-first · AES-GCM 256", input: "Nội dung, nhãn, cảm xúc và PIN tùy chọn", algorithm: "PBKDF2 SHA-256 180.000 vòng; AES-GCM với salt/IV ngẫu nhiên", precision: "Mã hóa chuẩn Web Crypto; mất PIN không thể khôi phục", nature: "Dữ liệu riêng tư do người dùng nhập", source: "Web Crypto API", version: "journal-v2" },
    { id: "copilot", title: "Reflection Copilot", system: "AI hỗ trợ suy ngẫm, không bói thay", input: "Kết quả người dùng chủ động chọn", algorithm: "Gemini với prompt an toàn; không tự đăng và không quyết định thay", precision: "AI có thể sai; đầu ra luôn gắn nhãn", nature: "Nội dung AI", source: "Gemini API phía server", version: "copilot-v1" }
    ,{ id: "provenance", title: "Accuracy & Provenance", system: "Bản ghi đầu vào, IANA timezone, engine, thuật toán, nội dung và nhãn", input: "Dữ liệu thật của từng phép tính", algorithm: "hh.fortune.provenance.v1", precision: "Tái tạo kỹ thuật khi đủ seed hoặc timestamp + hồ sơ", nature: "Kiểm toán dữ liệu", source: "HH Fortune Suite V4 · IANA tzdb của runtime", version: "provenance-v1" }
    ,{ id: "sky", title: "Moon & Sky", system: "Pha, timeline tháng, mọc/lặn/transit, ba mức twilight, altitude, apsis, eclipse và mùa", input: "Ngày + IANA timezone + tọa độ + độ cao", algorithm: "Astronomy Engine VSOP87/NOVAS · topocentric horizon", precision: "Công khai refraction và việc chưa mô hình hóa địa hình; không dùng cho điều hướng", nature: "Tính toán thiên văn", source: "Astronomy Engine MIT · USNO · NASA Moon", version: "moon-sky-v2" }
    ,{ id: "eastern", title: "Nền lịch phương Đông", system: "Can Chi + hai mốc đổi năm + Intl Chinese Calendar + 24 tiết khí", input: "Ngày + IANA timezone", algorithm: "Chu kỳ Can Chi, relatedYear và tìm 24 kinh độ Mặt Trời", precision: "Bát Tự/Tử Vi chưa bật khi chưa qua fixture và chuyên gia", nature: "Lịch tính toán + biểu tượng có giới hạn", source: "Astronomy Engine · HKO · IANA", version: "eastern-calendar-v2" }
    ,{ id: "symbols", title: "Lenormand · Rune · Oracle", system: "36 Lenormand có inset, 24 Elder Futhark có transliteration, 24 Oracle HH", input: "Bộ + số lá + seed + tùy chọn Rune đảo", algorithm: "Web Crypto seed + Fisher-Yates/Mulberry32 replay", precision: "Tái tạo chính xác và xác minh seed proof", nature: "Dữ liệu lịch sử/ngôn ngữ tách khỏi diễn giải biểu tượng", source: "Game of Hope 1799 · Wikimedia Commons PDM · Unicode Runic · HH Original", version: "symbol-decks-v2" }
  ]);

  const TAROT = Object.freeze([
    { id: "wanderer", symbol: "✦", name: "Người Lữ Hành", light: "Bắt đầu với tâm thế cởi mở và cho phép mình học trong lúc đi.", shadow: "Sự vội vàng có thể khiến bạn bỏ qua một chi tiết quan trọng.", question: "Bước nhỏ an toàn nào có thể bắt đầu ngay hôm nay?", color: "#79e9ff" },
    { id: "maker", symbol: "◇", name: "Người Kiến Tạo", light: "Bạn đang có đủ nguồn lực để biến một ý tưởng thành hành động cụ thể.", shadow: "Đừng nhầm việc chuẩn bị công cụ với việc thật sự bắt tay làm.", question: "Nguồn lực nào đang có sẵn nhưng chưa được dùng?", color: "#b68cff" },
    { id: "inner-voice", symbol: "☾", name: "Tiếng Nói Bên Trong", light: "Khoảng lặng sẽ giúp bạn nhận ra điều mình đã biết từ lâu.", shadow: "Trực giác cần được kiểm tra bằng dữ kiện và cuộc đối thoại thành thật.", question: "Điều gì trở nên rõ hơn khi bạn ngừng cố trả lời thật nhanh?", color: "#8aa7ff" },
    { id: "garden", symbol: "❀", name: "Khu Vườn", light: "Sự chăm sóc đều đặn đang tạo nên một nền tảng bền vững.", shadow: "Cho đi quá nhiều mà không phục hồi sẽ làm cạn năng lượng.", question: "Bạn cần nuôi dưỡng điều gì, và cần đặt ranh giới ở đâu?", color: "#7bf1b8" },
    { id: "structure", symbol: "▦", name: "Nền Móng", light: "Một cấu trúc rõ ràng sẽ giúp ý tưởng phát triển ổn định hơn.", shadow: "Quy tắc cũ có thể đang giới hạn một cách làm mới tốt hơn.", question: "Quy tắc nào đang bảo vệ bạn, quy tắc nào cần được xem lại?", color: "#ffb879" },
    { id: "mentor", symbol: "⌁", name: "Người Dẫn Đường", light: "Kinh nghiệm được chia sẻ đúng lúc có thể rút ngắn một hành trình dài.", shadow: "Đừng trao toàn bộ quyền quyết định của mình cho một tiếng nói bên ngoài.", question: "Bạn cần tham khảo ai nhưng vẫn phải tự quyết điều gì?", color: "#ffd77a" },
    { id: "choice", symbol: "∞", name: "Giao Điểm", light: "Một lựa chọn phù hợp sẽ thống nhất giá trị, cảm xúc và hành động.", shadow: "Cố giữ mọi khả năng có thể khiến bạn không thật sự chọn con đường nào.", question: "Lựa chọn nào gần nhất với giá trị cốt lõi của bạn?", color: "#ff8fbf" },
    { id: "momentum", symbol: "➶", name: "Động Lực", light: "Hướng đi rõ ràng giúp nhiều nguồn năng lượng cùng tiến về một phía.", shadow: "Tốc độ không thay thế được việc kiểm tra xem mình có đi đúng hướng không.", question: "Điều gì cần được ưu tiên để tiến lên mà không bị phân tán?", color: "#6be1ff" },
    { id: "calm-strength", symbol: "◉", name: "Sức Mạnh Dịu Dàng", light: "Kiên định, kiên nhẫn và lòng trắc ẩn đang mạnh hơn sự cưỡng ép.", shadow: "Nén cảm xúc quá lâu không phải là bình tĩnh thực sự.", question: "Bạn có thể vững vàng mà vẫn tử tế với mình như thế nào?", color: "#ff9a7c" },
    { id: "lantern", symbol: "✧", name: "Ngọn Đèn", light: "Tạm lùi lại sẽ giúp bạn nhìn thấy điều bị tiếng ồn che khuất.", shadow: "Sự riêng tư hữu ích có thể biến thành cô lập nếu kéo dài quá lâu.", question: "Bạn cần khoảng lặng hay cần một cuộc trò chuyện đáng tin cậy?", color: "#a9b9ff" },
    { id: "turning", symbol: "↻", name: "Vòng Chuyển", light: "Hoàn cảnh đang thay đổi; sự linh hoạt sẽ mở ra lựa chọn mới.", shadow: "Đừng giao trách nhiệm của mình hoàn toàn cho may rủi.", question: "Phần nào bạn có thể chủ động dù hoàn cảnh đang đổi thay?", color: "#76ead6" },
    { id: "balance", symbol: "⚖", name: "Cán Cân", light: "Sự rõ ràng đến từ việc nhìn cả ý định, hành động và hệ quả.", shadow: "Tự phán xét khắt khe không tạo ra một quyết định công bằng hơn.", question: "Dữ kiện nào còn thiếu trước khi bạn đưa ra kết luận?", color: "#c9a3ff" },
    { id: "new-angle", symbol: "⌄", name: "Góc Nhìn Khác", light: "Dừng lại và đổi góc nhìn có thể làm lộ ra một con đường chưa thấy.", shadow: "Trì hoãn vô hạn không còn là suy ngẫm mà là né tránh.", question: "Giả định nào cần được đảo ngược để nhìn vấn đề khác đi?", color: "#7fc9ff" },
    { id: "release", symbol: "◐", name: "Chuyển Hóa", light: "Khép lại một điều đã hoàn thành sẽ tạo chỗ cho giai đoạn mới.", shadow: "Bám vào phiên bản cũ có thể khiến thay đổi trở nên nặng nề hơn.", question: "Điều gì đã hoàn thành vai trò và có thể được buông xuống?", color: "#917dff" },
    { id: "harmony", symbol: "≈", name: "Dòng Hòa Hợp", light: "Những điều đối lập có thể được pha trộn thành một nhịp điệu bền vững.", shadow: "Thỏa hiệp mọi thứ sẽ làm mất đi điều thực sự quan trọng.", question: "Bạn cần điều chỉnh tỷ lệ nào để lấy lại sự cân bằng?", color: "#5fe3c8" },
    { id: "attachment", symbol: "◆", name: "Sợi Ràng Buộc", light: "Nhìn thẳng vào ham muốn và thói quen giúp bạn lấy lại quyền lựa chọn.", shadow: "Một vòng lặp quen thuộc có thể đang được gọi nhầm là điều không thể thay đổi.", question: "Bạn đang chọn điều này, hay chỉ đang lặp lại nó?", color: "#ff6e91" },
    { id: "breakthrough", symbol: "ϟ", name: "Khoảnh Khắc Phá Vỡ", light: "Một sự thật bất ngờ có thể giải phóng bạn khỏi nền móng không còn vững.", shadow: "Phản ứng tức thời có thể làm tình huống hỗn loạn hơn mức cần thiết.", question: "Điều gì cần được bảo vệ trước khi bạn xây lại?", color: "#ff846c" },
    { id: "north-star", symbol: "★", name: "Sao Dẫn Lối", light: "Hy vọng có cơ sở được nuôi bằng những hành động nhỏ và đều đặn.", shadow: "Chỉ hình dung kết quả đẹp mà không chăm sóc tiến trình sẽ tạo thất vọng.", question: "Hành động nhỏ nào chứng minh rằng bạn vẫn tin vào hướng đi này?", color: "#6ee7ff" },
    { id: "mist", symbol: "☽", name: "Miền Sương", light: "Cảm xúc và giấc mơ đang chỉ ra điều lý trí chưa gọi được thành tên.", shadow: "Khi thông tin chưa đủ, nỗi sợ dễ lấp chỗ trống bằng giả định.", question: "Điều gì là dữ kiện, điều gì mới chỉ là diễn giải?", color: "#a486ff" },
    { id: "sunrise", symbol: "☀", name: "Bình Minh", light: "Sự minh bạch, niềm vui và kết nối đang tiếp thêm sinh lực.", shadow: "Lạc quan ép buộc có thể che đi một nhu cầu cần được lắng nghe.", question: "Niềm vui nào đang giúp bạn sống thật hơn?", color: "#ffd25e" },
    { id: "awakening", symbol: "⌁", name: "Tiếng Gọi", light: "Bạn có thể nhìn lại quá khứ mà không cần tiếp tục bị nó định nghĩa.", shadow: "Chờ một sự chắc chắn tuyệt đối có thể làm lỡ cơ hội sửa hướng.", question: "Bài học nào cần được chuyển thành một lựa chọn mới?", color: "#ffa7d9" },
    { id: "wholeness", symbol: "◎", name: "Toàn Cảnh", light: "Một chu kỳ đang khép lại với sự trưởng thành và hiểu biết đầy đủ hơn.", shadow: "Cố hoàn hảo hóa bước cuối có thể ngăn bạn công nhận điều đã hoàn thành.", question: "Bạn muốn mang theo điều gì sang chu kỳ tiếp theo?", color: "#73efcf" }
  ]);

  const WESTERN_ZODIAC = Object.freeze([
    { id: "capricorn", name: "Ma Kết", symbol: "♑", start: [12, 22], end: [1, 19], element: "Đất", mode: "Tiên phong", note: "Tổ chức, bền bỉ và xây nền tảng." },
    { id: "aquarius", name: "Bảo Bình", symbol: "♒", start: [1, 20], end: [2, 18], element: "Khí", mode: "Kiên định", note: "Độc lập, hệ thống và góc nhìn mới." },
    { id: "pisces", name: "Song Ngư", symbol: "♓", start: [2, 19], end: [3, 20], element: "Nước", mode: "Linh hoạt", note: "Cảm nhận, tưởng tượng và kết nối." },
    { id: "aries", name: "Bạch Dương", symbol: "♈", start: [3, 21], end: [4, 19], element: "Lửa", mode: "Tiên phong", note: "Khởi động, trực diện và giàu động lực." },
    { id: "taurus", name: "Kim Ngưu", symbol: "♉", start: [4, 20], end: [5, 20], element: "Đất", mode: "Kiên định", note: "Ổn định, cảm nhận và giá trị thực tế." },
    { id: "gemini", name: "Song Tử", symbol: "♊", start: [5, 21], end: [6, 20], element: "Khí", mode: "Linh hoạt", note: "Tò mò, giao tiếp và kết nối ý tưởng." },
    { id: "cancer", name: "Cự Giải", symbol: "♋", start: [6, 21], end: [7, 22], element: "Nước", mode: "Tiên phong", note: "Chăm sóc, ký ức và cảm giác an toàn." },
    { id: "leo", name: "Sư Tử", symbol: "♌", start: [7, 23], end: [8, 22], element: "Lửa", mode: "Kiên định", note: "Biểu đạt, sáng tạo và lòng tự tin." },
    { id: "virgo", name: "Xử Nữ", symbol: "♍", start: [8, 23], end: [9, 22], element: "Đất", mode: "Linh hoạt", note: "Phân tích, cải thiện và chăm sóc chi tiết." },
    { id: "libra", name: "Thiên Bình", symbol: "♎", start: [9, 23], end: [10, 22], element: "Khí", mode: "Tiên phong", note: "Cân bằng, quan hệ và góc nhìn đa chiều." },
    { id: "scorpio", name: "Bọ Cạp", symbol: "♏", start: [10, 23], end: [11, 21], element: "Nước", mode: "Kiên định", note: "Chiều sâu, chuyển hóa và sự tập trung." },
    { id: "sagittarius", name: "Nhân Mã", symbol: "♐", start: [11, 22], end: [12, 21], element: "Lửa", mode: "Linh hoạt", note: "Khám phá, ý nghĩa và tầm nhìn rộng." }
  ]);

  const CHINESE_ZODIAC = Object.freeze([
    ["Tý", "Chuột", "nhanh trí, thích nghi"], ["Sửu", "Trâu", "bền bỉ, thực tế"], ["Dần", "Hổ", "can đảm, chủ động"], ["Mão", "Mèo", "tinh tế, quan sát"],
    ["Thìn", "Rồng", "tham vọng, giàu năng lượng"], ["Tỵ", "Rắn", "sâu sắc, thận trọng"], ["Ngọ", "Ngựa", "tự do, linh hoạt"], ["Mùi", "Dê", "đồng cảm, sáng tạo"],
    ["Thân", "Khỉ", "tò mò, ứng biến"], ["Dậu", "Gà", "rõ ràng, chăm chỉ"], ["Tuất", "Chó", "trung thành, bảo vệ"], ["Hợi", "Lợn", "hào phóng, chân thành"]
  ]);
  const ELEMENTS = Object.freeze(["Kim", "Kim", "Thủy", "Thủy", "Mộc", "Mộc", "Hỏa", "Hỏa", "Thổ", "Thổ"]);
  const TRIGRAMS = Object.freeze({
    "111": { name: "Càn", symbol: "☰", nature: "Trời", note: "chủ động và sáng tạo" },
    "110": { name: "Đoài", symbol: "☱", nature: "Đầm", note: "cởi mở và giao tiếp" },
    "101": { name: "Ly", symbol: "☲", nature: "Lửa", note: "rõ ràng và bám vào điều có ý nghĩa" },
    "100": { name: "Chấn", symbol: "☳", nature: "Sấm", note: "khởi động và đánh thức" },
    "011": { name: "Tốn", symbol: "☴", nature: "Gió", note: "thẩm thấu và điều chỉnh" },
    "010": { name: "Khảm", symbol: "☵", nature: "Nước", note: "đi qua bất định bằng sự tỉnh táo" },
    "001": { name: "Cấn", symbol: "☶", nature: "Núi", note: "dừng lại và giữ ranh giới" },
    "000": { name: "Khôn", symbol: "☷", nature: "Đất", note: "tiếp nhận và nuôi dưỡng" }
  });
  const DAILY_MESSAGES = Object.freeze([
    ["Thu gọn để tiến xa", "Chọn một việc có tác động rõ nhất, hoàn thành nó trước khi mở thêm hướng mới."],
    ["Lắng nghe phần chưa nói", "Một khoảng dừng ngắn có thể giúp bạn nhận ra nhu cầu thật phía sau phản ứng đầu tiên."],
    ["Xây bằng nhịp đều", "Tiến bộ nhỏ nhưng lặp lại sẽ đáng tin hơn một lần cố gắng quá sức."],
    ["Kiểm tra giả định", "Hỏi thêm một câu trước khi kết luận; dữ kiện mới có thể làm thay đổi toàn cảnh."],
    ["Giữ ranh giới mềm", "Bạn có thể tử tế mà vẫn nói rõ điều mình có và không thể đáp ứng."],
    ["Cho ý tưởng một hình dạng", "Viết, phác hoặc thử phiên bản nhỏ để biến điều mơ hồ thành thứ có thể xem xét."],
    ["Khép một vòng lặp", "Một việc dang dở nhỏ được hoàn tất hôm nay sẽ giải phóng nhiều sự chú ý hơn bạn nghĩ."],
    ["Chọn điều có ý nghĩa", "Đừng để sự khẩn cấp của người khác tự động trở thành ưu tiên cao nhất của bạn."],
    ["Đổi góc nhìn", "Hãy thử mô tả tình huống như thể bạn đang tư vấn cho một người bạn đáng quý."],
    ["Phục hồi cũng là tiến độ", "Nghỉ ngơi có chủ đích giúp quyết định sau đó sáng hơn và ít tốn sức hơn."],
    ["Nói điều cần nói", "Một câu rõ ràng, bình tĩnh và đúng lúc có thể thay cho nhiều ngày đoán ý."],
    ["Để lại khoảng trống", "Không cần lấp đầy mọi phút; khoảng trống là nơi ý tưởng mới có chỗ xuất hiện."]
  ]);

  let activeRuntime = null;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]);
  }
  function markdownMarkupSafe(value) {
    return String(value || "").split(/\r?\n/).map((line) => {
      const safe = escapeHtml(line).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      if (/^###\s/.test(line)) return `<h4>${safe.replace(/^###\s/, "")}</h4>`;
      if (/^##\s/.test(line)) return `<h3>${safe.replace(/^##\s/, "")}</h3>`;
      if (/^[-*]\s/.test(line)) return `<li>${safe.replace(/^[-*]\s/, "")}</li>`;
      return line.trim() ? `<p>${safe}</p>` : "";
    }).join("").replace(/(?:<li>[\s\S]*?<\/li>)+/g, (list) => `<ul>${list}</ul>`);
  }

  function clamp(value, min, max, fallback = min) {
    const number = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(number) ? number : fallback));
  }

  function hashSeed(value) {
    let hash = 2166136261;
    const text = String(value == null ? "" : value);
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createRandom(seed) {
    let value = Number(seed) >>> 0;
    return function random() {
      value += 0x6D2B79F5;
      let output = value;
      output = Math.imul(output ^ (output >>> 15), output | 1);
      output ^= output + Math.imul(output ^ (output >>> 7), output | 61);
      return ((output ^ (output >>> 14)) >>> 0) / 4294967296;
    };
  }

  function localDateKey(date = new Date()) {
    const value = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function seededShuffle(items, random) {
    const output = [...items];
    for (let index = output.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [output[index], output[swap]] = [output[swap], output[index]];
    }
    return output;
  }

  function dailyReading(seedInput, date = new Date()) {
    const dateKey = localDateKey(date);
    const random = createRandom(hashSeed(`${seedInput || "local"}|${dateKey}|daily-v1`));
    const message = DAILY_MESSAGES[Math.floor(random() * DAILY_MESSAGES.length)];
    const energy = 55 + Math.floor(random() * 41);
    const focus = ["Sáng tạo", "Kết nối", "Sắp xếp", "Phục hồi", "Hoàn thành", "Học hỏi"][Math.floor(random() * 6)];
    return { dateKey, title: message[0], message: message[1], energy, focus };
  }

  function drawTarot(seedInput, count = 3) {
    const safeCount = [1, 3, 5, 7, 10].includes(Number(count)) ? Number(count) : 3;
    const seed = String(seedInput || `${Date.now()}-${Math.random()}`);
    const random = createRandom(hashSeed(`${seed}|tarot-v1`));
    const positionSets = {
      1: ["Điều cần soi chiếu"],
      3: ["Bối cảnh", "Điểm cần chú ý", "Bước có thể thử"],
      5: ["Nền tảng", "Điều đang hỗ trợ", "Điểm cản trở", "Góc nhìn khác", "Bước thử an toàn"],
      7: ["Gốc rễ", "Hiện tại", "Điều chưa thấy", "Nguồn lực", "Ranh giới", "Thử nghiệm", "Điều cần quan sát lại"],
      10: ["Trọng tâm", "Tác động gần", "Nền sâu", "Kinh nghiệm trước", "Điều đang hướng tới", "Bước kế tiếp", "Cách tự nhìn", "Môi trường", "Hy vọng hoặc lo ngại", "Góc tổng hợp"]
    };
    const labels = positionSets[safeCount];
    return seededShuffle(TAROT, random).slice(0, safeCount).map((card, index) => {
      const reversed = random() < 0.36;
      return { ...card, position: labels[index], reversed, interpretation: reversed ? card.shadow : card.light };
    });
  }

  function getWesternZodiac(month, day) {
    const safeMonth = Number(month);
    const safeDay = Number(day);
    const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (!Number.isInteger(safeMonth) || !Number.isInteger(safeDay) || safeMonth < 1 || safeMonth > 12 || safeDay < 1 || safeDay > daysInMonth[safeMonth - 1]) return null;
    const value = safeMonth * 100 + safeDay;
    return WESTERN_ZODIAC.find((sign) => {
      const [startMonth, startDay] = sign.start;
      const [endMonth, endDay] = sign.end;
      const start = startMonth * 100 + startDay;
      const end = endMonth * 100 + endDay;
      return start > end ? value >= start || value <= end : value >= start && value <= end;
    }) || null;
  }

  function getChineseZodiac(year, beforeLunarNewYear = false) {
    const inputYear = Math.trunc(Number(year));
    if (!Number.isFinite(inputYear) || inputYear < 1900 || inputYear > 2100) return null;
    const cycleYear = beforeLunarNewYear ? inputYear - 1 : inputYear;
    const animal = CHINESE_ZODIAC[((cycleYear - 4) % 12 + 12) % 12];
    const stemIndex = ((cycleYear - 4) % 10 + 10) % 10;
    return { year: inputYear, cycleYear, branch: animal[0], animal: animal[1], note: animal[2], element: ELEMENTS[stemIndex], yinYang: stemIndex % 2 === 0 ? "Dương" : "Âm" };
  }

  function reduceNumerology(number, keepMaster = true) {
    let value = Math.abs(Math.trunc(Number(number) || 0));
    while (value > 9 && !(keepMaster && [11, 22, 33].includes(value))) {
      value = String(value).split("").reduce((sum, digit) => sum + Number(digit), 0);
    }
    return value;
  }

  function calculateNumerology(dateValue) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || ""));
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const probe = new Date(Date.UTC(year, month - 1, day));
    if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
    const digits = `${match[1]}${match[2]}${match[3]}`.split("").map(Number);
    const total = digits.reduce((sum, digit) => sum + digit, 0);
    const lifePath = reduceNumerology(total);
    const birthDay = reduceNumerology(day);
    const attitudeSource = month + day;
    const attitude = reduceNumerology(attitudeSource);
    const chart = Object.fromEntries(Array.from({ length: 9 }, (_, index) => [index + 1, digits.filter((digit) => digit === index + 1).length]));
    const patterns = [[1,2,3,"lập kế hoạch"],[4,5,6,"tổ chức"],[7,8,9,"hành động"],[1,4,7,"thực tế"],[2,5,8,"cân bằng"],[3,6,9,"tư duy"],[1,5,9,"kiên định"],[3,5,7,"cảm nhận"]];
    const arrows = patterns.map(([a,b,c,label]) => ({ numbers: [a,b,c], label, state: chart[a] && chart[b] && chart[c] ? "full" : !chart[a] && !chart[b] && !chart[c] ? "empty" : "partial" })).filter((item) => item.state !== "partial");
    return { date: String(dateValue), digits, total, lifePath, birthDay, attitude, chart, arrows, meaning: NUMBER_MEANINGS[lifePath] || "tự quan sát và phát triển", formula: `${digits.join(" + ")} = ${total} → ${lifePath}`, attitudeFormula: `${month} + ${day} = ${attitudeSource} → ${attitude}` };
  }

  function calculatePersonalCycles(dateValue, targetDateValue = localDateKey()) {
    const birth = calculateNumerology(dateValue);
    const targetMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(targetDateValue || ""));
    if (!birth || !targetMatch) return null;
    const targetYear = Number(targetMatch[1]);
    const targetMonth = Number(targetMatch[2]);
    const targetDay = Number(targetMatch[3]);
    const targetProbe = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay));
    if (targetProbe.getUTCFullYear() !== targetYear || targetProbe.getUTCMonth() !== targetMonth - 1 || targetProbe.getUTCDate() !== targetDay) return null;
    const birthParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue));
    const birthMonth = Number(birthParts[2]);
    const birthDay = Number(birthParts[3]);
    const universalYearSource = String(targetYear).split("").reduce((sum, digit) => sum + Number(digit), 0);
    const universalYear = reduceNumerology(universalYearSource, false);
    const personalYearSource = reduceNumerology(birthMonth, false) + reduceNumerology(birthDay, false) + universalYear;
    const personalYear = reduceNumerology(personalYearSource);
    const personalMonthSource = personalYear + targetMonth;
    const personalMonth = reduceNumerology(personalMonthSource);
    const personalDaySource = personalMonth + targetDay;
    const personalDay = reduceNumerology(personalDaySource);
    return {
      targetDate: String(targetDateValue), personalYear, personalMonth, personalDay,
      meanings: {
        year: NUMBER_MEANINGS[personalYear] || "quan sát chu kỳ dài hạn",
        month: NUMBER_MEANINGS[personalMonth] || "quan sát nhịp tháng",
        day: NUMBER_MEANINGS[personalDay] || "quan sát trọng tâm trong ngày"
      },
      formula: `Năm cá nhân: ${birthMonth} + ${birthDay} + ${universalYear} = ${personalYearSource} → ${personalYear}; tháng: ${personalYear} + ${targetMonth} = ${personalMonthSource} → ${personalMonth}; ngày: ${personalMonth} + ${targetDay} = ${personalDaySource} → ${personalDay}`
    };
  }

  function normalizeNameLetters(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/Đ/g, "D").replace(/đ/g, "d").toUpperCase().replace(/[^A-Z]/g, "");
  }

  function calculateNameNumerology(nameValue, system = "pythagorean") {
    const letters = normalizeNameLetters(nameValue);
    if (letters.length < 2 || letters.length > 120) return null;
    const vowels = new Set(["A", "E", "I", "O", "U", "Y"]);
    const chaldean = { A:1,I:1,J:1,Q:1,Y:1,B:2,K:2,R:2,C:3,G:3,L:3,S:3,D:4,M:4,T:4,E:5,H:5,N:5,X:5,U:6,V:6,W:6,O:7,Z:7,F:8,P:8 };
    const selectedSystem = system === "chaldean" ? "chaldean" : "pythagorean";
    const valueOf = selectedSystem === "chaldean" ? (letter) => chaldean[letter] || 0 : (letter) => ((letter.charCodeAt(0) - 65) % 9) + 1;
    const values = [...letters].map(valueOf);
    const soulValues = [...letters].filter((letter) => vowels.has(letter)).map(valueOf);
    const personalityValues = [...letters].filter((letter) => !vowels.has(letter)).map(valueOf);
    const sum = (items) => items.reduce((total, value) => total + value, 0);
    const expressionTotal = sum(values);
    const soulTotal = sum(soulValues);
    const personalityTotal = sum(personalityValues);
    return {
      letters, system: selectedSystem,
      expression: reduceNumerology(expressionTotal),
      soul: reduceNumerology(soulTotal),
      personality: reduceNumerology(personalityTotal),
      formulas: {
        expression: `${values.join(" + ")} = ${expressionTotal} → ${reduceNumerology(expressionTotal)}`,
        soul: `${soulValues.join(" + ") || "0"} = ${soulTotal} → ${reduceNumerology(soulTotal)}`,
        personality: `${personalityValues.join(" + ") || "0"} = ${personalityTotal} → ${reduceNumerology(personalityTotal)}`
      }
    };
  }

  function parseLocalDate(dateValue) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue || ""));
    if (!match) return null;
    const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
    const value = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === day ? value : null;
  }

  function calculateMoonPhase(dateValue = localDateKey()) {
    const date = dateValue instanceof Date ? dateValue : parseLocalDate(dateValue);
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    const elapsedDays = (date.getTime() - REFERENCE_NEW_MOON_UTC) / 86400000;
    const phase = ((elapsedDays / SYNODIC_MONTH_DAYS) % 1 + 1) % 1;
    const ageDays = phase * SYNODIC_MONTH_DAYS;
    const illumination = (1 - Math.cos(phase * Math.PI * 2)) / 2;
    const index = Math.floor((phase * 8) + 0.5) % 8;
    const phases = [
      ["Trăng non", "●", "khởi đầu và đặt ý định"], ["Lưỡi liềm đầu tháng", "◔", "nuôi một bước nhỏ"], ["Thượng huyền", "◑", "hành động và điều chỉnh"], ["Khuyết đầu tháng", "◕", "hoàn thiện điều đang lớn dần"],
      ["Trăng tròn", "○", "nhìn lại điều đã rõ"], ["Khuyết cuối tháng", "◕", "chia sẻ và chọn điều giữ lại"], ["Hạ huyền", "◐", "buông phần không còn phù hợp"], ["Lưỡi liềm cuối tháng", "◔", "nghỉ và chuẩn bị chu kỳ mới"]
    ];
    return {
      date: localDateKey(date), phase: Number(phase.toFixed(6)), ageDays: Number(ageDays.toFixed(2)),
      illumination: Number((illumination * 100).toFixed(1)), waxing: phase < 0.5,
      name: phases[index][0], symbol: phases[index][1], reflection: phases[index][2],
      method: "Xấp xỉ theo chu kỳ giao hội trung bình 29,530588853 ngày từ mốc trăng non 2000-01-06 18:14 UTC; không thay thế lịch thiên văn chính xác theo vị trí."
    };
  }

  function compareSymbolicProfiles(dateA, dateB, options = {}) {
    const first = calculateNumerology(dateA); const second = calculateNumerology(dateB);
    const firstDate = parseLocalDate(dateA); const secondDate = parseLocalDate(dateB);
    if (!first || !second || !firstDate || !secondDate) return null;
    const westernA = getWesternZodiac(firstDate.getUTCMonth() + 1, firstDate.getUTCDate());
    const westernB = getWesternZodiac(secondDate.getUTCMonth() + 1, secondDate.getUTCDate());
    const chineseA = getChineseZodiac(firstDate.getUTCFullYear(), Boolean(options.beforeTetA));
    const chineseB = getChineseZodiac(secondDate.getUTCFullYear(), Boolean(options.beforeTetB));
    const sameElement = westernA.element === westernB.element;
    const complementary = new Set(["Lửa|Khí", "Khí|Lửa", "Đất|Nước", "Nước|Đất"]).has(`${westernA.element}|${westernB.element}`);
    const sharedFocus = sameElement ? `Cả hai cùng thiên về nguyên tố ${westernA.element}; hãy kiểm tra xem điểm tương đồng đang hỗ trợ hay tạo điểm mù.` : complementary ? `Hai nguyên tố ${westernA.element} và ${westernB.element} thường được ghép theo hướng bổ trợ trong hệ biểu tượng.` : `Hai nguyên tố ${westernA.element} và ${westernB.element} gợi ý nhịp tiếp cận khác nhau cần được nói rõ.`;
    const cycleRelation = first.lifePath === second.lifePath ? "Hai con số đường đời trùng nhau; trải nghiệm thật vẫn có thể rất khác." : `Đường đời ${first.lifePath} và ${second.lifePath} đặt cạnh nhau để so sánh cách ưu tiên, không phải để chấm điểm.`;
    const context = ["relationship", "team", "friendship"].includes(options.context) ? options.context : "relationship";
    const prompts = context === "team"
      ? ["Ai cần sự rõ ràng về vai trò?", "Cách phản hồi nào giúp cả hai làm việc tốt hơn?", "Điểm khác biệt nào có thể trở thành lợi thế của nhóm?"]
      : context === "friendship"
        ? ["Hai người thấy an toàn khi chia sẻ điều gì?", "Ranh giới nào giúp tình bạn bền hơn?", "Hoạt động chung nào tạo năng lượng tích cực?"]
        : ["Mỗi người cần được lắng nghe theo cách nào?", "Điều gì nên được nói thẳng thay vì đoán ý?", "Ranh giới và kỳ vọng nào cần thống nhất?"];
    return { first: { western: westernA, chinese: chineseA, lifePath: first.lifePath }, second: { western: westernB, chinese: chineseB, lifePath: second.lifePath }, context, sharedFocus, cycleRelation, prompts };
  }

  function castIChing(seedInput) {
    const seed = String(seedInput || `${Date.now()}-${Math.random()}`);
    const random = createRandom(hashSeed(`${seed}|iching-v1`));
    const lines = Array.from({ length: 6 }, () => {
      const coins = [random() < 0.5 ? 2 : 3, random() < 0.5 ? 2 : 3, random() < 0.5 ? 2 : 3];
      const value = coins.reduce((sum, coin) => sum + coin, 0);
      return { value, yang: value === 7 || value === 9, changing: value === 6 || value === 9 };
    });
    const bits = lines.map((line) => line.yang ? "1" : "0").join("");
    const lower = TRIGRAMS[bits.slice(0, 3)];
    const upper = TRIGRAMS[bits.slice(3, 6)];
    const changedBits = lines.map((line) => line.changing ? (line.yang ? "0" : "1") : (line.yang ? "1" : "0")).join("");
    const changedLower = TRIGRAMS[changedBits.slice(0, 3)];
    const changedUpper = TRIGRAMS[changedBits.slice(3, 6)];
    const changing = lines.map((line, index) => line.changing ? index + 1 : 0).filter(Boolean);
    const engine = globalScope.HHFortuneIChing64;
    const primaryHexagram = engine?.hexagramForBits?.(bits) || null;
    const changedHexagram = engine?.hexagramForBits?.(changedBits) || null;
    const nuclearHexagram = engine?.hexagramForBits?.(engine?.nuclearBits?.(bits)) || null;
    const enrichedLines = lines.map((line, index) => ({ ...line, number: index + 1, reflection: engine?.lineReflection?.(index + 1, line.yang, line.changing) || "" }));
    return {
      lines: enrichedLines, lower, upper, changing, changedLower, changedUpper, bits, changedBits, primaryHexagram, changedHexagram, nuclearHexagram,
      title: primaryHexagram ? `${primaryHexagram.title} · ${primaryHexagram.structure}` : `${upper.symbol} ${upper.name} trên ${lower.symbol} ${lower.name}`,
      changedTitle: changing.length ? (changedHexagram ? `${changedHexagram.title} · ${changedHexagram.structure}` : `${changedUpper.symbol} ${changedUpper.name} trên ${changedLower.symbol} ${changedLower.name}`) : "Không có quẻ biến",
      nuclearTitle: nuclearHexagram ? `${nuclearHexagram.title} · ${nuclearHexagram.structure}` : "Chưa có dữ liệu quẻ hỗ",
      reflection: primaryHexagram?.theme || `Hình tượng ${upper.nature} ở trên ${lower.nature} gợi ý kết hợp ${upper.note} với ${lower.note}.`,
      question: changing.length ? `Các hào động ${changing.join(", ")} nhắc bạn xem phần nào đang chuyển trạng thái.` : "Không có hào động; hãy quan sát điều đang cần sự ổn định trước khi thay đổi."
    };
  }

  function encodeOwnerToken(value) {
    const normalized = String(value || "local").normalize("NFKC").trim().toLocaleLowerCase("en-US") || "local";
    return encodeURIComponent(normalized);
  }

  function resolveOwnerId(options = {}) {
    const profile = options.currentUser && typeof options.currentUser === "object" ? options.currentUser : null;
    return encodeOwnerToken(options.ownerId || profile?.ownerId || profile?.id || profile?.sub || profile?.email || "local");
  }

  function storageKey(ownerId) { return `${STORAGE_SCHEMA}:${ownerId || "local"}`; }

  function sanitizeProfile(input, remembered = false) {
    const profile = input && typeof input === "object" ? input : {};
    const v4 = suiteV4(); const timezoneId = v4?.timeZoneSupported?.(profile.timezoneId) ? String(profile.timezoneId) : (PROFILE_CITIES[profile.city]?.timezoneId || "Asia/Ho_Chi_Minh");
    return {
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(profile.date || "")) ? String(profile.date) : "",
      time: /^\d{2}:\d{2}$/.test(String(profile.time || "")) ? String(profile.time) : "",
      place: String(profile.place || "").trim().slice(0, 120), city: PROFILE_CITIES[profile.city] ? profile.city : "custom",
      timezone: clamp(profile.timezone, -12, 14, PROFILE_CITIES[profile.city]?.timezone || 7), timezoneId,
      latitude: clamp(profile.latitude, -90, 90, 0), longitude: clamp(profile.longitude, -180, 180, 0), elevation: clamp(profile.elevation, -500, 9000, PROFILE_CITIES[profile.city]?.elevation || 0),
      birthTimeAccuracy: ["exact", "estimated", "unknown"].includes(profile.birthTimeAccuracy) ? profile.birthTimeAccuracy : (profile.time ? "estimated" : "unknown"),
      birthTimeSource: ["birth-certificate", "family-memory", "self-estimated", "unknown"].includes(profile.birthTimeSource) ? profile.birthTimeSource : "unknown",
      birthTimeUncertaintyMinutes: [1, 15, 60, 720].includes(Number(profile.birthTimeUncertaintyMinutes)) ? Number(profile.birthTimeUncertaintyMinutes) : (profile.birthTimeAccuracy === "exact" ? 1 : profile.birthTimeAccuracy === "unknown" ? 720 : 15),
      locationConfidence: ["verified", "selected", "approximate"].includes(profile.locationConfidence) ? profile.locationConfidence : "selected",
      calendarSystem: ["gregorian", "julian"].includes(profile.calendarSystem) ? profile.calendarSystem : "gregorian",
      dstResolution: ["earlier", "later"].includes(profile.dstResolution) ? profile.dstResolution : "",
      zodiacMode: profile.zodiacMode === "sidereal" ? "sidereal" : "tropical", houseSystem: ["whole-sign", "porphyry"].includes(profile.houseSystem) ? profile.houseSystem : "equal",
      aspectOrbs: Object.fromEntries(Object.entries(DEFAULT_ORBS).map(([key, fallback]) => [key, clamp(profile.aspectOrbs?.[key], 0, 15, fallback)])),
      beforeTet: Boolean(profile.beforeTet), remembered: Boolean(remembered || profile.remembered)
    };
  }

  function normalizeState(input) {
    const raw = input && typeof input === "object" ? input : {};
    const history = (Array.isArray(raw.history) ? raw.history : []).filter((item) => item && item.id && item.type).slice(0, MAX_HISTORY).map((item) => ({
      id: String(item.id), type: String(item.type), title: String(item.title || "Kết quả"), summary: String(item.summary || "").slice(0, 600), createdAt: String(item.createdAt || "")
    }));
    const journal = (Array.isArray(raw.journal) ? raw.journal : []).filter((item) => item && item.id && item.text).slice(0, MAX_JOURNAL).map((item) => ({
      id: String(item.id), text: String(item.text).slice(0, 4000), tag: String(item.tag || "Suy ngẫm").slice(0, 40), createdAt: String(item.createdAt || ""), moodBefore: clamp(item.moodBefore, 1, 5, 3), moodAfter: clamp(item.moodAfter, 1, 5, 3), sessionType: String(item.sessionType || "manual").slice(0, 40)
    }));
    const profile = raw.profile?.remembered ? sanitizeProfile(raw.profile, true) : null;
    const requestedTheme = LEGACY_THEME_MAP[raw.settings?.theme] || raw.settings?.theme;
    const settings = {
      theme: THEMES.includes(requestedTheme) ? requestedTheme : "cosmic-oracle",
      sound: Boolean(raw.settings?.sound), experience: raw.settings?.experience === "advanced" ? "advanced" : "beginner",
      journalReminder: Boolean(raw.settings?.journalReminder), motion: MOTION_LEVELS.includes(raw.settings?.motion) ? raw.settings.motion : "balanced",
      particleDensity: clamp(raw.settings?.particleDensity, 0, 100, 62), glow: clamp(raw.settings?.glow, 0, 100, 72), glass: clamp(raw.settings?.glass, 20, 100, 72)
    };
    const vault = raw.journalVault && typeof raw.journalVault === "object" && raw.journalVault.ciphertext ? { version: 1, salt: String(raw.journalVault.salt || ""), iv: String(raw.journalVault.iv || ""), ciphertext: String(raw.journalVault.ciphertext || "") } : null;
    return { version: VERSION, view: VIEWS.has(raw.view) ? raw.view : "today", history, journal: vault ? [] : journal, journalVault: vault, profile, settings, favorites: [...new Set((Array.isArray(raw.favorites) ? raw.favorites : []).map(String))].slice(0, 80) };
  }

  function readState(storage, ownerId) {
    try { return normalizeState(JSON.parse(storage?.getItem(storageKey(ownerId)) || "null")); }
    catch (_error) { return normalizeState(null); }
  }

  function writeState(runtime) {
    try { runtime.storage?.setItem(storageKey(runtime.ownerId), JSON.stringify(runtime.state)); }
    catch (_error) { runtime.storageError = true; }
  }

  function bytesToBase64(bytes) {
    let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
    return globalScope.btoa(binary);
  }
  function base64ToBytes(value) {
    const binary = globalScope.atob(String(value || ""));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }
  async function deriveJournalKey(pin, salt) {
    if (!globalScope.crypto?.subtle || String(pin || "").length < 4) throw new Error("PIN phải có ít nhất 4 ký tự và cần trình duyệt hỗ trợ Web Crypto.");
    const material = await globalScope.crypto.subtle.importKey("raw", new TextEncoder().encode(String(pin)), "PBKDF2", false, ["deriveKey"]);
    return globalScope.crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 180000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function createJournalVault(entries, pin, existingSalt) {
    const salt = existingSalt || globalScope.crypto.getRandomValues(new Uint8Array(16));
    const iv = globalScope.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveJournalKey(pin, salt);
    const plaintext = new TextEncoder().encode(JSON.stringify(entries));
    const ciphertext = new Uint8Array(await globalScope.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
    return { key, vault: { version: 1, salt: bytesToBase64(salt), iv: bytesToBase64(iv), ciphertext: bytesToBase64(ciphertext) } };
  }
  async function openJournalVault(vault, pin) {
    const salt = base64ToBytes(vault.salt); const iv = base64ToBytes(vault.iv); const ciphertext = base64ToBytes(vault.ciphertext);
    const key = await deriveJournalKey(pin, salt);
    const plaintext = await globalScope.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    const entries = JSON.parse(new TextDecoder().decode(plaintext));
    return { key, entries: Array.isArray(entries) ? entries.slice(0, MAX_JOURNAL) : [] };
  }
  function activeJournal(runtime) { return runtime.state.journalVault ? runtime.journalEntries : runtime.state.journal; }
  async function persistJournal(runtime) {
    if (!runtime.state.journalVault) { runtime.state.journal = runtime.journalEntries.slice(0, MAX_JOURNAL); writeState(runtime); return; }
    if (!runtime.journalKey) throw new Error("Nhật ký đang khóa.");
    const iv = globalScope.crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(runtime.journalEntries.slice(0, MAX_JOURNAL)));
    const ciphertext = new Uint8Array(await globalScope.crypto.subtle.encrypt({ name: "AES-GCM", iv }, runtime.journalKey, plaintext));
    runtime.state.journalVault = { ...runtime.state.journalVault, iv: bytesToBase64(iv), ciphertext: bytesToBase64(ciphertext) };
    writeState(runtime);
  }

  function addHistory(runtime, type, title, summary) {
    const item = { id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, title, summary: String(summary || "").slice(0, 600), createdAt: new Date().toISOString() };
    runtime.state.history = [item, ...runtime.state.history].slice(0, MAX_HISTORY);
    writeState(runtime);
    return item;
  }

  function formatDateTime(value) {
    if (!value) return "Không có trong cửa sổ";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Không rõ thời gian";
    return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function addDays(date, amount) { const copy = new Date(date); copy.setDate(copy.getDate() + Number(amount || 0)); return copy; }
  function calendarStart(anchor, mode) {
    const value = parseLocalDate(anchor) || new Date();
    const local = new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 12);
    if (mode === "week") { const offset = (local.getDay() + 6) % 7; return addDays(local, -offset); }
    if (mode === "timeline") return local;
    const first = new Date(local.getFullYear(), local.getMonth(), 1, 12); const offset = (first.getDay() + 6) % 7; return addDays(first, -offset);
  }
  function buildReflectionCalendar(birthDate, anchorDate = localDateKey(), mode = "month", history = [], journal = [], timeZone = "Asia/Ho_Chi_Minh") {
    const safeMode = ["week", "month", "timeline"].includes(mode) ? mode : "month";
    const start = calendarStart(anchorDate, safeMode);
    const count = safeMode === "week" ? 7 : safeMode === "timeline" ? 14 : 42;
    return Array.from({ length: count }, (_, index) => {
      const date = addDays(start, index); const key = localDateKey(date); const moon = calculateMoonPhase(key); const cycles = birthDate ? calculatePersonalCycles(birthDate, key) : null;
      const saved = history.filter((item) => localDateKey(new Date(item.createdAt)) === key).length;
      const notes = journal.filter((item) => localDateKey(new Date(item.createdAt)) === key).length;
      const lunarLabel = suiteV4()?.lunarCalendarDate?.(key, timeZone) || null;
      return { date: key, day: date.getDate(), month: date.getMonth() + 1, currentMonth: safeMode !== "month" || date.getMonth() === (parseLocalDate(anchorDate) || new Date()).getUTCMonth(), today: key === localDateKey(), moon, cycles, saved, notes, lunarLabel };
    });
  }

  function observatoryToolMeta(id) {
    for (const group of OBSERVATORY_GROUPS) {
      const item = group.items.find((candidate) => candidate[0] === id);
      if (item) return { id: item[0], icon: item[1], label: item[2], group: group.label, ...(TOOL_LIBRARY_DETAILS[id] || { tone: (VIEW_VISUALS[id] || VIEW_VISUALS.today)[2], family: group.id, badge: "Công cụ", beginner: "Mở không gian chiêm nghiệm.", advanced: "Xem phương pháp và provenance chi tiết." }) };
    }
    const visual = VIEW_VISUALS[id] || VIEW_VISUALS.today;
    return { id, icon: visual[0], label: visual[1], group: "Công cụ", ...(TOOL_LIBRARY_DETAILS[id] || { tone: visual[2], family: "reflection", badge: "Công cụ", beginner: "Mở không gian chiêm nghiệm.", advanced: "Xem phương pháp và provenance chi tiết." }) };
  }
  function navToolMarkup(runtime, item, compact = false, order = 0) {
    const [id, icon, label] = item; const active = runtime.state.view === id;
    return `<div class="fortune-nav__row" data-fortune-tool-row data-tool-search="${escapeHtml(`${label} ${id}`.toLocaleLowerCase("vi"))}" style="--tool-order:${order}"><button type="button" class="fortune-nav__item${active ? " is-active" : ""}${compact ? " is-compact" : ""}" data-fortune-view="${id}" aria-current="${active ? "page" : "false"}" aria-label="Mở ${escapeHtml(label)}" title="${escapeHtml(label)}"><i aria-hidden="true">${icon}</i><span>${escapeHtml(label)}</span>${active ? "<b aria-hidden=\"true\">●</b>" : ""}</button></div>`;
  }
  function navMarkup(runtime) {
    return `<div class="fortune-nav__groups fortune-atlas" data-fortune-tool-atlas>${OBSERVATORY_ATLAS_GROUPS.map((group, index) => { const active = group.items.some(([id]) => runtime.state.view === id); return `<details class="fortune-atlas__group" data-fortune-nav-group="${group.id}" data-fortune-active-group="${active}" style="--atlas-index:${index}"${active ? " open" : ""}><summary data-fortune-group-summary aria-label="Mở nhóm ${escapeHtml(group.label)}"><i>${group.icon}</i><span>${escapeHtml(group.label)}</span><b>${group.items.length}</b></summary><div>${group.items.map((item, itemIndex) => navToolMarkup(runtime, item, true, itemIndex)).join("")}</div></details>`; }).join("")}</div><p class="fortune-nav__empty" data-fortune-nav-empty hidden>Không tìm thấy công cụ phù hợp.</p>`;
  }

  function toolbarMarkup(title, subtitle) {
    return `<header class="fortune-view-head"><div><span>HH MYSTIC WORKSPACE</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div></header>`;
  }
  function currentResultContract(runtime, viewOverride = "") {
    const view = viewOverride || runtime.state.view;
    if (view === "tarot") return runtime.session.tarot78?.resultContract || null;
    if (view === "academy") return runtime.session.tarotQuiz?.resultContract || null;
    if (view === "zodiac") return runtime.session.lastZodiacResult === "chinese" ? (runtime.session.chinese?.resultContract || runtime.session.western?.resultContract || null) : (runtime.session.western?.resultContract || runtime.session.chinese?.resultContract || null);
    if (view === "numerology") return runtime.session.numerologyV4?.resultContract || null;
    if (view === "iching") return runtime.session.ichingAdvanced?.resultContract || null;
    if (view === "moon") return runtime.session.moonAstronomy?.resultContract || null;
    if (view === "sky") return runtime.session.sky?.resultContract || null;
    if (view === "chart") return runtime.session.astrologyV4?.resultContract || null;
    if (view === "eastern") return runtime.session.eastern?.resultContract || null;
    if (view === "symbols") return runtime.session.symbolDeck?.resultContract || null;
    return null;
  }
  function resultContractMarkup(contract) {
    if (!contract) return "";
    const status = contract.qualityStatus || {}; const statuses = [["Đầu vào", status.input], ["Múi giờ", status.timezone], ["Phép tính", status.calculation], ["Diễn giải", status.interpretation]];
    const facts = (contract.calculatedFacts || []).slice(0, 12); const interpretations = (contract.symbolicInterpretations || []).slice(0, 8); const ai = (contract.aiGeneratedSections || []).slice(0, 6);
    return `<section class="fortune-result-contract" data-fortune-result-contract><header><div><span>FORTUNE RESULT CONTRACT</span><h3>Cuộn Chứng Thư · ba lớp dữ liệu</h3></div><div class="fortune-contract-seal" title="Ấn chứng SHA-256"><i>✦</i><span>SHA-256</span></div><b>${escapeHtml(contract.methodId)} · v${escapeHtml(contract.methodVersion)}</b></header><div class="fortune-contract-status">${statuses.map(([label,item]) => `<div data-status="${escapeHtml(item?.id || "not-required")}"><span>${label}</span><strong>${escapeHtml(item?.label || "Không yêu cầu")}</strong></div>`).join("")}</div><div class="fortune-contract-layers"><article data-layer="calculation"><header><b>TÍNH TOÁN</b><span>${facts.length} fact</span></header>${facts.length ? `<dl>${facts.map((fact) => `<div><dt>${escapeHtml(fact.label)}</dt><dd>${escapeHtml(fact.value == null ? "—" : String(fact.value))}${fact.unit ? ` <small>${escapeHtml(fact.unit)}</small>` : ""}</dd></div>`).join("")}</dl>` : "<p>Phương pháp này không yêu cầu dữ kiện thiên văn.</p>"}</article><article data-layer="method"><header><b>TRƯỜNG PHÁI</b><span>${escapeHtml(contract.interpretationPack)}</span></header><dl><div><dt>Engine</dt><dd>${escapeHtml(contract.calculationEngine)} · ${escapeHtml(contract.engineVersion)}</dd></div><div><dt>Khung tham chiếu</dt><dd>${escapeHtml(contract.referenceFrame)}</dd></div><div><dt>Thời gian / lịch</dt><dd>${escapeHtml(contract.timeScale)} · ${escapeHtml(contract.calendarSystem)}</dd></div><div><dt>Ngẫu nhiên</dt><dd>${escapeHtml(contract.randomMethod)}</dd></div></dl>${interpretations.map((item) => `<p><strong>${escapeHtml(item.label)}</strong>${escapeHtml(item.text)}</p>`).join("")}</article><article data-layer="interpretation"><header><b>DIỄN GIẢI</b><span>${ai.length ? "Có AI, đã gắn nhãn" : "Không có AI"}</span></header>${ai.length ? ai.map((item) => `<p>${escapeHtml(typeof item === "string" ? item : item.text || item.label || "Nội dung AI")}</p>`).join("") : "<p>Không có nội dung AI trong kết quả này. Diễn giải biểu tượng không phải sự thật khách quan.</p>"}<ul>${(contract.limitations || []).slice(0, 8).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></article></div><details><summary>Nguồn, digest và chứng thư</summary><dl class="fortune-v4-contract"><div><dt>Result ID</dt><dd><code>${escapeHtml(contract.resultId)}</code></dd></div><div><dt>Input digest</dt><dd><code>${escapeHtml(contract.inputDigest)}</code></dd></div><div><dt>Result digest</dt><dd><code>${escapeHtml(contract.resultDigest)}</code></dd></div><div><dt>SHA-256</dt><dd><code>${escapeHtml(contract.sha256)}</code></dd></div><div><dt>Timezone / tzdb</dt><dd>${escapeHtml(contract.timezoneId || "Không yêu cầu")} · ${escapeHtml(contract.tzdbVersion)}</dd></div></dl><div class="fortune-contract-sources">${(contract.sourceReferences || []).map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer"><b>${escapeHtml(source.title)}</b><span>${escapeHtml(source.role)}</span></a>`).join("")}</div></details><footer><button type="button" data-fortune-contract-verify>✦ Xác minh ấn chứng</button><button type="button" data-fortune-contract-download>↓ Mở phong ấn JSON</button></footer></section>`;
  }
  function explanationMarkup(runtime, title, layers) {
    const advanced = runtime.state.settings.experience === "advanced";
    const visible = advanced ? layers : layers.slice(0, 4);
    const groups = { method: [], result: [], provenance: [] }; visible.forEach((layer, index) => { const label = String(layer.label || ""); const group = /đầu vào|dữ liệu|phương pháp|cách tính|cách chọn|seed|hệ nhà|nguồn thiên văn/i.test(label) ? "method" : /giới hạn|sai số|kiểm chứng|an toàn|ai|cảnh báo|hành động/i.test(label) ? "provenance" : "result"; groups[group].push({ ...layer, index }); });
    const cards = (items) => items.map((layer) => `<article><b>${String(layer.index + 1).padStart(2,"0")}</b><section><strong>${escapeHtml(layer.label)}</strong><p>${escapeHtml(layer.text)}</p></section></article>`).join("") || `<p class="fortune-explanation-empty">Không có lớp bổ sung trong chế độ này.</p>`;
    return `<section class="fortune-explanation fortune-explanation-v5"><header><span>${advanced ? "PHÂN TÍCH CHUYÊN SÂU" : "GIẢI THÍCH DỄ HIỂU"}</span><h3>${escapeHtml(title)}</h3><button type="button" data-fortune-toggle-experience>${advanced ? "Chuyển sang dễ hiểu" : "Xem chuyên sâu"}</button></header><div class="fortune-explanation-columns"><details data-panel="method"><summary>① Dữ liệu & phương pháp</summary><div>${cards(groups.method)}</div></details><section data-panel="result"><header>② Kết quả & cách đọc</header><div>${cards(groups.result)}</div></section><details data-panel="provenance"><summary>③ Provenance & giới hạn</summary><div>${cards(groups.provenance)}</div></details></div>${!advanced&&layers.length>4?`<small>Còn ${layers.length-4} lớp giải thích trong chế độ Chuyên sâu.</small>`:""}<footer><span>Hãy đối chiếu với trải nghiệm thật. Nội dung biểu tượng không xác định tính cách, tương lai hoặc giá trị của một người.</span><b>AI tự xuất hiện trong công cụ được hỗ trợ</b></footer></section>`;
  }

  function todayMarkup(runtime) {
    const daily = dailyReading(runtime.ownerId); const moon = calculateMoonPhase(localDateKey());
    const recent = runtime.state.history[0] || null; const journalCount = activeJournal(runtime).length;
    const popularTools = POPULAR_TOOL_IDS.map(observatoryToolMeta);
    const libraryIds = ["tarot","iching","numerology","zodiac","session","chart","moon","sky","calendar","eastern","tuvi","physiognomy","symbols","academy","dreams","compatibility","journal","methods","accuracy","history"];
    const advanced = runtime.state.settings.experience === "advanced"; const activeFilter = runtime.libraryFilter || "all"; const homePanel = ["overview","library","reflection"].includes(runtime.homePanel) ? runtime.homePanel : "overview";
    return `${toolbarMarkup("Đại sảnh HH Mystic Observatory", "Chọn một câu hỏi, một phương pháp và đi trọn luồng từ dữ liệu đến chiêm nghiệm — không phải dự đoán tương lai.")}
      <section class="fortune-observatory-home">
        <nav class="fortune-home-mode-switch" aria-label="Không gian tổng quan">${[["overview","Tổng quan","✦"],["library",`Thư viện ${libraryIds.length}`,"⌘"],["reflection","Chiêm nghiệm","✎"]].map(([id,label,icon])=>`<button type="button" class="${homePanel===id?"is-active":""}" data-fortune-home-panel="${id}" aria-pressed="${homePanel===id}"><i>${icon}</i><span>${label}</span></button>`).join("")}</nav>
        <div class="fortune-home-panel fortune-home-panel--overview" data-fortune-home-panel-content="overview" ${homePanel!=="overview"?"hidden":""}>
          <article class="fortune-home-hero"><div><span>KHÔNG GIAN CHIÊM NGHIỆM CÓ KIỂM CHỨNG</span><h3>Bạn muốn chiêm nghiệm điều gì hôm nay?</h3><p>Tính toán, thiên văn, biểu tượng và nội dung HH AI luôn được tách rõ.</p><div><button class="fortune-primary" type="button" data-fortune-view="session">✦ Bắt đầu phiên tổng hợp</button><button type="button" data-fortune-home-panel="library">Mở 20 công cụ</button></div></div><div class="fortune-home-oracle" style="--daily-energy:${daily.energy}%"><i>${escapeHtml(moon.symbol)}</i><b>${moon.illumination}%</b><span>${escapeHtml(moon.name)}</span><small>${escapeHtml(daily.dateKey)}</small></div></article>
          <div class="fortune-home-status-grid">
            <article data-status-tone="profile"><header><i>◉</i><div><span>HỒ SƠ PHIÊN</span><strong>${runtime.profile.date ? "Đã có dữ liệu" : "Chưa thiết lập"}</strong></div></header><p>${runtime.profile.date ? `${escapeHtml(runtime.profile.date)}${runtime.profile.time ? ` · ${escapeHtml(runtime.profile.time)}` : " · chưa có giờ"}<br>${escapeHtml(runtime.profile.place || runtime.profile.timezoneId)}` : "Nhập một lần để tự điền các công cụ."}</p><button type="button" data-fortune-view="profile">${runtime.profile.date ? "Kiểm tra hồ sơ" : "Tạo hồ sơ"} <b>→</b></button></article>
            <article data-status-tone="moon"><header><i>☾</i><div><span>MẶT TRĂNG HÔM NAY</span><strong>${escapeHtml(moon.name)}</strong></div></header><p>${moon.illumination}% chiếu sáng · tuổi trăng ${moon.ageDays} ngày.</p><button type="button" data-fortune-view="moon">Mở Moon 3D <b>→</b></button></article>
            <article data-status-tone="history"><header><i>◷</i><div><span>PHIÊN GẦN NHẤT</span><strong>${recent ? escapeHtml(recent.title) : "Chưa có kết quả"}</strong></div></header><p>${recent ? `${escapeHtml(recent.summary.slice(0, 82))}${recent.summary.length > 82 ? "…" : ""}` : "Chỉ lưu khi bạn chủ động xác nhận."}</p><button type="button" data-fortune-view="history">Mở lịch sử <b>→</b></button></article>
            <article data-status-tone="journal"><header><i>✎</i><div><span>CHIÊM NGHIỆM</span><strong>${journalCount} ghi chú</strong></div></header><p>${runtime.state.journalVault ? "Kho nhật ký AES-GCM đang bật." : "Local-first trên thiết bị này."}</p><button type="button" data-fortune-view="journal">Mở nhật ký <b>→</b></button></article>
          </div>
          <section class="fortune-home-favorites"><header><div><span>MỞ NHANH</span><h3>Bốn công cụ phổ biến</h3></div><button type="button" data-fortune-home-panel="library">Xem toàn bộ <b>→</b></button></header><div>${popularTools.map((item, index) => `<button type="button" data-fortune-view="${item.id}" data-tool-tone="${item.tone}" style="--tool-index:${index}"><i>${item.icon}</i><span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(advanced ? item.advanced : item.beginner)}</small></span><b>→</b></button>`).join("")}</div></section>
        </div>
        <div class="fortune-home-panel fortune-home-panel--library" data-fortune-home-panel-content="library" ${homePanel!=="library"?"hidden":""}>
          <section class="fortune-home-library" data-fortune-library><header><div><span>THƯ VIỆN PHƯƠNG PHÁP · <b data-fortune-library-count>${libraryIds.length}</b> KHÔNG GIAN</span><h3>Chọn thế giới để khám phá</h3><p>Lọc theo hệ để xem ít thẻ hơn; tìm kiếm phía trên hoạt động đồng thời với bộ lọc.</p></div><div class="fortune-experience-switch"><button type="button" class="${!advanced ? "is-active" : ""}" data-fortune-set-experience="beginner">Người mới</button><button type="button" class="${advanced ? "is-active" : ""}" data-fortune-set-experience="advanced">Chuyên sâu</button></div></header><div class="fortune-library-controls"><nav aria-label="Lọc thư viện phương pháp">${TOOL_LIBRARY_FILTERS.map(([id,label,icon])=>`<button type="button" class="${activeFilter===id?"is-active":""}" data-fortune-library-filter="${id}" aria-pressed="${activeFilter===id}"><i>${icon}</i>${label}</button>`).join("")}</nav><button type="button" data-fortune-random-tool>✦ Khám phá ngẫu nhiên</button></div><div class="fortune-library-grid">${libraryIds.map((id, index) => { const item = observatoryToolMeta(id); const description = advanced ? item.advanced : item.beginner; return `<button type="button" data-fortune-view="${id}" data-fortune-tool-card data-tool-family="${item.family}" data-tool-tone="${item.tone}" data-tool-index="${index}" data-tool-search="${escapeHtml(`${item.label} ${item.group} ${item.badge} ${description}`.toLocaleLowerCase("vi"))}" style="--tool-index:${index}"><i><span>${item.icon}</span></i><span class="fortune-tool-copy"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(description)}</small><em><b>${escapeHtml(item.group)}</b><b>${escapeHtml(item.badge)}</b></em></span><span class="fortune-tool-enter" aria-hidden="true">Mở <b>→</b></span></button>`; }).join("")}</div><footer class="fortune-library-pager"><button type="button" data-fortune-library-page="-1">← Trước</button><span data-fortune-library-range>Trang 1</span><button type="button" data-fortune-library-page="1">Sau →</button></footer><p data-fortune-library-empty hidden>Không có công cụ khớp bộ lọc hoặc từ khóa hiện tại.</p></section>
        </div>
        <div class="fortune-home-panel fortune-home-panel--reflection" data-fortune-home-panel-content="reflection" ${homePanel!=="reflection"?"hidden":""}>
          <article class="fortune-daily-reflection"><div class="fortune-orb"><span>${daily.energy}</span><small>NHỊP NGÀY</small></div><div><small>${escapeHtml(daily.focus)}</small><h3>${escapeHtml(daily.title)}</h3><p>${escapeHtml(daily.message)}</p></div><div><button type="button" data-fortune-daily-save>＋ Lưu lời nhắc</button><button type="button" data-fortune-copy="${escapeHtml(`${daily.title}. ${daily.message}`)}">Sao chép</button></div></article>
          <div class="fortune-reflection-shortcuts">${[["journal","✎","Nhật ký local-first","Viết, tìm kiếm và xuất ghi chú riêng tư."],["calendar","▦","Lịch chiêm nghiệm","Âm–dương, pha trăng và timeline."],["methods","ⓘ","Trung tâm phương pháp","Công thức, nguồn và giới hạn kỹ thuật."],["accuracy","✓","Accuracy Laboratory","Kiểm tra đầu vào, timezone và chứng thư."]].map(([id,icon,title,copy])=>`<button type="button" data-fortune-view="${id}"><i>${icon}</i><span><strong>${title}</strong><small>${copy}</small></span><b>→</b></button>`).join("")}</div>
        </div>
        <details class="fortune-safety-card"><summary>Ranh giới an toàn & cách hệ thống phân loại dữ liệu</summary><p>Đây là nội dung giải trí và tự chiêm nghiệm, không phải khoa học dự báo. Không dùng kết quả để thay thế tư vấn y tế, pháp lý, tài chính hoặc quyết định quan trọng. Bạn luôn là người chịu trách nhiệm cho lựa chọn của mình.</p></details>
      </section>`;
  }

  function legacyProfileMarkup(runtime) {
    const profile = runtime.profile;
    const hasCore = Boolean(profile.date);
    return `${toolbarMarkup("Hồ sơ phiên dùng chung", "Nhập một lần trong phiên để tự điền các công cụ. Mặc định dữ liệu biến mất khi đóng hoặc tải lại trang.")}<section class="fortune-profile"><article class="fortune-calc-card fortune-calc-card--wide"><header><i>◉</i><div><small>SESSION-ONLY BY DEFAULT</small><h3>Thông tin dùng chung</h3></div></header><div class="fortune-profile-fields"><label><span>Ngày sinh</span><input type="date" data-fortune-profile-date value="${escapeHtml(profile.date)}" autocomplete="bday"></label><label><span>Giờ sinh</span><input type="time" data-fortune-profile-time value="${escapeHtml(profile.time)}"></label><label><span>Thành phố nhanh</span><select data-fortune-profile-city><option value="custom">Tự nhập tọa độ</option>${Object.entries(PROFILE_CITIES).map(([id, city]) => `<option value="${id}"${profile.city === id ? " selected" : ""}>${escapeHtml(city.label)} · ${escapeHtml(city.timezoneId)}</option>`).join("")}</select></label><label><span>Tên địa điểm</span><input type="text" maxlength="120" data-fortune-profile-place value="${escapeHtml(profile.place)}" placeholder="Ví dụ: Hà Nội"></label><label><span>Múi giờ IANA</span><input type="text" maxlength="80" data-fortune-profile-timezone-id value="${escapeHtml(profile.timezoneId)}" placeholder="Asia/Ho_Chi_Minh"></label><label><span>UTC offset tham khảo</span><input type="number" min="-12" max="14" step="0.5" data-fortune-profile-timezone value="${profile.timezone}"></label><label><span>Vĩ độ</span><input type="number" min="-90" max="90" step="0.0001" data-fortune-profile-latitude value="${profile.latitude}"></label><label><span>Kinh độ</span><input type="number" min="-180" max="180" step="0.0001" data-fortune-profile-longitude value="${profile.longitude}"></label><label><span>Độ cao (m)</span><input type="number" min="-500" max="9000" step="1" data-fortune-profile-elevation value="${profile.elevation}"></label><label><span>Hoàng đạo</span><select data-fortune-profile-zodiac-mode><option value="tropical"${profile.zodiacMode === "tropical" ? " selected" : ""}>Tropical</option><option value="sidereal"${profile.zodiacMode === "sidereal" ? " selected" : ""}>Sidereal · Lahiri xấp xỉ</option></select></label><label><span>Hệ nhà</span><select data-fortune-profile-house-system><option value="equal"${profile.houseSystem === "equal" ? " selected" : ""}>Equal House</option><option value="whole-sign"${profile.houseSystem === "whole-sign" ? " selected" : ""}>Whole Sign</option></select></label><label class="fortune-check"><input type="checkbox" data-fortune-profile-before-tet ${profile.beforeTet ? "checked" : ""}><span>Sinh trước Tết âm lịch năm đó</span></label></div><details class="fortune-profile-method"><summary>Orb góc hợp (độ)</summary><div>${Object.entries(profile.aspectOrbs || DEFAULT_ORBS).map(([key, value]) => `<label><span>${escapeHtml(key)}</span><input type="number" min="0" max="15" step="0.5" data-fortune-profile-orb="${key}" value="${value}"></label>`).join("")}</div></details><label class="fortune-profile-consent"><input type="checkbox" data-fortune-profile-remember ${runtime.state.profile?.remembered ? "checked" : ""}><span><strong>Cho phép lưu hồ sơ trên thiết bị này</strong><small>Nếu không bật, dữ liệu chỉ nằm trong bộ nhớ của tab. Hồ sơ không tự gửi lên máy chủ.</small></span></label><div class="fortune-profile-actions"><button class="fortune-primary" type="button" data-fortune-profile-apply>Áp dụng cho phiên</button><button type="button" data-fortune-profile-clear>Xóa hồ sơ ngay</button><button type="button" data-fortune-view="accuracy">Mở Provenance Center</button></div></article><article class="fortune-profile-status"><span>${hasCore ? "ĐÃ CÓ DỮ LIỆU PHIÊN" : "CHƯA CÓ HỒ SƠ"}</span><h3>${hasCore ? `Ngày ${escapeHtml(profile.date)}${profile.time ? ` · ${escapeHtml(profile.time)}` : ""}` : "Nhập ngày sinh để tự điền công cụ"}</h3><p>${profile.place ? `${escapeHtml(profile.place)} · ${escapeHtml(profile.timezoneId)}` : "Vị trí chỉ cần thiết cho cung mọc và mười hai nhà."}</p><dl><div><dt>Lưu lâu dài</dt><dd>${runtime.state.profile?.remembered ? "Đã bật trên thiết bị" : "Đang tắt"}</dd></div><div><dt>Gửi máy chủ</dt><dd>Không</dd></div><div><dt>Bản đồ sao</dt><dd>${profile.date && profile.time && profile.latitude && profile.longitude ? "Đủ đầu vào" : "Cần giờ và tọa độ"}</dd></div><div><dt>Phương pháp</dt><dd>${escapeHtml(profile.zodiacMode)} · ${escapeHtml(profile.houseSystem)}</dd></div></dl></article></section>`;
  }

  function profileMarkup(runtime) {
    const profile = runtime.profile; const lab = accuracyLab(); const quality = lab?.assessInputQuality?.(profile) || { statuses: {}, issues: [], warnings: [], localTime: {} };
    const selected = (value, expected) => value === expected ? " selected" : ""; const statusItems = [["Đầu vào", quality.statuses.input], ["Múi giờ", quality.statuses.timezone], ["Phép tính", quality.statuses.calculation], ["Diễn giải", quality.statuses.interpretation]];
    const local = quality.localTime || {}; const hasCore = Boolean(profile.date);
    return `${toolbarMarkup("Hồ sơ phiên & chất lượng đầu vào", "Ghi rõ nguồn, sai số giờ sinh, timezone và hệ lịch. Mặc định dữ liệu chỉ tồn tại trong tab này.")}<section class="fortune-v4-workspace fortune-profile-v5"><div class="fortune-accuracy-layout"><article class="fortune-v4-card fortune-v4-form fortune-profile-editor"><header><span>INPUT QUALITY</span><strong>Thông tin dùng chung</strong></header><div class="fortune-v4-inline-fields"><label><span>Ngày sinh</span><input type="date" data-fortune-profile-date value="${escapeHtml(profile.date)}" autocomplete="bday"></label><label><span>Giờ sinh</span><input type="time" data-fortune-profile-time value="${escapeHtml(profile.time)}"></label><label><span>Độ chính xác giờ</span><select data-fortune-profile-time-accuracy><option value="exact"${selected(profile.birthTimeAccuracy,"exact")}>Chính xác</option><option value="estimated"${selected(profile.birthTimeAccuracy,"estimated")}>Ước lượng</option><option value="unknown"${selected(profile.birthTimeAccuracy,"unknown")}>Không biết</option></select></label><label><span>Nguồn giờ sinh</span><select data-fortune-profile-time-source><option value="birth-certificate"${selected(profile.birthTimeSource,"birth-certificate")}>Giấy khai sinh</option><option value="family-memory"${selected(profile.birthTimeSource,"family-memory")}>Người thân nhớ</option><option value="self-estimated"${selected(profile.birthTimeSource,"self-estimated")}>Tự ước lượng</option><option value="unknown"${selected(profile.birthTimeSource,"unknown")}>Không rõ</option></select></label><label><span>Sai số dự kiến</span><select data-fortune-profile-time-uncertainty><option value="1"${selected(profile.birthTimeUncertaintyMinutes,1)}>±1 phút</option><option value="15"${selected(profile.birthTimeUncertaintyMinutes,15)}>±15 phút</option><option value="60"${selected(profile.birthTimeUncertaintyMinutes,60)}>±1 giờ</option><option value="720"${selected(profile.birthTimeUncertaintyMinutes,720)}>Không biết · cả ngày</option></select></label><label><span>Hệ lịch</span><select data-fortune-profile-calendar><option value="gregorian"${selected(profile.calendarSystem,"gregorian")}>Gregorian</option><option value="julian"${selected(profile.calendarSystem,"julian")}>Julian · lịch sử</option></select></label></div><hr><div class="fortune-v4-inline-fields"><label><span>Thành phố nhanh</span><select data-fortune-profile-city><option value="custom">Tự nhập tọa độ</option>${Object.entries(PROFILE_CITIES).map(([id, city]) => `<option value="${id}"${selected(profile.city,id)}>${escapeHtml(city.label)} · ${escapeHtml(city.timezoneId)}</option>`).join("")}</select></label><label><span>Tên địa điểm</span><input type="text" maxlength="120" data-fortune-profile-place value="${escapeHtml(profile.place)}" placeholder="Ví dụ: Hà Nội"></label><label><span>Mức tin cậy vị trí</span><select data-fortune-profile-location-confidence><option value="verified"${selected(profile.locationConfidence,"verified")}>Đã xác minh</option><option value="selected"${selected(profile.locationConfidence,"selected")}>Chọn từ danh sách</option><option value="approximate"${selected(profile.locationConfidence,"approximate")}>Xấp xỉ</option></select></label><label><span>Múi giờ IANA</span><input type="text" maxlength="80" data-fortune-profile-timezone-id value="${escapeHtml(profile.timezoneId)}" placeholder="Asia/Ho_Chi_Minh"></label><label><span>DST khi giờ bị lặp</span><select data-fortune-profile-dst-resolution><option value=""${selected(profile.dstResolution,"")}>Chưa chọn</option><option value="earlier"${selected(profile.dstResolution,"earlier")}>Lần sớm hơn</option><option value="later"${selected(profile.dstResolution,"later")}>Lần muộn hơn</option></select></label><label><span>UTC offset tham khảo</span><input type="number" min="-12" max="14" step="0.5" data-fortune-profile-timezone value="${profile.timezone}"></label><label><span>Vĩ độ</span><input type="number" min="-90" max="90" step="0.0001" data-fortune-profile-latitude value="${profile.latitude}"></label><label><span>Kinh độ</span><input type="number" min="-180" max="180" step="0.0001" data-fortune-profile-longitude value="${profile.longitude}"></label><label><span>Độ cao (m)</span><input type="number" min="-500" max="9000" step="1" data-fortune-profile-elevation value="${profile.elevation}"></label></div><hr><div class="fortune-v4-inline-fields"><label><span>Hoàng đạo</span><select data-fortune-profile-zodiac-mode><option value="tropical"${selected(profile.zodiacMode,"tropical")}>Tropical</option><option value="sidereal"${selected(profile.zodiacMode,"sidereal")}>Sidereal · Lahiri xấp xỉ</option></select></label><label><span>Hệ nhà đã kiểm thử</span><select data-fortune-profile-house-system><option value="equal"${selected(profile.houseSystem,"equal")}>Equal House</option><option value="whole-sign"${selected(profile.houseSystem,"whole-sign")}>Whole Sign</option><option value="porphyry"${selected(profile.houseSystem,"porphyry")}>Porphyry</option></select></label><label class="fortune-check"><input type="checkbox" data-fortune-profile-before-tet ${profile.beforeTet ? "checked" : ""}><span>Sinh trước Tết âm lịch năm đó</span></label></div><details class="fortune-profile-method"><summary>Orb góc hợp (độ)</summary><div>${Object.entries(profile.aspectOrbs || DEFAULT_ORBS).map(([key, value]) => `<label><span>${escapeHtml(key)}</span><input type="number" min="0" max="15" step="0.5" data-fortune-profile-orb="${key}" value="${value}"></label>`).join("")}</div></details><label class="fortune-profile-consent"><input type="checkbox" data-fortune-profile-remember ${runtime.state.profile?.remembered ? "checked" : ""}><span><strong>Cho phép lưu hồ sơ trên thiết bị này</strong><small>Nếu không bật, hồ sơ không được ghi vào localStorage và không tự gửi lên máy chủ.</small></span></label><div class="fortune-profile-actions"><button class="fortune-primary" type="button" data-fortune-profile-apply>Kiểm tra & áp dụng</button><button type="button" data-fortune-profile-clear>Xóa hồ sơ ngay</button><button type="button" data-fortune-view="accuracy">Mở Accuracy Laboratory</button></div></article><aside class="fortune-v4-card fortune-input-status"><header><span>4 TRẠNG THÁI ĐỘC LẬP</span><strong>${hasCore ? escapeHtml(profile.date) : "Chưa có hồ sơ"}</strong></header><div class="fortune-quality-grid">${statusItems.map(([label,status]) => `<div data-status="${escapeHtml(status?.id || "missing")}"><span>${label}</span><strong>${escapeHtml(status?.label || "Thiếu")}</strong></div>`).join("")}</div><dl class="fortune-v4-contract"><div><dt>Giờ địa phương</dt><dd>${escapeHtml(local.status || "chưa kiểm tra")}</dd></div><div><dt>UTC đã chọn</dt><dd>${escapeHtml(local.selected?.instantUtc || "—")}</dd></div><div><dt>UTC offset</dt><dd>${Number.isFinite(local.selected?.offsetMinutes) ? `${local.selected.offsetMinutes} phút` : "—"}</dd></div><div><dt>tzdb mục tiêu</dt><dd>2026c</dd></div><div><dt>tzdb runtime</dt><dd>unknown-runtime-icu</dd></div><div><dt>Sai số giờ</dt><dd>±${quality.uncertaintyMinutes || profile.birthTimeUncertaintyMinutes || 15} phút</dd></div></dl>${[...(quality.issues || []), ...(quality.warnings || [])].length ? `<ul class="fortune-quality-issues">${[...(quality.issues || []), ...(quality.warnings || [])].map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p class="fortune-quality-ok">Dữ liệu hiện tại không có xung đột kỹ thuật đã biết.</p>`}<p>Nếu không biết giờ sinh, Astrology Studio vẫn tính vị trí hành tinh theo khoảng cả ngày nhưng tự ẩn ASC, MC và mười hai nhà.</p></aside></div></section>`;
  }

  function sessionMarkup(runtime) {
    const builder = runtime.builder;
    const result = builder.result;
    const tools = [["tarot","Tarot + câu hỏi"],["numerology","Thần số + chu kỳ"],["iching","Kinh Dịch + hành động"],["zodiac","Cung + giao tiếp"],["moon","Mặt Trăng + cảm xúc"]];
    return `${toolbarMarkup("Phiên xem tổng hợp", "Một luồng duy nhất từ chủ đề đến kết quả, HH AI tự phân tích trong tab riêng, suy ngẫm và lưu.")}<section class="fortune-session-builder"><ol class="fortune-builder-rail">${[["Nhập dữ liệu",1],["Tính / Rút",4],["Luận giải",5],["Chiêm nghiệm",6]].map(([label,threshold],index)=>`<li class="${builder.step >= threshold ? "is-done" : ""}"><b>${index+1}</b><span>${label}</span></li>`).join("")}</ol><div class="fortune-builder-grid"><article><span>1 · CHỌN CHỦ ĐỀ</span><label><select data-fortune-builder-topic>${[["clarity","Làm rõ tình huống"],["relationship","Mối quan hệ"],["work","Công việc"],["decision","Cân nhắc quyết định"],["wellbeing","Quan sát cảm xúc"]].map(([id,label])=>`<option value="${id}"${builder.topic===id?" selected":""}>${label}</option>`).join("")}</select></label><textarea rows="2" maxlength="240" data-fortune-builder-question placeholder="Câu hỏi tùy chọn, không tự gửi tới HH AI">${escapeHtml(builder.question)}</textarea></article><article><span>2 · CHỌN CÔNG CỤ</span><div class="fortune-builder-tools">${tools.map(([id,label])=>`<label><input type="checkbox" data-fortune-builder-tool="${id}" ${builder.tools.includes(id)?"checked":""}><span>${label}</span></label>`).join("")}</div></article><article><span>3 · KIỂM TRA DỮ LIỆU</span><p>${runtime.profile.date ? `Đang dùng hồ sơ phiên ${escapeHtml(runtime.profile.date)}.` : "Chưa có ngày sinh; Tarot, Kinh Dịch và Mặt Trăng vẫn dùng được."}</p><button type="button" data-fortune-view="profile">Mở hồ sơ phiên</button></article><article><span>4 · PHƯƠNG PHÁP</span><ul>${builder.tools.map((id)=>`<li>${escapeHtml(METHOD_CATALOG.find((item)=>item.id===id)?.algorithm||"Phương pháp được hiển thị trong công cụ.")}</li>`).join("")||"<li>Chọn ít nhất một công cụ.</li>"}</ul><button class="fortune-primary" type="button" data-fortune-builder-run>Tạo phiên & tự phân tích</button></article>${result ? `<article class="fortune-builder-result" data-fortune-result><span>5 · KẾT QUẢ</span><h3>${escapeHtml(result.title)}</h3><div>${result.parts.map((part)=>`<section><strong>${escapeHtml(part.label)}</strong><p>${escapeHtml(part.text)}</p></section>`).join("")}</div><small>Phân tích tự động nằm trong tab HH AI; câu hỏi riêng và hồ sơ gốc không được gửi.</small></article><article><span>6 · SUY NGẪM</span><textarea rows="5" maxlength="3000" data-fortune-builder-reflection placeholder="Điều gì thực sự hữu ích với bạn?">${escapeHtml(builder.reflection)}</textarea><div class="fortune-mood-row"><label>Cảm xúc trước<input type="range" min="1" max="5" data-fortune-builder-mood-before value="${builder.moodBefore}"></label><label>Cảm xúc sau<input type="range" min="1" max="5" data-fortune-builder-mood-after value="${builder.moodAfter}"></label></div></article><article><span>7 · LƯU CÓ CHỦ ĐÍCH</span><p>Chỉ tóm tắt kết quả và phần bạn viết được lưu. Ngày sinh, câu hỏi và tọa độ không đi vào lịch sử.</p><button class="fortune-primary" type="button" data-fortune-builder-save>Lưu phiên & nhật ký</button><button type="button" data-fortune-builder-reset>Làm phiên mới</button></article>` : ""}</div></section>`;
  }

  function tarotLegacyMarkup(runtime) {
    const cards = runtime.session.tarot || []; const revealed = runtime.session.tarotRevealed instanceof Set ? runtime.session.tarotRevealed : new Set();
    let results = cards.length ? `<div class="fortune-card-spread" data-fortune-result>${cards.map((card,index) => `<article class="fortune-tarot-card ${revealed.has(index) ? "is-revealed" : "is-concealed"}${card.reversed ? " is-reversed" : ""}" style="--card-accent:${card.color};--card-order:${index}" draggable="${revealed.has(index) ? "true" : "false"}" data-fortune-card-index="${index}"><button class="fortune-card-seal" type="button" data-fortune-card-reveal="${index}" aria-label="Lật lá ${index + 1}"><span>✦</span><b>CHẠM ĐỂ LẬT</b><small>${escapeHtml(card.position)}</small></button><div class="fortune-tarot-face"><small><input type="text" maxlength="60" data-fortune-card-position="${index}" value="${escapeHtml(card.position)}" aria-label="Tên vị trí lá ${index+1}"></small>${card.image ? `<figure><img src="${escapeHtml(card.image)}" alt="${escapeHtml(card.name)}" width="360" height="617" loading="lazy" decoding="async"></figure>` : `<i aria-hidden="true">${card.symbol}</i>`}<h3>${escapeHtml(card.name)}</h3><span>${card.reversed ? "Lá đảo · Reversed" : "Lá xuôi · Upright"}</span></div><div class="fortune-tarot-reading"><p>${escapeHtml(card.interpretation)}</p><strong>Câu hỏi mở</strong><p>${escapeHtml(card.question)}</p>${card.symbols?.length ? `<details class="fortune-symbol-atlas"><summary>Giải thích chi tiết trên hình</summary>${card.symbols.map((symbol) => `<button type="button" data-fortune-copy="${escapeHtml(symbol)}"><b>◎</b><span>${escapeHtml(symbol)}</span></button>`).join("")}</details>` : ""}<textarea rows="2" maxlength="500" data-fortune-card-note="${index}" placeholder="Ghi chú riêng cho lá này...">${escapeHtml(card.note||"")}</textarea><footer><button type="button" data-fortune-card-pin="${index}">${card.pinned?"★ Đã ghim":"☆ Ghim"}</button><button type="button" data-fortune-card-move="${index}:-1" aria-label="Đưa lá sang trái">←</button><button type="button" data-fortune-card-move="${index}:1" aria-label="Đưa lá sang phải">→</button></footer></div></article>`).join("")}</div>${runtime.session.tarotPrevious?.length?`<details class="fortune-tarot-compare"><summary>So sánh với lần trải trước</summary><div>${runtime.session.tarotPrevious.map((card,index)=>`<span><b>${index+1}</b>${escapeHtml(card.name)} · ${escapeHtml(card.position)}</span>`).join("")}</div></details>`:""}<div class="fortune-result-actions"><button type="button" data-fortune-reveal-all>✦ Lật tất cả</button><label>Tỷ lệ ảnh<select data-fortune-export-ratio><option value="1:1">1:1</option><option value="9:16">9:16</option><option value="16:9">16:9</option></select></label><button type="button" data-fortune-export="txt">Tải TXT</button><button type="button" data-fortune-export="json">Tải JSON</button><button type="button" data-fortune-export="png">Tải PNG</button><button type="button" data-fortune-copy-result>Sao chép</button><button type="button" data-fortune-share>Chia sẻ</button></div><p class="fortune-tarot-rights">Hình Rider–Waite–Smith 1909 · Pamela Colman Smith · Public Domain Mark 1.0 · nguồn Wikimedia Commons. Diễn giải tiếng Việt do HH biên soạn.</p>` : `<div class="fortune-empty"><i>♢</i><strong>Chưa có lá bài nào được rút</strong><p>Chọn kiểu trải bài rồi bấm “Rút bài”. Mỗi lần bấm dùng một seed mới và có thể tái tạo từ seed hiển thị.</p></div>`;
    if (cards.length) results += explanationMarkup(runtime, "Cách đọc trải bài này", [
      { label: "Dữ liệu đầu vào", text: `Trải ${cards.length} lá dùng seed ${runtime.session.tarotSeed}; câu hỏi chỉ giúp định hướng chú ý và không được lưu.` },
      { label: "Cách chọn lá", text: "Bộ Rider–Waite–Smith chuẩn gồm 78 lá (22 Major + 56 Minor) được xáo bằng bộ sinh số có seed; mỗi lá chỉ xuất hiện một lần trong cùng trải bài." },
      { label: "Vị trí", text: "Tên vị trí mô tả vai trò của lá trong bố cục, không phải mốc thời gian chắc chắn. Bạn có thể sửa tên vị trí cho phù hợp." },
      { label: "Thuận và góc khuất", text: "Thuận chiều nêu nguồn lực dễ nhận thấy; góc khuất nêu rủi ro hoặc điểm mù cần kiểm chứng." },
      { label: "Liên kết các lá", text: "Đọc điểm lặp giữa các lá trước, sau đó tìm mâu thuẫn. Mâu thuẫn thường là nơi cần thêm dữ kiện thay vì chọn một câu trả lời tuyệt đối." },
      { label: "Kiểm chứng", text: "Tách dữ kiện đang có, diễn giải của bạn và điều chưa biết. Không biến biểu tượng thành bằng chứng về người khác." },
      { label: "Hành động an toàn", text: "Chọn một bước nhỏ có thể đảo ngược, đặt thời điểm xem lại và dừng nếu kết quả làm tăng sợ hãi." },
      { label: "Giới hạn", text: "Tarot không dự báo khoa học, không thay tư vấn chuyên môn và không xác nhận ý định bí mật của bất kỳ ai." }
    ]);
    return `${toolbarMarkup("Tarot 78 Studio · Rider–Waite–Smith", "Đủ 78 hình lá chuẩn và tên chuẩn Anh–Việt; Spread Builder, symbol atlas, seed proof và xuất đa định dạng.")}<section class="fortune-control-panel fortune-tarot-builder"><label><span>Chủ đề hoặc câu hỏi (không lưu)</span><input type="text" maxlength="180" data-fortune-tarot-question value="${escapeHtml(runtime.session.question || "")}" placeholder="Bạn muốn soi chiếu điều gì?"></label><label><span>Kiểu trải bài</span><select data-fortune-tarot-count><option value="1"${runtime.session.tarotCount === 1 ? " selected" : ""}>1 lá · Trọng tâm</option><option value="3"${runtime.session.tarotCount === 3 ? " selected" : ""}>3 lá · Bối cảnh / Chú ý / Bước thử</option><option value="5"${runtime.session.tarotCount === 5 ? " selected" : ""}>5 lá · Toàn cảnh</option><option value="7"${runtime.session.tarotCount === 7 ? " selected" : ""}>7 lá · Hành trình</option><option value="10"${runtime.session.tarotCount === 10 ? " selected" : ""}>10 lá · Celtic Cross chuẩn</option><option value="12"${runtime.session.tarotCount === 12 ? " selected" : ""}>12 lá · Vòng năm</option><option value="15"${runtime.session.tarotCount === 15 ? " selected" : ""}>15 lá · Bản đồ đầy đủ</option></select></label><label><span>Seed tái tạo (tùy chọn)</span><input type="text" maxlength="180" data-fortune-tarot-seed value="${escapeHtml(runtime.session.tarotSeed || "")}" placeholder="Để trống để Web Crypto tạo seed"></label><label class="fortune-check"><input type="checkbox" data-fortune-tarot-reversed ${runtime.session.tarotAllowReversed !== false ? "checked" : ""}><span>Cho phép lá đảo · tùy chọn trường phái</span></label><label class="fortune-tarot-positions"><span>Tên vị trí tùy chỉnh · mỗi dòng một vị trí</span><textarea rows="3" maxlength="1000" data-fortune-tarot-positions placeholder="Để trống để dùng bố cục chuẩn">${escapeHtml(runtime.session.tarotPositionsText || "")}</textarea></label><button class="fortune-primary" type="button" data-fortune-draw>♢ Rút bài có chứng thư</button><small>Cùng seed + số lá + vị trí + chế độ đảo cho cùng kết quả. SHA-256 chứng minh danh sách không bị đổi sau khi rút.</small></section>${results}`;
  }

  function zodiacMarkup(runtime) {
    const western = runtime.session.western; const chinese = runtime.session.chinese; const dateValue = runtime.session.zodiacDate || runtime.profile.date || ""; const boundary = runtime.session.chineseBoundary || "lunar-new-year";
    return `${toolbarMarkup("Cung hoàng đạo & 12 con giáp", "Kinh độ Mặt Trời thật và hai mốc đổi năm được tính riêng; không còn dùng bảng ngày cố định.")}<div class="fortune-two-column"><section class="fortune-calc-card"><header><i>☼</i><div><small>TROPICAL SOLAR LONGITUDE</small><h3>Tính cung từ kinh độ Mặt Trời</h3></div></header><label><span>Ngày sinh</span><input type="date" data-fortune-zodiac-date autocomplete="bday" value="${escapeHtml(dateValue)}"></label><button class="fortune-primary" type="button" data-fortune-zodiac-calc>Tính bằng Astronomy Engine</button>${western?.ok ? `<div class="fortune-sign-result" data-fortune-result><i>${western.sign.symbol}</i><div><small>${escapeHtml(western.sign.element)} · ${escapeHtml(western.sign.modality)} · ${western.sign.longitude.toFixed(4)}°</small><h3>${escapeHtml(western.sign.name)}</h3><p>${western.nearBoundary ? "⚠ Gần ranh giới: xem khoảng biến thiên cả ngày và nhập giờ sinh nếu biết." : "Đã tính tại timestamp UTC hiển thị trong contract."}</p></div></div><dl class="fortune-v4-contract"><div><dt>UTC</dt><dd>${escapeHtml(western.instantUtc)}</dd></div><div><dt>Khoảng trong ngày</dt><dd>${escapeHtml(western.dailyRange.from.name)} ${western.dailyRange.from.longitude.toFixed(3)}° → ${escapeHtml(western.dailyRange.to.name)} ${western.dailyRange.to.longitude.toFixed(3)}°</dd></div><div><dt>Phân biệt</dt><dd>${escapeHtml(western.distinction)}</dd></div></dl>` : `<p class="fortune-hint">Nếu không biết giờ, hệ thống tính cả khoảng 00:00–23:59 và cảnh báo khi có thể đổi cung.</p>`}</section><section class="fortune-calc-card"><header><i>◉</i><div><small>CHINESE YEAR BOUNDARY</small><h3>Chọn rõ mốc đổi năm</h3></div></header><div class="fortune-inline-fields"><label><span>Ngày sinh</span><input type="date" data-fortune-chinese-date value="${escapeHtml(runtime.session.chineseDate || dateValue)}"></label><label><span>Mốc đổi năm</span><select data-fortune-chinese-boundary><option value="lunar-new-year"${boundary === "lunar-new-year" ? " selected" : ""}>Tết Âm lịch</option><option value="lichun"${boundary === "lichun" ? " selected" : ""}>Lập Xuân · Mặt Trời 315°</option></select></label></div><button class="fortune-primary" type="button" data-fortune-chinese-calc>Tính con giáp theo mốc đã chọn</button>${chinese?.ok ? `<div class="fortune-sign-result fortune-sign-result--animal" data-fortune-result><i>${escapeHtml(chinese.branch)}</i><div><small>${escapeHtml(chinese.yinYang)} ${escapeHtml(chinese.element)} · năm chu kỳ ${chinese.cycleYear}</small><h3>${escapeHtml(chinese.animal)} · ${escapeHtml(chinese.stem)} ${escapeHtml(chinese.branch)}</h3><p>${escapeHtml(chinese.boundaryLabel)} · ${escapeHtml(chinese.formula)}</p></div></div>` : `<p class="fortune-hint">Hai phương pháp có thể cho năm khác nhau trong vài tuần đầu năm; website không trộn chúng.</p>`}</section><details class="fortune-method-card"><summary>Cách tính và giới hạn</summary><p>Tropical chia vòng hoàng đạo thành 12 đoạn 30° tính từ điểm xuân phân, khác chòm sao thiên văn thực tế. Con giáp được tính riêng theo relatedYear của lịch Chinese hoặc thời điểm Mặt Trời đạt 315°; không phương pháp nào là phép đo tính cách.</p></details></div>`;
  }

  function numerologyLegacyMarkup(runtime) {
    const result = runtime.session.numerology;
    const v4 = runtime.session.numerologyV4;
    const cycles = runtime.session.cycles;
    const nameResult = runtime.session.nameNumerology;
    const detail = result ? explanationMarkup(runtime, "Đọc kết quả thần số học theo từng lớp", [
      { label: "Dữ liệu đầu vào", text: "Ngày sinh được tách thành từng chữ số; số 0 vẫn nằm trong công thức tổng nhưng không xuất hiện trong biểu đồ 1–9." },
      { label: "Đường đời", text: `${result.formula}. Chủ đề biểu tượng đang dùng: ${result.meaning}.` },
      { label: "Ngày sinh", text: `Ngày trong tháng được rút gọn thành ${result.birthDay}; đây là một lớp phụ, không thay thế đường đời.` },
      { label: "Thái độ", text: `${result.attitudeFormula}. Kết quả ${result.attitude} được dùng như câu hỏi về cách tiếp cận ban đầu.` },
      { label: "Biểu đồ ngày sinh", text: `Số lần xuất hiện từ 1 đến 9: ${Object.entries(result.chart).map(([number,count])=>`${number}:${count}`).join(", ")}. Không xem số thiếu là khuyết điểm.` },
      { label: "Mũi tên", text: result.arrows.length ? result.arrows.map((item)=>`${item.numbers.join("-")} ${item.state === "full" ? "đủ" : "trống"}: ${item.label}`).join("; ") : "Không có hàng đủ hoàn toàn hoặc trống hoàn toàn theo bảng đang dùng." },
      { label: "Chu kỳ cá nhân", text: cycles ? `${cycles.formula}. Chu kỳ chỉ là nhịp biểu tượng, không dự báo sự kiện.` : "Chưa tính vì thiếu ngày xem." },
      { label: "Tên gọi", text: nameResult ? `Đang dùng riêng hệ ${nameResult.system === "chaldean" ? "Chaldean" : "Pythagoras"}; không trộn hai bảng trong cùng phép tính.` : "Chưa nhập tên; phần ngày sinh vẫn độc lập." },
      { label: "Kiểm chứng", text: "Chọn một mô tả phù hợp và một mô tả không phù hợp, rồi ghi dữ kiện thật hỗ trợ nhận xét của bạn." },
      { label: "Giới hạn", text: "Thần số học là hệ biểu tượng, không đo trí tuệ, sức khỏe, nhân cách hay xác suất thành công." }
    ]) : "";
    const v4Detail = v4 ? `<article class="fortune-v4-card fortune-number-v4"><header><span>NUMEROLOGY V4 · ${escapeHtml(v4.system)}</span><strong>Đủ lớp nâng cao</strong></header><div class="fortune-v4-table"><div><span>Đường đời</span><b>${v4.lifePath.value}</b><small>${escapeHtml(v4.lifePath.formula)}</small></div><div><span>Ngày sinh</span><b>${v4.birthday.value}</b><small>${escapeHtml(v4.birthday.formula)}</small></div><div><span>Thái độ</span><b>${v4.attitude.value}</b><small>${escapeHtml(v4.attitude.formula)}</small></div><div><span>Trưởng thành</span><b>${v4.maturity?.value ?? "—"}</b><small>${escapeHtml(v4.maturity?.formula || "Cần tên để tính")}</small></div><div><span>Cân bằng</span><b>${v4.balance?.value ?? "—"}</b><small>${escapeHtml(v4.balance?.formula || "Cần tên")}</small></div><div><span>Năm / tháng / ngày cá nhân</span><b>${v4.cycles.personalYear} · ${v4.cycles.personalMonth} · ${v4.cycles.personalDay}</b><small>${escapeHtml(v4.provenance.method)}</small></div></div><details><summary>Pinnacles, Challenges, Karmic và Lo Shu</summary><pre>${escapeHtml(JSON.stringify({ pinnacles: v4.pinnacles, challenges: v4.challenges, karmicDebt: v4.karmicDebt, karmicLessons: v4.karmicLessons, loShu: v4.loShu }, null, 2))}</pre></details><div class="fortune-v4-output-tags"><b>BIỂU TƯỢNG</b></div></article>` : "";
    return `${toolbarMarkup("Thần số học minh bạch", "Công khai từng bước cộng và rút gọn; đây là hệ thống biểu tượng, không phải công cụ đánh giá con người.")}<section class="fortune-numerology"><div class="fortune-calc-card fortune-calc-card--wide"><header><i>#</i><div><small>CÔNG THỨC TẠI CHỖ</small><h3>Ngày sinh, chu kỳ và tên gọi</h3></div></header><div class="fortune-form-grid"><label><span>Ngày sinh</span><input type="date" data-fortune-numerology-date autocomplete="bday" value="${escapeHtml(runtime.session.birthDate || runtime.profile.date || "")}"></label><label><span>Ngày muốn xem chu kỳ</span><input type="date" data-fortune-cycle-date value="${escapeHtml(runtime.session.targetDate || localDateKey())}"></label></div><button class="fortune-primary" type="button" data-fortune-numerology-calc>Tính đường đời và chu kỳ</button><div class="fortune-name-lab"><label><span>Tên dùng để tính riêng (không lưu)</span><input type="text" maxlength="120" data-fortune-name value="${escapeHtml(runtime.session.nameInput || "")}" placeholder="Nhập tên gọi hoặc họ tên"></label><label><span>Hệ chữ cái</span><select data-fortune-name-system><option value="pythagorean"${runtime.session.nameSystem!=="chaldean"?" selected":""}>Pythagoras</option><option value="chaldean"${runtime.session.nameSystem==="chaldean"?" selected":""}>Chaldean</option></select></label><button type="button" data-fortune-name-calc>Tính riêng theo hệ đã chọn</button></div><p class="fortune-hint">Ngày sinh và tên chỉ tồn tại trong phiên đang mở, không ghi vào localStorage và không gửi lên máy chủ.</p></div>${result ? `<article class="fortune-number-result" data-fortune-result><div><small>CON SỐ ĐƯỜNG ĐỜI</small><strong>${result.lifePath}</strong><span>Ngày sinh ${result.birthDay} · Thái độ ${result.attitude}</span></div><section><span>Công thức</span><code>${escapeHtml(result.formula)}</code><h3>Chủ đề: ${escapeHtml(result.meaning)}</h3><div class="fortune-number-grid">${Object.entries(result.chart).map(([number,count])=>`<span class="${count?"has-number":""}"><b>${number}</b><small>${count} lần</small></span>`).join("")}</div><div class="fortune-arrow-list">${result.arrows.map((item)=>`<span class="is-${item.state}">${item.numbers.join("-")} · ${escapeHtml(item.label)} · ${item.state === "full" ? "đủ" : "trống"}</span>`).join("")||"Không có hàng đủ/trống hoàn toàn."}</div><button type="button" data-fortune-save-current>Lưu phần tóm tắt</button></section></article>` : `<div class="fortune-empty fortune-empty--compact"><i>#</i><strong>Nhập ngày sinh để bắt đầu</strong><p>Kết quả hiển thị tổng chữ số, bước rút gọn, thái độ, biểu đồ 1–9 và mũi tên.</p></div>`}${v4Detail}${cycles ? `<article class="fortune-cycle-result"><header><small>CHU KỲ CÁ NHÂN · ${escapeHtml(cycles.targetDate)}</small><h3>Ba nhịp để tự quan sát</h3></header><div><span><b>${cycles.personalYear}</b>Năm · ${escapeHtml(cycles.meanings.year)}</span><span><b>${cycles.personalMonth}</b>Tháng · ${escapeHtml(cycles.meanings.month)}</span><span><b>${cycles.personalDay}</b>Ngày · ${escapeHtml(cycles.meanings.day)}</span></div><details><summary>Xem công thức</summary><code>${escapeHtml(cycles.formula)}</code></details></article>` : ""}${nameResult ? `<article class="fortune-name-result" data-fortune-result><header><small>HỆ ${nameResult.system === "chaldean" ? "CHALDEAN" : "PYTHAGORAS"}</small><h3>Kết quả từ ${nameResult.letters.length} ký tự Latin hóa</h3></header><div><span><b>${nameResult.expression}</b>Biểu đạt</span><span><b>${nameResult.soul}</b>Nội tâm</span><span><b>${nameResult.personality}</b>Ấn tượng</span></div><details><summary>Xem ba công thức</summary><code>Biểu đạt: ${escapeHtml(nameResult.formulas.expression)}\nNội tâm: ${escapeHtml(nameResult.formulas.soul)}\nẤn tượng: ${escapeHtml(nameResult.formulas.personality)}</code></details></article>` : ""}${detail}</section>`;
  }

  function ichingLegacyMarkup(runtime) {
    const result = runtime.session.iching;
    const detail = result ? explanationMarkup(runtime, "Giải thích đầy đủ cấu trúc quẻ", [
      { label: "Seed và đồng xu", text: `Seed ${runtime.session.ichingSeed} tạo sáu lần gieo có thể tái tạo. Mỗi hào gồm ba giá trị: ${result.lines.map((line)=>`hào ${line.number} [${line.coins.join("+")}=${line.value}]`).join("; ")}.` },
      { label: "Quẻ chính", text: `${result.title}. ${result.reflection}` },
      { label: "Thượng quái", text: `${result.upper.symbol} ${result.upper.name} (${result.upper.nature}) mô tả lớp bên ngoài hoặc bối cảnh đang biểu hiện.` },
      { label: "Hạ quái", text: `${result.lower.symbol} ${result.lower.name} (${result.lower.nature}) mô tả nền hoặc động lực bên trong.` },
      { label: "Quẻ hỗ", text: `${result.nuclearTitle}. Quẻ hỗ được ghép từ các hào 2–4 và 3–5 để nhìn cấu trúc ở giữa, không phải một dự báo phụ.` },
      { label: "Hào động", text: result.changing.length ? `Các hào ${result.changing.join(", ")} đổi âm/dương. Đọc chúng như phần đang chuyển và cần kiểm chứng hệ quả.` : "Không có hào động trong lần gieo; ưu tiên quan sát tính ổn định thay vì ép tìm thay đổi." },
      { label: "Quẻ biến", text: result.changedTitle },
      { label: "Từng hào", text: result.lines.map((line)=>line.reflection).filter(Boolean).join(" ") || "Chi tiết hào dùng diễn giải HH nguyên bản." },
      { label: "Hành động", text: "Chuyển hình tượng thành một bước nhỏ, có thể đảo ngược và đặt thời điểm đánh giá lại." },
      { label: "Giới hạn", text: "Kết quả là mô phỏng ba đồng xu và diễn giải biểu tượng; không phải lời tiên tri hoặc chỉ thị phải làm theo." }
    ]) : "";
    return `${toolbarMarkup("Kinh Dịch 64 quẻ nâng cao", "Ba đồng xu, xác suất cỏ thi hoặc nhập sáu hào; hiển thị quẻ chính, hỗ, biến, đối và đảo với provenance.")}<section class="fortune-iching"><div class="fortune-calc-card"><header><i>☯</i><div><small>COINS · YARROW · MANUAL</small><h3>Đặt ý niệm rồi gieo quẻ</h3></div></header><label><span>Điều muốn suy ngẫm (không lưu)</span><textarea rows="3" maxlength="240" data-fortune-iching-question placeholder="Viết ngắn gọn điều bạn đang cân nhắc...">${escapeHtml(runtime.session.ichingQuestion||"")}</textarea></label><div class="fortune-inline-fields"><label><span>Phương pháp</span><select data-fortune-iching-mode><option value="coins"${runtime.session.ichingMode === "coins" ? " selected" : ""}>Ba đồng xu</option><option value="yarrow"${runtime.session.ichingMode === "yarrow" ? " selected" : ""}>Xác suất cỏ thi</option><option value="manual"${runtime.session.ichingMode === "manual" ? " selected" : ""}>Nhập 6 hào</option></select></label><label><span>Seed tái tạo</span><input type="text" maxlength="120" data-fortune-iching-seed value="${escapeHtml(runtime.session.ichingSeed||"")}" placeholder="Để trống để tạo mới"></label></div><div class="fortune-v4-inline-fields fortune-iching-manual">${[0,1,2,3,4,5].map((index) => `<label><span>Hào ${index+1}</span><select data-fortune-iching-manual><option value="6"${runtime.session.ichingManual?.[index] === 6 ? " selected" : ""}>6 · âm động</option><option value="7"${runtime.session.ichingManual?.[index] === 7 ? " selected" : ""}>7 · dương tĩnh</option><option value="8"${runtime.session.ichingManual?.[index] === 8 ? " selected" : ""}>8 · âm tĩnh</option><option value="9"${runtime.session.ichingManual?.[index] === 9 ? " selected" : ""}>9 · dương động</option></select></label>`).join("")}</div><button class="fortune-primary" type="button" data-fortune-iching-cast>Gieo 6 hào</button><small>Cùng seed + phương pháp sẽ tái tạo kết quả. Hào thủ công đọc từ dưới lên: hào 1 là thấp nhất.</small></div>${result ? `<article class="fortune-hexagram" data-fortune-result><div><div class="fortune-lines" aria-label="Sáu hào, đọc từ dưới lên">${[...result.lines].reverse().map((line) => `<div class="${line.yang ? "is-yang" : "is-yin"}${line.changing ? " is-changing" : ""}" aria-label="Hào ${line.number}: ${line.yang ? "dương" : "âm"}${line.changing ? ", động" : ""}"><span></span><span></span><b>${line.changing ? "○" : ""}</b></div>`).join("")}</div><ol class="fortune-coin-ledger">${result.lines.map((line)=>`<li><b>Hào ${line.number}</b><span>${line.coins?.length ? line.coins.map((coin)=>coin===3?"ngửa 3":"sấp 2").join(" · ") : "Nhập thủ công / cỏ thi"}</span><strong>${line.value} · ${line.yang?"dương":"âm"}${line.changing?" động":""}</strong></li>`).join("")}</ol></div><section><small>QUẺ CHÍNH · ĐỌC TỪ DƯỚI LÊN</small><h3>${escapeHtml(result.title)}</h3><p>${escapeHtml(result.reflection)}</p><p>${escapeHtml(result.question)}</p><div class="fortune-hexagram-triad"><span><small>QUẺ HỖ</small><strong>${escapeHtml(result.nuclearTitle)}</strong></span><span><small>QUẺ BIẾN</small><strong>${escapeHtml(result.changedTitle)}</strong></span></div><button type="button" data-fortune-save-current>Lưu kết quả</button></section></article>` : `<div class="fortune-empty fortune-empty--compact"><i>☯</i><strong>Chưa gieo quẻ</strong><p>Mỗi hào ba đồng xu có tổng 6–9; cỏ thi và nhập thủ công được ghi rõ trong provenance. Hệ thống không sao chép lời quẻ từ bản dịch thương mại.</p></div>`}${detail}</section>`;
  }

  function moonLegacyMarkup(runtime) {
    const result = runtime.session.moon; const sky = runtime.session.moonAstronomy; const illumination = sky?.ok ? sky.illuminatedPercent : result?.illumination;
    return `${toolbarMarkup("Chu kỳ Mặt Trăng", "Một engine dùng chung cho pha, góc pha, khoảng cách và timeline tháng; tab Chiêm nghiệm luôn tách khỏi dữ liệu thiên văn.")}<section class="fortune-moon"><div class="fortune-calc-card"><header><i>☾</i><div><small>MOON PHASE LAB</small><h3>Xem pha Mặt Trăng theo ngày</h3></div></header><label><span>Ngày cần xem</span><input type="date" min="1900-01-01" max="2100-12-31" data-fortune-moon-date value="${escapeHtml(runtime.session.moonDate || localDateKey())}"></label><button class="fortune-primary" type="button" data-fortune-moon-calc>Tính bằng engine thiên văn</button><button type="button" data-fortune-moon-today>Chọn hôm nay</button><p class="fortune-hint">Kết quả dùng vị trí, độ cao và timezone từ Hồ sơ phiên; mọi timestamp có bản UTC trong contract.</p></div>${result ? `<article class="fortune-moon-result" data-fortune-result style="--moon-light:${illumination}%"><div class="fortune-moon-disc"><i>${escapeHtml(result.symbol)}</i><span>${illumination}%</span></div><section><small>${escapeHtml(result.date)} · ${(sky?.waxing ?? result.waxing) ? "Đang sáng dần" : "Đang khuyết dần"}</small><h3>${escapeHtml(result.name)}</h3><div class="fortune-view-tabs"><span>THIÊN VĂN</span><span>CHIÊM NGHIỆM</span></div><dl><div><dt>Góc pha</dt><dd>${sky?.ok ? `${sky.phaseAngle}°` : `${Math.round(result.phase * 360)}° xấp xỉ`}</dd></div><div><dt>Chiếu sáng</dt><dd>${illumination}%</dd></div><div><dt>Tuổi trăng</dt><dd>${sky?.ok ? sky.ageDays : result.ageDays} ngày</dd></div><div><dt>Khoảng cách</dt><dd>${sky?.ok ? `${sky.distanceKm.toLocaleString("vi-VN")} km` : "Cần Astronomy Engine"}</dd></div></dl>${sky?.ok ? `<div class="fortune-moon-timeline">${sky.phaseTimeline.map((event) => `<div><i>${["●","◐","○","◑"][event.quarter] || "•"}</i><span>${escapeHtml(event.label)}</span><time>${escapeHtml(formatDateTime(event.time))}</time></div>`).join("")}</div>` : ""}<details><summary>Chiêm nghiệm · không phải tác động y tế</summary><p>${escapeHtml(result.reflection)}. Đây chỉ là câu dẫn viết nhật ký; ứng dụng không khẳng định pha trăng quyết định giấc ngủ, hành vi hay sức khỏe.</p></details><button type="button" data-fortune-save-current>Lưu phần tóm tắt</button></section></article>` : `<div class="fortune-empty fortune-empty--compact"><i>☾</i><strong>Chọn một ngày để bắt đầu</strong><p>Công cụ trả pha, góc pha, tuổi trăng, khoảng cách, chiều sáng/khuyết và bốn mốc pha của cả tháng.</p></div>`}</section>`;
  }

  function compatibilityLegacyMarkup(runtime) {
    const result = runtime.session.compatibility;
    return `${toolbarMarkup("Tương tác biểu tượng", "Đặt hai hồ sơ cạnh nhau để tạo câu hỏi giao tiếp; không chấm điểm hợp hay khắc, không dự đoán quan hệ.")}<section class="fortune-compatibility"><div class="fortune-calc-card fortune-calc-card--wide"><header><i>∞</i><div><small>TWO-PROFILE REFLECTION</small><h3>So sánh hai góc nhìn</h3></div></header><div class="fortune-profile-grid"><fieldset><legend>Người A</legend><label><span>Ngày sinh</span><input type="date" data-fortune-compare-a value="${escapeHtml(runtime.session.compareA || "")}"></label><label class="fortune-check"><input type="checkbox" data-fortune-compare-before-a ${runtime.session.compareBeforeA ? "checked" : ""}><span>Sinh trước Tết âm lịch</span></label></fieldset><fieldset><legend>Người B</legend><label><span>Ngày sinh</span><input type="date" data-fortune-compare-b value="${escapeHtml(runtime.session.compareB || "")}"></label><label class="fortune-check"><input type="checkbox" data-fortune-compare-before-b ${runtime.session.compareBeforeB ? "checked" : ""}><span>Sinh trước Tết âm lịch</span></label></fieldset></div><label><span>Bối cảnh</span><select data-fortune-compare-context><option value="relationship"${runtime.session.compareContext === "relationship" ? " selected" : ""}>Mối quan hệ</option><option value="friendship"${runtime.session.compareContext === "friendship" ? " selected" : ""}>Tình bạn</option><option value="team"${runtime.session.compareContext === "team" ? " selected" : ""}>Làm việc nhóm</option></select></label><button class="fortune-primary" type="button" data-fortune-compare>Tạo bản đối chiếu</button><p class="fortune-hint">Ngày sinh chỉ được xử lý trong phiên. Kết quả không phải đánh giá tâm lý hay mức độ tương hợp.</p></div>${result ? `<article class="fortune-compare-result" data-fortune-result><div class="fortune-profile-result"><span>A</span><strong>${escapeHtml(result.first.western.name)} · ${escapeHtml(result.first.chinese.animal)}</strong><small>Đường đời ${result.first.lifePath} · ${escapeHtml(result.first.western.element)}</small></div><div class="fortune-compare-axis">↔</div><div class="fortune-profile-result"><span>B</span><strong>${escapeHtml(result.second.western.name)} · ${escapeHtml(result.second.chinese.animal)}</strong><small>Đường đời ${result.second.lifePath} · ${escapeHtml(result.second.western.element)}</small></div><section><h3>Góc nhìn chung</h3><p>${escapeHtml(result.sharedFocus)}</p><p>${escapeHtml(result.cycleRelation)}</p><strong>Ba câu nên trao đổi trực tiếp</strong><ol>${result.prompts.map((prompt) => `<li>${escapeHtml(prompt)}</li>`).join("")}</ol><button type="button" data-fortune-save-current>Lưu phần tóm tắt không chứa ngày sinh</button></section></article>` : `<div class="fortune-empty fortune-empty--compact"><i>∞</i><strong>Không có điểm số “hợp nhau”</strong><p>Nhập hai ngày sinh để nhận chủ đề khác biệt và ba câu hỏi giao tiếp thực tế.</p></div>`}</section>`;
  }

  function calendarLegacyMarkup(runtime) {
    const entries = buildReflectionCalendar(runtime.profile.date, runtime.calendarAnchor, runtime.calendarMode, runtime.state.history, activeJournal(runtime));
    const anchor = parseLocalDate(runtime.calendarAnchor) || new Date();
    const title = new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(anchor);
    return `${toolbarMarkup("Lịch chiêm nghiệm", "Đặt pha Mặt Trăng, chu kỳ cá nhân, ghi chú và kết quả đã lưu trên cùng một lịch; không gán ngày tốt/xấu.")}<section class="fortune-calendar"><header><div class="fortune-calendar-modes">${[["month","Tháng"],["week","Tuần"],["timeline","Timeline"]].map(([id,label])=>`<button type="button" class="${runtime.calendarMode===id?"is-active":""}" data-fortune-calendar-mode="${id}">${label}</button>`).join("")}</div><div class="fortune-calendar-nav"><button type="button" data-fortune-calendar-move="-1">←</button><button type="button" data-fortune-calendar-today>Hôm nay</button><button type="button" data-fortune-calendar-move="1">→</button></div><strong>${escapeHtml(title)}</strong></header>${runtime.calendarMode !== "timeline" ? `<div class="fortune-calendar-weekdays">${["T2","T3","T4","T5","T6","T7","CN"].map((day)=>`<span>${day}</span>`).join("")}</div>` : ""}<div class="fortune-calendar-grid fortune-calendar-grid--${runtime.calendarMode}">${entries.map((entry)=>`<article class="${entry.today?"is-today ":""}${entry.currentMonth?"":"is-outside"}" data-fortune-calendar-date="${entry.date}"><header><time>${entry.day}</time><i title="${escapeHtml(entry.moon.name)}">${escapeHtml(entry.moon.symbol)}</i></header><small>${entry.moon.illumination}% sáng</small>${entry.cycles?`<span>Ngày cá nhân <b>${entry.cycles.personalDay}</b></span>`:"<span>Thêm hồ sơ để xem chu kỳ</span>"}<footer>${entry.saved?`<em>${entry.saved} kết quả</em>`:""}${entry.notes?`<em>${entry.notes} ghi chú</em>`:""}</footer></article>`).join("")}</div><details class="fortune-calendar-method"><summary>Ý nghĩa dữ liệu trên lịch</summary><p>Pha và độ chiếu sáng là xấp xỉ thiên văn. Chu kỳ cá nhân là phép cộng biểu tượng. Số kết quả/ghi chú là dữ liệu thực đã lưu trên thiết bị.</p></details></section>`;
  }

  function chartPlanetDetail(planet) {
    const roles = { Sun: "trọng tâm bản sắc và cách chủ động biểu đạt", Moon: "nhịp cảm xúc, nhu cầu an toàn và phản ứng quen thuộc", Mercury: "cách tiếp nhận, tổ chức và diễn đạt thông tin", Venus: "cách định giá, kết nối và cảm nhận sự hài hòa", Mars: "cách khởi động hành động, bảo vệ ranh giới và dùng năng lượng", Jupiter: "cách mở rộng góc nhìn, học hỏi và tìm ý nghĩa", Saturn: "cấu trúc, giới hạn, trách nhiệm và nhịp trưởng thành", Uranus: "đổi mới, tự do và phản ứng với khuôn mẫu", Neptune: "tưởng tượng, lý tưởng, sự mơ hồ và lòng cảm thông", Pluto: "quyền lực, chuyển hóa và điều bị đẩy xuống chiều sâu" };
    return { role: roles[planet.body] || "một chủ đề biểu tượng", sign: `Cung ${planet.sign.name} mô tả phong cách mà chủ đề này được diễn giải trong chiêm tinh.`, house: `Nhà ${planet.house} mô tả lĩnh vực trải nghiệm; vì dùng Equal House, ranh giới được tính theo các cung 30° từ ASC.`, caveat: "Đây là ngôn ngữ biểu tượng. Hãy kiểm chứng bằng hành vi cụ thể và không dùng nó để đóng khung tính cách." };
  }

  function chartMarkup(runtime) {
    const result = runtime.session.birthChart;
    const errors = runtime.session.birthChartErrors || [];
    const profileSummary = runtime.profile.date
      ? `${escapeHtml(runtime.profile.date)} · ${escapeHtml(runtime.profile.time || "chưa có giờ")} · ${escapeHtml(runtime.profile.place || "chưa có nơi")}`
      : "Chưa có hồ sơ phiên.";
    const errorMarkup = errors.length
      ? `<ul class="fortune-chart-errors">${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`
      : "";
    let resultMarkup = `<div class="fortune-empty fortune-empty--compact"><i>◎</i><strong>Chưa có bản đồ sao</strong><p>Điền đủ ngày, giờ, UTC, kinh độ và vĩ độ trong Hồ sơ phiên. Việc thiếu bất kỳ trường bắt buộc nào sẽ dừng phép tính.</p></div>`;
    if (result && result.ok) {
      const houseLines = result.houses.map((house) => `<i class="fortune-house-line" style="--house-angle:${(house.house - 1) * 30}deg"><b>${house.house}</b></i>`).join("");
      const planetPoints = result.planets.map((planet, index) => {
        const title = `${planet.name} ${planet.sign.name} ${planet.sign.degree}°`;
        return `<button type="button" class="fortune-planet-point" style="--planet-angle:${planet.longitude}deg;--planet-radius:${32 + (index % 3) * 7}%" data-fortune-chart-planet="${index}" title="${escapeHtml(title)}"><i>${escapeHtml(planet.symbol)}</i></button>`;
      }).join("");
      const planetRows = result.planets.map((planet, index) => `<button type="button" data-fortune-chart-planet="${index}"><i>${escapeHtml(planet.symbol)}</i><span><strong>${escapeHtml(planet.name)}</strong><small>${escapeHtml(planet.sign.name)} ${planet.sign.degree}° · Nhà ${planet.house}${planet.retrograde ? " · nghịch hành" : ""}</small></span></button>`).join("");
      const aspects = result.aspects.slice(0, 10).map((aspect) => `<span><b>${escapeHtml(aspect.symbol)}</b>${escapeHtml(aspect.first)} · ${escapeHtml(aspect.second)}<small>${aspect.separation}° · lệch ${aspect.exactness}°</small></span>`).join("") || "Không có góc hợp trong orb cấu hình.";
      const selected = result.planets[clamp(runtime.chartPlanetIndex, 0, result.planets.length - 1, 0)]; const selectedDetail = chartPlanetDetail(selected);
      resultMarkup = `<article class="fortune-chart-result" data-fortune-result><div class="fortune-chart-wheel" aria-label="Vòng tròn bản đồ sao Equal House">${houseLines}<span class="fortune-chart-center"><b>ASC</b>${escapeHtml(result.ascendant.symbol)} ${escapeHtml(result.ascendant.name)}<small>${result.ascendant.degree}°</small></span>${planetPoints}</div><section><header><span>CUNG MỌC</span><h3>${escapeHtml(result.ascendant.symbol)} ${escapeHtml(result.ascendant.name)} ${result.ascendant.degree}°</h3><small>${escapeHtml(result.instantUtc)} · Equal House</small></header><div class="fortune-planet-table">${planetRows}</div><aside class="fortune-planet-inspector"><header><i>${escapeHtml(selected.symbol)}</i><div><small>THÀNH PHẦN ĐANG CHỌN</small><strong>${escapeHtml(selected.name)} · ${escapeHtml(selected.sign.name)} ${selected.sign.degree}° · Nhà ${selected.house}</strong></div></header><p><b>Vai trò:</b> ${escapeHtml(selectedDetail.role)}.</p><p><b>Cung:</b> ${escapeHtml(selectedDetail.sign)}</p><p><b>Nhà:</b> ${escapeHtml(selectedDetail.house)}</p><p><b>Tọa độ:</b> kinh độ hoàng đạo ${selected.longitude}°, vĩ độ ${selected.latitude}°${selected.retrograde ? "; chuyển động biểu kiến nghịch hành" : ""}.</p><small>${escapeHtml(selectedDetail.caveat)}</small></aside><details open><summary>Góc hợp nổi bật</summary><div class="fortune-aspect-list">${aspects}</div></details><details><summary>Phương pháp và độ chính xác</summary><p>${escapeHtml(result.method.ephemeris)}</p><p>${escapeHtml(result.method.houses)}</p><p>${escapeHtml(result.method.interpretation)}</p><a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noopener noreferrer">Astronomy Engine · MIT</a></details><button type="button" data-fortune-save-current>Lưu tóm tắt không chứa dữ liệu sinh</button></section></article>`;
      resultMarkup += explanationMarkup(runtime, "Cách đọc bản đồ sao theo từng lớp", [
        { label: "Đầu vào và quy đổi", text: `Ngày, giờ địa phương và UTC${result.profile.timezone >= 0 ? "+" : ""}${result.profile.timezone} được đổi thành ${result.instantUtc}. Kinh độ ${result.profile.longitude}°, vĩ độ ${result.profile.latitude}° dùng để tính cung mọc.` },
        { label: "Dữ liệu thiên văn", text: `${result.planets.length} vị trí địa tâm được tính bằng Astronomy Engine. Đây là phần có thể đối chiếu bằng ephemeris khác.` },
        { label: "Cung mọc", text: `${result.ascendant.name} ${result.ascendant.degree}° là giao điểm chân trời phía đông và hoàng đạo ở thời điểm, địa điểm đã nhập. Sai giờ sinh sẽ làm kết quả này và toàn bộ nhà dịch chuyển.` },
        { label: "Hệ nhà", text: "Equal House chia vòng tròn thành 12 phần bằng nhau, mỗi phần 30° từ cung mọc. Một hệ nhà khác có thể đặt cùng hành tinh vào nhà khác; website không trộn hệ trong cùng kết quả." },
        { label: "Các hành tinh", text: result.planets.map((planet) => `${planet.name} ở ${planet.sign.name} ${planet.sign.degree}°, nhà ${planet.house}${planet.retrograde ? ", nghịch hành" : ""}`).join("; ") + "." },
        { label: "Nghịch hành", text: `Các thiên thể được đánh dấu nghịch hành: ${result.planets.filter((planet) => planet.retrograde).map((planet) => planet.name).join(", ") || "không có trong danh sách"}. Đây là chuyển động biểu kiến khi nhìn từ Trái Đất; ý nghĩa tâm lý là lớp chiêm tinh, không phải dữ kiện khoa học.` },
        { label: "Góc hợp", text: result.aspects.length ? result.aspects.slice(0, 12).map((aspect) => `${aspect.first} ${aspect.name} ${aspect.second}, orb ${aspect.exactness}°`).join("; ") + ". Orb nhỏ hơn nghĩa là gần góc lý tưởng hơn, không đồng nghĩa ảnh hưởng chắc chắn mạnh hơn trong đời thật." : "Không có góc hợp nào nằm trong orb cấu hình; điều này không có nghĩa bản đồ sao thiếu hoặc xấu." },
        { label: "Thứ tự đọc", text: "Bắt đầu từ dữ liệu đầu vào, sau đó Mặt Trời/Mặt Trăng/cung mọc, rồi hành tinh theo cung và nhà, cuối cùng mới đọc góc hợp. Không nên rút kết luận từ một vị trí đơn lẻ." },
        { label: "Kiểm chứng", text: "Chọn một mô tả thấy phù hợp, một mô tả không phù hợp và một mô tả chưa đủ dữ kiện; ghi ví dụ hành vi cụ thể thay vì chỉ cảm giác chung." },
        { label: "Giới hạn", text: result.method.interpretation + " Không dùng bản đồ sao để chẩn đoán, tuyển dụng, chấm điểm quan hệ hoặc quyết định thay người dùng." }
      ]);
    }
    return `${toolbarMarkup("Bản đồ sao cá nhân", "Vị trí hành tinh được tính từ ephemeris Astronomy Engine; cung, nhà và góc hợp là lớp diễn giải chiêm tinh.")}<section class="fortune-chart"><div class="fortune-calc-card"><header><i>◎</i><div><small>EPHEMERIS + EQUAL HOUSE</small><h3>Dữ liệu sinh bắt buộc</h3></div></header><p>${profileSummary}</p><button type="button" data-fortune-view="profile">Chỉnh hồ sơ</button><button class="fortune-primary" type="button" data-fortune-chart-calc>Tính bản đồ sao</button><small>Không có giờ sinh: không tính cung mọc và nhà. Không tự điền giờ 12:00.</small>${errorMarkup}</div>${resultMarkup}</section>`;
  }

  function methodsMarkup(runtime) {
    const registry = suiteV4()?.METHOD_REGISTRY || [];
    return `${toolbarMarkup("Trung tâm phương pháp", "Phân biệt dữ liệu thiên văn, phép tính biểu tượng và nội dung AI trước khi sử dụng kết quả.")}<section class="fortune-methods"><div class="fortune-method-filter"><input type="search" data-fortune-method-search value="${escapeHtml(runtime.methodQuery||"")}" placeholder="Tìm công cụ, thuật toán hoặc nguồn..."><span>${METHOD_CATALOG.length} phương pháp · ${registry.length} contract engine · Fortune Hub ${VERSION}</span></div><article class="fortune-v4-card"><header><span>METHOD REGISTRY</span><strong>Phiên bản, engine, pack và giới hạn</strong></header><div class="fortune-readiness-grid">${registry.map((method) => `<div data-status="ready"><i>✓</i><span>${escapeHtml(method.id)} · v${escapeHtml(method.version)}</span><small>${escapeHtml(method.engine)} · ${escapeHtml(method.pack)}<br>${escapeHtml((method.limitations || [])[0] || "Có giới hạn công khai")}</small></div>`).join("")}</div></article><div class="fortune-method-list">${METHOD_CATALOG.map((method)=>`<article data-fortune-method-item data-method-search="${escapeHtml(`${method.title} ${method.system} ${method.algorithm} ${method.source}`.toLocaleLowerCase("vi"))}"><header><span>${escapeHtml(method.version)}</span><h3>${escapeHtml(method.title)}</h3><b>${escapeHtml(method.nature)}</b></header><dl><div><dt>Hệ thống</dt><dd>${escapeHtml(method.system)}</dd></div><div><dt>Đầu vào</dt><dd>${escapeHtml(method.input)}</dd></div><div><dt>Thuật toán</dt><dd>${escapeHtml(method.algorithm)}</dd></div><div><dt>Độ chính xác kỹ thuật</dt><dd>${escapeHtml(method.precision)}</dd></div><div><dt>Nguồn</dt><dd>${escapeHtml(method.source)}</dd></div></dl></article>`).join("")}</div><p data-fortune-method-empty hidden>Không tìm thấy phương pháp phù hợp.</p></section>`;
  }

  function copilotMarkup(runtime) {
    const result = runtime.session.copilot;
    const sourceText = currentResultText(runtime);
    const selectedInput = runtime.session.copilotInput || (sourceText.startsWith("Chưa có") ? "" : sourceText);
    const mode = runtime.session.copilotMode || "easy";
    const factLock = buildCopilotFactLock(runtime, selectedInput);
    return `${toolbarMarkup("Reflection Copilot V3 · Fact Lock", "Gemini chỉ nhận đúng phần bạn chọn; mọi dữ kiện tính toán phải dẫn factId và qua validator phía server.")}<section class="fortune-copilot fortune-copilot-v2"><div class="fortune-calc-card"><header><i>AI</i><div><small>OPT-IN ONLY · FACT-LOCKED GEMINI</small><h3>Kiểm soát chính xác nội dung gửi</h3></div></header><div class="fortune-v4-two-col"><label><span>Chế độ</span><select data-fortune-copilot-mode><option value="easy"${mode==="easy"?" selected":""}>Giải thích dễ hiểu</option><option value="deep"${mode==="deep"?" selected":""}>Phân tích chuyên sâu</option><option value="compare"${mode==="compare"?" selected":""}>So sánh hai phương pháp</option><option value="consensus"${mode==="consensus"?" selected":""}>Đồng thuận & mâu thuẫn</option><option value="journal"${mode==="journal"?" selected":""}>Tạo câu hỏi nhật ký</option><option value="action"${mode==="action"?" selected":""}>Kế hoạch hành động nhỏ</option><option value="audit"${mode==="audit"?" selected":""}>Kiểm tra an toàn & bịa dữ kiện</option></select></label><label><span>Mức giải thích</span><select data-fortune-copilot-depth><option value="detailed"${runtime.session.copilotDepth!=="expert"?" selected":""}>Chi tiết, dễ hiểu</option><option value="expert"${runtime.session.copilotDepth==="expert"?" selected":""}>Chuyên sâu tối đa</option></select></label></div><label><span>Nội dung được phép gửi</span><textarea rows="10" maxlength="12000" data-fortune-copilot-input placeholder="Dán kết quả hoặc suy ngẫm...">${escapeHtml(selectedInput)}</textarea></label><details class="fortune-v4-card fortune-copilot-contract" open><summary>Xem trước hợp đồng dữ liệu</summary><dl><div><dt>Nguồn đang chọn</dt><dd>${escapeHtml(runtime.session.copilotSourceView || "Nội dung nhập tay")}</dd></div><div><dt>Ký tự dự kiến</dt><dd data-fortune-copilot-length>${selectedInput.length} / 12000</dd></div><div><dt>Dữ kiện đã khóa</dt><dd>${factLock.facts.length} factId · ${factLock.allowedEntities.length} entity</dd></div><div><dt>Digest nội dung</dt><dd><code>${escapeHtml(factLock.selectedTextDigest || "—")}</code></dd></div><div><dt>Tự động kèm hồ sơ</dt><dd>Không</dd></div><div><dt>Tự động đọc nhật ký</dt><dd>Không</dd></div><div><dt>Lưu bản rõ trên server</dt><dd>Không · backend redacted</dd></div></dl></details><div class="fortune-copilot-actions"><label><input type="checkbox" data-fortune-copilot-summary checked><span>Tóm tắt trung lập</span></label><label><input type="checkbox" data-fortune-copilot-components checked><span>Giải thích từng thành phần</span></label><label><input type="checkbox" data-fortune-copilot-links checked><span>Liên kết và mâu thuẫn</span></label><label><input type="checkbox" data-fortune-copilot-questions checked><span>Câu hỏi suy ngẫm</span></label><label><input type="checkbox" data-fortune-copilot-actions checked><span>3 hành động nhỏ</span></label><label><input type="checkbox" data-fortune-copilot-safety checked><span>Audit câu tuyệt đối và dữ kiện bịa</span></label></div><label class="fortune-profile-consent"><input type="checkbox" data-fortune-copilot-consent><span><strong>Tôi đồng ý gửi đúng nội dung trong ô tới Gemini API</strong><small>Hãy xóa phần bạn không muốn gửi. Nút chỉ hoạt động sau khi có đồng ý rõ ràng.</small></span></label><button class="fortune-primary" type="button" data-fortune-copilot-run ${runtime.copilotBusy?"disabled":""}>${runtime.copilotBusy?"Gemini đang phân tích nhiều tầng…":"Phân tích có kiểm chứng"}</button><small class="fortune-ai-privacy">Khóa Gemini nằm trên Vercel. Input, fact lock và output Xem bói đều được redacted khỏi log hành động.</small></div>${result?`<article class="fortune-copilot-result" data-fortune-result><header><span>NỘI DUNG DO AI TẠO · ${escapeHtml(result.mode || mode)}</span><h3>Reflection Copilot · bản phân tích đã qua Fact Validator</h3><small>${escapeHtml(result.model||"Gemini")} · ${result.factValidation?.ok ? `${result.factValidation.citedFactCount} factId hợp lệ · ` : ""}${result.latencyMs?`${result.latencyMs} ms · `:""}hãy tự kiểm tra điều quan trọng</small></header><div>${markdownMarkupSafe(result.output)}</div><footer><button type="button" data-fortune-copy="${escapeHtml(result.output)}">Sao chép</button><button type="button" data-fortune-copilot-again>Phân tích lại</button></footer></article>`:`<div class="fortune-empty fortune-empty--compact"><i>AI</i><strong>AI chỉ chạy khi bạn đồng ý</strong><p>Gemini giải thích dữ liệu đã có, viện dẫn factId, kiểm tra điều không thể kết luận và đề xuất hành động nhỏ. Nếu API hết quota, kết quả cục bộ vẫn giữ nguyên.</p></div>`}</section>`;
  }

  function journalMoodMarkup(journal) {
    const items = journal.filter((item) => Number(item.moodBefore) && Number(item.moodAfter)).slice(0, 14).reverse();
    if (!items.length) return `<div class="fortune-journal-mood-empty">Chưa đủ dữ liệu cảm xúc để vẽ xu hướng.</div>`;
    return `<div class="fortune-mood-chart" aria-label="Xu hướng cảm xúc trước và sau phiên">${items.map((item, index) => `<span style="--before:${item.moodBefore};--after:${item.moodAfter}" title="${escapeHtml(`${formatDateTime(item.createdAt)}: ${item.moodBefore} → ${item.moodAfter}`)}"><i></i><b></b><small>${index + 1}</small></span>`).join("")}</div><div class="fortune-mood-legend"><span><i></i>Trước phiên</span><span><b></b>Sau phiên</span></div>`;
  }

  function journalMarkup(runtime) {
    const journal = activeJournal(runtime) || [];
    const locked = Boolean(runtime.state.journalVault && !runtime.journalKey);
    const tags = [...new Set(journal.map((item) => item.tag))];
    const items = journal.map((item) => `<article data-fortune-journal-item data-journal-tag="${escapeHtml(item.tag)}" data-journal-search="${escapeHtml(`${item.tag} ${item.text}`.toLocaleLowerCase("vi"))}"><header><span>${escapeHtml(item.tag)}</span><time>${escapeHtml(formatDateTime(item.createdAt))}</time><button type="button" data-fortune-journal-delete="${escapeHtml(item.id)}" aria-label="Xóa ghi chú">×</button></header><p>${escapeHtml(item.text)}</p><footer><span>Cảm xúc ${item.moodBefore || 3} → ${item.moodAfter || 3}</span><small>${escapeHtml(item.sessionType || "manual")}</small></footer></article>`).join("");
    return `${toolbarMarkup("Nhật ký thông minh local-first", "Tìm kiếm, theo dõi cảm xúc, khóa AES-GCM và xuất dữ liệu; AI không tự đọc nhật ký.")}<section class="fortune-journal-security"><div><span>${locked ? "ĐANG KHÓA" : runtime.state.journalVault ? "ĐÃ MỞ KHÓA" : "CHƯA MÃ HÓA"}</span><strong>${runtime.state.journalVault ? "AES-GCM 256 · PBKDF2" : "Dữ liệu local theo tài khoản trên thiết bị"}</strong><small>${locked ? "Nhập PIN để mở; PIN không được lưu và không thể khôi phục." : "Nội dung không tự gửi lên máy chủ hoặc HH AI."}</small></div><label><span>PIN cục bộ</span><input type="password" minlength="4" maxlength="64" autocomplete="off" data-fortune-journal-pin placeholder="Ít nhất 4 ký tự"></label>${locked ? `<button class="fortune-primary" type="button" data-fortune-journal-unlock>Mở khóa</button>` : runtime.state.journalVault ? `<button type="button" data-fortune-journal-lock-now>Khóa ngay</button>` : `<button type="button" data-fortune-journal-enable-lock>Bật mã hóa</button>`}</section><section class="fortune-journal"><div><form data-fortune-journal-form><label><span>Điều bạn muốn ghi lại</span><textarea rows="5" maxlength="4000" data-fortune-journal-text placeholder="Hôm nay tôi nhận ra..." ${locked ? "disabled" : ""}></textarea></label><div><label><span>Nhãn</span><select data-fortune-journal-tag><option>Suy ngẫm</option><option>Công việc</option><option>Mối quan hệ</option><option>Học tập</option><option>Cảm xúc</option><option>Ý tưởng</option></select></label><button class="fortune-primary" type="submit" ${locked ? "disabled" : ""}>＋ Lưu ghi chú</button></div><div class="fortune-journal-moods"><label><span>Cảm xúc trước</span><input type="range" min="1" max="5" value="3" data-fortune-journal-mood-before></label><label><span>Cảm xúc sau</span><input type="range" min="1" max="5" value="3" data-fortune-journal-mood-after></label></div><small data-fortune-journal-count>0 / 4000 ký tự</small></form><article class="fortune-journal-analytics"><header><span>XU HƯỚNG 14 GHI CHÚ GẦN NHẤT</span><strong>Trước và sau mỗi phiên</strong></header>${journalMoodMarkup(journal)}</article></div><div><div class="fortune-journal-tools"><input type="search" data-fortune-journal-search placeholder="Tìm toàn văn..." value="${escapeHtml(runtime.journalQuery || "")}"><select data-fortune-journal-filter><option value="all">Tất cả nhãn</option>${tags.map((tag) => `<option value="${escapeHtml(tag)}"${runtime.journalTag===tag?" selected":""}>${escapeHtml(tag)}</option>`).join("")}</select><button type="button" data-fortune-journal-export="json">JSON</button><button type="button" data-fortune-journal-export="txt">TXT</button><button type="button" data-fortune-journal-export="pdf">PDF</button></div><div class="fortune-journal-list" data-fortune-journal-list>${items || `<div class="fortune-empty fortune-empty--compact"><i>✎</i><strong>${locked ? "Nhật ký đang khóa" : "Nhật ký đang trống"}</strong><p>${locked ? "Mở khóa bằng PIN để đọc ghi chú đã mã hóa." : "Ghi lại điều hữu ích thay vì cố ghi nhớ mọi kết quả."}</p></div>`}</div><p data-fortune-journal-empty hidden>Không tìm thấy ghi chú phù hợp.</p>${journal.length ? `<button class="fortune-danger" type="button" data-fortune-clear-journal>Xóa toàn bộ nhật ký</button>` : ""}</div></section>`;
  }

  function historyMarkup(runtime) {
    const typeLabels = { daily: "Hôm nay", session: "Phiên tổng hợp", tarot: "Tarot", zodiac: "Cung", chinese: "Con giáp", numerology: "Thần số", iching: "Kinh Dịch", moon: "Mặt Trăng", sky: "Moon & Sky", eastern: "Phương Đông", symbols: "Biểu tượng", chart: "Bản đồ sao", compatibility: "Tương tác" };
    const options = [...new Set(runtime.state.history.map((item) => item.type))];
    return `${toolbarMarkup("Lịch sử kết quả", "Chỉ lưu phần tóm tắt kết quả; câu hỏi, tên và ngày sinh không được lưu.")}<section class="fortune-history"><div class="fortune-history-tools"><span>${runtime.state.history.length} / ${MAX_HISTORY} kết quả</span><div><button type="button" data-fortune-export-history="json">Xuất JSON</button><button type="button" data-fortune-export-history="txt">Xuất TXT</button><button type="button" data-fortune-reflection-pack>Reflection Pack ZIP</button>${runtime.state.history.length ? `<button class="fortune-danger" type="button" data-fortune-clear-history>Xóa tất cả</button>` : ""}</div></div>${runtime.state.history.length ? `<div class="fortune-history-filter"><label><span>Tìm kết quả</span><input type="search" data-fortune-history-search value="${escapeHtml(runtime.historyQuery || "")}" placeholder="Tên hoặc nội dung..."></label><label><span>Loại</span><select data-fortune-history-type><option value="all">Tất cả</option>${options.map((type) => `<option value="${escapeHtml(type)}"${runtime.historyType === type ? " selected" : ""}>${escapeHtml(typeLabels[type] || type)}</option>`).join("")}</select></label></div>` : ""}<div class="fortune-history-list" data-fortune-history-list>${runtime.state.history.length ? runtime.state.history.map((item) => `<article data-fortune-history-item data-history-type="${escapeHtml(item.type)}" data-history-search="${escapeHtml(`${item.title} ${item.summary}`.toLocaleLowerCase("vi"))}"><i>${escapeHtml(typeLabels[item.type] || item.type)}</i><div><small>${escapeHtml(formatDateTime(item.createdAt))}</small><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p></div><button type="button" data-fortune-history-delete="${escapeHtml(item.id)}" aria-label="Xóa kết quả">×</button></article>`).join("") : `<div class="fortune-empty"><i>◷</i><strong>Chưa có kết quả đã lưu</strong><p>Kết quả chỉ được thêm khi bạn chủ động bấm lưu hoặc hoàn thành một phép tính.</p><button type="button" data-fortune-view="today">Về Hôm nay</button></div>`}</div><p class="fortune-history-empty-filter" data-fortune-history-empty hidden>Không có kết quả phù hợp bộ lọc.</p></section>`;
  }

  function legacyProvenanceMarkup(runtime) {
    const v4 = suiteV4(); const profile = runtime.profile || {};
    const records = [runtime.session.astrologyV4?.provenance, runtime.session.sky?.provenance, runtime.session.eastern?.provenance, runtime.session.tarot78?.provenance, runtime.session.ichingAdvanced?.provenance, runtime.session.numerologyV4?.provenance].filter(Boolean);
    const readiness = v4?.READINESS || [];
    const profileTitle = profile.date ? escapeHtml(profile.date) + " · " + escapeHtml(profile.time || "chưa có giờ") : "Chưa có hồ sơ phiên";
    const readinessMarkup = readiness.map((item) => "<div data-status=\"" + escapeHtml(item.status) + "\"><i>" + (item.status === "ready" ? "✓" : item.status === "review" ? "…" : "—") + "</i><span>" + escapeHtml(item.label) + "</span><small>" + (item.status === "ready" ? "Sẵn sàng" : item.status === "review" ? "Cần kiểm duyệt phương pháp" : "Đã tắt vì rủi ro suy đoán") + "</small></div>").join("");
    const recordsMarkup = records.length ? "<div class=\"fortune-provenance-list\">" + records.map((record) => "<details><summary>" + escapeHtml(record.kind) + " · " + escapeHtml(record.computedAt) + "</summary><pre>" + escapeHtml(JSON.stringify(record, null, 2)) + "</pre></details>").join("") + "</div>" : "<p>Hãy chạy một công cụ để tạo bản ghi provenance có thể tái tạo.</p>";
    return toolbarMarkup("Accuracy & Provenance Center", "Kiểm tra đầu vào, engine, phiên bản dữ liệu và ranh giới giữa tính toán, biểu tượng và AI.") + "<section class=\"fortune-v4-workspace fortune-provenance-center\"><article class=\"fortune-v4-hero\"><span>TRUTHFUL OUTPUT</span><h3>Không có “độ chính xác xem bói” chung</h3><p>Hệ thống chỉ cam kết tái tạo phép tính khi đủ dữ liệu và seed. Diễn giải biểu tượng không phải dự báo khoa học.</p><div class=\"fortune-v4-badges\"><b data-kind=\"calculation\">TÍNH TOÁN · engine/version</b><b data-kind=\"symbolic\">BIỂU TƯỢNG · trường phái</b><b data-kind=\"ai\">AI · người dùng bật</b></div></article><div class=\"fortune-v4-two-col\"><article class=\"fortune-v4-card\"><header><span>HỒ SƠ ĐANG DÙNG</span><strong>" + profileTitle + "</strong></header><dl><div><dt>Địa điểm</dt><dd>" + escapeHtml(profile.place || "Chưa nhập") + "</dd></div><div><dt>IANA</dt><dd><code>" + escapeHtml(profile.timezoneId || "Asia/Ho_Chi_Minh") + "</code></dd></div><div><dt>Tọa độ</dt><dd>" + Number(profile.latitude).toFixed(4) + ", " + Number(profile.longitude).toFixed(4) + " · " + (profile.elevation || 0) + "m</dd></div><div><dt>Hoàng đạo / nhà</dt><dd>" + escapeHtml(profile.zodiacMode || "tropical") + " · " + escapeHtml(profile.houseSystem || "equal") + "</dd></div></dl><button type=\"button\" data-fortune-view=\"profile\">Chỉnh hồ sơ</button></article><article class=\"fortune-v4-card\"><header><span>ENGINE</span><strong>Astronomy Engine 2.1.19</strong></header><p>VSOP87/NOVAS, vị trí hành tinh và sự kiện bầu trời. Kết quả Moon & Sky được đối chiếu theo định nghĩa pha USNO khi có dữ liệu.</p><ul><li>Không dùng UTC offset để thay thế timezone IANA.</li><li>Không tự đoán cung mọc khi thiếu giờ sinh.</li><li>Không gọi chức năng “sẵn sàng” nếu engine trả lỗi.</li></ul><button type=\"button\" data-fortune-view=\"methods\">Xem phương pháp</button></article></div><article class=\"fortune-v4-card\"><header><span>READINESS MATRIX</span><strong>" + readiness.length + " engine / trạng thái thật</strong></header><div class=\"fortune-readiness-grid\">" + readinessMarkup + "</div></article><article class=\"fortune-v4-card\"><header><span>RECORDS GẦN NHẤT</span><strong>" + (records.length ? records.length + " provenance record" : "Chưa có bản ghi") + "</strong></header>" + recordsMarkup + "</article></section>";
  }

  function provenanceMarkup(runtime) {
    const lab = accuracyLab(); const v4 = suiteV4(); const profile = runtime.profile || {}; const quality = lab?.assessInputQuality?.(profile, { crossChecked: Boolean(runtime.session.accuracyReport?.ok), aiGenerated: Boolean(runtime.session.copilot) }) || { statuses: {}, issues: [], warnings: [] };
    const records = [runtime.session.astrologyV4?.provenance, runtime.session.sky?.provenance, runtime.session.eastern?.provenance, runtime.session.tarot78?.provenance, runtime.session.ichingAdvanced?.provenance, runtime.session.numerologyV4?.provenance].filter(Boolean); const certificate = runtime.session.calculationCertificate; const verification = certificate && runtime.session.astrologyV4 ? lab?.verifyCalculationCertificate?.(certificate, runtime.session.astrologyV4) : null; const report = runtime.session.accuracyReport;
    const statuses = [["Đầu vào", quality.statuses.input], ["Múi giờ", quality.statuses.timezone], ["Phép tính", quality.statuses.calculation], ["Diễn giải", quality.statuses.interpretation]];
    const recordMarkup = records.length ? records.map((record) => `<details><summary>${escapeHtml(record.kind)} · ${escapeHtml(record.computedAt)}</summary><pre>${escapeHtml(JSON.stringify(record, null, 2))}</pre></details>`).join("") : "<p>Chạy một công cụ để tạo provenance record.</p>";
    return `${toolbarMarkup("Accuracy Laboratory", "Kiểm tra dữ liệu đầu vào, DST, khả năng tái tạo, fixture toàn cầu và ranh giới giữa tính toán, biểu tượng, AI.")}<section class="fortune-v4-workspace fortune-accuracy-lab"><article class="fortune-v4-hero"><span>REPRODUCIBILITY, NOT PREDICTIVE TRUTH</span><h3>Không dùng phần trăm “xem bói chính xác”</h3><p>Bốn trạng thái bên dưới là độc lập. Chúng mô tả chất lượng kỹ thuật và nguồn dữ liệu, không chứng minh nội dung biểu tượng có khả năng dự báo.</p><div class="fortune-v4-badges">${statuses.map(([label,status]) => `<b data-kind="${status?.id === "crossChecked" || status?.id === "verified" || status?.id === "complete" ? "calculation" : "symbolic"}">${label} · ${escapeHtml(status?.label || "Thiếu")}</b>`).join("")}</div></article><div class="fortune-accuracy-columns"><article class="fortune-v4-card"><header><span>1 · INPUT & METHOD</span><strong>${escapeHtml(profile.date || "Chưa có hồ sơ")}</strong></header><dl class="fortune-v4-contract"><div><dt>Giờ / nguồn</dt><dd>${escapeHtml(profile.birthTimeAccuracy || "unknown")} · ${escapeHtml(profile.birthTimeSource || "unknown")}</dd></div><div><dt>Sai số</dt><dd>±${quality.uncertaintyMinutes || profile.birthTimeUncertaintyMinutes || 15} phút</dd></div><div><dt>Địa điểm</dt><dd>${escapeHtml(profile.place || "Chưa nhập")} · ${escapeHtml(profile.locationConfidence || "selected")}</dd></div><div><dt>Timezone</dt><dd>${escapeHtml(profile.timezoneId || "—")}</dd></div><div><dt>Hệ lịch</dt><dd>${escapeHtml(profile.calendarSystem || "gregorian")}</dd></div><div><dt>Hoàng đạo / nhà</dt><dd>${escapeHtml(profile.zodiacMode || "tropical")} · ${escapeHtml(profile.houseSystem || "equal")}</dd></div></dl>${[...(quality.issues || []), ...(quality.warnings || [])].length ? `<ul class="fortune-quality-issues">${[...(quality.issues || []), ...(quality.warnings || [])].map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p class="fortune-quality-ok">Không phát hiện xung đột đầu vào.</p>`}<button type="button" data-fortune-view="profile">Chỉnh hồ sơ</button></article><article class="fortune-v4-card"><header><span>2 · VALIDATION FIXTURES</span><strong>${report ? `${report.fixtureCount} fixture` : "Chưa chạy trong phiên"}</strong></header><div class="fortune-lab-meter" data-status="${report?.ok ? "pass" : report ? "fail" : "idle"}"><b>${report?.ok ? "PASS" : report ? "FAIL" : "READY"}</b><span>${report ? `${report.timezoneChecks} timezone · ${report.astronomyChecks} astronomy` : "768 ca gồm DST, ngày nhuận, đường đổi ngày, vĩ độ cao và trước 1970"}</span></div><p>Đối chiếu runtime nội bộ không được gọi là JPL/USNO validation. Baseline ngoài vẫn hiển thị rõ trạng thái yêu cầu.</p>${report ? `<pre>${escapeHtml(JSON.stringify({ failures: report.failures, references: report.references, generatedAt: report.generatedAt }, null, 2))}</pre>` : ""}<div class="fortune-result-actions"><button class="fortune-primary" type="button" data-fortune-accuracy-run>Chạy 768 fixture</button>${report ? `<button type="button" data-fortune-accuracy-report>Xuất report</button>` : ""}</div></article><article class="fortune-v4-card"><header><span>3 · CALCULATION CERTIFICATE</span><strong>${certificate ? (verification?.ok ? "Đã xác minh" : "Không khớp") : "Chưa có"}</strong></header>${certificate ? `<dl class="fortune-v4-contract"><div><dt>Schema</dt><dd>${escapeHtml(certificate.schema)}</dd></div><div><dt>UTC</dt><dd>${escapeHtml(certificate.instantUtc || "—")}</dd></div><div><dt>Engine</dt><dd>${escapeHtml(certificate.engine)} ${escapeHtml(certificate.engineVersion)}</dd></div><div><dt>tzdb</dt><dd>${escapeHtml(certificate.tzdbVersion)} · ${escapeHtml(certificate.tzdbRuntimeVersion)}</dd></div><div><dt>SHA-256</dt><dd><code>${escapeHtml(certificate.sha256)}</code></dd></div><div><dt>Result digest</dt><dd><code>${escapeHtml(certificate.resultDigest)}</code></dd></div></dl><div class="fortune-result-actions"><button type="button" data-fortune-certificate-verify>Kiểm tra lại</button><button type="button" data-fortune-certificate-download>Tải JSON</button></div>` : `<p>Chạy Astrology Studio để tạo certificate chứa đầu vào chuẩn hóa, UTC, engine/version, method, orb, seed và SHA-256.</p><button type="button" data-fortune-view="chart">Mở Astrology Studio</button>`}</article></div><article class="fortune-v4-card"><header><span>PROVENANCE RECORDS</span><strong>${records.length} bản ghi trong phiên</strong></header><div class="fortune-provenance-list">${recordMarkup}</div></article><article class="fortune-v4-card"><header><span>METHOD READINESS</span><strong>${v4?.READINESS?.length || 0} engine</strong></header><div class="fortune-readiness-grid">${(v4?.READINESS || []).map((item) => `<div data-status="${escapeHtml(item.status)}"><i>${item.status === "ready" ? "✓" : item.status === "review" ? "…" : "—"}</i><span>${escapeHtml(item.label)}</span><small>${item.status === "ready" ? "Sẵn sàng" : item.status === "review" ? "Cần kiểm duyệt" : "Không suy đoán"}</small></div>`).join("")}</div></article></section>`;
  }

  function astrologyV4Markup(runtime) {
    const result = runtime.session.astrologyV4; const mode = runtime.session.astrologyMode || "natal"; const profile = runtime.profile || {};
    const modeOptions = [["natal", "Natal / không biết giờ"], ["transit", "Transit tại một thời điểm"], ["timeline", "Transit Timeline"], ["method-compare", "So sánh Tropical/Sidereal & hệ nhà"], ["birth-time-range", "Birth-time range ±15/30/60 phút"], ["progression", "Secondary Progression + Solar Arc"], ["solar-return", "Solar Return"], ["lunar-return", "Lunar Return"], ["synastry", "Synastry hai hồ sơ"], ["composite", "Composite riêng"], ["davison", "Davison riêng"], ["relocation", "Relocation Chart"], ["astrocartography", "Astrocartography"]];
    const modes = modeOptions.map(([id, label]) => `<option value="${id}"${mode === id ? " selected" : ""}>${label}</option>`).join("");
    const planets = result?.planets || result?.transitPlanets || result?.progressed?.planets || result?.chart?.planets || result?.solarArcPlanets || [];
    const aspects = result?.aspects || result?.secondaryAspects || result?.solarArcAspects || result?.chart?.aspects || [];
    const distributionsValue = result?.distributions || result?.progressed?.distributions || result?.chart?.distributions || {};
    let body = "";
    if (result?.ok && mode === "astrocartography") body = `<p>${escapeHtml(result.note || "")}</p><div class="fortune-v4-table">${(result.lines || []).map((line) => `<div><span>${line.symbol} ${escapeHtml(line.name)}</span><small>MC ${line.mcLongitude.toFixed(2)}° · IC ${line.icLongitude.toFixed(2)}° · ASC ${line.asc.length} điểm</small></div>`).join("")}</div>`;
    else if (result?.ok && mode === "timeline") body = `<p>${escapeHtml(result.note || "")}</p><div class="fortune-v4-table">${(result.events || []).slice(0, 120).map((item) => `<div><span>${escapeHtml(item.label)}</span><small>${escapeHtml(item.type)} · ${escapeHtml(item.instantUtc)}</small></div>`).join("") || "<p>Không phát hiện sự kiện trong cửa sổ quét.</p>"}</div>`;
    else if (result?.ok && mode === "method-compare") body = `<p>${escapeHtml(result.note || "")}</p><div class="fortune-method-comparison">${(result.combinations || []).map((item) => `<article><span>${escapeHtml(item.zodiacMode)} · ${escapeHtml(item.houseSystem)}</span><strong>${item.chart.ok ? `${escapeHtml(item.chart.planets?.[0]?.sign?.name || "—")} · ${escapeHtml(item.chart.ascendant?.name || "không ASC")}` : "Lỗi"}</strong><small>${escapeHtml(item.chart.method?.houses || item.chart.errors?.[0] || "")}</small></article>`).join("")}</div>`;
    else if (result?.ok && mode === "birth-time-range") body = `<p>UTC ${escapeHtml(result.rangeUtc.from)} → ${escapeHtml(result.rangeUtc.to)}</p><div class="fortune-v4-table"><div><span>ASC</span><small>${escapeHtml(result.ascendantRange.from.name)} ${result.ascendantRange.from.degree}° → ${escapeHtml(result.ascendantRange.to.name)} ${result.ascendantRange.to.degree}°</small></div><div><span>MC</span><small>${escapeHtml(result.midheavenRange.from.name)} ${result.midheavenRange.from.degree}° → ${escapeHtml(result.midheavenRange.to.name)} ${result.midheavenRange.to.degree}°</small></div>${result.planetChanges.map((item) => `<div><span>${escapeHtml(item.name)}</span><small>Nhà ${item.beforeHouse} → ${item.centerHouse} → ${item.afterHouse}${item.houseChanges ? " · thay đổi" : ""}</small></div>`).join("")}</div>`;
    else if (result?.ok && ["synastry", "composite", "davison"].includes(mode)) body = `<p>${mode === "synastry" ? `${aspects.length} góc hợp chéo; Composite và Davison được tính riêng, không chấm điểm hợp/khắc.` : escapeHtml(result.method || "Phép tính riêng, không trộn phương pháp.")}</p><div class="fortune-v4-table">${(mode === "synastry" ? aspects : result.aspects || []).slice(0, 32).map((aspect) => `<div><span>${escapeHtml(aspect.first)} ${aspect.symbol} ${escapeHtml(aspect.second)}</span><small>${aspect.separation.toFixed(2)}° · orb ${aspect.orb}° · lệch ${aspect.exactness.toFixed(2)}° · ${escapeHtml(aspect.phase || "")}</small></div>`).join("")}</div>`;
    else if (result?.ok) body = `<div class="fortune-planet-grid">${planets.map((planet) => `<button type="button" data-fortune-planet-detail="${escapeHtml(planet.body)}"><i>${planet.symbol}</i><span>${escapeHtml(planet.name)}</span><b>${escapeHtml(planet.sign.name)} ${planet.sign.degree.toFixed(1)}°</b><small>${planet.house ? `Nhà ${planet.house}` : result.mode === "untimed" ? "Không tính nhà" : ""}${planet.direction ? ` · ${planet.direction}` : planet.retrograde ? " · R" : ""}</small></button>`).join("")}</div>${result.limitations?.length ? `<ul class="fortune-quality-issues">${result.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}<div class="fortune-v4-two-col"><section><header><span>PHÂN BỐ</span></header><pre>${escapeHtml(JSON.stringify(distributionsValue, null, 2))}</pre></section><section><header><span>GÓC HỢP</span></header><div class="fortune-v4-table">${aspects.slice(0, 20).map((aspect) => `<div><span>${escapeHtml(aspect.first)} ${aspect.symbol} ${escapeHtml(aspect.second)}</span><small>${aspect.separation.toFixed(2)}° · orb ${aspect.orb}° · ${escapeHtml(aspect.phase || "")}${aspect.hoursToExact ? ` · ~${aspect.hoursToExact} giờ tới exact` : ""}</small></div>`).join("") || "<p>Không có góc hợp trong orb đã chọn.</p>"}</div></section></div>`;
    const selectedPlanet = planets.find((planet) => planet.body === runtime.session.astrologyPlanet);
    if (selectedPlanet) body += `<aside class="fortune-planet-inspector"><header><i>${selectedPlanet.symbol}</i><div><small>PLANET INSPECTOR</small><strong>${escapeHtml(selectedPlanet.name)} · ${escapeHtml(selectedPlanet.sign.name)} ${selectedPlanet.sign.degree.toFixed(2)}°</strong></div></header><p>Kinh độ ${Number(selectedPlanet.longitude).toFixed(5)}°${selectedPlanet.house ? ` · nhà ${selectedPlanet.house}` : " · không tính nhà"} · tốc độ ${Number(selectedPlanet.speedDegreesPerDay || 0).toFixed(5)}°/ngày · ${escapeHtml(selectedPlanet.direction || (selectedPlanet.retrograde ? "retrograde" : "direct"))}${selectedPlanet.solarCondition ? ` · ${escapeHtml(selectedPlanet.solarCondition.label)} (${selectedPlanet.solarCondition.distance}° từ Mặt Trời)` : ""}.</p><small>Vị trí và tốc độ là kết quả tính toán; cung, nhà và điều kiện Mặt Trời là lớp chiêm tinh biểu tượng với orb công khai.</small></aside>`;
    let output = result?.ok ? `<article class="fortune-v4-card"><header><span>${escapeHtml(mode.toUpperCase())}</span><strong>${escapeHtml(result.targetUtc || result.instantUtc || result.returnUtc || result.progressedInstantUtc || "Đã tính")}</strong><div class="fortune-result-actions"><button type="button" data-fortune-astrology-export="json">JSON</button><button type="button" data-fortune-astrology-export="svg">SVG</button><button type="button" data-fortune-astrology-export="png">PNG</button><button type="button" data-fortune-astrology-export="pdf">PDF</button></div></header>${body}<div class="fortune-v4-output-tags"><b>TÍNH TOÁN</b><b>BIỂU TƯỢNG</b></div></article>` : `<div class="fortune-empty fortune-empty--compact"><i>◎</i><strong>Chưa có kết quả Astrology Studio</strong><p>${escapeHtml(result?.errors?.[0] || "Chạy engine sau khi hồ sơ có ngày, giờ, timezone IANA, tọa độ và phương pháp rõ ràng.")}</p></div>`;
    if (result?.ok) output = output.replace("</article>", "<div class=\"fortune-result-actions\"><button type=\"button\" data-fortune-save-current>Lưu tóm tắt</button><button type=\"button\" data-fortune-copy-result>Sao chép</button></div></article>");
    return toolbarMarkup("Astrology Studio", "Natal, transit, progression, return, synastry, relocation và astrocartography; không tự đoán đầu vào thiếu.") + "<section class=\"fortune-v4-workspace fortune-astrology-studio\"><div class=\"fortune-v4-two-col\"><article class=\"fortune-v4-card fortune-v4-form\"><header><span>1 · METHOD</span><strong>Engine thật + provenance</strong></header><label><span>Chế độ</span><select data-fortune-astrology-mode>" + modes + "</select></label><label><span>Ngày đích / transit</span><input type=\"date\" data-fortune-astrology-target value=\"" + escapeHtml(runtime.session.astrologyTarget || localDateKey()) + "\"></label><label><span>Vị trí relocation (tùy chọn)</span><input type=\"text\" data-fortune-astrology-place placeholder=\"Tên địa điểm\"><input type=\"number\" step=\"0.0001\" data-fortune-astrology-latitude placeholder=\"Vĩ độ\"><input type=\"number\" step=\"0.0001\" data-fortune-astrology-longitude placeholder=\"Kinh độ\"></label><details><summary>Hồ sơ B cho Synastry</summary><div class=\"fortune-v4-inline-fields\"><input type=\"date\" data-fortune-astro-second-date placeholder=\"Ngày\"><input type=\"time\" data-fortune-astro-second-time placeholder=\"Giờ\"><input type=\"text\" data-fortune-astro-second-timezone value=\"Asia/Ho_Chi_Minh\" placeholder=\"IANA timezone\"><input type=\"number\" step=\"0.0001\" data-fortune-astro-second-latitude placeholder=\"Vĩ độ\"><input type=\"number\" step=\"0.0001\" data-fortune-astro-second-longitude placeholder=\"Kinh độ\"></div></details><label class=\"fortune-check\"><input type=\"checkbox\" data-fortune-astrology-alerts " + (runtime.session.astrologyAlerts ? "checked" : "") + "><span>Bật cảnh báo transit trong phiên này</span></label><button class=\"fortune-primary\" type=\"button\" data-fortune-astrology-calc>Tính theo engine thật</button><small class=\"fortune-hint\">Cung mọc và nhà bị từ chối nếu thiếu giờ sinh. Chiron chưa có ephemeris trong Astronomy Engine nên không tạo dữ liệu thay thế.</small></article><article class=\"fortune-v4-card\"><header><span>2 · CONTRACT</span><strong>" + escapeHtml(mode) + "</strong></header><dl class=\"fortune-v4-contract\"><div><dt>Ephemeris</dt><dd>Astronomy Engine 2.1.19 · VSOP87/NOVAS</dd></div><div><dt>Zodiac</dt><dd>" + escapeHtml(profile.zodiacMode || "tropical") + " · sidereal là Lahiri xấp xỉ</dd></div><div><dt>Nhà</dt><dd>" + escapeHtml(profile.houseSystem || "equal") + "</dd></div><div><dt>Orb</dt><dd>" + Object.entries(profile.aspectOrbs || DEFAULT_ORBS).map(([key, value]) => key + " " + value + "°").join(" · ") + "</dd></div></dl><button type=\"button\" data-fortune-view=\"accuracy\">Kiểm tra provenance</button></article></div>" + output + "</section>";
  }

  function skyV4LegacyMarkup(runtime) {
    const result = runtime.session.sky;
    let output = result?.ok ? "<article class=\"fortune-v4-card\"><header><span>" + escapeHtml(result.date) + " · " + escapeHtml(result.instantUtc) + "</span><strong>" + result.illuminatedPercent + "% chiếu sáng · " + result.distanceKm.toLocaleString("vi-VN") + " km</strong></header><div class=\"fortune-sky-metrics\">" + [["Tuổi trăng", result.ageDays + " ngày"], ["Mọc", result.rise], ["Lặn", result.set], ["Transit", result.transit], ["Cận/viễn điểm", result.nextApsis.kind + " · " + result.nextApsis.distanceKm.toLocaleString("vi-VN") + " km"], ["Nguyệt thực tiếp", result.nextLunarEclipse.kind + " · " + (result.nextLunarEclipse.time || "không tìm thấy")], ["Nhật thực tiếp", result.nextSolarEclipse.kind + " · " + (result.nextSolarEclipse.time || "không tìm thấy")]].map(([label, value]) => "<div><span>" + label + "</span><strong>" + escapeHtml(value || "Không có trong cửa sổ") + "</strong></div>").join("") + "</div><details><summary>Xuân phân, chí điểm và hành tinh</summary><pre>" + escapeHtml(JSON.stringify({ seasons: result.seasons, planetEvents: result.planetEvents }, null, 2)) + "</pre></details><div class=\"fortune-v4-output-tags\"><b>TÍNH TOÁN</b></div></article>" : "<div class=\"fortune-empty fortune-empty--compact\"><i>✺</i><strong>Chưa có dữ liệu bầu trời</strong><p>Chạy tính toán để nhận timestamp UTC, provenance và sự kiện quan sát.</p></div>";
    if (result?.ok) output = output.replace("</article>", "<div class=\"fortune-result-actions\"><button type=\"button\" data-fortune-save-current>Lưu tóm tắt</button><button type=\"button\" data-fortune-copy-result>Sao chép</button></div></article>");
    return toolbarMarkup("Moon & Sky Calendar", "Pha trăng, mọc/lặn, transit, khoảng cách, nguyệt thực và mùa thiên văn; không gắn nhãn cát/hung.") + "<section class=\"fortune-v4-workspace fortune-sky-studio\"><div class=\"fortune-v4-two-col\"><article class=\"fortune-v4-card fortune-v4-form\"><header><span>MOON & SKY</span><strong>Dữ liệu phụ thuộc vị trí</strong></header><label><span>Ngày</span><input type=\"date\" data-fortune-sky-date value=\"" + escapeHtml(runtime.session.skyDate || localDateKey()) + "\"></label><button class=\"fortune-primary\" type=\"button\" data-fortune-sky-calc>Tính bầu trời</button><small class=\"fortune-hint\">Dùng vĩ độ, kinh độ, độ cao và timezone trong Hồ sơ phiên.</small></article><article class=\"fortune-v4-card\"><header><span>NGUỒN</span><strong>Astronomy Engine + USNO</strong></header><p>Rise/set phụ thuộc vị trí, độ cao và đường chân trời. Hệ thống không tự đoán khi thiếu dữ liệu.</p><button type=\"button\" data-fortune-view=\"profile\">Chỉnh địa điểm</button></article></div>" + output + "</section>";
  }

  function easternV4Markup(runtime) {
    const result = runtime.session.eastern;
    const engines = result?.engines || [{ label: "Bát Tự/Tứ Trụ", status: "review", message: "Cần fixture tiết khí và chuyên gia." }, { label: "Tử Vi Đẩu Số", status: "review", message: "Chờ engine độc lập." }, { label: "La bàn phong thủy", status: "local-only", message: "Chỉ khi cấp quyền cảm biến." }];
    let output = result?.ok ? "<article class=\"fortune-v4-card\"><header><span>" + escapeHtml(result.date) + "</span><strong>" + escapeHtml(result.lunarLabel || "Không đọc được lịch âm") + "</strong></header><div class=\"fortune-eastern-hero\"><b>" + escapeHtml(result.yearPillar.stem + " " + result.yearPillar.branch) + "</b><span>Can Chi năm · không phải toàn bộ Bát Tự</span></div><div class=\"fortune-v4-table\">" + result.solarTerms.map((term) => "<div><span>" + escapeHtml(term.name) + " · " + term.longitude + "°</span><small>" + escapeHtml(term.time || "Không có event") + "</small></div>").join("") + "</div><div class=\"fortune-v4-output-tags\"><b>TÍNH TOÁN</b><b>BIỂU TƯỢNG · có giới hạn</b></div></article>" : "<div class=\"fortune-empty fortune-empty--compact\"><i>☯</i><strong>Chưa tính nền lịch phương Đông</strong><p>Chạy công cụ để xem Can Chi năm, lịch âm của môi trường và 24 tiết khí.</p></div>";
    if (result?.ok) output = output.replace("</article>", "<div class=\"fortune-result-actions\"><button type=\"button\" data-fortune-save-current>Lưu tóm tắt</button><button type=\"button\" data-fortune-copy-result>Sao chép</button></div></article>");
    const ai = result?.ok ? automaticAiMarkup(runtime, "eastern", "Can Chi, lịch âm và 24 tiết khí vẫn dùng được từ engine cục bộ.") : "";
    return toolbarMarkup("Hệ phương Đông", "Can Chi, lịch âm dương và 24 tiết khí ở lớp tính toán; Bát Tự/Tử Vi chỉ bật sau kiểm duyệt riêng.") + "<section class=\"fortune-v4-workspace fortune-eastern-studio\"><div class=\"fortune-v4-two-col\"><article class=\"fortune-v4-card fortune-v4-form\"><header><span>CALENDAR FOUNDATION</span><strong>Không trộn trường phái</strong></header><label><span>Ngày</span><input type=\"date\" data-fortune-eastern-date value=\"" + escapeHtml(runtime.session.easternDate || runtime.profile.date || localDateKey()) + "\"></label><button class=\"fortune-primary\" type=\"button\" data-fortune-eastern-calc>Tính Can Chi & tiết khí</button><small class=\"fortune-hint\">Bát Tự đầy đủ cần giờ sinh, tiết khí và bộ fixture chuyên gia; không tạo bản xem trước giả.</small></article><article class=\"fortune-v4-card\"><header><span>READINESS</span><strong>Engine riêng</strong></header><div class=\"fortune-readiness-grid\">" + engines.map((item) => "<div data-status=\"" + escapeHtml(item.status) + "\"><i>" + (item.status === "review" ? "…" : "✓") + "</i><span>" + escapeHtml(item.label) + "</span><small>" + escapeHtml(item.message) + "</small></div>").join("") + "</div></article></div>" + output + ai + "</section>";
  }

  function symbolsV4LegacyMarkup(runtime) {
    const result = runtime.session.symbolDeck; const type = runtime.session.symbolType || "lenormand";
    let output = result?.cards ? "<article class=\"fortune-v4-card\"><header><span>" + escapeHtml(result.type) + " · seed " + escapeHtml(result.seed) + "</span><strong>" + result.cards.length + " biểu tượng · " + escapeHtml(result.layout || "spread") + "</strong></header><div class=\"fortune-symbol-grid\">" + result.cards.map((card) => "<article><i>" + escapeHtml(card.symbol) + "</i><small>" + (card.number || "") + (card.playingCard ? " · " + escapeHtml(card.playingCard) : card.transliteration ? " · " + escapeHtml(card.transliteration) : "") + "</small><h3>" + escapeHtml(card.englishName ? card.englishName + " · " + card.name : card.name) + "</h3>" + (card.family ? "<b>" + escapeHtml(card.family) + "</b>" : "") + "<p>" + escapeHtml(card.prompt) + "</p></article>").join("") + "</div><div class=\"fortune-v4-output-tags\"><b>BIỂU TƯỢNG</b><b>SEED PROOF · " + escapeHtml((result.seedProof || "").slice(0, 16)) + "…</b></div></article>" : "<div class=\"fortune-empty fortune-empty--compact\"><i>✧</i><strong>Chọn một bộ để bắt đầu</strong><p>Lenormand có 36 tên và inset chuẩn; Rune tách dữ liệu ngôn ngữ khỏi diễn giải HH.</p></div>";
    if (result?.cards) output = output.replace("</article>", "<div class=\"fortune-result-actions\"><button type=\"button\" data-fortune-save-current>Lưu tóm tắt</button><button type=\"button\" data-fortune-copy-result>Sao chép</button></div></article>");
    return toolbarMarkup("Thư viện biểu tượng", "Lenormand 36, Elder Futhark 24 và Oracle HH có dữ liệu chuẩn hóa, seed proof và giới hạn trường phái rõ ràng.") + "<section class=\"fortune-v4-workspace fortune-symbols-studio\"><article class=\"fortune-v4-card fortune-v4-form\"><div class=\"fortune-v4-inline-fields\"><label><span>Bộ</span><select data-fortune-symbol-type><option value=\"lenormand\"" + (type === "lenormand" ? " selected" : "") + ">Lenormand 36</option><option value=\"runes\"" + (type === "runes" ? " selected" : "") + ">Elder Futhark 24</option><option value=\"oracle\"" + (type === "oracle" ? " selected" : "") + ">Oracle HH 24</option></select></label><label><span>Số biểu tượng</span><select data-fortune-symbol-count>" + [1,3,5,9,24,36].filter((count) => type === "lenormand" ? count <= 36 : count <= 24).map((count) => "<option value=\"" + count + "\"" + (Number(runtime.session.symbolCount || 3) === count ? " selected" : "") + ">" + (type === "lenormand" && count === 36 ? "36 · Grand Tableau" : count) + "</option>").join("") + "</select></label><label><span>Seed</span><input type=\"text\" maxlength=\"180\" data-fortune-symbol-seed value=\"" + escapeHtml(runtime.session.symbolSeed || "") + "\" placeholder=\"Để trống để Web Crypto tạo mới\"></label><label class=\"fortune-check\"><input type=\"checkbox\" data-fortune-rune-reversed " + (runtime.session.runeAllowReversed ? "checked" : "") + (type !== "runes" ? " disabled" : "") + "><span>Rune đảo · tùy chọn hiện đại, mặc định tắt</span></label></div><button class=\"fortune-primary\" type=\"button\" data-fortune-symbol-draw>Rút và tạo chứng thư</button></article>" + output + "</section>";
  }

  function academyV4LegacyMarkup(runtime) {
    const v4 = suiteV4(); const mode = runtime.session.academyMode || "meaning"; const quiz = runtime.session.tarotQuiz || v4?.tarotQuiz?.("academy-" + (runtime.session.academyRound || 1), { mode }); const stats = v4?.tarotStatistics?.(runtime.session.tarot78 ? [runtime.session.tarot78] : []); const review = runtime.session.academyReview;
    const quizMarkup = quiz ? "<div class=\"fortune-academy-card\">" + (quiz.card.image ? "<img src=\"" + escapeHtml(quiz.card.image) + "\" alt=\"Hình lá Tarot để nhận diện\" width=\"360\" height=\"617\" loading=\"lazy\" decoding=\"async\">" : "<i>" + quiz.card.symbol + "</i>") + "<strong>" + escapeHtml(quiz.question) + "</strong><p>Đáp án và gợi ý luôn được khóa cho tới khi bạn chọn.</p><div>" + quiz.answers.map((answer, index) => "<button type=\"button\" data-fortune-academy-answer=\"" + index + "\">" + escapeHtml(answer) + "</button>").join("") + "</div><small data-fortune-academy-feedback>" + escapeHtml(runtime.session.academyFeedback || "Hãy tự chọn trước khi mở đáp án.") + "</small></div>" : "";
    return toolbarMarkup("Tarot Academy", "Lộ trình đủ Major, bốn chất, số học, Court Cards và biểu tượng với active recall, rubric và lịch ôn.") + "<section class=\"fortune-v4-workspace fortune-academy\"><article class=\"fortune-v4-card\"><header><span>ROUND " + (runtime.session.academyRound || 1) + "</span><strong>Active recall · không lộ đáp án</strong></header><label><span>Dạng bài</span><select data-fortune-academy-mode><option value=\"meaning\"" + (mode === "meaning" ? " selected" : "") + ">Diễn giải sáng</option><option value=\"name\"" + (mode === "name" ? " selected" : "") + ">Nhận diện tên từ ảnh</option><option value=\"element\"" + (mode === "element" ? " selected" : "") + ">Nhóm / nguyên tố</option><option value=\"symbol\"" + (mode === "symbol" ? " selected" : "") + ">Biểu tượng trên hình</option></select></label>" + quizMarkup + "<button type=\"button\" data-fortune-academy-next>Đổi câu hỏi</button></article><article class=\"fortune-v4-card\"><header><span>TIẾN ĐỘ & LỊCH ÔN</span><strong>SM-2 rút gọn · local session</strong></header><div class=\"fortune-academy-stats\"><div><b>" + (stats?.total || 0) + "</b><span>Lượt đọc</span></div><div><b>" + (review?.intervalDays || 0) + "</b><span>Ngày tới lượt ôn</span></div><div><b>" + (review?.ease || 2.5) + "</b><span>Hệ số dễ</span></div></div>" + (review ? "<p>Ôn lại: " + escapeHtml(formatDateTime(review.dueAt)) + " · mức tự tin " + review.score + "/4.</p>" : "<p>Chọn một đáp án để tạo lịch ôn. Tiến độ chỉ được lưu khi người dùng chủ động bật trong phiên bản tiếp theo.</p>") + "</article></section>";
  }

  function automaticAiMarkup(runtime, kind, localFallback = "", canonical = false) {
    if (!canonical) return "";
    const state = runtime.session[`${kind}Ai`] || null;
    const titles = { tarot: "Tổng hợp trải bài", symbols: "Đọc mạch biểu tượng", zodiac: "Diễn giải cung và chu kỳ", numerology: "Luận giải thần số", iching: "Luận giải cấu trúc quẻ", chart: "Luận giải bản đồ sao", tuvi: "Luận giải lá số Tử Vi", physiognomy: "Đối chiếu bản tự quan sát", dreams: "Gợi mở mô-típ giấc mơ", moon: "Giải thích dữ liệu Mặt Trăng", sky: "Tóm tắt kế hoạch quan sát", eastern: "Giải thích Can Chi và tiết khí", compatibility: "Gợi ý kế hoạch tương tác", session: "Tổng hợp phiên chiêm nghiệm" };
    const title = `HH AI · ${titles[kind] || "Phân tích tại chỗ"}`;
    if (state?.status === "loading") return `<article class="fortune-auto-ai is-loading" aria-live="polite"><header><i>AI</i><div><small>NỘI DUNG DO HH AI TẠO · DỮ KIỆN ĐÃ ẨN DANH</small><h3>${title}</h3></div></header><div class="fortune-ai-skeleton"><i></i><i></i><i></i><i></i></div><p>HH AI đang đối chiếu Result Contract. Tên, ngày sinh, tọa độ, câu hỏi riêng và nhật ký không được gửi.</p></article>`;
    if (state?.status === "ready") return `<article class="fortune-auto-ai" data-fortune-result><header><i>AI</i><div><small>NỘI DUNG DO HH AI TẠO · FACT LOCK ĐÃ KIỂM TRA</small><h3>${title}</h3><span>${state.cached ? "Đã dùng bản phân tích an toàn trong phiên" : `${state.factValidation?.citedFactCount || 0} dữ kiện đã đối chiếu · ${state.latencyMs || 0} ms`}</span></div></header><div class="fortune-auto-ai__body">${markdownMarkupSafe(state.output)}</div><footer><button type="button" data-fortune-copy="${escapeHtml(state.output)}">Sao chép</button><button type="button" data-fortune-auto-ai-retry="${kind}">Phân tích lại</button></footer></article>`;
    const error = state?.status === "error" ? `<strong>HH AI tạm chưa phản hồi: ${escapeHtml(state.error || "lỗi không xác định")}</strong>` : "";
    return `<article class="fortune-auto-ai is-fallback"><header><i>AI</i><div><small>LOCAL FALLBACK LUÔN SẴN SÀNG</small><h3>${title}</h3></div></header>${error}<p>${escapeHtml(localFallback || "Kết quả cục bộ vẫn đầy đủ và không phụ thuộc dịch vụ AI.")}</p>${state?.status === "error" ? `<button type="button" data-fortune-auto-ai-retry="${kind}">Thử lại HH AI</button>` : `<small>Sau khi bạn hoàn tất thao tác, hệ thống tự gửi duy nhất dữ kiện đã tính và đã loại thông tin gốc; không cần mở Reflection Copilot hoặc bấm yêu cầu thủ công.</small>`}</article>`;
  }

  function embeddedAutomaticAiMarkup(runtime, view) {
    const available = {
      tarot: runtime.session.tarot?.length,
      symbols: runtime.session.symbolDeck?.cards?.length,
      zodiac: runtime.session.western?.ok || runtime.session.chinese?.ok,
      chart: runtime.session.astrologyV4?.ok,
      tuvi: runtime.session.tuvi?.ok,
      physiognomy: runtime.session.physiognomyResult?.ok,
      dreams: runtime.session.dreamResult?.ok,
      moon: Boolean(runtime.session.moon),
      sky: runtime.session.sky?.ok,
      eastern: runtime.session.eastern?.ok,
      compatibility: Boolean(runtime.session.compatibility),
      session: Boolean(runtime.builder?.result)
    };
    if (!available[view]) return "";
    const fallback = { tarot: "Các lá, vị trí và diễn giải HH cục bộ vẫn dùng được.", symbols: "Tên lá, từ khóa, cặp và Grand Tableau vẫn dùng được.", zodiac: "Kinh độ Mặt Trời và mốc lịch vẫn hiển thị từ engine cục bộ.", chart: "Vị trí hành tinh, nhà và góc hợp vẫn giữ nguyên từ Astronomy Engine.", tuvi: "Lá số 12 cung do iztro lập vẫn hiển thị đầy đủ.", physiognomy: "Các quan sát tự chọn và câu hỏi kiểm chứng vẫn nằm trong phiên.", dreams: "Bản đồ biểu tượng cục bộ vẫn dùng được; nội dung giấc mơ không rời trình duyệt.", moon: "Pha, độ sáng, khoảng cách và mọc/lặn vẫn lấy từ engine thiên văn.", sky: "Bảng mọc/lặn, chạng vạng và sự kiện quan sát vẫn dùng được.", eastern: "Can Chi, lịch âm và tiết khí vẫn giữ nguyên từ engine lịch.", compatibility: "Kế hoạch giao tiếp trung lập vẫn dùng được.", session: "Các kết quả thành phần vẫn được giữ nguyên." }[view];
    return automaticAiMarkup(runtime, view, fallback);
  }

  function tarotMarkup(runtime) {
    const cards = runtime.session.tarot || []; const revealed = runtime.session.tarotRevealed instanceof Set ? runtime.session.tarotRevealed : new Set();
    const focusIndex = cards.length ? clamp(runtime.session.tarotFocusIndex, 0, cards.length - 1, 0) : 0; const focus = cards[focusIndex]; const focusRevealed = revealed.has(focusIndex);
    const filmstrip = cards.length ? `<div class="fortune-tarot-filmstrip" role="list" aria-label="Các lá trong trải bài">${cards.map((card, index) => `<button type="button" role="listitem" class="${index === focusIndex ? "is-active " : ""}${revealed.has(index) ? "is-revealed" : "is-concealed"}" data-fortune-tarot-focus="${index}" style="--card-accent:${card.color};--card-order:${index}" aria-label="${revealed.has(index) ? escapeHtml(card.name) : `Lá ${index + 1} chưa lật`}"><span>${index + 1}</span>${revealed.has(index) && card.image ? `<img src="${escapeHtml(card.image)}" alt="" width="72" height="124" loading="lazy">` : `<i>✦</i>`}<small>${escapeHtml(card.position)}</small></button>`).join("")}</div>` : "";
    const celtic = cards.length === 10 ? `<details class="fortune-celtic-map"><summary>Xem sơ đồ Celtic Cross chuẩn</summary><div>${cards.map((card, index) => `<button type="button" data-fortune-tarot-focus="${index}" data-celtic-position="${index + 1}" class="${index === 1 ? "is-crossing" : ""}${revealed.has(index) ? " is-revealed" : ""}"><b>${index + 1}</b><span>${escapeHtml(card.position)}</span></button>`).join("")}</div><p>Lá 2 đặt ngang trên lá 1; cột 7–10 ở bên phải đọc từ dưới lên. Sơ đồ chỉ mô tả vai trò vị trí, không khẳng định tương lai.</p></details>` : "";
    let workspace = `<div class="fortune-empty"><i>♢</i><strong>Chưa có lá bài nào được rút</strong><p>Chọn bố cục và rút bài. Toàn bộ 78 lá RWS có ảnh, tên Anh–Việt và chứng thư seed.</p></div>`;
    if (focus) {
      workspace = `${filmstrip}<article class="fortune-tarot-inspector ${focusRevealed ? "is-revealed" : "is-concealed"}" data-fortune-result style="--card-accent:${focus.color}">
        <div class="fortune-tarot-inspector__visual">${focusRevealed ? (focus.image ? `<img src="${escapeHtml(focus.image)}" alt="${escapeHtml(focus.name)}" width="360" height="617">` : `<i>${focus.symbol}</i>`) : `<button type="button" data-fortune-card-reveal="${focusIndex}"><i>✦</i><b>Lật lá ${focusIndex + 1}</b><span>${escapeHtml(focus.position)}</span></button>`}</div>
        <section>${focusRevealed ? `<small>LÁ ${focusIndex + 1}/${cards.length} · ${focus.reversed ? "ĐẢO / REVERSED" : "XUÔI / UPRIGHT"}</small><label class="fortune-tarot-position"><span>Vai trò vị trí</span><input type="text" maxlength="60" data-fortune-card-position="${focusIndex}" value="${escapeHtml(focus.position)}"></label><h3>${escapeHtml(focus.name)}</h3><div class="fortune-tarot-reading"><strong>Diễn giải tại vị trí này</strong><p>${escapeHtml(focus.interpretation)}</p><strong>Câu hỏi để kiểm chứng</strong><p>${escapeHtml(focus.question)}</p>${focus.symbols?.length ? `<details class="fortune-symbol-atlas" open><summary>Symbol Atlas · chi tiết trên hình</summary>${focus.symbols.map((symbol) => `<button type="button" data-fortune-copy="${escapeHtml(symbol)}"><b>◎</b><span>${escapeHtml(symbol)}</span></button>`).join("")}</details>` : ""}<label><span>Ghi chú riêng cho lá này</span><textarea rows="3" maxlength="500" data-fortune-card-note="${focusIndex}" placeholder="Dữ kiện nào khớp hoặc không khớp?">${escapeHtml(focus.note || "")}</textarea></label><footer><button type="button" data-fortune-card-pin="${focusIndex}">${focus.pinned ? "★ Đã ghim" : "☆ Ghim"}</button><button type="button" data-fortune-card-move="${focusIndex}:-1" ${focusIndex === 0 ? "disabled" : ""}>← Đổi trái</button><button type="button" data-fortune-card-move="${focusIndex}:1" ${focusIndex === cards.length - 1 ? "disabled" : ""}>Đổi phải →</button></footer></div>` : `<small>LÁ ${focusIndex + 1}/${cards.length}</small><h3>Lá bài đang được niêm phong</h3><p>Bấm vào mặt bài để lật. Các lá còn lại vẫn giữ kích thước nhỏ trong filmstrip.</p>`}</section>
      </article>${celtic}<div class="fortune-result-actions"><button type="button" data-fortune-reveal-all>✦ Lật tất cả</button><label>Tỷ lệ xuất<select data-fortune-export-ratio><option value="1:1">1:1</option><option value="9:16">9:16</option><option value="16:9">16:9</option></select></label><button type="button" data-fortune-export="txt">TXT</button><button type="button" data-fortune-export="json">JSON</button><button type="button" data-fortune-export="png">PNG</button><button type="button" data-fortune-copy-result>Sao chép</button></div><p class="fortune-tarot-rights">Rider–Waite–Smith 1909 · Pamela Colman Smith · Public Domain Mark 1.0 · Wikimedia Commons. Diễn giải tiếng Việt do HH biên soạn.</p>`;
    }
    const explanation = cards.length ? explanationMarkup(runtime, "Cách đọc trải bài có kiểm chứng", [
      { label: "Cấu trúc", text: `${cards.length} lá, seed ${runtime.session.tarotSeed}. Mỗi lá chỉ xuất hiện một lần; filmstrip giữ toàn cảnh nhưng inspector chỉ mở một lá để tránh chiếm diện tích.` },
      { label: "Thứ tự", text: "Đọc vai trò vị trí trước, mô tả hình ảnh sau, rồi mới nối ý nghĩa. Không mặc định mọi trải ba lá là quá khứ–hiện tại–tương lai." },
      { label: "Tổng hợp", text: "Tìm chất, số, biểu tượng hoặc chủ đề lặp; ghi cả mâu thuẫn và phần chưa biết thay vì ép các lá đồng ý." },
      { label: "Kiểm chứng", text: "Tách dữ kiện, diễn giải và giả định. Chọn một bước nhỏ có thể đảo ngược và một thời điểm xem lại." },
      { label: "Giới hạn", text: "Tarot là công cụ hình ảnh để tự chiêm nghiệm, không đọc ý nghĩ, không dự báo khoa học và không thay tư vấn chuyên môn." }
    ]) : "";
    return `${toolbarMarkup("Tarot 78 Studio · Compact Inspector", "Toàn bộ 78 hình RWS chuẩn trong filmstrip gọn; chỉ lá đang chọn mở lớn, Celtic Cross vẫn giữ bố cục đúng.")}<section class="fortune-control-panel fortune-tarot-builder"><label><span>Chủ đề hoặc câu hỏi (không lưu)</span><input type="text" maxlength="180" data-fortune-tarot-question value="${escapeHtml(runtime.session.question || "")}" placeholder="Bạn muốn soi chiếu điều gì?"></label><label><span>Kiểu trải bài</span><select data-fortune-tarot-count>${[[1,"1 lá · Trọng tâm"],[3,"3 lá · Bối cảnh / Chú ý / Bước thử"],[5,"5 lá · Toàn cảnh"],[7,"7 lá · Hành trình"],[10,"10 lá · Celtic Cross chuẩn"],[12,"12 lá · Vòng năm"],[15,"15 lá · Bản đồ đầy đủ"]].map(([count,label]) => `<option value="${count}"${runtime.session.tarotCount === count ? " selected" : ""}>${label}</option>`).join("")}</select></label><label><span>Seed tái tạo</span><input type="text" maxlength="180" data-fortune-tarot-seed value="${escapeHtml(runtime.session.tarotSeed || "")}" placeholder="Để trống để Web Crypto tạo seed"></label><label class="fortune-check"><input type="checkbox" data-fortune-tarot-reversed ${runtime.session.tarotAllowReversed !== false ? "checked" : ""}><span>Cho phép lá đảo</span></label><label class="fortune-tarot-positions"><span>Vị trí tùy chỉnh · mỗi dòng một vị trí</span><textarea rows="2" maxlength="1000" data-fortune-tarot-positions>${escapeHtml(runtime.session.tarotPositionsText || "")}</textarea></label><button class="fortune-primary" type="button" data-fortune-draw>♢ Rút bài có chứng thư</button></section><section class="fortune-tarot-compact">${workspace}${explanation}</section>`;
  }

  function numerologyMarkup(runtime) {
    const result = runtime.session.numerology; const v4 = runtime.session.numerologyV4; const cycles = runtime.session.cycles;
    const guides = v4?.interpretations ? Object.values(v4.interpretations).filter(Boolean) : [];
    const local = v4 ? `<article class="fortune-numerology-dashboard" data-fortune-result><header><div><small>LOCAL DETERMINISTIC ENGINE · ${escapeHtml(v4.system.toUpperCase())}</small><h3>Bản đồ chỉ số nhiều tầng</h3></div><span>AI không thay đổi phép tính</span></header><div class="fortune-number-hero-grid">${[["Đường đời",v4.lifePath],["Ngày sinh",v4.birthday],["Thái độ",v4.attitude],["Biểu đạt",v4.expression],["Nội tâm",v4.soulUrge],["Ấn tượng",v4.personality],["Trưởng thành",v4.maturity],["Cân bằng",v4.balance]].map(([label,value]) => `<div><span>${label}</span><b>${value?.value ?? "—"}</b><small>${escapeHtml(value?.formula || "Cần tên để tính")}</small></div>`).join("")}</div><div class="fortune-numerology-guides">${guides.map((guide) => `<details${guide.label === "Đường đời" ? " open" : ""}><summary><b>${guide.number}</b><span>${escapeHtml(guide.label)} · ${escapeHtml(guide.title)}</span></summary><div><p><strong>Nguồn lực:</strong> ${escapeHtml(guide.resources)}.</p><p><strong>Điểm mù để quan sát:</strong> ${escapeHtml(guide.blindSpots)}.</p><p><strong>Thực hành:</strong> ${escapeHtml(guide.practice)}.</p><p><strong>Câu hỏi:</strong> ${escapeHtml(guide.reflectionQuestion)}</p><small>${escapeHtml(guide.boundary)}</small></div></details>`).join("")}</div><div class="fortune-numerology-deep-grid"><section><h4>4 đỉnh cao · Pinnacles</h4>${v4.pinnacles.map((value,index)=>`<span><b>${index+1}</b> ${value}</span>`).join("")}</section><section><h4>4 thử thách · Challenges</h4>${v4.challenges.map((value,index)=>`<span><b>${index+1}</b> ${value}</span>`).join("")}</section><section><h4>Chu kỳ đang chọn</h4><span>Năm <b>${v4.cycles.personalYear}</b></span><span>Tháng <b>${v4.cycles.personalMonth}</b></span><span>Ngày <b>${v4.cycles.personalDay}</b></span></section><section><h4>Bài học & nợ nghiệp · theo trường phái</h4><span>Bài học thiếu: ${v4.karmicLessons.join(", ") || "không có"}</span><span>Tổng 13/14/16/19: ${v4.karmicDebt.join(", ") || "không có"}</span></section></div><details class="fortune-formula-audit"><summary>Xem toàn bộ công thức, Lo Shu và ánh xạ chữ</summary><pre>${escapeHtml(JSON.stringify({ lifePath:v4.lifePath,birthday:v4.birthday,attitude:v4.attitude,expression:v4.expression,soulUrge:v4.soulUrge,personality:v4.personality,maturity:v4.maturity,balance:v4.balance,pinnacles:v4.pinnacles,challenges:v4.challenges,loShu:v4.loShu,mappingTrace:v4.mappingTrace }, null, 2))}</pre></details><button type="button" data-fortune-save-current>Lưu tóm tắt không chứa ngày sinh/tên</button></article>` : `<div class="fortune-empty fortune-empty--compact"><i>#</i><strong>Nhập dữ liệu để bắt đầu</strong><p>Engine cục bộ tính trước; phần diễn giải tự động chỉ xuất hiện trong tab HH AI.</p></div>`;
    return `${toolbarMarkup("Thần số học · Bản đồ chỉ số", "Một lần bấm tính minh bạch tại chỗ; luận giải tự động được đặt riêng trong tab HH AI.")}<section class="fortune-numerology fortune-numerology-pro"><div class="fortune-calc-card fortune-calc-card--wide"><header><i>#</i><div><small>PYTHAGORAS / CHALDEAN · KHÔNG TRỘN HỆ</small><h3>Tính toàn bộ bản đồ thần số</h3></div></header><div class="fortune-form-grid"><label><span>Ngày sinh</span><input type="date" data-fortune-numerology-date autocomplete="bday" value="${escapeHtml(runtime.session.birthDate || runtime.profile.date || "")}"></label><label><span>Ngày xem chu kỳ</span><input type="date" data-fortune-cycle-date value="${escapeHtml(runtime.session.targetDate || localDateKey())}"></label><label><span>Tên dùng để tính (không lưu)</span><input type="text" maxlength="120" data-fortune-name value="${escapeHtml(runtime.session.nameInput || "")}" placeholder="Có thể bỏ trống"></label><label><span>Hệ chữ cái</span><select data-fortune-name-system><option value="pythagorean"${runtime.session.nameSystem !== "chaldean" ? " selected" : ""}>Pythagoras</option><option value="chaldean"${runtime.session.nameSystem === "chaldean" ? " selected" : ""}>Chaldean</option></select></label></div><button class="fortune-primary" type="button" data-fortune-numerology-calc>Tính toàn bộ bản đồ thần số</button><p class="fortune-ai-privacy"><b>Riêng tư:</b> thao tác này tự gửi đường đời, các chỉ số tên đã rút gọn, chu kỳ, pinnacle và challenge. Tên, ngày sinh, tọa độ và nhật ký không rời trình duyệt. Nếu HH AI tạm gián đoạn, phần tính local vẫn dùng bình thường.</p></div>${local}${automaticAiMarkup(runtime, "numerology", result ? `Diễn giải cục bộ: đường đời ${result.lifePath}, ngày sinh ${result.birthDay}, thái độ ${result.attitude}.` : "Kết quả cục bộ sẽ xuất hiện ngay sau khi tính.")}</section>`;
  }

  function hexagramGlyphMarkup(hexagram, label, className = "") {
    if (!hexagram?.bits) return ""; const bits = [...hexagram.bits].reverse();
    return `<article class="fortune-hexagram-card ${className}"><small>${escapeHtml(label)}</small><div class="fortune-hexagram-glyph" aria-label="${escapeHtml(hexagram.title || label)}">${bits.map((bit) => `<i class="${bit === "1" ? "is-yang" : "is-yin"}"><span></span><span></span></i>`).join("")}</div><h4>${escapeHtml(hexagram.title || hexagram.name || "—")}</h4><p>${escapeHtml(hexagram.structure || "")}</p><strong>${escapeHtml(hexagram.theme || "")}</strong></article>`;
  }

  function ichingMarkup(runtime) {
    const advanced = runtime.session.ichingAdvanced; const result = runtime.session.iching;
    const chart = advanced?.ok ? `<article class="fortune-iching-chart" data-fortune-result><header><div><small>PROFESSIONAL HEXAGRAM CHART · KING WEN</small><h3>${escapeHtml(advanced.primary.title)}</h3><p>${escapeHtml(advanced.rule)}</p></div><span>Seed proof ${escapeHtml((advanced.seedProof || "").slice(0, 16))}…</span></header><div class="fortune-hexagram-family">${hexagramGlyphMarkup(advanced.primary,"Quẻ chính","is-primary")}${hexagramGlyphMarkup(advanced.nuclear,"Quẻ hỗ")}${hexagramGlyphMarkup(advanced.changed,"Quẻ biến","is-changed")}${hexagramGlyphMarkup(advanced.opposite,"Quẻ đối")}${hexagramGlyphMarkup(advanced.reversed,"Quẻ đảo")}</div><section class="fortune-trigram-structure"><div><i>${escapeHtml(advanced.upper.symbol)}</i><span>Thượng quái</span><strong>${escapeHtml(advanced.upper.name)} · ${escapeHtml(advanced.upper.nature)}</strong><small>${escapeHtml(advanced.upper.element || "")} · ${escapeHtml(advanced.upper.direction || "")}</small></div><div><i>${escapeHtml(advanced.lower.symbol)}</i><span>Hạ quái</span><strong>${escapeHtml(advanced.lower.name)} · ${escapeHtml(advanced.lower.nature)}</strong><small>${escapeHtml(advanced.lower.element || "")} · ${escapeHtml(advanced.lower.direction || "")}</small></div></section><ol class="fortune-six-line-ledger">${[...advanced.lines].reverse().map((line) => `<li class="${line.changing ? "is-changing" : ""}"><b>Hào ${line.number}</b><div class="${line.yang ? "is-yang" : "is-yin"}"><span></span><span></span></div><strong>${line.value} · ${line.yang ? "dương" : "âm"}${line.changing ? " động" : " tĩnh"}</strong><p>${escapeHtml(line.reflection)}</p><small>${line.coins?.length ? line.coins.map((coin)=>coin===3?"ngửa 3":"sấp 2").join(" · ") : advanced.mode === "yarrow" ? "xác suất cỏ thi" : "nhập thủ công"}</small></li>`).join("")}</ol><details open><summary>Thứ tự ưu tiên khi đọc</summary><ol><li>Đọc chủ đề quẻ chính và hai quái.</li><li>${escapeHtml(advanced.rule)}</li><li>Dùng quẻ hỗ cho cấu trúc ở giữa; quẻ biến cho trạng thái sau khi các hào động đổi.</li><li>Quẻ đối và quẻ đảo là góc so sánh cấu trúc, không phải hai dự báo bổ sung.</li><li>Đối chiếu với dữ kiện thật rồi chọn một hành động nhỏ có thể đảo ngược.</li></ol></details><button type="button" data-fortune-save-current>Lưu kết quả</button></article>` : `<div class="fortune-empty fortune-empty--compact"><i>☯</i><strong>Chưa gieo quẻ</strong><p>Chọn ba đồng xu, xác suất cỏ thi hoặc nhập sáu hào 6–9 từ dưới lên.</p></div>`;
    return `${toolbarMarkup("Kinh Dịch 64 · Professional Chart", "Quẻ chính, hỗ, biến, đối, đảo; sổ sáu hào và luận giải tự động nằm trong tab HH AI.")}<section class="fortune-iching fortune-iching-pro"><div class="fortune-calc-card"><header><i>☯</i><div><small>COINS · YARROW · MANUAL</small><h3>Gieo từ hào 1 lên hào 6</h3></div></header><label><span>Câu hỏi riêng (chỉ ở tab này, không tự gửi đi)</span><textarea rows="3" maxlength="240" data-fortune-iching-question placeholder="Viết ngắn gọn điều bạn đang cân nhắc...">${escapeHtml(runtime.session.ichingQuestion || "")}</textarea></label><div class="fortune-inline-fields"><label><span>Phương pháp</span><select data-fortune-iching-mode><option value="coins"${runtime.session.ichingMode === "coins" ? " selected" : ""}>Ba đồng xu</option><option value="yarrow"${runtime.session.ichingMode === "yarrow" ? " selected" : ""}>Xác suất cỏ thi</option><option value="manual"${runtime.session.ichingMode === "manual" ? " selected" : ""}>Nhập 6 hào</option></select></label><label><span>Seed tái tạo</span><input type="text" maxlength="120" data-fortune-iching-seed value="${escapeHtml(runtime.session.ichingSeed || "")}" placeholder="Để trống để tạo mới"></label></div><div class="fortune-v4-inline-fields fortune-iching-manual">${[0,1,2,3,4,5].map((index) => `<label><span>Hào ${index + 1}</span><select data-fortune-iching-manual>${[6,7,8,9].map((value)=>`<option value="${value}"${runtime.session.ichingManual?.[index] === value ? " selected" : ""}>${value} · ${value===6?"âm động":value===7?"dương tĩnh":value===8?"âm tĩnh":"dương động"}</option>`).join("")}</select></label>`).join("")}</div><button class="fortune-primary" type="button" data-fortune-iching-cast>Gieo quẻ có chứng thư</button><p class="fortune-ai-privacy">HH AI chỉ nhận số quẻ, tên quẻ, quái, giá trị 6 hào và thứ tự hào động; không nhận câu hỏi riêng hoặc seed.</p></div>${chart}${automaticAiMarkup(runtime, "iching", result ? `${result.title}. ${result.reflection} ${result.question}` : "Kết quả và diễn giải HH cục bộ không phụ thuộc Gemini.")}</section>`;
  }

  function ziweiMarkup(runtime) {
    const result = runtime.session.tuvi; const selectedIndex = result?.palaces?.length ? clamp(runtime.session.tuviPalaceIndex, 0, result.palaces.length - 1, 0) : 0; const selectedPalace = result?.palaces?.[selectedIndex];
    const stars = (palace) => [...(palace.majorStars || []), ...(palace.minorStars || [])];
    const starLabel = (star) => `${star.name}${star.brightness ? ` · ${star.brightness}` : ""}${star.mutagen ? ` · Hóa ${star.mutagen}` : ""}`;
    const chart = result?.ok ? `<article class="fortune-tuvi-chart" data-fortune-result><header><div><small>ZI WEI DOU SHU · IZTRO ${escapeHtml(extendedTools()?.IZTRO_VERSION || "2.6.0")}</small><h3>Lá số 12 cung · ${escapeHtml(result.fiveElementsClass)}</h3><p>${escapeHtml(result.chineseDate)} · ${escapeHtml(result.time)} (${escapeHtml(result.timeRange)})</p></div><span>${escapeHtml(result.gender)} · ${escapeHtml(result.zodiac)} · ${escapeHtml(result.sign)}</span></header><div class="fortune-tuvi-summary">${[["Âm lịch",result.lunarDate],["Mệnh chủ",result.soul],["Thân chủ",result.body],["Cung Mệnh",result.soulPalaceBranch],["Cung Thân",result.bodyPalaceBranch],["Engine",result.engine]].map(([label,value])=>`<div><span>${label}</span><strong>${escapeHtml(value || "—")}</strong></div>`).join("")}</div><div class="fortune-tuvi-board">${result.palaces.map((palace,index)=>`<button type="button" class="fortune-tuvi-palace ${index===selectedIndex?"is-active ":""}${palace.isOriginalPalace?"is-origin ":""}${palace.isBodyPalace?"is-body":""}" data-fortune-tuvi-palace="${index}"><header><b>${escapeHtml(palace.name)}</b><small>${escapeHtml(palace.heavenlyStem)} ${escapeHtml(palace.earthlyBranch)}</small></header><div>${stars(palace).slice(0,6).map((star)=>`<span class="${star.type === "major" ? "is-major" : ""}">${escapeHtml(starLabel(star))}</span>`).join("") || "<span>Không có chính/phụ tinh trong nhóm hiển thị</span>"}</div><footer>${palace.isOriginalPalace?"MỆNH ":""}${palace.isBodyPalace?"THÂN ":""}${escapeHtml(palace.changsheng12 || "")}</footer></button>`).join("")}</div>${selectedPalace?`<section class="fortune-tuvi-inspector"><header><div><small>CUNG ĐANG CHỌN · ${selectedPalace.index+1}/12</small><h3>${escapeHtml(selectedPalace.name)} · ${escapeHtml(selectedPalace.heavenlyStem)} ${escapeHtml(selectedPalace.earthlyBranch)}</h3></div><span>${selectedPalace.isOriginalPalace?"Cung Mệnh · ":""}${selectedPalace.isBodyPalace?"Cung Thân":""}</span></header><div class="fortune-tuvi-star-columns"><section><h4>Chính tinh</h4>${selectedPalace.majorStars.map((star)=>`<p><b>${escapeHtml(star.name)}</b><span>${escapeHtml(star.brightness || "Không ghi độ sáng")}${star.mutagen?` · Hóa ${escapeHtml(star.mutagen)}`:""}</span></p>`).join("")||"<p>Vô chính diệu theo dữ liệu engine.</p>"}</section><section><h4>Phụ tinh</h4>${selectedPalace.minorStars.map((star)=>`<p><b>${escapeHtml(star.name)}</b><span>${escapeHtml(star.brightness || star.type)}</span></p>`).join("")||"<p>Không có trong nhóm phụ tinh.</p>"}</section><section><h4>Vòng và đại hạn</h4><p><b>Tràng Sinh</b><span>${escapeHtml(selectedPalace.changsheng12 || "—")}</span></p><p><b>Bác Sĩ</b><span>${escapeHtml(selectedPalace.boshi12 || "—")}</span></p><p><b>Đại hạn</b><span>${selectedPalace.decadal?.range?.join("–") || "—"} tuổi · ${escapeHtml(selectedPalace.decadal?.heavenlyStem || "")} ${escapeHtml(selectedPalace.decadal?.earthlyBranch || "")}</span></p></section></div><details><summary>Sao bổ trợ và niên hệ</summary><p>${selectedPalace.adjectiveStars.map((star)=>escapeHtml(star.name)).join(" · ") || "Không có dữ liệu."}</p><p>Tuế tiền: ${escapeHtml(selectedPalace.suiqian12 || "—")} · Tướng tiền: ${escapeHtml(selectedPalace.jiangqian12 || "—")}.</p></details><p class="fortune-ai-privacy">HH AI phân tích cấu trúc 12 cung và tên sao đã tính trong tab riêng; ngày, giờ sinh và giới tính không được gửi. Không dùng cung Tật Ách để chẩn đoán sức khỏe.</p></section>`:""}<footer class="fortune-tuvi-method"><strong>Phương pháp & giới hạn</strong><p>${escapeHtml(result.method)}. ${result.limitations.map(escapeHtml).join(" ")}</p><a href="https://github.com/SylarLong/iztro" target="_blank" rel="noopener noreferrer">iztro ${escapeHtml(extendedTools()?.IZTRO_VERSION || "2.6.0")} · MIT</a></footer></article>` : `<div class="fortune-empty fortune-empty--compact"><i>紫</i><strong>Chưa lập lá số Tử Vi</strong><p>Nhập ngày, giờ địa phương và lựa chọn giới tính theo quy tắc của engine. Hệ thống không tự đoán giờ sinh.</p></div>`;
    return `${toolbarMarkup("Tử Vi Đẩu Số · 12 cung", "Lập lá số thật bằng iztro, xem Mệnh/Thân, chính tinh, phụ tinh, Tứ Hóa, đại hạn; luận giải nằm trong tab HH AI.")}<section class="fortune-tuvi fortune-tuvi-pro"><article class="fortune-calc-card"><header><i>紫</i><div><small>12 PALACES · MAJOR / MINOR STARS</small><h3>Dữ liệu lập lá số</h3></div></header><div class="fortune-v4-inline-fields"><label><span>Ngày sinh dương lịch</span><input type="date" data-fortune-tuvi-date value="${escapeHtml(runtime.session.tuviDate || runtime.profile.date || "")}"></label><label><span>Giờ sinh địa phương</span><input type="time" data-fortune-tuvi-time value="${escapeHtml(runtime.session.tuviTime || runtime.profile.time || "")}"></label><label><span>Giới tính theo quy tắc an sao</span><select data-fortune-tuvi-gender><option value="male"${runtime.session.tuviGender!=="female"?" selected":""}>Nam</option><option value="female"${runtime.session.tuviGender==="female"?" selected":""}>Nữ</option></select></label><label class="fortune-check"><input type="checkbox" data-fortune-tuvi-fix-leap ${runtime.session.tuviFixLeap!==false?"checked":""}><span>Hiệu chỉnh tháng nhuận theo engine</span></label></div><button class="fortune-primary" type="button" data-fortune-tuvi-calc>Lập lá số có chứng thư</button><p class="fortune-ai-privacy"><b>Dữ liệu phiên:</b> ngày, giờ và giới tính chỉ dùng tại trình duyệt để lập lá số; HH AI chỉ nhận danh sách cung/sao đã loại thông tin gốc.</p></article>${chart}</section>`;
  }

  function physiognomyMarkup(runtime) {
    const options = extendedTools()?.physiognomyOptions?.() || {}; const values = runtime.session.physiognomyValues || {}; const result = runtime.session.physiognomyResult;
    const selectors = Object.entries(options).map(([id, field]) => `<label><span>${escapeHtml(field.label)}</span><select data-fortune-physio-field="${escapeHtml(id)}">${Object.entries(field.options).map(([value,label])=>`<option value="${escapeHtml(value)}"${values[id]===value?" selected":""}>${escapeHtml(label)}</option>`).join("")}</select></label>`).join("");
    const output = result?.ok ? `<article class="fortune-physio-result" data-fortune-result><header><div><small>SELF-DESCRIBED · NO CAMERA · NO BIOMETRICS</small><h3>Bản quan sát tướng pháp có kiểm chứng</h3></div><span>5 nhóm mô tả</span></header><div>${result.observations.map((item,index)=>`<section style="--physio-order:${index}"><span>${escapeHtml(item.category)}</span><h4>${escapeHtml(item.label)}</h4><p><b>Liên tưởng trong tướng pháp:</b> ${escapeHtml(item.tradition)}</p><p><b>Câu hỏi kiểm chứng:</b> ${escapeHtml(item.question)}</p></section>`).join("")}</div><details open><summary>Giới hạn bắt buộc</summary><ul>${result.limitations.map((item)=>`<li>${escapeHtml(item)}</li>`).join("")}</ul><p>${escapeHtml(result.privacy)}</p></details><button type="button" data-fortune-save-current>Lưu tóm tắt không chứa ảnh</button></article>` : `<div class="fortune-empty fortune-empty--compact"><i>◌</i><strong>Tự mô tả thay vì tải ảnh</strong><p>Chọn các nét bạn tự quan sát. Công cụ không mở camera, không nhận diện khuôn mặt và không suy luận đặc điểm nhạy cảm.</p></div>`;
    const ai = result?.ok ? automaticAiMarkup(runtime, "physiognomy", "Các quan sát tự chọn và câu hỏi kiểm chứng vẫn dùng được tại chỗ.") : "";
    return `${toolbarMarkup("Nhân tướng học · Self-observation Lab", "Tách mô tả hình học, liên tưởng văn hóa và câu hỏi tự kiểm chứng; không giả làm khoa học nhận diện tính cách.")}<section class="fortune-physiognomy"><article class="fortune-calc-card fortune-calc-card--wide"><header><i>◌</i><div><small>HISTORICAL SYMBOLISM · LOCAL FIRST</small><h3>Tự chọn đặc điểm quan sát được</h3></div></header><div class="fortune-physio-form">${selectors}</div><button class="fortune-primary" type="button" data-fortune-physio-calc>Tạo bản chiêm nghiệm & tự phân tích</button><p class="fortune-ai-privacy">Không tải ảnh, không mở camera và không tạo mẫu sinh trắc học. HH AI chỉ nhận nhãn văn hóa bạn tự chọn cùng câu hỏi kiểm chứng; không nhận ảnh hay dữ liệu định danh. Không dùng kết quả cho tuyển dụng, hẹn hò, tín dụng, y tế hoặc đánh giá con người.</p></article>${output}${ai}</section>`;
  }

  function dreamsMarkup(runtime) {
    const result = runtime.session.dreamResult;
    const output = result?.ok ? `<article class="fortune-dream-result" data-fortune-result><header><div><small>LOCAL SYMBOL MAP · ${result.wordCount} TỪ</small><h3>Bản đồ biểu tượng trong giấc mơ</h3></div><span>${escapeHtml(result.emotion)}</span></header><div class="fortune-dream-symbols">${result.matches.map((item)=>`<section><b>${escapeHtml(item.matched.join(" · ") || item.id)}</b><p>${escapeHtml(item.reflection)}</p><ul>${item.questions.map((question)=>`<li>${escapeHtml(question)}</li>`).join("")}</ul></section>`).join("") || `<section><b>Không ép biểu tượng</b><p>Thư viện không tìm thấy biểu tượng rõ. Hãy bắt đầu từ cảm xúc, bối cảnh và trải nghiệm cá nhân thay vì dùng từ điển chung.</p></section>`}</div><section class="fortune-dream-prompts"><h4>Bốn bước ghi lại</h4>${result.prompts.map((prompt,index)=>`<p><b>${index+1}</b>${escapeHtml(prompt)}</p>`).join("")}</section><details open><summary>Riêng tư & giới hạn</summary><p>${escapeHtml(result.privacy)}</p><ul>${result.limitations.map((item)=>`<li>${escapeHtml(item)}</li>`).join("")}</ul></details></article>` : `<div class="fortune-empty fortune-empty--compact"><i>☁</i><strong>Ghi điều còn nhớ</strong><p>Công cụ tìm biểu tượng ngay trong trình duyệt, không gửi dịch vụ AI và không tự lưu nội dung giấc mơ.</p></div>`;
    const ai = result?.ok ? automaticAiMarkup(runtime, "dreams", "Bản đồ biểu tượng cục bộ vẫn dùng được; nội dung gốc không rời trình duyệt.") : "";
    return `${toolbarMarkup("Giấc mơ & Symbol Journal", "Tìm mô-típ, cảm xúc và câu hỏi suy ngẫm theo bối cảnh cá nhân; không dùng từ điển giấc mơ như lời dự báo.")}<section class="fortune-dreams"><article class="fortune-calc-card fortune-calc-card--wide"><header><i>☁</i><div><small>LOCAL-FIRST · NO AUTO SAVE</small><h3>Mô tả giấc mơ</h3></div></header><label><span>Nội dung chỉ nằm trong tab hiện tại</span><textarea rows="7" maxlength="2400" data-fortune-dream-text placeholder="Viết bối cảnh, người/vật xuất hiện, chuyển động và cảm xúc...">${escapeHtml(runtime.session.dreamText || "")}</textarea></label><label><span>Cảm xúc nổi bật</span><select data-fortune-dream-emotion>${[["curious","Tò mò"],["calm","Bình tĩnh"],["joy","Vui"],["fear","Sợ"],["sad","Buồn"],["confused","Bối rối"]].map(([id,label])=>`<option value="${id}"${runtime.session.dreamEmotion===id?" selected":""}>${label}</option>`).join("")}</select></label><button class="fortune-primary" type="button" data-fortune-dream-calc>Phân tích tại chỗ & tự gợi mở</button><p class="fortune-ai-privacy">Nội dung giấc mơ thô không được gửi đi. HH AI chỉ nhận cảm xúc đã chọn và các mô-típ do engine cục bộ khớp; không tự lưu nhật ký.</p></article>${output}${ai}</section>`;
  }

  function moonMarkup(runtime) {
    const result = runtime.session.moon; const sky = runtime.session.moonAstronomy; const illumination = sky?.ok ? sky.illuminatedPercent : result?.illumination;
    const viewer = result ? `<div class="fortune-moon-3d-shell"><canvas data-fortune-moon-3d data-phase-angle="${sky?.ok ? sky.phaseAngle : Math.round(result.phase * 360)}" data-waxing="${sky?.waxing ?? result.waxing}" aria-label="Mô hình Mặt Trăng 3D tương tác"></canvas><div class="fortune-moon-3d-fallback" style="--moon-light:${illumination}%"><span>${escapeHtml(result.symbol)}</span></div><div class="fortune-moon-3d-controls"><button type="button" data-fortune-moon-3d-toggle>⏸ Tạm dừng</button><button type="button" data-fortune-moon-3d-reset>↺ Góc nhìn</button></div><small>Kéo để xoay · Texture LRO/LOLA · NASA SVS</small></div>` : "";
    const details = result ? `<article class="fortune-moon-result fortune-moon-result--3d" data-fortune-result>${viewer}<section><small>${escapeHtml(result.date)} · ${(sky?.waxing ?? result.waxing) ? "Đang sáng dần" : "Đang khuyết dần"}</small><h3>${escapeHtml(result.name)}</h3><div class="fortune-view-tabs"><span>THIÊN VĂN</span><span>QUAN SÁT</span><span>CHIÊM NGHIỆM</span></div><div class="fortune-moon-metrics">${[["Góc pha",sky?.ok?`${sky.phaseAngle}°`:`${Math.round(result.phase*360)}° xấp xỉ`],["Chiếu sáng",`${illumination}%`],["Tuổi trăng",`${sky?.ok?sky.ageDays:result.ageDays} ngày`],["Khoảng cách",sky?.ok?`${sky.distanceKm.toLocaleString("vi-VN")} km`:"Cần Astronomy Engine"],["Mọc",sky?.localTimes?.rise||sky?.rise||"Không có trong cửa sổ"],["Lặn",sky?.localTimes?.set||sky?.set||"Không có trong cửa sổ"],["Transit",sky?.localTimes?.transit||sky?.transit||"Không có"],["Vị trí hiện tại",sky?.currentPosition?`${sky.currentPosition.altitude}° cao · ${sky.currentPosition.azimuth}° phương vị`:"Chưa tính"]].map(([label,value])=>`<div><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</div>${sky?.ok ? `<div class="fortune-moon-timeline">${sky.phaseTimeline.map((event) => `<div><i>${["●","◐","○","◑"][event.quarter] || "•"}</i><span>${escapeHtml(event.label)}</span><time>${escapeHtml(formatDateTime(event.time))}</time></div>`).join("")}</div><details><summary>Sự kiện tiếp theo & điều kiện quan sát</summary><dl><div><dt>${escapeHtml(sky.nextApsis.kind)}</dt><dd>${sky.nextApsis.distanceKm.toLocaleString("vi-VN")} km · ${escapeHtml(formatDateTime(sky.nextApsis.time))}</dd></div><div><dt>Nguyệt thực</dt><dd>${escapeHtml(sky.nextLunarEclipse.kind || "—")} · ${escapeHtml(formatDateTime(sky.nextLunarEclipse.time))}</dd></div><div><dt>Chân trời</dt><dd>Có khúc xạ chuẩn; chưa mô hình hóa núi, nhà và thời tiết.</dd></div></dl></details>` : ""}<details open><summary>Chiêm nghiệm · tách khỏi thiên văn</summary><p>${escapeHtml(result.reflection)}. Đây là câu dẫn viết nhật ký, không khẳng định pha trăng quyết định giấc ngủ, hành vi hoặc sức khỏe.</p></details><button type="button" data-fortune-save-current>Lưu phần tóm tắt</button></section></article>` : `<div class="fortune-empty fortune-empty--compact"><i>☾</i><strong>Chọn một ngày để bắt đầu</strong><p>Mô hình 3D tải lười sau khi có kết quả thiên văn.</p></div>`;
    const ai = result ? automaticAiMarkup(runtime, "moon", "Pha, độ sáng, tuổi trăng và dữ liệu quan sát vẫn dùng được từ engine thiên văn.") : "";
    return `${toolbarMarkup("Moon 3D Observatory", "Mô hình WebGL dùng texture NASA LRO, pha theo góc chiếu, dữ liệu mọc/lặn, transit, khoảng cách và timeline.")}<section class="fortune-moon"><div class="fortune-calc-card"><header><i>☾</i><div><small>REAL 3D · LRO / LOLA</small><h3>Mặt Trăng theo ngày và vị trí</h3></div></header><label><span>Ngày cần xem</span><input type="date" min="1900-01-01" max="2100-12-31" data-fortune-moon-date value="${escapeHtml(runtime.session.moonDate || localDateKey())}"></label><button class="fortune-primary" type="button" data-fortune-moon-calc>Tính, dựng 3D & tự giải thích</button><button type="button" data-fortune-moon-today>Hôm nay</button><button type="button" data-fortune-view="sky">Mở lịch bầu trời đầy đủ</button><p class="fortune-hint">Mọc/lặn phụ thuộc vị trí hồ sơ. Mô hình dùng texture cho trực quan; Astronomy Engine mới là nguồn số liệu.</p></div>${details}${ai}</section><p class="fortune-media-credit">Moon texture: NASA Scientific Visualization Studio · LRO/LROC/LOLA. NASA không bảo trợ HH Platform.</p>`;
  }

  function skyV4Markup(runtime) {
    const result = runtime.session.sky;
    const localTime = (value) => escapeHtml(value || "Không có trong cửa sổ");
    const output = result?.ok ? `<article class="fortune-v4-card fortune-sky-dashboard" data-fortune-result><header><div><span>${escapeHtml(result.date)} · ${escapeHtml(result.instantUtc)}</span><strong>${result.illuminatedPercent}% chiếu sáng · ${result.distanceKm.toLocaleString("vi-VN")} km</strong></div><button type="button" data-fortune-view="moon">Mở Moon 3D</button></header><div class="fortune-sky-metrics">${[["Tuổi trăng",`${result.ageDays} ngày`],["Mọc địa phương",result.localTimes?.rise||result.rise],["Qua kinh tuyến",result.localTimes?.transit||result.transit],["Lặn địa phương",result.localTimes?.set||result.set],["Độ cao / phương vị",result.currentPosition?`${result.currentPosition.altitude}° / ${result.currentPosition.azimuth}°`:"Không có"],[result.nextApsis.kind,`${result.nextApsis.distanceKm.toLocaleString("vi-VN")} km`],["Nguyệt thực tiếp",`${result.nextLunarEclipse.kind || "—"} · ${formatDateTime(result.nextLunarEclipse.time)}`],["Nhật thực tiếp",`${result.nextSolarEclipse.kind || "—"} · ${formatDateTime(result.nextSolarEclipse.time)}`]].map(([label,value])=>`<div><span>${escapeHtml(label)}</span><strong>${localTime(value)}</strong></div>`).join("")}</div><div class="fortune-sky-sections"><section><h4>Ba mức chạng vạng</h4>${Object.entries(result.twilight || {}).map(([id,item])=>`<div><b>${escapeHtml(id)}</b><span>Bình minh ${escapeHtml(formatDateTime(item.dawn))}</span><span>Hoàng hôn ${escapeHtml(formatDateTime(item.dusk))}</span></div>`).join("")}</section><section><h4>Cửa sổ hành tinh</h4>${result.planetEvents.map((item)=>`<div><b>${escapeHtml(item.body)}</b><span>Mọc ${escapeHtml(formatDateTime(item.rise))}</span><span>Lặn ${escapeHtml(formatDateTime(item.set))}</span></div>`).join("")}</section><section><h4>Mốc mùa</h4>${Object.entries(result.seasons || {}).map(([name,time])=>`<div><b>${escapeHtml(name)}</b><span>${escapeHtml(formatDateTime(time))}</span></div>`).join("")}</section></div><details open><summary>Checklist quan sát thực tế</summary><ol><li>Kiểm tra thời tiết, mây và tầm nhìn bằng dịch vụ thời tiết riêng.</li><li>Đối chiếu vật cản chân trời; engine chưa biết nhà, cây hoặc núi tại chỗ.</li><li>Dùng ánh sáng đỏ và bảo vệ mắt; không nhìn Mặt Trời qua thiết bị quang học thiếu lọc chuyên dụng.</li><li>Timestamp UTC và local đều được giữ trong Result Contract.</li></ol></details><div class="fortune-result-actions"><button type="button" data-fortune-save-current>Lưu tóm tắt</button><button type="button" data-fortune-copy-result>Sao chép</button></div></article>` : `<div class="fortune-empty fortune-empty--compact"><i>✺</i><strong>Chưa có dữ liệu bầu trời</strong><p>Chạy phép tính sau khi Hồ sơ phiên có timezone và tọa độ.</p></div>`;
    const ai = result?.ok ? automaticAiMarkup(runtime, "sky", "Bảng dữ liệu bầu trời và checklist quan sát vẫn dùng được độc lập.") : "";
    return `${toolbarMarkup("Astronomy & Sky Planner", "Pha, mọc/lặn, transit, twilight, apsis, eclipse, mùa và hành tinh — không gán điềm báo.")}<section class="fortune-v4-workspace fortune-sky-studio"><div class="fortune-v4-two-col"><article class="fortune-v4-card fortune-v4-form"><header><span>MOON & SKY</span><strong>Dữ liệu phụ thuộc vị trí</strong></header><label><span>Ngày</span><input type="date" data-fortune-sky-date value="${escapeHtml(runtime.session.skyDate || localDateKey())}"></label><button class="fortune-primary" type="button" data-fortune-sky-calc>Tính bầu trời & tự lập kế hoạch</button><small class="fortune-hint">Vĩ độ, kinh độ, độ cao và timezone lấy từ Hồ sơ phiên.</small></article><article class="fortune-v4-card"><header><span>PHƯƠNG PHÁP</span><strong>Astronomy Engine 2.1.19</strong></header><p>VSOP87/NOVAS, topocentric horizon và khúc xạ chuẩn. Không dùng kết quả cho điều hướng hoặc an toàn hàng không/hàng hải.</p><button type="button" data-fortune-view="profile">Kiểm tra địa điểm</button></article></div>${output}${ai}</section>`;
  }

  function compatibilityMarkup(runtime) {
    const result = runtime.session.compatibility; const goal = runtime.session.compareGoal || "trao đổi rõ một vấn đề"; const cadence = runtime.session.compareCadence || "weekly";
    const cadenceLabel = { once:"một cuộc trao đổi", weekly:"kiểm tra lại mỗi tuần", monthly:"kiểm tra lại mỗi tháng" }[cadence] || "kiểm tra lại mỗi tuần";
    const plan = result ? `<article class="fortune-communication-plan"><header><small>INTERACTION PLAN · KHÔNG CHẤM ĐIỂM HỢP/KHẮC</small><h3>Kế hoạch giao tiếp có thể thực hiện</h3></header><div class="fortune-profile-pair"><div><b>A</b><span>${escapeHtml(result.first.western.name)} · ${escapeHtml(result.first.chinese.animal)}</span><small>Đường đời ${result.first.lifePath}</small></div><i>↔</i><div><b>B</b><span>${escapeHtml(result.second.western.name)} · ${escapeHtml(result.second.chinese.animal)}</span><small>Đường đời ${result.second.lifePath}</small></div></div><section><h4>Mục tiêu phiên</h4><p>${escapeHtml(goal)}</p><h4>Điểm cần giữ riêng</h4><p>${escapeHtml(result.sharedFocus)} ${escapeHtml(result.cycleRelation)}</p><h4>Ba câu hỏi trao đổi trực tiếp</h4><ol>${result.prompts.map((prompt)=>`<li>${escapeHtml(prompt)}</li>`).join("")}</ol><h4>Thỏa thuận thử nghiệm</h4><ul><li>Mỗi người nói tối đa 3 phút trước khi phản hồi.</li><li>Nhắc lại điều đã hiểu và hỏi xác nhận, không suy đoán ý định.</li><li>Chọn một thay đổi nhỏ; ${escapeHtml(cadenceLabel)} rồi mới quyết định bước tiếp.</li><li>Dừng nếu thiếu đồng thuận hoặc cuộc trao đổi không còn an toàn.</li></ul><button type="button" data-fortune-save-current>Lưu tóm tắt không chứa ngày sinh</button></section></article>` : `<div class="fortune-empty fortune-empty--compact"><i>∞</i><strong>So sánh để tạo câu hỏi, không để gán nhãn</strong><p>Hai ngày sinh chỉ ở trong phiên; kết quả không đo tình cảm, độ tin cậy hoặc tương lai quan hệ.</p></div>`;
    return `${toolbarMarkup("Interaction & Communication Lab", "Đặt hai hệ biểu tượng cạnh nhau rồi chuyển thành mục tiêu, câu hỏi, ranh giới và lịch kiểm tra thực tế.")}<section class="fortune-compatibility fortune-compatibility-pro"><div class="fortune-calc-card fortune-calc-card--wide"><header><i>∞</i><div><small>TWO-PROFILE REFLECTION</small><h3>Tạo kế hoạch đối thoại trung lập</h3></div></header><div class="fortune-profile-grid"><fieldset><legend>Người A</legend><label><span>Ngày sinh</span><input type="date" data-fortune-compare-a value="${escapeHtml(runtime.session.compareA || "")}"></label><label class="fortune-check"><input type="checkbox" data-fortune-compare-before-a ${runtime.session.compareBeforeA ? "checked" : ""}><span>Sinh trước Tết âm lịch</span></label></fieldset><fieldset><legend>Người B</legend><label><span>Ngày sinh</span><input type="date" data-fortune-compare-b value="${escapeHtml(runtime.session.compareB || "")}"></label><label class="fortune-check"><input type="checkbox" data-fortune-compare-before-b ${runtime.session.compareBeforeB ? "checked" : ""}><span>Sinh trước Tết âm lịch</span></label></fieldset></div><div class="fortune-form-grid"><label><span>Bối cảnh</span><select data-fortune-compare-context><option value="relationship"${runtime.session.compareContext === "relationship" ? " selected" : ""}>Mối quan hệ</option><option value="friendship"${runtime.session.compareContext === "friendship" ? " selected" : ""}>Tình bạn</option><option value="team"${runtime.session.compareContext === "team" ? " selected" : ""}>Làm việc nhóm</option></select></label><label><span>Nhịp kiểm tra lại</span><select data-fortune-compare-cadence><option value="once"${cadence === "once" ? " selected" : ""}>Một lần</option><option value="weekly"${cadence === "weekly" ? " selected" : ""}>Hàng tuần</option><option value="monthly"${cadence === "monthly" ? " selected" : ""}>Hàng tháng</option></select></label></div><label><span>Mục tiêu cuộc trao đổi</span><input type="text" maxlength="180" data-fortune-compare-goal value="${escapeHtml(goal)}"></label><button class="fortune-primary" type="button" data-fortune-compare>Tạo kế hoạch tương tác</button></div>${plan}</section>`;
  }

  function calendarMarkup(runtime) {
    const entries = buildReflectionCalendar(runtime.profile.date, runtime.calendarAnchor, runtime.calendarMode, runtime.state.history, activeJournal(runtime), runtime.profile.timezoneId);
    const anchor = parseLocalDate(runtime.calendarAnchor) || new Date(); const title = new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(anchor); const v4 = suiteV4();
    const years = [...new Set(entries.map((entry) => Number(entry.date.slice(0,4))))]; const termMap = new Map(years.flatMap((year)=>v4?.solarTerms?.(year, globalScope.Astronomy) || []).filter((term)=>term.time).map((term)=>[localDateKey(new Date(term.time)),term]));
    entries.forEach((entry)=>{ entry.solarTerm = termMap.get(entry.date) || null; }); const selectedDate = runtime.session.calendarSelectedDate || runtime.calendarAnchor; const selected = entries.find((entry)=>entry.date===selectedDate) || entries.find((entry)=>entry.today) || entries[0];
    const shortLunar = (label) => String(label || "Chưa có lịch âm").replace(/^ngày\s+/iu, "").replace(/\s+năm\s+.+$/iu, "").slice(0, 36);
    return `${toolbarMarkup("Lịch chiêm nghiệm Âm–Dương", "Ngày dương, nhãn lịch âm, pha trăng, tiết khí, chu kỳ, ghi chú và lịch sử — không gán ngày tốt/xấu.")}<section class="fortune-calendar fortune-calendar-pro"><header><div class="fortune-calendar-modes">${[["month","Tháng"],["week","Tuần"],["timeline","Timeline"]].map(([id,label])=>`<button type="button" class="${runtime.calendarMode===id?"is-active":""}" data-fortune-calendar-mode="${id}">${label}</button>`).join("")}</div><div class="fortune-calendar-nav"><button type="button" data-fortune-calendar-move="-1">←</button><button type="button" data-fortune-calendar-today>Hôm nay</button><button type="button" data-fortune-calendar-move="1">→</button></div><strong>${escapeHtml(title)}</strong></header>${runtime.calendarMode!=="timeline"?`<div class="fortune-calendar-weekdays">${["T2","T3","T4","T5","T6","T7","CN"].map((day)=>`<span>${day}</span>`).join("")}</div>`:""}<div class="fortune-calendar-layout"><div class="fortune-calendar-grid fortune-calendar-grid--${runtime.calendarMode}">${entries.map((entry)=>`<button type="button" class="fortune-calendar-day ${entry.today?"is-today ":""}${entry.currentMonth?"":"is-outside "}${entry.date===selected?.date?"is-selected":""}" data-fortune-calendar-date="${entry.date}"><header><time>${entry.day}</time><i title="${escapeHtml(entry.moon.name)}">${escapeHtml(entry.moon.symbol)}</i></header><small class="fortune-lunar-date">Âm · ${escapeHtml(shortLunar(entry.lunarLabel))}</small><span>${entry.moon.illumination}% · ${escapeHtml(entry.moon.name)}</span>${entry.solarTerm?`<b>${escapeHtml(entry.solarTerm.name)} · ${entry.solarTerm.longitude}°</b>`:""}${entry.cycles?`<em>Ngày cá nhân ${entry.cycles.personalDay}</em>`:""}<footer>${entry.saved?`<mark>${entry.saved} kết quả</mark>`:""}${entry.notes?`<mark>${entry.notes} ghi chú</mark>`:""}</footer></button>`).join("")}</div><aside class="fortune-calendar-inspector"><small>NGÀY ĐANG CHỌN</small><h3>${escapeHtml(selected?.date || "—")}</h3><strong>${escapeHtml(selected?.lunarLabel || "Không đọc được lịch âm")}</strong><div><span><i>${escapeHtml(selected?.moon.symbol || "☾")}</i>${escapeHtml(selected?.moon.name || "—")}</span><span>${selected?.moon.illumination || 0}% chiếu sáng</span><span>Tuổi trăng ${selected?.moon.ageDays || 0} ngày</span>${selected?.solarTerm?`<span>${escapeHtml(selected.solarTerm.name)} · Mặt Trời ${selected.solarTerm.longitude}°</span>`:"<span>Không có mốc tiết khí trong ngày</span>"}</div>${selected?.cycles?`<section><h4>Chu kỳ biểu tượng</h4><p>Năm ${selected.cycles.personalYear} · tháng ${selected.cycles.personalMonth} · ngày ${selected.cycles.personalDay}</p><small>Không phải đánh giá ngày tốt/xấu.</small></section>`:"<p>Thêm ngày sinh trong Hồ sơ phiên để xem chu kỳ cá nhân.</p>"}<section><h4>Dữ liệu đã lưu</h4><p>${selected?.saved||0} kết quả · ${selected?.notes||0} ghi chú trên thiết bị.</p></section><div class="fortune-result-actions"><button type="button" data-fortune-calendar-open-moon="${escapeHtml(selected?.date || localDateKey())}">Moon 3D ngày này</button><button type="button" data-fortune-view="journal">Mở nhật ký</button></div></aside></div><details class="fortune-calendar-method" open><summary>Phân biệt dữ liệu</summary><p>Ngày dương và lịch âm do runtime lịch tính; pha trăng là xấp xỉ hoặc Astronomy Engine; tiết khí là thời điểm kinh độ Mặt Trời; chu kỳ cá nhân là phép cộng biểu tượng; kết quả/ghi chú là dữ liệu local. Không lớp nào được dùng để gán cát/hung khách quan.</p></details></section>`;
  }

  function lenormandArtMarkup(card, extraClass = "") {
    return `<div class="fortune-lenormand-art ${extraClass}" role="img" aria-label="Lá ${card.number} ${escapeHtml(card.name)} từ bộ Game of Hope 1799" style="--sprite-x:${(card.spriteColumn || 0) * 20}%;--sprite-y:${(card.spriteRow || 0) * 20}%"></div>`;
  }

  function symbolsV4Markup(runtime) {
    const result = runtime.session.symbolDeck; const type = runtime.session.symbolType || "lenormand"; const focusIndex = result?.cards?.length ? clamp(runtime.session.symbolFocusIndex,0,result.cards.length-1,0) : 0; const focus = result?.cards?.[focusIndex];
    let output = `<div class="fortune-empty fortune-empty--compact"><i>✧</i><strong>Chọn một bộ để bắt đầu</strong><p>Lenormand dùng ảnh lịch sử public domain; Rune và Oracle giữ lớp ngôn ngữ/biểu tượng riêng.</p></div>`;
    if (result?.cards && type === "lenormand") {
      const reading = suiteV4()?.lenormandReading?.(result.cards) || { pairs:[],thirds:[],houses:[],guidance:[] };
      output = `<article class="fortune-lenormand-studio" data-fortune-result><header><div><small>GAME OF HOPE 1799 · PUBLIC DOMAIN</small><h3>${result.cards.length === 36 ? "Grand Tableau 8×4 + 4" : `${result.cards.length} lá · đọc dòng`}</h3></div><span>Seed ${escapeHtml(result.seed)} · ${escapeHtml((result.seedProof||"").slice(0,16))}…</span></header><div class="fortune-lenormand-filmstrip ${result.cards.length===36?"is-tableau":""}">${result.cards.map((card,index)=>`<button type="button" class="${index===focusIndex?"is-active":""}" data-fortune-symbol-focus="${index}" style="--card-order:${index}">${lenormandArtMarkup(card)}<span>${card.number}</span><small>${escapeHtml(card.name)}</small></button>`).join("")}</div>${focus?`<div class="fortune-lenormand-inspector">${lenormandArtMarkup(focus,"is-large")}<section><small>LÁ ${focus.number} · ${escapeHtml(focus.playingCard)} · ${escapeHtml(focus.englishName)}</small><h3>${escapeHtml(focus.name)}</h3><div class="fortune-keyword-row">${focus.keywords.map((keyword)=>`<b>${escapeHtml(keyword)}</b>`).join("")}</div><p>${escapeHtml(focus.prompt)}</p><h4>Cách chiêm nghiệm dễ dùng</h4><ol><li>Mô tả hình ảnh trước khi đọc từ khóa.</li><li>Đọc lá bên trái như bối cảnh và lá bên phải như phần tiếp nối.</li><li>Ghi một dữ kiện ủng hộ, một dữ kiện phản bác và điều chưa biết.</li><li>Chuyển thành một câu hỏi hoặc hành động nhỏ, không thành dự báo chắc chắn.</li></ol></section></div>`:""}<div class="fortune-lenormand-reading"><section><h4>Mạch tổng hợp</h4>${reading.thirds.map((part)=>`<article><strong>${escapeHtml(part.label)}</strong><p>${escapeHtml(part.cards.join(" · "))}</p><small>${escapeHtml(part.instruction)}</small></article>`).join("")||"<p>Rút ít nhất ba lá để tạo mạch tổng hợp.</p>"}</section><section><h4>Các cặp liền kề</h4>${reading.pairs.slice(0,result.cards.length===36?12:20).map((pair)=>`<details><summary>${escapeHtml(pair.label)}</summary><p>${escapeHtml(pair.reading)}</p><small>${escapeHtml(pair.question)}</small></details>`).join("")||"<p>Một lá được đọc như trọng tâm độc lập.</p>"}</section></div>${reading.houses.length?`<details class="fortune-grand-tableau-guide"><summary>Grand Tableau · 36 nhà và lá đại diện</summary><ul>${reading.guidance.map((item)=>`<li>${escapeHtml(item)}</li>`).join("")}</ul><div>${reading.houses.map((house)=>`<span class="${house.match?"is-match":""}"><b>${house.position}</b>${escapeHtml(house.card.name)}<small>nhà ${escapeHtml(house.house.name)}</small></span>`).join("")}</div><p>Lá Người nam: ${reading.significators.man?`hàng ${reading.significators.man.row}, cột ${reading.significators.man.column}`:"không có"} · Lá Người nữ: ${reading.significators.woman?`hàng ${reading.significators.woman.row}, cột ${reading.significators.woman.column}`:"không có"}. Chỉ chọn significator khi người dùng tự xác định.</p></details>`:""}<div class="fortune-result-actions"><button type="button" data-fortune-save-current>Lưu tóm tắt</button><button type="button" data-fortune-copy-result>Sao chép</button></div><p class="fortune-media-credit">Johann Kaspar Hechtel, Das Spiel der Hoffnung (1799) · Public Domain Mark 1.0 · nguồn file Wikimedia Commons. Diễn giải tiếng Việt do HH tự biên soạn.</p></article>`;
    } else if (result?.cards) {
      output = `<article class="fortune-v4-card" data-fortune-result><header><span>${escapeHtml(result.type)} · seed ${escapeHtml(result.seed)}</span><strong>${result.cards.length} biểu tượng</strong></header><div class="fortune-symbol-grid">${result.cards.map((card,index)=>`<button type="button" data-fortune-symbol-focus="${index}" class="${index===focusIndex?"is-active":""}"><i>${escapeHtml(card.symbol)}</i><small>${card.number||""}${card.transliteration?` · ${escapeHtml(card.transliteration)}`:""}</small><h3>${escapeHtml(card.name)}</h3><p>${escapeHtml(card.prompt)}</p></button>`).join("")}</div><div class="fortune-result-actions"><button type="button" data-fortune-save-current>Lưu tóm tắt</button><button type="button" data-fortune-copy-result>Sao chép</button></div></article>`;
    }
    return `${toolbarMarkup("Lenormand · Rune · Oracle Studio", "Lenormand có đủ 36 ảnh Game of Hope public domain, chuyển động, đọc cặp, đọc dòng và Grand Tableau có hướng dẫn.")}<section class="fortune-v4-workspace fortune-symbols-studio"><article class="fortune-v4-card fortune-v4-form"><div class="fortune-v4-inline-fields"><label><span>Bộ</span><select data-fortune-symbol-type><option value="lenormand"${type==="lenormand"?" selected":""}>Lenormand 36 · ảnh lịch sử</option><option value="runes"${type==="runes"?" selected":""}>Elder Futhark 24</option><option value="oracle"${type==="oracle"?" selected":""}>Oracle HH 24</option></select></label><label><span>Số lá</span><select data-fortune-symbol-count>${[1,3,5,9,24,36].filter((count)=>type==="lenormand"?count<=36:count<=24).map((count)=>`<option value="${count}"${Number(runtime.session.symbolCount||3)===count?" selected":""}>${type==="lenormand"&&count===36?"36 · Grand Tableau":count}</option>`).join("")}</select></label><label><span>Seed</span><input type="text" maxlength="180" data-fortune-symbol-seed value="${escapeHtml(runtime.session.symbolSeed||"")}" placeholder="Để trống để tạo mới"></label><label class="fortune-check"><input type="checkbox" data-fortune-rune-reversed ${runtime.session.runeAllowReversed?"checked":""}${type!=="runes"?" disabled":""}><span>Rune đảo · tùy chọn hiện đại</span></label></div><button class="fortune-primary" type="button" data-fortune-symbol-draw>Rút & tạo chứng thư</button></article>${output}</section>`;
  }

  function academyV4Markup(runtime) {
    const v4 = suiteV4(); const mode = runtime.session.academyMode || "meaning"; const round = runtime.session.academyRound || 1; const quiz = runtime.session.tarotQuiz || v4?.tarotQuiz?.(`academy-${round}`, { mode }); const review = runtime.session.academyReview; const tracks = v4?.TAROT_ACADEMY_TRACKS || []; const trackId = runtime.session.academyTrack || "foundation"; const lesson = v4?.tarotAcademyLesson?.(trackId, runtime.session.academyLessonIndex || 0); const answered = Boolean(runtime.session.academyAnswered); const flashRevealed = Boolean(runtime.session.academyFlashRevealed); const history = runtime.session.academyHistory || []; const correctCount = history.filter((item)=>item.correct).length;
    return `${toolbarMarkup("Tarot Academy · Learning OS", "8 lộ trình, 26 bài, flashcard, quiz không lộ đáp án, spaced repetition, lịch ôn và lịch sử luyện tập.")}<section class="fortune-academy fortune-academy-pro"><aside class="fortune-academy-curriculum"><header><small>LỘ TRÌNH</small><strong>${tracks.reduce((sum,track)=>sum+track.lessons.length,0)} bài học</strong></header>${tracks.map((track)=>`<button type="button" class="${track.id===lesson?.track.id?"is-active":""}" data-fortune-academy-track="${escapeHtml(track.id)}"><span>${escapeHtml(track.title)}</span><small>${escapeHtml(track.level)} · ${track.lessons.length} bài</small></button>`).join("")}</aside><main class="fortune-academy-lesson"><article class="fortune-v4-card"><header><span>${escapeHtml(lesson?.track.title || "Nền tảng")} · BÀI ${(lesson?.index||0)+1}/${lesson?.track.lessonCount||1}</span><strong>${escapeHtml(lesson?.lesson.title || "Đang tải")}</strong></header><p>${escapeHtml(lesson?.lesson.overview || "")}</p><ul>${(lesson?.lesson.objectives||[]).map((item)=>`<li>${escapeHtml(item)}</li>`).join("")}</ul><div class="fortune-academy-nav"><button type="button" data-fortune-academy-lesson="-1" ${lesson?.previous?"":"disabled"}>← Bài trước</button><button type="button" data-fortune-academy-lesson="1" ${lesson?.next?"":"disabled"}>Bài tiếp →</button></div></article><article class="fortune-academy-flashcard ${flashRevealed?"is-revealed":""}"><header><small>FLASHCARD · ACTIVE RECALL</small><strong>${escapeHtml(quiz?.card.name || "Tarot")}</strong></header>${quiz?.card.image?`<img src="${escapeHtml(quiz.card.image)}" alt="Hình lá Tarot để tự nhớ" width="240" height="412" loading="lazy">`:""}<div>${flashRevealed?`<p><b>Mặt sáng:</b> ${escapeHtml(quiz?.card.light || "")}</p><p><b>Góc khuất:</b> ${escapeHtml(quiz?.card.shadow || "")}</p><p><b>Câu hỏi:</b> ${escapeHtml(quiz?.card.question || "")}</p>`:`<p>Tự nói tên, nhóm, nguyên tố và một câu hỏi mở trước khi lật mặt sau.</p>`}</div><button type="button" data-fortune-academy-flash>${flashRevealed?"Ẩn mặt sau":"Lật mặt sau"}</button></article></main><aside class="fortune-academy-practice"><article class="fortune-v4-card"><header><span>QUIZ · ROUND ${round}</span><strong>Không hiện đáp án trước khi nộp</strong></header><label><span>Dạng bài</span><select data-fortune-academy-mode>${[["meaning","Diễn giải sáng"],["name","Tên từ ảnh"],["element","Nhóm / nguyên tố"],["symbol","Biểu tượng"],["number","Số và cấu trúc"],["court","Court Card"]].map(([id,label])=>`<option value="${id}"${mode===id?" selected":""}>${label}</option>`).join("")}</select></label>${quiz?`<div class="fortune-academy-card">${quiz.card.image?`<img src="${escapeHtml(quiz.card.image)}" alt="Hình lá Tarot để nhận diện" width="260" height="446" loading="lazy">`:`<i>${quiz.card.symbol}</i>`}<strong>${escapeHtml(quiz.question)}</strong><div>${quiz.answers.map((answer,index)=>`<button type="button" data-fortune-academy-answer="${index}" ${answered?"disabled":""}>${escapeHtml(answer)}</button>`).join("")}</div><small data-fortune-academy-feedback>${escapeHtml(answered ? runtime.session.academyFeedback : "Chọn một phương án; đáp án và giải thích vẫn khóa.")}</small>${answered?`<div class="fortune-confidence"><span>Mức tự tin sau khi xem đáp án</span>${[0,1,2,3,4].map((score)=>`<button type="button" data-fortune-academy-confidence="${score}">${score}</button>`).join("")}</div>`:""}</div>`:""}<button type="button" data-fortune-academy-next>Câu hỏi mới</button></article><article class="fortune-academy-progress"><div><b>${history.length}</b><span>Lượt luyện</span></div><div><b>${history.length?Math.round(correctCount/history.length*100):0}%</b><span>Chính xác</span></div><div><b>${review?.intervalDays||0}</b><span>Ngày tới ôn</span></div><div><b>${review?.ease||2.5}</b><span>Hệ số dễ</span></div><details><summary>Lịch sử gần đây</summary>${history.slice(-8).reverse().map((item)=>`<p><b>${item.correct?"✓":"↺"}</b>${escapeHtml(item.cardName)} · ${escapeHtml(item.mode)}<small>${escapeHtml(formatDateTime(item.at))}</small></p>`).join("")||"<p>Chưa có lượt luyện.</p>"}</details></article></aside></section>`;
  }

  function supplementalExplanation(runtime, view) {
    if (view === "zodiac" && (runtime.session.western || runtime.session.chinese)) {
      const western = runtime.session.western; const chinese = runtime.session.chinese;
      return explanationMarkup(runtime, "Giải thích cung và chu kỳ năm sinh", [
        { label: "Dữ liệu đầu vào", text: `Ngày dùng cho cung: ${runtime.session.zodiacDate || runtime.profile.date || "chưa có"}; ngày con giáp: ${runtime.session.chineseDate || runtime.profile.date || "chưa có"}.` },
        { label: "Cung Mặt Trời", text: western?.ok ? `${western.sign.name} thuộc nguyên tố ${western.sign.element}, tính chất ${western.sign.modality}; Mặt Trời ở kinh độ ${western.sign.longitude}° tại ${western.instantUtc}.` : "Chưa tính cung Mặt Trời." },
        { label: "Ranh giới cung", text: western?.ok ? `${western.nearBoundary ? "Kết quả gần ranh giới; cần giờ sinh để thu hẹp." : "Khoảng cả ngày không vượt ranh giới cung."} Biên gần nhất cách ${western.distanceToBoundaryDegrees}°.` : "Engine sẽ quét cả ngày nếu không biết giờ." },
        { label: "Con giáp", text: chinese ? `Năm chu kỳ ${chinese.cycleYear}: ${chinese.branch} (${chinese.animal}), ${chinese.yinYang} ${chinese.element}.` : "Chưa tính con giáp." },
        { label: "Mốc đổi năm", text: chinese ? `${chinese.boundaryLabel}: ${chinese.formula} Hai phương pháp không bị trộn.` : "Chọn Tết Âm lịch hoặc Lập Xuân trước khi tính." },
        { label: "Cách đọc", text: "Xem từ khóa như giả thuyết để đối chiếu hành vi thật, không xem là nhãn tính cách cố định." },
        { label: "Câu hỏi thực tế", text: "Trong hoàn cảnh nào đặc điểm được gợi ý xuất hiện, và khi nào nó hoàn toàn không đúng?" },
        { label: "Giới hạn", text: "Cung và con giáp không đánh giá sức khỏe, đạo đức, năng lực hoặc mức độ phù hợp giữa hai người." }
      ]);
    }
    if (view === "moon" && runtime.session.moon) {
      const moon = runtime.session.moon;
      return explanationMarkup(runtime, "Giải thích dữ liệu Mặt Trăng", [
        { label: "Ngày tính", text: moon.date },
        { label: "Vị trí chu kỳ", text: `${Math.round(moon.phase*100)}% chu kỳ giao hội; tuổi trăng xấp xỉ ${moon.ageDays} ngày.` },
        { label: "Độ chiếu sáng", text: `${moon.illumination}% đĩa trăng được chiếu sáng theo mô hình; ${moon.waxing ? "đang tăng" : "đang giảm"}.` },
        { label: "Tên pha", text: `${moon.name}; tên pha được chọn từ tám giai đoạn truyền thống dựa trên vị trí chu kỳ.` },
        { label: "Nguồn thiên văn", text: "US Naval Observatory và NASA mô tả chu kỳ trung bình khoảng 29,5 ngày và quan hệ giữa pha với phần chiếu sáng." },
        { label: "Phần biểu tượng", text: `Gợi ý “${moon.reflection}” chỉ là câu dẫn để viết nhật ký, không phải ảnh hưởng vật lý được ứng dụng khẳng định.` },
        { label: "Sai số", text: moon.method },
        { label: "Giới hạn", text: "Không tính mọc/lặn, địa hình, khúc xạ khí quyển hay vị trí quan sát. Dùng lịch thiên văn chuyên dụng cho quan sát." }
      ]);
    }
    if (view === "compatibility" && runtime.session.compatibility) {
      const result = runtime.session.compatibility;
      return explanationMarkup(runtime, "Đọc bản đối chiếu mà không gán nhãn con người", [
        { label: "Mục đích", text: "Tạo câu hỏi giao tiếp từ hai bộ biểu tượng, không đo mức độ yêu thương, tin cậy hoặc thành công." },
        { label: "Hồ sơ A", text: `${result.first.western.name}, ${result.first.chinese.animal}, đường đời ${result.first.lifePath}.` },
        { label: "Hồ sơ B", text: `${result.second.western.name}, ${result.second.chinese.animal}, đường đời ${result.second.lifePath}.` },
        { label: "Nguyên tố", text: result.sharedFocus },
        { label: "Con số", text: result.cycleRelation },
        { label: "Câu hỏi nên trao đổi", text: result.prompts.join(" ") },
        { label: "Kiểm chứng", text: "Mỗi người tự trả lời rồi so sánh, không suy đoán câu trả lời của người còn lại." },
        { label: "Giới hạn", text: "Không có điểm hợp/khắc, xác suất chia tay, kết luận tâm lý hoặc lời khuyên thay cho giao tiếp và đồng thuận." }
      ]);
    }
    return "";
  }

  function hasFortuneResult(runtime, view = runtime.state.view) {
    if (currentResultContract(runtime, view)) return true;
    const checks = {
      tarot: runtime.session.tarot?.length, symbols: runtime.session.symbolDeck?.cards?.length, zodiac: runtime.session.western?.ok || runtime.session.chinese?.ok,
      numerology: runtime.session.numerology, iching: runtime.session.ichingAdvanced?.ok || runtime.session.iching, chart: runtime.session.astrologyV4?.ok,
      tuvi: runtime.session.tuvi?.ok, physiognomy: runtime.session.physiognomyResult?.ok, dreams: runtime.session.dreamResult?.ok, moon: runtime.session.moon,
      sky: runtime.session.sky?.ok, eastern: runtime.session.eastern?.ok, compatibility: runtime.session.compatibility, session: runtime.builder?.result
    };
    return Boolean(checks[view]);
  }
  function fortuneAiState(runtime, view = runtime.state.view) { return runtime.session[`${view}Ai`] || null; }
  function workflowStepperMarkup(runtime) {
    const view = runtime.state.view; if (["today","profile","academy","calendar","journal","methods","accuracy","history"].includes(view)) return "";
    const hasResult = hasFortuneResult(runtime, view);
    const activeIndex = Number.isInteger(runtime.flowStep) ? runtime.flowStep : !hasResult ? 0 : runtime.resultTab === "reflection" ? 3 : 2;
    return `<nav class="fortune-flow-stepper" aria-label="Tiến trình phiên"><div>${FLOW_STEPS.map(([id,label], index) => `<button type="button" class="${index < activeIndex ? "is-done" : index === activeIndex ? "is-current" : ""}" data-fortune-flow-step="${index}" aria-current="${index === activeIndex ? "step" : "false"}"><i>${index < activeIndex ? "✓" : index + 1}</i><span>${label}</span><small>${index === 0 ? (hasResult ? "Dữ liệu hợp lệ" : "Nhập để bắt đầu") : index === 1 ? (hasResult ? "Đã hoàn tất" : "Chờ dữ liệu") : index === 2 ? (hasResult ? "Kết quả sẵn sàng" : "Chưa thể luận giải") : (runtime.reflectionDraft ? "Đã có ghi chú" : "Tùy chọn")}</small></button>`).join("")}</div></nav>`;
  }
  function resultProvenanceBadges(contract, aiState) {
    return `<div class="fortune-result-provenance"><span data-kind="calculated">● Dữ liệu tính toán</span><span data-kind="astronomy">● Thiên văn / lịch</span><span data-kind="symbolic">● Diễn giải biểu tượng</span>${aiState ? `<span data-kind="ai">● Nội dung do HH AI tạo</span>` : ""}${contract?.sha256 ? `<code title="SHA-256">${escapeHtml(contract.sha256.slice(0, 12))}…</code>` : ""}</div>`;
  }
  function resultWorkspaceMarkup(runtime, view) {
    if (!hasFortuneResult(runtime, view)) return "";
    const contract = currentResultContract(runtime, view); const aiState = fortuneAiState(runtime, view); const active = RESULT_TABS.some(([id]) => id === runtime.resultTab) ? runtime.resultTab : "overview";
    const text = currentResultText(runtime, view) || "Kết quả cục bộ đã sẵn sàng trong không gian chuyên biệt phía trên.";
    const facts = contract?.calculatedFacts || []; const interpretations = contract?.symbolicInterpretations || []; const method = METHOD_CATALOG.find((item) => item.id === view || (view === "chart" && item.id === "chart")) || null;
    let panel = "";
    if (active === "overview") panel = `<article class="fortune-result-summary"><span>KẾT QUẢ CỤC BỘ ĐÃ SẴN SÀNG ✓</span><h3>Tóm tắt phiên hiện tại</h3><p>${escapeHtml(text)}</p></article>`;
    else if (active === "details") panel = `<div class="fortune-result-detail-grid">${facts.length ? facts.map((fact) => `<article><span>${escapeHtml(fact.label)}</span><strong>${escapeHtml(fact.value == null ? "—" : String(fact.value))}${fact.unit ? ` <small>${escapeHtml(fact.unit)}</small>` : ""}</strong><small>Dữ liệu tính toán</small></article>`).join("") : `<article class="is-wide"><span>KẾT QUẢ CHUYÊN BIỆT</span><p>${escapeHtml(text)}</p></article>`}</div>`;
    else if (active === "method") panel = `<article class="fortune-result-method"><span>PHƯƠNG PHÁP & PROVENANCE</span><h3>${escapeHtml(method?.title || (VIEW_VISUALS[view] || VIEW_VISUALS.today)[1])}</h3><dl><div><dt>Hệ thống</dt><dd>${escapeHtml(method?.system || contract?.methodId || "Công cụ chiêm nghiệm HH")}</dd></div><div><dt>Đầu vào</dt><dd>${escapeHtml(method?.input || "Dữ liệu hiển thị trong biểu mẫu phía trên")}</dd></div><div><dt>Thuật toán</dt><dd>${escapeHtml(method?.algorithm || contract?.calculationEngine || "Không áp dụng")}</dd></div><div><dt>Độ chính xác kỹ thuật</dt><dd>${escapeHtml(method?.precision || "Kết quả biểu tượng không có độ chính xác dự báo")}</dd></div><div><dt>Nguồn</dt><dd>${escapeHtml(method?.source || "HH biên soạn")}</dd></div></dl><button type="button" data-fortune-view="methods">Mở Trung tâm phương pháp</button></article>${contract ? resultContractMarkup(contract) : ""}`;
    else if (active === "deep") panel = `<article class="fortune-result-deep"><span>DIỄN GIẢI BIỂU TƯỢNG</span><h3>Đọc theo nhiều lớp, không kết luận tuyệt đối</h3>${interpretations.length ? interpretations.map((item, index) => `<section><b>${String(index + 1).padStart(2,"0")}</b><div><strong>${escapeHtml(item.label || `Lớp ${index + 1}`)}</strong><p>${escapeHtml(item.text || "")}</p></div></section>`).join("") : `<p>${escapeHtml(text)}</p>`}<aside>Hãy đối chiếu mọi diễn giải với trải nghiệm và dữ kiện thật. Nội dung này không xác định tính cách, tương lai hay giá trị của một người.</aside></article>`;
    else if (active === "ai") panel = `<div class="fortune-result-ai-panel">${automaticAiMarkup(runtime, view, "Kết quả local vẫn đầy đủ. HH AI chỉ bổ sung một lớp diễn giải và không thay đổi phép tính.", true)}</div>`;
    else panel = `<article class="fortune-result-reflection"><span>CHIÊM NGHIỆM CỦA BẠN</span><h3>Điều gì thực sự hữu ích sau phiên này?</h3><div class="fortune-reflection-prompts"><p>① Chi tiết nào khớp với dữ kiện bạn đã biết?</p><p>② Cách hiểu nào khác cũng có thể hợp lý?</p><p>③ Bước nhỏ, an toàn và có thể đảo ngược nào đáng thử?</p></div><label><span>Ghi chú riêng · mặc định chỉ trong tab</span><textarea rows="6" maxlength="3000" data-fortune-reflection-draft placeholder="Viết điều bạn muốn giữ lại…">${escapeHtml(runtime.reflectionDraft || "")}</textarea></label><div><button type="button" data-fortune-reflection-to-journal>Mở Nhật ký để lưu</button></div></article>`;
    const tabs = RESULT_TAB_GROUPS.map(([groupId, groupLabel, ids]) => `<section class="fortune-result-tab-group" data-tab-group="${groupId}"><small>${groupLabel}</small><div>${ids.map((id) => { const tab = RESULT_TABS.find((item) => item[0] === id); return `<button type="button" role="tab" class="${active === id ? "is-active" : ""}" aria-selected="${active === id}" data-fortune-result-tab="${id}"><i>${tab[2]}</i><span>${tab[1]}</span>${id === "ai" && aiState?.status === "loading" ? "<b class=\"is-pulsing\"></b>" : ""}</button>`; }).join("")}</div></section>`).join("");
    const localStatus = hasFortuneResult(runtime, view) ? "Đã tính ✓" : "Chờ dữ liệu"; const aiStatus = aiState?.status === "ready" ? "HH AI hoàn tất ✓" : aiState?.status === "loading" ? "HH AI đang phân tích…" : aiState?.status === "error" ? "HH AI có thể thử lại" : "HH AI chờ kết quả";
    return `<section class="fortune-result-workspace" data-fortune-result-workspace><header><div><span>RESULT WORKSPACE</span><h3>Kết quả theo lớp dữ liệu</h3></div><div class="fortune-session-status"><span>${localStatus}</span><span>${aiStatus}</span>${contract?.sha256 ? `<code title="SHA-256">SHA ${escapeHtml(contract.sha256.slice(0, 10))}…</code>` : ""}</div></header><div class="fortune-result-tabs" role="tablist" aria-label="Các lớp kết quả">${tabs}</div><div class="fortune-result-panel" role="tabpanel" data-fortune-result-panel="${active}">${panel}</div></section>`;
  }
  function viewMarkup(runtime) {
    const view = runtime.state.view; let markup;
    if (view === "profile") markup = profileMarkup(runtime);
    else if (view === "session") markup = sessionMarkup(runtime);
    else if (view === "accuracy") markup = provenanceMarkup(runtime);
    else if (view === "tarot") markup = tarotMarkup(runtime);
    else if (view === "academy") markup = academyV4Markup(runtime);
    else if (view === "zodiac") markup = zodiacMarkup(runtime) + supplementalExplanation(runtime, "zodiac");
    else if (view === "numerology") markup = numerologyMarkup(runtime);
    else if (view === "iching") markup = ichingMarkup(runtime);
    else if (view === "tuvi") markup = ziweiMarkup(runtime);
    else if (view === "physiognomy") markup = physiognomyMarkup(runtime);
    else if (view === "dreams") markup = dreamsMarkup(runtime);
    else if (view === "moon") markup = moonMarkup(runtime) + supplementalExplanation(runtime, "moon");
    else if (view === "compatibility") markup = compatibilityMarkup(runtime) + supplementalExplanation(runtime, "compatibility");
    else if (view === "calendar") markup = calendarMarkup(runtime);
    else if (view === "sky") markup = skyV4Markup(runtime);
    else if (view === "chart") markup = astrologyV4Markup(runtime);
    else if (view === "eastern") markup = easternV4Markup(runtime);
    else if (view === "symbols") markup = symbolsV4Markup(runtime);
    else if (view === "journal") markup = journalMarkup(runtime);
    else if (view === "copilot") markup = copilotMarkup(runtime);
    else if (view === "methods") markup = methodsMarkup(runtime);
    else if (view === "history") markup = historyMarkup(runtime);
    else markup = todayMarkup(runtime);
    return `${workflowStepperMarkup(runtime)}<div class="fortune-tool-surface">${markup}</div>${resultWorkspaceMarkup(runtime, view)}`;
  }

  function timePhase(dateValue = new Date()) {
    const hour = dateValue.getHours(); if (hour >= 5 && hour < 10) return "dawn"; if (hour >= 10 && hour < 17) return "day"; if (hour >= 17 && hour < 20) return "dusk"; return "night";
  }
  function mysticSceneMarkup(runtime) {
    const visual = VIEW_VISUALS[runtime.state.view] || VIEW_VISUALS.today; const moon = calculateMoonPhase(localDateKey()) || { symbol: "☾", illumination: 50, waxing: true };
    const orbitItems = [["tarot","♢"],["iching","☯"],["tuvi","紫"],["chart","◎"],["moon","☾"],["numerology","#"],["symbols","ᚠ"],["physiognomy","◌"],["dreams","☁"],["eastern","☯"],["journal","✎"],["zodiac","☼"],["sky","✺"],["calendar","▦"],["academy","▣"],["accuracy","✓"],["history","◷"]];
    return `<div class="fortune-mystic-scene" aria-hidden="true" data-fortune-scene data-world="${escapeHtml(visual[2])}"><canvas data-fortune-cosmos></canvas><div class="fortune-nebula fortune-nebula--a"></div><div class="fortune-nebula fortune-nebula--b"></div><div class="fortune-nebula fortune-nebula--c"></div><svg class="fortune-constellations" viewBox="0 0 1000 700" preserveAspectRatio="none"><g><path d="M60 140 L170 82 L285 160 L390 94 L505 184"/><path d="M640 80 L735 152 L850 104 L938 196"/><path d="M560 520 L665 430 L770 508 L892 425"/></g><g>${[[60,140],[170,82],[285,160],[390,94],[505,184],[640,80],[735,152],[850,104],[938,196],[560,520],[665,430],[770,508],[892,425]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="3"/>`).join("")}</g></svg><div class="fortune-sky-moon" style="--moon-light:${moon.illumination}%"><span>${escapeHtml(moon.symbol)}</span><i></i><b>${moon.illumination}%</b></div><div class="fortune-mystic-portal"><span class="fortune-portal-ring fortune-portal-ring--outer"></span><span class="fortune-portal-ring fortune-portal-ring--middle"></span><span class="fortune-portal-ring fortune-portal-ring--inner"></span><div><i data-fortune-world-icon>${escapeHtml(visual[0])}</i><b data-fortune-world-label>${escapeHtml(visual[1])}</b><small>MYSTIC LIVING OBSERVATORY</small></div></div><div class="fortune-orbit-icons">${orbitItems.map(([view,icon], index) => `<span style="--orbit-angle:${(360 / orbitItems.length * index).toFixed(2)}deg" data-orbit-view="${view}">${escapeHtml(icon)}</span>`).join("")}</div><div class="fortune-world-stage"><div class="fortune-world-cards"><i></i><i></i><i></i></div><div class="fortune-world-coins"><i>☰</i><i>☷</i><i>☯</i></div><div class="fortune-world-zodiac"><i>☉</i><b></b><span></span></div><div class="fortune-world-lunar"><i>⊕</i><b>◐</b></div><div class="fortune-world-numbers"><i>3</i><i>7</i><i>9</i><i>11</i></div><div class="fortune-world-runes"><i>ᚠ</i><i>ᚨ</i><i>ᛃ</i></div><div class="fortune-world-compass"><i>☯</i><b>子 午 卯 酉</b></div><div class="fortune-world-pages"><i></i><b>✦</b></div></div><div class="fortune-meteor-field"><i></i><i></i><i></i></div><div class="fortune-mystic-fog"></div></div>`;
  }

  function observatoryTopbarMarkup(runtime) {
    const selection = selectedInspectorItem(runtime);
    const inspectorExpanded = Boolean(selection && runtime.inspectorOpen);
    return `<header class="fortune-observatory-topbar"><button type="button" class="fortune-topbar-menu" data-fortune-nav-toggle aria-label="Mở thư viện công cụ">☰</button><button type="button" class="fortune-observatory-brand" data-fortune-view="today"><i>☾</i><span><small>HH MYSTIC</small><strong>Observatory</strong></span></button><label class="fortune-global-search"><i>⌕</i><input type="search" data-fortune-tool-search placeholder="Tìm công cụ hoặc phương pháp…" autocomplete="off"><kbd>Ctrl K</kbd></label><div class="fortune-topbar-actions"><button type="button" data-fortune-view="profile"><i>◉</i><span>Hồ sơ</span></button><button type="button" data-fortune-view="history"><i>◷</i><span>Lịch sử</span></button><button type="button" data-fortune-inspector-toggle aria-controls="fortuneContextInspector" aria-expanded="${inspectorExpanded}" aria-label="${selection ? (inspectorExpanded ? "Đóng chi tiết mục đang chọn" : "Mở chi tiết mục đang chọn") : "Chọn một lá, hào, hành tinh, cung hoặc con số để xem chi tiết"}" ${selection ? "" : "disabled"}>ⓘ</button></div></header>`;
  }
  function selectedInspectorItem(runtime) {
    const view = runtime.state.view;
    if (view === "tarot" && runtime.session.tarot?.length) {
      const card = runtime.session.tarot[clamp(runtime.session.tarotFocusIndex, 0, runtime.session.tarot.length - 1, 0)]; if (!card) return null;
      return { icon: "♢", kicker: "LÁ BÀI ĐANG CHỌN", title: card.name, image: card.image || "", description: card.interpretation || card.light || "", details: [["Vị trí", card.position || "Tarot 78 Studio"], ["Trạng thái", card.reversed ? "Lá đảo · Reversed" : "Lá xuôi · Upright"], ["Câu hỏi", card.question || "Đối chiếu hình tượng này với dữ kiện thật."]] };
    }
    if (view === "symbols" && runtime.session.symbolDeck?.cards?.length) {
      const card = runtime.session.symbolDeck.cards[clamp(runtime.session.symbolFocusIndex, 0, runtime.session.symbolDeck.cards.length - 1, 0)]; if (!card) return null;
      return { icon: card.symbol || "✧", kicker: runtime.session.symbolType === "lenormand" ? "LÁ LENORMAND ĐANG CHỌN" : "BIỂU TƯỢNG ĐANG CHỌN", title: card.name, image: card.image || "", description: card.prompt || card.interpretation || "", details: [["Số", card.number || "—"], ["Tên gốc", card.englishName || card.transliteration || "—"], ["Từ khóa", (card.keywords || []).join(" · ") || "—"]] };
    }
    if (view === "tuvi" && runtime.session.tuvi?.palaces?.length) {
      const palace = runtime.session.tuvi.palaces[clamp(runtime.session.tuviPalaceIndex, 0, runtime.session.tuvi.palaces.length - 1, 0)]; if (!palace) return null; const majors = (palace.majorStars || []).map((star) => star.name).join(" · "); const minors = (palace.minorStars || []).map((star) => star.name).join(" · ");
      return { icon: "紫", kicker: "CUNG ĐANG CHỌN", title: `${palace.name} · ${palace.heavenlyStem || ""} ${palace.earthlyBranch || ""}`.trim(), description: `${palace.isOriginalPalace ? "Cung Mệnh. " : ""}${palace.isBodyPalace ? "Cung Thân. " : ""}Dữ liệu sao do engine lá số cung cấp.`, details: [["Chính tinh", majors || "Vô chính diệu"], ["Phụ tinh", minors || "Không có trong nhóm hiển thị"], ["Tràng Sinh", palace.changsheng12 || "—"], ["Đại hạn", palace.decadal?.range?.join("–") || "—"]] };
    }
    if (view === "chart" && runtime.session.astrologyV4?.ok && runtime.session.astrologyPlanet) {
      const planets = astrologyResultPlanets(runtime.session.astrologyV4); const planet = planets.find((item) => item.body === runtime.session.astrologyPlanet); if (!planet) return null;
      return { icon: planet.symbol || "◎", kicker: "HÀNH TINH ĐANG CHỌN", title: planet.name, description: `Vị trí là dữ liệu tính toán; cung và nhà là lớp diễn giải chiêm tinh biểu tượng.`, details: [["Vị trí", `${planet.sign?.name || "—"} ${Number(planet.sign?.degree || 0).toFixed(2)}°`], ["Nhà", planet.house || "Không tính"], ["Kinh độ", `${Number(planet.longitude || 0).toFixed(5)}°`], ["Chuyển động", planet.direction || (planet.retrograde ? "Retrograde" : "Direct")]] };
    }
    if (view === "iching" && Number.isInteger(runtime.session.ichingLineIndex) && runtime.session.ichingAdvanced?.lines?.length) {
      const line = runtime.session.ichingAdvanced.lines.find((item) => item.number === runtime.session.ichingLineIndex); if (!line) return null;
      return { icon: "☯", kicker: "HÀO ĐANG CHỌN", title: `Hào ${line.number} · ${line.yang ? "Dương" : "Âm"}${line.changing ? " động" : " tĩnh"}`, description: line.reflection || "Đọc hào trong quan hệ với quẻ chính và các hào động khác.", details: [["Giá trị", line.value], ["Ba đồng xu", line.coins?.join(" + ") || runtime.session.ichingMode], ["Trạng thái", line.changing ? "Động · tạo quẻ biến" : "Tĩnh"]] };
    }
    if (view === "numerology" && Number.isInteger(runtime.session.numerologyFocusIndex) && runtime.session.numerologyV4) {
      const values = [["Đường đời",runtime.session.numerologyV4.lifePath],["Ngày sinh",runtime.session.numerologyV4.birthday],["Thái độ",runtime.session.numerologyV4.attitude],["Biểu đạt",runtime.session.numerologyV4.expression],["Nội tâm",runtime.session.numerologyV4.soulUrge],["Ấn tượng",runtime.session.numerologyV4.personality],["Trưởng thành",runtime.session.numerologyV4.maturity],["Cân bằng",runtime.session.numerologyV4.balance]]; const selected = values[runtime.session.numerologyFocusIndex]; if (!selected) return null;
      const guide = runtime.session.numerologyV4.interpretations?.[selected[0]] || Object.values(runtime.session.numerologyV4.interpretations || {}).find((item) => item?.label === selected[0]);
      return { icon: "#", kicker: "CHỈ SỐ ĐANG CHỌN", title: `${selected[0]} · ${selected[1]?.value ?? "—"}`, description: guide?.resources || "Chỉ số được tính cục bộ theo hệ đang chọn.", details: [["Công thức", selected[1]?.formula || "—"], ["Thực hành", guide?.practice || "Đối chiếu với trải nghiệm thực tế"], ["Câu hỏi", guide?.reflectionQuestion || "Điều gì trong chỉ số này hữu ích với bạn?"]] };
    }
    return null;
  }
  function observatoryInspectorMarkup(runtime) {
    const item = selectedInspectorItem(runtime);
    return `<aside id="fortuneContextInspector" class="fortune-context-inspector" data-fortune-inspector role="dialog" aria-modal="false" aria-label="Chi tiết mục đang chọn" ${item ? "" : "aria-hidden=\"true\""}><header><div><i>${escapeHtml(item?.icon || "ⓘ")}</i><span><small>INSPECTOR</small><strong>${item ? escapeHtml(item.kicker) : "CHƯA CÓ LỰA CHỌN"}</strong></span></div><button type="button" data-fortune-inspector-close aria-label="Đóng bảng chi tiết">×</button></header>${item ? `<section class="fortune-inspector-focus">${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async">` : `<i>${escapeHtml(item.icon)}</i>`}<h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description || "")}</p></section><section class="fortune-inspector-selection"><dl>${item.details.map(([label,value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value == null ? "—" : String(value))}</dd></div>`).join("")}</dl></section>` : `<section class="fortune-inspector-empty"><i>✦</i><p>Chọn một lá bài, hào, hành tinh, cung hoặc con số để mở chi tiết.</p></section>`}</aside>`;
  }
  function observatoryActionbarMarkup(runtime) {
    const available = hasFortuneResult(runtime); const exportButtons = runtime.state.view === "chart" ? [["json","JSON"],["svg","SVG"],["png","PNG"],["pdf","PDF"]].map(([format,label]) => `<button type="button" data-fortune-astrology-export="${format}" ${available ? "" : "disabled"}>${label}</button>`).join("") : [["txt","TXT"],["json","JSON"],["png","PNG"]].map(([format,label]) => `<button type="button" data-fortune-export="${format}" ${available ? "" : "disabled"}>${label}</button>`).join("");
    return `<footer class="fortune-observatory-actions"><div><span>${available ? "Kết quả phiên đã sẵn sàng" : "Thực hiện công cụ để mở các tác vụ"}</span><small>${runtime.state.settings.experience === "advanced" ? "Chuyên sâu" : "Người mới"} · ${runtime.state.settings.motion === "cinematic" ? "Điện ảnh" : runtime.state.settings.motion === "static" ? "Tĩnh" : "Cân bằng"}</small></div><nav><button type="button" data-fortune-save-current ${available ? "" : "disabled"}>＋ Lưu</button><button type="button" data-fortune-action-note ${available ? "" : "disabled"}>✎ Ghi chú</button><button type="button" data-fortune-view="compatibility">⇄ So sánh</button><details class="fortune-action-export"><summary aria-disabled="${available ? "false" : "true"}">↓ Xuất</summary><div>${exportButtons}</div></details><button type="button" data-fortune-share-current ${available ? "" : "disabled"}>↗ Chia sẻ</button></nav></footer>`;
  }

  function shellMarkup(runtime) {
    const settings = runtime.state.settings; const style = `--fortune-particle-density:${settings.particleDensity};--fortune-glow-strength:${settings.glow / 100};--fortune-glass-opacity:${settings.glass / 100}`;
    return `<section class="fortune-hub${runtime.inspectorOpen && selectedInspectorItem(runtime) ? " is-inspector-open" : ""}" data-fortune-hub data-view="${escapeHtml(runtime.state.view)}" data-world="${escapeHtml((VIEW_VISUALS[runtime.state.view] || VIEW_VISUALS.today)[2])}" data-theme="${escapeHtml(settings.theme)}" data-motion="${escapeHtml(settings.motion)}" data-time-phase="${timePhase()}" data-experience="${escapeHtml(settings.experience)}" style="${style}">${mysticSceneMarkup(runtime)}
      ${observatoryTopbarMarkup(runtime)}<div class="fortune-observatory-grid"><aside class="fortune-sidebar"><div class="fortune-sidebar-head"><span>THƯ VIỆN CÔNG CỤ</span><button type="button" data-fortune-nav-toggle aria-label="Đóng danh mục">×</button></div><nav aria-label="Điều hướng Xem bói">${navMarkup(runtime)}</nav><section class="fortune-preferences"><label><span>Huyền cảnh</span><select data-fortune-theme>${THEME_OPTIONS.map(([id,label,detail])=>`<option value="${id}"${settings.theme===id?" selected":""}>${label} · ${detail}</option>`).join("")}</select></label><label><span>Chuyển động</span><select data-fortune-motion><option value="static"${settings.motion==="static"?" selected":""}>Tĩnh</option><option value="balanced"${settings.motion==="balanced"?" selected":""}>Cân bằng</option><option value="cinematic"${settings.motion==="cinematic"?" selected":""}>Điện ảnh</option></select></label><button type="button" class="${settings.sound?"is-active":""}" data-fortune-sound>${settings.sound?"♫ Âm thanh bật":"♪ Âm thanh tắt"}</button></section></aside><main class="fortune-main"><div class="fortune-view" data-fortune-view-root>${viewMarkup(runtime)}</div><footer class="fortune-disclaimer"><span>ⓘ</span><p><strong>Nội dung giải trí và tự chiêm nghiệm.</strong> Không phải dự báo khoa học, chẩn đoán hay lời khuyên y tế, pháp lý hoặc tài chính.</p><button type="button" data-fortune-about>Mở hướng dẫn</button></footer></main><button type="button" class="fortune-inspector-backdrop" data-fortune-inspector-close aria-label="Đóng bảng chi tiết" tabindex="-1"></button>${observatoryInspectorMarkup(runtime)}</div>${observatoryActionbarMarkup(runtime)}
      <div class="fortune-toast" role="status" aria-live="polite" hidden></div>${runtime.deletedRecord ? `<button class="fortune-undo" type="button" data-fortune-undo-delete>Hoàn tác xóa ${escapeHtml(runtime.deletedRecord.label || "dữ liệu")}</button>` : ""}
    </section>`;
  }

  function enhanceJournalControls(runtime) {
    if (runtime.state.view !== "journal" || !runtime.state.journalVault) return;
    const security = runtime.root?.querySelector(".fortune-journal-security"); if (!security || security.querySelector("[data-fortune-vault-sync-controls]")) return;
    security.insertAdjacentHTML("beforeend", `<div class="fortune-vault-sync" data-fortune-vault-sync-controls><button type="button" data-fortune-vault-upload>Đồng bộ bản mã hóa</button><button type="button" data-fortune-vault-download>Khôi phục từ tài khoản</button><small>Chỉ ciphertext, salt và IV được gửi; máy chủ không nhận PIN hoặc bản rõ.</small></div>`);
  }

  function enhanceContextTargets(runtime) {
    if (!runtime?.root) return;
    runtime.root.querySelectorAll(".fortune-number-hero-grid > div").forEach((item, index) => {
      item.dataset.fortuneNumberFocus = String(index); item.tabIndex = 0; item.setAttribute("role", "button"); item.setAttribute("aria-label", `Mở chi tiết ${item.querySelector("span")?.textContent || `chỉ số ${index + 1}`}`);
    });
    runtime.root.querySelectorAll(".fortune-six-line-ledger > li").forEach((item) => {
      const match = item.querySelector("b")?.textContent?.match(/\d+/); if (!match) return; item.dataset.fortuneIchingLine = match[0]; item.tabIndex = 0; item.setAttribute("role", "button"); item.setAttribute("aria-label", `Mở chi tiết hào ${match[0]}`);
    });
  }

  function reducedMotionPreferred() { return Boolean(globalScope.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches); }
  function stopMysticScene(runtime) {
    if (!runtime) return; if (runtime.mysticFrame) globalScope.cancelAnimationFrame?.(runtime.mysticFrame); runtime.mysticFrame = 0;
    runtime.mysticResizeObserver?.disconnect?.(); runtime.mysticResizeObserver = null;
    if (runtime.mysticVisibility && globalScope.document) globalScope.document.removeEventListener("visibilitychange", runtime.mysticVisibility);
    if (runtime.mysticPointer && runtime.root) runtime.root.removeEventListener("pointermove", runtime.mysticPointer);
    runtime.mysticVisibility = null; runtime.mysticPointer = null; runtime.mysticScene = null;
  }
  function initMysticScene(runtime) {
    if (!runtime?.root || !globalScope.document || !globalScope.requestAnimationFrame) return;
    const canvas = runtime.root.querySelector("[data-fortune-cosmos]"); if (!canvas?.getContext) return; const context = canvas.getContext("2d", { alpha: true }); if (!context) return;
    const scene = { canvas, context, width: 1, height: 1, particles: [], meteors: [], pointerX: .5, pointerY: .5, lastFrame: 0, paused: false, generation: 0, configKey: `${runtime.state.settings.motion}|${runtime.state.settings.particleDensity}` }; runtime.mysticScene = scene;
    const rebuild = () => {
      const rect = runtime.root.getBoundingClientRect(); const width = Math.max(1, Math.round(rect.width)); const height = Math.max(1, Math.round(rect.height)); const dpr = Math.min(Number(globalScope.devicePixelRatio) || 1, runtime.state.settings.motion === "cinematic" ? 1.75 : 1.35);
      scene.width = width; scene.height = height; canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); canvas.style.width = `${width}px`; canvas.style.height = `${height}px`; context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const mobileFactor = width < 720 ? .48 : 1; const motionFactor = runtime.state.settings.motion === "cinematic" ? 1.45 : runtime.state.settings.motion === "static" ? 0 : 1; const requested = Math.round((35 + runtime.state.settings.particleDensity * 1.15) * mobileFactor * motionFactor); const count = Math.min(190, requested);
      scene.particles = Array.from({ length: count }, (_, index) => ({ x: Math.random() * width, y: Math.random() * height, z: .25 + Math.random() * .75, size: .45 + Math.random() * (index % 9 === 0 ? 2.2 : 1.15), alpha: .22 + Math.random() * .7, hue: [188, 218, 267, 310, 42][index % 5], phase: Math.random() * Math.PI * 2, speed: .08 + Math.random() * .3 })); scene.generation += 1;
    };
    const draw = (timestamp = 0) => {
      if (!runtime.mysticScene || runtime.mysticScene !== scene) return; const motion = reducedMotionPreferred() ? "static" : runtime.state.settings.motion;
      if (scene.paused || globalScope.document?.hidden) { runtime.mysticFrame = 0; return; }
      if (motion === "balanced" && timestamp - scene.lastFrame < 30) { runtime.mysticFrame = globalScope.requestAnimationFrame(draw); return; }
      const delta = Math.min(42, Math.max(0, timestamp - scene.lastFrame || 16)); scene.lastFrame = timestamp; context.clearRect(0, 0, scene.width, scene.height); const drift = motion === "static" ? 0 : motion === "cinematic" ? .055 : .028;
      for (const star of scene.particles) {
        star.phase += delta * .0015 * star.speed; star.y -= drift * delta * star.z; star.x += (scene.pointerX - .5) * .012 * delta * star.z;
        if (star.y < -8) { star.y = scene.height + 8; star.x = Math.random() * scene.width; } if (star.x < -8) star.x = scene.width + 8; if (star.x > scene.width + 8) star.x = -8;
        const twinkle = motion === "static" ? 1 : .65 + Math.sin(star.phase) * .35; const px = star.x + (scene.pointerX - .5) * 24 * star.z; const py = star.y + (scene.pointerY - .5) * 15 * star.z;
        context.beginPath(); context.fillStyle = `hsla(${star.hue} 95% 80% / ${star.alpha * twinkle})`; context.shadowColor = `hsla(${star.hue} 100% 70% / .7)`; context.shadowBlur = star.size > 1.5 ? 10 * runtime.state.settings.glow / 100 : 0; context.arc(px, py, star.size * twinkle, 0, Math.PI * 2); context.fill();
      }
      context.shadowBlur = 0;
      if (motion === "cinematic" && Math.random() < .007 && scene.meteors.length < 3) scene.meteors.push({ x: Math.random() * scene.width * .8, y: -30, life: 0, speed: 7 + Math.random() * 5 });
      scene.meteors = scene.meteors.filter((meteor) => { meteor.x += meteor.speed * 1.45; meteor.y += meteor.speed; meteor.life += delta; context.beginPath(); const gradient = context.createLinearGradient(meteor.x - 95, meteor.y - 65, meteor.x, meteor.y); gradient.addColorStop(0, "rgba(141,224,255,0)"); gradient.addColorStop(1, "rgba(255,255,255,.85)"); context.strokeStyle = gradient; context.lineWidth = 1.3; context.moveTo(meteor.x - 95, meteor.y - 65); context.lineTo(meteor.x, meteor.y); context.stroke(); return meteor.y < scene.height + 80 && meteor.life < 1800; });
      runtime.mysticFrame = motion === "static" ? 0 : globalScope.requestAnimationFrame(draw);
    };
    runtime.mysticPointer = (event) => { const rect = runtime.root.getBoundingClientRect(); scene.pointerX = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1, .5); scene.pointerY = clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1, .5); runtime.root.style.setProperty("--mystic-pointer-x", `${(scene.pointerX * 100).toFixed(1)}%`); runtime.root.style.setProperty("--mystic-pointer-y", `${(scene.pointerY * 100).toFixed(1)}%`); };
    runtime.mysticVisibility = () => { scene.paused = Boolean(globalScope.document.hidden); runtime.root?.classList.toggle("is-tab-hidden", scene.paused); if (!scene.paused && !runtime.mysticFrame && runtime.state.settings.motion !== "static") runtime.mysticFrame = globalScope.requestAnimationFrame(draw); };
    runtime.root.addEventListener("pointermove", runtime.mysticPointer, { passive: true }); globalScope.document.addEventListener("visibilitychange", runtime.mysticVisibility); runtime.mysticResizeObserver = globalScope.ResizeObserver ? new globalScope.ResizeObserver(rebuild) : null; runtime.mysticResizeObserver?.observe(runtime.root); rebuild(); draw(0);
  }
  function syncMysticScene(runtime) {
    if (!runtime?.root) return; const visual = VIEW_VISUALS[runtime.state.view] || VIEW_VISUALS.today; const settings = runtime.state.settings;
    runtime.root.dataset.view = runtime.state.view; runtime.root.dataset.world = visual[2]; runtime.root.dataset.theme = settings.theme; runtime.root.dataset.motion = reducedMotionPreferred() ? "static" : settings.motion; runtime.root.dataset.timePhase = timePhase();
    runtime.root.style.setProperty("--fortune-particle-density", settings.particleDensity); runtime.root.style.setProperty("--fortune-glow-strength", settings.glow / 100); runtime.root.style.setProperty("--fortune-glass-opacity", settings.glass / 100);
    const scene = runtime.root.querySelector("[data-fortune-scene]"); if (scene) scene.dataset.world = visual[2]; const icon = runtime.root.querySelector("[data-fortune-world-icon]"); const label = runtime.root.querySelector("[data-fortune-world-label]"); if (icon) icon.textContent = visual[0]; if (label) label.textContent = visual[1];
    const configKey = `${settings.motion}|${settings.particleDensity}`; if (!runtime.mysticScene) initMysticScene(runtime); else if (runtime.mysticScene.configKey !== configKey) { stopMysticScene(runtime); initMysticScene(runtime); }
  }
  function scrollFortuneTarget(runtime, selector, behavior = "smooth") {
    if (!runtime?.root || !selector) return;
    const target = runtime.root.querySelector(selector); if (!target) return;
    const scroller = globalScope.document?.getElementById("appMain");
    const reduced = reducedMotionPreferred() || runtime.state.settings.motion === "static";
    const move = () => {
      if (scroller && scroller.scrollHeight > scroller.clientHeight + 4) {
        const scrollerRect = scroller.getBoundingClientRect(); const targetRect = target.getBoundingClientRect();
        const offset = targetRect.top - scrollerRect.top - 18;
        scroller.scrollBy?.({ top: offset, behavior: reduced ? "auto" : behavior });
      } else target.scrollIntoView?.({ block: "start", behavior: reduced ? "auto" : behavior });
    };
    globalScope.requestAnimationFrame ? globalScope.requestAnimationFrame(move) : globalScope.setTimeout(move, 0);
  }
  function flushFortuneScroll(runtime) {
    const pending = runtime?.pendingScrollTarget; if (!pending) return;
    runtime.pendingScrollTarget = null; scrollFortuneTarget(runtime, pending.selector, pending.behavior || "smooth");
  }
  function restoreFortuneScrollPosition(scroller, scrollTop) {
    if (!scroller || !Number.isFinite(scrollTop)) return;
    const restore = () => { scroller.scrollTop = scrollTop; };
    restore();
    if (globalScope.requestAnimationFrame) globalScope.requestAnimationFrame(restore); else globalScope.setTimeout(restore, 0);
  }
  function transitionToView(runtime, view, options = {}) {
    const scroller = options.preserveScroll ? globalScope.document?.getElementById("appMain") : null;
    const preservedScrollTop = scroller?.scrollTop;
    const commit = () => { runtime.state.view = view; runtime.resultTab = "overview"; runtime.flowStep = null; runtime.inspectorOpen = false; runtime.pendingScrollTarget = options.preserveScroll ? null : (["today", "profile", "history", "journal"].includes(view) ? null : { selector: ".fortune-tool-surface", behavior: "smooth" }); writeState(runtime); render(runtime, true); restoreFortuneScrollPosition(scroller, preservedScrollTop); };
    const documentObject = globalScope.document; if (!documentObject?.startViewTransition || runtime.state.settings.motion === "static" || reducedMotionPreferred()) { commit(); return; }
    documentObject.documentElement.dataset.fortuneTransition = (VIEW_VISUALS[view] || VIEW_VISUALS.today)[2]; const transition = documentObject.startViewTransition(commit); transition?.finished?.finally?.(() => { delete documentObject.documentElement.dataset.fortuneTransition; });
  }

  function render(runtime, keepShell = false) {
    if (!runtime?.target) return;
    if (!keepShell || !runtime.root) {
      stopMysticScene(runtime);
      runtime.target.innerHTML = shellMarkup(runtime);
      runtime.root = runtime.target.querySelector("[data-fortune-hub]");
      runtime.root.addEventListener("click", runtime.onClick);
      runtime.root.addEventListener("submit", runtime.onSubmit);
      runtime.root.addEventListener("input", runtime.onInput);
      runtime.root.addEventListener("change", runtime.onChange);
      runtime.root.addEventListener("dragstart", runtime.onDragStart);
      runtime.root.addEventListener("dragover", runtime.onDragOver);
      runtime.root.addEventListener("drop", runtime.onDrop);
      runtime.root.addEventListener("keydown", runtime.onKeydown);
    } else {
      runtime.root.dataset.view = runtime.state.view;
      const viewRoot = runtime.root.querySelector("[data-fortune-view-root]");
      if (viewRoot) viewRoot.innerHTML = viewMarkup(runtime);
      const nav = runtime.root.querySelector(".fortune-sidebar nav");
      if (nav) nav.innerHTML = navMarkup(runtime);
      const topbar = runtime.root.querySelector(".fortune-observatory-topbar"); if (topbar) topbar.outerHTML = observatoryTopbarMarkup(runtime);
      const inspector = runtime.root.querySelector("[data-fortune-inspector]"); if (inspector) inspector.outerHTML = observatoryInspectorMarkup(runtime);
      const actionbar = runtime.root.querySelector(".fortune-observatory-actions"); if (actionbar) actionbar.outerHTML = observatoryActionbarMarkup(runtime);
      runtime.root.classList.remove("is-nav-open");
      runtime.root.classList.toggle("is-inspector-open", Boolean(runtime.inspectorOpen && selectedInspectorItem(runtime)));
      if (runtime.state.view === "history") filterHistoryDom(runtime);
      if (runtime.state.view === "journal") filterJournalDom(runtime);
    }
    enhanceJournalControls(runtime);
    enhanceContextTargets(runtime);
    if (runtime.state.view === "today") filterObservatoryTools(runtime, runtime.toolQuery || "");
    syncMysticScene(runtime);
    if (runtime.state.view === "moon") globalScope.queueMicrotask?.(() => globalScope.HHFortuneMoon3D?.mountAll?.(runtime.root));
    flushFortuneScroll(runtime);
  }

  function showToast(runtime, message, tone = "ok") {
    const toast = runtime.root?.querySelector(".fortune-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.dataset.tone = tone;
    toast.hidden = false;
    clearTimeout(runtime.toastTimer);
    runtime.toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
  }

  function currentResultText(runtime, viewOverride = "") {
    const view = viewOverride || runtime.state.view;
    if (view === "tarot" && runtime.session.tarot?.length) return [`HỆ THỐNG: Rider–Waite–Smith Tarot 1909 · hình public domain · diễn giải HH`, `SEED: ${runtime.session.tarotSeed}`, `SỐ LÁ: ${runtime.session.tarot.length}`, ...runtime.session.tarot.map((card, index) => `${index + 1}. ${card.position}: ${card.name} (${card.reversed ? "Lá đảo" : "Lá xuôi"})\nDiễn giải gốc: ${card.interpretation}\nCâu hỏi mở: ${card.question}${card.note ? `\nGhi chú người dùng: ${card.note}` : ""}`)].join("\n\n");
    if (view === "numerology" && runtime.session.numerology) return [`HỆ THỐNG: Thần số học`, `Đường đời ${runtime.session.numerology.lifePath}`, runtime.session.numerology.formula, `Chủ đề: ${runtime.session.numerology.meaning}`, `Ngày sinh rút gọn: ${runtime.session.numerology.birthDay}`, `Thái độ: ${runtime.session.numerology.attitude} (${runtime.session.numerology.attitudeFormula})`, `Biểu đồ 1–9: ${Object.entries(runtime.session.numerology.chart).map(([number, count]) => `${number}:${count}`).join(", ")}`, `Mũi tên: ${runtime.session.numerology.arrows.map((item) => `${item.numbers.join("-")} ${item.state} ${item.label}`).join("; ") || "không có hàng đủ/trống hoàn toàn"}`, runtime.session.cycles ? `Chu kỳ: ${runtime.session.cycles.formula}` : ""].filter(Boolean).join("\n");
    if (view === "iching" && runtime.session.iching) return [`HỆ THỐNG: Kinh Dịch ba đồng xu · 64 quẻ`, `SEED: ${runtime.session.ichingSeed}`, `Quẻ chính: ${runtime.session.iching.title}`, `Quẻ hỗ: ${runtime.session.iching.nuclearTitle}`, `Quẻ biến: ${runtime.session.iching.changedTitle}`, `Hào động: ${runtime.session.iching.changing.join(", ") || "không có"}`, `Sổ gieo: ${runtime.session.iching.lines.map((line) => `hào ${line.number} [${line.coins.join("+")}=${line.value}] ${line.yang ? "dương" : "âm"}${line.changing ? " động" : ""}`).join("; ")}`, `Diễn giải gốc: ${runtime.session.iching.reflection}`, runtime.session.iching.lines.map((line) => line.reflection).filter(Boolean).join(" ")].join("\n");
    if (view === "tuvi" && runtime.session.tuvi?.ok) { const result = runtime.session.tuvi; return [`HỆ THỐNG: Tử Vi Đẩu Số · ${result.engine}`, `CỤC: ${result.fiveElementsClass} · Mệnh chủ ${result.soul} · Thân chủ ${result.body}`, ...result.palaces.map((palace)=>`${palace.name} ${palace.heavenlyStem} ${palace.earthlyBranch}: ${(palace.majorStars||[]).map((star)=>`${star.name}${star.mutagen?` Hóa ${star.mutagen}`:""}`).join(", ") || "vô chính diệu"}`), "GIỚI HẠN: Hệ biểu tượng; không dùng để chẩn đoán hoặc dự báo chắc chắn."].join("\n"); }
    if (view === "physiognomy" && runtime.session.physiognomyResult?.ok) return [`HỆ THỐNG: Nhân tướng học tự quan sát · không camera`, ...runtime.session.physiognomyResult.observations.map((item)=>`${item.category}: ${item.label}. ${item.tradition} Câu hỏi: ${item.question}`), ...runtime.session.physiognomyResult.limitations].join("\n");
    if (view === "dreams" && runtime.session.dreamResult?.ok) return [`HỆ THỐNG: Symbol Journal cục bộ`, ...runtime.session.dreamResult.matches.map((item)=>`${item.matched.join(" · ")}: ${item.reflection}`), ...runtime.session.dreamResult.prompts].join("\n");
    if (view === "zodiac" && runtime.session.western?.ok) return `${runtime.session.western.sign.name} · ${runtime.session.western.sign.element}\nKinh độ Mặt Trời ${runtime.session.western.sign.longitude}° · UTC ${runtime.session.western.instantUtc}${runtime.session.western.nearBoundary ? "\nGần ranh giới: cần đối chiếu giờ sinh." : ""}`;
    if (view === "zodiac" && runtime.session.chinese) return `${runtime.session.chinese.animal} · ${runtime.session.chinese.branch} · ${runtime.session.chinese.yinYang} ${runtime.session.chinese.element}`;
    if (view === "moon" && runtime.session.moon) return `${runtime.session.moon.name} · ${runtime.session.moon.date}\nChiếu sáng xấp xỉ ${runtime.session.moon.illumination}% · tuổi trăng ${runtime.session.moon.ageDays} ngày\n${runtime.session.moon.method}`;
    if (view === "compatibility" && runtime.session.compatibility) return `${runtime.session.compatibility.sharedFocus}\n${runtime.session.compatibility.cycleRelation}\n${runtime.session.compatibility.prompts.map((prompt) => `- ${prompt}`).join("\n")}`;
    if (view === "sky" && runtime.session.sky?.ok) return [`HỆ THỐNG: Moon & Sky`, `NGÀY: ${runtime.session.sky.date}`, `UTC: ${runtime.session.sky.instantUtc}`, `PHA: ${runtime.session.sky.phaseAngle}° · ${runtime.session.sky.illuminatedPercent}%`, `KHOẢNG CÁCH: ${runtime.session.sky.distanceKm} km`, `MỌC/LẶN: ${runtime.session.sky.rise || "không có"} / ${runtime.session.sky.set || "không có"}`, `NGUỒN: ${runtime.session.sky.provenance?.engine || "Astronomy Engine"}`].join("\n");
    if (view === "eastern" && runtime.session.eastern?.ok) return [`HỆ THỐNG: Can Chi & 24 tiết khí`, `NGÀY: ${runtime.session.eastern.date}`, `NĂM: ${runtime.session.eastern.yearPillar.stem} ${runtime.session.eastern.yearPillar.branch}`, `LỊCH: ${runtime.session.eastern.lunarLabel || "không có nhãn"}`, `TIẾT KHÍ: ${runtime.session.eastern.solarTerms.map((term) => `${term.name}: ${term.time || "không có"}`).join("; ")}`, `GIỚI HẠN: Bát Tự/Tử Vi chưa bật khi chưa kiểm duyệt.`].join("\n");
    if (view === "symbols" && runtime.session.symbolDeck) return [`HỆ THỐNG: ${runtime.session.symbolDeck.type}`, `SEED: ${runtime.session.symbolDeck.seed}`, ...runtime.session.symbolDeck.cards.map((card, index) => `${index + 1}. ${card.name}: ${card.prompt}`)].join("\n");
    if (view === "chart" && runtime.session.astrologyV4?.ok) {
      const result = runtime.session.astrologyV4; const planets = astrologyResultPlanets(result); const aspects = result.aspects || result.secondaryAspects || result.chart?.aspects || [];
      return [`HỆ THỐNG: Astrology Studio V4 · ${runtime.session.astrologyMode}`, `THỜI ĐIỂM: ${result.targetUtc || result.instantUtc || result.returnUtc || result.progressedInstantUtc || "đã tính"}`, "HÀNH TINH:", ...planets.map((planet) => `- ${planet.name}: ${planet.sign.name} ${planet.sign.degree}°${planet.house ? `, nhà ${planet.house}` : ""}${planet.retrograde ? ", nghịch hành" : ""}`), "GÓC HỢP:", ...aspects.slice(0, 20).map((aspect) => `- ${aspect.first} ${aspect.name} ${aspect.second}: ${aspect.separation}°, orb ${aspect.orb}°`), `PROVENANCE: ${result.provenance?.recordId || "có trong JSON"}`].join("\n");
    }
    if (view === "chart" && runtime.session.birthChart?.ok) {
      const chart = runtime.session.birthChart;
      return [`HỆ THỐNG: Bản đồ sao · Astronomy Engine · Equal House`, `THỜI ĐIỂM UTC: ${chart.instantUtc}`, `CUNG MỌC: ${chart.ascendant.name} ${chart.ascendant.degree}°`, `THIÊN ĐỈNH: ${chart.midheaven.name} ${chart.midheaven.degree}°`, "HÀNH TINH:", ...chart.planets.map((planet) => `- ${planet.name}: ${planet.sign.name} ${planet.sign.degree}°, nhà ${planet.house}${planet.retrograde ? ", nghịch hành" : ""}`), "GÓC HỢP:", ...chart.aspects.slice(0, 16).map((aspect) => `- ${aspect.first} ${aspect.name} ${aspect.second}: ${aspect.separation}°, orb ${aspect.exactness}°`), `PHƯƠNG PHÁP: ${chart.method.ephemeris}; ${chart.method.houses}; ${chart.method.interpretation}`].join("\n");
    }
    if (view === "session" && runtime.builder?.result) return [`HỆ THỐNG: Phiên xem tổng hợp`, `CHỦ ĐỀ: ${runtime.builder.result.title}`, ...runtime.builder.result.parts.map((part) => `${part.label}: ${part.text}`)].join("\n\n");
    const daily = dailyReading(runtime.ownerId);
    return `${daily.title}\n${daily.message}`;
  }

  function astrologyResultPlanets(result) { return result?.planets || result?.transitPlanets || result?.progressed?.planets || result?.chart?.planets || result?.solarArcPlanets || []; }
  function attachAstrologyResultContract(result, profile, mode, targetValue) {
    const helper = suiteV4(); if (!result?.ok || !helper?.attachResultContract) return result;
    const planets = astrologyResultPlanets(result); const aspects = result.aspects || result.secondaryAspects || result.solarArcAspects || result.chart?.aspects || [];
    return helper.attachResultContract(result, { methodId: "astrology-v5", profile, input: { mode, target: targetValue || null, zodiacMode: profile.zodiacMode, houseSystem: profile.houseSystem, aspectOrbs: profile.aspectOrbs, birthTimeAccuracy: profile.birthTimeAccuracy }, calculatedFacts: [
      { factId: "astrology.instant", type: "time", label: "Thời điểm UTC", value: result.targetUtc || result.instantUtc || result.returnUtc || result.progressedInstantUtc || result.chart?.instantUtc || null, sourceId: "astronomy-engine" },
      ...planets.slice(0, 24).map((planet) => ({ factId: `astrology.body.${String(planet.body || planet.name).toLowerCase()}`, type: "ephemeris", label: planet.name, value: `${Number(planet.longitude).toFixed(5)}°${Number.isFinite(planet.speedDegreesPerDay) ? ` · ${Number(planet.speedDegreesPerDay).toFixed(5)}°/day` : ""}${planet.direction ? ` · ${planet.direction}` : ""}`, sourceId: "astronomy-engine" })),
      ...aspects.slice(0, 40).map((aspect, index) => ({ factId: `astrology.aspect.${index + 1}`, type: "angular-relation", label: `${aspect.first || aspect.firstBody} ${aspect.name || aspect.id} ${aspect.second || aspect.secondBody}`, value: `${Number(aspect.separation).toFixed(4)}° · orb ${Number(aspect.orb).toFixed(4)}°${aspect.phase ? ` · ${aspect.phase}` : ""}`, sourceId: "astronomy-engine" }))
    ], symbolicInterpretations: [{ interpretationId: "astrology.scope", label: `Chế độ ${mode}`, text: "Tên cung, nhà và góc hợp là lớp chiêm tinh biểu tượng đặt trên dữ liệu vị trí; độ chính xác thiên văn không chứng minh khả năng dự báo." }], limitations: [...(result.limitations || []), profile.birthTimeAccuracy === "unknown" ? "Không biết giờ sinh: ASC, MC, nhà và Part of Fortune phải được ẩn." : "Nhà và góc phụ thuộc dữ liệu sinh cùng hệ phương pháp đã chọn."] });
  }
  function astrologySvg(result, title = "HH Astrology Studio") {
    const planets = astrologyResultPlanets(result); const size = 960; const center = size / 2; const radius = 330;
    const zodiac = Array.from({ length: 12 }, (_, index) => { const angle = (index * 30 - 90) * Math.PI / 180; const x = center + Math.cos(angle) * radius; const y = center + Math.sin(angle) * radius; return `<line x1="${center}" y1="${center}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,.16)"/>`; }).join("");
    const dots = planets.map((planet, index) => { const angle = (Number(planet.longitude) - 90) * Math.PI / 180; const ring = radius - 48 - (index % 2) * 32; const x = center + Math.cos(angle) * ring; const y = center + Math.sin(angle) * ring; return `<g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="18" fill="#8b6cff" stroke="#d9d0ff" stroke-width="2"/><text x="${x.toFixed(1)}" y="${(y + 6).toFixed(1)}" fill="white" text-anchor="middle" font-size="17">${escapeHtml(planet.symbol || "•")}</text></g>`; }).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><radialGradient id="bg"><stop offset="0" stop-color="#2c1b57"/><stop offset="1" stop-color="#080713"/></radialGradient></defs><rect width="100%" height="100%" rx="42" fill="url(#bg)"/><text x="60" y="72" fill="#fff" font-family="system-ui" font-size="28" font-weight="700">${escapeHtml(title)}</text><circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#75e5ef" stroke-width="3"/>${zodiac}<circle cx="${center}" cy="${center}" r="165" fill="none" stroke="rgba(255,255,255,.22)"/>${dots}<text x="${center}" y="${center - 4}" fill="#fff" text-anchor="middle" font-family="system-ui" font-size="28" font-weight="700">${escapeHtml(result?.mode || "natal")}</text><text x="${center}" y="${center + 30}" fill="#afa7c5" text-anchor="middle" font-family="system-ui" font-size="15">Tính toán thiên văn + diễn giải biểu tượng</text></svg>`;
  }
  function astrologyPng(runtime, result) {
    if (!globalScope.document) return false;
    const canvas = globalScope.document.createElement("canvas"); canvas.width = 1200; canvas.height = 1200; const context = canvas.getContext("2d"); if (!context) return false;
    const gradient = context.createRadialGradient(600, 420, 20, 600, 600, 760); gradient.addColorStop(0, "#35205e"); gradient.addColorStop(1, "#070611"); context.fillStyle = gradient; context.fillRect(0, 0, 1200, 1200);
    context.fillStyle = "#fff"; context.font = "700 36px system-ui"; context.fillText(`HH Astrology · ${runtime.session.astrologyMode}`, 70, 80); context.fillStyle = "#75e5ef"; context.font = "500 18px system-ui"; context.fillText("Tính toán thiên văn + diễn giải biểu tượng", 70, 115);
    const planets = astrologyResultPlanets(result); const center = 600; const radius = 420; context.strokeStyle = "rgba(117,229,239,.55)"; context.lineWidth = 4; context.beginPath(); context.arc(center, center + 70, radius, 0, Math.PI * 2); context.stroke(); context.strokeStyle = "rgba(255,255,255,.16)"; context.lineWidth = 1;
    for (let index = 0; index < 12; index += 1) { const angle = (index * 30 - 90) * Math.PI / 180; context.beginPath(); context.moveTo(center, center + 70); context.lineTo(center + Math.cos(angle) * radius, center + 70 + Math.sin(angle) * radius); context.stroke(); }
    planets.forEach((planet, index) => { const angle = (Number(planet.longitude) - 90) * Math.PI / 180; const ring = radius - 75 - (index % 2) * 42; const x = center + Math.cos(angle) * ring; const y = center + 70 + Math.sin(angle) * ring; context.fillStyle = "#8b6cff"; context.beginPath(); context.arc(x, y, 25, 0, Math.PI * 2); context.fill(); context.fillStyle = "#fff"; context.font = "22px system-ui"; context.textAlign = "center"; context.fillText(planet.symbol || "•", x, y + 8); context.textAlign = "left"; context.font = "500 17px system-ui"; context.fillText(`${planet.name} · ${planet.sign.name} ${planet.sign.degree.toFixed(1)}°`, 70, 940 + index * 24); });
    const anchor = globalScope.document.createElement("a"); anchor.download = `hh-astrology-${runtime.session.astrologyMode}-${Date.now()}.png`; anchor.href = canvas.toDataURL("image/png"); anchor.click(); return true;
  }
  async function astrologyPdf(runtime, result) {
    if (!globalScope.PDFLib) throw new Error("PDF engine chưa được tải.");
    const pdf = await globalScope.PDFLib.PDFDocument.create(); const page = pdf.addPage([595.28, 841.89]); const { rgb } = globalScope.PDFLib; page.drawText(`HH Astrology · ${runtime.session.astrologyMode}`, { x: 42, y: 790, size: 21, color: rgb(.3, .2, .55) }); page.drawText("Tính toán thiên văn + diễn giải biểu tượng", { x: 42, y: 766, size: 10, color: rgb(.35, .35, .4) });
    const planets = astrologyResultPlanets(result); let y = 720; for (const planet of planets) { page.drawText(`${planet.name}: ${planet.sign.name} ${planet.sign.degree.toFixed(2)}°${planet.house ? ` · nhà ${planet.house}` : ""}${planet.retrograde ? " · R" : ""}`, { x: 50, y, size: 11, color: rgb(.12, .1, .18) }); y -= 22; }
    page.drawText("Provenance: engine, input và phiên bản được giữ trong JSON xuất riêng.", { x: 42, y: 52, size: 8, color: rgb(.35, .35, .4) }); const bytes = await pdf.save(); downloadFile(`hh-astrology-${runtime.session.astrologyMode}-${Date.now()}.pdf`, bytes, "application/pdf");
  }

  function downloadFile(filename, content, type = "text/plain;charset=utf-8") {
    if (!globalScope.document || !globalScope.URL || !globalScope.Blob) return false;
    const url = globalScope.URL.createObjectURL(new Blob([content], { type }));
    const anchor = globalScope.document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => globalScope.URL.revokeObjectURL(url), 1000);
    return true;
  }

  function resultCanvas(runtime, ratio = "1:1") {
    if (!globalScope.document) return false;
    const canvas = globalScope.document.createElement("canvas");
    const sizes = { "1:1": [1200, 1200], "9:16": [1080, 1920], "16:9": [1920, 1080] };
    [canvas.width, canvas.height] = sizes[ratio] || sizes["1:1"];
    const context = canvas.getContext("2d");
    if (!context) return false;
    const width = canvas.width; const height = canvas.height; const padding = Math.round(Math.min(width, height) * 0.08);
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#14102c"); gradient.addColorStop(0.55, "#30195c"); gradient.addColorStop(1, "#082f45");
    context.fillStyle = gradient; context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(255,255,255,.16)"; context.lineWidth = 2; context.strokeRect(padding * 0.55, padding * 0.55, width - padding * 1.1, height - padding * 1.1);
    context.fillStyle = "#d9c9ff"; context.font = `700 ${Math.max(22, Math.round(width * .024))}px system-ui`; context.fillText("HH · XEM BÓI", padding, padding * 1.25);
    context.fillStyle = "#ffffff"; context.font = `800 ${Math.max(38, Math.round(width * .048))}px system-ui`; context.fillText("Khoảng lặng để tự soi chiếu", padding, padding * 2.15);
    const fontSize = Math.max(24, Math.round(width * .027)); const lineHeight = Math.round(fontSize * 1.62);
    context.font = `400 ${fontSize}px system-ui`;
    const words = currentResultText(runtime).replace(/\n/g, " ").split(/\s+/);
    let line = ""; let y = padding * 3.15; const maxWidth = width - padding * 2; const footerY = height - padding * 1.05;
    words.forEach((word) => {
      const candidate = `${line}${word} `;
      if (context.measureText(candidate).width > maxWidth && line) { if (y < footerY - lineHeight) context.fillText(line, padding, y); line = `${word} `; y += lineHeight; }
      else line = candidate;
    });
    if (line && y < footerY - lineHeight) context.fillText(line, padding, y);
    context.fillStyle = "#b9afd3"; context.font = `500 ${Math.max(17, Math.round(width * .019))}px system-ui`; context.fillText("Nội dung giải trí và tự chiêm nghiệm · hoang8.com", padding, footerY);
    return canvas;
  }

  function loadCanvasImage(source) { return new Promise((resolve) => { const image = new globalScope.Image(); image.decoding = "async"; image.onload = () => resolve(image); image.onerror = () => resolve(null); image.src = source; }); }
  async function tarotResultCanvas(runtime, ratio = "1:1") {
    if (!globalScope.document || !globalScope.Image) return resultCanvas(runtime, ratio); const cards = runtime.session.tarot || []; if (!cards.length) return resultCanvas(runtime, ratio);
    const canvas = globalScope.document.createElement("canvas"); const sizes = { "1:1": [1200, 1200], "9:16": [1080, 1920], "16:9": [1920, 1080] }; [canvas.width, canvas.height] = sizes[ratio] || sizes["1:1"]; const context = canvas.getContext("2d"); if (!context) return false;
    const width = canvas.width; const height = canvas.height; const padding = Math.round(Math.min(width, height) * .055); const gradient = context.createLinearGradient(0, 0, width, height); gradient.addColorStop(0, "#100b27"); gradient.addColorStop(.55, "#31205f"); gradient.addColorStop(1, "#083248"); context.fillStyle = gradient; context.fillRect(0, 0, width, height);
    context.fillStyle = "#8cf1f3"; context.font = `800 ${Math.max(18, Math.round(width * .018))}px system-ui`; context.fillText("RIDER–WAITE–SMITH TAROT · 1909", padding, padding); context.fillStyle = "#fff"; context.font = `800 ${Math.max(30, Math.round(width * .034))}px system-ui`; context.fillText(`Trải bài ${cards.length} lá`, padding, padding * 1.8);
    const columns = ratio === "9:16" ? Math.min(cards.length, 3) : ratio === "16:9" ? Math.min(cards.length, 7) : Math.min(cards.length, 5); const rows = Math.ceil(cards.length / columns); const top = padding * 2.35; const footer = padding * 1.2; const gap = Math.max(10, Math.round(padding * .22)); const slotWidth = (width - padding * 2 - gap * (columns - 1)) / columns; const slotHeight = (height - top - footer - gap * (rows - 1)) / rows; const images = await Promise.all(cards.map((card) => card.image ? loadCanvasImage(card.image) : Promise.resolve(null)));
    cards.forEach((card, index) => { const column = index % columns; const row = Math.floor(index / columns); const x = padding + column * (slotWidth + gap); const y = top + row * (slotHeight + gap); const labelHeight = Math.max(24, Math.min(54, slotHeight * .16)); const imageHeight = Math.min(slotHeight - labelHeight, slotWidth * 617 / 360); const imageWidth = imageHeight * 360 / 617; const imageX = x + (slotWidth - imageWidth) / 2; context.save(); context.shadowColor = "rgba(0,0,0,.45)"; context.shadowBlur = 18; context.fillStyle = "#e7ddc5"; context.fillRect(imageX, y, imageWidth, imageHeight); if (images[index]) { if (card.reversed) { context.translate(imageX + imageWidth / 2, y + imageHeight / 2); context.rotate(Math.PI); context.drawImage(images[index], -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight); } else context.drawImage(images[index], imageX, y, imageWidth, imageHeight); } context.restore(); context.fillStyle = "#fff"; context.textAlign = "center"; context.font = `700 ${Math.max(11, Math.min(22, slotWidth * .075))}px system-ui`; const shortName = String(card.name || "").split(" · ")[0]; context.fillText(shortName.slice(0, 25), x + slotWidth / 2, y + imageHeight + labelHeight * .46); context.fillStyle = card.reversed ? "#ffb2d2" : "#8ef1dc"; context.font = `600 ${Math.max(9, Math.min(16, slotWidth * .055))}px system-ui`; context.fillText(card.reversed ? "REVERSED" : "UPRIGHT", x + slotWidth / 2, y + imageHeight + labelHeight * .8); context.textAlign = "left"; });
    context.fillStyle = "#b9afd0"; context.font = `500 ${Math.max(12, Math.round(width * .012))}px system-ui`; context.fillText("Pamela Colman Smith · Public Domain Mark 1.0 · Wikimedia Commons · Diễn giải HH chỉ để tự chiêm nghiệm", padding, height - padding * .35); return canvas;
  }

  async function exportResultPng(runtime) {
    const ratio = runtime.root?.querySelector("[data-fortune-export-ratio]")?.value || "1:1";
    const canvas = runtime.state.view === "tarot" ? await tarotResultCanvas(runtime, ratio) : resultCanvas(runtime, ratio);
    if (!canvas) return false;
    const anchor = globalScope.document.createElement("a");
    anchor.download = `hh-xem-boi-${ratio.replace(":", "x")}-${Date.now()}.png`; anchor.href = canvas.toDataURL("image/png"); anchor.click();
    return true;
  }

  function canvasBlob(canvas) { return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Không tạo được ảnh.")), "image/png")); }

  async function exportJournalPdf(journal) {
    if (!globalScope.PDFLib || !globalScope.document) throw new Error("PDF engine chưa được tải.");
    const { PDFDocument } = globalScope.PDFLib; const pdf = await PDFDocument.create();
    const pages = []; const pageWidth = 1240; const pageHeight = 1754; const margin = 80;
    let canvas = globalScope.document.createElement("canvas"); canvas.width = pageWidth; canvas.height = pageHeight; let context = canvas.getContext("2d"); let y = margin;
    const flush = () => { pages.push(canvas.toDataURL("image/png").split(",")[1]); canvas = globalScope.document.createElement("canvas"); canvas.width = pageWidth; canvas.height = pageHeight; context = canvas.getContext("2d"); context.fillStyle = "#ffffff"; context.fillRect(0, 0, pageWidth, pageHeight); y = margin; };
    context.fillStyle = "#ffffff"; context.fillRect(0, 0, pageWidth, pageHeight); context.fillStyle = "#151126"; context.font = "700 42px system-ui"; context.fillText("HH · NHẬT KÝ SUY NGẪM", margin, y); y += 70;
    const drawWrapped = (text, font, color, spacing) => { context.font = font; context.fillStyle = color; const words = String(text || "").split(/\s+/); let line = ""; for (const word of words) { const candidate = `${line}${word} `; if (context.measureText(candidate).width > pageWidth - margin * 2 && line) { if (y > pageHeight - margin - spacing) flush(); context.fillText(line, margin, y); y += spacing; line = `${word} `; } else line = candidate; } if (line) { if (y > pageHeight - margin - spacing) flush(); context.fillText(line, margin, y); y += spacing; } };
    for (const item of journal) { drawWrapped(`${formatDateTime(item.createdAt)} · ${item.tag} · cảm xúc ${item.moodBefore || 3} → ${item.moodAfter || 3}`, "700 22px system-ui", "#5d3ca0", 34); drawWrapped(item.text, "400 25px system-ui", "#262233", 38); y += 25; }
    if (!journal.length) drawWrapped("Nhật ký đang trống.", "400 25px system-ui", "#262233", 38);
    pages.push(canvas.toDataURL("image/png").split(",")[1]);
    for (const encoded of pages) { const image = await pdf.embedPng(encoded); const page = pdf.addPage([595.28, 841.89]); page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 }); }
    const bytes = await pdf.save(); downloadFile(`hh-nhat-ky-${Date.now()}.pdf`, bytes, "application/pdf");
  }

  async function exportReflectionPack(runtime) {
    if (!globalScope.JSZip) throw new Error("ZIP engine chưa được tải.");
    const zip = new globalScope.JSZip(); const journal = activeJournal(runtime) || [];
    zip.file("README.txt", "HH Reflection Pack\nNội dung giải trí và tự chiêm nghiệm. Không phải lời khuyên y tế, pháp lý hoặc tài chính.\nDữ liệu ngày sinh và tọa độ không được tự động đưa vào gói.");
    zip.file("result.txt", currentResultText(runtime));
    zip.file("history.json", JSON.stringify(runtime.state.history, null, 2));
    zip.file("journal.json", JSON.stringify(journal, null, 2));
    zip.file("methods.json", JSON.stringify({ version: VERSION, methods: METHOD_CATALOG }, null, 2));
    const canvas = resultCanvas(runtime, "1:1"); if (canvas) zip.file("reflection-preview.png", await canvasBlob(canvas));
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
    downloadFile(`hh-reflection-pack-${Date.now()}.zip`, blob, "application/zip");
  }

  async function copyText(text) {
    if (globalScope.navigator?.clipboard?.writeText) { await globalScope.navigator.clipboard.writeText(String(text)); return true; }
    return false;
  }

  function anonymousId() {
    try {
      let id = globalScope.localStorage?.getItem("hh-anonymous-id");
      if (!id) { id = globalScope.crypto?.randomUUID?.() || `fortune-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; globalScope.localStorage?.setItem("hh-anonymous-id", id); }
      return id;
    } catch (_error) { return `fortune-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
  }

  function buildCopilotFactLock(runtime, input) {
    const selectedText = String(input || ""); const facts = []; const entities = new Set(); const add = (factId, type, value, entity = "") => { if (!factId || value == null || facts.length >= 160 || (entity && !selectedText.includes(entity))) return; facts.push({ factId: String(factId).slice(0, 100), type: String(type || "calculation").slice(0, 40), value: String(value).slice(0, 360) }); if (entity) entities.add(String(entity).slice(0, 120)); };
    const view = runtime.session.copilotSourceView || runtime.state.view;
    if (view === "chart" && runtime.session.astrologyV4?.ok) {
      const result = runtime.session.astrologyV4; const planets = astrologyResultPlanets(result);
      planets.forEach((planet) => { add(`planet.${String(planet.body || planet.name).toLowerCase()}`, "calculation", `${planet.name}: ${planet.sign?.name || ""} ${planet.sign?.degree ?? ""}°${planet.house ? `, nhà ${planet.house}` : ", không tính nhà"}${planet.direction ? `, ${planet.direction}` : ""}`, planet.name); });
      (result.aspects || result.secondaryAspects || result.chart?.aspects || []).slice(0, 60).forEach((aspect, index) => { if (selectedText.includes(aspect.first) && selectedText.includes(aspect.second)) add(`aspect.${index + 1}`, "calculation", `${aspect.first} ${aspect.name} ${aspect.second}: ${aspect.separation}°, orb ${aspect.orb}°, ${aspect.phase || "undetermined"}`); });
      if (result.ascendant) add("angle.asc", "calculation", `ASC ${result.ascendant.name} ${result.ascendant.degree}°`, "ASC"); if (result.midheaven) add("angle.mc", "calculation", `MC ${result.midheaven.name} ${result.midheaven.degree}°`, "MC");
    } else if (view === "tarot" && runtime.session.tarot?.length) runtime.session.tarot.forEach((card, index) => { add(`tarot.${index + 1}`, "symbolic", `${card.position}: ${card.name} · ${card.reversed ? "reversed" : "upright"}`, card.name); });
    else if (view === "symbols" && runtime.session.symbolDeck?.cards?.length) runtime.session.symbolDeck.cards.forEach((card,index)=>add(`symbols.${index+1}`, "symbolic", `${card.name}: ${card.prompt}`, card.name));
    else if (view === "zodiac") {
      const western = runtime.session.western; const chinese = runtime.session.chinese;
      if (western?.ok) add("zodiac.solar", "calculation", `${western.sign.name} · ${western.sign.longitude}° · ${western.sign.element} · ${western.sign.modality}`, western.sign.name);
      if (chinese?.ok) add("zodiac.chinese", "calendar-symbol", `${chinese.pillar.stem} ${chinese.pillar.branch} · ${chinese.animal} · ${chinese.yinYang} ${chinese.element}`, chinese.animal);
    }
    else if (view === "tuvi" && runtime.session.tuvi?.ok) {
      const result = runtime.session.tuvi; add("tuvi.foundation", "symbolic", `${result.fiveElementsClass} · Mệnh chủ ${result.soul} · Thân chủ ${result.body}`);
      result.palaces.forEach((palace,index)=>add(`tuvi.palace.${index+1}`, "symbolic", `${palace.name} ${palace.heavenlyStem} ${palace.earthlyBranch}: ${(palace.majorStars||[]).map((star)=>`${star.name}${star.mutagen?` Hóa ${star.mutagen}`:""}`).join(", ")||"vô chính diệu"}`, palace.name));
    }
    else if (view === "compatibility" && runtime.session.compatibility) {
      const result = runtime.session.compatibility; add("compatibility.profile-a", "symbolic", `${result.first.western.name} · ${result.first.chinese.animal} · đường đời ${result.first.lifePath}`, result.first.western.name); add("compatibility.profile-b", "symbolic", `${result.second.western.name} · ${result.second.chinese.animal} · đường đời ${result.second.lifePath}`, result.second.western.name); add("compatibility.focus", "symbolic", result.sharedFocus); add("compatibility.cycle", "symbolic", result.cycleRelation);
    }
    else if (view === "session" && runtime.builder?.result) runtime.builder.result.parts.forEach((part,index)=>add(`session.part.${index+1}`, "symbolic", `${part.label}: ${part.text}`, part.label));
    else if (view === "iching" && runtime.session.iching) {
      const advanced = runtime.session.ichingAdvanced;
      add("iching.primary", "symbolic", runtime.session.iching.title, runtime.session.iching.title); add("iching.nuclear", "symbolic", runtime.session.iching.nuclearTitle, runtime.session.iching.nuclearTitle); add("iching.changed", "symbolic", runtime.session.iching.changedTitle, runtime.session.iching.changedTitle);
      if (advanced?.opposite?.title) add("iching.opposite", "symbolic", advanced.opposite.title, advanced.opposite.title); if (advanced?.reversed?.title) add("iching.reversed", "symbolic", advanced.reversed.title, advanced.reversed.title);
      add("iching.lines", "calculation", `Hào động: ${runtime.session.iching.changing.join(", ") || "không có"}`); (advanced?.lines || []).forEach((line) => add(`iching.line.${line.number}`, "calculation", `Hào ${line.number}: ${line.value} · ${line.yang ? "dương" : "âm"}${line.changing ? " động" : " tĩnh"}`));
    }
    else if (view === "numerology" && runtime.session.numerology) {
      const basic = runtime.session.numerology; const advanced = runtime.session.numerologyV4;
      add("numerology.life-path", "calculation", `Đường đời ${basic.lifePath}`, `Đường đời ${basic.lifePath}`); add("numerology.birthday", "calculation", `Ngày sinh rút gọn ${basic.birthDay}`); add("numerology.attitude", "calculation", `Thái độ ${basic.attitude}`);
      if (advanced?.expression) add("numerology.expression", "calculation", `Biểu đạt ${advanced.expression.value}`); if (advanced?.soulUrge) add("numerology.soul", "calculation", `Nội tâm ${advanced.soulUrge.value}`); if (advanced?.personality) add("numerology.personality", "calculation", `Ấn tượng ${advanced.personality.value}`); if (advanced?.maturity) add("numerology.maturity", "calculation", `Trưởng thành ${advanced.maturity.value}`);
      if (runtime.session.cycles) add("numerology.cycle", "calculation", `Chu kỳ: năm ${runtime.session.cycles.personalYear}, tháng ${runtime.session.cycles.personalMonth}, ngày ${runtime.session.cycles.personalDay}`);
    }
    else if (view === "physiognomy" && runtime.session.physiognomyResult?.ok) {
      runtime.session.physiognomyResult.observations.forEach((item, index) => add(`physiognomy.observation.${index + 1}`, "symbolic", `${item.category}: ${item.label}. ${item.tradition}`));
    }
    else if (view === "dreams" && runtime.session.dreamResult?.ok) {
      add("dreams.emotion", "user-selected", `Cảm xúc đã chọn: ${runtime.session.dreamResult.emotion}`);
      runtime.session.dreamResult.matches.forEach((item, index) => add(`dreams.symbol.${index + 1}`, "local-match", `${item.matched.join(" · ") || item.id}: ${item.reflection}`));
    }
    else if (view === "moon" && runtime.session.moon) {
      const sky = runtime.session.moonAstronomy; const moon = runtime.session.moon;
      add("moon.phase", "calculation", `Pha ${sky?.ok ? sky.phaseAngle : Math.round(moon.phase * 360)}°, chiếu sáng ${sky?.ok ? sky.illuminatedPercent : moon.illumination}%`);
      add("moon.age", "calculation", `Tuổi trăng ${sky?.ok ? sky.ageDays : moon.ageDays} ngày`);
      if (sky?.ok) { add("moon.distance", "calculation", `Khoảng cách ${sky.distanceKm} km`); add("moon.rise-set", "calculation", `Mọc ${sky.localTimes?.rise || sky.rise || "không có"}; lặn ${sky.localTimes?.set || sky.set || "không có"}`); }
    }
    else if (view === "sky" && runtime.session.sky?.ok) {
      const sky = runtime.session.sky;
      add("sky.moon-phase", "calculation", `Pha ${sky.phaseAngle}°, chiếu sáng ${sky.illuminatedPercent}%`); add("sky.instant", "calculation", sky.instantUtc); add("sky.distance", "calculation", `Khoảng cách ${sky.distanceKm} km`); add("sky.rise-set", "calculation", `Mọc ${sky.localTimes?.rise || sky.rise || "không có"}; transit ${sky.localTimes?.transit || sky.transit || "không có"}; lặn ${sky.localTimes?.set || sky.set || "không có"}`);
      if (sky.nextLunarEclipse) add("sky.lunar-eclipse", "calculation", `Sự kiện nguyệt thực tiếp theo: ${sky.nextLunarEclipse.kind || "không xác định"} · ${formatDateTime(sky.nextLunarEclipse.time)}`);
    }
    else if (view === "eastern" && runtime.session.eastern?.ok) {
      const eastern = runtime.session.eastern; add("eastern.year-pillar", "calendar", `Can Chi năm ${eastern.yearPillar.stem} ${eastern.yearPillar.branch}`); add("eastern.lunar-label", "calendar", `Nhãn lịch âm ${eastern.lunarLabel || "không có"}`);
      eastern.solarTerms.slice(0, 24).forEach((term, index) => add(`eastern.solar-term.${index + 1}`, "astronomy-calendar", `${term.name} ${term.longitude}° · ${term.time || "không có event"}`));
    }
    return { schema: "hh.fortune.fact-lock.v1", facts, allowedEntities: [...entities], sourceView: view, mode: runtime.session.copilotMode || "easy", selectedTextDigest: accuracyLab()?.sha256?.(String(input || "")) || "" };
  }

  async function requestGeminiAnalysis(runtime, input, depth, sections, mode = "easy") {
    const base = String(runtime.options.apiBase || globalScope.HH_API_BASE || globalScope.location?.origin || "").replace(/\/$/, "");
    if (!base || !globalScope.fetch) throw new Error("Không tìm thấy backend Gemini.");
    const token = globalScope.HHAuthSession?.token?.() || "";
    runtime.aiController?.abort?.();
    runtime.aiController = new AbortController();
    const factLock = buildCopilotFactLock(runtime, input); const response = await globalScope.fetch(`${base}/api/modules/fortune/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        actionType: "fortune-deep-analysis",
        input: String(input || "").slice(0, 12000),
        anonymousId: anonymousId(),
        meta: {
          provider: "gemini",
          allowProviderFallback: true,
          requireProvider: false,
          model: depth === "expert" ? "gemini-3.5-flash" : "gemini-3.5-flash-lite",
           thinkingLevel: depth === "expert" ? "high" : "medium",
           depth,
           mode,
           sections,
           factLock
        }
      }),
      signal: runtime.aiController.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(String(payload.error || "Gemini chưa phản hồi.").slice(0, 500));
      error.status = response.status; error.code = payload.code || "FORTUNE_AI_ERROR"; throw error;
    }
    if (!payload.action?.output) throw new Error("Gemini trả về nội dung rỗng.");
    return payload.action;
  }

  function automaticInsightInput(runtime, kind) {
    if (kind === "tarot") {
      const cards = runtime.session.tarot || []; if (!cards.length) return "";
      return [
        "LOẠI: Tarot Rider–Waite–Smith dùng cho tự chiêm nghiệm, không phải dự báo khoa học.",
        ...cards.map((card,index)=>`Lá ${index+1} · ${card.position}: ${card.name} · ${card.reversed ? "đảo" : "xuôi"}. Diễn giải HH: ${card.interpretation}. Câu hỏi mở: ${card.question}`),
        "YÊU CẦU: đọc vai trò từng vị trí, hình tượng lặp, điểm bổ trợ/mâu thuẫn, nhiều khả năng diễn giải, điều chưa thể kết luận, câu hỏi kiểm chứng và ba bước nhỏ có thể đảo ngược. Không suy đoán câu hỏi riêng, danh tính hoặc tương lai."
      ].join("\n");
    }
    if (kind === "symbols") {
      const result = runtime.session.symbolDeck; if (!result?.cards?.length) return "";
      return [
        `LOẠI: ${result.type} · ${result.cards.length} biểu tượng; diễn giải không phải dự báo khách quan.`,
        ...result.cards.map((card,index)=>`${index+1}. ${card.name}${card.playingCard?` · ${card.playingCard}`:""}: ${card.prompt}`),
        "YÊU CẦU: đọc từng lá, cặp liền kề và mạch tổng hợp; tách dữ kiện khỏi liên tưởng, nêu ít nhất hai cách hiểu và ba câu hỏi chiêm nghiệm. Không suy đoán danh tính, sự kiện chắc chắn hoặc nội dung câu hỏi chưa được cung cấp."
      ].join("\n");
    }
    if (kind === "zodiac") {
      const western = runtime.session.western; const chinese = runtime.session.chinese; if (!western?.ok && !chinese?.ok) return "";
      return [
        "LOẠI: cung tropical và chu kỳ Can Chi là hệ biểu tượng đặt trên dữ kiện thiên văn/lịch.",
        western?.ok ? `Mặt Trời: ${western.sign.name}, ${western.sign.longitude}°, ${western.sign.element}, ${western.sign.modality}; ${western.nearBoundary ? "gần ranh giới" : "không gần ranh giới"}.` : "Không có kết quả cung Mặt Trời.",
        chinese?.ok ? `Chu kỳ: ${chinese.pillar.stem} ${chinese.pillar.branch} · ${chinese.animal} · ${chinese.yinYang} ${chinese.element}; mốc ${chinese.boundaryLabel}.` : "Không có kết quả Can Chi.",
        "YÊU CẦU: giải thích khác biệt dữ kiện/biểu tượng, đưa ví dụ tự kiểm chứng và câu hỏi giao tiếp; không gán tính cách cố định hoặc dự báo."
      ].join("\n");
    }
    if (kind === "numerology") {
      const basic = runtime.session.numerology; const result = runtime.session.numerologyV4; const cycles = runtime.session.cycles;
      if (!basic || !result) return "";
      return [
        "LOẠI: Thần số học biểu tượng; không phải đánh giá tính cách hoặc dự báo khoa học.",
        `HỆ: ${result.system}; chính sách master number: ${result.keepMasterNumbers ? "giữ 11/22/33" : "rút gọn toàn bộ"}.`,
        `Đường đời ${basic.lifePath}. Ngày sinh rút gọn ${basic.birthDay}. Thái độ ${basic.attitude}.`,
        result.expression ? `Biểu đạt ${result.expression.value}. Nội tâm ${result.soulUrge?.value}. Ấn tượng ${result.personality?.value}. Trưởng thành ${result.maturity?.value}. Cân bằng ${result.balance?.value}.` : "Không có nhóm chỉ số tên.",
        `Pinnacles: ${result.pinnacles.join(", ")}. Challenges: ${result.challenges.join(", ")}.`,
        `Karmic debt theo trường phái: ${result.karmicDebt.join(", ") || "không có"}. Karmic lessons: ${result.karmicLessons.join(", ") || "không có"}.`,
        cycles ? `Chu kỳ: năm ${cycles.personalYear}, tháng ${cycles.personalMonth}, ngày ${cycles.personalDay}.` : "Không có chu kỳ.",
        `Lo Shu (số:lần): ${Object.entries(result.loShu).map(([number,count])=>`${number}:${count}`).join(", ")}.`,
        "YÊU CẦU: giải thích từng lớp, quan hệ giữa các chỉ số, điểm bổ trợ/mâu thuẫn, câu hỏi kiểm chứng và ba thực hành nhỏ. Không suy đoán tên, tuổi, ngày sinh, nghề nghiệp hoặc tương lai."
      ].join("\n");
    }
    if (kind === "iching") {
      const result = runtime.session.ichingAdvanced; if (!result?.ok) return "";
      return [
        "LOẠI: cấu trúc Kinh Dịch biểu tượng; không phải lời tiên tri.",
        `QUẺ: ${result.primary.title} · ${result.primary.structure}.`,
        `QUẺ HỖ: ${result.nuclear.title} · ${result.nuclear.structure}.`,
        `QUẺ BIẾN: ${result.changed.title} · ${result.changed.structure}.`,
        `QUẺ ĐỐI: ${result.opposite.title}. QUẺ ĐẢO: ${result.reversed.title}.`,
        `THƯỢNG QUÁI: ${result.upper.symbol} ${result.upper.name} ${result.upper.nature}. HẠ QUÁI: ${result.lower.symbol} ${result.lower.name} ${result.lower.nature}.`,
        ...result.lines.map((line)=>`Hào ${line.number}: ${line.value} · ${line.yang ? "dương" : "âm"}${line.changing ? " động" : " tĩnh"}. ${line.reflection}`),
        `Hào động: ${result.moving.join(", ") || "không có"}. Quy tắc đọc: ${result.rule}`,
        "YÊU CẦU: giải thích cấu trúc quẻ chính, hai quái, từng hào, thứ tự hào động, quẻ hỗ/biến/đối/đảo; nêu nhiều khả năng diễn giải, điều không thể kết luận và ba hành động nhỏ. Không suy đoán câu hỏi riêng, danh tính hoặc tương lai."
      ].join("\n");
    }
    if (kind === "chart") {
      const result = runtime.session.astrologyV4; if (!result?.ok) return "";
      return [
        "LOẠI: Astrology Studio; vị trí thiên thể là tính toán, cung/nhà/góc hợp là lớp biểu tượng.",
        currentResultText(runtime, "chart"),
        "YÊU CẦU: đọc theo thứ tự Mặt Trời/Mặt Trăng/ASC nếu có, hành tinh theo cung và nhà, góc hợp, điểm bổ trợ và mâu thuẫn. Dẫn factId, nêu giới hạn giờ sinh và không dự báo sự kiện chắc chắn."
      ].join("\n");
    }
    if (kind === "tuvi") {
      const result = runtime.session.tuvi; if (!result?.ok) return "";
      return [
        "LOẠI: Tử Vi Đẩu Số theo engine iztro; hệ biểu tượng có nhiều trường phái.",
        `Cục: ${result.fiveElementsClass}. Mệnh chủ: ${result.soul}. Thân chủ: ${result.body}. Nhánh cung Mệnh: ${result.soulPalaceBranch}. Nhánh cung Thân: ${result.bodyPalaceBranch}.`,
        ...result.palaces.map((palace)=>`${palace.name} · ${palace.heavenlyStem} ${palace.earthlyBranch}${palace.isOriginalPalace?" · Cung Mệnh":""}${palace.isBodyPalace?" · Cung Thân":""}: chính tinh ${(palace.majorStars||[]).map((star)=>`${star.name}${star.brightness?` ${star.brightness}`:""}${star.mutagen?` Hóa ${star.mutagen}`:""}`).join(", ")||"vô chính diệu"}; phụ tinh ${(palace.minorStars||[]).map((star)=>star.name).join(", ")||"không có trong nhóm"}; Tràng Sinh ${palace.changsheng12||"—"}.`),
        "YÊU CẦU: giải thích Mệnh/Thân, từng cung, chính/phụ tinh, Tứ Hóa, tam phương cần đối chiếu và đại hạn như chu kỳ biểu tượng. Không nhắc ngày/giờ/giới tính, không chẩn đoán sức khỏe, không khẳng định giàu nghèo, hôn nhân hay tai họa."
      ].join("\n");
    }
    if (kind === "physiognomy") {
      const result = runtime.session.physiognomyResult; if (!result?.ok) return "";
      return [
        "LOẠI: Nhân tướng học như lịch sử biểu tượng và tự quan sát; không phải nhận diện sinh trắc học hoặc phép đo nhân cách.",
        ...result.observations.map((item, index) => `${index + 1}. ${item.category}: nhãn người dùng tự chọn “${item.label}”. Liên tưởng văn hóa: ${item.tradition}. Câu hỏi kiểm chứng: ${item.question}`),
        "YÊU CẦU: đối chiếu từng liên tưởng bằng ngôn ngữ trung lập, nêu định kiến có thể có, tạo câu hỏi tự kiểm chứng và ba hành động nhỏ. Không suy luận nhân cách, trí tuệ, đạo đức, sức khỏe, sắc tộc, mức hấp dẫn hoặc vận mệnh. Không nhắc hay yêu cầu ảnh."
      ].join("\n");
    }
    if (kind === "dreams") {
      const result = runtime.session.dreamResult; if (!result?.ok) return "";
      return [
        "LOẠI: nhật ký mô-típ giấc mơ; nội dung giấc mơ nguyên văn không được gửi.",
        `Cảm xúc do người dùng chọn: ${result.emotion}.`,
        ...(result.matches.length ? result.matches.map((item, index) => `${index + 1}. Mô-típ cục bộ ${item.matched.join(" · ") || item.id}: ${item.reflection}. Câu hỏi sẵn có: ${item.questions.join(" | ")}`) : ["Engine cục bộ không tìm thấy mô-típ rõ; không được tự bịa biểu tượng."]),
        "YÊU CẦU: đưa nhiều cách hiểu đời thường, câu hỏi gắn với cảm xúc và bối cảnh, ba bước ghi nhật ký an toàn. Không tái dựng nội dung giấc mơ, không dự báo và không chẩn đoán sức khỏe tâm thần."
      ].join("\n");
    }
    if (kind === "moon") {
      const moon = runtime.session.moon; const sky = runtime.session.moonAstronomy; if (!moon) return "";
      return [
        "LOẠI: dữ liệu Mặt Trăng thiên văn để giải thích và lập kế hoạch quan sát; phần chiêm nghiệm tách riêng.",
        `Ngày quan sát: ${moon.date}. Pha: ${moon.name}. Góc pha ${sky?.ok ? sky.phaseAngle : Math.round(moon.phase * 360)}°. Chiếu sáng ${sky?.ok ? sky.illuminatedPercent : moon.illumination}%. Tuổi trăng ${sky?.ok ? sky.ageDays : moon.ageDays} ngày.`,
        sky?.ok ? `Khoảng cách ${sky.distanceKm} km. Mọc ${sky.localTimes?.rise || sky.rise || "không có"}; transit ${sky.localTimes?.transit || sky.transit || "không có"}; lặn ${sky.localTimes?.set || sky.set || "không có"}.` : "Không có dữ liệu topocentric; chỉ dùng pha xấp xỉ cục bộ.",
        sky?.provenance ? `Nguồn tính: ${sky.provenance.engine || "Astronomy Engine"}; record ${sky.provenance.recordId || "không có"}.` : "Nguồn pha xấp xỉ được ghi trong Result Contract.",
        "YÊU CẦU: giải thích các số liệu, điều kiện quan sát và sai số chân trời/thời tiết. Không gán pha trăng với sức khỏe, hành vi, điềm báo hoặc quyết định cá nhân."
      ].join("\n");
    }
    if (kind === "sky") {
      const result = runtime.session.sky; if (!result?.ok) return "";
      return [
        "LOẠI: kế hoạch quan sát thiên văn dựa trên dữ liệu topocentric; không phải chỉ dẫn điều hướng hoặc an toàn hàng không/hàng hải.",
        `Thời điểm UTC ${result.instantUtc}. Pha ${result.phaseAngle}°, chiếu sáng ${result.illuminatedPercent}%, tuổi trăng ${result.ageDays} ngày, khoảng cách ${result.distanceKm} km.`,
        `Mọc ${result.localTimes?.rise || result.rise || "không có"}; transit ${result.localTimes?.transit || result.transit || "không có"}; lặn ${result.localTimes?.set || result.set || "không có"}.`,
        `Nguyệt thực tiếp: ${result.nextLunarEclipse?.kind || "không xác định"} · ${formatDateTime(result.nextLunarEclipse?.time)}. Nhật thực tiếp: ${result.nextSolarEclipse?.kind || "không xác định"} · ${formatDateTime(result.nextSolarEclipse?.time)}.`,
        `Nguồn tính: ${result.provenance?.engine || "Astronomy Engine"}; record ${result.provenance?.recordId || "không có"}.`,
        "YÊU CẦU: tóm tắt cửa sổ quan sát, giải thích chạng vạng và các giới hạn do mây/vật cản; đưa checklist an toàn. Không gán điềm báo."
      ].join("\n");
    }
    if (kind === "eastern") {
      const result = runtime.session.eastern; if (!result?.ok) return "";
      return [
        "LOẠI: nền lịch phương Đông; Can Chi và tiết khí là dữ liệu lịch/thiên văn, lớp diễn giải chỉ mang tính biểu tượng.",
        `Can Chi năm: ${result.yearPillar.stem} ${result.yearPillar.branch}. Nhãn lịch âm: ${result.lunarLabel || "không có"}.`,
        `Tiết khí: ${result.solarTerms.map((term) => `${term.name} ${term.longitude}° · ${term.time || "không có event"}`).join("; ")}.`,
        `Nguồn tính: ${result.provenance?.engine || "Astronomy Engine + Intl Chinese Calendar"}; record ${result.provenance?.recordId || "không có"}.`,
        "YÊU CẦU: giải thích cách đọc Can Chi và 24 tiết khí, tách tính toán khỏi biểu tượng, nêu giới hạn trường phái. Không suy đoán ngày sinh, giờ sinh, tọa độ, Bát Tự hoặc Tử Vi đầy đủ. Không gán ngày cát/hung chắc chắn."
      ].join("\n");
    }
    if (kind === "compatibility") {
      const result = runtime.session.compatibility; if (!result) return "";
      return [
        "LOẠI: đối chiếu hai hồ sơ biểu tượng để hỗ trợ giao tiếp; không chấm điểm hợp/khắc.",
        `Hồ sơ A: ${result.first.western.name}, ${result.first.chinese.animal}, đường đời ${result.first.lifePath}.`,
        `Hồ sơ B: ${result.second.western.name}, ${result.second.chinese.animal}, đường đời ${result.second.lifePath}.`,
        `Trọng tâm: ${result.sharedFocus}. Quan hệ chu kỳ: ${result.cycleRelation}. Câu hỏi sẵn có: ${result.prompts.join(" | ")}.`,
        "YÊU CẦU: tạo kế hoạch đối thoại trung lập, ba câu hỏi, ranh giới an toàn và lịch kiểm tra lại; không suy đoán tình cảm, độ trung thành hoặc tương lai quan hệ."
      ].join("\n");
    }
    if (kind === "session") {
      const result = runtime.builder?.result; if (!result) return "";
      return ["LOẠI: phiên chiêm nghiệm tổng hợp; các lớp biểu tượng không phải dự báo.", ...result.parts.map((part)=>`${part.label}: ${part.text}`), "YÊU CẦU: tóm tắt điểm chung, mâu thuẫn, điều chưa biết, câu hỏi kiểm chứng và ba hành động nhỏ. Không suy đoán câu hỏi riêng hoặc dữ liệu hồ sơ gốc."].join("\n");
    }
    return "";
  }

  async function runAutomaticFortuneAi(runtime, kind, force = false) {
    if (!AUTOMATIC_AI_VIEWS.includes(kind)) return;
    const input = automaticInsightInput(runtime, kind); if (!input) return;
    const contract = currentResultContract(runtime, kind); const cacheKey = accuracyLab()?.sha256?.({ schema: "hh.fortune.ai-cache.v1", kind, input, inputDigest: contract?.inputDigest || "", resultDigest: contract?.resultDigest || "" }) || `${kind}-${hashSeed(input).toString(16)}`;
    if (!force && runtime.aiCache?.has(cacheKey)) { runtime.session[`${kind}Ai`] = { ...runtime.aiCache.get(cacheKey), cached: true }; render(runtime, true); return; }
    runtime.session[`${kind}Ai`] = { status: "loading", startedAt: new Date().toISOString() }; runtime.pendingScrollTarget = { selector: ".fortune-result-workspace", behavior: "smooth" }; render(runtime, true);
    const previousSource = runtime.session.copilotSourceView; runtime.session.copilotSourceView = kind; const startedAt = globalScope.performance?.now?.() || Date.now();
    try {
      const action = await requestGeminiAnalysis(runtime, input, "expert", ["Tóm tắt trung lập", "Từng thành phần", "Liên kết và mâu thuẫn", "Nhiều cách diễn giải", "Điều không thể kết luận", "Câu hỏi suy ngẫm", "Ba hành động nhỏ", "Giới hạn phương pháp"], "deep");
      runtime.session[`${kind}Ai`] = { status: "ready", output: action.output, model: action.model || "Gemini", provider: action.provider || "gemini", factValidation: action.factValidation || null, latencyMs: Math.round((globalScope.performance?.now?.() || Date.now()) - startedAt), createdAt: new Date().toISOString(), cacheKey };
      runtime.aiCache?.set(cacheKey, { ...runtime.session[`${kind}Ai`] });
    } catch (error) {
      runtime.session[`${kind}Ai`] = { status: "error", error: String(error?.message || "Gemini chưa phản hồi").slice(0, 420), code: error?.code || "FORTUNE_AI_ERROR", createdAt: new Date().toISOString() };
    } finally {
      runtime.session.copilotSourceView = previousSource; render(runtime, true);
    }
  }

  async function syncEncryptedVault(runtime, direction) {
    const base = String(runtime.options.apiBase || globalScope.HH_API_BASE || globalScope.location?.origin || "").replace(/\/$/, ""); const token = globalScope.HHAuthSession?.token?.() || "";
    if (!token) throw new Error("Bạn cần đăng nhập để đồng bộ kho mã hóa theo tài khoản.");
    if (!base || !globalScope.fetch) throw new Error("Không tìm thấy backend đồng bộ.");
    if (direction === "upload" && !runtime.state.journalVault) throw new Error("Hãy bật mã hóa PIN trước khi đồng bộ.");
    const response = await globalScope.fetch(`${base}/api/modules/fortune/actions?fortuneVault=1`, { method: direction === "upload" ? "POST" : "GET", headers: { ...(direction === "upload" ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${token}` }, ...(direction === "upload" ? { body: JSON.stringify({ vault: runtime.state.journalVault }) } : {}), cache: "no-store" });
    const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(String(payload.error || "Không thể đồng bộ kho mã hóa.").slice(0, 300));
    if (direction === "download") { if (!payload.vault) throw new Error("Tài khoản chưa có bản sao mã hóa."); runtime.state.journalVault = payload.vault; runtime.state.journal = []; runtime.journalEntries = []; runtime.journalKey = null; writeState(runtime); }
    return payload;
  }

  function saveCurrent(runtime) {
    const view = runtime.state.view;
    if (view === "chart" && runtime.session.astrologyV4?.ok) return addHistory(runtime, "chart", `Astrology · ${runtime.session.astrologyMode}`, currentResultText(runtime, "chart").slice(0, 600));
    if (view === "sky" && runtime.session.sky?.ok) return addHistory(runtime, "sky", `Moon & Sky · ${runtime.session.sky.date}`, currentResultText(runtime, "sky").slice(0, 600));
    if (view === "eastern" && runtime.session.eastern?.ok) return addHistory(runtime, "eastern", `Can Chi · ${runtime.session.eastern.date}`, currentResultText(runtime, "eastern").slice(0, 600));
    if (view === "symbols" && runtime.session.symbolDeck) return addHistory(runtime, "symbols", `Bộ ${runtime.session.symbolDeck.type}`, currentResultText(runtime, "symbols").slice(0, 600));
    if (view === "numerology" && runtime.session.numerology) return addHistory(runtime, "numerology", `Đường đời ${runtime.session.numerology.lifePath}`, `${runtime.session.numerology.formula}. Chủ đề ${runtime.session.numerology.meaning}.${runtime.session.cycles ? ` ${runtime.session.cycles.formula}.` : ""}`);
    if (view === "iching" && runtime.session.iching) return addHistory(runtime, "iching", runtime.session.iching.title, `Quẻ biến: ${runtime.session.iching.changedTitle}. ${runtime.session.iching.reflection} ${runtime.session.iching.question}`);
    if (view === "zodiac" && runtime.session.western) return addHistory(runtime, "zodiac", runtime.session.western.name, `${runtime.session.western.element} · ${runtime.session.western.mode}. ${runtime.session.western.note}`);
    if (view === "zodiac" && runtime.session.chinese) return addHistory(runtime, "chinese", `${runtime.session.chinese.animal} · ${runtime.session.chinese.branch}`, `${runtime.session.chinese.yinYang} ${runtime.session.chinese.element}. ${runtime.session.chinese.note}.`);
    if (view === "moon" && runtime.session.moon) return addHistory(runtime, "moon", `${runtime.session.moon.name} · ${runtime.session.moon.date}`, `Chiếu sáng xấp xỉ ${runtime.session.moon.illumination}% · tuổi trăng ${runtime.session.moon.ageDays} ngày. ${runtime.session.moon.reflection}.`);
    if (view === "compatibility" && runtime.session.compatibility) return addHistory(runtime, "compatibility", "Bản đối chiếu biểu tượng", `${runtime.session.compatibility.sharedFocus} ${runtime.session.compatibility.cycleRelation}`);
    if (view === "chart" && runtime.session.birthChart?.ok) {
      const chart = runtime.session.birthChart;
      return addHistory(runtime, "chart", `Cung mọc ${chart.ascendant.name}`, chart.planets.slice(0, 5).map((planet) => `${planet.name} ${planet.sign.name} · nhà ${planet.house}`).join("; "));
    }
    return null;
  }

  function profileFromDom(runtime) {
    const city = runtime.root.querySelector("[data-fortune-profile-city]")?.value || "custom";
    return sanitizeProfile({
      date: runtime.root.querySelector("[data-fortune-profile-date]")?.value || "",
      time: runtime.root.querySelector("[data-fortune-profile-time]")?.value || "",
      city,
      place: runtime.root.querySelector("[data-fortune-profile-place]")?.value || "",
      timezoneId: runtime.root.querySelector("[data-fortune-profile-timezone-id]")?.value || "Asia/Ho_Chi_Minh",
      timezone: runtime.root.querySelector("[data-fortune-profile-timezone]")?.value,
      latitude: runtime.root.querySelector("[data-fortune-profile-latitude]")?.value,
      longitude: runtime.root.querySelector("[data-fortune-profile-longitude]")?.value,
      elevation: runtime.root.querySelector("[data-fortune-profile-elevation]")?.value,
      birthTimeAccuracy: runtime.root.querySelector("[data-fortune-profile-time-accuracy]")?.value,
      birthTimeSource: runtime.root.querySelector("[data-fortune-profile-time-source]")?.value,
      birthTimeUncertaintyMinutes: runtime.root.querySelector("[data-fortune-profile-time-uncertainty]")?.value,
      locationConfidence: runtime.root.querySelector("[data-fortune-profile-location-confidence]")?.value,
      calendarSystem: runtime.root.querySelector("[data-fortune-profile-calendar]")?.value,
      dstResolution: runtime.root.querySelector("[data-fortune-profile-dst-resolution]")?.value,
      zodiacMode: runtime.root.querySelector("[data-fortune-profile-zodiac-mode]")?.value,
      houseSystem: runtime.root.querySelector("[data-fortune-profile-house-system]")?.value,
      aspectOrbs: Object.fromEntries(Object.keys(DEFAULT_ORBS).map((key) => [key, runtime.root.querySelector(`[data-fortune-profile-orb="${key}"]`)?.value])),
      beforeTet: Boolean(runtime.root.querySelector("[data-fortune-profile-before-tet]")?.checked)
    });
  }

  function applyProfileToSession(runtime) {
    const profile = runtime.profile;
    if (!profile.date) return;
    runtime.session.zodiacDate = profile.date;
    runtime.session.chineseYear = profile.date.slice(0, 4);
    runtime.session.chineseBeforeTet = profile.beforeTet;
    runtime.session.birthDate = profile.date;
    runtime.session.moonDate = profile.date;
    runtime.session.skyDate = runtime.session.skyDate || profile.date;
    runtime.session.easternDate = runtime.session.easternDate || profile.date;
    runtime.session.astrologyTarget = runtime.session.astrologyTarget || localDateKey();
  }

  function createBuilderState() {
    return { step: 1, topic: "clarity", question: "", tools: ["tarot"], result: null, reflection: "", moodBefore: 3, moodAfter: 3 };
  }

  function runCombinedSession(runtime) {
    const root = runtime.root;
    runtime.builder.topic = root.querySelector("[data-fortune-builder-topic]")?.value || "clarity";
    runtime.builder.question = root.querySelector("[data-fortune-builder-question]")?.value.trim() || "";
    runtime.builder.tools = [...root.querySelectorAll("[data-fortune-builder-tool]:checked")].map((item) => item.dataset.fortuneBuilderTool).filter((id) => ["tarot", "numerology", "iching", "zodiac", "moon"].includes(id));
    if (!runtime.builder.tools.length) return { ok: false, message: "Hãy chọn ít nhất một công cụ." };
    const parts = [];
    if (runtime.builder.tools.includes("tarot")) {
      const seed = `${Date.now()}-${Math.random()}-builder`;
      const v4 = suiteV4();
      const reading = v4?.drawTarot78?.(seed, { count: 3, allowReversed: true });
      const cards = reading ? tarotCardsForView(reading) : drawTarot(seed, 3);
      runtime.session.tarot78 = reading || null;
      runtime.session.tarot = cards;
      runtime.session.tarotSeed = seed;
      parts.push({ label: "Tarot · ba góc nhìn", text: cards.map((card) => `${card.position}: ${card.name} — ${card.interpretation}`).join(" ") });
    }
    if (runtime.builder.tools.includes("numerology")) {
      const v4 = suiteV4();
      const numberV4 = v4?.advancedNumerology?.(runtime.profile.date, "", "pythagorean", localDateKey());
      const number = numberV4 ? { lifePath: numberV4.lifePath.value, meaning: NUMBER_MEANINGS[numberV4.lifePath.value] || "một nhịp biểu tượng để quan sát", formula: numberV4.lifePath.formula } : calculateNumerology(runtime.profile.date);
      if (number) {
        const cycles = calculatePersonalCycles(runtime.profile.date, localDateKey());
        parts.push({ label: "Thần số và chu kỳ", text: `Đường đời ${number.lifePath}: ${number.meaning}. ${cycles ? `Năm ${cycles.personalYear}, tháng ${cycles.personalMonth}, ngày ${cycles.personalDay} theo phép cộng biểu tượng.` : ""}` });
      } else parts.push({ label: "Thần số và chu kỳ", text: "Chưa có ngày sinh hợp lệ nên lớp này không được tự đoán." });
    }
    if (runtime.builder.tools.includes("iching")) {
      const v4 = suiteV4();
      const resultV4 = v4?.castIChingAdvanced?.(`${Date.now()}-${Math.random()}-builder`, { mode: "coins" });
      const result = resultV4 ? { title: resultV4.primary.title, reflection: resultV4.primary.theme || resultV4.rule, changedTitle: resultV4.changed.title } : castIChing(`${Date.now()}-${Math.random()}-builder`);
      parts.push({ label: "Kinh Dịch", text: `${result.title}. ${result.reflection} ${result.changedTitle}.` });
    }
    if (runtime.builder.tools.includes("zodiac")) {
      const date = parseLocalDate(runtime.profile.date);
      if (date) {
        const sign = getWesternZodiac(date.getUTCMonth() + 1, date.getUTCDate());
        parts.push({ label: "Cung và giao tiếp", text: `${sign.name} · ${sign.element} · ${sign.mode}. Dùng từ khóa như giả thuyết để quan sát cách giao tiếp, không phải nhãn cố định.` });
      } else parts.push({ label: "Cung và giao tiếp", text: "Chưa có ngày sinh nên hệ thống không tính cung." });
    }
    if (runtime.builder.tools.includes("moon")) {
      const moon = calculateMoonPhase(localDateKey());
      parts.push({ label: "Mặt Trăng và cảm xúc", text: `${moon.name}, chiếu sáng xấp xỉ ${moon.illumination}%. Gợi ý nhật ký: ${moon.reflection}.` });
    }
    const topics = { clarity: "Làm rõ tình huống", relationship: "Quan sát mối quan hệ", work: "Quan sát công việc", decision: "Cân nhắc quyết định", wellbeing: "Quan sát cảm xúc" };
    runtime.builder.result = { title: topics[runtime.builder.topic] || topics.clarity, parts, createdAt: new Date().toISOString() };
    runtime.builder.step = 6;
    return { ok: true };
  }

  function moveCalendar(runtime, direction) {
    const anchor = parseLocalDate(runtime.calendarAnchor) || new Date();
    const amount = runtime.calendarMode === "month" ? 0 : runtime.calendarMode === "week" ? 7 : 14;
    const next = runtime.calendarMode === "month"
      ? new Date(anchor.getUTCFullYear(), anchor.getUTCMonth() + Number(direction), 1, 12)
      : addDays(anchor, amount * Number(direction));
    runtime.calendarAnchor = localDateKey(next);
  }

  function playFortuneTone(runtime) {
    if (!runtime.state.settings.sound || !globalScope.AudioContext) return;
    try {
      const context = runtime.audioContext || new globalScope.AudioContext(); runtime.audioContext = context;
      const oscillator = context.createOscillator(); const gain = context.createGain();
      oscillator.type = "sine"; oscillator.frequency.value = 528; gain.gain.setValueAtTime(0.0001, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.035, context.currentTime + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28);
      oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.3);
    } catch (_error) { /* Âm thanh là tùy chọn. */ }
  }

  function updateAmbientSound(runtime) {
    if (!runtime.state.settings.sound) {
      runtime.ambientNodes?.forEach((node) => { try { node.stop?.(); node.disconnect?.(); } catch (_error) {} }); runtime.ambientNodes = []; return;
    }
    if (!globalScope.AudioContext || runtime.ambientNodes?.length) return;
    try {
      const context = runtime.audioContext || new globalScope.AudioContext(); runtime.audioContext = context; const gain = context.createGain(); gain.gain.value = .004;
      const low = context.createOscillator(); const high = context.createOscillator(); low.type = "sine"; high.type = "sine"; low.frequency.value = 108; high.frequency.value = 216.3;
      low.connect(gain); high.connect(gain); gain.connect(context.destination); low.start(); high.start(); runtime.ambientNodes = [low, high, gain];
    } catch (_error) { runtime.state.settings.sound = false; writeState(runtime); }
  }

  async function handleClick(runtime, event) {
    if (event.target.closest("[data-fortune-inspector-toggle]")) { if (!selectedInspectorItem(runtime)) return; runtime.inspectorOpen = !runtime.inspectorOpen; runtime.root.classList.toggle("is-inspector-open", runtime.inspectorOpen); event.target.closest("[data-fortune-inspector-toggle]").setAttribute("aria-expanded", String(runtime.inspectorOpen)); if (runtime.inspectorOpen) globalScope.queueMicrotask?.(() => runtime.root?.querySelector("[data-fortune-inspector-close]")?.focus()); return; }
    if (event.target.closest("[data-fortune-inspector-close]")) { runtime.inspectorOpen = false; runtime.root.classList.remove("is-inspector-open"); runtime.root.querySelector("[data-fortune-inspector-toggle]")?.setAttribute("aria-expanded", "false"); runtime.root.querySelector("[data-fortune-inspector-toggle]")?.focus(); return; }
    const resultTab = event.target.closest("[data-fortune-result-tab]");
    if (resultTab) { runtime.resultTab = resultTab.dataset.fortuneResultTab || "overview"; render(runtime, true); return; }
    const homePanelButton = event.target.closest("[data-fortune-home-panel]");
    if (homePanelButton) { syncHomePanelDom(runtime, homePanelButton.dataset.fortuneHomePanel); return; }
    const libraryFilter = event.target.closest("[data-fortune-library-filter]");
    if (libraryFilter) {
      runtime.libraryFilter = TOOL_LIBRARY_FILTERS.some(([id]) => id === libraryFilter.dataset.fortuneLibraryFilter) ? libraryFilter.dataset.fortuneLibraryFilter : "all";
      runtime.libraryPage = 0;
      runtime.root.querySelectorAll("[data-fortune-library-filter]").forEach((button) => { const active = button.dataset.fortuneLibraryFilter === runtime.libraryFilter; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); });
      filterObservatoryTools(runtime, runtime.toolQuery || "");
      return;
    }
    const libraryPageButton = event.target.closest("[data-fortune-library-page]");
    if (libraryPageButton) { runtime.libraryPage = Math.max(0, Number(runtime.libraryPage || 0) + Number(libraryPageButton.dataset.fortuneLibraryPage || 0)); filterObservatoryTools(runtime, runtime.toolQuery || ""); return; }
    if (event.target.closest("[data-fortune-random-tool]")) {
      const query = String(runtime.toolQuery || "").trim().toLocaleLowerCase("vi"); const family = runtime.libraryFilter || "all";
      const cards = [...runtime.root.querySelectorAll("[data-fortune-tool-card]")].filter((card) => (!query || String(card.dataset.toolSearch || "").includes(query)) && (family === "all" || card.dataset.toolFamily === family));
      if (!cards.length) { showToast(runtime, "Không có công cụ trong bộ lọc hiện tại.", "error"); return; }
      const index = Math.floor(createRandom(hashSeed(`${runtime.ownerId}:${Date.now()}:${cards.length}`))() * cards.length);
      const view = cards[index]?.dataset.fortuneView;
      if (VIEWS.has(view)) { playFortuneTone(runtime); transitionToView(runtime, view); }
      return;
    }
    if (event.target.closest("[data-fortune-action-note]")) { runtime.resultTab = "reflection"; runtime.flowStep = 3; runtime.pendingScrollTarget = { selector: ".fortune-result-workspace", behavior: "smooth" }; render(runtime, true); return; }
    const experienceButton = event.target.closest("[data-fortune-set-experience]");
    if (experienceButton) { runtime.state.settings.experience = experienceButton.dataset.fortuneSetExperience === "advanced" ? "advanced" : "beginner"; writeState(runtime); render(runtime, true); return; }
    const flowButton = event.target.closest("[data-fortune-flow-step]");
    if (flowButton) { runtime.flowStep = clamp(flowButton.dataset.fortuneFlowStep, 0, FLOW_STEPS.length - 1, 0); if (runtime.flowStep === 2 && hasFortuneResult(runtime)) runtime.resultTab = "overview"; if (runtime.flowStep === 3 && hasFortuneResult(runtime)) runtime.resultTab = "reflection"; runtime.pendingScrollTarget = { selector: runtime.flowStep >= 2 && hasFortuneResult(runtime) ? ".fortune-result-workspace" : ".fortune-tool-surface", behavior: "smooth" }; render(runtime, true); return; }
    if (event.target.closest("[data-fortune-reflection-to-journal]")) {
      const text = String(runtime.reflectionDraft || "").trim();
      if (text.length < 3) { showToast(runtime, "Hãy viết một ghi chú trước khi lưu.", "error"); return; }
      if (runtime.state.journalVault && !runtime.journalKey) { showToast(runtime, "Nhật ký đang khóa; hãy mở khóa trước khi lưu.", "error"); transitionToView(runtime, "journal"); return; }
      runtime.journalEntries.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, text: text.slice(0,4000), tag: "Suy ngẫm", createdAt: new Date().toISOString(), moodBefore: 3, moodAfter: 3, sessionType: runtime.state.view });
      runtime.journalEntries = runtime.journalEntries.slice(0, MAX_JOURNAL); await persistJournal(runtime); runtime.reflectionDraft = ""; showToast(runtime, "Đã lưu vào Nhật ký local-first."); render(runtime, true); return;
    }
    if (event.target.closest("[data-fortune-share-current]")) {
      const textValue = currentResultText(runtime); if (!textValue) { showToast(runtime, "Chưa có kết quả để chia sẻ.", "error"); return; }
      try { if (globalScope.navigator?.share) await globalScope.navigator.share({ title: "HH Mystic Observatory", text: textValue }); else await copyText(textValue); showToast(runtime, globalScope.navigator?.share ? "Đã mở bảng chia sẻ." : "Đã sao chép để chia sẻ."); } catch (_error) { /* Người dùng có thể đóng bảng chia sẻ. */ } return;
    }
    const groupSummary = event.target.closest("[data-fortune-group-summary]");
    if (groupSummary) {
      event.preventDefault();
      const selectedGroup = groupSummary.closest("[data-fortune-nav-group]");
      runtime.root.querySelectorAll("[data-fortune-nav-group]").forEach((group) => { group.open = group === selectedGroup; });
      return;
    }
    const viewButton = event.target.closest("[data-fortune-view]");
    if (viewButton) {
      const view = viewButton.dataset.fortuneView;
      if (VIEWS.has(view)) {
        const fromToolAtlas = Boolean(viewButton.closest("[data-fortune-tool-atlas]"));
        if (fromToolAtlas && runtime.state.view === view) runtime.root.classList.remove("is-nav-open");
        else transitionToView(runtime, view, { preserveScroll: fromToolAtlas });
      }
      return;
    }
    if (event.target.closest("[data-fortune-contract-verify]")) {
      const contract = currentResultContract(runtime); const verification = suiteV4()?.verifyResultContract?.(contract);
      const panel = runtime.root.querySelector("[data-fortune-result-contract]"); panel?.classList.remove("is-verified", "is-invalid"); panel?.classList.add(verification?.ok ? "is-verified" : "is-invalid");
      showToast(runtime, verification?.ok ? "Result Contract và SHA-256 khớp hoàn toàn." : (verification?.errors || ["Không có contract để xác minh."]).join(" "), verification?.ok ? "success" : "error"); return;
    }
    if (event.target.closest("[data-fortune-contract-download]")) {
      const contract = currentResultContract(runtime); if (!contract) { showToast(runtime, "Chưa có Result Contract.", "error"); return; }
      downloadFile(`hh-fortune-contract-${contract.methodId}-${Date.now()}.json`, JSON.stringify(contract, null, 2), "application/json"); showToast(runtime, "Đã tải Fortune Result Contract JSON."); return;
    }
    const tarotFocus = event.target.closest("[data-fortune-tarot-focus]");
    if (tarotFocus) {
      const index = clamp(tarotFocus.dataset.fortuneTarotFocus, 0, Math.max(0, runtime.session.tarot.length - 1), 0); runtime.session.tarotFocusIndex = index;
      if (!runtime.session.tarotRevealed.has(index)) { runtime.session.tarotRevealed.add(index); playFortuneTone(runtime); }
      runtime.inspectorOpen = true; render(runtime, true); globalScope.queueMicrotask?.(() => runtime.root?.querySelector("[data-fortune-inspector-close]")?.focus()); return;
    }
    const automaticRetry = event.target.closest("[data-fortune-auto-ai-retry]");
    if (automaticRetry) { await runAutomaticFortuneAi(runtime, automaticRetry.dataset.fortuneAutoAiRetry, true); return; }
    const tuviPalace = event.target.closest("[data-fortune-tuvi-palace]");
    if (tuviPalace) { runtime.session.tuviPalaceIndex = clamp(tuviPalace.dataset.fortuneTuviPalace, 0, Math.max(0, (runtime.session.tuvi?.palaces?.length || 1) - 1), 0); runtime.inspectorOpen = true; render(runtime, true); globalScope.queueMicrotask?.(() => runtime.root?.querySelector("[data-fortune-inspector-close]")?.focus()); return; }
    const symbolFocus = event.target.closest("[data-fortune-symbol-focus]");
    if (symbolFocus) { runtime.session.symbolFocusIndex = clamp(symbolFocus.dataset.fortuneSymbolFocus, 0, Math.max(0, (runtime.session.symbolDeck?.cards?.length || 1) - 1), 0); runtime.inspectorOpen = true; render(runtime, true); globalScope.queueMicrotask?.(() => runtime.root?.querySelector("[data-fortune-inspector-close]")?.focus()); return; }
    const ichingLine = event.target.closest("[data-fortune-iching-line]");
    if (ichingLine) { runtime.session.ichingLineIndex = Number(ichingLine.dataset.fortuneIchingLine); runtime.inspectorOpen = true; render(runtime, true); globalScope.queueMicrotask?.(() => runtime.root?.querySelector("[data-fortune-inspector-close]")?.focus()); return; }
    const numerologyFocus = event.target.closest("[data-fortune-number-focus]");
    if (numerologyFocus) { runtime.session.numerologyFocusIndex = Number(numerologyFocus.dataset.fortuneNumberFocus); runtime.inspectorOpen = true; render(runtime, true); globalScope.queueMicrotask?.(() => runtime.root?.querySelector("[data-fortune-inspector-close]")?.focus()); return; }
    const calendarDate = event.target.closest("[data-fortune-calendar-date]");
    if (calendarDate) { runtime.session.calendarSelectedDate = calendarDate.dataset.fortuneCalendarDate; render(runtime, true); return; }
    const calendarMoon = event.target.closest("[data-fortune-calendar-open-moon]");
    if (calendarMoon) { runtime.session.moonDate = calendarMoon.dataset.fortuneCalendarOpenMoon || localDateKey(); runtime.session.moon = calculateMoonPhase(runtime.session.moonDate); runtime.session.moonAstronomy = suiteV4()?.calculateMoonSky?.(runtime.session.moonDate, runtime.profile, globalScope.Astronomy) || null; transitionToView(runtime, "moon"); return; }
    const revealCard = event.target.closest("[data-fortune-card-reveal]");
    if (revealCard) {
      const index = Number(revealCard.dataset.fortuneCardReveal);
      if (runtime.session.tarot[index]) {
        runtime.session.tarotRevealed.add(index);
        playFortuneTone(runtime);
        render(runtime, true);
      }
      return;
    }
    if (event.target.closest("[data-fortune-reveal-all]")) {
      runtime.session.tarotRevealed = new Set(runtime.session.tarot.map((_, index) => index));
      playFortuneTone(runtime);
      render(runtime, true);
      return;
    }
    const academyTrack = event.target.closest("[data-fortune-academy-track]");
    if (academyTrack) { runtime.session.academyTrack = academyTrack.dataset.fortuneAcademyTrack; runtime.session.academyLessonIndex = 0; runtime.session.academyFlashRevealed = false; render(runtime, true); return; }
    const academyLesson = event.target.closest("[data-fortune-academy-lesson]");
    if (academyLesson) { const current = suiteV4()?.tarotAcademyLesson?.(runtime.session.academyTrack || "foundation", runtime.session.academyLessonIndex || 0); runtime.session.academyLessonIndex = clamp((current?.index || 0) + Number(academyLesson.dataset.fortuneAcademyLesson), 0, Math.max(0,(current?.track.lessonCount || 1)-1), 0); runtime.session.academyFlashRevealed = false; render(runtime, true); return; }
    if (event.target.closest("[data-fortune-academy-flash]")) { runtime.session.academyFlashRevealed = !runtime.session.academyFlashRevealed; render(runtime, true); return; }
    const academyConfidence = event.target.closest("[data-fortune-academy-confidence]");
    if (academyConfidence) { runtime.session.academyReview = suiteV4()?.academyReviewSchedule?.(Number(academyConfidence.dataset.fortuneAcademyConfidence), runtime.session.academyReview || {}) || null; showToast(runtime, "Đã cập nhật lịch ôn theo mức tự tin."); render(runtime, true); return; }
    if (event.target.closest("[data-fortune-nav-toggle]")) { runtime.root.classList.toggle("is-nav-open"); return; }
    if (event.target.closest("[data-fortune-toggle-experience]")) {
      runtime.state.settings.experience = runtime.state.settings.experience === "advanced" ? "beginner" : "advanced";
      writeState(runtime); render(runtime, true); return;
    }
    if (event.target.closest("[data-fortune-sound]")) {
      runtime.state.settings.sound = !runtime.state.settings.sound; writeState(runtime); updateAmbientSound(runtime); render(runtime); return;
    }
    if (event.target.closest("[data-fortune-ai-analyze]")) {
      const sourceView = runtime.state.view;
      if (!AUTOMATIC_AI_VIEWS.includes(sourceView)) { showToast(runtime, "Công cụ này dùng engine cục bộ và không cần Gemini."); return; }
      await runAutomaticFortuneAi(runtime, sourceView, true); return;
    }
    if (event.target.closest("[data-fortune-copilot-again]")) {
      runtime.session.copilot = null; render(runtime, true); return;
    }
    if (event.target.closest("[data-fortune-copilot-run]")) {
      const input = runtime.root.querySelector("[data-fortune-copilot-input]")?.value.trim() || "";
      const consent = Boolean(runtime.root.querySelector("[data-fortune-copilot-consent]")?.checked);
      if (input.length < 20) { showToast(runtime, "Hãy nhập hoặc chọn một kết quả đủ nội dung để phân tích.", "error"); return; }
      if (!consent) { showToast(runtime, "Bạn cần chủ động đồng ý trước khi gửi nội dung tới Gemini.", "error"); return; }
      const depth = runtime.root.querySelector("[data-fortune-copilot-depth]")?.value === "expert" ? "expert" : "detailed";
      const mode = runtime.root.querySelector("[data-fortune-copilot-mode]")?.value || "easy";
      const sectionMap = [["summary","Tóm tắt trung lập"],["components","Giải thích từng thành phần"],["links","Liên kết và mâu thuẫn"],["questions","Câu hỏi suy ngẫm"],["actions","Hành động nhỏ"],["safety","Kiểm tra an toàn"]];
      const sections = sectionMap.filter(([id]) => runtime.root.querySelector(`[data-fortune-copilot-${id}]`)?.checked).map(([, label]) => label);
      runtime.session.copilotInput = input; runtime.session.copilotDepth = depth; runtime.session.copilotMode = mode; runtime.copilotBusy = true; runtime.session.copilot = null; render(runtime, true);
      const startedAt = globalScope.performance?.now?.() || Date.now();
      try {
        const action = await requestGeminiAnalysis(runtime, input, depth, sections, mode);
        runtime.session.copilot = { output: action.output, mode, model: action.model || "Gemini", provider: action.provider || "gemini", usage: action.usage || null, factValidation: action.factValidation || null, latencyMs: Math.round((globalScope.performance?.now?.() || Date.now()) - startedAt), createdAt: new Date().toISOString() };
        showToast(runtime, "Gemini đã hoàn tất bản phân tích sâu.");
      } catch (error) {
        const quota = Number(error.status) === 429 || /quota|resource_exhausted|rate limit/i.test(error.message);
        showToast(runtime, quota ? "Gemini đang hết lượt tạm thời. Kết quả gốc vẫn được giữ; hãy thử lại sau." : `Không thể phân tích: ${error.message}`, "error");
      } finally {
        runtime.copilotBusy = false; runtime.aiController = null; render(runtime, true);
      }
      return;
    }
    if (event.target.closest("[data-fortune-accuracy-run]")) {
      const lab = accuracyLab(); if (!lab) { showToast(runtime, "Accuracy Laboratory chưa được tải.", "error"); return; }
      showToast(runtime, "Đang chạy 768 fixture timezone và thiên văn…"); await new Promise((resolve) => setTimeout(resolve, 20));
      runtime.session.accuracyReport = lab.runValidationLab(globalScope.Astronomy); render(runtime, true); showToast(runtime, runtime.session.accuracyReport.ok ? "Validation Laboratory: tất cả fixture runtime đã đạt." : `Validation Laboratory: ${runtime.session.accuracyReport.failures.length} lỗi.`, runtime.session.accuracyReport.ok ? "success" : "error"); return;
    }
    if (event.target.closest("[data-fortune-accuracy-report]")) { if (!runtime.session.accuracyReport) return; downloadFile(`hh-fortune-validation-${Date.now()}.json`, JSON.stringify(runtime.session.accuracyReport, null, 2), "application/json"); showToast(runtime, "Đã xuất validation report."); return; }
    if (event.target.closest("[data-fortune-certificate-download]")) { if (!runtime.session.calculationCertificate) return; downloadFile(`hh-calculation-certificate-${Date.now()}.json`, JSON.stringify(runtime.session.calculationCertificate, null, 2), "application/json"); showToast(runtime, "Đã tải Calculation Certificate JSON."); return; }
    if (event.target.closest("[data-fortune-certificate-verify]")) { const result = accuracyLab()?.verifyCalculationCertificate?.(runtime.session.calculationCertificate, runtime.session.astrologyV4); showToast(runtime, result?.ok ? "Certificate và kết quả hiện tại khớp SHA-256." : (result?.errors || ["Không thể xác minh."]).join(" "), result?.ok ? "success" : "error"); return; }
    if (event.target.closest("[data-fortune-profile-apply]")) {
      const nextProfile = profileFromDom(runtime); const quality = accuracyLab()?.assessInputQuality?.(nextProfile);
      if (quality?.localTime?.status === "nonexistent") { showToast(runtime, "Giờ này không tồn tại do chuyển DST. Hãy chọn giờ khác.", "error"); return; }
      if (quality?.localTime?.status === "ambiguous" && !nextProfile.dstResolution) { showToast(runtime, "Giờ này bị lặp do DST. Hãy chọn lần sớm hoặc lần muộn.", "error"); return; }
      runtime.profile = nextProfile;
      const remember = Boolean(runtime.root.querySelector("[data-fortune-profile-remember]")?.checked);
      runtime.state.profile = remember ? sanitizeProfile(runtime.profile, true) : null;
      applyProfileToSession(runtime); writeState(runtime); render(runtime, true);
      showToast(runtime, quality?.ok ? (remember ? "Đã xác minh và lưu hồ sơ trên thiết bị." : "Đã xác minh hồ sơ cho phiên; không lưu lâu dài.") : "Đã áp dụng; Accuracy Laboratory còn cảnh báo cần xử lý.", quality?.ok ? "success" : "warning"); return;
    }
    if (event.target.closest("[data-fortune-profile-clear]")) {
      runtime.profile = sanitizeProfile(null); runtime.state.profile = null; runtime.session.birthChart = null; runtime.session.birthChartErrors = []; runtime.session.astrologyV4 = null; runtime.session.calculationCertificate = null;
      applyProfileToSession(runtime); writeState(runtime); render(runtime, true); showToast(runtime, "Đã xóa hồ sơ phiên và bản lưu trên thiết bị."); return;
    }
    if (event.target.closest("[data-fortune-journal-enable-lock]")) {
      const pin = runtime.root.querySelector("[data-fortune-journal-pin]")?.value || "";
      if (pin.length < 4) { showToast(runtime, "PIN phải có ít nhất 4 ký tự.", "error"); return; }
      try {
        const secured = await createJournalVault(runtime.journalEntries, pin);
        runtime.journalKey = secured.key; runtime.state.journalVault = secured.vault; runtime.state.journal = []; writeState(runtime); render(runtime, true); showToast(runtime, "Đã mã hóa nhật ký bằng AES-GCM trên thiết bị.");
      } catch (error) { showToast(runtime, error.message, "error"); }
      return;
    }
    if (event.target.closest("[data-fortune-journal-unlock]")) {
      const pin = runtime.root.querySelector("[data-fortune-journal-pin]")?.value || "";
      try {
        const opened = await openJournalVault(runtime.state.journalVault, pin); runtime.journalKey = opened.key; runtime.journalEntries = opened.entries; render(runtime, true); showToast(runtime, "Đã mở khóa nhật ký trong phiên này.");
      } catch (_error) { showToast(runtime, "PIN không đúng hoặc dữ liệu mã hóa bị hỏng.", "error"); }
      return;
    }
    if (event.target.closest("[data-fortune-journal-lock-now]")) { runtime.journalKey = null; runtime.journalEntries = []; render(runtime, true); showToast(runtime, "Đã khóa nhật ký."); return; }
    if (event.target.closest("[data-fortune-vault-upload]")) { try { await syncEncryptedVault(runtime, "upload"); showToast(runtime, "Đã đồng bộ bản mã hóa theo tài khoản."); } catch (error) { showToast(runtime, error.message, "error"); } return; }
    if (event.target.closest("[data-fortune-vault-download]")) { try { await syncEncryptedVault(runtime, "download"); render(runtime, true); showToast(runtime, "Đã khôi phục kho mã hóa; hãy nhập PIN để mở."); } catch (error) { showToast(runtime, error.message, "error"); } return; }
    const journalExport = event.target.closest("[data-fortune-journal-export]");
    if (journalExport) {
      const journal = activeJournal(runtime) || []; const format = journalExport.dataset.fortuneJournalExport;
      if (runtime.state.journalVault && !runtime.journalKey) { showToast(runtime, "Mở khóa nhật ký trước khi xuất.", "error"); return; }
      if (format === "pdf") await exportJournalPdf(journal);
      else if (format === "json") downloadFile(`hh-nhat-ky-${Date.now()}.json`, JSON.stringify({ version: VERSION, exportedAt: new Date().toISOString(), journal }, null, 2), "application/json");
      else downloadFile(`hh-nhat-ky-${Date.now()}.txt`, journal.map((item) => `[${formatDateTime(item.createdAt)}] ${item.tag} · cảm xúc ${item.moodBefore || 3} → ${item.moodAfter || 3}\n${item.text}`).join("\n\n"));
      showToast(runtime, `Đã xuất nhật ký ${format.toUpperCase()}.`); return;
    }
    if (event.target.closest("[data-fortune-reflection-pack]")) { if (runtime.state.journalVault && !runtime.journalKey) { showToast(runtime, "Mở khóa nhật ký trước khi tạo gói đầy đủ.", "error"); return; } await exportReflectionPack(runtime); showToast(runtime, "Đã tạo Reflection Pack ZIP."); return; }
    if (event.target.closest("[data-fortune-undo-delete]") && runtime.deletedRecord) {
      const record = runtime.deletedRecord; runtime.deletedRecord = null;
      if (record.kind === "history") runtime.state.history.splice(record.index, 0, ...record.items);
      if (record.kind === "journal") { runtime.journalEntries.splice(record.index, 0, ...record.items); await persistJournal(runtime); }
      writeState(runtime); render(runtime); showToast(runtime, "Đã hoàn tác xóa."); return;
    }
    if (event.target.closest("[data-fortune-builder-run]")) {
      const outcome = runCombinedSession(runtime);
      if (!outcome.ok) { showToast(runtime, outcome.message, "error"); return; }
      playFortuneTone(runtime); runtime.session.sessionAi = null; await runAutomaticFortuneAi(runtime, "session"); return;
    }
    if (event.target.closest("[data-fortune-builder-reset]")) { runtime.builder = createBuilderState(); render(runtime, true); return; }
    if (event.target.closest("[data-fortune-builder-save]")) {
      if (!runtime.builder.result) return;
      runtime.builder.reflection = runtime.root.querySelector("[data-fortune-builder-reflection]")?.value.trim() || "";
      runtime.builder.moodBefore = clamp(runtime.root.querySelector("[data-fortune-builder-mood-before]")?.value, 1, 5, 3);
      runtime.builder.moodAfter = clamp(runtime.root.querySelector("[data-fortune-builder-mood-after]")?.value, 1, 5, 3);
      addHistory(runtime, "session", runtime.builder.result.title, runtime.builder.result.parts.map((part) => `${part.label}: ${part.text}`).join(" "));
      if (runtime.builder.reflection) {
        runtime.journalEntries = [{ id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: runtime.builder.reflection, tag: "Phiên tổng hợp", createdAt: new Date().toISOString(), moodBefore: runtime.builder.moodBefore, moodAfter: runtime.builder.moodAfter, sessionType: "combined" }, ...runtime.journalEntries].slice(0, MAX_JOURNAL);
        await persistJournal(runtime);
      }
      runtime.builder.step = 7; showToast(runtime, "Đã lưu bản tóm tắt và suy ngẫm."); render(runtime, true); return;
    }
    if (event.target.closest("[data-fortune-astrology-calc]")) {
      const engine = astrologyV4(); const mode = runtime.root.querySelector("[data-fortune-astrology-mode]")?.value || "natal";
      runtime.session.astrologyMode = mode; runtime.session.astrologyTarget = runtime.root.querySelector("[data-fortune-astrology-target]")?.value || localDateKey();
      runtime.session.astrologyAlerts = Boolean(runtime.root.querySelector("[data-fortune-astrology-alerts]")?.checked);
      if (!engine) { showToast(runtime, "Astrology V4 chưa được tải.", "error"); return; }
      const requiresKnownTime = runtime.profile.birthTimeAccuracy !== "unknown";
      if (!runtime.profile.date || (requiresKnownTime && !runtime.profile.time) || !runtime.profile.place || !suiteV4()?.timeZoneSupported?.(runtime.profile.timezoneId)) { showToast(runtime, requiresKnownTime ? "Cần ngày, giờ, địa điểm và timezone IANA hợp lệ trong Hồ sơ phiên." : "Chế độ không biết giờ vẫn cần ngày, địa điểm và timezone IANA hợp lệ.", "error"); return; }
      const astronomy = globalScope.Astronomy;
      const targetUtc = `${runtime.session.astrologyTarget}T12:00:00Z`;
      const secondDate = runtime.root.querySelector("[data-fortune-astro-second-date]")?.value || "";
      const secondTime = runtime.root.querySelector("[data-fortune-astro-second-time]")?.value || "";
      const secondProfile = { date: secondDate, time: secondTime, birthTimeAccuracy: "exact", timezoneId: runtime.root.querySelector("[data-fortune-astro-second-timezone]")?.value || "Asia/Ho_Chi_Minh", latitude: runtime.root.querySelector("[data-fortune-astro-second-latitude]")?.value, longitude: runtime.root.querySelector("[data-fortune-astro-second-longitude]")?.value, place: "Hồ sơ B" };
      const relocation = { place: runtime.root.querySelector("[data-fortune-astrology-place]")?.value || runtime.profile.place, latitude: runtime.root.querySelector("[data-fortune-astrology-latitude]")?.value, longitude: runtime.root.querySelector("[data-fortune-astrology-longitude]")?.value };
      if (["synastry", "composite", "davison"].includes(mode) && (!secondDate || !secondTime)) { showToast(runtime, "Chế độ hai hồ sơ cần đủ ngày và giờ của hồ sơ B.", "error"); return; }
      if (mode === "relocation" && (String(relocation.latitude).trim() === "" || String(relocation.longitude).trim() === "")) { showToast(runtime, "Relocation cần vĩ độ và kinh độ đích.", "error"); return; }
      try {
        if (mode === "natal") runtime.session.astrologyV4 = engine.calculateChart(runtime.profile, astronomy);
        else if (mode === "transit") runtime.session.astrologyV4 = engine.transitChart(runtime.profile, targetUtc, astronomy);
        else if (mode === "timeline") runtime.session.astrologyV4 = engine.transitTimeline(runtime.profile, targetUtc, 30, astronomy);
        else if (mode === "method-compare") runtime.session.astrologyV4 = engine.compareChartMethods(runtime.profile, astronomy);
        else if (mode === "birth-time-range") runtime.session.astrologyV4 = engine.birthTimeRange(runtime.profile, [15, 30, 60].includes(Number(runtime.profile.birthTimeUncertaintyMinutes)) ? Number(runtime.profile.birthTimeUncertaintyMinutes) : 15, astronomy);
        else if (mode === "progression") runtime.session.astrologyV4 = engine.progressedChart(runtime.profile, targetUtc, astronomy);
        else if (mode === "solar-return") runtime.session.astrologyV4 = engine.searchReturn(runtime.profile, targetUtc, "Sun", astronomy);
        else if (mode === "lunar-return") runtime.session.astrologyV4 = engine.searchReturn(runtime.profile, targetUtc, "Moon", astronomy);
        else if (mode === "synastry") runtime.session.astrologyV4 = engine.synastry(runtime.profile, secondProfile, astronomy);
        else if (mode === "composite") runtime.session.astrologyV4 = engine.compositeChart(runtime.profile, secondProfile, astronomy);
        else if (mode === "davison") runtime.session.astrologyV4 = engine.davisonChart(runtime.profile, secondProfile, astronomy);
        else if (mode === "relocation") runtime.session.astrologyV4 = engine.relocationChart(runtime.profile, relocation, astronomy);
        else if (mode === "astrocartography") runtime.session.astrologyV4 = engine.astrocartography(runtime.profile, astronomy);
      } catch (error) { runtime.session.astrologyV4 = { ok: false, errors: [`Không thể tính astrology: ${String(error?.message || error).slice(0, 220)}`] }; }
      if (!runtime.session.astrologyV4?.ok) { showToast(runtime, runtime.session.astrologyV4?.errors?.[0] || "Không đủ dữ liệu để tính.", "error"); render(runtime, true); return; }
      runtime.session.astrologyV4 = attachAstrologyResultContract(runtime.session.astrologyV4, runtime.profile, mode, targetUtc); runtime.session.calculationCertificate = accuracyLab()?.createCalculationCertificate?.({ profile: runtime.profile, result: runtime.session.astrologyV4, provenance: runtime.session.astrologyV4.provenance || {} }) || null; runtime.session.chartAi = null; runtime.session.astrologyPlanet = ""; runtime.inspectorOpen = false; playFortuneTone(runtime); showToast(runtime, "Đã tính xong; HH AI đang tự luận giải ngay tại đây."); await runAutomaticFortuneAi(runtime, "chart"); return;
    }
    const astrologyPlanet = event.target.closest("[data-fortune-planet-detail]");
    if (astrologyPlanet) { runtime.session.astrologyPlanet = astrologyPlanet.dataset.fortunePlanetDetail; runtime.inspectorOpen = true; render(runtime, true); globalScope.queueMicrotask?.(() => runtime.root?.querySelector("[data-fortune-inspector-close]")?.focus()); return; }
    const astrologyExport = event.target.closest("[data-fortune-astrology-export]");
    if (astrologyExport) {
      const result = runtime.session.astrologyV4; if (!result?.ok) { showToast(runtime, "Hãy tính bản đồ trước khi xuất.", "error"); return; }
      const format = astrologyExport.dataset.fortuneAstrologyExport;
      if (format === "svg") downloadFile(`hh-astrology-${runtime.session.astrologyMode}-${Date.now()}.svg`, astrologySvg(result, `HH Astrology · ${runtime.session.astrologyMode}`), "image/svg+xml;charset=utf-8");
      else if (format === "png") astrologyPng(runtime, result);
      else if (format === "pdf") await astrologyPdf(runtime, result);
      else downloadFile(`hh-astrology-${runtime.session.astrologyMode}-${Date.now()}.json`, JSON.stringify({ version: VERSION, exportedAt: new Date().toISOString(), result }, null, 2), "application/json");
      showToast(runtime, `Đã xuất ${format.toUpperCase()} kèm provenance.`); return;
    }
    if (event.target.closest("[data-fortune-sky-calc]")) {
      const v4 = suiteV4(); runtime.session.skyDate = runtime.root.querySelector("[data-fortune-sky-date]")?.value || localDateKey();
      runtime.session.sky = v4?.calculateMoonSky?.(runtime.session.skyDate, runtime.profile, globalScope.Astronomy) || { ok: false, errors: ["Moon & Sky engine chưa được tải."] };
      if (!runtime.session.sky.ok) { showToast(runtime, runtime.session.sky.errors?.[0] || "Không thể tính bầu trời.", "error"); render(runtime, true); return; }
      runtime.session.skyAi = null; playFortuneTone(runtime); addHistory(runtime, "sky", `Moon & Sky · ${runtime.session.skyDate}`, `${runtime.session.sky.illuminatedPercent}% chiếu sáng · mọc ${runtime.session.sky.rise || "không có"}`); await runAutomaticFortuneAi(runtime, "sky"); return;
    }
    if (event.target.closest("[data-fortune-eastern-calc]")) {
      const v4 = suiteV4(); runtime.session.easternDate = runtime.root.querySelector("[data-fortune-eastern-date]")?.value || localDateKey();
      runtime.session.eastern = v4?.easternCalendar?.(runtime.session.easternDate, runtime.profile, globalScope.Astronomy) || { ok: false, errors: ["Lịch phương Đông chưa được tải."] };
      if (!runtime.session.eastern.ok) { showToast(runtime, runtime.session.eastern.errors?.[0] || "Không thể tính lịch.", "error"); render(runtime, true); return; }
      runtime.session.easternAi = null; playFortuneTone(runtime); addHistory(runtime, "eastern", `Can Chi ${runtime.session.eastern.yearPillar.stem} ${runtime.session.eastern.yearPillar.branch}`, `${runtime.session.eastern.lunarLabel || "Lịch âm không có nhãn"} · 24 tiết khí`); await runAutomaticFortuneAi(runtime, "eastern"); return;
    }
    if (event.target.closest("[data-fortune-symbol-draw]")) {
      const v4 = suiteV4(); runtime.session.symbolType = runtime.root.querySelector("[data-fortune-symbol-type]")?.value || "lenormand"; runtime.session.symbolCount = clamp(runtime.root.querySelector("[data-fortune-symbol-count]")?.value, 1, runtime.session.symbolType === "lenormand" ? 36 : 24, 3); runtime.session.symbolSeed = runtime.root.querySelector("[data-fortune-symbol-seed]")?.value.trim() || ""; runtime.session.runeAllowReversed = Boolean(runtime.root.querySelector("[data-fortune-rune-reversed]")?.checked);
      runtime.session.symbolDeck = v4?.drawSymbolDeck?.(runtime.session.symbolType, runtime.session.symbolSeed, runtime.session.symbolCount, { allowReversed: runtime.session.runeAllowReversed }) || null; runtime.session.symbolSeed = runtime.session.symbolDeck?.seed || runtime.session.symbolSeed; runtime.session.symbolFocusIndex = 0;
      if (!runtime.session.symbolDeck) { showToast(runtime, "Symbol deck engine chưa được tải.", "error"); render(runtime, true); return; }
      runtime.session.symbolsAi = null; runtime.inspectorOpen = false; playFortuneTone(runtime); addHistory(runtime, "symbols", `${runtime.session.symbolDeck.type} · ${runtime.session.symbolDeck.cards.length} lá`, runtime.session.symbolDeck.cards.map((card) => card.name).join(" · ")); await runAutomaticFortuneAi(runtime, "symbols"); return;
    }
    if (event.target.closest("[data-fortune-academy-next]")) { runtime.session.academyRound = Math.max(1, Number(runtime.session.academyRound || 1) + 1); runtime.session.academyMode = runtime.root.querySelector("[data-fortune-academy-mode]")?.value || runtime.session.academyMode || "meaning"; runtime.session.tarotQuiz = suiteV4()?.tarotQuiz?.(`academy-${runtime.session.academyRound}`, { mode: runtime.session.academyMode }) || null; runtime.session.academyFeedback = "Hãy tự chọn trước khi mở đáp án."; runtime.session.academyAnswered = false; runtime.session.academyFlashRevealed = false; render(runtime, true); return; }
    const academyAnswer = event.target.closest("[data-fortune-academy-answer]");
    if (academyAnswer) {
      const quiz = runtime.session.tarotQuiz || suiteV4()?.tarotQuiz?.(`academy-${runtime.session.academyRound || 1}`); runtime.session.tarotQuiz = quiz;
      if (!quiz) { showToast(runtime, "Tarot Academy chưa được tải.", "error"); return; }
      if (runtime.session.academyAnswered) return;
      const selected = Number(academyAnswer.dataset.fortuneAcademyAnswer); const correct = selected === quiz.correctIndex; runtime.session.academyFeedback = correct ? `✓ Chính xác: ${quiz.answers[quiz.correctIndex]}. ${quiz.rubric.correct}` : `Chưa đúng. Đáp án sau khi nộp: ${quiz.answers[quiz.correctIndex]}. ${quiz.rubric.review}`; runtime.session.academyAnswered = true; runtime.session.academyHistory = [...(runtime.session.academyHistory || []), { cardId: quiz.card.id, cardName: quiz.card.name, mode: quiz.mode, selected, correct, at: new Date().toISOString() }].slice(-120); render(runtime, true); return;
    }
    const calendarModeButton = event.target.closest("[data-fortune-calendar-mode]");
    if (calendarModeButton) { runtime.calendarMode = calendarModeButton.dataset.fortuneCalendarMode; render(runtime, true); return; }
    const calendarMoveButton = event.target.closest("[data-fortune-calendar-move]");
    if (calendarMoveButton) { moveCalendar(runtime, Number(calendarMoveButton.dataset.fortuneCalendarMove)); render(runtime, true); return; }
    if (event.target.closest("[data-fortune-calendar-today]")) { runtime.calendarAnchor = localDateKey(); render(runtime, true); return; }
    if (event.target.closest("[data-fortune-chart-calc]")) {
      const engine = globalScope.HHFortuneAstrology;
      runtime.session.birthChart = engine?.calculateBirthChart?.(runtime.profile, globalScope.Astronomy) || { ok: false, errors: ["Engine bản đồ sao chưa được tải."] };
      runtime.session.birthChartErrors = runtime.session.birthChart.ok ? [] : (runtime.session.birthChart.errors || ["Không thể tính bản đồ sao."]);
      if (!runtime.session.birthChart.ok) showToast(runtime, runtime.session.birthChartErrors[0], "error"); else playFortuneTone(runtime);
      render(runtime, true); return;
    }
    const chartPlanet = event.target.closest("[data-fortune-chart-planet]");
    if (chartPlanet) { runtime.chartPlanetIndex = Number(chartPlanet.dataset.fortuneChartPlanet) || 0; runtime.inspectorOpen = true; render(runtime, true); globalScope.queueMicrotask?.(() => runtime.root?.querySelector("[data-fortune-inspector-close]")?.focus()); return; }
    const pinCard = event.target.closest("[data-fortune-card-pin]");
    if (pinCard) { const card = runtime.session.tarot[Number(pinCard.dataset.fortuneCardPin)]; if (card) card.pinned = !card.pinned; render(runtime, true); return; }
    const moveCard = event.target.closest("[data-fortune-card-move]");
    if (moveCard) {
      const [rawIndex, rawDirection] = String(moveCard.dataset.fortuneCardMove).split(":"); const index = Number(rawIndex); const next = index + Number(rawDirection);
      if (runtime.session.tarot[index] && runtime.session.tarot[next]) [runtime.session.tarot[index], runtime.session.tarot[next]] = [runtime.session.tarot[next], runtime.session.tarot[index]];
      render(runtime, true); return;
    }
    if (event.target.closest("[data-fortune-about]")) {
      runtime.state.view = "today"; writeState(runtime); render(runtime, true);
      requestAnimationFrame(() => runtime.root.querySelector(".fortune-safety-card")?.scrollIntoView({ behavior: "smooth", block: "center" })); return;
    }
    if (event.target.closest("[data-fortune-daily-save]")) {
      const daily = dailyReading(runtime.ownerId); addHistory(runtime, "daily", daily.title, daily.message); showToast(runtime, "Đã lưu lời nhắc hôm nay."); return;
    }
    const directCopy = event.target.closest("[data-fortune-copy]");
    if (directCopy) { try { await copyText(directCopy.dataset.fortuneCopy); showToast(runtime, "Đã sao chép."); } catch (_error) { showToast(runtime, "Trình duyệt không cho phép sao chép.", "error"); } return; }
    if (event.target.closest("[data-fortune-quick-draw]")) {
      runtime.session.question = runtime.root.querySelector("[data-fortune-quick-question]")?.value.trim() || "";
      runtime.session.tarotCount = 3; runtime.session.tarotSeed = ""; runtime.session.tarotAllowReversed = true;
      const v4 = suiteV4(); runtime.session.tarot78 = v4?.drawTarot78?.("", { count: 3, allowReversed: true }) || null; runtime.session.tarotSeed = runtime.session.tarot78?.seed || `${Date.now()}`; runtime.session.tarot = runtime.session.tarot78 ? tarotCardsForView(runtime.session.tarot78) : drawTarot(runtime.session.tarotSeed, 3); runtime.session.tarotRevealed = new Set(); runtime.session.tarotFocusIndex = 0;
      addHistory(runtime, "tarot", "Trải bài 3 lá", runtime.session.tarot.map((card) => `${card.position}: ${card.name}`).join(" · "));
      runtime.session.tarotAi = null; runtime.state.view = "tarot"; writeState(runtime); await runAutomaticFortuneAi(runtime, "tarot"); return;
    }
    if (event.target.closest("[data-fortune-draw]")) {
      runtime.session.question = runtime.root.querySelector("[data-fortune-tarot-question]")?.value.trim() || "";
      runtime.session.tarotCount = Number(runtime.root.querySelector("[data-fortune-tarot-count]")?.value) || 3;
      runtime.session.tarotPrevious = runtime.session.tarot?.length ? runtime.session.tarot.map((card) => ({ ...card })) : runtime.session.tarotPrevious;
      runtime.session.tarotSeed = runtime.root.querySelector("[data-fortune-tarot-seed]")?.value.trim() || ""; runtime.session.tarotAllowReversed = Boolean(runtime.root.querySelector("[data-fortune-tarot-reversed]")?.checked); runtime.session.tarotPositionsText = runtime.root.querySelector("[data-fortune-tarot-positions]")?.value.trim() || ""; const customPositions = runtime.session.tarotPositionsText.split(/\r?\n|;/).map((item) => item.trim()).filter(Boolean);
      const v4 = suiteV4();
      runtime.session.tarot78 = v4?.drawTarot78?.(runtime.session.tarotSeed, { count: runtime.session.tarotCount, allowReversed: runtime.session.tarotAllowReversed, positions: customPositions.length >= runtime.session.tarotCount ? customPositions : undefined }) || null; runtime.session.tarotSeed = runtime.session.tarot78?.seed || runtime.session.tarotSeed;
      runtime.session.tarot = runtime.session.tarot78 ? tarotCardsForView(runtime.session.tarot78) : drawTarot(runtime.session.tarotSeed, runtime.session.tarotCount); runtime.session.tarotRevealed = new Set(); runtime.session.tarotFocusIndex = 0;
      addHistory(runtime, "tarot", `Trải bài ${runtime.session.tarotCount} lá`, runtime.session.tarot.map((card) => `${card.position}: ${card.name}`).join(" · "));
      runtime.session.tarotAi = null; runtime.inspectorOpen = false; playFortuneTone(runtime); await runAutomaticFortuneAi(runtime, "tarot"); return;
    }
    if (event.target.closest("[data-fortune-zodiac-calc]")) {
      const value = runtime.root.querySelector("[data-fortune-zodiac-date]")?.value || "";
      runtime.session.zodiacDate = value; runtime.session.western = suiteV4()?.calculateSolarZodiac?.(value, { ...runtime.profile, date: value }, globalScope.Astronomy) || null; runtime.session.lastZodiacResult = "western";
      if (!runtime.session.western?.ok) { showToast(runtime, runtime.session.western?.errors?.[0] || "Hãy nhập ngày sinh hợp lệ và tải Astronomy Engine.", "error"); return; }
      runtime.session.zodiacAi = null; addHistory(runtime, "zodiac", runtime.session.western.sign.name, `Mặt Trời ${runtime.session.western.sign.longitude}° · ${runtime.session.western.nearBoundary ? "gần ranh giới" : "không gần ranh giới"}.`); await runAutomaticFortuneAi(runtime, "zodiac"); return;
    }
    if (event.target.closest("[data-fortune-chinese-calc]")) {
      runtime.session.chineseDate = runtime.root.querySelector("[data-fortune-chinese-date]")?.value || runtime.session.zodiacDate || runtime.profile.date; runtime.session.chineseBoundary = runtime.root.querySelector("[data-fortune-chinese-boundary]")?.value || "lunar-new-year";
      runtime.session.chinese = suiteV4()?.calculateChineseZodiac?.(runtime.session.chineseDate, runtime.profile, runtime.session.chineseBoundary, globalScope.Astronomy) || null;
      if (!runtime.session.chinese?.ok) { showToast(runtime, runtime.session.chinese?.errors?.[0] || "Không thể tính mốc đổi năm.", "error"); return; }
      const contractBase = { ...runtime.session.chinese, resultContract: undefined }; runtime.session.chinese = suiteV4()?.attachResultContract?.(contractBase, { methodId: "eastern-calendar-foundation", profile: runtime.profile, input: { date: runtime.session.chineseDate, boundary: runtime.session.chineseBoundary }, calculatedFacts: [{ factId: "chinese-zodiac.cycle-year", type: "calendar-boundary", label: "Năm chu kỳ", value: runtime.session.chinese.cycleYear, sourceId: runtime.session.chineseBoundary === "lichun" ? "astronomy-engine" : "iana-tzdb" }], symbolicInterpretations: [{ interpretationId: "chinese-zodiac.label", label: `${runtime.session.chinese.animal} · ${runtime.session.chinese.pillar.stem} ${runtime.session.chinese.pillar.branch}`, text: "Tên con giáp là lớp biểu tượng, không phải phép đo tính cách." }] }) || runtime.session.chinese; runtime.session.lastZodiacResult = "chinese";
      runtime.session.zodiacAi = null; addHistory(runtime, "chinese", `${runtime.session.chinese.animal} · ${runtime.session.chinese.branch}`, `${runtime.session.chinese.yinYang} ${runtime.session.chinese.element} · mốc ${runtime.session.chinese.boundaryLabel}.`); await runAutomaticFortuneAi(runtime, "zodiac"); return;
    }
    if (event.target.closest("[data-fortune-numerology-calc]")) {
      runtime.session.birthDate = runtime.root.querySelector("[data-fortune-numerology-date]")?.value || "";
      runtime.session.targetDate = runtime.root.querySelector("[data-fortune-cycle-date]")?.value || localDateKey();
      runtime.session.nameInput = runtime.root.querySelector("[data-fortune-name]")?.value.trim() || runtime.session.nameInput || "";
      runtime.session.nameSystem = runtime.root.querySelector("[data-fortune-name-system]")?.value === "chaldean" ? "chaldean" : "pythagorean";
      const v4 = suiteV4(); runtime.session.numerologyV4 = v4?.advancedNumerology?.(runtime.session.birthDate, runtime.session.nameInput, runtime.session.nameSystem, runtime.session.targetDate) || null;
      runtime.session.numerology = calculateNumerology(runtime.session.birthDate);
      if (!runtime.session.numerology) { showToast(runtime, "Hãy nhập ngày sinh hợp lệ.", "error"); return; }
      runtime.session.cycles = calculatePersonalCycles(runtime.session.birthDate, runtime.session.targetDate);
      if (!runtime.session.cycles) { showToast(runtime, "Ngày xem chu kỳ chưa hợp lệ.", "error"); return; }
      runtime.session.numerologyAi = null; runtime.session.numerologyFocusIndex = null; runtime.inspectorOpen = false; addHistory(runtime, "numerology", `Đường đời ${runtime.session.numerology.lifePath}`, `Ngày sinh rút gọn ${runtime.session.numerology.birthDay} · thái độ ${runtime.session.numerology.attitude} · chu kỳ ${runtime.session.cycles.personalYear}/${runtime.session.cycles.personalMonth}/${runtime.session.cycles.personalDay}.`); await runAutomaticFortuneAi(runtime, "numerology"); return;
    }
    if (event.target.closest("[data-fortune-name-calc]")) {
      runtime.session.nameInput = runtime.root.querySelector("[data-fortune-name]")?.value.trim() || "";
      runtime.session.nameSystem = runtime.root.querySelector("[data-fortune-name-system]")?.value === "chaldean" ? "chaldean" : "pythagorean";
      runtime.session.nameNumerology = calculateNameNumerology(runtime.session.nameInput, runtime.session.nameSystem);
      if (!runtime.session.nameNumerology) { showToast(runtime, "Hãy nhập tên có ít nhất 2 chữ cái.", "error"); return; }
      runtime.session.numerologyV4 = suiteV4()?.advancedNumerology?.(runtime.session.birthDate || runtime.profile.date, runtime.session.nameInput, runtime.session.nameSystem, runtime.session.targetDate) || runtime.session.numerologyV4;
      render(runtime, true); return;
    }
    if (event.target.closest("[data-fortune-iching-cast]")) {
      runtime.session.ichingQuestion = runtime.root.querySelector("[data-fortune-iching-question]")?.value.trim() || "";
      runtime.session.ichingSeed = runtime.root.querySelector("[data-fortune-iching-seed]")?.value.trim() || `${Date.now()}-${Math.random()}`;
      runtime.session.ichingMode = runtime.root.querySelector("[data-fortune-iching-mode]")?.value || "coins";
      runtime.session.ichingManual = [...runtime.root.querySelectorAll("[data-fortune-iching-manual]")].map((input) => Number(input.value));
      const v4 = suiteV4(); runtime.session.ichingAdvanced = v4?.castIChingAdvanced?.(runtime.session.ichingSeed, { mode: runtime.session.ichingMode, manual: runtime.session.ichingManual }) || null;
      runtime.session.iching = runtime.session.ichingAdvanced?.ok ? ichingForView(runtime.session.ichingAdvanced) : castIChing(runtime.session.ichingSeed);
      if (runtime.session.ichingAdvanced && !runtime.session.ichingAdvanced.ok) { showToast(runtime, runtime.session.ichingAdvanced.errors?.[0] || "Dữ liệu gieo không hợp lệ.", "error"); return; }
      runtime.session.ichingAi = null; runtime.session.ichingLineIndex = null; runtime.inspectorOpen = false; playFortuneTone(runtime); addHistory(runtime, "iching", runtime.session.iching.title, `${runtime.session.iching.nuclearTitle} · ${runtime.session.iching.changedTitle} · hào động ${runtime.session.iching.changing.join(", ") || "không có"}.`); await runAutomaticFortuneAi(runtime, "iching"); return;
    }
    if (event.target.closest("[data-fortune-tuvi-calc]")) {
      runtime.session.tuviDate = runtime.root.querySelector("[data-fortune-tuvi-date]")?.value || ""; runtime.session.tuviTime = runtime.root.querySelector("[data-fortune-tuvi-time]")?.value || ""; runtime.session.tuviGender = runtime.root.querySelector("[data-fortune-tuvi-gender]")?.value === "female" ? "female" : "male"; runtime.session.tuviFixLeap = Boolean(runtime.root.querySelector("[data-fortune-tuvi-fix-leap]")?.checked);
      runtime.session.tuvi = extendedTools()?.calculateZiWei?.({ date: runtime.session.tuviDate, time: runtime.session.tuviTime, gender: runtime.session.tuviGender, fixLeap: runtime.session.tuviFixLeap }) || { ok: false, errors: ["Engine Tử Vi chưa được tải."] };
      if (!runtime.session.tuvi.ok) { showToast(runtime, runtime.session.tuvi.errors?.[0] || "Không thể lập lá số.", "error"); render(runtime, true); return; }
      runtime.session.tuviPalaceIndex = Math.max(0, runtime.session.tuvi.palaces.findIndex((palace)=>palace.isOriginalPalace)); runtime.session.tuviAi = null; runtime.inspectorOpen = false; playFortuneTone(runtime); addHistory(runtime, "tuvi", `Tử Vi · ${runtime.session.tuvi.fiveElementsClass}`, `${runtime.session.tuvi.palaces.length} cung · Mệnh chủ ${runtime.session.tuvi.soul} · Thân chủ ${runtime.session.tuvi.body}.`); await runAutomaticFortuneAi(runtime, "tuvi"); return;
    }
    if (event.target.closest("[data-fortune-physio-calc]")) {
      runtime.session.physiognomyValues = Object.fromEntries([...runtime.root.querySelectorAll("[data-fortune-physio-field]")].map((input)=>[input.dataset.fortunePhysioField,input.value])); runtime.session.physiognomyResult = extendedTools()?.createPhysiognomyReflection?.(runtime.session.physiognomyValues) || null;
      if (!runtime.session.physiognomyResult?.ok) { showToast(runtime, "Không thể tạo bản tự quan sát.", "error"); return; }
      runtime.session.physiognomyAi = null; playFortuneTone(runtime); await runAutomaticFortuneAi(runtime, "physiognomy"); return;
    }
    if (event.target.closest("[data-fortune-dream-calc]")) {
      runtime.session.dreamText = runtime.root.querySelector("[data-fortune-dream-text]")?.value.trim() || ""; runtime.session.dreamEmotion = runtime.root.querySelector("[data-fortune-dream-emotion]")?.value || "curious"; runtime.session.dreamResult = extendedTools()?.analyzeDream?.(runtime.session.dreamText, runtime.session.dreamEmotion) || null;
      if (!runtime.session.dreamResult?.ok) { showToast(runtime, runtime.session.dreamResult?.errors?.[0] || "Không thể phân tích giấc mơ.", "error"); return; }
      runtime.session.dreamsAi = null; playFortuneTone(runtime); await runAutomaticFortuneAi(runtime, "dreams"); return;
    }
    if (event.target.closest("[data-fortune-moon-today]")) {
      runtime.session.moonDate = localDateKey(); runtime.session.moon = calculateMoonPhase(runtime.session.moonDate); runtime.session.moonAstronomy = suiteV4()?.calculateMoonSky?.(runtime.session.moonDate, runtime.profile, globalScope.Astronomy) || null; runtime.session.moonAi = null; await runAutomaticFortuneAi(runtime, "moon"); return;
    }
    if (event.target.closest("[data-fortune-moon-calc]")) {
      runtime.session.moonDate = runtime.root.querySelector("[data-fortune-moon-date]")?.value || "";
      runtime.session.moon = calculateMoonPhase(runtime.session.moonDate); runtime.session.moonAstronomy = suiteV4()?.calculateMoonSky?.(runtime.session.moonDate, runtime.profile, globalScope.Astronomy) || null;
      if (!runtime.session.moon) { showToast(runtime, "Hãy chọn ngày hợp lệ.", "error"); return; }
      runtime.session.moonAi = null; await runAutomaticFortuneAi(runtime, "moon"); return;
    }
    if (event.target.closest("[data-fortune-compare]")) {
      runtime.session.compareA = runtime.root.querySelector("[data-fortune-compare-a]")?.value || "";
      runtime.session.compareB = runtime.root.querySelector("[data-fortune-compare-b]")?.value || "";
      runtime.session.compareBeforeA = Boolean(runtime.root.querySelector("[data-fortune-compare-before-a]")?.checked);
      runtime.session.compareBeforeB = Boolean(runtime.root.querySelector("[data-fortune-compare-before-b]")?.checked);
      runtime.session.compareContext = runtime.root.querySelector("[data-fortune-compare-context]")?.value || "relationship";
      runtime.session.compareGoal = runtime.root.querySelector("[data-fortune-compare-goal]")?.value.trim().slice(0,180) || "trao đổi rõ một vấn đề";
      runtime.session.compareCadence = runtime.root.querySelector("[data-fortune-compare-cadence]")?.value || "weekly";
      runtime.session.compatibility = compareSymbolicProfiles(runtime.session.compareA, runtime.session.compareB, { beforeTetA: runtime.session.compareBeforeA, beforeTetB: runtime.session.compareBeforeB, context: runtime.session.compareContext });
      if (!runtime.session.compatibility) { showToast(runtime, "Hãy nhập đủ hai ngày sinh hợp lệ.", "error"); return; }
      runtime.session.compatibilityAi = null; await runAutomaticFortuneAi(runtime, "compatibility"); return;
    }
    if (event.target.closest("[data-fortune-save-current]")) { if (saveCurrent(runtime)) showToast(runtime, "Đã lưu kết quả."); return; }
    const exportButton = event.target.closest("[data-fortune-export]");
    if (exportButton) {
      const format = exportButton.dataset.fortuneExport; const text = currentResultText(runtime);
      if (format === "png") await exportResultPng(runtime);
      else if (format === "json") downloadFile(`hh-xem-boi-${Date.now()}.json`, JSON.stringify({ version: VERSION, exportedAt: new Date().toISOString(), result: text, disclaimer: "Giải trí và tự chiêm nghiệm" }, null, 2), "application/json");
      else downloadFile(`hh-xem-boi-${Date.now()}.txt`, `${text}\n\nNội dung giải trí và tự chiêm nghiệm.`);
      showToast(runtime, `Đã chuẩn bị file ${format.toUpperCase()}.`); return;
    }
    if (event.target.closest("[data-fortune-copy-result]")) { try { await copyText(currentResultText(runtime)); showToast(runtime, "Đã sao chép kết quả."); } catch (_error) { showToast(runtime, "Không thể sao chép.", "error"); } return; }
    if (event.target.closest("[data-fortune-share]")) {
      const text = currentResultText(runtime);
      try { if (globalScope.navigator?.share) await globalScope.navigator.share({ title: "HH Xem bói", text }); else await copyText(text); showToast(runtime, globalScope.navigator?.share ? "Đã mở bảng chia sẻ." : "Đã sao chép để chia sẻ."); } catch (_error) { /* User cancellation is not an error. */ }
      return;
    }
    const deleteJournal = event.target.closest("[data-fortune-journal-delete]");
    if (deleteJournal) { const index = runtime.journalEntries.findIndex((item) => item.id === deleteJournal.dataset.fortuneJournalDelete); if (index > -1) runtime.deletedRecord = { kind: "journal", label: "ghi chú", index, items: runtime.journalEntries.splice(index, 1) }; await persistJournal(runtime); render(runtime); return; }
    const deleteHistory = event.target.closest("[data-fortune-history-delete]");
    if (deleteHistory) { const index = runtime.state.history.findIndex((item) => item.id === deleteHistory.dataset.fortuneHistoryDelete); if (index > -1) runtime.deletedRecord = { kind: "history", label: "kết quả", index, items: runtime.state.history.splice(index, 1) }; writeState(runtime); render(runtime); return; }
    if (event.target.closest("[data-fortune-clear-journal]")) { if (globalScope.confirm?.("Xóa toàn bộ nhật ký trên thiết bị này?")) { runtime.deletedRecord = { kind: "journal", label: "toàn bộ nhật ký", index: 0, items: [...runtime.journalEntries] }; runtime.journalEntries = []; await persistJournal(runtime); render(runtime); } return; }
    if (event.target.closest("[data-fortune-clear-history]")) { if (globalScope.confirm?.("Xóa toàn bộ lịch sử kết quả?")) { runtime.deletedRecord = { kind: "history", label: "toàn bộ lịch sử", index: 0, items: [...runtime.state.history] }; runtime.state.history = []; writeState(runtime); render(runtime); } return; }
    const exportHistory = event.target.closest("[data-fortune-export-history]");
    if (exportHistory) {
      const format = exportHistory.dataset.fortuneExportHistory;
      const content = format === "json" ? JSON.stringify({ version: VERSION, exportedAt: new Date().toISOString(), history: runtime.state.history }, null, 2) : runtime.state.history.map((item) => `[${formatDateTime(item.createdAt)}] ${item.title}\n${item.summary}`).join("\n\n");
      downloadFile(`hh-xem-boi-lich-su.${format}`, content, format === "json" ? "application/json" : "text/plain;charset=utf-8"); return;
    }
  }

  async function handleSubmit(runtime, event) {
    if (!event.target.matches("[data-fortune-journal-form]")) return;
    event.preventDefault();
    const text = event.target.querySelector("[data-fortune-journal-text]")?.value.trim() || "";
    const tag = event.target.querySelector("[data-fortune-journal-tag]")?.value || "Suy ngẫm";
    const moodBefore = clamp(event.target.querySelector("[data-fortune-journal-mood-before]")?.value, 1, 5, 3);
    const moodAfter = clamp(event.target.querySelector("[data-fortune-journal-mood-after]")?.value, 1, 5, 3);
    if (!text) { showToast(runtime, "Hãy viết nội dung trước khi lưu.", "error"); return; }
    if (runtime.state.journalVault && !runtime.journalKey) { showToast(runtime, "Nhật ký đang khóa; hãy mở khóa trước khi ghi.", "error"); return; }
    runtime.journalEntries = [{ id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text, tag, createdAt: new Date().toISOString(), moodBefore, moodAfter, sessionType: "manual" }, ...runtime.journalEntries].slice(0, MAX_JOURNAL);
    await persistJournal(runtime); render(runtime, true); showToast(runtime, "Đã lưu ghi chú trên thiết bị.");
  }

  function filterHistoryDom(runtime) {
    const query = String(runtime.historyQuery || "").trim().toLocaleLowerCase("vi");
    const type = runtime.historyType || "all";
    let visible = 0;
    runtime.root?.querySelectorAll("[data-fortune-history-item]").forEach((item) => {
      const matches = (!query || String(item.dataset.historySearch || "").includes(query)) && (type === "all" || item.dataset.historyType === type);
      item.hidden = !matches; if (matches) visible += 1;
    });
    const empty = runtime.root?.querySelector("[data-fortune-history-empty]");
    if (empty) empty.hidden = visible > 0;
  }

  function filterJournalDom(runtime) {
    const query = String(runtime.journalQuery || "").trim().toLocaleLowerCase("vi"); const tag = runtime.journalTag || "all"; let visible = 0;
    runtime.root?.querySelectorAll("[data-fortune-journal-item]").forEach((item) => { const matches = (!query || String(item.dataset.journalSearch || "").includes(query)) && (tag === "all" || item.dataset.journalTag === tag); item.hidden = !matches; if (matches) visible += 1; });
    const empty = runtime.root?.querySelector("[data-fortune-journal-empty]"); if (empty) empty.hidden = visible > 0;
  }

  function filterObservatoryTools(runtime, value, source) {
    const query = String(value || "").trim().toLocaleLowerCase("vi"); const family = runtime.libraryFilter || "all"; let navVisible = 0; const matchingCards = [];
    runtime.root?.querySelectorAll("[data-fortune-tool-search]").forEach((input) => { if (input !== source) input.value = value; });
    runtime.root?.querySelectorAll("[data-fortune-tool-row]").forEach((row) => { const match = !query || String(row.dataset.toolSearch || "").includes(query); row.hidden = !match; if (match) navVisible += 1; });
    runtime.root?.querySelectorAll("[data-fortune-nav-group]").forEach((group) => { const hasMatch = Boolean(group.querySelector("[data-fortune-tool-row]:not([hidden])")); group.hidden = !hasMatch; if (query) group.open = hasMatch; else if (source) group.open = group.dataset.fortuneActiveGroup === "true"; });
    runtime.root?.querySelectorAll("[data-fortune-tool-card]").forEach((card) => { const queryMatch = !query || String(card.dataset.toolSearch || "").includes(query); const familyMatch = family === "all" || card.dataset.toolFamily === family; if (queryMatch && familyMatch) matchingCards.push(card); else card.hidden = true; });
    const pageSize = globalScope.matchMedia?.("(max-width: 700px)")?.matches ? 5 : globalScope.matchMedia?.("(max-width: 1500px)")?.matches ? 9 : 12;
    const pageCount = Math.max(1, Math.ceil(matchingCards.length / pageSize)); runtime.libraryPage = clamp(runtime.libraryPage, 0, pageCount - 1, 0);
    const pageStart = runtime.libraryPage * pageSize; matchingCards.forEach((card, index) => { card.hidden = index < pageStart || index >= pageStart + pageSize; });
    const navEmpty = runtime.root?.querySelector("[data-fortune-nav-empty]"); if (navEmpty) navEmpty.hidden = navVisible > 0;
    const libraryEmpty = runtime.root?.querySelector("[data-fortune-library-empty]"); if (libraryEmpty) libraryEmpty.hidden = matchingCards.length > 0;
    const libraryCount = runtime.root?.querySelector("[data-fortune-library-count]"); if (libraryCount) libraryCount.textContent = String(matchingCards.length);
    const pager = runtime.root?.querySelector(".fortune-library-pager"); if (pager) pager.hidden = matchingCards.length === 0 || pageCount <= 1;
    const previous = pager?.querySelector('[data-fortune-library-page="-1"]'); if (previous) previous.disabled = runtime.libraryPage <= 0;
    const next = pager?.querySelector('[data-fortune-library-page="1"]'); if (next) next.disabled = runtime.libraryPage >= pageCount - 1;
    const range = runtime.root?.querySelector("[data-fortune-library-range]"); if (range) range.textContent = matchingCards.length ? `Trang ${runtime.libraryPage + 1}/${pageCount} · ${pageStart + 1}–${Math.min(pageStart + pageSize, matchingCards.length)} trong ${matchingCards.length}` : "Không có kết quả";
  }

  function syncHomePanelDom(runtime, requestedPanel) {
    const panel = ["overview", "library", "reflection"].includes(requestedPanel) ? requestedPanel : "overview";
    runtime.homePanel = panel;
    runtime.root?.querySelectorAll("[data-fortune-home-panel]").forEach((button) => {
      const active = button.dataset.fortuneHomePanel === panel;
      button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active));
    });
    runtime.root?.querySelectorAll("[data-fortune-home-panel-content]").forEach((content) => { content.hidden = content.dataset.fortuneHomePanelContent !== panel; });
  }

  function handleInput(runtime, event) {
    if (event.target.matches("[data-fortune-tool-search]")) { runtime.toolQuery = event.target.value.slice(0, 80); runtime.libraryPage = 0; if (runtime.state.view === "today" && runtime.toolQuery.trim()) syncHomePanelDom(runtime, "library"); filterObservatoryTools(runtime, runtime.toolQuery, event.target); return; }
    if (event.target.matches("[data-fortune-reflection-draft]")) { runtime.reflectionDraft = event.target.value.slice(0, 3000); return; }
    if (event.target.matches("[data-fortune-theme]")) {
      runtime.state.settings.theme = THEMES.includes(event.target.value) ? event.target.value : "cosmic-oracle";
      runtime.root.dataset.theme = runtime.state.settings.theme; writeState(runtime); syncMysticScene(runtime); return;
    }
    if (event.target.matches("[data-fortune-motion]")) {
      runtime.state.settings.motion = MOTION_LEVELS.includes(event.target.value) ? event.target.value : "balanced"; writeState(runtime); syncMysticScene(runtime); return;
    }
    const tuner = [["[data-fortune-density]", "particleDensity", "[data-fortune-density-value]"], ["[data-fortune-glow]", "glow", "[data-fortune-glow-value]"], ["[data-fortune-glass]", "glass", "[data-fortune-glass-value]"]].find(([selector]) => event.target.matches(selector));
    if (tuner) {
      const [, key, outputSelector] = tuner; const minimum = key === "glass" ? 20 : 0; runtime.state.settings[key] = clamp(event.target.value, minimum, 100, runtime.state.settings[key]); const output = runtime.root.querySelector(outputSelector); if (output) output.textContent = `${runtime.state.settings[key]}%`; writeState(runtime); syncMysticScene(runtime); return;
    }
    if (event.target.matches("[data-fortune-experience]")) {
      runtime.state.settings.experience = event.target.value === "advanced" ? "advanced" : "beginner";
      writeState(runtime); render(runtime, true); return;
    }
    if (event.target.matches("[data-fortune-profile-city]")) {
      const city = PROFILE_CITIES[event.target.value];
      if (city) {
        const set = (selector, value) => { const input = runtime.root.querySelector(selector); if (input) input.value = value; };
        set("[data-fortune-profile-place]", city.label); set("[data-fortune-profile-timezone-id]", city.timezoneId); set("[data-fortune-profile-timezone]", city.timezone); set("[data-fortune-profile-latitude]", city.latitude); set("[data-fortune-profile-longitude]", city.longitude); set("[data-fortune-profile-elevation]", city.elevation);
      }
      return;
    }
    if (event.target.matches("[data-fortune-card-position]")) { const card = runtime.session.tarot[Number(event.target.dataset.fortuneCardPosition)]; if (card) card.position = event.target.value.slice(0, 60); return; }
    if (event.target.matches("[data-fortune-card-note]")) { const card = runtime.session.tarot[Number(event.target.dataset.fortuneCardNote)]; if (card) card.note = event.target.value.slice(0, 500); return; }
    if (event.target.matches("[data-fortune-copilot-input]")) { runtime.session.copilotInput = event.target.value.slice(0, 12000); const length = runtime.root.querySelector("[data-fortune-copilot-length]"); if (length) length.textContent = `${runtime.session.copilotInput.length} / 12000`; return; }
    if (event.target.matches("[data-fortune-copilot-mode]")) { runtime.session.copilotMode = ["easy", "deep", "compare", "consensus", "journal", "action", "audit"].includes(event.target.value) ? event.target.value : "easy"; return; }
    if (event.target.matches("[data-fortune-copilot-depth]")) { runtime.session.copilotDepth = event.target.value === "expert" ? "expert" : "detailed"; return; }
    if (event.target.matches("[data-fortune-method-search]")) {
      runtime.methodQuery = event.target.value; const query = runtime.methodQuery.trim().toLocaleLowerCase("vi"); let visible = 0;
      runtime.root.querySelectorAll("[data-fortune-method-item]").forEach((item) => { const match = !query || String(item.dataset.methodSearch || "").includes(query); item.hidden = !match; if (match) visible += 1; });
      const empty = runtime.root.querySelector("[data-fortune-method-empty]"); if (empty) empty.hidden = visible > 0; return;
    }
    if (event.target.matches("[data-fortune-journal-text]")) {
      const counter = runtime.root.querySelector("[data-fortune-journal-count]");
      if (counter) counter.textContent = `${event.target.value.length} / 4000 ký tự`;
      return;
    }
    if (event.target.matches("[data-fortune-journal-search]")) { runtime.journalQuery = event.target.value; filterJournalDom(runtime); return; }
    if (event.target.matches("[data-fortune-journal-filter]")) { runtime.journalTag = event.target.value; filterJournalDom(runtime); return; }
    if (event.target.matches("[data-fortune-history-search]")) { runtime.historyQuery = event.target.value; filterHistoryDom(runtime); return; }
    if (event.target.matches("[data-fortune-history-type]")) { runtime.historyType = event.target.value; filterHistoryDom(runtime); }
  }

  function handleDragStart(runtime, event) {
    const card = event.target.closest("[data-fortune-card-index]"); if (!card || !event.dataTransfer) return;
    runtime.dragCardIndex = Number(card.dataset.fortuneCardIndex); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(runtime.dragCardIndex)); card.classList.add("is-dragging");
  }
  function handleKeydown(runtime, event) {
    if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === "k") { event.preventDefault(); const search = runtime.root?.querySelector(".fortune-global-search [data-fortune-tool-search]"); search?.focus(); search?.select?.(); return; }
    if (event.key === "Escape") {
      const exportMenu = runtime.root?.querySelector(".fortune-action-export[open]"); if (exportMenu) { exportMenu.removeAttribute("open"); return; }
      if (runtime.inspectorOpen) { runtime.inspectorOpen = false; runtime.root?.classList.remove("is-inspector-open"); const trigger = runtime.root?.querySelector("[data-fortune-inspector-toggle]"); trigger?.setAttribute("aria-expanded", "false"); trigger?.focus(); return; }
      if (runtime.root?.classList.contains("is-nav-open")) { runtime.root.classList.remove("is-nav-open"); runtime.root.querySelector("[data-fortune-nav-toggle]")?.focus(); return; }
    }
    if (!['Enter', ' '].includes(event.key)) return;
    const target = event.target.closest?.("[data-fortune-number-focus],[data-fortune-iching-line]"); if (!target) return;
    event.preventDefault(); target.click();
  }
  function handleDragOver(_runtime, event) { if (event.target.closest("[data-fortune-card-index]")) { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = "move"; } }
  function handleDrop(runtime, event) {
    const target = event.target.closest("[data-fortune-card-index]"); if (!target) return; event.preventDefault();
    const sourceIndex = Number(event.dataTransfer?.getData("text/plain") || runtime.dragCardIndex); const targetIndex = Number(target.dataset.fortuneCardIndex);
    if (Number.isInteger(sourceIndex) && Number.isInteger(targetIndex) && runtime.session.tarot[sourceIndex] && runtime.session.tarot[targetIndex] && sourceIndex !== targetIndex) {
      const [card] = runtime.session.tarot.splice(sourceIndex, 1); runtime.session.tarot.splice(targetIndex, 0, card); render(runtime, true);
    }
    runtime.dragCardIndex = -1;
  }

  function mount(target, options = {}) {
    if (!target) return false;
    unmount();
    const runtime = {
      target, options, ownerId: resolveOwnerId(options), storage: options.storage || globalScope.localStorage,
      state: null, profile: null, builder: createBuilderState(), journalEntries: [], journalKey: null,
       session: { tarot: [], tarotPrevious: [], tarotRevealed: new Set(), tarotFocusIndex: 0, tarotCount: 3, tarotSeed: "", tarot78: null, tarotAi: null, question: "", western: null, zodiacDate: "", zodiacAi: null, chinese: null, chineseYear: "", chineseBeforeTet: false, numerology: null, numerologyV4: null, numerologyAi: null, cycles: null, birthDate: "", targetDate: localDateKey(), nameInput: "", nameSystem: "pythagorean", nameNumerology: null, iching: null, ichingAdvanced: null, ichingAi: null, ichingSeed: "", ichingMode: "coins", ichingManual: [7, 7, 7, 7, 7, 7], ichingQuestion: "", tuvi: null, tuviDate: "", tuviTime: "", tuviGender: "male", tuviFixLeap: true, tuviPalaceIndex: 0, tuviAi: null, physiognomyValues: {}, physiognomyResult: null, physiognomyAi: null, dreamText: "", dreamEmotion: "curious", dreamResult: null, dreamsAi: null, moonDate: localDateKey(), moon: null, moonAstronomy: null, moonAi: null, skyDate: localDateKey(), sky: null, skyAi: null, easternDate: localDateKey(), eastern: null, easternAi: null, symbolType: "lenormand", symbolCount: 3, symbolSeed: "", symbolDeck: null, symbolFocusIndex: 0, symbolsAi: null, calendarSelectedDate: localDateKey(), astrologyMode: "natal", astrologyTarget: localDateKey(), astrologyAlerts: false, astrologyPlanet: "", astrologyV4: null, chartAi: null, calculationCertificate: null, accuracyReport: null, birthChart: null, birthChartErrors: [], compareA: "", compareB: "", compareBeforeA: false, compareBeforeB: false, compareContext: "relationship", compareGoal: "trao đổi rõ một vấn đề", compareCadence: "weekly", compatibility: null, compatibilityAi: null, sessionAi: null, tarotQuiz: null, academyRound: 1, academyFeedback: "", academyAnswered: false, academyHistory: [], academyTrack: "foundation", academyLessonIndex: 0, academyFlashRevealed: false, academyReview: null, copilot: null, copilotInput: "", copilotMode: "easy", copilotDepth: "detailed", copilotSourceView: "" },
      root: null, toastTimer: 0, storageError: false, historyQuery: "", historyType: "all", journalQuery: "", journalTag: "all", methodQuery: "", toolQuery: "", libraryFilter: "all", libraryPage: 0, homePanel: "overview", reflectionDraft: "", resultTab: "overview", flowStep: null, inspectorOpen: false, pendingScrollTarget: null, calendarAnchor: localDateKey(), calendarMode: "month", chartPlanetIndex: 0, copilotBusy: false, aiController: null, aiCache: new Map(), deletedRecord: null, dragCardIndex: -1, ambientNodes: []
    };
    runtime.state = readState(runtime.storage, runtime.ownerId);
    runtime.profile = runtime.state.profile ? sanitizeProfile(runtime.state.profile, true) : sanitizeProfile(null);
    runtime.journalEntries = runtime.state.journalVault ? [] : [...runtime.state.journal];
    applyProfileToSession(runtime);
    if (VIEWS.has(options.view)) runtime.state.view = options.view;
    runtime.onClick = (event) => { handleClick(runtime, event).catch(() => showToast(runtime, "Tác vụ chưa thể hoàn thành.", "error")); };
    runtime.onSubmit = (event) => { handleSubmit(runtime, event).catch(() => showToast(runtime, "Không thể lưu nhật ký.", "error")); };
    runtime.onInput = (event) => handleInput(runtime, event);
    runtime.onChange = (event) => handleInput(runtime, event);
    runtime.onDragStart = (event) => handleDragStart(runtime, event);
    runtime.onDragOver = (event) => handleDragOver(runtime, event);
    runtime.onDrop = (event) => handleDrop(runtime, event);
    runtime.onKeydown = (event) => handleKeydown(runtime, event);
    activeRuntime = runtime;
    render(runtime);
    return true;
  }

  function unmount() {
    if (!activeRuntime) return;
    stopMysticScene(activeRuntime);
    clearTimeout(activeRuntime.toastTimer);
    activeRuntime.aiController?.abort?.();
    activeRuntime.ambientNodes?.forEach((node) => { try { node.stop?.(); node.disconnect?.(); } catch (_error) {} });
    activeRuntime.audioContext?.close?.().catch?.(() => {});
    if (activeRuntime.root) {
      activeRuntime.root.removeEventListener("click", activeRuntime.onClick);
      activeRuntime.root.removeEventListener("submit", activeRuntime.onSubmit);
      activeRuntime.root.removeEventListener("input", activeRuntime.onInput);
      activeRuntime.root.removeEventListener("change", activeRuntime.onChange);
      activeRuntime.root.removeEventListener("dragstart", activeRuntime.onDragStart);
      activeRuntime.root.removeEventListener("dragover", activeRuntime.onDragOver);
      activeRuntime.root.removeEventListener("drop", activeRuntime.onDrop);
      activeRuntime.root.removeEventListener("keydown", activeRuntime.onKeydown);
    }
    if (activeRuntime.target) activeRuntime.target.replaceChildren();
    activeRuntime = null;
  }

  function inspect() {
    return { version: VERSION, mounted: Boolean(activeRuntime), view: activeRuntime?.state?.view || "today", ownerId: activeRuntime?.ownerId || null, historyCount: activeRuntime?.state?.history?.length || 0, journalCount: activeRuntime?.state?.journal?.length || 0 };
  }

  return Object.freeze({ VERSION, STORAGE_SCHEMA, TAROT, WESTERN_ZODIAC, SYNODIC_MONTH_DAYS, METHOD_CATALOG, hashSeed, createRandom, localDateKey, dailyReading, drawTarot, getWesternZodiac, getChineseZodiac, reduceNumerology, calculateNumerology, calculatePersonalCycles, calculateNameNumerology, calculateMoonPhase, compareSymbolicProfiles, castIChing, sanitizeProfile, normalizeState, buildReflectionCalendar, createJournalVault, openJournalVault, storageKey, mount, unmount, inspect });
});
