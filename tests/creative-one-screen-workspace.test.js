const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Creative workspace keeps all 25 tools in one accordion navigator", () => {
  const source = read("creative-os.js");
  const ids = [...source.matchAll(/\{ id: "([^"]+)", group:/g)].map((match) => match[1]);
  assert.equal(ids.length, 25);
  assert.equal(new Set(ids).size, 25);
  for (const contract of ["data-cos-group", "data-cos-search", "data-cos-view", "data-cos-workspace", "data-cos-tool-count"]) {
    assert.match(source, new RegExp(contract));
  }
  assert.doesNotMatch(source, /creative-os__legacy/);
  assert.doesNotMatch(source, /data-cos-galaxy/);
});

test("Creative workspace uses a fixed two-column shell with only internal overflow", () => {
  const css = read("creative-os.css");
  assert.match(css, /\.app-main\.app-main--creative-fixed\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /body\.app-creative-route \.app-breadcrumb,[\s\S]*body\.app-creative-route \.app-context-bar\s*\{[^}]*display:\s*none !important/s);
  assert.match(css, /\.app-main--creative-fixed \.app-workspace\.app-workspace--creative-fixed\s*\{[^}]*height:\s*100%/s);
  assert.match(css, /\.creative-os\s*\{[^}]*height:\s*100%[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.creative-os__body\s*\{[^}]*grid-template-columns:\s*260px minmax\(0, 1fr\)/s);
  assert.match(css, /\.creative-os__workspace\s*\{[^}]*overflow:\s*auto/s);
  assert.match(css, /\.creative-os__workspace > :where\([\s\S]*width:\s*100% !important[\s\S]*max-width:\s*none !important/s);
  assert.match(css, /@media \(max-width: 560px\)/);
});

test("every Creative route temporarily collapses the duplicate global sidebar", () => {
  const source = read("creative-os.js");
  assert.match(source, /sidebarWasCollapsed/);
  assert.match(source, /classList\?\.add\?\.\("app-sidebar-collapsed"\)/);
  assert.match(source, /sidebarWasCollapsed === false[\s\S]*classList\?\.remove\?\.\("app-sidebar-collapsed"\)/);
  assert.match(source, /\[data-shell-toggle\]/);
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
