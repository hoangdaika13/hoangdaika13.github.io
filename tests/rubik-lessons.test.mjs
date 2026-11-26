import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LESSONS, LESSON_MOVIES, PUZZLES } from "../rubik-lessons.mjs";
import { applyMoves, FACE_ORDER, isSolved, mirrorBounds, parseMoves, solvedFaces } from "../rubik-engine.mjs";
import { SPECIAL_CASE_ROWS } from "../rubik-special-cases.mjs";
import { Alg, puzzles } from "../vendor/rubik-cubing/special.mjs";

const lesson = (id) => LESSONS.find((item) => item.id === id);
const face = (state, name) => {
  const index = FACE_ORDER.indexOf(name) * 9;
  return state.slice(index, index + 9);
};
const color = (state, name) => face(state, name)[4];
const sideNames = "RFLB";
const matchesCenter = (state, name, index) => face(state, name)[index] === color(state, name);
const rawCross = (state, name) => [1, 3, 5, 7].every((index) => matchesCenter(state, name, index));
const rowMatches = (state, indices) => [...sideNames].every((name) =>
  indices.every((index) => matchesCenter(state, name, index))
);
const crossUp = (state) => rawCross(state, "U") && rowMatches(state, [1]);
const crossDown = (state) => rawCross(state, "D") && rowMatches(state, [7]);
const bottom = (state) => [...face(state, "D")].every((sticker) => sticker === color(state, "D")) &&
  rowMatches(state, [6, 7, 8]);
const firstTwo = (state) => bottom(state) && rowMatches(state, [3, 5]);
const snapshot = (setup) => applyMoves(solvedFaces(), setup);
const corners = {
  UFR: [["U", 8], ["F", 2], ["R", 0]],
  UFL: [["U", 6], ["F", 0], ["L", 2]],
  UBL: [["U", 0], ["B", 2], ["L", 0]],
  UBR: [["U", 2], ["B", 0], ["R", 2]],
  DFR: [["D", 2], ["F", 8], ["R", 6]]
};
const cornerColors = (state, name) => corners[name].map(([side, index]) => face(state, side)[index]).sort().join("");
const correctTopCorners = (state) => ["UFR", "UFL", "UBL", "UBR"].filter((name) =>
  cornerColors(state, name) === [...name].map((side) => color(state, side)).sort().join("")
);

test("lesson IDs, references, video boundaries and source labels are valid", () => {
  const puzzleIds = PUZZLES.map((item) => item.id);
  assert.equal(new Set(puzzleIds).size, 12);
  assert.equal(new Set(LESSONS.map((item) => item.id)).size, LESSONS.length);
  for (const entry of LESSONS) {
    assert.ok(puzzleIds.includes(entry.puzzle), entry.id);
    if (entry.prerequisite) assert.ok(lesson(entry.prerequisite), entry.id);
    assert.ok(entry.guide.length >= 2 && entry.objective && entry.mistake && entry.exercise.goal, entry.id);
    assert.ok(entry.sources.length);
    entry.sources.forEach((source) => assert.equal(new URL(source.url).protocol, "https:"));
    if (entry.video) {
      const { id, start, end, source, chapters } = entry.video;
      assert.match(id, /^[\w-]{11}$/);
      assert.equal(new URL(source).searchParams.get("v"), id);
      assert.ok(start >= 0 && (end === undefined || end > start), entry.id);
      let last = -1;
      for (const chapter of chapters) {
        assert.ok(chapter.time >= start && chapter.time > last && (end === undefined || chapter.time < end), entry.id);
        assert.ok(chapter.caption);
        last = chapter.time;
      }
    }
  }
  for (const puzzle of puzzleIds) assert.ok(LESSONS.some((entry) => entry.puzzle === puzzle && entry.video), puzzle);
});

