(function tiktokCreatorCore(global) {
  "use strict";

  const VERSION = 1;
  const STORAGE_PREFIX = "hh.tiktok-creator-galaxy.v1";
  const STATUS = Object.freeze({
    local: { label: "Dùng ngay · xử lý cục bộ", tone: "ready" },
    connection: { label: "Cần kết nối TikTok", tone: "connect" },
    consent: { label: "Cần người dùng cấp quyền", tone: "consent" },
    audit: { label: "Cần TikTok duyệt scope", tone: "review" },
    private: { label: "Chỉ đăng riêng tư khi chưa audit", tone: "review" },
    business: { label: "Cần TikTok for Business", tone: "locked" },
    shop: { label: "Cần TikTok Shop Partner", tone: "locked" },
    unsupported: { label: "Chưa được API chính thức hỗ trợ", tone: "muted" }
  });

  const HUBS = Object.freeze([
    { id: "discover", label: "Khám phá", icon: "⌁", color: "#32e4d4" },
    { id: "create", label: "Sáng tạo", icon: "✦", color: "#ff5b88" },
    { id: "publish", label: "Xuất bản", icon: "↗", color: "#8d7bff" },
    { id: "engage", label: "Tương tác", icon: "◎", color: "#ffae4d" },
    { id: "commerce", label: "Kinh doanh", icon: "◇", color: "#7be66d" },
    { id: "platform", label: "Nền tảng", icon: "⚙", color: "#58a9ff" }
  ]);

  const WORKSPACES = Object.freeze([
    { id: "trends", no: 1, hub: "discover", icon: "↗", title: "Trend Research", status: "local", description: "Nhập snapshot hợp lệ, đo tốc độ tăng và độ bão hòa; không quét Creative Center.", official: "https://ads.tiktok.com/business/creativecenter/" },
    { id: "seo", no: 2, hub: "discover", icon: "⌕", title: "TikTok SEO", status: "local", description: "Nhóm keyword, search intent, content gap và brief bằng bộ máy cục bộ có giải thích." },
    { id: "analytics", no: 3, hub: "discover", icon: "▥", title: "Account Analytics", status: "connection", description: "Chỉ đọc hồ sơ, video và chỉ số của tài khoản đã tự nguyện kết nối." },
    { id: "competitors", no: 4, hub: "discover", icon: "◉", title: "Competitor Analyzer", status: "local", description: "So sánh snapshot CSV/JSON do người dùng cung cấp; không tự quét tài khoản đối thủ." },
    { id: "video", no: 5, hub: "create", icon: "▶", title: "Video Creator", status: "local", description: "Kiểm tra media 9:16 và chuyển dự án sang trình biên tập video hiện có." },
    { id: "ai-video", no: 6, hub: "create", icon: "✧", title: "AI Video", status: "local", description: "Mở AI Video Remake để tạo storyboard, cảnh và bản render có nhãn AI." },
    { id: "script", no: 7, hub: "create", icon: "✎", title: "AI Script", status: "local", description: "Tạo hook, kịch bản, shot list, caption và CTA bằng fallback cục bộ xác định." },
    { id: "voice", no: 8, hub: "create", icon: "◖", title: "Voice / Subtitle", status: "local", description: "Đọc, chỉnh và chuyển SRT/VTT; mở Hikari TTS cho giọng Việt khi cần." },
    { id: "scheduler", no: 9, hub: "publish", icon: "◷", title: "Scheduler & Publisher", status: "audit", description: "Lịch nội bộ và Content Posting có preview, quyền riêng tư và xác nhận rõ ràng." },
    { id: "community", no: 10, hub: "engage", icon: "◌", title: "Community", status: "unsupported", description: "Quản lý dữ liệu nhập và saved reply; Display API không cấp comment hoặc inbox." },
    { id: "shop", no: 11, hub: "commerce", icon: "▱", title: "TikTok Shop", status: "shop", description: "Kho sản phẩm, đơn hàng và tồn kho chỉ bật khi có TikTok Shop Partner." , official: "https://seller-vn.tiktok.com/" },
    { id: "affiliate", no: 12, hub: "commerce", icon: "%", title: "Affiliate Tools", status: "shop", description: "Theo dõi shortlist và hoa hồng từ CSV hoặc Partner API được cấp quyền.", official: "https://seller-vn.tiktok.com/affiliate" },
    { id: "products", no: 13, hub: "commerce", icon: "◆", title: "Product Research", status: "local", description: "Phân tích dữ liệu shop do người dùng nhập; không giả là doanh số toàn TikTok." },
    { id: "live", no: 14, hub: "engage", icon: "●", title: "LIVE Tools", status: "local", description: "Run-of-show, cue, checklist OBS và moderation list; không tự lấy stream key.", official: "https://www.tiktok.com/studio/download" },
    { id: "ads", no: 15, hub: "commerce", icon: "◈", title: "Ads Tools", status: "business", description: "Nhập báo cáo hoặc mở Ads Manager; API chỉ bật sau khi TikTok for Business duyệt.", official: "https://ads.tiktok.com/i18n/login" },
    { id: "influencers", no: 16, hub: "discover", icon: "☆", title: "Influencer Tools", status: "local", description: "Creator CRM cục bộ từ dữ liệu được phép; TikTok One cần quyền riêng.", official: "https://creatormarketplace.tiktok.com/" },
    { id: "developer", no: 17, hub: "platform", icon: "</>", title: "Developer / API", status: "connection", description: "OAuth, scope, token expiry đã rút gọn, audit readiness và API health.", official: "https://developers.tiktok.com/apps/" },
    { id: "media", no: 18, hub: "platform", icon: "▧", title: "Media Utilities", status: "local", description: "Metadata, checksum SHA-256, tỉ lệ khung hình và chuyển subtitle cục bộ." }
  ]);

  const OFFICIAL_LINKS = Object.freeze({
    studio: "https://www.tiktok.com/tiktokstudio",
    creativeCenter: "https://ads.tiktok.com/business/creativecenter/",
    developer: "https://developers.tiktok.com/apps/",
    posting: "https://developers.tiktok.com/products/content-posting-api",
    business: "https://business-api.tiktok.com/portal",
    shop: "https://partner.tiktokshop.com/"
  });

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  const cleanId = (value) => String(value || "guest").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "guest";
  function readJson(key, fallback) { try { return JSON.parse(global.localStorage?.getItem(key) || "null") ?? fallback; } catch { return fallback; } }
  function currentOwnerId() {
    const runtime = global.HHAuthz?.currentUser?.();
    const stored = readJson("hh-auth-user", {});
    const user = runtime || stored || {};
    return cleanId(user._id || user.id || user.userId || user.email || "guest");
  }
  function storageKey(ownerId = currentOwnerId()) { return `${STORAGE_PREFIX}:${cleanId(ownerId)}`; }
  function defaultState(ownerId = currentOwnerId()) {
    return { ownerId, hub: "discover", workspace: "trends", connectionId: "", datasets: {}, scripts: [], subtitle: null, media: null, livePlan: null, compactInspector: false, updatedAt: new Date().toISOString() };
  }
  function loadState() {
    const ownerId = currentOwnerId();
    const saved = readJson(storageKey(ownerId), null);
    if (!saved || saved.ownerId !== ownerId) return defaultState(ownerId);
    return { ...defaultState(ownerId), ...saved, ownerId, datasets: saved.datasets && typeof saved.datasets === "object" ? saved.datasets : {}, scripts: Array.isArray(saved.scripts) ? saved.scripts.slice(-20) : [] };
  }
  function saveState(state) {
    const ownerId = currentOwnerId();
    const safe = { ...state, ownerId, updatedAt: new Date().toISOString() };
    try { global.localStorage?.setItem(storageKey(ownerId), JSON.stringify(safe)); } catch {}
    return safe;
  }

  function parseDelimited(text, delimiter) {
    const rows = []; let row = []; let field = ""; let quoted = false;
    const source = String(text || "").replace(/^\uFEFF/, "");
    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (character === '"') {
        if (quoted && source[index + 1] === '"') { field += '"'; index += 1; }
        else quoted = !quoted;
      } else if (character === delimiter && !quoted) { row.push(field.trim()); field = ""; }
      else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && source[index + 1] === "\n") index += 1;
        row.push(field.trim()); field = "";
        if (row.some((cell) => cell !== "")) rows.push(row);
        row = [];
      } else field += character;
    }
    if (quoted) throw new Error("CSV có dấu ngoặc kép chưa đóng.");
    row.push(field.trim()); if (row.some((cell) => cell !== "")) rows.push(row);
    if (!rows.length) return [];
    const seen = new Map();
    const header = rows[0].map((cell, index) => { const base = cleanId(cell || `column-${index + 1}`); const count = (seen.get(base) || 0) + 1; seen.set(base, count); return count === 1 ? base : `${base}-${count}`; });
    return sanitizeRows(rows.slice(1).map((cells) => Object.fromEntries(header.map((key, index) => [key, cells[index] ?? ""]))));
  }
  function sanitizeRows(rows, maxRows = 1000, maxTotalChars = 1500000) {
    const output = []; let total = 0;
    for (const row of (Array.isArray(rows) ? rows : []).slice(0, maxRows)) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const safe = {};
      for (const [rawKey, rawValue] of Object.entries(row).slice(0, 50)) {
        const key = cleanId(rawKey); let value;
        try { value = rawValue && typeof rawValue === "object" ? JSON.stringify(rawValue) : String(rawValue ?? ""); } catch { value = "[Không thể đọc]"; }
        value = value.slice(0, 2000); if (total + key.length + value.length > maxTotalChars) break;
        safe[key] = value; total += key.length + value.length;
      }
      if (Object.keys(safe).length) output.push(safe);
      if (total >= maxTotalChars) break;
    }
    return output;
  }
  function parseImport(text, filename = "") {
    if (/\.json$/i.test(filename) || /^[\s\r\n]*[\[{]/.test(String(text))) {
      const parsed = JSON.parse(text);
      const rows = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.rows) ? parsed.rows : Array.isArray(parsed.items) ? parsed.items : []);
      if (!rows.length) throw new Error("JSON phải là mảng hoặc có trường rows/items.");
      return sanitizeRows(rows);
    }
    const firstLine = String(text).split(/\r?\n/, 1)[0] || "";
    return parseDelimited(text, (firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length ? "\t" : ",");
  }

  function parseTimestamp(value) {
    const match = String(value || "").trim().replace(",", ".").match(/(?:(\d+):)?(\d{1,2}):(\d{2}(?:\.\d{1,3})?)/);
    return match ? Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) : 0;
  }
  function timestamp(seconds, separator = ",") {
    const safe = Math.max(0, Number(seconds) || 0); const hours = Math.floor(safe / 3600); const minutes = Math.floor((safe % 3600) / 60); const secs = Math.floor(safe % 60); const ms = Math.round((safe % 1) * 1000);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}${separator}${String(ms).padStart(3, "0")}`;
  }
  function parseSubtitles(text) {
    const normalized = String(text || "").replace(/^WEBVTT[^\n]*\n+/i, "").replace(/\r/g, "").trim();
    if (!normalized) return [];
    return normalized.split(/\n{2,}/).map((block, blockIndex) => {
      const lines = block.split("\n").filter(Boolean); const timeIndex = lines.findIndex((line) => line.includes("-->"));
      if (timeIndex < 0) return null;
      const [start, endRaw] = lines[timeIndex].split("-->"); const end = String(endRaw || "").trim().split(/\s+/)[0];
      return { id: blockIndex + 1, start: parseTimestamp(start), end: parseTimestamp(end), text: lines.slice(timeIndex + 1).join("\n").trim() };
    }).filter((item) => item && item.end >= item.start && item.text);
  }
  function subtitlesToSrt(cues) { return (cues || []).map((cue, index) => `${index + 1}\n${timestamp(cue.start)} --> ${timestamp(cue.end)}\n${cue.text}`).join("\n\n"); }
  function subtitlesToVtt(cues) { return `WEBVTT\n\n${(cues || []).map((cue) => `${timestamp(cue.start, ".")} --> ${timestamp(cue.end, ".")}\n${cue.text}`).join("\n\n")}`; }

  function tokenize(value) { return [...new Set(String(value || "").toLocaleLowerCase("vi").normalize("NFC").split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1))]; }
  function buildSeoBrief(keyword, audience = "người xem Việt Nam") {
    const words = tokenize(keyword); const main = words.slice(0, 4).join(" ") || "nội dung hữu ích";
    const longTail = [`${main} cho người mới`, `cách ${main} nhanh`, `${main} thực tế`, `sai lầm khi ${main}`, `${main} trong 30 giây`];
    return {
      keyword: main, intent: /mua|giá|review|đánh giá|shop|sản phẩm/i.test(keyword) ? "Thương mại" : /cách|hướng dẫn|làm sao/i.test(keyword) ? "Học và thực hành" : "Khám phá",
      audience, longTail,
      hooks: [`Đừng bắt đầu ${main} trước khi biết điều này`, `3 điều về ${main} mà đa số bỏ qua`, `Tôi thử ${main} để bạn không phải mất thời gian`],
      caption: `${main}: hướng dẫn ngắn, rõ và có ví dụ dành cho ${audience}.`,
      hashtags: words.slice(0, 5).map((word) => `#${word.replace(/\s/g, "")}`),
      note: "Gợi ý cục bộ dựa trên từ khóa nhập, không phải dữ liệu tìm kiếm trực tiếp từ TikTok."
    };
  }
  function buildScript(input = {}) {
    const topic = String(input.topic || "một mẹo hữu ích").trim(); const seconds = [15, 30, 60, 180].includes(Number(input.duration)) ? Number(input.duration) : 30; const tone = String(input.tone || "tự nhiên"); const audience = String(input.audience || "người xem Việt Nam");
    const beats = seconds <= 15 ? 3 : seconds <= 30 ? 4 : seconds <= 60 ? 6 : 8;
    const steps = Array.from({ length: beats }, (_, index) => index === 0 ? `0–${Math.max(2, Math.round(seconds / beats))}s · Hook: “Bạn đang gặp khó với ${topic}?”` : index === beats - 1 ? `${Math.round(seconds * index / beats)}–${seconds}s · CTA: Lưu lại và thử ngay hôm nay.` : `${Math.round(seconds * index / beats)}–${Math.round(seconds * (index + 1) / beats)}s · Cảnh ${index + 1}: minh họa một bước cụ thể về ${topic}.`);
    return { id: `script-${Date.now()}`, topic, duration: seconds, tone, audience, hook: `Nếu chỉ có ${seconds} giây để hiểu ${topic}, hãy bắt đầu từ đây.`, voiceover: `Bạn muốn ${topic} nhưng chưa biết bắt đầu ở đâu? Đây là cách ngắn gọn dành cho ${audience}. Tập trung vào một bước nhỏ, cho thấy kết quả thật và kết thúc bằng hành động rõ ràng.`, caption: `${topic} — phiên bản ${tone}, ngắn gọn và có thể áp dụng ngay.`, cta: "Lưu video để thực hành và chia sẻ trải nghiệm của bạn.", shots: steps, aigc: true, source: "local-deterministic" };
  }
  function formatBytes(value) { const bytes = Number(value || 0); if (!bytes) return "0 B"; const unit = Math.min(3, Math.floor(Math.log(bytes) / Math.log(1024))); return `${(bytes / (1024 ** unit)).toFixed(unit ? 1 : 0)} ${["B", "KB", "MB", "GB"][unit]}`; }
  function toCsv(rows) {
    const items = Array.isArray(rows) ? rows.filter((row) => row && typeof row === "object") : [];
    if (!items.length) return "";
    const headers = [...new Set(items.flatMap((row) => Object.keys(row)))];
    const quote = (value) => { const raw = String(value ?? ""); const safe = /^\s*[=+\-@]/.test(raw) ? `'${raw}` : raw; return `"${safe.replace(/"/g, '""')}"`; };
    return `\uFEFF${headers.map(quote).join(",")}\r\n${items.map((row) => headers.map((key) => quote(row[key])).join(",")).join("\r\n")}`;
  }
  function download(name, content, type = "text/plain;charset=utf-8") { const blob = content instanceof Blob ? content : new Blob([content], { type }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

  global.HHTikTokCreatorCore = Object.freeze({ VERSION, STORAGE_PREFIX, STATUS, HUBS, WORKSPACES, OFFICIAL_LINKS, escapeHtml, cleanId, currentOwnerId, storageKey, defaultState, loadState, saveState, parseDelimited, sanitizeRows, parseImport, parseSubtitles, subtitlesToSrt, subtitlesToVtt, tokenize, buildSeoBrief, buildScript, formatBytes, toCsv, download });
})(window);
