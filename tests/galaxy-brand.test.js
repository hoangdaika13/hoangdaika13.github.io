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

function icoSizes(file) {
  const bytes = fs.readFileSync(path.join(root, file));
  assert.equal(bytes.readUInt16LE(0), 0);
  assert.equal(bytes.readUInt16LE(2), 1);
  const count = bytes.readUInt16LE(4);
  return Array.from({ length: count }, (_, index) => {
    const offset = 6 + index * 16;
    return bytes.readUInt8(offset) || 256;
  });
}

function fixture({ reduced = false, saveData = false, readyState = "complete", storedMode = null } = {}) {
  const listeners = new Map();
  const mediaListeners = new Set();
  const connectionListeners = new Set();
  const links = [];
  const storage = new Map(storedMode ? [["hh.favicon.motionMode", storedMode]] : []);
  let clock = 0;

  const makeLink = () => {
    const linkListeners = new Map();
    return {
      id: "",
      rel: "icon",
      href: "legacy.ico",
      dataset: {},
      isConnected: false,
      addEventListener(type, callback) { linkListeners.set(type, callback); },
      removeEventListener(type, callback) { if (linkListeners.get(type) === callback) linkListeners.delete(type); },
      dispatch(type) { linkListeners.get(type)?.(); },
      remove() {
        this.isConnected = false;
        const index = links.indexOf(this);
        if (index >= 0) links.splice(index, 1);
      }
    };
  };

  for (let index = 0; index < 3; index += 1) {
    const link = makeLink();
    link.isConnected = true;
    links.push(link);
  }

  const document = {
    hidden: false,
    readyState,
    head: { appendChild(node) { node.isConnected = true; if (!links.includes(node)) links.push(node); } },
    createElement(tag) { assert.equal(tag, "link"); return makeLink(); },
    getElementById(id) { return links.find((link) => link.id === id) || null; },
    querySelectorAll(selector) { assert.equal(selector, 'link[rel~="icon"]'); return links.slice(); },
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type, callback) { if (listeners.get(type) === callback) listeners.delete(type); }
  };
  const media = {
    matches: reduced,
    addEventListener(type, callback) { if (type === "change") mediaListeners.add(callback); },
    removeEventListener(type, callback) { if (type === "change") mediaListeners.delete(callback); }
  };
  const connection = {
    saveData,
    addEventListener(type, callback) { if (type === "change") connectionListeners.add(callback); },
    removeEventListener(type, callback) { if (type === "change") connectionListeners.delete(callback); }
  };
  const timers = new Map();
  let nextTimer = 1;
  const context = {
    document,
    encodeURIComponent,
    Math,
    navigator: { connection },
    performance: { now: () => clock },
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, String(value)); }
    },
    matchMedia(query) { assert.equal(query, "(prefers-reduced-motion: reduce)"); return media; },
    setTimeout(callback, delay) { const id = nextTimer++; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: "galaxy-favicon-controller.js" });

  function advanceTimer() {
    const [id, task] = timers.entries().next().value || [];
    assert.ok(task, "expected one active favicon timer");
    timers.delete(id);
    clock += task.delay;
    task.callback();
  }

  return {
    context,
    document,
    timers,
    links,
    listeners,
    media,
    mediaListeners,
    connection,
    connectionListeners,
    storage,
    advanceTimer,
    setClock(value) { clock = value; }
  };
}

