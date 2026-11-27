import { CASES, CASE_GROUPS } from "./rubik-cases.mjs?v=4";
import { SPECIAL_DIAGRAMS } from "./rubik-media.mjs?v=3";
import { changeReview } from "./rubik-progress.mjs?v=2";
import { applyMoves, parseMoves } from "./rubik-engine.mjs?v=4";
import { loadSpecialPractice } from "./rubik-special.mjs?v=4";
import { cubeSize, diagram, esc, mountFormulaPreview, mountPlayer, snapshot } from "./rubik-player.mjs?v=4";

const STEP_CHOICES = {
  pyraminx: ["U", "R'", "L", "u'"],
  megaminx: ["R", "U'", "F", "U2"],
  skewb: ["R", "L'", "U", "B'"],
  square1: ["(1,0)", "(-1,0)", "(0,1)", "/"],
  clock: ["UR1+", "D1-", "ALL3+", "y2"],
  cube: ["R", "U'", "F", "R2", "U2"]
};

function randomOrder(items, random) {
  const choices = [...items];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return choices;
}

export function practiceChoices(answer, alternatives, random = Math.random) {
  const distractors = [...new Set(alternatives)].filter((value) => value && value !== answer);
  return randomOrder([answer, ...randomOrder(distractors, random).slice(0, 3)], random);
}

export function pickPracticeCase(pool, reviews, { previous, priority, now = Date.now(), random = Math.random } = {}) {
  const eligible = pool.length > 1 ? pool.filter((item) => item.id !== previous) : pool;
  if (!eligible.length) return undefined;
  const due = priority === "due" && eligible.filter((item) => {
    const review = reviews[item.id];
    return review && (review.due > 0 || review.wrong > 0) && review.due <= now;
  });
  const ordered = due?.length ? due.slice().sort((a, b) => reviews[b.id].wrong - reviews[a.id].wrong ||
    reviews[a.id].due - reviews[b.id].due).slice(0, 6) : eligible;
  return ordered[Math.floor(random() * ordered.length)];
}

async function exerciseModel(item) {
  const size = cubeSize(item.puzzle);
  if (!size) return { ...await loadSpecialPractice(item.puzzle, item.setup, item.algorithm), size };
  const start = snapshot(item.puzzle, item.setup);
  const end = snapshot(item.puzzle, item.algorithm, start);
  return {
    size, start, end,
    moves: parseMoves(item.algorithm, size),
    matches: (notation) => applyMoves(start, notation, size) === end
  };
}

function imageFor(item, model, side, labels) {
  const before = side === "before";
  const caption = before ? "Khối lúc bắt đầu" : "Kết quả cần đạt";
  if (SPECIAL_DIAGRAMS.has(item.id)) {
    return '<img class="rb-puzzle-image" width="332" height="210" src="assets/rubik/diagrams/' +
      encodeURIComponent(item.id) + "-" + side + '.webp" alt="' + caption + '">';
  }
  const state = before ? model.start : model.end;
  const changed = before ? undefined : new Set([...model.start].flatMap((color, i) => color === state[i] ? [] : [i]));
  return diagram(state, model.size, { description: caption, labels, changed, whiteBottom: !item.nativePalette });
}

