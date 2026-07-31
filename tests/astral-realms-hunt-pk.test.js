const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file));
const source = read("astral-realms.js").toString("utf8");
const serverSource = read("realtime-server/src/astral-realms.js").toString("utf8");

function glbJson(relative) {
  const bytes = read(relative);
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "glTF", `${relative} is not a GLB`);
  const length = bytes.readUInt32LE(12);
  return JSON.parse(bytes.subarray(20, 20 + length).toString("utf8").replace(/\0+$/g, "").trimEnd());
}

test("Astral Armory ships exactly 72 checksum-locked CC0 weapons with three socketed LODs", () => {
  const manifest = JSON.parse(read("assets/astral-realms/weapons/manifest.json"));
  assert.equal(manifest.weapons.length, 72);
  const requiredSockets = ["Grip_R", "Grip_L", "Muzzle", "BladeRoot", "BladeTip"];
  for (const weapon of manifest.weapons) {
    assert.equal(weapon.license, "CC0-1.0");
    assert.equal(weapon.runtimePolicy, "lazy-equipped-only");
    for (const tier of ["lod0", "lod1", "lod2"]) {
      const relative = path.join("assets/astral-realms/weapons", weapon.lods[tier]);
      const bytes = read(relative);
      const digest = crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase();
      assert.equal(digest, weapon.sha256[tier], `${weapon.id} ${tier} checksum drifted`);
      const names = new Set((glbJson(relative).nodes || []).map((node) => node.name));
      requiredSockets.forEach((name) => assert.ok(names.has(name), `${weapon.id} ${tier} missing ${name}`));
    }
  }
  for (const weaponClass of ["greatsword", "dualBlade", "spear", "hammer", "shield", "scythe", "bow", "staff", "pistol", "rifle", "shotgun", "sniper", "heavy"]) {
    assert.match(source, new RegExp(`${weaponClass}: \\{`));
  }
  assert.match(source, /hydratePlayerWeapon/);
  assert.match(source, /entry\.runtimePolicy !== "lazy-equipped-only"/);
});

test("all 50 animated CC0 monsters are real files and route through lazy hunt animation states", () => {
  const manifest = JSON.parse(read("assets/astral-realms/monsters/manifest.json"));
  assert.equal(manifest.monsters.length, 50);
  assert.ok(manifest.monsters.reduce((sum, monster) => sum + monster.animationCount, 0) >= 506);
  assert.deepEqual([...new Set(manifest.monsters.map((monster) => monster.category))].sort(), ["big", "blob", "flying"]);
  for (const monster of manifest.monsters) {
    const relative = path.join("assets/astral-realms/monsters", monster.url);
    const bytes = read(relative);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex").toUpperCase(), monster.sha256);
    assert.equal((glbJson(relative).animations || []).length, monster.animationCount);
  }
  for (const token of ["createMonsterHuntPopulation", "hydrateEnemyMonster", "monsterHydrating", "playMonsterAnimation(enemy, \"move\")", "playMonsterAnimation(enemy, \"attack\"", "playMonsterAnimation(target, data.health > 0 ? \"hit\" : \"death\""]) {
    assert.ok(source.includes(token), `missing monster runtime ${token}`);
  }
  assert.match(serverSource, /const HUNT_MONSTER_LIBRARY/);
  assert.match(serverSource, /\.\.\.createMonsterHuntEnemies\(\)/);
  const worker = read("sw.js").toString("utf8");
  assert.match(worker, /astral-realms\/monsters\/manifest\.json/);
  assert.doesNotMatch(worker, /astral-realms\/monsters\/models\/big-alien\.glb/);
});

test("monster hunting is the single chapter gate and persists score, rank, codex, streak and mastery", () => {
  const chapterBlock = source.slice(source.indexOf("  const HUNT_CHAPTERS"), source.indexOf("  const HUNTER_RANKS"));
  assert.equal((chapterBlock.match(/chapter:/g) || []).length, 8);
  for (const token of ["huntQuota", "eliteQuota", "bossQuota", "scoreTarget", "recordHuntKill", "hunterRankForScore", "killsByMonster", "bossTrophies", "weaponMastery", "huntProgressLabel", "isHuntChapterComplete"]) {
    assert.ok(source.includes(token), `missing hunt progression ${token}`);
  }
  assert.match(source, /const objectiveComplete = this\.isHuntChapterComplete\(huntChapter\)/);
  assert.match(source, /recordStoryEvent\(`hunt:\$\{huntChapter\.zoneId\}`\)/);
});

test("PK refuses non-consenting and safe-zone attacks, then uses only server weapon damage", () => {
  const { _test } = require("../realtime-server/src/astral-realms");
  const shard = _test.createShard("PKTEST", 4);
  const makePlayer = (socketId, x, z) => ({
    id: socketId,
    socketId,
    name: socketId,
    characterId: "lyra",
    x,
    z,
    rotation: 0,
    health: 100,
    maxHealth: 100,
    stamina: 100,
    ultimate: 100,
    hunterPoints: 1000,
    element: "plasma",
    appearance: {},
    action: "idle",
    seq: 1,
    pk: { enabled: false, safeZone: false, kills: 0, assists: 0, deaths: 0, rating: 1000, protectionUntil: 0, duelWith: "" }
  });
  const attacker = makePlayer("attacker", 40, 0);
  const target = makePlayer("target", 41, 0);
  shard.players.set(attacker.socketId, attacker);
  shard.players.set(target.socketId, target);

  _test.applyAttack(shard, attacker, { action: "attack", targetId: target.socketId, weaponClass: "sniper", power: 999999 }, 10000);
  assert.equal(target.health, 100, "PK without mutual consent must do nothing");

  attacker.pk.enabled = true;
  target.pk.enabled = true;
  attacker.seq += 1;
  _test.applyAttack(shard, attacker, { action: "attack", targetId: target.socketId, weaponClass: "sniper", power: 999999 }, 12000);
  assert.equal(target.health, 67, "sniper damage must come from the server profile, not client power");

  attacker.x = 0;
  attacker.z = 0;
  target.x = 1;
  target.z = 0;
  attacker.seq += 1;
  _test.applyAttack(shard, attacker, { action: "attack", targetId: target.socketId, weaponClass: "sniper", power: 999999 }, 14000);
  assert.equal(target.health, 67, "Safe Zone must block PK damage");
  assert.equal(_test.isPkSafePosition(0, 0), true);
  assert.equal(_test.isPkSafePosition(40, 0), false);
  assert.match(serverSource, /processedCombatEvents/);
  assert.match(serverSource, /PK_PROTECTION_MS/);
  assert.doesNotMatch(serverSource, /clamp\(input\.power/);
});
