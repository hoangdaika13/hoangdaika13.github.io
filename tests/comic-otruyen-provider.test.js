const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { catalogRequest, sortItems, allowedChapterUrl, SLUG } = require("../utils/otruyen-source");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("OTruyen backend builds bounded catalog, search, genre and status requests", () => {
  const az = catalogRequest({ page: -2, sort: "az" });
  assert.equal(az.page, 1);
  assert.match(az.path, /^\/danh-sach\/truyen-moi\?/);
  assert.match(az.path, /page=1/);
  assert.match(az.path, /sort_field=name/);
  assert.match(az.path, /sort_type=asc/);
  assert.match(catalogRequest({ page: 3, q: "Kiếm hiệp" }).path, /^\/tim-kiem\?page=3&keyword=Ki%E1%BA%BFm\+hi%E1%BB%87p&sort_field=updatedAt&sort_type=desc$/);
  assert.match(catalogRequest({ page: 2, genre: "hanh-dong", sort: "za" }).path, /^\/the-loai\/hanh-dong\?page=2&sort_field=name&sort_type=desc$/);
  assert.match(catalogRequest({ filter: "completed" }).path, /^\/danh-sach\/hoan-thanh\?/);
  assert.match(catalogRequest({ filter: "ongoing" }).path, /^\/danh-sach\/dang-phat-hanh\?/);
  assert.equal(SLUG.test("truyen-hop-le-13"), true);
  assert.equal(SLUG.test("https://localhost"), false);
});

test("OTruyen chapter pages only accept the official HTTPS API hosts", () => {
  assert.equal(allowedChapterUrl("https://sv1.otruyencdn.com/v1/api/chapter/66617db4a4468f0e0dda0a16"), true);
  assert.equal(allowedChapterUrl("https://otruyenapi.com/v1/api/chapter/demo-13"), true);
  assert.equal(allowedChapterUrl("http://sv1.otruyencdn.com/v1/api/chapter/demo"), false);
  assert.equal(allowedChapterUrl("https://evil.example/v1/api/chapter/demo"), false);
  assert.equal(allowedChapterUrl("https://sv1.otruyencdn.com/v1/api/chapter/../admin"), false);
});

test("OTruyen backend applies the requested visible-page order", () => {
  const items = [{ name: "B", updatedAt: "2025-01-01" }, { name: "A", updatedAt: "2026-01-01" }];
  assert.deepEqual(sortItems(items, "az").map((item) => item.name), ["A", "B"]);
  assert.deepEqual(sortItems(items, "za").map((item) => item.name), ["B", "A"]);
  assert.deepEqual(sortItems(items, "updated").map((item) => item.name), ["A", "B"]);
});

test("smart comic order prioritizes active recent long series and sends under ten chapters last", () => {
  const now = new Date().toISOString();
  const items = [
    { name: "Short", status: "ongoing", updatedAt: now, chaptersLatest: [{ chapter_name: "8" }] },
    { name: "Long", status: "ongoing", updatedAt: now, chaptersLatest: [{ chapter_name: "320" }] },
    { name: "Medium", status: "ongoing", updatedAt: now, chaptersLatest: [{ chapter_name: "45" }] }
  ];
  assert.deepEqual(sortItems(items, "smart").map((item) => item.name), ["Long", "Medium", "Short"]);
  assert.deepEqual(sortItems(items, "chapters").map((item) => item.name), ["Long", "Medium", "Short"]);
  assert.equal(catalogRequest({ sort: "smart" }).sort, "smart");
});

test("HH Comics routes OTruyen through the same-origin backend", () => {
  const client = read("comic-reader-hub.js");
  const api = read("api/modules/[moduleId]/actions.js");
  assert.match(client, /fetchOTruyen/);
  assert.match(client, /fetchOTruyen\("pages"/);
  assert.doesNotMatch(client, /fetch\(chapter\.apiUrl/);
  assert.match(client, /provider", "otruyen"/);
  assert.match(api, /handleOTruyenSource/);
  assert.match(api, /provider === "otruyen"/);
});
