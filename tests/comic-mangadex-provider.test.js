const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { catalogPath, mapSeries, mapChapter, isAllowedRating, UUID } = require("../utils/mangadex-source");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("MangaDex catalog is Vietnamese-only and excludes adult ratings", () => {
  const request = catalogPath({ limit: 999, offset: -1, q: "Frieren" });
  assert.equal(request.limit, 24);
  assert.equal(request.offset, 0);
  assert.match(request.path, /availableTranslatedLanguage%5B%5D=vi/);
  assert.match(request.path, /contentRating%5B%5D=safe/);
  assert.match(request.path, /contentRating%5B%5D=suggestive/);
  assert.doesNotMatch(request.path, /pornographic|erotica/);
  assert.match(request.path, /includes%5B%5D=cover_art/);
  assert.equal(isAllowedRating("safe"), true);
  assert.equal(isAllowedRating("suggestive"), true);
  assert.equal(isAllowedRating("erotica"), false);
  assert.equal(isAllowedRating("pornographic"), false);
});

test("MangaDex series keeps title, author, cover and source attribution", () => {
  const id = "801513ba-a712-498c-8f57-cae55b38cc92";
  const mapped = mapSeries({
    id,
    attributes: {
      title: { vi: "Pháp sư tiễn táng", en: "Frieren" },
      altTitles: [{ en: "Frieren: Beyond Journey's End" }],
      description: { vi: "Mô tả tiếng Việt" },
      status: "ongoing",
      contentRating: "safe",
      updatedAt: "2026-08-08T00:00:00Z",
      tags: [{ attributes: { name: { vi: "Phiêu lưu", en: "Adventure" } } }]
    },
    relationships: [
      { type: "cover_art", attributes: { fileName: "cover.jpg" } },
      { type: "author", attributes: { name: "Kanehito Yamada" } }
    ]
  });
  assert.equal(mapped.title, "Pháp sư tiễn táng");
  assert.equal(mapped.author, "Kanehito Yamada");
  assert.equal(mapped.contentRating, "safe");
  assert.equal(mapped.tags[0], "Phiêu lưu");
  assert.equal(mapped.cover, `https://uploads.mangadex.org/covers/${id}/cover.jpg.512.jpg`);
  assert.equal(mapped.sourceUrl, `https://mangadex.org/title/${id}`);
  assert.match(mapped.description, /tiếng Việt/);
  assert.ok(UUID.test(mapped.id));
});

test("MangaDex chapters retain scanlation-group attribution", () => {
  const id = "e58e1810-06c1-4c8f-b5ce-5ea90fe10651";
  const mapped = mapChapter({
    id,
    attributes: { chapter: "12", title: "Hành trình", translatedLanguage: "vi", pages: 18, publishAt: "2026-08-08T00:00:00Z" },
    relationships: [{ type: "scanlation_group", attributes: { name: "Nhóm dịch Việt" } }]
  });
  assert.equal(mapped.number, "12");
  assert.equal(mapped.group, "Nhóm dịch Việt");
  assert.equal(mapped.translatedLanguage, "vi");
  assert.equal(mapped.pages, 18);
  assert.equal(mapped.sourceUrl, `https://mangadex.org/chapter/${id}`);
});

test("HH Comics integrates MangaDex through the same-origin gateway", () => {
  const client = read("comic-reader-hub.js");
  const api = read("api/modules/[moduleId]/actions.js");
  const provider = read("utils/mangadex-source.js");

  assert.match(client, /MANGADEX_PROXY_PATH/);
  assert.match(client, /global\.HH_API_ORIGIN \|\| global\.location\?\.origin/);
  assert.match(client, /function loadMangaDexCatalog/);
  assert.match(client, /function ensureMangaDexSeriesDetails/);
  assert.match(client, /function ensureMangaDexChapterPages/);
  assert.match(client, /comicMangaDex/);
  assert.match(client, /MangaDex tiếng Việt/);
  assert.match(client, /Nhóm dịch:/);
  assert.match(api, /handleMangaDexSource/);
  assert.match(api, /moduleId === "comic-reader" && req\.query\.provider === "mangadex"/);
  assert.match(provider, /\/at-home\/server\/\$\{id\}\?forcePort443=true/);
  assert.match(provider, /translatedLanguage !== "vi"/);
  assert.match(provider, /assertAllowedSeries\(manga\)/);
  assert.match(provider, /storesImages: false/);
  assert.doesNotMatch(client, /truyendex\.cc|nettruyen\.gg|services\.f-ck\.me/);
});
