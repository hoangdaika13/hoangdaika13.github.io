(() => {
  "use strict";

  const galaxy = document.querySelector("[data-hh-galaxy]");
  if (!galaxy) return;


  const gate = galaxy.closest("#authGate");
  const orbitField = galaxy.querySelector(".hh-galaxy-orbits");
  const inspector = galaxy.querySelector("#hhGalaxyInspector");
  const signature = galaxy.querySelector(".hh-galaxy-signature b");
  const sunLabel = galaxy.querySelector(".hh-galaxy-sun small");
  const PAGE_SIZE = 18;
  const BODY_TYPES = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"];
  const MODEL_TYPES = ["terrestrial", "desert", "ocean", "forest", "gas", "ice", "storm", "crystal", "metal", "volcanic"];
  const ORBIT_NAMES = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven"];

  const start = () => {
    const registry = window.HHFeatureUniverseRegistry;
    if (!orbitField || !inspector || !registry?.sections?.length || !registry?.entries?.length) {
      galaxy.dataset.featureUniverse = "fallback";
      return;
    }

  const sections = registry.sections.filter((section) => section.id !== "admin" && section.entries?.length);
  const allEntries = sections.flatMap((section) => section.entries.map((entry) => ({ ...entry, sectionLabel: section.label })));
  const entriesByKey = new Map(allEntries.map((entry) => [entry.key, entry]));
  let activeSectionId = "";
  let query = "";
  let page = 0;
  let pinnedKey = "";
  let visibleItems = [];
  let listOpen = false;

  const normalize = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const hash = (value) => {
    let output = 2166136261;
    for (const character of String(value || "")) {
      output ^= character.codePointAt(0);
      output = Math.imul(output, 16777619);
    }
    return output >>> 0;
  };

  const sectionPlanets = () => sections.map((section, index) => ({
    key: `system:${section.id}`,
    id: section.id,
    sectionId: section.id,
    title: section.label,
    icon: section.icon || "✦",
    description: `${section.entries.length} chức năng thật trong ${section.label}.`,
    detail: "Chọn hệ hành tinh này để khám phá từng workspace con từ registry điều hướng của HH Platform.",
    accent: section.accent || "#62e9f2",
    accent2: section.accent2 || "#8b72ff",
    count: section.entries.length,
    kind: "system",
    index
  }));

  const searchable = (entry) => normalize(`${entry.title} ${entry.description} ${entry.sectionLabel} ${entry.route}`);
  const filteredEntries = () => {
    if (query) return allEntries.filter((entry) => searchable(entry).includes(query));
    if (activeSectionId) return allEntries.filter((entry) => entry.sectionId === activeSectionId);
    return sectionPlanets();
  };

  const appearance = (item, index) => {
    const seed = hash(item.key || item.route || index);
    const body = BODY_TYPES[seed % BODY_TYPES.length];
    const model = MODEL_TYPES[(seed >>> 4) % MODEL_TYPES.length];
    const weight = .84 + ((seed >>> 8) % 78) / 100;
    const spin = .038 + ((seed >>> 15) % 188) / 1000;
    const size = 23 + ((seed >>> 20) % 23);
    const tilt = -27 + ((seed >>> 12) % 55);
    return { body, model, weight, spin, size, tilt, accent: item.accent, accent2: item.accent2, planet: index + 101 };
  };

  const createButton = (className, label) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    return button;
  };

  const controls = document.createElement("section");
  controls.className = "hh-feature-universe-controls";
  controls.setAttribute("aria-label", "Điều hướng HH Feature Universe");
  controls.innerHTML = `<div class="hh-feature-universe-bar"><button type="button" data-hh-universe-home aria-label="Về bản đồ các hệ chức năng">← <span>Các hệ</span></button><label><span>⌕</span><input type="search" data-hh-universe-search autocomplete="off" placeholder="Tìm chức năng…" aria-label="Tìm chức năng trong HH Platform"></label><button type="button" data-hh-universe-list aria-expanded="false">☷ <span>Danh sách</span></button></div><nav data-hh-universe-sections aria-label="Các hệ chức năng"></nav><div class="hh-feature-universe-page" data-hh-universe-page><button type="button" data-hh-universe-prev aria-label="Trang hành tinh trước">‹</button><span data-hh-universe-page-label></span><button type="button" data-hh-universe-next aria-label="Trang hành tinh sau">›</button></div><section class="hh-feature-universe-list" data-hh-universe-list-panel hidden aria-label="Danh sách chức năng"><header><div><small>HH FEATURE UNIVERSE</small><strong data-hh-universe-list-title>Toàn bộ chức năng</strong></div><button type="button" data-hh-universe-list-close aria-label="Đóng danh sách">×</button></header><div data-hh-universe-list-items></div></section><p class="sr-only" data-hh-universe-announcer aria-live="polite"></p>`;
  galaxy.append(controls);

  const sectionNav = controls.querySelector("[data-hh-universe-sections]");
  const searchInput = controls.querySelector("[data-hh-universe-search]");
  const listToggle = controls.querySelector("[data-hh-universe-list]");
  const listPanel = controls.querySelector("[data-hh-universe-list-panel]");
  const listItems = controls.querySelector("[data-hh-universe-list-items]");
  const listTitle = controls.querySelector("[data-hh-universe-list-title]");
  const pageControl = controls.querySelector("[data-hh-universe-page]");
  const pageLabel = controls.querySelector("[data-hh-universe-page-label]");
  const previousButton = controls.querySelector("[data-hh-universe-prev]");
  const nextButton = controls.querySelector("[data-hh-universe-next]");
  const homeButton = controls.querySelector("[data-hh-universe-home]");
  const announcer = controls.querySelector("[data-hh-universe-announcer]");

  sections.forEach((section) => {
    const button = createButton("hh-feature-system-chip", section.label);
    button.dataset.hhUniverseSection = section.id;
    button.style.setProperty("--feature-accent", section.accent);
    button.setAttribute("aria-pressed", "false");
    sectionNav.append(button);
  });

  inspector.hidden = false;
  inspector.setAttribute("aria-hidden", "false");
  let openButton = inspector.querySelector("[data-hh-galaxy-open]");
  if (!openButton) {
    openButton = createButton("hh-galaxy-open", "Mở sau khi đăng nhập →");
    openButton.dataset.hhGalaxyOpen = "";
    inspector.append(openButton);
  }

  const write = (selector, value) => {
    const node = galaxy.querySelector(selector);
    if (node) node.textContent = value;
  };

  const currentSection = () => sections.find((section) => section.id === activeSectionId);

  const renderList = () => {
    listItems.replaceChildren();
    const items = filteredEntries();
    listTitle.textContent = query
      ? `${items.length} kết quả tìm kiếm`
      : activeSectionId
        ? `${currentSection()?.label || "Hệ chức năng"} · ${items.length} mục`
        : `${registry.count} chức năng trong ${sections.length} hệ`;
    const fragment = document.createDocumentFragment();
    const source = activeSectionId || query ? items : allEntries;
    source.forEach((entry) => {
      const button = createButton("hh-feature-list-item", "");
      button.dataset.hhFeatureRoute = entry.route;
      button.dataset.hhFeatureKey = entry.key;
      button.style.setProperty("--feature-accent", entry.accent);
      const planet = document.createElement("i");
      planet.setAttribute("aria-hidden", "true");
      const copy = document.createElement("span");
      const group = document.createElement("small");
      group.textContent = entry.sectionLabel;
      const title = document.createElement("strong");
      title.textContent = entry.title;
      const description = document.createElement("em");
      description.textContent = entry.description;
      copy.append(group, title, description);
      const arrow = document.createElement("b");
      arrow.textContent = "→";
      button.append(planet, copy, arrow);
      fragment.append(button);
    });
    listItems.append(fragment);
  };

  const setListOpen = (open) => {
    listOpen = Boolean(open);
    listPanel.hidden = !listOpen;
    listToggle.setAttribute("aria-expanded", String(listOpen));
    galaxy.classList.toggle("is-feature-list-open", listOpen);
    if (listOpen) {
      renderList();
      listPanel.querySelector("button")?.focus({ preventScroll: true });
    }
  };

  const updateInspector = (item, index) => {
    if (!item) return;
    const isSystem = item.kind === "system";
    const section = sections.find((candidate) => candidate.id === item.sectionId);
    galaxy.style.setProperty("--galaxy-accent", item.accent);
    galaxy.style.setProperty("--galaxy-accent-2", item.accent2);
    gate?.style.setProperty("--auth-planet-accent", item.accent);
    gate?.style.setProperty("--auth-planet-accent-2", item.accent2);
    if (gate) gate.dataset.hhPlanetTheme = item.sectionId;
    galaxy.dataset.activeCategory = item.key;
    galaxy.dataset.activeSystem = item.sectionId;
    write("[data-hh-galaxy-index]", `${isSystem ? "HỆ" : "HÀNH TINH"} ${String(index + 1).padStart(2, "0")} / ${String(visibleItems.length).padStart(2, "0")}`);
    write("[data-hh-galaxy-icon]", item.icon || "✦");
    write("[data-hh-galaxy-kicker]", isSystem ? "HỆ CHỨC NĂNG" : section?.label || "HH FEATURE UNIVERSE");
    write("[data-hh-galaxy-title]", item.title);
    write("[data-hh-galaxy-count]", `${item.count || 1} ${isSystem ? "CHỨC NĂNG" : "WORKSPACE"}`);
    write("[data-hh-galaxy-description]", item.description);
    write("[data-hh-galaxy-detail]", item.detail || "Đường dẫn này lấy trực tiếp từ registry HH Platform và chỉ mở sau khi phiên truy cập hợp lệ.");
    write("[data-hh-galaxy-route]", isSystem ? `${item.count} hành tinh con` : `#${item.route}`);
    const featureLabels = isSystem
      ? section.entries.slice(0, 5).map((entry) => entry.title)
      : [section?.label, "Route nội bộ đã xác thực", item.root ? "Trang tổng quan nhóm" : "Workspace con", "Hỗ trợ bàn phím", "Không lộ quyền Admin"];
    [...galaxy.querySelectorAll("[data-hh-galaxy-features] li")].forEach((node, featureIndex) => {
      node.textContent = featureLabels[featureIndex] || "";
      node.hidden = !featureLabels[featureIndex];
    });
    openButton.textContent = isSystem ? "Khám phá hệ hành tinh →" : "Mở sau khi đăng nhập →";
    openButton.dataset.hhGalaxyTarget = item.key;
    announcer.textContent = `${item.title}. ${item.description}`;
  };

  const selectPlanet = (key, { pin = false, focus = false, commit = false } = {}) => {
    const item = visibleItems.find((candidate) => candidate.key === key);
    const buttons = [...galaxy.querySelectorAll(".hh-galaxy-planet[data-hh-galaxy-key]")];
    const planet = buttons.find((candidate) => candidate.dataset.hhGalaxyKey === key);
    if (!item || !planet) return false;
    if (pin) pinnedKey = key;
    buttons.forEach((button) => {
      const active = button === planet;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
      button.closest(".hh-galaxy-orbit")?.classList.toggle("is-selected-orbit", active);
    });
    updateInspector(item, Math.max(0, visibleItems.indexOf(item)));
    if (focus) planet.focus({ preventScroll: true });
    galaxy.dispatchEvent(new CustomEvent("hh:galaxy-category-change", {
      detail: { key, route: item.route || "", title: item.title, accent: item.accent, accent2: item.accent2, pinned: pin }
    }));
    if (commit) activateItem(item);
    return true;
  };

  const renderPlanets = () => {
    const source = filteredEntries();
    const totalPages = Math.max(1, Math.ceil(source.length / PAGE_SIZE));
    page = Math.min(Math.max(0, page), totalPages - 1);
    visibleItems = source.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    orbitField.replaceChildren();
    const fragment = document.createDocumentFragment();
    visibleItems.forEach((item, index) => {
      const orbitIndex = Math.min(ORBIT_NAMES.length - 1, Math.floor(index / 2));
      let orbit = [...fragment.children].find((node) => node.classList.contains(`hh-galaxy-orbit--${ORBIT_NAMES[orbitIndex]}`));
      if (!orbit) {
        orbit = document.createElement("span");
        orbit.className = `hh-galaxy-orbit hh-galaxy-orbit--${ORBIT_NAMES[orbitIndex]}`;
        fragment.append(orbit);
      }
      const look = appearance(item, index + page * PAGE_SIZE);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hh-galaxy-planet";
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", "false");
      button.setAttribute("aria-label", `${item.title}: ${item.description}`);
      button.setAttribute("aria-controls", "hhGalaxyInspector");
      button.tabIndex = -1;
      button.dataset.hhGalaxyKey = item.key;
      button.dataset.hhPlanet = String(look.planet);
      button.dataset.hhBody = look.body;
      button.dataset.hhModel = look.model;
      button.dataset.hhSpin = look.spin.toFixed(3);
      button.dataset.hhWeight = look.weight.toFixed(2);
      button.style.setProperty("--planet-a", look.accent);
      button.style.setProperty("--planet-b", look.accent2);
      button.style.setProperty("--planet-size", `${look.size}px`);
      button.style.setProperty("--planet-spin", `${Math.max(7, 1 / look.spin * 1.2).toFixed(1)}s`);
      button.style.setProperty("--planet-tilt", `${look.tilt}deg`);
      orbit.append(button);
    });
    orbitField.append(fragment);
    pinnedKey = visibleItems[0]?.key || "";
    homeButton.disabled = !activeSectionId && !query;
    pageControl.hidden = totalPages <= 1;
    previousButton.disabled = page <= 0;
    nextButton.disabled = page >= totalPages - 1;
    pageLabel.textContent = `Trang ${page + 1}/${totalPages} · ${source.length} hành tinh`;
    sectionNav.querySelectorAll("[data-hh-universe-section]").forEach((button) => {
      const active = button.dataset.hhUniverseSection === activeSectionId;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (signature) signature.textContent = `${registry.count} CHỨC NĂNG · ${sections.length} HỆ HÀNH TINH`;
    if (sunLabel) sunLabel.textContent = activeSectionId ? currentSection()?.label || "HH FEATURE CORE" : "HH FEATURE CORE";
    galaxy.dataset.featureUniverse = query ? "search" : activeSectionId ? "system" : "overview";
    galaxy.setAttribute("aria-label", `HH Feature Universe có ${registry.count} chức năng trong ${sections.length} hệ`);
    galaxy.dispatchEvent(new CustomEvent("hh:feature-universe-render", {
      detail: { count: visibleItems.length, total: source.length, page: page + 1, pages: totalPages, sectionId: activeSectionId, query }
    }));
    if (pinnedKey) requestAnimationFrame(() => selectPlanet(pinnedKey, { pin: true }));
    if (listOpen) renderList();
  };

  function activateItem(item) {
    if (!item) return;
    if (item.kind === "system") {
      activeSectionId = item.sectionId;
      query = "";
      searchInput.value = "";
      page = 0;
      renderPlanets();
      announcer.textContent = `Đã mở hệ ${item.title}.`;
      return;
    }
    gate?.dispatchEvent(new CustomEvent("hh:auth-destination", {
      detail: { route: `#${item.route}`, title: item.title, focusLogin: false }
    }));
  }

  const showOverview = () => {
    activeSectionId = "";
    query = "";
    page = 0;
    searchInput.value = "";
    renderPlanets();
    announcer.textContent = "Đã trở về bản đồ các hệ chức năng.";
  };

  galaxy.addEventListener("pointerover", (event) => {
    const planet = event.target.closest?.("[data-hh-galaxy-key]");
    if (!planet || planet.contains(event.relatedTarget)) return;
    selectPlanet(planet.dataset.hhGalaxyKey);
  });

  galaxy.addEventListener("pointerout", (event) => {
    const planet = event.target.closest?.("[data-hh-galaxy-key]");
    if (!planet || planet.contains(event.relatedTarget)) return;
    if (pinnedKey) selectPlanet(pinnedKey);
  });

  galaxy.addEventListener("focusin", (event) => {
    const planet = event.target.closest?.("[data-hh-galaxy-key]");
    if (planet) selectPlanet(planet.dataset.hhGalaxyKey);
  });

  galaxy.addEventListener("focusout", (event) => {
    if (!event.relatedTarget?.closest?.("[data-hh-galaxy]") && pinnedKey) selectPlanet(pinnedKey);
  });

  galaxy.addEventListener("click", (event) => {
    const planet = event.target.closest?.("[data-hh-galaxy-key]");
    if (planet) selectPlanet(planet.dataset.hhGalaxyKey, { pin: true, focus: true, commit: true });
    const listItem = event.target.closest?.("[data-hh-feature-key]");
    if (listItem) {
      const item = entriesByKey.get(listItem.dataset.hhFeatureKey);
      if (item) {
        activateItem(item);
        setListOpen(false);
      }
    }
  });

  galaxy.addEventListener("keydown", (event) => {
    const planet = event.target.closest?.("[data-hh-galaxy-key]");
    if (event.key === "Escape") {
      if (listOpen) setListOpen(false);
      else if (activeSectionId || query) showOverview();
      return;
    }
    if (!planet || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...galaxy.querySelectorAll(".hh-galaxy-planet[data-hh-galaxy-key]")];
    const current = Math.max(0, buttons.indexOf(planet));
    let next = current;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (current - 1 + buttons.length) % buttons.length;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (current + 1) % buttons.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = buttons.length - 1;
    selectPlanet(buttons[next].dataset.hhGalaxyKey, { pin: true, focus: true });
  });

  sectionNav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-hh-universe-section]");
    if (!button) return;
    activeSectionId = button.dataset.hhUniverseSection;
    query = "";
    page = 0;
    searchInput.value = "";
    renderPlanets();
  });
  homeButton.addEventListener("click", showOverview);
  listToggle.addEventListener("click", () => setListOpen(!listOpen));
  controls.querySelector("[data-hh-universe-list-close]").addEventListener("click", () => setListOpen(false));
  previousButton.addEventListener("click", () => { page -= 1; renderPlanets(); });
  nextButton.addEventListener("click", () => { page += 1; renderPlanets(); });
  openButton.addEventListener("click", () => activateItem(visibleItems.find((item) => item.key === openButton.dataset.hhGalaxyTarget)));
  searchInput.addEventListener("input", () => {
    query = normalize(searchInput.value);
    if (query) activeSectionId = "";
    page = 0;
    renderPlanets();
  });

  renderPlanets();
  galaxy.dataset.featureUniverseReady = "true";
  window.HHHGalaxy = Object.freeze({
    version: 7,
    registry,
    select: (key) => selectPlanet(key, { pin: true }),
    current: () => pinnedKey,
    section: () => activeSectionId,
    overview: showOverview,
    search: (value) => {
      searchInput.value = String(value || "");
      query = normalize(value);
      if (query) activeSectionId = "";
      page = 0;
      renderPlanets();
    }
  });
  };
  if (window.HHFeatureUniverseRegistry) start();
  else window.addEventListener("hh:feature-universe-registry", start, { once: true });
})();
