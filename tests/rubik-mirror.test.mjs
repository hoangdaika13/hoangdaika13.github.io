import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applyMoves, mirrorBounds, solvedFaces } from "../rubik-engine.mjs";
import { MIRROR_CASE_ROWS, MIRROR_GROUP_ROWS } from "../rubik-mirror-cases.mjs";

const solved = solvedFaces();
const start = (item) => applyMoves(solved, item.setup);
const cases = new Map(MIRROR_CASE_ROWS.map((item) => [item.id, item]));
const sample = (suffix) => start(cases.get("mirror-" + suffix));
const geometry = (state) => mirrorBounds(state).map(({ low, high }) => [low, high]).flat(2).join(",");

test("the twelve Mirror cases start with distinct geometry and restore the reference shape", () => {
  assert.equal(cases.size, 12);
  for (const [id, , kind, expected] of MIRROR_GROUP_ROWS) {
    assert.equal(kind, "mirror");
    assert.equal(MIRROR_CASE_ROWS.filter((item) => item.group === id).length, expected);
  }
  const distinct = new Set();
  const finished = geometry(solved);
  for (const item of MIRROR_CASE_ROWS) {
    const before = start(item);
    const beforeShape = geometry(before);
    assert.notEqual(beforeShape, finished, item.id);
    assert.ok(!distinct.has(beforeShape), item.id);
    distinct.add(beforeShape);
    assert.equal(applyMoves(before, item.algorithm), solved, item.id);
  }
});

test("section examples show the claimed upper profiles and preserve the previously solved layers", () => {
  const profile = (suffix, indices) => {
    const shape = mirrorBounds(sample(suffix));
    const top = new Map(shape.filter((piece) => piece.surfaces.U !== undefined).map((piece) => [piece.surfaces.U, piece.high[1]]));
    return indices.filter((i) => Math.abs(top.get(i) - top.get(4)) < 1e-6);
  };
  assert.deepEqual(profile("cross-line", [1, 3, 5, 7]), [3, 5]);
  assert.deepEqual(profile("cross-elbow", [1, 3, 5, 7]), [1, 3]);
  assert.deepEqual(profile("corners-sune", [0, 2, 6, 8]), [6]);
  assert.deepEqual(profile("corners-antisune", [0, 2, 6, 8]), [2]);

  for (const item of MIRROR_CASE_ROWS.filter((entry) => entry.group !== "mirror-foundation")) {
    const state = start(item);
    assert.equal(state.slice(27, 36), solved.slice(27, 36), item.id + " bottom");
    for (const index of [9, 18, 36, 45]) {
      const from = index + (item.group === "mirror-last" ? 3 : 6);
      assert.equal(state.slice(from, index + 9), solved.slice(from, index + 9), item.id + " lower side rows");
    }
  }
});

test("each Mirror case has two different local shape images and a playable MP4 container", () => {
  const image = (id, phase) => readFileSync(new URL("../assets/rubik/diagrams/" + id + "-" + phase + ".webp", import.meta.url));
  for (const { id } of MIRROR_CASE_ROWS) {
    const before = image(id, "before");
    const after = image(id, "after");
    assert.equal(before.toString("ascii", 8, 12), "WEBP", id);
    assert.equal(after.toString("ascii", 8, 12), "WEBP", id);
    assert.ok(before.length >= 1000 && after.length >= 1000 && !before.equals(after), id);
    const video = readFileSync(new URL("../assets/rubik/clips/" + id + ".mp4", import.meta.url));
    assert.equal(video.toString("ascii", 4, 8), "ftyp", id);
    assert.ok(video.indexOf("moov") < video.indexOf("mdat") && video.length >= 4096, id);
  }
});
