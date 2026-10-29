/* Deterministic University journeys, views and explicit cloud snapshots. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HHUniversityExperienceCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const criteria = ['type', 'programme', 'campus', 'tuition', 'scholarship', 'curriculum', 'outcomes', 'scores', 'accreditation'];
  const scopes = ['compare', 'wishes', 'calendar', 'planner'];
  const text = (v, n = 1000) => typeof v === 'string' ? v.slice(0, n) : '';
  const fail = m => { throw Error(m); };
  const id = v => typeof v === 'string' && /^[a-z0-9][a-z0-9:._-]{0,220}$/.test(v);
  const rows = (v, max) => v === undefined ? [] : Array.isArray(v) && v.length <= max ? v : fail('Danh sách mở rộng cần khôi phục.');
  const plain = v => v && typeof v === 'object' && !Array.isArray(v);
  function day(v) {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
    const d = new Date(v + 'T00:00:00Z');
    return Number.isFinite(+d) && d.toISOString().slice(0, 10) === v ? v : '';
  }
  const clock = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v)) ? v : '';
  const keyOf = r => r.schoolId + ':' + (r.programId || 'school');
  function selection(r) {
    if (!plain(r) || !id(r.schoolId) || r.programId && !id(r.programId)) fail('Lựa chọn trong bảng đã lưu chưa hợp lệ.');
    return {schoolId: r.schoolId, programId: r.programId || '', note: text(r.note, 2000)};
  }
  function filters(raw = {}) {
    return {q: text(raw.q, 200), family: text(raw.family, 60) || 'all', province: text(raw.province, 160) || 'all', level: ['university', 'college'].includes(raw.level) ? raw.level : 'all', year: /^(202[0-6])$/.test(String(raw.year)) ? String(raw.year) : 'all'};
  }
  function searchURL(raw, kind='majors') {
    const f = filters(raw), p = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v && v !== 'all' && (kind!=='schools'||['q','level','province'].includes(k))) p.set(k, v);
    return (kind==='schools'?'/university':'/university/majors') + (p.size ? '?' + p : '');
  }
  function defaults() {
    return {schemaVersion: 1, journey: '', started: false, recentSearch: null, recentSchoolSearch:null, schoolSearches:[], savedSearches: [], boards: [], activeBoard: '', compare: {criteria: criteria.slice(), differencesOnly: false, pinned: 'type', view: 'auto'}, wishDetails: [], scenarios: [], calendar: {view: 'list', month: '', school: '', category: 'all', showDone: true}, timetableTerm: '1', library: {field: 'all', rights: 'all', reviewed: 'all',language:'all',level:'all'}, history: [], attempts: [], cvLayout: 'classic'};
  }
  function normalize(raw) {
    if (raw === undefined || raw === null) return defaults();
    if (!plain(raw) || raw.schemaVersion !== 1) fail('Phiên bản không gian mới cần được giữ để phục hồi.');
    const d = defaults(), c = raw.compare || {}, cal = raw.calendar || {}, lib = raw.library || {};
    for (const v of [c, cal, lib]) if (!plain(v)) fail('Cấu trúc tùy chọn chưa hợp lệ.');
    const checks = v => rows(v, 20).map(r => { if (!id(r.id)) fail('Checklist nguyện vọng chưa hợp lệ.'); return {id: r.id, title: text(r.title, 300), done: r.done === true}; });
    return {...d, journey: ['explore', 'student'].includes(raw.journey) ? raw.journey : '', started: raw.started === true,
      recentSearch: raw.recentSearch ? filters(raw.recentSearch) : null, recentSchoolSearch:raw.recentSchoolSearch?filters(raw.recentSchoolSearch):null, schoolSearches:rows(raw.schoolSearches,20).map(r=>{if(!id(r.id))fail('Tìm trường đã lưu chưa hợp lệ.');return {id:r.id,name:text(r.name,100),filters:filters(r.filters)};}),
      savedSearches: rows(raw.savedSearches, 20).map(r => { if (!id(r.id)) fail('Tìm kiếm đã lưu chưa hợp lệ.'); return {id: r.id, name: text(r.name, 100), filters: filters(r.filters)}; }),
      boards: rows(raw.boards, 12).map(r => { if (!id(r.id)) fail('Bảng so sánh đã lưu chưa hợp lệ.'); const choices = rows(r.rows, 4).map(selection); if (new Set(choices.map(keyOf)).size !== choices.length) fail('Bảng có lựa chọn trùng.'); return {id: r.id, name: text(r.name, 100), rows: choices, notes: text(r.notes, 5000), criteria: rows(r.criteria, 9).filter(v => criteria.includes(v)), details: rows(r.details, 4).map(v => ({key: text(v.key, 420), pros: text(v.pros, 1000), cons: text(v.cons, 1000), questions: text(v.questions, 1000)}))}; }),
      activeBoard: text(raw.activeBoard, 220),
      compare: {criteria: c.criteria === undefined ? criteria.slice() : rows(c.criteria, 9).filter(v => criteria.includes(v)), differencesOnly: c.differencesOnly === true, pinned: criteria.includes(c.pinned) ? c.pinned : 'type', view: ['auto', 'table', 'cards'].includes(c.view) ? c.view : 'auto'},
      wishDetails: rows(raw.wishDetails, 100).map(r => ({key: text(r.key, 420), method: text(r.method, 300), missing: text(r.missing, 1500), checks: checks(r.checks)})),
      scenarios: rows(raw.scenarios, 12).map(r => { if (!id(r.id) || !plain(r.budget)) fail('Kịch bản dự toán chưa hợp lệ.'); const b = r.budget, numbers = ['tuitionLow', 'tuitionHigh', 'units', 'months', 'livingLow', 'livingHigh', 'other', 'scholarship']; for (const k of numbers) if (!Number.isFinite(b[k]) || b[k] < 0 || b[k] > 1e10) fail('Số liệu kịch bản chưa hợp lệ.'); if(b.units<.25||b.units>300||b.months>120||b.tuitionHigh<b.tuitionLow||b.livingHigh<b.livingLow)fail('Khoảng hoặc đơn vị kịch bản chưa hợp lệ.'); return {id: r.id, name: text(r.name, 100), note: text(r.note, 1000), budget: {schoolId: text(b.schoolId, 120), tuitionId: text(b.tuitionId, 160), unit: ['term', 'year', 'credit', 'manual'].includes(b.unit) ? b.unit : 'manual', ...Object.fromEntries(numbers.map(k => [k, b[k]]))}}; }),
      calendar: {view: cal.view === 'month' ? 'month' : 'list', month: /^\d{4}-(0[1-9]|1[0-2])$/.test(cal.month || '') ? cal.month : '', school: text(cal.school, 120), category: ['all', 'admission', 'scholarship', 'class', 'exam', 'assignment', 'personal'].includes(cal.category) ? cal.category : 'all', showDone: cal.showDone !== false},
      timetableTerm: /^([1-9]|[12]\d|30)$/.test(String(raw.timetableTerm)) ? String(raw.timetableTerm) : '1',
      library: {field: text(lib.field, 80) || 'all', rights: text(lib.rights, 80) || 'all', reviewed: ['all', 'not-reviewed', 'reviewed'].includes(lib.reviewed) ? lib.reviewed : 'all',language:['all','en','vi','unknown'].includes(lib.language)?lib.language:'all',level:['all','undergraduate','graduate','unknown'].includes(lib.level)?lib.level:'all'},
      history: rows(raw.history, 100).map(r => { if (!id(r.courseId) || r.lessonId && !id(r.lessonId) || !day(r.date)) fail('Lịch sử đọc cần khôi phục.'); return {courseId: r.courseId, lessonId: r.lessonId || '', date: r.date}; }),
      attempts: rows(raw.attempts, 100).map(r => { if (!id(r.id) || !day(r.date) || !Number.isInteger(r.total) || r.total < 1 || r.total > 30 || !Number.isInteger(r.correct) || r.correct < 0 || r.correct > r.total) fail('Kết quả luyện tập cần khôi phục.'); return {id: r.id, date: r.date, courseId: text(r.courseId, 120), correct: r.correct, total: r.total}; }),
      cvLayout: raw.cvLayout === 'compact' ? 'compact' : 'classic'};
  }
  function monthDays(month) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) fail('Tháng chưa hợp lệ.');
    const first = new Date(month + '-01T00:00:00Z'), shift = (first.getUTCDay() + 6) % 7;
    return Array.from({length: 42}, (_, i) => { const d = new Date(+first + (i - shift) * 86400000); return {date: d.toISOString().slice(0, 10), current: d.toISOString().startsWith(month)}; });
  }
  function shiftMonth(month, delta) {
    monthDays(month); const d = new Date(month + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + delta); return d.toISOString().slice(0, 7);
  }
  function eventCategory(e) { return ['admission', 'scholarship', 'class', 'exam', 'assignment', 'personal'].includes(e.category) ? e.category : e.source ? 'admission' : 'personal'; }
  function filterEvents(events, f, today) {
    return events.filter(e => (!f.school || e.schoolId === f.school) && (f.category === 'all' || eventCategory(e) === f.category) && (f.showDone || !e.done)).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).map(e => ({...e, overdue: !e.done && e.date < today}));
  }
  function eventConflicts(events) {
    const results = [];
    for (let i = 0; i < events.length; i++) for (let j = i + 1; j < events.length; j++) {
      const a = events[i], b = events[j];
      if (!a.done && !b.done && a.date === b.date && clock(a.time) && clock(a.end) && clock(b.time) && clock(b.end) && a.time < a.end && b.time < b.end && a.time < b.end && b.time < a.end) results.push([a.id, b.id]);
    }
    return results;
  }
  function cloudPack(state, requested, T) {
    if (!Array.isArray(requested) || !requested.length || requested.some(s => !scopes.includes(s)) || new Set(requested).size !== requested.length) fail('Chọn phạm vi bản sao hợp lệ.');
    const s = T.state(state), data = {}, e = {};
    if (requested.includes('compare')) { data.compare = s.compare; data.compareNotes = s.compareNotes; e.boards = s.experience.boards; e.compare = s.experience.compare; }
    if (requested.includes('wishes')) { data.wishes = s.wishes; e.wishDetails = s.experience.wishDetails; }
    if (requested.includes('calendar')) { data.events = s.events; data.tasks = s.tasks; e.calendar = s.experience.calendar; }
    if (requested.includes('planner')) { data.planner = s.planner; e.timetableTerm = s.experience.timetableTerm; }
    data.experience = {...defaults(), ...e};
    return {schemaVersion: 1, scopes: requested.slice(), data};
  }
  function cloudApply(local, pack, T) {
    if (!plain(pack) || pack.schemaVersion !== 1 || !plain(pack.data)) fail('Bản sao máy chủ chưa đúng phiên bản.');
    const canonical = cloudPack(T.state({...T.defaults(), ...pack.data}), pack.scopes, T), next = T.state(local), p = canonical.data;
    for (const scope of canonical.scopes) {
      if (scope === 'compare') { next.compare = p.compare; next.compareNotes = p.compareNotes; next.experience.boards = p.experience.boards; next.experience.compare = p.experience.compare;if(!p.experience.boards.some(b=>b.id===next.experience.activeBoard))next.experience.activeBoard=''; }
      if (scope === 'wishes') { next.wishes = p.wishes; next.experience.wishDetails = p.experience.wishDetails; }
      if (scope === 'calendar') { next.events = p.events; next.tasks = p.tasks; next.experience.calendar = p.experience.calendar; }
      if (scope === 'planner') { next.planner = p.planner; next.experience.timetableTerm = p.experience.timetableTerm; }
    }
    return T.state(next);
  }
  return Object.freeze({criteria, scopes, text, day, clock, filters, searchURL, defaults, normalize, keyOf, monthDays, shiftMonth, eventCategory, filterEvents, eventConflicts, cloudPack, cloudApply});
});
