const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const galaxy = require(path.join(root, "creative-galaxy.js"));

test("Creative Galaxy exposes six real clusters, LIVE widgets, themes and presets", () => {
  assert.equal(galaxy.VERSION, "1.0.0");
  assert.equal(galaxy.CLUSTERS.length, 6);
  assert.equal(galaxy.CLUSTERS.flatMap((cluster) => cluster.tools).length, 25);
  assert.equal(galaxy.WIDGETS.length, 8);
  assert.equal(galaxy.THEMES.length, 13);
  assert.equal(galaxy.PRESETS.length, 6);
  assert.deepEqual(galaxy.CLUSTERS.map((cluster) => cluster.id), [
    "command", "idea", "preproduction", "production", "workflow", "publish"
  ]);
});

test("Creative LIVE ORBIT derives values from Universal Project without fake data", () => {
  const empty = galaxy.snapshot({ projects: [], runs: [] });
  assert.equal(empty.widgets.project.value, "Chưa có dự án");
  assert.equal(empty.widgets.ai.value, "Chưa có hoạt động");
  assert.equal(empty.widgets.provider.value, "Chưa cấu hình");
  assert.equal(empty.rightsCount, 0);

  const now = new Date().toISOString();
  const state = {
    activeProjectId: "project-one",
    projects: [{
      id: "project-one",
      name: "Campaign thật",
      brief: { goal: "Ra mắt", deadline: now },
      prompts: [{ id: "p1" }],
      scripts: [{ id: "s1" }],
      storyboard: [{ id: "shot1" }],
      assets: [{ id: "a1", name: "hero.png", kind: "image", license: "", createdAt: now }],
      versions: [],
      world: { characters: [{ id: "c1" }], locations: [] },
      workflows: { nodes: [{ id: "n1" }] },
      brand: { colors: ["#fff"], logos: [] },
      review: { status: "review", comments: [{ id: "c1", text: "Sửa frame 12", read: false }] },
      publishing: [{ id: "pub1", platform: "Website", status: "scheduled", scheduledAt: now }],
      analytics: { progress: 60 },
      rights: { warnings: [{ message: "Thiếu nguồn" }], verified: false },
      updatedAt: now
    }],
    runs: [
      { id: "r1", projectId: "project-one", status: "running", provider: "gemini", latencyMs: 120, estimatedCost: 0.2, createdAt: now },
      { id: "r2", projectId: "project-one", status: "failed", provider: "gemini", latencyMs: 240, estimatedCost: 0.1, createdAt: now }
    ]
  };
  const result = galaxy.snapshot(state);
  assert.equal(result.progress, 60);
  assert.equal(result.pendingRuns.length, 1);
  assert.equal(result.failedRuns.length, 1);
  assert.equal(result.unread.length, 1);
  assert.equal(result.pendingPublishing.length, 1);
  assert.equal(result.providers[0], "gemini");
  assert.equal(result.averageLatency, 180);
  assert.equal(result.rightsCount, 2);
});

test("Creative personalization limits pinned workspaces and presets change real layout", () => {
  const toolIds = galaxy.CLUSTERS.flatMap((cluster) => cluster.tools.map((tool) => tool[0]));
  const normalized = galaxy.normalizePrefs({ pinnedTools: toolIds, motion: "invalid" });
  assert.equal(normalized.pinnedTools.length, 6);
  assert.equal(normalized.motion, "balanced");
  const focus = galaxy.applyPreset(normalized, "focus");
  assert.equal(focus.preset, "focus");
  assert.equal(focus.motion, "minimal");
  assert.ok(focus.hiddenTools.length > 0);
  assert.ok(focus.hiddenWidgets.length > 0);
});

test("Creative Galaxy UI contracts include focus, semantic effects and mobile support", () => {
  const source = read("creative-galaxy.js");
  const css = read("creative-galaxy.css");
  for (const contract of [
    "CREATIVE LIVE ORBIT", "CREATIVE GALAXY COMMAND CENTER", "Universal Project",
    "data-cg-focus", "data-cg-settings-panel", "hh:creative-project-change",
    "hh.creative.retry.pending.v1", "requestAnimationFrame", "document.hidden"
  ]) assert.match(source, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const contract of [
    ".cg-sun", ".cg-cluster", ".cg-focus", ".cg-settings", ".cg-mini",
    "prefers-reduced-motion", "app-creative-route", "bottom:10px"
  ]) assert.match(css, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(source, /\b(mock|fake|demoData)\b/i);
});

test("Creative project event bus and AI Center bridge share the existing project store", () => {
  const core = read("creative-os-core.js");
  const shell = read("creative-os.js");
  const ai = read("ai-center-advanced.js");
  const script = read("script.js");
  assert.match(core, /hh:creative-project-change/);
  assert.match(shell, /data-cos-galaxy/);
  assert.match(shell, /HHCreativeGalaxy\.mount/);
  assert.match(ai, /bridgeRunToCreative/);
  assert.match(ai, /data-aica-save-project="brief"/);
  assert.match(ai, /data-aica-save-project="media"/);
  assert.match(script, /app-creative-route/);
});

test("Creative Galaxy assets are versioned and precached", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const html = read("index.html");
  for (const asset of [
    "creative-galaxy.css?v=3", "creative-galaxy.js?v=4", "creative-star-map.css?v=2",
    "creative-star-map.js?v=2", "creative-os-core.js?v=4", "creative-os.js?v=6", "ai-center-advanced.js?v=2"
  ]) {
    const pattern = new RegExp(asset.replace(/[.?]/g, "\\$&"));
    assert.match(`${loader}\n${worker}`, pattern);
  }
  assert.match(worker, /hh-identity-portal-v257/);
  assert.match(html, /performance-loader\.js\?v=45/);
  assert.match(html, /script\.js\?v=139/);
});
