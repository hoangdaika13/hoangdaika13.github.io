"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const cssPath = path.join(root, "hh-eonwild-game.css");
const css = fs.readFileSync(cssPath, "utf8");
const marker = "/* EonWild P0 readability and one-viewport accessibility hardening -------- */";
const hardeningIndex = css.indexOf(marker);
const hardening = hardeningIndex >= 0 ? css.slice(hardeningIndex) : "";
const finalMobileIndex = hardening.lastIndexOf("@media (max-width: 760px)");
const finalMobileEnd = hardening.indexOf("@media", finalMobileIndex + 1);
const finalMobile = finalMobileIndex >= 0
  ? hardening.slice(finalMobileIndex, finalMobileEnd < 0 ? hardening.length : finalMobileEnd)
  : "";

test("EonWild accessibility hardening is the final cascade and remains valid UTF-8 CSS", () => {
  assert.ok(hardeningIndex > 0, "missing the P0 accessibility override layer");
  assert.equal(css.includes("\uFFFD"), false, "CSS contains a Unicode replacement character");
  assert.ok(
    hardeningIndex > css.lastIndexOf("font-size: 0.61rem"),
    "readability floors must cascade after legacy cinematic microcopy"
  );

  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const openBraces = (withoutComments.match(/\{/g) || []).length;
  const closeBraces = (withoutComments.match(/\}/g) || []).length;
  assert.equal(openBraces, closeBraces, "CSS braces must stay balanced");
});

