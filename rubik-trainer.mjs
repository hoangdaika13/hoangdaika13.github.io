import { CASES, CASE_GROUPS } from "./rubik-cases.mjs?v=5";
import { SPECIAL_DIAGRAMS } from "./rubik-media.mjs?v=3";
import { changeReview, isNewReviewLaunch, isReviewDue, recordSessionResult, REVIEW_SESSION_SIZE } from "./rubik-progress.mjs?v=3";
import { applyMoves, parseMoves } from "./rubik-engine.mjs?v=5";
import { loadSpecialPractice } from "./rubik-special.mjs?v=5";
import { cubeSize, diagram, esc, mountFormulaPreview, mountPlayer, snapshot } from "./rubik-player.mjs?v=5";

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
  const due = priority === "due" && eligible.filter((item) => isReviewDue(reviews[item.id], now));
  const ordered = due?.length ? due.slice().sort((a, b) => reviews[b.id].wrong - reviews[a.id].wrong ||
    reviews[a.id].due - reviews[b.id].due).slice(0, 6) : eligible;
  return ordered[Math.floor(random() * ordered.length)];
}

export function reviewSessionCases(cases, reviews, now = Date.now()) {
  const due = new Set();
  const unseen = new Set();
  for (const { id } of cases) {
    const review = reviews[id];
    if (isReviewDue(review, now)) due.add(id);
    else if (!(review?.last > 0 || review?.correct > 0 || review?.wrong > 0 || review?.due > 0 || review?.status === "known")) unseen.add(id);
  }
  return [...[...due].sort((a, b) => reviews[a].due - reviews[b].due), ...unseen].slice(0, REVIEW_SESSION_SIZE);
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
  const caseById = new Map(cases.map((item) => [item.id, item]));
  const requestedGroup = groups.find((group) => group.id === groupParam)?.id || "";
  const sessionMode = !requestedCase && context.params.get("session") === "due";
  let session = sessionMode ? value.sessions[context.puzzle] : null;
  if (sessionMode) {
    const launch = context.params.get("start");
    const freshLaunch = isNewReviewLaunch(session, launch);
    const hasSession = session?.ids.every((id) => caseById.has(id) && (!session.group || caseById.get(id).group === session.group));
    if (!hasSession || (session.index === session.ids.length && freshLaunch)) {
      beginSession(requestedGroup, undefined, freshLaunch ? launch : session?.launch);
    } else if (freshLaunch) {
      // Mark this link as visited without replacing the session already in progress.
      session.launch = launch;
      store.save();
    }
  }

  function beginSession(group, ids = reviewSessionCases(cases.filter((item) => !group || item.group === group), value.reviews), launch = session?.launch) {
    session = { ids, index: 0, results: [], group };
    if (launch) session.launch = launch;
    if (ids.length || launch) value.sessions[context.puzzle] = session;
    else delete value.sessions[context.puzzle];
    store.save();
  }
  const freeLink = context.link("/rubik/luyen-tap?puzzle=" + encodeURIComponent(context.puzzle), "Luyện tự do");
  container.innerHTML = '<div class="rb-stack rb-tool-practice">' + (sessionMode ?
    '<section class="rb-panel rb-session-header" aria-label="Buổi ôn"><div><h3>Buổi ôn 3D</h3>' +
    '<p class="rb-note">' + esc(groups.find((group) => group.id === session.group)?.name || "Tất cả bộ công thức") +
    ' · Ưu tiên ca đến hạn, sau đó là ca mới.</p></div>' + freeLink + '</section>' :
    '<section class="rb-panel rb-practice-filters" aria-label="Chọn bài luyện">' +
    '<div class="rb-filters">' + selectPuzzle(context.puzzle) +
    '<label class="rb-field">Bộ công thức<select data-set><option value="">Tất cả</option>' +
    groups.map((group) => '<option value="' + esc(group.id) + '"' + (group.id === (requestedCase?.group || groupParam) ? " selected" : "") +
      '>' + esc(group.name) + '</option>').join("") + '</select></label>' +
    '<label class="rb-field">Bài tập<select data-exercise><option value="recognize">Nhìn hình đoán trường hợp</option>' +
    '<option value="step">Chọn nước mở đầu</option><option value="recall">Nhập công thức</option>' +
    '<option value="turn">Tự xoay đến mục tiêu</option></select></label>' +
    '<label class="rb-field">Ưu tiên<select data-priority><option value="due">Đến hạn ôn</option><option value="all">Ngẫu nhiên</option>' +
    '<option value="favorite">Yêu thích</option></select></label></div></section>') +
    '<section class="rb-panel rb-practice-session" aria-label="Buổi luyện">' +
    '<div class="rb-practice-toolbar"><p class="rb-tool-label rb-practice-tally" data-rb-tally></p>' +
    '<div class="rb-controls"><button type="button" data-rb-hint hidden>Gợi ý</button>' +
    (sessionMode ? '<button type="button" data-rb-session-skip>Bỏ qua ca</button>' : '') +
    '<button type="button" data-new-exercise>Đổi trường hợp</button></div></div>' +
    (sessionMode ? '<div class="rb-session-position"><label for="rb-review-track" data-rb-session-position></label>' +
      '<progress id="rb-review-track" data-rb-session-track value="0" max="1"></progress></div>' : '') +
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
  const skipButton = get("[data-rb-session-skip]");
  const position = get("[data-rb-session-position]");
  const track = get("[data-rb-session-track]");
  const modeParam = context.params.get("mode");
  if (modeControl && ["recognize", "step", "recall", "turn"].includes(modeParam)) modeControl.value = modeParam;
  else if (requestedCase) modeControl.value = "turn";

  function showTally() {
    if (!sessionMode) {
      tally.textContent = attempts ? successes + "/" + attempts + " lượt đúng" : "Buổi luyện mới";
      return;
    }
    const total = session.ids.length;
    const current = Math.min(total, session.index + (answered ? 0 : 1));
    const correct = session.results.filter((result) => result === "correct").length;
    tally.textContent = correct + " lượt đúng";
    track.max = total || 1;
    track.value = session.index;
    position.textContent = total ? "Ca " + current + "/" + total + " · Đã xử lý " + session.index : "Chưa có ca cần ôn";
  }

  function showSummary(focus) {
    const correct = session.results.filter((result) => result === "correct").length;
    const skipped = session.results.filter((result) => result === "skipped").length;
    const incorrect = session.index - correct - skipped;
    body.innerHTML = '<section class="rb-session-summary" data-rb-session-summary><h3 tabindex="-1">' +
      (session.ids.length ? "Đã hoàn thành buổi ôn" : "Chưa có ca đến hạn hoặc ca mới") + '</h3>' +
      (session.ids.length ? '<ul class="rb-session-results"><li><strong>' + correct + '</strong> Đúng</li><li><strong>' +
        incorrect + '</strong> Chưa đúng</li><li><strong>' + skipped + '</strong> Bỏ qua</li></ul>' : '') +
      '<div class="rb-controls">' + (incorrect || skipped ? '<button class="rb-primary" type="button" data-rb-session-retry>' +
        (skipped ? "Ôn lại ca chưa hoàn thành" : "Ôn lại ca sai") + '</button>' : '') +
      '<button type="button" data-rb-session-restart>Bắt đầu buổi mới</button></div></section>';
    nextButton.hidden = true;
    skipButton.hidden = true;
    if (focus) body.querySelector("h3").focus();
  }

  function check(correct, picked) {
    if (answered || !selected || !model) return;
    if (sessionMode && !recordSessionResult(session, selected.id, correct ? "correct" : "incorrect")) return;
    answered = true;
    attempts++;
    if (correct) successes++;
    changeReview(value, selected.id, { correct });
    const saved = store.save();
    showTally();
    hint.hidden = true;
    nextButton.textContent = sessionMode && session.index === session.ids.length ? "Xem kết quả" : "Ca tiếp theo";
    nextButton.disabled = false;
    if (skipButton) skipButton.hidden = true;
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
      '</code><div class="rb-controls"><button type="button" data-rb-demo>Xem từng nước</button>' +
      (sessionMode ? "" : '<button type="button" data-rb-retry>Thử lại ca này</button>') + context.link(context.casePath(selected.id), "Xem công thức và video") + '</div><div data-rb-review-player hidden></div>';
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
    if (sessionMode) selected = caseById.get(session.ids[session.index]);
    else if (!retry) {
      const set = get("[data-set]").value;
      const priority = get("[data-priority]").value;
      const pool = cases.filter((item) => (!set || item.group === set) && (priority !== "favorite" || value.reviews[item.id]?.favorite));
      selected = requestedCase || pickPracticeCase(pool, value.reviews, { previous: selected?.id, priority });
      requestedCase = null;
    }
    const item = selected;
    model = null;
    correctChoice = undefined;
    answered = false;
    delete feedback.dataset.result;
    feedback.textContent = "";
    nextButton.textContent = sessionMode ? "Ca tiếp theo" : "Đổi trường hợp";
    nextButton.hidden = false;
    nextButton.disabled = sessionMode;
    nextButton.classList.remove("rb-primary");
    review.hidden = true;
    review.replaceChildren();
    hint.hidden = true;
    if (sessionMode) {
      showTally();
      if (!item) {
        delete body.dataset.rbSessionCase;
        showSummary(focus);
        return;
      }
      skipButton.hidden = false;
      skipButton.disabled = true;
      body.dataset.rbSessionCase = item.id;
    }
    if (!item) {
      body.textContent = get("[data-priority]").value === "favorite" ? "Chưa có công thức yêu thích trong bộ này." : "Bộ lọc hiện tại chưa có trường hợp để luyện.";
      return;
    }
    body.innerHTML = '<p role="status">Đang dựng khối…</p>';
    try {
      const next = await exerciseModel(item);
      if (signal.aborted || generation !== token) return;
      model = next;
    } catch {
      if (!signal.aborted && generation === token) {
        body.textContent = "Chưa dựng được bài này. Hãy chọn trường hợp khác.";
        if (skipButton) skipButton.disabled = false;
      }
      return;
    }
    const related = cases.filter((candidate) => candidate.group === item.group && candidate.id !== item.id);
    const hasRecognitionChoices = related.some((candidate) => candidate.name !== item.name);
    const mode = sessionMode ? (hasRecognitionChoices ? "recognize" : "step") : modeControl.value;
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
    if (skipButton) skipButton.disabled = false;
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
    if (sessionMode && button === skipButton && selected && recordSessionResult(session, selected.id, "skipped")) {
      store.save();
      newExercise({ focus: true });
    } else if (sessionMode && button.matches("[data-rb-session-restart], [data-rb-session-retry]")) {
      const missed = session.ids.filter((_, i) => session.results[i] !== "correct");
      beginSession(session.group, button.hasAttribute("data-rb-session-retry") ? missed : undefined);
      newExercise({ focus: true });
    } else if (button.matches("[data-new-exercise], [data-rb-retry]")) newExercise({ retry: button.hasAttribute("data-rb-retry"), focus: true });
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
