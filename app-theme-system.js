(() => {
  "use strict";

  const STORAGE_KEY = "hh.command-center.theme.v1";
  const PREFERENCES_KEY = "hh.app-theme.preferences.v1";
  const WORKSPACE_SETTINGS_KEY = "hh.settings-studio.v1";
  const SHELL_STATE_KEY = "hh.app-shell.v1";
  const THEMES = Object.freeze({
    cosmic: { label: "Cosmic", note: "Thiên hà tím và cyan", color: "#72e7ff" },
    midnight: { label: "Midnight", note: "Đêm sâu tập trung", color: "#7094ff" },
    "basic-light": { label: "Basic Light", note: "SaaS sáng phổ biến", color: "#f8fafc", group: "basic" },
    "basic-dark": { label: "Basic Dark", note: "Tối tối giản", color: "#20242b", group: "basic" },
    slate: { label: "Slate", note: "Xám xanh chuyên nghiệp", color: "#64748b", group: "basic" },
    warm: { label: "Warm Neutral", note: "Trắng kem nhẹ mắt", color: "#e7e0d5", group: "basic" },
    dark: { label: "Dark", note: "Tối trung tính", color: "#70819b" },
    light: { label: "Light", note: "Sáng dễ đọc", color: "#f4f7fb" },
    cyberpunk: { label: "Cyberpunk", note: "Cyan và hồng", color: "#00f6ff" },
    ocean: { label: "Ocean", note: "Xanh đại dương", color: "#54e9ff" },
    aurora: { label: "Aurora", note: "Cực quang", color: "#6df0ce" },
    emerald: { label: "Emerald", note: "Lục bảo", color: "#59f2b4" },
    purple: { label: "Purple", note: "Tím thiên hà", color: "#c38bff" },
    sunset: { label: "Sunset", note: "Hoàng hôn", color: "#ff9b6a" },
    neon: { label: "Neon", note: "Tương phản cao", color: "#45f5ff" },
    glass: { label: "Glass", note: "Kính trong mờ", color: "#9edcff" }
  });
  const themeIds = Object.keys(THEMES);
  const themeButtons = (ids) => ids.map((id) => `<button type="button" data-app-theme-value="${id}" style="--theme-swatch:${THEMES[id].color}"><i></i><span><strong>${THEMES[id].label}</strong><small>${THEMES[id].note}</small></span><b>✓</b></button>`).join("");

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  };
  const preferences = () => ({ language: "vi", density: "comfortable", font: "modern", fontScale: "medium", textZoom: 100, radius: "soft", contrast: "standard", effects: "full", reducedMotion: false, ...read(PREFERENCES_KEY, {}) });

  function updateThemeControls(theme) {
    document.querySelectorAll("[data-app-theme-value],[data-theme-value]").forEach((button) => {
      const active = (button.dataset.appThemeValue || button.dataset.themeValue) === theme;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function applyTheme(theme, options = {}) {
    const value = themeIds.includes(theme) ? theme : "aurora";
    document.documentElement.dataset.appTheme = value;
    document.body.dataset.appTheme = value;
    document.body.dataset.dashboardTheme = value;
    const isLight = ["light", "basic-light", "warm"].includes(value);
    document.documentElement.style.colorScheme = isLight ? "light" : "dark";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isLight ? "#f6f7f9" : "#070b14");
    if (options.persist !== false) write(STORAGE_KEY, value);
    updateThemeControls(value);
    window.dispatchEvent(new CustomEvent("hh:theme-change", { detail: { theme: value } }));
    return value;
  }

  function applyPreferences(next = preferences(), options = {}) {
    const textZoom = Math.max(90, Math.min(150, Number(next.textZoom) || ({ small: 90, medium: 100, large: 110, xlarge: 120 }[next.fontScale]) || 100));
    const value = {
      language: ["vi", "en"].includes(next.language) ? next.language : "vi",
      density: ["comfortable", "compact"].includes(next.density) ? next.density : "comfortable",
      font: ["modern", "clean", "rounded", "mono"].includes(next.font) ? next.font : "modern",
      fontScale: ["small", "medium", "large", "xlarge"].includes(next.fontScale) ? next.fontScale : "medium",
      textZoom,
      radius: ["sharp", "soft", "round"].includes(next.radius) ? next.radius : "soft",
      contrast: ["standard", "high"].includes(next.contrast) ? next.contrast : "standard",
      effects: ["full", "calm", "off"].includes(next.effects) ? next.effects : "full",
      reducedMotion: Boolean(next.reducedMotion)
    };
    document.documentElement.lang = value.language;
    document.body.classList.toggle("app-density-compact", value.density === "compact");
    document.body.dataset.appFont = value.font;
    document.body.dataset.appFontScale = value.fontScale;
    document.body.style.setProperty("--app-font-scale", String(value.textZoom / 100));
    document.body.dataset.appRadius = value.radius;
    document.body.dataset.appContrast = value.contrast;
    document.body.dataset.appEffects = value.effects;
    document.body.classList.toggle("app-reduce-motion", value.reducedMotion || value.effects === "off");
    document.querySelectorAll("[data-dashboard-language] span").forEach((node) => {
      const label = value.language.toUpperCase();
      if (node.textContent !== label) node.textContent = label;
    });
    document.querySelectorAll("[data-app-preference]").forEach((control) => {
      const key = control.dataset.appPreference;
      if (!(key in value)) return;
      if (control.type === "checkbox") control.checked = Boolean(value[key]);
      else control.value = String(value[key]);
    });
    if (options.persist !== false) write(PREFERENCES_KEY, value);
    return value;
  }

  function applyWorkspaceSettings(source, options = {}) {
    const value = source && typeof source === "object" ? source : {};
    const appearance = value.appearance || {}, layout = value.layout || {}, motion = value.motion || {}, accessibility = value.accessibility || {}, locale = value.locale || {}, performance = value.performance || {};
    const effectLevel = ["static", "balanced", "cinematic"].includes(motion.level) ? motion.level : "balanced";
    const effects = effectLevel === "static" ? "off" : effectLevel === "balanced" ? "calm" : "full";
    applyTheme(appearance.theme || "cosmic", { persist: options.persist });
    applyPreferences({
      language: locale.language || "vi", density: appearance.density === "spacious" ? "comfortable" : appearance.density,
      font: appearance.font, fontScale: "medium", textZoom: appearance.textZoom,
      radius: appearance.radius, contrast: accessibility.highContrast ? "high" : "standard",
      effects, reducedMotion: accessibility.reducedMotion
    }, { persist: options.persist });
    const root = document.documentElement;
    root.style.setProperty("--hh-user-accent", /^#[0-9a-f]{6}$/i.test(appearance.accent || "") ? appearance.accent : "#72e7ff");
    root.style.setProperty("--hh-user-glow", /^#[0-9a-f]{6}$/i.test(appearance.glow || "") ? appearance.glow : "#b176ff");
    root.style.setProperty("--hh-user-glass", String(Math.max(.35, Math.min(.96, Number(appearance.glassOpacity || 72) / 100))));
    root.style.setProperty("--hh-user-sidebar-width", `${Math.max(216, Math.min(320, Number(layout.sidebarWidth) || 248))}px`);
    root.style.setProperty("--hh-user-motion-speed", String(100 / Math.max(50, Math.min(150, Number(motion.speed) || 100))));
    root.style.setProperty("--hh-user-particles", String(Math.max(0, Math.min(100, Number(motion.particles) || 0)) / 100));
    root.style.setProperty("--hh-user-glow-intensity", String(Math.max(0, Math.min(100, Number(motion.glowIntensity) || 0)) / 100));
    root.style.setProperty("--hh-user-bloom", String(Math.max(0, Math.min(100, Number(motion.bloom) || 0)) / 100));
    root.style.setProperty("--hh-max-fps", String(Math.max(24, Math.min(120, Number(performance.maxFps) || 60))));
    root.style.setProperty("--hh-max-dpr", String(Math.max(.75, Math.min(2, Number(performance.pixelRatio) || 1.5))));
    const lowSpec = motion.autoReduce !== false && ((Number(navigator.deviceMemory) || 8) <= 4 || (Number(navigator.hardwareConcurrency) || 8) <= 4 || navigator.connection?.saveData === true);
    document.body.dataset.hhFontWeight = appearance.fontWeight || "regular";
    document.body.dataset.hhShadow = appearance.shadow || "balanced";
    document.body.dataset.hhColorVision = accessibility.colorVision || "default";
    document.body.dataset.hhGraphics = lowSpec && performance.graphics === "auto" ? "low" : performance.graphics || "auto";
    document.body.dataset.hhSearchPosition = layout.searchPosition || "header";
    document.body.dataset.hhTimezone = locale.timezone || "Asia/Bangkok";
    document.body.dataset.hhDateFormat = locale.dateFormat || "dd/mm/yyyy";
    document.body.dataset.hhTimeFormat = locale.timeFormat || "24h";
    document.body.dataset.hhWeekStart = locale.weekStart || "monday";
    document.body.dataset.hhVoice = locale.voice || "vi-female";
    document.body.classList.toggle("app-sidebar-collapsed", matchMedia("(max-width: 760px)").matches || layout.sidebarCollapsed === true);
    document.body.classList.toggle("app-sidebar-auto-hide", layout.sidebarAutoHide === true);
    document.body.classList.toggle("app-sidebar-labels-hidden", layout.showSidebarLabels === false);
    document.body.classList.toggle("app-advanced-mode", layout.advancedMode === true);
    document.body.classList.toggle("app-workspace-fullscreen", layout.fullscreenWorkspace === true);
    document.body.classList.toggle("app-breadcrumb-compact", layout.breadcrumb === "compact");
    document.body.classList.toggle("app-breadcrumb-hidden", layout.breadcrumb === "hidden");
    document.body.classList.toggle("app-links-underlined", accessibility.underlineLinks === true);
    document.body.classList.toggle("app-focus-ring-disabled", accessibility.focusRing === false);
    document.body.classList.toggle("app-density-spacious", appearance.density === "spacious");
    document.body.classList.toggle("app-data-saver", performance.dataSaver === true);
    document.body.classList.toggle("app-disable-mobile-video", performance.disableMobileVideo !== false);
    document.body.classList.toggle("app-auto-effects-reduced", lowSpec);
    document.body.classList.toggle("app-effects-paused", motion.pauseHidden !== false && document.hidden);
    document.body.classList.add("hh-settings-applied");
    if (options.persist) {
      const shell = read(SHELL_STATE_KEY, {});
      write(SHELL_STATE_KEY, { ...shell, collapsed: layout.sidebarCollapsed === true, advanced: layout.advancedMode === true });
    }
    globalThis.dispatchEvent(new CustomEvent("hh:workspace-settings-applied", { detail: { settings: value, lowSpec } }));
    return value;
  }

  function ensureThemePanel() {
    let panel = document.getElementById("appThemePanel");
    if (panel) return panel;
    panel = document.createElement("section");
    panel.id = "appThemePanel";
    panel.className = "app-theme-panel";
    panel.setAttribute("aria-hidden", "true");
    panel.setAttribute("aria-label", "Giao diện toàn hệ thống");
    const basicThemes = themeIds.filter((id) => THEMES[id].group === "basic");
    const colorfulThemes = themeIds.filter((id) => THEMES[id].group !== "basic");
    panel.innerHTML = `<header><div><strong>Appearance Studio</strong><small>Màu sắc, chữ và mật độ cho toàn hệ thống</small></div><button type="button" data-app-theme-close aria-label="Đóng">×</button></header><section class="app-theme-section"><h3>Cơ bản <span>Ít màu · ít hiệu ứng</span></h3><div class="app-theme-panel__grid">${themeButtons(basicThemes)}</div></section><details class="app-theme-colorful"><summary>Giao diện màu sắc <span>${colorfulThemes.length} lựa chọn</span></summary><div class="app-theme-panel__grid">${themeButtons(colorfulThemes)}</div></details><details class="app-theme-advanced"><summary>Tùy chỉnh nâng cao <span>Font · cỡ chữ · hiệu ứng</span></summary><div><label>Font chữ<select data-app-preference="font"><option value="modern">Modern · Be Vietnam</option><option value="clean">Clean · Segoe UI</option><option value="rounded">Rounded · Trebuchet</option><option value="mono">Mono · Consolas</option></select></label><label>Cỡ chữ<select data-app-preference="fontScale"><option value="small">Nhỏ</option><option value="medium">Tiêu chuẩn</option><option value="large">Lớn</option><option value="xlarge">Rất lớn</option></select></label><label>Bo góc<select data-app-preference="radius"><option value="sharp">Vuông</option><option value="soft">Mềm</option><option value="round">Tròn</option></select></label><label>Mật độ<select data-app-preference="density"><option value="comfortable">Thoải mái</option><option value="compact">Gọn</option></select></label><label>Tương phản<select data-app-preference="contrast"><option value="standard">Tiêu chuẩn</option><option value="high">Cao</option></select></label><label>Hiệu ứng<select data-app-preference="effects"><option value="full">Đầy đủ</option><option value="calm">Nhẹ</option><option value="off">Tắt</option></select></label><label class="is-check"><input type="checkbox" data-app-preference="reducedMotion"><span>Giảm chuyển động</span></label></div></details><footer>Mọi lựa chọn được lưu riêng trên thiết bị này.</footer>`;
    document.body.append(panel);
    return panel;
  }

  function setPanelOpen(open) {
    const panel = ensureThemePanel();
    panel.classList.toggle("is-open", open);
    panel.setAttribute("aria-hidden", String(!open));
    document.querySelectorAll("[data-dashboard-theme-menu]").forEach((button) => button.setAttribute("aria-expanded", String(open)));
    if (open) {
      document.getElementById("appUserMenu")?.classList.remove("is-open");
      updateThemeControls(document.body.dataset.appTheme || "aurora");
    }
  }

  function ensureShortcutsDialog() {
    let dialog = document.getElementById("appShortcutsDialog");
    if (dialog) return dialog;
    dialog = document.createElement("dialog");
    dialog.id = "appShortcutsDialog";
    dialog.className = "app-shortcuts-dialog";
    dialog.innerHTML = `<header><div><strong>Phím tắt toàn hệ thống</strong><small>Thao tác nhanh ở mọi workspace</small></div><button type="button" data-app-shortcuts-close aria-label="Đóng">×</button></header><div>${[["Ctrl + K","Tìm kiếm toàn hệ thống"],["Esc","Đóng menu hoặc hộp thoại"],["Ctrl + U","Chọn video trong YouTube Studio"],["Ctrl + Shift + U","Tạo hàng đợi upload"],["Ctrl + Enter","Chạy kiểm tra trước upload"],["Alt + ↑ / ↓","Chuyển kênh YouTube"],["1 / 2 / 3","Chọn thumbnail A/B/C"],["Shift + Alt + T","Đổi theme kế tiếp"]].map(([key,label]) => `<p><kbd>${key}</kbd><span>${label}</span></p>`).join("")}</div>`;
    document.body.append(dialog);
    return dialog;
  }

  function cycleTheme() {
    const current = document.body.dataset.appTheme || "aurora";
    return applyTheme(themeIds[(themeIds.indexOf(current) + 1) % themeIds.length]);
  }

  function closeUserMenu() {
    const menu = document.getElementById("appUserMenu");
    menu?.classList.remove("is-open");
    menu?.setAttribute("aria-hidden", "true");
  }

  document.addEventListener("click", (event) => {
    const themeValue = event.target.closest("[data-app-theme-value]");
    if (themeValue) {
      event.preventDefault();
      event.stopImmediatePropagation();
      applyTheme(themeValue.dataset.appThemeValue);
      return;
    }
    if (event.target.closest("[data-dashboard-theme-menu]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const panel = ensureThemePanel();
      setPanelOpen(!panel.classList.contains("is-open"));
      return;
    }
    if (event.target.closest("[data-dashboard-theme-cycle]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      cycleTheme();
      return;
    }
    if (event.target.closest("[data-dashboard-language]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeUserMenu();
      location.hash = "#/settings";
      return;
    }
    if (event.target.closest("[data-dashboard-shortcuts]")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeUserMenu();
      ensureShortcutsDialog().showModal();
      return;
    }
    if (event.target.closest("[data-app-theme-close]")) return setPanelOpen(false);
    if (event.target.closest("[data-app-shortcuts-close]")) return ensureShortcutsDialog().close();
    if (document.getElementById("appThemePanel")?.classList.contains("is-open") && !event.target.closest("#appThemePanel")) setPanelOpen(false);
  }, true);

  document.addEventListener("change", (event) => {
    const control = event.target.closest("[data-app-preference]");
    if (!control) return;
    const next = preferences();
    next[control.dataset.appPreference] = control.type === "checkbox" ? control.checked : control.value;
    applyPreferences(next);
  });

  document.addEventListener("keydown", (event) => {
    if (event.shiftKey && event.altKey && event.key.toLowerCase() === "t") {
      event.preventDefault();
      cycleTheme();
    }
  });

  function init() {
    ensureThemePanel();
    ensureShortcutsDialog();
    applyTheme(read(STORAGE_KEY, "aurora"), { persist: false });
    applyPreferences();
    const workspaceSettings = read(WORKSPACE_SETTINGS_KEY, null)?.settings;
    if (workspaceSettings) applyWorkspaceSettings(workspaceSettings, { persist: false });
    const observer = new MutationObserver((records) => {
      const hasPreferenceControls = records.some((record) => Array.from(record.addedNodes).some((node) => node.nodeType === 1 && (node.matches?.("[data-app-preference]") || node.querySelector?.("[data-app-preference]"))));
      if (hasPreferenceControls) applyPreferences(preferences());
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();

  window.HHAppTheme = Object.freeze({
    apply: applyTheme,
    applyPreferences,
    applyWorkspaceSettings,
    cycle: cycleTheme,
    getPreferences: preferences,
    preferences: applyPreferences,
    themeDetails: THEMES,
    themes: themeIds
  });

  document.addEventListener("visibilitychange", () => {
    const settings = read(WORKSPACE_SETTINGS_KEY, null)?.settings;
    document.body.classList.toggle("app-effects-paused", settings?.motion?.pauseHidden !== false && document.hidden);
  });
})();
