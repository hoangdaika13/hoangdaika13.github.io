const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const suite = require("../learning-suite.js");
const source = fs.readFileSync(path.join(__dirname, "..", "learning-suite.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "learning-suite.css"), "utf8");

test("Learning Suite maps every requested workspace to a dedicated engine", () => {
  for (const view of ["home", "profile", "paths", "mastery", "passport", "review", "mistakes", "vocabulary", "lesson", "coach", "speaking", "listening", "writing", "career-simulator", "assessments", "certificates", "classroom", "study-together", "smart-catch-up"]) assert.equal(suite.supports(view), true, view);
  assert.equal(suite.supports("unknown"), false);
  const engines = new Set(Object.values(suite.views).map((item) => item.engine));
  assert.equal(engines.size, 6);
});

test("suite shares one Learning Core store and cleans engine lifecycles", () => {
  assert.match(source, /HHLearningStore/);
  assert.match(source, /HHLearningCore\.createStore/);
  assert.match(source, /meta\.engine === "HHLearningClassroom"\) delete engineOptions\.store/);
  assert.match(source, /controller\?\.unmount|controller\.unmount/);
  assert.match(source, /unsubscribe\?\.\(\)/);
});

test("learning shell stays focused, responsive and motion safe", () => {
  assert.match(css, /app-learning-route/);
  assert.match(css, /@media\(max-width:720px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /:focus-visible/);
  assert.doesNotMatch(css, /font-size:\s*clamp\([^)]*vw/i);
});
