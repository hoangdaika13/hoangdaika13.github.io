const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const layer = require("../galaxy-layer-one.js");
const read = file => fs.readFileSync(path.join(__dirname,"..",file),"utf8");
const css = read("galaxy-premium-workspaces.css");

test("all eleven function workspaces receive distinct readable palettes",()=>{
  const routes=layer.routes.filter(route=>route.startsWith("/galaxy/"));
  assert.equal(routes.length,11);
  for(const route of routes){
    assert.ok(css.includes(`[data-route="${route}"]`),route);
    assert.ok(layer.viewMarkup(route,{},{}).includes(`data-route="${route}"`));
  }
  assert.equal((css.match(/--atelier-accent:#[a-f0-9]{6}; --atelier-secondary:/g)||[]).length,11);
});

test("polish is isolated from the stable navigation, Home and Platform layer",()=>{
  assert.doesNotMatch(css,/\.php\b|\.gha-home\b|data-route="\/home"|\.app-main\b|\.hgl1-sidebar\b|\.hgl1-topbar\b|\.hgl1-mobile-nav\b/);
  assert.doesNotMatch(css,/position:fixed|overflow-y:hidden|overflow:hidden|height:100dvh|url\(/);
  // Every ordinary rule begins with the Layer One function route boundary.
  for(const line of css.split("\n")){
    if(line.trimStart().startsWith(".")) assert.ok(line.trimStart().startsWith('.hh-galaxy-app[data-route'),line);
  }
});

test("input targets, native media and artwork preserve accessible behavior",()=>{
  assert.match(css,/min-height:44px/);
  assert.match(css,/font-size:16px; max-width:100%; min-width:0/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/forced-colors:active/);
  assert.match(css,/data-contrast=high/);
  assert.match(css,/data-theme=midnight/);
  assert.match(css,/pointer-events:none/);
  assert.match(css,/button--danger/);
  assert.match(css,/portal-card--unconfigured/);
});

test("all major editing surfaces and dedicated Creator renderer are covered",()=>{
  for(const className of ["hgl1-ai-workspace","hgl1-media-workspace","hgl1-game-workspace","hgl1-dev-workspace","hgl1-community-workspace","hgl1-tool__output","hgl1-metric-grid","hgl1-settings-card","hgl1-learning-deck","gcs-pipeline-panel","gcs-project-card","gcs-tools-grid"]){
    assert.ok(css.includes(`.${className}`),className);
  }
  assert.match(css,/gcs-pipeline__item:nth-child\(3n\+2\)/);
  assert.match(css,/@container atelier-creator \(max-width:1100px\)/);
  assert.match(css,/gcs-dashboard__main \{ grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css,/hgl1-document--template/);
});

test("premium CSS loads after stable chrome and is catalogued offline exactly once",()=>{
  const loader=read("performance-loader.js"), worker=read("sw.js");
  const block=loader.slice(loader.indexOf('"galaxy-layer-one":'),loader.indexOf('"galaxy-domain-views":'));
  assert.ok(block.indexOf("galaxy-premium-workspaces.css?v=2")>block.indexOf("galaxy-stable-chrome.css"));
  assert.equal((worker.match(/"\.\/galaxy-premium-workspaces\.css\?v=2"/g)||[]).length,1);
  const executableHtml=read("index.html").replace(/<!--[\s\S]*?-->/g,"");
  assert.doesNotMatch(executableHtml,/href="galaxy-premium-workspaces/);
});