export function mountTrainer(container, context) {
  const { selectPuzzle, signal, value, store } = context;
  const cases = CASES.filter((item) => item.puzzle === context.puzzle && item.setup && item.algorithm &&
    (cubeSize(item.puzzle) || SPECIAL_DIAGRAMS.has(item.id)));
  const groupParam = context.params.get("group");
  let requestedCase = cases.find((item) => item.id === context.params.get("case"));
  const groups = CASE_GROUPS.filter((group) => cases.some((item) => group.id === item.group));
  container.innerHTML = '<div class="rb-stack rb-tool-practice"><section class="rb-panel rb-practice-filters" aria-label="Chọn bài luyện">' +
    '<div class="rb-filters">' + selectPuzzle(context.puzzle) +
    '<label class="rb-field">Bộ công thức<select data-set><option value="">Tất cả</option>' +
    groups.map((group) => '<option value="' + esc(group.id) + '"' + (group.id === (requestedCase?.group || groupParam) ? " selected" : "") +
      '>' + esc(group.name) + '</option>').join("") + '</select></label>' +
    '<label class="rb-field">Bài tập<select data-exercise><option value="recognize">Nhìn hình đoán trường hợp</option>' +
    '<option value="step">Chọn nước mở đầu</option><option value="recall">Nhập công thức</option>' +
    '<option value="turn">Tự xoay đến mục tiêu</option></select></label>' +
    '<label class="rb-field">Ưu tiên<select data-priority><option value="due">Đến hạn ôn</option><option value="all">Ngẫu nhiên</option>' +
    '<option value="favorite">Yêu thích</option></select></label></div></section>' +
    '<section class="rb-panel rb-practice-session" aria-label="Buổi luyện">' +
    '<div class="rb-practice-toolbar"><p class="rb-tool-label rb-practice-tally" data-rb-tally></p>' +
    '<div class="rb-controls"><button type="button" data-rb-hint hidden>Gợi ý</button>' +
    '<button type="button" data-new-exercise>Đổi trường hợp</button></div></div>' +
    '<div data-trainer-body class="rb-stack"></div><p class="rb-practice-feedback" role="status" data-trainer-feedback></p>' +
    '<div class="rb-stack rb-practice-review" data-rb-answer-review hidden></div></section></div>';

  let generation = 0;
  let disposePlayer;
  let disposeDemo;
  let disposePreview;
  let selected;
  let model;
  let correctChoice;
  let answered = false;
  let attempts = 0;
  let successes = 0;
  const get = (selector) => container.querySelector(selector);
  const body = get("[data-trainer-body]");
  const feedback = get("[data-trainer-feedback]");
  const review = get("[data-rb-answer-review]");
  const hint = get("[data-rb-hint]");
  const tally = get("[data-rb-tally]");
  const modeControl = get("[data-exercise]");
  const nextButton = get("[data-new-exercise]");
  if (requestedCase) modeControl.value = "turn";

  function showTally() {
    tally.textContent = attempts ? successes + "/" + attempts + " lượt đúng" : "Buổi luyện mới";
  }

  function check(correct, picked) {
    if (answered || !selected || !model) return;
    answered = true;
    attempts++;
    if (correct) successes++;
    changeReview(value, selected.id, { correct });
    const saved = store.save();
    showTally();
    hint.hidden = true;
    nextButton.textContent = "Ca tiếp theo";
    nextButton.classList.add("rb-primary");
    feedback.dataset.result = correct ? "correct" : "incorrect";
    feedback.textContent = (correct ? "Đúng. " : "Chưa đúng. ") + selected.name +
      (saved ? "" : " Kết quả chỉ được giữ trong buổi này.");
    const focused = document.activeElement;
    const advanceFocus = body.contains(focused) && focused.matches(":focus-visible");
    for (const button of body.querySelectorAll("[data-answer], [data-check-recall]")) {
      const expected = button.hasAttribute("data-answer") && button.dataset.answer === correctChoice;
      const submittedRecall = button === picked && button.hasAttribute("data-check-recall");
      if (expected || (submittedRecall && correct)) {
        button.dataset.result = "correct";
        button.append(" ✓");
      } else if (button === picked) {
        button.dataset.result = "incorrect";
        button.append(" ✗");
      }
      button.disabled = true;
    }
    review.hidden = false;
    review.innerHTML = '<h3>Đối chiếu hai trạng thái</h3><div class="rb-comparisons">' + ["before", "after"].map((side) =>
      '<figure>' + imageFor(selected, model, side, value.labels) + '<figcaption>' +
      (side === "before" ? "Khối lúc bắt đầu" : "Kết quả cần đạt") + '</figcaption></figure>').join("") + '</div>' +
      '<p>' + esc(selected.tip || "Đối chiếu kết quả với ảnh ban đầu.") + '</p><code class="rb-notation">' + esc(selected.algorithm) +
      '</code><div class="rb-controls"><button type="button" data-rb-demo>Xem từng nước</button><button type="button" data-rb-retry>Thử lại ca này</button>' +
      context.link(context.casePath(selected.id), "Xem công thức và video") + '</div><div data-rb-review-player hidden></div>';
    if (advanceFocus) nextButton.focus();
  }

  async function newExercise({ retry = false, focus = false } = {}) {
    const token = ++generation;
    disposePlayer?.();
    disposePlayer = undefined;
    disposeDemo?.();
    disposeDemo = undefined;
    disposePreview?.();
    disposePreview = undefined;
    const set = get("[data-set]").value;
    const priority = get("[data-priority]").value;
    const mode = modeControl.value;
    const pool = cases.filter((item) => (!set || item.group === set) && (priority !== "favorite" || value.reviews[item.id]?.favorite));
    if (!retry) {
      selected = requestedCase || pickPracticeCase(pool, value.reviews, { previous: selected?.id, priority });
      requestedCase = null;
    }
    const item = selected;
    model = null;
    correctChoice = undefined;
    answered = false;
    delete feedback.dataset.result;
    feedback.textContent = "";
    nextButton.textContent = "Đổi trường hợp";
    nextButton.classList.remove("rb-primary");
    review.hidden = true;
    review.replaceChildren();
    hint.hidden = true;
    if (!item) {
      body.textContent = priority === "favorite" ? "Chưa có công thức yêu thích trong bộ này." : "Bộ lọc hiện tại chưa có trường hợp để luyện.";
      return;
    }
    body.innerHTML = '<p role="status">Đang dựng khối…</p>';
    try {
      const next = await exerciseModel(item);
      if (signal.aborted || generation !== token) return;
      model = next;
    } catch {
      if (!signal.aborted && generation === token) body.textContent = "Chưa dựng được bài này. Hãy chọn trường hợp khác.";
      return;
    }
    const before = imageFor(item, model, "before", value.labels);
    const modelStage = '<div class="rb-practice-preview"><div class="rb-case-model rb-practice-model" data-rb-practice-model>' +
      before + '</div><p class="rb-note" data-rb-practice-orbit>Kéo hoặc dùng phím mũi tên để quan sát khối.</p></div>';
    const title = (text) => '<h3 tabindex="-1">' + esc(text) + '</h3>';
    const challenge = (text, actions) => title(text) + '<div class="rb-practice-challenge">' + modelStage +
      '<div class="rb-practice-answer">' + actions + '</div></div>';
    if (mode === "turn") {
      body.innerHTML = title(item.name) + '<p>Tự xoay từ trạng thái mẫu. Mọi chuỗi nước đưa khối đến đúng hình mục tiêu đều được chấp nhận.</p>' +
        '<details><summary>Xem hình mục tiêu</summary><div class="rb-practice-net">' + imageFor(item, model, "after", value.labels) +
        '</div></details><div data-turn-practice></div>';
      disposePlayer = mountPlayer(get("[data-turn-practice]"), {
        puzzle: item.puzzle, group: item.group, setup: item.setup, free: true, goal: model.end,
        goalAlgorithm: item.algorithm, labels: value.labels, twoD: value.twoD, whiteBottom: !item.nativePalette,
        onGoal: () => { if (generation === token) check(true); }
      });
    } else if (mode === "recall") {
      body.innerHTML = challenge("Nhập công thức cho " + item.name,
        '<form class="rb-stack" data-rb-recall-form><label class="rb-field">Chuỗi nước đi<input data-recall maxlength="600" autocomplete="off" autocapitalize="off" spellcheck="false"></label>' +
        '<div class="rb-controls"><button type="submit" class="rb-primary" data-check-recall>Kiểm tra</button></div></form>');
    } else {
      correctChoice = mode === "step" ? model.moves[0] : item.name;
      const related = cases.filter((candidate) => candidate.group === item.group && candidate.id !== item.id);
      const options = practiceChoices(correctChoice, mode === "step" ? STEP_CHOICES[item.puzzle] || STEP_CHOICES.cube :
        related.map((candidate) => candidate.name));
      if (options.length < 2) {
        body.innerHTML = challenge(item.name, '<p>Bộ này có một hình mẫu. Hãy thử chọn nước mở đầu hoặc tự xoay.</p>' +
          '<button type="button" class="rb-btn" data-rb-single-step>Thử chọn nước mở đầu</button>');
      } else {
        body.innerHTML = challenge(mode === "step" ? "Nước mở đầu của " + item.name + " là gì?" : "Đây là trường hợp nào?",
          '<div class="rb-practice-options">' + options.map((option) =>
            '<button type="button" class="rb-btn" data-answer="' + esc(option) + '">' + esc(option) + '</button>'
          ).join("") + '</div>');
      }
    }
    const stage = get("[data-rb-practice-model]");
    if (stage) {
      const fallback = () => {
        stage.innerHTML = before;
        get("[data-rb-practice-orbit]").hidden = true;
      };
      try { disposePreview = mountFormulaPreview(stage, item, { labels: value.labels, fallback }); }
      catch { fallback(); }
    }
    hint.hidden = !item.tip;
    if (focus) body.querySelector("h3")?.focus();
  }

  container.addEventListener("change", (event) => {
    if (!event.target.matches("[data-set], [data-exercise], [data-priority]")) return;
    newExercise({ retry: event.target === modeControl && Boolean(selected) });
  }, { signal });
  container.addEventListener("submit", (event) => {
    if (!event.target.matches("[data-rb-recall-form]")) return;
    event.preventDefault();
    if (!model || answered) return;
    const input = get("[data-recall]");
    if (!input.value.trim()) {
      feedback.textContent = "Hãy nhập công thức trước khi kiểm tra.";
      input.focus();
      return;
    }
    try {
      check(model.matches(input.value.trim()), get("[data-check-recall]"));
    } catch (error) {
      feedback.textContent = error.message || "Chuỗi vừa nhập chưa hợp lệ.";
      input.focus();
    }
  }, { signal });
  container.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.matches("[data-new-exercise], [data-rb-retry]")) newExercise({ retry: button.hasAttribute("data-rb-retry"), focus: true });
    else if (button.hasAttribute("data-rb-single-step")) {
      modeControl.value = "step";
      newExercise({ retry: true, focus: true });
    } else if (button.hasAttribute("data-answer")) check(button.dataset.answer === correctChoice, button);
    else if (button === hint && selected?.tip) feedback.textContent = selected.tip;
    else if (button.hasAttribute("data-rb-demo") && selected) {
      disposeDemo?.();
      const player = get("[data-rb-review-player]");
      player.hidden = false;
      disposeDemo = mountPlayer(player, {
        puzzle: selected.puzzle, group: selected.group, setup: selected.setup, algorithm: selected.algorithm,
        labels: value.labels, twoD: value.twoD, whiteBottom: !selected.nativePalette
      });
      player.scrollIntoView({ block: "nearest" });
    }
  }, { signal });
  showTally();
  newExercise();
  context.cleanups.push(() => { generation++; disposePlayer?.(); disposeDemo?.(); disposePreview?.(); });
}
