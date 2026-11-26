import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { LESSONS, LESSON_MOVIES, PUZZLES } from "../rubik-lessons.mjs";
import { applyMoves, FACE_ORDER, isSolved, solvedFaces } from "../rubik-engine.mjs";

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
const bottom = (state) => [...face(state, "D")].every((sticker) => sticker === color(state, "D")) &&
  rowMatches(state, [6, 7, 8]);
const firstTwo = (state) => bottom(state) && rowMatches(state, [3, 5]);
const snapshot = (setup) => applyMoves(solvedFaces(), setup);

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
  assert.deepEqual(right.marker, inverse.marker);
  assert.notEqual(snapshot(right.algorithm), snapshot(inverse.algorithm));
  assert.equal(applyMoves(snapshot(right.algorithm), inverse.algorithm), initial);
  const [shifted, aligned] = lesson("white-cross").guide.find((part) => part.comparison).comparison;
  assert.ok(rawCross(snapshot(shifted.setup), "U"));
  assert.ok(!crossUp(snapshot(shifted.setup)));
  assert.ok(crossUp(snapshot(aligned.setup)));
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
    assert.equal(color(state, "U"), "U", "white starts on top");
    stages.forEach((stage, index) => {
      assert.equal(snapshot(stage.setup), state, id + " · " + stage.title);
      state = applyMoves(state, stage.algorithm);
      switch (index) {
        case 0:
          assert.ok(crossUp(state), id);
          break;
        case 1:
          assert.equal(color(state, "D"), "U", "white moves to bottom after cross");
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

test("local beginner clips and captions resolve to their lesson records", async () => {
  assert.equal(LESSON_MOVIES.length, 11);
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
