const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "learning-home.js"), "utf8");
const css = fs.readFileSync(path.join(root, "learning-home.css"), "utf8");
const core = require("../learning-platform-core.js");
const api = require("../learning-home.js");

function memoryStore(seed) {
  let saved = seed ? JSON.stringify(seed) : null;
  return core.createStore({
    getItem() { return saved; },
    setItem(_key, value) { saved = String(value); }
  });
}

function makeHost() {
  const listeners = new Map();
  return {
    innerHTML: "",
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type, handler) { if (listeners.get(type) === handler) listeners.delete(type); },
    contains() { return true; },
    click(action, dataset = {}) {
      const button = { dataset: { hlhAction: action, ...dataset } };
      listeners.get("click")?.({ target: { closest: () => button } });
    },
    listenerCount() { return listeners.size; }
  };
}

test("exposes the requested UMD lifecycle API", () => {
  assert.deepEqual(Object.keys(api).sort(), ["mount", "supports", "unmount"]);
  assert.equal(global.HHLearningHome, api);
  assert.equal(api.supports("home"), true);
  assert.equal(api.supports("DASHBOARD"), true);
  assert.equal(api.supports("lesson-player"), false);
});

test("renders only the focused Learning Home information with honest empty states", () => {
  const store = memoryStore(core.defaultState());
  const host = makeHost();
  api.mount(host, { store, view: "home" });
  for (const token of [
    "Tiếp tục bài đang học", "Ôn tập hôm nay", "Kiểm tra nhanh", "Mục tiêu hôm nay",
    "Tiến độ tuần", "ngày liên tiếp", "Kỹ năng cần chú ý", "Lịch học & deadline",
    "Chưa có thẻ đến hạn", "Chưa có dữ liệu đánh giá", "role=\"progressbar\""
  ]) assert.ok(host.innerHTML.includes(token), `missing Learning Home token: ${token}`);
  assert.doesNotMatch(host.innerHTML, /Đang online|Server|API key|Giáo viên ảo/);
  api.unmount(host);
});

test("weekly heatmap is derived from stored sessions instead of invented metrics", () => {
  const now = new Date();
  now.setHours(10, 0, 0, 0);
  const state = core.defaultState(now.getTime());
  state.sessions = [
    { id: "s1", type: "lesson", minutes: 12, score: 80, createdAt: now.toISOString() },
    { id: "s2", type: "review", minutes: 8, score: 90, createdAt: now.toISOString() }
  ];
  const host = makeHost();
  api.mount(host, { store: memoryStore(state) });
  assert.match(host.innerHTML, /20\/105 phút/);
  assert.match(host.innerHTML, /title="[^"]+: 20 phút"/);
  api.unmount(host);
});

test("primary buttons navigate with concrete learning context", () => {
  const store = memoryStore(core.defaultState());
  const host = makeHost();
  const calls = [];
  api.mount(host, { store, onNavigate: (view, detail) => calls.push([view, detail]) });
  host.click("continue");
  host.click("review");
  host.click("quick-test");
  host.click("skill", { skillId: "speaking" });
  host.click("deadline", { deadlineId: "deadline-welcome" });
  assert.deepEqual(calls.map(([view]) => view), ["lesson-player", "smart-review", "quick-test", "skill-graph", "classroom"]);
  assert.equal(calls[0][1].lessonId, "communication-a0-01");
  assert.equal(calls[1][1].dueCount, 0);
  assert.equal(calls[3][1].skillId, "speaking");
});

test("goal controls update the supplied shared store and rerender", () => {
  const store = memoryStore(core.defaultState());
  const host = makeHost();
  api.mount(host, { store });
  host.click("goal-up");
  assert.equal(store.get().profile.dailyMinutes, 20);
  assert.match(host.innerHTML, /20 phút\/ngày/);
  for (let index = 0; index < 8; index += 1) host.click("goal-down");
  assert.equal(store.get().profile.dailyMinutes, 5, "daily goal must respect the core lower bound");
  api.unmount(host);
});

test("mount replaces previous listeners and unmount removes subscriptions", () => {
  const store = memoryStore(core.defaultState());
  const host = makeHost();
  api.mount(host, { store });
  api.mount(host, { store });
  assert.equal(host.listenerCount(), 1);
  assert.equal(api.unmount(host), true);
  assert.equal(host.listenerCount(), 0);
  assert.equal(host.innerHTML, "");
  assert.equal(api.unmount(host), false);
});

test("stylesheet is scoped, responsive at 375px and accessible", () => {
  for (const token of [
    ".hlh {", ".hlh-primary-grid", ".hlh-heatmap", ".hlh-goal-ring", ":focus-visible",
    "@media (max-width: 420px)", "@media (prefers-reduced-motion: reduce)", "min-width: 0"
  ]) assert.ok(css.includes(token), `missing CSS contract: ${token}`);
  assert.doesNotMatch(css, /font-size:\s*[^;]*vw/);
  assert.doesNotMatch(css, /letter-spacing:\s*-/);
  assert.doesNotMatch(source, /AIza[0-9A-Za-z_-]{20,}|sk-[0-9A-Za-z_-]{20,}|clientSecret\s*[:=]|password\s*[:=]/i);
});
