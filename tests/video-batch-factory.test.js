const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function loadApi() {
  const window = {
    dispatchEvent() {},
    addEventListener() {},
    HHVideoExport: { resolveRecorderMime: () => ({ mime: "video/webm;codecs=vp9", extension: "webm" }) }
  };
  const context = {
    window,
    CustomEvent: class CustomEvent { constructor(type) { this.type = type; } },
    navigator: {},
    indexedDB: {},
    MediaRecorder: class MediaRecorder { static isTypeSupported() { return true; } },
    HTMLCanvasElement: function HTMLCanvasElement() {},
    structuredClone: global.structuredClone,
    localStorage: { getItem() { return null; }, setItem() {} },
    console
  };
  context.HTMLCanvasElement.prototype.captureStream = () => ({});
  vm.runInNewContext(read("video-batch-factory.js"), context);
  return window.HHVideoBatchFactory;
}

test("Batch Video Factory exposes reusable template and CSV contracts", () => {
  const api = loadApi();
  assert.equal(api.presets.length, 6);
  assert.equal(api.colorPresets.length, 12);
  assert.equal(api.normalizeTemplate({ duration: 999 }).duration, 999);
  assert.equal(api.normalizeTemplate({ duration: -5 }).duration, 1);
  assert.equal("overlay" in api.normalizeTemplate({}), false);
  assert.equal(api.normalizeTemplate({}).effectOpacity, 90);
  assert.equal(api.normalizeTemplate({ musicVolume: 999 }).musicVolume, 100);
  assert.equal(api.normalizeTemplate({ musicPitch: 30 }).musicPitch, 12);
  assert.equal(api.normalizeTemplate({ bassGain: -30 }).bassGain, -12);
  assert.equal(api.normalizeTemplate({ bassFrequency: 1 }).bassFrequency, 40);
  assert.equal(api.normalizeTemplate({ midFrequency: 9999 }).midFrequency, 5000);
  assert.equal(api.normalizeTemplate({ trebleFrequency: 99_999 }).trebleFrequency, 16_000);
  assert.equal(api.normalizeTemplate({ colorPreset: "cinematic" }).colorPreset, "cinematic");
  assert.equal(api.normalizeRow({ duration: 99 }).duration, 99);
  assert.equal(api.normalizeTemplate({}).duration, 3600);
  const rows = api.parseCsv('title,subtitle,cta,media\n"Xin chào, bạn","Dòng phụ","Xem ngay","cover.mp4"');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "Xin chào, bạn");
  assert.equal(rows[0].sourceName, "cover.mp4");
});

test("Batch Video Factory is a real routed Tool workspace", () => {
  const script = read("script.js");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const source = read("video-batch-factory.js");
  const css = read("video-batch-factory.css");

  assert.match(script, /id:\s*"batch"[\s\S]*\/davinci-resolve\/batch/);
  assert.match(script, /HHVideoBatchFactory\?\.mount/);
  assert.match(script, /HHVideoBatchFactory\?\.unmount/);
  assert.match(loader, /video-batch-factory\.css\?v=4/);
  assert.match(loader, /video-batch-factory\.js\?v=3/);
  assert.match(worker, /hh-identity-portal-v300/);
  assert.match(worker, /video-batch-factory\.js\?v=3/);
  assert.match(worker, /video-batch-factory\.css\?v=4/);

  for (const contract of [
    /hh-video-editor-media/, /indexedDB\.open/, /captureStream/, /MediaRecorder/,
    /resolveRecorderMime/, /processing/, /completed/, /failed/, /cancelled/,
    /hh:media-asset-created/, /saveToMediaPool/, /autoDownload/,
    /data-bvf-image-folder/, /data-bvf-music-folder/, /data-bvf-effect-folder/,
    /webkitdirectory/, /globalCompositeOperation\s*=\s*"screen"/,
    /showDirectoryPicker/, /createWritable/, /powerPreference:\s*"high-performance"/,
    /getContext\("webgl2"/, /batch-video-music/, /batch-video-effect/,
    /musicGain\.gain\.linearRampToValueAtTime/, /suggestColorForFile/,
    /video\/quicktime/, /3840x2160/, /2560x1440/, /MAX_DURATION/,
    /createBiquadFilter/, /musicPitch/, /midFrequency/, /preservesPitch\s*=\s*false/,
    /outputNameForJob/, /writeChain/, /không chèn chữ, logo hay watermark/
  ]) assert.match(source, contract);
  assert.doesNotMatch(source, /fillText\(/);
  assert.doesNotMatch(source, /showText|template\.logo|template\.watermark|WebM fallback/);
  assert.doesNotMatch(source, /caps\.mp4Mime\s*\|\|/);

  assert.match(css, /@media\(max-width:850px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
});
