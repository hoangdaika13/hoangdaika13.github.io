const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("application shell uses guided hubs and real route transitions", () => {
  const html = read("index.html");
  const client = read("script.js");
  const css = read("app-shell.css");

  assert.match(html, /id="appRouteProgress"/);
  assert.match(html, /id="appContextBar"/);
  assert.match(client, /document\.startViewTransition/);
  assert.match(client, /const mountModuleHub/);
  assert.match(client, /data-app-hub-search/);
  assert.match(client, /Xem tất cả \$\{submenuCount\} chức năng/);
  assert.match(css, /view-transition-name:app-workspace/);
  assert.match(css, /\.app-module-hub__grid/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});

test("HH English keeps a focused path and moves secondary tools into a searchable map", () => {
  const client = read("english-learning.js");
  const css = read("english-learning.css");

  assert.match(client, /const navigatorGroups =/);
  assert.match(client, /data-hhe-navigator-search/);
  assert.match(client, /data-hhe-navigator-open/);
  assert.match(client, /class="hhe-nav-continue/);
  assert.match(client, /class="hhe-route-dock"/);
  assert.doesNotMatch(client, /<details class="hhe-nav-more"/);
  assert.match(css, /\.hhe-navigator-backdrop/);
  assert.match(css, /\.hhe-route-dock/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});

test("new dynamic assets are cache-busted and available offline", () => {
  const html = read("index.html");
  const worker = read("sw.js");
  for (const asset of ["app-shell.css?v=43", "script.js?v=92", "english-learning.css?v=11", "english-learning.js?v=13", "motion-comfort.css?v=1"]) {
    const pattern = new RegExp(asset.replace(/[.?]/g, "\\$&"));
    assert.match(html, pattern);
    assert.match(worker, pattern);
  }
});
