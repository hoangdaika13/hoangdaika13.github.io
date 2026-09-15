(function initHHChineseCurriculum(root) {
  "use strict";

  const VERSION = 1;
  const EDITORIAL_STATUS = "hh-authored-needs-linguist-review";
  const REVIEWED_AT = "2026-09-15";
  const makeWord = function (row) {
    return {
      id: row[0], hanzi: row[1], traditional: row[2], pinyin: row[3], meaning: row[4],
      level: row[5], sublevel: row[6] || row[5], pos: row[7], example: row[8], exampleVi: row[9],
      strokes: row[10], tones: [], source: "HH Chinese curriculum v1",
      editorialStatus: EDITORIAL_STATUS, reviewedAt: REVIEWED_AT
    };
  };

  const LEVEL_PACKS = Object.freeze([
    { id: "level-1", level: 1, band: "sơ cấp", title: "Nền tảng sinh tồn", status: EDITORIAL_STATUS, focus: ["âm và thanh", "câu đơn", "chào hỏi", "số và thời gian"] },
    { id: "level-2", level: 2, band: "sơ cấp", title: "Sinh hoạt độc lập", status: EDITORIAL_STATUS, focus: ["trải nghiệm", "đang diễn ra", "so sánh", "mua sắm"] },
    { id: "level-3", level: 3, band: "sơ cấp", title: "Kể chuyện và giải thích", status: EDITORIAL_STATUS, focus: ["trình tự", "bổ ngữ", "nguyên nhân", "kế hoạch"] },
    { id: "level-4", level: 4, band: "trung cấp", title: "Học tập và công việc", status: EDITORIAL_STATUS, focus: ["把 và 被", "nhấn mạnh", "giao tiếp công sở", "đọc đoạn"] },
    { id: "level-5", level: 5, band: "trung cấp", title: "Sử dụng độc lập", status: EDITORIAL_STATUS, focus: ["lập luận", "tóm tắt", "sắc thái", "văn viết"] },
    { id: "level-6", level: 6, band: "trung cấp", title: "Diễn đạt chính xác", status: EDITORIAL_STATUS, focus: ["liên kết ý", "suy luận", "văn bản dài", "dịch theo ngữ cảnh"] },
    { id: "level-7", level: 7, band: "cao cấp", title: "Ngôn ngữ học thuật", status: EDITORIAL_STATUS, focus: ["khái niệm", "bằng chứng", "thuyết trình", "dịch chuyên môn"] },
    { id: "level-8", level: 8, band: "cao cấp", title: "Phân tích chuyên sâu", status: EDITORIAL_STATUS, focus: ["hàm ý", "phản biện", "văn phong", "liên văn hóa"] },
    { id: "level-9", level: 9, band: "cao cấp", title: "Vận dụng chuyên nghiệp", status: EDITORIAL_STATUS, focus: ["tổng hợp", "diễn giải", "đàm phán", "biên tập"] }
  ]);

  // HH-authored learning seeds. These expand the active deck to 100 entries;
  // they are not an official HSK word list and remain flagged for specialist review.
  const VOCABULARY = [
    ["cnc-059", "名字", "名字", "míngzi", "tên", "1", "1", "danh từ", "你的名字是什么？", "Tên của bạn là gì?", 12],
    ["cnc-060", "认识", "認識", "rènshi", "quen; biết", "1", "1", "động từ", "很高兴认识你。", "Rất vui được làm quen với bạn.", 18],
    ["cnc-061", "几", "幾", "jǐ", "mấy; bao nhiêu", "1", "1", "đại từ nghi vấn", "今天星期几？", "Hôm nay là thứ mấy?", 2],
    ["cnc-062", "点", "點", "diǎn", "giờ; điểm", "1", "1", "danh từ/lượng từ", "现在八点。", "Bây giờ là tám giờ.", 9],
    ["cnc-063", "想", "想", "xiǎng", "muốn; nghĩ", "1", "1", "động từ năng nguyện", "我想喝茶。", "Tôi muốn uống trà.", 13],
    ["cnc-064", "买", "買", "mǎi", "mua", "1", "1", "động từ", "我想买一本书。", "Tôi muốn mua một quyển sách.", 6],
    ["cnc-065", "正在", "正在", "zhèngzài", "đang", "2", "2", "phó từ", "他正在开会。", "Anh ấy đang họp.", 15],
    ["cnc-066", "去过", "去過", "qùguo", "đã từng đi", "2", "2", "cụm động từ", "我去过上海。", "Tôi đã từng đến Thượng Hải.", 12],
    ["cnc-067", "便宜", "便宜", "piányi", "rẻ", "2", "2", "tính từ", "这件衣服很便宜。", "Bộ quần áo này rất rẻ.", 17],
    ["cnc-068", "附近", "附近", "fùjìn", "gần đây; lân cận", "2", "2", "danh từ", "附近有地铁站吗？", "Gần đây có ga tàu điện không?", 15],
    ["cnc-069", "比较", "比較", "bǐjiào", "tương đối; so sánh", "2", "2", "phó/động từ", "今天比较冷。", "Hôm nay tương đối lạnh.", 17],
    ["cnc-070", "准备", "準備", "zhǔnbèi", "chuẩn bị", "2", "2", "động từ", "我在准备明天的考试。", "Tôi đang chuẩn bị cho bài thi ngày mai.", 13],
    ["cnc-071", "后来", "後來", "hòulái", "sau đó; về sau", "3", "3", "phó từ", "后来我们决定坐火车。", "Sau đó chúng tôi quyết định đi tàu.", 11],
    ["cnc-072", "终于", "終於", "zhōngyú", "cuối cùng", "3", "3", "phó từ", "我终于找到了钥匙。", "Cuối cùng tôi đã tìm thấy chìa khóa.", 15],
    ["cnc-073", "完成", "完成", "wánchéng", "hoàn thành", "3", "3", "động từ", "我已经完成作业了。", "Tôi đã hoàn thành bài tập rồi.", 14],
    ["cnc-074", "习惯", "習慣", "xíguàn", "thói quen; quen với", "3", "3", "danh/động từ", "我习惯早起。", "Tôi quen dậy sớm.", 14],
    ["cnc-075", "联系", "聯繫", "liánxì", "liên lạc", "3", "3", "động từ", "有问题请联系我。", "Có vấn đề xin hãy liên lạc với tôi.", 17],
    ["cnc-076", "解决", "解決", "jiějué", "giải quyết", "3", "3", "động từ", "我们一起解决这个问题。", "Chúng ta cùng giải quyết vấn đề này.", 19],
    ["cnc-077", "负责", "負責", "fùzé", "phụ trách; có trách nhiệm", "4", "4", "động/tính từ", "她负责这个项目。", "Cô ấy phụ trách dự án này.", 14],
    ["cnc-078", "安排", "安排", "ānpái", "sắp xếp", "4", "4", "động từ", "会议安排在下午。", "Cuộc họp được sắp xếp vào buổi chiều.", 12],
    ["cnc-079", "建议", "建議", "jiànyì", "đề xuất; kiến nghị", "4", "4", "danh/động từ", "我建议先做一个小测试。", "Tôi đề xuất trước tiên làm một thử nghiệm nhỏ.", 11],
    ["cnc-080", "适合", "適合", "shìhé", "phù hợp", "4", "4", "động từ", "这个方法很适合初学者。", "Phương pháp này rất phù hợp với người mới.", 15],
    ["cnc-081", "效率", "效率", "xiàolǜ", "hiệu suất", "4", "4", "danh từ", "休息可以提高学习效率。", "Nghỉ ngơi có thể nâng cao hiệu suất học.", 10],
    ["cnc-082", "即使", "即使", "jíshǐ", "cho dù", "4", "4", "liên từ", "即使很忙，他也坚持练习。", "Dù rất bận, anh ấy vẫn kiên trì luyện tập.", 12],
    ["cnc-083", "资源", "資源", "zīyuán", "tài nguyên", "5", "5", "danh từ", "学习资源需要注明来源。", "Tài nguyên học tập cần ghi rõ nguồn.", 17],
    ["cnc-084", "限制", "限制", "xiànzhì", "giới hạn; hạn chế", "5", "5", "danh/động từ", "这项研究有一些限制。", "Nghiên cứu này có một số giới hạn.", 15],
    ["cnc-085", "改善", "改善", "gǎishàn", "cải thiện", "5", "5", "động từ", "反馈帮助我们改善产品。", "Phản hồi giúp chúng tôi cải thiện sản phẩm.", 13],
    ["cnc-086", "参与", "參與", "cānyù", "tham gia", "5", "5", "động từ", "越来越多人参与讨论。", "Ngày càng nhiều người tham gia thảo luận.", 12],
    ["cnc-087", "强调", "強調", "qiángdiào", "nhấn mạnh", "5", "5", "động từ", "报告强调了数据质量。", "Báo cáo nhấn mạnh chất lượng dữ liệu.", 20],
    ["cnc-088", "逐渐", "逐漸", "zhújiàn", "dần dần", "5", "5", "phó từ", "他的表达逐渐自然了。", "Cách diễn đạt của anh ấy dần tự nhiên hơn.", 25],
    ["cnc-089", "依据", "依據", "yījù", "căn cứ; dựa vào", "6", "6", "danh/động từ", "结论必须有可靠的依据。", "Kết luận phải có căn cứ đáng tin cậy.", 12],
    ["cnc-090", "机制", "機制", "jīzhì", "cơ chế", "6", "6", "danh từ", "我们需要理解这个机制。", "Chúng ta cần hiểu cơ chế này.", 14],
    ["cnc-091", "评估", "評估", "pínggū", "đánh giá", "6", "6", "động từ", "团队正在评估方案的效果。", "Nhóm đang đánh giá hiệu quả của phương án.", 20],
    ["cnc-092", "一致", "一致", "yízhì", "nhất quán; đồng nhất", "6", "6", "tính từ", "结果与我们的预测一致。", "Kết quả nhất quán với dự đoán của chúng tôi.", 7],
    ["cnc-093", "差异", "差異", "chāyì", "khác biệt", "6", "6", "danh từ", "两种表达存在细微差异。", "Hai cách diễn đạt có khác biệt nhỏ.", 16],
    ["cnc-094", "由此可见", "由此可見", "yóucǐ kějiàn", "từ đó có thể thấy", "6", "6", "cụm liên kết", "由此可见，语境十分重要。", "Từ đó có thể thấy ngữ cảnh rất quan trọng.", 20],
    ["cnc-095", "严谨", "嚴謹", "yánjǐn", "chặt chẽ; nghiêm cẩn", "7-9", "7", "tính từ", "学术表达必须准确而严谨。", "Diễn đạt học thuật phải chính xác và chặt chẽ.", 20],
    ["cnc-096", "框架", "框架", "kuàngjià", "khung; khuôn khổ", "7-9", "7", "danh từ", "先建立分析框架，再处理细节。", "Trước hết xây dựng khung phân tích rồi xử lý chi tiết.", 18],
    ["cnc-097", "隐含", "隱含", "yǐnhán", "hàm chứa; ngầm chứa", "7-9", "8", "động từ", "这句话隐含着另一层意思。", "Câu này hàm chứa một tầng nghĩa khác.", 18],
    ["cnc-098", "反驳", "反駁", "fǎnbó", "phản bác", "7-9", "8", "động từ", "反驳观点时也要提供证据。", "Khi phản bác quan điểm cũng cần đưa ra bằng chứng.", 16],
    ["cnc-099", "协商", "協商", "xiéshāng", "hiệp thương; trao đổi để thống nhất", "7-9", "9", "động từ", "双方通过协商达成了一致。", "Hai bên đã đạt đồng thuận thông qua trao đổi.", 16],
    ["cnc-100", "统筹", "統籌", "tǒngchóu", "điều phối tổng thể", "7-9", "9", "động từ", "项目负责人需要统筹各项资源。", "Người phụ trách dự án cần điều phối tổng thể các nguồn lực.", 17]
  ].map(makeWord);

  const GRAMMAR = [
    ["gc-01", "吗 · Câu hỏi đúng/sai", "1", "Câu trần thuật + 吗？", "你是学生吗？", "Bạn là học sinh phải không?", "Không giữ đồng thời từ để hỏi và 吗 trong câu hỏi thông thường."],
    ["gc-02", "Vị ngữ tính từ", "1", "Chủ ngữ + 很 + tính từ", "今天很冷。", "Hôm nay rất lạnh.", "Không chèn 是 trực tiếp trước tính từ thông thường."],
    ["gc-03", "Số + lượng từ + danh từ", "1", "Số + lượng từ + danh từ", "我买了三本书。", "Tôi đã mua ba quyển sách.", "Học lượng từ cùng danh từ thay vì dùng 个 cho mọi trường hợp."],
    ["gc-04", "过 · Trải nghiệm", "2", "Động từ + 过 + tân ngữ", "我去过北京。", "Tôi đã từng đến Bắc Kinh.", "过 nói về trải nghiệm, không chỉ một hành động vừa hoàn thành."],
    ["gc-05", "正在 · Đang diễn ra", "2", "Chủ ngữ + 正在 + động từ", "她正在上课。", "Cô ấy đang học.", "Có thể dùng 正在…呢 để nhấn mạnh trạng thái đang diễn ra."],
    ["gc-06", "比 · So sánh", "2", "A + 比 + B + tính từ", "今天比昨天冷。", "Hôm nay lạnh hơn hôm qua.", "Không thêm 很 ngay sau tính từ trong mẫu so sánh cơ bản."],
    ["gc-07", "Bổ ngữ kết quả", "3", "Động từ + 完/到/懂", "我听懂了。", "Tôi đã nghe hiểu.", "Bổ ngữ cho biết kết quả đạt được của hành động."],
    ["gc-08", "Bổ ngữ xu hướng", "3", "Động từ + 来/去", "请进来。", "Xin hãy vào đây.", "来 hướng về phía người nói; 去 hướng ra xa người nói."],
    ["gc-09", "Bổ ngữ khả năng", "3", "Động từ + 得/不 + bổ ngữ", "这个字我看得懂。", "Chữ này tôi có thể đọc hiểu.", "Mẫu diễn tả khả năng đạt kết quả trong điều kiện cụ thể."],
    ["gc-10", "被 · Câu bị động", "4", "Đối tượng + 被 + tác nhân + động từ", "我的手机被他拿走了。", "Điện thoại của tôi đã bị anh ấy cầm đi.", "Chỉ dùng khi góc nhìn bị động hữu ích trong ngữ cảnh."],
    ["gc-11", "是…的 · Nhấn mạnh chi tiết", "4", "Chủ ngữ + 是 + chi tiết + động từ + 的", "我是昨天到的。", "Tôi đến vào hôm qua.", "Mẫu thường nhấn mạnh thời gian, nơi chốn hoặc cách thức của việc đã xảy ra."],
    ["gc-12", "除了…以外…", "4", "除了 A 以外，还/都 B", "除了中文以外，他还会英语。", "Ngoài tiếng Trung, anh ấy còn biết tiếng Anh.", "还 biểu thị bổ sung; 都 biểu thị bao quát phần còn lại."],
    ["gc-13", "即使…也…", "5", "即使 + giả định，主语 + 也 + kết quả", "即使下雨，我们也会出发。", "Dù trời mưa chúng tôi vẫn sẽ xuất phát.", "Nhấn mạnh kết quả không thay đổi dù điều kiện bất lợi."],
    ["gc-14", "与其…不如…", "5", "与其 A，不如 B", "与其等待，不如现在行动。", "Thay vì chờ đợi, tốt hơn là hành động ngay.", "B là lựa chọn người nói đánh giá tốt hơn."],
    ["gc-15", "之所以…是因为…", "5", "之所以 + kết quả，是因为 + nguyên nhân", "他之所以进步快，是因为每天练习。", "Sở dĩ anh ấy tiến bộ nhanh là vì luyện tập mỗi ngày.", "Đưa kết quả lên trước để nhấn mạnh lời giải thích."],
    ["gc-16", "无论…都…", "6", "无论 + điều kiện，主语 + 都 + kết quả", "无论遇到什么问题，我们都要冷静。", "Dù gặp vấn đề gì chúng ta cũng phải bình tĩnh.", "Dùng với từ nghi vấn hoặc các khả năng đối lập."],
    ["gc-17", "既…又…", "6", "既 + đặc điểm A，又 + đặc điểm B", "这个方案既实际又灵活。", "Phương án này vừa thực tế vừa linh hoạt.", "Hai đặc điểm phải song song về cấu trúc."],
    ["gc-18", "由此可见", "6", "Bằng chứng。由此可见，kết luận。", "数据持续增长。由此可见，需求仍然存在。", "Dữ liệu tiếp tục tăng. Từ đó có thể thấy nhu cầu vẫn tồn tại.", "Chỉ dùng khi kết luận thực sự suy ra được từ bằng chứng trước đó."],
    ["gc-19", "诚然…但是…", "7-9", "诚然 + nhượng bộ，但是 + luận điểm chính", "诚然，这种方法有效，但是成本也不能忽视。", "Quả thật phương pháp này hiệu quả, nhưng không thể bỏ qua chi phí.", "Phù hợp văn phong nghị luận trang trọng."],
    ["gc-20", "倘若…则…", "7-9", "倘若 + điều kiện，则 + kết quả", "倘若证据不足，则结论需要调整。", "Nếu bằng chứng chưa đủ thì kết luận cần điều chỉnh.", "Mẫu trang trọng hơn 如果…就…。"],
    ["gc-21", "与此同时", "7-9", "Mệnh đề A。与此同时，mệnh đề B。", "效率提高了。与此同时，风险也有所增加。", "Hiệu suất tăng lên; đồng thời rủi ro cũng tăng phần nào.", "Dùng để nối hai diễn biến xảy ra song song." ]
  ].map(function (row) { return { id: row[0], title: row[1], level: row[2], formula: row[3], example: row[4], translation: row[5], note: row[6], source: "HH Chinese curriculum v1", editorialStatus: EDITORIAL_STATUS }; });

  const GRAMMAR_PRACTICE = [
    { id: "gcp-01", level: "1", prompt: "Viết câu hỏi: Bạn là giáo viên phải không?", answer: "你是老师吗？", alternatives: ["你是老师吗"], hint: "Đặt 吗 ở cuối câu trần thuật." },
    { id: "gcp-02", level: "1", prompt: "Viết câu đúng: Hôm nay rất nóng.", answer: "今天很热。", alternatives: ["今天很热"], hint: "Tính từ làm vị ngữ không cần 是." },
    { id: "gcp-03", level: "2", prompt: "Viết câu: Tôi đã từng đến Bắc Kinh.", answer: "我去过北京。", alternatives: ["我去过北京"], hint: "Dùng 过 sau động từ để nói trải nghiệm." },
    { id: "gcp-04", level: "2", prompt: "Viết câu: Cô ấy đang học.", answer: "她正在上课。", alternatives: ["她在上课。", "她正在学习。"], hint: "正在 đứng trước động từ." },
    { id: "gcp-05", level: "3", prompt: "Viết câu: Tôi đã nghe hiểu rồi.", answer: "我听懂了。", alternatives: ["我已经听懂了。"], hint: "懂 là kết quả của hành động nghe." },
    { id: "gcp-06", level: "3", prompt: "Viết câu: Xin hãy vào đây.", answer: "请进来。", alternatives: ["请进来"], hint: "来 biểu thị hướng về phía người nói." },
    { id: "gcp-07", level: "4", prompt: "Viết câu: Tôi đến vào hôm qua.", answer: "我是昨天到的。", alternatives: ["我是昨天来的。"], hint: "Dùng 是…的 để nhấn mạnh thời gian." },
    { id: "gcp-08", level: "4", prompt: "Viết câu: Ngoài tiếng Trung, anh ấy còn biết tiếng Anh.", answer: "除了中文以外，他还会英语。", alternatives: ["除了中文，他还会英语。"], hint: "还 biểu thị thêm một khả năng." },
    { id: "gcp-09", level: "5", prompt: "Viết câu: Dù trời mưa, chúng tôi vẫn sẽ xuất phát.", answer: "即使下雨，我们也会出发。", alternatives: [], hint: "Ghép 即使 với 也." },
    { id: "gcp-10", level: "5", prompt: "Viết câu: Thay vì chờ đợi, tốt hơn là hành động ngay.", answer: "与其等待，不如现在行动。", alternatives: [], hint: "Phần sau 不如 là lựa chọn tốt hơn." },
    { id: "gcp-11", level: "6", prompt: "Viết câu: Phương án này vừa thực tế vừa linh hoạt.", answer: "这个方案既实际又灵活。", alternatives: [], hint: "Dùng 既…又… cho hai đặc điểm song song." },
    { id: "gcp-12", level: "6", prompt: "Nối kết luận: Dữ liệu tiếp tục tăng; từ đó có thể thấy nhu cầu vẫn tồn tại.", answer: "数据持续增长。由此可见，需求仍然存在。", alternatives: [], hint: "由此可见 mở đầu kết luận có cơ sở." },
    { id: "gcp-13", level: "7-9", prompt: "Viết câu: Nếu bằng chứng chưa đủ thì kết luận cần điều chỉnh.", answer: "倘若证据不足，则结论需要调整。", alternatives: [], hint: "Dùng cặp trang trọng 倘若…则…。" },
    { id: "gcp-14", level: "7-9", prompt: "Viết câu: Hiệu suất tăng; đồng thời rủi ro cũng tăng.", answer: "效率提高了。与此同时，风险也增加了。", alternatives: [], hint: "与此同时 nối hai diễn biến song song." }
  ];

  const READINGS = [
    { id: "cr-04", title: "周末的计划", level: "1", hanzi: "周末我想和朋友去公园。我们上午九点见面，然后一起吃午饭。", pinyin: "Zhōumò wǒ xiǎng hé péngyou qù gōngyuán. Wǒmen shàngwǔ jiǔ diǎn jiànmiàn, ránhòu yìqǐ chī wǔfàn.", vi: "Cuối tuần tôi muốn đi công viên với bạn. Chúng tôi gặp nhau lúc chín giờ sáng rồi cùng ăn trưa." },
    { id: "cr-05", title: "第一次坐地铁", level: "2", hanzi: "今天我第一次坐地铁去公司。虽然人很多，但是比坐公共汽车快。", pinyin: "Jīntiān wǒ dì-yī cì zuò dìtiě qù gōngsī. Suīrán rén hěn duō, dànshì bǐ zuò gōnggòng qìchē kuài.", vi: "Hôm nay lần đầu tôi đi tàu điện đến công ty. Tuy đông người nhưng nhanh hơn đi xe buýt." },
    { id: "cr-06", title: "改变学习习惯", level: "3", hanzi: "以前我只在考试前学习，后来发现很容易忘。现在我每天复习二十分钟，还把错误写成新的句子。", pinyin: "Yǐqián wǒ zhǐ zài kǎoshì qián xuéxí, hòulái fāxiàn hěn róngyì wàng. Xiànzài wǒ měitiān fùxí èrshí fēnzhōng, hái bǎ cuòwù xiě chéng xīn de jùzi.", vi: "Trước đây tôi chỉ học trước kỳ thi rồi nhận ra rất dễ quên. Giờ tôi ôn hai mươi phút mỗi ngày và còn biến lỗi thành câu mới." },
    { id: "cr-07", title: "远程会议", level: "4", hanzi: "为了让远程会议更有效率，主持人提前发了议程，并要求大家把问题写在同一份文件里。", pinyin: "Wèile ràng yuǎnchéng huìyì gèng yǒu xiàolǜ, zhǔchírén tíqián fā le yìchéng, bìng yāoqiú dàjiā bǎ wèntí xiě zài tóng yí fèn wénjiàn lǐ.", vi: "Để cuộc họp từ xa hiệu quả hơn, người chủ trì gửi chương trình trước và yêu cầu mọi người ghi câu hỏi vào cùng một tài liệu." },
    { id: "cr-08", title: "城市里的公共空间", level: "5", hanzi: "公共空间不仅提供休息的地方，也影响人们如何交流。设计者需要考虑不同年龄和能力的人是否都能安全、方便地使用。", pinyin: "Gōnggòng kōngjiān bùjǐn tígōng xiūxi de dìfang, yě yǐngxiǎng rénmen rúhé jiāoliú. Shèjìzhě xūyào kǎolǜ bùtóng niánlíng hé nénglì de rén shìfǒu dōu néng ānquán, fāngbiàn de shǐyòng.", vi: "Không gian công cộng không chỉ cung cấp nơi nghỉ mà còn ảnh hưởng cách con người giao tiếp. Người thiết kế cần cân nhắc liệu người ở các độ tuổi và năng lực khác nhau có thể sử dụng an toàn, thuận tiện hay không." },
    { id: "cr-09", title: "数据不等于结论", level: "6", hanzi: "同一组数据可能支持不同的解释。研究者除了说明结果以外，还应公开样本范围、分析方法以及无法排除的限制。", pinyin: "Tóng yì zǔ shùjù kěnéng zhīchí bùtóng de jiěshì. Yánjiūzhě chúle shuōmíng jiéguǒ yǐwài, hái yīng gōngkāi yàngběn fànwéi, fēnxī fāngfǎ yǐjí wúfǎ páichú de xiànzhì.", vi: "Cùng một bộ dữ liệu có thể hỗ trợ nhiều cách diễn giải. Ngoài việc nêu kết quả, nhà nghiên cứu còn nên công khai phạm vi mẫu, phương pháp phân tích và các giới hạn chưa thể loại trừ." },
    { id: "cr-10", title: "技术与判断", level: "7-9", hanzi: "自动化工具可以提高处理信息的速度，却不能替代对语境、证据质量和潜在影响的判断。真正可靠的决策往往需要技术能力与人的责任意识相互配合。", pinyin: "Zìdònghuà gōngjù kěyǐ tígāo chǔlǐ xìnxī de sùdù, què bùnéng tìdài duì yǔjìng, zhèngjù zhìliàng hé qiánzài yǐngxiǎng de pànduàn.", vi: "Công cụ tự động hóa có thể tăng tốc xử lý thông tin nhưng không thể thay thế phán đoán về ngữ cảnh, chất lượng bằng chứng và tác động tiềm ẩn. Quyết định đáng tin cậy thường cần năng lực kỹ thuật phối hợp với ý thức trách nhiệm của con người." }
  ];

  const READING_QUESTIONS = [
    { id: "crq-04", reading: "cr-04", prompt: "Hai người dự định gặp nhau lúc nào?", options: ["Chín giờ sáng", "Chín giờ tối", "Buổi trưa", "Chiều thứ hai"], answer: 0, explanation: "上午九点见面 nghĩa là gặp lúc chín giờ sáng." },
    { id: "crq-05", reading: "cr-05", prompt: "Vì sao người kể thấy tàu điện tiện?", options: ["Nhanh hơn xe buýt", "Không có ai", "Miễn phí", "Gần nhà hơn"], answer: 0, explanation: "Đoạn văn nói tàu điện 比坐公共汽车快 — nhanh hơn đi xe buýt." },
    { id: "crq-06", reading: "cr-06", prompt: "Người kể thay đổi cách học như thế nào?", options: ["Ôn mỗi ngày và viết lại lỗi", "Chỉ học trước kỳ thi", "Không ghi lỗi", "Chỉ nghe thụ động"], answer: 0, explanation: "Người kể ôn hai mươi phút mỗi ngày và biến lỗi thành câu mới." },
    { id: "crq-07", reading: "cr-07", prompt: "Người chủ trì làm gì trước cuộc họp?", options: ["Gửi chương trình", "Hủy tài liệu", "Tắt câu hỏi", "Đổi công ty"], answer: 0, explanation: "提前发了议程 nghĩa là gửi chương trình họp trước." },
    { id: "crq-08", reading: "cr-08", prompt: "Thiết kế không gian công cộng cần quan tâm điều gì?", options: ["Khả năng sử dụng của nhiều nhóm người", "Chỉ màu sắc", "Chỉ chi phí quảng cáo", "Chỉ người trẻ"], answer: 0, explanation: "Đoạn văn nhấn mạnh độ tuổi, năng lực, an toàn và sự thuận tiện." },
    { id: "crq-09", reading: "cr-09", prompt: "Ngoài kết quả, nghiên cứu nên công khai gì?", options: ["Mẫu, phương pháp và giới hạn", "Chỉ tên tác giả", "Chỉ hình minh họa", "Không cần gì khác"], answer: 0, explanation: "Đây là ba yếu tố được liệt kê trực tiếp trong đoạn." },
    { id: "crq-10", reading: "cr-10", prompt: "Ý chính của bài là gì?", options: ["Công nghệ cần đi cùng phán đoán và trách nhiệm", "Tự động hóa thay thế mọi quyết định", "Ngữ cảnh không quan trọng", "Tốc độ luôn là mục tiêu duy nhất"], answer: 0, explanation: "Câu cuối kết luận năng lực kỹ thuật phải phối hợp với trách nhiệm của con người." }
  ];

  const CONVERSATIONS = [
    { id: "intro", title: "Làm quen", level: "1", goal: "Giới thiệu tên và quê quán", prompt: "Hãy chào, nói tên và cho biết bạn là người Việt Nam.", model: "你好，我叫安，我是越南人。", alternatives: ["你好！我叫安。我来自越南。"], hints: ["我叫… = tôi tên là…", "我是越南人 = tôi là người Việt Nam"] },
    { id: "restaurant", title: "Gọi món", level: "2", goal: "Gọi món và hỏi giá", prompt: "Bạn muốn gọi một bát mì và hỏi tổng cộng bao nhiêu tiền.", model: "我要一碗面，请问一共多少钱？", alternatives: ["我想要一碗面，一共多少钱？"], hints: ["一碗面 = một bát mì", "一共 = tổng cộng"] },
    { id: "directions", title: "Hỏi đường", level: "2", goal: "Hỏi vị trí ga tàu điện", prompt: "Hãy hỏi ga tàu điện gần nhất ở đâu.", model: "请问，最近的地铁站在哪里？", alternatives: ["请问，附近的地铁站怎么走？"], hints: ["最近的 = gần nhất", "怎么走 = đi thế nào"] },
    { id: "school", title: "Ở trường", level: "3", goal: "Xin giáo viên giải thích lại", prompt: "Bạn chưa hiểu và muốn giáo viên giải thích lại một lần.", model: "老师，我还没听懂，请您再解释一遍。", alternatives: ["老师，我不太明白，可以再讲一遍吗？"], hints: ["还没听懂 = vẫn chưa nghe hiểu", "一遍 = một lượt trọn vẹn"] },
    { id: "renting", title: "Thuê nhà", level: "3", goal: "Hỏi tiền thuê và chi phí", prompt: "Hãy hỏi tiền thuê mỗi tháng có bao gồm điện nước không.", model: "请问，每个月的房租包括水电费吗？", alternatives: ["房租里包括水费和电费吗？"], hints: ["房租 = tiền thuê nhà", "包括 = bao gồm"] },
    { id: "phone", title: "Gọi điện", level: "4", goal: "Để lại lời nhắn", prompt: "Người bạn cần gặp đang bận. Hãy nhờ họ gọi lại cho bạn.", model: "麻烦您告诉他有空的时候给我回个电话。", alternatives: ["请让他方便的时候给我回电话。"], hints: ["麻烦您 = phiền anh/chị", "回电话 = gọi lại"] },
    { id: "presentation", title: "Thuyết trình", level: "5", goal: "Mở đầu và nêu cấu trúc", prompt: "Hãy mở đầu bài trình bày và cho biết bạn sẽ nói về ba phần.", model: "大家好，今天我想从三个方面介绍这个问题。", alternatives: ["大家好，我的报告主要分为三个部分。"], hints: ["从三个方面 = từ ba phương diện", "主要分为 = chủ yếu chia thành"] },
    { id: "intercultural", title: "Liên văn hóa", level: "7-9", goal: "Xử lý khác biệt cách hiểu", prompt: "Hãy nói rằng hai bên có thể đang hiểu khác nhau và đề nghị làm rõ khái niệm trước.", model: "双方对这个概念的理解可能不同，我建议先明确它在当前语境中的含义。", alternatives: ["我们可能对这个概念有不同理解，不如先确认这里具体指什么。"], hints: ["当前语境 = ngữ cảnh hiện tại", "明确含义 = làm rõ ý nghĩa"] }
  ];

  const WRITING_PROMPTS = [
    { id: "cwp-05", level: "1", title: "Tự giới thiệu", prompt: "Viết 4–6 câu giới thiệu tên, quê quán, nghề nghiệp và sở thích.", target: "我叫… · 我是… · 我喜欢…", rubric: ["đủ bốn ý", "trật tự câu", "dấu câu"] },
    { id: "cwp-06", level: "2", title: "Một trải nghiệm", prompt: "Viết 60–80 chữ về một nơi bạn đã từng đến và điều bạn thích ở đó.", target: "过 · 了 · 比较", rubric: ["thời gian", "trải nghiệm", "nhận xét"] },
    { id: "cwp-07", level: "3", title: "Thay đổi thói quen", prompt: "Viết 80–100 chữ về một thói quen bạn đã thay đổi và kết quả.", target: "以前 · 后来 · 终于", rubric: ["trình tự", "nguyên nhân", "kết quả"] },
    { id: "cwp-08", level: "4", title: "Đề xuất công việc", prompt: "Viết một email ngắn đề xuất cách cải thiện một cuộc họp.", target: "建议 · 为了 · 把", rubric: ["mục tiêu", "đề xuất cụ thể", "giọng lịch sự"] },
    { id: "cwp-09", level: "7-9", title: "Lập luận cân bằng", prompt: "Viết 180–250 chữ đánh giá lợi ích và rủi ro của tự động hóa, nêu giới hạn của lập luận.", target: "诚然 · 与此同时 · 由此可见", rubric: ["luận điểm", "bằng chứng", "phản biện", "giới hạn"] }
  ];

  const DEEP_READINGS = [
    { id: "cdr-04", level: "1", title: "一个安静的早上", text: "今天是星期六。小林七点起床，先喝水，再去公园走路。公园里人不多，他觉得很安静。", vi: "Hôm nay là thứ bảy. Tiểu Lâm dậy lúc bảy giờ, uống nước rồi đi bộ trong công viên. Công viên không đông, cậu thấy rất yên tĩnh.", questions: ["小林几点起床？", "他为什么觉得公园很安静？"] },
    { id: "cdr-05", level: "2", title: "第一次自己旅行", text: "去年我第一次一个人旅行。出发以前有一点紧张，可是到了以后，我发现问路并没有想象中那么难。这次经历让我更有信心。", vi: "Năm ngoái tôi lần đầu đi du lịch một mình. Trước khi đi hơi căng thẳng, nhưng sau khi đến tôi thấy hỏi đường không khó như tưởng tượng. Trải nghiệm này khiến tôi tự tin hơn.", questions: ["出发前他有什么感觉？", "这次经历带来了什么变化？"] },
    { id: "cdr-06", level: "3", title: "把错误变成材料", text: "很多学习者害怕犯错，所以说话时总是先在心里翻译。其实，把常见错误记录下来，再用正确结构造新句子，错误就能变成下一次练习的材料。", vi: "Nhiều người học sợ sai nên luôn dịch trong đầu trước khi nói. Thực ra, ghi lại lỗi thường gặp rồi đặt câu mới bằng cấu trúc đúng sẽ biến lỗi thành tài liệu cho lần luyện sau.", questions: ["为什么有些人说话前先翻译？", "怎样把错误变成学习材料？"] },
    { id: "cdr-07", level: "4", title: "混合办公的沟通", text: "混合办公给员工更多选择，也带来新的沟通问题。如果重要决定只出现在口头讨论中，没参加会议的人就很难了解背景。因此，团队需要把结论和下一步行动写清楚。", vi: "Làm việc kết hợp mang lại nhiều lựa chọn nhưng cũng tạo vấn đề giao tiếp mới. Nếu quyết định quan trọng chỉ xuất hiện trong trao đổi miệng, người vắng họp khó hiểu bối cảnh. Vì vậy nhóm cần ghi rõ kết luận và bước tiếp theo.", questions: ["混合办公带来了什么问题？", "团队为什么要写清楚结论？"] },
    { id: "cdr-08", level: "5", title: "公共数据与信任", text: "公开数据可以提高透明度，但文件能够下载并不等于公众能够理解。发布者还应说明数据如何收集、哪些群体没有被充分代表，以及指标可能造成什么误解。", vi: "Dữ liệu công khai có thể tăng minh bạch, nhưng tải được tệp không có nghĩa công chúng hiểu được. Bên công bố còn nên giải thích cách thu thập, nhóm nào chưa được đại diện đầy đủ và chỉ số có thể gây hiểu lầm gì.", questions: ["为什么能够下载还不够？", "发布者还应说明哪些限制？"] },
    { id: "cdr-09", level: "7-9", title: "翻译中的等值", text: "翻译并不是逐字替换。所谓等值，往往取决于文本目的、读者知识和具体语境。译者既要解释自己的选择，也要承认某些文化含义无法被完整保留。", vi: "Dịch không phải thay thế từng chữ. Tính tương đương thường phụ thuộc mục đích văn bản, tri thức người đọc và ngữ cảnh. Người dịch vừa phải giải thích lựa chọn vừa thừa nhận một số hàm nghĩa văn hóa không thể giữ trọn.", questions: ["等值取决于哪些因素？", "译者为什么要说明自己的选择？"] }
  ];

  const IDIOMS = [
    { id: "ci-05", level: "3", hanzi: "一步一步", pinyin: "yí bù yí bù", meaning: "từng bước một", example: "别着急，我们一步一步来。", vi: "Đừng vội, chúng ta làm từng bước một.", note: "Khẩu ngữ thông dụng; không phải thành ngữ bốn chữ cổ điển." },
    { id: "ci-06", level: "4", hanzi: "事半功倍", pinyin: "shì bàn gōng bèi", meaning: "bỏ ít công mà đạt hiệu quả gấp đôi", example: "找到合适的方法可以事半功倍。", vi: "Tìm được phương pháp phù hợp có thể đạt hiệu quả cao với ít công hơn.", note: "Dùng khi nói về phương pháp và hiệu suất." },
    { id: "ci-07", level: "4", hanzi: "坚持不懈", pinyin: "jiānchí bú xiè", meaning: "kiên trì không ngừng", example: "学习语言需要坚持不懈。", vi: "Học ngôn ngữ cần kiên trì không ngừng.", note: "Sắc thái tích cực, tương đối trang trọng." },
    { id: "ci-08", level: "5", hanzi: "一目了然", pinyin: "yí mù liǎo rán", meaning: "nhìn một lần là hiểu rõ", example: "这张图让变化趋势一目了然。", vi: "Biểu đồ này khiến xu hướng thay đổi trở nên rõ ràng ngay.", note: "Hay dùng với bảng, biểu đồ và bố cục." },
    { id: "ci-09", level: "5", hanzi: "各有利弊", pinyin: "gè yǒu lì bì", meaning: "mỗi bên đều có lợi và hại", example: "两种方案各有利弊。", vi: "Hai phương án mỗi bên đều có ưu và nhược điểm.", note: "Dùng trong phân tích cân bằng." },
    { id: "ci-10", level: "6", hanzi: "循序渐进", pinyin: "xún xù jiàn jìn", meaning: "tiến dần theo trình tự", example: "课程应该循序渐进地增加难度。", vi: "Khóa học nên tăng độ khó dần theo trình tự.", note: "Phù hợp giáo dục và rèn luyện." },
    { id: "ci-11", level: "6", hanzi: "不言而喻", pinyin: "bù yán ér yù", meaning: "không nói cũng rõ", example: "数据来源的重要性不言而喻。", vi: "Tầm quan trọng của nguồn dữ liệu là điều không cần nói cũng rõ.", note: "Văn viết; tránh dùng để bỏ qua bằng chứng cần thiết." },
    { id: "ci-12", level: "7-9", hanzi: "兼听则明", pinyin: "jiān tīng zé míng", meaning: "nghe nhiều phía thì sáng suốt", example: "处理复杂问题时，兼听则明。", vi: "Khi xử lý vấn đề phức tạp, lắng nghe nhiều phía giúp sáng suốt.", note: "Thường dùng để nhấn mạnh việc tham khảo nhiều góc nhìn." }
  ];

  const EXAM_ITEMS = [
    { id: "ce-10", level: "1", skill: "Nghe hiểu", prompt: "Câu nào phù hợp để hỏi tên một người?", options: ["你叫什么名字？", "你几点名字？", "你哪里名字？", "你多少名字？"], answer: 0, explanation: "你叫什么名字？ là cách hỏi tên thông dụng." },
    { id: "ce-11", level: "2", skill: "Ngữ pháp", prompt: "Chọn câu nói về trải nghiệm đã từng có.", options: ["我去过上海。", "我正在上海。", "我比上海。", "我把上海。"], answer: 0, explanation: "Động từ + 过 biểu thị trải nghiệm." },
    { id: "ce-12", level: "2", skill: "Đọc hiểu", prompt: "附近有地铁站吗？ Người nói muốn biết gì?", options: ["Gần đây có ga tàu điện không", "Tàu mấy giờ chạy", "Vé bao nhiêu tiền", "Ai đang lái tàu"], answer: 0, explanation: "附近 là khu vực lân cận; 有…吗 hỏi có hay không." },
    { id: "ce-13", level: "3", skill: "Ngữ pháp", prompt: "Câu nào thể hiện kết quả nghe hiểu?", options: ["我听懂了。", "我听进来。", "我听比了。", "我听是的。"], answer: 0, explanation: "懂 là bổ ngữ kết quả của 听." },
    { id: "ce-14", level: "3", skill: "Giao tiếp", prompt: "Bạn chưa hiểu giáo viên. Câu nào phù hợp nhất?", options: ["请您再解释一遍。", "你不要解释。", "我已经走了。", "这个很便宜。"], answer: 0, explanation: "Câu đầu lịch sự yêu cầu giải thích lại một lượt." },
    { id: "ce-15", level: "4", skill: "Ngữ pháp", prompt: "Câu nào nhấn mạnh thời gian đã đến?", options: ["我是昨天到的。", "我昨天是到。", "我的昨天到是。", "昨天我的是到。"], answer: 0, explanation: "是…的 nhấn mạnh chi tiết của sự việc đã xảy ra." },
    { id: "ce-16", level: "5", skill: "Liên kết ý", prompt: "Chọn cặp cấu trúc phù hợp với nghĩa “dù…vẫn…”.", options: ["即使…也…", "与其…不如…", "除了…以外…", "之所以…是因为…"], answer: 0, explanation: "即使…也… giữ nguyên kết quả dù điều kiện thay đổi." },
    { id: "ce-17", level: "6", skill: "Lập luận", prompt: "Khi nào nên dùng 由此可见?", options: ["Khi kết luận có thể suy ra từ bằng chứng trước", "Khi đổi chủ đề hoàn toàn", "Khi chưa có dữ liệu", "Khi liệt kê tên riêng"], answer: 0, explanation: "由此可见 giới thiệu kết luận dựa trên phần vừa nêu." },
    { id: "ce-18", level: "7-9", skill: "Dịch thuật", prompt: "Cách hiểu phù hợp nhất của 翻译并不是逐字替换 là gì?", options: ["Dịch không chỉ là thay từng chữ", "Mọi bản dịch phải giữ nguyên trật tự từ", "Không cần quan tâm ngữ cảnh", "Chỉ có một bản dịch hợp lệ"], answer: 0, explanation: "Câu phủ định quan niệm dịch như thay thế từng chữ và mở đường cho đánh giá theo ngữ cảnh." }
  ];

  const TONE_TRAINER = [
    { id: "ctt-07", syllable: "yí ge", meaning: "một cái/người", pattern: "Biến điệu 一", options: ["yī ge", "yí ge", "yǐ ge", "yì ge"], answer: 1, explanation: "一 thường đổi gần thanh 2 trước âm thanh 4." },
    { id: "ctt-08", syllable: "hǎo ma", meaning: "được không", pattern: "Thanh nhẹ", options: ["hǎo mā", "hǎo má", "hǎo ma", "hào mà"], answer: 2, explanation: "Trợ từ 吗 thường mang thanh nhẹ trong lời nói tự nhiên." },
    { id: "ctt-09", syllable: "nǚ", meaning: "nữ", pattern: "Vận mẫu ü", options: ["nǔ", "nǚ", "nù", "nú"], answer: 1, explanation: "Giữ môi tròn như u nhưng vị trí lưỡi gần i; không đọc thành nu." },
    { id: "ctt-10", syllable: "rén", meaning: "người", pattern: "Âm đầu r", options: ["rén", "lén", "zén", "yén"], answer: 0, explanation: "Âm r Quan thoại không đồng nhất với r hoặc gi tiếng Việt; hãy nghe giọng thiết bị và quan sát khẩu hình hướng dẫn." }
  ];

  const TONE_PAIR_DRILLS = [
    { id: "ctp-07", phrase: "我很好", pinyin: "wǒ hěn hǎo", meaning: "tôi rất khỏe", pattern: "3 + 3 + 3", options: ["wó hén hǎo", "wǒ hěn hǎo đọc từng âm tách rời", "wò hèn hào"], answer: 0, note: "Chuỗi nhiều thanh 3 được nhóm theo nhịp; dạng thực tế phụ thuộc ranh giới từ và trọng âm." },
    { id: "ctp-08", phrase: "看一看", pinyin: "kàn yi kàn", meaning: "xem thử", pattern: "一 trong dạng lặp", options: ["kàn yī kàn thật nặng", "kàn yi kàn với 一 nhẹ", "kān yǐ kān"], answer: 1, note: "Trong cấu trúc động từ lặp, 一 thường được đọc nhẹ." },
    { id: "ctp-09", phrase: "不知道", pinyin: "bù zhīdào", meaning: "không biết", pattern: "不 + thanh 1", options: ["bú zhīdào", "bù zhīdào", "bǔ zhìdǎo"], answer: 1, note: "不 giữ thanh 4 khi âm sau không phải thanh 4." },
    { id: "ctp-10", phrase: "学生们", pinyin: "xuéshengmen", meaning: "các học sinh", pattern: "Thanh nhẹ trong hậu tố", options: ["xué shēng mén", "xuéshengmen", "xuě shèng mèn"], answer: 1, note: "生 trong 学生 và hậu tố 们 có thể nhẹ hơn trong dòng nói tự nhiên." }
  ];

  const PRONUNCIATION_CONTRASTS = Object.freeze([
    { id: "pc-z-zh", pair: ["z", "zh"], title: "z / zh", a: "早 zǎo", b: "找 zhǎo", tip: "z đầu lưỡi gần răng; zh cuộn đầu lưỡi ra sau hơn.", question: "Âm đầu của 找 là gì?", options: ["z", "zh"], answer: 1 },
    { id: "pc-c-ch", pair: ["c", "ch"], title: "c / ch", a: "草 cǎo", b: "吵 chǎo", tip: "Cả hai bật hơi; ch có vị trí lưỡi lùi hơn.", question: "Âm đầu của 草 là gì?", options: ["c", "ch"], answer: 0 },
    { id: "pc-s-sh", pair: ["s", "sh"], title: "s / sh", a: "四 sì", b: "是 shì", tip: "sh có độ cuộn lưỡi; tránh đồng nhất cả hai với x/s tiếng Việt.", question: "Âm đầu của 是 là gì?", options: ["s", "sh"], answer: 1 },
    { id: "pc-j-q", pair: ["j", "q"], title: "j / q", a: "鸡 jī", b: "七 qī", tip: "q bật hơi rõ hơn j; vị trí lưỡi của cả hai gần nhau.", question: "Âm đầu bật hơi trong cặp này là gì?", options: ["j", "q"], answer: 1 },
    { id: "pc-q-x", pair: ["q", "x"], title: "q / x", a: "去 qù", b: "续 xù", tip: "q là âm tắc-xát bật hơi; x là âm xát liên tục.", question: "Âm đầu của 去 là gì?", options: ["q", "x"], answer: 0 },
    { id: "pc-l-n", pair: ["l", "n"], title: "l / n", a: "蓝 lán", b: "难 nán", tip: "n có luồng hơi qua mũi; l cho hơi đi hai bên lưỡi.", question: "Âm đầu của 难 là gì?", options: ["l", "n"], answer: 1 },
    { id: "pc-u-uu", pair: ["u", "ü"], title: "u / ü", a: "路 lù", b: "绿 lǜ", tip: "ü giữ môi tròn nhưng lưỡi ở vị trí gần i.", question: "Vận mẫu của 绿 là gì?", options: ["u", "ü"], answer: 1 },
    { id: "pc-an-ang", pair: ["an", "ang"], title: "an / ang", a: "三 sān", b: "桑 sāng", tip: "ang kết thúc bằng âm mũi phía sau; an ở phía trước hơn.", question: "Vận mẫu của 桑 là gì?", options: ["an", "ang"], answer: 1 }
  ]);

  const VIETNAMESE_MODULES = Object.freeze([
    { id: "vb-shi", title: "是 và vị ngữ", summary: "Không dùng 是 trực tiếp trước tính từ thông thường.", wrong: "我是很忙。", correct: "我很忙。", explanation: "是 thường nối chủ ngữ với danh từ; tính từ có thể làm vị ngữ.", question: "Câu nào tự nhiên hơn?", options: ["我是很忙。", "我很忙。"], answer: 1 },
    { id: "vb-order", title: "Trật tự thời gian", summary: "Thời gian thường đứng trước động từ.", wrong: "我去北京明天。", correct: "我明天去北京。", explanation: "Mẫu cơ bản: chủ ngữ → thời gian → động từ → tân ngữ.", question: "Chọn câu đúng.", options: ["我明天去北京。", "我去北京明天。"], answer: 0 },
    { id: "vb-le-guo-zhe", title: "了 · 过 · 着", summary: "Ba trợ từ không tương đương một thì quá khứ chung.", wrong: "我昨天去过北京了。", correct: "我昨天去了北京。", explanation: "了 thường nêu hoàn thành/thay đổi; 过 nói trải nghiệm; 着 mô tả trạng thái tiếp diễn.", question: "Câu nào nói “Tôi đã từng đến Bắc Kinh”?", options: ["我去过北京。", "我去着北京。"], answer: 0 },
    { id: "vb-de", title: "的 · 得 · 地", summary: "Ba chữ cùng đọc de nhưng làm ba việc khác nhau.", wrong: "他说的很快。", correct: "他说得很快。", explanation: "得 nối động từ với bổ ngữ mức độ; 的 bổ nghĩa danh từ; 地 nối trạng từ với động từ.", question: "Chọn chữ đúng: 她高兴__说。", options: ["的", "得", "地"], answer: 2 },
    { id: "vb-ba", title: "Câu 把", summary: "Đưa đối tượng lên trước khi nêu cách xử lý và kết quả.", wrong: "我把书看。", correct: "我把书看完了。", explanation: "Câu 把 thường cần kết quả hoặc tác động rõ, không dừng ở động từ trống.", question: "Câu nào hoàn chỉnh hơn?", options: ["请把门关上。", "请把门关。"], answer: 0 },
    { id: "vb-bei", title: "Câu 被", summary: "Dùng khi góc nhìn bị động quan trọng.", wrong: "雨被下了。", correct: "我的伞被风吹走了。", explanation: "被 cần một đối tượng chịu tác động và một hành động có nghĩa trong ngữ cảnh.", question: "Câu nào dùng 被 phù hợp?", options: ["我的手机被他拿走了。", "我被喜欢中文。"], answer: 0 },
    { id: "vb-measure", title: "Lượng từ", summary: "Học số + lượng từ + danh từ như một cụm.", wrong: "三书", correct: "三本书", explanation: "书 dùng lượng từ 本; không bỏ lượng từ theo thói quen tiếng Việt.", question: "Chọn cụm đúng.", options: ["两张票", "两本票"], answer: 0 },
    { id: "vb-result", title: "Bổ ngữ kết quả", summary: "Phân biệt hành động và kết quả đạt được.", wrong: "我听了，但是没听懂。 không mâu thuẫn", correct: "我听懂了。", explanation: "听 chỉ hành động nghe; 听懂 cho biết đã hiểu được.", question: "Câu nào nghĩa là “Tôi đã đọc xong”?", options: ["我看完了。", "我看来了。"], answer: 0 },
    { id: "vb-direction", title: "Bổ ngữ xu hướng", summary: "来 hướng về người nói, 去 hướng ra xa.", wrong: "你出去来。", correct: "你进来吧。", explanation: "Chọn 来/去 theo điểm nhìn của người nói.", question: "Bạn gọi người bên ngoài vào phòng. Chọn câu phù hợp.", options: ["请进来。", "请进去。"], answer: 0 },
    { id: "vb-compare", title: "So sánh với 比", summary: "Không sao chép nguyên cấu trúc “hơn” của tiếng Việt.", wrong: "今天比昨天很冷。", correct: "今天比昨天冷。", explanation: "Mẫu cơ bản A 比 B + tính từ thường không cần 很.", question: "Chọn câu tự nhiên.", options: ["他比我高。", "他比我很高。"], answer: 0 },
    { id: "vb-tone", title: "Thanh 3 và dấu hỏi", summary: "Dấu hỏi tiếng Việt không phải thanh 3 Quan thoại.", wrong: "Đọc mǎ như một dấu hỏi tiếng Việt cố định", correct: "Nghe đường cao độ và biến điệu theo ngữ cảnh", explanation: "Thanh 3 thay đổi hình dạng trong dòng nói; luyện bằng nghe và đối chiếu đường cao độ.", question: "Khi gặp hai thanh 3 liên tiếp, âm đầu thường gần thanh nào?", options: ["Thanh 1", "Thanh 2", "Thanh 4"], answer: 1 },
    { id: "vb-hanviet", title: "Hán–Việt", summary: "Dùng để gợi liên hệ nghĩa, không để đoán phát âm Quan thoại.", wrong: "Đọc 文化 theo âm “văn hóa”", correct: "文化 · wénhuà · văn hóa", explanation: "Âm Hán–Việt và Pinyin là hai hệ đọc khác nhau; có cả từ đồng hình lệch nghĩa.", question: "Cách học nào an toàn hơn?", options: ["Dùng Hán–Việt gợi nghĩa rồi kiểm tra Pinyin", "Đọc mọi chữ theo âm Hán–Việt"], answer: 0 },
    { id: "vb-address", title: "Xưng hô theo ngữ cảnh", summary: "Tên gọi phụ thuộc vai trò, tuổi và độ thân thiết.", wrong: "Gọi tên trống trong mọi tình huống", correct: "王老师 / 李经理 / 您", explanation: "Khi chưa chắc, họ + chức danh thường an toàn hơn trong ngữ cảnh trang trọng.", question: "Cách gọi lịch sự với giáo viên họ Vương là gì?", options: ["王老师", "王你", "老师王你"], answer: 0 }
  ]);

  const SOURCES = Object.freeze([
    { id: "gf0025", title: "国际中文教育中文水平等级标准 GF0025-2021", url: "https://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/s5987/202103/t20210329_523304.html", license: "official reference; content not copied", applied: "level framework and truthful terminology" },
    { id: "cvdict", title: "CVDICT", url: "https://github.com/ph0ngp/CVDICT", license: "CC BY-SA 4.0", applied: "separate 50K lookup catalog only" }
  ]);

  const api = Object.freeze({
    VERSION: VERSION,
    EDITORIAL_STATUS: EDITORIAL_STATUS,
    REVIEWED_AT: REVIEWED_AT,
    LEVEL_PACKS: LEVEL_PACKS,
    VOCABULARY: VOCABULARY,
    GRAMMAR: GRAMMAR,
    GRAMMAR_PRACTICE: GRAMMAR_PRACTICE,
    READINGS: READINGS,
    READING_QUESTIONS: READING_QUESTIONS,
    CONVERSATIONS: CONVERSATIONS,
    WRITING_PROMPTS: WRITING_PROMPTS,
    DEEP_READINGS: DEEP_READINGS,
    IDIOMS: IDIOMS,
    EXAM_ITEMS: EXAM_ITEMS,
    TONE_TRAINER: TONE_TRAINER,
    TONE_PAIR_DRILLS: TONE_PAIR_DRILLS,
    PRONUNCIATION_CONTRASTS: PRONUNCIATION_CONTRASTS,
    VIETNAMESE_MODULES: VIETNAMESE_MODULES,
    SOURCES: SOURCES
  });

  root.HHChineseCurriculum = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
