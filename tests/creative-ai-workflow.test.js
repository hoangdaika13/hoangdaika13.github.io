const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const workflow = require("../creative-ai-workflow.js");
const source = fs.readFileSync(path.join(__dirname, "..", "creative-ai-workflow.js"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "..", "creative-ai-workflow.css"), "utf8");

test("exposes the Creative OS workflow API and three views", () => {
  [
    "mount", "unmount", "mountAll", "createDefaultProject", "createPreset", "normalizeProject",
    "topologicalSort", "connectNodes", "disconnectNodes", "runWorkflowNode", "runWorkflow",
    "retryFailed", "approvePublish", "proposeDirectorPlan", "applyDirectorPlan",
    "createPromptVariant", "reproduceVariant", "getVariantLineage", "compareVariants",
    "exportProject", "importProject", "createStoreAdapter"
  ].forEach((name) => assert.equal(typeof workflow[name], "function", `${name} must be exported`));
  assert.deepEqual(workflow.VIEWS, ["workflow", "ai-director", "prompt-studio"]);
  assert.equal(workflow.STORAGE_KEY, "hh.creative-ai-workflow.v1");
  assert.match(source, /globalScope\.HHCreativeAIWorkflow = api/);
});

test("default workflow contains the production nodes and is a valid DAG", () => {
  const project = workflow.createDefaultProject();
  assert.deepEqual(project.workflow.nodes.map((node) => node.type), workflow.NODE_TYPES);
  const order = workflow.topologicalSort(project);
  assert.equal(order.length, workflow.NODE_TYPES.length);
  assert.ok(order.indexOf("brief") < order.indexOf("publish"));
  project.workflow.edges.forEach((edge) => assert.ok(order.indexOf(edge.from) < order.indexOf(edge.to)));
});

test("cycle guard rejects an edge that closes a path", () => {
  const project = workflow.createDefaultProject();
  assert.equal(workflow.hasPath(project.workflow.edges, "brief", "publish"), true);
  assert.throws(() => workflow.connectNodes(project, "publish", "brief"), /chu trình/i);
  const normalized = workflow.normalizeProject({
    ...project,
    workflow: {
      ...project.workflow,
      edges: [...project.workflow.edges, { id: "bad", from: "publish", to: "brief" }]
    }
  });
  assert.equal(normalized.workflow.edges.some((edge) => edge.id === "bad"), false);
});

test("edge editor helpers add and remove valid DAG links", () => {
  let project = workflow.createDefaultProject();
  const direct = workflow.connectNodes(project, "brief", "script");
  const edge = direct.workflow.edges.find((item) => item.from === "brief" && item.to === "script");
  assert.ok(edge);
  assert.equal(direct.workflow.preset, "custom");
  project = workflow.disconnectNodes(direct, edge.id);
  assert.equal(project.workflow.edges.some((item) => item.id === edge.id), false);
});

test("deterministic hash is key-order stable and changes with input", () => {
  const first = workflow.deterministicHash({ b: 2, a: { y: 2, x: 1 } });
  const second = workflow.deterministicHash({ a: { x: 1, y: 2 }, b: 2 });
  assert.equal(first, second);
  assert.notEqual(first, workflow.deterministicHash({ a: { x: 1, y: 3 }, b: 2 }));
  assert.match(first, /^[a-f0-9]{16}$/);
});

test("running the same node reuses deterministic cache", async () => {
  let project = workflow.createDefaultProject();
  project.brief.product = "HH Creative OS";
  project = await workflow.runWorkflowNode(project, "brief");
  assert.equal(project.workflow.nodes.find((node) => node.id === "brief").status, "success");
  assert.equal(Object.keys(project.workflow.cache).length, 1);
  project = await workflow.runWorkflowNode(project, "brief");
  const brief = project.workflow.nodes.find((node) => node.id === "brief");
  assert.equal(brief.status, "cached");
  assert.match(project.workflow.logs.at(-1).message, /cache/i);
});

test("runAI is used only when supplied and local mode is labelled truthfully", async () => {
  let project = workflow.createDefaultProject();
  project = await workflow.runWorkflowNode(project, "brief");
  project = await workflow.runWorkflowNode(project, "prompt");
  assert.equal(project.workflow.nodes.find((node) => node.id === "prompt").output.mode, "local-plan");
  assert.match(project.workflow.nodes.find((node) => node.id === "prompt").output.notice, /chưa gọi dịch vụ AI/i);

  let calls = 0;
  let external = workflow.createDefaultProject();
  external = await workflow.runWorkflowNode(external, "brief");
  external = await workflow.runWorkflowNode(external, "prompt", {
    runAI: async (payload) => { calls += 1; return { acceptedNode: payload.node.type, apiKey: "private-runtime-value" }; }
  });
  assert.equal(calls, 1);
  const output = external.workflow.nodes.find((node) => node.id === "prompt").output;
  assert.equal(output.mode, "external-ai");
  assert.equal(output.result.apiKey, "[redacted]");
});

