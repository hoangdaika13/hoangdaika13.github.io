const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("eight large workspace roots mount a descriptive capability catalog", () => {
  const source = read("script.js");
  const styles = read("workspace-feature-explorer.css");
  const html = read("index.html");
  const worker = read("sw.js");
  const routeContracts = [
    ["/create", "create"],
    ["/media-design", "media-design"],
    ["/music-ai", "music-ai"],
    ["/graphic-design", "graphic-design"],
    ["/work", "work"],
    ["/davinci-resolve", "davinci-resolve"],
    ["/dev-tools", "dev"],
    ["/analytics", "insights"]
  ];

  for (const [route, group] of routeContracts) {
    assert.match(source, new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\"\\s*:\\s*\"${group}`));
  }
  for (const contract of [
    "data-app-hub-search",
    "data-app-hub-filter",
    "data-app-hub-item",
    "data-app-hub-category",
    "app-module-hub__guide",
    "featureDescriptionFor",
    "finalizeRouteRender"
  ]) assert.match(source, new RegExp(contract));

  assert.match(styles, /body\.app-capability-index-route\s+#appMain\.app-main[\s\S]*?overflow-y:\s*auto\s*!important/);
  assert.match(styles, /grid-template-columns:\s*repeat\(3/);
  assert.match(styles, /@media\s*\(max-width:\s*700px\)/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(html, /workspace-feature-explorer\.css\?v=2/);
  assert.match(worker, /workspace-feature-explorer\.css\?v=2/);
});

test("authentication and Home enforce one paint owner at a time", () => {
  const shell = read("app-shell.css");
  const auth = read("auth-platform.js");
  const home = read("home-galaxy-command.css");
  const livingCss = read("auth-living-galaxy-3d.css");
  const livingJs = read("auth-living-galaxy-3d.js");
  const loader = read("performance-loader.js");
  const html = read("index.html").replace(/<!--[\s\S]*?-->/g, "");

  assert.match(shell, /body\.home-neon\.auth-locked\s+#appShell[\s\S]*?display:\s*none\s*!important/);
  assert.match(shell, /body\.home-neon\.auth-locked\s+#authGate[\s\S]*?contain:\s*paint/);
  assert.match(shell, /auth-unlocked:not\(\.auth-panel-open\)\s+\.auth-gate[\s\S]*?visibility:\s*hidden\s*!important/);
  assert.match(auth, /appShell\.inert\s*=\s*!authenticated/);
  assert.match(auth, /document\.documentElement\.dataset\.hhSurface/);
  assert.match(home, /dashboard-home\.hgc-active\s*>\s*:not\(#homeGalaxyCommandRoot\)[\s\S]*?display:\s*none\s*!important/);
  assert.match(livingCss, /\.hh-living-warp\.is-active\s*\{[^}]*opacity:\s*1/);
  assert.ok(livingJs.indexOf("render(performance.now());") < livingJs.indexOf('galaxy.classList.add("is-webgl-ready")'), "WebGL surface must publish after its first rendered frame");
  assert.match(loader, /"auth-effects":\s*\{[\s\S]*?styles:\s*\[\][\s\S]*?scripts:\s*\[\]/);
  assert.doesNotMatch(html, /auth-creative-universe\.(?:css|js)/);
});

test("refresh stays on an opaque boot surface until auth and the current Home are ready", () => {
  const html = read("index.html");
  const shell = read("app-shell.css");
  const auth = read("auth-platform.js");
  const loader = read("performance-loader.js");
  const home = read("kim-lien-home.js");
  const router = read("script.js");

  assert.match(html, /<body class="[^"]*home-neon[^"]*auth-resolving[^"]*hh-surface-pending[^"]*hh-kim-lien[^"]*kim-lien-theme[^"]*">/);
  assert.ok(html.indexOf('id="hhBootSurface"') < html.indexOf('id="authGate"'));
  assert.match(html, /body\.hh-surface-pending>\s*:not\(#hhBootSurface\)[^}]*display:none!important/);
  assert.match(shell, /body\.hh-surface-pending #authGate[\s\S]*?display:\s*none\s*!important/);
  assert.match(shell, /#authGate \.auth-creative-universe\s*\{\s*display:\s*none\s*!important/);
  assert.match(auth, /const sessionResolving = gate\.dataset\.authSession === "background"/);
  assert.match(auth, /HHSurfaceBoot = Object\.freeze/);
  assert.match(auth, /routeReady && homeReady/);
  assert.match(loader, /"home-critical":\s*\{[\s\S]*?kim-lien-home\.css\?v=3[\s\S]*?kim-lien-home\.js\?v=2/);
  assert.match(loader, /if \(value === "\/home"\) return \["home-critical"\]/);
  assert.match(home, /global\.HHKimLienHome\s*=\s*Object\.freeze/);
  assert.match(router, /window\.HHKimLienHome\?\.mount[\s\S]{0,260}data-kim-lien-home-host/, "Router must mount Kim Lien Home directly into the current workspace");
  assert.match(router, /\[data-kim-lien-home\][\s\S]{0,240}HHSurfaceBoot\?\.release/, "Boot release must wait for the Kim Lien home surface");
  assert.match(router, /document\.documentElement\.dataset\.hhRouteReady = route/);
});

test("HH Singularity Gate exposes real staged, route-aware and accessible loading", () => {
  const html = read("index.html");
  const shell = read("app-shell.css");
  const auth = read("auth-platform.js");
  const loader = read("performance-loader.js");
  const router = read("script.js");
  const bootStart = html.indexOf('id="hhBootSurface"');
  const bootEnd = html.indexOf('<div class="scroll-meter"', bootStart);
  const boot = html.slice(bootStart, bootEnd);
  const particles = boot.match(/<div class="hh-boot-particles"[\s\S]*?<\/div>/)?.[0] || "";
  const beams = boot.match(/<div class="hh-boot-beams"[\s\S]*?<\/div>/)?.[0] || "";

  assert.equal((particles.match(/<i\b/g) || []).length, 18);
  assert.equal((beams.match(/<i\b/g) || []).length, 3);
  assert.equal((boot.match(/data-hh-boot-step=/g) || []).length, 3);
  assert.doesNotMatch(boot, /<canvas\b|webgl/i);
  assert.doesNotMatch(boot, />\s*\d+%/);

  for (const visual of ["chat", "draw", "music", "media", "dev", "chinese", "fortune", "discord"]) {
    assert.match(shell, new RegExp(`data-boot-route="${visual}"`));
    assert.match(auth, new RegExp(`visual:\\s*"${visual}"`));
  }
  for (const api of ["update", "fail", "setMode", "setSound"]) {
    assert.match(auth, new RegExp(`${api}:`));
  }
  assert.match(auth, /navigator\.userActivation\?\.hasBeenActive/);
  assert.match(auth, /prefers-reduced-motion: reduce/);
  assert.match(shell, /hhBootPortalOpen/);
  assert.match(shell, /data-motion-mode="static"/);
  assert.match(shell, /data-motion-mode="cinematic"/);
  assert.match(loader, /phase:\s*"interface"[\s\S]*phase:\s*"restore"/);
  assert.match(router, /HHSurfaceBoot\?\.hold\?\.\(\{/);
  assert.match(router, /HHSurfaceBoot\?\.fail\?\./);
  assert.doesNotMatch(router, /minimumVisible/);
});
