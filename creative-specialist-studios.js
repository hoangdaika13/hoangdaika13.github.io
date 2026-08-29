(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const FORMAT = "hh-creative-specialist-studios";
  const VIEWS = Object.freeze([
    "idea-lab",
    "naming-studio",
    "copy-studio",
    "writing-room",
    "campaign-planner",
    "photo-planner",
    "podcast-studio",
    "motion-planner",
    "three-d-planner",
    "portfolio-builder"
  ]);
  const STORAGE_KEYS = Object.freeze({
    "idea-lab": "hh.creative.tool.idea-lab.v1",
    "naming-studio": "hh.creative.tool.naming-studio.v1",
    "copy-studio": "hh.creative.tool.copy-studio.v1",
    "writing-room": "hh.creative.tool.writing-room.v1",
    "campaign-planner": "hh.creative.tool.campaign-planner.v1",
    "photo-planner": "hh.creative.tool.photo-planner.v1",
    "podcast-studio": "hh.creative.tool.podcast-studio.v1",
    "motion-planner": "hh.creative.tool.motion-planner.v1",
    "three-d-planner": "hh.creative.tool.three-d-planner.v1",
    "portfolio-builder": "hh.creative.tool.portfolio-builder.v1"
  });
  const LIMITS = Object.freeze({
    shortText: 180,
    text: 2400,
    longText: 12000,
    history: 12,
    list: 40,
    importBytes: 1024 * 1024
  });
  const mountedRoots = new WeakMap();
  let mountSequence = 0;

  const TOOL_DEFINITIONS = Object.freeze({
    "idea-lab": {
      title: "Idea Lab",
      role: "Mở rộng và sàng lọc hướng sáng tạo",
      description: "Biến một vấn đề thành nhiều hướng ý tưởng có tiêu chí, điểm ưu tiên và thử nghiệm đầu tiên.",
      action: "Tạo bản đồ ý tưởng",
      formats: ["markdown", "csv", "json"],
      fields: [
        { name: "challenge", label: "Vấn đề cần giải quyết", type: "textarea", required: true, placeholder: "Ví dụ: Làm sao giúp người mới duy trì thói quen học 15 phút mỗi ngày?" },
        { name: "audience", label: "Người sử dụng", type: "text", required: true, placeholder: "Sinh viên bận rộn" },
        { name: "constraints", label: "Giới hạn thực tế", type: "textarea", placeholder: "Ngân sách thấp, triển khai trong 2 tuần" },
        { name: "lens", label: "Lăng kính sáng tạo", type: "select", options: ["Cân bằng", "Khác biệt", "Tối giản", "Cộng đồng", "Bền vững"] },
        { name: "count", label: "Số hướng ý tưởng", type: "number", min: 3, max: 12, value: 6 }
      ]
    },
    "naming-studio": {
      title: "Naming Studio",
      role: "Đặt tên và kiểm tra khả năng sử dụng",
      description: "Tạo danh sách tên theo ngữ nghĩa, nhịp đọc và cá tính; mọi kiểm tra là heuristic cục bộ, không giả vờ kiểm tra tên miền.",
      action: "Tạo danh sách tên",
      formats: ["csv", "markdown", "json"],
      fields: [
        { name: "subject", label: "Sản phẩm / dự án", type: "text", required: true, placeholder: "Ứng dụng chăm sóc cây" },
        { name: "audience", label: "Khách hàng chính", type: "text", required: true, placeholder: "Người trẻ sống ở đô thị" },
        { name: "keywords", label: "Từ khóa mong muốn", type: "text", placeholder: "mầm, xanh, gần gũi" },
        { name: "personality", label: "Cá tính tên", type: "select", options: ["Ấm áp", "Hiện đại", "Tinh gọn", "Cao cấp", "Mạnh mẽ"] },
        { name: "language", label: "Phong cách ngôn ngữ", type: "select", options: ["Tiếng Việt", "Quốc tế", "Kết hợp"] },
        { name: "count", label: "Số tên", type: "number", min: 4, max: 16, value: 8 }
      ]
    },
    "copy-studio": {
      title: "Copy Studio",
      role: "Viết thông điệp chuyển đổi theo đúng kênh",
      description: "Soạn headline, nội dung chính, CTA và biến thể có cấu trúc từ lợi ích thật của sản phẩm.",
      action: "Soạn bộ nội dung",
      formats: ["markdown", "html", "json"],
      fields: [
        { name: "product", label: "Sản phẩm / dịch vụ", type: "text", required: true, placeholder: "Khóa học dựng video cơ bản" },
        { name: "audience", label: "Đối tượng", type: "text", required: true, placeholder: "Người mới bắt đầu" },
        { name: "benefit", label: "Lợi ích có thể chứng minh", type: "textarea", required: true, placeholder: "Nắm quy trình dựng một video hoàn chỉnh từ tư liệu có sẵn" },
        { name: "proof", label: "Bằng chứng / cơ chế", type: "textarea", placeholder: "12 bài thực hành và file dự án mẫu" },
        { name: "channel", label: "Kênh xuất bản", type: "select", options: ["Landing page", "Facebook", "Email", "YouTube", "TikTok"] },
        { name: "tone", label: "Giọng điệu", type: "select", options: ["Rõ ràng", "Gần gũi", "Chuyên nghiệp", "Truyền cảm hứng", "Ngắn gọn"] },
        { name: "cta", label: "Hành động mong muốn", type: "text", placeholder: "Xem bài học thử" }
      ]
    },
    "writing-room": {
      title: "Writing Room",
      role: "Lập dàn ý và viết bản thảo dài",
      description: "Tạo cấu trúc, bản nháp khởi đầu và checklist biên tập cho bài viết; không trộn với công cụ quảng cáo.",
      action: "Tạo hồ sơ bài viết",
      formats: ["markdown", "html", "json"],
      fields: [
        { name: "title", label: "Tiêu đề làm việc", type: "text", required: true, placeholder: "Một buổi sáng không điện thoại" },
        { name: "topic", label: "Chủ đề và luận điểm", type: "textarea", required: true, placeholder: "Khoảng lặng đầu ngày giúp tập trung hơn" },
        { name: "audience", label: "Độc giả", type: "text", required: true, placeholder: "Người làm công việc sáng tạo" },
        { name: "genre", label: "Thể loại", type: "select", options: ["Bài chuyên sâu", "Tản văn", "Hướng dẫn", "Case study", "Bản tin"] },
        { name: "voice", label: "Giọng văn", type: "select", options: ["Điềm tĩnh", "Mạch lạc", "Giàu hình ảnh", "Đối thoại", "Học thuật dễ hiểu"] },
        { name: "wordTarget", label: "Mục tiêu số từ", type: "number", min: 300, max: 5000, value: 1000 }
      ]
    },
    "campaign-planner": {
      title: "Campaign Planner",
      role: "Lập chiến dịch, ngân sách và nhịp đo lường",
      description: "Chuyển mục tiêu thành giai đoạn, lịch hành động, phân bổ kênh và KPI có thể theo dõi.",
      action: "Lập kế hoạch chiến dịch",
      formats: ["csv", "markdown", "json"],
      fields: [
        { name: "campaign", label: "Tên chiến dịch", type: "text", required: true, placeholder: "Ra mắt mùa thu" },
        { name: "objective", label: "Mục tiêu đo được", type: "textarea", required: true, placeholder: "Thu hút 500 lượt đăng ký học thử" },
        { name: "audience", label: "Nhóm công chúng", type: "text", required: true, placeholder: "Người đi làm 22–35 tuổi" },
        { name: "channels", label: "Các kênh, cách nhau bằng dấu phẩy", type: "text", placeholder: "YouTube, Facebook, Email" },
        { name: "budget", label: "Ngân sách dự kiến (VNĐ)", type: "number", min: 0, max: 100000000000, value: 10000000 },
        { name: "startDate", label: "Ngày bắt đầu", type: "date", value: "2026-09-01" },
        { name: "days", label: "Thời lượng (ngày)", type: "number", min: 7, max: 180, value: 30 }
      ]
    },
    "photo-planner": {
      title: "Photo Planner",
      role: "Chuẩn bị buổi chụp và shot list",
      description: "Lập shot list, ánh sáng, thiết bị, lịch hiện trường và rủi ro cho một buổi chụp cụ thể.",
      action: "Tạo kế hoạch chụp",
      formats: ["csv", "markdown", "json"],
      fields: [
        { name: "subject", label: "Chủ thể", type: "text", required: true, placeholder: "Bộ sưu tập gốm thủ công" },
        { name: "story", label: "Câu chuyện hình ảnh", type: "textarea", required: true, placeholder: "Từ bàn tay nghệ nhân đến bàn ăn gia đình" },
        { name: "location", label: "Bối cảnh", type: "text", required: true, placeholder: "Xưởng gốm có cửa sổ hướng đông" },
        { name: "style", label: "Phong cách", type: "select", options: ["Tự nhiên", "Editorial", "Tối giản", "Điện ảnh", "Tư liệu"] },
        { name: "orientation", label: "Khung hình chính", type: "select", options: ["Ngang 3:2", "Dọc 4:5", "Vuông 1:1", "Dọc 9:16"] },
        { name: "shotCount", label: "Số cảnh cần chụp", type: "number", min: 4, max: 24, value: 10 }
      ]
    },
    "podcast-studio": {
      title: "Podcast Studio",
      role: "Thiết kế tập podcast từ mở đầu đến xuất bản",
      description: "Tạo rundown theo phút, câu hỏi, cue âm thanh, show notes và checklist thu âm.",
      action: "Lập hồ sơ tập podcast",
      formats: ["markdown", "csv", "json"],
      fields: [
        { name: "show", label: "Tên chương trình", type: "text", required: true, placeholder: "Chuyện Nghề Thật" },
        { name: "topic", label: "Chủ đề tập", type: "textarea", required: true, placeholder: "Xây portfolio đầu tiên khi chưa có khách hàng" },
        { name: "audience", label: "Người nghe", type: "text", required: true, placeholder: "Sinh viên thiết kế" },
        { name: "format", label: "Định dạng", type: "select", options: ["Độc thoại", "Phỏng vấn", "Đồng dẫn", "Bàn tròn", "Kể chuyện"] },
        { name: "guest", label: "Khách mời / vai trò", type: "text", placeholder: "Art Director có 8 năm kinh nghiệm" },
        { name: "duration", label: "Thời lượng (phút)", type: "number", min: 5, max: 180, value: 35 }
      ]
    },
    "motion-planner": {
      title: "Motion Planner",
      role: "Thiết kế chuyển động và nhịp dựng",
      description: "Tạo storyboard theo thời gian, chỉ dẫn chuyển động, âm thanh và thông số bàn giao.",
      action: "Tạo motion blueprint",
      formats: ["csv", "markdown", "json"],
      fields: [
        { name: "message", label: "Thông điệp chính", type: "textarea", required: true, placeholder: "Một thao tác nhỏ giúp hoàn thành công việc nhanh hơn" },
        { name: "platform", label: "Nền tảng", type: "select", options: ["YouTube", "TikTok", "Instagram", "Website", "Màn hình sự kiện"] },
        { name: "duration", label: "Thời lượng (giây)", type: "number", min: 5, max: 300, value: 30 },
        { name: "style", label: "Ngôn ngữ chuyển động", type: "select", options: ["Tối giản", "Kinetic type", "Collage", "3D mềm", "Infographic"] },
        { name: "aspect", label: "Tỷ lệ khung hình", type: "select", options: ["16:9", "9:16", "1:1", "4:5"] },
        { name: "audioMood", label: "Nhịp âm thanh", type: "text", placeholder: "Tươi sáng, 105 BPM, điểm nhấn rõ" }
      ]
    },
    "three-d-planner": {
      title: "3D Planner",
      role: "Lập pipeline tạo tài sản 3D",
      description: "Định nghĩa tỉ lệ, topology, vật liệu, ngân sách polygon, mốc duyệt và gói xuất bản.",
      action: "Tạo pipeline 3D",
      formats: ["markdown", "json", "csv"],
      fields: [
        { name: "asset", label: "Tài sản cần tạo", type: "text", required: true, placeholder: "Bộ bàn ghế gỗ cho showroom web" },
        { name: "purpose", label: "Mục đích sử dụng", type: "textarea", required: true, placeholder: "Xoay xem sản phẩm trong trình duyệt và dùng cho ảnh quảng cáo" },
        { name: "style", label: "Phong cách hình ảnh", type: "select", options: ["Chân thực", "Stylized", "Low poly", "Sản phẩm sạch", "Kiến trúc"] },
        { name: "target", label: "Nền tảng đích", type: "select", options: ["WebGL / glTF", "Video render", "AR", "Game desktop", "In 3D"] },
        { name: "scale", label: "Tỉ lệ / kích thước chuẩn", type: "text", placeholder: "Mét, bàn cao 0,75 m" },
        { name: "polyBudget", label: "Ngân sách tam giác", type: "number", min: 500, max: 10000000, value: 80000 }
      ]
    },
    "portfolio-builder": {
      title: "Portfolio Builder",
      role: "Đóng gói hồ sơ năng lực và case study",
      description: "Biến thông tin nghề nghiệp thành cấu trúc portfolio, case study, CTA và checklist hoàn thiện.",
      action: "Dựng portfolio",
      formats: ["html", "markdown", "json"],
      fields: [
        { name: "name", label: "Tên hiển thị", type: "text", required: true, placeholder: "Nguyễn Minh An" },
        { name: "role", label: "Vai trò chuyên môn", type: "text", required: true, placeholder: "Product Designer" },
        { name: "bio", label: "Giới thiệu ngắn", type: "textarea", required: true, placeholder: "Tôi thiết kế sản phẩm số dễ hiểu cho nhóm giáo dục và cộng đồng." },
        { name: "skills", label: "Kỹ năng, cách nhau bằng dấu phẩy", type: "text", placeholder: "UX Research, UI Design, Prototyping" },
        { name: "projects", label: "Dự án — mỗi dòng: Tên | Vai trò | Kết quả", type: "textarea", required: true, placeholder: "Ứng dụng học tập | UX/UI | Tăng 28% hoàn thành bài\nWebsite cộng đồng | Product Design | Giảm 35% bước đăng ký" },
        { name: "contact", label: "Kênh liên hệ công khai", type: "text", placeholder: "hello@example.com" }
      ]
    }
  });

  function cleanText(value, limit) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .replace(/\r\n?/g, "\n")
      .trim()
      .slice(0, limit || LIMITS.text);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character];
    });
  }

  function boundedNumber(value, min, max, fallback) {
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
  }

  function splitList(value, limit, itemLimit) {
    const result = [];
    String(value || "").split(/[,\n;]/).forEach(function (entry) {
      const item = cleanText(entry, itemLimit || 100);
      if (item && !result.includes(item) && result.length < (limit || LIMITS.list)) result.push(item);
    });
    return result;
  }

  function hashSeed(value) {
    let hash = 2166136261;
    const input = String(value || "");
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function pick(list, seed, offset) {
    return list[(seed + (offset || 0)) % list.length];
  }

  function slug(value) {
    return cleanText(value, 120).toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "creative-output";
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function utf8ByteLength(value) {
    const text = String(value == null ? "" : value);
    let bytes = 0;
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      if (code <= 0x7f) bytes += 1;
      else if (code <= 0x7ff) bytes += 2;
      else if (code >= 0xd800 && code <= 0xdbff && index + 1 < text.length && text.charCodeAt(index + 1) >= 0xdc00 && text.charCodeAt(index + 1) <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    }
    return bytes;
  }

  function normalizedIsoDate(value) {
    const text = cleanText(value, 40);
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(text);
    if (!match) return "1970-01-01T00:00:00.000Z";
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const calendarCheck = new Date(Date.UTC(year, month - 1, day));
    if (calendarCheck.getUTCFullYear() !== year || calendarCheck.getUTCMonth() !== month - 1 || calendarCheck.getUTCDate() !== day || Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6]) > 59) {
      return "1970-01-01T00:00:00.000Z";
    }
    const date = new Date(text);
    return Number.isFinite(date.getTime()) ? date.toISOString() : "1970-01-01T00:00:00.000Z";
  }

  function normalizeIdeaInput(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      challenge: cleanText(source.challenge, 700),
      audience: cleanText(source.audience, 240),
      constraints: cleanText(source.constraints, 600),
      lens: ["Cân bằng", "Khác biệt", "Tối giản", "Cộng đồng", "Bền vững"].includes(source.lens) ? source.lens : "Cân bằng",
      count: Math.round(boundedNumber(source.count, 3, 12, 6))
    };
  }

  function generateIdeaLab(raw) {
    const input = normalizeIdeaInput(raw);
    const challenge = input.challenge || "tạo một trải nghiệm hữu ích hơn";
    const audience = input.audience || "người sử dụng mục tiêu";
    const constraints = input.constraints || "nguồn lực hiện có";
    const seed = hashSeed([challenge, audience, constraints, input.lens].join("|"));
    const frames = [
      ["Đảo chiều", "Loại bỏ bước khó nhất rồi thiết kế trải nghiệm bắt đầu từ kết quả."],
      ["Ghép đôi", "Kết hợp hai hành vi quen thuộc thành một luồng ngắn và dễ nhớ."],
      ["Thu nhỏ", "Tạo phiên bản hoàn thành được trong dưới năm phút."],
      ["Cộng đồng", "Biến tiến độ cá nhân thành tín hiệu hỗ trợ giữa các thành viên."],
      ["Theo ngữ cảnh", "Thay đổi gợi ý theo thời điểm, thiết bị hoặc mục tiêu gần nhất."],
      ["Minh chứng", "Cho người dùng nhìn thấy tác động trước khi yêu cầu cam kết lớn."],
      ["Mô-đun", "Chia giải pháp thành các khối độc lập để dùng đúng nhu cầu."],
      ["Phản hồi", "Tạo vòng lặp quan sát, hành động và điều chỉnh ngay tại chỗ."],
      ["Kể chuyện", "Dẫn người dùng qua một hành trình có mở đầu, chuyển biến và kết quả."],
      ["Giới hạn tốt", "Dùng giới hạn tài nguyên làm nguyên tắc tạo khác biệt."]
    ];
    const verbs = ["Khởi động", "Kết nối", "Rút gọn", "Dẫn đường", "Phản chiếu", "Mở khóa", "Nhịp nhỏ", "Bản đồ", "Vòng lặp", "Điểm chạm"];
    const ideas = [];
    for (let index = 0; index < input.count; index += 1) {
      const frame = frames[(seed + index * 3) % frames.length];
      const title = pick(verbs, seed, index * 5) + " " + frame[0];
      ideas.push({
        rank: index + 1,
        title: title,
        framework: frame[0],
        angle: frame[1] + " Áp dụng cho " + audience.toLowerCase() + ".",
        mechanism: "Tập trung giải quyết “" + challenge + "” trong điều kiện " + constraints.toLowerCase() + ".",
        firstExperiment: "Làm prototype một luồng chính, mời 5 người đúng nhóm thử và ghi lại thời gian hoàn thành cùng điểm vướng.",
        score: 68 + ((seed + index * 7) % 29)
      });
    }
    ideas.sort(function (a, b) { return b.score - a.score || a.rank - b.rank; });
    return {
      type: "idea-lab",
      challenge: challenge,
      lens: input.lens,
      decisionRule: "Ưu tiên ý tưởng có điểm cao, thử được trong phạm vi giới hạn và tạo ra bằng chứng sau một vòng thử.",
      ideas: ideas
    };
  }

  function normalizeNamingInput(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      subject: cleanText(source.subject, 240),
      audience: cleanText(source.audience, 240),
      keywords: splitList(source.keywords, 10, 50),
      personality: ["Ấm áp", "Hiện đại", "Tinh gọn", "Cao cấp", "Mạnh mẽ"].includes(source.personality) ? source.personality : "Ấm áp",
      language: ["Tiếng Việt", "Quốc tế", "Kết hợp"].includes(source.language) ? source.language : "Tiếng Việt",
      count: Math.round(boundedNumber(source.count, 4, 16, 8))
    };
  }

  function titleWord(value) {
    const text = cleanText(value, 40).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    return text ? text.split(/\s+/)[0].charAt(0).toUpperCase() + text.split(/\s+/)[0].slice(1).toLowerCase() : "";
  }

  function generateNamingStudio(raw) {
    const input = normalizeNamingInput(raw);
    const subject = input.subject || "dự án mới";
    const audience = input.audience || "người dùng mục tiêu";
    const seed = hashSeed([subject, audience, input.personality, input.language, input.keywords.join("|")].join("|"));
    const viPrefixes = ["Mầm", "Nếp", "Gần", "Sáng", "Bền", "Mộc", "Khởi", "Nắng", "Nhịp", "Vườn"];
    const globalPrefixes = ["Luma", "Novi", "Vera", "Mira", "Oria", "Nexo", "Aven", "Cora", "Sola", "Tilo"];
    const suffixes = ["ly", "ia", "hub", "lab", "one", "nhà", "mới", "xanh", "flow", "nest"];
    const keywords = input.keywords.map(titleWord).filter(Boolean);
    const base = titleWord(subject) || "Studio";
    const candidates = [];
    const used = new Set();
    let cursor = 0;
    while (candidates.length < input.count && cursor < 80) {
      const prefixPool = input.language === "Tiếng Việt" ? viPrefixes : (input.language === "Quốc tế" ? globalPrefixes : viPrefixes.concat(globalPrefixes));
      const lead = keywords.length && cursor % 3 === 0 ? keywords[cursor % keywords.length] : pick(prefixPool, seed, cursor * 3);
      const tail = cursor % 4 === 0 ? "" : (cursor % 4 === 1 ? titleWord(pick(suffixes, seed, cursor * 5)) : titleWord(base).slice(0, 4));
      const name = cleanText(lead + tail, 40).replace(/\s+/g, "");
      cursor += 1;
      if (!name || used.has(name.toLocaleLowerCase("vi"))) continue;
      used.add(name.toLocaleLowerCase("vi"));
      const compact = name.length >= 4 && name.length <= 12;
      const vowelFriendly = /[aàáảãạăằắẳẵặâầấẩẫậeèéẻẽẹêềếểễệiìíỉĩịoòóỏõọôồốổỗộơờớởỡợuùúủũụưừứửữựyỳýỷỹỵ]/i.test(name);
      candidates.push({
        name: name,
        meaning: "Gợi liên tưởng đến " + (input.keywords[candidates.length % Math.max(1, input.keywords.length)] || subject.toLowerCase()) + " với sắc thái " + input.personality.toLowerCase() + ".",
        audienceFit: "Dễ đặt trong thông điệp dành cho " + audience.toLowerCase() + ".",
        score: 65 + ((seed + cursor * 11) % 32),
        checks: {
          readable: vowelFriendly,
          compact: compact,
          collision: "Chưa kiểm tra nhãn hiệu hoặc tên miền; cần tra cứu chính thức trước khi sử dụng."
        }
      });
    }
    candidates.sort(function (a, b) { return b.score - a.score || a.name.localeCompare(b.name, "vi"); });
    return {
      type: "naming-studio",
      subject: subject,
      personality: input.personality,
      candidates: candidates,
      notice: "Điểm là heuristic cục bộ dựa trên độ dài, nhịp đọc và đầu vào; không phải kết quả tra cứu pháp lý hay tên miền."
    };
  }

  function normalizeCopyInput(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      product: cleanText(source.product, 240),
      audience: cleanText(source.audience, 240),
      benefit: cleanText(source.benefit, 800),
      proof: cleanText(source.proof, 800),
      channel: ["Landing page", "Facebook", "Email", "YouTube", "TikTok"].includes(source.channel) ? source.channel : "Landing page",
      tone: ["Rõ ràng", "Gần gũi", "Chuyên nghiệp", "Truyền cảm hứng", "Ngắn gọn"].includes(source.tone) ? source.tone : "Rõ ràng",
      cta: cleanText(source.cta, 140)
    };
  }

  function generateCopyStudio(raw) {
    const input = normalizeCopyInput(raw);
    const product = input.product || "sản phẩm";
    const audience = input.audience || "người cần giải pháp";
    const benefit = input.benefit || "đạt mục tiêu rõ ràng hơn";
    const proof = input.proof || "quy trình minh bạch và từng bước có thể kiểm tra";
    const cta = input.cta || "Khám phá cách bắt đầu";
    const seed = hashSeed([product, audience, benefit, input.channel, input.tone].join("|"));
    const openings = ["Bắt đầu từ điều quan trọng nhất:", "Một cách rõ ràng hơn để", "Dành cho bạn khi muốn", "Ít vòng vo hơn, nhiều tiến bộ hơn:"];
    const headline = pick(openings, seed, 1) + " " + benefit.charAt(0).toLowerCase() + benefit.slice(1);
    return {
      type: "copy-studio",
      channel: input.channel,
      tone: input.tone,
      headline: headline,
      subheadline: product + " dành cho " + audience.toLowerCase() + ", tập trung vào kết quả có thể hiểu và kiểm tra.",
      body: [
        audience + " thường cần một lộ trình đủ rõ để bắt đầu mà không bị quá tải.",
        product + " giúp bạn " + benefit.charAt(0).toLowerCase() + benefit.slice(1) + ". " + proof + ".",
        "Bạn biết mình đang ở bước nào, cần làm gì tiếp theo và có thể tự đánh giá kết quả trước khi đi xa hơn."
      ],
      callsToAction: [cta, "Xem quy trình chi tiết", "Bắt đầu với bước đầu tiên"],
      variants: [
        { label: "Lợi ích", text: benefit + " với " + product + "." },
        { label: "Vấn đề–giải pháp", text: "Đừng để quy trình rời rạc làm chậm bạn. " + product + " giúp " + benefit.charAt(0).toLowerCase() + benefit.slice(1) + "." },
        { label: "Bằng chứng", text: proof + ". " + cta + "." }
      ],
      review: ["Xác minh mọi con số và tuyên bố trước khi xuất bản.", "Thay ví dụ chung bằng bằng chứng thật của dự án.", "Kiểm tra độ dài và chính sách của " + input.channel + "."]
    };
  }

  function normalizeWritingInput(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      title: cleanText(source.title, 240),
      topic: cleanText(source.topic, 1200),
      audience: cleanText(source.audience, 240),
      genre: ["Bài chuyên sâu", "Tản văn", "Hướng dẫn", "Case study", "Bản tin"].includes(source.genre) ? source.genre : "Bài chuyên sâu",
      voice: ["Điềm tĩnh", "Mạch lạc", "Giàu hình ảnh", "Đối thoại", "Học thuật dễ hiểu"].includes(source.voice) ? source.voice : "Mạch lạc",
      wordTarget: Math.round(boundedNumber(source.wordTarget, 300, 5000, 1000))
    };
  }

  function generateWritingRoom(raw) {
    const input = normalizeWritingInput(raw);
    const title = input.title || "Bản thảo mới";
    const topic = input.topic || "một chủ đề cần được khám phá";
    const audience = input.audience || "độc giả quan tâm";
    const sectionCount = Math.max(3, Math.min(8, Math.round(input.wordTarget / 350)));
    const frames = ["Bối cảnh và câu hỏi trung tâm", "Điều đang bị hiểu thiếu", "Một quan sát cụ thể", "Cách tiếp cận từng bước", "Ví dụ và giới hạn", "Ứng dụng trong đời sống", "Điều cần thử tiếp", "Kết luận mở"];
    return {
      type: "writing-room",
      title: title,
      genre: input.genre,
      voice: input.voice,
      wordTarget: input.wordTarget,
      thesis: "Bài viết làm rõ “" + topic + "” cho " + audience.toLowerCase() + " bằng lập luận theo bước, ví dụ cụ thể và giới hạn minh bạch.",
      outline: frames.slice(0, sectionCount).map(function (heading, index) {
        return { order: index + 1, heading: heading, purpose: index === 0 ? "Thiết lập lý do độc giả nên quan tâm." : (index === sectionCount - 1 ? "Tóm ý và đề xuất một hành động nhỏ." : "Phát triển luận điểm bằng quan sát hoặc bằng chứng.") };
      }),
      openingDraft: "Có những chủ đề tưởng quen thuộc nhưng chỉ trở nên hữu ích khi ta đặt đúng câu hỏi. Với " + audience.toLowerCase() + ", “" + topic + "” không chỉ là một ý tưởng; đó là điều có thể ảnh hưởng trực tiếp đến cách lựa chọn và hành động. Bài viết này bắt đầu từ bối cảnh thật, đi qua những điểm dễ hiểu sai, rồi kết thúc bằng một bước thử đủ nhỏ để kiểm chứng.",
      revisionChecklist: ["Mỗi phần có một luận điểm rõ và phục vụ luận đề.", "Ví dụ được ghi nguồn hoặc mô tả đúng giới hạn.", "Loại câu lặp ý và thuật ngữ không cần thiết.", "Đọc thành tiếng để kiểm tra nhịp giọng " + input.voice.toLowerCase() + ".", "Kết luận trả lời câu hỏi đã đặt ở phần mở."]
    };
  }

  function normalizeCampaignInput(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(source.startDate || "")) ? String(source.startDate) : "2026-09-01";
    return {
      campaign: cleanText(source.campaign, 240),
      objective: cleanText(source.objective, 700),
      audience: cleanText(source.audience, 240),
      channels: splitList(source.channels, 8, 60),
      budget: Math.round(boundedNumber(source.budget, 0, 100000000000, 10000000)),
      startDate: date,
      days: Math.round(boundedNumber(source.days, 7, 180, 30))
    };
  }

  function datePlus(iso, days) {
    const parts = iso.split("-").map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + days));
    return date.toISOString().slice(0, 10);
  }

  function generateCampaignPlanner(raw) {
    const input = normalizeCampaignInput(raw);
    const campaign = input.campaign || "Chiến dịch mới";
    const channels = input.channels.length ? input.channels : ["Nội dung sở hữu", "Cộng đồng", "Email"];
    const phases = [
      { name: "Chuẩn bị", from: input.startDate, to: datePlus(input.startDate, Math.max(1, Math.floor(input.days * 0.2)) - 1), focus: "Chốt thông điệp, tài sản và baseline." },
      { name: "Khởi động", from: datePlus(input.startDate, Math.floor(input.days * 0.2)), to: datePlus(input.startDate, Math.floor(input.days * 0.45) - 1), focus: "Xuất bản nội dung chủ lực và thu tín hiệu đầu." },
      { name: "Tối ưu", from: datePlus(input.startDate, Math.floor(input.days * 0.45)), to: datePlus(input.startDate, Math.floor(input.days * 0.8) - 1), focus: "So sánh biến thể, chuyển ngân sách theo dữ liệu." },
      { name: "Tổng kết", from: datePlus(input.startDate, Math.floor(input.days * 0.8)), to: datePlus(input.startDate, input.days - 1), focus: "Chốt chuyển đổi, ghi bài học và tái sử dụng." }
    ];
    const base = channels.length ? Math.floor(input.budget / channels.length) : 0;
    const allocations = channels.map(function (channel, index) {
      const amount = index === channels.length - 1 ? input.budget - base * (channels.length - 1) : base;
      return { channel: channel, amount: amount, percent: input.budget ? Math.round(amount / input.budget * 1000) / 10 : 0, role: index === 0 ? "Kênh chủ lực" : "Kênh hỗ trợ và tái tiếp cận" };
    });
    const calendar = [];
    const taskTemplates = ["Chốt thông điệp và tiêu chí đo", "Sản xuất tài sản chủ lực", "Xuất bản và kiểm tra tracking", "Thu phản hồi định tính", "Đọc số liệu và ghi giả thuyết", "Tối ưu biến thể hiệu quả", "Tổng hợp báo cáo"];
    for (let index = 0; index < Math.min(input.days, 21); index += Math.max(1, Math.floor(input.days / 7))) {
      calendar.push({ date: datePlus(input.startDate, index), action: taskTemplates[calendar.length % taskTemplates.length], owner: "Chưa phân công", status: "Kế hoạch" });
    }
    return {
      type: "campaign-planner",
      campaign: campaign,
      objective: input.objective || "Đạt một mục tiêu có thể đo được",
      audience: input.audience || "Nhóm công chúng mục tiêu",
      startDate: input.startDate,
      endDate: datePlus(input.startDate, input.days - 1),
      phases: phases,
      allocations: allocations,
      calendar: calendar,
      kpis: ["Chỉ số tiếp cận đúng đối tượng", "Tỷ lệ hoàn thành nội dung chủ lực", "Tỷ lệ hành động theo mục tiêu", "Chi phí trên một hành động", "Phản hồi định tính và lý do từ chối"]
    };
  }

  function normalizePhotoInput(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      subject: cleanText(source.subject, 240),
      story: cleanText(source.story, 900),
      location: cleanText(source.location, 300),
      style: ["Tự nhiên", "Editorial", "Tối giản", "Điện ảnh", "Tư liệu"].includes(source.style) ? source.style : "Tự nhiên",
      orientation: ["Ngang 3:2", "Dọc 4:5", "Vuông 1:1", "Dọc 9:16"].includes(source.orientation) ? source.orientation : "Ngang 3:2",
      shotCount: Math.round(boundedNumber(source.shotCount, 4, 24, 10))
    };
  }

  function generatePhotoPlanner(raw) {
    const input = normalizePhotoInput(raw);
    const subject = input.subject || "chủ thể";
    const story = input.story || "kể câu chuyện bằng hình ảnh";
    const location = input.location || "bối cảnh đã chọn";
    const shotTypes = ["Toàn cảnh thiết lập", "Trung cảnh hành động", "Cận cảnh chủ thể", "Chi tiết chất liệu", "Góc thấp tạo chiều sâu", "Góc cao mô tả bố cục", "Khoảnh khắc chuyển tiếp", "Ảnh có khoảng trống cho chữ"];
    const shots = Array.from({ length: input.shotCount }, function (_, index) {
      return {
        number: index + 1,
        shot: shotTypes[index % shotTypes.length],
        subject: subject,
        direction: index === 0 ? "Giới thiệu " + location.toLowerCase() + " và quan hệ với chủ thể." : "Làm rõ một lớp của câu chuyện: " + story.toLowerCase() + ".",
        lens: ["24–35 mm", "50 mm", "85 mm", "Macro / cận cảnh"][index % 4],
        priority: index < 3 ? "Bắt buộc" : (index < 7 ? "Quan trọng" : "Bổ sung")
      };
    });
    return {
      type: "photo-planner",
      subject: subject,
      style: input.style,
      orientation: input.orientation,
      location: location,
      shots: shots,
      lighting: ["Khảo sát hướng sáng tự nhiên và thời điểm đổi sáng.", "Chọn một nguồn sáng chính, một tấm hắt và cờ cắt sáng.", "Chụp thẻ xám hoặc ảnh chuẩn màu trước mỗi thay đổi lớn.", "Giữ một setup dự phòng khi thời tiết thay đổi."],
      equipment: ["Máy ảnh và pin/thẻ nhớ dự phòng", "Ống kính góc rộng, tiêu chuẩn và cận cảnh theo shot list", "Chân máy hoặc monopod", "Tấm hắt, diffuser, cờ đen và kẹp", "Bộ vệ sinh và túi bảo vệ thời tiết"],
      risks: ["Quyền chụp tại địa điểm và quyền hình ảnh", "Màu ánh sáng thay đổi giữa các cảnh", "Thiếu thời gian cho ba cảnh bắt buộc", "Tệp chưa sao lưu ở hai vị trí"]
    };
  }

  function normalizePodcastInput(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      show: cleanText(source.show, 180),
      topic: cleanText(source.topic, 900),
      audience: cleanText(source.audience, 240),
      format: ["Độc thoại", "Phỏng vấn", "Đồng dẫn", "Bàn tròn", "Kể chuyện"].includes(source.format) ? source.format : "Độc thoại",
      guest: cleanText(source.guest, 240),
      duration: Math.round(boundedNumber(source.duration, 5, 180, 35))
    };
  }

  function generatePodcastStudio(raw) {
    const input = normalizePodcastInput(raw);
    const show = input.show || "Podcast mới";
    const topic = input.topic || "một chủ đề cần khám phá";
    const audience = input.audience || "người nghe quan tâm";
    const parts = [
      ["Cold open", 0.08, "Một câu hỏi hoặc khoảnh khắc nêu xung đột."],
      ["Giới thiệu", 0.1, "Nói rõ giá trị người nghe nhận được."],
      ["Bối cảnh", 0.18, "Đặt thuật ngữ, câu chuyện và giới hạn."],
      ["Phần chính", 0.38, "Phân tích, ví dụ và góc nhìn đối lập."],
      ["Ứng dụng", 0.18, "Chuyển insight thành bước hành động."],
      ["Kết", 0.08, "Tóm ý, CTA và teaser tập sau."]
    ];
    let cursor = 0;
    const rundown = parts.map(function (part, index) {
      const minutes = index === parts.length - 1 ? input.duration - cursor : Math.max(1, Math.round(input.duration * part[1]));
      const entry = { section: part[0], startMinute: cursor, durationMinutes: minutes, purpose: part[2] };
      cursor += minutes;
      return entry;
    });
    return {
      type: "podcast-studio",
      show: show,
      episodeTitle: topic,
      format: input.format,
      audiencePromise: "Sau tập này, " + audience.toLowerCase() + " có một khung suy nghĩ và một bước thử cụ thể về “" + topic + "”.",
      rundown: rundown,
      questions: ["Điều gì khiến chủ đề này đáng quan tâm ngay lúc này?", "Một hiểu lầm phổ biến là gì?", "Ví dụ thực tế nào thể hiện rõ nhất?", "Khi nào cách tiếp cận này không phù hợp?", "Người nghe có thể thử bước nhỏ nào trong 24 giờ tới?"].concat(input.guest ? ["Từ trải nghiệm của " + input.guest + ", bài học nào khó nhận ra nhất?"] : []),
      showNotes: ["Tóm tắt 3 ý chính của tập.", "Ghi nguồn cho dữ liệu, sách và tác giả được nhắc tới.", "Thêm mốc thời gian sau khi dựng xong.", "Chỉ đăng liên kết đã kiểm tra và được phép chia sẻ."],
      recordingChecklist: ["Thu room tone 30 giây", "Kiểm tra peak và tiếng ồn nền", "Tắt thông báo thiết bị", "Ghi file dự phòng", "Xác nhận quyền sử dụng nhạc và lời nói"]
    };
  }

  function normalizeMotionInput(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      message: cleanText(source.message, 900),
      platform: ["YouTube", "TikTok", "Instagram", "Website", "Màn hình sự kiện"].includes(source.platform) ? source.platform : "YouTube",
      duration: Math.round(boundedNumber(source.duration, 5, 300, 30)),
      style: ["Tối giản", "Kinetic type", "Collage", "3D mềm", "Infographic"].includes(source.style) ? source.style : "Tối giản",
      aspect: ["16:9", "9:16", "1:1", "4:5"].includes(source.aspect) ? source.aspect : "16:9",
      audioMood: cleanText(source.audioMood, 240)
    };
  }

  function generateMotionPlanner(raw) {
    const input = normalizeMotionInput(raw);
    const message = input.message || "truyền tải một thông điệp rõ ràng";
    const sceneCount = Math.max(3, Math.min(12, Math.ceil(input.duration / 6)));
    const sceneDuration = input.duration / sceneCount;
    const functions = ["Hook thị giác", "Đặt bối cảnh", "Nêu vấn đề", "Chuyển đổi chính", "Làm rõ lợi ích", "Bằng chứng", "Nhịp nghỉ", "CTA"];
    const scenes = Array.from({ length: sceneCount }, function (_, index) {
      const start = Math.round(index * sceneDuration * 10) / 10;
      const end = index === sceneCount - 1 ? input.duration : Math.round((index + 1) * sceneDuration * 10) / 10;
      return {
        scene: index + 1,
        start: start,
        end: end,
        purpose: index === sceneCount - 1 ? "CTA và khung kết" : functions[index % functions.length],
        visual: index === 0 ? "Mở bằng một hình hoặc chữ thể hiện ngay “" + message + "”." : "Phát triển một lớp thông tin bằng bố cục " + input.style.toLowerCase() + ".",
        motion: index % 2 === 0 ? "Ease out, chuyển động theo một trục, giữ điểm nhìn rõ." : "Match cut hoặc morph có chủ đích; dừng đủ lâu để đọc.",
        audio: input.audioMood || "Nhịp nền vừa phải, điểm nhấn trùng chuyển cảnh."
      };
    });
    return {
      type: "motion-planner",
      platform: input.platform,
      aspect: input.aspect,
      duration: input.duration,
      message: message,
      scenes: scenes,
      delivery: ["Master " + input.aspect + " đúng " + input.duration + " giây", "Tệp không chữ để bản địa hóa", "Caption hoặc safe-area theo " + input.platform, "Âm thanh mix có headroom và giấy phép rõ", "Poster frame / thumbnail tĩnh"],
      motionRules: ["Một cảnh chỉ có một trọng tâm.", "Chuyển động dẫn mắt, không chỉ trang trí.", "Giữ chữ đủ lâu để đọc ở tốc độ bình thường.", "Tắt hoặc giảm chuyển động khi người dùng chọn reduced motion."]
    };
  }

  function normalizeThreeDInput(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      asset: cleanText(source.asset, 240),
      purpose: cleanText(source.purpose, 900),
      style: ["Chân thực", "Stylized", "Low poly", "Sản phẩm sạch", "Kiến trúc"].includes(source.style) ? source.style : "Chân thực",
      target: ["WebGL / glTF", "Video render", "AR", "Game desktop", "In 3D"].includes(source.target) ? source.target : "WebGL / glTF",
      scale: cleanText(source.scale, 180),
      polyBudget: Math.round(boundedNumber(source.polyBudget, 500, 10000000, 80000))
    };
  }

  function generateThreeDPlanner(raw) {
    const input = normalizeThreeDInput(raw);
    const asset = input.asset || "tài sản 3D";
    const purpose = input.purpose || "sử dụng trong sản phẩm số";
    const webTarget = input.target === "WebGL / glTF" || input.target === "AR";
    const stages = [
      ["Reference & scale", "Khóa ảnh tham chiếu, kích thước và silhouette.", "Duyệt tỉ lệ trước khi chi tiết."],
      ["Blockout", "Dựng khối lớn và pivot theo cách sử dụng.", "Test trong camera đích."],
      ["Topology", "Hoàn thiện lưới, edge flow và UV.", "Không có mặt lỗi hoặc UV chồng ngoài chủ ý."],
      ["Material", "Tạo PBR base color, normal, roughness và AO khi cần.", "Kiểm tra dưới ba môi trường sáng."],
      ["LOD & collision", "Tạo mức chi tiết và collider riêng.", "Chuyển LOD không bật hình rõ."],
      ["Export & QA", "Xuất đúng đơn vị, trục, tên và bundle.", "Mở lại trong runtime đích và đối chiếu checklist."]
    ];
    return {
      type: "three-d-planner",
      asset: asset,
      purpose: purpose,
      target: input.target,
      scale: input.scale || "Đơn vị mét; cần bổ sung kích thước tham chiếu thật.",
      budgets: {
        triangleLod0: input.polyBudget,
        triangleLod1: Math.round(input.polyBudget * 0.5),
        triangleLod2: Math.round(input.polyBudget * 0.2),
        triangleLod3: Math.round(input.polyBudget * 0.06),
        texture: webTarget ? "Tối đa 2K mỗi bộ vật liệu, ưu tiên KTX2" : "2K–4K theo khoảng cách camera"
      },
      stages: stages.map(function (stage, index) { return { order: index + 1, stage: stage[0], work: stage[1] + " Tài sản: " + asset + ".", gate: stage[2] }; }),
      materialPlan: ["Xác định vật liệu theo tính chất vật lý, không chỉ theo màu.", "Giữ texel density nhất quán.", "Bake normal/AO từ high-poly khi có giá trị quan sát.", "Kiểm tra seam, mipmap và color space."],
      delivery: webTarget ? ["GLB/glTF 2.0", "LOD0–LOD3", "KTX2 hoặc texture tối ưu web", "Collider tách biệt", "Preview và attribution tài sản nguồn"] : ["Tệp nguồn có cấu trúc", "Tệp bàn giao theo pipeline đích", "Texture và cache cần thiết", "Turntable QA", "Tài liệu đơn vị và color management"],
      notice: "Ngân sách là kế hoạch ban đầu; phải đo trong cảnh thật và điều chỉnh theo thiết bị đích."
    };
  }

  function normalizePortfolioInput(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const projects = String(source.projects || "").split(/\n/).slice(0, 20).map(function (line, index) {
      const parts = line.split("|").map(function (part) { return cleanText(part, 300); });
      return { id: "case-" + (index + 1), title: parts[0] || "", role: parts[1] || "", result: parts[2] || "" };
    }).filter(function (project) { return project.title; });
    return {
      name: cleanText(source.name, 180),
      role: cleanText(source.role, 180),
      bio: cleanText(source.bio, 1200),
      skills: splitList(source.skills, 24, 80),
      projects: projects,
      contact: cleanText(source.contact, 240)
    };
  }

  function generatePortfolioBuilder(raw) {
    const input = normalizePortfolioInput(raw);
    const checks = [
      { label: "Danh tính và vai trò", passed: Boolean(input.name && input.role) },
      { label: "Giới thiệu tập trung", passed: input.bio.length >= 40 },
      { label: "Ít nhất 3 kỹ năng", passed: input.skills.length >= 3 },
      { label: "Ít nhất 2 case study", passed: input.projects.length >= 2 },
      { label: "Mỗi case có vai trò và kết quả", passed: input.projects.length > 0 && input.projects.every(function (project) { return project.role && project.result; }) },
      { label: "Có kênh liên hệ", passed: Boolean(input.contact) }
    ];
    const cases = input.projects.map(function (project) {
      return {
        title: project.title,
        role: project.role || "Cần bổ sung vai trò",
        result: project.result || "Cần bổ sung kết quả có bằng chứng",
        structure: ["Bối cảnh và vấn đề", "Vai trò và phạm vi trách nhiệm", "Quá trình cùng các quyết định quan trọng", "Kết quả, bằng chứng và điều học được"]
      };
    });
    return {
      type: "portfolio-builder",
      profile: {
        name: input.name || "Tên của bạn",
        role: input.role || "Vai trò chuyên môn",
        bio: input.bio || "Bổ sung một đoạn giới thiệu ngắn, tập trung vào giá trị bạn tạo ra.",
        skills: input.skills,
        contact: input.contact
      },
      headline: (input.name || "Bạn") + " — " + (input.role || "chuyên gia sáng tạo") + " tập trung vào kết quả rõ ràng và trải nghiệm có chủ đích.",
      cases: cases,
      navigation: ["Giới thiệu", "Năng lực", "Case study", "Quy trình", "Liên hệ"],
      checks: checks,
      completeness: Math.round(checks.filter(function (check) { return check.passed; }).length / checks.length * 100),
      privacyNote: "Chỉ xuất bản thông tin được phép chia sẻ; ẩn dữ liệu khách hàng, tài khoản và số liệu mật."
    };
  }

  function runGenerator(view, raw) {
    if (view === "idea-lab") return generateIdeaLab(raw);
    if (view === "naming-studio") return generateNamingStudio(raw);
    if (view === "copy-studio") return generateCopyStudio(raw);
    if (view === "writing-room") return generateWritingRoom(raw);
    if (view === "campaign-planner") return generateCampaignPlanner(raw);
    if (view === "photo-planner") return generatePhotoPlanner(raw);
    if (view === "podcast-studio") return generatePodcastStudio(raw);
    if (view === "motion-planner") return generateMotionPlanner(raw);
    if (view === "three-d-planner") return generateThreeDPlanner(raw);
    if (view === "portfolio-builder") return generatePortfolioBuilder(raw);
    return null;
  }

  function defaultDraft(view) {
    const definition = TOOL_DEFINITIONS[view];
    const draft = {};
    definition.fields.forEach(function (field) {
      draft[field.name] = field.value != null ? String(field.value) : (field.options ? field.options[0] : "");
    });
    return draft;
  }

  function normalizeDraft(view, raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const draft = {};
    TOOL_DEFINITIONS[view].fields.forEach(function (field) {
      if (field.type === "number") draft[field.name] = String(boundedNumber(source[field.name], field.min, field.max, Number(field.value || field.min || 0)));
      else if (field.type === "select") draft[field.name] = field.options.includes(source[field.name]) ? source[field.name] : field.options[0];
      else if (field.type === "date") draft[field.name] = /^\d{4}-\d{2}-\d{2}$/.test(String(source[field.name] || "")) ? String(source[field.name]) : String(field.value || "");
      else draft[field.name] = cleanText(source[field.name], field.type === "textarea" ? LIMITS.longText : LIMITS.text);
    });
    return draft;
  }

  function createDefaultState(view) {
    const safeView = VIEWS.includes(view) ? view : VIEWS[0];
    return { format: FORMAT, version: VERSION, view: safeView, draft: defaultDraft(safeView), output: null, history: [] };
  }

  function normalizeState(view, raw) {
    const safeView = VIEWS.includes(view) ? view : VIEWS[0];
    const source = raw && typeof raw === "object" ? raw : {};
    const draft = normalizeDraft(safeView, source.draft);
    const output = source.output ? runGenerator(safeView, draft) : null;
    const historyIds = new Set();
    const history = Array.isArray(source.history) ? source.history.slice(0, LIMITS.history).map(function (entry, index) {
      const entryDraft = normalizeDraft(safeView, entry && entry.draft);
      const requestedId = cleanText(entry && entry.id, 88) || "history-" + index;
      let id = requestedId;
      let suffix = 2;
      while (historyIds.has(id)) {
        id = cleanText(requestedId + "-" + suffix, 100);
        suffix += 1;
      }
      historyIds.add(id);
      return {
        id: id,
        label: cleanText(entry && entry.label, 180) || TOOL_DEFINITIONS[safeView].title,
        createdAt: normalizedIsoDate(entry && entry.createdAt),
        draft: entryDraft,
        output: runGenerator(safeView, entryDraft)
      };
    }) : [];
    return { format: FORMAT, version: VERSION, view: safeView, draft: draft, output: output, history: history };
  }

  function safeStorage(storage) {
    if (storage) return storage;
    try { return globalScope.localStorage || null; } catch (_) { return null; }
  }

  function storageKey(view) {
    return STORAGE_KEYS[view];
  }

  // The shell may pass its project-envelope alias when it supplies a scoped
  // adapter. Both aliases still belong to the active view; every other key is
  // rejected so a caller cannot mount a studio against another tool's history.
  function isAllowedStorageKey(view, value) {
    const requested = cleanText(value, 180);
    if (!requested) return true;
    return requested === STORAGE_KEYS[view] || requested === "hh.creative.tool." + view + ".project.v1";
  }

  function loadState(view, storage) {
    const target = safeStorage(storage);
    if (!target || !VIEWS.includes(view)) return createDefaultState(view);
    try {
      const parsed = JSON.parse(target.getItem(storageKey(view)) || "null");
      if (!parsed || parsed.format !== FORMAT || parsed.version !== VERSION || parsed.view !== view) return createDefaultState(view);
      return normalizeState(view, parsed);
    } catch (_) {
      return createDefaultState(view);
    }
  }

  function saveState(view, state, storage) {
    const target = safeStorage(storage);
    if (!target || !VIEWS.includes(view)) return { ok: false, reason: "unsupported" };
    if (state && typeof state === "object" && ((state.format && state.format !== FORMAT) || (state.view && state.view !== view) || (state.version != null && state.version !== VERSION))) {
      return { ok: false, reason: "foreign-state" };
    }
    try {
      const normalized = normalizeState(view, state);
      target.setItem(storageKey(view), JSON.stringify(normalized));
      return { ok: true, key: storageKey(view) };
    } catch (_) {
      return { ok: false, reason: "storage-error" };
    }
  }

  function importState(view, text) {
    const value = String(text == null ? "" : text);
    if (utf8ByteLength(value) > LIMITS.importBytes) throw new Error("Tệp nhập vượt quá 1 MB.");
    let parsed;
    try {
      parsed = JSON.parse(value.replace(/^\ufeff/, ""));
    } catch (_) {
      throw new Error("Tệp JSON không hợp lệ hoặc không dùng mã hóa UTF-8.");
    }
    if (!parsed || parsed.format !== FORMAT || parsed.view !== view) throw new Error("Tệp không thuộc đúng studio đang mở.");
    if (parsed.version !== VERSION) throw new Error("Phiên bản workspace không được hỗ trợ.");
    return normalizeState(view, parsed);
  }

  function csvCell(value) {
    let text = String(value == null ? "" : value).replace(/\r\n?|\n/g, " ");
    if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = "'" + text;
    return "\"" + text.replace(/"/g, "\"\"") + "\"";
  }

  function rowsToCsv(rows) {
    return rows.map(function (row) { return row.map(csvCell).join(","); }).join("\n");
  }

  function outputToMarkdown(view, output) {
    if (!output) return "# Chưa có kết quả\n";
    if (view === "idea-lab") return "# " + output.challenge + "\n\n" + output.ideas.map(function (idea) { return "## " + idea.title + " — " + idea.score + "/100\n\n- Khung: " + idea.framework + "\n- Góc tiếp cận: " + idea.angle + "\n- Cơ chế: " + idea.mechanism + "\n- Thử nghiệm: " + idea.firstExperiment; }).join("\n\n");
    if (view === "naming-studio") return "# Tên cho " + output.subject + "\n\n" + output.candidates.map(function (item) { return "## " + item.name + " — " + item.score + "/100\n\n" + item.meaning + "\n\n" + item.audienceFit + "\n\n> " + item.checks.collision; }).join("\n\n");
    if (view === "copy-studio") return "# " + output.headline + "\n\n" + output.subheadline + "\n\n" + output.body.join("\n\n") + "\n\n## CTA\n\n" + output.callsToAction.map(function (item) { return "- " + item; }).join("\n");
    if (view === "writing-room") return "# " + output.title + "\n\n**Luận đề:** " + output.thesis + "\n\n## Dàn ý\n\n" + output.outline.map(function (item) { return item.order + ". **" + item.heading + "** — " + item.purpose; }).join("\n") + "\n\n## Mở bài nháp\n\n" + output.openingDraft + "\n\n## Checklist biên tập\n\n" + output.revisionChecklist.map(function (item) { return "- [ ] " + item; }).join("\n");
    if (view === "campaign-planner") return "# " + output.campaign + "\n\n**Mục tiêu:** " + output.objective + "\n\n## Giai đoạn\n\n" + output.phases.map(function (item) { return "- **" + item.name + "** (" + item.from + " → " + item.to + "): " + item.focus; }).join("\n") + "\n\n## KPI\n\n" + output.kpis.map(function (item) { return "- " + item; }).join("\n");
    if (view === "photo-planner") return "# Kế hoạch chụp: " + output.subject + "\n\n" + output.shots.map(function (item) { return "## Cảnh " + item.number + " — " + item.shot + "\n\n" + item.direction + "\n\n- Ống kính: " + item.lens + "\n- Ưu tiên: " + item.priority; }).join("\n\n");
    if (view === "podcast-studio") return "# " + output.show + ": " + output.episodeTitle + "\n\n" + output.audiencePromise + "\n\n## Rundown\n\n" + output.rundown.map(function (item) { return "- **" + item.startMinute + " phút · " + item.section + "** (" + item.durationMinutes + " phút): " + item.purpose; }).join("\n") + "\n\n## Câu hỏi\n\n" + output.questions.map(function (item) { return "- " + item; }).join("\n");
    if (view === "motion-planner") return "# Motion blueprint — " + output.message + "\n\n" + output.scenes.map(function (item) { return "## Cảnh " + item.scene + " · " + item.start + "–" + item.end + "s\n\n- Mục tiêu: " + item.purpose + "\n- Hình: " + item.visual + "\n- Chuyển động: " + item.motion + "\n- Âm thanh: " + item.audio; }).join("\n\n");
    if (view === "three-d-planner") return "# Pipeline 3D: " + output.asset + "\n\n**Đích:** " + output.target + "\n\n## Ngân sách\n\n- LOD0: " + output.budgets.triangleLod0.toLocaleString("vi-VN") + " tam giác\n- LOD1: " + output.budgets.triangleLod1.toLocaleString("vi-VN") + "\n- LOD2: " + output.budgets.triangleLod2.toLocaleString("vi-VN") + "\n- Texture: " + output.budgets.texture + "\n\n## Pipeline\n\n" + output.stages.map(function (item) { return item.order + ". **" + item.stage + "** — " + item.work + " Gate: " + item.gate; }).join("\n");
    if (view === "portfolio-builder") return "# " + output.profile.name + "\n\n## " + output.profile.role + "\n\n" + output.profile.bio + "\n\n## Case study\n\n" + output.cases.map(function (item) { return "### " + item.title + "\n\n- Vai trò: " + item.role + "\n- Kết quả: " + item.result + "\n- Cấu trúc: " + item.structure.join("; "); }).join("\n\n") + "\n\n## Liên hệ\n\n" + output.profile.contact;
    return "# Kết quả\n\n" + JSON.stringify(output, null, 2);
  }

  function outputToCsv(view, output) {
    if (!output) return rowsToCsv([["status"], ["empty"]]);
    if (view === "idea-lab") return rowsToCsv([["rank", "title", "framework", "score", "angle", "experiment"]].concat(output.ideas.map(function (item, index) { return [index + 1, item.title, item.framework, item.score, item.angle, item.firstExperiment]; })));
    if (view === "naming-studio") return rowsToCsv([["name", "score", "meaning", "audience_fit", "readable", "compact", "notice"]].concat(output.candidates.map(function (item) { return [item.name, item.score, item.meaning, item.audienceFit, item.checks.readable, item.checks.compact, item.checks.collision]; })));
    if (view === "campaign-planner") return rowsToCsv([["date", "action", "owner", "status"]].concat(output.calendar.map(function (item) { return [item.date, item.action, item.owner, item.status]; })));
    if (view === "photo-planner") return rowsToCsv([["number", "shot", "subject", "direction", "lens", "priority"]].concat(output.shots.map(function (item) { return [item.number, item.shot, item.subject, item.direction, item.lens, item.priority]; })));
    if (view === "podcast-studio") return rowsToCsv([["section", "start_minute", "duration_minutes", "purpose"]].concat(output.rundown.map(function (item) { return [item.section, item.startMinute, item.durationMinutes, item.purpose]; })));
    if (view === "motion-planner") return rowsToCsv([["scene", "start_second", "end_second", "purpose", "visual", "motion", "audio"]].concat(output.scenes.map(function (item) { return [item.scene, item.start, item.end, item.purpose, item.visual, item.motion, item.audio]; })));
    if (view === "three-d-planner") return rowsToCsv([["order", "stage", "work", "approval_gate"]].concat(output.stages.map(function (item) { return [item.order, item.stage, item.work, item.gate]; })));
    return rowsToCsv([["field", "value"], ["tool", view], ["content", outputToMarkdown(view, output)]]);
  }

  function outputToHtml(view, output) {
    const title = output && (output.title || output.headline || output.campaign || output.subject || (output.profile && output.profile.name)) || TOOL_DEFINITIONS[view].title;
    const markdown = outputToMarkdown(view, output);
    const body = markdown.split(/\n/).map(function (line) {
      if (/^# /.test(line)) return "<h1>" + escapeHtml(line.slice(2)) + "</h1>";
      if (/^## /.test(line)) return "<h2>" + escapeHtml(line.slice(3)) + "</h2>";
      if (/^### /.test(line)) return "<h3>" + escapeHtml(line.slice(4)) + "</h3>";
      if (/^- /.test(line)) return "<p>• " + escapeHtml(line.slice(2)) + "</p>";
      return line ? "<p>" + escapeHtml(line.replace(/\*\*/g, "")) + "</p>" : "";
    }).join("\n");
    return "<!doctype html><html lang=\"vi\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" + escapeHtml(title) + "</title><style>body{max-width:800px;margin:40px auto;padding:0 20px;font:16px/1.65 system-ui;color:#241b14;background:#fffaf0}h1,h2,h3{color:#6f2b1d}</style></head><body>" + body + "</body></html>";
  }

  function exportOutput(view, output, format) {
    const safeView = VIEWS.includes(view) ? view : VIEWS[0];
    const selected = TOOL_DEFINITIONS[safeView].formats.includes(format) ? format : TOOL_DEFINITIONS[safeView].formats[0];
    if (selected === "json") return { filename: safeView + ".json", mime: "application/json;charset=utf-8", content: JSON.stringify(output, null, 2) };
    if (selected === "csv") return { filename: safeView + ".csv", mime: "text/csv;charset=utf-8", content: "\ufeff" + outputToCsv(safeView, output) };
    if (selected === "html") return { filename: safeView + ".html", mime: "text/html;charset=utf-8", content: outputToHtml(safeView, output) };
    return { filename: safeView + ".md", mime: "text/markdown;charset=utf-8", content: outputToMarkdown(safeView, output) };
  }

  function exportWorkspaceState(view, state) {
    return JSON.stringify(normalizeState(view, state), null, 2);
  }

  function fieldHtml(view, field, value, idPrefix) {
    const id = (idPrefix || "hhcss-" + view) + "-" + field.name;
    const common = " id=\"" + id + "\" name=\"" + escapeHtml(field.name) + "\" data-hhcss-field=\"" + escapeHtml(field.name) + "\"" + (field.required ? " required" : "");
    let control = "";
    if (field.type === "textarea") control = "<textarea" + common + " rows=\"4\" maxlength=\"" + LIMITS.longText + "\" placeholder=\"" + escapeHtml(field.placeholder || "") + "\">" + escapeHtml(value) + "</textarea>";
    else if (field.type === "select") control = "<select" + common + ">" + field.options.map(function (option) { return "<option" + (option === value ? " selected" : "") + ">" + escapeHtml(option) + "</option>"; }).join("") + "</select>";
    else control = "<input" + common + " type=\"" + field.type + "\" value=\"" + escapeHtml(value) + "\"" + (field.placeholder ? " placeholder=\"" + escapeHtml(field.placeholder) + "\"" : "") + (field.min != null ? " min=\"" + field.min + "\"" : "") + (field.max != null ? " max=\"" + field.max + "\"" : "") + (field.type === "text" ? " maxlength=\"" + LIMITS.text + "\"" : "") + ">";
    return "<label class=\"hhcss__field" + (field.type === "textarea" ? " hhcss__field--wide" : "") + "\" for=\"" + id + "\"><span>" + escapeHtml(field.label) + (field.required ? " <b aria-hidden=\"true\">*</b>" : "") + "</span>" + control + "</label>";
  }

  function renderList(title, values) {
    return "<section class=\"hhcss__result-section\"><h4>" + escapeHtml(title) + "</h4><ul>" + values.map(function (item) { return "<li>" + escapeHtml(typeof item === "string" ? item : JSON.stringify(item)) + "</li>"; }).join("") + "</ul></section>";
  }

  function renderOutput(view, output) {
    if (!output) return "<div class=\"hhcss__empty\"><span aria-hidden=\"true\">✦</span><h3>Không gian kết quả</h3><p>Điền thông tin bên trái và chạy studio. Kết quả được xử lý ngay trên thiết bị, không gửi dữ liệu ra ngoài.</p></div>";
    if (view === "idea-lab") return "<div class=\"hhcss__result-head\"><span>Lăng kính " + escapeHtml(output.lens) + "</span><h3>" + escapeHtml(output.challenge) + "</h3><p>" + escapeHtml(output.decisionRule) + "</p></div><div class=\"hhcss__idea-grid\">" + output.ideas.map(function (item) { return "<article><b>" + item.score + "/100</b><small>" + escapeHtml(item.framework) + "</small><h4>" + escapeHtml(item.title) + "</h4><p>" + escapeHtml(item.angle) + "</p><p><strong>Thử:</strong> " + escapeHtml(item.firstExperiment) + "</p></article>"; }).join("") + "</div>";
    if (view === "naming-studio") return "<div class=\"hhcss__result-head\"><span>Danh sách tên</span><h3>" + escapeHtml(output.subject) + "</h3><p>" + escapeHtml(output.notice) + "</p></div><div class=\"hhcss__name-grid\">" + output.candidates.map(function (item) { return "<article><b>" + item.score + "</b><h4>" + escapeHtml(item.name) + "</h4><p>" + escapeHtml(item.meaning) + "</p><small>" + escapeHtml(item.checks.collision) + "</small></article>"; }).join("") + "</div>";
    if (view === "copy-studio") return "<div class=\"hhcss__result-head\"><span>" + escapeHtml(output.channel) + " · " + escapeHtml(output.tone) + "</span><h3>" + escapeHtml(output.headline) + "</h3><p>" + escapeHtml(output.subheadline) + "</p></div><section class=\"hhcss__copy-sheet\">" + output.body.map(function (item) { return "<p>" + escapeHtml(item) + "</p>"; }).join("") + "<div class=\"hhcss__cta-row\">" + output.callsToAction.map(function (item) { return "<span>" + escapeHtml(item) + "</span>"; }).join("") + "</div></section>" + renderList("Kiểm tra trước khi đăng", output.review);
    if (view === "writing-room") return "<div class=\"hhcss__result-head\"><span>" + escapeHtml(output.genre) + " · " + output.wordTarget + " từ</span><h3>" + escapeHtml(output.title) + "</h3><p>" + escapeHtml(output.thesis) + "</p></div><ol class=\"hhcss__outline\">" + output.outline.map(function (item) { return "<li><b>" + escapeHtml(item.heading) + "</b><span>" + escapeHtml(item.purpose) + "</span></li>"; }).join("") + "</ol><section class=\"hhcss__paper\"><h4>Mở bài nháp</h4><p>" + escapeHtml(output.openingDraft) + "</p></section>" + renderList("Checklist biên tập", output.revisionChecklist);
    if (view === "campaign-planner") return "<div class=\"hhcss__result-head\"><span>" + escapeHtml(output.startDate) + " → " + escapeHtml(output.endDate) + "</span><h3>" + escapeHtml(output.campaign) + "</h3><p>" + escapeHtml(output.objective) + "</p></div><div class=\"hhcss__timeline\">" + output.phases.map(function (item) { return "<article><b>" + escapeHtml(item.name) + "</b><small>" + escapeHtml(item.from) + " → " + escapeHtml(item.to) + "</small><p>" + escapeHtml(item.focus) + "</p></article>"; }).join("") + "</div><div class=\"hhcss__budget\">" + output.allocations.map(function (item) { return "<div><span>" + escapeHtml(item.channel) + "</span><b>" + item.amount.toLocaleString("vi-VN") + " ₫</b><i style=\"--share:" + item.percent + "%\"></i></div>"; }).join("") + "</div>";
    if (view === "photo-planner") return "<div class=\"hhcss__result-head\"><span>" + escapeHtml(output.style) + " · " + escapeHtml(output.orientation) + "</span><h3>" + escapeHtml(output.subject) + "</h3><p>" + escapeHtml(output.location) + "</p></div><div class=\"hhcss__shot-list\">" + output.shots.map(function (item) { return "<article><b>" + String(item.number).padStart(2, "0") + "</b><div><h4>" + escapeHtml(item.shot) + "</h4><p>" + escapeHtml(item.direction) + "</p><small>" + escapeHtml(item.lens) + " · " + escapeHtml(item.priority) + "</small></div></article>"; }).join("") + "</div>" + renderList("Ánh sáng", output.lighting);
    if (view === "podcast-studio") return "<div class=\"hhcss__result-head\"><span>" + escapeHtml(output.format) + "</span><h3>" + escapeHtml(output.show) + ": " + escapeHtml(output.episodeTitle) + "</h3><p>" + escapeHtml(output.audiencePromise) + "</p></div><div class=\"hhcss__rundown\">" + output.rundown.map(function (item) { return "<article><b>" + item.startMinute + ":00</b><div><h4>" + escapeHtml(item.section) + "</h4><p>" + escapeHtml(item.purpose) + "</p><small>" + item.durationMinutes + " phút</small></div></article>"; }).join("") + "</div>" + renderList("Câu hỏi dẫn", output.questions);
    if (view === "motion-planner") return "<div class=\"hhcss__result-head\"><span>" + escapeHtml(output.platform) + " · " + escapeHtml(output.aspect) + " · " + output.duration + "s</span><h3>" + escapeHtml(output.message) + "</h3></div><div class=\"hhcss__storyboard\">" + output.scenes.map(function (item) { return "<article><header><b>Cảnh " + item.scene + "</b><time>" + item.start + "–" + item.end + "s</time></header><h4>" + escapeHtml(item.purpose) + "</h4><p>" + escapeHtml(item.visual) + "</p><small>" + escapeHtml(item.motion) + "</small></article>"; }).join("") + "</div>";
    if (view === "three-d-planner") return "<div class=\"hhcss__result-head\"><span>" + escapeHtml(output.target) + "</span><h3>" + escapeHtml(output.asset) + "</h3><p>" + escapeHtml(output.purpose) + "</p></div><div class=\"hhcss__metric-row\"><div><span>LOD0</span><b>" + output.budgets.triangleLod0.toLocaleString("vi-VN") + "</b></div><div><span>LOD1</span><b>" + output.budgets.triangleLod1.toLocaleString("vi-VN") + "</b></div><div><span>LOD2</span><b>" + output.budgets.triangleLod2.toLocaleString("vi-VN") + "</b></div></div><ol class=\"hhcss__pipeline\">" + output.stages.map(function (item) { return "<li><b>" + escapeHtml(item.stage) + "</b><p>" + escapeHtml(item.work) + "</p><small>Gate: " + escapeHtml(item.gate) + "</small></li>"; }).join("") + "</ol>";
    if (view === "portfolio-builder") return "<div class=\"hhcss__portfolio-hero\"><span>Sẵn sàng " + output.completeness + "%</span><h3>" + escapeHtml(output.profile.name) + "</h3><strong>" + escapeHtml(output.profile.role) + "</strong><p>" + escapeHtml(output.profile.bio) + "</p></div><div class=\"hhcss__skills\">" + output.profile.skills.map(function (item) { return "<span>" + escapeHtml(item) + "</span>"; }).join("") + "</div><div class=\"hhcss__cases\">" + output.cases.map(function (item) { return "<article><small>Case study</small><h4>" + escapeHtml(item.title) + "</h4><p><b>Vai trò:</b> " + escapeHtml(item.role) + "</p><p><b>Kết quả:</b> " + escapeHtml(item.result) + "</p></article>"; }).join("") + "</div>" + renderList("Kiểm tra hoàn thiện", output.checks.map(function (check) { return (check.passed ? "Đạt — " : "Cần bổ sung — ") + check.label; }));
    return "<pre>" + escapeHtml(JSON.stringify(output, null, 2)) + "</pre>";
  }

  function historyLabel(view, draft) {
    const first = TOOL_DEFINITIONS[view].fields.find(function (field) { return field.required; });
    return cleanText(draft[first && first.name], 80) || TOOL_DEFINITIONS[view].title;
  }

  function renderHistory(state) {
    if (!state.history.length) return "<div class=\"hhcss__history-empty\">Chưa có phiên bản nào. Mỗi lần tạo kết quả sẽ được lưu riêng trong studio này.</div>";
    return state.history.map(function (entry) {
      const date = entry.createdAt === "1970-01-01T00:00:00.000Z" ? "Bản đã nhập" : new Date(entry.createdAt).toLocaleString("vi-VN");
      return "<article class=\"hhcss__history-item\"><div><strong>" + escapeHtml(entry.label) + "</strong><small>" + escapeHtml(date) + "</small></div><button type=\"button\" data-hhcss-history-load=\"" + escapeHtml(entry.id) + "\">Mở</button><button type=\"button\" data-hhcss-history-delete=\"" + escapeHtml(entry.id) + "\" aria-label=\"Xóa phiên bản " + escapeHtml(entry.label) + "\">×</button></article>";
    }).join("");
  }

  function workspaceHtml(view, state, mountId) {
    const definition = TOOL_DEFINITIONS[view];
    const idPrefix = "hhcss-" + view + "-" + cleanText(mountId, 80);
    const inputTitleId = idPrefix + "-input-title";
    const outputTitleId = idPrefix + "-output-title";
    const historyTitleId = idPrefix + "-history-title";
    return "<main class=\"hhcss\" data-view=\"" + view + "\">" +
      "<header class=\"hhcss__hero\"><div><span class=\"hhcss__eyebrow\">Studio chuyên trách · xử lý cục bộ</span><h2>" + escapeHtml(definition.title) + "</h2><p>" + escapeHtml(definition.description) + "</p></div><aside><small>Vai trò duy nhất</small><strong>" + escapeHtml(definition.role) + "</strong><span>Autosave riêng · không dùng chung lịch sử</span></aside></header>" +
      "<div class=\"hhcss__workspace\"><section class=\"hhcss__input-panel\" aria-labelledby=\"" + inputTitleId + "\"><header><div><span>Bước 01</span><h3 id=\"" + inputTitleId + "\">Đầu vào chuyên biệt</h3></div><i>Đã lưu trên thiết bị</i></header><form data-hhcss-form>" + definition.fields.map(function (field) { return fieldHtml(view, field, state.draft[field.name], idPrefix); }).join("") + "<div class=\"hhcss__form-actions\"><button class=\"hhcss__primary\" type=\"submit\">" + escapeHtml(definition.action) + "</button><button type=\"button\" data-hhcss-reset>Đặt lại</button></div></form><footer><label class=\"hhcss__import\"><span>Nhập bản sao JSON</span><input type=\"file\" accept=\"application/json,.json\" data-hhcss-import></label><button type=\"button\" data-hhcss-export-state>Xuất workspace</button></footer></section>" +
      "<section class=\"hhcss__output-panel\" aria-labelledby=\"" + outputTitleId + "\"><header><div><span>Bước 02</span><h3 id=\"" + outputTitleId + "\" tabindex=\"-1\" data-hhcss-output-title>Kết quả của " + escapeHtml(definition.title) + "</h3></div><div class=\"hhcss__output-actions\"><button type=\"button\" data-hhcss-copy" + (state.output ? "" : " disabled") + ">Sao chép</button>" + definition.formats.map(function (format) { return "<button type=\"button\" data-hhcss-export=\"" + format + "\"" + (state.output ? "" : " disabled") + ">" + format.toUpperCase() + "</button>"; }).join("") + "</div></header><div class=\"hhcss__result\" data-hhcss-result>" + renderOutput(view, state.output) + "</div></section></div>" +
      "<section class=\"hhcss__history\" aria-labelledby=\"" + historyTitleId + "\"><header><div><span>Bước 03</span><h3 id=\"" + historyTitleId + "\" tabindex=\"-1\" data-hhcss-history-title>Lịch sử riêng của " + escapeHtml(definition.title) + "</h3></div><button type=\"button\" data-hhcss-clear-history" + (state.history.length ? "" : " disabled") + ">Xóa lịch sử</button></header><div class=\"hhcss__history-list\">" + renderHistory(state) + "</div></section><p class=\"hhcss__status\" role=\"status\" aria-live=\"polite\" aria-atomic=\"true\" data-hhcss-status></p></main>";
  }

  function collectDraft(form, view) {
    const data = new FormData(form);
    const draft = {};
    TOOL_DEFINITIONS[view].fields.forEach(function (field) { draft[field.name] = data.get(field.name); });
    return normalizeDraft(view, draft);
  }

  function copyText(text) {
    if (globalScope.navigator && globalScope.navigator.clipboard && globalScope.isSecureContext) return globalScope.navigator.clipboard.writeText(text);
    if (!globalScope.document) return Promise.reject(new Error("Clipboard không được hỗ trợ."));
    const area = globalScope.document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    globalScope.document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = globalScope.document.execCommand("copy"); } catch (_) { ok = false; }
    area.remove();
    return ok ? Promise.resolve() : Promise.reject(new Error("Không thể sao chép."));
  }

  function downloadText(payload, instance) {
    const BlobConstructor = globalScope.Blob || (typeof Blob !== "undefined" ? Blob : null);
    if (!globalScope.document || !BlobConstructor || !globalScope.URL || !globalScope.URL.createObjectURL) return false;
    const blob = new BlobConstructor([payload.content], { type: payload.mime });
    const url = globalScope.URL.createObjectURL(blob);
    instance.objectUrls.add(url);
    const anchor = globalScope.document.createElement("a");
    anchor.href = url;
    anchor.download = slug(payload.filename.replace(/\.[^.]+$/, "")) + payload.filename.slice(payload.filename.lastIndexOf("."));
    anchor.rel = "noopener";
    globalScope.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    const timer = globalScope.setTimeout(function () {
      globalScope.URL.revokeObjectURL(url);
      instance.objectUrls.delete(url);
      instance.timers.delete(timer);
    }, 1000);
    instance.timers.add(timer);
    return true;
  }

  function mount(root, options) {
    if (!root || typeof root.innerHTML !== "string") return null;
    unmount(root);
    const config = options && typeof options === "object" ? options : {};
    const view = VIEWS.includes(config.view) ? config.view : VIEWS[0];
    const requestedStorageKey = cleanText(config.storageKey, 180);
    if (!isAllowedStorageKey(view, requestedStorageKey)) {
      throw new Error("Vùng lưu không thuộc studio đang mở.");
    }
    const targetStorageKey = requestedStorageKey || STORAGE_KEYS[view];
    const storage = safeStorage(config.storage);
    const namespacedStorage = storage ? {
      getItem: function () { return storage.getItem(targetStorageKey); },
      setItem: function (_key, value) { return storage.setItem(targetStorageKey, value); },
      removeItem: function () { return storage.removeItem(targetStorageKey); }
    } : null;
    const instance = {
      root: root,
      view: view,
      mountId: "m" + (++mountSequence).toString(36),
      storage: namespacedStorage,
      state: loadState(view, namespacedStorage),
      controller: null,
      timers: new Set(),
      readers: new Set(),
      objectUrls: new Set(),
      autosaveTimer: null,
      draftDirty: false,
      destroyed: false
    };
    mountedRoots.set(root, instance);
    root.setAttribute("data-creative-specialist-studios", view);

    function announce(message) {
      if (instance.destroyed || mountedRoots.get(root) !== instance) return;
      const status = root.querySelector("[data-hhcss-status]");
      if (status) status.textContent = message;
    }

    function persist(message) {
      cancelAutosave();
      instance.draftDirty = false;
      const result = saveState(view, instance.state, instance.storage);
      if (message) announce(result.ok ? message : "Không thể lưu trên thiết bị này.");
      if (!instance.destroyed && typeof config.onChange === "function") {
        try { config.onChange(clone(instance.state), { view: view, saved: result.ok }); } catch (_) { announce("Dữ liệu đã lưu, nhưng giao diện ngoài không nhận được cập nhật."); }
      }
      return result;
    }

    function addListener(node, type, listener) {
      if (!node) return;
      if (instance.controller) node.addEventListener(type, listener, { signal: instance.controller.signal });
      else node.addEventListener(type, listener);
    }

    function cancelAutosave() {
      if (instance.autosaveTimer != null) globalScope.clearTimeout(instance.autosaveTimer);
      instance.autosaveTimer = null;
    }

    function scheduleAutosave() {
      cancelAutosave();
      instance.draftDirty = true;
      instance.autosaveTimer = globalScope.setTimeout(function () {
        instance.autosaveTimer = null;
        if (instance.destroyed || mountedRoots.get(root) !== instance) return;
        instance.draftDirty = false;
        persist("Bản nháp đã được tự động lưu.");
      }, 260);
    }

    function render() {
      if (instance.destroyed) return;
      if (instance.controller) instance.controller.abort();
      const AbortControllerConstructor = globalScope.AbortController || (typeof AbortController !== "undefined" ? AbortController : null);
      instance.controller = AbortControllerConstructor ? new AbortControllerConstructor() : null;
      root.innerHTML = workspaceHtml(view, instance.state, instance.mountId);
      const form = root.querySelector("[data-hhcss-form]");

      addListener(form, "input", function () {
        instance.state.draft = collectDraft(form, view);
        scheduleAutosave();
      });

      addListener(form, "submit", function (event) {
        event.preventDefault();
        if (!form.reportValidity()) return;
        instance.state.draft = collectDraft(form, view);
        instance.state.output = runGenerator(view, instance.state.draft);
        const now = new Date().toISOString();
        const baseId = "run-" + Date.now().toString(36) + "-" + hashSeed(JSON.stringify(instance.state.draft)).toString(36);
        let entryId = baseId;
        let entrySuffix = 2;
        while (instance.state.history.some(function (item) { return item.id === entryId; })) {
          entryId = baseId + "-" + entrySuffix;
          entrySuffix += 1;
        }
        const entry = {
          id: entryId,
          label: historyLabel(view, instance.state.draft),
          createdAt: now,
          draft: clone(instance.state.draft),
          output: clone(instance.state.output)
        };
        instance.state.history = [entry].concat(instance.state.history).slice(0, LIMITS.history);
        persist();
        render();
        announce("Đã tạo kết quả mới và lưu vào lịch sử riêng.");
        const heading = root.querySelector("[data-hhcss-output-title]");
        if (heading && heading.focus) heading.focus({ preventScroll: true });
      });

      addListener(root.querySelector("[data-hhcss-reset]"), "click", function () {
        const history = instance.state.history;
        instance.state = createDefaultState(view);
        instance.state.history = history;
        persist();
        render();
        announce("Đã đặt lại đầu vào và kết quả; lịch sử được giữ nguyên.");
        const firstField = root.querySelector("[data-hhcss-field]");
        if (firstField && firstField.focus) firstField.focus({ preventScroll: true });
      });

      addListener(root.querySelector("[data-hhcss-clear-history]"), "click", function () {
        instance.state.history = [];
        persist();
        render();
        announce("Đã xóa lịch sử của riêng studio này.");
        const historyHeading = root.querySelector("[data-hhcss-history-title]");
        if (historyHeading && historyHeading.focus) historyHeading.focus({ preventScroll: true });
      });

      addListener(root.querySelector("[data-hhcss-copy]"), "click", function () {
        if (!instance.state.output) return;
        copyText(outputToMarkdown(view, instance.state.output)).then(function () { announce("Đã sao chép kết quả."); }).catch(function (error) { announce(error.message); });
      });

      root.querySelectorAll("[data-hhcss-export]").forEach(function (button) {
        addListener(button, "click", function () {
          if (!instance.state.output) return;
          const payload = exportOutput(view, instance.state.output, button.getAttribute("data-hhcss-export"));
          announce(downloadText(payload, instance) ? "Đã chuẩn bị tệp " + payload.filename + "." : "Trình duyệt không hỗ trợ tải tệp.");
        });
      });

      addListener(root.querySelector("[data-hhcss-export-state]"), "click", function () {
        const payload = { filename: view + "-workspace.json", mime: "application/json;charset=utf-8", content: exportWorkspaceState(view, instance.state) };
        announce(downloadText(payload, instance) ? "Đã xuất workspace riêng của studio." : "Trình duyệt không hỗ trợ tải tệp.");
      });

      addListener(root.querySelector("[data-hhcss-import]"), "change", function (event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        if (file.size > LIMITS.importBytes) {
          announce("Tệp nhập vượt quá 1 MB.");
          event.target.value = "";
          return;
        }
        const FileReaderConstructor = globalScope.FileReader || (typeof FileReader !== "undefined" ? FileReader : null);
        if (!FileReaderConstructor) {
          announce("Trình duyệt không hỗ trợ đọc tệp.");
          event.target.value = "";
          return;
        }
        const reader = new FileReaderConstructor();
        const TextDecoderConstructor = globalScope.TextDecoder || (typeof TextDecoder !== "undefined" ? TextDecoder : null);
        const useStrictUtf8 = Boolean(TextDecoderConstructor && typeof reader.readAsArrayBuffer === "function");
        instance.readers.add(reader);
        reader.addEventListener("load", function () {
          instance.readers.delete(reader);
          if (instance.destroyed || mountedRoots.get(root) !== instance) return;
          try {
            const importedText = useStrictUtf8 ? new TextDecoderConstructor("utf-8", { fatal: true }).decode(reader.result) : reader.result;
            instance.state = importState(view, importedText);
            persist();
            render();
            announce("Đã nhập workspace đúng studio.");
          } catch (error) {
            const message = error && error.name === "TypeError" && useStrictUtf8 ? "Tệp không dùng mã hóa UTF-8 hợp lệ." : cleanText(error && error.message, 180);
            announce(message || "Không thể nhập workspace.");
          }
        }, { once: true });
        reader.addEventListener("error", function () {
          instance.readers.delete(reader);
          announce("Không thể đọc tệp đã chọn.");
        }, { once: true });
        reader.addEventListener("abort", function () { instance.readers.delete(reader); }, { once: true });
        if (useStrictUtf8) reader.readAsArrayBuffer(file);
        else reader.readAsText(file, "utf-8");
        event.target.value = "";
      });

      root.querySelectorAll("[data-hhcss-history-load]").forEach(function (button) {
        addListener(button, "click", function () {
          const entry = instance.state.history.find(function (item) { return item.id === button.getAttribute("data-hhcss-history-load"); });
          if (!entry) return;
          instance.state.draft = clone(entry.draft);
          instance.state.output = runGenerator(view, entry.draft);
          persist();
          render();
          announce("Đã mở phiên bản lịch sử.");
          const heading = root.querySelector("[data-hhcss-output-title]");
          if (heading && heading.focus) heading.focus({ preventScroll: true });
        });
      });

      root.querySelectorAll("[data-hhcss-history-delete]").forEach(function (button) {
        addListener(button, "click", function () {
          const id = button.getAttribute("data-hhcss-history-delete");
          instance.state.history = instance.state.history.filter(function (item) { return item.id !== id; });
          persist();
          render();
          announce("Đã xóa một phiên bản khỏi lịch sử studio.");
          const historyHeading = root.querySelector("[data-hhcss-history-title]");
          if (historyHeading && historyHeading.focus) historyHeading.focus({ preventScroll: true });
        });
      });
    }

    instance.render = render;
    render();
    return {
      view: view,
      getState: function () { return clone(instance.state); },
      generate: function (draft) {
        instance.state.draft = normalizeDraft(view, draft || instance.state.draft);
        instance.state.output = runGenerator(view, instance.state.draft);
        persist();
        render();
        return clone(instance.state.output);
      },
      unmount: function () { unmount(root); }
    };
  }

  function unmount(root) {
    const instance = root && mountedRoots.get(root);
    if (!instance) return false;
    if (instance.autosaveTimer != null) globalScope.clearTimeout(instance.autosaveTimer);
    instance.autosaveTimer = null;
    if (instance.draftDirty) saveState(instance.view, instance.state, instance.storage);
    instance.draftDirty = false;
    instance.destroyed = true;
    if (instance.controller) instance.controller.abort();
    instance.readers.forEach(function (reader) {
      try { if (reader.readyState === 1) reader.abort(); } catch (_) { /* Reader is already complete. */ }
    });
    instance.readers.clear();
    instance.timers.forEach(function (timer) { globalScope.clearTimeout(timer); });
    instance.timers.clear();
    instance.objectUrls.forEach(function (url) {
      try { globalScope.URL.revokeObjectURL(url); } catch (_) { /* URL was already released. */ }
    });
    instance.objectUrls.clear();
    root.removeAttribute("data-creative-specialist-studios");
    root.innerHTML = "";
    mountedRoots.delete(root);
    return true;
  }

  const api = Object.freeze({
    VERSION: VERSION,
    FORMAT: FORMAT,
    VIEWS: VIEWS,
    STORAGE_KEYS: STORAGE_KEYS,
    TOOL_DEFINITIONS: TOOL_DEFINITIONS,
    LIMITS: LIMITS,
    cleanText: cleanText,
    escapeHtml: escapeHtml,
    normalizeIdeaInput: normalizeIdeaInput,
    generateIdeaLab: generateIdeaLab,
    normalizeNamingInput: normalizeNamingInput,
    generateNamingStudio: generateNamingStudio,
    normalizeCopyInput: normalizeCopyInput,
    generateCopyStudio: generateCopyStudio,
    normalizeWritingInput: normalizeWritingInput,
    generateWritingRoom: generateWritingRoom,
    normalizeCampaignInput: normalizeCampaignInput,
    generateCampaignPlanner: generateCampaignPlanner,
    normalizePhotoInput: normalizePhotoInput,
    generatePhotoPlanner: generatePhotoPlanner,
    normalizePodcastInput: normalizePodcastInput,
    generatePodcastStudio: generatePodcastStudio,
    normalizeMotionInput: normalizeMotionInput,
    generateMotionPlanner: generateMotionPlanner,
    normalizeThreeDInput: normalizeThreeDInput,
    generateThreeDPlanner: generateThreeDPlanner,
    normalizePortfolioInput: normalizePortfolioInput,
    generatePortfolioBuilder: generatePortfolioBuilder,
    runGenerator: runGenerator,
    createDefaultState: createDefaultState,
    normalizeState: normalizeState,
    isAllowedStorageKey: isAllowedStorageKey,
    loadState: loadState,
    saveState: saveState,
    importState: importState,
    outputToMarkdown: outputToMarkdown,
    outputToCsv: outputToCsv,
    outputToHtml: outputToHtml,
    exportOutput: exportOutput,
    exportWorkspaceState: exportWorkspaceState,
    mount: mount,
    unmount: unmount
  });

  globalScope.HHCreativeSpecialistStudios = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
