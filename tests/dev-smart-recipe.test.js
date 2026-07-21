const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "dev-smart-recipe.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "dev-smart-recipe.css"), "utf8");
const smartRecipe = require("../dev-smart-recipe.js");

test("global API exposes both Smart Input and Developer Recipe", () => {
  assert.equal(smartRecipe.VERSION, 1);
  assert.equal(smartRecipe.STORAGE_KEY, "hh.dev.smart-recipe.v1");
  assert.equal(smartRecipe.supports("smart-input"), true);
  assert.equal(smartRecipe.supports("developer-recipe"), true);
  assert.equal(smartRecipe.supports("unknown"), false);
  assert.deepEqual(smartRecipe.tools().map((tool) => tool.id), ["smart-input", "developer-recipe"]);
  assert.equal(typeof smartRecipe.mount, "function");
  assert.equal(typeof smartRecipe.cleanup, "function");
  assert.match(source, /globalScope\.HHDevSmartRecipe = api/);
});

test("Smart Input recognizes every requested format", () => {
  const jwtPart = (value) => smartRecipe.utf8ToBase64(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const samples = [
    ['{"hello":"HH"}', "JSON"],
    [`${jwtPart({ alg: "HS256", typ: "JWT" })}.${jwtPart({ sub: "13", exp: 1999999999 })}.signature`, "JWT"],
    ["https://example.com/docs?q=hh", "URL"],
    ["550e8400-e29b-41d4-a716-446655440000", "UUID"],
    ["1712345678", "Timestamp"],
    ["<?xml version=\"1.0\"?><root><name>HH</name></root>", "XML"],
    ["SELECT id, name FROM users WHERE active = 1", "SQL"],
    ["#61e5ed", "Màu"],
    [smartRecipe.utf8ToBase64("Xin chào HH Platform"), "Base64"]
  ];
  for (const [input, expected] of samples) {
    assert.ok(smartRecipe.detectInput(input).some((item) => item.type === expected), `missing ${expected}`);
  }
  assert.deepEqual(smartRecipe.detectInput(""), []);
});

test("base64 operations preserve Unicode", async () => {
  const input = "Xin chào HH · 日本語";
  const encoded = await smartRecipe.executeOperation("base64-encode", input);
  assert.equal(await smartRecipe.executeOperation("base64-decode", encoded), input);
  await assert.rejects(() => smartRecipe.executeOperation("base64-decode", "%%%"), /Base64/);
});

test("safe JSONPath supports properties indexes quoted keys and wildcard", () => {
  const data = { users: [{ name: "Hoàng", role: "admin" }, { name: "An", role: "editor" }], "feature flag": true };
  assert.equal(smartRecipe.queryJsonPath(data, "$.users[0].name"), "Hoàng");
  assert.deepEqual(smartRecipe.queryJsonPath(data, "$.users[*].role"), ["admin", "editor"]);
  assert.equal(smartRecipe.queryJsonPath(data, "$['feature flag']"), true);
  assert.throws(() => smartRecipe.queryJsonPath(data, "$.users[?(@.role)]"), /Chỉ hỗ trợ/);
  assert.throws(() => smartRecipe.queryJsonPath(data, "users[0]"), /bắt đầu bằng/);
});

test("recipe pipeline formats data, pauses at breakpoint and resumes safely", async () => {
  const payload = smartRecipe.utf8ToBase64(JSON.stringify({ items: [{ id: 1 }, { id: 2 }] }));
  const recipe = smartRecipe.normalizeRecipe({
    name: "Decode and query",
    steps: [
      { operation: "base64-decode" },
      { operation: "json-format", breakpoint: true },
      { operation: "jsonpath", options: { path: "$.items[*].id" } }
    ]
  });
  const paused = await smartRecipe.runPipeline(recipe, payload);
  assert.equal(paused.status, "paused");
  assert.equal(paused.pausedAt, 1);
  assert.equal(paused.outputs[0].status, "success");
  assert.equal(paused.outputs[1].status, "breakpoint");
  const completed = await smartRecipe.runPipeline(recipe, payload, { ignoreBreakpoints: true });
  assert.equal(completed.status, "success");
  assert.equal(completed.output, "[\n  1,\n  2\n]");
});

test("step mode and error output are deterministic", async () => {
  const recipe = smartRecipe.normalizeRecipe({ steps: [{ operation: "url-encode" }, { operation: "url-decode" }] });
  const first = await smartRecipe.runPipeline(recipe, "xin chào", { stopAfter: 0 });
  assert.equal(first.status, "stepped");
  assert.equal(first.nextIndex, 1);
  assert.equal(first.output, "xin%20ch%C3%A0o");
  const bad = await smartRecipe.runPipeline({ steps: [{ operation: "json-format" }] }, "not json");
  assert.equal(bad.status, "error");
  assert.match(bad.outputs[0].error, /JSON|Unexpected/);
});

test("SHA-256 and optional GZip are real browser operations", async () => {
  assert.equal(await smartRecipe.sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  if (smartRecipe.streamTransformSupported(globalThis)) {
    const compressed = await smartRecipe.gzipCompress("HH recipe gzip");
    assert.equal(await smartRecipe.gzipDecompress(compressed), "HH recipe gzip");
  } else {
    await assert.rejects(() => smartRecipe.gzipCompress("HH"), /CompressionStream/);
  }
});

test("recipe export import and bounded share links round trip", () => {
  const recipe = smartRecipe.createDefaultRecipe();
  recipe.name = "HH Unicode ✓";
  const imported = smartRecipe.importRecipe(smartRecipe.exportRecipe(recipe));
  assert.equal(imported.name, recipe.name);
  assert.equal(imported.steps.length, 2);
  const link = smartRecipe.createShareLink(recipe, { baseUrl: "https://hh.test/#/dev-tools/developer-recipe", maxLength: 7600 });
  assert.equal(smartRecipe.parseShareLink(link).name, recipe.name);
  assert.throws(() => smartRecipe.createShareLink({ name: "large", steps: Array.from({ length: 40 }, (_, index) => ({ operation: "jsonpath", options: { path: `$.${"x".repeat(200)}${index}` } })) }, { maxLength: 100 }), /quá lớn/);
  assert.throws(() => smartRecipe.importRecipe("{}"), /Định dạng/);
  assert.throws(() => smartRecipe.importRecipe("x".repeat(250001)), /250 KB/);
});

test("persistence is versioned and falls back when localStorage is unavailable", () => {
  const values = new Map();
  const scope = { localStorage: { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) } };
  const saved = smartRecipe.saveStore({ history: [{ input: "{}", types: ["JSON"] }], pins: [], recipes: [] }, scope);
  assert.equal(saved.version, 1);
  assert.equal(smartRecipe.loadStore(scope).history[0].types[0], "JSON");
  assert.ok(values.has(smartRecipe.STORAGE_KEY));
  const unavailable = { get localStorage() { throw new Error("blocked"); } };
  assert.equal(smartRecipe.saveStore({ history: [], pins: [], recipes: [] }, unavailable).version, 1);
});

test("clipboard requires browser capability and respects denied permission", async () => {
  await assert.rejects(() => smartRecipe.readClipboardWithPermission({ navigator: {} }), /không hỗ trợ/);
  await assert.rejects(() => smartRecipe.readClipboardWithPermission({ navigator: { clipboard: { readText: async () => "secret" }, permissions: { query: async () => ({ state: "denied" }) } } }), /từ chối/);
  assert.equal(await smartRecipe.readClipboardWithPermission({ navigator: { clipboard: { readText: async () => "allowed" }, permissions: { query: async () => ({ state: "granted" }) } } }), "allowed");
});

test("workspace contract is semantic accessible responsive and local-first", () => {
  for (const marker of [
    "data-dsr-smart-input", "data-dsr-dropzone", "data-dsr-file", "data-dsr-clipboard", "data-dsr-history", "data-dsr-pin",
    "data-dsr-pipeline", "draggable=\"true\"", "data-dsr-breakpoint", "data-dsr-step-run", "data-dsr-import", "data-dsr-export",
    "aria-live=\"polite\"", "clipboard-read", "indexedDB", "localStorage", "CompressionStream", "DecompressionStream", "cryptoApi.subtle"
  ]) assert.ok(source.includes(marker), `missing ${marker}`);
  assert.match(styles, /@media\(max-width:420px\)/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(styles, /:focus-visible/);
  assert.doesNotMatch(source, /\beval\s*\(|new\s+Function\s*\(/);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
});
