const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const registry = JSON.parse(read("assets/open-media/rights-registry-v2.json"));
const rights = require(path.join(root, "utils", "open-media-rights.js"));
const rightsApi = require(path.join(root, "utils", "open-media-server", "rights.js")).__test;
const noticesApi = require(path.join(root, "utils", "open-media-server", "notices.js")).__test;
const restrictionsApi = require(path.join(root, "utils", "open-media-server", "restrictions.js")).__test;
const governance = require(path.join(root, "open-media-governance.js"));

function metadataEvidence(record) {
  return {
    sourceRevision: "https://commons.wikimedia.org/w/index.php?title=File:Example.webm&oldid=123",
    checkedAt: "2026-08-10",
    metadataRecord: record,
    metadataChecksum: `sha256:${createHash("sha256").update(record).digest("hex")}`,
    metadataChecksumAlgorithm: "SHA-256",
    metadataChecksumScope: "embedded-evidence-record",
    mediaChecksumStatus: "verified-upstream",
    mediaChecksum: `sha1:${"a".repeat(40)}`,
    mediaChecksumAlgorithm: "SHA-1",
    mediaChecksumSource: "https://commons.wikimedia.org/wiki/File:Example.webm",
    mediaChecksumScope: "original-file",
    sourceAuthority: "primary-rights-record"
  };
}

function filmLayer(status = "cleared") {
  return status === "not-applicable"
    ? { status, reason: "Không cung cấp tài sản riêng trong phiên bản này." }
    : {
      status,
      rightsBasis: "cc-license",
      licenseCode: "CC-BY-4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      attributionText: "Example by Example Creator — CC BY 4.0",
      evidenceRef: "source.rightsEvidenceUrl"
    };
}

function governanceFilm(overrides = {}) {
  const metadataRecord = "id=governance-film\ncreator=Example Creator\nlicense=CC-BY-4.0\ncheckedAt=2026-08-10";
  const item = {
    id: "governance-film",
    kind: "film",
    title: "Governance film",
    creator: "Example Creator",
    source: {
      provider: "Wikimedia Commons",
      itemId: "File:Example.webm",
      landingUrl: "https://commons.wikimedia.org/wiki/File:Example.webm",
      rightsEvidenceUrl: "https://commons.wikimedia.org/wiki/File:Example.webm"
    },
    rights: {
      reviewStatus: "published",
      rightsBasis: "cc-license",
      licenseCode: "CC-BY-4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      attributionText: "Example by Example Creator — CC BY 4.0",
      verifiedAt: "2026-08-10",
      jurisdiction: "Creative Commons 4.0 International",
      territories: ["WORLDWIDE"],
      commercialAllowed: true,
      derivativesAllowed: true,
      streamAllowed: true,
      rehostAllowed: false,
      downloadAllowed: false,
      shareAlike: false,
      evidence: metadataEvidence(metadataRecord),
      layers: {
        master: filmLayer(),
        soundtrack: filmLayer(),
        poster: filmLayer(),
        subtitles: filmLayer("not-applicable"),
        privacyPublicity: filmLayer("not-applicable")
      }
    },
    playback: { type: "video", url: "https://upload.wikimedia.org/example.webm" }
  };
  return { ...item, ...overrides, rights: { ...item.rights, ...(overrides.rights || {}) } };
}

test("rights registry defaults to deny and quarantines every disputed legacy film", () => {
  assert.equal(registry.schemaVersion, 2);
  assert.equal(registry.policy.defaultDecision, "deny-until-cleared");
  assert.equal(registry.publicContact, "nhhoang130803@gmail.com");
  assert.deepEqual(registry.policy.automaticAllowlist, rights.autoAllowedLicenses);
  const quarantineIds = new Set(registry.quarantineItems.map((item) => item.id));
  for (const id of ["great-train-robbery-1903", "duck-and-cover-1951", "about-bananas-1935", "the-general-1926"]) {
    assert.ok(quarantineIds.has(id), id);
  }
  for (const item of registry.quarantineItems) {
    assert.equal(item.reviewStatus, "quarantine");
    assert.ok(item.reasonCode && item.reason && item.action);
    assert.equal(item.requiredLayers.master, "manual-review");
  }
});

