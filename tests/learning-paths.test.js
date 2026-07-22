const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "learning-paths.js"), "utf8");
const css = fs.readFileSync(path.join(root, "learning-paths.css"), "utf8");
const core = require("../learning-platform-core.js");

function memoryStorage(initial = null) {
  const values = new Map(initial ? [[core.storageKey, JSON.stringify(initial)]] : []);
  return {
    values,
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function createHost() {
  const listeners = new Map();
  const host = {
    innerHTML: "",
    addEventListener(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); },
    removeEventListener(type, handler) { listeners.get(type)?.delete(handler); },
    contains() { return true; },
    querySelector() { return null; },
    emit(type, target) { for (const handler of listeners.get(type) || []) handler({ target, preventDefault() {} }); },
    listenerCount(type) { return listeners.get(type)?.size || 0; }
  };
  return host;
}

function actionTarget(action, dataset = {}) {
  const button = { dataset: { action, ...dataset } };
  return { closest(selector) { return selector === "[data-action]" ? button : null; } };
}

function createRuntime(saved = null) {
  const storage = memoryStorage(saved);
  const events = [];
  class CustomEventMock { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } }
  const window = {
    HHLearningCore: core,
    localStorage: storage,
    location: { hash: "" },
    dispatchEvent(event) { events.push(event); },
    CustomEvent: CustomEventMock
  };
  const context = { window, globalThis: window, CustomEvent: CustomEventMock, FormData, Intl, Date, Math, JSON, Object, Set, Map, console, encodeURIComponent };
  vm.runInNewContext(source, context, { filename: "learning-paths.js" });
  return { api: window.HHLearningPaths, window, events, storage };
}

test("exports the four-view lifecycle contract", () => {
  const { api } = createRuntime();
  assert.deepEqual(Object.keys(api).sort(), ["mount", "supports", "unmount"]);
  for (const view of ["profile", "paths", "mastery", "passport"]) assert.equal(api.supports(view), true);
  for (const view of ["lesson-player", "home", "", null]) assert.equal(api.supports(view), false);
});

test("profile onboarding exposes all personalization inputs and the full 16-track catalog", () => {
  const { api } = createRuntime();
  const host = createHost();
  api.mount(host, { view: "profile" });
  for (const token of [
    "Mục tiêu chính", "Trình độ hiện tại", "Thời gian mỗi ngày", "Nghề nghiệp hoặc chuyên ngành",
    "Kỹ năng muốn ưu tiên", "Mục tiêu ghi nhớ", "Giao tiếp", "Thi cử", "Công việc", "Theo chuyên ngành"
  ]) assert.ok(host.innerHTML.includes(token), `missing onboarding token: ${token}`);
  assert.equal((host.innerHTML.match(/class="hlp-track-choice"/g) || []).length, 16);
  assert.equal((host.innerHTML.match(/name="focusSkills"/g) || []).length, core.skills.length);
  assert.match(host.innerHTML, /value="85"/);
  assert.match(host.innerHTML, /value="90"/);
  assert.match(host.innerHTML, /value="95"/);
  api.unmount();
});

