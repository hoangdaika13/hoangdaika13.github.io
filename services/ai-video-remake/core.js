const { createHash } = require("node:crypto");

const MODES = Object.freeze(["text-to-video", "video-remix", "character-replace"]);
const ACTIONS = Object.freeze([
  "capabilities",
  "estimate",
  "estimate-analysis",
  "analyze",
  "create-job",
  "status",
  "pause",
  "resume",
  "retry",
  "cancel",
  "download"
]);
const ACTIVE_STATUSES = new Set(["queued", "dispatching", "submitted", "running", "pause-requested", "cancel-requested"]);
const TERMINAL_STATUSES = new Set(["completed", "failed", "canceled"]);
const WORKER_MODES = new Set(["text-to-video", "video-remix", "character-replace", "analyze"]);
const BLOCKED_FIELD = /(?:api[-_]?key|authorization|cookie|password|secret|token|credential|private[-_]?key|session)/i;
const PROTOTYPE_FIELD = new Set(["__proto__", "prototype", "constructor"]);

function apiError(message, statusCode = 400, code = "AI_VIDEO_REQUEST_INVALID") {
  return Object.assign(new Error(redactMessage(message)), { statusCode, code });
}

function text(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

function redactMessage(value, max = 700) {
  return text(value, max)
    .replace(/https?:\/\/[^\s"']+/gi, "[private-url-redacted]")
    .replace(/(bearer\s+|(?:api[-_]?key|token|secret|password|authorization)[=:]\s*)[^\s,;]+/gi, "$1[redacted]");
}

function numberInRange(value, fallback, min, max) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(min, Math.min(max, numeric)) : fallback;
}

function uniqueStrings(values, limit = 12, maxLength = 80) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => text(value, maxLength)).filter(Boolean))].slice(0, limit);
}

function normalizeAction(value) {
  const action = text(value || "capabilities", 40).toLowerCase();
  if (!ACTIONS.includes(action)) throw apiError("Tác vụ AI Video Remake không được hỗ trợ.", 400, "ACTION_UNSUPPORTED");
  return action;
}

function canonicalStatus(value) {
  const status = text(value, 40).toLowerCase();
  return status === "cancelled" ? "canceled" : status;
}

function normalizeMode(value) {
  const mode = text(value, 40).toLowerCase();
  if (!MODES.includes(mode)) throw apiError("Chế độ tạo video không hợp lệ.", 400, "MODE_INVALID");
  return mode;
}

function normalizeControls(input = {}) {
  return {
    preserveMotion: numberInRange(input.preserveMotion, 85, 0, 100),
    preserveCamera: numberInRange(input.preserveCamera, 85, 0, 100),
    preserveBackground: numberInRange(input.preserveBackground, 50, 0, 100),
    characterSimilarity: numberInRange(input.characterSimilarity ?? input.identityStrength, 90, 0, 100),
    creativity: numberInRange(input.creativity, 45, 0, 100),
    preserveAudio: input.preserveAudio !== false,
    preserveDialogue: input.preserveDialogue !== false
  };
}

