"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../social-media-tools-core.js");

test("catalog exposes the complete 85-tool ecosystem without duplicate ids", () => {
  assert.equal(core.TOOL_CATALOG.length, 85);
  assert.equal(new Set(core.TOOL_CATALOG.map((tool) => tool.id)).size, 85);
  assert.ok(core.TOOL_CATALOG.some((tool) => tool.id === "instagram-filter" && tool.mode === "local"));
  assert.ok(core.TOOL_CATALOG.some((tool) => tool.id === "social-listening" && tool.mode === "provider"));
  assert.ok(core.TOOL_CATALOG.some((tool) => tool.id === "analytics" && tool.mode === "provider"));
  assert.ok(core.TOOL_CATALOG.some((tool) => tool.id === "instagram-owned-media" && tool.mode === "provider"));
});

test("local social utility engines produce valid reusable output", () => {
  const metrics = core.textMetrics("Xin chào 👋 #HH", "x");
  assert.equal(metrics.words, 4); assert.equal(metrics.limit, 280); assert.ok(metrics.bytes >= metrics.characters);
  assert.equal(core.transformText("xin CHÀO", "upper"), "XIN CHÀO");
  assert.equal(core.normalizeSocialText("  Một   hai\n\n\nba  "), "Một hai\n\nba");
  assert.deepEqual(core.cleanHashtags("#HH, hh #Việt-Nam").items, ["HH", "ViệtNam"]);
  assert.equal(core.profileUrl("instagram", "@hoang8"), "https://www.instagram.com/hoang8");
  assert.match(core.buildShareUrl({ provider:"whatsapp", phone:"+84 90", text:"Xin chào", url:"https://hoang8.com/" }), /^https:\/\/wa\.me\/8490\?text=/);
  const embed = core.buildYouTubeEmbed("dQw4w9WgXcQ", { start:42 }); assert.match(embed.src, /youtube-nocookie\.com/); assert.match(embed.html, /start=42/);
  assert.ok(core.SOCIAL_DIMENSIONS.some((item) => item.platform === "YouTube" && item.width === 1280));
});

test("caption formatter deduplicates hashtags and counters use Unicode characters", () => {
  assert.equal(core.formatCaption({ hook:"Mở đầu", body:"Nội dung", cta:"Xem ngay", hashtags:["HH","#HH","Việt_Nam"] }), "Mở đầu\n\nNội dung\n\nXem ngay\n\n#HH #Việt_Nam");
  const stats = core.captionStats("Xin chào 👋 #HH https://hoang8.com", "x");
  assert.equal(stats.limit, 280); assert.equal(stats.hashtags[0], "#HH"); assert.equal(stats.links.length, 1); assert.equal(stats.characters, [..."Xin chào 👋 #HH https://hoang8.com"].length);
});

test("thread splitter keeps every generated post inside platform limits", () => {
  const parts = core.splitThread(Array.from({ length: 180 }, (_, index) => `từ${index}`).join(" "), "x");
  assert.ok(parts.length > 1); assert.ok(parts.every((part) => [...part].length <= 280));
  assert.equal(parts.join(" ").split(/\s+/).length, 180);
});

test("crop, UTM, Open Graph and filename utilities validate input", () => {
  assert.deepEqual(core.cropSize("9:16", 1080), { width:1080, height:1920, ratio:"9:16" });
  assert.throws(() => core.cropSize("2:3"), /không hợp lệ/);
  assert.equal(new URL(core.buildUtm({ url:"https://hoang8.com/", source:"Facebook Ads", medium:"Social", campaign:"Mùa Hè" })).searchParams.get("utm_campaign"), "mua-he");
  assert.throws(() => core.buildUtm({ url:"http://unsafe.test" }), /HTTPS/);
  const og = core.buildOpenGraph({ title:'A "safe" title', description:"Mô tả", url:"https://hoang8.com", image:"https://hoang8.com/image.png" });
  assert.match(og.html, /&quot;safe&quot;/); assert.equal(og.jsonLd["@context"], "https://schema.org");
  assert.equal(core.filename("Ảnh Thử Nghiệm.JPG", "png"), "anh-thu-nghiem.png");
});

test("RBAC, OAuth state, owner storage key and queue transitions are fail-closed", () => {
  assert.equal(core.roleCan("publisher", "publish"), true); assert.equal(core.roleCan("publisher", "manage"), false); assert.equal(core.roleCan("analyst", "edit"), false);
  assert.match(core.createOAuthState(), /^[a-f0-9]{64}$/); assert.notEqual(core.createOAuthState(), core.createOAuthState());
  assert.equal(core.nextJobState("failed", "retry"), "retry-scheduled"); assert.equal(core.nextJobState("published", "retry"), "");
  assert.notEqual(core.storageKey("user-a", "workspace-1", "draft"), core.storageKey("user-b", "workspace-1", "draft"));
  assert.match(core.idempotencyKey({ ownerId:"a",workspaceId:"w",projectId:"p",provider:"x" }), /^a:w:p:manual:x:now$/);
});

test("local store never loads another owner workspace", () => {
  const values = new Map(); const storage = { getItem:(key)=>values.get(key)||null, setItem:(key,value)=>values.set(key,value) };
  const a = core.createStore({ storage, currentUser:{ id:"owner-a" }, workspaceId:"alpha" }); a.update((state)=>({ ...state, caption:"riêng tư" }));
  const b = core.createStore({ storage, currentUser:{ id:"owner-b" }, workspaceId:"alpha" }); assert.equal(b.get().caption, "");
  assert.throws(() => b.replace({ ...b.get(), ownerId:"owner-a" }), /không thuộc workspace/);
});

test("MIME detector checks magic bytes instead of extension", async () => {
  const png = new File([Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])], "fake.jpg", { type:"image/jpeg" });
  assert.equal((await core.detectMime(png)).allowed, false);
  const json = new File(["{\"ok\":true}"], "safe.json", { type:"application/json" }); assert.equal((await core.detectMime(json)).allowed, true);
});
