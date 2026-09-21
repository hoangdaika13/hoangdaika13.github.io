const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const universe = require('../galaxy-living-universe.js');
const layer = require('../galaxy-layer-one.js');
delete global.HHGalaxyShell;
require('../galaxy-shell.js');
const shell = global.HHGalaxyShell;

test('the living universe catalog is derived from real registries and excludes Admin', () => {
  const catalog = universe.buildCatalog(layer.routeManifest, shell.routeManifest);
  assert.equal(catalog.length, layer.routeManifest.length - 1);
  assert.deepEqual(catalog.map(item => item.id), layer.routeManifest.slice(1).map(item => item.id));
  const routes = catalog.flatMap(item => [item.route, ...item.children.map(child => child.route)]);
  assert.equal(new Set(routes).size, routes.length, 'each route must have one visible owner');
  assert.equal(routes.includes('/admin'), false);
  assert.ok(catalog.find(item => item.id === 'learning').children.some(child => child.route === '/chinese'));
  assert.ok(catalog.find(item => item.id === 'creator').children.some(child => child.route === '/create/workflow'));
  assert.ok(catalog.find(item => item.id === 'analytics').children.some(child => child.route === '/analytics'));
});

test('camera, selection and quality state are validated before restoration', () => {
  const catalog = universe.buildCatalog(layer.routeManifest, shell.routeManifest);
  const state = universe.normalizeState({
    system: 'learning', selected: '/chinese', quality: 'cinematic', paused: true,
    camera: { yaw: 50, pitch: -4, distance: 400 }
  }, catalog);
  assert.equal(state.system, 'learning');
  assert.equal(state.selected, '/chinese');
  assert.equal(state.quality, 'cinematic');
  assert.equal(state.paused, true);
  assert.equal(state.camera.yaw, Math.PI);
  assert.equal(state.camera.pitch, 0.24);
  assert.equal(state.camera.distance, 95);

  const invalid = universe.normalizeState({ system: 'missing', selected: 'javascript:bad', quality: 'ultra' }, catalog);
  assert.equal(invalid.system, '');
  assert.equal(invalid.selected, '');
  assert.equal(invalid.quality, 'balanced');
});

test('adaptive quality honestly reduces work on constrained devices', () => {
  assert.equal(universe.effectiveQuality('cinematic', { memory: 16, cores: 12 }), 'cinematic');
  assert.equal(universe.effectiveQuality('cinematic', { memory: 4, cores: 12 }), 'economy');
  assert.equal(universe.effectiveQuality('cinematic', { memory: 16, cores: 4 }), 'economy');
  assert.equal(universe.effectiveQuality('balanced', { saveData: true }), 'economy');
});

test('renderer and UI implement one lifecycle-owned scene with accessible fallback', () => {
  const source = read('galaxy-living-universe.js');
  const renderer = read('galaxy-universe-renderer.mjs');
  const css = read('galaxy-living-universe.css');
  assert.match(source, /import\('\.\/galaxy-universe-renderer\.mjs\?v=2'\)/);
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /forced-colors/);
  assert.match(source, /hh:galaxy:universe-view/);
  assert.match(source, /data-glu-action="interact"[\s\S]*?addEventListener\('click'[\s\S]*?event\.stopPropagation\(\)[\s\S]*?interactive = !interactive/);
  assert.match(renderer, /new T\.WebGLRenderer/);
  assert.equal((renderer.match(/new T\.WebGLRenderer/g) || []).length, 1);
  assert.match(renderer, /requestAnimationFrame/);
  assert.match(renderer, /forceContextLoss/);
  assert.match(renderer, /webglcontextlost/);
  assert.match(renderer, /\.dispose\(\)/);
  assert.match(css, /@media\(max-width:550px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /@media\(forced-colors:active\)/);
  assert.match(css, /overflow:hidden/);
  assert.doesNotMatch(css, /(^|\n)\s*(html|body|:root)\s*\{/);
});

test('the routed universe publishes the home-ready surface signal', () => {
  const router = read('script.js');
  const finalizer = router.slice(router.indexOf('const finalizeRouteRender'), router.indexOf('const routePathOnly'));
  assert.match(finalizer, /document\.querySelector\('\[data-glu\],/);
  assert.match(finalizer, /HHSurfaceBoot\?\.release/);
});

test('the renderer uses only local original procedural art and the existing MIT dependency', () => {
  const renderer = read('galaxy-universe-renderer.mjs');
  assert.match(renderer, /Original procedural artwork/);
  assert.match(renderer, /\.\/vendor\/three\.module\.min\.js/);
  assert.doesNotMatch(renderer, /https?:\/\//);
  assert.match(read('vendor/THREE-LICENSE.txt'), /MIT License/);
});
