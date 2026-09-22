const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const layerOne = require("../galaxy-layer-one.js");
const shellSource = read("galaxy-layer-one.js");
const rendererSource = read("galaxy-workspace-renderer.mjs");
const worldStyles = read("galaxy-layer-one-worlds.css");
const loaderSource = read("performance-loader.js");
const serviceWorkerSource = read("sw.js");

const WORKSPACE_ROUTES = Object.freeze([
  "/galaxy/ai", "/galaxy/music", "/galaxy/video", "/galaxy/creator",
  "/galaxy/games", "/galaxy/dev", "/galaxy/learning", "/galaxy/community",
  "/galaxy/tools", "/galaxy/analytics", "/galaxy/settings"
]);

function count(markup, pattern) {
  return (String(markup).match(pattern) || []).length;
}

test("every functional Galaxy route declares exactly one lazy WebGL world host", () => {
  for (const route of WORKSPACE_ROUTES) {
    const markup = layerOne.viewMarkup(route, {});
    assert.equal(count(markup, /\bdata-hgl1-workspace-3d\b/g), 1, route);
    assert.match(markup, new RegExp(`data-hgl1-workspace-3d[^>]+data-route="${route.replaceAll("/", "\\/")}"`));
    assert.match(markup, /data-hgl1-workspace-3d[^>]+data-state="loading"[^>]+aria-hidden="true"/);
    assert.equal(count(markup, /\bdata-hgl1-workspace-webgl\b/g), 0, "canvas must stay lazy");
  }

  const home = layerOne.viewMarkup("/home", {});
  assert.equal(count(home, /\bdata-hgl1-workspace-3d\b/g), 0, "Home keeps its dedicated Living Universe renderer");
});

test("the workspace renderer is procedural, route-specific and creates one canvas owner", () => {
  assert.match(rendererSource, /from '\.\/vendor\/three\.module\.min\.js'/);
  assert.equal(count(rendererSource, /new T\.WebGLRenderer\(/g), 1);
  assert.match(read("galaxy-celestial-materials.mjs"), /new T\.ShaderMaterial/);
  assert.match(rendererSource, /new T\.SphereGeometry/);
  assert.match(rendererSource, /new T\.RingGeometry/);
  assert.match(rendererSource, /new T\.PointsMaterial/);
  assert.match(rendererSource, /new T\.PointLight/);
  assert.match(rendererSource, /new T\.HemisphereLight/);
  assert.match(rendererSource, /canvas\.dataset\.hgl1WorkspaceWebgl/);
  assert.match(rendererSource, /host\.replaceChildren\(canvas\)/);
  assert.doesNotMatch(rendererSource, /https?:\/\//i);

  assert.match(rendererSource, /WORLD_PROFILES/);
});

test("renderer lifecycle pauses offscreen work and deterministically releases GPU resources", () => {
  for (const contract of [
    /prefers-reduced-motion:\s*reduce/,
    /visibilitychange/,
    /IntersectionObserver/,
    /ResizeObserver/,
    /webglcontextlost/,
    /cancelAnimationFrame/,
    /\.dispose\?\.\(\)/,
    /renderer\?\.dispose\(\)/,
    /renderer\?\.forceContextLoss\(\)/,
    /controller\.abort\(\)/
  ]) assert.match(rendererSource, contract);

  assert.match(shellSource, /import\("\.\/galaxy-workspace-renderer\.mjs\?v=2"\)/);
  assert.match(shellSource, /cleanupWorkspaceScene\(runtime\)/);
  assert.match(shellSource, /workspaceSceneToken/);
  assert.match(shellSource, /owner\.workspaceScene\s*=\s*controller/);
  assert.match(shellSource, /syncScenery\(runtime\)/);
});

test("CSS keeps 3D decorative, responsive and backed by the existing local portal image", () => {
  assert.match(worldStyles, /\.hh-galaxy-app\s+\.hgl1-workspace-3d\s*\{[\s\S]*?pointer-events:\s*none/i);
  assert.match(worldStyles, /\.hgl1-workspace-3d\[data-state="fallback"\][\s\S]*?display:\s*none/i);
  assert.match(worldStyles, /\.hgl1-workspace-3d\[data-state="ready"\]\s*~\s*\.hgl1-world-hero__media/i);
  assert.match(worldStyles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?hgl1-workspace-3d/i);
  assert.match(worldStyles, /@media\s*\(forced-colors:\s*active\),\s*print[\s\S]*?hgl1-workspace-3d/i);
  assert.match(worldStyles, /@media\s*\(max-width:\s*767px\)[\s\S]*?hgl1-workspace-3d/i);
});

test("release loader and offline runtime carry the exact new 3D assets", () => {
  assert.match(loaderSource, /galaxy-layer-one-worlds\.css\?v=17/);
  assert.match(loaderSource, /galaxy-layer-one\.js\?v=26/);
  assert.match(serviceWorkerSource, /\.\/galaxy-layer-one-worlds\.css\?v=17/);
  assert.match(serviceWorkerSource, /\.\/galaxy-layer-one\.js\?v=26/);
  assert.match(serviceWorkerSource, /\.\/galaxy-workspace-renderer\.mjs\?v=2/);
});
