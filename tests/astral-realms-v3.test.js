const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Astral Realms defaults to the locked Ultra Photoreal material pass", () => {
  const source = read("astral-realms.js");
  assert.match(source, /const ULTRA_PHOTOREAL_PROFILE\s*=\s*Object\.freeze\(\{/);
  assert.match(source, /renderStyle:\s*"cinematic"/);
  assert.match(source, /renderStyle:\s*ULTRA_PHOTOREAL_PROFILE\.renderStyle/);
  assert.match(source, /visualStyle:\s*ULTRA_PHOTOREAL_PROFILE\.visualStyle/);
  assert.match(source, /APPEARANCE_GROUPS/);
  assert.match(source, /APPEARANCE_CONTROL_MAP/);
  assert.match(source, /defaultAppearanceRecipe/);
  assert.match(source, /appearance-undo/);
  assert.match(source, /native-skeleton/);
  assert.doesNotMatch(source, /procedural-fallback/);
  assert.match(source, /MeshPhysicalMaterial\s*\|\|\s*THREE\.MeshStandardMaterial/);
  assert.match(source, /clearcoatRoughness/);
  assert.match(source, /refreshCharacterMaterials/);
  assert.match(source, /Realistic PBR/);
});

test("Ultra lighting uses soft 4K shadows and a player-following three-point rig", () => {
  const source = read("astral-realms.js");
  assert.match(source, /toneMapping\s*=\s*THREE\.ACESFilmicToneMapping/);
  assert.match(source, /shadowMapSize:\s*4096/);
  assert.match(source, /shadowMap\.type\s*=\s*THREE\.PCFShadowMap/);
  assert.match(source, /const shadowSize\s*=\s*ULTRA_PHOTOREAL_PROFILE\.shadowMapSize/);
  assert.match(source, /this\.heroLights\s*=\s*\{\s*key:\s*heroKey,\s*fill:\s*heroFill,\s*rim:\s*heroRim/);
  assert.match(source, /this\.heroLightRig\.position\.[xz]\s*\+=/);
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
      assert.match(source, /astral-realms\.css\?v=40/);
      assert.match(source, /astral-realms\.js\?v=40/);
  }
});
