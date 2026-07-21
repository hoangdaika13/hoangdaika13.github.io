(() => {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  const VIEW_META = Object.freeze({
    home: { title: "Learning Home", label: "Hôm nay", icon: "⌂", engine: "HHLearningHome" },
    dashboard: { title: "Learning Home", label: "Hôm nay", icon: "⌂", engine: "HHLearningHome" },
    "learning-center": { title: "Learning Home", label: "Hôm nay", icon: "⌂", engine: "HHLearningHome" },
    profile: { title: "Hồ sơ học tập", label: "Hồ sơ", icon: "◎", engine: "HHLearningPaths" },
    paths: { title: "Lộ trình cá nhân", label: "Lộ trình", icon: "↗", engine: "HHLearningPaths" },
    mastery: { title: "Skill Graph & Mastery", label: "Kỹ năng", icon: "◇", engine: "HHLearningPaths" },
    passport: { title: "Learning Passport", label: "Passport", icon: "▣", engine: "HHLearningPaths" },
    review: { title: "Smart Review", label: "Ôn tập", icon: "↻", engine: "HHLearningReview" },
    mistakes: { title: "Mistake Notebook", label: "Lỗi sai", icon: "!", engine: "HHLearningReview" },
    vocabulary: { title: "Sổ từ vựng", label: "Từ vựng", icon: "A", engine: "HHLearningReview" },
    lesson: { title: "Lesson Player", label: "Bài học", icon: "▶", engine: "HHLearningLessonPlayer" },
    "lesson-player": { title: "Lesson Player", label: "Bài học", icon: "▶", engine: "HHLearningLessonPlayer" },
    coach: { title: "AI Learning Coach", label: "AI Coach", icon: "✦", engine: "HHLearningCoachLabs" },
    speaking: { title: "Speaking Lab", label: "Luyện nói", icon: "◉", engine: "HHLearningCoachLabs" },
    listening: { title: "Listening Lab", label: "Luyện nghe", icon: "♫", engine: "HHLearningCoachLabs" },
    writing: { title: "Writing Studio", label: "Luyện viết", icon: "T", engine: "HHLearningCoachLabs" },
    "career-simulator": { title: "Career Simulator", label: "Nghề nghiệp", icon: "□", engine: "HHLearningCoachLabs" },
    assessments: { title: "Kiểm tra & thử thách", label: "Kiểm tra", icon: "✓", engine: "HHLearningClassroom" },
    certificates: { title: "Chứng chỉ HH", label: "Chứng chỉ", icon: "◆", engine: "HHLearningClassroom" },
    classroom: { title: "Classroom", label: "Lớp học", icon: "▤", engine: "HHLearningClassroom" },
    "study-together": { title: "Study Together", label: "Học nhóm", icon: "∞", engine: "HHLearningClassroom" },
    "catch-up": { title: "Smart Catch-up", label: "Bắt kịp", icon: "↺", engine: "HHLearningClassroom" },
    "smart-catch-up": { title: "Smart Catch-up", label: "Bắt kịp", icon: "↺", engine: "HHLearningClassroom" }
  });
  const VIEW_ALIASES = Object.freeze({
    "smart-review": "review",
    "quick-test": "assessments",
    "skill-graph": "mastery",
    "smart-catch-up": "catch-up"
  });

  const PRIMARY_VIEWS = ["home", "paths", "review", "lesson", "coach", "speaking", "assessments", "classroom", "study-together"];
  let current = null;
  let currentHost = null;
  let unsubscribe = null;
  let listeners = [];

  const safe = (value) => String(value ?? "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]);
  const normalize = (view) => {
    const requested = String(view || "home").toLowerCase();
    const resolved = VIEW_ALIASES[requested] || requested;
    return VIEW_META[resolved] ? resolved : "home";
  };
  const supports = (view) => {
    const requested = String(view || "home").toLowerCase();
    return Boolean(VIEW_META[VIEW_ALIASES[requested] || requested]);
  };
  const navigate = (view) => { if (supports(view)) location.hash = `#/learn/${normalize(view)}`; };

  function learningStore() {
    if (!root.HHLearningStore && root.HHLearningCore?.createStore) root.HHLearningStore = root.HHLearningCore.createStore();
    return root.HHLearningStore || null;
  }

  function updateStatus(host, store) {
    const state = store?.get?.();
    const plan = state && root.HHLearningCore?.buildDailyPlan?.(state);
    const progress = host.querySelector("[data-learning-suite-progress]");
    const streak = host.querySelector("[data-learning-suite-streak]");
    const level = host.querySelector("[data-learning-suite-level]");
    if (progress) progress.textContent = `${plan?.goal?.completedMinutes || 0}/${plan?.goal?.targetMinutes || 15} phút`;
    if (streak) streak.textContent = `${state?.streak?.count || 0} ngày`;
    if (level) level.textContent = `${state?.profile?.level || "A0"} · ${state?.profile?.configured ? "Cá nhân hóa" : "Cần thiết lập"}`;
  }

  function bindEvents() {
    const onNavigate = (event) => navigate(event.detail?.view);
    const onOpenLesson = (event) => {
      const lessonId = String(event.detail?.lessonId || "");
      const store = learningStore();
      if (lessonId && root.HHLearningCore?.lessons?.some((lesson) => lesson.id === lessonId)) store?.update?.((state) => { state.activeLessonId = lessonId; return state; });
      navigate("lesson");
    };
    [["hh:learning:navigate", onNavigate], ["hh:learning:open-lesson", onOpenLesson]].forEach(([name, handler]) => {
      root.addEventListener?.(name, handler);
      listeners.push([name, handler]);
    });
  }

  function fallback(host, view) {
    const meta = VIEW_META[view];
    host.innerHTML = `<section class="learning-suite-fallback" role="status"><span>${safe(meta.icon)}</span><div><small>LEARNING ENGINE</small><h2>${safe(meta.title)}</h2><p>Workspace đang được tải. Dữ liệu học tập vẫn được giữ trong Learning Core trên thiết bị.</p></div><button type="button" data-learning-retry>Thử lại</button></section>`;
    host.querySelector("[data-learning-retry]")?.addEventListener("click", () => location.reload());
  }

  function mount(host, options = {}) {
    if (!host) throw new Error("Learning Suite requires a host element.");
    unmount();
    currentHost = host;
    bindEvents();
    const view = normalize(options.view);
    const meta = VIEW_META[view];
    const store = options.store || learningStore();
    host.innerHTML = `<section class="learning-suite" data-learning-suite data-view="${safe(view)}">
      <header class="learning-suite-head">
        <div class="learning-suite-brand"><i>HH</i><div><small>HH LEARNING OS</small><strong>${safe(meta.title)}</strong><span data-learning-suite-level>A0 · Cần thiết lập</span></div></div>
        <nav aria-label="Không gian học tập chính">${PRIMARY_VIEWS.map((id) => { const item = VIEW_META[id]; return `<button type="button" data-app-route="/learn/${id}" ${id === view || (view === "dashboard" && id === "home") || (view === "learning-center" && id === "home") ? 'aria-current="page"' : ""}><i>${safe(item.icon)}</i><span>${safe(item.label)}</span></button>`; }).join("")}</nav>
        <div class="learning-suite-stats"><span><small>Hôm nay</small><b data-learning-suite-progress>0/15 phút</b></span><span><small>Streak</small><b data-learning-suite-streak>0 ngày</b></span><button type="button" data-app-route="/learn/passport">Passport</button></div>
      </header>
      <div class="learning-suite-host" data-learning-engine-host></div>
    </section>`;
    const engineHost = host.querySelector("[data-learning-engine-host]");
    const engine = root[meta.engine];
    if (engine?.mount && (!engine.supports || engine.supports(view))) {
      const engineOptions = {
        ...options,
        view,
        core: root.HHLearningCore,
        onNavigate: navigate,
        onOpenLesson: (lessonId) => root.dispatchEvent?.(new CustomEvent("hh:learning:open-lesson", { detail: { lessonId } }))
      };
      // Classroom has assignments, submissions and whiteboard state with its own schema.
      // The shared Learning Core store remains the source for progress shown by the shell.
      if (meta.engine === "HHLearningClassroom") delete engineOptions.store;
      else engineOptions.store = store;
      const controller = engine.mount(engineHost, engineOptions);
      current = { engine, host: engineHost, controller };
    } else fallback(engineHost, view);
    updateStatus(host, store);
    unsubscribe = store?.subscribe?.(() => updateStatus(host, store)) || null;
  }

  function unmount() {
    unsubscribe?.();
    unsubscribe = null;
    if (current) {
      if (typeof current.controller?.unmount === "function") current.controller.unmount();
      else if (typeof current.controller?.destroy === "function") current.controller.destroy();
      else current.engine?.unmount?.(current.host);
    }
    current = null;
    listeners.forEach(([name, handler]) => root.removeEventListener?.(name, handler));
    listeners = [];
    if (currentHost) currentHost.replaceChildren();
    currentHost = null;
  }

  root.HHLearningSuite = Object.freeze({ mount, unmount, supports, views: VIEW_META, getStore: learningStore });
  if (typeof module !== "undefined" && module.exports) module.exports = root.HHLearningSuite;
})();
