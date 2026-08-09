const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const studio = require(path.join(root, "ai-video-remake-studio.js"));
const source = fs.readFileSync(path.join(root, "ai-video-remake-studio.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "ai-video-remake-studio.css"), "utf8");

function renderState(overrides = {}) {
  return studio.normalizeState({
    mode: "character-replace",
    modelId: "server-local-wan",
    mediaProjectId: "project-1",
    sourceAsset: { id: "source", cloudAssetId: "asset-source", mediaProjectId: "project-1", cloudState: "ready" },
    characterAssets: [{ id: "character", cloudAssetId: "asset-character", mediaProjectId: "project-1", cloudState: "ready" }],
    scenes: [{ id: "scene-1", title: "Cảnh một", start: 2, end: 9, prompt: "Thay nhân vật nhưng giữ chuyển động." }],
    selectedSceneId: "scene-1",
    rightsAttested: true,
    characterConsentAttested: true,
    ...overrides
  });
}

test("frontend uses one account-scoped route and never stores credentials", () => {
  assert.equal(studio.DEFAULT_API_BASE, "/api/ai-video-remake");
  assert.equal(studio.scopedStorageKey({ ownerId: "owner", learnerProfileId: "learner" }), "hh.ai-video-remake.v1:owner:learner");
  const clean = studio.sanitizePublicValue(JSON.parse('{"prompt":"ok","apiKey":"x","nested":{"authorization":"Bearer x","safe":1},"__proto__":"bad","constructor":"bad"}'));
  assert.deepEqual(clean, { prompt: "ok", nested: { safe: 1 } });
});

test("render payload matches media, provider, source-range and control contract", () => {
  const state = renderState();
  const payload = studio.buildJobPayload(state, state.scenes[0]);
  assert.equal(payload.mode, "character-replace");
  assert.equal(payload.provider, "wan2.2");
  assert.equal(payload.mediaProjectId, "project-1");
  assert.equal(payload.sourceAssetId, "asset-source");
  assert.deepEqual(payload.characterAssetIds, ["asset-character"]);
  assert.equal(payload.sourceStartSeconds, 2);
  assert.equal(payload.sourceEndSeconds, 9);
  assert.equal(payload.controls.characterSimilarity, 88);
  assert.equal(payload.controls.preserveDialogue, true);
  assert.equal(payload.rightsAttested, true);
  assert.equal(payload.characterConsentAttested, true);
});

test("AI Director plans render through a real video adapter, not a planning model", () => {
  const state = renderState({
    mode: "ai-director",
    modelId: "server-director",
    sourceAsset: null,
    characterAssets: [],
    mediaProjectId: "",
    rightsAttested: false,
    characterConsentAttested: false
  });
  const payload = studio.buildJobPayload(state, state.scenes[0]);
  assert.equal(payload.mode, "text-to-video");
  assert.equal(payload.provider, "auto");
});

test("analysis uses its own rights-safe quote payload", () => {
  const state = renderState();
  const payload = studio.buildAnalysisPayload(state);
  assert.equal(payload.mode, "character-replace");
  assert.equal(payload.visualAnalysis, true);
  assert.equal(payload.mediaProjectId, "project-1");
  assert.equal(payload.brief, "Thay nhân vật nhưng giữ chuyển động.");
  assert.deepEqual(payload.characterAssetIds, ["asset-character"]);
  assert.equal(payload.rightsAttested, true);
  assert.equal(payload.characterConsentAttested, true);
});

test("director plan mapping preserves explicit timing and sequences untimed scenes", () => {
  const scenes = studio.mapPlanScenes([
    { id: "one", durationSeconds: 4, promptVi: "Một" },
    { id: "two", durationSeconds: 6, promptEn: "Two" },
    { id: "three", startSeconds: 20, endSeconds: 24, prompt: "Three" }
  ], { durationSeconds: 8, analysisBasis: "worker-visual-analysis" });
  assert.deepEqual(scenes.map((scene) => [scene.start, scene.end]), [[0, 4], [4, 10], [20, 24]]);
  assert.deepEqual(scenes.map((scene) => scene.prompt), ["Một", "Two", "Three"]);
  assert.ok(scenes.every((scene) => scene.source === "backend"));
});

test("nested public jobs map backend canceled and private progress truthfully", () => {
  const nested = {
    data: {
      job: {
        id: "backend-job",
        status: "canceled",
        progress: null,
        stage: "provider-control",
        attempt: 2,
        input: { prompt: "safe", requestedProvider: "wan2.2", sourceRange: { startSeconds: 2, endSeconds: 9 } },
        checkpoint: { stage: "shot-2", retryFrom: "shot-1" },
        provider: { mayContinue: true, controlConfirmed: false },
        output: { ready: false }
      }
    }
  };
  assert.equal(studio.extractPublicJob(nested).id, "backend-job");
  const item = studio.syncQueueItem({ id: "local-job", status: "running", progress: null }, nested);
  assert.equal(item.backendId, "backend-job");
  assert.equal(item.status, "cancelled");
  assert.equal(item.progress, null);
  assert.equal(item.checkpointStage, "shot-2");
  assert.equal(item.retryStage, "shot-1");
  assert.equal(item.providerMayContinue, true);
  assert.equal(item.request.provider, "wan2.2");
  assert.equal(item.request.sourceStartSeconds, 2);
});

test("completed public job accepts only the same-origin download proxy", () => {
  const safe = studio.syncQueueItem({ id: "local", status: "running" }, {
    id: "backend",
    status: "completed",
    progress: 100,
    output: { ready: true, downloadUrl: "/api/ai-video-remake?action=download&id=backend" }
  });
  assert.equal(safe.outputUrl, "/api/ai-video-remake?action=download&id=backend");
  const unsafe = studio.syncQueueItem({ id: "local", status: "running" }, {
    id: "backend",
    status: "completed",
    output: { ready: true, downloadUrl: "javascript:alert(1)" }
  });
  assert.equal(unsafe.outputUrl, "");
});

test("unknown pricing requires a billing owner and a second explicit confirmation", () => {
  const known = { state: "ready", pricingUnknown: false };
  const unknown = { state: "ready", pricingUnknown: true };
  const owner = { canCreate: true, admin: true };
  const member = { canCreate: true, admin: false };
  assert.equal(studio.canConfirmCost(known, owner, { estimateAccepted: true }), true);
  assert.equal(studio.canConfirmCost(unknown, owner, { estimateAccepted: true }), false);
  assert.equal(studio.canConfirmCost(unknown, owner, { estimateAccepted: true, unknownCostAccepted: true }), true);
  assert.equal(studio.canConfirmCost(unknown, member, { estimateAccepted: true, unknownCostAccepted: true }), false);
});

test("capability billing is normalized without inventing a zero-dollar limit", () => {
  const state = studio.normalizeState({
    capabilities: {
      state: "ready",
      billing: { canCreate: true, admin: true, dailyJobLimit: 50, dailyUsdLimit: null },
      analysis: { directorPlan: true, visualSourceAnalysis: false },
      limits: { workerSceneMaximumSeconds: 10 }
    }
  });
  assert.equal(state.capabilities.billing.canCreate, true);
  assert.equal(state.capabilities.billing.dailyUsdLimit, null);
  assert.equal(state.capabilities.analysis.directorPlan, true);
  assert.equal(state.capabilities.limits.workerSceneMaximumSeconds, 10);
});

test("backend client keeps all actions on the single endpoint and reads string errors", async () => {
  const calls = [];
  const client = studio.createBackendClient({
    apiBase: "/api/ai-video-remake",
    fetch: async (url, init) => {
      calls.push({ url, init });
      return {
        ok: false,
        status: 403,
        headers: { get: () => "application/json" },
        json: async () => ({ ok: false, error: "Không có quyền billing." })
      };
    }
  });
  await assert.rejects(client.estimate({ prompt: "x" }), (error) => error.status === 403 && error.message === "Không có quyền billing.");
  assert.match(calls[0].url, /^http:\/\/localhost\/api\/ai-video-remake\?action=estimate$/);
  assert.equal(JSON.parse(calls[0].init.body).action, "estimate");
});

test("backend client rejects an HTML route fallback instead of reporting the API ready", async () => {
  const client = studio.createBackendClient({
    fetch: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "text/html; charset=utf-8" },
      text: async () => "<!doctype html><title>HH Platform</title>"
    })
  });
  await assert.rejects(
    client.capabilities(),
    (error) => error.status === 502 && error.code === "API_RESPONSE_NOT_JSON"
  );
});

