const test = require("node:test");
const assert = require("node:assert/strict");
const tools = require("../dev-regex-database.js");

test("exports the requested global contract and versioned state key", () => {
  assert.equal(globalThis.HHDevRegexDatabase, tools);
  assert.equal(tools.STORAGE_KEY, "hh.dev.regex-database.v1");
  assert.equal(tools.FORMAT, "hh-dev-regex-database");
  assert.deepEqual(tools.tools().map((tool) => tool.id), ["regex-studio", "database-playground"]);
});

test("JavaScript regex runs real matches, groups, highlight segments and replace preview", () => {
  const result = tools.runRegex({ pattern: "(?<name>[A-Z][a-z]+):(?<score>\\d+)", flags: "g", engine: "javascript", input: "An:9 Binh:7", replacement: "$<name>=$<score>" });
  assert.equal(result.executed, true);
  assert.equal(result.matches.length, 2);
  assert.deepEqual(result.matches[0].namedGroups, { name: "An", score: "9" });
  assert.ok(result.segments.some((segment) => segment.match && segment.text === "An:9"));
  assert.equal(result.replacementPreview, "An=9 Binh=7");
});

test("zero-length global matches terminate and respect match limits", () => {
  const result = tools.runRegex({ pattern: "(?=a)", flags: "g", engine: "javascript", input: "aaa", maxMatches: 2 });
  assert.equal(result.matches.length, 2);
  assert.equal(result.truncated, true);
});

test("PCRE and RE2 only report compatibility and never pretend to execute", () => {
  const pcre = tools.runRegex({ pattern: "\\Kvalue", engine: "pcre", input: "value" });
  const re2 = tools.runRegex({ pattern: "(?<=a)b", engine: "re2", input: "ab" });
  assert.equal(pcre.executed, false);
  assert.equal(re2.executed, false);
  assert.match(pcre.compatibility.warnings.join(" "), /không chạy/i);
  assert.match(re2.compatibility.warnings.join(" "), /không hỗ trợ lookbehind/i);
});

test("regex risk scanner catches and blocks nested quantifiers before realtime execution", () => {
  assert.equal(tools.regexRisk("(a+)+$").level, "high");
  const result = tools.runRegex({ pattern: "(a+)+$", flags: "g", input: "a".repeat(20), engine: "javascript" });
  assert.equal(result.blocked, true);
  assert.equal(result.executed, false);
});

test("Vietnamese explanation and pattern library are useful", () => {
  const explanation = tools.explainRegex("^\\d{10}$");
  assert.ok(explanation.some((token) => /chữ số/.test(token.explanation)));
  assert.ok(explanation.some((token) => /lặp từ 10/.test(token.explanation)));
  const phone = tools.REGEX_LIBRARY.find((item) => item.id === "phone-vn");
  assert.equal(tools.runRegex({ ...phone, engine: "javascript", input: phone.sample }).matches.length, 1);
});

test("regex test cases return explicit pass and fail states", () => {
  const cases = tools.runRegexCases({ pattern: "^\\d+$", cases: [{ input: "123", expected: true }, { input: "abc", expected: false }, { input: "123", expected: false }] });
  assert.deepEqual(cases.map((item) => item.passed), [true, true, false]);
});

test("SQL formatter preserves literals and creates readable clauses", () => {
  const formatted = tools.formatSQL("select id,name from users where note='from where' and active=1 order by name desc;");
  assert.match(formatted, /^SELECT id, name\nFROM users\nWHERE note = 'from where'/);
  assert.match(formatted, /ORDER BY name DESC/);
  assert.match(formatted, /'from where'/);
});

test("SQL advisory warns about destructive statements and missing WHERE", () => {
  const report = tools.analyzeSQL("DELETE FROM users;");
  assert.equal(report.destructive, true);
  assert.ok(report.warnings.some((warning) => warning.code === "missing-where"));
  assert.ok(report.advisory.some((line) => /phân tích tĩnh/.test(line)));
});

test("parameterized select builder validates identifiers", () => {
  const query = tools.buildSelectQuery({ table: "users", columns: ["id", "name"], filters: [{ column: "active", operator: "=", value: true }], orderBy: { column: "name", direction: "desc" }, limit: 20 });
  assert.equal(query.sql, "SELECT id, name FROM users WHERE active = ? ORDER BY name DESC LIMIT 20;");
  assert.deepEqual(query.params, [true]);
  assert.throws(() => tools.buildSelectQuery({ table: "users; DROP TABLE users" }), /không hợp lệ/);
});

