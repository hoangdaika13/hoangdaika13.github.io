const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("HH Comics is a first-class major route inside hoang8.com", () => {
  const app = read("script.js");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");

  assert.match(app, /id: "comic-reader"[\s\S]*?label: "Đọc truyện"[\s\S]*?route: "\/comic-reader"/);
  assert.match(app, /HHComicReaderHub\.mount/);
  assert.match(app, /app-comic-reader-route/);
  assert.match(loader, /"comic-reader"[\s\S]*?comic-reader-hub\.css\?v=13[\s\S]*?comic-open-source-catalog\.js\?v=2[\s\S]*?comic-reader-hub\.js\?v=19/);
  assert.match(worker, /comic-reader-hub\.css\?v=13/);
  assert.match(worker, /comic-open-source-catalog\.js\?v=2/);
  assert.match(worker, /comic-reader-hub\.js\?v=19/);
});

test("catalog includes discovery, detail, ranking, follow and history", () => {
  const client = read("comic-reader-hub.js");

  assert.match(client, /Mới cập nhật/);
  assert.match(client, /Top nhiều chap/);
  assert.match(client, /Danh sách chương/);
  assert.match(client, /state\.follows/);
  assert.match(client, /state\.progress/);
  assert.match(client, /data-chapter-search/);
  assert.match(client, /data-sort/);
  assert.match(client, /data-genre/);
});

test("multi-genre discovery separates story genre, format and audience", () => {
  const client = read("comic-reader-hub.js");
  const css = read("comic-reader-hub.css");
  for (const token of ["GENRE_GROUPS", "Hành động", "Kinh dị", "Trinh thám", "Khoa học viễn tưởng", "Đời thường", "Manga", "Manhwa", "Manhua", "Webtoon", "Sách mở"]) {
    assert.match(client, new RegExp(token));
  }
  assert.match(client, /data-format-filter/);
  assert.match(client, /data-demographic-filter/);
  assert.match(client, /function genreExplorer/);
  assert.match(client, /matchesFacet/);
  assert.match(client, /catalogVersion: 3/);
  assert.match(css, /\.cr-genre-explorer/);
  assert.match(css, /\.cr-facet-toolbar/);
  assert.match(css, /\.cr-genre-groups/);
});

