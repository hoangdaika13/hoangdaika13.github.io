const dns = require("dns").promises;
const net = require("net");
const { createHash, createHmac, timingSafeEqual } = require("crypto");
const {
  clean,
  enforceRateLimit
} = require("./platform");

const MAX_HTML_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_IMAGES = 120;
const MAX_CHAPTERS = 200;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;
// Legacy permissionReference/license/author values are intentionally not collected; one self-attestation is enough.

function fail(message, statusCode = 400, code = "COMIC_SOURCE_INVALID") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  throw error;
}

// Normalize URLs pasted from chat, notes, or markdown before parsing.
function normalizeSourceUrl(input) {
  let value = String(input ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  for (let pass = 0; pass < 2; pass += 1) {
    const wrapped = value.match(/^<\s*([\s\S]*?)\s*>$/) || value.match(/^[`"']\s*([\s\S]*?)\s*[`"']$/);
    if (!wrapped) break;
    value = wrapped[1].trim();
  }
  value = value.replace(/[\r\n\t]/g, "").replace(/\s+/g, "");
  if (/^www\./i.test(value)) value = `https://${value}`;
  else if (value && !/^[a-z][a-z0-9+.-]*:/i.test(value)) value = `https://${value}`;
  return value;
}

function isPrivateIp(address) {
  const value = String(address || "").trim().toLowerCase();
  if (!value) return true;
  if (value === "::" || value === "::1") return true;
  if (value.startsWith("fc") || value.startsWith("fd") || /^fe[89ab]/.test(value)) return true;
  if (value.startsWith("::ffff:")) return isPrivateIp(value.slice(7));
  if (net.isIP(value) === 6) return false;
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19))
    || a >= 224;
}

async function assertPublicHttpsUrl(input) {
  let parsed;
  const normalized = normalizeSourceUrl(input);
  try { parsed = new URL(normalized); }
  catch { fail("URL không hợp lệ."); }
  if (parsed.protocol !== "https:") fail("Nguồn website phải sử dụng HTTPS.", 400, "HTTPS_REQUIRED");
  if (parsed.username || parsed.password) fail("URL không được chứa thông tin đăng nhập.");
  if (parsed.port && parsed.port !== "443") fail("Cổng mạng này không được phép.", 400, "PORT_BLOCKED");
  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    fail("Địa chỉ nội bộ không được phép.", 400, "PRIVATE_NETWORK_BLOCKED");
  }
  const addresses = net.isIP(hostname)
    ? [{ address: hostname }]
    : await dns.lookup(hostname, { all: true, verbatim: true }).catch(() => fail("Không phân giải được tên miền.", 400, "DNS_LOOKUP_FAILED"));
  if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) {
    fail("Nguồn trỏ tới mạng riêng hoặc địa chỉ bị chặn.", 400, "PRIVATE_NETWORK_BLOCKED");
  }
  parsed.hash = "";
  return parsed;
}

async function readLimited(response, limit) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > limit) fail("Tệp nguồn vượt giới hạn dung lượng.", 413, "SOURCE_TOO_LARGE");
  if (!response.body?.getReader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > limit) fail("Tệp nguồn vượt giới hạn dung lượng.", 413, "SOURCE_TOO_LARGE");
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      fail("Tệp nguồn vượt giới hạn dung lượng.", 413, "SOURCE_TOO_LARGE");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

async function fetchSafe(input, { type = "html" } = {}) {
  let url = await assertPublicHttpsUrl(input);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: type === "image" ? "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.8" : "text/html,application/xhtml+xml;q=0.9",
          "User-Agent": "HH-Comic-Motion-Studio/1.0 (authorized single-page import)"
        }
      });
    } catch (error) {
      fail(error?.name === "AbortError" ? "Nguồn phản hồi quá chậm." : "Không thể tải nguồn đã cấp phép.", 502, "SOURCE_FETCH_FAILED");
    } finally { clearTimeout(timer); }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirect === MAX_REDIRECTS) fail("Nguồn chuyển hướng quá nhiều lần.", 400, "REDIRECT_LIMIT");
      const location = response.headers.get("location");
      if (!location) fail("Chuyển hướng không hợp lệ.", 400, "REDIRECT_INVALID");
      url = await assertPublicHttpsUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok) fail(`Nguồn trả về HTTP ${response.status}.`, 502, "SOURCE_HTTP_ERROR");
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (type === "html" && !/(text\/html|application\/xhtml\+xml)/.test(contentType)) {
      fail("URL không trả về một trang HTML.", 415, "HTML_REQUIRED");
    }
    if (type === "image" && !/^image\/(jpeg|png|webp|gif|avif)/.test(contentType)) {
      fail("Tài nguyên không phải ảnh được hỗ trợ.", 415, "IMAGE_REQUIRED");
    }
    const body = await readLimited(response, type === "image" ? MAX_IMAGE_BYTES : MAX_HTML_BYTES);
    return { body, contentType, url: url.href };
  }
  fail("Không thể tải nguồn.", 502, "SOURCE_FETCH_FAILED");
}

