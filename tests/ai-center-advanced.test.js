const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "ai-center-advanced.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "ai-center-advanced.css"), "utf8");
const advanced = require("../ai-center-advanced.js");

test("AI Center advanced resolves dynamic template variables safely", () => {
  const template = "Viết về {{ chủ_đề }} cho {{đối_tượng}} và nhắc lại {{chủ_đề}}.";
  assert.deepEqual(advanced.extractVariables(template), ["chủ_đề", "đối_tượng"]);
  assert.equal(
    advanced.fillTemplate(template, { chủ_đề: "AI an toàn", đối_tượng: "sinh viên" }),
    "Viết về AI an toàn cho sinh viên và nhắc lại AI an toàn."
  );
  assert.equal(advanced.fillTemplate("{{thiếu}}", {}), "[thiếu]");
});

test("AI model router selects quality and fast models by task", () => {
  assert.deepEqual(advanced.routeModel("coding", "Fix JavaScript", "auto"), {
    taskType: "coding",
    model: "gemini-3.5-flash",
    reason: "Tác vụ cần suy luận, cấu trúc hoặc kiểm chứng sâu."
  });
  assert.equal(advanced.routeModel("summarize", "Tóm tắt tài liệu", "auto").model, "gemini-3.1-flash-lite");
  assert.equal(advanced.routeModel("auto", "Phân tích API và rủi ro", "auto").taskType, "coding");
  assert.equal(advanced.routeModel("research", "Nghiên cứu", "local").model, "local");
});

test("AI usage telemetry distinguishes provider counts from estimates", () => {
  assert.equal(advanced.estimateTokens("12345678"), 2);
  assert.deepEqual(advanced.normalizeUsage({ totalTokenCount: 40, promptTokenCount: 15, candidatesTokenCount: 25 }, "a", "b"), {
    inputTokens: 15,
    outputTokens: 25,
    totalTokens: 40,
    estimated: false
  });
  const estimate = advanced.normalizeUsage(null, "12345678", "1234");
  assert.deepEqual(estimate, { inputTokens: 2, outputTokens: 1, totalTokens: 3, estimated: true });
  assert.deepEqual(advanced.normalizeUsage({ inputTokens: 4, outputTokens: 6, totalTokens: 10, estimated: false }, "", ""), {
    inputTokens: 4,
    outputTokens: 6,
    totalTokens: 10,
    estimated: false
  });
});

test("AI local state is bounded and strips oversized history", () => {
  const oversized = "x".repeat(advanced.limits.MAX_OUTPUT_LENGTH + 500);
  const state = advanced.normalizeState({
    runs: Array.from({ length: advanced.limits.MAX_RUNS + 4 }, (_, runIndex) => ({
      id: `run-${runIndex}`,
      title: `Run ${runIndex}`,
      taskType: "analysis",
      versions: Array.from({ length: advanced.limits.MAX_VERSIONS + 3 }, (_, versionIndex) => ({
        id: `version-${runIndex}-${versionIndex}`,
        prompt: oversized,
        output: oversized,
        model: "gemini-3.5-flash",
        status: "success"
      }))
    })),
    templates: Array.from({ length: advanced.limits.MAX_TEMPLATES + 3 }, (_, index) => ({ id: `template-${index}`, name: "T", template: "{{x}}" }))
  });
  assert.equal(state.runs.length, advanced.limits.MAX_RUNS);
  assert.equal(state.runs[0].versions.length, advanced.limits.MAX_VERSIONS);
  assert.equal(state.runs[0].versions[0].prompt.length, advanced.limits.MAX_PROMPT_LENGTH);
  assert.equal(state.runs[0].versions[0].output.length, advanced.limits.MAX_OUTPUT_LENGTH);
  assert.equal(state.templates.length, advanced.limits.MAX_TEMPLATES);
});

test("AI run telemetry aggregates version latency and tokens", () => {
  const telemetry = advanced.telemetryFromRuns([
    { versions: [
      { status: "success", latencyMs: 100, usage: { totalTokens: 20 } },
      { status: "error", latencyMs: 500, usage: { totalTokens: 0 } }
    ] },
    { versions: [{ status: "success", latencyMs: 300, usage: { totalTokens: 40 } }] }
  ]);
  assert.deepEqual(telemetry, { runs: 2, versions: 3, success: 2, tokenTotal: 60, averageLatency: 200 });
});

test("AI Center advanced mounts independently and uses the existing backend contract", () => {
  assert.match(source, /document\.querySelectorAll\("\[data-ai-center\]"\)/);
  assert.match(source, /new MutationObserver\(mountAll\)/);
  assert.match(source, /\/api\/modules\/ai-center\/actions/);
  assert.match(source, /data-aica-stop/);
  assert.match(source, /data-aica-retry/);
  assert.match(source, /data-aica-copy-run/);
  assert.match(source, /data-aica-export-run/);
  assert.match(source, /Input → AI/);
  assert.match(source, /Phân tích đầu vào/);
  assert.match(source, /Review/);
  assert.match(source, /Export/);
  assert.doesNotMatch(source, /GEMINI_API_KEY|GOOGLE_AI_API_KEY|x-goog-api-key/);
  assert.doesNotMatch(source, /streaming|text\/event-stream|EventSource/);
});

test("AI Center advanced styling is responsive and motion-safe", () => {
  assert.match(styles, /\.ai-center-advanced/);
  assert.match(styles, /\.aica-compare-grid/);
  assert.match(styles, /\.aica-workflow-rail/);
  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
});
