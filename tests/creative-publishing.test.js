const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "creative-publishing.js");
const cssPath = path.join(root, "creative-publishing.css");
const source = fs.readFileSync(sourcePath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const publishing = require(sourcePath);
const creativeCore = require(path.join(root, "creative-os-core.js"));

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    value(key) { return values.get(key); }
  };
}

function publication(overrides = {}) {
  return {
    id: "pub-1",
    platform: "youtube",
    title: "Creative launch",
    description: "Mô tả chiến dịch",
    mediaUrl: "https://cdn.example/video.mp4",
    thumbnailUrl: "https://cdn.example/thumb.webp",
    scheduledAt: "2030-02-20T08:00:00.000Z",
    tags: ["creative", "launch"],
    ...overrides
  };
}

test("exposes the standalone HHCreativePublishing API and four requested views", () => {
  assert.equal(publishing.VERSION, 1);
  assert.equal(publishing.FORMAT, "hh-creative-publishing");
  assert.equal(publishing.STORAGE_KEY, "hh.creative-publishing.v1");
  assert.deepEqual(publishing.VIEWS, ["publishing", "analytics", "rights", "providers"]);
  assert.deepEqual(publishing.PLATFORMS, ["youtube", "tiktok", "facebook", "website"]);
  for (const helper of [
    "createStore", "validateSchedule", "preflightPublication", "parseAnalyticsImport", "evaluateExperiment",
    "auditRights", "exportRightsManifest", "chooseProvider", "renderViewMarkup", "mount", "unmount"
  ]) assert.equal(typeof publishing[helper], "function", `missing ${helper}`);
  assert.match(source, /globalScope\.HHCreativePublishing = api/);
});

test("versioned fallback storage and external Creative OS store stay synchronized", () => {
  const storage = memoryStorage();
  let externalState = { anotherModule: { safe: true } };
  const actions = [];
  const external = {
    getState: () => externalState,
    setState(next) { externalState = next; },
    dispatch(action) { actions.push(action); }
  };
  const store = publishing.createStore({ storage, store: external, idFactory: (prefix) => `${prefix}-fixed` });
  store.addPublication(publication({ id: "" }));
  const envelope = JSON.parse(storage.value(publishing.STORAGE_KEY));
  assert.equal(envelope.version, 1);
  assert.equal(envelope.queue.length, 1);
  assert.equal(externalState.creativePublishing.queue.length, 1);
  assert.equal(externalState.anotherModule.safe, true);

  const dispatchOnly = { dispatch(action) { actions.push(action); } };
  publishing.createStore({ storage: memoryStorage(), store: dispatchOnly }).addRightsAsset({ name: "Owned", license: "owned", creator: "HH" });
  assert.equal(actions.at(-1).type, "creative/publishing/replace");
  assert.equal(actions.at(-1).payload.rights.length, 1);
});

test("integrates with the active Universal Creative Project without replacing its other fields", () => {
  const coreStore = creativeCore.createStore({ storage: memoryStorage() });
  const project = coreStore.createProject({ name: "Launch OS", brief: { product: "Album" }, scripts: [{ title: "Intro", content: "Hello" }] });
  const store = publishing.createStore({ storage: memoryStorage(), store: coreStore });
  store.addPublication(publication({ projectId: project.id }));
  store.addAnalytics({ projectId: project.id, experimentId: "launch", variant: "A", impressions: 2000, clicks: 120, views: 110, retention: 0.55 });
  store.addRightsAsset({ projectId: project.id, name: "Cover", license: "owned", creator: "HH" });

  const updated = coreStore.getState().projects.find((item) => item.id === project.id);
  assert.equal(updated.brief.product, "Album");
  assert.equal(updated.scripts[0].title, "Intro");
  assert.equal(updated.publishing.length, 1);
  assert.equal(updated.analytics.publishingIntelligence.analytics.length, 1);
  assert.equal(updated.rights.records[0].name, "Cover");
});

