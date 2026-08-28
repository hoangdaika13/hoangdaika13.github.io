(function initHHLanguageLearningCockpit(root) {
  "use strict";

  /*
   * A small, shared navigation layer for the three HH language centres.
   * The language engines remain independent (and keep their own local-first
   * stores); this file only supplies the journey rail, quick actions and the
   * transition state.  Keeping it outside each engine's host means a redraw
   * of a lesson cannot erase the rail or the learner's focus.
   */
  const VERSION = 2;
  const DESCRIPTORS = Object.freeze([
    Object.freeze({
      id: "english",
      label: "HH English",
      native: "English",
      icon: "E",
      accent: "#59e7ff",
      secondary: "#e7b84d",
      description: "Từ PRE-A1 đến C2, giao tiếp, nghề nghiệp và luyện nghe–nói–đọc–viết.",
      corpus: "CEFR A0–C2",
      next: "japanese",
      previous: "chinese",
      actions: Object.freeze([
        ["/english", "⌂", "Hôm nay", "Nhiệm vụ tiếp theo và tiến độ"],
        ["/english/galaxy", "Aa", "Kho từ vựng", "Từ theo cấp và chủ đề"],
        ["/english/lab", "⌘", "Practice Lab", "Nghe, nói, gõ và phản xạ"],
        ["/english/career", "◈", "Career English", "Học theo nghề nghiệp"]
      ])
    }),
    Object.freeze({
      id: "japanese",
      label: "HH Japanese",
      native: "日本語",
      icon: "日",
      accent: "#b5322f",
      secondary: "#d8ad55",
      description: "JLPT, JF, hội thoại đời sống, Kanji, trợ từ và shadowing.",
      corpus: "42.301 từ · 30.000 câu",
      next: "chinese",
      previous: "english",
      actions: Object.freeze([
        ["/japanese", "⌂", "Hôm nay", "Nhiệm vụ và review đến hạn"],
        ["/japanese/practice", "◎", "Phòng luyện tập", "Active Vocabulary và Particle Lab"],
        ["/japanese/lookup", "漢", "Từ điển & Kanji", "Tra cứu, nét và ví dụ"],
        ["/japanese/immersion", "◌", "Smart Reader", "Đọc câu n+1 và shadowing"]
      ])
    }),
    Object.freeze({
      id: "chinese",
      label: "HH Chinese",
      native: "中文",
      icon: "中",
      accent: "#c23b32",
      secondary: "#d5a43a",
      description: "Từ số 0 đến HSK 9: Pinyin, Hán tự, SRS, đọc–nghe–nói.",
      corpus: "50.000 mục tra cứu · HSK 1–9",
      next: "english",
      previous: "japanese",
      actions: Object.freeze([
        ["/chinese", "⌂", "Hôm nay", "Lộ trình và nhiệm vụ 15 phút"],
        ["/chinese/pinyin", "声", "Pinyin & Tone", "Thanh điệu và luyện nói"],
        ["/chinese/vocabulary", "词", "Bộ học cá nhân", "SRS, thẻ khó và từ mới"],
        ["/chinese/reading-nebula", "阅", "Smart Reader", "Đọc, tóm tắt và dịch"]
      ])
    })
  ]);
  const byId = new Map(DESCRIPTORS.map((item) => [item.id, item]));
  let active = null;

  const esc = (value) => String(value ?? "").replace(/[<>&"']/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[char]));
  const normalizeRoute = (value) => {
    const route = String(value || "").split("?")[0].replace(/^#/, "");
    return route.startsWith("/") ? route : `/${route}`;
  };
  const descriptorForRoute = (route) => {
    const value = normalizeRoute(route);
    return DESCRIPTORS.find((item) => value === `/${item.id}` || value.startsWith(`/${item.id}/`)) || null;
  };
  const formatCount = (value) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number.toLocaleString("vi-VN") : "—";
  };
  const readProgress = (descriptor) => {
    try {
      if (descriptor.id === "english") {
        const api = root.HHEnglishLearningOS;
        const state = api?.readState?.() || {};
        const completed = Object.keys(state.completed || {}).filter((key) => state.completed[key]).length;
        return { primary: completed ? `${completed} bài hoàn tất` : "Sẵn sàng bắt đầu", secondary: `${formatCount(root.HHEnglish?.courses?.length || 0)} khóa` };
      }
      if (descriptor.id === "japanese") {
        const api = root.HHJapanese;
        return { primary: `${formatCount(api?.words?.length)} từ đã nạp`, secondary: `${formatCount(api?.sentenceCount)} câu có nguồn` };
      }
      const api = root.HHChinese;
      return { primary: `${formatCount(api?.LARGE_CATALOG_COUNT || 50000)} mục tra cứu`, secondary: `${formatCount(api?.VIEWS?.length)} phòng học` };
    } catch (_) {
      return { primary: descriptor.corpus, secondary: "Local-first" };
    }
  };
  const currentMotion = () => {
    if (root.matchMedia?.("(prefers-reduced-motion: reduce)").matches || root.document?.body?.dataset?.appEffects === "off" || root.document?.body?.classList?.contains("app-reduce-motion")) return "static";
    return root.document?.body?.dataset?.appEffects === "full" ? "cinematic" : "balanced";
  };
  const progressMarkup = (descriptor) => {
    const progress = readProgress(descriptor);
    return `<div class="hh-language-cockpit__stats" aria-label="Tóm tắt ${esc(descriptor.label)}"><span><b>${esc(progress.primary)}</b><small>${esc(descriptor.corpus)}</small></span><span><b>${esc(progress.secondary)}</b><small>Dữ liệu tại thiết bị</small></span></div>`;
  };
  const actionMarkup = (descriptor, currentRoute) => descriptor.actions.map(([route, icon, title, detail]) => `<button type="button" class="hh-language-cockpit__action${normalizeRoute(currentRoute) === route ? " is-current" : ""}" data-language-route="${esc(route)}"><i aria-hidden="true">${esc(icon)}</i><span><b>${esc(title)}</b><small>${esc(detail)}</small></span><em aria-hidden="true">→</em></button>`).join("");
  const nodeMarkup = (descriptor, current) => `<button type="button" class="hh-language-cockpit__node${descriptor.id === current.id ? " is-current" : ""}" data-language-route="/${descriptor.id}" style="--language-accent:${descriptor.accent};--language-secondary:${descriptor.secondary}" aria-current="${descriptor.id === current.id ? "page" : "false"}"><span class="hh-language-cockpit__node-orb">${esc(descriptor.icon)}</span><span><b>${esc(descriptor.label)}</b><small>${esc(descriptor.native)}</small></span></button>`;
  const render = (workspace, descriptor, route) => {
    let host = workspace.querySelector("[data-language-cockpit]");
    if (!host) {
      host = workspace.ownerDocument?.createElement?.("section") || root.document.createElement("section");
      host.dataset.languageCockpit = "";
      const languageHost = workspace.querySelector("[data-hh-english-host], [data-hh-japanese-host], [data-hh-chinese-host]");
      if (languageHost) languageHost.before(host); else workspace.prepend(host);
    }
    const motion = currentMotion();
    host.className = "hh-language-cockpit";
    host.dataset.language = descriptor.id;
    host.dataset.motion = motion;
    host.dataset.transition = "ready";
    host.setAttribute("aria-label", `${descriptor.label} · Language Learning Cockpit`);
    const next = byId.get(descriptor.next);
    const previous = byId.get(descriptor.previous);
    host.innerHTML = `<div class="hh-language-cockpit__backdrop" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><b></b></div><header class="hh-language-cockpit__header"><div class="hh-language-cockpit__identity"><span class="hh-language-cockpit__planet" aria-hidden="true">${esc(descriptor.icon)}</span><div><small>HH LANGUAGE LEARNING · ${esc(descriptor.native)}</small><h2>${esc(descriptor.label)}</h2><p>${esc(descriptor.description)}</p></div></div><div class="hh-language-cockpit__journey"><button type="button" data-language-route="/${previous.id}" aria-label="Mở ${esc(previous.label)}">‹ ${esc(previous.label)}</button><div class="hh-language-cockpit__dots" aria-label="Chọn trung tâm ngôn ngữ">${DESCRIPTORS.map((item) => `<i class="${item.id === descriptor.id ? "is-active" : ""}" style="--dot:${item.accent}" title="${esc(item.label)}"></i>`).join("")}</div><button type="button" class="is-next" data-language-route="/${next.id}">${esc(next.label)} ›</button></div></header><div class="hh-language-cockpit__body"><div class="hh-language-cockpit__actions"><div class="hh-language-cockpit__section-label"><span>LỘ TRÌNH HỌC TẬP</span><small>Chọn đúng kỹ năng cần luyện</small></div><div class="hh-language-cockpit__action-grid">${actionMarkup(descriptor, route)}</div></div><aside class="hh-language-cockpit__orbit"><span class="hh-language-cockpit__section-label"><span>TRUNG TÂM NGÔN NGỮ</span><small>Ba hồ sơ tiến độ tách biệt</small></span><div class="hh-language-cockpit__nodes">${DESCRIPTORS.map((item) => nodeMarkup(item, descriptor)).join("")}</div>${progressMarkup(descriptor)}</aside></div><footer class="hh-language-cockpit__footer"><span class="hh-language-cockpit__status" role="status" aria-live="polite"><i></i><b>Đã sẵn sàng</b><small>Tiến độ được lưu riêng trên thiết bị của bạn</small></span><button type="button" class="hh-language-cockpit__continue" data-language-route="/${next.id}"><span>Trung tâm tiếp theo</span><b>${esc(next.label)} <strong>→</strong></b></button></footer>`;
    return host;
  };
  const navigate = (route) => {
    const target = normalizeRoute(route);
    if (!descriptorForRoute(target)) return;
    if (root.location) root.location.hash = `#${target}`;
  };
  const handleClick = (event) => {
    const target = event.target.closest?.("[data-language-route]");
    if (!target || !active) return;
    event.preventDefault();
    const route = target.dataset.languageRoute;
    const status = active.host.querySelector(".hh-language-cockpit__status");
    if (status) status.innerHTML = `<i></i><b>Đang mở ${esc(descriptorForRoute(route)?.label || "workspace")}…</b><small>Đang dựng lớp chuyển cảnh an toàn</small>`;
    active.host.dataset.transition = "departing";
    navigate(route);
  };
  const handleTransitionStart = (event) => {
    if (!active) return;
    const descriptor = descriptorForRoute(event.detail?.route);
    if (!descriptor) return;
    active.host.dataset.transition = "departing";
    active.host.style.setProperty("--transition-accent", descriptor.accent);
  };
  const handleTransitionComplete = (event) => {
    if (!active) return;
    const descriptor = descriptorForRoute(event.detail?.route);
    if (!descriptor || descriptor.id !== active.descriptor.id) return;
    active.host.dataset.transition = "arriving";
    const status = active.host.querySelector(".hh-language-cockpit__status");
    if (status) status.innerHTML = `<i></i><b>Đã sẵn sàng</b><small>${esc(descriptor.label)} · bắt đầu khi bạn muốn</small>`;
    root.setTimeout?.(() => { if (active?.host) active.host.dataset.transition = "ready"; }, 520);
  };
  const handleVisibility = () => {
    if (active?.host) active.host.classList.toggle("is-tab-hidden", Boolean(root.document?.hidden));
  };
  const unmount = () => {
    if (!active) return;
    active.host?.removeEventListener?.("click", handleClick);
    root.removeEventListener?.("hh:route-transition-start", handleTransitionStart);
    root.removeEventListener?.("hh:route-transition-complete", handleTransitionComplete);
    root.document?.removeEventListener?.("visibilitychange", handleVisibility);
    active = null;
  };
  const mount = (workspace, options = {}) => {
    if (!workspace?.querySelector) return null;
    const route = normalizeRoute(options.route || root.location?.hash || "/english");
    const descriptor = descriptorForRoute(route);
    if (!descriptor) { unmount(); return null; }
    if (active?.workspace === workspace && active.descriptor.id === descriptor.id) {
      active.host?.removeEventListener?.("click", handleClick);
      active.host = render(workspace, descriptor, route);
      active.host?.addEventListener?.("click", handleClick);
      active.route = route;
      return active;
    }
    unmount();
    const host = render(workspace, descriptor, route);
    active = { workspace, host, descriptor, route };
    host.addEventListener("click", handleClick);
    root.addEventListener?.("hh:route-transition-start", handleTransitionStart);
    root.addEventListener?.("hh:route-transition-complete", handleTransitionComplete);
    root.document?.addEventListener?.("visibilitychange", handleVisibility);
    handleVisibility();
    return active;
  };
  const sync = (route) => {
    const descriptor = descriptorForRoute(route);
    if (!descriptor) { unmount(); return; }
    const workspace = root.document?.getElementById?.("appWorkspace");
    if (workspace) mount(workspace, { route });
  };
  root.addEventListener?.("hh:route-rendered", (event) => sync(event.detail?.route || root.location?.hash));
  root.addEventListener?.("hh:assets-ready", (event) => {
    if (descriptorForRoute(event.detail?.route)) sync(event.detail.route);
  });
  if (typeof module !== "undefined" && module.exports) module.exports = { VERSION, DESCRIPTORS, descriptorForRoute };
  root.HHLanguageLearningCockpit = Object.freeze({ VERSION, DESCRIPTORS, descriptorForRoute, mount, unmount });
})(typeof window !== "undefined" ? window : globalThis);
