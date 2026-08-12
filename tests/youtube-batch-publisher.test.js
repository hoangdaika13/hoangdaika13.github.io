const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Tool exposes a dedicated YouTube Batch Publisher route", () => {
  const shell = read("script.js");
  assert.match(shell, /id: "youtube-batch"/);
  assert.match(shell, /\/davinci-resolve\/youtube-batch/);
  assert.match(shell, /YouTube Batch Publisher/);
  assert.match(shell, /HHYouTubeCreatorGalaxy\?\.mount\(resolveHost, \{ view: resolveView \}\)/);
});

test("batch workspace reads an authorized folder and builds a local manifest", () => {
  const client = read("youtube-creator-galaxy.js");
  for (const marker of [
    "webkitdirectory",
    "data-ycg-batch-folder",
    "loadBatchFolderFiles",
    "BATCH_MANIFEST_DB",
    "indexedDB.open",
    "persistBatchManifest",
    "normalizedAssetBase",
    "batchThumbnailFiles",
    "batchSidecars",
    "applySidecarToDraft",
    "createBatchThumbnailBlob"
  ]) assert.match(client, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(client, /Trình duyệt chỉ đọc file sau khi bạn cấp quyền/);
});

test("batch metadata, schedules and multi-channel queue remain reviewable", () => {
  const client = read("youtube-creator-galaxy.js");
  const actions = read("api/modules/[moduleId]/actions.js");
  for (const marker of [
    "youtube-batch-metadata",
    "generateBatchMetadata",
    "applyBatchSchedule",
    "batchMatrixMarkup",
    "madeForKids",
    "aiDisclosure",
    "uploadPrivateFirst",
    "putFleetChunk",
    "metadataVersion"
  ]) assert.match(`${client}\n${actions}`, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(actions, /không bịa người, sự kiện, số liệu hay xu hướng/i);
  assert.match(client, /Hãy duyệt nhanh trước khi upload/);
  assert.match(client, /videoIndex \* spacingHours/);
  assert.match(client, /fleetThumbnailVariants\.set\(thumbnailKey, thumbnail\)/);
  assert.match(client, /runBatchAutomation/);
  assert.match(client, /approveFleetPublish\(item\.taskKey, \{ automatic: true, silent: true \}\)/);
  assert.match(client, /retryFleetChannel\(item\.taskKey\)/);
  assert.match(client, /\["content", "calendar", "queue", "settings"\]/);
  assert.match(client, /\["content", "Thư mục & đăng"/);
  assert.match(client, /\["queue", "Tự động"/);
  assert.match(client, /error\.code === "YOUTUBE_PROCESSING_PENDING"/);
  assert.match(client, /attempts >= 360/);
  assert.match(client, /visibilitychange/);
});

test("server isolates owners and enforces safe bulk limits", () => {
  const server = read("utils/youtubePublisher.js");
  for (const marker of [
    "userId: user._id",
    "ownedConnectionsForIds",
    "VIDEO_QUEUE_LIMIT",
    "queueVideoCount > VIDEO_QUEUE_LIMIT",
    "YOUTUBE_BULK_PUBLIC_BLOCKED",
    "uploadSession: encryptToken",
    "decryptToken(record.uploadSession",
    "taskKey",
    "checksum"
  ]) assert.match(server, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(`${server}\n${read("youtube-creator-galaxy.js")}`, /GOOGLE_CLIENT_SECRET\s*=/);
});

test("batch workspace has responsive styles without a global horizontal scrollbar", () => {
  const css = read("youtube-creator-galaxy.css");
  assert.match(css, /\.ycg-batch-launchpad/);
  assert.match(css, /@media\(max-width:820px\)/);
  assert.match(css, /\.app-youtube-batch-route \.app-workspace\{overflow-x:hidden\}/);
});
