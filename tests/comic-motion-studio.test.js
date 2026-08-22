const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const comicSource = require(path.join(root, "utils/comic-source"));

test("comic source URLs are normalized before validation", () => {
  const normalize = comicSource.__test.normalizeSourceUrl;
  assert.equal(normalize("  <https://example.com/chapter-1>  "), "https://example.com/chapter-1");
  assert.equal(normalize("`https://example.com/chapter-1`"), "https://example.com/chapter-1");
  assert.equal(normalize("https://example.com/\nchapter-1"), "https://example.com/chapter-1");
  assert.equal(normalize("www.example.com/chapter-1"), "https://www.example.com/chapter-1");
  assert.equal(normalize("javascript:alert(1)"), "javascript:alert(1)");
});

function loadFrontend() {
  const window = { dispatchEvent() {}, addEventListener() {} };
  const context = {
    window,
    CustomEvent: class CustomEvent { constructor(type) { this.type = type; } },
    localStorage: { getItem() { return null; }, setItem() {} },
    navigator: {}, indexedDB: {}, URL, Blob, structuredClone: global.structuredClone,
    setTimeout, clearTimeout, requestAnimationFrame() { return 1; }, cancelAnimationFrame() {}, console
  };
  vm.runInNewContext(read("comic-motion-studio.js"), context);
  return window.HHComicMotionStudio;
}

test("Comic Motion Studio exposes normalized project, scene and honest render capabilities", () => {
  const api = loadFrontend();
  assert.ok(api);
  assert.equal(api.normalizeSourceUrl(" <https://example.com/chapter-1> "), "https://example.com/chapter-1");
  assert.deepEqual(Object.keys(api.formats), ["landscape", "portrait", "square"]);
  const state = api.normalizeState({ format: { id: "portrait", fps: 30 }, scenes: [{ duration: 999, camera: { mode: "bad" } }] });
  assert.equal(state.format.width, 1080);
  assert.equal(state.format.height, 1920);
  assert.equal(state.scenes[0].duration, 180);
  assert.equal(state.scenes[0].camera.mode, "kenburns");
  assert.equal(api.capabilities().capture, false);
});

test("Comic source parser excludes chrome, ads and duplicates while preserving chapter images", () => {
  const helpers = require("../utils/comic-source.js").__test;
  const html = `
    <header><img src="https://cdn.example.com/logo.png" width="800" height="800"></header>
    <main>
      <img data-original="/chapter/001.jpg" alt="Trang 1" width="900" height="1600">
      <img data-src="https://cdn.example.com/chapter/002.webp" alt="Trang 2">
      <img src="/chapter/001.jpg" alt="duplicate">
      <img src="https://cdn.example.com/advert-banner.jpg" width="900" height="400">
      <img src="https://cdn.example.com/icon.png" width="32" height="32">
    </main>`;
  const images = helpers.extractImageUrls(html, "https://reader.example.com/story/chapter-1");
  assert.equal(images.length, 2);
  assert.equal(images[0].url, "https://reader.example.com/chapter/001.jpg");
  assert.equal(images[1].url, "https://cdn.example.com/chapter/002.webp");
});

test("Comic source SSRF checks identify private and reserved addresses", () => {
  const { isPrivateIp } = require("../utils/comic-source.js").__test;
  for (const address of ["127.0.0.1", "10.2.3.4", "172.20.2.2", "192.168.1.1", "169.254.2.1", "::1", "fd00::1", "::ffff:127.0.0.1"]) {
    assert.equal(isPrivateIp(address), true, address);
  }
  assert.equal(isPrivateIp("1.1.1.1"), false);
  assert.equal(isPrivateIp("2606:4700:4700::1111"), false);
});

test("Comic source validates image magic bytes, MIME and pixel limits", () => {
  const { detectImageMime, validateImageBytes } = require("../utils/comic-source.js").__test;
  const png = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
  png.writeUInt32BE(1200, 16); png.writeUInt32BE(1800, 20);
  assert.equal(detectImageMime(png), "image/png");
  assert.deepEqual(validateImageBytes(png, "image/png").dimensions, { width: 1200, height: 1800 });
  assert.throws(() => validateImageBytes(png, "image/jpeg"), (error) => error.code === "IMAGE_MIME_MISMATCH");
  const bomb = Buffer.from(png); bomb.writeUInt32BE(20000, 16); bomb.writeUInt32BE(20000, 20);
  assert.throws(() => validateImageBytes(bomb, "image/png"), (error) => error.code === "IMAGE_PIXEL_LIMIT");
});

test("Comic source keeps the dominant chapter sequence and excludes surrounding page art", () => {
  const { selectChapterImages, extractPageTitle } = require("../utils/comic-source.js").__test;
  const candidates = [
    { url: "https://reader.example.com/banner.webp", alt: "" },
    ...Array.from({ length: 8 }, (_, index) => ({ url: `https://media.example.com/chapter-113/${index + 1}.jpg`, alt: "raw" })),
    { url: "https://reader.example.com/memes/reaction.jpg", alt: "Meme 34" }
  ];
  const selected = selectChapterImages(candidates);
  assert.equal(selected.length, 8);
  assert.ok(selected.every((image) => image.alt === "raw"));
  assert.match(extractPageTitle("<title>Truyện mẫu – Chap 113</title>"), /Chap 113/);
});