test("the two beginner comparisons distinguish turn direction and aligned crosses", () => {
  const [right, inverse] = lesson("notation").guide.find((part) => part.comparison).comparison;
  const initial = snapshot(right.setup);
  assert.equal(initial, snapshot(inverse.setup));
  assert.equal(color(initial, "D"), "U");
  assert.deepEqual(right.marker, inverse.marker);
  const clockwise = applyMoves(initial, right.algorithm);
  assert.notEqual(clockwise, applyMoves(initial, inverse.algorithm));
  assert.equal(applyMoves(clockwise, inverse.algorithm), initial);
  const [shifted, aligned] = lesson("white-cross").guide.find((part) => part.comparison).comparison;
  assert.ok(rawCross(snapshot(shifted.setup), "D"));
  assert.ok(!crossDown(snapshot(shifted.setup)));
  assert.ok(crossDown(snapshot(aligned.setup)));
});

test("notation examples show real movement for all move families, and white-cross drills start white down", () => {
  const notation = lesson("notation");
  assert.equal(applyMoves(snapshot(notation.exercise.setup), notation.exercise.algorithm), snapshot("x2"));
  const groups = notation.guide.filter((part) => part.algorithm).slice(1);
  const moves = new Set();
  for (const entry of groups) {
    const state = snapshot(entry.setup);
    assert.equal(color(state, "D"), "U", entry.title);
    let current = state;
    for (const move of parseMoves(entry.algorithm)) {
      moves.add(move);
      const next = applyMoves(current, move);
      assert.notEqual(next, current, entry.title + " · " + move);
      current = next;
    }
    if (!entry.algorithm.includes("R2 R2")) assert.equal(current, state, entry.title);
  }
  for (const moveset of ["U D R L F B", "M E S", "Uw Dw Rw Lw Fw Bw", "x y z"]) {
    for (const move of moveset.split(" ")) assert.ok(moves.has(move) && moves.has(move + "'"), move);
  }
  for (const part of lesson("white-cross").guide) {
    const state = snapshot(part.setup);
    assert.equal(color(state, "D"), "U", part.title);
    assert.equal(color(state, "U"), "D", part.title);
    assert.ok(crossDown(applyMoves(state, part.algorithm)), part.title);
  }
});

test("the corner extraction raises the wrong piece and preserves the white cross", () => {
  const extraction = lesson("white-corners").guide[2];
  const before = snapshot(extraction.setup);
  const after = applyMoves(before, extraction.algorithm);
  const wrongCorner = cornerColors(before, "DFR");
  const whiteCorner = cornerColors(snapshot("x2"), "DFR");
  assert.ok(!wrongCorner.includes("U"));
  assert.equal(cornerColors(before, "UBL"), whiteCorner);
  assert.equal(cornerColors(after, "UFR"), wrongCorner);
  assert.equal(cornerColors(after, "UBR"), whiteCorner);
  assert.equal(color(after, "D"), "U");
  assert.ok(crossDown(before) && crossDown(after));
  assert.ok(!isSolved(after));
});

test("the no-corner match example creates one correct corner and keeps it during placement", () => {
  const [, keepOne, none] = lesson("place-corners").guide;
  const before = snapshot(none.setup);
  const firstPass = applyMoves(before, keepOne.algorithm);
  const aligned = applyMoves(firstPass, "y");
  const after = applyMoves(before, none.algorithm);
  assert.deepEqual(correctTopCorners(before), []);
  assert.deepEqual(correctTopCorners(firstPass), ["UBR"]);
  assert.deepEqual(correctTopCorners(aligned), ["UFR"]);
  assert.deepEqual(correctTopCorners(after), ["UFR", "UFL", "UBL", "UBR"]);
  for (const state of [before, firstPass, aligned, after]) {
    assert.equal(color(state, "D"), "U");
    assert.ok(firstTwo(state) && crossUp(state));
  }
});

