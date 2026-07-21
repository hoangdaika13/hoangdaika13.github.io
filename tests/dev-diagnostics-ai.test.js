const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const dev = require("../dev-diagnostics-ai.js");
const FAKE_GOOGLE_KEY = ["AI", "za", "abcdefghijklmnopqrstuvwxyz123456"].join("");

test("exposes two stable DEV tools and versioned local state", () => {
  assert.equal(dev.STORAGE_KEY, "hh.dev.diagnostics-ai.v1");
  assert.deepEqual(dev.TOOLS.map((tool) => tool.id), ["web-diagnostics", "ai-developer"]);
  assert.equal(dev.defaultState("ai-developer").activeTool, "ai-developer");
  assert.equal(dev.defaultState("unknown").activeTool, "web-diagnostics");
});

test("redacts common secrets from text, nested payload and serialized state", () => {
  const raw = [
    "Authorization: Bearer abc.def.ghi",
    `apiKey=${FAKE_GOOGLE_KEY}`,
    "token=AQ.Ab8RN6THIS_SHOULD_NOT_SURVIVE",
    "mongodb+srv://user:password@example.mongodb.net/db"
  ].join("\n");
  const redacted = dev.redactText(raw);
  assert.doesNotMatch(redacted, /abcdefghijklmnopqrstuvwxyz|SHOULD_NOT_SURVIVE|:password@/);
  assert.match(redacted, /REDACTED/);

  const state = dev.defaultState("ai-developer");
  state.ai.input = raw;
  state.ai.history.push({ apiKey: "secret-value", title: "Bearer hidden.token.value" });
  const serialized = dev.serializeState(state);
  assert.doesNotMatch(serialized, /secret-value|SHOULD_NOT_SURVIVE|:password@/);
  assert.match(serialized, /REDACTED/);
});

test("URL and header inspection stay truthful about browser and CORS visibility", () => {
  const parsed = dev.normalizeUrl("https://example.com/path", "https://hh.local/");
  assert.equal(parsed.valid, true);
  assert.equal(parsed.sameOrigin, false);
  assert.equal(parsed.secure, true);

  const visible = dev.inspectHeaders({
    "Content-Security-Policy": "default-src 'self'; object-src 'none'",
    "Access-Control-Allow-Origin": "https://hh.local",
    "X-Content-Type-Options": "nosniff"
  }, { crossOrigin: true });
  assert.equal(visible.visibility, "accessible-response-headers");
  assert.equal(visible.complete, false);
  assert.equal(visible.cors.readable, true);
  assert.match(visible.cors.note, /CORS/);
  assert.equal(visible.csp.directives["object-src"][0], "'none'");

  const blocked = dev.inspectHeaders(null, { crossOrigin: true, fetchError: true });
  assert.equal(blocked.cors.readable, false);
  assert.match(blocked.cors.note, /CORS|mạng|chứng chỉ/);
  assert.doesNotMatch(blocked.cors.note, /website bị sập/i);
});

test("cookie inspection explicitly excludes HttpOnly and attributes", () => {
  const report = dev.inspectCookieString("theme=dark; session=visible-part");
  assert.equal(report.count, 2);
  assert.equal(report.complete, false);
  assert.equal(report.scope, "document-cookie-only");
  assert.match(report.note, /HttpOnly/);
  assert.deepEqual(report.visible[0], { name: "theme", valueLength: 4 });
});

test("local Lighthouse-style checklist scores measurable DOM facts without impersonating Lighthouse", () => {
  const report = dev.runLocalChecklist({
    url: "https://hh.example/app",
    title: "HH Developer Workspace",
    description: "Bộ công cụ chẩn đoán hiệu năng, bảo mật và khả năng truy cập chạy cục bộ trong trình duyệt.",
    lang: "vi",
    viewportMeta: true,
    h1Count: 1,
    imageCount: 4,
    imageAltMissing: 0,
    labelMissing: 0,
    canonical: "https://hh.example/app",
    manifest: true,
    serviceWorker: true,
    domNodes: 700
  });
  assert.equal(report.source, "local-lighthouse-style");
  assert.equal(report.lighthouse, false);
  assert.ok(report.score >= 90);
  assert.equal(report.items.find((item) => item.id === "https").status, "pass");

  const risky = dev.runLocalChecklist({ url: "http://example.com", h1Count: 3, imageCount: 2, imageAltMissing: 2, labelMissing: 4, domNodes: 5000 });
  assert.ok(risky.score < report.score);
  assert.equal(risky.items.find((item) => item.id === "dom-size").status, "fail");
});

