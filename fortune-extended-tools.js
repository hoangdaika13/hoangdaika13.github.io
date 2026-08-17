(function fortuneExtendedToolsModule(scope, factory) {
  "use strict";
  const api = factory(scope || {});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope && typeof scope === "object") scope.HHFortuneExtendedTools = api;
})(typeof window !== "undefined" ? window : globalThis, function createFortuneExtendedTools(globalScope) {
  "use strict";

  const VERSION = "1.0.0";
  const IZTRO_VERSION = "2.6.0";
  const FACE_FIELDS = Object.freeze({
    face: Object.freeze({
      label: "Dáng khuôn mặt",
      options: Object.freeze({
        oval: ["Trái xoan", "Trong thư tịch tướng pháp, dáng cân đối thường được dùng như biểu tượng của khả năng điều hòa nhiều mặt.", "Bạn đang cân bằng điều gì tốt, và điều gì vẫn cần ranh giới rõ hơn?"],
        round: ["Tròn", "Dáng tròn thường được mô tả bằng hình tượng mềm, đầy và dễ tiếp cận; đây là liên tưởng văn hóa, không phải phép đo tính cách.", "Khi nào sự mềm mại giúp cuộc trò chuyện tốt hơn?"],
        square: ["Vuông", "Đường hàm rõ thường được gắn với hình tượng cấu trúc và tính ổn định trong văn hóa dân gian.", "Cấu trúc nào đang hỗ trợ bạn, và cấu trúc nào nên linh hoạt hơn?"],
        long: ["Dài", "Tướng pháp cổ thường liên hệ chiều dọc nổi bật với sự quan sát và chiều sâu; liên hệ này chưa được khoa học xác nhận.", "Bạn cần thêm dữ kiện nào trước khi kết luận?"],
        heart: ["Trái tim / tam giác ngược", "Phần trán rộng và cằm thu thường được đọc như sự chuyển từ ý tưởng sang chọn lọc.", "Ý tưởng nào cần được chuyển thành một bước thử nhỏ?"],
        other: ["Khác / không xác định", "Không ép khuôn mặt thật vào một nhóm cố định; góc máy, biểu cảm và cách gọi có thể làm mô tả thay đổi.", "Mô tả trung tính nào đúng hơn nhãn có sẵn?"]
      })
    }),
    brows: Object.freeze({
      label: "Đường chân mày",
      options: Object.freeze({
        straight: ["Tương đối thẳng", "Đường thẳng thường được dùng như biểu tượng của sự trực tiếp và mạch lạc.", "Thông tin nào cần được nói rõ bằng dữ kiện?"],
        curved: ["Cong mềm", "Đường cong thường gợi hình tượng linh hoạt và chuyển tiếp mềm giữa các ý.", "Bạn có thể diễn đạt cùng một điều theo cách ít đối đầu hơn không?"],
        rising: ["Hướng lên", "Hướng đi lên thường được liên hệ tượng trưng với động lực và nhịp tiến.", "Mục tiêu nào cần tiêu chí dừng để tránh quá sức?"],
        full: ["Đậm / đầy", "Nét đậm thường tạo ấn tượng thị giác mạnh; ấn tượng không đồng nghĩa với đặc điểm nội tâm.", "Người khác có thể đang hiểu sai điều gì chỉ từ ấn tượng ban đầu?"],
        sparse: ["Mảnh / thưa", "Nét mảnh tạo ấn tượng nhẹ và ít chiếm ưu thế hơn trong bố cục khuôn mặt.", "Bạn muốn chủ động thể hiện điều gì rõ hơn bằng lời nói?"],
        other: ["Khác / không xác định", "Không có một chuẩn hình học duy nhất cho chân mày tự nhiên.", "Điều gì thay đổi khi quan sát ở ánh sáng hoặc biểu cảm khác?"]
      })
    }),
    eyes: Object.freeze({
      label: "Cách nhìn / vùng mắt",
      options: Object.freeze({
        open: ["Mở / rõ", "Vùng mắt mở thường tạo ấn tượng chú ý; đó là ấn tượng thị giác, không chứng minh mức độ chân thành.", "Bạn đang thật sự chú ý điều gì trong cuộc trao đổi?"],
        narrow: ["Hẹp / thu", "Vùng mắt thu thường tạo ấn tượng tập trung hoặc dè dặt tùy bối cảnh và biểu cảm.", "Bối cảnh nào đang ảnh hưởng tới cách người khác nhìn bạn?"],
        upturned: ["Đuôi hướng lên", "Đường hướng lên được tướng pháp dân gian dùng như biểu tượng của xu hướng chủ động.", "Bạn có thể kiểm chứng sự chủ động bằng hành vi cụ thể nào?"],
        downturned: ["Đuôi hướng xuống", "Đường hướng xuống có thể tạo ấn tượng trầm hoặc mềm; không dùng để suy luận tâm trạng hay sức khỏe.", "Ấn tượng ban đầu khác trải nghiệm thật của bạn ở điểm nào?"],
        asymmetry: ["Hai bên khác nhau", "Bất đối xứng nhẹ là phổ biến ở khuôn mặt người và có thể tăng do góc nhìn hoặc biểu cảm.", "Bạn có đang đòi hỏi sự hoàn hảo không cần thiết ở ngoại hình không?"],
        other: ["Khác / không xác định", "Không phân loại khi mô tả không rõ giúp tránh ép dữ liệu vào kết luận có sẵn.", "Bạn muốn giữ lại quan sát nào mà chưa cần diễn giải?"]
      })
    }),
    nose: Object.freeze({
      label: "Đường sống mũi",
      options: Object.freeze({
        straight: ["Tương đối thẳng", "Đường thẳng thường được dùng như hình tượng nhất quán trong các mô tả truyền thống.", "Điều gì trong kế hoạch hiện tại cần nhất quán hơn?"],
        rounded: ["Đầu mũi tròn", "Hình tròn thường gợi sự đầy đủ trong biểu tượng dân gian; không liên hệ với tài sản hoặc vận mệnh thực.", "Nguồn lực thật nào bạn đang có thể kiểm kê?"],
        prominent: ["Nổi bật trong tổng thể", "Một đặc điểm nổi bật có thể chi phối ấn tượng đầu tiên nhưng không đại diện toàn bộ con người.", "Bạn muốn người khác hiểu thêm phần nào ngoài ấn tượng đầu?"],
        subtle: ["Nhẹ trong tổng thể", "Đặc điểm ít nổi bật thường nhường trọng tâm thị giác cho vùng khác của khuôn mặt.", "Bạn thường chọn quan sát trước hay lên tiếng trước?"],
        other: ["Khác / không xác định", "Tỷ lệ thay đổi mạnh theo tiêu cự máy ảnh và góc nhìn.", "Có cần giữ kết quả ở mức mô tả thay vì gán nghĩa không?"]
      })
    }),
    mouth: Object.freeze({
      label: "Đường miệng khi thả lỏng",
      options: Object.freeze({
        balanced: ["Hai môi tương đối cân", "Sự cân đối thường được dùng như biểu tượng trao đổi hai chiều.", "Bạn đang nói và lắng nghe theo tỷ lệ nào?"],
        full: ["Đầy", "Nét đầy tạo ấn tượng biểu cảm mạnh hơn trong một số bối cảnh; không cho biết tính cách thật.", "Bạn muốn biểu đạt điều gì cụ thể thay vì để người khác đoán?"],
        thin: ["Mảnh", "Nét mảnh có thể tạo ấn tượng kín hoặc gọn tùy biểu cảm và văn hóa.", "Thông tin nào nên được nói ra thay vì giữ trong giả định?"],
        upturned: ["Khóe hướng lên", "Khóe hướng lên có thể tạo ấn tượng tích cực ngay cả khi khuôn mặt đang thả lỏng.", "Ấn tượng tích cực có đang che một nhu cầu cần nói rõ không?"],
        downturned: ["Khóe hướng xuống", "Khóe hướng xuống không đồng nghĩa với buồn, tiêu cực hay sức khỏe kém.", "Bạn muốn người khác hỏi điều gì thay vì suy đoán từ nét mặt?"],
        other: ["Khác / không xác định", "Biểu cảm tức thời làm thay đổi đường miệng nhiều hơn phần lớn đặc điểm cố định.", "Hãy tách nét cố định khỏi cảm xúc của khoảnh khắc này."]
      })
    })
  });

  const DREAM_SYMBOLS = Object.freeze([
    ["water", ["nước", "biển", "sông", "mưa", "lũ"], "Nước thường được dùng để mô tả mức độ và nhịp của cảm xúc.", ["Nước yên hay chuyển động?", "Bạn đứng trong, ngoài hay quan sát từ xa?"]],
    ["flight", ["bay", "lơ lửng", "trên trời"], "Bay có thể là hình ảnh về khoảng cách, tự do hoặc góc nhìn mới.", ["Bạn điều khiển được hướng bay không?", "Cảm giác là nhẹ nhõm hay mất kiểm soát?"]],
    ["fall", ["rơi", "ngã", "tụt"], "Rơi thường xuất hiện quanh cảm giác mất điểm tựa hoặc chuyển trạng thái.", ["Điều gì xảy ra ngay trước khi rơi?", "Có điểm dừng hoặc người hỗ trợ không?"]],
    ["house", ["nhà", "phòng", "cửa", "hành lang"], "Không gian nhà có thể giúp suy ngẫm về ranh giới, ký ức và cảm giác thuộc về.", ["Căn phòng quen hay lạ?", "Cửa nào mở, khóa hoặc chưa được khám phá?"]],
    ["road", ["đường", "ngã rẽ", "cầu", "tàu", "xe"], "Đường đi là biểu tượng trực quan cho lựa chọn, nhịp tiến và chuyển tiếp.", ["Bạn tự chọn hướng hay bị đưa đi?", "Mục tiêu có rõ hay chỉ có chuyển động?"]],
    ["chase", ["đuổi", "chạy trốn", "bị bắt"], "Bị đuổi có thể gợi một việc đang tránh né, nhưng không tự xác định đó là việc gì.", ["Bạn biết điều gì đang đuổi theo không?", "Nếu dừng lại an toàn, bạn muốn hỏi điều gì?"]],
    ["exam", ["thi", "kiểm tra", "trễ học", "quên bài"], "Giấc mơ kiểm tra thường phù hợp để quan sát áp lực chuẩn bị và tiêu chuẩn tự đặt.", ["Ai là người chấm điểm trong giấc mơ?", "Tiêu chuẩn nào có thật và tiêu chuẩn nào do bạn tự thêm?"]],
    ["fire", ["lửa", "cháy", "khói"], "Lửa có thể tượng trưng cho chuyển hóa, khẩn cấp hoặc năng lượng mạnh tùy cảm giác đi kèm.", ["Lửa sưởi ấm, soi sáng hay phá hủy?", "Điều gì cần được bảo vệ trước tiên?"]],
    ["animal", ["chó", "mèo", "chim", "rắn", "hổ", "cá", "động vật"], "Động vật có thể đại diện cho ký ức, phản xạ hoặc mối quan hệ thật với loài đó.", ["Bạn có trải nghiệm thật nào với loài này?", "Nó hỗ trợ, quan sát hay đe dọa?"]],
    ["lost", ["lạc", "mất đường", "không tìm thấy", "mất đồ"], "Lạc đường phù hợp để xem lại mục tiêu, thông tin thiếu và cảm giác định hướng.", ["Bạn đang tìm nơi, người hay vật gì?", "Dấu hiệu nào đã bị bỏ qua?"]],
    ["teeth", ["răng", "rụng răng", "gãy răng"], "Hình ảnh răng thường gây cảm giác dễ tổn thương hoặc mất kiểm soát; không dùng để chẩn đoán sức khỏe.", ["Cảm giác chính là xấu hổ, đau, sợ hay ngạc nhiên?", "Có áp lực giao tiếp hoặc hình ảnh bản thân gần đây không?"]],
    ["death", ["chết", "đám tang", "mất", "qua đời"], "Cái chết trong mơ thường có thể được đọc như kết thúc hoặc thay đổi biểu tượng, không phải dự báo sự kiện.", ["Điều gì đang kết thúc hoặc đổi vai trò?", "Bạn cần hỗ trợ cảm xúc thực tế nào sau giấc mơ?"]]
  ]);

  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function timeIndex(value) {
    if (!/^\d{2}:\d{2}$/.test(String(value || ""))) return null;
    const [hour, minute] = value.split(":").map(Number);
    if (hour > 23 || minute > 59) return null;
    if (hour === 23) return 12;
    if (hour === 0) return 0;
    return Math.floor((hour + 1) / 2);
  }
  function normalizeStar(star) {
    return { name: String(star?.name || ""), type: String(star?.type || ""), brightness: String(star?.brightness || ""), mutagen: String(star?.mutagen || "") };
  }
  function calculateZiWei(options = {}) {
    const date = String(options.date || ""); const time = String(options.time || ""); const index = timeIndex(time);
    if (!validDate(date) || index == null) return { ok: false, errors: ["Cần ngày và giờ địa phương hợp lệ để lập lá số."] };
    const engine = globalScope.iztro || null;
    if (!engine?.astro?.bySolar) return { ok: false, errors: ["Engine iztro chưa được tải."] };
    const [year, month, day] = date.split("-").map(Number); const gender = options.gender === "female" ? "女" : "男";
    try {
      const source = engine.astro.bySolar(`${year}-${month}-${day}`, index, gender, options.fixLeap !== false, "vi-VN").toJSON();
      return {
        ok: true, engine: `iztro ${IZTRO_VERSION}`, method: "Zi Wei Dou Shu · bySolar · Vietnamese locale", datePolicy: "Ngày và giờ địa phương do người dùng cung cấp; không tự đoán giờ sinh.",
        solarDate: source.solarDate, lunarDate: source.lunarDate, chineseDate: source.chineseDate, time: source.time, timeRange: source.timeRange,
        gender: source.gender, sign: source.sign, zodiac: source.zodiac, soul: source.soul, body: source.body, fiveElementsClass: source.fiveElementsClass,
        bodyPalaceBranch: source.earthlyBranchOfBodyPalace, soulPalaceBranch: source.earthlyBranchOfSoulPalace,
        palaces: source.palaces.map((palace) => ({
          index: palace.index, name: palace.name, heavenlyStem: palace.heavenlyStem, earthlyBranch: palace.earthlyBranch,
          isBodyPalace: Boolean(palace.isBodyPalace), isOriginalPalace: Boolean(palace.isOriginalPalace),
          majorStars: (palace.majorStars || []).map(normalizeStar), minorStars: (palace.minorStars || []).map(normalizeStar),
          adjectiveStars: (palace.adjectiveStars || []).map(normalizeStar), changsheng12: palace.changsheng12, boshi12: palace.boshi12,
          jiangqian12: palace.jiangqian12, suiqian12: palace.suiqian12, decadal: palace.decadal, ages: palace.ages || []
        })),
        provenance: { source: "iztro", version: IZTRO_VERSION, license: "MIT", url: "https://github.com/SylarLong/iztro", language: "vi-VN" },
        limitations: ["Tử Vi là hệ biểu tượng có nhiều trường phái; lá số không chứng minh tính cách hoặc dự báo sự kiện.", "Không dùng cung Tật Ách hoặc tên sao để chẩn đoán sức khỏe.", "Giờ sinh sai có thể đổi Mệnh/Thân và vị trí sao."]
      };
    } catch (error) { return { ok: false, errors: [String(error?.message || "Không thể lập lá số.").slice(0, 240)] }; }
  }
  function physiognomyOptions() {
    return Object.fromEntries(Object.entries(FACE_FIELDS).map(([id, field]) => [id, { label: field.label, options: Object.fromEntries(Object.entries(field.options).map(([key, value]) => [key, value[0]])) }]));
  }
  function createPhysiognomyReflection(values = {}) {
    const observations = Object.entries(FACE_FIELDS).map(([id, field]) => {
      const key = field.options[values[id]] ? values[id] : "other"; const [label, tradition, question] = field.options[key];
      return { id, category: field.label, value: key, label, tradition, question };
    });
    return { ok: true, observations, method: "Người dùng tự mô tả → tách quan sát/diễn giải → câu hỏi kiểm chứng", privacy: "Không dùng camera, không tải ảnh và không tạo mẫu sinh trắc học.", limitations: ["Không suy luận nhân cách, trí tuệ, đạo đức, sức khỏe, dân tộc hoặc vận mệnh từ khuôn mặt.", "Các liên tưởng tướng pháp được trình bày như lịch sử văn hóa, không phải kết luận khoa học."] };
  }
  function analyzeDream(textValue, emotion = "curious") {
    const text = String(textValue || "").trim().slice(0, 2400); if (text.length < 10) return { ok: false, errors: ["Hãy mô tả giấc mơ ít nhất 10 ký tự."] };
    const normalized = text.toLocaleLowerCase("vi"); const matches = DREAM_SYMBOLS.filter(([, keywords]) => keywords.some((keyword) => normalized.includes(keyword))).slice(0, 8).map(([id, keywords, reflection, questions]) => ({ id, matched: keywords.filter((keyword) => normalized.includes(keyword)), reflection, questions }));
    return { ok: true, emotion: String(emotion || "curious"), wordCount: text.split(/\s+/).filter(Boolean).length, matches, prompts: ["Chi tiết nào rõ nhất ngay sau khi tỉnh dậy?", "Cảm xúc trong mơ giống tình huống thật nào gần đây?", "Có cách giải thích đời thường nào trước khi gán ý nghĩa biểu tượng?", "Bạn muốn thử một hành động nhỏ nào sau khi ghi lại?"], privacy: "Nội dung chỉ được xử lý trong trình duyệt, không gửi Gemini và không tự lưu.", limitations: ["Giải mã giấc mơ không dự báo tương lai và không chẩn đoán sức khỏe tâm thần.", "Nếu ác mộng kéo dài hoặc gây khổ sở, nên trao đổi với chuyên gia phù hợp."] };
  }

  return Object.freeze({ VERSION, IZTRO_VERSION, calculateZiWei, physiognomyOptions, createPhysiognomyReflection, analyzeDream });
});
