const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("HH Comics is a first-class major route inside hoang8.com", () => {
  const app = read("script.js");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");

  assert.match(app, /id: "comic-reader"[\s\S]*?label: "Đọc truyện"[\s\S]*?route: "\/comic-reader"/);
  assert.match(app, /HHComicReaderHub\.mount/);
  assert.match(app, /app-comic-reader-route/);
  assert.match(loader, /"comic-reader"[\s\S]*?comic-reader-hub\.css\?v=3[\s\S]*?comic-reader-hub\.js\?v=3/);
  assert.match(worker, /comic-reader-hub\.css\?v=3/);
  assert.match(worker, /comic-reader-hub\.js\?v=3/);
});

test("catalog includes discovery, detail, ranking, follow and history", () => {
  const client = read("comic-reader-hub.js");

  assert.match(client, /Mới cập nhật/);
  assert.match(client, /Top thịnh hành/);
  assert.match(client, /Danh sách chương/);
  assert.match(client, /state\.follows/);
  assert.match(client, /state\.progress/);
  assert.match(client, /data-chapter-search/);
  assert.match(client, /data-sort/);
  assert.match(client, /data-genre/);
});

test("reader supports vertical pages, page mode, navigation and progress", () => {
  const client = read("comic-reader-hub.js");
  const css = read("comic-reader-hub.css");

  assert.match(client, /Cuộn dọc/);
  assert.match(client, /Từng trang/);
  assert.match(client, /IntersectionObserver/);
  assert.match(client, /loading="\$\{index < 3 \? "eager" : "lazy"\}"/);
  assert.match(client, /readerNavigate/);
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

  assert.match(client, /https:\/\/otruyenapi\.com\/v1\/api/);
  assert.match(client, /danh-sach\/truyen-moi\?page=/);
  assert.match(client, /tim-kiem\?keyword=/);
  assert.match(client, /the-loai\/\$\{encodeURIComponent\(genreSlug\)\}/);
  assert.match(client, /ensureRemoteSeriesDetails/);
  assert.match(client, /ensureRemoteChapterPages/);
  assert.match(client, /data\.domain_cdn/);
  assert.match(client, /referrerpolicy="no-referrer"/);
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
});
