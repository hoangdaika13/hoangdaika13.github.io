const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("every lazy workspace receives the approved Kim Lien paint owner last", () => {
  const html = read("index.html");
  const runtime = read("kim-lien-workspaces.js");
  const worker = read("sw.js");
  assert.match(html, /kim-lien-workspaces\.js\?v=15/);
  assert.match(runtime, /kim-lien-workspaces\.css\?v=8/);
  assert.match(runtime, /kim-lien-creative-learning\.css\?v=3/);
  assert.match(runtime, /kim-lien-operations\.css\?v=6/);
  assert.match(runtime, /document\.head\.append\(link\)/);
  assert.match(runtime, /hh:asset-group-ready/);
  assert.match(runtime, /hh:assets-ready/);
  assert.match(runtime, /hh:route-rendered/);
  assert.match(worker, /kim-lien-workspaces\.css\?v=8/);
  assert.match(worker, /kim-lien-workspaces\.js\?v=15/);
  assert.match(worker, /kim-lien-creative-learning\.css\?v=3/);
  assert.match(worker, /kim-lien-operations\.css\?v=6/);
});

test("the universal workspace system exposes complete ceremonial tokens", () => {
  const css = read("kim-lien-workspaces.css");
  for (const token of [
    "--kim-lien-wood-950",
    "--kim-lien-wood-800",
    "--kim-lien-burgundy",
    "--kim-lien-gold",
    "--kim-lien-gold-bright",
    "--kim-lien-ivory",
    "--kim-lien-parchment",
    "--kim-lien-muted",
    "--kim-lien-border",
    "--kim-lien-success",
    "--kim-lien-warning",
    "--kim-lien-error",
    "--kim-lien-disabled"
  ]) assert.match(css, new RegExp(token.replaceAll("-", "\\-")));
  assert.match(css, /chat-ai-cosmos/);
  assert.match(css, /cosmic-background/);
  assert.match(css, /galaxy-background/);
  assert.match(css, /background-color:\s*var\(--kim-lien-wood-900\)\s*!important/);
  assert.match(css, /State classes such as `is-inspector-hidden`/);
});

test("workspace scrolling has one page owner and explicit immersive exceptions", () => {
  const css = read("kim-lien-workspaces.css");
  const runtime = read("kim-lien-workspaces.js");
  assert.match(css, /app-shell-enabled:not\(:is\([\s\S]*?app-chat-ai-route[\s\S]*?app-eonwild-route[\s\S]*?\)\) \.app-main/);
  assert.match(css, /overflow-y:\s*auto\s*!important/);
  assert.match(css, /padding-bottom:\s*calc\(88px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /app-chat-ai-route[\s\S]*?\.chat-ai-mode-tabs button[\s\S]*?min-height:\s*44px\s*!important[\s\S]*?font-size:\s*14px\s*!important/);
  assert.match(css, /chat-ai-message__body[\s\S]*?chat-ai-composer textarea[\s\S]*?font-size:\s*16px\s*!important/);
  assert.match(css, /\.chat-ai-mode-more > summary[\s\S]*?font-size:\s*0\s*!important/);
  assert.match(css, /\[class\*="backdrop"\][\s\S]*?background-color:\s*rgba\(18, 4, 5, \.9\)\s*!important/);
  assert.match(css, /min-width:\s*0/);
  assert.match(css, /min-height:\s*0/);
  assert.match(runtime, /horizontalOverflow/);
  assert.match(runtime, /canReachEnd/);
  assert.match(runtime, /scrollHeight/);
});

test("inactive structural drawer hosts never become opaque workspace covers", () => {
  const css = read("kim-lien-workspaces.css");
  assert.match(css, /\[class\*="drawer-host"\]/);
  assert.match(css, /\[class\*="drawer-layer"\]/);
  assert.match(css, /\[class\*="drawer-portal"\]/);
  assert.match(
    css,
    /\[class\*="drawer-host"\][\s\S]*?background-color:\s*transparent\s*!important[\s\S]*?background-image:\s*none\s*!important/,
    "structural hosts must not paint over their live workspace while closed"
  );
});

test("motion remains restrained, pausable and accessible", () => {
  const css = read("kim-lien-workspaces.css");
  const runtime = read("kim-lien-workspaces.js");
  assert.match(css, /@keyframes kimLienWorkspaceAura/);
  assert.match(css, /@keyframes kimLienWorkspaceSweep/);
  assert.match(css, /data-kl-workspace-paused="true"/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(runtime, /visibilitychange/);
  assert.match(runtime, /document\.hidden/);
});
