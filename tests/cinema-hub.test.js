const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const manifest = JSON.parse(read("assets/open-media/curated-films-v1.json"));
const rightsEngine = require(path.join(root, "utils", "open-media-rights.js"));
const cinema = require(path.join(root, "cinema-hub.js"));
const sha256 = (value) => `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;

test("Cinema V2 publishes only governance-approved films", () => {
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.policy.mode, "fail-closed");
  assert.equal(manifest.items.length, 24);
  assert.equal(new Set(manifest.items.map((item) => item.id)).size, manifest.items.length);

  manifest.items.forEach((item) => {
    assert.equal(item.kind, "film");
    assert.equal(item.rights.reviewStatus, "published");
    assert.equal(item.rights.streamAllowed, true);
    assert.equal(item.rights.rehostAllowed, false);
    assert.equal(item.rights.downloadAllowed, false);
    assert.notEqual(item.rights.rightsBasis, "public-domain-mark");
    assert.equal(item.rights.shareAlike, /^CC-BY-SA-/.test(item.rights.licenseCode));
    assert.ok(Array.isArray(item.countries) && item.countries.length, `${item.id}: missing countries`);
    assert.ok(Array.isArray(item.regions) && item.regions.length, `${item.id}: missing regions`);
    assert.ok(item.contentType, `${item.id}: missing content type`);
    assert.ok(item.source.itemId && item.source.itemId !== item.id || item.source.provider === "Blender Open Movies");
    assert.deepEqual(item.rights.territories, ["WORLDWIDE"]);
    const verdict = rightsEngine.validateGovernanceItem(item, { requiredTerritory: "WORLDWIDE" });
    assert.equal(verdict.publiclyAvailable, true, `${item.id}: ${verdict.errors.join(", ")}`);
  });
});

test("Cinema keeps every unresolved film in a no-playback quarantine", () => {
  const expected = new Set(["great-train-robbery-1903", "duck-and-cover-1951", "about-bananas-1935", "the-general-1926", "le-voyage-dans-la-lune", "nosferatu-1922"]);
  assert.equal(manifest.quarantineItems.length, expected.size);
  manifest.quarantineItems.forEach((item) => {
    assert.ok(expected.delete(item.id), `unexpected quarantine item ${item.id}`);
    assert.equal(item.reviewStatus, "quarantine");
    assert.ok(item.source.itemId);
    assert.ok(item.reasonCodes.length);
    assert.equal(Object.hasOwn(item, "playback"), false);
    assert.equal(Object.hasOwn(item, "playbackUrl"), false);
  });
  assert.equal(expected.size, 0);
  assert.equal(cinema.normalizeQuarantine(manifest.quarantineItems).length, 6);
  assert.equal(cinema.normalizeCatalog([...manifest.items, ...manifest.quarantineItems], { territory: "VN" }).length, 24);
});

test("Evidence hashes are reproducible records, upstream hashes are never invented", () => {
  const byId = new Map(manifest.items.map((item) => [item.id, item]));
  manifest.items.forEach((item) => {
    const evidence = item.rights.evidence;
    assert.equal(evidence.metadataChecksum, sha256(evidence.metadataRecord), `${item.id} metadata evidence mismatch`);
    assert.equal(evidence.metadataChecksumScope, "embedded-evidence-record");
    if (evidence.mediaChecksum == null) {
      assert.equal(evidence.mediaChecksumStatus, "unavailable");
      assert.equal(item.rights.rehostAllowed, false);
      assert.equal(item.rights.downloadAllowed, false);
      assert.ok(evidence.mediaChecksumReason.length > 20);
    } else {
      assert.match(evidence.mediaChecksum, /^sha1:[a-f0-9]{40}$/);
      assert.equal(evidence.mediaChecksumStatus, "verified-upstream");
      assert.equal(evidence.mediaChecksumSource, "Wikimedia Commons structured data");
    }
    if (item.rights.manualReview) {
      assert.equal(item.rights.manualReview.evidenceChecksum, sha256(item.rights.manualReview.decisionRecord));
    }
  });
  assert.equal(byId.has("le-voyage-dans-la-lune"), false);
  assert.equal(byId.has("nosferatu-1922"), false);
  assert.doesNotMatch(JSON.stringify(manifest), /sha(?:1|256):0{20,}/i);
});

test("Territorial public-domain classics stay quarantined without playback", () => {
  const quarantineById = new Map(manifest.quarantineItems.map((item) => [item.id, item]));
  const moon = quarantineById.get("le-voyage-dans-la-lune");
  const nosferatu = quarantineById.get("nosferatu-1922");
  for (const item of [moon, nosferatu]) {
    assert.ok(item);
    assert.equal(item.reviewStatus, "quarantine");
    assert.ok(item.reasonCodes.includes("worldwide-basis-missing"));
    assert.equal(Object.hasOwn(item, "playback"), false);
    assert.equal(Object.hasOwn(item, "playbackUrl"), false);
  }
});

test("Cinema gates territory server-side and fails closed without geo evidence", () => {
  assert.equal(cinema.VERSION, "2.3.0");
  assert.equal(cinema.RIGHTS_STATUS_URL, "/api/open-media/rights");
  assert.equal(cinema.normalizeCatalog(manifest.items).length, 24, "VN-only records must not be inferred from browser state");
  assert.equal(cinema.normalizeCatalog(manifest.items, { territory: "VN" }).length, 24);
  const suspended = cinema.applyEmergencySuspensions(manifest.items, {
    items: [{ id: "sintel", available: false, reviewStatus: "suspended" }]
  });
  assert.equal(suspended.items.some((item) => item.id === "sintel"), false);
  assert.deepEqual(suspended.suspendedIds, ["sintel"]);
  const source = read("cinema-hub.js");
  assert.match(source, /validateGovernanceItem/);
  assert.match(source, /RIGHTS_STATUS_URL = "\/api\/open-media\/rights"/);
  assert.match(source, /emergencyTerritory/);
  assert.doesNotMatch(source, /navigator\.language.*territ/i);
});

test("Fallback validation rejects incomplete, quarantined and download-enabled records", () => {
  const safe = manifest.items[0];
  assert.equal(cinema.fallbackLicenseAllowed(safe), true);
  assert.equal(cinema.fallbackLicenseAllowed({ ...safe, rights: { ...safe.rights, reviewStatus: "quarantine" } }), false);
  assert.equal(cinema.fallbackLicenseAllowed({ ...safe, rights: { ...safe.rights, licenseUrl: "https://creativecommons.org/licenses/by-nc/3.0/" } }), false);
  assert.equal(cinema.fallbackLicenseAllowed({ ...safe, rights: { ...safe.rights, evidence: { ...safe.rights.evidence, metadataChecksum: null } } }), false);
  assert.equal(cinema.fallbackLicenseAllowed({ ...safe, playback: { ...safe.playback, type: "iframe" } }), false);
});

test("Cinema player includes viewing controls and an always-accessible rights panel", () => {
  const source = read("cinema-hub.js");
  assert.match(source, /<video data-cinema-video controls playsinline preload="metadata"/);
  assert.doesNotMatch(source, /<video[^>]*\bautoplay\b/i);
  assert.match(source, /data-cinema-player-error/);
  assert.match(source, /requestPictureInPicture/);
  assert.match(source, /requestFullscreen/);
  assert.match(source, /data-cinema-speed/);
  assert.match(source, /data-cinema-rights-card open/);
  assert.match(source, /\/copyright/);
  assert.match(source, /changesDescription/);
  assert.match(source, /territories/);
  assert.match(source, /sourceRevision/);
  for (const shortcut of ["arrowleft", "arrowright", 'key === "p"', 'key === "f"', 'key === "["', 'key === "]"', 'key === "r"']) {
    assert.match(source, new RegExp(shortcut.replace(/[\[\]]/g, "\\$&")));
  }
});

test("Cinema offers country, format and genre discovery filters", () => {
  const source = read("cinema-hub.js");
  assert.match(source, /data-cinema-filter="country"/);
  assert.match(source, /data-cinema-filter="format"/);
  assert.match(source, /data-cinema-filter="length"/);
  assert.match(source, /countryOptions/);
  assert.match(source, /formatOptions/);
  assert.ok(new Set(manifest.items.flatMap((item) => item.genres)).size >= 10);
  assert.ok(new Set(manifest.items.flatMap((item) => item.countries)).size >= 3);
});

test("Cinema includes longer films and protects sensitive playback", () => {
  const longFilms = manifest.items.filter((item) => item.durationSeconds >= 3600);
  assert.ok(longFilms.length >= 2);
  assert.ok(longFilms.some((item) => item.id === "paywall-business-scholarship"));
  const dominion = manifest.items.find((item) => item.id === "dominion-2018");
  assert.equal(dominion.sensitiveContent, true);
  assert.equal(dominion.ageRating, "18+");
  assert.ok(dominion.contentWarnings.length >= 2);
  const source = read("cinema-hub.js");
  assert.match(source, /data-cinema-content-consent/);
  assert.match(source, /contentConsents: new Set/);
});

test("Cinema persists owner-isolated continue, favorites, watchlist and speed", () => {
  const state = cinema.normalizeState({ favorites: ["a", "a"], watchlist: ["b", "b"], playbackRate: 1.5 });
  assert.deepEqual(state.favorites, ["a"]);
  assert.deepEqual(state.watchlist, ["b"]);
  assert.equal(state.playbackRate, 1.5);
  const source = read("cinema-hub.js");
  assert.match(source, /hh\.cinema\.hub\.v1/);
  assert.match(source, /storageKey\(runtime\.ownerId\)/);
  assert.match(source, /options\.currentUser/);
  assert.match(source, /MAX_HISTORY = 50/);
  assert.match(source, /data-cinema-view="watchlist"/);
});

test("Cinema exposes SPA lifecycle and compliance inspection", () => {
  assert.equal(typeof cinema.mount, "function");
  assert.equal(typeof cinema.unmount, "function");
  assert.equal(typeof cinema.inspect, "function");
  assert.equal(typeof cinema.focusSearch, "function");
  assert.deepEqual(cinema.inspect(), { version: "2.3.0", mounted: false, route: "/cinema", catalogCount: 0 });
});

test("Cinema layout remains one-screen, 375px-safe and accessible", () => {
  const css = read("cinema-hub.css");
  assert.match(css, /body\.app-cinema-route/);
  assert.match(css, /\.cinema-hub\s*\{[\s\S]*?overflow:\s*hidden/);
  assert.match(css, /\.cinema-workspace\s*\{[\s\S]*?min-height:\s*0/);
  assert.match(css, /\.cinema-card-list\s*\{[\s\S]*?overflow:\s*auto/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /@media\s*\(max-width:\s*430px\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /:focus-visible/);
});
