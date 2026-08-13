"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

global.HHSocialMediaCore = require("../social-media-tools-core.js");
const capabilities = require("../social-media-tool-capabilities.js");

test("V6 gives every social tool a dedicated non-empty task workflow", () => {
  const audit = capabilities.validateCatalog(global.HHSocialMediaCore.TOOL_CATALOG);
  assert.deepEqual(audit, { missing:[], extra:[], actionless:[] });
  assert.equal(capabilities.VERSION, 6);
  assert.equal(Object.keys(capabilities.CAPABILITIES).length, 61);
  for (const tool of global.HHSocialMediaCore.TOOL_CATALOG) {
    const workflow = capabilities.forTool(tool);
    assert.equal(workflow.toolId, tool.id);
    assert.ok(workflow.actions.length >= 2, `${tool.id} needs at least two meaningful tasks`);
    assert.ok(workflow.actions.every((item) => item.handler && item.label && item.icon));
  }
});
test("priority tools expose specialized operations instead of one shared template", () => {
  const labels = (id) => capabilities.forTool(id).actions.map((item) => item.label);
  assert.deepEqual(labels("alt-text-checker"), ["Kiểm tra đầu vào", "Phân tích lỗi Alt Text", "Áp dụng Alt Text", "Xuất lịch sử/báo cáo"]);
  assert.ok(labels("color-palette").includes("Trích bảng màu"));
  assert.ok(labels("instagram-filter").includes("Xuất ảnh đã lọc"));
  assert.ok(labels("publishing-queue").includes("Preflight xuất bản"));
  assert.notDeepEqual(labels("youtube-embed"), labels("whatsapp-link"));
});

test("provider operations are explicit and never imply automatic permission grants", () => {
  for (const id of ["instagram-owned-media", "analytics", "community-inbox", "competitor-research", "social-listening"]) {
    const actions = capabilities.forTool(id).actions;
    assert.ok(actions.some((item) => item.handler === "connect"), `${id} must expose official connection`);
    assert.ok(!actions.some((item) => /tự cấp|auto grant|bỏ qua duyệt/i.test(item.label)));
  }
});
