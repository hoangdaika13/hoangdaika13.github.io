const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const dataSecurity = require("../dev-data-security.js");

const encodePart = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

test("module exposes the two requested tools and versioned local state", () => {
  assert.deepEqual(dataSecurity.TOOL_IDS, ["json-data-lab", "security-encoding"]);
  assert.equal(dataSecurity.STORAGE_KEY, "hh.dev.data-security.v1");
  assert.equal(dataSecurity.VERSION, 1);
  assert.equal(dataSecurity.supports("json-data-lab"), true);
  assert.equal(dataSecurity.supports("other"), false);
  assert.deepEqual(dataSecurity.tools().map((tool) => tool.id), dataSecurity.TOOL_IDS);
  assert.equal(typeof dataSecurity.mount, "function");
  assert.equal(typeof dataSecurity.unmount, "function");
});

test("format detection recognizes practical JSON, CSV, XML, YAML and TOML inputs", () => {
  assert.equal(dataSecurity.detectFormat('{"ok":true}'), "json");
  assert.equal(dataSecurity.detectFormat("name,age\nHoang,23"), "csv");
  assert.equal(dataSecurity.detectFormat("<root><ok>true</ok></root>"), "xml");
  assert.equal(dataSecurity.detectFormat("name: Hoang\nskills:\n  - JS"), "yaml");
  assert.equal(dataSecurity.detectFormat('[server]\nport = 3000'), "toml");
});

test("data parsers cover quoted CSV, nested YAML, TOML sections and safe XML", () => {
  assert.deepEqual(dataSecurity.parseCsv('name,note\n"Hoang","a,b"\nAn,true'), [
    { name: "Hoang", note: "a,b" },
    { name: "An", note: true }
  ]);
  assert.deepEqual(dataSecurity.parseYaml("user:\n  name: Hoang\n  roles:\n    - admin\n    - editor"), {
    user: { name: "Hoang", roles: ["admin", "editor"] }
  });
  assert.deepEqual(dataSecurity.parseToml("title = 'HH'\n[server]\nport = 3000\nsecure = true"), {
    title: "HH", server: { port: 3000, secure: true }
  });
  assert.deepEqual(dataSecurity.parseXml("<root><item>1</item><item>2</item><empty/></root>"), {
    root: { item: [1, 2], empty: "" }
  });
  assert.throws(() => dataSecurity.parseXml('<!DOCTYPE root [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><root>&xxe;</root>'), /DOCTYPE và ENTITY/);
});

test("conversion produces usable JSON, CSV, XML, YAML and TOML", () => {
  const source = [{ id: 1, name: "Hoang, HH", active: true }, { id: 2, name: "An", active: false }];
  const csv = dataSecurity.stringifyData(source, "csv");
  assert.match(csv, /"Hoang, HH"/);
  assert.deepEqual(dataSecurity.parseData(csv, "csv"), source);
  const xml = dataSecurity.stringifyData({ profile: { id: 1, name: "HH & Co" } }, "xml");
  assert.match(xml, /HH &amp; Co/);
  assert.deepEqual(dataSecurity.parseData(xml, "xml"), { profile: { id: 1, name: "HH & Co" } });
  assert.match(dataSecurity.stringifyData({ user: { active: true } }, "yaml"), /user:\n  active: true/);
  assert.match(dataSecurity.stringifyData({ server: { port: 3000 } }, "toml"), /\[server\]\nport = 3000/);
  assert.equal(dataSecurity.convertData("a,b\n1,2", "csv", "json"), '[\n  {\n    "a": 1,\n    "b": 2\n  }\n]');
});

