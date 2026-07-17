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

test("Versioned assets are available offline", () => {
  const index = read("index.html");
  const worker = read("sw.js");
  for (const asset of ["communication-overview.css?v=1", "communication-overview.js?v=1", "search-watch-center.css?v=4", "search-watch-center.js?v=5"]) {
    assert.match(index, new RegExp(asset.replace(/[.?]/g, "\\$&")));
    assert.match(worker, new RegExp(asset.replace(/[.?]/g, "\\$&")));
  }
});
