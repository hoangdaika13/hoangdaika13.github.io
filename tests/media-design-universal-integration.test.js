const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("Universal Media Project is reachable from the shell and cached offline", () => {
  const html = read("index.html");
  const loader = read("performance-loader.js");
  const shell = read("script.js");
  const page = read("media-design-page.js");
  const worker = read("sw.js");

  for (const asset of [
    "universal-media-project.css?v=2",
    "universal-media-project.js?v=2",
    "photo-editor-pro.css?v=4",
    "photo-editor-pro.js?v=3",
    "media-professional-suite.css?v=1",
    "media-professional-suite.js?v=3",
    "media-design-page.css?v=21",
    "media-next-suite.css?v=1",
    "vendor/vercel-blob-client.min.js?v=1",
    "media-next-suite.js?v=2",
    "media-design-page.js?v=22",
    "media-audio-studio.css?v=5",
    "media-audio-studio.js?v=3",
    "media-production-universe.css?v=4",
    "media-production-universe.js?v=3"
  ]) {
    const pattern = new RegExp(escapeRegExp(asset));
    assert.match(`${html}\n${loader}`, pattern);
    assert.match(worker, pattern);
  }

  assert.match(worker, /hh-identity-portal-v\d+/);
  assert.match(shell, /id: "universal-media"/);
  assert.match(shell, /id: "asset-manager"/);
  assert.match(shell, /id: "audio-workspace"/);
  assert.match(page, /HHUniversalMediaProject\?\.mount/);
  assert.match(page, /HHUniversalMediaProject\?\.unmount/);
});

test("Media and Design exposes a connected professional production flow", () => {
  const page = read("media-design-page.js");
  const loader = read("performance-loader.js");
  const styles = read("media-design-page.css");

  for (const item of [
    "Universal Project",
    "Photo Editor",
    "Video & Motion Pro",
    "Motion & Vector",
    "Design System",
    "Adaptive Content",
    "Review",
    "Export Center",
    "Controlled AI"
  ]) {
    assert.match(page, new RegExp(escapeRegExp(item)));
  }

  assert.match(page, /data-mdp-flow-tool/);
  assert.match(page, /data-mdp-flow-route/);
  assert.doesNotMatch(page, /id:\s*"video-editor"|name:\s*"Video Editor"/);
  assert.match(page, /availableNames\.has\(saved\.active\)/);
  const mediaBundle = loader.match(/media:\s*\{[\s\S]*?\r?\n\s*\},\r?\n\s*davinci:/)?.[0] || "";
  const davinciBundle = loader.match(/davinci:\s*\{[\s\S]*?\r?\n\s*\},\r?\n\s*graphic:/)?.[0] || "";
  assert.doesNotMatch(mediaBundle, /video-editor-(?:studio|resolve)\.(?:css|js)/);
  assert.match(davinciBundle, /video-editor-studio\.js\?v=5/);
  assert.match(davinciBundle, /video-editor-resolve\.js\?v=11/);
  assert.doesNotMatch(`${page}\n${read("script.js")}\n${read("home-command-search.js")}\n${read("home-daily-command.js")}`, /\/media-design\/video-editor/);
  assert.match(styles, /\.mdp-production-flow/);
  assert.match(styles, /scroll-snap-type/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /Media Production Cockpit/);
  assert.match(page, /STUDIO_SPACES/);
  assert.match(page, /data-mdp-command-open/);
  assert.match(page, /data-mdp-global-import/);
  assert.match(page, /data-mdp-inspector-tab/);
});

test("Professional engines publish stable browser contracts", () => {
  const contracts = [
    ["universal-media-project.js", "HHUniversalMediaProject", /function mount\s*\(/],
    ["photo-editor-pro.js", "HHPhotoEditorPro", /function createProject\s*\(/],
    ["video-editor-resolve.js", "HHVideoEditorResolveOps", /const createProject\s*=/],
    ["media-professional-suite.js", "HHMediaProfessionalSuite", /function mount\s*\(/],
    ["media-next-suite.js", "HHMediaNextSuite", /function mount\s*\(/],
    ["media-production-universe.js", "HHMediaProductionUniverse", /function mount\s*\(/],
    ["graphic-design-adaptive.js", "HHGraphicAdaptive", /function mount\s*\(/],
    ["graphic-design-export-center.js", "HHGraphicExportCenter", /function mount\s*\(/],
    ["graphic-design-review.js", "HHGraphicReview", /function mount\s*\(/],
    ["graphic-design-collaboration.js", "HHGraphicCollaboration", /function mount\s*\(/],
    ["graphic-design-dev-ai.js", "HHGraphicDevAI", /function mount\s*\(/]
  ];

  for (const [file, api, entryPoint] of contracts) {
    const source = read(file);
    assert.match(source, new RegExp(`${api}\\s*=`), `${file} must expose ${api}`);
    assert.match(source, entryPoint, `${file} must expose its documented entry point`);
  }
});
