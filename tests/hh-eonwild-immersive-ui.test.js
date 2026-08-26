"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "hh-eonwild-game.css"), "utf8");
const marker = "/* EonWild immersive gameplay -------------------------------------------------";
const markerIndex = css.indexOf(marker);
const immersive = markerIndex >= 0 ? css.slice(markerIndex) : "";

test("immersive gameplay CSS is present, balanced and valid UTF-8", () => {
  assert.ok(markerIndex > 0, "missing immersive gameplay cascade");
  assert.equal(immersive.includes("\uFFFD"), false, "immersive CSS contains replacement glyphs");
  const source = immersive.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal((source.match(/\{/g) || []).length, (source.match(/\}/g) || []).length);
});

test("body immersive mode removes app chrome and locks the workspace to one viewport", () => {
  assert.match(immersive, /body\.app-eonwild-immersive\s*\{[^}]*overflow:\s*hidden\s*!important[^}]*overscroll-behavior:\s*none/);
  assert.match(immersive, /body\.app-eonwild-immersive\s+:where\([\s\S]*?\.app-header,[\s\S]*?\.app-sidebar,[\s\S]*?\.app-mobile-nav,[\s\S]*?\.app-page-header,[\s\S]*?\.app-context-bar[\s\S]*?\)\s*\{\s*display:\s*none\s*!important/);
  assert.match(immersive, /body\.app-eonwild-immersive\s+\.app-mobile-nav,[\s\S]*?body\.app-eonwild-immersive\s+\.app-bottom-nav\s*\{\s*display:\s*none\s*!important/);
  assert.match(immersive, /body\.app-eonwild-immersive\s+\.app-shell__body,[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important[^}]*height:\s*100dvh\s*!important/);
  assert.match(immersive, /body\.app-eonwild-immersive\s+\.app-workspace\s*\{[^}]*width:\s*100vw\s*!important[^}]*height:\s*100dvh\s*!important[^}]*padding:\s*0\s*!important[^}]*overflow:\s*hidden\s*!important/);
  assert.match(immersive, /body\.app-eonwild-immersive\s+\[data-hh-eonwild-host\]\s*\{[^}]*height:\s*100dvh[^}]*overflow:\s*hidden/);
});

test("class and gameplay-state contracts both expand the renderer surface", () => {
  assert.match(immersive, /\.hwe-root\.is-playing/);
  assert.match(immersive, /\.hwe-root\[data-gameplay-state="playing"\]/);
  assert.match(immersive, /grid-template-rows:\s*minmax\(0,\s*1fr\)/);
  assert.match(immersive, /:where\(\.hwe-realm-selector,\s*\.hwe-species-dock,\s*\.hwe-telemetry\)\s*\{\s*display:\s*none\s*!important/);
  assert.match(immersive, /\)\s+\.hwe-viewport\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0[^}]*width:\s*100%[^}]*height:\s*100%[^}]*min-height:\s*0/);
  assert.match(immersive, /\.hwe-viewport\s*>\s*canvas\[data-hwe-canvas-3d\][\s\S]*?\)\s*\{[^}]*inset:\s*0[^}]*width:\s*100%[^}]*height:\s*100%[^}]*min-height:\s*0[^}]*touch-action:\s*none/);
  assert.match(immersive, /:where\(\.hwe-main,\s*\.hwe-world-layout\)\s*\{[^}]*overflow:\s*hidden[^}]*scrollbar-gutter:\s*auto/);
});

test("HUD remains an overlay while visible modal layers exclusively receive pointer input", () => {
  assert.match(immersive, /HUD layers stay above the renderer without participating in its layout/);
  assert.match(immersive, /:where\([\s\S]*?\.hwe-hud,[\s\S]*?\.hwe-ability-bar,[\s\S]*?\.hwe-reticle,[\s\S]*?\.hwe-target-prompt[\s\S]*?\)\s*\{[^}]*position:\s*absolute[^}]*pointer-events:\s*none/);
  assert.match(immersive, /\.hwe-game-overlay,\s*\.hwe-pause-overlay\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0[^}]*overflow-y:\s*auto[^}]*pointer-events:\s*none/);
  assert.match(immersive, /:is\(\.hwe-game-overlay,\s*\.hwe-pause-overlay\):not\(\[hidden\]\)\s*\{\s*pointer-events:\s*auto/);
  assert.match(immersive, /\[data-gameplay-state="paused"\][\s\S]*?\.hwe-viewport\s*>\s*:where\(canvas,\s*\.hwe-reticle,\s*\.hwe-target-prompt,\s*\.hwe-touch-controls\)\s*\{\s*pointer-events:\s*none/);
  assert.match(immersive, /\.hwe-game-overlay,\s*\.hwe-pause-overlay\s*\{[\s\S]*?background:\s*#010807/);
});

test("Entering and Field Guide layers are readable, bounded and reduced-motion safe", () => {
  assert.match(immersive, /\.hwe-entry-overlay\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0[^}]*background:[\s\S]*?#02080d/);
  assert.match(immersive, /\.hwe-entry-overlay\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(immersive, /\.hwe-field-guide\s*\{[^}]*position:\s*absolute[^}]*width:\s*min\(330px[^}]*pointer-events:\s*none/);
  assert.match(immersive, /\.hwe-field-guide > div\s*\{[^}]*repeat\(6/);
  assert.match(immersive, /prefers-reduced-motion:[\s\S]*?\.hwe-entry-overlay > span > i[\s\S]*?animation:\s*none\s*!important/);
});

test("reticle and target prompt are centred, non-interactive and text-safe", () => {
  assert.match(immersive, /\.hwe-reticle\s*\{[^}]*top:\s*50%[^}]*left:\s*50%[^}]*width:\s*30px[^}]*transform:\s*translate\(-50%,\s*-50%\)/);
  assert.match(immersive, /\.hwe-reticle::before,\s*\.hwe-reticle::after/);
  assert.match(immersive, /\.hwe-target-prompt\s*\{[^}]*top:\s*calc\(50% \+ 28px\)[^}]*left:\s*50%[^}]*max-width:\s*min\(390px/);
  assert.match(immersive, /data-gameplay-state="playing"\]\)\s+\.hwe-target-prompt:not\(\[hidden\]\)\s*\{\s*display:\s*grid/);
  assert.match(immersive, /\.hwe-target-prompt:empty\s*\{\s*display:\s*none\s*!important/);
  assert.match(immersive, /\.hwe-target-prompt \*[\s\S]*?overflow:\s*visible[^}]*text-overflow:\s*clip[^}]*white-space:\s*normal[^}]*overflow-wrap:\s*anywhere/);
});

