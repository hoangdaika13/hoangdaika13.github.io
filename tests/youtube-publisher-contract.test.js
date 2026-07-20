const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Music AI exposes the dedicated YouTube publisher workspace", () => {
  const music = read("music-ai-studio.js");
  const shell = read("script.js");
  assert.match(music, /id: "youtube-publisher"/);
  assert.match(music, /HHYouTubePublisher\?\.mount/);
  assert.match(shell, /\/music-ai\/youtube-publisher/);
  assert.match(shell, /Đăng YouTube tự động/);
});

test("Publisher supports real files, metadata, scheduling and resumable upload", () => {
  const source = read("youtube-publisher.js");
  for (const feature of [
    "publishAt",
    "playlistId",
    "madeForKids",
    "containsSyntheticMedia",
    "hasPaidProductPlacement",
    "notifySubscribers",
    "queryResumableOffset",
    "Content-Range",
    "thumbnail/session",
    "upload/complete"
  ]) assert.match(source, new RegExp(feature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /dataTransfer\?\.files/);
  assert.doesNotMatch(source, /GOOGLE_CLIENT_SECRET\s*=/);
});

test("YouTube API keeps OAuth credentials and tokens on the server", () => {
  const source = read("utils/youtubePublisher.js");
  const searchGateway = read("api/search/[provider].js");
  const deployment = read("vercel.json");
  assert.match(source, /youtube\.upload/);
  assert.match(source, /youtube\.force-ssl/);
  assert.match(source, /aes-256-gcm/);
  assert.match(source, /uploadType: "resumable"/);
  assert.match(source, /status\.publishAt/);
  assert.match(source, /paidProductPlacementDetails/);
  assert.match(source, /playlistItems\?part=snippet/);
  assert.doesNotMatch(source, /refreshToken:\s*decrypt/);
  assert.match(searchGateway, /youtubePublisherHandler/);
  assert.match(deployment, /\/api\/youtube\/:action\*/);
});

test("Versioned publisher assets are loaded and cached", () => {
  const index = read("index.html");
  const worker = read("sw.js");
  for (const asset of ["youtube-publisher.css?v=2", "youtube-publisher.js?v=2"]) {
    const pattern = new RegExp(asset.replace(/[.?]/g, "\\$&"));
    assert.match(index, pattern);
    assert.match(worker, pattern);
  }
});
