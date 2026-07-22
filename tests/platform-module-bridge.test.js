const test = require("node:test");
const assert = require("node:assert/strict");
const bridge = require("../platform-module-bridge.js");
const orchestrator = require("../platform-orchestrator.js");

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

test("bridge synchronizes work, creative, music, media and DEV metadata into one runtime", () => {
  const storage = memoryStorage({
    "hh.creative-ai-workflow.v1": JSON.stringify({ id: "campaign-1", name: "Launch", workflow: { nodes: [{ id: "brief", type: "Brief", status: "success" }, { id: "video", type: "Video", status: "queued" }] }, campaign: { status: "in-production", calendar: [{}], experiments: [{ id: "ab" }], brandKit: { voice: "Warm" } } }),
    "hh.music-ai-studio.v1": JSON.stringify({ project: { name: "Relax Piano", genre: "piano", hours: 3 }, media: { audioName: "master.wav", audioDuration: 1800 }, automation: { stages: { compose: { status: "completed" }, master: { status: "queued" } } }, chapters: [{ name: "One" }] }),
    "hh.media-production.v1": JSON.stringify({ projectId: "film", timeline: { revision: 2, tracks: [{ id: "v1" }], clips: [{ id: "c1", assetId: "a1", name: "Scene 1", sourceIn: 0, sourceOut: 5 }], subtitles: [] }, renderQueue: [{ id: "render-1", kind: "render", name: "1080p", status: "queued", progress: 0.2 }] }),
    "hh.dev.delivery-workflow.v1": JSON.stringify({ provider: { connected: true, status: "connected" }, repository: { status: "imported", owner: "hh", name: "platform" }, change: { status: "drafted", branch: "feat/home", diff: "PRIVATE CONTENT" }, checks: { review: { status: "passed" }, secrets: { status: "idle" } } }),
    "hh-work-center-v2": JSON.stringify({ projects: [{ id: "p1", name: "Website", status: "active", progress: 50 }], tasks: [{ id: "t1", projectId: "p1", title: "Polish home", status: "todo" }] })
  });
  const runtime = orchestrator.createRuntime({ storage });
  const result = bridge.createBridge({ runtime, storage, intervalMs: 60000 }).sync();
  const snapshot = runtime.inspect();

  assert.equal(result.ok, true);
  assert.ok(snapshot.projects.some((item) => item.id === "creative:campaign-1"));
  assert.ok(snapshot.projects.some((item) => item.id === "music:relax-piano"));
  assert.ok(snapshot.projects.some((item) => item.id === "media:film"));
  assert.ok(snapshot.projects.some((item) => item.id === "dev:hh-platform"));
  assert.ok(snapshot.projects.some((item) => item.id === "work:p1"));
  assert.ok(snapshot.assets.some((item) => item.name === "master.wav"));
  assert.ok(snapshot.jobs.some((item) => item.id === "bridge:media:render-1"));
  assert.ok(snapshot.activities.some((item) => item.type === "module.synced"));
});

test("bridge only copies operational metadata and redacts credential-shaped values", () => {
  const raw = {
    id: "x",
    name: "Bearer abcdefghijklmnopqrstuvwxyz123456",
    brief: { prompt: "private prompt", password: "never-copy" },
    workflow: { nodes: [{ id: "n", type: "Image", status: "queued", prompt: "private" }] },
    campaign: { status: "draft", brandKit: {} }
  };
  const [summary] = bridge.summarizeCreative(raw);
  const serialized = JSON.stringify(summary);
  assert.match(summary.project.name, /\[redacted\]/);
  assert.doesNotMatch(serialized, /private prompt|never-copy|"password"|"prompt"/i);
  assert.deepEqual(Object.keys(summary.jobs[0].input), ["step"]);
});

test("unchanged source does not duplicate background jobs or activity", () => {
  const storage = memoryStorage({
    "hh.music-ai-studio.v1": JSON.stringify({ project: { name: "Loop" }, automation: { stages: { render: { status: "queued" } } } })
  });
  const runtime = orchestrator.createRuntime({ storage });
  const instance = bridge.createBridge({ runtime, storage, intervalMs: 60000 });
  const first = runtime.inspect();
  instance.sync();
  const second = runtime.inspect();
  assert.equal(second.jobs.length, first.jobs.length);
  assert.equal(second.activities.length, first.activities.length);
});

test("bridge synchronizes immediately when a module publishes a privacy-safe change event", () => {
  const listeners = new Map();
  const removed = [];
  const eventTarget = {
    addEventListener(name, handler) { listeners.set(name, handler); },
    removeEventListener(name) { removed.push(name); listeners.delete(name); },
    setInterval() { return 17; },
    clearInterval() {}
  };
  const storage = memoryStorage();
  const runtime = orchestrator.createRuntime({ storage });
  const instance = bridge.createBridge({ runtime, storage, eventTarget, intervalMs: 60000 });
  bridge.MODULE_CHANGE_EVENTS.forEach((name) => assert.equal(typeof listeners.get(name), "function"));

  storage.setItem("hh.dev.delivery-workflow.v1", JSON.stringify({
    repository: { status: "imported", owner: "hh", name: "instant-sync" },
    change: { status: "drafted", branch: "feat/instant" },
    checks: {}
  }));
  listeners.get("hh:dev-delivery-change")();
  assert.ok(runtime.listProjects().some((item) => item.id === "dev:hh-instant-sync"));

  instance.stop();
  bridge.MODULE_CHANGE_EVENTS.forEach((name) => assert.ok(removed.includes(name)));
});
