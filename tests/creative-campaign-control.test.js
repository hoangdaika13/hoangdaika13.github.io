const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const workflow = require(path.join(root, "creative-ai-workflow.js"));
const core = require(path.join(root, "creative-os-core.js"));
const source = fs.readFileSync(path.join(root, "creative-ai-workflow.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "creative-ai-workflow.css"), "utf8");

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
}

function campaignProject() {
  const project = workflow.createDefaultProject();
  project.name = "HH Launch";
  project.brief = {
    ...project.brief,
    product: "HH Creative OS",
    audience: "Nhà sáng tạo video",
    goal: "Ra mắt chiến dịch có kiểm soát",
    platform: "YouTube"
  };
  project.campaign.startDate = "2030-03-10";
  project.campaign.channels = ["youtube", "tiktok", "instagram"];
  project.campaign.brandKit = {
    voice: "Rõ ràng, tích cực",
    colors: ["#67e8f9", "#f472b6"],
    fonts: ["Inter"],
    requiredTerms: ["HH"],
    bannedTerms: ["đảm bảo 100%"]
  };
  project.campaign.characterBible = [{ id: "hero", name: "Mia", anchors: ["tóc xanh", "áo hồng"], voice: "ấm", locked: true }];
  return project;
}

test("Campaign Control exports deterministic planning and QA contracts", () => {
  for (const method of [
    "normalizeCampaign", "buildCampaignPlan", "createContentExperiment", "checkBrandCompliance",
    "checkCharacterConsistency", "auditCampaignAsset", "evaluateCampaignReadiness"
  ]) assert.equal(typeof workflow[method], "function", `${method} must be exported`);
  assert.deepEqual([...workflow.CAMPAIGN_CHANNELS], ["youtube", "tiktok", "instagram", "facebook", "website", "podcast"]);
});

test("one campaign plan creates bounded multi-platform slots and an honest A/B draft", () => {
  const first = workflow.buildCampaignPlan(campaignProject());
  const second = workflow.buildCampaignPlan(campaignProject());
  assert.equal(first.campaign.calendar.length, 9);
  assert.deepEqual(
    first.campaign.calendar.map(({ channel, scheduledAt, contentType }) => ({ channel, scheduledAt, contentType })),
    second.campaign.calendar.map(({ channel, scheduledAt, contentType }) => ({ channel, scheduledAt, contentType }))
  );
  assert.equal(first.campaign.experiments.length, 1);
  assert.equal(first.campaign.experiments[0].variants.length, 2);
  assert.equal(first.campaign.experiments[0].status, "draft");
  assert.ok(first.campaign.calendar.every((slot) => slot.status === "planned"));
});

test("Brand and character QA reports concrete missing rules instead of claiming vision AI", () => {
  const project = campaignProject();
  const brand = workflow.checkBrandCompliance(project, "HH giúp bạn sáng tạo nhanh hơn");
  assert.equal(brand.passed, true);
  assert.equal(brand.score, 100);
  const rejected = workflow.checkBrandCompliance(project, "Đảm bảo 100% kết quả");
  assert.equal(rejected.passed, false);
  assert.deepEqual(rejected.missingRequired, ["HH"]);
  assert.deepEqual(rejected.bannedMatches, ["đảm bảo 100%"]);

  const character = workflow.checkCharacterConsistency(project, "Mia", "Mia có tóc xanh nhưng mặc áo trắng");
  assert.equal(character.consistent, false);
  assert.deepEqual(character.missingAnchors, ["áo hồng"]);
  assert.match(character.notice, /adapter thị giác/i);
});

test("auditing persists a sanitized report and readiness exposes the next unfinished gate", () => {
  let project = workflow.buildCampaignPlan(campaignProject());
  const audited = workflow.auditCampaignAsset(project, {
    content: "HH giúp nhà sáng tạo video làm nội dung tốt hơn",
    characterName: "Mia",
    characterDescription: "Mia có tóc xanh và áo hồng"
  });
  project = audited.project;
  assert.equal(audited.report.score, 100);
  assert.equal(project.campaign.lastAudit.score, 100);
  const readiness = workflow.evaluateCampaignReadiness(project);
  assert.equal(readiness.score, 65);
  assert.equal(readiness.ready, false);
  assert.match(readiness.nextAction, /Pipeline/i);
});

test("Creative Core adapter keeps one project id and synchronizes brand, character rules and calendar", () => {
  const store = core.createStore({ storage: memoryStorage() });
  const shared = store.createProject({ name: "Shared Campaign", brief: { product: "HH" } });
  const adapter = workflow.createStoreAdapter(store, shared.id);
  let project = campaignProject();
  project.id = shared.id;
  project = workflow.buildCampaignPlan(project);
  const result = adapter.write(project);
  const state = store.getState();
  const saved = state.projects.find((item) => item.id === shared.id);
  assert.equal(result.shared, true);
  assert.equal(state.activeProjectId, shared.id);
  assert.equal(saved.workflows.aiWorkflow.id, shared.id);
  assert.deepEqual(saved.brand.colors, ["#67e8f9", "#f472b6"]);
  assert.equal(saved.world.characterConsistency[0].name, "Mia");
  assert.equal(saved.publishing.length, 9);
  assert.ok(saved.publishing.every((item) => item.metadata.source === "creative-ai-workflow"));
  assert.equal(adapter.read().campaign.calendar.length, 9);
});

test("Campaign Control UI is interactive, escaped, responsive and reduced-motion aware", () => {
  for (const contract of [
    "data-hhcaw-campaign-form", "data-hhcaw-experiment-form", "data-hhcaw-audit-form",
    "CAMPAIGN CONTROL", "QUALITY GATES", "A/B Content Lab", "Brand & Character QA",
    "form.getAll(\"channels\")", "escapeHtml", "aria-labelledby"
  ]) assert.match(source, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(source, /autoPublished:\s*true/);
  assert.match(styles, /\.hhcaw-campaign/);
  assert.match(styles, /@media \(max-width: 420px\)/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /:focus-visible/);
});
