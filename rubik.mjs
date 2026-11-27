import { PUZZLES as BASE_PUZZLES, LESSONS as BASE_LESSONS } from "./rubik-lessons.mjs?v=3";
import { LARGE_PUZZLES, LARGE_LESSONS } from "./rubik-large-lessons.mjs?v=3";
import { CASES, CASE_GROUPS, getCaseCoverage } from "./rubik-cases.mjs?v=4";
import { CASE_CLIPS, SPECIAL_DIAGRAMS } from "./rubik-media.mjs?v=3";
import { changeReview, loadProgress } from "./rubik-progress.mjs?v=2";

const NAV = [
  ["", "Tổng quan"], ["hoc", "Bắt đầu học"], ["cong-thuc", "Thư viện công thức"],
  ["mo-phong", "Rubik 3D"], ["giai-khoi", "Giải khối của tôi"],
  ["luyen-tap", "Luyện tập"], ["dong-ho", "Đồng hồ"], ["tien-trinh", "Tiến trình"]
];
const PUZZLES = [...BASE_PUZZLES, ...LARGE_PUZZLES];
const LESSONS = [...BASE_LESSONS, ...LARGE_LESSONS];
const lessonById = new Map(LESSONS.map((lesson) => [lesson.id, lesson]));
const caseById = new Map(CASES.map((item) => [item.id, item]));
const groupById = new Map(CASE_GROUPS.map((group) => [group.id, group]));
const puzzleById = new Map(PUZZLES.map((puzzle) => [puzzle.id, puzzle]));
const sections = {
  "mo-phong": ["Tự xoay Rubik", "Chọn loại khối rồi thử từng nước bằng nút xoay hoặc bàn phím."],
  "giai-khoi": ["Giải khối của tôi", "Nhập màu sáu mặt hoặc chuỗi xáo Rubik 3×3 để xem lời giải từng nước."],
  "luyen-tap": ["Luyện tập", "Ôn nhận diện, nhớ công thức và tự xoay đến mục tiêu."],
  "dong-ho": ["Đồng hồ luyện giải", "Ghi lại lượt giải, mức phạt và trung bình của từng loại khối."]
};
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const search = (value) => String(value || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/đ/g, "d").replace(/’/g, "'").trim();
const bootPlayer = () => import("./rubik-player.mjs?v=4");
const lessonPath = (id) => "/rubik/hoc/" + encodeURIComponent(id);
const casePath = (id) => "/rubik/cong-thuc/" + encodeURIComponent(id);
const puzzleName = (id) => puzzleById.get(id)?.name || id;
const practicePath = (item) => linkPuzzle("luyen-tap", item.puzzle) + "&case=" + encodeURIComponent(item.id);
const isColoredCube = (puzzle) => /^[2-9]x/.test(puzzle);
const libraryFields = ["query", "group", "difficulty", "shape", "status"];
const reviewLabels = { new: "Chưa học", learning: "Đang học", known: "Đã nhớ" };
let libraryVisit;

function link(path, label, className = "") {
  return '<a class="rb-btn ' + className + '" href="#' + esc(path) + '">' + esc(label) + '</a>';
}

function external(url, label) {
  try {
    const target = new URL(typeof url === "object" ? url?.url : url);
    if (target.protocol === "https:") return '<a href="' + esc(target.href) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>';
  } catch { /* The source may be absent for original content. */ }
  return "";
}

function header(title, subtitle = "", detail = "") {
  return '<header class="rb-section-head">' + detail + '<h2>' + esc(title) + '</h2>' +
    (subtitle ? '<p>' + esc(subtitle) + '</p>' : "") + '</header>';
}

function selectPuzzle(value, caption = "Loại Rubik") {
  return '<label class="rb-field">' + caption + '<select data-rb-puzzle>' + PUZZLES.map((item) => (
    '<option value="' + esc(item.id) + '"' + (item.id === value ? " selected" : "") + '>' + esc(item.name) + '</option>'
  )).join("") + '</select></label>';
}

function linkPuzzle(page, puzzle) {
  return "/rubik/" + page + "?puzzle=" + encodeURIComponent(puzzle);
}

function visualization(target, opts, context) {
  return context.player().then(({ mountPlayer }) => {
    if (!context.alive() || !target.isConnected) return;
    const cleanup = mountPlayer(target, {
      labels: context.value.labels, twoD: context.value.twoD,
      onPreference(preference) {
        Object.assign(context.value, preference);
        context.store.save();
      },
      ...opts
    });
    if (typeof cleanup === "function") context.cleanups.push(cleanup);
  }).catch(() => {
    if (target.isConnected) target.textContent = "Chưa mở được mô phỏng. Hãy thử tải lại trang.";
  });
}

function setupOf(item) { return item?.setup || ""; }

function specialDiagram(item, side) {
  const src = "assets/rubik/diagrams/" + encodeURIComponent(item.id) + "-" + side + ".webp";
  return '<img class="rb-puzzle-image" width="332" height="210" loading="lazy" src="' + src + '" alt="' +
    esc(item.name + " · " + (side === "before" ? "Trước khi xoay" : "Sau khi xoay")) + '">';
}

function clickCopy(text, context) {
  return navigator.clipboard.writeText(text).then(
    () => context.say("Đã sao chép công thức."),
    () => context.say("Không sao chép tự động được. Bạn có thể chọn văn bản công thức để sao chép.")
  );
}

