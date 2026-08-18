const {
  bodyOf,
  clean,
  currentUser,
  database,
  enforceRateLimit,
  isAdminUser,
  ownerFrom,
  setCors,
  withApi
} = require("../../../utils/platform");
const { Readable } = require("node:stream");
const {
  GeminiKeyPool,
  canTryAnotherKey,
  parseGeminiKeys
} = require("../../../utils/gemini-key-pool");
const {
  OPENAI_MODELS,
  normalizeOpenAIModel,
  parseOpenAIKeys,
  runOpenAIResponse
} = require("../../../utils/openai-provider");
const { createHmac } = require("node:crypto");
const { handleComicSource } = require("../../../utils/comic-source");
const { handleComicMotionApi } = require("../../../utils/comic-motion-api");
const { handleMangaDexSource } = require("../../../utils/mangadex-source");
const { handleOTruyenSource } = require("../../../utils/otruyen-source");
const { handleOpenBooksSource } = require("../../../utils/open-books-source");
const handleEducation = require("../../../utils/education-handler");
const handleSocialMedia = require("../../../utils/social-media-handler");

const downloadHosts = [
  "youtube.com", "youtu.be", "tiktok.com", "facebook.com", "fb.watch",
  "instagram.com", "twitter.com", "x.com", "reddit.com", "vimeo.com",
  "soundcloud.com", "twitch.tv", "pinterest.com", "tumblr.com", "bilibili.com"
];
const downloadCapabilities = ["single", "collection", "channel"];
const creativeModules = new Set(["ai-center", "chat-ai", "fortune", "ai-script", "creator-studio", "ai-automation", "music-ai", "creative-os", "image-text", "youtube-batch", "tiktok-creator"]);
const CHAT_AI_ACTIONS = new Set(["chat", "research", "code", "write", "study", "vision"]);
const allowedModels = new Set(["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.1-pro-preview"]);
const contentPackSchema = {
  type: "object",
  additionalProperties: false,
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
const designPlanSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string", description: "Tóm tắt concept và mục tiêu thiết kế có thể triển khai ngay." },
    layout: { type: "string", description: "Bố cục, phân cấp thị giác, grid và hành vi responsive." },
    palette: { type: "array", items: { type: "string" }, description: "Danh sách màu HEX hoặc token màu có vai trò rõ ràng." },
    typography: { type: "string", description: "Cặp font, cỡ chữ, độ đậm, line-height và fallback hỗ trợ tiếng Việt." },
    components: { type: "array", items: { type: "string" }, description: "Các component hoặc layer cần tạo trong tài liệu thiết kế." },
    responsive: { type: "string", description: "Constraints và thay đổi ở desktop, tablet và mobile." },
    accessibility: { type: "array", items: { type: "string" }, description: "Các yêu cầu contrast, focus, alt text và reduced motion." },
    nextActions: { type: "array", items: { type: "string" }, description: "Các bước tiếp theo theo thứ tự ưu tiên." }
  },
  required: ["summary", "layout", "palette", "typography", "components", "responsive", "accessibility", "nextActions"]
};
const imageTextBatchSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          index: { type: "integer", description: "Số thứ tự hiển thị trên contact sheet." },
          filename: { type: "string", description: "Tên file gốc tương ứng." },
          title: { type: "string", description: "Cụm chữ chính ngắn, tự nhiên, dùng được ngay trên thumbnail." },
          youtubeTitle: { type: "string", description: "Tiêu đề YouTube nguyên bản, tối đa 100 ký tự, phù hợp chủ đề và tín hiệu xu hướng được cung cấp." },
          subtitle: { type: "string", description: "Phụ đề ngắn bổ trợ, có thể để trống." },
          outputName: { type: "string", description: "Tên file xuất không có phần mở rộng." },
          textColor: { type: "string", description: "Màu chữ HEX dễ đọc trên ảnh, ví dụ #FFFFFF." }
        },
        required: ["index", "filename", "title", "youtubeTitle", "subtitle", "outputName", "textColor"]
      }
    }
  },
  required: ["items"]
};
const musicAutopilotPlanSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    concept: { type: "string", description: "Creative direction nguyên bản, không bắt chước nghệ sĩ hoặc bài hát cụ thể." },
    genre: { type: "string", description: "Thể loại và nhánh phong cách." },
    mood: { type: "string", description: "Cảm xúc và đường cong năng lượng." },
    bpm: { type: "integer", description: "BPM mục tiêu từ 35 đến 220." },
    musicalKey: { type: "string", description: "Tông hoặc thang âm đề xuất." },
    language: { type: "string", description: "Ngôn ngữ lời hát." },
    instrumental: { type: "boolean", description: "True nếu không có giọng hát." },
    lyrics: { type: "string", description: "Lời nguyên bản có nhãn section; để trống cho instrumental." },
    structure: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          durationSeconds: { type: "integer" },
          direction: { type: "string" },
          energy: { type: "integer" }
        },
        required: ["name", "durationSeconds", "direction", "energy"]
      }
    },
    musicPrompt: { type: "string", description: "Prompt sản xuất nhạc gồm BPM, nhạc cụ, cấu trúc, vocals và negative directions." },
    negativePrompt: { type: "string", description: "Những đặc điểm phải tránh." },
    artworkPrompt: { type: "string", description: "Prompt key visual không chứa logo, watermark hoặc nhân vật có bản quyền." },
    motionPrompt: { type: "string", description: "Prompt visualizer hoặc loop video điện ảnh." },
    titles: { type: "array", items: { type: "string" } },
    description: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    chapters: { type: "array", items: { type: "string" } },
    rightsWarnings: { type: "array", items: { type: "string" } }
  },
  required: ["concept", "genre", "mood", "bpm", "musicalKey", "language", "instrumental", "lyrics", "structure", "musicPrompt", "negativePrompt", "artworkPrompt", "motionPrompt", "titles", "description", "tags", "chapters", "rightsWarnings"]
};
const youtubeBatchMetadataSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          index: { type: "integer", minimum: 1, maximum: 10 },
          filename: { type: "string", maxLength: 240 },
          title: { type: "string", maxLength: 100 },
          description: { type: "string", maxLength: 5000 },
          tags: { type: "array", maxItems: 15, items: { type: "string", maxLength: 80 } },
          thumbnailTitle: { type: "string", maxLength: 80 },
          thumbnailSubtitle: { type: "string", maxLength: 80 }
        },
        required: ["index", "filename", "title", "description", "tags", "thumbnailTitle", "thumbnailSubtitle"]
      }
    }
  },
  required: ["items"]
};

function imageTextBatchImages(meta = {}) {
  const direct = Array.isArray(meta.images) ? meta.images : [];
  const sanitized = direct.slice(0, 20).map((entry, position) => ({
    index: Math.max(1, Math.min(20, Number(entry?.index) || position + 1)),
    filename: clean(entry?.filename || entry?.name || `image-${position + 1}`, 180)
  })).filter((entry) => entry.filename);
  if (sanitized.length) return sanitized;
  const list = String(meta.context || "").split(/DANH S[\s\S]*?NH/i).at(-1) || "";
  return list.split(/\r?\n/).map((line, position) => {
    const match = line.match(/^\s*(\d{1,3})\.\s+(.+?)\s*$/);
    return match ? { index: Math.max(1, Math.min(20, Number(match[1]) || position + 1)), filename: clean(match[2], 180) } : null;
  }).filter(Boolean).slice(0, 20);
}

function safeImageTextFilename(value = "") {
  return clean(value, 180)
    .replace(/\.[a-z0-9]{1,8}$/i, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 86) || "thumbnail";
}

function localImageTextBatchOutput(input, meta = {}) {
  const images = imageTextBatchImages(meta);
  const language = clean(meta.titleLanguage, 12).toLowerCase();
  const topic = clean(meta.youtubeTopic || String(input || "").replace(/^.*?:\s*/m, ""), 70) || "calm visual story";
  const phraseSets = {
    vi: ["Khoảnh khắc yên bình", "Nắng dịu buổi sớm", "Góc nhỏ bình yên", "Chậm lại một chút", "Bình yên rất gần", "Một ngày nhẹ nhàng"],
    ja: ["穏やかな時間", "朝のやさしい光", "静かな暮らし", "小さな休息", "心ほどける景色", "ゆっくり深呼吸"],
    ko: ["고요한 순간", "부드러운 아침", "느린 하루", "따뜻한 빛", "잠시의 휴식", "평온한 풍경"],
    en: ["Quiet Moments", "Soft Morning", "Slow Living", "Golden Stillness", "A Gentle Escape", "Peaceful Light"]
  };
  const subtitles = {
    vi: "Thở chậm và tận hưởng",
    ja: "深呼吸して、ゆっくりと",
    ko: "천천히 숨을 고르세요",
    en: "Breathe slowly, stay awhile"
  };
  const selectedLanguage = phraseSets[language] ? language : "en";
  const phrases = phraseSets[selectedLanguage];
  const structured = {
    items: images.map((image, position) => {
      const phrase = phrases[position % phrases.length];
      const textTitle = phrase.split(/\s+/).slice(0, 4).join(" ");
      return {
        index: image.index,
        filename: image.filename,
        title: textTitle,
        youtubeTitle: `${phrase} | ${topic}`.replace(/\s+/g, " ").trim().slice(0, 100),
        subtitle: subtitles[selectedLanguage],
        outputName: `${safeImageTextFilename(image.filename)}-${safeImageTextFilename(phrase)}`.slice(0, 120),
        textColor: "#FFFFFF"
      };
    })
  };
  return {
    output: JSON.stringify(structured),
    structured,
    provider: "local-image-text",
    model: "hh-thumbnail-local-v1"
  };
}

function schemaForAction(actionType) {
  if (actionType === "content-pack") return contentPackSchema;
  if (actionType === "design-plan") return designPlanSchema;
  if (["image-text-batch", "image-text-youtube-batch"].includes(actionType)) return imageTextBatchSchema;
  if (actionType === "youtube-batch-metadata") return youtubeBatchMetadataSchema;
  if (actionType === "music-autopilot-plan") return musicAutopilotPlanSchema;
  return null;
}

function geminiSchema(schema) {
  if (!schema || typeof schema !== "object") return null;
  const output = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "additionalProperties") continue;
    if (key === "properties" && value && typeof value === "object") {
      output.properties = Object.fromEntries(
        Object.entries(value).map(([property, propertySchema]) => [property, geminiSchema(propertySchema)])
      );
    } else if (key === "items") {
      output.items = geminiSchema(value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

let cachedGeminiPool = null;
let cachedGeminiPoolSignature = "";
let cachedOpenAIPool = null;
let cachedOpenAIPoolSignature = "";

function geminiKeys() {
  return parseGeminiKeys(process.env);
}

function geminiPool() {
  const keys = geminiKeys();
  const signature = keys.join("\u001f");
  if (!cachedGeminiPool || signature !== cachedGeminiPoolSignature) {
    cachedGeminiPool = new GeminiKeyPool(keys, {
      maxAttempts: Math.min(8, Math.max(1, Number(process.env.GEMINI_MAX_KEY_ATTEMPTS) || 4))
    });
    cachedGeminiPoolSignature = signature;
  }
  return cachedGeminiPool;
}

function geminiKeySource() {
  if (process.env.GEMINI_API_KEYS) return "gemini-pool";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.GOOGLE_AI_API_KEY) return "google-ai";
  return "none";
}

function openAIKeys() {
  return parseOpenAIKeys(process.env);
}

function openAIPool() {
  const keys = openAIKeys();
  const signature = keys.join("\u001f");
  if (!cachedOpenAIPool || signature !== cachedOpenAIPoolSignature) {
    cachedOpenAIPool = new GeminiKeyPool(keys, {
      maxAttempts: Math.min(4, Math.max(1, Number(process.env.OPENAI_MAX_KEY_ATTEMPTS) || 2))
    });
    cachedOpenAIPoolSignature = signature;
  }
  return cachedOpenAIPool;
}

function openAIKeySource() {
  if (process.env.OPENAI_API_KEYS) return "openai-pool";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "none";
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-12)
    .map((message) => ({
      role: message?.role === "model" || message?.role === "assistant" ? "model" : "user",
      text: clean(message?.text || message?.content, 6000)
    }))
    .filter((message) => message.text);
}

