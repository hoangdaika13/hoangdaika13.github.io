const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function idsBetween(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `missing registry marker: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `missing registry end marker: ${end}`);
  return [...source.slice(from, to).matchAll(/\{\s*id:\s*["']([^"']+)["']/g)].map((match) => match[1]);
}

function unique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} contains duplicate ids`);
  return values;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
}

const expectedCount = 35;

test("Creative route registries stay in lockstep across shell, router, galaxy and star map", () => {
  const shell = read("creative-os.js");
  const router = read("script.js");
  const galaxy = require(path.join(root, "creative-galaxy.js"));
  const starMap = require(path.join(root, "creative-star-map.js"));

  const shellIds = unique(idsBetween(shell, "const VIEWS", "const TOOL_CONTRACTS"), "Creative OS VIEWS");
  const routerIds = unique(idsBetween(router, "const creativeStudioItems", "const creativeOSViews"), "script creativeStudioItems");
  const galaxyIds = unique(galaxy.CLUSTERS.flatMap((cluster) => cluster.tools.map((tool) => tool[0])), "Creative Galaxy clusters");
  const starIds = unique(starMap.GROUPS.flatMap((group) => group.tools), "Creative Star Map groups");

  for (const [label, ids] of [["shell", shellIds], ["router", routerIds], ["galaxy", galaxyIds], ["star map", starIds]]) {
    assert.equal(ids.length, expectedCount, `${label} should expose ${expectedCount} tools`);
    assert.deepEqual([...ids].sort(), [...shellIds].sort(), `${label} registry diverged from Creative OS VIEWS`);
  }

  // Star Map stores ids (the route is composed by its renderer), while the
  // shell/router own the boundary-safe path mapping.
  assert.match(router, /route === "\/create"/);
  assert.match(router, /routeParts\[0\] === "create" && creativeOSViews\.has\(routeParts\[1\]\)/);
});

test("Creative engines declare every registered tool and specialist assets are cacheable", () => {
  const shell = read("creative-os.js");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const html = read("index.html");
  const ids = idsBetween(shell, "const VIEWS", "const TOOL_CONTRACTS");
  const enginesStart = shell.indexOf("const ENGINES");
  const enginesEnd = shell.indexOf("const GROUP_ACCENTS", enginesStart);
  assert.ok(enginesStart >= 0 && enginesEnd > enginesStart, "missing ENGINES registry");
  const engines = shell.slice(enginesStart, enginesEnd);
  for (const id of ids) {
    const key = `(?:["']${escapeRegExp(id)}["']|${escapeRegExp(id)})`;
    assert.match(engines, new RegExp(`${key}\\s*:`), `missing engine declaration for ${id}`);
  }

  const creativeBlock = loader.slice(loader.indexOf("creative:"), loader.indexOf("music:", loader.indexOf("creative:")));
  const currentAssets = [
    "creative-os.css", "creative-galaxy.css", "creative-galaxy.js", "creative-star-map.css",
    "creative-star-map.js", "creative-os.js", "creative-os-core.js",
    "creative-specialist-studios.css", "creative-specialist-studios.js"
  ];
  for (const asset of currentAssets) {
    const match = creativeBlock.match(new RegExp(`${escapeRegExp(asset)}\\?v=(\\d+)`));
    assert.ok(match, `Creative loader does not register ${asset}`);
    const version = match[1];
    assert.match(worker, new RegExp(`\\./${escapeRegExp(asset)}\\?v=${version}(?:["'])`), `${asset} v${version} missing from service-worker runtime cache`);
  }

  const runtimeBlock = worker.slice(worker.indexOf("const RUNTIME_ASSETS"), worker.indexOf("const CORE"));
  for (const asset of ["creative-specialist-studios.css", "creative-specialist-studios.js"]) {
    const occurrences = runtimeBlock.match(new RegExp(`\\./${escapeRegExp(asset)}\\?v=\\d+`, "g")) || [];
    assert.equal(occurrences.length, 1, `${asset} should occur exactly once in RUNTIME_ASSETS`);
  }

  // Match the canonical src attribute, not the later data-compat-src value.
  const loaderVersion = html.match(/<script\s+src="performance-loader\.js\?v=(\d+)"/)?.[1];
  const scriptVersion = html.match(/<script\s+src="script\.js\?v=(\d+)"/)?.[1];
  assert.ok(loaderVersion, "loader version is not discoverable");
  assert.ok(scriptVersion, "script version is not discoverable");
  assert.match(html, new RegExp(`performance-loader\\.js\\?v=${loaderVersion}`));
  assert.match(worker, new RegExp(`performance-loader\\.js\\?v=${loaderVersion}`));
  assert.match(worker, new RegExp(`script\\.js\\?v=${scriptVersion}`));
});

test("Creative asset loader matches only the /create path namespace", () => {
  const loader = read("performance-loader.js");
  assert.match(loader, /value === "\/create" \|\| value\.startsWith\("\/create\/"\)/);
  assert.doesNotMatch(loader, /if \(value\.startsWith\("\/create"\)\) return \["creative", "platform"\]/);
});
