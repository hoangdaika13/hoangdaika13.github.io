const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("Universal Media Project is reachable from the shell and cached offline", () => {
  const html = read("index.html");
  const shell = read("script.js");
  const page = read("media-design-page.js");
  const worker = read("sw.js");

  for (const asset of [
    "universal-media-project.css?v=1",
    "universal-media-project.js?v=1",
    "photo-editor-pro.css?v=4",
    "photo-editor-pro.js?v=3",
    "video-editor-resolve.css?v=6",
    "video-editor-resolve.js?v=7",
    "media-design-page.css?v=8",
    "media-design-page.js?v=8"
  ]) {
    const pattern = new RegExp(escapeRegExp(asset));
    assert.match(html, pattern);
    assert.match(worker, pattern);
  }

  assert.match(worker, /hh-identity-portal-v\d+/);
  assert.match(shell, /id: "universal-media"/);
  assert.match(shell, /id: "asset-manager"/);
  assert.match(shell, /22 .*Universal Media Project/);
  assert.match(page, /HHUniversalMediaProject\?\.mount/);
  assert.match(page, /HHUniversalMediaProject\?\.unmount/);
});

test("Media and Design exposes a connected professional production flow", () => {
  const page = read("media-design-page.js");
  const styles = read("media-design-page.css");

  for (const item of [
    "Universal Project",
    "Photo Editor",
    "Video Editor",
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
  assert.match(styles, /\.mdp-production-flow/);
  assert.match(styles, /scroll-snap-type/);
  assert.match(styles, /prefers-reduced-motion/);
});

test("Professional engines publish stable browser contracts", () => {
  const contracts = [
    ["universal-media-project.js", "HHUniversalMediaProject", /function mount\s*\(/],
    ["photo-editor-pro.js", "HHPhotoEditorPro", /function createProject\s*\(/],
    ["video-editor-resolve.js", "HHVideoEditorResolveOps", /const createProject\s*=/],
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
