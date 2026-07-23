const test = require("node:test");
const assert = require("node:assert/strict");
const HHGameRuntime = require("../game-runtime.js");

function createStorage() {
  const values = new Map();
  return {
    values,
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

test("HHGameRuntime exposes the dependency-free public contract", () => {
  assert.equal(typeof HHGameRuntime.version, "string");
  assert.equal(typeof HHGameRuntime.create, "function");
  assert.equal(typeof HHGameRuntime.inspectAll, "function");
  assert.equal(typeof HHGameRuntime.destroyAll, "function");

  const session = HHGameRuntime.create({
    id: "contract-public",
    storage: createStorage(),
    autosave: false
  });
  [
    "start",
    "pause",
    "resume",
    "restart",
    "destroy",
    "setDifficulty",
    "checkpoint",
    "save",
    "restore",
    "listSlots",
    "setAudio",
    "reward",
    "unlockAchievement",
    "setStatus",
    "update",
    "complete",
    "register",
    "unmount",
    "inspect"
  ].forEach((method) => assert.equal(typeof session[method], "function", `${method} must be callable`));
  session.destroy();
});

test("compatibility helpers support existing Astra and Arcade integrations", async () => {
  const storage = createStorage();
  const session = HHGameRuntime.create({ id: "contract-compat", storage, autosave: false });
  await session.start({ gameId: "contract-compat" });
  const saved = session.save({ score: 12 }, { slot: "slot-2", label: "Astra checkpoint" });
  assert.equal(saved.slot, "slot-2");
  assert.equal(session.update({ score: 18 }).score, 18);
  const restored = session.restore({ score: 24 }, { slot: "slot-3" });
  assert.equal(restored.state.score, 24);
  assert.equal(session.complete({ outcome: "win", score: 24 }), true);
  assert.equal(session.inspect().lifecycle, "result");
  session.unmount();
});

test("lifecycle emits state changes and supports pause, resume, result and restart", async () => {
  const session = HHGameRuntime.create({
    id: "contract-lifecycle",
    storage: createStorage(),
    autosave: false
  });
  const states = [];
  session.on("statechange", (event) => states.push(event.state));

  assert.equal(await session.start(), true);
  assert.equal(session.inspect().lifecycle, "running");
  assert.equal(session.pause(), true);
  assert.equal(session.inspect().lifecycle, "paused");
  assert.equal(session.resume(), true);
  assert.equal(session.setStatus("gameover"), true);
  assert.equal(session.setStatus("result"), true);
  assert.equal(await session.restart(), true);
  assert.equal(session.inspect().lifecycle, "running");
  assert.deepEqual(states.slice(0, 5), ["loading", "ready", "running", "paused", "running"]);
  assert.ok(states.includes("gameover"));
  assert.ok(states.includes("result"));
  session.destroy();
});

test("three versioned save slots sanitize bounded user data and restore", async () => {
  const storage = createStorage();
  const session = HHGameRuntime.create({
    id: "contract-save",
    storage,
    autosave: false
  });
  await session.start();

  const circular = { score: 42, longText: "x".repeat(3000) };
  circular.self = circular;
  Object.defineProperty(circular, "constructor", { enumerable: true, value: "unsafe" });

  const first = session.checkpoint(circular, "slot-1");
  const second = session.checkpoint({ score: 48 }, "slot-1");
  const third = session.checkpoint({ score: 99 }, "slot-2");
  assert.equal(first.version, 1);
  assert.equal(second.version, 2);
  assert.equal(third.version, 1);
  assert.match([...storage.values.keys()].join("\n"), /hh\.game\.runtime\.contract-save\.slot-1/);
  assert.match([...storage.values.keys()].join("\n"), /hh\.game\.runtime\.contract-save\.slot-2/);

  const slots = session.listSlots();
  assert.deepEqual(slots.map((slot) => slot.hasData), [true, true, false]);
  assert.deepEqual(slots.map((slot) => slot.version), [2, 1, 0]);

  const restored = session.restore("slot-1");
  assert.equal(restored.state.score, 48);
  assert.equal(restored.state.longText, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(restored.state, "constructor"), false);
  assert.equal(session.inspect().stats.restores, 1);
  session.destroy();
});

test("difficulty, audio, rewards, achievements, offline state and cleanup are bounded", async () => {
  const session = HHGameRuntime.create({
    id: "contract-features",
    storage: createStorage(),
    autosave: false
  });
  await session.start();

  assert.equal(session.setDifficulty("hard"), "hard");
  assert.throws(() => session.setDifficulty("nightmare"), /easy, normal or hard/);
  const audio = session.setAudio({ sfxVolume: 2, musicVolume: -1, muted: true });
  assert.deepEqual(
    { muted: audio.muted, sfxVolume: audio.sfxVolume, musicVolume: audio.musicVolume },
    { muted: true, sfxVolume: 1, musicVolume: 0 }
  );

  const reward = session.reward({ coins: 25, items: ["fuel", "fuel"] });
  assert.deepEqual(reward, { coins: 25, items: ["fuel", "fuel"] });
  assert.equal(session.unlockAchievement("first-win").id, "first-win");
  assert.equal(session.unlockAchievement("first-win"), false);

  assert.equal(session.setStatus("offline"), true);
  assert.equal(session.inspect().online, false);
  assert.equal(session.setStatus("running"), true);
  assert.equal(session.destroy(), true);
  assert.equal(session.inspect().destroyed, true);
  assert.equal(HHGameRuntime.inspectAll().some((item) => item.sessionId === session.sessionId), false);
});

test("destroyAll removes every active runtime session", async () => {
  const one = HHGameRuntime.create({ id: "contract-cleanup-one", autosave: false });
  const two = HHGameRuntime.create({ id: "contract-cleanup-two", autosave: false });
  await Promise.all([one.start(), two.start()]);
  assert.ok(HHGameRuntime.inspectAll().length >= 2);
  assert.equal(HHGameRuntime.destroyAll(), true);
  assert.equal(HHGameRuntime.inspectAll().length, 0);
});
