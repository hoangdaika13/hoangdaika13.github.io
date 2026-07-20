(() => {
  "use strict";

  const VIEWS = [
    { id: "overview", label: "Tổng quan", icon: "◇", description: "Chọn không gian để bắt đầu" },
    { id: "animation", label: "Animation 2D", icon: "✦", description: "Timeline, keyframe và State Machine" },
    { id: "3d", label: "3D Scene", icon: "◈", description: "Scene, vật thể, camera và ánh sáng" },
    { id: "prototype", label: "UI/UX Prototype", icon: "⌘", description: "Frame, flow, gesture và component" },
    { id: "motion", label: "Motion & Video", icon: "▶", description: "Text motion, timeline và export config" },
    { id: "character", label: "Character Lab", icon: "◉", description: "Puppet, lip-sync và camera gate" }
  ];

  const escapeHTML = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  const normalizeView = (view) => VIEWS.some((item) => item.id === view) ? view : "overview";
  const routeFor = (view) => view === "overview" ? "/graphic-design" : `/graphic-design/${view}`;
  const mountChild = (root, selector, api) => {
    const target = root.querySelector(selector);
    if (!target) return;
    if (api?.mount) api.mount(target);
    else target.innerHTML = `<div class="gd-engine-unavailable"><strong>Engine đang chờ tải</strong><p>Hãy làm mới trang để khởi động workspace này.</p></div>`;
  };

  function content(view) {
    if (view === "overview") {
      return `
        <section class="gd-overview-grid" aria-label="Các studio thiết kế">
          <article class="gd-overview-card gd-overview-card--animation"><span>✦</span><div><small>RIVE · LOTTIE · SVGATOR</small><h3>Animation 2D tương tác</h3><p>Tạo timeline, easing, state machine và trigger cho hover, click, drag, scroll.</p></div><button type="button" data-gd-route="animation">Mở studio</button></article>
          <article class="gd-overview-card gd-overview-card--3d"><span>◈</span><div><small>SPLINE · VECTARY · BLENDER</small><h3>3D Scene Studio</h3><p>Dựng scene nhẹ trên trình duyệt, điều khiển camera, vật liệu, ánh sáng và object.</p></div><button type="button" data-gd-route="3d">Mở studio</button></article>
          <article class="gd-overview-card gd-overview-card--prototype"><span>⌘</span><div><small>PENPOT · PROTOPIE · FRAMER</small><h3>UI/UX Prototype</h3><p>Thiết kế frame, component state, flow, hotspot và preview tương tác.</p></div><button type="button" data-gd-route="prototype">Mở studio</button></article>
          <article class="gd-overview-card gd-overview-card--motion"><span>▶</span><div><small>JITTER · CANVA · VEED</small><h3>Motion & Video</h3><p>Tạo text motion, logo animation, track, marker và cấu hình xuất video.</p></div><button type="button" data-gd-route="motion">Mở studio</button></article>
          <article class="gd-overview-card gd-overview-card--character"><span>◉</span><div><small>CHARACTER ANIMATOR · LIVE2D · SPINE</small><h3>Character Lab</h3><p>Chuẩn bị puppet layer, trigger, lip-sync marker và quyền camera/micro có kiểm soát.</p></div><button type="button" data-gd-route="character">Mở studio</button></article>
        </section>
        <section class="gd-system-note"><span>HH GRAPHIC DESIGN OS</span><strong>Local-first · export được · không giả realtime</strong><p>Mỗi studio có thể dùng riêng. Các tính năng cần encoder, asset 3D hoặc camera thật sẽ hiện rõ trạng thái cấu hình thay vì hiển thị giả.</p></section>
        <section class="gd-engine-stack">
          <div class="gd-engine-section" data-gd-section="animation"><header><div><span>01 · MOTION GRAPHICS</span><h3>Animation Studio</h3></div><button type="button" data-gd-route="animation">Mở riêng</button></header><div data-graphic-animation></div></div>
          <div class="gd-engine-section" data-gd-section="3d"><header><div><span>02 · REALTIME SCENE</span><h3>3D Scene Studio</h3></div><button type="button" data-gd-route="3d">Mở riêng</button></header><div data-graphic-3d></div></div>
          <div class="gd-engine-section" data-gd-section="prototype"><header><div><span>03 · INTERACTION DESIGN</span><h3>UI/UX Prototype Studio</h3></div><button type="button" data-gd-route="prototype">Mở riêng</button></header><div data-graphic-prototype></div></div>
          <div class="gd-engine-section" data-gd-section="motion"><header><div><span>04 · VIDEO MOTION</span><h3>Motion & Video Studio</h3></div><button type="button" data-gd-route="motion">Mở riêng</button></header><div data-graphic-motion></div></div>
        </section>`;
    }
    const selectors = { animation: "data-graphic-animation", "3d": "data-graphic-3d", prototype: "data-graphic-prototype", motion: "data-graphic-motion", character: "data-graphic-motion" };
    return `<section class="gd-focused-workspace" data-gd-focused="${escapeHTML(view)}"><div ${selectors[view] || selectors.animation}></div>${view === "character" ? `<aside class="gd-character-mode"><span>CHARACTER LAB</span><h3>Chế độ nhân vật</h3><p>Motion Studio cung cấp puppet layer, trigger và lip-sync marker. Hãy bật camera/micro bên trong engine khi bạn chủ động cần tracking.</p></aside>` : ""}</section>`;
  }

  function mount(root, options = {}) {
    if (!root) return;
    const view = normalizeView(options.view);
    root.className = "graphic-design-studio";
    root.dataset.graphicDesignMounted = "true";
    root.innerHTML = `
      <header class="gd-hero">
        <div class="gd-hero-orbit" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="gd-hero-copy"><span class="gd-kicker">HH CREATIVE LAB · 24 ENGINES</span><h2>Thiết kế đồ họa</h2><p>Animation, 3D, prototype, motion video và character trong một studio thống nhất.</p><div class="gd-hero-meta"><span><i></i>Local workspace</span><span>⌘ Ctrl K · tìm studio</span><span>Export JSON · asset-ready</span></div></div>
        <div class="gd-hero-art" aria-hidden="true"><div class="gd-art-cube"><b></b><b></b><b></b></div><span>DESIGN<br>IN MOTION</span></div>
      </header>
      <nav class="gd-tabs" aria-label="Các studio thiết kế">${VIEWS.map((item) => `<button type="button" class="${item.id === view ? "is-active" : ""}" data-gd-route="${item.id}" title="${escapeHTML(item.description)}"><span>${item.icon}</span><b>${item.label}</b><small>${item.description}</small></button>`).join("")}</nav>
      <main class="gd-main">${content(view)}</main>
      <footer class="gd-footer"><span><i></i> Sẵn sàng làm việc</span><span>Thiết kế được lưu trên thiết bị này</span><span data-gd-status>Chọn một studio để bắt đầu</span></footer>`;

    root.addEventListener("click", (event) => {
      const routeButton = event.target.closest("[data-gd-route]");
      if (!routeButton) return;
      const next = normalizeView(routeButton.dataset.gdRoute);
      location.hash = `#${routeFor(next)}`;
    });

    if (view === "overview") {
      mountChild(root, "[data-graphic-animation]", globalThis.HHGraphicAnimation);
      mountChild(root, "[data-graphic-3d]", globalThis.HHGraphic3D);
      mountChild(root, "[data-graphic-prototype]", globalThis.HHGraphicPrototype);
      mountChild(root, "[data-graphic-motion]", globalThis.HHGraphicMotion);
    } else if (view === "animation") mountChild(root, "[data-graphic-animation]", globalThis.HHGraphicAnimation);
    else if (view === "3d") mountChild(root, "[data-graphic-3d]", globalThis.HHGraphic3D);
    else if (view === "prototype") mountChild(root, "[data-graphic-prototype]", globalThis.HHGraphicPrototype);
    else if (view === "motion" || view === "character") mountChild(root, "[data-graphic-motion]", globalThis.HHGraphicMotion);
    root.querySelector("[data-gd-status]")?.replaceChildren(document.createTextNode(`${VIEWS.find((item) => item.id === view)?.label || "Studio"} · đã sẵn sàng`));
  }

  function unmount() {
    globalThis.HHGraphicAnimation?.unmount?.();
    globalThis.HHGraphic3D?.unmount?.();
    globalThis.HHGraphicPrototype?.unmount?.();
    globalThis.HHGraphicMotion?.unmount?.();
  }

  globalThis.HHGraphicDesign = Object.freeze({ mount, unmount, views: VIEWS.map((item) => ({ ...item })) });
})();
