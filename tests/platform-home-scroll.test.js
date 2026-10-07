const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Platform home preserves an outer scroll fallback without replacing the legacy inner catalog scroll", () => {
  const css = read("platform-home.css");
  assert.match(css, /body\.app-platform-home-route \.app-main\s*\{[^}]*overflow-x:\s*hidden;[^}]*overflow-y:\s*auto;/s);
  assert.match(css, /body\.app-platform-home-route \.app-main:has\(\.php\)\s*\{\s*overflow:\s*hidden\s*!important;/s);
});

test("Platform home asset versions stay aligned across loader and service worker", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  assert.match(loader, /platform-home\.css\?v=9/);
  assert.match(worker, /\.\/platform-home\.css\?v=9/);
  const executableHtml = read("index.html").replace(/<!--[\s\S]*?-->/g, "");
  const loaderVersion = executableHtml.match(/src="performance-loader\.js\?v=(\d+)"/)?.[1];
  assert.ok(loaderVersion);
  assert.ok(worker.includes(`"./performance-loader.js?v=${loaderVersion}"`));
});
