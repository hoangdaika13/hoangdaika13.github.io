(function (root, factory) {
  "use strict";
  const api = factory(root || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HHAIVideoRemakeStudio = api;
})(typeof window !== "undefined" ? window : globalThis, function (global) {
  "use strict";

  const VERSION = "1.0.0";
  const STORAGE_PREFIX = "hh.ai-video-remake.v1";
  const DEFAULT_API_BASE = "/api/ai-video-remake";
  const MAX_SOURCE_BYTES = 2 * 1024 * 1024 * 1024;
  const MAX_CHARACTER_IMAGE_BYTES = 25 * 1024 * 1024;
  const MAX_CHARACTER_REFERENCES = 8;
  const MAX_PROMPT_LENGTH = 4000;
  const MAX_SAFE_BATCH = 10;
  const POLL_INTERVAL_MS = 10_500;

  const MODES = Object.freeze([
    {
      id: "video-remix",
      label: "Video Remix",
      shortLabel: "Remix",
      description: "Giữ nhịp chuyển động và góc máy của video nguồn, rồi thay đổi bối cảnh, ánh sáng hoặc vật thể.",
      requiresSource: true,
      requiresCharacter: false
    },
    {
      id: "character-replace",
      label: "Thay nhân vật",
      shortLabel: "Nhân vật",
      description: "Dùng bộ ảnh tham chiếu để thay nhân vật, theo dõi cơ thể và giữ che khuất tự nhiên.",
      requiresSource: true,
      requiresCharacter: true
    },
    {
      id: "text-to-video",
      label: "Tạo từ yêu cầu",
      shortLabel: "Prompt",
      description: "Tạo quảng cáo, phim ngắn, YouTube Shorts hoặc TikTok từ mô tả tiếng Việt.",
      requiresSource: false,
      requiresCharacter: false
    },
    {
      id: "ai-director",
      label: "AI Director",
      shortLabel: "Đạo diễn",
      description: "Phân tích ý tưởng, chia cảnh, tạo storyboard, lời thoại và prompt điện ảnh trước khi render.",
      requiresSource: false,
      requiresCharacter: false
    }
  ]);

  // Price values are a UI fallback only. The backend estimate always wins and the
  // interface labels these values as estimates, never as a provider invoice.
  const MODEL_CATALOG = Object.freeze([
    {
      id: "auto",
      label: "Tự động · backend quyết định model",
      provider: "Backend",
      kind: "render",
      supportedModes: ["video-remix", "character-replace", "text-to-video", "ai-director"],
      supportedDurations: [4, 6, 8, 10],
      supportedResolutions: ["720p", "1080p", "4k"],
      estimateUsdPerSecond: null,
      availability: "backend-check"
    },
    {
      id: "server-veo",
      label: "Veo · cấu hình máy chủ",
      provider: "Google",
      kind: "render",
      supportedModes: ["text-to-video", "ai-director"],
      supportedDurations: [4, 6, 8],
      supportedResolutions: ["720p", "1080p", "4k"],
      estimateUsdPerSecond: null,
      availability: "backend-check"
    },
    {
      id: "server-worker",
      label: "Video Worker · cấu hình máy chủ",
      provider: "Worker",
      kind: "edit",
      supportedModes: ["video-remix", "character-replace"],
      supportedDurations: [4, 6, 8, 10],
      supportedResolutions: ["720p", "1080p"],
      estimateUsdPerSecond: null,
      availability: "backend-check"
    },
    {
      id: "server-local-wan",
      label: "Wan2.2 Animate (máy chủ riêng)",
      provider: "Self-hosted",
      kind: "edit",
      supportedModes: ["video-remix", "character-replace"],
      supportedDurations: [4, 6, 8, 10],
      supportedResolutions: ["720p", "1080p"],
      estimateUsdPerSecond: null,
      availability: "backend-check"
    },
    {
      id: "server-director",
      label: "AI Director · cấu hình máy chủ",
      provider: "Google",
      kind: "director",
      supportedModes: ["ai-director"],
      supportedDurations: [4, 6, 8],
      supportedResolutions: ["720p", "1080p", "4k"],
      estimateUsdPerSecond: null,
      availability: "backend-check"
    }
  ]);

  const ASPECT_RATIOS = Object.freeze(["16:9", "9:16", "1:1"]);
  const RESOLUTIONS = Object.freeze(["720p", "1080p", "4k"]);
  const DURATIONS = Object.freeze([4, 6, 8, 10]);
  const QUEUE_STATUSES = Object.freeze([
    "queued", "submitting", "submitted", "dispatching", "running", "pause-requested", "paused",
    "cancel-requested", "submission-unknown", "completed", "failed", "cancelled"
  ]);
  const BACKEND_STATUS_MAP = Object.freeze({ canceled: "cancelled", cancelled: "cancelled" });
  const TRANSITIONS = Object.freeze({
    queued: ["submit", "pause", "cancel", "fail"],
    submitting: ["start", "progress", "pause", "cancel", "fail"],
    submitted: ["start", "progress", "pause", "cancel", "fail"],
    dispatching: ["progress", "pause", "cancel", "fail"],
    running: ["progress", "pause", "complete", "cancel", "fail"],
    "pause-requested": ["progress", "pause", "cancel", "fail"],
    paused: ["resume", "cancel", "fail"],
    "cancel-requested": ["progress", "cancel", "fail"],
    "submission-unknown": ["retry", "cancel"],
    completed: [],
    failed: ["retry", "cancel"],
    cancelled: ["retry"]
  });

  const nowIso = () => new Date().toISOString();
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const uid = (prefix = "item") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const asText = (value, max = 240) => String(value == null ? "" : value).trim().slice(0, max);
  const escapeHtml = (value) => String(value == null ? "" : value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
  const safeId = (value, fallback) => asText(value, 96).replace(/[^a-z0-9._-]/gi, "") || fallback;
  const safeOutputUrl = (value) => {
    const url = asText(value, 2000);
    return /^https:\/\//i.test(url) || /^\/api\/ai-video-remake\?(?:[^#]*&)?action=download(?:&|$)/i.test(url) ? url : "";
  };
  const formatSeconds = (value) => {
    const seconds = Math.max(0, Number(value) || 0);
    const minutes = Math.floor(seconds / 60);
    const rest = seconds - minutes * 60;
    return `${minutes}:${rest.toFixed(rest < 10 ? 1 : 0).padStart(rest < 10 ? 4 : 2, "0")}`;
  };
  const formatBytes = (value) => {
    let size = Math.max(0, Number(value) || 0);
    for (const unit of ["B", "KB", "MB", "GB"]) {
      if (size < 1024 || unit === "GB") return `${size.toFixed(unit === "B" ? 0 : 1)} ${unit}`;
      size /= 1024;
    }
    return "0 B";
  };

  function ownerScope(input = {}) {
    const currentUser = input.currentUser || input.user || {};
    const learnerProfile = input.learnerProfile || {};
    const ownerId = safeId(input.ownerId || currentUser.id || currentUser._id || currentUser.uid, "guest");
    const learnerProfileId = safeId(
      input.learnerProfileId || learnerProfile.id || learnerProfile._id || currentUser.learnerProfileId,
      "default"
    );
    return { ownerId, learnerProfileId };
  }

  function scopedStorageKey(scope = {}) {
    const normalized = ownerScope(scope);
    return `${STORAGE_PREFIX}:${normalized.ownerId}:${normalized.learnerProfileId}`;
  }

  function modeById(id) {
    return MODES.find((mode) => mode.id === id) || MODES[0];
  }

  function modelById(id, catalog = MODEL_CATALOG) {
    const list = Array.isArray(catalog) && catalog.length ? catalog : MODEL_CATALOG;
    return list.find((model) => model.id === id) || list[0] || MODEL_CATALOG[0];
  }

  function compatibleModel(modeId, preferredId, catalog = MODEL_CATALOG) {
    const preferred = modelById(preferredId, catalog);
    if (preferred && preferred.supportedModes?.includes(modeId)) return preferred;
    return catalog.find((model) => model.supportedModes?.includes(modeId)) || MODEL_CATALOG[0];
  }

  function normalizeAsset(value, kind = "source") {
    if (!value || typeof value !== "object") return null;
    const cloudAssetId = safeId(value.cloudAssetId || value.assetId || value.id, "");
    return {
      id: safeId(value.id || cloudAssetId, uid(kind)),
      cloudAssetId,
      mediaProjectId: safeId(value.mediaProjectId || value.cloudProjectId || value.projectId, ""),
      kind: ["source", "character", "reference", "audio"].includes(value.kind) ? value.kind : kind,
      name: asText(value.name || value.fileName || "Tệp chưa đặt tên", 260),
      type: asText(value.type || value.mimeType, 100),
      size: Math.max(0, Number(value.size) || 0),
      duration: Math.max(0, Number(value.duration) || 0),
      width: Math.max(0, Math.round(Number(value.width) || 0)),
      height: Math.max(0, Math.round(Number(value.height) || 0)),
      thumbnail: /^data:image\/(?:jpeg|png|webp);base64,/i.test(value.thumbnail || "") ? value.thumbnail : "",
      cloudState: cloudAssetId ? asText(value.cloudState || value.status || "ready", 40) : "local-only",
      createdAt: asText(value.createdAt, 40) || nowIso()
    };
  }

  function normalizeScene(value, index = 0) {
    const start = Math.max(0, Number(value?.start) || 0);
    const end = Math.max(start, Number(value?.end) || start + 8);
    return {
      id: safeId(value?.id, uid("scene")),
      order: Math.max(0, Number(value?.order ?? index) || 0),
      title: asText(value?.title || `Cảnh ${index + 1}`, 160),
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3)),
      duration: Number(Math.max(0.1, Number(value?.duration) || end - start).toFixed(3)),
      prompt: asText(value?.prompt, MAX_PROMPT_LENGTH),
      thumbnail: /^data:image\/(?:jpeg|png|webp);base64,/i.test(value?.thumbnail || "") ? value.thumbnail : "",
      source: ["backend", "local-duration", "manual", "director"].includes(value?.source) ? value.source : "manual",
      outputUrl: safeOutputUrl(value?.outputUrl),
      outputAssetId: safeId(value?.outputAssetId, "")
    };
  }

  function normalizeQueueItem(value, index = 0) {
    const source = value && typeof value === "object" ? value : {};
    const normalizedStatus = BACKEND_STATUS_MAP[asText(source.status, 40).toLowerCase()] || asText(source.status, 40).toLowerCase();
    const status = QUEUE_STATUSES.includes(normalizedStatus) ? normalizedStatus : "queued";
    const suppliedProgress = source.progress == null ? null : Number(source.progress);
    const progress = status === "completed"
      ? 100
      : (Number.isFinite(suppliedProgress) ? clamp(suppliedProgress, 0, 100) : null);
    const checkpointObject = source.checkpoint && typeof source.checkpoint === "object" ? source.checkpoint : null;
    const checkpointProgress = checkpointObject?.progress ?? checkpointObject?.percent;
    const numericCheckpoint = Number.isFinite(Number(source.checkpoint))
      ? Number(source.checkpoint)
      : Number.isFinite(Number(checkpointProgress))
        ? Number(checkpointProgress)
        : Number.isFinite(progress) ? progress : 0;
    return {
      id: safeId(source.id, uid("job")),
      backendId: safeId(source.backendId || source.jobId, ""),
      sceneId: safeId(source.sceneId, ""),
      title: asText(source.title || `Cảnh ${index + 1}`, 180),
      status,
      progress,
      checkpoint: clamp(numericCheckpoint, 0, 100),
      checkpointStage: asText(source.checkpointStage || checkpointObject?.stage || source.stage, 120),
      retryStage: asText(source.retryStage || checkpointObject?.retryFrom, 120),
      stage: asText(source.stage, 120),
      retryFrom: clamp(source.retryFrom, 0, 100),
      attempts: Math.max(0, Math.round(Number(source.attempts ?? source.attempt) || 0)),
      error: asText(source.error, 600),
      statusWarning: asText(source.statusWarning, 600),
      providerMayContinue: source.providerMayContinue === true || source.provider?.mayContinue === true,
      controlConfirmed: source.controlConfirmed === true || source.provider?.controlConfirmed === true,
      outputUrl: safeOutputUrl(source.outputUrl),
      outputAssetId: safeId(source.outputAssetId, ""),
      quoteId: safeId(source.quoteId || source.acceptedQuoteId, ""),
      quoteExpiresAt: asText(source.quoteExpiresAt, 40) || null,
      acceptedEstimate: source.acceptedEstimate === true || source.costAccepted === true,
      idempotencyKey: safeId(source.idempotencyKey, safeId(source.id, uid("job"))),
      request: source.request && typeof source.request === "object" ? sanitizePublicValue(source.request) : null,
      costEstimateUsd: source.costEstimateUsd == null ? null : Math.max(0, Number(source.costEstimateUsd) || 0),
      createdAt: asText(source.createdAt, 40) || nowIso(),
      updatedAt: asText(source.updatedAt, 40) || nowIso()
    };
  }

  function defaultState() {
    const stamp = nowIso();
    return {
      version: 1,
      project: { id: uid("project"), name: "Dự án video mới", createdAt: stamp, updatedAt: stamp },
      mode: "video-remix",
      modelId: "auto",
      prompt: "",
      settings: {
        durationSeconds: 8,
        aspectRatio: "16:9",
        resolution: "720p",
        variants: 1,
        preserveMotion: 85,
        preserveCamera: 90,
        preserveBackground: 55,
        identityStrength: 88,
        creativity: 45,
        preserveAudio: true
      },
      sourceAsset: null,
      characterAssets: [],
      referenceAssets: [],
      audioAsset: null,
      mediaProjectId: "",
      scenes: [],
      selectedSceneId: "",
      queue: [],
      analysis: { state: "idle", method: "none", message: "", sourceAssetId: "", backendId: "", submission: null, updatedAt: null },
      capabilities: {
        state: "unknown", message: "Chưa kiểm tra máy chủ.", models: [], checkedAt: null,
        billing: { canCreate: false, admin: false, dailyJobLimit: null, dailyUsdLimit: null, reason: "Chưa kiểm tra quyền billing." },
        analysis: { directorPlan: false, visualSourceAnalysis: false },
        limits: {}
      },
      rightsAttested: false,
      characterConsentAttested: false,
      panel: "assets"
    };
  }

  function normalizeState(value) {
    const source = value && typeof value === "object" ? value : {};
    const base = defaultState();
    const mode = MODES.some((entry) => entry.id === source.mode) ? source.mode : base.mode;
    const settings = source.settings && typeof source.settings === "object" ? source.settings : {};
    const scenes = Array.isArray(source.scenes) ? source.scenes.slice(0, 500).map(normalizeScene) : [];
    const queue = Array.isArray(source.queue) ? source.queue.slice(0, 500).map(normalizeQueueItem) : [];
    const characterAssets = Array.isArray(source.characterAssets)
      ? source.characterAssets.slice(0, MAX_CHARACTER_REFERENCES).map((item) => normalizeAsset(item, "character")).filter(Boolean)
      : [];
    const referenceAssets = Array.isArray(source.referenceAssets)
      ? source.referenceAssets.slice(0, MAX_CHARACTER_REFERENCES).map((item) => normalizeAsset(item, "reference")).filter(Boolean)
      : [];
    const projectSource = source.project && typeof source.project === "object" ? source.project : {};
    const capabilitySource = source.capabilities && typeof source.capabilities === "object" ? source.capabilities : {};
    const analysisSource = source.analysis && typeof source.analysis === "object" ? source.analysis : {};
    const selectedSceneId = safeId(source.selectedSceneId, "");
    return {
      version: 1,
      project: {
        id: safeId(projectSource.id, base.project.id),
        name: asText(projectSource.name || base.project.name, 180),
        createdAt: asText(projectSource.createdAt, 40) || base.project.createdAt,
        updatedAt: asText(projectSource.updatedAt, 40) || base.project.updatedAt
      },
      mode,
      modelId: safeId(source.modelId, compatibleModel(mode, base.modelId).id),
      prompt: asText(source.prompt, MAX_PROMPT_LENGTH),
      settings: {
        durationSeconds: DURATIONS.includes(Number(settings.durationSeconds)) ? Number(settings.durationSeconds) : 8,
        aspectRatio: ASPECT_RATIOS.includes(settings.aspectRatio) ? settings.aspectRatio : "16:9",
        resolution: RESOLUTIONS.includes(settings.resolution) ? settings.resolution : "720p",
        variants: Math.round(clamp(settings.variants ?? 1, 1, 3)),
        preserveMotion: clamp(settings.preserveMotion ?? 85, 0, 100),
        preserveCamera: clamp(settings.preserveCamera ?? 90, 0, 100),
        preserveBackground: clamp(settings.preserveBackground ?? 55, 0, 100),
        identityStrength: clamp(settings.identityStrength ?? 88, 0, 100),
        creativity: clamp(settings.creativity ?? 45, 0, 100),
        preserveAudio: settings.preserveAudio !== false
      },
      sourceAsset: normalizeAsset(source.sourceAsset, "source"),
      characterAssets,
      referenceAssets,
      audioAsset: normalizeAsset(source.audioAsset, "audio"),
      mediaProjectId: safeId(source.mediaProjectId, ""),
      scenes,
      selectedSceneId: scenes.some((scene) => scene.id === selectedSceneId) ? selectedSceneId : (scenes[0]?.id || ""),
      queue,
      analysis: {
        state: ["idle", "reading", "local", "submitting", "submission-unknown", "ready", "unsupported", "error"].includes(analysisSource.state)
          ? analysisSource.state : "idle",
        method: ["none", "local-duration", "backend-shot-detection", "director"].includes(analysisSource.method)
          ? analysisSource.method : "none",
        message: asText(analysisSource.message, 600),
        sourceAssetId: safeId(analysisSource.sourceAssetId, ""),
        backendId: safeId(analysisSource.backendId, ""),
        submission: analysisSource.submission && typeof analysisSource.submission === "object"
          ? sanitizePublicValue(analysisSource.submission)
          : null,
        updatedAt: asText(analysisSource.updatedAt, 40) || null
      },
      capabilities: {
        state: ["unknown", "checking", "ready", "unsupported", "error"].includes(capabilitySource.state)
          ? capabilitySource.state : "unknown",
        message: asText(capabilitySource.message || "Chưa kiểm tra máy chủ.", 600),
        models: Array.isArray(capabilitySource.models) ? capabilitySource.models.slice(0, 30).map(normalizeModelCapability).filter(Boolean) : [],
        checkedAt: asText(capabilitySource.checkedAt, 40) || null,
        billing: {
          canCreate: capabilitySource.billing?.canCreate === true,
          admin: capabilitySource.billing?.admin === true,
          dailyJobLimit: capabilitySource.billing?.dailyJobLimit != null && Number.isFinite(Number(capabilitySource.billing.dailyJobLimit)) ? Math.max(0, Number(capabilitySource.billing.dailyJobLimit)) : null,
          dailyUsdLimit: capabilitySource.billing?.dailyUsdLimit != null && Number.isFinite(Number(capabilitySource.billing.dailyUsdLimit)) ? Math.max(0, Number(capabilitySource.billing.dailyUsdLimit)) : null,
          reason: asText(capabilitySource.billing?.reason || "Chưa kiểm tra quyền billing.", 500)
        },
        analysis: {
          directorPlan: capabilitySource.analysis?.directorPlan === true,
          visualSourceAnalysis: capabilitySource.analysis?.visualSourceAnalysis === true
        },
        limits: sanitizePublicValue(capabilitySource.limits || {}) || {}
      },
      rightsAttested: source.rightsAttested === true,
      characterConsentAttested: source.characterConsentAttested === true,
      panel: ["assets", "characters", "scenes", "queue"].includes(source.panel) ? source.panel : "assets"
    };
  }

  function normalizeModelCapability(value) {
    if (!value || typeof value !== "object") return null;
    const id = safeId(value.id || value.model, "");
    if (!id) return null;
    return {
      id,
      label: asText(value.label || value.name || id, 120),
      provider: asText(value.provider, 80),
      available: value.available === true,
      reason: asText(value.reason || value.message, 300),
      supportedModes: Array.isArray(value.supportedModes) ? value.supportedModes.filter((mode) => MODES.some((entry) => entry.id === mode)) : [],
      supportedDurations: Array.isArray(value.supportedDurations) ? value.supportedDurations.map(Number).filter((item) => DURATIONS.includes(item)) : [],
      supportedAspectRatios: Array.isArray(value.supportedAspectRatios) ? value.supportedAspectRatios.filter((item) => ASPECT_RATIOS.includes(item)) : [],
      supportedResolutions: Array.isArray(value.supportedResolutions) ? value.supportedResolutions.filter((item) => RESOLUTIONS.includes(item)) : [],
      estimateUsdPerSecond: value.estimateUsdPerSecond == null ? null : Math.max(0, Number(value.estimateUsdPerSecond) || 0)
    };
  }

  function backendModelSelection(modelId) {
    const mapping = {
      "server-veo": { provider: "veo", model: "" },
      "server-worker": { provider: "worker", model: "" },
      "server-local-wan": { provider: "wan2.2", model: "" },
      // AI Director creates a plan. Rendering its scenes still uses the backend's
      // supported render adapter rather than pretending the planning model emits video.
      "server-director": { provider: "auto", model: "" }
    };
    return mapping[modelId] || { provider: "auto", model: "" };
  }

  function deriveCapabilityModels(capabilities = {}) {
    const providers = capabilities.providers && typeof capabilities.providers === "object" ? capabilities.providers : {};
    const modes = capabilities.modes && typeof capabilities.modes === "object" ? capabilities.modes : {};
    const limits = capabilities.limits && typeof capabilities.limits === "object" ? capabilities.limits : {};
    const supportedModeIds = Object.entries(modes).filter(([, value]) => value?.supported === true).map(([key]) => key);
    const output = [{
      id: "auto",
      label: "Tự động · backend quyết định model",
      provider: "Backend",
      available: supportedModeIds.length > 0,
      reason: supportedModeIds.length ? "" : asText(capabilities.message || "Backend chưa bật adapter tạo video.", 300),
      supportedModes: [...new Set([...supportedModeIds, ...(supportedModeIds.includes("text-to-video") ? ["ai-director"] : [])])],
      // Auto may resolve to Veo or a declared worker. Leave parameter checks to the
      // server quote instead of presenting direct-Veo limits as universal limits.
      supportedDurations: [],
      supportedAspectRatios: [],
      supportedResolutions: [],
      estimateUsdPerSecond: null
    }];
    if (providers.veo) output.push({
      id: "server-veo",
      label: `Veo · ${asText(providers.veo.model || "model máy chủ", 100)}`,
      provider: "Google",
      available: providers.veo.configured === true,
      reason: providers.veo.configured ? "" : "Veo chưa được cấu hình trên backend.",
      supportedModes: [...new Set([...(providers.veo.directModes || ["text-to-video"]), "ai-director"])],
      supportedDurations: Array.isArray(limits.directVeoDurationsSeconds) ? limits.directVeoDurationsSeconds : [...DURATIONS],
      supportedAspectRatios: Array.isArray(limits.directVeoAspectRatios) ? limits.directVeoAspectRatios : ["16:9", "9:16"],
      supportedResolutions: Array.isArray(limits.directVeoResolutions) ? limits.directVeoResolutions : [...RESOLUTIONS],
      estimateUsdPerSecond: null
    });
    if (providers.worker) output.push({
      id: "server-worker",
      label: "Video Worker · motion/character",
      provider: "Worker",
      available: providers.worker.configured === true && providers.worker.capabilityDeclarationRequired !== true,
      reason: providers.worker.capabilityDeclarationRequired ? "Worker cần khai báo capability trước khi nhận tác vụ." : providers.worker.configured ? "" : "Video worker chưa được cấu hình.",
      supportedModes: Array.isArray(providers.worker.declaredModes) ? providers.worker.declaredModes : ["video-remix", "character-replace"],
      supportedDurations: [...DURATIONS],
      supportedAspectRatios: [...ASPECT_RATIOS],
      supportedResolutions: ["720p", "1080p"],
      estimateUsdPerSecond: null
    });
    if (providers.localWan) output.push({
      id: "server-local-wan",
      label: "Wan Animate · máy chủ riêng",
      provider: "Self-hosted",
      available: providers.localWan.configured === true && providers.localWan.serverless !== true,
      reason: providers.localWan.serverless ? "Wan không chạy trực tiếp trong Vercel Serverless; cần GPU worker riêng." : providers.localWan.configured ? "" : "Wan worker chưa được cấu hình.",
      supportedModes: ["video-remix", "character-replace"],
      supportedDurations: [...DURATIONS],
      supportedAspectRatios: [...ASPECT_RATIOS],
      supportedResolutions: ["720p", "1080p"],
      estimateUsdPerSecond: null
    });
    if (providers.director) output.push({
      id: "server-director",
      label: `AI Director · ${asText(providers.director.model || "model máy chủ", 100)}`,
      provider: "Google",
      available: providers.director.configured === true,
      reason: providers.director.configured ? "" : "AI Director chưa được cấu hình.",
      supportedModes: ["ai-director"],
      supportedDurations: [...DURATIONS],
      supportedAspectRatios: [...ASPECT_RATIOS],
      supportedResolutions: [...RESOLUTIONS],
      estimateUsdPerSecond: null
    });
    return output.map(normalizeModelCapability).filter(Boolean);
  }

  function splitScenes(duration, segmentSeconds = 8, options = {}) {
    const total = Math.max(0, Number(duration) || 0);
    const length = clamp(segmentSeconds, 1, 30);
    if (!total) return [];
    const count = Math.min(500, Math.ceil(total / length));
    const prefix = safeId(options.prefix, "scene");
    const thumbnail = /^data:image\//i.test(options.thumbnail || "") ? options.thumbnail : "";
    return Array.from({ length: count }, (_, index) => {
      const start = Number((index * length).toFixed(3));
      const end = Number(Math.min(total, start + length).toFixed(3));
      return normalizeScene({
        id: `${prefix}-${index + 1}`,
        order: index,
        title: `Cảnh ${index + 1}`,
        start,
        end,
        duration: Math.max(0.1, end - start),
        thumbnail,
        source: "local-duration"
      }, index);
    });
  }

  function mapPlanScenes(rows, options = {}) {
    if (!Array.isArray(rows)) return [];
    const fallbackDuration = Math.max(0.1, Number(options.durationSeconds) || 8);
    const source = options.analysisBasis === "worker-visual-analysis" ? "backend" : "director";
    let cursor = 0;
    return rows.slice(0, 500).map((scene, index) => {
      const duration = Math.max(0.1, Number(scene?.durationSeconds ?? scene?.duration) || fallbackDuration);
      const rawStart = scene?.startSeconds ?? scene?.start;
      const rawEnd = scene?.endSeconds ?? scene?.end;
      const start = rawStart != null && Number.isFinite(Number(rawStart)) ? Math.max(0, Number(rawStart)) : cursor;
      const end = rawEnd != null && Number.isFinite(Number(rawEnd)) ? Math.max(start + 0.1, Number(rawEnd)) : start + duration;
      cursor = end;
      return normalizeScene({
        ...scene,
        start,
        end,
        duration: end - start,
        prompt: scene?.promptVi || scene?.promptEn || scene?.prompt,
        source
      }, index);
    });
  }

  function canTransition(status, action) {
    return Boolean(TRANSITIONS[status]?.includes(action));
  }

  function transitionQueueItem(value, action, detail = {}) {
    const item = normalizeQueueItem(value);
    if (!canTransition(item.status, action)) {
      return { ...item, transitionError: `Không thể ${action} khi tác vụ ở trạng thái ${item.status}.` };
    }
    const stamp = asText(detail.updatedAt, 40) || nowIso();
    const next = { ...item, updatedAt: stamp };
    if (action === "submit") next.status = "submitting";
    if (action === "start") next.status = "running";
    if (action === "pause") {
      next.status = "paused";
      next.checkpoint = clamp(detail.checkpoint ?? item.progress, 0, 100);
    }
    if (action === "resume") {
      next.status = "queued";
      next.retryFrom = item.checkpoint;
      next.error = "";
    }
    if (action === "retry") {
      next.status = "queued";
      next.retryFrom = clamp(detail.retryFrom ?? item.checkpoint ?? item.progress, 0, 100);
      next.attempts = item.attempts + 1;
      next.error = "";
    }
    if (action === "cancel") next.status = "cancelled";
    if (action === "progress") {
      next.status = "running";
      next.progress = clamp(detail.progress ?? item.progress, 0, 99.9);
      next.checkpoint = Math.max(item.checkpoint, clamp(detail.checkpoint ?? next.progress, 0, 100));
    }
    if (action === "complete") {
      next.status = "completed";
      next.progress = 100;
      next.checkpoint = 100;
      next.outputUrl = safeOutputUrl(detail.outputUrl) || item.outputUrl;
      next.outputAssetId = safeId(detail.outputAssetId, item.outputAssetId);
      next.error = "";
    }
    if (action === "fail") {
      next.status = "failed";
      next.error = asText(detail.error || "Máy chủ không thể hoàn tất tác vụ.", 600);
      next.checkpoint = Math.max(item.checkpoint, clamp(detail.checkpoint ?? item.progress, 0, 100));
    }
    if (detail.backendId || detail.id) next.backendId = safeId(detail.backendId || detail.id, item.backendId);
    if (detail.costEstimateUsd != null) next.costEstimateUsd = Math.max(0, Number(detail.costEstimateUsd) || 0);
    delete next.transitionError;
    return next;
  }

  function extractPublicJob(payload) {
    let current = payload;
    for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
      if (current.job && typeof current.job === "object") return current.job;
      if (current.data && typeof current.data === "object") {
        current = current.data;
        continue;
      }
      return current;
    }
    return {};
  }

  function requestFromPublicJob(input, fallback) {
    if (!input || typeof input !== "object") return fallback || null;
    const source = sanitizePublicValue(input) || {};
    return sanitizePublicValue({
      ...(fallback && typeof fallback === "object" ? fallback : {}),
      ...source,
      provider: source.provider || source.requestedProvider || fallback?.provider || "auto",
      model: source.model || source.requestedModel || fallback?.model || "",
      sourceStartSeconds: source.sourceStartSeconds ?? source.sourceRange?.startSeconds ?? fallback?.sourceStartSeconds,
      sourceEndSeconds: source.sourceEndSeconds ?? source.sourceRange?.endSeconds ?? fallback?.sourceEndSeconds,
      controls: { ...(fallback?.controls || {}), ...(source.controls || {}) }
    });
  }

  function syncQueueItem(value, remote = {}) {
    const item = normalizeQueueItem(value);
    const publicJob = extractPublicJob(remote);
    const rawStatus = asText(publicJob.status, 40).toLowerCase();
    const remoteStatus = rawStatus === "canceled" ? "cancelled" : rawStatus;
    const remoteProgress = publicJob.progress == null ? item.progress : clamp(publicJob.progress, 0, 100);
    const remoteCheckpoint = publicJob.checkpoint && typeof publicJob.checkpoint === "object" ? publicJob.checkpoint : {};
    const common = {
      ...item,
      backendId: safeId(publicJob.id || publicJob.jobId || item.backendId, item.backendId),
      progress: remoteProgress,
      checkpoint: Math.max(item.checkpoint, clamp(remoteCheckpoint.progress ?? remoteCheckpoint.percent ?? remoteProgress ?? item.checkpoint, 0, 100)),
      checkpointStage: asText(remoteCheckpoint.stage || publicJob.stage || item.checkpointStage, 120),
      retryStage: asText(remoteCheckpoint.retryFrom || item.retryStage, 120),
      stage: asText(publicJob.stage || item.stage, 120),
      attempts: Math.max(item.attempts, Math.round(Number(publicJob.attempt) || 0)),
      request: requestFromPublicJob(publicJob.input, item.request),
      providerMayContinue: publicJob.provider?.mayContinue === true,
      controlConfirmed: publicJob.provider?.controlConfirmed === true,
      statusWarning: asText(publicJob.statusWarning?.message || publicJob.statusWarning || "", 600),
      updatedAt: asText(publicJob.updatedAt, 40) || nowIso()
    };
    if (!QUEUE_STATUSES.includes(remoteStatus)) return common;
    const outputUrl = publicJob.output?.downloadUrl || publicJob.downloadUrl || publicJob.outputUrl || "";
    const outputReady = publicJob.output?.ready === true || remoteStatus === "completed";
    const remoteError = typeof publicJob.error === "object" ? publicJob.error.message : publicJob.error;
    return normalizeQueueItem({
      ...common,
      status: remoteStatus,
      progress: outputReady ? 100 : common.progress,
      error: remoteStatus === "failed" || remoteStatus === "submission-unknown" ? asText(remoteError || publicJob.message || "Render thất bại.", 600) : "",
      outputUrl: outputReady ? (safeOutputUrl(outputUrl) || common.outputUrl) : common.outputUrl,
      outputAssetId: publicJob.output?.assetId || publicJob.outputAssetId || common.outputAssetId,
      costEstimateUsd: publicJob.estimate?.currency === "USD" ? publicJob.estimate.amount : (publicJob.costEstimateUsd ?? common.costEstimateUsd)
    });
  }

  function estimateCost(input = {}, catalog = MODEL_CATALOG) {
    const model = modelById(input.modelId, catalog);
    const seconds = DURATIONS.includes(Number(input.durationSeconds)) ? Number(input.durationSeconds) : 8;
    const scenes = Math.max(1, Math.round(Number(input.sceneCount) || 1));
    const variants = Math.round(clamp(input.variants ?? 1, 1, 3));
    const resolution = RESOLUTIONS.includes(input.resolution) ? input.resolution : "720p";
    const rate = input.estimateUsdPerSecond != null
      ? Math.max(0, Number(input.estimateUsdPerSecond) || 0)
      : model?.estimateUsdPerSecond;
    if (rate == null) {
      return {
        available: false,
        amountUsd: null,
        label: model?.kind === "director" ? "Phân tích trước khi render" : "Máy chủ chưa cung cấp báo giá",
        basis: "unknown",
        seconds: seconds * scenes * variants
      };
    }
    const resolutionMultiplier = resolution === "4k" ? 1.5 : resolution === "1080p" ? 1.15 : 1;
    const amount = rate * seconds * scenes * variants * resolutionMultiplier;
    return {
      available: true,
      amountUsd: Number(amount.toFixed(4)),
      label: `≈ $${amount.toFixed(2)} USD`,
      basis: "client-estimate",
      seconds: seconds * scenes * variants,
      rateUsdPerSecond: rate,
      resolutionMultiplier
    };
  }

  function validateJob(stateValue, sceneValue, catalog = MODEL_CATALOG) {
    const state = normalizeState(stateValue);
    const scene = sceneValue ? normalizeScene(sceneValue) : state.scenes.find((item) => item.id === state.selectedSceneId);
    const mode = modeById(state.mode);
    const model = modelById(state.modelId, catalog);
    const errors = [];
    if (!scene && state.mode !== "text-to-video" && state.mode !== "ai-director") errors.push("Chưa có cảnh để render.");
    if (mode.requiresSource && !state.sourceAsset?.cloudAssetId) {
      errors.push("Video nguồn chưa có Cloud Asset ID thuộc tài khoản. Tệp chỉ ở máy chưa thể gửi cho worker.");
    }
    if (mode.requiresCharacter && !state.characterAssets.some((asset) => asset.cloudAssetId)) {
      errors.push("Chưa có ảnh nhân vật trên Media Cloud của tài khoản.");
    }
    const usedAssets = [state.sourceAsset, ...state.characterAssets, ...state.referenceAssets, state.audioAsset]
      .filter((asset) => asset?.cloudAssetId);
    const mediaProjectIds = [...new Set(usedAssets.map((asset) => asset.mediaProjectId || state.mediaProjectId).filter(Boolean))];
    if (usedAssets.length && !mediaProjectIds.length) errors.push("Thiếu Media Project ID của tài sản cloud.");
    if (mediaProjectIds.length > 1) errors.push("Mọi tài sản trong một tác vụ phải thuộc cùng một Media Project.");
    if (!asText(scene?.prompt || state.prompt, MAX_PROMPT_LENGTH)) {
      errors.push("Hãy nhập yêu cầu tạo video.");
    }
    if ((mode.requiresSource || state.characterAssets.length || state.referenceAssets.length) && !state.rightsAttested) {
      errors.push("Bạn cần xác nhận quyền sử dụng video và ảnh tham chiếu.");
    }
    if (mode.requiresCharacter && !state.characterConsentAttested) {
      errors.push("Bạn cần xác nhận nhân vật thật đã đồng ý cho việc tạo nội dung này.");
    }
    if (model && Array.isArray(model.supportedModes) && !model.supportedModes.includes(state.mode)) {
      errors.push(`${model.label} không được cấu hình cho chế độ ${mode.label}.`);
    }
    if (model?.supportedDurations?.length && !model.supportedDurations.includes(state.settings.durationSeconds)) {
      errors.push(`Model không hỗ trợ thời lượng ${state.settings.durationSeconds} giây.`);
    }
    if (model?.supportedAspectRatios?.length && !model.supportedAspectRatios.includes(state.settings.aspectRatio)) {
      errors.push(`Model không hỗ trợ tỷ lệ ${state.settings.aspectRatio}.`);
    }
    if (model?.supportedResolutions?.length && !model.supportedResolutions.includes(state.settings.resolution)) {
      errors.push(`Model không hỗ trợ độ phân giải ${state.settings.resolution}.`);
    }
    const capability = state.capabilities.models.find((item) => item.id === state.modelId);
    if (state.capabilities.state === "ready" && capability && !capability.available) {
      errors.push(capability.reason || "Model chưa được bật trên máy chủ.");
    }
    if (state.capabilities.state === "ready" && !state.capabilities.billing.canCreate) {
      errors.push(state.capabilities.billing.reason || "Tài khoản chưa được cấp quyền billing cho AI Video.");
    }
    return { valid: errors.length === 0, errors, mode, model, scene };
  }

  function sanitizePublicValue(value, depth = 0) {
    if (depth > 6) return null;
    if (value == null || typeof value === "boolean" || typeof value === "number") return value;
    if (typeof value === "string") return value.slice(0, 8000);
    if (Array.isArray(value)) return value.slice(0, 100).map((entry) => sanitizePublicValue(entry, depth + 1));
    if (typeof value !== "object") return null;
    const output = {};
    Object.entries(value).forEach(([key, entry]) => {
      if (/^(?:__proto__|prototype|constructor)$/i.test(key)) return;
      if (/(?:secret|token|password|api[-_]?key|authorization|cookie|credential|session)/i.test(key)) return;
      if (typeof File !== "undefined" && entry instanceof File) return;
      if (typeof Blob !== "undefined" && entry instanceof Blob) return;
      output[key] = sanitizePublicValue(entry, depth + 1);
    });
    return output;
  }

  function buildJobPayload(stateValue, sceneValue) {
    const state = normalizeState(stateValue);
    const scene = sceneValue ? normalizeScene(sceneValue) : state.scenes.find((item) => item.id === state.selectedSceneId);
    const backendMode = state.mode === "ai-director" ? "text-to-video" : state.mode;
    const selection = backendModelSelection(state.modelId);
    const sourceStartSeconds = scene?.start || 0;
    const sourceEndSeconds = scene?.end || (sourceStartSeconds + state.settings.durationSeconds);
    return sanitizePublicValue({
      mode: backendMode,
      sceneId: scene?.id || "",
      prompt: scene?.prompt || state.prompt,
      durationSeconds: state.settings.durationSeconds,
      aspectRatio: state.settings.aspectRatio,
      resolution: state.settings.resolution,
      variants: state.settings.variants,
      provider: selection.provider,
      model: selection.model,
      sourceAssetId: state.sourceAsset?.cloudAssetId || "",
      characterAssetIds: state.characterAssets.map((asset) => asset.cloudAssetId).filter(Boolean),
      referenceAssetIds: state.referenceAssets.map((asset) => asset.cloudAssetId).filter(Boolean),
      audioAssetId: state.audioAsset?.cloudAssetId || "",
      mediaProjectId: state.mediaProjectId || state.sourceAsset?.mediaProjectId || state.characterAssets.find((asset) => asset.mediaProjectId)?.mediaProjectId || "",
      sourceStartSeconds,
      sourceEndSeconds,
      controls: {
        sourceStartSeconds,
        sourceEndSeconds,
        preserveMotion: state.settings.preserveMotion,
        preserveCamera: state.settings.preserveCamera,
        preserveBackground: state.settings.preserveBackground,
        characterSimilarity: state.settings.identityStrength,
        creativity: state.settings.creativity,
        preserveAudio: state.settings.preserveAudio,
        preserveDialogue: state.settings.preserveAudio
      },
      rightsAttested: state.rightsAttested === true,
      characterConsentAttested: state.mode === "character-replace" && state.characterConsentAttested === true
    });
  }

  function buildAnalysisPayload(stateValue) {
    const state = normalizeState(stateValue);
    const selectedScene = state.scenes.find((scene) => scene.id === state.selectedSceneId);
    const brief = asText(selectedScene?.prompt || state.prompt, MAX_PROMPT_LENGTH);
    return sanitizePublicValue({
      mode: state.mode === "ai-director" ? "text-to-video" : state.mode,
      sourceAssetId: state.sourceAsset?.cloudAssetId || "",
      characterAssetIds: state.characterAssets.map((asset) => asset.cloudAssetId).filter(Boolean),
      referenceAssetIds: state.referenceAssets.map((asset) => asset.cloudAssetId).filter(Boolean),
      brief,
      prompt: brief,
      visualAnalysis: Boolean(state.sourceAsset?.cloudAssetId),
      targetDurationSeconds: Math.max(4, Math.min(600, Math.round(state.sourceAsset?.duration || state.settings.durationSeconds))),
      mediaProjectId: state.mediaProjectId || state.sourceAsset?.mediaProjectId || state.characterAssets.find((asset) => asset.mediaProjectId)?.mediaProjectId || "",
      rightsAttested: state.rightsAttested === true,
      characterConsentAttested: state.mode === "character-replace" && state.characterConsentAttested === true
    });
  }

  function safeBackendError(error, fallback = "Không thể kết nối máy chủ AI Video.") {
    if (!error) return fallback;
    if (typeof error === "string") return asText(error, 500) || fallback;
    if (error.name === "AbortError") return "Máy chủ phản hồi quá lâu. Tác vụ chưa được xác nhận; hãy kiểm tra hàng đợi trước khi thử lại.";
    const status = Number(error.status || error.statusCode) || 0;
    const message = asText(error.publicMessage || error.message, 500);
    if (status === 401) return "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại rồi tiếp tục.";
    if (status === 403) return message || "Tài khoản không có quyền sử dụng tài sản hoặc model này.";
    if (status === 404) return "Backend AI Video chưa được triển khai hoặc tác vụ không tồn tại.";
    if (status === 409) return message || "Trạng thái tác vụ đã thay đổi. Hãy đồng bộ lại hàng đợi.";
    if (status === 413) return "Tệp hoặc yêu cầu vượt giới hạn máy chủ. Hãy dùng Media Cloud hoặc chia video thành cảnh ngắn.";
    if (status === 429) return "Đã hết hạn mức hoặc có quá nhiều yêu cầu. Không có render miễn phí được giả lập; hãy chờ hoặc kiểm tra quota.";
    if (status >= 500) return message || "Worker tạo video đang gặp lỗi. Tiến trình đã lưu tại checkpoint gần nhất nếu backend hỗ trợ.";
    return message || fallback;
  }

  function createBackendClient(options = {}) {
    const apiBase = asText(options.apiBase || DEFAULT_API_BASE, 500) || DEFAULT_API_BASE;
    const fetchImpl = options.fetch || global.fetch;
    const timeoutMs = clamp(options.timeoutMs || 45_000, 3_000, 120_000);

    async function request(action, method = "GET", data = null) {
      if (typeof fetchImpl !== "function") {
        const error = new Error("Trình duyệt không hỗ trợ fetch; không thể gọi backend.");
        error.status = 0;
        throw error;
      }
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      const url = new URL(apiBase, global.location?.origin || "http://localhost");
      url.searchParams.set("action", action);
      if (method === "GET" && data && typeof data === "object") {
        Object.entries(data).forEach(([key, value]) => {
          if (value != null && value !== "") url.searchParams.set(key, String(value));
        });
      }
      const init = {
        method,
        credentials: "include",
        headers: { Accept: "application/json" },
        signal: controller?.signal
      };
      if (method !== "GET") {
        init.headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(sanitizePublicValue({ action, ...(data || {}) }));
      }
      try {
        const response = await fetchImpl(url.toString(), init);
        const contentType = response.headers?.get?.("content-type") || "";
        if (!/\bjson\b/i.test(contentType)) {
          await response.text().catch(() => "");
          const error = new Error(response.ok
            ? "Backend AI Video trả về sai định dạng. Hãy kiểm tra route serverless thay vì coi trang HTML là API sẵn sàng."
            : `Backend AI Video phản hồi HTTP ${response.status}.`);
          error.status = response.ok ? 502 : response.status;
          error.code = "API_RESPONSE_NOT_JSON";
          throw error;
        }
        const payload = await response.json().catch(() => null);
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          const error = new Error("Backend AI Video trả về JSON không hợp lệ.");
          error.status = 502;
          error.code = "API_RESPONSE_INVALID";
          throw error;
        }
        if (!response.ok || payload?.ok === false) {
          const rawError = typeof payload?.error === "string" ? payload.error : payload?.error?.message;
          const error = new Error(asText(rawError || payload?.message || `HTTP ${response.status}`, 600));
          error.status = response.status;
          error.code = asText((typeof payload?.error === "object" ? payload.error.code : "") || payload?.code, 80);
          error.publicMessage = asText((typeof payload?.error === "object" ? payload.error.publicMessage : rawError) || payload?.message, 600);
          throw error;
        }
        return payload;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    return Object.freeze({
      apiBase,
      capabilities: () => request("capabilities", "GET"),
      estimate: (payload) => request("estimate", "POST", payload),
      estimateAnalysis: (payload) => request("estimate-analysis", "POST", payload),
      analyze: (payload) => request("analyze", "POST", payload),
      createJob: (payload) => request("create-job", "POST", payload),
      status: (id) => request("status", "GET", { id }),
      pause: (id) => request("pause", "POST", { id }),
      resume: (id) => request("resume", "POST", { id }),
      retry: (id, payload = {}) => request("retry", "POST", { id, ...payload }),
      cancel: (id) => request("cancel", "POST", { id }),
      downloadUrl: (id) => {
        const url = new URL(apiBase, global.location?.origin || "http://localhost");
        url.searchParams.set("action", "download");
        url.searchParams.set("id", safeId(id, ""));
        return url.toString();
      }
    });
  }

  let instance = null;

  function resolveIdentity(options = {}) {
    let currentUser = options.currentUser || null;
    if (!currentUser) {
      try { currentUser = global.HHAuthz?.currentUser?.() || null; } catch { currentUser = null; }
    }
    if (!currentUser && global.localStorage) {
      try { currentUser = JSON.parse(global.localStorage.getItem("hh-auth-user") || "null"); } catch { currentUser = null; }
    }
    return ownerScope({
      currentUser,
      ownerId: options.ownerId,
      learnerProfileId: options.learnerProfileId,
      learnerProfile: options.learnerProfile
    });
  }

  function persistableState(state) {
    const normalized = normalizeState(state);
    // Object URLs, File/Blob references and credentials are never persisted.
    return sanitizePublicValue(normalized);
  }

  function loadState(storage, key) {
    if (!storage) return normalizeState(null);
    try { return normalizeState(JSON.parse(storage.getItem(key) || "null")); }
    catch { return normalizeState(null); }
  }

  function saveState(storage, key, state) {
    if (!storage) return false;
    try {
      storage.setItem(key, JSON.stringify(persistableState(state)));
      return true;
    } catch {
      return false;
    }
  }

  function mediaReady(asset) {
    return Boolean(asset?.cloudAssetId && (!asset.cloudState || ["ready", "completed", "available"].includes(asset.cloudState)));
  }

  function readImageMetadata(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//i.test(file.type || "")) return reject(new Error("Tệp không phải ảnh được hỗ trợ."));
      if (file.size > MAX_CHARACTER_IMAGE_BYTES) return reject(new Error("Ảnh vượt giới hạn 25 MB."));
      if (typeof Image === "undefined" || !global.URL?.createObjectURL || !global.document) return reject(new Error("Trình duyệt không hỗ trợ đọc preview ảnh."));
      const objectUrl = global.URL.createObjectURL(file);
      const image = new Image();
      const cleanup = () => { try { global.URL.revokeObjectURL(objectUrl); } catch { /* noop */ } };
      image.onerror = () => { cleanup(); reject(new Error("Ảnh bị hỏng hoặc định dạng chưa được hỗ trợ.")); };
      image.onload = () => {
        try {
          const width = Math.max(1, image.naturalWidth || 1);
          const height = Math.max(1, image.naturalHeight || 1);
          const scale = Math.min(1, 480 / Math.max(width, height));
          const canvas = global.document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));
          const context = canvas.getContext("2d", { alpha: false });
          if (!context) throw new Error("Canvas preview không khả dụng.");
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const thumbnail = canvas.toDataURL("image/jpeg", 0.72);
          cleanup();
          resolve(normalizeAsset({
            id: uid("character"), kind: "character", name: file.name, type: file.type, size: file.size,
            width, height, thumbnail, cloudState: "local-only"
          }, "character"));
        } catch (error) {
          cleanup();
          reject(error);
        }
      };
      image.src = objectUrl;
    });
  }

  function readVideoMetadata(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^video\//i.test(file.type || "")) return reject(new Error("Tệp không phải video được hỗ trợ."));
      if (file.size > MAX_SOURCE_BYTES) return reject(new Error("Video vượt giới hạn 2 GB của workspace trình duyệt."));
      const doc = global.document;
      if (!doc || !global.URL?.createObjectURL) return reject(new Error("Trình duyệt không hỗ trợ preview video cục bộ."));
      const url = global.URL.createObjectURL(file);
      const video = doc.createElement("video");
      let settled = false;
      const finish = (callback) => {
        if (settled) return;
        settled = true;
        video.removeAttribute("src");
        video.load?.();
        callback();
      };
      const timer = setTimeout(() => finish(() => {
        global.URL.revokeObjectURL(url);
        reject(new Error("Không thể đọc metadata video trong thời gian cho phép."));
      }), 15_000);
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.onerror = () => {
        clearTimeout(timer);
        finish(() => {
          global.URL.revokeObjectURL(url);
          reject(new Error("Codec video không được trình duyệt hỗ trợ."));
        });
      };
      video.onloadedmetadata = () => {
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const captureAt = Math.min(Math.max(duration * 0.08, 0), Math.max(0, duration - 0.05));
        const capture = () => {
          let thumbnail = "";
          try {
            const width = Math.max(1, video.videoWidth || 1);
            const height = Math.max(1, video.videoHeight || 1);
            const canvas = doc.createElement("canvas");
            canvas.width = Math.min(480, width);
            canvas.height = Math.max(1, Math.round(canvas.width * height / width));
            canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
            thumbnail = canvas.toDataURL("image/jpeg", 0.72);
          } catch { thumbnail = ""; }
          clearTimeout(timer);
          const asset = normalizeAsset({
            id: uid("source"), kind: "source", name: file.name, type: file.type, size: file.size,
            duration, width: video.videoWidth, height: video.videoHeight, thumbnail, cloudState: "local-only"
          }, "source");
          finish(() => resolve({ asset, objectUrl: url }));
        };
        if (captureAt > 0) {
          video.onseeked = capture;
          try { video.currentTime = captureAt; } catch { capture(); }
        } else capture();
      };
      video.src = url;
    });
  }

  function mount(target, options = {}) {
    if (!global.document) return null;
    unmount();
    const host = typeof target === "string" ? global.document.querySelector(target) : target;
    if (!host) throw new Error("Không tìm thấy vùng hiển thị AI Video Remake Studio.");

    const scope = resolveIdentity(options);
    const storage = options.storage || global.localStorage;
    const storageKey = scopedStorageKey(scope);
    const state = loadState(storage, storageKey);
    const client = createBackendClient({ apiBase: options.apiBase || DEFAULT_API_BASE, fetch: options.fetch });
    const runtime = {
      host,
      options,
      scope,
      storage,
      storageKey,
      state,
      client,
      root: null,
      controller: new AbortController(),
      localFiles: new Map(),
      objectUrls: new Map(),
      pollTimer: null,
      estimateTimer: null,
      backendEstimate: null,
      pendingConfirmation: null,
      busy: new Set(),
      notice: { tone: "info", text: "" },
      mediaAssets: [],
      mediaState: "idle",
      queueExpanded: true,
      pollIndex: 0,
      pollBackoffMs: POLL_INTERVAL_MS
    };
    instance = runtime;
    render(runtime);
    bind(runtime);
    refreshCapabilities(runtime);
    refreshMediaCloud(runtime);
    schedulePoll(runtime, POLL_INTERVAL_MS);
    return api;
  }

  function unmount() {
    if (!instance) return;
    instance.controller.abort();
    if (instance.pollTimer) clearTimeout(instance.pollTimer);
    if (instance.estimateTimer) clearTimeout(instance.estimateTimer);
    instance.objectUrls.forEach((url) => {
      try { global.URL?.revokeObjectURL?.(url); } catch { /* noop */ }
    });
    if (instance.root?.parentNode) instance.root.parentNode.removeChild(instance.root);
    instance = null;
  }

  function commit(runtime, updater, options = {}) {
    if (runtime !== instance) return;
    const next = typeof updater === "function" ? updater(runtime.state) : updater;
    runtime.state = normalizeState({
      ...next,
      project: { ...next.project, updatedAt: nowIso() }
    });
    saveState(runtime.storage, runtime.storageKey, runtime.state);
    if (options.render !== false) render(runtime, options.focus);
  }

  function setNotice(runtime, text, tone = "info", renderNow = true) {
    runtime.notice = { text: asText(text, 600), tone: ["info", "success", "warning", "error"].includes(tone) ? tone : "info" };
    if (renderNow) render(runtime);
  }

  function render(runtime, focusSelector) {
    if (runtime !== instance) return;
    const activeElement = global.document.activeElement;
    const preserveFocus = runtime.root?.contains(activeElement) ? focusDescriptor(activeElement) : null;
    const existing = runtime.root;
    if (!existing) {
      const rootElement = global.document.createElement("section");
      rootElement.className = "hvr-root";
      rootElement.dataset.hvrRoot = "";
      rootElement.setAttribute("aria-label", "AI Video Remake Studio");
      runtime.host.replaceChildren(rootElement);
      runtime.root = rootElement;
    }
    const state = runtime.state;
    const selectedScene = state.scenes.find((scene) => scene.id === state.selectedSceneId) || state.scenes[0] || null;
    const catalog = mergedCatalog(state.capabilities.models);
    const selectedModel = modelById(state.modelId, catalog);
    const localEstimate = estimateCost({
      modelId: state.modelId,
      durationSeconds: state.settings.durationSeconds,
      sceneCount: Math.max(1, state.scenes.length || 1),
      variants: state.settings.variants,
      resolution: state.settings.resolution
    }, catalog);
    const cost = runtime.backendEstimate || localEstimate;
    const mode = modeById(state.mode);
    const queueActive = state.queue.filter((job) => ["queued", "submitting", "submitted", "dispatching", "running", "pause-requested", "paused", "cancel-requested"].includes(job.status)).length;
    const sourceObjectUrl = state.sourceAsset ? runtime.objectUrls.get(state.sourceAsset.id) || "" : "";

    runtime.root.innerHTML = `
      <header class="hvr-topbar">
        <div class="hvr-brand">
          <span class="hvr-brand-mark" aria-hidden="true">H</span>
          <span><strong>AI Video Remake Studio</strong><small>Render thật qua backend · không giả lập kết quả</small></span>
        </div>
        <label class="hvr-project-name">Tên dự án
          <input data-hvr-project-name value="${escapeHtml(state.project.name)}" maxlength="180" autocomplete="off">
        </label>
        <div class="hvr-top-metrics" aria-label="Trạng thái dự án">
          <span class="hvr-status hvr-status--${escapeHtml(state.capabilities.state)}"><i></i>${escapeHtml(capabilityLabel(state.capabilities))}</span>
          <span title="Chi phí chỉ là ước tính, backend hoặc nhà cung cấp có thể trả giá khác.">${escapeHtml(cost.label)} <small>${cost.basis === "client-estimate" ? "ước tính" : ""}</small></span>
          <span>${queueActive} đang chờ/chạy</span>
        </div>
        <button class="hvr-button hvr-button--ghost" type="button" data-hvr-action="refresh-capabilities">Đồng bộ model</button>
      </header>

      <nav class="hvr-mode-tabs" role="tablist" aria-label="Chế độ tạo video">
        ${MODES.map((entry) => `<button type="button" role="tab" id="hvr-mode-${entry.id}" aria-controls="hvr-workspace-panel" aria-selected="${entry.id === state.mode}" tabindex="${entry.id === state.mode ? "0" : "-1"}" class="hvr-mode-tab ${entry.id === state.mode ? "is-active" : ""}" data-hvr-mode="${entry.id}"><span>${escapeHtml(entry.label)}</span><small>${escapeHtml(entry.description)}</small></button>`).join("")}
      </nav>

      <div class="hvr-workspace" id="hvr-workspace-panel" role="tabpanel" aria-labelledby="hvr-mode-${escapeHtml(state.mode)}">
        <aside class="hvr-panel hvr-assets" aria-label="Tài sản dự án">
          ${renderAssetPanel(runtime)}
        </aside>

        <main class="hvr-panel hvr-stage" aria-label="Preview và cảnh">
          <div class="hvr-stage-head">
            <div><strong>${escapeHtml(selectedScene?.title || "Preview dự án")}</strong><small>${selectedScene ? `${formatSeconds(selectedScene.start)} – ${formatSeconds(selectedScene.end)}` : "Chưa có cảnh"}</small></div>
            <div class="hvr-stage-tools">
              <button type="button" class="hvr-icon-button" data-hvr-action="previous-scene" aria-label="Cảnh trước">←</button>
              <button type="button" class="hvr-icon-button" data-hvr-action="next-scene" aria-label="Cảnh sau">→</button>
              <button type="button" class="hvr-button hvr-button--ghost" data-hvr-action="analyze" ${mode.requiresSource && !state.sourceAsset ? "disabled" : ""}>${state.analysis.state === "submission-unknown" ? "Đối soát phân tích" : state.analysis.state === "submitting" ? "Kiểm tra phân tích" : state.mode === "ai-director" ? "Tạo storyboard" : "Phân tích cảnh"}</button>
            </div>
          </div>
          <div class="hvr-preview" data-hvr-preview>
            ${renderPreview(state, selectedScene, sourceObjectUrl)}
          </div>
          <div class="hvr-analysis-note hvr-analysis-note--${escapeHtml(state.analysis.state)}">
            <span>${analysisIcon(state.analysis.state)}</span>
            <p><strong>${escapeHtml(analysisTitle(state.analysis))}</strong><small>${escapeHtml(state.analysis.message || analysisFallback(state.analysis))}</small></p>
          </div>
          <section class="hvr-scenes" aria-label="Danh sách cảnh">
            <div class="hvr-section-head"><div><strong>Cảnh / shot</strong><small>${state.scenes.length} cảnh · chỉ render lại cảnh lỗi</small></div><button type="button" class="hvr-button hvr-button--ghost" data-hvr-action="add-scene">+ Cảnh</button></div>
            <div class="hvr-scene-strip" tabindex="0" aria-label="Chọn cảnh">
              ${state.scenes.length ? state.scenes.map((scene, index) => renderSceneCard(state, scene, index)).join("") : renderEmptyScenes(state)}
            </div>
          </section>
        </main>

        <aside class="hvr-panel hvr-controls" aria-label="Thiết lập render">
          <div class="hvr-controls-scroll">
            <div class="hvr-section-head"><div><strong>${escapeHtml(mode.label)}</strong><small>${escapeHtml(mode.description)}</small></div></div>
            <label class="hvr-field hvr-field--wide">Yêu cầu cho ${selectedScene ? escapeHtml(selectedScene.title) : "dự án"}
              <textarea data-hvr-prompt maxlength="${MAX_PROMPT_LENGTH}" rows="5" placeholder="Mô tả cảnh, nhân vật, ánh sáng, phong cách và chuyển động camera…">${escapeHtml(selectedScene?.prompt || state.prompt)}</textarea>
              <small>${(selectedScene?.prompt || state.prompt).length}/${MAX_PROMPT_LENGTH} · Ctrl+Enter để đưa cảnh vào hàng đợi</small>
            </label>
            <div class="hvr-form-grid">
              <label class="hvr-field">Model
                <select data-hvr-setting="modelId">${catalog.map((modelEntry) => `<option value="${escapeHtml(modelEntry.id)}" ${modelEntry.id === selectedModel.id ? "selected" : ""}>${escapeHtml(modelEntry.label)}${modelEntry.available === false ? " · chưa bật" : ""}</option>`).join("")}</select>
              </label>
              <label class="hvr-field">Thời lượng
                <select data-hvr-setting="durationSeconds">${DURATIONS.map((duration) => `<option value="${duration}" ${duration === state.settings.durationSeconds ? "selected" : ""}>${duration} giây</option>`).join("")}</select>
              </label>
              <label class="hvr-field">Tỷ lệ
                <select data-hvr-setting="aspectRatio">${ASPECT_RATIOS.map((ratio) => `<option value="${ratio}" ${ratio === state.settings.aspectRatio ? "selected" : ""}>${ratio}</option>`).join("")}</select>
              </label>
              <label class="hvr-field">Độ phân giải
                <select data-hvr-setting="resolution">${RESOLUTIONS.map((resolution) => `<option value="${resolution}" ${resolution === state.settings.resolution ? "selected" : ""}>${resolution}</option>`).join("")}</select>
              </label>
              <label class="hvr-field">Số phương án
                <select data-hvr-setting="variants">${[1, 2, 3].map((variants) => `<option value="${variants}" ${variants === state.settings.variants ? "selected" : ""}>${variants}</option>`).join("")}</select>
              </label>
            </div>
            ${renderControlSliders(state)}
            ${renderAttestations(state, mode)}
            <div class="hvr-cost-card">
              <span><strong>${escapeHtml(cost.label)}</strong><small>${cost.basis === "backend" ? "Ước tính do backend trả về" : "Ước tính cục bộ; giá thực tế do nhà cung cấp quyết định"}</small></span>
              <button type="button" class="hvr-button hvr-button--ghost" data-hvr-action="estimate">Tính lại</button>
            </div>
          </div>
          <div class="hvr-primary-actions">
            <button type="button" class="hvr-button hvr-button--primary" data-hvr-action="queue-selected">Đưa cảnh vào hàng đợi</button>
            <button type="button" class="hvr-button hvr-button--accent" data-hvr-action="queue-all" ${state.scenes.length < 2 ? "disabled" : ""}>Render tất cả cảnh</button>
          </div>
        </aside>
      </div>

      <footer class="hvr-queue-bar ${runtime.queueExpanded ? "is-expanded" : "is-collapsed"}" aria-label="Hàng đợi render">
        <button type="button" class="hvr-queue-summary" data-hvr-action="toggle-queue" aria-controls="hvr-queue-items" aria-expanded="${runtime.queueExpanded}">
          <span class="hvr-queue-pulse" aria-hidden="true"></span><strong>Render Queue</strong><small>${queueSummary(state.queue)}</small>
        </button>
        <div class="hvr-queue-items" id="hvr-queue-items" ${runtime.queueExpanded ? "" : "hidden"}>${state.queue.length ? state.queue.slice(-8).map(renderQueueItem).join("") : '<span class="hvr-queue-empty">Chưa có tác vụ. Render chỉ bắt đầu sau khi backend xác nhận.</span>'}</div>
      </footer>
      <div class="hvr-toast hvr-toast--${escapeHtml(runtime.notice.tone)} ${runtime.notice.text ? "is-visible" : ""}" role="status" aria-live="polite">${escapeHtml(runtime.notice.text)}</div>
      ${renderCostConfirmation(runtime)}
    `;
    if (focusSelector) runtime.root.querySelector(focusSelector)?.focus();
    else if (preserveFocus) restoreFocus(runtime.root, preserveFocus);
  }

  function focusDescriptor(element) {
    const attributes = ["data-hvr-prompt", "data-hvr-project-name", "data-hvr-media-project", "data-hvr-cloud-source", "data-hvr-character-cloud", "data-hvr-setting", "data-hvr-mode"];
    const attribute = attributes.find((name) => element.hasAttribute?.(name));
    if (!attribute) return null;
    return {
      attribute,
      value: element.getAttribute(attribute),
      selectionStart: typeof element.selectionStart === "number" ? element.selectionStart : null,
      selectionEnd: typeof element.selectionEnd === "number" ? element.selectionEnd : null
    };
  }

  function restoreFocus(rootElement, descriptor) {
    const nodes = [...rootElement.querySelectorAll(`[${descriptor.attribute}]`)];
    const target = nodes.find((node) => node.getAttribute(descriptor.attribute) === descriptor.value) || nodes[0];
    if (!target) return;
    target.focus();
    if (descriptor.selectionStart != null && typeof target.setSelectionRange === "function") {
      try { target.setSelectionRange(descriptor.selectionStart, descriptor.selectionEnd); } catch { /* unsupported input type */ }
    }
  }

  function canConfirmCost(pending, billing, checks = {}) {
    if (!pending || pending.state !== "ready" || checks.estimateAccepted !== true) return false;
    if (!pending.pricingUnknown) return billing?.canCreate === true;
    return billing?.canCreate === true && billing?.admin === true && checks.unknownCostAccepted === true;
  }

  function renderCostConfirmation(runtime) {
    const pending = runtime.pendingConfirmation;
    if (!pending) return "";
    const isAnalysis = pending.action === "analysis";
    if (pending.state === "loading") return `<div class="hvr-dialog-backdrop"><section class="hvr-dialog" role="dialog" aria-modal="true" aria-labelledby="hvr-quote-title"><span class="hvr-dialog-spinner" aria-hidden="true"></span><h2 id="hvr-quote-title">Đang lấy báo giá máy chủ</h2><p>Studio chưa gửi ${isAnalysis ? "nội dung tới model phân tích" : "tác vụ render"}. Đang kiểm tra model, quota và chi phí${isAnalysis ? "." : ` cho ${pending.sceneCount} cảnh.`}</p><button type="button" class="hvr-button hvr-button--ghost" data-hvr-action="cancel-confirmation">Hủy</button></section></div>`;
    if (pending.state === "error") return `<div class="hvr-dialog-backdrop"><section class="hvr-dialog" role="dialog" aria-modal="true" aria-labelledby="hvr-quote-title"><h2 id="hvr-quote-title">Chưa thể xác nhận chi phí</h2><p>${escapeHtml(pending.error)}</p><p class="hvr-truth-note">Không có tác vụ trả phí nào được tự động gửi.</p><div class="hvr-dialog-actions"><button type="button" class="hvr-button hvr-button--ghost" data-hvr-action="cancel-confirmation">Đóng</button><button type="button" class="hvr-button hvr-button--primary" data-hvr-action="retry-confirmation">Lấy báo giá lại</button></div></section></div>`;
    const billing = runtime.state.capabilities.billing;
    const unknownBlocked = pending.pricingUnknown && !(billing.canCreate && billing.admin);
    const expires = pending.expiresAt ? new Date(pending.expiresAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "theo thời hạn backend";
    return `<div class="hvr-dialog-backdrop"><section class="hvr-dialog" role="dialog" aria-modal="true" aria-labelledby="hvr-quote-title" aria-describedby="hvr-quote-description">
      <span class="hvr-dialog-kicker">Xác nhận trước khi tính phí</span>
      <h2 id="hvr-quote-title">${isAnalysis ? "Phân tích & tạo storyboard" : `Render ${pending.sceneCount} cảnh · ${pending.totalVariants} phương án`}</h2>
      <p id="hvr-quote-description">Backend chọn <strong>${escapeHtml(pending.adapter || "adapter phù hợp")}</strong>${pending.model ? ` · ${escapeHtml(pending.model)}` : ""}. Báo giá hết hạn lúc ${escapeHtml(expires)}.</p>
      <div class="hvr-quote-total ${pending.pricingUnknown ? "is-warning" : ""}"><span>Ước tính máy chủ</span><strong>${pending.pricingUnknown ? "Chưa cấu hình giá" : `${escapeHtml(pending.currency || "USD")} ${Number(pending.totalAmount || 0).toFixed(2)}`}</strong></div>
      ${pending.pricingUnknown ? `<p class="hvr-quote-warning"><strong>Cảnh báo:</strong> provider vẫn có thể tính phí dù backend chưa hiển thị được số tiền. ${unknownBlocked ? "Tài khoản này không phải owner/billing admin nên Studio chặn gửi tác vụ." : "Chỉ tiếp tục nếu bạn là chủ tài khoản và chấp nhận rủi ro chi phí chưa xác định."}</p>` : ""}
      <ul class="hvr-quote-list">${pending.entries.map((entry) => `<li><span>${escapeHtml(entry.scene.title)}</span><strong>${entry.estimate.pricingConfigured === false ? "Chưa có giá" : `${escapeHtml(entry.estimate.currency || pending.currency || "USD")} ${Number(entry.estimate.amount || 0).toFixed(2)}`}</strong></li>`).join("")}</ul>
      <label class="hvr-check is-required"><input type="checkbox" data-hvr-cost-accept><span><strong>Tôi chấp nhận mức ước tính trên</strong><small>Chi phí thực tế tuân theo báo giá và quota của backend. Mỗi quote chỉ dùng một lần.</small></span></label>
      ${pending.pricingUnknown && !unknownBlocked ? `<label class="hvr-check is-required hvr-check--warning"><input type="checkbox" data-hvr-unknown-cost-accept><span><strong>Tôi là chủ tài khoản và chấp nhận chi phí chưa xác định</strong><small>Xác nhận riêng này bắt buộc khi backend chưa cấu hình bảng giá.</small></span></label>` : ""}
      <p class="hvr-truth-note">Tác vụ chỉ được gửi sau khi bạn đánh dấu xác nhận và bấm ${isAnalysis ? "Phân tích" : "Render"}. Không có tài khoản miễn phí giả lập hoặc tự động đổi tài khoản.</p>
      <div class="hvr-dialog-actions"><button type="button" class="hvr-button hvr-button--ghost" data-hvr-action="cancel-confirmation">Quay lại</button><button type="button" class="hvr-button hvr-button--accent" data-hvr-action="confirm-dispatch" disabled>${unknownBlocked ? "Billing chưa cho phép" : isAnalysis ? "Chấp nhận & Phân tích" : "Chấp nhận & Render"}</button></div>
    </section></div>`;
  }

  function mergedCatalog(capabilities) {
    if (!Array.isArray(capabilities) || !capabilities.length) return MODEL_CATALOG.map((item) => ({ ...item }));
    const byId = new Map(MODEL_CATALOG.map((item) => [item.id, { ...item }]));
    capabilities.forEach((item) => {
      const existing = byId.get(item.id) || {
        id: item.id, label: item.label || item.id, provider: item.provider || "Backend", kind: "render",
        supportedModes: item.supportedModes?.length ? item.supportedModes : MODES.map((mode) => mode.id),
        supportedDurations: item.supportedDurations?.length ? item.supportedDurations : [...DURATIONS],
        supportedAspectRatios: item.supportedAspectRatios?.length ? item.supportedAspectRatios : [...ASPECT_RATIOS],
        supportedResolutions: item.supportedResolutions?.length ? item.supportedResolutions : [...RESOLUTIONS],
        estimateUsdPerSecond: null
      };
      byId.set(item.id, { ...existing, ...item });
    });
    return [...byId.values()];
  }

  function capabilityLabel(capabilities) {
    if (capabilities.state === "ready" && !capabilities.billing?.canCreate) return "Backend sẵn sàng · billing bị khóa";
    if (capabilities.state === "ready") return "Backend sẵn sàng";
    if (capabilities.state === "checking") return "Đang kiểm tra backend";
    if (capabilities.state === "unsupported") return "Backend chưa hỗ trợ";
    if (capabilities.state === "error") return "Backend lỗi";
    return "Backend chưa kiểm tra";
  }

  function renderAssetPanel(runtime) {
    const state = runtime.state;
    const source = state.sourceAsset;
    const sourceReady = mediaReady(source);
    const cloudCandidates = runtime.mediaAssets.filter((asset) => /^video\//i.test(asset.type || ""));
    return `
      <div class="hvr-section-head"><div><strong>Tài sản</strong><small>Local preview ≠ tài sản render trên cloud</small></div><button type="button" class="hvr-icon-button" data-hvr-action="refresh-media" aria-label="Tải lại Media Cloud">↻</button></div>
      <section class="hvr-asset-block">
        <div class="hvr-asset-title"><span>Video nguồn</span><em class="${sourceReady ? "is-ready" : ""}">${sourceReady ? "Cloud ready" : source ? "Chỉ ở máy" : "Bắt buộc với Remix"}</em></div>
        ${source ? renderAssetCard(source, runtime.objectUrls.get(source.id)) : '<div class="hvr-drop-card"><strong>Chưa có video nguồn</strong><small>Đọc metadata và thumbnail ngay trên máy; tệp không tự tải lên.</small></div>'}
        <div class="hvr-button-row">
          <label class="hvr-button hvr-button--ghost hvr-file-button">Chọn video máy<input type="file" accept="video/*" data-hvr-source-file></label>
          <button type="button" class="hvr-button hvr-button--ghost" data-hvr-action="open-media-cloud">Mở Media Cloud</button>
        </div>
        <label class="hvr-field">Gán Cloud Asset ID thuộc tài khoản
          <div class="hvr-inline-input"><input data-hvr-cloud-source value="${escapeHtml(source?.cloudAssetId || "")}" placeholder="asset_…" autocomplete="off"><button type="button" data-hvr-action="apply-cloud-source" class="hvr-button hvr-button--compact">Gán</button></div>
          <small>Backend kiểm tra quyền sở hữu; ID không hợp lệ sẽ bị từ chối.</small>
        </label>
        <label class="hvr-field">Media Project ID
          <input data-hvr-media-project value="${escapeHtml(state.mediaProjectId || source?.mediaProjectId || "")}" placeholder="project_…" autocomplete="off">
          <small>Mọi video/ảnh trong tác vụ phải thuộc cùng project này.</small>
        </label>
        ${cloudCandidates.length ? `<label class="hvr-field">Chọn từ Media Cloud<select data-hvr-media-source><option value="">Chọn video đã sẵn sàng…</option>${cloudCandidates.map((asset) => `<option value="${escapeHtml(asset.cloudAssetId)}">${escapeHtml(asset.name)}</option>`).join("")}</select></label>` : `<p class="hvr-truth-note">${runtime.mediaState === "error" ? "Không đọc được Media Cloud. Bạn vẫn có thể gán ID hợp lệ thủ công." : "Không có video cloud sẵn sàng trong tài khoản."}</p>`}
      </section>
      <section class="hvr-asset-block">
        <div class="hvr-asset-title"><span>Character Pack</span><em>${state.characterAssets.length}/${MAX_CHARACTER_REFERENCES}</em></div>
        <div class="hvr-character-grid">${state.characterAssets.length ? state.characterAssets.map(renderCharacterAsset).join("") : '<div class="hvr-character-empty">Thêm ảnh chính diện, nghiêng và toàn thân.</div>'}</div>
        <label class="hvr-button hvr-button--ghost hvr-file-button hvr-button--full">+ Preview ảnh nhân vật<input type="file" accept="image/*" multiple data-hvr-character-files></label>
        <label class="hvr-field">Thêm Cloud Asset ID ảnh
          <div class="hvr-inline-input"><input data-hvr-character-cloud placeholder="asset_…" autocomplete="off"><button type="button" data-hvr-action="add-character-cloud" class="hvr-button hvr-button--compact">Thêm</button></div>
        </label>
      </section>
      <section class="hvr-asset-block hvr-asset-guidance">
        <strong>Để render thật</strong>
        <ol><li>Tải tài sản lên Media Cloud.</li><li>Gán ID tài sản thuộc đúng tài khoản.</li><li>Xác nhận quyền sử dụng ở cột Render.</li></ol>
      </section>
    `;
  }

  function renderAssetCard(asset, objectUrl) {
    return `<article class="hvr-asset-card">
      <div class="hvr-asset-thumb">${asset.thumbnail ? `<img src="${escapeHtml(asset.thumbnail)}" alt="">` : '<span aria-hidden="true">▶</span>'}</div>
      <div><strong title="${escapeHtml(asset.name)}">${escapeHtml(asset.name)}</strong><small>${asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ""}${asset.duration ? `${formatSeconds(asset.duration)} · ` : ""}${formatBytes(asset.size)}</small><small>${asset.cloudAssetId ? `Cloud ID: ${escapeHtml(asset.cloudAssetId)}` : objectUrl ? "Preview local đang hoạt động" : "Cần chọn lại tệp local sau khi tải trang"}</small></div>
      <button type="button" class="hvr-icon-button" data-hvr-action="remove-source" aria-label="Bỏ video nguồn">×</button>
    </article>`;
  }

  function renderCharacterAsset(asset) {
    return `<article class="hvr-character-card" title="${escapeHtml(asset.name)}">
      ${asset.thumbnail ? `<img src="${escapeHtml(asset.thumbnail)}" alt="Preview ${escapeHtml(asset.name)}">` : '<span aria-hidden="true">人</span>'}
      <small>${asset.cloudAssetId ? "Cloud" : "Local"}</small>
      <button type="button" data-hvr-remove-character="${escapeHtml(asset.id)}" aria-label="Bỏ ${escapeHtml(asset.name)}">×</button>
    </article>`;
  }

  function renderPreview(state, scene, sourceUrl) {
    const completed = state.queue.slice().reverse().find((item) => item.sceneId === scene?.id && item.status === "completed");
    const output = completed?.outputUrl || scene?.outputUrl || "";
    if (output && sourceUrl) return `<div class="hvr-before-after"><div><span>Gốc</span><video src="${escapeHtml(sourceUrl)}" controls preload="metadata"></video></div><div><span>Kết quả</span><video src="${escapeHtml(output)}" controls preload="metadata"></video></div></div>`;
    if (output) return `<div class="hvr-result-preview"><video src="${escapeHtml(output)}" controls preload="metadata"></video><span>Kết quả backend</span></div>`;
    if (sourceUrl) return `<video class="hvr-source-preview" src="${escapeHtml(sourceUrl)}" controls preload="metadata"></video>`;
    if (state.sourceAsset?.thumbnail) return `<img class="hvr-source-preview" src="${escapeHtml(state.sourceAsset.thumbnail)}" alt="Preview video nguồn"><div class="hvr-preview-overlay">Metadata đã lưu; chọn lại tệp local để phát video.</div>`;
    return `<div class="hvr-preview-empty"><span aria-hidden="true">✦</span><strong>${state.mode === "text-to-video" || state.mode === "ai-director" ? "Mô tả video để bắt đầu" : "Chọn video nguồn"}</strong><small>Preview sẽ hiện tại đây. Studio không hiển thị kết quả giả khi backend chưa render.</small></div>`;
  }

  function renderSceneCard(state, scene, index) {
    const job = state.queue.slice().reverse().find((item) => item.sceneId === scene.id);
    return `<button type="button" class="hvr-scene-card ${scene.id === state.selectedSceneId ? "is-selected" : ""}" data-hvr-scene="${escapeHtml(scene.id)}" aria-pressed="${scene.id === state.selectedSceneId}">
      <span class="hvr-scene-number">${index + 1}</span>
      <span class="hvr-scene-thumb">${scene.thumbnail ? `<img src="${escapeHtml(scene.thumbnail)}" alt="">` : "SHOT"}</span>
      <span class="hvr-scene-copy"><strong>${escapeHtml(scene.title)}</strong><small>${formatSeconds(scene.start)} – ${formatSeconds(scene.end)}</small></span>
      ${job ? `<span class="hvr-scene-status hvr-scene-status--${job.status}">${escapeHtml(queueStatusLabel(job.status))}${Number.isFinite(job.progress) ? ` ${Math.round(job.progress)}%` : ""}</span>` : '<span class="hvr-scene-status">Chưa render</span>'}
    </button>`;
  }

  function renderEmptyScenes(state) {
    return `<div class="hvr-scenes-empty"><strong>Chưa có danh sách cảnh</strong><small>${state.sourceAsset ? "Bấm Phân tích cảnh. Nếu backend chưa hỗ trợ, Studio chỉ chia đều theo thời lượng và ghi rõ phương pháp." : "Thêm video nguồn hoặc bấm + Cảnh cho video tạo từ prompt."}</small></div>`;
  }

  function renderControlSliders(state) {
    const controls = [
      ["preserveMotion", "Giữ chuyển động gốc"], ["preserveCamera", "Giữ camera"],
      ["preserveBackground", "Giữ bối cảnh"], ["identityStrength", "Độ giống nhân vật"],
      ["creativity", "Độ sáng tạo"]
    ];
    return `<div class="hvr-sliders">${controls.map(([key, label]) => `<label><span>${label}<output>${Math.round(state.settings[key])}%</output></span><input type="range" min="0" max="100" value="${Math.round(state.settings[key])}" data-hvr-setting="${key}"></label>`).join("")}
      <label class="hvr-toggle"><input type="checkbox" data-hvr-setting="preserveAudio" ${state.settings.preserveAudio ? "checked" : ""}><span>Giữ âm thanh/lời thoại gốc khi backend hỗ trợ</span></label>
    </div>`;
  }

  function renderAttestations(state, mode) {
    const needsRights = mode.requiresSource || state.characterAssets.length > 0 || state.referenceAssets.length > 0;
    return `<fieldset class="hvr-attestations"><legend>Quyền sử dụng</legend>
      <label class="hvr-check ${needsRights ? "is-required" : ""}"><input type="checkbox" data-hvr-attest="rights" ${state.rightsAttested ? "checked" : ""}><span><strong>Tôi có quyền sử dụng video/ảnh</strong><small>Không được chọn sẵn. Xác nhận này được gửi cùng từng tác vụ.</small></span></label>
      ${mode.requiresCharacter ? `<label class="hvr-check is-required"><input type="checkbox" data-hvr-attest="character" ${state.characterConsentAttested ? "checked" : ""}><span><strong>Nhân vật thật đã đồng ý</strong><small>Tôi có sự đồng ý phù hợp để tạo hoặc thay diện mạo nhân vật.</small></span></label>` : ""}
    </fieldset>`;
  }

  function renderQueueItem(job) {
    const controls = [];
    if (["queued", "submitting", "submitted", "dispatching", "running"].includes(job.status)) controls.push(`<button type="button" data-hvr-job-action="pause" data-hvr-job="${job.id}">Tạm dừng</button>`);
    if (job.status === "paused") controls.push(`<button type="button" data-hvr-job-action="resume" data-hvr-job="${job.id}">Tiếp tục</button>`);
    if (["failed", "cancelled", "submission-unknown"].includes(job.status)) controls.push(`<button type="button" data-hvr-job-action="retry" data-hvr-job="${job.id}">${job.status === "submission-unknown" && !job.backendId ? "Kiểm tra lại an toàn" : "Thử lại"}</button>`);
    if (!["completed", "cancelled", "cancel-requested"].includes(job.status)) controls.push(`<button type="button" data-hvr-job-action="cancel" data-hvr-job="${job.id}">Hủy</button>`);
    if (job.status === "completed" && job.backendId) controls.push(`<a href="${escapeHtml(instance?.client.downloadUrl(job.backendId) || "#")}" download>Tải ngay</a>`);
    const progressKnown = Number.isFinite(job.progress);
    const progress = progressKnown ? clamp(job.progress, 0, 100) : 0;
    const warning = job.providerMayContinue
      ? "Provider chưa xác nhận dừng/hủy và có thể vẫn tiếp tục tính phí."
      : job.statusWarning;
    return `<article class="hvr-queue-job hvr-queue-job--${job.status}" title="${escapeHtml(job.error || warning || job.title)}">
      <span><strong>${escapeHtml(job.title)}</strong><small>${escapeHtml(queueStatusLabel(job.status))}${job.retryFrom ? ` · tiếp từ ${Math.round(job.retryFrom)}%` : job.retryStage ? ` · checkpoint ${escapeHtml(job.retryStage)}` : ""}</small></span>
      <div class="hvr-progress ${progressKnown ? "" : "is-indeterminate"}" role="progressbar" aria-valuemin="0" aria-valuemax="100" ${progressKnown ? `aria-valuenow="${Math.round(progress)}"` : 'aria-valuetext="Backend chưa cung cấp phần trăm"'}><i style="width:${progress}%"></i></div>
      <em>${progressKnown ? `${Math.round(progress)}%` : "—"}</em><div class="hvr-job-actions">${controls.join("")}</div>${warning ? `<small class="hvr-expiry-note hvr-expiry-note--warning">${escapeHtml(warning)}</small>` : ""}${job.status === "completed" ? '<small class="hvr-expiry-note">Tải sớm: tệp nhà cung cấp có thể hết hạn nếu chưa lưu vào Media Cloud.</small>' : ""}
    </article>`;
  }

  function queueStatusLabel(status) {
    return ({ queued: "Đang chờ", submitting: "Đang gửi", submitted: "Backend đã nhận", dispatching: "Đang chuyển tới provider", running: "Đang render", "pause-requested": "Đang yêu cầu tạm dừng", paused: "Đã tạm dừng", "cancel-requested": "Đang yêu cầu hủy", "submission-unknown": "Chưa rõ provider đã nhận hay chưa", completed: "Hoàn tất", failed: "Lỗi", cancelled: "Đã hủy" })[status] || "Không xác định";
  }

  function queueSummary(queue) {
    const completed = queue.filter((item) => item.status === "completed").length;
    const failed = queue.filter((item) => item.status === "failed").length;
    return `${completed}/${queue.length} hoàn tất${failed ? ` · ${failed} lỗi` : ""}`;
  }

  function analysisIcon(status) {
    return ({ ready: "✓", local: "≈", error: "!", unsupported: "?", "submission-unknown": "?", submitting: "↻", reading: "↻" })[status] || "i";
  }

  function analysisTitle(analysis) {
    return ({ ready: "Phân tích backend", local: "Chia cảnh cục bộ", error: "Phân tích thất bại", unsupported: "Backend chưa hỗ trợ", "submission-unknown": "Cần đối soát phân tích", submitting: "Đang gửi phân tích", reading: "Đang đọc video" })[analysis.state] || "Trạng thái phân tích";
  }

  function analysisFallback(analysis) {
    if (analysis.method === "local-duration") return "Các cảnh được chia đều theo thời lượng, không phải phát hiện nội dung bằng AI.";
    return "Chưa phân tích video hoặc storyboard.";
  }

  function bind(runtime) {
    const rootElement = runtime.root;
    const signal = runtime.controller.signal;
    rootElement.addEventListener("click", (event) => onClick(runtime, event), { signal });
    rootElement.addEventListener("change", (event) => onChange(runtime, event), { signal });
    rootElement.addEventListener("input", (event) => onInput(runtime, event), { signal });
    rootElement.addEventListener("keydown", (event) => onKeydown(runtime, event), { signal });
    global.addEventListener?.("online", () => refreshCapabilities(runtime), { signal });
    global.addEventListener?.("hh:auth-change", (event) => remountForIdentity(runtime, event?.detail?.user), { signal });
    global.addEventListener?.("hh:auth-changed", (event) => remountForIdentity(runtime, event?.detail?.user), { signal });
  }

  function onClick(runtime, event) {
    const modeButton = event.target.closest?.("[data-hvr-mode]");
    if (modeButton) return selectMode(runtime, modeButton.dataset.hvrMode);
    const sceneButton = event.target.closest?.("[data-hvr-scene]");
    if (sceneButton) return commit(runtime, (state) => ({ ...state, selectedSceneId: sceneButton.dataset.hvrScene }));
    const removeCharacter = event.target.closest?.("[data-hvr-remove-character]");
    if (removeCharacter) return removeCharacterAsset(runtime, removeCharacter.dataset.hvrRemoveCharacter);
    const jobAction = event.target.closest?.("[data-hvr-job-action]");
    if (jobAction) return handleJobAction(runtime, jobAction.dataset.hvrJob, jobAction.dataset.hvrJobAction);
    const actionElement = event.target.closest?.("[data-hvr-action]");
    if (!actionElement) return;
    const action = actionElement.dataset.hvrAction;
    if (action === "refresh-capabilities") refreshCapabilities(runtime);
    if (action === "refresh-media") refreshMediaCloud(runtime);
    if (action === "open-media-cloud") openMediaCloud(runtime);
    if (action === "remove-source") removeSource(runtime);
    if (action === "apply-cloud-source") applyCloudSource(runtime);
    if (action === "add-character-cloud") addCharacterCloud(runtime);
    if (action === "analyze") analyzeProject(runtime);
    if (action === "add-scene") addScene(runtime);
    if (action === "previous-scene") moveScene(runtime, -1);
    if (action === "next-scene") moveScene(runtime, 1);
    if (action === "queue-selected") queueSelected(runtime);
    if (action === "queue-all") queueAll(runtime);
    if (action === "toggle-queue") {
      runtime.queueExpanded = !runtime.queueExpanded;
      render(runtime, "[data-hvr-action='toggle-queue']");
    }
    if (action === "estimate") requestEstimate(runtime);
    if (action === "cancel-confirmation") { runtime.pendingConfirmation = null; render(runtime); }
    if (action === "retry-confirmation") retryPendingConfirmation(runtime);
    if (action === "confirm-dispatch") confirmDispatch(runtime);
  }

  function onChange(runtime, event) {
    const input = event.target;
    if (input.matches("[data-hvr-source-file]")) importSourceFile(runtime, input.files?.[0]);
    if (input.matches("[data-hvr-character-files]")) importCharacterFiles(runtime, [...(input.files || [])]);
    if (input.matches("[data-hvr-media-source]") && input.value) chooseMediaSource(runtime, input.value);
    if (input.matches("[data-hvr-setting]")) updateSetting(runtime, input.dataset.hvrSetting, input);
    if (input.matches("[data-hvr-attest='rights']")) commit(runtime, (state) => ({ ...state, rightsAttested: input.checked === true }));
    if (input.matches("[data-hvr-attest='character']")) commit(runtime, (state) => ({ ...state, characterConsentAttested: input.checked === true }));
    if (input.matches("[data-hvr-project-name]")) commit(runtime, (state) => ({ ...state, project: { ...state.project, name: asText(input.value, 180) || "Dự án video mới" } }));
    if (input.matches("[data-hvr-media-project]")) commit(runtime, (state) => ({ ...state, mediaProjectId: safeId(input.value, ""), rightsAttested: false }));
    if (input.matches("[data-hvr-cost-accept],[data-hvr-unknown-cost-accept]")) updateCostConfirmationButton(runtime);
  }

  function updateCostConfirmationButton(runtime) {
    const button = runtime.root.querySelector("[data-hvr-action='confirm-dispatch']");
    if (!button) return;
    button.disabled = !canConfirmCost(runtime.pendingConfirmation, runtime.state.capabilities.billing, {
      estimateAccepted: runtime.root.querySelector("[data-hvr-cost-accept]")?.checked === true,
      unknownCostAccepted: runtime.root.querySelector("[data-hvr-unknown-cost-accept]")?.checked === true
    });
  }

  function onInput(runtime, event) {
    const input = event.target;
    if (input.matches("[data-hvr-prompt]")) {
      const prompt = asText(input.value, MAX_PROMPT_LENGTH);
      const selectedId = runtime.state.selectedSceneId;
      commit(runtime, (state) => ({
        ...state,
        prompt: selectedId ? state.prompt : prompt,
        scenes: selectedId ? state.scenes.map((scene) => scene.id === selectedId ? { ...scene, prompt } : scene) : state.scenes
      }), { render: false });
      input.nextElementSibling.textContent = `${prompt.length}/${MAX_PROMPT_LENGTH} · Ctrl+Enter để đưa cảnh vào hàng đợi`;
      scheduleEstimate(runtime);
    }
    if (input.matches("input[type='range'][data-hvr-setting]")) {
      const output = input.closest("label")?.querySelector("output");
      if (output) output.textContent = `${input.value}%`;
      updateSetting(runtime, input.dataset.hvrSetting, input, false);
    }
  }

  function onKeydown(runtime, event) {
    if (event.key === "Escape" && runtime.pendingConfirmation) {
      event.preventDefault();
      runtime.pendingConfirmation = null;
      render(runtime);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      queueSelected(runtime);
      return;
    }
    const modeTab = event.target.closest?.("[data-hvr-mode]");
    if (modeTab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const current = Math.max(0, MODES.findIndex((mode) => mode.id === modeTab.dataset.hvrMode));
      const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? MODES.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + MODES.length) % MODES.length;
      selectMode(runtime, MODES[nextIndex].id, true);
      return;
    }
    if (event.target.matches("input,textarea,select")) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); moveScene(runtime, -1); }
    if (event.key === "ArrowRight") { event.preventDefault(); moveScene(runtime, 1); }
  }

  function selectMode(runtime, modeId, focusTab = false) {
    if (!MODES.some((mode) => mode.id === modeId)) return;
    const catalog = mergedCatalog(runtime.state.capabilities.models);
    const nextModel = compatibleModel(modeId, runtime.state.modelId, catalog);
    commit(runtime, (state) => ({
      ...state,
      mode: modeId,
      modelId: nextModel.id,
      characterConsentAttested: false,
      rightsAttested: false
    }), { focus: focusTab ? `[data-hvr-mode="${modeId}"]` : undefined });
    scheduleEstimate(runtime);
  }

  function updateSetting(runtime, key, input, renderNow = true) {
    if (key === "modelId") {
      commit(runtime, (state) => ({ ...state, modelId: safeId(input.value, state.modelId) }), { render: renderNow });
    } else if (["durationSeconds", "variants"].includes(key)) {
      commit(runtime, (state) => ({ ...state, settings: { ...state.settings, [key]: Number(input.value) } }), { render: renderNow });
    } else if (["aspectRatio", "resolution"].includes(key)) {
      commit(runtime, (state) => ({ ...state, settings: { ...state.settings, [key]: input.value } }), { render: renderNow });
    } else if (key === "preserveAudio") {
      commit(runtime, (state) => ({ ...state, settings: { ...state.settings, preserveAudio: input.checked === true } }), { render: renderNow });
    } else if (["preserveMotion", "preserveCamera", "preserveBackground", "identityStrength", "creativity"].includes(key)) {
      commit(runtime, (state) => ({ ...state, settings: { ...state.settings, [key]: clamp(input.value, 0, 100) } }), { render: renderNow });
    }
    scheduleEstimate(runtime);
  }

  async function importSourceFile(runtime, file) {
    if (!file) return;
    commit(runtime, (state) => ({ ...state, analysis: { ...state.analysis, state: "reading", message: "Đang đọc metadata và tạo thumbnail ngay trên thiết bị…" } }));
    try {
      const result = await readVideoMetadata(file);
      if (runtime !== instance) return;
      runtime.localFiles.set(result.asset.id, file);
      runtime.objectUrls.set(result.asset.id, result.objectUrl);
      const scenes = splitScenes(result.asset.duration, runtime.state.settings.durationSeconds, { prefix: result.asset.id, thumbnail: result.asset.thumbnail });
      commit(runtime, (state) => ({
        ...state,
        sourceAsset: result.asset,
        scenes,
        selectedSceneId: scenes[0]?.id || "",
        rightsAttested: false,
        analysis: {
          state: "local", method: "local-duration",
          message: "Đã chia đều theo thời lượng. Đây chưa phải phát hiện shot bằng AI; hãy gán Cloud Asset ID rồi bấm Phân tích cảnh.",
          sourceAssetId: "", updatedAt: nowIso()
        }
      }));
      setNotice(runtime, "Đã tạo preview cục bộ. Video chưa được tải lên backend.", "success");
    } catch (error) {
      commit(runtime, (state) => ({ ...state, analysis: { ...state.analysis, state: "error", message: safeBackendError(error, "Không thể đọc video cục bộ."), updatedAt: nowIso() } }));
    }
  }

  async function importCharacterFiles(runtime, files) {
    const accepted = files.slice(0, Math.max(0, MAX_CHARACTER_REFERENCES - runtime.state.characterAssets.length));
    if (!accepted.length) return setNotice(runtime, `Character Pack chỉ nhận tối đa ${MAX_CHARACTER_REFERENCES} ảnh.`, "warning");
    const results = await Promise.allSettled(accepted.map(readImageMetadata));
    if (runtime !== instance) return;
    const assets = [];
    results.forEach((result, index) => {
      if (result.status !== "fulfilled") return;
      assets.push(result.value);
      runtime.localFiles.set(result.value.id, accepted[index]);
    });
    commit(runtime, (state) => ({
      ...state,
      characterAssets: [...state.characterAssets, ...assets].slice(0, MAX_CHARACTER_REFERENCES),
      characterConsentAttested: false,
      rightsAttested: false
    }));
    const failed = results.length - assets.length;
    setNotice(runtime, `Đã thêm ${assets.length} preview ảnh${failed ? `; ${failed} ảnh không đọc được` : ""}. Cần Cloud Asset ID để render.`, failed ? "warning" : "success");
  }

  function removeSource(runtime) {
    const asset = runtime.state.sourceAsset;
    if (asset) {
      const url = runtime.objectUrls.get(asset.id);
      if (url) global.URL?.revokeObjectURL?.(url);
      runtime.objectUrls.delete(asset.id);
      runtime.localFiles.delete(asset.id);
    }
    commit(runtime, (state) => ({
      ...state, sourceAsset: null, scenes: [], selectedSceneId: "", rightsAttested: false,
      analysis: { state: "idle", method: "none", message: "", sourceAssetId: "", updatedAt: nowIso() }
    }));
  }

  function removeCharacterAsset(runtime, id) {
    runtime.localFiles.delete(id);
    commit(runtime, (state) => ({
      ...state,
      characterAssets: state.characterAssets.filter((asset) => asset.id !== id),
      characterConsentAttested: false,
      rightsAttested: false
    }));
  }

  function applyCloudSource(runtime) {
    const input = runtime.root.querySelector("[data-hvr-cloud-source]");
    const cloudAssetId = safeId(input?.value, "");
    const mediaProjectId = safeId(runtime.root.querySelector("[data-hvr-media-project]")?.value, runtime.state.mediaProjectId);
    if (!cloudAssetId) return setNotice(runtime, "Hãy nhập Cloud Asset ID hợp lệ.", "warning");
    commit(runtime, (state) => ({
      ...state,
      sourceAsset: normalizeAsset({ ...(state.sourceAsset || {}), id: state.sourceAsset?.id || cloudAssetId, cloudAssetId, mediaProjectId, cloudState: "ready", name: state.sourceAsset?.name || `Cloud video ${cloudAssetId}` }, "source"),
      mediaProjectId,
      rightsAttested: false
    }));
    setNotice(runtime, "Đã gán ID. Backend vẫn sẽ kiểm tra quyền sở hữu trước khi phân tích hoặc render.", "info");
  }

  function addCharacterCloud(runtime) {
    const input = runtime.root.querySelector("[data-hvr-character-cloud]");
    const cloudAssetId = safeId(input?.value, "");
    const mediaProjectId = safeId(runtime.root.querySelector("[data-hvr-media-project]")?.value, runtime.state.mediaProjectId);
    if (!cloudAssetId) return setNotice(runtime, "Hãy nhập Cloud Asset ID ảnh hợp lệ.", "warning");
    if (runtime.state.characterAssets.length >= MAX_CHARACTER_REFERENCES) return setNotice(runtime, `Character Pack đã đủ ${MAX_CHARACTER_REFERENCES} ảnh.`, "warning");
    commit(runtime, (state) => ({
      ...state,
      characterAssets: [...state.characterAssets, normalizeAsset({ id: cloudAssetId, cloudAssetId, mediaProjectId, kind: "character", name: `Ảnh cloud ${cloudAssetId}`, cloudState: "ready" }, "character")],
      mediaProjectId,
      characterConsentAttested: false,
      rightsAttested: false
    }));
    setNotice(runtime, "Đã thêm ảnh cloud. Backend sẽ kiểm tra quyền sở hữu khi tạo tác vụ.", "success");
  }

  function chooseMediaSource(runtime, cloudAssetId) {
    const asset = runtime.mediaAssets.find((item) => item.cloudAssetId === cloudAssetId);
    if (!asset) return setNotice(runtime, "Không tìm thấy tài sản cloud đã chọn.", "error");
    const duration = asset.duration || 0;
    const scenes = duration ? splitScenes(duration, runtime.state.settings.durationSeconds, { prefix: asset.id, thumbnail: asset.thumbnail }) : runtime.state.scenes;
    commit(runtime, (state) => ({
      ...state,
      sourceAsset: asset,
      mediaProjectId: asset.mediaProjectId,
      scenes,
      selectedSceneId: scenes[0]?.id || state.selectedSceneId,
      rightsAttested: false,
      analysis: { state: duration ? "local" : "idle", method: duration ? "local-duration" : "none", message: duration ? "Tạm chia theo metadata Media Cloud; bấm Phân tích cảnh để dùng backend." : "Hãy bấm Phân tích cảnh.", sourceAssetId: asset.cloudAssetId, updatedAt: nowIso() }
    }));
  }

  function openMediaCloud(runtime) {
    const route = "/media-design/media-cloud";
    if (typeof runtime.options.navigate === "function") {
      runtime.options.navigate(route);
      return;
    }
    try { global.location.hash = `#${route}`; }
    catch { setNotice(runtime, "Không thể mở Media Cloud trong shell hiện tại.", "error"); }
  }

  async function refreshMediaCloud(runtime) {
    if (runtime !== instance || typeof global.fetch !== "function") return;
    runtime.mediaState = "loading";
    try {
      const response = await global.fetch("/api/store/media?status=ready&limit=100", { credentials: "include", headers: { Accept: "application/json" }, signal: runtime.controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const rows = payload.assets || payload.items || payload.data || [];
      runtime.mediaAssets = Array.isArray(rows) ? rows.map((asset) => normalizeAsset({ ...asset, cloudAssetId: asset.id || asset.assetId, cloudState: asset.status || "ready" }, /^video\//i.test(asset.type || asset.mimeType || "") ? "source" : "reference")).filter(Boolean) : [];
      runtime.mediaState = "ready";
      render(runtime);
    } catch (error) {
      if (error.name === "AbortError") return;
      runtime.mediaState = "error";
      render(runtime);
    }
  }

  async function refreshCapabilities(runtime) {
    if (runtime !== instance || runtime.busy.has("capabilities")) return;
    runtime.busy.add("capabilities");
    commit(runtime, (state) => ({ ...state, capabilities: { ...state.capabilities, state: "checking", message: "Đang hỏi backend về model và quota…" } }));
    try {
      const payload = await runtime.client.capabilities();
      const capabilities = payload.capabilities || payload.data || payload;
      const models = deriveCapabilityModels(capabilities);
      const modeSupport = capabilities.modes && typeof capabilities.modes === "object"
        ? Object.values(capabilities.modes).filter((entry) => entry?.supported === true).length : 0;
      const billingMessage = capabilities.billing?.enabled === false
        ? " Billing chưa được bật; backend sẽ chặn dispatch có phí." : "";
      commit(runtime, (state) => ({
        ...state,
        capabilities: {
          state: capabilities.supported === false ? "unsupported" : "ready",
          message: asText(capabilities.message || `${modeSupport} chế độ backend sẵn sàng.${billingMessage}`, 600),
          models,
          billing: sanitizePublicValue(capabilities.billing || {}) || {},
          analysis: sanitizePublicValue(capabilities.analysis || {}) || {},
          limits: sanitizePublicValue(capabilities.limits || {}) || {},
          checkedAt: nowIso()
        }
      }));
    } catch (error) {
      commit(runtime, (state) => ({ ...state, capabilities: { ...state.capabilities, state: error.status === 404 ? "unsupported" : "error", message: safeBackendError(error), checkedAt: nowIso() } }));
    } finally {
      runtime.busy.delete("capabilities");
    }
  }

  async function analyzeProject(runtime) {
    if (runtime !== instance || runtime.busy.has("analyze")) return;
    const state = runtime.state;
    if (["submission-unknown", "submitting"].includes(state.analysis.state) && state.analysis.submission) {
      return submitAnalysis(runtime, state.analysis.submission, true);
    }
    if (modeById(state.mode).requiresSource && !state.sourceAsset?.cloudAssetId) {
      if (state.sourceAsset?.duration) {
        const scenes = splitScenes(state.sourceAsset.duration, state.settings.durationSeconds, { prefix: state.sourceAsset.id, thumbnail: state.sourceAsset.thumbnail });
        commit(runtime, (current) => ({ ...current, scenes, selectedSceneId: scenes[0]?.id || "", analysis: { state: "local", method: "local-duration", message: "Không có Cloud Asset ID nên chỉ chia đều theo thời lượng; không gọi đây là phát hiện cảnh AI.", sourceAssetId: "", updatedAt: nowIso() } }));
      } else setNotice(runtime, "Cần Cloud Asset ID để backend đọc video nguồn.", "warning");
      return;
    }
    if ((state.sourceAsset?.cloudAssetId || state.characterAssets.some((asset) => asset.cloudAssetId)) && !state.rightsAttested) {
      return setNotice(runtime, "Hãy xác nhận quyền sử dụng tài sản trước khi gửi video/ảnh cho backend phân tích.", "warning");
    }
    if (state.mode === "character-replace" && !state.characterConsentAttested) {
      return setNotice(runtime, "Hãy xác nhận sự đồng ý của nhân vật trước khi phân tích.", "warning");
    }
    const request = buildAnalysisPayload(state);
    if (!request.brief) return setNotice(runtime, request.visualAnalysis ? "Hãy nhập mục tiêu phân tích video trước khi gửi cho worker." : "Hãy nhập ý tưởng để AI Director tạo storyboard.", "warning");
    if (state.capabilities.state === "ready" && !state.capabilities.billing.canCreate) {
      return setNotice(runtime, state.capabilities.billing.reason || "Tài khoản chưa được phép dùng phân tích AI có thể phát sinh chi phí.", "error");
    }
    if (state.capabilities.state === "ready" && request.visualAnalysis && !state.capabilities.analysis.visualSourceAnalysis) {
      return setNotice(runtime, "Backend chưa khai báo worker phân tích hình ảnh. Studio không giả là Gemini đã xem video nguồn.", "warning");
    }
    if (state.capabilities.state === "ready" && !request.visualAnalysis && !state.capabilities.analysis.directorPlan) {
      return setNotice(runtime, "AI Director chưa được cấu hình trên backend.", "warning");
    }
    runtime.pendingConfirmation = { state: "loading", action: "analysis", sceneCount: 1, sceneIds: [] };
    runtime.busy.add("quote-analysis");
    render(runtime, "[data-hvr-action='cancel-confirmation']");
    try {
      const response = await runtime.client.estimateAnalysis(request);
      if (response.supported === false) throw new Error(response.reason || response.message || "Backend không hỗ trợ kiểu phân tích này.");
      const estimate = response.estimate || {};
      const quote = response.quote || {};
      if (!quote.id) throw new Error("Backend chưa cấp Quote ID cho phân tích; chưa có dữ liệu nào được gửi tới model.");
      const entry = {
        scene: normalizeScene({ id: "analysis", title: request.visualAnalysis ? "Phân tích video nguồn" : "AI Director storyboard" }),
        request,
        quoteId: safeId(quote.id, ""),
        quoteExpiresAt: asText(quote.expiresAt, 40),
        idempotencyKey: uid("analysis"),
        adapter: asText(response.adapter, 100),
        model: asText(response.model, 160),
        estimate: {
          currency: asText(estimate.currency || "USD", 12),
          amount: estimate.amount == null ? null : Math.max(0, Number(estimate.amount) || 0),
          quantity: Math.max(0, Number(estimate.quantity) || 0),
          billingUnit: asText(estimate.billingUnit, 60),
          disclaimer: asText(estimate.disclaimer, 500),
          pricingVersion: asText(estimate.pricingVersion, 80),
          pricingConfigured: estimate.pricingConfigured !== false && estimate.amount != null
        }
      };
      runtime.pendingConfirmation = {
        state: "ready", action: "analysis", sceneCount: 1, sceneIds: [], totalVariants: 1,
        entries: [entry], totalAmount: Number(entry.estimate.amount) || 0,
        pricingUnknown: entry.estimate.pricingConfigured !== true,
        currency: entry.estimate.currency, adapter: entry.adapter, model: entry.model,
        expiresAt: entry.quoteExpiresAt || null
      };
      render(runtime, "[data-hvr-cost-accept]");
    } catch (error) {
      runtime.pendingConfirmation = {
        state: "error", action: "analysis", sceneCount: 1, sceneIds: [],
        error: safeBackendError(error, "Không thể lấy báo giá phân tích. Chưa gửi nội dung tới model.")
      };
      render(runtime, "[data-hvr-action='retry-confirmation']");
    } finally {
      runtime.busy.delete("quote-analysis");
    }
  }

  async function submitAnalysis(runtime, submission, reconciling = false) {
    if (runtime !== instance || runtime.busy.has("analyze") || !submission?.request) return;
    runtime.busy.add("analyze");
    commit(runtime, (current) => ({
      ...current,
      analysis: {
        ...current.analysis,
        state: "submitting",
        message: reconciling ? "Đang đối soát cùng idempotency key; không tạo phân tích trùng…" : "Backend đang phân tích theo quote đã xác nhận…",
        submission,
        updatedAt: nowIso()
      }
    }));
    try {
      const payload = await runtime.client.analyze({
        ...submission.request,
        quoteId: submission.quoteId,
        acceptedQuoteId: submission.quoteId,
        acceptedEstimate: true,
        costAccepted: true,
        idempotencyKey: submission.idempotencyKey
      });
      const publicAnalysis = payload.analysis && typeof payload.analysis === "object" ? payload.analysis : {};
      const status = asText(publicAnalysis.status, 40).toLowerCase();
      if (["analyzing", "queued", "submitted"].includes(status)) {
        commit(runtime, (current) => ({
          ...current,
          analysis: { ...current.analysis, state: "submitting", backendId: safeId(publicAnalysis.id, ""), submission, message: "Phân tích đã được backend ghi nhận và đang xử lý.", updatedAt: nowIso() }
        }));
        return;
      }
      if (status === "submission-unknown") {
        commit(runtime, (current) => ({
          ...current,
          analysis: { ...current.analysis, state: "submission-unknown", backendId: safeId(publicAnalysis.id, ""), submission, message: asText(payload.warning || publicAnalysis.error?.message || "Chưa rõ provider đã nhận phân tích hay chưa. Bấm lại Phân tích để đối soát cùng idempotency key.", 600), updatedAt: nowIso() }
        }));
        return;
      }
      if (status === "failed" && !payload.plan) throw Object.assign(new Error(publicAnalysis.error?.message || payload.warning || "Backend không thể hoàn tất phân tích."), { status: 422 });
      const plan = payload.plan || payload.data?.plan;
      const rows = plan?.scenes || [];
      if (!Array.isArray(rows) || !rows.length) throw new Error("Backend chưa trả về storyboard hoàn chỉnh.");
      const basis = asText(payload.analysisBasis || plan.analysisBasis, 160);
      const scenes = mapPlanScenes(rows, { durationSeconds: runtime.state.settings.durationSeconds, analysisBasis: basis });
      const provider = asText(payload.provider || publicAnalysis.provider, 80);
      const model = asText(payload.model || publicAnalysis.model, 120);
      commit(runtime, (current) => ({
        ...current,
        scenes,
        selectedSceneId: scenes[0]?.id || "",
        analysis: {
          state: "ready", method: basis === "worker-visual-analysis" ? "backend-shot-detection" : "director",
          message: asText(`${scenes.length} cảnh · ${basis || "phạm vi phân tích do backend công bố"}${provider ? ` · ${provider}` : ""}${model ? ` · ${model}` : ""}.`, 600),
          sourceAssetId: current.sourceAsset?.cloudAssetId || "", backendId: safeId(publicAnalysis.id, ""), submission: null, updatedAt: nowIso()
        }
      }));
    } catch (error) {
      const ambiguous = error?.name === "AbortError" || !Number(error?.status || error?.statusCode);
      commit(runtime, (current) => ({
        ...current,
        analysis: {
          ...current.analysis,
          state: ambiguous ? "submission-unknown" : (error.status === 404 ? "unsupported" : "error"),
          submission: ambiguous ? submission : null,
          message: ambiguous
            ? `${safeBackendError(error)} Bấm Phân tích để đối soát an toàn bằng cùng idempotency key.`
            : safeBackendError(error, "Không thể phân tích video."),
          updatedAt: nowIso()
        }
      }));
    } finally {
      runtime.busy.delete("analyze");
    }
  }

  function addScene(runtime) {
    const index = runtime.state.scenes.length;
    const start = runtime.state.scenes[index - 1]?.end || index * runtime.state.settings.durationSeconds;
    const scene = normalizeScene({ id: uid("scene"), order: index, title: `Cảnh ${index + 1}`, start, end: start + runtime.state.settings.durationSeconds, duration: runtime.state.settings.durationSeconds, prompt: runtime.state.prompt, source: "manual" }, index);
    commit(runtime, (state) => ({ ...state, scenes: [...state.scenes, scene], selectedSceneId: scene.id }), { focus: "[data-hvr-prompt]" });
  }

  function moveScene(runtime, direction) {
    if (!runtime.state.scenes.length) return;
    const index = Math.max(0, runtime.state.scenes.findIndex((scene) => scene.id === runtime.state.selectedSceneId));
    const next = runtime.state.scenes[(index + direction + runtime.state.scenes.length) % runtime.state.scenes.length];
    commit(runtime, (state) => ({ ...state, selectedSceneId: next.id }));
  }

  function makeLocalJob(runtime, scene) {
    const cost = estimateCost({
      modelId: runtime.state.modelId,
      durationSeconds: runtime.state.settings.durationSeconds,
      sceneCount: 1,
      variants: runtime.state.settings.variants,
      resolution: runtime.state.settings.resolution
    }, mergedCatalog(runtime.state.capabilities.models));
    return normalizeQueueItem({
      id: uid("job"), sceneId: scene?.id || uid("scene"), title: scene?.title || "Video từ yêu cầu",
      status: "queued", progress: 0, checkpoint: 0, attempts: 0,
      costEstimateUsd: cost.amountUsd, createdAt: nowIso(), updatedAt: nowIso()
    });
  }

  function queueSelected(runtime) {
    let scene = runtime.state.scenes.find((item) => item.id === runtime.state.selectedSceneId);
    if (!scene && ["text-to-video", "ai-director"].includes(runtime.state.mode)) {
      scene = normalizeScene({ id: uid("scene"), order: 0, title: "Cảnh 1", start: 0, end: runtime.state.settings.durationSeconds, duration: runtime.state.settings.durationSeconds, prompt: runtime.state.prompt, source: runtime.state.mode === "ai-director" ? "director" : "manual" }, 0);
      commit(runtime, (state) => ({ ...state, scenes: [scene], selectedSceneId: scene.id }), { render: false });
    }
    const validation = validateJob(runtime.state, scene, mergedCatalog(runtime.state.capabilities.models));
    if (!validation.valid) return setNotice(runtime, validation.errors[0], "error");
    prepareDispatchConfirmation(runtime, [scene]);
  }

  function queueAll(runtime) {
    if (!runtime.state.scenes.length) return setNotice(runtime, "Chưa có cảnh để đưa vào hàng đợi.", "warning");
    const catalog = mergedCatalog(runtime.state.capabilities.models);
    const invalid = runtime.state.scenes.slice(0, MAX_SAFE_BATCH).map((scene) => validateJob(runtime.state, scene, catalog)).find((result) => !result.valid);
    if (invalid) return setNotice(runtime, invalid.errors[0], "error");
    prepareDispatchConfirmation(runtime, runtime.state.scenes);
  }

  async function prepareDispatchConfirmation(runtime, scenes) {
    if (runtime !== instance || runtime.busy.has("quote")) return;
    if (runtime.state.capabilities.state === "ready" && !runtime.state.capabilities.billing.canCreate) {
      return setNotice(runtime, runtime.state.capabilities.billing.reason || "Tài khoản chưa được cấp quyền billing cho AI Video.", "error");
    }
    const cleanScenes = scenes.slice(0, MAX_SAFE_BATCH);
    if (!cleanScenes.length) return setNotice(runtime, "Chưa có cảnh hợp lệ để báo giá.", "warning");
    if (scenes.length > cleanScenes.length) setNotice(runtime, `Mỗi lần chỉ xác nhận tối đa 10 cảnh để tránh quote hết hạn. ${scenes.length - cleanScenes.length} cảnh còn lại chưa được đưa vào hàng đợi.`, "warning", false);
    runtime.pendingConfirmation = { state: "loading", sceneCount: cleanScenes.length, sceneIds: cleanScenes.map((scene) => scene.id) };
    runtime.busy.add("quote");
    render(runtime, "[data-hvr-action='cancel-confirmation']");
    try {
      const entries = [];
      const stateSnapshot = normalizeState(runtime.state);
      for (const scene of cleanScenes) {
        if (runtime !== instance || runtime.pendingConfirmation == null) return;
        const request = buildJobPayload(stateSnapshot, scene);
        const response = await runtime.client.estimate(request);
        const estimate = response.estimate || {};
        const quote = response.quote || {};
        if (response.supported === false) throw new Error(response.reason || response.message || "Backend không hỗ trợ yêu cầu này.");
        if (!quote.id) throw new Error("Backend chưa cấp Quote ID; tác vụ trả phí chưa thể được xác nhận an toàn.");
        entries.push({
          scene,
          request,
          quoteId: safeId(quote.id, ""),
          quoteExpiresAt: asText(quote.expiresAt, 40),
          adapter: asText(response.adapter, 100),
          model: asText(response.model, 160),
          estimate: {
            currency: asText(estimate.currency || "USD", 12),
            amount: estimate.amount == null ? null : Math.max(0, Number(estimate.amount) || 0),
            quantity: Math.max(0, Number(estimate.quantity) || 0),
            billingUnit: asText(estimate.billingUnit, 60),
            disclaimer: asText(estimate.disclaimer, 500),
            pricingVersion: asText(estimate.pricingVersion, 80),
            pricingConfigured: estimate.pricingConfigured !== false && estimate.amount != null
          }
        });
      }
      const currency = entries[0]?.estimate.currency || "USD";
      if (entries.some((entry) => entry.estimate.currency !== currency)) throw new Error("Backend trả về nhiều đơn vị tiền tệ; không thể cộng báo giá an toàn.");
      runtime.pendingConfirmation = {
        state: "ready",
        sceneCount: entries.length,
        sceneIds: entries.map((entry) => entry.scene.id),
        totalVariants: entries.reduce((sum, entry) => sum + (Number(entry.request.variants) || 1), 0),
        entries,
        totalAmount: entries.reduce((sum, entry) => sum + (Number(entry.estimate.amount) || 0), 0),
        pricingUnknown: entries.some((entry) => entry.estimate.pricingConfigured !== true),
        currency,
        adapter: entries.map((entry) => entry.adapter).filter(Boolean).filter((value, index, list) => list.indexOf(value) === index).join(", "),
        model: entries.map((entry) => entry.model).filter(Boolean).filter((value, index, list) => list.indexOf(value) === index).join(", "),
        expiresAt: entries.map((entry) => entry.quoteExpiresAt).filter(Boolean).sort()[0] || null
      };
      render(runtime, "[data-hvr-cost-accept]");
    } catch (error) {
      runtime.pendingConfirmation = {
        state: "error",
        sceneCount: cleanScenes.length,
        sceneIds: cleanScenes.map((scene) => scene.id),
        error: safeBackendError(error, "Không thể lấy báo giá máy chủ. Không có tác vụ nào được gửi.")
      };
      render(runtime, "[data-hvr-action='retry-confirmation']");
    } finally {
      runtime.busy.delete("quote");
    }
  }

  function retryPendingConfirmation(runtime) {
    if (runtime.pendingConfirmation?.action === "analysis") {
      runtime.pendingConfirmation = null;
      analyzeProject(runtime);
      return;
    }
    if (runtime.pendingConfirmation?.action === "retry") {
      const job = runtime.state.queue.find((item) => item.id === runtime.pendingConfirmation.retryJobId);
      runtime.pendingConfirmation = null;
      if (job) prepareRetryConfirmation(runtime, job);
      return;
    }
    const sceneIds = runtime.pendingConfirmation?.sceneIds || [];
    const scenes = sceneIds.map((id) => runtime.state.scenes.find((scene) => scene.id === id)).filter(Boolean);
    runtime.pendingConfirmation = null;
    if (scenes.length) prepareDispatchConfirmation(runtime, scenes);
  }

  async function confirmDispatch(runtime) {
    const pending = runtime.pendingConfirmation;
    const allowed = canConfirmCost(pending, runtime.state.capabilities.billing, {
      estimateAccepted: runtime.root.querySelector("[data-hvr-cost-accept]")?.checked === true,
      unknownCostAccepted: runtime.root.querySelector("[data-hvr-unknown-cost-accept]")?.checked === true
    });
    if (!allowed) return setNotice(runtime, "Cần xác nhận chi phí hợp lệ bằng tài khoản được cấp quyền billing trước khi render.", "warning");
    const expired = pending.entries.some((entry) => entry.quoteExpiresAt && Date.parse(entry.quoteExpiresAt) <= Date.now());
    if (expired) {
      runtime.pendingConfirmation = { ...pending, state: "error", error: "Báo giá đã hết hạn. Hãy lấy báo giá mới trước khi render." };
      return render(runtime, "[data-hvr-action='retry-confirmation']");
    }
    if (pending.action === "analysis") {
      const entry = pending.entries[0];
      if (!entry?.request || !entry.quoteId || !entry.idempotencyKey) return;
      const submission = sanitizePublicValue({
        request: entry.request,
        quoteId: entry.quoteId,
        quoteExpiresAt: entry.quoteExpiresAt,
        idempotencyKey: entry.idempotencyKey
      });
      runtime.pendingConfirmation = null;
      render(runtime);
      return submitAnalysis(runtime, submission);
    }
    if (pending.action === "retry") {
      const item = runtime.state.queue.find((job) => job.id === pending.retryJobId);
      const entry = pending.entries[0];
      if (!item?.backendId || !entry?.quoteId) return;
      runtime.pendingConfirmation = null;
      render(runtime);
      runtime.busy.add(item.id);
      try {
        const response = await runtime.client.retry(item.backendId, {
          quoteId: entry.quoteId,
          acceptedQuoteId: entry.quoteId,
          acceptedEstimate: true,
          costAccepted: true,
          confirmPossibleDuplicate: item.status === "submission-unknown"
        });
        const remote = extractPublicJob(response);
        updateJob(runtime, item.id, (job) => syncQueueItem({ ...job, quoteId: entry.quoteId, quoteExpiresAt: entry.quoteExpiresAt, acceptedEstimate: true, attempts: job.attempts + 1 }, { ...remote, status: remote.status || "submitted" }));
        schedulePoll(runtime, POLL_INTERVAL_MS);
      } catch (error) {
        setNotice(runtime, safeBackendError(error, "Không thể retry tác vụ."), "error");
      } finally {
        runtime.busy.delete(item.id);
      }
      return;
    }
    const jobs = pending.entries.map((entry) => normalizeQueueItem({
      ...makeLocalJob(runtime, entry.scene),
      request: entry.request,
      quoteId: entry.quoteId,
      quoteExpiresAt: entry.quoteExpiresAt,
      acceptedEstimate: true,
      costEstimateUsd: entry.estimate.currency === "USD" ? entry.estimate.amount : null
    }));
    runtime.pendingConfirmation = null;
    commit(runtime, (state) => ({ ...state, queue: [...state.queue, ...jobs] }));
    // Dispatch sequentially to avoid accidental cost/rate bursts. Each server quote
    // is single-use and each create call has its own idempotency key.
    for (const job of jobs) {
      if (runtime !== instance) return;
      await submitJob(runtime, job.id);
    }
  }

  async function submitJob(runtime, localId) {
    if (runtime !== instance || runtime.busy.has(localId)) return;
    const local = runtime.state.queue.find((item) => item.id === localId);
    if (!local || local.status !== "queued") return;
    runtime.busy.add(localId);
    updateJob(runtime, localId, (job) => transitionQueueItem(job, "submit"));
    try {
      if (!local.quoteId || !local.acceptedEstimate || !local.request) throw new Error("Thiếu yêu cầu gốc, Quote ID hoặc xác nhận chi phí; tác vụ chưa được gửi.");
      const payload = await runtime.client.createJob({
        ...local.request,
        quoteId: local.quoteId,
        acceptedQuoteId: local.quoteId,
        acceptedEstimate: true,
        costAccepted: true,
        idempotencyKey: local.idempotencyKey || local.id
      });
      const remote = extractPublicJob(payload);
      const backendId = remote.id || remote.jobId;
      if (!backendId) throw new Error("Backend không trả về mã tác vụ; render chưa được xác nhận.");
      updateJob(runtime, localId, (job) => syncQueueItem({ ...job, backendId }, { ...remote, status: remote.status || "running" }));
      setNotice(runtime, `${local.title} đã được backend nhận.`, "success");
      schedulePoll(runtime, POLL_INTERVAL_MS);
    } catch (error) {
      const ambiguous = error?.name === "AbortError" || !Number(error?.status || error?.statusCode);
      updateJob(runtime, localId, (job) => ambiguous
        ? normalizeQueueItem({ ...job, status: "submission-unknown", error: safeBackendError(error), updatedAt: nowIso() })
        : transitionQueueItem(job, "fail", { error: safeBackendError(error) }));
      setNotice(runtime, safeBackendError(error), "error");
    } finally {
      runtime.busy.delete(localId);
    }
  }

  async function handleJobAction(runtime, localId, action) {
    if (runtime !== instance || runtime.busy.has(localId)) return;
    const item = runtime.state.queue.find((job) => job.id === localId);
    if (!item) return;
    if (action === "retry" && item.status === "submission-unknown" && !item.backendId) return reconcileUnknownSubmission(runtime, item);
    if (action === "retry" && !item.backendId) {
      const scene = runtime.state.scenes.find((entry) => entry.id === item.sceneId);
      return scene ? prepareDispatchConfirmation(runtime, [scene]) : setNotice(runtime, "Không còn cảnh gốc để tạo báo giá mới.", "warning");
    }
    if (action === "retry") return prepareRetryConfirmation(runtime, item);
    if (!item.backendId) return setNotice(runtime, "Tác vụ chưa có ID backend nên không thể điều khiển từ xa.", "error");
    if (!canTransition(item.status, action)) return setNotice(runtime, `Không thể ${action} tác vụ ở trạng thái ${item.status}.`, "warning");
    runtime.busy.add(localId);
    try {
      const response = await runtime.client[action](item.backendId);
      const remote = extractPublicJob(response);
      const expected = action === "pause" ? "pause-requested" : action === "resume" ? "submitted" : "cancel-requested";
      updateJob(runtime, localId, (job) => syncQueueItem(job, { ...remote, status: remote.status || expected }));
      if (["resume", "retry"].includes(action)) schedulePoll(runtime, POLL_INTERVAL_MS);
    } catch (error) {
      setNotice(runtime, safeBackendError(error), "error");
    } finally {
      runtime.busy.delete(localId);
    }
  }

  async function reconcileUnknownSubmission(runtime, item) {
    if (runtime !== instance || runtime.busy.has(item.id) || !item.request || !item.quoteId) return;
    runtime.busy.add(item.id);
    setNotice(runtime, "Đang gửi lại cùng idempotency key để hỏi backend; thao tác này không cố ý tạo job trùng.", "info");
    try {
      const response = await runtime.client.createJob({
        ...item.request,
        quoteId: item.quoteId,
        acceptedQuoteId: item.quoteId,
        acceptedEstimate: true,
        costAccepted: true,
        idempotencyKey: item.idempotencyKey || item.id
      });
      const remote = extractPublicJob(response);
      if (!remote.id) throw Object.assign(new Error("Backend chưa trả về mã tác vụ khi đối soát."), { status: 502 });
      updateJob(runtime, item.id, (job) => syncQueueItem({ ...job, backendId: remote.id, error: "" }, remote));
      setNotice(runtime, response.idempotentReplay === true ? "Đã tìm thấy đúng tác vụ cũ; không tạo bản render trùng." : "Backend đã nhận tác vụ với idempotency key hiện tại.", "success");
      schedulePoll(runtime, POLL_INTERVAL_MS);
    } catch (error) {
      const stillAmbiguous = error?.name === "AbortError" || !Number(error?.status || error?.statusCode);
      updateJob(runtime, item.id, (job) => normalizeQueueItem({
        ...job,
        status: stillAmbiguous ? "submission-unknown" : "failed",
        error: safeBackendError(error),
        updatedAt: nowIso()
      }));
      setNotice(runtime, safeBackendError(error), stillAmbiguous ? "warning" : "error");
    } finally {
      runtime.busy.delete(item.id);
    }
  }

  async function prepareRetryConfirmation(runtime, item) {
    if (!item.backendId) return setNotice(runtime, "Tác vụ chưa từng được backend nhận; hãy tạo báo giá mới từ cảnh tương ứng.", "warning");
    if (!item.request) return setNotice(runtime, "Không còn bản yêu cầu gốc để báo giá lại an toàn. Hãy tạo tác vụ mới từ cảnh.", "warning");
    runtime.pendingConfirmation = { state: "loading", sceneCount: 1, sceneIds: [item.sceneId], retryJobId: item.id, action: "retry" };
    render(runtime, "[data-hvr-action='cancel-confirmation']");
    try {
      const response = await runtime.client.estimate(item.request);
      const estimate = response.estimate || {};
      const quote = response.quote || {};
      if (response.supported === false) throw new Error(response.reason || response.message || "Backend không còn hỗ trợ cấu hình của tác vụ này.");
      if (!quote.id) throw new Error(estimate.disclaimer || "Backend chưa cấp báo giá retry hợp lệ.");
      runtime.pendingConfirmation = {
        state: "ready", action: "retry", retryJobId: item.id, sceneCount: 1, sceneIds: [item.sceneId],
        totalVariants: Number(item.request.variants) || 1,
        totalAmount: estimate.amount == null ? 0 : Math.max(0, Number(estimate.amount) || 0),
        pricingUnknown: estimate.pricingConfigured === false || estimate.amount == null,
        currency: asText(estimate.currency || "USD", 12),
        adapter: asText(response.adapter, 100), model: asText(response.model, 160),
        expiresAt: asText(quote.expiresAt, 40) || null,
        entries: [{
          scene: runtime.state.scenes.find((scene) => scene.id === item.sceneId) || normalizeScene({ id: item.sceneId, title: item.title }),
          request: item.request,
          quoteId: safeId(quote.id, ""), quoteExpiresAt: asText(quote.expiresAt, 40), adapter: asText(response.adapter, 100), model: asText(response.model, 160),
          estimate: { currency: asText(estimate.currency || "USD", 12), amount: estimate.amount == null ? null : Math.max(0, Number(estimate.amount) || 0), quantity: Math.max(0, Number(estimate.quantity) || 0), billingUnit: asText(estimate.billingUnit, 60), disclaimer: asText(estimate.disclaimer, 500), pricingVersion: asText(estimate.pricingVersion, 80), pricingConfigured: estimate.pricingConfigured !== false && estimate.amount != null }
        }]
      };
      render(runtime, "[data-hvr-cost-accept]");
    } catch (error) {
      runtime.pendingConfirmation = { state: "error", action: "retry", retryJobId: item.id, sceneCount: 1, sceneIds: [item.sceneId], error: safeBackendError(error, "Không thể lấy báo giá retry.") };
      render(runtime, "[data-hvr-action='retry-confirmation']");
    }
  }

  function updateJob(runtime, id, updater, queueOnly = false) {
    commit(runtime, (state) => ({ ...state, queue: state.queue.map((job) => job.id === id ? normalizeQueueItem(updater(job)) : job) }), { render: !queueOnly });
    if (queueOnly) patchQueueDom(runtime);
  }

  function patchQueueDom(runtime) {
    if (runtime !== instance || !runtime.root) return;
    const queueItems = runtime.root.querySelector(".hvr-queue-items");
    if (queueItems) queueItems.innerHTML = runtime.state.queue.length
      ? runtime.state.queue.slice(-8).map(renderQueueItem).join("")
      : '<span class="hvr-queue-empty">Chưa có tác vụ. Render chỉ bắt đầu sau khi backend xác nhận.</span>';
    const summary = runtime.root.querySelector(".hvr-queue-summary small");
    if (summary) summary.textContent = queueSummary(runtime.state.queue);
    const topMetrics = runtime.root.querySelectorAll(".hvr-top-metrics > span");
    const queueMetric = topMetrics[topMetrics.length - 1];
    if (queueMetric) queueMetric.textContent = `${runtime.state.queue.filter((job) => ["queued", "submitting", "submitted", "dispatching", "running", "pause-requested", "paused"].includes(job.status)).length} đang chờ/chạy`;
  }

  function schedulePoll(runtime, delay = POLL_INTERVAL_MS) {
    if (runtime !== instance) return;
    if (runtime.pollTimer) clearTimeout(runtime.pollTimer);
    const safeDelay = Math.max(POLL_INTERVAL_MS, Number(delay) || POLL_INTERVAL_MS);
    runtime.pollTimer = setTimeout(() => pollJobs(runtime), safeDelay);
  }

  async function pollJobs(runtime) {
    if (runtime !== instance || global.document?.hidden) return schedulePoll(runtime, POLL_INTERVAL_MS * 2);
    const jobs = runtime.state.queue.filter((job) => job.backendId && ["submitting", "submitted", "dispatching", "running", "pause-requested", "cancel-requested", "submission-unknown", "queued"].includes(job.status));
    if (!jobs.length) return schedulePoll(runtime, POLL_INTERVAL_MS * 2);
    const job = jobs[runtime.pollIndex % jobs.length];
    runtime.pollIndex = (runtime.pollIndex + 1) % Math.max(1, jobs.length);
    let update;
    try {
      const response = await runtime.client.status(job.backendId);
      update = { id: job.id, remote: extractPublicJob(response) };
      runtime.pollBackoffMs = POLL_INTERVAL_MS;
    } catch (error) {
      update = { id: job.id, error };
      runtime.pollBackoffMs = error.status === 429
        ? Math.min(120_000, Math.max(30_000, runtime.pollBackoffMs * 2))
        : Math.min(60_000, Math.max(POLL_INTERVAL_MS, runtime.pollBackoffMs * 1.5));
    }
    if (runtime !== instance) return;
    if (!update.error) updateJob(runtime, update.id, (item) => syncQueueItem(item, update.remote), true);
    if (update.error && [401, 403, 429].includes(update.error.status)) {
      setNotice(runtime, safeBackendError(update.error), update.error.status === 429 ? "warning" : "error", false);
      patchNoticeDom(runtime);
    }
    schedulePoll(runtime, runtime.pollBackoffMs);
  }

  function patchNoticeDom(runtime) {
    if (runtime !== instance || !runtime.root) return;
    const toast = runtime.root.querySelector(".hvr-toast");
    if (!toast) return;
    toast.className = `hvr-toast hvr-toast--${runtime.notice.tone} ${runtime.notice.text ? "is-visible" : ""}`;
    toast.textContent = runtime.notice.text;
  }

  function scheduleEstimate(runtime) {
    if (runtime.estimateTimer) clearTimeout(runtime.estimateTimer);
    runtime.backendEstimate = null;
    runtime.estimateTimer = setTimeout(() => requestEstimate(runtime, false), 650);
  }

  async function requestEstimate(runtime, showErrors = true) {
    if (runtime !== instance || runtime.busy.has("estimate")) return;
    const scene = runtime.state.scenes.find((item) => item.id === runtime.state.selectedSceneId) || normalizeScene({ prompt: runtime.state.prompt, duration: runtime.state.settings.durationSeconds });
    runtime.busy.add("estimate");
    try {
      const response = await runtime.client.estimate(buildJobPayload(runtime.state, scene));
      const result = response.estimate || response.data || response;
      if (response.supported === false) throw new Error(response.reason || response.message || "Backend không hỗ trợ cấu hình này.");
      const pricingKnown = result.pricingConfigured !== false && result.amount != null;
      const amount = pricingKnown ? Math.max(0, Number(result.amount) || 0) : null;
      runtime.backendEstimate = {
        available: pricingKnown,
        amountUsd: result.currency === "USD" ? amount : null,
        label: pricingKnown ? `≈ ${asText(result.currency || "USD", 12)} ${amount.toFixed(2)}` : "Giá backend chưa cấu hình",
        basis: "backend",
        seconds: Number(result.quantity) || 0,
        quoteId: safeId(response.quote?.id, ""),
        quoteExpiresAt: asText(response.quote?.expiresAt, 40) || null
      };
      render(runtime);
    } catch (error) {
      runtime.backendEstimate = null;
      if (showErrors) setNotice(runtime, safeBackendError(error, "Backend chưa cung cấp báo giá; đang hiển thị ước tính cục bộ."), "warning");
      else render(runtime);
    } finally {
      runtime.busy.delete("estimate");
    }
  }

  function remountForIdentity(runtime, eventUser) {
    if (runtime !== instance) return;
    const freshOptions = {
      ...runtime.options,
      currentUser: eventUser && typeof eventUser === "object" ? eventUser : undefined,
      ownerId: undefined,
      learnerProfileId: undefined,
      learnerProfile: undefined
    };
    const nextScope = resolveIdentity(freshOptions);
    if (nextScope.ownerId === runtime.scope.ownerId && nextScope.learnerProfileId === runtime.scope.learnerProfileId) return;
    const host = runtime.host;
    mount(host, freshOptions);
  }

  const api = Object.freeze({
    VERSION,
    STORAGE_PREFIX,
    DEFAULT_API_BASE,
    MAX_SAFE_BATCH,
    POLL_INTERVAL_MS,
    MODES,
    MODEL_CATALOG,
    DURATIONS,
    ASPECT_RATIOS,
    RESOLUTIONS,
    QUEUE_STATUSES,
    ownerScope,
    scopedStorageKey,
    normalizeAsset,
    normalizeScene,
    normalizeQueueItem,
    normalizeState,
    normalizeModelCapability,
    deriveCapabilityModels,
    backendModelSelection,
    splitScenes,
    mapPlanScenes,
    canTransition,
    transitionQueueItem,
    extractPublicJob,
    requestFromPublicJob,
    syncQueueItem,
    estimateCost,
    validateJob,
    sanitizePublicValue,
    buildJobPayload,
    buildAnalysisPayload,
    canConfirmCost,
    safeBackendError,
    createBackendClient,
    readVideoMetadata,
    readImageMetadata,
    mount,
    unmount
  });

  return api;
});
