(function initSocialMediaToolsCore(root) {
  "use strict";

  const SCHEMA_VERSION = 1;
  const STORAGE_PREFIX = "hh.social-media.v1";
  const ROLES = Object.freeze(["owner", "admin", "editor", "reviewer", "publisher", "analyst"]);
  const JOB_STATES = Object.freeze(["draft", "awaiting-review", "approved", "scheduled", "publishing", "published", "failed", "retry-scheduled", "cancelled", "manual-package"]);
  const PLATFORM_LIMITS = Object.freeze({ instagram: 2200, facebook: 63206, tiktok: 2200, x: 280, threads: 500, linkedin: 3000, pinterest: 500, reddit: 40000, telegram: 4096, discord: 2000, bluesky: 300, mastodon: 500 });
  const clean = (value, max = 2000) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  const safeId = (value, fallback = "default") => clean(value, 120).replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 100) || fallback;
  const ownerIdFor = (user) => safeId(user?.id || user?._id || user?.email || "guest", "guest");
  const slug = (value, fallback = "social-asset") => clean(value, 180).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100) || fallback;
  const filename = (value, extension = "") => `${slug(String(value || "").replace(/\.[^.]+$/, ""))}${extension ? `.${clean(extension, 8).replace(/[^a-z0-9]/gi, "").toLowerCase()}` : ""}`;
  const normalizeUrl = (value, httpsOnly = true) => { try { const url = new URL(clean(value, 1600)); if (httpsOnly && url.protocol !== "https:") return ""; if (!["http:", "https:"].includes(url.protocol)) return ""; return url.href; } catch { return ""; } };

  function captionStats(value, platform = "instagram") {
    const text = String(value || ""); const limit = PLATFORM_LIMITS[platform] || 2200;
    const hashtags = [...new Set(text.match(/#[\p{L}\p{N}_]+/gu) || [])];
    const mentions = [...new Set(text.match(/@[\p{L}\p{N}._]+/gu) || [])];
    const links = [...new Set(text.match(/https?:\/\/[^\s]+/g) || [])];
    return { characters: [...text].length, limit, remaining: limit - [...text].length, hashtags, mentions, links, valid: [...text].length <= limit };
  }

  function formatCaption(input = {}) {
    const hook = clean(input.hook, 300); const body = clean(input.body, 5000); const cta = clean(input.cta, 300);
    const tags = [...new Set((Array.isArray(input.hashtags) ? input.hashtags : String(input.hashtags || "").split(/[\s,]+/)).map((tag) => clean(tag, 80).replace(/^#/, "")).filter(Boolean))].slice(0, 30);
    return [hook, body, cta, tags.length ? tags.map((tag) => `#${tag}`).join(" ") : ""].filter(Boolean).join("\n\n");
  }

  function splitThread(value, platform = "x") {
    const limit = PLATFORM_LIMITS[platform] || 280; const words = String(value || "").trim().split(/\s+/).filter(Boolean); const parts = []; let current = "";
    for (const word of words) {
      if ([...word].length > limit) { if (current) parts.push(current); const chars = [...word]; while (chars.length) parts.push(chars.splice(0, limit).join("")); current = ""; continue; }
      const next = current ? `${current} ${word}` : word;
      if ([...next].length > limit) { if (current) parts.push(current); current = word; } else current = next;
    }
    if (current) parts.push(current); return parts;
  }

  function buildUtm(input = {}) {
    const target = normalizeUrl(input.url); if (!target) throw new Error("URL chiến dịch phải dùng HTTPS hợp lệ.");
    const url = new URL(target); const fields = { utm_source: input.source, utm_medium: input.medium, utm_campaign: input.campaign, utm_term: input.term, utm_content: input.content };
    for (const [key, value] of Object.entries(fields)) { const normalized = slug(value, ""); if (normalized) url.searchParams.set(key, normalized); }
    if (!url.searchParams.get("utm_source") || !url.searchParams.get("utm_medium") || !url.searchParams.get("utm_campaign")) throw new Error("UTM cần source, medium và campaign.");
    return url.href;
  }

  function buildOpenGraph(input = {}) {
    const title = clean(input.title, 120); const description = clean(input.description, 300); const url = normalizeUrl(input.url); const image = normalizeUrl(input.image);
    if (!title || !description || !url || !image) throw new Error("Open Graph cần title, description, URL và ảnh HTTPS.");
    const siteName = clean(input.siteName || "HH Platform", 100); const locale = clean(input.locale || "vi_VN", 20); const type = new Set(["website", "article", "video.other", "music.song", "profile"]).has(input.type) ? input.type : "website";
    const tags = { "og:title": title, "og:description": description, "og:url": url, "og:image": image, "og:type": type, "og:site_name": siteName, "og:locale": locale, "twitter:card": "summary_large_image", "twitter:title": title, "twitter:description": description, "twitter:image": image };
    const html = [`<link rel="canonical" href="${escapeAttribute(url)}">`, ...Object.entries(tags).map(([property, content]) => `<meta ${property.startsWith("twitter:") ? "name" : "property"}="${escapeAttribute(property)}" content="${escapeAttribute(content)}">`)].join("\n");
    const jsonLd = { "@context": "https://schema.org", "@type": type === "article" ? "Article" : type === "profile" ? "Person" : "WebPage", name: title, description, url, image };
    return { tags, html, jsonLd, warnings: [...title].length > 60 ? ["Title dài hơn 60 ký tự; một số nền tảng có thể cắt."] : [] };
  }
  function escapeAttribute(value) { return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }

  function estimateXRevenue(input = {}) {
    const impressions = Math.max(0, Number(input.impressions) || 0); const eligibleRate = Math.max(0, Math.min(1, Number(input.eligibleRate) || 0)); const rpm = Math.max(0, Number(input.rpm) || 0);
    const midpoint = impressions * eligibleRate / 1000 * rpm; const uncertainty = Math.max(.05, Math.min(.9, Number(input.uncertainty) || .35));
    return { midpoint, low: midpoint * (1 - uncertainty), high: midpoint * (1 + uncertainty), currency: clean(input.currency || "USD", 8), formula: "impressions × eligibleRate ÷ 1000 × RPM", disclaimer: "Chỉ là ước tính từ giả định do người dùng nhập, không phải doanh thu thật." };
  }

  function parseVideoRef(value, provider = "youtube") {
    const raw = clean(value, 800);
    if (provider === "youtube" && /^[A-Za-z0-9_-]{11}$/.test(raw)) return { provider, id: raw, url: `https://www.youtube.com/watch?v=${raw}` };
    if (provider === "vimeo" && /^\d{5,12}$/.test(raw)) return { provider, id: raw, url: `https://vimeo.com/${raw}` };
    try {
      const url = new URL(raw); if (provider === "youtube") { const id = url.hostname === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v") || url.pathname.match(/\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})/)?.[1]; if (/^[A-Za-z0-9_-]{11}$/.test(id || "")) return { provider, id, url: `https://www.youtube.com/watch?v=${id}` }; }
      if (provider === "vimeo" && /(^|\.)vimeo\.com$/.test(url.hostname)) { const id = url.pathname.match(/\/(\d{5,12})(?:$|\/)/)?.[1]; if (id) return { provider, id, url: `https://vimeo.com/${id}` }; }
    } catch {}
    return null;
  }

  function textMetrics(value, platform = "instagram") {
    const text = String(value || ""); const stats = captionStats(text, platform);
    const words = text.trim() ? text.trim().split(/\s+/u).length : 0;
    const lines = text ? text.split(/\r?\n/).length : 0;
    return { ...stats, words, lines, readingSeconds: words ? Math.max(1, Math.ceil(words / 3.3)) : 0, bytes: new TextEncoder().encode(text).length };
  }

  function transformText(value, mode = "sentence") {
    const text = String(value || ""); const words = text.trim().split(/\s+/u).filter(Boolean);
    if (mode === "upper") return text.toLocaleUpperCase("vi");
    if (mode === "lower") return text.toLocaleLowerCase("vi");
    if (mode === "title") return words.map((word) => [...word].map((char, index) => index ? char.toLocaleLowerCase("vi") : char.toLocaleUpperCase("vi")).join("")).join(" ");
    if (mode === "camel") return words.map((word, index) => { const lower = word.toLocaleLowerCase("vi"); return index ? [...lower].map((char, charIndex) => charIndex ? char : char.toLocaleUpperCase("vi")).join("") : lower; }).join("");
    if (mode === "kebab") return slug(text, "");
    if (mode === "toggle") return [...text].map((char) => char === char.toLocaleUpperCase("vi") ? char.toLocaleLowerCase("vi") : char.toLocaleUpperCase("vi")).join("");
    return text.toLocaleLowerCase("vi").replace(/(^|[.!?]\s+)([\p{L}])/gu, (match, prefix, char) => `${prefix}${char.toLocaleUpperCase("vi")}`);
  }

  function normalizeSocialText(value, options = {}) {
    let text = String(value || "").replace(/\r\n?/g, "\n").replace(/[\t\u00a0]+/g, " ").replace(/[ ]{2,}/g, " ").replace(/ +\n/g, "\n");
    if (options.compactLines !== false) text = text.replace(/\n{3,}/g, "\n\n");
    return options.preserveOuterSpace ? text : text.trim();
  }

  function cleanHashtags(value, max = 30) {
    const raw = String(value || "").split(/[\s,;|]+/u).map((tag) => clean(tag, 100).replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "")).filter(Boolean);
    const uniqueMap = new Map(); for (const tag of raw) { const key = tag.toLocaleLowerCase("vi"); if (!uniqueMap.has(key)) uniqueMap.set(key, tag); }
    const unique = [...uniqueMap.values()].slice(0, Math.max(1, Math.min(100, Number(max) || 30)));
    return { items: unique, text: unique.map((tag) => `#${tag}`).join(" "), removed: Math.max(0, raw.length - unique.length) };
  }

  function profileUrl(provider, username) {
    const handle = clean(username, 120).replace(/^@/, "").replace(/[^a-zA-Z0-9._-]/g, "");
    if (!handle) throw new Error("Cần nhập tên tài khoản hợp lệ.");
    const bases = { instagram:"https://www.instagram.com/", tiktok:"https://www.tiktok.com/@", x:"https://x.com/", threads:"https://www.threads.net/@", youtube:"https://www.youtube.com/@", linkedin:"https://www.linkedin.com/in/", pinterest:"https://www.pinterest.com/", telegram:"https://t.me/", facebook:"https://www.facebook.com/" };
    if (!bases[provider]) throw new Error("Nền tảng chưa được hỗ trợ.");
    return `${bases[provider]}${encodeURIComponent(handle)}`;
  }

  function buildShareUrl(input = {}) {
    const provider = clean(input.provider, 30).toLowerCase(); const text = clean(input.text, 4000); const target = normalizeUrl(input.url || "https://hoang8.com/");
    const encodedUrl = encodeURIComponent(target); const encodedText = encodeURIComponent(text); const combined = encodeURIComponent([text, target].filter(Boolean).join(" "));
    if (provider === "whatsapp") { const phone = String(input.phone || "").replace(/\D/g, "").slice(0, 18); return `https://wa.me/${phone}?text=${combined}`; }
    if (provider === "telegram") return `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
    if (provider === "facebook") return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    if (provider === "x") return `https://x.com/intent/post?url=${encodedUrl}&text=${encodedText}`;
    if (provider === "linkedin") return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    if (provider === "reddit") return `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedText}`;
    if (provider === "email") return `mailto:?subject=${encodeURIComponent(clean(input.title, 180))}&body=${combined}`;
    throw new Error("Nền tảng chia sẻ chưa được hỗ trợ.");
  }

  function buildYouTubeEmbed(value, options = {}) {
    const ref = parseVideoRef(value, "youtube"); if (!ref) throw new Error("URL hoặc ID YouTube không hợp lệ.");
    const start = Math.max(0, Math.floor(Number(options.start) || 0)); const query = new URLSearchParams({ rel:"0" });
    if (start) query.set("start", String(start)); if (options.autoplay === true) query.set("autoplay", "1");
    const src = `https://www.youtube-nocookie.com/embed/${ref.id}?${query}`;
    return { id:ref.id, src, html:`<iframe width="560" height="315" src="${escapeAttribute(src)}" title="YouTube video player" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>` };
  }

  const SOCIAL_DIMENSIONS = Object.freeze([
    { platform:"Instagram", asset:"Bài đăng dọc", ratio:"4:5", width:1080, height:1350 }, { platform:"Instagram", asset:"Story / Reel", ratio:"9:16", width:1080, height:1920 },
    { platform:"TikTok", asset:"Video / Cover", ratio:"9:16", width:1080, height:1920 }, { platform:"YouTube", asset:"Thumbnail", ratio:"16:9", width:1280, height:720 },
    { platform:"YouTube", asset:"Shorts", ratio:"9:16", width:1080, height:1920 }, { platform:"Facebook", asset:"Bài đăng", ratio:"1.91:1", width:1200, height:630 },
    { platform:"LinkedIn", asset:"Bài đăng", ratio:"1.91:1", width:1200, height:627 }, { platform:"Pinterest", asset:"Pin", ratio:"2:3", width:1000, height:1500 },
    { platform:"X", asset:"Ảnh bài đăng", ratio:"16:9", width:1600, height:900 }
  ].map(Object.freeze));

  function roleCan(role, action) {
    const matrix = { owner: ["read", "edit", "review", "publish", "manage", "analytics"], admin: ["read", "edit", "review", "publish", "manage", "analytics"], editor: ["read", "edit"], reviewer: ["read", "review"], publisher: ["read", "publish"], analyst: ["read", "analytics"] };
    return Boolean(matrix[role]?.includes(action));
  }
  function nextJobState(current, action) {
    const transitions = { draft: { review: "awaiting-review", cancel: "cancelled" }, "awaiting-review": { approve: "approved", reject: "draft", cancel: "cancelled" }, approved: { schedule: "scheduled", publish: "publishing", manual: "manual-package", cancel: "cancelled" }, scheduled: { publish: "publishing", pause: "approved", cancel: "cancelled" }, publishing: { success: "published", fail: "failed" }, failed: { retry: "retry-scheduled", cancel: "cancelled" }, "retry-scheduled": { publish: "publishing", pause: "failed", cancel: "cancelled" } };
    if (current === "approved" && action === "manual") return "manual-package";
    return transitions[current]?.[action] || "";
  }

  function cropSize(ratio = "4:5", maxWidth = 1200) {
    const match = String(ratio).match(/^(1|4|9|16):(1|4|5|9|16)$/);
    if (!match) throw new Error("Tỷ lệ ảnh không hợp lệ.");
    const x = Number(match[1]); const y = Number(match[2]); const width = Math.max(320, Math.min(4096, Number(maxWidth) || 1200));
    return { width, height: Math.round(width * y / x), ratio: `${x}:${y}` };
  }

  function createOAuthState(byteLength = 32) {
    const bytes = new Uint8Array(Math.max(24, Math.min(64, Number(byteLength) || 32)));
    root.crypto.getRandomValues(bytes);
    return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function idempotencyKey(input = {}) {
    return [input.ownerId, input.workspaceId, input.projectId, input.accountId || "manual", input.provider || "manual", input.scheduledAt || "now"].map((part) => safeId(part, "none")).join(":");
  }

  async function sha256(value) {
    const bytes = value instanceof ArrayBuffer ? value : ArrayBuffer.isView(value) ? value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) : new TextEncoder().encode(String(value)); const digest = await root.crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function detectMime(file) {
    const bytes = new Uint8Array(await file.slice(0, 512).arrayBuffer()); const starts = (...values) => values.every((value, index) => bytes[index] === value);
    const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/^\uFEFF/, "").trimStart();
    let mime = "";
    if (starts(0xff, 0xd8, 0xff)) mime = "image/jpeg";
    else if (starts(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a)) mime = "image/png";
    else if (String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP") mime = "image/webp";
    else if (String.fromCharCode(...bytes.slice(0,4)) === "GIF8") mime = "image/gif";
    else if (String.fromCharCode(...bytes.slice(4,8)) === "ftyp") mime = "video/mp4";
    else if (starts(0x1a,0x45,0xdf,0xa3)) mime = "video/webm";
    else if (/^(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(head)) mime = "image/svg+xml";
    else if (/^[\[{]/.test(head)) { try { JSON.parse(await file.text()); mime = "application/json"; } catch {} }
    else if (!bytes.includes(0)) mime = file.type === "text/csv" || /(?:^|\n)[^\n,]+,[^\n,]+/.test(head) ? "text/csv" : "text/plain";
    const declared = file.type || ""; const aliases = { "text/plain": ["text/plain", ""], "text/csv": ["text/csv", "application/vnd.ms-excel", "text/plain", ""], "application/json": ["application/json", "text/json", "text/plain", ""] };
    return { detected: mime, declared, allowed: Boolean(mime && ((aliases[mime] || [mime, ""]).includes(declared))), size: file.size };
  }

  const TOOL_CATALOG = Object.freeze([
    ["instagram-filter","Instagram","Bộ lọc ảnh","local"],["instagram-post","Instagram","Bài đăng & carousel","local"],["instagram-story","Instagram","Story 1080×1920","local"],["instagram-dm","Instagram","Mẫu DM có watermark","local"],["instagram-owned-media","Instagram","Media tài khoản đã kết nối","provider"],
    ["x-composer","X / Threads","Tweet & thread composer","local"],["tweet-card","X / Threads","Tweet thành hình","local"],["x-revenue","X / Threads","Ước tính doanh thu","local"],["threads-composer","X / Threads","Threads composer","local"],
    ["whatsapp-mockup","Tin nhắn","WhatsApp Message Studio","local"],["imessage-mockup","Tin nhắn","iMessage Mockup Studio","local"],
    ["youtube-thumbnail","Video","Thumbnail YouTube qua oEmbed","api"],["vimeo-thumbnail","Video","Thumbnail Vimeo qua oEmbed","api"],["open-graph","Công cụ chung","Open Graph & JSON-LD","local"],
    ["facebook-composer","Facebook","Post & Reels composer","manual"],["tiktok-kit","TikTok","Caption, Cover & Safe-Zone","manual"],["linkedin-composer","Mạng nghề nghiệp","LinkedIn Post & Article","local"],["pinterest-pin","Mạng hình ảnh","Pinterest Pin","local"],["reddit-formatter","Cộng đồng","Reddit Formatter","local"],["telegram-composer","Tin nhắn","Telegram Composer","local"],["discord-announcement","Cộng đồng","Discord Announcement","local"],["mastodon-bluesky","Mạng mở","Mastodon & Bluesky","local"],["snapchat-story","Story","Social Story Designer","local"],["bio-link","Công cụ chung","Social Bio Link","local"],["qr-campaign","Công cụ chung","QR Campaign","reuse"],["profile-picture","Thiết kế","Profile Picture","local"],["cover-generator","Thiết kế","Banner & Cover","local"],["meme-studio","Thiết kế","Meme Studio","local"],["quote-card","Thiết kế","Quote Card","local"],["product-kit","Thương mại","Product Social Kit","local"],["hashtag-workspace","Nội dung","Hashtag Workspace","local"],["utm-builder","Công cụ chung","UTM Campaign Builder","local"],["caption-formatter","Nội dung","Caption Formatter","local"],["emoji-picker","Nội dung","Emoji & Symbol Picker","local"],["subtitle-studio","Video","Subtitle Studio","reuse"],["video-resizer","Video","Social Video Resizer","reuse"],["brand-kit","Thiết kế","Watermark & Brand Kit","local"],["repurpose","AI","Content Repurposing","ai"],["calendar","Vận hành","Social Calendar","api"],["approval","Vận hành","Approval Workflow","api"],["publishing-queue","Vận hành","Unified Publishing Queue","api"],["analytics","Vận hành","Unified Analytics thật","provider"],["community-inbox","Vận hành","Comment & Inbox","provider"],["competitor-research","Nghiên cứu","Competitor Research qua API","provider"],["social-listening","Nghiên cứu","Social Listening","provider"],["export-kit","Xuất","Social Media Kit ZIP","local"],
    ["social-character-counter","Văn bản","Đếm ký tự đa nền tảng","local"],["case-converter","Văn bản","Đổi kiểu chữ","local"],["whitespace-cleaner","Văn bản","Làm sạch khoảng trắng","local"],["unicode-font-styler","Văn bản","Kiểu chữ bio Unicode","local"],["hashtag-cleaner","Nội dung","Làm sạch hashtag","local"],
    ["username-link-builder","Liên kết","Tạo link hồ sơ","local"],["whatsapp-link","Liên kết","Tạo link WhatsApp","local"],["telegram-link","Liên kết","Tạo link chia sẻ Telegram","local"],["social-share-link","Liên kết","Tạo link chia sẻ mạng xã hội","local"],
    ["youtube-embed","Video","Mã nhúng YouTube riêng tư","local"],["youtube-timestamp","Video","Link YouTube theo thời gian","local"],["social-dimensions","Thiết kế","Kích thước ảnh mạng xã hội","local"],["color-palette","Thiết kế","Trích bảng màu từ ảnh","local"],["link-preview-audit","Công cụ chung","Kiểm tra Link Preview","local"],["alt-text-checker","Nội dung","Kiểm tra Alt Text","local"],
    ["content-strategy-brief","Chiến lược","Communication Strategy Brief","local"],["audience-persona","Chiến lược","Audience Persona Builder","local"],["content-pillar-planner","Chiến lược","Content Pillar Planner","local"],["campaign-objective","Chiến lược","Campaign Objective & KPI","local"],["channel-mix-planner","Chiến lược","Channel Mix Planner","local"],["editorial-angle-lab","Chiến lược","Editorial Angle Lab","local"],
    ["hook-library","Copywriting","Hook Library Generator","local"],["headline-analyzer","Copywriting","Headline Analyzer","local"],["cta-optimizer","Copywriting","CTA Optimizer","local"],["ad-copy-variants","Quảng cáo","Ad Copy Variants","local"],["ab-test-planner","Quảng cáo","A/B Test Planner","local"],
    ["pr-release-builder","PR & Báo chí","Press Release Builder","local"],["media-pitch-builder","PR & Báo chí","Media Pitch Builder","local"],["press-kit-checklist","PR & Báo chí","Press Kit Checklist","local"],
    ["crisis-response-builder","An toàn thương hiệu","Crisis Response Builder","local"],["holding-statement","An toàn thương hiệu","Holding Statement","local"],["brand-safety-audit","An toàn thương hiệu","Brand Safety Audit","local"],["claim-compliance-checker","An toàn thương hiệu","Claim & Compliance Checker","local"],["tone-of-voice-audit","Thương hiệu","Tone of Voice Audit","local"],
    ["moderation-policy","Cộng đồng","Moderation Policy Builder","local"],["response-template-library","Cộng đồng","Response Template Library","local"],["sentiment-triage","Cộng đồng","Sentiment & Priority Triage","local"],
    ["kpi-planner","Đo lường","KPI Measurement Planner","local"],["roi-calculator","Đo lường","Campaign ROI Calculator","local"]
  ].map(([id, group, name, mode]) => Object.freeze({ id, group, name, mode })));

  function defaultProject(context = {}) { const ownerId = ownerIdFor(context.currentUser); const workspaceId = safeId(context.workspaceId || "personal", "personal"); return { schemaVersion: SCHEMA_VERSION, ownerId, workspaceId, id: safeId(context.id || "draft-1"), toolId: "instagram-post", platform: "instagram", title: "Chiến dịch mới", caption: "", altText: "", location: "", theme: "dark", ratio: "4:5", exposure: 100, contrast: 100, saturation: 100, temperature: 0, blur: 0, sourceUrl: "", canonicalUrl: "https://hoang8.com/", imageUrl: "https://hoang8.com/assets/hh-neon-logo-v2.png", siteName: "HH Platform", utmSource: "social", utmMedium: "organic", utmCampaign: "chien-dich-moi", socialProvider: "instagram", shareProvider: "whatsapp", phone: "", startSeconds: 0, textMode: "sentence", textStyle: "bold", blockedHashtags: "", brandVoice: "", aiAction:"repurpose", accountId: "", scheduledAt: "", timezone: Intl.DateTimeFormat?.().resolvedOptions?.().timeZone || "Asia/Bangkok", autoplay: false, impressions: 0, eligibleRate: .5, rpm: 1, uncertainty: .35, objective:"", audience:"", offer:"", evidence:"", tone:"Tin cậy, rõ ràng", channels:"Facebook, TikTok, YouTube", constraints:"", riskKeywords:"", hypothesis:"", primaryMetric:"", baseline:0, targetValue:0, budget:0, revenue:0, variantCount:3, urgency:"medium", stakeholder:"", deadline:"", assets: [], history: [], future: [], presets: [], resultHistory: [], updatedAt: new Date().toISOString() }; }
  function storageKey(ownerId, workspaceId, projectId) { return `${STORAGE_PREFIX}:${safeId(ownerId)}:${safeId(workspaceId)}:${safeId(projectId)}`; }
  function createStore(options = {}) { const storage = options.storage || root.localStorage; let state = defaultProject(options); const key = () => storageKey(state.ownerId, state.workspaceId, state.id); try { const found = JSON.parse(storage?.getItem?.(key()) || "null"); if (found?.ownerId === state.ownerId && found?.workspaceId === state.workspaceId) state = { ...state, ...found, assets:(found.assets||[]).map(({url,...asset})=>asset) }; } catch {} const save = () => { state.updatedAt = new Date().toISOString(); const persisted={...state,assets:(state.assets||[]).map(({url,...asset})=>asset)}; storage?.setItem?.(key(), JSON.stringify(persisted)); return JSON.parse(JSON.stringify(state)); }; return Object.freeze({ get: () => JSON.parse(JSON.stringify(state)), update(mutator) { const previous = JSON.parse(JSON.stringify(state)); const next = mutator(JSON.parse(JSON.stringify(state))) || state; state = { ...state, ...next, ownerId: previous.ownerId, workspaceId: previous.workspaceId, history: [...(previous.history || []).slice(-19), { at: new Date().toISOString(), snapshot: { title: previous.title, caption: previous.caption, toolId: previous.toolId } }] }; return save(); }, replace(next) { if (next.ownerId !== state.ownerId || next.workspaceId !== state.workspaceId) throw new Error("Dự án không thuộc workspace hiện tại."); state = { ...state, ...next }; return save(); } }); }

  const api = Object.freeze({ SCHEMA_VERSION, STORAGE_PREFIX, ROLES, JOB_STATES, PLATFORM_LIMITS, SOCIAL_DIMENSIONS, TOOL_CATALOG, clean, safeId, ownerIdFor, slug, filename, normalizeUrl, captionStats, textMetrics, transformText, normalizeSocialText, cleanHashtags, profileUrl, buildShareUrl, buildYouTubeEmbed, formatCaption, splitThread, buildUtm, buildOpenGraph, estimateXRevenue, parseVideoRef, roleCan, nextJobState, cropSize, createOAuthState, idempotencyKey, sha256, detectMime, defaultProject, storageKey, createStore });
  root.HHSocialMediaCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
