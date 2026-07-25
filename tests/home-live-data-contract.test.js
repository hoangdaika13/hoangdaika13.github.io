const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("dashboard-aurora.js");
const styles = read("dashboard-aurora.css");
const html = read("index.html");

test("weather renders a safe cache immediately and refreshes independent sources in parallel", () => {
  assert.match(source, /hh\.dashboard\.weather\.v2/);
  assert.match(source, /WEATHER_FRESH_MS\s*=\s*10 \* 60 \* 1000/);
  assert.match(source, /WEATHER_TIMEOUT_MS\s*=\s*5500/);
  assert.match(source, /if \(sameLocation\) renderWeather\(/);
  assert.match(source, /const weatherPromise = fetchJson\(weatherUrl\);\s*const airPromise = fetchJson\(airUrl\);/);
  assert.match(source, /Promise\.allSettled\(\[weatherPromise, airPromise\]\)/);
  assert.match(source, /hh:assets-ready/);
  assert.match(source, /requestAnimationFrame\(\(\) => requestAnimationFrame\(init\)\)/);
  assert.match(source, /AQI đang tải/);
  assert.match(source, /AQI tạm gián đoạn/);
});

test("device panel reports browser-observable values instead of invented OS utilization", () => {
  assert.match(html, />ĐỘ TRỄ TAB</);
  assert.match(html, />BỘ NHỚ WEB</);
  assert.match(html, />FPS \/ GPU</);
  assert.match(source, /performance\.memory/);
  assert.match(source, /navigator\.storage\?\.estimate\?\.\(\)/);
  assert.match(source, /requestAnimationFrame\(trackFps\)/);
  assert.match(source, /navigator\.hardwareConcurrency/);
  assert.doesNotMatch(source, /CPU utilization|GPU utilization|Task Manager/);
});

test("color motion is GPU-light and respects reduced-motion preferences", () => {
  assert.match(styles, /dashboard-star-drift/);
  assert.match(styles, /dashboard-metric-scan/);
  assert.match(styles, /dashboard-weather-energy/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /\.dashboard-aurora::before,[\s\S]*?animation: none/);
  assert.doesNotMatch(styles, /canvas|filter:\s*blur\([4-9]\dpx\)/);
});