function normalizeRenderRequest(body = {}) {
  const mode = normalizeMode(body.mode);
  const prompt = text(body.prompt || body.requirement, 6000);
  if (!prompt) throw apiError("Hãy nhập yêu cầu tạo hoặc chỉnh video.", 400, "PROMPT_REQUIRED");

  const durationValue = Math.round(numberInRange(body.durationSeconds, 8, 4, 10));
  const durationSeconds = [4, 6, 8, 10].reduce((best, value) => (
    Math.abs(value - durationValue) < Math.abs(best - durationValue) ? value : best
  ), 8);
  const aspectRatio = ["16:9", "9:16", "1:1"].includes(body.aspectRatio) ? body.aspectRatio : "16:9";
  const resolution = ["720p", "1080p", "4k"].includes(text(body.resolution, 12).toLowerCase())
    ? text(body.resolution, 12).toLowerCase()
    : "720p";
  const sourceAssetId = text(body.sourceAssetId, 80);
  const characterAssetIds = uniqueStrings(body.characterAssetIds, 8, 80);
  const referenceAssetIds = uniqueStrings(body.referenceAssetIds, 8, 80);
  const audioAssetId = text(body.audioAssetId, 80);
  const mediaProjectId = text(body.mediaProjectId, 80);
  const modelIntent = text(body.modelId || body.model || body.requestedModel, 100).toLowerCase();
  const providerAlias = {
    "server-veo": "veo",
    "server-worker": "worker",
    "server-local-wan": "wan2.2",
    auto: "auto"
  }[modelIntent];
  if (modelIntent === "server-director") {
    throw apiError("AI Director dùng action=analyze, không phải create-job render.", 422, "DIRECTOR_MODEL_NOT_RENDERABLE");
  }
  const rawProvider = text(body.provider || body.requestedProvider, 32).toLowerCase();
  const requestedProvider = providerAlias && (!rawProvider || rawProvider === "auto")
    ? providerAlias
    : (["auto", "veo", "worker", "gemini-omni", "wan2.2"].includes(rawProvider) ? rawProvider : (providerAlias || "auto"));
  const sourceStartSeconds = numberInRange(
    body.sourceStartSeconds ?? body.sourceRange?.startSeconds ?? body.controls?.sourceStartSeconds,
    0,
    0,
    24 * 60 * 60
  );
  const sourceEndSeconds = numberInRange(
    body.sourceEndSeconds ?? body.sourceRange?.endSeconds ?? body.controls?.sourceEndSeconds,
    sourceStartSeconds + durationSeconds,
    0,
    24 * 60 * 60
  );

  if (["video-remix", "character-replace"].includes(mode) && !sourceAssetId) {
    throw apiError("Chế độ này cần video nguồn đã tải lên Cloud Storage của tài khoản.", 400, "SOURCE_ASSET_REQUIRED");
  }
  if (["video-remix", "character-replace"].includes(mode)
    && (sourceEndSeconds <= sourceStartSeconds || sourceEndSeconds - sourceStartSeconds > 10)) {
    throw apiError("Đoạn video nguồn phải dài trên 0 và tối đa 10 giây.", 400, "SOURCE_RANGE_INVALID");
  }
  if (mode === "character-replace" && !characterAssetIds.length) {
    throw apiError("Hãy thêm ít nhất một ảnh nhân vật thuộc tài khoản này.", 400, "CHARACTER_ASSET_REQUIRED");
  }
  const hasRightsControlledAssets = Boolean(sourceAssetId || audioAssetId || characterAssetIds.length || referenceAssetIds.length);
  if (hasRightsControlledAssets && !mediaProjectId) {
    throw apiError("Asset AI Video phải thuộc một Media Project của tài khoản.", 400, "PROJECT_REQUIRED");
  }
  if (hasRightsControlledAssets && body.rightsAttested !== true) {
    throw apiError("Bạn phải xác nhận quyền sử dụng video, ảnh và âm thanh trước khi render.", 400, "RIGHTS_ATTESTATION_REQUIRED");
  }
  if (mode === "character-replace" && body.characterConsentAttested !== true) {
    throw apiError("Bạn phải xác nhận có sự đồng ý hợp lệ của người/nhân vật được thay thế.", 400, "CHARACTER_CONSENT_REQUIRED");
  }

  return {
    mode,
    prompt,
    negativePrompt: text(body.negativePrompt, 2400),
    durationSeconds,
    aspectRatio,
    resolution,
    variants: Math.round(numberInRange(body.variants, 1, 1, 3)),
    requestedProvider,
    requestedModel: (providerAlias || modelIntent === "auto") ? "" : text(body.model || body.requestedModel, 100),
    sourceAssetId,
    characterAssetIds,
    referenceAssetIds,
    audioAssetId,
    mediaProjectId,
    sourceRange: ["video-remix", "character-replace"].includes(mode)
      ? { startSeconds: Number(sourceStartSeconds.toFixed(3)), endSeconds: Number(sourceEndSeconds.toFixed(3)) }
      : null,
    rightsAttested: hasRightsControlledAssets ? true : null,
    characterConsentAttested: mode === "character-replace" ? true : null,
    controls: normalizeControls(body.controls || {}),
    seed: body.seed !== null && body.seed !== undefined && text(body.seed, 40) !== "" && Number.isSafeInteger(Number(body.seed))
      ? Number(body.seed)
      : null,
    sceneId: text(body.sceneId, 80)
  };
}

