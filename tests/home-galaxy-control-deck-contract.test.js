const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("home-galaxy-control-deck.js");
const styles = read("home-galaxy-control-deck.css");
const missionSource = read("home-galaxy-mission.js");
const loader = read("performance-loader.js");
const worker = read("sw.js");
const index = read("index.html");
const deck = require(path.join(root, "home-galaxy-control-deck.js"));

test("Galaxy Control Deck V3 is versioned in the route loader and offline shell", () => {
  assert.equal(deck.VERSION, "3.0.0");
  for (const asset of ["home-galaxy-control-deck.css?v=2", "home-galaxy-control-deck.js?v=2"]) {
    assert.ok(loader.includes(asset), `loader missing ${asset}`);
    assert.ok(worker.includes(asset), `service worker missing ${asset}`);
  }
  assert.match(worker, /hh-identity-portal-v244/);
  assert.match(index, /performance-loader\.js\?v=36/);
});

test("one-screen control deck has eight planetary tabs and a live three-column layout", () => {
  assert.equal(deck.TABS.length, 8);
  assert.deepEqual(deck.TABS.map((item) => item[0]), [
    "appearance", "motion", "planets", "orbit", "events", "performance", "sound", "sync"
  ]);
  for (const contract of [
    "class=\"hgcd-tabs\"", "data-hgcd-content", "data-hgcd-preview",
    "data-hgcd-reset", "data-hgcd-export", "data-hgcd-import", "data-hgcd-apply"
  ]) assert.ok(source.includes(contract), `missing deck contract ${contract}`);
  assert.match(styles, /height:\s*100dvh/);
  assert.match(styles, /grid-template-columns:\s*178px minmax\(360px,\s*1fr\) minmax\(270px,\s*330px\)/);
  assert.match(styles, /html\.hgcd-page-lock[\s\S]*overflow:\s*hidden/);
});

test("all twelve cosmic themes plus time mode and seven motion modes are real draft values", () => {
  assert.equal(deck.THEMES.length, 13);
  assert.deepEqual(deck.THEMES.map((item) => item[0]), [
    "neon", "purple", "solar", "deep", "aurora", "magenta", "emerald",
    "quantum", "golden", "crimson", "ice", "blackhole", "time"
  ]);
  assert.equal(deck.MOTIONS.length, 7);
  assert.deepEqual(deck.MOTIONS.map((item) => item[0]), [
    "off", "minimal", "balanced", "vivid", "cinematic", "hyper", "adaptive"
  ]);
  for (const field of [
    "planetSpeed", "orbitSpeed", "parallax", "particles", "meteors", "nebula", "glow",
    "effectWormhole", "effectNova", "effectComet", "autoQuality", "batteryAware"
  ]) {
    assert.ok(source.includes(field), `missing setting ${field}`);
    assert.ok(missionSource.includes(field), `setting is not applied by Mission ${field}`);
  }
});

test("preview is immediate while the live page changes only through Apply", () => {
  assert.match(source, /function updatePreview/);
  assert.match(source, /instance\.api\.applyPreferences\(instance\.draft/);
  assert.match(source, /Bấm Áp dụng để sử dụng/);
  assert.match(source, /hh\.home\.galaxy\.preferences\.draft\.v3/);
  assert.match(missionSource, /hh\.home\.galaxy\.preferences\.v2/);
  assert.doesNotMatch(source, /preferences\.applied\.v3/);
});

test("LIVE ORBIT settings control order, visibility, four sizes, color and refresh cadence", () => {
  for (const contract of [
    "data-hgcd-widget-toggle", "data-hgcd-widget-tone", "data-hgcd-widget-size",
    "data-hgcd-widget-refresh", "data-hgcd-widget-move", "data-hgcd-reset-widgets",
    "hideUnsupported", "dragstart", "drop"
  ]) assert.ok(source.includes(contract), `missing LIVE ORBIT control ${contract}`);
  for (const size of ["small", "medium", "large", "wide"]) {
    assert.ok(source.includes(`"${size}"`) || source.includes(`value="${size}"`), `missing size ${size}`);
  }
  for (const cadence of [5, 15, 30, 60]) {
    assert.ok(source.includes(`value="${cadence}"`) || source.includes(`refresh(${cadence})`), `missing refresh ${cadence}`);
  }
  assert.match(missionSource, /widgetNextRefresh/);
  assert.match(missionSource, /data-refresh=/);
});

test("planet controls apply pinned, notification, focus and shared-color behavior", () => {
  for (const contract of [
    "defaultPlanet", "pinnedPlanets", "notificationPlanets", "focusPlanets",
    "orbitScale", "syncColors", "visiblePlanets"
  ]) assert.ok(source.includes(contract), `missing planet control ${contract}`);
  assert.match(source, /current\.length >= 4/);
  assert.match(missionSource, /class="hgm-planet[\s\S]*is-pinned/);
  assert.match(missionSource, /focusPlanets\?\.includes/);
  assert.match(styles, /data-sync-colors="false"/);
});

test("all eight presets change functional configuration, not only color", () => {
  assert.equal(deck.PRESETS.length, 8);
  const base = { widgetOrder: [], widgets: [], pinnedActions: [] };
  const battery = deck.applyPreset(base, "battery");
  assert.equal(battery.motion, "off");
  assert.equal(battery.effectWormhole, false);
  assert.equal(battery.effectComet, false);
  assert.equal(battery.sound, false);
  assert.equal(battery.widgetRefresh.network, 60);

  const focus = deck.applyPreset(base, "focus");
  assert.deepEqual(focus.visiblePlanets, ["work"]);
  assert.deepEqual(focus.pinnedPlanets, ["work"]);

  const accessibility = deck.applyPreset(base, "accessibility");
  assert.equal(accessibility.highContrast, true);
  assert.equal(accessibility.fontScale, 115);

  const developer = deck.applyPreset(base, "developer");
  assert.equal(developer.defaultPlanet, "dev");
  assert.equal(developer.widgetRefresh.api, 5);
});

test("draft, undo, redo, JSON sync and three-entry history are persisted safely", () => {
  for (const contract of [
    "DRAFT_KEY", "HISTORY_KEY", "undoStack", "redoStack", "savedAt",
    "exportedAt", "JSON.stringify", "JSON.parse", "instance.api.sync()",
    "Cấu hình được lưu riêng trên thiết bị"
  ]) assert.ok(source.includes(contract), `missing persistence contract ${contract}`);
  assert.match(source, /history\.slice\(0,\s*3\)/);
  assert.match(source, /instance\.undoStack = instance\.undoStack\.slice\(-24\)/);
  assert.match(source, /version:\s*3/);
});

test("mobile keeps tabs horizontal, preview compact and only inner content scrollable", () => {
  assert.match(styles, /@media\s*\(max-width:\s*760px\)/);
  assert.match(styles, /\.hgcd-tabs[\s\S]*overflow-x:\s*auto/);
  assert.match(styles, /\.hgcd-preview/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(styles, /\.hgcd-content[\s\S]*overflow:\s*auto/);
});
