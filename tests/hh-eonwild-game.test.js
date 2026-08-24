const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("hh-eonwild-game.js");
const css = read("hh-eonwild-game.css");
const router = read("script.js");
const loader = read("performance-loader.js");
const worker = read("sw.js");
const html = read("index.html");
const game = require(path.join(root, "hh-eonwild-game.js"));

const playerValuesAreBounded = (player) => {
  for (const key of ["health", "hunger", "thirst", "stamina", "growth"]) {
    assert.ok(Number.isFinite(player[key]), `${key} must be finite`);
    assert.ok(player[key] >= 0 && player[key] <= 100, `${key} must stay in [0, 100]`);
  }
};

test("HH EonWild exposes a versioned, deterministic local game API", () => {
  assert.equal(game.VERSION, "1.0.0");
  assert.equal(game.version, game.VERSION);
  assert.equal(game.SCHEMA_VERSION, 1);
  assert.equal(game.STORAGE_KEY, "hh.game.eonwild.v1");
  assert.equal(game.WORLD_SIZE, 4096);
  for (const name of ["normalizeState", "stepVitals", "terrainAt", "createWorld", "mount", "unmount"]) {
    assert.equal(typeof game[name], "function", `${name} must be public and testable`);
  }
});

test("the representative catalog has at least 40 animals, four eras and no human taxon", () => {
  assert.ok(game.SPECIES.length >= 40, `expected at least 40 species, received ${game.SPECIES.length}`);
  assert.equal(new Set(game.SPECIES.map((species) => species.id)).size, game.SPECIES.length, "species ids must be unique");
  assert.deepEqual(
    [...new Set(game.SPECIES.map((species) => species.era))].sort(),
    ["cenozoic", "mesozoic", "modern", "paleozoic"]
  );
  assert.deepEqual(Object.keys(game.ERA_META).sort(), ["cenozoic", "mesozoic", "modern", "paleozoic"]);

  for (const species of game.SPECIES) {
    assert.match(species.id, /^[a-z0-9-]+$/);
    assert.ok(species.name && species.vietnamese && species.period && species.ability);
    assert.ok(Number.isFinite(species.mass) && species.mass > 0);
    assert.ok(Number.isFinite(species.speed) && species.speed > 0);
    const taxonomy = [species.id, species.name, species.vietnamese].join(" ");
    assert.doesNotMatch(taxonomy, /(?:\bhomo\b|\bhuman\b|người)/iu, `human taxon leaked into species: ${taxonomy}`);
  }
});

test("normalizeState migrates hostile or stale saves into a bounded schema", () => {
  const normalized = game.normalizeState({
    schemaVersion: -100,
    speciesId: "lion",
    player: {
      x: -99999,
      y: Infinity,
      health: 500,
      hunger: -25,
      thirst: "55",
      stamina: Number.NaN,
      growth: 101,
      lineage: 1000000
    },
    settings: {
      difficulty: "impossible",
      motion: "cinematic",
      density: "high",
      sound: "yes",
      convergence: false,
      seed: "../ EON seed <script> 💀 123456789012345678901234567890"
    },
    discoveries: ["lion", "lion", "missing", null],
    completed: ["first-water", "first-water", "not-a-mission"],
    activeExpedition: "not-a-mission"
  });

  assert.equal(normalized.schemaVersion, game.SCHEMA_VERSION);
  assert.equal(normalized.speciesId, "lion");
  assert.equal(normalized.player.x, 80);
  assert.equal(normalized.player.y, game.WORLD_SIZE - 80);
  assert.equal(normalized.player.lineage, 9999);
  playerValuesAreBounded(normalized.player);
  assert.deepEqual(normalized.discoveries, ["lion"]);
  assert.deepEqual(normalized.completed, ["first-water"]);
  assert.equal(normalized.activeExpedition, "first-water");
  assert.equal(normalized.settings.difficulty, "balanced");
  assert.equal(normalized.settings.motion, "cinematic");
  assert.equal(normalized.settings.density, "high");
  assert.equal(normalized.settings.sound, false);
  assert.equal(normalized.settings.convergence, false);
  assert.match(normalized.settings.seed, /^[a-z0-9-]{1,24}$/i);
  assert.ok(Number.isFinite(normalized.updatedAt));

  const fallback = game.normalizeState(null);
  assert.equal(fallback.speciesId, "triceratops");
  assert.equal(fallback.schemaVersion, game.SCHEMA_VERSION);
  playerValuesAreBounded(fallback.player);
});

