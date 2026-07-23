const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "creative-command-center.js"), "utf8");
const css = fs.readFileSync(path.join(root, "creative-command-center.css"), "utf8");
const core = require(path.join(root, "creative-os-core.js"));
const command = require(path.join(root, "creative-command-center.js"));

function sampleState() {
  return core.normalizeState({
    version: 1,
    activeProjectId: "launch",
    projects: [{
      id: "launch",
      name: "Launch <script>alert(1)</script>",
      brief: { product: "HH Platform", audience: "Creator", platform: "YouTube", deadline: "2030-08-20", goal: "Ra mắt" },
      prompts: [{ id: "p1", title: "Hook", content: "Viết hook" }],
      scripts: [{ id: "s1", title: "Tập 1", content: "Nội dung" }],
      storyboard: [{ id: "shot1", title: "Mở đầu", description: "Logo", duration: 5 }],
      assets: [{ id: "a1", name: "cover.png", type: "image/png", size: 2048 }],
      publishing: [{ id: "pub1", title: "Tập 1", platform: "YouTube", scheduledAt: "2030-08-20T12:00:00.000Z", status: "scheduled" }],
      analytics: { progress: 64, estimatedCost: 0.08 },
      review: { status: "review" }
    }],
    runs: [{ id: "r1", projectId: "launch", provider: "Gemini", action: "script", tokens: 1000, estimatedCost: 0.04 }]
  });
}

test("Command Center exposes mount lifecycle and pure rendering helpers", () => {
  for (const method of ["mount", "unmount", "renderOverview", "renderProject", "calculateMetrics", "projectProgress", "pipelineState", "actionQueue", "escapeHTML"]) {
    assert.equal(typeof command[method], "function", method);
  }
  assert.match(source, /globalScope\.HHCreativeCommandCenter = api/);
  assert.match(source, /options\.store \|\| CreativeCore\.createStore\(\)/);
  assert.match(source, /instances\.set\(root, instance\)/);
  assert.match(source, /instances\.delete\(root\)/);
});

test("overview reports real local metrics and escapes project content", () => {
  const state = sampleState();
  const metrics = command.calculateMetrics(state);
  assert.deepEqual(metrics, { projects: 1, deadlines: 1, assets: 1, publishing: 1, averageProgress: 64, runs: 1, estimatedCost: 0.04 });
  const html = command.renderOverview(state);
  assert.match(html, /Creative Command Center/);
  assert.match(html, /Dự án đang làm/);
  assert.match(html, /Lịch xuất bản/);
  assert.match(html, /Asset gần đây/);
  assert.match(html, /Launch &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /Launch <script>/);
  assert.match(html, /data-quick-create/);
  assert.match(html, /data-project-search/);
  assert.match(html, /data-project-filter/);
});

test("Universal Project renders all seven working tabs and local-first controls", () => {
  const state = sampleState();
  for (const tab of ["brief", "prompt", "script", "storyboard", "assets", "version", "publish"]) {
    const html = command.renderProject(state, { tab });
    assert.match(html, /UNIVERSAL CREATIVE PROJECT/);
    assert.match(html, new RegExp(`data-tab="${tab}"`));
    assert.match(html, /data-action="export"/);
    assert.match(html, /data-action="import"/);
    assert.match(html, /Đã lưu trên thiết bị/);
  }
  assert.match(command.renderProject(state, { tab: "brief" }), /data-project-path="brief\.product"/);
  assert.match(command.renderProject(state, { tab: "prompt" }), /data-collection="prompts"/);
  assert.match(command.renderProject(state, { tab: "script" }), /data-collection="scripts"/);
  assert.match(command.renderProject(state, { tab: "storyboard" }), /data-collection="storyboard"/);
  assert.match(command.renderProject(state, { tab: "assets" }), /data-asset-drop/);
  assert.match(command.renderProject(state, { tab: "version" }), /data-action="snapshot"/);
  assert.match(command.renderProject(state, { tab: "publish" }), /data-publish-form/);
});

test("empty state is honest and does not invent cloud projects or activity", () => {
  const state = core.createDefaultState();
  const overview = command.renderOverview(state);
  const project = command.renderProject(state);
  assert.match(overview, /Chưa có asset/);
  assert.match(overview, /Lịch đang trống/);
  assert.match(project, /Chưa chọn dự án/);
  assert.match(project, /Về tổng quan/);
  assert.doesNotMatch(overview + project, /Đồng bộ cloud|realtime cloud|đã tải lên máy chủ/i);
});

test("project progress derives from content until an explicit progress exists", () => {
  const blank = core.normalizeProject({ name: "Blank" });
  const partial = core.normalizeProject({ name: "Partial", brief: { product: "A", audience: "B", goal: "C" }, prompts: [{ content: "D" }] });
  const explicit = core.normalizeProject({ name: "Explicit", analytics: { progress: 87 } });
  assert.equal(command.projectProgress(blank), 0);
  assert.equal(command.projectProgress(partial), 50);
  assert.equal(command.projectProgress(explicit), 87);
});

test("Creative Launchpad derives an honest pipeline and actionable queue", () => {
  const blank = core.normalizeProject({ name: "Blank" });
  const complete = sampleState().projects[0];
  assert.equal(command.pipelineState(blank).percent, 0);
  assert.equal(command.pipelineState(complete).percent, 100);
  assert.equal(command.pipelineState(complete).completed, 6);
  const actions = command.actionQueue(blank);
  assert.equal(actions[0].tab, "brief");
  assert.ok(actions.length <= 4);
  assert.ok(actions.every((action) => action.tab || action.route));
});

test("Creative Launchpad exposes templates, pipeline navigation, shortcuts and asset intake", () => {
  const html = command.renderOverview(sampleState());
  for (const token of [
    "CREATIVE LAUNCHPAD",
    "data-action=\"create-template\"",
    "data-template=\"youtube-series\"",
    "data-action=\"open-project-tab\"",
    "data-overview-asset-input",
    "Production readiness"
  ]) assert.match(html, new RegExp(token));
  for (const token of ["create-template", "open-project-tab", "open-route", "data-overview-asset-input"]) {
    assert.match(source, new RegExp(token));
  }
  assert.match(source, /event\.key === "\/"/);
  assert.match(source, /event\.key\.toLowerCase\(\) === "n"/);
});

test("UI contract covers autosave, keyboard tabs, drag-drop, import/export, and accessible status", () => {
  for (const token of [
    "queueAutosave", "flushAutosave", "ArrowLeft", "ArrowRight", "dataTransfer?.files",
    "readAsDataURL", "exportProject", "importProject", "aria-live=\"polite\"", "role=\"tablist\""
  ]) assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /event\.ctrlKey \|\| event\.metaKey/);
  assert.doesNotMatch(source, /innerHTML\s*=\s*[^;]*(?:target\.value|data\.get\()/);
});

test("CSS is scoped, responsive at 375px, keyboard visible, and reduced-motion safe", () => {
  assert.match(css, /\.hh-creative-os/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /overflow-x: auto/);
  assert.match(css, /grid-template-columns: 1fr/);
  assert.match(css, /\.cco-launchpad/);
  assert.match(css, /\.cco-pipeline/);
  assert.match(css, /\.cco-template-grid/);
  assert.doesNotMatch(css, /font-size:\s*\d+(?:\.\d+)?vw/);
});

test("mount rejects invalid roots instead of silently failing", () => {
  assert.throws(() => command.mount(null), /root DOM hợp lệ/);
});
