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
  assert.match(loader, /image-text-studio\.css\?v=3/);
  assert.match(loader, /vendor\/jszip\.min\.js\?v=3\.10\.1[\s\S]*?image-text-studio\.js\?v=3/);
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
  assert.match(css, /height:calc\(100dvh - 106px\)/);
  assert.match(css, /width:100%;height:100%/);
  assert.match(css, /grid-template-rows:58px minmax\(0,1fr\) 68px/);
  assert.match(css, /overflow:hidden/);
  assert.match(css, /\.its-thumb-grid[\s\S]*?overflow-y:auto/);
  assert.match(css, /\.its-inspector[\s\S]*?overflow-y:auto/);
});
