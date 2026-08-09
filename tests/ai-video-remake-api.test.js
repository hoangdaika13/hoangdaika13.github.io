const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const core = require(path.join(root, "services", "ai-video-remake", "core.js"));
const handler = require(path.join(root, "services", "ai-video-remake", "index.js"));
const source = fs.readFileSync(path.join(root, "services", "ai-video-remake", "index.js"), "utf8");

const ASSET = "64b64b64b64b64b64b64b641";
const CHARACTER = "64b64b64b64b64b64b64b642";
const PROJECT = "64b64b64b64b64b64b64b643";

function remix(overrides = {}) {
  return {
    mode: "video-remix",
    prompt: "Giữ chuyển động và đổi bối cảnh thành một thành phố tương lai.",
    mediaProjectId: PROJECT,
    sourceAssetId: ASSET,
    rightsAttested: true,
    sourceStartSeconds: 12.5,
    sourceEndSeconds: 20.5,
    ...overrides
  };
}

test("render input requires owned-project rights and character consent", () => {
  assert.throws(
    () => core.normalizeRenderRequest({ ...remix(), rightsAttested: false }),
    (error) => error.code === "RIGHTS_ATTESTATION_REQUIRED"
  );
  assert.throws(
    () => core.normalizeRenderRequest({ ...remix(), mediaProjectId: "" }),
    (error) => error.code === "PROJECT_REQUIRED"
  );
  assert.throws(
    () => core.normalizeRenderRequest({ ...remix(), mode: "character-replace", characterAssetIds: [CHARACTER] }),
    (error) => error.code === "CHARACTER_CONSENT_REQUIRED"
  );
  const accepted = core.normalizeRenderRequest({
    ...remix(),
    mode: "character-replace",
    characterAssetIds: [CHARACTER],
    characterConsentAttested: true
  });
  assert.equal(accepted.rightsAttested, true);
  assert.equal(accepted.characterConsentAttested, true);
  assert.equal(accepted.mediaProjectId, PROJECT);
});

test("analysis input has its own rights-safe quote fingerprint", () => {
  const request = core.normalizeAnalysisRequest({
    mode: "character-replace",
    visualAnalysis: true,
    brief: "Phân tích chuyển động và lập storyboard thay nhân vật.",
    mediaProjectId: PROJECT,
    sourceAssetId: ASSET,
    characterAssetIds: [CHARACTER],
    rightsAttested: true,
    characterConsentAttested: true,
    targetDurationSeconds: 48
  });
  assert.equal(request.kind, "analysis");
  assert.equal(request.visualAnalysis, true);
  assert.deepEqual(core.analysisAssetIdsOf(request), [ASSET, CHARACTER]);
  assert.equal(request.targetDurationSeconds, 48);
  assert.match(core.requestFingerprint(request), /^[a-f0-9]{64}$/);
  assert.throws(
    () => core.normalizeAnalysisRequest({ ...request, rightsAttested: false }),
    (error) => error.code === "RIGHTS_ATTESTATION_REQUIRED"
  );
});

test("source scene range is preserved and bounded to ten seconds", () => {
  const request = core.normalizeRenderRequest(remix());
  assert.deepEqual(request.sourceRange, { startSeconds: 12.5, endSeconds: 20.5 });
  assert.throws(
    () => core.normalizeRenderRequest(remix({ sourceEndSeconds: 23 })),
    (error) => error.code === "SOURCE_RANGE_INVALID"
  );
  assert.throws(
    () => core.normalizeRenderRequest(remix({ sourceStartSeconds: 5, sourceEndSeconds: 5 })),
    (error) => error.code === "SOURCE_RANGE_INVALID"
  );
  const replay = core.normalizeRenderRequest({ ...request });
  assert.deepEqual(replay.sourceRange, request.sourceRange);
});

