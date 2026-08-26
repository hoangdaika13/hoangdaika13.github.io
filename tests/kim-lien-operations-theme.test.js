"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const cssPath = path.join(root, "kim-lien-operations.css");
const css = fs.readFileSync(cssPath, "utf8");
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

test("Kim Lien operations layer is valid UTF-8, balanced and opt-in", () => {
  assert.equal(css.includes("\uFFFD"), false, "CSS contains a Unicode replacement character");
  assert.equal(
    (withoutComments.match(/\{/g) || []).length,
    (withoutComments.match(/\}/g) || []).length,
    "CSS braces must stay balanced"
  );
  assert.match(css, /html\[data-hh-theme="kim-lien"\] body\.hh-kim-lien/);
  assert.doesNotMatch(withoutComments, /(^|\})\s*:root\s*\{/m, "theme tokens must not leak outside Kim Lien");
});

test("all owned operations and entertainment roots receive the ceremonial palette", () => {
  for (const rootSelector of [
    ".hh-play",
    ".cinema-hub",
    ".omh-app",
    ".hwe-root",
    ".work-center",
    ".dev-galaxy",
    ".dev-page",
    ".hh-tool",
    ".pt-workspace",
    ".hhs",
    ".ac-shell",
    ".google-hub",
    ".youtube-hub",
    ".discord-hub",
    ".insights-pro",
    ".system-platform",
    ".hh-admin-app",
    ".ycg-shell",
    ".youtube-auto-publisher",
    ".app-simple-view--collection"
  ]) assert.ok(css.includes(rootSelector), `missing Kim Lien coverage for ${rootSelector}`);

  for (const token of [
    "--klo-wood-950",
    "--klo-burgundy",
    "--klo-copper",
    "--klo-gold",
    "--klo-gold-bright",
    "--klo-ivory",
    "--klo-muted",
    "--klo-success",
    "--klo-warning",
    "--klo-danger",
    "--klo-line-strong"
  ]) assert.ok(css.includes(token), `missing operations token ${token}`);

  for (const legacyNeon of ["#63eaff", "#ff68c7", "#66eff7", "#62e8ff", "#7c76ff"]) {
    assert.equal(withoutComments.toLowerCase().includes(legacyNeon), false, `legacy neon ${legacyNeon} leaked into the override`);
  }
});

test("cosmic layers are removed without exposing transparent route surfaces", () => {
  for (const layer of [
    ".hhp-ambient",
    ".work-aurora",
    ".work-cosmic-field",
    ".dev-space-dust",
    ".hhs-nebula",
    ".gh-ambient",
    ".yh-ambient",
    ".dh-ambient"
  ]) assert.ok(css.includes(layer), `missing cosmic-layer reset for ${layer}`);
  assert.match(css, /display:\s*none\s*!important/);
  assert.match(css, /linear-gradient\(145deg, var\(--klo-wood-900\), var\(--klo-wood-1000\)/);
  assert.match(css, /backdrop-filter:\s*none\s*!important/);
});

test("each full-screen workspace owns a reachable internal scroll area", () => {
  for (const scroller of [
    ".hhp-stage-scroll",
    ".cinema-library",
    ".omh-library",
    ".hwe-main",
    ".hh-tool__body",
    ".hhs-content",
    ".gh-main-scroll",
    ".yh-main-scroll",
    ".yh-queue-list",
    ".dh-content",
    ".system-audit",
    ".insights-table-scroll",
    ".hh-admin-galaxy-layout"
  ]) assert.ok(css.includes(scroller), `missing scroll owner ${scroller}`);
  assert.match(css, /overflow-y:\s*auto/);
  assert.match(css, /overscroll-behavior:\s*contain/);
  assert.match(css, /scrollbar-gutter:\s*stable/);
  assert.match(css, /\.work-center,[\s\S]*?\.ac-shell[\s\S]*?overflow:\s*visible\s*!important/);
});

test("mobile layouts reserve bottom navigation, safe areas and readable controls", () => {
  assert.match(css, /--klo-bottom-safe:\s*calc\(78px \+ env\(safe-area-inset-bottom, 0px\)\)/);
  assert.match(css, /@media \(max-width:\s*900px\)/);
  assert.match(css, /padding-bottom:\s*var\(--klo-bottom-safe\)\s*!important/);
  assert.match(css, /env\(safe-area-inset-right, 0px\)/);
  assert.match(css, /env\(safe-area-inset-left, 0px\)/);
  assert.match(css, /@media \(max-width:\s*560px\)[\s\S]*?min-height:\s*44px/);
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\)\s*!important/);
});

