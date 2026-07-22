const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../learning-platform-core.js");
const review = require("../learning-review.js");

function memoryStore(seed) {
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) || null,
    setItem: (key, value) => memory.set(key, value)
  };
  const store = core.createStore(storage);
  if (seed) store.set(seed);
  return store;
}

function stateWithLearningData(now = Date.UTC(2026, 6, 21, 8)) {
  const state = core.defaultState(now);
  state.profile.retentionGoal = 90;
  state.reviews = [
    { id: "due-hard", prompt: "deployment", answer: "triển khai", trackId: "technology", skillId: "vocabulary", difficulty: 8, stability: 2, intervalDays: 2, lapses: 3, dueAt: new Date(now - 2 * 86_400_000).toISOString() },
    { id: "due-new", prompt: "brief", answer: "bản mô tả", trackId: "design", skillId: "vocabulary", difficulty: 3, stability: 1, intervalDays: 1, lapses: 0, dueAt: new Date(now - 60_000).toISOString() },
    { id: "soon", prompt: "invoice", answer: "hóa đơn", trackId: "finance", skillId: "vocabulary", difficulty: 4, stability: 3, intervalDays: 3, lapses: 1, dueAt: new Date(now + 12 * 3_600_000).toISOString() }
  ];
  state.mistakes = [
    { id: "m1", lessonId: "technology-a1-01", skillId: "vocabulary", prompt: "deploy", answer: "triển khai", userAnswer: "thiết kế", createdAt: new Date(now).toISOString(), resolved: false },
    { id: "m2", lessonId: "technology-a1-01", skillId: "vocabulary", prompt: "deploy", answer: "triển khai", userAnswer: "xây dựng", createdAt: new Date(now - 1000).toISOString(), resolved: false }
  ];
  return state;
}

test("global API supports review, mistakes and vocabulary modes", () => {
  assert.deepEqual(review.modes, ["review", "mistakes", "vocabulary"]);
  assert.deepEqual(review.ratings.map((item) => item.id), ["again", "hard", "good", "easy"]);
  for (const name of ["mount", "render", "getDueQueue", "rateCard", "resolveMistake", "addManualCard", "exportJSON"]) {
    assert.equal(typeof review[name], "function", `${name} must be public`);
  }
  assert.equal(globalThis.HHLearningReview, review);
});

test("due queue prioritizes overdue and frequently forgotten cards", () => {
  const now = Date.UTC(2026, 6, 21, 8);
  const queue = review.getDueQueue(stateWithLearningData(now), { now });
  assert.deepEqual(queue.map((item) => item.id), ["due-hard", "due-new"]);
  assert.equal(queue[0].priority.status, "due");
  assert.equal(review.getWorkload(stateWithLearningData(now), { now }).next24h, 1);
});

test("rating delegates scheduling to HHLearningCore and updates shared store", () => {
  const now = Date.UTC(2026, 6, 21, 8);
  const seed = stateWithLearningData(now);
  const expected = core.scheduleReview(seed.reviews[0], "easy", now, 90);
  const store = memoryStore(seed);
  const scheduled = review.rateCard(store, "due-hard", "easy", { now });
  const saved = store.get();
  const card = saved.reviews.find((item) => item.id === "due-hard");
  assert.equal(scheduled.intervalDays, expected.intervalDays);
  assert.equal(card.lastRating, "easy");
  assert.equal(card.dueAt, expected.dueAt);
  assert.equal(saved.daily.reviews, 1);
  assert.equal(saved.sessions[0].type, "review");
});

test("retention, manual cards and mistake resolution all mutate the shared learning store", () => {
  const now = Date.UTC(2026, 6, 21, 8);
  const store = memoryStore(stateWithLearningData(now));
  review.setRetentionGoal(store, 95);
  const id = review.addManualCard(store, { prompt: "latency", answer: "độ trễ", trackId: "technology", skillId: "vocabulary" }, now);
  review.resolveMistake(store, "m1", true);
  const copiedId = review.mistakeToReview(store, "m2", now);
  const state = store.get();
  assert.equal(state.profile.retentionGoal, 95);
  assert.ok(state.reviews.some((item) => item.id === id && item.prompt === "latency"));
  assert.ok(state.reviews.some((item) => item.id === copiedId && item.prompt === "deploy"));
  assert.equal(state.mistakes.find((item) => item.id === "m1").resolved, true);
});

