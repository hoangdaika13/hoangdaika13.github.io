(function (global) {
  "use strict";

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const DATE_FORMATTER = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" });
  const BODIES = [
    { id: "sun", name: "Mặt Trời", astronomy: "Sun", color: [1, .72, .2], size: 18, period: 0, meta: "Ngôi sao" },
    { id: "mercury", name: "Sao Thủy", astronomy: "Mercury", color: [.72, .67, .59], size: 6, period: 87.97, meta: "Hành tinh đá" },
    { id: "venus", name: "Sao Kim", astronomy: "Venus", color: [1, .72, .39], size: 8, period: 224.7, meta: "Hành tinh đá" },
    { id: "earth", name: "Trái Đất", astronomy: "Earth", color: [.2, .63, 1], size: 9, period: 365.26, meta: "Hành tinh đá" },
    { id: "moon", name: "Mặt Trăng", astronomy: "Moon", color: [.82, .85, .88], size: 5, period: 27.32, meta: "Vệ tinh" },
    { id: "mars", name: "Sao Hỏa", astronomy: "Mars", color: [1, .34, .2], size: 7, period: 686.98, meta: "Hành tinh đá" },
    { id: "jupiter", name: "Sao Mộc", astronomy: "Jupiter", color: [.91, .68, .47], size: 14, period: 4332.59, meta: "Hành tinh khí" },
    { id: "saturn", name: "Sao Thổ", astronomy: "Saturn", color: [.96, .81, .5], size: 13, period: 10759.22, meta: "Hành tinh khí" },
    { id: "uranus", name: "Sao Thiên Vương", astronomy: "Uranus", color: [.47, .9, .94], size: 11, period: 30688.5, meta: "Hành tinh băng" },
    { id: "neptune", name: "Sao Hải Vương", astronomy: "Neptune", color: [.28, .42, 1], size: 11, period: 60182, meta: "Hành tinh băng" },
    { id: "pluto", name: "Sao Diêm Vương", astronomy: "Pluto", color: [.74, .64, .55], size: 5, period: 90560, meta: "Hành tinh lùn" }
  ];
  const QUALITY = { low: { stars: 180, orbitSamples: 32 }, medium: { stars: 420, orbitSamples: 56 }, high: { stars: 800, orbitSamples: 88 } };
  const SPEEDS = [1, 10, 100, 1000];
  const SCALE_MODES = ["scientific", "educational", "cinematic"];

  let runtime = null;

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function markup() {
    const buttons = BODIES.map((b) => `<button type="button" data-solar3d-body="${b.id}" aria-pressed="false"><span aria-hidden="true">●</span><span>${esc(b.name)}</span><small>${esc(b.meta)}</small></button>`).join("");
    return `<section class="hh-solar3d" data-solar3d-state="loading" aria-label="Mô phỏng Hệ Mặt Trời 3D">
      <div class="hh-solar3d__stage" data-solar3d-stage>
        <canvas data-solar3d-gl tabindex="0" role="application" aria-roledescription="mô phỏng không gian 3D" aria-label="Hệ Mặt Trời 3D tương tác" aria-describedby="hh-solar3d-canvas-help"></canvas>
        <canvas data-solar3d-fallback tabindex="0" role="application" aria-roledescription="mô phỏng không gian Canvas" aria-label="Hệ Mặt Trời tương tác trên Canvas" aria-describedby="hh-solar3d-canvas-help" hidden></canvas>
        <p id="hh-solar3d-canvas-help" class="hh-solar3d__sr-only">Dùng WASD hoặc phím mũi tên để xoay camera, phím cộng trừ để thu phóng và Home để đặt lại. Mở Phím tắt để xem đầy đủ điều khiển chuột và cảm ứng.</p>
        <div data-solar3d-labels aria-hidden="true"></div><div class="hh-solar3d__reticle" data-solar3d-reticle></div>
        <div class="hh-solar3d__hud" data-solar3d-hud>
          <header class="hh-solar3d__topbar" data-solar3d-topbar><div><h2>Hệ Mặt Trời 3D</h2><p>Vị trí thiên thể tính bằng Astronomy Engine</p></div><div data-solar3d-toolbar>
            <button type="button" data-solar3d-reset>Đặt lại</button><button type="button" data-solar3d-label-toggle aria-pressed="true">Nhãn</button><button type="button" data-solar3d-quality aria-pressed="false">Chất lượng</button><button type="button" data-solar3d-fullscreen aria-pressed="false">Toàn màn hình</button><button type="button" data-solar3d-help-toggle aria-expanded="false">Phím tắt</button>
          </div></header>
          <div class="hh-solar3d__status" data-solar3d-status data-state="loading">Đang tính vị trí thiên thể…</div>
          <nav class="hh-solar3d__body-list" data-solar3d-body-list aria-label="Chọn thiên thể"><header><h3>Thiên thể</h3></header>${buttons}</nav>
          <aside class="hh-solar3d__inspector" data-solar3d-inspector><h3 data-solar3d-selected-name>—</h3><div data-solar3d-selected-meta>—</div><p>Khoảng cách và tọa độ nhật tâm tại thời điểm đã chọn.</p><dl><dt>X (AU)</dt><dd data-field="x">—</dd><dt>Y (AU)</dt><dd data-field="y">—</dd><dt>Z (AU)</dt><dd data-field="z">—</dd><dt>Cách Mặt Trời</dt><dd data-field="distance">—</dd></dl><footer><span data-solar3d-source>Astronomy Engine</span><span data-solar3d-renderer>—</span></footer></aside>
          <div class="hh-solar3d__controls" data-solar3d-controls><button type="button" data-solar3d-play aria-pressed="false">Phát · 1 ngày/giây</button><button type="button" data-solar3d-step="-1">−1 ngày</button><button type="button" data-solar3d-now>Hiện tại</button><button type="button" data-solar3d-step="1">+1 ngày</button></div>
          <div class="hh-solar3d__timeline" data-solar3d-timeline><label>Ngày giờ thiết bị<input data-solar3d-date type="datetime-local"></label><label for="hh-solar3d-time">Tua ±10 năm</label><input id="hh-solar3d-time" data-solar3d-time-range type="range" min="-3650" max="3650" step="1" value="0"><output data-solar3d-time-value>—</output><label>Tốc độ<select data-solar3d-speed>${SPEEDS.map((value) => `<option value="${value}">${value}× · ${value} ngày/giây</option>`).join("")}</select></label><label>Tỉ lệ<select data-solar3d-scale><option value="scientific">Khoa học</option><option value="educational">Giáo dục</option><option value="cinematic">Điện ảnh</option></select></label></div>
          <div class="hh-solar3d__legend" data-solar3d-legend>Quỹ đạo/vị trí: Astronomy Engine · Kích thước điểm: minh họa</div>
          <div data-solar3d-help hidden><section data-solar3d-help-dialog role="dialog" aria-modal="true" aria-labelledby="hh-solar3d-help-title"><h2 id="hh-solar3d-help-title">Điều khiển không gian 3D</h2><p>Kéo để xoay, Shift/kéo hoặc chuột phải để dịch chuyển, lăn hoặc chụm hai ngón để thu phóng.</p><div data-solar3d-shortcuts><span>←↑↓→ / WASD <kbd>xoay</kbd></span><span>+/− <kbd>zoom</kbd></span><span>Shift + kéo <kbd>pan</kbd></span><span>Home <kbd>đặt lại</kbd></span></div><button type="button" data-solar3d-help-close>Đóng</button></section></div>
          <div data-solar3d-toast role="status" aria-live="polite" hidden></div>
          <div data-solar3d-live aria-live="polite" aria-atomic="true"></div>
        </div>
      </div>
    </section>`;
  }

  function normalizeDate(value) {
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new TypeError("updateTime cần một ngày hợp lệ");
    return date;
  }

  function initLabels(rt) {
    const layer = rt.root.querySelector("[data-solar3d-labels]");
    const fragment = document.createDocumentFragment();
    for (const body of BODIES) {
      const label = document.createElement("span");
      label.dataset.solar3dLabel = body.id;
      label.textContent = body.name;
      label.hidden = true;
      rt.labelNodes.set(body.id, label);
      fragment.appendChild(label);
    }
    layer.appendChild(fragment);
  }

  function createRuntime(host, options) {
    host.innerHTML = markup();
    const root = host.querySelector(".hh-solar3d");
    const stage = root.querySelector("[data-solar3d-stage]");
    const glCanvas = root.querySelector("[data-solar3d-gl]");
    const fallbackCanvas = root.querySelector("[data-solar3d-fallback]");
    const state = {
      mounted: true, initialized: false, renderer: "none", quality: QUALITY[options.quality] ? options.quality : "medium",
      selectedBody: BODIES.some((b) => b.id === String(options.selectedBody || "").toLowerCase()) ? String(options.selectedBody).toLowerCase() : "earth",
      time: normalizeDate(options.time || new Date()), playing: Boolean(options.playing), hidden: document.hidden,
      contextLost: false, error: null, labels: options.labels !== false,
      speed: SPEEDS.includes(Number(options.speed)) ? Number(options.speed) : 1,
      scaleMode: SCALE_MODES.includes(options.scaleMode) ? options.scaleMode : "educational",
      targetLocked: true,
      camera: normalizeCamera(options.camera)
    };
    const rt = { host, root, stage, glCanvas, fallbackCanvas, state, options, astronomy: options.astronomy || global.Astronomy, gl: null, ctx: null, gpu: null, positions: new Map(), orbits: [], stars: [], projected: new Map(), labelNodes: new Map(), listeners: [], pointers: new Map(), raf: 0, resizeObserver: null, lastFrame: 0, lastEphemerisFrame: 0, toastTimer: 0, initTimer: 0, orbitBuildTimer: 0, orbitBuildToken: 0, orbitBuildNeeded: false, orbitRetryCount: 0, pixelRatio: 1 };
    initLabels(rt);
    buildStars(rt);
    bind(rt);
    syncControls(rt);
    rt.initTimer = global.setTimeout(() => initializeRuntime(rt), 16);
    return rt;
  }

  function initializeRuntime(rt) {
    rt.initTimer = 0; if (!rt.state.mounted) return;
    initRenderer(rt); resizeRuntime(rt); rt.state.initialized = true; updateEphemeris(rt); selectRuntime(rt, rt.state.selectedBody, false); syncControls(rt); schedule(rt);
  }

  function normalizeCamera(value) {
    const input = value && typeof value === "object" ? value : {};
    const finite = (key, fallback) => Number.isFinite(Number(input[key])) ? Number(input[key]) : fallback;
    return { yaw: finite("yaw", -.5), pitch: clamp(finite("pitch", .42), -1.45, 1.45), distance: clamp(finite("distance", 78), 8, 220), panX: finite("panX", 0), panY: finite("panY", 0), panZ: finite("panZ", 0) };
  }

  function on(rt, target, type, fn, options) {
    target.addEventListener(type, fn, options);
    rt.listeners.push(() => target.removeEventListener(type, fn, options));
  }

  function bind(rt) {
    const { root, stage, glCanvas } = rt;
    root.querySelectorAll("[data-solar3d-body]").forEach((button) => on(rt, button, "click", () => selectRuntime(rt, button.dataset.solar3dBody)));
    on(rt, root.querySelector("[data-solar3d-reset]"), "click", () => resetCamera(rt));
    on(rt, root.querySelector("[data-solar3d-label-toggle]"), "click", () => { rt.state.labels = !rt.state.labels; syncControls(rt); draw(rt); announce(rt, rt.state.labels ? "Đã bật nhãn thiên thể" : "Đã ẩn nhãn thiên thể"); });
    on(rt, root.querySelector("[data-solar3d-quality]"), "click", () => setQualityRuntime(rt, rt.state.quality === "low" ? "medium" : rt.state.quality === "medium" ? "high" : "low"));
    const fullscreen = root.querySelector("[data-solar3d-fullscreen]");
    on(rt, fullscreen, "click", () => { if (document.fullscreenElement === root) document.exitFullscreen?.(); else root.requestFullscreen?.().catch(() => toast(rt, "Không thể mở toàn màn hình")); });
    on(rt, document, "fullscreenchange", () => { const active = document.fullscreenElement === root; fullscreen.setAttribute("aria-pressed", String(active)); fullscreen.textContent = active ? "Thoát toàn màn hình" : "Toàn màn hình"; resizeRuntime(rt); });
    const helpButton = root.querySelector("[data-solar3d-help-toggle]");
    const helpOverlay = root.querySelector("[data-solar3d-help]");
    const helpClose = root.querySelector("[data-solar3d-help-close]");
    const toggleHelp = (open) => {
      helpOverlay.hidden = !open; helpButton.setAttribute("aria-expanded", String(open));
      [glCanvas, rt.fallbackCanvas, ...root.querySelector("[data-solar3d-hud]").children].forEach((item) => { if (item !== helpOverlay) item.inert = open; });
      if (open) helpClose.focus({ preventScroll: true }); else helpButton.focus({ preventScroll: true });
    };
    on(rt, helpButton, "click", () => toggleHelp(helpOverlay.hidden));
    on(rt, helpClose, "click", () => toggleHelp(false));
    on(rt, helpOverlay, "click", (event) => { if (event.target === helpOverlay) toggleHelp(false); });
    on(rt, helpOverlay, "keydown", (event) => { if (event.key === "Tab") { event.preventDefault(); helpClose.focus({ preventScroll: true }); } });
    on(rt, document, "keydown", (event) => { if (event.key === "Escape" && !helpOverlay.hidden) { event.preventDefault(); toggleHelp(false); } });
    on(rt, root.querySelector("[data-solar3d-play]"), "click", () => { rt.state.playing = !rt.state.playing; syncControls(rt); announce(rt, rt.state.playing ? `Đang phát ở tốc độ ${rt.state.speed} ngày mỗi giây` : "Đã tạm dừng thời gian mô phỏng"); schedule(rt); });
    on(rt, root.querySelector("[data-solar3d-now]"), "click", () => updateTimeRuntime(rt, new Date()));
    root.querySelectorAll("[data-solar3d-step]").forEach((button) => on(rt, button, "click", () => updateTimeRuntime(rt, new Date(rt.state.time.getTime() + Number(button.dataset.solar3dStep) * 86400000))));
    on(rt, root.querySelector("[data-solar3d-time-range]"), "input", (event) => { const origin = new Date(); origin.setHours(0, 0, 0, 0); updateTimeRuntime(rt, new Date(origin.getTime() + Number(event.target.value) * 86400000), false); });
    on(rt, root.querySelector("[data-solar3d-date]"), "change", (event) => { const next = new Date(event.target.value); if (Number.isFinite(next.getTime())) updateTimeRuntime(rt, next); });
    on(rt, root.querySelector("[data-solar3d-speed]"), "change", (event) => { rt.state.speed = SPEEDS.includes(Number(event.target.value)) ? Number(event.target.value) : 1; syncControls(rt); announce(rt, `Tốc độ ${rt.state.speed} ngày mô phỏng mỗi giây`); });
    on(rt, root.querySelector("[data-solar3d-scale]"), "change", (event) => { rt.state.scaleMode = SCALE_MODES.includes(event.target.value) ? event.target.value : "educational"; if (rt.state.targetLocked) focusSelected(rt); rebuildOrbitBuffers(rt); syncControls(rt); draw(rt); announce(rt, `Tỉ lệ hiển thị ${event.target.selectedOptions[0].textContent}`); });
    on(rt, document, "visibilitychange", () => { rt.state.hidden = document.hidden; if (document.hidden) { cancelAnimationFrame(rt.raf); rt.raf = 0; cancelOrbitBuild(rt, true); } else { rt.lastFrame = 0; if (rt.orbitBuildNeeded) queueOrbitBuild(rt); schedule(rt); } });
    on(rt, glCanvas, "webglcontextlost", (event) => { event.preventDefault(); rt.state.contextLost = true; disposeGL(rt); useCanvas(rt, "WebGL bị mất ngữ cảnh · Canvas Lite"); });
    on(rt, glCanvas, "webglcontextrestored", () => { rt.state.contextLost = false; initRenderer(rt); resizeRuntime(rt); draw(rt); });
    for (const canvas of [glCanvas, rt.fallbackCanvas]) bindInput(rt, canvas);
    if (global.ResizeObserver) { rt.resizeObserver = new ResizeObserver(() => resizeRuntime(rt)); rt.resizeObserver.observe(stage); }
    else on(rt, global, "resize", () => resizeRuntime(rt));
  }

  function bindInput(rt, canvas) {
    on(rt, canvas, "pointerdown", (event) => { canvas.setPointerCapture?.(event.pointerId); rt.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, pan: event.button === 1 || event.button === 2 || event.shiftKey }); rt.root.dataset.solar3dDragging = "true"; });
    on(rt, canvas, "pointermove", (event) => {
      const previous = rt.pointers.get(event.pointerId); if (!previous) return;
      const before = Array.from(rt.pointers.values()); rt.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, pan: previous.pan });
      if (rt.pointers.size === 1 && previous.pan) { rt.state.targetLocked = false; delete rt.root.dataset.solar3dTargetLocked; rt.state.camera.panX -= (event.clientX - previous.x) * .025; rt.state.camera.panY += (event.clientY - previous.y) * .025; }
      else if (rt.pointers.size === 1) { rt.state.camera.yaw += (event.clientX - previous.x) * .006; rt.state.camera.pitch = clamp(rt.state.camera.pitch + (event.clientY - previous.y) * .006, -1.45, 1.45); }
      else if (rt.pointers.size === 2) { const after = Array.from(rt.pointers.values()); const oldDistance = Math.hypot(before[0].x - before[1].x, before[0].y - before[1].y); const newDistance = Math.hypot(after[0].x - after[1].x, after[0].y - after[1].y); rt.state.camera.distance = clamp(rt.state.camera.distance * (oldDistance / Math.max(1, newDistance)), 8, 220); }
      draw(rt);
    });
    const end = (event) => { rt.pointers.delete(event.pointerId); if (!rt.pointers.size) delete rt.root.dataset.solar3dDragging; };
    on(rt, canvas, "pointerup", end); on(rt, canvas, "pointercancel", end); on(rt, canvas, "lostpointercapture", end);
    on(rt, canvas, "contextmenu", (event) => event.preventDefault());
    on(rt, canvas, "wheel", (event) => { event.preventDefault(); if (event.shiftKey) { rt.state.targetLocked = false; delete rt.root.dataset.solar3dTargetLocked; rt.state.camera.panX -= event.deltaY * .02; } else rt.state.camera.distance = clamp(rt.state.camera.distance * Math.exp(event.deltaY * .001), 8, 220); draw(rt); }, { passive: false });
    on(rt, canvas, "keydown", (event) => keyboard(rt, event));
    on(rt, canvas, "click", (event) => pick(rt, event, canvas));
  }

  function keyboard(rt, event) {
    const key = event.key.toLowerCase(); let handled = true;
    if (key === "arrowleft" || key === "a") rt.state.camera.yaw -= .08;
    else if (key === "arrowright" || key === "d") rt.state.camera.yaw += .08;
    else if (key === "arrowup" || key === "w") rt.state.camera.pitch = clamp(rt.state.camera.pitch - .08, -1.45, 1.45);
    else if (key === "arrowdown" || key === "s") rt.state.camera.pitch = clamp(rt.state.camera.pitch + .08, -1.45, 1.45);
    else if (key === "+" || key === "=") rt.state.camera.distance = clamp(rt.state.camera.distance * .88, 8, 220);
    else if (key === "-" || key === "_") rt.state.camera.distance = clamp(rt.state.camera.distance * 1.14, 8, 220);
    else if (key === "home") resetCamera(rt);
    else handled = false;
    if (handled) { event.preventDefault(); draw(rt); }
  }

  function resetCamera(rt) { Object.assign(rt.state.camera, { yaw: -.5, pitch: .42, distance: 78 }); rt.state.targetLocked = true; rt.root.dataset.solar3dTargetLocked = "true"; focusSelected(rt); draw(rt); }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

  function buildStars(rt) {
    const count = QUALITY[rt.state.quality].stars; rt.stars.length = 0;
    // A deterministic low-discrepancy sphere: visual background only, never ephemeris data.
    for (let i = 0; i < count; i += 1) { const y = 1 - (i / Math.max(1, count - 1)) * 2; const radius = Math.sqrt(Math.max(0, 1 - y * y)); const phi = i * 2.399963229728653; rt.stars.push([Math.cos(phi) * radius * 105, y * 105, Math.sin(phi) * radius * 105]); }
  }

  function astronomyBody(rt, body) { return rt.astronomy?.Body?.[body.astronomy] || body.astronomy; }
  function vector(rt, body, date) {
    if (body.id === "sun") return { x: 0, y: 0, z: 0 };
    if (!rt.astronomy?.HelioVector) throw new Error("Astronomy Engine chưa sẵn sàng; không dùng vị trí giả.");
    if (body.id === "moon") {
      const earth = rt.astronomy.HelioVector(astronomyBody(rt, BODIES.find((b) => b.id === "earth")), date);
      if (!rt.astronomy.GeoVector) throw new Error("Astronomy Engine thiếu GeoVector cho Mặt Trăng.");
      const moon = rt.astronomy.GeoVector(astronomyBody(rt, body), date, true);
      return { x: earth.x + moon.x, y: earth.y + moon.y, z: earth.z + moon.z };
    }
    const v = rt.astronomy.HelioVector(astronomyBody(rt, body), date);
    if (![v.x, v.y, v.z].every(Number.isFinite)) throw new Error(`Không có tọa độ Astronomy Engine cho ${body.name}.`);
    return { x: v.x, y: v.y, z: v.z };
  }

  function updateEphemeris(rt, rebuildOrbits = true, shouldDraw = true) {
    if (rt.state.renderer === "none") {
      rt.state.error = "Thiết bị không cung cấp WebGL2 hoặc Canvas 2D.";
      setStatus(rt, "error", rt.state.error);
      rt.root.dataset.solar3dState = "error";
      announce(rt, rt.state.error);
      return;
    }
    try {
      rt.positions.clear();
      for (const body of BODIES) rt.positions.set(body.id, vector(rt, body, rt.state.time));
      if (rebuildOrbits) queueOrbitBuild(rt);
      if (!rt.state.error || rebuildOrbits) rt.state.error = null;
      const pending = rt.orbitBuildNeeded;
      const degraded = Boolean(rt.state.error);
      setStatus(rt, degraded ? "error" : pending ? "loading" : "ready", degraded ? `${rt.state.error} · quỹ đạo chưa khả dụng` : `${formatDate(rt.state.time)} · ${pending ? "đang tính quỹ đạo nền" : "tọa độ Astronomy Engine"}`);
      rt.root.dataset.solar3dState = degraded ? "degraded" : pending ? "loading" : "ready";
    } catch (error) {
      rt.positions.clear(); rt.orbits = []; const nextError = error instanceof Error ? error.message : String(error); if (rt.state.error !== nextError) announce(rt, nextError); rt.state.error = nextError; setStatus(rt, "error", rt.state.error); rt.root.dataset.solar3dState = "error";
    }
    if (rt.state.targetLocked) focusSelected(rt); updateInspector(rt); if (shouldDraw) draw(rt);
  }

  function cancelOrbitBuild(rt, preserveNeed = false) {
    global.clearTimeout(rt.orbitBuildTimer); rt.orbitBuildTimer = 0; rt.orbitBuildToken += 1;
    if (!preserveNeed) rt.orbitBuildNeeded = false;
  }

  function queueOrbitBuild(rt, isRetry = false) {
    cancelOrbitBuild(rt, true); rt.orbitBuildNeeded = true;
    if (!isRetry) rt.orbitRetryCount = 0;
    if (!rt.state.mounted || rt.state.hidden || rt.state.renderer === "none") return;
    const token = ++rt.orbitBuildToken, epoch = new Date(rt.state.time.getTime()), samples = QUALITY[rt.state.quality].orbitSamples;
    const plans = BODIES.filter((body) => body.period && body.id !== "moon").map((body) => ({ body, index: 0, points: [] }));
    let planIndex = 0;
    setStatus(rt, "loading", `${formatDate(rt.state.time)} · đang tính quỹ đạo nền`);
    const step = () => {
      if (!rt.state.mounted || rt.state.hidden || token !== rt.orbitBuildToken) return;
      try {
        let budget = 6;
        while (budget > 0 && planIndex < plans.length) {
          const plan = plans[planIndex];
          plan.points.push(vector(rt, plan.body, new Date(epoch.getTime() + plan.body.period * 86400000 * plan.index / samples)));
          plan.index += 1; budget -= 1;
          if (plan.index >= samples) planIndex += 1;
        }
        if (planIndex < plans.length) { rt.orbitBuildTimer = global.setTimeout(step, 0); return; }
        rt.orbits = plans.map(({ body, points }) => ({ body, points })); rt.orbitBuildNeeded = false; rt.orbitBuildTimer = 0; rt.orbitRetryCount = 0; rt.state.error = null; rt.root.dataset.solar3dState = "ready";
        rebuildOrbitBuffers(rt); setStatus(rt, "ready", `${formatDate(rt.state.time)} · tọa độ Astronomy Engine`); draw(rt);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        rt.orbitBuildNeeded = true; rt.orbitBuildTimer = 0; rt.state.error = message; rt.root.dataset.solar3dState = "degraded"; setStatus(rt, "error", `${message} · sẽ thử lại`); announce(rt, message);
        if (rt.state.mounted && !rt.state.hidden && rt.orbitRetryCount < 2) {
          rt.orbitRetryCount += 1;
          rt.orbitBuildTimer = global.setTimeout(() => { rt.orbitBuildTimer = 0; queueOrbitBuild(rt, true); }, 350 * rt.orbitRetryCount);
        }
      }
    };
    rt.orbitBuildTimer = global.setTimeout(step, 0);
  }

  function initRenderer(rt) {
    disposeGL(rt);
    let gl = null; try { gl = rt.glCanvas.getContext("webgl2", { antialias: true, alpha: true }); } catch (_) { gl = null; }
    if (!gl) { useCanvas(rt, "Canvas Lite · WebGL2 không khả dụng"); return; }
    try {
      const vertex = `#version 300 es\nin vec3 a_position; in vec3 a_color; in float a_size; in float a_kind; uniform mat4 u_matrix; out vec3 v_color; flat out float v_kind; void main(){gl_Position=u_matrix*vec4(a_position,1.0);gl_PointSize=a_size;v_color=a_color;v_kind=a_kind;}`;
      const fragment = `#version 300 es\nprecision highp float; in vec3 v_color; flat in float v_kind; out vec4 outColor; void main(){vec2 p=gl_PointCoord*2.0-1.0;float r2=dot(p,p);if(v_kind<0.5){if(r2>1.0)discard;float core=smoothstep(1.0,0.0,r2);outColor=vec4(v_color*(0.72+core*0.9),0.58+core*0.42);return;}bool saturn=abs(v_kind-8.0)<0.25;float sphereRadius=saturn?0.48:0.88;vec2 spherePoint=p/sphereRadius;float sphereR2=dot(spherePoint,spherePoint);float ringRadius=length(vec2(p.x,p.y*2.85));bool ring=saturn&&ringRadius>0.57&&ringRadius<0.98;if(sphereR2>1.0){if(!ring)discard;float ringBands=0.72+0.2*sin(ringRadius*82.0);outColor=vec4(mix(v_color,vec3(1.0,0.84,0.55),0.55)*ringBands,0.9);return;}float z=sqrt(max(0.0,1.0-sphereR2));vec3 normal=normalize(vec3(spherePoint,z));float light=max(dot(normal,normalize(vec3(-0.42,0.55,0.9))),0.0);float shade=0.2+0.92*light;float bands=(abs(v_kind-7.0)<0.25||saturn)?1.0+0.1*sin((spherePoint.y+0.035*sin(spherePoint.x*10.0))*48.0):1.0;float terrain=abs(v_kind-4.0)<0.25?0.9+0.15*sin(spherePoint.x*17.0+sin(spherePoint.y*13.0)*2.2):1.0;float emissive=abs(v_kind-1.0)<0.25?0.95:0.0;float rim=pow(1.0-z,3.0);vec3 color=v_color*bands*terrain*(shade+emissive)+rim*mix(v_color,vec3(0.45,0.78,1.0),0.55)*0.45;outColor=vec4(color,1.0);}`;
      const lineVertex = `#version 300 es\nin vec3 a_position; uniform mat4 u_matrix; void main(){gl_Position=u_matrix*vec4(a_position,1.0);}`;
      const lineFragment = `#version 300 es\nprecision mediump float; uniform vec4 u_color; out vec4 outColor; void main(){outColor=u_color;}`;
      rt.gpu = { points: program(gl, vertex, fragment), lines: program(gl, lineVertex, lineFragment), pointBuffer: gl.createBuffer(), orbitBuffers: [] };
      rt.gl = gl; rt.ctx = null; rt.state.renderer = "webgl2"; rt.glCanvas.hidden = false; rt.fallbackCanvas.hidden = true; rendererLabel(rt, "WebGL2");
      rebuildOrbitBuffers(rt);
    } catch (error) { disposeGL(rt); useCanvas(rt, "Canvas Lite · lỗi khởi tạo WebGL"); }
  }

  function shader(gl, type, source) { const item = gl.createShader(type); gl.shaderSource(item, source); gl.compileShader(item); if (!gl.getShaderParameter(item, gl.COMPILE_STATUS)) { const reason = gl.getShaderInfoLog(item); gl.deleteShader(item); throw new Error(reason); } return item; }
  function program(gl, vs, fs) { const p = gl.createProgram(); const v = shader(gl, gl.VERTEX_SHADER, vs); const f = shader(gl, gl.FRAGMENT_SHADER, fs); gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p); gl.deleteShader(v); gl.deleteShader(f); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { const reason = gl.getProgramInfoLog(p); gl.deleteProgram(p); throw new Error(reason); } return p; }
  function useCanvas(rt, label) { rt.ctx = rt.fallbackCanvas.getContext("2d"); rt.glCanvas.hidden = true; rt.fallbackCanvas.hidden = false; if (!rt.ctx) { rt.state.renderer = "none"; rt.state.error = "Thiết bị không cung cấp WebGL2 hoặc Canvas 2D."; rendererLabel(rt, "Không có renderer"); setStatus(rt, "error", rt.state.error); announce(rt, rt.state.error); return false; } rt.state.renderer = "canvas"; rendererLabel(rt, label); announce(rt, label); return true; }
  function rendererLabel(rt, label) { const el = rt.root.querySelector("[data-solar3d-renderer]"); if (el) el.textContent = label; }

  function disposeGL(rt) {
    if (rt.gl && rt.gpu) { if (rt.gpu.pointBuffer) rt.gl.deleteBuffer(rt.gpu.pointBuffer); for (const buffer of rt.gpu.orbitBuffers || []) rt.gl.deleteBuffer(buffer); for (const key of ["points", "lines"]) if (rt.gpu[key]) rt.gl.deleteProgram(rt.gpu[key]); }
    rt.gl = null; rt.gpu = null;
  }

  function rebuildOrbitBuffers(rt) {
    if (!rt.gl || !rt.gpu) return;
    for (const buffer of rt.gpu.orbitBuffers || []) rt.gl.deleteBuffer(buffer);
    rt.gpu.orbitBuffers = rt.orbits.map((orbit) => {
      const buffer = rt.gl.createBuffer();
      rt.gl.bindBuffer(rt.gl.ARRAY_BUFFER, buffer);
      rt.gl.bufferData(rt.gl.ARRAY_BUFFER, new Float32Array(orbit.points.flatMap((value) => displayPosition(value, rt.state.scaleMode))), rt.gl.STATIC_DRAW);
      return buffer;
    });
  }

  function displayPosition(v, mode = "educational") {
    // All modes retain direction. Only "scientific" retains the linear AU distance relation.
    const d = Math.hypot(v.x, v.y, v.z); if (!d) return [0, 0, 0];
    const shown = mode === "scientific" ? d * .58 : mode === "cinematic" ? Math.sqrt(d) * 3.7 : 5.2 * Math.log1p(d * 2.2);
    return [v.x / d * shown, v.z / d * shown, v.y / d * shown];
  }

  function matrix(rt) {
    const { width, height } = rt.glCanvas; const aspect = width / Math.max(1, height); const c = rt.state.camera;
    const projection = perspective(48 * DEG, aspect, .1, 400); const target = [c.panX, c.panY, c.panZ];
    const eye = [target[0] + Math.sin(c.yaw) * Math.cos(c.pitch) * c.distance, target[1] + Math.sin(c.pitch) * c.distance, target[2] + Math.cos(c.yaw) * Math.cos(c.pitch) * c.distance];
    return multiply(projection, lookAt(eye, target, [0, 1, 0]));
  }
  function perspective(fov, aspect, near, far) { const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far); return [f / aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]; }
  function lookAt(eye, target, up) { const z = norm(sub(eye, target)), x = norm(cross(up, z)), y = cross(z, x); return [x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0, -dot(x,eye),-dot(y,eye),-dot(z,eye),1]; }
  function multiply(a, b) { const out = new Array(16); for (let c=0;c<4;c+=1) for(let r=0;r<4;r+=1) out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3]; return out; }
  function transform(m, p) { const w=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15]; return [(m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12])/w,(m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13])/w,(m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14])/w]; }
  function sub(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]];} function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];} function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];} function norm(a){const d=Math.hypot(...a)||1;return a.map((v)=>v/d);}

  function draw(rt) {
    if (!rt.state.mounted || rt.state.hidden) return;
    if (rt.gl && rt.gpu) drawGL(rt); else if (rt.ctx) drawCanvas(rt);
    projectBodies(rt); updateLabels(rt);
  }

  function scenePoints(rt) {
    const points = [];
    for (const star of rt.stars) points.push(...star, .55, .68, .94, (rt.state.quality === "high" ? 1.8 : 1.2) * rt.pixelRatio, 0);
    for (let index = 0; index < BODIES.length; index += 1) { const body = BODIES[index], v = rt.positions.get(body.id); if (!v) continue; const ringSpace = body.id === "saturn" ? 9 : 0; const selected = body.id === rt.state.selectedBody ? 6 : 0; points.push(...displayPosition(v, rt.state.scaleMode), ...body.color, (body.size + ringSpace + selected) * rt.pixelRatio, index + 1); }
    return new Float32Array(points);
  }

  function drawGL(rt) {
    const gl=rt.gl, gpu=rt.gpu, m=new Float32Array(matrix(rt)); gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight); gl.clearColor(.003,.006,.025,1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(gpu.lines); gl.uniformMatrix4fv(gl.getUniformLocation(gpu.lines,"u_matrix"),false,m); const lp=gl.getAttribLocation(gpu.lines,"a_position"); gl.enableVertexAttribArray(lp); gl.uniform4f(gl.getUniformLocation(gpu.lines,"u_color"),.25,.65,1,.28);
    rt.orbits.forEach((orbit,index)=>{const buffer=gpu.orbitBuffers[index];if(!buffer)return;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.vertexAttribPointer(lp,3,gl.FLOAT,false,0,0);gl.drawArrays(gl.LINE_LOOP,0,orbit.points.length);});
    const data=scenePoints(rt); gl.useProgram(gpu.points); gl.uniformMatrix4fv(gl.getUniformLocation(gpu.points,"u_matrix"),false,m); gl.bindBuffer(gl.ARRAY_BUFFER,gpu.pointBuffer); gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW); const stride=8*4, pp=gl.getAttribLocation(gpu.points,"a_position"), cp=gl.getAttribLocation(gpu.points,"a_color"), sp=gl.getAttribLocation(gpu.points,"a_size"), kp=gl.getAttribLocation(gpu.points,"a_kind"); gl.enableVertexAttribArray(pp);gl.vertexAttribPointer(pp,3,gl.FLOAT,false,stride,0);gl.enableVertexAttribArray(cp);gl.vertexAttribPointer(cp,3,gl.FLOAT,false,stride,12);gl.enableVertexAttribArray(sp);gl.vertexAttribPointer(sp,1,gl.FLOAT,false,stride,24);gl.enableVertexAttribArray(kp);gl.vertexAttribPointer(kp,1,gl.FLOAT,false,stride,28);gl.drawArrays(gl.POINTS,0,data.length/8);
  }

  function drawCanvas(rt) {
    const ctx=rt.ctx,w=rt.fallbackCanvas.width,h=rt.fallbackCanvas.height,m=matrix(rt); ctx.clearRect(0,0,w,h); ctx.fillStyle="#010208";ctx.fillRect(0,0,w,h);
    for(const star of rt.stars){const p=transform(m,star);if(p[2]>1)continue;ctx.fillStyle="rgba(180,210,255,.65)";ctx.fillRect((p[0]+1)*w/2,(1-p[1])*h/2,Math.max(1,1.2*rt.pixelRatio),Math.max(1,1.2*rt.pixelRatio));}
    ctx.strokeStyle="rgba(85,174,255,.28)";ctx.lineWidth=1;for(const orbit of rt.orbits){ctx.beginPath();orbit.points.forEach((v,i)=>{const p=transform(m,displayPosition(v,rt.state.scaleMode)),x=(p[0]+1)*w/2,y=(1-p[1])*h/2;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();ctx.stroke();}
    for(const body of BODIES){const v=rt.positions.get(body.id);if(!v)continue;const p=transform(m,displayPosition(v,rt.state.scaleMode));if(p[2]>1)continue;const x=(p[0]+1)*w/2,y=(1-p[1])*h/2,r=(body.id===rt.state.selectedBody?body.size+5:body.size)*rt.pixelRatio/2;const radius=Math.max(2*rt.pixelRatio,r);if(body.id==="saturn"){ctx.save();ctx.translate(x,y);ctx.rotate(-.22);ctx.scale(1,.34);ctx.strokeStyle="rgba(244,211,142,.86)";ctx.lineWidth=Math.max(1.5,1.2*rt.pixelRatio);ctx.beginPath();ctx.arc(0,0,radius*1.8,0,TAU);ctx.stroke();ctx.restore();}const glow=ctx.createRadialGradient(x-radius*.3,y-radius*.35,1,x,y,radius);glow.addColorStop(0,"rgba(255,255,255,.98)");glow.addColorStop(.22,`rgb(${body.color.map((n)=>Math.round(n*255)).join(",")})`);glow.addColorStop(1,"rgba(0,0,0,.9)");ctx.beginPath();ctx.fillStyle=glow;ctx.arc(x,y,radius,0,TAU);ctx.fill();}
  }

  function projectBodies(rt) { const m=matrix(rt),w=rt.stage.clientWidth,h=rt.stage.clientHeight;rt.projected.clear();for(const body of BODIES){const v=rt.positions.get(body.id);if(!v)continue;const p=transform(m,displayPosition(v,rt.state.scaleMode));rt.projected.set(body.id,{x:(p[0]+1)*w/2,y:(1-p[1])*h/2,visible:p[2]>=-1&&p[2]<=1});} }
  function updateLabels(rt) {
    const layer=rt.root.querySelector("[data-solar3d-labels]"); layer.hidden=!rt.state.labels;
    if(!rt.state.labels)return;
    const width=rt.stage.clientWidth,height=rt.stage.clientHeight,placed=[];
    const ordered=[...BODIES].sort((a,b)=>Number(b.id===rt.state.selectedBody)-Number(a.id===rt.state.selectedBody));
    for(const body of ordered){
      const p=rt.projected.get(body.id),label=rt.labelNodes.get(body.id),selected=body.id===rt.state.selectedBody;
      if(!p?.visible){label.hidden=true;continue;}
      const labelWidth=Math.min(220,Math.max(70,body.name.length*7.4+22)),labelHeight=28,gap=body.size+13;
      const candidates=[[p.x,p.y-gap],[p.x+gap+labelWidth/2,p.y],[p.x-gap-labelWidth/2,p.y],[p.x,p.y+gap]];
      let chosen=null;
      for(const [rawX,rawY] of candidates){
        const x=clamp(rawX,labelWidth/2+8,width-labelWidth/2-8),y=clamp(rawY,labelHeight/2+8,height-labelHeight/2-8);
        const rect={left:x-labelWidth/2-4,right:x+labelWidth/2+4,top:y-labelHeight/2-4,bottom:y+labelHeight/2+4};
        if(!placed.some((item)=>rect.left<item.right&&rect.right>item.left&&rect.top<item.bottom&&rect.bottom>item.top)){chosen={x,y,rect};break;}
      }
      if(!chosen&&!selected){label.hidden=true;continue;}
      if(!chosen){const x=clamp(p.x,labelWidth/2+8,width-labelWidth/2-8),y=clamp(p.y-gap,labelHeight/2+8,height-labelHeight/2-8);chosen={x,y,rect:{left:x-labelWidth/2,right:x+labelWidth/2,top:y-labelHeight/2,bottom:y+labelHeight/2}};}
      placed.push(chosen.rect);label.hidden=false;label.dataset.selected=String(selected);label.style.left=`${chosen.x}px`;label.style.top=`${chosen.y}px`;
    }
  }
  function pick(rt,event,canvas){const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;let best=null,distance=22;for(const [id,p] of rt.projected){const d=Math.hypot(p.x-x,p.y-y);if(p.visible&&d<distance){best=id;distance=d;}}if(best)selectRuntime(rt,best);}

  function focusSelected(rt){const value=rt.positions.get(rt.state.selectedBody);const target=value?displayPosition(value,rt.state.scaleMode):[0,0,0];rt.state.camera.panX=target[0];rt.state.camera.panY=target[1];rt.state.camera.panZ=target[2];}
  function selectRuntime(rt,id,moveCamera=true){const body=BODIES.find((item)=>item.id===String(id).toLowerCase());if(!body)return false;rt.state.selectedBody=body.id;rt.state.targetLocked=true;rt.root.dataset.solar3dTargetLocked="true";rt.root.querySelectorAll("[data-solar3d-body]").forEach((button)=>{const selected=button.dataset.solar3dBody===body.id;button.setAttribute("aria-pressed",String(selected));button.classList.toggle("is-selected",selected);});if(moveCamera)rt.state.camera.distance=Math.min(rt.state.camera.distance,rt.state.scaleMode==="scientific"?18:24);focusSelected(rt);updateInspector(rt);updateLabels(rt);draw(rt);announce(rt,`Đang theo dõi ${body.name}`);return true;}
  function updateInspector(rt){const body=BODIES.find((item)=>item.id===rt.state.selectedBody),v=rt.positions.get(body.id);rt.root.querySelector("[data-solar3d-selected-name]").textContent=body.name;rt.root.querySelector("[data-solar3d-selected-meta]").textContent=`${body.meta} · ${formatDate(rt.state.time)}`;for(const key of ["x","y","z"]){rt.root.querySelector(`[data-field="${key}"]`).textContent=v?`${v[key].toFixed(6)} AU`:"—";}rt.root.querySelector('[data-field="distance"]').textContent=v?`${Math.hypot(v.x,v.y,v.z).toFixed(6)} AU`:"—";}
  function updateTimeRuntime(rt,date,syncRange=true){rt.state.time=normalizeDate(date);if(syncRange){const origin=new Date();origin.setHours(0,0,0,0);rt.root.querySelector("[data-solar3d-time-range]").value=String(clamp(Math.round((rt.state.time-origin)/86400000),-3650,3650));}updateEphemeris(rt,true);focusSelected(rt);syncControls(rt);return api;}
  function setQualityRuntime(rt,quality){if(!QUALITY[quality])throw new RangeError("Chất lượng phải là low, medium hoặc high");rt.state.quality=quality;buildStars(rt);updateEphemeris(rt,true,false);resizeRuntime(rt);syncControls(rt);announce(rt,`Chất lượng đồ họa ${quality}`);return api;}
  function syncTimeControls(rt){const output=rt.root.querySelector("[data-solar3d-time-value]"),date=rt.root.querySelector("[data-solar3d-date]"),range=rt.root.querySelector("[data-solar3d-time-range]");output.textContent=formatDate(rt.state.time);if(document.activeElement!==date)date.value=localDateTimeValue(rt.state.time);const origin=new Date();origin.setHours(0,0,0,0);range.value=String(clamp(Math.round((rt.state.time-origin)/86400000),-3650,3650));}
  function syncControls(rt){const play=rt.root.querySelector("[data-solar3d-play]");play.setAttribute("aria-pressed",String(rt.state.playing));play.textContent=rt.state.playing?"Tạm dừng":`Phát · ${rt.state.speed} ngày/giây`;const labels=rt.root.querySelector("[data-solar3d-label-toggle]");labels.setAttribute("aria-pressed",String(rt.state.labels));const q=rt.root.querySelector("[data-solar3d-quality]");q.textContent=`Chất lượng: ${rt.state.quality}`;q.setAttribute("aria-pressed",String(rt.state.quality==="high"));syncTimeControls(rt);rt.root.querySelector("[data-solar3d-speed]").value=String(rt.state.speed);rt.root.querySelector("[data-solar3d-scale]").value=rt.state.scaleMode;rt.root.querySelector("[data-solar3d-legend]").textContent=`Vị trí và quỹ đạo: Astronomy Engine · ${rt.state.scaleMode==="scientific"?"Khoảng cách tuyến tính theo AU":"Khoảng cách hiển thị minh họa"} · Kích thước/màu: minh họa`;}
  function setStatus(rt,state,message){const el=rt.root.querySelector("[data-solar3d-status]");el.dataset.state=state;el.textContent=message;}
  function announce(rt,message){const el=rt.root.querySelector("[data-solar3d-live]");if(el)el.textContent=message;}
  function toast(rt,message){const el=rt.root.querySelector("[data-solar3d-toast]");el.textContent=message;el.hidden=false;global.clearTimeout(rt.toastTimer);rt.toastTimer=global.setTimeout(()=>{if(rt.state.mounted)el.hidden=true;},2400);}
  function formatDate(date){return DATE_FORMATTER.format(date);}
  function localDateTimeValue(date){const pad=(value)=>String(value).padStart(2,"0");return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;}

  function resizeRuntime(rt){const ratio=Math.min(global.devicePixelRatio||1,rt.state.quality==="high"?2:1.5),rect=rt.stage.getBoundingClientRect();rt.pixelRatio=ratio;for(const canvas of [rt.glCanvas,rt.fallbackCanvas]){const w=Math.max(1,Math.round(rect.width*ratio)),h=Math.max(1,Math.round(rect.height*ratio));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}}draw(rt);return api;}
  function schedule(rt){if(!rt.state.mounted||rt.state.hidden||rt.raf)return;rt.raf=requestAnimationFrame((now)=>frame(rt,now));}
  function frame(rt,now){rt.raf=0;if(!rt.state.mounted||rt.state.hidden)return;const delta=Math.min(100,now-(rt.lastFrame||now));rt.lastFrame=now;let sceneChanged=false;if(rt.state.playing){rt.state.time=new Date(rt.state.time.getTime()+delta*86400*rt.state.speed);if(now-rt.lastEphemerisFrame>=250){rt.lastEphemerisFrame=now;updateEphemeris(rt,false,false);syncTimeControls(rt);sceneChanged=true;}}if(sceneChanged)draw(rt);if(rt.state.playing)schedule(rt);}

  function unmountRuntime(rt){rt.state.mounted=false;cancelAnimationFrame(rt.raf);rt.raf=0;global.clearTimeout(rt.toastTimer);global.clearTimeout(rt.initTimer);cancelOrbitBuild(rt);rt.resizeObserver?.disconnect();for(const off of rt.listeners.splice(0))off();disposeGL(rt);rt.pointers.clear();rt.positions.clear();rt.orbits=[];if(rt.host.contains(rt.root))rt.host.removeChild(rt.root);}

  const api={
    mount(host,options={}){if(!host||typeof host.querySelector!=="function")throw new TypeError("mount cần một phần tử host");if(runtime)unmountRuntime(runtime);runtime=createRuntime(host,options);return api;},
    updateTime(date){if(!runtime)return api;if(!runtime.state.initialized){runtime.state.time=normalizeDate(date);syncControls(runtime);return api;}return updateTimeRuntime(runtime,date);},
    selectBody(id){if(!runtime)return false;return selectRuntime(runtime,id);},
    setQuality(quality){if(!runtime)return api;const normalized=String(quality).toLowerCase();if(!runtime.state.initialized){if(!QUALITY[normalized])throw new RangeError("Chất lượng phải là low, medium hoặc high");runtime.state.quality=normalized;buildStars(runtime);syncControls(runtime);return api;}return setQualityRuntime(runtime,normalized);},
    resize(){if(runtime?.state.initialized)resizeRuntime(runtime);return api;},
    unmount(){if(runtime){unmountRuntime(runtime);runtime=null;}return api;},
    getState(){if(!runtime)return{mounted:false};const s=runtime.state;return{mounted:s.mounted,initialized:s.initialized,renderer:s.renderer,quality:s.quality,selectedBody:s.selectedBody,time:new Date(s.time.getTime()),playing:s.playing,hidden:s.hidden,contextLost:s.contextLost,error:s.error,labels:s.labels,speed:s.speed,scaleMode:s.scaleMode,targetLocked:s.targetLocked,orbitReady:!runtime.orbitBuildNeeded&&runtime.orbits.length>0,camera:{...s.camera}};}
  };

  if (typeof window!=="undefined") window.HHUniverseSolar3D=api;
  else global.HHUniverseSolar3D=api;
})(typeof window!=="undefined"?window:globalThis);
