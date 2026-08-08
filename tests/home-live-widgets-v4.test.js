const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("home-live-widgets.js");
const styles = read("home-live-widgets.css");
const galaxy = read("home-galaxy-command.js");
const loader = read("performance-loader.js");
const worker = read("sw.js");
const health = read("api/platform/summary.js");

test("Living Desktop Galaxy V4 assets and one-screen hosts are wired", () => {
  assert.match(loader, /home-live-widgets\.css\?v=4/);
  assert.match(loader, /home-live-widgets\.js\?v=4/);
  assert.match(worker, /home-live-widgets\.css\?v=4/);
  assert.match(worker, /home-live-widgets\.js\?v=4/);
  assert.match(galaxy, /data-hlw-host/);
  assert.match(galaxy, /data-hlw-event-bar/);
  assert.match(galaxy, /LIVING DESKTOP GALAXY V4/);
  assert.match(styles, /grid-template-rows:\s*auto minmax\(0, 1fr\) 28px auto/);
});

test("latency monitor uses truthful HTTP API and WebSocket measurements", () => {
  assert.match(source, /function timedFetch/);
  assert.match(source, /\/api\/health\?hlw_probe=/);
  assert.match(source, /EIO=4&transport=websocket/);
  assert.match(source, /Trình duyệt đo HTTP\/WebSocket, không phải ICMP ping/);
  assert.match(source, /latencyHistory\.length > 12/);
  assert.match(source, /sessionNetwork\.successes/);
  assert.doesNotMatch(source, /ICMP.*\d+ ms/);
});

test("weather and browser monitor expose real capability-gated data", () => {
  for (const contract of [
    "api.open-meteo.com", "air-quality-api.open-meteo.com", "navigator.geolocation",
    "performance.memory", "navigator.storage", "navigator.serviceWorker", "navigator.getBattery",
    "FPS tab", "JS heap", "Không hỗ trợ"
  ]) assert.ok(source.includes(contract), `missing capability contract ${contract}`);
  assert.match(source, /không phải CPU\/RAM toàn máy/);
  assert.match(health, /integrations:\s*\{ openai, gemini, youtube, facebook, resend: email \}/);
});

test("Widget Rack is account-scoped, reorderable and limited to six", () => {
  assert.match(source, /hh\.home\.live-widgets\.v1/);
  assert.match(source, /slice\(0, 6\)/);
  assert.match(source, /prefs\.layout\.length < 6/);
  assert.match(source, /dragstart/);
  assert.match(source, /data-hlw-size/);
  assert.match(source, /data-hlw-collapse/);
  assert.match(source, /data-hlw-lock/);
  for (const theme of ["classic", "aero", "neon", "crt", "minimal", "cyber"]) assert.match(source, new RegExp(`"${theme}"`));
});

test("mini apps perform local work without automatic permissions", () => {
  for (const id of ["notes", "calculator", "pomodoro", "timer", "stopwatch", "countdown", "media", "recorder", "jobs"]) {
    assert.match(source, new RegExp(`"${id}"`), `missing mini app ${id}`);
  }
  assert.match(source, /getUserMedia\(\{ audio: true \}\)/);
  assert.match(source, /data-hlw-record="start"/);
  assert.match(source, /data-hlw-audio-file/);
  assert.doesNotMatch(source, /getUserMedia\([^)]*\)\s*;?\s*mount/);
});

test("adaptive scheduler pauses while hidden and planet signals use real state", () => {
  assert.match(source, /document\.hidden/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /connection\?\.saveData/);
  assert.match(source, /slow \? 16000 : 8000/);
  assert.match(source, /slow \? 30 \* 60 \* 1000 : 12 \* 60 \* 1000/);
  for (const signal of ["deadline", "notice", "error", "learning", "running", "comic"]) assert.match(source, new RegExp(`hlw-signal-${signal}`));
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /max-width:\s*700px/);
});