function overview(container, context) {
  const puzzle = context.puzzle;
  const lessons = LESSONS.filter((item) => item.puzzle === puzzle);
  const last = lessons.find((lesson) => lesson.id === context.value.last[puzzle]);
  const resume = last && context.value.lessons[last.id] ? lessons[lessons.indexOf(last) + 1] || last : last || lessons[0];
  const now = Date.now();
  const due = CASES.filter((item) => {
    const date = context.value.reviews[item.id]?.due;
    return item.puzzle === puzzle && date > 0 && date <= now;
  }).sort((a, b) => context.value.reviews[a.id].due - context.value.reviews[b.id].due);
  const training = due.length ? practicePath(due[0]) : linkPuzzle("luyen-tap", puzzle);
  const study = resume ? lessonPath(resume.id) : linkPuzzle("hoc", puzzle);

  container.innerHTML = '<section class="rb-hero"><div class="rb-hero-content">' +
    '<h2>Tự tay giải <em>Rubik</em></h2>' +
    '<p>Học từng nước trên khối 3D, tra đúng trường hợp đang gặp và luyện giải theo tốc độ của bạn.</p>' +
    '<div class="rb-controls rb-hero-actions">' + link(study, "Bắt đầu học", "rb-primary") +
    link(linkPuzzle("cong-thuc", puzzle), "Tra công thức") + link(training, "Luyện tập") + '</div>' +
    '<ul class="rb-hero-facts" aria-label="Nội dung Giải Rubik"><li><strong>' + PUZZLES.length + '</strong> loại khối</li><li><strong>' +
    LESSONS.length + '</strong> bài hướng dẫn</li><li><strong>' + CASES.length + '</strong> công thức</li></ul></div>' +
    '<figure class="rb-hero-art"><div class="rb-hero-model" data-rb-hero-model><span class="rb-model-loading">Đang mở Rubik 3D…</span></div>' +
    '<figcaption>Kéo khối để nhìn cả sáu mặt</figcaption></figure></section>' +
    '<section class="rb-section rb-home-section"><div class="rb-section-bar">' +
    header(last || due.length ? "Tiếp tục thực hành" : "Chọn khối bạn muốn tập") + selectPuzzle(puzzle) + '</div>' +
    '<div class="rb-feature-grid rb-home-grid"><article class="rb-panel rb-home-path">' +
    '<p class="rb-eyebrow">' + (last ? "Học tiếp" : "Bài học đầu tiên") + '</p><h3>' +
    esc(resume?.title || puzzleName(puzzle)) + '</h3><p>' +
    esc(resume?.objective || puzzleById.get(puzzle)?.description) + '</p>' +
    link(study, last ? "Học tiếp" : "Mở bài học") + '</article>' +
    '<article class="rb-panel rb-home-path"><p class="rb-eyebrow">Luyện công thức</p><h3>' +
    (due.length ? esc(due[0].name) : "Nhận diện và nhớ nước xoay") + '</h3><p>' +
    (due.length ? due.length + " trường hợp đến hạn ôn." : "Tập nhận diện, nhớ công thức hoặc tự xoay để giải một ca.") + '</p>' +
    link(training, due.length ? "Ôn ca này" : "Bắt đầu luyện") +
    '</article><article class="rb-panel rb-home-path"><p class="rb-eyebrow">Thực hành tự do</p><h3>Tự xoay và bấm giờ</h3><p>' +
    'Luyện trên khối 3D hoặc ghi thời gian giải Rubik thật.</p><div class="rb-controls">' +
    link(linkPuzzle("mo-phong", puzzle), "Mở mô phỏng") + link(linkPuzzle("dong-ho", puzzle), "Mở đồng hồ") +
    '</div></article></div></section>';

  const model = container.querySelector("[data-rb-hero-model]");
  context.player().then(({ mountFormulaPreview }) => {
    if (!context.alive()) return;
    context.cleanups.push(mountFormulaPreview(model, { puzzle: "3x3x3" }, { camera: "hero" }));
  }).catch(() => {
    if (context.alive()) model.textContent = "Chưa mở được khối 3D. Bạn vẫn có thể chọn bài học hoặc công thức.";
  });
}

function lessonList(container, context) {
  const items = LESSONS.filter((lesson) => lesson.puzzle === context.puzzle);
  const complete = items.filter((lesson) => context.value.lessons[lesson.id]).length;
  container.innerHTML = '<section class="rb-section rb-course"><div class="rb-section-bar">' +
    header("Bắt đầu học", puzzleById.get(context.puzzle)?.description) + selectPuzzle(context.puzzle) + '</div>' +
    (items.length ? '<div class="rb-panel rb-course-progress"><label for="rb-course-meter">' + complete + '/' + items.length +
      ' bài đã hoàn thành</label><progress id="rb-course-meter" value="' + complete + '" max="' + items.length + '"></progress></div>' : '') +
    '<div class="rb-feature-grid rb-course-grid">' + items.map((lesson) => {
      const done = Boolean(context.value.lessons[lesson.id]);
      const active = context.value.last[context.puzzle] === lesson.id && !done;
      return '<article class="rb-panel rb-course-card"><div class="rb-course-meta"><span class="rb-eyebrow">' + esc(lesson.level) + '</span>' +
        (done || active ? '<span data-review-state="' + (done ? "known" : "learning") + '">' + (done ? "Đã học" : "Đang học") + '</span>' : '') +
        '</div><h3>' + esc(lesson.title) + '</h3><p>' + esc(lesson.objective) + '</p>' +
        link(lessonPath(lesson.id), active ? "Học tiếp" : done ? "Ôn lại" : "Mở bài") + '</article>';
    }).join("") + '</div>' + (!items.length ? '<p>Chưa có bài học đã xuất bản cho khối này.</p>' : "") + '</section>';
}

function validVideo(video) { return typeof video?.id === "string" && /^[\w-]{11}$/.test(video.id); }

function localClipBlock(clip) {
  if (!/^assets\/rubik\/lessons\/[a-z0-9-]+\.mp4$/.test(clip?.src)) return "";
  const subtitles = /^assets\/rubik\/lessons\/[a-z0-9-]+\.vtt$/.test(clip.captions)
    ? '<track kind="captions" src="' + esc(clip.captions) + '" srclang="vi" label="Tiếng Việt" default>' : "";
  return '<figure class="rb-local-clip"><figcaption>' + esc(clip.label || "Minh họa từng nước") + '</figcaption><video aria-label="' +
    esc(clip.label || "Minh họa từng nước") + '" controls playsinline preload="none" src="' + esc(clip.src) + '">' + subtitles +
    '</video></figure>';
}

function lessonFigure(figure) {
  if (!/^assets\/rubik\/lessons\/[a-z0-9-]+\.(?:webp|png)$/.test(figure?.src)) return "";
  return '<figure class="rb-lesson-figure"><img loading="lazy" src="' + esc(figure.src) + '" alt="' + esc(figure.alt) +
    '"><figcaption>' + esc(figure.caption) + '</figcaption></figure>';
}

