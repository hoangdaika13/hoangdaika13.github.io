const { randomUUID } = require("node:crypto");

const OPENAI_MODELS = new Set([
  "gpt-5.6",
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna"
]);

function parseOpenAIKeys(env = process.env) {
  const keys = [env.OPENAI_API_KEYS, env.OPENAI_API_KEY]
    .filter(Boolean)
    .flatMap((value) => String(value).split(/[\r\n,;]+/))
    .map((value) => value.trim())
    .filter((value) => value.length >= 20);
  return [...new Set(keys)].slice(0, 20);
}

function normalizeOpenAIModel(value, env = process.env) {
  const requested = String(value || "").trim().replace(/^openai:/, "");
  if (OPENAI_MODELS.has(requested)) return requested;
  const configured = String(env.OPENAI_MODEL || "").trim().replace(/^openai:/, "");
  return OPENAI_MODELS.has(configured) ? configured : "gpt-5.6-terra";
}

function normalizeReasoningEffort(value) {
  const direct = String(value || "").trim().toLowerCase();
  if (["none", "low", "medium", "high", "xhigh", "max"].includes(direct)) return direct;
  if (["fast", "minimal"].includes(direct)) return "low";
  if (["deep", "quality", "cinematic"].includes(direct)) return "high";
  return "low";
}

function buildOpenAIInput({ history = [], attachments = [], prompt = "" }) {
  const input = history.map((message) => ({
    role: message.role === "model" || message.role === "assistant" ? "assistant" : "user",
    content: String(message.text || message.content || "")
  })).filter((message) => message.content);
  input.push({
    role: "user",
    content: [
      { type: "input_text", text: String(prompt || "") },
      ...attachments.map((attachment) => ({
        type: "input_image",
        image_url: `data:${attachment.mimeType};base64,${attachment.data}`,
        detail: "auto"
      }))
    ]
  });
  return input;
}

function outputText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  const parts = [];
  for (const item of data?.output || []) {
    if (item?.type !== "message") continue;
    for (const content of item.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string" && content.text.trim()) {
        parts.push(content.text.trim());
      }
    }
  }
  return parts.join("\n").trim();
}

function outputSources(data) {
  const sources = [];
  const seen = new Set();
  for (const item of data?.output || []) {
    if (item?.type !== "message") continue;
    for (const content of item.content || []) {
      for (const annotation of content?.annotations || []) {
        if (annotation?.type !== "url_citation") continue;
        const url = String(annotation.url || "").trim().slice(0, 1200);
        if (!url || seen.has(url)) continue;
        seen.add(url);
        sources.push({
          url,
          title: String(annotation.title || url).trim().slice(0, 240),
          type: "openai-web-search"
        });
      }
    }
  }
  return sources.slice(0, 20);
}

function safeJson(text) {
  try {
    return JSON.parse(String(text || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    return null;
  }
}

async function runOpenAIResponse({
  apiKey,
  model,
  prompt,
  instruction,
  history,
  attachments,
  reasoningEffort,
  useWebSearch,
  structuredSchema,
  safetyIdentifier,
  fetchImpl = fetch
}) {
  if (!apiKey) {
    const error = new Error("OpenAI API chưa được cấu hình trên máy chủ.");
    error.code = "OPENAI_NOT_CONFIGURED";
    error.status = 503;
    throw error;
  }
  const requestId = randomUUID();
  const body = {
    model: normalizeOpenAIModel(model),
    instructions: String(instruction || ""),
    input: buildOpenAIInput({ history, attachments, prompt }),
    reasoning: { effort: normalizeReasoningEffort(reasoningEffort) },
    text: {
      verbosity: "medium",
      ...(structuredSchema
        ? {
            format: {
              type: "json_schema",
              name: "hh_content_pack",
              strict: true,
              schema: structuredSchema
            }
          }
        : {})
    },
    ...(useWebSearch ? { tools: [{ type: "web_search" }] } : {}),
    ...(safetyIdentifier ? { safety_identifier: String(safetyIdentifier).slice(0, 128) } : {}),
    max_output_tokens: structuredSchema ? 8192 : 4096,
    store: false
  };
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Client-Request-Id": requestId
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(String(data?.error?.message || `OpenAI Responses API lỗi HTTP ${response.status}.`).slice(0, 300));
    error.code = "OPENAI_PROVIDER_ERROR";
    error.status = response.status;
    error.requestId = response.headers?.get?.("x-request-id") || requestId;
    throw error;
  }
  const output = outputText(data);
  if (!output) {
    const refusal = (data?.output || [])
      .flatMap((item) => item?.content || [])
      .find((content) => content?.type === "refusal")?.refusal;
    const error = new Error(String(refusal || "OpenAI không trả về nội dung.").slice(0, 300));
    error.code = refusal ? "OPENAI_REFUSAL" : "OPENAI_EMPTY_RESPONSE";
    error.status = refusal ? 400 : 502;
    throw error;
  }
  return {
    output,
    structured: structuredSchema ? safeJson(output) : null,
    model: normalizeOpenAIModel(model),
    interactionId: String(data.id || "").slice(0, 240),
    usage: data.usage || null,
    sources: outputSources(data),
    providerApi: "responses-v1",
    requestId: response.headers?.get?.("x-request-id") || requestId
  };
}

module.exports = {
  OPENAI_MODELS,
  buildOpenAIInput,
  normalizeOpenAIModel,
  normalizeReasoningEffort,
  outputSources,
  outputText,
  parseOpenAIKeys,
  runOpenAIResponse
};
