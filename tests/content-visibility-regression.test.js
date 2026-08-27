"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("legacy communication modules use the shell page scroller", () => {
  const css = read("communication-workspace-fix.css");
  assert.match(css, /body\.app-communication-route\.app-single-module \.app-main\s*\{[\s\S]*?overflow-y:\s*auto\s*!important/);
  assert.match(css, /body\.app-communication-route\.app-single-module #appWorkspace\s*\{[\s\S]*?height:\s*auto\s*!important[\s\S]*?overflow:\s*visible\s*!important/);
});

test("feature and fortune cards expand instead of clipping their descriptions", () => {
  const featureCss = read("workspace-feature-explorer.css");
  const fortuneCss = read("fortune-hub-v5.css");
  assert.match(featureCss, /\.app-module-hub--cosmic \.app-module-hub__grid p\s*\{[^}]*display:\s*block[^}]*overflow:\s*visible/);
  assert.match(fortuneCss, /\.fortune-home-status-grid p\s*\{[^}]*display:block[^}]*overflow:visible[^}]*overflow-wrap:anywhere/);
});

test("language cockpit labels wrap while animated decoration stays contained", () => {
  const css = read("language-learning-cockpit.css");
  assert.match(css, /\.hh-language-cockpit__action\s*\{[^}]*height:auto[^}]*overflow:hidden/);
  assert.match(css, /\.hh-language-cockpit__action b\s*\{[^}]*white-space:normal[^}]*overflow-wrap:anywhere/);
  assert.match(css, /\.hh-language-cockpit__action small\s*\{[^}]*white-space:normal[^}]*overflow-wrap:anywhere/);
});
