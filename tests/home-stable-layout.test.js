const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const layer = require("../galaxy-layer-one.js");
const read = file => fs.readFileSync(path.join(__dirname,"..",file),"utf8");
test("all twelve Layer One routes start with identical persistent reference chrome",()=>{
  const pages = layer.routes.map(route=>layer.viewMarkup(route,{},{}));
  const sidebars = pages.map(html=>html.match(/<aside class="hgl1-sidebar"[\s\S]*?<\/aside>/)[0].replace(/aria-current="(?:page|false)"/g,'aria-current="x"'));
  sidebars.forEach(sidebar=>assert.equal(sidebar,sidebars[0]));
  pages.forEach(html=>assert.match(html,/hgl1-fixed-brand/));
  const home=pages[0];
  assert.match(home,/data-hh-galaxy-home-host/);
  assert.doesNotMatch(home,/hgl1-world-hero|Thông tin Trang chủ/);
});
test("Home no longer bypasses the persistent Layer One owner",()=>{
  const router=read("script.js");
  const owner=router.slice(router.indexOf("const isGalaxyLayerOneRoute ="),router.indexOf("const isGalaxyDomainRoute ="));
  assert.doesNotMatch(owner,/routePath !== "\/home"/);
  assert.match(owner,/isGalaxyHomeRoute = galaxyViewsEnabled && !isGalaxyLayerOneRoute/);
  assert.match(read("performance-loader.js"),/if \(value === "\/home"\) return \["galaxy-layer-one", "galaxy-home-ai"\]/);
  assert.match(router,/syncLiveGalaxyLayerOneRoute\(route\)/);
});
test("Platform owns a bounded scrolling viewport even within locked or fullscreen parents",()=>{
  const css=read("platform-home.css"), js=read("platform-home.js");
  assert.match(css,/height:var\(--php-viewport-height/);
  assert.match(css,/overflow-x:clip; overflow-y:auto/);
  assert.match(css,/\.php:fullscreen[^}]+overflow-y:auto !important/);
  assert.match(js,/scroller = root/);
  assert.match(js,/fullscreenchange", sizeViewport/);
  assert.match(js,/viewportObserver\?\.disconnect/);
  assert.doesNotMatch(js,/style\.setProperty\("overflow.*hidden/);
});
test("reference chrome does not move links and releases motion for accessibility",()=>{
  const css=read("galaxy-stable-chrome.css");
  assert.match(css,/--hgl1-sidebar-w:288px/);
  assert.match(css,/hgl1-shell \{ display:contents/);
  assert.match(css,/grid-template-rows:76px minmax\(0,1fr\)/);
  assert.match(css,/hgl1-nav__link[^}]+transform:none/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(read("sw.js"),/galaxy-stable-chrome.css\?v=3/);
});
