const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const meme = require(path.join(root, "meme-hub.js"));

const commonsPage = (overrides = {}) => ({
  pageid: 42,
  title: "File:Cosmic cat.gif",
  imageinfo: [{
    url: "https://upload.wikimedia.org/cosmic-cat.gif",
    thumburl: "https://upload.wikimedia.org/cosmic-cat-thumb.gif",
    descriptionurl: "https://commons.wikimedia.org/wiki/File:Cosmic_cat.gif",
    mime: "image/gif",
    width: 800,
    height: 600,
    extmetadata: {
      LicenseShortName: { value: "CC BY-SA 4.0" },
      LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0/" },
      Artist: { value: "<a>HH Artist</a>" },
      ObjectName: { value: "Cosmic Cat" },
      AttributionRequired: { value: "true" }
    },
    ...overrides
  }]
});

test("license allowlist accepts reusable families and rejects restrictive or unknown licenses", () => {
  assert.equal(meme.licenseFamily("Public domain"), "public-domain");
  assert.equal(meme.licenseFamily("CC0 1.0"), "cc0");
  assert.equal(meme.licenseFamily("CC BY 4.0"), "cc-by");
  assert.equal(meme.licenseFamily("CC BY-SA 4.0"), "cc-by-sa");
  assert.equal(meme.licenseAllowed("CC BY-NC 4.0"), false);
  assert.equal(meme.licenseAllowed("CC BY-ND 4.0"), false);
  assert.equal(meme.licenseAllowed("All rights reserved"), false);
});

test("Wikimedia parser preserves provenance, attribution and animated state", () => {
  const result = meme.parseWikimediaPage(commonsPage());
  assert.equal(result.provider, "Wikimedia Commons");
  assert.equal(result.title, "Cosmic Cat");
  assert.equal(result.author, "HH Artist");
  assert.equal(result.licenseFamily, "cc-by-sa");
  assert.equal(result.attributionRequired, true);
  assert.equal(result.shareAlike, true);
  assert.equal(result.animated, true);
  assert.match(result.attribution, /Cosmic Cat.*HH Artist.*CC BY-SA 4\.0.*Wikimedia Commons/);
});

test("Wikimedia parser rejects unclear licenses and untrusted media hosts", () => {
  const rightsReserved = commonsPage({ extmetadata: { LicenseShortName: { value: "All rights reserved" } } });
  assert.equal(meme.parseWikimediaPage(rightsReserved), null);
  const untrusted = commonsPage({ url: "https://example.com/image.gif" });
  assert.equal(meme.parseWikimediaPage(untrusted), null);
});

test("Commons search uses the official API and applies the GIF and license filters", async () => {
  let requested = "";
  const fetchImpl = async (url) => {
    requested = url;
    return { ok: true, json: async () => ({ query: { pages: [commonsPage()] } }) };
  };
  const results = await meme.searchCommons("funny cat", { kind: "gif", license: "cc-by-sa", fetchImpl });
  assert.equal(results.length, 1);
  assert.match(requested, /^https:\/\/commons\.wikimedia\.org\/w\/api\.php\?/);
  assert.match(requested, /generator=search/);
  assert.match(requested, /iiprop=url%7Cmime%7Csize%7Cextmetadata/);
  assert.match(requested, /filemime%3Aimage%2Fgif/);
  assert.match(requested, /origin=\*/);
});

test("Commons pagination requests later result windows", async () => {
  let requested = "";
  const fetchImpl = async (url) => {
    requested = url;
    return { ok: true, json: async () => ({ query: { pages: [commonsPage()] } }) };
  };
  await meme.searchCommons("funny", { kind: "gif", offset: 96, fetchImpl });
  assert.match(requested, /gsroffset=96/);
  assert.match(requested, /gsrlimit=48/);
});

test("Meme icon studio exposes large categorized sticker and discovery libraries", () => {
  assert.ok(meme.STICKERS.length >= 72);
  assert.equal(new Set(meme.STICKERS.map((item) => item.id)).size, meme.STICKERS.length);
  assert.deepEqual(new Set(meme.STICKERS.map((item) => item.category)), new Set(["reaction", "symbol", "meme", "animal", "label", "shape"]));
  assert.equal(meme.STICKER_CATEGORIES.length, 6);
  assert.ok(meme.SEARCH_PRESETS.length >= 16);
  assert.ok(meme.SEARCH_PRESETS.some((item) => item.kind === "gif"));
});

test("project normalization bounds editable data and drops unsafe image URLs", () => {
  const project = meme.normalizeProject({
    width: 999999,
    height: 1,
    captions: { top: { text: "A".repeat(400), size: 900 } },
    source: { url: "javascript:alert(1)", thumbUrl: "javascript:alert(1)" },
    overlays: Array.from({ length: 80 }, (_, index) => ({ id: index, glyph: "★", x: 900, size: 900 }))
  });
  assert.equal(project.width, 2400);
  assert.equal(project.height, 320);
  assert.equal(project.captions.top.text.length, 280);
  assert.equal(project.captions.top.size, 160);
  assert.equal(project.source, null);
  assert.equal(project.overlays.length, 40);
  assert.ok(project.overlays.every((item) => item.x === 100 && item.size === 240));
});

test("Meme is integrated as a major lazy route, galaxy planet and offline asset", () => {
  const client = read("script.js");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const html = read("index.html");
  const galaxy = read("auth-h-galaxy.js");
  assert.match(client, /id: "meme"[\s\S]*?label: "Meme"[\s\S]*?route: "\/meme"/);
  assert.match(client, /window\.HHMemeHub\?\.mount/);
  assert.match(client, /app-meme-route/);
  assert.match(client, /title: "Meme · Creative Galaxy"/);
  assert.match(loader, /meme:\s*\{[\s\S]*?meme-hub\.css\?v=6[\s\S]*?meme-hub\.js\?v=6/);
  assert.match(loader, /value\.startsWith\("\/meme"\)/);
  assert.match(worker, /meme-hub\.css\?v=6/);
  assert.match(worker, /meme-hub\.js\?v=6/);
  assert.match(html, /data-hh-galaxy-key="meme"/);
  assert.equal([...html.matchAll(/data-hh-planet="(\d+)"/g)].length, 25);
  assert.match(galaxy, /meme:\s*\{[\s\S]*?route: "#\/meme"/);
});

test("UI exposes real editor, rights and export controls without claiming animated export", () => {
  const source = read("meme-hub.js");
  const css = read("meme-hub.css");
  assert.match(source, /Wikimedia Commons/);
  assert.match(source, /data-meme-caption-text/);
  assert.match(source, /data-meme-sticker/);
  assert.match(source, /data-meme-sticker-category/);
  assert.match(source, /data-meme-load-more/);
  assert.match(source, /data-meme-undo/);
  assert.match(source, /data-meme-export-image="png"/);
  assert.match(source, /data-meme-export-image="webp"/);
  assert.match(source, /data-meme-rights-confirm/);
  assert.match(source, /xuất khung tĩnh/);
  assert.doesNotMatch(source, /data-meme-export-image="gif"/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /app-meme-route/);
});