function videoBlock(video, title) {
  if (!validVideo(video)) return "";
  const params = new URLSearchParams({ cc_load_policy: "1", cc_lang_pref: "vi", hl: "vi", rel: "0", autoplay: "1" });
  if (Number.isFinite(video.start)) params.set("start", video.start);
  if (Number.isFinite(video.end)) params.set("end", video.end);
  const embed = "https://www.youtube-nocookie.com/embed/" + video.id + "?" + params;
  const watch = new URL("https://www.youtube.com/watch");
  watch.searchParams.set("v", video.id);
  if (Number.isFinite(video.start)) watch.searchParams.set("t", video.start + "s");
  const notes = Array.isArray(video.chapters) ? video.chapters : [];
  return '<div class="rb-video"><div class="rb-video-frame" data-rb-frame></div><div class="rb-controls">' +
    '<button type="button" class="rb-btn" data-rb-video="' + esc(embed) + '" data-title="' + esc(title) + '">Phát video hướng dẫn</button>' +
    external(watch.href, video.label || "Mở video gốc trên YouTube") +
    '</div>' + (notes.length ? '<details><summary>Ghi chú tiếng Việt theo thời gian</summary><ul>' + notes.map((note) =>
      '<li><strong>' + (Number.isFinite(note.time) ? Math.floor(note.time / 60) + ":" + String(note.time % 60).padStart(2, "0") + ' · ' : '') +
      esc(note.label) + '</strong> ' + esc(note.caption || "") + '</li>'
    ).join("") + '</ul></details>' : "") + '</div>';
}