test("CSV parser supports quoted commas and tabular import infers schema", () => {
  const rows = tools.parseCSV('name,note,score\n"An","hello, world",9\nBinh,ok,7.5');
  assert.equal(rows[0].note, "hello, world");
  const schema = tools.inferSchema("students", rows);
  assert.equal(schema.columns.find((column) => column.name === "score").type, "REAL");
});

test("schema normalizes and exports DDL", () => {
  const schema = tools.normalizeSchema({ tables: [{ name: "users", columns: [{ name: "id", type: "INTEGER", primaryKey: true, nullable: false }, { name: "name", type: "TEXT" }] }] });
  const sql = tools.schemaToSQL(schema);
  assert.match(sql, /CREATE TABLE users/);
  assert.match(sql, /id INTEGER PRIMARY KEY NOT NULL/);
});

test("in-memory database truthfully runs only supported SELECT subset", () => {
  const database = new tools.InMemoryDatabase({ students: [{ id: 1, name: "An", score: 9 }, { id: 2, name: "Bình", score: 7 }] });
  const result = database.execute("SELECT id, name FROM students WHERE score >= 8 ORDER BY name ASC LIMIT 10;");
  assert.equal(result.engine, "in-memory-subset");
  assert.deepEqual(result.rows, [{ id: 1, name: "An" }]);
  assert.throws(() => database.execute("DELETE FROM students"), /chỉ chạy SELECT/i);
});

test("in-memory database binds query-builder placeholders", () => {
  const database = new tools.InMemoryDatabase({ users: [{ id: 1, status: "active" }, { id: 2, status: "blocked" }] });
  const built = tools.buildSelectQuery({ table: "users", filters: [{ column: "status", operator: "=", value: "active" }] });
  const result = database.execute(built.sql, built.params);
  assert.deepEqual(result.rows, [{ id: 1, status: "active" }]);
});

test("SQLite adapter reports fallback unless a real runtime is present", () => {
  const unavailable = tools.createSQLiteAdapter(null);
  assert.equal(unavailable.available, false);
  assert.match(unavailable.reason, /Chưa nạp SQLite WASM/);
  const fakeSqlJs = { Database: class { exec() { return [{ columns: ["ok"], values: [[1]] }]; } close() {} } };
  const adapter = tools.createSQLiteAdapter(fakeSqlJs);
  assert.equal(adapter.available, true);
  assert.deepEqual(adapter.execute("SELECT 1").rows, [{ ok: 1 }]);
});

test("Mongo builder only emits a query and rejects connection secrets", () => {
  const query = tools.buildMongoQuery({ collection: "projects", operation: "find", filter: { status: "active" }, projection: { name: 1 }, limit: 10 });
  assert.equal(query.executable, false);
  assert.match(query.expression, /db\.projects\.find/);
  assert.throws(() => tools.buildMongoQuery({ collection: "users", filter: { password: "secret" } }), /Không nhận bí mật/);
});

test("state is bounded, normalized and persists under the versioned key", () => {
  const state = tools.normalizeState({ activeTool: "database-playground", regex: { history: Array.from({ length: 80 }, (_, index) => ({ index })) } });
  assert.equal(state.regex.history.length, 30);
  const memoryStorage = { value: null, getItem(key) { assert.equal(key, tools.STORAGE_KEY); return this.value; }, setItem(key, value) { assert.equal(key, tools.STORAGE_KEY); this.value = value; } };
  assert.equal(tools.writeStorage(memoryStorage, state), true);
  assert.equal(tools.readStorage(memoryStorage).activeTool, "database-playground");
});

test("workspace CSS includes mobile and reduced-motion contracts", () => {
  const fs = require("node:fs");
  const css = fs.readFileSync(require("node:path").join(__dirname, "..", "dev-regex-database.css"), "utf8");
  assert.match(css, /@media\(max-width:600px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /focus-visible/);
  assert.doesNotMatch(css, /min-width:\s*[4-9]\d\dpx/);
});
