import assert from "node:assert/strict";
import { statSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { CASES, getCaseCoverage } from "../rubik-cases.mjs";
import { CASE_CLIPS, SPECIAL_DIAGRAMS } from "../rubik-media.mjs";
import { applyMoves, isSolved, solvedFaces } from "../rubik-engine.mjs";

const require = createRequire(import.meta.url);
const Cube = require("../vendor/rubik-cubejs-cube.js");
const cornerPositions = [0, 1, 2, 3];
const solvedCorners = [4, 5, 6, 7];
const solvedEdges = [4, 5, 6, 7, 8, 9, 10, 11];
const turns = ["", "U", "U2", "U'"];

function cubieNotation(alg) {
  return alg.replace(/\b([URFDLB])w/gu, (_, face) => face.toLowerCase());
}

function fixed(permutation, orientation, positions) {
  return positions.every((position) => permutation[position] === position && orientation[position] === 0);
}

function f2lSolved(cube) {
  return fixed(cube.cp, cube.co, solvedCorners) && fixed(cube.ep, cube.eo, solvedEdges);
}

function edgeOrientation(cube) {
  return cornerPositions.every((position) => cube.eo[position] === 0);
}

function cornerOrientation(cube) {
  return cornerPositions.every((position) => cube.co[position] === 0);
}

function rawState(cube, size) {
  const faces = cube.asString();
  if (size === 3) return faces;
  return faces.match(/.{9}/gu).map((face) => [0, 2, 6, 8].map((i) => face[i]).join("")).join("");
}

function canonical(cube, measure, alignBothEnds = false) {
  return turns.flatMap((right) => (alignBothEnds ? turns : [""]).map((left) =>
    measure(new Cube().move(left).multiply(cube).move(right)))).sort()[0];
}

test("CFOP states are distinct for the standard case counts and preserve the solved parts", () => {
  const keys = { f2l: new Set(), oll: new Set(), pll: new Set(), zbll: new Set() };
  for (const item of CASES) {
    if (!(item.group in keys)) continue;
    const before = new Cube().move(cubieNotation(item.setup));
    const after = before.clone().move(cubieNotation(item.algorithm));
    const info = item.id + ": " + item.algorithm;
    if (item.group === "f2l") {
      assert.ok(fixed(before.cp, before.co, [5, 6, 7]), info + " must preserve the other corners");
      assert.ok(fixed(before.ep, before.eo, [4, 5, 6, 7, 9, 10, 11]), info + " must preserve the cross and other slots");
      assert.ok(!f2lSolved(before), info + " has to start with the target slot unsolved");
      assert.ok(f2lSolved(after), info + " must solve the target slot");
      keys.f2l.add(canonical(before, (state) => {
        const corner = state.cp.indexOf(4), edge = state.ep.indexOf(8);
        return [corner, state.co[corner], edge, state.eo[edge]].join("/");
      }));
    } else {
      assert.ok(f2lSolved(before) && f2lSolved(after), info + " must preserve F2L");
      if (item.group === "oll") {
        assert.ok(!edgeOrientation(before) || !cornerOrientation(before), info + " cannot begin fully oriented");
        assert.ok(edgeOrientation(after) && cornerOrientation(after), info + " must orient the last layer");
        keys.oll.add(canonical(before, (state) => state.asString().replace(/[^U]/g, ".")));
      } else {
        assert.ok(edgeOrientation(before), info + " needs oriented top edges");
        assert.equal(cornerOrientation(before), item.group === "pll", info + " needs the proper corner condition");
        assert.ok(!before.isSolved() && after.isSolved(), info + " must solve the last layer");
        keys[item.group].add(canonical(before, (state) => state.asString(), true));
      }
    }
  }
  assert.deepEqual(Object.fromEntries(Object.entries(keys).map(([id, set]) => [id, set.size])), {
    f2l: 41, oll: 57, pll: 21, zbll: 472
  });
});

test("the site parser and its sticker coordinates match the independent cubie engine in every 2×2 and 3×3 example", () => {
  for (const item of CASES.filter((entry) => ["2x2x2", "3x3x3"].includes(entry.puzzle))) {
    const size = Number(item.puzzle[0]);
    for (const variant of [item, ...item.variants]) {
      assert.equal(variant.setup, item.setup, item.id + " switches formulas without changing setup");
      const cube = new Cube().move(cubieNotation(variant.setup));
      const before = applyMoves(solvedFaces(size), variant.setup, size);
      assert.equal(before, rawState(cube, size), item.id + " starting view");
      cube.move(cubieNotation(variant.algorithm));
      const after = applyMoves(before, variant.algorithm, size);
      assert.equal(after, rawState(cube, size), item.id + " ending view");
    }
  }
});

test("the big-cube parity examples start with the stated edge defect and restore every sticker", () => {
  for (const item of CASES.filter((entry) => entry.goal === "parity4")) {
    const size = Number(item.puzzle[0]);
    const solved = solvedFaces(size);
    const start = applyMoves(solved, item.setup, size);
    const wrongStickers = [...start].flatMap((color, index) => color === solved[index] ? [] : [index]);
    assert.equal(wrongStickers.length, 4, item.id + " has one pair of wings to correct");
    assert.ok(wrongStickers.every((i) => i < size ** 2 || Math.floor(i / size ** 2) === 2 ||
      (item.id === "parity4-pll" && Math.floor(i / size ** 2) === 5)), item.id + " must only affect the shown edge pieces");
    assert.ok(isSolved(applyMoves(start, item.algorithm, size), size), item.id);
  }
});

test("catalogue totals and diagnostic media links resolve to a unique playable MP4 entry for each case", () => {
  const ids = CASES.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...CASE_CLIPS].sort(), ids.sort());
  for (const id of CASE_CLIPS) {
    assert.match(id, /^[a-z0-9][a-z0-9-]*$/);
    const path = new URL("../assets/rubik/clips/" + id + ".mp4", import.meta.url);
    assert.ok(statSync(path).size >= 1024, id);
    assert.equal(readFileSync(path).subarray(4, 8).toString(), "ftyp", id);
  }
  for (const id of SPECIAL_DIAGRAMS) {
    const image = (phase) => readFileSync(new URL("../assets/rubik/diagrams/" + id + "-" + phase + ".webp", import.meta.url));
    const before = image("before");
    const after = image("after");
    assert.ok(before.length > 1000 && after.length > 1000 && !before.equals(after), id + " must contain distinct start and end diagrams");
    assert.equal(before.subarray(8, 12).toString(), "WEBP", id);
  }
  for (const group of getCaseCoverage()) {
    assert.equal(group.loaded, group.expected, group.id);
    assert.equal(group.verified, group.loaded, group.id);
  }
});