function lessonPage(container, context, lesson) {
  const lessons = LESSONS.filter((item) => item.puzzle === lesson.puzzle);
  const index = lessons.indexOf(lesson);
  const next = lessons[index + 1];
  context.value.last[lesson.puzzle] = lesson.id;
  context.store.save();
  const guide = lesson.guide || [];
  const sources = (lesson.sources || []).map((source) => external(source.url, source.label)).filter(Boolean);
  const related = (lesson.caseGroups || []).map((id) => groupById.get(id)).filter((item) => item?.puzzle === lesson.puzzle);
  const quiz = guide.find((item) => item.quiz)?.quiz;
  const visual = '<aside class="rb-panel rb-visual"><h3>Thực hành trên khối</h3><div class="rb-stack" data-rb-lesson-player></div>' +
    (lesson.exercise?.goal ? '<div class="rb-exercise"><h4>Tự luyện</h4><p>' + esc(lesson.exercise.goal) + '</p>' +
      (lesson.exercise.setup != null ? '<button type="button" class="rb-btn" data-rb-exercise>Thử trên khối mô phỏng</button>' : "") + '</div>' : "") +
    '</aside>';
  const media = lessonFigure(lesson.figure) + localClipBlock(lesson.localClip) + videoBlock(lesson.video, lesson.title);
  container.innerHTML = '<section class="rb-section">' + header(lesson.title, lesson.objective,
    '<div class="rb-controls">' + link(linkPuzzle("hoc", lesson.puzzle), "Tất cả bài " + puzzleName(lesson.puzzle)) +
    '<button type="button" data-rb-jump>Đến mô phỏng</button></div>') +
    '<div class="rb-study rb-lesson-study">' + visual + '<div class="rb-stack rb-lesson-guide">' +
    (lesson.prerequisite ? '<p class="rb-note">Chuẩn bị: ' + esc(lessonById.get(lesson.prerequisite)?.title || lesson.prerequisite) + '</p>' : "") +
    guide.map((part, i) => '<article class="rb-panel rb-lesson-step"><h3>' + esc(part.title) + '</h3><p>' + esc(part.text) + '</p>' +
      (part.algorithm ? '<code class="rb-notation">' + esc(part.algorithm) + '</code>' : "") +
      (part.comparison?.length ? '<div class="rb-comparisons" data-rb-compare="' + i + '"></div>' : "") +
      (part.algorithm || part.setup != null ? '<button type="button" class="rb-btn" aria-pressed="false" data-rb-step="' + i + '">' +
        (part.algorithm ? "Làm theo từng nước" : "Xem khối mẫu") + '</button>' : "") + '</article>'
    ).join("") +
    (lesson.mistake ? '<p class="rb-note"><strong>Lỗi thường gặp</strong> ' + esc(lesson.mistake) + '</p>' : "") +
    (quiz ? '<article class="rb-panel rb-quiz"><h3>' + esc(quiz.prompt) + '</h3><div class="rb-stack">' +
      quiz.options.map((answer, i) => '<button type="button" class="rb-btn" data-rb-lesson-answer="' + i + '">' + esc(answer) + '</button>').join("") +
      '</div><p role="status" data-rb-quiz-feedback></p></article>' : "") +
    (media ? '<article class="rb-panel rb-lesson-media"><h3>Video và hình minh họa</h3>' + media + '</article>' : '') +
    (related.length ? '<article class="rb-panel"><h3>Bộ công thức liên quan</h3><div class="rb-controls">' +
      related.map((group) => link(linkPuzzle("cong-thuc", lesson.puzzle) + "&group=" + encodeURIComponent(group.id), group.name)).join("") + '</div></article>' : "") +
    (sources.length ? '<div class="rb-source">Nguồn tham khảo ' + sources.join(" · ") + '</div>' : "") + '</div></div>' +
    '<div class="rb-controls rb-lesson-footer"><button type="button" class="rb-btn rb-primary" data-rb-complete aria-pressed="' + !!context.value.lessons[lesson.id] + '">' +
    (context.value.lessons[lesson.id] ? "Đã học bài này" : "Đánh dấu đã học") + '</button>' +
    (next ? link(lessonPath(next.id), "Bài tiếp theo") : link(linkPuzzle("hoc", lesson.puzzle), "Về lộ trình")) + '</div></section>';

  function showStep(part, free = false, index = -1) {
    const target = container.querySelector("[data-rb-lesson-player]");
    for (const button of container.querySelectorAll("[data-rb-step]")) {
      button.setAttribute("aria-pressed", String(Number(button.dataset.rbStep) === index));
    }
    context.inlinePlayer?.();
    context.inlinePlayer = undefined;
    const thisView = ++context.playerVersion;
    context.player().then(({ mountPlayer, snapshot, cubeSize, diagram }) => {
      if (!context.alive() || context.playerVersion !== thisView) return;
      const size = cubeSize(lesson.puzzle);
      const mediaCase = caseById.get(part.caseId);
      const hasStill = mediaCase?.puzzle === lesson.puzzle && SPECIAL_DIAGRAMS.has(mediaCase.id);
      let comparison = "";
      if (part.algorithm && (size || hasStill)) {
        const start = size ? snapshot(lesson.puzzle, setupOf(part)) : null;
        const end = size ? snapshot(lesson.puzzle, part.algorithm, start) : null;
        comparison = '<details class="rb-step-stills"><summary>So sánh trước và sau khi xoay</summary><div class="rb-comparisons">' +
          ["before", "after"].map((side) => {
            const caption = side === "before" ? "Trước bước này" : "Kết quả của bước";
            return '<figure>' + (hasStill ? specialDiagram(mediaCase, side) : diagram(side === "before" ? start : end, size, {
              labels: context.value.labels, mirror: lesson.puzzle === "mirror", description: caption
            })) + '<figcaption>' + caption + '</figcaption></figure>';
          }).join("") + '</div></details>';
      }
      target.innerHTML = '<h4>' + esc(part.title || (free ? "Tự luyện trên khối" : "Thử nước xoay")) + '</h4>' +
        '<div data-rb-step-player></div>' + comparison;
      context.inlinePlayer = mountPlayer(target.querySelector("[data-rb-step-player]"), {
        puzzle: lesson.puzzle, setup: setupOf(part), algorithm: free ? "" : part.algorithm || "",
        free, goalAlgorithm: free ? part.algorithm : "", labels: context.value.labels, twoD: context.value.twoD
      });
    }).catch(() => { if (target.isConnected) target.textContent = "Chưa mở được mô phỏng cho bước này."; });
  }
  const firstVisual = guide.findIndex((part) => part.algorithm);
  if (firstVisual >= 0) showStep(guide[firstVisual], false, firstVisual);
  context.player().then(({ diagram, snapshot, cubeSize }) => {
    if (!context.alive()) return;
    for (const node of container.querySelectorAll("[data-rb-compare]")) {
      const comparison = guide[Number(node.dataset.rbCompare)].comparison;
      const size = cubeSize(lesson.puzzle);
      node.innerHTML = comparison.map((part) => {
        const found = caseById.get(part.caseId);
        const still = found?.puzzle === lesson.puzzle && SPECIAL_DIAGRAMS.has(found.id)
          ? specialDiagram(found, "before")
          : diagram(snapshot(lesson.puzzle, part.setup || ""), size, { labels: context.value.labels, mirror: lesson.puzzle === "mirror", description: part.label });
        const arrow = { clockwise: "↻", counterclockwise: "↺" }[part.arrow];
        return '<figure>' + still + (arrow ? '<span class="rb-turn-arrow" aria-hidden="true">' + esc(arrow) + '</span>' : '') +
          '<figcaption>' + esc(part.label) + '</figcaption>' +
          (part.algorithm || (!still && part.setup != null) ? '<button type="button" data-rb-compare-move="' + esc(part.algorithm || "") +
            '" data-setup="' + esc(part.setup || "") + '" data-label="' + esc(part.label) + '">' +
            (part.algorithm ? "Thử nước " + esc(part.algorithm) : "Mở khối mẫu") + '</button>' : '') + '</figure>';
      }).join("");
    }
  }).catch(() => {});
  container.addEventListener("click", (event) => {
    if (event.target.closest("[data-rb-jump]")) {
      const visual = container.querySelector(".rb-visual");
      visual.scrollIntoView({ block: "start" });
      (visual.querySelector("video, button, a") || visual).focus({ preventScroll: true });
      return;
    }
    const step = event.target.closest("[data-rb-step], [data-rb-exercise], [data-rb-complete], [data-rb-lesson-answer], [data-rb-compare-move]");
    if (!step) return;
    if (step.hasAttribute("data-rb-exercise")) showStep(lesson.exercise, true);
    else if (step.hasAttribute("data-rb-compare-move")) showStep({ setup: step.dataset.setup, algorithm: step.dataset.rbCompareMove, title: step.dataset.label });
    else if (step.hasAttribute("data-rb-complete")) {
      if (!context.value.lessons[lesson.id]) step.classList.add("rb-lesson-finished");
      context.value.lessons[lesson.id] = Date.now();
      const saved = context.store.save();
      step.textContent = "Đã học bài này";
      step.setAttribute("aria-pressed", "true");
      context.say(saved ? "Đã lưu tiến trình bài học." : "Đã đánh dấu cho phiên hiện tại.");
    } else if (step.hasAttribute("data-rb-lesson-answer")) {
      const chosen = Number(step.dataset.rbLessonAnswer);
      const correct = chosen === quiz.answer || quiz.options[chosen] === quiz.answer;
      const feedback = container.querySelector("[data-rb-quiz-feedback]");
      feedback.dataset.result = correct ? "correct" : "incorrect";
      feedback.textContent = (correct ? "Đúng. " : "Hãy quan sát lại. ") + (quiz.feedback || "");
    } else {
      const index = Number(step.dataset.rbStep);
      showStep(guide[index], false, index);
    }
    if (step.matches("[data-rb-step], [data-rb-exercise], [data-rb-compare-move]")) {
      container.querySelector("[data-rb-lesson-player]").scrollIntoView({ block: "nearest" });
    }
  }, { signal: context.signal });
}

