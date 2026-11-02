'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const G = require('../hh-multiverse-gallery'), A = require('../hh-multiverse-art'), E = require('../hh-multiverse-engine');

test('art collection partitions accounts and round-trips while preserving safe future artwork IDs', () => {
  assert.match(G.collectionKey({ id: 'a' }), /^hh\.multiverse\.art-collection\.v1:/);
  assert.notEqual(G.collectionKey({ id: 'a' }), G.collectionKey({ id: 'b' }));
  assert.deepEqual(G.collection(), { version: 1, favorites: [] });
  const value = { version: 1, favorites: ['moons', 'future-artwork-2027', 'moons'] };
  assert.deepEqual(G.collection(JSON.parse(JSON.stringify(value))), { version: 1, favorites: ['moons', 'future-artwork-2027'] });
  assert.deepEqual(value.favorites, ['moons', 'future-artwork-2027', 'moons']);
  assert.deepEqual(G.filtered({ artCollection: value, gallery: { favoritesOnly: true } }).map(a => a.id), ['moons']);
});

test('future and malformed collections are rejected without altering the caller data', () => {
  for (const raw of [{ version: 99, favorites: ['moons'] }, [], 'bad', { version: 1, favorites: 'moons' }, { version: 1, favorites: ['https://evil.example'] }, { version: 1, favorites: ['__proto__'] }, { version: 1, favorites: Array(G.MAX_FAVORITES + 1).fill('moons') }, JSON.parse('{"version":1,"favorites":[],"__proto__":{"polluted":true}}')]) {
    const before = JSON.stringify(raw); assert.throws(() => G.collection(raw)); assert.equal(JSON.stringify(raw), before);
  }
  assert.equal({}.polluted, undefined);
});

test('favorites toggle actual catalogue artworks immutably and retain unrelated unknown IDs', () => {
  const original = { version: 1, favorites: ['future-artwork'] }, first = G.toggleFavorite(original, 'moons');
  assert.deepEqual(first.favorites, ['future-artwork', 'moons']);
  assert.deepEqual(original.favorites, ['future-artwork']);
  assert.deepEqual(G.toggleFavorite(first, 'moons').favorites, ['future-artwork']);
  assert.throws(() => G.toggleFavorite(original, '../../config'));
  assert.throws(() => G.toggleFavorite({ version: 1, favorites: Array.from({ length: G.MAX_FAVORITES }, (_, i) => 'future-' + i) }, 'moons'));
});

test('search ignores Vietnamese accents, joins all terms and combines category, color and favorites', () => {
  assert.deepEqual(G.filtered({ gallery: { query: 'MAT TRANG' }, galleryFilter: 'world' }).map(a => a.id), ['moons']);
  assert.deepEqual(G.filtered({ gallery: { query: 'nghiên cứu' }, galleryFilter: 'portrait' }).map(a => a.id), ['portrait-3']);
  assert.deepEqual(G.filtered({ gallery: { query: 'ky uc', tone: 'pink' }, galleryFilter: 'world', artCollection: { version: 1, favorites: ['memory'] } }).map(a => a.id), ['memory']);
  assert.deepEqual(G.filtered({ gallery: { query: 'ky uc nonexistent', tone: 'pink' }, galleryFilter: 'world' }), []);
  assert.deepEqual(G.filtered({ gallery: { favoritesOnly: true }, artCollection: { version: 1, favorites: ['memory'] }, galleryFilter: 'portrait' }), []);
  assert.equal(G.filtered({ gallery: {} }).length, A.catalog.length);
  assert.equal(G.filtered({ galleryFilter: 'world' }).length, A.list('world').length);
  assert.equal(G.filters({ query: ' a\n b ', tone: 'missing', favoritesOnly: 'yes' }).tone, 'all');
  assert.equal(G.filters({ query: 'x'.repeat(1000) }).query.length, 200);
});

