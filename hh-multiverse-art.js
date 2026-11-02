/* Original illustrated collection. Visual choices never alter simulated facts. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./hh-multiverse-engine') : root.HHMultiverseEngine);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HHMultiverseArt = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (E) {
  'use strict';
  const rows = [
    ['hero', 'Cánh cổng vô hạn', 'Cổng pha lê mở ra nhiều thực tại giữa đại dương vũ trụ.', 'experience', 'violet'],
    ['sleep', 'Thành phố không ngủ', 'Những khu phố sáng đèn, vườn yên tĩnh và nhịp sống không cần ngủ.', 'world', 'coral', 0],
    ['moons', 'Hai vầng trăng', 'Một nền văn minh ven biển dưới hai Mặt Trăng màu tím và vàng.', 'world', 'cyan', 1],
    ['memory', 'Chợ ký ức', 'Những quả cầu thủy tinh giữ các mảnh ký ức trong khu chợ rực rỡ.', 'world', 'pink', 2],
    ['time', 'Cộng hòa thời khắc', 'Đồng hồ cát ánh vàng giữa một xã hội dùng thời gian để trao đổi.', 'world', 'gold', 3],
    ['animals', 'Liên minh muôn loài', 'Thành phố trong tán rừng, nơi các cộng đồng động vật cùng sinh sống.', 'world', 'mint', 4],
    ['network', 'Mạng lưới cổ đại', 'Thư viện và tháp truyền tin trong một giả định Internet thời Phục Hưng.', 'world', 'blue', 5],
    ['money', 'Quần đảo sẻ chia', 'Khu vườn cộng đồng và những công dân cùng chia sẻ thành quả.', 'world', 'gold', 6],
    ['sky', 'Những thành phố trên mây', 'Các đô thị nổi, phi thuyền và thác nước giữa những tầng mây hồng.', 'world', 'coral', 7],
    ['timeline', 'Dòng sông thời gian', 'Ba thời đại của một nền văn minh nối nhau bằng dòng sáng.', 'experience', 'blue'],
    ['butterfly', 'Cánh bướm đa vũ trụ', 'Những thực tại khác nhau trong đôi cánh pha lê của một cánh bướm.', 'experience', 'pink'],
    ['civilizations', 'Những người kiến tạo', 'Các công dân hư cấu cùng thảo luận quanh mô hình thế giới.', 'experience', 'violet'],
    ['portrait-0', 'Người mở đường', 'Chân dung minh họa một kỹ sư giàu trí tò mò.', 'portrait', 'cyan'],
    ['portrait-1', 'Người giữ ký ức', 'Chân dung minh họa một người lưu trữ điềm tĩnh.', 'portrait', 'violet'],
    ['portrait-2', 'Người kết nối', 'Chân dung minh họa một người hòa giải thân thiện.', 'portrait', 'coral'],
    ['portrait-3', 'Người tìm tri thức', 'Chân dung minh họa một nhà nghiên cứu cẩn trọng.', 'portrait', 'blue'],
    ['portrait-4', 'Người vượt chân trời', 'Chân dung minh họa một hoa tiêu nhiều trải nghiệm.', 'portrait', 'mint'],
    ['portrait-5', 'Người dệt sắc màu', 'Chân dung minh họa một nghệ sĩ giàu tưởng tượng.', 'portrait', 'pink']
  ];
  const catalog = Object.freeze(rows.map(([id, title, description, kind, tone, sampleIndex]) => Object.freeze({
    id, title, description, kind, tone, sampleIndex,
    widths: Object.freeze(kind === 'portrait' ? [160, 400, 960] : id === 'hero' ? [320, 640, 1280, 1600] : [320, 640, 1280]),
    caption: kind === 'portrait' ? 'Chân dung minh họa' : 'Tranh ý tưởng · không tái hiện snapshot'
  })));
  const byId = new Map(catalog.map(row => [row.id, row]));
  const palettes = Object.freeze([
    Object.freeze({ id: 'prism', name: 'Lăng kính', description: 'Xanh điện, tím và hồng' }),
    Object.freeze({ id: 'aurora', name: 'Cực quang', description: 'Cyan, xanh ngọc và xanh trời' }),
    Object.freeze({ id: 'sunset', name: 'Hoàng hôn', description: 'San hô, vàng và tím' })
  ]);
  const find = id => byId.get(id) || null;
  const list = kind => catalog.filter(row => !kind || kind === 'all' || row.kind === kind);
  function url(id, width) {
    const art = find(id);
    if (!art || !art.widths.includes(width)) throw Error('Ảnh hoặc kích thước không có trong bộ tranh.');
    return './assets/multiverse/' + art.id + '-v1-' + width + '.webp';
  }
  function forWorld(world = {}) {
    if (find(world.id)?.kind === 'world') return find(world.id);
    const family = E.family(world.premise || '');
    return find(family) || find('hero');
  }
  function forCharacter(world, characterId) {
    const index = Math.max(0, world.blueprint.characters.findIndex(c => c.id === characterId));
    return find('portrait-' + index % 6);
  }
  const preferenceKey = user => 'hh.multiverse.visual.v1:' + encodeURIComponent(String(user?.id || user?._id || 'guest'));
  function preferences(raw) {
    if (raw === null || raw === undefined) return { version: 1, palette: 'prism', compact: true };
    if (typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1 || !palettes.some(p => p.id === raw.palette) || typeof raw.compact !== 'boolean')
      throw Error('Tùy chọn giao diện đã lưu cần phiên bản khác hoặc cần phục hồi.');
    return { version: 1, palette: raw.palette, compact: raw.compact };
  }
  return Object.freeze({ catalog, palettes, find, list, url, forWorld, forCharacter, preferenceKey, preferences });
});
