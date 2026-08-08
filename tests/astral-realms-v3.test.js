const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Astral Realms defaults to a cinematic physical material character pass", () => {
  const source = read("astral-realms.js");
  assert.match(source, /renderStyle:\s*"cinematic"/);
  assert.match(source, /APPEARANCE_GROUPS/);
  assert.match(source, /APPEARANCE_CONTROL_MAP/);
  assert.match(source, /defaultAppearanceRecipe/);
  assert.match(source, /appearance-undo/);
  assert.match(source, /procedural-fallback/);
  assert.match(source, /MeshPhysicalMaterial\s*\|\|\s*THREE\.MeshStandardMaterial/);
  assert.match(source, /clearcoatRoughness/);
  assert.match(source, /refreshCharacterMaterials/);
  assert.match(source, /Realistic PBR/);
});

test("cinematic lighting and adaptive shadows remain bounded by quality", () => {
  const source = read("astral-realms.js");
  assert.match(source, /toneMapping\s*=\s*THREE\.ACESFilmicToneMapping/);
  assert.match(source, /shadowSize\s*=\s*quality\s*===\s*"cinematic"\s*\?\s*4096/);
  assert.match(source, /fillLight/);
  assert.match(source, /rimLight/);
});

test("small realtime shards reconnect and interpolate remote players", () => {
  const client = read("astral-realms.js");
  const realtime = read("realtime-server/src/astral-realms.js");
  const server = read("realtime-server/src/server.js");
  const render = read("render.yaml");

  assert.match(client, /connect_error/);
  assert.match(client, /rejoinPartyAfterReconnect/);
  assert.match(client, /appearance:\s*compactAppearanceRecipe/);
  assert.match(client, /appearanceFingerprint/);
  assert.match(client, /targetPosition/);
  assert.match(client, /targetRotation/);
  assert.match(realtime, /mode:\s*"free-small-shard"/);
  assert.match(realtime, /sanitizeAppearance/);
  assert.match(realtime, /appearance:\s*player\.appearance/);
  assert.match(realtime, /maxPlayers:\s*shard\.maxPlayers/);
  assert.match(server, /registerGameCenterRealtime/);
  assert.match(render, /MAX_GAME_PLAYERS[\s\S]*value:\s*"8"/);
});

test("the release loader and service worker request the latest Astral Realms bundle", () => {
  for (const file of ["performance-loader.js", "sw.js"]) {
    const source = read(file);
      assert.match(source, /astral-realms\.css\?v=77/);
      assert.match(source, /astral-realms\.js\?v=94/);
  }
});
