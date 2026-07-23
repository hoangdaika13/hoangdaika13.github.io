const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function loadTestHooks() {
  const source = read("game-center.js");
  const context = {
    console,
    Date,
    Math,
    JSON,
    setTimeout,
    clearTimeout,
    window: {}
  };
  context.window.window = context.window;
  vm.runInNewContext(source, context, { filename: "game-center.js" });
  return context.window.HHGameCenter.__test;
}

test("Game Center never upgrades an unconfirmed provider into Cloud or Realtime", () => {
  const hooks = loadTestHooks();
  assert.equal(hooks.isConfirmed({ confirmed: true, connected: true, durable: true }), true);
  assert.equal(hooks.isConfirmed({ confirmed: true, connected: true, durable: false }), false);
  assert.equal(hooks.isConfirmed({ confirmed: true, connected: false, durable: true }), false);
  assert.equal(hooks.isConfirmed({ confirmed: false, connected: true, durable: true }), false);
});

test("Game capability badges keep local, cloud and realtime states honest", () => {
  const hooks = loadTestHooks();
  const game = { id: "astra-hh", release: "ready", realtimeEligible: true };
  const local = hooks.gameCapabilityBadges(game, {
    cloud: { status: "error", confirmed: false, connected: false, durable: false },
    realtime: { status: "disconnected", confirmed: false, connected: false, durable: false }
  });
  assert.deepEqual(Array.from(local, (item) => item.kind), ["release", "local", "cloud", "realtime"]);
  assert.equal(local.find((item) => item.kind === "cloud").active, false);
  assert.equal(local.find((item) => item.kind === "realtime").active, false);

  const connected = hooks.gameCapabilityBadges(game, {
    cloud: { status: "connected", confirmed: true, connected: true, durable: true },
    realtime: { status: "connected", confirmed: true, connected: true, durable: true }
  });
  assert.equal(connected.find((item) => item.kind === "cloud").active, true);
  assert.equal(connected.find((item) => item.kind === "realtime").active, true);
});

test("Save slots are always bounded to three safe local-first slots", () => {
  const hooks = loadTestHooks();
  const slots = hooks.normalizeSaveSlots([
    { id: "slot-2", title: "A", snapshot: { player: { xp: 10 } }, storedAt: "2026-07-23T00:00:00.000Z" },
    { id: "invalid", snapshot: { secret: "drop-me" } },
    { id: "slot-2", title: "duplicate", snapshot: { player: { xp: 20 } } }
  ]);
  assert.equal(slots.length, 3);
  assert.deepEqual(Array.from(slots, (slot) => slot.id), ["slot-1", "slot-2", "slot-3"]);
  assert.equal(slots[1].title, "A");
  assert.equal(slots[0].snapshot, null);
});

test("Playability surface includes real actions and truthful backend states", () => {
  const source = read("game-center.js");
  [
    "continue-last",
    "save-slot",
    "load-slot",
    "delete-slot",
    "refresh-social",
    "report-player",
    "block-player",
    "retry-backend",
    "HHGameRuntime",
    "aria-busy"
  ].forEach((contract) => assert.ok(source.includes(contract), `Missing ${contract}`));
});

test("Playability UI supports responsive focus, reduced motion and status surfaces", () => {
  const styles = read("game-center.css");
  [
    ".gc-capability",
    ".gc-save-slot",
    ".gc-backend-status",
    ".gc-social-actions",
    ":focus-visible",
    "@media (max-width: 410px)",
    "@media (prefers-reduced-motion: reduce)"
  ].forEach((contract) => assert.ok(styles.includes(contract), `Missing ${contract}`));
});
