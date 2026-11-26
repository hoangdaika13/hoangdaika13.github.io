import { PUZZLES as BASE_PUZZLES, LESSONS as BASE_LESSONS } from "./rubik-lessons.mjs?v=2";
import { LARGE_PUZZLES, LARGE_LESSONS } from "./rubik-large-lessons.mjs?v=1";
import { CASES, CASE_GROUPS, getCaseCoverage } from "./rubik-cases.mjs?v=2";
import { CASE_CLIPS, SPECIAL_DIAGRAMS } from "./rubik-media.mjs?v=2";
import { changeReview, loadProgress } from "./rubik-progress.mjs?v=1";

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
const bootPlayer = () => import("./rubik-player.mjs?v=2");
const lessonPath = (id) => "/rubik/hoc/" + encodeURIComponent(id);
const casePath = (id) => "/rubik/cong-thuc/" + encodeURIComponent(id);
const puzzleName = (id) => puzzleById.get(id)?.name || id;
const practicePath = (item) => linkPuzzle("luyen-tap", item.puzzle) + "&case=" + encodeURIComponent(item.id);
const isColoredCube = (puzzle) => /^[2-9]x/.test(puzzle);

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

function cubeMark() {
  const tiles = '<i></i>'.repeat(9);
  return '<div class="rb-hero-art" aria-hidden="true"><span class="rb-orbit"></span><div class="rb-cube-art"><span>' + tiles +
    '</span><span>' + tiles + '</span><span>' + tiles + '</span></div></div>';
}

function overview(container, context) {
  const puzzle = context.puzzle;
  const lessons = LESSONS.filter((item) => item.puzzle === puzzle);
  const first = lessons[0];
  const last = lessonById.get(context.value.last[puzzle]);
  const due = CASES.filter((item) => item.puzzle === puzzle && context.value.reviews[item.id]?.due != null && context.value.reviews[item.id].due <= Date.now()).length;

  container.innerHTML = '<section class="rb-hero"><div>' +
    '<h2>Tự giải Rubik từ đầu</h2><p>Cầm khối lên và bắt đầu với nước xoay đầu tiên. Xem hình nhận diện, thử từng công thức và luyện theo tốc độ của bạn.</p>' +
    '<div class="rb-controls">' + link(lessonPath("notation"), "Tôi chưa biết giải", "rb-primary") +
    link("/rubik/cong-thuc", "Tra cứu công thức") + '</div></div>' + cubeMark() + '</section>' +
    '<section class="rb-stats" aria-label="Tổng quan nội dung">' +
    '<div><strong>' + PUZZLES.length + '</strong><span>Loại câu đố</span></div><div><strong>' + LESSONS.length +
    '</strong><span>Bài hướng dẫn</span></div><div><strong>' + CASES.length + '</strong><span>Trường hợp công thức</span></div></section>' +
    '<section class="rb-section">' + header("Bắt đầu từ khối bạn có", "Chọn loại Rubik để xem bài học và công cụ phù hợp.") +
    selectPuzzle(puzzle) +
    '<div class="rb-feature-grid"><article class="rb-panel"><h3>' + esc(last?.title || first?.title || puzzleName(puzzle)) + '</h3><p>' +
    esc(last?.objective || first?.objective || puzzleById.get(puzzle)?.description) + '</p>' +
    (last || first ? link(lessonPath((last || first).id), last ? "Học tiếp" : "Mở bài học", "rb-primary") : "") +
    '</article><article class="rb-panel"><h3>Ôn theo tiến trình</h3><p>' + (due ? due + " trường hợp đến hạn ôn." : "Luyện nhìn hình và thử công thức để tạo lịch ôn cá nhân.") +
    '</p>' + link(linkPuzzle("luyen-tap", puzzle), "Bắt đầu luyện") + '</article><article class="rb-panel"><h3>Tự xoay và bấm giờ</h3><p>Luyện với khối mô phỏng hoặc ghi thời gian giải trên Rubik thật.</p>' +
    '<div class="rb-controls">' + link(linkPuzzle("mo-phong", puzzle), "Mở mô phỏng") + link(linkPuzzle("dong-ho", puzzle), "Mở đồng hồ") +
    '</div></article></div></section>';
}

