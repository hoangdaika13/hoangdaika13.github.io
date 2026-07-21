(() => {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  const core = root.HHLearningCore || (typeof require === "function" ? require("./learning-platform-core.js") : null);
  const DAY = 86_400_000;
  const MODES = Object.freeze(["review", "mistakes", "vocabulary"]);
  const RATINGS = Object.freeze([
    { id: "again", key: "1", label: "Quên", tone: "danger" },
    { id: "hard", key: "2", label: "Khó", tone: "warning" },
    { id: "good", key: "3", label: "Tốt", tone: "success" },
    { id: "easy", key: "4", label: "Dễ", tone: "accent" }
  ]);
  const instances = new WeakMap();
  let fallbackStore = null;

  const escapeHTML = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
  const clean = (value, max = 300) => core?.clean ? core.clean(value, max) : String(value ?? "").trim().slice(0, max);
  const clamp = (value, min, max) => core?.clamp ? core.clamp(value, min, max) : Math.max(min, Math.min(max, Number(value) || 0));
  const safeDate = (value, fallback = Date.now()) => {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const formatNumber = (value) => new Intl.NumberFormat("vi-VN").format(Number(value) || 0);
  const formatDate = (value, includeTime = false) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Chưa lên lịch";
    return new Intl.DateTimeFormat("vi-VN", includeTime
      ? { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  };

  function ensureCore() {
    if (!core?.createStore || !core?.scheduleReview) throw new Error("HHLearningCore chưa sẵn sàng.");
    return core;
  }

  function getSharedStore() {
    ensureCore();
    if (!fallbackStore) fallbackStore = core.createStore(root.localStorage);
    return fallbackStore;
  }

  function normalizeMode(mode) {
    return MODES.includes(mode) ? mode : "review";
  }

  function trackForMistake(item, state) {
    const lessonTrack = String(item?.lessonId || "").split("-")[0];
    if (core.tracks.some((track) => track.id === lessonTrack)) return lessonTrack;
    return state?.profile?.career || "communication";
  }

  function reviewUrgency(card, now = Date.now()) {
    const due = safeDate(card?.dueAt, now);
    const remaining = due - now;
    const overdueDays = Math.max(0, -remaining / DAY);
    const dueSoon = remaining > 0 && remaining <= 3 * DAY;
    const difficulty = clamp(card?.difficulty || 3, 1, 10);
    const lapseWeight = clamp(card?.lapses || 0, 0, 999) * 6;
    const urgency = overdueDays * 100 + (dueSoon ? (3 * DAY - remaining) / DAY * 18 : 0) + difficulty * 2 + lapseWeight;
    return {
      dueAt: due,
      isDue: remaining <= 0,
      dueSoon,
      remaining,
      urgency: Number(urgency.toFixed(2)),
      status: remaining <= 0 ? "due" : dueSoon ? "soon" : "scheduled"
    };
  }

  function buildReviewQueue(input, options = {}) {
    ensureCore();
    const now = Number(options.now) || Date.now();
    const state = core.normalizeState(input, now);
    const trackId = core.tracks.some((track) => track.id === options.trackId) ? options.trackId : "all";
    const query = clean(options.query, 120).toLocaleLowerCase("vi-VN");
    const includeUpcoming = options.includeUpcoming !== false;
    return state.reviews
      .map((card) => ({ ...card, priority: reviewUrgency(card, now) }))
      .filter((card) => trackId === "all" || card.trackId === trackId)
      .filter((card) => !query || `${card.prompt} ${card.answer}`.toLocaleLowerCase("vi-VN").includes(query))
      .filter((card) => includeUpcoming || card.priority.isDue)
      .sort((a, b) => {
        if (a.priority.isDue !== b.priority.isDue) return a.priority.isDue ? -1 : 1;
        if (a.priority.urgency !== b.priority.urgency) return b.priority.urgency - a.priority.urgency;
        return a.priority.dueAt - b.priority.dueAt;
      });
  }

  function getDueQueue(input, options = {}) {
    return buildReviewQueue(input, { ...options, includeUpcoming: false });
  }

  function ratingPreview(card, retentionGoal = 90, now = Date.now()) {
    ensureCore();
    return Object.fromEntries(RATINGS.map((rating) => {
      const scheduled = core.scheduleReview(card, rating.id, now, retentionGoal);
      const delay = Math.max(0, safeDate(scheduled.dueAt, now) - now);
      let label = `${Math.max(1, Math.round(delay / 60_000))} phút`;
      if (delay >= DAY) label = `${Math.max(1, Math.round(delay / DAY))} ngày`;
      else if (delay >= 60 * 60_000) label = `${Math.max(1, Math.round(delay / (60 * 60_000)))} giờ`;
      return [rating.id, { ...scheduled, delay, label }];
    }));
  }

  function getWorkload(input, options = {}) {
    const now = Number(options.now) || Date.now();
    const queue = buildReviewQueue(input, { ...options, now, includeUpcoming: true });
    const due = queue.filter((card) => card.priority.isDue);
    const next24h = queue.filter((card) => card.priority.dueAt > now && card.priority.dueAt <= now + DAY);
    const next7d = queue.filter((card) => card.priority.dueAt > now && card.priority.dueAt <= now + 7 * DAY);
    return {
      due: due.length,
      next24h: next24h.length,
      next7d: next7d.length,
      estimatedMinutes: Math.max(0, Math.ceil(due.length * 0.75)),
      highRisk: queue.filter((card) => card.priority.isDue && (card.difficulty >= 6 || card.lapses >= 2)).length
    };
  }

  function getMistakeStats(input, options = {}) {
    ensureCore();
    const state = core.normalizeState(input, Number(options.now) || Date.now());
    const trackId = core.tracks.some((track) => track.id === options.trackId) ? options.trackId : "all";
    const filtered = state.mistakes.filter((item) => trackId === "all" || trackForMistake(item, state) === trackId);
    const unresolved = filtered.filter((item) => !item.resolved);
    const byPrompt = new Map();
    unresolved.forEach((item) => {
      const key = item.prompt.toLocaleLowerCase("vi-VN");
      const entry = byPrompt.get(key) || { prompt: item.prompt, count: 0, skillId: item.skillId };
      entry.count += 1;
      byPrompt.set(key, entry);
    });
    const bySkill = Object.fromEntries(core.skills.map((skill) => [skill.id, 0]));
    unresolved.forEach((item) => { if (Object.hasOwn(bySkill, item.skillId)) bySkill[item.skillId] += 1; });
    return {
      total: filtered.length,
      unresolved: unresolved.length,
      resolved: filtered.length - unresolved.length,
      frequent: [...byPrompt.values()].sort((a, b) => b.count - a.count).slice(0, 8),
      bySkill
    };
  }

  function setRetentionGoal(store, goal) {
    const target = [85, 90, 95].includes(Number(goal)) ? Number(goal) : 90;
    return store.update((state) => {
      state.profile.retentionGoal = target;
      return state;
    });
  }

  function addManualCard(store, payload = {}, now = Date.now()) {
    ensureCore();
    const prompt = clean(payload.prompt, 300);
    const answer = clean(payload.answer, 600);
    if (!prompt || !answer) throw new Error("Cần nhập đầy đủ mặt trước và mặt sau của thẻ.");
    const snapshot = store.get();
    const trackId = core.tracks.some((track) => track.id === payload.trackId) ? payload.trackId : snapshot.profile.career;
    const skillId = core.skills.some((skill) => skill.id === payload.skillId) ? payload.skillId : "vocabulary";
    const id = core.uid("review");
    store.update((state) => {
      state.reviews.unshift({
        id, prompt, answer, trackId, skillId,
        difficulty: clamp(payload.difficulty || 3, 1, 10),
        stability: 1, intervalDays: 0, lapses: 0,
        dueAt: new Date(now).toISOString(), lastRating: null
      });
      return state;
    });
    return id;
  }

  function rateCard(store, cardId, rating, options = {}) {
    ensureCore();
    const id = clean(cardId, 100);
    const grade = RATINGS.some((item) => item.id === rating) ? rating : "good";
    const now = Number(options.now) || Date.now();
    let scheduled = null;
    store.update((state) => {
      const index = state.reviews.findIndex((item) => item.id === id);
      if (index < 0) throw new Error("Không tìm thấy thẻ ôn tập.");
      scheduled = core.scheduleReview(state.reviews[index], grade, now, state.profile.retentionGoal);
      state.reviews[index] = scheduled;
      return core.recordStudy(state, {
        type: "review",
        minutes: 1,
        score: { again: 20, hard: 55, good: 82, easy: 96 }[grade],
        xp: { again: 1, hard: 2, good: 3, easy: 4 }[grade],
        skills: [scheduled.skillId]
      }, now);
    });
    return scheduled;
  }

  function resolveMistake(store, mistakeId, resolved = true) {
    const id = clean(mistakeId, 100);
    let found = false;
    store.update((state) => {
      const item = state.mistakes.find((mistake) => mistake.id === id);
      if (!item) throw new Error("Không tìm thấy lỗi sai.");
      item.resolved = Boolean(resolved);
      found = true;
      return state;
    });
    return found;
  }

  function mistakeToReview(store, mistakeId, now = Date.now()) {
    const state = store.get();
    const mistake = state.mistakes.find((item) => item.id === clean(mistakeId, 100));
    if (!mistake) throw new Error("Không tìm thấy lỗi sai.");
    const trackId = trackForMistake(mistake, state);
    const existing = state.reviews.find((card) => card.trackId === trackId
      && card.skillId === mistake.skillId
      && clean(card.prompt).toLocaleLowerCase("vi-VN") === clean(mistake.prompt).toLocaleLowerCase("vi-VN"));
    if (!existing) return addManualCard(store, {
      prompt: mistake.prompt,
      answer: mistake.answer,
      trackId,
      skillId: mistake.skillId,
      difficulty: 5
    }, now);
    store.update((draft) => {
      const card = draft.reviews.find((item) => item.id === existing.id);
      if (card) {
        card.answer = mistake.answer || card.answer;
        card.difficulty = Math.max(5, Number(card.difficulty) || 3);
        card.dueAt = new Date(now).toISOString();
      }
      return draft;
    });
    return existing.id;
  }

  function exportJSON(input, options = {}) {
    ensureCore();
    const state = core.normalizeState(input, Number(options.now) || Date.now());
    const trackId = core.tracks.some((track) => track.id === options.trackId) ? options.trackId : "all";
    return JSON.stringify({
      format: "hh-learning-review",
      version: 1,
      exportedAt: new Date(Number(options.now) || Date.now()).toISOString(),
      notice: "Lịch ôn thích ứng chạy cục bộ, lấy cảm hứng từ FSRS; chưa được tuyên bố là triển khai FSRS chuẩn khi chưa audit độc lập.",
      retentionGoal: state.profile.retentionGoal,
      trackId,
      reviews: state.reviews.filter((item) => trackId === "all" || item.trackId === trackId),
      mistakes: state.mistakes.filter((item) => trackId === "all" || trackForMistake(item, state) === trackId)
    }, null, 2);
  }

  function trackOptions(selected) {
    return `<option value="all">Tất cả chuyên ngành</option>${core.tracks.map((track) => `<option value="${escapeHTML(track.id)}" ${selected === track.id ? "selected" : ""}>${escapeHTML(track.title)}</option>`).join("")}`;
  }

  function skillLabel(skillId) {
    return core.skills.find((skill) => skill.id === skillId)?.label || skillId || "Từ vựng";
  }

  function statusLabel(priority) {
    if (priority.status === "due") {
      const overdue = Math.floor(Math.abs(priority.remaining) / DAY);
      return overdue ? `Quá hạn ${overdue} ngày` : "Đến hạn hôm nay";
    }
    if (priority.status === "soon") return `Sắp đến hạn · ${formatDate(priority.dueAt, true)}`;
    return formatDate(priority.dueAt, true);
  }

  function renderStats(state, filters, now) {
    const workload = getWorkload(state, { ...filters, now });
    const mistakes = getMistakeStats(state, { ...filters, now });
    return `<section class="lr-stats" aria-label="Tổng quan ôn tập">
      <article><span>ĐẾN HẠN</span><strong>${formatNumber(workload.due)}</strong><small>Khoảng ${formatNumber(workload.estimatedMinutes)} phút</small></article>
      <article><span>24 GIỜ TỚI</span><strong>${formatNumber(workload.next24h)}</strong><small>${formatNumber(workload.highRisk)} thẻ cần ưu tiên</small></article>
      <article><span>LỖI CHƯA SỬA</span><strong>${formatNumber(mistakes.unresolved)}</strong><small>${formatNumber(mistakes.resolved)} lỗi đã giải quyết</small></article>
      <article><span>MỤC TIÊU NHỚ</span><strong>${state.profile.retentionGoal}%</strong><small>Tự điều chỉnh lịch local</small></article>
    </section>`;
  }

  function renderReview(state, view, now) {
    const queue = buildReviewQueue(state, { trackId: view.trackId, query: view.query, includeUpcoming: view.includeUpcoming, now });
    const active = queue.find((card) => card.id === view.activeCardId) || queue[0] || null;
    const answerVisible = active && view.revealedId === active.id;
    const previews = active ? ratingPreview(active, state.profile.retentionGoal, now) : {};
    return `<div class="lr-workspace lr-review-workspace">
      <section class="lr-session" aria-live="polite">
        ${active ? `<div class="lr-card-meta"><span class="is-${active.priority.status}">${escapeHTML(statusLabel(active.priority))}</span><small>${escapeHTML(skillLabel(active.skillId))} · độ khó ${active.difficulty}/10</small></div>
          <article class="lr-flashcard ${answerVisible ? "is-revealed" : ""}" data-review-card="${escapeHTML(active.id)}">
            <div><span>MẶT TRƯỚC</span><h2>${escapeHTML(active.prompt)}</h2></div>
            <div class="lr-answer" ${answerVisible ? "" : "aria-hidden=\"true\""}><span>ĐÁP ÁN</span><p>${answerVisible ? escapeHTML(active.answer) : "Nhấn Space hoặc nút bên dưới để xem đáp án."}</p></div>
          </article>
          <button class="lr-reveal" type="button" data-lr-action="reveal">${answerVisible ? "Ẩn đáp án" : "Hiện đáp án"}<kbd>Space</kbd></button>
          <div class="lr-ratings" aria-label="Đánh giá mức ghi nhớ">${RATINGS.map((rating) => `<button type="button" class="is-${rating.tone}" data-lr-rate="${rating.id}" ${answerVisible ? "" : "disabled"}><kbd>${rating.key}</kbd><span>${rating.label}<small>${escapeHTML(previews[rating.id]?.label || "")}</small></span></button>`).join("")}</div>`
        : `<div class="lr-empty"><span aria-hidden="true">✓</span><h2>Hôm nay đã ôn xong</h2><p>Bật “Xem thẻ sắp đến hạn” hoặc thêm thẻ mới để tiếp tục.</p></div>`}
      </section>
      <aside class="lr-queue"><header><div><span>HÀNG ĐỢI THÍCH ỨNG</span><strong>${queue.length} thẻ</strong></div><label><input type="checkbox" data-lr-upcoming ${view.includeUpcoming ? "checked" : ""}> Xem thẻ sắp đến hạn</label></header>
        <div class="lr-queue-list">${queue.slice(0, 12).map((card, index) => `<button type="button" data-lr-select="${escapeHTML(card.id)}" class="lr-queue-card ${card.id === active?.id ? "is-active" : ""}" ${card.id === active?.id ? 'aria-current="true"' : ""}><i>${String(index + 1).padStart(2, "0")}</i><span><strong>${escapeHTML(card.prompt)}</strong><small>${escapeHTML(statusLabel(card.priority))}</small></span><em>${card.lapses} lần quên</em></button>`).join("") || `<p class="lr-muted">Không còn thẻ trong bộ lọc này.</p>`}</div>
        <section class="lr-retention"><span>Mục tiêu ghi nhớ</span><div>${[85, 90, 95].map((goal) => `<button type="button" data-lr-retention="${goal}" class="${state.profile.retentionGoal === goal ? "is-active" : ""}">${goal}%</button>`).join("")}</div><small>Mục tiêu cao hơn tạo lịch ôn dày hơn.</small></section>
      </aside>
    </div>`;
  }

  function renderMistakes(state, view, now) {
    const stats = getMistakeStats(state, { trackId: view.trackId, now });
    const items = state.mistakes
      .filter((item) => view.trackId === "all" || trackForMistake(item, state) === view.trackId)
      .filter((item) => !view.query || `${item.prompt} ${item.answer} ${item.userAnswer}`.toLocaleLowerCase("vi-VN").includes(view.query.toLocaleLowerCase("vi-VN")))
      .sort((a, b) => Number(a.resolved) - Number(b.resolved) || safeDate(b.createdAt) - safeDate(a.createdAt));
    return `<div class="lr-mistake-layout">
      <section class="lr-mistake-list"><header><div><span>MISTAKE NOTEBOOK</span><h2>Sổ lỗi sai cá nhân</h2></div><p>Lỗi sai từ bài học được gom tại đây để sửa và đưa lại vào lịch ôn.</p></header>
        ${items.map((item) => `<article class="lr-mistake ${item.resolved ? "is-resolved" : ""}"><div class="lr-mistake-head"><span>${escapeHTML(skillLabel(item.skillId))}</span><time>${escapeHTML(formatDate(item.createdAt, true))}</time></div><h3>${escapeHTML(item.prompt)}</h3><dl><div><dt>Bạn trả lời</dt><dd>${escapeHTML(item.userAnswer || "Chưa có câu trả lời")}</dd></div><div><dt>Đáp án</dt><dd>${escapeHTML(item.answer)}</dd></div></dl><footer><button type="button" data-lr-to-review="${escapeHTML(item.id)}">Thêm vào ôn tập</button><button type="button" class="is-primary" data-lr-resolve="${escapeHTML(item.id)}" data-resolved="${item.resolved ? "false" : "true"}">${item.resolved ? "Mở lại" : "Đã hiểu"}</button></footer></article>`).join("") || `<div class="lr-empty"><span aria-hidden="true">◎</span><h2>Chưa có lỗi sai</h2><p>Lỗi trong Lesson Player sẽ tự xuất hiện tại đây.</p></div>`}
      </section>
      <aside class="lr-mistake-insight"><span>PHÂN TÍCH CỤC BỘ</span><h3>Từ sai nhiều nhất</h3>${stats.frequent.map((item) => `<div><strong>${escapeHTML(item.prompt)}</strong><span>${item.count} lần</span></div>`).join("") || `<p class="lr-muted">Chưa đủ dữ liệu để phân tích.</p>`}<hr><h3>Theo kỹ năng</h3>${core.skills.map((skill) => `<label><span>${escapeHTML(skill.label)}</span><progress max="${Math.max(1, stats.unresolved)}" value="${stats.bySkill[skill.id] || 0}"></progress><b>${stats.bySkill[skill.id] || 0}</b></label>`).join("")}</aside>
    </div>`;
  }

  function renderVocabulary(state, view, now) {
    const cards = buildReviewQueue(state, { trackId: view.trackId, query: view.query, includeUpcoming: true, now });
    return `<div class="lr-vocabulary-layout">
      <section class="lr-vocabulary"><header><div><span>VOCABULARY LIBRARY</span><h2>Kho từ vựng theo chuyên ngành</h2></div><strong>${cards.length} thẻ</strong></header>
        <div class="lr-word-grid">${cards.map((card) => `<article><div><span>${escapeHTML(skillLabel(card.skillId))}</span><small>${escapeHTML(core.tracks.find((track) => track.id === card.trackId)?.title || card.trackId)}</small></div><h3>${escapeHTML(card.prompt)}</h3><p>${escapeHTML(card.answer)}</p><footer><span>${escapeHTML(statusLabel(card.priority))}</span><b>${card.intervalDays || 0} ngày</b></footer></article>`).join("") || `<div class="lr-empty"><span aria-hidden="true">Aa</span><h2>Kho từ đang trống</h2><p>Tạo thẻ đầu tiên bằng biểu mẫu bên cạnh.</p></div>`}</div>
      </section>
      <aside class="lr-create-card"><span>THẺ THỦ CÔNG</span><h3>Thêm từ hoặc kiến thức</h3><form data-lr-card-form><label>Mặt trước<input name="prompt" required maxlength="300" placeholder="Ví dụ: deployment"></label><label>Mặt sau<textarea name="answer" required maxlength="600" rows="4" placeholder="Nghĩa, ví dụ hoặc ghi chú..."></textarea></label><label>Chuyên ngành<select name="trackId">${trackOptions(view.trackId === "all" ? state.profile.career : view.trackId)}</select></label><label>Kỹ năng<select name="skillId">${core.skills.map((skill) => `<option value="${escapeHTML(skill.id)}">${escapeHTML(skill.label)}</option>`).join("")}</select></label><button type="submit">Thêm và ôn ngay</button><small>Thẻ được lưu trong shared store trên thiết bị này.</small></form></aside>
    </div>`;
  }

  function render(input, options = {}) {
    ensureCore();
    const now = Number(options.now) || Date.now();
    const state = core.normalizeState(input, now);
    const view = {
      mode: normalizeMode(options.mode),
      trackId: core.tracks.some((track) => track.id === options.trackId) ? options.trackId : "all",
      query: clean(options.query, 120),
      includeUpcoming: options.includeUpcoming !== false,
      revealedId: clean(options.revealedId, 100),
      activeCardId: clean(options.activeCardId, 100)
    };
    return `<section class="hh-learning-review" data-learning-review data-mode="${view.mode}">
      <header class="lr-hero"><div><span>HH LEARNING · SMART REVIEW</span><h1>Ôn đúng lúc, hiểu đúng lỗi</h1><p>Lịch ôn thích ứng chạy cục bộ, lấy cảm hứng từ FSRS. HH không tuyên bố đây là FSRS chuẩn khi chưa được audit độc lập.</p></div><div class="lr-hero-actions"><label><span class="sr-only">Tìm thẻ hoặc lỗi sai</span><input type="search" data-lr-search value="${escapeHTML(view.query)}" placeholder="Tìm từ, đáp án, lỗi sai..."></label><select data-lr-track aria-label="Lọc chuyên ngành">${trackOptions(view.trackId)}</select><button type="button" data-lr-action="export">Xuất JSON</button></div></header>
      <nav class="lr-tabs" aria-label="Khu vực ôn tập">${[["review", "Ôn tập", "Thẻ đến hạn"], ["mistakes", "Sổ lỗi sai", "Giải thích và sửa"], ["vocabulary", "Từ vựng", "Kho thẻ cá nhân"]].map(([id, label, note]) => `<button type="button" data-lr-mode="${id}" class="${view.mode === id ? "is-active" : ""}" ${view.mode === id ? 'aria-current="page"' : ""}><span>${label}</span><small>${note}</small></button>`).join("")}</nav>
      ${renderStats(state, view, now)}
      <main>${view.mode === "mistakes" ? renderMistakes(state, view, now) : view.mode === "vocabulary" ? renderVocabulary(state, view, now) : renderReview(state, view, now)}</main>
      <footer class="lr-footer"><span>LOCAL-FIRST</span><p>Dữ liệu ôn tập nằm trong HH Learning shared store. Kết quả AI hoặc lịch ôn chỉ là hỗ trợ học tập, không tự thay đổi điểm chính thức.</p><kbd>1–4 đánh giá · Space lật thẻ</kbd></footer>
    </section>`;
  }

  function downloadExport(instance) {
    const text = exportJSON(instance.store.get(), { trackId: instance.view.trackId });
    if (!root.Blob || !root.URL?.createObjectURL || !root.document?.createElement) return text;
    const url = root.URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const anchor = root.document.createElement("a");
    anchor.href = url;
    anchor.download = `hh-learning-review-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    root.URL.revokeObjectURL(url);
    return text;
  }

  function renderInstance(instance) {
    const state = instance.store.get();
    instance.host.innerHTML = render(state, { ...instance.view, now: instance.now() });
  }

  function handleClick(instance, event) {
    const target = event.target?.closest?.("button");
    if (!target) return;
    if (target.dataset.lrMode) {
      instance.view.mode = normalizeMode(target.dataset.lrMode);
      instance.view.revealedId = "";
      renderInstance(instance);
      return;
    }
    if (target.dataset.lrAction === "reveal") {
      const card = instance.host.querySelector?.("[data-review-card]");
      instance.view.revealedId = instance.view.revealedId ? "" : card?.dataset.reviewCard || "";
      renderInstance(instance);
      instance.host.querySelector?.("[data-lr-action=\"reveal\"]")?.focus?.();
      return;
    }
    if (target.dataset.lrAction === "export") { downloadExport(instance); return; }
    if (target.dataset.lrRetention) { setRetentionGoal(instance.store, target.dataset.lrRetention); return; }
    if (target.dataset.lrSelect) {
      instance.view.activeCardId = clean(target.dataset.lrSelect, 100);
      instance.view.revealedId = "";
      renderInstance(instance);
      instance.host.querySelector?.("[data-lr-action=\"reveal\"]")?.focus?.();
      return;
    }
    if (target.dataset.lrRate) {
      const card = instance.host.querySelector?.("[data-review-card]");
      if (!card) return;
      rateCard(instance.store, card.dataset.reviewCard, target.dataset.lrRate, { now: instance.now() });
      instance.view.revealedId = "";
      instance.view.activeCardId = "";
      renderInstance(instance);
      return;
    }
    if (target.dataset.lrResolve) { resolveMistake(instance.store, target.dataset.lrResolve, target.dataset.resolved === "true"); return; }
    if (target.dataset.lrToReview) { mistakeToReview(instance.store, target.dataset.lrToReview, instance.now()); return; }
  }

  function handleChange(instance, event) {
    if (event.target?.matches?.("[data-lr-track]")) { instance.view.trackId = event.target.value; renderInstance(instance); }
    if (event.target?.matches?.("[data-lr-upcoming]")) { instance.view.includeUpcoming = event.target.checked; renderInstance(instance); }
  }

  function handleInput(instance, event) {
    if (!event.target?.matches?.("[data-lr-search]")) return;
    instance.view.query = clean(event.target.value, 120);
    const selection = event.target.selectionStart || instance.view.query.length;
    renderInstance(instance);
    const field = instance.host.querySelector?.("[data-lr-search]");
    field?.focus?.();
    field?.setSelectionRange?.(selection, selection);
  }

  function handleSubmit(instance, event) {
    if (!event.target?.matches?.("[data-lr-card-form]")) return;
    event.preventDefault();
    const data = new FormData(event.target);
    addManualCard(instance.store, Object.fromEntries(data.entries()), instance.now());
    instance.view.mode = "review";
    instance.view.revealedId = "";
    instance.view.activeCardId = "";
    renderInstance(instance);
  }

  function handleKeydown(instance, event) {
    const tag = event.target?.tagName?.toLowerCase?.();
    if (["input", "textarea", "select"].includes(tag)) return;
    if (event.key === " " || event.code === "Space") {
      event.preventDefault();
      const card = instance.host.querySelector?.("[data-review-card]");
      if (!card) return;
      instance.view.revealedId = instance.view.revealedId ? "" : card.dataset.reviewCard;
      renderInstance(instance);
      return;
    }
    const rating = RATINGS.find((item) => item.key === event.key);
    if (!rating || !instance.view.revealedId) return;
    event.preventDefault();
    rateCard(instance.store, instance.view.revealedId, rating.id, { now: instance.now() });
    instance.view.revealedId = "";
    instance.view.activeCardId = "";
    renderInstance(instance);
  }

  function mount(host, options = {}) {
    ensureCore();
    if (!host?.addEventListener) throw new Error("Cần một phần tử host hợp lệ.");
    unmount(host);
    const instance = {
      host,
      store: options.store || getSharedStore(),
      now: typeof options.now === "function" ? options.now : () => Date.now(),
      view: {
        mode: normalizeMode(options.mode),
        trackId: core.tracks.some((track) => track.id === options.trackId) ? options.trackId : "all",
        query: "",
        includeUpcoming: options.includeUpcoming !== false,
        revealedId: "",
        activeCardId: ""
      },
      handlers: {}
    };
    instance.handlers.click = (event) => handleClick(instance, event);
    instance.handlers.change = (event) => handleChange(instance, event);
    instance.handlers.input = (event) => handleInput(instance, event);
    instance.handlers.submit = (event) => handleSubmit(instance, event);
    instance.handlers.keydown = (event) => handleKeydown(instance, event);
    Object.entries(instance.handlers).forEach(([type, listener]) => host.addEventListener(type, listener));
    instance.unsubscribe = instance.store.subscribe(() => renderInstance(instance));
    instances.set(host, instance);
    host.classList?.add?.("learning-review-host");
    renderInstance(instance);
    return Object.freeze({
      setMode(mode) { instance.view.mode = normalizeMode(mode); instance.view.revealedId = ""; renderInstance(instance); },
      refresh() { renderInstance(instance); },
      getState() { return instance.store.get(); },
      unmount() { unmount(host); }
    });
  }

  function unmount(host) {
    const instance = instances.get(host);
    if (!instance) return false;
    Object.entries(instance.handlers).forEach(([type, listener]) => host.removeEventListener?.(type, listener));
    instance.unsubscribe?.();
    host.classList?.remove?.("learning-review-host");
    instances.delete(host);
    return true;
  }

  root.HHLearningReview = Object.freeze({
    modes: MODES,
    ratings: RATINGS,
    mount,
    unmount,
    render,
    escapeHTML,
    reviewUrgency,
    buildReviewQueue,
    getDueQueue,
    ratingPreview,
    getWorkload,
    getMistakeStats,
    setRetentionGoal,
    addManualCard,
    rateCard,
    resolveMistake,
    mistakeToReview,
    exportJSON
  });

  if (typeof module !== "undefined" && module.exports) module.exports = root.HHLearningReview;
})();
