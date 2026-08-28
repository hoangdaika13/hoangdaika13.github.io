const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Google and YouTube are top-level workspaces outside Communication", () => {
  const shell = read("script.js");
  const overview = read("communication-overview.js");
  assert.match(shell, /route === "\/communication"/);
  assert.match(shell, /mountCommunicationOverview\(\)/);
  assert.match(shell, /id: "google"[\s\S]*?route: "\/google"/);
  assert.match(shell, /id: "youtube-main"[\s\S]*?route: "\/youtube"/);
  assert.match(shell, /route === "\/google" \|\| route === "\/youtube"/);
  assert.match(shell, /data-google-hub-host/);
  assert.match(shell, /data-youtube-hub-host/);
  assert.match(shell, /HHGoogleHub\?\.mount\?\.\(searchHost\)/);
  assert.match(shell, /HHYouTubeHub\?\.ensureMounted\?\.\(searchHost\)/);
  const routeWorkspace = shell.slice(shell.indexOf('} else if (route === "/google" || route === "/youtube")'), shell.indexOf('} else if (route === "/communication"'));
  assert.doesNotMatch(routeWorkspace, /HHSearchWatch\?\.open/);
  assert.doesNotMatch(overview, /Google \+ YouTube|Google Search|YouTube Player|data-search-watch-open/);
  for (const title of ["Community", "Notification Center", "User Dashboard", "Feedback & Survey", "Helpdesk \/ Ticketing", "Referral & Affiliate"]) {
    assert.match(overview, new RegExp(title.replace(/[+]/g, "\\+")));
  }
});

test("Home and sign-in galaxies expose independent Google and YouTube destinations", () => {
  const home = read("home-galaxy-command.js");
  const auth = read("auth-creative-universe.js");
  for (const source of [home, auth]) {
    assert.match(source, /route: "\/google"/);
    assert.match(source, /route: "\/youtube"/);
  }
});

test("YouTube workspace uses official embeds and persistent player modes", () => {
  const source = read("youtube-hub.js");
  const core = read("search-platform-core.js");
  const styles = read("youtube-hub.css");
  assert.match(source, /youtube-nocookie\.com\/embed/);
  assert.match(source, /documentPictureInPicture\.requestWindow/);
  assert.match(source, /youtube-pip\.html/);
  assert.match(styles, /is-mini-player/);
  assert.match(styles, /is-theatre/);
  assert.match(core, /action: "playlist-items"/);
  assert.match(core, /function reorderQueue/);
  assert.match(source, /data-yh-player-slot/);
  assert.match(source, /YOUTUBE WATCH GALAXY/);
  assert.doesNotMatch(source, /YOUTUBE_API_KEY\s*=/);
  assert.doesNotMatch(core, /YOUTUBE_API_KEY\s*=/);
});

test("Search API validates advanced filters on the server", () => {
  const source = read("api/search/[provider].js");
  assert.match(source, /siteSearch/);
  assert.match(source, /allowedSafe/);
  assert.match(source, /allowedRegions/);
  assert.match(source, /allowedLanguages/);
  assert.match(source, /process\.env\.YOUTUBE_API_KEY/);
  assert.match(source, /process\.env\.GOOGLE_SEARCH_API_KEY/);
});

test("Google search falls back to the official free Search Element", () => {
  const source = read("google-hub.js");
  const core = read("search-platform-core.js");
  const api = read("api/search/[provider].js");
  const config = read("config.js");
  assert.match(config, /HH_GOOGLE_CSE_ID\s*=\s*"67d13c3a6642e4d27"/);
  assert.match(core, /cse\.google\.com\/cse\.js/);
  assert.match(core, /searchresults-only/);
  assert.match(source, /data\.fallback && data\.source === "programmable-search-element"/);
  assert.match(api, /googleSearchElementFallback/);
  assert.match(api, /error\?\.code === "API_ACCESS_DENIED"/);
  assert.match(api, /source: "programmable-search-element"/);
  assert.match(source, /Google miễn phí đang hoạt động/);
  assert.doesNotMatch(source, /GOOGLE_SEARCH_API_KEY\s*=/);
});

test("Versioned assets are available offline", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  for (const asset of ["communication-overview.css?v=1", "communication-overview.js?v=3", "search-platform-core.js?v=3", "search-quick-overlay.css?v=1", "search-quick-overlay.js?v=1", "google-hub.css?v=4", "google-hub.js?v=1", "google-hub-pro.css?v=3", "google-hub-pro.js?v=3", "youtube-hub.css?v=5", "youtube-playback-core.js?v=2", "youtube-hub.js?v=5", "youtube-hub-pro.css?v=4", "youtube-hub-pro.js?v=9"]) {
    assert.match(loader, new RegExp(asset.replace(/[.?]/g, "\\$&")));
    assert.match(worker, new RegExp(asset.replace(/[.?]/g, "\\$&")));
  }
  assert.match(worker, /youtube-pip\.html/);
  assert.doesNotMatch(loader, /search-watch-center/);
  assert.doesNotMatch(worker, /search-watch-center/);
});

test("Picture-in-Picture bridge preserves YouTube client identification", () => {
  const bridge = read("youtube-pip.html");
  assert.match(bridge, /strict-origin-when-cross-origin/);
  assert.match(bridge, /widget_referrer/);
  assert.match(bridge, /location\.origin/);
  assert.match(bridge, /youtube-nocookie\.com\/embed/);
});
