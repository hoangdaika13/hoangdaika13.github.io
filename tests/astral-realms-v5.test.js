const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Astral Realms V5 declares quality inside world creation and exposes recovery controls", () => {
  const source = read("astral-realms.js");
  const createWorld = source.slice(source.indexOf("createWorld() {"), source.indexOf("createToonGradient() {"));
  assert.match(createWorld, /const quality\s*=/);
  assert.match(createWorld, /shadowSize\s*=\s*quality/);
  assert.match(source, /data-har-retry/);
  assert.match(source, /data-har-safe-mode/);
  assert.match(source, /applyCompatibilityProfile/);
  assert.match(source, /checkpoint\?\.\(this\.snapshot\(\), \{ slot: "slot-1", label \}\)/);
});

test("V5 streams eight real regions and pauses distant enemy simulation", () => {
  const source = read("astral-realms.js");
  for (const zone of [
    "H-Central",
    "Aurora Vale",
    "Crimson Forge",
    "Void Garden",
    "Sky Ruins",
    "Ocean Moon",
    "Astral Station",
    "Nexus Abyss"
  ]) {
    assert.ok(source.includes(zone), `Missing region: ${zone}`);
  }
  assert.match(source, /createFrontierRegions/);
  assert.match(source, /this\.streamingGroups\.set\(zone\.id, group\)/);
  assert.match(source, /streamDistance\s*>\s*activeRadius/);
  assert.match(source, /PLAYER_LEVEL_CAP\s*=\s*80/);
});

test("V5 supports server-authoritative four or eight player shard tiers", () => {
  const client = read("astral-realms.js");
  const realtime = read("realtime-server/src/astral-realms.js");
  const render = read("render.yaml");
  assert.match(client, /COOP_PLAYER_LIMIT\s*=\s*8/);
  assert.match(client, /game:room:match/);
  assert.match(client, /World Event · 8 người/);
  assert.match(realtime, /MAX_SHARD_PLAYERS\s*=\s*8/);
  assert.match(realtime, /maxPlayers:\s*shard\.maxPlayers/);
  assert.match(render, /MAX_GAME_PLAYERS[\s\S]*value:\s*"8"/);
});
