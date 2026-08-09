const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const manifest = JSON.parse(read("assets/open-media/curated-films-v1.json"));
const cinema = require(path.join(root, "cinema-hub.js"));
const rightsEngine = require(path.join(root, "utils", "open-media-rights.js"));

test("Cinema manifest publishes only verified open-license films", () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.ok(manifest.items.length >= 6 && manifest.items.length <= 20);
  assert.equal(new Set(manifest.items.map((item) => item.id)).size, manifest.items.length);
  const allowed = new Set(["PDM-1.0", "CC0-1.0", "CC-BY-2.5", "CC-BY-3.0", "CC-BY-4.0", "CC-BY-SA-3.0", "CC-BY-SA-4.0"]);
  manifest.items.forEach((item) => {
    assert.equal(item.kind, "film");
    assert.ok(item.id && item.title && item.creator);
    assert.ok(allowed.has(item.rights.licenseCode), `${item.id} has an unsafe license`);
    assert.equal(item.rights.commercialAllowed, true);
    assert.equal(item.rights.derivativesAllowed, true);
    assert.match(item.rights.verifiedAt, /^2026-\d{2}-\d{2}$/);
    assert.match(item.rights.licenseUrl, /^https:\/\//);
    assert.match(item.source.landingUrl, /^https:\/\//);
    assert.equal(item.playback.type, "video");
    assert.match(item.playback.url, /^https:\/\//);
    assert.equal(rightsEngine.validateItem(item).ok, true, `${item.id} must pass the shared publishing gate`);
  });
});

test("Cinema catalog is curated from the approved cultural repositories", () => {
  const providers = new Set(manifest.items.map((item) => item.source.provider));
  assert.ok(providers.has("Blender Open Movies"));
  assert.ok(providers.has("Library of Congress"));
  assert.ok(providers.has("Wikimedia Commons"));
  assert.ok(providers.has("Prelinger Archives / Internet Archive"));
  const serialized = JSON.stringify(manifest).toLowerCase();
  for (const blocked of ["netflix.com", "spotify.com", "tiktok.com", "torrent", "youtube.com"]) {
    assert.doesNotMatch(serialized, new RegExp(blocked.replace(".", "\\.")));
  }
});

test("Blender Open Movie records use their canonical published licenses", () => {
  const byId = new Map(manifest.items.map((item) => [item.id, item]));
  assert.deepEqual(
    {
      code: byId.get("big-buck-bunny")?.rights.licenseCode,
      url: byId.get("big-buck-bunny")?.rights.licenseUrl
    },
    {
      code: "CC-BY-3.0",
      url: "https://creativecommons.org/licenses/by/3.0/"
    }
  );
  assert.match(byId.get("big-buck-bunny")?.playback.url || "", /Big_Buck_Bunny_4K\.webm\.480p\.vp9\.webm$/);
  assert.doesNotMatch(byId.get("big-buck-bunny")?.playback.url || "", /Big_Buck_Bunny_alt/);
  assert.deepEqual(
    {
      code: byId.get("elephants-dream")?.rights.licenseCode,
      url: byId.get("elephants-dream")?.rights.licenseUrl
    },
    {
      code: "CC-BY-2.5",
      url: "https://creativecommons.org/licenses/by/2.5/"
    }
  );
  assert.match(byId.get("elephants-dream")?.rights.attributionText || "", /Netherlands Media Art Institute/);
  assert.match(byId.get("elephants-dream")?.rights.attributionText || "", /www\.elephantsdream\.org/);
});

test("Cinema module enforces rights validation instead of bypassing rejections", () => {
  assert.equal(cinema.VERSION, "1.0.0");
  assert.equal(cinema.MANIFEST_URL, "/assets/open-media/curated-films-v1.json");
  assert.equal(cinema.normalizeCatalog(manifest.items).length, manifest.items.length);
  assert.equal(cinema.fallbackLicenseAllowed({
    ...manifest.items[0],
    rights: { ...manifest.items[0].rights, licenseCode: "ARR", commercialAllowed: false }
  }), false);
  assert.equal(cinema.fallbackLicenseAllowed({
    ...manifest.items[0],
    rights: { ...manifest.items[0].rights, licenseUrl: "https://creativecommons.org/licenses/by-nc/3.0/" }
  }), false);
  assert.equal(cinema.fallbackLicenseAllowed({
    ...manifest.items[0],
    playback: { ...manifest.items[0].playback, type: "iframe" }
  }), false);
  const source = read("cinema-hub.js");
  assert.match(source, /HHOpenMediaRights\?\.validateItem/);
  assert.match(source, /verdict === false/);
  assert.match(source, /return false;/);
  assert.doesNotMatch(source, /NASA-MEDIA-GUIDELINES/);
});

test("Cinema has a real player with safe playback and recovery controls", () => {
  const source = read("cinema-hub.js");
  assert.match(source, /<video data-cinema-video controls playsinline preload="metadata"/);
  assert.doesNotMatch(source, /<video[^>]*\bautoplay\b/i);
  assert.match(source, /data-cinema-player-error/);
  assert.match(source, /data-cinema-retry/);
  assert.match(source, /Mở tại nguồn/);
  assert.match(source, /requestPictureInPicture/);
  assert.match(source, /requestFullscreen/);
  assert.match(source, /pictureInPictureEnabled/);
  assert.doesNotMatch(source, /<iframe data-cinema-iframe/);
  assert.match(source, /clearPlayerListeners\(runtime\)/);
  assert.match(source, /button, a, summary/);
  for (const shortcut of ["arrowleft", "arrowright", 'key === "p"', 'key === "f"', 'key === "m"']) {
    assert.match(source, new RegExp(shortcut));
  }
});

test("Cinema persists private favorites, history and continue-watching progress", () => {
  const source = read("cinema-hub.js");
  assert.match(source, /hh\.cinema\.hub\.v1/);
  assert.match(source, /storageKey\(runtime\.ownerId\)/);
  assert.match(source, /options\.currentUser/);
  assert.match(source, /encodeURIComponent\(normalized\)/);
  assert.match(source, /favorites/);
  assert.match(source, /history/);
  assert.match(source, /progress/);
  assert.match(source, /position/);
  assert.match(source, /completed/);
  assert.match(source, /MAX_HISTORY = 50/);
});

test("Cinema exposes the SPA lifecycle and search focus contract", () => {
  const source = read("cinema-hub.js");
  assert.match(source, /globalScope\.HHCinemaHub = api/);
  assert.equal(typeof cinema.mount, "function");
  assert.equal(typeof cinema.unmount, "function");
  assert.equal(typeof cinema.inspect, "function");
  assert.equal(typeof cinema.focusSearch, "function");
  assert.deepEqual(cinema.inspect(), { version: "1.0.0", mounted: false, route: "/cinema", catalogCount: 0 });
  assert.match(source, /data-cinema-hub-host|data-cinema-hub/);
  assert.match(source, /data-cinema-search/);
  assert.match(source, /hh:cinema-focus-search/);
});

test("Cinema layout is one-screen, mobile-safe and motion-aware", () => {
  const css = read("cinema-hub.css");
  assert.match(css, /body\.app-cinema-route/);
  assert.match(css, /\.cinema-hub\s*\{[\s\S]*?overflow:\s*hidden/);
  assert.match(css, /\.cinema-workspace\s*\{[\s\S]*?min-height:\s*0/);
  assert.match(css, /\.cinema-card-list\s*\{[\s\S]*?overflow:\s*auto/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /@media\s*\(max-width:\s*430px\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /:focus-visible/);
});
