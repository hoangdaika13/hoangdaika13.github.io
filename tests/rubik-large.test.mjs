import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FACE_ORDER, applyMoves, inverseMoves, isSolved, parseMoves, scramble, solvedFaces } from "../rubik-engine.mjs";
import { LARGE_PUZZLES, LARGE_LESSONS } from "../rubik-large-lessons.mjs";
import { LARGE_CASE_ROWS, LARGE_GROUP_ROWS } from "../rubik-large-cases.mjs";

test("8×8 and 9×9 wide turns match their individual physical slices", () => {
  for (const size of [8, 9]) {
    const unique = Array.from({ length: 6 * size ** 2 }, (_, i) => String.fromCharCode(1024 + i)).join("");
    for (const face of FACE_ORDER) {
      for (const width of [2, 3, 4, size]) {
        const layers = Array.from({ length: width }, (_, i) => (i + 1) + face + "'").join(" ");
        assert.equal(applyMoves(unique, width + face + "w'", size), applyMoves(unique, layers, size));
      }
    }
    assert.equal(applyMoves(unique, size + "R", size), applyMoves(unique, "L'", size));
    assert.equal(applyMoves(unique, size + "Rw", size), applyMoves(unique, "x", size));
    const sample = scramble(size);
    assert.equal(parseMoves(sample, size).length, size === 8 ? 120 : 140);
    const mixed = applyMoves(solvedFaces(size), sample, size);
    assert.ok(!isSolved(mixed, size));
    assert.equal(applyMoves(mixed, inverseMoves(sample, size), size), solvedFaces(size));
    assert.throws(() => parseMoves(String(size + 1) + "R", size), /ngoài/);
    assert.throws(() => parseMoves(String(size + 1) + "Rw", size), /phạm vi/);
    if (size === 8) assert.throws(() => parseMoves("M", size), /lớp giữa/);
    else assert.equal(applyMoves(unique, "M", size), applyMoves(unique, "5L", size));
  }
});

test("the large-cube examples isolate the stated center, wing or parity defects", () => {
  for (const entry of LARGE_CASE_ROWS) {
    const size = Number(entry.puzzle[0]);
    const area = size ** 2;
    const initial = applyMoves(solvedFaces(size), entry.setup, size);
    const reference = applyMoves(solvedFaces(size), "x2", size);
    const difference = [...initial].flatMap((color, i) => color === reference[i] ? [] : [{
      face: FACE_ORDER[Math.floor(i / area)], row: Math.floor((i % area) / size), column: i % size
    }]);
    assert.equal(initial[Math.floor((area - 1) / 2)], "D", entry.id + " yellow top");
    assert.equal(initial[3 * area + Math.floor((area - 1) / 2)], "U", entry.id + " white bottom");
    assert.ok(difference.length > 0, entry.id);
    assert.equal(applyMoves(initial, entry.algorithm, size), reference, entry.id);
    if (entry.target === "centers") {
      assert.ok(difference.every(({ row, column }) => Math.min(row, column) > 0 && Math.max(row, column) < size - 1), entry.id);
    } else if (entry.target.startsWith("wings-")) {
      const depth = Number(entry.target.at(-1)) - 1;
      const set = new Set(difference.map(({ face, row, column }) => face + row + ":" + column));
      assert.deepEqual(set, new Set([
        "U" + (size - 1) + ":" + depth, "U" + (size - 1) + ":" + (size - depth - 1),
        "F0:" + depth, "F0:" + (size - depth - 1)
      ]), entry.id);
    } else {
      const flip = entry.target === "oll-parity";
      assert.equal(difference.length, 12, entry.id);
      assert.ok(difference.every(({ face, row, column }) =>
        column > 0 && column < size - 1 && (face === "F" && row === 0 ||
          (flip ? face === "U" && row === size - 1 : face === "B" && row === 0))
      ), entry.id);
    }
  }
});

test("every new group and guided lesson links to working examples and media", () => {
  assert.deepEqual(LARGE_PUZZLES.map(({ id }) => id), ["8x8x8", "9x9x9"]);
  const groups = new Set(LARGE_GROUP_ROWS.map(([id]) => id));
  assert.equal(LARGE_CASE_ROWS.length, 12);
  for (const [id, , puzzle, expected] of LARGE_GROUP_ROWS) {
    assert.equal(LARGE_CASE_ROWS.filter((entry) => entry.group === id && entry.puzzle === puzzle).length, expected, id);
  }
  for (const lesson of LARGE_LESSONS) {
    const size = Number(lesson.puzzle[0]);
    const steps = lesson.guide.filter(({ algorithm }) => algorithm);
    assert.ok(steps.length >= 2, lesson.id);
    assert.ok(lesson.caseGroups.every((id) => groups.has(id)), lesson.id);
    for (const { setup, algorithm } of [...steps, lesson.exercise]) {
      const start = applyMoves(solvedFaces(size), setup, size);
      assert.ok(!isSolved(start, size), lesson.id);
      assert.ok(isSolved(applyMoves(start, algorithm, size), size), lesson.id);
    }
  }
  for (const { id } of LARGE_CASE_ROWS) {
    const file = readFileSync(new URL("../assets/rubik/clips/" + id + ".mp4", import.meta.url));
    assert.equal(file.toString("ascii", 4, 8), "ftyp", id);
    assert.ok(file.length > 4096 && file.indexOf("moov") < file.indexOf("mdat"), id);
  }
});
