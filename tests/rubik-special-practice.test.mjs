import test from "node:test";
import assert from "node:assert/strict";
import { loadSpecialPractice } from "../rubik-special.mjs";
import { SPECIAL_CASE_ROWS, SPECIAL_GROUP_ROWS } from "../rubik-special-cases.mjs";

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
