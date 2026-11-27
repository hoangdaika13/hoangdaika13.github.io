import test from "node:test";
import assert from "node:assert/strict";
import { averageOf, changeReview, formatTime, inspectionPenalty, isNewReviewLaunch, isReviewDue, loadProgress, mergeRecords, recordSessionResult, solveScore } from "../rubik-progress.mjs";

test("Rubik learning, favorites and review schedules stay within a guest or account profile", () => {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) };
  const guest = loadProgress(null, storage);
  guest.value.lessons.notation = 10000;
  const wrong = changeReview(guest.value, "oll-27", { correct: false, favorite: true }, 10000);
  assert.equal(wrong.due, 10000);
  const right = changeReview(guest.value, "oll-27", { correct: true, status: "known" }, 20000);
  assert.equal(right.due, 86420000);
  assert.equal(guest.save(), true);
  const person = loadProgress({ id: "abc" }, storage);
  assert.deepEqual(person.value.reviews, {});
  person.value.last["2x2x2"] = "2x2-beginner";
  person.save();
  const restored = loadProgress(null, storage);
  assert.equal(restored.value.lessons.notation, 10000);
  assert.equal(restored.value.reviews["oll-27"].correct, 1);
  assert.equal(restored.value.reviews["oll-27"].wrong, 1);
  assert.equal(restored.value.reviews["oll-27"].favorite, true);
  assert.equal(restored.value.last["2x2x2"], undefined);
});
test("review sessions advance once and retain results separately for each profile", () => {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) };
  const guest = loadProgress(null, storage);
  const session = { ids: ["oll-27", "oll-28"], index: 0, results: [], group: "oll" };
  guest.value.sessions["3x3x3"] = session;
  assert.equal(recordSessionResult(session, "oll-28", "correct"), false);
  assert.equal(recordSessionResult(session, "oll-27", "incorrect"), true);
  assert.equal(recordSessionResult(session, "oll-27", "correct"), false);
  assert.equal(recordSessionResult(session, "oll-28", "skipped"), true);
  assert.equal(recordSessionResult(session, undefined, "correct"), false);
  guest.value.sessions["2x2x2"] = { ids: ["same", "same"], index: 1, results: ["correct"], group: "" };
  assert.equal(guest.save(), true);
  assert.deepEqual(loadProgress(null, storage).value.sessions, { "3x3x3": session });
  assert.deepEqual(loadProgress({ id: "abc" }, storage).value.sessions, {});
});

test("a new launch can be consumed once while preserving the completed summary across reloads", () => {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) };
  const guest = loadProgress(null, storage);
  const token = (20000).toString(36);
  const later = (30000).toString(36);
  const session = { ids: ["oll-27"], index: 0, results: [], group: "oll", launch: token };
  guest.value.sessions["3x3x3"] = session;
  assert.equal(isNewReviewLaunch(session, null), false);
  assert.equal(isNewReviewLaunch(session, "01ab"), false);
  assert.equal(isNewReviewLaunch(session, token), false);
  assert.equal(isNewReviewLaunch(session, later), true);
  session.launch = later;
  assert.equal(recordSessionResult(session, "oll-27", "correct"), true);
  guest.value.sessions["2x2x2"] = { ids: [], index: 0, results: [], group: "", launch: token };
  guest.save();
  const restored = loadProgress(null, storage).value.sessions;
  assert.deepEqual(restored["3x3x3"], session);
  assert.equal(isNewReviewLaunch(restored["3x3x3"], token), false);
  assert.equal(isNewReviewLaunch(restored["3x3x3"], later), false);
  assert.equal(isNewReviewLaunch(restored["2x2x2"], token), false);
  assert.deepEqual(restored["2x2x2"].ids, []);
});

test("manual scheduling keeps review statistics and never postpones an overdue case", () => {
  const state = { reviews: {} };
  const favorite = changeReview(state, "oll-2", { favorite: true }, 0);
  assert.equal(isReviewDue(favorite, 0), false);
  assert.equal(isReviewDue(changeReview(state, "oll-2", { schedule: true }, 0), 0), true);
  const right = changeReview(state, "oll-27", { correct: true, favorite: true, status: "known" }, 1000);
  const manual = changeReview(state, "oll-27", { schedule: true }, 1500);
  assert.deepEqual(manual, { ...right, due: 1500, scheduled: true });
  assert.equal(isReviewDue(manual, 1500), true);
  assert.equal(changeReview(state, "oll-27", { schedule: true }, 4000).due, 1500);
  assert.equal(changeReview(state, "oll-27", { correct: true }, 4100).scheduled, undefined);
  assert.equal(isReviewDue(state.reviews["oll-27"], 4100), false);
});

test("timed solves honor penalty, DNF and trimmed averages without duplicate imports", () => {
  const base = { puzzle: "3x3x3", scramble: "R U", penalty: "ok" };
  const rows = [8000, 9000, 10000, 11000, 12000].map((ms, i) => ({ ...base, id: "r"+i, time: i+1, ms }));
  rows[1].penalty = "+2";
  rows[4].penalty = "DNF";
  const merged = mergeRecords(rows, [{ ...rows[1], ms: 5 }, { invalid: true }]);
  assert.equal(merged.length, 5);
  assert.equal(solveScore(rows[1]), 11000);
  assert.equal(averageOf(merged, 5), 32000 / 3);
  assert.equal(averageOf(merged, 12), null);
  rows[3].penalty = "DNF";
  assert.equal(averageOf(rows, 5), Infinity);
  assert.equal(inspectionPenalty(14999), "ok");
  assert.equal(inspectionPenalty(15000), "+2");
  assert.equal(inspectionPenalty(17000), "DNF");
  assert.equal(formatTime(65400), "1:05,40 s");
});
