const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "creative-os.js"), "utf8");
const css = fs.readFileSync(path.join(root, "creative-os.css"), "utf8");

test("Creative OS exposes twenty linked production workspaces", () => {
  for (const id of ["overview", "project", "brief", "moodboard", "storyboard", "world-bible", "workflow", "ai-director", "prompt-studio", "repurpose", "brand", "audio-dubbing", "prototype", "review", "collaboration", "publishing", "analytics", "rights", "providers", "marketplace"]) {
    assert.match(source, new RegExp(`id: ["']${id}["']|${JSON.stringify(id)}:`));
  }
  assert.match(source, /window\.HHCreativeOS\s*=/);
  assert.match(source, /ensureStore/);
  assert.match(source, /store\.subscribe/);
});

test("Creative OS loads engines lazily and retains the existing creation tools", () => {
  assert.match(source, /loadScript\(engine\.js\)/);
  assert.match(source, /loadStyle\(engine\.css\)/);
  for (const route of ["ai-center", "ai-script", "creator-studio", "media-center", "ai-automation"]) assert.match(source, new RegExp(route));
  assert.doesNotMatch(source, /eval\(|new Function/);
});

test("Creative OS shell is mobile and reduced-motion ready", () => {
  assert.match(css, /@media\(max-width:560px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /overflow-x:auto/);
});
