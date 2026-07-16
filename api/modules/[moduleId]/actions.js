const {
  bodyOf,
  clean,
  currentUser,
  enforceRateLimit,
  ownerFrom,
  setCors,
  withApi
} = require("../../../utils/platform");

const downloadHosts = [
  "youtube.com", "youtu.be", "tiktok.com", "facebook.com", "fb.watch",
  "instagram.com", "twitter.com", "x.com", "reddit.com", "vimeo.com",
  "soundcloud.com", "twitch.tv", "pinterest.com", "tumblr.com", "bilibili.com"
];
const creativeModules = new Set(["ai-center", "ai-script", "creator-studio", "ai-automation"]);
const allowedModels = new Set(["gemini-3.5-flash", "gemini-3.1-flash-lite"]);
const contentPackSchema = {
  type: "object",
  properties: {
    title: { type: "string", description: "Ba đến năm tiêu đề có khả năng thu hút đúng đối tượng." },
    script: { type: "string", description: "Kịch bản hoàn chỉnh có hook, nội dung, cao trào, kết và CTA." },
    seo: { type: "string", description: "Từ khóa, search intent, hashtag và khuyến nghị tối ưu." },
    thumbnail: { type: "string", description: "Prompt thumbnail rõ bố cục, chủ thể, màu và chữ." },
    description: { type: "string", description: "Mô tả đăng tải đã tối ưu cho nền tảng." },
    outline: { type: "string", description: "Dàn ý sản xuất theo từng phần." },
    chapters: { type: "string", description: "Các chapter hoặc mốc nội dung phù hợp." },
    shorts: { type: "string", description: "Phiên bản short hoặc reel cô đọng." },
    calendar: { type: "string", description: "Lịch tái sử dụng nội dung trong bảy ngày." }
  },
  required: ["title", "script", "seo", "thumbnail", "description", "outline", "chapters", "shorts", "calendar"]
};

function geminiApiKey() {
  return String(
    process.env.GEMINI_API_KEY
    || process.env.GOOGLE_AI_API_KEY
    || ""
  ).trim();
}

function geminiKeySource() {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.GOOGLE_AI_API_KEY) return "google-ai";
  return "none";
}

function supportedDownloadUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return ["https:", "http:"].includes(url.protocol)
      && downloadHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

function requestIp(req) {
  return clean(String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "guest").split(",")[0], 120);
}

async function downloadCenterAction(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET") {
    return res.status(200).json({
      configured: Boolean(process.env.VIDEO_DOWNLOADER_API_URL),
      providers: downloadHosts
    });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để sử dụng trình tải." });
  const body = bodyOf(req);
  if (!supportedDownloadUrl(body.url)) {
    return res.status(400).json({ error: "Liên kết không hợp lệ hoặc nền tảng chưa được hỗ trợ." });
  }
  const endpoint = String(process.env.VIDEO_DOWNLOADER_API_URL || "").replace(/\/$/, "");
  if (!endpoint) {
    return res.status(503).json({
      error: "Máy chủ tải media chưa được cấu hình.",
      code: "DOWNLOADER_NOT_CONFIGURED"
    });
  }
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(process.env.VIDEO_DOWNLOADER_API_KEY
          ? { Authorization: `Api-Key ${process.env.VIDEO_DOWNLOADER_API_KEY}` }
          : {})
      },
      body: JSON.stringify({
        url: body.url,
        downloadMode: ["auto", "audio", "mute"].includes(body.downloadMode) ? body.downloadMode : "auto",
        videoQuality: ["max", "2160", "1080", "720", "480", "360"].includes(String(body.videoQuality))
          ? String(body.videoQuality)
          : "1080",
        audioFormat: "mp3",
        audioBitrate: ["320", "256", "128"].includes(String(body.audioBitrate))
          ? String(body.audioBitrate)
          : "128",
        filenameStyle: "pretty",
        youtubeVideoContainer: "mp4"
      }),
      signal: AbortSignal.timeout(9000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.status === "error") {
      return res.status(502).json({ error: data.error?.code || data.error || "Không thể xử lý liên kết này." });
    }
    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({ error: `Máy chủ tải không phản hồi: ${error.message}` });
  }
}

