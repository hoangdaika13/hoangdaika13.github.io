const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "script.js"), "utf8");

test("Creative legacy embedding renders the requested module independently of stale filters", () => {
  assert.match(source, /const embeddedView = platformEmbedding\?\.view \|\| "";/);
  assert.match(source, /embeddedView\s*\? modules\.filter\(\(module\) => module\.id === embeddedView\)\s*: filteredModules\(\)/);

  const mountStart = source.indexOf("const embedding = {", source.indexOf("window.HHCreativeLegacyTools"));
  const assign = source.indexOf("platformEmbedding = embedding;", mountStart);
  const renderMissing = source.indexOf("if (!grid.querySelector", assign);
  assert.ok(mountStart >= 0 && assign > mountStart && renderMissing > assign, "embedding must be active before a filtered grid is rebuilt");
});

test("a stale Creative unmount handle cannot restore a newer embedded tool", () => {
  assert.match(source, /restoreEmbeddedPlatform = \(expectedEmbedding = platformEmbedding\)/);
  assert.match(source, /platformEmbedding !== expectedEmbedding\) return false/);
  assert.match(source, /restoreEmbeddedPlatform\(embedding\);/);
});

test("Creative restore has a durable home, preserves scroll, and never leaves focus in hidden content", () => {
  assert.match(source, /const platformHomeParent = platformRoot\?\.parentNode \|\| null/);
  assert.match(source, /connectedAnchorParent \|\| connectedHomeParent \|\| byId\("top"\)/);
  assert.match(source, /focusedInsidePlatform/);
  assert.match(source, /activeElement\?\.blur\?\.\(\)/);
  assert.match(source, /returnFocus\.focus\?\.\(\{ preventScroll: true \}\)/);
  assert.match(source, /node\.scrollTop = top/);
  assert.match(source, /node\.scrollLeft = left/);
});