test("asset analyzer reports size, imports, dynamic code and image weight locally", () => {
  const script = dev.analyzeTextAsset([
    "import helper from './helper.js';",
    "const result = eval(source); // TODO remove",
    "console.log(result);",
    "//# sourceMappingURL=app.js.map"
  ].join("\n"), { name: "app.js", type: "text/javascript", size: 2048 });
  assert.equal(script.kind, "script");
  assert.deepEqual(script.imports, ["./helper.js"]);
  assert.equal(script.consoleCalls, 1);
  assert.equal(script.sourceMapHint, true);
  assert.ok(script.warnings.some((warning) => /thực thi mã động/.test(warning)));
  assert.equal(script.estimateOnly, true);

  const image = dev.analyzeAsset({ name: "hero.png", type: "image/png", size: 900 * 1024, width: 4000, height: 2200, displayWidth: 800 });
  assert.equal(image.kind, "image");
  assert.ok(image.warnings.length >= 2);
});

test("dependency scan parses package JSON but never claims registry or vulnerability verification", () => {
  const report = dev.analyzePackageJson(JSON.stringify({
    name: "hh-app",
    scripts: { postinstall: "node scripts/setup.js" },
    dependencies: { react: "^19.0.0", shared: "1.0.0" },
    devDependencies: { vitest: "^3.0.0", shared: "1.0.0" }
  }));
  assert.equal(report.valid, true);
  assert.equal(report.totals.all, 3);
  assert.equal(report.registryChecked, false);
  assert.match(report.note, /Không truy vấn registry/);
  assert.ok(report.warnings.some((warning) => /postinstall/.test(warning)));
  assert.ok(report.dependencies.find((item) => item.name === "shared").duplicated);

  const invalid = dev.analyzePackageJson("{bad json");
  assert.equal(invalid.valid, false);
});

test("performance ratings use Core Web Vitals thresholds", () => {
  assert.equal(dev.performanceRating("LCP", 2400), "good");
  assert.equal(dev.performanceRating("LCP", 3500), "needs-improvement");
  assert.equal(dev.performanceRating("LCP", 5000), "poor");
  assert.equal(dev.performanceRating("CLS", 0.08), "good");
  assert.equal(dev.performanceRating("INP", 300), "needs-improvement");
  assert.equal(dev.performanceRating("unknown", 10), "unknown");
});

test("PerformanceObserver monitor degrades cleanly when the browser API is unavailable", () => {
  const monitor = dev.createPerformanceMonitor({ scope: { performance: { getEntriesByType: () => [] } } });
  assert.equal(monitor.supported.observer, false);
  assert.equal(monitor.supported.webVitals, false);
  assert.deepEqual(monitor.getMetrics(), {});
  assert.doesNotThrow(() => monitor.stop());
});

test("developer input detection and local explain modes are deterministic and labelled", () => {
  assert.equal(dev.detectDeveloperInput("/^hello\\s+world$/i"), "regex");
  assert.equal(dev.detectDeveloperInput("SELECT * FROM users"), "sql");
  assert.equal(dev.detectDeveloperInput("TypeError: x is undefined\n at app.js:10:2"), "stack");

  const regex = dev.createLocalAIDraft("explain", "/^(?<name>\\w+)$/i", {});
  const sql = dev.createLocalAIDraft("explain", "DELETE FROM users", {});
  assert.equal(regex.source, "local-deterministic");
  assert.equal(regex.sourceLabel, "Phân tích cục bộ tất định");
  assert.equal(regex.overwrite, false);
  assert.match(regex.title, /Regex/);
  assert.match(sql.sections.flatMap((section) => section.items).join(" "), /WHERE/);
});

