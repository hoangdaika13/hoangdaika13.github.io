(function fortuneHubModule(globalScope, factory) {
  "use strict";

  const api = factory(globalScope || {});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope && typeof globalScope === "object") globalScope.HHFortuneHub = api;
})(typeof window !== "undefined" ? window : globalThis, function createFortuneHub(globalScope) {
  "use strict";

  const VERSION = "2.0.0";
  const STORAGE_SCHEMA = "hh.fortune.hub.v1";
  const MAX_HISTORY = 80;
  const MAX_JOURNAL = 120;
  const VIEWS = new Set(["today", "tarot", "zodiac", "numerology", "iching", "moon", "compatibility", "journal", "history"]);
  const SYNODIC_MONTH_DAYS = 29.530588853;
  const REFERENCE_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14, 0);
  const NUMBER_MEANINGS = Object.freeze({
    1: "khởi xướng và tự chủ", 2: "hợp tác và tinh tế", 3: "biểu đạt và sáng tạo", 4: "cấu trúc và bền bỉ", 5: "thay đổi và trải nghiệm", 6: "trách nhiệm và chăm sóc", 7: "chiêm nghiệm và phân tích", 8: "quản trị và kết quả", 9: "nhân văn và hoàn thiện", 11: "trực giác và truyền cảm hứng", 22: "tầm nhìn và năng lực kiến tạo", 33: "phục vụ và lòng trắc ẩn"
  });

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
    const safeCount = [1, 3, 5].includes(Number(count)) ? Number(count) : 3;
    const seed = String(seedInput || `${Date.now()}-${Math.random()}`);
    const random = createRandom(hashSeed(`${seed}|tarot-v1`));
    const labels = safeCount === 1
      ? ["Điều cần soi chiếu"]
      : safeCount === 3
        ? ["Bối cảnh", "Điểm cần chú ý", "Bước có thể thử"]
        : ["Nền tảng", "Điều đang hỗ trợ", "Điểm cản trở", "Góc nhìn khác", "Bước thử an toàn"];
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
    return { date: String(dateValue), digits, total, lifePath, birthDay, meaning: NUMBER_MEANINGS[lifePath] || "tự quan sát và phát triển", formula: `${digits.join(" + ")} = ${total} → ${lifePath}` };
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

  function calculateNameNumerology(nameValue) {
    const letters = normalizeNameLetters(nameValue);
    if (letters.length < 2 || letters.length > 120) return null;
    const vowels = new Set(["A", "E", "I", "O", "U", "Y"]);
    const valueOf = (letter) => ((letter.charCodeAt(0) - 65) % 9) + 1;
    const values = [...letters].map(valueOf);
    const soulValues = [...letters].filter((letter) => vowels.has(letter)).map(valueOf);
    const personalityValues = [...letters].filter((letter) => !vowels.has(letter)).map(valueOf);
    const sum = (items) => items.reduce((total, value) => total + value, 0);
    const expressionTotal = sum(values);
    const soulTotal = sum(soulValues);
    const personalityTotal = sum(personalityValues);
    return {
      letters,
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
    return {
      lines, lower, upper, changing, changedLower, changedUpper,
      title: `${upper.symbol} ${upper.name} trên ${lower.symbol} ${lower.name}`,
      changedTitle: changing.length ? `${changedUpper.symbol} ${changedUpper.name} trên ${changedLower.symbol} ${changedLower.name}` : "Không có quẻ biến",
      reflection: `Hình tượng ${upper.nature} ở trên ${lower.nature} gợi ý kết hợp ${upper.note} với ${lower.note}.`,
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

  function normalizeState(input) {
    const raw = input && typeof input === "object" ? input : {};
    const history = (Array.isArray(raw.history) ? raw.history : []).filter((item) => item && item.id && item.type).slice(0, MAX_HISTORY).map((item) => ({
      id: String(item.id), type: String(item.type), title: String(item.title || "Kết quả"), summary: String(item.summary || "").slice(0, 600), createdAt: String(item.createdAt || "")
    }));
    const journal = (Array.isArray(raw.journal) ? raw.journal : []).filter((item) => item && item.id && item.text).slice(0, MAX_JOURNAL).map((item) => ({
      id: String(item.id), text: String(item.text).slice(0, 4000), tag: String(item.tag || "Suy ngẫm").slice(0, 40), createdAt: String(item.createdAt || "")
    }));
    return { version: VERSION, view: VIEWS.has(raw.view) ? raw.view : "today", history, journal, favorites: [...new Set((Array.isArray(raw.favorites) ? raw.favorites : []).map(String))].slice(0, 80) };
  }

  function readState(storage, ownerId) {
    try { return normalizeState(JSON.parse(storage?.getItem(storageKey(ownerId)) || "null")); }
    catch (_error) { return normalizeState(null); }
  }

  function writeState(runtime) {
    try { runtime.storage?.setItem(storageKey(runtime.ownerId), JSON.stringify(runtime.state)); }
    catch (_error) { runtime.storageError = true; }
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

  function navMarkup(view) {
    const items = [
      ["today", "✦", "Hôm nay"], ["tarot", "♢", "Tarot"], ["zodiac", "☼", "Cung & con giáp"], ["numerology", "#", "Thần số học"], ["iching", "☯", "Kinh Dịch"], ["moon", "☾", "Chu kỳ Mặt Trăng"], ["compatibility", "∞", "Tương tác biểu tượng"], ["journal", "✎", "Nhật ký"], ["history", "◷", "Lịch sử"]
    ];
    return items.map(([id, icon, label]) => `<button type="button" class="fortune-nav__item${view === id ? " is-active" : ""}" data-fortune-view="${id}" aria-current="${view === id ? "page" : "false"}"><i aria-hidden="true">${icon}</i><span>${label}</span></button>`).join("");
  }

  function toolbarMarkup(title, subtitle) {
    return `<header class="fortune-view-head"><div><span>HH REFLECTION SPACE</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div><button type="button" data-fortune-view="history">◷ Xem lịch sử</button></header>`;
  }

  function todayMarkup(runtime) {
    const daily = dailyReading(runtime.ownerId);
    return `${toolbarMarkup("Lời nhắc cho hôm nay", "Một gợi ý ổn định theo ngày để tự quan sát, không phải dự đoán tương lai.")}
      <section class="fortune-today-grid">
        <article class="fortune-daily-card" style="--daily-energy:${daily.energy}%"><div class="fortune-orb"><span>${daily.energy}</span><small>NĂNG LƯỢNG</small></div><div><small>${escapeHtml(daily.dateKey)} · ${escapeHtml(daily.focus)}</small><h3>${escapeHtml(daily.title)}</h3><p>${escapeHtml(daily.message)}</p><div class="fortune-daily-actions"><button type="button" data-fortune-daily-save>＋ Lưu vào lịch sử</button><button type="button" data-fortune-copy="${escapeHtml(`${daily.title}. ${daily.message}`)}">Sao chép</button></div></div></article>
        <article class="fortune-start-card"><span>TRẢI BÀI NHANH</span><h3>Ba góc nhìn cho một điều đang bận tâm</h3><p>Nhập câu hỏi nếu muốn. Câu hỏi chỉ tồn tại trên màn hình và không được lưu vào lịch sử.</p><label><span>Câu hỏi tùy chọn</span><input type="text" maxlength="180" data-fortune-quick-question placeholder="Ví dụ: Mình nên nhìn vấn đề này từ góc nào?"></label><button class="fortune-primary" type="button" data-fortune-quick-draw>Rút 3 lá ngay <b>→</b></button></article>
        <article class="fortune-path-card"><header><span>KHÁM PHÁ</span><strong>8 công cụ tự chiêm nghiệm</strong></header><div>${[["tarot","♢","Tarot nguyên bản"],["zodiac","☼","Cung & con giáp"],["numerology","#","Con số & chu kỳ"],["iching","☯","Gieo sáu hào"],["moon","☾","Chu kỳ Mặt Trăng"],["compatibility","∞","Tương tác biểu tượng"],["journal","✎","Nhật ký riêng tư"],["history","◷","Kết quả đã lưu"]].map(([view, icon, label]) => `<button type="button" data-fortune-view="${view}"><i>${icon}</i><span>${label}</span><b>→</b></button>`).join("")}</div></article>
        <details class="fortune-safety-card" open><summary>Điều cần biết trước khi sử dụng</summary><p>Đây là nội dung giải trí và tự chiêm nghiệm, không phải khoa học dự báo. Không dùng kết quả để thay thế tư vấn y tế, pháp lý, tài chính hoặc quyết định quan trọng. Bạn luôn là người chịu trách nhiệm cho lựa chọn của mình.</p></details>
      </section>`;
  }

  function tarotMarkup(runtime) {
    const cards = runtime.session.tarot || [];
    const results = cards.length ? `<div class="fortune-card-spread" data-fortune-result>${cards.map((card) => `<article class="fortune-tarot-card${card.reversed ? " is-reversed" : ""}" style="--card-accent:${card.color}"><div class="fortune-tarot-face"><small>${escapeHtml(card.position)}</small><i aria-hidden="true">${card.symbol}</i><h3>${escapeHtml(card.name)}</h3><span>${card.reversed ? "Góc khuất" : "Thuận chiều"}</span></div><div class="fortune-tarot-reading"><p>${escapeHtml(card.interpretation)}</p><strong>Câu hỏi mở</strong><p>${escapeHtml(card.question)}</p></div></article>`).join("")}</div><div class="fortune-result-actions"><button type="button" data-fortune-export="txt">Tải TXT</button><button type="button" data-fortune-export="json">Tải JSON</button><button type="button" data-fortune-export="png">Tải PNG</button><button type="button" data-fortune-copy-result>Sao chép</button><button type="button" data-fortune-share>Chia sẻ</button></div>` : `<div class="fortune-empty"><i>♢</i><strong>Chưa có lá bài nào được rút</strong><p>Chọn kiểu trải bài rồi bấm “Rút bài”. Mỗi lần bấm dùng một seed mới và có thể tái tạo từ seed hiển thị.</p></div>`;
    return `${toolbarMarkup("Tarot tự chiêm nghiệm", "Bộ 22 lá nguyên bản do HH biên soạn; không dùng nội dung hoặc hình ảnh từ bộ bài thương mại.")}<section class="fortune-control-panel"><label><span>Chủ đề hoặc câu hỏi (không lưu)</span><input type="text" maxlength="180" data-fortune-tarot-question value="${escapeHtml(runtime.session.question || "")}" placeholder="Bạn muốn soi chiếu điều gì?"></label><label><span>Kiểu trải bài</span><select data-fortune-tarot-count><option value="1"${runtime.session.tarotCount === 1 ? " selected" : ""}>1 lá · Trọng tâm</option><option value="3"${runtime.session.tarotCount === 3 ? " selected" : ""}>3 lá · Bối cảnh / Chú ý / Bước thử</option><option value="5"${runtime.session.tarotCount === 5 ? " selected" : ""}>5 lá · Toàn cảnh và bước an toàn</option></select></label><button class="fortune-primary" type="button" data-fortune-draw>♢ Rút bài</button><small>Seed: <code>${escapeHtml(runtime.session.tarotSeed || "sẽ tạo khi rút")}</code></small></section>${results}`;
  }

  function zodiacMarkup(runtime) {
    const western = runtime.session.western;
    const chinese = runtime.session.chinese;
    return `${toolbarMarkup("Cung hoàng đạo & 12 con giáp", "Tính bằng mốc ngày phổ biến và chu kỳ Can Chi; nội dung tính cách chỉ để tự quan sát.")}<div class="fortune-two-column">
      <section class="fortune-calc-card"><header><i>☼</i><div><small>HOÀNG ĐẠO PHƯƠNG TÂY</small><h3>Tính cung theo ngày sinh</h3></div></header><label><span>Ngày sinh</span><input type="date" data-fortune-zodiac-date autocomplete="bday"></label><button class="fortune-primary" type="button" data-fortune-zodiac-calc>Tính cung</button>${western ? `<div class="fortune-sign-result" data-fortune-result><i>${western.symbol}</i><div><small>${escapeHtml(western.element)} · ${escapeHtml(western.mode)}</small><h3>${escapeHtml(western.name)}</h3><p>${escapeHtml(western.note)}</p></div></div>` : `<p class="fortune-hint">Ngày sinh chỉ được dùng để tính tại chỗ và không được lưu.</p>`}</section>
      <section class="fortune-calc-card"><header><i>◉</i><div><small>CHU KỲ 12 CON GIÁP</small><h3>Tính theo năm âm lịch</h3></div></header><div class="fortune-inline-fields"><label><span>Năm sinh dương lịch</span><input type="number" min="1900" max="2100" inputmode="numeric" data-fortune-chinese-year placeholder="2003"></label><label class="fortune-check"><input type="checkbox" data-fortune-before-tet><span>Sinh trước Tết âm lịch năm đó</span></label></div><button class="fortune-primary" type="button" data-fortune-chinese-calc>Tính con giáp</button>${chinese ? `<div class="fortune-sign-result fortune-sign-result--animal" data-fortune-result><i>${escapeHtml(chinese.branch)}</i><div><small>${escapeHtml(chinese.yinYang)} ${escapeHtml(chinese.element)} · năm chu kỳ ${chinese.cycleYear}</small><h3>${escapeHtml(chinese.animal)} · ${escapeHtml(chinese.branch)}</h3><p>Gợi ý biểu tượng: ${escapeHtml(chinese.note)}.</p></div></div>` : `<p class="fortune-hint">Nếu sinh vào tháng 1–2, hãy kiểm tra ngày Tết âm lịch và đánh dấu chính xác.</p>`}</section>
      <details class="fortune-method-card"><summary>Cách tính và giới hạn</summary><p>Cung hoàng đạo dùng các mốc ngày phổ biến trong chiêm tinh nhiệt đới; người sinh gần ranh giới có thể gặp cách tính khác khi xét giờ và nơi sinh. Con giáp dùng chu kỳ 12 năm, có điều chỉnh “trước Tết” do bạn tự xác nhận. Website không tự suy đoán lịch âm.</p></details>
    </div>`;
  }

  function numerologyMarkup(runtime) {
    const result = runtime.session.numerology;
    const cycles = runtime.session.cycles;
    const nameResult = runtime.session.nameNumerology;
    return `${toolbarMarkup("Thần số học minh bạch", "Công khai từng bước cộng và rút gọn; đây là hệ thống biểu tượng, không phải công cụ đánh giá con người.")}<section class="fortune-numerology"><div class="fortune-calc-card fortune-calc-card--wide"><header><i>#</i><div><small>CÔNG THỨC TẠI CHỖ</small><h3>Ngày sinh, chu kỳ và tên gọi</h3></div></header><div class="fortune-form-grid"><label><span>Ngày sinh</span><input type="date" data-fortune-numerology-date autocomplete="bday" value="${escapeHtml(runtime.session.birthDate || "")}"></label><label><span>Ngày muốn xem chu kỳ</span><input type="date" data-fortune-cycle-date value="${escapeHtml(runtime.session.targetDate || localDateKey())}"></label></div><button class="fortune-primary" type="button" data-fortune-numerology-calc>Tính đường đời và chu kỳ</button><div class="fortune-name-lab"><label><span>Tên dùng để tính riêng (không lưu)</span><input type="text" maxlength="120" data-fortune-name value="${escapeHtml(runtime.session.nameInput || "")}" placeholder="Nhập tên gọi hoặc họ tên"></label><button type="button" data-fortune-name-calc>Tính theo bảng Pythagoras</button></div><p class="fortune-hint">Ngày sinh và tên chỉ tồn tại trong phiên đang mở, không ghi vào localStorage và không gửi lên máy chủ.</p></div>${result ? `<article class="fortune-number-result" data-fortune-result><div><small>CON SỐ ĐƯỜNG ĐỜI</small><strong>${result.lifePath}</strong><span>Số ngày sinh: ${result.birthDay}</span></div><section><span>Công thức</span><code>${escapeHtml(result.formula)}</code><h3>Chủ đề: ${escapeHtml(result.meaning)}</h3><p>Đặc điểm nào phù hợp với trải nghiệm thật của bạn, đặc điểm nào không phù hợp?</p><button type="button" data-fortune-save-current>Lưu phần tóm tắt</button></section></article>` : `<div class="fortune-empty fortune-empty--compact"><i>#</i><strong>Nhập ngày sinh để bắt đầu</strong><p>Kết quả hiển thị tổng chữ số, bước rút gọn và giữ các số 11, 22, 33 theo quy ước đang chọn.</p></div>`}${cycles ? `<article class="fortune-cycle-result"><header><small>CHU KỲ CÁ NHÂN · ${escapeHtml(cycles.targetDate)}</small><h3>Ba nhịp để tự quan sát</h3></header><div><span><b>${cycles.personalYear}</b>Năm · ${escapeHtml(cycles.meanings.year)}</span><span><b>${cycles.personalMonth}</b>Tháng · ${escapeHtml(cycles.meanings.month)}</span><span><b>${cycles.personalDay}</b>Ngày · ${escapeHtml(cycles.meanings.day)}</span></div><details><summary>Xem công thức</summary><code>${escapeHtml(cycles.formula)}</code></details></article>` : ""}${nameResult ? `<article class="fortune-name-result" data-fortune-result><header><small>BẢNG CHỮ CÁI PYTHAGORAS</small><h3>Kết quả từ ${nameResult.letters.length} ký tự Latin hóa</h3></header><div><span><b>${nameResult.expression}</b>Biểu đạt</span><span><b>${nameResult.soul}</b>Nội tâm</span><span><b>${nameResult.personality}</b>Ấn tượng</span></div><details><summary>Xem ba công thức</summary><code>Biểu đạt: ${escapeHtml(nameResult.formulas.expression)}\nNội tâm: ${escapeHtml(nameResult.formulas.soul)}\nẤn tượng: ${escapeHtml(nameResult.formulas.personality)}</code></details></article>` : ""}</section>`;
  }

  function ichingMarkup(runtime) {
    const result = runtime.session.iching;
    return `${toolbarMarkup("Gieo sáu hào", "Mô phỏng phương pháp ba đồng xu bằng bộ sinh số có seed; hiển thị cả quẻ chính và quẻ biến, không gọi là lời tiên tri.")}<section class="fortune-iching"><div class="fortune-calc-card"><header><i>☯</i><div><small>THREE-COIN METHOD</small><h3>Đặt ý niệm rồi gieo quẻ</h3></div></header><label><span>Điều muốn suy ngẫm (không lưu)</span><textarea rows="3" maxlength="240" data-fortune-iching-question placeholder="Viết ngắn gọn điều bạn đang cân nhắc..."></textarea></label><button class="fortune-primary" type="button" data-fortune-iching-cast>Gieo 6 hào</button><small>Seed: <code>${escapeHtml(runtime.session.ichingSeed || "sẽ tạo khi gieo")}</code></small></div>${result ? `<article class="fortune-hexagram" data-fortune-result><div class="fortune-lines" aria-label="Sáu hào, đọc từ dưới lên">${[...result.lines].reverse().map((line, reverseIndex) => `<div class="${line.yang ? "is-yang" : "is-yin"}${line.changing ? " is-changing" : ""}" aria-label="Hào ${6 - reverseIndex}: ${line.yang ? "dương" : "âm"}${line.changing ? ", động" : ""}"><span></span><span></span><b>${line.changing ? "○" : ""}</b></div>`).join("")}</div><section><small>QUẺ CHÍNH · ĐỌC TỪ DƯỚI LÊN</small><h3>${escapeHtml(result.title)}</h3><p>${escapeHtml(result.reflection)}</p><p>${escapeHtml(result.question)}</p><div class="fortune-changed-hexagram"><span>QUẺ BIẾN</span><strong>${escapeHtml(result.changedTitle)}</strong><small>${result.changing.length ? `Hào động: ${result.changing.join(", ")}` : "Sáu hào đang ở trạng thái ổn định trong lần gieo này."}</small></div><button type="button" data-fortune-save-current>Lưu kết quả</button></section></article>` : `<div class="fortune-empty fortune-empty--compact"><i>☯</i><strong>Chưa gieo quẻ</strong><p>Mỗi hào dùng ba đồng xu mô phỏng: ngửa = 3, sấp = 2, tổng tạo giá trị 6–9.</p></div>`}</section>`;
  }

  function moonMarkup(runtime) {
    const result = runtime.session.moon;
    return `${toolbarMarkup("Chu kỳ Mặt Trăng", "Tính pha và phần trăm chiếu sáng theo phép xấp xỉ thiên văn; phần gợi ý chỉ dùng để viết nhật ký.")}<section class="fortune-moon"><div class="fortune-calc-card"><header><i>☾</i><div><small>MOON PHASE LAB</small><h3>Xem pha Mặt Trăng theo ngày</h3></div></header><label><span>Ngày cần xem</span><input type="date" min="1900-01-01" max="2100-12-31" data-fortune-moon-date value="${escapeHtml(runtime.session.moonDate || localDateKey())}"></label><button class="fortune-primary" type="button" data-fortune-moon-calc>Tính pha Mặt Trăng</button><button type="button" data-fortune-moon-today>Chọn hôm nay</button><p class="fortune-hint">Vị trí mọc/lặn phụ thuộc địa điểm và không được tính trong công cụ này.</p></div>${result ? `<article class="fortune-moon-result" data-fortune-result style="--moon-light:${result.illumination}%"><div class="fortune-moon-disc"><i>${escapeHtml(result.symbol)}</i><span>${result.illumination}%</span></div><section><small>${escapeHtml(result.date)} · ${result.waxing ? "Đang sáng dần" : "Đang khuyết dần"}</small><h3>${escapeHtml(result.name)}</h3><p>Tuổi trăng xấp xỉ <strong>${result.ageDays} ngày</strong>. Gợi ý nhật ký: ${escapeHtml(result.reflection)}.</p><dl><div><dt>Chiếu sáng</dt><dd>${result.illumination}%</dd></div><div><dt>Vị trí chu kỳ</dt><dd>${Math.round(result.phase * 100)}%</dd></div></dl><details><summary>Phương pháp và nguồn</summary><p>${escapeHtml(result.method)}</p><a href="https://aa.usno.navy.mil/faq/moon_phases" target="_blank" rel="noopener noreferrer">Định nghĩa pha Mặt Trăng · USNO</a><a href="https://science.nasa.gov/moon/daily-moon-guide/" target="_blank" rel="noopener noreferrer">Daily Moon Guide · NASA</a></details><button type="button" data-fortune-save-current>Lưu phần tóm tắt</button></section></article>` : `<div class="fortune-empty fortune-empty--compact"><i>☾</i><strong>Chọn một ngày để bắt đầu</strong><p>Công cụ trả tám pha truyền thống, tuổi trăng và phần trăm đĩa trăng được chiếu sáng theo mô hình xấp xỉ.</p></div>`}</section>`;
  }

  function compatibilityMarkup(runtime) {
    const result = runtime.session.compatibility;
    return `${toolbarMarkup("Tương tác biểu tượng", "Đặt hai hồ sơ cạnh nhau để tạo câu hỏi giao tiếp; không chấm điểm hợp hay khắc, không dự đoán quan hệ.")}<section class="fortune-compatibility"><div class="fortune-calc-card fortune-calc-card--wide"><header><i>∞</i><div><small>TWO-PROFILE REFLECTION</small><h3>So sánh hai góc nhìn</h3></div></header><div class="fortune-profile-grid"><fieldset><legend>Người A</legend><label><span>Ngày sinh</span><input type="date" data-fortune-compare-a value="${escapeHtml(runtime.session.compareA || "")}"></label><label class="fortune-check"><input type="checkbox" data-fortune-compare-before-a ${runtime.session.compareBeforeA ? "checked" : ""}><span>Sinh trước Tết âm lịch</span></label></fieldset><fieldset><legend>Người B</legend><label><span>Ngày sinh</span><input type="date" data-fortune-compare-b value="${escapeHtml(runtime.session.compareB || "")}"></label><label class="fortune-check"><input type="checkbox" data-fortune-compare-before-b ${runtime.session.compareBeforeB ? "checked" : ""}><span>Sinh trước Tết âm lịch</span></label></fieldset></div><label><span>Bối cảnh</span><select data-fortune-compare-context><option value="relationship"${runtime.session.compareContext === "relationship" ? " selected" : ""}>Mối quan hệ</option><option value="friendship"${runtime.session.compareContext === "friendship" ? " selected" : ""}>Tình bạn</option><option value="team"${runtime.session.compareContext === "team" ? " selected" : ""}>Làm việc nhóm</option></select></label><button class="fortune-primary" type="button" data-fortune-compare>Tạo bản đối chiếu</button><p class="fortune-hint">Ngày sinh chỉ được xử lý trong phiên. Kết quả không phải đánh giá tâm lý hay mức độ tương hợp.</p></div>${result ? `<article class="fortune-compare-result" data-fortune-result><div class="fortune-profile-result"><span>A</span><strong>${escapeHtml(result.first.western.name)} · ${escapeHtml(result.first.chinese.animal)}</strong><small>Đường đời ${result.first.lifePath} · ${escapeHtml(result.first.western.element)}</small></div><div class="fortune-compare-axis">↔</div><div class="fortune-profile-result"><span>B</span><strong>${escapeHtml(result.second.western.name)} · ${escapeHtml(result.second.chinese.animal)}</strong><small>Đường đời ${result.second.lifePath} · ${escapeHtml(result.second.western.element)}</small></div><section><h3>Góc nhìn chung</h3><p>${escapeHtml(result.sharedFocus)}</p><p>${escapeHtml(result.cycleRelation)}</p><strong>Ba câu nên trao đổi trực tiếp</strong><ol>${result.prompts.map((prompt) => `<li>${escapeHtml(prompt)}</li>`).join("")}</ol><button type="button" data-fortune-save-current>Lưu phần tóm tắt không chứa ngày sinh</button></section></article>` : `<div class="fortune-empty fortune-empty--compact"><i>∞</i><strong>Không có điểm số “hợp nhau”</strong><p>Nhập hai ngày sinh để nhận chủ đề khác biệt và ba câu hỏi giao tiếp thực tế.</p></div>`}</section>`;
  }

  function journalMarkup(runtime) {
    return `${toolbarMarkup("Nhật ký suy ngẫm", "Ghi chú được lưu cục bộ theo tài khoản trên thiết bị này; bạn có thể xóa hoặc xuất bất cứ lúc nào.")}<section class="fortune-journal"><form data-fortune-journal-form><label><span>Điều bạn muốn ghi lại</span><textarea rows="5" maxlength="4000" data-fortune-journal-text placeholder="Hôm nay tôi nhận ra..."></textarea></label><div><label><span>Nhãn</span><select data-fortune-journal-tag><option>Suy ngẫm</option><option>Công việc</option><option>Mối quan hệ</option><option>Học tập</option><option>Cảm xúc</option><option>Ý tưởng</option></select></label><button class="fortune-primary" type="submit">＋ Lưu ghi chú</button></div><small data-fortune-journal-count>0 / 4000 ký tự</small></form><div class="fortune-journal-list">${runtime.state.journal.length ? runtime.state.journal.map((item) => `<article><header><span>${escapeHtml(item.tag)}</span><time>${escapeHtml(formatDateTime(item.createdAt))}</time><button type="button" data-fortune-journal-delete="${escapeHtml(item.id)}" aria-label="Xóa ghi chú">×</button></header><p>${escapeHtml(item.text)}</p></article>`).join("") : `<div class="fortune-empty fortune-empty--compact"><i>✎</i><strong>Nhật ký đang trống</strong><p>Ghi lại điều hữu ích thay vì cố ghi nhớ mọi kết quả.</p></div>`}</div>${runtime.state.journal.length ? `<button class="fortune-danger" type="button" data-fortune-clear-journal>Xóa toàn bộ nhật ký</button>` : ""}</section>`;
  }

  function historyMarkup(runtime) {
    const typeLabels = { daily: "Hôm nay", tarot: "Tarot", zodiac: "Cung", chinese: "Con giáp", numerology: "Thần số", iching: "Kinh Dịch", moon: "Mặt Trăng", compatibility: "Tương tác" };
    const options = [...new Set(runtime.state.history.map((item) => item.type))];
    return `${toolbarMarkup("Lịch sử kết quả", "Chỉ lưu phần tóm tắt kết quả; câu hỏi, tên và ngày sinh không được lưu.")}<section class="fortune-history"><div class="fortune-history-tools"><span>${runtime.state.history.length} / ${MAX_HISTORY} kết quả</span><div><button type="button" data-fortune-export-history="json">Xuất JSON</button><button type="button" data-fortune-export-history="txt">Xuất TXT</button>${runtime.state.history.length ? `<button class="fortune-danger" type="button" data-fortune-clear-history>Xóa tất cả</button>` : ""}</div></div>${runtime.state.history.length ? `<div class="fortune-history-filter"><label><span>Tìm kết quả</span><input type="search" data-fortune-history-search value="${escapeHtml(runtime.historyQuery || "")}" placeholder="Tên hoặc nội dung..."></label><label><span>Loại</span><select data-fortune-history-type><option value="all">Tất cả</option>${options.map((type) => `<option value="${escapeHtml(type)}"${runtime.historyType === type ? " selected" : ""}>${escapeHtml(typeLabels[type] || type)}</option>`).join("")}</select></label></div>` : ""}<div class="fortune-history-list" data-fortune-history-list>${runtime.state.history.length ? runtime.state.history.map((item) => `<article data-fortune-history-item data-history-type="${escapeHtml(item.type)}" data-history-search="${escapeHtml(`${item.title} ${item.summary}`.toLocaleLowerCase("vi"))}"><i>${escapeHtml(typeLabels[item.type] || item.type)}</i><div><small>${escapeHtml(formatDateTime(item.createdAt))}</small><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p></div><button type="button" data-fortune-history-delete="${escapeHtml(item.id)}" aria-label="Xóa kết quả">×</button></article>`).join("") : `<div class="fortune-empty"><i>◷</i><strong>Chưa có kết quả đã lưu</strong><p>Kết quả chỉ được thêm khi bạn chủ động bấm lưu hoặc hoàn thành một phép tính.</p><button type="button" data-fortune-view="today">Về Hôm nay</button></div>`}</div><p class="fortune-history-empty-filter" data-fortune-history-empty hidden>Không có kết quả phù hợp bộ lọc.</p></section>`;
  }

  function viewMarkup(runtime) {
    if (runtime.state.view === "tarot") return tarotMarkup(runtime);
    if (runtime.state.view === "zodiac") return zodiacMarkup(runtime);
    if (runtime.state.view === "numerology") return numerologyMarkup(runtime);
    if (runtime.state.view === "iching") return ichingMarkup(runtime);
    if (runtime.state.view === "moon") return moonMarkup(runtime);
    if (runtime.state.view === "compatibility") return compatibilityMarkup(runtime);
    if (runtime.state.view === "journal") return journalMarkup(runtime);
    if (runtime.state.view === "history") return historyMarkup(runtime);
    return todayMarkup(runtime);
  }

  function shellMarkup(runtime) {
    return `<section class="fortune-hub" data-fortune-hub data-view="${escapeHtml(runtime.state.view)}">
      <aside class="fortune-sidebar"><div class="fortune-brand"><i>☾</i><div><small>HH PLATFORM</small><strong>Xem bói</strong></div></div><p>Không gian biểu tượng dành cho giải trí và tự chiêm nghiệm.</p><nav aria-label="Điều hướng Xem bói">${navMarkup(runtime.state.view)}</nav><details class="fortune-privacy"><summary>Riêng tư & an toàn</summary><p>Ngày sinh và câu hỏi không được lưu hoặc gửi đi. Nhật ký và lịch sử nằm trên thiết bị, tách theo tài khoản.</p><button type="button" data-fortune-view="history">Quản lý dữ liệu</button></details></aside>
      <main class="fortune-main"><div class="fortune-mobile-head"><button type="button" data-fortune-nav-toggle aria-label="Mở danh mục">☰</button><strong>☾ Xem bói</strong><button type="button" data-fortune-view="history" aria-label="Mở lịch sử">◷</button></div><div class="fortune-view" data-fortune-view-root>${viewMarkup(runtime)}</div><footer class="fortune-disclaimer"><span>ⓘ</span><p><strong>Nội dung giải trí và tự chiêm nghiệm.</strong> Không phải dự báo khoa học, chẩn đoán hay lời khuyên y tế, pháp lý hoặc tài chính.</p><button type="button" data-fortune-about>Mở hướng dẫn</button></footer></main>
      <div class="fortune-toast" role="status" aria-live="polite" hidden></div>
    </section>`;
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
    } else {
      runtime.root.dataset.view = runtime.state.view;
      const viewRoot = runtime.root.querySelector("[data-fortune-view-root]");
      if (viewRoot) viewRoot.innerHTML = viewMarkup(runtime);
      const nav = runtime.root.querySelector(".fortune-sidebar nav");
      if (nav) nav.innerHTML = navMarkup(runtime.state.view);
      runtime.root.classList.remove("is-nav-open");
      if (runtime.state.view === "history") filterHistoryDom(runtime);
    }
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

  function currentResultText(runtime) {
    const view = runtime.state.view;
    if (view === "tarot" && runtime.session.tarot?.length) return runtime.session.tarot.map((card) => `${card.position}: ${card.name} (${card.reversed ? "Góc khuất" : "Thuận chiều"})\n${card.interpretation}\nCâu hỏi: ${card.question}`).join("\n\n");
    if (view === "numerology" && runtime.session.numerology) return `Con số đường đời ${runtime.session.numerology.lifePath}\n${runtime.session.numerology.formula}\nChủ đề: ${runtime.session.numerology.meaning}${runtime.session.cycles ? `\n${runtime.session.cycles.formula}` : ""}`;
    if (view === "iching" && runtime.session.iching) return `${runtime.session.iching.title}\nQuẻ biến: ${runtime.session.iching.changedTitle}\n${runtime.session.iching.reflection}\n${runtime.session.iching.question}`;
    if (view === "zodiac" && runtime.session.western) return `${runtime.session.western.name} · ${runtime.session.western.element}\n${runtime.session.western.note}`;
    if (view === "zodiac" && runtime.session.chinese) return `${runtime.session.chinese.animal} · ${runtime.session.chinese.branch} · ${runtime.session.chinese.yinYang} ${runtime.session.chinese.element}`;
    if (view === "moon" && runtime.session.moon) return `${runtime.session.moon.name} · ${runtime.session.moon.date}\nChiếu sáng xấp xỉ ${runtime.session.moon.illumination}% · tuổi trăng ${runtime.session.moon.ageDays} ngày\n${runtime.session.moon.method}`;
    if (view === "compatibility" && runtime.session.compatibility) return `${runtime.session.compatibility.sharedFocus}\n${runtime.session.compatibility.cycleRelation}\n${runtime.session.compatibility.prompts.map((prompt) => `- ${prompt}`).join("\n")}`;
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

  function exportResultPng(runtime) {
    if (!globalScope.document) return false;
    const canvas = globalScope.document.createElement("canvas");
    canvas.width = 1200; canvas.height = 1200;
    const context = canvas.getContext("2d");
    if (!context) return false;
    const gradient = context.createLinearGradient(0, 0, 1200, 1200);
    gradient.addColorStop(0, "#14102c"); gradient.addColorStop(0.55, "#30195c"); gradient.addColorStop(1, "#082f45");
    context.fillStyle = gradient; context.fillRect(0, 0, 1200, 1200);
    context.strokeStyle = "rgba(255,255,255,.16)"; context.lineWidth = 2; context.strokeRect(56, 56, 1088, 1088);
    context.fillStyle = "#d9c9ff"; context.font = "700 28px system-ui"; context.fillText("HH · XEM BÓI", 96, 126);
    context.fillStyle = "#ffffff"; context.font = "800 58px system-ui"; context.fillText("Khoảng lặng để tự soi chiếu", 96, 214);
    context.font = "400 34px system-ui";
    const words = currentResultText(runtime).replace(/\n/g, " ").split(/\s+/);
    let line = ""; let y = 310;
    words.forEach((word) => {
      const candidate = `${line}${word} `;
      if (context.measureText(candidate).width > 980 && line) { context.fillText(line, 96, y); line = `${word} `; y += 56; }
      else line = candidate;
    });
    if (line && y < 1040) context.fillText(line, 96, y);
    context.fillStyle = "#b9afd3"; context.font = "500 24px system-ui"; context.fillText("Nội dung giải trí và tự chiêm nghiệm · hoang8.com", 96, 1090);
    const anchor = globalScope.document.createElement("a");
    anchor.download = `hh-xem-boi-${Date.now()}.png`; anchor.href = canvas.toDataURL("image/png"); anchor.click();
    return true;
  }

  async function copyText(text) {
    if (globalScope.navigator?.clipboard?.writeText) { await globalScope.navigator.clipboard.writeText(String(text)); return true; }
    return false;
  }

  function saveCurrent(runtime) {
    const view = runtime.state.view;
    if (view === "numerology" && runtime.session.numerology) return addHistory(runtime, "numerology", `Đường đời ${runtime.session.numerology.lifePath}`, `${runtime.session.numerology.formula}. Chủ đề ${runtime.session.numerology.meaning}.${runtime.session.cycles ? ` ${runtime.session.cycles.formula}.` : ""}`);
    if (view === "iching" && runtime.session.iching) return addHistory(runtime, "iching", runtime.session.iching.title, `Quẻ biến: ${runtime.session.iching.changedTitle}. ${runtime.session.iching.reflection} ${runtime.session.iching.question}`);
    if (view === "zodiac" && runtime.session.western) return addHistory(runtime, "zodiac", runtime.session.western.name, `${runtime.session.western.element} · ${runtime.session.western.mode}. ${runtime.session.western.note}`);
    if (view === "zodiac" && runtime.session.chinese) return addHistory(runtime, "chinese", `${runtime.session.chinese.animal} · ${runtime.session.chinese.branch}`, `${runtime.session.chinese.yinYang} ${runtime.session.chinese.element}. ${runtime.session.chinese.note}.`);
    if (view === "moon" && runtime.session.moon) return addHistory(runtime, "moon", `${runtime.session.moon.name} · ${runtime.session.moon.date}`, `Chiếu sáng xấp xỉ ${runtime.session.moon.illumination}% · tuổi trăng ${runtime.session.moon.ageDays} ngày. ${runtime.session.moon.reflection}.`);
    if (view === "compatibility" && runtime.session.compatibility) return addHistory(runtime, "compatibility", "Bản đối chiếu biểu tượng", `${runtime.session.compatibility.sharedFocus} ${runtime.session.compatibility.cycleRelation}`);
    return null;
  }

  async function handleClick(runtime, event) {
    const viewButton = event.target.closest("[data-fortune-view]");
    if (viewButton) {
      const view = viewButton.dataset.fortuneView;
      if (VIEWS.has(view)) { runtime.state.view = view; writeState(runtime); render(runtime, true); }
      return;
    }
    if (event.target.closest("[data-fortune-nav-toggle]")) { runtime.root.classList.toggle("is-nav-open"); return; }
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
      runtime.session.tarotSeed = `${Date.now()}-${Math.random()}`; runtime.session.tarot = drawTarot(runtime.session.tarotSeed, runtime.session.tarotCount);
      addHistory(runtime, "tarot", `Trải bài ${runtime.session.tarotCount} lá`, runtime.session.tarot.map((card) => `${card.position}: ${card.name}`).join(" · "));
      render(runtime, true); return;
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
      runtime.session.nameNumerology = calculateNameNumerology(runtime.session.nameInput);
      if (!runtime.session.nameNumerology) { showToast(runtime, "Hãy nhập tên có ít nhất 2 chữ cái.", "error"); return; }
      render(runtime, true); return;
    }
    if (event.target.closest("[data-fortune-iching-cast]")) {
      runtime.session.ichingSeed = `${Date.now()}-${Math.random()}`; runtime.session.iching = castIChing(runtime.session.ichingSeed); render(runtime, true); return;
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
    if (deleteJournal) { runtime.state.journal = runtime.state.journal.filter((item) => item.id !== deleteJournal.dataset.fortuneJournalDelete); writeState(runtime); render(runtime, true); return; }
    const deleteHistory = event.target.closest("[data-fortune-history-delete]");
    if (deleteHistory) { runtime.state.history = runtime.state.history.filter((item) => item.id !== deleteHistory.dataset.fortuneHistoryDelete); writeState(runtime); render(runtime, true); return; }
    if (event.target.closest("[data-fortune-clear-journal]")) { if (globalScope.confirm?.("Xóa toàn bộ nhật ký trên thiết bị này?")) { runtime.state.journal = []; writeState(runtime); render(runtime, true); } return; }
    if (event.target.closest("[data-fortune-clear-history]")) { if (globalScope.confirm?.("Xóa toàn bộ lịch sử kết quả?")) { runtime.state.history = []; writeState(runtime); render(runtime, true); } return; }
    const exportHistory = event.target.closest("[data-fortune-export-history]");
    if (exportHistory) {
      const format = exportHistory.dataset.fortuneExportHistory;
      const content = format === "json" ? JSON.stringify({ version: VERSION, exportedAt: new Date().toISOString(), history: runtime.state.history }, null, 2) : runtime.state.history.map((item) => `[${formatDateTime(item.createdAt)}] ${item.title}\n${item.summary}`).join("\n\n");
      downloadFile(`hh-xem-boi-lich-su.${format}`, content, format === "json" ? "application/json" : "text/plain;charset=utf-8"); return;
    }
  }

  function handleSubmit(runtime, event) {
    if (!event.target.matches("[data-fortune-journal-form]")) return;
    event.preventDefault();
    const text = event.target.querySelector("[data-fortune-journal-text]")?.value.trim() || "";
    const tag = event.target.querySelector("[data-fortune-journal-tag]")?.value || "Suy ngẫm";
    if (!text) { showToast(runtime, "Hãy viết nội dung trước khi lưu.", "error"); return; }
    runtime.state.journal = [{ id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text, tag, createdAt: new Date().toISOString() }, ...runtime.state.journal].slice(0, MAX_JOURNAL);
    writeState(runtime); render(runtime, true); showToast(runtime, "Đã lưu ghi chú trên thiết bị.");
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

  function handleInput(runtime, event) {
    if (event.target.matches("[data-fortune-journal-text]")) {
      const counter = runtime.root.querySelector("[data-fortune-journal-count]");
      if (counter) counter.textContent = `${event.target.value.length} / 4000 ký tự`;
      return;
    }
    if (event.target.matches("[data-fortune-history-search]")) { runtime.historyQuery = event.target.value; filterHistoryDom(runtime); return; }
    if (event.target.matches("[data-fortune-history-type]")) { runtime.historyType = event.target.value; filterHistoryDom(runtime); }
  }

  function mount(target, options = {}) {
    if (!target) return false;
    unmount();
    const runtime = {
      target, options, ownerId: resolveOwnerId(options), storage: options.storage || globalScope.localStorage,
      state: null, session: { tarot: [], tarotCount: 3, tarotSeed: "", question: "", western: null, chinese: null, numerology: null, cycles: null, birthDate: "", targetDate: localDateKey(), nameInput: "", nameNumerology: null, iching: null, ichingSeed: "", moonDate: localDateKey(), moon: null, compareA: "", compareB: "", compareBeforeA: false, compareBeforeB: false, compareContext: "relationship", compatibility: null },
      root: null, toastTimer: 0, storageError: false, historyQuery: "", historyType: "all"
    };
    runtime.state = readState(runtime.storage, runtime.ownerId);
    if (VIEWS.has(options.view)) runtime.state.view = options.view;
    runtime.onClick = (event) => { handleClick(runtime, event).catch(() => showToast(runtime, "Tác vụ chưa thể hoàn thành.", "error")); };
    runtime.onSubmit = (event) => handleSubmit(runtime, event);
    runtime.onInput = (event) => handleInput(runtime, event);
    runtime.onChange = (event) => handleInput(runtime, event);
    activeRuntime = runtime;
    render(runtime);
    return true;
  }

  function unmount() {
    if (!activeRuntime) return;
    clearTimeout(activeRuntime.toastTimer);
    if (activeRuntime.root) {
      activeRuntime.root.removeEventListener("click", activeRuntime.onClick);
      activeRuntime.root.removeEventListener("submit", activeRuntime.onSubmit);
      activeRuntime.root.removeEventListener("input", activeRuntime.onInput);
      activeRuntime.root.removeEventListener("change", activeRuntime.onChange);
    }
    if (activeRuntime.target) activeRuntime.target.replaceChildren();
    activeRuntime = null;
  }

  function inspect() {
    return { version: VERSION, mounted: Boolean(activeRuntime), view: activeRuntime?.state?.view || "today", ownerId: activeRuntime?.ownerId || null, historyCount: activeRuntime?.state?.history?.length || 0, journalCount: activeRuntime?.state?.journal?.length || 0 };
  }

  return Object.freeze({ VERSION, STORAGE_SCHEMA, TAROT, WESTERN_ZODIAC, SYNODIC_MONTH_DAYS, hashSeed, createRandom, localDateKey, dailyReading, drawTarot, getWesternZodiac, getChineseZodiac, reduceNumerology, calculateNumerology, calculatePersonalCycles, calculateNameNumerology, calculateMoonPhase, compareSymbolicProfiles, castIChing, normalizeState, storageKey, mount, unmount, inspect });
});