test("schedule validation and preflight report actionable errors without fake readiness", () => {
  assert.equal(publishing.validateSchedule("bad-date", "2030-01-01").code, "SCHEDULE_INVALID");
  assert.equal(publishing.validateSchedule("2029-12-01", "2030-01-01").code, "SCHEDULE_PAST");
  assert.equal(publishing.validateSchedule("2030-03-01", "2030-01-01").valid, true);

  const failed = publishing.preflightPublication({ platform: "youtube", title: "", mediaUrl: "javascript:alert(1)", scheduledAt: "2030-02-20" }, { now: "2030-01-01" });
  assert.equal(failed.valid, false);
  assert.ok(failed.errors.some((item) => item.code === "TITLE_REQUIRED"));
  assert.ok(failed.errors.some((item) => item.code === "MEDIA_REQUIRED"));
  assert.ok(failed.warnings.some((item) => item.code === "THUMBNAIL_EMPTY"));
  assert.equal(publishing.safeUrl("javascript:alert(1)"), "");
});

test("publishing queue marks sent only after an explicitly confirmed adapter response", async () => {
  let calls = 0;
  const adapters = {
    youtube: {
      configured: true,
      async publish(payload) {
        calls += 1;
        assert.equal(payload.title, "Creative launch");
        return calls === 1
          ? { status: "sent", remoteId: "remote-without-confirmation" }
          : { status: "published", confirmed: true, remoteId: "yt-42", remoteUrl: "https://youtube.com/watch?v=yt-42" };
      }
    }
  };
  const store = publishing.createStore({ storage: memoryStorage(), providerAdapters: adapters });
  store.addPublication(publication({ scheduledAt: "" }));
  store.enqueue("pub-1", "2030-01-01T00:00:00.000Z");
  const first = await store.processPublication("pub-1", { now: "2030-01-01T00:00:00.000Z" });
  assert.equal(first.ok, false);
  assert.equal(first.code, "UNCONFIRMED");
  assert.equal(store.getState().queue[0].status, "failed");
  assert.match(store.getState().queue[0].error, /không đánh dấu sent/);

  store.retryPublication("pub-1");
  const second = await store.processPublication("pub-1", { now: "2030-01-01T00:00:00.000Z" });
  assert.equal(second.ok, true);
  assert.equal(second.item.status, "sent");
  assert.equal(second.item.remoteId, "yt-42");
  assert.ok(second.item.confirmedAt);
});

test("unconfigured adapters block clearly and queue supports retry, cancel and due processing", async () => {
  const store = publishing.createStore({ storage: memoryStorage(), providerAdapters: {} });
  store.addPublication(publication({ id: "fb-1", platform: "facebook", scheduledAt: "" }));
  store.enqueue("fb-1", "2030-01-01T00:00:00.000Z");
  const result = await store.processPublication("fb-1", { now: "2030-01-01T00:00:00.000Z" });
  assert.equal(result.code, "ADAPTER_UNCONFIGURED");
  assert.equal(result.item.status, "blocked");
  assert.match(result.item.error, /backend/);
  assert.equal(store.retryPublication("fb-1").status, "queued");
  assert.equal(store.cancelPublication("fb-1").status, "cancelled");
  assert.equal((await store.processDue({ now: "2030-01-01T00:00:00.000Z" })).length, 0);
});

test("analytics imports JSON and CSV with bounded normalized values", () => {
  const json = publishing.parseAnalyticsImport(JSON.stringify({ records: [
    { experimentId: "hero", variant: "A", impressions: 1000, clicks: 80, views: 70, retention: 55 },
    { experimentId: "hero", variant: "B", impressions: 1000, clicks: 95, views: 84, retention: 0.61 }
  ] }), "json");
  assert.equal(json.valid, true);
  assert.equal(json.records.length, 2);
  assert.equal(json.records[0].retention, 0.55);
  assert.equal(publishing.ctr(json.records[1]), 0.095);

  const csv = publishing.parseAnalyticsImport("experimentId,variant,impressions,clicks,views,retention\nlaunch,A,500,40,38,0.5\nlaunch,B,520,48,44,0.6", "csv");
  assert.equal(csv.valid, true);
  assert.deepEqual(csv.records.map((item) => item.variant), ["A", "B"]);
  assert.equal(publishing.parseAnalyticsImport("{broken", "json").valid, false);
});

