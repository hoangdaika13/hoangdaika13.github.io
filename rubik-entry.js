(() => {
  "use strict";

  let controller;
  let generation = 0;

  function unmount() {
    generation++;
    controller?.destroy();
    controller = undefined;
  }

  async function mount(host, options) {
    unmount();
    const expected = generation;
    host.innerHTML = '<p class="rb-loading" role="status">Đang mở Giải Rubik…</p>';
    try {
      const { mountRubik } = await import("./rubik.mjs?v=2");
      if (expected === generation && host.isConnected) controller = mountRubik(host, options);
    } catch (error) {
      if (expected !== generation || !host.isConnected) return;
      console.error("Giải Rubik", error);
      host.innerHTML = '<p class="rb-loading" role="alert">Chưa tải được Giải Rubik. <button type="button">Thử lại</button></p>';
      host.querySelector("button").addEventListener("click", () => mount(host, options), { once: true });
    }
  }

  window.HHRubik = Object.freeze({ mount, unmount });
})();
