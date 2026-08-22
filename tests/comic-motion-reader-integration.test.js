"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function frontendContext() {
  const localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
  const location = { href: "https://hoang8.com/?handoff=test#/comic-motion-studio", origin: "https://hoang8.com", hash: "#/comic-motion-studio", assign() {} };
  const window = { location, history: { state: null, replaceState() {} }, dispatchEvent() {}, addEventListener() {}, removeEventListener() {} };
  const context = {
    window, URL, Blob, CustomEvent: class CustomEvent { constructor(type) { this.type = type; } },
    localStorage, navigator: {}, indexedDB: {}, structuredClone, console, setTimeout, clearTimeout,
    setInterval, clearInterval, requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
    fetch: async () => { throw new Error("network disabled in contract test"); }
  };
  vm.runInNewContext(read("services/comicLibraryBridge.js"), context);
  vm.runInNewContext(read("comic-reader-hub.js"), context);
  vm.runInNewContext(read("comic-motion-studio.js"), context);
  return window;
}

test("Reader and Motion Studio expose the secure handoff and durable batch APIs", () => {
  const window = frontendContext();
  for (const name of ["getSeriesDescriptor", "getChapterDescriptor", "getMotionEligibility", "createMotionHandoff"]) {
    assert.equal(typeof window.HHComicReaderHub[name], "function", name);
  }
  for (const name of ["openHandoff", "getBatchStatus", "pauseBatch", "resumeBatch", "retryBatch"]) {
    assert.equal(typeof window.HHComicMotionStudio[name], "function", name);
  }
  assert.equal(window.HHComicReaderHub.version, "4.0.0");
  assert.equal(window.HHComicMotionStudio.version, "4.0.0");
  assert.equal(window.HHComicLibraryBridge.handoffFromLocation(), "test");
});

test("Reader UI includes chapter selection, Rights Gate and current-page handoff controls", () => {
  const source = read("comic-reader-hub.js");
  for (const contract of [
    /data-motion-chapter=/, /5 chương mới nhất/, /Chương chưa xử lý/, /Kiểm tra quyền chuyển thể/,
    /Tạo video chương này/, /Tạo từ trang hiện tại/, /Chọn đoạn trang/, /COMIC LIBRARY BRIDGE/
  ]) assert.match(source, contract);
  assert.doesNotMatch(source, /searchParams\.set\(["'](?:pageUrls|token|pages)["']/i);
});

test("Motion UI shows actual worker diagnostics and durable controls without fake readiness", () => {
  const source = read("comic-motion-studio.js");
  for (const contract of [
    /data-cms-section="batch"/, /worker-health/, /batch-job-create/, /batch-job-pause/,
    /batch-job-resume/, /batch-job-retry/, /batch-job-cancel/, /downloadLicensePack/
  ]) assert.match(source, contract);
  assert.match(source, /Chưa kiểm tra/);
  assert.doesNotMatch(source, /batchWorkerHealth\s*=\s*\{\s*connected:\s*true/);
});

test("cache loader executes the shared bridge before each consumer", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  assert.match(loader, /services\/comicLibraryBridge\.js\?v=1["],\s*[" ]*comic-motion-studio\.js\?v=11/);
  assert.match(loader, /services\/comicLibraryBridge\.js\?v=1["],\s*[" ]*comic-reader-hub\.js\?v=20/);
  assert.match(worker, /hh-identity-portal-v819/);
  assert.match(worker, /comic-motion-studio\.css\?v=7/);
  assert.match(worker, /comic-reader-hub\.css\?v=14/);
});
