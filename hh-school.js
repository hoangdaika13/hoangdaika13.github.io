(function initHHSchool(root) {
  "use strict";

  const VIEWS = Object.freeze({
    today: { label: "Hôm nay", title: "Bàn học hôm nay" }, paths: { label: "Lộ trình", title: "Lộ trình lớp 1–12" },
    subjects: { label: "Môn học", title: "Các môn học" }, practice: { label: "Luyện tập", title: "Luyện tập thích ứng" },
    assessments: { label: "Kiểm tra", title: "Kiểm tra năng lực" }, library: { label: "Thư viện", title: "Thư viện học liệu" },
    progress: { label: "Tiến độ", title: "Tiến độ theo kỹ năng" }, teacher: { label: "Giáo viên", title: "Teacher Mode" },
    family: { label: "Gia đình", title: "Family Mode" }, admin: { label: "Quản trị", title: "Education Admin Console" },
    lesson: { label: "Bài học", title: "Lesson Player" }
  });
  const PRIMARY = ["today", "paths", "subjects", "practice", "assessments", "library", "progress"];
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const attr = escape;
  const number = (value) => new Intl.NumberFormat("vi-VN").format(Number(value) || 0);
  const routeTo = (view) => { root.location.hash = `#/learn/${view}`; };
  let mounted = null;
  let searchSequence = 0;

  function searchRecords() {
    return root.HHSchoolCurriculum.GRADES.flatMap((grade) => root.HHSchoolCurriculum.packForGrade(grade.number).lessons.map((lesson) => ({
      lessonId: lesson.lessonId, gradeId: lesson.gradeId, subjectId: lesson.subjectId,
      subjectName: root.HHSchoolCurriculum.subjectBy(lesson.subjectId)?.name || lesson.subjectId,
      title: lesson.title, outcome: lesson.outcome
    })));
  }

  function createSearchWorker(instance) {
    if (!root.Worker) return null;
    try {
      const worker = new root.Worker("hh-school-search-worker.js?v=3");
      worker.onmessage = (event) => {
        if (!mounted || mounted !== instance || event.data?.id !== instance.searchRequestId) return;
        renderSearchResults(instance, event.data.results || []);
      };
      worker.onerror = () => { worker.terminate(); if (instance.searchWorker === worker) instance.searchWorker = null; };
      return worker;
    } catch { return null; }
  }

  function assertDependencies() {
    if (!root.HHSchoolCurriculum || !root.HHSchoolCore) throw new Error("HH School curriculum/core chưa được tải.");
  }

  function normalizeView(view) {
    const aliases = { home: "today", dashboard: "today", "learning-center": "today", lesson: "lesson", assessment: "assessments", review: "practice", paths: "paths", mastery: "progress", classroom: "teacher", coach: "practice", mistakes: "progress", passport: "progress" };
    const resolved = aliases[String(view || "today").toLowerCase()] || String(view || "today").toLowerCase();
    return VIEWS[resolved] ? resolved : "today";
  }
  const supports = (view) => Boolean(VIEWS[normalizeView(view)]);

  function resolveRoleViews(state) {
    const core = root.HHSchoolCore;
    const items = [];
    if (core.can(state.role, "create-class") || core.can(state.role, "platform-admin")) items.push("teacher");
    if (core.can(state.role, "view-linked") || core.can(state.role, "platform-admin")) items.push("family");
    if (core.can(state.role, "review-content") || core.can(state.role, "platform-admin")) items.push("admin");
    return items;
  }

  function shellMarkup(state, view) {
    const grade = root.HHSchoolCurriculum.gradeBy(state.profile.grade);
    const plan = root.HHSchoolCore.dailyPlan(state, root.HHSchoolCurriculum);
    return `<section class="hh-school age-${escape(state.profile.ageMode)} ${state.preferences.highContrast ? "is-contrast" : ""} ${state.preferences.dyslexia ? "is-dyslexia" : ""} ${state.preferences.largeText ? "is-large" : ""}" data-hh-school>
      <header class="hhs-topbar">
        <button class="hhs-brand" type="button" data-school-view="today"><i>HH</i><span><small>TRƯỜNG HỌC SỐ 1–12</small><strong>HH SCHOOL</strong></span></button>
        <label class="hhs-search"><span class="sr-only">Tìm bài học</span><input type="search" data-school-search placeholder="Tìm môn, bài học, kỹ năng..." autocomplete="off"><kbd>Ctrl K</kbd></label>
        <div class="hhs-identity"><button type="button" data-school-grade-open><span>${escape(grade.stage)}</span><strong>${escape(grade.name)}</strong></button><button type="button" data-school-view="progress"><span>${escape(state.profile.name)}</span><strong>${escape(state.role)}</strong></button></div>
      </header>
      <nav class="hhs-main-nav" aria-label="Điều hướng HH School">${PRIMARY.map((id) => `<button type="button" data-school-view="${id}" ${view === id ? 'aria-current="page"' : ""}>${escape(VIEWS[id].label)}</button>`).join("")}</nav>
      <div class="hhs-rolebar"><span><b>${state.profile.grade <= 2 ? "Học bằng hình ảnh và thao tác ngắn" : state.profile.grade <= 5 ? "Nhiệm vụ trực quan, dễ theo dõi" : state.profile.grade <= 9 ? "Kỹ năng, dự án và vận dụng" : "Chuyên đề, luyện thi và hướng nghiệp"}</b><small>${plan.review ? "Có nội dung đến hạn ôn" : "Lịch ôn đang ổn định"}</small></span>${resolveRoleViews(state).map((id) => `<button type="button" data-school-view="${id}" ${view === id ? 'aria-current="page"' : ""}>${VIEWS[id].label}</button>`).join("")}<button type="button" data-school-settings aria-label="Tùy chỉnh hiển thị">Aa</button><button type="button" data-school-sync title="Đồng bộ tiến độ">${state.syncStatus === "synced" ? "Đã đồng bộ" : "Đồng bộ"}</button></div>
      <main class="hhs-workspace" data-school-workspace aria-live="polite"></main>
      <div class="hhs-toast-stack" data-school-toasts aria-live="polite"></div>
      <dialog class="hhs-dialog" data-school-dialog></dialog>
    </section>`;
  }

  function todayView(state) {
    const plan = root.HHSchoolCore.dailyPlan(state, root.HHSchoolCurriculum);
    const pack = root.HHSchoolCurriculum.packForGrade(state.profile.grade);
    const progress = Object.values(state.progress).filter((item) => item.status === "completed").length;
    return `<section class="hhs-view hhs-today">
      <header class="hhs-view-head"><div><small>HÔM NAY · ${new Date().toLocaleDateString("vi-VN")}</small><h1>Chào ${escape(state.profile.name)}</h1><p>Một kế hoạch ngắn, rõ việc và phù hợp ${escape(root.HHSchoolCurriculum.gradeBy(state.profile.grade).name)}.</p></div><div class="hhs-day-ring"><b>${progress}</b><span>bài hoàn thành</span></div></header>
      <div class="hhs-today-grid">
        <article class="hhs-focus-card"><small>HỌC TIẾP</small><span class="hhs-subject-dot">${escape(root.HHSchoolCurriculum.subjectBy(plan.nextLesson.subjectId)?.icon || "●")}</span><h2>${escape(plan.nextLesson.title)}</h2><p>${escape(plan.nextLesson.outcome)}</p><ul><li>${plan.nextLesson.estimatedMinutes} phút</li><li>${escape(plan.nextLesson.difficulty)}</li><li>${escape(plan.nextLesson.contentStatus)}</li></ul><button class="hhs-primary" type="button" data-school-open-lesson="${attr(plan.nextLesson.lessonId)}">Tiếp tục học</button></article>
        <div class="hhs-today-list">
          <button type="button" data-school-view="practice"><span>Ôn lại</span><strong>${plan.review ? escape(plan.review.skillId) : "Chưa có thẻ đến hạn"}</strong><small>${state.reviews.length} thẻ trong lịch SRS</small></button>
          <button type="button" data-school-view="progress"><span>Lỗi cần sửa</span><strong>${plan.mistake ? escape(plan.mistake.prompt) : "Chưa ghi nhận lỗi lặp"}</strong><small>${plan.mistake ? `${plan.mistake.occurrences} lần gặp` : "Làm bài để nhận phân tích"}</small></button>
          <button type="button" data-school-view="teacher"><span>Bài được giao</span><strong>${plan.assignment ? escape(plan.assignment.title) : "Không có bài đến hạn"}</strong><small>${plan.assignment?.dueAt ? new Date(plan.assignment.dueAt).toLocaleString("vi-VN") : "Lịch học đang trống"}</small></button>
          <button type="button" data-school-view="subjects"><span>Chương trình</span><strong>${pack.grade.subjects.length} môn và hoạt động</strong><small>${pack.lessons.length} bài mẫu có thật trong gói hiện tại</small></button>
        </div>
        <aside class="hhs-brief"><header><span>Bản tin học tập</span><b>${pack.checksum}</b></header><dl><div><dt>Lớp</dt><dd>${state.profile.grade}</dd></div><div><dt>Môn đang chọn</dt><dd>${escape(root.HHSchoolCurriculum.subjectBy(state.activeSubjectId)?.name || "Toán")}</dd></div><div><dt>Đến hạn ôn</dt><dd>${state.reviews.filter((item) => new Date(item.dueAt) <= new Date()).length}</dd></div><div><dt>Kỹ năng có bằng chứng</dt><dd>${Object.keys(state.mastery).length}</dd></div></dl><p>Điểm trong ứng dụng không phải điểm chính thức của nhà trường.</p><button type="button" data-school-view="paths">Xem lộ trình đầy đủ</button></aside>
      </div><form class="hhs-join-form" data-class-join><label>Tham gia lớp bằng mã mời<input name="inviteCode" required autocomplete="off" maxlength="100" placeholder="Nhập mã do giáo viên cung cấp"></label><button type="submit">Tham gia lớp</button><small>Mã được kiểm tra trên máy chủ và không lưu dạng rõ.</small></form>
    </section>`;
  }

  function pathsView(state) {
    return `<section class="hhs-view"><header class="hhs-view-head"><div><small>CHƯƠNG TRÌNH 12 NĂM</small><h1>Chọn lớp và lộ trình</h1><p>Mỗi lớp chỉ tải gói nội dung cần thiết. Lớp 10–12 chọn đúng 4 trong 9 môn lựa chọn.</p></div></header>
      <div class="hhs-grade-grid">${root.HHSchoolCurriculum.GRADES.map((grade) => `<button type="button" data-school-grade="${grade.number}" ${grade.number === state.profile.grade ? 'aria-current="true"' : ""}><span>${escape(grade.stage)}</span><strong>${grade.number}</strong><b>Lớp ${grade.number}</b><small>${grade.subjects.length} môn/hoạt động</small></button>`).join("")}</div>
      ${state.profile.grade >= 10 ? electivePanel(state) : `<article class="hhs-note"><strong>Giai đoạn ${state.profile.grade <= 9 ? "giáo dục cơ bản" : "định hướng nghề nghiệp"}</strong><p>HH School theo dõi yêu cầu cần đạt và bằng chứng kỹ năng, không khóa học sinh vào một sách giáo khoa cụ thể.</p></article>`}
    </section>`;
  }

  function electivePanel(state) {
    const selected = new Set(state.profile.electiveSubjectIds || []);
    return `<section class="hhs-electives"><header><div><small>LỚP ${state.profile.grade}</small><h2>Chọn 4 môn lựa chọn</h2></div><b>${selected.size}/4</b></header><div>${root.HHSchoolCurriculum.highElectives.map((subject) => `<label><input type="checkbox" data-school-elective value="${subject.id}" ${selected.has(subject.id) ? "checked" : ""} ${!selected.has(subject.id) && selected.size >= 4 ? "disabled" : ""}><span>${escape(subject.icon)}</span><strong>${escape(subject.name)}</strong></label>`).join("")}</div><p>Ngữ văn, Toán, Ngoại ngữ 1, Lịch sử và các hoạt động bắt buộc luôn được giữ. Thiết lập này là hồ sơ học tập cá nhân, không thay thế đăng ký môn tại trường.</p></section>`;
  }

  function subjectsView(state) {
    const pack = root.HHSchoolCurriculum.packForGrade(state.profile.grade);
    const electives = new Set(state.profile.electiveSubjectIds || []);
    const visible = pack.grade.subjects.filter((item) => !item.optional || state.profile.grade < 10 || electives.has(item.id));
    const active = visible.find((item) => item.id === state.activeSubjectId) || visible[0];
    const lessons = pack.lessons.filter((lesson) => lesson.subjectId === active.id);
    return `<section class="hhs-view"><header class="hhs-view-head"><div><small>${escape(pack.grade.name)} · ${escape(pack.grade.stage)}</small><h1>Môn học</h1><p>Chọn một môn để xem yêu cầu cần đạt, bài học, luyện tập và nguồn.</p></div><label class="hhs-inline-search">Lọc môn<input type="search" data-subject-filter placeholder="Nhập tên môn..."></label></header>
      <div class="hhs-subject-layout"><aside class="hhs-subject-list">${visible.map((item) => `<button type="button" data-school-subject="${item.id}" ${item.id === active.id ? 'aria-current="page"' : ""}><i>${escape(item.icon)}</i><span><strong>${escape(item.name)}</strong><small>${item.strands?.length ? escape(item.strands.join(" · ")) : item.optional ? "Tự chọn" : "Bắt buộc"}</small></span></button>`).join("")}</aside>
      <div class="hhs-subject-detail"><header><i>${escape(active.icon)}</i><div><small>${active.optional ? "MÔN TỰ CHỌN" : "MÔN/HOẠT ĐỘNG TRONG CHƯƠNG TRÌNH"}</small><h2>${escape(active.name)}</h2><p>${escape(pack.requirements.find((item) => item.subjectId === active.id)?.outcome || "Nội dung chi tiết đang trong hàng biên tập.")}</p></div></header>
        ${subjectLabMarkup(active.id)}
        <div class="hhs-lesson-cards">${lessons.length ? lessons.map(lessonCard).join("") : `<article class="hhs-empty"><strong>Chưa xuất bản bài mẫu cho môn này</strong><p>Cấu trúc môn đã có thật; nội dung chỉ được mở sau khi qua cổng nguồn và biên tập.</p><button type="button" data-school-view="library">Xem trạng thái học liệu</button></article>`}</div>
      </div></div></section>`;
  }

  function subjectLabMarkup(subjectId) {
    if (subjectId === "math") return `<section class="hhs-lab" data-math-lab><header><div><small>MATH LAB</small><h3>Bảng giá trị và đồ thị hàm bậc nhất</h3></div><span>Chạy cục bộ</span></header><form data-math-plot><label>Hệ số a<input name="a" type="number" step="0.1" value="1"></label><label>Hệ số b<input name="b" type="number" step="0.1" value="0"></label><button type="submit">Vẽ y = ax + b</button></form><div class="hhs-lab-output" data-math-output>Nhập hệ số và bấm Vẽ.</div></section>`;
    if (["vietnamese", "literature"].includes(subjectId)) return `<section class="hhs-lab" data-writing-lab><header><div><small>VIETNAMESE & LITERATURE STUDIO</small><h3>Giữ bản gốc và so sánh trước/sau</h3></div><span>Không bịa trích dẫn</span></header><form data-writing-compare><label>Bản gốc<textarea name="original" rows="4" maxlength="3000" required></textarea></label><label>Bản đã sửa<textarea name="revised" rows="4" maxlength="3000" required></textarea></label><button type="submit">So sánh theo rubric</button></form><div class="hhs-lab-output" data-writing-output>Rubric: luận điểm · bằng chứng · diễn đạt · chính tả.</div></section>`;
    if (["science", "natural-science", "physics", "chemistry", "biology", "nature-society"].includes(subjectId)) return `<section class="hhs-lab" data-science-lab><header><div><small>SCIENCE LAB · MÔ PHỎNG</small><h3>Quan sát dữ liệu thay đổi</h3></div><span>Không phải thực nghiệm thật</span></header><form data-science-sim><label>Giá trị ban đầu<input name="start" type="number" value="10"></label><label>Mức thay đổi<input name="change" type="number" value="2"></label><button type="submit">Chạy mô phỏng an toàn</button></form><div class="hhs-lab-output" data-science-output>Giả thuyết → quan sát → dữ liệu → kết luận.</div></section>`;
    if (["history", "geography", "history-geography"].includes(subjectId)) return `<section class="hhs-lab" data-history-lab><header><div><small>HISTORY & GEOGRAPHY LAB</small><h3>Phân tích nguồn và bối cảnh</h3></div><span>Cần nguồn xác minh</span></header><form data-source-analyze><label>Người tạo nguồn<input name="creator" required maxlength="120"></label><label>Năm/bối cảnh<input name="context" required maxlength="200"></label><label>Nhận định cần kiểm tra<textarea name="claim" required maxlength="1000"></textarea></label><button type="submit">Lập phiếu đối chiếu</button></form><div class="hhs-lab-output" data-source-output>Chưa có nguồn được phân tích.</div></section>`;
    if (["informatics", "informatics-technology"].includes(subjectId)) return `<section class="hhs-lab" data-code-lab><header><div><small>INFORMATICS LAB</small><h3>JavaScript sandbox giới hạn 1,5 giây</h3></div><span>Không filesystem · không network</span></header><form data-code-run><label>Mã JavaScript<textarea name="code" rows="6" maxlength="5000" spellcheck="false">console.log(2 + 3);</textarea></label><div><button type="submit">Chạy code</button><button type="button" data-code-stop>Dừng</button></div></form><pre class="hhs-lab-output" data-code-output>Chưa chạy.</pre></section>`;
    return "";
  }

  function lessonCard(lesson) {
    return `<article><div><small>${escape(lesson.difficulty)} · ${lesson.estimatedMinutes} phút</small><span class="status-${escape(lesson.contentStatus)}">${escape(lesson.contentStatus)}</span></div><h3>${escape(lesson.title)}</h3><p>${escape(lesson.outcome)}</p><footer><button type="button" data-school-open-lesson="${attr(lesson.lessonId)}">Mở bài học</button><button type="button" data-school-practice-lesson="${attr(lesson.lessonId)}">Luyện nhanh</button></footer></article>`;
  }

  function lessonView(state) {
    const pack = root.HHSchoolCurriculum.packForGrade(state.profile.grade);
    const lesson = pack.lessons.find((item) => item.lessonId === state.activeLessonId) || pack.lessons[0];
    const progress = state.progress[lesson.lessonId] || { step: 0, status: "learning" };
    const stepIndex = Math.min(lesson.steps.length - 1, Number(progress.step) || 0);
    const step = lesson.steps[stepIndex];
    return `<section class="hhs-view hhs-lesson-player" data-active-lesson="${attr(lesson.lessonId)}"><header><button type="button" data-school-view="subjects">← Môn học</button><div><small>${escape(root.HHSchoolCurriculum.subjectBy(lesson.subjectId)?.name)} · ${escape(lesson.difficulty)}</small><h1>${escape(lesson.title)}</h1></div><span>${stepIndex + 1}/${lesson.steps.length}</span></header>
      <div class="hhs-lesson-body"><aside><strong>Tiến trình bài học</strong>${lesson.steps.map((item, index) => `<button type="button" data-lesson-step="${index}" ${index === stepIndex ? 'aria-current="step"' : ""} ${index > stepIndex + 1 ? "disabled" : ""}><i>${index < stepIndex ? "✓" : index + 1}</i><span>${escape(item.label)}</span></button>`).join("")}<hr><small>Nguồn nội dung</small><a href="${attr(lesson.source.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escape(lesson.source.sourceTitle)}</a><b>${escape(lesson.source.licenseCode)}</b></aside>
      <article class="hhs-lesson-stage"><div class="hhs-stage-icon" aria-hidden="true">${escape(root.HHSchoolCurriculum.subjectBy(lesson.subjectId)?.icon || "◎")}</div><small>${escape(step.label).toUpperCase()}</small><h2>${escape(step.label)}</h2><p>${escape(step.body)}</p>${step.id === "guided" ? `<section class="hhs-worked"><strong>${escape(lesson.workedExample.prompt)}</strong><ol>${lesson.workedExample.method.map((item) => `<li>${escape(item)}</li>`).join("")}</ol><button type="button" data-reveal-answer>Hiện đáp án có hướng dẫn</button><b data-guided-answer hidden>${escape(lesson.workedExample.answer)}</b></section>` : ""}${step.id === "practice" || step.id === "quickcheck" ? questionMarkup(lesson.questions[0], lesson.lessonId) : ""}${step.id === "summary" ? `<ul>${lesson.commonMistakes.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>` : ""}
      <footer><button type="button" data-lesson-prev ${stepIndex === 0 ? "disabled" : ""}>Quay lại</button><button class="hhs-primary" type="button" data-lesson-next>${stepIndex === lesson.steps.length - 1 ? "Hoàn thành bài" : "Hoàn thành bước này"}</button></footer></article>
      <aside class="hhs-tutor"><small>AI TUTOR AN TOÀN</small><h3>Gợi ý từng bước</h3><p>AI chỉ sử dụng bài đang mở. Lớp 1–5 không có chat tự do. Phản hồi AI không phải điểm chính thức.</p><div data-tutor-output>Hãy thử tự trả lời trước. Khi cần, chọn một hướng dẫn.</div><div class="hhs-tutor-actions"><button type="button" data-tutor-action="hint">Gợi ý bước tiếp</button><button type="button" data-tutor-action="simplify">Giải thích dễ hơn</button><button type="button" data-tutor-action="similar">Bài tương đương</button><button type="button" data-tutor-action="summarize">Tóm tắt</button><button type="button" data-tutor-action="flashcards">Flashcard</button>${state.profile.grade > 5 ? '<button type="button" data-tutor-action="socratic">Câu hỏi Socratic</button><button type="button" data-tutor-action="exam-review">Ôn thi</button><button type="button" data-tutor-action="rubric">Rubric bài viết</button>' : ""}<button type="button" data-tutor-speak>Đọc tiếng Việt</button></div><button type="button" data-tutor-report hidden>Báo cáo phản hồi</button></aside></div>
    </section>`;
  }

  function questionMarkup(question, lessonId, index = 0) {
    if (!question) return "";
    const name = `answer-${escape(question.id)}-${index}`;
    let control = `<input type="text" name="${name}" autocomplete="off" placeholder="Nhập câu trả lời">`;
    if (question.type === "single") control = `<div class="hhs-options">${question.options.map((option, optionIndex) => `<label><input type="radio" name="${name}" value="${optionIndex}"><span>${escape(option)}</span></label>`).join("")}</div>`;
    if (question.type === "boolean") control = `<div class="hhs-options"><label><input type="radio" name="${name}" value="true"><span>Đúng</span></label><label><input type="radio" name="${name}" value="false"><span>Sai</span></label></div>`;
    if (question.type === "multiple") control = `<div class="hhs-options">${question.options.map((option, optionIndex) => `<label><input type="checkbox" name="${name}" value="${optionIndex}"><span>${escape(option)}</span></label>`).join("")}</div>`;
    if (question.type === "order") control = `<fieldset class="hhs-order"><legend>Chọn vị trí cho từng bước</legend>${question.options.map((option, optionIndex) => `<label><span>${escape(option)}</span><select name="order-${optionIndex}" aria-label="Vị trí của ${attr(option)}">${question.options.map((_, position) => `<option value="${position}">${position + 1}</option>`).join("")}</select></label>`).join("")}</fieldset>`;
    if (question.type === "matching") control = `<fieldset class="hhs-order"><legend>Nhập nội dung ghép tương ứng</legend>${Object.keys(question.answer || {}).map((key) => `<label><span>${escape(key)}</span><input name="match-${attr(key)}" autocomplete="off"></label>`).join("")}</fieldset>`;
    if (question.type === "essay") control = `<textarea name="${name}" rows="7" maxlength="8000" placeholder="Viết bài của em; bản gốc sẽ được giữ lại để giáo viên nhận xét."></textarea>`;
    if (question.type === "dictation") control = `<textarea name="${name}" rows="3" maxlength="1500" placeholder="Nghe và chép lại nội dung. Dấu câu được giữ khi chấm."></textarea>`;
    if (question.type === "image-mark") control = `<textarea name="${name}" rows="3" maxlength="1500" placeholder="Mô tả chính xác vùng em đánh dấu; giáo viên sẽ kiểm tra trên hình gốc."></textarea>`;
    if (question.type === "upload") control = `<label class="hhs-file">Ảnh/PDF tối đa 10 MB, lưu theo hồ sơ trên thiết bị<input type="file" name="${name}" accept="image/png,image/jpeg,image/webp,application/pdf"></label>`;
    if (question.type === "code") control = `<textarea name="${name}" rows="7" maxlength="5000" spellcheck="false" placeholder="Nhập JavaScript trong sandbox..."></textarea>`;
    return `<form class="hhs-question" data-school-question data-lesson-id="${attr(lessonId)}" data-question-id="${attr(question.id)}" data-started-at="${Date.now()}"><small>${escape(question.cognitiveLevel)} · độ khó ${question.difficulty} · ${escape(question.type)}</small><h3>${escape(question.prompt)}</h3>${control}<button type="submit">${["essay", "upload"].includes(question.type) ? "Nộp để giáo viên nhận xét" : "Kiểm tra"}</button><output data-question-result></output></form>`;
  }

  function practiceView(state, assessment = false) {
    const pack = root.HHSchoolCurriculum.packForGrade(state.profile.grade);
    const questions = pack.lessons.flatMap((lesson) => lesson.questions.map((question) => ({ ...question, lessonId: lesson.lessonId }))).slice(0, assessment ? 6 : 4);
    const variant = Number(state.practiceVariant || 0);
    const ordered = questions.length ? questions.map((_, index) => questions[(index + variant) % questions.length]) : questions;
    return `<section class="hhs-view"><header class="hhs-view-head"><div><small>${assessment ? "ĐÁNH GIÁ TRONG ỨNG DỤNG" : "LUYỆN TẬP THÍCH ỨNG"}</small><h1>${assessment ? "Kiểm tra ngắn" : "Luyện theo lỗi thật"}</h1><p>${assessment ? "Kết quả này không phải điểm chính thức của nhà trường." : "Mỗi câu cập nhật bằng chứng kỹ năng, SRS và Mistake Notebook."}</p></div><button type="button" data-school-generate-practice>Tạo bộ tương đương</button></header><div class="hhs-practice-grid">${ordered.map((item, index) => questionMarkup(item, item.lessonId, index)).join("")}</div><aside class="hhs-integrity"><strong>Nguyên tắc đánh giá</strong><span>Nhận biết</span><span>Thông hiểu</span><span>Vận dụng</span><p>Không đánh dấu thành thạo sau một câu đúng; hệ thống cần nhiều lần nhớ lại sau khoảng cách thời gian.</p></aside></section>`;
  }

  function libraryView(state) {
    const pack = root.HHSchoolCurriculum.packForGrade(state.profile.grade);
    const statuses = pack.lessons.reduce((acc, lesson) => ((acc[lesson.contentStatus] = (acc[lesson.contentStatus] || 0) + 1), acc), {});
    return `<section class="hhs-view"><header class="hhs-view-head"><div><small>HỌC LIỆU VÀ QUYỀN SỬ DỤNG</small><h1>Thư viện có kiểm soát</h1><p>Không scrape sách giáo khoa, website luyện thi, ảnh Google hoặc video YouTube.</p></div><button type="button" data-school-export="json">Xuất dữ liệu JSON</button></header><div class="hhs-library-stats">${["machine_generated", "checked", "reviewed", "approved"].map((status) => `<div><b>${number(statuses[status])}</b><span>${escape(status)}</span></div>`).join("")}</div><div class="hhs-source-table" role="table"><div role="row"><b>Nguồn</b><b>Giấy phép</b><b>Quyền sửa</b><b>Trạng thái</b></div>${pack.sources.map((source) => `<div role="row"><span><a href="${attr(source.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escape(source.sourceTitle)}</a><small>${escape(source.publisher)}</small></span><span>${escape(source.licenseCode)}</span><span>${source.allowedToModify ? "Cho phép" : "Chỉ tham chiếu"}</span><span>${escape(source.reviewedAt)}</span></div>`).join("")}</div><article class="hhs-note"><strong>Quy trình bắt buộc</strong><p>Tìm nguồn → kiểm tra giấy phép → lưu bằng chứng → kiểm tra nội dung → người duyệt → xuất bản.</p></article></section>`;
  }

  function progressView(state) {
    const skills = Object.entries(state.mastery).sort((a, b) => (b[1].score || 0) - (a[1].score || 0));
    return `<section class="hhs-view"><header class="hhs-view-head"><div><small>BẰNG CHỨNG THAY VÌ CHỈ ĐIỂM SỐ</small><h1>Tiến độ kỹ năng</h1><p>Mỗi mức thành thạo dựa trên số lần làm, độ chính xác, trợ giúp, thời gian và lịch ôn.</p></div><button type="button" data-school-export="csv">Xuất CSV</button></header><div class="hhs-progress-summary"><div><b>${state.attempts.length}</b><span>Lượt làm</span></div><div><b>${skills.length}</b><span>Kỹ năng có bằng chứng</span></div><div><b>${state.mistakes.length}</b><span>Lỗi cần sửa</span></div><div><b>${state.reviews.filter((item) => new Date(item.dueAt) <= new Date()).length}</b><span>Đến hạn ôn</span></div></div>${skills.length ? `<div class="hhs-skill-list">${skills.map(([id, item]) => `<article><header><strong>${escape(id)}</strong><span>${escape(item.state)}</span></header><div><i style="width:${item.score || 0}%"></i></div><dl><span>${item.score || 0} điểm bằng chứng</span><span>${item.attempts || 0} lần</span><span>${item.accuracy || 0}% đúng</span><span>Chắc chắn ${item.certainty || 0}%</span><span>Nguy cơ quên ${item.forgettingRisk || 0}%</span><span>Ôn ${new Date(item.dueAt).toLocaleDateString("vi-VN")}</span></dl><button type="button" data-review-why="${attr(id)}">Tại sao tôi nhận bài này?</button></article>`).join("")}</div>` : `<article class="hhs-empty"><strong>Chưa có bằng chứng kỹ năng</strong><p>Hãy hoàn thành một bài luyện tập để bắt đầu biểu đồ.</p><button type="button" data-school-view="practice">Bắt đầu luyện</button></article>`}<section class="hhs-mistakes"><h2>Mistake Notebook</h2>${state.mistakes.slice().reverse().map((item) => `<article><b>${escape(item.prompt)}</b><span>Em trả lời: ${escape(item.userAnswer)}</span><span>Cần đạt: ${escape(item.expected)}</span><small>${item.occurrences} lần · ${escape(item.explanation)}</small></article>`).join("") || "<p>Chưa có lỗi nào được lưu.</p>"}</section></section>`;
  }

  function teacherView(state) {
    if (!root.HHSchoolCore.can(state.role, "create-class") && !root.HHSchoolCore.can(state.role, "platform-admin")) return forbidden("Teacher Mode", "Tài khoản này chưa được phân công vai trò giáo viên.");
    return `<section class="hhs-view"><header class="hhs-view-head"><div><small>TEACHER MODE V2</small><h1>Lớp học và bài giao</h1><p>Dữ liệu lớp chỉ mở cho giáo viên được phân công; mã mời có hạn và chỉ hiển thị ngay khi tạo hoặc đổi mã.</p></div><button type="button" data-teacher-create-class>Tạo lớp</button></header><div class="hhs-teacher-grid"><section><h2>Lớp của tôi</h2>${state.classes.map((item) => `<article><strong>${escape(item.name)}</strong><span>${item.studentCount || 0} học sinh</span><small>${item.inviteCode ? `Mã mời: ${escape(item.inviteCode)}` : item.inviteActive ? "Mã mời đang hoạt động" : "Mã mời đã tắt"}</small><div><button type="button" data-class-invite="${attr(item.id)}">Đổi mã mời</button><button type="button" data-class-disable="${attr(item.id)}">Tắt mã</button></div></article>`).join("") || `<div class="hhs-empty"><p>Chưa tạo lớp.</p></div>`}</section><form data-teacher-assignment><h2>Giao bài mới</h2><label>Tiêu đề<input name="title" required maxlength="120"></label><label>Lớp<select name="classId" required>${state.classes.map((item) => `<option value="${attr(item.id)}">${escape(item.name)}</option>`).join("")}</select></label><label>Hạn nộp<input type="datetime-local" name="dueAt" required></label><label><input type="checkbox" name="lockAnswers" checked> Khóa đáp án đến hạn</label><button type="submit" ${state.classes.length ? "" : "disabled"}>Giao bài</button></form></div><section class="hhs-assignment-list"><h2>Bài đã giao</h2>${state.assignments.map((item) => `<article><strong>${escape(item.title)}</strong><span>${escape(item.status || "assigned")}</span><small>${item.dueAt ? new Date(item.dueAt).toLocaleString("vi-VN") : "Không có hạn"}</small></article>`).join("") || "<p>Chưa có bài giao.</p>"}</section></section>`;
  }

  function familyView(state) {
    if (!root.HHSchoolCore.can(state.role, "view-linked") && !root.HHSchoolCore.can(state.role, "platform-admin")) return forbidden("Family Mode", "Tài khoản này chưa liên kết hồ sơ trẻ.");
    return `<section class="hhs-view"><header class="hhs-view-head"><div><small>FAMILY MODE V2</small><h1>Đồng hành không gây áp lực</h1><p>Không có bảng xếp hạng công khai, không dùng thông báo làm trẻ lo lắng về điểm.</p></div><button type="button" data-family-add>Tạo hồ sơ con</button></header><form class="hhs-join-form" data-family-accept><label>Liên kết bằng lời mời 48 giờ<input name="token" required autocomplete="off" placeholder="Dán mã lời mời"></label><button type="submit">Liên kết hồ sơ</button></form><div class="hhs-family-grid">${state.familyProfiles.map((profile) => { const report = state.familyReports?.[profile.id]; return `<article><div><b>${escape(profile.name)}</b><span>Lớp ${profile.grade || "—"}</span></div><label>Giới hạn học mỗi ngày<input type="number" min="10" max="120" value="${state.preferences.dailyMinutes}" data-family-limit="${attr(profile.id)}"> phút</label><label><input type="checkbox" data-family-pressure ${state.preferences.pressureNotifications === false ? "" : "checked"}> Tắt thông báo gây áp lực</label>${report ? `<small>${report.attempts} lượt luyện · ${report.mistakes} lỗi cần ôn · ${report.due} bài đến hạn</small>` : ""}<div><button type="button" data-family-open="${attr(profile.id)}">Xem báo cáo</button>${profile.ownerId === state.ownerId ? `<button type="button" data-family-invite="${attr(profile.id)}">Tạo lời mời</button>` : ""}</div></article>`; }).join("")}</div><article class="hhs-note"><strong>Báo cáo tuần</strong><p>Chỉ hiển thị hồ sơ do tài khoản sở hữu hoặc đã liên kết bằng lời mời còn hiệu lực. Đây là dữ liệu hỗ trợ, không phải xếp loại chính thức.</p></article></section>`;
  }

  function adminView(state) {
    if (!root.HHSchoolCore.can(state.role, "review-content") && !root.HHSchoolCore.can(state.role, "platform-admin")) return forbidden("Education Admin", "Tài khoản không có quyền kiểm duyệt nội dung.");
    const pack = root.HHSchoolCurriculum.packForGrade(state.profile.grade);
    return `<section class="hhs-view"><header class="hhs-view-head"><div><small>EDUCATION ADMIN CONSOLE</small><h1>Quản trị chương trình và nguồn</h1><p>Mọi thay đổi nội dung cần version, nguồn, người duyệt và khả năng rollback.</p></div><button type="button" data-admin-new-draft>Tạo bản nháp</button></header><div class="hhs-admin-grid">${[["Curriculum editor", pack.requirements.length], ["Lesson editor", pack.lessons.length], ["Question bank", pack.lessons.flatMap((item) => item.questions).length], ["Review queue", state.reviewQueue.length], ["Source registry", pack.sources.length], ["License registry", pack.sources.filter((item) => item.licenseCode).length]].map(([label, count]) => `<article><b>${count}</b><span>${label}</span></article>`).join("")}</div><div class="hhs-source-table" role="table"><div role="row"><b>Nội dung</b><b>Trạng thái</b><b>Nguồn</b><b>Hành động</b></div>${pack.lessons.map((lesson) => `<div role="row"><span><b>${escape(lesson.title)}</b><small>${escape(lesson.lessonId)}</small></span><span>${escape(lesson.contentStatus)}</span><span>${escape(lesson.source.licenseCode)}</span><span><button type="button" data-admin-review="${attr(lesson.lessonId)}">Đề xuất sửa</button></span></div>`).join("")}</div></section>`;
  }

  function forbidden(title, detail) { return `<section class="hhs-view"><article class="hhs-empty"><strong>${escape(title)}</strong><p>${escape(detail)}</p><button type="button" data-school-view="today">Về Hôm nay</button></article></section>`; }

  function renderView(instance) {
    const state = instance.store.get();
    const view = instance.view;
    const host = instance.host.querySelector("[data-school-workspace]");
    const renderer = { today: todayView, paths: pathsView, subjects: subjectsView, practice: (s) => practiceView(s, false), assessments: (s) => practiceView(s, true), library: libraryView, progress: progressView, lesson: lessonView, teacher: teacherView, family: familyView, admin: adminView }[view] || todayView;
    host.innerHTML = renderer(state);
    instance.host.querySelectorAll("[data-school-view]").forEach((button) => button.toggleAttribute("aria-current", button.dataset.schoolView === view));
  }

  function toast(instance, message, type = "info") {
    const item = document.createElement("div"); item.className = `hhs-toast is-${type}`; item.textContent = message;
    instance.host.querySelector("[data-school-toasts]")?.append(item); setTimeout(() => item.remove(), 4200);
  }

  function findLesson(state, lessonId) { return root.HHSchoolCurriculum.packForGrade(state.profile.grade).lessons.find((item) => item.lessonId === lessonId); }
  function questionById(state, id) { return root.HHSchoolCurriculum.packForGrade(state.profile.grade).lessons.flatMap((item) => item.questions).find((item) => item.id === id); }

  function download(filename, content, type = "application/json;charset=utf-8") { const url = URL.createObjectURL(new Blob([content], { type })); const link = Object.assign(document.createElement("a"), { href: url, download: filename }); link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

  function dialog(instance, html) { const element = instance.host.querySelector("[data-school-dialog]"); element.innerHTML = html; element.showModal(); return element; }

  function bind(instance) {
    const host = instance.host;
    instance.click = async (event) => {
      const button = event.target.closest("button"); if (!button) return;
      if (button.dataset.schoolView) return routeTo(button.dataset.schoolView);
      if (button.dataset.schoolGrade) {
        const grade = Number(button.dataset.schoolGrade);
        instance.store.update((state) => { if (state.profile.managed && state.role === "student") return state; state.profile.grade = grade; state.profile.ageMode = root.HHSchoolCore.learnerProfile(state.profile, state.ownerId).ageMode; state.profile.electiveSubjectIds = grade >= 10 ? state.profile.electiveSubjectIds.slice(0, 4) : []; state.activeSubjectId = "math"; state.activeLessonId = `g${grade}-math-core-01`; return state; }, "profile:grade-change");
        renderView(instance); return toast(instance, `Đã chuyển sang lớp ${grade}.`, "success");
      }
      if (button.dataset.schoolSubject) { instance.store.update((state) => { state.activeSubjectId = button.dataset.schoolSubject; return state; }, "subject:open"); renderView(instance); return; }
      if (button.dataset.schoolOpenLesson) { instance.store.update((state) => { state.activeLessonId = button.dataset.schoolOpenLesson; return state; }, "lesson:open"); return routeTo("lesson"); }
      if (button.dataset.schoolPracticeLesson) { instance.store.update((state) => { state.activeLessonId = button.dataset.schoolPracticeLesson; return state; }, "practice:lesson-select"); return routeTo("practice"); }
      if (button.hasAttribute("data-lesson-prev") || button.hasAttribute("data-lesson-next")) {
        const state = instance.store.get(); const lesson = findLesson(state, state.activeLessonId); const entry = state.progress[lesson.lessonId] || { step: 0, status: "learning" };
        const delta = button.hasAttribute("data-lesson-next") ? 1 : -1;
        if (delta > 0 && Number(entry.step || 0) >= lesson.steps.length - 1) {
          instance.store.update((draft) => { const current = draft.progress[lesson.lessonId] || {}; draft.progress[lesson.lessonId] = { ...current, step: lesson.steps.length - 1, status: "completed", completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; return draft; }, "lesson:complete");
          toast(instance, "Đã hoàn thành bài. Tiến độ đã được lưu và sẽ đồng bộ khi có mạng.", "success"); return routeTo("today");
        }
        instance.store.update((draft) => { const current = draft.progress[lesson.lessonId] || { step: 0, status: "learning", startedAt: new Date().toISOString() }; const nextStep = Math.max(0, Math.min(lesson.steps.length - 1, current.step + delta)); draft.progress[lesson.lessonId] = { ...current, step: nextStep, status: current.step === lesson.steps.length - 1 && delta > 0 ? "completed" : "learning", updatedAt: new Date().toISOString() }; return draft; }, "lesson:step");
        return renderView(instance);
      }
      if (button.dataset.lessonStep) { instance.store.update((state) => { const lesson = findLesson(state, state.activeLessonId); const current = state.progress[lesson.lessonId] || { step: 0, status: "learning" }; const requested = Number(button.dataset.lessonStep); if (requested <= current.step + 1) current.step = requested; state.progress[lesson.lessonId] = current; return state; }, "lesson:step-jump"); return renderView(instance); }
      if (button.hasAttribute("data-reveal-answer")) { const answer = button.parentElement.querySelector("[data-guided-answer]"); answer.hidden = !answer.hidden; button.textContent = answer.hidden ? "Hiện đáp án có hướng dẫn" : "Ẩn đáp án"; return; }
      if (button.dataset.tutorAction) return tutor(instance, button.dataset.tutorAction);
      if (button.hasAttribute("data-tutor-speak")) { const text = instance.host.querySelector("[data-tutor-output]")?.textContent?.trim(); if (!text || !root.speechSynthesis || !root.SpeechSynthesisUtterance) return toast(instance, "Trình duyệt chưa hỗ trợ giọng đọc tiếng Việt.", "warning"); root.speechSynthesis.cancel(); const utterance = new root.SpeechSynthesisUtterance(text); utterance.lang = "vi-VN"; utterance.rate = instance.store.get().profile.grade <= 5 ? .9 : 1; root.speechSynthesis.speak(utterance); return; }
      if (button.hasAttribute("data-school-settings")) return settingsDialog(instance);
      if (button.hasAttribute("data-school-sync")) return syncNow(instance);
      if (button.dataset.reviewWhy) { const review = instance.store.get().reviews.find((item) => item.skillId === button.dataset.reviewWhy); return toast(instance, review?.reason || "Bài được chọn vì kỹ năng này cần thêm bằng chứng ở nhiều dạng câu hỏi.", "info"); }
      if (button.hasAttribute("data-school-grade-open")) return routeTo("paths");
      if (button.dataset.schoolExport) return exportData(instance, button.dataset.schoolExport);
      if (button.hasAttribute("data-school-generate-practice")) {
        instance.store.update((state) => { state.practiceVariant = (Number(state.practiceVariant || 0) + 1) % 4; return state; }, "practice:generate-equivalent");
        renderView(instance); return toast(instance, "Đã tạo bộ tương đương từ câu hỏi đã kiểm tra; không thay đổi mức độ kỹ năng.", "success");
      }
      if (button.hasAttribute("data-tutor-report")) {
        const state = instance.store.get(); const lesson = findLesson(state, state.activeLessonId);
        try { await instance.sync.reportTutor({ learnerProfileId: state.learnerProfileId, grade: state.profile.grade, lessonId: lesson.lessonId, reason: "Phản hồi không đúng hoặc không phù hợp" });
          instance.store.update((draft) => { draft.aiSessions.push({ id: `ai-report-${Date.now()}`, lessonId: lesson.lessonId, action: "report", status: "reported-server", createdAt: new Date().toISOString() }); return draft; }, "ai:response-reported");
          button.disabled = true; button.textContent = "Đã báo cáo"; return toast(instance, "Phản hồi đã được gửi đến nhật ký kiểm tra phía máy chủ.", "success");
        } catch (error) { return toast(instance, `Chưa thể gửi báo cáo: ${error.message}`, "warning"); }
      }
      if (button.hasAttribute("data-teacher-create-class")) return createClassDialog(instance);
      if (button.dataset.classInvite) { try { const response = await instance.sync.updateClass({ classId: button.dataset.classInvite, action: "rotate-invite" }); instance.store.update((state) => { const item = state.classes.find((entry) => entry.id === button.dataset.classInvite); if (item) Object.assign(item, { inviteCode: response.inviteCode, inviteActive: true, inviteExpiresAt: response.inviteExpiresAt }); return state; }, "class:invite-rotate"); renderView(instance); return toast(instance, "Đã đổi mã mời; mã cũ không còn hiệu lực.", "success"); } catch (error) { return toast(instance, error.message, "warning"); } }
      if (button.dataset.classDisable) { try { await instance.sync.updateClass({ classId: button.dataset.classDisable, action: "disable-invite" }); instance.store.update((state) => { const item = state.classes.find((entry) => entry.id === button.dataset.classDisable); if (item) Object.assign(item, { inviteCode: "", inviteActive: false }); return state; }, "class:invite-disable"); renderView(instance); return toast(instance, "Đã vô hiệu hóa mã mời.", "success"); } catch (error) { return toast(instance, error.message, "warning"); } }
      if (button.hasAttribute("data-family-add")) return familyDialog(instance);
      if (button.dataset.familyOpen) {
        const target = instance.store.get().familyProfiles.find((profile) => profile.id === button.dataset.familyOpen);
        if (!target) return toast(instance, "Không tìm thấy hồ sơ đã liên kết.", "warning");
        try { const response = target.ownerId === instance.store.get().ownerId ? { state: instance.store.get() } : await instance.sync.load(target.id, "linked"); const linked = response.state || {}; instance.store.update((state) => { state.activeFamilyProfileId = target.id; state.familyReports ||= {}; state.familyReports[target.id] = { attempts: linked.attempts?.length || 0, mistakes: linked.mistakes?.length || 0, due: linked.reviews?.filter((item) => new Date(item.dueAt) <= new Date()).length || 0, updatedAt: response.updatedAt || new Date().toISOString() }; return state; }, "family:profile-open"); renderView(instance); return toast(instance, `Đã tải báo cáo hồ sơ ${target.name}.`, "success"); } catch (error) { return toast(instance, `Không thể xem hồ sơ chưa được liên kết: ${error.message}`, "warning"); }
      }
      if (button.dataset.familyInvite) { const state = instance.store.get(); const target = state.familyProfiles.find((profile) => profile.id === button.dataset.familyInvite); try { const response = await instance.sync.family({ action: "create-invite", learnerProfileId: target.id, learnerName: target.name }); return toast(instance, `Lời mời: ${response.token} · hết hạn ${new Date(response.expiresAt).toLocaleString("vi-VN")}`, "success"); } catch (error) { return toast(instance, error.message, "warning"); } }
      if (button.hasAttribute("data-code-stop")) { instance.codeWorker?.terminate?.(); instance.codeWorker = null; const output = instance.host.querySelector("[data-code-output]"); if (output) output.textContent = "Đã dừng sandbox."; return; }
      if (button.dataset.adminReview) { instance.store.update((state) => { state.reviewQueue.push({ id: `review-${Date.now()}`, lessonId: button.dataset.adminReview, status: "proposed", createdAt: new Date().toISOString() }); return state; }, "content:review-proposed"); renderView(instance); return toast(instance, "Đã đưa bài vào hàng đề xuất chỉnh sửa.", "success"); }
      if (button.hasAttribute("data-admin-new-draft")) { try { const response = await instance.sync.createDraft({ kind: "lesson", title: "Bản nháp bài học mới", payload: { steps: [], questions: [] }, licenseCode: "HH-ORIGINAL" }); instance.store.update((state) => { state.contentDrafts.push({ ...response.item, id: response.item.id || response.item.contentId }); return state; }, "content:draft-create"); renderView(instance); return toast(instance, "Đã tạo bản nháp trên máy chủ; trạng thái machine_generated, chưa xuất bản.", "success"); } catch (error) { return toast(instance, `Không thể tạo bản nháp: ${error.message}`, "warning"); } }
    };
    instance.change = (event) => {
      if (event.target.matches("[data-school-elective]")) {
        instance.store.update((state) => { const selected = new Set(state.profile.electiveSubjectIds || []); event.target.checked ? selected.add(event.target.value) : selected.delete(event.target.value); if (selected.size <= 4) state.profile.electiveSubjectIds = [...selected]; return state; }, "profile:electives"); renderView(instance);
      }
      if (event.target.matches("[data-family-limit]")) instance.store.update((state) => { state.preferences.dailyMinutes = Math.max(10, Math.min(120, Number(event.target.value) || 20)); return state; }, "family:limit");
      if (event.target.matches("[data-family-pressure]")) instance.store.update((state) => { state.preferences.pressureNotifications = !event.target.checked; return state; }, "family:pressure-notifications");
    };
    instance.submit = async (event) => {
      const questionForm = event.target.closest("[data-school-question]");
      if (questionForm) { event.preventDefault(); return submitQuestion(instance, questionForm); }
      const assignment = event.target.closest("[data-teacher-assignment]");
      if (assignment) { event.preventDefault(); const form = new FormData(assignment); const item = { id: `assignment-${Date.now()}`, title: root.HHSchoolCore.clean(form.get("title"), 120), classId: root.HHSchoolCore.safeId(form.get("classId")), dueAt: new Date(form.get("dueAt")).toISOString(), lockAnswers: form.get("lockAnswers") === "on", status: "assigned", createdAt: new Date().toISOString(), syncStatus: "syncing" }; instance.store.update((state) => { state.assignments.push(item); return state; }, "assignment:create"); try { const response = await instance.sync.createAssignment(item); instance.store.update((state) => { const saved = state.assignments.find((entry) => entry.id === item.id); if (saved) Object.assign(saved, response.item || {}, { syncStatus: "synced" }); return state; }, "assignment:sync-success"); renderView(instance); return toast(instance, "Đã giao bài trên máy chủ.", "success"); } catch (error) { instance.store.update((state) => { const saved = state.assignments.find((entry) => entry.id === item.id); if (saved) Object.assign(saved, { syncStatus: "local-only", syncError: error.message }); return state; }, "assignment:sync-failed"); renderView(instance); return toast(instance, `Bài mới chỉ lưu trên thiết bị: ${error.message}`, "warning"); } }
      const familyAccept = event.target.closest("[data-family-accept]");
      if (familyAccept) { event.preventDefault(); const token = new FormData(familyAccept).get("token"); try { const response = await instance.sync.family({ action: "accept-invite", token }); toast(instance, `Đã liên kết hồ sơ ${response.learnerProfileId}.`, "success"); familyAccept.reset(); } catch (error) { toast(instance, error.message, "warning"); } }
      const classJoin = event.target.closest("[data-class-join]");
      if (classJoin) { event.preventDefault(); const state = instance.store.get(); const inviteCode = new FormData(classJoin).get("inviteCode"); try { const response = await instance.sync.joinClass(inviteCode, state.learnerProfileId); toast(instance, `Đã tham gia lớp ${response.className}.`, "success"); classJoin.reset(); await hydrate(instance); } catch (error) { toast(instance, error.message, "warning"); } }
      const math = event.target.closest("[data-math-plot]"); if (math) { event.preventDefault(); const data = new FormData(math); const a = Number(data.get("a")); const b = Number(data.get("b")); const rows = [-2,-1,0,1,2].map((x) => `${x} → ${Number((a*x+b).toFixed(3))}`); instance.host.querySelector("[data-math-output]").textContent = `y = ${a}x + ${b} · ${rows.join(" | ")}`; }
      const writing = event.target.closest("[data-writing-compare]"); if (writing) { event.preventDefault(); const data = new FormData(writing); const original = String(data.get("original") || ""); const revised = String(data.get("revised") || ""); const count = (text) => text.trim().split(/\s+/).filter(Boolean).length; instance.host.querySelector("[data-writing-output]").textContent = `Bản gốc được giữ nguyên (${count(original)} từ). Bản sửa ${count(revised)} từ, thay đổi ${Math.abs(count(revised)-count(original))} từ. Hãy tự kiểm tra luận điểm, bằng chứng, diễn đạt và chính tả.`; }
      const science = event.target.closest("[data-science-sim]"); if (science) { event.preventDefault(); const data = new FormData(science); const start = Number(data.get("start")); const change = Number(data.get("change")); const values = Array.from({length:6},(_,index)=>start+change*index); instance.host.querySelector("[data-science-output]").textContent = `MÔ PHỎNG: dữ liệu ${values.join(" → ")}. Xu hướng ${change>0?"tăng":change<0?"giảm":"không đổi"}; chưa đủ để khẳng định nguyên nhân trong thực nghiệm thật.`; }
      const sourceForm = event.target.closest("[data-source-analyze]"); if (sourceForm) { event.preventDefault(); const data = new FormData(sourceForm); instance.host.querySelector("[data-source-output]").textContent = `Phiếu kiểm chứng: người tạo “${root.HHSchoolCore.clean(data.get("creator"),120)}”; bối cảnh “${root.HHSchoolCore.clean(data.get("context"),200)}”. Cần đối chiếu nhận định với ít nhất một nguồn độc lập trước khi coi là sự thật.`; }
      const codeForm = event.target.closest("[data-code-run]"); if (codeForm) { event.preventDefault(); runCodeSandbox(instance, String(new FormData(codeForm).get("code") || "")); }
    };
    instance.keydown = (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); host.querySelector("[data-school-search]")?.focus(); } if (event.key === "Escape") host.querySelector("[data-school-dialog]")?.close(); };
    instance.input = (event) => {
      if (event.target.matches("[data-subject-filter]")) { const term = root.HHSchoolCurriculum.normalizeText(event.target.value); host.querySelectorAll("[data-school-subject]").forEach((item) => item.hidden = !root.HHSchoolCurriculum.normalizeText(item.textContent).includes(term)); }
      if (event.target.matches("[data-school-search]")) showSearch(instance, event.target.value);
    };
    host.addEventListener("click", instance.click); host.addEventListener("change", instance.change); host.addEventListener("submit", instance.submit); host.addEventListener("input", instance.input); document.addEventListener("keydown", instance.keydown);
  }

  async function submitQuestion(instance, form) {
    const state = instance.store.get(); const question = questionById(state, form.dataset.questionId); if (!question) return;
    let answer;
    if (question.type === "multiple") answer = [...form.querySelectorAll("input:checked")].map((input) => input.value);
    else if (question.type === "order") answer = [...form.querySelectorAll('select[name^="order-"]')].map((select) => select.value);
    else if (question.type === "matching") answer = Object.fromEntries([...form.querySelectorAll('[name^="match-"]')].map((input) => [input.name.slice(6), input.value]));
    else if (question.type === "upload") { const file = form.querySelector('input[type="file"]')?.files?.[0]; if (!file) return toast(instance, "Hãy chọn ảnh hoặc PDF.", "warning"); try { answer = await root.HHSchoolOffline.saveSubmissionFile(state.ownerId, state.learnerProfileId, file); } catch (error) { return toast(instance, error.message, "warning"); } }
    else { const control = form.querySelector("input:checked") || form.querySelector("input[type=text]") || form.querySelector("textarea"); if (!control || !control.value.trim()) return toast(instance, "Hãy chọn hoặc nhập câu trả lời.", "warning"); answer = control.value; }
    const responseMs = Math.max(0, Date.now() - Number(form.dataset.startedAt || Date.now()));
    const outcome = root.HHSchoolCore.recordAttempt(state, { lessonId: form.dataset.lessonId, question, answer, responseMs, helpLevel: 0, source: instance.view === "assessments" ? "in-app-assessment" : "in-app-practice" });
    instance.store.replace(outcome.state); const output = form.querySelector("[data-question-result]"); const pending = outcome.result.gradingStatus === "pending-review"; output.className = pending ? "is-pending" : outcome.result.correct ? "is-correct" : "is-wrong"; output.innerHTML = `<strong>${pending ? "Đã nộp" : outcome.result.correct ? "Chính xác" : "Chưa đúng"}</strong><span>${escape(outcome.result.explanation)}</span><small>Kỹ năng: ${escape(outcome.result.skillId)} · ${pending ? "chờ giáo viên nhận xét" : `trạng thái ${escape(outcome.mastery.state)} · độ chắc chắn ${number(outcome.mastery.certainty)}%`}</small>`;
  }

  async function tutor(instance, action) {
    const state = instance.store.get(); const lesson = findLesson(state, state.activeLessonId); const output = instance.host.querySelector("[data-tutor-output]");
    const local = { hint: `Hãy bắt đầu từ bước: ${lesson.workedExample.method[0]}.`, simplify: `Nói ngắn gọn: ${lesson.outcome}`, similar: `Hãy đổi dữ kiện của “${lesson.workedExample.prompt}” nhưng giữ nguyên cách làm.`, summarize: `Tóm tắt mục tiêu: ${lesson.outcome}`, flashcards: `Thẻ ghi nhớ: ${lesson.title} — ${lesson.outcome}`, socratic: "Em đã biết dữ kiện nào và cần tìm điều gì?", "exam-review": `Ôn lại từng bước của ${lesson.title} trước khi làm một câu tương đương.`, rubric: "Bản gốc đã được giữ; hãy tự đối chiếu từng tiêu chí rubric." }[action] || "Hãy xem lại mục tiêu và bước đầu tiên của bài.";
    output.textContent = "Đang chuẩn bị hướng dẫn an toàn...";
    try {
      const response = await instance.sync.aiTutor({ learnerProfileId: state.learnerProfileId, grade: state.profile.grade, lessonId: lesson.lessonId, action, originalWork: "", lessonContext: { title: lesson.title, outcome: lesson.outcome, method: lesson.workedExample.method } });
      output.textContent = response.answer; instance.host.querySelector("[data-tutor-report]").hidden = false;
    } catch (error) { output.textContent = `${local} (AI trực tuyến chưa sẵn sàng: ${error.message})`; }
  }

  function runCodeSandbox(instance, code) {
    const output = instance.host.querySelector("[data-code-output]"); instance.codeWorker?.terminate?.();
    if (!root.Worker) { output.textContent = "Trình duyệt không hỗ trợ Web Worker; sandbox không được mở."; return; }
    const worker = new root.Worker("hh-school-code-worker.js?v=2"); instance.codeWorker = worker; const id = `code-${Date.now()}`; output.textContent = "Đang chạy trong sandbox...";
    const timer = setTimeout(() => { worker.terminate(); if (instance.codeWorker === worker) instance.codeWorker = null; output.textContent = "Đã dừng: vượt giới hạn 1,5 giây."; }, 1500);
    worker.onmessage = (event) => { if (event.data?.id !== id) return; clearTimeout(timer); worker.terminate(); instance.codeWorker = null; output.textContent = event.data.ok ? event.data.output : `Lỗi: ${event.data.error}`; };
    worker.onerror = () => { clearTimeout(timer); worker.terminate(); instance.codeWorker = null; output.textContent = "Sandbox không thể chạy đoạn mã này."; };
    worker.postMessage({ id, code });
  }

  function settingsDialog(instance) {
    const state = instance.store.get(); const element = dialog(instance, `<form method="dialog" data-school-preferences><header><h2>Hiển thị dễ học</h2><button value="cancel" aria-label="Đóng">×</button></header><label><input type="checkbox" name="largeText" ${state.preferences.largeText ? "checked" : ""}> Chữ lớn</label><label><input type="checkbox" name="highContrast" ${state.preferences.highContrast ? "checked" : ""}> Tương phản cao</label><label><input type="checkbox" name="dyslexia" ${state.preferences.dyslexia ? "checked" : ""}> Font dễ đọc</label><label><input type="checkbox" name="reducedMotion" ${state.preferences.reducedMotion ? "checked" : ""}> Giảm chuyển động</label><button class="hhs-primary" value="default">Lưu</button></form>`);
    element.querySelector("form").addEventListener("submit", (event) => { const data = new FormData(event.currentTarget); instance.store.update((next) => { for (const key of ["largeText", "highContrast", "dyslexia", "reducedMotion"]) next.preferences[key] = data.get(key) === "on"; return next; }, "preferences:update"); mount(instance.rootHost, { ...instance.options, view: instance.view, store: instance.store }); });
  }

  async function syncNow(instance) {
    const state = instance.store.get();
    try { const response = await instance.sync.save(state.learnerProfileId, state, Number(state.serverRevision || 0)); instance.store.update((next) => { next.syncStatus = "synced"; next.serverRevision = response.revision; next.syncConflict = null; next.lastSyncedAt = response.updatedAt || new Date().toISOString(); return next; }, "sync:success"); toast(instance, "Tiến độ đã đồng bộ theo tài khoản và hồ sơ học sinh.", "success"); }
    catch (error) {
      if (error.status === 409) { instance.store.update((next) => { next.syncStatus = "conflict"; next.syncConflict = error.data?.conflict || null; return next; }, "sync:conflict"); return syncConflictDialog(instance, error.data?.conflict); }
      instance.store.update((next) => { next.syncStatus = "local-only"; return next; }, "sync:failed"); await root.HHSchoolOffline?.enqueue?.(state.ownerId, state.learnerProfileId, { url: "/api/education/progress", method: "PUT", body: { learnerProfileId: state.learnerProfileId, state, baseRevision: Number(state.serverRevision || 0) } }).catch(() => {}); toast(instance, `Đang lưu offline: ${error.message}`, "warning");
    }
  }

  function syncConflictDialog(instance, conflict = {}) {
    const element = dialog(instance, `<form method="dialog" data-sync-conflict><header><h2>Xung đột tiến độ</h2><button value="cancel" aria-label="Đóng">×</button></header><p>Bản máy chủ đã mới hơn. HH School không tự ghi đè.</p><button type="submit" name="choice" value="local">Giữ bản local</button><button type="submit" name="choice" value="server">Dùng bản server</button><button class="hhs-primary" type="submit" name="choice" value="merge">Hợp nhất bằng chứng</button></form>`);
    element.querySelector("form").addEventListener("submit", async (event) => { event.preventDefault(); const choice = event.submitter?.value; const local = instance.store.get(); if (choice === "server" && conflict.serverState) instance.store.replace(conflict.serverState); else if (choice === "merge" && conflict.serverState) instance.store.replace(root.HHSchoolCore.mergeStates(local, conflict.serverState, { currentUser: instance.options.currentUser })); else instance.store.update((state) => { state.serverRevision = conflict.serverRevision || 0; return state; }, "sync:keep-local"); element.close(); renderView(instance); if (choice !== "server") await syncNow(instance); });
  }

  function exportData(instance, format) {
    const state = instance.store.get();
    if (format === "json") return download(`hh-school-${state.learnerProfileId}.json`, instance.store.export());
    const rows = [["skillId", "state", "score", "attempts", "accuracy", "dueAt"], ...Object.entries(state.mastery).map(([id, item]) => [id, item.state, item.score, item.attempts, item.accuracy, item.dueAt])];
    download(`hh-school-progress-${state.learnerProfileId}.csv`, "\ufeff" + rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv;charset=utf-8");
  }

  function createClassDialog(instance) {
    const element = dialog(instance, `<form method="dialog" data-class-create><header><h2>Tạo lớp mới</h2><button value="cancel">×</button></header><label>Tên lớp<input name="name" required maxlength="80" placeholder="Ví dụ: 8A Toán"></label><label>Khối<input type="number" name="grade" min="1" max="12" value="${instance.store.get().profile.grade}" required></label><button class="hhs-primary" value="default">Tạo lớp</button></form>`);
    element.querySelector("form").addEventListener("submit", async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const item = { id: `class-${Date.now()}`, name: root.HHSchoolCore.clean(data.get("name"), 80), grade: Number(data.get("grade")), studentCount: 0, createdAt: new Date().toISOString(), syncStatus: "syncing" }; instance.store.update((state) => { state.classes.push(item); return state; }, "class:create"); let syncError = ""; try { const response = await instance.sync.createClass(item); instance.store.update((state) => { const saved = state.classes.find((entry) => entry.id === item.id); if (saved && response.item) Object.assign(saved, response.item, { syncStatus: "synced" }); return state; }, "class:sync-success"); } catch (error) { syncError = error.message; instance.store.update((state) => { const saved = state.classes.find((entry) => entry.id === item.id); if (saved) Object.assign(saved, { syncStatus: "local-only", syncError }); return state; }, "class:sync-failed"); } element.close(); renderView(instance); toast(instance, syncError ? `Lớp chỉ lưu local: ${syncError}` : "Đã tạo lớp và mã mời an toàn.", syncError ? "warning" : "success"); });
  }

  function familyDialog(instance) {
    const element = dialog(instance, `<form method="dialog"><header><h2>Tạo hồ sơ học sinh</h2><button value="cancel">×</button></header><label>Tên gọi<input name="name" required maxlength="80"></label><label>Lớp<input name="grade" type="number" min="1" max="12" required></label><button class="hhs-primary" value="default">Tạo hồ sơ</button></form>`);
    element.querySelector("form").addEventListener("submit", (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); instance.store.update((state) => { state.familyProfiles.push(root.HHSchoolCore.learnerProfile({ id: `learner-${Date.now()}`, name: data.get("name"), grade: data.get("grade"), managed: true, managerIds: [state.ownerId] }, state.ownerId)); return state; }, "family:profile-create"); element.close(); renderView(instance); });
  }

  function showSearch(instance, query) {
    const existing = instance.host.querySelector(".hhs-search-results"); existing?.remove(); if (!query.trim()) return;
    if (!instance.searchWorker) instance.searchWorker = createSearchWorker(instance);
    if (instance.searchWorker) {
      instance.searchRequestId = `search-${++searchSequence}`;
      instance.searchWorker.postMessage({ id: instance.searchRequestId, query, records: instance.searchRecords });
      return;
    }
    renderSearchResults(instance, root.HHSchoolCurriculum.search(query));
  }

  function renderSearchResults(instance, results) {
    instance.host.querySelector(".hhs-search-results")?.remove();
    const panel = document.createElement("div"); panel.className = "hhs-search-results"; panel.innerHTML = results.length ? results.map((lesson) => `<button type="button" data-school-open-lesson="${attr(lesson.lessonId)}"><strong>${escape(lesson.title)}</strong><span>Lớp ${escape(lesson.gradeId.replace("grade-", ""))} · ${escape(root.HHSchoolCurriculum.subjectBy(lesson.subjectId)?.name)}</span></button>`).join("") : "<p>Không tìm thấy bài học trong các gói hiện có.</p>"; instance.host.querySelector(".hhs-topbar").append(panel);
  }

  async function hydrate(instance) {
    const initial = instance.store.get();
    if (!instance.options.currentUser?.id) return;
    const tasks = [instance.sync.load(initial.learnerProfileId), instance.sync.assignments(initial.learnerProfileId)];
    if (["teacher", "school-admin", "platform-admin"].includes(initial.role)) tasks.push(instance.sync.classes());
    if (["parent", "platform-admin"].includes(initial.role)) tasks.push(instance.sync.request("/family"));
    const results = await Promise.allSettled(tasks);
    const progress = results[0]?.status === "fulfilled" ? results[0].value : null;
    const assignmentData = results[1]?.status === "fulfilled" ? results[1].value : null;
    const classData = results.find((entry) => entry.status === "fulfilled" && Array.isArray(entry.value?.items) && entry.value.items.some((item) => Object.hasOwn(item, "studentCount")))?.value;
    const familyData = results.at(-1)?.status === "fulfilled" && ["parent", "platform-admin"].includes(initial.role) ? results.at(-1).value : null;
    instance.store.update((state) => {
      if (progress?.state) { const merged = root.HHSchoolCore.mergeStates(state, progress.state, { currentUser: instance.options.currentUser }); Object.assign(state, merged); state.serverRevision = progress.revision || 0; state.syncStatus = "synced"; }
      if (assignmentData?.items) state.assignments = assignmentData.items;
      if (classData?.items) state.classes = classData.items;
      if (familyData?.items) { state.familyLinks = familyData.items; if (initial.role === "parent") state.familyProfiles = familyData.items.map((item) => ({ id: item.learnerProfileId, name: item.learnerName || "Hồ sơ đã liên kết", grade: null, ownerId: `linked:${item.id}`, managed: true, relationship: item.relationship })); }
      return state;
    }, "backend:hydrate");
    renderView(instance);
  }

  function mount(host, options = {}) {
    assertDependencies(); unmount(); if (!host) throw new Error("HH School requires a host.");
    const currentUser = options.currentUser || null; const store = options.store || root.HHSchoolCore.createStore({ currentUser }); const view = normalizeView(options.view);
    const wrapper = document.createElement("div"); wrapper.innerHTML = shellMarkup(store.get(), view); host.replaceChildren(wrapper.firstElementChild);
    const instance = { rootHost: host, host: host.firstElementChild, options, view, store, sync: new root.HHSchoolSync({ apiBase: options.apiBase || "/api/education" }), searchRecords: searchRecords(), searchWorker: null, searchRequestId: "" };
    mounted = instance; bind(instance); renderView(instance); hydrate(instance).catch((error) => toast(instance, `Đang dùng dữ liệu offline: ${error.message}`, "warning"));
    const persistOffline = (state) => root.HHSchoolOffline?.saveProfile?.(state.ownerId, state.learnerProfileId, state).catch(() => {});
    persistOffline(store.get());
    root.HHSchoolOffline?.savePack?.(root.HHSchoolCurriculum.packForGrade(store.get().profile.grade)).catch(() => {});
    instance.unsubscribe = store.subscribe((state) => persistOffline(state)); return { unmount, store, view };
  }

  function unmount() {
    if (!mounted) return; mounted.unsubscribe?.(); mounted.searchWorker?.terminate?.(); mounted.codeWorker?.terminate?.(); mounted.host?.removeEventListener("click", mounted.click); mounted.host?.removeEventListener("change", mounted.change); mounted.host?.removeEventListener("submit", mounted.submit); mounted.host?.removeEventListener("input", mounted.input); document.removeEventListener("keydown", mounted.keydown); mounted.rootHost?.replaceChildren(); mounted = null;
  }

  const api = Object.freeze({ mount, unmount, supports, views: VIEWS, normalizeView });
  root.HHSchool = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
