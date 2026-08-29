const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "creative-os.js"), "utf8");
const css = fs.readFileSync(path.join(root, "creative-os.css"), "utf8");

test("Creative OS exposes all thirty-five linked specialist workspaces", () => {
  for (const id of ["overview", "project", "ai-center", "ai-script", "brief", "moodboard", "storyboard", "world-bible", "creator-studio", "media-center", "workflow", "ai-director", "prompt-studio", "ai-automation", "repurpose", "brand", "audio-dubbing", "prototype", "review", "collaboration", "publishing", "analytics", "rights", "providers", "marketplace", "idea-lab", "naming-studio", "copy-studio", "writing-room", "campaign-planner", "photo-planner", "motion-planner", "podcast-studio", "three-d-planner", "portfolio-builder"]) {
    assert.match(source, new RegExp(`id: ["']${id}["']|${JSON.stringify(id)}:`));
  }
  assert.match(source, /window\.HHCreativeOS\s*=/);
  assert.match(source, /ensureStore/);
  assert.match(source, /store\.subscribe/);
  assert.match(source, /toolStorageKey/);
  assert.match(source, /scopedStorage/);
  assert.match(source, /VAI TRÒ DUY NHẤT/i);
});

test("Creative OS loads engines lazily and embeds the existing creation tools", () => {
  assert.match(source, /loadScript\(engine\.js\)/);
  assert.match(source, /loadStyle\(engine\.css\)/);
  for (const route of ["ai-center", "ai-script", "creator-studio", "media-center", "ai-automation"]) assert.match(source, new RegExp(route));
  assert.doesNotMatch(source, /eval\(|new Function/);
});

test("Creative OS shell is mobile and reduced-motion ready", () => {
  assert.match(css, /@media\s*\(max-width:\s*560px\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /overflow:\s*hidden/);
  assert.match(css, /\.creative-os__body\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
});