test("Comic source extracts only same-site chapter links from a full-series page", () => {
  const { extractChapterLinks } = require("../utils/comic-source.js").__test;
  const html = `<h2>Danh sách chap</h2>
    <a href="/truyen/demo-chap-113/">Chương 113</a>
    <a href="https://reader.example.com/truyen/demo-chap-112/">Chương 112</a>
    <a href="https://other.example.com/demo-chap-111/">Chương 111</a>
    <a href="/truyen/bo-khac/">Truyện liên quan</a>
    <a href="/comment/demo-chap-110/">Bình luận chap 110</a>`;
  const chapters = extractChapterLinks(html, "https://reader.example.com/truyen/demo/");
  assert.deepEqual(chapters.map((chapter) => chapter.number), [113, 112]);
  assert.ok(chapters.every((chapter) => chapter.url.startsWith("https://reader.example.com/")));
});

test("Comic source fingerprints remain stable for resume and changed-page detection", () => {
  const { stableFingerprint, sequenceFingerprint } = require("../utils/comic-source.js").__test;
  const images = [{ url: "https://cdn.example.com/1.jpg" }, { url: "https://cdn.example.com/2.jpg" }];
  assert.equal(stableFingerprint(images[0].url), stableFingerprint(images[0].url));
  assert.notEqual(sequenceFingerprint(images), sequenceFingerprint([...images].reverse()));
});

test("Comic Motion Studio is registered in route, sidebar, search, lazy loader and offline cache", () => {
  const script = read("script.js");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const source = read("comic-motion-studio.js");
  const css = read("comic-motion-studio.css");
  const backend = read("utils/comic-source.js");
  const actions = read("api/modules/[moduleId]/actions.js");
  const vercel = JSON.parse(read("vercel.json"));

  assert.match(script, /route:\s*"\/comic-motion-studio"/);
  assert.match(script, /HHComicMotionStudio\?\.mount/);
  assert.match(script, /HHComicMotionStudio\?\.unmount/);
  assert.match(script, /Comic Motion Studio/);
  assert.match(loader, /comic-motion-studio\.css\?v=7/);
  assert.match(loader, /services\/comicLibraryBridge\.js\?v=1/);
  assert.match(loader, /comic-motion-studio\.js\?v=11/);
  assert.match(loader, /vendor\/jszip\.min\.js/);
  assert.match(loader, /vendor\/tesseract\.min\.js/);
  assert.match(loader, /STYLE_TIMEOUT_MS\s*=\s*15000/);
  assert.match(loader, /SCRIPT_TIMEOUT_MS\s*=\s*20000/);
  assert.match(loader, /assetPromises\.delete\(key\)/);
  assert.match(loader, /retryForRoute/);
  assert.match(worker, /hh-identity-portal-v805/);
  assert.match(worker, /pdf\.worker\.min\.mjs/);
  assert.match(worker, /vie\.traineddata\.gz/);

  for (const contract of [
    /hh\.comic-motion-studio\.v1/, /hh-comic-motion-media/, /webkitdirectory/, /JSZip\.loadAsync/,
    /pdfjs\.getDocument/, /Tesseract\.createWorker/, /detectPanels/, /speechSynthesis/,
    /generateVoice/, /captureStream/, /MediaRecorder/, /mp4Mime/, /webmMime/,
    /prepareAudio/, /subtitles\.srt/, /subtitles\.vtt/, /\.hhcomic/, /undoStack/, /autosave/,
    /sourceMode/, /fetchAuthorizedImages/, /downloadSourceArchive/, /source-manifest\.json/, /Math\.min\(3, images\.length\)/,
    /mountEpoch/, /sourceController/, /signal = controller\?\.signal/, /epoch !== mountEpoch/
  ]) assert.match(source, contract);
  for (const contract of [
    /SERIES_LIBRARY_KEY/, /TASK_CENTER_KEY/, /QUALITY_PRESETS/, /CAMERA_PRESETS/, /sourceInspection/, /blobChecksum/, /showDirectoryPicker/, /writeSeriesProject/, /buildStoryboard/, /FaceDetector/, /waveformForBlob/, /renderQueue/, /data-cms-command-dialog/, /data-cms-source-minimize/, /data-cms-series-select-new/
  ]) assert.match(source, contract);
  assert.ok(fs.statSync(path.join(root, "vendor/tessdata/jpn.traineddata.gz")).size > 100000);
  assert.ok(fs.statSync(path.join(root, "vendor/tessdata/chi_sim.traineddata.gz")).size > 100000);
  assert.match(source, /Tải website/);
  assert.match(source, /Tải ảnh từ website được cấp phép/);

  for (const contract of [
    /assertPublicHttpsUrl/, /dns\.lookup/, /isPrivateIp/, /redirect:\s*"manual"/, /MAX_REDIRECTS/,
    /MAX_IMAGE_BYTES/, /rightsAttested/, /siteAuthorization/, /permissionReference/, /exactPageOnly:\s*true/,
    /recursiveCrawl:\s*false/, /antiBotBypass:\s*false/, /comicSourceRights/, /timingSafeEqual/, /selectChapterImages/,
    /sequenceDetection:\s*"dominant-alt-directory-host"/,
    /text-to-speech/, /with-timestamps/
  ]) assert.match(backend, contract);

  assert.match(actions, /handleComicSource/);
  assert.match(script, /routeAssetRetries/);
  assert.match(script, /Promise\.resolve\(window\.HHComicMotionStudio\.mount/);
  assert.doesNotMatch(script, /event\.detail\?\.route[^\n]+comic-motion-studio[^\n]+renderRouteSafely/);
  assert.ok(vercel.rewrites.some((rewrite) => rewrite.source === "/api/media/comic-source"
    && rewrite.destination.includes("/api/modules/comic-motion/actions")));
  assert.equal(fs.existsSync(path.join(root, "api/media/comic-source.js")), false);

  assert.match(css, /@media\(max-width:850px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
});
