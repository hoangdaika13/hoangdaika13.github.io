const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildOpenAIInput,
  normalizeOpenAIModel,
  normalizeReasoningEffort,
  outputSources,
  outputText,
  parseOpenAIKeys,
  runOpenAIResponse
} = require("../utils/openai-provider");

test("OpenAI keys are parsed only from server environment values", () => {
  const keys = parseOpenAIKeys({
    OPENAI_API_KEYS: "sk-project-one-abcdefghijklmnopqrstuvwxyz,\nsk-project-two-abcdefghijklmnopqrstuvwxyz",
    OPENAI_API_KEY: "sk-project-one-abcdefghijklmnopqrstuvwxyz"
  });
  assert.deepEqual(keys, [
    "sk-project-one-abcdefghijklmnopqrstuvwxyz",
    "sk-project-two-abcdefghijklmnopqrstuvwxyz"
  ]);
});

test("OpenAI model and reasoning defaults stay inside the supported GPT-5.6 family", () => {
  assert.equal(normalizeOpenAIModel("openai:gpt-5.6-sol"), "gpt-5.6-sol");
  assert.equal(normalizeOpenAIModel("unknown", { OPENAI_MODEL: "gpt-5.6-luna" }), "gpt-5.6-luna");
  assert.equal(normalizeOpenAIModel("unknown", {}), "gpt-5.6-terra");
  assert.equal(normalizeReasoningEffort("balanced"), "low");
  assert.equal(normalizeReasoningEffort("deep"), "high");
});

test("Responses input supports conversation history and server-sanitized images", () => {
  const input = buildOpenAIInput({
    history: [
      { role: "user", text: "Xin chào" },
      { role: "model", text: "Chào bạn" }
    ],
    attachments: [{ mimeType: "image/png", data: "aGVsbG8=" }],
    prompt: "Phân tích ảnh"
  });
  assert.equal(input[1].role, "assistant");
  assert.equal(input[2].content[0].type, "input_text");
  assert.equal(input[2].content[1].image_url, "data:image/png;base64,aGVsbG8=");
});

test("Responses output text and citations are normalized", () => {
  const response = {
    output: [{
      type: "message",
      content: [{
        type: "output_text",
        text: "Kết quả thật",
        annotations: [{ type: "url_citation", url: "https://example.com/source", title: "Nguồn" }]
      }]
    }]
  };
  assert.equal(outputText(response), "Kết quả thật");
  assert.deepEqual(outputSources(response), [{
    url: "https://example.com/source",
    title: "Nguồn",
    type: "openai-web-search"
  }]);
});

test("OpenAI Responses request keeps the key in Authorization and never in the body", async () => {
  let captured;
  const result = await runOpenAIResponse({
    apiKey: "sk-project-secret-abcdefghijklmnopqrstuvwxyz",
    model: "gpt-5.6-terra",
    prompt: "Viết brief",
    instruction: "Trả lời bằng tiếng Việt.",
    history: [],
    attachments: [],
    reasoningEffort: "low",
    useWebSearch: false,
    safetyIdentifier: "anonymous-safe-id",
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return {
        ok: true,
        headers: { get: () => "req_test" },
        json: async () => ({
          id: "resp_test",
          output: [{ type: "message", content: [{ type: "output_text", text: "Brief hoàn chỉnh", annotations: [] }] }],
          usage: { input_tokens: 12, output_tokens: 8, total_tokens: 20 }
        })
      };
    }
  });
  assert.equal(captured.url, "https://api.openai.com/v1/responses");
  assert.equal(captured.options.headers.Authorization, "Bearer sk-project-secret-abcdefghijklmnopqrstuvwxyz");
  assert.doesNotMatch(captured.options.body, /sk-project-secret/);
  assert.equal(JSON.parse(captured.options.body).store, false);
  assert.equal(result.providerApi, "responses-v1");
  assert.equal(result.output, "Brief hoàn chỉnh");
});