test("governance gate publishes only a complete worldwide record", () => {
  const valid = governanceFilm();
  const result = rights.validateGovernanceItem(valid, { territory: "WORLDWIDE" });
  assert.equal(result.ok, true, result.errors.join(", "));
  assert.equal(result.publiclyAvailable, true);

  const restricted = governanceFilm({ rights: { territories: ["VN"] } });
  const blocked = rights.validateGovernanceItem(restricted, { territory: "WORLDWIDE" });
  assert.equal(blocked.publiclyAvailable, false);
  assert.ok(blocked.errors.includes("territory-not-cleared"));
  assert.equal(rights.validateGovernanceItem(restricted, { territory: "VN" }).publiclyAvailable, true);
});

test("unfingerprinted remote media can never be rehosted or downloaded", () => {
  const base = governanceFilm();
  const evidence = {
    ...base.rights.evidence,
    mediaChecksumStatus: "unavailable",
    mediaChecksum: null,
    mediaChecksumAlgorithm: null,
    mediaChecksumSource: null,
    mediaChecksumReason: "Upstream does not publish a hash for this exact transcode.",
    mediaChecksumScope: "remote-transcode-bytes"
  };
  const streamOnly = governanceFilm({ rights: { evidence, rehostAllowed: false, downloadAllowed: false } });
  const allowed = rights.validateGovernanceItem(streamOnly, { territory: "WORLDWIDE" });
  assert.equal(allowed.ok, true, allowed.errors.join(", "));

  const unsafe = governanceFilm({ rights: { evidence, rehostAllowed: true, downloadAllowed: true } });
  const rejected = rights.validateGovernanceItem(unsafe, { territory: "WORLDWIDE" });
  assert.ok(rejected.errors.includes("unfingerprinted-media-cannot-be-rehosted-or-downloaded"));
});

test("public rights record exposes fingerprint provenance without inventing a SHA-256", () => {
  const item = governanceFilm();
  const record = rights.publicRightsRecord(item, { territory: "WORLDWIDE" });
  assert.equal(record.eligible, true);
  assert.equal(record.evidence.mediaChecksumStatus, "verified-upstream");
  assert.equal(record.evidence.mediaChecksumAlgorithm, "SHA-1");
  assert.equal(record.evidence.checksumScope, "original-file");
  assert.match(record.evidence.mediaChecksum, /^sha1:[a-f0-9]{40}$/);
});

test("rights API is territory-aware and overlays quarantine before playback", () => {
  assert.equal(rightsApi.viewerTerritory({ headers: {} }), "WORLDWIDE");
  assert.equal(rightsApi.viewerTerritory({ headers: { "x-vercel-ip-country": "vn" } }), "VN");
  assert.equal(rightsApi.viewerTerritory({ headers: { "x-vercel-ip-country": "WORLDWIDE" } }), "WORLDWIDE");
  const summary = rightsApi.summary({ territory: "WORLDWIDE", restrictions: new Map() });
  assert.equal(summary.viewerTerritory, "WORLDWIDE");
  assert.equal(summary.items.length, summary.counts.total);
  for (const id of ["great-train-robbery-1903", "duck-and-cover-1951", "about-bananas-1935", "the-general-1926"]) {
    const item = summary.items.find((row) => row.id === id);
    if (!item) continue; // Removed items remain represented in the registry quarantine queue.
    assert.equal(item.available, false, id);
    assert.equal(item.reviewStatus, "quarantine", id);
  }
});

test("notice validation requires identity, authority, good faith and a same-origin target", () => {
  const valid = noticesApi.normalizedNotice({
    noticeType: "copyright",
    claimantName: "Nguyễn Văn A",
    email: "rights@example.com",
    originalWork: "Tác phẩm gốc do tôi sở hữu và có hồ sơ đăng ký.",
    rightsBasis: "Tôi là chủ sở hữu quyền tác giả của tác phẩm.",
    reportedItemId: "big-buck-bunny",
    reportedUrl: "https://hoang8.com/#/cinema",
    description: "Đây là mô tả đầy đủ về phần nội dung mà tôi cho rằng đang ảnh hưởng tới quyền của mình.",
    electronicSignature: "Nguyễn Văn A",
    goodFaith: true,
    accuracyConfirmed: true,
    authorityConfirmed: true
  });
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.doc.reportedUrl, "https://hoang8.com/#/cinema");
  assert.equal(noticesApi.validReportedUrl("https://attacker.example/steal"), "");
  assert.throws(() => noticesApi.assertSameOrigin({ headers: { origin: "https://attacker.example" } }), /hoang8\.com/);
  assert.doesNotThrow(() => noticesApi.assertSameOrigin({ headers: { origin: "https://hoang8.com" } }));
});

