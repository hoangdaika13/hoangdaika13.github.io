const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { catalogRequest, sortItems, SLUG } = require("../utils/otruyen-source");

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

test("OTruyen backend applies the requested visible-page order", () => {
  const items = [{ name: "B", updatedAt: "2025-01-01" }, { name: "A", updatedAt: "2026-01-01" }];
  assert.deepEqual(sortItems(items, "az").map((item) => item.name), ["A", "B"]);
  assert.deepEqual(sortItems(items, "za").map((item) => item.name), ["B", "A"]);
  assert.deepEqual(sortItems(items, "updated").map((item) => item.name), ["A", "B"]);
});

test("HH Comics routes OTruyen through the same-origin backend", () => {
  const client = read("comic-reader-hub.js");
  const api = read("api/modules/[moduleId]/actions.js");
  assert.match(client, /fetchOTruyen/);
  assert.match(client, /provider", "otruyen"/);
  assert.match(api, /handleOTruyenSource/);
  assert.match(api, /provider === "otruyen"/);
});
