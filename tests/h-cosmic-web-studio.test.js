const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("H Cosmic Studio r26 is routed as a first-class Tool workspace", () => {
  const shell = read("script.js");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  assert.match(shell, /id:\s*"cosmic"[\s\S]*route:\s*"\/davinci-resolve\/cosmic"/);
  assert.match(shell, /HHCosmicWebStudio\?\.mount/);
  assert.match(loader, /h-cosmic-web-studio\.css\?v=2/);
  assert.match(loader, /h-cosmic-web-studio\.js\?v=2/);
  assert.match(worker, /h-cosmic-web-studio\.css\?v=2/);
  assert.match(worker, /h-cosmic-web-studio\.js\?v=2/);
});

test("web Mission Control covers the complete local bridge workflow", () => {
  const source = read("h-cosmic-web-studio.js");
  const css = read("h-cosmic-web-studio.css");
  for (const marker of [
    "/api/claim", "/api/config", "/api/preflight", "/api/run", "/api/cancel", "/api/status?after=",
    "X-H-Cosmic-Key", "X-H-Cosmic-Auto-Connect", "h-cosmic-auto-v2", "127.0.0.1:8765",
    "source", "timeline", "effects", "grade", "render", "enterprise", "blueprint",
    "one_image_per_video", "wildlife_source", "wildlife_positions", "color_grade_mode", "use_template_timeline",
    "use_profiles", "resume_enabled", "deep_verify", "intermediate_policy", "gpu_temperature_limit_c",
    "PRECHECK", "build", "queue", "render", "FFprobe", "checkpoint"
  ]) assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /prefers-reduced-motion/);
});

test("H Cosmic defaults to a real browser-native batch engine", () => {
  const source = read("h-cosmic-web-studio.js");
  const batch = read("video-batch-factory.js");
  assert.match(source, /activeMode\s*=\s*"web"/);
  assert.match(source, /HHVideoBatchFactory\?\.mount/);
  assert.match(source, /Canvas \+ MediaRecorder \+ Web Audio/);
  assert.match(source, /Không cần Python, Resolve hoặc bridge/);
  for (const marker of [
    "data-bvf-image-folder", "data-bvf-music-folder", "data-bvf-effect-folder",
    "captureStream", "MediaRecorder", "AudioContext", "showDirectoryPicker",
    "createWritable", "render-all", "download-all", "indexedDB.open"
  ]) assert.match(batch, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("the exact portable r26 package is downloadable without entering the startup cache", () => {
  const filename = "downloads/H-Cosmic-Studio-Portable-2026.08.03-r26.zip";
  const zip = fs.readFileSync(path.join(root, filename));
  const source = read("h-cosmic-web-studio.js");
  const worker = read("sw.js");
  assert.equal(zip.byteLength, 74022736);
  assert.equal(crypto.createHash("sha256").update(zip).digest("hex").toUpperCase(), "9C8BE004C7D62231615EFF55CEAF549EB7FFAF26C609C84A844F99001DDA11F3");
  assert.match(source, /H-Cosmic-Studio-Portable-2026\.08\.03-r26\.zip/);
  assert.doesNotMatch(worker, /H-Cosmic-Studio-Portable-2026\.08\.03-r26\.zip/);
});
