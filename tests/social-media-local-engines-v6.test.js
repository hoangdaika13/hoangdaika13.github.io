"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

global.HHSocialMediaCore = require("../social-media-tools-core.js");
const core = global.HHSocialMediaCore;
const engines = require("../social-media-local-engines.js");

function project(overrides = {}) {
  return {
    ...core.defaultProject({}),
    title:"HH Studio",
    caption:"Xin chào cộng đồng #HH",
    altText:"Một người đang chỉnh sửa video trên máy tính trong phòng sáng.",
    canonicalUrl:"https://hoang8.com/campaign?ref=home",
    imageUrl:"https://hoang8.com/preview.png",
    imageWidth:1200,
    imageHeight:630,
    utmSource:"facebook",
    utmMedium:"social",
    utmCampaign:"mùa hè",
    sourceUrl:"dQw4w9WgXcQ",
    startSeconds:42,
    phone:"84901234567",
    ...overrides
  };
}

test("V6 exposes an explicit, immutable registry and fails closed without a generic fallback", () => {
  const expected = [
    "alt-text-checker", "social-character-counter", "case-converter", "whitespace-cleaner", "hashtag-workspace", "hashtag-cleaner",
    "utm-builder", "username-link-builder", "whatsapp-link", "telegram-link", "social-share-link", "youtube-timestamp", "youtube-embed",
    "open-graph", "link-preview-audit", "social-dimensions", "unicode-font-styler", "emoji-picker", "bio-link", "caption-formatter", "x-revenue"
  ];
  assert.equal(engines.version, 6);
  assert.deepEqual(Object.keys(engines.registry).sort(), expected.sort());
  assert.ok(Object.isFrozen(engines.registry));
  assert.ok(Object.values(engines.registry).every((entry) => entry.version === 6 && typeof entry.validate === "function" && typeof entry.process === "function" && entry.applyBack && entry.exports.length));
  assert.equal(new Set(Object.values(engines.registry).map((entry) => entry.process)).size, expected.length);
  assert.equal(engines.engineFor("not-real"), null);
  assert.equal(engines.validate("not-real", {}).valid, false);
  assert.throws(() => engines.run("not-real", {}), /Đang phát triển/);
});

test("Alt Text audits concrete accessibility problems, compares the active asset and stores before/after history", () => {
  const input = project({
    altText:"Ảnh của sản phẩm đẹp!!! https://example.com/photo.jpg",
    assets:[{ id:"asset-1", name:"red-bike-launch.jpg" }],
    activeAsset:0,
    altTextHistory:[{ before:"cũ", after:"mới", at:"2026-01-01T00:00:00.000Z" }]
  });
  const result = engines.run("alt-text-checker", input, { now:"2026-08-13T10:00:00.000Z" });
  assert.ok(result.score < 100);
  assert.ok(["redundant-prefix", "url", "filename", "punctuation"].every((code) => result.issues.some((item) => item.code === code)));
  assert.equal(result.comparison.assetId, "asset-1");
  assert.ok(result.comparison.missingFilenameHints.includes("bike"));
  assert.equal(result.apply.altTextHistory.length, 2);
  assert.equal(result.apply.altTextHistory.at(-1).at, "2026-08-13T10:00:00.000Z");
  assert.match(result.exports.csv.data, /redundant-prefix/);
  assert.match(result.exports.json.data, /asset-1/);
});

test("multi-platform counter reports raw, grapheme and effective X URL lengths", () => {
  const caption = "Xin chào 👨‍👩‍👧‍👦 https://hoang8.com/a-very-long-campaign-address #HH";
  const result = engines.run("social-character-counter", project({ caption, socialProvider:"x" }));
  const x = result.rows.find((row) => row.platform === "x");
  const instagram = result.rows.find((row) => row.platform === "instagram");
  assert.equal(result.rows.length, 12);
  assert.equal(x.limit, 280);
  assert.notEqual(x.characters, x.rawCharacters);
  assert.equal(instagram.characters, instagram.rawCharacters);
  assert.ok(x.graphemes < x.rawCharacters);
  assert.equal(result.apply.socialProvider, "x");
  assert.match(result.csv, /effective_characters/);
});

