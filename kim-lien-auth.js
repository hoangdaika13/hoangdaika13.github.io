/*
 * Kim Liên Điện — authentication and loading identity layer
 *
 * This file is intentionally presentation-only.  It does not submit forms,
 * change validation, touch tokens, or alter the router.  It only adds a
 * Buddhist visual identity and translates a few known, legacy brand strings
 * when they are still present.
 */
(() => {
  "use strict";

  const lotusSvg = (prefix = "klLotus") => `
    <svg class="kl-lotus-svg" viewBox="0 0 120 96" role="img" aria-label="Hoa sen Kim Liên Điện" focusable="false">
      <defs>
        <linearGradient id="${prefix}Gold" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#fff0b5"/>
          <stop offset=".42" stop-color="#e7b84c"/>
          <stop offset="1" stop-color="#a85d1d"/>
        </linearGradient>
        <linearGradient id="${prefix}Rose" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#ffe9b0"/>
          <stop offset=".62" stop-color="#cf7b43"/>
          <stop offset="1" stop-color="#8b2f2f"/>
        </linearGradient>
      </defs>
      <path class="kl-lotus-glow" d="M60 9c9 11 12 22 9 33 10-13 22-19 34-17-6 16-18 27-34 32 17-1 30 4 38 15-17 8-32 5-47-5-15 10-30 13-47 5 8-11 21-16 38-15C35 52 23 41 17 25c12-2 24 4 34 17C48 31 51 20 60 9Z" fill="url(#${prefix}Rose)" opacity=".96"/>
      <path d="M60 15c5 10 6 20 0 32-6-12-5-22 0-32Z" fill="url(#${prefix}Gold)"/>
      <path d="M53 49C43 35 32 29 22 29c7 12 17 20 31 25Z" fill="url(#${prefix}Gold)"/>
      <path d="M67 49c10-14 21-20 31-20-7 12-17 20-31 25Z" fill="url(#${prefix}Gold)"/>
      <path d="M16 71c15-5 30-4 44 5 14-9 29-10 44-5-12 12-27 17-44 14-17 3-32-2-44-14Z" fill="url(#${prefix}Gold)"/>
      <path d="M28 82h64" stroke="#ffe8a3" stroke-width="2" stroke-linecap="round" opacity=".7"/>
    </svg>`;

  const wheelSvg = () => `
    <svg class="kl-wheel-svg" viewBox="0 0 160 160" role="img" aria-label="Pháp luân tám cánh" focusable="false">
      <circle cx="80" cy="80" r="66" fill="none" stroke="currentColor" stroke-width="2" opacity=".38"/>
      <circle cx="80" cy="80" r="12" fill="currentColor" opacity=".9"/>
      <g stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".76">
        <path d="M80 18v50M80 92v50M18 80h50M92 80h50"/>
        <path d="m36 36 35 35M89 89l35 35M124 36 89 71M71 89 36 124"/>
      </g>
      <circle cx="80" cy="80" r="54" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2 8" opacity=".52"/>
    </svg>`;

  const buddhaSvg = () => `
    <svg class="kl-buddha-svg" viewBox="0 0 320 300" role="img" aria-label="Đức Phật an tọa trên đài sen" focusable="false">
      <defs>
        <radialGradient id="klBuddhaHalo" cx="50%" cy="46%" r="52%">
          <stop offset="0" stop-color="#fff6c9" stop-opacity=".96"/>
          <stop offset=".5" stop-color="#e6b649" stop-opacity=".52"/>
          <stop offset="1" stop-color="#9f4e20" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="klBuddhaGold" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#fff2b0"/>
          <stop offset=".5" stop-color="#dca83c"/>
          <stop offset="1" stop-color="#9e541e"/>
        </linearGradient>
      </defs>
      <circle cx="160" cy="126" r="119" fill="url(#klBuddhaHalo)"/>
      <circle cx="160" cy="126" r="92" fill="none" stroke="#f6d87a" stroke-width="2" opacity=".55"/>
      <g fill="url(#klBuddhaGold)">
        <circle cx="160" cy="73" r="25"/>
        <circle cx="160" cy="45" r="7"/>
        <path d="M123 105c6-17 20-27 37-27s31 10 37 27l18 54c-13 13-32 20-55 20s-42-7-55-20l18-54Z"/>
        <path d="M126 132c-25 10-37 28-37 54 13 8 29 10 47 5l20-29-8-28-22-2Z" opacity=".92"/>
        <path d="M194 132c25 10 37 28 37 54-13 8-29 10-47 5l-20-29 8-28 22-2Z" opacity=".92"/>
        <path d="M112 186c22 12 42 18 48 18s26-6 48-18l22 23c-21 13-44 20-70 20s-49-7-70-20l22-23Z"/>
      </g>
      <path d="M74 252c26-18 55-23 86-15 31-8 60-3 86 15-23 20-51 30-86 30s-63-10-86-30Z" fill="url(#klBuddhaGold)"/>
      <path d="M97 256c20-11 41-13 63-6 22-7 43-5 63 6" fill="none" stroke="#fff0a6" stroke-width="2" opacity=".68"/>
    </svg>`;

  const exactTextRules = [
    ["H Creative Universe", "HH Phật Pháp"],
    ["Một vũ trụ · Mọi khả năng sáng tạo", "Kim Liên Điện · Một nẻo an trú"],
    ["Bước vào thiên hà. Đánh thức mọi ý tưởng.", "An trú trong chánh niệm. Nuôi lớn từ tâm."],
    ["Một tài khoản mở toàn bộ hệ sinh thái HH — nơi AI, học tập, sáng tạo và cộng đồng cùng vận hành trong một không gian liền mạch.", "Một tài khoản mở không gian tu học, kinh điển và thực hành chánh niệm trong một nơi trang nghiêm, dễ tiếp cận."],
    ["CHÀO MỪNG ĐẾN HH", "KIM LIÊN ĐIỆN"],
    ["Đăng nhập hoặc tạo tài khoản miễn phí", "Đăng nhập để tiếp tục hành trình tu học"],
    ["Đăng nhập vào HH Platform", "Vào Kim Liên Điện"],
    ["Xác minh và vào HH Platform", "Xác minh và vào Kim Liên Điện"],
    ["COSMIC NAVIGATION", "KIM LIÊN CHUYỂN CẢNH"],
    ["Đang mở HH Platform", "Đang mở Kim Liên Điện"],
    ["Đang mở workspace", "Đang mở không gian tu học"],
    ["Đang chuẩn bị giao diện và dữ liệu cần thiết...", "Đang chuẩn bị không gian tu học an toàn…"],
    ["Workspace đã sẵn sàng.", "Không gian đã sẵn sàng."],
    ["Đang khôi phục workspace…", "Đang khôi phục không gian tu học…"],
    ["Đang đồng bộ bố cục và tùy chọn đã lưu", "Đang đồng bộ bố cục và thời khóa đã lưu"],
    ["Chỉ tải tài nguyên của workspace hiện tại", "Chỉ tải tài nguyên của không gian hiện tại"],
    ["Tài nguyên đã sẵn sàng · Đang dựng giao diện cuối", "Tài nguyên đã sẵn sàng · Đang hoàn thiện Kim Liên Điện"],
    ["Hoàn tất · Mở cổng an toàn", "Hoàn tất · Mở cổng Kim Liên"],
    ["Không thể mở workspace.", "Không thể mở không gian tu học."],
    ["Các workspace khác vẫn được để nghỉ cho đến khi bạn mở.", "Các không gian khác sẽ được giữ nguyên cho đến khi bạn mở."],
    ["Đang tải chức năng cần thiết", "Đang mở chức năng tu học cần thiết"],
    ["Đang chuẩn bị cổng đăng nhập...", "Đang chuẩn bị cổng Kim Liên Điện…"],
    ["Hiệu ứng: Cao", "Chuyển động: Trang nghiêm"],
    ["Hiệu ứng: Nhẹ", "Chuyển động: Nhẹ"],
    ["Hiệu ứng: Tắt", "Chuyển động: Tĩnh"],
    ["Điện ảnh", "Chuyển động: Trang nghiêm"],
    ["Cân bằng", "Chuyển động: Nhẹ"],
    ["Tĩnh", "Chuyển động: Tĩnh"]
  ];

  const replaceExactText = (root) => {
    if (!root) return;
    const nodes = root.querySelectorAll("h1,h2,h3,h4,p,strong,small,span,b,button,li,summary,code");
    nodes.forEach((node) => {
      if (node.children.length) return;
      const current = node.textContent.trim();
      const rule = exactTextRules.find(([from]) => from === current);
      if (rule) node.textContent = rule[1];
      else if (current.endsWith(" · COSMIC NAVIGATION")) {
        node.textContent = `${current.slice(0, -" · COSMIC NAVIGATION".length)} · KIM LIÊN CHUYỂN CẢNH`;
      }
    });

    // These two legacy brand nodes intentionally contain nested markup.  Only
    // replace them when their complete text is still the known old copy; no
    // user-entered form value can reach this branch.
    const hero = root.querySelector(".auth-gate-brand > h1");
    if (hero && hero.textContent.trim() === "Bước vào thiên hà. Đánh thức mọi ý tưởng.") {
      hero.innerHTML = "<span>An trú trong chánh niệm.</span> Nuôi lớn từ tâm.";
    }
    const lockupTagline = root.querySelector(".auth-brand-lockup > div > span");
    if (lockupTagline && lockupTagline.textContent.trim() === "Một vũ trụ · Mọi khả năng sáng tạo") {
      lockupTagline.innerHTML = "<i aria-hidden=\"true\"></i> Kim Liên Điện · Một nẻo an trú";
    }
  };

  const appendOnce = (parent, selector, markup, position = "beforeend") => {
    if (!parent || parent.querySelector(selector)) return parent?.querySelector(selector) || null;
    const template = document.createElement("template");
    template.innerHTML = markup.trim();
    const element = template.content.firstElementChild;
    if (element) {
      if (/^\.[a-z0-9_-]+$/i.test(selector)) element.classList.add(selector.slice(1));
      parent.insertAdjacentElement(position, element);
    }
    return element;
  };

  const enhanceAuthGate = (gate) => {
    if (!gate) return;
    if (gate.getAttribute("aria-label") === "Đăng nhập để vào trang chủ") {
      gate.setAttribute("aria-label", "Đăng nhập vào Kim Liên Điện");
    }
    if (gate.dataset.kimLienEnhanced === "true") {
      replaceExactText(gate);
      return;
    }
    gate.dataset.kimLienEnhanced = "true";
    gate.classList.add("kim-lien-auth-gate");

    // Keep old decorative runtimes mounted for their own cleanup, but give the
    // theme a stable, independent visual layer.
    appendOnce(gate, ".kl-auth-ambient", `
      <div class="kl-auth-ambient" aria-hidden="true">
        <span class="kl-ambient-arch"></span><span class="kl-ambient-lantern kl-ambient-lantern--left"></span><span class="kl-ambient-lantern kl-ambient-lantern--right"></span>
        <span class="kl-ambient-mist"></span>
      </div>`, "afterbegin");

    const brand = gate.querySelector(".auth-gate-brand");
    if (brand) {
      const mark = brand.querySelector(".auth-h-channel-mark, .brand-mark");
      if (mark) {
        mark.setAttribute("aria-label", "Biểu tượng hoa sen Kim Liên Điện");
        mark.classList.add("kl-brand-seal");
        appendOnce(mark, ".kl-brand-lotus", lotusSvg("klBrandLotus"));
      }
      appendOnce(brand, ".kl-sanctum-panel", `
        <section class="kl-sanctum-panel" aria-label="Không gian Kim Liên Điện">
          <div class="kl-sanctum-art"><img class="kl-sanctum-buddha-image" src="assets/phat-phap/duc-phat-hao-quang-v1.webp" width="1536" height="1024" loading="eager" decoding="async" alt="Tranh minh họa Đức Phật Thích Ca tọa thiền trong hào quang vàng"><span class="kl-art-ring kl-art-ring--one"></span><span class="kl-art-ring kl-art-ring--two"></span></div>
          <div class="kl-sanctum-copy">
            <p class="kl-eyebrow"><span class="kl-mini-wheel">${wheelSvg()}</span> KIM LIÊN ĐIỆN</p>
            <h2>Ánh vàng soi đường tu học</h2>
            <p>Đọc kinh, nghe pháp thoại, thiền tập và ghi lại những điều lành trong một không gian bình an.</p>
            <div class="kl-sanctum-links"><span><i>☸</i> Giáo lý &amp; Kinh điển</span><span><i>◌</i> Thiền &amp; Niệm Phật</span><span><i>⌂</i> Đi chùa online</span></div>
          </div>
        </section>`);
    }

    const card = gate.querySelector("[data-auth-card]");
    if (card) {
      card.classList.add("kl-auth-card");
      const headingMark = card.querySelector(".auth-card-heading > span");
      if (headingMark) {
        headingMark.classList.add("kl-card-seal");
        appendOnce(headingMark, ".kl-card-lotus", lotusSvg("klCardLotus"));
      }
    }
    replaceExactText(gate);
  };

  const enhanceBootSurface = (surface) => {
    if (!surface) return;
    if ((surface.getAttribute("aria-label") || "").includes("HH Platform")) {
      surface.setAttribute("aria-label", "Đang khởi tạo Kim Liên Điện");
    }
    if (surface.dataset.kimLienEnhanced === "true") {
      replaceExactText(surface);
      return;
    }
    surface.dataset.kimLienEnhanced = "true";
    surface.classList.add("kim-lien-boot-surface");
    const mark = surface.querySelector(".hh-boot-mark");
    if (mark) {
      mark.setAttribute("aria-label", "Biểu tượng hoa sen Kim Liên Điện");
      appendOnce(mark, ".kl-boot-lotus", lotusSvg("klBootLotus"));
    }
    const core = surface.querySelector(".hh-boot-core");
    if (core) appendOnce(core, ".kl-boot-wheel", wheelSvg());
    replaceExactText(surface);
  };

  const enhanceRouteLoader = (loader) => {
    if (!loader) return;
    if (loader.dataset.kimLienEnhanced === "true") {
      replaceExactText(loader);
      return;
    }
    loader.dataset.kimLienEnhanced = "true";
    loader.classList.add("kim-lien-route-loader");
    replaceExactText(loader);
  };

  const apply = () => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.add("kim-lien-theme");
    root.dataset.kimLienTheme = "a-kim-lien-dien";
    body?.classList.add("kim-lien-theme");
    enhanceAuthGate(document.getElementById("authGate"));
    enhanceBootSurface(document.getElementById("hhBootSurface"));
    enhanceRouteLoader(document.getElementById("appCosmicLoader"));
  };

  const start = () => {
    apply();
    let applyQueued = false;
    const observer = new MutationObserver(() => {
      if (applyQueued) return;
      applyQueued = true;
      queueMicrotask(() => {
        applyQueued = false;
        apply();
      });
    });
    // Observe only the three visual surfaces.  Watching the application root
    // would make unrelated workspaces (especially games) pay for this theme.
    [document.getElementById("authGate"), document.getElementById("hhBootSurface"), document.getElementById("appCosmicLoader")]
      .filter(Boolean)
      .forEach((surface) => observer.observe(surface, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["aria-label"] }));
    window.addEventListener("pagehide", () => observer.disconnect(), { once: true });
  };

  if (document.getElementById("authGate")) start();
  else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
