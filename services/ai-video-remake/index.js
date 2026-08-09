const { ObjectId } = require("mongodb");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { issueSignedToken, presignUrl } = require("@vercel/blob");
const {
  currentUser,
  enforceRateLimit,
  isOwnerUser,
  withApi
} = require("../../utils/platform");
const { parseGeminiKeys } = require("../../utils/gemini-key-pool");
const {
  ACTIVE_STATUSES,
  analysisAssetIdsOf,
  apiError,
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
  publicJob,
  requestFingerprint,
  safeObject,
  selectAdapter,
  text,
  transitionJob,
  validWorkerUrl
} = require("./core");

const JOBS_COLLECTION = "aiVideoRemakeJobs";
const PLANS_COLLECTION = "aiVideoRemakePlans";
const ANALYSES_COLLECTION = "aiVideoRemakeAnalyses";
const QUOTES_COLLECTION = "aiVideoRemakeQuotes";
const USAGE_COLLECTION = "aiVideoRemakeUsage";
const VIDEO_STATUSES = new Set(["queued", "dispatching", "submitted", "running", "pause-requested", "cancel-requested", "paused", "completed", "failed", "canceled", "submission-unknown"]);
let indexesReady = false;

function utcDayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function positiveInteger(value, fallback, maximum = 10000) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.min(maximum, Math.floor(numeric)) : fallback;
}

function billingState(user, env = process.env) {
  const explicitlyAllowed = String(env.AI_VIDEO_BILLING_USER_IDS || "")
    .split(/[\s,;]+/)
    .filter(Boolean)
    .includes(String(user?._id || ""));
  const admin = isOwnerUser(user) || explicitlyAllowed;
  const regularUsersEnabled = env.AI_VIDEO_ALLOW_USERS === "1";
  const dailyJobLimit = admin
    ? positiveInteger(env.AI_VIDEO_ADMIN_DAILY_JOB_LIMIT, 50, 1000)
    : positiveInteger(env.AI_VIDEO_DAILY_JOB_LIMIT, 3, 100);
  const rawUsdLimit = admin ? env.AI_VIDEO_ADMIN_DAILY_USD_LIMIT : env.AI_VIDEO_DAILY_USD_LIMIT;
  const configuredUsdLimit = String(rawUsdLimit ?? "").trim() === "" ? NaN : Number(rawUsdLimit);
  const dailyUsdLimit = Number.isFinite(configuredUsdLimit) && configuredUsdLimit >= 0 ? configuredUsdLimit : null;
  return {
    canCreate: admin || regularUsersEnabled,
    admin,
    regularUsersEnabled,
    dailyJobLimit,
    dailyUsdLimit,
    regularUsersRequireConfiguredPricing: !admin,
    reason: admin || regularUsersEnabled
      ? "Tài khoản được phép gửi tác vụ có thể phát sinh chi phí trong giới hạn máy chủ."
      : "Render AI có tính phí chỉ mở cho owner/danh sách billing; đặt AI_VIDEO_ALLOW_USERS=1 để bật có kiểm soát."
  };
}

async function ensureIndexes(db) {
  if (indexesReady) return;
  await Promise.all([
    db.collection(JOBS_COLLECTION).createIndex(
      { userId: 1, idempotencyHash: 1 },
      { unique: true, name: "ai_video_owner_idempotency" }
    ),
    db.collection(JOBS_COLLECTION).createIndex(
      { userId: 1, updatedAt: -1 },
      { name: "ai_video_owner_updated" }
    ),
    db.collection(PLANS_COLLECTION).createIndex(
      { userId: 1, createdAt: -1 },
      { name: "ai_video_plan_owner_created" }
    ),
    db.collection(ANALYSES_COLLECTION).createIndex(
      { userId: 1, idempotencyHash: 1 },
      { unique: true, name: "ai_video_analysis_owner_idempotency" }
    ),
    db.collection(ANALYSES_COLLECTION).createIndex(
      { userId: 1, updatedAt: -1 },
      { name: "ai_video_analysis_owner_updated" }
    ),
    db.collection(QUOTES_COLLECTION).createIndex(
      { userId: 1, expiresAt: 1 },
      { name: "ai_video_quote_owner_expiry" }
    ),
    db.collection(QUOTES_COLLECTION).createIndex(
      { userId: 1, requestFingerprint: 1, usedAt: 1, expiresAt: -1 },
      { name: "ai_video_quote_reuse" }
    ),
    db.collection(QUOTES_COLLECTION).createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: "ai_video_quote_ttl" }
    ),
    db.collection(USAGE_COLLECTION).createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: "ai_video_usage_expiry" }
    )
  ]);
  indexesReady = true;
}

function objectId(value, label = "ID") {
  const id = text(value, 80);
  if (!ObjectId.isValid(id)) throw apiError(`${label} không hợp lệ.`, 400, "OBJECT_ID_INVALID");
  return new ObjectId(id);
}

function publicCapabilities(user, env = process.env) {
  const capabilities = capabilitySnapshot(env);
  capabilities.providers.worker.models = declaredValues(env.MEDIA_AI_WORKER_MODELS);
  capabilities.providers.worker.defaultModel = text(env.MEDIA_AI_WORKER_DEFAULT_MODEL, 120) || null;
  const supportedModes = Object.entries(capabilities.modes).filter(([, item]) => item.supported).map(([mode]) => mode);
  capabilities.models = [
    {
      id: "auto",
      label: "Tự động · backend quyết định model",
      provider: "backend",
      available: supportedModes.length > 0,
      supportedModes,
      supportedDurations: capabilities.limits.directVeoDurationsSeconds,
      supportedResolutions: capabilities.limits.directVeoResolutions
    },
    {
      id: "server-veo",
      label: `Veo · ${capabilities.providers.veo.model || "chưa cấu hình"}`,
      provider: "veo",
      available: capabilities.providers.veo.configured,
      supportedModes: capabilities.providers.veo.directModes,
      supportedDurations: capabilities.limits.directVeoDurationsSeconds,
      supportedResolutions: capabilities.limits.directVeoResolutions
    },
    {
      id: "server-worker",
      label: "Media AI Worker",
      provider: "worker",
      available: capabilities.providers.worker.configured && !capabilities.providers.worker.capabilityDeclarationRequired,
      supportedModes: capabilities.providers.worker.declaredModes,
      supportedDurations: capabilities.limits.workerDurationsSeconds,
      supportedResolutions: capabilities.limits.workerResolutions
    },
    {
      id: "server-local-wan",
      label: "Wan2.2 Animate · GPU worker",
      provider: "wan2.2",
      available: capabilities.providers.localWan.configured,
      supportedModes: capabilities.providers.worker.declaredModes.filter((mode) => ["video-remix", "character-replace"].includes(mode)),
      supportedDurations: capabilities.limits.workerDurationsSeconds,
      supportedResolutions: capabilities.limits.workerResolutions
    },
    {
      id: "server-director",
      label: `AI Director · ${capabilities.providers.director.model || "chưa cấu hình"}`,
      provider: "gemini",
      available: capabilities.providers.director.configured,
      supportedModes: ["ai-director"],
      supportedDurations: [4, 6, 8],
      supportedResolutions: ["720p", "1080p", "4k"]
    }
  ];
  const billing = billingState(user, env);
  billing.enabled = billing.canCreate;
  capabilities.supported = supportedModes.length > 0 || capabilities.analysis.directorPlan;
  capabilities.message = capabilities.supported
    ? `${supportedModes.length} chế độ render đã có adapter máy chủ.`
    : "Chưa cấu hình adapter render video trên máy chủ.";
  return { ...capabilities, billing };
}

function declaredValues(value, maximum = 100) {
  return [...new Set(String(value || "").split(/[\r\n,;]+/).map((item) => text(item, 120)).filter(Boolean))].slice(0, maximum);
}

