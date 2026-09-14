const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const gateway = require('../hh-core-gateway.js');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const router = read('script.js');

function navigation(hash = '', options = {}) {
  const location = { hash, pathname: '/app', search: '?entry=test' };
  const shell = {dataset: {}};
  const document = {title: 'HH', body: {dataset: {}}};
  const history = { replaceState(state, title, url) { location.hash = url.slice(url.indexOf('#')); } };
  const context = {location, shell, document, history, window: {HHCoreGateway: options.missingGateway ? null : gateway}, syncMobileSidebarDock() {}, isUnlocked: () => options.unlocked !== false};
  const source = router.slice(router.indexOf('  const syncCoreLayer ='), router.indexOf('  let cosmicLoaderRoute'));
  vm.runInNewContext(source + '\nglobalThis.resolve = routeFromHash; globalThis.safeRoute = platformSafeRoute; globalThis.returnHome = grantCoreAccessFromGateway;', context);
  return {context, location, shell, document, resolve: context.resolve};
}

test('empty URL, legacy login anchors and root open Platform without a stored Core grant', () => {
  for (const hash of ['', '#/', '#top', '#account', '#/top', '#/account']) {
    const app = navigation(hash);
    assert.equal(app.resolve(), '/platform', hash);
    assert.equal(app.location.hash, '#/platform', hash);
    assert.equal(app.shell.dataset.hhLayer, 'platform');
    assert.equal(app.document.body.dataset.hhLayer, 'platform');
  }
});

test('Platform -> Galaxy -> all Galaxy tools -> Platform keeps the same shell object', () => {
  const app = navigation();
  const original = app.shell;
  for (const route of ['/platform', ...gateway.galaxyManifest, '/create', '/platform']) {
    app.location.hash = '#' + route;
    assert.equal(app.resolve(), route);
    assert.equal(app.shell, original);
    assert.equal(app.shell.dataset.hhLayer, 'platform');
  }
});

test('Galaxy alias and valid tool query survive canonicalization and repeated route reads', () => {
  const app = navigation('#/galaxy?tab=map');
  assert.equal(app.resolve(), '/home?tab=map');
  assert.equal(app.resolve(), '/home?tab=map');
  app.location.hash = '#/galaxy/ai/?tab=draft';
  assert.equal(app.resolve(), '/galaxy/ai?tab=draft');
  assert.equal(app.location.hash, '#/galaxy/ai?tab=draft');
  app.location.hash = '#/draw?mode=mirror';
  assert.equal(app.resolve(), '/draw?mode=mirror');
});

test('legacy tool Home actions return to Platform while the explicit Galaxy entry opens the module', () => {
  const app = navigation();
  assert.equal(app.context.safeRoute('/home'), '/platform');
  assert.equal(app.context.safeRoute('/galaxy'), '/home');
  assert.equal(app.context.safeRoute('/galaxy/ai'), '/galaxy/ai');
});

test('unknown links and missing navigation helper recover at Platform, never a hidden Gateway', () => {
  for (const hash of ['#/unknown?unsafe=true', '#/galaxy/unknown', '#javascript:alert(1)']) {
    const app = navigation(hash);
    assert.equal(app.resolve(), '/platform');
    assert.equal(app.location.hash, '#/platform');
  }
  assert.equal(navigation('#/draw', {missingGateway:true}).resolve(), '/platform');
});

test('legacy storage failure cannot lock navigation or grant an authenticated session', () => {
  const storage = {getItem() {throw Error('blocked');}, setItem() {throw Error('blocked');}};
  for (const route of ['/platform', '/home', '/galaxy/ai', '/draw']) assert.equal(gateway.resolveRoute(route, {storage}).route, route);
  assert.equal(navigation('', {unlocked:false}).context.returnHome({source:'hh-core',route:'/platform'}), false);
  assert.equal(navigation().context.returnHome({source:'hh-core',route:'/platform'}), true);
  assert.equal(navigation().context.returnHome({source:'hh-core',route:'/admin'}), false);
  assert.match(router, /const renderRoute = \(\) => \{\s*if \(!isUnlocked\(\)\) return;/);
  assert.match(router, /&& !isCurrentUserAdmin\(\)/);
});

test('email, guest and OAuth fallback choose Platform, preserving explicit resume requests', () => {
  const auth = read('auth-platform.js');
  assert.match(auth, /sessionStorage.getItem\("hh.auth.pending-route"\) \|\| "#\/platform"/);
  const guest = auth.slice(auth.indexOf('gate.querySelector("[data-guest-login]")'), auth.indexOf('let logoutPending'));
  assert.match(guest, /location.hash !== "#\/platform"/);
  assert.match(guest, /hh-auth-return-to", location.hash \|\| "#\/platform"/);
  assert.doesNotMatch(guest, /#\/home/);
  const legacyLogin = router.slice(router.indexOf('const handleRegister'), router.indexOf('const handleLogin') + 1500);
  assert.doesNotMatch(legacyLogin, /location.hash = "#\/home"/);
});

test('embedded module uses connected accessible tabs and bounded scrolling, with one mobile drawer', () => {
  const css = read('galaxy-stable-chrome.css');
  const module = read('galaxy-layer-one.js');
  assert.match(router, /HHGalaxyLayerOne\?\.mount\?\.\(layerHost, \{\s*route,\s*embedded: true/);
  assert.match(module, /if \(runtime.options\?\.embedded === true\) modal = false/);
  assert.match(css, /grid-template-rows:auto minmax\(0,1fr\)/);
  assert.match(css, /flex-wrap:nowrap; overflow-x:auto/);
  assert.match(css, /hgl1-main \{[^}]+overflow-y:auto/);
  assert.match(css, /hgl1-nav__link:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(read('index.html').replace(/<!--[\s\S]*?-->/g,''), /data-hh-core-exit/);
});
