const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Communication route mounts a dedicated overview", () => {
  const shell = read("script.js");
  const overview = read("communication-overview.js");
  assert.match(shell, /route === "\/communication"/);
  assert.match(shell, /mountCommunicationOverview\(\)/);
  for (const title of ["Google + YouTube", "Community", "Notification Center", "User Dashboard", "Feedback & Survey", "Helpdesk \/ Ticketing", "Referral & Affiliate"]) {
    assert.match(overview, new RegExp(title.replace(/[+]/g, "\\+")));
  }
});

test("YouTube workspace uses official embeds and persistent player modes", () => {
  const source = read("search-watch-center.js");
  assert.match(source, /youtube-nocookie\.com\/embed/);
  assert.match(source, /documentPictureInPicture\.requestWindow/);
  assert.match(source, /youtube-pip\.html/);
  assert.match(source, /swh-floating-player/);
  assert.match(source, /action: "playlist-items"/);
  assert.match(source, /moveQueueItem/);
  assert.doesNotMatch(source, /YOUTUBE_API_KEY\s*=/);
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
  const source = read("search-watch-center.js");
  const config = read("config.js");
  assert.match(config, /HH_GOOGLE_CSE_ID\s*=\s*"67d13c3a6642e4d27"/);
  assert.match(source, /cse\.google\.com\/cse\.js/);
  assert.match(source, /searchresults-only/);
  assert.match(source, /API_ACCESS_DENIED/);
  assert.match(source, /Google miễn phí đang hoạt động/);
  assert.doesNotMatch(source, /GOOGLE_SEARCH_API_KEY\s*=/);
});

test("Versioned assets are available offline", () => {
  const index = read("index.html");
  const worker = read("sw.js");
  for (const asset of ["communication-overview.css?v=1", "communication-overview.js?v=2", "search-watch-center.css?v=5", "search-watch-center.js?v=7"]) {
    assert.match(index, new RegExp(asset.replace(/[.?]/g, "\\$&")));
    assert.match(worker, new RegExp(asset.replace(/[.?]/g, "\\$&")));
  }
  assert.match(worker, /youtube-pip\.html/);
});

test("Picture-in-Picture bridge preserves YouTube client identification", () => {
  const bridge = read("youtube-pip.html");
  assert.match(bridge, /strict-origin-when-cross-origin/);
  assert.match(bridge, /widget_referrer/);
  assert.match(bridge, /location\.origin/);
  assert.match(bridge, /youtube-nocookie\.com\/embed/);
});
