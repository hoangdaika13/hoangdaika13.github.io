"use strict";

const MIN_PASSWORD_CHARACTERS = 12;
const MAX_PASSWORD_BYTES = 72;

// A deliberately small, deterministic denylist for the most common choices seen
// in credential-stuffing lists. This works offline and never sends passwords to a
// third party. A breached-password service can be added later with k-anonymity.
const COMMON_PASSWORDS = new Set([
  "123456789012", "123456789123", "1234567890ab", "adminadmin123",
  "administrator", "changeme1234", "iloveyou1234", "letmeinplease",
  "password1234", "password12345", "qwerty123456", "qwertyuiop12",
  "welcome12345", "welcomehome1", "hoang8.com123"
]);

function comparable(value) {
  return String(value || "").normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

function checkPassword(value) {
  const password = typeof value === "string" ? value : "";
  const characters = Array.from(password).length;
  const bytes = Buffer.byteLength(password, "utf8");
  if (characters < MIN_PASSWORD_CHARACTERS) {
    return { valid: false, code: "PASSWORD_TOO_SHORT", message: `Mật khẩu cần ít nhất ${MIN_PASSWORD_CHARACTERS} ký tự.` };
  }
  if (bytes > MAX_PASSWORD_BYTES) {
    return { valid: false, code: "PASSWORD_TOO_LONG", message: `Mật khẩu không được vượt quá ${MAX_PASSWORD_BYTES} byte.` };
  }
  const normalized = comparable(password);
  if (COMMON_PASSWORDS.has(normalized) || /^(.)\1{11,}$/u.test(normalized)) {
    return { valid: false, code: "PASSWORD_TOO_COMMON", message: "Mật khẩu này quá phổ biến hoặc quá dễ đoán. Hãy dùng một cụm mật khẩu riêng." };
  }
  return { valid: true, code: "PASSWORD_ACCEPTED", message: "Mật khẩu đạt chính sách an toàn." };
}

module.exports = Object.freeze({
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_CHARACTERS,
  checkPassword
});
