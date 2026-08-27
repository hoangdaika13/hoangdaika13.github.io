const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "galaxy-favicon-controller.js"), "utf8");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function pngSize(file) {
  const bytes = fs.readFileSync(path.join(root, file));
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function fixture({ reduced = false } = {}) {
  const listeners = new Map();
  const mediaListeners = new Set();
  const links = [];
  const makeLink = () => ({
    rel: "icon",
    href: "legacy.ico",
    dataset: {},
    isConnected: false,
    remove() { this.isConnected = false; const index = links.indexOf(this); if (index >= 0) links.splice(index, 1); }
  });
  for (let index = 0; index < 3; index += 1) { const link = makeLink(); link.isConnected = true; links.push(link); }
  const document = {
    hidden: false,
    head: { appendChild(node) { node.isConnected = true; if (!links.includes(node)) links.push(node); } },
    createElement(tag) { assert.equal(tag, "link"); return makeLink(); },
    querySelectorAll(selector) { assert.equal(selector, 'link[rel~="icon"]'); return links.slice(); },
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type, callback) { if (listeners.get(type) === callback) listeners.delete(type); }
  };
  const media = {
    matches: reduced,
    addEventListener(type, callback) { if (type === "change") mediaListeners.add(callback); },
    removeEventListener(type, callback) { if (type === "change") mediaListeners.delete(callback); }
  };
  const intervals = new Map();
  let nextTimer = 1;
  const context = {
    document,
    encodeURIComponent,
    Math,
    matchMedia(query) { assert.equal(query, "(prefers-reduced-motion: reduce)"); return media; },
    setInterval(callback, delay) { const id = nextTimer++; intervals.set(id, { callback, delay }); return id; },
    clearInterval(id) { intervals.delete(id); }
  };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: "galaxy-favicon-controller.js" });
  return { context, document, intervals, links, listeners, media, mediaListeners };
}

test("Galaxy favicon owns one lightweight SVG icon and one 4–8 FPS timer", () => {
  const env = fixture();
  assert.equal(env.links.length, 1);
  assert.equal(env.links[0].rel, "icon");
  assert.equal(env.links[0].type, "image/svg+xml");
  assert.match(env.links[0].href, /^data:image\/svg\+xml,/);
  assert.equal(env.intervals.size, 1);
  assert.equal([...env.intervals.values()][0].delay, 167);
  assert.ok(env.context.HHGalaxyFavicon.frameRate >= 4 && env.context.HHGalaxyFavicon.frameRate <= 8);
  env.context.HHGalaxyFavicon.init();
  assert.equal(env.links.length, 1);
  assert.equal(env.intervals.size, 1);
});

test("Galaxy favicon pauses for hidden tabs and reduced motion, then cleans up", () => {
  const env = fixture();
  const staticIcon = env.context.HHGalaxyFavicon.staticIcon;
  env.document.hidden = true;
  env.listeners.get("visibilitychange")();
  assert.equal(env.intervals.size, 0);
  assert.equal(env.links[0].href, staticIcon);
  env.document.hidden = false;
  env.listeners.get("visibilitychange")();
  assert.equal(env.intervals.size, 1);
  env.media.matches = true;
  for (const listener of env.mediaListeners) listener();
  assert.equal(env.intervals.size, 0);
  assert.equal(env.links[0].href, staticIcon);
  env.context.HHGalaxyFavicon.destroy();
  assert.equal(env.intervals.size, 0);
  assert.equal(env.listeners.has("visibilitychange"), false);
  assert.equal(env.mediaListeners.size, 0);
  assert.equal(env.links.length, 1);
  assert.equal(env.links[0].href, staticIcon);
});

test("reduced-motion startup uses only the static fallback", () => {
  const env = fixture({ reduced: true });
  assert.equal(env.intervals.size, 0);
  assert.equal(env.links.length, 1);
  assert.equal(env.links[0].href, env.context.HHGalaxyFavicon.staticIcon);
});

test("Galaxy Star replaces every global identity surface without changing user initials", () => {
  const html = read("index.html");
  const logo = read("assets/brand/hh-galaxy-star-static.svg");
  const css = read("brand-galaxy-logo.css");
  const runtime = read("brand-galaxy-logo.js");

  assert.ok((html.match(/data-hh-galaxy-logo/g) || []).length >= 6);
  assert.match(html, /hh-boot-mark[^>]+data-hh-galaxy-logo/);
  assert.match(html, /auth-h-channel-mark[^>]+data-hh-galaxy-logo/);
  assert.match(html, /app-brand-logo[^>]+data-hh-galaxy-logo/);
  assert.match(html, /appCosmicLoaderIcon/);
  assert.match(logo, /<polygon points=/);
  assert.doesNotMatch(logo, /<script|(?:href|src)=["']https?:\/\//i);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /data-galaxy-logo-paused/);
  assert.match(runtime, /hh:route-transition-start/);
  assert.match(runtime, /hh:auth-success/);
  assert.match(runtime, /document\.hidden/);
  assert.match(html, /id="shellUserInitials">HH</);
});

test("manifest, social preview and service worker publish truthful versioned Galaxy assets", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  const html = read("index.html");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const expected = new Map([
    ["assets/brand/pwa-192.png?v=1", { width: 192, height: 192 }],
    ["assets/brand/pwa-512.png?v=1", { width: 512, height: 512 }],
    ["assets/brand/pwa-maskable-512.png?v=1", { width: 512, height: 512 }]
  ]);

  for (const icon of manifest.icons) {
    const size = expected.get(icon.src);
    assert.ok(size, `unexpected manifest icon ${icon.src}`);
    assert.deepEqual(pngSize(icon.src.split("?")[0]), size);
    assert.equal(icon.sizes, `${size.width}x${size.height}`);
  }
  assert.equal(manifest.icons.find((icon) => icon.purpose === "maskable")?.src, "assets/brand/pwa-maskable-512.png?v=1");
  assert.match(html, /rel="icon"[^>]+hh-galaxy-star-static\.svg\?v=1/);
  assert.match(html, /apple-touch-icon[^>]+apple-touch-icon\.png\?v=1/);
  assert.match(html, /hh-galaxy-star-share\.png\?v=1/);
  assert.match(loader, /brand-galaxy-logo\.js\?v=1[\s\S]*galaxy-favicon-controller\.js\?v=1/);
  assert.match(loader, /ensureGroup\("brand"\)/);
  assert.match(worker, /hh-identity-portal-v908/);
  assert.match(worker, /brand-galaxy-logo\.css\?v=1/);
  assert.match(worker, /assets\/brand\/hh-galaxy-star-static\.svg\?v=1/);
  const core = worker.match(/const CORE = \[([\s\S]*?)\n\];/);
  assert.ok(core);
  assert.ok((core[1].match(/"\.\//g) || []).length <= 20);
});