test("A/B evaluation refuses a winner below sample or confidence thresholds", () => {
  const lowSample = [
    { experimentId: "x", variant: "A", impressions: 100, clicks: 30, views: 80, retention: 0.8 },
    { experimentId: "x", variant: "B", impressions: 100, clicks: 5, views: 60, retention: 0.4 }
  ];
  const low = publishing.evaluateExperiment(lowSample, { experimentId: "x", minimumSample: 1000 });
  assert.equal(low.status, "insufficient-sample");
  assert.equal(low.winner, null);

  const tie = publishing.evaluateExperiment([
    { experimentId: "x", variant: "A", impressions: 5000, clicks: 250, views: 220, retention: 0.5 },
    { experimentId: "x", variant: "B", impressions: 5000, clicks: 250, views: 220, retention: 0.5 }
  ], { experimentId: "x", minimumSample: 1000, confidenceThreshold: 0.95 });
  assert.equal(tie.status, "inconclusive");
  assert.equal(tie.winner, null);

  const clear = publishing.evaluateExperiment([
    { experimentId: "x", variant: "A", impressions: 10000, clicks: 1200, views: 1100, retention: 0.62 },
    { experimentId: "x", variant: "B", impressions: 10000, clicks: 600, views: 580, retention: 0.47 }
  ], { experimentId: "x", minimumSample: 1000, confidenceThreshold: 0.95 });
  assert.equal(clear.status, "winner");
  assert.equal(clear.winner, "A");
  assert.ok(clear.confidence >= 0.95);

  const retention = publishing.evaluateExperiment([
    { experimentId: "r", variant: "A", impressions: 10000, clicks: 900, views: 6000, retention: 0.7 },
    { experimentId: "r", variant: "B", impressions: 10000, clicks: 900, views: 6000, retention: 0.45 }
  ], { experimentId: "r", metric: "retention", minimumSample: 1000, confidenceThreshold: 0.95 });
  assert.equal(retention.status, "winner");
  assert.equal(retention.winner, "A");
});

test("rights audit detects missing source, proof, creator, AI provenance and expiry", () => {
  const assets = [
    { id: "stock", name: "Stock clip", license: "licensed", sourceUrl: "https://stock.example/clip", creator: "Studio", expiresAt: "2029-01-01" },
    { id: "unknown", name: "Unknown song", license: "unknown" },
    { id: "ai", name: "AI image", license: "ai-generated", creator: "HH" }
  ];
  const audit = publishing.auditRights(assets, { now: "2030-01-01T00:00:00.000Z" });
  assert.equal(audit.valid, false);
  for (const code of ["PROOF_MISSING", "LICENSE_EXPIRED", "SOURCE_MISSING", "LICENSE_MISSING", "CREATOR_MISSING", "AI_MODEL_MISSING", "PROMPT_MISSING"]) {
    assert.ok(audit.issues.some((item) => item.code === code), `missing ${code}`);
  }
  const manifest = JSON.parse(publishing.exportRightsManifest(assets, { now: "2030-01-01T00:00:00.000Z" }));
  assert.equal(manifest.format, "hh-creative-publishing-rights-manifest");
  assert.equal(manifest.summary.assets, 3);
  assert.equal(manifest.valid, false);
});