test("publish remains blocked until review succeeds and a person approves", async () => {
  let project = await workflow.runWorkflow(workflow.createDefaultProject());
  const publish = project.workflow.nodes.find((node) => node.type === "Publish");
  const review = project.workflow.nodes.find((node) => node.type === "Review");
  assert.ok(["success", "cached"].includes(review.status));
  assert.equal(publish.status, "waiting-approval");
  assert.equal(project.workflow.approvals.publish.approved, false);
  project = workflow.approvePublish(project, "QA Lead");
  assert.equal(project.workflow.approvals.publish.by, "QA Lead");
  project = await workflow.runWorkflowNode(project, publish.id);
  assert.equal(project.workflow.nodes.find((node) => node.type === "Publish").status, "success");
  assert.equal(project.workflow.nodes.find((node) => node.type === "Publish").output.readinessPackage.autoPublished, false);
});

test("approval cannot bypass an unfinished review and edits revoke approval", async () => {
  const fresh = workflow.createDefaultProject();
  assert.throws(() => workflow.approvePublish(fresh, "Owner"), /Review/i);
  let project = await workflow.runWorkflow(fresh);
  project = workflow.approvePublish(project, "Owner");
  assert.equal(project.workflow.approvals.publish.approved, true);
  project = workflow.disconnectNodes(project, project.workflow.edges[0].id);
  assert.equal(project.workflow.approvals.publish.approved, false);
});

test("failed AI nodes record errors and retry can run them again", async () => {
  let project = workflow.createDefaultProject();
  project = await workflow.runWorkflowNode(project, "brief");
  project = await workflow.runWorkflowNode(project, "prompt", { runAI: async () => { throw new Error("provider offline"); } });
  assert.equal(project.workflow.nodes.find((node) => node.id === "prompt").status, "failed");
  assert.match(project.workflow.nodes.find((node) => node.id === "prompt").error, /provider offline/);
  project = await workflow.retryFailed(project, { runAI: async () => "restored" });
  assert.equal(project.workflow.nodes.find((node) => node.id === "prompt").status, "success");
});

test("AI Director is deterministic locally and requires per-step approval", async () => {
  const first = await workflow.proposeDirectorPlan("Tạo video YouTube có giọng đọc và phụ đề");
  const second = await workflow.proposeDirectorPlan("Tạo video YouTube có giọng đọc và phụ đề");
  assert.deepEqual(first.steps.map((step) => step.type), second.steps.map((step) => step.type));
  assert.equal(first.source, "local");
  assert.ok(first.steps.some((step) => step.type === "Voice"));
  assert.ok(first.steps.some((step) => step.type === "Video"));
  assert.ok(first.steps.every((step) => step.approved === false));

  let project = workflow.createDefaultProject();
  project.director = first;
  assert.throws(() => workflow.applyDirectorPlan(project), /duyệt/i);
  project = workflow.setDirectorStepApproval(project, first.steps[0].id, true);
  project = workflow.applyDirectorPlan(project);
  assert.equal(project.workflow.nodes.length, 1);
  assert.equal(project.workflow.approvals.publish.approved, false);
});

test("external Director output remains a proposal rather than overwriting workflow", async () => {
  const project = workflow.createDefaultProject();
  const originalGraph = workflow.exportProject(project);
  const proposal = await workflow.proposeDirectorPlan("Campaign launch", { runAI: async () => ({ summary: "Suggested launch pipeline" }) });
  assert.equal(proposal.source, "external-ai");
  assert.match(proposal.summary, /Suggested/);
  assert.equal(workflow.exportProject(project), originalGraph);
  assert.ok(proposal.steps.every((step) => !step.applied));
});

test("prompt variants preserve deterministic fingerprint and complete lineage", () => {
  const draft = { text: "Anime creator in a neon studio", negative: "blur", seed: 138, camera: "Close up", lighting: "Rim light", style: "Anime", references: [{ id: "ref-1", name: "pose.png", type: "image/png", size: 1200 }] };
  const first = workflow.createPromptVariant(draft);
  const same = workflow.createPromptVariant({ style: "Anime", camera: "Close up", seed: 138, negative: "blur", text: "Anime creator in a neon studio", lighting: "Rim light", references: draft.references });
  assert.equal(first.fingerprint, same.fingerprint);
  let project = workflow.addPromptVariant(workflow.createDefaultProject(), first);
  project = workflow.reproduceVariant(project, first.id);
  const child = project.promptStudio.variants.at(-1);
  assert.equal(child.reproducedFrom, first.id);
  assert.equal(child.parentId, first.id);
  assert.equal(child.generation, 1);
  assert.equal(child.fingerprint, first.fingerprint);
  assert.deepEqual(workflow.getVariantLineage(project, child.id).map((item) => item.id), [first.id, child.id]);
});

