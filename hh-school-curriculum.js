(function initHHSchoolCurriculum(root) {
  "use strict";

  const VERSION = "2026.08.13-ctgdpt2018-v2";
  const SOURCE = Object.freeze({
    sourceUrl: "https://moet.gov.vn/content/tintuc/Lists/News/Attachments/8421/chuong-trinh-tong-the-ctgdpt-2018.pdf",
    sourceTitle: "Chương trình Giáo dục phổ thông 2018 - Chương trình tổng thể",
    publisher: "Bộ Giáo dục và Đào tạo",
    licenseCode: "REFERENCE_ONLY",
    licenseUrl: "",
    attribution: "Khung yêu cầu cần đạt tham chiếu CTGDPT 2018; nội dung bài học do HH School biên soạn nguyên bản.",
    retrievedAt: "2026-08-13",
    reviewedAt: "2026-08-13",
    reviewerId: "hh-school-editorial",
    allowedForCommercialUse: false,
    allowedToModify: false,
    evidencePath: "docs/education/ctgdpt-2018-sources.md"
  });
  const ORIGINAL = Object.freeze({
    sourceUrl: "https://hoang8.com/#/learn/library",
    sourceTitle: "HH School Original Learning Samples",
    publisher: "HH Platform",
    licenseCode: "HH-ORIGINAL",
    licenseUrl: "https://hoang8.com/terms.html",
    attribution: "Nội dung giáo dục nguyên bản của HH School.",
    retrievedAt: "2026-08-13",
    reviewedAt: "2026-08-13",
    reviewerId: "hh-school-editorial",
    allowedForCommercialUse: true,
    allowedToModify: true,
    evidencePath: "data/hh-school/original-content-manifest.json"
  });

  const subject = (id, name, icon, optional = false, strands = []) => Object.freeze({ id, name, icon, optional, strands });
  const CATALOG = Object.freeze({
    vietnamese: subject("vietnamese", "Tiếng Việt", "V"), literature: subject("literature", "Ngữ văn", "V"),
    math: subject("math", "Toán", "∑"), ethics: subject("ethics", "Đạo đức", "♡"),
    natureSociety: subject("nature-society", "Tự nhiên và Xã hội", "◎"), science: subject("science", "Khoa học", "⚗"),
    naturalScience: subject("natural-science", "Khoa học tự nhiên", "⚗", false, ["Vật lí", "Hóa học", "Sinh học"]),
    historyGeography: subject("history-geography", "Lịch sử và Địa lí", "⌖"), history: subject("history", "Lịch sử", "⌛"),
    geography: subject("geography", "Địa lí", "⌖", true), foreign1: subject("foreign-1", "Ngoại ngữ 1", "A"),
    foreign2: subject("foreign-2", "Ngoại ngữ 2", "A", true), ethnic: subject("ethnic-language", "Tiếng dân tộc thiểu số", "✦", true),
    civic: subject("civic", "Giáo dục công dân", "⚖"), economicsLaw: subject("economics-law", "Giáo dục kinh tế và pháp luật", "⚖", true),
    informaticsTechnology: subject("informatics-technology", "Tin học và Công nghệ", "⌘"),
    informatics: subject("informatics", "Tin học", "⌘", true), technology: subject("technology", "Công nghệ", "⚙", true),
    physics: subject("physics", "Vật lí", "Φ", true), chemistry: subject("chemistry", "Hóa học", "⚗", true), biology: subject("biology", "Sinh học", "❧", true),
    pe: subject("physical-education", "Giáo dục thể chất", "◉"), defense: subject("defense-security", "Giáo dục quốc phòng và an ninh", "◇"),
    music: subject("music", "Âm nhạc", "♫", true), art: subject("art", "Mĩ thuật", "✎", true),
    experience: subject("experience", "Hoạt động trải nghiệm", "☆"), career: subject("experience-career", "Hoạt động trải nghiệm, hướng nghiệp", "☆"),
    local: subject("local-education", "Nội dung giáo dục địa phương", "⌂")
  });

  const primary12 = [CATALOG.vietnamese, CATALOG.math, CATALOG.ethics, CATALOG.natureSociety, CATALOG.pe, CATALOG.music, CATALOG.art, CATALOG.experience, CATALOG.local, { ...CATALOG.foreign1, optional: true }, CATALOG.ethnic];
  const primary3 = [CATALOG.vietnamese, CATALOG.math, CATALOG.foreign1, CATALOG.ethics, CATALOG.natureSociety, CATALOG.informaticsTechnology, CATALOG.pe, CATALOG.music, CATALOG.art, CATALOG.experience, CATALOG.local];
  const primary45 = [CATALOG.vietnamese, CATALOG.math, CATALOG.foreign1, CATALOG.ethics, CATALOG.science, CATALOG.historyGeography, CATALOG.informaticsTechnology, CATALOG.pe, CATALOG.music, CATALOG.art, CATALOG.experience, CATALOG.local];
  const lowerSecondary = [CATALOG.literature, CATALOG.math, CATALOG.foreign1, CATALOG.civic, CATALOG.historyGeography, CATALOG.naturalScience, { ...CATALOG.technology, optional: false }, { ...CATALOG.informatics, optional: false }, CATALOG.pe, CATALOG.music, CATALOG.art, CATALOG.career, CATALOG.local, CATALOG.foreign2, CATALOG.ethnic];
  const highRequired = [CATALOG.literature, CATALOG.math, CATALOG.foreign1, CATALOG.history, CATALOG.pe, CATALOG.defense, CATALOG.career, CATALOG.local];
  const highElectives = [CATALOG.geography, CATALOG.economicsLaw, CATALOG.physics, CATALOG.chemistry, CATALOG.biology, CATALOG.technology, CATALOG.informatics, CATALOG.music, CATALOG.art];

  const GRADES = Object.freeze(Array.from({ length: 12 }, (_, index) => {
    const number = index + 1;
    const stage = number <= 5 ? "Tiểu học" : number <= 9 ? "Trung học cơ sở" : "Trung học phổ thông";
    const subjects = number <= 2 ? primary12 : number === 3 ? primary3 : number <= 5 ? primary45 : number <= 9 ? lowerSecondary : [...highRequired, ...highElectives];
    return Object.freeze({ id: `grade-${number}`, number, name: `Lớp ${number}`, stage, subjects: Object.freeze(subjects.map((item) => Object.freeze({ ...item }))), highSchoolElectives: number >= 10 ? highElectives.map((item) => item.id) : [] });
  }));

  const LESSON_SEEDS = Object.freeze({
    1: ["math", "Cộng trong phạm vi 10", "Dùng vật thật và sơ đồ phần-tổng để giải phép cộng", "3 + 4", "7", ["Gộp 3 chấm và 4 chấm", "Đếm tất cả từ 1 đến 7", "Viết 3 + 4 = 7"]],
    2: ["vietnamese", "Tìm ý chính trong đoạn ngắn", "Nhận biết câu nêu điều quan trọng nhất", "Đoạn văn nói nhiều nhất về điều gì?", "cây phượng", ["Đọc trọn đoạn", "Gạch từ được nhắc lại", "Nói ý chính bằng một câu"]],
    3: ["math", "Phân số là một phần của toàn thể", "Nhận biết tử số và mẫu số qua hình chia đều", "Một hình chia 4 phần, tô 3 phần", "3/4", ["Kiểm tra các phần bằng nhau", "Đếm số phần đã tô", "Viết số tô trên tổng số phần"]],
    4: ["science", "Nước chuyển thể", "Mô tả nóng chảy, bay hơi và ngưng tụ từ quan sát an toàn", "Hơi nước gặp nắp lạnh tạo gì?", "giọt nước", ["Quan sát hiện tượng", "So sánh trước và sau", "Gọi tên sự chuyển thể"]],
    5: ["math", "Cộng số thập phân", "Đặt tính thẳng hàng phần nguyên và phần thập phân", "12,5 + 3,27", "15,77", ["Đặt thẳng dấu phẩy", "Cộng từ phải sang trái", "Giữ dấu phẩy ở cùng cột"]],
    6: ["math", "Số nguyên trên trục số", "So sánh số nguyên bằng vị trí trên trục số", "Số nào lớn hơn: -3 hay -1?", "-1", ["Vẽ trục số", "Đánh dấu hai số", "Số bên phải lớn hơn"]],
    7: ["math", "Hai đại lượng tỉ lệ thuận", "Nhận biết và tính hệ số tỉ lệ trong tình huống thực tế", "3 quyển giá 24 nghìn; 5 quyển giá bao nhiêu?", "40", ["Tính giá một quyển", "Nhân với số quyển mới", "Kiểm tra đơn vị nghìn đồng"]],
    8: ["natural-science", "Áp suất và diện tích tiếp xúc", "Giải thích định tính tác dụng của lực trên các diện tích khác nhau", "Cùng một lực, diện tích nhỏ hơn làm áp suất thế nào?", "tăng", ["Giữ nguyên lực", "So sánh diện tích", "Kết luận áp suất tăng khi diện tích giảm"]],
    9: ["literature", "Luận điểm và bằng chứng", "Xác định luận điểm, lí lẽ và bằng chứng trong văn bản nghị luận", "Bằng chứng có vai trò gì?", "làm rõ và tăng sức thuyết phục", ["Tìm ý kiến trung tâm", "Khoanh dữ kiện hỗ trợ", "Kiểm tra mối liên hệ với luận điểm"]],
    10: ["math", "Đọc đặc trưng của hàm số từ đồ thị", "Xác định giá trị, chiều biến thiên và giao điểm từ đồ thị", "Đồ thị cắt trục tung tại (0;2), f(0) bằng?", "2", ["Xác định trục cần đọc", "Tìm điểm có hoành độ 0", "Đọc tung độ tương ứng"]],
    11: ["literature", "Điểm nhìn trong truyện kể", "Phân tích tác dụng của người kể và điểm nhìn", "Đổi điểm nhìn có thể làm thay đổi điều gì?", "cách người đọc hiểu sự kiện", ["Xác định người kể", "Xác định điều người kể biết", "So sánh thông tin và cảm xúc"]],
    12: ["math", "Đạo hàm và tốc độ biến thiên", "Dùng đạo hàm để mô tả mức thay đổi tức thời", "Nếu s(t)=t² thì s'(3) bằng?", "6", ["Tính đạo hàm s'(t)=2t", "Thay t=3", "Kết luận tốc độ tức thời bằng 6"]]
  });

  const normalizeText = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const checksum = (value) => {
    let hash = 2166136261;
    for (const char of JSON.stringify(value)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
  };
  const gradeBy = (grade) => GRADES.find((item) => item.number === Number(grade) || item.id === grade) || GRADES[0];
  const subjectBy = (id) => Object.values(CATALOG).find((item) => item.id === id) || null;

  function lessonForGrade(gradeNumber) {
    const seed = LESSON_SEEDS[gradeNumber];
    const [subjectId, title, outcome, prompt, answer, method] = seed;
    const lessonId = `g${gradeNumber}-${subjectId}-core-01`;
    const wrong = subjectId === "math" ? "Em chưa đặt hoặc đọc đúng dữ kiện." : "Câu trả lời chưa bám vào bằng chứng trong bài.";
    return Object.freeze({
      gradeId: `grade-${gradeNumber}`, subjectId, topicId: `${subjectId}-foundation`, lessonId,
      title, outcome, prerequisites: gradeNumber === 1 ? [] : [`Hoàn thành kiến thức nền lớp ${gradeNumber - 1}`],
      estimatedMinutes: gradeNumber <= 5 ? 18 : 28, difficulty: gradeNumber <= 5 ? "Nền tảng" : "Thông hiểu",
      contentStatus: "checked", speaker: "HH School", source: ORIGINAL,
      steps: Object.freeze([
        { id: "warmup", label: "Khởi động", body: `Hãy nhớ lại một tình huống gần gũi có liên quan đến: ${title.toLowerCase()}.` },
        { id: "goal", label: "Mục tiêu", body: outcome },
        { id: "core", label: "Kiến thức cốt lõi", body: method.join(" → ") },
        { id: "guided", label: "Ví dụ có hướng dẫn", body: `${prompt}. Thực hiện: ${method.join("; ")}.` },
        { id: "interactive", label: "Hoạt động tương tác", body: "Tự diễn đạt lại cách làm bằng lời của em trước khi xem đáp án." },
        { id: "practice", label: "Luyện tập", body: `Giải nhiệm vụ: ${prompt}` },
        { id: "apply", label: "Vận dụng thực tế", body: "Tạo một ví dụ tương tự từ lớp học, gia đình hoặc khu phố của em." },
        { id: "quickcheck", label: "Kiểm tra nhanh", body: `Đáp án cần đạt: ${answer}. Hãy giải thích vì sao.` },
        { id: "summary", label: "Tóm tắt", body: method.map((item, index) => `${index + 1}. ${item}`).join(" · ") },
        { id: "next", label: "Bài ôn tiếp theo", body: "Ôn lại sau một ngày bằng một câu tương đương, không chỉ học thuộc đáp án." }
      ]),
      workedExample: { prompt, method, answer }, commonMistakes: [wrong, "Bỏ qua bước kiểm tra hoặc không ghi đơn vị/ngữ cảnh."],
      questions: Object.freeze([
        { id: `${lessonId}-q1`, type: "short", prompt, answer, skillId: `${subjectId}-apply`, cognitiveLevel: "vận dụng", difficulty: 2, explanation: `Làm lần lượt: ${method.join("; ")}.`, distractorRationale: "Câu trả lời khác thường do bỏ một bước hoặc đọc sai dữ kiện." },
        { id: `${lessonId}-q2`, type: "single", prompt: "Bước nào nên làm đầu tiên?", options: [method[0], method[method.length - 1], "Đoán đáp án"], answer: "0", skillId: `${subjectId}-method`, cognitiveLevel: "thông hiểu", difficulty: 1, explanation: `Bắt đầu bằng: ${method[0]}.`, distractorRationale: "Cần theo đúng trình tự suy luận." },
        { id: `${lessonId}-q3`, type: "boolean", prompt: `Kết quả cần đạt của ví dụ là “${answer}”.`, options: ["Đúng", "Sai"], answer: "true", skillId: `${subjectId}-recognize`, cognitiveLevel: "nhận biết", difficulty: 1, explanation: `Kết quả mẫu là ${answer}.`, distractorRationale: "Đọc lại ví dụ đã giải." }
      ])
    });
  }

  const COMPANION_BLUEPRINTS = Object.freeze({
    math: {
      title: "Ước lượng và kiểm tra kết quả", outcome: "Biết ước lượng trước khi tính và đối chiếu kết quả với dữ kiện ban đầu.",
      prompt: "Sau khi giải một bài toán, cách kiểm tra đáng tin cậy nhất là gì?", answer: "đối chiếu với dữ kiện",
      method: ["Đọc và gạch dữ kiện", "Ước lượng khoảng kết quả", "Tính rồi đối chiếu với dữ kiện"]
    },
    vietnamese: {
      title: "Ý chính và chi tiết hỗ trợ", outcome: "Nêu được ý chính và chọn đúng chi tiết làm rõ ý chính trong một đoạn phù hợp lứa tuổi.",
      prompt: "Chi tiết hỗ trợ cần liên quan trực tiếp đến điều gì?", answer: "ý chính",
      method: ["Đọc trọn đoạn", "Nói nội dung chính bằng một câu", "Chọn chi tiết làm rõ câu đó"]
    },
    literature: {
      title: "Đọc có bằng chứng", outcome: "Trình bày nhận xét về văn bản và chỉ ra từ ngữ hoặc chi tiết làm bằng chứng.",
      prompt: "Một nhận xét về văn bản thuyết phục cần đi kèm điều gì?", answer: "bằng chứng trong văn bản",
      method: ["Nêu nhận xét", "Tìm chi tiết liên quan", "Giải thích mối liên hệ"]
    },
    "foreign-1": {
      title: "Nghe và phản hồi lịch sự", outcome: "Dùng được một câu đề nghị nhắc lại khi chưa nghe rõ trong tình huống học tập.",
      prompt: "Em nên nói gì bằng tiếng Anh khi muốn người khác nhắc lại?", answer: "Could you repeat, please?",
      method: ["Lắng nghe ý chính", "Nhận ra phần chưa rõ", "Dùng câu đề nghị lịch sự"]
    },
    "nature-society": {
      title: "Quan sát môi trường quanh em", outcome: "Ghi lại một quan sát, phân biệt điều nhìn thấy với điều suy đoán và nêu cách kiểm chứng.",
      prompt: "Bước nào cần làm ngay sau khi quan sát một thay đổi?", answer: "ghi lại dữ liệu",
      method: ["Quan sát an toàn", "Ghi lại dữ liệu", "So sánh rồi mới kết luận"]
    },
    ethics: {
      title: "Lựa chọn có trách nhiệm", outcome: "Nhận ra người bị ảnh hưởng bởi một lựa chọn và giải thích cách ứng xử tôn trọng, an toàn.",
      prompt: "Trước khi quyết định, em nên nghĩ đến điều gì?", answer: "hậu quả với mình và người khác",
      method: ["Nêu tình huống", "Xem ai có thể bị ảnh hưởng", "Chọn cách làm tôn trọng và an toàn"]
    },
    science: {
      title: "Đặt câu hỏi và kiểm chứng", outcome: "Đề xuất được cách quan sát hoặc thử nghiệm đơn giản, an toàn để kiểm tra một dự đoán.",
      prompt: "Khi thử nghiệm, vì sao chỉ nên thay đổi một yếu tố mỗi lần?", answer: "để biết yếu tố nào gây ra thay đổi",
      method: ["Nêu dự đoán", "Chỉ thay đổi một yếu tố", "Ghi dữ liệu và so sánh"]
    },
    "natural-science": {
      title: "Lập luận từ dữ liệu", outcome: "Đọc bảng dữ liệu ngắn, nhận ra xu hướng và viết kết luận không vượt quá bằng chứng.",
      prompt: "Một kết luận khoa học phải dựa chủ yếu vào điều gì?", answer: "dữ liệu quan sát được",
      method: ["Đọc tên đại lượng và đơn vị", "Tìm xu hướng", "Đối chiếu kết luận với dữ liệu"]
    },
    history: {
      title: "Đọc hiểu nguồn lịch sử", outcome: "Phân biệt sự kiện, ý kiến và đặt câu hỏi về nguồn của một thông tin lịch sử.",
      prompt: "Trước khi dùng một tư liệu lịch sử, cần kiểm tra điều gì trước?", answer: "nguồn và bối cảnh",
      method: ["Xác định người tạo tư liệu", "Xác định thời gian và bối cảnh", "Đối chiếu với nguồn khác"]
    }
  });

  function companionLesson(gradeNumber, subjectId, index) {
    const blueprint = COMPANION_BLUEPRINTS[subjectId] || COMPANION_BLUEPRINTS.math;
    const subjectName = subjectBy(subjectId)?.name || subjectId;
    const lessonId = `g${gradeNumber}-${subjectId}-original-${String(index).padStart(2, "0")}`;
    const steps = [
      ["warmup", "Khởi động", `Kể một tình huống em từng cần dùng ${subjectName}.`],
      ["goal", "Mục tiêu", blueprint.outcome],
      ["core", "Kiến thức cốt lõi", blueprint.method.join(" → ")],
      ["guided", "Ví dụ có hướng dẫn", `${blueprint.prompt} Làm lần lượt: ${blueprint.method.join("; ")}.`],
      ["interactive", "Hoạt động tương tác", "Sắp xếp lại ba bước theo đúng trình tự rồi giải thích lựa chọn."],
      ["practice", "Luyện tập", blueprint.prompt],
      ["apply", "Vận dụng thực tế", "Tạo một ví dụ mới từ lớp học, gia đình hoặc cộng đồng của em."],
      ["quickcheck", "Kiểm tra nhanh", "Nêu câu trả lời và một bằng chứng hoặc bước kiểm tra đi kèm."],
      ["summary", "Tóm tắt", blueprint.method.map((item, stepIndex) => `${stepIndex + 1}. ${item}`).join(" · ")],
      ["next", "Ôn tiếp theo", "Lưu lỗi vừa mắc để ôn lại sau một ngày và sau ba ngày."]
    ].map(([id, label, body]) => Object.freeze({ id, label, body }));
    return Object.freeze({
      gradeId: `grade-${gradeNumber}`, subjectId, topicId: `${subjectId}-foundation`, lessonId,
      title: `${subjectName}: ${blueprint.title}`, outcome: blueprint.outcome,
      prerequisites: gradeNumber === 1 ? [] : [`Kiến thức nền phù hợp lớp ${gradeNumber - 1}`],
      estimatedMinutes: gradeNumber <= 5 ? 16 : 24, difficulty: gradeNumber <= 5 ? "Nền tảng" : "Thông hiểu",
      contentStatus: "checked", speaker: "HH School", source: ORIGINAL, steps: Object.freeze(steps),
      workedExample: { prompt: blueprint.prompt, method: blueprint.method, answer: blueprint.answer },
      commonMistakes: ["Trả lời theo phỏng đoán nhưng không kiểm tra dữ kiện.", "Nêu kết quả nhưng không trình bày cách làm hoặc bằng chứng."],
      questions: Object.freeze([
        { id: `${lessonId}-q1`, type: "short", prompt: blueprint.prompt, answer: blueprint.answer, skillId: `${subjectId}-apply`, cognitiveLevel: "vận dụng", difficulty: 2, explanation: `Cách trả lời mẫu: ${blueprint.answer}.`, distractorRationale: "Đọc lại mục tiêu và kiểm tra câu trả lời bằng các bước của bài." },
        { id: `${lessonId}-q2`, type: "single", prompt: "Bước nào nên làm đầu tiên?", options: [blueprint.method[0], blueprint.method[2], "Đoán ngay kết quả"], answer: "0", skillId: `${subjectId}-method`, cognitiveLevel: "thông hiểu", difficulty: 1, explanation: `Hãy bắt đầu bằng: ${blueprint.method[0]}.`, distractorRationale: "Trình tự giúp tránh kết luận khi chưa đủ dữ kiện." },
        { id: `${lessonId}-q3`, type: "boolean", prompt: "Cần kiểm tra câu trả lời bằng dữ kiện hoặc bằng chứng.", options: ["Đúng", "Sai"], answer: "true", skillId: `${subjectId}-verify`, cognitiveLevel: "nhận biết", difficulty: 1, explanation: "Đúng. Kiểm tra là một phần của quá trình học chủ động.", distractorRationale: "Một đáp án chưa được kiểm tra chưa đủ đáng tin cậy." }
      ])
    });
  }

  function supportingLessons(gradeNumber) {
    const main = lessonForGrade(gradeNumber);
    const rotation = gradeNumber <= 2
      ? ["math", "vietnamese", "nature-society", "ethics"]
      : gradeNumber === 3
        ? ["math", "vietnamese", "foreign-1", "nature-society"]
        : gradeNumber <= 5
          ? ["math", "vietnamese", "foreign-1", "science"]
          : gradeNumber <= 9
            ? ["math", "literature", "foreign-1", "natural-science"]
            : ["math", "literature", "foreign-1", "history"];
    const companionIds = rotation.filter((subjectId) => subjectId !== main.subjectId).slice(0, 3);
    return Object.freeze([main, ...companionIds.map((subjectId, index) => companionLesson(gradeNumber, subjectId, index + 2))]);
  }

  function packForGrade(grade) {
    const item = gradeBy(grade);
    const payload = {
      schemaVersion: 1, version: VERSION, grade: item, lessons: supportingLessons(item.number),
      requirements: item.subjects.map((entry) => ({ subjectId: entry.id, outcome: `Phát triển năng lực ${entry.name} phù hợp lớp ${item.number}; yêu cầu chi tiết phải qua biên tập trước khi xuất bản.`, status: "checked" })),
      sources: [SOURCE, ORIGINAL]
    };
    return Object.freeze({ ...payload, checksum: checksum(payload) });
  }

  function search(query, grade) {
    const term = normalizeText(query);
    if (!term) return [];
    const grades = grade ? [gradeBy(grade)] : GRADES;
    return grades.flatMap((item) => packForGrade(item.number).lessons)
      .filter((lesson) => normalizeText(`${lesson.title} ${subjectBy(lesson.subjectId)?.name} ${lesson.outcome}`).includes(term))
      .slice(0, 50);
  }

  const api = Object.freeze({ VERSION, GRADES, CATALOG, SOURCE, ORIGINAL, highRequired, highElectives, gradeBy, subjectBy, packForGrade, lessonForGrade, supportingLessons, search, normalizeText, checksum });
  root.HHSchoolCurriculum = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
