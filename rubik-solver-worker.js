"use strict";

// cubejs 1.3.2 (MIT), unmodified browser builds. Keeping its search tables in
// this disposable worker makes cancel immediate and leaves navigation free.
importScripts("./vendor/rubik-cubejs-cube.js?v=1", "./vendor/rubik-cubejs-solve.js?v=1");

self.addEventListener("message", ({ data }) => {
  try {
    if (typeof data !== "string" || !/^[URFDLB]{54}$/.test(data)) throw new Error("invalid facelets");
    self.Cube.initSolver();
    self.postMessage({ solution: self.Cube.fromString(data).solve() });
  } catch {
    self.postMessage({ error: true });
  }
});