test("profile submission writes to the shared HHLearningCore store and builds an active career path", () => {
  const { api } = createRuntime();
  const host = createHost();
  const store = core.createStore(memoryStorage());
  const fields = new Map([
    ["goal", "career"], ["level", "B1"], ["dailyMinutes", "30"], ["career", "technology"], ["retentionGoal", "95"]
  ]);
  const form = {
    closest(selector) { return selector === "[data-learning-profile-form]" ? form : null; },
    __entries: fields,
    __all: { focusSkills: ["vocabulary", "reading", "project"] }
  };
  class FormDataMock {
    constructor(node) { this.node = node; }
    get(name) { return this.node.__entries.get(name) ?? null; }
    getAll(name) { return this.node.__all[name] || []; }
  }
  const originalFormData = global.FormData;
  global.FormData = FormDataMock;
  try {
    const context = { window: { HHLearningCore: core, localStorage: memoryStorage(), location: {}, dispatchEvent() {}, CustomEvent: class {} }, CustomEvent: class {}, FormData: FormDataMock, Intl, Date, Math, JSON, Object, Set, Map, console, encodeURIComponent };
    vm.runInNewContext(source, context, { filename: "learning-paths.js" });
    context.window.HHLearningPaths.mount(host, { view: "profile", store });
    host.emit("submit", form);
    const state = store.get();
    assert.equal(state.profile.configured, true);
    assert.equal(state.profile.goal, "career");
    assert.equal(state.profile.level, "B1");
    assert.equal(state.profile.dailyMinutes, 30);
    assert.equal(state.profile.career, "technology");
    assert.equal(state.profile.retentionGoal, 95);
    assert.deepEqual(state.profile.focusSkills, ["vocabulary", "reading", "project"]);
    assert.match(state.activeLessonId, /^technology-/);
    assert.match(host.innerHTML, /BẢN ĐỒ A0–C2/);
    context.window.HHLearningPaths.unmount();
  } finally {
    global.FormData = originalFormData;
  }
});

test("path map covers A0 through C2, all industries, progress and adaptive recommendation", () => {
  const state = core.defaultState();
  state.profile.configured = true;
  state.profile.level = "A2";
  state.profile.career = "design";
  state.profile.focusSkills = ["speaking", "project"];
  state.mastery.speaking = { ...state.mastery.speaking, attempts: 8, correct: 8, accuracy: 100, score: 92, state: "mastered" };
  state.progress["design-a1-01"] = { status: "completed", score: 90, attempts: 1, seconds: 480, completedAt: new Date().toISOString() };
  const store = core.createStore(memoryStorage(state));
  const { api } = createRuntime();
  const host = createHost();
  api.mount(host, { view: "paths", store });
  for (const level of core.levels) assert.match(host.innerHTML, new RegExp(`>${level}<`));
  assert.equal((host.innerHTML.match(/<option value=/g) || []).length, core.tracks.length);
  assert.match(host.innerHTML, /Đề xuất thích ứng/);
  assert.match(host.innerHTML, /Độ khó [1-7]\/7/);
  assert.match(host.innerHTML, /1\/7 chặng/);
  assert.match(host.innerHTML, /data-action="open-lesson"/);
  api.unmount();
});

test("lesson buttons navigate directly to lesson-player and persist active lesson", () => {
  const { api, events, window } = createRuntime();
  const host = createHost();
  const navigations = [];
  const store = core.createStore(memoryStorage());
  api.mount(host, { view: "paths", store, navigate: (detail) => navigations.push(detail) });
  host.emit("click", actionTarget("open-lesson", { lessonId: "communication-a0-01" }));
  assert.equal(store.get().activeLessonId, "communication-a0-01");
  assert.equal(navigations[0].route, "/learn/lesson-player");
  assert.equal(navigations[0].view, "lesson-player");
  assert.equal(navigations[0].lessonId, "communication-a0-01");
  assert.equal(events.at(-1).type, "hh:learning:navigate");
  assert.equal(window.location.hash, "", "custom navigation must avoid duplicate hash navigation");
  api.unmount();
});

