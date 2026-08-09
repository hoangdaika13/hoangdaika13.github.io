const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const ARCADE_IDS = [
  "neon-drift", "galaxy-defense", "star-colony", "cipher-run", "asteroid-miner", "rhythm-reactor",
  "quiz-arena", "creative-sandbox", "space-chess", "survival-orbit", "galaxy-farm", "space-fishing",
  "mecha-arena", "planet-builder", "alien-pet", "dungeon-stars", "cosmic-card-battle", "astro-tycoon",
  "space-runner", "black-hole-escape", "nebula-puzzle", "boss-rush"
];

function loadTestHooks() {
  const source = read("game-center.js");
  const context = {
    console,
    Date,
    Math,
    JSON,
    setTimeout,
    clearTimeout,
    window: {}
  };
  context.window.window = context.window;
  vm.runInNewContext(source, context, { filename: "game-center.js" });
  return context.window.HHGameCenter.__test;
}

test("Game Center never upgrades an unconfirmed provider into Cloud or Realtime", () => {
  const hooks = loadTestHooks();
  assert.equal(hooks.isConfirmed({ confirmed: true, connected: true, durable: true }), true);
  assert.equal(hooks.isConfirmed({ confirmed: true, connected: true, durable: false }), false);
  assert.equal(hooks.isConfirmed({ confirmed: true, connected: false, durable: true }), false);
  assert.equal(hooks.isConfirmed({ confirmed: false, connected: true, durable: true }), false);
});

test("Game capability badges keep local, cloud and realtime states honest", () => {
  const hooks = loadTestHooks();
  const game = { id: "astra-hh", release: "ready", realtimeEligible: true };
  const local = hooks.gameCapabilityBadges(game, {
    cloud: { status: "error", confirmed: false, connected: false, durable: false },
    realtime: { status: "disconnected", confirmed: false, connected: false, durable: false }
  });
  assert.deepEqual(Array.from(local, (item) => item.kind), ["release", "local", "cloud", "realtime"]);
  assert.equal(local.find((item) => item.kind === "cloud").active, false);
  assert.equal(local.find((item) => item.kind === "realtime").active, false);

  const connected = hooks.gameCapabilityBadges(game, {
    cloud: { status: "connected", confirmed: true, connected: true, durable: true },
    realtime: { status: "connected", confirmed: true, connected: true, durable: true }
  });
  assert.equal(connected.find((item) => item.kind === "cloud").active, true);
  assert.equal(connected.find((item) => item.kind === "realtime").active, true);
});

test("Save slots are always bounded to three safe local-first slots", () => {
  const hooks = loadTestHooks();
  const slots = hooks.normalizeSaveSlots([
    { id: "slot-2", title: "A", snapshot: { player: { xp: 10 } }, storedAt: "2026-07-23T00:00:00.000Z" },
    { id: "invalid", snapshot: { secret: "drop-me" } },
    { id: "slot-2", title: "duplicate", snapshot: { player: { xp: 20 } } }
  ]);
  assert.equal(slots.length, 3);
  assert.deepEqual(Array.from(slots, (slot) => slot.id), ["slot-1", "slot-2", "slot-3"]);
  assert.equal(slots[1].title, "A");
  assert.equal(slots[0].snapshot, null);
});

test("Playability surface includes real actions and truthful backend states", () => {
  const source = read("game-center.js");
  [
    "continue-last",
    "save-slot",
    "load-slot",
    "delete-slot",
    "refresh-social",
    "report-player",
    "block-player",
    "retry-backend",
    "HHGameRuntime",
    "aria-busy"
  ].forEach((contract) => assert.ok(source.includes(contract), `Missing ${contract}`));
});

test("Playability UI supports responsive focus, reduced motion and status surfaces", () => {
  const styles = read("game-center.css");
  [
    ".gc-capability",
    ".gc-save-slot",
    ".gc-backend-status",
    ".gc-social-actions",
    ":focus-visible",
    "@media (max-width: 410px)",
    "@media (prefers-reduced-motion: reduce)"
  ].forEach((contract) => assert.ok(styles.includes(contract), `Missing ${contract}`));
});

test("Game Center catalog contains exactly 2 flagship, 6 Cinematic and all 22 Arcade games", () => {
  const hooks = loadTestHooks();
  const catalog = Array.from(hooks.catalog, (game) => ({ id: game.id, route: game.route }));
  const flagship = catalog.filter((game) => ["/entertainment/astral-realms", "/entertainment/astra-hh"].includes(game.route));
  const cinematic = catalog.filter((game) => game.route.startsWith("/entertainment/cinematic-arcade/"));
  const arcade = catalog.filter((game) => game.route.startsWith("/entertainment/arcade/"));

  assert.equal(catalog.length, 30);
  assert.equal(flagship.length, 2);
  assert.equal(cinematic.length, 6);
  assert.equal(arcade.length, 22);
  assert.deepEqual(arcade.map((game) => game.id).sort(), [...ARCADE_IDS].sort());
  arcade.forEach((game) => assert.equal(game.route, `/entertainment/arcade/${game.id}`));
  assert.doesNotMatch(read("game-center.js"), /\/entertainment\/arcade\?game=/);
});

test("Game Library supports search, group filters and deterministic A-Z or Z-A sorting", () => {
  const hooks = loadTestHooks();
  const arcade = Array.from(hooks.selectLibraryGames(hooks.catalog, "", "arcade", "default"));
  const cinematic = Array.from(hooks.selectLibraryGames(hooks.catalog, "", "cinematic", "default"));
  const flagship = Array.from(hooks.selectLibraryGames(hooks.catalog, "", "flagship", "default"));
  const az = Array.from(hooks.selectLibraryGames(hooks.catalog, "", "all", "az"), (game) => game.title);
  const za = Array.from(hooks.selectLibraryGames(hooks.catalog, "", "all", "za"), (game) => game.title);
  const search = Array.from(hooks.selectLibraryGames(hooks.catalog, "nebula", "all", "default"), (game) => game.id);

  assert.equal(arcade.length, 22);
  assert.equal(cinematic.length, 6);
  assert.equal(flagship.length, 2);
  assert.deepEqual(az, [...az].sort((a, b) => a.localeCompare(b, "vi", { sensitivity: "base" })));
  assert.deepEqual(za, [...az].reverse());
  assert.deepEqual(search, ["nebula-puzzle"]);

  const source = read("game-center.js");
  for (const control of ["data-gc-library-search", "data-gc-library-filter", "data-gc-library-sort", "data-gc-library-results"]) {
    assert.ok(source.includes(control), `Missing ${control}`);
  }
});
