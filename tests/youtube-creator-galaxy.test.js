const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function loadApi() {
  const window = {
    dispatchEvent() {},
    addEventListener() {},
    MediaRecorder: function MediaRecorder() {}
  };
  const context = {
    window,
    CustomEvent: function CustomEvent(type, init) { return { type, ...init }; },
    HTMLCanvasElement: function HTMLCanvasElement() {},
    navigator: { onLine: true },
    location: { origin: "https://example.test", hash: "#/davinci-resolve/youtube", search: "", pathname: "/" },
    history: { replaceState() {} },
    localStorage: { getItem() { return null; }, setItem() {} },
    Intl,
    Date,
    Math,
    URL,
    setTimeout,
    clearTimeout
  };
  context.HTMLCanvasElement.prototype = { captureStream() {} };
  vm.runInNewContext(read("youtube-creator-galaxy.js"), context);
  return window.HHYouTubeCreatorGalaxy;
}

test("Tool exposes one YouTube Creator Galaxy route with fourteen real workspaces", () => {
  const shell = read("script.js");
  const client = read("youtube-creator-galaxy.js");
  assert.match(shell, /id: "youtube"[\s\S]{0,220}\/davinci-resolve\/youtube/);
  for (const feature of [
    "HHYouTubePublisher.mount",
    "saveThumbnailToMediaPool",
    "videos/update",
    "captions/upload",
    "comments/drafts/send",
    "comments/moderate",
    "live/create",
    "live/transition",
    "run-preflight"
  ]) assert.match(client, new RegExp(feature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("Creator utilities normalize drafts, parse captions and calculate an explained local score", () => {
  const api = loadApi();
  assert.equal(api.modules.length, 14);
  const normalized = api.normalizeState({ seo: { title: "Test" }, calendar: "invalid" });
  assert.equal(normalized.seo.title, "Test");
  assert.equal(normalized.calendar.length, 0);
  const captions = api.parseCaptions("1\n00:00:00,000 --> 00:00:02,000\nXin chào\n\n2\n00:00:02,000 --> 00:00:04,000\nHH Galaxy");
  assert.equal(captions.length, 2);
  assert.equal(captions[0].caption, "Xin chào");
  const score = api.seoScore({ seo: {
    keyword: "youtube",
    title: "Hướng dẫn YouTube Creator Galaxy chuyên nghiệp",
    description: "0:00 YouTube Creator Galaxy\n" + "youtube ".repeat(20),
    tags: "youtube,creator,galaxy"
  } });
  assert.ok(score.score >= 70);
  assert.equal(score.checks.length, 7);
});

test("YouTube backend keeps tokens server-side and implements data, analytics, community, caption and live routes", () => {
  const server = read("utils/youtubePublisher.js");
  const security = read("utils/youtubeSecurity.js");
  for (const route of [
    'route === "dashboard"',
    'route === "videos"',
    'route === "analytics"',
    'route === "analytics/retention"',
    'route === "analytics/comparison"',
    'route === "project"',
    'route === "audit"',
    'route === "comments/drafts"',
    'route === "comments/drafts/send"',
    'route === "comments/reply"',
    'route === "comments/moderate"',
    'route === "videos/update"',
    'route === "captions/upload"',
    'route === "live/create"',
    'route === "live/transition"',
    'route === "channels/overview"',
    'route === "bulk/preflight"',
    'route === "bulk/jobs"',
    'route === "bulk/upload/sessions"'
  ]) assert.match(server, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(server, /yt-analytics\.readonly/);
  assert.match(security, /AES|aes-256-gcm/i);
  assert.match(server, /safeReturnHash/);
  assert.doesNotMatch(read("youtube-creator-galaxy.js"), /GOOGLE_CLIENT_SECRET|YOUTUBE_TOKEN_ENCRYPTION_KEY\s*=/);
});

test("Creator OS uses verified project gates, retention data, audit ledger and explicit comment approval", () => {
  const client = read("youtube-creator-galaxy.js");
  const server = read("utils/youtubePublisher.js");
  for (const capability of [
    "universalProjectPayload",
    "automationReadiness",
    "retentionData",
    "audienceWatchRatio",
    "approved: true",
    "quotaLedger",
    "idempotencyKey"
  ]) assert.match(client, new RegExp(capability.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const capability of [
    "youtubePublishProjects",
    "youtubeCommentDrafts",
    "youtubeAudits",
    "observedQuota",
    "retentionAnalytics",
    "YOUTUBE_COMMENT_APPROVAL_REQUIRED"
  ]) assert.match(server, new RegExp(capability.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("Granular OAuth scopes are enforced before Google operations", () => {
  const server = read("utils/youtubePublisher.js");
  for (const [route, permission] of [
    ["videos", "manage"],
    ["analytics", "analytics"],
    ["analytics/retention", "analytics"],
    ["comments", "manage"],
    ["videos/update", "manage"],
    ["captions/upload", "manage"],
    ["live/create", "manage"],
    ["upload/session", "upload"],
    ["thumbnail/session", "upload"]
  ]) {
    const pattern = new RegExp(`route === "${route.replace("/", "\\/")}"[\\s\\S]{0,180}requireYoutubePermission\\(connection, "${permission}"\\)`);
    assert.match(server, pattern);
  }
});

test("Missing Analytics scope offers incremental OAuth without blocking approved tools", () => {
  const client = read("youtube-creator-galaxy.js");
  const server = read("utils/youtubePublisher.js");
  assert.match(client, /Thiếu quyền YouTube Analytics/);
  assert.match(client, /data-ycg-action="connect-analytics"/);
  assert.match(client, /data-ycg-module="command"/);
  assert.match(client, /channelStatus\.permissions\?\.analytics && !comparisonData/);
  assert.match(server, /const analyticsPermission = hasYoutubePermission\(connection, "analytics"\)/);
  assert.match(server, /analyticsPermission \? settledResult/);
  assert.match(server, /Kênh chưa cấp quyền yt-analytics\.readonly; các chức năng YouTube Data API vẫn hoạt động\./);
});

test("OAuth callback feedback survives the first automatic refresh", () => {
  const client = read("youtube-creator-galaxy.js");
  assert.match(client, /if \(!connected && !oauthError\) return false;/);
  assert.match(client, /async function refresh\(all = true, preserveError = false\)/);
  assert.match(client, /if \(!preserveError\) errorMessage = "";/);
  assert.match(client, /const hasOauthResult = handleOauthResult\(\);/);
  assert.match(client, /refresh\(true, hasOauthResult\);/);
});

test("Studio control deck exposes owner-isolated channels, scoped rights and bulk navigation", () => {
  const client = read("youtube-creator-galaxy.js");
  const server = read("utils/youtubePublisher.js");
  for (const feature of [
    "Creator Studio Control Deck",
    "Multi-channel studio overview",
    "data-ycg-channel-select",
    "open-fleet",
    "Bulk Studio",
    "channel.permissions",
    "Jobs running"
  ]) assert.match(client, new RegExp(feature.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  assert.match(server, /permissions:\s*\{[\s\S]{0,220}upload:[\s\S]{0,120}manage:[\s\S]{0,120}analytics:/);
  assert.match(server, /ownerIsolated: true/);
});

test("Quick Publish Studio supports channel presets, thumbnail A/B/C, private-first upload and shortcuts", () => {
  const client = read("youtube-creator-galaxy.js");
  const server = read("utils/youtubePublisher.js");
  const css = read("youtube-creator-galaxy.css");
  for (const capability of [
    "Quick Publish Studio",
    "THUMBNAIL FAST LANE",
    "data-ycg-channel-preset",
    "generateFleetThumbnailVariants",
    "runConcurrent",
    "uploadPrivateFirst",
    "retryFleetChannel",
    "approveFleetPublish",
    "handleKeydown",
    "Ctrl Enter",
    "data-ycg-fleet-drop"
  ]) assert.match(client, new RegExp(capability.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(client, /filter\(\(channelId\) => !completedIds\.has\(channelId\)\)/);
  assert.match(client, /connectionDownlink > 0 && connectionDownlink < 3 \? 1/);
  assert.match(server, /body\.channels/);
  assert.match(server, /YOUTUBE_CHANNEL_NOT_OWNED/);
  assert.match(server, /YOUTUBE_SCHEDULE_INVALID/);
  assert.match(server, /route === "bulk\/publish\/approve"/);
  assert.match(server, /YOUTUBE_PUBLISH_APPROVAL_REQUIRED/);
  assert.match(server, /connectionFor\(db, user, clean\(body\.channelId, 120\)\)/);
  assert.match(css, /"Be Vietnam Pro"/);
  assert.match(css, /\.ycg-quick-form/);
  assert.match(css, /\.ycg-metadata-table/);
});

test("New YouTube Studio text is valid UTF-8 Vietnamese without known mojibake", () => {
  const client = read("youtube-creator-galaxy.js");
  for (const expected of ["Quản lý", "Đã kết nối", "Chưa kiểm tra", "Lên lịch", "Thử lại kênh này"]) {
    assert.match(client, new RegExp(expected));
  }
  assert.doesNotMatch(client, /Quáº|Ä|ChÆ°a|LÃªn|â€¦/);
});

test("Multi-channel Studio manages one hundred private channels and ten-video task queues", () => {
  const client = read("youtube-creator-galaxy.js");
  const server = read("utils/youtubePublisher.js");
  const css = read("youtube-creator-galaxy.css");
  for (const capability of [
    "YOUTUBE MULTI-CHANNEL STUDIO",
    "Quản lý ${channels.length} kênh trong một nơi",
    "Kéo tối đa 10 video vào đây",
    "multiple accept=",
    "fleetUploadFiles.length * selectedChannels.length",
    "maxTasksPerBatch",
    "uploadQueuedFleetFile",
    "taskKey: `${fingerprint}::${channelId}`",
    "channels/observatory",
    "fleetSelectionCapacity"
  ]) assert.match(client, new RegExp(capability.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(client, /runConcurrent\(fleetUploadFiles, 1/);
  assert.match(client, /for \(let offset = 0; offset < eligibleChannelIds\.length; offset \+= chunkSize\)/);
  assert.match(server, /const CHANNEL_VAULT_LIMIT = 100/);
  assert.match(server, /const VIDEO_QUEUE_LIMIT = 10/);
  assert.match(server, /const BULK_TASK_LIMIT = 100/);
  assert.match(server, /route === "channels\/observatory"/);
  assert.match(server, /route === "channels\/refresh-bulk"/);
  assert.match(server, /ownedConnectionsForIds\(db, user, body\.channelIds\)/);
  assert.match(server, /String\(bundle\.channel\.channelId\) !== String\(connection\.channelId\)/);
  assert.match(server, /uploads\.find\(\{ userId: user\._id \}\)/);
  assert.match(server, /commentDrafts\.find\(\{ userId: user\._id, status: "draft" \}\)/);
  assert.match(server, /YOUTUBE_CHANNEL_VAULT_LIMIT/);
  assert.match(css, /\.ycg-studio-channel-table/);
  assert.match(css, /\.ycg-task-table/);
  assert.match(css, /\.ycg-shell\[data-ycg-active="fleet"\]/);
});

test("Creator Galaxy supports private multi-channel accounts without shared browser drafts", () => {
  const client = read("youtube-creator-galaxy.js");
  const server = read("utils/youtubePublisher.js");
  assert.match(client, /data-ycg-channel-select/);
  assert.match(client, /channel\/select/);
  assert.match(client, /sessionStorage\.getItem\(privateStorageKey\(\)\)/);
  assert.match(client, /sessionStorage\.setItem\(privateStorageKey\(\)/);
  assert.match(client, /ownerId: currentIdentityId\(\)/);
  assert.match(client, /hh:auth-change/);
  assert.match(client, /GOOGLE VERIFICATION READINESS/);
  assert.match(server, /PERMISSION_SCOPE_PRESETS/);
  assert.match(server, /ownerIsolated: true/);
  assert.match(server, /YOUTUBE_CHANNEL_OWNERSHIP_MISMATCH/);
  assert.match(server, /YOUTUBE_BULK_PUBLIC_BLOCKED/);
  assert.match(server, /userId: user\._id, idempotencyKey/);
  assert.doesNotMatch(client, /localStorage\.setItem\(STORAGE_KEY/);
});

test("Privacy Policy discloses Google data processing, sharing and revocation", () => {
  const privacy = read("privacy.html");
  for (const disclosure of [
    "google-api-data",
    "Google API Services",
    "MongoDB Atlas",
    "Vercel",
    "Google/YouTube",
    "Limited Use",
    "thu hồi",
    "revoke"
  ]) assert.match(privacy, new RegExp(disclosure, "i"));
});

test("Creator Galaxy assets are lazy-loaded, cached and versioned", () => {
  const index = read("index.html");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  for (const asset of ["youtube-creator-galaxy.css?v=7", "youtube-creator-galaxy.js?v=11"]) {
    const pattern = new RegExp(asset.replace(/[.?]/g, "\\$&"));
    assert.match(index, pattern);
    assert.match(loader, pattern);
    assert.match(worker, pattern);
  }
  assert.match(worker, /const CACHE = "hh-identity-portal-v\d+";/);
});

test("Creator Galaxy keeps mobile layouts, focus visibility and reduced motion", () => {
  const css = read("youtube-creator-galaxy.css");
  const shell = read("app-shell.css");
  assert.match(css, /@media\(max-width:600px\)/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /scroll-snap-type:x mandatory/);
  assert.match(shell, /grid-template-rows:\s*minmax\(0,\s*1fr\)/);
  assert.match(shell, /\.app-main\s*\{\s*grid-row:\s*1;[\s\S]*?height:\s*100%/);
});
