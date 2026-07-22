const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const engines = [
  ["creative-command-center.js?v=1", "HHCreativeCommandCenter"],
  ["creative-preproduction.js?v=1", "HHCreativePreproduction"],
  ["creative-ai-workflow.js?v=2", "HHCreativeAIWorkflow"],
  ["creative-production-lab.js?v=1", "HHCreativeProductionLab"],
  ["creative-collaboration-os.js?v=1", "HHCreativeCollaborationOS"],
  ["creative-publishing.js?v=1", "HHCreativePublishing"],
  ["creative-marketplace.js?v=1", "HHCreativeMarketplace"]
];

test("Creative OS shell is routed, versioned and cached", () => {
  const html = read("index.html");
  const script = read("script.js");
  const shell = read("creative-os.js");
  const worker = read("sw.js");
  assert.match(html, /creative-os\.css\?v=1/);
  assert.match(html, /creative-os\.js\?v=1/);
  assert.match(html, /script\.js\?v=124/);
  assert.match(worker, /hh-identity-portal-v\d+/);
  assert.match(worker, /creative-os-core\.js\?v=1/);
  assert.match(script, /creativeOSViews/);
  assert.match(script, /routeParts\[0\] === "create" && creativeOSViews\.has\(routeParts\[1\]\)/);
  assert.match(script, /window\.HHCreativeOS\.mount/);
  assert.match(shell, /loadScript\("creative-os-core\.js\?v=1"\)/);
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

test("Creative OS client assets contain no obvious credentials or dynamic code execution", () => {
  for (const file of ["creative-os.js", "creative-os-core.js"]) {
    const source = read(file);
    assert.doesNotMatch(source, /AIza|AQ\.|sk-[A-Za-z0-9]|BEGIN PRIVATE KEY|mongodb(?:\+srv)?:\/\//i);
    assert.doesNotMatch(source, /eval\(|new Function/);
  }
});

test("Creative OS AI tasks use the server-side Gemini provider without exposing keys", () => {
  const script = read("script.js");
  const actionsApi = read("api/modules/[moduleId]/actions.js");
  assert.match(actionsApi, /creativeModules = new Set\([^\n]+"creative-os"/);
  assert.match(actionsApi, /"creative-os": "Đóng vai creative director/);
  assert.match(script, /creativeAIRequest\("creative-os", payload, actionType, meta\)/);
  assert.doesNotMatch(script, /GEMINI_API_KEY\s*[:=]\s*["'][^"']+/);
});
