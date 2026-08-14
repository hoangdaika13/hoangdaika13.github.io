(function (global, factory) {
  "use strict";
  const api = factory(global || {});
  if (typeof module === "object" && module.exports) module.exports = api;
  if (global) global.HHGalaxyControlDeck = api;
  if (global?.document) api.autoMount();
})(typeof globalThis !== "undefined" ? globalThis : this, function createGalaxyControlDeck(global) {
  "use strict";

  const VERSION = "3.0.0";
  const DRAFT_KEY = "hh.home.galaxy.preferences.draft.v3";
  const HISTORY_KEY = "hh.home.galaxy.preferences.history.v3";
  const SYNC_META_KEY = "hh.home.galaxy.sync.v1";
  const THEMES = Object.freeze([
    ["neon", "Neon Nebula", "#59efff", "#ff55ce"],
    ["purple", "Purple Galaxy", "#aa7dff", "#ff68d7"],
    ["solar", "Solar Fire", "#ffba55", "#ff547d"],
    ["deep", "Deep Space", "#4a78ff", "#7de7ff"],
    ["aurora", "Aurora Cyan", "#58f3ff", "#69ffb7"],
    ["magenta", "Magenta Supernova", "#ff4ecf", "#a971ff"],
    ["emerald", "Emerald Cosmos", "#58f5a8", "#bcff65"],
    ["quantum", "Blue Quantum", "#54a4ff", "#58f4ff"],
    ["golden", "Golden Eclipse", "#ffd75e", "#ff874a"],
    ["crimson", "Crimson Mars", "#ff654d", "#ff4c9f"],
    ["ice", "Ice Universe", "#d8fbff", "#78b7ff"],
    ["blackhole", "Black Hole", "#8c78ff", "#303c75"],
    ["time", "Theo thời gian", "#5eefff", "#ffb653"]
  ]);
  const MOTIONS = Object.freeze([
    ["off", "Tắt hoàn toàn", "Không chạy hoạt ảnh"],
    ["minimal", "Tối giản", "Chỉ giữ tín hiệu quan trọng"],
    ["balanced", "Cân bằng", "Mượt và tiết kiệm"],
    ["vivid", "Sống động", "Nhiều chiều sâu hơn"],
    ["cinematic", "Điện ảnh", "Chuyển động giàu lớp"],
    ["hyper", "Siêu không gian", "Cường độ tối đa"],
    ["adaptive", "Tự động theo FPS", "Tự giảm hiệu ứng khi máy chậm"]
  ]);
  const TABS = Object.freeze([
    ["appearance", "◉", "Giao diện", "#58f3ff"],
    ["motion", "↻", "Chuyển động", "#ff59d6"],
    ["planets", "●", "Hành tinh", "#a986ff"],
    ["orbit", "⌁", "LIVE ORBIT", "#67efbd"],
    ["events", "✦", "Hiệu ứng sự kiện", "#ffbd5a"],
    ["performance", "V", "Hiệu năng", "#baff62"],
    ["sound", "♫", "Âm thanh", "#ff7f9d"],
    ["sync", "◇", "Đồng bộ", "#7ea8ff"]
  ]);
  const PRESETS = Object.freeze([
    ["productivity", "Productivity", "□", "Task, dự án và tín hiệu cần xử lý"],
    ["creative", "Creative Studio", "✦", "AI, Media và màu sắc sống động"],
    ["developer", "Developer Mode", "⌘", "API, deployment và Website Health"],
    ["focus", "Focus Galaxy", "◎", "Một hành tinh, ít nhiễu và chuyển động"],
    ["cinematic", "Cinematic Universe", "◉", "Tối đa chiều sâu, hạt và plasma"],
    ["battery", "Battery Saver", "▱", "Giảm tải GPU và tần suất cập nhật"],
    ["accessibility", "Accessibility", "A", "Tương phản cao, chữ lớn, giảm động"],
    ["adaptive", "Auto Adaptive", "V", "Tự cân bằng theo FPS và thiết bị"]
  ]);
  const instances = new WeakMap();
  const mountedRoots = new Set();
  let observer = null;

  const asArray = (value) => Array.isArray(value) ? value : [];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const clean = (value, limit = 180) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[character]));
  const read = (key, fallback) => {
    try { return JSON.parse(global.localStorage?.getItem?.(key) || "null") ?? fallback; }
    catch { return fallback; }
  };
  const write = (key, value) => {
    try { global.localStorage?.setItem?.(key, JSON.stringify(value)); return true; }
    catch { return false; }
  };
  const same = (a, b) => {
    try { return JSON.stringify(a) === JSON.stringify(b); }
    catch { return false; }
  };
  const FALLBACK_PLANETS = Object.freeze(["creative", "work", "media", "dev", "communication", "learning", "analytics", "system"].map((id) => ({ id })));
  const FALLBACK_WIDGETS = Object.freeze(["weather", "performance", "vitals", "resources", "api", "services", "storage", "pwa", "network", "sync"].map((id) => ({ id })));
  const FALLBACK_ACTIONS = Object.freeze(["task", "ai", "asset", "note", "recent", "health", "search", "focus"].map((id) => ({ id, label: id, icon: "✦" })));
  const planetCatalog = () => {
    const catalog = asArray(global.HHHomeGalaxyMission?.PLANETS);
    return catalog.length ? catalog : FALLBACK_PLANETS;
  };
  const widgetCatalog = () => {
    const catalog = asArray(global.HHHomeGalaxyMission?.WIDGETS);
    return catalog.length ? catalog : FALLBACK_WIDGETS;
  };
  const actionCatalog = () => {
    const catalog = asArray(global.HHHomeGalaxyMission?.ACTIONS);
    return catalog.length ? catalog : FALLBACK_ACTIONS;
  };
  const normalized = (value) => global.HHHomeGalaxyMission?.normalizePrefs ? global.HHHomeGalaxyMission.normalizePrefs(value) : clone(value || {});
  const signedIn = () => {
    const user = read("hh-auth-user", {});
    return Boolean(global.HHAuthSession?.token?.() || user?.email || (user?.id && user?.guest !== true && user?.role !== "guest"));
  };
  const timeText = (value) => {
    const date = new Date(value || 0);
    return Number.isFinite(date.getTime()) && date.getTime() > 0
      ? date.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })
      : "Chưa có";
  };

  function themeTone(id) {
    const theme = THEMES.find((item) => item[0] === id) || THEMES[0];
    return { primary: theme[2], secondary: theme[3] };
  }

  function applyPreset(base, id) {
    const next = clone(base || {});
    const widgets = widgetCatalog().map((item) => item.id);
    const planets = planetCatalog().map((item) => item.id);
    const refresh = (seconds) => Object.fromEntries(widgets.map((widget) => [widget, seconds]));
    const common = {
      preset: id,
      effectWormhole: true,
      effectNova: true,
      effectComet: true,
      visiblePlanets: planets,
      focusPlanets: planets,
      notificationPlanets: planets
    };
    const recipes = {
      productivity: {
        ...common, theme: "quantum", motion: "minimal", stars: 38, particles: 35, meteors: 20,
        nebula: 38, glow: 48, defaultPlanet: "work", pinnedPlanets: ["work", "analytics", "system"],
        widgets: ["performance", "api", "network", "sync"], pinnedActions: ["task", "note", "recent", "focus"],
        widgetRefresh: refresh(15)
      },
      creative: {
        ...common, theme: "magenta", motion: "vivid", stars: 82, particles: 86, meteors: 68,
        nebula: 88, glow: 90, defaultPlanet: "creative", pinnedPlanets: ["creative", "media", "communication", "learning"],
        widgets: ["weather", "performance", "storage", "network", "sync"], pinnedActions: ["ai", "asset", "note", "search"],
        widgetRefresh: refresh(15)
      },
      developer: {
        ...common, theme: "deep", motion: "balanced", stars: 54, particles: 48, meteors: 36,
        nebula: 44, glow: 58, defaultPlanet: "dev", pinnedPlanets: ["dev", "analytics", "system", "work"],
        widgets: ["performance", "vitals", "resources", "api", "services", "pwa", "network"],
        pinnedActions: ["health", "search", "task", "recent"], widgetRefresh: refresh(5)
      },
      focus: {
        ...common, theme: "blackhole", motion: "minimal", stars: 24, particles: 18, meteors: 8,
        nebula: 24, glow: 35, defaultPlanet: "work", pinnedPlanets: ["work"], focusPlanets: ["work"],
        notificationPlanets: ["work"], visiblePlanets: ["work"], widgets: ["performance", "sync"], pinnedActions: ["focus", "task", "note", "recent"],
        effectComet: false, widgetRefresh: refresh(30)
      },
      cinematic: {
        ...common, theme: "solar", motion: "hyper", stars: 100, particles: 100, meteors: 100,
        nebula: 100, glow: 100, planetSpeed: 82, orbitSpeed: 78, parallax: 92, orbitScale: 112,
        widgets, pinnedActions: ["ai", "asset", "search", "recent"], widgetRefresh: refresh(5)
      },
      battery: {
        ...common, theme: "deep", motion: "off", stars: 20, particles: 10, meteors: 0,
        nebula: 18, glow: 20, parallax: 0, autoQuality: true, batteryAware: true,
        effectWormhole: false, effectNova: false, effectComet: false, sound: false,
        widgets: ["network", "sync"], pinnedActions: ["task", "note", "recent", "focus"], widgetRefresh: refresh(60)
      },
      accessibility: {
        ...common, theme: "ice", motion: "off", stars: 20, particles: 10, meteors: 0,
        nebula: 18, glow: 25, highContrast: true, fontScale: 115, sound: false,
        effectWormhole: false, effectNova: false, effectComet: false,
        widgets, pinnedActions: ["task", "search", "recent", "health"], widgetRefresh: refresh(30)
      },
      adaptive: {
        ...common, theme: "time", motion: "adaptive", stars: 64, particles: 64, meteors: 45,
        nebula: 68, glow: 70, autoQuality: true, batteryAware: true, highContrast: false, fontScale: 100,
        widgets, pinnedActions: ["task", "ai", "search", "recent"], widgetRefresh: refresh(15)
      }
    };
    return normalized({ ...next, ...(recipes[id] || { preset: "custom" }) });
  }

  function draftEnvelope(instance) {
    return {
      schema: "hh-home-galaxy-draft",
      version: 3,
      savedAt: new Date().toISOString(),
      baseUpdatedAt: Number(instance.applied?.updatedAt || 0),
      preferences: instance.draft
    };
  }

  function saveDraft(instance) {
    const payload = draftEnvelope(instance);
    instance.draftSavedAt = payload.savedAt;
    write(DRAFT_KEY, payload);
    const label = instance.deck?.querySelector("[data-hgcd-draft-time]");
    if (label) label.textContent = `Bản nháp ${timeText(payload.savedAt)}`;
    updateDirtyState(instance);
  }

  function readHistory() {
    return asArray(read(HISTORY_KEY, [])).filter((item) => item?.preferences).slice(0, 3);
  }

  function pushHistory(preferences, label = "Cấu hình trước") {
    const history = readHistory();
    history.unshift({
      id: global.crypto?.randomUUID?.() || `history-${Date.now()}`,
      savedAt: new Date().toISOString(),
      label: clean(label, 70),
      preferences: clone(preferences)
    });
    write(HISTORY_KEY, history.slice(0, 3));
  }

  function pushUndo(instance, state = instance.draft) {
    if (instance.undoStack.length && same(instance.undoStack.at(-1), state)) return;
    instance.undoStack.push(clone(state));
    instance.undoStack = instance.undoStack.slice(-24);
    instance.redoStack = [];
  }

  function updateDirtyState(instance) {
    const dirty = !same(normalized(instance.draft), normalized(instance.applied));
    instance.deck?.classList.toggle("is-dirty", dirty);
    const apply = instance.deck?.querySelector("[data-hgcd-apply]");
    if (apply) apply.disabled = !dirty;
    const status = instance.deck?.querySelector("[data-hgcd-unsaved]");
    if (status) status.textContent = dirty ? "Có thay đổi chưa áp dụng" : "Đã áp dụng";
  }

  function setDraft(instance, next, options = {}) {
    if (options.undo !== false) pushUndo(instance);
    instance.draft = normalized({ ...next, preset: options.keepPreset ? next.preset : "custom" });
    saveDraft(instance);
    if (options.render !== false) render(instance);
    else updatePreview(instance);
  }

  function switchControl(id, title, detail, checked) {
    return `<label class="hgcd-switch"><input type="checkbox" data-hgcd-field="${id}" ${checked ? "checked" : ""}><i><b></b></i><span><strong>${esc(title)}</strong><small>${esc(detail)}</small></span></label>`;
  }

  function rangeControl(id, label, value, min = 0, max = 100, unit = "%") {
    return `<label class="hgcd-range"><span><b>${esc(label)}</b><em data-hgcd-range-value="${id}">${Math.round(value)}${unit}</em></span><input type="range" min="${min}" max="${max}" step="1" value="${value}" data-hgcd-range="${id}" style="--range:${(value - min) / (max - min) * 100}%"><i></i></label>`;
  }

  function themesMarkup(instance) {
    return `<div class="hgcd-theme-grid">${THEMES.map(([id, label, a, b]) => `<button type="button" data-hgcd-theme="${id}" aria-pressed="${instance.draft.theme === id}" style="--theme-a:${a};--theme-b:${b}"><i></i><span>${esc(label)}</span>${id === "time" ? "<small>Sáng · chiều · tối</small>" : ""}</button>`).join("")}</div>`;
  }

  function motionMarkup(instance) {
    return `<div class="hgcd-motion-grid">${MOTIONS.map(([id, label, detail]) => `<button type="button" data-hgcd-motion="${id}" aria-pressed="${instance.draft.motion === id}"><i></i><span><b>${esc(label)}</b><small>${esc(detail)}</small></span></button>`).join("")}</div>
      <div class="hgcd-range-grid">
        ${rangeControl("planetSpeed", "Tốc độ tự quay hành tinh", instance.draft.planetSpeed)}
        ${rangeControl("orbitSpeed", "Tốc độ quỹ đạo", instance.draft.orbitSpeed)}
        ${rangeControl("parallax", "Độ sâu parallax", instance.draft.parallax)}
        ${rangeControl("particles", "Mật độ hạt", instance.draft.particles)}
        ${rangeControl("meteors", "Tần suất sao băng", instance.draft.meteors)}
        ${rangeControl("nebula", "Cường độ tinh vân", instance.draft.nebula)}
      </div>`;
  }

  function planetsMarkup(instance) {
    const planets = planetCatalog();
    return `<div class="hgcd-inline-controls">
        <label><span>Hành tinh mặc định</span><select data-hgcd-select="defaultPlanet">${planets.map((item) => `<option value="${item.id}" ${instance.draft.defaultPlanet === item.id ? "selected" : ""}>${esc(item.label)}</option>`).join("")}</select></label>
        ${rangeControl("orbitScale", "Kích thước quỹ đạo", instance.draft.orbitScale, 75, 125)}
      </div>
      ${switchControl("syncColors", "Đồng bộ màu hành tinh", "Sidebar, quỹ đạo và bảng hologram dùng cùng màu", instance.draft.syncColors)}
      <div class="hgcd-planet-grid">${planets.map((planet) => `<article style="--planet:${planet.color}">
        <span><i>${planet.icon}</i><b>${esc(planet.label)}</b></span>
        <label title="Ghim lên trang chủ"><input type="checkbox" data-hgcd-planet-list="pinnedPlanets" value="${planet.id}" ${instance.draft.pinnedPlanets.includes(planet.id) ? "checked" : ""}><i>☆</i><small>Ghim</small></label>
        <label title="Cho phép thông báo"><input type="checkbox" data-hgcd-planet-list="notificationPlanets" value="${planet.id}" ${instance.draft.notificationPlanets.includes(planet.id) ? "checked" : ""}><i>◌</i><small>Tín hiệu</small></label>
        <label title="Bật Focus Galaxy"><input type="checkbox" data-hgcd-planet-list="focusPlanets" value="${planet.id}" ${instance.draft.focusPlanets.includes(planet.id) ? "checked" : ""}><i>◎</i><small>Focus</small></label>
      </article>`).join("")}</div>`;
  }

  function widgetMarkup(instance, id) {
    const widget = widgetCatalog().find((item) => item.id === id);
    if (!widget) return "";
    const enabled = instance.draft.widgets.includes(id);
    const size = instance.draft.widgetSizes[id] || "medium";
    const tone = instance.draft.widgetTones[id] || widget.color;
    const refresh = instance.draft.widgetRefresh[id] || 15;
    return `<li draggable="true" data-hgcd-widget="${id}" style="--widget:${tone}">
      <span class="hgcd-grab" aria-hidden="true">⋮⋮</span>
      <label class="hgcd-widget-main"><input type="checkbox" data-hgcd-widget-toggle="${id}" ${enabled ? "checked" : ""}><i>${widget.icon}</i><span><b>${esc(widget.label)}</b><small>${enabled ? `Cập nhật ${refresh} giây` : "Đang ẩn"}</small></span></label>
      <label class="hgcd-color"><span>Màu</span><input type="color" value="${tone}" data-hgcd-widget-tone="${id}" aria-label="Màu ${esc(widget.label)}"></label>
      <select data-hgcd-widget-size="${id}" aria-label="Kích thước ${esc(widget.label)}">
        ${[["small", "Nhỏ"], ["medium", "Vừa"], ["large", "Lớn"], ["wide", "Siêu rộng"]].map(([value, label]) => `<option value="${value}" ${size === value ? "selected" : ""}>${label}</option>`).join("")}
      </select>
      <select data-hgcd-widget-refresh="${id}" aria-label="Tần suất ${esc(widget.label)}">
        ${[5, 15, 30, 60].map((value) => `<option value="${value}" ${refresh === value ? "selected" : ""}>${value}s</option>`).join("")}
      </select>
      <span class="hgcd-order"><button type="button" data-hgcd-widget-move="${id}" data-direction="-1" aria-label="Đưa ${esc(widget.label)} lên">↑</button><button type="button" data-hgcd-widget-move="${id}" data-direction="1" aria-label="Đưa ${esc(widget.label)} xuống">↓</button></span>
    </li>`;
  }

  function orbitMarkup(instance) {
    return `${switchControl("hideUnsupported", "Ẩn chỉ số không hỗ trợ", "Không hiển thị card mà trình duyệt không thể đo", instance.draft.hideUnsupported)}
      <div class="hgcd-section-heading"><span>Widget realtime</span><button type="button" data-hgcd-reset-widgets>Khôi phục bố cục</button></div>
      <ul class="hgcd-widget-list" data-hgcd-widget-list>${instance.draft.widgetOrder.map((id) => widgetMarkup(instance, id)).join("")}</ul>`;
  }

  function eventsMarkup(instance) {
    return `<div class="hgcd-event-grid">
        ${switchControl("effectWormhole", "Wormhole Navigation", "Đường hầm 300–500 ms trước khi mở workspace", instance.draft.effectWormhole)}
        ${switchControl("effectNova", "Nova hoàn thành task", "Vụ nổ hạt chỉ xuất hiện khi task hoàn tất", instance.draft.effectNova)}
        ${switchControl("effectComet", "Comet thông báo", "Chỉ bay qua khi Event Bus có sự kiện mới", instance.draft.effectComet)}
      </div>
      <div class="hgcd-range-grid">
        ${rangeControl("glow", "Cường độ glow", instance.draft.glow)}
        ${rangeControl("meteors", "Mật độ sao băng", instance.draft.meteors)}
        ${rangeControl("particles", "Hạt khi có sự kiện", instance.draft.particles)}
      </div>
      <div class="hgcd-signal-demo"><i></i><span><small>EVENT BUS PREVIEW</small><b>Task hoàn thành · Nova đang sẵn sàng</b></span><em>LIVE</em></div>`;
  }

  function presetsMarkup(instance) {
    return `<div class="hgcd-preset-grid">${PRESETS.map(([id, label, icon, detail]) => `<button type="button" data-hgcd-preset="${id}" aria-pressed="${instance.draft.preset === id}"><i>${icon}</i><span><b>${esc(label)}</b><small>${esc(detail)}</small></span></button>`).join("")}</div>`;
  }

  function performanceMarkup(instance) {
    return `${presetsMarkup(instance)}
      <div class="hgcd-performance-grid">
        ${switchControl("autoQuality", "Điều chỉnh chất lượng tự động", "Giảm blur, hạt và parallax khi FPS thấp", instance.draft.autoQuality)}
        ${switchControl("batteryAware", "Tiết kiệm theo thiết bị", "Ưu tiên Battery Saver khi thiết bị báo pin thấp", instance.draft.batteryAware)}
        ${switchControl("highContrast", "Tương phản cao", "Tăng độ rõ chữ, viền và trạng thái focus", instance.draft.highContrast)}
        ${rangeControl("fontScale", "Kích thước chữ giao diện", instance.draft.fontScale, 90, 120)}
      </div>
      <div class="hgcd-truth"><i>✓</i><span><b>Tab ẩn luôn dừng hoạt ảnh</b><small>Canvas và chuyển động được tạm dừng bằng Page Visibility API.</small></span></div>`;
  }

  function soundMarkup(instance) {
    return `<div class="hgcd-sound-core">
        <div class="hgcd-speaker ${instance.draft.sound ? "is-on" : ""}"><i>♫</i><b></b><em></em></div>
        <div><span>SPATIAL AUDIO CORE</span><h4>${instance.draft.sound ? "Âm thanh đang bật" : "Âm thanh mặc định tắt"}</h4><p>Chỉ phát sau tương tác trực tiếp và không tự bật lại ngoài ý muốn.</p></div>
      </div>
      ${switchControl("sound", "Âm thanh không gian", "Bật phản hồi âm thanh cho hành tinh và sự kiện", instance.draft.sound)}
      ${rangeControl("soundVolume", "Âm lượng hiệu ứng", instance.draft.soundVolume)}
      <div class="hgcd-sound-events"><span>Tín hiệu sử dụng âm thanh</span><i>Hành tinh</i><i>Task hoàn tất</i><i>AI hoàn thành</i><i>Cảnh báo hệ thống</i></div>`;
  }

  function historyMarkup(instance) {
    const history = readHistory();
    return history.length ? history.map((item, index) => `<button type="button" data-hgcd-history="${esc(item.id)}"><i>${index + 1}</i><span><b>${esc(item.label)}</b><small>${timeText(item.savedAt)} · ${esc(THEMES.find((theme) => theme[0] === item.preferences.theme)?.[1] || item.preferences.theme)}</small></span><em>Khôi phục</em></button>`).join("") : '<div class="hgcd-empty">Chưa có cấu hình cũ. Ba lần áp dụng gần nhất sẽ xuất hiện ở đây.</div>';
  }

  function syncMarkup(instance) {
    const meta = read(SYNC_META_KEY, {});
    return `<div class="hgcd-sync-hero">
        <i>${signedIn() ? "✓" : "◇"}</i><span><small>${signedIn() ? "ACCOUNT SYNC" : "LOCAL GUEST MODE"}</small><h4>${signedIn() ? "Tài khoản sẵn sàng đồng bộ" : "Cấu hình được lưu riêng trên thiết bị"}</h4><p>${signedIn() ? `Lần kiểm tra: ${timeText(meta.checkedAt)}` : "Đăng nhập để dùng cùng cấu hình trên nhiều thiết bị."}</p></span>
        <button type="button" data-hgcd-account-sync ${signedIn() ? "" : "disabled"}>${instance.syncing ? "Đang đồng bộ…" : "Đồng bộ ngay"}</button>
      </div>
      <div class="hgcd-sync-cards">
        <article><i>↻</i><span><b>Tự lưu bản nháp</b><small data-hgcd-draft-time>Bản nháp ${timeText(instance.draftSavedAt)}</small></span></article>
        <article><i>↶</i><span><b>Hoàn tác và làm lại</b><small>${instance.undoStack.length} bước có thể hoàn tác</small></span></article>
        <article><i>{ }</i><span><b>JSON di động</b><small>Nhập và xuất cấu hình có kiểm tra schema</small></span></article>
      </div>
      <div class="hgcd-section-heading"><span>Ba cấu hình gần nhất</span></div>
      <div class="hgcd-history">${historyMarkup(instance)}</div>`;
  }

  function appearanceMarkup(instance) {
    return `${themesMarkup(instance)}
      <div class="hgcd-range-grid hgcd-appearance-ranges">
        ${rangeControl("stars", "Mật độ sao", instance.draft.stars, 20, 100)}
        ${rangeControl("nebula", "Độ phủ tinh vân", instance.draft.nebula)}
        ${rangeControl("glow", "Ánh sáng plasma", instance.draft.glow)}
      </div>
      <div class="hgcd-time-strip"><i></i><span><b>Theo thời gian và trạng thái</b><small>Sáng cyan–vàng · chiều cam–hồng · tối tím–xanh · cảnh báo đỏ cam · deployment thành công cực quang xanh.</small></span></div>`;
  }

  function tabContent(instance) {
    return {
      appearance: appearanceMarkup,
      motion: motionMarkup,
      planets: planetsMarkup,
      orbit: orbitMarkup,
      events: eventsMarkup,
      performance: performanceMarkup,
      sound: soundMarkup,
      sync: syncMarkup
    }[instance.activeTab]?.(instance) || appearanceMarkup(instance);
  }

  function previewMarkup(instance) {
    const tone = themeTone(instance.draft.theme);
    const planets = planetCatalog().slice(0, 6);
    const widgets = instance.draft.widgetOrder.filter((id) => instance.draft.widgets.includes(id)).slice(0, 4);
    return `<section class="hgcd-preview" data-hgcd-preview data-theme="${instance.draft.theme}" data-motion="${instance.draft.motion}" style="--preview-a:${tone.primary};--preview-b:${tone.secondary};--preview-stars:${instance.draft.stars / 100};--preview-nebula:${instance.draft.nebula / 100};--preview-glow:${instance.draft.glow / 100};--preview-orbit:${instance.draft.orbitScale / 100};--preview-speed:${Math.max(.2, instance.draft.orbitSpeed / 50)}">
      <header><span><i></i> REALTIME PREVIEW</span><b>${esc(THEMES.find((item) => item[0] === instance.draft.theme)?.[1] || instance.draft.theme)}</b></header>
      <div class="hgcd-preview-space">
        <i class="hgcd-preview-nebula"></i><i class="hgcd-preview-stars"></i><i class="hgcd-preview-comet"></i>
        <div class="hgcd-preview-orbits"><i></i><i></i><i></i></div>
        <div class="hgcd-preview-sun"><span></span><i></i><b></b></div>
        ${planets.map((planet, index) => `<span class="hgcd-preview-planet p${index + 1}${instance.draft.pinnedPlanets.includes(planet.id) ? " is-pinned" : ""}" style="--planet:${planet.color}"><i>${planet.icon}</i></span>`).join("")}
      </div>
      <div class="hgcd-preview-live"><span>LIVE ORBIT</span>${widgets.length ? widgets.map((id) => {
        const widget = widgetCatalog().find((item) => item.id === id);
        return `<i style="--widget:${instance.draft.widgetTones[id] || widget?.color}"><b>${widget?.icon || "•"}</b><em></em></i>`;
      }).join("") : "<small>Chưa bật widget</small>"}</div>
      <footer><span><i></i>${instance.draft.motion === "off" ? "Tĩnh" : "Preview đang chuyển động"}</span><b>${instance.draft.preset === "custom" ? "Tùy chỉnh" : PRESETS.find((item) => item[0] === instance.draft.preset)?.[1]}</b></footer>
    </section>`;
  }

  function deckMarkup(instance) {
    const active = TABS.find((item) => item[0] === instance.activeTab) || TABS[0];
    return `<button type="button" class="hgcd-backdrop" data-hgcd-close aria-label="Đóng Galaxy Control Deck"></button>
      <section class="hgcd-panel" role="dialog" aria-modal="true" aria-labelledby="hgcdTitle" style="--tab-tone:${active[3]}">
        <header class="hgcd-header">
          <div class="hgcd-brand"><i><b>H</b></i><span><small>GALAXY CONTROL DECK V3</small><h2 id="hgcdTitle">Cá nhân hóa vũ trụ</h2></span></div>
          <div class="hgcd-header-status"><span data-hgcd-unsaved>Đã áp dụng</span><small data-hgcd-draft-time>Bản nháp ${timeText(instance.draftSavedAt)}</small></div>
          <button type="button" data-hgcd-close aria-label="Đóng">×</button>
        </header>
        <div class="hgcd-body">
          <nav class="hgcd-tabs" aria-label="Nhóm cá nhân hóa">${TABS.map(([id, icon, label, tone]) => `<button type="button" role="tab" data-hgcd-tab="${id}" aria-selected="${instance.activeTab === id}" style="--tab:${tone}"><i>${icon}</i><span>${esc(label)}</span><b></b></button>`).join("")}</nav>
          <main class="hgcd-workspace">
            <header><span><i>${active[1]}</i><small>CONTROL LAYER</small><h3>${esc(active[2])}</h3></span><b>${instance.draft.preset === "custom" ? "CUSTOM" : esc(PRESETS.find((item) => item[0] === instance.draft.preset)?.[1] || "CUSTOM")}</b></header>
            <div class="hgcd-content" data-hgcd-content>${tabContent(instance)}</div>
          </main>
          ${previewMarkup(instance)}
        </div>
        <footer class="hgcd-footer">
          <span class="hgcd-footer-history"><button type="button" data-hgcd-undo aria-label="Hoàn tác" ${instance.undoStack.length ? "" : "disabled"}>↶</button><button type="button" data-hgcd-redo aria-label="Làm lại" ${instance.redoStack.length ? "" : "disabled"}>↷</button></span>
          <div><button type="button" data-hgcd-reset>↺ Khôi phục</button><button type="button" data-hgcd-export>⇩ Xuất cấu hình</button><label>⇧ Nhập cấu hình<input type="file" accept="application/json,.json" data-hgcd-import hidden></label></div>
          <span class="hgcd-footer-apply"><button type="button" data-hgcd-close>Để sau</button><button type="button" class="is-primary" data-hgcd-apply>Áp dụng <i>→</i></button></span>
        </footer>
        <div class="hgcd-status" data-hgcd-status role="status" aria-live="polite"></div>
      </section>`;
  }

  function render(instance) {
    if (!instance.deck) return;
    instance.deck.innerHTML = deckMarkup(instance);
    updateDirtyState(instance);
  }

  function updatePreview(instance) {
    const current = instance.deck?.querySelector("[data-hgcd-preview]");
    if (current) current.outerHTML = previewMarkup(instance);
    updateDirtyState(instance);
  }

  function announce(instance, message, tone = "") {
    const node = instance.deck?.querySelector("[data-hgcd-status]");
    if (!node) return;
    node.textContent = clean(message, 180);
    node.dataset.tone = tone;
    node.classList.add("is-visible");
    clearTimeout(instance.statusTimer);
    instance.statusTimer = setTimeout(() => node.classList.remove("is-visible"), 2800);
  }

  function open(instance) {
    instance.applied = normalized(instance.api.preferences());
    const saved = read(DRAFT_KEY, null);
    instance.draft = saved?.version === 3 && Number(saved.baseUpdatedAt || 0) === Number(instance.applied.updatedAt || 0)
      ? normalized(saved.preferences)
      : clone(instance.applied);
    instance.draftSavedAt = saved?.savedAt || new Date().toISOString();
    instance.undoStack = [];
    instance.redoStack = [];
    instance.deck.hidden = false;
    instance.shell.classList.add("hgcd-open");
    global.document.documentElement.classList.add("hgcd-page-lock");
    render(instance);
    setTimeout(() => instance.deck.querySelector(`[data-hgcd-tab="${instance.activeTab}"]`)?.focus(), 0);
  }

  function close(instance) {
    instance.deck.hidden = true;
    instance.shell.classList.remove("hgcd-open");
    global.document.documentElement.classList.remove("hgcd-page-lock");
  }

  function resetWidgets(instance) {
    const widgets = widgetCatalog();
    const next = clone(instance.draft);
    next.widgetOrder = widgets.map((item) => item.id);
    next.widgets = widgets.map((item) => item.id);
    next.widgetSizes = Object.fromEntries(widgets.map((item) => [item.id, "medium"]));
    next.widgetTones = Object.fromEntries(widgets.map((item) => [item.id, item.color]));
    next.widgetRefresh = Object.fromEntries(widgets.map((item) => [item.id, 15]));
    setDraft(instance, next);
  }

  function moveWidget(instance, id, direction) {
    const next = clone(instance.draft);
    const index = next.widgetOrder.indexOf(id);
    const target = clamp(index + Number(direction), 0, next.widgetOrder.length - 1);
    if (index < 0 || target === index) return;
    const [item] = next.widgetOrder.splice(index, 1);
    next.widgetOrder.splice(target, 0, item);
    setDraft(instance, next);
  }

  function apply(instance) {
    if (same(instance.applied, instance.draft)) return;
    pushHistory(instance.applied, instance.applied.preset === "custom" ? "Cấu hình tùy chỉnh" : PRESETS.find((item) => item[0] === instance.applied.preset)?.[1]);
    instance.applied = normalized(instance.api.applyPreferences(instance.draft, { sync: true, source: "galaxy-control-deck" }));
    instance.draft = clone(instance.applied);
    instance.undoStack = [];
    instance.redoStack = [];
    saveDraft(instance);
    render(instance);
    announce(instance, "Đã áp dụng cấu hình cho toàn bộ trang chủ.", "success");
  }

  function undo(instance) {
    const previous = instance.undoStack.pop();
    if (!previous) return;
    instance.redoStack.push(clone(instance.draft));
    instance.draft = normalized(previous);
    saveDraft(instance);
    render(instance);
  }

  function redo(instance) {
    const next = instance.redoStack.pop();
    if (!next) return;
    instance.undoStack.push(clone(instance.draft));
    instance.draft = normalized(next);
    saveDraft(instance);
    render(instance);
  }

  function download(instance) {
    const payload = {
      schema: "hh-home-galaxy-preferences",
      version: 3,
      exportedAt: new Date().toISOString(),
      preferences: instance.draft
    };
    const url = global.URL?.createObjectURL?.(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }));
    if (!url) return announce(instance, "Trình duyệt không hỗ trợ xuất JSON.", "warning");
    const anchor = global.document.createElement("a");
    anchor.href = url;
    anchor.download = `hh-galaxy-control-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => global.URL.revokeObjectURL(url), 1000);
    announce(instance, "Đã xuất bản nháp cấu hình.", "success");
  }

  async function importFile(instance, file) {
    if (!file || file.size > 128_000) throw new Error("Tệp cấu hình không hợp lệ hoặc vượt 128 KB.");
    const payload = JSON.parse(await file.text());
    if (payload?.schema !== "hh-home-galaxy-preferences" || ![2, 3].includes(Number(payload.version))) throw new Error("Đây không phải cấu hình Galaxy hợp lệ.");
    setDraft(instance, normalized(payload.preferences));
    announce(instance, "Đã nhập cấu hình vào bản nháp. Bấm Áp dụng để sử dụng.", "success");
  }

  async function syncAccount(instance) {
    if (!signedIn() || instance.syncing) return;
    instance.syncing = true;
    render(instance);
    try {
      const synced = await instance.api.sync();
      if (!synced) {
        announce(instance, "Chưa thể đồng bộ tài khoản. Bản nháp vẫn được giữ an toàn trên thiết bị.", "warning");
        return;
      }
      instance.applied = normalized(instance.api.preferences());
      instance.draft = clone(instance.applied);
      saveDraft(instance);
      announce(instance, "Đã đồng bộ cấu hình với tài khoản.", "success");
    } finally {
      instance.syncing = false;
      render(instance);
    }
  }

  function restoreHistory(instance, id) {
    const item = readHistory().find((entry) => String(entry.id) === String(id));
    if (!item) return;
    setDraft(instance, normalized(item.preferences));
    announce(instance, "Đã đưa cấu hình cũ vào bản nháp.", "success");
  }

  function onClick(instance, event) {
    const target = event.target;
    const openButton = target.closest("[data-hgm-settings-open]");
    if (openButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      open(instance);
      return;
    }
    if (instance.deck.hidden) return;
    const panel = target.closest(".hgcd-panel");
    if (panel) {
      const ripple = global.document.createElement("i");
      const rect = panel.getBoundingClientRect();
      ripple.className = "hgcd-ripple";
      ripple.style.left = `${event.clientX - rect.left}px`;
      ripple.style.top = `${event.clientY - rect.top}px`;
      panel.append(ripple);
      setTimeout(() => ripple.remove(), 650);
    }
    if (target.closest("[data-hgcd-close]")) return close(instance);
    const tab = target.closest("[data-hgcd-tab]");
    if (tab) {
      instance.activeTab = tab.dataset.hgcdTab;
      render(instance);
      return;
    }
    const theme = target.closest("[data-hgcd-theme]");
    if (theme) return setDraft(instance, { ...instance.draft, theme: theme.dataset.hgcdTheme });
    const motion = target.closest("[data-hgcd-motion]");
    if (motion) return setDraft(instance, { ...instance.draft, motion: motion.dataset.hgcdMotion });
    const preset = target.closest("[data-hgcd-preset]");
    if (preset) {
      pushUndo(instance);
      instance.draft = applyPreset(instance.draft, preset.dataset.hgcdPreset);
      saveDraft(instance);
      render(instance);
      return;
    }
    const move = target.closest("[data-hgcd-widget-move]");
    if (move) return moveWidget(instance, move.dataset.hgcdWidgetMove, move.dataset.direction);
    if (target.closest("[data-hgcd-reset-widgets]")) return resetWidgets(instance);
    if (target.closest("[data-hgcd-reset]")) return setDraft(instance, normalized({}));
    if (target.closest("[data-hgcd-undo]")) return undo(instance);
    if (target.closest("[data-hgcd-redo]")) return redo(instance);
    if (target.closest("[data-hgcd-export]")) return download(instance);
    if (target.closest("[data-hgcd-apply]")) return apply(instance);
    if (target.closest("[data-hgcd-account-sync]")) return syncAccount(instance);
    const history = target.closest("[data-hgcd-history]");
    if (history) return restoreHistory(instance, history.dataset.hgcdHistory);
  }

  function onInput(instance, event) {
    const input = event.target;
    if (input.matches("[data-hgcd-range]")) {
      const id = input.dataset.hgcdRange;
      if (!instance.rangeBaseline) instance.rangeBaseline = clone(instance.draft);
      instance.draft[id] = Number(input.value);
      instance.draft.preset = "custom";
      input.style.setProperty("--range", `${(Number(input.value) - Number(input.min)) / Math.max(1, Number(input.max) - Number(input.min)) * 100}%`);
      const label = instance.deck.querySelector(`[data-hgcd-range-value="${id}"]`);
      if (label) label.textContent = `${Math.round(Number(input.value))}%`;
      saveDraft(instance);
      updatePreview(instance);
    }
  }

  function onChange(instance, event) {
    const input = event.target;
    if (input.matches("[data-hgcd-import]")) {
      const file = input.files?.[0];
      if (file) importFile(instance, file).catch((error) => announce(instance, error.message, "warning"));
      input.value = "";
      return;
    }
    if (input.matches("[data-hgcd-range]")) {
      if (instance.rangeBaseline) {
        pushUndo(instance, instance.rangeBaseline);
        instance.rangeBaseline = null;
      }
      render(instance);
      return;
    }
    const field = input.dataset.hgcdField;
    if (field) return setDraft(instance, { ...instance.draft, [field]: input.checked });
    const selected = input.dataset.hgcdSelect;
    if (selected) return setDraft(instance, { ...instance.draft, [selected]: input.value });
    const list = input.dataset.hgcdPlanetList;
    if (list) {
      const current = asArray(instance.draft[list]);
      if (list === "pinnedPlanets" && input.checked && current.length >= 4) {
        input.checked = false;
        return announce(instance, "Chỉ có thể ghim tối đa 4 hành tinh.", "warning");
      }
      const next = input.checked ? [...new Set([...current, input.value])] : current.filter((id) => id !== input.value);
      return setDraft(instance, { ...instance.draft, [list]: next });
    }
    const toggle = input.dataset.hgcdWidgetToggle;
    if (toggle) {
      const widgets = input.checked ? [...new Set([...instance.draft.widgets, toggle])] : instance.draft.widgets.filter((id) => id !== toggle);
      return setDraft(instance, { ...instance.draft, widgets });
    }
    const size = input.dataset.hgcdWidgetSize;
    if (size) return setDraft(instance, { ...instance.draft, widgetSizes: { ...instance.draft.widgetSizes, [size]: input.value } });
    const tone = input.dataset.hgcdWidgetTone;
    if (tone) return setDraft(instance, { ...instance.draft, widgetTones: { ...instance.draft.widgetTones, [tone]: input.value } });
    const refresh = input.dataset.hgcdWidgetRefresh;
    if (refresh) return setDraft(instance, { ...instance.draft, widgetRefresh: { ...instance.draft.widgetRefresh, [refresh]: Number(input.value) } });
  }

  function onDragStart(instance, event) {
    const row = event.target.closest("[data-hgcd-widget]");
    if (!row) return;
    instance.dragWidget = row.dataset.hgcdWidget;
    row.classList.add("is-dragging");
    event.dataTransfer?.setData?.("text/plain", instance.dragWidget);
  }

  function onDragOver(instance, event) {
    if (instance.dragWidget && event.target.closest("[data-hgcd-widget]")) event.preventDefault();
  }

  function onDrop(instance, event) {
    const target = event.target.closest("[data-hgcd-widget]");
    if (!target || !instance.dragWidget || target.dataset.hgcdWidget === instance.dragWidget) return;
    event.preventDefault();
    const next = clone(instance.draft);
    const from = next.widgetOrder.indexOf(instance.dragWidget);
    const to = next.widgetOrder.indexOf(target.dataset.hgcdWidget);
    const [item] = next.widgetOrder.splice(from, 1);
    next.widgetOrder.splice(to, 0, item);
    instance.dragWidget = "";
    setDraft(instance, next);
  }

  function bind(instance) {
    global.document.addEventListener("click", (event) => onClick(instance, event), { capture: true, signal: instance.controller.signal });
    instance.deck.addEventListener("input", (event) => onInput(instance, event), { signal: instance.controller.signal });
    instance.deck.addEventListener("change", (event) => onChange(instance, event), { signal: instance.controller.signal });
    instance.deck.addEventListener("dragstart", (event) => onDragStart(instance, event), { signal: instance.controller.signal });
    instance.deck.addEventListener("dragover", (event) => onDragOver(instance, event), { signal: instance.controller.signal });
    instance.deck.addEventListener("drop", (event) => onDrop(instance, event), { signal: instance.controller.signal });
    instance.deck.addEventListener("dragend", () => {
      instance.dragWidget = "";
      instance.deck.querySelectorAll(".is-dragging").forEach((item) => item.classList.remove("is-dragging"));
    }, { signal: instance.controller.signal });
    global.document.addEventListener("keydown", (event) => {
      if (instance.deck.hidden) return;
      if (event.key === "Escape") return close(instance);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        return event.shiftKey ? redo(instance) : undo(instance);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        return redo(instance);
      }
    }, { signal: instance.controller.signal });
  }

  function mount(root = global.document?.querySelector?.("[data-hgc-root].hgm-active")) {
    if (!root || instances.has(root)) return instances.get(root)?.publicApi || false;
    const shell = root.querySelector("[data-hgm-shell]");
    const missionApi = global.HHHomeGalaxyMission?.mount?.(root);
    if (!shell || !missionApi?.preferences || !missionApi?.applyPreferences) return false;
    const controller = new AbortController();
    const deckNode = global.document.createElement("aside");
    deckNode.className = "hgcd";
    deckNode.dataset.hgcd = "";
    deckNode.hidden = true;
    global.document.body.appendChild(deckNode);
    const instance = {
      root,
      shell,
      api: missionApi,
      deck: deckNode,
      controller,
      activeTab: "appearance",
      applied: normalized(missionApi.preferences()),
      draft: normalized(missionApi.preferences()),
      draftSavedAt: "",
      undoStack: [],
      redoStack: [],
      rangeBaseline: null,
      dragWidget: "",
      syncing: false
    };
    bind(instance);
    instances.set(root, instance);
    mountedRoots.add(root);
    root.classList.add("hgcd-ready");
    const publicApi = Object.freeze({
      version: VERSION,
      open: () => open(instance),
      close: () => close(instance),
      draft: () => clone(instance.draft),
      applied: () => clone(instance.applied),
      preset: (id) => {
        instance.draft = applyPreset(instance.draft, id);
        saveDraft(instance);
        if (!instance.deck.hidden) render(instance);
        return clone(instance.draft);
      },
      destroy: () => unmount(root)
    });
    instance.publicApi = publicApi;
    return publicApi;
  }

  function unmount(root) {
    const instance = instances.get(root);
    if (!instance) return false;
    instance.controller.abort();
    instance.deck?.remove();
    global.document.documentElement.classList.remove("hgcd-page-lock");
    root.classList.remove("hgcd-ready");
    instances.delete(root);
    mountedRoots.delete(root);
    return true;
  }

  function autoMount() {
    const attach = () => {
      [...mountedRoots].forEach((mountedRoot) => {
        if (!mountedRoot.isConnected) unmount(mountedRoot);
      });
      const root = global.document?.querySelector?.("[data-hgc-root].hgm-active");
      if (root) mount(root);
    };
    const start = () => {
      attach();
      if (!global.MutationObserver || observer) return;
      observer = new global.MutationObserver(attach);
      observer.observe(global.document.documentElement, { childList: true, subtree: true });
    };
    if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
    global.addEventListener?.("hashchange", () => { if (global.location.hash.includes("/home")) setTimeout(attach, 80); });
    global.addEventListener?.("hh:assets-ready", (event) => { if (event.detail?.route === "/home") setTimeout(attach, 0); });
    return true;
  }

  return Object.freeze({
    VERSION,
    DRAFT_KEY,
    HISTORY_KEY,
    THEMES,
    MOTIONS,
    TABS,
    PRESETS,
    applyPreset,
    mount,
    unmount,
    autoMount
  });
});
