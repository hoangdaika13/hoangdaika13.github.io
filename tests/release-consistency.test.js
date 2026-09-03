const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function versionFromExecutableHtml(html, asset) {
  const executable = html.replace(/<!--[\s\S]*?-->/g, "");
  const pattern = new RegExp(`(?:src|href)=["']${escapeRegExp(asset)}\\?v=([^"'&\\s]+)`, "i");
  return executable.match(pattern)?.[1] || "";
}

function versionFromLoader(loader, asset) {
  const executable = loader
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  const pattern = new RegExp(`["']${escapeRegExp(asset)}\\?v=([^"'&\\s]+)["']`);
  return executable.match(pattern)?.[1] || "";
}

function arrayBlock(source, name) {
  return source.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n\\];`))?.[1] || "";
}

function assertCached(block, asset, version) {
  assert.ok(version, `${asset} must expose a canonical version`);
  const url = `./${asset}?v=${version}`;
  const matches = block.match(new RegExp(`"${escapeRegExp(url)}"`, "g")) || [];
  assert.equal(matches.length, 1, `${url} must occur exactly once in its Service Worker catalog`);
}

test("the active release and immediately preceding compatibility markers remain contiguous", () => {
  const html = read("index.html");
  const worker = read("sw.js");
  const currentRelease = Number(html.match(/<!--\s*Release v(\d+)\b/)?.[1]);
  const cacheRelease = Number(worker.match(/const CACHE = "hh-identity-portal-v(\d+)"/)?.[1]);

  assert.ok(Number.isInteger(currentRelease) && currentRelease > 0, "index must declare its active release first");
  assert.equal(cacheRelease, currentRelease, "document release and Service Worker cache must advance together");
  assert.match(html, new RegExp(`<!--\\s*Release v${currentRelease - 1}\\b`));
  assert.match(worker, new RegExp(`hh-identity-portal-v${currentRelease - 1}\\b`));
});

test("current shell, HH CORE and Layer One assets share exact loader and cache versions", () => {
  const html = read("index.html");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const core = arrayBlock(worker, "CORE");
  const runtime = arrayBlock(worker, "RUNTIME_ASSETS");

  assert.ok(core, "Service Worker CORE catalog is missing");
  assert.ok(runtime, "Service Worker runtime catalog is missing");
  assertCached(core, "performance-loader.js", versionFromExecutableHtml(html, "performance-loader.js"));
  assertCached(core, "script.js", versionFromExecutableHtml(html, "script.js"));
  assertCached(runtime, "hh-core-gateway.js", versionFromLoader(loader, "hh-core-gateway.js"));
  assertCached(runtime, "galaxy-layer-one.css", versionFromLoader(loader, "galaxy-layer-one.css"));
  assertCached(runtime, "galaxy-layer-one.js", versionFromLoader(loader, "galaxy-layer-one.js"));
});

test("shared runtime dependencies may be catalogued by each consuming route group", () => {
  const runtime = arrayBlock(read("sw.js"), "RUNTIME_ASSETS");
  const urls = [...runtime.matchAll(/"(?<url>\.\/[^"\r\n]+)"/g)].map((match) => match.groups.url);
  const duplicates = [...new Set(urls.filter((url, index) => urls.indexOf(url) !== index))];

  assert.deepEqual(duplicates, ["./vendor/qrcode.js?v=1"]);
});
