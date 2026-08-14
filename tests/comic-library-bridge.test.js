"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function loadBridge() {
  const location = { href: "https://hoang8.com/#/comic-reader", origin: "https://hoang8.com", assign(value) { this.assigned = value; } };
  const window = { location, history: { state: null, replaceState() {} }, dispatchEvent() {}, addEventListener() {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, "services/comicLibraryBridge.js"), "utf8"), {
    window, URL, Blob, CustomEvent: class CustomEvent { constructor(type) { this.type = type; } },
    fetch: async () => { throw new Error("not used"); }, setTimeout, clearTimeout, console
  });
  return { bridge: window.HHComicLibraryBridge, location };
}

test("Comic Library Bridge builds a versioned ID-only descriptor", () => {
  const { bridge } = loadBridge();
  const series = {
    id: "github-open:pepper", title: "Pepper", sourceType: "github-open",
    sourceUrl: "https://github.com/example/pepper", license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/", attribution: "Pepper © Artist · CC BY 4.0",
    chapters: [{ id: "pepper:1", number: 1, pages: ["https://raw.githubusercontent.com/example/1.jpg"] }]
  };
  const descriptor = bridge.descriptor(series, series.chapters, {});
  assert.equal(descriptor.schemaVersion, 1);
  assert.equal(descriptor.series.id, series.id);
  assert.equal(descriptor.chapters[0].id, "pepper:1");
  assert.equal(descriptor.chapters[0].pageCount, 1);
  assert.equal("pages" in descriptor.chapters[0], false);
  assert.equal(descriptor.rights.status, "allowed");
  assert.equal(descriptor.rights.derivativesAllowed, true);
});

test("Bridge remains conservative for provider reading access and creates safe navigation", () => {
  const { bridge, location } = loadBridge();
  const rights = bridge.localRights({ id: "otruyen:test", sourceType: "otruyen", license: "CC BY 4.0", attribution: "text" });
  assert.equal(rights.status, "manual-review");
  bridge.navigateToMotion("handoff-safe-id");
  const assigned = new URL(location.assigned);
  assert.equal(assigned.searchParams.get("handoff"), "handoff-safe-id");
  assert.equal(assigned.hash, "#/comic-motion-studio");
  assert.equal(bridge.version, "1.0.0");
});