function sanitizeAttachments(attachments) {
  if (!Array.isArray(attachments)) return [];
  const supported = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]);
  return attachments
    .slice(0, 2)
    .map((attachment) => {
      const mimeType = clean(attachment?.mimeType || attachment?.type, 80).toLowerCase();
      const data = String(attachment?.data || "").replace(/^data:[^;]+;base64,/, "");
      if (!supported.has(mimeType) || !/^[a-z0-9+/=\r\n]+$/i.test(data) || data.length > 2_100_000) return null;
      return {
        name: clean(attachment?.name || "image", 180),
        mimeType,
        size: Math.min(Number(attachment?.size) || Math.ceil(data.length * 0.75), 1_600_000),
        data
      };
    })
    .filter(Boolean);
}

function storedMeta(meta = {}) {
  const blocked = /key|token|secret|password|authorization|cookie/i;
  const safe = {};
  for (const [key, value] of Object.entries(meta || {})) {
    if (blocked.test(key) || key === "history" || key === "attachments") continue;
    if (["string", "number", "boolean"].includes(typeof value)) safe[key] = typeof value === "string" ? clean(value, 2000) : value;
  }
  const history = sanitizeHistory(meta.history);
  const attachments = sanitizeAttachments(meta.attachments);
  safe.historyCount = history.length;
  safe.attachments = attachments.map(({ name, mimeType, size }) => ({ name, mimeType, size }));
  return safe;
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

const musicMediaActions = new Set(["music-image", "design-image", "music-track", "music-lyria", "music-sfx", "music-video-start", "music-video-status"]);

function musicProviderStatus(user) {
  const geminiConfigured = geminiKeys().length > 0;
  return {
    ownerOnly: true,
    canRunMedia: isAdminUser(user),
    providers: {
      concept: { configured: geminiConfigured, provider: "Gemini", model: process.env.GEMINI_MODEL || "gemini-3.5-flash", capabilities: ["brief", "prompt-pack", "metadata", "research"] },
      image: { configured: geminiConfigured, provider: "Gemini Images", model: process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image", capabilities: ["text-to-image", "reference-image", "16:9", "1K-4K"] },
      video: { configured: geminiConfigured, provider: "Google Veo", model: process.env.GEMINI_VIDEO_MODEL || "veo-3.1-fast-generate-preview", capabilities: ["text-to-video", "image-to-video", "16:9", "9:16", "720p-4K"] },
      lyria: { configured: geminiConfigured, provider: "Gemini Lyria", model: process.env.GEMINI_LYRIA_MODEL || "lyria-3-clip-preview", capabilities: ["clip-30s", "full-song", "vocals", "timed-lyrics", "image-to-music", "SynthID"] },
      music: { configured: Boolean(clean(process.env.ELEVENLABS_API_KEY, 400)), provider: "Eleven Music", model: process.env.ELEVEN_MUSIC_MODEL || "music_v2", capabilities: ["instrumental", "vocals", "3-120s-direct", "composition-plan", "inpainting", "C2PA"] },
      sound: { configured: Boolean(clean(process.env.ELEVENLABS_API_KEY, 400)), provider: "Eleven Sound Effects", model: process.env.ELEVEN_SFX_MODEL || "eleven_text_to_sound_v2", capabilities: ["ambience", "foley", "one-shot", "loop", "0.5-30s"] },
      stems: { configured: Boolean(clean(process.env.MUSIC_STEM_API_URL, 1000)), provider: "Demucs Worker", model: "htdemucs", capabilities: ["vocals", "drums", "bass", "other", "karaoke", "acapella"] },
      realtime: { configured: geminiConfigured, experimental: true, provider: "Lyria RealTime", model: "lyria-realtime-exp", capabilities: ["websocket", "weighted-prompts", "bpm", "density", "live-steering"] },
      renderer: { configured: true, cloudConfigured: Boolean(clean(process.env.MUSIC_RENDER_API_URL, 1000)), provider: "Local FFmpeg", model: "FFmpeg", capabilities: ["batch-script", "long-form", "1080p-4K", "local-files"] }
    }
  };
}

function musicBody(req) {
  if (typeof req.body === "string") {
    if (Buffer.byteLength(req.body, "utf8") > 3_200_000) {
      const error = new Error("Music media request is too large.");
      error.statusCode = 413;
      throw error;
    }
    return JSON.parse(req.body || "{}");
  }
  return req.body && typeof req.body === "object" ? req.body : {};
}

function providerError(message, status = 502, code = "MUSIC_PROVIDER_ERROR") {
  const error = new Error(clean(message, 300));
  error.statusCode = status;
  error.code = code;
  return error;
}

async function withGeminiMediaKey(task) {
  const pool = geminiPool();
  if (!pool.keys.length) throw providerError("Gemini media chưa được cấu hình trên máy chủ.", 503, "GEMINI_NOT_CONFIGURED");
  const candidates = pool.candidates();
  let lastError = null;
  for (let index = 0; index < candidates.length; index += 1) {
    const key = candidates[index];
    try {
      const result = await task(key);
      pool.reportSuccess(key);
      return result;
    } catch (error) {
      lastError = error;
      const status = Number(error.status || error.statusCode || 0);
      pool.reportFailure(key, status, error.message);
      if (!canTryAnotherKey(status, error.message) || index === candidates.length - 1) break;
    }
  }
  throw lastError || providerError("Gemini media không phản hồi.");
}

function interactionImage(data) {
  for (const step of data?.steps || []) {
    if (step?.type !== "model_output") continue;
    for (const block of step.content || []) {
      if (block?.type === "image" && block.data) {
        return { data: String(block.data), mimeType: clean(block.mime_type || block.mimeType || "image/jpeg", 80) };
      }
    }
  }
  const direct = data?.output_image || data?.outputImage;
  return direct?.data ? { data: String(direct.data), mimeType: clean(direct.mime_type || direct.mimeType || "image/jpeg", 80) } : null;
}

function musicReferenceImages(meta = {}) {
  const list = Array.isArray(meta.referenceImages) ? meta.referenceImages : [];
  return list.slice(0, 3).map((item) => {
    const mimeType = clean(item?.mimeType, 80).toLowerCase();
    const data = String(item?.data || "").replace(/^data:[^;]+;base64,/, "");
    if (!/^image\/(jpeg|png|webp)$/.test(mimeType) || !/^[a-z0-9+/=\r\n]+$/i.test(data) || data.length > 2_100_000) return null;
    return { type: "image", data, mime_type: mimeType };
  }).filter(Boolean);
}

async function generateMusicImage(body) {
  const prompt = clean(body.input || body.prompt, 5000);
  if (!prompt) throw providerError("Hãy nhập concept trước khi tạo ảnh.", 400, "IMAGE_PROMPT_REQUIRED");
  const meta = body.meta || {};
  const aspectRatio = new Set(["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"]).has(meta.aspectRatio) ? meta.aspectRatio : "16:9";
  const imageSize = new Set(["1K", "2K", "4K"]).has(meta.imageSize) ? meta.imageSize : "1K";
  const references = musicReferenceImages(meta);
  return withGeminiMediaKey(async (apiKey) => {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        model: process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image",
        input: references.length ? [{ type: "text", text: prompt }, ...references] : prompt,
        response_format: { type: "image", mime_type: "image/jpeg", aspect_ratio: aspectRatio, image_size: imageSize },
        background: false,
        store: false
      }),
      signal: AbortSignal.timeout(26000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = providerError(data?.error?.message || `Gemini Images HTTP ${response.status}.`, response.status, "GEMINI_IMAGE_ERROR");
      error.status = response.status;
      throw error;
    }
    const image = interactionImage(data);
    if (!image?.data || image.data.length > 3_100_000) throw providerError("Ảnh trả về rỗng hoặc vượt giới hạn truyền tải.", 502, "IMAGE_OUTPUT_INVALID");
    return { ok: true, media: { kind: "image", data: image.data, mimeType: image.mimeType, model: process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image", interactionId: clean(data.id, 240) } };
  });
}

async function generateMusicTrack(body) {
  const apiKey = clean(process.env.ELEVENLABS_API_KEY, 400);
  if (!apiKey) throw providerError("Eleven Music chưa được cấu hình trên Vercel.", 503, "ELEVEN_MUSIC_NOT_CONFIGURED");
  const prompt = clean(body.input || body.prompt, 4100);
  const meta = body.meta || {};
  const durationMs = Math.min(120000, Math.max(3000, Number(meta.durationSeconds || body.durationSeconds || 60) * 1000));
  const outputFormat = new Set(["mp3_48000_192", "mp3_44100_128"]).has(meta.outputFormat) ? meta.outputFormat : "mp3_48000_192";
  const compositionPlan = Array.isArray(meta.compositionPlan?.chunks)
    ? {
        chunks: meta.compositionPlan.chunks.slice(0, 30).map((chunk) => {
          const songId = clean(chunk?.song_id || chunk?.songId, 240);
          const startMs = Math.max(0, Number(chunk?.range?.start_ms ?? chunk?.range?.startMs ?? 0));
          const endMs = Math.max(startMs + 50, Number(chunk?.range?.end_ms ?? chunk?.range?.endMs ?? 0));
          if (songId && endMs > startMs) return { song_id: songId, range: { start_ms: startMs, end_ms: Math.min(startMs + 120000, endMs) } };
          const conditioningId = clean(chunk?.conditioning_ref?.song_id || chunk?.conditioningRef?.songId, 240);
          const conditioningStart = Math.max(0, Number(chunk?.conditioning_ref?.range?.start_ms ?? chunk?.conditioningRef?.range?.startMs ?? 0));
          const conditioningEnd = Math.min(conditioningStart + 30000, Math.max(conditioningStart + 50, Number(chunk?.conditioning_ref?.range?.end_ms ?? chunk?.conditioningRef?.range?.endMs ?? 0)));
          return {
            text: clean(chunk?.text, 4000),
            duration_ms: Math.min(120000, Math.max(3000, Number(chunk?.duration_ms || chunk?.durationMs || 15000))),
            positive_styles: (Array.isArray(chunk?.positive_styles) ? chunk.positive_styles : []).slice(0, 50).map((item) => clean(item, 100)).filter(Boolean),
            negative_styles: (Array.isArray(chunk?.negative_styles) ? chunk.negative_styles : []).slice(0, 50).map((item) => clean(item, 100)).filter(Boolean),
            context_adherence: new Set(["low", "medium", "high"]).has(chunk?.context_adherence) ? chunk.context_adherence : "high",
            ...(conditioningId && conditioningEnd > conditioningStart ? { conditioning_ref: { song_id: conditioningId, range: { start_ms: conditioningStart, end_ms: conditioningEnd } }, condition_strength: new Set(["low", "medium", "high", "xhigh"]).has(chunk?.condition_strength) ? chunk.condition_strength : "high" } : {})
          };
        }).filter((chunk) => chunk.song_id || chunk.text)
      }
    : null;
  const seed = Number.isInteger(Number(meta.seed)) ? Math.min(2147483647, Math.max(0, Number(meta.seed))) : undefined;
  if (meta.compositionPlan && !compositionPlan?.chunks.length) throw providerError("Composition plan không có section hợp lệ.", 400, "MUSIC_PLAN_INVALID");
  if (!prompt && !compositionPlan?.chunks.length) throw providerError("Hãy nhập prompt nhạc hoặc composition plan trước khi tạo track.", 400, "MUSIC_PROMPT_REQUIRED");
  const requestBody = compositionPlan?.chunks.length
    ? { composition_plan: compositionPlan, model_id: process.env.ELEVEN_MUSIC_MODEL || "music_v2", sign_with_c2pa: true, store_for_inpainting: meta.storeForInpainting !== false }
    : {
        prompt,
        music_length_ms: durationMs,
        model_id: process.env.ELEVEN_MUSIC_MODEL || "music_v2",
        force_instrumental: meta.instrumental !== false,
        sign_with_c2pa: true,
        store_for_inpainting: meta.storeForInpainting !== false
      };
  if (seed !== undefined) requestBody.seed = seed;
  const response = await fetch(`https://api.elevenlabs.io/v1/music?output_format=${outputFormat}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(28000)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw providerError(data?.detail?.message || data?.detail || data?.error || `Eleven Music HTTP ${response.status}.`, response.status, "ELEVEN_MUSIC_ERROR");
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 3_100_000) throw providerError("Track vượt giới hạn truyền tải của Vercel. Hãy giảm thời lượng xuống 60 giây.", 413, "MUSIC_OUTPUT_TOO_LARGE");
  const compositionDurationMs = compositionPlan?.chunks.reduce((sum, chunk) => {
    const explicitDuration = Number(chunk.duration_ms);
    const referenceDuration = Number(chunk?.range?.end_ms) - Number(chunk?.range?.start_ms);
    return sum + (Number.isFinite(explicitDuration) && explicitDuration > 0
      ? explicitDuration
      : Number.isFinite(referenceDuration) && referenceDuration > 0 ? referenceDuration : 0);
  }, 0);
  return { ok: true, media: { kind: "audio", data: bytes.toString("base64"), mimeType: response.headers.get("content-type") || "audio/mpeg", durationSeconds: compositionPlan ? compositionDurationMs / 1000 : durationMs / 1000, model: process.env.ELEVEN_MUSIC_MODEL || "music_v2", songId: clean(response.headers.get("song-id"), 240), compositionPlan: Boolean(compositionPlan), c2paRequested: true } };
}

function interactionAudio(data) {
  const direct = data?.output_audio || data?.outputAudio;
  if (direct?.data) return { data: String(direct.data), mimeType: clean(direct.mime_type || direct.mimeType || "audio/mpeg", 80) };
  for (const step of data?.steps || []) {
    for (const block of step?.content || []) {
      if (block?.type === "audio" && block.data) return { data: String(block.data), mimeType: clean(block.mime_type || block.mimeType || "audio/mpeg", 80) };
    }
  }
  return null;
}

function interactionText(data) {
  if (typeof data?.output_text === "string") return clean(data.output_text, 16000);
  if (typeof data?.outputText === "string") return clean(data.outputText, 16000);
  return (data?.steps || []).flatMap((step) => step?.content || []).filter((block) => block?.type === "text").map((block) => clean(block.text, 12000)).filter(Boolean).join("\n");
}

function lyriaReferenceImages(meta = {}) {
  const list = Array.isArray(meta.referenceImages) ? meta.referenceImages : [];
  let total = 0;
  return list.slice(0, 10).map((item) => {
    const mimeType = clean(item?.mimeType, 80).toLowerCase();
    const data = String(item?.data || "").replace(/^data:[^;]+;base64,/, "");
    total += data.length;
    if (!/^image\/(jpeg|png|webp)$/.test(mimeType) || !/^[a-z0-9+/=\r\n]+$/i.test(data) || data.length > 1_500_000 || total > 2_600_000) return null;
    return { type: "image", mime_type: mimeType, data };
  }).filter(Boolean);
}

async function generateLyriaTrack(body) {
  const prompt = clean(body.input || body.prompt, 12000);
  if (!prompt) throw providerError("Hãy nhập music brief hoặc lời bài hát trước khi dùng Lyria.", 400, "LYRIA_PROMPT_REQUIRED");
  const meta = body.meta || {};
  const model = meta.model === "lyria-3-pro-preview" ? "lyria-3-pro-preview" : "lyria-3-clip-preview";
  const references = lyriaReferenceImages(meta);
  return withGeminiMediaKey(async (apiKey) => {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ model, input: references.length ? [{ type: "text", text: prompt }, ...references] : prompt, ...(model === "lyria-3-pro-preview" && meta.wav === true ? { response_format: { type: "audio" } } : {}) }),
      signal: AbortSignal.timeout(model === "lyria-3-pro-preview" ? 55000 : 35000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = providerError(data?.error?.message || `Lyria HTTP ${response.status}.`, response.status, "LYRIA_ERROR");
      error.status = response.status;
      throw error;
    }
    const audio = interactionAudio(data);
    if (!audio?.data || audio.data.length > 3_100_000) throw providerError("Audio Lyria rỗng hoặc vượt giới hạn truyền tải trực tiếp; hãy dùng Clip hoặc worker lưu trữ.", 413, "LYRIA_OUTPUT_TOO_LARGE");
    return { ok: true, media: { kind: "audio", data: audio.data, mimeType: audio.mimeType, durationSeconds: model === "lyria-3-clip-preview" ? 30 : 0, model, lyrics: interactionText(data), synthIdExpected: true, estimatedCostUsd: model === "lyria-3-clip-preview" ? 0.04 : 0.08, interactionId: clean(data.id, 240) } };
  });
}

async function generateMusicSoundEffect(body) {
  const apiKey = clean(process.env.ELEVENLABS_API_KEY, 400);
  if (!apiKey) throw providerError("Eleven Sound Effects chưa được cấu hình trên Vercel.", 503, "ELEVEN_SFX_NOT_CONFIGURED");
  const prompt = clean(body.input || body.prompt, 2500);
  if (!prompt) throw providerError("Hãy mô tả sound effect cần tạo.", 400, "SFX_PROMPT_REQUIRED");
  const meta = body.meta || {};
  const durationSeconds = Math.min(30, Math.max(0.5, Number(meta.durationSeconds || 8)));
  const promptInfluence = Math.min(1, Math.max(0, Number(meta.promptInfluence ?? 0.45)));
  const outputFormat = new Set(["mp3_44100_128", "mp3_44100_192"]).has(meta.outputFormat) ? meta.outputFormat : "mp3_44100_128";
  const response = await fetch(`https://api.elevenlabs.io/v1/sound-generation?output_format=${outputFormat}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
    body: JSON.stringify({
      text: prompt,
      duration_seconds: durationSeconds,
      prompt_influence: promptInfluence,
      loop: Boolean(meta.loop),
      model_id: process.env.ELEVEN_SFX_MODEL || "eleven_text_to_sound_v2"
    }),
    signal: AbortSignal.timeout(28000)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw providerError(data?.detail?.message || data?.detail || data?.error || `Eleven SFX HTTP ${response.status}.`, response.status, "ELEVEN_SFX_ERROR");
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 3_100_000) throw providerError("Sound effect trả về rỗng hoặc quá lớn.", 413, "SFX_OUTPUT_INVALID");
  return { ok: true, media: { kind: "sound-effect", data: bytes.toString("base64"), mimeType: response.headers.get("content-type") || "audio/mpeg", durationSeconds, loop: Boolean(meta.loop), model: process.env.ELEVEN_SFX_MODEL || "eleven_text_to_sound_v2", characterCost: clean(response.headers.get("character-cost"), 80) } };
}

function cleanInlineImage(meta = {}) {
  const data = String(meta.imageData || "").replace(/^data:[^;]+;base64,/, "");
  const mimeType = clean(meta.imageMimeType || "image/jpeg", 80).toLowerCase();
  if (!data) return null;
  if (!/^image\/(jpeg|png|webp)$/.test(mimeType) || !/^[a-z0-9+/=\r\n]+$/i.test(data) || data.length > 2_500_000) {
    throw providerError("Ảnh đầu vào Veo không hợp lệ hoặc quá lớn.", 413, "VEO_IMAGE_INVALID");
  }
  return { inlineData: { mimeType, data } };
}

async function startMusicVideo(body) {
  const prompt = clean(body.input || body.prompt, 4000);
  if (!prompt) throw providerError("Hãy nhập prompt chuyển động trước khi tạo video.", 400, "VIDEO_PROMPT_REQUIRED");
  const meta = body.meta || {};
  const image = cleanInlineImage(meta);
  const aspectRatio = meta.aspectRatio === "9:16" ? "9:16" : "16:9";
  const resolution = new Set(["720p", "1080p", "4k"]).has(String(meta.resolution).toLowerCase()) ? String(meta.resolution).toLowerCase() : "720p";
  const durationSeconds = new Set([4, 6, 8]).has(Number(meta.durationSeconds)) ? Number(meta.durationSeconds) : 8;
  return withGeminiMediaKey(async (apiKey) => {
    const model = process.env.GEMINI_VIDEO_MODEL || "veo-3.1-fast-generate-preview";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:predictLongRunning`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        instances: [{ prompt, ...(image ? { image } : {}) }],
        parameters: { numberOfVideos: 1, aspectRatio, resolution, durationSeconds }
      }),
      signal: AbortSignal.timeout(24000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.name) {
      const error = providerError(data?.error?.message || `Veo HTTP ${response.status}.`, response.status, "VEO_START_ERROR");
      error.status = response.status;
      throw error;
    }
    return { ok: true, operation: { name: clean(data.name, 500), done: false, model } };
  });
}

function videoUriFromOperation(data) {
  return clean(
    data?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
      || data?.response?.generatedVideos?.[0]?.video?.uri
      || data?.response?.generated_videos?.[0]?.video?.uri,
    1800
  );
}

async function musicVideoStatus(body) {
  const name = clean(body.meta?.operationName || body.operationName, 500);
  if (!/^[a-z0-9_./-]+$/i.test(name) || !name.includes("operations/")) throw providerError("Mã tiến trình Veo không hợp lệ.", 400, "VEO_OPERATION_INVALID");
  return withGeminiMediaKey(async (apiKey) => {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${name.replace(/^\//, "")}`, {
      headers: { "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(12000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = providerError(data?.error?.message || `Veo status HTTP ${response.status}.`, response.status, "VEO_STATUS_ERROR");
      error.status = response.status;
      throw error;
    }
    const uri = videoUriFromOperation(data);
    return { ok: true, operation: { name, done: Boolean(data.done), error: clean(data?.error?.message, 300), ready: Boolean(uri), mediaUri: uri } };
  });
}

function allowedGoogleMediaUri(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && (url.hostname === "generativelanguage.googleapis.com" || url.hostname.endsWith(".googleapis.com") || url.hostname.endsWith(".googleusercontent.com"));
  } catch {
    return false;
  }
}

async function proxyMusicVideo(req, res) {
  const user = await currentUser(req);
  if (!isAdminUser(user)) return res.status(403).json({ error: "Chỉ tài khoản quản trị được tải media AI có tính phí." });
  const uri = Buffer.from(clean(req.query.uri, 2600), "base64url").toString("utf8");
  if (!allowedGoogleMediaUri(uri)) return res.status(400).json({ error: "Liên kết media không hợp lệ." });
  return withGeminiMediaKey(async (apiKey) => {
    const upstream = await fetch(uri, { headers: { "x-goog-api-key": apiKey }, redirect: "follow", signal: AbortSignal.timeout(25000) });
    if (!upstream.ok || !upstream.body) return res.status(502).json({ error: `Không tải được video Veo (HTTP ${upstream.status}).` });
    res.statusCode = 200;
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "video/mp4");
    res.setHeader("Content-Disposition", 'attachment; filename="hh-music-ai-veo.mp4"');
    res.setHeader("Cache-Control", "private, no-store");
    Readable.fromWeb(upstream.body).pipe(res);
    return undefined;
  });
}

async function musicMediaAction(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    if (req.method === "GET" && req.query.media === "veo") return proxyMusicVideo(req, res);
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const user = await currentUser(req);
    if (!isAdminUser(user)) return res.status(403).json({ error: "Media AI có tính phí chỉ mở cho tài khoản quản trị." });
    const body = musicBody(req);
    const actionType = clean(body.actionType, 80);
    const db = await database();
    if (actionType === "music-video-status") await enforceRateLimit(db, `music-media-status:${String(user._id)}`, 140, 60 * 60 * 1000);
    else await enforceRateLimit(db, `music-media:${String(user._id)}`, 12, 60 * 60 * 1000);
    let result;
    if (actionType === "music-image" || actionType === "design-image") result = await generateMusicImage(body);
    else if (actionType === "music-track") result = await generateMusicTrack(body);
    else if (actionType === "music-lyria") result = await generateLyriaTrack(body);
    else if (actionType === "music-sfx") result = await generateMusicSoundEffect(body);
    else if (actionType === "music-video-start") result = await startMusicVideo(body);
    else if (actionType === "music-video-status") result = await musicVideoStatus(body);
    else return res.status(400).json({ error: "Tác vụ media không được hỗ trợ." });
    await db.collection("events").insertOne({ type: actionType === "design-image" ? "graphic-design:media" : "music-ai:media", actionType, userId: user._id, provider: actionType === "music-track" ? "eleven-music" : actionType === "music-lyria" ? "gemini-lyria" : actionType === "music-sfx" ? "eleven-sfx" : "gemini-media", createdAt: new Date() });
    return res.status(200).json(result);
  } catch (error) {
    console.error("Music media error", error?.message || error);
    const status = Number(error?.statusCode || 0);
    return res.status(status >= 400 && status <= 503 ? status : 502).json({ error: clean(error.message, 300), code: clean(error.code, 80) || undefined });
  }
}

