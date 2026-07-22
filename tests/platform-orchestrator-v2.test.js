const test = require("node:test");
const assert = require("node:assert/strict");
const orchestrator = require("../platform-orchestrator.js");

function storage() {
  const values = new Map();
  return { values, getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)) };
}

test("shared runtime stores project assets, versions and a redacted activity timeline", () => {
  const runtime = orchestrator.createRuntime({ storage: storage() });
  const project = runtime.upsertProject({ id: "p-v2", name: "Relax channel", area: "music-ai" });
  const asset = runtime.upsertAsset({ projectId: project.id, kind: "audio", name: "piano.wav", metadata: { duration: 3600, apiToken: "never" } });
  const version = runtime.addVersion({ projectId: project.id, assetId: asset.id, label: "Mix 01", snapshot: { loudness: -14 } });
  const state = runtime.inspect();

  assert.equal(state.version, 2);
  assert.equal(runtime.listAssets({ projectId: project.id })[0].id, asset.id);
  assert.equal(runtime.listVersions({ assetId: asset.id })[0].id, version.id);
  assert.equal(state.activities[0].type, "version.created");
  assert.equal(JSON.stringify(state).includes("never"), false);
});

test("integration state and legacy orchestrator storage migrate safely", () => {
  const legacy = storage();
  legacy.setItem("hh.platform.orchestrator.v1", JSON.stringify({ version: 1, projects: [{ id: "legacy", name: "Legacy" }] }));
  const runtime = orchestrator.createRuntime({ storage: legacy });
  assert.equal(runtime.getActiveProject().id, "legacy");
  const integration = runtime.setIntegration({ providerId: "youtube", area: "publishing", state: "connected", capabilities: ["schedule"] });
  assert.equal(integration.state, "connected");
  assert.equal(runtime.listIntegrations()[0].capabilities[0], "schedule");
});
