const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Music AI exposes independent app workspaces", () => {
  const apps = read("music-ai-apps.js");
  const studio = read("music-ai-studio.js");
  const shell = read("script.js");
  for (const route of ["app-center", "concept-lab", "image-lab", "music-lab", "veo-lab", "render-lab", "youtube-publisher"]) {
    assert.match(apps, new RegExp(route));
    assert.match(shell, new RegExp(`/music-ai/${route}`));
  }
  assert.match(studio, /HHMusicAIApps\?\.mount/);
  assert.match(apps, /window\.HHMusicAIApps/);
  assert.match(apps, /hh\.music-ai\.apps\.v1/);
});

test("Every media app has its own real provider action and controls", () => {
  const client = read("music-ai-apps.js");
  const server = read("api/modules/[moduleId]/actions.js");
  for (const action of ["music-image", "music-track", "music-video-start", "music-video-status"]) {
    assert.match(client, new RegExp(action));
  }
  assert.match(client, /referenceImages/);
  assert.match(client, /aspectRatio/);
  assert.match(client, /imageSize/);
  assert.match(client, /outputFormat/);
  assert.match(client, /durationSeconds/);
  assert.match(server, /function musicReferenceImages/);
  assert.match(server, /gemini-3\.1-flash-image/);
  assert.match(server, /veo-3\.1-fast-generate-preview/);
  assert.match(server, /music_v2/);
  assert.match(server, /AbortSignal\.timeout\(22000\)/);
  assert.doesNotMatch(client, /GEMINI_API_KEY|ELEVENLABS_API_KEY|GOOGLE_CLIENT_SECRET/);
});

test("Local render supports images and videos without uploading project media", () => {
  const source = read("music-ai-apps.js");
  assert.match(source, /type\?\.startsWith\("image\/"\)/);
  assert.match(source, /-loop 1 -i/);
  assert.match(source, /-stream_loop -1 -i/);
  assert.match(source, /-movflags \+faststart/);
  assert.match(source, /download-bat/);
  assert.match(source, /download-render-project/);
});

test("YouTube connection supports Google account selection and multiple channels", () => {
  const server = read("utils/youtubePublisher.js");
  const client = read("youtube-publisher.js");
  assert.match(server, /prompt: "consent select_account"/);
  assert.match(server, /route === "channel\/select"/);
  assert.match(server, /channels: allConnections\.map\(publicChannel\)/);
  assert.match(server, /channelId: 1/);
  assert.match(client, /data-yap-channel-select/);
  assert.match(client, /Thêm tài khoản\/kênh/);
  assert.match(client, /HH không yêu cầu hoặc lưu mật khẩu Google/);
});
