/* Original, deterministic illustrated scenes. These landscapes never represent simulation facts. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HHMultiverseScenes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1, WIDTHS = Object.freeze([320, 640, 1280]);
  const THEMES = Object.freeze([
    ['reef', 'Vương quốc san hô', 'cyan', 'Rạn san hô, những mái vòm dưới nước và đàn cá phát sáng.'],
    ['desert', 'Sa mạc ánh vàng', 'gold', 'Đồi cát uốn lượn, đài thiên văn và những thành cổ giữa sa mạc.'],
    ['aurora', 'Miền cực quang', 'mint', 'Dải cực quang, đỉnh băng và những công trình bên hồ phương Bắc.'],
    ['forest', 'Rừng ánh sáng', 'mint', 'Tán cây khổng lồ, cầu treo và những khu vườn phát quang.'],
    ['orbital', 'Trạm giữa các vì sao', 'blue', 'Hành tinh có vành đai, trạm quỹ đạo và những cánh buồm Mặt Trời.'],
    ['volcano', 'Đảo lửa pha lê', 'coral', 'Núi lửa, dòng dung nham và những công trình trên đá bazan.'],
    ['skycity', 'Thành phố trên mây', 'pink', 'Đảo nổi, tháp trời, phi thuyền và thác nước giữa tầng mây.'],
    ['archive', 'Thư viện vô tận', 'violet', 'Thánh đường tri thức, giá sách, cầu thang và các quả cầu lưu trữ.'],
    ['crystal', 'Hang động pha lê', 'violet', 'Cụm tinh thể, hồ phản chiếu và những cổng sáng trong lòng núi.'],
    ['harbor', 'Bến cảng hoàng hôn', 'gold', 'Nhà mái ngói, hải đăng, thuyền buồm và mặt vịnh lấp lánh.']
  ].map(([id, name, tone, description]) => Object.freeze({ id, name, tone, description })));
  const PLACES = ['Cổng', 'Thung lũng', 'Chân trời', 'Hành lang', 'Ốc đảo', 'Đài quan sát', 'Vịnh', 'Khu vườn', 'Quần đảo', 'Thánh đường'];
  const MOODS = ['Bình minh', 'Ngân hà', 'Lam ngọc', 'Hoàng hôn', 'Ánh bạc', 'Mộng mơ', 'Hổ phách', 'Sương tím', 'Ánh sao', 'Vĩnh cửu'];
  const catalog = Object.freeze(THEMES.flatMap((theme, group) => Array.from({ length: 100 }, (_, index) => Object.freeze({
    id: 'scene-' + String(group * 100 + index + 1).padStart(4, '0'),
    title: theme.name + ' · ' + PLACES[index % 10] + ' ' + MOODS[Math.floor(index / 10)].toLowerCase(),
    description: theme.description + ' Bố cục nguyên bản ' + (index + 1) + ', sinh từ hình học và hạt giống cố định; không mô tả trạng thái của thế giới.',
    kind: 'scene', theme: theme.id, tone: theme.tone, widths: WIDTHS,
    caption: 'Đồ họa sinh bằng mã · minh họa ý tưởng, không tái hiện snapshot'
  }))));
  const byId = new Map(catalog.map((item, seed) => [item.id, { item, seed: seed + 1 }]));
  const find = id => byId.get(id)?.item || null;
  function url(id, width) {
    const item = find(id);
    if (!item || !WIDTHS.includes(width)) throw Error('Cảnh hoặc kích thước không có trong bộ minh họa.');
    return './assets/multiverse/scenes/' + item.id + '-v1-' + width + '.webp';
  }
  function random(seed) {
    let value = (seed * 2654435761) >>> 0;
    return (min = 0, max = 1) => {
      value += 0x6D2B79F5;
      let n = value; n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61);
      return min + ((n ^ n >>> 14) >>> 0) / 4294967296 * (max - min);
    };
  }
  const COLORS = {
    reef: ['#031a38', '#075776', '#37c7c9', '#103d64', '#081b42', '#0c627b', '#55f2da', '#e3fff4', '#ff91bb'],
    desert: ['#35264c', '#b46866', '#ffdc9b', '#cb8d65', '#704b5f', '#775d7e', '#ffdf91', '#fff3d0', '#fb9ea4'],
    aurora: ['#071a3d', '#203b68', '#7da8b1', '#638cab', '#233c67', '#254b72', '#8ff9d0', '#e6fff8', '#bf94ff'],
    forest: ['#071d35', '#165365', '#6b9e8b', '#326b69', '#123748', '#245a73', '#a8f6ba', '#f2ffd3', '#f7a7dd'],
    orbital: ['#090d32', '#29275c', '#896d9a', '#3c4f7b', '#1c224a', '#333e77', '#87dff9', '#ecf8ff', '#f4a8d8'],
    volcano: ['#241633', '#854457', '#f6a47c', '#473751', '#211b35', '#733f53', '#ffc276', '#fff1bf', '#ff7d97'],
    skycity: ['#1c2a59', '#5969a1', '#ffc3b0', '#7d83b2', '#3d427b', '#7da5c9', '#a9f2ff', '#fff1d5', '#eeafed'],
    archive: ['#121333', '#4f3d64', '#c58d78', '#57506f', '#25223f', '#3d496b', '#f6d49b', '#fff5d6', '#caa0ec'],
    crystal: ['#12153c', '#393067', '#927ba3', '#5d568b', '#292344', '#313b7c', '#c6b5ff', '#f4edff', '#89e9ee'],
    harbor: ['#242955', '#977086', '#ffcc9a', '#786182', '#393b63', '#477496', '#ffe0a0', '#fff3d4', '#f1afcc']
  };
  const n = v => Math.round(v * 10) / 10;
  const ellipse = (x, y, rx, ry, fill, attrs = '') => '<ellipse cx="' + n(x) + '" cy="' + n(y) + '" rx="' + n(rx) + '" ry="' + n(ry) + '" fill="' + fill + '" ' + attrs + '/>';
  const rect = (x, y, w, h, fill, attrs = '') => '<rect x="' + n(x) + '" y="' + n(y) + '" width="' + n(w) + '" height="' + n(h) + '" fill="' + fill + '" ' + attrs + '/>';
  const path = (d, fill, attrs = '') => '<path d="' + d + '" fill="' + fill + '" ' + attrs + '/>';
  const line = (x1, y1, x2, y2, stroke, width = 2, attrs = '') => '<path d="M' + n(x1) + ' ' + n(y1) + 'L' + n(x2) + ' ' + n(y2) + '" fill="none" stroke="' + stroke + '" stroke-width="' + width + '" ' + attrs + '/>';
  const polygon = (points, fill, attrs = '') => '<polygon points="' + points.map(p => n(p[0]) + ',' + n(p[1])).join(' ') + '" fill="' + fill + '" ' + attrs + '/>';

  function svg(id, width = 1280) {
    const entry = byId.get(id);
    if (!entry || !WIDTHS.includes(width)) throw Error('Cảnh hoặc kích thước không hợp lệ.');
    const theme = entry.item.theme, r = random(entry.seed), c = COLORS[theme], parts = [];
    const choose = a => a[Math.floor(r(0, a.length))], add = (...shapes) => parts.push(...shapes);
    const base = n(r(405, 515)), focus = n(r(360, 930));
    const gradient = (id, stops, attrs = '') => '<linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1" ' + attrs + '>' + stops.map(([offset, color, opacity = 1]) => '<stop offset="' + offset + '" stop-color="' + color + '" stop-opacity="' + opacity + '"/>').join('') + '</linearGradient>';
    const defs = '<defs>' + gradient('sky', [[0, c[0]], [.6, c[1]], [1, c[2]]]) + gradient('sea', [[0, c[5]], [1, c[0]]]) + gradient('glass', [[0, c[7], .9], [.45, c[6], .7], [1, c[3], .85]]) + gradient('light', [[0, c[7], .85], [1, c[6], 0]]) + gradient('stone', [[0, c[3]], [1, c[4]]]) + '<radialGradient id="sun"><stop stop-color="' + c[7] + '"/><stop offset=".65" stop-color="' + c[6] + '"/><stop offset="1" stop-color="' + c[8] + '"/></radialGradient></defs>';
    function stars(count = 45, ceiling = 310) {
      for (let i = 0; i < count; i++) {
        const x = r(10, 1270), y = r(10, ceiling), size = r(.6, 2.3);
        add(ellipse(x, y, size, size, c[7], 'opacity="' + n(r(.3, .9)) + '"'));
        if (i % 17 === 0) add(line(x - 6, y, x + 6, y, c[7], 1), line(x, y - 6, x, y + 6, c[7], 1));
      }
    }
    function clouds(count = 7, low = 110, high = 360) {
      for (let i = 0; i < count; i++) {
        const x = r(-60, 1300), y = r(low, high), w = r(55, 160);
        add('<g opacity="' + n(r(.1, .3)) + '">', ellipse(x, y, w, w * .16, c[7]), ellipse(x - w * .25, y - w * .12, w * .5, w * .21, c[7]), ellipse(x + w * .3, y - w * .06, w * .45, w * .15, c[7]), '</g>');
      }
    }
    function mountains(y, fill, peaks = 8, height = 150) {
      let d = 'M-20 740L-20 ' + y;
      for (let i = 0; i <= peaks; i++) d += 'L' + n(i * 1300 / peaks + r(-35, 35)) + ' ' + n(y - r(15, height));
      add(path(d + 'L1300 740Z', fill));
    }
    function ripples(y = 520, count = 30, color = c[7]) {
      for (let i = 0; i < count; i++) {
        const x = r(0, 1280), ry = r(y, 715), w = r(8, 48) * (ry / 720);
        add(line(x, ry, x + w, ry, color, r(1, 2), 'opacity="' + n(r(.1, .35)) + '"'));
      }
    }
    function tower(x, y, w, h, variant = 0) {
      add(rect(x, y - h, w, h, 'url(#stone)', 'rx="3" stroke="' + c[6] + '" stroke-opacity=".35"'), rect(x + w * .63, y - h, w * .37, h, c[4], 'opacity=".4"'));
      if (variant % 3 === 0) add(polygon([[x - 8, y - h], [x + w / 2, y - h - w * .8], [x + w + 8, y - h]], 'url(#glass)'));
      else if (variant % 3 === 1) add(ellipse(x + w / 2, y - h, w * .56, w * .4, 'url(#glass)'), rect(x - 6, y - h, w + 12, 7, c[6]));
      else add(rect(x - 5, y - h, w + 10, 8, c[6]), line(x + w / 2, y - h, x + w / 2, y - h - 25, c[7], 2));
      const columns = Math.max(1, Math.floor(w / 16)), rows = Math.min(10, Math.floor(h / 23));
      for (let i = 0; i < rows; i++) for (let j = 0; j < columns; j++) if (r() > .26) add(rect(x + (j + .5) * w / columns - 2, y - h + 13 + i * (h - 20) / rows, 4, 7, c[7], 'opacity="' + n(r(.3, .8)) + '" rx="1"'));
      add(line(x, y, x + w, y, c[6], 3));
    }
    function crystal(x, y, h, w = h * .34, tint = c[6]) {
      const tip = x + r(-w * .12, w * .12), middle = y - h * .68;
      add(polygon([[x - w / 2, y - h * .1], [x - w / 2, middle], [tip, y - h], [x + w / 2, middle], [x + w / 2, y - h * .1], [x, y]], 'url(#glass)', 'stroke="' + tint + '" stroke-width="1.5"'));
      add(polygon([[tip, y - h], [x, y - h * .05], [x + w / 2, y - h * .1], [x + w / 2, middle]], tint, 'opacity=".28"'), line(tip, y - h, x, y - h * .05, c[7], 1, 'opacity=".7"'));
    }
    function island(x, y, w, depth = 80) {
      add(path('M' + n(x - w / 2) + ' ' + y + 'Q' + x + ' ' + n(y - 25) + ' ' + n(x + w / 2) + ' ' + y + 'L' + n(x + w * .17) + ' ' + n(y + depth * .78) + 'L' + n(x - w * .12) + ' ' + n(y + depth) + 'Z', 'url(#stone)'));
      add(ellipse(x, y, w / 2, 14, c[3], 'stroke="' + c[6] + '" stroke-opacity=".5"'), line(x - w * .24, y + 15, x - w * .12, y + depth * .72, c[6], 1, 'opacity=".4"'));
    }
    function tree(x, y, h, spread = h * .52, glow = false) {
      add(path('M' + n(x - 12) + ' ' + y + 'Q' + n(x + 8) + ' ' + n(y - h * .4) + ' ' + n(x - 5) + ' ' + n(y - h * .8) + 'L' + n(x + 8) + ' ' + n(y - h * .8) + 'Q' + n(x + 34) + ' ' + n(y - h * .35) + ' ' + n(x + 15) + ' ' + y + 'Z', c[4]));
      add(line(x + 4, y - h * .3, x - spread * .62, y - h * .7, c[3], 7), line(x + 4, y - h * .4, x + spread * .58, y - h * .75, c[3], 6));
      for (let i = 0; i < 7; i++) add(ellipse(x + r(-spread * .65, spread * .65), y - h + r(5, 70), r(spread * .35, spread * .55), r(25, 48), choose([c[3], c[5], c[1]]), 'stroke="' + c[6] + '" stroke-opacity=".18"'));
      if (glow) for (let i = 0; i < 9; i++) add(ellipse(x + r(-spread * .7, spread * .7), y - r(h * .55, h), 2, 3, c[7]));
    }
    add(rect(0, 0, 1280, 720, 'url(#sky)'));
    const sunX = r(180, 1100), sunY = r(85, 240), sunR = r(32, 69);
    if (!['reef', 'archive', 'forest', 'crystal'].includes(theme)) add(ellipse(sunX, sunY, sunR * 1.7, sunR * 1.7, c[8], 'opacity=".1"'), ellipse(sunX, sunY, sunR, sunR, 'url(#sun)'));
    stars(theme === 'orbital' ? 95 : 30);

    if (theme === 'reef') {
      for (let i = 0; i < 7; i++) { const x = r(100, 1180); add(polygon([[x, 0], [x + 35, 0], [x + 200, 720], [x - 130, 720]], 'url(#light)', 'opacity=".1"')); }
      mountains(base + 80, c[3], 10, 100); mountains(base + 180, c[4], 8, 80);
      const domeW = r(145, 255), domeY = base + 10;
      add(ellipse(focus, domeY, domeW, 130, 'url(#glass)', 'opacity=".7" stroke="' + c[6] + '" stroke-width="3"'), rect(focus - domeW, domeY, domeW * 2, 20, c[4], 'rx="7"'));
      for (let i = 0; i < 5; i++) tower(focus - domeW * .65 + i * domeW * .3, domeY, r(23, 38), r(45, 100), i);
      for (let i = 0; i < 22; i++) { const x = r(-20, 1300), y = r(545, 725), h = r(40, 150), color = choose([c[6], c[8], '#bd9ee9']); add(path('M' + n(x) + ' ' + n(y) + 'Q' + n(x - 22) + ' ' + n(y - h * .4) + ' ' + n(x) + ' ' + n(y - h), 'none', 'stroke="' + color + '" stroke-width="' + n(r(5, 11)) + '" stroke-linecap="round"')); for (let j = 0; j < 3; j++) add(path('M' + n(x) + ' ' + n(y - h * j / 4) + 'q' + n(r(-55, 55)) + ' -20 ' + n(r(-40, 40)) + ' -45', 'none', 'stroke="' + color + '" stroke-width="4" stroke-linecap="round"')); }
      for (let i = 0; i < 18; i++) {const x = r(40, 1240), y = r(120, 500), w = r(5, 15); add(ellipse(x, y, w, w * .45, choose([c[6], c[7], c[8]])), polygon([[x + w * .8, y], [x + w * 1.7, y - w * .6], [x + w * 1.7, y + w * .6]], c[6])); }
      for (let i = 0; i < 17; i++) add(ellipse(r(50, 1230), r(100, 660), r(3, 8), r(3, 8), 'none', 'stroke="' + c[7] + '" stroke-opacity=".35"'));
    } else if (theme === 'desert') {
      clouds(5); mountains(base - 10, c[4], 10, 110);
      for (let i = 0; i < 4; i++) { const y = base + i * 65; add(path('M-20 ' + n(y) + 'Q' + n(r(250, 500)) + ' ' + n(y - r(60, 130)) + ' 700 ' + n(y + 20) + 'T1300 ' + n(y - 40) + 'V740H-20Z', choose([c[3], c[2], '#ac7467', '#d6a77b']))); }
      const py = base + 75, pw = r(100, 160), ph = r(135, 220);
      add(polygon([[focus - pw, py], [focus, py - ph], [focus + pw, py]], 'url(#stone)'), polygon([[focus, py - ph], [focus + pw, py], [focus + 20, py]], c[6], 'opacity=".3"'));
      const tx = focus + (focus < 700 ? 250 : -300); tower(tx, py, 65, r(160, 245), 1); add(ellipse(tx + 32, py - 145, 72, 12, 'none', 'stroke="' + c[6] + '" stroke-width="4" transform="rotate(-25 ' + n(tx + 32) + ' ' + n(py - 145) + ')"'));
      for (let i = 0; i < 7; i++) tower(r(50, 1150), base + r(35, 100), r(23, 42), r(40, 95), i);
      for (let i = 0; i < 13; i++) {const x = r(80, 1190), y = r(590, 690); add(ellipse(x, y, r(15, 38), 3, c[4], 'opacity=".3"')); }
      for (let i = 0; i < 3; i++) {const x = r(200, 1120), y = r(125, 270); add(ellipse(x, y, 17, 23, 'url(#glass)'), line(x - 10, y + 17, x - 4, y + 33, c[7], 1), line(x + 10, y + 17, x + 4, y + 33, c[7], 1), rect(x - 5, y + 32, 10, 6, c[4])); }
    } else if (theme === 'aurora') {
      for (let i = 0; i < 4; i++) {const y = r(60, 180), dy = r(-40, 70); add(path('M-50 ' + n(y) + 'C220 ' + n(y - 90) + ' 410 ' + n(y + 160) + ' 670 ' + n(y + dy) + 'S1000 ' + n(y - 40) + ' 1340 ' + n(y + 20) + 'L1340 ' + n(y + 90) + 'C950 ' + n(y + 20) + ' 930 ' + n(y + 100) + ' 670 ' + n(y + dy + 45) + 'S220 ' + n(y + 10) + ' -50 ' + n(y + 45) + 'Z', 'url(#light)', 'opacity=".35"')); }
      mountains(base, c[3], 9, 250); mountains(base + 70, c[4], 11, 180); add(rect(0, base + 40, 1280, 720 - base, 'url(#sea)'));
      for (let i = 0; i < 9; i++) {const x = r(10, 1270), y = r(base + 70, 710), w = r(35, 110); add(polygon([[x - w, y], [x - w * .25, y - r(12, 36)], [x + w * .3, y - 15], [x + w, y]], c[3], 'stroke="' + c[6] + '" stroke-opacity=".5"')); }
      const y = base + 35; island(focus, y, 210, 30); tower(focus - 25, y, 50, 115, 1); add(ellipse(focus, y - 108, 42, 28, 'url(#glass)'), line(focus, y - 130, focus + 25, y - 165, c[7], 3)); ripples(base + 70, 40);
      for (let i = 0; i < 5; i++) crystal(r(0, 1280), r(630, 740), r(40, 110));
    } else if (theme === 'forest') {
      add(ellipse(focus, 155, r(60, 85), r(60, 85), 'url(#sun)', 'opacity=".65"')); mountains(base, c[5], 8, 120);
      for (let i = 0; i < 8; i++) tree(i * 185 + r(-40, 40), base + 50, r(230, 360), r(75, 115));
      add(path('M0 570Q330 410 700 555T1280 510V740H0Z', c[4]), path('M' + n(focus - 50) + ' 440Q' + n(focus + 130) + ' 590 500 720H720Q' + n(focus + 160) + ' 580 ' + n(focus + 30) + ' 440Z', 'url(#sea)'));
      const x1 = r(150, 320), x2 = r(870, 1120), by = base - 15; add(path('M' + n(x1) + ' ' + n(by - 35) + 'Q640 ' + n(by + 80) + ' ' + n(x2) + ' ' + n(by - 35), 'none', 'stroke="' + c[6] + '" stroke-width="3"'), path('M' + n(x1) + ' ' + by + 'Q640 ' + n(by + 120) + ' ' + n(x2) + ' ' + by, 'none', 'stroke="' + c[3] + '" stroke-width="13"'));
      for (let i = 0; i < 14; i++) {const x = x1 + (x2 - x1) * i / 13, y = by + Math.sin(i / 13 * Math.PI) * 56; add(line(x, y - 33, x, y, c[7], 1)); }
      for (const x of [r(20, 90), r(1180, 1260)]) tree(x, 735, r(440, 550), 160, true);
      for (let i = 0; i < 18; i++) {const x = r(100, 1180), y = r(590, 730), size = r(8, 25); add(rect(x - 2, y - size, 4, size, c[7]), ellipse(x, y - size, size, size * .4, choose([c[6], c[8]]))); }
      for (let i = 0; i < 28; i++) add(ellipse(r(70, 1210), r(270, 690), r(1, 3), r(1, 3), c[7], 'opacity=".8"'));
    } else if (theme === 'orbital') {
      const px = r(250, 1000), py = r(160, 330), pr = r(100, 175); add(ellipse(px, py, pr, pr, 'url(#sun)'), ellipse(px, py, pr * 1.8, pr * .4, 'none', 'stroke="' + c[8] + '" stroke-width="13" opacity=".5" transform="rotate(-20 ' + n(px) + ' ' + n(py) + ')"'));
      for (let i = 0; i < 4; i++) add(path('M' + n(px - pr * .85) + ' ' + n(py - pr * .5 + i * 35) + 'Q' + px + ' ' + n(py - pr * .1 + i * 27) + ' ' + n(px + pr * .85) + ' ' + n(py - pr * .5 + i * 35), 'none', 'stroke="' + c[3] + '" stroke-width="7" opacity=".3"'));
      const sx = focus, sy = base + 30, sw = r(190, 280); add(ellipse(sx, sy, sw, 45, 'none', 'stroke="' + c[3] + '" stroke-width="24"'), ellipse(sx, sy - 4, sw, 45, 'none', 'stroke="' + c[6] + '" stroke-width="4"'));
      add(line(sx - sw, sy, sx + sw, sy, c[6], 7), line(sx, sy - 125, sx, sy + 90, c[3], 15), rect(sx - 50, sy - 45, 100, 85, 'url(#stone)', 'rx="20" stroke="' + c[6] + '" stroke-width="2"'), ellipse(sx, sy - 60, 34, 31, 'url(#glass)'));
      for (const direction of [-1, 1]) {const x = sx + direction * (sw + 80); add(line(sx + direction * 60, sy, x, sy - 30, c[7], 5)); for (let i = 0; i < 3; i++) add(rect(x + i * 19 - 30, sy - 105, 16, 140, c[5], 'stroke="' + c[6] + '" stroke-width="1" transform="rotate(-15 ' + n(x) + ' ' + sy + ')"')); }
      for (let i = 0; i < 8; i++) {const x = r(40, 1240), y = r(380, 700), size = r(5, 16); add(polygon([[x - size, y], [x, y - size * .7], [x + size * 2, y + size * .4], [x, y + size]], c[3], 'stroke="' + c[6] + '" stroke-width="1"')); }
      add(path('M0 720Q600 ' + n(r(510, 650)) + ' 1280 710V740H0Z', c[4]));
    } else if (theme === 'volcano') {
      clouds(8, 80, 250); mountains(base + 20, c[4], 8, 100);
      const vx = focus, vy = base + 100, vh = r(210, 300), vw = r(200, 320); add(polygon([[vx - vw, vy], [vx - 50, vy - vh], [vx + 45, vy - vh + 5], [vx + vw, vy]], 'url(#stone)'), ellipse(vx, vy - vh + 5, 53, 15, c[4], 'stroke="' + c[6] + '" stroke-width="5"'));
      for (let i = 0; i < 4; i++) {const end = vx + r(-vw * .8, vw * .8); add(path('M' + n(vx + r(-35, 35)) + ' ' + n(vy - vh + 20) + 'Q' + n(vx + r(-100, 100)) + ' ' + n(vy - 90) + ' ' + n(end) + ' ' + vy, 'none', 'stroke="' + c[8] + '" stroke-width="' + n(r(9, 20)) + '"'), path('M' + vx + ' ' + n(vy - vh + 20) + 'Q' + n(vx + r(-100, 100)) + ' ' + n(vy - 90) + ' ' + n(end) + ' ' + vy, 'none', 'stroke="' + c[6] + '" stroke-width="3"')); }
      add(rect(0, vy, 1280, 720 - vy, c[5]), path('M0 710Q300 500 650 650T1280 580V740H0Z', c[4]));
      for (let i = 0; i < 11; i++) {const x = r(-20, 1300), y = r(570, 730); island(x, y, r(65, 190), r(30, 75)); }
      const tx = vx < 700 ? 1010 : 210; tower(tx, vy + 30, 70, 135, 0); add(ellipse(tx + 35, vy - 125, 25, 25, 'none', 'stroke="' + c[6] + '" stroke-width="4"'));
      for (let i = 0; i < 28; i++) add(ellipse(r(vx - 180, vx + 180), r(75, vy - vh + 30), r(1, 4), r(2, 6), c[6], 'opacity=".65"'));
    } else if (theme === 'skycity') {
      clouds(14, 170, 610); mountains(730, c[5], 8, 160);
      const count = Math.floor(r(4, 7));
      for (let i = 0; i < count; i++) {const x = 80 + i * 1120 / count + r(-35, 35), y = r(340, 560), w = r(110, 210); island(x, y, w, r(75, 145)); for (let j = 0; j < 3; j++) tower(x - w * .34 + j * w * .25, y, r(20, 40), r(65, 160), i + j); add(path('M' + n(x + w * .15) + ' ' + y + 'q20 90 -5 180', 'none', 'stroke="' + c[6] + '" stroke-width="5" opacity=".65"')); }
      const bx = r(250, 980), by = r(100, 220); add(ellipse(bx, by, 83, 29, 'url(#glass)'), line(bx - 40, by + 20, bx - 20, by + 62, c[7], 2), line(bx + 40, by + 20, bx + 20, by + 62, c[7], 2), path('M' + n(bx - 43) + ' ' + n(by + 57) + 'h86l-20 17h-48Z', c[4]));
      clouds(6, 590, 730);
    } else if (theme === 'archive') {
      const vanX = focus, vanY = r(260, 360); add(path('M0 720L' + vanX + ' ' + n(vanY) + 'L1280 720Z', 'url(#stone)'));
      for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {const x = side < 0 ? 30 + i * 65 : 1180 - i * 65, y = 70 + i * 25, w = 100 - i * 9, h = 590 - i * 65; add(rect(x, y, w, h, c[4], 'stroke="' + c[6] + '" stroke-opacity=".4" stroke-width="3"')); for (let shelf = 0; shelf < 6; shelf++) {const sy = y + 20 + shelf * (h - 30) / 6; add(line(x + 3, sy + 40, x + w - 3, sy + 40, c[6], 2)); for (let j = 0; j < 6; j++) add(rect(x + 8 + j * (w - 15) / 6, sy + r(4, 14), r(5, 9), r(20, 30), choose([c[3], c[6], c[8], '#77a9b5']), 'opacity=".8"')); } }
      const archW = r(130, 190), top = r(70, 125); add(path('M' + n(vanX - archW) + ' 570V' + n(top + archW) + 'a' + archW + ' ' + archW + ' 0 0 1 ' + n(archW * 2) + ' 0V570', 'none', 'stroke="' + c[6] + '" stroke-width="15"'), path('M' + n(vanX - archW + 24) + ' 570V' + n(top + archW) + 'a' + n(archW - 24) + ' ' + n(archW - 24) + ' 0 0 1 ' + n((archW - 24) * 2) + ' 0V570', 'none', 'stroke="' + c[8] + '" stroke-width="3"'));
      add(ellipse(vanX, vanY + 35, 82, 82, 'url(#sun)'), ellipse(vanX, vanY + 35, 110, 30, 'none', 'stroke="' + c[7] + '" stroke-width="3" transform="rotate(-25 ' + vanX + ' ' + n(vanY + 35) + ')"'), rect(vanX - 95, 537, 190, 25, c[3], 'rx="5"'));
      for (let i = 0; i < 9; i++) add(path('M' + n(vanX - 50 - i * 25) + ' ' + n(570 + i * 15) + 'h' + n(100 + i * 50), 'none', 'stroke="' + c[6] + '" stroke-width="3" opacity=".5"'));
      for (let i = 0; i < 8; i++) {const x = r(150, 1130), y = r(160, 480); add('<g transform="rotate(' + n(r(-30, 30)) + ' ' + n(x) + ' ' + n(y) + ')">', path('M' + n(x - 22) + ' ' + n(y - 10) + 'q14 -8 22 0q14 -8 22 0v27q-14 -6 -22 0q-14 -6 -22 0Z', 'url(#glass)', 'stroke="' + c[7] + '" stroke-width="1"'), line(x, y - 8, x, y + 17, c[4], 2), '</g>'); }
    } else if (theme === 'crystal') {
      mountains(base + 70, c[4], 8, 90); add(rect(0, base + 25, 1280, 720 - base, 'url(#sea)'));
      for (let i = 0; i < 13; i++) {const x = r(-30, 1310), h = r(90, 220); add(polygon([[x - 60, 0], [x + 45, 0], [x + r(-25, 25), h]], 'url(#stone)', 'stroke="' + c[6] + '" stroke-opacity=".3"')); }
      const portalY = base - 75, radius = r(85, 125); add(ellipse(focus, portalY, radius, radius * 1.25, 'none', 'stroke="' + c[3] + '" stroke-width="26"'), ellipse(focus, portalY, radius - 5, radius * 1.25 - 5, 'none', 'stroke="' + c[6] + '" stroke-width="4"'), ellipse(focus, portalY, radius - 18, radius * 1.25 - 18, 'url(#light)', 'opacity=".6"'));
      for (let i = 0; i < 15; i++) crystal(r(-10, 1290), r(base + 40, 735), r(70, 230), undefined, choose([c[6], c[8]]));
      for (let i = 0; i < 5; i++) {const x = r(focus - 100, focus + 100), y = r(140, 330); crystal(x, y, r(35, 60)); }
      ripples(base + 50, 35);
    } else if (theme === 'harbor') {
      clouds(9); mountains(base, c[3], 11, 130); add(rect(0, base, 1280, 720 - base, 'url(#sea)'));
      const islandY = base + 60; add(path('M-20 ' + islandY + 'Q400 ' + n(islandY - 100) + ' 780 ' + n(islandY + 30) + 'L700 620H-20Z', c[4]));
      for (let i = 0; i < 9; i++) {const x = i * 86 + r(0, 30), y = islandY + r(-20, 30), w = r(45, 75), h = r(50, 95); add(rect(x, y - h, w, h, 'url(#stone)', 'stroke="' + c[6] + '" stroke-opacity=".3"'), path('M' + n(x - 9) + ' ' + n(y - h) + 'l' + n(w / 2 + 9) + ' -30l' + n(w / 2 + 9) + ' 30q-40 12 -' + n(w + 18) + ' 0Z', choose([c[3], c[8], '#98647f']))); for (let j = 0; j < 3; j++) add(rect(x + 9 + j * (w - 16) / 3, y - h + 14, 7, 15, c[7], 'rx="3"')); }
      const lx = focus < 650 ? r(900, 1110) : r(700, 850); add(ellipse(lx, islandY + 20, 80, 13, c[4])); tower(lx - 22, islandY + 20, 44, r(140, 210), 0);
      for (let i = 0; i < 4; i++) {const x = r(300, 1200), y = r(base + 80, 660), size = r(24, 48); add(path('M' + n(x - size) + ' ' + y + 'h' + n(size * 2) + 'l-' + n(size * .5) + ' 15h-' + n(size) + 'Z', c[4]), line(x, y - size * 1.9, x, y, c[7], 2), polygon([[x - 4, y - size * 1.8], [x - size * .85, y - 8], [x - 4, y - 8]], 'url(#glass)')); }
      add(path('M0 705L' + n(r(300, 500)) + ' 600h70L180 740H0Z', 'url(#stone)')); for (let i = 0; i < 9; i++) add(line(0, 714 - i * 10, 280 + i * 15, 658 - i * 7, c[6], 1, 'opacity=".3"')); ripples(base + 30, 40);
    }
    add(rect(0, 0, 1280, 720, 'none', 'stroke="' + c[7] + '" stroke-opacity=".09" stroke-width="4"'));
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + Math.round(width * 9 / 16) + '" viewBox="0 0 1280 720">' + defs + parts.join('') + '</svg>';
  }
  return Object.freeze({ VERSION, THEMES, catalog, find, url, svg });
});
