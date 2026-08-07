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
    "hh-youtube-upload-v1",
    "indexedDB.open",
    "upload/progress",
    "upload/resume",
    "upload/reconcile",
    "upload/cancel",
    "RETRYABLE_UPLOAD_STATUS",
    "Retry-After",
    "etaSeconds",
    "Content-Range",
    "thumbnail/session",
    "upload/complete"
  ]) assert.match(source, new RegExp(feature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /dataTransfer\?\.files/);
  assert.match(source, /updateUploadReadiness\(\)/);
  assert.match(source, /Đang xác thực và khôi phục phiên upload từ backend/);
  assert.doesNotMatch(source, /GOOGLE_CLIENT_SECRET\s*=/);
});

test("YouTube API keeps OAuth credentials and tokens on the server", () => {
  const source = read("utils/youtubePublisher.js");
  const security = read("utils/youtubeSecurity.js");
  const searchGateway = read("api/search/[provider].js");
  const platformGateway = read("api/platform/summary.js");
  const deployment = read("vercel.json");
  const envExample = read(".env.example");
  assert.match(source, /youtube\.upload/);
  assert.match(source, /youtube\.force-ssl/);
  assert.match(security, /aes-256-gcm/);
  assert.match(source, /sameOwner\(callbackUser\._id, state\.userId\)/);
  assert.match(source, /revokeConnectionToken\(active\)/);
  assert.match(source, /connectionFor\(db, user, record\.channelId\)/);
  assert.match(source, /channelId: connection\.channelId/);
  assert.match(security, /setAAD\(tokenContext\(connection\)\)/);
  assert.match(security, /hh-youtube-token:/);
  assert.match(source, /uploadType: "resumable"/);
  assert.match(source, /uploadSession:\s*encryptToken\(session\.uploadUrl,\s*connection\)/);
  assert.match(source, /decryptToken\(record\.uploadSession,\s*connection\)/);
  assert.match(source, /route === "upload\/resume"/);
  assert.match(source, /route === "upload\/reconcile"/);
  assert.match(source, /upload:reconcile/);
  assert.match(source, /status\.publishAt/);
  assert.match(source, /paidProductPlacementDetails/);
  assert.match(source, /playlistItems\?part=snippet/);
  assert.doesNotMatch(source, /refreshToken:\s*decrypt/);
  assert.match(searchGateway, /youtubePublisherHandler/);
  assert.match(platformGateway, /youtubePublisherHandler/);
  assert.match(platformGateway, /req\.query\.youtubePublisher/);
  const youtubeRewrite = JSON.parse(deployment).rewrites.find((rewrite) =>
    rewrite.source === "/api/youtube/:youtubeAction*"
  );
  assert.deepEqual(youtubeRewrite, {
    source: "/api/youtube/:youtubeAction*",
    destination: "/api/platform/summary?youtubePublisher=1&youtubeAction=:youtubeAction"
  });
  assert.match(read("youtube-creator-galaxy.js"), /window\.HH_API_ORIGIN \|\| location\.origin/);
  assert.doesNotMatch(read("youtube-creator-galaxy.js"), /HH_REALTIME_URL \|\| location\.origin/);
  assert.match(read("youtube-creator-galaxy.js"), /api\/search\/youtube-publisher\?youtubeAction=/);
  assert.match(envExample, /YOUTUBE_CALLBACK_URL=https:\/\/hoang8\.com\/api\/youtube\/oauth\/callback/);
  assert.doesNotMatch(envExample, /YOUTUBE_CALLBACK_URL=https:\/\/hoangdaika13githubio\.vercel\.app/);
});

test("Publisher draft and channel switching are private to the current HH account", () => {
  const source = read("youtube-publisher.js");
  assert.match(source, /sessionStorage\.getItem\(privateStorageKey\(\)\)/);
  assert.match(source, /sessionStorage\.setItem\(privateStorageKey\(\)/);
  assert.match(source, /data-yap-channel-select/);
  assert.match(source, /hh:auth-change/);
  assert.match(source, /currentChannelId\(\)/);
  assert.match(source, /ownerId:\s*currentIdentityId\(\)/);
  assert.doesNotMatch(source, /localStorage\.setItem\(STORAGE_KEY/);
});

test("Versioned publisher assets are loaded and cached", () => {
  const index = read("index.html");
  const worker = read("sw.js");
  for (const asset of ["youtube-publisher.css?v=4", "youtube-publisher.js?v=7"]) {
    const pattern = new RegExp(asset.replace(/[.?]/g, "\\$&"));
    assert.match(index, pattern);
    assert.match(worker, pattern);
  }
});
