const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { webcrypto } = require("node:crypto");

const root = path.resolve(__dirname, "..");
const modulePath = path.join(root, "dev-api-studio.js");
const cssPath = path.join(root, "dev-api-studio.css");
const source = fs.readFileSync(modulePath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const studio = require(modulePath);

test("exposes a versioned UMD API for both requested DEV tools", () => {
  assert.equal(studio.SCHEMA, "hh.dev.api-studio.v1");
  assert.equal(studio.STORAGE_KEY, studio.SCHEMA);
  assert.equal(studio.VERSION, 1);
  assert.equal(globalThis.HHDevApiStudio, studio);
  assert.equal(studio.supports("api-studio"), true);
  assert.equal(studio.supports("mock-api"), true);
  assert.equal(studio.supports("not-real"), false);
  assert.deepEqual(studio.tools().map((tool) => tool.id), ["api-studio", "mock-api"]);
  assert.equal(typeof studio.mount, "function");
  assert.equal(typeof studio.cleanup, "function");
});

test("parses params and headers without accepting comments as keys", () => {
  assert.deepEqual(studio.normalizePairs("Accept: application/json\n# ignored\npage=2\nX-Empty"), [
    { key: "Accept", value: "application/json", enabled: true, secret: false },
    { key: "page", value: "2", enabled: true, secret: false },
    { key: "X-Empty", value: "", enabled: true, secret: false }
  ]);
  assert.deepEqual(studio.pairsToObject("q: api studio\nlimit: 10"), { q: "api studio", limit: "10" });
});

test("safe templates support environment and deterministic built-ins without eval", () => {
  const rendered = studio.applyTemplate("{{baseUrl}}/users?at={{$timestamp}}&id={{$uuid}}&missing={{none}}", { baseUrl: "https://api.test" }, {
    now: new Date("2026-07-21T00:00:00.000Z"),
    uuid: "fixed-id",
    randomInt: 7
  });
  assert.equal(rendered, "https://api.test/users?at=1784592000&id=fixed-id&missing={{none}}");
  const variables = { baseUrl: "https://api.test" };
  const request = studio.applyPreRequest({
    url: "{{baseUrl}}/{{resource}}",
    bodyText: "{\"at\":\"{{$isoTimestamp}}\"}",
    preRequest: [{ type: "set-variable", key: "resource", value: "users" }]
  }, variables, { now: new Date("2026-07-21T00:00:00.000Z") });
  assert.equal(variables.resource, "users");
  assert.equal(request.bodyText, "{\"at\":\"2026-07-21T00:00:00.000Z\"}");
  assert.doesNotMatch(source, /\beval\s*\(|new Function\s*\(/);
});

test("buildRequest covers REST params, JSON, forms, GraphQL and browser cookie notes", () => {
  const rest = studio.buildRequest({
    method: "POST",
    protocol: "rest",
    url: "{{baseUrl}}/items",
    paramsText: "page: 2",
    headersText: "X-Client: HH",
    cookiesText: "session=manual",
    credentials: "include",
    bodyMode: "json",
    bodyText: "{\"name\":\"Demo\"}",
    auth: { type: "api-key", apiKeyName: "X-Key", apiKeyLocation: "header" }
  }, { environment: { baseUrl: "https://api.example.com" }, authSecret: "runtime-secret" });
  assert.equal(rest.url, "https://api.example.com/items?page=2");
  assert.equal(rest.fetchOptions.method, "POST");
  assert.equal(rest.fetchOptions.headers.get("x-client"), "HH");
  assert.equal(rest.fetchOptions.headers.get("x-key"), "runtime-secret");
  assert.equal(rest.fetchOptions.credentials, "include");
  assert.equal(rest.fetchOptions.body, "{\"name\":\"Demo\"}");
  assert.match(rest.notes[0], /Cookie header/);

  const graphql = studio.buildRequest({
    method: "POST",
    protocol: "graphql",
    url: "https://api.example.com/graphql",
    bodyText: "query User($id: ID!) { user(id: $id) { name } }",
    graphqlVariables: "{\"id\":\"42\"}"
  });
  assert.deepEqual(JSON.parse(graphql.fetchOptions.body), {
    query: "query User($id: ID!) { user(id: $id) { name } }",
    variables: { id: "42" }
  });

  const form = studio.buildRequest({ method: "POST", url: "https://api.example.com/form", bodyMode: "form", bodyText: "name: HH\nmode: dev" });
  assert.equal(form.fetchOptions.body.toString(), "name=HH&mode=dev");
  assert.throws(() => studio.buildRequest({ method: "POST", url: "https://api.example.com", bodyMode: "json", bodyText: "{" }), /JSON body/);
});

test("adapter states are truthful when Socket.IO or MQTT runtime is missing", () => {
  const socket = studio.adapterStatus("socketio", {});
  const mqtt = studio.adapterStatus("mqtt", {});
  assert.equal(socket.available, false);
  assert.equal(socket.connected, false);
  assert.match(socket.message, /Chưa nạp Socket.IO runtime/);
  assert.equal(mqtt.available, false);
  assert.equal(mqtt.connected, false);
  assert.match(mqtt.message, /Chưa nạp MQTT.js/);
  assert.equal(studio.buildRequest({ protocol: "socketio", url: "https://socket.example.com" }).adapterRequired, true);
});

test("executeHttp records status, timing, bytes, JSON and declarative assertions", async () => {
  let ticks = 100;
  const fetchImpl = async (url, options) => {
    assert.equal(url, "https://api.example.com/health");
    assert.equal(options.method, "GET");
    return new Response(JSON.stringify({ ok: true, service: "hh" }), {
      status: 200,
      headers: { "content-type": "application/json", "x-request-id": "r-1" }
    });
  };
  const prepared = studio.buildRequest({
    url: "https://api.example.com/health",
    assertions: [
      { source: "status", operator: "equals", expected: 200 },
      { source: "header", path: "x-request-id", operator: "equals", expected: "r-1" },
      { source: "json", path: "$.service", operator: "equals", expected: "hh" },
      { source: "time", operator: "less-than", expected: 100 }
    ]
  });
  const response = await studio.executeHttp(prepared, { fetchImpl, now: () => { ticks += 12; return ticks; } });
  assert.equal(response.status, 200);
  assert.equal(response.elapsedMs, 12);
  assert.equal(response.json.service, "hh");
  assert.ok(response.size > 0);
  assert.equal(response.assertions.every((item) => item.pass), true);
});

test("executeHttp exposes abort and CORS/network failures clearly", async () => {
  await assert.rejects(() => studio.executeHttp(studio.buildRequest({ url: "https://api.example.com" }), {
    fetchImpl: async () => { const error = new Error("aborted"); error.name = "AbortError"; throw error; }
  }), /đã được hủy/);
  await assert.rejects(() => studio.executeHttp(studio.buildRequest({ url: "https://api.example.com" }), {
    fetchImpl: async () => { throw new TypeError("Failed to fetch"); }
  }), /CORS/);
});

test("WebSocket and SSE wrappers expose send/close lifecycle", () => {
  class FakeWebSocket {
    static OPEN = 1;
    constructor(url) { this.url = url; this.readyState = 1; this.listeners = {}; this.sent = []; }
    addEventListener(type, handler) { this.listeners[type] = handler; }
    send(value) { this.sent.push(value); }
    close(code, reason) { this.closed = { code, reason }; }
  }
  const statuses = [];
  const ws = studio.connectWebSocket("wss://socket.example.com", { WebSocketImpl: FakeWebSocket, onStatus: (value) => statuses.push(value) });
  ws.socket.listeners.open();
  ws.send("ping");
  ws.close();
  assert.deepEqual(statuses, ["connected"]);
  assert.deepEqual(ws.socket.sent, ["ping"]);
  assert.equal(ws.socket.closed.code, 1000);

  class FakeEventSource {
    constructor(url, options) { this.url = url; this.options = options; this.listeners = {}; }
    addEventListener(type, handler) { this.listeners[type] = handler; }
    close() { this.closed = true; }
  }
  const sse = studio.connectSSE("https://events.example.com", { EventSourceImpl: FakeEventSource, withCredentials: true });
  assert.equal(sse.source.options.withCredentials, true);
  sse.close();
  assert.equal(sse.source.closed, true);
});

test("OAuth PKCE S256 follows the RFC challenge vector", async () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const result = await studio.generatePkce({ verifier, subtle: webcrypto.subtle });
  assert.equal(result.method, "S256");
  assert.equal(result.challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});

test("versioned store strips secret values from persistence and export", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const store = studio.createStore(storage);
  const state = store.load();
  state.environments[0].variables.push({ key: "privateToken", value: "must-not-persist", secret: true, enabled: true });
  state.requests[0].auth = { type: "bearer", accessToken: "must-not-persist" };
  const saved = store.save(state);
  assert.equal(saved.environments[0].variables.find((item) => item.key === "privateToken").value, "");
  assert.equal(saved.requests[0].auth.accessToken, "");
  assert.doesNotMatch(values.get(studio.STORAGE_KEY), /must-not-persist/);
  assert.doesNotMatch(store.export(saved), /must-not-persist/);
  assert.throws(() => store.export(saved, { includeSecrets: true }), /không được xuất/);
});

test("workspace helpers manage folders, collections, environments and requests immutably", () => {
  const original = studio.createStore(null).load();
  const folder = studio.upsertFolder(original, { id: "folder-api", name: "API production" });
  const collection = studio.upsertCollection(folder.state, { id: "collection-api", name: "Production", folderIds: [folder.item.id] });
  const environment = studio.upsertEnvironment(collection.state, {
    id: "environment-production",
    name: "Production",
    variables: [{ key: "baseUrl", value: "https://api.example.com", enabled: true }, { key: "token", value: "secret", secret: true, enabled: true }]
  });
  const request = studio.upsertRequest(environment.state, { id: "request-users", name: "Users", method: "GET", url: "{{baseUrl}}/users" }, collection.item.id);
  assert.equal(original.folders.some((item) => item.id === "folder-api"), false);
  assert.equal(request.state.folders.some((item) => item.id === "folder-api"), true);
  assert.equal(request.state.collections.find((item) => item.id === "collection-api").requestIds.includes("request-users"), true);
  assert.equal(request.state.environments.find((item) => item.id === "environment-production").variables.find((item) => item.key === "token").value, "");
  const removed = studio.removeWorkspaceItem(request.state, "requests", "request-users");
  assert.equal(removed.requests.some((item) => item.id === "request-users"), false);
  assert.equal(removed.collections.find((item) => item.id === "collection-api").requestIds.includes("request-users"), false);
});

test("store round-trips valid exported workspaces and rejects invalid or oversized input", () => {
  const store = studio.createStore(null);
  const state = store.load();
  state.folders.push({ id: "folder-tests", name: "Tests" });
  const exported = store.export(state);
  const imported = store.import(exported);
  assert.ok(imported.folders.some((folder) => folder.id === "folder-tests"));
  assert.throws(() => store.import("not-json"), /không hợp lệ/);
  assert.throws(() => store.import("x".repeat(studio.MAX_TEXT_BYTES + 1)), /vượt giới hạn/);
});

test("OpenAPI JSON creates routes with examples and path parameters", async () => {
  const specification = studio.parseOpenApi(JSON.stringify({
    openapi: "3.0.3",
    paths: {
      "/users/{id}": {
        get: {
          summary: "Read user",
          responses: {
            200: { description: "OK", content: { "application/json": { example: { id: 42, name: "HH" } } } },
            404: { description: "Missing", content: { "application/json": { example: { error: "not found" } } } }
          }
        }
      }
    }
  }));
  const routes = studio.routesFromOpenApi(specification);
  assert.equal(routes.length, 2);
  assert.equal(routes[0].method, "GET");
  assert.equal(studio.pathMatches("/users/{id}", "/users/42"), true);
  const response = await studio.simulateMock(routes, { method: "GET", path: "/users/42" }, { wait: false });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { id: 42, name: "HH" });
});

test("OpenAPI YAML subset recognizes paths, methods, status and scalar examples", () => {
  const yaml = `openapi: 3.0.3
paths:
  /health:
    get:
      summary: Health check
      responses:
        '200':
          description: Service ready
          example: {"status":"ok"}`;
  const routes = studio.routesFromOpenApi(studio.parseOpenApi(yaml));
  assert.equal(routes.length, 1);
  assert.equal(routes[0].path, "/health");
  assert.equal(routes[0].status, 200);
  assert.deepEqual(routes[0].examples[0], { status: "ok" });
});

test("mock simulator supports delay metadata, random examples, error status and 404", async () => {
  const routes = [{ id: "r", method: "POST", path: "/jobs", status: 500, delayMs: 250, random: true, enabled: true, headers: {}, examples: [{ value: 1 }, { value: 2 }] }];
  const response = await studio.simulateMock(routes, { method: "POST", path: "/jobs" }, { wait: false, randomValue: 0.9 });
  assert.equal(response.ok, false);
  assert.equal(response.status, 500);
  assert.equal(response.delayMs, 250);
  assert.deepEqual(response.body, { value: 2 });
  const missing = await studio.simulateMock(routes, { method: "GET", path: "/missing" }, { wait: false });
  assert.equal(missing.status, 404);
});

test("collection runner reports assertion success and failure without stopping by default", async () => {
  const report = await studio.runCollection([
    { id: "one", name: "Health", assertions: [{ source: "status", operator: "equals", expected: 200 }] },
    { id: "two", name: "Missing", assertions: [{ source: "status", operator: "equals", expected: 200 }] }
  ], {
    execute: async (item) => ({ ok: item.id === "one", status: item.id === "one" ? 200 : 404, body: { id: item.id } })
  });
  assert.equal(report.total, 2);
  assert.equal(report.passed, 1);
  assert.equal(report.failed, 1);
  assert.equal(report.results[0].assertions[0].pass, true);
  assert.equal(report.results[1].assertions[0].pass, false);
});

test("snippet generator supports five languages and omits Authorization secrets", () => {
  const request = {
    method: "POST",
    url: "https://api.example.com/items",
    headersText: "Content-Type: application/json",
    bodyMode: "json",
    bodyText: "{\"name\":\"HH\"}",
    auth: { type: "bearer" }
  };
  for (const language of ["javascript", "python", "php", "java", "csharp"]) {
    const snippet = studio.generateSnippet(request, language);
    assert.match(snippet, /api\.example\.com/);
    assert.doesNotMatch(snippet, /Bearer|Authorization|runtime-secret/);
  }
});

test("source and styles enforce UI, security, mobile and reduced-motion contracts", () => {
  for (const token of [
    "API Studio Pro", "Mock Server & API Testing", "REST", "GraphQL", "WebSocket", "SSE", "Socket.IO", "MQTT",
    "OAuth 2.0 PKCE", "Secret: memory-only", "Không lưu / không export", "OpenAPI", "Collection Runner",
    "data-api-run", "data-api-abort", "data-import-openapi", "data-run-collection", "aria-live=\"polite\""
  ]) assert.ok(source.includes(token), `missing ${token}`);
  assert.doesNotMatch(source, /innerHTML\s*=\s*(?:event|request|response|error)\./);
  assert.doesNotMatch(source, /localStorage\.setItem\([^,]+,\s*[^)]*(?:token|secret|password)/i);
  assert.match(css, /@media \(max-width: 420px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /grid-template-columns: 1fr/);
});
