const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const script = fs.readFileSync(path.join(root, "script.js"), "utf8");
const api = fs.readFileSync(path.join(root, "api", "modules", "[moduleId]", "actions.js"), "utf8");
const css = fs.readFileSync(path.join(root, "download-center-pro.css"), "utf8");

test("Download Center exposes a real controlled download workflow", () => {
  for (const marker of ["data-download-source", "data-download-consent", "data-download-config", "data-download-service-note"]) {
    assert.match(script, new RegExp(marker));
  }
  assert.match(script, /sourceKind/);
  assert.match(script, /ownershipConfirmed/);
});

test("download action advertises capability and forwards authorized source scope", () => {
  assert.match(api, /downloadCapabilities/);
  assert.match(api, /ownershipConfirmed !== true/);
  assert.match(api, /sourceKind: downloadCapabilities/);
  assert.match(api, /VIDEO_DOWNLOADER_API_URL/);
});

test("Download Center visual system is responsive and isolated", () => {
  assert.match(css, /\.downloader-pro/);
  assert.match(css, /@media \(max-width:720px\)/);
  assert.match(css, /downloader-main-grid/);
});
