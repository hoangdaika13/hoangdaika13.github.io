import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
  FACE_ORDER, solvedFaces, applyMoves, inverseMoves, isSolved,
  parseMoves, scramble, scramblePuzzle, validateFacelets, mirrorBounds
} from "../rubik-engine.mjs";

function vendorRuntime() {
  const globals = vm.createContext({});
  for (const file of ["cube", "solve"]) {
    const script = new URL("../vendor/rubik-cubejs-" + file + ".js", import.meta.url);
    vm.runInContext(readFileSync(script, "utf8"), globals);
  }
  return globals.Cube;
}

test("standard face, slice, wide and whole-cube moves match an independent 3×3 model", () => {
  const Cube = vendorRuntime();
  const turns = [..."URFDLBMESxyzurfdlb"].flatMap((face) => [face, face + "'", face + "2"]);
  const notation = turns.join(" ");
  const actual = applyMoves(solvedFaces(), notation);
  assert.equal(actual, new Cube().move(notation).asString());
  for (const turn of turns) {
    assert.equal(applyMoves(solvedFaces(), turn), new Cube().move(turn).asString(), turn);
  }
});

test("wide turns, notation and scrambles work for ordinary cubes from 2×2 through 7×7", () => {
  assert.deepEqual(parseMoves("([R,U] r2’)2"), [
    "R", "U", "R'", "U'", "Rw2", "R", "U", "R'", "U'", "Rw2"
  ]);
  assert.deepEqual(parseMoves("[F: [R,U]]"), ["F", "R", "U", "R'", "U'", "F'"]);
  assert.throws(() => parseMoves("(R U", 3), /đóng/u);
  assert.throws(() => parseMoves("5Rw", 4), /vượt/u);
  assert.throws(() => parseMoves("M", 4), /lớp giữa/u);
  const afterWideTurn = applyMoves(solvedFaces(4), "Rw", 4);
  assert.equal(afterWideTurn.slice(0, 16), "UUFFUUFFUUFFUUFF");
  for (let size = 2; size <= 7; size++) {
    const random = () => 0.42;
    const sample = scramble(size, 19, random);
    const start = solvedFaces(size);
    assert.equal(parseMoves(sample, size).length, 19);
    const scrambled = applyMoves(start, sample, size);
    assert.equal(scrambled.length, 6 * size ** 2);
    assert.ok(!isSolved(scrambled, size));
    assert.equal(applyMoves(scrambled, inverseMoves(sample, size), size), start);
  }
});

test("physical validation rejects duplicate colors, flipped edges, twisted corners and odd swaps", () => {
  const solved = solvedFaces();
  const change = (...indices) => {
    const cells = [...solved];
    indices.forEach((at, i) => { cells[at] = solved[indices[(i + 1) % indices.length]]; });
    return cells.join("");
  };
  assert.ok(validateFacelets(applyMoves(solved, "R U' F D2 x M'")).ok);
  assert.match(validateFacelets(solved.slice(1)).error, /54/);
  assert.match(validateFacelets(solved.slice(0, 4) + "R" + solved.slice(5)).error, /tâm/);
  assert.match(validateFacelets(change(5, 10)).error, /cạnh bị lật/);
  assert.match(validateFacelets(change(8, 9, 20)).error, /góc xoắn/);
  assert.match(validateFacelets(change(10, 19)).error, /Hoán vị/);
});

test("vendored two-phase search solves independently configured stickers", () => {
  const Cube = vendorRuntime();
  Cube.initSolver();
  const state = applyMoves(solvedFaces(), "F B2 D' R U2 F2 L' B D2 R2 L F U' B2 D L2 R U' F2 x");
  const legal = validateFacelets(state);
  assert.ok(legal.ok);
  assert.deepEqual([...FACE_ORDER].map((_, i) => legal.facelets[i * 9 + 4]), [...FACE_ORDER]);
  const solution = Cube.fromString(legal.facelets).solve();
  assert.ok(parseMoves(solution).length > 0);
  assert.ok(isSolved(applyMoves(state, solution)));
});

test("Mirror pieces carry their own extents as they rotate to other surfaces", () => {
  const state = solvedFaces();
  const before = mirrorBounds(state);
  const after = mirrorBounds(applyMoves(state, "R"));
  const dimensionSignatures = (parts) => parts.map(({ high, low }) =>
    high.map((edge, i) => (edge - low[i]).toFixed(3)).sort().join("/")
  ).sort();
  assert.equal(before.length, 26);
  assert.ok(new Set(dimensionSignatures(before)).size > 20);
  assert.deepEqual(dimensionSignatures(after), dimensionSignatures(before));
  const cornerUFR = after.find(({ point }) => point.join("") === "222");
  assert.equal(cornerUFR.high[1], 1.87); // F became U on this piece.
  assert.equal(cornerUFR.high[2], 1.72); // D became F on this piece.
});

test("other puzzle scramblers use their own notation and Square-1 preserves physical cuts", () => {
  let seed = 834862;
  const random = () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 2 ** 32);
  assert.match(scramblePuzzle("pyraminx", random), /^[URLBurlb' ]+$/u);
  assert.match(scramblePuzzle("skewb", random), /^[URLB' ]+$/u);
  assert.match(scramblePuzzle("megaminx", random), /^R[+-]{2} D[+-]{2}/u);
  assert.match(scramblePuzzle("clock", random), /^UR\d[+-] .* y2 U\d[+-]/u);
  const square = scramblePuzzle("square1", random);
  assert.equal(square.split("/").length, 13);
  assert.notEqual(square, scramblePuzzle("square1", random));
});