test("labels wrap, Vietnamese type remains legible and focus is visible", () => {
  assert.match(css, /font-family:\s*"Be Vietnam Pro", "Noto Sans", "Segoe UI"/);
  assert.match(css, /font-size:\s*max\(\.78rem, 12px\)/);
  assert.match(css, /font-size:\s*max\(\.7rem, 11px\)/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /text-overflow:\s*clip\s*!important/);
  assert.match(css, /white-space:\s*normal\s*!important/);
  assert.match(css, /outline:\s*3px solid var\(--klo-focus\)\s*!important/);
});

test("EonWild keeps renderer output neutral while its chrome and HUD adopt Kim Lien", () => {
  assert.match(css, /\.hwe-viewport > canvas/);
  assert.match(css, /\.hwe-render-surface/);
  assert.match(css, /\.hwe-minimap canvas/);
  assert.match(css, /filter:\s*none\s*!important/);
  assert.match(css, /\.hwe-hud--top > span/);
  assert.match(css, /\.hwe-ability-bar/);
  assert.match(css, /background:\s*rgba\(40, 14, 10, \.9\)\s*!important/);
});

test("ambient motion is continuous, pausable and reduced-motion safe", () => {
  assert.match(css, /@keyframes klo-icon-breathe/);
  assert.match(css, /@keyframes klo-gold-signal/);
  assert.match(css, /animation:\s*klo-icon-breathe 4\.8s ease-in-out infinite\s*!important/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /animation-duration:\s*\.001ms\s*!important/);
  assert.match(css, /body\.app-effects-paused[\s\S]*?animation-play-state:\s*paused\s*!important/);
});

test("HH Play cartridges use ceremonial chrome without recolouring game output", () => {
  for (const selector of [
    ".hhp-search",
    ".hhp-daily-grid > article",
    ".hhp-quick-grid > button",
    ".hhp-stat-grid > article",
    ".hhp-mission-mini",
    ".hhp-game-cockpit",
    ".hhp-game-filmstrip button",
    ".hhp-cartridge-help",
    ".hhp-cartridge-toolbar",
    ".hhp-game-overlay"
  ]) assert.ok(css.includes(selector), `missing HH Play chrome ${selector}`);
  assert.match(css, /background-color:\s*#321510\s*!important/);
  assert.match(css, /\.hhp-quick-grid > button > i[\s\S]*?color:\s*var\(--klo-gold-bright\)\s*!important/);
  assert.match(css, /\.hhp-game-stage,[\s\S]*?\.hhp-game-stage canvas[\s\S]*?background-color:\s*#0d0c0b\s*!important/);
  assert.match(css, /filter:\s*none\s*!important/);
  assert.match(css, /mix-blend-mode:\s*normal\s*!important/);
  assert.match(css, /app-play-route \.hhp-inspector > header[\s\S]*?position:\s*sticky/);
  assert.match(css, /app-eonwild-route \.hwe-world-layout[\s\S]*?margin-bottom:\s*calc\(var\(--klo-bottom-safe\) \+ 22px\)\s*!important/);
});

test("HH Play mobile collections keep headings, icons and descriptions separated", () => {
  assert.match(css, /app-play-route \.hh-play \.hhp-collections\s*\{[\s\S]*?display:\s*grid\s*!important[\s\S]*?gap:\s*12px\s*!important/);
  assert.match(css, /\.hhp-collections > header > div\s*\{[\s\S]*?display:\s*grid\s*!important[\s\S]*?gap:\s*5px\s*!important/);
  assert.match(css, /:is\(\.hhp-duration-chips, \.hhp-mood-grid\) > button\s*\{[\s\S]*?grid-template-columns:\s*42px minmax\(0, 1fr\)\s*!important[\s\S]*?gap:\s*11px\s*!important/);
  assert.match(css, /:is\(\.hhp-duration-chips, \.hhp-mood-grid\) > button > span\s*\{[\s\S]*?display:\s*grid\s*!important[\s\S]*?gap:\s*4px\s*!important/);
  assert.match(css, /:is\(\.hhp-duration-chips, \.hhp-mood-grid\) > button small\s*\{[\s\S]*?font-size:\s*11px\s*!important[\s\S]*?line-height:\s*1\.45\s*!important/);
  assert.match(css, /@media \(max-width:\s*560px\)[\s\S]*?app-play-route \.hh-play :is\(\.hhp-duration-chips, \.hhp-mood-grid\)\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)\s*!important/);
  assert.match(css, /app-play-route \.hh-play \.hhp-collections > header\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)\s*!important/);
  assert.match(css, /padding-bottom:\s*var\(--klo-bottom-safe\)\s*!important/);
});
