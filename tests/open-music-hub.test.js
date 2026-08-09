const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createHash } = require("node:crypto");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const manifest = JSON.parse(read("assets/open-media/curated-music-v1.json"));

function loadMusicInternals() {
  const source = read("open-music-hub.js");
  const marker = "  const api = Object.freeze({ mount, unmount, inspect, focusSearch, version: VERSION });";
  assert.ok(source.includes(marker), "music module test hook marker must remain stable");
  const instrumented = source.replace(marker, `  global.__HHMusicTest = Object.freeze({ resolveOwnerScope, sanitizePalette, paletteStyle, safeFilename, createLicensePack, isCreatorReady, fallbackRightsValidation });\n${marker}`);
  const sandbox = { window: { URL } };
  vm.runInNewContext(instrumented, sandbox);
  return sandbox.window.__HHMusicTest;
}

test("open music catalog contains only explicitly allowed commercial licenses", () => {
  const allowed = new Set(["CC0-1.0", "PDM-1.0", "CC-BY-3.0", "CC-BY-4.0", "CC-BY-SA-3.0", "CC-BY-SA-4.0"]);
  assert.equal(manifest.manifestVersion, 2);
  assert.equal(manifest.items.length, 20);
  assert.equal(new Set(manifest.items.map((item) => item.id)).size, manifest.items.length);
  assert.deepEqual([...new Set(manifest.items.map((item) => item.rights.licenseCode))].sort(), ["CC-BY-3.0", "CC-BY-4.0", "CC-BY-SA-4.0", "CC0-1.0", "PDM-1.0"]);
  for (const item of manifest.items) {
    assert.equal(item.kind, "track");
    assert.equal(item.playback.type, "audio");
    assert.ok(allowed.has(item.rights.licenseCode), `${item.id} has a blocked license`);
    assert.equal(item.rights.commercialAllowed, true);
    assert.equal(item.rights.derivativesAllowed, true);
    assert.match(item.rights.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(item.rights.attributionText, /Wikimedia Commons/);
    assert.match(item.rights.licenseUrl, /^https:\/\/creativecommons\.org\//);
    assert.match(item.source.landingUrl, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    assert.match(item.playback.url, /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/transcoded\//);
    assert.match(item.playback.fallbackUrl, /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//);
    assert.ok(Number(item.durationSeconds) > 0);
    assert.ok(Array.isArray(item.genres) && item.genres.length > 0);
    assert.ok(Array.isArray(item.moods) && item.moods.length > 0);
    const snapshot = JSON.stringify(item.rights.evidence.sourceMetadataSnapshot);
    assert.equal(
      item.rights.evidence.metadataChecksum,
      `sha256:${createHash("sha256").update(snapshot).digest("hex")}`,
      `${item.id} evidence checksum must match its stored metadata snapshot`
    );
  }
  assert.doesNotMatch(JSON.stringify(manifest.items), /CC-BY-NC|CC-BY-ND|\"NC\"|\"ND\"/i);
});

test("music module exposes stable mount API and compatibility alias", () => {
  const source = read("open-music-hub.js");
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  const api = sandbox.window.HHOpenMusicHub;
  assert.ok(api);
  assert.equal(api, sandbox.window.HHMusicLibrary);
  assert.equal(api.version, "2.0.0");
  assert.equal(typeof api.mount, "function");
  assert.equal(typeof api.unmount, "function");
  assert.equal(typeof api.inspect, "function");
  assert.equal(typeof api.focusSearch, "function");
  assert.equal(api.inspect().manifestUrl, "/assets/open-media/curated-music-v1.json");
});

test("rights guard validates every record before exposing it to the player", () => {
  const source = read("open-music-hub.js");
  assert.match(source, /HHOpenMediaRights/);
  assert.match(source, /rightsApi\.validateGovernanceItem\(item/);
  assert.match(source, /ALLOWED_LICENSES/);
  assert.match(source, /commercialAllowed === true/);
  assert.match(source, /derivativesAllowed === true/);
  assert.match(source, /state\.rejected/);
  assert.match(source, /Rights Guard/);
  assert.doesNotMatch(source, /jamendo|spotify|youtube|soundcloud|free music archive/i);
});

test("player implements real playback, queue and resilient source fallback", () => {
  const source = read("open-music-hub.js");
  assert.match(source, /<audio data-omh-audio preload="metadata"><\/audio>/);
  assert.match(source, /audio\.play\(\)/);
  assert.match(source, /audio\.pause\(\)/);
  assert.match(source, /data-omh-seek/);
  assert.match(source, /data-omh-volume/);
  assert.match(source, /function nextTrack/);
  assert.match(source, /function previousTrack/);
  assert.match(source, /state\.shuffle/);
  assert.match(source, /state\.repeat/);
  assert.match(source, /crossfadeTo/);
  assert.match(source, /data-omh-audio-standby/);
  assert.match(source, /queue-add/);
  assert.match(source, /queue-remove/);
  assert.match(source, /retryTrackWithFallback/);
  assert.match(source, /track\.playback\.fallbackUrl/);
  assert.match(source, /Mở nguồn/);
});

test("favorites, history and progress are isolated by authenticated owner", () => {
  const source = read("open-music-hub.js");
  assert.match(source, /const STORAGE_PREFIX = "hh\.open-music-hub\.v1"/);
  assert.match(source, /\["owner", user\?\.ownerId\]/);
  assert.match(source, /encodeOwnerIdentity/);
  assert.match(source, /storageKey = `\$\{STORAGE_PREFIX\}:\$\{ownerScope\}`/);
  assert.match(source, /function mount\(target, options = \{\}\)/);
  assert.match(source, /resolveOwnerScope\(options\)/);
  assert.match(source, /favorites: \[\.\.\.state\.favorites\]/);
  assert.match(source, /history: state\.history/);
  assert.match(source, /progress: state\.progress/);
  assert.match(source, /resetRuntimeState\(\)/);
  assert.match(source, /localStorage\?\.setItem\(storageKey/);
});

test("owner storage encoding is stable and cannot collide after punctuation sanitization", () => {
  const { resolveOwnerScope } = loadMusicInternals();
  const scopes = [
    resolveOwnerScope({ currentUser: { ownerId: "creator+a@example.com" } }),
    resolveOwnerScope({ currentUser: { ownerId: "creator a@example.com" } }),
    resolveOwnerScope({ currentUser: { ownerId: "creator-a@example.com" } })
  ];
  assert.equal(new Set(scopes).size, scopes.length);
  assert.equal(resolveOwnerScope({ currentUser: { ownerId: "creator+a@example.com" } }), scopes[0]);
  assert.match(scopes[0], /^owner-[0-9a-f]+$/);
  assert.notEqual(
    resolveOwnerScope({ currentUser: { ownerId: "same" } }),
    resolveOwnerScope({ currentUser: { ownerId: " same" } })
  );
  assert.notEqual(
    resolveOwnerScope({ currentUser: { id: "same" } }),
    resolveOwnerScope({ currentUser: { sub: "same" } })
  );
  assert.equal(resolveOwnerScope({ currentUser: null }), "guest");
});

test("manifest palettes accept canonical color values and block CSS declaration injection", () => {
  const { sanitizePalette, paletteStyle } = loadMusicInternals();
  assert.deepEqual(
    Array.from(sanitizePalette(["#ABC", "rgb(12, 34, 56)", "hsl(360, 50%, 25%)"])),
    ["#abc", "rgb(12, 34, 56)", "hsl(0, 50%, 25%)"]
  );
  const unsafe = ["#fff;--stolen:url(https://evil.test)", "red", "var(--secret)"];
  assert.deepEqual(Array.from(sanitizePalette(unsafe)), ["#5ee7ff", "#755cff", "#ff6da8"]);
  const style = paletteStyle({ colors: unsafe });
  assert.equal(style, "--omh-c1:#5ee7ff;--omh-c2:#755cff;--omh-c3:#ff6da8");
  assert.doesNotMatch(style, /url\(|stolen|var\(|background/i);
});

test("Media Session and keyboard controls remain progressive enhancements", () => {
  const source = read("open-music-hub.js");
  assert.match(source, /navigator\?\.mediaSession/);
  assert.match(source, /new global\.MediaMetadata/);
  assert.match(source, /previoustrack/);
  assert.match(source, /nexttrack/);
  assert.match(source, /seekbackward/);
  assert.match(source, /seekforward/);
  assert.match(source, /setPositionState/);
  assert.match(source, /event\.code === "Space"/);
  assert.match(source, /event\.altKey && event\.key === "ArrowRight"/);
});

test("one-page responsive UI keeps license and source information visible", () => {
  const source = read("open-music-hub.js");
  const css = read("open-music-hub.css");
  assert.match(source, /omh-license-badge/);
  assert.match(source, /omh-rights-card/);
  assert.match(source, /Xem giấy phép/);
  assert.match(source, /Nguồn gốc/);
  assert.match(source, /data-omh-search/);
  assert.match(source, /data-omh-license/);
  assert.match(source, /data-omh-genre/);
  assert.match(css, /height:calc\(100dvh - 112px\)/);
  assert.match(css, /overflow:hidden/);
  assert.match(css, /body\.app-music-library-route \.app-mobile-nav/);
  assert.match(css, /@media\(max-width:620px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.omh-library[\s\S]*overflow-y:auto/);
  assert.match(css, /\.omh-queue[\s\S]*overflow-y:auto/);
});

test("music governance defaults to deny and separates published CC from manual PDM review", () => {
  assert.equal(manifest.governance.defaultDeny, true);
  assert.deepEqual(manifest.governance.requiredLayers, ["composition", "performance", "masterRecording", "artwork"]);
  const published = manifest.items.filter((item) => item.rights.reviewStatus === "published");
  const review = manifest.items.filter((item) => item.rights.reviewStatus === "review");
  assert.equal(published.length, 17);
  assert.equal(review.length, 3);
  assert.ok(review.every((item) => item.rights.licenseCode === "PDM-1.0"));
  for (const item of manifest.items) {
    assert.match(item.source.itemId, /^File:/);
    assert.equal(typeof item.rights.shareAlike, "boolean");
    assert.equal(item.rights.rehostAllowed, false);
    assert.equal(item.rights.downloadAllowed, false);
    assert.deepEqual(Object.keys(item.rights.layers).sort(), ["artwork", "composition", "masterRecording", "performance"]);
    assert.match(item.rights.evidence.metadataChecksum, /^sha256:[a-f0-9]{64}$/);
    assert.equal(item.rights.evidence.mediaChecksumStatus, "unavailable");
    assert.equal(item.rights.evidence.mediaChecksum, null);
    assert.equal(item.rights.evidence.mediaChecksumAlgorithm, null);
    assert.equal(item.rights.evidence.checksumScope, "remote-playback");
    assert.equal(item.rights.evidence.sourceAuthority, "primary-rights-record");
  }
});

test("Creator Mode and License Pack require real layered rights and preserve TASL evidence", () => {
  const { isCreatorReady, createLicensePack, safeFilename } = loadMusicInternals();
  const published = manifest.items.find((item) => item.rights.reviewStatus === "published");
  const manual = manifest.items.find((item) => item.rights.reviewStatus === "review");
  assert.equal(isCreatorReady(published), true);
  assert.equal(isCreatorReady(manual), false);
  const pack = createLicensePack(published);
  assert.match(pack.credits, /Title:/);
  assert.match(pack.credits, /Author:/);
  assert.match(pack.credits, /Source:/);
  assert.match(pack.credits, /License:/);
  assert.equal(pack.json.item.evidence.mediaChecksum, null);
  assert.equal(pack.json.item.contentIdEvidence.mediaChecksumStatus, "unavailable");
  assert.equal(pack.json.item.permissions.rehost, false);
  assert.equal(pack.json.item.permissions.download, false);
  assert.doesNotMatch(safeFilename("../Tệp: thử?*"), /[\\/:*?"<>|]/);
});

test("music hub checks emergency rights registry without allowing it to elevate local content", () => {
  const source = read("open-music-hub.js");
  assert.match(source, /fetch\("\/api\/open-media\/rights"/);
  assert.match(source, /isEmergencyBlocked/);
  assert.match(source, /emergency-suspension/);
  assert.match(source, /record\.available === false/);
  assert.match(source, /validateGovernanceItem/);
  assert.match(source, /href="#\/copyright"/);
});