test("Photo Mode checkbox labels keep readable whole words", () => {
  assert.match(css, /\.hwe-photo-controls label\.hwe-photo-check input\[type="checkbox"\]\s*\{[^}]*grid-column:\s*1[^}]*grid-row:\s*1/);
  assert.match(css, /\.hwe-photo-controls label\.hwe-photo-check > span\s*\{[^}]*grid-column:\s*2[^}]*overflow-wrap:\s*break-word[^}]*word-break:\s*normal/);
  assert.match(css, /\.hwe-root\.is-photo-mode :where\([^)]*\.hwe-field-guide[^)]*\.hwe-immersive-vitals[^)]*\)\s*\{[^}]*opacity:\s*0[^}]*pointer-events:\s*none/);
});

test("Pointer Lock denial exposes a readable drag-camera fallback", () => {
  assert.match(immersive, /\.hwe-pause-overlay \[data-hwe-pointer-fallback\]:not\(\[hidden\]\)\s*\{[^}]*border-color:[^}]*background:/);
});

test("coarse pointers receive an analogue left stick and a dedicated right camera pad", () => {
  assert.match(immersive, /@media \(pointer:\s*coarse\),\s*\(max-width:\s*760px\)/);
  assert.match(immersive, /\.hwe-touch-controls\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0[^}]*pointer-events:\s*none[^}]*touch-action:\s*none/);
  assert.match(immersive, /\.hwe-touch-stick\s*\{[^}]*left:\s*max\(14px,\s*var\(--hwe-safe-left\)\)[^}]*bottom:\s*max\(18px,\s*var\(--hwe-safe-bottom\)\)[^}]*min-width:\s*44px[^}]*pointer-events:\s*auto/);
  assert.match(immersive, /\.hwe-camera-pad\s*\{[^}]*right:\s*0[^}]*bottom:\s*0[^}]*width:\s*min\(50vw,\s*420px\)[^}]*min-width:\s*44px[^}]*pointer-events:\s*auto[^}]*touch-action:\s*none/);
  assert.match(immersive, /\.hwe-touch-controls\s*>\s*\[data-hwe-touch\]\s*\{\s*display:\s*none/);
  assert.match(immersive, /\.hwe-touch-actions\s*>\s*button\s*\{[^}]*min-width:\s*52px[^}]*min-height:\s*52px[^}]*pointer-events:\s*auto/);
  assert.match(immersive, /\.hwe-ability-bar\s*\{\s*display:\s*none/);
});

test("safe areas and explicit 1366, 4K and 375-class layouts preserve labels", () => {
  for (const edge of ["top", "right", "bottom", "left"]) {
    assert.match(immersive, new RegExp(`var\\(--hwe-safe-${edge}\\)`));
  }
  assert.match(immersive, /@media \(min-width:\s*761px\) and \(max-width:\s*1366px\)/);
  assert.match(immersive, /@media \(min-width:\s*2560px\)[\s\S]*?\.hwe-target-prompt\s*\{\s*max-width:\s*460px/);
  assert.match(immersive, /375px-class phones/);
  assert.match(immersive, /@media \(max-width:\s*430px\)[\s\S]*?\.hwe-hud--top > :where\(span, button\)\s*\{[^}]*overflow:\s*visible[^}]*text-overflow:\s*clip[^}]*white-space:\s*normal/);
  assert.match(immersive, /:is\(\.hwe-game-overlay,\s*\.hwe-pause-overlay\)\s*>\s*\*\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0/);
});

test("immersive motion is disabled by the user's reduced-motion preference", () => {
  assert.match(immersive, /@keyframes hweReticleAcquire/);
  assert.match(immersive, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.hwe-reticle,[\s\S]*?\.hwe-camera-pad[\s\S]*?animation:\s*none\s*!important[^}]*transition:\s*none\s*!important[^}]*scroll-behavior:\s*auto\s*!important/);
});