test("provider router is deterministic and excludes quota, cooldown and unconfigured providers", () => {
  const providers = [
    { id: "slow-quality", label: "Quality", configured: true, status: "ready", modes: ["balanced", "fast", "quality"], qualityScore: 98, speedScore: 35, errorRate: 0.01, avgLatencyMs: 1600 },
    { id: "fast", label: "Fast", configured: true, status: "ready", modes: ["balanced", "fast", "quality"], qualityScore: 74, speedScore: 97, errorRate: 0.02, avgLatencyMs: 240 },
    { id: "quota", configured: true, status: "ready", modes: ["balanced"], qualityScore: 100, speedScore: 100, quotaLimit: 10, quotaUsed: 10 },
    { id: "cooldown", configured: true, status: "ready", modes: ["balanced"], qualityScore: 100, speedScore: 100, cooldownUntil: "2031-01-01T00:00:00.000Z" },
    { id: "browser-secret", configured: false, status: "unconfigured", qualityScore: 100, speedScore: 100 }
  ];
  assert.equal(publishing.chooseProvider(providers, "fast", { now: "2030-01-01" }).provider.id, "fast");
  assert.equal(publishing.chooseProvider(providers, "quality", { now: "2030-01-01" }).provider.id, "slow-quality");
  const first = publishing.chooseProvider(providers, "balanced", { now: "2030-01-01" });
  const second = publishing.chooseProvider([...providers].reverse(), "balanced", { now: "2030-01-01" });
  assert.equal(first.provider.id, second.provider.id);
  assert.notEqual(first.provider.id, "quota");
  assert.notEqual(first.provider.id, "cooldown");
});

test("provider persistence stores usage and status only, stripping credential-shaped fields", () => {
  const sanitized = publishing.sanitizeObject({ status: "ready", password: "hidden", accessToken: "hidden", nested: { secret: "hidden", latency: 20 } }, 3);
  assert.deepEqual(sanitized, { status: "ready", nested: { latency: 20 } });
  const normalized = publishing.normalizeProvider({ id: "gemini", label: "Gemini", configured: true, inputTokens: 20, outputTokens: 10, credits: 0.2 });
  assert.equal(normalized.inputTokens + normalized.outputTokens, 30);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized, "password"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized, "accessToken"), false);
});

test("all four UI views render real controls, escaped content and accessible status", () => {
  const state = publishing.normalizeState({
    queue: [publication({ title: '<img src=x onerror="boom">' })],
    analytics: [
      { variant: "A", impressions: 2000, clicks: 140, views: 120, retention: 0.55 },
      { variant: "B", impressions: 2000, clicks: 110, views: 100, retention: 0.48 }
    ],
    rights: [{ name: "Logo <script>", license: "owned", creator: "HH" }],
    providers: [{ id: "local", label: "Backend status", configured: true, status: "ready", modes: ["balanced"] }]
  });
  const expectations = {
    publishing: ["data-cp-publish-form", "data-cp-process-due", "data-cp-preflight-list", "YouTube", "TikTok", "Facebook", "Website"],
    analytics: ["data-cp-analytics-form", "data-cp-analytics-file", "data-cp-chart", "cp-chart-svg", "DECISION GATE"],
    rights: ["data-cp-rights-form", "data-cp-export-rights", "PROVENANCE LEDGER", "Rights score"],
    providers: ["data-cp-route-mode", "DETERMINISTIC", "Ranh giới bảo mật", "quota"]
  };
  Object.entries(expectations).forEach(([view, tokens]) => {
    const markup = publishing.renderViewMarkup(view, state);
    assert.match(markup, /role="tablist"/);
    assert.match(markup, /role="status" aria-live="polite"/);
    tokens.forEach((token) => assert.ok(markup.includes(token), `${view} missing ${token}`));
    assert.doesNotMatch(markup, /<script>|<img src=x/);
    assert.ok(markup.includes("&lt;img src=x onerror=&quot;boom&quot;&gt;") || view !== "publishing");
  });
});

test("responsive visual contract supports 375px, focus and reduced motion", () => {
  for (const token of [
    "@media (max-width: 420px)", "@media (max-width: 680px)", "@media (prefers-reduced-motion: reduce)",
    ":focus-visible", ".cp-tabs", ".cp-provider-grid", ".cp-publishing-grid", ".cp-table-wrap", "min-width: 0"
  ]) assert.ok(css.includes(token), `CSS missing ${token}`);
  assert.match(source, /ArrowLeft/);
  assert.match(source, /ArrowRight/);
  assert.match(source, /activeRoots/);
  assert.match(source, /aria-live=\"polite\"/);
  assert.match(source, /FileReader/);
  assert.match(source, /drawAnalyticsCanvas/);
});
