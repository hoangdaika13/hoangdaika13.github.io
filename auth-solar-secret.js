(() => {
  "use strict";

  const gate = document.querySelector("#authGate");
  const galaxy = gate?.querySelector("[data-hh-galaxy]");
  if (!gate || !galaxy || galaxy.dataset.hhSolarSecretMounted === "true") return;

  const controller = new AbortController();
  const { signal } = controller;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)") || null;

  const STAGES = Object.freeze([
    Object.freeze({ kind: "idle", label: "ĐỪNG BẤM", message: "Một tín hiệu tò mò vừa thức giấc. Bạn có thể đóng lại bất cứ lúc nào." }),
    Object.freeze({ kind: "shake", label: "ĐỪNG BẤM", message: "Tín hiệu 01/12 · Lõi mặt trời chỉ rung nhẹ… nhưng nó đã ghi nhớ." }),
    Object.freeze({ kind: "escape", label: "ĐỪNG BẤM", message: "Tín hiệu 02/12 · Nút đã phát hiện ý định của bạn và chạy trốn." }),
    Object.freeze({ kind: "red", label: "ĐỪNG BẤM", message: "Tín hiệu 03/12 · Cảnh báo đỏ: bạn đang đi sâu hơn vào vùng bí mật." }),
    Object.freeze({ kind: "confirm", label: "ĐỪNG BẤM", message: "Tín hiệu 04/12 · Bạn thực sự muốn tiếp tục?" }),
    Object.freeze({ kind: "ufo", label: "ĐỪNG BẤM", message: "Tín hiệu 05/12 · Một UFO vừa lướt qua quỹ đạo. Nó cũng đang tò mò." }),
    Object.freeze({ kind: "orbit", label: "ĐỪNG BẤM", message: "Tín hiệu 06/12 · Quỹ đạo đảo chiều trong vài nhịp thở." }),
    Object.freeze({ kind: "glitch", label: "ĐỪNG BẤM", message: "Tín hiệu 07/12 · Tín hiệu nhiễu đã biến thành một thông điệp mới." }),
    Object.freeze({ kind: "rainbow", label: "ĐỪNG BẤM", message: "Tín hiệu 08/12 · Plasma cầu vồng đang mở một đường hầm nhỏ." }),
    Object.freeze({ kind: "supernova", label: "ĐỪNG BẤM", message: "Tín hiệu 09/12 · Siêu tân tinh mini đã được kích hoạt an toàn." }),
    Object.freeze({ kind: "signal", label: "ĐỪNG BẤM", message: "Tín hiệu 10/12 · Đã giải mã một lời nhắn từ phía bên kia." }),
    Object.freeze({ kind: "portal", label: "ĐỪNG BẤM", message: "Tín hiệu 11/12 · Cổng bí mật chỉ còn một lớp bảo vệ." }),
    Object.freeze({ kind: "unlock", label: "MỞ TÍN HIỆU CUỐI", message: "Tín hiệu 12/12 · Bạn đã tìm thấy HH Solar Secret." })
  ]);

  const makeMarkup = () => {
    const layer = document.createElement("div");
    layer.className = "hh-solar-secret-layer";
    layer.dataset.stage = "0";
    layer.innerHTML = `
      <button class="hh-solar-secret__sun-hit" type="button" data-solar-sun-hit aria-expanded="false" aria-label="Mở tín hiệu bí mật ở trung tâm mặt trời"></button>
      <section class="hh-solar-secret__panel" data-solar-panel aria-label="Tín hiệu bí mật của trung tâm mặt trời">
        <div class="hh-solar-secret__eyebrow"><i></i><span data-solar-progress>TÍN HIỆU 00 / 12</span></div>
        <p class="hh-solar-secret__message" data-solar-message>Đang chờ một cú chạm tò mò…</p>
        <button class="hh-solar-secret__trigger" type="button" data-solar-trigger>ĐỪNG BẤM</button>
        <div class="hh-solar-secret__confirm" data-solar-confirm hidden role="group" aria-label="Xác nhận tiếp tục">
          <strong>Bạn thực sự muốn tiếp tục?</strong>
          <div>
            <button type="button" data-solar-continue>Tiếp tục</button>
            <button type="button" data-solar-stop>Dừng lại</button>
          </div>
        </div>
        <div class="hh-solar-secret__unlock" data-solar-unlock hidden role="status">
          <span class="hh-solar-secret__glyph" aria-hidden="true">✦</span>
          <div><strong>HH SOLAR SECRET</strong><small>Không có phần thưởng ẩn hay dữ liệu gửi đi — chỉ là một khoảnh khắc vui.</small></div>
        </div>
        <button class="hh-solar-secret__close" type="button" data-solar-close>Đóng tín hiệu</button>
      </section>
      <div class="hh-solar-secret__ufo" data-solar-ufo aria-hidden="true"></div>
      <div class="hh-solar-secret__spark" data-solar-spark aria-hidden="true"></div>`;
    return layer;
  };

  const layer = makeMarkup();
  const redVeil = document.createElement("div");
  redVeil.className = "hh-solar-secret__red-veil";
  redVeil.setAttribute("aria-hidden", "true");
  redVeil.hidden = true;
  galaxy.append(layer);
  gate.append(redVeil);
  galaxy.dataset.hhSolarSecretMounted = "true";

  const sunHit = layer.querySelector("[data-solar-sun-hit]");
  const panel = layer.querySelector("[data-solar-panel]");
  const trigger = layer.querySelector("[data-solar-trigger]");
  const progress = layer.querySelector("[data-solar-progress]");
  const message = layer.querySelector("[data-solar-message]");
  const confirm = layer.querySelector("[data-solar-confirm]");
  const continueButton = layer.querySelector("[data-solar-continue]");
  const stopButton = layer.querySelector("[data-solar-stop]");
  const unlock = layer.querySelector("[data-solar-unlock]");
  const close = layer.querySelector("[data-solar-close]");
  const ufo = layer.querySelector("[data-solar-ufo]");

  let stageIndex = 0;
  let confirmOpen = false;
  let complete = false;

  const stageClasses = STAGES.map(({ kind }) => `is-stage-${kind}`);

  const dispatch = (name, detail = {}) => {
    layer.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
  };

  const announce = (stage) => {
    if (!progress || !message || !trigger) return;
    progress.textContent = `TÍN HIỆU ${String(stageIndex).padStart(2, "0")} / 12`;
    message.textContent = stage.message;
    trigger.textContent = stage.label;
    trigger.hidden = complete || confirmOpen;
    if (unlock) unlock.hidden = !complete;
    if (confirm) confirm.hidden = !confirmOpen;
  };

  const setStage = (nextIndex, source = "click") => {
    stageIndex = Math.max(0, Math.min(STAGES.length - 1, nextIndex));
    const stage = STAGES[stageIndex];
    complete = stage.kind === "unlock";
    confirmOpen = stage.kind === "confirm";
    layer.dataset.stage = String(stageIndex);
    layer.classList.remove(...stageClasses);
    layer.classList.add(`is-stage-${stage.kind}`);
    if (stage.kind === "escape") {
      const escapeX = reducedMotion?.matches ? 0 : (stageIndex % 2 ? 48 : -58);
      const escapeY = reducedMotion?.matches ? 0 : (stageIndex % 2 ? -9 : 12);
      layer.style.setProperty("--solar-escape-x", `${escapeX}px`);
      layer.style.setProperty("--solar-escape-y", `${escapeY}px`);
    } else {
      layer.style.setProperty("--solar-escape-x", "0px");
      layer.style.setProperty("--solar-escape-y", "0px");
    }
    redVeil.hidden = stage.kind !== "red";
    if (ufo) ufo.hidden = stage.kind !== "ufo";
    announce(stage);
    if (confirmOpen) continueButton?.focus({ preventScroll: true });
    dispatch("hh:auth-solar-secret", { stage: stageIndex, kind: stage.kind, source, complete });
  };

  const openSecret = () => {
    if (layer.classList.contains("is-open")) return;
    layer.classList.add("is-open");
    sunHit?.setAttribute("aria-expanded", "true");
    setStage(0, "sun");
    trigger?.focus({ preventScroll: true });
  };

  const closeSecret = ({ restoreFocus = true } = {}) => {
    setStage(0, "close");
    layer.classList.remove("is-open", ...stageClasses);
    redVeil.hidden = true;
    if (ufo) ufo.hidden = true;
    confirmOpen = false;
    complete = false;
    stageIndex = 0;
    sunHit?.setAttribute("aria-expanded", "false");
    if (restoreFocus) sunHit?.focus({ preventScroll: true });
  };

  const resetSecret = () => {
    confirmOpen = false;
    complete = false;
    setStage(0, "reset");
    trigger?.focus({ preventScroll: true });
  };

  const nextStage = (source = "trigger") => {
    if (complete) {
      resetSecret();
      return;
    }
    const stage = STAGES[stageIndex];
    if (stage.kind === "confirm" && !confirmOpen) {
      confirmOpen = true;
      announce(stage);
      continueButton?.focus({ preventScroll: true });
      return;
    }
    confirmOpen = false;
    setStage(stageIndex + 1, source);
  };

  const stopAtConfirm = () => {
    confirmOpen = false;
    setStage(0, "stop");
    if (message) message.textContent = "Đã dừng an toàn. Tín hiệu vẫn ở đây nếu bạn muốn thử lại.";
    trigger?.focus({ preventScroll: true });
  };

  sunHit?.addEventListener("click", openSecret, { signal });
  trigger?.addEventListener("click", () => nextStage(), { signal });
  continueButton?.addEventListener("click", () => {
    confirmOpen = false;
    setStage(stageIndex + 1, "confirm");
  }, { signal });
  stopButton?.addEventListener("click", stopAtConfirm, { signal });
  close?.addEventListener("click", () => closeSecret(), { signal });
  layer.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSecret();
    }
  }, { signal });

  gate.addEventListener("hh:auth-change", (event) => {
    if (event.detail?.user) closeSecret({ restoreFocus: false });
  }, { signal });
  window.addEventListener("pagehide", () => {
    controller.abort();
    layer.remove();
    redVeil.remove();
    delete galaxy.dataset.hhSolarSecretMounted;
  }, { once: true, signal });

  if (reducedMotion?.matches) layer.dataset.motion = "static";
  reducedMotion?.addEventListener?.("change", () => {
    layer.dataset.motion = reducedMotion.matches ? "static" : "cinematic";
  }, { signal });

  window.HHSolarSecret = Object.freeze({
    version: 1,
    open: openSecret,
    close: closeSecret,
    reset: resetSecret,
    getStage: () => stageIndex
  });
})();