function libraryPage(container, context) {
  const groups = CASE_GROUPS.filter((group) => group.puzzle === context.puzzle);
  const puzzleCases = CASES.filter((item) => item.puzzle === context.puzzle);
  const group = context.params.get("group") || "";
  const returning = libraryVisit?.route === context.route ? libraryVisit : null;
  libraryVisit = undefined;
  container.innerHTML = '<section class="rb-section rb-library">' + header("Thư viện công thức", "Kéo khối để quan sát. Mở tên công thức để xem từng nước xoay.") +
    '<div class="rb-panel rb-library-controls"><div class="rb-library-primary">' +
    '<label class="rb-field rb-library-search">Tìm công thức<input type="search" data-filter="query" placeholder="Ví dụ OLL 27, T-perm, R U"></label>' +
    selectPuzzle(context.puzzle) + '<label class="rb-field">Bộ công thức<select data-filter="group"><option value="">Tất cả</option>' +
    groups.map((item) => '<option value="' + esc(item.id) + '">' + esc(item.name) + '</option>').join("") + '</select></label></div>' +
    '<div class="rb-library-secondary"><details class="rb-filter-extra"><summary>Bộ lọc nâng cao</summary><div class="rb-filters">' +
    '<label class="rb-field">Độ khó<select data-filter="difficulty"><option value="">Tất cả</option>' +
    [...new Set(puzzleCases.map((item) => item.difficulty).filter(Boolean))].map((level) =>
      '<option>' + esc(level) + '</option>').join("") + '</select></label>' +
    '<label class="rb-field">Dấu hiệu<select data-filter="shape"><option value="">Tất cả</option>' +
    [...new Set(puzzleCases.map((item) => item.shape).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi")).map((shape) =>
      '<option>' + esc(shape) + '</option>').join("") + '</select></label>' +
    '<label class="rb-field">Tiến độ<select data-filter="status"><option value="">Tất cả</option>' +
    Object.entries(reviewLabels).map(([value, label]) => '<option value="' + value + '">' + label + '</option>').join("") +
    '<option value="favorite">Yêu thích</option></select></label></div></details>' +
    '<button type="button" data-rb-library-favorites aria-pressed="false">Yêu thích</button>' +
    '<button type="button" data-rb-clear-filters hidden>Xóa bộ lọc</button></div></div>' +
    '<div class="rb-library-summary"><p role="status" data-rb-count></p>' +
    (isColoredCube(context.puzzle) ? '<p class="rb-cube-orientation" aria-label="Hướng cầm chuẩn"><span data-swatch="white">D trắng</span><span data-swatch="yellow">U vàng</span><span data-swatch="blue">F xanh dương</span></p>' : '') +
    '</div><div class="rb-case-grid" data-rb-results></div>' +
    '<button type="button" class="rb-btn rb-more" data-rb-more hidden>Xem thêm công thức</button></section>';
  let limit = returning?.limit || 18;
  let playerModule;
  const tracked = new Map();
  const placeholder = '<span class="rb-model-loading" aria-hidden="true">Đang tải khối 3D…</span>';
  const fields = Object.fromEntries(libraryFields.map((key) => [key, container.querySelector('[data-filter="' + key + '"]')]));
  const field = (key) => fields[key].value;
  fields.group.value = [...fields.group.options].some((option) => option.value === group) ? group : "";
  const advanced = container.querySelector(".rb-filter-extra");
  const favorites = container.querySelector("[data-rb-library-favorites]");
  const clear = container.querySelector("[data-rb-clear-filters]");
  if (returning) {
    for (const key of libraryFields) fields[key].value = returning.filters[key];
    advanced.open = returning.advanced;
  }
  const results = container.querySelector("[data-rb-results]");
  const count = container.querySelector("[data-rb-count]");
  const more = container.querySelector("[data-rb-more]");
  function load(node) {
    const entry = tracked.get(node);
    if (!entry || entry.loading || entry.dispose) return;
    const token = {};
    entry.loading = token;
    playerModule ??= context.player();
    playerModule.then(({ mountFormulaPreview }) => {
      if (!context.alive() || entry.loading !== token) return;
      const item = caseById.get(node.dataset.rbCaseModel);
      entry.dispose = mountFormulaPreview(node, item, {
        labels: context.value.labels,
        fallback() {
          if (SPECIAL_DIAGRAMS.has(item.id)) node.innerHTML = specialDiagram(item, "before");
          else node.textContent = "Chưa mở được khối 3D.";
        }
      });
      entry.loading = null;
    }).catch(() => {
      if (!context.alive() || entry.loading !== token) return;
      entry.loading = null;
      node.textContent = "Chưa mở được khối 3D.";
    });
  }

  function unload(node) {
    const entry = tracked.get(node);
    if (!entry) return;
    entry.dispose?.();
    entry.dispose = null;
    entry.loading = null;
    node.innerHTML = placeholder;
  }

  const observer = typeof IntersectionObserver === "function" ? new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      const entry = tracked.get(target);
      if (!entry) continue;
      entry.visible = isIntersecting;
      if (isIntersecting) load(target);
      else if (!target.contains(document.activeElement)) unload(target);
    }
  }, { rootMargin: "160px 0px" }) : null;

  results.addEventListener("focusout", (event) => {
    const node = event.target.closest("[data-rb-case-model]");
    if (node && !tracked.get(node)?.visible && !node.contains(event.relatedTarget)) unload(node);
  }, { signal: context.signal });
  context.cleanups.push(() => {
    observer?.disconnect();
    for (const node of tracked.keys()) unload(node);
    tracked.clear();
  });

  function render(append = false) {
    const query = search(field("query"));
    const groupFilter = field("group");
    const difficulty = field("difficulty");
    const shape = field("shape");
    const status = field("status");
    const filtered = puzzleCases.filter((item) => {
      const row = context.value.reviews[item.id] || {};
      const matchesStatus = !status || (status === "favorite" ? row.favorite : (row.status || "new") === status);
      return (!groupFilter || item.group === groupFilter) && (!difficulty || item.difficulty === difficulty) &&
        (!shape || item.shape === shape) &&
        matchesStatus && search([item.id.replace(/-/g, " "), item.name, item.shape, item.algorithm].join(" ")).includes(query);
    });
    count.textContent = filtered.length + " công thức" + (filtered.length > limit ? " · đang hiện " + limit : "");
    favorites.setAttribute("aria-pressed", String(status === "favorite"));
    clear.hidden = !libraryFields.some((key) => field(key));
    if (!append) {
      for (const node of tracked.keys()) {
        observer?.unobserve(node);
        unload(node);
      }
      tracked.clear();
      results.replaceChildren();
    }
    const previous = append ? tracked.size : 0;
    const next = filtered.slice(previous, limit);
    results.insertAdjacentHTML("beforeend", next.map((item) => {
      const groupName = groupById.get(item.group)?.name || "";
      const review = context.value.reviews[item.id] || {};
      const state = Object.hasOwn(reviewLabels, review.status) ? review.status : "new";
      const accent = item.group.includes("oll") ? "yellow" : item.group === "f2l" ? "mint" : item.puzzle === "mirror" ? "silver" : "blue";
      return '<article class="rb-panel rb-case-card" data-rb-case-accent="' + accent + '"><div class="rb-case-model" data-rb-case-model="' + esc(item.id) + '">' +
        placeholder + '</div><div class="rb-case-copy"><span class="rb-eyebrow">' + esc(groupName) + '</span>' +
        '<a class="rb-case" href="#' + casePath(item.id) + '"><strong>' + esc(item.name) + '</strong><code>' + esc(item.algorithm) + '</code></a>' +
        '<div class="rb-case-status"><span data-rb-card-status data-review-state="' + state + '">' + reviewLabels[state] + '</span>' +
        (review.favorite ? '<span class="rb-card-favorite">Yêu thích</span>' : '') + '</div></div></article>';
    }).join(""));
    if (!filtered.length) results.innerHTML = '<div class="rb-empty"><h3>Chưa tìm thấy công thức</h3><p>' +
      (status === "favorite" && !query ? "Các công thức bạn đánh dấu yêu thích sẽ xuất hiện ở đây." : "Thử từ khóa ngắn hơn hoặc bỏ bớt bộ lọc.") +
      '</p></div>';
    for (const card of Array.from(results.children).slice(previous)) {
      const node = card.querySelector("[data-rb-case-model]");
      if (!node) continue;
      tracked.set(node, { visible: !observer });
      if (observer) observer.observe(node);
      else load(node);
    }
    more.hidden = filtered.length <= limit;
  }
  function refresh() {
    limit = 18;
    render();
  }
  container.addEventListener("input", (event) => { if (event.target.matches("[data-filter]")) refresh(); }, { signal: context.signal });
  favorites.addEventListener("click", () => {
    fields.status.value = field("status") === "favorite" ? "" : "favorite";
    refresh();
  }, { signal: context.signal });
  clear.addEventListener("click", () => {
    Object.values(fields).forEach((input) => { input.value = ""; });
    refresh();
    fields.query.focus();
  }, { signal: context.signal });
  more.addEventListener("click", () => { limit += 18; render(true); }, { signal: context.signal });

  const workspace = context.root.closest(".app-workspace");
  const main = context.root.closest(".app-main");
  results.addEventListener("click", (event) => {
    const caseLink = event.target.closest(".rb-case");
    if (!caseLink || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    libraryVisit = {
      scope: context.store.key, route: context.route, puzzle: context.puzzle, limit, advanced: advanced.open,
      filters: Object.fromEntries(libraryFields.map((key) => [key, field(key)])),
      anchor: caseLink.getAttribute("href"), keyboard: event.detail === 0,
      scroll: [workspace?.scrollTop || 0, main?.scrollTop || 0, window.scrollY]
    };
  }, { capture: true, signal: context.signal });

  render();
  if (returning) requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!context.alive()) return;
    if (workspace) workspace.scrollTop = returning.scroll[0];
    if (main) main.scrollTop = returning.scroll[1];
    window.scrollTo({ top: returning.scroll[2], behavior: "instant" });
    if (returning.keyboard) {
      const anchor = [...results.querySelectorAll(".rb-case")].find((link) => link.getAttribute("href") === returning.anchor);
      anchor?.focus({ preventScroll: true });
    }
  }));
}

