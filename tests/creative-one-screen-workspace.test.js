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
  assert.match(css, /\.creative-os\s*\{[^}]*height:\s*100%[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.creative-os__body\s*\{[^}]*grid-template-columns:\s*260px minmax\(0, 1fr\)/s);
  assert.match(css, /\.creative-os__workspace\s*\{[^}]*overflow:\s*auto/s);
  assert.match(css, /@media \(max-width: 560px\)/);
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
