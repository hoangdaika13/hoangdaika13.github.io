const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("login mounts a real WebGL living galaxy without replacing authentication", () => {
  const html = read("index.html");
  const gateway = read("auth-neon-gateway.js");
  const runtime = read("auth-living-galaxy-3d.js");
  const css = read("auth-living-galaxy-3d.css");

  assert.match(html, /auth-living-galaxy-3d\.css\?v=5/);
  assert.match(gateway, /auth-living-galaxy-3d\.js\?v=3/);
  assert.match(gateway, /high:\s*"Điện ảnh"/);
  assert.match(gateway, /soft:\s*"Cân bằng"/);
  assert.match(gateway, /off:\s*"Tĩnh"/);
  assert.match(runtime, /import\(THREE_URL\)/);
  assert.match(runtime, /new THREE\.WebGLRenderer/);
  assert.match(runtime, /THREE\.ACESFilmicToneMapping/);
  assert.match(runtime, /new THREE\.PointLight/);
  assert.match(runtime, /new THREE\.MeshStandardMaterial/);
  assert.match(runtime, /THREE\.AdditiveBlending/);
  assert.match(runtime, /new THREE\.FogExp2/);
  assert.match(runtime, /routeUsage/);
  assert.match(runtime, /realSignals/);
  assert.match(runtime, /prefers-reduced-motion/);
  assert.match(runtime, /saveData/);
  assert.match(runtime, /visibilitychange/);
  assert.match(runtime, /hh-living-warp/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /scroll-snap-type:\s*x mandatory/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(html, /data-oauth-provider="google"/);
  assert.match(html, /id="gateLoginForm"/);
  assert.match(html, /data-guest-login/);
});

test("home living galaxy exposes fifteen domains and uses real local progress", () => {
  const runtime = read("home-galaxy-command.js");
  const css = read("home-galaxy-command.css");
  const loader = read("performance-loader.js");

  const block = runtime.match(/const PLANETS = Object\.freeze\(\[([\s\S]*?)\]\);/);
  assert.ok(block);
  assert.equal((block[1].match(/\{\s*id:/g) || []).length, 15);
  assert.match(runtime, /DẢI NGÂN HÀ HÔM NAY/);
  assert.match(runtime, /CONSTELLATION PROFILE/);
  assert.match(runtime, /data-hgc-dock/);
  assert.match(runtime, /updateLivingPanels/);
  assert.match(runtime, /hh\.app-shell\.recent/);
  assert.match(runtime, /hh\.communication\.intelligence\.v1/);
  assert.match(runtime, /hh\.learning\.os\.v1/);
  assert.match(runtime, /hh-project-center/);
  assert.match(runtime, /Chỉ đếm thông báo chưa đọc/);
  assert.doesNotMatch(runtime, /Math\.random\(\).*progress|fakeProgress|mockProgress/);
  assert.match(css, /\.hgc-planet--15/);
  assert.match(css, /\.hgc-today/);
  assert.match(css, /\.hgc-constellation/);
  assert.match(css, /\.hgc-dock/);
  assert.match(css, /scroll-snap-type:\s*x mandatory/);
  assert.match(loader, /home-galaxy-command\.css\?v=6/);
  assert.match(loader, /home-galaxy-command\.js\?v=5/);
});
