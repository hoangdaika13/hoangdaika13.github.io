'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const S = require('../hh-multiverse-scenes'), ROOT = path.resolve(__dirname, '..');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
test('the original scene catalog contains 1000 immutable illustrations, 100 in each of ten distinct themes', () => {
  assert.equal(S.VERSION, 1); assert.equal(S.catalog.length, 1000); assert.equal(S.THEMES.length, 10);
  assert.equal(new Set(S.catalog.map(item => item.id)).size, 1000);
  assert.equal(new Set(S.catalog.map(item => item.title)).size, 1000);
  assert.ok(Object.isFrozen(S.catalog));
  for (const theme of S.THEMES) {
    const items = S.catalog.filter(item => item.theme === theme.id); assert.equal(items.length, 100);
    for (const item of items) {
      assert.ok(Object.isFrozen(item)); assert.ok(Object.isFrozen(item.widths));
      assert.equal(item.kind, 'scene'); assert.deepEqual(item.widths, [320, 640, 1280]);
      assert.ok(item.title.length > 15); assert.match(item.description, /không mô tả trạng thái/);
    }
  }
});
test('1000 SVG scenes have distinct geometry, stable seeds, bounded documents and no external input or text overlays', () => {
  const signatures = new Set();
  for (const item of S.catalog) {
    const svg = S.svg(item.id), paths = [...svg.matchAll(/<(?:path|polygon)[^>]*>/g)].map(match => match[0].replace(/#[a-f\d]{3,8}/gi, '#COLOR')).join('');
    assert.equal(svg, S.svg(item.id)); assert.ok(svg.length > 6000 && svg.length < 180000);
    assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="1280" height="720" viewBox="0 0 1280 720">/);
    assert.doesNotMatch(svg, /NaN|Infinity|undefined|<text|<image|<script|foreignObject|\son[a-z]+=|(?:href|src)=|url\((?!#)/i);
    signatures.add(sha(paths));
    assert.match(S.svg(item.id, 320), /width="320" height="180"/);
  }
  assert.equal(signatures.size, 1000, 'geometry, not only color or title, changes for every scene');
});
test('scene asset lookup rejects unknown paths, external URLs and unsupported raster sizes', () => {
  for (const id of ['constructor', '__proto__', '../../config', 'https://example.com/image', 'data:image/png', 'scene-1001', 'scene-0000']) {
    assert.equal(S.find(id), null); assert.throws(() => S.url(id, 640)); assert.throws(() => S.svg(id));
  }
  for (const width of [0, -1, 321, 100000, '640', NaN]) { assert.throws(() => S.url('scene-0001', width)); assert.throws(() => S.svg('scene-0001', width)); }
  assert.equal(S.url('scene-1000', 1280), './assets/multiverse/scenes/scene-1000-v1-1280.webp');
});
test('all 3000 WebP variants match their SVG source, exact dimensions, sizes and SHA256 provenance manifest', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/multiverse/scenes-manifest-v1.json'), 'utf8'));
  assert.equal(manifest.version, S.VERSION); assert.equal(manifest.count, 1000); assert.equal(manifest.items.length, 1000);
  assert.match(manifest.generation, /code-native/); assert.match(manifest.purpose, /not images of simulation snapshots/);
  assert.doesNotMatch(JSON.stringify(manifest), /C:\\|\/Users\/|OPENAI_API_KEY|data:image|(?:https?:\/\/)/);
  const rows = new Map(manifest.items.map(item => [item.id, item])); let bytes = 0, files = 0;
  for (const scene of S.catalog) {
    const row = rows.get(scene.id); assert.ok(row); assert.equal(row.theme, scene.theme); assert.equal(row.kind, 'scene');
    assert.equal(row.sourceSha256, sha(S.svg(scene.id))); assert.equal(row.variants.length, 3);
    for (const width of scene.widths) {
      const variant = row.variants.find(item => item.width === width); assert.ok(variant); assert.equal(variant.height, width * 9 / 16);
      const file = path.resolve(ROOT, S.url(scene.id, width)); assert.ok(file.startsWith(path.join(ROOT, 'assets/multiverse/scenes') + path.sep));
      const buffer = fs.readFileSync(file); assert.equal(buffer.toString('ascii', 0, 4), 'RIFF'); assert.equal(buffer.toString('ascii', 8, 12), 'WEBP');
      assert.equal(buffer.length, variant.bytes); assert.equal(sha(buffer), variant.sha256);
      // Chromium may include VP8X/ICCP before the lossy VP8 frame. Walk RIFF chunks instead of assuming a fixed offset.
      let frame = null;
      for (let offset = 12; offset + 8 <= buffer.length;) {
        const kind = buffer.toString('ascii', offset, offset + 4), size = buffer.readUInt32LE(offset + 4);
        assert.ok(offset + 8 + size <= buffer.length, 'RIFF chunk must remain inside the file');
        if (kind === 'VP8X') { assert.equal(buffer.readUIntLE(offset + 12, 3) + 1, width); assert.equal(buffer.readUIntLE(offset + 15, 3) + 1, variant.height); }
        if (kind === 'VP8 ') frame = buffer.subarray(offset + 8, offset + 8 + size);
        offset += 8 + size + size % 2;
      }
      assert.ok(frame, 'lossy WebP contains an actual VP8 frame'); assert.equal(frame.subarray(3, 6).toString('hex'), '9d012a');
      assert.equal(frame.readUInt16LE(6) & 0x3fff, width); assert.equal(frame.readUInt16LE(8) & 0x3fff, variant.height);
      bytes += buffer.length; files++;
    }
  }
  assert.equal(files, 3000); assert.equal(bytes, manifest.totalBytes); assert.ok(bytes < 35 * 1024 * 1024);
});
