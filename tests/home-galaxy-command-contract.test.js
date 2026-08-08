const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("home-galaxy-command.js");
const styles = read("home-galaxy-command.css");
const html = read("index.html");
const loader = read("performance-loader.js");
const worker = read("sw.js");

test("home route loads the versioned Galaxy Command assets and mount host", () => {
  assert.match(html, /id="homeGalaxyCommandRoot"/);
  assert.match(loader, /home-galaxy-command\.css\?v=9/);
  assert.match(loader, /home-galaxy-command\.js\?v=8/);
  assert.match(worker, /home-galaxy-command\.css\?v=9/);
  assert.match(worker, /home-galaxy-command\.js\?v=8/);
  assert.match(source, /hh:assets-ready/);
  assert.match(source, /\[data-shell-view="home"\]/);
});

test("one-screen status center exposes six truthful browser and site signals", () => {
  for (const id of ["weather", "performance", "memory", "network", "health", "sync"]) {
    assert.match(source, new RegExp(`id: "${id}"`), `missing live widget ${id}`);
  }
  for (const contract of [
    "hh.dashboard.weather.v2",
    "dashboardGpuValue",
    "dashboardRamValue",
    "dashboardDiskValue",
    "navigator.connection",
    "navigator.onLine",
    "hhhf-health-overview",
    "TRUNG TÂM THÔNG TIN"
  ]) assert.ok(source.includes(contract), `missing live contract: ${contract}`);
  assert.doesNotMatch(source, /CPU utilization|GPU utilization/);
  assert.match(source, /data-hgc-spark/);
  assert.match(source, /hgc-live-detail/);
});

test("command sun contains exactly fifteen routed feature planets", () => {
  const block = source.match(/const PLANETS = Object\.freeze\(\[([\s\S]*?)\]\);/);
  assert.ok(block, "planet registry is missing");
  assert.equal((block[1].match(/\{\s*id:/g) || []).length, 15);
  for (const id of ["home", "system", "creative", "music", "media", "graphic", "dev", "work", "communication", "entertainment", "analytics", "learning", "english", "japanese", "support"]) {
    assert.match(block[1], new RegExp(`id: "${id}"`), `missing planet ${id}`);
  }
  assert.match(source, /hgc-sun/);
  assert.match(source, /hgc-sun-particles/);
  assert.match(source, /is-departing/);
  assert.match(source, /location\.hash/);
});

test("one-screen cosmic effects and real interactions are present", () => {
  for (const contract of [
    "hgc-one-screen",
    "hgc-today-panel",
    "hgc-info-center",
    "createMeteor",
    "notificationComet",
    "burstAtPlanet",
    "pointermove",
    "MutationObserver",
    "data-hgc-info-tab"
  ]) assert.ok(source.includes(contract), `missing effect contract: ${contract}`);
  assert.match(styles, /hgc-nebula/);
  assert.match(styles, /hgc-meteor/);
  assert.match(styles, /hgc-notification-comet/);
  assert.match(styles, /hgc-burst/);
  assert.match(styles, /hgc-one-screen/);
});

test("personalization is versioned, persistent and sound is opt-in", () => {
  assert.match(source, /hh\.home\.galaxy\.preferences\.v1/);
  for (const theme of ["neon", "purple", "solar", "deep"]) {
    assert.match(source, new RegExp(`"${theme}"`));
  }
  for (const motion of ["static", "balanced", "cinematic"]) {
    assert.match(source, new RegExp(`"${motion}"`));
  }
  assert.match(source, /sound:\s*false/);
  assert.match(source, /data-hgc-planet-toggle/);
  assert.match(source, /data-hgc-widget-toggle/);
  assert.match(source, /localStorage\.setItem/);
});

test("Galaxy Command is responsive, keyboard-visible and motion-safe", () => {
  assert.match(styles, /@media\s*\(max-width:\s*700px\)/);
  assert.match(styles, /overflow-x:\s*auto/);
  assert.match(styles, /scroll-snap-type:\s*x mandatory/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(styles, /focus-visible/);
  assert.match(styles, /\[data-hgc-motion="static"\]/);
  assert.match(styles, /\.hgc-active\s*>\s*\.dashboard-hero-pro/);
  assert.match(styles, /\.hgc-active\s*>\s*\.dashboard-metric-strip/);
});
