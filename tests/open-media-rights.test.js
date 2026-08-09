const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const rights = require("../utils/open-media-rights.js");

const readManifest = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "assets", "open-media", name), "utf8"));
const validItem = (overrides = {}) => ({
  id: "open-film-1",
  kind: "film",
  title: "Open film",
  creator: "Open creator",
  source: { landingUrl: "https://example.org/items/1" },
  rights: {
    licenseCode: "CC-BY-4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    attributionText: "Open film by Open creator, CC BY 4.0",
    verifiedAt: "2020-01-01",
    commercialAllowed: true,
    derivativesAllowed: true
  },
  playback: { type: "video", url: "https://cdn.example.org/open-film.mp4" },
  ...overrides
});

test("open media license gate accepts only an exact supported family and version", () => {
  for (const value of ["PDM 1.0", "CC0 1.0", "CC BY 2.5", "CC BY 4.0", "CC-BY-3.0", "CC-BY-SA-3.0"]) {
    assert.equal(rights.isAllowedLicense(value), true, value);
  }
  for (const value of [
    "", "Public Domain", "PDM", "CC0", "CC BY", "CC-BY-2.0", "CC-BY-3.0-US",
    "CC BY-NC 4.0", "CC BY-ND 4.0", "CC BY-NC-SA", "Unknown", "All rights reserved"
  ]) {
    assert.equal(rights.isAllowedLicense(value), false, value);
  }
  assert.equal(rights.normalizeLicenseCode("CC BY 4.0"), "CC-BY-4.0");
});

test("open media item requires canonical rights, an audited date and matching playback kind", () => {
  const valid = rights.validateItem(validItem());
  assert.equal(valid.ok, true, valid.errors.join(", "));
  assert.equal(valid.licenseCode, "CC-BY-4.0");

  const invalid = rights.validateItem(validItem({
    kind: "track",
    source: { landingUrl: "javascript:alert(1)" },
    rights: {
      licenseCode: "CC-BY-NC-ND-4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      attributionText: "",
      verifiedAt: "2099-01-01",
      commercialAllowed: false,
      derivativesAllowed: false
    },
    playback: { type: "video", url: "http://untrusted.example.org/file.mp4" }
  }));
  assert.equal(invalid.ok, false);
  for (const error of [
    "license-not-allowed", "license-url-mismatch", "invalid-source-url", "invalid-playback-url",
    "invalid-verification-date", "commercial-use-not-confirmed", "derivatives-not-confirmed", "playback-kind-mismatch"
  ]) assert.ok(invalid.errors.includes(error), error);
});

test("license code and canonical Creative Commons URL cannot be mixed or decorated", () => {
  const badUrls = [
    "https://creativecommons.org/licenses/by/3.0/",
    "https://creativecommons.org/licenses/by/4.0/us/",
    "https://creativecommons.org/licenses/by/4.0/?ref=manifest",
    "https://creativecommons.org/licenses/by/4.0/#legal",
    "https://www.creativecommons.org/licenses/by/4.0/"
  ];
  for (const licenseUrl of badUrls) {
    const item = validItem({ rights: { ...validItem().rights, licenseUrl } });
    const result = rights.validateItem(item);
    assert.equal(result.ok, false, licenseUrl);
    assert.ok(result.errors.includes("license-url-mismatch"), licenseUrl);
  }

  const noncanonicalCode = rights.validateItem(validItem({
    rights: { ...validItem().rights, licenseCode: "CC BY 4.0" }
  }));
  assert.equal(noncanonicalCode.ok, false);
  assert.ok(noncanonicalCode.errors.includes("noncanonical-license-code"));
});

test("verification date is a real YYYY-MM-DD date that cannot be in the future", () => {
  for (const verifiedAt of ["", "2026-02-30", "2020-1-01", "2020-01-01T00:00:00Z", "9999-12-31"]) {
    const result = rights.validateItem(validItem({ rights: { ...validItem().rights, verifiedAt } }));
    assert.equal(result.ok, false, verifiedAt);
    assert.ok(result.errors.includes("invalid-verification-date"), verifiedAt);
  }
});

test("curated film and music manifests contain only publishable licensed items", () => {
  const manifests = [
    [readManifest("curated-films-v1.json"), "film", 6],
    [readManifest("curated-music-v1.json"), "track", 15]
  ];

  for (const [manifest, expectedKind, minimum] of manifests) {
    assert.ok(Array.isArray(manifest.items));
    assert.ok(manifest.items.length >= minimum);
    assert.equal(new Set(manifest.items.map((item) => item.id)).size, manifest.items.length);
    for (const item of manifest.items) {
      assert.equal(item.kind, expectedKind, item.id);
      const result = rights.validateItem(item);
      assert.equal(result.ok, true, `${item.id}: ${result.errors.join(", ")}`);
      assert.doesNotMatch(String(item.rights.licenseCode), /(?:-NC|-ND|UNKNOWN)/i);
    }
  }
});
