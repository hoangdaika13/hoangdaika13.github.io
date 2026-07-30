const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "astral-realms.js"), "utf8");
const css = fs.readFileSync(path.join(root, "astral-realms.css"), "utf8");

function between(startToken, endToken) {
  const start = source.indexOf(startToken);
  assert.notEqual(start, -1, `missing ${startToken}`);
  const end = source.indexOf(endToken, start + startToken.length);
  assert.notEqual(end, -1, `missing ${endToken}`);
  return source.slice(start, end);
}

test("Astral archive defines eight distinct realtime 3D story chapters", () => {
  const archive = between("  const ASTRAL_CINEMATICS", "  const BIOME_PROFILES");
  const ids = [...archive.matchAll(/\{ id: "([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, ["central", "aurora", "crimson", "void", "sky", "ocean", "station", "abyss"]);
  assert.equal((source.match(/data-cinematic-chapter=/g) || []).length, 1, "chapter buttons must be generated from the archive");
  assert.match(source, /ASTRAL_CINEMATICS\.map/);
  assert.match(source, /REALTIME 3D/);
  assert.doesNotMatch(archive, /\.mp4|<video/i);
});

test("cinematic controls drive real character, biome and camera state", () => {
  const update = between("    updateStoryCinematic(dt, time)", "    renderGenesisCreator()");
  const camera = between("    updateStoryCinematicCamera(desired, focus, dt)", "    jumpOrGlide()");
  for (const token of ["playerMesh.position.set", "playCharacterClip", "applyNaturalHandPose", "applyProceduralFacialPerformance"]) {
    assert.ok(update.includes(token), `missing realtime character operation ${token}`);
  }
  for (const shot of ["water-sweep", "forge-rise", "gravity-roll", "sky-dive", "ocean-glide", "station-track", "abyss-spiral"]) {
    assert.ok(camera.includes(shot), `missing camera shot ${shot}`);
  }
  for (const action of ["close", "replay", "toggle", "enter"]) {
    assert.ok(source.includes(`cinematicAction === "${action}"`), `missing ${action} control`);
  }
  assert.match(source, /openCinematicGallery\("central", \{ source: "genesis-complete", autoplay: true \}\)/);
  assert.match(source, /if \(this\.cinematicSequence\.active\) this\.updateStoryCinematic\(dt, time\)/);
  assert.match(update, /const playbackNow = performance\.now\(\)/);
  assert.match(source, /Release the modal first/);
  assert.match(source, /if \(overlay\) overlay\.hidden = true/);
  assert.match(source, /const cinematicToggle = this\.root\.querySelector/);
  assert.match(source, /event\.stopPropagation\(\);\s*this\.toggleCinematicPlayback\(\)/);
  assert.match(source, /now - Number\(this\.lastCinematicToggleAt \|\| 0\) < 160/);
});

test("Astral pause keeps its settings panel interactive without a stacked runtime modal", () => {
  const pause = between("    togglePause(force)", "    async toggleFullscreen()");
  assert.match(pause, /this\.saveProgress\("Tạm dừng"\)/);
  assert.doesNotMatch(pause, /runtime\?\.pause/);
  assert.match(source, /const panelActionButton = event\.target\.closest\("\[data-panel-action\]"\)/);
  assert.match(source, /event\.stopPropagation\(\);\s*this\.handlePanelAction/);
});

test("hand safety clamps wrist and finger quaternions around authored rest pose", () => {
  const guard = between("    applyNaturalHandPose(runtime", "    applyProceduralRigMotion(runtime");
  assert.match(source, /handPoseBones: \[\]/);
  assert.match(source, /(?:thumb\|index\|middle\|ring\|pinky\|little\|finger)/);
  assert.match(guard, /rest\.quaternion\.angleTo\(bone\.quaternion\)/);
  assert.match(guard, /kind === "wrist" \? wristLimit : fingerLimit/);
  assert.match(guard, /\.slerp\(bone\.quaternion/);
  assert.match(guard, /rest-clamped/);
  assert.ok((source.match(/applyNaturalHandPose\(runtime/g) || []).length >= 3, "guard must run in gameplay and cinematic paths");
});

test("cinematic UI is responsive, keyboard accessible and motion-safe", () => {
  assert.match(css, /\.har-story-cinema/);
  assert.match(css, /\.har-shell\.is-story-cinematic/);
  assert.match(css, /\.har-story-cinema button:focus-visible/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(source, /if \(this\.cinematicSequence\.active\) \{/);
  assert.match(source, /event\.code === "Escape"/);
});