function normalizeAnalysisRequest(body = {}) {
  const visualAnalysis = body.visualAnalysis === true;
  const modeValue = text(body.mode, 40).toLowerCase();
  const mode = modeValue === "ai-director" || !modeValue ? "text-to-video" : normalizeMode(modeValue);
  const brief = text(body.prompt || body.brief || body.requirement, 8000);
  if (!brief) throw apiError("Hãy mô tả mục tiêu phân tích hoặc storyboard.", 400, "DIRECTOR_BRIEF_REQUIRED");
  const sourceAssetId = text(body.sourceAssetId, 80);
  const characterAssetIds = uniqueStrings(body.characterAssetIds, 8, 80);
  const referenceAssetIds = uniqueStrings(body.referenceAssetIds, 8, 80);
  const mediaProjectId = text(body.mediaProjectId, 80);
  const assetIds = [...new Set([sourceAssetId, ...characterAssetIds, ...referenceAssetIds].filter(Boolean))];
  if (visualAnalysis && !assetIds.length) {
    throw apiError("Visual analysis cần ít nhất một asset Media Cloud.", 400, "VISUAL_ANALYSIS_ASSET_REQUIRED");
  }
  if (mode === "character-replace" && !characterAssetIds.length) {
    throw apiError("Phân tích thay nhân vật cần ít nhất một ảnh nhân vật.", 400, "CHARACTER_ASSET_REQUIRED");
  }
  if (assetIds.length && !mediaProjectId) {
    throw apiError("Asset phân tích phải thuộc một Media Project đã xác thực.", 400, "PROJECT_REQUIRED");
  }
  if (assetIds.length && body.rightsAttested !== true) {
    throw apiError("Bạn phải xác nhận quyền sử dụng asset trước khi phân tích.", 400, "RIGHTS_ATTESTATION_REQUIRED");
  }
  if (mode === "character-replace" && body.characterConsentAttested !== true) {
    throw apiError("Bạn phải xác nhận sự đồng ý trước khi phân tích thay nhân vật.", 400, "CHARACTER_CONSENT_REQUIRED");
  }
  return {
    kind: "analysis",
    visualAnalysis,
    mode,
    brief,
    targetDurationSeconds: Math.round(numberInRange(body.targetDurationSeconds, 30, 4, 600)),
    mediaProjectId,
    sourceAssetId,
    characterAssetIds,
    referenceAssetIds,
    rightsAttested: assetIds.length ? true : null,
    characterConsentAttested: mode === "character-replace" ? true : null
  };
}

function analysisAssetIdsOf(request = {}) {
  return [...new Set([
    request.sourceAssetId,
    ...(request.characterAssetIds || []),
    ...(request.referenceAssetIds || [])
  ].filter(Boolean))];
}

function assetIdsOf(request = {}) {
  return [...new Set([
    request.sourceAssetId,
    request.audioAssetId,
    ...(request.characterAssetIds || []),
    ...(request.referenceAssetIds || [])
  ].filter(Boolean))];
}

function idempotencyHash(ownerId, value) {
  const key = text(value, 180);
  if (!key) throw apiError("Thiếu idempotencyKey cho tác vụ render.", 400, "IDEMPOTENCY_KEY_REQUIRED");
  if (key.length < 8) throw apiError("idempotencyKey cần ít nhất 8 ký tự.", 400, "IDEMPOTENCY_KEY_INVALID");
  return createHash("sha256").update(`${text(ownerId, 80)}\u001f${key}`).digest("hex");
}

function parseList(value, allowed) {
  const source = Array.isArray(value) ? value : String(value || "").split(/[\s,;]+/);
  return [...new Set(source.map((item) => text(item, 60).toLowerCase()).filter((item) => allowed.has(item)))];
}

function parseDeclaredModels(value) {
  return [...new Set(String(value || "")
    .split(/[\r\n,;]+/)
    .map((item) => text(item, 120))
    .filter((item) => /^[a-z0-9][a-z0-9_.:/-]{0,119}$/i.test(item)))]
    .slice(0, 100);
}

function validWorkerUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return !url.username && !url.password
      && (url.protocol === "https:" || (["localhost", "127.0.0.1"].includes(url.hostname) && url.protocol === "http:"));
  } catch {
    return false;
  }
}

