const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Kim Liên login builds a solemn CSS sanctuary without touching auth data", () => {
  const client = read("kim-lien-auth.js");

  for (const marker of [
    "kl-ambient-halo",
    "kl-halo-wheel",
    "kl-ambient-incense",
    "kl-ambient-motes",
    "kl-ambient-lotus-dais",
    "kl-card-radiance"
  ]) {
    assert.match(client, new RegExp(marker));
  }

  assert.match(client, /"<i><\/i>"\.repeat\(12\)/, "the scene must stay within the twelve-mote budget");
  assert.match(client, /kl-art-aureole/);
  assert.match(client, /kl-sanctum-buddha-image/);
  assert.doesNotMatch(client, /kl-sanctum-devotion|kl-sanctum-quote|Tâm an tịnh, trí sáng trong/);
  assert.doesNotMatch(client, /Ánh vàng soi đường tu học|kl-sanctum-links/);
  assert.match(client, /presentation-only/);
  assert.doesNotMatch(client, /\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|document\.cookie/);
});

test("Kim Liên login remains opaque, scrollable and readable at narrow widths", () => {
  const css = read("kim-lien-auth.css");

  assert.match(css, /#authGate[\s\S]{0,900}?overflow-x:\s*hidden\s*!important;[\s\S]{0,120}?overflow-y:\s*auto\s*!important;/);
  assert.match(css, /linear-gradient\(135deg, #1b0908 0%, #3b1715 44%, #1d0b0a 100%\)\s*!important/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*?#authGate:not\(\[hidden\]\)[\s\S]{0,260}?height:\s*100dvh\s*!important/);
  assert.match(css, /\.auth-gate-card[\s\S]{0,420}?max-height:\s*none\s*!important/);
  assert.match(css, /@layer pages[\s\S]*?\.kl-centered-devotional-host[\s\S]{0,220}?display:\s*grid\s*!important/);
  assert.match(css, /\.auth-gate-brand\.kl-centered-devotional-host\s*>\s*:not\(\.kl-sanctum-panel\)[\s\S]{0,100}?display:\s*none\s*!important/);
  assert.match(css, /font-family:\s*"Be Vietnam Pro",\s*"Noto Sans"/);
});

test("Kim Liên halo effects honor motion comfort and hidden tabs", () => {
  const css = read("kim-lien-auth.css");

  assert.match(css, /data-motion-level="off"[\s\S]{0,300}?\.kl-ambient-motes/);
  assert.match(css, /html\.hh-page-hidden[\s\S]{0,500}?animation-play-state:\s*paused\s*!important/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]{0,260}?\.kl-ambient-motes/);
  for (const animation of ["kl-halo-breathe", "kl-mote-float", "kl-incense-rise", "kl-dais-breathe", "kl-card-radiance-pulse"]) {
    assert.match(css, new RegExp(`@keyframes ${animation}`));
  }
});

test("Kim Liên owns an opaque shared page banner and route gate", () => {
  const shell = read("kim-lien-shell.css");
  const auth = read("kim-lien-auth.css");

  assert.match(shell, /body\.hh-kim-lien\[data-app-theme\] \.app-page-header\s*\{[\s\S]{0,500}?linear-gradient\(105deg, #3a2118, #24100c 64%, #2e1711\)\s*!important/);
  assert.match(auth, /#appCosmicLoader:not\(\[hidden\]\)[\s\S]{0,900}?background-color:\s*#120b08\s*!important/);
  assert.match(auth, /\[data-transition-kind="dharma"\]\.is-arriving[\s\S]{0,500}?appCosmicReveal/);
});
