"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const runtimeApi = require("../tool-runtime.js");
const { TOOL_MANIFESTS } = require("../tool-manifests.js");
const gateway = require("../services/toolGateway.js");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("all manifests are valid, unique and route non-browser work through six shared gateways", () => {
  const registry = new runtimeApi.ToolRegistry(TOOL_MANIFESTS);
  assert.ok(registry.list().length >= 30);
  assert.equal(new Set(registry.list().map((item) => item.id)).size, registry.list().length);
  for (const manifest of registry.list()) {
    assert.ok(manifest.actions.length);
    assert.ok(Array.isArray(manifest.inputs));
    assert.ok(Array.isArray(manifest.permissions));
    assert.ok(Array.isArray(manifest.capabilities));
    assert.equal(typeof manifest.history, "boolean");
    assert.equal(typeof manifest.offline, "boolean");
    if (manifest.runtime !== "browser") assert.match(manifest.endpoint, /^\/api\/(tools\/run|ai|integrations)$/);
  }
});

test("browser runtime enforces lifecycle, validation, progress, history, logs and export", async () => {
  const manifest = { id: "contract-tool", name: "Contract Tool", group: "test", runtime: "browser", permissions: [], capabilities: [], actions: ["run", "cancel", "export"], inputs: [{ id: "text", type: "string", required: true, minLength: 2 }], history: true, offline: true };
  const storage = runtimeApi.createMemoryStorage();
  const runtime = new runtimeApi.ToolRuntime({ manifests: [manifest], storage, environment: {} });
  const states = [];
  runtime.on("statechange", (task) => states.push(task.state));
  runtime.registerAdapter("contract-tool", async ({ input, progress }) => { await progress(50, "half"); return { output: input.text.toUpperCase(), apiToken: "must-not-persist" }; });
  const task = await runtime.run("contract-tool", { text: "hello", password: "must-not-persist" });
  assert.deepEqual(states, ["validating", "running", "success"]);
  assert.equal(task.state, "success");
  assert.equal(task.output.output, "HELLO");
  assert.equal(task.output.apiToken, undefined);
  assert.equal(task.input.password, undefined);
  assert.equal((await runtime.history()).length, 1);
  assert.ok((await runtime.logs(task.id)).length >= 3);
  const exported = JSON.parse(await runtime.exportTask(task.id));
  assert.equal(exported.format, "HH Tool Task");
  assert.doesNotMatch(JSON.stringify(exported), /must-not-persist/);
});

test("invalid input finishes with a structured error and never calls the adapter", async () => {
  const manifest = { id: "validated-tool", name: "Validated", runtime: "browser", permissions: [], capabilities: [], actions: ["run"], inputs: [{ id: "count", type: "number", required: true, min: 1, max: 5 }] };
  let called = false;
  const runtime = new runtimeApi.ToolRuntime({ manifests: [manifest], storage: runtimeApi.createMemoryStorage(), environment: {} });
  runtime.registerAdapter("validated-tool", () => { called = true; });
  const task = await runtime.run("validated-tool", { count: 9 });
  assert.equal(task.state, "error");
  assert.equal(task.error.code, "TOOL_INPUT_INVALID");
  assert.equal(called, false);
});

test("capability and permission failures are explicit rather than fake-success", async () => {
  const manifest = { id: "voice-contract", name: "Voice", runtime: "browser", permissions: ["microphone"], capabilities: ["speechRecognition"], actions: ["start"], inputs: [] };
  const environment = { navigator: { permissions: { query: async () => ({ state: "denied" }) } } };
  const runtime = new runtimeApi.ToolRuntime({ manifests: [manifest], storage: runtimeApi.createMemoryStorage(), environment });
  runtime.registerAdapter("voice-contract", () => ({ fake: true }));
  const task = await runtime.run("voice-contract", {});
  assert.equal(task.state, "error");
  assert.equal(task.error.code, "TOOL_UNSUPPORTED");
  assert.deepEqual(task.error.details.deniedPermissions, ["microphone"]);
  assert.deepEqual(task.error.details.missingCapabilities, ["speechRecognition"]);
});

test("running adapters are cancellable with AbortController", async () => {
  const manifest = { id: "slow-tool", name: "Slow", runtime: "browser", permissions: [], capabilities: [], actions: ["run", "cancel"], inputs: [] };
  const runtime = new runtimeApi.ToolRuntime({ manifests: [manifest], storage: runtimeApi.createMemoryStorage(), environment: {} });
  let runningId = "";
  runtime.on("statechange", (task) => { if (task.state === "running") runningId = task.id; });
  runtime.registerAdapter("slow-tool", ({ signal }) => new Promise((resolve) => { signal.addEventListener("abort", () => resolve({ aborted: true }), { once: true }); }));
  const runPromise = runtime.run("slow-tool");
  while (!runningId) await new Promise((resolve) => setTimeout(resolve, 0));
  const cancelled = await runtime.cancel(runningId);
  const result = await runPromise;
  assert.equal(cancelled.state, "cancelled");
  assert.equal(result.state, "cancelled");
});

test("storage selects a bounded fallback when IndexedDB is unavailable", async () => {
  const values = new Map();
  const localStorage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const storage = await runtimeApi.createStorage({ indexedDB: null, localStorage });
  assert.equal(storage.kind, "localStorage");
  await storage.put("history", { id: "one", updatedAt: "2026-01-01" });
  assert.equal((await storage.get("history", "one")).id, "one");
});

test("server gateway uses an allowlist, redacts secrets and exposes no provider key", () => {
  assert.equal(gateway.policyFor("widget-marketplace", "list", "server").id, "widget-marketplace");
  assert.throws(() => gateway.policyFor("arbitrary-proxy", "fetch", "server"), (error) => error.code === "TOOL_NOT_ALLOWLISTED");
  assert.deepEqual(gateway.safeMeta({ status: 200, apiKey: "secret", nested: { password: "secret", count: 2 }, prompt: "private" }), { status: 200, nested: { count: 2 } });
  assert.ok(gateway.providerStatus().every((item) => item.secretsExposed === false));
});

test("six gateway endpoints share one Vercel function and protect auth, ownership, consent and secrets", () => {
  const files = ["tool-api/tools.js", "tool-api/jobs.js", "tool-api/files.js", "tool-api/ai.js", "tool-api/integrations.js", "tool-api/events.js"];
  files.forEach((file) => assert.ok(fs.existsSync(path.join(root, file)), file));
  const sources = files.map(read).join("\n");
  assert.match(sources, /currentUser\(req\)/);
  assert.match(read("tool-api/jobs.js"), /findJob\(db, user/);
  assert.match(read("tool-api/files.js"), /userId: user\._id/);
  assert.match(read("tool-api/events.js"), /ANALYTICS_CONSENT_REQUIRED/);
  assert.match(read("tool-api/ai.js"), /x-goog-api-key/);
  const vercel = read("vercel.json");
  for (const route of ["tools/run", "jobs", "files", "ai", "integrations", "events"]) assert.match(vercel, new RegExp(`/api/${route.replace("/", "\\/")}`));
  assert.match(read("api/store/[resource].js"), /TOOL_GATEWAYS/);
  assert.doesNotMatch(sources, /json\s*\(\s*\{[^}]*process\.env/s);
  assert.doesNotMatch(read("services/toolGateway.js"), /properties:\s*body\.properties/);
});
