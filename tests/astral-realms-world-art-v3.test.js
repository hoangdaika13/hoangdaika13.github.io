const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("astral-realms.js");
const css = read("astral-realms.css");
const zones = ["central", "aurora", "crimson", "void", "sky", "ocean", "station", "abyss"];

function between(text, startToken, endToken) {
  const start = text.indexOf(startToken);
  assert.ok(start >= 0, `missing start token ${startToken}`);
  const end = text.indexOf(endToken, start + startToken.length);
  assert.ok(end > start, `missing end token ${endToken}`);
  return text.slice(start, end);
}

function zoneBlock(section, zone, nextZone) {
  const startToken = `    ${zone}: Object.freeze({`;
  const start = section.indexOf(startToken);
  assert.ok(start >= 0, `missing ${zone} block`);
  const end = nextZone
    ? section.indexOf(`    ${nextZone}: Object.freeze({`, start + startToken.length)
    : section.length;
  assert.ok(end > start, `cannot delimit ${zone} block`);
  return section.slice(start, end);
}

test("World Art V4 defines exactly eight story profiles with unique motifs and landmarks", () => {
  assert.match(source, /const WORLD_ART_VERSION\s*=\s*4/);
  const profiles = between(source, "const WORLD_ART_PROFILES", "const STORY_ENVIRONMENT_VARIANTS");
  const profileZones = [...profiles.matchAll(/^    ([a-z]+): Object\.freeze\(\{$/gm)].map((match) => match[1]);
  assert.deepEqual(profileZones, zones);

  const motifs = new Set();
  const landmarks = new Set();
  zones.forEach((zone, index) => {
    const block = zoneBlock(profiles, zone, zones[index + 1]);
    const motif = block.match(/\bmotif:\s*"([^"]+)"/)?.[1];
    const landmark = block.match(/\blandmark:\s*"([^"]+)"/)?.[1];
    assert.ok(motif, `${zone} needs a narrative motif`);
    assert.ok(landmark, `${zone} needs a landmark`);
    motifs.add(motif);
    landmarks.add(landmark);
  });
  assert.equal(motifs.size, zones.length, "each zone needs its own narrative motif");
  assert.equal(landmarks.size, zones.length, "each zone needs its own landmark");
});