test("stepVitals is pure, difficulty-aware and cannot escape numeric bounds", () => {
  const initial = Object.freeze({ health: 80, hunger: 82, thirst: 78, stamina: 100, growth: 18, lineage: 0, x: 200, y: 200 });
  const snapshot = { ...initial };
  const balanced = game.stepVitals(initial, 5, "balanced", true, true);
  const sanctuary = game.stepVitals(initial, 5, "sanctuary", true, false);
  const wild = game.stepVitals(initial, 5, "wild", true, false);

  assert.deepEqual(initial, snapshot, "stepVitals must not mutate its input");
  assert.notEqual(balanced, initial);
  assert.ok(balanced.hunger < initial.hunger);
  assert.ok(balanced.thirst < initial.thirst);
  assert.ok(balanced.stamina < initial.stamina);
  assert.ok(balanced.growth > initial.growth);
  assert.ok(wild.hunger < sanctuary.hunger);
  assert.ok(wild.thirst < sanctuary.thirst);
  playerValuesAreBounded(balanced);
  playerValuesAreBounded(sanctuary);
  playerValuesAreBounded(wild);

  const depleted = game.stepVitals({ ...initial, hunger: 0, thirst: 0, stamina: 0 }, 100000, "wild", true, true);
  playerValuesAreBounded(depleted);
  assert.equal(depleted.health, 0);
  assert.equal(depleted.hunger, 0);
  assert.equal(depleted.thirst, 0);
});

test("terrain and world generation are deterministic, seeded and bounded", () => {
  const biomeIds = new Set(Object.keys(game.BIOMES));
  const terrainSamples = [
    [-10000, -10000], [0, 0], [256, 1024], [2048, 2048], [4096, 4096], [99999, 99999]
  ];
  for (const [x, y] of terrainSamples) {
    const first = game.terrainAt(x, y, 123456);
    const second = game.terrainAt(x, y, 123456);
    assert.equal(first, second);
    assert.ok(biomeIds.has(first), `unknown terrain ${first}`);
  }

  for (const [density, expectedCount] of [["low", 52], ["balanced", 72], ["high", 96]]) {
    const first = game.createWorld("TEST-SEED", density);
    const second = game.createWorld("TEST-SEED", density);
    assert.deepEqual(first, second, `${density} worlds with the same seed must match`);
    assert.equal(first.resources.length, expectedCount);
    assert.equal(new Set(first.resources.map((resource) => resource.id)).size, expectedCount);
    assert.ok(first.day >= 0 && first.day < 24);
    assert.ok(["clear", "mist", "storm"].includes(first.weather.type));
    assert.ok(Number.isFinite(first.weather.phase));
    assert.ok(first.migration.x >= 0 && first.migration.x <= game.WORLD_SIZE);
    assert.ok(first.migration.y >= 0 && first.migration.y <= game.WORLD_SIZE);
    for (const resource of first.resources) {
      assert.ok(resource.x >= 90 && resource.x <= game.WORLD_SIZE - 90);
      assert.ok(resource.y >= 90 && resource.y <= game.WORLD_SIZE - 90);
      assert.ok(["water", "shelter", "carcass", "plant"].includes(resource.type));
      assert.equal(resource.amount, 100);
      assert.equal(resource.terrain, game.terrainAt(resource.x, resource.y, first.seed));
    }
  }
  assert.notDeepEqual(game.createWorld("TEST-SEED-A"), game.createWorld("TEST-SEED-B"));
});

test("Game is a first-class Entertainment route with six direct views", () => {
  assert.match(router, /id:\s*"eonwild-game"[\s\S]*?label:\s*"Game\s*·\s*EonWild"[\s\S]*?route:\s*"\/game"/);
  for (const route of ["world", "species", "ecosystem", "timeline", "expeditions", "settings"]) {
    assert.match(router, new RegExp(`route:\\s*"/game/${route}"`), `missing /game/${route}`);
  }
  assert.match(router, /id:\s*"entertainment"[\s\S]*?groupIds:\s*\[[^\]]*"play-center"[^\]]*"eonwild-game"/);
  assert.match(router, /route === "\/game" \|\| route\.startsWith\("\/game\/"\)/);
  assert.match(router, /workspace\.innerHTML\s*=\s*'<div data-hh-eonwild-host><\/div>'/);
  assert.match(router, /window\.HHEonWild\?\.mount/);
  assert.match(router, /remember\("eonwild-game"\)/);
  assert.match(router, /data-app-route="\/game\/species"/);
  assert.match(router, /data-app-route="\/game\/world"[^>]*>Chơi tiếp/);
  assert.match(router, /game:\s*"Game\s*·\s*EonWild"/);
});

