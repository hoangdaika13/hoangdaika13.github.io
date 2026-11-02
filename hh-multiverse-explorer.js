/* Snapshot-bound discovery and history. No DOM listeners or persistent writes. */
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const api = factory(node ? require('./hh-multiverse-model') : root.HHMultiverseModel,
    node ? require('./hh-multiverse-engine') : root.HHMultiverseEngine,
    node ? require('./hh-multiverse-internet') : root.HHMultiverseInternet);
  if (node) module.exports = api;
  else root.HHMultiverseExplorer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (M, E, I) {
  'use strict';
  const KINDS = Object.freeze({ all: 'Tất cả', location: 'Địa điểm', character: 'Nhân vật', event: 'Sự kiện' });
  const SERIES = Object.freeze([
    Object.freeze({ key: 'technology', color: '#91d9ff', dash: '' }),
    Object.freeze({ key: 'economy', color: '#ffdc9c', dash: '5 2' }),
    Object.freeze({ key: 'wellbeing', color: '#ffb8dc', dash: '2 2' }),
    Object.freeze({ key: 'environment', color: '#a2edce', dash: '7 2 1 2' })
  ]);
  const STATUS_COLORS = Object.freeze({ active: '#a2edce', strained: '#ffdc9c', destroyed: '#ffb8ca' });
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const number = value => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value);
  const button = (action, label, attrs = '') => '<button type="button" data-mv-action="' + action + '" ' + attrs + '>' + label + '</button>';

  function state(raw = {}, world) {
    raw = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const zoom = Number(raw.zoom), locations = world?.blueprint?.locations || [];
    return {
      query: typeof raw.query === 'string' ? raw.query.trim().slice(0, 200) : '',
      kind: Object.hasOwn(KINDS, raw.kind) ? raw.kind : 'all',
      locationId: locations.some(l => l.id === raw.locationId) ? raw.locationId : locations[0]?.id || '',
      zoom: Number.isFinite(zoom) ? Math.round(Math.max(1, Math.min(3, zoom)) * 100) / 100 : 1
    };
  }

  function entityRows(world) {
    const projection = I.project(world);
    return [
      ...projection.locations.map(l => ({ kind: 'location', id: l.id, title: l.name,
        text: l.description, status: l.status, detail: l.statusLabel, locationIds: [l.id] })),
      ...projection.characters.map(c => ({ kind: 'character', id: c.id, title: c.name,
        text: [c.role, c.personality, c.goal, c.belief].join(' '), status: c.place.status,
        detail: c.role + ' · ' + c.place.name, locationIds: [c.locationId] })),
      ...projection.events.map(e => ({ kind: 'event', id: e.id, title: e.title, text: e.description,
        detail: 'Năm ' + (world.settings.epochYear + Math.floor(e.day / 365)) + ' · ngày +' + e.day,
        day: e.day, locationIds: e.locationIds.slice() }))
    ];
  }

  function entities(raw, options = {}) {
    const world = M.universe(raw), filters = state(options, world);
    const terms = M.fold(filters.query).split(/\s+/).filter(Boolean);
    return entityRows(world).filter(row => (filters.kind === 'all' || row.kind === filters.kind) &&
      terms.every(term => M.fold(row.title + ' ' + row.text + ' ' + row.detail).includes(term)))
      .map(row => ({ ...row, score: terms.reduce((score, term) => score + (M.fold(row.title).includes(term) ? 2 : 0), 0) }))
      .sort((a, b) => b.score - a.score || (a.kind === 'event' && b.kind === 'event' ? b.day - a.day : 0) || a.title.localeCompare(b.title, 'vi'));
  }

  function location(raw, id) {
    const world = M.universe(raw), projection = I.project(world), selected = projection.locations.find(l => l.id === id);
    if (!selected) return null;
    return { ...selected,
      characters: projection.characters.filter(c => c.locationId === id),
      organizations: world.blueprint.organizations.filter(o => o.locationId === id),
      products: projection.products.filter(p => p.locationId === id),
      relatedEvents: projection.events.filter(e => e.locationIds.includes(id)).map(e => ({ ...e,
        year: world.settings.epochYear + Math.floor(e.day / 365) })).reverse()
    };
  }

  function history(raw) {
    const world = M.universe(raw);
    return E.lineage(world, world.current.snapshotId).map(s => ({
      snapshotId: s.id, day: s.day, year: E.year(world, s), metrics: { ...s.metrics }
    }));
  }

  function trend(raw) {
    const points = history(raw), first = points[0], last = points.at(-1);
    return { points, first, last,
      comparisons: M.METRICS.map(key => ({ key, label: I.LABELS[key], first: first.metrics[key],
        current: last.metrics[key], delta: Math.round((last.metrics[key] - first.metrics[key]) * 100) / 100 }))
    };
  }

  function map(world, view, projection) {
    const coordinate = l => ({ x: 5 + l.x * .9, y: 3 + l.y * .55 });
    const markers = projection.locations.map((l, index) => {
      const p = coordinate(l), active = l.id === view.locationId, fill = STATUS_COLORS[l.status];
      return '<a href="#/multiverse/universe/' + world.id + '/explorer" data-mv-action="explorer-location" data-id="' + l.id + '" aria-label="' + esc(l.name + ' — ' + l.statusLabel) + '"' + (active ? ' aria-current="true"' : '') + '>' +
        '<title>' + esc(l.name + ' — ' + l.statusLabel) + '</title><circle cx="' + p.x + '" cy="' + p.y + '" r="' + (active ? '4.2' : '3.2') + '" fill="' + fill + '" stroke="' + (active ? '#f5f8ff' : '#16223d') + '" stroke-width="' + (active ? '.75' : '.45') + '"/>' +
        '<text x="' + p.x + '" y="' + (p.y + 1.1) + '" fill="#13213b" text-anchor="middle" font-size="3" font-weight="700">' + (index + 1) + '</text></a>';
    }).join('');
    return '<section class="mv-panel mvx-map-panel" aria-label="Bản đồ khu vực"><div class="mvx-map-toolbar"><p>Chọn một khu vực để xem dữ kiện tại năm ' + projection.year + '.</p><div class="mv-actions">' +
      button('explorer-zoom', '−', 'data-delta="-0.25" aria-label="Thu nhỏ bản đồ"' + (view.zoom <= 1 ? ' disabled' : '')) +
      '<output aria-label="Mức phóng đại">' + Math.round(view.zoom * 100) + '%</output>' +
      button('explorer-zoom', '+', 'data-delta="0.25" aria-label="Phóng to bản đồ"' + (view.zoom >= 3 ? ' disabled' : '')) +
      button('explorer-reset', 'Về toàn cảnh') + '</div></div>' +
      '<div class="mvx-map-scroll" tabindex="0" role="region" aria-label="Bản đồ có thể cuộn; dùng phím mũi tên khi đã phóng to">' +
      '<svg class="mvx-map" viewBox="0 0 100 60" style="width:' + view.zoom * 100 + '%" role="img" aria-label="Sơ đồ khu vực theo snapshot đang xem"><title>Sơ đồ khu vực</title><desc>Vị trí là minh họa từ bản thiết kế. Màu và trạng thái lấy từ snapshot đang xem. Các nút đánh số tương ứng danh sách khu vực bên dưới.</desc>' +
      '<rect width="100" height="60" rx="3" fill="#101d3a"/><g stroke="#294465" stroke-width=".18" fill="none">' +
      [10, 20, 30, 40, 50, 60, 70, 80, 90].map(x => '<path d="M' + x + ' 0V60"/>').join('') +
      [10, 20, 30, 40, 50].map(y => '<path d="M0 ' + y + 'H100"/>').join('') +
      '<path d="M-4 45Q14 4 38 18T105 7M-4 49Q15 11 38 23T105 12M-4 55Q17 19 37 30T105 19M-4 60Q19 26 38 36T105 26"/></g>' + markers + '</svg></div>' +
      '<div class="mvx-map-key"><span>● Hoạt động</span><span>● Chịu áp lực</span><span>● Đã phá hủy</span></div>' +
      '<div class="mvx-place-buttons">' + projection.locations.map((l, i) => button('explorer-location', '<span>' + (i + 1) + '</span>' + esc(l.name), 'data-id="' + l.id + '" aria-pressed="' + (l.id === view.locationId) + '"')).join('') + '</div>' +
      '<small>Vị trí là minh họa; trạng thái và sự kiện thuộc snapshot ' + esc(projection.snapshot.id) + '. Khi phóng to, focus vùng bản đồ rồi dùng phím mũi tên để cuộn.</small></section>';
  }

  function locationView(world, selected) {
    if (!selected) return '<section class="mv-panel"><p>Chọn một khu vực trên bản đồ.</p></section>';
    return '<section class="mv-panel mvx-location-detail" aria-label="Khu vực đang chọn"><div class="mvx-location-heading"><h2>' + esc(selected.name) + '</h2><span class="mvx-status" data-status="' + selected.status + '">' + esc(selected.statusLabel) + '</span></div><p>' + esc(selected.description) + '</p>' +
      '<div class="mvx-detail-grid"><div><h3>Nhân vật gắn với khu vực</h3>' + (selected.characters.map(c => button('character', esc(c.name) + '<small>' + esc(c.role) + '</small>', 'data-id="' + c.id + '"')).join('') || '<p>Chưa có nhân vật được ghi.</p>') + '</div>' +
      '<div><h3>Tổ chức và sản phẩm</h3>' + selected.organizations.map(o => '<p><strong>' + esc(o.name) + '</strong><br>' + esc(o.description) + '</p>').join('') +
      selected.products.map(p => button('browse', esc(p.name) + '<small>' + (p.available ? 'Có thể trao đổi trong mô phỏng' : 'Nơi sản xuất đã bị phá hủy') + '</small>', 'data-address="sim://market/' + p.id + '"')).join('') + (!selected.organizations.length && !selected.products.length ? '<p>Chưa có bản ghi.</p>' : '') + '</div></div>' +
      '<h3>Sự kiện liên quan tại mốc này</h3><ol class="mvx-event-list">' + selected.relatedEvents.map(e => '<li><small>Năm ' + e.year + ' · ' + esc(e.id) + '</small><h4>' + esc(e.title) + '</h4><p>' + esc(e.description) + '</p>' + button('browse', 'Đọc sự kiện', 'data-address="sim://news/' + e.id + '"') + '</li>').join('') + '</ol>' +
      button('browse', 'Mở khu vực trong Reality Map ↗', 'data-address="sim://map/' + selected.id + '"') + '</section>';
  }

  function resultsView(rows, view) {
    return '<section class="mv-panel mvx-search-panel"><form class="mvx-search-form" data-mv-form="explorer-search"><label>Tìm trong thế giới<input type="search" name="q" maxlength="200" value="' + esc(view.query) + '" placeholder="Địa điểm, nhân vật hoặc sự kiện…"></label><label>Loại<select name="kind">' + Object.entries(KINDS).map(([id, title]) => '<option value="' + id + '"' + (view.kind === id ? ' selected' : '') + '>' + title + '</option>').join('') + '</select></label><button type="submit">Tìm kiếm</button></form>' +
      '<p class="mvx-result-count" role="status">' + rows.length + ' kết quả trong snapshot đang xem</p>' +
      (rows.length ? '<div class="mvx-results">' + rows.map(row => '<article><small>' + KINDS[row.kind] + ' · ' + esc(row.detail) + '</small><h3>' + esc(row.title) + '</h3><p>' + esc(row.text) + '</p>' +
        (row.kind === 'location' ? button('explorer-location', 'Xem khu vực', 'data-id="' + row.id + '"') : row.kind === 'character' ? button('character', 'Mở nhân vật', 'data-id="' + row.id + '"') : button('browse', 'Đọc sự kiện', 'data-address="sim://news/' + row.id + '"')) + '</article>').join('') + '</div>' : '<p>Không có kết quả phù hợp. Thử từ khóa ngắn hơn hoặc chọn “Tất cả”.</p>') + '</section>';
  }

  function historyView(world) {
    const data = trend(world), points = data.points, span = data.last.day - data.first.day;
    const x = p => 48 + (span ? (p.day - data.first.day) / span : .5) * 700;
    const y = value => 222 - value * 1.8;
    return '<section class="mv-panel mvx-history"><div class="mvx-location-heading"><h2>Thế giới đã thay đổi thế nào?</h2><span>' + points.length + ' snapshot</span></div>' +
      '<p>So sánh mốc gốc với mốc đang xem trong chính lịch sử tổ tiên của nhánh. Bốn đường biểu diễn dùng thang 0–100; dân số trong bảng được giữ nguyên số người của mô phỏng.</p>' +
      '<div class="mvx-chart-scroll" tabindex="0" role="region" aria-label="Biểu đồ tiến triển; bảng số liệu nằm ngay phía dưới"><svg viewBox="0 0 800 270" role="img" aria-label="Tiến triển bốn chỉ số theo các snapshot đã lưu"><title>Chỉ số qua các snapshot</title><desc>Chỉ bao gồm các mốc tổ tiên tới snapshot đang xem. Đối chiếu số cụ thể trong bảng ngay bên dưới.</desc>' +
      [0, 25, 50, 75, 100].map(v => '<path d="M48 ' + y(v) + 'H748" stroke="#3d5277" stroke-width="1"/><text x="38" y="' + (y(v) + 4) + '" fill="#c0cde6" text-anchor="end" font-size="11">' + v + '</text>').join('') +
      SERIES.map(series => '<polyline fill="none" stroke="' + series.color + '" stroke-width="2.5"' + (series.dash ? ' stroke-dasharray="' + series.dash + '"' : '') + ' points="' + points.map(p => x(p) + ',' + y(p.metrics[series.key])).join(' ') + '"/>' + points.map(p => '<circle cx="' + x(p) + '" cy="' + y(p.metrics[series.key]) + '" r="3" fill="' + series.color + '"><title>' + esc(I.LABELS[series.key]) + ' · năm ' + p.year + ' · ngày +' + p.day + ': ' + number(p.metrics[series.key]) + '</title></circle>').join('')).join('') +
      '<text x="48" y="254" fill="#c0cde6" font-size="12">Năm ' + data.first.year + ' · ngày +' + data.first.day + '</text><text x="748" y="254" fill="#c0cde6" font-size="12" text-anchor="end">Năm ' + data.last.year + ' · ngày +' + data.last.day + '</text></svg></div>' +
      '<ul class="mvx-chart-legend">' + SERIES.map(s => '<li><svg width="36" height="12" viewBox="0 0 36 12" aria-hidden="true"><path d="M0 6H36" fill="none" stroke="' + s.color + '" stroke-width="3"' + (s.dash ? ' stroke-dasharray="' + s.dash + '"' : '') + '/></svg>' + I.LABELS[s.key] + '</li>').join('') + '</ul>' +
      '<div class="mvx-history-table" tabindex="0"><table><caption>Chênh lệch từ năm ' + data.first.year + ' tới năm ' + data.last.year + '</caption><thead><tr><th scope="col">Chỉ số</th><th scope="col">Mốc gốc</th><th scope="col">Đang xem</th><th scope="col">Thay đổi</th></tr></thead><tbody>' + data.comparisons.map(r => '<tr><th scope="row">' + esc(r.label) + '</th><td>' + number(r.first) + '</td><td>' + number(r.current) + '</td><td>' + (r.delta > 0 ? '+' : '') + number(r.delta) + '</td></tr>').join('') + '</tbody></table></div></section>';
  }

  function render(ctx) {
    const world = M.universe(ctx.world), projection = I.project(world), view = state(ctx.explorer, world);
    const selected = location(world, view.locationId), rows = entities(world, view);
    return '<section class="mvx" aria-label="Khám phá thế giới"><div class="mvx-intro"><h1 tabindex="-1">Khám phá thế giới</h1><p>Năm ' + projection.year + ' · ' + esc(projection.branch.name) + ' · ' + projection.locations.length + ' khu vực, ' + projection.characters.length + ' nhân vật, ' + projection.events.length + ' sự kiện đã ghi.</p></div>' +
      map(world, view, projection) + locationView(world, selected) + resultsView(rows, view) + historyView(world) + '</section>';
  }
  return Object.freeze({ KINDS, SERIES, state, entities, location, history, trend, render });
});