test("variant comparison is bounded and contains reproducibility metadata", () => {
  let project = workflow.createDefaultProject();
  for (let index = 0; index < 5; index += 1) {
    project = workflow.addPromptVariant(project, workflow.createPromptVariant({ text: `Prompt ${index}`, seed: index }));
  }
  const comparison = workflow.compareVariants(project, project.promptStudio.variants.map((variant) => variant.id));
  assert.equal(comparison.length, 3);
  comparison.forEach((item) => {
    assert.equal(typeof item.fingerprint, "string");
    assert.equal(typeof item.seed, "number");
    assert.equal(typeof item.settings.camera, "string");
  });
});

test("production handoff routes reviewed specs without pretending local metadata is binary", async () => {
  let project = workflow.createDefaultProject();
  project.promptStudio.draft.references = [workflow.fileMeta({ name: "hero.png", type: "image/png", size: 2048 })];
  project = await workflow.runWorkflow(project);
  const handoff = workflow.createProductionHandoff(project);
  assert.equal(handoff.schema, workflow.HANDOFF_SCHEMA);
  assert.equal(handoff.governance.autoPublish, false);
  assert.ok(handoff.stages.some((stage) => stage.type === "Video" && stage.executableOutput));
  assert.ok(handoff.transfers.some((transfer) => transfer.id === "media-design" && transfer.status === "ready"));
  assert.equal(handoff.sourceAssets[0].availability, "metadata-only");
  assert.match(handoff.sourceAssets[0].nextAction, /Relink/);
  assert.doesNotMatch(JSON.stringify(handoff), /data:image|blob:/);
  assert.equal(JSON.parse(workflow.exportProductionHandoff(project)).fingerprint, handoff.fingerprint);
});

test("project import/export validates format, bounds input and sanitizes text", () => {
  const project = workflow.createDefaultProject();
  project.name = "<script>alert(1)</script> Safe project";
  const exported = workflow.exportProject(project);
  const imported = workflow.importProject(exported);
  assert.equal(imported.format, workflow.FORMAT);
  assert.equal(imported.version, 1);
  assert.doesNotMatch(imported.name, /script|alert/);
  assert.throws(() => workflow.importProject(JSON.stringify({ format: "other", version: 1 })), /định dạng/i);
  assert.throws(() => workflow.importProject("x".repeat(2 * 1024 * 1024 + 1)), /2 MB/);
});

test("shared store adapter reads and writes the Creative OS project", () => {
  let state = {};
  const store = {
    getState: () => state,
    setState: (next) => { state = next; }
  };
  const adapter = workflow.createStoreAdapter(store);
  const project = workflow.createDefaultProject();
  const result = adapter.write(project);
  assert.equal(result.shared, true);
  assert.equal(state.creativeAIWorkflow.id, project.id);
  assert.equal(adapter.read().format, workflow.FORMAT);
});

test("local files persist metadata only and browser previews are revoked", () => {
  const meta = workflow.fileMeta({ name: "frame.png", type: "image/png", size: 2048, lastModified: 123 });
  assert.deepEqual({ name: meta.name, type: meta.type, size: meta.size, lastModified: meta.lastModified }, { name: "frame.png", type: "image/png", size: 2048, lastModified: 123 });
  assert.equal(Object.prototype.hasOwnProperty.call(meta, "data"), false);
  [
    "URL.createObjectURL", "URL.revokeObjectURL", "objectUrls.clear()", "metadata asset", "tệp chưa được tải lên mạng"
  ].forEach((contract) => assert.match(source, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")));
});

test("UI contract includes real controls, live status, keyboard support and safe rendering", () => {
  [
    'role="tablist"', 'aria-live="polite"', 'data-hhcaw-action="run-all"',
    'data-hhcaw-action="retry"', 'data-hhcaw-action="approve"', "data-hhcaw-director-form",
    "data-hhcaw-edge-form", "data-hhcaw-remove-edge", "data-hhcaw-prompt-form", "data-hhcaw-prompt-mode",
    "data-hhcaw-asset", "data-hhcaw-reproduce", "data-hhcaw-lineage", 'data-hhcaw-action="export-handoff"',
    "event.ctrlKey", "escapeHtml", "AbortController", "maxlength=\"4000\""
  ].forEach((contract) => assert.match(source, new RegExp(contract)));
  assert.doesNotMatch(source, /\beval\s*\(|new\s+Function\s*\(/);
  assert.doesNotMatch(source, /(AIza[0-9A-Za-z_-]{20,}|mongodb(?:\+srv)?:\/\/|BEGIN PRIVATE KEY)/);
});

test("responsive styling supports 375px, focus visibility and reduced motion", () => {
  [
    "@media (max-width: 420px)", "@media (max-width: 700px)", "focus-visible",
    "prefers-reduced-motion: reduce", "overflow-x: clip", "grid-auto-columns",
    "scrollbar-color", "color-mix"
  ].forEach((contract) => assert.match(styles, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));
  assert.doesNotMatch(styles, /font-size:\s*\d+vw/);
});
