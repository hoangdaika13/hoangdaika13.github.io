(function fortuneIChing64Module(scope, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope && typeof scope === "object") scope.HHFortuneIChing64 = api;
})(typeof window !== "undefined" ? window : globalThis, function createFortuneIChing64() {
  "use strict";

  const VERSION = "1.0.0";
  const TRIGRAM_ORDER = Object.freeze(["111", "110", "101", "100", "011", "010", "001", "000"]);
  const TRIGRAMS = Object.freeze({
    "111": { name: "Càn", symbol: "☰", nature: "Trời" },
    "110": { name: "Đoài", symbol: "☱", nature: "Đầm" },
    "101": { name: "Ly", symbol: "☲", nature: "Lửa" },
    "100": { name: "Chấn", symbol: "☳", nature: "Sấm" },
    "011": { name: "Tốn", symbol: "☴", nature: "Gió" },
    "010": { name: "Khảm", symbol: "☵", nature: "Nước" },
    "001": { name: "Cấn", symbol: "☶", nature: "Núi" },
    "000": { name: "Khôn", symbol: "☷", nature: "Đất" }
  });
  const PAIR_MATRIX = Object.freeze([
    [1, 43, 14, 34, 9, 5, 26, 11],
    [10, 58, 38, 54, 61, 60, 41, 19],
    [13, 49, 30, 55, 37, 63, 22, 36],
    [25, 17, 21, 51, 42, 3, 27, 24],
    [44, 28, 50, 32, 57, 48, 18, 46],
    [6, 47, 64, 40, 59, 29, 4, 7],
    [33, 31, 56, 62, 53, 39, 52, 15],
    [12, 45, 35, 16, 20, 8, 23, 2]
  ]);
  const NAMES = Object.freeze([
    "Càn", "Khôn", "Truân", "Mông", "Nhu", "Tụng", "Sư", "Tỷ", "Tiểu Súc", "Lý", "Thái", "Bĩ", "Đồng Nhân", "Đại Hữu", "Khiêm", "Dự",
    "Tùy", "Cổ", "Lâm", "Quán", "Phệ Hạp", "Bí", "Bác", "Phục", "Vô Vọng", "Đại Súc", "Di", "Đại Quá", "Khảm", "Ly", "Hàm", "Hằng",
    "Độn", "Đại Tráng", "Tấn", "Minh Di", "Gia Nhân", "Khuê", "Kiển", "Giải", "Tổn", "Ích", "Quải", "Cấu", "Tụy", "Thăng", "Khốn", "Tỉnh",
    "Cách", "Đỉnh", "Chấn", "Cấn", "Tiệm", "Quy Muội", "Phong", "Lữ", "Tốn", "Đoài", "Hoán", "Tiết", "Trung Phu", "Tiểu Quá", "Ký Tế", "Vị Tế"
  ]);
  const THEMES = Object.freeze([
    "Khởi tạo bằng sức mạnh rõ ràng nhưng cần tự kỷ luật.", "Tiếp nhận, nuôi dưỡng và để tiến trình có đất phát triển.", "Khởi đầu còn rối; ưu tiên nền tảng trước tốc độ.", "Chưa biết là điểm bắt đầu của việc học đúng cách.",
    "Chờ có chủ đích, chuẩn bị đủ rồi mới tiến.", "Bất đồng cần dữ kiện, ranh giới và người đối thoại phù hợp.", "Tổ chức nguồn lực quanh một mục tiêu chung.", "Kết nối bền khi sự tin cậy đi cùng trách nhiệm.",
    "Tích lũy nhỏ tạo thay đổi lớn nếu giữ nhịp.", "Đi thận trọng, tôn trọng quy tắc và vị trí của người khác.", "Các phần đang thông nhau; dùng thời thuận để xây nền.", "Dòng chảy đang nghẽn; thu gọn và bảo toàn điều cốt lõi.",
    "Tìm điểm chung mà không xóa khác biệt.", "Nguồn lực lớn cần được dùng minh bạch và có giới hạn.", "Khiêm tốn giúp nhìn đúng khả năng và khoảng trống.", "Năng lượng sẵn có cần một hướng đi cụ thể.",
    "Thích nghi có nguyên tắc, không chạy theo mọi tác động.", "Sửa phần hỏng từ nguyên nhân, không chỉ che triệu chứng.", "Tiến gần để quan sát, hỗ trợ và chịu trách nhiệm.", "Lùi một bước để nhìn toàn cảnh và ảnh hưởng của mình.",
    "Một nút thắt cần quyết định rõ, đúng quy trình.", "Hình thức chỉ hữu ích khi nâng đỡ nội dung thật.", "Điều cũ đang bong ra; đừng xây mới trên nền chưa ổn.", "Quay về điểm đúng và bắt đầu lại bằng bước nhỏ.",
    "Giữ động cơ trong sáng và kiểm tra giả định.", "Tích trữ năng lực, kiến thức và sức bền trước việc lớn.", "Nuôi dưỡng bằng đầu vào lành mạnh và lời nói có trách nhiệm.", "Áp lực vượt ngưỡng; phân tải trước khi cấu trúc gãy.",
    "Đi qua rủi ro bằng tỉnh táo, kỹ năng và hỗ trợ.", "Giữ điều làm sáng nhận thức, tránh phụ thuộc vào vẻ ngoài.", "Sự cảm ứng cần đồng thuận và ranh giới hai chiều.", "Điều bền được tạo bởi nhịp đều, không phải cố sức một lần.",
    "Lùi đúng lúc để bảo toàn tự chủ và chọn lại thời điểm.", "Sức mạnh tăng nhanh cần được điều tiết bằng mục tiêu.", "Tiến lên nhờ năng lực được nhìn thấy và dùng đúng chỗ.", "Bảo vệ ánh sáng bên trong khi môi trường chưa an toàn.",
    "Nề nếp trong nhóm bắt đầu từ vai trò và giao tiếp rõ.", "Khác biệt lộ rõ; tìm phần có thể phối hợp thay vì ép giống nhau.", "Có vật cản; đổi tuyến, xin trợ giúp hoặc giảm tải.", "Tháo nút theo thứ tự, rồi mới tăng tốc.",
    "Giảm phần thừa để dành sức cho điều quan trọng.", "Tăng trưởng tốt khi lợi ích được phân phối và phản hồi liên tục.", "Quyết định cần dứt khoát nhưng không cực đoan.", "Một yếu tố mới xuất hiện; quan sát trước khi trao quyền.",
    "Tập hợp quanh giá trị chung, tránh đồng thuận hình thức.", "Đi lên từng tầng bằng năng lực đã kiểm chứng.", "Nguồn lực bị bó; tập trung vào phần còn kiểm soát được.", "Quay lại nguồn, bảo dưỡng hệ thống tạo ra giá trị.",
    "Thay đổi luật chơi khi nền cũ không còn phục vụ mục tiêu.", "Tái cấu trúc để nhiều thành phần tạo ra giá trị mới.", "Cú đánh thức đòi hỏi phản ứng bình tĩnh và nhanh.", "Dừng đúng chỗ để thân tâm và quyết định cùng ổn định.",
    "Phát triển tuần tự, để mỗi bước đủ vững cho bước sau.", "Một chuyển tiếp quan hệ cần kỳ vọng và cam kết rõ.", "Cao điểm nhiều ánh sáng cũng dễ che khuất giới hạn.", "Ở nơi tạm thời, giữ hành trang gọn và nguyên tắc rõ.",
    "Ảnh hưởng bằng sự bền bỉ, tinh tế và nhất quán.", "Trao đổi cởi mở nhưng không né tránh điều khó nói.", "Phân tán bế tắc bằng mục tiêu chung và thông tin rõ.", "Giới hạn tốt giúp năng lượng đi đúng hướng.",
    "Sự chân thành cần được kiểm chứng bằng hành động lặp lại.", "Việc nhỏ cần độ chính xác; tránh mở rộng quá sớm.", "Việc đã xong vẫn cần kiểm tra và bảo trì.", "Chưa hoàn tất; giữ chú ý đến bước cuối và điều kiện chuyển giao."
  ]);

  function hexagramNumber(lowerBits, upperBits) {
    const row = TRIGRAM_ORDER.indexOf(String(lowerBits));
    const column = TRIGRAM_ORDER.indexOf(String(upperBits));
    return row < 0 || column < 0 ? null : PAIR_MATRIX[row][column];
  }

  function hexagramForBits(bitsValue) {
    const bits = String(bitsValue || "");
    if (!/^[01]{6}$/.test(bits)) return null;
    const lowerBits = bits.slice(0, 3);
    const upperBits = bits.slice(3, 6);
    const number = hexagramNumber(lowerBits, upperBits);
    return {
      number,
      name: NAMES[number - 1],
      lower: TRIGRAMS[lowerBits],
      upper: TRIGRAMS[upperBits],
      bits,
      title: `Quẻ ${number} · ${NAMES[number - 1]}`,
      structure: `${TRIGRAMS[upperBits].symbol} ${TRIGRAMS[upperBits].name} trên ${TRIGRAMS[lowerBits].symbol} ${TRIGRAMS[lowerBits].name}`,
      theme: THEMES[number - 1],
      attribution: "Diễn giải nguyên bản do HH biên soạn từ cấu trúc quẻ; không sao chép bản dịch thương mại."
    };
  }

  function nuclearBits(bitsValue) {
    const bits = String(bitsValue || "");
    return /^[01]{6}$/.test(bits) ? `${bits.slice(1, 4)}${bits.slice(2, 5)}` : "";
  }

  function lineReflection(lineNumber, yang, changing) {
    const phases = ["đặt nền", "đi vào tương tác", "đối diện điểm chuyển", "thử vai trò mới", "chịu trách nhiệm ở trung tâm", "khép chu kỳ và tránh quá đà"];
    const direction = yang ? "chủ động" : "tiếp nhận";
    return `Hào ${lineNumber} gợi ý ${phases[lineNumber - 1]} bằng cách ${direction}${changing ? "; đây là phần đang đổi nên cần quan sát hệ quả trước khi hành động" : "; trạng thái chưa đổi nên ưu tiên tính nhất quán"}.`;
  }

  const HEXAGRAMS = Object.freeze(NAMES.map((name, index) => Object.freeze({ number: index + 1, name, theme: THEMES[index] })));
  return Object.freeze({ VERSION, TRIGRAMS, HEXAGRAMS, hexagramNumber, hexagramForBits, nuclearBits, lineReflection });
});