test("direct Veo exposes only declared server capabilities", () => {
  const capabilities = core.capabilitySnapshot({
    GEMINI_API_KEY: "g".repeat(32),
    GEMINI_VIDEO_MODEL: "veo-server-model",
    AI_VIDEO_DIRECTOR_MODEL: "gemini-server-model"
  });
  assert.equal(capabilities.providers.veo.configured, true);
  assert.deepEqual(capabilities.limits.directVeoAspectRatios, ["16:9", "9:16"]);
  assert.deepEqual(capabilities.limits.directVeoResolutions, ["720p"]);
  const supported = core.normalizeRenderRequest({ mode: "text-to-video", prompt: "Một con tàu bay", durationSeconds: 8 });
  assert.equal(core.selectAdapter(capabilities, supported), "veo");
  assert.throws(
    () => core.selectAdapter(capabilities, core.normalizeRenderRequest({ ...supported, aspectRatio: "1:1" })),
    (error) => error.code === "VEO_PARAMETERS_UNSUPPORTED"
  );
  assert.throws(
    () => core.selectAdapter(capabilities, core.normalizeRenderRequest({ ...supported, resolution: "1080p" })),
    (error) => error.code === "VEO_PARAMETERS_UNSUPPORTED"
  );
});

test("source-video modes require an explicitly declared worker mode and provider", () => {
  const baseEnv = {
    MEDIA_AI_WORKER_URL: "https://worker.example.com",
    MEDIA_AI_WORKER_TOKEN: "w".repeat(32),
    MEDIA_AI_WORKER_MODES: "video-remix,character-replace,analyze",
    MEDIA_AI_WORKER_PROVIDERS: "wan2.2",
    MEDIA_AI_WORKER_MODELS: "wan-animate-v2",
    MEDIA_AI_WORKER_DEFAULT_MODEL: "wan-animate-v2"
  };
  const capabilities = core.capabilitySnapshot(baseEnv);
  const wan = core.normalizeRenderRequest(remix({ provider: "wan2.2" }));
  assert.equal(core.selectAdapter(capabilities, wan), "media-ai-worker");
  const omni = core.normalizeRenderRequest(remix({ provider: "gemini-omni" }));
  assert.throws(
    () => core.selectAdapter(capabilities, omni),
    (error) => error.code === "WORKER_PROVIDER_NOT_CONFIGURED"
  );
  assert.throws(
    () => core.selectAdapter(capabilities, core.normalizeRenderRequest(remix({ provider: "wan2.2", aspectRatio: "1:1" }))),
    (error) => error.code === "WORKER_PARAMETERS_UNSUPPORTED"
  );
  const squareCapabilities = core.capabilitySnapshot({
    ...baseEnv,
    MEDIA_AI_WORKER_ASPECT_RATIOS: "16:9,9:16,1:1",
    MEDIA_AI_WORKER_MAX_VARIANTS: "3"
  });
  assert.equal(core.selectAdapter(
    squareCapabilities,
    core.normalizeRenderRequest(remix({ provider: "wan2.2", aspectRatio: "1:1", variants: 3 }))
  ), "media-ai-worker");
});

test("frontend model IDs map to server-owned provider intents without becoming model names", () => {
  const veo = core.normalizeRenderRequest({ mode: "text-to-video", prompt: "Galaxy", modelId: "server-veo" });
  assert.equal(veo.requestedProvider, "veo");
  assert.equal(veo.requestedModel, "");
  const worker = core.normalizeRenderRequest(remix({ modelId: "server-worker" }));
  assert.equal(worker.requestedProvider, "worker");
  assert.equal(worker.requestedModel, "");
  const wan = core.normalizeRenderRequest(remix({ modelId: "server-local-wan", provider: "auto" }));
  assert.equal(wan.requestedProvider, "wan2.2");
  assert.equal(wan.requestedModel, "");
  assert.throws(
    () => core.normalizeRenderRequest({ mode: "text-to-video", prompt: "Plan", modelId: "server-director" }),
    (error) => error.code === "DIRECTOR_MODEL_NOT_RENDERABLE"
  );
});

