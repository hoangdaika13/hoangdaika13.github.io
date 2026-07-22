const test = require("node:test");
const assert = require("node:assert/strict");
const orchestrator = require("../platform-orchestrator.js");

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    values
  };
}

test("shared project context persists without sensitive fields", () => {
  const storage = memoryStorage();
  const runtime = orchestrator.createRuntime({ storage });
  const project = runtime.upsertProject({
    id: "release-1",
    name: "Kênh relax",
    area: "music-ai",
    nextAction: "Kiểm âm bản dài",
    context: { bpm: 72, apiToken: "never-store-this" }
  });
  assert.equal(project.context.bpm, 72);
  assert.equal("apiToken" in project.context, false);
  const restored = orchestrator.createRuntime({ storage });
  assert.equal(restored.getActiveProject().id, "release-1");
  assert.equal(restored.suggestions()[0].label, "Kiểm âm bản dài");
});

test("jobs wait honestly until a real adapter is registered", async () => {
  const runtime = orchestrator.createRuntime({ storage: memoryStorage() });
  const queued = runtime.enqueue({ type: "render-video", input: { duration: 3600 } });
  const waiting = await runtime.run(queued.id);
  assert.equal(waiting.state, "waiting");
  assert.match(waiting.error, /cấu hình/i);

  runtime.transitionJob(queued.id, "queued");
  runtime.registerAdapter("render-video", async (job) => ({ ok: true, output: { duration: job.input.duration } }));
  const completed = await runtime.run(queued.id);
  assert.equal(completed.state, "completed");
  assert.equal(completed.output.duration, 3600);
  assert.equal(completed.progress, 100);
});

test("provider quota is explicit and client secrets are rejected", () => {
  const runtime = orchestrator.createRuntime({ storage: memoryStorage() });
  assert.throws(() => runtime.setProvider({ id: "gemini", apiKey: "bad" }), /bí mật/i);
  runtime.setProvider({ id: "gemini", label: "Gemini", configured: true, status: "ready", quotaLimit: 10, quotaUsed: 8 });
  assert.equal(runtime.suggestions()[0].kind, "quota");
  runtime.consumeQuota("gemini", 2);
  assert.equal(runtime.listProviders()[0].status, "limited");
  assert.throws(() => runtime.consumeQuota("gemini", 1), /hạn mức/i);
});

test("guided flows and audit log expose state but redact private data", () => {
  const storage = memoryStorage();
  const runtime = orchestrator.createRuntime({ storage });
  runtime.updateGuide("english", { flowId: "smart-start", step: 2, completed: ["placement"] });
  runtime.upsertProject({ id: "p1", name: "Bài học", context: { password: "hidden", level: "A2" } });
  const state = runtime.inspect();
  assert.equal(state.guides.english.step, 2);
  assert.deepEqual(state.guides.english.completed, ["placement"]);
  assert.equal(JSON.stringify(state).includes("hidden"), false);
  assert.ok(state.audit.some((item) => item.action === "guide.updated"));
});