test("mistake notebook reports repeated errors and track filters", () => {
  const state = stateWithLearningData();
  const all = review.getMistakeStats(state);
  const technology = review.getMistakeStats(state, { trackId: "technology" });
  const finance = review.getMistakeStats(state, { trackId: "finance" });
  assert.equal(all.frequent[0].prompt, "deploy");
  assert.equal(all.frequent[0].count, 2);
  assert.equal(technology.unresolved, 2);
  assert.equal(finance.unresolved, 0);
});

test("render exposes accessible review controls, retention choices and local FSRS disclaimer", () => {
  const html = review.render(stateWithLearningData(), { mode: "review", revealedId: "due-hard" });
  assert.match(html, /data-learning-review/);
  assert.match(html, /aria-label="Đánh giá mức ghi nhớ"/);
  assert.match(html, /data-lr-rate="again"/);
  assert.match(html, /data-lr-retention="95"/);
  assert.match(html, /class="lr-review-history"/);
  assert.match(html, /Lịch sử ôn/);
  assert.match(html, /lấy cảm hứng từ FSRS/);
  assert.match(html, /không tuyên bố đây là FSRS chuẩn/i);
});

test("render escapes untrusted learning content in text and attributes", () => {
  const state = stateWithLearningData();
  state.reviews[0].prompt = '<img src=x onerror="globalThis.pwned=1">';
  state.reviews[0].answer = "</textarea><script>alert(1)</script>";
  state.mistakes[0].userAnswer = '<svg onload="alert(2)">';
  const reviewHTML = review.render(state, { mode: "review", revealedId: "due-hard" });
  const mistakeHTML = review.render(state, { mode: "mistakes" });
  assert.doesNotMatch(reviewHTML, /<img src=x/);
  assert.doesNotMatch(reviewHTML, /<script>alert/);
  assert.doesNotMatch(mistakeHTML, /<svg onload/);
  assert.match(reviewHTML, /&lt;img/);
  assert.match(mistakeHTML, /&lt;svg/);
});

test("mount renders into a host and returns a controllable lifecycle", () => {
  const listeners = new Map();
  const classes = new Set();
  const host = {
    innerHTML: "",
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type) => listeners.delete(type),
    classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) }
  };
  const controller = review.mount(host, { store: memoryStore(stateWithLearningData()), now: () => Date.UTC(2026, 6, 21, 8) });
  assert.match(host.innerHTML, /Ôn đúng lúc/);
  assert.equal(listeners.has("keydown"), true);
  controller.setMode("vocabulary");
  assert.match(host.innerHTML, /Kho từ vựng/);
  controller.unmount();
  assert.equal(listeners.size, 0);
  assert.equal(classes.has("learning-review-host"), false);
});

test("keyboard shortcuts rate a revealed card through the mounted UI", () => {
  const now = Date.UTC(2026, 6, 21, 8);
  const store = memoryStore(stateWithLearningData(now));
  const listeners = new Map();
  const revealButton = { focusCalled: false, focus() { this.focusCalled = true; } };
  const card = { dataset: { reviewCard: "due-hard" } };
  const host = {
    innerHTML: "",
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type) => listeners.delete(type),
    querySelector: (selector) => selector === "[data-review-card]" ? card : selector.includes("reveal") ? revealButton : null,
    classList: { add() {}, remove() {} }
  };
  const controller = review.mount(host, { store, now: () => now });
  listeners.get("click")({ target: { closest: () => ({ dataset: { lrAction: "reveal" } }) } });
  let prevented = false;
  listeners.get("keydown")({ target: { tagName: "BUTTON" }, key: "4", code: "Digit4", preventDefault: () => { prevented = true; } });
  assert.equal(revealButton.focusCalled, true);
  assert.equal(prevented, true);
  assert.equal(store.get().reviews.find((item) => item.id === "due-hard").lastRating, "easy");
  controller.unmount();
});

test("export is portable JSON and documents the non-audited local scheduler", () => {
  const payload = JSON.parse(review.exportJSON(stateWithLearningData(), { trackId: "technology", now: Date.UTC(2026, 6, 21, 8) }));
  assert.equal(payload.format, "hh-learning-review");
  assert.equal(payload.trackId, "technology");
  assert.equal(payload.reviews.every((item) => item.trackId === "technology"), true);
  assert.match(payload.notice, /chưa được tuyên bố là triển khai FSRS chuẩn/i);
});
