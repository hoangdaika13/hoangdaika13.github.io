import test from "node:test";
import assert from "node:assert/strict";
import { pickPracticeCase, practiceChoices, reviewSessionCases } from "../rubik-trainer.mjs";
import { describeCubeMove, whiteBottomState } from "../rubik-player.mjs";
import { applyMoves, solvedFaces } from "../rubik-engine.mjs";

test("white-bottom palette keeps the real color orientation and preserves sticker permutations", () => {
  const state = solvedFaces();
  const mapped = whiteBottomState(state);
  assert.equal(mapped, applyMoves(state, "x2"));
  const sample = "R U2 M' Rw y S2";
  assert.equal(applyMoves(mapped, sample), whiteBottomState(applyMoves(state, sample)));
  assert.match(describeCubeMove("L'"), /mặt trái 90° ngược.*mặt L/);
  assert.match(describeCubeMove("3Rw2"), /3 lớp.*180°/);
  assert.match(describeCubeMove("S"), /lớp giữa S.*mặt F/);
  assert.match(describeCubeMove("x'"), /cả khối.*ngược.*mặt R/);
});

test("recognition questions use a unique correct choice and at most three distinct distractors", () => {
  const choices = practiceChoices("Ánh", ["Ánh", "Đường thẳng", "Đường thẳng", "Chấm", "Lệch góc", "Vòng", ""], () => 0.33);
  assert.equal(choices.length, 4);
  assert.equal(new Set(choices).size, 4);
  assert.equal(choices.filter((value) => value === "Ánh").length, 1);
  assert.deepEqual(practiceChoices("Chỉ một ca", []), ["Chỉ một ca"]);
});
test("review picks overdue work first without immediately repeating another available case", () => {
  const pool = ["first", "wrong", "done", "new"].map((id) => ({ id }));
  const progress = { first: { due: 0, wrong: 1 }, wrong: { due: 0, wrong: 3 }, done: { due: 200, wrong: 10 } };
  const pick = (opts = {}) => pickPracticeCase(pool, progress, { priority: "due", now: 100, random: () => 0, ...opts })?.id;
  assert.equal(pick(), "wrong");
  assert.equal(pick({ previous: "wrong" }), "first");
  assert.equal(pick({ previous: "wrong", priority: "all", random: () => 0.9 }), "new");
  assert.equal(pickPracticeCase([pool[0]], progress, { previous: "first" })?.id, "first");
  assert.equal(pickPracticeCase([], progress), undefined);
});

test("a review session fixes an ordered set of at most five due and unseen cases", () => {
  const pool = ["unseen", "late", "early", "future", "favorite", "known", "new", "extra", "extra", "overflow"].map((id) => ({ id }));
  const reviews = {
    late: { due: 90, wrong: 2 },
    early: { due: 10, correct: 1 },
    future: { due: 120, correct: 1 },
    favorite: { due: 0, favorite: true },
    known: { due: 0, status: "known" }
  };
  assert.deepEqual(reviewSessionCases(pool, reviews, 100), ["early", "late", "unseen", "favorite", "new"]);
  assert.deepEqual(reviewSessionCases(pool.slice(0, 4), reviews, 0), ["unseen"]);
});
