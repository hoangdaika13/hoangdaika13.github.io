const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const labs = require("../learning-coach-labs.js");
const source = fs.readFileSync(path.join(__dirname, "..", "learning-coach-labs.js"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "..", "learning-coach-labs.css"), "utf8");

test("exposes one five-workspace Learning Coach API", () => {
  assert.deepEqual(labs.VIEWS, ["coach", "speaking", "listening", "writing", "career-simulator"]);
  ["mount", "mountAll", "unmount", "defaultState", "normalizeState", "compareTranscript", "writingRubric", "grammarPreview", "runCoachTask", "createMemoryStore"].forEach((name) => {
    assert.equal(typeof labs[name], "function", `${name} must be exported`);
  });
  assert.equal(globalThis.HHLearningCoachLabs, labs);
  assert.equal(labs.STORAGE_KEY, "hh.learning.coach-labs.v1");
});

test("state normalization bounds untrusted values and never restores an active recording", () => {
  const state = labs.normalizeState({
    view: "unknown",
    career: "technology",
    speaking: { scenarioId: "airport", recording: true, attempts: [{ score: 800, transcript: "hello" }] },
    listening: { rate: 9, repeats: 90 },
    writing: { draft: "x".repeat(20_000) }
  });
  assert.equal(state.view, "coach");
  assert.equal(state.career, "technology");
  assert.equal(state.speaking.recording, false);
  assert.equal(state.speaking.attempts[0].score, 100);
  assert.equal(state.listening.rate, 1.15);
  assert.equal(state.listening.repeats, 5);
  assert.equal(state.writing.draft.length, 12_000);
});

test("transcript comparison reports useful local practice metrics", () => {
  const exact = labs.compareTranscript("Could I have the menu please", "Could I have the menu, please?", 3);
  assert.equal(exact.score, 100);
  assert.equal(exact.missing.length, 0);
  assert.ok(exact.wordsPerMinute > 0);
  assert.equal(exact.official, false);

  const partial = labs.compareTranscript("Could I menu", "Could I have the menu please");
  assert.ok(partial.score > 0 && partial.score < 100);
  assert.deepEqual(partial.missing.sort(), ["have", "please", "the"]);
  assert.match(partial.notice, /không phải điểm chính thức/i);
});

test("writing rubric is advisory and produces four bounded dimensions", () => {
  const report = labs.writingRubric("First, I reviewed the design. However, I changed the layout because users needed more space.", "B1");
  assert.equal(report.level, "B1");
  assert.equal(report.official, false);
  assert.deepEqual(Object.keys(report.dimensions), ["taskResponse", "organization", "vocabulary", "grammar"]);
  Object.values(report.dimensions).forEach((score) => assert.ok(score >= 0 && score <= 100));
  assert.match(report.notice, /không thay thế điểm/i);
});

test("grammar correction remains a preview until a person applies it", () => {
  const preview = labs.grammarPreview("he go to work and i is ready");
  assert.equal(preview.original, "he go to work and i is ready");
  assert.match(preview.proposed, /he goes to work/i);
  assert.match(preview.proposed, /I am/i);
  assert.equal(preview.changed, true);
  assert.equal(preview.applied, false);
  assert.match(preview.notice, /xem trước/i);
});

test("local fallback is transparent and supports mistakes, plans and career examples", async () => {
  const mistakes = await labs.runCoachTask("mistakes", { mistakes: [{ userAnswer: "He go", answer: "He goes" }] });
  assert.equal(mistakes.source, "local");
  assert.equal(mistakes.label, "Gợi ý tự động cục bộ");
  assert.equal(mistakes.result.steps.length, 1);
  assert.equal(mistakes.result.sourceType, "local");
  assert.ok(mistakes.result.sources.length >= 1);
  assert.match(mistakes.result.explanation, /Deterministic local guidance/);
  assert.match(mistakes.result.disclaimer, /no external AI/i);

  const plan = await labs.runCoachTask("weekly-plan", { dailyMinutes: 25 });
  assert.equal(plan.result.days.length, 7);
  assert.equal(plan.result.days[0].minutes, 25);

  const career = await labs.runCoachTask("career-example", { career: "technology" });
  assert.match(career.result.title, /Công nghệ thông tin/);
  assert.ok(career.result.vocabulary.includes("deployment"));
});

test("runAI adapter is used when supplied and secrets are stripped from its result", async () => {
  let calls = 0;
  const output = await labs.runCoachTask("socratic", { prompt: "Why present perfect?", career: "academic" }, {
    runAI: async (payload) => {
      calls += 1;
      assert.equal(payload.task, "learning-socratic");
      assert.equal(payload.policy.neverChangeOfficialGrade, true);
      assert.equal(payload.policy.neverApplyEditsWithoutConfirmation, true);
      return { title: "Guided hint", apiKey: "must-not-leak", steps: ["Look at the time signal"] };
    }
  });
  assert.equal(calls, 1);
  assert.equal(output.source, "adapter");
  assert.equal(output.label, "Gợi ý từ AI đã cấu hình");
  assert.equal(output.result.apiKey, undefined);
  assert.deepEqual(output.result.steps, ["Look at the time signal"]);
  assert.equal(output.official, false);
});

test("AI adapter failure falls back locally instead of blocking learning", async () => {
  const output = await labs.runCoachTask("daily-summary", { sessions: 3 }, { runAI: async () => { throw new Error("provider offline"); } });
  assert.equal(output.source, "local");
  assert.match(output.warning, /provider offline/);
  assert.match(output.result.summary, /3 phiên học/);
});

test("browser capabilities are permission-gated, cleaned up and styled accessibly", () => {
  assert.match(source, /data-hhlcl-recognize/);
  assert.match(source, /data-hhlcl-record/);
  assert.match(source, /getUserMedia\(\{ audio: true \}\)/);
  assert.match(source, /SpeechRecognition \|\| root\.webkitSpeechRecognition/);
  assert.match(source, /recognition\?\.abort/);
  assert.match(source, /getTracks\?\.\(\)\.forEach|streams\.forEach/);
  assert.match(source, /removeEventListener\("click", onClick\)/);
  assert.match(source, /speechSynthesis\?\.cancel/);
  assert.doesNotMatch(source, /AIza[A-Za-z0-9_-]{12,}|sk-[A-Za-z0-9]{10,}|AQ\.[A-Za-z0-9_-]{10,}|apiKey\s*[:=]\s*["'][^"']+/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(styles, /@media\(max-width:520px\)/);
});

test("local state store persists one bounded document", () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) };
  const store = labs.createMemoryStore(storage);
  store.update((state) => { state.view = "writing"; state.writing.draft = "A local draft."; return state; });
  assert.equal(store.get().view, "writing");
  assert.equal(store.get().writing.draft, "A local draft.");
  assert.ok(memory.has(labs.STORAGE_KEY));
});