test("the lazy loader, app shell and service worker share the current asset versions", () => {
  assert.match(loader, /game:\s*\{[\s\S]*?hh-eonwild-game\.css\?v=2[\s\S]*?hh-eonwild-game\.js\?v=2[\s\S]*?\}/);
  assert.match(loader, /value === "\/game" \|\| value\.startsWith\("\/game\/"\)\) return \["game"\]/);
  assert.match(worker, /\.\/hh-eonwild-game\.css\?v=2/);
  assert.match(worker, /\.\/hh-eonwild-game\.js\?v=2/);
  assert.match(worker, /const CACHE\s*=\s*"hh-identity-portal-v\d+"/);

  for (const asset of ["performance-loader.js", "script.js"]) {
    const escaped = asset.replaceAll(".", "\\.");
    const match = html.match(new RegExp(`<script src="${escaped}\\?v=(\\d+)"`));
    assert.ok(match, `${asset} must have a numeric primary version in index.html`);
    assert.ok(worker.includes(`./${asset}?v=${match[1]}`), `${asset}?v=${match[1]} must be cached by sw.js`);
  }
});

test("desktop, touch and gamepad controls perform real local input work", () => {
  for (const code of ["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "KeyE", "KeyQ", "KeyF", "KeyN"]) {
    assert.ok(source.includes(code), `missing keyboard control ${code}`);
  }
  for (const direction of ["ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"]) {
    assert.match(source, new RegExp(`data-hwe-touch="${direction}"`));
  }
  assert.match(source, /pointerdown[\s\S]*?setPointerCapture/);
  assert.match(source, /pointerup[\s\S]*?pointercancel[\s\S]*?pointerleave/);
  assert.match(source, /navigator\?\.getGamepads\?\.\(\)/);
  assert.match(source, /pad\.axes(?:\?\.)?\[0\][\s\S]*?pad\.axes(?:\?\.)?\[1\]/);
  assert.match(source, /data-hwe-action="interact"/);
  assert.match(source, /data-hwe-action="sense"/);
});

test("animation, listeners and observers stop safely when hidden or unmounted", () => {
  assert.match(source, /visibilitychange[\s\S]*?global\.document\.hidden[\s\S]*?instance\.paused\s*=\s*true/);
  assert.match(source, /if\s*\(!global\.document\?\.hidden\)\s*\{\s*updateWorld/);
  assert.match(source, /new AbortController\(\)/);
  assert.match(source, /\{\s*signal:\s*controller\.signal\s*\}/);
  assert.match(source, /instance\.controller\.abort\(\)/);
  assert.match(source, /instance\.resizeObserver\?\.disconnect\?\.\(\)/);
  assert.match(source, /global\.cancelAnimationFrame\?\.\(instance\.raf\)/);
  assert.match(source, /instance\.destroyed\s*=\s*true/);
});

test("the UI is truthful about scope and contains no fake online provider", () => {
  assert.match(source, /Local single-player/);
  assert.match(source, /vertical slice chỉ nằm trên thiết bị/i);
  assert.match(source, /Multiplayer chưa được giả lập/i);
  assert.match(source, /World generation dùng seed cục bộ/i);
  assert.doesNotMatch(source, /\b(?:fetch|eval)\s*\(/);
  assert.doesNotMatch(source, /new\s+(?:Function|WebSocket|EventSource|XMLHttpRequest|RTCPeerConnection)\b/);
  assert.doesNotMatch(source, /(?:fake|mock)(?:User|Player|Friend|Room|Server|Leaderboard|Online)/i);
  assert.doesNotMatch(source, /(?:access.?token|refresh.?token|password|client.?secret)\s*[:=]/i);
});

test("the one-viewport layout bounds scrolling and provides motion/accessibility fallbacks", () => {
  assert.match(css, /body\.app-eonwild-route\s*\{[^}]*overflow:\s*hidden\s*!important/);
  assert.match(css, /\.hwe-root\s*\{[^}]*height:\s*100%[^}]*overflow:\s*hidden/);
  assert.match(css, /\.hwe-main\s*\{[^}]*overflow:\s*hidden/);
  assert.match(css, /\.hwe-library,[\s\S]*?\.hwe-settings\s*\{[^}]*overflow-x:\s*hidden[^}]*overflow-y:\s*auto/);
  assert.match(css, /\.hwe-root\s+:where\([^)]*button[^)]*\)\s*\{[^}]*min-height:\s*(?:44|4[5-9]|[5-9]\d)px/);
  assert.match(css, /@media\s*\(max-width:\s*(?:760|768|820|850|900)px\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /@media\s*\(forced-colors:\s*active\)/);
});