function localContentPack(input, meta = {}) {
  let data = {};
  try {
    data = JSON.parse(input || "{}");
  } catch {
    data = { topic: input };
  }
  const topic = clean(data.topic || data.title || "Chủ đề mới", 180);
  const platform = clean(data.platform || meta.platform || "YouTube", 60);
  const audience = clean(data.audience || "người xem phổ thông", 180);
  const tone = clean(data.tone || data.style || "cảm xúc, rõ ràng", 120);
  const cta = clean(data.cta || "Theo dõi để xem nội dung tiếp theo", 180);
  const keyword = clean(data.keyword || topic, 120);
  const tags = [...new Set(["HHCreator", platform.replace(/\W/g, ""), ...keyword.split(/\s+/).filter((word) => word.length > 3)])]
    .slice(0, 10)
    .map((tag) => `#${tag.replace(/[^\p{L}\p{N}_]/gu, "")}`)
    .join(" ");
  return {
    title: `1. ${topic}: Điều Ít Người Biết\n2. Tôi Đã Thử ${topic} Và Đây Là Kết Quả\n3. 7 Điều Quan Trọng Về ${topic}`,
    script: `HOOK\nNếu những điều bạn vẫn tin về ${topic.toLowerCase()} chưa hoàn toàn đúng thì sao?\n\nMỞ ĐẦU\nĐặt bối cảnh phù hợp với ${audience}.\n\nNỘI DUNG\n1. Vấn đề thực tế\n2. Ba luận điểm có ví dụ\n3. Bước ngoặt hoặc insight chính\n4. Hướng giải quyết có thể áp dụng\n\nKẾT\nTóm lại giá trị cốt lõi. ${cta}.`,
    seo: `Search intent: tìm hiểu và áp dụng\nTừ khóa chính: ${keyword}\nNền tảng: ${platform}\nTone: ${tone}\nHashtag: ${tags}`,
    thumbnail: `Bố cục 16:9, một chủ thể rõ, biểu cảm mạnh, tương phản cyan - magenta - vàng, chữ 3-5 từ “${topic.slice(0, 28).toUpperCase()}”, không watermark.`,
    description: `${topic} được trình bày theo phong cách ${tone.toLowerCase()} dành cho ${audience}. Nội dung gồm ví dụ thực tế, insight chính và các bước áp dụng.\n\n${cta}\n\n${tags}`,
    outline: "1. Hook tạo khoảng trống tò mò\n2. Bối cảnh và vấn đề\n3. Ba luận điểm có ví dụ\n4. Bước ngoặt\n5. Kết luận và CTA",
    chapters: "00:00 Mở đầu\n00:30 Vấn đề chính\n02:15 Bối cảnh\n04:00 Ba điểm quan trọng\n07:20 Bước ngoặt\n09:30 Kết luận",
    shorts: `HOOK 0-3s: “Bạn có đang hiểu sai về ${topic}?”\nVALUE 3-45s: Một insight, một ví dụ và một bước hành động.\nCTA 45-60s: ${cta}.`,
    calendar: Array.from({ length: 7 }, (_, index) => `Ngày ${index + 1}: ${["Video chính", "Short trích đoạn", "Bài hỏi đáp", "Carousel insight", "Hậu trường", "Case study", "Tổng kết tuần"][index]} · ${topic}`).join("\n")
  };
}

function localDraftOutput(actionType, input, meta = {}) {
  const text = clean(input || "Chưa có nội dung", 16000);
  const words = text.match(/[\p{L}\p{N}]+/gu) || [];
  const paragraphs = text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const opening = clean(paragraphs[0] || text, 240);
  const platform = clean(meta?.config?.platform || meta.platform || "đa nền tảng", 80);
  const goal = actionType === "rewrite" ? "tái cấu trúc mạnh" : "biên tập sâu";
  return {
    output: [
      `BẢN ${actionType === "rewrite" ? "VIẾT LẠI" : "BIÊN TẬP"} · HH LOCAL`,
      "",
      `Mục tiêu: ${goal} cho ${platform}`,
      `Quy mô bản gốc: ${words.length} từ · ${Math.max(1, paragraphs.length)} đoạn`,
      "",
      "HOOK ĐỀ XUẤT",
      `“${opening.replace(/[.!?]+$/, "").slice(0, 150)} — nhưng phần quan trọng nhất thường bị bỏ qua.”`,
      "",
      "CẤU TRÚC XUẤT BẢN",
      "1. Mở bằng vấn đề hoặc kết quả cụ thể.",
      "2. Đưa bối cảnh vừa đủ để người xem hiểu vì sao cần quan tâm.",
      "3. Chia thân bài thành ba luận điểm, mỗi luận điểm có ví dụ hoặc bằng chứng.",
      "4. Đặt insight mạnh nhất ở khoảng 60–75% thời lượng.",
      "5. Kết bằng một hành động rõ ràng, không dùng CTA chung chung.",
      "",
      "BẢN NHÁP ĐÃ CHUẨN HÓA",
      ...paragraphs.map((paragraph, index) => `${index + 1}. ${paragraph}`),
      "",
      "KIỂM TRA TRƯỚC KHI ĐĂNG",
      "□ Hook nêu lợi ích hoặc xung đột trong 2 câu đầu",
      "□ Mỗi đoạn chỉ truyền đạt một ý chính",
      "□ Có ví dụ, số liệu hoặc trải nghiệm kiểm chứng được",
      "□ Loại bỏ câu lặp và từ đệm",
      "□ CTA khớp đúng mục tiêu nội dung"
    ].join("\n")
  };
}

