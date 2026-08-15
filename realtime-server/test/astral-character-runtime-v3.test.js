const test = require("node:test");
const assert = require("node:assert/strict");
const { _test } = require("../src/astral-realms");

test("authoritative combat rejects wrong marker and duplicate Runtime V3 sequence", () => {
  const shard = _test.createShard("V3TEST", 4);
  const player = {
    id: "player-one", socketId: "socket-one", characterId: "lyra", x: 0, z: 0, health: 100, maxHealth: 100,
    stamina: 100, ultimate: 100, hunterPoints: 0, seq: 7, weaponClass: "sword", pk: { enabled: false, safeZone: true }, action: "idle"
  };
  shard.players.set(player.socketId, player);
  const target = shard.enemies.get("aurora-wisp-1");
  target.x = 1;
  target.z = 0;
  const initialHealth = target.health;
  const payload = { action: "attack", weaponClass: "sword", targetId: target.id, actionSequenceId: "runtime-v3-seq-1", combatMarker: "windup_start" };
  _test.applyAttack(shard, player, payload, 10000);
  assert.equal(target.health, initialHealth, "windup marker must never activate server damage");
  _test.applyAttack(shard, player, { ...payload, combatMarker: "active_start" }, 10000);
  assert.ok(target.health < initialHealth, "active_start marker can request server-authoritative damage");
  const healthAfterAcceptedHit = target.health;
  _test.applyAttack(shard, player, { ...payload, combatMarker: "active_start" }, 20000);
  assert.equal(target.health, healthAfterAcceptedHit, "duplicate action sequence must be idempotent even after cooldown");
});
