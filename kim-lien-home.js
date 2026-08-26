(function initHHKimLienHome(global) {
  "use strict";

  const HOME_KEY = "hh.kim-lien.home.v1:guest";
  const PHAT_PREFIX = "hh.phat-phap.study.v1";
  const LESSON_TOTAL = 10;
  const ROUTES = Object.freeze([
    ["teachings", "Giáo lý", "Nền tảng Phật học được trình bày rõ ràng, có nguồn và gợi ý thực hành.", "☸", "/phat-phap/teachings"],
    ["scriptures", "Kinh điển", "Đọc, đánh dấu, ghi chú và đối chiếu bản kinh theo hồ sơ nguồn.", "▤", "/phat-phap/scriptures"],
    ["practice", "Thiền tập", "Thiền đường số với hẹn giờ, chuông nhẹ và hướng dẫn an toàn.", "禪", "/phat-phap/practice"],
    ["chanting", "Niệm Phật", "Không gian tụng niệm trang nghiêm, tốc độ đọc và cỡ chữ tùy chỉnh.", "◉", "/phat-phap/chanting"],
    ["temple", "Đi chùa online", "Tra cứu cơ sở Phật giáo và mở chương trình tại nguồn chính thức.", "寺", "/phat-phap/temple"],
    ["talks", "Pháp thoại", "Tìm pháp thoại theo chủ đề, người giảng và quyền sử dụng minh bạch.", "聽", "/phat-phap/talks"],
    ["schedule", "Lịch tu học", "Lập thời khóa vừa sức, theo dõi buổi học và xuất lịch cá nhân.", "曆", "/phat-phap/schedule"],
    ["beginner", "Người mới bắt đầu", "Lộ trình từng bước từ Tam Bảo, Tứ Diệu Đế đến thực hành hằng ngày.", "路", "/phat-phap/beginner"]
  ]);
  const REMINDERS = Object.freeze([
    "Giữ thân ngay thẳng, giữ lời chân thật và dành một khoảng lặng để thấy rõ tâm mình.",
    "Học một điều vừa đủ, thực hành một việc thật và đối xử với mình bằng lòng từ.",
    "Trước khi phản ứng, hãy dừng lại một hơi thở và nhìn rõ điều đang có mặt.",
    "Sự đều đặn nhỏ mỗi ngày bền hơn một thời khóa lớn nhưng không thể duy trì.",
    "Lắng nghe để hiểu, nói khi lời nói chân thật, đúng lúc và có ích.",
    "Không chạy theo thành tích tu học; hãy nhận biết điều đã chuyển hóa trong đời sống.",
    "Tâm an không phải vì mọi việc đều thuận, mà vì ta biết trở về với hiện tại."
  ]);

  let host = null;
  let timerId = 0;
  let remaining = 15 * 60;
  let running = false;
  let owner = "guest";
  let cleanup = [];

  const safe = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const localDayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const accountKey = (user = {}) => String(user.id || user._id || user.email || "guest").toLowerCase().replace(/[^a-z0-9@._-]/g, "-").slice(0, 96) || "guest";
  const homeStorageKey = () => `hh.kim-lien.home.v1:${owner}`;
  const phatStorageKey = () => `${PHAT_PREFIX}:${owner}`;
  const readJson = (key, fallback) => {
    try { const value = JSON.parse(localStorage.getItem(key) || "null"); return value && typeof value === "object" ? value : fallback; }
    catch { return fallback; }
  };
  const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const todayIndex = () => {
    const start = new Date(new Date().getFullYear(), 0, 0);
    return Math.floor((new Date() - start) / 86400000) % REMINDERS.length;
  };
  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return "Chào buổi sáng, Phật tử an lạc";
    if (hour < 18) return "Chúc một ngày tỉnh thức và an lành";
    return "Buổi tối an trú trong chánh niệm";
  };
  const timeText = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  function readStudy() {
    const state = readJson(phatStorageKey(), {});
    return {
      completed: Array.isArray(state.completedLessons) ? state.completedLessons.length : 0,
      practices: Array.isArray(state.practiceHistory) ? state.practiceHistory.length : 0,
      schedule: state.studySchedule && typeof state.studySchedule === "object" ? state.studySchedule : { minutes: 15, time: "20:00", program: 7 },
      routine: state.routineProgress && typeof state.routineProgress === "object" ? state.routineProgress : {},
      recentScripture: typeof state.recentScripture === "string" ? state.recentScripture : ""
    };
  }

  function todayChecklist() {
    const state = readJson(homeStorageKey(), { days: {}, sessions: 0, duration: 15 });
    const key = localDayKey();
    return { state, key, checked: Array.isArray(state.days?.[key]) ? state.days[key] : [] };
  }

  function render() {
    if (!host) return;
    const study = readStudy();
    const { state: home, key, checked } = todayChecklist();
    const progress = Math.min(100, Math.round((study.completed / LESSON_TOTAL) * 100));
    const dailyDone = checked.length;
    const date = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date());
    const reminder = REMINDERS[todayIndex()];
    remaining = Math.max(60, Math.min(3600, Number(home.duration || study.schedule.minutes || 15) * 60));

    host.className = "kim-lien-home";
    host.dataset.kimLienHome = "";
    host.innerHTML = `
      <section class="kl-home-hero" aria-labelledby="klHomeTitle">
        <div class="kl-home-hero__ornament" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <div class="kl-home-hero__copy">
          <p class="kl-kicker"><span>☸</span> ĐIỆN KIM LIÊN · ${safe(date)}</p>
          <h2 id="klHomeTitle">${safe(greeting())}</h2>
          <p class="kl-home-vow">Nam mô Bổn Sư Thích Ca Mâu Ni Phật</p>
          <blockquote><p>${safe(reminder)}</p><footer>Lời nhắc thực hành hôm nay · HH Phật Pháp</footer></blockquote>
          <div class="kl-home-hero__actions">
            <button class="kl-primary" type="button" data-app-route="/phat-phap/today">Bắt đầu thời khóa hôm nay <span>→</span></button>
            <button type="button" data-app-route="/phat-phap/beginner">Hướng dẫn người mới</button>
          </div>
          <dl class="kl-home-summary">
            <div><dt>${progress}%</dt><dd>Lộ trình nền tảng</dd></div>
            <div><dt>${study.completed}/${LESSON_TOTAL}</dt><dd>Bài đã hoàn thành</dd></div>
            <div><dt>${study.practices + Number(home.sessions || 0)}</dt><dd>Buổi thực hành</dd></div>
          </dl>
        </div>
        <figure class="kl-home-buddha">
          <span class="kl-home-buddha__halo" aria-hidden="true"></span>
          <img src="assets/phat-phap/duc-phat-hao-quang-v1.webp" width="1536" height="1024" loading="eager" decoding="async" alt="Tranh minh họa Đức Phật Thích Ca tọa thiền trong hào quang vàng">
          <figcaption>Hình minh họa nguyên bản của HH · Không đại diện một pho tượng cụ thể</figcaption>
        </figure>
      </section>

      <nav class="kl-quick-nav" aria-label="Chức năng Phật Pháp chính">
        ${ROUTES.slice(0, 6).map((item) => `<button type="button" data-app-route="${item[4]}"><i aria-hidden="true">${item[3]}</i><span>${item[1]}</span></button>`).join("")}
      </nav>

      <div class="kl-home-grid">
        <section class="kl-paper-card kl-today-card" aria-labelledby="klTodayTitle">
          <header><div><small>THỜI KHÓA HÔM NAY</small><h3 id="klTodayTitle">Ba việc vừa sức</h3></div><span>${dailyDone}/3</span></header>
          <div class="kl-checklist">
            ${[
              ["learn", "Học một bài giáo lý", "8–12 phút", "/phat-phap/teachings"],
              ["practice", "Ngồi yên và theo dõi hơi thở", `${Math.min(15, Number(study.schedule.minutes) || 10)} phút`, "/phat-phap/practice"],
              ["reflect", "Ghi lại một điều đã hiểu", "Không giới hạn", "/phat-phap/journal"]
            ].map(([id, title, meta, route]) => `<article class="${checked.includes(id) ? "is-done" : ""}"><label><input type="checkbox" data-kl-task="${id}" ${checked.includes(id) ? "checked" : ""}><span><strong>${title}</strong><small>${meta}</small></span></label><button type="button" data-app-route="${route}" aria-label="Mở ${title}">→</button></article>`).join("")}
          </div>
          <footer><span><i style="--value:${dailyDone / 3}"></i></span><p>${dailyDone === 3 ? "Thời khóa hôm nay đã hoàn thành. Hãy nghỉ ngơi, không cần làm quá sức." : "Tiến độ chỉ giúp ghi nhớ; không dùng để so sánh công đức."}</p></footer>
        </section>

        <section class="kl-paper-card kl-timer-card" aria-labelledby="klTimerTitle">
          <header><div><small>THIỀN TẬP · HẸN GIỜ</small><h3 id="klTimerTitle">Trở về với hơi thở</h3></div><span aria-hidden="true">禪</span></header>
          <output data-kl-timer aria-live="polite">${timeText(remaining)}</output>
          <div class="kl-timer-presets" aria-label="Chọn thời lượng thiền">
            ${[5, 10, 15, 30].map((value) => `<button type="button" data-kl-duration="${value}" class="${Math.round(remaining / 60) === value ? "is-active" : ""}">${value} phút</button>`).join("")}
          </div>
          <div class="kl-timer-actions"><button class="kl-primary" type="button" data-kl-timer-toggle>Bắt đầu</button><button type="button" data-kl-timer-reset>Đặt lại</button></div>
          <p>Chuông kết thúc dùng âm thanh trình duyệt sau khi bạn chủ động bắt đầu.</p>
        </section>

        <section class="kl-paper-card kl-progress-card" aria-labelledby="klProgressTitle">
          <header><div><small>LỘ TRÌNH TU HỌC</small><h3 id="klProgressTitle">Nền tảng cho người mới</h3></div><button type="button" data-app-route="/phat-phap/beginner">Xem lộ trình</button></header>
          <div class="kl-progress-body"><span class="kl-progress-ring" style="--progress:${progress}"><b>${progress}%</b><small>hoàn thành</small></span><ol><li class="${study.completed > 0 ? "is-done" : ""}"><i>1</i><span><strong>Nhập môn Phật pháp</strong><small>Hiểu Tam Bảo và mục đích tu học</small></span></li><li class="${study.completed >= 5 ? "is-done" : ""}"><i>2</i><span><strong>Giáo lý căn bản</strong><small>Tứ Diệu Đế và Bát Chánh Đạo</small></span></li><li class="${study.completed >= LESSON_TOTAL ? "is-done" : ""}"><i>3</i><span><strong>Đưa vào đời sống</strong><small>Thực hành đều đặn, có kiểm chứng</small></span></li></ol></div>
        </section>

        <section class="kl-paper-card kl-schedule-card" aria-labelledby="klScheduleTitle">
          <header><div><small>LỊCH TU HỌC CÁ NHÂN</small><h3 id="klScheduleTitle">Thời khóa sắp tới</h3></div><span>${safe(study.schedule.time || "20:00")}</span></header>
          <article><time>${safe(study.schedule.time || "20:00")}</time><div><strong>Thời khóa ${Number(study.schedule.program) || 7} ngày</strong><p>${Number(study.schedule.minutes) || 15} phút · lưu riêng trên thiết bị</p></div></article>
          <article><time>Chủ nhật</time><div><strong>Ôn lại điều đã học</strong><p>Xem ghi chú và những bài cần thực hành lại</p></div></article>
          <footer><button type="button" data-app-route="/phat-phap/schedule">Mở lịch tu học</button><button type="button" data-app-route="/phat-phap/temple">Trung tâm Phật sự</button></footer>
        </section>
      </div>

      <section class="kl-library" aria-labelledby="klLibraryTitle">
        <header><div><p class="kl-kicker"><span>✦</span> TOÀN BỘ TRUNG TÂM TU HỌC</p><h2 id="klLibraryTitle">Mỗi chức năng đều có phần giới thiệu dễ hiểu</h2><p>Chọn một không gian để học, thực hành hoặc tra cứu. Dữ liệu tiến trình được giữ nguyên theo tài khoản hiện tại.</p></div><button type="button" data-command-open>⌕ Tìm trong HH Phật Pháp</button></header>
        <div class="kl-library-grid">${ROUTES.map((item) => `<article><i aria-hidden="true">${item[3]}</i><div><h3>${item[1]}</h3><p>${item[2]}</p></div><button type="button" data-app-route="${item[4]}">Mở chức năng <span>→</span></button></article>`).join("")}</div>
      </section>

      <section class="kl-home-footer-note"><span aria-hidden="true">☸</span><p><strong>Học có nguồn · Thực hành có giới hạn · Dữ liệu ưu tiên riêng tư</strong>HH Phật Pháp không phán nghiệp, không hứa chữa bệnh và không thay thế tăng ni, bác sĩ hoặc chuyên gia phù hợp.</p><button type="button" data-app-route="/phat-phap/provenance">Trung tâm kiểm chứng</button></section>`;

    attachEvents(key);
  }

  function saveChecklist(key, checked) {
    const state = readJson(homeStorageKey(), { days: {}, sessions: 0, duration: 15 });
    state.days = state.days && typeof state.days === "object" ? state.days : {};
    state.days[key] = [...new Set(checked)].slice(0, 3);
    const keys = Object.keys(state.days).sort().slice(-31);
    state.days = Object.fromEntries(keys.map((day) => [day, state.days[day]]));
    writeJson(homeStorageKey(), state);
  }

  function updateTimer() {
    if (!host) return;
    const output = host.querySelector("[data-kl-timer]");
    const toggle = host.querySelector("[data-kl-timer-toggle]");
    if (output) output.textContent = timeText(remaining);
    if (toggle) toggle.textContent = running ? "Tạm dừng" : "Tiếp tục";
  }

  function bell() {
    try {
      const AudioContextClass = global.AudioContext || global.webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(528, context.currentTime);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.6);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(); oscillator.stop(context.currentTime + 1.7);
      oscillator.addEventListener("ended", () => context.close(), { once: true });
    } catch {}
  }

  function stopTimer() {
    running = false;
    global.clearInterval(timerId);
    timerId = 0;
    updateTimer();
  }

  function attachEvents(dayKey) {
    const onChange = (event) => {
      const task = event.target.closest?.("[data-kl-task]");
      if (!task) return;
      const values = [...host.querySelectorAll("[data-kl-task]:checked")].map((input) => input.dataset.klTask);
      saveChecklist(dayKey, values);
      task.closest("article")?.classList.toggle("is-done", task.checked);
      const counter = host.querySelector(".kl-today-card > header > span");
      if (counter) counter.textContent = `${values.length}/3`;
      const progress = host.querySelector(".kl-today-card > footer span i");
      if (progress) progress.style.setProperty("--value", String(values.length / 3));
    };
    const onClick = (event) => {
      const duration = event.target.closest?.("[data-kl-duration]");
      if (duration) {
        stopTimer();
        const minutes = Math.max(1, Math.min(60, Number(duration.dataset.klDuration) || 15));
        remaining = minutes * 60;
        const state = readJson(homeStorageKey(), { days: {}, sessions: 0, duration: 15 });
        state.duration = minutes; writeJson(homeStorageKey(), state);
        host.querySelectorAll("[data-kl-duration]").forEach((button) => button.classList.toggle("is-active", button === duration));
        updateTimer(); return;
      }
      if (event.target.closest?.("[data-kl-timer-toggle]")) {
        if (running) { stopTimer(); return; }
        running = true; updateTimer();
        timerId = global.setInterval(() => {
          remaining -= 1;
          if (remaining > 0) { updateTimer(); return; }
          stopTimer(); bell();
          const state = readJson(homeStorageKey(), { days: {}, sessions: 0, duration: 15 });
          state.sessions = Math.max(0, Number(state.sessions) || 0) + 1; writeJson(homeStorageKey(), state);
          const toggle = host?.querySelector("[data-kl-timer-toggle]"); if (toggle) toggle.textContent = "Đã hoàn thành";
        }, 1000);
        return;
      }
      if (event.target.closest?.("[data-kl-timer-reset]")) {
        const state = readJson(homeStorageKey(), { duration: 15 });
        stopTimer(); remaining = Math.max(60, Math.min(3600, Number(state.duration || 15) * 60)); updateTimer();
      }
    };
    host.addEventListener("change", onChange);
    host.addEventListener("click", onClick);
    cleanup.push(() => host?.removeEventListener("change", onChange), () => host?.removeEventListener("click", onClick));
  }

  function unmount() {
    stopTimer();
    cleanup.splice(0).forEach((fn) => { try { fn(); } catch {} });
    host = null;
  }

  function mount(target, options = {}) {
    if (!(target instanceof HTMLElement)) return false;
    unmount();
    host = target;
    owner = accountKey(options.currentUser || {});
    render();
    return true;
  }

  global.HHKimLienHome = Object.freeze({ mount, unmount, version: "1.0.0", routes: ROUTES.map((item) => item[4]) });
})(window);
