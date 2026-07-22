const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("HHAstraExpansion exposes the companion panel API without replacing Space Explorer", () => {
  const api = require("../astra-universe-expansion.js");
  assert.equal(typeof api.mount, "function");
  assert.equal(typeof api.unmount, "function");
  assert.equal(typeof api.inspect, "function");
  assert.equal(globalThis.HHAstraExpansion, api);
});

test("MMO RPG companion keeps the requested gameplay systems", () => {
  const source = read("astra-universe-expansion.js");
  [
    "character/captain profile",
    "CLASSES",
    "FACTIONS",
    "SHIP_MODULES",
    "inventory",
    "craft",
    "mine",
    "trade",
    "QUESTS",
    "party",
    "astra:chat",
    "BASE_BUILDINGS",
    "SKILLS",
    "World Events",
    "Dungeon / Raid / Boss",
    "toggle-mode",
    "hh:game-reward",
    "localStorage"
  ].forEach((token) => assert.ok(source.includes(token), `Missing ${token}`));
});

test("companion renders Vietnamese premium MMO controls and local fallback copy", () => {
  const source = read("astra-universe-expansion.js");
  [
    "Chỉ huy thiên hà HH",
    "Khai khoáng",
    "Giao thương",
    "Sẵn sàng co-op",
    "Party / Room",
    "Căn cứ / Defense",
    "Dữ liệu đang chạy local fallback",
    "2D nhẹ cho điện thoại yếu",
    "3D cinematic cho desktop"
  ].forEach((copy) => assert.ok(source.includes(copy), `Missing copy: ${copy}`));
});

test("optional socket hooks are present but local fallback remains available", () => {
  const source = read("astra-universe-expansion.js");
  assert.ok(source.includes('options.socket?.emit?.("astra:chat"'));
  assert.ok(source.includes('options.socket.on("astra:chat"'));
  assert.ok(source.includes('options.socket.on("astra:presence"'));
  assert.ok(source.includes('options.socket?.off?.('));
  assert.ok(/Local co-op fallback|local fallback/.test(source));
});

test("stylesheet is namespaced and responsive", () => {
  const css = read("astra-universe-expansion.css");
  assert.match(css, /\.astra-rpg-shell/);
  assert.match(css, /grid-template-columns/);
  assert.match(css, /backdrop-filter/);
  assert.match(css, /@media \(max-width: 860px\)/);
  assert.match(css, /prefers-reduced-motion/);
});
