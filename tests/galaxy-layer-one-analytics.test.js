const assert = require("node:assert/strict");
const test = require("node:test");
const analytics = require("../galaxy-layer-one-analytics.js");

test("UMD API is frozen and consent gates collection", () => {
  assert.ok(Object.isFrozen(analytics));
  assert.ok(Object.isFrozen(analytics.LIMITS));
  const collector = analytics.createCollector({ consent: false });
  assert.equal(collector.hasConsent(), false);
  assert.throws(() => collector.start(), { code: "CONSENT_REQUIRED" });
  assert.throws(() => collector.record("lcp", 10, 1), { code: "CONSENT_REQUIRED" });
  assert.equal(collector.setConsent(true), true);
});

test("records real web-vitals entries and aggregates by metric", () => {
  const collector = analytics.createCollector({ consent: true, now: () => 1700000000000 });
  collector.record("lcp", 1200, 1200, "largest-contentful-paint");
  collector.record("lcp", 1600, 1600, "largest-contentful-paint");
  collector.record("fcp", 800, 800, "first-contentful-paint");
  collector.record("fcp", 900, 900, "first-contentful-paint");
  collector.record("inp", 240, 240, "event");
  collector.record("cls", 0.12, 300, "layout-shift");
  collector.record("cls", 0.03, 400, "layout-shift");
  const snapshot = collector.snapshot();
  assert.equal(snapshot.metrics.lcp.value, 1600);
  assert.equal(snapshot.metrics.fcp.value, 800);
  assert.equal(snapshot.metrics.inp.value, 240);
  assert.equal(snapshot.metrics.cls.value, 0.15);
  assert.equal(snapshot.metrics.lcp.entries.length, 2);
});

test("accepts real PerformanceEntry shapes whose name is not their entry type", () => {
  let callback;
  class Observer {
    constructor(handler) { callback = handler; }
    observe() {}
    disconnect() {}
  }
  const collector = analytics.createCollector({ consent: true, PerformanceObserver: Observer });
  collector.start();
  callback({ getEntries: () => [
    { entryType: "largest-contentful-paint", name: "", startTime: 321 },
    { entryType: "layout-shift", name: "", startTime: 400, value: 0.08, hadRecentInput: false }
  ] });
  const snapshot = collector.snapshot();
  assert.equal(snapshot.metrics.lcp.value, 321);
  assert.equal(snapshot.metrics.cls.value, 0.08);
});

test("PerformanceObserver integration observes supported entries and disconnects", () => {
  const observers = [];
  class FakePerformanceObserver {
    constructor(callback) { this.callback = callback; this.calls = []; this.disconnected = false; observers.push(this); }
    observe(options) { this.calls.push(options.type); if (options.type === "event") throw new Error("unsupported"); }
    disconnect() { this.disconnected = true; }
  }
  const collector = analytics.createCollector({ consent: true, PerformanceObserver: FakePerformanceObserver });
  assert.equal(collector.start(), true);
  assert.deepEqual(observers[0].calls, ["largest-contentful-paint", "layout-shift", "event", "paint"]);
  observers[0].callback({ getEntries: () => [
    { name: "largest-contentful-paint", startTime: 300 },
    { name: "first-contentful-paint", startTime: 200 },
    { name: "layout-shift", value: 0.2, hadRecentInput: true },
    { name: "layout-shift", value: 0.1, hadRecentInput: false },
    { entryType: "event", name: "click", duration: 90 }
  ] });
  assert.equal(collector.snapshot().metrics.lcp.value, 300);
  assert.equal(collector.snapshot().metrics.fcp.value, 200);
  assert.equal(collector.snapshot().metrics.cls.value, 0.1);
  assert.equal(collector.snapshot().metrics.inp.value, 90);
  collector.stop();
  assert.equal(observers[0].disconnected, true);
});

test("uses buffered performance entries when PerformanceObserver is unavailable", () => {
  const performance = { getEntriesByType(type) {
    if (type === "paint") return [{ name: "first-contentful-paint", startTime: 125 }];
    if (type === "layout-shift") return [{ name: "layout-shift", value: 0.04, startTime: 200, hadRecentInput: false }];
    return [];
  } };
  const collector = analytics.createCollector({ consent: true, performance, PerformanceObserver: null });
  assert.equal(collector.start(), false);
  const snapshot = collector.snapshot();
  assert.equal(snapshot.metrics.fcp.value, 125);
  assert.equal(snapshot.metrics.cls.value, 0.04);
});

test("bounded memory retains only the newest entries", () => {
  const collector = analytics.createCollector({ consent: true, maxEntriesPerMetric: 2 });
  collector.record("inp", 1, 1);
  collector.record("inp", 2, 2);
  collector.record("inp", 3, 3);
  assert.deepEqual(collector.snapshot().metrics.inp.entries.map((entry) => entry.value), [2, 3]);
});

test("JSON and CSV exports are deterministic and escaped", () => {
  const collector = analytics.createCollector({ consent: true, now: () => 0 });
  collector.record("inp", 42, 5, "event,click");
  const json = collector.exportJSON();
  assert.equal(JSON.parse(json).metrics.inp.entries[0].value, 42);
  const csv = collector.exportCSV();
  assert.match(csv, /^metric,value,unit,atMs,source\n/);
  assert.match(csv, /"event,click"/);
});

test("revoking consent stops and clears data", () => {
  const collector = analytics.createCollector({ consent: true });
  collector.record("lcp", 50, 50);
  assert.equal(collector.setConsent(false), false);
  assert.throws(() => collector.snapshot(), { code: "CONSENT_REQUIRED" });
});

test("invalid metric values fail closed and source contains no network APIs", () => {
  const collector = analytics.createCollector({ consent: true });
  assert.throws(() => collector.record("unknown", 1), { code: "METRIC_UNSUPPORTED" });
  assert.throws(() => collector.record("cls", -1), { code: "METRIC_VALUE_INVALID" });
  const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "galaxy-layer-one-analytics.js"), "utf8");
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon/);
});
