(function initHHKimLienTheme(global) {
  "use strict";

  const THEME = "kim-lien";
  let lastRoute = "";
  let observer = null;

  const currentRoute = () => {
    const raw = global.location.hash.replace(/^#/, "") || "/home";
    return raw.startsWith("/") ? raw : `/${raw}`;
  };
  const currentUser = () => {
    try { return global.HHAuthz?.currentUser?.() || JSON.parse(localStorage.getItem("hh-auth-user") || "null") || {}; }
    catch { return {}; }
  };
  const setText = (node, value) => { if (node && node.textContent !== value) node.textContent = value; };

  function applyIdentity() {
    const root = document.documentElement;
    const body = document.body;
    root.dataset.hhTheme = THEME;
    root.classList.add("hh-kim-lien");
    if (!body) return;
    body.classList.add("hh-kim-lien", "kim-lien-theme");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#351514");

    const brand = document.querySelector(".app-brand");
    if (brand) {
      brand.setAttribute("aria-label", "Trang chủ HH Phật Pháp");
      const image = brand.querySelector("img");
      if (image) {
        image.src = "assets/phat-phap/hh-kim-lien-mark.svg?v=1";
        image.alt = "";
      }
      setText(brand.querySelector("strong"), "HH Phật Pháp");
    }
    setText(document.querySelector(".app-global-search [data-i18n-text]"), "Tìm giáo lý, kinh điển hoặc công cụ…");
    document.querySelector("#appShell")?.setAttribute("aria-label", "Không gian HH Phật Pháp");
    document.querySelector(".app-sidebar")?.setAttribute("aria-label", "Điều hướng HH Phật Pháp");
    setText(document.querySelector(".app-sidebar__mobile-title > span"), "Kim Liên · Điều hướng");
    document.querySelectorAll(".app-page-header__eyebrow").forEach((node) => setText(node, "HH PHẬT PHÁP · KIM LIÊN ĐIỆN"));
  }

  function applyLoaderIdentity() {
    const boot = document.getElementById("hhBootSurface");
    if (boot) {
      boot.dataset.bootRoute = "dharma";
      setText(boot.querySelector("[data-hh-boot-route]"), "Kim Liên Điện");
      const title = boot.querySelector("[data-hh-boot-title]");
      if (title && /HH Platform|Kim Liên/.test(title.textContent)) setText(title, "Đang mở Kim Liên Điện");
    }
    const loader = document.getElementById("appCosmicLoader");
    if (loader) {
      loader.dataset.transitionKind = "dharma";
      setText(document.getElementById("appCosmicLoaderIcon"), "☸");
      setText(document.getElementById("appCosmicLoaderEyebrow"), "KIM LIÊN CHUYỂN CẢNH");
    }
  }

  function syncRoute(route = currentRoute()) {
    lastRoute = route;
    const home = route === "/home";
    document.body?.classList.toggle("kim-lien-home-route", home);
    if (!home) global.HHKimLienHome?.unmount?.();
    applyIdentity();
    applyLoaderIdentity();
    const pageTitle = document.querySelector("#appPageHeader h1")?.textContent?.trim();
    document.title = `${home ? "Điện Kim Liên" : (pageTitle || "HH Phật Pháp")} | HH Phật Pháp`;
  }

  function start() {
    applyIdentity();
    applyLoaderIdentity();
    syncRoute();
    global.addEventListener("hashchange", () => syncRoute(currentRoute()));
    global.addEventListener("hh:route-rendered", (event) => syncRoute(event.detail?.route || currentRoute()));
    global.addEventListener("hh:theme-change", applyIdentity);

    observer = new MutationObserver((records) => {
      const relevant = records.some((record) => record.type === "childList" && record.addedNodes.length);
      if (!relevant) return;
      applyIdentity();
      applyLoaderIdentity();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    global.addEventListener("pagehide", () => observer?.disconnect(), { once: true });
  }

  global.HHKimLienTheme = Object.freeze({ apply: applyIdentity, syncRoute, id: THEME, get route() { return lastRoute; } });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})(window);