function capabilitySnapshot(env = process.env) {
  const hasGeminiKey = Boolean(text(env.GEMINI_API_KEYS || env.GEMINI_API_KEY || env.GOOGLE_AI_API_KEY, 10000));
  const workerUrlValid = validWorkerUrl(env.MEDIA_AI_WORKER_URL);
  const workerConfigured = workerUrlValid && text(env.MEDIA_AI_WORKER_TOKEN, 1000).length >= 24;
  const declaredWorkerModes = parseList(env.MEDIA_AI_WORKER_MODES, WORKER_MODES);
  const workerModes = workerConfigured ? declaredWorkerModes : [];
  const declaredWorkerProviders = workerConfigured
    ? parseList(env.MEDIA_AI_WORKER_PROVIDERS, new Set(["gemini-omni", "wan2.2", "wan", "custom"]))
    : [];
  const declaredWorkerModels = workerConfigured ? parseDeclaredModels(env.MEDIA_AI_WORKER_MODELS) : [];
  const defaultWorkerModel = text(env.MEDIA_AI_WORKER_DEFAULT_MODEL, 120);
  const workerModelDeclarationValid = declaredWorkerModels.length > 0
    && (defaultWorkerModel ? declaredWorkerModels.includes(defaultWorkerModel) : declaredWorkerModels.length === 1);
  const veoConfigured = hasGeminiKey && Boolean(text(env.GEMINI_VIDEO_MODEL || env.VEO_MODEL, 120));
  const directorConfigured = hasGeminiKey && Boolean(text(env.AI_VIDEO_DIRECTOR_MODEL || env.GEMINI_MODEL, 120));

  const directVeoDurationsSeconds = parseList(env.VEO_ALLOWED_DURATIONS || "4,6,8", new Set(["4", "6", "8"])).map(Number);
  const directVeoAspectRatios = parseList(env.VEO_ALLOWED_ASPECT_RATIOS || "16:9,9:16", new Set(["16:9", "9:16"]));
  const directVeoResolutions = parseList(env.VEO_ALLOWED_RESOLUTIONS || "720p", new Set(["720p", "1080p", "4k"]));
  const workerDurationsSeconds = parseList(env.MEDIA_AI_WORKER_DURATIONS || "4,6,8", new Set(["4", "6", "8", "10"])).map(Number);
  const workerAspectRatios = parseList(env.MEDIA_AI_WORKER_ASPECT_RATIOS || "16:9,9:16", new Set(["16:9", "9:16", "1:1"]));
  const workerResolutions = parseList(env.MEDIA_AI_WORKER_RESOLUTIONS || "720p", new Set(["720p", "1080p", "4k"]));
  const workerMaximumVariants = Math.max(1, Math.min(3, Number(env.MEDIA_AI_WORKER_MAX_VARIANTS) || 1));

  const mode = (name, direct) => {
    const worker = workerModes.includes(name) && declaredWorkerProviders.length > 0 && workerModelDeclarationValid;
    return {
      supported: Boolean(direct || worker),
      adapters: [direct ? "veo" : "", worker ? "media-ai-worker" : ""].filter(Boolean),
      reason: direct || worker
        ? "Đã có adapter máy chủ được cấu hình."
        : (workerConfigured
          ? `Worker chưa khai báo đầy đủ mode ${name} và MEDIA_AI_WORKER_PROVIDERS.`
          : "Cần cấu hình adapter video trên máy chủ hoặc MEDIA_AI_WORKER_URL + MEDIA_AI_WORKER_TOKEN.")
    };
  };

  return {
    authRequired: true,
    providers: {
      director: {
        configured: directorConfigured,
        model: directorConfigured ? text(env.AI_VIDEO_DIRECTOR_MODEL || env.GEMINI_MODEL, 120) : null
      },
      veo: {
        configured: veoConfigured,
        model: veoConfigured ? text(env.GEMINI_VIDEO_MODEL || env.VEO_MODEL, 120) : null,
        directModes: veoConfigured ? ["text-to-video"] : []
      },
      worker: {
        configured: workerConfigured,
        declaredModes: workerModes,
        declaredProviders: declaredWorkerProviders,
        declaredModels: declaredWorkerModels,
        defaultModel: defaultWorkerModel || null,
        capabilityDeclarationRequired: workerConfigured && (!workerModes.length || !declaredWorkerProviders.length || !workerModelDeclarationValid)
      },
      localWan: {
        configured: workerConfigured
          && workerModelDeclarationValid
          && declaredWorkerProviders.some((provider) => ["wan2.2", "wan"].includes(provider))
          && workerModes.some((modeName) => ["video-remix", "character-replace"].includes(modeName)),
        serverless: false
      }
    },
    modes: {
      "text-to-video": mode("text-to-video", veoConfigured),
      "video-remix": mode("video-remix", false),
      "character-replace": mode("character-replace", false)
    },
  analysis: {
      directorPlan: directorConfigured,
      visualSourceAnalysis: workerModes.includes("analyze") && declaredWorkerProviders.length > 0 && workerModelDeclarationValid,
      fallbackBasis: directorConfigured ? "brief-and-owned-asset-metadata" : null,
      quoteRequired: true,
      explicitAcceptanceRequired: true
    },
    controls: {
      pause: "Worker pause khi adapter xác nhận; Veo trực tiếp chỉ tạm dừng polling cục bộ.",
      resume: true,
      retry: "Tạo attempt mới từ checkpoint đã lưu.",
      cancel: "Không tuyên bố đã hủy provider nếu provider không xác nhận."
    },
    limits: {
      directVeoDurationsSeconds: directVeoDurationsSeconds.length ? directVeoDurationsSeconds : [4, 6, 8],
      directVeoAspectRatios: directVeoAspectRatios.length ? directVeoAspectRatios : ["16:9", "9:16"],
      directVeoResolutions: directVeoResolutions.length ? directVeoResolutions : ["720p"],
      workerSceneMaximumSeconds: 10,
      directVeoVariants: 1,
      workerDurationsSeconds: workerDurationsSeconds.length ? workerDurationsSeconds : [4, 6, 8],
      workerAspectRatios: workerAspectRatios.length ? workerAspectRatios : ["16:9", "9:16"],
      workerResolutions: workerResolutions.length ? workerResolutions : ["720p"],
      workerVariantsMaximum: workerMaximumVariants,
      maximumReferenceImages: 8
    },
    freeTier: {
      assumed: false,
      message: "Quota và giá do nhà cung cấp quyết định; hệ thống không tự tạo hoặc luân phiên tài khoản miễn phí."
    }
  };
}

