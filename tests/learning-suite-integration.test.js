const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const styles = [
  "learning-suite.css?v=1",
  "learning-home.css?v=1",
  "learning-paths.css?v=1",
  "learning-review.css?v=1",
  "learning-lesson-player.css?v=1",
  "learning-coach-labs.css?v=1",
  "learning-classroom.css?v=1"
];

const scripts = [
  "learning-platform-core.js?v=1",
  "learning-home.js?v=1",
  "learning-paths.js?v=1",
  "learning-review.js?v=1",
  "learning-lesson-player.js?v=1",
  "learning-coach-labs.js?v=1",
  "learning-classroom.js?v=1",
  "learning-suite.js?v=1"
];

test("Learning OS assets load before the application router and are cached", () => {
  const html = read("index.html");
  const worker = read("sw.js");
  for (const asset of [...styles, ...scripts]) {
    const pattern = new RegExp(asset.replace(/[.?]/g, "\\$&"));
    assert.match(html, pattern);
    assert.match(worker, pattern);
  }
  assert.ok(html.indexOf("learning-suite.js?v=1") < html.indexOf("script.js?v=117"));
  assert.match(worker, /hh-learning-os-v170/);
});

test("Learning navigation exposes the complete focused study flow", () => {
  const client = read("script.js");
  for (const route of ["home", "paths", "mastery", "review", "mistakes", "lesson", "coach", "speaking", "assessments", "classroom", "study-together", "catch-up", "passport"]) {
    assert.match(client, new RegExp(`route: ["']/learn/${route}["']`));
  }
  assert.match(client, /window\.HHLearningSuite\.mount/);
  assert.match(client, /creativeAIRequest\("ai-center"/);
  assert.match(client, /app-learning-route/);
});

test("Learning Suite normalizes action aliases into real workspaces", () => {
  const suite = read("learning-suite.js");
  assert.match(suite, /"smart-review": "review"/);
  assert.match(suite, /"quick-test": "assessments"/);
  assert.match(suite, /"skill-graph": "mastery"/);
  assert.match(suite, /"smart-catch-up": "catch-up"/);
});