test("JSONPath subset and JMESPath-lite support properties, indices, wildcard and recursive lookup", () => {
  const value = { users: [{ name: "Hoang", role: { id: 1 } }, { name: "An", role: { id: 2 } }], meta: { name: "Workspace" } };
  assert.deepEqual(dataSecurity.jsonPathQuery(value, "$.users[*].name"), ["Hoang", "An"]);
  assert.equal(dataSecurity.jsonPathQuery(value, "$.users[1].role.id"), 2);
  assert.deepEqual(dataSecurity.jsonPathQuery(value, "$..name"), ["Hoang", "An", "Workspace"]);
  assert.deepEqual(dataSecurity.jmesPathLite(value, "users[].role.id"), [1, 2]);
  assert.throws(() => dataSecurity.jmesPathLite(value, "users[?active]"), /JMESPath-lite/);
});

test("tree, table and diff models are deterministic and bounded", () => {
  const value = [{ user: { name: "Hoang" }, active: true }, { user: { name: "An" }, active: false }];
  assert.deepEqual(dataSecurity.flattenRows(value), [
    { "user.name": "Hoang", active: true },
    { "user.name": "An", active: false }
  ]);
  assert.ok(dataSecurity.treeRows(value).some((row) => row.path === "$[0].user.name"));
  assert.deepEqual(dataSecurity.diffValues({ a: 1, keep: true }, { a: 2, add: "x", keep: true }), [
    { type: "changed", path: "$.a", before: 1, after: 2 },
    { type: "added", path: "$.add", after: "x" }
  ]);
  assert.equal(dataSecurity.treeRows({ a: { b: { c: 1 } } }, { maxNodes: 2 }).length, 2);
});

test("schema inference, subset validation and sample generation work together", () => {
  const value = { id: 12, name: "Hoang", active: true, tags: ["dev"] };
  const schema = dataSecurity.inferSchema(value);
  assert.equal(schema.type, "object");
  assert.equal(schema.properties.id.type, "integer");
  assert.equal(dataSecurity.validateSchema(value, schema).valid, true);
  const invalid = dataSecurity.validateSchema({ id: "wrong" }, {
    type: "object",
    required: ["id", "name"],
    properties: { id: { type: "integer", minimum: 1 }, name: { type: "string", minLength: 2 } }
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => error.keyword === "type"));
  assert.ok(invalid.errors.some((error) => error.keyword === "required"));
  assert.deepEqual(dataSecurity.sampleFromSchema({
    type: "object",
    properties: { count: { type: "integer", minimum: 5 }, state: { enum: ["draft", "live"] } }
  }), { count: 5, state: "draft" });
});

test("large JSON processor has a correct fallback when Worker is unavailable", async () => {
  const result = await dataSecurity.processLargeJson('{"rows":[1,2,3]}', "format", { threshold: Number.MAX_SAFE_INTEGER });
  assert.equal(result.worker, false);
  assert.equal(result.result, '{\n  "rows": [\n    1,\n    2,\n    3\n  ]\n}');
});

test("JWT inspector reports expiry and never claims signature verification", () => {
  const token = `${encodePart({ alg: "HS256", typ: "JWT" })}.${encodePart({ sub: "user-1", exp: 100, nbf: 10 })}.signature`;
  const inspected = dataSecurity.inspectJwt(token, 200);
  assert.equal(inspected.header.alg, "HS256");
  assert.equal(inspected.payload.sub, "user-1");
  assert.equal(inspected.timing.expired, true);
  assert.equal(inspected.signature.present, true);
  assert.equal(inspected.signature.verified, false);
  assert.match(inspected.warning, /chưa được xác minh/i);
});

test("hash and AES-GCM/PBKDF2 operations use Web Crypto and round-trip locally", async () => {
  const sha = await dataSecurity.digestBytes("HH", "SHA-256");
  assert.equal(sha, "a417aa4975c55a9b975ccd869a6444593fee6fff2868bf7a5811509f66b7224d");
  const file = { name: "demo.txt", size: 2, type: "text/plain", arrayBuffer: async () => Uint8Array.from([72, 72]).buffer };
  const batch = await dataSecurity.hashFiles([file], ["SHA-1", "SHA-256"]);
  assert.equal(batch[0].hashes["SHA-256"], sha);
  const encrypted = await dataSecurity.aesEncrypt("Nội dung riêng tư", "strong-password", { iterations: 100000 });
  assert.equal(encrypted.algorithm, "AES-256-GCM");
  assert.notEqual(encrypted.data, "Nội dung riêng tư");
  assert.equal(await dataSecurity.aesDecrypt(encrypted, "strong-password"), "Nội dung riêng tư");
  await assert.rejects(() => dataSecurity.aesDecrypt(encrypted, "wrong-password"), /mật khẩu sai|dữ liệu đã bị thay đổi/);
});

