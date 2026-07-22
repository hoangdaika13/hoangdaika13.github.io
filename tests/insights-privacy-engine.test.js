const test = require("node:test");
const assert = require("node:assert/strict");

const analyticsApi = require("../api/platform/summary.js");
const { safeTelemetryEvent, TELEMETRY_TYPES } = analyticsApi.__test;

test("telemetry catalog rejects unpublished events", () => {
  assert.equal(TELEMETRY_TYPES.has("keystroke"), false);
  assert.equal(TELEMETRY_TYPES.has("message_body"), false);
  assert.equal(TELEMETRY_TYPES.has("prompt"), false);
  assert.equal(safeTelemetryEvent({ type: "keystroke", key: "A" }, new Date()), null);
});

test("backend redacts raw input, credentials and JavaScript diagnostics", () => {
  const now = new Date("2026-07-22T12:00:00.000Z");
  const event = safeTelemetryEvent({
    id: "event-1",
    type: "form_submit",
    route: "/analytics?token=secret",
    module: "analytics",
    action: "form-submit",
    label: "private prompt body",
    password: "hunter2",
    token: "private-token",
    message: "email@example.com failed",
    stack: "Error: private form value",
    meta: {
      form: "public-signup-form",
      kind: "form",
      fieldCount: 3,
      durationBucket: "6-30s",
      rawValue: "secret answer",
      prompt: "private prompt",
      privateMessage: "hello"
    }
  }, now);

  assert.equal(event.route, "/analytics");
  assert.equal(event.label, "");
  assert.equal(event.meta.form, "public-signup-form");
  assert.equal(event.meta.fieldCount, 3);
  assert.equal(event.meta.durationBucket, "6-30s");
  assert.equal("rawValue" in event.meta, false);
  assert.equal("prompt" in event.meta, false);
  assert.equal("privateMessage" in event.meta, false);
  assert.equal("password" in event, false);
  assert.equal("token" in event, false);
  assert.equal("message" in event, false);
  assert.equal("stack" in event, false);
});

test("analytics metadata keeps only coarse heatmap, source, vitals and experiment fields", () => {
  const event = safeTelemetryEvent({
    type: "performance",
    meta: {
      region: "middle-center",
      source: "search",
      metric: "lcp",
      value: 2310.4,
      rating: "good",
      errorKind: "runtime",
      experimentId: "hero-cta-v1",
      variant: "B",
      x: 123,
      y: 456,
      referrer: "https://example.com/private?q=secret"
    }
  }, new Date());

  assert.equal(event.meta.region, "middle-center");
  assert.equal(event.meta.source, "search");
  assert.equal(event.meta.metric, "lcp");
  assert.equal(event.meta.value, 2310.4);
  assert.equal(event.meta.variant, "B");
  assert.equal("x" in event.meta, false);
  assert.equal("y" in event.meta, false);
  assert.equal("referrer" in event.meta, false);
});