test('renderer displays actual catalogue counts, separate favorite controls, escaped search and useful empty state', () => {
  const html = G.render({ gallery: { query: '"><img src=x onerror=alert(1)>' } });
  assert.doesNotMatch(html, /<img src=x/); assert.match(html, /&quot;&gt;&lt;img/); assert.match(html, /Chưa có ảnh phù hợp/);
  const all = G.render({});
  assert.equal((all.match(/class="mv-gallery-card mvg-card"/g) || []).length, Math.min(G.PAGE_SIZE, A.catalog.length));
  assert.equal((all.match(/data-mv-action="gallery-favorite"/g) || []).length, Math.min(G.PAGE_SIZE, A.catalog.length));
  assert.match(all, new RegExp('1–' + Math.min(G.PAGE_SIZE, A.catalog.length) + ' / ' + A.catalog.length + ' tranh'));
  assert.doesNotMatch(all, /<button[^>]*class="mv-gallery-card/);
  assert.match(all, /loading="lazy"/); assert.match(all, /hh|Bộ sưu tập lưu trên thiết bị/);
  const saved = G.render({ artCollection: { version: 1, favorites: ['moons'] }, gallery: { favoritesOnly: true } });
  assert.equal((saved.match(/class="mv-gallery-card mvg-card"/g) || []).length, 1); assert.match(saved, /Bỏ lưu ảnh: Hai vầng trăng/);
  assert.match(all, /data-mvg-result tabindex="-1"/); assert.match(all, /data-mv-action="gallery-random"/); assert.match(all, /name="theme"/);
});

test('pagination handles a thousand scenes, boundaries and invalid pages without mutating rows', () => {
  const rows = Array.from({ length: 1000 }, (_, i) => ({ id: 'scene-' + i })), before = rows.slice();
  const first = G.paginateRows(rows), last = G.paginateRows(rows, 42), outside = G.paginateRows(rows, 99999);
  assert.equal(first.page, 1); assert.equal(first.pageCount, 42); assert.equal(first.items.length, 24); assert.equal(first.start, 1); assert.equal(first.end, 24);
  assert.equal(last.page, 42); assert.equal(last.items.length, 16); assert.equal(last.items[0], rows[984]); assert.equal(last.start, 985); assert.equal(last.end, 1000);
  assert.deepEqual(outside, last); assert.deepEqual(rows, before);
  for (const page of [-1, 0, NaN, Infinity, 1.5, '2']) assert.equal(G.paginateRows(rows, page).page, 1);
  assert.deepEqual(G.paginateRows([], 9), { items: [], page: 1, pageCount: 1, total: 0, start: 0, end: 0 });
  assert.equal(G.filtered({ gallery: { page: 99999 } }).length, A.catalog.length);
  assert.equal(G.paginate({ gallery: { page: 99999 } }).end, A.catalog.length);
});

test('theme and scene filters use catalogue metadata and expose the last page of any catalogue size', () => {
  const sceneRows = A.list('scene'), availableThemes = G.themes();
  assert.equal(G.filtered({ galleryFilter: 'scene' }).length, sceneRows.length);
  assert.equal(G.filters({ theme: 'invalid' }).theme, 'all');
  assert.equal(G.filters({ page: Number.MAX_SAFE_INTEGER + 1 }).page, 1);
  for (const theme of availableThemes) {
    const matching = G.filtered({ galleryFilter: 'scene', gallery: { theme: theme.id } });
    assert.ok(matching.length > 0); assert.ok(matching.every(art => art.theme === theme.id));
    assert.ok(G.filtered({ gallery: { query: theme.label }, galleryFilter: 'scene' }).length > 0);
  }
  const paging = G.paginate({ galleryFilter: 'scene' }), html = G.render({ galleryFilter: 'scene' });
  if (paging.pageCount > 1) assert.match(html, new RegExp('data-page="' + paging.pageCount + '"[^>]*aria-label="Trang ' + paging.pageCount + '"'));
  if (sceneRows.length) assert.match(html, /Đồ họa sinh bằng mã/);
  assert.equal(G.MAX_FAVORITES >= Math.max(1024, A.catalog.length), true);
});

test('custom picture adapter can supply responsive artwork without accessing or changing world state', () => {
  const world = E.create('Nếu Trái Đất có hai Mặt Trăng?'), before = JSON.stringify(world), requested = [];
  const html = G.render({ world, galleryFilter: 'world', picture(id, options) { requested.push({ id, options }); return '<span data-custom-picture="' + id + '"></span>'; } });
  assert.equal(requested.length, A.list('world').length); assert.ok(requested.every(r => r.options.caption === false));
  assert.ok(html.includes('data-custom-picture="moons"')); assert.equal(JSON.stringify(world), before);
});
