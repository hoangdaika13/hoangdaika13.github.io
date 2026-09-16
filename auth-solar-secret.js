(() => {
  "use strict";

  const gate = document.querySelector("#authGate");
  const galaxy = gate?.querySelector("[data-hh-galaxy]");
  if (!gate || !galaxy || galaxy.dataset.hhSolarSecretMounted === "true") return;

  const controller = new AbortController();
  const { signal } = controller;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
  const STORAGE_KEY = "hh.solar-secret.progress.v3";
  const LEGACY_STORAGE_KEY = "hh.solar-secret.progress.v2";
  const STAGE_COUNT = 20;

  const STAGES = Object.freeze([
    { kind: "idle", label: "ĐỪNG BẤM", message: "Một tín hiệu tò mò vừa thức giấc. Đây là easter egg an toàn và bạn có thể đóng bất cứ lúc nào.", hint: "Chạm vào nút để bắt đầu giải mã." },
    { kind: "aware", label: "CHẠM TÍN HIỆU", message: "Tín hiệu 01/20 · Mặt trời đã nhận biết con trỏ của bạn.", hint: "Vầng sáng đang phản hồi ngay tại vùng bí mật." },
    { kind: "shake", label: "ĐỪNG BẤM", message: "Tín hiệu 02/20 · Lõi mặt trời rung nhẹ… nhưng nó đã ghi nhớ.", hint: "Một cú chạm nữa sẽ làm tín hiệu rõ hơn." },
    { kind: "escape", label: "BẮT ĐƯỢC TÔI ĐI", message: "Tín hiệu 03/20 · Nút đã phát hiện ý định và chạy trốn.", hint: "Nút chỉ di chuyển trong vùng an toàn; bàn phím vẫn bấm được." },
    { kind: "eclipse", label: "GỌI ÁNH SÁNG", message: "Tín hiệu 04/20 · Nhật thực nhỏ lướt qua, để lộ một quỹ đạo lạ.", hint: "Ánh sáng sẽ trở lại sau cú chạm tiếp theo." },
    { kind: "red", label: "VẪN TIẾP TỤC", message: "Tín hiệu 05/20 · Cảnh báo đỏ vui: mức độ tò mò đang tăng cao.", hint: "Đây không phải cảnh báo hệ thống và không có dữ liệu nào được gửi đi." },
    { kind: "confirm", label: "XÁC NHẬN", message: "Tín hiệu 06/20 · Bạn thực sự muốn tiếp tục?", hint: "Chọn tiếp tục hoặc dừng an toàn." },
    { kind: "ufo", label: "THEO DÕI UFO", message: "Tín hiệu 07/20 · Một UFO vừa lướt qua quỹ đạo.", hint: "Theo dõi vệt sáng rồi chạm tiếp." },
    { kind: "orbit", label: "ĐẢO QUỸ ĐẠO", message: "Tín hiệu 08/20 · Quỹ đạo đảo chiều trong vài nhịp thở.", hint: "Các hành tinh khác vẫn giữ nguyên chức năng." },
    { kind: "glitch", label: "GIẢI NHIỄU", message: "Tín hiệu 09/20 · Nhiễu ngắn đã biến thành thông điệp mới.", hint: "Hologram đang tự căn chỉnh." },
    { kind: "rainbow", label: "MỞ PLASMA", message: "Tín hiệu 10/20 · Plasma cầu vồng lan quanh mặt trời.", hint: "Màu sắc chỉ là hiệu ứng thị giác cục bộ." },
    { kind: "hold", label: "GIỮ ĐỂ NẠP", message: "Tín hiệu 11/20 · Giữ nút một nhịp để nạp năng lượng.", hint: "Giữ 0,9 giây; Enter hoặc Space là phương án tương đương.", holdMs: 900 },
    { kind: "meteor", label: "ĐI THEO SAO BĂNG", message: "Tín hiệu 12/20 · Sao băng nhiều lớp vẽ đường dẫn qua vùng tối.", hint: "Đường dẫn sẽ tự tắt sau một khoảnh khắc." },
    { kind: "hologram", label: "ĐỌC HOLOGRAM", message: "Tín hiệu 13/20 · Hologram trung tâm đã giải mã một nhịp sáng.", hint: "Di chuyển con trỏ hoặc dùng focus để soi lớp scanline." },
    { kind: "hover", label: "ĐÁNH THỨC BỤI SAO", message: "Tín hiệu 14/20 · Bụi sao đang phản ứng với sự hiện diện của bạn.", hint: "Hover, focus hoặc chạm đều có phản hồi tương đương." },
    { kind: "pulse", label: "PHÁT XUNG", message: "Tín hiệu 15/20 · Xung năng lượng lan nhẹ từ tâm mặt trời.", hint: "Không có hiệu ứng chớp mạnh." },
    { kind: "symbols", label: "KÍCH HOẠT BIỂU TƯỢNG", message: "Tín hiệu 16/20 · Mặt trời, UFO và Cổng không gian đã xuất hiện.", hint: "Ba biểu tượng sẽ thành chìa khóa cho câu đố tiếp theo." },
    { kind: "puzzle", label: "CĂN CHỈNH QUỸ ĐẠO", message: "Tín hiệu 17/20 · Đưa ba biểu tượng vào đúng quỹ đạo.", hint: "Kéo thả, chạm để đổi vị trí hoặc dùng phím mũi tên. Không giới hạn thời gian." },
    { kind: "choice", label: "CHỌN NHÁNH", message: "Tín hiệu 18/20 · Năm nhánh kết thúc đang chờ quyết định.", hint: "Kết thúc hiếm mở khi bốn nhánh đầu đã được khám phá." },
    { kind: "ending", label: "XEM TỔNG KẾT", message: "Tín hiệu 19/20 · Kết thúc đã được mở khóa.", hint: "Khám phá này chỉ được ghi cục bộ trên thiết bị." },
    { kind: "summary", label: "HOÀN THÀNH", message: "Tín hiệu 20/20 · Mật mã Mặt trời đã được giải.", hint: "Bạn có thể chơi lại hoặc thử một nhánh khác." }
  ].map(Object.freeze));

  const ENDINGS = Object.freeze({
    portal: Object.freeze({ title: "Cổng bí mật", glyph: "✦", message: "Bạn bước qua cổng không gian và mang về một mảnh tinh quang.", badge: "portal" }),
    orbit: Object.freeze({ title: "Người giữ quỹ đạo", glyph: "◌", message: "Bạn ở lại bảo vệ nhịp quay bình yên quanh mặt trời.", badge: "orbit" }),
    ufo: Object.freeze({ title: "Tín hiệu UFO", glyph: "⌁", message: "Bạn nhận được lời chào thân thiện từ một tín hiệu ngoài hành tinh.", badge: "ufo-ending" }),
    sleep: Object.freeze({ title: "Mặt trời ngủ", glyph: "☾", message: "Bạn hạ năng lượng, để mặt trời chìm vào một giấc ngủ êm.", badge: "sleep" }),
    merge: Object.freeze({ title: "Hợp nhất tín hiệu", glyph: "∞", message: "Năm tần số hòa làm một và mở ra kết thúc hiếm nhất.", badge: "merge" })
  });

  const BADGES = Object.freeze({
    curious: "Người tò mò đầu tiên",
    "ufo-hunter": "Thợ săn UFO",
    hologram: "Người đánh thức hologram",
    plasma: "Bậc thầy plasma",
    orbit: "Người giữ quỹ đạo",
    portal: "Kẻ mở cổng",
    "ufo-ending": "Người nhận tín hiệu",
    sleep: "Người ru mặt trời",
    merge: "Hợp nhất tinh quang",
    explorer: "Nhà thám hiểm đủ năm kết thúc"
  });

  const allowedEndings = Object.keys(ENDINGS);
  const allowedBadges = Object.keys(BADGES);
  let storageAvailable = true;
  const blankProgress = () => ({ bestStage: 0, endings: [], badges: [], replayCount: 0, lastDiscovered: "" });
  const normaliseProgress = (raw) => ({
    bestStage: Math.max(0, Math.min(STAGE_COUNT, Number(raw?.bestStage) || 0)),
    endings: Array.isArray(raw?.endings) ? [...new Set(raw.endings.filter((item) => allowedEndings.includes(item)))] : [],
    badges: Array.isArray(raw?.badges) ? [...new Set(raw.badges.filter((item) => allowedBadges.includes(item)))] : [],
    replayCount: Math.max(0, Math.min(9999, Number(raw?.replayCount) || 0)),
    lastDiscovered: typeof raw?.lastDiscovered === "string" ? raw.lastDiscovered.slice(0, 40) : ""
  });
  const readProgress = () => {
    try {
      const current = JSON.parse(window.localStorage?.getItem(STORAGE_KEY) || "null");
      if (current?.version === 3) return normaliseProgress(current);
      const legacy = JSON.parse(window.localStorage?.getItem(LEGACY_STORAGE_KEY) || "null");
      if (legacy?.version === 2) return normaliseProgress(legacy);
      window.localStorage?.setItem("hh.solar-secret.storage-check", "1");
      window.localStorage?.removeItem("hh.solar-secret.storage-check");
      return blankProgress();
    } catch {
      storageAvailable = false;
      return blankProgress();
    }
  };
  const progressState = readProgress();
  const saveProgress = () => {
    if (!storageAvailable) return false;
    try {
      window.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ version: 3, ...progressState }));
      return true;
    } catch {
      storageAvailable = false;
      return false;
    }
  };

  const makeMarkup = () => {
    const layer = document.createElement("div");
    layer.className = "hh-solar-secret-layer";
    layer.dataset.stage = "0";
    layer.dataset.motion = reducedMotion?.matches ? "static" : "cinematic";
    layer.innerHTML = `
      <button class="hh-solar-secret__sun-hit" type="button" data-solar-sun-hit aria-expanded="false" aria-label="Mở tín hiệu bí mật ở trung tâm mặt trời"></button>
      <section class="hh-solar-secret__panel" data-solar-panel tabindex="-1" aria-label="Tín hiệu bí mật của trung tâm mặt trời">
        <header class="hh-solar-secret__header">
          <div class="hh-solar-secret__eyebrow"><i></i><span data-solar-progress>MẬT MÃ MẶT TRỜI · 00 / ${STAGE_COUNT}</span><b data-solar-badge>Huy hiệu 0</b></div>
          <div class="hh-solar-secret__tools"><button type="button" data-solar-sound aria-pressed="false">Âm thanh: Tắt</button><button type="button" data-solar-journal-toggle aria-expanded="false">Nhật ký</button></div>
        </header>
        <div class="hh-solar-secret__volume" data-solar-volume-wrap hidden><label for="hhSolarVolume">Âm lượng</label><input id="hhSolarVolume" data-solar-volume type="range" min="0" max="100" value="20" aria-label="Âm lượng Solar Secret"></div>
        <progress class="hh-solar-secret__progressbar" data-solar-progressbar max="${STAGE_COUNT}" value="0" aria-label="Tiến trình Mật mã mặt trời"></progress>
        <p class="hh-solar-secret__message" data-solar-message aria-live="polite">Đang chờ một cú chạm tò mò…</p>
        <p class="hh-solar-secret__hint" data-solar-hint>Chạm vào nút để bắt đầu giải mã.</p>
        <div class="hh-solar-secret__symbols" data-solar-symbols hidden aria-label="Ba biểu tượng bí mật"><span aria-label="Mặt trời">☀</span><span aria-label="UFO">⌁</span><span aria-label="Cổng không gian">✦</span></div>
        <button class="hh-solar-secret__trigger" type="button" data-solar-trigger>ĐỪNG BẤM</button>
        <div class="hh-solar-secret__confirm" data-solar-confirm hidden role="group" aria-label="Xác nhận tiếp tục"><strong>Bạn thực sự muốn tiếp tục?</strong><div><button type="button" data-solar-continue>Tiếp tục</button><button type="button" data-solar-stop>Dừng lại</button></div></div>
        <section class="hh-solar-secret__puzzle" data-solar-puzzle hidden aria-label="Mini puzzle căn chỉnh quỹ đạo"><div class="hh-solar-secret__orbits" data-solar-orbits></div><p data-solar-puzzle-status aria-live="polite">Hãy căn chỉnh ba biểu tượng.</p><div><button type="button" data-solar-auto-solve>Giải tự động</button><button type="button" data-solar-puzzle-next disabled>Mở năm nhánh</button></div></section>
        <div class="hh-solar-secret__choices" data-solar-choices hidden role="group" aria-label="Chọn kết thúc">${Object.entries(ENDINGS).map(([id, ending]) => `<button type="button" data-solar-choice="${id}"><span>${ending.glyph}</span><strong>${ending.title}</strong><small>${id === "merge" ? "Mở sau bốn nhánh đầu" : "Khám phá kết thúc này"}</small></button>`).join("")}</div>
        <div class="hh-solar-secret__unlock" data-solar-unlock hidden role="status"><span class="hh-solar-secret__glyph" data-solar-ending-glyph aria-hidden="true">✦</span><div><strong data-solar-ending-title>HH SOLAR SECRET</strong><small data-solar-ending-copy>Không có dữ liệu nào được gửi đi.</small></div></div>
        <div class="hh-solar-secret__summary" data-solar-summary hidden><div><span>KHÁM PHÁ</span><strong data-solar-summary-stage>20 / 20</strong></div><div><span>KẾT THÚC</span><strong data-solar-summary-branch>Chưa chọn</strong></div><div><span>HUY HIỆU</span><strong data-solar-summary-badge>0</strong></div></div>
        <section class="hh-solar-secret__journal" data-solar-journal hidden aria-label="Nhật ký Mặt trời"><div class="hh-solar-secret__journal-grid"><div><span>Stage cao nhất</span><strong data-journal-stage>0 / 20</strong></div><div><span>Kết thúc</span><strong data-journal-endings>0 / 5</strong></div><div><span>Chơi lại</span><strong data-journal-replays>0</strong></div></div><p data-journal-time>Chưa có khám phá nào được ghi.</p><div class="hh-solar-secret__badges" data-journal-badges></div><small data-journal-storage>Tiến trình chỉ được lưu cục bộ trên thiết bị này.</small></section>
        <div class="hh-solar-secret__actions"><button class="hh-solar-secret__reset" type="button" data-solar-reset>Bắt đầu lại</button><button class="hh-solar-secret__branch-again" type="button" data-solar-branch-again hidden>Thử nhánh khác</button><button class="hh-solar-secret__replay" type="button" data-solar-replay hidden>Chơi lại</button><button class="hh-solar-secret__close" type="button" data-solar-close>Đóng tín hiệu</button></div>
      </section>
      <div class="hh-solar-secret__ufo" data-solar-ufo aria-hidden="true"></div><div class="hh-solar-secret__meteor" data-solar-meteor aria-hidden="true"></div><div class="hh-solar-secret__spark" data-solar-spark aria-hidden="true"></div>`;
    return layer;
  };

  const layer = makeMarkup();
  const redVeil = document.createElement("div");
  redVeil.className = "hh-solar-secret__red-veil";
  redVeil.setAttribute("aria-hidden", "true");
  redVeil.hidden = true;
  galaxy.append(layer);
  gate.append(redVeil);
  galaxy.dataset.hhSolarSecretMounted = "true";

  const find = (selector) => layer.querySelector(selector);
  const sunHit = find("[data-solar-sun-hit]");
  const panel = find("[data-solar-panel]");
  const trigger = find("[data-solar-trigger]");
  const progress = find("[data-solar-progress]");
  const progressBar = find("[data-solar-progressbar]");
  const badge = find("[data-solar-badge]");
  const message = find("[data-solar-message]");
  const hint = find("[data-solar-hint]");
  const confirmGroup = find("[data-solar-confirm]");
  const continueButton = find("[data-solar-continue]");
  const stopButton = find("[data-solar-stop]");
  const symbols = find("[data-solar-symbols]");
  const puzzle = find("[data-solar-puzzle]");
  const orbits = find("[data-solar-orbits]");
  const puzzleStatus = find("[data-solar-puzzle-status]");
  const autoSolve = find("[data-solar-auto-solve]");
  const puzzleNext = find("[data-solar-puzzle-next]");
  const choices = find("[data-solar-choices]");
  const unlock = find("[data-solar-unlock]");
  const endingGlyph = find("[data-solar-ending-glyph]");
  const endingTitle = find("[data-solar-ending-title]");
  const endingCopy = find("[data-solar-ending-copy]");
  const summary = find("[data-solar-summary]");
  const summaryStage = find("[data-solar-summary-stage]");
  const summaryBranch = find("[data-solar-summary-branch]");
  const summaryBadge = find("[data-solar-summary-badge]");
  const journal = find("[data-solar-journal]");
  const journalToggle = find("[data-solar-journal-toggle]");
  const soundToggle = find("[data-solar-sound]");
  const volumeWrap = find("[data-solar-volume-wrap]");
  const volume = find("[data-solar-volume]");
  const reset = find("[data-solar-reset]");
  const replay = find("[data-solar-replay]");
  const branchAgain = find("[data-solar-branch-again]");
  const close = find("[data-solar-close]");
  const ufo = find("[data-solar-ufo]");
  const meteor = find("[data-solar-meteor]");

  let stageIndex = 0;
  let confirmOpen = false;
  let complete = false;
  let outcome = "";
  let holdTimer = 0;
  let holdConsumed = false;
  let timingTimer = 0;
  let focusTimer = 0;
  let lastAdvanceAt = 0;
  let audioContext = null;
  let masterGain = null;
  let soundEnabled = false;
  const activeAudioNodes = new Set();
  const stageClasses = STAGES.map(({ kind }) => `is-stage-${kind}`);
  const puzzleGoal = Object.freeze({ sun: 1, ufo: 2, portal: 0 });
  let puzzlePositions = { sun: 0, ufo: 1, portal: 2 };
  let puzzleSolved = false;
  let draggedToken = "";

  const dispatch = (name, detail = {}) => layer.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
  const addUnique = (list, value) => { if (!list.includes(value)) list.push(value); };
  const unlockBadge = (id) => {
    if (!BADGES[id] || progressState.badges.includes(id)) return false;
    progressState.badges.push(id);
    return true;
  };
  const formatLocalTime = (value) => {
    if (!value) return "Chưa có khám phá nào được ghi.";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Chưa có khám phá nào được ghi.";
    return `Khám phá gần nhất: ${date.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}`;
  };
  const refreshJournal = () => {
    const stageNode = find("[data-journal-stage]");
    const endingsNode = find("[data-journal-endings]");
    const replaysNode = find("[data-journal-replays]");
    const timeNode = find("[data-journal-time]");
    const badgesNode = find("[data-journal-badges]");
    const storageNode = find("[data-journal-storage]");
    if (stageNode) stageNode.textContent = `${progressState.bestStage} / ${STAGE_COUNT}`;
    if (endingsNode) endingsNode.textContent = `${progressState.endings.length} / ${allowedEndings.length}`;
    if (replaysNode) replaysNode.textContent = String(progressState.replayCount);
    if (timeNode) timeNode.textContent = formatLocalTime(progressState.lastDiscovered);
    if (badgesNode) badgesNode.innerHTML = progressState.badges.length ? progressState.badges.map((id) => `<span title="${BADGES[id]}">✦ ${BADGES[id]}</span>`).join("") : "<em>Chưa mở khóa huy hiệu.</em>";
    if (storageNode) storageNode.textContent = storageAvailable ? "Tiến trình chỉ được lưu cục bộ trên thiết bị này." : "Tiến trình chưa được lưu vì bộ nhớ cục bộ đang bị chặn.";
  };
  const persistDiscovery = () => {
    progressState.bestStage = Math.max(progressState.bestStage, stageIndex);
    progressState.lastDiscovered = new Date().toISOString();
    if (progressState.endings.length === allowedEndings.length) unlockBadge("explorer");
    saveProgress();
    refreshJournal();
  };
  const recordStageBadges = (stage) => {
    if (stageIndex >= 1) unlockBadge("curious");
    if (stage.kind === "ufo") unlockBadge("ufo-hunter");
    if (stage.kind === "hologram") unlockBadge("hologram");
    progressState.bestStage = Math.max(progressState.bestStage, stageIndex);
    saveProgress();
    refreshJournal();
  };

  const stopAudioNodes = () => {
    activeAudioNodes.forEach((node) => {
      try { node.stop?.(); } catch { /* already ended */ }
      try { node.disconnect?.(); } catch { /* already disconnected */ }
    });
    activeAudioNodes.clear();
  };
  const closeAudio = () => {
    stopAudioNodes();
    const context = audioContext;
    audioContext = null;
    masterGain = null;
    soundEnabled = false;
    soundToggle?.setAttribute("aria-pressed", "false");
    if (soundToggle) soundToggle.textContent = "Âm thanh: Tắt";
    if (volumeWrap) volumeWrap.hidden = true;
    if (context && context.state !== "closed") context.close().catch(() => {});
  };
  const createAudio = async () => {
    const AudioEngine = window.AudioContext || window.webkitAudioContext;
    if (!AudioEngine) {
      if (soundToggle) { soundToggle.textContent = "Âm thanh: Không hỗ trợ"; soundToggle.disabled = true; }
      if (hint) hint.textContent = "Trình duyệt này không hỗ trợ Web Audio; trải nghiệm hình ảnh vẫn hoạt động đầy đủ.";
      return false;
    }
    try {
      audioContext = new AudioEngine();
      masterGain = audioContext.createGain();
      masterGain.gain.value = Number(volume?.value || 20) / 500;
      masterGain.connect(audioContext.destination);
      await audioContext.resume();
      soundEnabled = true;
      soundToggle?.setAttribute("aria-pressed", "true");
      if (soundToggle) soundToggle.textContent = "Âm thanh: Bật";
      if (volumeWrap) volumeWrap.hidden = false;
      return true;
    } catch {
      closeAudio();
      if (hint) hint.textContent = "Không thể khởi tạo âm thanh; trải nghiệm vẫn tiếp tục ở chế độ im lặng.";
      return false;
    }
  };
  const playTone = (index = stageIndex) => {
    if (!soundEnabled || !audioContext || !masterGain || document.hidden) return;
    const schedule = () => {
      if (!audioContext || !masterGain || audioContext.state !== "running") return;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;
      oscillator.type = index % 3 === 0 ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(180 + (index % 8) * 28, now);
      oscillator.frequency.exponentialRampToValueAtTime(260 + (index % 6) * 34, now + .16);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(.34, now + .025);
      gain.gain.exponentialRampToValueAtTime(.0001, now + .22);
      oscillator.connect(gain);
      gain.connect(masterGain);
      activeAudioNodes.add(oscillator);
      oscillator.addEventListener("ended", () => { activeAudioNodes.delete(oscillator); oscillator.disconnect(); gain.disconnect(); }, { once: true });
      oscillator.start(now);
      oscillator.stop(now + .24);
    };
    if (audioContext.state === "suspended") audioContext.resume().then(schedule).catch(() => {});
    else schedule();
  };

  const clearTimers = () => {
    if (holdTimer) window.clearTimeout(holdTimer);
    if (timingTimer) window.clearTimeout(timingTimer);
    if (focusTimer) window.clearTimeout(focusTimer);
    holdTimer = 0; timingTimer = 0; focusTimer = 0;
    trigger?.classList.remove("is-holding");
    layer.style.setProperty("--solar-hold-progress", "0");
  };
  const isPuzzleComplete = () => Object.keys(puzzleGoal).every((id) => puzzlePositions[id] === puzzleGoal[id]);
  const renderPuzzle = () => {
    if (!orbits) return;
    const names = ["Quỹ đạo gần", "Quỹ đạo trung", "Quỹ đạo xa"];
    const tokens = { sun: ["☀", "Mặt trời"], ufo: ["⌁", "UFO"], portal: ["✦", "Cổng"] };
    orbits.innerHTML = names.map((name, orbitIndex) => {
      const id = Object.keys(puzzlePositions).find((key) => puzzlePositions[key] === orbitIndex);
      const token = tokens[id];
      return `<div class="hh-solar-secret__orbit-slot" data-solar-orbit="${orbitIndex}"><span>${name}</span><button type="button" draggable="true" data-puzzle-token="${id}" aria-label="${token[1]} ở ${name}; dùng phím mũi tên để di chuyển"><b aria-hidden="true">${token[0]}</b>${token[1]}</button></div>`;
    }).join("");
    puzzleSolved = isPuzzleComplete();
    if (puzzleNext) puzzleNext.disabled = !puzzleSolved;
    if (puzzleStatus) puzzleStatus.textContent = puzzleSolved ? "Quỹ đạo đã căn chỉnh chính xác. Cổng đã sẵn sàng." : "Gợi ý: Cổng ở gần, Mặt trời ở giữa, UFO ở xa.";
    puzzle?.classList.toggle("is-solved", puzzleSolved);
  };
  const movePuzzleToken = (id, destination) => {
    if (!Object.prototype.hasOwnProperty.call(puzzlePositions, id)) return;
    const targetOrbit = (destination + 3) % 3;
    const oldOrbit = puzzlePositions[id];
    const swappedId = Object.keys(puzzlePositions).find((key) => puzzlePositions[key] === targetOrbit);
    puzzlePositions[id] = targetOrbit;
    if (swappedId) puzzlePositions[swappedId] = oldOrbit;
    renderPuzzle();
    find(`[data-puzzle-token="${id}"]`)?.focus({ preventScroll: true });
    playTone(17);
  };
  const resetPuzzle = () => { puzzlePositions = { sun: 0, ufo: 1, portal: 2 }; puzzleSolved = false; renderPuzzle(); };
  const syncChoices = () => {
    const mergeReady = ["portal", "orbit", "ufo", "sleep"].every((id) => progressState.endings.includes(id));
    choices?.querySelectorAll("[data-solar-choice]").forEach((button) => {
      const id = button.dataset.solarChoice;
      const unlocked = id !== "merge" || mergeReady;
      button.disabled = !unlocked;
      button.setAttribute("aria-disabled", String(!unlocked));
      button.classList.toggle("is-discovered", progressState.endings.includes(id));
      const small = button.querySelector("small");
      if (small) small.textContent = progressState.endings.includes(id) ? "Đã khám phá · có thể xem lại" : id === "merge" && !mergeReady ? `Cần thêm ${4 - progressState.endings.filter((item) => item !== "merge").length} nhánh` : "Khám phá kết thúc này";
    });
  };
  const announce = (stage) => {
    if (!progress || !message || !trigger) return;
    const current = Math.min(STAGE_COUNT, stageIndex);
    const ending = ENDINGS[outcome];
    progress.textContent = `MẬT MÃ MẶT TRỜI · ${String(current).padStart(2, "0")} / ${STAGE_COUNT}`;
    if (progressBar) progressBar.value = current;
    message.textContent = stage.kind === "ending" && ending ? `Tín hiệu 19/20 · ${ending.message}` : stage.message;
    if (hint) hint.textContent = stage.hint || "";
    trigger.textContent = stage.label;
    trigger.hidden = complete || confirmOpen || ["puzzle", "choice", "summary"].includes(stage.kind);
    if (confirmGroup) confirmGroup.hidden = !confirmOpen;
    if (symbols) symbols.hidden = stage.kind !== "symbols";
    if (puzzle) puzzle.hidden = stage.kind !== "puzzle";
    if (choices) choices.hidden = stage.kind !== "choice";
    if (unlock) unlock.hidden = !["ending", "summary"].includes(stage.kind);
    if (summary) summary.hidden = stage.kind !== "summary";
    if (replay) replay.hidden = stage.kind !== "summary";
    if (branchAgain) branchAgain.hidden = stage.kind !== "summary";
    if (badge) badge.textContent = `Huy hiệu ${progressState.badges.length}`;
    if (summaryStage) summaryStage.textContent = `${current} / ${STAGE_COUNT}`;
    if (summaryBranch) summaryBranch.textContent = ending?.title || "Chưa chọn";
    if (summaryBadge) summaryBadge.textContent = String(progressState.badges.length);
    if (endingGlyph) endingGlyph.textContent = ending?.glyph || "✦";
    if (endingTitle) endingTitle.textContent = ending ? `HH SOLAR · ${ending.title}` : "HH SOLAR SECRET";
    if (endingCopy) endingCopy.textContent = ending?.message || "Không có dữ liệu nào được gửi đi.";
    panel?.setAttribute("data-outcome", outcome || "none");
    syncChoices();
    refreshJournal();
  };
  const setStage = (nextIndex, source = "click") => {
    clearTimers();
    stageIndex = Math.max(0, Math.min(STAGE_COUNT, Number(nextIndex) || 0));
    const stage = STAGES[stageIndex];
    complete = stage.kind === "summary";
    confirmOpen = stage.kind === "confirm";
    layer.dataset.stage = String(stageIndex);
    layer.classList.remove(...stageClasses, "is-complete", "is-hovering", "is-signal-ready");
    layer.classList.add(`is-stage-${stage.kind}`);
    if (complete) layer.classList.add("is-complete");
    if (stage.kind === "escape" && !reducedMotion?.matches) { layer.style.setProperty("--solar-escape-x", "52px"); layer.style.setProperty("--solar-escape-y", "-10px"); }
    else { layer.style.setProperty("--solar-escape-x", "0px"); layer.style.setProperty("--solar-escape-y", "0px"); }
    redVeil.hidden = stage.kind !== "red";
    if (ufo) ufo.hidden = stage.kind !== "ufo" && outcome !== "ufo";
    if (meteor) meteor.hidden = stage.kind !== "meteor";
    if (stage.kind === "puzzle") renderPuzzle();
    if (stage.kind === "ending") {
      const ending = ENDINGS[outcome];
      if (ending) { addUnique(progressState.endings, outcome); unlockBadge(ending.badge); persistDiscovery(); }
    }
    recordStageBadges(stage);
    announce(stage);
    playTone(stageIndex);
    if (stage.kind === "hologram") timingTimer = window.setTimeout(() => { if (stageIndex === 13 && layer.classList.contains("is-open")) layer.classList.add("is-signal-ready"); }, 760);
    const focusTarget = confirmOpen ? continueButton : stage.kind === "puzzle" ? find("[data-puzzle-token]") : stage.kind === "choice" ? choices?.querySelector("[data-solar-choice]:not(:disabled)") : complete ? replay : trigger;
    focusTimer = window.setTimeout(() => focusTarget?.focus({ preventScroll: true }), 0);
    dispatch("hh:auth-solar-secret", { stage: stageIndex, kind: stage.kind, source, complete, outcome });
  };

  const openSecret = () => {
    if (layer.classList.contains("is-open")) return;
    layer.classList.add("is-open");
    sunHit?.setAttribute("aria-expanded", "true");
    outcome = ""; holdConsumed = false; lastAdvanceAt = 0; resetPuzzle(); setStage(0, "sun");
  };
  const closeSecret = ({ restoreFocus = true } = {}) => {
    clearTimers(); closeAudio(); holdConsumed = false;
    layer.classList.remove("is-open", ...stageClasses, "is-complete", "is-hovering", "is-hold-complete", "is-signal-ready", "is-paused");
    redVeil.hidden = true;
    if (ufo) ufo.hidden = true;
    if (meteor) meteor.hidden = true;
    confirmOpen = false; complete = false; stageIndex = 0; outcome = ""; lastAdvanceAt = 0;
    if (journal) journal.hidden = true;
    journalToggle?.setAttribute("aria-expanded", "false");
    sunHit?.setAttribute("aria-expanded", "false");
    if (restoreFocus) sunHit?.focus({ preventScroll: true });
  };
  const resetSecret = () => { outcome = ""; holdConsumed = false; lastAdvanceAt = 0; resetPuzzle(); setStage(0, "reset"); };
  const replaySecret = () => { progressState.replayCount += 1; saveProgress(); resetSecret(); };
  const nextStage = (source = "trigger") => {
    if (complete) return;
    const now = performance.now();
    if (now - lastAdvanceAt < 160) return;
    const stage = STAGES[stageIndex];
    if (stage.kind === "confirm") { confirmOpen = true; announce(stage); continueButton?.focus({ preventScroll: true }); return; }
    if (["puzzle", "choice", "summary"].includes(stage.kind)) return;
    if (stage.kind === "hold" && !["hold", "keyboard"].includes(source)) { if (hint) hint.textContent = "Hãy giữ nút 0,9 giây hoặc nhấn Enter/Space để nạp đủ năng lượng."; return; }
    lastAdvanceAt = now;
    setStage(stageIndex + 1, source);
  };
  const stopAtConfirm = () => { setStage(0, "stop"); if (message) message.textContent = "Đã dừng an toàn. Tín hiệu vẫn ở đây nếu bạn muốn thử lại."; if (hint) hint.textContent = "Bạn có thể đóng hoặc bắt đầu lại khi sẵn sàng."; };
  const chooseBranch = (branch) => {
    if (stageIndex !== 18 || !ENDINGS[branch]) return;
    if (branch === "merge" && !["portal", "orbit", "ufo", "sleep"].every((id) => progressState.endings.includes(id))) { if (hint) hint.textContent = "Hãy khám phá đủ bốn nhánh đầu để mở Hợp nhất tín hiệu."; return; }
    outcome = branch;
    setStage(19, `choice:${branch}`);
  };
  const startHold = () => {
    if (STAGES[stageIndex].kind !== "hold" || complete || holdTimer) return;
    const holdMs = STAGES[stageIndex].holdMs || 900;
    holdConsumed = false;
    trigger?.classList.add("is-holding");
    layer.style.setProperty("--solar-hold-progress", "0");
    holdTimer = window.setTimeout(() => { holdTimer = 0; holdConsumed = true; layer.classList.add("is-hold-complete"); unlockBadge("plasma"); saveProgress(); nextStage("hold"); }, holdMs);
    if (!reducedMotion?.matches) {
      const startedAt = performance.now();
      const tick = (now) => { const ratio = Math.min(1, (now - startedAt) / holdMs); layer.style.setProperty("--solar-hold-progress", String(ratio)); if (ratio < 1 && holdTimer) window.requestAnimationFrame(tick); };
      window.requestAnimationFrame(tick);
    }
  };
  const stopHold = () => {
    if (!holdTimer) { if (holdConsumed) window.setTimeout(() => { holdConsumed = false; }, 0); return; }
    window.clearTimeout(holdTimer); holdTimer = 0; trigger?.classList.remove("is-holding"); layer.style.setProperty("--solar-hold-progress", "0");
  };

  sunHit?.addEventListener("click", openSecret, { signal });
  trigger?.addEventListener("click", () => { if (holdConsumed) { holdConsumed = false; return; } nextStage("click"); }, { signal });
  trigger?.addEventListener("keydown", (event) => {
    if (STAGES[stageIndex].kind === "hold" && ["Enter", " "].includes(event.key)) { event.preventDefault(); unlockBadge("plasma"); saveProgress(); nextStage("keyboard"); }
  }, { signal });
  trigger?.addEventListener("pointerdown", startHold, { signal });
  trigger?.addEventListener("pointerup", stopHold, { signal });
  trigger?.addEventListener("pointercancel", stopHold, { signal });
  trigger?.addEventListener("lostpointercapture", stopHold, { signal });
  trigger?.addEventListener("pointerenter", () => { if (STAGES[stageIndex].kind === "hover") { layer.classList.add("is-hovering"); if (hint) hint.textContent = "Bụi sao đã thức giấc — chạm để đi tiếp."; } }, { signal });
  trigger?.addEventListener("focus", () => { if (STAGES[stageIndex].kind === "hover") layer.classList.add("is-hovering"); }, { signal });
  trigger?.addEventListener("pointerleave", () => layer.classList.remove("is-hovering"), { signal });
  trigger?.addEventListener("blur", () => layer.classList.remove("is-hovering"), { signal });
  continueButton?.addEventListener("click", () => setStage(7, "confirm"), { signal });
  stopButton?.addEventListener("click", stopAtConfirm, { signal });
  choices?.addEventListener("click", (event) => { const button = event.target.closest("[data-solar-choice]"); if (button && !button.disabled) chooseBranch(button.dataset.solarChoice); }, { signal });
  orbits?.addEventListener("click", (event) => { const token = event.target.closest("[data-puzzle-token]"); if (token) movePuzzleToken(token.dataset.puzzleToken, puzzlePositions[token.dataset.puzzleToken] + 1); }, { signal });
  orbits?.addEventListener("keydown", (event) => {
    const token = event.target.closest("[data-puzzle-token]");
    if (!token || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const delta = ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1;
    movePuzzleToken(token.dataset.puzzleToken, puzzlePositions[token.dataset.puzzleToken] + delta);
  }, { signal });
  orbits?.addEventListener("dragstart", (event) => { const token = event.target.closest("[data-puzzle-token]"); if (!token) return; draggedToken = token.dataset.puzzleToken; event.dataTransfer?.setData("text/plain", draggedToken); }, { signal });
  orbits?.addEventListener("dragover", (event) => { if (event.target.closest("[data-solar-orbit]")) event.preventDefault(); }, { signal });
  orbits?.addEventListener("drop", (event) => { const slot = event.target.closest("[data-solar-orbit]"); if (!slot) return; event.preventDefault(); const id = event.dataTransfer?.getData("text/plain") || draggedToken; movePuzzleToken(id, Number(slot.dataset.solarOrbit)); draggedToken = ""; }, { signal });
  autoSolve?.addEventListener("click", () => { puzzlePositions = { ...puzzleGoal }; renderPuzzle(); puzzleNext?.focus({ preventScroll: true }); playTone(17); }, { signal });
  puzzleNext?.addEventListener("click", () => { if (puzzleSolved) setStage(18, "puzzle"); }, { signal });
  reset?.addEventListener("click", resetSecret, { signal });
  replay?.addEventListener("click", replaySecret, { signal });
  branchAgain?.addEventListener("click", () => { outcome = ""; setStage(18, "branch-again"); }, { signal });
  close?.addEventListener("click", () => closeSecret(), { signal });
  journalToggle?.addEventListener("click", () => { if (!journal) return; journal.hidden = !journal.hidden; journalToggle.setAttribute("aria-expanded", String(!journal.hidden)); refreshJournal(); }, { signal });
  soundToggle?.addEventListener("click", async () => { if (soundEnabled) closeAudio(); else if (await createAudio()) playTone(stageIndex); }, { signal });
  volume?.addEventListener("input", () => { if (masterGain) masterGain.gain.value = Number(volume.value) / 500; }, { signal });
  layer.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.preventDefault(); closeSecret(); } }, { signal });

  const closeOnAuth = (event) => { if (event.detail?.user) closeSecret({ restoreFocus: false }); };
  gate.addEventListener("hh:auth-change", closeOnAuth, { signal });
  window.addEventListener("hh:auth-change", closeOnAuth, { signal });
  document.addEventListener("visibilitychange", () => {
    layer.classList.toggle("is-paused", document.hidden);
    if (document.hidden) { clearTimers(); stopAudioNodes(); audioContext?.suspend?.().catch(() => {}); }
  }, { signal });
  window.addEventListener("pagehide", () => {
    clearTimers(); closeAudio(); controller.abort(); layer.remove(); redVeil.remove(); delete galaxy.dataset.hhSolarSecretMounted; delete window.HHSolarSecret;
  }, { once: true, signal });
  reducedMotion?.addEventListener?.("change", () => { layer.dataset.motion = reducedMotion.matches ? "static" : "cinematic"; }, { signal });

  refreshJournal();
  window.HHSolarSecret = Object.freeze({
    version: 3,
    open: openSecret,
    close: closeSecret,
    reset: resetSecret,
    choose: chooseBranch,
    solvePuzzle: () => { puzzlePositions = { ...puzzleGoal }; renderPuzzle(); },
    getStage: () => stageIndex,
    getProgress: () => Object.freeze({ ...progressState, endings: [...progressState.endings], badges: [...progressState.badges], storageAvailable })
  });
})();
