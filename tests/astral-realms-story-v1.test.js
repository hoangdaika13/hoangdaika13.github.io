const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("astral-realms.js");
const css = read("astral-realms.css");

test("Story V1 defines the erased-player premise, Aion and eight contradictory Truth Shards", () => {
  for (const token of [
    "Người không tồn tại",
    "The Archivist",
    "Aion",
    "TRUTH_SHARDS",
    "Identity",
    "Memory",
    "Sacrifice",
    "Fear",
    "Freedom",
    "Grief",
    "Betrayal",
    "Truth"
  ]) assert.ok(source.includes(token), `missing story premise token ${token}`);
  assert.match(source, /STORY_ZONE_ORDER\s*=\s*Object\.freeze\(\["central", "aurora", "crimson", "void", "sky", "ocean", "station", "abyss"\]\)/);
});

test("post-Genesis prologue has a real persisted branch and future-self reveal", () => {
  for (const token of [
    "STORY_PROLOGUE",
    "dna-signal",
    "mirror-attack",
    "first-choice",
    "choose-prologue",
    "miraErased",
    "futureSelfRevealed",
    "finish-prologue",
    "showStoryPrologue"
  ]) assert.ok(source.includes(token), `missing prologue feature ${token}`);
  assert.match(source, /completeGenesisCreator[\s\S]*beginRuntimeSession/);
  assert.match(source, /beginRuntimeSession[\s\S]*showStoryPrologue/);
});

test("Story save schema is bounded and migrates quests, Echoes, consequences and endings", () => {
  for (const token of [
    "defaultStoryState",
    "defaultStoryMissionState",
    "constellationLinks",
    "longTermConsequences",
    "dialogueHistory",
    "recapQueue",
    "dangerousPowerUses",
    "genesisPurpose",
    "newGamePlus"
  ]) assert.ok(source.includes(token), `missing story save field ${token}`);
  assert.match(source, /const SCHEMA_VERSION = 7/);
  assert.match(source, /dialogueHistory\.slice\(-80\)/);
  assert.match(source, /decisions\.slice\(-60\)/);
});

test("eight story missions use distinct mechanics and apply visible world consequences", () => {
  for (const mechanic of [
    "Điều tra hiện trường",
    "ba góc nhìn",
    "Boss fight",
    "Xâm nhập",
    "Truy đuổi",
    "thay đổi trọng lực",
    "Bảo vệ nhân chứng",
    "Đối thoại quyết định"
  ]) assert.ok(source.includes(mechanic), `missing mission mechanic ${mechanic}`);
  for (const token of [
    "STORY_OBJECTIVES",
    "progressStoryObjective",
    "reconcileStoryObjective",
    "activateStoryBeacon",
    "resolveStoryMissionChoice",
    "economyModifier",
    "weatherLabel",
    "controlState",
    "departed",
    "trustAll",
    "fearAll"
  ]) assert.ok(source.includes(token), `missing consequence system ${token}`);
  for (const event of ["enter-zone", "beacon", "scan", "dialogue", "puzzle", "collect", "defeat"]) {
    assert.ok(source.includes(`event: "${event}"`), `missing real gameplay objective ${event}`);
  }
  assert.doesNotMatch(source, /advanceStoryMission\s*\(/);
});

test("Echo Memory, companion secrets, recap, timeline and morally ambiguous endings are usable", () => {
  assert.match(source, /const ECHO_MEMORIES = Object\.freeze\(\[/);
  assert.equal((source.match(/zoneId: "(?:central|aurora|crimson|void|sky|ocean|station|abyss)", title: "/g) || []).length >= 16, true);
  for (const token of [
    "unlockStoryEcho",
    "linkZoneEchoes",
    "Memory Constellation",
    "Trust",
    "Fear",
    "Loyalty",
    "Memory Integrity",
    "Story Recap",
    "Dialogue History",
    "Restoration",
    "Perfect Silence",
    "One True World",
    "Free Constellation",
    "Astral Rebirth",
    "startStoryNewGamePlus"
  ]) assert.ok(source.includes(token), `missing story system ${token}`);
});

test("Story UI is responsive, motion-safe and narrative updates stay event-driven", () => {
  for (const selector of [
    ".har-story-overlay",
    ".har-story-cinematic",
    ".har-story-missions",
    ".har-echo-constellation",
    ".har-story-endings"
  ]) assert.ok(css.includes(selector), `missing UI selector ${selector}`);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.har-story-overlay/);
  const frameBody = source.slice(source.indexOf("    frame(time)"), source.indexOf("    updatePlayer(", source.indexOf("    frame(time)")));
  for (const method of ["progressStoryObjective", "resolveStoryMissionChoice", "unlockStoryEcho", "linkZoneEchoes"]) {
    assert.equal(frameBody.includes(method), false, `${method} must not run in the per-frame loop`);
  }
  assert.match(source, /if \(this\.storyOverlayMode\)[\s\S]*trapStoryFocus/);
  assert.match(source, /role="dialog" aria-modal="true"/);
  assert.match(source, /stateChecksum\(\)[\s\S]*story: this\.state\.story/);
});

test("Story choices, endings and New Game+ are guarded and saved without races", () => {
  for (const token of [
    "story-choice-preview",
    "story-choice-confirm",
    "choose-ending-preview",
    "choose-ending-confirm",
    "confirm-new-game-plus",
    "reconcileStoryState",
    "applyEndingConsequences",
    "pendingSaveLabel"
  ]) assert.ok(source.includes(token), `missing guarded story transition ${token}`);
  assert.match(source, /async chooseStoryEnding/);
  assert.match(source, /async startStoryNewGamePlus/);
  assert.match(source, /await this\.saveProgress\("Checkpoint trước New Game\+"\)/);
  assert.match(source, /this\.state\.collectedNodes = \[\]/);
  assert.match(source, /this\.state\.puzzles = \{\}/);
  assert.match(source, /this\.state\.defeated = \{\}/);
});

test("Story V1 assets are cache-busted for production and offline use", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const index = read("index.html");
  for (const asset of ["astral-realms.css?v=36", "astral-realms.js?v=36"]) {
    assert.ok(loader.includes(asset), `${asset} missing from route loader`);
    assert.ok(worker.includes(asset), `${asset} missing from service worker`);
  }
  assert.match(worker, /hh-identity-portal-v315/);
  assert.match(index, /performance-loader\.js\?v=96/);
});