test("analysis quote and analysis submission share the same backend route", async () => {
  const actions = [];
  const client = studio.createBackendClient({
    fetch: async (url, init) => {
      actions.push({ url, body: JSON.parse(init.body) });
      return {
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({ ok: true })
      };
    }
  });
  await client.estimateAnalysis({ brief: "Storyboard" });
  await client.analyze({ brief: "Storyboard", idempotencyKey: "analysis-safe-key" });
  assert.match(actions[0].url, /\/api\/ai-video-remake\?action=estimate-analysis$/);
  assert.match(actions[1].url, /\/api\/ai-video-remake\?action=analyze$/);
  assert.deepEqual(actions.map((item) => item.body.action), ["estimate-analysis", "analyze"]);
});

test("queue safety contract caps batches, dispatches sequentially and polls one job slowly", () => {
  assert.equal(studio.MAX_SAFE_BATCH, 10);
  assert.ok(studio.POLL_INTERVAL_MS >= 10_000);
  assert.match(source, /scenes\.slice\(0, MAX_SAFE_BATCH\)/);
  assert.match(source, /for \(const job of jobs\)[\s\S]*?await submitJob\(runtime, job\.id\)/);
  assert.match(source, /const job = jobs\[runtime\.pollIndex % jobs\.length\]/);
  assert.match(source, /updateJob\(runtime, update\.id,[\s\S]*?true\)/);
  assert.match(source, /aria-controls="hvr-queue-items"/);
  assert.match(source, /role="tablist"[\s\S]*?aria-controls="hvr-workspace-panel"/);
  assert.match(source, /\["ArrowLeft", "ArrowRight", "Home", "End"\]/);
  assert.match(source, /acceptedQuoteId:[\s\S]*?acceptedEstimate:\s*true[\s\S]*?costAccepted:\s*true[\s\S]*?idempotencyKey/);
});

test("auth changes discard stale owner options before remount", () => {
  assert.match(source, /currentUser:\s*eventUser[\s\S]*?ownerId:\s*undefined[\s\S]*?learnerProfileId:\s*undefined/);
  assert.match(source, /hh:auth-change[\s\S]*?event\?\.detail\?\.user/);
});

test("one-screen CSS keeps scrolling internal and covers compact/mobile accessibility", () => {
  assert.match(styles, /\.hvr-root\s*\{[\s\S]*?grid-template-rows:[^;]+;[\s\S]*?overflow:hidden/);
  assert.match(styles, /\.hvr-workspace\s*\{[\s\S]*?grid-template-columns:[^;]+;[\s\S]*?overflow:hidden/);
  assert.match(styles, /\.hvr-controls-scroll\s*\{[\s\S]*?overflow-y:auto/);
  assert.match(styles, /\.hvr-root \[hidden\]\s*\{display:none!important\}/);
  assert.match(styles, /\.hvr-queue-bar\.is-collapsed/);
  assert.match(styles, /@container \(max-width:1080px\)/);
  assert.match(styles, /@media \(max-width:760px\)/);
  assert.match(styles, /@media \(max-width:390px\)/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(styles, /@media \(forced-colors:active\)/);
});
