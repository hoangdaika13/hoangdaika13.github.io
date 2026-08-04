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
    'route === "videos/delete"',
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
    ["videos/delete", "manage"],
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
    "Quản lý nhiều kênh trong một nơi",
    "Kéo tối đa 10 video vào đây",
    "multiple accept=",
    "selectedMatrixTasks",
    "maxTasksPerBatch",
    "uploadQueuedFleetFile",
    "matrixTaskKey",
    "channels/observatory",
    "fleetSelectionCapacity"
  ]) assert.match(client, new RegExp(capability.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(client, /Math\.ceil\(actualTasks \/ maxTasks\)/);
  assert.match(client, /for \(let batchIndex = 0; batchIndex < taskBatches\.length/);
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

test("Batch Matrix, continuous queue, Content Manager and bulk calendar are real owner-isolated workflows", () => {
  const client = read("youtube-creator-galaxy.js");
  const server = read("utils/youtubePublisher.js");
  const css = read("youtube-creator-galaxy.css");
  for (const capability of [
    "BATCH UPLOAD MATRIX",
    "Ma trận video × kênh",
    "Continuous Channel Queue",
    "data-ycg-matrix-mode",
    "queue-pause-all",
    "pauseFleetTask",
    "cancelFleetTask",
    "sampledFileChecksum",
    "Content Manager",
    "data-ycg-content-open",
    "VIDEO DETAIL",
    "content/processing/refresh",
    "Lịch tháng",
    "Timeline theo kênh",
    "Chưa xếp lịch",
    "calendar-distribute",
    "calendar-confirm",
    "zonedLocalToIso"
  ]) assert.match(client, new RegExp(capability.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const route of ["content/library", "content/processing/refresh", "video/details", "content/schedule/bulk"]) assert.match(server, new RegExp(`route === "${route.replace("/", "\\/")}"`));
  assert.match(server, /route === "upload\/pause"/);
  assert.match(server, /"Content-Range": `bytes \*\/\$\{Number\(record\.totalBytes/);
  assert.match(server, /queueVideoCount > VIDEO_QUEUE_LIMIT/);
  assert.match(server, /taskKey: channelPayload\.taskKey/);
  assert.match(server, /videoFingerprint: channelPayload\.videoFingerprint/);
  assert.match(server, /metadataVersion: channelPayload\.metadataVersion/);
  assert.match(server, /checksum: channelPayload\.checksum/);
  assert.match(server, /uploads\.find\(\{ userId: user\._id/);
  assert.match(server, /connectionFor\(db, user, clean\(body\.channelId, 120\)\)/);
  assert.match(server, /YOUTUBE_PUBLISH_APPROVAL_REQUIRED/);
  assert.match(css, /\.ycg-batch-matrix/);
  assert.match(css, /\.ycg-content-table/);
  assert.match(css, /\.ycg-video-drawer/);
  assert.match(css, /\.ycg-calendar-month/);
});

test("Content Manager supports bulk YouTube-style AI disclosure and guarded permanent deletion", () => {
  const client = read("youtube-creator-galaxy.js");
  const server = read("utils/youtubePublisher.js");
  const css = read("youtube-creator-galaxy.css");
  for (const capability of [
    "AI_DISCLOSURE_OPTIONS",
    "data-ycg-matrix-ai",
    "data-ycg-action=\"content-open-ai-disclosure\"",
    "data-ycg-ai-bulk-form",
    "Sử dụng AI",
    "Tạo ra một cảnh trông giống thật mà không thực sự xảy ra",
    "data-ycg-content-delete",
    "data-ycg-content-delete-current",
    "data-ycg-delete-form",
    "reauthenticateForDelete",
    "AUTH_RECENT_REQUIRED",
    "YouTube đã trả HTTP 204"
  ]) assert.match(client, new RegExp(capability.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const capability of [
    'route === "videos/delete"',
    "youtubeVideoDeclarations",
    "youtubeDestructiveActions",
    "youtubeVideoTombstones",
    "requireRecentAuthentication",
    "YOUTUBE_DELETE_CONFIRMATION_INVALID",
    "YOUTUBE_AI_DISCLOSURE_REQUIRED",
    "providerStatus: 204",
    "recoverable: false"
  ]) assert.match(server, new RegExp(capability.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(server, /String\(video\.snippet\?\.channelId \|\| ""\) !== String\(connection\.channelId\)/);
  assert.match(server, /userId: user\._id, channelId: connection\.channelId, videoId/);
  assert.match(css, /\.ycg-delete-dialog/);
  assert.match(css, /\.ycg-ai-bulk-dialog/);
  assert.match(css, /\.ycg-ai-badge/);
  assert.doesNotMatch(client, /data-ycg-content-ai-filter/);
  assert.doesNotMatch(client, /<th>AI<\/th>/);
});

test("Video details use a dedicated Studio workspace with honest owner-isolated data", () => {
  const client = read("youtube-creator-galaxy.js");
  const server = read("utils/youtubePublisher.js");
  const css = read("youtube-creator-galaxy.css");
  for (const capability of [
    "videoWorkspaceRoute",
    "videoStudioWorkspaceMarkup",
    "data-ycg-video-back",
    "data-ycg-video-section",
    "video-save-private",
    "video-load-analytics",
    "video-load-comments",
    "beforeunload",
    "Không có qua Data API"
  ]) assert.match(client, new RegExp(capability.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const route of ['route === "video/analytics"', 'route === "video/comments"']) assert.match(server, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(server, /YOUTUBE_CHANNEL_OWNERSHIP_MISMATCH/);
  assert.match(css, /\.ycg-video-workspace-grid\{display:grid;grid-template-columns:190px/);
  assert.match(css, /\.ycg-shell\.is-video-workspace/);
});

test("video workspace returns to the exact Content Manager state from both back buttons", () => {
  const client = read("youtube-creator-galaxy.js");
  assert.match(client, /function returnToContentManager\(\)/);
  assert.match(client, /function handleShellBack\(event\)/);
  assert.match(client, /\[data-shell-back\]/);
  assert.match(client, /event\.stopImmediatePropagation\(\)/);
  assert.match(client, /location\.replace\(target\)/);
  assert.match(client, /contentScrollTop[\s\S]*contentDrawer = \{ loading: false/);
  assert.match(client, /document\.addEventListener\("click", handleShellBack, \{ signal: controller\.signal, capture: true \}\)/);
});

test("Content Manager sorts every Studio column with arrows and filters each channel directly", () => {
  const client = read("youtube-creator-galaxy.js");
  const css = read("youtube-creator-galaxy.css");
  for (const capability of ["contentSortBy", "contentSort", "data-ycg-content-sort-column", "↑", "↓", "↕", "data-ycg-content-channel-button", "Lọc nội dung theo từng kênh"]) {
    assert.match(client, new RegExp(capability.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const column of ["title", "channel", "status", "processing", "privacy", "date", "metrics"]) assert.match(client, new RegExp(`sortableHeader\\("${column}"`));
  assert.match(client, /localeCompare\([\s\S]*sensitivity: "base", numeric: true/);
  assert.match(css, /\.ycg-content-channel-rail/);
  assert.match(css, /\[data-ycg-content-sort-column\]/);
  assert.doesNotMatch(client, /data-ycg-content-sort=/);
  assert.doesNotMatch(client, />Z → A<|>A → Z</);
});

test("Content Manager edits visibility inline with YouTube safeguards", () => {
  const client = read("youtube-creator-galaxy.js");
  const css = read("youtube-creator-galaxy.css");
  for (const capability of ["data-ycg-content-privacy", "data-content-key", "quick-privacy-", "Video chưa có Video ID", "nội dung AI trước khi chuyển video thành Public", "Chuyển “${item.title || item.fileName || \"video\"}” thành Public", "videos/update", "updateContentItemByKey"]) {
    assert.match(client, new RegExp(capability.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(client, /privacyStatus,\s*publishAt: "",\s*aiDisclosure:[\s\S]*approved: true/);
  assert.match(css, /\.ycg-quick-privacy/);
});

test("Multi-channel Studio presents one simple cosmic workspace", () => {
  const client = read("youtube-creator-galaxy.js");
  const css = read("youtube-creator-galaxy.css");
  for (const label of ["Tổng quan", "Đăng video", "Lịch đăng", "Bình luận", "Phân tích", "Tiến trình"]) assert.match(client, new RegExp(label));
  assert.match(client, /aria-label="Công cụ quản lý kênh"/);
  assert.match(client, /Đăng video, xếp lịch, phản hồi và phân tích mà không rời Studio/);
  assert.match(client, /<th>Trạng thái<\/th><th>Đồng bộ<\/th>/);
  assert.doesNotMatch(client, /<th>Nội dung<\/th><th>Tác vụ<\/th><th>Phản hồi<\/th>/);
  assert.match(client, /ycg-channel-library"><header><div>[\s\S]{0,240}<\/div><\/header>/);
  assert.doesNotMatch(client, /ycg-channel-library"><header>[\s\S]{0,400}connect-creator/);
  assert.match(css, /\.ycg-shell\[data-ycg-active="fleet"\] \.ycg-map\{display:none\}/);
  assert.match(css, /radial-gradient\(circle at 10% 2%,#1f75a84a/);
  assert.match(css, /\.ycg-studio-metrics\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)\}/);
});

test("Studio embeds essential calendar, comments and analytics without returning to the legacy map", () => {
  const client = read("youtube-creator-galaxy.js");
  assert.match(client, /FLEET_STUDIO_TABS = Object\.freeze\(\["overview", "content", "calendar", "comments", "analytics", "queue", "settings"\]\)/);
  assert.match(client, /fleetState\.studioTab === "calendar" \? calendarView\(true\)/);
  assert.match(client, /fleetState\.studioTab === "comments" \? commentsView\(\)/);
  assert.match(client, /fleetState\.studioTab === "analytics" \? analyticsView\(\)/);
  assert.match(client, /state\.active = "fleet";[\s\S]{0,180}saveFleetState\(\)/);
  assert.match(client, /function hydrateFleetStudioTab\(tab\)/);
});

test("Studio provides owner-isolated real channel customization and upload defaults", () => {
  const client = read("youtube-creator-galaxy.js");
  const server = read("utils/youtubePublisher.js");
  const css = read("youtube-creator-galaxy.css");
  for (const capability of ["channelSettingsMarkup", "data-ycg-settings-section", "data-ycg-settings-channel", "data-ycg-channel-profile-form", "data-ycg-upload-defaults-form", "data-ycg-channel-api-settings-form", "data-ycg-channel-moderation-form", "Hồ sơ", "Chế độ mặc định cho video", "Kiểm duyệt cộng đồng"]) assert.match(client, new RegExp(capability));
  assert.match(client, /fleetState\.studioTab === "settings" \? channelSettingsMarkup\(channels\)/);
  assert.match(client, /api\("channel\/settings", "POST"/);
  assert.match(server, /route === "channel\/settings"/);
  assert.match(server, /requireYoutubePermission\(connection, "manage"\)/);
  assert.match(server, /part: "snippet,brandingSettings,status"/);
  assert.match(server, /method: "PUT"/);
  assert.match(server, /action: "channel:settings-update"[\s\S]{0,180}quotaCost: 50/);
  assert.match(server, /YOUTUBE_CHANNEL_OWNERSHIP_MISMATCH/);
  assert.match(css, /\.ycg-channel-settings-grid/);
});

test("Home launch intent opens Quick Publish once and rejects another owner or stale state", () => {
  const api = loadApi();
  const now = Date.now();
  assert.equal(api.validLaunchIntentTab({ tab: "content", ownerId: "owner-a", at: now }, "owner-a", now), "content");
  assert.equal(api.validLaunchIntentTab({ tab: "content", ownerId: "owner-a", at: now }, "owner-b", now), "");
  assert.equal(api.validLaunchIntentTab({ tab: "content", ownerId: "owner-a", at: now - 300001 }, "owner-a", now), "");
  assert.equal(api.validLaunchIntentTab({ tab: "not-a-tab", ownerId: "owner-a", at: now }, "owner-a", now), "");
  const client = read("youtube-creator-galaxy.js");
  assert.match(client, /sessionStorage\.removeItem\(CREATOR_LAUNCH_INTENT_KEY\)/);
  assert.match(client, /const launchTab = consumeLaunchIntent\(\)/);
  assert.match(client, /if \(launchTab\) fleetState\.studioTab = launchTab/);
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
  for (const asset of ["youtube-creator-galaxy.css?v=16", "youtube-creator-galaxy.js?v=21"]) {
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
