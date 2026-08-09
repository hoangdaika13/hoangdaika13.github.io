const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Cinematic Arcade ships six distinct playable 3D games", () => {
  const source = read("cinematic-game-arcade.js");
  const required = [
    "neon-skyline-rush",
    "mecha-frontier",
    "dragon-sky",
    "titan-protocol",
    "crystal-expedition",
    "hoverball-arena"
  ];
  required.forEach((id) => assert.match(source, new RegExp(id), `Missing ${id}`));
  for (const title of ["Neon Skyline Rush", "Mecha Frontier", "Dragon Sky", "Titan Protocol", "Crystal Expedition", "Hoverball Arena"]) {
    assert.match(source, new RegExp(title), `Missing ${title}`);
  }
});

test("the renderer and cameras are real Three.js systems", () => {
  const source = read("cinematic-game-arcade.js");
  assert.match(source, /import\("\.\/vendor\/three\.module\.min\.js"\)/);
  assert.match(source, /new THREE\.WebGLRenderer/);
  assert.match(source, /new THREE\.PerspectiveCamera/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /shadowMap\.enabled|castShadow/);
  assert.match(source, /toneMapping|Fog/);
  assert.match(source, /lerp|damp/i);
  for (const camera of ["chase", "shoulder", "flight", "lock-on", "orbit", "broadcast"]) {
    assert.match(source.toLowerCase(), new RegExp(camera), `Missing ${camera} camera`);
  }
});

test("each game has gameplay state, collision, objectives and honest outcomes", () => {
  const source = read("cinematic-game-arcade.js");
  assert.match(source, /keydown|KeyboardEvent/);
  assert.match(source, /pointerdown|pointermove/);
  assert.match(source, /data-cga-touch/);
  assert.match(source, /collision|distanceTo|intersects/i);
  assert.match(source, /projectile|shoot/i);
  assert.match(source, /objective|target/i);
  assert.match(source, /won|lost|victory|defeat/i);
  assert.match(source, /visibilitychange/);
  assert.match(source, /CustomEvent\("hh:game-reward"/);
});

test("progress, quality and lifecycle stay bounded and recoverable", () => {
  const source = read("cinematic-game-arcade.js");
  assert.match(source, /hh\.cinematic\.arcade\.v1/);
  assert.match(source, /localStorage/);
  assert.match(source, /quality/i);
  assert.match(source, /fps/i);
  assert.match(source, /dispose\(/);
  assert.match(source, /window\.HHCinematicGameArcade\s*=\s*Object\.freeze\(\{[\s\S]*?mount[\s\S]*?unmount[\s\S]*?inspect/);
});

test("Cinematic Arcade is a dedicated lazy route and remains offline-ready", () => {
  const loader = read("performance-loader.js");
  const worker = read("sw.js");
  const shell = read("script.js");
  const center = read("game-center.js");
  assert.match(loader, /"cinematic-game":\s*\{[\s\S]*?cinematic-game-arcade\.css\?v=5[\s\S]*?cinematic-game-arcade\.js\?v=2/);
  assert.ok(loader.indexOf('value.startsWith("/entertainment/cinematic-arcade")') < loader.indexOf('value.startsWith("/entertainment")'));
  assert.match(worker, /\.\/cinematic-game-arcade\.css\?v=5/);
  assert.match(worker, /\.\/cinematic-game-arcade\.js\?v=2/);
  assert.match(shell, /HHCinematicGameArcade\?\.mount/);
  assert.match(shell, /HHCinematicGameArcade\?\.unmount/);
  assert.match(shell, /route\.startsWith\("\/entertainment\/cinematic-arcade\/"\)/);
  for (const id of ["neon-skyline-rush", "mecha-frontier", "dragon-sky", "titan-protocol", "crystal-expedition", "hoverball-arena"]) {
    assert.match(center, new RegExp(`/entertainment/cinematic-arcade/${id}`));
  }
});

test("the one-screen game HUD is keyboard-visible, mobile-safe and motion-aware", () => {
  const css = read("cinematic-game-arcade.css");
  const shell = read("script.js");
  assert.match(css, /\.cga-root/);
  assert.match(css, /overflow:\s*hidden/);
  assert.match(css, /body\.app-entertainment-route\.app-cinematic-game-route \.app-main[\s\S]*?overflow-y:\s*hidden/);
  assert.match(css, /body\.app-cinematic-game-route :is\(\.app-breadcrumb, \.app-page-header, \.app-context-bar\)/);
  assert.match(css, /body\.app-cinematic-game-route \[data-cinematic-game-arcade-host\][\s\S]*?height:\s*100%/);
  assert.match(shell, /classList\.toggle\("app-cinematic-game-route"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\s*\(max-width:\s*480px\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
