const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const story = require("../services/astra-story/NexusEchoStoryV3.js");
const game = fs.readFileSync(path.join(root, "astral-realms.js"), "utf8");
const css = fs.readFileSync(path.join(root, "astral-realms.css"), "utf8");
const loader = fs.readFileSync(path.join(root, "performance-loader.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "sw.js"), "utf8");

test("Memory Canon V3 contains the complete deep story bible", () => {
  assert.equal(story.VERSION, 3);
  assert.equal(story.CHAPTERS.length, 8);
  assert.equal(Object.keys(story.BOSSES).length, 8);
  assert.equal(story.MEMORIES.length, 24);
  assert.equal(story.CONTRADICTIONS.length, 8);
  assert.equal(story.SIDE_QUESTS.length, 7);
  assert.equal(story.FACTIONS.length, 3);
  assert.equal(Object.keys(story.CHARACTERS).length, 4);
  assert.deepEqual(story.CHAPTERS.map((chapter) => chapter.title), [
    "Con quái vật gọi tên tôi", "Thành phố không có bóng", "Bốn lời khai", "Vũ khí biết khóc",
    "Cuộc chiến H-Central", "Hành tinh ngày mai đã chết", "Người săn cuối cùng", "Ký ức của một vì sao"
  ]);
  assert.ok(story.CHAPTERS.every((chapter) => chapter.objective && chapter.reveal && chapter.bossId && chapter.dilemmaId));
  assert.ok(Object.values(story.CHARACTERS).every((character) => character.milestones.length === 5 && character.secret && character.skill));
});

test("story normalization drops unknown records and bounds every saved value", () => {
  const state = story.normalizeState({
    revealedMemories: ["c1-order", "unknown"],
    contradictions: ["contradiction-invasion", "fake"],
    companionTrust: { lyra: 999, cael: -20, stranger: 80 },
    responses: { "dilemma-first-core": "truth", fake: "mercy" },
    bossCodex: { "future-nax": { encounters: 999999, understood: true }, fake: { understood: true } }
  });
  assert.deepEqual(state.revealedMemories, ["c1-order"]);
  assert.deepEqual(state.contradictions, ["contradiction-invasion"]);
  assert.equal(state.companionTrust.lyra, 100);
  assert.equal(state.companionTrust.cael, 0);
  assert.equal(Object.hasOwn(state.companionTrust, "stranger"), false);
  assert.deepEqual(state.responses, { "dilemma-first-core": "truth" });
  assert.equal(Object.hasOwn(state.bossCodex, "fake"), false);
  assert.equal(state.bossCodex["future-nax"].encounters, 999);
});

test("scan hunt and boss events unlock evidence, contradictions and truthful boss perspective", () => {
  let state = story.createState();
  let result = story.recordEvent(state, { type: "scan", chapter: 1, zoneId: "central" });
  state = result.state;
  assert.deepEqual(result.unlockedMemories, ["c1-order"]);
  result = story.recordEvent(state, { type: "hunt", chapter: 1, zoneId: "central" });
  state = result.state;
  assert.deepEqual(result.unlockedMemories, ["c1-voice"]);
  assert.ok(state.contradictions.includes("contradiction-invasion"));
  result = story.recordEvent(state, { type: "boss", chapter: 1, zoneId: "central" });
  assert.ok(result.state.revealedMemories.includes("c1-city"));
  assert.equal(result.state.bossCodex["nameless-herald"].understood, true);
});

test("side quests only advance from matching gameplay events", () => {
  let state = story.recordEvent(story.createState(), { type: "travel", chapter: 2, zoneId: "aurora" }).state;
  let started = story.startSideQuest(state, "wife-in-the-core", 2);
  assert.equal(started.started, true);
  state = started.state;
  let result = story.recordEvent(state, { type: "hunt", chapter: 2, zoneId: "aurora" });
  assert.equal(result.state.sideQuests["wife-in-the-core"].objective, 0, "hunt cannot skip the required scan");
  result = story.recordEvent(result.state, { type: "scan", chapter: 2, zoneId: "aurora" });
  assert.equal(result.state.sideQuests["wife-in-the-core"].objective, 1);
  result = story.recordEvent(result.state, { type: "hunt", chapter: 2, zoneId: "aurora" });
  assert.equal(result.state.sideQuests["wife-in-the-core"].objective, 2);
  result = story.recordEvent(result.state, { type: "talk", chapter: 2, zoneId: "aurora", characterId: "nyx" });
  assert.equal(result.state.sideQuests["wife-in-the-core"].status, "completed");
  assert.ok(result.completedQuests.includes("wife-in-the-core"));
  assert.ok(result.state.companionTrust.nyx >= 8);
});

test("responses change trust and insight without branching the canon", () => {
  const first = story.chooseResponse(story.createState(), "dilemma-first-core", "truth", 1);
  assert.equal(first.accepted, true);
  assert.equal(first.state.responses["dilemma-first-core"], "truth");
  assert.equal(first.state.companionTrust.cael, 4);
  assert.equal(first.state.factionInsight["ash-choir"], 2);
  const duplicate = story.chooseResponse(first.state, "dilemma-first-core", "mercy", 1);
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.state.responses["dilemma-first-core"], "truth");
  assert.equal(Object.hasOwn(first.state, "ending"), false);
  assert.equal(Object.hasOwn(first.state, "choiceHistory"), false);
});

test("camp conversations and location banter are persistent and non-repeating", () => {
  const firstConversation = story.syncCompanionBond(story.createState(), "nyx", 5);
  assert.equal(firstConversation.conversation.title, "Chúng không gầm");
  const secondConversation = story.syncCompanionBond(firstConversation.state, "nyx", 5);
  assert.equal(secondConversation.conversation.title, "Vết sáng dưới da");
  const thirdConversation = story.syncCompanionBond(secondConversation.state, "nyx", 5);
  assert.equal(thirdConversation.conversation.title, "Ngôn ngữ của tro");
  const exhaustedConversation = story.syncCompanionBond(thirdConversation.state, "nyx", 5);
  assert.equal(exhaustedConversation.conversation, null);
  const firstBanter = story.nextBanter(exhaustedConversation.state, "void", 4);
  assert.ok(firstBanter.banter);
  const secondBanter = story.nextBanter(firstBanter.state, "void", 4);
  assert.ok(secondBanter.banter);
  const exhausted = story.nextBanter(secondBanter.state, "void", 4);
  assert.equal(exhausted.banter, null);
});

test("HH ASTRA loads and exposes every real Memory Canon interaction", () => {
  assert.match(loader, /services\/astra-story\/NexusEchoStoryV3\.js\?v=1[\s\S]*astral-realms\.js\?v=96/);
  assert.match(worker, /services\/astra-story\/NexusEchoStoryV3\.js\?v=1/);
  for (const contract of [
    "recordNarrativeGameplayEvent", "triggerNarrativeBanter", "startNarrativeSideQuest", "chooseNarrativeResponse",
    "renderMemoryPanel", "renderCampPanel", "data-har-panel=\"memory\"", "data-har-panel=\"camp\"",
    "data-panel-action=\"start-memory-quest\"", "data-panel-action=\"narrative-response\""
  ]) assert.ok(game.includes(contract), `missing integration ${contract}`);
  for (const style of [".har-memory-hero", ".har-story-rail", ".har-memory-grid", ".har-response-grid", ".har-camp-grid", ".har-story-faction-grid"]) assert.match(css, new RegExp(style.replace(".", "\\.")));
  assert.match(game, /const SCHEMA_VERSION = 12/);
});
