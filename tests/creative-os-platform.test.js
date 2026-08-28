const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const engines = [
  ["creative-command-center.js?v=2", "HHCreativeCommandCenter"],
  ["creative-preproduction.js?v=1", "HHCreativePreproduction"],
  ["creative-ai-workflow.js?v=3", "HHCreativeAIWorkflow"],
  ["creative-production-lab.js?v=1", "HHCreativeProductionLab"],
  ["creative-collaboration-os.js?v=2", "HHCreativeCollaborationOS"],
  ["creative-publishing.js?v=1", "HHCreativePublishing"],
  ["creative-marketplace.js?v=1", "HHCreativeMarketplace"]
];

test("Creative OS shell is routed, versioned and cached", () => {
  const html = read("index.html");
  const loader = read("performance-loader.js");
  const script = read("script.js");
  const shell = read("creative-os.js");
  const worker = read("sw.js");
  const registeredAssets = `${html}\n${loader}`;
  assert.match(registeredAssets, /creative-os\.css\?v=7/);
  assert.match(registeredAssets, /creative-os\.js\?v=\d+/);
  assert.match(html, /script\.js\?v=\d+/);
  assert.match(worker, /hh-identity-portal-v\d+/);
  assert.match(worker, /creative-os-core\.js\?v=4/);
  assert.match(script, /creativeOSViews/);
  assert.match(script, /routeParts\[0\] === "create" && creativeOSViews\.has\(routeParts\[1\]\)/);
  assert.match(script, /window\.HHCreativeOS\.mount/);
  assert.match(shell, /loadScript\("creative-os-core\.js\?v=4"\)/);
  for (const [asset, api] of engines) {
    assert.match(worker, new RegExp(asset.replace(/[.?]/g, "\\$&")));
    assert.match(shell, new RegExp(asset.replace(/[.?]/g, "\\$&")));
    assert.match(shell, new RegExp(api));
    assert.doesNotMatch(html, new RegExp(asset.replace(/[.?]/g, "\\$&")));
  }
});

test("Creative OS keeps existing tools and adds all requested routes", () => {
  const script = read("script.js");
  for (const id of ["ai-center", "ai-script", "creator-studio", "media-center", "ai-automation", "overview", "project", "brief", "moodboard", "storyboard", "world-bible", "workflow", "ai-director", "prompt-studio", "repurpose", "brand", "audio-dubbing", "prototype", "review", "collaboration", "publishing", "analytics", "rights", "providers", "marketplace"]) {
    assert.match(script, new RegExp(`id: ["']${id}["']`));
  }
});

test("Creative OS provides real project actions and a motion-safe living universe", () => {
  const shell = read("creative-os.js");
  const css = read("creative-os.css");
  for (const contract of ["importProject(file", "snapshotProject()", "exportProject()", "createProject", "capabilityAudit", "data-cos-readiness-panel", "data-cos-toast", "data-cos-journey", "data-cos-action-panel", "guideWorkspace(step)"]) {
    assert.match(shell, new RegExp(contract.replace(/[()]/g, "\\$&")));
  }
  for (const visual of ["creative-os__cosmos", "creative-os__glyphs", "creative-os__journey", "cos-star-drift", "cos-nebula", "cos-orbit", "cos-comet", "cos-pulsar", "cos-workspace-enter", "cos-active-breathe", "prefers-reduced-motion"]) {
    assert.match(css, new RegExp(visual));
  }
});

test("Creative OS client assets contain no obvious credentials or dynamic code execution", () => {
  for (const file of ["creative-os.js", "creative-os-core.js"]) {
    const source = read(file);
    assert.doesNotMatch(source, /AIza|AQ\.|sk-[A-Za-z0-9]|BEGIN PRIVATE KEY|mongodb(?:\+srv)?:\/\//i);
    assert.doesNotMatch(source, /eval\(|new Function/);
  }
});

test("Creative OS AI tasks use server-side OpenAI/Gemini failover without exposing keys", () => {
  const script = read("script.js");
  const actionsApi = read("api/modules/[moduleId]/actions.js");
  assert.match(actionsApi, /creativeModules = new Set\([^\n]+"creative-os"/);
  assert.match(actionsApi, /"creative-os": "Đóng vai creative director/);
  assert.match(script, /creativeAIRequest\("creative-os", payload, actionType, \{/);
  assert.match(script, /requireProvider: true/);
  assert.match(actionsApi, /creativeProviderOrder\(meta\)/);
  assert.doesNotMatch(script, /GEMINI_API_KEY\s*[:=]\s*["'][^"']+/);
  assert.doesNotMatch(script, /OPENAI_API_KEY\s*[:=]\s*["'][^"']+/);
});
