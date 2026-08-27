const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Graphic Design is a first-class application section", () => {
  const html = read("index.html");
  const loader = read("performance-loader.js");
  const client = read("script.js");
  const worker = read("sw.js");
  const registeredAssets = `${html}\n${loader}`;
  for (const asset of ["graphic-design-universal.css?v=4", "graphic-design-universal.js?v=5", "graphic-design-studio.css?v=9", "graphic-design-workflow.js?v=2", "graphic-design-animation.js?v=1", "graphic-design-3d.js?v=4", "graphic-design-prototype.js?v=1", "graphic-design-motion.js?v=1", "graphic-design-quick-motion.js?v=1", "graphic-design-mockup.js?v=1", "graphic-design-character.js?v=1", "graphic-design-vector-core.js?v=2", "graphic-design-state-machine.js?v=2", "graphic-design-adaptive.js?v=2", "graphic-design-project-store.js?v=2", "graphic-design-collaboration.js?v=2", "graphic-design-dev-ai.js?v=2", "graphic-design-composer.js?v=2", "graphic-design-studio.js?v=9"]) {
    assert.match(registeredAssets, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(worker, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(worker, /vendor\/three\.module\.min\.js/);
  assert.match(worker, /vendor\/three\.core\.min\.js/);
  assert.match(client, /id: "graphic-design"/);
  assert.match(client, /route: "\/graphic-design"/);
  assert.match(client, /data-graphic-design-host/);
  assert.match(client, /HHGraphicDesign\?\.mount/);
  assert.match(client, /const graphicDesignPages = groups\.find/);
  assert.match(client, /crumbs\[0\] === "graphic-design" \? graphicDesignPages/);
  assert.match(client, /\/graphic-design\/quick-motion/);
  assert.match(client, /\/graphic-design\/mockup/);
  assert.match(client, /"quick-motion": "Motion Maker"/);
  assert.match(client, /mockup: "3D Device Mockup"/);
  for (const route of ["vector", "state-machine", "adaptive", "projects", "collaboration", "dev-ai", "composer"]) {
    assert.match(client, new RegExp(`/graphic-design/${route}`));
  }
});

test("Graphic Design Studio mounts and unmounts the Universal Design engine", () => {
  const studio = read("graphic-design-studio.js");

  assert.match(studio, /HHGraphicDesignUniversal\?\.mount\?\.\(root, options\)/);
  assert.match(studio, /HHGraphicDesignUniversal\?\.unmount\?\.\(activeRoot\)/);
  assert.match(studio, /designDocumentController:\s*universalController/);
  assert.match(studio, /universalController\?\.dispatch\?\.\("add-asset"/);
  assert.match(studio, /universalController\?\.dispatch\?\.\("set-brand-token"/);
});

test("Graphic Design tool routes keep one scroll owner and a compact context bar", () => {
  const client = read("script.js");
  const studio = read("graphic-design-studio.js");
  const css = read("graphic-design-studio.css");

  assert.match(client, /classList\.toggle\("app-graphic-design-tool-route", route\.startsWith\("\/graphic-design\/"\)\)/);
  assert.match(studio, /class="gd-tool-context"/);
  assert.match(studio, /dataset\.gdView = view/);
  assert.match(css, /body\.app-graphic-design-route #appMain[\s\S]*?overflow-y:\s*auto\s*!important/);
  assert.match(css, /body\.app-graphic-design-tool-route \.app-page-header,[\s\S]*?\.app-context-bar[\s\S]*?display:\s*none\s*!important/);
  assert.match(css, /\.gd-tool-context\s*\{[\s\S]*?min-height:\s*64px/);
  assert.match(css, /\.gd-tool-context__status\s*\{[\s\S]*?display:\s*none\s*!important/);
  assert.doesNotMatch(css, /body\.app-graphic-design-route #appMain[\s\S]{0,160}?overflow:\s*(?:hidden|clip)/);
});