test("Galaxy favicon owns one prebuilt 16-frame icon and one Balanced timer", () => {
  const env = fixture();
  const snapshot = env.context.HHGalaxyFavicon.snapshot();
  assert.equal(env.links.length, 1);
  assert.equal(env.links[0].id, "hhDynamicFavicon");
  assert.equal(env.links[0].rel, "icon");
  assert.equal(env.links[0].type, "image/svg+xml");
  assert.equal(env.links[0].sizes, "any");
  assert.match(env.links[0].href, /^data:image\/svg\+xml,/);
  assert.equal(env.timers.size, 1);
  assert.equal([...env.timers.values()][0].delay, 125);
  assert.equal(snapshot.frameCount, 16);
  assert.equal(snapshot.loopDurationMs, 2000);
  assert.equal(snapshot.mode, "balanced");
  assert.equal(snapshot.timerActive, true);
  env.context.HHGalaxyFavicon.init();
  assert.equal(env.links.length, 1);
  assert.equal(env.timers.size, 1);
  assert.doesNotMatch(source, /setInterval|toDataURL|createObjectURL|new Blob|createElement\(["']canvas/i);
});

test("Galaxy favicon pauses while hidden, preserves phase and cleans every listener", () => {
  const env = fixture();
  env.advanceTimer();
  const updatesBeforePause = env.context.HHGalaxyFavicon.snapshot().dynamicUpdates;
  env.document.hidden = true;
  env.listeners.get("visibilitychange")();
  assert.equal(env.timers.size, 0);
  assert.equal(env.links[0].href, env.context.HHGalaxyFavicon.staticIcon);
  assert.equal(env.context.HHGalaxyFavicon.snapshot().dynamicUpdates, updatesBeforePause);
  env.document.hidden = false;
  env.listeners.get("visibilitychange")();
  assert.equal(env.timers.size, 1);
  env.media.matches = true;
  for (const listener of env.mediaListeners) listener();
  assert.equal(env.timers.size, 0);
  assert.equal(env.links[0].href, env.context.HHGalaxyFavicon.staticIcon);
  env.context.HHGalaxyFavicon.destroy();
  assert.equal(env.timers.size, 0);
  assert.equal(env.listeners.has("visibilitychange"), false);
  assert.equal(env.mediaListeners.size, 0);
  assert.equal(env.connectionListeners.size, 0);
  assert.equal(env.links.length, 1);
});

test("reduced motion, Save Data and pre-ready startup use only the static fallback", () => {
  const reduced = fixture({ reduced: true });
  assert.equal(reduced.timers.size, 0);
  assert.equal(reduced.links[0].href, reduced.context.HHGalaxyFavicon.staticIcon);

  const saver = fixture({ saveData: true });
  assert.equal(saver.timers.size, 0);
  assert.equal(saver.context.HHGalaxyFavicon.snapshot().saveData, true);
  saver.connection.saveData = false;
  for (const listener of saver.connectionListeners) listener();
  assert.equal(saver.timers.size, 1);

  const loading = fixture({ readyState: "loading" });
  assert.equal(loading.timers.size, 0);
  assert.equal(loading.links[0].href, loading.context.HHGalaxyFavicon.staticIcon);
  loading.document.readyState = "interactive";
  loading.listeners.get("DOMContentLoaded")();
  assert.equal(loading.timers.size, 1);
});

test("motion modes keep one timer and never rewrite an unchanged Cinematic frame", () => {
  const env = fixture();
  assert.equal(env.context.HHGalaxyFavicon.setMode("power-saver"), true);
  assert.equal(env.timers.size, 1);
  assert.equal([...env.timers.values()][0].delay, 250);
  assert.equal(env.storage.get("hh.favicon.motionMode"), "power-saver");
  assert.equal(env.context.HHGalaxyFavicon.setMode("cinematic"), true);
  assert.equal(env.timers.size, 1);
  assert.equal([...env.timers.values()][0].delay, 100);
  const before = env.context.HHGalaxyFavicon.snapshot().dynamicUpdates;
  env.advanceTimer();
  assert.equal(env.context.HHGalaxyFavicon.snapshot().dynamicUpdates, before);
  env.advanceTimer();
  assert.equal(env.context.HHGalaxyFavicon.snapshot().dynamicUpdates, before + 1);
  assert.equal(env.context.HHGalaxyFavicon.setMode("static"), true);
  assert.equal(env.timers.size, 0);
  assert.equal(env.links[0].href, env.context.HHGalaxyFavicon.staticIcon);
  assert.equal(env.context.HHGalaxyFavicon.setMode("turbo"), false);
});

test("favicon states are truthful and repeated decode failures lock the static fallback", () => {
  const env = fixture();
  assert.equal(env.context.HHGalaxyFavicon.setState("notification"), true);
  assert.equal(env.context.HHGalaxyFavicon.snapshot().state, "notification");
  assert.equal(env.context.HHGalaxyFavicon.setState("unsupported"), false);
  env.links[0].dispatch("error");
  assert.equal(env.context.HHGalaxyFavicon.snapshot().fallbackLocked, false);
  env.links[0].dispatch("error");
  assert.equal(env.context.HHGalaxyFavicon.snapshot().fallbackLocked, true);
  assert.equal(env.timers.size, 0);
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

test("manifest, ICO, static fallback and service worker publish versioned Galaxy assets", () => {
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
  assert.deepEqual(icoSizes("assets/brand/favicon.ico"), [16, 32, 48]);
  assert.equal(manifest.icons.find((icon) => icon.purpose === "maskable")?.src, "assets/brand/pwa-maskable-512.png?v=1");
  assert.match(html, /id="hhDynamicFavicon"[^>]+rel="icon"[^>]+sizes="any"[^>]+hh-galaxy-star-static\.svg\?v=2/);
  assert.doesNotMatch(html, /hh-galaxy-star-static\.svg\?v=1/);
  assert.match(html, /rel="icon"[^>]+type="image\/x-icon"[^>]+sizes="16x16 32x32 48x48"[^>]+favicon\.ico\?v=2/);
  assert.match(html, /rel="icon"[^>]+type="image\/png"[^>]+sizes="16x16"[^>]+favicon-16\.png\?v=2/);
  assert.match(html, /rel="icon"[^>]+type="image\/png"[^>]+sizes="32x32"[^>]+favicon-32\.png\?v=2/);
  assert.match(html, /rel="icon"[^>]+type="image\/png"[^>]+sizes="48x48"[^>]+favicon-48\.png\?v=2/);
  assert.match(html, /apple-touch-icon[^>]+apple-touch-icon\.png\?v=2/);
  assert.match(html, /manifest\.webmanifest\?v=3/);
  assert.match(html, /hh-galaxy-star-share\.png\?v=1/);
  assert.match(loader, /brand-galaxy-logo\.js\?v=2[\s\S]*galaxy-favicon-controller\.js\?v=2/);
  assert.doesNotMatch(read("brand-galaxy-logo.js"), /hh-galaxy-star-static\.svg\?v=1/);
  assert.doesNotMatch(read("community-admin.js"), /hh-galaxy-star-static\.svg\?v=1/);
  assert.match(loader, /ensureGroup\("brand"\)/);
  assert.match(worker, /const CACHE = "hh-identity-portal-v951"/);
  assert.match(worker, /brand-galaxy-logo\.css\?v=1/);
  assert.match(worker, /assets\/brand\/hh-galaxy-star-static\.svg\?v=2/);
  assert.match(worker, /assets\/brand\/favicon\.ico\?v=2/);
  const core = worker.match(/const CORE = \[([\s\S]*?)\n\];/);
  assert.ok(core);
  assert.ok((core[1].match(/"\.\//g) || []).length <= 20);
});
