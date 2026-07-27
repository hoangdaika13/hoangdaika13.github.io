const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const mediaCloud = require(path.join(root, "services", "mediaCloud.js"));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Media Cloud validates upload formats and sanitizes render specs", () => {
  assert.equal(mediaCloud.safeMime("image/png"), "image/png");
  assert.equal(mediaCloud.safeMime("application/x-msdownload"), "");
  const spec = mediaCloud.__test.cleanSpec({
    codec: "javascript",
    width: 999999,
    height: -5,
    fps: 900,
    sourceAssetIds: Array.from({ length: 250 }, (_, index) => `asset-${index}`)
  });
  assert.equal(spec.codec, "h264");
  assert.equal(spec.width, 16384);
  assert.equal(spec.height, 16);
  assert.equal(spec.fps, 120);
  assert.equal(spec.sourceAssetIds.length, 200);
});

test("Media upload metadata and share tokens are bounded and one-way hashed", () => {
  const parsed = mediaCloud.__test.parseClientPayload(JSON.stringify({
    projectId: "a".repeat(24),
    name: "../<unsafe>.png",
    mimeType: "image/png",
    size: 42,
    checksum: "ABCDEF12"
  }));
  assert.equal(parsed.projectId, "a".repeat(24));
  assert.equal(parsed.mimeType, "image/png");
  assert.equal(parsed.size, 42);
  assert.doesNotMatch(parsed.name, /[<>/]/);
  assert.equal(mediaCloud.__test.hashToken("secret").length, 64);
  assert.notEqual(mediaCloud.__test.hashToken("secret"), "secret");
});

test("Media Cloud reuses the dynamic store function and never exposes private Blob paths", () => {
  const route = read(path.join("api", "store", "[resource].js"));
  const service = read(path.join("services", "mediaCloud.js"));
  assert.match(route, /resource === "media"[\s\S]*mediaCloud\.handler/);
  assert.match(service, /handleUpload/);
  assert.match(service, /issueSignedToken/);
  assert.match(service, /presignUrl/);
  assert.match(service, /projection:\s*\{\s*blobUrl:\s*0,\s*pathname:\s*0/);
  assert.match(service, /SHARE_PASSWORD_REQUIRED/);
  assert.match(service, /timingSafeEqual/);
  assert.match(service, /render:worker-update/);
  assert.doesNotMatch(read("media-next-suite.js"), /BLOB_READ_WRITE_TOKEN|MEDIA_RENDER_WORKER_TOKEN|MEDIA_AI_WORKER_TOKEN/);
});