test("worker model selection accepts only backend allowlisted model IDs", () => {
  const capabilities = handler.__test.publicCapabilities({ _id: "u1" }, {
    MEDIA_AI_WORKER_URL: "https://worker.example.com",
    MEDIA_AI_WORKER_TOKEN: "w".repeat(32),
    MEDIA_AI_WORKER_MODES: "video-remix",
    MEDIA_AI_WORKER_PROVIDERS: "wan2.2",
    MEDIA_AI_WORKER_MODELS: "wan-animate-v2,wan-fast",
    MEDIA_AI_WORKER_DEFAULT_MODEL: "wan-animate-v2"
  });
  const defaultRequest = core.normalizeRenderRequest(remix({ provider: "wan2.2" }));
  assert.equal(handler.__test.resolveProviderModel(defaultRequest, "media-ai-worker", capabilities, {
    MEDIA_AI_WORKER_MODELS: "wan-animate-v2,wan-fast",
    MEDIA_AI_WORKER_DEFAULT_MODEL: "wan-animate-v2"
  }), "wan-animate-v2");
  const denied = core.normalizeRenderRequest(remix({ provider: "wan2.2", model: "client-invented-model" }));
  assert.throws(
    () => handler.__test.resolveProviderModel(denied, "media-ai-worker", capabilities, {
      MEDIA_AI_WORKER_MODELS: "wan-animate-v2,wan-fast"
    }),
    (error) => error.code === "WORKER_MODEL_NOT_ALLOWED"
  );
  const ambiguousCapabilities = core.capabilitySnapshot({
    MEDIA_AI_WORKER_URL: "https://worker.example.com",
    MEDIA_AI_WORKER_TOKEN: "w".repeat(32),
    MEDIA_AI_WORKER_MODES: "video-remix",
    MEDIA_AI_WORKER_PROVIDERS: "wan2.2",
    MEDIA_AI_WORKER_MODELS: "wan-one,wan-two"
  });
  assert.equal(ambiguousCapabilities.providers.worker.capabilityDeclarationRequired, true);
  assert.equal(ambiguousCapabilities.modes["video-remix"].supported, false);
});

test("cost estimate remains unknown until the server has a configured rate", () => {
  const request = core.normalizeRenderRequest({ mode: "text-to-video", prompt: "Galaxy", durationSeconds: 8 });
  const unknown = core.estimateRequest(request, { adapter: "veo", model: "veo-standard", env: {} });
  assert.equal(unknown.amount, null);
  assert.equal(unknown.pricingConfigured, false);
  const blank = core.estimateRequest(request, {
    adapter: "veo",
    model: "veo-fast",
    env: { VEO_FAST_USD_PER_SECOND: "" }
  });
  assert.equal(blank.amount, null);
  assert.equal(blank.pricingConfigured, false);
  const configured = core.estimateRequest(request, {
    adapter: "veo",
    model: "veo-fast",
    env: { VEO_FAST_USD_PER_SECOND: "0.1", AI_VIDEO_PRICING_VERSION: "2026-08" }
  });
  assert.equal(configured.amount, 0.8);
  assert.equal(configured.pricingConfigured, true);
});

test("public job never exposes provider IDs, keys, owner IDs or raw output URLs", () => {
  const job = core.publicJob({
    _id: "job-1",
    userId: "owner-private",
    status: "running",
    progress: undefined,
    providerOperationName: "operations/private",
    providerJobId: "worker-private",
    providerKeyFingerprint: "fingerprint-private",
    providerOutputUri: "https://private.example/video.mp4",
    checkpoint: { stage: "scene-1", ownerId: "owner-private", signedGetUrl: "https://private.example/input" },
    rightsManifest: { rightsAttested: true, rightsAttestedAt: new Date("2026-08-09T00:00:00Z") },
    input: { prompt: "Safe", tokenHash: "secret", authorizationHeader: "Bearer secret" }
  });
  assert.equal(job.progress, null);
  assert.equal(job.input.prompt, "Safe");
  assert.equal(job.input.tokenHash, undefined);
  assert.equal(job.input.authorizationHeader, undefined);
  assert.equal(job.providerOperationName, undefined);
  assert.equal(job.providerJobId, undefined);
  assert.equal(job.providerOutputUri, undefined);
  assert.equal(job.checkpoint.ownerId, undefined);
  assert.equal(job.checkpoint.signedGetUrl, undefined);
  assert.equal(job.rights.rightsAttested, true);
});

