(function initSocialLocalEngines(root) {
  "use strict";

  const ENGINE_VERSION = 6;
  const Core = () => {
    if (!root.HHSocialMediaCore) throw new Error("HHSocialMediaCore chưa được nạp.");
    return root.HHSocialMediaCore;
  };
  const text = (value) => String(value ?? "");
  const chars = (value) => [...text(value)];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const normalizeKey = (value) => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLocaleLowerCase("vi");
  const escapeHtml = (value) => text(value).replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[char]);
  const truncate = (value, limit) => chars(value).length <= limit ? text(value) : `${chars(value).slice(0, Math.max(0, limit - 1)).join("")}…`;
  const nowIso = (helpers = {}) => {
    const value = typeof helpers.now === "function" ? helpers.now() : helpers.now;
    return value ? new Date(value).toISOString() : new Date().toISOString();
  };
  const byteLength = (value) => typeof TextEncoder !== "undefined" ? new TextEncoder().encode(text(value)).length : unescape(encodeURIComponent(text(value))).length;
  const toCsv = (rows) => rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const makeIssue = (field, code, message, severity = "error", meta = {}) => ({ field, code, message, severity, ...meta });
  const validation = (errors = [], warnings = [], normalized = {}) => Object.freeze({ valid: errors.length === 0, errors, warnings, normalized });
  const assertValid = (result) => {
    if (result.valid) return result;
    const error = new Error(result.errors.map((item) => item.message).join(" ") || "Dữ liệu đầu vào không hợp lệ.");
    error.name = "SocialToolValidationError";
    error.validation = result;
    throw error;
  };
  const safeJson = (value) => JSON.stringify(value, null, 2).replace(/<\//g, "<\\/");
  function makeExports(baseName, payload, options = {}) {
    const name = Core().slug(baseName || "social-result");
    const entries = {
      json: { filename:`${name}.json`, mime:"application/json", data:safeJson(payload) }
    };
    if (options.txt !== undefined) entries.txt = { filename:`${name}.txt`, mime:"text/plain;charset=utf-8", data:text(options.txt) };
    if (options.csv !== undefined) entries.csv = { filename:`${name}.csv`, mime:"text/csv;charset=utf-8", data:text(options.csv) };
    if (options.html !== undefined) entries.html = { filename:`${name}.html`, mime:"text/html;charset=utf-8", data:text(options.html) };
    return Object.freeze(entries);
  }
  function httpsUrl(value) {
    try {
      const url = new URL(text(value).trim());
      return url.protocol === "https:" && !url.username && !url.password ? url : null;
    } catch { return null; }
  }
  function colorString(r, g, b) {
    const values = [r, g, b].map((value) => Math.round(clamp(value, 0, 255)));
    return { hex:`#${values.map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`, rgb:`rgb(${values.join(", ")})`, hsl:rgbToHsl(...values) };
  }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min, lightness = (max + min) / 2;
    let hue = 0, saturation = 0;
    if (delta) {
      saturation = delta / (1 - Math.abs(2 * lightness - 1));
      if (max === r) hue = 60 * (((g - b) / delta) % 6);
      else if (max === g) hue = 60 * ((b - r) / delta + 2);
      else hue = 60 * ((r - g) / delta + 4);
    }
    return `hsl(${Math.round((hue + 360) % 360)}, ${Math.round(saturation * 100)}%, ${Math.round(lightness * 100)}%)`;
  }

  function validateAltText(project = {}) {
    const original = text(project.altText);
    const errors = [], warnings = [];
    if (chars(original).length > 2000) errors.push(makeIssue("altText", "input-too-large", "Alt text vượt giới hạn xử lý 2.000 ký tự."));
    if (/\u0000/.test(original)) errors.push(makeIssue("altText", "null-byte", "Alt text chứa ký tự null không an toàn."));
    if (!original.trim()) warnings.push(makeIssue("altText", "empty", "Alt text đang trống.", "warning"));
    return validation(errors, warnings, { altText:Core().normalizeSocialText(original) });
  }
  function altText(project = {}, helpers = {}) {
    const checked = assertValid(validateAltText(project));
    const original = text(project.altText), value = checked.normalized.altText, length = chars(value).length;
    const issues = [], suggestions = [];
    if (!value) issues.push(makeIssue("altText", "empty", "Hãy mô tả nội dung hoặc mục đích chính của ảnh.", "error"));
    if (length > 0 && length < 20) issues.push(makeIssue("altText", "short", "Mô tả có thể quá ngắn để truyền tải nội dung chính.", "warning"));
    if (length > 200) issues.push(makeIssue("altText", "long", "Nên rút gọn khoảng 200 ký tự nếu không làm mất thông tin.", "warning", { excess:length - 200 }));
    if (/^(?:(?:ảnh|hình ảnh|photo|image|áº£nh|hÃ¬nh áº£nh)\s+(?:của|of|cá»§a))/iu.test(value)) issues.push(makeIssue("altText", "redundant-prefix", "Không cần mở đầu bằng “Ảnh của…” khi ngữ cảnh đã rõ.", "hint"));
    if (/\b(?:click|nhấp|bấm|nháº¥p|báº¥m)\s+(?:vào|here|đây|vÃ o|Ä‘Ã¢y)\b/iu.test(value)) issues.push(makeIssue("altText", "interaction", "Alt text nên mô tả ảnh, không hướng dẫn thao tác.", "warning"));
    if (/https?:\/\/|www\./iu.test(value)) issues.push(makeIssue("altText", "url", "Không nên đặt URL dài trong alt text.", "warning"));
    if (/\b[\w-]+\.(?:jpe?g|png|gif|webp|svg)\b/iu.test(value)) issues.push(makeIssue("altText", "filename", "Thay tên tệp bằng mô tả nội dung quan sát được.", "warning"));
    if (/(?:!|\?){3,}/u.test(value)) issues.push(makeIssue("altText", "punctuation", "Giảm dấu câu lặp để trình đọc màn hình đọc tự nhiên hơn.", "hint"));
    if ((value.match(/[\p{Extended_Pictographic}]/gu) || []).length > 2) issues.push(makeIssue("altText", "emoji-heavy", "Alt text có nhiều emoji và có thể bị đọc dài dòng.", "warning"));
    const letters = value.match(/\p{L}/gu) || [], upper = letters.filter((char) => char === char.toLocaleUpperCase("vi") && char !== char.toLocaleLowerCase("vi"));
    if (letters.length >= 12 && upper.length / letters.length > .75) issues.push(makeIssue("altText", "all-caps", "Tránh viết phần lớn alt text bằng chữ hoa.", "hint"));
    if (/\b(?:đẹp|hay|tuyệt vời|awesome|beautiful|áº‘n tÆ°á»£ng)\b/iu.test(value)) suggestions.push("Thay tính từ chủ quan bằng chi tiết có thể quan sát được.");
    if (!/[.!?…]$/u.test(value) && length > 80) suggestions.push("Có thể thêm dấu câu để trình đọc màn hình ngắt nghỉ tự nhiên.");
    const activeAsset = Array.isArray(project.assets) ? project.assets[Number(project.activeAsset) || 0] : null;
    const assetName = text(activeAsset?.name || activeAsset?.filename);
    const assetTokens = [...new Set(normalizeKey(assetName.replace(/\.[^.]+$/, "")).split(/[^a-z0-9]+/u).filter((token) => token.length >= 3 && !["img", "image", "photo", "anh", "file"].includes(token)))];
    const normalizedAlt = normalizeKey(value);
    const missingAssetTokens = assetTokens.filter((token) => !normalizedAlt.includes(token));
    const comparison = { assetId:activeAsset?.id || null, assetName:assetName || null, checked:Boolean(activeAsset), filenameHints:assetTokens, missingFilenameHints:missingAssetTokens, note:activeAsset ? "Tên tệp chỉ là gợi ý đối chiếu, không được xem là nội dung ảnh đã xác minh." : "Chưa có asset để đối chiếu." };
    if (activeAsset && missingAssetTokens.length) suggestions.push(`Đối chiếu ảnh để xác nhận có cần nhắc tới: ${missingAssetTokens.join(", ")}.`);
    const penalty = issues.reduce((sum, item) => sum + (item.severity === "error" ? 55 : item.severity === "warning" ? 14 : 5), 0);
    const score = clamp(100 - penalty, 0, 100);
    const historyEntry = { before:original, after:value, score, issueCodes:issues.map((item) => item.code), at:nowIso(helpers) };
    const history = [...(Array.isArray(project.altTextHistory) ? project.altTextHistory : []).slice(-19), historyEntry];
    const output = value || "Alt text đang trống.";
    const payload = { score, length, issues, suggestions, original, normalized:value, comparison, historyEntry };
    const csv = toCsv([["severity", "code", "message"], ...issues.map((item) => [item.severity, item.code, item.message])]);
    return { ...payload, output, validation:checked, apply:{ altText:value, altTextHistory:history }, csv, exports:makeExports("alt-text-audit", payload, { txt:output, csv }) };
  }

  const PLATFORM_POLICIES = Object.freeze([
    ["instagram", 2200, 30], ["facebook", 63206, 30], ["tiktok", 2200, 30], ["x", 280, 10], ["threads", 500, 10], ["linkedin", 3000, 10],
    ["pinterest", 500, 20], ["reddit", 40000, 10], ["telegram", 4096, 10], ["discord", 2000, 10], ["bluesky", 300, 8], ["mastodon", 500, 8]
  ].map(([id, limit, suggestedHashtagCeiling]) => Object.freeze({ id, limit, suggestedHashtagCeiling })));
  function validateCharacterCounter(project = {}) {
    const value = text(project.caption), errors = [], warnings = [];
    if (byteLength(value) > 500000) errors.push(makeIssue("caption", "input-too-large", "Nội dung vượt giới hạn phân tích 500 KB."));
    if (!value) warnings.push(makeIssue("caption", "empty", "Chưa có nội dung để đo.", "warning"));
    const provider = text(project.socialProvider || project.platform || "instagram").toLocaleLowerCase("en");
    if (!PLATFORM_POLICIES.some((item) => item.id === provider)) warnings.push(makeIssue("socialProvider", "unknown-provider", "Nền tảng chưa có chính sách riêng; sẽ dùng Instagram.", "warning"));
    return validation(errors, warnings, { caption:value, socialProvider:PLATFORM_POLICIES.some((item) => item.id === provider) ? provider : "instagram" });
  }
  function countGraphemes(value) {
    if (typeof Intl !== "undefined" && Intl.Segmenter) return [...new Intl.Segmenter("vi", { granularity:"grapheme" }).segment(value)].length;
    return chars(value).length;
  }
  function effectiveLength(value, platform) {
    if (platform !== "x") return chars(value).length;
    const urls = value.match(/https?:\/\/[^\s]+/gu) || [];
    return chars(value).length - urls.reduce((sum, url) => sum + chars(url).length, 0) + urls.length * 23;
  }
  function characterCounter(project = {}) {
    const checked = assertValid(validateCharacterCounter(project)), value = checked.normalized.caption;
    const base = Core().textMetrics(value, checked.normalized.socialProvider);
    const graphemes = countGraphemes(value), bytes = byteLength(value);
    const rows = PLATFORM_POLICIES.map((policy) => {
      const rawCharacters = chars(value).length, used = effectiveLength(value, policy.id), remaining = policy.limit - used;
      const stats = Core().captionStats(value, policy.id), percent = policy.limit ? Math.round(used / policy.limit * 1000) / 10 : 0;
      return { platform:policy.id, characters:used, rawCharacters, graphemes, limit:policy.limit, remaining, percent, valid:remaining >= 0, status:remaining < 0 ? "over" : percent >= 90 ? "near-limit" : "healthy", words:base.words, lines:base.lines, bytes, hashtags:stats.hashtags.length, mentions:stats.mentions.length, urls:stats.links.length, suggestedHashtagCeiling:policy.suggestedHashtagCeiling };
    });
    const selected = rows.find((row) => row.platform === checked.normalized.socialProvider) || rows[0];
    const recommendations = [];
    if (!selected.valid) recommendations.push(`Rút ít nhất ${Math.abs(selected.remaining)} ký tự hiệu dụng cho ${selected.platform}.`);
    if (selected.status === "near-limit") recommendations.push(`Nội dung đã dùng ${selected.percent}% giới hạn ${selected.platform}.`);
    if (selected.hashtags > selected.suggestedHashtagCeiling) recommendations.push(`Cân nhắc giảm hashtag xuống không quá ${selected.suggestedHashtagCeiling} cho bản nháp này.`);
    const csv = toCsv([["platform", "effective_characters", "raw_characters", "graphemes", "limit", "remaining", "percent", "valid", "words", "lines", "bytes", "hashtags", "mentions", "urls"], ...rows.map((row) => [row.platform, row.characters, row.rawCharacters, row.graphemes, row.limit, row.remaining, row.percent, row.valid, row.words, row.lines, row.bytes, row.hashtags, row.mentions, row.urls])]);
    const output = rows.map((row) => `${row.platform}: ${row.characters}/${row.limit} (${row.remaining} còn lại)`).join("\n");
    const payload = { selected, rows, summary:{ ...base, graphemes, bytes }, recommendations, countingModel:{ unicode:"code-point", display:"grapheme", xUrls:"23 ký tự hiệu dụng cho mỗi URL" } };
    return { ...payload, output, validation:checked, apply:{ socialProvider:selected.platform, lastTextAudit:{ at:null, platform:selected.platform, characters:selected.characters, limit:selected.limit, remaining:selected.remaining, valid:selected.valid } }, csv, exports:makeExports("character-counter", payload, { txt:output, csv }) };
  }

  const CASE_MODES = Object.freeze(["sentence", "upper", "lower", "title", "camel", "pascal", "kebab", "snake", "toggle"]);
  function validateCaseConverter(project = {}) {
    const value = text(project.caption), mode = text(project.textMode || "sentence");
    const errors = [], warnings = [];
    if (chars(value).length > 63206) errors.push(makeIssue("caption", "input-too-large", "Văn bản vượt giới hạn 63.206 ký tự."));
    if (!CASE_MODES.includes(mode)) errors.push(makeIssue("textMode", "unsupported-mode", `Kiểu chuyển đổi “${mode}” chưa được hỗ trợ.`));
    if (!value) warnings.push(makeIssue("caption", "empty", "Chưa có văn bản để chuyển đổi.", "warning"));
    return validation(errors, warnings, { caption:value, textMode:mode });
  }
  const wordParts = (value) => text(value).match(/[\p{L}\p{N}]+/gu) || [];
  const lowerVi = (value) => text(value).toLocaleLowerCase("vi");
  const upperFirst = (value) => { const list = chars(value); return list.length ? `${list[0].toLocaleUpperCase("vi")}${list.slice(1).join("")}` : ""; };
  function sentenceCase(value) {
    return lowerVi(value).replace(/(^|[.!?…]\s+|\n+)(\p{L})/gu, (match, prefix, letter) => `${prefix}${letter.toLocaleUpperCase("vi")}`);
  }
  function titleCase(value) {
    return text(value).replace(/[\p{L}\p{N}]+/gu, (word) => upperFirst(lowerVi(word)));
  }
  function kebabCase(value) {
    return normalizeKey(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function transformCase(value, mode) {
    if (mode === "upper") return text(value).toLocaleUpperCase("vi");
    if (mode === "lower") return lowerVi(value);
    if (mode === "sentence") return sentenceCase(value);
    if (mode === "title") return titleCase(value);
    if (mode === "toggle") return chars(value).map((char) => char === char.toLocaleUpperCase("vi") ? char.toLocaleLowerCase("vi") : char.toLocaleUpperCase("vi")).join("");
    const words = wordParts(value).map(lowerVi);
    if (mode === "camel") return words.map((word, index) => index ? upperFirst(word) : word).join("");
    if (mode === "pascal") return words.map(upperFirst).join("");
    if (mode === "snake") return words.join("_");
    if (mode === "kebab") return kebabCase(value);
    return text(value);
  }
  function caseConverter(project = {}) {
    const checked = assertValid(validateCaseConverter(project)), source = checked.normalized.caption, selected = checked.normalized.textMode;
    const variants = Object.fromEntries(CASE_MODES.map((mode) => [mode, transformCase(source, mode)]));
    const output = variants[selected], changed = chars(source).reduce((count, char, index) => count + (char !== chars(output)[index] ? 1 : 0), Math.max(0, chars(output).length - chars(source).length));
    const payload = { selected, source, output, variants, stats:{ before:chars(source).length, after:chars(output).length, changedPositions:changed }, locale:"vi" };
    const csv = toCsv([["mode", "result"], ...Object.entries(variants)]);
    return { ...payload, validation:checked, apply:{ caption:output, textMode:selected }, csv, exports:makeExports(`case-${selected}`, payload, { txt:output, csv }) };
  }

  const WHITESPACE_MODES = Object.freeze(["compact", "preserve-lines", "single-line"]);
  function validateWhitespace(project = {}) {
    const value = text(project.caption), mode = text(project.whitespaceMode || "compact"), errors = [], warnings = [];
    if (chars(value).length > 100000) errors.push(makeIssue("caption", "input-too-large", "Văn bản vượt giới hạn làm sạch 100.000 ký tự."));
    if (!WHITESPACE_MODES.includes(mode)) errors.push(makeIssue("whitespaceMode", "unsupported-mode", "Chế độ làm sạch khoảng trắng không hợp lệ."));
    if (!value) warnings.push(makeIssue("caption", "empty", "Chưa có văn bản để làm sạch.", "warning"));
    return validation(errors, warnings, { caption:value, whitespaceMode:mode });
  }
  function whitespace(project = {}) {
    const checked = assertValid(validateWhitespace(project)), before = checked.normalized.caption, mode = checked.normalized.whitespaceMode;
    const stats = {
      tabs:(before.match(/\t/g) || []).length,
      nonBreakingSpaces:(before.match(/\u00a0/g) || []).length,
      zeroWidth:(before.match(/[\u200b\u2060\ufeff]/g) || []).length,
      carriageReturns:(before.match(/\r/g) || []).length,
      trailingSpaces:(before.match(/[ \t]+(?=\r?$)/gm) || []).length,
      repeatedSpaces:(before.match(/ {2,}/g) || []).length,
      excessiveBlankRuns:(before.match(/\n{3,}/g) || []).length
    };
    let output = before.replace(/\r\n?/g, "\n").replace(/[\u200b\u2060\ufeff]/g, "").replace(/[\t\u00a0]+/g, " ").replace(/[ \t]+$/gm, "");
    if (mode === "single-line") output = output.replace(/\s+/gu, " ").trim();
    else {
      output = output.replace(/ {2,}/g, " ");
      if (mode === "compact") output = output.replace(/\n{3,}/g, "\n\n");
      output = output.trim();
    }
    const removed = chars(before).length - chars(output).length;
    const payload = { source:before, output, mode, removed, stats, changed:before !== output };
    const csv = toCsv([["metric", "count"], ...Object.entries(stats), ["characters_removed", removed]]);
    return { ...payload, validation:checked, apply:{ caption:output, whitespaceMode:mode }, csv, exports:makeExports("whitespace-cleaned", payload, { txt:output, csv }) };
  }

  const HASHTAG_LIMITS = Object.freeze({ instagram:30, facebook:30, tiktok:30, x:10, threads:10, linkedin:10, pinterest:20, reddit:10, telegram:10, discord:10, bluesky:8, mastodon:8 });
  function parseHashtagInput(value) {
    const source = text(value), onlyExplicit = source.includes("#") && !/[,;|]/u.test(source);
    return source.split(/[\s,;|]+/u).filter(Boolean).filter((token) => !onlyExplicit || token.startsWith("#"));
  }
  function normalizeHashtag(value) {
    return text(value).normalize("NFKC").replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "").slice(0, 100);
  }
  function validateHashtag(project = {}) {
    const source = text(project.caption), errors = [], warnings = [];
    if (chars(source).length > 10000) errors.push(makeIssue("caption", "input-too-large", "Danh sách hashtag vượt giới hạn 10.000 ký tự."));
    if (!parseHashtagInput(source).length) warnings.push(makeIssue("caption", "empty", "Chưa tìm thấy hashtag đầu vào.", "warning"));
    const provider = text(project.socialProvider || project.platform || "instagram").toLocaleLowerCase("en");
    const limit = clamp(project.hashtagLimit || HASHTAG_LIMITS[provider] || 30, 1, 100);
    return validation(errors, warnings, { caption:source, socialProvider:provider, limit });
  }
  function hashtag(project = {}) {
    const checked = assertValid(validateHashtag(project)), source = checked.normalized.caption, limit = checked.normalized.limit;
    const raw = parseHashtagInput(source);
    const blockedKeys = new Set(text(project.blockedHashtags).split(/[\s,;|]+/u).map(normalizeHashtag).filter(Boolean).map((item) => item.toLocaleLowerCase("vi")));
    const brandKeys = new Set(text(project.brandHashtags).split(/[\s,;|]+/u).map(normalizeHashtag).filter(Boolean).map((item) => item.toLocaleLowerCase("vi")));
    const seen = new Set(), records = [], allowed = [], duplicates = [], blocked = [], invalid = [], overflow = [];
    for (const token of raw) {
      const normalized = normalizeHashtag(token), key = normalized.toLocaleLowerCase("vi");
      if (!normalized) { invalid.push(token); records.push({ original:token, normalized:"", status:"invalid", group:"invalid", reason:"Không còn ký tự chữ, số hoặc dấu gạch dưới sau khi chuẩn hóa." }); continue; }
      if (seen.has(key)) { duplicates.push(normalized); records.push({ original:token, normalized, status:"duplicate", group:"duplicate", reason:"Trùng không phân biệt hoa thường." }); continue; }
      seen.add(key);
      if (blockedKeys.has(key)) { blocked.push(normalized); records.push({ original:token, normalized, status:"blocked", group:"blocked", reason:"Nằm trong danh sách chặn của người dùng." }); continue; }
      if (allowed.length >= limit) { overflow.push(normalized); records.push({ original:token, normalized, status:"overflow", group:"overflow", reason:`Vượt giới hạn ${limit} tag của bản nháp.` }); continue; }
      const group = brandKeys.has(key) || /(?:hh|hoang|brand|official)/iu.test(normalized) ? "brand" : chars(normalized).length <= 10 ? "topic" : "community";
      allowed.push(normalized); records.push({ original:token, normalized, status:"allowed", group, reason:"Hợp lệ" });
    }
    const groups = { brand:[], topic:[], community:[] };
    records.filter((item) => item.status === "allowed").forEach((item) => groups[item.group].push(`#${item.normalized}`));
    const output = allowed.map((item) => `#${item}`).join(" ");
    const csv = toCsv([["original", "hashtag", "group", "status", "reason"], ...records.map((item) => [item.original, item.normalized, item.group, item.status, item.reason])]);
    const payload = { source, output, items:[...new Set(records.filter((item) => item.status !== "invalid" && item.status !== "duplicate").map((item) => item.normalized))], allowed, blocked, duplicates, invalid, overflow, groups, records, removed:raw.length - allowed.length, limit, platform:checked.normalized.socialProvider };
    return { ...payload, validation:checked, apply:{ caption:output, blockedHashtags:text(project.blockedHashtags) }, csv, exports:makeExports("hashtag-lab", payload, { txt:output, csv }) };
  }
  function hashtagWorkspace(project = {}) { return hashtag(project); }
  function hashtagCleaner(project = {}) { return hashtag(project); }

  function validateUtm(project = {}) {
    const errors = [], warnings = [], url = httpsUrl(project.canonicalUrl);
    if (!url) errors.push(makeIssue("canonicalUrl", "invalid-https-url", "URL chiến dịch phải là HTTPS hợp lệ và không chứa thông tin đăng nhập."));
    for (const [field, label] of [["utmSource", "source"], ["utmMedium", "medium"], ["utmCampaign", "campaign"]]) if (!text(project[field]).trim()) errors.push(makeIssue(field, "required", `UTM cần ${label}.`));
    if (url && [...url.searchParams.keys()].some((key) => key.startsWith("utm_"))) warnings.push(makeIssue("canonicalUrl", "existing-utm", "URL đã có tham số UTM; giá trị mới sẽ ghi đè trường trùng.", "warning"));
    return validation(errors, warnings, { canonicalUrl:url?.href || "" });
  }
  function utmBuilder(project = {}) {
    const checked = assertValid(validateUtm(project));
    const output = Core().buildUtm({ url:checked.normalized.canonicalUrl, source:project.utmSource, medium:project.utmMedium, campaign:project.utmCampaign, term:project.utmTerm, content:project.utmContent });
    const url = new URL(output), params = Object.fromEntries([...url.searchParams].filter(([key]) => key.startsWith("utm_")));
    const payload = { output, baseUrl:`${url.origin}${url.pathname}`, params, hash:url.hash, safe:true, qrPayload:output, variants:{ full:output, withoutHash:`${url.origin}${url.pathname}${url.search}` } };
    const csv = toCsv([["parameter", "value"], ...Object.entries(params)]);
    return { ...payload, validation:checked, apply:{ canonicalUrl:output, utmSource:text(project.utmSource), utmMedium:text(project.utmMedium), utmCampaign:text(project.utmCampaign), utmTerm:text(project.utmTerm), utmContent:text(project.utmContent) }, csv, exports:makeExports("utm-campaign", payload, { txt:output, csv }) };
  }
  const PROFILE_PROVIDERS = Object.freeze(["instagram", "tiktok", "x", "threads", "youtube", "linkedin", "pinterest", "telegram", "facebook"]);
  function validateUsernameLink(project = {}) {
    const provider = text(project.socialProvider).toLocaleLowerCase("en"), handle = text(project.title).trim().replace(/^@/, ""), errors = [], warnings = [];
    if (!PROFILE_PROVIDERS.includes(provider)) errors.push(makeIssue("socialProvider", "unsupported-provider", "Nền tảng hồ sơ chưa được hỗ trợ."));
    if (!/^[a-zA-Z0-9._-]{1,100}$/.test(handle)) errors.push(makeIssue("title", "invalid-handle", "Username chỉ được chứa chữ Latin, số, dấu chấm, gạch dưới hoặc gạch ngang."));
    if (handle.includes("..")) warnings.push(makeIssue("title", "repeated-dot", "Một số nền tảng không chấp nhận hai dấu chấm liên tiếp.", "warning"));
    return validation(errors, warnings, { socialProvider:provider, handle });
  }
  function usernameLink(project = {}) {
    const checked = assertValid(validateUsernameLink(project)), output = Core().profileUrl(checked.normalized.socialProvider, checked.normalized.handle);
    const payload = { output, provider:checked.normalized.socialProvider, handle:checked.normalized.handle, protocol:"https:", host:new URL(output).host, safe:true, qrPayload:output };
    return { ...payload, validation:checked, apply:{ canonicalUrl:output, socialProvider:payload.provider, title:payload.handle }, exports:makeExports("profile-link", payload, { txt:output }) };
  }
  function validateWhatsapp(project = {}) {
    const digits = text(project.phone).replace(/\D/g, ""), errors = [], warnings = [];
    if (!/^\d{8,15}$/.test(digits) || digits.startsWith("0")) errors.push(makeIssue("phone", "invalid-e164", "Số WhatsApp cần 8–15 chữ số, gồm mã quốc gia và không bắt đầu bằng 0."));
    if (chars(project.caption).length > 4000) errors.push(makeIssue("caption", "message-too-long", "Tin nhắn WhatsApp vượt giới hạn công cụ 4.000 ký tự."));
    let target = "";
    if (text(project.canonicalUrl).trim()) { const url = httpsUrl(project.canonicalUrl); if (!url) errors.push(makeIssue("canonicalUrl", "invalid-https-url", "Liên kết kèm tin nhắn phải dùng HTTPS hợp lệ.")); else target = url.href; }
    if (!text(project.caption).trim() && !target) warnings.push(makeIssue("caption", "empty-message", "Link sẽ mở cuộc trò chuyện mà không điền sẵn tin nhắn.", "warning"));
    return validation(errors, warnings, { digits, target, caption:text(project.caption).trim() });
  }
  function whatsappLink(project = {}) {
    const checked = assertValid(validateWhatsapp(project));
    const message = [checked.normalized.caption, checked.normalized.target].filter(Boolean).join(" "), output = `https://wa.me/${checked.normalized.digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
    const payload = { output, provider:"whatsapp", phone:checked.normalized.digits, message, safe:true, qrPayload:output, protocol:"https:", host:"wa.me" };
    return { ...payload, validation:checked, apply:{ canonicalUrl:output, phone:checked.normalized.digits, shareProvider:"whatsapp" }, exports:makeExports("whatsapp-link", payload, { txt:output }) };
  }
  function validateTelegram(project = {}) {
    const errors = [], warnings = [], url = httpsUrl(project.canonicalUrl);
    if (!url) errors.push(makeIssue("canonicalUrl", "invalid-https-url", "Telegram Share cần URL HTTPS hợp lệ."));
    if (chars(project.caption).length > 4000) errors.push(makeIssue("caption", "message-too-long", "Nội dung chia sẻ vượt giới hạn công cụ 4.000 ký tự."));
    if (!text(project.caption).trim()) warnings.push(makeIssue("caption", "empty-message", "Bạn chưa thêm lời nhắn cho liên kết.", "warning"));
    return validation(errors, warnings, { canonicalUrl:url?.href || "", caption:text(project.caption).trim() });
  }
  function telegramLink(project = {}) {
    const checked = assertValid(validateTelegram(project));
    const output = `https://t.me/share/url?url=${encodeURIComponent(checked.normalized.canonicalUrl)}&text=${encodeURIComponent(checked.normalized.caption)}`;
    const payload = { output, provider:"telegram", target:checked.normalized.canonicalUrl, message:checked.normalized.caption, safe:true, qrPayload:output, protocol:"https:", host:"t.me" };
    return { ...payload, validation:checked, apply:{ shareProvider:"telegram" }, exports:makeExports("telegram-share", payload, { txt:output }) };
  }
  const SHARE_PROVIDERS = Object.freeze(["facebook", "x", "linkedin", "reddit", "email"]);
  function validateSocialShare(project = {}) {
    const provider = text(project.shareProvider).toLocaleLowerCase("en"), errors = [], warnings = [], url = httpsUrl(project.canonicalUrl);
    if (!SHARE_PROVIDERS.includes(provider)) errors.push(makeIssue("shareProvider", "unsupported-provider", "Nền tảng chia sẻ chưa được hỗ trợ."));
    if (!url) errors.push(makeIssue("canonicalUrl", "invalid-https-url", "URL chia sẻ phải dùng HTTPS hợp lệ."));
    if (chars(project.caption).length > 4000) errors.push(makeIssue("caption", "message-too-long", "Nội dung chia sẻ vượt 4.000 ký tự."));
    if (provider === "email" && !text(project.title).trim()) warnings.push(makeIssue("title", "empty-subject", "Email chia sẻ chưa có chủ đề.", "warning"));
    return validation(errors, warnings, { shareProvider:provider, canonicalUrl:url?.href || "", caption:text(project.caption).trim(), title:text(project.title).trim() });
  }
  function socialShareLink(project = {}) {
    const checked = assertValid(validateSocialShare(project));
    const output = Core().buildShareUrl({ provider:checked.normalized.shareProvider, url:checked.normalized.canonicalUrl, text:checked.normalized.caption, title:checked.normalized.title });
    const parsed = output.startsWith("mailto:") ? null : new URL(output);
    const payload = { output, provider:checked.normalized.shareProvider, target:checked.normalized.canonicalUrl, protocol:parsed?.protocol || "mailto:", host:parsed?.host || "email", safe:output.startsWith("https://") || output.startsWith("mailto:"), qrPayload:output };
    return { ...payload, validation:checked, apply:{ shareProvider:payload.provider }, exports:makeExports("social-share-link", payload, { txt:output }) };
  }
  function validateYouTube(project = {}) {
    const ref = Core().parseVideoRef(project.sourceUrl, "youtube"), seconds = Math.floor(Number(project.startSeconds));
    const errors = [], warnings = [];
    if (!ref) errors.push(makeIssue("sourceUrl", "invalid-youtube-reference", "URL hoặc ID YouTube không hợp lệ."));
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 359999) errors.push(makeIssue("startSeconds", "invalid-start", "Thời điểm bắt đầu phải từ 0 đến 359.999 giây."));
    if (seconds > 43200) warnings.push(makeIssue("startSeconds", "unusually-large", "Thời điểm bắt đầu lớn hơn 12 giờ; hãy kiểm tra lại.", "warning"));
    return validation(errors, warnings, { ref, startSeconds:Number.isFinite(seconds) ? seconds : 0 });
  }
  const formatDuration = (seconds) => [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map((value) => String(value).padStart(2, "0")).join(":");
  function youtubeTimestamp(project = {}) {
    const checked = assertValid(validateYouTube(project)), url = new URL(checked.normalized.ref.url);
    if (checked.normalized.startSeconds) url.searchParams.set("t", `${checked.normalized.startSeconds}s`);
    const output = url.href, payload = { output, videoId:checked.normalized.ref.id, startSeconds:checked.normalized.startSeconds, timestamp:formatDuration(checked.normalized.startSeconds), safe:true, qrPayload:output, protocol:"https:", host:url.host };
    return { ...payload, validation:checked, apply:{ sourceUrl:checked.normalized.ref.url, startSeconds:payload.startSeconds, canonicalUrl:output }, exports:makeExports("youtube-timestamp", payload, { txt:output }) };
  }
  function youtubeEmbed(project = {}) {
    const checked = assertValid(validateYouTube(project)), embed = Core().buildYouTubeEmbed(checked.normalized.ref.id, { start:checked.normalized.startSeconds, autoplay:project.autoplay === true });
    const payload = { ...embed, output:embed.html, startSeconds:checked.normalized.startSeconds, autoplay:project.autoplay === true, privacyEnhanced:true, security:{ cookieDomain:"youtube-nocookie.com", lazy:true, referrerPolicy:"strict-origin-when-cross-origin" }, preview:{ type:"iframe", aspectRatio:"16:9", src:embed.src } };
    return { ...payload, validation:checked, apply:{ sourceUrl:checked.normalized.ref.url, startSeconds:payload.startSeconds, embedHtml:embed.html }, exports:makeExports("youtube-embed", payload, { txt:embed.html, html:embed.html }) };
  }
  function link(project = {}, toolId = "social-share-link", helpers = {}) {
    const engine = ENGINE_REGISTRY[toolId];
    if (!engine || engine.family !== "link") throw new Error(`Không có link engine V${ENGINE_VERSION} cho ${toolId}.`);
    return engine.process(project, helpers);
  }

  function validateMetadata(project = {}) {
    const errors = [], warnings = [], canonical = httpsUrl(project.canonicalUrl), image = httpsUrl(project.imageUrl);
    if (!text(project.title).trim()) errors.push(makeIssue("title", "required", "Metadata cần tiêu đề."));
    if (!text(project.caption).trim()) errors.push(makeIssue("caption", "required", "Metadata cần mô tả."));
    if (!canonical) errors.push(makeIssue("canonicalUrl", "invalid-https-url", "Canonical URL phải dùng HTTPS hợp lệ."));
    if (!image) errors.push(makeIssue("imageUrl", "invalid-https-url", "URL ảnh preview phải dùng HTTPS hợp lệ."));
    if (chars(project.title).length > 120) errors.push(makeIssue("title", "too-long", "Tiêu đề metadata vượt giới hạn xử lý 120 ký tự."));
    if (chars(project.caption).length > 300) errors.push(makeIssue("caption", "too-long", "Mô tả metadata vượt giới hạn xử lý 300 ký tự."));
    if (chars(project.title).length > 60) warnings.push(makeIssue("title", "search-truncation", "Google có thể cắt tiêu đề dài hơn khoảng 60 ký tự.", "warning"));
    if (chars(project.caption).length > 160) warnings.push(makeIssue("caption", "description-truncation", "Một số preview có thể cắt mô tả dài hơn 160 ký tự.", "warning"));
    return validation(errors, warnings, { title:text(project.title).trim(), description:text(project.caption).trim(), canonicalUrl:canonical?.href || "", imageUrl:image?.href || "", siteName:text(project.siteName || "HH Platform").trim() });
  }
  function metadata(project = {}) {
    const checked = assertValid(validateMetadata(project)), n = checked.normalized;
    const data = Core().buildOpenGraph({ title:n.title, description:n.description, url:n.canonicalUrl, image:n.imageUrl, siteName:n.siteName });
    const width = Number(project.imageWidth) || 0, height = Number(project.imageHeight) || 0, ratio = width && height ? width / height : 0;
    const imageAudit = { width, height, ratio:ratio ? Math.round(ratio * 1000) / 1000 : null, target:{ width:1200, height:630, ratio:1.905 }, verified:Boolean(width && height), meetsMinimum:width >= 1200 && height >= 630, ratioClose:ratio ? Math.abs(ratio - 1200 / 630) <= .03 : false };
    const warnings = [...checked.warnings, ...data.warnings.map((message) => makeIssue("title", "core-warning", message, "warning"))];
    if (!imageAudit.verified) warnings.push(makeIssue("image", "size-unverified", "Chưa xác minh kích thước ảnh; mục tiêu preview lớn là 1200×630.", "warning"));
    else {
      if (!imageAudit.meetsMinimum) warnings.push(makeIssue("image", "image-too-small", "Ảnh nhỏ hơn mục tiêu 1200×630.", "warning"));
      if (!imageAudit.ratioClose) warnings.push(makeIssue("image", "image-ratio", "Tỷ lệ ảnh lệch đáng kể so với 1.91:1 và có thể bị crop.", "warning"));
    }
    const previews = {
      google:{ title:truncate(n.title, 60), description:truncate(n.description, 160), url:n.canonicalUrl, image:null },
      facebook:{ title:truncate(n.title, 65), description:truncate(n.description, 155), url:n.canonicalUrl, image:n.imageUrl },
      x:{ title:truncate(n.title, 70), description:truncate(n.description, 200), url:n.canonicalUrl, image:n.imageUrl, card:"summary_large_image" },
      linkedin:{ title:truncate(n.title, 70), description:truncate(n.description, 200), url:n.canonicalUrl, image:n.imageUrl }
    };
    const htmlDocument = `<!doctype html>\n<html lang="vi"><head>\n${data.html}\n<script type="application/ld+json">${safeJson(data.jsonLd)}</script>\n</head><body></body></html>`;
    const payload = { tags:data.tags, html:data.html, jsonLd:data.jsonLd, warnings, image:imageAudit, previews, output:data.html };
    const csv = toCsv([["property", "content"], ...Object.entries(data.tags)]);
    return { ...payload, validation:{ ...checked, warnings }, apply:{ metadataHtml:data.html, metadataJsonLd:data.jsonLd, metadataTags:data.tags }, csv, exports:makeExports("social-metadata", payload, { txt:data.html, csv, html:htmlDocument }) };
  }
  function openGraph(project = {}) { return metadata(project); }
  function linkPreviewAudit(project = {}) { return metadata(project); }

  function validateDimensions(project = {}) {
    const errors = [], warnings = [], items = Core().SOCIAL_DIMENSIONS;
    if (!Array.isArray(items) || !items.length) errors.push(makeIssue("dimensions", "catalog-empty", "Danh mục kích thước chưa sẵn sàng."));
    const platform = text(project.dimensionPlatform || project.socialProvider || project.platform).trim();
    const asset = text(project.dimensionAsset).trim();
    if (platform && !items.some((item) => normalizeKey(item.platform) === normalizeKey(platform))) warnings.push(makeIssue("dimensionPlatform", "unknown-platform", "Không tìm thấy nền tảng đã chọn; sẽ hiển thị toàn bộ danh mục.", "warning"));
    return validation(errors, warnings, { platform, asset });
  }
  function dimensions(project = {}) {
    const checked = assertValid(validateDimensions(project)), all = Core().SOCIAL_DIMENSIONS.map((item, index) => ({ ...item, id:`${normalizeKey(item.platform).replace(/\s+/g, "-")}-${index + 1}` }));
    const platformItems = checked.normalized.platform ? all.filter((item) => normalizeKey(item.platform) === normalizeKey(checked.normalized.platform)) : all;
    const items = platformItems.length ? platformItems : all;
    const selected = items.find((item) => checked.normalized.asset && normalizeKey(item.asset) === normalizeKey(checked.normalized.asset)) || items[0];
    const safeZonePercent = clamp(project.safeZonePercent || 5, 0, 25);
    const canvas = { width:selected.width, height:selected.height, ratio:selected.ratio, orientation:selected.width === selected.height ? "square" : selected.width > selected.height ? "landscape" : "portrait", safeZone:{ percent:safeZonePercent, x:Math.round(selected.width * safeZonePercent / 100), y:Math.round(selected.height * safeZonePercent / 100) }, css:`aspect-ratio: ${selected.width} / ${selected.height};`, ariaLabel:`Canvas ${selected.platform} ${selected.asset}, ${selected.width} × ${selected.height}` };
    const csv = toCsv([["platform", "asset", "width", "height", "ratio", "orientation"], ...all.map((item) => [item.platform, item.asset, item.width, item.height, item.ratio, item.width === item.height ? "square" : item.width > item.height ? "landscape" : "portrait"])]);
    const output = `${selected.platform} · ${selected.asset}\n${selected.width}×${selected.height} · ${selected.ratio}`;
    const payload = { items, all, selected, canvas, output, source:"HHSocialMediaCore.SOCIAL_DIMENSIONS" };
    return { ...payload, validation:checked, apply:{ socialProvider:normalizeKey(selected.platform), dimensionPlatform:selected.platform, dimensionAsset:selected.asset, ratio:selected.ratio, canvasWidth:selected.width, canvasHeight:selected.height, safeZonePercent }, csv, exports:makeExports("social-dimensions", payload, { txt:output, csv }) };
  }

  const FONT_STYLES = Object.freeze({
    bold:{ upper:0x1d5d4, lower:0x1d5ee, digit:0x1d7ec },
    mono:{ upper:0x1d670, lower:0x1d68a, digit:0x1d7f6 },
    circle:{ upper:0x24b6, lower:0x24d0, digits:["⓪", "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"] }
  });
  function builtinUnicodeStyle(value, style) {
    const map = FONT_STYLES[style] || FONT_STYLES.bold;
    return chars(value).map((char) => {
      const code = char.codePointAt(0);
      if (code >= 65 && code <= 90) return String.fromCodePoint(map.upper + code - 65);
      if (code >= 97 && code <= 122) return String.fromCodePoint(map.lower + code - 97);
      if (code >= 48 && code <= 57) return map.digits ? map.digits[code - 48] : String.fromCodePoint(map.digit + code - 48);
      return char;
    }).join("");
  }
  function validateFont(project = {}) {
    const value = text(project.caption), style = text(project.textStyle || "bold"), errors = [], warnings = [];
    if (chars(value).length > 500) errors.push(makeIssue("caption", "input-too-large", "Unicode font chỉ xử lý tối đa 500 ký tự mỗi lần."));
    if (!FONT_STYLES[style]) errors.push(makeIssue("textStyle", "unsupported-style", "Kiểu Unicode chưa được hỗ trợ."));
    if (!value) warnings.push(makeIssue("caption", "empty", "Chưa có văn bản để tạo kiểu.", "warning"));
    return validation(errors, warnings, { caption:value, textStyle:style });
  }
  function font(project = {}, stylizer) {
    const checked = assertValid(validateFont(project)), value = checked.normalized.caption;
    const unsupported = [...new Set(chars(value).filter((char) => /\p{L}|\p{N}/u.test(char) && !/[A-Za-z0-9]/.test(char)))];
    const styleFn = typeof stylizer === "function" ? stylizer : builtinUnicodeStyle;
    const variants = Object.fromEntries(Object.keys(FONT_STYLES).map((style) => [style, styleFn(value, style)]));
    const output = variants[checked.normalized.textStyle], warnings = [...checked.warnings];
    warnings.push(makeIssue("caption", "accessibility", "Unicode trang trí có thể bị trình đọc màn hình đọc sai và làm giảm khả năng tìm kiếm.", "warning"));
    if (unsupported.length) warnings.push(makeIssue("caption", "unsupported-characters", `Các ký tự không được biến đổi và được giữ nguyên: ${unsupported.join(" ")}`, "warning", { characters:unsupported }));
    const payload = { output, variants, selected:checked.normalized.textStyle, unsupported, accessibility:{ screenReaderSafe:false, searchable:false, recommendation:"Giữ một bản chữ thường làm nhãn aria hoặc nội dung thay thế." }, source:value, warnings };
    const csv = toCsv([["style", "result"], ...Object.entries(variants)]);
    return { ...payload, validation:{ ...checked, warnings }, apply:{ caption:output, textStyle:checked.normalized.textStyle, plainTextCaption:value }, csv, exports:makeExports("unicode-font", payload, { txt:output, csv }) };
  }

  const EMOJI_CATALOG = Object.freeze([
    ["✨", "sparkles", "lấp lánh nổi bật mới", "symbols"], ["🔥", "fire", "lửa hot xu hướng", "symbols"], ["🚀", "rocket", "tên lửa ra mắt tăng trưởng", "travel"], ["💡", "idea", "ý tưởng mẹo", "objects"],
    ["🎬", "clapper", "phim video sản xuất", "objects"], ["🎨", "palette", "màu thiết kế sáng tạo", "activities"], ["📌", "pin", "ghim lưu ý", "objects"], ["✅", "check", "đúng hoàn tất xác nhận", "symbols"],
    ["❤️", "heart", "tim yêu thích", "emotion"], ["👏", "clap", "vỗ tay chúc mừng", "people"], ["🌟", "star", "ngôi sao nổi bật", "symbols"], ["💬", "chat", "bình luận trò chuyện", "objects"],
    ["📣", "megaphone", "thông báo quảng bá", "objects"], ["🎯", "target", "mục tiêu chính xác", "activities"], ["💎", "gem", "kim cương cao cấp", "objects"], ["🌈", "rainbow", "cầu vồng đa dạng", "nature"],
    ["⚡", "bolt", "sét nhanh năng lượng", "symbols"], ["🎉", "party", "tiệc ăn mừng", "activities"], ["📷", "camera", "máy ảnh hình ảnh", "objects"], ["▶️", "play", "phát video", "symbols"],
    ["😊", "smile", "cười vui thân thiện", "emotion"], ["😂", "laugh", "cười hài hước", "emotion"], ["🤔", "think", "suy nghĩ cân nhắc", "emotion"], ["🙏", "thanks", "cảm ơn cầu nguyện", "people"],
    ["👀", "eyes", "xem chú ý", "people"], ["👍", "thumbs up", "thích đồng ý", "people"], ["📈", "chart", "tăng trưởng phân tích", "objects"], ["🛒", "cart", "giỏ hàng mua sắm", "objects"],
    ["🎁", "gift", "quà tặng khuyến mãi", "objects"], ["📅", "calendar", "lịch ngày hẹn", "objects"], ["🔗", "link", "liên kết url", "objects"], ["⚠️", "warning", "cảnh báo chú ý", "symbols"]
  ].map(([emoji, name, keywords, category]) => Object.freeze({ emoji, name, keywords, category })));
  function validateEmoji(project = {}) {
    const query = text(project.emojiQuery).trim(), selected = text(project.selectedEmoji), errors = [], warnings = [];
    if (chars(query).length > 80) errors.push(makeIssue("emojiQuery", "query-too-long", "Từ khóa emoji tối đa 80 ký tự."));
    if (selected && !EMOJI_CATALOG.some((item) => item.emoji === selected)) errors.push(makeIssue("selectedEmoji", "unsupported-emoji", "Emoji đã chọn chưa có trong bảng local."));
    return validation(errors, warnings, { query, selected, category:text(project.emojiCategory || "all") });
  }
  function emoji(project = {}) {
    const checked = assertValid(validateEmoji(project)), needle = normalizeKey(checked.normalized.query), category = checked.normalized.category;
    const matches = EMOJI_CATALOG.filter((item) => (!needle || normalizeKey(`${item.name} ${item.keywords} ${item.emoji}`).includes(needle)) && (category === "all" || item.category === category));
    const favorites = [...new Set(Array.isArray(project.favoriteEmojis) ? project.favoriteEmojis : [])].filter((item) => EMOJI_CATALOG.some((entry) => entry.emoji === item));
    const recent = [...new Set(Array.isArray(project.recentEmojis) ? project.recentEmojis : [])].filter((item) => EMOJI_CATALOG.some((entry) => entry.emoji === item)).slice(0, 20);
    const selected = checked.normalized.selected, output = selected ? `${text(project.caption)}${project.caption ? " " : ""}${selected}` : text(project.caption);
    const nextRecent = selected ? [selected, ...recent.filter((item) => item !== selected)].slice(0, 20) : recent;
    const payload = { output, selected:selected || null, matches, total:matches.length, categories:[...new Set(EMOJI_CATALOG.map((item) => item.category))], favorites, recent:nextRecent, query:checked.normalized.query };
    const csv = toCsv([["emoji", "name", "keywords", "category"], ...matches.map((item) => [item.emoji, item.name, item.keywords, item.category])]);
    return { ...payload, validation:checked, apply:{ caption:output, recentEmojis:nextRecent, favoriteEmojis:favorites }, csv, exports:makeExports("emoji-selection", payload, { txt:matches.map((item) => item.emoji).join(" "), csv }) };
  }

  function validateBio(project = {}) {
    const title = text(project.title).trim(), description = text(project.caption).trim(), errors = [], warnings = [];
    if (!title) errors.push(makeIssue("title", "required", "Bio cần tên hoặc thương hiệu."));
    if (chars(title).length > 80) errors.push(makeIssue("title", "too-long", "Tên bio tối đa 80 ký tự."));
    if (chars(description).length > 240) errors.push(makeIssue("caption", "too-long", "Giới thiệu bio tối đa 240 ký tự."));
    const rawLinks = Array.isArray(project.bioLinks) && project.bioLinks.length ? project.bioLinks : [{ label:"Liên kết chính", url:project.canonicalUrl }];
    if (rawLinks.length > 12) errors.push(makeIssue("bioLinks", "too-many-links", "Bio local hỗ trợ tối đa 12 liên kết."));
    const links = [], seen = new Set();
    rawLinks.slice(0, 12).forEach((entry, index) => {
      const url = httpsUrl(entry?.url || entry), label = text(entry?.label || `Liên kết ${index + 1}`).trim();
      if (!url) errors.push(makeIssue(`bioLinks.${index}.url`, "invalid-https-url", `Liên kết bio ${index + 1} phải dùng HTTPS hợp lệ.`));
      else if (seen.has(url.href)) warnings.push(makeIssue(`bioLinks.${index}.url`, "duplicate", `Liên kết bio ${index + 1} bị trùng và sẽ được loại.`, "warning"));
      else { seen.add(url.href); links.push({ label:label || url.hostname, url:url.href }); }
    });
    if (!description) warnings.push(makeIssue("caption", "empty-description", "Bio chưa có phần giới thiệu.", "warning"));
    return validation(errors, warnings, { title, description, links });
  }
  function bio(project = {}) {
    const checked = assertValid(validateBio(project)), n = checked.normalized;
    const html = `<section class="social-bio" aria-label="Liên kết của ${escapeHtml(n.title)}"><h1>${escapeHtml(n.title)}</h1>${n.description ? `<p>${escapeHtml(n.description)}</p>` : ""}<nav aria-label="Liên kết bio">${n.links.map((item) => `<a href="${escapeHtml(item.url)}" rel="noopener noreferrer">${escapeHtml(item.label)}</a>`).join("")}</nav></section>`;
    const output = [n.title, n.description, ...n.links.map((item) => `${item.label}: ${item.url}`)].filter(Boolean).join("\n");
    const payload = { output, title:n.title, description:n.description, links:n.links, html, preview:{ heading:n.title, description:n.description, linkCount:n.links.length }, safe:true };
    const csv = toCsv([["label", "url"], ...n.links.map((item) => [item.label, item.url])]);
    return { ...payload, validation:checked, apply:{ title:n.title, caption:n.description, canonicalUrl:n.links[0]?.url || text(project.canonicalUrl), bioLinks:n.links }, csv, exports:makeExports("social-bio", payload, { txt:output, csv, html }) };
  }

  function validateCaptionFormatter(project = {}) {
    const value = text(project.caption), errors = [], warnings = [];
    if (chars(value).length > 63206) errors.push(makeIssue("caption", "input-too-large", "Caption vượt giới hạn xử lý 63.206 ký tự."));
    if (!value.trim()) warnings.push(makeIssue("caption", "empty", "Chưa có caption để định dạng.", "warning"));
    return validation(errors, warnings, { caption:value });
  }
  function captionFormatter(project = {}) {
    const checked = assertValid(validateCaptionFormatter(project)), source = checked.normalized.caption;
    const tags = Core().captionStats(source, project.platform).hashtags;
    const body = Core().normalizeSocialText(source.replace(/(?:^|\s)#[\p{L}\p{N}_]+/gu, " "));
    const output = Core().formatCaption({ hook:project.captionHook, body, cta:project.captionCta, hashtags:tags });
    const payload = { output, source, sections:{ hook:text(project.captionHook), body, cta:text(project.captionCta), hashtags:tags }, stats:Core().textMetrics(output, project.platform) };
    return { ...payload, validation:checked, apply:{ caption:output }, exports:makeExports("caption-formatted", payload, { txt:output }) };
  }

  function validateXRevenue(project = {}) {
    const errors = [], warnings = [];
    for (const field of ["impressions", "eligibleRate", "rpm", "uncertainty"]) if (!Number.isFinite(Number(project[field])) || Number(project[field]) < 0) errors.push(makeIssue(field, "invalid-number", `${field} phải là số không âm.`));
    if (Number(project.eligibleRate) > 1) errors.push(makeIssue("eligibleRate", "out-of-range", "eligibleRate phải từ 0 đến 1."));
    if (Number(project.uncertainty) > .9) errors.push(makeIssue("uncertainty", "out-of-range", "uncertainty phải từ 0 đến 0,9."));
    warnings.push(makeIssue("estimate", "not-provider-data", "Kết quả chỉ là mô hình từ giả định người dùng, không phải doanh thu nền tảng xác nhận.", "warning"));
    return validation(errors, warnings, {});
  }
  function xRevenue(project = {}) {
    const checked = assertValid(validateXRevenue(project)), estimate = Core().estimateXRevenue(project);
    const output = `${estimate.low.toFixed(2)}–${estimate.high.toFixed(2)} ${estimate.currency} (trung điểm ${estimate.midpoint.toFixed(2)})`;
    const payload = { ...estimate, output, assumptions:{ impressions:Number(project.impressions), eligibleRate:Number(project.eligibleRate), rpm:Number(project.rpm), uncertainty:Number(project.uncertainty) } };
    const csv = toCsv([["low", "midpoint", "high", "currency"], [estimate.low, estimate.midpoint, estimate.high, estimate.currency]]);
    return { ...payload, validation:checked, apply:{ revenueEstimate:payload }, csv, exports:makeExports("x-revenue-estimate", payload, { txt:output, csv }) };
  }

  const ENGINE_REGISTRY = Object.freeze({
    "alt-text-checker":Object.freeze({ id:"alt-text-checker", family:"accessibility", version:ENGINE_VERSION, validate:validateAltText, process:altText, applyBack:true, exports:["txt", "json", "csv"] }),
    "social-character-counter":Object.freeze({ id:"social-character-counter", family:"text", version:ENGINE_VERSION, validate:validateCharacterCounter, process:characterCounter, applyBack:true, exports:["txt", "json", "csv"] }),
    "case-converter":Object.freeze({ id:"case-converter", family:"text", version:ENGINE_VERSION, validate:validateCaseConverter, process:caseConverter, applyBack:true, exports:["txt", "json", "csv"] }),
    "whitespace-cleaner":Object.freeze({ id:"whitespace-cleaner", family:"text", version:ENGINE_VERSION, validate:validateWhitespace, process:whitespace, applyBack:true, exports:["txt", "json", "csv"] }),
    "hashtag-workspace":Object.freeze({ id:"hashtag-workspace", family:"hashtag", version:ENGINE_VERSION, validate:validateHashtag, process:hashtagWorkspace, applyBack:true, exports:["txt", "json", "csv"] }),
    "hashtag-cleaner":Object.freeze({ id:"hashtag-cleaner", family:"hashtag", version:ENGINE_VERSION, validate:validateHashtag, process:hashtagCleaner, applyBack:true, exports:["txt", "json", "csv"] }),
    "utm-builder":Object.freeze({ id:"utm-builder", family:"link", version:ENGINE_VERSION, validate:validateUtm, process:utmBuilder, applyBack:true, exports:["txt", "json", "csv", "qr"] }),
    "username-link-builder":Object.freeze({ id:"username-link-builder", family:"link", version:ENGINE_VERSION, validate:validateUsernameLink, process:usernameLink, applyBack:true, exports:["txt", "json", "qr"] }),
    "whatsapp-link":Object.freeze({ id:"whatsapp-link", family:"link", version:ENGINE_VERSION, validate:validateWhatsapp, process:whatsappLink, applyBack:true, exports:["txt", "json", "qr"] }),
    "telegram-link":Object.freeze({ id:"telegram-link", family:"link", version:ENGINE_VERSION, validate:validateTelegram, process:telegramLink, applyBack:true, exports:["txt", "json", "qr"] }),
    "social-share-link":Object.freeze({ id:"social-share-link", family:"link", version:ENGINE_VERSION, validate:validateSocialShare, process:socialShareLink, applyBack:true, exports:["txt", "json", "qr"] }),
    "youtube-timestamp":Object.freeze({ id:"youtube-timestamp", family:"link", version:ENGINE_VERSION, validate:validateYouTube, process:youtubeTimestamp, applyBack:true, exports:["txt", "json", "qr"] }),
    "youtube-embed":Object.freeze({ id:"youtube-embed", family:"video-code", version:ENGINE_VERSION, validate:validateYouTube, process:youtubeEmbed, applyBack:true, exports:["txt", "json", "html"] }),
    "open-graph":Object.freeze({ id:"open-graph", family:"metadata", version:ENGINE_VERSION, validate:validateMetadata, process:openGraph, applyBack:true, exports:["txt", "json", "csv", "html"] }),
    "link-preview-audit":Object.freeze({ id:"link-preview-audit", family:"metadata", version:ENGINE_VERSION, validate:validateMetadata, process:linkPreviewAudit, applyBack:true, exports:["txt", "json", "csv", "html"] }),
    "social-dimensions":Object.freeze({ id:"social-dimensions", family:"design", version:ENGINE_VERSION, validate:validateDimensions, process:dimensions, applyBack:true, exports:["txt", "json", "csv"] }),
    "unicode-font-styler":Object.freeze({ id:"unicode-font-styler", family:"text", version:ENGINE_VERSION, validate:validateFont, process:(project, helpers = {}) => font(project, helpers.unicodeStyle), applyBack:true, exports:["txt", "json", "csv"] }),
    "emoji-picker":Object.freeze({ id:"emoji-picker", family:"text", version:ENGINE_VERSION, validate:validateEmoji, process:emoji, applyBack:true, exports:["txt", "json", "csv"] }),
    "bio-link":Object.freeze({ id:"bio-link", family:"link", version:ENGINE_VERSION, validate:validateBio, process:bio, applyBack:true, exports:["txt", "json", "csv", "html"] }),
    "caption-formatter":Object.freeze({ id:"caption-formatter", family:"text", version:ENGINE_VERSION, validate:validateCaptionFormatter, process:captionFormatter, applyBack:true, exports:["txt", "json"] }),
    "x-revenue":Object.freeze({ id:"x-revenue", family:"estimate", version:ENGINE_VERSION, validate:validateXRevenue, process:xRevenue, applyBack:true, exports:["txt", "json", "csv"] })
  });

  function engineFor(toolId) { return ENGINE_REGISTRY[text(toolId)] || null; }
  function validate(toolId, project = {}) {
    const engine = engineFor(toolId);
    if (!engine) return validation([makeIssue("toolId", "engine-not-found", `Công cụ ${toolId} chưa có local engine V${ENGINE_VERSION}.`)], [], {});
    return engine.validate(project);
  }
  function run(toolId, project = {}, helpers = {}) {
    const engine = engineFor(toolId);
    if (!engine) throw new Error(`Công cụ ${toolId} chưa có local engine V${ENGINE_VERSION}; trạng thái phải là Đang phát triển.`);
    const checked = engine.validate(project);
    assertValid(checked);
    return engine.process(project, helpers);
  }

  root.HHSocialLocalEngines = Object.freeze({
    version:ENGINE_VERSION, registry:ENGINE_REGISTRY, engineFor, validate, run,
    altText, characterCounter, caseConverter, whitespace, hashtag, link, metadata, dimensions, font, emoji, bio, captionFormatter, xRevenue,
    validateAltText, validateCharacterCounter, validateCaseConverter, validateWhitespace, validateHashtag, validateMetadata, validateDimensions, validateFont,
    toCsv, colorString, builtinUnicodeStyle
  });
  if (typeof module !== "undefined" && module.exports) module.exports = root.HHSocialLocalEngines;
})(typeof window !== "undefined" ? window : globalThis);