function resolveProviderModel(request, adapter, capabilities, env = process.env) {
  if (adapter === "veo") return text(env.GEMINI_VIDEO_MODEL || env.VEO_MODEL, 120);
  const providers = capabilities.providers.worker.declaredProviders;
  if (["gemini-omni", "wan2.2"].includes(request.requestedProvider) && !providers.includes(request.requestedProvider)) {
    throw apiError(`Worker chưa khai báo provider ${request.requestedProvider}.`, 503, "WORKER_PROVIDER_NOT_CONFIGURED");
  }
  const allowedModels = declaredValues(env.MEDIA_AI_WORKER_MODELS);
  if (request.requestedModel) {
    if (!allowedModels.includes(request.requestedModel)) {
      throw apiError("Model worker yêu cầu không nằm trong MEDIA_AI_WORKER_MODELS.", 422, "WORKER_MODEL_NOT_ALLOWED");
    }
    return request.requestedModel;
  }
  const configuredDefault = text(env.MEDIA_AI_WORKER_DEFAULT_MODEL, 120);
  if (configuredDefault && allowedModels.length && !allowedModels.includes(configuredDefault)) {
    throw apiError("MEDIA_AI_WORKER_DEFAULT_MODEL chưa nằm trong danh sách model cho phép.", 503, "WORKER_DEFAULT_MODEL_INVALID");
  }
  if (configuredDefault) return configuredDefault;
  if (allowedModels.length === 1) return allowedModels[0];
  throw apiError(
    "Worker cần MEDIA_AI_WORKER_DEFAULT_MODEL hoặc đúng một model trong MEDIA_AI_WORKER_MODELS để báo giá không mơ hồ.",
    503,
    "WORKER_MODEL_NOT_CONFIGURED"
  );
}

async function createQuote(db, user, request, adapter, model, estimate, kind = "render") {
  const now = new Date();
  const fingerprint = requestFingerprint(request);
  const reusable = await db.collection(QUOTES_COLLECTION).findOne({
    userId: user._id,
    kind,
    requestFingerprint: fingerprint,
    adapter,
    model,
    usedAt: null,
    expiresAt: { $gt: new Date(now.getTime() + 60 * 1000) },
    "estimate.amount": estimate.amount,
    "estimate.pricingVersion": estimate.pricingVersion
  }, { sort: { expiresAt: -1 } });
  if (reusable) return { id: String(reusable._id), expiresAt: reusable.expiresAt, reused: true };
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
  const doc = {
    userId: user._id,
    kind,
    requestFingerprint: fingerprint,
    adapter,
    model,
    estimate,
    createdAt: now,
    expiresAt,
    usedAt: null
  };
  const inserted = await db.collection(QUOTES_COLLECTION).insertOne(doc);
  return { id: String(inserted.insertedId), expiresAt, reused: false };
}

async function consumeQuote(db, user, body, request, idempotencyKeyHash, kind = "render") {
  if (body.acceptedEstimate !== true && body.costAccepted !== true) {
    throw apiError("Bạn phải xác nhận báo giá trước khi gửi tác vụ có thể phát sinh chi phí.", 400, "ESTIMATE_ACCEPTANCE_REQUIRED");
  }
  const quoteId = objectId(body.quoteId || body.acceptedQuoteId, "Quote ID");
  const now = new Date();
  const result = await db.collection(QUOTES_COLLECTION).findOneAndUpdate({
    _id: quoteId,
    userId: user._id,
    kind,
    requestFingerprint: requestFingerprint(request),
    usedAt: null,
    expiresAt: { $gt: now }
  }, {
    $set: { usedAt: now, acceptedAt: now, idempotencyHash: idempotencyKeyHash }
  }, { returnDocument: "after" });
  if (!result) {
    throw apiError("Quote không tồn tại, đã dùng, hết hạn hoặc không khớp cấu hình yêu cầu.", 409, "QUOTE_INVALID_OR_EXPIRED");
  }
  return result;
}

async function releaseQuote(db, quote, idempotencyKeyHash) {
  if (!quote?._id) return;
  await db.collection(QUOTES_COLLECTION).updateOne({
    _id: quote._id,
    idempotencyHash: idempotencyKeyHash
  }, {
    $set: { usedAt: null, acceptedAt: null },
    $unset: { idempotencyHash: "" }
  }).catch(() => {});
}

function assertMethod(req, expected) {
  if (String(req.method || "GET").toUpperCase() !== expected) {
    throw apiError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }
}

async function ownedAssets(db, user, ids, projectId) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean).map((id) => text(id, 80)))];
  let project = null;
  if (projectId) {
    const projectObjectId = objectId(projectId, "Media Project ID");
    project = await db.collection("mediaProjects").findOne({
      _id: projectObjectId,
      ownerId: user._id,
      status: { $nin: ["deleted", "archived"] }
    }, { projection: { _id: 1, ownerId: 1, status: 1 } });
    if (!project) {
      throw apiError("Media Project không thuộc tài khoản hiện tại hoặc không còn hoạt động.", 403, "PROJECT_OWNERSHIP_REQUIRED");
    }
  }
  if (!uniqueIds.length) return [];
  if (!project) throw apiError("Asset phải thuộc Media Project đã xác thực.", 400, "PROJECT_REQUIRED");
  if (uniqueIds.some((id) => !ObjectId.isValid(id))) {
    throw apiError("Có asset ID không hợp lệ.", 400, "ASSET_ID_INVALID");
  }
  const records = await db.collection("mediaAssets").find({
    _id: { $in: uniqueIds.map((id) => new ObjectId(id)) },
    ownerId: user._id,
    projectId: project._id,
    status: "ready",
    deletedAt: null,
    scanStatus: { $in: ["policy-pass", "mime-policy-pass"] },
    storageProvider: "vercel-blob-private",
    pathname: { $type: "string", $ne: "" },
    size: { $gt: 0 }
  }, {
    projection: {
      projectId: 1,
      ownerId: 1,
      name: 1,
      mimeType: 1,
      size: 1,
      storageProvider: 1,
      pathname: 1,
      blobUrl: 1,
      etag: 1
    }
  }).toArray();
  if (records.length !== uniqueIds.length) {
    throw apiError("Asset không thuộc project/tài khoản, chưa sẵn sàng, đã bị xóa hoặc không qua kiểm tra MIME.", 403, "ASSET_NOT_READY_OR_FORBIDDEN");
  }
  if (records.some((asset) => {
    const pathname = String(asset.pathname || "");
    return !pathname.startsWith(`media/${String(project._id)}/`) || pathname.split("/").includes("..");
  })) {
    throw apiError("Đường dẫn asset không khớp Media Project đã xác thực.", 403, "ASSET_PROJECT_PATH_INVALID");
  }
  const byId = new Map(records.map((record) => [String(record._id), record]));
  return uniqueIds.map((id) => byId.get(id));
}

function assertAssetKinds(request, assets) {
  const byId = new Map(assets.map((asset) => [String(asset._id), text(asset.mimeType, 100).toLowerCase()]));
  if (request.sourceAssetId && !byId.get(request.sourceAssetId)?.startsWith("video/")) {
    throw apiError("Video nguồn phải là một asset video hợp lệ.", 400, "SOURCE_ASSET_TYPE_INVALID");
  }
  if (request.audioAssetId && !byId.get(request.audioAssetId)?.startsWith("audio/")) {
    throw apiError("Âm thanh tham chiếu phải là asset audio hợp lệ.", 400, "AUDIO_ASSET_TYPE_INVALID");
  }
  for (const id of [...request.characterAssetIds, ...request.referenceAssetIds]) {
    if (!byId.get(id)?.startsWith("image/")) {
      throw apiError("Ảnh nhân vật/tham chiếu phải là asset ảnh hợp lệ.", 400, "REFERENCE_ASSET_TYPE_INVALID");
    }
  }
}

