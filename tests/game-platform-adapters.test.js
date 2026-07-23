const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "game-platform-adapters.js"), "utf8");

test("game adapters expose the production cloud and Socket.io contracts", () => {
  assert.match(source, /window\.HHGameAdapters\s*=\s*\{\s*create\s*\}/);
  assert.match(source, /resource: "catalog"/);
  assert.match(source, /resource: "cloud-save"/);
  assert.match(source, /resource: "leaderboard"/);
  assert.match(source, /game:room:create/);
  assert.match(source, /game:rooms:list/);
  assert.match(source, /game:room:join/);
  assert.match(source, /game:spectate:join/);
  assert.match(source, /game:room:leave/);
  assert.match(source, /slotFromKey/);
});

test("game adapters require durable backend confirmation before claiming cloud save", () => {
  assert.match(source, /payload\?\.persistence === true/);
  assert.match(source, /confirmed:\s*Boolean\(payload\?\.ok !== false && \(!requireDurable \|\| isDurable\)\)/);
  assert.doesNotMatch(source, /password|clientSecret|privateKey/i);
});
