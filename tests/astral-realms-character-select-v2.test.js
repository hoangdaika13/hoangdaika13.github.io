const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "astral-realms.js"), "utf8");
const css = fs.readFileSync(path.join(root, "astral-realms.css"), "utf8");

function between(startToken, endToken) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.ok(start >= 0 && end > start, `missing block ${startToken}`);
  return source.slice(start, end);
}

test("Character Select Hub exposes at least ten real profiles and six motion previews", () => {
  const profiles = between("const CHARACTER_SELECT_PROFILES", "const CHARACTER_SELECT_PROFILE_MAP");
  assert.ok((profiles.match(/selectionId:/g) || []).length >= 10);
  for (const field of ["baseCharacterId", "modelId", "defaultWeapon", "animationSet", "movementProfile", "cameraProfile", "bodyIkProfile", "unlockedSkills"]) {
    assert.ok(profiles.includes(`${field}:`), `missing profile field ${field}`);
  }
  for (const motion of ["idle", "walk", "run", "attack1", "skill", "ultimate"]) assert.ok(source.includes(`"${motion}"`));
  for (const token of ["data-genesis-profile", "data-genesis-compare", "data-genesis-weapon", "data-genesis-action=\"toggle-weapon\""]) assert.ok(source.includes(token));
  assert.match(css, /\.har-character-select-grid/);
});

test("selection is owner and save-slot scoped and commits only from confirm", () => {
  assert.match(source, /characterSelection:\s*defaultCharacterSelectionState\(playerId\)/);
  assert.match(source, /characterSelection\.ownerId = this\.state\.player\.id/);
  assert.match(source, /characterSelection\.saveSlot = draft\.saveSlot/);
  assert.match(source, /compareIds[\s\S]{0,160}slice\(0, 3\)/);
  assert.match(source, /applyConfirmedCharacterSelection\(\)/);
  assert.match(source, /saveProgress\("Xác nhận nhân vật · Character Select V2"\)/);
  assert.match(source, /Chỉ có thể đổi nhân vật tại H-Central/);
});

test("character replacement warms shaders, validates two frames and crossfades safely", () => {
  const swap = between("async rebuildActiveBuiltInCharacter", "async completeGenesisCreator");
  assert.match(swap, /compileAsync/);
  assert.match(swap, /validatedFrames < 2/);
  assert.match(swap, /transitionMs = 320/);
  assert.match(swap, /clamp\(Number\(transitionMs \|\| 320\), 250, 400\)/);
  assert.ok(swap.indexOf("validatedFrames < 2") < swap.indexOf("disposeCharacterObject(oldMesh"));
  assert.match(source, /const baseOpacity = material\.userData\?\.hhGenesisOpacity\?\.opacity/);
});

test("Animation Graph V2, movesets, camera profiles and four-person squad are wired", () => {
  for (const token of ["CHARACTER_CAMERA_PROFILES", "CHARACTER_MOVEMENT_PROFILES", "BODY_IK_PROFILES", "WEAPON_MOVESETS", "animationGraphV2", "turnInPlace: [45, 90, 180]", "directionalStarts: 8", "phaseSync: true", "motionWarping: true"]) assert.ok(source.includes(token), `missing ${token}`);
  assert.match(source, /updateCompanionSquad\(dt, time\)/);
  assert.match(source, /this\.state\.characterSelection\?\.team \|\| CHARACTER_ORDER/);
  assert.match(source, /\^Digit\[1-4\]\$/);
  assert.doesNotMatch(between("async switchCharacter", "updateCharacterAnimation"), /this\.combo = 0/);
});

test("scheduler, pooled projectiles and Character Lab report real runtime state", () => {
  for (const token of ["heroAnimationHz: 60", "nearNpcHz: 30", "farNpcHz: 12", "facialHz: 24", "secondaryMotionHz: 20", "ui: \"dirty-only\"", "acquireProjectileMesh", "releasePooledEffect", "characterLabSnapshot", "projectedPixels", "largestTexture", "nearestCollider"]) assert.ok(source.includes(token), `missing ${token}`);
  assert.match(source, /upgradeCooldownElapsed = now - this\.lastQualityTransitionAt >= 15000/);
  assert.match(source, /data-setting="characterLab"/);
  assert.match(css, /\.har-character-lab/);
});

test("cinematic decoration clone strips circular collider metadata", () => {
  const clone = between("cloneCinematicDecoration(source)", "buildCinematicFilmSet(zone)");
  assert.match(clone, /safeUserData/);
  assert.match(clone, /\["string", "number", "boolean"\]/);
  assert.match(source, /this\.cloneCinematicDecoration\(child\)/);
  assert.match(source, /this\.cloneCinematicDecoration\(object\)/);
});