function localPlanOutput(input, meta = {}) {
  let data = {};
  try { data = JSON.parse(input || "{}"); } catch { data = { topic: input }; }
  const topic = clean(data.topic || data.title || data.input || input || "Chủ đề mới", 180);
  const platform = clean(data.platform || meta?.config?.platform || "YouTube", 80);
  const audience = clean(data.audience || meta?.config?.audience || "khán giả mục tiêu", 140);
  return {
    output: [
      `KẾ HOẠCH NỘI DUNG · ${topic}`,
      `Nền tảng chính: ${platform} · Đối tượng: ${audience}`,
      "",
      "MỤC TIÊU 30 NGÀY",
      "• Xây một trụ cột nội dung có nhận diện rõ.",
      "• Kiểm chứng ba góc tiếp cận bằng retention, lượt lưu và bình luận.",
      "• Tái sử dụng mỗi nội dung dài thành ít nhất ba tài sản ngắn.",
      "",
      "BỐN TUẦN TRIỂN KHAI",
      `Tuần 1 · Nhận biết: giải thích vấn đề cốt lõi của “${topic}”, khảo sát câu hỏi thật và tạo video nền.`,
      "Tuần 2 · Tin cậy: case study, hướng dẫn từng bước và bài phá bỏ hiểu lầm.",
      "Tuần 3 · Chuyển đổi: so sánh giải pháp, quy trình thực hành và CTA thử nghiệm.",
      "Tuần 4 · Cộng đồng: Q&A, phản hồi người xem, tổng kết dữ liệu và chọn chủ đề vòng tiếp theo.",
      "",
      "NHỊP ĐĂNG ĐỀ XUẤT",
      "Thứ 2: nội dung trụ cột · Thứ 3: short hook · Thứ 4: carousel/checklist",
      "Thứ 5: case study · Thứ 6: short phản biện · Cuối tuần: Q&A và tổng kết.",
      "",
      "KPI",
      "Retention 30 giây · thời lượng xem trung bình · tỷ lệ lưu/chia sẻ · bình luận có ý nghĩa · chuyển đổi CTA.",
      "",
      "QUY TẮC QUYẾT ĐỊNH",
      "Giữ chủ đề nếu retention và lượt lưu cùng tăng; đổi hook nếu impressions tốt nhưng retention thấp; đổi góc nội dung nếu ba lần thử liên tiếp không tạo bình luận chất lượng."
    ].join("\n")
  };
}

