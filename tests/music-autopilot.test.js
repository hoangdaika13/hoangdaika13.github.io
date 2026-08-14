const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const Core = require(path.join(root, "music-autopilot-core.js"));
const ui = fs.readFileSync(path.join(root, "music-autopilot.js"), "utf8");
const css = fs.readFileSync(path.join(root, "music-autopilot.css"), "utf8");
const router = fs.readFileSync(path.join(root, "script.js"), "utf8");
const loader = fs.readFileSync(path.join(root, "performance-loader.js"), "utf8");
const youtube = fs.readFileSync(path.join(root, "youtube-publisher.js"), "utf8");
const backend = fs.readFileSync(path.join(root, "api", "modules", "[moduleId]", "actions.js"), "utf8");

class MemoryStorage {
  constructor() { this.rows = new Map(); }
  getItem(key) { return this.rows.get(key) ?? null; }
  setItem(key, value) { this.rows.set(key, String(value)); }
}

test("Autopilot core defines the full real pipeline and production modes", () => {
  assert.equal(Core.STAGES.length, 15);
  assert.equal(Core.MODES.length, 14);
  assert.deepEqual(Core.STAGES.map((stage) => stage.id), [
    "concept", "lyrics", "structure", "previews", "selection", "render", "qa", "repair",
    "master", "artwork", "visualizer", "metadata", "rights", "package", "publishing"
  ]);
  for (const status of ["waiting", "running", "review", "completed", "failed", "blocked", "paused", "skipped"]) {
    assert.ok(Core.STATUS.includes(status));
  }
});

test("project state is isolated by owner and learner profile", () => {
  const storage = new MemoryStorage();
  const first = Core.createStore(storage, { ownerId: "owner-a", learnerProfileId: "main" });
  const second = Core.createStore(storage, { ownerId: "owner-b", learnerProfileId: "main" });
  const child = Core.createStore(storage, { ownerId: "owner-a", learnerProfileId: "child" });
  first.update({ title: "Private project A" });
  assert.equal(first.get().title, "Private project A");
  assert.notEqual(second.get().title, first.get().title);
  assert.notEqual(child.get().title, first.get().title);
  assert.notEqual(first.key, second.key);
  assert.notEqual(first.key, child.key);
});

test("rights gate blocks incomplete projects and accepts explicit declarations", () => {
  const project = Core.defaultProject({ ownerId: "owner" });
  assert.ok(Core.validateProject(project).length >= 2);
  project.rights.ownsPrompt = true;
  project.rights.acceptsProviderTerms = true;
  assert.deepEqual(Core.validateProject(project), []);
  project.mode = "image-music";
  assert.match(Core.validateProject(project).join(" "), /file tham chiếu/i);
  project.assets.reference = { key: "reference" };
  project.rights.ownsReferences = true;
  assert.deepEqual(Core.validateProject(project), []);
});

test("stage transitions create bounded checkpoints and honest progress", () => {
  const project = Core.defaultProject({ ownerId: "owner" });
  Core.setStage(project, "concept", "running", "Generating", { progress: 42 });
  assert.equal(project.stages.concept.status, "running");
  assert.equal(project.stages.concept.progress, 42);
  Core.setStage(project, "concept", "completed", "Done");
  assert.equal(project.stages.concept.progress, 100);
  const row = Core.checkpoint(project, "concept", "Provider response stored");
  assert.equal(row.stageId, "concept");
  assert.equal(project.stages.concept.checkpointId, row.id);
  assert.throws(() => Core.setStage(project, "missing", "completed"));
});

test("provider routing and cost model never claim an unavailable provider", () => {
  const project = Core.defaultProject({ ownerId: "owner" });
  project.provider = "auto";
  assert.equal(Core.providerChoice(project, {}, "preview"), null);
  assert.equal(Core.providerChoice(project, { music: { configured: true } }, "preview").id, "eleven");
  assert.equal(Core.providerChoice(project, { lyria: { configured: true } }, "preview").id, "lyria");
  const cost = Core.estimateCost({ ...project, generateArtwork: true, generateVideo: true }, { lyria: { configured: true }, image: { configured: true }, video: { configured: true } });
  assert.ok(cost.estimatedUsd > 0);
  assert.equal(cost.currency, "USD");
});

test("local planning and technical QA remain deterministic and bounded", () => {
  const project = Core.defaultProject({ ownerId: "owner" });
  project.durationSeconds = 60;
  project.mode = "game-loop";
  const first = Core.buildLocalPlan(project);
  const second = Core.buildLocalPlan(project);
  assert.deepEqual(first, second);
  assert.equal(first.structure.reduce((sum, item) => sum + item.durationSeconds, 0), 60);
  assert.equal(first.instrumental, true);
  assert.ok(Core.technicalScore({ peakDb: -1, rmsDb: -18, clippingPercent: 0, silencePercent: 1, dynamicRangeDb: 9, stereoCorrelation: 0.4 }) > 80);
  assert.ok(Core.technicalScore({ peakDb: 1, rmsDb: -45, clippingPercent: 20, silencePercent: 50, dynamicRangeDb: 1, stereoCorrelation: -0.8 }) < 30);
});

test("UI provides real storage, audio QA, mastering, package, queue and safe publishing handoff", () => {
  for (const contract of [
    "indexedDB.open", "decodeAudioData", "OfflineAudioContext", "crypto.subtle.digest", "JSZip",
    "generatePreviews", "renderFullSong", "buildRightsManifest", "buildPackage", "runQueueJob",
    "music-autopilot.youtube-handoff", "MUSIC_PROVIDER_NOT_CONFIGURED"
  ]) assert.match(ui, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(ui, /Không tự đăng|không tự đăng/i);
  assert.match(ui, /Xác nhận & tiếp tục/);
  assert.match(ui, /referenceAttachment/);
  assert.match(youtube, /takeAutopilotHandoff/);
});

test("router, lazy loader and responsive visual system include Autopilot", () => {
  assert.match(router, /id: "autopilot"/);
  assert.match(router, /HHMusicAutopilot\.mount/);
  assert.match(loader, /music-autopilot-core\.js\?v=2/);
  assert.match(loader, /music-autopilot\.js\?v=2/);
  assert.match(loader, /music-autopilot\.css\?v=2/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /:focus-visible/);
});

test("backend exposes truthful provider status, Lyria and Eleven inpainting contracts", () => {
  assert.match(backend, /"music-lyria"/);
  assert.match(backend, /lyria-3-clip-preview/);
  assert.match(backend, /lyria-3-pro-preview/);
  assert.match(backend, /conditioning_ref/);
  assert.match(backend, /condition_strength/);
  assert.match(backend, /store_for_inpainting/);
  assert.match(backend, /compositionDurationMs/);
  assert.match(backend, /stems: \{ configured: Boolean/);
  assert.doesNotMatch(backend, /(?:GEMINI_API_KEY|ELEVENLABS_API_KEY)\s*=\s*["'][^"']+["']/);
});
