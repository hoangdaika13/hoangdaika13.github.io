(() => {
  "use strict";

  const base = window.HHMediaDesign;
  if (!base) return;

  const TOOL = "Photo Editor";
  const STORE = "hh.photo.pro.v1";
  const $ = (root, selector) => root?.querySelector(selector);
  const $$ = (root, selector) => [...(root?.querySelectorAll(selector) || [])];
  const icon = (name) => `<i data-lucide="${name}"></i>`;
  const state = { root: null, outer: null, tab: "edit", navigatorTimer: 0, observer: null };
  const cp1252 = Object.fromEntries([..."€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"].map((char, index) => [char, [0x80,0x82,0x83,0x84,0x85,0x86,0x87,0x88,0x89,0x8a,0x8b,0x8c,0x8e,0x91,0x92,0x93,0x94,0x95,0x96,0x97,0x98,0x99,0x9a,0x9b,0x9c,0x9e,0x9f][index]]));

  function decodeOnce(value) {
    if (!/[ÃÄÆáºá»â€]/.test(value)) return value;
    const bytes = [];
    for (const char of value) {
      const code = char.codePointAt(0);
      if (code <= 255) bytes.push(code);
      else if (cp1252[char] != null) bytes.push(cp1252[char]);
      else return value;
    }
    try { return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes)); } catch { return value; }
  }

  function fixMojibake(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      if (/^(SCRIPT|STYLE)$/.test(node.parentElement?.tagName || "")) return;
      let next = node.nodeValue;
      for (let pass = 0; pass < 2; pass += 1) next = decodeOnce(next);
      if (next !== node.nodeValue) node.nodeValue = next;
    });
    $$(root, "[title],[placeholder],[aria-label]").forEach((node) => {
      ["title", "placeholder", "aria-label"].forEach((name) => {
        if (!node.hasAttribute(name)) return;
        let next = node.getAttribute(name);
        for (let pass = 0; pass < 2; pass += 1) next = decodeOnce(next);
        node.setAttribute(name, next);
      });
    });
  }

  function readState() {
    try { return { tab: "edit", guides: false, autosave: true, ...JSON.parse(localStorage.getItem(STORE) || "{}") }; }
    catch { return { tab: "edit", guides: false, autosave: true }; }
  }

  function saveState(patch = {}) {
    const next = { ...readState(), ...patch };
    localStorage.setItem(STORE, JSON.stringify(next));
    return next;
  }

  function toolbarMarkup() {
    const saved = readState();
    return `<div class="photo-pro-bar">
      <nav aria-label="Không gian Photo Editor">
        <button class="${saved.tab === "edit" ? "is-active" : ""}" data-photo-tab="edit">${icon("panels-top-left")}<span>Biên tập</span></button>
        <button class="${saved.tab === "raw" ? "is-active" : ""}" data-photo-tab="raw">${icon("aperture")}<span>Camera RAW</span></button>
        <button class="${saved.tab === "design" ? "is-active" : ""}" data-photo-tab="design">${icon("pen-tool")}<span>Thiết kế</span></button>
        <button class="${saved.tab === "export" ? "is-active" : ""}" data-photo-tab="export">${icon("send")}<span>Xuất bản</span></button>
      </nav>
      <div><span><i></i> Tự động lưu</span><b>sRGB IEC61966-2.1</b><b>8 bit</b><b>300 ppi</b><button data-photo-action="help" title="Trợ giúp">${icon("circle-help")}</button></div>
    </div>`;
  }

  function quickMarkup() {
    return `<div class="photo-pro-quick">
      <strong>${icon("sparkles")} Công cụ chuyên nghiệp</strong>
      <button data-photo-action="auto">${icon("wand-sparkles")} Tự động cân màu</button>
      <button data-photo-action="portrait">${icon("scan-face")} Chân dung</button>
      <button data-photo-action="heal">${icon("bandage")} Healing</button>
      <button data-photo-action="subject">${icon("scan")} Chọn chủ thể</button>
      <button data-photo-action="mask">${icon("circle-dashed")} Mặt nạ</button>
      <button data-photo-action="smart">${icon("box")} Smart layer</button>
      <button data-photo-action="remove-bg">${icon("scissors")} Xóa nền</button>
      <button data-photo-action="compare">${icon("columns-2")} Trước / Sau</button>
    </div>`;
  }

  function insightMarkup() {
    return `<details class="photo-pro-insight" open>
      <summary><span>${icon("chart-no-axes-combined")} Navigator & Histogram</span><i data-lucide="chevron-down"></i></summary>
      <div class="photo-pro-previews"><canvas width="180" height="110" data-photo-navigator></canvas><canvas width="180" height="110" data-photo-histogram></canvas></div>
      <div class="photo-pro-stats"><span>R <b data-photo-r>0</b></span><span>G <b data-photo-g>0</b></span><span>B <b data-photo-b>0</b></span><span>Luma <b data-photo-luma>0</b></span></div>
    </details>
    <details class="photo-pro-adjustments" open>
      <summary><span>${icon("sliders-horizontal")} Adjustments</span><i data-lucide="chevron-down"></i></summary>
      <div>${[["exposure","sun","Phơi sáng"],["contrast","contrast","Tương phản"],["vibrance","palette","Rực rỡ"],["mono","circle-half","Đen trắng"],["warm","thermometer-sun","Tông ấm"],["cool","snowflake","Tông lạnh"],["vignette","circle-dot-dashed","Vignette"],["reset","rotate-ccw","Đặt lại"]].map(([id,name,label]) => `<button data-photo-adjust="${id}" title="${label}">${icon(name)}<span>${label}</span></button>`).join("")}</div>
    </details>
    <div class="photo-pro-layer-tools"><label>${icon("search")}<input type="search" data-photo-layer-search placeholder="Tìm layer..."></label><button data-photo-action="new-layer" title="Layer mới">${icon("plus")}</button><button data-photo-action="duplicate" title="Nhân đôi">${icon("copy")}</button><button data-photo-action="merge" title="Gộp xuống">${icon("combine")}</button></div>`;
  }

  function rawPanelMarkup() {
    return `<aside class="photo-raw-panel" data-photo-raw-panel hidden>
      <header><div><strong>Camera RAW</strong><span>Điều chỉnh không phá hủy</span></div><button data-photo-action="raw-close">${icon("x")}</button></header>
      <section><strong>Cơ bản</strong>${[["temperature","Nhiệt độ",-100,100,0],["brightness","Phơi sáng",0,200,100],["contrast","Tương phản",0,200,100],["saturation","Bão hòa",0,200,100],["hue","Sắc độ",-180,180,0],["blur","Làm mịn",0,20,0]].map(([id,label,min,max,value]) => `<label><span>${label}<b data-photo-raw-value="${id}">${value}</b></span><input type="range" min="${min}" max="${max}" value="${value}" data-photo-raw="${id}"></label>`).join("")}</section>
      <section><strong>Preset</strong><div class="photo-raw-presets"><button data-photo-adjust="portrait">Chân dung</button><button data-photo-adjust="vibrance">Rực rỡ</button><button data-photo-adjust="warm">Ấm</button><button data-photo-adjust="cool">Lạnh</button></div></section>
      <footer><button data-photo-action="raw-reset">Đặt lại</button><button class="is-primary" data-photo-action="raw-apply">Áp dụng</button></footer>
    </aside>`;
  }

  function advancedAction(id) {
    const node = $(state.root, `[data-adv-action="${id}"]`);
    node?.click();
    return Boolean(node);
  }

  function setProperties(values, history = true) {
    Object.entries(values).forEach(([key, value]) => {
      const field = $(state.root, `[data-adv-prop="${key}"]`);
      if (!field) return;
      field.value = String(value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
      if (history) field.dispatchEvent(new Event("change", { bubbles: true }));
    });
    schedulePreview();
  }

  function applyAdjustment(id) {
    const presets = {
      exposure: { brightness: 112 }, contrast: { contrast: 122 }, vibrance: { saturation: 132, contrast: 108 }, portrait: { brightness: 106, contrast: 104, saturation: 108, temperature: 12, blur: 0 },
      mono: { grayscale: 100, saturation: 0, contrast: 112 }, warm: { temperature: 32, saturation: 114 }, cool: { temperature: -32, saturation: 106 }, vignette: { vignette: 58 },
      reset: { brightness: 100, contrast: 100, saturation: 100, hue: 0, grayscale: 0, sepia: 0, invert: 0, blur: 0, pixelate: 0, vignette: 0, temperature: 0 }
    };
    setProperties(presets[id] || {});
    toast(`Đã áp dụng ${id}.`, "success");
  }

  function toast(message, kind = "info") {
    let node = $(state.root, "[data-photo-toast]");
    if (!node) { node = document.createElement("div"); node.className = "photo-pro-toast"; node.dataset.photoToast = ""; state.root.append(node); }
    node.textContent = message; node.dataset.kind = kind; node.hidden = false;
    clearTimeout(node._timer); node._timer = setTimeout(() => { node.hidden = true; }, 2300);
  }

  function setTab(tab) {
    state.tab = tab;
    saveState({ tab });
    $$(state.root, "[data-photo-tab]").forEach((button) => button.classList.toggle("is-active", button.dataset.photoTab === tab));
    state.root.dataset.photoWorkspace = tab;
    const raw = $(state.root, "[data-photo-raw-panel]");
    if (raw) raw.hidden = tab !== "raw";
    if (tab === "design") advancedAction("editor-panel-properties");
    if (tab === "export") advancedAction("editor-export-dialog");
  }

  function drawPreview() {
    if (!state.root?.isConnected) return;
    const source = $(state.root, "[data-adv-editor-canvas]"), navigator = $(state.root, "[data-photo-navigator]"), histogram = $(state.root, "[data-photo-histogram]");
    if (!source || !navigator || !histogram) return;
    const nctx = navigator.getContext("2d"), hctx = histogram.getContext("2d", { willReadFrequently: true });
    nctx.fillStyle = "#10151a"; nctx.fillRect(0, 0, navigator.width, navigator.height);
    try {
      const ratio = Math.min(navigator.width / source.width, navigator.height / source.height), width = source.width * ratio, height = source.height * ratio;
      nctx.drawImage(source, (navigator.width - width) / 2, (navigator.height - height) / 2, width, height);
      const sample = document.createElement("canvas"); sample.width = 96; sample.height = 64; const sctx = sample.getContext("2d", { willReadFrequently: true }); sctx.drawImage(source, 0, 0, 96, 64);
      const pixels = sctx.getImageData(0, 0, 96, 64).data, bins = [new Uint16Array(64), new Uint16Array(64), new Uint16Array(64)]; let totals = [0,0,0];
      for (let index = 0; index < pixels.length; index += 4) { for (let channel = 0; channel < 3; channel += 1) { bins[channel][pixels[index + channel] >> 2]++; totals[channel] += pixels[index + channel]; } }
      hctx.fillStyle = "#0c1115"; hctx.fillRect(0, 0, histogram.width, histogram.height); hctx.strokeStyle = "#33414b"; for (let y = 22; y < histogram.height; y += 22) { hctx.beginPath(); hctx.moveTo(0,y); hctx.lineTo(histogram.width,y); hctx.stroke(); }
      ["#ff6470","#58de93","#5db8ff"].forEach((color, channel) => { const max = Math.max(...bins[channel], 1); hctx.strokeStyle = color; hctx.beginPath(); bins[channel].forEach((count, index) => { const x = index / 63 * histogram.width, y = histogram.height - count / max * (histogram.height - 8); index ? hctx.lineTo(x,y) : hctx.moveTo(x,y); }); hctx.stroke(); });
      const count = pixels.length / 4; ["r","g","b"].forEach((key,index) => { const node = $(state.root, `[data-photo-${key}]`); if (node) node.textContent = Math.round(totals[index] / count); });
      const luma = $(state.root, "[data-photo-luma]"); if (luma) luma.textContent = Math.round((totals[0] * .2126 + totals[1] * .7152 + totals[2] * .0722) / count);
    } catch {}
  }

  function schedulePreview() { clearTimeout(state.navigatorTimer); state.navigatorTimer = setTimeout(drawPreview, 90); }

  function handleProClick(event) {
    const tab = event.target.closest("[data-photo-tab]");
    if (tab) { setTab(tab.dataset.photoTab); return true; }
    const adjustment = event.target.closest("[data-photo-adjust]");
    if (adjustment) { applyAdjustment(adjustment.dataset.photoAdjust); return true; }
    const action = event.target.closest("[data-photo-action]")?.dataset.photoAction;
    if (!action) return false;
    if (action === "auto") { setProperties({ brightness: 106, contrast: 112, saturation: 112, temperature: 5 }); toast("Đã cân bằng tông màu tự động.", "success"); }
    else if (action === "portrait") applyAdjustment("portrait");
    else if (action === "heal") { const tool = $(state.root, '[data-editor-tool="clone"]'); tool?.click(); toast("Healing dùng công cụ Clone với cọ mềm."); }
    else if (action === "subject" || action === "mask") { advancedAction("editor-select-all"); toast("Đã tạo vùng chọn toàn bộ. Dùng Marquee hoặc Lasso để tinh chỉnh."); }
    else if (action === "smart") { const selected = $(state.root, "[data-adv-layer].is-active"); selected?.querySelector('[data-adv-action="editor-lock"]')?.click(); toast("Đã bảo vệ layer đang chọn.", "success"); }
    else if (action === "remove-bg") location.hash = "#/media-design/background-remover";
    else if (action === "compare") { state.root.classList.toggle("is-photo-compare"); toast(state.root.classList.contains("is-photo-compare") ? "Đang xem trước khi hiệu chỉnh." : "Đang xem kết quả sau hiệu chỉnh."); }
    else if (action === "new-layer") advancedAction("editor-add-raster");
    else if (action === "duplicate") advancedAction("editor-duplicate");
    else if (action === "merge") advancedAction("editor-merge-down");
    else if (action === "help") advancedAction("editor-shortcuts");
    else if (action === "raw-close") setTab("edit");
    else if (action === "raw-reset") { $$(state.root, "input[data-photo-raw]").forEach((field) => { field.value = field.dataset.photoRaw === "brightness" || field.dataset.photoRaw === "contrast" || field.dataset.photoRaw === "saturation" ? 100 : 0; field.dispatchEvent(new Event("input", { bubbles: true })); }); }
    else if (action === "raw-apply") { setTab("edit"); toast("Đã áp dụng thiết lập Camera RAW.", "success"); }
    schedulePreview();
    return true;
  }

  function handleProInput(event) {
    if (event.target.matches("[data-photo-layer-search]")) {
      const query = event.target.value.trim().toLowerCase();
      $$(state.root, "[data-adv-layer]").forEach((row) => { row.hidden = Boolean(query) && !row.textContent.toLowerCase().includes(query); });
      return true;
    }
    if (event.target.matches("input[data-photo-raw]")) {
      const key = event.target.dataset.photoRaw, value = Number(event.target.value), output = $(state.root, `[data-photo-raw-value="${key}"]`);
      if (output) output.textContent = String(value);
      setProperties({ [key]: value }, false);
      return true;
    }
    schedulePreview();
    return false;
  }

  function decorate(outer) {
    cleanupOwn(); state.outer = outer; state.root = $(outer, "[data-adv-editor]"); if (!state.root) return;
    fixMojibake(state.root);
    state.root.classList.add("photo-pro");
    const menubar = $(state.root, ".mdx-ps-menubar"); menubar?.insertAdjacentHTML("afterend", toolbarMarkup());
    const options = $(state.root, ".mdx-editor-options"); options?.insertAdjacentHTML("afterend", quickMarkup());
    const panel = $(state.root, ".mdx-editor-panel"); panel?.insertAdjacentHTML("afterbegin", insightMarkup());
    $(state.root, ".mdx-editor-body")?.insertAdjacentHTML("beforeend", rawPanelMarkup());
    state.tab = readState().tab; setTab(state.tab === "export" ? "edit" : state.tab);
    state.observer = new MutationObserver(schedulePreview); const canvas = $(state.root, "[data-adv-editor-canvas]"); if (canvas) state.observer.observe(canvas, { attributes: true });
    state.root.addEventListener("pointerup", schedulePreview); setTimeout(drawPreview, 180);
    window.lucide?.createIcons?.({ attrs: { width: 15, height: 15, "stroke-width": 1.75 } });
  }

  function cleanupOwn() {
    clearTimeout(state.navigatorTimer); state.observer?.disconnect();
    Object.assign(state, { root: null, outer: null, tab: "edit", navigatorTimer: 0, observer: null });
  }

  addEventListener("keydown", (event) => {
    if (!state.root?.isConnected || !location.hash.includes("/media-design/photo-editor") || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) return;
    if (event.key.toLowerCase() === "j") $(state.root, '[data-editor-tool="clone"]')?.click();
    if (event.key.toLowerCase() === "q") { event.preventDefault(); advancedAction("editor-select-all"); }
    if (event.altKey && event.key.toLowerCase() === "r") { event.preventDefault(); setTab("raw"); }
  });

  window.HHMediaDesign = {
    supports: (name) => name === TOOL || base.supports(name),
    render(outer, name) { base.render(outer, name); if (name === TOOL) decorate(outer); },
    cleanup() { cleanupOwn(); base.cleanup?.(); },
    handleClick(event, outer, name) { if (name === TOOL && handleProClick(event)) return; return base.handleClick?.(event, outer, name); },
    handleInput(event, outer, name) { if (name === TOOL && handleProInput(event)) return; return base.handleInput?.(event, outer, name); },
    handleChange(event, outer, name) { if (name === TOOL) schedulePreview(); return base.handleChange?.(event, outer, name); }
  };
})();