function casePage(container, context, item) {
  const row = context.value.reviews[item.id] || {};
  const group = groupById.get(item.group);
  const groupRoute = linkPuzzle("cong-thuc", item.puzzle) + "&group=" + encodeURIComponent(item.group);
  const returnRoute = libraryVisit?.puzzle === item.puzzle ? libraryVisit.route : groupRoute;
  const similar = CASES.filter((other) => other.id !== item.id && other.group === item.group &&
    item.shape && other.shape === item.shape).slice(0, 4);
  const variants = [{ algorithm: item.algorithm, setup: item.setup },
    ...(item.variants || []).map((variant) => typeof variant === "string" ? { algorithm: variant, setup: item.setup } : variant)];
  const source = external(item.source, "Nguồn công thức");
  let { algorithm, setup } = variants[0];
  container.innerHTML = '<section class="rb-section">' + header(item.name, item.tip || item.description,
    '<a class="rb-back-link" data-rb-library-back href="#' + esc(returnRoute) + '"><span aria-hidden="true">←</span> Thư viện công thức</a>') +
    '<div class="rb-study rb-case-study"><aside class="rb-panel rb-visual"><div class="rb-visual-head"><h3>Làm theo từng nước</h3>' +
    '<span class="rb-eyebrow">' + esc(puzzleName(item.puzzle)) + '</span></div><div data-rb-case-player>' +
    '<p class="rb-note">Đang tải khối 3D…</p></div>' +
    (CASE_CLIPS.has(item.id) ? '<p><button class="rb-btn" type="button" data-rb-local-clip="' + esc(item.id) + '">Xem video công thức chính</button></p>' : "") +
    '</aside><div class="rb-stack"><article class="rb-panel"><p class="rb-eyebrow">' + esc(puzzleName(item.puzzle) + " · " + (item.difficulty || group?.name || "")) +
    '</p><h3>Nhận diện và hướng cầm</h3><p>' + esc(item.recognition || item.orientation ||
      "Đối chiếu mặt trên U và mặt trước F với sơ đồ. Sau khi đã căn đúng trạng thái, mới chạy công thức.") + '</p>' +
    (isColoredCube(item.puzzle) ? '<p class="rb-note rb-orientation">Hướng chuẩn: giữ trắng ở dưới (D), vàng ở trên (U) và xanh dương ở trước (F). Các ca đang giải tầng cuối có thể chưa phẳng màu vàng.</p>' : "") +
    '<div class="rb-comparisons" data-rb-case-compare></div></article><article class="rb-panel"><h3>Công thức</h3>' +
    (variants.length > 1 ? '<label class="rb-field">Biến thể<select data-rb-variant>' +
      variants.map((variant, i) => '<option value="' + i + '">' + (i ? "Biến thể " + i : "Công thức chính") + '</option>').join("") + '</select></label>' : "") +
    '<code class="rb-notation" data-rb-formula>' + esc(algorithm) + '</code><div class="rb-controls">' +
    '<button type="button" class="rb-btn" data-rb-copy>Sao chép</button><button type="button" class="rb-btn" data-rb-favorite aria-pressed="' + !!row.favorite + '">' +
    (row.favorite ? "Đã yêu thích" : "Yêu thích") + '</button>' + link(practicePath(item), "Tự xoay ca này") +
    '</div><label class="rb-field">Tiến độ<select data-rb-review>' +
    [["", "Chưa học"], ["learning", "Đang học"], ["known", "Đã nhớ"]].map(([value, title]) =>
      '<option value="' + value + '"' + (value === (row.status || "") ? " selected" : "") + '>' + title + '</option>').join("") +
    '</select></label>' + (source ? '<p class="rb-source">' + source + '</p>' : "") +
    '</article>' + (similar.length ? '<article class="rb-panel"><h3>So sánh trường hợp tương tự</h3><div class="rb-controls">' +
      similar.map((other) => link(casePath(other.id), other.name)).join("") + '</div></article>' : "") +
    '</div></div></section>';

  function draw() {
    const token = ++context.playerVersion;
    context.inlinePlayer?.();
    context.inlinePlayer = undefined;
    context.player().then(({ diagram, snapshot, cubeSize, mountPlayer }) => {
      if (!context.alive() || token !== context.playerVersion) return;
      const size = cubeSize(item.puzzle);
      const before = snapshot(item.puzzle, setup || "");
      const after = snapshot(item.puzzle, algorithm, before);
      const comparison = container.querySelector("[data-rb-case-compare]");
      if (SPECIAL_DIAGRAMS.has(item.id)) comparison.innerHTML = ["before", "after"].map((side) =>
        '<figure><button type="button" class="rb-diagram-open" data-rb-enlarge>' + specialDiagram(item, side) +
        '<span>Phóng to hình</span></button><figcaption>' + (side === "before" ? "Trước khi xoay" : "Sau khi xoay") + '</figcaption></figure>'
      ).join("");
      else if (size) comparison.innerHTML = [
        [before, "Nhận diện trước khi xoay"], [after, "Sau khi áp dụng"]
      ].map(([state, caption]) => '<figure><button type="button" class="rb-diagram-open" data-rb-enlarge>' +
        diagram(state, size, { description: caption + " – " + item.name, labels: context.value.labels, whiteBottom: !item.nativePalette }) +
        '<span>Phóng to hình</span></button><figcaption>' + caption + '</figcaption></figure>').join("");
      const target = container.querySelector("[data-rb-case-player]");
      context.inlinePlayer = mountPlayer(target, {
        puzzle: item.puzzle, group: item.group, setup: setup || "", algorithm, labels: context.value.labels, whiteBottom: !item.nativePalette
      });
    }).catch(() => {
      if (!context.alive() || token !== context.playerVersion) return;
      container.querySelector("[data-rb-case-player]").textContent = "Chưa mở được khối 3D cho biến thể này.";
    });
  }

  draw();
  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-rb-copy], [data-rb-favorite], [data-rb-enlarge]");
    if (!button) return;
    if (button.hasAttribute("data-rb-copy")) clickCopy(algorithm, context);
    if (button.hasAttribute("data-rb-favorite")) {
      const favorite = !context.value.reviews[item.id]?.favorite;
      changeReview(context.value, item.id, { favorite });
      context.store.save();
      button.setAttribute("aria-pressed", String(favorite));
      button.textContent = favorite ? "Đã yêu thích" : "Yêu thích";
    }
    if (button.hasAttribute("data-rb-enlarge")) {
      const dialog = context.root.querySelector("dialog");
      dialog.querySelector("[data-rb-enlarged]").replaceChildren(button.querySelector(".rb-net, .rb-puzzle-image").cloneNode(true));
      dialog.showModal();
    }
  }, { signal: context.signal });
  container.addEventListener("change", (event) => {
    if (event.target.matches("[data-rb-review]")) {
      changeReview(context.value, item.id, { status: event.target.value });
      context.store.save();
    } else if (event.target.matches("[data-rb-variant]")) {
      ({ algorithm, setup = item.setup } = variants[Number(event.target.value)]);
      container.querySelector("[data-rb-formula]").textContent = algorithm;
      draw();
    }
  }, { signal: context.signal });
}