test("RSA-OAEP key generation supports PEM export/import and local round-trip", async () => {
  const pair = await dataSecurity.rsaGenerateKeyPair({ modulusLength: 2048 });
  assert.match(pair.publicKey, /BEGIN PUBLIC KEY/);
  assert.match(pair.privateKey, /BEGIN PRIVATE KEY/);
  const ciphertext = await dataSecurity.rsaEncrypt("HH RSA", pair.publicKey);
  assert.equal(await dataSecurity.rsaDecrypt(ciphertext, pair.privateKey), "HH RSA");
  const structure = dataSecurity.inspectPem(pair.publicKey);
  assert.equal(structure.label, "PUBLIC KEY");
  assert.equal(structure.der.sequence, true);
  assert.equal(structure.der.lengthMatches, true);
  assert.ok(structure.structure.nodeCount >= 2);
  assert.equal(structure.structure.nodes[0].name, "SEQUENCE");
  assert.equal(structure.verified, false);
  assert.match(structure.note, /không xác minh/i);
});

test("secret scanner identifies and redacts common secret shapes", () => {
  const source = [
    "api_key = 'this-is-a-sensitive-value'",
    "postgres://admin:password@example.test/database",
    "-----BEGIN PRIVATE KEY-----\nQUJDRA==\n-----END PRIVATE KEY-----"
  ].join("\n");
  const findings = dataSecurity.scanSecrets(source);
  assert.ok(findings.some((finding) => finding.type === "assigned-secret"));
  assert.ok(findings.some((finding) => finding.type === "connection-string"));
  assert.ok(findings.some((finding) => finding.type === "private-key"));
  const redacted = dataSecurity.redactSecrets(source);
  assert.doesNotMatch(redacted, /this-is-a-sensitive-value|postgres:\/\/admin|BEGIN PRIVATE KEY/);
  assert.match(redacted, /REDACTED/);
});

test("CSP builder creates a header and warns about unsafe directives", () => {
  const safe = dataSecurity.buildCsp({ "default-src": ["'self'"], "script-src": ["'self'"] });
  assert.match(safe.header, /default-src 'self'/);
  assert.equal(safe.warnings.length, 0);
  const unsafe = dataSecurity.buildCsp({ "script-src": ["'self'", "'unsafe-eval'", "*"] });
  assert.ok(unsafe.warnings.some((warning) => warning.includes("unsafe-eval")));
  assert.ok(unsafe.warnings.some((warning) => warning.includes("quá rộng")));
});

test("persistent state strips passwords, keys, tokens and payload content", () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) };
  dataSecurity.storageWrite({
    preferences: { activeTool: "security-encoding", password: "no-store", apiKey: "no-store", theme: "dark" },
    history: [{ action: "aes", summary: "local", token: "no-store" }]
  }, storage);
  const raw = memory.get(dataSecurity.STORAGE_KEY);
  assert.doesNotMatch(raw, /no-store|password|apiKey|token/);
  const state = dataSecurity.storageRead(storage);
  assert.equal(state.preferences.activeTool, "security-encoding");
  assert.equal(state.preferences.theme, "dark");
});

test("source and CSS preserve local-only truthfulness, accessibility and responsive contracts", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "dev-data-security.js"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "..", "dev-data-security.css"), "utf8");
  assert.match(source, /Không tải dữ liệu lên server/);
  assert.match(source, /Không tự xác minh chữ ký/);
  assert.match(source, /không xác minh chuỗi tin cậy X\.509/);
  assert.match(source, /autocomplete="new-password"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /data-ds-dropzone/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /min-width:\s*0/);
});
