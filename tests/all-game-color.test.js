"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { CATALOG } = require("../all-game.js"), scenes = require("../all-game-scenes.js");
const { games: puzzles } = require("../all-game-puzzles.js"), { games: adventures } = require("../all-game-adventure.js");

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(value => {
    const c = parseInt(value, 16) / 255;
    return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
  });
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
test("all 59 destinations have individual gameplay artwork and isolated SVG namespaces", () => {
  const art = new Set();
  for (const game of CATALOG) {
    const body = scenes.illustration(game.id), card = scenes.thumbnail(game.id, "card"), hero = scenes.thumbnail(game.id, "hero");
    assert.ok(body.length > 300, game.id + " has a gameplay subject");
    art.add(body);
    assert.ok(card.includes('data-game-art="' + game.id + '"'));
    const ids = [...card.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.ok(!hero.includes('id="' + id + '"'), game.id + " card and intro can coexist");
    assert.ok(!scenes.backdrop(game.id).includes("data-game-art"), "board background does not duplicate poster gameplay");
    assert.doesNotMatch(card, /undefined|NaN|Infinity|<image|<script|foreignObject|href=/);
  }
  assert.equal(art.size, 59, "every game has a distinct subject");
});

test("all game CTA gradient endpoints contrast with the shared dark text", () => {
  const foreground = luminance("#101b34");
  for (const game of CATALOG) {
    const theme = scenes.visual(game.id);
    for (const color of [theme.primary, theme.secondary]) {
      assert.match(color, /^#[a-f0-9]{6}$/i);
      const ratio = (Math.max(luminance(color), foreground) + .05) / (Math.min(luminance(color), foreground) + .05);
      assert.ok(ratio >= 4.5, game.id + ": CTA contrast " + ratio);
    }
  }
});

test("empty merge cells remain named for assistive technology while displaying no filler text", () => {
  let state = puzzles.merge.create({ seed: 13 });
  for (const input of ["right", "down", "left", "up", "undo"]) {
    state = puzzles.merge.step(state, input);
    const cells = puzzles.merge.describe(state).cells;
    cells.forEach((cell, i) => {
      assert.ok(cell.label.length > 0);
      assert.equal(cell.text, state.board[i] ? String(state.board[i]) : "");
    });
  }
});

test("Crate Lab materials identify the actual walls, crates, goals and player after moves", () => {
  let state = adventures["crate-lab"].create({ seed: 10 });
  for (const input of ["left", "right", "up", "down", "undo"]) {
    state = adventures["crate-lab"].step(state, input);
    for (const cell of adventures["crate-lab"].describe(state).cells) {
      const expected = state.walls.includes(cell.index) ? "wall" : state.player === cell.index ? "player" :
        state.crates.includes(cell.index) ? state.goals.includes(cell.index) ? "crate-docked" : "crate" :
        state.goals.includes(cell.index) ? "goal" : "floor";
      assert.equal(cell.tone, expected);
      assert.ok(cell.description.length > 10);
    }
  }
});