test("secret sanitizer rejects secret substrings and prototype keys recursively", () => {
  const payload = JSON.parse('{"ok":true,"tokenHash":"x","cookieJar":"y","authorizationHeader":"z","nested":{"privateKey":"p","safe":"yes"},"__proto__":"bad","constructor":"bad"}');
  assert.deepEqual(core.safeObject(payload), { ok: true, nested: { safe: "yes" } });
});

test("provider diagnostics redact URLs and credential-shaped values", () => {
  const message = core.redactMessage("Provider https://worker.example/out?token=secret failed apiKey=abc123");
  assert.doesNotMatch(message, /worker\.example|abc123|secret/);
  assert.match(message, /redacted/);
});

test("provider controls stay requested until acknowledgement and retry keeps checkpoint", () => {
  const now = new Date("2026-08-09T00:00:00Z");
  const running = { status: "running", stage: "scene-2", progress: 38, checkpoint: { stage: "scene-2" }, attempt: 1 };
  const pause = core.transitionJob(running, "pause", now, { awaitingProviderAck: true });
  assert.equal(pause.status, "pause-requested");
  assert.equal(pause.progress, 38);
  assert.equal(pause.checkpoint.resumeStatus, "running");
  const cancel = core.transitionJob(running, "cancel", now, { awaitingProviderAck: true });
  assert.equal(cancel.status, "cancel-requested");
  const retry = core.transitionJob({ ...running, status: "submission-unknown", providerOperationName: "unknown" }, "retry", now);
  assert.equal(retry.status, "queued");
  assert.equal(retry.attempt, 2);
  assert.equal(retry.checkpoint.retryFrom, "scene-2");
  assert.equal(retry.providerOperationName, null);
  assert.equal(retry.providerKeyFingerprint, null);
});

test("canceled and cancelled provider spellings normalize to one API state", () => {
  assert.equal(core.canonicalStatus("cancelled"), "canceled");
  assert.equal(handler.__test.workerStatus("cancelled", "running"), "canceled");
  assert.equal(core.publicJob({ id: "j1", status: "cancelled" }).status, "canceled");
  const retried = core.transitionJob({ status: "cancelled", checkpoint: { stage: "worker" }, attempt: 1 }, "retry");
  assert.equal(retried.status, "queued");
  assert.equal(retried.attempt, 2);
});

test("director output basis is server-owned and unverified asset IDs are removed", () => {
  const plan = core.constrainDirectorPlan({
    summary: "Plan https://worker.example/signed?token=secret",
    analysisBasis: "I watched everything",
    scenes: [{ id: "s1", title: "One", durationSeconds: 8, requiredAssetIds: [ASSET, "foreign"] }]
  }, [ASSET], "brief-and-owned-asset-metadata");
  assert.equal(plan.analysisBasis, "brief-and-owned-asset-metadata");
  assert.deepEqual(plan.scenes[0].requiredAssetIds, [ASSET]);
  assert.doesNotMatch(plan.summary, /worker\.example|secret/);
});

test("request fingerprints are deterministic and include scene range", () => {
  const first = core.normalizeRenderRequest(remix());
  const same = core.normalizeRenderRequest({ ...first });
  const changed = core.normalizeRenderRequest(remix({ sourceStartSeconds: 0, sourceEndSeconds: 8 }));
  assert.equal(core.requestFingerprint(first), core.requestFingerprint(same));
  assert.notEqual(core.requestFingerprint(first), core.requestFingerprint(changed));
});

