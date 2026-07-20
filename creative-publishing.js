(function (globalScope) {
  "use strict";

  const VERSION = 1;
  const FORMAT = "hh-creative-publishing";
  const STORAGE_KEY = "hh.creative-publishing.v1";
  const MAX_QUEUE = 300;
  const MAX_ANALYTICS = 2000;
  const MAX_RIGHTS = 1000;
  const MAX_PROVIDERS = 100;
  const VIEWS = Object.freeze(["publishing", "analytics", "rights", "providers"]);
  const PLATFORMS = Object.freeze(["youtube", "tiktok", "facebook", "website"]);
  const PLATFORM_LABELS = Object.freeze({ youtube: "YouTube", tiktok: "TikTok", facebook: "Facebook", website: "Website" });
  const LICENSES = Object.freeze(["owned", "licensed", "cc0", "cc-by", "cc-by-sa", "public-domain", "ai-generated", "unknown"]);
  const QUEUE_STATUSES = Object.freeze(["draft", "scheduled", "queued", "sending", "sent", "failed", "blocked", "cancelled"]);
  const mounted = typeof WeakMap === "function" ? new WeakMap() : new Map();
  const activeRoots = new Set();

  const PLATFORM_RULES = Object.freeze({
    youtube: Object.freeze({ title: 100, description: 5000, playlist: true, thumbnail: true }),
    tiktok: Object.freeze({ title: 150, description: 2200, playlist: false, thumbnail: true }),
    facebook: Object.freeze({ title: 255, description: 63206, playlist: false, thumbnail: true }),
    website: Object.freeze({ title: 180, description: 10000, playlist: false, thumbnail: false })
  });

  function clone(value) {
    if (value === undefined) return undefined;
    if (typeof globalScope.structuredClone === "function") {
      try { return globalScope.structuredClone(value); } catch (_) { /* JSON fallback */ }
    }
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function cleanText(value, limit) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .trim()
      .slice(0, Math.max(1, Number(limit) || 4000));
  }

  function clamp(value, min, max) {
    const number = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(number) ? number : min));
  }

  function uid(prefix, idFactory) {
    if (typeof idFactory === "function") return cleanText(idFactory(prefix), 160);
    const cryptoApi = globalScope.crypto;
    if (cryptoApi && typeof cryptoApi.randomUUID === "function") return `${prefix}-${cryptoApi.randomUUID()}`;
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function isoDate(value, fallback) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : fallback || "";
  }

  function safeUrl(value, options) {
    const text = cleanText(value, 4000);
    if (!text) return "";
    if (options && options.image && /^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(text)) return text;
    if (/^https?:\/\//i.test(text)) return text;
    if (/^(?:\.\.?\/|\/)[^\u0000\s]*$/i.test(text)) return text;
    return "";
  }

  function makeError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function defaultState() {
    return {
      version: VERSION,
      queue: [],
      analytics: [],
      rights: [],
      providers: [],
      settings: { routeMode: "balanced", analyticsMetric: "ctr", minimumSample: 1000, confidenceThreshold: 0.95 },
      updatedAt: ""
    };
  }

  function normalizePublication(input, idFactory) {
    const source = input && typeof input === "object" ? input : {};
    const platform = PLATFORMS.includes(source.platform) ? source.platform : "youtube";
    const status = QUEUE_STATUSES.includes(source.status) ? source.status : "draft";
    const createdAt = isoDate(source.createdAt, new Date().toISOString());
    return {
      id: cleanText(source.id, 160) || uid("publish", idFactory),
      projectId: cleanText(source.projectId, 160),
      platform,
      title: cleanText(source.title, PLATFORM_RULES[platform].title),
      description: cleanText(source.description, PLATFORM_RULES[platform].description),
      scheduledAt: isoDate(source.scheduledAt, ""),
      timezone: cleanText(source.timezone, 80) || "Asia/Bangkok",
      thumbnailUrl: safeUrl(source.thumbnailUrl, { image: true }),
      mediaUrl: safeUrl(source.mediaUrl),
      playlist: cleanText(source.playlist, 200),
      tags: Array.isArray(source.tags) ? [...new Set(source.tags.map((item) => cleanText(item, 80)).filter(Boolean))].slice(0, 30) : [],
      visibility: ["public", "unlisted", "private"].includes(source.visibility) ? source.visibility : "private",
      status,
      attempts: Math.floor(clamp(source.attempts, 0, 20)),
      providerId: cleanText(source.providerId, 120),
      remoteId: cleanText(source.remoteId, 300),
      remoteUrl: safeUrl(source.remoteUrl),
      error: cleanText(source.error, 600),
      confirmedAt: isoDate(source.confirmedAt, ""),
      createdAt,
      updatedAt: isoDate(source.updatedAt, createdAt),
      metadata: source.metadata && typeof source.metadata === "object" ? sanitizeObject(source.metadata, 3) : {}
    };
  }

  function sanitizeObject(value, depth) {
    if (depth <= 0 || value == null) return null;
    if (Array.isArray(value)) return value.slice(0, 80).map((item) => sanitizeObject(item, depth - 1));
    if (typeof value !== "object") return typeof value === "string" ? cleanText(value, 1000) : value;
    const output = {};
    Object.entries(value).slice(0, 120).forEach(([key, item]) => {
      const safeKey = cleanText(key, 100).replace(/[^a-z0-9_.-]/gi, "_");
      if (!safeKey || /(?:secret|password|credential|private.?key|access.?token|refresh.?token)/i.test(safeKey)) return;
      output[safeKey] = sanitizeObject(item, depth - 1);
    });
    return output;
  }

  function validateSchedule(value, nowValue) {
    if (!value) return { valid: false, code: "SCHEDULE_REQUIRED", message: "Hãy chọn ngày và giờ xuất bản." };
    const scheduled = new Date(value);
    const now = new Date(nowValue || Date.now());
    if (!Number.isFinite(scheduled.getTime())) return { valid: false, code: "SCHEDULE_INVALID", message: "Ngày xuất bản không hợp lệ." };
    if (scheduled.getTime() < now.getTime() - 60000) return { valid: false, code: "SCHEDULE_PAST", message: "Lịch xuất bản không thể nằm trong quá khứ." };
    return { valid: true, value: scheduled.toISOString(), message: "Lịch hợp lệ." };
  }

  function preflightPublication(input, options) {
    const item = normalizePublication(input);
    const rules = PLATFORM_RULES[item.platform];
    const errors = [];
    const warnings = [];
    if (!item.title) errors.push({ code: "TITLE_REQUIRED", field: "title", message: "Tiêu đề là bắt buộc." });
    if (!item.mediaUrl && !(options && options.allowLocalMedia)) errors.push({ code: "MEDIA_REQUIRED", field: "mediaUrl", message: "Chưa có media hoặc URL media hợp lệ." });
    if (!item.description) warnings.push({ code: "DESCRIPTION_EMPTY", field: "description", message: "Nên thêm mô tả trước khi xuất bản." });
    if (rules.thumbnail && !item.thumbnailUrl) warnings.push({ code: "THUMBNAIL_EMPTY", field: "thumbnailUrl", message: "Nên thêm thumbnail riêng cho nền tảng này." });
    if (item.platform === "youtube" && item.tags.length === 0) warnings.push({ code: "TAGS_EMPTY", field: "tags", message: "Chưa có tag YouTube." });
    if (item.scheduledAt) {
      const result = validateSchedule(item.scheduledAt, options && options.now);
      if (!result.valid) errors.push({ code: result.code, field: "scheduledAt", message: result.message });
    }
    if (item.metadata && item.metadata.rightsStatus === "missing") errors.push({ code: "RIGHTS_MISSING", field: "rights", message: "Media đang thiếu xác nhận quyền sử dụng." });
    return { valid: errors.length === 0, errors, warnings, score: Math.max(0, 100 - errors.length * 35 - warnings.length * 8) };
  }

  function normalizeAnalytics(input, idFactory) {
    const source = input && typeof input === "object" ? input : {};
    const impressions = Math.floor(clamp(source.impressions, 0, 1e12));
    const clicks = Math.floor(clamp(source.clicks, 0, impressions || 1e12));
    const views = Math.floor(clamp(source.views, 0, 1e12));
    const retention = clamp(Number(source.retention) > 1 ? Number(source.retention) / 100 : source.retention, 0, 1);
    return {
      id: cleanText(source.id, 160) || uid("metric", idFactory),
      projectId: cleanText(source.projectId, 160),
      experimentId: cleanText(source.experimentId, 160) || "default",
      variant: cleanText(source.variant || source.variantName, 120) || "A",
      thumbnail: safeUrl(source.thumbnail, { image: true }),
      hook: cleanText(source.hook, 500),
      title: cleanText(source.title, 300),
      impressions,
      clicks,
      views,
      retention,
      watchTime: clamp(source.watchTime, 0, 1e12),
      recordedAt: isoDate(source.recordedAt, new Date().toISOString()),
      platform: PLATFORMS.includes(source.platform) ? source.platform : "youtube"
    };
  }

  function ctr(record) {
    return record && Number(record.impressions) > 0 ? Number(record.clicks) / Number(record.impressions) : 0;
  }

  function erf(value) {
    const sign = value < 0 ? -1 : 1;
    const x = Math.abs(value);
    const t = 1 / (1 + 0.3275911 * x);
    const result = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return sign * result;
  }

  function normalCdf(value) {
    return 0.5 * (1 + erf(value / Math.sqrt(2)));
  }

  function aggregateVariants(records, experimentId) {
    const groups = new Map();
    (Array.isArray(records) ? records : []).filter((item) => !experimentId || item.experimentId === experimentId).forEach((item) => {
      const record = normalizeAnalytics(item);
      const current = groups.get(record.variant) || { variant: record.variant, impressions: 0, clicks: 0, views: 0, retentionWeighted: 0, retentionSample: 0, watchTime: 0, records: 0, title: record.title, hook: record.hook, thumbnail: record.thumbnail };
      const retentionSample = Math.max(1, record.views || record.impressions);
      current.impressions += record.impressions;
      current.clicks += record.clicks;
      current.views += record.views;
      current.retentionWeighted += record.retention * retentionSample;
      current.retentionSample += retentionSample;
      current.watchTime += record.watchTime;
      current.records += 1;
      current.title = record.title || current.title;
      current.hook = record.hook || current.hook;
      current.thumbnail = record.thumbnail || current.thumbnail;
      groups.set(record.variant, current);
    });
    return [...groups.values()].map((item) => ({ ...item, ctr: item.impressions ? item.clicks / item.impressions : 0, retention: item.retentionSample ? item.retentionWeighted / item.retentionSample : 0 })).sort((left, right) => left.variant.localeCompare(right.variant));
  }

  function evaluateExperiment(records, options) {
    const settings = options && typeof options === "object" ? options : {};
    const minimumSample = Math.floor(clamp(settings.minimumSample == null ? 1000 : settings.minimumSample, 30, 1e9));
    const threshold = clamp(settings.confidenceThreshold == null ? 0.95 : settings.confidenceThreshold, 0.5, 0.9999);
    const metric = settings.metric === "retention" ? "retention" : "ctr";
    const variants = aggregateVariants(records, settings.experimentId);
    if (variants.length < 2) return { status: "insufficient-variants", winner: null, confidence: 0, variants, minimumSample, threshold, metric, message: "Cần ít nhất hai phiên bản để so sánh." };
    const ranked = [...variants].sort((left, right) => right[metric] - left[metric] || right.impressions - left.impressions || left.variant.localeCompare(right.variant));
    if (ranked.some((item) => item.impressions < minimumSample)) return { status: "insufficient-sample", winner: null, confidence: 0, variants, minimumSample, threshold, metric, message: `Chưa đủ tối thiểu ${minimumSample.toLocaleString("vi-VN")} impressions cho mỗi phiên bản.` };
    const best = ranked[0];
    const second = ranked[1];
    let confidence = 0;
    if (metric === "ctr") {
      const pooled = (best.clicks + second.clicks) / Math.max(1, best.impressions + second.impressions);
      const standardError = Math.sqrt(Math.max(0, pooled * (1 - pooled) * (1 / best.impressions + 1 / second.impressions)));
      confidence = standardError ? normalCdf(Math.abs(best.ctr - second.ctr) / standardError) : best.ctr === second.ctr ? 0.5 : 1;
    } else {
      const bestSample = Math.max(1, best.retentionSample || best.views || best.impressions);
      const secondSample = Math.max(1, second.retentionSample || second.views || second.impressions);
      const pooled = (best.retention * bestSample + second.retention * secondSample) / (bestSample + secondSample);
      const standardError = Math.sqrt(Math.max(0, pooled * (1 - pooled) * (1 / bestSample + 1 / secondSample)));
      confidence = standardError ? normalCdf(Math.abs(best.retention - second.retention) / standardError) : best.retention === second.retention ? 0.5 : 1;
    }
    if (confidence < threshold || best[metric] === second[metric]) return { status: "inconclusive", winner: null, confidence, variants, minimumSample, threshold, metric, message: "Dữ liệu chưa đủ mạnh để kết luận phiên bản thắng." };
    return { status: "winner", winner: best.variant, confidence, variants, minimumSample, threshold, metric, message: `Phiên bản ${best.variant} đang dẫn đầu với độ tin cậy ${(confidence * 100).toFixed(1)}%.` };
  }

  function parseCsv(text) {
    const source = String(text || "").replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index <= source.length; index += 1) {
      const char = source[index] || "\n";
      if (quoted) {
        if (char === '"' && source[index + 1] === '"') { cell += '"'; index += 1; }
        else if (char === '"') quoted = false;
        else cell += char;
      } else if (char === '"') quoted = true;
      else if (char === ",") { row.push(cell); cell = ""; }
      else if (char === "\n") { row.push(cell.replace(/\r$/, "")); if (row.some((item) => item.trim())) rows.push(row); row = []; cell = ""; }
      else cell += char;
      if (rows.length > MAX_ANALYTICS + 1) break;
    }
    if (!rows.length) return [];
    const headers = rows.shift().slice(0, 40).map((item) => cleanText(item, 80));
    return rows.slice(0, MAX_ANALYTICS).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
  }

  function parseAnalyticsImport(input, format) {
    try {
      let records;
      if (format === "csv" || (format !== "json" && !/^\s*[\[{]/.test(String(input || "")))) records = parseCsv(input);
      else {
        const parsed = typeof input === "string" ? JSON.parse(input) : input;
        records = Array.isArray(parsed) ? parsed : Array.isArray(parsed && parsed.records) ? parsed.records : [parsed];
      }
      return { valid: true, records: records.filter(Boolean).slice(0, MAX_ANALYTICS).map((item) => normalizeAnalytics(item)), errors: [] };
    } catch (error) {
      return { valid: false, records: [], errors: [{ code: "IMPORT_INVALID", message: cleanText(error.message, 300) || "Dữ liệu analytics không hợp lệ." }] };
    }
  }

  function normalizeRightsAsset(input, idFactory) {
    const source = input && typeof input === "object" ? input : {};
    const license = LICENSES.includes(source.license) ? source.license : "unknown";
    return {
      id: cleanText(source.id, 160) || uid("rights", idFactory),
      projectId: cleanText(source.projectId, 160),
      name: cleanText(source.name, 260) || "Asset chưa đặt tên",
      type: cleanText(source.type, 80) || "other",
      sourceUrl: safeUrl(source.sourceUrl),
      license,
      creator: cleanText(source.creator, 200),
      proofUrl: safeUrl(source.proofUrl),
      aiModel: cleanText(source.aiModel, 200),
      prompt: cleanText(source.prompt, 5000),
      createdAt: isoDate(source.createdAt, new Date().toISOString()),
      expiresAt: isoDate(source.expiresAt, ""),
      usage: cleanText(source.usage, 500),
      notes: cleanText(source.notes, 1000)
    };
  }

  function auditRights(assets, options) {
    const now = new Date(options && options.now || Date.now()).getTime();
    const issues = [];
    const normalized = (Array.isArray(assets) ? assets : []).slice(0, MAX_RIGHTS).map((item) => normalizeRightsAsset(item));
    normalized.forEach((asset) => {
      if (!asset.sourceUrl && asset.license !== "owned" && asset.license !== "ai-generated") issues.push({ assetId: asset.id, level: "error", code: "SOURCE_MISSING", message: `${asset.name}: thiếu nguồn tài sản.` });
      if (asset.license === "unknown") issues.push({ assetId: asset.id, level: "error", code: "LICENSE_MISSING", message: `${asset.name}: chưa xác định giấy phép.` });
      if (!asset.creator) issues.push({ assetId: asset.id, level: "warning", code: "CREATOR_MISSING", message: `${asset.name}: thiếu tên người tạo.` });
      if (asset.license === "licensed" && !asset.proofUrl) issues.push({ assetId: asset.id, level: "error", code: "PROOF_MISSING", message: `${asset.name}: thiếu chứng từ giấy phép.` });
      if (asset.license === "ai-generated" && !asset.aiModel) issues.push({ assetId: asset.id, level: "warning", code: "AI_MODEL_MISSING", message: `${asset.name}: thiếu thông tin model AI.` });
      if (asset.license === "ai-generated" && !asset.prompt) issues.push({ assetId: asset.id, level: "warning", code: "PROMPT_MISSING", message: `${asset.name}: chưa lưu prompt nguồn gốc.` });
      if (asset.expiresAt && new Date(asset.expiresAt).getTime() < now) issues.push({ assetId: asset.id, level: "error", code: "LICENSE_EXPIRED", message: `${asset.name}: giấy phép đã hết hạn.` });
    });
    const errorCount = issues.filter((item) => item.level === "error").length;
    return { valid: errorCount === 0, assets: normalized, issues, errorCount, warningCount: issues.length - errorCount, score: normalized.length ? Math.max(0, Math.round(100 - errorCount * 24 - (issues.length - errorCount) * 7)) : 0 };
  }

  function exportRightsManifest(assets, options) {
    const audit = auditRights(assets, options);
    return JSON.stringify({ format: `${FORMAT}-rights-manifest`, version: VERSION, exportedAt: new Date(options && options.now || Date.now()).toISOString(), valid: audit.valid, summary: { assets: audit.assets.length, errors: audit.errorCount, warnings: audit.warningCount }, assets: audit.assets, issues: audit.issues }, null, 2);
  }

  function normalizeProvider(input, adapter, idFactory) {
    const source = input && typeof input === "object" ? input : {};
    const id = cleanText(source.id, 120) || cleanText(adapter && adapter.id, 120) || uid("provider", idFactory);
    const configured = source.configured === true || Boolean(adapter && adapter.configured === true);
    const cooldownUntil = isoDate(source.cooldownUntil, "");
    const limit = clamp(source.quotaLimit == null ? 0 : source.quotaLimit, 0, 1e15);
    const used = clamp(source.quotaUsed == null ? 0 : source.quotaUsed, 0, 1e15);
    return {
      id,
      label: cleanText(source.label || adapter && adapter.label || id, 160),
      configured,
      status: ["ready", "degraded", "offline", "unconfigured"].includes(source.status) ? source.status : configured ? "ready" : "unconfigured",
      modes: Array.isArray(source.modes) && source.modes.length ? source.modes.filter((item) => ["fast", "quality", "balanced"].includes(item)).slice(0, 3) : ["fast", "quality", "balanced"],
      qualityScore: clamp(source.qualityScore == null ? 50 : source.qualityScore, 0, 100),
      speedScore: clamp(source.speedScore == null ? 50 : source.speedScore, 0, 100),
      avgLatencyMs: clamp(source.avgLatencyMs, 0, 1e9),
      errorRate: clamp(source.errorRate, 0, 1),
      quotaLimit: limit,
      quotaUsed: Math.min(used, limit || used),
      cooldownUntil,
      inputTokens: Math.floor(clamp(source.inputTokens, 0, 1e15)),
      outputTokens: Math.floor(clamp(source.outputTokens, 0, 1e15)),
      credits: clamp(source.credits, 0, 1e15),
      lastError: cleanText(source.lastError, 400),
      updatedAt: isoDate(source.updatedAt, new Date().toISOString())
    };
  }

  function providerAvailable(provider, mode, nowValue) {
    const now = new Date(nowValue || Date.now()).getTime();
    const cooldown = provider.cooldownUntil ? new Date(provider.cooldownUntil).getTime() : 0;
    const quotaOkay = !provider.quotaLimit || provider.quotaUsed < provider.quotaLimit;
    return provider.configured && ["ready", "degraded"].includes(provider.status) && quotaOkay && (!cooldown || cooldown <= now) && (!mode || provider.modes.includes(mode) || provider.modes.includes("balanced"));
  }

  function chooseProvider(providers, mode, options) {
    const routeMode = ["fast", "quality", "balanced"].includes(mode) ? mode : "balanced";
    const candidates = (Array.isArray(providers) ? providers : []).map((item) => normalizeProvider(item)).filter((item) => providerAvailable(item, routeMode, options && options.now));
    const score = (provider) => {
      const reliability = (1 - provider.errorRate) * 100;
      if (routeMode === "fast") return provider.speedScore * 0.7 + reliability * 0.3;
      if (routeMode === "quality") return provider.qualityScore * 0.75 + reliability * 0.25;
      return provider.speedScore * 0.35 + provider.qualityScore * 0.4 + reliability * 0.25;
    };
    candidates.sort((left, right) => score(right) - score(left) || left.avgLatencyMs - right.avgLatencyMs || left.id.localeCompare(right.id));
    return candidates.length ? { provider: candidates[0], mode: routeMode, score: Number(score(candidates[0]).toFixed(2)), reason: routeMode === "fast" ? "Ưu tiên độ trễ và độ ổn định." : routeMode === "quality" ? "Ưu tiên chất lượng và độ ổn định." : "Cân bằng chất lượng, tốc độ và lỗi." } : { provider: null, mode: routeMode, score: 0, reason: "Không có provider đã cấu hình, còn quota và hết cooldown." };
  }

  function normalizeState(input, adapters, idFactory) {
    const source = input && typeof input === "object" ? input : {};
    const adapterMap = adapters && typeof adapters === "object" ? adapters : {};
    const providerInputs = (Array.isArray(source.providers) ? source.providers : []).slice(0, MAX_PROVIDERS);
    const providers = providerInputs.map((item) => normalizeProvider(item, adapterMap[item.id], idFactory));
    Object.entries(adapterMap).slice(0, MAX_PROVIDERS).forEach(([id, adapter]) => {
      if (providers.length < MAX_PROVIDERS && !providers.some((item) => item.id === id)) providers.push(normalizeProvider({ id, configured: adapter && adapter.configured === true, label: adapter && adapter.label, modes: adapter && adapter.modes, qualityScore: adapter && adapter.qualityScore, speedScore: adapter && adapter.speedScore }, adapter, idFactory));
    });
    return {
      version: VERSION,
      queue: (Array.isArray(source.queue) ? source.queue : []).slice(0, MAX_QUEUE).map((item) => normalizePublication(item, idFactory)),
      analytics: (Array.isArray(source.analytics) ? source.analytics : []).slice(0, MAX_ANALYTICS).map((item) => normalizeAnalytics(item, idFactory)),
      rights: (Array.isArray(source.rights) ? source.rights : []).slice(0, MAX_RIGHTS).map((item) => normalizeRightsAsset(item, idFactory)),
      providers,
      settings: {
        routeMode: ["fast", "quality", "balanced"].includes(source.settings && source.settings.routeMode) ? source.settings.routeMode : "balanced",
        analyticsMetric: source.settings && source.settings.analyticsMetric === "retention" ? "retention" : "ctr",
        minimumSample: Math.floor(clamp(source.settings && source.settings.minimumSample || 1000, 30, 1e9)),
        confidenceThreshold: clamp(source.settings && source.settings.confidenceThreshold || 0.95, 0.5, 0.9999)
      },
      updatedAt: isoDate(source.updatedAt, "")
    };
  }

  function readExternalStore(external) {
    try {
      if (!external) return null;
      if (typeof external.getCreativePublishing === "function") return external.getCreativePublishing();
      if (typeof external.getState === "function") {
        const state = external.getState();
        if (!state) return null;
        const activeProject = Array.isArray(state.projects) ? state.projects.find((item) => item.id === state.activeProjectId) || state.projects[0] : null;
        return state.creativePublishing || state.creative && state.creative.publishing || state.publishingIntelligence || activeProject && activeProject.analytics && activeProject.analytics.publishingIntelligence;
      }
      if (typeof external.getSection === "function") return external.getSection("creativePublishing");
    } catch (_) { /* fallback storage below */ }
    return null;
  }

  function persistExternalStore(external, state) {
    if (!external) return false;
    const snapshot = clone(state);
    try {
      if (typeof external.setCreativePublishing === "function") { external.setCreativePublishing(snapshot); return true; }
      if (typeof external.setSection === "function") { external.setSection("creativePublishing", snapshot); return true; }
      if (typeof external.setState === "function" && typeof external.getState === "function") { external.setState({ ...external.getState(), creativePublishing: snapshot }); return true; }
      if (typeof external.updateProject === "function" && typeof external.getState === "function") {
        const creativeState = external.getState();
        const project = Array.isArray(creativeState && creativeState.projects) ? creativeState.projects.find((item) => item.id === creativeState.activeProjectId) || creativeState.projects[0] : null;
        if (!project) return false;
        const statusMap = { queued: "scheduled", sending: "publishing", sent: "published", blocked: "failed", cancelled: "failed" };
        external.updateProject(project.id, {
          publishing: snapshot.queue.map((item) => ({
            id: item.id,
            platform: PLATFORM_LABELS[item.platform] || item.platform,
            title: item.title,
            scheduledAt: item.scheduledAt,
            status: statusMap[item.status] || item.status,
            url: item.remoteUrl,
            metadata: { creativePublishing: item }
          })),
          analytics: { ...(project.analytics || {}), publishingIntelligence: snapshot },
          rights: { ...(project.rights || {}), records: snapshot.rights, warnings: auditRights(snapshot.rights).issues, verified: auditRights(snapshot.rights).valid }
        });
        return true;
      }
      if (typeof external.dispatch === "function") { external.dispatch({ type: "creative/publishing/replace", payload: snapshot }); return true; }
    } catch (_) { return false; }
    return false;
  }

  function createStore(options) {
    const settings = options && typeof options === "object" ? options : {};
    const storage = Object.prototype.hasOwnProperty.call(settings, "storage") ? settings.storage : globalScope.localStorage;
    const external = settings.store || null;
    const adapters = settings.providerAdapters || {};
    let stored = null;
    try { stored = storage && JSON.parse(storage.getItem(STORAGE_KEY) || "null"); } catch (_) { stored = null; }
    let state = normalizeState(readExternalStore(external) || stored || defaultState(), adapters, settings.idFactory);
    const listeners = new Set();

    function persist() {
      state.updatedAt = new Date().toISOString();
      const snapshot = clone(state);
      try { if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); } catch (_) { /* memory state remains active */ }
      persistExternalStore(external, snapshot);
      listeners.forEach((listener) => { try { listener(clone(snapshot)); } catch (_) { /* listener isolation */ } });
      return snapshot;
    }

    function replace(next) { state = normalizeState(next, adapters, settings.idFactory); return persist(); }
    function getState() { return clone(state); }
    function subscribe(listener) { if (typeof listener !== "function") return () => {}; listeners.add(listener); return () => listeners.delete(listener); }
    function updateCollection(name, updater) { state[name] = updater([...state[name]]); return persist(); }

    function addPublication(input) {
      const item = normalizePublication(input, settings.idFactory);
      updateCollection("queue", (items) => [item, ...items.filter((current) => current.id !== item.id)].slice(0, MAX_QUEUE));
      return clone(item);
    }

    function updatePublication(id, patch) {
      let updated = null;
      updateCollection("queue", (items) => items.map((item) => {
        if (item.id !== id) return item;
        updated = normalizePublication({ ...item, ...patch, id: item.id, createdAt: item.createdAt, updatedAt: new Date().toISOString() }, settings.idFactory);
        return updated;
      }));
      if (!updated) throw makeError("PUBLICATION_NOT_FOUND", "Không tìm thấy mục xuất bản.");
      return clone(updated);
    }

    function enqueue(id, nowValue) {
      const item = state.queue.find((current) => current.id === id);
      if (!item) throw makeError("PUBLICATION_NOT_FOUND", "Không tìm thấy mục xuất bản.");
      const preflight = preflightPublication(item, { now: nowValue, allowLocalMedia: item.metadata.localMedia === true });
      if (!preflight.valid) throw makeError("PREFLIGHT_FAILED", preflight.errors[0].message);
      const future = item.scheduledAt && new Date(item.scheduledAt).getTime() > new Date(nowValue || Date.now()).getTime() + 60000;
      return updatePublication(id, { status: future ? "scheduled" : "queued", error: "" });
    }

    async function adapterConfigured(adapter) {
      if (!adapter) return false;
      if (typeof adapter.isConfigured === "function") return Boolean(await adapter.isConfigured());
      return adapter.configured === true;
    }

    async function processPublication(id, processOptions) {
      const item = state.queue.find((current) => current.id === id);
      if (!item) throw makeError("PUBLICATION_NOT_FOUND", "Không tìm thấy mục xuất bản.");
      if (["sent", "cancelled"].includes(item.status)) return { ok: false, code: "STATUS_LOCKED", item: clone(item) };
      const now = new Date(processOptions && processOptions.now || Date.now());
      if (item.scheduledAt && new Date(item.scheduledAt).getTime() > now.getTime() + 60000) return { ok: false, code: "NOT_DUE", item: clone(item) };
      const preflight = preflightPublication(item, { now, allowLocalMedia: item.metadata.localMedia === true });
      if (!preflight.valid) {
        const failed = updatePublication(id, { status: "failed", error: preflight.errors[0].message });
        return { ok: false, code: "PREFLIGHT_FAILED", item: failed, preflight };
      }
      const adapter = adapters[item.platform];
      if (!(await adapterConfigured(adapter))) {
        const blocked = updatePublication(id, { status: "blocked", error: `${PLATFORM_LABELS[item.platform]} chưa được cấu hình ở backend.` });
        return { ok: false, code: "ADAPTER_UNCONFIGURED", item: blocked };
      }
      updatePublication(id, { status: "sending", attempts: item.attempts + 1, error: "" });
      try {
        const sender = adapter.publish || adapter.send || adapter.enqueue;
        if (typeof sender !== "function") throw makeError("ADAPTER_INVALID", "Adapter không có phương thức xuất bản.");
        const result = await sender(clone(item));
        if (!result || result.confirmed !== true || !["sent", "published", "confirmed"].includes(result.status)) {
          const failed = updatePublication(id, { status: "failed", error: "Provider chưa xác nhận đã xuất bản; hệ thống không đánh dấu sent." });
          return { ok: false, code: "UNCONFIRMED", item: failed, result: sanitizeObject(result, 3) };
        }
        const sent = updatePublication(id, { status: "sent", confirmedAt: new Date().toISOString(), remoteId: result.remoteId || result.id, remoteUrl: result.remoteUrl || result.url, providerId: result.providerId || item.platform, error: "" });
        return { ok: true, code: "SENT", item: sent, result: sanitizeObject(result, 3) };
      } catch (error) {
        const failed = updatePublication(id, { status: "failed", error: cleanText(error && error.message, 600) || "Xuất bản thất bại." });
        return { ok: false, code: error && error.code || "PUBLISH_FAILED", item: failed };
      }
    }

    async function processDue(processOptions) {
      const now = new Date(processOptions && processOptions.now || Date.now()).getTime();
      const due = state.queue.filter((item) => ["queued", "scheduled", "failed", "blocked"].includes(item.status) && (!item.scheduledAt || new Date(item.scheduledAt).getTime() <= now + 60000));
      const results = [];
      for (const item of due) results.push(await processPublication(item.id, processOptions));
      return results;
    }

    function retryPublication(id) { return updatePublication(id, { status: "queued", error: "" }); }
    function cancelPublication(id) { return updatePublication(id, { status: "cancelled", error: "Đã hủy bởi người dùng." }); }
    function removePublication(id) { updateCollection("queue", (items) => items.filter((item) => item.id !== id)); return true; }
    function addAnalytics(records) { const list = (Array.isArray(records) ? records : [records]).map((item) => normalizeAnalytics(item, settings.idFactory)); updateCollection("analytics", (items) => [...list, ...items].slice(0, MAX_ANALYTICS)); return clone(list); }
    function clearAnalytics() { state.analytics = []; return persist(); }
    function addRightsAsset(input) { const asset = normalizeRightsAsset(input, settings.idFactory); updateCollection("rights", (items) => [asset, ...items.filter((item) => item.id !== asset.id)].slice(0, MAX_RIGHTS)); return clone(asset); }
    function removeRightsAsset(id) { updateCollection("rights", (items) => items.filter((item) => item.id !== id)); return true; }
    function setProvider(input) { const adapter = adapters[input && input.id]; const provider = normalizeProvider(input, adapter, settings.idFactory); updateCollection("providers", (items) => [provider, ...items.filter((item) => item.id !== provider.id)].slice(0, MAX_PROVIDERS)); return clone(provider); }
    function recordProviderUsage(id, usage) {
      const current = state.providers.find((item) => item.id === id);
      if (!current) throw makeError("PROVIDER_NOT_FOUND", "Không tìm thấy provider.");
      return setProvider({ ...current, inputTokens: current.inputTokens + Math.floor(clamp(usage && usage.inputTokens, 0, 1e12)), outputTokens: current.outputTokens + Math.floor(clamp(usage && usage.outputTokens, 0, 1e12)), credits: current.credits + clamp(usage && usage.credits, 0, 1e12), quotaUsed: current.quotaUsed + clamp(usage && usage.quota, 0, 1e12), avgLatencyMs: usage && usage.latencyMs == null ? current.avgLatencyMs : clamp(usage.latencyMs, 0, 1e9), errorRate: usage && usage.errorRate == null ? current.errorRate : clamp(usage.errorRate, 0, 1), lastError: usage && usage.error || current.lastError });
    }
    function updateSettings(patch) { state.settings = normalizeState({ settings: { ...state.settings, ...patch } }, {}, settings.idFactory).settings; return persist(); }

    return Object.freeze({ getState, replace, subscribe, addPublication, updatePublication, enqueue, processPublication, processDue, retryPublication, cancelPublication, removePublication, addAnalytics, clearAnalytics, addRightsAsset, removeRightsAsset, setProvider, recordProviderUsage, updateSettings, preflight: (id, opts) => preflightPublication(state.queue.find((item) => item.id === id), opts), auditRights: (opts) => auditRights(state.rights, opts), evaluateExperiment: (opts) => evaluateExperiment(state.analytics, { ...state.settings, ...opts }), chooseProvider: (mode, opts) => chooseProvider(state.providers, mode || state.settings.routeMode, opts), exportRightsManifest: (opts) => exportRightsManifest(state.rights, opts) });
  }

  function formatNumber(value) { return Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 }); }
  function formatPercent(value) { return `${(Number(value || 0) * 100).toFixed(1)}%`; }
  function formatDate(value) { if (!value) return "Chưa đặt"; const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleString("vi-VN") : "Không hợp lệ"; }

  function tabsMarkup(active) {
    const labels = { publishing: "Lịch xuất bản", analytics: "Analytics", rights: "Quyền tài sản", providers: "Provider Router" };
    return `<nav class="cp-tabs" role="tablist" aria-label="Publishing & Intelligence">${VIEWS.map((view) => `<button type="button" role="tab" aria-selected="${view === active}" tabindex="${view === active ? "0" : "-1"}" data-cp-view="${view}"><span>${escapeHtml(labels[view])}</span></button>`).join("")}</nav>`;
  }

  function headerMarkup(state, view) {
    const due = state.queue.filter((item) => ["queued", "scheduled"].includes(item.status)).length;
    const rights = auditRights(state.rights);
    const connected = state.providers.filter((item) => providerAvailable(item, null)).length;
    return `<header class="cp-hero"><div><p class="cp-eyebrow">CREATIVE OS · PUBLISHING & INTELLIGENCE</p><h2>Xuất bản có kiểm soát, quyết định bằng dữ liệu</h2><p>Quản lý lịch đa nền tảng, kiểm chứng A/B test, truy vết bản quyền và định tuyến AI mà không đưa khóa bí mật xuống frontend.</p></div><div class="cp-hero-stats"><span><b>${due}</b><small>Đang chờ</small></span><span><b>${state.analytics.length}</b><small>Mẫu đo</small></span><span><b>${rights.valid ? "OK" : rights.errorCount}</b><small>Quyền lỗi</small></span><span><b>${connected}</b><small>Provider sẵn sàng</small></span></div></header>${tabsMarkup(view)}`;
  }

  function queueCard(item) {
    const preflight = preflightPublication(item, { allowLocalMedia: item.metadata.localMedia === true, now: Date.now() });
    const retry = ["failed", "blocked"].includes(item.status);
    return `<article class="cp-queue-card is-${item.status}" data-cp-publication="${escapeHtml(item.id)}"><div class="cp-platform-mark">${escapeHtml(item.platform.slice(0, 2).toUpperCase())}</div><div class="cp-queue-copy"><div><strong>${escapeHtml(item.title || "Chưa có tiêu đề")}</strong><span class="cp-status is-${item.status}">${escapeHtml(item.status)}</span></div><p>${escapeHtml(PLATFORM_LABELS[item.platform])} · ${escapeHtml(formatDate(item.scheduledAt))} · ${escapeHtml(item.visibility)}</p>${item.error ? `<small class="cp-error">${escapeHtml(item.error)}</small>` : `<small>${preflight.errors.length ? `${preflight.errors.length} lỗi` : "Preflight đạt"} · ${preflight.warnings.length} cảnh báo · ${preflight.score}/100</small>`}</div><div class="cp-row-actions">${retry ? `<button type="button" data-cp-retry="${escapeHtml(item.id)}">Thử lại</button>` : ""}${!["sent", "cancelled"].includes(item.status) ? `<button type="button" data-cp-send="${escapeHtml(item.id)}">${item.status === "scheduled" ? "Chạy khi đến hạn" : "Gửi"}</button><button type="button" data-cp-cancel="${escapeHtml(item.id)}">Hủy</button>` : ""}<button type="button" data-cp-remove="${escapeHtml(item.id)}" aria-label="Xóa khỏi danh sách">×</button></div></article>`;
  }

  function publishingMarkup(state) {
    return `<section class="cp-workspace" data-cp-publishing><div class="cp-toolbar"><div><span>Publishing Calendar</span><strong>Hàng đợi đa nền tảng</strong></div><button class="cp-primary" type="button" data-cp-process-due>Chạy các mục đến hạn</button></div><div class="cp-publishing-grid"><form class="cp-panel cp-form" data-cp-publish-form><div class="cp-panel-head"><div><small>TẠO LỊCH</small><h3>Nội dung xuất bản</h3></div><span>Chỉ gửi khi adapter backend xác nhận</span></div><div class="cp-form-grid"><label>Nền tảng<select name="platform">${PLATFORMS.map((platform) => `<option value="${platform}">${PLATFORM_LABELS[platform]}</option>`).join("")}</select></label><label>Ngày giờ<input type="datetime-local" name="scheduledAt" required></label><label class="is-wide">Tiêu đề<input name="title" maxlength="255" required placeholder="Tên nội dung"></label><label class="is-wide">Mô tả<textarea name="description" rows="4" placeholder="Mô tả, CTA và ghi chú..."></textarea></label><label>URL media<input name="mediaUrl" type="url" placeholder="https://..."></label><label>Thumbnail<input name="thumbnailUrl" type="url" placeholder="https://..."></label><label>Playlist<input name="playlist" placeholder="Tên playlist"></label><label>Quyền xem<select name="visibility"><option value="private">Riêng tư</option><option value="unlisted">Không công khai</option><option value="public">Công khai</option></select></label><label class="is-wide">Tags<input name="tags" placeholder="creative, video, campaign"></label></div><div class="cp-form-actions"><button type="submit" name="intent" value="draft">Lưu nháp</button><button class="cp-primary" type="submit" name="intent" value="schedule">Kiểm tra và xếp lịch</button></div></form><aside class="cp-panel cp-preflight"><div class="cp-panel-head"><div><small>PRE-FLIGHT</small><h3>Điều kiện xuất bản</h3></div><span data-cp-preflight-score>0/100</span></div><ul data-cp-preflight-list><li>Nhập nội dung để kiểm tra tiêu đề, media, lịch, thumbnail và quyền.</li></ul><div class="cp-signal"><i></i><span>Provider chỉ được cấu hình ở backend</span></div></aside></div><div class="cp-panel cp-queue"><div class="cp-panel-head"><div><small>QUEUE</small><h3>Lịch và trạng thái</h3></div><span>${state.queue.length}/${MAX_QUEUE} mục</span></div><div class="cp-queue-list" data-cp-queue>${state.queue.length ? state.queue.map(queueCard).join("") : `<div class="cp-empty"><b>Chưa có lịch xuất bản</b><span>Tạo nháp hoặc xếp lịch để bắt đầu.</span></div>`}</div></div></section>`;
  }

  function analyticsSvg(records) {
    const variants = aggregateVariants(records);
    const width = 720;
    const height = 250;
    if (!variants.length) return `<svg class="cp-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Chưa có dữ liệu analytics"><text x="360" y="130" text-anchor="middle">Nhập CSV hoặc JSON để tạo biểu đồ</text></svg>`;
    const maxValue = Math.max(0.01, ...variants.map((item) => Math.max(item.ctr, item.retention)));
    const groupWidth = 620 / variants.length;
    const bars = variants.map((item, index) => {
      const x = 58 + index * groupWidth;
      const ctrHeight = item.ctr / maxValue * 155;
      const retentionHeight = item.retention / maxValue * 155;
      return `<g><rect x="${x}" y="${205 - ctrHeight}" width="${Math.max(12, groupWidth * 0.25)}" height="${ctrHeight}" rx="4" class="is-ctr"><title>${escapeHtml(item.variant)} CTR ${escapeHtml(formatPercent(item.ctr))}</title></rect><rect x="${x + groupWidth * 0.3}" y="${205 - retentionHeight}" width="${Math.max(12, groupWidth * 0.25)}" height="${retentionHeight}" rx="4" class="is-retention"><title>${escapeHtml(item.variant)} retention ${escapeHtml(formatPercent(item.retention))}</title></rect><text x="${x + groupWidth * 0.25}" y="228" text-anchor="middle">${escapeHtml(item.variant)}</text></g>`;
    }).join("");
    return `<svg class="cp-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Biểu đồ CTR và retention"><line x1="42" y1="205" x2="700" y2="205"></line>${bars}</svg>`;
  }

  function analyticsMarkup(state) {
    const evaluation = evaluateExperiment(state.analytics, { ...state.settings, metric: state.settings.analyticsMetric });
    const variants = aggregateVariants(state.analytics);
    return `<section class="cp-workspace" data-cp-analytics><div class="cp-toolbar"><div><span>Creative Analytics</span><strong>Đo phiên bản, không phỏng đoán</strong></div><button type="button" data-cp-clear-analytics>Xóa dữ liệu đo</button></div><div class="cp-analytics-grid"><section class="cp-panel cp-chart"><div class="cp-panel-head"><div><small>A/B SIGNAL</small><h3>CTR & Retention</h3></div><div class="cp-legend"><span class="is-ctr">CTR</span><span class="is-retention">Retention</span></div></div>${analyticsSvg(state.analytics)}<canvas data-cp-chart width="720" height="250" aria-label="Biểu đồ analytics Canvas"></canvas></section><aside class="cp-panel cp-decision"><div class="cp-panel-head"><div><small>DECISION GATE</small><h3>Kết luận thống kê</h3></div><span>${escapeHtml((evaluation.confidence * 100).toFixed(1))}%</span></div><div class="cp-decision-state is-${evaluation.status}"><b>${evaluation.winner ? `Phiên bản ${escapeHtml(evaluation.winner)}` : "Chưa có phiên bản thắng"}</b><p>${escapeHtml(evaluation.message)}</p></div><label>Sample tối thiểu<input type="number" min="30" max="1000000000" value="${state.settings.minimumSample}" data-cp-minimum-sample></label><label>Chỉ số<select data-cp-metric><option value="ctr" ${state.settings.analyticsMetric === "ctr" ? "selected" : ""}>CTR</option><option value="retention" ${state.settings.analyticsMetric === "retention" ? "selected" : ""}>Retention</option></select></label></aside></div><div class="cp-panel cp-import"><div class="cp-panel-head"><div><small>DATA IN</small><h3>Nhập CSV / JSON</h3></div><label class="cp-file-button">Chọn tệp<input type="file" accept=".csv,.json,text/csv,application/json" data-cp-analytics-file></label></div><form data-cp-analytics-form><textarea name="payload" rows="6" spellcheck="false" placeholder='[{"experimentId":"launch","variant":"A","impressions":3000,"clicks":180,"views":160,"retention":0.52}]'></textarea><select name="format"><option value="json">JSON</option><option value="csv">CSV</option></select><button class="cp-primary" type="submit">Nhập dữ liệu</button></form></div><div class="cp-panel cp-table-wrap"><table><thead><tr><th>Phiên bản</th><th>Tiêu đề / Hook</th><th>Impressions</th><th>Views</th><th>CTR</th><th>Retention</th></tr></thead><tbody>${variants.length ? variants.map((item) => `<tr><td><b>${escapeHtml(item.variant)}</b></td><td>${escapeHtml(item.title || item.hook || "Chưa có mô tả")}</td><td>${formatNumber(item.impressions)}</td><td>${formatNumber(item.views)}</td><td>${formatPercent(item.ctr)}</td><td>${formatPercent(item.retention)}</td></tr>`).join("") : `<tr><td colspan="6">Chưa có dữ liệu.</td></tr>`}</tbody></table></div></section>`;
  }

  function rightsMarkup(state) {
    const audit = auditRights(state.rights);
    return `<section class="cp-workspace" data-cp-rights><div class="cp-toolbar"><div><span>Rights & Provenance</span><strong>Biết rõ mỗi asset đến từ đâu</strong></div><button class="cp-primary" type="button" data-cp-export-rights>Xuất manifest</button></div><div class="cp-rights-grid"><form class="cp-panel cp-form" data-cp-rights-form><div class="cp-panel-head"><div><small>ASSET RECORD</small><h3>Thêm nguồn gốc</h3></div><span>Local-first</span></div><div class="cp-form-grid"><label>Tên asset<input name="name" required placeholder="Thumbnail launch"></label><label>Loại<input name="type" placeholder="image / video / audio"></label><label>Nguồn<input name="sourceUrl" type="url" placeholder="https://..."></label><label>Giấy phép<select name="license">${LICENSES.map((license) => `<option value="${license}">${license}</option>`).join("")}</select></label><label>Người tạo<input name="creator" placeholder="Tên tác giả"></label><label>Chứng từ<input name="proofUrl" type="url" placeholder="https://..."></label><label>AI model<input name="aiModel" placeholder="Tên model, nếu có"></label><label>Hết hạn<input name="expiresAt" type="date"></label><label class="is-wide">Prompt nguồn gốc<textarea name="prompt" rows="3" placeholder="Prompt đã dùng, nếu asset do AI tạo"></textarea></label><label class="is-wide">Phạm vi sử dụng<input name="usage" placeholder="YouTube, social, commercial..."></label></div><button class="cp-primary" type="submit">Lưu hồ sơ asset</button></form><aside class="cp-panel cp-audit"><div class="cp-score-ring" style="--score:${audit.score}"><strong>${audit.score}</strong><span>Rights score</span></div><dl><div><dt>Assets</dt><dd>${audit.assets.length}</dd></div><div><dt>Lỗi</dt><dd>${audit.errorCount}</dd></div><div><dt>Cảnh báo</dt><dd>${audit.warningCount}</dd></div></dl><div class="cp-issue-list">${audit.issues.length ? audit.issues.slice(0, 12).map((issue) => `<p class="is-${issue.level}"><b>${escapeHtml(issue.code)}</b>${escapeHtml(issue.message)}</p>`).join("") : `<p class="is-ok"><b>READY</b>Không phát hiện vấn đề quyền sử dụng.</p>`}</div></aside></div><div class="cp-panel cp-assets"><div class="cp-panel-head"><div><small>PROVENANCE LEDGER</small><h3>Tài sản đã ghi nhận</h3></div><span>${state.rights.length}/${MAX_RIGHTS}</span></div><div class="cp-asset-list">${state.rights.length ? state.rights.map((asset) => `<article><span class="cp-license">${escapeHtml(asset.license)}</span><div><strong>${escapeHtml(asset.name)}</strong><p>${escapeHtml(asset.creator || "Chưa rõ tác giả")} · ${escapeHtml(asset.type)} · ${escapeHtml(formatDate(asset.createdAt))}</p></div><button type="button" data-cp-remove-rights="${escapeHtml(asset.id)}" aria-label="Xóa hồ sơ ${escapeHtml(asset.name)}">×</button></article>`).join("") : `<div class="cp-empty"><b>Chưa có hồ sơ nguồn gốc</b><span>Thêm asset để chạy kiểm tra quyền sử dụng.</span></div>`}</div></div></section>`;
  }

  function providersMarkup(state) {
    const decision = chooseProvider(state.providers, state.settings.routeMode);
    return `<section class="cp-workspace" data-cp-providers><div class="cp-toolbar"><div><span>AI Cost & Provider Router</span><strong>Định tuyến rõ ràng, không lộ khóa</strong></div><div class="cp-mode"><label>Chế độ<select data-cp-route-mode><option value="balanced" ${state.settings.routeMode === "balanced" ? "selected" : ""}>Cân bằng</option><option value="fast" ${state.settings.routeMode === "fast" ? "selected" : ""}>Nhanh</option><option value="quality" ${state.settings.routeMode === "quality" ? "selected" : ""}>Chất lượng</option></select></label></div></div><section class="cp-router-decision"><div class="cp-route-orbit"><i></i><span>${decision.provider ? escapeHtml(decision.provider.label.slice(0, 3).toUpperCase()) : "--"}</span></div><div><small>ĐỀ XUẤT DETERMINISTIC</small><h3>${decision.provider ? escapeHtml(decision.provider.label) : "Chưa có provider khả dụng"}</h3><p>${escapeHtml(decision.reason)}</p></div><dl><div><dt>Mode</dt><dd>${escapeHtml(decision.mode)}</dd></div><div><dt>Score</dt><dd>${decision.score}</dd></div><div><dt>Provider</dt><dd>${state.providers.length}</dd></div></dl></section><div class="cp-provider-grid">${state.providers.length ? state.providers.map((provider) => { const available = providerAvailable(provider, state.settings.routeMode); const quota = provider.quotaLimit ? provider.quotaUsed / provider.quotaLimit : 0; return `<article class="cp-provider-card ${available ? "is-ready" : "is-unavailable"}"><header><div class="cp-provider-icon">${escapeHtml(provider.label.slice(0, 2).toUpperCase())}</div><div><strong>${escapeHtml(provider.label)}</strong><span>${escapeHtml(provider.status)}</span></div><i title="${available ? "Sẵn sàng" : "Không khả dụng"}"></i></header><div class="cp-provider-metrics"><span><b>${formatNumber(provider.avgLatencyMs)}ms</b><small>Latency</small></span><span><b>${formatPercent(provider.errorRate)}</b><small>Error</small></span><span><b>${formatNumber(provider.inputTokens + provider.outputTokens)}</b><small>Tokens</small></span><span><b>${formatNumber(provider.credits)}</b><small>Credits</small></span></div><div class="cp-quota"><span style="width:${clamp(quota * 100, 0, 100)}%"></span></div><footer><span>${provider.quotaLimit ? `${formatNumber(provider.quotaUsed)} / ${formatNumber(provider.quotaLimit)}` : "Không đặt quota"}</span><span>${provider.cooldownUntil ? `Cooldown: ${escapeHtml(formatDate(provider.cooldownUntil))}` : "Không cooldown"}</span></footer></article>`; }).join("") : `<div class="cp-empty"><b>Chưa có adapter backend</b><span>Module chỉ hiển thị trạng thái. Hãy cấu hình provider ở server rồi truyền providerAdapters khi mount.</span></div>`}</div><div class="cp-security-note"><b>Ranh giới bảo mật</b><p>Frontend chỉ nhận trạng thái, quota và số liệu sử dụng. Mật khẩu, khóa dịch vụ và credential phải nằm trong biến môi trường của backend.</p></div></section>`;
  }

  function renderViewMarkup(view, stateInput) {
    const active = VIEWS.includes(view) ? view : "publishing";
    const state = normalizeState(stateInput || defaultState());
    const body = active === "analytics" ? analyticsMarkup(state) : active === "rights" ? rightsMarkup(state) : active === "providers" ? providersMarkup(state) : publishingMarkup(state);
    return `<div class="cp-shell" data-cp-shell data-cp-active-view="${active}">${headerMarkup(state, active)}${body}<div class="cp-live" role="status" aria-live="polite" data-cp-live></div></div>`;
  }

  function drawAnalyticsCanvas(canvas, records) {
    if (!canvas || typeof canvas.getContext !== "function") return { supported: false, reason: "Canvas 2D không khả dụng." };
    const context = canvas.getContext("2d");
    if (!context) return { supported: false, reason: "Canvas 2D không khả dụng." };
    const variants = aggregateVariants(records);
    const width = canvas.width || 720;
    const height = canvas.height || 250;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#0b131d";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(159, 183, 204, .24)";
    context.beginPath(); context.moveTo(40, height - 40); context.lineTo(width - 20, height - 40); context.stroke();
    if (!variants.length) { context.fillStyle = "#93a4b7"; context.font = "14px system-ui"; context.textAlign = "center"; context.fillText("Chưa có dữ liệu", width / 2, height / 2); return { supported: true, variants: 0 }; }
    const max = Math.max(0.01, ...variants.map((item) => Math.max(item.ctr, item.retention)));
    const slot = (width - 80) / variants.length;
    variants.forEach((item, index) => {
      const x = 54 + index * slot;
      const ctrHeight = item.ctr / max * (height - 90);
      const retentionHeight = item.retention / max * (height - 90);
      context.fillStyle = "#56d8e5"; context.fillRect(x, height - 40 - ctrHeight, Math.max(10, slot * 0.25), ctrHeight);
      context.fillStyle = "#f36cbd"; context.fillRect(x + slot * 0.3, height - 40 - retentionHeight, Math.max(10, slot * 0.25), retentionHeight);
      context.fillStyle = "#c7d3df"; context.font = "12px system-ui"; context.textAlign = "center"; context.fillText(item.variant, x + slot * 0.25, height - 16);
    });
    return { supported: true, variants: variants.length };
  }

  function downloadText(name, content, type) {
    if (!globalScope.document || !globalScope.URL || typeof globalScope.URL.createObjectURL !== "function" || typeof globalScope.Blob !== "function") return false;
    const url = globalScope.URL.createObjectURL(new globalScope.Blob([content], { type: type || "application/json;charset=utf-8" }));
    const anchor = globalScope.document.createElement("a");
    anchor.href = url; anchor.download = name; anchor.click();
    setTimeout(() => globalScope.URL.revokeObjectURL(url), 1000);
    return true;
  }

  function mount(target, options) {
    const root = typeof target === "string" ? globalScope.document && globalScope.document.querySelector(target) : target;
    if (!root || typeof root.addEventListener !== "function") throw makeError("ROOT_REQUIRED", "Cần phần tử gốc để mount Publishing & Intelligence.");
    unmount(root);
    const settings = options && typeof options === "object" ? options : {};
    const store = settings.store && typeof settings.store.addPublication === "function" ? settings.store : createStore({ store: settings.store, providerAdapters: settings.providerAdapters, storage: Object.prototype.hasOwnProperty.call(settings, "storage") ? settings.storage : globalScope.localStorage, idFactory: settings.idFactory });
    let view = VIEWS.includes(settings.view) ? settings.view : "publishing";
    const listeners = [];
    const on = (node, event, handler) => { node.addEventListener(event, handler); listeners.push(() => node.removeEventListener(event, handler)); };
    const say = (message, tone) => { const live = root.querySelector("[data-cp-live]"); if (live) { live.textContent = message; live.dataset.tone = tone || "info"; } };

    function render() {
      const active = globalScope.document && globalScope.document.activeElement && globalScope.document.activeElement.dataset && globalScope.document.activeElement.dataset.cpView;
      root.setAttribute("data-creative-publishing", "");
      root.innerHTML = renderViewMarkup(view, store.getState());
      if (view === "analytics") drawAnalyticsCanvas(root.querySelector("[data-cp-chart]"), store.getState().analytics);
      if (active) root.querySelector(`[data-cp-view="${active}"]`)?.focus();
    }

    function navigate(next) {
      if (!VIEWS.includes(next)) return;
      if (typeof settings.onNavigate === "function") settings.onNavigate(next);
      view = next;
      render();
    }

    function updatePreflight(form) {
      if (!form) return;
      const data = Object.fromEntries(new globalScope.FormData(form).entries());
      data.tags = cleanText(data.tags, 1000).split(",").map((item) => item.trim()).filter(Boolean);
      data.scheduledAt = data.scheduledAt ? isoDate(data.scheduledAt, "") : "";
      const result = preflightPublication(data, { now: Date.now() });
      const score = root.querySelector("[data-cp-preflight-score]");
      const list = root.querySelector("[data-cp-preflight-list]");
      if (score) score.textContent = `${result.score}/100`;
      if (list) list.innerHTML = [...result.errors, ...result.warnings].length ? [...result.errors, ...result.warnings].map((item) => `<li class="${result.errors.includes(item) ? "is-error" : "is-warning"}">${escapeHtml(item.message)}</li>`).join("") : `<li class="is-ok">Sẵn sàng đưa vào hàng đợi.</li>`;
      return result;
    }

    on(root, "click", async (event) => {
      const button = event.target.closest("button");
      if (!button || !root.contains(button)) return;
      if (button.dataset.cpView) return navigate(button.dataset.cpView);
      try {
        if (button.dataset.cpSend) {
          button.disabled = true;
          const result = await store.processPublication(button.dataset.cpSend);
          render(); say(result.ok ? "Provider đã xác nhận xuất bản thành công." : result.item && result.item.error || "Chưa thể xuất bản.", result.ok ? "success" : "warning");
        } else if (button.dataset.cpRetry) { store.retryPublication(button.dataset.cpRetry); render(); say("Đã đưa mục trở lại hàng đợi."); }
        else if (button.dataset.cpCancel) { store.cancelPublication(button.dataset.cpCancel); render(); say("Đã hủy mục xuất bản."); }
        else if (button.dataset.cpRemove) { store.removePublication(button.dataset.cpRemove); render(); }
        else if (button.dataset.cpRemoveRights) { store.removeRightsAsset(button.dataset.cpRemoveRights); render(); }
        else if (button.hasAttribute("data-cp-process-due")) { button.disabled = true; const results = await store.processDue(); render(); say(`Đã xử lý ${results.length} mục đến hạn.`); }
        else if (button.hasAttribute("data-cp-clear-analytics")) { store.clearAnalytics(); render(); say("Đã xóa dữ liệu analytics cục bộ."); }
        else if (button.hasAttribute("data-cp-export-rights")) { const ok = downloadText("hh-rights-manifest.json", store.exportRightsManifest()); say(ok ? "Đã xuất rights manifest." : "Trình duyệt không hỗ trợ tải tệp.", ok ? "success" : "warning"); }
      } catch (error) { render(); say(cleanText(error.message, 400) || "Không thể hoàn thành tác vụ.", "error"); }
    });

    on(root, "submit", (event) => {
      event.preventDefault();
      if (event.target.matches("[data-cp-publish-form]")) {
        const submitter = event.submitter;
        const data = Object.fromEntries(new globalScope.FormData(event.target).entries());
        data.tags = cleanText(data.tags, 1000).split(",").map((item) => item.trim()).filter(Boolean);
        data.scheduledAt = data.scheduledAt ? isoDate(data.scheduledAt, "") : "";
        try {
          const item = store.addPublication(data);
          if (submitter && submitter.value === "schedule") store.enqueue(item.id);
          render(); say(submitter && submitter.value === "schedule" ? "Đã kiểm tra và xếp lịch." : "Đã lưu bản nháp.", "success");
        } catch (error) { say(cleanText(error.message, 400), "error"); }
      } else if (event.target.matches("[data-cp-analytics-form]")) {
        const data = new globalScope.FormData(event.target);
        const result = parseAnalyticsImport(data.get("payload"), data.get("format"));
        if (!result.valid) return say(result.errors[0].message, "error");
        store.addAnalytics(result.records); render(); say(`Đã nhập ${result.records.length} mẫu analytics.`, "success");
      } else if (event.target.matches("[data-cp-rights-form]")) {
        const data = Object.fromEntries(new globalScope.FormData(event.target).entries());
        if (data.expiresAt) data.expiresAt = isoDate(`${data.expiresAt}T23:59:59`, "");
        store.addRightsAsset(data); render(); say("Đã lưu hồ sơ nguồn gốc asset.", "success");
      }
    });

    on(root, "input", (event) => { if (event.target.closest("[data-cp-publish-form]")) updatePreflight(event.target.closest("form")); });
    on(root, "change", (event) => {
      if (event.target.matches("[data-cp-route-mode]")) { store.updateSettings({ routeMode: event.target.value }); render(); }
      else if (event.target.matches("[data-cp-minimum-sample]")) { store.updateSettings({ minimumSample: event.target.value }); render(); }
      else if (event.target.matches("[data-cp-metric]")) { store.updateSettings({ analyticsMetric: event.target.value }); render(); }
      else if (event.target.matches("[data-cp-analytics-file]")) {
        const file = event.target.files && event.target.files[0];
        if (!file || typeof globalScope.FileReader !== "function") return say("Trình duyệt không hỗ trợ đọc tệp cục bộ.", "warning");
        if (file.size > 5 * 1024 * 1024) return say("Tệp vượt giới hạn 5 MB.", "warning");
        const reader = new globalScope.FileReader();
        reader.onload = () => { const result = parseAnalyticsImport(String(reader.result || ""), /\.csv$/i.test(file.name) ? "csv" : "json"); if (!result.valid) return say(result.errors[0].message, "error"); store.addAnalytics(result.records); render(); say(`Đã nhập ${result.records.length} mẫu từ ${file.name}.`, "success"); };
        reader.onerror = () => say("Không thể đọc tệp đã chọn.", "error");
        reader.readAsText(file); event.target.value = "";
      }
    });

    on(root, "keydown", (event) => {
      const tab = event.target.closest("[data-cp-view]");
      if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const current = VIEWS.indexOf(tab.dataset.cpView);
      const next = event.key === "Home" ? 0 : event.key === "End" ? VIEWS.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + VIEWS.length) % VIEWS.length;
      navigate(VIEWS[next]);
      root.querySelector(`[data-cp-view="${VIEWS[next]}"]`)?.focus();
    });

    const unsubscribe = typeof store.subscribe === "function" ? store.subscribe(() => {}) : () => {};
    render();
    const instanceApi = Object.freeze({ getView: () => view, setView: (next) => navigate(next), getState: store.getState, store, refresh: render });
    mounted.set(root, { api: instanceApi, cleanup: () => { listeners.splice(0).forEach((off) => off()); unsubscribe(); } });
    activeRoots.add(root);
    return instanceApi;
  }

  function unmount(target) {
    if (target == null) {
      let removed = false;
      [...activeRoots].forEach((root) => { removed = unmount(root) || removed; });
      return removed;
    }
    const root = typeof target === "string" ? globalScope.document && globalScope.document.querySelector(target) : target;
    const instance = root && mounted.get(root);
    if (!instance) return false;
    instance.cleanup();
    mounted.delete(root);
    activeRoots.delete(root);
    root.removeAttribute("data-creative-publishing");
    root.innerHTML = "";
    return true;
  }

  const api = Object.freeze({
    VERSION, FORMAT, STORAGE_KEY, MAX_QUEUE, MAX_ANALYTICS, MAX_RIGHTS, VIEWS, PLATFORMS, PLATFORM_LABELS, PLATFORM_RULES, LICENSES, QUEUE_STATUSES,
    clone, escapeHtml, cleanText, clamp, safeUrl, sanitizeObject, normalizePublication, validateSchedule, preflightPublication,
    normalizeAnalytics, ctr, aggregateVariants, evaluateExperiment, parseCsv, parseAnalyticsImport,
    normalizeRightsAsset, auditRights, exportRightsManifest, normalizeProvider, providerAvailable, chooseProvider,
    defaultState, normalizeState, createStore, analyticsSvg, drawAnalyticsCanvas, renderViewMarkup, mount, unmount
  });

  globalScope.HHCreativePublishing = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
