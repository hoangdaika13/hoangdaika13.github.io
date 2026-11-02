/* Reviewed, real campus photography. Regenerate with sync-hh-university-photos.py. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HHUniversityCampus = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1, CHECKED_AT = '2026-11-02';
  const raw = /* CAMPUS_PHOTOS */[];
  const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
  const catalog = freeze(raw), bySchool = new Map(catalog.map(photo => [photo.schoolId, photo]));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const find = id => bySchool.get(id) || null;
  const initials = entry => String(entry?.code || entry?.name?.replace(/^(?:Trường\s+)?(?:Đại\s+học|Cao\s+đẳng|Học\s+viện)\s*/i, '').split(/\s+/).slice(0, 3).map(part => part[0]).join('') || 'HH').slice(0, 4).toUpperCase();
  const safeLink = (value, host) => { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && (!host || u.hostname === host) ? u.href : ''; } catch { return ''; } };
  const route = id => '#/university/school/' + encodeURIComponent(id);
  function url(id, width) {
    const photo = find(id), asset = photo?.assets.find(item => item.width === width);
    if (!asset || !/^\.\/assets\/university\/vn-[a-z0-9-]+-v1-[0-9]{2,4}\.webp$/.test(asset.url)) throw Error('Ảnh trường hoặc kích thước chưa được xác minh.');
    return asset.url;
  }
  function credit(photo) {
    const source = safeLink(photo.sourceUrl, 'commons.wikimedia.org'), licence = safeLink(photo.licenseUrl, 'creativecommons.org');
    if (!source || !licence) return '';
    return '<details class="hhu-campus-credit"><summary>Nguồn ảnh · ' + esc(photo.license) + '</summary><div><p>Ảnh: ' + esc(photo.photographer) + (photo.attribution ? ' · ' + esc(photo.attribution) : '') + '.</p>' +
      '<p><a href="' + esc(source) + '" target="_blank" rel="noopener noreferrer">Bản gốc trên Wikimedia Commons ↗</a> · <a href="' + esc(licence) + '" target="_blank" rel="noopener noreferrer">' + esc(photo.license) + ' ↗</a></p><p>' + esc(photo.changes) + '</p>' + (photo.identityNote ? '<p>' + esc(photo.identityNote) + '</p>' : '') + '</div></details>';
  }
  function picture(entry, options = {}) {
    const photo = find(typeof entry === 'string' ? entry : entry?.id), school = typeof entry === 'string' ? { id: entry, name: photo?.schoolName || 'Trường học' } : (entry || {});
    const variant = ['card','profile','hero'].includes(options.variant) ? options.variant : 'card';
    const opening = '<figure class="hhu-campus-media hhu-campus-' + variant + '" data-campus-school="' + esc(school.id) + '">';
    const placeholder = '<div class="hhu-campus-placeholder"><span aria-hidden="true">' + esc(initials(school)) + '</span><small>' + (photo ? 'Đang tải ảnh trường…' : 'Ảnh trường đang được bổ sung') + '</small></div>';
    if (!photo) return opening + '<div class="hhu-campus-image hhu-campus-unavailable" role="img" aria-label="' + esc('Chưa có ảnh được xác minh cho ' + school.name) + '">' + placeholder + '</div></figure>';
    const full = photo.assets.at(-1), selected = photo.assets.find(item => item.width >= (variant === 'card' ? 768 : 1280)) || full;
    const image = '<div class="hhu-campus-image" data-campus-photo>' + placeholder + '<picture><img data-hhu-campus-image src="' + esc(url(photo.schoolId, selected.width)) + '" srcset="' + photo.assets.map(item => esc(url(photo.schoolId, item.width)) + ' ' + item.width + 'w').join(', ') + '" sizes="' + (variant === 'profile' ? '(max-width:760px) 94vw, 1200px' : '(max-width:760px) 94vw, (max-width:1200px) 45vw, 400px') + '" width="' + selected.width + '" height="' + selected.height + '" alt="' + esc(photo.campus) + '" loading="lazy" decoding="async"></picture><span class="hhu-campus-error" role="status">Ảnh tạm thời chưa tải được</span></div>';
    return opening + (options.link ? '<a class="hhu-campus-school-link" href="' + esc(route(photo.schoolId)) + '" aria-label="' + esc('Xem trường: ' + school.name) + '">' + image + '</a>' : image) +
      '<figcaption>' + (variant === 'card' ? '<span class="hhu-campus-photo-label">Ảnh thật tại trường</span>' : '<p>' + esc(photo.campus) + (photo.capturedAt ? ' · ảnh tại nguồn: ' + esc(photo.capturedAt) : '') + '</p>') + credit(photo) + '</figcaption></figure>';
  }
  function hero(schools) {
    const selected = ['vn-ts-302', 'vn-ts-304', 'vn-hocmai-798f9fedfe6a9e'].map(id => schools.find(school => school.id === id)).filter(school => school && find(school.id));
    return '<div class="hhu-campus-mosaic" aria-label="Góc nhìn từ các trường">' + selected.map((school, index) => '<div class="hhu-campus-mosaic-tile hhu-campus-tile-' + index + '">' + picture(school, {variant:'hero',link:true}) + '<a href="' + esc(route(school.id)) + '">' + esc(school.name) + ' ↗</a></div>').join('') + '</div>';
  }
  return Object.freeze({ VERSION, CHECKED_AT, catalog, find, url, initials, picture, credit, hero });
});