function selectAdapter(capabilities, request) {
  const workerSupports = capabilities.providers.worker.declaredModes.includes(request.mode)
    && capabilities.providers.worker.declaredProviders.length > 0
    && capabilities.providers.worker.capabilityDeclarationRequired !== true;
  const wantsWorker = ["worker", "gemini-omni", "wan2.2"].includes(request.requestedProvider);
  const wantsVeo = request.requestedProvider === "veo";
  const selectWorker = () => {
    if (!workerSupports) throw apiError(`Worker chưa được cấu hình đầy đủ cho ${request.mode}.`, 503, "WORKER_MODE_NOT_CONFIGURED");
    const limits = capabilities.limits;
    const incompatibility = !limits.workerDurationsSeconds.includes(request.durationSeconds)
      ? `Worker chưa bật thời lượng ${request.durationSeconds} giây.`
      : !limits.workerAspectRatios.includes(request.aspectRatio)
        ? `Worker chưa bật tỷ lệ ${request.aspectRatio}.`
        : !limits.workerResolutions.includes(request.resolution)
          ? `Worker chưa bật độ phân giải ${request.resolution}.`
          : request.variants > limits.workerVariantsMaximum
            ? `Worker chỉ bật tối đa ${limits.workerVariantsMaximum} phương án mỗi job.`
            : "";
    if (incompatibility) throw apiError(`${incompatibility} Hãy đổi cấu hình hoặc capability worker.`, 422, "WORKER_PARAMETERS_UNSUPPORTED");
    return "media-ai-worker";
  };

  if (wantsWorker) {
    if (["gemini-omni", "wan2.2"].includes(request.requestedProvider)
      && !capabilities.providers.worker.declaredProviders.includes(request.requestedProvider)) {
      throw apiError(`Worker chưa khai báo provider ${request.requestedProvider}.`, 503, "WORKER_PROVIDER_NOT_CONFIGURED");
    }
    return selectWorker();
  }
  if (wantsVeo && request.mode !== "text-to-video") {
    throw apiError("Veo trực tiếp hiện chỉ được bật cho text-to-video; remix/thay nhân vật cần worker.", 422, "VEO_MODE_UNSUPPORTED");
  }
  if (request.mode === "text-to-video" && capabilities.providers.veo.configured) {
    const limitations = capabilities.limits;
    const hasInputAssets = Boolean(request.sourceAssetId || request.audioAssetId || request.characterAssetIds?.length || request.referenceAssetIds?.length);
    const incompatibility = hasInputAssets
      ? "Veo trực tiếp chỉ nhận text-to-video thuần trong adapter này; asset tham chiếu cần worker."
      : !limitations.directVeoDurationsSeconds.includes(request.durationSeconds)
      ? `Veo trực tiếp chưa bật thời lượng ${request.durationSeconds} giây.`
      : !limitations.directVeoAspectRatios.includes(request.aspectRatio)
        ? `Veo trực tiếp chưa bật tỷ lệ ${request.aspectRatio}.`
        : !limitations.directVeoResolutions.includes(request.resolution)
          ? `Veo trực tiếp chưa bật độ phân giải ${request.resolution}.`
          : request.variants !== 1
            ? "Veo trực tiếp chỉ tạo một phương án mỗi job."
            : "";
    if (!incompatibility) return "veo";
    if (!wantsVeo && workerSupports) return selectWorker();
    throw apiError(`${incompatibility} Hãy chọn cấu hình được hỗ trợ hoặc cấu hình worker.`, 422, "VEO_PARAMETERS_UNSUPPORTED");
  }
  if (workerSupports) return selectWorker();
  throw apiError(capabilities.modes[request.mode]?.reason || "Chưa có adapter phù hợp.", 503, "VIDEO_ADAPTER_NOT_CONFIGURED");
}