function assertAnalysisAssetKinds(body, assets) {
  const byId = new Map(assets.map((asset) => [String(asset._id), text(asset.mimeType, 100).toLowerCase()]));
  const sourceId = text(body.sourceAssetId, 80);
  if (sourceId && !byId.get(sourceId)?.startsWith("video/")) {
    throw apiError("Asset nguồn để phân tích phải là video.", 400, "ANALYSIS_SOURCE_TYPE_INVALID");
  }
  for (const id of [
    ...(Array.isArray(body.referenceAssetIds) ? body.referenceAssetIds : []),
    ...(Array.isArray(body.characterAssetIds) ? body.characterAssetIds : [])
  ].map((value) => text(value, 80)).filter(Boolean)) {
    if (!byId.get(id)?.startsWith("image/")) {
      throw apiError("Asset nhân vật/tham chiếu để phân tích phải là ảnh.", 400, "ANALYSIS_REFERENCE_TYPE_INVALID");
    }
  }
}

function workerAsset(asset) {
  return {
    id: String(asset._id),
    name: text(asset.name, 180),
    mimeType: text(asset.mimeType, 100),
    size: Number(asset.size) || 0,
    storageProvider: text(asset.storageProvider, 80),
    pathname: text(asset.pathname, 1200) || null,
    etag: text(asset.etag, 200) || null
  };
}

async function signedWorkerAsset(asset) {
  const pathname = text(asset.pathname, 1200);
  if (!pathname) throw apiError("Asset không có đường dẫn private Blob hợp lệ.", 409, "ASSET_STORAGE_UNAVAILABLE");
  const validUntil = Date.now() + 15 * 60 * 1000;
  try {
    const signedToken = await issueSignedToken({ pathname, operations: ["get"], validUntil });
    const signed = await presignUrl(signedToken, {
      operation: "get",
      pathname,
      access: "private",
      validUntil,
      useCache: false
    });
    if (!text(signed?.presignedUrl, 2400)) throw new Error("Signed URL missing");
    return { ...workerAsset(asset), signedGetUrl: signed.presignedUrl, signedGetExpiresAt: new Date(validUntil).toISOString() };
  } catch {
    throw apiError(
      "Không thể cấp URL đọc private Blob cho worker. Hãy cấu hình BLOB_READ_WRITE_TOKEN/OIDC cho cả Media Cloud và worker.",
      503,
      "ASSET_SIGNING_UNAVAILABLE"
    );
  }
}

function safeWorkerBase(env = process.env) {
  if (!validWorkerUrl(env.MEDIA_AI_WORKER_URL) || text(env.MEDIA_AI_WORKER_TOKEN, 1000).length < 24) {
    throw apiError("Media AI worker chưa được cấu hình an toàn.", 503, "MEDIA_AI_WORKER_NOT_CONFIGURED");
  }
  return new URL(String(env.MEDIA_AI_WORKER_URL));
}

async function workerRequest(path, options = {}, env = process.env) {
  const base = safeWorkerBase(env);
  const url = new URL(path.replace(/^\/+/, ""), `${base.toString().replace(/\/?$/, "/")}`);
  if (url.origin !== base.origin) throw apiError("Đường dẫn worker không hợp lệ.", 500, "WORKER_PATH_INVALID");
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${String(env.MEDIA_AI_WORKER_TOKEN)}`,
      ...(options.body ? { "Content-Type": "application/json" } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(options.timeoutMs || 24000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw apiError(
      text(data?.error?.message || data?.error || data?.message || `Media AI worker HTTP ${response.status}.`, 400),
      response.status >= 400 && response.status <= 503 ? response.status : 502,
      text(data?.error?.code || data?.code, 100) || "MEDIA_AI_WORKER_ERROR"
    );
  }
  return safeObject(data) || {};
}

function generatedText(data) {
  return (data?.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .map((part) => text(part?.text, 100000))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function jsonFromModel(value) {
  const stripped = text(value, 100000)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try { return JSON.parse(stripped); }
  catch { throw apiError("Gemini không trả về JSON hợp lệ.", 502, "DIRECTOR_JSON_INVALID"); }
}

async function geminiDirectorPlan(prompt, env = process.env) {
  const model = text(env.AI_VIDEO_DIRECTOR_MODEL || env.GEMINI_MODEL, 120);
  const keys = parseGeminiKeys(env);
  if (!model || !keys.length) {
    throw apiError("Gemini Director chưa được cấu hình trên máy chủ.", 503, "DIRECTOR_NOT_CONFIGURED");
  }
  const key = keys[0];
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.55,
        maxOutputTokens: 8192,
        responseMimeType: "application/json"
      }
    }),
    signal: AbortSignal.timeout(22000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = apiError(text(data?.error?.message || `Gemini HTTP ${response.status}.`, 400), response.status, "GEMINI_DIRECTOR_ERROR");
    error.providerStatus = response.status;
    throw error;
  }
  const output = generatedText(data);
  if (!output) throw apiError("Gemini Director trả về nội dung rỗng.", 502, "DIRECTOR_EMPTY_RESPONSE");
  return { plan: normalizeDirectorPlan(jsonFromModel(output)), model, usage: safeObject(data.usageMetadata || null) };
}

function allowedGoogleOutput(value) {
  try {
    const url = new URL(String(value || ""));
    return !url.username && !url.password && url.protocol === "https:"
      && (url.hostname === "generativelanguage.googleapis.com"
        || url.hostname.endsWith(".googleapis.com")
        || url.hostname.endsWith(".googleusercontent.com"));
  } catch {
    return false;
  }
}

function allowedWorkerOutput(value, env = process.env) {
  try {
    const output = new URL(String(value || ""));
    if (output.username || output.password) return false;
    if (output.protocol !== "https:" && !(["localhost", "127.0.0.1"].includes(output.hostname) && output.protocol === "http:")) return false;
    const base = safeWorkerBase(env);
    const extraHosts = String(env.MEDIA_AI_WORKER_OUTPUT_HOSTS || "").split(/[\s,;]+/).map((item) => item.trim().toLowerCase()).filter(Boolean);
    return output.origin === base.origin || extraHosts.includes(output.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function videoUriFromOperation(data) {
  return text(
    data?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri
      || data?.response?.generatedVideos?.[0]?.video?.uri
      || data?.response?.generated_videos?.[0]?.video?.uri,
    2200
  );
}

function keyFingerprint(value) {
  return require("node:crypto").createHash("sha256").update(String(value || "")).digest("hex").slice(0, 20);
}

function selectedVeoKey(env = process.env) {
  const key = parseGeminiKeys(env)[0];
  if (!key) throw apiError("Gemini/Veo chưa được cấu hình.", 503, "VEO_NOT_CONFIGURED");
  return { key, fingerprint: keyFingerprint(key) };
}

function veoKeyForJob(job, env = process.env) {
  const fingerprint = text(job.providerKeyFingerprint, 40);
  const key = parseGeminiKeys(env).find((candidate) => keyFingerprint(candidate) === fingerprint);
  if (!key) throw apiError("Không còn key Veo khớp với operation này; không tự đổi tài khoản để tránh sai quyền/quota.", 503, "VEO_OPERATION_KEY_UNAVAILABLE");
  return key;
}

async function startVeo(request, env = process.env) {
  const model = text(env.GEMINI_VIDEO_MODEL || env.VEO_MODEL, 120);
  if (!model) throw apiError("Thiếu GEMINI_VIDEO_MODEL/VEO_MODEL trên máy chủ.", 503, "VEO_MODEL_NOT_CONFIGURED");
  const selected = selectedVeoKey(env);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:predictLongRunning`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": selected.key },
      body: JSON.stringify({
        instances: [{ prompt: request.prompt }],
        parameters: {
          numberOfVideos: 1,
          aspectRatio: request.aspectRatio,
          resolution: request.resolution,
          durationSeconds: request.durationSeconds,
          ...(request.negativePrompt ? { negativePrompt: request.negativePrompt } : {}),
          ...(request.seed != null ? { seed: request.seed } : {})
        }
      }),
      signal: AbortSignal.timeout(24000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !text(data.name, 600)) {
      const error = apiError(text(data?.error?.message || `Veo HTTP ${response.status}.`, 400), response.status, "VEO_START_ERROR");
      error.providerStatus = response.status;
      if ([408, 429].includes(response.status) || response.status >= 500) {
        error.ambiguousSubmission = true;
        error.code = "VEO_SUBMISSION_UNKNOWN";
      }
      throw error;
    }
    const operationName = text(data.name, 600).replace(/^\/v1beta\//i, "").replace(/^\/+/, "");
    if (!/^operations\/[a-z0-9._-]+$/i.test(operationName)) {
      throw apiError("Veo trả về operation name không hợp lệ.", 502, "VEO_OPERATION_INVALID");
    }
    return {
      providerOperationName: operationName,
      providerModel: model,
      providerKeyFingerprint: selected.fingerprint,
      status: "submitted",
      stage: "veo-submitted"
    };
  } catch (error) {
    if (!error.providerStatus) {
      error.ambiguousSubmission = true;
      error.code = "VEO_SUBMISSION_UNKNOWN";
      error.statusCode = 502;
    }
    throw error;
  }
}

