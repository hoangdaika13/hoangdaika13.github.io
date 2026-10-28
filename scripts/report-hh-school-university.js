'use strict';
// Reproducible coverage evidence. Counts are local scope, never degree coverage.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'docs/education');
const catalogue = require('../data/hh-school/university/catalogue.json');
const courses = catalogue.courses.map(entry => require(path.join(root, entry.url.split('?')[0])));
const sources = require('../data/hh-school/university/sources.json');
const audit = require('../data/hh-school/university/link-audit.json');
const cell = value => String(value ?? 'Chưa xác định').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
const resources = catalogue.resources.map(r => ({ id: r.id, url: r.url, rights: r.rights, licenseDeclared: r.licenseDeclared, checkedAt: r.checkedAt, linkCheck: r.linkCheck }));
const matrix = {
  schemaVersion: 1,
  release: 1068,
  contentVersion: catalogue.version,
  checkedAt: '2026-10-28',
  methodology: 'Authored outcomes are the denominator only for the six HH foundation sequences. Programme rows are unique visible course codes extracted from two UIT tables, not graduation requirements or complete syllabi. External resources are bibliography and links only.',
  totals: { ...catalogue.coverage, resources: resources.length, externalBooks: sources.resources.length, officialProgrammes: sources.programs.length, authoredOutcomes: courses.reduce((n, c) => n + c.outcomes.length, 0), publishedCourses: 0, approvedLessons: 0, officialProgrammeCompletion: null },
  fieldGroups: catalogue.fields.map(field => ({ ...field, courseIds: courses.filter(c => c.fieldId === field.id).map(c => c.id), resourceIds: catalogue.resources.filter(r => r.fieldIds.includes(field.id)).map(r => r.id), status: courses.some(c => c.fieldId === field.id) ? 'authored-foundation-drafts-and-external-links' : 'external-bibliography-only', officialOutcomeCount: null })),
  programmes: sources.programs.map(p => ({ institutionId: p.institutionId, id: p.id, title: p.title, cohort: p.cohort, version: p.version, url: p.url, scope: p.scope, catalogueRowDenominator: p.courses.length, officialRequiredCourseCount: null, verifiedCompleteSyllabi: 0, graduationRulesVerified: false, courses: p.courses.map(c => ({ ...c, cataloguePresent: true, syllabusVerified: false, fullInAppContent: false, practiceComplete: false, academicReview: 'not-reviewed', published: false, rights: 'metadata-and-source-link-only', officialOutcomeCount: null })) })),
  authoredSequences: courses.map(c => ({
    id: c.id, title: c.title, titleEn: c.titleEn, fieldId: c.fieldId,
    scope: c.scope, contentStatus: c.contentStatus, reviewEvidence: c.reviewEvidence,
    officialComplete: c.officialComplete, credits: c.credits, sourceIds: c.sourceIds,
    officialOutcomeCount: null, authoredOutcomeCount: c.outcomes.length,
    diagnosticQuestionIds: c.diagnostic.map(q => q.id), project: c.project,
    outcomes: c.outcomes.map(outcome => ({
      ...outcome,
      lessonIds: c.lessons.filter(l => l.outcomeId === outcome.id).map(l => l.id),
      questions: c.lessons.flatMap(l => l.questions).filter(q => q.outcomeIds.includes(outcome.id)).map(q => ({ id: q.id, type: q.type })),
      activities: c.lessons.filter(l => l.outcomeId === outcome.id).map(l => ({ lessonId: l.id, task: l.activity.task, expected: l.activity.expected })),
      assessmentBlueprint: c.blueprint, sourceIds: c.sourceIds,
      rights: 'HH-original-draft; external references linked only', academicReview: 'not-reviewed', published: false
    }))
  })),
  resources,
  linkAudit: { total: audit.rows.length, http200: audit.rows.filter(r => r.http === 200).length, unresolved: audit.rows.filter(r => r.http !== 200) },
  limits: [
    'No verified denominator for complete degree programmes or external university learning outcomes.',
    'Six original foundation sequences only; no claim to cover MIT, Harvard, Berkeley or UIT full courses.',
    'Zero academically approved or formally published university courses; preview is explicit.',
    'No external textbook, PDF, video, notebook, exam or source code copied into the app.',
    'Groups without authored sequences contain bibliography only. Law and health content is not authored or professionally reviewed.',
    'Unknown compulsory/elective status, prerequisite graph, term placement and graduation rules remain unknown.',
    'Local simulations are bounded teaching models, not general code runners or supervised practical laboratory replacements.'
  ]
};
for (const course of matrix.authoredSequences) for (const outcome of course.outcomes) {
  if (!outcome.lessonIds.length || !outcome.questions.length || !outcome.activities.length) throw Error('Unmapped authored outcome: ' + outcome.id);
}
fs.mkdirSync(directory, { recursive: true });
const basename = 'hh-school-university-coverage-2026-10-28';
fs.writeFileSync(path.join(directory, basename + '.json'), JSON.stringify(matrix, null, 2) + '\n');
let markdown = '# HH School University — ma trận độ phủ 28/10/2026\n\n';
markdown += 'Bản 1068. Các mẫu số dưới đây chỉ áp dụng cho phạm vi đã xác minh. Chưa có mẫu số chuẩn đầu ra của toàn bộ chương trình đại học, nên không tính phần trăm hoàn thành bằng cấp. [Dữ liệu chi tiết](' + basename + '.json).\n\n';
markdown += '6 chuỗi nguyên bản, 36 bài, 126 câu (108 luyện + 18 chẩn đoán), 36 mục tiêu tự biên soạn. 0 học phần đã thẩm định, 0 học phần được công bố chính thức. Hai bảng UIT có 176 mã môn duy nhất theo từng chương trình. 65 liên kết gồm 47 sách, 13 cổng/trang khóa học và 5 repo GitHub.\n\n';
markdown += '## Nhóm ngành\n\n| Nhóm | Chuỗi có bài trong ứng dụng | Học liệu tại nguồn | Phạm vi |\n|---|---:|---:|---|\n';
for (const field of matrix.fieldGroups) markdown += '| ' + [field.name, field.courseIds.length, field.resourceIds.length, field.courseIds.length ? 'Nền tảng nguyên bản, chờ thẩm định' : 'Thư mục và liên kết; chưa có bài trong ứng dụng'].map(cell).join(' | ') + ' |\n';
markdown += '\n## Chương trình đối chiếu\n\n| Trường/chương trình/khóa | Mã môn ghi nhận | Đề cương đầy đủ đã xác minh | Điều kiện tốt nghiệp |\n|---|---:|---:|---|\n';
for (const p of matrix.programmes) markdown += '| ' + [p.title + ' — ' + p.cohort, p.catalogueRowDenominator, 0, 'Chưa xác định'].map(cell).join(' | ') + ' |\n';
markdown += '\nDanh mục chỉ nhập mã, tên và tín chỉ hiển thị trong bảng nguồn. Gợi ý học bổ trợ không phải công nhận tương đương; chưa xác minh bắt buộc/tự chọn, tiên quyết, năm/kỳ và mọi điều kiện chương trình.\n\n## Chuỗi nguyên bản\n\n| Chuỗi | Bài/mục tiêu | Câu luyện + chẩn đoán | Đánh giá | Phạm vi còn thiếu |\n|---|---:|---:|---|---|\n';
for (const c of courses) markdown += '| ' + [c.title, c.lessons.length + '/' + c.outcomes.length, c.lessons.reduce((n,l) => n+l.questions.length,0) + '+' + c.diagnostic.length, 'Đề cân bằng 12 câu, thi thử 30 phút, dự án/rubric', c.scope].map(cell).join(' | ') + ' |\n';
markdown += '\n## Mục tiêu → bài → hoạt động → câu hỏi\n\n| Chuỗi / mục tiêu | Bài học | Câu hỏi | Thực hành | Trạng thái |\n|---|---|---|---:|---|\n';
for (const c of matrix.authoredSequences) for (const o of c.outcomes) markdown += '| ' + [c.id + ' / ' + (o.text || o.id), o.lessonIds.join(', '), o.questions.map(q => q.id).join(', '), o.activities.length, 'Bản nháp / chưa thẩm định'].map(cell).join(' | ') + ' |\n';
markdown += '\n## Giới hạn\n\n' + matrix.limits.map(s => '- ' + s).join('\n') + '\n\nTạo lại bằng `node scripts/report-hh-school-university.js` sau khi build nội dung. Thông tin nguồn, giấy phép và hạn chế truy cập được bàn giao riêng trong [kiểm kê nguồn](hh-school-university-sources-2026-10-28.md).\n';
fs.writeFileSync(path.join(directory, basename + '.md'), markdown);
let sourceReport = '# HH School University — kiểm kê nguồn 28/10/2026\n\n';
sourceReport += 'Bản 1068 chỉ nhập metadata thư mục công khai và lưu liên kết. Không nhập toàn văn giáo trình, hình, video, bài thi, notebook hoặc mã nguồn bên ngoài. Nội dung sáu chuỗi học được biên soạn nguyên bản bằng tiếng Việt và đang chờ thẩm định.\n\n';
sourceReport += '## Phạm vi xác minh\n\n';
sourceReport += '- UIT: đọc hai bảng chương trình, giữ mã/tên/tín chỉ hiển thị; chống trùng mã theo từng chương trình. 85 mã ngành Kỹ thuật Phần mềm khóa 2025 và 91 mã ngành Khoa học Dữ liệu khóa 2024. Chưa nhập toàn bộ quy tắc tốt nghiệp, phân kỳ, loại bắt buộc/tự chọn hoặc chuẩn đầu ra.\n';
sourceReport += '- MIT OCW, CS50, Data 8 và Full Stack Open: đối chiếu trang khóa học/đề cương và điều kiện nguồn; không nhận là toàn bộ nội dung các khóa học này. Mỗi chuỗi HH ghi rõ các chủ đề còn thiếu.\n';
sourceReport += '- Open Textbook Library: dùng API đọc thư mục công khai, tìm ba đầu sách cho mỗi nhóm ngành và chống trùng ID; còn 47 sách duy nhất trên 16 nhóm. Chỉ nhập tiêu đề, tác giả, metadata giấy phép và URL, không sao chép mô tả/review hoặc nội dung sách. Lựa chọn đầu sách chưa được giảng viên thẩm định về mức phù hợp. [API chính thức](https://open.umn.edu/opentextbooks/api-docs/index.html).\n';
sourceReport += '- SoICT/HUST và UEH hiện chỉ có liên kết cổng; chưa nhập chương trình/khóa riêng. Open Yale, TU Delft và OpenStax là điểm truy cập nguồn; chưa đọc và nhập toàn bộ môn trên các hệ thống đó.\n';
sourceReport += '- GitHub: kiểm tra liên hệ từ trang môn/trường được lưu ở verificationUrl, đọc metadata repo/commit/license và ghim SHA. Không thực thi lệnh trong README hoặc tải/chạy mã repo. Bài làm sinh viên không được trộn thành nguồn chính thức.\n\n';
sourceReport += '## Chương trình gốc\n\n';
for (const p of sources.programs) sourceReport += '- [' + p.title + ' — ' + p.cohort + '](' + p.url + '): ' + p.courses.length + ' mã môn; phiên bản ' + p.version + '.\n';
sourceReport += '\n## GitHub được ghim\n\n| Repo | Branch / file | Commit SHA | Khai báo API | Đối chiếu từ khóa học |\n|---|---|---|---|---|\n';
for (const g of sources.github) sourceReport += '| [' + g.repo + '](' + g.url + ') | ' + cell(g.branch + ' / ' + g.path) + ' | `' + g.commit + '` | ' + cell(g.licenseDeclared) + ' | [Nguồn xác nhận](' + g.verificationUrl + ') |\n';
sourceReport += '\n`NOASSERTION` nghĩa là API chưa xác định giấy phép, không phải quyền tái sử dụng. GPL-3.0 của thư viện CS50 không tự áp dụng cho bài giảng hoặc tài sản khác. Sách Data 8 công bố CC BY-NC-ND 4.0; Full Stack Open công bố điều kiện văn bản và mã nguồn riêng. OpenStax cần đối chiếu điều kiện CC BY-NC-SA cùng ấn bản và tài sản cụ thể. Bản phát hành này giữ tất cả nguồn ngoài ở chế độ chỉ liên kết.\n\n';
sourceReport += '## Danh mục tài liệu và phạm vi quyền\n\n| Tài liệu | Đơn vị | Loại | Khai báo quyền tại nguồn | Phạm vi tích hợp |\n|---|---|---|---|---|\n';
for (const resource of catalogue.resources) sourceReport += '| [' + cell(resource.title) + '](' + resource.url + ') | ' + cell(resource.provider || resource.authors || resource.author) + ' | ' + cell(resource.type) + ' | ' + cell(resource.licenseDeclared || 'Chưa xác minh') + ' | ' + cell(resource.rights) + ' |\n';
sourceReport += '\n## Truy cập và cập nhật\n\n';
sourceReport += 'Kiểm tra ngày 28/10/2026: 64/65 URL trả HTTP 200 qua công cụ HTTP; TU Delft trả lỗi fetch trong Node. Trang TU Delft đọc được qua công cụ web và thông báo đổi nền tảng cuối năm 2026, nhưng chưa xác nhận truy cập ổn định bằng pipeline. [FAQ của TU Delft](https://ocw.tudelft.nl/faq/). HTTP 200 chỉ chứng minh truy cập tại thời điểm kiểm tra, không chứng minh chất lượng nội dung hoặc quyền phân phối. [Audit từng URL](../../data/hh-school/university/link-audit.json).\n\n';
sourceReport += 'Chạy `node scripts/import-hh-school-university.js --refresh` chỉ tạo sources.candidate.json (được gitignore). Biên tập viên so sánh metadata, chương trình, giấy phép và thay đổi nguồn trước khi thay sources.json. Chạy lại `node scripts/build-hh-school-university.js`, `node scripts/report-hh-school-university.js` và kiểm thử để tạo pack/manifest SHA-256 và ma trận. Build từ bản pin hiện tại không gọi mạng và cho kết quả byte giống nhau.\n\n';
sourceReport += 'sources.json lưu bản pin, ngày kiểm tra và thông tin GitHub; catalogue.json bổ sung edition, checkScope và trạng thái linkCheck. Phần nào nguồn không cung cấp hoặc chưa kiểm chứng sẽ giữ chưa xác định. Mọi học liệu ngoài vẫn cần rà quyền riêng trước khi quyết định nhập toàn văn hoặc chuyển thể trong tương lai.\n';
fs.writeFileSync(path.join(directory, 'hh-school-university-sources-2026-10-28.md'), sourceReport);
console.log(JSON.stringify({ totals: matrix.totals, fields: matrix.fieldGroups.map(f => ({ id: f.id, courses: f.courseIds.length, resources: f.resourceIds.length })), linkAudit: matrix.linkAudit }));
