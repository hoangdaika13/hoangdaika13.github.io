const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Phật Pháp is a first-class routed workspace", () => {
  const router = read("script.js");
  const loader = read("performance-loader.js");
  const index = read("index.html");
  const sw = read("sw.js");

  assert.match(router, /id:\s*"phat-phap"/);
  assert.match(router, /route:\s*"\/phat-phap"/);
  assert.match(router, /window\.HHPhatPhap\?\.mount/);
  assert.match(router, /app-dharma-route/);
  assert.match(loader, /dharma:\s*\{/);
  assert.match(loader, /phat-phap\.css\?v=15/);
  assert.match(loader, /phat-phap\.js\?v=13/);
  assert.match(index, /performance-loader\.js\?v=484/);
  assert.match(index, /script\.js\?v=238/);
  assert.match(sw, /hh-identity-portal-v822/);
  assert.match(sw, /phat-phap\.css\?v=15/);
  assert.match(sw, /phat-phap\.js\?v=13/);
  assert.match(sw, /assets\/phat-phap\/duc-phat-hao-quang-v1\.webp/);
});

test("workspace uses a solemn Dharma palette and a single content scroller", () => {
  const css = read("phat-phap.css");
  assert.match(css, /--dharma-gold:\s*#d4a017/);
  assert.match(css, /--dharma-vermilion:\s*#983b22/);
  assert.match(css, /--dharma-ivory:\s*#fffaf0/);
  assert.match(css, /#appMain\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.dharma-workspace\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /dharmaIncense/);
  assert.match(css, /dharmaLamp/);
  assert.match(css, /dharmaLotus/);
  assert.match(css, /dharmaSacredHalo/);
  assert.match(css, /dharmaAuraBreath/);
  assert.match(css, /body\.app-dharma-route \.app-mobile-nav \{ display: none !important; \}/);
  assert.match(css, /body\.app-dharma-route\.app-sidebar-collapsed \.app-sidebar/);
  assert.doesNotMatch(css, /nebula|starfield|galaxy|planet|wormhole/i);
});

test("learning and practice features are real local-first capabilities", () => {
  const source = read("phat-phap.js");
  for (const contract of [
    "Lộ trình tu học", "Giáo lý", "Scripture Study Lab", "Thiền đường số", "Phòng tụng niệm", "Chùa online",
    "Pháp thoại", "Thỉnh kinh", "Hỏi đáp có nguồn", "Nhật ký mã hóa", "Từ điển Phật học", "Bản đồ giáo pháp"
  ]) assert.match(source, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /hh\.phat-phap\.study\.v1/);
  assert.match(source, /hh\.phat-phap\.journal\.v1/);
  assert.match(source, /AES-GCM/);
  assert.match(source, /PBKDF2/);
  assert.match(source, /JOURNAL_ITERATIONS\s*=\s*180000/);
  assert.match(source, /speechSynthesis/);
  assert.match(source, /AudioContext/);
  assert.match(source, /data-dharma-aura/);
  assert.match(source, /assets\/phat-phap\/duc-phat-hao-quang-v1\.webp/);
  assert.match(source, /SuttaCentral/);
  assert.match(source, /Giáo hội Phật giáo Việt Nam/);
  assert.match(source, /Phật Sự Online/);
  assert.match(source, /không quy đổi thành công đức/i);
  assert.match(source, /không phải bản dịch kinh/i);
  assert.match(source, /LEARNING_TIERS/);
  assert.match(source, /scriptureNotes/);
  assert.match(source, /offlinePacks/);
  assert.match(source, /readingPath/);
  assert.match(source, /data-open-provenance/);
  assert.match(source, /data-bell-interval/);
  assert.match(source, /data-chant-play/);
  assert.match(source, /84000/);
});

test("Study Lab exposes provenance, contextual filters, offline packs and an accordion cockpit", () => {
  const source = read("phat-phap.js");
  const css = read("phat-phap.css");
  for (const field of ["canonicalTitle", "sourceLanguage", "translator", "license", "verifiedAt", "difficulty", "topic"]) assert.match(source, new RegExp(field));
  assert.match(source, /data-scripture-topic/);
  assert.match(source, /data-scripture-difficulty/);
  assert.match(source, /data-toggle-nav-group/);
  assert.match(source, /is-progress-closed/);
  assert.match(css, /dharma-parallel-reader/);
  assert.match(css, /dharma-nav-groups/);
  assert.match(css, /dharma-hub\.is-practicing/);
});

test("Dharma route gets a non-cosmic gold transition treatment", () => {
  const router = read("script.js");
  const css = read("app-shell.css");
  assert.match(router, /"phat-phap":\s*"dharma"/);
  assert.match(router, /kind === "dharma" \? "PHẬT PHÁP · TRUNG TÂM TU HỌC"/);
  assert.match(css, /data-transition-kind="dharma"/);
  assert.match(css, /appDharmaLoaderWheel/);
  assert.match(css, /appDharmaLoaderPetal/);
  assert.match(css, /app-cosmic-loader__space[^}]*display:none!important/s);
});

test("original Buddha hero artwork is optimized and aura modes stay local-first", () => {
  const asset = path.join(root, "assets", "phat-phap", "duc-phat-hao-quang-v1.webp");
  const source = read("phat-phap.js");
  assert.equal(fs.existsSync(asset), true);
  assert.ok(fs.statSync(asset).size < 400_000, "hero artwork should remain fast enough for route loading");
  for (const mode of ["gentle", "radiant", "ceremonial"]) assert.match(source, new RegExp(`id: "${mode}"`));
  assert.match(source, /visual:\s*\{ aura: "radiant" \}/);
  assert.match(source, /state\.visual = \{ \.\.\.state\.visual, aura: next\.id \}/);
});

test("advanced Dharma learning journeys and reader tools preserve provenance boundaries", () => {
  const source = read("phat-phap.js");
  for (const contract of [
    "Pháp học theo đời sống", "Khi căng thẳng, mất ngủ hoặc bất an", "Không thay thế hỗ trợ chuyên môn",
    "MỤC LỤC TỰ ĐỘNG", "HH TÓM LƯỢC", "BẢN DỊCH ĐƯỢC CẤP PHÉP", "TRUNG TÂM KIỂM CHỨNG NGUỒN"
  ]) assert.match(source, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  assert.match(source, /SCRIPTURE_SEGMENTS/);
  assert.match(source, /data-segment-highlight/);
  assert.match(source, /data-scripture-segment-note/);
  assert.match(source, /data-export-scripture-notes/);
  assert.match(source, /data-print-scripture-notes/);
  assert.match(source, /canEditSources/);
  assert.match(source, /Tài khoản không có quyền biên tập nguồn/);
});

test("practice, schedule and chanting controls are functional without spiritual scoring", () => {
  const source = read("phat-phap.js");
  for (const contract of ["MEDITATION_COURSE", "data-course-day", "data-meditation-lock", "data-grounding", "data-chant-sleep", "data-calendar-view", "data-calendar-template", "data-export-calendar"]) assert.match(source, new RegExp(contract));
  assert.match(source, /BEGIN:VCALENDAR/);
  assert.match(source, /METHOD:PUBLISH/);
  assert.match(source, /applyCalendarTemplate/);
  assert.match(source, /localDayKey/);
  assert.match(source, /filter\(\(item\) => !item\.template\)/);
  assert.match(source, /không tạo chuỗi thành tích/i);
  assert.match(source, /không quy đổi thành công đức/i);
  assert.doesNotMatch(source, /điểm công đức|xếp hạng tâm linh|spiritual score/i);
});

test("temple directory and private reading circles fail closed around trust and privacy", () => {
  const source = read("phat-phap.js");
  for (const contract of ["TEMPLE_DIRECTORY", "data-temple-province", "data-temple-tradition", "data-report-temple", "HHC1.", "data-circle-create", "data-circle-join", "data-circle-private-note", "data-circle-shared-note", "manual-local"]) assert.match(source, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /không lưu số điện thoại hay tài khoản cúng dường/i);
  assert.match(source, /Không chia sẻ nhật ký, thời lượng thiền, tiến độ bài học/i);
  assert.match(source, /Đây chưa phải đồng bộ máy chủ/i);
  assert.match(source, /Lợi dụng tài chính/);
});

test("glossary, accessibility and assistant boundaries are explicit and operable", () => {
  const source = read("phat-phap.js");
  const css = read("phat-phap.css");
  for (const contract of ["GLOSSARY_DETAILS", "data-speak-glossary", "data-glossary-deck", "data-access-reader-size", "data-access-contrast", "data-access-senior", "data-access-audio-description"]) assert.match(source, new RegExp(contract));
  assert.match(source, /HH tuyệt đối không làm/i);
  assert.match(source, /Giả danh tăng ni/);
  assert.match(source, /Phán nghiệp, hứa chữa bệnh hay đổi số phận/);
  assert.match(css, /data-contrast="high"/);
  assert.match(css, /data-senior="true"/);
  assert.match(css, /--dharma-reader-size/);
  assert.match(css, /dharmaTempleDoor/);
  assert.match(css, /dharmaReadingLight/);
});

test("all new Dharma subroutes are discoverable from the application router", () => {
  const router = read("script.js");
  for (const route of ["situations", "provenance", "schedule", "circles", "accessibility", "review", "audio", "data-control"]) {
    assert.match(router, new RegExp(`route:\\s*"/phat-phap/${route}"`));
  }
});

test("Dharma v4 adds source-based review without gamification", () => {
  const source = read("phat-phap.js");
  assert.match(source, /VERSION\s*=\s*"4\.0\.0"/);
  for (const contract of ["reviewCatalog", "reviewSchedule", "reviewHistory", "data-rate-study-review", "Cần xem lại ngày mai", "Tạm hiểu · sau 7 ngày"]) assert.match(source, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /không tạo điểm số/i);
  assert.match(source, /không phải chứng nhận hay cấp bậc tâm linh/i);
  assert.doesNotMatch(source, /leaderboard/i);
});

test("citation builder and listening library label every generated surface honestly", () => {
  const source = read("phat-phap.js");
  for (const contract of ["citationText", "data-copy-citation", "data-export-citation", "audioStudyCatalog", "data-audio-queue", "data-audio-play", "SpeechSynthesisUtterance"]) assert.match(source, new RegExp(contract));
  assert.match(source, /TRÍCH DẪN TỪ METADATA · KHÔNG TỰ ĐIỀN DỊCH GIẢ/i);
  assert.match(source, /Đây không phải giọng tăng ni/i);
  assert.match(source, /Tệp pháp thoại hoặc tụng niệm của bên thứ ba chỉ được thêm khi có giấy phép âm thanh riêng/i);
});

test("meditation checks immediate wellbeing before starting a timer", () => {
  const source = read("phat-phap.js");
  for (const state of ["steady", "uneasy", "overwhelmed"]) assert.match(source, new RegExp(`id: "${state}"`));
  assert.match(source, /data-meditation-checkin/);
  assert.match(source, /if \(state\.meditation\.checkIn === "overwhelmed"\)/);
  assert.match(source, /Timer đang tạm dừng để ưu tiên ổn định/);
  assert.match(source, /Không chẩn đoán/i);
});

test("local data vault verifies backups and separates encrypted journal material", () => {
  const source = read("phat-phap.js");
  for (const contract of ["hh-dharma-study", "hh-dharma-journal-encrypted", "sha256Text", "data-import-backup", "data-confirm-import", "sanitizeBackupValue", "allowlistedStudyState", "validJournalCipher"]) assert.match(source, new RegExp(contract));
  assert.match(source, /AES-GCM · PBKDF2-SHA256 · không có PIN/);
  assert.match(source, /Checksum không khớp/);
  assert.match(source, /\["__proto__", "prototype", "constructor"\]/);
  assert.match(source, /scope: "account-local"/);
  assert.doesNotMatch(source, /scope:\s*accountKey/);
  assert.match(source, /class="dharma-file-picker"/);
  assert.match(source, /Chọn gói <code>\.hhphap<\/code>/);
  assert.doesNotMatch(source, new RegExp("Chọn gói `\\.hh"));
});

test("Dharma v4 responsive styling covers review, audio and data vault", () => {
  const css = read("phat-phap.css");
  for (const selector of ["dharma-review-workspace", "dharma-meditation-checkin", "dharma-audio-library", "dharma-data-vault", "dharma-import-preview"]) assert.match(css, new RegExp(selector));
  assert.match(css, /dharmaAudioPulse/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});