function pricingRate(env, adapter, model) {
  const value = adapter === "media-ai-worker"
    ? env.MEDIA_AI_WORKER_USD_PER_SECOND
    : (text(model, 120).toLowerCase().includes("fast") || text(model, 120).toLowerCase().includes("lite"))
      ? env.VEO_FAST_USD_PER_SECOND
      : env.VEO_STANDARD_USD_PER_SECOND;
  if (String(value ?? "").trim() === "") return NaN;
  return numberInRange(value, NaN, 0, 1000);
}

function estimateRequest(request, options = {}) {
  const adapter = options.adapter || "unconfigured";
  const model = options.model || null;
  const seconds = request.durationSeconds * request.variants;
  const rate = pricingRate(options.env || process.env, adapter, model);
  const configured = Number.isFinite(rate);
  return {
    currency: "USD",
    billingUnit: "generated-second",
    quantity: seconds,
    unitRate: configured ? Number(rate.toFixed(6)) : null,
    amount: configured ? Number((seconds * rate).toFixed(4)) : null,
    pricingConfigured: configured,
    pricingVersion: text((options.env || process.env).AI_VIDEO_PRICING_VERSION, 80) || null,
    disclaimer: configured
      ? "Ước tính theo bảng giá do quản trị viên cấu hình; nhà cung cấp quyết định chi phí cuối cùng."
      : "Chưa cấu hình đơn giá máy chủ; không hiển thị số tiền giả."
  };
}

function safeObject(value, depth = 0) {
  if (depth > 5 || value == null) return value == null ? null : undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (Array.isArray(value)) return value.slice(0, 80).map((item) => safeObject(item, depth + 1)).filter((item) => item !== undefined);
  if (typeof value === "string") return text(value, 6000);
  if (["boolean", "number"].includes(typeof value)) return Number.isFinite(value) || typeof value === "boolean" ? value : null;
  if (typeof value !== "object") return undefined;
  const output = {};
  for (const [key, item] of Object.entries(value).slice(0, 100)) {
    if (BLOCKED_FIELD.test(key) || PROTOTYPE_FIELD.has(String(key).toLowerCase())) continue;
    const safe = safeObject(item, depth + 1);
    if (safe !== undefined) output[text(key, 80)] = safe;
  }
  return output;
}

function redactDeep(value, depth = 0) {
  if (depth > 5 || value == null) return value == null ? null : undefined;
  if (typeof value === "string") return redactMessage(value, 6000);
  if (Array.isArray(value)) return value.slice(0, 80).map((item) => redactDeep(item, depth + 1)).filter((item) => item !== undefined);
  if (typeof value !== "object") return value;
  const output = {};
  for (const [key, item] of Object.entries(value).slice(0, 100)) {
    if (BLOCKED_FIELD.test(key) || PROTOTYPE_FIELD.has(String(key).toLowerCase())) continue;
    const safe = redactDeep(item, depth + 1);
    if (safe !== undefined) output[key] = safe;
  }
  return output;
}

function progressOrNull(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 100 ? numeric : null;
}

function publicCheckpoint(value = {}) {
  const checkpoint = value && typeof value === "object" ? value : {};
  const output = {};
  for (const key of ["stage", "resumeStatus", "pausedStage", "retryFrom", "retryAttempt", "sceneId", "completedSceneIds", "sourceRange", "resumedAt", "pausedAt", "canceledStage", "retriedAt"]) {
    if (checkpoint[key] !== undefined) output[key] = safeObject(checkpoint[key]);
  }
  if (checkpoint.providerControl && typeof checkpoint.providerControl === "object") {
    output.providerControl = {
      action: text(checkpoint.providerControl.action, 40),
      confirmed: checkpoint.providerControl.confirmed === true,
      message: text(checkpoint.providerControl.message, 300) || null
    };
  }
  return output;
}