async function googleResearchOutput(input, actionType) {
  const key = String(process.env.GOOGLE_SEARCH_API_KEY || "").trim();
  const cx = String(process.env.GOOGLE_SEARCH_ENGINE_ID || "").trim();
  if (!key || !cx) return null;
  const urls = String(input || "").match(/https?:\/\/[^\s<>"']+/gi) || [];
  const queryText = String(input || "")
    .replace(/https?:\/\/[^\s<>"']+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const query = clean(queryText || urls.map((url) => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
  }).filter(Boolean).join(" ") || "xu hướng sáng tạo nội dung", 300);
  const params = new URLSearchParams({
    key,
    cx,
    q: query,
    num: "8",
    safe: "active",
    hl: "vi",
    gl: "vn"
  });
  const response = await fetch(`https://customsearch.googleapis.com/customsearch/v1?${params}`, {
    headers: { Accept: "application/json", "User-Agent": "HH-Creative-Research/1.0" },
    signal: AbortSignal.timeout(5500)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return null;
  const items = (data.items || []).slice(0, 8).map((item, index) => ({
    index: index + 1,
    title: clean(item.title, 240),
    url: clean(item.link, 1200),
    snippet: clean(item.snippet, 600)
  })).filter((item) => item.url);
  if (!items.length) return null;
  const sourceLines = items.map((item) => `[${item.index}] ${item.title}\n${item.snippet}\n${item.url}`);
  const angles = items.slice(0, 5).map((item, index) =>
    `${index + 1}. ${item.title}: chuyển thành góc “vấn đề → bằng chứng → ứng dụng → quan điểm riêng”.`
  );
  return {
    output: [
      actionType === "url-research" ? "NGHIÊN CỨU URL + GOOGLE" : "NGHIÊN CỨU GOOGLE",
      `Truy vấn: ${query}`,
      `Kết quả kiểm chứng được: ${items.length}`,
      urls.length ? `URL người dùng cung cấp: ${urls.slice(0, 20).join(", ")}` : "",
      "",
      "TÓM TẮT NGUỒN",
      ...sourceLines,
      "",
      "GÓC NỘI DUNG CÓ THỂ TRIỂN KHAI",
      ...angles,
      "",
      "CHECKLIST XÁC MINH",
      "□ Mở nguồn gốc thay vì chỉ dựa vào đoạn trích",
      "□ Kiểm tra ngày xuất bản và tác giả",
      "□ Đối chiếu ít nhất hai nguồn độc lập",
      "□ Tách dữ kiện khỏi nhận định",
      "□ Ghi nguồn cạnh số liệu khi xuất bản"
    ].filter(Boolean).join("\n\n"),
    sources: items.map((item) => ({ url: item.url, title: item.title, type: "google-search" })),
    model: "google-programmable-search",
    providerApi: "programmable-search",
    provider: "google-search"
  };
}

async function localCreativeOutput(moduleId, actionType, input, meta = {}) {
  if (actionType === "content-pack") {
    const structured = localContentPack(input, meta);
    return {
      output: Object.entries(structured).map(([key, value]) => `${key.toUpperCase()}\n${value}`).join("\n\n---\n\n"),
      structured
    };
  }
  if (actionType === "workflow") {
    let data = {};
    try { data = JSON.parse(input || "{}"); } catch { data = { input }; }
    const source = clean(data.input || input || "Chưa có dữ liệu", 6000);
    const steps = Array.isArray(data.steps) ? data.steps.filter((step) => step?.enabled !== false) : [];
    return {
      output: [
        "WORKFLOW SÁNG TẠO ĐÃ HOÀN TẤT",
        `Nền tảng: ${clean(data.platform || "YouTube", 60)}`,
        `Ngôn ngữ: ${clean(data.language || "Tiếng Việt", 60)}`,
        `Phong cách: ${clean(data.style || "Cảm xúc", 60)}`,
        "",
        ...steps.map((step, index) => `BƯỚC ${index + 1} · ${clean(step.id || step, 80).toUpperCase()}\n${source.slice(0, 900)}`),
        "",
        "Checklist: kiểm tra dữ kiện, bản quyền, chính tả, CTA và định dạng trước khi xuất bản."
      ].join("\n\n")
    };
  }
  if (actionType === "translate") {
    return { output: `BẢN DỊCH KIỂM TRA\n\n${input}\n\nGhi chú: máy chủ đang dùng bộ xử lý local; hãy kiểm tra tên riêng và thuật ngữ trước khi xuất bản.` };
  }
  if (actionType === "analysis") {
    const wordTotal = (String(input).match(/[\p{L}\p{N}]+/gu) || []).length;
    return {
      output: `PHÂN TÍCH KỊCH BẢN\n\nSố từ: ${wordTotal}\nThời lượng voice ước tính: ${Math.max(1, wordTotal / 145).toFixed(1)} phút\n\nƯu tiên cải thiện:\n1. Hook rõ trong 20 giây đầu.\n2. Xung đột tăng dần và có bằng chứng cụ thể.\n3. Cao trào buộc nhân vật phải lựa chọn.\n4. Kết thúc có dư âm và CTA mềm.\n5. Kiểm tra tính nguyên bản trước khi đăng.`
    };
  }
  if (["rewrite", "improve"].includes(actionType)) {
    return localDraftOutput(actionType, input, meta);
  }
  if (actionType === "plan") {
    return localPlanOutput(input, meta);
  }
  if (["research", "url-research"].includes(actionType)) {
    const research = await googleResearchOutput(input, actionType).catch(() => null);
    if (research) return research;
  }
  if (actionType === "chat") {
    return {
      output: [
        "HH Creative AI đã phân tích yêu cầu.",
        "",
        `Yêu cầu: ${input || "Chưa có nội dung"}`,
        "",
        "Hướng xử lý đề xuất:",
        "1. Xác định mục tiêu và đầu ra cần đạt.",
        "2. Chia nhiệm vụ thành các bước có thể kiểm tra.",
        "3. Bổ sung ví dụ, giới hạn và tiêu chí chất lượng.",
        "4. Tự kiểm tra kết quả trước khi sử dụng.",
        "",
        "Phiên này đã được lưu vào lịch sử tài khoản."
      ].join("\n")
    };
  }
  return {
    output: [
      `Backend đã nhận tác vụ cho ${moduleId}.`,
      "",
      `Tác vụ: ${actionType}`,
      `Dữ liệu: ${input || "Không có dữ liệu"}`,
      "",
      "Dữ liệu đã được lưu vào MongoDB."
    ].join("\n")
  };
}

function systemInstruction(moduleId, actionType) {
  const common = "Bạn là HH Creative AI, trợ lý sản xuất nội dung cao cấp. Trả lời bằng tiếng Việt tự nhiên, có cấu trúc, không bịa dữ kiện, nêu rõ điểm chưa chắc chắn, tôn trọng bản quyền và luôn tạo đầu ra có thể dùng ngay.";
  const rules = {
    "ai-center": "Phân tích mục tiêu, trả lời trực tiếp, đưa ví dụ thực tế và kết thúc bằng checklist hành động.",
    "ai-script": "Đóng vai biên kịch và script editor. Tập trung vào hook, retention, mạch truyện, cao trào, tính nguyên bản, lời thoại tự nhiên và CTA mềm.",
    "creator-studio": "Đóng vai chiến lược gia nội dung đa nền tảng. Tối ưu tiêu đề, SEO, kịch bản, thumbnail, short và lịch tái sử dụng.",
    "ai-automation": "Đóng vai content operations engineer. Thực hiện đúng từng bước pipeline, giữ nhất quán dữ liệu và trả kết quả có nhãn rõ."
  };
  return `${common}\n\n${rules[moduleId] || rules["ai-center"]}\nTác vụ hiện tại: ${actionType}.`;
}

function promptFor(moduleId, actionType, input, meta = {}) {
  const context = typeof meta.context === "string" ? clean(meta.context, 12000) : "";
  const config = meta.config && typeof meta.config === "object" ? JSON.stringify(meta.config, null, 2).slice(0, 12000) : "";
  const actionNotes = {
    rewrite: "Viết lại thành bản hoàn chỉnh. Giữ ý lõi nhưng thay cấu trúc và câu chữ, tăng hook, nhịp giữ chân, cao trào và kết.",
    improve: "Biên tập sâu bản nháp: sửa logic, nhịp, lời thoại, độ rõ, độ mới và khả năng đọc voice.",
    analysis: "Phân tích định lượng và định tính; chấm hook, cấu trúc, cảm xúc, retention, originality, CTA và đưa các sửa đổi ưu tiên.",
    translate: "Dịch tự nhiên sang ngôn ngữ đích trong cấu hình, giữ tone, tên riêng và ý nghĩa; không dịch máy từng chữ.",
    chat: "Trả lời câu hỏi dựa trên ngữ cảnh kịch bản/dự án nếu có.",
    plan: "Tạo kế hoạch nội dung có mục tiêu, chuỗi tập, lịch đăng, KPI, rủi ro và checklist.",
    research: "Nghiên cứu bằng Google Search, tách dữ kiện với suy luận, ghi nguồn ngay cạnh luận điểm.",
    "url-research": "Dùng URL context và Google Search để tổng hợp các URL, so sánh góc nhìn và đề xuất hướng nội dung nguyên bản.",
    workflow: "Chạy toàn bộ pipeline theo đúng thứ tự các bước đã bật; mỗi phần phải có tiêu đề và đầu ra hoàn chỉnh.",
    "content-pack": "Tạo gói nội dung hoàn chỉnh theo JSON schema. Mỗi trường phải là nội dung thực, không phải hướng dẫn chung."
  };
  return [
    actionNotes[actionType] || "Thực hiện yêu cầu với chất lượng xuất bản.",
    config ? `\nCẤU HÌNH\n${config}` : "",
    context ? `\nNGỮ CẢNH\n${context}` : "",
    `\nDỮ LIỆU NGƯỜI DÙNG\n${input || "Chưa có dữ liệu."}`
  ].join("\n");
}

function generatedText(data) {
  const parts = [];
  for (const candidate of data?.candidates || []) {
    for (const part of candidate?.content?.parts || []) {
      if (typeof part?.text === "string" && part.text.trim()) parts.push(part.text.trim());
    }
  }
  return parts.join("\n").trim();
}

function interactionText(data) {
  const parts = [];
  for (const step of data?.steps || []) {
    if (step?.type !== "model_output") continue;
    for (const content of step.content || []) {
      if (content?.type === "text" && typeof content.text === "string" && content.text.trim()) {
        parts.push(content.text.trim());
      }
    }
  }
  return parts.join("\n").trim();
}

function generatedSources(data) {
  const sources = [];
  const seen = new Set();
  const add = (url, title, type) => {
    const normalized = clean(url, 1200);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    sources.push({
      url: normalized,
      title: clean(title || normalized, 240),
      type
    });
  };
  for (const candidate of data?.candidates || []) {
    for (const chunk of candidate?.groundingMetadata?.groundingChunks || []) {
      add(chunk?.web?.uri, chunk?.web?.title, "google-search");
    }
    for (const item of candidate?.urlContextMetadata?.urlMetadata || []) {
      add(item?.retrievedUrl, item?.retrievedUrl, "url-context");
    }
  }
  return sources.slice(0, 20);
}

function interactionSources(data) {
  const sources = [];
  const seen = new Set();
  for (const step of data?.steps || []) {
    for (const content of step?.content || []) {
      for (const annotation of content?.annotations || []) {
        const url = clean(annotation?.url, 1200);
        if (!url || seen.has(url)) continue;
        seen.add(url);
        sources.push({
          url,
          title: clean(annotation?.title || url, 240),
          type: annotation?.type === "url_citation" ? "url-context" : "google-search"
        });
      }
    }
  }
  return sources.slice(0, 20);
}

function safeJson(text) {
  try {
    return JSON.parse(String(text || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    return null;
  }
}

async function runInteractionsGemini({
  apiKey,
  model,
  prompt,
  instruction,
  temperature,
  useGoogleSearch,
  useUrlContext,
  useStructuredOutput
}) {
  const payload = {
    model,
    input: prompt,
    system_instruction: instruction,
    generation_config: {
      temperature,
      max_output_tokens: useStructuredOutput ? 8192 : 4096,
      thinking_level: "low"
    },
    tools: [
      ...(useUrlContext ? [{ type: "url_context" }] : []),
      ...(useGoogleSearch ? [{ type: "google_search" }] : [])
    ],
    ...(useStructuredOutput
      ? { response_format: [{ type: "text", mime_type: "application/json", schema: contentPackSchema }] }
      : {}),
    stream: false,
    background: false,
    store: false
  };
  if (!payload.tools.length) delete payload.tools;
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta2/interactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(7500)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(clean(data?.error?.message || `Interactions API lỗi HTTP ${response.status}.`, 300));
    error.code = "GEMINI_INTERACTIONS_ERROR";
    throw error;
  }
  const output = interactionText(data);
  if (!output) throw new Error(`Interactions API không trả về nội dung (${clean(data?.status || "NO_CONTENT", 80)}).`);
  return {
    output,
    structured: useStructuredOutput ? safeJson(output) : null,
    model,
    interactionId: clean(data.id, 240),
    usage: data.usage || null,
    sources: interactionSources(data),
    providerApi: "interactions-v1beta2"
  };
}

async function runGemini(moduleId, actionType, input, meta = {}) {
  const apiKey = geminiApiKey();
  const requestedModel = clean(meta.model, 80);
  if (!apiKey || requestedModel === "local") return null;
  const model = allowedModels.has(requestedModel)
    ? requestedModel
    : (allowedModels.has(process.env.GEMINI_MODEL) ? process.env.GEMINI_MODEL : "gemini-3.5-flash");
  const useGoogleSearch = ["research", "url-research"].includes(actionType);
  const useUrlContext = actionType === "url-research";
  const useStructuredOutput = actionType === "content-pack";
  const creativity = Number(meta.creativity);
  const temperature = Number.isFinite(creativity)
    ? Math.max(0.2, Math.min(1.2, creativity / 100))
    : 0.72;
  const prompt = promptFor(moduleId, actionType, input, meta);
  const instruction = systemInstruction(moduleId, actionType);
  const tools = [
    ...(useUrlContext ? [{ url_context: {} }] : []),
    ...(useGoogleSearch ? [{ google_search: {} }] : [])
  ];
  const payload = {
    systemInstruction: {
      parts: [{ text: instruction }]
    },
    contents: [{
      role: "user",
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature,
      maxOutputTokens: useStructuredOutput ? 8192 : 4096,
      ...(useStructuredOutput
        ? { responseMimeType: "application/json", responseSchema: contentPackSchema }
        : {})
    },
    ...(tools.length ? { tools } : {})
  };
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8500)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const generateError = clean(data?.error?.message || `GenerateContent lỗi HTTP ${response.status}.`, 300);
    if ([400, 403, 404].includes(response.status)) {
      try {
        return await runInteractionsGemini({
          apiKey,
          model,
          prompt,
          instruction,
          temperature,
          useGoogleSearch,
          useUrlContext,
          useStructuredOutput
        });
      } catch (interactionError) {
        const error = new Error(clean(`${generateError} Interactions: ${interactionError.message}`, 300));
        error.code = "GEMINI_PROVIDER_ERROR";
        throw error;
      }
    }
    const error = new Error(generateError);
    error.code = "GEMINI_PROVIDER_ERROR";
    throw error;
  }
  const output = generatedText(data);
  if (!output) {
    return runInteractionsGemini({
      apiKey,
      model,
      prompt,
      instruction,
      temperature,
      useGoogleSearch,
      useUrlContext,
      useStructuredOutput
    });
  }
  return {
    output,
    structured: useStructuredOutput ? safeJson(output) : null,
    model,
    interactionId: clean(data.responseId, 240),
    usage: data.usageMetadata || null,
    sources: generatedSources(data),
    providerApi: "generateContent"
  };
}

module.exports = async function handler(req, res) {
  if (req.query.moduleId === "download-center") return downloadCenterAction(req, res);
  return withApi(req, res, async ({ db, body }) => {
    const moduleId = clean(req.query.moduleId, 120);
    const collection = db.collection("moduleActions");
    if (req.method === "GET") {
      const actions = await collection.find({ moduleId }).sort({ createdAt: -1 }).limit(50).toArray();
      return res.status(200).json({
        moduleId,
        configured: creativeModules.has(moduleId) ? Boolean(geminiApiKey()) : undefined,
        keySource: creativeModules.has(moduleId) ? geminiKeySource() : undefined,
        defaultModel: "gemini-3.5-flash",
        actions
      });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const user = await currentUser(req);
    if (creativeModules.has(moduleId)) {
      const actor = user?._id ? String(user._id) : requestIp(req);
      await enforceRateLimit(db, `creative-ai:${actor}`, user ? 60 : 24, 10 * 60 * 1000);
    }

    const input = clean(body.input, 48000);
    const actionType = clean(body.actionType || "run", 80);
    const meta = body.meta && typeof body.meta === "object" ? body.meta : {};
    let result = null;
    let provider = "local";
    let providerError = "";

    if (creativeModules.has(moduleId)) {
      try {
        result = await runGemini(moduleId, actionType, input, meta);
        if (result) provider = "gemini";
      } catch (error) {
        providerError = clean(error.message, 260);
      }
    }
    if (!result) {
      result = await localCreativeOutput(moduleId, actionType, input, meta);
      if (result.provider) provider = result.provider;
    }

    const doc = {
      moduleId,
      actionType,
      input,
      output: result.output,
      structured: result.structured || null,
      provider,
      providerError,
      model: result.model || "hh-local",
      interactionId: result.interactionId || "",
      usage: result.usage || null,
      sources: result.sources || [],
      providerApi: result.providerApi || (provider === "local" ? "local" : ""),
      meta,
      ...ownerFrom(user, body),
      createdAt: new Date()
    };
    const insert = await collection.insertOne(doc);
    await db.collection("events").insertOne({
      type: "module:action",
      moduleId,
      actionType,
      provider,
      actionId: insert.insertedId,
      createdAt: new Date()
    });
    return res.status(200).json({ ok: true, action: { ...doc, _id: insert.insertedId } });
  });
};
