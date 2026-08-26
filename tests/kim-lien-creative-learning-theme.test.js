"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "kim-lien-creative-learning.css"), "utf8");
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

function count(character) {
  return [...withoutComments].filter((value) => value === character).length;
}

test("creative and learning bridge is balanced, UTF-8 and scoped to Kim Lien", () => {
  assert.equal(css.includes("\uFFFD"), false, "CSS contains a Unicode replacement character");
  assert.equal(count("{"), count("}"), "CSS braces must stay balanced");
  assert.equal(count("("), count(")"), "CSS parentheses must stay balanced");
  assert.match(css, /html\[data-hh-theme="kim-lien"\] body\.hh-kim-lien/);
  assert.doesNotMatch(withoutComments, /(^|\})\s*:root\s*\{/m, "theme tokens must not leak into other themes");
});

test("creative, media, music and language roots share the ceremonial palette", () => {
  for (const selector of [
    ".creative-os",
    ".creative-galaxy",
    "[data-hh-creative-collaboration]",
    ".cmp-marketplace",
    ".media-design-page",
    ".mdp-cockpit",
    ".media-project-photo-studio",
    ".graphic-design-studio",
    ".draw-studio",
    ".music-ai-studio",
    ".mdaw-shell",
    ".hh-school",
    ".hhe-app",
    ".hhj4-app",
    ".hh-chinese"
  ]) assert.ok(css.includes(selector), `missing Kim Lien coverage for ${selector}`);

  for (const token of [
    "--kl-cl-bg",
    "--kl-cl-bg-deep",
    "--kl-cl-panel",
    "--kl-cl-panel-2",
    "--kl-cl-line",
    "--kl-cl-line-strong",
    "--kl-cl-text",
    "--kl-cl-muted",
    "--kl-cl-gold",
    "--kl-cl-gold-bright",
    "--kl-cl-red",
    "--kl-cl-sage",
    "--kl-cl-danger"
  ]) assert.ok(css.includes(token), `missing shared token ${token}`);

  for (const legacyNeon of [
    "#5deaff",
    "#ff65d6",
    "#ff6bce",
    "#8e72ff",
    "#63eaff",
    "#62e7f1",
    "#6be8ff",
    "#ff65c8",
    "#9d7cff"
  ]) assert.equal(withoutComments.toLowerCase().includes(legacyNeon), false, `legacy neon ${legacyNeon} leaked into the bridge`);
});

test("Media Core chrome replaces cyan and magenta with gold, copper and wood", () => {
  assert.match(css, /\.mdp-cockpit\s*\{[\s\S]*?--mdp-space:\s*var\(--kl-cl-gold\)\s*!important/);
  assert.match(css, /\.mdp-cockpit::before\s*\{[\s\S]*?klCreativeLearningHalo/);
  assert.match(css, /\.media-project-photo-studio\s*\{[\s\S]*?--mpp:\s*var\(--kl-cl-gold\)\s*!important[\s\S]*?--mpp2:\s*var\(--kl-cl-red\)\s*!important/);
  assert.match(css, /\.mpp-health-ring\s*\{[\s\S]*?conic-gradient\(var\(--kl-cl-gold-bright\)/);

  for (const chrome of [
    ".mdp-cockpit-topbar",
    ".mdp-cockpit-sidebar",
    ".mdp-tool-rail",
    ".mdp-actionbar",
    ".mdp-cockpit-inspector",
    ".mpp-toolbar",
    ".mpp-photo-toolbar",
    ".mpp-tabs",
    ".mpp-overview-grid > article",
    ".mpp-graph-stage",
    ".mpp-layer-list article",
    ".mpp-photo-status"
  ]) assert.ok(css.includes(chrome), `missing Media Core chrome override for ${chrome}`);
});

test("Media Core keeps one reachable scroll owner on desktop and mobile", () => {
  assert.match(
    css,
    /\.mdp-cockpit:has\(\.media-project-photo-studio\) \.media-design-page__work\s*\{[\s\S]*?overflow:\s*hidden\s*!important/
  );
  assert.match(
    css,
    /\.media-project-photo-studio > main\s*\{[\s\S]*?min-height:\s*0[\s\S]*?overflow-x:\s*hidden\s*!important[\s\S]*?overflow-y:\s*auto\s*!important[\s\S]*?scrollbar-gutter:\s*stable/
  );
  assert.match(css, /padding-bottom:\s*max\(24px, env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(css, /@media \(max-width:\s*820px\)[\s\S]*?min-height:\s*44px/);
  assert.match(css, /@media \(max-width:\s*560px\)[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)\s*!important/);
});

test("artwork, video, scopes and editors remain colour-neutral", () => {
  assert.match(css, /\.mpp-canvas-stage\s*\{[\s\S]*?background-color:\s*#090909\s*!important/);
  assert.match(css, /\.mpp-lighttable img/);
  assert.match(css, /\.mpp-filmstrip img/);
  assert.match(css, /\.CodeMirror/);
  assert.match(css, /\.cm-editor/);
  assert.match(css, /\.monaco-editor/);
  assert.match(css, /filter:\s*none\s*!important/);
  assert.match(css, /mix-blend-mode:\s*normal\s*!important/);
  assert.match(css, /\.ve-monitor video/);
  assert.match(css, /\.vr-scopes/);
});

test("missed Media cartridges now inherit Kim Lien without recolouring render output", () => {
  for (const selector of [
    ".hhump",
    ".video-editor-workspace",
    ".ve-app",
    ".ve-resolve",
    ".va-tool",
    ".bvf-shell",
    ".hvr-root"
  ]) assert.ok(css.includes(selector), `missing cartridge coverage for ${selector}`);
  assert.match(css, /--ump-cyan:\s*var\(--kl-cl-gold\)/);
  assert.match(css, /--ve-accent:\s*var\(--kl-cl-gold\)/);
  assert.match(css, /--hvr-cyan:\s*var\(--kl-cl-gold\)/);
  assert.match(css, /\.ve-monitor,[\s\S]*?canvas[\s\S]*?filter:\s*none\s*!important/);
});

test("shared language cockpit no longer paints a blue cosmic orbit", () => {
  assert.match(css, /\.hh-language-cockpit\s*\{[\s\S]*?--language-accent:\s*var\(--kl-cl-gold\)\s*!important[\s\S]*?linear-gradient\(138deg, #432018/);
  assert.match(css, /\.hh-language-cockpit__backdrop\s*\{\s*display:\s*none\s*!important/);
  assert.match(css, /\.hh-language-cockpit__planet::after\s*\{\s*display:\s*none\s*!important/);
  assert.match(css, /\.hh-language-cockpit__node-orb/);
});

test("motion can pause and follows reduced-motion preference", () => {
  assert.match(css, /@keyframes klCreativeLearningGlow/);
  assert.match(css, /@keyframes klCreativeLearningHalo/);
  assert.match(css, /body\[data-kl-workspace-paused="true"\]/);
  assert.match(css, /body\.app-effects-paused/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /animation-duration:\s*\.01ms\s*!important/);
});
