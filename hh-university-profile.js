/* Published school facts and seven-year availability, without inferred scores. */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./hh-university-core') : root.HHUniversityCore);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HHUniversityProfile = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const number = value => new Intl.NumberFormat('vi-VN').format(value);
  const rows = value => Array.isArray(value) ? value : [];
  const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
  const SOURCE_NAMES = Object.freeze({ts247:'Tuyensinh247',hocmai:'Hướng nghiệp HOCMAI',colleges:'Danh bạ Cao Đẳng','moet-quality':'Thông tin công khai của Bộ GD&ĐT'});
  const button = (tab, title, description) => '<button type="button" class="hup-step" data-hhu-action="profile-tab" data-hhu-profile-tab="' + tab + '"><strong>' + title + '</strong><span>' + esc(description) + '</span><b aria-hidden="true">↗</b></button>';

  function checkedDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) return '';
    const date = new Date(value);
    if (!Number.isFinite(+date)) return '';
    return date.toLocaleDateString('vi-VN', {timeZone:'Asia/Bangkok'});
  }

  function summary(ctx = {}) {
    const school = ctx.school || {}, institution = school.institution || {}, id = C.safeId(institution.id) ? institution.id : '';
    const entry = ctx.entry?.id === id ? ctx.entry : {};
    const campus = ctx.campus?.schoolId === id ? ctx.campus : null;
    const yearRows = C.YEARS.map(year => {
      const source = school.scoreYears?.[year], available = source?.available === true;
      return {year, available, rows:available ? count(source.rows) : null};
    });
    const sources = [], seen = new Set();
    const add = (url, label, kind) => {
      const href = C.safeURL(url);
      if (!href || seen.has(href)) return;
      seen.add(href); sources.push({url:href,label:String(label || 'Nguồn tham khảo'),kind});
    };
    const website = C.safeURL(institution.officialWebsite) || C.safeURL(entry.officialWebsite) || C.safeURL(campus?.officialUrl);
    add(website, 'Website của trường', 'website');
    for (const source of rows(institution.sources)) add(source.url, SOURCE_NAMES[source.id] || source.name || source.id, 'directory');
    add(school.admissionSourceUrl, 'Thông tin tuyển sinh được ghi trong bản nhập', 'admissions');
    for (const curriculum of rows(school.curricula)) add(curriculum.url, 'Chương trình học: ' + (curriculum.name || 'Bảng học phần'), 'curriculum');
    const knownScoreRows = yearRows.reduce((total, row) => total + (row.rows ?? 0), 0);
    return {
      id, name:String(institution.name || entry.name || 'Hồ sơ trường'),
      programmes:rows(school.programmes).length, majors:rows(school.majors).length,
      curricula:rows(school.curricula).length, officialProgrammeReferences:rows(school.officialProgrammes).length,
      yearRows, years:yearRows.filter(row => row.available).length, knownScoreRows,
      scoreCountsComplete:yearRows.every(row => !row.available || row.rows !== null),
      checkedAt:checkedDate(school.checkedAt), website, sources
    };
  }

  function render(ctx = {}) {
    const facts = summary(ctx), selectedYear = C.YEARS.includes(Number(ctx.year)) ? Number(ctx.year) : 2026;
    const isScoreTab = ctx.tab === 'scores', open = !ctx.tab || ctx.tab === 'majors';
    const metrics = [
      ['programmes', facts.programmes, 'chương trình ghi nhận'],
      ['curricula', facts.curricula, 'bảng chương trình học'],
      ['scores', facts.knownScoreRows, (facts.scoreCountsComplete ? '' : 'ít nhất ') + 'bản ghi điểm trong 7 năm']
    ];
    const sourceLinks = facts.sources.map(source => '<li><a href="' + esc(source.url) + '" target="_blank" rel="noopener noreferrer">' + esc(source.label) + ' <span aria-hidden="true">↗</span></a></li>').join('');
    const years = facts.yearRows.map(row => {
      const label = row.available ? row.rows === null ? 'Có dữ liệu' : number(row.rows) + ' bản ghi' : 'Chưa có bản ghi';
      return '<button type="button" class="hup-year' + (row.available ? ' hup-year-present' : ' hup-year-missing') + '" data-hhu-action="profile-year" data-hhu-profile-year="' + row.year + '" aria-pressed="' + (isScoreTab && selectedYear === row.year) + '" aria-label="' + esc('Xem điểm chuẩn ' + row.year + ': ' + label) + '"><strong>' + row.year + '</strong><span>' + label + '</span></button>';
    }).join('');
    return '<section class="hup" aria-label="Thông tin nhanh của trường"><details class="hup-overview"' + (open ? ' open' : '') + '><summary><span><strong>Thông tin nhanh</strong><small>' + facts.years + '/7 năm có dữ liệu điểm' + (facts.checkedAt ? ' · Bản nhập ' + esc(facts.checkedAt) : '') + '</small></span><b aria-hidden="true">⌄</b></summary><div class="hup-content"><div class="hup-metrics">' + metrics.map(([key, value, label]) => '<div data-hup-metric="' + key + '"><strong>' + number(value) + '</strong><span>' + label + '</span></div>').join('') + '</div><p class="hup-note">Số liệu phản ánh bản dữ liệu đã nhập, có thể gồm chương trình của nhiều năm.</p>' +
      '<div class="hup-year-heading"><h2>Chọn năm để tra điểm</h2><span>' + facts.years + ' năm có bản ghi · ' + (7 - facts.years) + ' năm chưa có bản ghi</span></div><div class="hup-years" role="group" aria-label="Dữ liệu điểm chuẩn theo năm">' + years + '</div><p class="hup-note">Chưa có bản ghi không đồng nghĩa trường không tuyển sinh hoặc điểm bằng 0. Khi tra điểm, hãy giữ đúng phương thức và thang điểm.</p>' +
      '<div class="hup-steps" role="group" aria-label="Các bước tìm hiểu trường">' + button('majors','1. Tìm ngành phù hợp',facts.majors ? number(facts.majors) + ' nhóm mã ngành để xem chương trình và năm xuất hiện.' : 'Mở danh sách ngành; phần chưa có dữ liệu được ghi rõ.') + button('curricula','2. Xem kế hoạch học',facts.curricula ? number(facts.curricula) + ' bảng chương trình học có liên kết nguồn.' : 'Chưa có bảng học phần trong bản nhập này.') + button('sources','3. Đối chiếu nguồn','Xem thông báo tuyển sinh, nguồn dữ liệu và tài liệu gốc.') + '</div>' +
      '<details class="hup-sources"><summary>Nguồn cho hồ sơ này <span>' + facts.sources.length + ' liên kết</span></summary>' + (sourceLinks ? '<ul>' + sourceLinks + '</ul>' : '<p>Chưa có liên kết nguồn hợp lệ trong bản nhập này.</p>') + '<p class="hup-note">Thông tin nguồn và các bảng đã nhập không xác nhận đầy đủ ngành đang tuyển hoặc tình trạng kiểm định hiện tại.</p></details></div></details></section>';
  }

  return Object.freeze({summary,render});
});
