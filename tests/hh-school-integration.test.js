const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("/learn lazy-loads only HH School and keeps language routes independent", () => {
  const loader = read("performance-loader.js"); const router = read("script.js"); const worker = read("sw.js");
  for (const asset of ["hh-school.css?v=2", "hh-school-curriculum.js?v=2", "hh-school-core.js?v=2", "hh-school-offline.js?v=2", "hh-school-sync.js?v=2", "hh-school.js?v=2"]) {
    assert.match(loader, new RegExp(asset.replace(/[.?]/g, "\\$&")));
    assert.match(worker, new RegExp(asset.replace(/[.?]/g, "\\$&")));
  }
  assert.match(router, /window\.HHSchool\?\.mount/);
  assert.match(router, /apiBase: "\/api\/education"/);
  assert.match(router, /window\.HHEnglish\?\.mount/);
  assert.match(router, /window\.HHJapanese\?\.mount/);
  assert.doesNotMatch(loader, /learning-suite\.js|learning-platform-core\.js/);
});

test("old Learning Center fake certificate and handlers are removed", () => {
  const router = read("script.js"); const modules = read("data/ai-super-platform-modules.json");
  for (const stale of ["learningCenterMarkup", "hh-learning-center", "data-learning-certificate", "data-learning-quiz", "HHLearningSuite"]) assert.doesNotMatch(router, new RegExp(stale));
  assert.doesNotMatch(router, /\/learn\/learning-center/);
  assert.doesNotMatch(modules, /"id": "learning-center"/);
  for (const file of ["learning-suite.js", "learning-platform-core.js", "learning-classroom.js", "learning-home.js"]) assert.equal(fs.existsSync(path.join(root, file)), false);
});

test("HH School exposes required navigation, accessibility and responsive contracts", () => {
  const client = read("hh-school.js"); const css = read("hh-school.css");
  assert.match(client, /new root\.Worker\("hh-school-search-worker\.js\?v=2"\)/);
  for (const label of ["Hôm nay", "Lộ trình", "Môn học", "Luyện tập", "Kiểm tra", "Thư viện", "Tiến độ"]) assert.match(client, new RegExp(label));
  for (const feature of ["Teacher Mode", "Family Mode", "Education Admin Console", "learnerProfileId", "AI TUTOR AN TOÀN"]) assert.match(client, new RegExp(feature));
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /focus-visible/);
  assert.match(css, /max-width:390px/);
});

test("backend authenticates, scopes ownership and fails closed for AI", () => {
  const api = read("utils/education-handler.js"); const gateway = read("api/modules/[moduleId]/actions.js"); const vercel = read("vercel.json");
  assert.match(api, /currentUser\(req\)/);
  assert.match(api, /ownerId: user\._id/);
  assert.match(api, /canAccessLearner/);
  assert.match(api, /Teacher Mode yêu cầu vai trò/);
  assert.match(api, /AI_TUTOR_NOT_CONFIGURED/);
  assert.match(api, /grade <= 5/);
  assert.match(api, /education_audit_logs/);
  assert.match(gateway, /handleEducation/);
  assert.match(vercel, /\/api\/education\/:resource/);
});

test("offline progress queue has a real same-origin background sync handler", () => {
  const offline = read("hh-school-offline.js"); const worker = read("sw.js");
  assert.match(offline, /sync\?\.register\?\.\("hh-school-progress"\)/);
  assert.match(worker, /addEventListener\("sync"/);
  assert.match(worker, /flushHHSchoolQueue/);
  assert.match(worker, /target\.origin !== self\.location\.origin/);
  assert.match(worker, /target\.pathname\.startsWith\("\/api\/education\/"\)/);
  assert.match(worker, /credentials: "include"/);
});

test("no education secret or service key is embedded in browser bundle", () => {
  const combined = ["hh-school.js", "hh-school-core.js", "hh-school-sync.js", "hh-school-offline.js"].map(read).join("\n");
  assert.doesNotMatch(combined, /sk-[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(combined, /OPENAI_API_KEY|MONGODB_URI|service_role/i);
});

test("all HH School action controls have real handlers and migration covers required collections", () => {
  const client = read("hh-school.js"); const migration = read("scripts/migrate-hh-school.js"); const platform = read("utils/platform.js");
  for (const action of ["data-school-generate-practice", "data-tutor-report", "dataset.familyOpen", "data-admin-new-draft", "data-teacher-create-class"]) assert.match(client, new RegExp(action.replace(/[.?]/g, "\\$&")));
  for (const collection of ["education_grades", "education_subjects", "education_curricula", "education_lessons", "education_questions", "education_attempts", "education_mastery", "education_classes", "education_enrollments", "education_sources", "education_licenses", "education_ai_sessions", "education_audit_logs"]) assert.match(migration, new RegExp(collection));
  assert.match(platform, /educationRole/);
});