async function downloadCenterAction(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET") {
    return res.status(200).json({
      configured: Boolean(process.env.VIDEO_DOWNLOADER_API_URL),
      providers: downloadHosts,
      capabilities: downloadCapabilities,
      policy: "Only public media you own or are authorized to save. No DRM, private content, paywall or access-control bypass."
    });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để sử dụng trình tải." });
  const body = bodyOf(req);
  if (!supportedDownloadUrl(body.url)) {
    return res.status(400).json({ error: "Liên kết không hợp lệ hoặc nền tảng chưa được hỗ trợ." });
  }
  if (body.ownershipConfirmed !== true) {
    return res.status(400).json({ error: "Confirm authorization to save this media before creating a download request." });
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
        sourceKind: downloadCapabilities.includes(String(body.sourceKind)) ? String(body.sourceKind) : "single",
        ownershipConfirmed: true,
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

async function youtubeResearchOutput(input, actionType) {
  const key = String(process.env.YOUTUBE_API_KEY || "").trim();
  if (!key) return null;
  const urls = String(input || "").match(/https?:\/\/[^\s<>"']+/gi) || [];
  const query = clean(String(input || "")
    .replace(/https?:\/\/[^\s<>"']+/gi, " ")
    .replace(/\s+/g, " ")
    .trim() || "sáng tạo nội dung AI", 300);
  const params = new URLSearchParams({
    key,
    q: query,
    part: "snippet",
    type: "video",
    maxResults: "10",
    order: "relevance",
    safeSearch: "moderate",
    relevanceLanguage: "vi",
    regionCode: "VN"
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
    headers: { Accept: "application/json", "User-Agent": "HH-Creative-Research/1.0" },
    signal: AbortSignal.timeout(5500)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return null;
  const items = (data.items || []).map((item, index) => ({
    index: index + 1,
    title: clean(item?.snippet?.title, 240),
    channel: clean(item?.snippet?.channelTitle, 180),
    publishedAt: clean(item?.snippet?.publishedAt, 80),
    snippet: clean(item?.snippet?.description, 500),
    url: item?.id?.videoId ? `https://www.youtube.com/watch?v=${item.id.videoId}` : ""
  })).filter((item) => item.url);
  if (!items.length) return null;
  return {
    output: [
      actionType === "url-research" ? "NGHIÊN CỨU URL + YOUTUBE DATA" : "NGHIÊN CỨU YOUTUBE DATA",
      `Truy vấn: ${query}`,
      `Video tham khảo thực tế: ${items.length}`,
      urls.length ? `URL người dùng cung cấp: ${urls.slice(0, 20).join(", ")}` : "",
      "",
      "BẢN ĐỒ NỘI DUNG ĐANG CÓ",
      ...items.map((item) => [
        `[${item.index}] ${item.title}`,
        `${item.channel}${item.publishedAt ? ` · ${new Date(item.publishedAt).toLocaleDateString("vi-VN")}` : ""}`,
        item.snippet || "Không có mô tả công khai.",
        item.url
      ].join("\n")),
      "",
      "CÁCH TẠO PHIÊN BẢN NGUYÊN BẢN",
      "1. Nhóm các video theo lời hứa ở tiêu đề, không sao chép câu chữ.",
      "2. Tìm một câu hỏi mà phần lớn video chưa trả lời hoặc trả lời còn chung chung.",
      "3. Bổ sung trải nghiệm, thử nghiệm, dữ liệu hoặc ví dụ của chính bạn.",
      "4. Mở bằng kết quả cụ thể; đưa bối cảnh sau khi người xem đã hiểu lợi ích.",
      "5. Dùng bình luận và video liên quan làm nguồn câu hỏi cho tập tiếp theo.",
      "",
      "CHECKLIST CẠNH TRANH",
      "□ Tiêu đề khác biệt về góc nhìn, không chỉ thay vài từ",
      "□ Thumbnail truyền một ý duy nhất",
      "□ 30 giây đầu xác nhận đúng lời hứa ở tiêu đề",
      "□ Có đoạn chứng minh hoặc demo",
      "□ Ghi nguồn khi sử dụng dữ kiện của bên thứ ba"
    ].filter(Boolean).join("\n\n"),
    sources: items.map((item) => ({ url: item.url, title: `${item.title} · ${item.channel}`, type: "youtube" })),
    model: "youtube-data-api",
    providerApi: "youtube-data-v3",
    provider: "youtube-research"
  };
}

function localChatAIOutput(actionType, input, meta = {}) {
  const request = clean(input, 1400).replace(/\s+/g, " ") || "Yêu cầu chưa có phần văn bản.";
  const profiles = {
    chat: {
      label: "Trò chuyện",
      note: "Mình đã giữ nguyên nội dung và ngữ cảnh hội thoại, nhưng chưa thể tạo câu trả lời AI đầy đủ.",
      steps: ["Nói rõ kết quả bạn muốn nhận.", "Bổ sung dữ kiện còn thiếu nếu có.", "Bấm **Tạo bản khác** để gửi lại đúng yêu cầu khi HH Intelligence sẵn sàng."]
    },
    research: {
      label: "Nghiên cứu",
      note: "Các nguồn trực tuyến chưa phản hồi đủ để tạo báo cáo có thể kiểm chứng; hệ thống không tự bịa nguồn thay thế.",
      steps: ["Thu hẹp chủ đề, phạm vi thời gian và khu vực.", "Nêu loại nguồn ưu tiên như tài liệu chính thức hoặc nghiên cứu gốc.", "Bấm **Tạo bản khác** để chạy lại nghiên cứu có trích dẫn."]
    },
    code: {
      label: "Lập trình",
      note: "Mã và thông báo lỗi đã được giữ lại; bộ xử lý cơ bản không giả vờ đã chạy hoặc kiểm thử code.",
      steps: ["Cung cấp lỗi nguyên văn và môi trường chạy.", "Tách ca tái hiện nhỏ nhất.", "Bấm **Tạo bản khác** để nhận phân tích nguyên nhân, bản vá và kiểm thử."]
    },
    write: {
      label: "Viết",
      note: "Brief đã được giữ lại; bộ xử lý cơ bản chưa tự tạo bản thảo thay cho dịch vụ AI đám mây.",
      steps: ["Chốt độc giả, mục tiêu và giọng văn.", "Nêu độ dài cùng định dạng đầu ra.", "Bấm **Tạo bản khác** để tạo bản hoàn chỉnh theo brief."]
    },
    study: {
      label: "Học tập",
      note: "Câu hỏi học tập đã được giữ lại; hệ thống không tự hiện đáp án hoặc tạo lời giải chưa được kiểm chứng.",
      steps: ["Nêu lớp, môn và phần kiến thức đang vướng.", "Cho biết bạn đã thử đến bước nào.", "Bấm **Tạo bản khác** để nhận hướng dẫn từng bước và câu hỏi kiểm tra."]
    },
    vision: {
      label: "Phân tích tệp",
      note: "Bộ xử lý cơ bản không đọc nội dung ảnh/PDF nên chưa đưa ra kết luận về tệp.",
      steps: ["Giữ tệp đính kèm trong phiên hiện tại.", "Mô tả vùng hoặc dữ kiện cần tập trung.", "Bấm **Tạo bản khác** để phân tích lại bằng mô hình đa phương thức."]
    }
  };
  const profile = profiles[actionType] || profiles.chat;
  const hasAttachment = Array.isArray(meta.attachments) && meta.attachments.length > 0;
  return {
    output: [
      `## HH Basic Assist · ${profile.label}`,
      "",
      "Dịch vụ AI đám mây hiện chưa phản hồi ổn định. Đây là trạng thái dự phòng an toàn, **không phải kết quả từ dịch vụ AI đám mây**.",
      "",
      `**Yêu cầu đã nhận:** ${request}`,
      hasAttachment ? "**Tệp:** đã nhận metadata và giữ trong lượt hiện tại; chưa suy luận nội dung bằng bộ xử lý cơ bản." : "",
      "",
      profile.note,
      "",
      "### Bước tiếp theo",
      ...profile.steps.map((step, index) => `${index + 1}. ${step}`)
    ].filter(Boolean).join("\n"),
    provider: "local-continuity",
    model: `hh-basic-assist-${profile.label === "Phân tích tệp" ? "vision" : actionType}-v2`
  };
}

async function localCreativeOutput(moduleId, actionType, input, meta = {}) {
  if (moduleId === "fortune" && actionType === "fortune-deep-analysis") {
    const lock = normalizeFortuneFactLock(meta);
    const citedFacts = lock.facts.slice(0, 24).map((fact) => `- ${fact.value} [factId:${fact.factId}]`);
    return {
      output: [
        "## HH Continuity · bản phân tích cục bộ",
        "",
        "Gemini và provider cloud đang tạm gián đoạn. Phần này do bộ xử lý cục bộ tạo từ Fact Lock, không phải phản hồi của Gemini và không bổ sung dữ kiện mới.",
        citedFacts.length ? "\n### Dữ kiện đã khóa\n" + citedFacts.join("\n") : "\nChưa có dữ kiện cấu trúc để phân tích.",
        "",
        "### Cách chiêm nghiệm an toàn",
        "1. Tách dữ kiện đã tính khỏi lớp diễn giải biểu tượng.",
        "2. Ghi ít nhất hai cách hiểu thay vì chọn một kết luận tuyệt đối.",
        "3. Chọn một câu hỏi có thể kiểm chứng trong trải nghiệm thực tế.",
        "4. Thử một hành động nhỏ, có thể đảo ngược và đặt thời điểm xem lại.",
        "5. Không dùng kết quả thay quyết định y tế, pháp lý, tài chính hoặc an toàn.",
        "",
        "Bấm **Phân tích lại** khi cloud phục hồi để nhận bản luận giải đầy đủ hơn."
      ].join("\n"),
      provider: "local-continuity",
      model: "hh-fortune-continuity-v1"
    };
  }
  if (actionType === "youtube-batch-metadata") {
    const items = (Array.isArray(meta.items) ? meta.items : []).slice(0, 10);
    const structured = { items: items.map((item, position) => {
      const base = clean(item?.currentTitle || item?.filename || `Video ${position + 1}`, 100).replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
      const words = base.split(/\s+/).filter(Boolean);
      return { index: Math.max(1, Number(item?.index) || position + 1), filename: clean(item?.filename, 240), title: base.slice(0, 100), description: `Nội dung: ${base}. Hãy kiểm tra lại thông tin và quyền sử dụng trước khi xuất bản.`, tags: words.filter((word) => word.length > 2).slice(0, 15), thumbnailTitle: words.slice(0, 6).join(" ").slice(0, 80), thumbnailSubtitle: "" };
    }) };
    return { output: JSON.stringify(structured), structured, provider: "local-youtube-batch", model: "hh-youtube-batch-local-v1" };
  }
  if (["image-text-batch", "image-text-youtube-batch"].includes(actionType)) {
    return localImageTextBatchOutput(input, meta);
  }
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
    const youtubeResearch = await youtubeResearchOutput(input, actionType).catch(() => null);
    if (youtubeResearch) return youtubeResearch;
  }
  if (moduleId === "chat-ai" && CHAT_AI_ACTIONS.has(actionType)) return localChatAIOutput(actionType, input, meta);
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
  if (moduleId === "fortune") return [
    "Bạn là HH Reflection Copilot, chuyên gia giải thích các hệ biểu tượng bằng tiếng Việt rõ ràng, chi tiết và có trách nhiệm.",
    "Bạn chỉ phân tích dữ liệu kết quả đã được hệ thống tính và nội dung người dùng chủ động gửi; không tự bịa thêm lá bài, hào, quẻ, vị trí hành tinh, ngày sinh, sự kiện hoặc thông tin về người khác.",
    "Khi gói FACT LOCK có dữ kiện, mọi câu nhắc lại dữ kiện tính toán hoặc biểu tượng phải kèm đúng cú pháp [factId:<id>]. Không được viện dẫn id ngoài danh sách.",
    "Tách rõ ba lớp: DỮ LIỆU ĐÃ TÍNH, DIỄN GIẢI BIỂU TƯỢNG và SUY LUẬN/ĐIỀU CẦN KIỂM CHỨNG.",
    "Giải thích từng thành phần, mối liên hệ, điểm đồng thuận, mâu thuẫn, nhiều khả năng diễn giải và giới hạn của phương pháp. Không dùng lời khẳng định tuyệt đối như chắc chắn, định mệnh, sẽ xảy ra, bị nguyền hoặc người kia đang nghĩ gì.",
    "Luôn kết thúc bằng câu hỏi tự suy ngẫm, ba hành động nhỏ có thể đảo ngược, dấu hiệu cần dừng và lời nhắc tự quyết định.",
    "Không chẩn đoán hay đưa quyết định y tế, pháp lý, tài chính; khi gặp nội dung khủng hoảng hoặc tự hại, ưu tiên khuyến nghị tìm hỗ trợ con người và dịch vụ khẩn cấp tại nơi người dùng sống.",
    "Đây là nội dung giải trí và tự chiêm nghiệm, không phải dự báo khoa học. Không mời người dùng phụ thuộc hoặc xem lại liên tục.",
    `Tác vụ hiện tại: ${actionType}.`
  ].join("\n");
  if (moduleId === "image-text") return `Bạn là art director thumbnail. Phân tích đúng từng ô ảnh đã đánh số, tạo chữ ngắn tự nhiên theo yêu cầu, không nhầm thứ tự, không bịa người hoặc địa điểm và trả đúng JSON schema. Tác vụ hiện tại: ${actionType}.`;
  if (moduleId === "youtube-batch") return `Bạn là biên tập viên YouTube cho upload hàng loạt. Chỉ suy luận từ filename, sidecar và ngữ cảnh; không bịa người, sự kiện, số liệu hay xu hướng, không tạo metadata spam lặp và trả đúng JSON schema. Tác vụ hiện tại: ${actionType}.`;
  if (moduleId === "tiktok-creator") return `Bạn là biên tập viên TikTok tiếng Việt. Tạo nội dung nguyên bản, ngắn, nói tự nhiên và dùng được ngay. Không bịa xu hướng, số liệu, con người hoặc sự kiện; không cam kết viral; không tạo spam, bot tương tác, nội dung né kiểm duyệt hay xâm phạm bản quyền. Tách rõ hook, lời thoại theo nhịp thời gian, shot list, caption, CTA và tối đa 8 hashtag phù hợp. Nếu thiếu dữ kiện, nêu giả định ngắn gọn. Tác vụ hiện tại: ${actionType}.`;
  if (moduleId === "chat-ai") {
    const modeRules = {
      chat: "Trò chuyện trực tiếp, tự nhiên và bám sát ý định. Không biến lời chào, tâm sự hoặc yêu cầu đơn giản thành báo cáo nghiên cứu, SEO hay YouTube.",
      research: "Thực hiện nghiên cứu có nguồn. Ưu tiên nguồn gốc/chính thức, ghi citation cạnh dữ kiện mới, nêu ngày dữ liệu và tách dữ kiện khỏi suy luận.",
      code: "Đóng vai senior software engineer. Xác định nguyên nhân gốc, đưa bản sửa chạy được, giải thích trade-off, bảo mật và kiểm thử. Không tuyên bố đã chạy code nếu chưa có kết quả công cụ.",
      write: "Đóng vai biên tập viên. Tạo đúng loại nội dung, độc giả, giọng văn và định dạng được yêu cầu; trả bản dùng được ngay, không chuyển sang phân tích xu hướng nếu người dùng không yêu cầu.",
      study: "Đóng vai gia sư. Giải thích theo trình độ, chia bước, hỏi kiểm tra và đưa gợi ý trước; không để lộ đáp án bài kiểm tra hoặc bài tập trước khi người học tự trả lời.",
      vision: "Đóng vai chuyên gia phân tích tệp đa phương thức. Chỉ mô tả dữ kiện thực sự đọc được từ ảnh/PDF/tệp; dẫn vị trí khi có thể và nói rõ phần mờ, thiếu hoặc không chắc chắn."
    };
    return [
      "Bạn là HH AI trong HH Intelligence. Trả lời bằng tiếng Việt tự nhiên, chính xác, có cấu trúc và giữ ngữ cảnh nhiều lượt.",
      "Không tự đổi sang chế độ khác. Không tạo báo cáo Nghiên cứu hoặc YouTube khi actionType không phải research.",
      "Không bịa dữ kiện, nguồn, thao tác bên ngoài hay kết quả đã chạy. Tôn trọng quyền riêng tư và bản quyền.",
      modeRules[actionType] || modeRules.chat,
      `Chế độ bắt buộc: ${actionType}.`
    ].join("\n");
  }
  const common = "Bạn là HH Creative AI, trợ lý sản xuất nội dung cao cấp. Trả lời bằng tiếng Việt tự nhiên, có cấu trúc, không bịa dữ kiện, nêu rõ điểm chưa chắc chắn, tôn trọng bản quyền và luôn tạo đầu ra có thể dùng ngay.";
  const rules = {
    "ai-center": "Phân tích mục tiêu, trả lời trực tiếp, đưa ví dụ thực tế và kết thúc bằng checklist hành động.",
    "chat-ai": "Đóng vai trợ lý hội thoại Gemini của HH Platform. Trả lời trực tiếp theo ngữ cảnh nhiều lượt, đọc kỹ tệp được gửi, giữ định dạng Markdown và code rõ ràng. Khi bật tìm kiếm, phân biệt dữ kiện có nguồn với suy luận và đặt nguồn cạnh luận điểm. Không tuyên bố đã thực hiện tác vụ bên ngoài nếu chỉ mới hướng dẫn.",
    "ai-script": "Đóng vai biên kịch và script editor. Tập trung vào hook, retention, mạch truyện, cao trào, tính nguyên bản, lời thoại tự nhiên và CTA mềm.",
    "creator-studio": "Đóng vai chiến lược gia nội dung đa nền tảng. Tối ưu tiêu đề, SEO, kịch bản, thumbnail, short và lịch tái sử dụng.",
    "ai-automation": "Đóng vai content operations engineer. Thực hiện đúng từng bước pipeline, giữ nhất quán dữ liệu và trả kết quả có nhãn rõ.",
    "music-ai": "Đóng vai nhà sản xuất relax piano, thiền, jazz và lofi cho video YouTube dài. Xây concept nguyên bản, nhất quán giữa âm nhạc, hình ảnh, chuyển động, tracklist, metadata và kiểm soát chất lượng; tuyệt đối không bắt chước nghệ sĩ hoặc bài hát có bản quyền.",
    "creative-os": "Đóng vai creative director và production operator. Tạo bản nháp có cấu trúc cho brief, workflow, prompt đa phương thức, tái sử dụng nội dung, brand, audio và prototype; không tự ghi đè dự án, không tự duyệt và không tự xuất bản."
  };
  return `${common}\n\n${rules[moduleId] || rules["ai-center"]}\nTác vụ hiện tại: ${actionType}.`;
}

function normalizeFortuneFactLock(meta = {}) {
  const source = meta.factLock && typeof meta.factLock === "object" ? meta.factLock : {}; const seen = new Set(); const facts = [];
  for (const item of Array.isArray(source.facts) ? source.facts.slice(0, 160) : []) {
    const factId = clean(item?.factId, 100).toLowerCase(); if (!/^[a-z0-9][a-z0-9._-]{0,99}$/.test(factId) || seen.has(factId)) continue;
    const value = clean(item?.value, 360); if (!value) continue; seen.add(factId); facts.push({ factId, type: clean(item?.type || "calculation", 40), value });
  }
  const allowedEntities = [...new Set((Array.isArray(source.allowedEntities) ? source.allowedEntities : []).map((item) => clean(item, 120)).filter(Boolean))].slice(0, 160);
  return { schema: "hh.fortune.fact-lock.v1", facts, allowedEntities, sourceView: clean(source.sourceView, 40), mode: clean(source.mode, 40), selectedTextDigest: clean(source.selectedTextDigest, 64) };
}

function validateFortuneFactLockedOutput(outputValue, meta = {}) {
  const output = clean(outputValue, 48000); const lock = normalizeFortuneFactLock(meta); if (!lock.facts.length) return { output, factValidation: { ok: true, mode: "unstructured-user-input", factCount: 0, citedFactCount: 0, warnings: ["Không có fact cấu trúc; chỉ kiểm tra rào chắn ngôn ngữ."] } };
  const allowedIds = new Set(lock.facts.map((fact) => fact.factId)); const cited = [...output.matchAll(/\[factId:([a-z0-9._-]+)\]/gi)].map((match) => match[1].toLowerCase()); const invalid = [...new Set(cited.filter((id) => !allowedIds.has(id)))]; const valid = [...new Set(cited.filter((id) => allowedIds.has(id)))];
  if (invalid.length || !valid.length) { const error = new Error(invalid.length ? `Gemini viện dẫn factId không tồn tại: ${invalid.join(", ")}.` : "Gemini không viện dẫn factId bắt buộc; bản nháp đã bị chặn."); error.statusCode = 502; error.code = "FORTUNE_FACT_LOCK_REJECTED"; throw error; }
  const knownEntities = ["Mặt Trời", "Mặt Trăng", "Sao Thủy", "Sao Kim", "Sao Hỏa", "Sao Mộc", "Sao Thổ", "Thiên Vương", "Hải Vương", "Diêm Vương", "Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto", "ASC", "MC"];
  const allowedNormalized = new Set(lock.allowedEntities.map((item) => item.toLocaleLowerCase("vi"))); const unsupportedEntities = knownEntities.filter((entity) => { const normalized = entity.toLocaleLowerCase("vi"); const mentioned = new RegExp(`(^|[^\\p{L}])${entity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "iu").test(output); const allowed = [...allowedNormalized].some((item) => item === normalized || item.includes(normalized) || normalized.includes(item)); return mentioned && !allowed; });
  if (unsupportedEntities.length) { const error = new Error(`Gemini thêm thực thể không có trong FACT LOCK: ${unsupportedEntities.join(", ")}.`); error.statusCode = 502; error.code = "FORTUNE_ENTITY_REJECTED"; throw error; }
  const safetyFlags = []; if (/\b(chắc chắn|định mệnh|sẽ xảy ra|bị nguyền|100%)\b/iu.test(output)) safetyFlags.push("absolute-language");
  return { output, factValidation: { ok: true, mode: "fact-locked", factCount: lock.facts.length, citedFactCount: valid.length, citedFactIds: valid, invalidFactIds: [], safetyFlags } };
}

function promptFor(moduleId, actionType, input, meta = {}) {
  if (moduleId === "fortune" && actionType === "fortune-deep-analysis") {
    const depth = clean(meta.depth, 20) === "expert" ? "chuyên sâu tối đa" : "chi tiết, dễ hiểu";
    const modes = {
      easy: "giải thích dễ hiểu, dùng câu ngắn và định nghĩa thuật ngữ",
      deep: "phân tích chuyên sâu nhưng không kéo dài bằng ý lặp",
      compare: "so sánh hai phương pháp và giữ riêng công thức của từng hệ",
      consensus: "tìm điểm đồng thuận, khác biệt và mâu thuẫn mà không ép chúng thành một kết luận",
      journal: "chuyển dữ liệu thành câu hỏi nhật ký trung lập, không đưa dự báo",
      action: "chuyển phần hữu ích thành các hành động nhỏ, an toàn, có thể đảo ngược",
      audit: "kiểm tra câu tuyệt đối, gây sợ và dữ kiện không có trong đầu vào"
    };
    const mode = modes[clean(meta.mode, 24)] || modes.easy;
    const requested = Array.isArray(meta.sections) ? meta.sections.map((item) => clean(item, 60)).filter(Boolean).slice(0, 8) : [];
    const factLock = normalizeFortuneFactLock(meta);
    return [
      `Hãy tạo một bản phân tích ${depth} từ đúng dữ liệu dưới đây. Chế độ: ${mode}.`,
      requested.length ? `Các phần người dùng chọn: ${requested.join(", ")}.` : "Bao gồm tóm tắt, giải thích, câu hỏi suy ngẫm, hành động nhỏ và kiểm tra an toàn.",
      "Cấu trúc bắt buộc:",
      "1. Tóm tắt trung lập (nói rõ loại hệ thống và dữ liệu nào thực sự có).",
      "2. Giải thích từng thành phần theo đúng thứ tự dữ liệu.",
      "3. Liên kết giữa các thành phần: điểm lặp, bổ trợ và mâu thuẫn.",
      "4. Ít nhất hai cách diễn giải hợp lý nếu dữ liệu cho phép; không chọn một cách như sự thật.",
      "5. Điều dữ liệu không thể kết luận và những giả định cần kiểm chứng.",
      "6. Câu hỏi tự suy ngẫm gắn với tình huống thực tế.",
      "7. Ba hành động nhỏ, an toàn, cụ thể, có thể đảo ngược và thời điểm xem lại.",
      "8. Cảnh báo câu chữ tuyệt đối/gây sợ nếu đầu vào có; viết lại theo cách an toàn.",
      "9. Giới hạn phương pháp và nhãn 'Nội dung do AI tạo'.",
      "Trước khi trả lời, lập kiểm tra nội bộ: mọi tên lá, vị trí hành tinh, hào, quẻ, con số và timestamp nhắc lại đều phải xuất hiện nguyên văn trong đầu vào. Nếu không có, ghi 'không có dữ liệu' thay vì suy đoán.",
      factLock.facts.length ? "Mọi câu nhắc tới một dữ kiện trong FACT LOCK phải kết thúc bằng đúng [factId:<id>] tương ứng. Không tạo factId mới. Nếu không có factId hỗ trợ, không viết dữ kiện đó." : "Không có FACT LOCK cấu trúc; chỉ diễn giải nội dung người dùng chủ động nhập và không tự bổ sung dữ kiện.",
      "Không lặp ý để kéo dài. Không suy đoán dữ liệu cá nhân không có trong đầu vào.",
      factLock.facts.length ? `\nFACT LOCK (JSON)\n${JSON.stringify(factLock)}` : "",
      "\nDỮ LIỆU NGƯỜI DÙNG ĐÃ CHỌN\n",
      clean(input, 12000)
    ].join("\n");
  }
  if (actionType === "youtube-batch-metadata") return `Tạo metadata riêng cho từng video. Tiêu đề tối đa 100 ký tự; mô tả trung thực; tối đa 15 tags; chữ thumbnail 2–7 từ. Không lặp title và không bịa người, sự kiện, số liệu hay xu hướng.\n\n${input || ""}\n\nDANH SÁCH\n${JSON.stringify((Array.isArray(meta.items) ? meta.items : []).slice(0, 10), null, 2)}`;
  if (["image-text-batch", "image-text-youtube-batch"].includes(actionType)) {
    const context = typeof meta.context === "string" ? clean(meta.context, 12000) : "";
    return `Quan sát contact sheet có các ô đánh số và tín hiệu YouTube gần đây trong ngữ cảnh. Với mỗi ô, tạo: (1) youtubeTitle nguyên bản tối đa 100 ký tự, phù hợp chủ đề và khoảng tuần/tháng; (2) title 2–5 từ để viết trực tiếp lên thumbnail; (3) subtitle ngắn; (4) tên file an toàn; (5) màu chữ HEX tương phản. Học cấu trúc, ý định tìm kiếm và nhịp câu từ các tiêu đề tham khảo nhưng tuyệt đối không sao chép hoặc chỉ thay vài từ. Không hứa hẹn sai, không bịa số liệu, không lạm dụng clickbait. Mỗi youtubeTitle trong batch phải khác nhau và khớp nội dung ảnh. Trả đủ đúng một item cho mỗi số; giữ nguyên index và filename.\n\nYÊU CẦU\n${input || "Tạo title YouTube và chữ thumbnail phù hợp từng ảnh."}\n\nNGỮ CẢNH\n${context}`;
  }
  const context = typeof meta.context === "string" ? clean(meta.context, 12000) : "";
  const config = meta.config && typeof meta.config === "object" ? JSON.stringify(meta.config, null, 2).slice(0, 12000) : "";
  const actionNotes = {
    rewrite: "Viết lại thành bản hoàn chỉnh. Giữ ý lõi nhưng thay cấu trúc và câu chữ, tăng hook, nhịp giữ chân, cao trào và kết.",
    improve: "Biên tập sâu bản nháp: sửa logic, nhịp, lời thoại, độ rõ, độ mới và khả năng đọc voice.",
    analysis: "Phân tích định lượng và định tính; chấm hook, cấu trúc, cảm xúc, retention, originality, CTA và đưa các sửa đổi ưu tiên.",
    translate: "Dịch tự nhiên sang ngôn ngữ đích trong cấu hình, giữ tone, tên riêng và ý nghĩa; không dịch máy từng chữ.",
    chat: "Trả lời câu hỏi dựa trên ngữ cảnh kịch bản/dự án nếu có.",
    code: "Giải quyết yêu cầu lập trình: xác định nguyên nhân, đưa code hoặc diff tối thiểu có thể chạy, nêu cách kiểm thử và các rủi ro bảo mật liên quan.",
    write: "Tạo bản nội dung hoàn chỉnh đúng đối tượng, mục tiêu, giọng văn, độ dài và định dạng; ưu tiên câu chữ tự nhiên và có thể sử dụng ngay.",
    study: "Hướng dẫn học theo từng bước và mức độ hiện tại; dùng ví dụ, câu hỏi kiểm tra và gợi ý tăng dần, không hiển thị sẵn đáp án bài kiểm tra.",
    vision: "Phân tích đúng ảnh, PDF hoặc tệp đính kèm; trích dữ kiện nhìn thấy, dẫn vị trí khi có thể, đánh dấu phần không đọc được và không suy đoán ngoài tệp.",
    plan: "Tạo kế hoạch nội dung có mục tiêu, chuỗi tập, lịch đăng, KPI, rủi ro và checklist.",
    research: "Nghiên cứu bằng Google Search, tách dữ kiện với suy luận, ghi nguồn ngay cạnh luận điểm.",
    "url-research": "Dùng URL context và Google Search để tổng hợp các URL, so sánh góc nhìn và đề xuất hướng nội dung nguyên bản.",
    workflow: "Chạy toàn bộ pipeline theo đúng thứ tự các bước đã bật; mỗi phần phải có tiêu đề và đầu ra hoàn chỉnh.",
    "content-pack": "Tạo gói nội dung hoàn chỉnh theo JSON schema. Mỗi trường phải là nội dung thực, không phải hướng dẫn chung.",
    "design-plan": "Tạo kế hoạch thiết kế theo JSON schema từ brief và cấu trúc tài liệu hiện tại. Đưa ra bố cục, palette, typography, component, responsive, accessibility và bước triển khai cụ thể; không tuyên bố đã tạo asset hoặc layer nếu hệ thống chưa thực hiện.",
    "music-plan": "Lập production brief hoàn chỉnh cho một video nhạc AI dài: concept, mood, BPM, cấu trúc master, biến thể track, hình ảnh chủ đạo, chuyển động loop, tiêu chí kiểm âm, tiêu đề và rủi ro bản quyền. Trả nội dung có nhãn rõ, ngắn gọn và dùng được ngay.",
    "music-autopilot-plan": "Tạo kế hoạch sản xuất nhạc nguyên bản hoàn chỉnh theo schema: concept, lời có section, cấu trúc có thời lượng và energy, prompt nhạc, negative prompt, artwork, motion, metadata và cảnh báo quyền. Không nhắc tên nghệ sĩ/bài hát cụ thể và không sao chép lời có bản quyền."
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
  thinkingLevel,
  useGoogleSearch,
  useUrlContext,
  structuredSchema,
  maxOutputTokens = 4096
}) {
  const useStructuredOutput = Boolean(structuredSchema);
  const payload = {
    model,
    input: prompt,
    system_instruction: instruction,
    generation_config: {
      ...(!["gemini-3.6-flash", "gemini-3.5-flash-lite"].includes(model) ? { temperature } : {}),
      max_output_tokens: useStructuredOutput ? 8192 : Math.max(1024, Math.min(8192, Number(maxOutputTokens) || 4096)),
      thinking_level: thinkingLevel
    },
    tools: [
      ...(useUrlContext ? [{ type: "url_context" }] : []),
      ...(useGoogleSearch ? [{ type: "google_search" }] : [])
    ],
    ...(useStructuredOutput
      ? { response_format: [{ type: "text", mime_type: "application/json", schema: geminiSchema(structuredSchema) }] }
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
    error.status = response.status;
    error.retryAfterMs = retryAfterMs(response, data);
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

function retryDelay(attempt, status, retryAfterMs = 0) {
  if (status !== 408 && status !== 429 && status < 500) return 0;
  const exponential = (320 * (2 ** attempt)) + Math.floor(Math.random() * 220);
  return Math.min(5000, Math.max(Number(retryAfterMs) || 0, exponential));
}

function durationMilliseconds(value) {
  if (typeof value === "string") {
    const seconds = Number(value.match(/^([0-9.]+)s$/)?.[1]);
    return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : 0;
  }
  if (value && typeof value === "object") {
    return Math.max(0, (Number(value.seconds) || 0) * 1000 + (Number(value.nanos) || 0) / 1_000_000);
  }
  return 0;
}

function retryAfterMs(response, data = {}) {
  const raw = response?.headers?.get?.("retry-after");
  if (raw) {
    const seconds = Number(raw);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(raw);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  const details = Array.isArray(data?.error?.details) ? data.error.details : [];
  for (const detail of details) {
    const delay = durationMilliseconds(detail?.retryDelay || detail?.retry_delay);
    if (delay) return delay;
  }
  const messageDelay = Number(String(data?.error?.message || "").match(/retry\s+in\s+([0-9.]+)s/i)?.[1]);
  return Number.isFinite(messageDelay) ? Math.max(0, messageDelay * 1000) : 0;
}

async function wait(ms) {
  if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runGeminiWithKey({
  apiKey,
  model,
  prompt,
  instruction,
  contents,
  temperature,
  thinkingLevel,
  tools,
  useGoogleSearch,
  useUrlContext,
  structuredSchema,
  canUseInteractions,
  maxOutputTokens = 2048
}) {
  const useStructuredOutput = Boolean(structuredSchema);
  const payload = {
    systemInstruction: { parts: [{ text: instruction }] },
    contents,
    generationConfig: {
      ...(!["gemini-3.6-flash", "gemini-3.5-flash-lite"].includes(model) ? { temperature } : {}),
      ...(model.startsWith("gemini-3") ? { thinkingConfig: { thinkingLevel } } : {}),
      maxOutputTokens: useStructuredOutput ? 8192 : Math.max(1024, Math.min(8192, Number(maxOutputTokens) || 2048)),
      ...(useStructuredOutput
        ? { responseMimeType: "application/json", responseSchema: geminiSchema(structuredSchema) }
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
    signal: AbortSignal.timeout(22000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage = clean(data?.error?.message || `GenerateContent HTTP ${response.status}.`, 300);
    if (canUseInteractions && [400, 403, 404].includes(response.status)) {
      try {
        return await runInteractionsGemini({
          apiKey,
          model,
          prompt,
          instruction,
          temperature,
          thinkingLevel,
          useGoogleSearch,
          useUrlContext,
          structuredSchema,
          maxOutputTokens
        });
      } catch (interactionError) {
        const error = new Error(clean(`${providerMessage} Interactions: ${interactionError.message}`, 300));
        error.code = "GEMINI_PROVIDER_ERROR";
        error.status = interactionError.status || response.status;
        throw error;
      }
    }
    const error = new Error(providerMessage);
    error.code = "GEMINI_PROVIDER_ERROR";
    error.status = response.status;
    error.retryAfterMs = retryAfterMs(response, data);
    throw error;
  }
  const output = generatedText(data);
  if (!output && canUseInteractions) {
    return runInteractionsGemini({
      apiKey,
      model,
      prompt,
      instruction,
      temperature,
      thinkingLevel,
      useGoogleSearch,
      useUrlContext,
      structuredSchema,
      maxOutputTokens
    });
  }
  if (!output) {
    const error = new Error("Gemini returned an empty response.");
    error.code = "GEMINI_EMPTY_RESPONSE";
    error.status = 502;
    throw error;
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

async function runGemini(moduleId, actionType, input, meta = {}) {
  const pool = geminiPool();
  const requestedModel = clean(meta.model, 80);
  if (!pool.keys.length || requestedModel === "local") return null;
  if (pool.availableCount() === 0) {
    const error = new Error("Gemini key pool đang trong thời gian cooldown sau lỗi quota hoặc provider.");
    error.code = "GEMINI_POOL_COOLDOWN";
    error.status = 429;
    error.retryAfterMs = 75 * 1000;
    throw error;
  }
  const model = allowedModels.has(requestedModel)
    ? requestedModel
    : (allowedModels.has(process.env.GEMINI_MODEL) ? process.env.GEMINI_MODEL : "gemini-3.5-flash");
  const modelCandidates = [...new Set([
    model,
    ...(meta.allowModelFallback === false || model === "gemini-3.5-flash-lite" ? [] : ["gemini-3.5-flash-lite"])
  ])].filter((candidate) => allowedModels.has(candidate));
  const useGoogleSearch = Boolean(meta.useGoogleSearch) || ["research", "url-research"].includes(actionType);
  const useUrlContext = actionType === "url-research";
  const structuredSchema = schemaForAction(actionType);
  const creativity = Number(meta.creativity);
  const temperature = Number.isFinite(creativity)
    ? Math.max(0.2, Math.min(1.2, creativity / 100))
    : 0.72;
  const requestedThinking = clean(meta.thinkingLevel || meta.thinking, 20).toLowerCase();
  const thinkingLevel = ["minimal", "low", "medium", "high"].includes(requestedThinking) ? requestedThinking : "medium";
  const maxOutputTokens = moduleId === "fortune" ? 4096 : 2048;
  const prompt = promptFor(moduleId, actionType, input, meta);
  const customInstruction = clean(meta.systemPrompt, 2000);
  const instruction = [systemInstruction(moduleId, actionType), customInstruction].filter(Boolean).join("\n\n");
  const history = sanitizeHistory(meta.history);
  const attachments = sanitizeAttachments(meta.attachments);
  const contents = history.map((message) => ({
    role: message.role,
    parts: [{ text: message.text }]
  }));
  contents.push({
    role: "user",
    parts: [
      { text: prompt },
      ...attachments.map((attachment) => ({
        inlineData: { mimeType: attachment.mimeType, data: attachment.data }
      }))
    ]
  });
  const tools = [
    ...(useUrlContext ? [{ url_context: {} }] : []),
    ...(useGoogleSearch ? [{ google_search: {} }] : [])
  ];
  const candidates = pool.candidates();
  const startedAt = Date.now();
  let lastError = null;
  for (let attempt = 0; attempt < candidates.length; attempt += 1) {
    const apiKey = candidates[attempt];
    for (let modelAttempt = 0; modelAttempt < modelCandidates.length; modelAttempt += 1) {
      const activeModel = modelCandidates[modelAttempt];
      try {
        const result = await runGeminiWithKey({
          apiKey,
          model: activeModel,
          prompt,
          instruction,
          contents,
          temperature,
          thinkingLevel: activeModel.includes("lite") && thinkingLevel === "high" ? "medium" : thinkingLevel,
          tools,
          useGoogleSearch,
          useUrlContext,
          structuredSchema,
          canUseInteractions: attachments.length === 0 && history.length === 0,
          maxOutputTokens
        });
        pool.reportSuccess(apiKey);
        return { ...result, requestedModel: model, fallbackUsed: activeModel !== model, keyAttempts: attempt + 1, keyPoolSize: pool.keys.length };
      } catch (error) {
        lastError = error;
        const status = Number(error.status || 0);
        const canFallbackModel = modelAttempt < modelCandidates.length - 1 && [400, 404, 408, 429, 500, 502, 503, 504].includes(status);
        if (canFallbackModel && Date.now() - startedAt <= 25000) {
          await wait(retryDelay(modelAttempt, status, error.retryAfterMs));
          continue;
        }
        pool.reportFailure(apiKey, status, error.message);
        break;
      }
    }
    const status = Number(lastError?.status || 0);
    if (!canTryAnotherKey(status, lastError?.message) || attempt === candidates.length - 1 || Date.now() - startedAt > 25000) break;
    await wait(retryDelay(attempt, status, lastError?.retryAfterMs));
  }
  throw lastError || new Error("Gemini provider is unavailable.");
}

function requestedCreativeProvider(meta = {}) {
  const provider = clean(meta.provider, 40).toLowerCase();
  if (["auto", "openai", "gemini", "local"].includes(provider)) return provider;
  const model = clean(meta.model, 80).toLowerCase();
  if (model.startsWith("openai:") || OPENAI_MODELS.has(model)) return "openai";
  if (allowedModels.has(model)) return "gemini";
  if (["local", "smart-local", "creative", "analyst", "fast", "hh-local"].includes(model)) return "local";
  return "auto";
}

function creativeProviderOrder(meta = {}) {
  const requested = requestedCreativeProvider(meta);
  if (requested === "local") return [];
  const allowFallback = meta.allowProviderFallback !== false;
  if (requested === "openai") return allowFallback ? ["openai", "gemini"] : ["openai"];
  if (requested === "gemini") return allowFallback ? ["gemini", "openai"] : ["gemini"];
  const preferred = clean(process.env.CREATIVE_AI_PROVIDER || "openai", 40).toLowerCase();
  return preferred === "gemini" ? ["gemini", "openai"] : ["openai", "gemini"];
}

function safetyIdentifierFor(req, user, body = {}) {
  const identity = user?._id
    ? `user:${user._id}`
    : `guest:${clean(body.anonymousId, 160) || requestIp(req)}`;
  const secret = process.env.JWT_SECRET || "hh-creative-safety-identifier";
  return createHmac("sha256", secret).update(identity).digest("hex").slice(0, 64);
}

async function runOpenAI(moduleId, actionType, input, meta = {}, safetyIdentifier = "") {
  const pool = openAIPool();
  if (!pool.keys.length) return null;
  const model = normalizeOpenAIModel(meta.model);
  const useWebSearch = Boolean(meta.useGoogleSearch || meta.useWebSearch)
    || ["research", "url-research"].includes(actionType);
  const structuredSchema = schemaForAction(actionType);
  const prompt = promptFor(moduleId, actionType, input, meta);
  const customInstruction = clean(meta.systemPrompt, 2000);
  const instruction = [systemInstruction(moduleId, actionType), customInstruction].filter(Boolean).join("\n\n");
  const history = sanitizeHistory(meta.history);
  const attachments = sanitizeAttachments(meta.attachments);
  const candidates = pool.candidates();
  const startedAt = Date.now();
  let lastError = null;
  for (let attempt = 0; attempt < candidates.length; attempt += 1) {
    const apiKey = candidates[attempt];
    try {
      const result = await runOpenAIResponse({
        apiKey,
        model,
        prompt,
        instruction,
        history,
        attachments,
        reasoningEffort: meta.reasoningEffort || meta.thinking,
        useWebSearch,
        structuredSchema,
        safetyIdentifier
      });
      pool.reportSuccess(apiKey);
      return { ...result, keyAttempts: attempt + 1, keyPoolSize: pool.keys.length };
    } catch (error) {
      lastError = error;
      const status = Number(error.status || 0);
      pool.reportFailure(apiKey, status, error.message);
      if (!canTryAnotherKey(status, error.message) || attempt === candidates.length - 1 || Date.now() - startedAt > 32000) break;
      await wait(retryDelay(attempt, status));
    }
  }
  throw lastError || new Error("OpenAI provider is unavailable.");
}

module.exports = async function handler(req, res) {
  if (req.query.moduleId === "download-center") return downloadCenterAction(req, res);
  if (req.query.moduleId === "education") return handleEducation(req, res);
  if (req.query.moduleId === "social-media-tools") return handleSocialMedia(req, res);
  if (req.query.moduleId === "music-ai" && (req.query.media === "veo" || musicMediaActions.has(clean(req.body?.actionType, 80)))) {
    return musicMediaAction(req, res);
  }
  return withApi(req, res, async ({ db, body }) => {
    const moduleId = clean(req.query.moduleId, 120);
    const collection = db.collection("moduleActions");
    const user = await currentUser(req);
    if (moduleId === "fortune" && req.query.fortuneVault === "1") {
      if (!user?._id) return res.status(401).json({ error: "Bạn cần đăng nhập để đồng bộ kho nhật ký mã hóa.", code: "AUTH_REQUIRED" });
      await enforceRateLimit(db, `fortune-vault:${user._id}`, 20, 10 * 60 * 1000);
      const vaults = db.collection("fortuneVaults");
      if (req.method === "GET") {
        const record = await vaults.findOne({ userId: user._id }, { projection: { _id: 0, vault: 1, updatedAt: 1 } });
        return res.status(200).json({ ok: true, configured: Boolean(record?.vault), vault: record?.vault || null, updatedAt: record?.updatedAt || null });
      }
      if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
      const source = body.vault && typeof body.vault === "object" ? body.vault : {};
      const vault = { version: 1, salt: clean(source.salt, 200), iv: clean(source.iv, 200), ciphertext: clean(source.ciphertext, 700000) };
      if (!vault.salt || !vault.iv || vault.ciphertext.length < 16) return res.status(400).json({ error: "Kho mã hóa không hợp lệ.", code: "INVALID_VAULT" });
      await vaults.updateOne({ userId: user._id }, { $set: { userId: user._id, vault, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
      return res.status(200).json({ ok: true, encryptedOnly: true, updatedAt: new Date().toISOString() });
    }
    if (moduleId === "comic-reader" && req.query.provider === "mangadex") {
      return handleMangaDexSource(req, res, { db });
    }
    if (moduleId === "comic-reader" && req.query.provider === "otruyen") {
      return handleOTruyenSource(req, res, { db });
    }
    if (moduleId === "comic-reader" && req.query.provider === "open-books") {
      return handleOpenBooksSource(req, res, { db });
    }
    const comicMotionLibraryAction = clean(body.action, 80);
    if (moduleId === "comic-motion" && (req.query.workerManifest || /^(?:library-|batch-job-|worker-|preset-)/.test(comicMotionLibraryAction))) {
      return handleComicMotionApi(req, res, { db, body, user });
    }
    if (moduleId === "comic-motion" || req.query.comicSource === "1") {
      return handleComicSource(req, res, { db, body, user });
    }
    if (req.method === "GET") {
      const anonymousId = clean(req.query.anonymousId, 160);
      const ownerQuery = user?._id
        ? { userId: user._id }
        : (anonymousId ? { anonymousId } : { anonymousId: "__not_available__" });
      const actions = await collection.find({ moduleId, ...ownerQuery }).sort({ createdAt: -1 }).limit(50).toArray();
      const pool = geminiPool();
      const openai = openAIPool();
      const creativeConfigured = pool.keys.length > 0 || openai.keys.length > 0;
      return res.status(200).json({
        moduleId,
        configured: creativeModules.has(moduleId) ? creativeConfigured : undefined,
        keySource: creativeModules.has(moduleId)
          ? (openai.keys.length ? openAIKeySource() : geminiKeySource())
          : undefined,
        keyPoolSize: creativeModules.has(moduleId) ? pool.keys.length : undefined,
        availableKeyCount: creativeModules.has(moduleId) ? pool.availableCount() : undefined,
        defaultProvider: creativeModules.has(moduleId)
          ? (openai.keys.length ? "openai" : (pool.keys.length ? "gemini" : "local"))
          : undefined,
        defaultModel: openai.keys.length
          ? normalizeOpenAIModel(process.env.OPENAI_MODEL)
          : "gemini-3.5-flash",
        providers: creativeModules.has(moduleId)
          ? {
              openai: {
                configured: openai.keys.length > 0,
                keyPoolSize: openai.keys.length,
                availableKeyCount: openai.availableCount(),
                defaultModel: normalizeOpenAIModel(process.env.OPENAI_MODEL),
                api: "responses-v1"
              },
              gemini: {
                configured: pool.keys.length > 0,
                keyPoolSize: pool.keys.length,
                availableKeyCount: pool.availableCount(),
                defaultModel: process.env.GEMINI_MODEL || "gemini-3.5-flash",
                api: "generateContent"
              }
            }
          : undefined,
        supports: creativeModules.has(moduleId)
          ? { history: true, images: true, webSearch: true, googleSearch: true, structuredOutput: true, providerFallback: true, localContinuity: moduleId === "chat-ai" }
          : undefined,
        ...(moduleId === "music-ai" ? musicProviderStatus(user) : {}),
        actions
      });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    if (creativeModules.has(moduleId)) {
      const actor = user?._id ? String(user._id) : requestIp(req);
      const requestLimit = moduleId === "chat-ai" ? (user ? 120 : 40) : (user ? 60 : 24);
      await enforceRateLimit(db, `creative-ai:${actor}`, requestLimit, 10 * 60 * 1000);
    }

    const input = clean(body.input, 48000);
    const actionType = clean(body.actionType || "run", 80);
    const meta = body.meta && typeof body.meta === "object" ? body.meta : {};
    if (moduleId === "chat-ai" && !CHAT_AI_ACTIONS.has(actionType)) {
      const error = new Error("Chế độ Chat AI không hợp lệ.");
      error.statusCode = 400;
      error.code = "CHAT_AI_MODE_INVALID";
      throw error;
    }
    let result = null;
    let provider = "local";
    const providerErrors = [];

    if (creativeModules.has(moduleId)) {
      const safetyIdentifier = safetyIdentifierFor(req, user, body);
      for (const candidate of creativeProviderOrder(meta)) {
        try {
          result = candidate === "openai"
            ? await runOpenAI(moduleId, actionType, input, meta, safetyIdentifier)
            : await runGemini(moduleId, actionType, input, meta);
          if (result) {
            provider = candidate;
            break;
          }
          providerErrors.push(`${candidate}: chưa cấu hình`);
        } catch (error) {
          providerErrors.push(`${candidate}: ${clean(error.message, 220)}`);
        }
      }
    }
    if (!result) {
      if (creativeModules.has(moduleId) && meta.requireProvider === true && requestedCreativeProvider(meta) !== "local") {
        const error = new Error(providerErrors.join(" | ") || "Chưa cấu hình OpenAI hoặc Gemini trên máy chủ.");
        error.statusCode = 503;
        error.code = "CREATIVE_AI_PROVIDER_UNAVAILABLE";
        throw error;
      }
      result = await localCreativeOutput(moduleId, actionType, input, meta);
      if (result.provider) provider = result.provider;
    }

    if (moduleId === "fortune" && actionType === "fortune-deep-analysis") {
      const validated = validateFortuneFactLockedOutput(result.output, meta);
      result = { ...result, output: validated.output, factValidation: validated.factValidation };
    }

    const privateFortuneAction = moduleId === "fortune" && actionType === "fortune-deep-analysis";
    const doc = {
      moduleId,
      actionType,
      input: privateFortuneAction ? `[redacted:${input.length}]` : input,
      output: privateFortuneAction ? "[redacted]" : result.output,
      structured: privateFortuneAction ? null : (result.structured || null),
      provider,
      providerError: providerErrors.join(" | "),
      model: result.model || "hh-local",
      interactionId: result.interactionId || "",
      requestId: result.requestId || "",
      usage: result.usage || null,
      factValidation: privateFortuneAction ? (result.factValidation || null) : undefined,
      sources: result.sources || [],
      providerApi: result.providerApi || (provider === "local" ? "local" : ""),
      keyAttempts: Number(result.keyAttempts || 0),
      keyPoolSize: Number(result.keyPoolSize || 0),
      requestedModel: clean(result.requestedModel, 100),
      fallbackUsed: Boolean(result.fallbackUsed),
      meta: storedMeta(meta),
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
    return res.status(200).json({
      ok: true,
      action: {
        ...doc,
        ...(privateFortuneAction ? { input: "[not-stored]", output: result.output, structured: result.structured || null } : {}),
        _id: insert.insertedId
      }
    });
  });
};
