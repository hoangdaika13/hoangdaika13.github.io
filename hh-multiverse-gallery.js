/* Personal art collection. Search and favorites do not change a world snapshot. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./hh-multiverse-art') : root.HHMultiverseArt, root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HHMultiverseGallery = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (A, root) {
  'use strict';
  const VERSION = 1;
  const MAX_FAVORITES = Math.max(1024, A.catalog.length), PAGE_SIZE = 24;
  const KINDS = ['all', 'world', 'experience', 'portrait', 'scene'];
  const TONE_LABELS = { cyan: 'Cyan', blue: 'Xanh dương', violet: 'Tím', pink: 'Hồng', coral: 'San hô', gold: 'Vàng', mint: 'Xanh ngọc' };
  const KIND_LABELS = { all: 'Tất cả', world: 'Thế giới AI', experience: 'Hành trình AI', portrait: 'Chân dung AI', scene: 'Cảnh đồ họa' };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
  const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
  const failure = message => { throw Object.assign(Error(message), { code: 'MULTIVERSE_COLLECTION_INVALID' }); };

  function collectionKey(user) {
    return 'hh.multiverse.art-collection.v1:' + encodeURIComponent(String(user?.id || user?._id || 'guest'));
  }

  function collection(raw) {
    if (raw === null || raw === undefined) return { version: VERSION, favorites: [] };
    if (!plain(raw) || raw.version !== VERSION || !Array.isArray(raw.favorites) || raw.favorites.length > MAX_FAVORITES)
      failure('Bộ sưu tập đã lưu chưa đúng cấu trúc hoặc cần phiên bản khác. Hãy giữ bản gốc để phục hồi.');
    if (Object.keys(raw).some(key => ['__proto__', 'prototype', 'constructor'].includes(key)))
      failure('Bộ sưu tập có khóa dữ liệu không được hỗ trợ.');
    if (raw.favorites.some(id => typeof id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id)))
      failure('Bộ sưu tập có mã ảnh chưa hợp lệ.');
    // Preserve safe unknown IDs: a newer catalogue may contain artworks this
    // client has not received yet. They never become arbitrary image URLs.
    return { version: VERSION, favorites: [...new Set(raw.favorites)] };
  }

  function toggleFavorite(raw, id) {
    if (!A.find(id)) failure('Ảnh không có trong bộ tranh hiện tại.');
    const next = collection(raw);
    const at = next.favorites.indexOf(id);
    if (at >= 0) next.favorites.splice(at, 1);
    else {
      if (next.favorites.length >= MAX_FAVORITES) failure('Bộ sưu tập đã đầy. Bỏ lưu một ảnh trước khi thêm ảnh khác.');
      next.favorites.push(id);
    }
    return next;
  }

  function tones() {
    return [...new Set(A.catalog.map(art => art.tone).filter(tone => typeof tone === 'string' && tone))].map(id => ({ id, label: TONE_LABELS[id] || id }));
  }

  function themes() {
    const labels = new Map((root.HHMultiverseScenes?.THEMES || []).map(theme => [theme.id, theme.name]));
    return [...new Set(A.catalog.map(art => art.theme).filter(theme => typeof theme === 'string' && theme))].map(id => {
      const art = A.catalog.find(item => item.theme === id);
      return { id, label: labels.get(id) || art.themeLabel || art.title.split(' · ')[0] || id };
    });
  }

  function filters(raw = {}) {
    const data = plain(raw) ? raw : {};
    return {
      query: typeof data.query === 'string' ? data.query.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 200).trim() : '',
      tone: tones().some(t => t.id === data.tone) ? data.tone : 'all',
      theme: themes().some(t => t.id === data.theme) ? data.theme : 'all',
      favoritesOnly: data.favoritesOnly === true,
      page: Number.isSafeInteger(data.page) && data.page > 0 ? data.page : 1
    };
  }

  function filtered(ctx = {}) {
    const options = filters(ctx.gallery), category = KINDS.includes(ctx.galleryFilter) ? ctx.galleryFilter : 'all';
    const saved = new Set(collection(ctx.artCollection).favorites);
    const terms = [...new Set(fold(options.query).split(/[^\p{L}\p{N}]+/u).filter(Boolean))];
    return A.catalog.map((art, index) => {
      const title = fold(art.title), text = fold([art.title, art.description, art.id, art.theme].join(' '));
      const matches = (category === 'all' || art.kind === category) &&
        (options.tone === 'all' || art.tone === options.tone) &&
        (options.theme === 'all' || art.theme === options.theme) &&
        (!options.favoritesOnly || saved.has(art.id)) && terms.every(term => text.includes(term));
      const score = terms.reduce((total, term) => total + (title.includes(term) ? 3 : 1), 0);
      return { art, index, matches, score };
    }).filter(row => row.matches).sort((a, b) => b.score - a.score || a.index - b.index).map(row => row.art);
  }

  function paginateRows(rows, requestedPage = 1) {
    const total = rows.length, pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(pageCount, Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
    const offset = (page - 1) * PAGE_SIZE;
    return { items: rows.slice(offset, offset + PAGE_SIZE), page, pageCount, total, start: total ? offset + 1 : 0, end: Math.min(offset + PAGE_SIZE, total) };
  }

  function paginate(ctx = {}) { return paginateRows(filtered(ctx), filters(ctx.gallery).page); }

  function pagination(paging) {
    if (paging.pageCount <= 1) return '';
    const { page, pageCount } = paging;
    const pages = [...new Set([1, 2, page - 1, page, page + 1, pageCount - 1, pageCount])].filter(n => n >= 1 && n <= pageCount).sort((a, b) => a - b);
    const button = (n, label, extra = '') => '<button type="button" data-mv-action="gallery-page" data-page="' + n + '" ' + extra + '>' + label + '</button>';
    return '<nav class="mvg-pagination" aria-label="Trang bộ tranh">' + button(Math.max(1, page - 1), '← Trước', page === 1 ? 'disabled' : '') +
      pages.map((n, index) => (index && n - pages[index - 1] > 1 ? '<span aria-hidden="true">…</span>' : '') + button(n, n, 'aria-label="Trang ' + n + '"' + (n === page ? ' aria-current="page"' : ''))).join('') +
      button(Math.min(pageCount, page + 1), 'Sau →', page === pageCount ? 'disabled' : '') + '</nav>';
  }

  function fallbackPicture(id) {
    const art = A.find(id), portrait = art.kind === 'portrait', width = portrait ? 400 : 640;
    const selected = art.widths.includes(width) ? width : art.widths.at(-1);
    return '<span class="mv-art' + (portrait ? ' mv-gallery-portrait' : '') + '" data-art="' + esc(art.id) + '" role="img" aria-label="' + esc(art.description) + '">' +
      '<span class="mv-art-fallback" aria-hidden="true"><b>✦</b><span class="mv-art-wait">Đang tải tranh…</span><span class="mv-art-error">Ảnh chưa tải được</span></span>' +
      '<picture><img data-mv-image src="' + esc(A.url(art.id, selected)) + '" srcset="' + art.widths.map(w => esc(A.url(art.id, w)) + ' ' + w + 'w').join(', ') + '" sizes="(max-width:650px) 92vw, (max-width:1000px) 44vw, 360px" width="' + selected + '" height="' + (portrait ? selected : Math.round(selected * 9 / 16)) + '" alt="" loading="lazy" decoding="async"></picture></span>';
  }

  function render(ctx = {}) {
    const options = filters(ctx.gallery), category = KINDS.includes(ctx.galleryFilter) ? ctx.galleryFilter : 'all';
    const saved = new Set(collection(ctx.artCollection).favorites), paging = paginate(ctx), rows = paging.items;
    const picture = typeof ctx.picture === 'function' ? ctx.picture : root.HHMultiverseViews?.picture;
    const image = art => picture ? picture(art.id, { caption: false, className: art.kind === 'portrait' ? 'mv-gallery-portrait' : '' }) : fallbackPicture(art.id);
    const knownFavorites = A.catalog.filter(art => saved.has(art.id)).length;
    return '<section class="mvg" aria-label="Bộ tranh đa vũ trụ"><header class="mvg-heading"><h1 tabindex="-1">Phòng tranh</h1><p>Tìm một thế giới, giữ lại một góc nhìn bạn thích.</p></header>' +
      '<form data-mv-form="gallery-search" class="mvg-search"><label>Tìm ảnh<input type="search" name="q" maxlength="200" autocomplete="off" value="' + esc(options.query) + '" placeholder="Tên tranh, cảnh quan, nhân vật…"></label>' +
      '<label>Màu chủ đạo<select name="tone"><option value="all"' + (options.tone === 'all' ? ' selected' : '') + '>Tất cả màu</option>' + tones().map(t => '<option value="' + esc(t.id) + '"' + (options.tone === t.id ? ' selected' : '') + '>' + esc(t.label) + '</option>').join('') + '</select></label>' +
      '<label>Chủ đề<select name="theme"><option value="all"' + (options.theme === 'all' ? ' selected' : '') + '>Tất cả chủ đề</option>' + themes().map(t => '<option value="' + esc(t.id) + '"' + (options.theme === t.id ? ' selected' : '') + '>' + esc(t.label) + '</option>').join('') + '</select></label><button type="submit">Tìm ảnh</button></form>' +
      '<div class="mvg-toolbar"><div class="mv-gallery-filters mvg-categories" role="group" aria-label="Loại tranh">' + KINDS.map(kind => '<button type="button" data-mv-action="gallery-filter" data-kind="' + kind + '" aria-pressed="' + (kind === category) + '">' + KIND_LABELS[kind] + ' <span>' + (kind === 'all' ? A.catalog.length : A.list(kind).length) + '</span></button>').join('') + '</div>' +
      '<div class="mvg-tools"><button type="button" data-mv-action="gallery-random"' + (paging.total ? '' : ' disabled') + '>✦ Khám phá ngẫu nhiên</button><button type="button" data-mv-action="gallery-favorites" class="mvg-saved-filter" aria-pressed="' + options.favoritesOnly + '"><span aria-hidden="true">♥</span> Đã lưu <span>' + knownFavorites + '</span></button></div></div>' +
      '<p class="mvg-result" data-mvg-result tabindex="-1" role="status" aria-live="polite">' + (paging.total ? paging.start + '–' + paging.end : '0') + ' / ' + paging.total + ' tranh' + (paging.total !== A.catalog.length ? ' · thư viện ' + A.catalog.length + ' tranh' : '') + (options.favoritesOnly ? ' · trong bộ sưu tập của bạn' : '') + '</p>' +
      (rows.length ? '<div class="mv-gallery-grid mvg-grid">' + rows.map(art => '<article class="mv-gallery-card mvg-card" data-id="' + esc(art.id) + '" data-tone="' + esc(art.tone) + '">' +
        '<button type="button" class="mvg-open-picture" data-mv-action="open-art" data-id="' + esc(art.id) + '" aria-label="' + esc('Xem ảnh: ' + art.title) + '">' + image(art) + '</button>' +
        '<div class="mvg-card-body"><span class="mvg-source">' + (art.kind === 'scene' ? 'Đồ họa sinh bằng mã' : 'Minh họa AI') + '</span><h2>' + esc(art.title) + '</h2><p>' + esc(art.description) + '</p><div class="mvg-card-actions"><button type="button" class="mvg-open" data-mv-action="open-art" data-id="' + esc(art.id) + '">Xem ảnh <span aria-hidden="true">↗</span></button>' +
        '<button type="button" class="mvg-favorite" data-mv-action="gallery-favorite" data-id="' + esc(art.id) + '" aria-pressed="' + saved.has(art.id) + '" aria-label="' + esc((saved.has(art.id) ? 'Bỏ lưu ảnh: ' : 'Lưu ảnh: ') + art.title) + '"><span aria-hidden="true">' + (saved.has(art.id) ? '♥' : '♡') + '</span> ' + (saved.has(art.id) ? 'Đã lưu' : 'Lưu ảnh') + '</button></div></div></article>').join('') + '</div>' :
        '<div class="mvg-empty" role="status"><span aria-hidden="true">✦</span><h2>Chưa có ảnh phù hợp</h2><p>' + (options.favoritesOnly && !knownFavorites ? 'Lưu một ảnh bằng nút trái tim để tạo bộ sưu tập của bạn.' : 'Thử từ khóa khác hoặc bỏ bớt bộ lọc.') + '</p></div>') +
      pagination(paging) + '<p class="mvg-note">Bộ sưu tập lưu trên thiết bị theo tài khoản. Đây là tranh minh họa; trạng thái thế giới nằm trong mô phỏng.</p></section>';
  }

  return Object.freeze({ VERSION, MAX_FAVORITES, PAGE_SIZE, collectionKey, collection, toggleFavorite, tones, themes, filters, filtered, paginateRows, paginate, render });
});
