const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Creative workspace keeps all 25 routes while using only the global sidebar navigator", () => {
  const source = read("creative-os.js");
  const ids = [...source.matchAll(/\{ id: "([^"]+)", group:/g)].map((match) => match[1]);
  assert.equal(ids.length, 25);
  assert.equal(new Set(ids).size, 25);
  assert.match(source, /data-cos-workspace/);
  assert.doesNotMatch(source, /creative-os__navigator|data-cos-navigator|data-cos-search|data-cos-tool-count/);
  assert.doesNotMatch(source, /creative-os__legacy/);
  assert.doesNotMatch(source, /data-cos-galaxy/);
});

test("Creative workspace uses a fixed full-width single-column stage with only internal overflow", () => {
  const css = read("creative-os.css");
  assert.match(css, /\.app-main\.app-main--creative-fixed\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /body\.app-creative-route \.app-breadcrumb,[\s\S]*body\.app-creative-route \.app-context-bar\s*\{[^}]*display:\s*none !important/s);
  assert.match(css, /\.app-main--creative-fixed \.app-workspace\.app-workspace--creative-fixed\s*\{[^}]*height:\s*100%/s);
  assert.match(css, /\.creative-os\s*\{[^}]*height:\s*100%[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.creative-os__body\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s);
  assert.match(css, /\.creative-os__workspace\s*\{[^}]*overflow-x:\s*hidden[^}]*overflow-y:\s*auto/s);
  assert.match(css, /\.creative-os__workspace > :where\([\s\S]*width:\s*100% !important[\s\S]*max-width:\s*none !important/s);
  assert.match(css, /@media \(max-width: 560px\)/);
});

test("Creative routes preserve the global sidebar because the duplicate inner navigator is removed", () => {
  const source = read("creative-os.js");
  assert.doesNotMatch(source, /sidebarWasCollapsed|app-sidebar-collapsed|data-shell-toggle/);
  assert.doesNotMatch(source, /creative-os__navigator|data-cos-nav-toggle/);
});

test("five established tools are embedded through the existing functional adapter", () => {
  const shell = read("creative-os.js");
  const router = read("script.js");
  for (const id of ["ai-center", "ai-script", "creator-studio", "media-center", "ai-automation"]) {
    assert.match(shell, new RegExp(`"${id}": \\{ api: "HHCreativeLegacyTools" \\}`));
  }
  assert.match(router, /window\.HHCreativeLegacyTools\s*=\s*\{/);
  assert.match(router, /host\.replaceChildren\(platformRoot\)/);
  assert.match(router, /mountScriptStudio/);
  assert.match(router, /new Set\(creativeStudioItems\.map\(\(item\) => item\.id\)\)/);
});