async function pollVeo(job, env = process.env) {
  const name = text(job.providerOperationName, 600);
  if (!/^operations\/[a-z0-9._-]+$/i.test(name)) {
    throw apiError("Mã operation Veo đã lưu không hợp lệ.", 500, "VEO_OPERATION_INVALID");
  }
  const apiKey = veoKeyForJob(job, env);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${name.replace(/^\//, "")}`, {
      headers: { "x-goog-api-key": apiKey },
      signal: AbortSignal.timeout(12000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = apiError(text(data?.error?.message || `Veo status HTTP ${response.status}.`, 400), response.status, "VEO_STATUS_ERROR");
      error.providerStatus = response.status;
      throw error;
    }
    if (!data.done) return { status: job.status === "dispatching" ? "submitted" : job.status, progress: null, done: false };
    if (data.error) return {
      status: "failed",
      progress: null,
      done: true,
      error: { code: text(data.error.code, 100) || "VEO_OPERATION_FAILED", message: text(data.error.message, 500), retryable: true }
    };
    const uri = videoUriFromOperation(data);
    if (!allowedGoogleOutput(uri)) {
      return {
        status: "failed",
        progress: null,
        done: true,
        error: { code: "VEO_OUTPUT_INVALID", message: "Veo báo hoàn tất nhưng không trả về media URL hợp lệ.", retryable: true }
      };
    }
    return { status: "completed", progress: 100, done: true, providerOutputUri: uri, outputMimeType: "video/mp4" };
}

function workerStatus(value, fallback = "submitted") {
  const status = canonicalStatus(value);
  return VIDEO_STATUSES.has(status) ? status : canonicalStatus(fallback);
}

async function startWorker(job, assets, env = process.env) {
  const signedAssets = await Promise.all(assets.map(signedWorkerAsset));
  let result;
  try {
    result = await workerRequest("v1/video-remake/jobs", {
      method: "POST",
      body: {
        clientJobId: String(job._id),
        ownerId: String(job.userId),
        attempt: Number(job.attempt) || 1,
        mode: job.mode,
        provider: job.workerProvider,
        model: job.providerModel,
        input: job.input,
        assets: signedAssets,
        checkpoint: safeObject(job.checkpoint),
        rightsManifest: safeObject(job.rightsManifest)
      }
    }, env);
  } catch (error) {
    const possiblePostSendFailure = !error.code
      || [408, 429, 500, 502, 503, 504].includes(Number(error.statusCode))
      || /timeout|abort|fetch failed|socket|reset/i.test(String(error.message));
    if (possiblePostSendFailure && error.code !== "MEDIA_AI_WORKER_NOT_CONFIGURED") {
      error.ambiguousSubmission = true;
      error.code = "WORKER_SUBMISSION_UNKNOWN";
    }
    throw error;
  }
  const providerJobId = text(result.jobId || result.id || result.operationId, 500);
  if (!providerJobId) throw apiError("Worker không trả về job ID hợp lệ.", 502, "WORKER_JOB_ID_MISSING");
  const reportedModel = text(result.model, 120);
  if (reportedModel && job.providerModel && reportedModel !== job.providerModel) {
    throw apiError("Worker báo model khác với model đã quote.", 502, "WORKER_MODEL_MISMATCH");
  }
  const outputUri = text(result.outputUrl || result.output?.url, 2200);
  const status = workerStatus(result.status, "submitted");
  if (status === "completed" && !allowedWorkerOutput(outputUri, env)) {
    throw apiError("Worker báo hoàn tất nhưng output URL không thuộc host đã cho phép.", 502, "WORKER_OUTPUT_INVALID");
  }
  return {
    providerJobId,
    providerModel: reportedModel || text(job.providerModel, 120) || null,
    status,
    stage: text(result.stage, 80) || "worker-submitted",
    progress: progressOrNull(result.progress),
    ...(status === "completed" ? { providerOutputUri: outputUri, outputMimeType: text(result.output?.mimeType, 100) || "video/mp4", completedAt: new Date() } : {})
  };
}

async function pollWorker(job, env = process.env) {
  const providerJobId = text(job.providerJobId, 500);
  if (!providerJobId) throw apiError("Job worker thiếu providerJobId.", 500, "WORKER_JOB_ID_MISSING");
  const result = await workerRequest(`v1/video-remake/jobs/${encodeURIComponent(providerJobId)}`, {}, env);
  const status = workerStatus(result.status, job.status);
  const outputUri = text(result.outputUrl || result.output?.url, 2200);
  if (status === "completed" && !allowedWorkerOutput(outputUri, env)) {
    throw apiError("Output URL của worker không thuộc host đã cho phép.", 502, "WORKER_OUTPUT_INVALID");
  }
  return {
    status,
    stage: text(result.stage, 80) || job.stage,
    progress: progressOrNull(result.progress),
    checkpoint: safeObject(result.checkpoint || job.checkpoint),
    error: status === "failed" ? {
      code: text(result.error?.code, 100) || "WORKER_JOB_FAILED",
      message: text(result.error?.message || result.error, 500) || "Media AI worker báo tác vụ thất bại.",
      retryable: result.error?.retryable !== false
    } : null,
    ...(status === "completed" ? {
      providerOutputUri: outputUri,
      outputMimeType: text(result.output?.mimeType, 100) || "video/mp4",
      completedAt: new Date()
    } : {})
  };
}

async function workerControl(job, action, env = process.env) {
  const providerJobId = text(job.providerJobId, 500);
  if (!providerJobId) return { supported: false, confirmed: false, message: "Worker job ID chưa tồn tại." };
  return workerRequest(`v1/video-remake/jobs/${encodeURIComponent(providerJobId)}/${action}`, {
    method: "POST",
    body: { clientJobId: String(job._id), attempt: Number(job.attempt) || 1, checkpoint: safeObject(job.checkpoint) }
  }, env);
}

async function reserveQuota(db, user, estimate, env = process.env) {
  const policy = billingState(user, env);
  if (!policy.canCreate) throw apiError(policy.reason, 403, "AI_VIDEO_BILLING_ACCESS_REQUIRED");
  if (!policy.admin && (!estimate.pricingConfigured || policy.dailyUsdLimit == null)) {
    throw apiError(
      "Tài khoản thường chỉ được render khi máy chủ cấu hình đơn giá và AI_VIDEO_DAILY_USD_LIMIT.",
      503,
      "AI_VIDEO_USER_QUOTA_NOT_CONFIGURED"
    );
  }
  const day = utcDayKey();
  const key = `${String(user._id)}:${day}`;
  const collection = db.collection(USAGE_COLLECTION);
  const now = new Date();
  await collection.updateOne({ _id: key }, {
    $setOnInsert: {
      userId: user._id,
      day,
      jobs: 0,
      estimatedUsd: 0,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000)
    }
  }, { upsert: true });

  const cost = Number(estimate.amount) || 0;
  const filter = { _id: key, jobs: { $lt: policy.dailyJobLimit } };
  if (policy.dailyUsdLimit != null) filter.estimatedUsd = { $lte: Math.max(0, policy.dailyUsdLimit - cost) };
  const result = await collection.updateOne(filter, {
    $inc: { jobs: 1, estimatedUsd: cost },
    $set: { updatedAt: now }
  });
  if (!result.modifiedCount) {
    throw apiError("Đã đạt giới hạn render hoặc ngân sách AI Video hôm nay.", 409, "AI_VIDEO_DAILY_QUOTA_EXCEEDED");
  }
  return { key, cost };
}

async function releaseQuota(db, reservation) {
  if (!reservation?.key) return;
  await db.collection(USAGE_COLLECTION).updateOne({ _id: reservation.key }, {
    $inc: { jobs: -1, estimatedUsd: -(Number(reservation.cost) || 0) },
    $set: { updatedAt: new Date() }
  }).catch(() => {});
}

async function dispatchJob(db, job, assets, env = process.env) {
  const jobs = db.collection(JOBS_COLLECTION);
  try {
    const provider = job.adapter === "veo" ? await startVeo(job.input, env) : await startWorker(job, assets, env);
    const now = new Date();
    const update = {
      ...provider,
      submittedAt: now,
      updatedAt: now,
      error: null,
      checkpoint: { ...(job.checkpoint || {}), stage: provider.stage || "provider-submitted", submittedAt: now }
    };
    const saved = await jobs.findOneAndUpdate(
      { _id: job._id, userId: job.userId, version: Number(job.version) || 1 },
      { $set: update, $inc: { version: 1 } },
      { returnDocument: "after" }
    );
    return saved || await jobs.findOne({ _id: job._id, userId: job.userId }) || { ...job, ...update };
  } catch (error) {
    const now = new Date();
    const ambiguous = error.ambiguousSubmission === true;
    const update = {
      status: ambiguous ? "submission-unknown" : "failed",
      stage: ambiguous ? "submission-unknown" : "dispatch-failed",
      progress: null,
      providerMayContinue: ambiguous,
      error: {
        code: text(error.code, 100) || "VIDEO_DISPATCH_FAILED",
        message: ambiguous
          ? `${text(error.message, 360)} Provider có thể đã nhận tác vụ; không tự gửi lại để tránh tính phí trùng.`
          : text(error.message, 500),
        retryable: true,
        ambiguousSubmission: ambiguous
      },
      updatedAt: now,
      checkpoint: { ...(job.checkpoint || {}), stage: ambiguous ? "submission-unknown" : "dispatch-failed", failedAt: now }
    };
    const saved = await jobs.findOneAndUpdate(
      { _id: job._id, userId: job.userId, version: Number(job.version) || 1 },
      { $set: update, $inc: { version: 1 } },
      { returnDocument: "after" }
    );
    return saved || await jobs.findOne({ _id: job._id, userId: job.userId }) || { ...job, ...update };
  }
}

async function refreshJob(db, job, env = process.env) {
  if (!ACTIVE_STATUSES.has(job.status)) return job;
  let provider;
  try {
    provider = job.adapter === "veo" ? await pollVeo(job, env) : await pollWorker(job, env);
  } catch (error) {
    return {
      ...job,
      lastPollError: { code: text(error.code, 100) || "PROVIDER_STATUS_UNAVAILABLE", message: text(error.message, 500) },
      updatedAt: new Date()
    };
  }
  const now = new Date();
  if (["pause-requested", "cancel-requested"].includes(job.status)
    && ["queued", "dispatching", "submitted", "running"].includes(provider.status)) {
    provider.status = job.status;
    provider.providerMayContinue = true;
  }
  const update = {
    ...provider,
    updatedAt: now,
    lastPolledAt: now,
    ...(provider.status === "completed" ? { completedAt: provider.completedAt || now } : {})
  };
  const saved = await db.collection(JOBS_COLLECTION).findOneAndUpdate(
    { _id: job._id, userId: job.userId, version: Number(job.version) || 1 },
    { $set: update, $inc: { version: 1 } },
    { returnDocument: "after" }
  );
  return saved || await db.collection(JOBS_COLLECTION).findOne({ _id: job._id, userId: job.userId }) || { ...job, ...update };
}

async function createJob(req, res, db, user, body) {
  assertMethod(req, "POST");
  await enforceRateLimit(db, `ai-video-create:${String(user._id)}`, 30, 24 * 60 * 60 * 1000);
  const request = normalizeRenderRequest(body);
  const hash = idempotencyHash(user._id, body.idempotencyKey);
  const jobs = db.collection(JOBS_COLLECTION);
  const replay = await jobs.findOne({ userId: user._id, idempotencyHash: hash });
  if (replay) return res.status(200).json({ ok: true, idempotentReplay: true, job: publicJob(replay) });

  const assets = await ownedAssets(db, user, assetIdsOf(request), request.mediaProjectId);
  assertAssetKinds(request, assets);
  const quote = await consumeQuote(db, user, body, request, hash);
  const capabilities = publicCapabilities(user);
  const adapter = selectAdapter(capabilities, request);
  const model = resolveProviderModel(request, adapter, capabilities);
  if (quote.adapter !== adapter || quote.model !== model) {
    await releaseQuote(db, quote, hash);
    throw apiError("Cấu hình provider đã thay đổi sau khi báo giá; hãy tạo quote mới.", 409, "QUOTE_PROVIDER_CHANGED");
  }
  let reservation;
  try { reservation = await reserveQuota(db, user, quote.estimate); }
  catch (error) {
    await releaseQuote(db, quote, hash);
    throw error;
  }
  const now = new Date();
  const rightsManifest = {
    rightsAttested: request.rightsAttested === true,
    rightsAttestedAt: request.rightsAttested === true ? now : null,
    characterConsentAttested: request.characterConsentAttested === true,
    characterConsentAttestedAt: request.characterConsentAttested === true ? now : null,
    attestedByUserId: user._id
  };
  const doc = {
    userId: user._id,
    idempotencyHash: hash,
    mode: request.mode,
    input: request,
    adapter,
    providerModel: model,
    workerProvider: adapter === "media-ai-worker"
      ? (["gemini-omni", "wan2.2"].includes(request.requestedProvider)
        ? request.requestedProvider
        : capabilities.providers.worker.declaredProviders[0] || "custom")
      : null,
    status: "dispatching",
    stage: "created",
    progress: null,
    attempt: 1,
    estimate: quote.estimate,
    quoteId: quote._id,
    estimateAcceptedAt: now,
    rightsManifest,
    checkpoint: {
      stage: "created",
      attempt: 1,
      sceneId: request.sceneId || null,
      sourceRange: request.sourceRange,
      completedSceneIds: []
    },
    providerMayContinue: false,
    providerControlConfirmed: false,
    version: 1,
    createdAt: now,
    updatedAt: now
  };
  try {
    const result = await jobs.insertOne(doc);
    doc._id = result.insertedId;
  } catch (error) {
    await releaseQuota(db, reservation);
    await releaseQuote(db, quote, hash);
    if (error?.code === 11000) {
      const existing = await jobs.findOne({ userId: user._id, idempotencyHash: hash });
      if (existing) return res.status(200).json({ ok: true, idempotentReplay: true, job: publicJob(existing) });
    }
    throw error;
  }
  const dispatched = await dispatchJob(db, doc, assets);
  if (dispatched.status === "failed") await releaseQuota(db, reservation);
  return res.status(202).json({
    ok: true,
    idempotentReplay: false,
    providerAccepted: ["submitted", "running", "queued", "completed"].includes(dispatched.status),
    warning: dispatched.status === "submission-unknown"
      ? "Job đã được lưu nhưng chưa thể xác nhận provider có nhận hay không. Không tạo job mới; hãy kiểm tra trạng thái hoặc retry có xác nhận."
      : dispatched.status === "failed" ? "Job đã được lưu nhưng provider từ chối trước khi bắt đầu. Có thể sửa cấu hình rồi retry bằng quote mới." : null,
    job: publicJob(dispatched)
  });
}

function analysisEstimate(visual, env = process.env) {
  const configuredValue = visual ? env.MEDIA_AI_WORKER_ANALYSIS_USD_PER_REQUEST : env.AI_VIDEO_DIRECTOR_USD_PER_REQUEST;
  const raw = String(configuredValue ?? "").trim() === "" ? NaN : Number(configuredValue);
  const configured = Number.isFinite(raw) && raw >= 0;
  return {
    currency: "USD",
    billingUnit: "analysis-request",
    quantity: 1,
    unitRate: configured ? raw : null,
    amount: configured ? raw : null,
    pricingConfigured: configured,
    pricingVersion: text(env.AI_VIDEO_PRICING_VERSION, 80) || null,
    disclaimer: configured
      ? "Ước tính phân tích theo cấu hình máy chủ."
      : "Chưa cấu hình đơn giá phân tích; chỉ owner/billing user được phép chạy."
  };
}

function analysisProviderSpec(request, capabilities, env = process.env) {
  if (request.visualAnalysis) {
    if (!capabilities.analysis.visualSourceAnalysis) {
      throw apiError("Visual analysis cần worker có khai báo đầy đủ mode, provider và model.", 503, "VISUAL_ANALYSIS_WORKER_REQUIRED");
    }
    const model = resolveProviderModel(
      { requestedProvider: "worker", requestedModel: "" },
      "media-ai-worker",
      capabilities,
      env
    );
    return {
      adapter: "media-ai-worker-analysis",
      provider: capabilities.providers.worker.declaredProviders[0],
      model
    };
  }
  if (!capabilities.analysis.directorPlan || !capabilities.providers.director.model) {
    throw apiError("Gemini Director chưa được cấu hình trên máy chủ.", 503, "DIRECTOR_NOT_CONFIGURED");
  }
  return {
    adapter: "gemini-director",
    provider: "gemini",
    model: capabilities.providers.director.model
  };
}

async function estimateAnalysis(req, res, db, user, body) {
  assertMethod(req, "POST");
  await enforceRateLimit(db, `ai-video-analysis-estimate:${String(user._id)}`, 120, 10 * 60 * 1000);
  const request = normalizeAnalysisRequest(body);
  const ids = analysisAssetIdsOf(request);
  const assets = await ownedAssets(db, user, ids, request.mediaProjectId);
  assertAnalysisAssetKinds(request, assets);
  const capabilities = publicCapabilities(user);
  const provider = analysisProviderSpec(request, capabilities);
  const calculated = analysisEstimate(request.visualAnalysis);
  const quote = await createQuote(db, user, request, provider.adapter, provider.model, calculated, "analysis");
  return res.status(200).json({
    ok: true,
    supported: true,
    adapter: provider.adapter,
    provider: provider.provider,
    model: provider.model,
    estimate: calculated,
    quote: { ...quote, pricingConfigured: calculated.pricingConfigured },
    requiresExplicitAcceptance: true
  });
}

async function analyze(req, res, db, user, body) {
  assertMethod(req, "POST");
  await enforceRateLimit(db, `ai-video-director:${String(user._id)}`, 60, 24 * 60 * 60 * 1000);
  const request = normalizeAnalysisRequest(body);
  const ids = analysisAssetIdsOf(request);
  const hash = idempotencyHash(user._id, body.idempotencyKey);
  const analyses = db.collection(ANALYSES_COLLECTION);
  const replay = await analyses.findOne({ userId: user._id, idempotencyHash: hash });
  if (replay) {
    return res.status(replay.status === "completed" ? 200 : 202).json({
      ok: true,
      idempotentReplay: true,
      analysis: {
        id: String(replay._id),
        status: replay.status,
        provider: replay.provider,
        model: replay.model,
        error: safeObject(replay.error || null),
        createdAt: replay.createdAt,
        updatedAt: replay.updatedAt
      },
      ...(replay.status === "completed" ? {
        planId: replay.planId ? String(replay.planId) : null,
        provider: replay.provider,
        model: replay.model,
        analysisBasis: replay.analysisBasis,
        plan: replay.plan
      } : {})
    });
  }

  const assets = await ownedAssets(db, user, ids, request.mediaProjectId);
  assertAnalysisAssetKinds(request, assets);
  const capabilities = publicCapabilities(user);
  const providerSpec = analysisProviderSpec(request, capabilities);
  const visual = request.visualAnalysis;
  let signedAssets = [];
  let directorPrompt = "";
  if (visual) {
    signedAssets = await Promise.all(assets.map(signedWorkerAsset));
  } else {
    directorPrompt = buildDirectorPrompt({
      brief: request.brief,
      mode: request.mode,
      targetDurationSeconds: request.targetDurationSeconds
    }, assets);
  }
  const quote = await consumeQuote(db, user, body, request, hash, "analysis");
  if (quote.adapter !== providerSpec.adapter || quote.model !== providerSpec.model) {
    await releaseQuote(db, quote, hash);
    throw apiError("Cấu hình analysis provider đã đổi sau khi quote; hãy lấy quote mới.", 409, "ANALYSIS_QUOTE_PROVIDER_CHANGED");
  }
  let reservation;
  try { reservation = await reserveQuota(db, user, quote.estimate); }
  catch (error) {
    await releaseQuote(db, quote, hash);
    throw error;
  }
  const now = new Date();
  const record = {
    userId: user._id,
    idempotencyHash: hash,
    quoteId: quote._id,
    estimate: quote.estimate,
    estimateAcceptedAt: now,
    request,
    provider: providerSpec.provider,
    adapter: providerSpec.adapter,
    model: providerSpec.model,
    status: "analyzing",
    analysisBasis: visual ? "worker-visual-analysis" : "brief-and-owned-asset-metadata",
    sourceAssetIds: ids.map((id) => new ObjectId(id)),
    rightsManifest: {
      rightsAttested: request.rightsAttested === true,
      rightsAttestedAt: request.rightsAttested === true ? now : null,
      characterConsentAttested: request.characterConsentAttested === true,
      characterConsentAttestedAt: request.characterConsentAttested === true ? now : null,
      attestedByUserId: user._id
    },
    createdAt: now,
    updatedAt: now
  };
  try {
    record._id = (await analyses.insertOne(record)).insertedId;
  } catch (error) {
    await releaseQuota(db, reservation);
    await releaseQuote(db, quote, hash);
    if (error?.code === 11000) {
      const existing = await analyses.findOne({ userId: user._id, idempotencyHash: hash });
      if (existing) return res.status(202).json({ ok: true, idempotentReplay: true, analysis: { id: String(existing._id), status: existing.status } });
    }
    throw error;
  }

  let result;
  try {
    if (visual) {
      const worker = await workerRequest("v1/video-remake/analyze", {
        method: "POST",
        body: {
          clientAnalysisId: String(record._id),
          ownerId: String(user._id),
          brief: request.brief,
          mode: request.mode,
          provider: providerSpec.provider,
          model: providerSpec.model,
          assets: signedAssets,
          rightsAttested: ids.length > 0,
          characterConsentAttested: request.characterConsentAttested === true
        }
      });
      const reportedModel = text(worker.model, 120);
      if (reportedModel && reportedModel !== providerSpec.model) {
        throw apiError("Worker analysis báo model khác model đã quote.", 502, "ANALYSIS_MODEL_MISMATCH");
      }
      result = {
        plan: constrainDirectorPlan(worker.plan || worker.storyboard, ids, "worker-visual-analysis"),
        model: reportedModel || providerSpec.model,
        analysisBasis: "worker-visual-analysis",
        provider: providerSpec.provider
      };
    } else {
      const director = await geminiDirectorPlan(directorPrompt);
      if (director.model !== providerSpec.model) {
        throw apiError("Gemini Director model không khớp model đã quote.", 502, "ANALYSIS_MODEL_MISMATCH");
      }
      result = {
        ...director,
        plan: constrainDirectorPlan(director.plan, ids, "brief-and-owned-asset-metadata"),
        analysisBasis: "brief-and-owned-asset-metadata",
        provider: "gemini"
      };
    }
  } catch (error) {
    const statusCode = Number(error.statusCode || error.providerStatus || 0);
    const ambiguous = !statusCode || statusCode === 408 || statusCode === 429 || statusCode >= 500;
    if (!ambiguous) {
      await releaseQuota(db, reservation);
    }
    const failedAt = new Date();
    const failure = {
      code: text(error.code, 100) || "ANALYSIS_FAILED",
      message: text(error.message, 500),
      ambiguousSubmission: ambiguous
    };
    await analyses.updateOne({ _id: record._id, userId: user._id, status: "analyzing" }, {
      $set: {
        status: ambiguous ? "submission-unknown" : "failed",
        error: failure,
        providerMayContinue: ambiguous,
        updatedAt: failedAt
      }
    });
    return res.status(202).json({
      ok: true,
      idempotentReplay: false,
      analysis: {
        id: String(record._id),
        status: ambiguous ? "submission-unknown" : "failed",
        provider: providerSpec.provider,
        model: providerSpec.model,
        error: failure
      },
      warning: ambiguous
        ? "Analysis đã được lưu nhưng chưa rõ provider đã xử lý/tính phí hay chưa. Không gửi lại cùng yêu cầu bằng key mới."
        : "Analysis đã được lưu nhưng provider từ chối trước khi hoàn tất."
    });
  }
  const completedAt = new Date();
  const planRecord = {
    userId: user._id,
    provider: result.provider,
    model: result.model,
    analysisBasis: result.analysisBasis,
    sourceAssetIds: ids.map((id) => new ObjectId(id)),
    plan: result.plan,
    usage: safeObject(result.usage || null),
    createdAt: completedAt
  };
  await analyses.updateOne({ _id: record._id, userId: user._id, status: "analyzing" }, {
    $set: {
      status: "completed",
      plan: result.plan,
      provider: result.provider,
      model: result.model,
      analysisBasis: result.analysisBasis,
      completedAt,
      updatedAt: completedAt,
      error: null
    }
  });
  let planId = null;
  try {
    planId = (await db.collection(PLANS_COLLECTION).insertOne(planRecord)).insertedId;
    await analyses.updateOne({ _id: record._id, userId: user._id, status: "completed" }, {
      $set: { planId, updatedAt: new Date() }
    });
  } catch {
    // The owner-scoped analysis record already contains the complete plan. A
    // secondary plan-library write must not make the paid result disappear.
  }
  return res.status(200).json({
    ok: true,
    idempotentReplay: false,
    analysis: { id: String(record._id), status: "completed", provider: result.provider, model: result.model },
    planId: planId ? String(planId) : null,
    provider: result.provider,
    model: result.model,
    analysisBasis: result.analysisBasis,
    plan: result.plan
  });
}

async function estimate(req, res, db, user, body) {
  assertMethod(req, "POST");
  await enforceRateLimit(db, `ai-video-estimate:${String(user._id)}`, 300, 10 * 60 * 1000);
  const request = normalizeRenderRequest(body);
  const capabilities = publicCapabilities(user);
  let adapter;
  try { adapter = selectAdapter(capabilities, request); }
  catch (error) {
    return res.status(200).json({ ok: true, supported: false, code: error.code, message: error.message, estimate: null, capabilities });
  }
  const assets = await ownedAssets(db, user, assetIdsOf(request), request.mediaProjectId);
  assertAssetKinds(request, assets);
  const model = resolveProviderModel(request, adapter, capabilities);
  const calculated = estimateRequest(request, { adapter, model, env: process.env });
  const quote = await createQuote(db, user, request, adapter, model, calculated);
  return res.status(200).json({
    ok: true,
    supported: true,
    adapter,
    model,
    estimate: calculated,
    quote: { ...quote, pricingConfigured: calculated.pricingConfigured },
    requiresExplicitAcceptance: true
  });
}

async function status(req, res, db, user) {
  assertMethod(req, "GET");
  await enforceRateLimit(db, `ai-video-status:${String(user._id)}`, 600, 60 * 60 * 1000);
  const id = objectId(req.query?.id, "Job ID");
  let job = await db.collection(JOBS_COLLECTION).findOne({ _id: id, userId: user._id });
  if (!job) throw apiError("Không tìm thấy tác vụ video thuộc tài khoản này.", 404, "JOB_NOT_FOUND");
  job = await refreshJob(db, job);
  return res.status(200).json({ ok: true, job: publicJob(job) });
}

async function control(req, res, db, user, body, action) {
  assertMethod(req, "POST");
  await enforceRateLimit(db, `ai-video-control:${String(user._id)}`, 180, 60 * 60 * 1000);
  const id = objectId(body.id || req.query?.id, "Job ID");
  const jobs = db.collection(JOBS_COLLECTION);
  const job = await jobs.findOne({ _id: id, userId: user._id });
  if (!job) throw apiError("Không tìm thấy tác vụ video thuộc tài khoản này.", 404, "JOB_NOT_FOUND");

  if (action === "retry") {
    if (job.status === "submission-unknown" && body.confirmPossibleDuplicate !== true) {
      throw apiError(
        "Provider có thể đã nhận lần gửi trước. Hãy xác nhận confirmPossibleDuplicate=true nếu vẫn muốn thử lại và chấp nhận nguy cơ tính phí trùng.",
        409,
        "POSSIBLE_DUPLICATE_CONFIRMATION_REQUIRED"
      );
    }
    let transitioned = transitionJob(job, action, new Date());
    const retryHash = idempotencyHash(user._id, `retry:${String(job._id)}:${transitioned.attempt}`);
    const quote = await consumeQuote(db, user, body, transitioned.input, retryHash);
    if (quote.adapter !== transitioned.adapter || quote.model !== transitioned.providerModel) {
      await releaseQuote(db, quote, retryHash);
      throw apiError("Quote retry không khớp provider/model của job.", 409, "RETRY_QUOTE_PROVIDER_MISMATCH");
    }
    let reservation;
    try { reservation = await reserveQuota(db, user, quote.estimate); }
    catch (error) {
      await releaseQuote(db, quote, retryHash);
      throw error;
    }
    const assets = await ownedAssets(db, user, assetIdsOf(transitioned.input), transitioned.input.mediaProjectId);
    assertAssetKinds(transitioned.input, assets);
    transitioned = {
      ...transitioned,
      quoteId: quote._id,
      estimate: quote.estimate,
      estimateAcceptedAt: new Date(),
      version: (Number(job.version) || 1) + 1
    };
    const claimed = await jobs.replaceOne(
      { _id: id, userId: user._id, version: Number(job.version) || 1, status: job.status },
      transitioned
    );
    if (!claimed.modifiedCount) {
      await releaseQuota(db, reservation);
      await releaseQuote(db, quote, retryHash);
      throw apiError("Job vừa được điều khiển ở yêu cầu khác; không gửi retry trùng.", 409, "JOB_VERSION_CONFLICT");
    }
    transitioned = await dispatchJob(db, transitioned, assets);
    if (transitioned.status === "failed") await releaseQuota(db, reservation);
    return res.status(202).json({
      ok: true,
      providerAccepted: ["submitted", "running", "queued", "completed"].includes(transitioned.status),
      warning: transitioned.status === "submission-unknown"
        ? "Retry đã được lưu nhưng trạng thái gửi provider chưa rõ; không tự gửi thêm lần nữa."
        : transitioned.status === "failed" ? "Retry đã được lưu nhưng provider từ chối trước khi chạy." : null,
      job: publicJob(transitioned)
    });
  }

  let transitioned = transitionJob(job, action, new Date(), {
    awaitingProviderAck: ["pause", "cancel"].includes(action)
  });
  transitioned.providerControlConfirmed = false;
  transitioned.providerMayContinue = ["pause", "cancel"].includes(action);
  transitioned.version = (Number(job.version) || 1) + 1;
  const claimed = await jobs.replaceOne(
    { _id: id, userId: user._id, version: Number(job.version) || 1, status: job.status },
    transitioned
  );
  if (!claimed.modifiedCount) {
    throw apiError("Job vừa được điều khiển ở yêu cầu khác. Hãy tải lại trạng thái.", 409, "JOB_VERSION_CONFLICT");
  }

  if (job.adapter === "media-ai-worker") {
    try {
      const result = await workerControl(job, action);
      const confirmed = result.confirmed === true;
      transitioned.providerControlConfirmed = confirmed;
      transitioned.providerMayContinue = !confirmed && ["pause", "cancel"].includes(action);
      transitioned.checkpoint = {
        ...(transitioned.checkpoint || {}),
        providerControl: { action, confirmed, message: text(result.message, 300) || null }
      };
      if (confirmed) {
        const acknowledgedStatus = canonicalStatus(result.status);
        transitioned.status = VIDEO_STATUSES.has(acknowledgedStatus)
          ? acknowledgedStatus
          : action === "pause" ? "paused" : action === "cancel" ? "canceled" : transitioned.status;
      }
    } catch (error) {
      transitioned.providerControlConfirmed = false;
      transitioned.providerMayContinue = ["pause", "cancel"].includes(action);
      transitioned.checkpoint = {
        ...(transitioned.checkpoint || {}),
        providerControl: { action, confirmed: false, message: text(error.message, 300) }
      };
    }
  } else {
    transitioned.providerControlConfirmed = false;
    transitioned.providerMayContinue = ["pause", "cancel"].includes(action);
    transitioned.checkpoint = {
      ...(transitioned.checkpoint || {}),
      providerControl: {
        action,
        confirmed: false,
        message: action === "resume"
          ? "Đã tiếp tục polling operation Veo."
          : "Veo chưa xác nhận điều khiển từ xa; provider có thể vẫn tiếp tục và phát sinh chi phí."
      }
    };
  }
  transitioned.updatedAt = new Date();
  const acknowledged = await jobs.replaceOne(
    { _id: id, userId: user._id, version: transitioned.version },
    { ...transitioned, version: transitioned.version + 1 }
  );
  if (acknowledged.modifiedCount) transitioned.version += 1;
  else transitioned = await jobs.findOne({ _id: id, userId: user._id }) || transitioned;
  if (action === "resume") transitioned = await refreshJob(db, transitioned);
  return res.status(200).json({ ok: true, job: publicJob(transitioned) });
}

async function proxyDownload(req, res, db, user) {
  assertMethod(req, "GET");
  await enforceRateLimit(db, `ai-video-download:${String(user._id)}`, 100, 60 * 60 * 1000);
  const id = objectId(req.query?.id, "Job ID");
  const job = await db.collection(JOBS_COLLECTION).findOne({ _id: id, userId: user._id });
  if (!job) throw apiError("Không tìm thấy tác vụ video thuộc tài khoản này.", 404, "JOB_NOT_FOUND");
  if (job.status !== "completed" || !text(job.providerOutputUri, 2200)) {
    throw apiError("Video chưa sẵn sàng để tải.", 409, "VIDEO_NOT_READY");
  }
  const uri = String(job.providerOutputUri);
  let upstream;
  if (job.adapter === "veo") {
    if (!allowedGoogleOutput(uri)) throw apiError("Output Veo không hợp lệ.", 500, "VEO_OUTPUT_INVALID");
    const apiKey = veoKeyForJob(job);
    upstream = await fetch(uri, {
      headers: { "x-goog-api-key": apiKey },
      redirect: "error",
      signal: AbortSignal.timeout(25000)
    });
  } else {
    if (!allowedWorkerOutput(uri)) throw apiError("Output worker không hợp lệ.", 500, "WORKER_OUTPUT_INVALID");
    const outputOrigin = new URL(uri).origin;
    const workerOrigin = safeWorkerBase().origin;
    upstream = await fetch(uri, {
      headers: outputOrigin === workerOrigin ? { Authorization: `Bearer ${String(process.env.MEDIA_AI_WORKER_TOKEN)}` } : {},
      redirect: "error",
      signal: AbortSignal.timeout(25000)
    });
  }
  if (!upstream.ok || !upstream.body) {
    throw apiError(`Không tải được video từ provider (HTTP ${upstream.status}).`, 502, "VIDEO_DOWNLOAD_FAILED");
  }
  const mimeType = text(upstream.headers.get("content-type"), 100).toLowerCase();
  if (!mimeType.startsWith("video/")) throw apiError("Provider không trả về MIME video hợp lệ.", 502, "VIDEO_DOWNLOAD_MIME_INVALID");
  const contentLength = Number(upstream.headers.get("content-length"));
  const maximumBytes = positiveInteger(process.env.AI_VIDEO_PROXY_MAX_BYTES, 100 * 1024 * 1024, 2 * 1024 * 1024 * 1024);
  if (!Number.isFinite(contentLength) || contentLength <= 0) {
    throw apiError("Provider không công bố kích thước video; Vercel không thể proxy an toàn. Hãy để worker lưu output vào private Blob.", 502, "VIDEO_PROXY_SIZE_UNKNOWN");
  }
  if (contentLength > maximumBytes) {
    throw apiError("Video vượt giới hạn proxy của serverless. Hãy tải qua private Blob/signed URL từ Media Cloud.", 413, "VIDEO_PROXY_TOO_LARGE");
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Length", String(contentLength));
  res.setHeader("Content-Disposition", `attachment; filename="hh-ai-video-${String(job._id)}.mp4"`);
  res.setHeader("Cache-Control", "private, no-store");
  await pipeline(Readable.fromWeb(upstream.body), res);
}

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    const user = await currentUser(req);
    if (!user) throw apiError("Bạn cần đăng nhập để sử dụng AI Video Remake Studio.", 401, "AUTH_REQUIRED");
    await ensureIndexes(db);
    const action = normalizeAction(req.query?.action || body.action || "capabilities");

    if (action === "capabilities") {
      assertMethod(req, "GET");
      return res.status(200).json({ ok: true, capabilities: publicCapabilities(user) });
    }
    if (action === "estimate") return estimate(req, res, db, user, body);
    if (action === "estimate-analysis") return estimateAnalysis(req, res, db, user, body);
    if (action === "analyze") return analyze(req, res, db, user, body);
    if (action === "create-job") return createJob(req, res, db, user, body);
    if (action === "status") return status(req, res, db, user);
    if (["pause", "resume", "retry", "cancel"].includes(action)) return control(req, res, db, user, body, action);
    if (action === "download") return proxyDownload(req, res, db, user);
    throw apiError("Tác vụ không được hỗ trợ.", 400, "ACTION_UNSUPPORTED");
  });
};

module.exports.__test = Object.freeze({
  allowedGoogleOutput,
  allowedWorkerOutput,
  billingState,
  jsonFromModel,
  publicCapabilities,
  resolveProviderModel,
  utcDayKey,
  workerStatus
});