test("AI assistant creates tests, mocks, docs and code review as unapplied drafts", () => {
  const source = "function total(items) { return items.reduce((sum, value) => sum + value, 0); }";
  const before = source;
  const unit = dev.createLocalAIDraft("test", source, { filename: "math.js" });
  const mock = dev.createLocalAIDraft("mock", '{"name":"","active":false}', {});
  const docs = dev.createLocalAIDraft("docs", "POST /api/projects", {});
  const review = dev.createLocalAIDraft("review", "eval(source);\nconsole.log(result);", {});
  for (const draft of [unit, mock, docs, review]) {
    assert.equal(draft.status, "draft");
    assert.equal(draft.applied, false);
    assert.equal(draft.overwrite, false);
  }
  assert.match(unit.replacement, /node:test/);
  assert.equal(JSON.parse(mock.replacement).active, true);
  assert.match(docs.replacement, /POST|API|\/api\/projects/);
  assert.match(review.summary, /Phát hiện/);
  assert.equal(source, before);
});

test("server adapter receives a redacted draft-only request and response secrets stay redacted", async () => {
  const calls = [];
  const draft = await dev.requestServerDraft({
    mode: "review",
    input: `const key = '${FAKE_GOOGLE_KEY}';`,
    context: { apiKey: "must-not-leak", filename: "app.js" }
  }, {
    adapter: async (request) => {
      calls.push(request);
      return {
        title: "Server review",
        summary: "Authorization: Bearer server.secret.value",
        replacement: "console.info('safe');",
        token: "response-secret"
      };
    }
  });
  const requestText = JSON.stringify(calls[0]);
  const draftText = JSON.stringify(draft);
  assert.equal(calls[0].policy.overwrite, false);
  assert.doesNotMatch(requestText, /abcdefghijklmnopqrstuvwxyz|must-not-leak/);
  assert.doesNotMatch(draftText, /server\.secret\.value|response-secret/);
  assert.equal(draft.source, "server-adapter");
  assert.equal(draft.overwrite, false);
  assert.equal(draft.applied, false);
});

test("Apply requires an explicit action and does not mutate the original draft", () => {
  const draft = dev.createLocalAIDraft("mock", '{"id":0}', {});
  const before = JSON.stringify(draft);
  assert.throws(() => dev.applyDraft(draft, {}), /Apply rõ ràng/);
  let appliedPayload = null;
  const applied = dev.applyDraft(draft, { explicit: true, onApply(value) { appliedPayload = value; } });
  assert.equal(applied.applied, true);
  assert.equal(appliedPayload.id, draft.id);
  assert.equal(JSON.stringify(draft), before);
});

test("remote URL inspector preserves a useful CORS failure state", async () => {
  const report = await dev.inspectRemoteUrl("https://cross-origin.example/app", {
    baseUrl: "https://hh.example/",
    fetch: async () => { throw new TypeError("Failed to fetch"); }
  });
  assert.equal(report.ok, false);
  assert.equal(report.url.sameOrigin, false);
  assert.equal(report.headers.cors.readable, false);
  assert.match(report.headers.cors.note, /CORS|mạng|chứng chỉ/);
});

test("workspace source keeps secrets server-side and CSS includes responsive/accessibility contracts", () => {
  const root = path.join(__dirname, "..");
  const js = fs.readFileSync(path.join(root, "dev-diagnostics-ai.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "dev-diagnostics-ai.css"), "utf8");
  const forbidden = [["BEGIN", "PRIVATE", "KEY"].join(" "), ["sk", "live", "credential"].join("-")];
  assert.equal(forbidden.some((value) => js.includes(value)), false);
  assert.match(js, /\/api\/ai\/dev/);
  assert.match(js, /globalScope\.HHDevDiagnosticsAI = api/);
  assert.match(css, /@media \(max-width: 430px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible/);
});
