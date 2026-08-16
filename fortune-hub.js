(function fortuneHubModule(globalScope, factory) {
  "use strict";

  const api = factory(globalScope || {});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope && typeof globalScope === "object") globalScope.HHFortuneHub = api;
})(typeof window !== "undefined" ? window : globalThis, function createFortuneHub(globalScope) {
  "use strict";

  const VERSION = "3.0.0";
  const STORAGE_SCHEMA = "hh.fortune.hub.v1";
  const MAX_HISTORY = 80;
  const MAX_JOURNAL = 120;
  const VIEWS = new Set(["today", "profile", "session", "tarot", "zodiac", "numerology", "iching", "moon", "calendar", "chart", "compatibility", "journal", "copilot", "methods", "history"]);
  const SYNODIC_MONTH_DAYS = 29.530588853;
  const REFERENCE_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14, 0);
  const NUMBER_MEANINGS = Object.freeze({
    1: "khởi xướng và tự chủ", 2: "hợp tác và tinh tế", 3: "biểu đạt và sáng tạo", 4: "cấu trúc và bền bỉ", 5: "thay đổi và trải nghiệm", 6: "trách nhiệm và chăm sóc", 7: "chiêm nghiệm và phân tích", 8: "quản trị và kết quả", 9: "nhân văn và hoàn thiện", 11: "trực giác và truyền cảm hứng", 22: "tầm nhìn và năng lực kiến tạo", 33: "phục vụ và lòng trắc ẩn"
  });
  const THEMES = Object.freeze(["galaxy", "eastern", "minimal", "mystic"]);
  const PROFILE_CITIES = Object.freeze({
    hanoi: { label: "Hà Nội", latitude: 21.0285, longitude: 105.8542, timezone: 7 },
    hochiminh: { label: "TP. Hồ Chí Minh", latitude: 10.8231, longitude: 106.6297, timezone: 7 },
    danang: { label: "Đà Nẵng", latitude: 16.0544, longitude: 108.2022, timezone: 7 },
    tokyo: { label: "Tokyo", latitude: 35.6762, longitude: 139.6503, timezone: 9 },
    seoul: { label: "Seoul", latitude: 37.5665, longitude: 126.978, timezone: 9 },
    paris: { label: "Paris", latitude: 48.8566, longitude: 2.3522, timezone: 1 },
    newyork: { label: "New York", latitude: 40.7128, longitude: -74.006, timezone: -5 }
  });
  const METHOD_CATALOG = Object.freeze([
    { id: "tarot", title: "Tarot HH nguyên bản", system: "22 biểu tượng nguyên bản · trải 1/3/5/7/10 lá", input: "Chủ đề tùy chọn + seed", algorithm: "Xáo trộn Mulberry32 từ FNV-1a seed; lá đảo 36%", precision: "Tái tạo chính xác theo cùng seed", nature: "Diễn giải biểu tượng", source: "Nội dung HH tự biên soạn", version: "tarot-v2" },
    { id: "zodiac", title: "Cung Mặt Trời", system: "12 cung nhiệt đới theo mốc ngày phổ biến", input: "Ngày sinh", algorithm: "Ánh xạ tháng/ngày vào 12 khoảng", precision: "Không tính ranh giới theo giờ và tọa độ", nature: "Chiêm tinh biểu tượng", source: "Mốc ngày phổ biến; bản đồ sao dùng ephemeris riêng", version: "zodiac-v2" },
    { id: "chinese", title: "12 con giáp", system: "Chu kỳ địa chi theo năm âm lịch", input: "Năm sinh + xác nhận trước Tết", algorithm: "Chu kỳ 12 chi, 10 can/ngũ hành", precision: "Đúng chu kỳ khi người dùng xác nhận ranh giới Tết", nature: "Lịch chu kỳ + diễn giải biểu tượng", source: "Công thức Can Chi công khai", version: "chinese-v2" },
    { id: "numerology", title: "Thần số học", system: "Pythagoras hoặc Chaldean, không trộn bảng", input: "Ngày sinh hoặc tên", algorithm: "Cộng chữ số và rút gọn; giữ 11/22/33 theo cấu hình", precision: "Công thức tái tạo được", nature: "Hệ biểu tượng", source: "Bảng ánh xạ hiển thị trong kết quả", version: "number-v3" },
    { id: "iching", title: "Kinh Dịch 64 quẻ", system: "Ba đồng xu · King Wen · quẻ chính/hỗ/biến", input: "Seed hoặc sáu lần gieo", algorithm: "Mỗi đồng xu 2/3; tổng 6–9 tạo âm/dương và hào động", precision: "Tái tạo chính xác theo cùng seed", nature: "Cấu trúc cổ điển + diễn giải HH nguyên bản", source: "Tên Hán–Việt; phần giải thích HH tự biên soạn", version: "iching-64-v1" },
    { id: "moon", title: "Pha Mặt Trăng", system: "Chu kỳ giao hội trung bình", input: "Ngày", algorithm: "29,530588853 ngày từ mốc trăng non UTC", precision: "Xấp xỉ; không dùng cho quan sát chuyên nghiệp", nature: "Thiên văn cho pha; gợi ý nhật ký là biểu tượng", source: "USNO + NASA", version: "moon-v2" },
    { id: "chart", title: "Bản đồ sao", system: "Ephemeris thật + Equal House", input: "Ngày, giờ, UTC, kinh/vĩ độ", algorithm: "Astronomy Engine 2.1.19; cung mọc từ thời gian sao; nhà đều 30°", precision: "Hành tinh mục tiêu ±1 phút cung; nhà phụ thuộc dữ liệu sinh", nature: "Vị trí là thiên văn; diễn giải cung/nhà là chiêm tinh", source: "Astronomy Engine MIT · VSOP87/NOVAS/JPL", version: "chart-v1" },
    { id: "compatibility", title: "Đối chiếu hai hồ sơ", system: "Cung, nguyên tố, con giáp và đường đời đặt cạnh nhau", input: "Hai ngày sinh + bối cảnh", algorithm: "So sánh mô tả và tạo câu hỏi giao tiếp; không tạo điểm số", precision: "Công thức nguồn tái tạo được; câu hỏi là nội dung HH", nature: "Diễn giải biểu tượng trung lập", source: "HH tự biên soạn", version: "compare-v2" },
    { id: "calendar", title: "Lịch chiêm nghiệm", system: "Pha trăng, chu kỳ cá nhân và dữ liệu đã lưu", input: "Ngày neo + ngày sinh tùy chọn", algorithm: "Lịch tuần/tháng/timeline; phép pha trăng và chu kỳ công khai", precision: "Pha trăng xấp xỉ; số ghi chú là dữ liệu thực", nature: "Thiên văn xấp xỉ + dữ liệu local + biểu tượng", source: "USNO/NASA + dữ liệu thiết bị", version: "calendar-v1" },
    { id: "journal", title: "Nhật ký mã hóa", system: "Local-first · AES-GCM 256", input: "Nội dung, nhãn, cảm xúc và PIN tùy chọn", algorithm: "PBKDF2 SHA-256 180.000 vòng; AES-GCM với salt/IV ngẫu nhiên", precision: "Mã hóa chuẩn Web Crypto; mất PIN không thể khôi phục", nature: "Dữ liệu riêng tư do người dùng nhập", source: "Web Crypto API", version: "journal-v2" },
    { id: "copilot", title: "Reflection Copilot", system: "AI hỗ trợ suy ngẫm, không bói thay", input: "Kết quả người dùng chủ động chọn", algorithm: "Gemini với prompt an toàn; không tự đăng và không quyết định thay", precision: "AI có thể sai; đầu ra luôn gắn nhãn", nature: "Nội dung AI", source: "Gemini API phía server", version: "copilot-v1" }
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
    return {
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(profile.date || "")) ? String(profile.date) : "",
      time: /^\d{2}:\d{2}$/.test(String(profile.time || "")) ? String(profile.time) : "",
      place: String(profile.place || "").trim().slice(0, 120), city: PROFILE_CITIES[profile.city] ? profile.city : "custom",
      timezone: clamp(profile.timezone, -12, 14, 7), latitude: clamp(profile.latitude, -90, 90, 0), longitude: clamp(profile.longitude, -180, 180, 0),
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
    const settings = {
      theme: THEMES.includes(raw.settings?.theme) ? raw.settings.theme : "galaxy",
      sound: Boolean(raw.settings?.sound), experience: raw.settings?.experience === "advanced" ? "advanced" : "beginner",
      journalReminder: Boolean(raw.settings?.journalReminder)
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
  function buildReflectionCalendar(birthDate, anchorDate = localDateKey(), mode = "month", history = [], journal = []) {
    const safeMode = ["week", "month", "timeline"].includes(mode) ? mode : "month";
    const start = calendarStart(anchorDate, safeMode);
    const count = safeMode === "week" ? 7 : safeMode === "timeline" ? 14 : 42;
    return Array.from({ length: count }, (_, index) => {
      const date = addDays(start, index); const key = localDateKey(date); const moon = calculateMoonPhase(key); const cycles = birthDate ? calculatePersonalCycles(birthDate, key) : null;
      const saved = history.filter((item) => localDateKey(new Date(item.createdAt)) === key).length;
      const notes = journal.filter((item) => localDateKey(new Date(item.createdAt)) === key).length;
      return { date: key, day: date.getDate(), month: date.getMonth() + 1, currentMonth: safeMode !== "month" || date.getMonth() === (parseLocalDate(anchorDate) || new Date()).getUTCMonth(), today: key === localDateKey(), moon, cycles, saved, notes };
    });
  }

  function navMarkup(view) {
    const groups = [
      ["BẮT ĐẦU", [["today","✦","Hôm nay"],["profile","◉","Hồ sơ phiên"],["session","➜","Phiên tổng hợp"]]],
      ["CÔNG CỤ", [["tarot","♢","Tarot Studio"],["zodiac","☼","Cung & con giáp"],["numerology","#","Thần số học"],["iching","☯","Kinh Dịch 64 quẻ"],["moon","☾","Mặt Trăng"],["chart","◎","Bản đồ sao"],["compatibility","∞","Tương tác"]]],
      ["THEO DÕI", [["calendar","▦","Lịch chiêm nghiệm"],["journal","✎","Nhật ký"],["copilot","AI","Reflection Copilot"],["methods","ⓘ","Phương pháp"],["history","◷","Lịch sử"]]]
    ];
    return groups.map(([group, items]) => `<span class="fortune-nav__group">${group}</span>${items.map(([id, icon, label]) => `<button type="button" class="fortune-nav__item${view === id ? " is-active" : ""}" data-fortune-view="${id}" aria-current="${view === id ? "page" : "false"}"><i aria-hidden="true">${icon}</i><span>${label}</span></button>`).join("")}`).join("");
  }

  function toolbarMarkup(title, subtitle) {
    return `<header class="fortune-view-head"><div><span>HH REFLECTION SPACE</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div><button type="button" data-fortune-view="history">◷ Xem lịch sử</button></header>`;
  }
  function explanationMarkup(runtime, title, layers) {
    const advanced = runtime.state.settings.experience === "advanced";
    const visible = advanced ? layers : layers.slice(0, 4);
    return `<section class="fortune-explanation"><header><span>${advanced ? "PHÂN TÍCH CHUYÊN SÂU" : "GIẢI THÍCH DỄ HIỂU"}</span><h3>${escapeHtml(title)}</h3><button type="button" data-fortune-toggle-experience>${advanced ? "Chuyển sang dễ hiểu" : "Xem chuyên sâu"}</button></header><div>${visible.map((layer,index)=>`<article><b>${String(index+1).padStart(2,"0")}</b><section><strong>${escapeHtml(layer.label)}</strong><p>${escapeHtml(layer.text)}</p></section></article>`).join("")}</div>${!advanced&&layers.length>4?`<small>Còn ${layers.length-4} lớp giải thích trong chế độ Chuyên sâu.</small>`:""}<footer><span>Hãy đối chiếu với trải nghiệm thật. Nội dung biểu tượng không xác định tính cách, tương lai hoặc giá trị của một người.</span><button type="button" data-fortune-ai-analyze>✦ Phân tích sâu bằng Gemini</button></footer></section>`;
  }

  function todayMarkup(runtime) {
    const daily = dailyReading(runtime.ownerId);
    return `${toolbarMarkup("Lời nhắc cho hôm nay", "Một gợi ý ổn định theo ngày để tự quan sát, không phải dự đoán tương lai.")}
      <section class="fortune-today-grid">
        <article class="fortune-daily-card" style="--daily-energy:${daily.energy}%"><div class="fortune-orb"><span>${daily.energy}</span><small>NĂNG LƯỢNG</small></div><div><small>${escapeHtml(daily.dateKey)} · ${escapeHtml(daily.focus)}</small><h3>${escapeHtml(daily.title)}</h3><p>${escapeHtml(daily.message)}</p><div class="fortune-daily-actions"><button type="button" data-fortune-daily-save>＋ Lưu vào lịch sử</button><button type="button" data-fortune-copy="${escapeHtml(`${daily.title}. ${daily.message}`)}">Sao chép</button></div></div></article>
        <article class="fortune-start-card"><span>TRẢI BÀI NHANH</span><h3>Ba góc nhìn cho một điều đang bận tâm</h3><p>Nhập câu hỏi nếu muốn. Câu hỏi chỉ tồn tại trên màn hình và không được lưu vào lịch sử.</p><label><span>Câu hỏi tùy chọn</span><input type="text" maxlength="180" data-fortune-quick-question placeholder="Ví dụ: Mình nên nhìn vấn đề này từ góc nào?"></label><button class="fortune-primary" type="button" data-fortune-quick-draw>Rút 3 lá ngay <b>→</b></button></article>
        <article class="fortune-path-card"><header><span>MỞ NHANH</span><strong>12 công cụ đã sẵn sàng</strong></header><div>${[["profile","◉","Hồ sơ phiên"],["session","➜","Phiên tổng hợp"],["tarot","♢","Tarot Studio"],["numerology","#","Con số & chu kỳ"],["iching","☯","Kinh Dịch 64 quẻ"],["moon","☾","Mặt Trăng"],["chart","◎","Bản đồ sao"],["calendar","▦","Lịch chiêm nghiệm"],["compatibility","∞","Tương tác"],["journal","✎","Nhật ký mã hóa"],["copilot","AI","Reflection Copilot"],["methods","ⓘ","Trung tâm phương pháp"]].map(([view, icon, label]) => `<button type="button" data-fortune-view="${view}"><i>${icon}</i><span>${label}</span><b>→</b></button>`).join("")}</div></article>
        <details class="fortune-safety-card" open><summary>Điều cần biết trước khi sử dụng</summary><p>Đây là nội dung giải trí và tự chiêm nghiệm, không phải khoa học dự báo. Không dùng kết quả để thay thế tư vấn y tế, pháp lý, tài chính hoặc quyết định quan trọng. Bạn luôn là người chịu trách nhiệm cho lựa chọn của mình.</p></details>
      </section>`;
  }

  function profileMarkup(runtime) {
    const profile = runtime.profile;
    const hasCore = Boolean(profile.date);
    return `${toolbarMarkup("Hồ sơ phiên dùng chung", "Nhập một lần trong phiên để tự điền các công cụ. Mặc định dữ liệu biến mất khi đóng hoặc tải lại trang.")}<section class="fortune-profile"><article class="fortune-calc-card fortune-calc-card--wide"><header><i>◉</i><div><small>SESSION-ONLY BY DEFAULT</small><h3>Thông tin dùng chung</h3></div></header><div class="fortune-profile-fields"><label><span>Ngày sinh</span><input type="date" data-fortune-profile-date value="${escapeHtml(profile.date)}" autocomplete="bday"></label><label><span>Giờ sinh</span><input type="time" data-fortune-profile-time value="${escapeHtml(profile.time)}"></label><label><span>Thành phố nhanh</span><select data-fortune-profile-city><option value="custom">Tự nhập tọa độ</option>${Object.entries(PROFILE_CITIES).map(([id, city]) => `<option value="${id}"${profile.city === id ? " selected" : ""}>${escapeHtml(city.label)} · UTC${city.timezone >= 0 ? "+" : ""}${city.timezone}</option>`).join("")}</select></label><label><span>Tên địa điểm</span><input type="text" maxlength="120" data-fortune-profile-place value="${escapeHtml(profile.place)}" placeholder="Ví dụ: Hà Nội"></label><label><span>Múi giờ UTC</span><input type="number" min="-12" max="14" step="0.5" data-fortune-profile-timezone value="${profile.timezone}"></label><label><span>Vĩ độ</span><input type="number" min="-90" max="90" step="0.0001" data-fortune-profile-latitude value="${profile.latitude}"></label><label><span>Kinh độ</span><input type="number" min="-180" max="180" step="0.0001" data-fortune-profile-longitude value="${profile.longitude}"></label><label class="fortune-check"><input type="checkbox" data-fortune-profile-before-tet ${profile.beforeTet ? "checked" : ""}><span>Sinh trước Tết âm lịch năm đó</span></label></div><label class="fortune-profile-consent"><input type="checkbox" data-fortune-profile-remember ${runtime.state.profile?.remembered ? "checked" : ""}><span><strong>Cho phép lưu hồ sơ trên thiết bị này</strong><small>Nếu không bật, dữ liệu chỉ nằm trong bộ nhớ của tab. Hồ sơ không tự gửi lên máy chủ.</small></span></label><div class="fortune-profile-actions"><button class="fortune-primary" type="button" data-fortune-profile-apply>Áp dụng cho phiên</button><button type="button" data-fortune-profile-clear>Xóa hồ sơ ngay</button></div></article><article class="fortune-profile-status"><span>${hasCore ? "ĐÃ CÓ DỮ LIỆU PHIÊN" : "CHƯA CÓ HỒ SƠ"}</span><h3>${hasCore ? `Ngày ${escapeHtml(profile.date)}${profile.time ? ` · ${escapeHtml(profile.time)}` : ""}` : "Nhập ngày sinh để tự điền công cụ"}</h3><p>${profile.place ? `${escapeHtml(profile.place)} · UTC${profile.timezone >= 0 ? "+" : ""}${profile.timezone}` : "Vị trí chỉ cần thiết cho cung mọc và mười hai nhà."}</p><dl><div><dt>Lưu lâu dài</dt><dd>${runtime.state.profile?.remembered ? "Đã bật trên thiết bị" : "Đang tắt"}</dd></div><div><dt>Gửi máy chủ</dt><dd>Không</dd></div><div><dt>Bản đồ sao</dt><dd>${profile.date && profile.time && profile.latitude && profile.longitude ? "Đủ đầu vào" : "Cần giờ và tọa độ"}</dd></div></dl></article></section>`;
  }

  function sessionMarkup(runtime) {
    const builder = runtime.builder;
    const result = builder.result;
    const tools = [["tarot","Tarot + câu hỏi"],["numerology","Thần số + chu kỳ"],["iching","Kinh Dịch + hành động"],["zodiac","Cung + giao tiếp"],["moon","Mặt Trăng + cảm xúc"]];
    return `${toolbarMarkup("Phiên xem tổng hợp", "Một luồng duy nhất từ chủ đề đến kết quả, suy ngẫm và lưu. Câu hỏi không được ghi vào lịch sử.")}<section class="fortune-session-builder"><ol class="fortune-builder-rail">${["Chủ đề","Công cụ","Dữ liệu","Phương pháp","Kết quả","Suy ngẫm","Lưu"].map((label,index)=>`<li class="${builder.step >= index + 1 ? "is-done" : ""}"><b>${index+1}</b><span>${label}</span></li>`).join("")}</ol><div class="fortune-builder-grid"><article><span>1 · CHỌN CHỦ ĐỀ</span><label><select data-fortune-builder-topic>${[["clarity","Làm rõ tình huống"],["relationship","Mối quan hệ"],["work","Công việc"],["decision","Cân nhắc quyết định"],["wellbeing","Quan sát cảm xúc"]].map(([id,label])=>`<option value="${id}"${builder.topic===id?" selected":""}>${label}</option>`).join("")}</select></label><textarea rows="2" maxlength="240" data-fortune-builder-question placeholder="Câu hỏi tùy chọn, không lưu">${escapeHtml(builder.question)}</textarea></article><article><span>2 · CHỌN CÔNG CỤ</span><div class="fortune-builder-tools">${tools.map(([id,label])=>`<label><input type="checkbox" data-fortune-builder-tool="${id}" ${builder.tools.includes(id)?"checked":""}><span>${label}</span></label>`).join("")}</div></article><article><span>3 · KIỂM TRA DỮ LIỆU</span><p>${runtime.profile.date ? `Đang dùng hồ sơ phiên ${escapeHtml(runtime.profile.date)}.` : "Chưa có ngày sinh; Tarot, Kinh Dịch và Mặt Trăng vẫn dùng được."}</p><button type="button" data-fortune-view="profile">Mở hồ sơ phiên</button></article><article><span>4 · PHƯƠNG PHÁP</span><ul>${builder.tools.map((id)=>`<li>${escapeHtml(METHOD_CATALOG.find((item)=>item.id===id)?.algorithm||"Phương pháp được hiển thị trong công cụ.")}</li>`).join("")||"<li>Chọn ít nhất một công cụ.</li>"}</ul><button class="fortune-primary" type="button" data-fortune-builder-run>Tạo phiên tổng hợp</button></article>${result ? `<article class="fortune-builder-result" data-fortune-result><span>5 · KẾT QUẢ</span><h3>${escapeHtml(result.title)}</h3><div>${result.parts.map((part)=>`<section><strong>${escapeHtml(part.label)}</strong><p>${escapeHtml(part.text)}</p></section>`).join("")}</div><button type="button" data-fortune-ai-analyze>✦ Phân tích sâu bản tổng hợp bằng Gemini</button></article><article><span>6 · SUY NGẪM</span><textarea rows="5" maxlength="3000" data-fortune-builder-reflection placeholder="Điều gì thực sự hữu ích với bạn?">${escapeHtml(builder.reflection)}</textarea><div class="fortune-mood-row"><label>Cảm xúc trước<input type="range" min="1" max="5" data-fortune-builder-mood-before value="${builder.moodBefore}"></label><label>Cảm xúc sau<input type="range" min="1" max="5" data-fortune-builder-mood-after value="${builder.moodAfter}"></label></div></article><article><span>7 · LƯU CÓ CHỦ ĐÍCH</span><p>Chỉ tóm tắt kết quả và phần bạn viết được lưu. Ngày sinh, câu hỏi và tọa độ không đi vào lịch sử.</p><button class="fortune-primary" type="button" data-fortune-builder-save>Lưu phiên & nhật ký</button><button type="button" data-fortune-builder-reset>Làm phiên mới</button></article>` : ""}</div></section>`;
  }

  function tarotMarkup(runtime) {
    const cards = runtime.session.tarot || [];
    let results = cards.length ? `<div class="fortune-card-spread" data-fortune-result>${cards.map((card,index) => `<article class="fortune-tarot-card is-revealed${card.reversed ? " is-reversed" : ""}" style="--card-accent:${card.color}" draggable="true" data-fortune-card-index="${index}"><div class="fortune-tarot-face"><small><input type="text" maxlength="60" data-fortune-card-position="${index}" value="${escapeHtml(card.position)}" aria-label="Tên vị trí lá ${index+1}"></small><i aria-hidden="true">${card.symbol}</i><h3>${escapeHtml(card.name)}</h3><span>${card.reversed ? "Góc khuất" : "Thuận chiều"}</span></div><div class="fortune-tarot-reading"><p>${escapeHtml(card.interpretation)}</p><strong>Câu hỏi mở</strong><p>${escapeHtml(card.question)}</p><textarea rows="2" maxlength="500" data-fortune-card-note="${index}" placeholder="Ghi chú riêng cho lá này...">${escapeHtml(card.note||"")}</textarea><footer><button type="button" data-fortune-card-pin="${index}">${card.pinned?"★ Đã ghim":"☆ Ghim"}</button><button type="button" data-fortune-card-move="${index}:-1" aria-label="Đưa lá sang trái">←</button><button type="button" data-fortune-card-move="${index}:1" aria-label="Đưa lá sang phải">→</button></footer></div></article>`).join("")}</div>${runtime.session.tarotPrevious?.length?`<details class="fortune-tarot-compare"><summary>So sánh với lần trải trước</summary><div>${runtime.session.tarotPrevious.map((card,index)=>`<span><b>${index+1}</b>${escapeHtml(card.name)} · ${escapeHtml(card.position)}</span>`).join("")}</div></details>`:""}<div class="fortune-result-actions"><label>Tỷ lệ ảnh<select data-fortune-export-ratio><option value="1:1">1:1</option><option value="9:16">9:16</option><option value="16:9">16:9</option></select></label><button type="button" data-fortune-export="txt">Tải TXT</button><button type="button" data-fortune-export="json">Tải JSON</button><button type="button" data-fortune-export="png">Tải PNG</button><button type="button" data-fortune-copy-result>Sao chép</button><button type="button" data-fortune-share>Chia sẻ</button></div>` : `<div class="fortune-empty"><i>♢</i><strong>Chưa có lá bài nào được rút</strong><p>Chọn kiểu trải bài rồi bấm “Rút bài”. Mỗi lần bấm dùng một seed mới và có thể tái tạo từ seed hiển thị.</p></div>`;
    if (cards.length) results += explanationMarkup(runtime, "Cách đọc trải bài này", [
      { label: "Dữ liệu đầu vào", text: `Trải ${cards.length} lá dùng seed ${runtime.session.tarotSeed}; câu hỏi chỉ giúp định hướng chú ý và không được lưu.` },
      { label: "Cách chọn lá", text: "Bộ 22 biểu tượng HH được xáo bằng bộ sinh số có seed; mỗi lá chỉ xuất hiện một lần trong cùng trải bài." },
      { label: "Vị trí", text: "Tên vị trí mô tả vai trò của lá trong bố cục, không phải mốc thời gian chắc chắn. Bạn có thể sửa tên vị trí cho phù hợp." },
      { label: "Thuận và góc khuất", text: "Thuận chiều nêu nguồn lực dễ nhận thấy; góc khuất nêu rủi ro hoặc điểm mù cần kiểm chứng." },
      { label: "Liên kết các lá", text: "Đọc điểm lặp giữa các lá trước, sau đó tìm mâu thuẫn. Mâu thuẫn thường là nơi cần thêm dữ kiện thay vì chọn một câu trả lời tuyệt đối." },
      { label: "Kiểm chứng", text: "Tách dữ kiện đang có, diễn giải của bạn và điều chưa biết. Không biến biểu tượng thành bằng chứng về người khác." },
      { label: "Hành động an toàn", text: "Chọn một bước nhỏ có thể đảo ngược, đặt thời điểm xem lại và dừng nếu kết quả làm tăng sợ hãi." },
      { label: "Giới hạn", text: "Tarot không dự báo khoa học, không thay tư vấn chuyên môn và không xác nhận ý định bí mật của bất kỳ ai." }
    ]);
    return `${toolbarMarkup("Tarot Studio", "Bộ 22 lá nguyên bản do HH biên soạn; hỗ trợ kéo đổi vị trí, ghim, ghi chú, so sánh và xuất nhiều tỷ lệ.")}<section class="fortune-control-panel"><label><span>Chủ đề hoặc câu hỏi (không lưu)</span><input type="text" maxlength="180" data-fortune-tarot-question value="${escapeHtml(runtime.session.question || "")}" placeholder="Bạn muốn soi chiếu điều gì?"></label><label><span>Kiểu trải bài</span><select data-fortune-tarot-count><option value="1"${runtime.session.tarotCount === 1 ? " selected" : ""}>1 lá · Trọng tâm</option><option value="3"${runtime.session.tarotCount === 3 ? " selected" : ""}>3 lá · Bối cảnh / Chú ý / Bước thử</option><option value="5"${runtime.session.tarotCount === 5 ? " selected" : ""}>5 lá · Toàn cảnh</option><option value="7"${runtime.session.tarotCount === 7 ? " selected" : ""}>7 lá · Hành trình</option><option value="10"${runtime.session.tarotCount === 10 ? " selected" : ""}>10 lá · Tổng hợp chuyên sâu</option></select></label><label><span>Seed tái tạo (tùy chọn)</span><input type="text" maxlength="120" data-fortune-tarot-seed value="${escapeHtml(runtime.session.tarotSeed || "")}" placeholder="Để trống để tạo seed mới"></label><button class="fortune-primary" type="button" data-fortune-draw>♢ Rút bài</button><small>Cùng seed + cùng số lá sẽ cho cùng kết quả ban đầu.</small></section>${results}`;
  }

  function zodiacMarkup(runtime) {
    const western = runtime.session.western;
    const chinese = runtime.session.chinese;
    return `${toolbarMarkup("Cung hoàng đạo & 12 con giáp", "Tính bằng mốc ngày phổ biến và chu kỳ Can Chi; nội dung tính cách chỉ để tự quan sát.")}<div class="fortune-two-column">
      <section class="fortune-calc-card"><header><i>☼</i><div><small>HOÀNG ĐẠO PHƯƠNG TÂY</small><h3>Tính cung theo ngày sinh</h3></div></header><label><span>Ngày sinh</span><input type="date" data-fortune-zodiac-date autocomplete="bday" value="${escapeHtml(runtime.session.zodiacDate || runtime.profile.date || "")}"></label><button class="fortune-primary" type="button" data-fortune-zodiac-calc>Tính cung</button>${western ? `<div class="fortune-sign-result" data-fortune-result><i>${western.symbol}</i><div><small>${escapeHtml(western.element)} · ${escapeHtml(western.mode)}</small><h3>${escapeHtml(western.name)}</h3><p>${escapeHtml(western.note)}</p></div></div>` : `<p class="fortune-hint">Ngày sinh chỉ được dùng để tính tại chỗ và không được lưu.</p>`}</section>
      <section class="fortune-calc-card"><header><i>◉</i><div><small>CHU KỲ 12 CON GIÁP</small><h3>Tính theo năm âm lịch</h3></div></header><div class="fortune-inline-fields"><label><span>Năm sinh dương lịch</span><input type="number" min="1900" max="2100" inputmode="numeric" data-fortune-chinese-year value="${escapeHtml(runtime.session.chineseYear || runtime.profile.date.slice(0,4) || "")}" placeholder="2003"></label><label class="fortune-check"><input type="checkbox" data-fortune-before-tet ${runtime.session.chineseBeforeTet || runtime.profile.beforeTet ? "checked" : ""}><span>Sinh trước Tết âm lịch năm đó</span></label></div><button class="fortune-primary" type="button" data-fortune-chinese-calc>Tính con giáp</button>${chinese ? `<div class="fortune-sign-result fortune-sign-result--animal" data-fortune-result><i>${escapeHtml(chinese.branch)}</i><div><small>${escapeHtml(chinese.yinYang)} ${escapeHtml(chinese.element)} · năm chu kỳ ${chinese.cycleYear}</small><h3>${escapeHtml(chinese.animal)} · ${escapeHtml(chinese.branch)}</h3><p>Gợi ý biểu tượng: ${escapeHtml(chinese.note)}.</p></div></div>` : `<p class="fortune-hint">Nếu sinh vào tháng 1–2, hãy kiểm tra ngày Tết âm lịch và đánh dấu chính xác.</p>`}</section>
      <details class="fortune-method-card"><summary>Cách tính và giới hạn</summary><p>Cung hoàng đạo dùng các mốc ngày phổ biến trong chiêm tinh nhiệt đới; người sinh gần ranh giới có thể gặp cách tính khác khi xét giờ và nơi sinh. Con giáp dùng chu kỳ 12 năm, có điều chỉnh “trước Tết” do bạn tự xác nhận. Website không tự suy đoán lịch âm.</p></details>
    </div>`;
  }

  function numerologyMarkup(runtime) {
    const result = runtime.session.numerology;
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
    return `${toolbarMarkup("Thần số học minh bạch", "Công khai từng bước cộng và rút gọn; đây là hệ thống biểu tượng, không phải công cụ đánh giá con người.")}<section class="fortune-numerology"><div class="fortune-calc-card fortune-calc-card--wide"><header><i>#</i><div><small>CÔNG THỨC TẠI CHỖ</small><h3>Ngày sinh, chu kỳ và tên gọi</h3></div></header><div class="fortune-form-grid"><label><span>Ngày sinh</span><input type="date" data-fortune-numerology-date autocomplete="bday" value="${escapeHtml(runtime.session.birthDate || runtime.profile.date || "")}"></label><label><span>Ngày muốn xem chu kỳ</span><input type="date" data-fortune-cycle-date value="${escapeHtml(runtime.session.targetDate || localDateKey())}"></label></div><button class="fortune-primary" type="button" data-fortune-numerology-calc>Tính đường đời và chu kỳ</button><div class="fortune-name-lab"><label><span>Tên dùng để tính riêng (không lưu)</span><input type="text" maxlength="120" data-fortune-name value="${escapeHtml(runtime.session.nameInput || "")}" placeholder="Nhập tên gọi hoặc họ tên"></label><label><span>Hệ chữ cái</span><select data-fortune-name-system><option value="pythagorean"${runtime.session.nameSystem!=="chaldean"?" selected":""}>Pythagoras</option><option value="chaldean"${runtime.session.nameSystem==="chaldean"?" selected":""}>Chaldean</option></select></label><button type="button" data-fortune-name-calc>Tính riêng theo hệ đã chọn</button></div><p class="fortune-hint">Ngày sinh và tên chỉ tồn tại trong phiên đang mở, không ghi vào localStorage và không gửi lên máy chủ.</p></div>${result ? `<article class="fortune-number-result" data-fortune-result><div><small>CON SỐ ĐƯỜNG ĐỜI</small><strong>${result.lifePath}</strong><span>Ngày sinh ${result.birthDay} · Thái độ ${result.attitude}</span></div><section><span>Công thức</span><code>${escapeHtml(result.formula)}</code><h3>Chủ đề: ${escapeHtml(result.meaning)}</h3><div class="fortune-number-grid">${Object.entries(result.chart).map(([number,count])=>`<span class="${count?"has-number":""}"><b>${number}</b><small>${count} lần</small></span>`).join("")}</div><div class="fortune-arrow-list">${result.arrows.map((item)=>`<span class="is-${item.state}">${item.numbers.join("-")} · ${escapeHtml(item.label)} · ${item.state === "full" ? "đủ" : "trống"}</span>`).join("")||"Không có hàng đủ/trống hoàn toàn."}</div><button type="button" data-fortune-save-current>Lưu phần tóm tắt</button></section></article>` : `<div class="fortune-empty fortune-empty--compact"><i>#</i><strong>Nhập ngày sinh để bắt đầu</strong><p>Kết quả hiển thị tổng chữ số, bước rút gọn, thái độ, biểu đồ 1–9 và mũi tên.</p></div>`}${cycles ? `<article class="fortune-cycle-result"><header><small>CHU KỲ CÁ NHÂN · ${escapeHtml(cycles.targetDate)}</small><h3>Ba nhịp để tự quan sát</h3></header><div><span><b>${cycles.personalYear}</b>Năm · ${escapeHtml(cycles.meanings.year)}</span><span><b>${cycles.personalMonth}</b>Tháng · ${escapeHtml(cycles.meanings.month)}</span><span><b>${cycles.personalDay}</b>Ngày · ${escapeHtml(cycles.meanings.day)}</span></div><details><summary>Xem công thức</summary><code>${escapeHtml(cycles.formula)}</code></details></article>` : ""}${nameResult ? `<article class="fortune-name-result" data-fortune-result><header><small>HỆ ${nameResult.system === "chaldean" ? "CHALDEAN" : "PYTHAGORAS"}</small><h3>Kết quả từ ${nameResult.letters.length} ký tự Latin hóa</h3></header><div><span><b>${nameResult.expression}</b>Biểu đạt</span><span><b>${nameResult.soul}</b>Nội tâm</span><span><b>${nameResult.personality}</b>Ấn tượng</span></div><details><summary>Xem ba công thức</summary><code>Biểu đạt: ${escapeHtml(nameResult.formulas.expression)}\nNội tâm: ${escapeHtml(nameResult.formulas.soul)}\nẤn tượng: ${escapeHtml(nameResult.formulas.personality)}</code></details></article>` : ""}${detail}</section>`;
  }

  function ichingMarkup(runtime) {
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
    return `${toolbarMarkup("Kinh Dịch 64 quẻ", "Ba đồng xu có seed, đủ tên Hán–Việt, quẻ chính, quẻ hỗ, quẻ biến và diễn giải HH nguyên bản.")}<section class="fortune-iching"><div class="fortune-calc-card"><header><i>☯</i><div><small>THREE-COIN · KING WEN</small><h3>Đặt ý niệm rồi gieo quẻ</h3></div></header><label><span>Điều muốn suy ngẫm (không lưu)</span><textarea rows="3" maxlength="240" data-fortune-iching-question placeholder="Viết ngắn gọn điều bạn đang cân nhắc...">${escapeHtml(runtime.session.ichingQuestion||"")}</textarea></label><label><span>Seed tái tạo</span><input type="text" maxlength="120" data-fortune-iching-seed value="${escapeHtml(runtime.session.ichingSeed||"")}" placeholder="Để trống để tạo mới"></label><button class="fortune-primary" type="button" data-fortune-iching-cast>Gieo 6 hào</button><small>Cùng seed sẽ tạo lại đúng ba đồng xu của từng hào.</small></div>${result ? `<article class="fortune-hexagram" data-fortune-result><div><div class="fortune-lines" aria-label="Sáu hào, đọc từ dưới lên">${[...result.lines].reverse().map((line) => `<div class="${line.yang ? "is-yang" : "is-yin"}${line.changing ? " is-changing" : ""}" aria-label="Hào ${line.number}: ${line.yang ? "dương" : "âm"}${line.changing ? ", động" : ""}"><span></span><span></span><b>${line.changing ? "○" : ""}</b></div>`).join("")}</div><ol class="fortune-coin-ledger">${result.lines.map((line)=>`<li><b>Hào ${line.number}</b><span>${line.coins.map((coin)=>coin===3?"ngửa 3":"sấp 2").join(" · ")}</span><strong>${line.value} · ${line.yang?"dương":"âm"}${line.changing?" động":""}</strong></li>`).join("")}</ol></div><section><small>QUẺ CHÍNH · ĐỌC TỪ DƯỚI LÊN</small><h3>${escapeHtml(result.title)}</h3><p>${escapeHtml(result.reflection)}</p><p>${escapeHtml(result.question)}</p><div class="fortune-hexagram-triad"><span><small>QUẺ HỖ</small><strong>${escapeHtml(result.nuclearTitle)}</strong></span><span><small>QUẺ BIẾN</small><strong>${escapeHtml(result.changedTitle)}</strong></span></div><button type="button" data-fortune-save-current>Lưu kết quả</button></section></article>` : `<div class="fortune-empty fortune-empty--compact"><i>☯</i><strong>Chưa gieo quẻ</strong><p>Mỗi hào dùng ba đồng xu mô phỏng: ngửa = 3, sấp = 2, tổng 6–9. Hệ thống không sao chép lời quẻ từ bản dịch thương mại.</p></div>`}${detail}</section>`;
  }

  function moonMarkup(runtime) {
    const result = runtime.session.moon;
    return `${toolbarMarkup("Chu kỳ Mặt Trăng", "Tính pha và phần trăm chiếu sáng theo phép xấp xỉ thiên văn; phần gợi ý chỉ dùng để viết nhật ký.")}<section class="fortune-moon"><div class="fortune-calc-card"><header><i>☾</i><div><small>MOON PHASE LAB</small><h3>Xem pha Mặt Trăng theo ngày</h3></div></header><label><span>Ngày cần xem</span><input type="date" min="1900-01-01" max="2100-12-31" data-fortune-moon-date value="${escapeHtml(runtime.session.moonDate || localDateKey())}"></label><button class="fortune-primary" type="button" data-fortune-moon-calc>Tính pha Mặt Trăng</button><button type="button" data-fortune-moon-today>Chọn hôm nay</button><p class="fortune-hint">Vị trí mọc/lặn phụ thuộc địa điểm và không được tính trong công cụ này.</p></div>${result ? `<article class="fortune-moon-result" data-fortune-result style="--moon-light:${result.illumination}%"><div class="fortune-moon-disc"><i>${escapeHtml(result.symbol)}</i><span>${result.illumination}%</span></div><section><small>${escapeHtml(result.date)} · ${result.waxing ? "Đang sáng dần" : "Đang khuyết dần"}</small><h3>${escapeHtml(result.name)}</h3><p>Tuổi trăng xấp xỉ <strong>${result.ageDays} ngày</strong>. Gợi ý nhật ký: ${escapeHtml(result.reflection)}.</p><dl><div><dt>Chiếu sáng</dt><dd>${result.illumination}%</dd></div><div><dt>Vị trí chu kỳ</dt><dd>${Math.round(result.phase * 100)}%</dd></div></dl><details><summary>Phương pháp và nguồn</summary><p>${escapeHtml(result.method)}</p><a href="https://aa.usno.navy.mil/faq/moon_phases" target="_blank" rel="noopener noreferrer">Định nghĩa pha Mặt Trăng · USNO</a><a href="https://science.nasa.gov/moon/daily-moon-guide/" target="_blank" rel="noopener noreferrer">Daily Moon Guide · NASA</a></details><button type="button" data-fortune-save-current>Lưu phần tóm tắt</button></section></article>` : `<div class="fortune-empty fortune-empty--compact"><i>☾</i><strong>Chọn một ngày để bắt đầu</strong><p>Công cụ trả tám pha truyền thống, tuổi trăng và phần trăm đĩa trăng được chiếu sáng theo mô hình xấp xỉ.</p></div>`}</section>`;
  }

  function compatibilityMarkup(runtime) {
    const result = runtime.session.compatibility;
    return `${toolbarMarkup("Tương tác biểu tượng", "Đặt hai hồ sơ cạnh nhau để tạo câu hỏi giao tiếp; không chấm điểm hợp hay khắc, không dự đoán quan hệ.")}<section class="fortune-compatibility"><div class="fortune-calc-card fortune-calc-card--wide"><header><i>∞</i><div><small>TWO-PROFILE REFLECTION</small><h3>So sánh hai góc nhìn</h3></div></header><div class="fortune-profile-grid"><fieldset><legend>Người A</legend><label><span>Ngày sinh</span><input type="date" data-fortune-compare-a value="${escapeHtml(runtime.session.compareA || "")}"></label><label class="fortune-check"><input type="checkbox" data-fortune-compare-before-a ${runtime.session.compareBeforeA ? "checked" : ""}><span>Sinh trước Tết âm lịch</span></label></fieldset><fieldset><legend>Người B</legend><label><span>Ngày sinh</span><input type="date" data-fortune-compare-b value="${escapeHtml(runtime.session.compareB || "")}"></label><label class="fortune-check"><input type="checkbox" data-fortune-compare-before-b ${runtime.session.compareBeforeB ? "checked" : ""}><span>Sinh trước Tết âm lịch</span></label></fieldset></div><label><span>Bối cảnh</span><select data-fortune-compare-context><option value="relationship"${runtime.session.compareContext === "relationship" ? " selected" : ""}>Mối quan hệ</option><option value="friendship"${runtime.session.compareContext === "friendship" ? " selected" : ""}>Tình bạn</option><option value="team"${runtime.session.compareContext === "team" ? " selected" : ""}>Làm việc nhóm</option></select></label><button class="fortune-primary" type="button" data-fortune-compare>Tạo bản đối chiếu</button><p class="fortune-hint">Ngày sinh chỉ được xử lý trong phiên. Kết quả không phải đánh giá tâm lý hay mức độ tương hợp.</p></div>${result ? `<article class="fortune-compare-result" data-fortune-result><div class="fortune-profile-result"><span>A</span><strong>${escapeHtml(result.first.western.name)} · ${escapeHtml(result.first.chinese.animal)}</strong><small>Đường đời ${result.first.lifePath} · ${escapeHtml(result.first.western.element)}</small></div><div class="fortune-compare-axis">↔</div><div class="fortune-profile-result"><span>B</span><strong>${escapeHtml(result.second.western.name)} · ${escapeHtml(result.second.chinese.animal)}</strong><small>Đường đời ${result.second.lifePath} · ${escapeHtml(result.second.western.element)}</small></div><section><h3>Góc nhìn chung</h3><p>${escapeHtml(result.sharedFocus)}</p><p>${escapeHtml(result.cycleRelation)}</p><strong>Ba câu nên trao đổi trực tiếp</strong><ol>${result.prompts.map((prompt) => `<li>${escapeHtml(prompt)}</li>`).join("")}</ol><button type="button" data-fortune-save-current>Lưu phần tóm tắt không chứa ngày sinh</button></section></article>` : `<div class="fortune-empty fortune-empty--compact"><i>∞</i><strong>Không có điểm số “hợp nhau”</strong><p>Nhập hai ngày sinh để nhận chủ đề khác biệt và ba câu hỏi giao tiếp thực tế.</p></div>`}</section>`;
  }

  function calendarMarkup(runtime) {
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
    return `${toolbarMarkup("Trung tâm phương pháp", "Phân biệt dữ liệu thiên văn, phép tính biểu tượng và nội dung AI trước khi sử dụng kết quả.")}<section class="fortune-methods"><div class="fortune-method-filter"><input type="search" data-fortune-method-search value="${escapeHtml(runtime.methodQuery||"")}" placeholder="Tìm công cụ, thuật toán hoặc nguồn..."><span>${METHOD_CATALOG.length} phương pháp · Fortune Hub ${VERSION}</span></div><div class="fortune-method-list">${METHOD_CATALOG.map((method)=>`<article data-fortune-method-item data-method-search="${escapeHtml(`${method.title} ${method.system} ${method.algorithm} ${method.source}`.toLocaleLowerCase("vi"))}"><header><span>${escapeHtml(method.version)}</span><h3>${escapeHtml(method.title)}</h3><b>${escapeHtml(method.nature)}</b></header><dl><div><dt>Hệ thống</dt><dd>${escapeHtml(method.system)}</dd></div><div><dt>Đầu vào</dt><dd>${escapeHtml(method.input)}</dd></div><div><dt>Thuật toán</dt><dd>${escapeHtml(method.algorithm)}</dd></div><div><dt>Độ chính xác kỹ thuật</dt><dd>${escapeHtml(method.precision)}</dd></div><div><dt>Nguồn</dt><dd>${escapeHtml(method.source)}</dd></div></dl></article>`).join("")}</div><p data-fortune-method-empty hidden>Không tìm thấy phương pháp phù hợp.</p></section>`;
  }

  function copilotMarkup(runtime) {
    const result = runtime.session.copilot;
    const sourceText = currentResultText(runtime);
    return `${toolbarMarkup("Reflection Copilot", "Gemini phân tích sâu kết quả đã tính, nhưng không tạo dữ liệu bói mới và không quyết định thay bạn.")}<section class="fortune-copilot"><div class="fortune-calc-card"><header><i>AI</i><div><small>OPT-IN ONLY · GEMINI API</small><h3>Chọn nội dung gửi cho AI</h3></div></header><label><span>Nội dung</span><textarea rows="10" maxlength="12000" data-fortune-copilot-input placeholder="Dán kết quả hoặc suy ngẫm...">${escapeHtml(runtime.session.copilotInput || (sourceText.startsWith("Chưa có") ? "" : sourceText))}</textarea></label><label><span>Mức giải thích</span><select data-fortune-copilot-depth><option value="detailed"${runtime.session.copilotDepth!=="expert"?" selected":""}>Chi tiết, dễ hiểu</option><option value="expert"${runtime.session.copilotDepth==="expert"?" selected":""}>Chuyên sâu tối đa</option></select></label><div class="fortune-copilot-actions"><label><input type="checkbox" data-fortune-copilot-summary checked><span>Tóm tắt trung lập</span></label><label><input type="checkbox" data-fortune-copilot-components checked><span>Giải thích từng thành phần</span></label><label><input type="checkbox" data-fortune-copilot-links checked><span>Liên kết và mâu thuẫn</span></label><label><input type="checkbox" data-fortune-copilot-questions checked><span>Câu hỏi suy ngẫm</span></label><label><input type="checkbox" data-fortune-copilot-actions checked><span>3 hành động nhỏ</span></label><label><input type="checkbox" data-fortune-copilot-safety checked><span>Phát hiện câu tuyệt đối/gây sợ</span></label></div><label class="fortune-profile-consent"><input type="checkbox" data-fortune-copilot-consent><span><strong>Tôi đồng ý gửi đúng nội dung trong ô tới Gemini API</strong><small>Website không tự kèm hồ sơ, ngày sinh, tọa độ hoặc nhật ký khác. Hãy xóa phần bạn không muốn gửi.</small></span></label><button class="fortune-primary" type="button" data-fortune-copilot-run ${runtime.copilotBusy?"disabled":""}>${runtime.copilotBusy?"Gemini đang phân tích nhiều tầng…":"Phân tích sâu có rào chắn"}</button><small class="fortune-ai-privacy">Khóa Gemini nằm trên Vercel. Nội dung của tác vụ Xem bói không được ghi vào lịch sử hành động phía server.</small></div>${result?`<article class="fortune-copilot-result" data-fortune-result><header><span>NỘI DUNG DO AI TẠO</span><h3>Reflection Copilot · bản phân tích sâu</h3><small>${escapeHtml(result.model||"Gemini")} · ${result.latencyMs?`${result.latencyMs} ms · `:""}hãy tự kiểm tra điều quan trọng</small></header><div>${markdownMarkupSafe(result.output)}</div><footer><button type="button" data-fortune-copy="${escapeHtml(result.output)}">Sao chép</button><button type="button" data-fortune-copilot-again>Phân tích lại</button></footer></article>`:`<div class="fortune-empty fortune-empty--compact"><i>AI</i><strong>AI chỉ chạy khi bạn đồng ý</strong><p>Gemini sẽ giải thích dữ liệu đã có theo nhiều lớp, chỉ ra điều không thể kết luận và đề xuất hành động nhỏ. Nếu API hết quota, kết quả cục bộ vẫn giữ nguyên.</p></div>`}</section>`;
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
    return `${toolbarMarkup("Nhật ký thông minh local-first", "Tìm kiếm, theo dõi cảm xúc, khóa AES-GCM và xuất dữ liệu; AI không tự đọc nhật ký.")}<section class="fortune-journal-security"><div><span>${locked ? "ĐANG KHÓA" : runtime.state.journalVault ? "ĐÃ MỞ KHÓA" : "CHƯA MÃ HÓA"}</span><strong>${runtime.state.journalVault ? "AES-GCM 256 · PBKDF2" : "Dữ liệu local theo tài khoản trên thiết bị"}</strong><small>${locked ? "Nhập PIN để mở; PIN không được lưu và không thể khôi phục." : "Nội dung không tự gửi lên máy chủ hoặc Gemini."}</small></div><label><span>PIN cục bộ</span><input type="password" minlength="4" maxlength="64" autocomplete="off" data-fortune-journal-pin placeholder="Ít nhất 4 ký tự"></label>${locked ? `<button class="fortune-primary" type="button" data-fortune-journal-unlock>Mở khóa</button>` : runtime.state.journalVault ? `<button type="button" data-fortune-journal-lock-now>Khóa ngay</button>` : `<button type="button" data-fortune-journal-enable-lock>Bật mã hóa</button>`}</section><section class="fortune-journal"><div><form data-fortune-journal-form><label><span>Điều bạn muốn ghi lại</span><textarea rows="5" maxlength="4000" data-fortune-journal-text placeholder="Hôm nay tôi nhận ra..." ${locked ? "disabled" : ""}></textarea></label><div><label><span>Nhãn</span><select data-fortune-journal-tag><option>Suy ngẫm</option><option>Công việc</option><option>Mối quan hệ</option><option>Học tập</option><option>Cảm xúc</option><option>Ý tưởng</option></select></label><button class="fortune-primary" type="submit" ${locked ? "disabled" : ""}>＋ Lưu ghi chú</button></div><div class="fortune-journal-moods"><label><span>Cảm xúc trước</span><input type="range" min="1" max="5" value="3" data-fortune-journal-mood-before></label><label><span>Cảm xúc sau</span><input type="range" min="1" max="5" value="3" data-fortune-journal-mood-after></label></div><small data-fortune-journal-count>0 / 4000 ký tự</small></form><article class="fortune-journal-analytics"><header><span>XU HƯỚNG 14 GHI CHÚ GẦN NHẤT</span><strong>Trước và sau mỗi phiên</strong></header>${journalMoodMarkup(journal)}</article></div><div><div class="fortune-journal-tools"><input type="search" data-fortune-journal-search placeholder="Tìm toàn văn..." value="${escapeHtml(runtime.journalQuery || "")}"><select data-fortune-journal-filter><option value="all">Tất cả nhãn</option>${tags.map((tag) => `<option value="${escapeHtml(tag)}"${runtime.journalTag===tag?" selected":""}>${escapeHtml(tag)}</option>`).join("")}</select><button type="button" data-fortune-journal-export="json">JSON</button><button type="button" data-fortune-journal-export="txt">TXT</button><button type="button" data-fortune-journal-export="pdf">PDF</button></div><div class="fortune-journal-list" data-fortune-journal-list>${items || `<div class="fortune-empty fortune-empty--compact"><i>✎</i><strong>${locked ? "Nhật ký đang khóa" : "Nhật ký đang trống"}</strong><p>${locked ? "Mở khóa bằng PIN để đọc ghi chú đã mã hóa." : "Ghi lại điều hữu ích thay vì cố ghi nhớ mọi kết quả."}</p></div>`}</div><p data-fortune-journal-empty hidden>Không tìm thấy ghi chú phù hợp.</p>${journal.length ? `<button class="fortune-danger" type="button" data-fortune-clear-journal>Xóa toàn bộ nhật ký</button>` : ""}</div></section>`;
  }

  function historyMarkup(runtime) {
    const typeLabels = { daily: "Hôm nay", session: "Phiên tổng hợp", tarot: "Tarot", zodiac: "Cung", chinese: "Con giáp", numerology: "Thần số", iching: "Kinh Dịch", moon: "Mặt Trăng", chart: "Bản đồ sao", compatibility: "Tương tác" };
    const options = [...new Set(runtime.state.history.map((item) => item.type))];
    return `${toolbarMarkup("Lịch sử kết quả", "Chỉ lưu phần tóm tắt kết quả; câu hỏi, tên và ngày sinh không được lưu.")}<section class="fortune-history"><div class="fortune-history-tools"><span>${runtime.state.history.length} / ${MAX_HISTORY} kết quả</span><div><button type="button" data-fortune-export-history="json">Xuất JSON</button><button type="button" data-fortune-export-history="txt">Xuất TXT</button><button type="button" data-fortune-reflection-pack>Reflection Pack ZIP</button>${runtime.state.history.length ? `<button class="fortune-danger" type="button" data-fortune-clear-history>Xóa tất cả</button>` : ""}</div></div>${runtime.state.history.length ? `<div class="fortune-history-filter"><label><span>Tìm kết quả</span><input type="search" data-fortune-history-search value="${escapeHtml(runtime.historyQuery || "")}" placeholder="Tên hoặc nội dung..."></label><label><span>Loại</span><select data-fortune-history-type><option value="all">Tất cả</option>${options.map((type) => `<option value="${escapeHtml(type)}"${runtime.historyType === type ? " selected" : ""}>${escapeHtml(typeLabels[type] || type)}</option>`).join("")}</select></label></div>` : ""}<div class="fortune-history-list" data-fortune-history-list>${runtime.state.history.length ? runtime.state.history.map((item) => `<article data-fortune-history-item data-history-type="${escapeHtml(item.type)}" data-history-search="${escapeHtml(`${item.title} ${item.summary}`.toLocaleLowerCase("vi"))}"><i>${escapeHtml(typeLabels[item.type] || item.type)}</i><div><small>${escapeHtml(formatDateTime(item.createdAt))}</small><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p></div><button type="button" data-fortune-history-delete="${escapeHtml(item.id)}" aria-label="Xóa kết quả">×</button></article>`).join("") : `<div class="fortune-empty"><i>◷</i><strong>Chưa có kết quả đã lưu</strong><p>Kết quả chỉ được thêm khi bạn chủ động bấm lưu hoặc hoàn thành một phép tính.</p><button type="button" data-fortune-view="today">Về Hôm nay</button></div>`}</div><p class="fortune-history-empty-filter" data-fortune-history-empty hidden>Không có kết quả phù hợp bộ lọc.</p></section>`;
  }

  function supplementalExplanation(runtime, view) {
    if (view === "zodiac" && (runtime.session.western || runtime.session.chinese)) {
      const western = runtime.session.western; const chinese = runtime.session.chinese;
      return explanationMarkup(runtime, "Giải thích cung và chu kỳ năm sinh", [
        { label: "Dữ liệu đầu vào", text: `Ngày dùng cho cung: ${runtime.session.zodiacDate || runtime.profile.date || "chưa có"}; năm chu kỳ: ${runtime.session.chineseYear || runtime.profile.date.slice(0,4) || "chưa có"}.` },
        { label: "Cung Mặt Trời", text: western ? `${western.name} thuộc nguyên tố ${western.element}, tính chất ${western.mode}. Đây là ánh xạ theo mốc ngày phổ biến.` : "Chưa tính cung Mặt Trời." },
        { label: "Ranh giới cung", text: "Nếu sinh sát ngày đổi cung, kết quả theo ngày có thể khác vị trí Mặt Trời thiên văn theo giờ UTC. Dùng Bản đồ sao để tính ecliptic longitude thật." },
        { label: "Con giáp", text: chinese ? `Năm chu kỳ ${chinese.cycleYear}: ${chinese.branch} (${chinese.animal}), ${chinese.yinYang} ${chinese.element}.` : "Chưa tính con giáp." },
        { label: "Ranh giới Tết", text: "Người sinh tháng 1–2 phải xác nhận sinh trước hay sau Tết âm lịch; website không tự đoán." },
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

  function viewMarkup(runtime) {
    if (runtime.state.view === "profile") return profileMarkup(runtime);
    if (runtime.state.view === "session") return sessionMarkup(runtime);
    if (runtime.state.view === "tarot") return tarotMarkup(runtime);
    if (runtime.state.view === "zodiac") return zodiacMarkup(runtime) + supplementalExplanation(runtime, "zodiac");
    if (runtime.state.view === "numerology") return numerologyMarkup(runtime);
    if (runtime.state.view === "iching") return ichingMarkup(runtime);
    if (runtime.state.view === "moon") return moonMarkup(runtime) + supplementalExplanation(runtime, "moon");
    if (runtime.state.view === "compatibility") return compatibilityMarkup(runtime) + supplementalExplanation(runtime, "compatibility");
    if (runtime.state.view === "calendar") return calendarMarkup(runtime);
    if (runtime.state.view === "chart") return chartMarkup(runtime);
    if (runtime.state.view === "journal") return journalMarkup(runtime);
    if (runtime.state.view === "copilot") return copilotMarkup(runtime);
    if (runtime.state.view === "methods") return methodsMarkup(runtime);
    if (runtime.state.view === "history") return historyMarkup(runtime);
    return todayMarkup(runtime);
  }

  function shellMarkup(runtime) {
    return `<section class="fortune-hub" data-fortune-hub data-view="${escapeHtml(runtime.state.view)}" data-theme="${escapeHtml(runtime.state.settings.theme)}" data-experience="${escapeHtml(runtime.state.settings.experience)}">
      <aside class="fortune-sidebar"><div class="fortune-brand"><i>☾</i><div><small>HH PLATFORM</small><strong>Xem bói</strong></div></div><p>Không gian biểu tượng dành cho giải trí và tự chiêm nghiệm.</p><nav aria-label="Điều hướng Xem bói">${navMarkup(runtime.state.view)}</nav><section class="fortune-preferences"><label><span>Giao diện</span><select data-fortune-theme>${[["galaxy","Thiên hà"],["eastern","Á Đông"],["minimal","Tối giản"],["mystic","Huyền bí"]].map(([id,label])=>`<option value="${id}"${runtime.state.settings.theme===id?" selected":""}>${label}</option>`).join("")}</select></label><label><span>Giải thích</span><select data-fortune-experience><option value="beginner"${runtime.state.settings.experience==="beginner"?" selected":""}>Dễ hiểu</option><option value="advanced"${runtime.state.settings.experience==="advanced"?" selected":""}>Chuyên sâu</option></select></label><button type="button" class="${runtime.state.settings.sound?"is-active":""}" data-fortune-sound>${runtime.state.settings.sound?"♫ Âm thanh bật":"♪ Âm thanh tắt"}</button></section><details class="fortune-privacy"><summary>Riêng tư & an toàn</summary><p>Hồ sơ mặc định chỉ trong phiên. Nhật ký có thể khóa AES-GCM bằng PIN; AI chỉ nhận nội dung sau khi bạn đồng ý.</p><button type="button" data-fortune-view="history">Quản lý dữ liệu</button></details></aside>
      <main class="fortune-main"><div class="fortune-mobile-head"><button type="button" data-fortune-nav-toggle aria-label="Mở danh mục">☰</button><strong>☾ Xem bói</strong><button type="button" data-fortune-view="history" aria-label="Mở lịch sử">◷</button></div><div class="fortune-view" data-fortune-view-root>${viewMarkup(runtime)}</div><footer class="fortune-disclaimer"><span>ⓘ</span><p><strong>Nội dung giải trí và tự chiêm nghiệm.</strong> Không phải dự báo khoa học, chẩn đoán hay lời khuyên y tế, pháp lý hoặc tài chính.</p><button type="button" data-fortune-about>Mở hướng dẫn</button></footer></main>
      <div class="fortune-toast" role="status" aria-live="polite" hidden></div>${runtime.deletedRecord ? `<button class="fortune-undo" type="button" data-fortune-undo-delete>Hoàn tác xóa ${escapeHtml(runtime.deletedRecord.label || "dữ liệu")}</button>` : ""}
    </section>`;
  }

  function enhanceJournalControls(runtime) {
    if (runtime.state.view !== "journal" || !runtime.state.journalVault) return;
    const security = runtime.root?.querySelector(".fortune-journal-security"); if (!security || security.querySelector("[data-fortune-vault-sync-controls]")) return;
    security.insertAdjacentHTML("beforeend", `<div class="fortune-vault-sync" data-fortune-vault-sync-controls><button type="button" data-fortune-vault-upload>Đồng bộ bản mã hóa</button><button type="button" data-fortune-vault-download>Khôi phục từ tài khoản</button><small>Chỉ ciphertext, salt và IV được gửi; máy chủ không nhận PIN hoặc bản rõ.</small></div>`);
  }

  function render(runtime, keepShell = false) {
    if (!runtime?.target) return;
    if (!keepShell || !runtime.root) {
      runtime.target.innerHTML = shellMarkup(runtime);
      runtime.root = runtime.target.querySelector("[data-fortune-hub]");
      runtime.root.addEventListener("click", runtime.onClick);
      runtime.root.addEventListener("submit", runtime.onSubmit);
      runtime.root.addEventListener("input", runtime.onInput);
      runtime.root.addEventListener("change", runtime.onChange);
      runtime.root.addEventListener("dragstart", runtime.onDragStart);
      runtime.root.addEventListener("dragover", runtime.onDragOver);
      runtime.root.addEventListener("drop", runtime.onDrop);
    } else {
      runtime.root.dataset.view = runtime.state.view;
      const viewRoot = runtime.root.querySelector("[data-fortune-view-root]");
      if (viewRoot) viewRoot.innerHTML = viewMarkup(runtime);
      const nav = runtime.root.querySelector(".fortune-sidebar nav");
      if (nav) nav.innerHTML = navMarkup(runtime.state.view);
      runtime.root.classList.remove("is-nav-open");
      if (runtime.state.view === "history") filterHistoryDom(runtime);
      if (runtime.state.view === "journal") filterJournalDom(runtime);
    }
    enhanceJournalControls(runtime);
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
    if (view === "tarot" && runtime.session.tarot?.length) return [`HỆ THỐNG: Tarot HH nguyên bản`, `SEED: ${runtime.session.tarotSeed}`, `SỐ LÁ: ${runtime.session.tarot.length}`, ...runtime.session.tarot.map((card, index) => `${index + 1}. ${card.position}: ${card.name} (${card.reversed ? "Góc khuất" : "Thuận chiều"})\nDiễn giải gốc: ${card.interpretation}\nCâu hỏi mở: ${card.question}${card.note ? `\nGhi chú người dùng: ${card.note}` : ""}`)].join("\n\n");
    if (view === "numerology" && runtime.session.numerology) return [`HỆ THỐNG: Thần số học`, `Đường đời ${runtime.session.numerology.lifePath}`, runtime.session.numerology.formula, `Chủ đề: ${runtime.session.numerology.meaning}`, `Ngày sinh rút gọn: ${runtime.session.numerology.birthDay}`, `Thái độ: ${runtime.session.numerology.attitude} (${runtime.session.numerology.attitudeFormula})`, `Biểu đồ 1–9: ${Object.entries(runtime.session.numerology.chart).map(([number, count]) => `${number}:${count}`).join(", ")}`, `Mũi tên: ${runtime.session.numerology.arrows.map((item) => `${item.numbers.join("-")} ${item.state} ${item.label}`).join("; ") || "không có hàng đủ/trống hoàn toàn"}`, runtime.session.cycles ? `Chu kỳ: ${runtime.session.cycles.formula}` : ""].filter(Boolean).join("\n");
    if (view === "iching" && runtime.session.iching) return [`HỆ THỐNG: Kinh Dịch ba đồng xu · 64 quẻ`, `SEED: ${runtime.session.ichingSeed}`, `Quẻ chính: ${runtime.session.iching.title}`, `Quẻ hỗ: ${runtime.session.iching.nuclearTitle}`, `Quẻ biến: ${runtime.session.iching.changedTitle}`, `Hào động: ${runtime.session.iching.changing.join(", ") || "không có"}`, `Sổ gieo: ${runtime.session.iching.lines.map((line) => `hào ${line.number} [${line.coins.join("+")}=${line.value}] ${line.yang ? "dương" : "âm"}${line.changing ? " động" : ""}`).join("; ")}`, `Diễn giải gốc: ${runtime.session.iching.reflection}`, runtime.session.iching.lines.map((line) => line.reflection).filter(Boolean).join(" ")].join("\n");
    if (view === "zodiac" && runtime.session.western) return `${runtime.session.western.name} · ${runtime.session.western.element}\n${runtime.session.western.note}`;
    if (view === "zodiac" && runtime.session.chinese) return `${runtime.session.chinese.animal} · ${runtime.session.chinese.branch} · ${runtime.session.chinese.yinYang} ${runtime.session.chinese.element}`;
    if (view === "moon" && runtime.session.moon) return `${runtime.session.moon.name} · ${runtime.session.moon.date}\nChiếu sáng xấp xỉ ${runtime.session.moon.illumination}% · tuổi trăng ${runtime.session.moon.ageDays} ngày\n${runtime.session.moon.method}`;
    if (view === "compatibility" && runtime.session.compatibility) return `${runtime.session.compatibility.sharedFocus}\n${runtime.session.compatibility.cycleRelation}\n${runtime.session.compatibility.prompts.map((prompt) => `- ${prompt}`).join("\n")}`;
    if (view === "chart" && runtime.session.birthChart?.ok) {
      const chart = runtime.session.birthChart;
      return [`HỆ THỐNG: Bản đồ sao · Astronomy Engine · Equal House`, `THỜI ĐIỂM UTC: ${chart.instantUtc}`, `CUNG MỌC: ${chart.ascendant.name} ${chart.ascendant.degree}°`, `THIÊN ĐỈNH: ${chart.midheaven.name} ${chart.midheaven.degree}°`, "HÀNH TINH:", ...chart.planets.map((planet) => `- ${planet.name}: ${planet.sign.name} ${planet.sign.degree}°, nhà ${planet.house}${planet.retrograde ? ", nghịch hành" : ""}`), "GÓC HỢP:", ...chart.aspects.slice(0, 16).map((aspect) => `- ${aspect.first} ${aspect.name} ${aspect.second}: ${aspect.separation}°, orb ${aspect.exactness}°`), `PHƯƠNG PHÁP: ${chart.method.ephemeris}; ${chart.method.houses}; ${chart.method.interpretation}`].join("\n");
    }
    if (view === "session" && runtime.builder?.result) return [`HỆ THỐNG: Phiên xem tổng hợp`, `CHỦ ĐỀ: ${runtime.builder.result.title}`, ...runtime.builder.result.parts.map((part) => `${part.label}: ${part.text}`)].join("\n\n");
    const daily = dailyReading(runtime.ownerId);
    return `${daily.title}\n${daily.message}`;
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

  function exportResultPng(runtime) {
    const ratio = runtime.root?.querySelector("[data-fortune-export-ratio]")?.value || "1:1";
    const canvas = resultCanvas(runtime, ratio);
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

  async function requestGeminiAnalysis(runtime, input, depth, sections) {
    const base = String(runtime.options.apiBase || globalScope.HH_REALTIME_URL || globalScope.location?.origin || "").replace(/\/$/, "");
    if (!base || !globalScope.fetch) throw new Error("Không tìm thấy backend Gemini.");
    const token = globalScope.HHAuthSession?.token?.() || "";
    runtime.aiController?.abort?.();
    runtime.aiController = new AbortController();
    const response = await globalScope.fetch(`${base}/api/modules/fortune/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        actionType: "fortune-deep-analysis",
        input: String(input || "").slice(0, 12000),
        anonymousId: anonymousId(),
        meta: {
          provider: "gemini",
          allowProviderFallback: false,
          requireProvider: true,
          model: depth === "expert" ? "gemini-3.5-flash" : "gemini-3.5-flash-lite",
          thinkingLevel: depth === "expert" ? "high" : "medium",
          depth,
          sections
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

  async function syncEncryptedVault(runtime, direction) {
    const base = String(runtime.options.apiBase || globalScope.HH_REALTIME_URL || globalScope.location?.origin || "").replace(/\/$/, ""); const token = globalScope.HHAuthSession?.token?.() || "";
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
      timezone: runtime.root.querySelector("[data-fortune-profile-timezone]")?.value,
      latitude: runtime.root.querySelector("[data-fortune-profile-latitude]")?.value,
      longitude: runtime.root.querySelector("[data-fortune-profile-longitude]")?.value,
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
      const cards = drawTarot(seed, 3);
      parts.push({ label: "Tarot · ba góc nhìn", text: cards.map((card) => `${card.position}: ${card.name} — ${card.interpretation}`).join(" ") });
    }
    if (runtime.builder.tools.includes("numerology")) {
      const number = calculateNumerology(runtime.profile.date);
      if (number) {
        const cycles = calculatePersonalCycles(runtime.profile.date, localDateKey());
        parts.push({ label: "Thần số và chu kỳ", text: `Đường đời ${number.lifePath}: ${number.meaning}. ${cycles ? `Năm ${cycles.personalYear}, tháng ${cycles.personalMonth}, ngày ${cycles.personalDay} theo phép cộng biểu tượng.` : ""}` });
      } else parts.push({ label: "Thần số và chu kỳ", text: "Chưa có ngày sinh hợp lệ nên lớp này không được tự đoán." });
    }
    if (runtime.builder.tools.includes("iching")) {
      const result = castIChing(`${Date.now()}-${Math.random()}-builder`);
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
    const viewButton = event.target.closest("[data-fortune-view]");
    if (viewButton) {
      const view = viewButton.dataset.fortuneView;
      if (VIEWS.has(view)) { runtime.state.view = view; writeState(runtime); render(runtime, true); }
      return;
    }
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
      const source = currentResultText(runtime, sourceView);
      runtime.session.copilotInput = source;
      runtime.session.copilotSourceView = sourceView;
      runtime.session.copilot = null;
      runtime.state.view = "copilot"; writeState(runtime); render(runtime, true); return;
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
      const sectionMap = [["summary","Tóm tắt trung lập"],["components","Giải thích từng thành phần"],["links","Liên kết và mâu thuẫn"],["questions","Câu hỏi suy ngẫm"],["actions","Hành động nhỏ"],["safety","Kiểm tra an toàn"]];
      const sections = sectionMap.filter(([id]) => runtime.root.querySelector(`[data-fortune-copilot-${id}]`)?.checked).map(([, label]) => label);
      runtime.session.copilotInput = input; runtime.session.copilotDepth = depth; runtime.copilotBusy = true; runtime.session.copilot = null; render(runtime, true);
      const startedAt = globalScope.performance?.now?.() || Date.now();
      try {
        const action = await requestGeminiAnalysis(runtime, input, depth, sections);
        runtime.session.copilot = { output: action.output, model: action.model || "Gemini", provider: action.provider || "gemini", usage: action.usage || null, latencyMs: Math.round((globalScope.performance?.now?.() || Date.now()) - startedAt), createdAt: new Date().toISOString() };
        showToast(runtime, "Gemini đã hoàn tất bản phân tích sâu.");
      } catch (error) {
        const quota = Number(error.status) === 429 || /quota|resource_exhausted|rate limit/i.test(error.message);
        showToast(runtime, quota ? "Gemini đang hết lượt tạm thời. Kết quả gốc vẫn được giữ; hãy thử lại sau." : `Không thể phân tích: ${error.message}`, "error");
      } finally {
        runtime.copilotBusy = false; runtime.aiController = null; render(runtime, true);
      }
      return;
    }
    if (event.target.closest("[data-fortune-profile-apply]")) {
      runtime.profile = profileFromDom(runtime);
      const remember = Boolean(runtime.root.querySelector("[data-fortune-profile-remember]")?.checked);
      runtime.state.profile = remember ? sanitizeProfile(runtime.profile, true) : null;
      applyProfileToSession(runtime); writeState(runtime); render(runtime, true);
      showToast(runtime, remember ? "Đã áp dụng và lưu hồ sơ trên thiết bị." : "Đã áp dụng cho phiên; không lưu lâu dài."); return;
    }
    if (event.target.closest("[data-fortune-profile-clear]")) {
      runtime.profile = sanitizeProfile(null); runtime.state.profile = null; runtime.session.birthChart = null; runtime.session.birthChartErrors = [];
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
      playFortuneTone(runtime); render(runtime, true); return;
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
    if (chartPlanet) { runtime.chartPlanetIndex = Number(chartPlanet.dataset.fortuneChartPlanet) || 0; render(runtime, true); return; }
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
      runtime.session.tarotCount = 3; runtime.session.tarotSeed = `${Date.now()}-${Math.random()}`; runtime.session.tarot = drawTarot(runtime.session.tarotSeed, 3);
      addHistory(runtime, "tarot", "Trải bài 3 lá", runtime.session.tarot.map((card) => `${card.position}: ${card.name}`).join(" · "));
      runtime.state.view = "tarot"; writeState(runtime); render(runtime, true); return;
    }
    if (event.target.closest("[data-fortune-draw]")) {
      runtime.session.question = runtime.root.querySelector("[data-fortune-tarot-question]")?.value.trim() || "";
      runtime.session.tarotCount = Number(runtime.root.querySelector("[data-fortune-tarot-count]")?.value) || 3;
      runtime.session.tarotPrevious = runtime.session.tarot?.length ? runtime.session.tarot.map((card) => ({ ...card })) : runtime.session.tarotPrevious;
      runtime.session.tarotSeed = runtime.root.querySelector("[data-fortune-tarot-seed]")?.value.trim() || `${Date.now()}-${Math.random()}`;
      runtime.session.tarot = drawTarot(runtime.session.tarotSeed, runtime.session.tarotCount);
      addHistory(runtime, "tarot", `Trải bài ${runtime.session.tarotCount} lá`, runtime.session.tarot.map((card) => `${card.position}: ${card.name}`).join(" · "));
      playFortuneTone(runtime); render(runtime, true); return;
    }
    if (event.target.closest("[data-fortune-zodiac-calc]")) {
      const value = runtime.root.querySelector("[data-fortune-zodiac-date]")?.value || "";
      const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(value);
      runtime.session.western = match ? getWesternZodiac(Number(match[1]), Number(match[2])) : null;
      if (!runtime.session.western) { showToast(runtime, "Hãy nhập ngày sinh hợp lệ.", "error"); return; }
      addHistory(runtime, "zodiac", runtime.session.western.name, `${runtime.session.western.element} · ${runtime.session.western.mode}. ${runtime.session.western.note}`); render(runtime, true); return;
    }
    if (event.target.closest("[data-fortune-chinese-calc]")) {
      const year = runtime.root.querySelector("[data-fortune-chinese-year]")?.value;
      const before = Boolean(runtime.root.querySelector("[data-fortune-before-tet]")?.checked);
      runtime.session.chinese = getChineseZodiac(year, before);
      if (!runtime.session.chinese) { showToast(runtime, "Năm hỗ trợ từ 1900 đến 2100.", "error"); return; }
      addHistory(runtime, "chinese", `${runtime.session.chinese.animal} · ${runtime.session.chinese.branch}`, `${runtime.session.chinese.yinYang} ${runtime.session.chinese.element}. ${runtime.session.chinese.note}.`); render(runtime, true); return;
    }
    if (event.target.closest("[data-fortune-numerology-calc]")) {
      runtime.session.birthDate = runtime.root.querySelector("[data-fortune-numerology-date]")?.value || "";
      runtime.session.targetDate = runtime.root.querySelector("[data-fortune-cycle-date]")?.value || localDateKey();
      runtime.session.numerology = calculateNumerology(runtime.session.birthDate);
      if (!runtime.session.numerology) { showToast(runtime, "Hãy nhập ngày sinh hợp lệ.", "error"); return; }
      runtime.session.cycles = calculatePersonalCycles(runtime.session.birthDate, runtime.session.targetDate);
      if (!runtime.session.cycles) { showToast(runtime, "Ngày xem chu kỳ chưa hợp lệ.", "error"); return; }
      render(runtime, true); return;
    }
    if (event.target.closest("[data-fortune-name-calc]")) {
      runtime.session.nameInput = runtime.root.querySelector("[data-fortune-name]")?.value.trim() || "";
      runtime.session.nameSystem = runtime.root.querySelector("[data-fortune-name-system]")?.value === "chaldean" ? "chaldean" : "pythagorean";
      runtime.session.nameNumerology = calculateNameNumerology(runtime.session.nameInput, runtime.session.nameSystem);
      if (!runtime.session.nameNumerology) { showToast(runtime, "Hãy nhập tên có ít nhất 2 chữ cái.", "error"); return; }
      render(runtime, true); return;
    }
    if (event.target.closest("[data-fortune-iching-cast]")) {
      runtime.session.ichingQuestion = runtime.root.querySelector("[data-fortune-iching-question]")?.value.trim() || "";
      runtime.session.ichingSeed = runtime.root.querySelector("[data-fortune-iching-seed]")?.value.trim() || `${Date.now()}-${Math.random()}`;
      runtime.session.iching = castIChing(runtime.session.ichingSeed); playFortuneTone(runtime); render(runtime, true); return;
    }
    if (event.target.closest("[data-fortune-moon-today]")) {
      runtime.session.moonDate = localDateKey(); runtime.session.moon = calculateMoonPhase(runtime.session.moonDate); render(runtime, true); return;
    }
    if (event.target.closest("[data-fortune-moon-calc]")) {
      runtime.session.moonDate = runtime.root.querySelector("[data-fortune-moon-date]")?.value || "";
      runtime.session.moon = calculateMoonPhase(runtime.session.moonDate);
      if (!runtime.session.moon) { showToast(runtime, "Hãy chọn ngày hợp lệ.", "error"); return; }
      render(runtime, true); return;
    }
    if (event.target.closest("[data-fortune-compare]")) {
      runtime.session.compareA = runtime.root.querySelector("[data-fortune-compare-a]")?.value || "";
      runtime.session.compareB = runtime.root.querySelector("[data-fortune-compare-b]")?.value || "";
      runtime.session.compareBeforeA = Boolean(runtime.root.querySelector("[data-fortune-compare-before-a]")?.checked);
      runtime.session.compareBeforeB = Boolean(runtime.root.querySelector("[data-fortune-compare-before-b]")?.checked);
      runtime.session.compareContext = runtime.root.querySelector("[data-fortune-compare-context]")?.value || "relationship";
      runtime.session.compatibility = compareSymbolicProfiles(runtime.session.compareA, runtime.session.compareB, { beforeTetA: runtime.session.compareBeforeA, beforeTetB: runtime.session.compareBeforeB, context: runtime.session.compareContext });
      if (!runtime.session.compatibility) { showToast(runtime, "Hãy nhập đủ hai ngày sinh hợp lệ.", "error"); return; }
      render(runtime, true); return;
    }
    if (event.target.closest("[data-fortune-save-current]")) { if (saveCurrent(runtime)) showToast(runtime, "Đã lưu kết quả."); return; }
    const exportButton = event.target.closest("[data-fortune-export]");
    if (exportButton) {
      const format = exportButton.dataset.fortuneExport; const text = currentResultText(runtime);
      if (format === "png") exportResultPng(runtime);
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

  function handleInput(runtime, event) {
    if (event.target.matches("[data-fortune-theme]")) {
      runtime.state.settings.theme = THEMES.includes(event.target.value) ? event.target.value : "galaxy";
      runtime.root.dataset.theme = runtime.state.settings.theme; writeState(runtime); return;
    }
    if (event.target.matches("[data-fortune-experience]")) {
      runtime.state.settings.experience = event.target.value === "advanced" ? "advanced" : "beginner";
      writeState(runtime); render(runtime, true); return;
    }
    if (event.target.matches("[data-fortune-profile-city]")) {
      const city = PROFILE_CITIES[event.target.value];
      if (city) {
        const set = (selector, value) => { const input = runtime.root.querySelector(selector); if (input) input.value = value; };
        set("[data-fortune-profile-place]", city.label); set("[data-fortune-profile-timezone]", city.timezone); set("[data-fortune-profile-latitude]", city.latitude); set("[data-fortune-profile-longitude]", city.longitude);
      }
      return;
    }
    if (event.target.matches("[data-fortune-card-position]")) { const card = runtime.session.tarot[Number(event.target.dataset.fortuneCardPosition)]; if (card) card.position = event.target.value.slice(0, 60); return; }
    if (event.target.matches("[data-fortune-card-note]")) { const card = runtime.session.tarot[Number(event.target.dataset.fortuneCardNote)]; if (card) card.note = event.target.value.slice(0, 500); return; }
    if (event.target.matches("[data-fortune-copilot-input]")) { runtime.session.copilotInput = event.target.value.slice(0, 12000); return; }
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
      session: { tarot: [], tarotPrevious: [], tarotCount: 3, tarotSeed: "", question: "", western: null, zodiacDate: "", chinese: null, chineseYear: "", chineseBeforeTet: false, numerology: null, cycles: null, birthDate: "", targetDate: localDateKey(), nameInput: "", nameSystem: "pythagorean", nameNumerology: null, iching: null, ichingSeed: "", ichingQuestion: "", moonDate: localDateKey(), moon: null, birthChart: null, birthChartErrors: [], compareA: "", compareB: "", compareBeforeA: false, compareBeforeB: false, compareContext: "relationship", compatibility: null, copilot: null, copilotInput: "", copilotDepth: "detailed", copilotSourceView: "" },
      root: null, toastTimer: 0, storageError: false, historyQuery: "", historyType: "all", journalQuery: "", journalTag: "all", methodQuery: "", calendarAnchor: localDateKey(), calendarMode: "month", chartPlanetIndex: 0, copilotBusy: false, aiController: null, deletedRecord: null, dragCardIndex: -1, ambientNodes: []
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
    activeRuntime = runtime;
    render(runtime);
    return true;
  }

  function unmount() {
    if (!activeRuntime) return;
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
    }
    if (activeRuntime.target) activeRuntime.target.replaceChildren();
    activeRuntime = null;
  }

  function inspect() {
    return { version: VERSION, mounted: Boolean(activeRuntime), view: activeRuntime?.state?.view || "today", ownerId: activeRuntime?.ownerId || null, historyCount: activeRuntime?.state?.history?.length || 0, journalCount: activeRuntime?.state?.journal?.length || 0 };
  }

  return Object.freeze({ VERSION, STORAGE_SCHEMA, TAROT, WESTERN_ZODIAC, SYNODIC_MONTH_DAYS, METHOD_CATALOG, hashSeed, createRandom, localDateKey, dailyReading, drawTarot, getWesternZodiac, getChineseZodiac, reduceNumerology, calculateNumerology, calculatePersonalCycles, calculateNameNumerology, calculateMoonPhase, compareSymbolicProfiles, castIChing, sanitizeProfile, normalizeState, buildReflectionCalendar, createJournalVault, openJournalVault, storageKey, mount, unmount, inspect });
});