function publicJob(job = {}) {
  const id = text(job._id || job.id, 80);
  const outputReady = job.status === "completed" && Boolean(job.providerOutputUri || job.outputReady);
  return {
    id,
    mode: job.mode,
    status: canonicalStatus(job.status),
    progress: progressOrNull(job.progress),
    stage: text(job.stage, 80) || null,
    attempt: Number(job.attempt) || 1,
    input: safeObject(job.input),
    estimate: safeObject(job.estimate),
    checkpoint: publicCheckpoint(job.checkpoint),
    rights: {
      rightsAttested: job.rightsManifest?.rightsAttested === true,
      rightsAttestedAt: job.rightsManifest?.rightsAttestedAt || null,
      characterConsentAttested: job.rightsManifest?.characterConsentAttested === true,
      characterConsentAttestedAt: job.rightsManifest?.characterConsentAttestedAt || null
    },
    provider: {
      adapter: text(job.adapter, 80) || null,
      model: text(job.providerModel, 120) || null,
      mayContinue: Boolean(job.providerMayContinue),
      controlConfirmed: job.providerControlConfirmed === true
    },
    output: outputReady ? {
      ready: true,
      downloadUrl: `/api/ai-video-remake?action=download&id=${encodeURIComponent(id)}`,
      mimeType: text(job.outputMimeType, 100) || "video/mp4"
    } : { ready: false },
    error: job.error ? {
      code: text(job.error.code, 100) || "VIDEO_JOB_FAILED",
      message: redactMessage(job.error.message, 500) || "Tác vụ video thất bại.",
      retryable: job.error.retryable !== false,
      ambiguousSubmission: job.error.ambiguousSubmission === true
    } : null,
    statusWarning: job.lastPollError ? {
      code: text(job.lastPollError.code, 100) || "PROVIDER_STATUS_UNAVAILABLE",
      message: redactMessage(job.lastPollError.message, 500)
    } : null,
    createdAt: job.createdAt || null,
    updatedAt: job.updatedAt || null,
    submittedAt: job.submittedAt || null,
    completedAt: job.completedAt || null
  };
}

function assertTransition(job, action) {
  const status = canonicalStatus(job.status);
  if (action === "pause" && !ACTIVE_STATUSES.has(status)) throw apiError("Chỉ tác vụ đang chờ hoặc đang chạy mới có thể tạm dừng.", 409, "JOB_NOT_PAUSABLE");
  if (action === "resume" && !["paused", "pause-requested"].includes(status)) throw apiError("Tác vụ hiện không ở trạng thái tạm dừng.", 409, "JOB_NOT_RESUMABLE");
  if (action === "retry" && !["failed", "canceled", "submission-unknown"].includes(status)) throw apiError("Chỉ tác vụ lỗi, đã hủy hoặc chưa rõ trạng thái gửi mới có thể thử lại.", 409, "JOB_NOT_RETRYABLE");
  if (action === "cancel" && (TERMINAL_STATUSES.has(status) || status === "cancel-requested")) throw apiError("Tác vụ đã kết thúc hoặc đang chờ hủy.", 409, "JOB_NOT_CANCELABLE");
}

function transitionJob(job, action, now = new Date(), options = {}) {
  assertTransition(job, action);
  const checkpoint = safeObject(job.checkpoint || {}) || {};
  if (action === "pause") return {
    ...job,
    status: options.awaitingProviderAck ? "pause-requested" : "paused",
    pausedAt: now,
    updatedAt: now,
    checkpoint: { ...checkpoint, resumeStatus: job.status, pausedStage: job.stage || null }
  };
  if (action === "resume") return {
    ...job,
    status: ACTIVE_STATUSES.has(checkpoint.resumeStatus) ? checkpoint.resumeStatus : "submitted",
    pausedAt: null,
    updatedAt: now,
    checkpoint: { ...checkpoint, resumedAt: now }
  };
  if (action === "cancel") return {
    ...job,
    status: options.awaitingProviderAck ? "cancel-requested" : "canceled",
    canceledAt: now,
    updatedAt: now,
    checkpoint: { ...checkpoint, canceledStage: job.stage || null }
  };
  return {
    ...job,
    status: "queued",
    stage: "retry-queued",
    progress: null,
    attempt: (Number(job.attempt) || 1) + 1,
    error: null,
    completedAt: null,
    canceledAt: null,
    pausedAt: null,
    providerOperationName: null,
    providerJobId: null,
    providerKeyFingerprint: null,
    providerOutputUri: null,
    outputReady: false,
    providerMayContinue: false,
    providerControlConfirmed: false,
    updatedAt: now,
    checkpoint: {
      ...checkpoint,
      retryFrom: checkpoint.stage || job.stage || "created",
      retryAttempt: (Number(job.attempt) || 1) + 1,
      retriedAt: now
    }
  };
}

