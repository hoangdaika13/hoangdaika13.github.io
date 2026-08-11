const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const openBooks = require("../utils/open-books-source");
const mangaDex = require("../utils/mangadex-source");
const oTruyen = require("../utils/otruyen-source");

test("Vietnamese open-books connector uses only the official Wikibooks API", () => {
  const defaultRequest = new URL(openBooks.catalogUrl({ limit: 24 }).url);
  assert.equal(defaultRequest.origin, "https://vi.wikibooks.org");
  assert.equal(defaultRequest.pathname, "/w/api.php");
  assert.equal(defaultRequest.searchParams.get("generator"), "categorymembers");
  assert.equal(defaultRequest.searchParams.get("gcmtitle"), "Thể loại:Sách");
  const searchRequest = new URL(openBooks.catalogUrl({ q: "tiếng Việt" }).url);
  assert.equal(searchRequest.searchParams.get("generator"), "search");
  assert.equal(searchRequest.searchParams.get("gsrsearch"), "tiếng Việt");
  assert.equal(openBooks.LICENSE.code, "CC-BY-SA-4.0");
});

test("comic gateway routes open books without storing full text or images", () => {
  const api = read("api/modules/[moduleId]/actions.js");
  const provider = read("utils/open-books-source.js");
  assert.match(api, /provider === "open-books"/);
  assert.match(api, /handleOpenBooksSource/);
  assert.match(provider, /storesContent: false/);
  assert.match(provider, /storesImages: false/);
  assert.match(provider, /fullTextStored: false/);
  assert.doesNotMatch(provider, /Project Gutenberg|Internet Archive|scrape|puppeteer/i);
});

test("MangaDex receives real format, demographic and tag filters", () => {
  const tagId = "11111111-1111-4111-8111-111111111111";
  const request = mangaDex.catalogPath({ format: "Manhwa", demographic: "Josei" }, [tagId]);
  const url = new URL(`https://api.mangadex.org${request.path}`);
  assert.deepEqual(url.searchParams.getAll("originalLanguage[]"), ["ko"]);
  assert.deepEqual(url.searchParams.getAll("publicationDemographic[]"), ["josei"]);
  assert.deepEqual(url.searchParams.getAll("includedTags[]"), [tagId]);
  assert.equal(url.searchParams.get("includedTagsMode"), "AND");
});

test("OTruyen adult-labelled records are rejected on the server", () => {
  assert.equal(oTruyen.isAllowedItem({ category: [{ name: "Action" }] }), true);
  for (const name of ["Adult", "Smut", "Mature", "Ecchi", "16+", "18+"]) {
    assert.equal(oTruyen.isAllowedItem({ category: [{ name: "Action" }, { name }] }), false, name);
  }
});
