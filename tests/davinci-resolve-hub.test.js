const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("HH Video Studio is a first-class routed browser workspace", () => {
  const script = read("script.js");
  const loader = read("performance-loader.js");
  const html = read("index.html");
  const hub = read("davinci-resolve-hub.js");

  assert.match(script, /id:\s*"davinci-resolve"/);
  assert.match(script, /label:\s*"Tool"/);
  assert.match(script, /landingRoute:\s*"\/davinci-resolve"/);
  for (const route of ["davinci", "auto"]) {
    assert.match(script, new RegExp(`\\/davinci-resolve\\/${route}`), `route ${route} missing`);
  }
  for (const route of ["media", "cut", "edit", "fusion", "color", "audio", "titles", "deliver"]) {
    assert.match(read("davinci-resolve-hub.js"), new RegExp(`data-dr-view=.*${route}|VIEW_PAGE[\\s\\S]*${route}`), `DaVinci tab ${route} missing`);
  }
  assert.match(hub, /window\.HHDavinciResolveHub\s*=\s*\{\s*mount/);
  assert.match(loader, /davinci:\s*\{[\s\S]*davinci-resolve-hub\.css\?v=4/);
  assert.match(loader, /video-editor-auto\.js\?v=1/);
  assert.match(loader, /video-editor-studio\.js\?v=4/);
  assert.match(loader, /video-editor-resolve\.js\?v=9/);
  assert.match(html, /performance-loader\.js\?v=63/);
});

test("the workspace is independent from the desktop app and reports browser capability truthfully", () => {
  const hub = read("davinci-resolve-hub.js");
  const loader = read("performance-loader.js");

  for (const marker of [
    "HHMediaDesign.render",
    "VideoEncoder",
    "VideoDecoder",
    "navigator.gpu",
    "MediaRecorder",
    "captureStream",
    "indexedDB",
    "hh.video-editor.project.v1",
    "provider-not-configured",
    "Không cần cài ứng dụng desktop"
  ]) assert.match(hub, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.doesNotMatch(hub, /127\.0\.0\.1|localhost:8765|X-H-Cosmic-Key|\/api\/claim/);
  assert.doesNotMatch(loader.match(/davinci:\s*\{[\s\S]*?\n\s*\},\n\s*graphic:/)?.[0] || "", /desktop-bridge/);
});

test("web editor contracts cover media, timeline, subtitles, versions and real export states", () => {
  const hub = read("davinci-resolve-hub.js");
  const studio = read("video-editor-studio.js");
  const resolve = read("video-editor-resolve.js");
  const auto = read("video-editor-auto.js");
  const css = read("davinci-resolve-hub.css");

  for (const marker of [
    "data-dr-project-name", "data-dr-asset-count", "data-dr-timeline", "data-dr-saved",
    "hh:video-project-change", "hh:video-export-status", "data-dr-online"
  ]) assert.match(hub, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  for (const marker of [
    "video/*,audio/*,image/*", "data-ve-subtitle-file", "parseSubtitles", "exportSubtitles",
    "createWaveform", "data-ve-waveform", "cropTop", "fadeIn", "version-save", "version-history",
    "render-cancel", "completed", "failed", "cancelled", "clipRenderProperties",
    "hh:video-keyframe-add", "hh:video-keyframe-delete", "__hhProcessedAudioStream",
    "getComputedStyle(source).filter"
  ]) assert.match(studio, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  for (const marker of [
    "queued", "processing", "completed", "failed", "cancelled", "unsupported",
    "provider-not-configured", "saveStill", "createMediaStreamDestination",
    "__hhProcessedAudioStream", "Motion tracking cần optical-flow worker"
  ]) {
    assert.match(resolve, new RegExp(marker));
  }
  for (const marker of [
    "hh.video-editor.project.v1", "hh-video-editor-media", "analyzeImage", "analyzeVideo",
    "waveform", "buildPlan", "applyPlan", "restoreBackup", "hh:video-auto-applied",
    "status: \"ready\"", "status: \"failed\"", "status: \"unsupported\""
  ]) assert.match(auto, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(resolve, /Math\.sin\(x\s*\/\s*13\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /@media\(max-width:760px\)/);
});