test("mastery graph renders four states, adaptive difficulty and evidence", () => {
  const state = core.defaultState();
  state.mastery.vocabulary = { ...state.mastery.vocabulary, state: "new", score: 20 };
  state.mastery.grammar = { ...state.mastery.grammar, state: "familiar", score: 55, attempts: 4, correct: 3, accuracy: 75 };
  state.mastery.speaking = { ...state.mastery.speaking, state: "mastered", score: 90, attempts: 8, correct: 7, accuracy: 88, updatedAt: new Date().toISOString() };
  state.mastery.listening = { ...state.mastery.listening, state: "review", score: 35, attempts: 5, correct: 2, accuracy: 40 };
  state.mistakes.push({ id: "m1", lessonId: "communication-a0-01", skillId: "speaking", prompt: "Say hello", answer: "Hello", userAnswer: "Hallo", createdAt: new Date().toISOString(), resolved: false });
  const store = core.createStore(memoryStorage(state));
  const { api } = createRuntime();
  const host = createHost();
  api.mount(host, { view: "mastery", skillId: "speaking", store });
  for (const label of ["Đang làm quen", "Đã hiểu", "Thành thạo", "Cần ôn lại"]) assert.ok(host.innerHTML.includes(label));
  for (const token of ["Độ chính xác", "Lượt luyện", "Bài hoàn thành", "Lỗi cần sửa", "Độ sẵn sàng", "Kỹ năng hỗ trợ", "Độ khó đề xuất", "Learning Passport"]) assert.ok(host.innerHTML.includes(token));
  assert.equal((host.innerHTML.match(/class="hlp-mastery-row/g) || []).length, core.skills.length);
  assert.match(host.innerHTML, /88%/);
  api.unmount();
});

test("passport sync records mastered skills once with measurable evidence", () => {
  const state = core.defaultState();
  state.profile.name = "Lan";
  state.mastery.speaking = { ...state.mastery.speaking, state: "mastered", score: 91, accuracy: 86, attempts: 7, correct: 6, updatedAt: new Date().toISOString() };
  const store = core.createStore(memoryStorage(state));
  const { api } = createRuntime();
  const host = createHost();
  api.mount(host, { view: "passport", store });
  host.emit("click", actionTarget("sync-passport"));
  host.emit("click", actionTarget("sync-passport"));
  const passport = store.get().passport;
  assert.equal(passport.length, 1);
  assert.equal(passport[0].id, "mastery-speaking");
  assert.equal(passport[0].skillId, "speaking");
  assert.match(passport[0].evidence, /86%.*7 lượt luyện/);
  assert.match(host.innerHTML, /Lan/);
  assert.match(host.innerHTML, /Thành thạo/);
  api.unmount();
});

test("stored learner content is escaped and lifecycle removes listeners", () => {
  const state = core.defaultState();
  state.profile.name = '<img src=x onerror="boom">';
  state.passport.push({ id: "unsafe", skillId: "speaking", title: "<script>boom()</script>", evidence: "<svg onload=boom>", earnedAt: new Date().toISOString() });
  const store = core.createStore(memoryStorage(state));
  const { api } = createRuntime();
  const host = createHost();
  api.mount(host, { view: "passport", store });
  assert.doesNotMatch(host.innerHTML, /<img src=x|<script>|<svg onload/);
  assert.match(host.innerHTML, /&lt;img src=x/);
  assert.match(host.innerHTML, /&lt;script&gt;boom\(\)&lt;\/script&gt;/);
  assert.equal(host.listenerCount("click"), 1);
  assert.equal(host.listenerCount("submit"), 1);
  api.unmount();
  assert.equal(host.innerHTML, "");
  assert.equal(host.listenerCount("click"), 0);
  assert.equal(host.listenerCount("submit"), 0);
});

test("styles prioritize readable learning, mobile, focus and reduced motion", () => {
  for (const token of [
    ":focus-visible", "@media (max-width: 680px)", "@media (max-width: 900px)",
    "@media (prefers-reduced-motion: reduce)", "min-width: 0", "overflow-x: auto",
    ".hlp-level-map", ".hlp-mastery-list", ".hlp-passport-timeline"
  ]) assert.ok(css.includes(token), `missing style contract: ${token}`);
  assert.doesNotMatch(css, /letter-spacing:\s*-/);
  assert.match(css, /font-family: Inter, "Segoe UI", Arial, sans-serif/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /aria-current="page"/);
  assert.match(source, /aria-expanded=/);
});