function attrOf(tag, name) {
  const match = String(tag).match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:["']([^"']*)["']|([^\\s>]+))`, "i"));
  return String(match?.[1] || match?.[2] || "").trim();
}

function bestSrc(tag) {
  for (const name of ["data-original", "data-src", "data-lazy-src", "data-image", "src"]) {
    const value = attrOf(tag, name);
    if (value && !/^(data:|blob:|javascript:|#)/i.test(value) && !/placeholder|spacer|loading/i.test(value)) return value;
  }
  const srcset = attrOf(tag, "data-srcset") || attrOf(tag, "srcset");
  return srcset.split(",").map((item) => item.trim().split(/\s+/)[0]).filter(Boolean).at(-1) || "";
}

function extractImageUrls(html, pageUrl) {
  const output = [];
  const seen = new Set();
  const candidates = String(html || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|header|footer|nav|aside)\b[\s\S]*?<\/\1\s*>/gi, "");
  for (const match of candidates.matchAll(/<img\b[^>]*>/gi)) {
    const source = bestSrc(match[0]);
    if (!source) continue;
    let resolved;
    try { resolved = new URL(source.replace(/&amp;/g, "&"), pageUrl); } catch { continue; }
    if (resolved.protocol !== "https:") continue;
    resolved.hash = "";
    const href = resolved.href;
    const descriptor = `${href} ${attrOf(match[0], "alt")} ${attrOf(match[0], "class")} ${attrOf(match[0], "id")}`;
    if (/\b(avatar|emoji|icon|logo|banner|advert|advertisement|tracking|pixel|comment|user-photo|meme|sticker|adblock)\b/i.test(descriptor)) continue;
    const declaredWidth = Number(attrOf(match[0], "width")) || 0;
    const declaredHeight = Number(attrOf(match[0], "height")) || 0;
    if ((declaredWidth && declaredWidth < 240) || (declaredHeight && declaredHeight < 240)) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    output.push({
      url: href,
      alt: clean(attrOf(match[0], "alt"), 240),
      width: declaredWidth,
      height: declaredHeight
    });
    if (output.length >= MAX_IMAGES) break;
  }
  return output;
}

function selectChapterImages(images) {
  const source = Array.isArray(images) ? images : [];
  if (source.length < 3) return source;
  const largestGroup = (keyOf) => {
    const groups = new Map();
    for (const image of source) {
      const key = keyOf(image);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(image);
    }
    return [...groups.values()].sort((a, b) => b.length - a.length)[0] || [];
  };
  const repeatedAlt = largestGroup((image) => clean(image.alt, 120).trim().toLowerCase());
  if (repeatedAlt.length >= 3 && repeatedAlt.length >= source.length * 0.35) return repeatedAlt;
  const dominantDirectory = largestGroup((image) => {
    try {
      const url = new URL(image.url);
      return `${url.origin}${url.pathname.replace(/\/[^/]*$/, "/")}`;
    } catch { return ""; }
  });
  if (dominantDirectory.length >= 3 && dominantDirectory.length >= source.length * 0.5) return dominantDirectory;
  const dominantHost = largestGroup((image) => {
    try { return new URL(image.url).hostname; } catch { return ""; }
  });
  return dominantHost.length >= 3 && dominantHost.length >= source.length * 0.6 ? dominantHost : source;
}

function extractPageTitle(html) {
  const match = String(html || "").match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  return clean(String(match?.[1] || "").replace(/<[^>]+>/g, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, " "), 240);
}

function stableFingerprint(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

function sequenceFingerprint(images) {
  return stableFingerprint((Array.isArray(images) ? images : []).map((image) => image.url).join("\n"));
}

function chapterNumber(value) {
  const match = String(value || "").match(/(?:chap(?:ter)?|chuong|chương)[^0-9]{0,8}(\d+(?:\.\d+)?)/i);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function extractChapterLinks(html, seriesUrl) {
  let base;
  try { base = new URL(seriesUrl); } catch { return []; }
  const seen = new Set();
  const links = [];
  for (const match of String(html || "").matchAll(/<a\b[^>]*href\s*=\s*(?:["']([^"']+)["']|([^\s>]+))[^>]*>([\s\S]*?)<\/a\s*>/gi)) {
    const raw = String(match[1] || match[2] || "").replace(/&amp;/gi, "&").trim();
    if (!raw || /^(?:javascript:|mailto:|#)/i.test(raw)) continue;
    let url;
    try { url = new URL(raw, base); } catch { continue; }
    if (url.protocol !== "https:" || url.hostname !== base.hostname) continue;
    url.hash = "";
    const text = clean(String(match[3] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "), 180);
    const descriptor = `${url.href} ${text}`;
    if (!/(?:chap(?:ter)?|chuong|chương)\b/i.test(descriptor)) continue;
    if (/(?:comment|bình luận|binh-luan|author|tác-giả|tag|category|the-loai|genre|login|register|facebook|twitter)/i.test(descriptor)) continue;
    const number = chapterNumber(descriptor);
    if (!Number.isFinite(number) || seen.has(url.href)) continue;
    seen.add(url.href);
    links.push({ url: url.href, title: text || `Chương ${number}`, number });
  }
  return links.sort((a, b) => b.number - a.number || a.url.localeCompare(b.url)).slice(0, MAX_CHAPTERS);
}

function signChapter(userId, seriesUrl, chapterUrl) {
  const payload = Buffer.from(JSON.stringify({ kind: "chapter", userId, seriesUrl, chapterUrl, exp: Date.now() + 6 * 60 * 60 * 1000 })).toString("base64url");
  const signature = createHmac("sha256", signingSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyChapter(token, userId) {
  const value = verifyAsset(token, userId);
  if (value.kind !== "chapter" || !value.seriesUrl || !value.chapterUrl) fail("Phiên chương không hợp lệ.", 403, "CHAPTER_TOKEN_INVALID");
  return value;
}

function signingSecret() {
  const value = String(process.env.GATEWAY_AUDIT_SALT || process.env.JWT_SECRET || "");
  if (value.length < 32) fail("Máy chủ chưa cấu hình khóa bảo mật.", 503, "SECURITY_CONFIG_MISSING");
  return value;
}

function signAsset(userId, pageUrl, assetUrl) {
  const payload = Buffer.from(JSON.stringify({ userId, pageUrl, assetUrl, exp: Date.now() + 30 * 60 * 1000 })).toString("base64url");
  const signature = createHmac("sha256", signingSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifyAsset(token, userId) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) fail("Phiên nhập ảnh không hợp lệ.", 403, "IMPORT_TOKEN_INVALID");
  const expected = createHmac("sha256", signingSecret()).update(payload).digest("base64url");
  const suppliedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    fail("Phiên nhập ảnh không hợp lệ.", 403, "IMPORT_TOKEN_INVALID");
  }
  let value;
  try { value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); }
  catch { fail("Phiên nhập ảnh không hợp lệ.", 403, "IMPORT_TOKEN_INVALID"); }
  if (String(value.userId) !== String(userId) || Number(value.exp) < Date.now()) {
    fail("Phiên nhập ảnh đã hết hạn.", 403, "IMPORT_TOKEN_EXPIRED");
  }
  return value;
}

async function elevenLabsVoices() {
  const apiKey = clean(process.env.ELEVENLABS_API_KEY, 400);
  if (!apiKey) fail("Chưa cấu hình ElevenLabs cho giọng đọc kết xuất.", 503, "TTS_NOT_CONFIGURED");
  const response = await fetch("https://api.elevenlabs.io/v2/voices?page_size=100&include_total_count=true", {
    headers: { "xi-api-key": apiKey, Accept: "application/json" }
  });
  if (!response.ok) fail("Không tải được danh sách giọng đọc.", 502, "TTS_PROVIDER_ERROR");
  const data = await response.json();
  return (data.voices || []).slice(0, 100).map((voice) => ({
    id: clean(voice.voice_id, 120),
    name: clean(voice.name, 120),
    category: clean(voice.category, 80),
    labels: voice.labels && typeof voice.labels === "object" ? voice.labels : {}
  }));
}

async function elevenLabsTts(body) {
  const apiKey = clean(process.env.ELEVENLABS_API_KEY, 400);
  if (!apiKey) fail("Chưa cấu hình ElevenLabs cho giọng đọc kết xuất.", 503, "TTS_NOT_CONFIGURED");
  const text = clean(body.text, 2000);
  const voiceId = clean(body.voiceId || process.env.ELEVENLABS_VOICE_ID, 120);
  if (!text) fail("Câu thoại đang trống.");
  if (!/^[a-zA-Z0-9_-]{8,120}$/.test(voiceId)) fail("Hãy chọn một giọng ElevenLabs hợp lệ.");
  const emotion = clean(body.emotion || "neutral", 30);
  const emotionSettings = {
    neutral: { stability: 0.58, similarity: 0.76, style: 0.18 }, warm: { stability: 0.5, similarity: 0.78, style: 0.32 },
    sad: { stability: 0.68, similarity: 0.74, style: 0.28 }, angry: { stability: 0.32, similarity: 0.72, style: 0.62 },
    excited: { stability: 0.3, similarity: 0.76, style: 0.58 }, whisper: { stability: 0.7, similarity: 0.72, style: 0.2 }
  };
  const expressive = emotionSettings[emotion] || emotionSettings.neutral;
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      text,
      model_id: clean(process.env.ELEVEN_TTS_MODEL || "eleven_multilingual_v2", 80),
      voice_settings: {
        stability: Math.max(0, Math.min(1, Number(body.stability ?? expressive.stability))),
        similarity_boost: Math.max(0, Math.min(1, Number(body.similarity ?? expressive.similarity))),
        style: expressive.style,
        use_speaker_boost: true
      }
    })
  });
  if (!response.ok) fail("ElevenLabs không thể tạo giọng đọc cho câu này.", 502, "TTS_PROVIDER_ERROR");
  const data = await response.json();
  return {
    audioBase64: String(data.audio_base64 || ""),
    alignment: data.alignment || data.normalized_alignment || null,
    mimeType: "audio/mpeg"
  };
}

async function handleComicSource(req, res, { db, body, user }) {
    if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để dùng nguồn website và TTS." });
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const userId = String(user._id);
    const action = clean(body.action, 40);

    if (action === "inspect-series") {
      await enforceRateLimit(db, `comic-series-inspect:${userId}`, 120, 60 * 60 * 1000);
      if (body.rightsAttested !== true) {
        return res.status(400).json({ error: "Hãy xác nhận bạn sở hữu hoặc được phép tải nội dung từ nguồn này." });
      }
      const series = await assertPublicHttpsUrl(body.url);
      const fetched = await fetchSafe(series.href, { type: "html" });
      const html = fetched.body.toString("utf8");
      const chapters = extractChapterLinks(html, fetched.url);
      if (!chapters.length) return res.status(422).json({ error: "Không tìm thấy danh sách chương trên trang truyện này." });
      const now = new Date();
      await db.collection("comicSourceRights").updateOne(
        { userId: user._id, domain: series.hostname },
        { $set: { userId: user._id, domain: series.hostname, rightsAttested: true, siteAuthorization: true, lastSourceUrl: fetched.url, attestedAt: now, updatedAt: now } },
        { upsert: true }
      );
      return res.status(200).json({
        source: { url: fetched.url, domain: series.hostname, title: extractPageTitle(html), inspectedAt: now.toISOString() },
        policy: { exactPageOnly: false, recursiveCrawl: false, antiBotBypass: false, maxChapters: MAX_CHAPTERS },
        chapters: chapters.map((chapter, index) => ({ index, number: chapter.number, title: chapter.title, url: chapter.url, token: signChapter(userId, fetched.url, chapter.url) }))
      });
    }

    if (action === "inspect-chapter") {
      await enforceRateLimit(db, `comic-chapter-inspect:${userId}`, 180, 15 * 60 * 1000);
      const chapterToken = verifyChapter(body.token, userId);
      const series = await assertPublicHttpsUrl(chapterToken.seriesUrl);
      const chapter = await assertPublicHttpsUrl(chapterToken.chapterUrl);
      if (series.hostname !== chapter.hostname) return res.status(403).json({ error: "Chương không thuộc cùng nguồn truyện." });
      const authorization = await db.collection("comicSourceRights").findOne({ userId: user._id, domain: chapter.hostname, $or: [{ rightsAttested: true }, { siteAuthorization: true }] });
      if (!authorization) return res.status(403).json({ error: "Bạn chưa xác nhận quyền tải nguồn này." });
      const fetched = await fetchSafe(chapter.href, { type: "html" });
      const html = fetched.body.toString("utf8");
      const candidates = extractImageUrls(html, fetched.url);
      const images = selectChapterImages(candidates);
      if (!images.length) return res.status(422).json({ error: "Không tìm thấy ảnh trong chương này." });
      return res.status(200).json({
        source: { url: fetched.url, domain: chapter.hostname, title: extractPageTitle(html), inspectedAt: new Date().toISOString() },
        policy: { exactPageOnly: true, recursiveCrawl: false, antiBotBypass: false, maxImages: MAX_IMAGES, candidateImages: candidates.length, selectedImages: images.length, sequenceDetection: "dominant-alt-directory-host", sequenceFingerprint: sequenceFingerprint(images) },
        images: images.map((image, index) => ({ index, alt: image.alt, width: image.width, height: image.height, fingerprint: stableFingerprint(image.url), token: signAsset(userId, fetched.url, image.url) }))
      });
    }

    if (action === "inspect") {
      await enforceRateLimit(db, `comic-inspect:${userId}`, 15, 15 * 60 * 1000);
      if (body.rightsAttested !== true) return res.status(400).json({ error: "Hãy xác nhận bạn sở hữu hoặc được phép tải nội dung từ nguồn này." });
      const page = await assertPublicHttpsUrl(body.url);
      const fetched = await fetchSafe(page.href, { type: "html" });
      const html = fetched.body.toString("utf8");
      const candidates = extractImageUrls(html, fetched.url);
      const images = selectChapterImages(candidates);
      if (!images.length) return res.status(422).json({ error: "Không tìm thấy ảnh tĩnh trong trang này. Trang tải ảnh bằng JavaScript có thể cần adapter riêng." });
      const now = new Date();
      await db.collection("comicSourceRights").updateOne(
        { userId: user._id, domain: page.hostname },
        { $set: { userId: user._id, domain: page.hostname, rightsAttested: true, siteAuthorization: true, lastSourceUrl: fetched.url, attestedAt: now, updatedAt: now } },
        { upsert: true }
      );
      return res.status(200).json({
        source: { url: fetched.url, domain: page.hostname, title: extractPageTitle(html), inspectedAt: now.toISOString() },
        policy: { exactPageOnly: true, recursiveCrawl: false, antiBotBypass: false, maxImages: MAX_IMAGES, candidateImages: candidates.length, selectedImages: images.length, sequenceDetection: "dominant-alt-directory-host", sequenceFingerprint: sequenceFingerprint(images) },
        images: images.map((image, index) => ({
          index,
          alt: image.alt,
          width: image.width,
          height: image.height,
          fingerprint: stableFingerprint(image.url),
          token: signAsset(userId, fetched.url, image.url)
        }))
      });
    }

    if (action === "fetch-image") {
      await enforceRateLimit(db, `comic-image:${userId}`, 180, 15 * 60 * 1000);
      const value = verifyAsset(body.token, userId);
      const authorization = await db.collection("comicSourceRights").findOne({ userId: user._id, domain: new URL(value.pageUrl).hostname, $or: [{ rightsAttested: true }, { siteAuthorization: true }] });
      if (!authorization) return res.status(403).json({ error: "Bạn chưa xác nhận quyền tải nguồn này." });
      const image = await fetchSafe(value.assetUrl, { type: "image" });
      res.setHeader("Content-Type", image.contentType.split(";")[0]);
      res.setHeader("Content-Length", String(image.body.byteLength));
      res.setHeader("Cache-Control", "private, no-store");
      return res.status(200).send(image.body);
    }

    if (action === "voices") {
      await enforceRateLimit(db, `comic-voices:${userId}`, 20, 60 * 60 * 1000);
      return res.status(200).json({ voices: await elevenLabsVoices() });
    }

    if (action === "tts") {
      await enforceRateLimit(db, `comic-tts:${userId}`, 60, 60 * 60 * 1000);
      return res.status(200).json(await elevenLabsTts(body));
    }

    return res.status(400).json({ error: "Action không hợp lệ." });
}

module.exports = {
  handleComicSource,
  __test: Object.freeze({
    normalizeSourceUrl,
    assertPublicHttpsUrl,
    isPrivateIp,
    extractImageUrls,
    extractChapterLinks,
    selectChapterImages,
    extractPageTitle,
    stableFingerprint,
    sequenceFingerprint,
    attrOf,
    bestSrc,
    verifyAsset
  })
};
