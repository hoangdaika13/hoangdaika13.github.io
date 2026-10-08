const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("HH Neon Gateway assets are wired into the application shell", () => {
  const html = read("index.html");
  const worker = read("sw.js");
  assert.match(html, /auth-neon-gateway\.css\?v=9/);
  assert.match(html, /auth-h-galaxy\.css\?v=13/);
  assert.match(read("auth-neon-gateway.js"), /auth-h-galaxy\.js\?v=15/);
  assert.match(read("auth-neon-gateway.js"), /auth-living-galaxy-3d\.js\?v=21/);
  const executableHtml=html.replace(/<!--[\s\S]*?-->/g, ""),gatewayAsset=executableHtml.match(/src="(auth-neon-gateway\.js\?v=\d+)"/)?.[1];
  assert.ok(gatewayAsset,"the executable shell loads a versioned authentication gateway");
  assert.match(worker, /auth-neon-gateway\.css\?v=9/);
  assert.match(worker, /auth-h-galaxy\.css\?v=13/);
  assert.match(worker, /auth-h-galaxy\.js\?v=15/);
  assert.match(worker, /auth-living-galaxy-3d\.js\?v=21/);
  assert.ok(worker.includes('"./'+gatewayAsset+'"'),"the worker caches the actual gateway version used by the shell");
  assert.match(read("auth-neon-gateway.js"), /livingRuntime\.addEventListener\("error", showGalaxyFallback/);
  assert.doesNotMatch(html, /auth-creative-universe\.css/);
  assert.match(read("performance-loader.js"), /"auth-effects":\s*\{[\s\S]{0,520}?styles:\s*\[\],[\s\S]{0,80}?scripts:\s*\[\]/);
  assert.match(html, /data-auth-motion-toggle/);
  assert.match(html, /class="auth-gateway-scene"/);
  assert.doesNotMatch(html, /class="auth-solar-system"/);
  assert.equal([...html.matchAll(/data-hh-planet="\d+"/g)].length, 25);
});

test("restored successful sessions stop producing observed class mutations",()=>{
  const vm=require('node:vm'),source=read('auth-neon-gateway.js');
  const state=source.match(/  const setState = \(state, lock = false\) => \{[\s\S]*?\n  \};/)[0],derive=source.match(/  const deriveState = \(\) => \{[\s\S]*?\n  \};/)[0];
  for(const opening of [false,true]){
    let pending=1,removals=0;const classes=new Set(opening?['is-gateway-opening']:[]);
    const gate={dataset:{},classList:{contains:token=>classes.has(token),remove:token=>{classes.delete(token);removals++;pending++;}},querySelector:()=>({textContent:'Đang dùng chế độ khách',classList:{contains:token=>token==='is-success'}})};
    const card={dataset:{authState:'idle'},classList:{contains:()=>false}},context={gate,card};
    vm.runInNewContext('let stateLock="";'+state+derive+';sync=deriveState;',context);
    let turns=0;while(pending&&turns<10){pending--;turns++;context.sync();}
    assert.equal(pending,0,'the success observer must settle rather than starve rendering');assert.equal(removals,opening?1:0);assert.equal(gate.dataset.authGatewayState,'success');assert.equal(card.dataset.authState,'success');
  }
});

test("login galaxy replaces the old showcase and keeps Google-only auth", () => {
  const html = read("index.html");
  for (const id of ["home", "creative", "music", "media", "graphic", "dev", "work", "communication", "analytics", "learning", "english", "japanese", "system", "support"]) {
    assert.match(html, new RegExp(`data-hh-galaxy-key="${id}"`));
  }
  assert.doesNotMatch(html, /data-hh-galaxy-key="(?:entertainment|character)"/);
  assert.doesNotMatch(html, /auth-feature-showcase|auth-benefits/);
  assert.doesNotMatch(html, /data-oauth-provider="facebook"/i);
  assert.match(html, /data-oauth-provider="google"/i);
});

test("registration keeps the hardened twelve-character password contract", () => {
  const html = read("index.html");
  assert.match(html, /minlength="12"[^>]*data-register-password/);
  assert.match(html, /name="confirmPassword"[^>]*minlength="12"/);
  assert.doesNotMatch(html, /minlength="15"/);
});

test("gateway supports state, performance fallback and reduced motion", () => {
  const script = read("auth-neon-gateway.js");
  const css = read("auth-neon-gateway.css");
  assert.match(script, /data-auth-state|authState/);
  assert.match(script, /fps < 45/);
  assert.match(script, /hh\.auth\.motion\.v1/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /data-motion-level="off"/);
  assert.match(css, /grid-template-columns:\s*repeat\(4/);
  assert.match(css, /html\.hh-page-hidden/);
  assert.match(css, /data-auth-state="success"[\s\S]{0,260}animation:\s*none/);
  assert.doesNotMatch(script, /classList\.add\("is-gateway-opening"\)/);
  assert.match(css, /data-auth-viewport-mode="single"/);
  assert.match(css, /display:\s*flex\s*!important/);
});

test("session startup holds an opaque boot surface until critical Home is ready", () => {
  const auth = read("auth-platform.js");
  const loader = read("performance-loader.js");
  assert.match(auth, /SESSION_VISUAL_TIMEOUT/);
  assert.match(auth, /finishSessionCheck/);
  assert.match(auth, /api\("\/api\/auth\/me\?compact=1", \{ timeout: 5000 \}\)/);
  assert.match(auth, /\.catch\(\(error\) => \{[\s\S]*?Không thể khởi tạo phiên đăng nhập/);
  assert.match(loader, /"home-enhancements"/);
  assert.match(loader, /if \(value === "\/home"\) return \["home-critical"\]/);
  assert.match(loader, /scheduleHomeEnhancements/);
  assert.match(loader, /requestIdleCallback/);
  assert.match(loader, /reduce\([\s\S]*?loadScript/);
});
