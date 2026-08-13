"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ObjectId } = require("mongodb");
const handler = require("../utils/social-media-handler.js");

const api = handler.__test;
const source = fs.readFileSync(path.resolve(__dirname, "../utils/social-media-handler.js"), "utf8");

function vaultDb(fixtures, observed) {
  return {
    collection(name) {
      if (!Object.prototype.hasOwnProperty.call(fixtures, name)) throw new Error(`Unexpected collection ${name}`);
      return {
        find(query, options) {
          observed.push({ name, query, options });
          const cursor = {
            sort() { return cursor; },
            limit() { return cursor; },
            async toArray() { return fixtures[name]; }
          };
          return cursor;
        }
      };
    }
  };
}

test("official vault resolver derives publish capabilities without reading a synthetic account store", async () => {
  const ownerId = new ObjectId(), observed = [];
  const db = vaultDb({
    facebookPageConnections: [{
      pageId: "page-1", pageName: "Page", active: true,
      grantedPermissions: ["pages_read_engagement", "pages_manage_posts", "instagram_content_publish"],
      tasks: ["MODERATE"], accessToken: "must-never-leak",
      instagramAccount: { id: "ig-1", username: "brand", canPublish: true, canManageComments: true }
    }],
    tiktokConnections: [{ connectionId: "tt-1", active: true, scopes: ["user.info.basic", "video.publish", "user.info.stats"], encryptedAccessToken: "cipher" }],
    youtubeConnections: [{ channelId: "yt-1", active: true, scopes: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/yt-analytics.readonly", refreshToken: "secret" }]
  }, observed);
  const accounts = await api.officialAccounts(db, ownerId, "workspace-a");

  assert.deepEqual(new Set(accounts.map((item) => item.provider)), new Set(["facebook", "instagram", "tiktok", "youtube"]));
  assert.equal(accounts.find((item) => item.provider === "facebook").capabilities.publish, true);
  assert.equal(accounts.find((item) => item.provider === "instagram").capabilities.comments, true);
  assert.equal(accounts.find((item) => item.provider === "tiktok").adapter, "tiktok-creator-manager");
  assert.equal(accounts.find((item) => item.provider === "youtube").restrictions.resumableUpload, true);
  assert.ok(observed.every((call) => String(call.query.userId) === String(ownerId)));
  assert.ok(observed.every((call) => call.options.projection.accessToken === 0 && call.options.projection.encryptedAccessToken === 0));
  assert.doesNotMatch(JSON.stringify(accounts), /must-never-leak|cipher|refreshToken/i);
  assert.doesNotMatch(source, /collection\(["']social_accounts["']\)/);
});

test("inactive or under-scoped official connections fail closed", () => {
  const revoked = api.accountFromVault("tiktok", { connectionId: "x", active: false, scopes: ["video.publish"] });
  const missingScope = api.accountFromVault("youtube", { channelId: "y", active: true, scopes: "youtube.readonly" });
  assert.equal(revoked.capabilities.publish, false);
  assert.equal(missingScope.capabilities.publish, false);
  assert.equal(api.accountFromVault("unknown", {}, "w"), null);
});

test("publishing state machine supports approval, worker processing, pause/retry/cancel and truthful completion", () => {
  assert.equal(api.transition("draft", "review"), "awaiting-review");
  assert.equal(api.transition("awaiting-review", "approve"), "approved");
  assert.equal(api.transition("approved", "publish"), "publishing");
  assert.equal(api.transition("publishing", "acknowledge"), "processing");
  assert.equal(api.transition("processing", "pause"), "paused");
  assert.equal(api.transition("paused", "resume"), "publishing");
  assert.equal(api.transition("failed", "retry"), "retry-scheduled");
  assert.equal(api.transition("retry-scheduled", "cancel"), "cancelled");
  assert.equal(api.transition("published", "retry"), "");
  assert.match(source, /PROVIDER_CONFIRMATION_REQUIRED/);
  assert.match(source, /body\.confirmed!==true/);
});

test("schedule validation requires an explicit offset, a valid IANA timezone and a bounded future date", () => {
  const reference = new Date("2030-01-01T00:00:00.000Z");
  assert.equal(api.validateSchedule("2030-02-01T09:00:00+07:00", "Asia/Bangkok", reference).valid, true);
  assert.equal(api.validateSchedule("2030-02-01T09:00:00", "Asia/Bangkok", reference).code, "SCHEDULE_OFFSET_REQUIRED");
  assert.equal(api.validateSchedule("2030-02-01T09:00:00Z", "Mars/Olympus", reference).code, "TIMEZONE_INVALID");
  assert.equal(api.validateSchedule("2029-12-31T23:59:00Z", "UTC", reference).code, "SCHEDULE_PAST");
  assert.equal(api.validateSchedule("2032-01-01T00:00:00Z", "UTC", reference).code, "SCHEDULE_TOO_FAR");
});

test("provider handoff contains routing IDs but never OAuth material", () => {
  const job = {
    _id: new ObjectId(), ownerId: new ObjectId(), workspaceId: "w", accountId: "yt-1",
    provider: "youtube", adapter: "youtube-publisher", projectId: "project-1", requestId: "request-1",
    idempotencyKey: "key-1", accessToken: "provider-secret", encryptedRefreshToken: "cipher"
  };
  const handoff = api.providerHandoff(job);
  assert.equal(handoff.requestId, "request-1");
  assert.equal(handoff.adapter, "youtube-publisher");
  assert.equal(handoff.state, "queued");
  assert.equal(handoff.accessToken, undefined);
  assert.equal(handoff.encryptedRefreshToken, undefined);
  assert.match(source, /social_provider_handoffs/);
  assert.match(source, /ownerId:user\._id,workspaceId,accountId/);
});

test("manual fallback package is usable and recursively removes token-like fields", () => {
  const job = { projectId: "p", provider: "tiktok", accountId: "tt", requestId: "r", timezone: "UTC", scheduledAt: null };
  const project = { title: "Campaign", platform: "tiktok", payload: { caption: "Xin chào", accessToken: "leak", nested: { password: "leak2", safe: "yes" } } };
  const pkg = api.manualPackage(job, project);
  assert.equal(pkg.format, "hh-social-manual-package-v1");
  assert.equal(pkg.manifest.requiresHumanPublish, true);
  assert.equal(pkg.files.find((item) => item.name === "caption.txt").content, "Xin chào");
  assert.doesNotMatch(JSON.stringify(pkg), /leak|accessToken|password/);
});

test("analytics keeps native metric identity, stable dedupe keys and latest snapshots without historical sums", () => {
  const context = { ownerId: "owner", workspaceId: "w", accountId: "a", provider: "youtube", eventId: "event-1" };
  const input = { snapshotId: "snap-1", source: "youtube-analytics-api", syncedAt: "2030-01-03T00:00:00Z", metrics: [
    { nativeMetric: "views", metric: "view", value: 120, periodStart: "2030-01-01", periodEnd: "2030-01-02" },
    { nativeMetric: "estimatedMinutesWatched", metric: "watch-time", value: 88, unit: "minutes" },
    { nativeMetric: "broken", value: "not-a-number" }
  ] };
  const normalized = api.normalizeAnalyticsSnapshot(input, context);
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].nativeMetric, "views");
  assert.equal(normalized[1].unit, "minutes");
  assert.equal(api.normalizeAnalyticsSnapshot(input, context)[0].dedupeKey, normalized[0].dedupeKey);

  const older = { ...normalized[0], snapshotId: "old", value: 10, syncedAt: new Date("2030-01-02") };
  const providerPeer = { ...normalized[0], provider: "facebook", value: 999 };
  const latest = api.latestAnalyticsRows([older, normalized[0], providerPeer]);
  assert.equal(latest.length, 2);
  assert.equal(latest.find((item) => item.provider === "youtube").value, 120);
  assert.equal(latest.find((item) => item.provider === "facebook").value, 999);
  assert.match(source, /latest-snapshot-wins-per-provider-account-native-metric-period/);
});

test("inbox webhook records calculate SLA and spam while permanently disabling autonomous replies", () => {
  const reference = new Date("2030-01-01T00:00:00Z");
  const record = api.inboxRecord({
    externalMessageId: "message-1", conversationId: "conversation-1", authorName: "Visitor",
    body: "Kiếm tiền nhanh tại telegram.me/example https://a.test https://b.test https://c.test",
    priority: "urgent", labels: ["sales", "sales"]
  }, { ownerId: "o", workspaceId: "w", accountId: "a", provider: "facebook" }, reference);
  assert.equal(record.status, "spam");
  assert.equal(record.spamRisk, "high");
  assert.equal(record.slaDueAt.toISOString(), "2030-01-01T00:30:00.000Z");
  assert.equal(record.autoReply, false);
  assert.equal(record.replyPolicy, "draft-only-human-send-required");
  assert.equal(api.inboxRecord({}, {}, reference), null);
});

test("AI Copilot preserves the original, bounded variants and mandatory human review", () => {
  const record = api.aiRecord({
    action: "ab-variants", input: "Bản gốc", platform: "instagram", brandVoice: "Thân thiện", variantCount: 2
  }, { model: "test-model", output: "Phương án 1: Nội dung A\n---\nPhương án 2: Nội dung B" }, { ownerId: "owner", workspaceId: "w" });
  assert.equal(record.original.input, "Bản gốc");
  assert.equal(record.variants.length, 2);
  assert.ok(record.variants.every((item) => item.reviewStatus === "pending-human-review"));
  assert.equal(record.review.required, true);
  assert.equal(record.approvalStatus, "pending-human-review");
  assert.equal(record.autoPublish, false);
});

test("public serializers and source contract never deliver token vault fields", () => {
  const account = api.publicAccount({ _id: "a", accessToken: "x", encryptedAccessToken: "y", refreshToken: "z", provider: "youtube" });
  const job = api.publicJob({ _id: "j", ownerId: "owner", state: "draft", accessToken: "x" });
  assert.equal(account.accessToken, undefined);
  assert.equal(account.encryptedAccessToken, undefined);
  assert.equal(job.ownerId, undefined);
  assert.equal(job.accessToken, undefined);
  assert.match(source, /tokenDelivery:\s*"server-only"/);
  assert.match(source, /isolation:\s*"ownerId\+workspaceId\+accountId"/);
  assert.doesNotMatch(source, /return\s+res[^;]+(?:accessToken|refreshToken|encryptedAccessToken)/i);
});
