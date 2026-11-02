/* Verified reference photos and original illustrations. Visual choices never alter simulated facts. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./hh-multiverse-engine') : root.HHMultiverseEngine, typeof module === 'object' && module.exports ? require('./hh-multiverse-scenes') : root.HHMultiverseScenes, typeof module === 'object' && module.exports ? require('./hh-multiverse-photos') : root.HHMultiversePhotos);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HHMultiverseArt = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (E, Scenes, Photos) {
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
    ['reef', 'Thành phố san hô', 'Mái vòm thủy tinh và những cây cầu phát sáng giữa rạn san hô xanh ngọc.', 'experience', 'cyan'],
    ['desert', 'Ốc đảo mặt trời', 'Thành phố năng lượng mặt trời, vườn treo và dòng kênh xanh giữa biển cát vàng.', 'experience', 'gold'],
    ['aurora', 'Đài quan sát cực quang', 'Một nền văn minh bên hồ băng dưới những dải cực quang xanh và tím.', 'experience', 'blue'],
    ['forest', 'Thư viện rừng ánh sáng', 'Thư viện trong rễ cây, cầu đồng và dòng suối phát sáng dưới mái vòm thực vật.', 'experience', 'mint'],
    ['orbital', 'Vườn sao trên quỹ đạo', 'Những vành đai vườn và bến tàu sáng màu phía trên một hành tinh tím hư cấu.', 'experience', 'violet'],
    ['volcano', 'Thung lũng địa nhiệt', 'Những khu nghiên cứu và vườn kính giữa núi đá bazan, ánh dung nham và tháp năng lượng.', 'experience', 'coral'],
    ['portrait-0', 'Người mở đường', 'Chân dung minh họa một kỹ sư giàu trí tò mò.', 'portrait', 'cyan'],
    ['portrait-1', 'Người giữ ký ức', 'Chân dung minh họa một người lưu trữ điềm tĩnh.', 'portrait', 'violet'],
    ['portrait-2', 'Người kết nối', 'Chân dung minh họa một người hòa giải thân thiện.', 'portrait', 'coral'],
    ['portrait-3', 'Người tìm tri thức', 'Chân dung minh họa một nhà nghiên cứu cẩn trọng.', 'portrait', 'blue'],
    ['portrait-4', 'Người vượt chân trời', 'Chân dung minh họa một hoa tiêu nhiều trải nghiệm.', 'portrait', 'mint'],
    ['portrait-5', 'Người dệt sắc màu', 'Chân dung minh họa một nghệ sĩ giàu tưởng tượng.', 'portrait', 'pink']
  ];
  const featuredPhotoIds = ['photo-010', 'photo-004', 'photo-031', 'photo-038', 'photo-045', 'photo-028'];
  const photoRows = (Photos?.catalog || []).slice().sort((a,b) => {
    const first = featuredPhotoIds.indexOf(a.id), second = featuredPhotoIds.indexOf(b.id);
    return (first < 0 ? 100 : first) - (second < 0 ? 100 : second);
  });
  const catalog = Object.freeze(photoRows.concat(rows.map(([id, title, description, kind, tone, sampleIndex]) => Object.freeze({
    id, title, description, kind, tone, sampleIndex,
    widths: Object.freeze(kind === 'portrait' ? [160, 400, 960] : id === 'hero' ? [320, 640, 1280, 1600] : [320, 640, 1280]),
    caption: kind === 'portrait' ? 'Chân dung minh họa' : 'Tranh ý tưởng · không tái hiện snapshot'
  })), Scenes?.catalog || []));
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
    if (art.kind === 'scene') return Scenes.url(id, width);
    if (art.kind === 'photo') return Photos.url(id, width);
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
