const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("leaving Support releases its route-specific one-screen layout before loading another workspace", () => {
  const router = read("script.js");
  const helper = router.match(/const releaseSupportLayout = \(route\) => \{[\s\S]*?\n  \};/)?.[0] || "";

  assert.match(helper, /routePathOnly\(route\) === "\/support"/);
  assert.match(helper, /window\.HHSupportPage\?\.unmount\?\.\(\)/);
  assert.match(helper, /document\.body\.classList\.remove\("app-support-route"\)/);
  assert.match(router, /const renderRouteLoading = \(route\) => \{\s*releaseSupportLayout\(route\);/);
  assert.match(router, /releaseSupportLayout\(route\);\s*if \(hasLiveSameRouteWorkspace\(route\)\)/);
});

test("shared mobile chrome preserves readable actions and usable dismiss targets", () => {
  const shell = read("app-shell.css");
  const navigation = read("sidebar-navigation-pro.css");

  assert.match(shell, /@media \(max-width: 760px\)[\s\S]*?\.app-breadcrumb button \{ min-height: 36px; \}/);
  assert.match(shell, /\.app-page-header__actions \{[\s\S]*?overflow-x: auto;[\s\S]*?scroll-snap-type: inline proximity;/);
  assert.match(shell, /\.app-page-header__actions > :is\(button, a\) \{[\s\S]*?flex: 0 0 auto;[\s\S]*?white-space: normal;/);
  assert.match(navigation, /\.app-sidebar__mobile-title>button\{[^}]*width:44px;[^}]*height:44px;[^}]*touch-action:manipulation/);
});

test("Galaxy enhancement assets cannot turn the shared Platform shell into a horizontal row", () => {
  const galaxyHome = read("galaxy-home-ai.css");

  assert.match(
    galaxyHome,
    /#appShell\[data-hh-layer="platform"\]\[data-galaxy-shell\][\s\S]*?> \.app-shell__body > \.app-main \{[\s\S]*?display: flex !important;[\s\S]*?flex-direction: column !important;[\s\S]*?align-items: stretch !important;/
  );
});

test("Comic Motion bounds dense desktop controls inside the mobile workspace", () => {
  const comic = read("comic-motion-studio.css");

  assert.match(comic, /@media \(max-width: 850px\) \{[\s\S]*?\.cms-app \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);[\s\S]*?max-width: 100%;/);
  assert.match(comic, /\.cms-section-nav \{[\s\S]*?overflow-x: auto;[\s\S]*?overscroll-behavior-inline: contain;/);
  assert.match(comic, /@media \(max-width: 520px\) \{[\s\S]*?\.cms-top-actions \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
});

test("Fortune observatory clips decorative geometry without disabling local scrollers", () => {
  const fortune = read("fortune-hub-v5.css");

  assert.match(fortune, /body\.app-fortune-route \.app-workspace,[\s\S]*?\[data-fortune-hub-host\],[\s\S]*?\.fortune-hub \{[\s\S]*?max-width: 100%;[\s\S]*?overflow-x: clip;/);
  assert.match(fortune, /\.fortune-library-controls>nav\{[^}]*overflow-x:auto!important/);
});
