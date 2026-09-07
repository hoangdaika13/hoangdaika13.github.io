const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const focus = require(path.join(root, "focus-study-room.js"));

test("focus room state is versioned, bounded and isolated by account", () => {
  const tasks = Array.from({ length: 190 }, (_, index) => ({ id: `task-${index}`, title: `Bài ${index}`, estimate: 1 }));
  const history = Array.from({ length: 650 }, (_, index) => ({ id: `session-${index}`, mode: "focus", durationSeconds: 1500, completedAt: new Date(2026, 8, 1, 12, index % 60).toISOString() }));
  const state = focus.normalizeState({ tasks, history, note: "a".repeat(25000) });
  assert.equal(state.version, focus.VERSION);
  assert.equal(state.tasks.length, 160);
  assert.equal(state.history.length, 600);
  assert.equal(state.note.length, 20000);
  assert.notEqual(focus.storageKey("account-a"), focus.storageKey("account-b"));
  assert.match(focus.storageKey("account-a"), /^hh\.focus\.study-room\.v1:account-a$/);
});

test("running timer uses an absolute end timestamp", () => {
  const now = new Date(2026, 8, 7, 10, 0, 0).getTime();
  const timer = { status: "running", durationSeconds: 1500, remainingSeconds: 1500, endsAt: now + 702000 };
  assert.equal(focus.timerSnapshot(timer, now).remainingSeconds, 702);
  assert.equal(focus.timerSnapshot(timer, now + 701500).remainingSeconds, 1);
  assert.equal(focus.timerSnapshot(timer, now + 702000).expired, true);
});

test("only an expired timer creates a completed session and advances the cycle", () => {
  const now = new Date(2026, 8, 7, 10, 0, 0).getTime();
  const state = focus.defaultState(now - 1500000);
  state.timer = { ...state.timer, status: "running", endsAt: now - 1, startedAt: now - 1500000 };
  const result = focus.finishExpiredSession(state, now);
  assert.ok(result.completed);
  assert.equal(result.completed.mode, "focus");
  assert.equal(result.state.history.length, 1);
  assert.equal(result.state.timer.completedFocusCycles, 1);
  assert.equal(result.state.timer.mode, "short-break");
  assert.equal(result.state.timer.status, "idle");
  const secondPass = focus.finishExpiredSession(result.state, now + 5000);
  assert.equal(secondPass.completed, null);
  assert.equal(secondPass.state.history.length, 1);
});

test("long break and opt-in auto start follow user settings", () => {
  const now = new Date(2026, 8, 7, 10, 0, 0).getTime();
  const state = focus.defaultState(now - 1500000);
  state.settings.longBreakEvery = 4;
  state.settings.autoStartBreaks = true;
  state.timer = { ...state.timer, status: "running", completedFocusCycles: 3, endsAt: now - 1, startedAt: now - 1500000 };
  const result = focus.finishExpiredSession(state, now);
  assert.equal(result.state.timer.mode, "long-break");
  assert.equal(result.state.timer.status, "running");
  assert.equal(result.state.timer.endsAt, now + state.settings.longBreakMinutes * 60000);
});

test("statistics come only from locally completed focus/custom sessions", () => {
  const now = new Date(2026, 8, 7, 16, 0, 0).getTime();
  const history = [
    { id: "a", mode: "focus", durationSeconds: 1500, completedAt: new Date(2026, 8, 7, 10).toISOString() },
    { id: "b", mode: "custom", durationSeconds: 2700, completedAt: new Date(2026, 8, 7, 14).toISOString() },
    { id: "c", mode: "short-break", durationSeconds: 300, completedAt: new Date(2026, 8, 7, 14, 10).toISOString() },
    { id: "d", mode: "focus", durationSeconds: 1200, completedAt: new Date(2026, 8, 5, 9).toISOString() }
  ];
  const stats = focus.computeStats(history, now);
  assert.equal(stats.todaySessions, 2);
  assert.equal(stats.todaySeconds, 4200);
  assert.equal(stats.weekSessions, 3);
  assert.equal(stats.weekSeconds, 5400);
  assert.equal(stats.totalSessions, 3);
});

test("procedural audio has no side effect before a user-controlled set call", async () => {
  let constructed = 0;
  class FakeAudioContext {
    constructor() { constructed += 1; this.sampleRate = 20; this.currentTime = 0; this.state = "running"; this.destination = {}; }
    createBuffer() { const values = new Float32Array(40); return { getChannelData: () => values }; }
    createBufferSource() { return { connect() { return this; }, start() {}, stop() {}, loop: false }; }
    createBiquadFilter() { return { connect() { return this; }, frequency: { value: 0 }, Q: { value: 0 }, type: "" }; }
    createGain() { return { connect() { return this; }, gain: { value: 0, setTargetAtTime() {} } }; }
    resume() { this.state = "running"; return Promise.resolve(); }
    suspend() { this.state = "suspended"; return Promise.resolve(); }
    close() { this.state = "closed"; return Promise.resolve(); }
  }
  const mixer = focus.createAmbientMixer({ AudioContext: FakeAudioContext });
  assert.equal(constructed, 0);
  assert.equal(mixer.state, "off");
  await mixer.set("rain", 0.4);
  assert.equal(constructed, 1);
  mixer.close();
});

test("router, lazy loader and responsive workspace are integrated", () => {
  const router = read("script.js");
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const index = read("index.html");
  const gateway = read("hh-core-gateway.js");
  const css = read("focus-room.css");
  const source = read("focus-room.js");
  assert.match(router, /id: "focus-room"[\s\S]*?route: "\/focus-room"/);
  assert.match(router, /groupIds: \["learn", "focus-room", "english"/);
  assert.match(router, /HHFocusRoom\?\.mount/);
  assert.match(loader, /"focus-study-room": \{[\s\S]*?focus-room\.css\?v=6[\s\S]*?focus-room\.js\?v=6/);
  assert.match(loader, /value === "\/focus-room"/);
  assert.match(worker, /focus-room\.css\?v=6/);
  assert.match(worker, /focus-room\.js\?v=6/);
  assert.match(gateway, /"\/focus-room"/);
  assert.match(index, /performance-loader\.js\?v=657/);
  assert.match(index, /script\.js\?v=275/);
  assert.match(worker, /performance-loader\.js\?v=657/);
  assert.match(worker, /script\.js\?v=275/);
  assert.match(css, /@media \(max-width: 430px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(source, /navigator\.mediaDevices|getUserMedia/);
  assert.match(source, /action === "enable-notifications"[\s\S]*Notification\.requestPermission/);
  assert.match(source, /global\.document\?\.hidden|document\.hidden/);
  assert.match(source, /hh\.focus\.study-room\.v1/);
  assert.match(source, /hh\.focus-room\.v2/);
});
