(function initKimLienWorkspaces(global) {
  "use strict";

  const STYLES = Object.freeze([
    ["kimLienWorkspaceTheme", "kim-lien-workspaces.css?v=7"],
    ["kimLienCreativeLearningTheme", "kim-lien-creative-learning.css?v=3"],
    ["kimLienOperationsTheme", "kim-lien-operations.css?v=6"]
  ]);
  let observer = null;
  let scheduled = false;

  const currentRoute = () => {
    const raw = global.location.hash.replace(/^#/, "") || "/home";
    return (raw.startsWith("/") ? raw : `/${raw}`).split("?")[0];
  };

  function ensureLateStyles() {
    return STYLES.map(([id, href]) => {
      let link = document.getElementById(id);
      if (!link) {
        link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = href;
        link.dataset.kimLienWorkspaceTheme = "";
      }
      document.head.append(link);
      return link;
    });
  }

  function decorateWorkspace() {
    scheduled = false;
    const workspace = document.getElementById("appWorkspace");
    const body = document.body;
    if (!workspace || !body) return;
    const route = currentRoute();
    body.dataset.klWorkspaceRoute = route;
    workspace.dataset.kimLienWorkspace = route;
    [...workspace.children].forEach((node) => {
      if (node instanceof HTMLElement) node.dataset.kimLienSurface = "";
    });
    ensureLateStyles();
  }

  function scheduleDecorate() {
    if (scheduled) return;
    scheduled = true;
    global.requestAnimationFrame(decorateWorkspace);
  }

  function refreshAfterLazyAssets() {
    ensureLateStyles();
    scheduleDecorate();
  }

  function audit() {
    const main = document.querySelector(".app-main");
    const workspace = document.getElementById("appWorkspace");
    const last = workspace?.lastElementChild;
    const mainStyle = main ? getComputedStyle(main) : null;
    return Object.freeze({
      route: currentRoute(),
      viewport: { width: global.innerWidth, height: global.innerHeight },
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      main: main ? {
        clientHeight: main.clientHeight,
        scrollHeight: main.scrollHeight,
        scrollTop: main.scrollTop,
        overflowY: mainStyle?.overflowY || "",
        canReachEnd: main.scrollHeight <= main.clientHeight + 1 || main.scrollTop + main.clientHeight >= main.scrollHeight - 2
      } : null,
      workspace: workspace ? {
        clientHeight: workspace.clientHeight,
        scrollHeight: workspace.scrollHeight,
        childCount: workspace.children.length,
        lastBottom: last?.getBoundingClientRect?.().bottom ?? null
      } : null,
      authVisible: (() => {
        const gate = document.getElementById("authGate");
        return Boolean(gate && !gate.hidden && getComputedStyle(gate).display !== "none");
      })()
    });
  }

  function start() {
    ensureLateStyles();
    decorateWorkspace();
    global.addEventListener("hashchange", scheduleDecorate);
    global.addEventListener("hh:asset-group-ready", refreshAfterLazyAssets);
    global.addEventListener("hh:assets-ready", refreshAfterLazyAssets);
    global.addEventListener("hh:route-rendered", scheduleDecorate);
    document.addEventListener("visibilitychange", () => {
      document.body?.setAttribute("data-kl-workspace-paused", String(document.hidden));
    });
    const workspace = document.getElementById("appWorkspace");
    if (workspace) {
      observer = new MutationObserver(scheduleDecorate);
      observer.observe(workspace, { childList: true, subtree: true });
    }
    global.addEventListener("pagehide", () => observer?.disconnect(), { once: true });
  }

  global.HHKimLienWorkspaces = Object.freeze({ apply: decorateWorkspace, audit, styleHrefs: STYLES.map(([, href]) => href) });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})(window);