test("every story zone predefines exactly two distinct environment outcomes", () => {
  const variants = between(source, "const STORY_ENVIRONMENT_VARIANTS", "const WORLD_ART_BUDGETS");
  const variantZones = [...variants.matchAll(/^    ([a-z]+): Object\.freeze\(\{$/gm)].map((match) => match[1]);
  assert.deepEqual(variantZones, zones);

  zones.forEach((zone, index) => {
    const block = zoneBlock(variants, zone, zones[index + 1]);
    const choices = [...block.matchAll(/^      ([a-z]+): Object\.freeze\(\{/gm)].map((match) => match[1]);
    assert.equal(choices.length, 2, `${zone} must expose two story environment variants`);
    assert.equal(new Set(choices).size, 2, `${zone} variant ids must be distinct`);
    assert.equal((block.match(/\bkind:\s*"[^"]+"/g) || []).length, 2, `${zone} variants need real weather kinds`);
    assert.equal((block.match(/\blandmarkState:\s*"[^"]+"/g) || []).length, 2, `${zone} variants need landmark states`);
  });
});

test("environment resolver derives visuals from persisted world and Story V2 state", () => {
  const resolver = between(source, "    resolveWorldArtState(", "    environmentSignature(");
  for (const [label, pattern] of [
    ["zone world state", /this\.state\.world\?\.zones\?\.\[zoneId\]/],
    ["mission state", /this\.state\.story\?\.missions\?\.\[zoneId\]/],
    ["mission choice", /missionState\.choice/],
    ["identity integrity", /metrics\.identityIntegrity/],
    ["memory debt", /metrics\.memoryDebt/],
    ["causality pressure", /metrics\.causalityPressure/],
    ["selected ending", /endingFlags\?\.selected/],
    ["New Game+ cycle", /story\?\.newGamePlus/],
    ["restoration state", /zoneState\.restored/],
    ["real weather state", /WORLD_WEATHER_KIND_ALIASES\[zoneState\.weather\]/]
  ]) assert.match(resolver, pattern, `resolver ignores ${label}`);
  assert.match(
    resolver,
    /weatherKind:\s*variant\?\.kind\s*\|\|\s*WORLD_WEATHER_KIND_ALIASES\[zoneState\.weather\]\s*\|\|\s*biome\.precipitation/,
    "weatherKind must prefer the resolved story choice, then persisted world weather"
  );
});

test("weather rendering consumes the resolved weatherKind instead of a decorative hard-code", () => {
  const weather = between(source, "    updateWeatherAppearance()", "    updateEffects(");
  assert.match(weather, /const snapshot = this\.resolveWorldArtState\(this\.currentZone\.id\)/);
  assert.match(weather, /const kind = override === "auto" \? snapshot\.weatherKind : override/);
  assert.match(weather, /this\.root\.dataset\.precipitation = kind/);
  assert.match(weather, /snapshot\.weatherStrength/);
  assert.match(weather, /snapshot\.wind/);
});

test("story landmark variants are built once and later switched only by visibility", () => {
  const build = between(source, "    createWorldArtLandmarks()", "    cacheWorldRuntimeObjects()");
  const sync = between(source, "    syncStoryEnvironmentGroups()", "    applyBiomeVisualState(");
  assert.match(build, /const variantGroups = new Map\(\)/);
  assert.match(build, /Object\.entries\(STORY_ENVIRONMENT_VARIANTS\[zone\.id\]/);
  assert.match(build, /variantGroup\.visible = false/);
  assert.match(build, /variantGroups\.set\(choiceId, variantGroup\)/);
  assert.match(sync, /art\.variantGroups\.forEach\(\(variantGroup, choiceId\)/);
  assert.match(sync, /variantGroup\.visible = snapshot\.choiceId === choiceId/);
  assert.doesNotMatch(sync, /new THREE\.(?:Group|Mesh|InstancedMesh|MeshPhysicalMaterial)/, "sync must not rebuild landmark geometry");
});

test("palette, lighting and fog transition with interpolation", () => {
  const transition = between(source, "    updateWorldArtTransition(", "    updateLivingWorld(");
  assert.match(transition, /current\[key\]\.lerp\(target\[key\], blend\)/);
  assert.match(transition, /current\[key\] \+= \(target\[key\] - current\[key\]\) \* blend/);
  assert.match(transition, /this\.scene\.fog\.color\.lerp\(current\.fog/);
  assert.match(transition, /this\.scene\.fog\.density \+= \(current\.fogDensity - this\.scene\.fog\.density\)/);
  assert.match(transition, /const blend = force \|\| reduced \? 1 : clamp\(1 - Math\.exp\(-dt \* 2\.35\)/);
});

test("per-frame world work uses cached lists and world-space streaming positions", () => {
  const cache = between(source, "    cacheWorldRuntimeObjects()", "    createFootprintPool()");
  const updateWorld = between(source, "    updateWorld(dt, time)", "    updateWorldStreaming()");
  const streaming = between(source, "    updateWorldStreaming()", "    updateWeatherAppearance()");
  assert.match(cache, /this\.world\.traverse\(\(object\)/);
  assert.match(cache, /this\.worldArtAnimatedObjects\.push\(object\)/);
  assert.match(cache, /this\.worldArtShadowCandidates\.push\(object\)/);
  assert.match(updateWorld, /this\.worldArtAnimatedObjects\.forEach/);
  assert.doesNotMatch(updateWorld, /\.traverse\(/, "updateWorld must not traverse the scene every frame");
  assert.match(streaming, /this\.worldArtShadowCandidates\.forEach/);
  assert.match(streaming, /object\.getWorldPosition\(scratch\)/);
  assert.doesNotMatch(streaming, /\.traverse\(/, "streaming must consume the cached shadow list");
});

test("World Art V4 pauses hidden-tab rendering and honors reduced motion", () => {
  const visibility = between(source, "this.listen(document, \"visibilitychange\"", "this.listen(root, \"online\"");
  const frame = between(source, "    frame(time)", "    updatePlayer(");
  const world = between(source, "    updateWorld(dt, time)", "    updateWorldStreaming()");
  assert.match(source, /matchMedia\?\.\("\(prefers-reduced-motion: reduce\)"\)\?\.matches === true/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(visibility, /this\.visible = document\.visibilityState !== "hidden"/);
  assert.match(visibility, /this\.runtime\?\.pause\?\.\(\{ gameId: GAME_ID, reason: "hidden-tab" \}\)/);
  assert.match(frame, /if \(this\.visible && this\.renderer && this\.scene && this\.camera\)/);
  assert.match(world, /const worldMotion = this\.state\.settings\.reduceEffects \|\| this\.state\.settings\.vfxLevel === "static" \? 0 : 1/);
});

test("World Art V4 production bundles use release 40/101 and offline cache 319", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const index = read("index.html");
  for (const asset of ["astral-realms.css?v=40", "astral-realms.js?v=40"]) {
    assert.ok(loader.includes(asset), `${asset} missing from route loader`);
    assert.ok(worker.includes(asset), `${asset} missing from offline cache`);
  }
  assert.match(index, /<script src="performance-loader\.js\?v=101"/);
  assert.match(worker, /\.\/performance-loader\.js\?v=101/);
  assert.match(worker, /const CACHE = "hh-identity-portal-v319"/);
});
