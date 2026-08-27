"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("Kim Liên mobile sidebar sheet clears the bottom dock when collapsed", () => {
  const css = fs.readFileSync(path.join(root, "kim-lien-shell.css"), "utf8");

  // The sheet is bottom-anchored above a 68px dock.  A 105% translation can
  // leave a sliver on short viewports, so the closed state must move by its
  // full height plus the dock offset and stop receiving pointer events.
  assert.match(
    css,
    /transform:\s*translateY\(calc\(100%\s*\+\s*69px\s*\+\s*var\(--sheet-drag-y,\s*0px\)\)\)/,
    "collapsed sheet should clear its own height and mobile dock"
  );
  assert.match(
    css,
    /html\[data-hh-theme="kim-lien"\]\s+body\.app-sidebar-collapsed\s+\.app-sidebar,\s*\n?\s*body\.hh-kim-lien\.app-sidebar-collapsed\s+\.app-sidebar\s*\{[^}]*transform:\s*translateY\(calc\(100%\s*\+\s*69px\s*\+\s*var\(--sheet-drag-y,\s*0px\)\)\)\s*!important[^}]*visibility:\s*hidden[^}]*pointer-events:\s*none/,
    "closed sheet must not intercept the bottom navigation"
  );
  assert.match(
    css,
    /body\.hh-kim-lien\.app-sidebar-collapsed\s+\.app-sidebar\.is-sheet-dragging\s*\{[^}]*transform:\s*translateY\(var\(--sheet-drag-y,\s*0px\)\)\s*!important[^}]*visibility:\s*visible[^}]*pointer-events:\s*auto/,
    "explicit drag state should retain the mobile sheet gesture"
  );
});
