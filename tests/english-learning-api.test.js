const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const api = require(path.join(root, "services", "englishLearningSync.js"));

test("English sync validates learner profile IDs", () => {
  assert.equal(api.__test.profileIdOf("learner_01"), "learner_01");
  assert.throws(() => api.__test.profileIdOf("../../owner"), /không hợp lệ/i);
  assert.throws(() => api.__test.profileIdOf("space profile"), /không hợp lệ/i);
});

test("English sync strips client ownership and secret-shaped fields", () => {
  const state = api.__test.sanitizeLearningState({
    ownerId: "attacker",
    learnerProfileId: "default",
    completed: { lesson: true },
    settings: { apiKey: "secret", voiceRate: 0.8 },
    learningOS: { sync: { token: "secret", revision: 2 }, lessonCheckpoints: {} }
  });
  assert.equal(state.ownerId, undefined);
  assert.equal(state.settings.apiKey, undefined);
  assert.equal(state.settings.voiceRate, 0.8);
  assert.equal(state.learningOS.sync.token, undefined);
});

test("English sync endpoint derives owner from authenticated user and uses revision control", () => {
  const source = fs.readFileSync(path.join(root, "services", "englishLearningSync.js"), "utf8");
  const gateway = fs.readFileSync(path.join(root, "api", "store", "[resource].js"), "utf8");
  for (const marker of ["currentUser(req)", "String(user._id)", "ownerId, learnerProfileId", "clientMutationId", "LEARNING_REVISION_CONFLICT", "enforceRateLimit", "x-hh-confirm-delete"]) assert.match(source, new RegExp(marker.replace(/[().]/g, "\\$&")));
  assert.doesNotMatch(source, /ownerId\s*=\s*body\./);
  assert.match(gateway, /resource === "english-learning"/);
});