test("notice backend stores restrictions and never exposes provider secrets to the client", () => {
  const noticeSource = read("utils/open-media-server/notices.js");
  const rightsSource = read("utils/open-media-server/rights.js");
  const gatewaySource = read("api/store/[resource].js");
  const vercelConfig = read("vercel.json");
  const clientSource = read("open-media-governance.js");
  assert.match(noticeSource, /openMediaNotices/);
  assert.match(noticeSource, /enforceRateLimit/);
  assert.match(noticeSource, /assertSameOrigin/);
  assert.match(noticeSource, /process\.env\.RESEND_API_KEY/);
  assert.match(noticeSource, /openMediaRestrictions/);
  assert.match(rightsSource, /validateGovernanceItem/);
  assert.match(rightsSource, /private, no-store/);
  assert.match(rightsSource, /x-vercel-ip-country/);
  assert.match(gatewaySource, /rights[\s\S]*notices[\s\S]*restrictions/);
  assert.match(vercelConfig, /\/api\/open-media\/:openMediaAction/);
  assert.match(vercelConfig, /\/api\/store\/open-media\?openMediaAction=:openMediaAction/);
  assert.doesNotMatch(clientSource, /RESEND_API_KEY|MONGODB_URI|JWT_SECRET/);
  assert.match(clientSource, /\/api\/open-media/);
  assert.doesNotMatch(clientSource, /REALTIME_URL|apiBase/);
});

test("restoration is a separate reviewed action with HTTPS evidence", () => {
  assert.ok(restrictionsApi.CATALOG_IDS.size > 0);
  assert.equal(restrictionsApi.safeEvidenceUrl("javascript:alert(1)"), "");
  assert.equal(restrictionsApi.safeEvidenceUrl("https://rights.example/evidence/123"), "https://rights.example/evidence/123");
  const source = read("utils/open-media-server/restrictions.js");
  assert.match(source, /restorationDecision/);
  assert.match(source, /restorationEvidenceUrl/);
  assert.doesNotMatch(source, /DELETE/);
});

test("governance client exposes a complete SPA lifecycle and responsive UI", () => {
  assert.equal(governance.VERSION, "1.0.0");
  assert.equal(typeof governance.mount, "function");
  assert.equal(typeof governance.unmount, "function");
  assert.equal(typeof governance.openComplaint, "function");
  assert.deepEqual(governance.inspect(), {
    version: "1.0.0", mounted: false, view: "", loading: false, total: 0, quarantine: 0,
    isAdmin: false, caseCount: 0, apiRoot: "/api/open-media"
  });
  const js = read("open-media-governance.js");
  const css = read("open-media-governance.css");
  assert.match(js, /global\.HHOpenMediaGovernance = api/);
  assert.match(js, /data-omg-notice-form/);
  assert.match(js, /data-omg-case-status/);
  assert.match(js, /isAdminAccount/);
  assert.match(css, /@media \(max-width: 650px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /:focus-visible/);
});

test("copyright center is reachable from the shell and cached with aligned versions", () => {
  const shell = read("script.js");
  const loader = read("performance-loader.js");
  const html = read("index.html");
  const serviceWorker = read("sw.js");
  assert.match(shell, /id:\s*"copyright"[\s\S]*?route:\s*"\/copyright"/);
  assert.match(shell, /HHOpenMediaGovernance\?\.mount/);
  assert.match(shell, /HHOpenMediaGovernance\?\.unmount/);
  assert.match(shell, /nhhoang130803@gmail\.com/);
  assert.match(loader, /"open-media-governance"[\s\S]*?open-media-governance\.js\?v=1/);
  assert.match(loader, /utils\/open-media-rights\.js\?v=3/);
  assert.match(html, /performance-loader\.js\?v=263/);
  assert.match(html, /script\.js\?v=178/);
  assert.match(serviceWorker, /hh-identity-portal-v534/);
  for (const asset of [
    "open-media-governance.css?v=1",
    "open-media-governance.js?v=1",
    "assets/open-media/rights-registry-v2.json",
    "cinema-hub.css?v=4",
    "cinema-hub.js?v=3",
    "open-music-hub.css?v=4",
    "open-music-hub.js?v=3"
  ]) assert.match(serviceWorker, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), asset);
});