test("open reading sources are license-labelled and never auto-imported", () => {
  const client = read("comic-reader-hub.js");
  for (const source of ["StoryWeaver", "Wikibooks tiếng Việt", "Pepper&Carrot", "Book Dash", "OpenStax", "DOAB", "Wikimedia Commons"]) assert.match(client, new RegExp(source.replace(/[&]/g, "\\&")));
  assert.match(client, /CC BY 4\.0/);
  assert.match(client, /CC BY-SA 4\.0/);
  assert.match(client, /provider", "open-books"/);
  assert.match(client, /fullTextStored: false|không lưu toàn văn/i);
});

test("reader supports vertical pages, page mode, navigation and progress", () => {
  const client = read("comic-reader-hub.js");
  const css = read("comic-reader-hub.css");

  assert.match(client, /Cuộn dọc/);
  assert.match(client, /Từng trang/);
  assert.match(client, /IntersectionObserver/);
  assert.match(client, /loading="\$\{index < 3 \? "eager" : "lazy"\}"/);
  assert.match(client, /readerNavigate/);
  assert.match(client, /\[data-chapter-list\] \[data-read\]/);
  assert.match(css, /\.cr-reader-pages/);
  assert.match(css, /max-width:100%/);
});

test("licensed import accepts CBZ, JSON and HTTPS feeds without crawler logic", () => {
  const client = read("comic-reader-hub.js");

  assert.match(client, /JSZip\.loadAsync/);
  assert.match(client, /checkCRC32: true/);
  assert.match(client, /Catalog JSON/);
  assert.match(client, /API \/ Feed được cấp phép/);
  assert.match(client, /indexedDB\.open/);
  assert.match(client, /không tự vượt CAPTCHA, anti-bot/);
  assert.doesNotMatch(client, /nettruyen\.gg|puppeteer|playwright|cloudflare bypass/i);
});

test("OTruyen provider streams its paginated catalog and chapter images on demand", () => {
  const client = read("comic-reader-hub.js");

  assert.match(client, /OTRUYEN_PROXY_PATH/);
  assert.match(client, /function fetchOTruyen/);
  assert.match(client, /provider", "otruyen"/);
  assert.doesNotMatch(client, /https:\/\/otruyenapi\.com\/v1\/api/);
  assert.match(client, /ensureRemoteSeriesDetails/);
  assert.match(client, /ensureRemoteChapterPages/);
  assert.match(client, /data\.domain_cdn/);
  assert.match(client, /referrerpolicy="no-referrer"/);
});

test("catalog exposes the entire backend inventory through real pagination and sorting", () => {
  const client = read("comic-reader-hub.js");
  const css = read("comic-reader-hub.css");

  assert.match(client, /function loadCatalogPage/);
  assert.match(client, /function catalogPageCount/);
  assert.match(client, /data-catalog-page=/);
  assert.match(client, /data-catalog-page-input/);
  assert.match(client, /Tên A–Z/);
  assert.match(client, /Tên Z–A/);
  assert.match(client, /tối đa 72 OTruyen \+ 48 MangaDex mỗi trang/);
  assert.match(client, /Ưu tiên cập nhật & nhiều chap/);
  assert.match(client, /Nhiều chap → ít chap/);
  assert.match(client, /smartCatalogCompare/);
  assert.match(client, /chapterBand/);
  assert.match(client, /Chưa rõ số chap/);
  assert.match(client, /OTRUYEN_PAGES_PER_VIEW = 3/);
  assert.match(client, /catalogVersion: 3/);
  assert.doesNotMatch(client, /sourceType === "otruyen" \? "API"/);
  assert.match(css, /\.cr-pagination/);
});

test("reader uses one-screen internal scrolling and responsive mobile layout", () => {
  const css = read("comic-reader-hub.css");

  assert.match(css, /height:calc\(100dvh - 106px\)/);
  assert.match(css, /body\.app-comic-reader-route \.app-page-header/);
  assert.match(css, /\.cr-content[\s\S]*?overflow-y:auto/);
  assert.match(css, /@media\(max-width:680px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});

test("professional reader focuses content and persists display controls", () => {
  const client = read("comic-reader-hub.js");
  const css = read("comic-reader-hub.css");

  assert.match(client, /readerWidth/);
  assert.match(client, /readerTheme/);
  assert.match(client, /cr-reader-chapters/);
  assert.match(client, /data-catalog-filter/);
  assert.match(css, /\.cr-app\.is-reader-focus/);
  assert.match(css, /\.cr-reader-settings/);
  assert.match(css, /\.cr-reader-chapters/);
});

test("catalog has no generated demo comics and Clean Reader filters promotional pages", () => {
  const client = read("comic-reader-hub.js");

  assert.match(client, /state\.catalog = \[\]/);
  assert.doesNotMatch(client, /function demoCatalog|HH Originals demo|Biên Niên Sử Nexus/);
  assert.match(client, /cleanRemotePages/);
  assert.match(client, /filteredPages/);
  assert.match(client, /reader-hide-page/);
  assert.match(client, /blockedPages/);
  assert.match(client, /Clean Reader đang loại trang quảng cáo/);
  assert.match(client, /storyBaseline \* 1\.22/);
});

test("reader v2 restores sessions, supports page bookmarks and resilient navigation", () => {
  const client = read("comic-reader-hub.js");
  const css = read("comic-reader-hub.css");

  assert.match(client, /function continueShelf/);
  assert.match(client, /function bookmarkView/);
  assert.match(client, /function restoreDeepLink/);
  assert.match(client, /comicSeries/);
  assert.match(client, /data-reader-page-slider/);
  assert.match(client, /data-action="reader-retry-image"/);
  assert.match(client, /preloadAdjacentPages/);
  assert.match(client, /function restoreReaderPosition/);
  assert.match(client, /target\.offsetTop - readerPages\.offsetTop/);
  assert.match(client, /version: "3\.0\.0"/);
  assert.match(css, /\.cr-continue-shelf/);
  assert.match(css, /\.cr-bookmark-list/);
  assert.match(css, /\.cr-tap-zone/);
  assert.match(css, /\.cr-image-retry/);
});

test("GitHub Open Library adds only explicitly licensed story pages", () => {
  const source = read("comic-open-source-catalog.js");
  const client = read("comic-reader-hub.js");
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  const catalog = sandbox.window.HHOpenComicCatalog;
  const sources = sandbox.window.HHOpenComicSources;

  assert.equal(catalog.length, 2);
  assert.equal(sources.length, 2);
  assert.equal(catalog.reduce((total, series) => total + series.chapters.length, 0), 3);
  assert.equal(catalog.reduce((total, series) => total + series.chapters.reduce((count, chapter) => count + chapter.pages.length, 0), 0), 116);
  assert.deepEqual([...new Set(catalog.map((series) => series.license))].sort(), ["CC BY 4.0", "Unlicense"]);
  assert.ok(!catalog.some((series) => ["Back in This World as Myself", "Tlatoāni Tales"].includes(series.title)));
  assert.ok(catalog.every((series) => series.sourceType === "github-open" && /^https:\/\/github\.com\//.test(series.sourceUrl)));
  assert.ok(catalog.every((series) => series.chapters.every((chapter) => chapter.pages.every((page) => /^https:\/\/raw\.githubusercontent\.com\//.test(page)))));
  assert.doesNotMatch(source, /art_etc_by_others|_collectables|_cameos|_bonus/);
  assert.match(client, /HHOpenComicCatalog/);
  assert.match(client, /comicOpen/);
  assert.match(client, /GitHub Open Library/);
});
