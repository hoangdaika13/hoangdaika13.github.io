import test from "node:test";
import assert from "node:assert/strict";
import { loadSpecialPractice } from "../rubik-special.mjs";
import { SPECIAL_CASE_ROWS, SPECIAL_GROUP_ROWS } from "../rubik-special-cases.mjs";
import { clockProjection, squareRings } from "../rubik-variant-volume.mjs";
import { puzzles } from "../vendor/rubik-cubing/special.mjs";

test("special-puzzle exercises accept every authored solution and reject an untouched starting state", async () => {
  const groupPuzzle = new Map(SPECIAL_GROUP_ROWS.map(([group, , puzzle]) => [group, puzzle]));
  for (const item of SPECIAL_CASE_ROWS) {
    const practice = await loadSpecialPractice(groupPuzzle.get(item.group), item.setup, item.algorithm);
    assert.ok(practice.moves.length, item.id);
    assert.ok(practice.matches(practice.moves.join(" ")), item.id);
    assert.ok(!practice.matches(""), item.id);
  }
});

test("answers are checked against the destination state, including different legal sequences", async () => {
  const sameResult = [
    ["pyraminx", "u'", "u", "u2′"],
    ["skewb", "R'", "R", "R2'"],
    ["megaminx", "R'", "R", "R6"],
    ["square1", "/", "(1,1)", "(1,0) (0,1)"],
    ["clock", "ALL3-", "ALL3+", "ALL1+ ALL2+"]
  ];
  for (const [puzzle, setup, algorithm, alternative] of sameResult) {
    const practice = await loadSpecialPractice(puzzle, setup, algorithm);
    assert.ok(practice.matches(alternative), puzzle);
    assert.ok(!practice.matches(algorithm + " G"), puzzle);
  }
});

test("Square-1 rejects a blocked cut even when the algebraic result would match", async () => {
  const practice = await loadSpecialPractice("square1", "", "/");
  assert.deepEqual(practice.moves, ["/"]);
  assert.ok(practice.matches("/ / /"));
  assert.ok(!practice.matches("(-1,0) / / (1,0) /"));
  await assert.rejects(loadSpecialPractice("square1", "(-1,0)", "/"), /đường cắt/);
});

test("Clock preview derives both sides and dial hours from the current pattern", async () => {
  const model = await puzzles.clock.kpuzzle();
  const initial = model.defaultPattern();
  const front = clockProjection(initial);
  assert.deepEqual(front.map((face) => face.side), ["A", "B"]);
  assert.ok(front.every((face) => face.dials.length === 9 && face.dials.every((dial) => dial.hour === 12)));
  const turned = clockProjection(initial.applyAlg("UR3+"));
  assert.equal(turned[0].dials[4].hour, 3);
  assert.equal(turned[0].dials[8].hour, 12);
  assert.deepEqual(clockProjection(initial.applyAlg("y2")).map((face) => face.side), ["B", "A"]);
});

test("Square-1 preview keeps corners whole and renders the layer exchange after a slice", async () => {
  const model = await puzzles.square1.kpuzzle();
  const initial = model.defaultPattern();
  const before = squareRings(initial);
  const after = squareRings(initial.applyAlg("/"));
  for (const ring of [...before.layers, ...after.layers]) {
    assert.equal(ring.reduce((sum, piece) => sum + piece.width, 0), 12);
    assert.equal(new Set(ring.map((piece) => piece.key)).size, ring.length);
    assert.ok(ring.every((piece) => piece.outer.length === piece.width + 1));
  }
  assert.ok(after.layers[0].some((piece) => piece.key >= 12));
  assert.ok(after.layers[1].some((piece) => piece.key < 12));
  assert.notDeepEqual(after.equator, before.equator);
});
