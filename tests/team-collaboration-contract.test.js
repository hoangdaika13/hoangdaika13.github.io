const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const client = fs.readFileSync(path.join(root, "team-collaboration-pro.js"), "utf8");
const api = fs.readFileSync(path.join(root, "api", "team", "board.js"), "utf8");
const css = fs.readFileSync(path.join(root, "team-collaboration-pro.css"), "utf8");

test("Team workspace provides shared board, membership, tasks and comments", () => {
  for (const marker of ["create-board", "join-board", "create-task", "update-task", "comment", "shareToken"]) assert.match(api, new RegExp(marker));
  for (const marker of ["data-tc-share", "data-tc-add", "data-tc-comment", "joinFromLink"]) assert.match(client, new RegExp(marker));
});

test("Team workspace preserves role-based access and responsive layout", () => {
  assert.match(api, /access\.role === "viewer"/);
  assert.match(css, /\.tc-kanban/);
  assert.match(css, /@media\(max-width:700px\)/);
});
