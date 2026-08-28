const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("shared search core persists research, playback, bookmarks and advanced queue operations", () => {
  const corePath = require.resolve(path.join(root, "search-platform-core.js"));
  delete require.cache[corePath];
  const core = require(corePath);
  const videoA = { id: "abcdefghijk", title: "Video A", channel: "HH" };
  const videoB = { id: "zyxwvutsrqp", title: "Video B", channel: "HH" };

  assert.equal(core.version, "2.0.0");
  assert.equal(core.savePlayback(videoA.id, 754, 1200).seconds, 754);
  assert.equal(core.playbackFor(videoA.id).duration, 1200);
  assert.equal(core.addBookmark(videoA.id, { seconds: 90, label: "Ý chính" }).label, "Ý chính");
  assert.equal(core.bookmarksFor(videoA.id).length, 1);
  core.queueInsert(videoA, "later");
  core.queueInsert(videoB, "next");
  assert.deepEqual(core.list("queue").map((item) => item.id), [videoB.id, videoA.id]);
  assert.equal(core.dedupeQueue().length, 2);
  assert.equal(core.saveQueryPreset({ name: "MDN", query: "site:developer.mozilla.org PointerEvent" }).name, "MDN");
  assert.equal(core.saveSearchSession({ name: "Web APIs", query: "PointerEvent", results: [{ title: "MDN", url: "https://developer.mozilla.org/", snippet: "Web API" }] }).results.length, 1);
  assert.equal(core.saveResearchProject({ name: "Player", sources: [{ type: "video", title: "Demo", url: "https://youtu.be/abcdefghijk", timestamp: 90 }] }).sources[0].timestamp, 90);
});

test("Google Pro exposes builder, safe collections, sessions and truthful Google spaces", () => {
  const source = read("google-hub-pro.js");
  const css = read("google-hub-pro.css");
  for (const contract of ["data-gh-query-builder", "data-gh-compare-check", "data-gh-save-session", "data-gh-project-selected", "searchGoogleResource(\"books\"", "searchGoogleResource(\"places\"", "data-gh-drive-picker", "scholar.google.com", "hh.chat-ai.handoff.v1"]) assert.match(source, new RegExp(contract.replace(/[().]/g, "\\$&")));
  assert.match(source, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(source, /HH chỉ đọc tệp sau khi bạn chọn/);
  assert.match(source, /HH không scrape Scholar/);
  assert.match(css, /\.gh-pro-drawer/);
  assert.match(css, /prefers-reduced-motion/);
});

test("YouTube Pro implements real player telemetry, resume, chapters, queue, creator and watch-room controls", () => {
  const source = read("youtube-hub-pro.js");
  const css = read("youtube-hub-pro.css");
  for (const contract of ["infoDelivery", "getAvailablePlaybackRates", "savePlayback", "data-yh-resume", "addBookmark", "data-yh-queue-shuffle", "duplicatePlaylist", "metadataScore", "youtube:watch:create", "youtube:watch:state", "data-yh-focus-mode", "retryPlayer", "MAX_RETRIES", "frameReady", "saveTimer"]) assert.match(source, new RegExp(contract.replace(/[().]/g, "\\$&")));
  assert.match(source, /HH không tuyên bố tải transcript của mọi video/);
  assert.match(source, /Mỗi người phát video bằng player YouTube riêng/);
  assert.match(css, /\.yh-pro-telemetry/);
  assert.match(css, /is-focus-player/);
  assert.match(css, /prefers-reduced-motion/);
});

test("search API adds official Books, Places and YouTube discovery resources without exposing keys", () => {
  const api = read("api/search/[provider].js");
  for (const contract of ["GOOGLE_BOOKS_ENDPOINT", "GOOGLE_PLACES_ENDPOINT", "resource-search", "mostPopular", "videoCategories", "commentThreads", "quotaCost"]) assert.match(api, new RegExp(contract));
  assert.match(api, /process\.env\.GOOGLE_PLACES_API_KEY/);
  assert.match(api, /process\.env\.YOUTUBE_API_KEY/);
  assert.doesNotMatch(read("google-hub-pro.js") + read("youtube-hub-pro.js"), /AIza[0-9A-Za-z_-]{20,}/);
});

test("realtime server synchronizes only bounded YouTube player state", () => {
  const source = read("realtime-server/src/server.js");
  assert.match(source, /youtube:watch:create/);
  assert.match(source, /youtube:watch:join/);
  assert.match(source, /youtube:watch:state/);
  assert.match(source, /room\.hostSocketId !== socket\.id/);
  assert.match(source, /Math\.min\(86400/);
  assert.doesNotMatch(source, /youtube:watch:media/);
});

test("versioned Pro assets are loaded in order and cached offline", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  for (const asset of ["search-platform-core.js?v=3", "google-hub-pro.css?v=3", "google-hub-pro.js?v=3", "youtube-playback-core.js?v=2", "youtube-hub-pro.css?v=4", "youtube-hub-pro.js?v=9"]) {
    assert.match(loader, new RegExp(asset.replace(/[.?]/g, "\\$&")));
    assert.match(worker, new RegExp(asset.replace(/[.?]/g, "\\$&")));
  }
  assert.ok(loader.indexOf("google-hub.js?v=1") < loader.indexOf("google-hub-pro.js?v=3"));
  assert.ok(loader.indexOf("youtube-playback-core.js?v=2") < loader.indexOf("youtube-hub.js?v=5"));
  assert.ok(loader.indexOf("youtube-hub.js?v=5") < loader.indexOf("youtube-hub-pro.js?v=9"));
});

test("YouTube startup uses the dedicated IFrame listening handshake", () => {
  const core = read("youtube-playback-core.js");
  assert.match(core, /function listen\(frame, listenerId/);
  assert.match(core, /event: "listening"/);
  assert.doesNotMatch(core, /COMMANDS = new Set\(\[[^\]]*"listening"/s);
});
