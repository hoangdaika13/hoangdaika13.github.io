const test = require("node:test");
const assert = require("node:assert/strict");
const dev = require("../graphic-design-dev-ai.js");

test("Dev Mode inspects design values and WCAG contrast", () => {
  const inspected = dev.inspectLayer({ name: "CTA", width: 240, height: 56, fill: "#000000", textColor: "#ffffff" });
  assert.equal(inspected.bounds.width, 240);
  assert.equal(inspected.contrast.aaa, true);
  assert.ok(dev.evaluateContrast("#777777", "#ffffff", 16, false).ratio > 4);
});

test("Design tokens export to CSS, Tailwind and portable JSON", () => {
  const workspace = dev.createDefaultWorkspace();
  assert.match(dev.tokensToCss(workspace.tokens), /--hh-primary:/);
  assert.match(dev.tokensToTailwind(workspace.tokens), /module\.exports/);
  assert.equal(JSON.parse(dev.tokensToJson(workspace.tokens)).format, "hh-design-tokens");
  const snippets = dev.componentSnippets(workspace.layer);
  assert.match(snippets.svg, /<svg/);
  assert.match(snippets.css, /border-radius/);
  assert.match(snippets.html, /aria-labelledby/);
});

test("Controlled AI creates local drafts without mutating source design", () => {
  const workspace = dev.createDefaultWorkspace();
  const before = JSON.stringify(workspace.layer);
  const vector = dev.createDraft("vector", "logo quỹ đạo HH", {});
  const keyframes = dev.createDraft("keyframes", "xoay chậm", {});
  const rig = dev.createDraft("rig", "anime", { model: { width: 800, height: 1200 } });
  assert.equal(vector.status, "draft");
  assert.equal(vector.source, "local-deterministic");
  assert.match(vector.payload.svg, /<svg/);
  assert.equal(keyframes.payload.property, "rotation");
  assert.ok(rig.payload.joints.length >= 16);
  assert.equal(JSON.stringify(workspace.layer), before);
});

test("Layout QA detects overflow, contrast and text risk", () => {
  const report = dev.auditLayout({
    frame: { width: 320, height: 200 },
    layers: [{ id: "bad", name: "Bad card", x: 260, y: 0, width: 200, height: 30, fill: "#ffffff", textColor: "#eeeeee", text: "A".repeat(300) }]
  });
  assert.ok(report.issues.some((issue) => issue.code === "overflow"));
  assert.ok(report.issues.some((issue) => issue.code === "contrast"));
  assert.ok(report.score < 100);
});

test("Controlled media operations always create non-destructive drafts", () => {
  const source = { media: { id: "video-1", duration: 120 }, language: "vi" };
  const before = JSON.stringify(source);
  for (const action of dev.CONTROLLED_AI_ACTIONS) {
    const draft = dev.createDraft(action, "Một nội dung thử nghiệm", source);
    assert.equal(draft.status, "draft");
    assert.equal(draft.overwrite, false);
    assert.equal(draft.action, action);
    assert.equal(draft.payload.overwrite, false);
  }
  assert.equal(JSON.stringify(source), before);
  assert.equal(dev.createDraft("background-remove", "subject", source).payload.requiresProvider, true);
  assert.ok(dev.createDraft("subtitle", "Cảnh một. Cảnh hai.", source).payload.cues.length >= 2);
});

test("provider adapter is server-only, sanitized and cannot overwrite source", async () => {
  assert.throws(() => dev.assertServerAdapter({ apiKey: "secret", generateDraft() {} }), /API key/);
  const requests = [];
  const adapter = async (request) => {
    requests.push(request);
    return { payload: { text: "ok", apiKey: "must-not-leak", svg: '<svg onload="bad()"><script>bad()</script><rect/></svg>' } };
  };
  const context = { media: { id: "image-1" } };
  const draft = await dev.requestProviderDraft(adapter, "thumbnail", "Tạo thumbnail", context);
  assert.equal(requests[0].policy.overwrite, false);
  assert.equal(draft.source, "provider-adapter");
  assert.equal(draft.overwrite, false);
  assert.equal(Object.hasOwn(draft.payload, "apiKey"), false);
  assert.doesNotMatch(draft.payload.svg, /script|onload/i);
  assert.deepEqual(context, { media: { id: "image-1" } });
});
