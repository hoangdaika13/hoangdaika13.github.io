const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

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
  assert.match(loader, /comic-motion-studio\.css\?v=2/);
  assert.match(loader, /comic-motion-studio\.js\?v=3/);
  assert.match(loader, /vendor\/jszip\.min\.js/);
  assert.match(loader, /vendor\/tesseract\.min\.js/);
  assert.match(worker, /hh-identity-portal-v399/);
  assert.match(worker, /pdf\.worker\.min\.mjs/);
  assert.match(worker, /vie\.traineddata\.gz/);

  for (const contract of [
    /hh\.comic-motion-studio\.v1/, /hh-comic-motion-media/, /webkitdirectory/, /JSZip\.loadAsync/,
    /pdfjs\.getDocument/, /Tesseract\.createWorker/, /detectPanels/, /speechSynthesis/,
    /generateVoice/, /captureStream/, /MediaRecorder/, /mp4Mime/, /webmMime/,
    /prepareAudio/, /subtitles\.srt/, /subtitles\.vtt/, /\.hhcomic/, /undoStack/, /autosave/
  ]) assert.match(source, contract);

  for (const contract of [
    /assertPublicHttpsUrl/, /dns\.lookup/, /isPrivateIp/, /redirect:\s*"manual"/, /MAX_REDIRECTS/,
    /MAX_IMAGE_BYTES/, /rightsAttested/, /siteAuthorization/, /permissionReference/, /exactPageOnly:\s*true/,
    /recursiveCrawl:\s*false/, /antiBotBypass:\s*false/, /comicSourceRights/, /timingSafeEqual/,
    /text-to-speech/, /with-timestamps/
  ]) assert.match(backend, contract);

  assert.match(actions, /handleComicSource/);
  assert.ok(vercel.rewrites.some((rewrite) => rewrite.source === "/api/media/comic-source"
    && rewrite.destination.includes("/api/modules/comic-motion/actions")));
  assert.equal(fs.existsSync(path.join(root, "api/media/comic-source.js")), false);

  assert.match(css, /@media\(max-width:850px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
});