test("paid access is owner/allowlist based rather than broad admin roles", () => {
  const supportUser = { _id: "support-user", role: "support", email: "support@example.com" };
  assert.equal(handler.__test.billingState(supportUser, {}).canCreate, false);
  assert.equal(handler.__test.billingState(supportUser, { AI_VIDEO_BILLING_USER_IDS: "support-user" }).canCreate, true);
  assert.equal(handler.__test.billingState(supportUser, { AI_VIDEO_ALLOW_USERS: "1" }).canCreate, true);
});

test("single route contract enforces owner isolation, quotes, CAS and private signed inputs", () => {
  for (const action of ["capabilities", "estimate", "estimate-analysis", "analyze", "create-job", "status", "pause", "resume", "retry", "cancel", "download"]) {
    assert.match(source, new RegExp(`\\b${action.replace("-", "-")}\\b`));
  }
  assert.match(source, /currentUser\(req\)/);
  assert.match(source, /isOwnerUser\(user\)/);
  assert.doesNotMatch(source, /isAdminUser/);
  assert.match(source, /db\.collection\("mediaAssets"\)\.find\([\s\S]*?ownerId:\s*user\._id[\s\S]*?projectId:\s*project\._id[\s\S]*?status:\s*"ready"[\s\S]*?deletedAt:\s*null/);
  assert.match(source, /issueSignedToken[\s\S]*?presignUrl[\s\S]*?signedGetExpiresAt/);
  assert.match(source, /QUOTE_INVALID_OR_EXPIRED/);
  assert.match(source, /acceptedEstimate[\s\S]*?costAccepted/);
  assert.match(source, /requiresExplicitAcceptance:\s*true/);
  assert.match(source, /quote:\s*\{\s*\.\.\.quote,\s*pricingConfigured:/);
  assert.match(source, /requestFingerprint/);
  assert.match(source, /version:\s*Number\(job\.version\)[\s\S]*?JOB_VERSION_CONFLICT/);
  assert.match(source, /pause-requested|cancel-requested/);
  assert.match(source, /submission-unknown/);
  assert.match(source, /providerMayContinue/);
  assert.match(source, /sourceRange:\s*request\.sourceRange/);
  assert.match(source, /consumeQuote\(db, user, body, request, hash, "analysis"\)/);
  assert.match(source, /aiVideoRemakeAnalyses/);
  assert.match(source, /ai_video_analysis_owner_idempotency/);
  assert.match(source, /redirect:\s*"error"/);
  assert.match(source, /VIDEO_PROXY_SIZE_UNKNOWN/);
});

test("paid Veo submission selects one key and never rotates on create", () => {
  const start = source.slice(source.indexOf("async function startVeo"), source.indexOf("async function pollVeo"));
  assert.match(start, /selectedVeoKey/);
  assert.doesNotMatch(start, /for\s*\(const key|canTryAnotherKey|withGeminiKey/);
  assert.match(start, /VEO_SUBMISSION_UNKNOWN/);
  assert.match(source, /providerKeyFingerprint/);
});

test("paid Gemini analysis also uses one configured key per accepted quote", () => {
  const director = source.slice(source.indexOf("async function geminiDirectorPlan"), source.indexOf("function allowedGoogleOutput"));
  assert.match(director, /const key = keys\[0\]/);
  assert.doesNotMatch(director, /for\s*\(const key|canTryAnotherKey|keys\.slice/);
  assert.match(source, /estimate-analysis/);
  assert.match(source, /requiresExplicitAcceptance:\s*true/);
});

test("output allowlists reject open proxies", () => {
  assert.equal(handler.__test.allowedGoogleOutput("https://generativelanguage.googleapis.com/files/video"), true);
  assert.equal(handler.__test.allowedGoogleOutput("https://evil.example/video.mp4"), false);
  const env = { MEDIA_AI_WORKER_URL: "https://worker.example.com", MEDIA_AI_WORKER_TOKEN: "x".repeat(32) };
  assert.equal(handler.__test.allowedWorkerOutput("https://worker.example.com/output.mp4", env), true);
  assert.equal(handler.__test.allowedWorkerOutput("https://evil.example/output.mp4", env), false);
});
