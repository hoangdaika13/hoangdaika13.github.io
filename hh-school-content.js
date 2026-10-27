(function initHHSchoolContent(scope) {
  'use strict';
  const node = typeof module === 'object' && module.exports;
  const manifest = node ? require('./hh-school-content-manifest.js') : scope.HHSchoolContentManifest;
  const cache = new Map(), pending = new Map();
  const clone = value => JSON.parse(JSON.stringify(value));
  const freeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
  const gradeNumber = input => {
    const number = Number(String(input).replace(/^grade-/, ''));
    if (!Number.isInteger(number) || number < 1 || number > 12) throw Error('Lớp phải nằm trong khoảng 1–12.');
    return number;
  };
  const abort = () => Object.assign(Error('Đã dừng tải gói học.'), { name: 'AbortError' });
  function validatePack(pack, expectedGrade) {
    const errors = [], seen = new Set();
    const subjects = Array.isArray(pack?.subjects) ? pack.subjects : [];
    const lessons = Array.isArray(pack?.lessons) ? pack.lessons : [];
    const outcomes = Array.isArray(pack?.outcomes) ? pack.outcomes : [];
    if (!pack || pack.schemaVersion !== 1 || pack.grade !== expectedGrade || pack.contentVersion !== manifest.version) errors.push('Phiên bản hoặc lớp không khớp manifest.');
    if (!Array.isArray(pack?.subjects) || !Array.isArray(pack?.lessons) || !Array.isArray(pack?.outcomes)) errors.push('Thiếu danh mục, bài học hoặc mục tiêu.');
    for (const lesson of lessons) {
      if (!lesson || typeof lesson !== 'object') { errors.push('Bản ghi bài học không hợp lệ.'); continue; }
      if (!lesson.lessonId || seen.has(lesson.lessonId)) errors.push('ID bài học bị thiếu hoặc trùng.');
      seen.add(lesson.lessonId);
      if (lesson.gradeId !== 'grade-' + expectedGrade || !subjects.some(subject => subject?.id === lesson.subjectId)) errors.push('Bài học không thuộc lớp–môn.');
      if (!Array.isArray(lesson.steps) || !lesson.steps.length || !Array.isArray(lesson.questions) || !lesson.questions.length) errors.push('Bài học thiếu nội dung hoặc luyện tập.');
      if (!Array.isArray(lesson.outcomeIds) || !lesson.outcomeIds.length || lesson.outcomeIds.some(id => !outcomes.some(outcome => outcome?.id === id && outcome.subjectId === lesson.subjectId && typeof outcome.text === 'string' && outcome.text.trim()))) errors.push('Bài học chưa liên kết mục tiêu.');
      if (!lesson.source || !['draft', 'checked', 'reviewed', 'approved'].includes(lesson.contentStatus)) errors.push('Trạng thái nội dung không hợp lệ.');
      if (['reviewed', 'approved'].includes(lesson.contentStatus) && (!lesson.reviewerId || !lesson.reviewedAt || !lesson.reviewEvidence)) errors.push('Bản xuất bản thiếu bằng chứng thẩm định.');
    }
    return { ok: errors.length === 0, errors };
  }
  async function loadGrade(input, options = {}) {
    const grade = gradeNumber(input);
    if (options.signal?.aborted) throw abort();
    if (!manifest) throw Error('Manifest học liệu chưa được tải.');
    if (cache.has(grade)) return cache.get(grade);
    if (!options.signal && pending.has(grade)) return pending.get(grade);
    const entry = manifest.grades.find(item => item.grade === grade);
    if (!entry) throw Error('Chưa có gói học cho lớp này.');
    const work = (async () => {
      let serialized, digest;
      if (node) {
        const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
        serialized = fs.readFileSync(path.resolve(__dirname, entry.url.split('?')[0]), 'utf8');
        digest = crypto.createHash('sha256').update(serialized).digest('hex');
      } else {
        const response = await scope.fetch(new URL(entry.url, scope.document.baseURI).href, { signal: options.signal, credentials: 'same-origin' });
        if (!response.ok) throw Error('Không tải được gói học (HTTP ' + response.status + '). Hãy thử lại.');
        serialized = await response.text();
        if (!scope.crypto?.subtle) throw Error('Trình duyệt chưa xác minh được gói học; dữ liệu đã lưu vẫn được giữ.');
        const bytes = new TextEncoder().encode(serialized);
        digest = Array.from(new Uint8Array(await scope.crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
      }
      if (options.signal?.aborted) throw abort();
      if (serialized.length > 3_000_000 || digest !== entry.sha256) throw Error('Gói học không khớp checksum; chưa thay dữ liệu đang có.');
      const pack = JSON.parse(serialized), validation = validatePack(pack, grade);
      if (!validation.ok) throw Error(validation.errors.join(' '));
      cache.set(grade, freeze(pack));
      return cache.get(grade);
    })();
    if (!options.signal) pending.set(grade, work);
    try { return await work; } finally { if (pending.get(grade) === work) pending.delete(grade); }
  }
  function buildLegacyPack(input, basePack, options = {}) {
    const grade = gradeNumber(input), pack = cache.get(grade);
    if (!pack) throw Error('Cần tải gói lớp trước khi mở nội dung.');
    const curriculum = node ? require('./hh-school-curriculum.js') : scope.HHSchoolCurriculum;
    const lessons = options.includeDrafts === true ? pack.lessons : pack.lessons.filter(lesson => curriculum?.canPublish?.(lesson) === true);
    return {
      ...basePack, version: pack.contentVersion, schemaVersion: 3, checksum: manifest.grades.find(item => item.grade === grade).sha256,
      lessons: clone(lessons), subjects: clone(pack.subjects), chapters: clone(pack.subjects.flatMap(subject => subject.chapters || [])),
      requirements: clone(pack.outcomes.map(outcome => ({ subjectId: outcome.subjectId, outcome: outcome.text, id: outcome.id, status: outcome.status, sourceRef: outcome.sourceRef }))),
      outcomes: clone(pack.outcomes), sources: clone(pack.sources), coverage: clone(pack.coverage),
      assessments: [], missions: [], archivedLessons: clone(basePack?.lessons || []),
      editorialNotice: 'Học liệu nguyên bản đang ở chế độ xem thử; chưa được thẩm định chuyên môn, chưa được tính là giáo trình đã xuất bản đầy đủ.',
      preview: options.includeDrafts === true
    };
  }
  const api = Object.freeze({ VERSION: 1, manifest, loadGrade, peekGrade: input => cache.get(gradeNumber(input)) || null, buildLegacyPack, validatePack, coverage: input => input ? manifest.grades.find(item => item.grade === gradeNumber(input))?.coverage : manifest.coverage });
  scope.HHSchoolContent = api;
  if (node) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