test("Vietnamese UI uses a stable glyph-capable stack and explicit readable type floors", () => {
  assert.match(hardening, /--hwe-font-ui:\s*"Segoe UI Variable",\s*"Segoe UI",\s*"Noto Sans",\s*Inter,\s*Roboto,\s*Arial,\s*system-ui/);
  assert.match(hardening, /--hwe-ui-scale:\s*1\s*;/);
  assert.match(hardening, /--hwe-font-body:\s*max\(1rem,/);
  assert.match(hardening, /--hwe-font-small:\s*max\(0\.875rem,/);
  assert.match(hardening, /\.hwe-root\s+:where\(p, li, dd, dt, label, input, select, textarea\)[\s\S]*?font-size:\s*var\(--hwe-font-body\)\s*!important/);
  assert.match(hardening, /\.hwe-root small\s*\{[\s\S]*?font-size:\s*var\(--hwe-font-small\)\s*!important/);
  for (const heading of ["h1", "h2", "h3", "h4"]) {
    assert.match(hardening, new RegExp(`\\.hwe-root ${heading}\\s*\\{[\\s\\S]*?font-size:\\s*clamp\\(`));
  }
  assert.match(hardening, /font-synthesis:\s*none/);
  assert.match(hardening, /-webkit-text-size-adjust:\s*100%/);
});

test("all primary controls expose 44px targets and keyboard focus", () => {
  assert.match(hardening, /--hwe-touch-target:\s*44px/);
  assert.match(hardening, /\.hwe-root button\s*\{[\s\S]*?min-block-size:\s*var\(--hwe-touch-target\)/);
  assert.match(hardening, /input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\):not\(\[type="range"\]\)/);
  assert.match(hardening, /label:has\(input\[type="checkbox"\]\)/);
  assert.match(hardening, /\.hwe-root input\[type="range"\]\s*\{[\s\S]*?min-block-size:\s*var\(--hwe-touch-target\)/);
  assert.match(hardening, /a\[href\][\s\S]*?\[tabindex\]:not\(\[tabindex="-1"\]\)\):focus-visible\s*\{/);
  assert.match(hardening, /outline:\s*3px solid #ffd978/);
  assert.match(hardening, /scroll-margin:\s*14px/);
});

test("one-viewport gameplay keeps overflow inside authoritative work areas", () => {
  assert.match(css, /body\.app-eonwild-route\s*\{[^}]*overflow:\s*hidden\s*!important/);
  assert.match(css, /\.hwe-root\s*\{[^}]*height:\s*100%[^}]*overflow:\s*hidden/);
  assert.match(css, /\.hwe-root\[data-view="world"\]\s+\.hwe-main\s*\{[^}]*overflow:\s*hidden/);
  assert.match(hardening, /\.hwe-main,[\s\S]*?\.hwe-death-panel\s*\{[\s\S]*?overscroll-behavior:\s*contain/);
  assert.match(hardening, /scrollbar-gutter:\s*stable/);
  assert.match(hardening, /-webkit-overflow-scrolling:\s*touch/);
  assert.match(hardening, /\.hwe-start-panel,[\s\S]*?\.hwe-death-panel\s*\{[\s\S]*?overflow-y:\s*auto/);
});

test("safe areas and responsive contracts cover mobile, embedded zoom and 4K", () => {
  for (const edge of ["top", "right", "bottom", "left"]) {
    assert.match(hardening, new RegExp(`--hwe-safe-${edge}:\\s*env\\(safe-area-inset-${edge}, 0px\\)`));
  }
  assert.match(hardening, /container-name:\s*hwe-workspace/);
  assert.match(hardening, /container-type:\s*inline-size/);
  assert.match(hardening, /@container hwe-workspace \(max-width:\s*62rem\)/);
  assert.match(hardening, /@media \(max-width:\s*1360px\)[\s\S]*?\.hwe-nav\s*\{[\s\S]*?overflow-x:\s*auto/);
  assert.match(hardening, /@media \(max-width:\s*760px\)[\s\S]*?\.hwe-realm-selector\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(hardening, /@media \(max-width:\s*430px\)[\s\S]*?\.hwe-nav button span\s*\{[\s\S]*?position:\s*static[\s\S]*?clip-path:\s*none/);
  assert.match(hardening, /@media \(min-width:\s*2560px\)[\s\S]*?--hwe-ui-scale:\s*1\.0625/);
});

test("the final mobile cascade explicitly unlocks settings, remapping and Atlas cards", () => {
  assert.ok(finalMobileIndex >= 0, "missing final 760px responsive override layer");
  assert.match(finalMobile, /\.hwe-settings-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/);
  assert.match(finalMobile, /\.hwe-settings-grid\s*>\s*article,\s*\.hwe-input-settings\s*\{[^}]*width:\s*100%[^}]*grid-column:\s*1\s*\/\s*-1\s*!important/);
  assert.match(finalMobile, /\.hwe-input-bindings,\s*\.hwe-atlas-group\s*>\s*div\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/);
  assert.match(finalMobile, /\.hwe-input-bindings button\s*\{[^}]*min-height:\s*88px[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(finalMobile, /\.hwe-atlas-map\s*\{[^}]*min-height:\s*0/);
});

test("readability overrides wrap legacy labels instead of visually discarding them", () => {
  assert.match(hardening, /Let labels wrap instead of discarding Vietnamese text with ellipsis/);
  for (const selector of [
    ".hwe-nav button span",
    ".hwe-world-address > span strong",
    ".hwe-hud--top strong",
    ".hwe-photo-overlay > header strong"
  ]) {
    assert.ok(hardening.includes(selector), `missing wrap override for ${selector}`);
  }
  assert.match(hardening, /text-overflow:\s*clip/);
  assert.match(hardening, /white-space:\s*normal/);
  assert.match(hardening, /\.hwe-condition-panel > div\s*\{[\s\S]*?repeat\(auto-fit, minmax\(68px, 1fr\)\)/);
});

test("ready-screen copy and native progress tracks cannot retain legacy intrinsic clipping", () => {
  const explicitMarker = "These selectors intentionally match or outrank the legacy nowrap rules";
  const explicitIndex = hardening.indexOf(explicitMarker);
  assert.ok(explicitIndex > hardening.indexOf("Let labels wrap instead of discarding Vietnamese text with ellipsis"));
  const explicit = hardening.slice(explicitIndex, hardening.indexOf(".hwe-species-card,", explicitIndex));
  for (const selector of [
    ".hwe-root .hwe-telemetry > header strong",
    ".hwe-root .hwe-ability-bar strong",
    ".hwe-root .hwe-engine-telemetry dd"
  ]) {
    assert.ok(explicit.includes(selector), `missing cascade-safe wrap override for ${selector}`);
  }
  assert.match(explicit, /overflow:\s*visible[\s\S]*?text-overflow:\s*clip[\s\S]*?white-space:\s*normal/);
  assert.match(explicit, /\.hwe-root progress\s*\{[^}]*inline-size:\s*100%[^}]*min-inline-size:\s*0[^}]*max-inline-size:\s*100%/);
});

test("375px ready screen preserves the complete quick-play and ability copy", () => {
  assert.match(hardening, /375px ready screen keeps action names and descriptions visible/);
  assert.match(hardening, /@media \(max-width:\s*430px\)[\s\S]*?\.hwe-header-status > button\s*\{[^}]*width:\s*auto[^}]*min-inline-size:\s*94px[^}]*overflow:\s*visible[^}]*color:\s*#fff7dc[^}]*white-space:\s*normal/);
  assert.match(hardening, /\.hwe-header-status > button::before\s*\{\s*content:\s*none/);
  assert.match(hardening, /\.hwe-ability-bar\s*\{[^}]*display:\s*flex[^}]*overflow-x:\s*auto[^}]*scroll-snap-type:\s*x proximity/);
  assert.match(hardening, /\.hwe-ability-bar small\s*\{\s*display:\s*block/);
  assert.match(hardening, /\.hwe-ability-bar button :where\(small, strong\)\s*\{[^}]*overflow:\s*visible[^}]*text-overflow:\s*clip[^}]*white-space:\s*normal[^}]*word-break:\s*normal/);
});

test("compact landscape reserves the complete quick-play label", () => {
  assert.match(css, /@media \(min-width:\s*431px\) and \(max-width:\s*1000px\)[\s\S]*?\.hwe-header-status\s*>\s*button\s*\{[\s\S]*?min-inline-size:\s*96px[\s\S]*?flex:\s*0\s+0\s+auto[\s\S]*?white-space:\s*nowrap/);
  assert.match(hardening, /Short landscape shells have very little vertical workspace/);
  assert.match(hardening, /@media \(max-height:\s*500px\) and \(min-width:\s*431px\)[\s\S]*?\[data-gameplay-state="ready"\] \.hwe-viewport\s*\{[^}]*height:\s*auto[^}]*overflow:\s*visible[\s\S]*?\.hwe-start-panel\s*\{[^}]*position:\s*relative[^}]*max-height:\s*none[^}]*transform:\s*none/);
});

test("tablet and compact landscape keep Era Realm names intact in a scroll rail", () => {
  assert.match(hardening, /tablet or landscape phone can have a desktop-class viewport/);
  assert.match(hardening, /@media \(max-width:\s*1000px\)[\s\S]*?\.hwe-realm-selector\s*>\s*div\s*\{[\s\S]*?display:\s*flex[\s\S]*?overflow-x:\s*auto[\s\S]*?scroll-snap-type:\s*inline proximity/);
  assert.match(hardening, /\.hwe-realm-selector\s*>\s*div button\s*\{[\s\S]*?min-inline-size:\s*148px[\s\S]*?flex:\s*0 0 148px/);
  assert.match(hardening, /\.hwe-realm-selector\s*>\s*div button\s*>\s*span,[\s\S]*?overflow-wrap:\s*normal[\s\S]*?word-break:\s*normal[\s\S]*?hyphens:\s*none/);
});

test("motion and contrast preferences remain authoritative in the final layer", () => {
  assert.match(hardening, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?scroll-behavior:\s*auto\s*!important[\s\S]*?scroll-snap-type:\s*none\s*!important/);
  assert.match(hardening, /@media \(forced-colors:\s*active\)[\s\S]*?outline:\s*3px solid Highlight[\s\S]*?box-shadow:\s*none/);
  assert.match(hardening, /@media \(hover:\s*none\), \(pointer:\s*coarse\)[\s\S]*?transform:\s*none/);
});