function lessonList(container, context) {
  const items = LESSONS.filter((lesson) => lesson.puzzle === context.puzzle);
  container.innerHTML = '<section class="rb-section">' + header("Bắt đầu học", puzzleById.get(context.puzzle)?.description) + selectPuzzle(context.puzzle) +
    '<div class="rb-feature-grid">' + items.map((lesson) =>
      '<article class="rb-panel"><span class="rb-eyebrow">' + esc(lesson.level) + (context.value.lessons[lesson.id] ? " · Đã học" : "") +
      '</span><h3>' + esc(lesson.title) + '</h3><p>' + esc(lesson.objective) + '</p>' + link(lessonPath(lesson.id), "Mở bài") + '</article>'
    ).join("") + '</div>' + (!items.length ? '<p>Chưa có bài học đã xuất bản cho khối này.</p>' : "") + '</section>';
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
  container.innerHTML = '<section class="rb-section">' + header(lesson.title, lesson.objective,
    '<div class="rb-controls">' + link(linkPuzzle("hoc", lesson.puzzle), "Tất cả bài " + puzzleName(lesson.puzzle)) +
    '<button type="button" data-rb-jump>Đến video và mô phỏng</button></div>') +
    '<div class="rb-study"><div class="rb-stack">' +
    (lesson.prerequisite ? '<p class="rb-note">Chuẩn bị: ' + esc(lessonById.get(lesson.prerequisite)?.title || lesson.prerequisite) + '</p>' : "") +
    guide.map((part, i) => '<article class="rb-panel"><h3>' + esc(part.title) + '</h3><p>' + esc(part.text) + '</p>' +
      (part.algorithm ? '<code class="rb-notation">' + esc(part.algorithm) + '</code>' : "") +
      (part.comparison?.length ? '<div class="rb-comparisons" data-rb-compare="' + i + '"></div>' : "") +
      (part.algorithm ? '<button type="button" class="rb-btn" aria-pressed="false" data-rb-step="' + i + '">Làm theo từng nước</button>' : "") + '</article>'
    ).join("") +
    (lesson.mistake ? '<p class="rb-note"><strong>Lỗi thường gặp</strong> ' + esc(lesson.mistake) + '</p>' : "") +
    (quiz ? '<article class="rb-panel rb-quiz"><h3>' + esc(quiz.prompt) + '</h3><div class="rb-stack">' +
      quiz.options.map((answer, i) => '<button type="button" class="rb-btn" data-rb-lesson-answer="' + i + '">' + esc(answer) + '</button>').join("") +
      '</div><p role="status" data-rb-quiz-feedback></p></article>' : "") +
    '</div><aside class="rb-panel rb-visual"><h3>Xem và làm theo</h3>' + lessonFigure(lesson.figure) + localClipBlock(lesson.localClip) +
    videoBlock(lesson.video, lesson.title) +
    '<div class="rb-stack" data-rb-lesson-player></div>' +
    (lesson.exercise?.goal ? '<div class="rb-exercise"><h4>Tự luyện</h4><p>' + esc(lesson.exercise.goal) + '</p>' +
      (lesson.exercise.setup != null ? '<button type="button" class="rb-btn" data-rb-exercise>Thử trên khối mô phỏng</button>' : "") + '</div>' : "") +
    (related.length ? '<div class="rb-exercise"><h4>Bộ công thức liên quan</h4><div class="rb-controls">' +
      related.map((group) => link(linkPuzzle("cong-thuc", lesson.puzzle) + "&group=" + encodeURIComponent(group.id), group.name)).join("") + '</div></div>' : "") +
    (sources.length ? '<div class="rb-source">Nguồn tham khảo ' + sources.join(" · ") + '</div>' : "") + '</aside></div>' +
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
      target.innerHTML = '<h4>' + esc(part.title || (free ? "Tự luyện trên khối" : "Thử nước xoay")) + '</h4>' + comparison +
        '<div data-rb-step-player></div>';
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
        return '<figure>' + still + (part.arrow ? '<span class="rb-turn-arrow" aria-hidden="true">' + esc(part.arrow) + '</span>' : '') +
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
      context.value.lessons[lesson.id] = Date.now();
      const saved = context.store.save();
      step.textContent = "Đã học bài này";
      step.setAttribute("aria-pressed", "true");
      context.say(saved ? "Đã lưu tiến trình bài học." : "Đã đánh dấu cho phiên hiện tại.");
    } else if (step.hasAttribute("data-rb-lesson-answer")) {
      const chosen = Number(step.dataset.rbLessonAnswer);
      const correct = chosen === quiz.answer || quiz.options[chosen] === quiz.answer;
      container.querySelector("[data-rb-quiz-feedback]").textContent = (correct ? "Đúng. " : "Hãy quan sát lại. ") + (quiz.feedback || "");
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
  container.innerHTML = '<section class="rb-section">' + header("Thư viện công thức", "Nhìn hình để nhận ra trường hợp và đối chiếu hướng cầm.") +
    '<div class="rb-filters">' + selectPuzzle(context.puzzle) +
    '<label class="rb-field">Bộ công thức<select data-filter="group"><option value="">Tất cả</option>' + groups.map((item) =>
      '<option value="' + esc(item.id) + '"' + (item.id === group ? " selected" : "") + '>' + esc(item.name) + '</option>'
    ).join("") + '</select></label><label class="rb-field">Tìm công thức<input type="search" data-filter="query" placeholder="Ví dụ OLL 27, T-perm, R U"></label>' +
    '<label class="rb-field">Độ khó<select data-filter="difficulty"><option value="">Tất cả</option>' +
    [...new Set(puzzleCases.map((item) => item.difficulty).filter(Boolean))].map((level) =>
      '<option>' + esc(level) + '</option>').join("") + '</select></label>' +
    '<label class="rb-field">Dấu hiệu<select data-filter="shape"><option value="">Tất cả</option>' +
    [...new Set(puzzleCases.map((item) => item.shape).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi")).map((shape) =>
      '<option>' + esc(shape) + '</option>').join("") + '</select></label>' +
    '<label class="rb-field">Đã học<select data-filter="status"><option value="">Tất cả</option><option value="new">Chưa học</option><option value="learning">Đang học</option>' +
    '<option value="known">Đã nhớ</option><option value="favorite">Yêu thích</option></select></label></div>' +
    (isColoredCube(context.puzzle) ? '<p class="rb-note rb-orientation">Hướng chuẩn: D trắng ở dưới · U vàng ở trên · F xanh dương ở trước.</p>' : "") +
    '<p class="rb-note" role="status" data-rb-count></p><div class="rb-case-grid" data-rb-results></div>' +
    '<button type="button" class="rb-btn" data-rb-more hidden>Xem thêm trường hợp</button></section>';
  let limit = 18;
  let helpers;
  const field = (key) => container.querySelector('[data-filter="' + key + '"]').value;
  const results = container.querySelector("[data-rb-results]");
  const count = container.querySelector("[data-rb-count]");
  const more = container.querySelector("[data-rb-more]");
  function render() {
    const query = search(field("query"));
    const filtered = puzzleCases.filter((item) => {
      const row = context.value.reviews[item.id] || {};
      const status = field("status");
      const matchesStatus = !status || (status === "favorite" ? row.favorite : (row.status || "new") === status);
      return (!field("group") || item.group === field("group")) && (!field("difficulty") || item.difficulty === field("difficulty")) &&
        (!field("shape") || item.shape === field("shape")) &&
        matchesStatus && search([item.id.replace(/-/g, " "), item.name, item.shape, item.algorithm].join(" ")).includes(query);
    });
    count.textContent = filtered.length + " trường hợp" + (filtered.length > limit ? " · đang hiện " + limit : "");
    const visible = filtered.slice(0, limit);
    results.innerHTML = visible.map((item) => {
      const groupName = groupById.get(item.group)?.name || "";
      const art = '<span class="rb-mini-diagram" data-rb-mini="' + esc(item.id) + '">' +
        (SPECIAL_DIAGRAMS.has(item.id) ? specialDiagram(item, "before") : "") + '</span>';
      return '<article class="rb-panel rb-case-card"><a class="rb-case" href="#' + casePath(item.id) + '">' + art +
        '<span class="rb-eyebrow">' + esc(groupName) + '</span><strong>' + esc(item.name) + '</strong><code>' + esc(item.algorithm) +
        '</code></a><button type="button" data-rb-preview-case="' + esc(item.id) + '" aria-label="Xem mô hình ' + esc(item.name) + '">' +
        (["clock", "square1"].includes(item.puzzle) ? "Xem mô hình" : "Xem 3D") + '</button></article>';
    }).join("") || '<p>Chưa tìm thấy công thức phù hợp.</p>';
    more.hidden = filtered.length <= limit;
    if (helpers) for (const node of results.querySelectorAll("[data-rb-mini]")) {
      const item = caseById.get(node.dataset.rbMini);
      if (SPECIAL_DIAGRAMS.has(item.id)) continue;
      try {
        node.innerHTML = helpers.diagram(helpers.snapshot(item.puzzle, item.setup || ""), helpers.cubeSize(item.puzzle), {
          focusLayer: ["oll", "pll"].includes(item.group), labels: context.value.labels, description: "Nhận diện " + item.name, whiteBottom: !item.nativePalette
        });
      } catch { /* The case can still be opened and read. */ }
    }
  }
  container.addEventListener("input", (event) => { if (event.target.matches("[data-filter]")) { limit = 18; render(); } }, { signal: context.signal });
  more.addEventListener("click", () => { limit += 18; render(); }, { signal: context.signal });
  render();
  context.player().then((module) => { if (context.alive()) { helpers = module; render(); } }).catch(() => {});
}

function casePage(container, context, item) {
  const row = context.value.reviews[item.id] || {};
  const group = groupById.get(item.group);
  const groupRoute = linkPuzzle("cong-thuc", item.puzzle) + "&group=" + encodeURIComponent(item.group);
  const similar = CASES.filter((other) => other.id !== item.id && other.group === item.group &&
    item.shape && other.shape === item.shape).slice(0, 4);
  const variants = [{ algorithm: item.algorithm, setup: item.setup },
    ...(item.variants || []).map((variant) => typeof variant === "string" ? { algorithm: variant, setup: item.setup } : variant)];
  const source = external(item.source, "Nguồn công thức");
  let { algorithm, setup } = variants[0];
  container.innerHTML = '<section class="rb-section">' + header(item.name, item.tip || item.description,
    '<p>' + link(groupRoute, group?.name || "Thư viện công thức") + '</p>') +
    '<div class="rb-study"><div class="rb-stack"><article class="rb-panel"><p class="rb-eyebrow">' + esc(puzzleName(item.puzzle) + " · " + (item.difficulty || group?.name || "")) +
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
    '</div><aside class="rb-panel rb-visual"><h3>Làm theo từng nước</h3><div data-rb-case-player></div>' +
    (CASE_CLIPS.has(item.id) ? '<p><button class="rb-btn" type="button" data-rb-local-clip="' + esc(item.id) + '">Xem video công thức chính</button></p>' : "") +
    '</aside></div></section>';

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
        puzzle: item.puzzle, setup: setup || "", algorithm, labels: context.value.labels, whiteBottom: !item.nativePalette
      });
    }).catch(() => context.say("Chưa mở được minh họa cho biến thể này."));
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
    '<h3>Yêu thích</h3><div class="rb-controls">' +
    (CASES.filter((item) => context.value.reviews[item.id]?.favorite).map((item) => link(casePath(item.id), item.name)).join("") || '<p>Chưa lưu công thức yêu thích.</p>') +
    '</div><h3>Độ phủ nội dung</h3><div data-rb-coverage></div>' +
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
    '<div data-rb-enlarged></div></dialog><dialog class="rb-dialog rb-preview-dialog" aria-labelledby="rb-preview-caption" data-rb-preview-dialog>' +
    '<header class="rb-preview-head"><h3 id="rb-preview-caption"></h3><form method="dialog"><button class="rb-btn">Đóng</button></form></header>' +
    '<div data-rb-preview-player></div></dialog></section>';
  const root = host.firstElementChild;
  const body = root.querySelector("[data-rb-body]");
  const context = {
    root, puzzle, params, store, value: store.value, signal: abort.signal, cleanups: [], playerVersion: 0,
    alive: () => !abort.signal.aborted && host.isConnected,
    player: bootPlayer,
    say(message) {
      const live = root.querySelector("[data-rb-live]");
      live.textContent = message;
    }
  };
  const previewDialog = root.querySelector("[data-rb-preview-dialog]");
  const previewHost = previewDialog.querySelector("[data-rb-preview-player]");
  let disposePreview;
  let previewGeneration = 0;
  function closePreview() {
    previewGeneration++;
    disposePreview?.();
    disposePreview = undefined;
    previewHost.replaceChildren();
  }
  previewDialog.addEventListener("close", closePreview, { signal: abort.signal });
  root.addEventListener("change", (event) => {
    if (!event.target.matches("[data-rb-puzzle]")) return;
    const destination = NAV.some(([id]) => id === page) && page ? "/rubik/" + page : "/rubik";
    location.hash = "#" + destination + "?puzzle=" + encodeURIComponent(event.target.value);
  }, { signal: abort.signal });
  root.addEventListener("click", (event) => {
    const previewButton = event.target.closest("[data-rb-preview-case]");
    if (previewButton) {
      const item = caseById.get(previewButton.dataset.rbPreviewCase);
      if (!item) return;
      closePreview();
      const token = previewGeneration;
      previewDialog.querySelector("h3").textContent = item.name;
      previewHost.textContent = "Đang mở mô hình…";
      previewDialog.showModal();
      context.player().then(({ mountPlayer }) => {
        if (!previewDialog.open || token !== previewGeneration || !context.alive()) return;
        disposePreview = mountPlayer(previewHost, {
          puzzle: item.puzzle, setup: item.setup, algorithm: item.algorithm, labels: context.value.labels, whiteBottom: !item.nativePalette
        });
      }).catch(() => {
        if (previewDialog.open && token === previewGeneration) previewHost.textContent = "Chưa mở được mô hình. Hãy thử lại.";
      });
      return;
    }
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
    body.innerHTML = '<section class="rb-section">' + header(...sections[page]) + selectPuzzle(puzzle) + '<div class="rb-panel" data-rb-free></div></section>';
    visualization(body.querySelector("[data-rb-free]"), { puzzle, free: true, whiteBottom: true }, context);
  } else if (sections[page]) {
    body.innerHTML = '<section class="rb-section">' + header(...sections[page]) + '<div data-rb-tool role="status">Đang mở công cụ…</div></section>';
    import("./rubik-tools.mjs?v=2").then(({ mountTool }) => {
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
      closePreview();
      context.inlinePlayer?.();
      for (const dispose of context.cleanups) dispose();
      host.replaceChildren();
    }
  };
}
