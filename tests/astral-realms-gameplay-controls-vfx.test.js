const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "astral-realms.js"), "utf8");

test("hybrid cursor keeps game UI usable without Escape", () => {
  assert.match(source, /cameraInputMode: "hybrid"/);
  assert.match(source, /\["hybrid", "pointer-lock", "drag"\]/);
  assert.match(source, /releasePointerForUi\(reason = "ui"\)/);
  assert.match(source, /this\.releasePointerForUi\(`panel:\$\{type\}`\)/);
  assert.match(source, /this\.releasePointerForUi\("dialogue"\)/);
  assert.match(source, /this\.releasePointerForUi\("paused"\)/);
  assert.match(source, /this\.state\.settings\.cameraInputMode === "pointer-lock"/);
  assert.match(source, /this\.gameplayAcceptsHybridLook\(\)/);
  assert.match(source, /Hybrid · chuột luôn bấm được UI/);
});

test("four-person squad uses a separated formation and local avoidance", () => {
  assert.match(source, /placeSquadFormation\(immediate = false\)/);
  assert.match(source, /const localX = side \* \(2\.35 \+ row \* 0\.62\)/);
  assert.match(source, /const localZ = 3\.15 \+ row \* 1\.62/);
  assert.match(source, /const minimumSeparation = 1\.72/);
  assert.match(source, /squadFormation = "separated-diamond"/);
  assert.match(source, /this\.placeSquadFormation\(true\)/);
});

test("weapon calibration puts Grip_R in the dominant palm and preserves Grip_L IK", () => {
  assert.match(source, /const dominantGrip = weapon\.getObjectByName\?\.\("Grip_R"\)/);
  assert.match(source, /const gripInAnchor = anchor\.worldToLocal\(gripWorld\)/);
  assert.match(source, /weapon\.position\.sub\(gripInAnchor\)/);
  assert.match(source, /dominantGrip: dominantGrip \? "Grip_R" : "weapon-origin"/);
  assert.match(source, /supportGrip: weapon\.getObjectByName\?\.\("Grip_L"\)/);
  assert.match(source, /targetNode: "Grip_L"/);
});

test("combat VFX samples real blade sockets and pools cinematic ribbons, tracers and impacts", () => {
  for (const token of [
    "acquireWeaponRibbon",
    "AstralBladeCinematicRibbon",
    "updateWeaponRibbonEffect",
    "BladeRoot",
    "BladeTip",
    'shape === "tracer"',
    'poolType: "weapon"',
    'poolType: "hit"',
    "updateWeaponSwing"
  ]) assert.ok(source.includes(token), `missing ${token}`);
  assert.match(source, /state\.positions\.copyWithin\(0, 18/);
  assert.match(source, /effect\.mesh\.geometry\.setDrawRange\(0, state\.segmentCount \* 6\)/);
  assert.match(source, /this\.updateEffects\(dt, time\)/);
});
