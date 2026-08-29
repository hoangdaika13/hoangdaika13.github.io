const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "galaxy-domain-views.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "galaxy-domain-views.css"), "utf8");
const documentation = fs.readFileSync(path.join(root, "docs", "HH_GALAXY_ROUTE_CAPABILITIES.md"), "utf8");

test("domain views expose the required lifecycle contract", () => {
  assert.match(source, /global\.HHGalaxyDomainViews\s*=\s*api/);
  for (const method of ["mount", "unmount", "canHandle", "getState"]) {
    assert.match(source, new RegExp(`\\b${method}\\b`), `missing ${method}`);
  }
  assert.match(source, /const instances = new WeakMap\(\)/);
  assert.match(source, /Object\.freeze\(\{\s*version:[\s\S]+mount,[\s\S]+unmount,[\s\S]+canHandle,[\s\S]+getState/);
});

test("canonical routes use the existing HH Platform destinations", () => {
  const canonicalRoutes = [
    "/create/workflow",
    "/work/automation-lab",
    "/work/projects-tasks",
    "/communication/community",
    "/music/ambient",
    "/system/desktop"
  ];
  canonicalRoutes.forEach((route) => assert.match(source, new RegExp(route.replaceAll("/", "\\/")), `missing ${route}`));
  assert.match(source, /aliases:\s*Object\.freeze/);
  assert.match(source, /options\.includeAliases !== false/);
  assert.doesNotMatch(source, /aliases:\s*Object\.freeze\(\["\/create\/ai-automation"/);
  assert.doesNotMatch(source, /aliases:\s*Object\.freeze\(\["\/music-ai\/ambient-room"/);
  assert.match(source, /data-gdv-route=/);
  assert.match(source, /data-gdv-engine=/);
  assert.match(source, /function launchEngine\(instance, engineId\)/);
  assert.doesNotMatch(source, /data-gdv-route="\/work\/automation-lab"/);
  assert.doesNotMatch(source, /data-gdv-route="\/work\/projects-tasks"/);
  assert.doesNotMatch(source, /data-gdv-route="\/communication\/community"/);
  assert.doesNotMatch(source, /window\.open\s*\(/);
  assert.doesNotMatch(source, /<iframe/i);
});

test("capability states are explicit and fabricated metrics are absent", () => {
  for (const state of ["loading", "ready", "empty", "offline", "unsupported", "configuration-required", "degraded", "error"]) {
    assert.match(source, new RegExp(state), `missing ${state}`);
  }
  assert.match(source, /navigator\?\.storage\?\.estimate/);
  assert.match(source, /Không dùng phần trăm minh họa/);
  assert.match(source, /Không có tiến độ minh họa/);
  assert.match(source, /không xuất hiện khi backend chưa trả dữ liệu/);
  assert.match(source, /communityVerified/);
  assert.match(source, /health check chưa được adapter tích hợp xác nhận/);
  assert.doesNotMatch(source, /12\.5K|99\.9%|78\.4 GB|1\.2K Users|89\.2K/);
});

test("external media URLs are protocol constrained before interpolation", () => {
  assert.match(source, /function safeMediaUrl\(value\)/);
  assert.match(source, /\["http:", "https:", "blob:"\]\.includes\(url\.protocol\)/);
  assert.doesNotMatch(source, /src=\\"\$\{escapeHtml\(item\.thumbnail\)\}/);
});

test("legacy data is read without rewriting its storage keys", () => {
  for (const key of ["hh.creative-os.v1", "hh-work-center-v2", "hh-project-center"]) {
    assert.match(source, new RegExp(key.replaceAll(".", "\\.")), `missing adapter ${key}`);
    assert.doesNotMatch(source, new RegExp(`setItem\\(\\s*["']${key.replaceAll(".", "\\.")}`), `must not overwrite ${key}`);
  }
  assert.match(source, /hh\.galaxy\.domain-views\.v1/);
});

test("Web Audio is interaction gated, real and cleaned up", () => {
  assert.match(source, /data-gdv-audio-toggle/);
  assert.match(source, /function startAmbientAudio\(instance\)/);
  assert.match(source, /new AudioContextCtor\(\)/);
  assert.match(source, /createAnalyser\(\)/);
  assert.match(source, /getByteTimeDomainData/);
  assert.match(source, /createGain\(\)/);
  assert.match(source, /\.context\.close\(\)/);
  assert.match(source, /cancelAnimationFrame/);
  assert.match(source, /hh:media-playback/);
  assert.match(source, /source:\s*"galaxy-ambient-room"/);
  assert.match(source, /startedNodes\.forEach/);
  assert.match(source, /Promise\.resolve\(context\.resume\(\)\)/);
  assert.doesNotMatch(source, /startAmbientAudio\(instance\);\s*return \{/);
});

test("Web Desktop is opt-in and resource governed", () => {
  assert.match(source, /desktopEnabled:\s*raw\?\.desktopEnabled === true/);
  assert.match(source, /data-gdv-desktop-enable/);
  assert.match(source, /data-gdv-desktop-disable/);
  assert.match(source, /const MAX_DESKTOP_WINDOWS = 3/);
  assert.match(source, /while \(windows\.length > MAX_DESKTOP_WINDOWS\) windows\.shift\(\)/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /function updateDesktopVisibilityUi\(instance\)/);
  assert.doesNotMatch(source, /handleVisibility\(instance\)[\s\S]{0,500}updateDesktopStage\(instance\)/);
  assert.match(source, /Preview đang nghỉ/);
  assert.doesNotMatch(source, /\.mount\([^)]*gdv-desktop-window/);
});

test("mount owns listeners and unmount releases timers, audio and DOM", () => {
  assert.match(source, /instance\.cleanup\.push/);
  assert.match(source, /removeEventListener/);
  assert.match(source, /clearInterval/);
  assert.match(source, /stopAmbientAudio\(instance\)/);
  assert.match(source, /root\.replaceChildren\(\)/);
  assert.match(source, /instances\.delete\(root\)/);
  assert.match(source, /instance\.timer\.running && !instance\.timer\.interval/);
  assert.doesNotMatch(source, /if \(!instance\.timer\.interval\) instance\.timer\.interval/);
  assert.match(source, /instance\.capabilities\.community = "offline";[\s\S]{0,120}render\(instance\)/);
});

test("views include keyboard and screen reader affordances", () => {
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /aria-current="page"/);
  assert.match(source, /aria-pressed=/);
  assert.match(source, /aria-label=/);
  assert.match(source, /role="table"/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /forced-colors:\s*active/);
});

test("styles are scoped and responsive without broad element ownership", () => {
  assert.match(styles, /\[data-gdv-root\]/);
  assert.match(styles, /@media \(max-width: 1120px\)/);
  assert.match(styles, /@media \(max-width: 520px\)/);
  assert.doesNotMatch(styles, /(?:^|\n)\s*(?:html|body|:root)\s*\{/);
  assert.doesNotMatch(styles, /(?:^|\n)\s*(?:button|input|main|canvas)\s*\{/);
});

test("documentation records routes, honest capabilities and ownership", () => {
  assert.match(documentation, /Canonical route/i);
  assert.match(documentation, /\/work\/automation-lab/);
  assert.match(documentation, /configuration-required/);
  assert.match(documentation, /Không tạo dữ liệu giả/i);
  assert.match(documentation, /Web Audio/i);
  assert.match(documentation, /Resource Governor/i);
});
