(function (factory) {
  "use strict";

  const scope = typeof window !== "undefined" ? window : globalThis;
  let core = scope.HHLearningCore;
  if (!core && typeof module !== "undefined" && module.exports) core = require("./learning-platform-core.js");
  const api = factory(scope, core);
  scope.HHLearningHome = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(function createLearningHome(scope, core) {
  "use strict";

  const VIEWS = new Set(["home", "dashboard"]);
  const instances = new WeakMap();
  const ROUTE_ALIASES = Object.freeze({
    "lesson-player": "lesson",
    "smart-review": "review",
    "quick-test": "assessments",
    "skill-graph": "mastery",
    classroom: "classroom"
  });
  const SUBJECT_COLORS = Object.freeze({
    communication: "#37b7a5", ielts: "#6f87dc", toeic: "#cf8b48", vstep: "#9a76cf",
    technology: "#438fc7", design: "#c7689d", media: "#b26a6a", marketing: "#d77c50",
    business: "#4b9b76", hospitality: "#d29a46", healthcare: "#4ca28f", engineering: "#6a8eb8",
    finance: "#5f9c65", logistics: "#a98255", interview: "#8973bd", academic: "#597fbd"
  });

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

  function supports(view) {
    return VIEWS.has(String(view || "").trim().toLowerCase());
  }

  function localDayKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function weekSummary(state, now = new Date()) {
    const sessions = Array.isArray(state.sessions) ? state.sessions : [];
    const formatter = new Intl.DateTimeFormat("vi-VN", { weekday: "short" });
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const key = localDayKey(date);
      const minutes = sessions.reduce((total, session) => localDayKey(session.createdAt) === key
        ? total + clamp(session.minutes, 0, 480)
        : total, 0);
      return { key, minutes, label: formatter.format(date).replace("Th ", "T"), isToday: key === localDayKey(now) };
    });
    const minutes = days.reduce((total, day) => total + day.minutes, 0);
    const target = clamp(state.profile?.dailyMinutes, 5, 120) * 7;
    return { days, minutes, target, percent: target ? clamp(Math.round(minutes / target * 100), 0, 100) : 0 };
  }

  function deadlineText(deadline, now = Date.now()) {
    if (!deadline) return "Chưa có deadline sắp tới";
    const due = Date.parse(deadline.dueAt);
    if (!Number.isFinite(due)) return "Chưa xác định thời hạn";
    const days = Math.ceil((due - now) / 86_400_000);
    if (days < 0) return `Quá hạn ${Math.abs(days)} ngày`;
    if (days === 0) return "Đến hạn hôm nay";
    if (days === 1) return "Đến hạn ngày mai";
    return `Còn ${days} ngày`;
  }

  function deadlineDate(deadline) {
    const date = new Date(deadline?.dueAt);
    if (Number.isNaN(date.getTime())) return "Chưa rõ";
    return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "short" }).format(date);
  }

  function todayGoal(state, now = Date.now()) {
    const targetMinutes = clamp(state.profile?.dailyMinutes, 5, 120);
    const today = typeof core.dayKey === "function" ? core.dayKey(now) : localDayKey(now);
    const completedMinutes = state.daily?.date === today ? clamp(state.daily?.minutes, 0, 1440) : 0;
    return {
      targetMinutes,
      completedMinutes,
      percent: clamp(Math.round(completedMinutes / targetMinutes * 100), 0, 100)
    };
  }

  function masteryLabel(item) {
    if (!item || !item.attempts) return "Chưa có dữ liệu đánh giá";
    return ({ new: "Đang làm quen", familiar: "Đã hiểu", mastered: "Thành thạo", review: "Cần ôn lại" })[item.state] || "Đang làm quen";
  }

  function render(instance) {
    const state = instance.store.get();
    const plan = core.buildDailyPlan(state);
    const goal = todayGoal(state);
    const week = weekSummary(state);
    const track = core.tracks.find((item) => item.id === state.profile.career);
    const accent = SUBJECT_COLORS[state.profile.career] || "#37b7a5";
    const lesson = plan.continueLesson;
    const lessonProgress = lesson ? state.progress?.[lesson.id] : null;
    const lessonPercent = lessonProgress?.status === "completed" ? 100
      : lessonProgress?.seconds && lesson ? clamp(Math.round(lessonProgress.seconds / (lesson.minutes * 60) * 100), 0, 99) : 0;
    const deadline = plan.upcomingDeadline;
    const reviews = plan.reviewsDue.slice(0, 3);
    const weak = plan.weakSkills.slice(0, 3);
    const streakCount = clamp(plan.streak?.count, 0, 100000);

    instance.host.innerHTML = `<section class="hlh" style="--hlh-accent:${accent}" aria-labelledby="hlh-title">
      <header class="hlh-head">
        <div>
          <span class="hlh-eyebrow">HH LEARNING · ${escapeHtml(state.profile.level)}</span>
          <h2 id="hlh-title">Hôm nay học gì?</h2>
          <p>${escapeHtml(track?.title || "Lộ trình cá nhân")} · Mỗi bước ngắn, rõ và đúng mục tiêu của bạn.</p>
        </div>
        <div class="hlh-streak" aria-label="Chuỗi học ${streakCount} ngày">
          <span aria-hidden="true">✦</span><strong>${streakCount}</strong><small>ngày liên tiếp</small>
        </div>
      </header>

      <div class="hlh-primary-grid">
        <article class="hlh-card hlh-continue">
          <div class="hlh-card-head"><span class="hlh-card-icon" aria-hidden="true">▶</span><span>Tiếp tục bài đang học</span></div>
          ${lesson ? `<h3>${escapeHtml(lesson.title)}</h3>
            <p>${escapeHtml(lesson.description)}</p>
            <div class="hlh-meta"><span>${lesson.minutes} phút</span><span>${escapeHtml(lesson.level)}</span><span>${lesson.xp} XP</span></div>
            <div class="hlh-progress" role="progressbar" aria-label="Tiến độ bài học" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${lessonPercent}"><i style="width:${lessonPercent}%"></i></div>
            <div class="hlh-card-footer"><small>${lessonPercent ? `Đã hoàn thành ${lessonPercent}%` : "Chưa bắt đầu"}</small><button type="button" data-hlh-action="continue">${lessonPercent ? "Học tiếp" : "Bắt đầu"}</button></div>`
          : `<div class="hlh-empty"><strong>Chưa có bài học phù hợp</strong><p>Hãy hoàn tất hồ sơ lộ trình để hệ thống chọn bài học.</p></div>`}
        </article>

        <article class="hlh-card hlh-review">
          <div class="hlh-card-head"><span class="hlh-card-icon" aria-hidden="true">↻</span><span>Ôn tập hôm nay</span><strong>${plan.reviewsDue.length}</strong></div>
          ${reviews.length ? `<ul>${reviews.map((review) => `<li><span>${escapeHtml(review.prompt)}</span><small>${escapeHtml(core.skills.find((skill) => skill.id === review.skillId)?.label || "Kiến thức")}</small></li>`).join("")}</ul>
            <button type="button" data-hlh-action="review">Ôn ${plan.reviewsDue.length} thẻ</button>`
          : `<div class="hlh-empty"><strong>Chưa có thẻ đến hạn</strong><p>Các thẻ sẽ xuất hiện theo lịch ghi nhớ của bạn.</p></div><button type="button" class="is-secondary" data-hlh-action="review">Xem lịch ôn</button>`}
        </article>

        <article class="hlh-card hlh-quiz">
          <div class="hlh-card-head"><span class="hlh-card-icon" aria-hidden="true">✓</span><span>Kiểm tra nhanh</span></div>
          <h3>${escapeHtml(plan.quickTest.title)}</h3>
          <p>${plan.quickTest.questions} câu · khoảng ${plan.quickTest.minutes} phút · điều chỉnh theo kỹ năng ưu tiên.</p>
          <button type="button" data-hlh-action="quick-test">Làm kiểm tra</button>
        </article>
      </div>

      <div class="hlh-insight-grid">
        <article class="hlh-card hlh-goal">
          <div class="hlh-card-head"><span>Mục tiêu hôm nay</span><strong>${goal.completedMinutes}/${goal.targetMinutes} phút</strong></div>
          <div class="hlh-goal-ring" style="--value:${goal.percent}" role="progressbar" aria-label="Mục tiêu học hôm nay" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${goal.percent}"><span>${goal.percent}%</span></div>
          <div class="hlh-stepper" aria-label="Điều chỉnh mục tiêu phút"><button type="button" data-hlh-action="goal-down" aria-label="Giảm mục tiêu 5 phút" ${goal.targetMinutes <= 5 ? "disabled" : ""}>−</button><span>${goal.targetMinutes} phút/ngày</span><button type="button" data-hlh-action="goal-up" aria-label="Tăng mục tiêu 5 phút" ${goal.targetMinutes >= 120 ? "disabled" : ""}>+</button></div>
        </article>

        <article class="hlh-card hlh-week">
          <div class="hlh-card-head"><span>Tiến độ tuần</span><strong>${week.minutes}/${week.target} phút</strong></div>
          <div class="hlh-heatmap" aria-label="Thời gian học trong 7 ngày gần nhất">${week.days.map((day) => `<div class="${day.isToday ? "is-today" : ""}"><i style="--level:${Math.round(12 + clamp(day.minutes / Math.max(state.profile.dailyMinutes, 1), 0, 1) * 78)}%" title="${escapeHtml(day.label)}: ${day.minutes} phút"></i><span>${escapeHtml(day.label)}</span><small>${day.minutes}</small></div>`).join("")}</div>
          <div class="hlh-progress" role="progressbar" aria-label="Tiến độ mục tiêu tuần" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${week.percent}"><i style="width:${week.percent}%"></i></div>
        </article>

        <article class="hlh-card hlh-weak">
          <div class="hlh-card-head"><span>Kỹ năng cần chú ý</span></div>
          <ul>${weak.map((item) => {
            const skill = core.skills.find((entry) => entry.id === item.skillId);
            return `<li><button type="button" data-hlh-action="skill" data-skill-id="${escapeHtml(item.skillId)}"><i style="--skill:${escapeHtml(skill?.color || accent)}"></i><span><strong>${escapeHtml(skill?.label || item.skillId)}</strong><small>${escapeHtml(masteryLabel(item))}</small></span><b>${item.attempts ? `${item.score}%` : "—"}</b></button></li>`;
          }).join("")}</ul>
        </article>

        <article class="hlh-card hlh-deadline">
          <div class="hlh-card-head"><span>Lịch học & deadline</span></div>
          ${deadline ? `<time datetime="${escapeHtml(deadline.dueAt)}">${escapeHtml(deadlineDate(deadline))}</time><div><h3>${escapeHtml(deadline.title)}</h3><p>${escapeHtml(deadlineText(deadline))}</p></div><button type="button" data-hlh-action="deadline" data-deadline-id="${escapeHtml(deadline.id)}" aria-label="Mở ${escapeHtml(deadline.title)}">Mở</button>`
          : `<div class="hlh-empty"><strong>Lịch đang trống</strong><p>Deadline của lớp và bài học sẽ xuất hiện tại đây.</p></div>`}
        </article>
      </div>
      <p class="hlh-status" role="status" aria-live="polite"></p>
    </section>`;
  }

  function announce(instance, message) {
    const status = instance.host.querySelector?.(".hlh-status");
    if (status) status.textContent = message;
  }

  function navigate(instance, view, detail = {}, message = "Đang mở không gian học tập.") {
    announce(instance, message);
    if (typeof instance.onNavigate === "function") {
      instance.onNavigate(view, detail);
      return;
    }
    try {
      scope.dispatchEvent?.(new scope.CustomEvent("hh:learning:navigate", { detail: { view, ...detail } }));
    } catch {}
    if (scope.location) scope.location.hash = `#/learn/${ROUTE_ALIASES[view] || view}`;
  }

  function handleClick(instance, event) {
    const button = event.target?.closest?.("[data-hlh-action]");
    if (!button || !instance.host.contains?.(button)) return;
    const action = button.dataset.hlhAction;
    const state = instance.store.get();
    const plan = core.buildDailyPlan(state);
    if (action === "continue" && plan.continueLesson) {
      instance.store.update((draft) => {
        draft.activeLessonId = plan.continueLesson.id;
        return draft;
      });
      navigate(instance, "lesson-player", { lessonId: plan.continueLesson.id }, `Đang mở bài ${plan.continueLesson.title}.`);
    } else if (action === "review") navigate(instance, "smart-review", { dueCount: plan.reviewsDue.length }, "Đang mở lịch ôn tập hôm nay.");
    else if (action === "quick-test") navigate(instance, "quick-test", { level: state.profile.level, skills: plan.quickTest.skills }, "Đang chuẩn bị bài kiểm tra nhanh.");
    else if (action === "skill") navigate(instance, "skill-graph", { skillId: button.dataset.skillId || "" }, "Đang mở biểu đồ kỹ năng.");
    else if (action === "deadline") navigate(instance, "classroom", { deadlineId: button.dataset.deadlineId || "" }, "Đang mở lịch học và deadline.");
    else if (action === "goal-down" || action === "goal-up") {
      const change = action === "goal-up" ? 5 : -5;
      instance.store.update((draft) => {
        draft.profile.dailyMinutes = clamp((draft.profile.dailyMinutes || 15) + change, 5, 120);
        return draft;
      });
      announce(instance, `Đã lưu mục tiêu ${instance.store.get().profile.dailyMinutes} phút mỗi ngày.`);
    }
  }

  function validStore(store) {
    return store && typeof store.get === "function" && typeof store.update === "function" && typeof store.subscribe === "function";
  }

  function unmount(host) {
    const instance = host && instances.get(host);
    if (!instance) return false;
    instance.host.removeEventListener("click", instance.onClick);
    instance.unsubscribe?.();
    instance.host.innerHTML = "";
    instances.delete(host);
    return true;
  }

  function mount(host, options = {}) {
    if (!host || typeof host.addEventListener !== "function") throw new TypeError("Learning Home cần một host DOM hợp lệ.");
    if (!core?.buildDailyPlan || !core?.createStore) throw new Error("HHLearningCore chưa sẵn sàng.");
    unmount(host);
    const store = validStore(options.store) ? options.store : core.createStore(scope.localStorage);
    const instance = { host, store, onNavigate: options.onNavigate };
    instance.onClick = (event) => handleClick(instance, event);
    instance.unsubscribe = store.subscribe(() => render(instance));
    host.addEventListener("click", instance.onClick);
    instances.set(host, instance);
    render(instance);
    return Object.freeze({ view: supports(options.view) ? String(options.view).toLowerCase() : "home", unmount: () => unmount(host), refresh: () => render(instance) });
  }

  return Object.freeze({ supports, mount, unmount });
});
