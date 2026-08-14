(function (global) {
  "use strict";

  const VERSION = 2;
  const GREETING = "Xin chào! Mình là Hikari H, trợ lý điều hành của HH Platform. Mình có thể giúp bạn mở công cụ, tìm nhiệm vụ, kiểm tra lịch học hoặc tiếp tục công việc gần nhất.";
  const HOME_ROUTE = /^#\/home(?:$|[/?])/;
  let host = null;
  let controller = null;
  let character = null;
  let state = null;
  let statusTimer = 0;
  let idleTimer = 0;
  let mounted = false;
  let hostObserver = null;
  let preferences = null;
  let pendingAction = null;

  const core = () => global.HHVirtualAssistantCore;
  const commands = () => global.HHVirtualAssistantCommands;
  const actions = () => global.HHVirtualAssistantActions;
  const voice = () => global.HHVirtualAssistantVoice;
  const characterApi = () => global.HHVirtualAssistantCharacter;
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const homeActive = () => !location.hash || HOME_ROUTE.test(location.hash);
  const shellUnlocked = () => document.body?.classList.contains("auth-unlocked") === true;
  const assistantActive = () => {
    const next = core()?.loadPreferences?.();
    return Boolean(shellUnlocked() && next?.enabled && (next.showOnAllPages || homeActive()));
  };
  const $ = (selector) => host?.querySelector(selector);
  const $$ = (selector) => [...(host?.querySelectorAll(selector) || [])];

  function markup() {
    return `<section class="hva" data-hva-root data-hva-state="loading" data-hva-quality="${escapeHtml(state.quality)}" data-hva-open="${state.open}" data-hva-minimized="${state.minimized}" aria-label="Trợ lý ảo Hikari H">
      <button class="hva-core" type="button" data-hva-action="toggle" aria-label="Mở trợ lý Hikari H" aria-expanded="${state.open && !state.minimized}"><i>H</i><b></b><span data-hva-core-badge hidden>0</span></button>
      <div class="hva-panel" data-hva-panel ${state.open && !state.minimized ? "" : "hidden"}>
        <header class="hva-head" data-hva-drag-handle>
          <div><span class="hva-live-dot"></span><p><small>HH VIRTUAL ASSISTANT</small><strong>Hikari H</strong></p></div>
          <nav aria-label="Điều khiển Hikari">
            <button type="button" data-hva-action="history" aria-label="Lịch sử hội thoại">◷</button>
            <button type="button" data-hva-action="settings" aria-label="Cài đặt trợ lý">⚙</button>
            <button type="button" data-hva-action="minimize" aria-label="Thu nhỏ trợ lý">−</button>
            <button type="button" data-hva-action="close" aria-label="Đóng trợ lý">×</button>
          </nav>
        </header>
        <div class="hva-stage" data-hva-character-host>
          <div class="hva-rim" aria-hidden="true"></div><div class="hva-particles" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
          <img data-hva-character-image src="assets/hikari-h/hikari-h-original-v1-alpha.webp" alt="Hikari H, trợ lý khoa học viễn tưởng nguyên bản của HH Platform">
          <span class="hva-eye-glow" aria-hidden="true"></span><span class="hva-mouth" aria-hidden="true"></span><span class="hva-shadow" aria-hidden="true"></span>
          <small class="hva-model-state" data-hva-model-state>Hikari nữ anime · ảnh nguyên bản</small>
        </div>
        <div class="hva-dialogue" role="status" aria-live="polite">
          <span class="hva-speaker">H</span><p data-hva-transcript>Hikari đang khởi động...</p>
          <button type="button" data-hva-action="stop-voice" aria-label="Dừng giọng nói" hidden>■</button>
        </div>
        <div class="hva-status"><span data-hva-status>Đang tải nhân vật</span><em data-hva-mode>Local Assistant</em></div>
        <div class="hva-action-preview" data-hva-action-preview hidden></div>
        <div class="hva-voice-consent" data-hva-voice-consent ${state.voiceEnabled ? "hidden" : ""}>
          <button type="button" data-hva-action="enable-voice">♪ Bật giọng nói cho Hikari</button><small>Chỉ phát sau thao tác của bạn</small>
        </div>
        <form class="hva-command" data-hva-form>
          <label><span class="sr-only">Nhập yêu cầu cho Hikari</span><input name="command" maxlength="600" autocomplete="off" placeholder="Ví dụ: Mở HH Japanese..."></label>
          <button type="button" data-hva-action="listen" aria-label="Nói chuyện với Hikari">◉<span>Nói</span></button>
          <button type="submit" aria-label="Gửi yêu cầu">➤</button>
        </form>
        <div class="hva-quick" aria-label="Lệnh nhanh">
          <button type="button" data-hva-command="Hôm nay tôi có việc gì?">Việc hôm nay</button>
          <button type="button" data-hva-command="Tôi có bài học nào đến hạn?">Bài đến hạn</button>
          <button type="button" data-hva-command="Kiểm tra trạng thái website">Website</button>
        </div>
        <aside class="hva-drawer" data-hva-drawer hidden>
          <header><strong data-hva-drawer-title>Cài đặt</strong><button type="button" data-hva-action="drawer-close" aria-label="Đóng bảng">×</button></header>
          <div data-hva-drawer-content></div>
        </aside>
      </div>
    </section>`;
  }

  function ensurePortal() {
    if (!host || host.parentElement === document.body) return;
    document.body.append(host);
  }

  function setStatus(label, mode = "Local Assistant") {
    const statusNode = $("[data-hva-status]");
    const modeNode = $("[data-hva-mode]");
    if (statusNode) statusNode.textContent = label;
    if (modeNode) modeNode.textContent = mode;
  }

  function setTranscript(text, role = "assistant", remember = true) {
    const safe = String(text || "").replace(/\s+/g, " ").trim().slice(0, 900);
    const node = $("[data-hva-transcript]");
    if (node) node.textContent = safe;
    if (remember && safe) {
      state.history = [...state.history, { role, text: safe, at: new Date().toISOString() }].slice(-40);
      core().save(state);
    }
  }

  function setCharacterState(next) {
    character?.setState?.(next);
    if (host) host.dataset.hvaState = next;
    const shell = $("[data-hva-root]");
    if (shell) shell.dataset.hvaState = next;
  }

  function syncDialogueFromHistory() {
    if (host?.dataset.hvaInteracted === "true") return;
    const last = state?.history?.at?.(-1);
    if (last?.text) setTranscript(last.text, last.role || "assistant", false);
    const characterState = $("[data-hva-character-host]")?.dataset.hvaState;
    if (characterState) setCharacterState(characterState);
  }

  function recoverCharacterState() {
    const characterHost = $("[data-hva-character-host]");
    const next = characterHost?.dataset.hvaState;
    if (next) setCharacterState(next);
  }

  function bindInlineActions() {
    if (!host) return;
    host.onclick = (event) => Promise.resolve(handleClick(event)).catch((error) => { setTranscript(error.message); setStatus("Có lỗi", "Local Assistant"); });
    host.onchange = handleChange;
    host.onsubmit = handleSubmit;
  }

  async function loadCharacterForCurrentHost() {
    character?.destroy?.();
    const CharacterAdapter = characterApi().CharacterAdapter;
    character = new CharacterAdapter($("[data-hva-character-host]"), {
      quality: state.quality,
      fallbackImage: "assets/hikari-h/hikari-h-original-v1-alpha.webp"
    });
    const asset = await character.load();
    const assetLabel = $("[data-hva-model-state]");
    if (assetLabel) assetLabel.textContent = asset === "anime-2d-original" ? "Hikari nữ anime · ảnh nguyên bản" : "Hikari nữ anime · ảnh dự phòng";
    return asset;
  }

  async function adoptCurrentHost() {
    const current = document.getElementById("hhVirtualAssistantHost");
    if (!current || current === host || !assistantActive()) return false;
    host = current;
    host.dataset.hvaQuality = state.quality;
    host.dataset.hvaAnimation = String(state.animationEnabled);
    await loadCharacterForCurrentHost();
    bindInlineActions();
    syncOpenState();
    syncDialogueFromHistory();
    setStatus("Sẵn sàng", "Local Assistant");
    return true;
  }

  function ensureCurrentHost() {
    const current = document.getElementById("hhVirtualAssistantHost");
    if (!current || current === host) return;
    host = current;
    bindInlineActions();
    syncOpenState();
    syncDialogueFromHistory();
    loadCharacterForCurrentHost().catch(() => {});
  }

  function playEffect(kind = "open") {
    if (!state.soundEnabled) return;
    try {
      const Ctx = global.AudioContext || global.webkitAudioContext;
      if (!Ctx) return;
      const context = playEffect.context ||= new Ctx();
      const gain = context.createGain();
      const oscillator = context.createOscillator();
      const tones = { open: 540, planet: 720, complete: 860, warning: 240, warp: 1100 };
      oscillator.type = kind === "warning" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(tones[kind] || 540, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(160, (tones[kind] || 540) * .72), context.currentTime + .11);
      gain.gain.setValueAtTime(.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.025, context.currentTime + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .13);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(); oscillator.stop(context.currentTime + .15);
    } catch {}
  }

  async function speak(text) {
    if (!preferences?.enabled) return { spoken: false, disabled: true };
    setTranscript(text);
    if (!state.voiceEnabled) {
      setCharacterState("idle");
      setStatus("Sẵn sàng", "Local Assistant");
      return { spoken: false };
    }
    setCharacterState("speaking");
    const providerLabels = { browser: "Web Speech · tiếng Việt", google: "Google Cloud TTS", openai: "OpenAI TTS", selfhost: "TTS self-host" };
    setStatus("Đang nói", providerLabels[state.voiceProvider] || "Web Speech fallback");
    $("[data-hva-action='stop-voice']")?.removeAttribute("hidden");
    const result = await voice().speak(text, state, {
      onLip: (value) => character?.lip?.(value),
      onFallback: (message) => setStatus(`Cloud lỗi · dùng giọng trình duyệt`, message),
      onEnd: () => character?.lip?.(0)
    });
    $("[data-hva-action='stop-voice']")?.setAttribute("hidden", "");
    setCharacterState("idle");
    setStatus("Sẵn sàng", providerLabels[result.provider] || "Local Assistant");
    return result;
  }

  async function askAi(input, context) {
    if (!preferences?.cloudAiAllowed) return { reply: "AI cloud đang tắt trong cài đặt riêng của bạn. Các lệnh local và mở chức năng vẫn hoạt động bình thường.", provider: "offline" };
    const token = global.HHAuthSession?.token?.() || "";
    if (!token) return { reply: "Lệnh này chưa có trong bộ điều khiển local. AI đang ngoại tuyến ở chế độ khách.", provider: "offline" };
    try {
      const response = await fetch("/api/modules/hikari-assistant/actions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ input: `${input}\n\nDữ liệu tổng hợp đã xác minh: ${JSON.stringify({ taskCount: context.taskCount, lessonDue: context.lessonDue, unreadCount: context.unreadCount, online: context.online, apiStatus: context.apiStatus })}`, actionType: "assistant-chat", meta: { requireProvider: true, allowProviderFallback: true, systemPrompt: "Chỉ trả lời câu hỏi hiện tại; không đưa lệnh hay URL." } })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "AI không phản hồi.");
      return { reply: String(data.action?.output || "AI không trả về nội dung.").slice(0, 900), provider: data.action?.provider || "AI" };
    } catch {
      return { reply: "AI đang ngoại tuyến. Bạn vẫn có thể dùng các lệnh mở công cụ, kiểm tra việc và bài học.", provider: "offline" };
    }
  }

  function navigateSafe(route) {
    if (!actions()?.safeRoute?.(route) && !commands().safeRoute(route)) return false;
    setCharacterState("pointing");
    playEffect("warp");
    host?.classList.add("is-warping");
    setTimeout(() => {
      if (actions()?.safeRoute?.(route) || commands().safeRoute(route)) location.hash = `#${route}`;
      host?.classList.remove("is-warping");
    }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 380);
    return true;
  }

  function applyControl(control) {
    if (control === "voice-off") { state.voiceEnabled = false; voice().stop(); }
    if (control === "voice-on") state.voiceEnabled = true;
    if (control === "minimize") minimize();
    if (control === "open") open();
    core().save(state);
    syncOpenState();
  }

  async function executeCommand(input) {
    ensureCurrentHost();
    const cleanInput = String(input || "").replace(/\s+/g, " ").trim().slice(0, 600);
    if (!cleanInput) return false;
    if (host) host.dataset.hvaInteracted = "true";
    setTranscript(cleanInput, "user");
    setCharacterState("thinking");
    setStatus("Đang suy nghĩ", "Local Assistant");
    const context = core().context();
    const plan = actions()?.prepare?.(cleanInput, context);
    if (plan?.matched) {
      plan.originalInput = cleanInput;
      if (plan.confirmationRequired) {
        pendingAction = plan;
        renderActionPreview(plan);
        setCharacterState(plan.risk === "destructive" ? "warning" : "explaining");
        setStatus("Chờ bạn xác nhận", riskLabel(plan.risk));
        setTranscript(plan.summary, "assistant");
        return true;
      }
      const executed = await executePreparedAction(plan, false);
      await speak(executed.reply);
      return true;
    }
    const result = commands().match(cleanInput, context);
    if (result.matched) {
      if (result.kind === "control") applyControl(result.control);
      await speak(result.reply);
      if (result.kind === "route") navigateSafe(result.route);
      return true;
    }
    const ai = await askAi(cleanInput, context);
    setStatus(ai.provider === "offline" ? "AI đang ngoại tuyến" : "Đã nhận phản hồi", ai.provider);
    await speak(ai.reply);
    return true;
  }

  function riskLabel(risk) {
    return actions()?.RISKS?.[risk]?.label || "Hành động Hikari";
  }

  function renderActionPreview(plan) {
    const node = $("[data-hva-action-preview]");
    if (!node) return;
    if (!plan) { node.hidden = true; node.innerHTML = ""; return; }
    const target = plan.route ? `<small>Đích: ${escapeHtml(plan.route)}</small>` : "";
    node.innerHTML = `<header><span data-risk="${escapeHtml(plan.risk)}">${escapeHtml(riskLabel(plan.risk))}</span><strong>Hikari chuẩn bị làm</strong></header><p>${escapeHtml(plan.summary)}</p>${target}<div><button type="button" data-hva-action="confirm-action">Xác nhận</button><button type="button" data-hva-action="edit-action">Chỉnh lại</button><button type="button" data-hva-action="cancel-action">Hủy</button></div>`;
    node.hidden = false;
  }

  async function executePreparedAction(plan, confirmed) {
    const result = await actions().execute(plan, {
      confirmed,
      context: core().context(),
      permissions: preferences,
      storage: global.localStorage,
      navigate: navigateSafe
    });
    pendingAction = null;
    renderActionPreview(null);
    setStatus(result.completed ? "Đã hoàn tất" : result.status === "handoff" ? "Đã mở quy trình" : "Sẵn sàng", result.completed ? "Hikari Action" : "Cần xác nhận tại công cụ");
    setCharacterState(result.completed ? "celebrating" : "pointing");
    setTimeout(() => setCharacterState("idle"), 900);
    return result;
  }

  function syncOpenState() {
    if (!host) return;
    const expanded = state.open && !state.minimized;
    host.dataset.hvaOpen = String(state.open);
    host.dataset.hvaMinimized = String(state.minimized);
    $("[data-hva-panel]")?.toggleAttribute("hidden", !expanded);
    const coreButton = $("[data-hva-action='toggle']");
    coreButton?.setAttribute("aria-expanded", String(expanded));
    coreButton?.setAttribute("aria-label", expanded ? "Thu nhỏ trợ lý Hikari H" : "Mở trợ lý Hikari H");
  }

  function open() {
    state.open = true; state.minimized = false;
    core().save(state); syncOpenState(); setCharacterState("greeting"); playEffect("open");
    setTimeout(() => setCharacterState("idle"), 700);
  }

  function close() {
    state.open = false; state.minimized = false;
    voice().stop(); setCharacterState("goodbye"); core().save(state); syncOpenState();
  }

  function minimize() {
    state.minimized = true; state.open = true;
    voice().stop(); setCharacterState("minimized"); core().save(state); syncOpenState();
  }

  function settingsMarkup() {
    const voiceOptions = voice().catalog().map((item) => `<option value="${escapeHtml(item.voiceURI)}" ${item.voiceURI === state.voiceURI ? "selected" : ""}>${escapeHtml(item.name)} · ${escapeHtml(item.lang)}${item.gender === "female-estimated" ? " · nữ*" : item.gender === "male-estimated" ? " · nam*" : ""}</option>`).join("");
    const presets = voice().PRESETS.map((item) => `<option value="${item.id}" ${item.id === state.voicePreset ? "selected" : ""}>${escapeHtml(item.label)}${item.gender === "female" ? " · nữ" : " · nam"}</option>`).join("");
    const googleVoices = voice().GOOGLE_VOICES.map((item) => `<option value="${item.id}" ${item.id === state.googleVoice ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("");
    const openaiVoices = voice().OPENAI_VOICES.map((item) => `<option value="${item}" ${item === state.openaiVoice ? "selected" : ""}>${escapeHtml(item)}</option>`).join("");
    return `<div class="hva-settings">
      <section class="hva-permissions" aria-label="Quyền Hikari">
        <strong>Hikari trên tài khoản này</strong>
        <label class="hva-switch"><input data-hva-preference="enabled" type="checkbox" ${preferences.enabled ? "checked" : ""}><span>Bật trợ lý Hikari</span></label>
        <label class="hva-switch"><input data-hva-preference="showOnAllPages" type="checkbox" ${preferences.showOnAllPages ? "checked" : ""}><span>Hiển thị trên mọi trang</span></label>
        <label class="hva-switch"><input data-hva-preference="microphoneAllowed" type="checkbox" ${preferences.microphoneAllowed ? "checked" : ""}><span>Cho phép dùng microphone khi bấm Nói</span></label>
        <label class="hva-switch"><input data-hva-preference="cloudAiAllowed" type="checkbox" ${preferences.cloudAiAllowed ? "checked" : ""}><span>Cho phép hỏi AI cloud</span></label>
        <label class="hva-switch"><input data-hva-preference="allowLocalActions" type="checkbox" ${preferences.allowLocalActions ? "checked" : ""}><span>Cho phép tác vụ local sau xác nhận</span></label>
        <small>Tác vụ đăng, gửi, xóa hoặc đổi quyền luôn phải xác nhận; không thể tắt lớp bảo vệ này.</small>
      </section>
      <label><span>Phong cách giọng <b>Mặc định nữ Việt</b></span><select data-hva-setting="voicePreset">${presets}</select></label>
      <label><span>Nguồn giọng</span><select data-hva-setting="voiceProvider"><option value="browser" ${state.voiceProvider === "browser" ? "selected" : ""}>Trình duyệt · miễn phí, không cần khóa</option><option value="google" ${state.voiceProvider === "google" ? "selected" : ""}>Google Cloud · có hạn mức miễn phí, cần billing</option><option value="openai" ${state.voiceProvider === "openai" ? "selected" : ""}>OpenAI · tính phí theo API</option><option value="selfhost" ${state.voiceProvider === "selfhost" ? "selected" : ""}>TTS GitHub self-host · cần máy chủ riêng</option></select></label>
      <label><span>Giọng trình duyệt <b>* giới tính ước tính theo tên</b></span><select data-hva-setting="voiceURI"><option value="">Tự chọn nữ tiếng Việt tốt nhất</option>${voiceOptions}</select></label>
      <label><span>Giọng Google Việt Nam</span><select data-hva-setting="googleVoice">${googleVoices}</select></label>
      <label><span>Giọng OpenAI</span><select data-hva-setting="openaiVoice">${openaiVoices}</select></label>
      <label><span>Giọng self-host do máy chủ ánh xạ</span><select data-hva-setting="selfhostVoice"><option value="vi-female-1" ${state.selfhostVoice === "vi-female-1" ? "selected" : ""}>Nữ Việt 1 · mặc định</option><option value="vi-female-2" ${state.selfhostVoice === "vi-female-2" ? "selected" : ""}>Nữ Việt 2</option><option value="vi-male-1" ${state.selfhostVoice === "vi-male-1" ? "selected" : ""}>Nam Việt 1</option><option value="vi-male-2" ${state.selfhostVoice === "vi-male-2" ? "selected" : ""}>Nam Việt 2</option></select></label>
      <button class="hva-preview-voice" type="button" data-hva-action="preview-voice">▶ Nghe thử giọng đã chọn</button>
      <label><span>Tốc độ <b>${state.rate.toFixed(2)}</b></span><input data-hva-setting="rate" type="range" min="0.65" max="1.5" step="0.05" value="${state.rate}"></label>
      <label><span>Cao độ <b>${state.pitch.toFixed(2)}</b></span><input data-hva-setting="pitch" type="range" min="0.7" max="1.5" step="0.05" value="${state.pitch}"></label>
      <label><span>Âm lượng <b>${Math.round(state.volume * 100)}%</b></span><input data-hva-setting="volume" type="range" min="0" max="1" step="0.05" value="${state.volume}"></label>
      <label><span>Chất lượng</span><select data-hva-setting="quality"><option value="static" ${state.quality === "static" ? "selected" : ""}>Tĩnh</option><option value="balanced" ${state.quality === "balanced" ? "selected" : ""}>Cân bằng</option><option value="cinematic" ${state.quality === "cinematic" ? "selected" : ""}>Điện ảnh</option></select></label>
      <label class="hva-switch"><input data-hva-setting="soundEnabled" type="checkbox" ${state.soundEnabled ? "checked" : ""}><span>Âm thanh hiệu ứng</span></label>
      <label class="hva-switch"><input data-hva-setting="animationEnabled" type="checkbox" ${state.animationEnabled ? "checked" : ""}><span>Chuyển động nhân vật</span></label>
      <p>Web Speech miễn phí phụ thuộc giọng cài trên thiết bị. Google Cloud có hạn mức miễn phí nhưng yêu cầu bật billing. Self-host chỉ hoạt động sau khi quản trị viên xác minh giấy phép code, model và dữ liệu giọng; không clone giọng nếu chưa có đồng ý rõ ràng.</p>
      <p>Dữ liệu gửi AI: câu bạn nhập và bốn số liệu tổng hợp cần thiết. Khóa API chỉ nằm trên server; không gửi token, toàn bộ localStorage hoặc audio thô.</p>
    </div>`;
  }

  function historyMarkup() {
    return `<div class="hva-history">${state.history.slice().reverse().map((item) => `<article><b>${item.role === "user" ? "Bạn" : "Hikari"}</b><p>${escapeHtml(item.text)}</p><small>${new Date(item.at).toLocaleString("vi-VN")}</small></article>`).join("") || "<p>Chưa có hội thoại trong hồ sơ này.</p>"}<button type="button" data-hva-action="clear-history">Xóa lịch sử trên thiết bị</button></div>`;
  }

  function openDrawer(kind) {
    const drawer = $("[data-hva-drawer]");
    if (!drawer) return;
    drawer.hidden = false;
    $("[data-hva-drawer-title]").textContent = kind === "history" ? "Lịch sử riêng tư" : "Cài đặt Hikari";
    $("[data-hva-drawer-content]").innerHTML = kind === "history" ? historyMarkup() : settingsMarkup();
  }

  function closeDrawer() { $("[data-hva-drawer]")?.setAttribute("hidden", ""); }

  async function listen() {
    if (!preferences?.microphoneAllowed) {
      setCharacterState("warning");
      setTranscript("Microphone đang tắt cho hồ sơ này. Hãy mở Cài đặt Hikari và bật ‘Cho phép dùng microphone khi bấm Nói’.", "assistant");
      setStatus("Microphone đang tắt", "Quyền riêng tư");
      return false;
    }
    setCharacterState("listening"); setStatus("Đang nghe · microphone bật", "Speech recognition");
    try {
      const transcript = await voice().listen({
        onInterim: (text) => setTranscript(text, "user", false),
        onEnd: () => setStatus("Đã tắt microphone", "Local Assistant")
      });
      if (transcript) await executeCommand(transcript);
    } catch (error) {
      setCharacterState("warning"); setTranscript(error.message, "assistant"); setStatus("Không thể nghe", "Microphone đã tắt");
    } finally {
      setTimeout(() => setCharacterState("idle"), 450);
    }
  }

  function resetIdle() {
    clearTimeout(idleTimer);
    if (document.hidden) return;
    idleTimer = setTimeout(() => { if (host?.isConnected) setCharacterState("sleeping"); }, 90_000);
    if (host?.dataset.hvaState === "sleeping") setCharacterState("idle-look-around");
  }

  function handleClick(event) {
    ensureCurrentHost();
    resetIdle();
    const commandButton = event.target.closest("[data-hva-command]");
    if (commandButton) return executeCommand(commandButton.dataset.hvaCommand);
    const button = event.target.closest("[data-hva-action]");
    if (!button) return;
    const action = button.dataset.hvaAction;
    if (action === "confirm-action") {
      if (!pendingAction) return renderActionPreview(null);
      button.disabled = true;
      return executePreparedAction(pendingAction, true).then((result) => speak(result.reply)).catch((error) => {
        button.disabled = false; setCharacterState("warning"); setStatus("Không thể thực hiện", "Hikari Action"); setTranscript(error.message, "assistant");
      });
    }
    if (action === "cancel-action") { pendingAction = null; renderActionPreview(null); setCharacterState("idle"); setStatus("Đã hủy", "Không có thay đổi"); return setTranscript("Đã hủy. Hikari chưa thay đổi dữ liệu nào.", "assistant"); }
    if (action === "edit-action") {
      const input = $("[data-hva-form] input[name=command]");
      if (input && pendingAction?.originalInput) input.value = pendingAction.originalInput;
      pendingAction = null; renderActionPreview(null); input?.focus(); return;
    }
    if (action === "toggle") return state.open && !state.minimized ? minimize() : open();
    if (action === "minimize") return minimize();
    if (action === "close") return close();
    if (action === "settings" || action === "history") return openDrawer(action);
    if (action === "drawer-close") return closeDrawer();
    if (action === "enable-voice") {
      state.voiceEnabled = true; core().save(state); button.closest("[data-hva-voice-consent]").hidden = true;
      return speak("Giọng nói đã được bật. Mình sẵn sàng hỗ trợ bạn.");
    }
    if (action === "stop-voice") { voice().stop(); character?.lip?.(0); setCharacterState("idle"); return setStatus("Đã dừng giọng nói"); }
    if (action === "listen") return listen();
    if (action === "preview-voice") {
      state.voiceEnabled = true; core().save(state);
      return speak("Xin chào, mình là Hikari. Đây là giọng tiếng Việt bạn vừa chọn.");
    }
    if (action === "clear-history") { state.history = []; core().save(state); return openDrawer("history"); }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const input = event.target?.elements?.command || event.currentTarget?.elements?.command;
    if (!input) return;
    const value = input.value; input.value = "";
    executeCommand(value);
  }

  function handleChange(event) {
    const preferenceField = event.target.closest("[data-hva-preference]");
    if (preferenceField) {
      const key = preferenceField.dataset.hvaPreference;
      preferences = core().savePreferences({ [key]: preferenceField.checked === true });
      if (key === "microphoneAllowed" && !preferences.microphoneAllowed) voice().stop();
      if (key === "enabled" && !preferences.enabled) { setTimeout(unmount, 0); return; }
      if (key === "showOnAllPages" && !preferences.showOnAllPages && !homeActive()) { setTimeout(unmount, 0); return; }
      openDrawer("settings");
      return;
    }
    const field = event.target.closest("[data-hva-setting]");
    if (!field) return;
    const key = field.dataset.hvaSetting;
    state[key] = field.type === "checkbox" ? field.checked : (["rate", "pitch", "volume"].includes(key) ? Number(field.value) : field.value);
    if (key === "voicePreset") {
      const selected = voice().preset(state.voicePreset);
      state.rate = selected.rate; state.pitch = selected.pitch;
      state.googleVoice = selected.googleVoice; state.openaiVoice = selected.openaiVoice;
    }
    core().save(state);
    if (key === "quality") { host.dataset.hvaQuality = state.quality; character.quality = state.quality; character.renderer?.setQuality?.(state.quality); character.start(); }
    if (key === "animationEnabled") host.dataset.hvaAnimation = String(state.animationEnabled);
    openDrawer("settings");
  }

  function bindDrag() {
    const handle = $("[data-hva-drag-handle]");
    if (!handle || matchMedia("(max-width: 700px)").matches) return;
    let dragging = false; let offsetX = 0; let offsetY = 0;
    handle.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      const rect = host.getBoundingClientRect(); dragging = true; offsetX = event.clientX - rect.left; offsetY = event.clientY - rect.top;
      handle.setPointerCapture?.(event.pointerId);
    }, { signal: controller.signal });
    handle.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      state.x = Math.min(innerWidth - host.offsetWidth - 8, Math.max(8, event.clientX - offsetX));
      state.y = Math.min(innerHeight - host.offsetHeight - 8, Math.max(70, event.clientY - offsetY));
      host.style.left = `${state.x}px`; host.style.top = `${state.y}px`; host.style.right = "auto"; host.style.bottom = "auto";
    }, { signal: controller.signal });
    handle.addEventListener("pointerup", () => { if (dragging) core().save(state); dragging = false; }, { signal: controller.signal });
  }

  function updateSignals() {
    if (!host) return;
    const context = core().context();
    const badge = $("[data-hva-core-badge]");
    const signals = context.taskCount + context.lessonDue + context.unreadCount;
    badge.textContent = String(Math.min(99, signals)); badge.hidden = !signals;
    if (!context.online) setCharacterState("warning");
  }

  function onPlanetSelected(event) {
    const planet = event.target.closest?.("[data-hgc-planet]");
    if (!planet || !host?.isConnected) return;
    const label = planet.querySelector("strong")?.textContent?.trim() || "hành tinh";
    const description = planet.getAttribute("aria-label")?.split(":").slice(1).join(":").trim() || "";
    setCharacterState("pointing"); playEffect("planet"); setTranscript(`${label}: ${description}`, "assistant");
    if (state.voiceEnabled) speak(`${label}. ${description}`);
    else setTimeout(() => setCharacterState("idle"), 900);
  }

  async function mount(target = document.body) {
    if (!core() || !commands() || !actions() || !voice() || !characterApi()) return false;
    preferences = core().loadPreferences();
    if (!assistantActive()) { unmount(); return false; }
    if (mounted && host?.isConnected) { recoverCharacterState(); updateSignals(); return true; }
    unmount();
    state = core().load();
    const existingHost = document.getElementById("hhVirtualAssistantHost");
    host = existingHost || document.createElement("div");
    host.id = "hhVirtualAssistantHost";
    if (!existingHost) {
      host.innerHTML = markup();
      target.append(host);
    } else {
      const current = host.querySelector("[data-hva-root]");
      state.open = host.dataset.hvaOpen !== "false";
      state.minimized = host.dataset.hvaMinimized === "true";
      if (!current) host.innerHTML = markup();
    }
    ensurePortal();
    mounted = true;
    controller = new AbortController();
    host.addEventListener("pointermove", (event) => { resetIdle(); character?.setPointer?.(event.clientX, event.clientY); }, { signal: controller.signal, passive: true });
    document.addEventListener("click", onPlanetSelected, { signal: controller.signal, capture: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { clearTimeout(idleTimer); voice().stop(); }
      else { resetIdle(); setStatus("Sẵn sàng"); }
    }, { signal: controller.signal });
    global.addEventListener("resize", () => { if (matchMedia("(max-width: 700px)").matches) { host.style.left = ""; host.style.top = ""; host.style.right = ""; host.style.bottom = ""; } }, { signal: controller.signal, passive: true });
    if (Number.isFinite(state.x) && Number.isFinite(state.y) && !matchMedia("(max-width: 700px)").matches) {
      host.style.left = `${Math.max(8, Math.min(innerWidth - 320, state.x))}px`;
      host.style.top = `${Math.max(70, Math.min(innerHeight - 420, state.y))}px`;
      host.style.right = "auto"; host.style.bottom = "auto";
    }
    const saveData = navigator.connection?.saveData;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (saveData || reduced || state.animationEnabled === false) state.quality = "static";
    host.dataset.hvaQuality = state.quality;
    host.dataset.hvaAnimation = String(state.animationEnabled);
    await loadCharacterForCurrentHost();
    bindInlineActions(); bindDrag(); syncOpenState(); updateSignals(); resetIdle();
    hostObserver?.disconnect?.();
    hostObserver = new MutationObserver(() => {
      const current = document.getElementById("hhVirtualAssistantHost");
      if (!current || !assistantActive()) return;
      if (current !== host) adoptCurrentHost().catch(() => {});
      else {
        ensurePortal();
        bindInlineActions();
        recoverCharacterState();
        if ($("[data-hva-transcript]")?.textContent?.includes("đang khởi động")) syncDialogueFromHistory();
      }
    });
    hostObserver.observe(document.body, { childList: true });
    clearInterval(statusTimer); statusTimer = setInterval(() => { if (!document.hidden) updateSignals(); }, 10_000);
    setStatus("Sẵn sàng", "Local Assistant");
    const greetingKey = `hh.hikari.greeted:${core().ownerId()}:${core().profileId()}`;
    if (state.open && !state.minimized && !sessionStorage.getItem(greetingKey)) {
      sessionStorage.setItem(greetingKey, "1"); setCharacterState("greeting"); setTranscript(GREETING);
      setTimeout(() => setCharacterState("idle"), 1200);
    } else syncDialogueFromHistory();
    setTimeout(syncDialogueFromHistory, 180);
    setTimeout(syncDialogueFromHistory, 900);
    setTimeout(ensurePortal, 60);
    setTimeout(ensurePortal, 800);
    setTimeout(() => adoptCurrentHost().catch(() => {}), 220);
    setTimeout(() => adoptCurrentHost().catch(() => {}), 1100);
    return true;
  }

  function unmount() {
    clearInterval(statusTimer); clearTimeout(idleTimer);
    hostObserver?.disconnect?.(); hostObserver = null;
    voice()?.stop?.(); character?.destroy?.(); character = null;
    controller?.abort?.(); controller = null;
    host?.remove?.(); host = null; mounted = false; pendingAction = null;
  }

  function setState(next) { return character?.setState?.(next) || false; }
  function routeSync() { if (assistantActive()) setTimeout(() => mount(), 120); else unmount(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", routeSync, { once: true }); else routeSync();
  addEventListener("hashchange", routeSync);
  addEventListener("hh:auth-change", () => { unmount(); routeSync(); });
  addEventListener("hh:route-rendered", routeSync);
  addEventListener("hh:assistant-preference-change", () => { preferences = core()?.loadPreferences?.() || preferences; if (preferences?.enabled) routeSync(); else unmount(); });
  addEventListener("hh:asset-group-ready", (event) => {
    if (!["assistant", "home-enhancements"].includes(event.detail?.group)) return;
    if (!assistantActive()) return;
    if (!host?.isConnected) routeSync();
    else recoverCharacterState();
  });

  function setEnabled(enabled) {
    preferences = core().setEnabled(enabled === true);
    if (preferences.enabled) routeSync(); else unmount();
    return preferences.enabled;
  }
  function isEnabled() { return core()?.isEnabled?.() === true; }
  function permissions() { return { ...(core()?.loadPreferences?.() || {}) }; }

  global.HHVirtualAssistant = Object.freeze({ VERSION, mount, unmount, speak, listen, setState, executeCommand, open, close, minimize, setEnabled, isEnabled, permissions });
})(window);