function progressPage(container, context) {
  const covered = getCaseCoverage();
  const review = Object.values(context.value.reviews);
  container.innerHTML = '<section class="rb-section">' + header("Tiến trình", "Bài học, công thức và lượt giải đã lưu trên thiết bị theo tài khoản đang dùng.") +
    '<div class="rb-stats"><div><strong>' + Object.keys(context.value.lessons).length + '</strong><span>Bài đã học</span></div><div><strong>' +
    review.filter((item) => item.status === "known").length + '</strong><span>Công thức đã nhớ</span></div><div><strong>' +
    context.value.records.length + '</strong><span>Lượt bấm giờ</span></div></div>' +
    '<article class="rb-panel rb-progress-favorites"><h3>Yêu thích</h3><div class="rb-controls">' +
    (CASES.filter((item) => context.value.reviews[item.id]?.favorite).map((item) => link(casePath(item.id), item.name)).join("") || '<p>Chưa lưu công thức yêu thích.</p>') +
    '</div></article><h3>Độ phủ nội dung</h3><div class="rb-progress-grid" data-rb-coverage></div>' +
    '<p class="rb-note">Số có clip được đếm riêng. Bảng này phản ánh dữ liệu đang có trong bản hiện tại.</p></section>';
  const coverage = container.querySelector("[data-rb-coverage]");
  coverage.innerHTML = PUZZLES.map((puzzle) => {
      const rows = covered.filter((group) => group.puzzle === puzzle.id);
      const lessons = LESSONS.filter((item) => item.puzzle === puzzle.id);
      return '<details class="rb-panel rb-coverage"><summary>' + esc(puzzle.name) + ' · ' + lessons.length +
        ' bài · ' + CASES.filter((item) => item.puzzle === puzzle.id).length + ' trường hợp</summary>' +
        '<p>' + lessons.filter((item) => validVideo(item.video)).length + ' bài có video nguồn · ' +
        lessons.filter((item) => item.localClip).length + ' video bài học có phụ đề trên website</p>' +
        (rows.length ? '<ul>' + rows.map((group) =>
          '<li>' + esc(group.name) + ' — ' + esc(group.loaded) + '/' + esc(group.expected ?? "đang thống kê") + ' trường hợp · ' +
          esc(group.verified) + ' kiểm chứng · ' + CASES.filter((item) => item.group === group.id &&
            (SPECIAL_DIAGRAMS.has(item.id) || isColoredCube(item.puzzle))).length + ' cặp hình · ' +
          CASES.filter((item) => item.group === group.id && CASE_CLIPS.has(item.id)).length + ' clip</li>'
        ).join("") + '</ul>' : '<p>Đang xây dựng bộ công thức riêng cho khối này.</p>') +
        '<p>Bộ giải khi nhập màu: ' + (puzzle.id === "3x3x3" ? "có hỗ trợ" : "chưa hỗ trợ") + '.</p></details>';
  }).join("");
}