test("the three walkthroughs reach actual beginner checkpoints on distinct cubes", () => {
  const starts = new Set();
  const youtubeIds = new Set();
  for (const id of ["walkthrough", "walkthrough-2", "walkthrough-3"]) {
    const entry = lesson(id);
    const [all, ...stages] = entry.guide;
    let state = snapshot(all.setup);
    starts.add(state);
    youtubeIds.add(entry.video.id);
    assert.ok(!isSolved(state));
    assert.equal(color(state, "D"), "U", "white starts on bottom");
    stages.forEach((stage, index) => {
      assert.equal(snapshot(stage.setup), state, id + " · " + stage.title);
      state = applyMoves(state, stage.algorithm);
      assert.equal(color(state, "D"), "U", "white stays on bottom at each checkpoint");
      switch (index) {
        case 0:
          assert.ok(crossDown(state), id);
          break;
        case 1:
          assert.ok(bottom(state), id);
          break;
        case 2:
          assert.ok(firstTwo(state) && !rawCross(state, "U"), id);
          break;
        case 3:
          assert.ok(firstTwo(state) && rawCross(state, "U"), id);
          break;
        case 4:
          assert.ok(firstTwo(state) && crossUp(state), id);
          break;
        case 5:
          assert.ok(firstTwo(state) && crossUp(state) && !isSolved(state), id);
          break;
        case 6:
          assert.ok(isSolved(state), id);
          break;
      }
    });
  }
  assert.equal(starts.size, 3);
  assert.equal(youtubeIds.size, 3);
});

test("local clips and captions resolve to their lesson records", async () => {
  assert.equal(LESSON_MOVIES.length, 16);
  for (const movie of LESSON_MOVIES) {
    assert.equal(movie.src, lesson(movie.id).localClip.src);
    const [clip, track] = await Promise.all([
      readFile(new URL("../" + movie.src, import.meta.url)),
      readFile(new URL("../" + movie.captions, import.meta.url), "utf8")
    ]);
    assert.equal(clip.toString("ascii", 4, 8), "ftyp", movie.id);
    assert.match(track, /^WEBVTT\r?\n\r?\n00:00:00\.000 -->/u, movie.id);
  }
});

const workshopGroups = [
  ["4x4x4", ["4x4-inner-turns", "4x4-reduction-check"]],
  ["5x5x5", ["5x5-last-edge"]],
  ["6x6x6", ["6x6-edge-orbits"]],
  ["7x7x7", ["7x7-edge-orbits"]],
  ["pyraminx", ["pyraminx-edge-cycles", "pyraminx-edge-flip"]],
  ["megaminx", ["megaminx-4look"]],
  ["skewb", ["skewb-center-cycle"]],
  ["square1", ["square1-align-cut", "square1-edge-permutation"]],
  ["clock", ["clock-front-groups", "clock-back-groups"]],
  ["mirror", ["mirror-first-layer", "mirror-middle-layer", "mirror-last-layer"]]
];

const wedgePairs = [[0, 1], [3, 4], [6, 7], [9, 10], [13, 14], [16, 17], [19, 20], [22, 23]];
const sliceSeams = [[11, 0], [5, 6], [23, 12], [17, 18]];

function physicallyApply(pattern, notation, puzzle, id) {
  for (const move of Alg.fromString(notation).experimentalLeafMoves()) {
    if (puzzle === "square1" && move.family === "_SLASH_") {
      const pieces = pattern.patternData.WEDGES.pieces;
      for (const [left, right] of sliceSeams) {
        assert.ok(!wedgePairs.some(([a, b]) => pieces[left] === a && pieces[right] === b || pieces[left] === b && pieces[right] === a), id);
      }
    }
    pattern = pattern.applyMove(move);
  }
  return pattern;
}

