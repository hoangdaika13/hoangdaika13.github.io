const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Solar Secret stays isolated to the login sun", () => {
  const script = read("auth-solar-secret.js");
  const css = read("auth-solar-secret.css");
  const html = read("index.html");
  assert.match(script, /#authGate/);
  assert.match(script, /data-solar-sun-hit/);
  assert.match(script, /data-solar-trigger/);
  assert.match(script, /data-solar-continue/);
  assert.match(script, /data-solar-stop/);
  assert.match(script, /hh:auth-solar-secret/);
  assert.match(script, /pagehide|AbortController/);
  assert.equal((script.match(/kind:\s*"/g) || []).length, 13, "the 12-stage trail needs one idle state plus twelve stage kinds");
  assert.match(css, /pointer-events:\s*none/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /hh-solar-ufo/);
  assert.match(css, /hh-solar-red-alert/);
  assert.match(html, /auth-solar-secret\.css\?v=3/);
  assert.match(html, /auth-solar-secret\.js\?v=3/);
});

test("Solar Secret uses inline confirmation and never browser dialogs or credentials", () => {
  const source = `${read("auth-solar-secret.js")}\n${read("auth-solar-secret.css")}`;
  assert.match(source, /Bạn thực sự muốn tiếp tục/);
  assert.doesNotMatch(source, /(?:window\.)?(?:alert|prompt|confirm)\s*\(/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/);
  assert.match(source, /Escape|keydown/);
});