test("case and whitespace processors preserve Vietnamese while exposing apply-back and audit details", () => {
  const sentence = engines.run("case-converter", project({ caption:"xIN CHÀO! tÔI là ĐẶNG.", textMode:"sentence" }));
  assert.equal(sentence.output, "Xin chào! Tôi là đặng.");
  assert.equal(sentence.apply.caption, sentence.output);
  assert.equal(sentence.variants.upper, "XIN CHÀO! TÔI LÀ ĐẶNG.");
  assert.equal(engines.run("case-converter", project({ caption:"Tiếng Việt Đẹp", textMode:"kebab" })).output, "tieng-viet-dep");

  const cleaned = engines.run("whitespace-cleaner", project({ caption:"\ufeff  Một\t hai  \r\n\r\n\r\nba  \u00a0" }));
  assert.equal(cleaned.output, "Một hai\n\nba");
  assert.equal(cleaned.stats.tabs, 1);
  assert.equal(cleaned.stats.zeroWidth, 1);
  assert.ok(cleaned.removed > 0);
  assert.equal(cleaned.apply.caption, cleaned.output);
});

test("Hashtag Lab accepts list mode, removes duplicates, respects user blocks, groups and exports every decision", () => {
  const result = engines.run("hashtag-workspace", project({
    caption:"HH, #hh; #Video #bị-chặn #CreativeCommunity #OfficialHH",
    blockedHashtags:"video",
    brandHashtags:"OfficialHH",
    socialProvider:"instagram"
  }));
  assert.deepEqual(result.allowed, ["HH", "bịchặn", "CreativeCommunity", "OfficialHH"]);
  assert.deepEqual(result.duplicates, ["hh"]);
  assert.deepEqual(result.blocked, ["Video"]);
  assert.ok(result.groups.brand.includes("#OfficialHH"));
  assert.ok(Array.isArray(result.suggestions));
  assert.match(result.output, /GỢI Ý BỔ SUNG/);
  assert.match(result.output, /^#HH /);
  assert.match(result.csv, /duplicate/);

  const withoutHashes = engines.run("hashtag-cleaner", project({ caption:"sáng_tạo, video; cộngđồng" }));
  assert.deepEqual(withoutHashes.allowed, ["sáng_tạo", "video", "cộngđồng"]);
});

test("each link engine performs its own strict validation and returns reusable link data", () => {
  assert.throws(() => engines.run("utm-builder", project({ canonicalUrl:"http://unsafe.test" })), /HTTPS/);
  const utm = engines.run("utm-builder", project({ utmTerm:"máy ảnh", utmContent:"banner a" }));
  const utmUrl = new URL(utm.output);
  assert.equal(utmUrl.searchParams.get("utm_campaign"), "mua-he");
  assert.equal(utm.params.utm_term, "may-anh");
  assert.equal(utm.qrPayload, utm.output);

  const profile = engines.run("username-link-builder", project({ socialProvider:"tiktok", title:"@hoang.8" }));
  assert.equal(profile.output, "https://www.tiktok.com/@hoang.8");
  assert.throws(() => engines.run("username-link-builder", project({ title:"tên có khoảng trắng" })), /Username/);

  const whatsapp = engines.run("whatsapp-link", project({ caption:"Xin chào", canonicalUrl:"https://hoang8.com/deal" }));
  assert.match(whatsapp.output, /^https:\/\/wa\.me\/84901234567\?text=/);
  assert.throws(() => engines.run("whatsapp-link", project({ phone:"090123" })), /8–15/);

  const timestamp = engines.run("youtube-timestamp", project());
  assert.equal(new URL(timestamp.output).searchParams.get("t"), "42s");
  const embed = engines.run("youtube-embed", project());
  assert.match(embed.src, /youtube-nocookie\.com/);
  assert.equal(embed.security.lazy, true);
});

test("metadata provides four specialized previews and audits the 1200×630 image", () => {
  const result = engines.run("link-preview-audit", project({ title:"T".repeat(70), caption:"Mô tả chiến dịch" }));
  assert.deepEqual(Object.keys(result.previews), ["google", "facebook", "x", "linkedin"]);
  assert.equal(result.image.meetsMinimum, true);
  assert.equal(result.image.ratioClose, true);
  assert.ok(result.warnings.some((item) => item.code === "search-truncation"));
  assert.match(result.apply.metadataHtml, /og:title/);
  assert.match(result.exports.html.data, /application\/ld\+json/);
  assert.match(result.csv, /twitter:card/);
  assert.throws(() => engines.run("open-graph", project({ imageUrl:"javascript:alert(1)" })), /HTTPS/);
});

test("dimensions creates an exact canvas contract with safe-zone and exports the complete catalog", () => {
  const result = engines.run("social-dimensions", project({ socialProvider:"youtube", dimensionAsset:"Thumbnail", safeZonePercent:8 }));
  assert.equal(result.selected.platform, "YouTube");
  assert.equal(result.selected.asset, "Thumbnail");
  assert.deepEqual({ width:result.canvas.width, height:result.canvas.height }, { width:1280, height:720 });
  assert.equal(result.canvas.safeZone.percent, 8);
  assert.equal(result.apply.ratio, "16:9");
  assert.match(result.csv, /orientation/);
});

test("Unicode, emoji and bio engines are fully local, accessible-by-warning and safe to apply back", () => {
  const font = engines.run("unicode-font-styler", project({ caption:"Hello Đẹp 123", textStyle:"bold" }));
  assert.notEqual(font.output, "Hello Đẹp 123");
  assert.ok(font.unsupported.includes("Đ"));
  assert.equal(font.accessibility.screenReaderSafe, false);
  assert.equal(font.apply.plainTextCaption, "Hello Đẹp 123");

  const emoji = engines.run("emoji-picker", project({ caption:"Ra mắt", emojiQuery:"tên lửa", selectedEmoji:"🚀", recentEmojis:["🔥"] }));
  assert.equal(emoji.matches[0].emoji, "🚀");
  assert.equal(emoji.apply.caption, "Ra mắt 🚀");
  assert.deepEqual(emoji.apply.recentEmojis, ["🚀", "🔥"]);

  const bio = engines.run("bio-link", project({ title:"<HH Studio>", caption:"Sáng tạo mỗi ngày", bioLinks:[{ label:"Trang chủ", url:"https://hoang8.com" }, { label:"Video", url:"https://youtube.com/@hoang8" }] }));
  assert.equal(bio.links.length, 2);
  assert.doesNotMatch(bio.html, /<HH Studio>/);
  assert.match(bio.html, /&lt;HH Studio&gt;/);
  assert.equal(bio.apply.bioLinks.length, 2);
  assert.match(bio.exports.html.data, /rel="noopener noreferrer"/);
});

test("all registered engines emit output, validation, apply-back and declared export data for valid projects", () => {
  const overrides = {
    "emoji-picker":{ selectedEmoji:"✨" },
    "bio-link":{ bioLinks:[{ label:"Home", url:"https://hoang8.com" }] },
    "username-link-builder":{ socialProvider:"instagram", title:"hoang8" },
    "social-share-link":{ shareProvider:"x" },
    "unicode-font-styler":{ textStyle:"mono" }
  };
  for (const [id, contract] of Object.entries(engines.registry)) {
    const result = engines.run(id, project(overrides[id]));
    assert.equal(result.validation.valid, true, id);
    assert.equal(typeof result.apply, "object", id);
    assert.ok(contract.exports.filter((format) => format !== "qr").every((format) => result.exports[format]), `${id} thiếu export đã khai báo`);
    assert.ok("output" in result, `${id} thiếu output`);
  }
});
