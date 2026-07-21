(() => {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  const VIEWS = new Set(["profile", "paths", "mastery", "passport"]);
  const GOALS = Object.freeze([
    { id: "communication", label: "Giao tiếp", description: "Phản xạ nghe nói trong đời sống." },
    { id: "exam", label: "Thi cử", description: "Luyện chiến lược và kỹ năng làm bài." },
    { id: "work", label: "Công việc", description: "Giao tiếp chuyên nghiệp hằng ngày." },
    { id: "career", label: "Theo chuyên ngành", description: "Học đúng ngữ cảnh nghề nghiệp." }
  ]);
  const MASTERY_META = Object.freeze({
    new: { label: "Đang làm quen", tone: "cyan", hint: "Bắt đầu bằng ví dụ ngắn và bài luyện có hướng dẫn." },
    familiar: { label: "Đã hiểu", tone: "violet", hint: "Luyện thêm trong tình huống mới để củng cố." },
    mastered: { label: "Thành thạo", tone: "green", hint: "Duy trì bằng ôn tập và dự án thực tế." },
    review: { label: "Cần ôn lại", tone: "amber", hint: "Ưu tiên ôn hôm nay để tránh quên kiến thức." }
  });

  let activeHost = null;
  let activeView = "profile";
  let activeOptions = {};
  let sharedStore = null;
  let store = null;
  let unsubscribe = null;
  let clickHandler = null;
  let submitHandler = null;
  let inputHandler = null;
  let selectedMasterySkill = "";
  let careerQuery = "";
  let pathTrackId = "";
  let statusMessage = "";

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const cleanQuery = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi").trim();

  function core() {
    if (!root.HHLearningCore) throw new Error("HHLearningPaths cần HHLearningCore được tải trước.");
    return root.HHLearningCore;
  }

  function getStore(options = {}) {
    if (options.store && typeof options.store.get === "function" && typeof options.store.update === "function") return options.store;
    if (!sharedStore) sharedStore = core().createStore();
    return sharedStore;
  }

  function supports(view) {
    return VIEWS.has(String(view || ""));
  }

  function viewLabel(view) {
    return ({ profile: "Hồ sơ học", paths: "Lộ trình", mastery: "Kỹ năng", passport: "Hộ chiếu" })[view] || "Lộ trình";
  }

  function trackById(id) {
    return core().tracks.find((track) => track.id === id) || core().tracks[0];
  }

  function skillById(id) {
    return core().skills.find((skill) => skill.id === id) || core().skills[0];
  }

  function formatEvidenceDate(value) {
    const date = new Date(value || 0);
    return Number.isNaN(date.getTime()) ? "Chưa xác định" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(date);
  }

  function evidenceForSkill(state, skillId) {
    const relatedLessons = core().lessons.filter((lesson) => lesson.skills.includes(skillId));
    const relatedIds = new Set(relatedLessons.map((lesson) => lesson.id));
    const completed = Object.entries(state.progress || {}).filter(([lessonId, progress]) => relatedIds.has(lessonId) && progress.status === "completed");
    const sessions = (state.sessions || []).filter((session) => session.type === skillId || session.type === "lesson" || session.type === "review");
    const mistakes = (state.mistakes || []).filter((mistake) => mistake.skillId === skillId);
    const mastery = state.mastery?.[skillId] || {};
    const recentScore = completed.length ? Math.round(completed.reduce((total, entry) => total + Number(entry[1].score || 0), 0) / completed.length) : Number(mastery.score || 0);
    return {
      completedLessons: completed.length,
      attempts: Number(mastery.attempts || 0),
      accuracy: Number(mastery.accuracy || 0),
      recentScore,
      studySessions: sessions.length,
      openMistakes: mistakes.filter((item) => !item.resolved).length,
      lastUpdated: mastery.updatedAt || null
    };
  }

  function pathProgress(state, trackId) {
    const lessons = core().lessons.filter((lesson) => lesson.trackId === trackId);
    const completed = lessons.filter((lesson) => state.progress?.[lesson.id]?.status === "completed").length;
    return { completed, total: lessons.length, percent: lessons.length ? Math.round(completed / lessons.length * 100) : 0 };
  }

  function recommendedLesson(state, trackId = state.profile.career) {
    const trackLessons = core().lessons.filter((lesson) => lesson.trackId === trackId);
    const levelIndex = Math.max(0, core().levels.indexOf(state.profile.level));
    const focusDifficulty = Math.round(state.profile.focusSkills.reduce((total, skillId) => total + core().adaptiveDifficulty(state, skillId), 0) / Math.max(1, state.profile.focusSkills.length));
    const targetDifficulty = Math.max(1, Math.min(7, Math.round((levelIndex + 1 + focusDifficulty) / 2)));
    return trackLessons.find((lesson) => lesson.difficulty >= targetDifficulty && state.progress?.[lesson.id]?.status !== "completed")
      || trackLessons.find((lesson) => state.progress?.[lesson.id]?.status !== "completed")
      || trackLessons[trackLessons.length - 1];
  }

  function shell(content, state) {
    return `
      <section class="hlp-shell" data-learning-paths data-view="${esc(activeView)}">
        <header class="hlp-header">
          <div>
            <p class="hlp-eyebrow">HH LEARNING · CÁ NHÂN HÓA</p>
            <h1>${esc(viewLabel(activeView))}</h1>
            <p>Học đúng mục tiêu, nhìn rõ kỹ năng yếu và lưu bằng chứng tiến bộ trong một nơi.</p>
          </div>
          <div class="hlp-header-progress" aria-label="Mục tiêu học hôm nay">
            <strong>${Math.min(100, Math.round((state.daily.minutes / state.profile.dailyMinutes) * 100))}%</strong>
            <span>${state.daily.minutes}/${state.profile.dailyMinutes} phút hôm nay</span>
          </div>
        </header>
        <nav class="hlp-tabs" aria-label="Điều hướng lộ trình học">
          ${["profile", "paths", "mastery", "passport"].map((view) => `<button type="button" data-action="switch-view" data-view="${view}"${activeView === view ? ' aria-current="page"' : ""}>${esc(viewLabel(view))}</button>`).join("")}
        </nav>
        <div class="hlp-status" aria-live="polite">${esc(statusMessage)}</div>
        ${content}
      </section>`;
  }

  function renderProfile(state) {
    const focus = new Set(state.profile.focusSkills);
    const query = cleanQuery(careerQuery);
    const tracks = core().tracks;
    const visibleTrackCount = tracks.filter((track) => !query || cleanQuery(`${track.title} ${track.description}`).includes(query)).length;
    return shell(`
      <main class="hlp-onboarding">
        <div class="hlp-intro">
          <span class="hlp-step">Thiết lập một lần · có thể đổi bất cứ lúc nào</span>
          <h2>${state.profile.configured ? "Điều chỉnh lộ trình của bạn" : "Bạn muốn học để làm gì?"}</h2>
          <p>Chọn nhanh năm thông tin. HH sẽ tạo lộ trình, bài tiếp theo và độ khó phù hợp.</p>
        </div>
        <form class="hlp-profile-form" data-learning-profile-form>
          <fieldset class="hlp-fieldset">
            <legend>1. Mục tiêu chính</legend>
            <div class="hlp-choice-grid hlp-choice-grid--goals">
              ${GOALS.map((goal) => `<label class="hlp-choice"><input type="radio" name="goal" value="${goal.id}"${state.profile.goal === goal.id ? " checked" : ""}><span><strong>${esc(goal.label)}</strong><small>${esc(goal.description)}</small></span></label>`).join("")}
            </div>
          </fieldset>
          <div class="hlp-form-row">
            <label><span>2. Trình độ hiện tại</span><select name="level">${core().levels.map((level) => `<option value="${level}"${state.profile.level === level ? " selected" : ""}>${level}</option>`).join("")}</select></label>
            <label><span>3. Thời gian mỗi ngày</span><select name="dailyMinutes">${[5, 10, 15, 20, 30, 45, 60].map((minutes) => `<option value="${minutes}"${state.profile.dailyMinutes === minutes ? " selected" : ""}>${minutes} phút</option>`).join("")}</select></label>
            <label><span>Mục tiêu ghi nhớ</span><select name="retentionGoal">${[85, 90, 95].map((retention) => `<option value="${retention}"${state.profile.retentionGoal === retention ? " selected" : ""}>${retention}%</option>`).join("")}</select></label>
          </div>
          <fieldset class="hlp-fieldset">
            <legend>4. Nghề nghiệp hoặc chuyên ngành</legend>
            <label class="hlp-search"><span class="hlp-sr-only">Tìm chuyên ngành</span><input type="search" data-action="career-search" placeholder="Tìm trong 16 hướng học..." value="${esc(careerQuery)}"></label>
            <div class="hlp-track-list" role="radiogroup" aria-label="Chuyên ngành">
              ${tracks.map((track) => {
                const searchValue = cleanQuery(`${track.title} ${track.description}`);
                const hidden = query && !searchValue.includes(query);
                return `<label class="hlp-track-choice" data-career-search="${esc(searchValue)}"${hidden ? " hidden" : ""}><input type="radio" name="career" value="${track.id}"${state.profile.career === track.id ? " checked" : ""}><span><strong>${esc(track.title)}</strong><small>${esc(track.description)}</small></span></label>`;
              }).join("")}
              <p class="hlp-empty" data-career-empty${visibleTrackCount ? " hidden" : ""}>Không tìm thấy chuyên ngành phù hợp.</p>
            </div>
          </fieldset>
          <fieldset class="hlp-fieldset">
            <legend>5. Kỹ năng muốn ưu tiên <small>Chọn tối đa 4</small></legend>
            <div class="hlp-skill-choices">
              ${core().skills.map((skill) => `<label><input type="checkbox" name="focusSkills" value="${skill.id}"${focus.has(skill.id) ? " checked" : ""}><span style="--skill-color:${esc(skill.color)}">${esc(skill.label)}</span></label>`).join("")}
            </div>
          </fieldset>
          <div class="hlp-form-actions">
            <p>Dữ liệu được lưu trong shared Learning Store trên thiết bị này.</p>
            <button class="hlp-primary" type="submit">${state.profile.configured ? "Cập nhật lộ trình" : "Tạo lộ trình của tôi"}</button>
          </div>
        </form>
      </main>`, state);
  }

  function renderPaths(state) {
    const selectedTrack = trackById(pathTrackId || state.profile.career);
    const progress = pathProgress(state, selectedTrack.id);
    const recommendation = recommendedLesson(state, selectedTrack.id);
    const levels = core().levels.map((level) => {
      const lesson = core().lessons.find((item) => item.trackId === selectedTrack.id && item.level === level);
      const itemProgress = state.progress?.[lesson?.id];
      const levelIndex = core().levels.indexOf(level);
      const profileLevelIndex = core().levels.indexOf(state.profile.level);
      const status = itemProgress?.status === "completed" ? "completed" : lesson?.id === state.activeLessonId ? "active" : levelIndex <= profileLevelIndex + 1 ? "available" : "locked";
      return `<li class="hlp-level hlp-level--${status}">
        <div class="hlp-level-marker" aria-label="${esc(level)}, ${status === "completed" ? "đã hoàn thành" : status === "locked" ? "chưa mở" : "sẵn sàng"}">${itemProgress?.status === "completed" ? `<span aria-hidden="true">✓</span><span class="hlp-sr-only">${esc(level)}</span>` : esc(level)}</div>
        <div class="hlp-level-content">
          <div><span>${status === "completed" ? "Đã hoàn thành" : status === "active" ? "Đang học" : status === "locked" ? "Mở theo tiến độ" : "Sẵn sàng"}</span><h3>${esc(lesson?.title || `${selectedTrack.title} ${level}`)}</h3></div>
          <p>${esc(lesson?.description || selectedTrack.description)}</p>
          <div class="hlp-level-meta"><span>${lesson?.minutes || 8} phút</span><span>Độ khó ${lesson?.difficulty || levelIndex + 1}/7</span><span>${(lesson?.skills || []).map((id) => esc(skillById(id).label)).join(" · ")}</span></div>
          <button type="button" data-action="open-lesson" data-lesson-id="${esc(lesson?.id || "")}"${status === "locked" ? " disabled" : ""}>${itemProgress?.status === "completed" ? "Học lại" : status === "active" ? "Tiếp tục" : "Bắt đầu"}</button>
        </div>
      </li>`;
    }).join("");
    return shell(`
      <main class="hlp-paths">
        <section class="hlp-path-toolbar">
          <div><p class="hlp-eyebrow">BẢN ĐỒ A0–C2</p><h2>${esc(selectedTrack.title)}</h2><p>${esc(selectedTrack.description)}</p></div>
          <label><span>Đổi hướng học</span><select data-action="track-select">${core().tracks.map((track) => `<option value="${track.id}"${selectedTrack.id === track.id ? " selected" : ""}>${esc(track.title)}</option>`).join("")}</select></label>
        </section>
        <section class="hlp-recommendation" aria-labelledby="hlp-recommendation-title">
          <div><span>Đề xuất thích ứng</span><h3 id="hlp-recommendation-title">${esc(recommendation?.title || "Bài tiếp theo")}</h3><p>Dựa trên trình độ ${esc(state.profile.level)}, kỹ năng ưu tiên và bằng chứng làm bài gần đây.</p></div>
          <div class="hlp-recommendation-score"><strong>${progress.percent}%</strong><span>${progress.completed}/${progress.total} chặng</span></div>
          <button class="hlp-primary" type="button" data-action="open-lesson" data-lesson-id="${esc(recommendation?.id || "")}">Học bài đề xuất</button>
        </section>
        <ol class="hlp-level-map" aria-label="Lộ trình từ A0 đến C2">${levels}</ol>
      </main>`, state);
  }

  function masteryRows(state) {
    return core().skills.map((skill) => {
      const mastery = state.mastery[skill.id];
      const meta = MASTERY_META[mastery.state] || MASTERY_META.new;
      const evidence = evidenceForSkill(state, skill.id);
      const isSelected = selectedMasterySkill === skill.id;
      return `<article class="hlp-mastery-row${isSelected ? " is-selected" : ""}" data-state="${mastery.state}">
        <button type="button" data-action="select-skill" data-skill-id="${skill.id}" aria-expanded="${isSelected}">
          <span class="hlp-skill-dot" style="--skill-color:${esc(skill.color)}"></span>
          <span class="hlp-mastery-name"><strong>${esc(skill.label)}</strong><small>${esc(meta.label)}</small></span>
          <span class="hlp-meter"><i style="width:${mastery.score}%"></i></span>
          <span class="hlp-score">${mastery.score}%</span>
        </button>
        ${isSelected ? `<div class="hlp-evidence-panel">
          <p>${esc(meta.hint)}</p>
          <dl><div><dt>Độ chính xác</dt><dd>${evidence.accuracy}%</dd></div><div><dt>Lượt luyện</dt><dd>${evidence.attempts}</dd></div><div><dt>Bài hoàn thành</dt><dd>${evidence.completedLessons}</dd></div><div><dt>Lỗi cần sửa</dt><dd>${evidence.openMistakes}</dd></div></dl>
          <p class="hlp-adaptive">Độ khó đề xuất: <strong>${core().adaptiveDifficulty(state, skill.id)}/7</strong></p>
          ${mastery.state === "mastered" ? `<button type="button" data-action="add-passport" data-skill-id="${skill.id}">Lưu bằng chứng vào Learning Passport</button>` : `<button type="button" data-action="practice-skill" data-skill-id="${skill.id}">Luyện kỹ năng này</button>`}
        </div>` : ""}
      </article>`;
    }).join("");
  }

  function renderMastery(state) {
    const weak = core().weakSkills(state);
    const mastered = Object.values(state.mastery).filter((item) => item.state === "mastered").length;
    return shell(`
      <main class="hlp-mastery">
        <section class="hlp-mastery-summary">
          <div><p class="hlp-eyebrow">SKILL GRAPH</p><h2>Biết rõ mình mạnh và yếu ở đâu</h2><p>Mỗi trạng thái dựa trên điểm, độ chính xác, lượt luyện và bài đã hoàn thành.</p></div>
          <dl><div><dt>Thành thạo</dt><dd>${mastered}/${core().skills.length}</dd></div><div><dt>Ưu tiên ôn</dt><dd>${weak.map((item) => esc(skillById(item.skillId).label)).join(", ")}</dd></div></dl>
        </section>
        <section class="hlp-mastery-list" aria-label="Đồ thị kỹ năng">${masteryRows(state)}</section>
        <footer class="hlp-legend" aria-label="Chú giải trạng thái">${Object.entries(MASTERY_META).map(([id, meta]) => `<span data-state="${id}"><i></i>${esc(meta.label)}</span>`).join("")}</footer>
      </main>`, state);
  }

  function passportEntries(state) {
    const explicit = (state.passport || []).map((entry) => ({ ...entry, source: "saved" }));
    const completedLevels = core().levels.flatMap((level) => {
      const lessons = core().lessons.filter((lesson) => lesson.trackId === state.profile.career && lesson.level === level);
      return lessons.length && lessons.every((lesson) => state.progress?.[lesson.id]?.status === "completed") ? [{
        id: `level-${state.profile.career}-${level}`,
        skillId: "project",
        title: `${trackById(state.profile.career).title} · ${level}`,
        evidence: `Đã hoàn thành toàn bộ bài học cấp ${level}.`,
        earnedAt: lessons.map((lesson) => state.progress[lesson.id].completedAt).filter(Boolean).sort().at(-1) || state.updatedAt,
        source: "derived"
      }] : [];
    });
    const unique = new Map([...explicit, ...completedLevels].map((entry) => [entry.id, entry]));
    return [...unique.values()].sort((a, b) => Date.parse(b.earnedAt || 0) - Date.parse(a.earnedAt || 0));
  }

  function renderPassport(state) {
    const entries = passportEntries(state);
    const track = trackById(state.profile.career);
    return shell(`
      <main class="hlp-passport">
        <section class="hlp-passport-cover">
          <div class="hlp-passport-mark" aria-hidden="true">HH</div>
          <div><p>LEARNING PASSPORT</p><h2>${esc(state.profile.name)}</h2><span>${esc(track.title)} · ${esc(state.profile.level)} · mục tiêu ghi nhớ ${state.profile.retentionGoal}%</span></div>
          <dl><div><dt>Streak</dt><dd>${state.streak.count} ngày</dd></div><div><dt>XP hôm nay</dt><dd>${state.daily.xp}</dd></div><div><dt>Minh chứng</dt><dd>${entries.length}</dd></div></dl>
        </section>
        <section class="hlp-passport-body">
          <div class="hlp-section-heading"><div><p class="hlp-eyebrow">THÀNH TÍCH CÓ BẰNG CHỨNG</p><h2>Hành trình của bạn</h2></div><button type="button" data-action="sync-passport">Đồng bộ kỹ năng thành thạo</button></div>
          ${entries.length ? `<ol class="hlp-passport-timeline">${entries.map((entry) => `<li><span class="hlp-passport-icon" style="--skill-color:${esc(skillById(entry.skillId).color)}">✓</span><div><time>${esc(formatEvidenceDate(entry.earnedAt))}</time><h3>${esc(entry.title)}</h3><p>${esc(entry.evidence)}</p><small>${entry.source === "derived" ? "Tự động từ tiến độ bài học" : "Đã lưu trong shared Learning Store"}</small></div></li>`).join("")}</ol>` : `<div class="hlp-empty-state"><strong>Hộ chiếu đang chờ dấu mốc đầu tiên</strong><p>Hoàn thành bài học hoặc đạt trạng thái Thành thạo rồi đồng bộ tại đây.</p><button type="button" data-action="switch-view" data-view="paths">Mở lộ trình</button></div>`}
        </section>
      </main>`, state);
  }

  function render() {
    if (!activeHost || !store) return;
    const state = store.get();
    if (!pathTrackId) pathTrackId = state.profile.career;
    if (!selectedMasterySkill) selectedMasterySkill = core().weakSkills(state)[0]?.skillId || core().skills[0].id;
    const renderer = ({ profile: renderProfile, paths: renderPaths, mastery: renderMastery, passport: renderPassport })[activeView] || renderProfile;
    activeHost.innerHTML = renderer(state);
  }

  function navigateLesson(lessonId) {
    if (!lessonId || !core().lessons.some((lesson) => lesson.id === lessonId)) return;
    store.update((state) => { state.activeLessonId = lessonId; return state; });
    const detail = { route: "/learning/lesson-player", view: "lesson-player", lessonId };
    if (typeof activeOptions.navigate === "function") activeOptions.navigate(detail);
    try { root.dispatchEvent?.(new CustomEvent("hh:learning:navigate", { detail })); } catch {}
    if (!activeOptions.navigate && root.location && typeof root.location === "object") root.location.hash = `#/learning/lesson-player?lesson=${encodeURIComponent(lessonId)}`;
  }

  function syncPassport(skillId = "") {
    let added = 0;
    store.update((state) => {
      const candidates = Object.values(state.mastery).filter((item) => item.state === "mastered" && (!skillId || item.skillId === skillId));
      const existing = new Set(state.passport.map((entry) => entry.id));
      candidates.forEach((item) => {
        const id = `mastery-${item.skillId}`;
        if (existing.has(id)) return;
        const evidence = evidenceForSkill(state, item.skillId);
        state.passport.unshift({
          id,
          skillId: item.skillId,
          title: `Thành thạo ${skillById(item.skillId).label}`,
          evidence: `${evidence.accuracy}% chính xác qua ${evidence.attempts} lượt luyện; ${evidence.completedLessons} bài hoàn thành.`,
          earnedAt: item.updatedAt || new Date().toISOString()
        });
        added += 1;
      });
      return state;
    });
    statusMessage = added ? `Đã thêm ${added} minh chứng vào Learning Passport.` : "Chưa có kỹ năng thành thạo mới để đồng bộ.";
  }

  function onClick(event) {
    const button = event.target?.closest?.("[data-action]");
    if (!button || !activeHost?.contains?.(button) && activeHost !== button.host) return;
    const action = button.dataset.action;
    if (action === "switch-view") {
      activeView = supports(button.dataset.view) ? button.dataset.view : activeView;
      statusMessage = "";
      render();
      return;
    }
    if (action === "open-lesson") return navigateLesson(button.dataset.lessonId);
    if (action === "select-skill") {
      selectedMasterySkill = selectedMasterySkill === button.dataset.skillId ? "" : button.dataset.skillId;
      return render();
    }
    if (action === "add-passport") {
      syncPassport(button.dataset.skillId);
      activeView = "passport";
      return render();
    }
    if (action === "sync-passport") {
      syncPassport();
      return render();
    }
    if (action === "practice-skill") {
      const state = store.get();
      const skillId = button.dataset.skillId;
      const lesson = core().lessons.find((item) => item.trackId === state.profile.career && item.skills.includes(skillId) && state.progress?.[item.id]?.status !== "completed")
        || recommendedLesson(state);
      return navigateLesson(lesson?.id);
    }
  }

  function onSubmit(event) {
    const form = event.target?.closest?.("[data-learning-profile-form]");
    if (!form) return;
    event.preventDefault?.();
    const data = new FormData(form);
    const selectedSkills = data.getAll("focusSkills").map(String).filter((id) => core().skills.some((skill) => skill.id === id)).slice(0, 4);
    const career = core().tracks.some((track) => track.id === data.get("career")) ? String(data.get("career")) : store.get().profile.career;
    pathTrackId = career;
    activeView = "paths";
    statusMessage = "Lộ trình cá nhân đã được tạo và lưu.";
    store.update((state) => {
      state.profile = {
        ...state.profile,
        configured: true,
        goal: GOALS.some((goal) => goal.id === data.get("goal")) ? String(data.get("goal")) : state.profile.goal,
        level: core().levels.includes(data.get("level")) ? String(data.get("level")) : state.profile.level,
        dailyMinutes: core().clamp(data.get("dailyMinutes"), 5, 120),
        career,
        focusSkills: selectedSkills.length ? selectedSkills : trackById(career).focus,
        retentionGoal: [85, 90, 95].includes(Number(data.get("retentionGoal"))) ? Number(data.get("retentionGoal")) : 90
      };
      state.activeLessonId = recommendedLesson(state, career)?.id || `${career}-${state.profile.level.toLowerCase()}-01`;
      return state;
    });
    render();
  }

  function onInput(event) {
    const action = event.target?.dataset?.action;
    if (action === "career-search") {
      careerQuery = event.target.value;
      const query = cleanQuery(careerQuery);
      let visible = 0;
      activeHost?.querySelectorAll?.("[data-career-search]").forEach((item) => {
        item.hidden = Boolean(query && !String(item.dataset.careerSearch || "").includes(query));
        if (!item.hidden) visible += 1;
      });
      const empty = activeHost?.querySelector?.("[data-career-empty]");
      if (empty) empty.hidden = visible > 0;
    }
    if (action === "track-select") {
      pathTrackId = event.target.value;
      render();
    }
  }

  function mount(host, options = {}) {
    if (!host || typeof host.innerHTML !== "string") throw new TypeError("HHLearningPaths.mount cần một host hợp lệ.");
    unmount();
    activeHost = host;
    activeOptions = options || {};
    activeView = supports(options.view) ? options.view : "profile";
    store = getStore(options);
    pathTrackId = options.trackId || store.get().profile.career;
    selectedMasterySkill = options.skillId || "";
    careerQuery = "";
    statusMessage = "";
    clickHandler = onClick;
    submitHandler = onSubmit;
    inputHandler = onInput;
    host.addEventListener?.("click", clickHandler);
    host.addEventListener?.("submit", submitHandler);
    host.addEventListener?.("input", inputHandler);
    host.addEventListener?.("change", inputHandler);
    unsubscribe = store.subscribe(() => render());
    render();
    return Object.freeze({
      get view() { return activeView; },
      getState: () => store.get(),
      unmount
    });
  }

  function unmount() {
    unsubscribe?.();
    unsubscribe = null;
    if (activeHost) {
      if (clickHandler) activeHost.removeEventListener?.("click", clickHandler);
      if (submitHandler) activeHost.removeEventListener?.("submit", submitHandler);
      if (inputHandler) {
        activeHost.removeEventListener?.("input", inputHandler);
        activeHost.removeEventListener?.("change", inputHandler);
      }
      activeHost.innerHTML = "";
    }
    activeHost = null;
    activeOptions = {};
    clickHandler = null;
    submitHandler = null;
    inputHandler = null;
    return true;
  }

  root.HHLearningPaths = Object.freeze({ supports, mount, unmount });
  if (typeof module !== "undefined" && module.exports) module.exports = root.HHLearningPaths;
})();