export function mountRubik(host, { route = "/rubik", currentUser } = {}) {
  const abort = new AbortController();
  const store = loadProgress(currentUser);
  const [path, query = ""] = route.split("?");
  const [, page = "", key] = path.split("/").filter(Boolean);
  const params = new URLSearchParams(query);
  const lookup = page === "hoc" ? lessonById.get(key) : page === "cong-thuc" ? caseById.get(key) : null;
  const selected = lookup?.puzzle || params.get("puzzle");
  const puzzle = puzzleById.has(selected) ? selected : "3x3x3";
  host.innerHTML = '<section class="rb" aria-label="Giải Rubik"><nav class="rb-nav" aria-label="Điều hướng Giải Rubik">' +
    NAV.map(([id, title]) => {
      const destination = id ? "/rubik/" + id : "/rubik";
      const suffix = puzzle === "3x3x3" || ["giai-khoi", "tien-trinh"].includes(id) ? "" : "?puzzle=" + encodeURIComponent(puzzle);
      return '<a href="#' + destination + suffix + '"' + (page === id ? ' aria-current="page"' : "") + '>' + title + '</a>';
    }).join("") + '</nav><div data-rb-body></div><p class="rb-live" role="status" data-rb-live></p>' +
    '<dialog class="rb-dialog" aria-label="Hình nhận diện phóng to"><form method="dialog"><button class="rb-btn">Đóng</button></form>' +
    '<div data-rb-enlarged></div></dialog></section>';
  const root = host.firstElementChild;
  const body = root.querySelector("[data-rb-body]");
  if (page !== "cong-thuc" || libraryVisit?.scope !== store.key) libraryVisit = undefined;
  const context = {
    root, route, puzzle, params, store, value: store.value, signal: abort.signal, cleanups: [], playerVersion: 0,
    alive: () => !abort.signal.aborted && host.isConnected,
    player: bootPlayer,
    say(message) {
      const live = root.querySelector("[data-rb-live]");
      live.textContent = message;
    }
  };
  root.addEventListener("change", (event) => {
    if (!event.target.matches("[data-rb-puzzle]")) return;
    const destination = NAV.some(([id]) => id === page) && page ? "/rubik/" + page : "/rubik";
    location.hash = "#" + destination + "?puzzle=" + encodeURIComponent(event.target.value);
  }, { signal: abort.signal });
  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-rb-video], [data-rb-local-clip]");
    if (!button) return;
    if (button.hasAttribute("data-rb-local-clip")) {
      const video = document.createElement("video");
      video.controls = true;
      video.playsInline = true;
      video.src = "assets/rubik/clips/" + encodeURIComponent(button.dataset.rbLocalClip) + ".mp4";
      video.addEventListener("error", () => context.say("Chưa tải được video. Bạn có thể dùng nút Phát của mô phỏng."), { once: true });
      button.parentElement.replaceWith(video);
      video.play().catch(() => {});
      return;
    }
    const video = button.closest(".rb-video");
    const iframe = document.createElement("iframe");
    iframe.src = button.dataset.rbVideo;
    iframe.title = button.dataset.title || "Video hướng dẫn Rubik";
    iframe.allow = "autoplay; encrypted-media; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    video.querySelector("[data-rb-frame]").replaceChildren(iframe);
    button.textContent = "Phát lại đoạn này";
  }, { signal: abort.signal });

  if (key && !lookup && ["hoc", "cong-thuc"].includes(page)) {
    body.innerHTML = '<section class="rb-section">' + header("Nội dung này chưa có", "Hãy chọn một bài hoặc trường hợp đang có trong thư viện.") +
      link("/rubik/" + page, "Mở danh mục") + '</section>';
  } else if (page === "hoc") {
    if (lookup) lessonPage(body, context, lookup);
    else lessonList(body, context);
  } else if (page === "cong-thuc") {
    if (lookup) casePage(body, context, lookup);
    else libraryPage(body, context);
  } else if (page === "tien-trinh") {
    progressPage(body, context);
  } else if (page === "mo-phong") {
    body.innerHTML = '<section class="rb-section rb-simulation"><div class="rb-section-bar">' + header(...sections[page]) +
      selectPuzzle(puzzle) + '</div><div class="rb-panel rb-visual" data-rb-free></div></section>';
    visualization(body.querySelector("[data-rb-free]"), { puzzle, free: true, whiteBottom: true }, context);
  } else if (sections[page]) {
    body.innerHTML = '<section class="rb-section">' + header(...sections[page]) + '<div data-rb-tool role="status">Đang mở công cụ…</div></section>';
    import("./rubik-tools.mjs?v=4").then(({ mountTool }) => {
      if (!context.alive()) return;
      const panel = body.querySelector("[data-rb-tool]");
      panel.removeAttribute("role");
      mountTool(panel, page, { ...context, selectPuzzle, esc, link, casePath });
    }).catch(() => { if (context.alive()) body.querySelector("[data-rb-tool]").textContent = "Chưa mở được công cụ. Hãy thử tải lại trang."; });
  } else {
    overview(body, context);
  }
  return {
    destroy() {
      abort.abort();
      context.inlinePlayer?.();
      for (const dispose of context.cleanups) dispose();
      host.replaceChildren();
    }
  };
}
