const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Text on Image Studio is routed from the main Tool group", () => {
  const app = read("script.js");
  const loader = read("performance-loader.js");

  assert.match(app, /id: "image-text"[\s\S]*?route: "\/davinci-resolve\/image-text"/);
  assert.match(app, /resolveView === "image-text"[\s\S]*?HHImageTextStudio\?\.mount/);
  assert.match(loader, /image-text-studio\.css\?v=15/);
  assert.match(loader, /vendor\/jszip\.min\.js\?v=3\.10\.1[\s\S]*?image-text-studio\.js\?v=15/);
});

test("studio supports per-image AI text, optional color correction and secure providers", () => {
  const client = read("image-text-studio.js");
  const backend = read("api/modules/[moduleId]/actions.js");
  assert.match(client, /DEFAULT_IMAGE_STYLE/);
  assert.match(client, /data-image-prop="brightness"/);
  assert.match(client, /contactSheet/);
  assert.doesNotMatch(client, /createImageBitmap/);
  assert.match(client, /renderUrl/);
  assert.match(client, /new Image\(\)/);
  assert.match(client, /dataset\.retried/);
  assert.match(client, /\/api\/modules\/image-text\/actions/);
  assert.match(client, /\/api\/search\/youtube/);
  assert.match(client, /published,\s*\n\s*duration/);
  assert.match(client, /image-text-youtube-batch/);
  assert.match(client, /requireProvider:\s*false/);
  assert.match(client, /allowProviderFallback:\s*true/);
  assert.match(client, /local-image-text/);
  assert.match(client, /refreshAiProviderStatus/);
  assert.match(client, /item\.overrides\.title/);
  assert.match(client, /item\.youtubeTitle/);
  assert.match(client, /outputBaseName/);
  assert.match(client, /structuredNames/);
  assert.match(client, /select-count-preset/);
  assert.match(client, /selectFirstImages/);
  assert.match(client, /invert-selection/);
  assert.match(client, /classList\.toggle\("has-images"/);
  assert.match(client, /original}_\$\{youtube}_\$\{imageText/);
  assert.match(client, /requestAnimationFrame/);
  assert.match(client, /Tải toàn bộ ZIP/);
  assert.match(client, /toggle-export-more/);
  assert.match(client, /data-folder-dialog/);
  assert.doesNotMatch(client, /\b(?:alert|confirm|prompt)\s*\(/);
  assert.match(backend, /"image-text"/);
  assert.match(backend, /image-text-batch/);
  assert.match(backend, /imageTextBatchSchema/);
  assert.match(backend, /localImageTextBatchOutput/);
  assert.match(backend, /provider:\s*"local-image-text"/);
  assert.match(backend, /youtubeTitle/);
});

test("studio supports large local batches and paged previews", () => {
  const client = read("image-text-studio.js");

  assert.match(client, /PAGE_SIZE = 60/);
  assert.match(client, /webkitdirectory directory/);
  assert.match(client, /URL\.createObjectURL/);
  assert.match(client, /pruneObjectUrls/);
  assert.match(client, /showDirectoryPicker/);
  assert.match(client, /zipChunk: 100/);
  assert.match(client, /data-export-progress/);
});

test("studio offers simple typography, international fonts, tokens and YouTube outputs", () => {
  const client = read("image-text-studio.js");

  assert.match(client, /Mellow Season/);
  assert.match(client, /Noto Serif KR/);
  assert.match(client, /Noto Serif JP/);
  assert.match(client, /Noto Serif SC/);
  assert.match(client, /Noto Kufi Arabic/);
  assert.match(client, /\{filename\}/);
  assert.match(client, /width: 1280, height: 720/);
  assert.match(client, /width: 1920, height: 1080/);
  assert.match(client, /width: 3840, height: 2160/);
  assert.match(client, /encodeWithinLimit/);
  assert.match(client, /image\/jpeg/);
});

test("studio remains a one-screen workspace with internal scrolling", () => {
  const css = read("image-text-studio.css");

  assert.match(css, /body\.app-image-text-route \.app-page-header/);
  assert.match(css, /height:calc\(100dvh - 122px\)/);
  assert.match(css, /width:100%;height:100%/);
  assert.match(css, /grid-template-rows:54px minmax\(0,1fr\) 62px/);
  assert.match(css, /overflow:hidden/);
  assert.match(css, /\.its-thumb-grid[\s\S]*?overflow-y:auto/);
  assert.match(css, /\.its-inspector[\s\S]*?overflow-y:auto/);
  assert.match(css, /grid-template-columns:minmax\(240px,300px\) minmax\(0,1fr\)/);
  assert.match(css, /@container \(max-width:1100px\)/);
  assert.match(css, /\.its-ai-panel/);
  assert.match(css, /\.its-selection-box/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.its-library\{[\s\S]*?grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /\.its-library>\*\{min-width:0;max-width:100%\}/);
});

test("studio renders preview and export through one fixed design-coordinate pipeline", () => {
  const client = read("image-text-studio.js");

  assert.match(client, /const DESIGN_WIDTH = 1280/);
  assert.match(client, /const DESIGN_HEIGHT = 720/);
  assert.match(client, /<canvas width="1280" height="720" data-preview-canvas/);
  assert.match(client, /drawComposite\(bufferContext, width, height, item, \{ preview: true \}\)/);
  assert.match(client, /drawComposite\(context, preset\.width, preset\.height, item, \{ preview: false \}\)/);
  assert.match(client, /await document\.fonts\?\.ready/);
  assert.match(client, /if \(global\.document\.hidden\) return/);
  assert.match(client, /lastPreviewBuffer = buffer/);
});

test("studio persists validated schema-v2 projects without trusting imported objects", () => {
  const client = read("image-text-studio.js");

  assert.match(client, /PROJECT_SCHEMA_VERSION = 2/);
  assert.match(client, /indexedDB\.open\(PROJECT_DB, 1\)/);
  assert.match(client, /transaction\(PROJECT_STORE, "readwrite"\)/);
  assert.match(client, /function restoreAutosave\(token\)/);
  assert.match(client, /isPlainRecord/);
  assert.match(client, /key !== "__proto__"/);
  assert.match(client, /new Set\(layerOrder\)\.size === 3/);
  assert.match(client, /variants[\s\S]*?sanitizeTemplate/);
});

test("studio exposes real layer, variant, mobile-sheet and cleanup controls", () => {
  const client = read("image-text-studio.js");
  const css = read("image-text-studio.css");

  for (const action of ["layer-visible", "layer-lock", "layer-up", "layer-down", "duplicate-layer", "create-variants", "zoom-fit", "zoom-100", "toggle-grid"]) {
    assert.match(client, new RegExp(`data-action="${action}"`));
  }
  assert.match(client, /Tách nền<\/b><small>Chưa cấu hình/);
  assert.match(client, /eventController\?\.abort\?\.\(\)/);
  assert.match(client, /cancelAnimationFrame\(previewFrame\)/);
  assert.match(client, /db\?\.close\?\.\(\)/);
  assert.match(client, /permissionDialog[\s\S]*?event\.key === "Tab"/);
  assert.match(css, /@media\(max-width:760px\)[\s\S]*?\.its-mobile-tools\{display:grid/);
  assert.match(css, /\.its-app\.show-inspector-sheet \.its-inspector/);
  assert.match(css, /min-height:44px/);
});