function requestFingerprint(request = {}) {
  const normalized = safeObject(request) || {};
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function buildDirectorPrompt(body = {}, assetMetadata = []) {
  const brief = text(body.prompt || body.brief || body.requirement, 8000);
  if (!brief) throw apiError("Hãy mô tả video cần phân tích hoặc lập kế hoạch.", 400, "DIRECTOR_BRIEF_REQUIRED");
  const mode = MODES.includes(text(body.mode, 40)) ? text(body.mode, 40) : "text-to-video";
  const targetDuration = Math.round(numberInRange(body.targetDurationSeconds, 30, 4, 600));
  const metadata = assetMetadata.map((asset) => ({
    id: text(asset.id || asset._id, 80),
    name: text(asset.name, 180),
    mimeType: text(asset.mimeType, 100),
    size: Number(asset.size) || 0
  }));
  return [
    "Bạn là AI Director của HH Video Remake Studio.",
    "Chỉ lập kế hoạch dựa trên brief và metadata được cung cấp; không tuyên bố đã nhìn/nghe video nếu không có visual analysis từ worker.",
    "Chia thành cảnh ngắn tối đa 8 giây. Viết prompt dựng hình cụ thể, nhất quán nhân vật và có camera/audio rõ ràng.",
    "Trả về JSON hợp lệ với các khóa: summary, analysisBasis, assumptions, globalStyle, characterBible, scenes, risks, nextActions.",
    "Mỗi scene gồm: id, title, durationSeconds, promptVi, promptEn, camera, action, lighting, audio, continuity, requiredAssetIds.",
    `Mode: ${mode}`,
    `Target duration: ${targetDuration} seconds`,
    `Owned asset metadata: ${JSON.stringify(metadata)}`,
    `Brief: ${brief}`
  ].join("\n");
}

function normalizeDirectorPlan(value = {}) {
  const plan = typeof value === "string" ? JSON.parse(value) : value;
  if (!plan || typeof plan !== "object" || !Array.isArray(plan.scenes)) {
    throw apiError("Gemini không trả về storyboard JSON hợp lệ.", 502, "DIRECTOR_RESPONSE_INVALID");
  }
  const scenes = plan.scenes.slice(0, 80).map((scene, index) => ({
    id: text(scene.id, 60) || `scene-${index + 1}`,
    title: redactMessage(scene.title, 180) || `Cảnh ${index + 1}`,
    durationSeconds: Math.round(numberInRange(scene.durationSeconds, 8, 1, 10)),
    promptVi: redactMessage(scene.promptVi, 4000),
    promptEn: redactMessage(scene.promptEn, 4000),
    camera: redactMessage(scene.camera, 1000),
    action: redactMessage(scene.action, 1200),
    lighting: redactMessage(scene.lighting, 800),
    audio: redactMessage(scene.audio, 1000),
    continuity: redactMessage(scene.continuity, 1000),
    requiredAssetIds: uniqueStrings(scene.requiredAssetIds, 12, 80)
  }));
  if (!scenes.length) throw apiError("Storyboard không có cảnh hợp lệ.", 502, "DIRECTOR_SCENES_EMPTY");
  return {
    summary: redactMessage(plan.summary, 3000),
    analysisBasis: redactMessage(plan.analysisBasis, 300) || "brief-and-owned-asset-metadata",
    assumptions: uniqueStrings(plan.assumptions, 30, 600).map((item) => redactMessage(item, 600)),
    globalStyle: redactMessage(plan.globalStyle, 3000),
    characterBible: redactDeep(safeObject(plan.characterBible || {})),
    scenes,
    risks: uniqueStrings(plan.risks, 30, 800).map((item) => redactMessage(item, 800)),
    nextActions: uniqueStrings(plan.nextActions, 30, 800).map((item) => redactMessage(item, 800))
  };
}

function constrainDirectorPlan(plan, verifiedAssetIds = [], analysisBasis = "brief-and-owned-asset-metadata") {
  const allowed = new Set((verifiedAssetIds || []).map((id) => text(id, 80)).filter(Boolean));
  const normalized = normalizeDirectorPlan(plan);
  return {
    ...normalized,
    analysisBasis,
    scenes: normalized.scenes.map((scene) => ({
      ...scene,
      requiredAssetIds: scene.requiredAssetIds.filter((id) => allowed.has(id))
    }))
  };
}

module.exports = {
  ACTIONS,
  ACTIVE_STATUSES,
  MODES,
  TERMINAL_STATUSES,
  apiError,
  analysisAssetIdsOf,
  assetIdsOf,
  buildDirectorPrompt,
  canonicalStatus,
  capabilitySnapshot,
  constrainDirectorPlan,
  estimateRequest,
  idempotencyHash,
  normalizeAction,
  normalizeAnalysisRequest,
  normalizeDirectorPlan,
  normalizeRenderRequest,
  progressOrNull,
  publicCheckpoint,
  publicJob,
  redactMessage,
  redactDeep,
  requestFingerprint,
  safeObject,
  selectAdapter,
  text,
  transitionJob,
  validWorkerUrl
};
