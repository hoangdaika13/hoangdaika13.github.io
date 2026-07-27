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
  assert.match(client, /const submenu = expanded \? fullSubmenu : ""/);
  assert.match(client, /--route-accent/);
  assert.match(client, /data-nav-label/);
  assert.match(client, /crumbRoute \+=/);
  assert.match(client, /event\.key === "\/"/);
  assert.doesNotMatch(client, /compactStudioItems|compactModuleItems|Xem tất cả \$\{submenuCount\} chức năng/);
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

test("expanded major sections expose every nested module without clipping", () => {
  const css = read("sidebar-navigation-pro.css");

  assert.match(css, /Sidebar overflow recovery v3/);
  assert.match(css, /\.app-sidebar__group\.is-expanded>\.app-sidebar__submenu[\s\S]*?max-height:none!important/);
  assert.match(css, /\.app-sidebar__group\.is-expanded>\.app-sidebar__submenu[\s\S]*?overflow:visible!important/);
  assert.match(css, /\.app-sidebar__group\.is-expanded \.app-sidebar__studio>div[\s\S]*?max-height:none!important/);
  assert.match(css, /\.app-sidebar__page-section\.is-open>\.app-sidebar__page-section-items[\s\S]*?overflow:visible!important/);
  assert.match(css, /padding-bottom:max\(32px,env\(safe-area-inset-bottom\)\)!important/);
});

test("major navigation groups use the shared cosmic planet treatment", () => {
  const css = read("sidebar-navigation-pro.css");

  assert.match(css, /Cosmic primary navigation v1/);
  assert.match(css, /\.app-sidebar::after[\s\S]*?background-image:/);
  assert.match(css, /\.app-sidebar__group>\.app-sidebar__item>span:first-child::before[\s\S]*?border-radius:50%/);
  assert.match(css, /\.app-sidebar__group>\.app-sidebar__item>span:first-child::after[\s\S]*?background:var\(--nav-accent\)/);
  assert.match(css, /\.app-sidebar__subitem:not\(\.app-sidebar__subitem--search\)/);
  assert.match(css, /\.app-sidebar__studio-item>span::after[\s\S]*?scaleY\(\.38\)/);
});

test("new dynamic assets are cache-busted and available offline", () => {
  const html = read("index.html");
  const worker = read("sw.js");
  for (const asset of ["app-shell.css?v=52", "script.js?v=143", "sidebar-navigation-pro.css?v=8", "english-learning.css?v=11", "english-learning.js?v=16", "motion-comfort.css?v=1"]) {
    const pattern = new RegExp(asset.replace(/[.?]/g, "\\$&"));
    assert.match(html, pattern);
    assert.match(worker, pattern);
  }
});
