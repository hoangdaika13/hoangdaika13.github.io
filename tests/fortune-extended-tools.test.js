const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
globalThis.self = globalThis;
globalThis.iztro = require(path.join(root, "vendor/iztro-2.6.0.min.js"));
const tools = require(path.join(root, "fortune-extended-tools.js"));

test("Zi Wei studio creates a complete twelve-palace chart with Vietnamese labels", () => {
  const result = tools.calculateZiWei({ date: "2000-08-16", time: "03:30", gender: "male", fixLeap: true });
  assert.equal(result.ok, true);
  assert.equal(result.palaces.length, 12);
  assert.ok(result.palaces.every((palace) => palace.name && palace.heavenlyStem && palace.earthlyBranch));
  assert.ok(result.palaces.some((palace) => palace.isOriginalPalace));
  assert.ok(result.palaces.flatMap((palace) => palace.majorStars).length >= 14);
  assert.equal(result.provenance.license, "MIT");
  assert.doesNotMatch(JSON.stringify(result), /healthTip|疾病|chẩn đoán riêng/iu);
});

test("Zi Wei studio refuses missing or invalid birth time instead of guessing", () => {
  assert.equal(tools.calculateZiWei({ date: "2000-08-16", time: "" }).ok, false);
  assert.equal(tools.calculateZiWei({ date: "2000-02-30", time: "12:00" }).ok, false);
});

test("physiognomy is self-described, local and never a biometric personality inference", () => {
  const options = tools.physiognomyOptions();
  assert.deepEqual(Object.keys(options), ["face", "brows", "eyes", "nose", "mouth"]);
  const result = tools.createPhysiognomyReflection({ face: "oval", brows: "straight", eyes: "open", nose: "rounded", mouth: "balanced" });
  assert.equal(result.ok, true);
  assert.equal(result.observations.length, 5);
  assert.match(result.privacy, /Không dùng camera/);
  assert.match(result.privacy, /không nhận ảnh hoặc dữ liệu định danh/);
  assert.match(result.limitations.join(" "), /Không suy luận nhân cách/);
});

test("dream symbol journal works locally and keeps uncertainty explicit", () => {
  const result = tools.analyzeDream("Tôi đi lạc trong một ngôi nhà rồi nhìn thấy nước dâng ngoài cửa.", "confused");
  assert.equal(result.ok, true);
  assert.ok(result.matches.some((item) => item.id === "water"));
  assert.ok(result.matches.some((item) => item.id === "house"));
  assert.ok(result.matches.some((item) => item.id === "lost"));
  assert.match(result.privacy, /Nội dung nguyên văn chỉ được xử lý trong trình duyệt/);
  assert.match(result.privacy, /mô-típ đã khớp cục bộ/);
  assert.match(result.limitations.join(" "), /không dự báo tương lai/);
});