test("all specialty workshops follow existing paths and present legal progress towards a playable goal", async () => {
  const specialCases = new Map(SPECIAL_CASE_ROWS.map((row) => [row.id, row]));
  for (const [puzzle, ids] of workshopGroups) {
    const size = puzzle === "mirror" ? 3 : Number(puzzle[0]);
    const model = size ? null : await puzzles[puzzle].kpuzzle();
    const solved = model ? model.defaultPattern() : solvedFaces(size);
    for (const id of ids) {
      const entry = lesson(id);
      assert.equal(entry.puzzle, puzzle, id);
      assert.ok(LESSONS.indexOf(lesson(entry.prerequisite)) < LESSONS.indexOf(entry), id);
      const { setup, algorithm } = entry.exercise;
      if (model) {
        const before = physicallyApply(solved, setup, puzzle, id);
        const after = physicallyApply(before, algorithm, puzzle, id);
        assert.ok(!before.isIdentical(solved) && after.isIdentical(solved), id);
      } else {
        const before = applyMoves(solved, setup, size);
        const after = applyMoves(before, algorithm, size);
        assert.ok(!isSolved(before, size) && isSolved(after, size), id);
      }
      for (const step of entry.guide) {
        if (step.algorithm && model) physicallyApply(physicallyApply(solved, step.setup, puzzle, id), step.algorithm, puzzle, id);
        if (step.algorithm && size) applyMoves(applyMoves(solved, step.setup, size), step.algorithm, size);
        for (const comparison of step.comparison || []) {
          if (comparison.caseId) assert.equal(specialCases.get(comparison.caseId)?.setup, comparison.setup, id);
        }
      }
    }
  }
});

test("large-cube parity workshops isolate the stated wings instead of disturbing the center", () => {
  for (const [id, size, delta] of [
    ["4x4-reduction-check", 4, [1, 2]],
    ["5x5-last-edge", 5, [1, 3]],
    ["6x6-edge-orbits", 6, [2, 3]],
    ["7x7-edge-orbits", 7, [1, 5]]
  ]) {
    const original = solvedFaces(size);
    const before = applyMoves(original, lesson(id).exercise.setup, size);
    const frontEdge = size * (size - 1);
    const permitted = new Set([...delta.map(i => frontEdge + i), ...delta.map(i => 2 * size ** 2 + i)]);
    const changed = [...before].flatMap((sticker, i) => sticker === original[i] ? [] : [i]);
    assert.deepEqual(new Set(changed), permitted, id);
  }
  const solved = solvedFaces(4);
  assert.equal(applyMoves(solved, "R 2R", 4), applyMoves(solved, "Rw", 4));
  assert.notEqual(applyMoves(solved, "2R", 4), applyMoves(solved, "R2", 4));
});

test("recognition drills match the lesson's claimed corner and edge signatures", async () => {
  const pattern = async (id) => {
    const { puzzle, exercise } = lesson(id);
    const base = (await puzzles[puzzle].kpuzzle()).defaultPattern();
    return [base.patternData, physicallyApply(base, exercise.setup, puzzle, id).patternData];
  };
  const [baseSkewb, skewb] = await pattern("skewb-center-cycle");
  assert.deepEqual(skewb.CORNERS, baseSkewb.CORNERS);
  assert.equal(skewb.CENTERS.pieces.filter((piece, i) => piece !== baseSkewb.CENTERS.pieces[i]).length, 3);
  const [basePy, py] = await pattern("pyraminx-edge-flip");
  assert.deepEqual(py.EDGES.pieces, basePy.EDGES.pieces);
  assert.equal(py.EDGES.orientation.filter(Boolean).length, 2);
  const [, minx] = await pattern("megaminx-4look");
  assert.ok(minx.EDGES.orientation.every((value) => value === 0));
  assert.equal(minx.CORNERS.orientation.filter(Boolean).length, 3);
  const [, clock] = await pattern("clock-front-groups");
  assert.equal(clock.DIALS.orientation[4], 2);
  assert.equal(clock.DIALS.orientation[5], 2);
  const { setup, algorithm } = lesson("mirror-last-layer").guide[0];
  const before = mirrorBounds(snapshot(setup));
  const after = mirrorBounds(applyMoves(snapshot(setup), algorithm));
  assert.ok(new Set(before.filter(piece => Object.hasOwn(piece.surfaces, "U")).map(piece => piece.high[1])).size > 1);
  assert.equal(new Set(after.filter(piece => Object.hasOwn(piece.surfaces, "U")).map(piece => piece.high[1])).size, 1);
});
