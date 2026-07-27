const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const starMap = require(path.join(root, "creative-star-map.js"));

const ITEMS = starMap.GROUPS.flatMap((group) => group.tools.map((id) => ({
  id, icon: id.slice(0, 2).toUpperCase(), title: id, description: `Workspace ${id}`
})));

test("Creative Star Map has six color-coded clusters and all 25 workspaces", () => {
  assert.equal(starMap.VERSION, "1.0.0");
  assert.equal(starMap.GROUPS.length, 6);
  assert.equal(starMap.GROUPS.flatMap((group) => group.tools).length, 25);
  assert.deepEqual(starMap.GROUPS.map((group) => group.id), [
    "command", "idea", "preproduction", "production", "workflow", "publish"
  ]);
  assert.deepEqual(starMap.GROUPS.map((group) => group.color), [
    "#5eefff", "#ff59d5", "#a887ff", "#6af0ae", "#ffbd59", "#7fa7ff"
  ]);
});

test("all 25 planets resolve to a real Creative OS engine or an existing production module", () => {
  const shell = read("creative-os.js");
  const router = read("script.js");
  const engineViews = new Set([
    "overview", "project", "brief", "moodboard", "storyboard", "world-bible",
    "workflow", "ai-director", "prompt-studio", "repurpose", "brand",
    "audio-dubbing", "prototype", "review", "collaboration", "publishing",
    "analytics", "rights", "providers", "marketplace"
  ]);
  const legacyViews = new Set(["ai-center", "ai-script", "creator-studio", "media-center", "ai-automation"]);
  for (const id of starMap.GROUPS.flatMap((group) => group.tools)) {
    if (engineViews.has(id)) assert.match(shell, new RegExp(`["']${id}["']`), `missing engine route ${id}`);
    else {
      assert.ok(legacyViews.has(id), `planet ${id} has no workspace type`);
      assert.match(router, new RegExp(`["']${id}["']`), `missing production module ${id}`);
    }
  }
});

test("Star Map, Focus and Compact modes are persisted safely", () => {
  assert.equal(starMap.normalizePrefs({ mode: "map" }).mode, "map");
  assert.equal(starMap.normalizePrefs({ mode: "focus" }).mode, "focus");
  assert.equal(starMap.normalizePrefs({ mode: "compact" }).mode, "compact");
  assert.equal(starMap.normalizePrefs({ mode: "unknown" }).mode, "map");
  assert.equal(starMap.normalizePrefs({ activeCluster: "workflow" }).activeCluster, "workflow");
});

test("Galaxy profile mirrors the complete home control deck contract", () => {
  const profile = starMap.homeProfile({
    theme: "solar", motion: "cinematic", stars: 82, nebula: 71, glow: 94,
    effectComet: false, effectNova: true, effectWormhole: true
  });
  assert.equal(profile.theme, "solar");
  assert.equal(profile.primary, "#ffba55");
  assert.equal(profile.secondary, "#ff547d");
  assert.equal(profile.stars, 82);
  assert.equal(profile.nebula, 71);
  assert.equal(profile.glow, 94);
  assert.equal(profile.effectComet, false);
});

test("Sidebar markup is a real star map with truthful empty state", () => {
  const markup = starMap.markup({ items: ITEMS, route: "/create/workflow" });
  assert.match(markup, /data-creative-star-map/);
  assert.match(markup, /data-csm-mode="map"/);
  assert.match(markup, />Star Map</);
  assert.match(markup, />Focus</);
  assert.match(markup, />Compact</);
  assert.equal((markup.match(/data-csm-cluster-section=/g) || []).length, 6);
  assert.equal((markup.match(/data-csm-wormhole-route=/g) || []).length, 25);
  assert.match(markup, /Chưa có hoạt động/);
  assert.doesNotMatch(markup, /\b(mock|fake|demoData)\b/i);
});

test("Star Map source and styles provide planets, tooltips and accessibility", () => {
  const source = read("creative-star-map.js");
  const css = read("creative-star-map.css");
  for (const token of [
    "hh.home.galaxy.preferences.v2", "hh.creative-os.v1",
    "hh:home-galaxy-preferences-applied", "data-csm-wormhole-route",
    "Không tạo trạng thái AI giả"
  ]) assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  for (const token of [
    ".csm-sun", ".csm-cluster-core", ".csm-planet", ".csm-planet > em",
    '[data-csm-mode="focus"]', '[data-csm-mode="compact"]', "calc(var(--csm-stars) * .24)",
    "grid-template-columns: 292px", "white-space:normal", "prefers-reduced-motion"
  ]) assert.match(css, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("Main Creative Galaxy keeps a fixed constellation view and preserves wormhole readiness", () => {
  const galaxy = read("creative-galaxy.js");
  const css = read("creative-galaxy.css");
  const shell = read("creative-os.js");
  const script = read("script.js");
  for (const token of [
    "visualProfile", "data-cg-project",
    "openWormhole", "probeWormhole", "wasCurrentRoute", "hh:creative-workspace-ready", "hh:creative-workspace-error"
  ]) assert.match(galaxy, new RegExp(token));
  assert.doesNotMatch(galaxy, /addEventListener\("wheel"/);
  assert.doesNotMatch(galaxy, /data-cg-view=/);
  assert.doesNotMatch(galaxy, /setPointerCapture/);
  assert.match(css, /\.cg-project-stars/);
  assert.match(css, /translate\(-50%, -50%\) scale\(\.92\)/);
  assert.match(css, /\.cg-universe::after/);
  assert.match(css, /\.cg-wormhole/);
  assert.match(css, /\.cg-focus-metrics/);
  assert.match(shell, /hh:creative-workspace-ready/);
  assert.match(shell, /hh:creative-workspace-error/);
  assert.match(shell, /prepareRoute/);
  assert.match(shell, /dataset\.hhRuntimeAsset === "script"/);
  assert.match(read("creative-star-map.js"), /prepareRoute[\s\S]*pointerover/);
  assert.match(script, /HHCreativeStarMap\.markup/);
  assert.match(script, /hh:route-rendered/);
});

test("Creative Star Map release assets are versioned and cached", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const html = read("index.html");
  for (const asset of [
    "creative-star-map.css?v=2", "creative-star-map.js?v=2",
    "creative-galaxy.css?v=3", "creative-galaxy.js?v=4", "creative-os.js?v=6"
  ]) {
    const pattern = new RegExp(asset.replace(/[.?]/g, "\\$&"));
    assert.match(loader, pattern);
    assert.match(worker, pattern);
  }
  assert.match(worker, /hh-identity-portal-v270/);
  assert.match(html, /performance-loader\.js\?v=53/);
  assert.match(html, /script\.js\?v=144/);
});
