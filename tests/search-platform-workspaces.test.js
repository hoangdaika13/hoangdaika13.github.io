const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("search platform is split into shared core, two hubs and a quick overlay", () => {
  const loader = read("performance-loader.js");
  const shell = read("script.js");

  assert.match(loader, /search:\s*\{[\s\S]*?search-platform-core\.js\?v=3[\s\S]*?search-quick-overlay\.js\?v=1/);
  assert.match(loader, /google:\s*\{[\s\S]*?google-hub\.css\?v=4[\s\S]*?google-hub\.js\?v=1/);
  assert.match(loader, /youtube:\s*\{[\s\S]*?youtube-hub\.css\?v=5[\s\S]*?youtube-playback-core\.js\?v=2[\s\S]*?youtube-hub\.js\?v=5/);
  assert.match(loader, /value === "\/google"[\s\S]*?return \["google"\]/);
  assert.match(loader, /value === "\/youtube"[\s\S]*?return \["youtube"\]/);
  assert.match(loader, /event\.altKey[\s\S]*?ensureGroup\("search"\)/);
  assert.match(shell, /HHGoogleHub\?\.unmount/);
  assert.match(shell, /HHYouTubeHub\?\.unmount/);
});

test("Google Hub has independent discovery, filtering, saving and fallback UI", () => {
  const hub = read("google-hub.js");
  const core = read("search-platform-core.js");
  const css = read("google-hub.css");

  for (const mode of ["web", "images", "news", "academic", "translate"]) {
    assert.match(hub, new RegExp(`id: "${mode}"`));
  }
  assert.match(hub, /data-gh-filter="date"/);
  assert.match(hub, /data-gh-filter="file"/);
  assert.match(hub, /data-gh-filter="site"/);
  assert.match(hub, /data-gh-save/);
  assert.match(hub, /data-gh-copy/);
  assert.match(hub, /data-gh-inspector/);
  assert.match(core, /function toggleWebSaved/);
  assert.match(core, /function renderGoogleCse/);
  assert.match(core, /searchresults-only/);
  assert.match(css, /\.gh-main-scroll[^{]*\{[^}]*overflow-y:auto/);
  assert.match(css, /\.google-hub>\.gh-topbar,\.google-hub>\.gh-grid/);
  assert.match(css, /\.google-hub footer\{[^}]*padding:0/);
  assert.match(css, /prefers-reduced-motion/);
});

test("YouTube Hub keeps player stable while library and queue controls update", () => {
  const hub = read("youtube-hub.js");
  const pro = read("youtube-hub-pro.js");
  const router = read("script.js");
  const core = read("search-platform-core.js");
  const css = read("youtube-hub.css");

  assert.match(hub, /data-yh-player-slot/);
  assert.match(hub, /function renderPlayerOnly/);
  assert.match(hub, /fetchpriority="high"/);
  assert.match(hub, /warmPlaybackConnections/);
  assert.match(hub, /if \(playerSlot\.dataset\.videoId !== currentId\)/);
  assert.match(hub, /content\.innerHTML = mainMarkup/);
  assert.match(hub, /function syncVideoButtons/);
  assert.match(hub, /function ensureMounted\(host\)/);
  assert.match(hub, /event\.source&&event\.source!==frame\.contentWindow/);
  assert.match(pro, /function attachRuntime\(host\)/);
  assert.match(pro, /function ensureMounted\(host\)/);
  assert.match(pro, /function mainContent\(\)/);
  assert.match(pro, /ctx\.content\.innerHTML/);
  assert.doesNotMatch(pro, /function renderResourceResults\(data,type\)\{const main=.*?main\.innerHTML/s);
  assert.match(pro, /if\(!runtime\|\|!/);
  assert.match(pro, /event\.source&&event\.source!==frame\.contentWindow/);
  const stallSection = pro.match(/function trackStall\(\)[\s\S]*?(?=\n\n  function retryPlayer)/)?.[0] || "";
  assert.doesNotMatch(stallSection, /retryPlayer/);
  assert.match(router, /const preserveYouTubePlayer/);
  assert.match(router, /workspace\.querySelector\?\.\("\[data-youtube-hub-host\]"\)/);
  assert.match(router, /if \(!preserveYouTubePlayer\)/);
  assert.match(router, /HHYouTubeHub\?\.ensureMounted/);
  assert.match(hub, /draggable="true"/);
  assert.match(hub, /documentPictureInPicture\.requestWindow/);
  assert.match(hub, /youtube-nocookie\.com\/embed/);
  assert.match(core, /function importPlaylist/);
  assert.match(core, /function reorderQueue/);
  assert.match(css, /\.yh-main-scroll[^{]*\{[^}]*overflow-y:auto/);
  assert.match(css, /\.youtube-hub>\.yh-topbar,\.youtube-hub>\.yh-grid/);
  assert.match(css, /body\.app-search-route \.app-page-header/);
  assert.match(css, /\.youtube-hub footer\{[^}]*padding:0/);
  assert.match(css, /is-mini-player/);
  assert.match(css, /is-theatre/);
  assert.match(css, /prefers-reduced-motion/);
});

test("quick search remains a compact launcher rather than the top-level workspace", () => {
  const overlay = read("search-quick-overlay.js");
  const css = read("search-quick-overlay.css");

  assert.match(overlay, /Alt G/);
  assert.match(overlay, /Alt Y/);
  assert.match(overlay, /savePending\(target, query\)/);
  assert.match(overlay, /location\.hash = `#\$\{route\}`/);
  assert.match(overlay, /scope\.HHSearchWatch = Object\.freeze/);
  assert.match(css, /width:min\(680px,100%\)/);
  assert.doesNotMatch(overlay, /youtube-nocookie\.com\/embed/);
});

test("browser bundles do not contain provider API keys", () => {
  const browserSources = ["search-platform-core.js", "google-hub.js", "youtube-hub.js", "search-quick-overlay.js"].map(read).join("\n");
  assert.doesNotMatch(browserSources, /(?:GOOGLE_SEARCH_API_KEY|YOUTUBE_API_KEY)\s*=/);
  assert.doesNotMatch(browserSources, /AIza[0-9A-Za-z_-]{20,}/);
});

test("shared storage keeps a session fallback when localStorage is unavailable", () => {
  const core = read("search-platform-core.js");
  assert.match(core, /const volatileStore = new Map\(\)/);
  assert.match(core, /volatileStore\.set\(key, clone\(value\)\)/);
  assert.match(core, /volatileStore\.has\(key\)/);
});
