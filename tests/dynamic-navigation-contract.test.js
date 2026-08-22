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
  assert.match(client, /const renderNavigation = \(\) =>/);
  assert.match(client, /const navigationSections =/);
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
  assert.match(client, /class="hhe-nav-learning/);
  assert.match(client, /data-hhe-nav-toggle/);
  assert.match(client, /class="hhe-route-dock"/);
  assert.doesNotMatch(client, /<details class="hhe-nav-more"/);
  assert.match(css, /\.hhe-navigator-backdrop/);
  assert.match(css, /\.hhe-route-dock/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});

test("HH English exposes the cosmic vocabulary galaxy and all practice modes", () => {
  const client = read("english-learning.js");
  const galaxy = read("english-galaxy.js");
  const css = read("english-galaxy.css");

  assert.match(client, /data-hhe-galaxy-start/);
  assert.match(client, /data-hhe-galaxy-challenge/);
  assert.match(client, /galaxyTopic/);
  assert.match(galaxy, /const learningModes = Object\.freeze/);
  assert.match(galaxy, /picture-vocabulary/);
  assert.match(galaxy, /const targets = Object\.freeze/);
  assert.match(css, /\.hhe-galaxy-hero/);
  assert.match(css, /\.hhe-mode-orbit/);
  assert.match(css, /prefers-reduced-motion/);
});

test("primary navigation is grouped into focused categories with one open section", () => {
  const client = read("script.js");
  const css = read("sidebar-navigation-pro.css");

  assert.match(client, /const navigationSections =/);
  for (const label of ["AI & Sáng tạo", "Web & Cộng đồng", "Giải trí & Nội dung", "Công việc & Công nghệ", "Học tập & Ngôn ngữ", "Quản trị & Hệ thống"]) {
    assert.match(client, new RegExp(label.replace(/[&]/g, "\\&")));
  }
  assert.match(client, /saveOpenNavigationSection\(openNavigationSection === sectionId \? "" : sectionId\)/);
  assert.match(client, /navigationSectionForRoute\(route\)/);
  assert.match(css, /\.app-sidebar__category\.is-expanded>\.app-sidebar__submenu\{max-height:380px/);
  assert.match(css, /\.app-sidebar__primary[\s\S]*?overflow-y:auto/);
  assert.match(css, /@media\(max-width:760px\)[\s\S]*?translateY\(105%\)/);
});

test("category navigation supports search, pins, reordering and restrained cosmic motion", () => {
  const client = read("script.js");
  const css = read("sidebar-navigation-pro.css");

  assert.match(client, /data-sidebar-search/);
  assert.match(client, /data-sidebar-pin/);
  assert.match(client, /slice\(0, 5\)/);
  assert.match(client, /data-pinned-route/);
  assert.match(client, /data-sidebar-pins-toggle/);
  assert.match(client, /readSidebarRecent/);
  assert.match(client, /readSidebarFavorites/);
  assert.match(client, /readHiddenSidebarRoutes/);
  assert.match(client, /data-sidebar-restore-hidden/);
  assert.match(client, /sidebarSearchAliases/);
  assert.match(client, /data-sidebar-menu-action="new-tab"/);
  assert.match(client, /data-sidebar-menu-action="hide"/);
  assert.match(client, /saveSidebarItemOrder/);
  assert.match(client, /data-tool-motion/);
  assert.match(client, /data-nav-section/);
  assert.match(client, /dragstart/);
  assert.match(client, /Alt\+ArrowUp Alt\+ArrowDown/);
  assert.match(css, /\.app-sidebar::after[\s\S]*?background-image:/);
  assert.match(css, /\.app-sidebar__section-orb[\s\S]*?border-radius:50%/);
  assert.match(css, /\.app-sidebar__category\.is-expanded \.app-sidebar__section-orb\{animation:/);
  assert.doesNotMatch(css, /^\.app-sidebar__section-orb\{[^}]*animation:/m);
  assert.match(css, /--sidebar-width:284px/);
  assert.match(css, /--sidebar-collapsed-width:72px/);
  assert.match(css, /\.app-sidebar__scroll-region[\s\S]*?overflow-y:auto/);
  assert.match(css, /\.app-sidebar__flyout/);
  assert.match(css, /\.app-sidebar-context-menu/);
  assert.match(css, /\.app-sidebar-pin-flight/);
  assert.match(css, /body\.app-shell-enabled \.app-mobile-nav\{display:grid!important/);
  assert.match(css, /@media\(max-width:390px\)\{\.app-sidebar\{height:min\(82dvh,720px\)!important/);
  assert.match(css, /-webkit-line-clamp:2/);
  assert.match(css, /hh-sidebar-ai-stars/);
  assert.match(css, /hh-sidebar-web-signal/);
  assert.match(css, /hh-sidebar-solar-flare/);
  assert.match(css, /hh-sidebar-data-grid/);
  assert.match(css, /hh-sidebar-constellation/);
  assert.match(css, /hh-sidebar-radar/);
  assert.match(css, /hh-sidebar-home-beacon/);
  assert.match(css, /hh-sidebar-footer-energy/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});

test("every route gets a shared cosmic loading state with progress and fallback", () => {
  const html = read("index.html");
  const client = read("script.js");
  const css = read("app-shell.css");

  assert.match(html, /id="appCosmicLoader"/);
  assert.match(html, /data-cosmic-loader-step/);
  assert.match(client, /const describeRouteFeedback =/);
  assert.match(client, /window\.HHCosmicRouteLoader/);
  assert.match(client, /hh:assets-loading/);
  assert.match(client, /finishCosmicRouteLoader\(\{ error: true/);
  assert.match(css, /\.app-cosmic-loader\.is-active/);
  assert.match(css, /@keyframes appCosmicTunnel/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)[\s\S]*?app-cosmic-loader__space/);
});

test("new dynamic assets are cache-busted and available offline", () => {
  const html = read("index.html");
  const worker = read("sw.js");
  for (const asset of ["app-shell.css?v=55", "script.js?v=215", "sidebar-navigation-pro.css?v=23", "english-learning.css?v=17", "english-galaxy.css?v=1", "english-galaxy.js?v=2", "english-learning-galaxy.css?v=6", "english-learning-galaxy.js?v=5", "english-vocabulary.css?v=1", "english-vocabulary.js?v=2", "english-for-everyone.css?v=1", "english-for-everyone.js?v=2", "english-learning.js?v=28", "motion-comfort.css?v=1"]) {
    const pattern = new RegExp(asset.replace(/[.?]/g, "\\$&"));
    assert.match(html, pattern);
    assert.match(worker, pattern);
  }
});
