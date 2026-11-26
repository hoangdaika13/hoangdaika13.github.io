import { CASES, CASE_GROUPS } from "./rubik-cases.mjs?v=2";
import { SPECIAL_DIAGRAMS } from "./rubik-media.mjs?v=2";
import { changeReview } from "./rubik-progress.mjs?v=1";
import { applyMoves, parseMoves } from "./rubik-engine.mjs?v=2";
import { loadSpecialPractice } from "./rubik-special.mjs?v=2";
import { cubeSize, diagram, esc, mountPlayer, snapshot } from "./rubik-player.mjs?v=2";

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
  const due = priority === "due" && eligible.filter((item) => reviews[item.id]?.due <= now);
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
  container.innerHTML = '<div class="rb-panel rb-stack"><div class="rb-filters">' + selectPuzzle(context.puzzle) +
    '<label class="rb-field">Bộ công thức<select data-set><option value="">Tất cả</option>' +
    groups.map((group) => '<option value="' + esc(group.id) + '"' + (group.id === (requestedCase?.group || groupParam) ? " selected" : "") +
      '>' + esc(group.name) + '</option>').join("") + '</select></label>' +
    '<label class="rb-field">Bài tập<select data-exercise><option value="recognize">Nhìn hình đoán trường hợp</option>' +
    '<option value="step">Chọn nước mở đầu</option><option value="recall">Nhập công thức</option>' +
    '<option value="turn">Tự xoay đến mục tiêu</option></select></label>' +
    '<label class="rb-field">Ưu tiên<select data-priority><option value="due">Đến hạn ôn</option><option value="all">Ngẫu nhiên</option>' +
    '<option value="favorite">Yêu thích</option></select></label></div>' +
    '<p class="rb-note rb-practice-tally" data-rb-tally aria-live="polite"></p><div data-trainer-body class="rb-stack"></div>' +
    '<p role="status" data-trainer-feedback></p><div class="rb-stack" data-rb-answer-review hidden></div>' +
    '<div class="rb-controls"><button type="button" data-new-exercise class="rb-primary">Đổi trường hợp</button>' +
    '<button type="button" data-rb-hint hidden>Gợi ý</button></div></div>';

  let generation = 0;
  let disposePlayer;
  let disposeDemo;
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
  if (requestedCase) modeControl.value = "turn";

  function showTally() {
    tally.textContent = attempts ? "Buổi này: " + successes + "/" + attempts + " lượt đúng" : "Buổi luyện mới";
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
    feedback.dataset.result = correct ? "correct" : "incorrect";
    feedback.textContent = (correct ? "Đúng. " : "Chưa đúng. ") + selected.name +
      (saved ? "" : " Kết quả chỉ được giữ trong buổi này.");
    for (const button of body.querySelectorAll("[data-answer], [data-check-recall]")) {
      if (button.dataset.answer === correctChoice) {
        button.dataset.result = "correct";
        button.append(" ✓");
      } else if (button === picked) {
        button.dataset.result = "incorrect";
        button.append(" ✗");
      }
      button.disabled = true;
    }
    review.hidden = false;
    review.innerHTML = '<div class="rb-comparisons">' + ["before", "after"].map((side) =>
      '<figure>' + imageFor(selected, model, side, value.labels) + '<figcaption>' +
      (side === "before" ? "Khối lúc bắt đầu" : "Kết quả cần đạt") + '</figcaption></figure>').join("") + '</div>' +
      '<p>' + esc(selected.tip || "Đối chiếu kết quả với ảnh ban đầu.") + '</p><code class="rb-notation">' + esc(selected.algorithm) +
      '</code><div class="rb-controls"><button type="button" data-rb-demo>Xem từng nước</button><button type="button" data-rb-retry>Thử lại ca này</button>' +
      context.link(context.casePath(selected.id), "Xem công thức và video") + '</div><div data-rb-review-player hidden></div>';
  }

  async function newExercise({ retry = false, focus = false } = {}) {
    const token = ++generation;
    disposePlayer?.();
    disposePlayer = undefined;
    disposeDemo?.();
    disposeDemo = undefined;
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
    const image = '<div class="rb-practice-net">' + imageFor(item, model, "before", value.labels) + '</div>';
    const title = (text) => '<h3 tabindex="-1">' + esc(text) + '</h3>';
    if (mode === "turn") {
      body.innerHTML = title(item.name) + '<p>Tự xoay từ trạng thái mẫu. Mọi chuỗi nước đưa khối đến đúng hình mục tiêu đều được chấp nhận.</p>' +
        '<details><summary>Xem hình mục tiêu</summary><div class="rb-practice-net">' + imageFor(item, model, "after", value.labels) +
        '</div></details><div data-turn-practice></div>';
      disposePlayer = mountPlayer(get("[data-turn-practice]"), {
        puzzle: item.puzzle, setup: item.setup, free: true, goal: model.end,
        goalAlgorithm: item.algorithm, labels: value.labels, twoD: value.twoD, whiteBottom: !item.nativePalette,
        onGoal: () => { if (generation === token) check(true); }
      });
    } else if (mode === "recall") {
      body.innerHTML = title("Nhập công thức cho " + item.name) + image +
        '<form class="rb-controls" data-rb-recall-form><label class="rb-field">Chuỗi nước đi<input data-recall maxlength="600" autocomplete="off"></label>' +
        '<button type="submit" class="rb-btn" data-check-recall>Kiểm tra</button></form>';
    } else {
      correctChoice = mode === "step" ? model.moves[0] : item.name;
      const related = cases.filter((candidate) => candidate.group === item.group && candidate.id !== item.id);
      const options = practiceChoices(correctChoice, mode === "step" ? STEP_CHOICES[item.puzzle] || STEP_CHOICES.cube :
        related.map((candidate) => candidate.name));
      if (options.length < 2) {
        body.innerHTML = title(item.name) + image + '<p>Bộ này có một hình mẫu. Hãy thử chọn nước mở đầu hoặc tự xoay.</p>' +
          '<button type="button" class="rb-btn" data-rb-single-step>Thử chọn nước mở đầu</button>';
      } else {
        body.innerHTML = title(mode === "step" ? "Nước mở đầu của công thức " + item.name + " là gì?" : "Đây là trường hợp nào?") +
          image + '<div class="rb-practice-options">' + options.map((option) =>
            '<button type="button" class="rb-btn" data-answer="' + esc(option) + '">' + esc(option) + '</button>'
          ).join("") + '</div>';
      }
    }
    hint.hidden = !item.tip;
    if (focus) body.querySelector("h3")?.focus({ preventScroll: true });
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
      check(model.matches(input.value.trim()));
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
        puzzle: selected.puzzle, setup: selected.setup, algorithm: selected.algorithm,
        labels: value.labels, twoD: value.twoD, whiteBottom: !selected.nativePalette
      });
      player.scrollIntoView({ block: "nearest" });
    }
  }, { signal });
  showTally();
  newExercise();
  context.cleanups.push(() => { generation++; disposePlayer?.(); disposeDemo?.(); });
}
