"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "script.js"), "utf8");

test("route changes dismiss transient top-layer UI before mounting the next workspace", () => {
  assert.match(source, /const dismissRouteTransientLayers = \(\) =>/);
  assert.match(source, /document\.querySelectorAll\("dialog\[open\]"\)/);
  assert.match(source, /dialog\.dispatchEvent\(new Event\("cancel", \{ cancelable: true \}\)\)/);
  assert.match(source, /if \(dialog\.open\) dialog\.close\("cancel"\)/);
  assert.match(source, /themePanel\?\.classList\.remove\("is-open"\)/);
  assert.match(source, /window\.HHSearchWatch\?\.close\?\.\(\)/);
  assert.match(source, /if \(mobileSidebarQuery\.matches\) \{[\s\S]{0,180}?classList\.add\("app-sidebar-collapsed"\)[\s\S]{0,120}?syncMobileSidebarDock\(\)/);
  assert.match(source, /if \(renderedRoute && normalized !== renderedRoute\) dismissRouteTransientLayers\(\)/);
});

test("route cleanup preserves persistent privacy and call surfaces", () => {
  const cleanup = source.match(/const dismissRouteTransientLayers = \(\) => \{[\s\S]*?\n  \};/)?.[0] || "";
  assert.ok(cleanup, "route layer cleanup must remain inspectable");
  assert.doesNotMatch(cleanup, /appPrivacyShield|app-privacy-shield|hh-call-stage|data-hh-call-stage/);
});
