(() => {
  "use strict";

  const base = window.HHMediaDesign;
  if (!base) return;

  const PHOTO = "Photo Editor";
  const VIDEO = "Video Editor";
  const $ = (root, selector) => root?.querySelector(selector);
  const $$ = (root, selector) => [...(root?.querySelectorAll(selector) || [])];
  const icon = (name) => `<i data-lucide="${name}"></i>`;
  const state = { root: null, tool: "", context: null, saveTimer: 0 };

  function button(action, name, label, shortcut = "") {
    return `<button type="button" data-ew-action="${action}" title="${label}${shortcut ? ` (${shortcut})` : ""}">${icon(name)}<span>${label}</span>${shortcut ? `<kbd>${shortcut}</kbd>` : ""}</button>`;
  }

  function ensureIcons() {
    window.lucide?.createIcons?.({ attrs: { width: 15, height: 15, "stroke-width": 1.75 } });
  }

  function advancedAction(id) {
    const target = $(state.root, `[data-adv-action="${id}"]`);
    target?.click();
    return Boolean(target);
  }

  function videoAction(id) {
    const target = $(state.root, `[data-ve-action="${id}"]`);
    target?.click();
    return Boolean(target);
  }

  function setPhotoZoom(value) {
    const field = $(state.root, "[data-adv-editor-zoom]");
    if (!field) return;
    const next = Math.max(.1, Math.min(3, Number(value) || .75));
    let option = [...field.options].find((item) => Number(item.value) === next);
    if (!option) {
      option = new Option(`${Math.round(next * 100)}%`, String(next));
      field.add(option);
    }
    field.value = String(next);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    updatePhotoZoom();
  }

  function updatePhotoZoom() {
    const field = $(state.root, "[data-adv-editor-zoom]");
    const output = $(state.root, "[data-ew-photo-zoom]");
    if (field && output) output.textContent = `${Math.round(Number(field.value) * 100)}%`;
  }

  function photoDockMarkup() {
    return `<div class="ew-photo-dock" data-ew-photo-dock>
      <div class="ew-workflow-group"><strong>Vùng chọn</strong>${button("photo-select-all", "scan", "Chọn tất cả", "Ctrl+A")}${button("photo-deselect", "scan-line", "Bỏ chọn", "Ctrl+D")}${button("photo-selection-layer", "layers-3", "Tách thành layer")}${button("photo-crop-selection", "crop", "Crop vùng chọn")}</div>
      <div class="ew-workflow-group"><strong>Layer</strong>${button("photo-new-layer", "plus-square", "Layer pixel")}${button("photo-duplicate", "copy", "Nhân đôi", "Ctrl+J")}${button("photo-merge", "combine", "Gộp xuống")}${button("photo-delete", "trash-2", "Xóa layer", "Delete")}</div>
      <div class="ew-workflow-group ew-photo-view"><strong>Khung nhìn</strong>${button("photo-zoom-out", "zoom-out", "Thu nhỏ")}
        <button class="ew-zoom-value" type="button" data-ew-action="photo-zoom-100" title="Kích thước 100%" data-ew-photo-zoom>75%</button>
        ${button("photo-zoom-in", "zoom-in", "Phóng to")}${button("photo-fit", "maximize", "Vừa màn hình", "Ctrl+0")}${button("photo-grid", "grid-3x3", "Lưới")}${button("photo-guides", "ruler", "Guides")}
      </div>
      <span class="ew-session-state">${icon("shield-check")} Xử lý cục bộ trên thiết bị</span>
    </div>`;
  }

  function decoratePhoto(outer) {
    const root = $(outer, "[data-adv-editor]");
    if (!root || $(root, "[data-ew-photo-dock]")) return;
    state.root = root;
    state.tool = PHOTO;
    root.classList.add("editor-workflow-pro", "editor-workflow-photo");
    const tabs = $(root, ".mdx-document-tabs");
    tabs?.insertAdjacentHTML("afterend", photoDockMarkup());
    const stage = $(root, "[data-adv-editor-stage]");
    stage?.insertAdjacentHTML("afterbegin", `<div class="ew-photo-guides" data-ew-photo-guides hidden><i></i><i></i></div>`);
    root.insertAdjacentHTML("beforeend", `<div class="ew-context-menu" data-ew-context hidden></div>`);
    root.addEventListener("contextmenu", openPhotoContext);
    root.addEventListener("pointerdown", closeContext);
    $(root, "[data-adv-editor-zoom]")?.addEventListener("input", updatePhotoZoom);
    updatePhotoZoom();
    ensureIcons();
  }

  function videoToolbarMarkup() {
    return `<div class="ew-video-monitorbar" data-ew-video-monitorbar>
      <div class="ew-monitor-marks"><strong>Nguồn</strong>${button("video-mark-in", "chevron-left", "Đặt điểm In", "I")}${button("video-mark-out", "chevron-right", "Đặt điểm Out", "O")}</div>
      <div class="ew-monitor-view"><strong>Khung xem</strong><select data-ew-video-view title="Chế độ hiển thị"><option value="fit">Vừa khung</option><option value="fill">Lấp đầy</option><option value="actual">100%</option></select></div>
      <div class="ew-monitor-playback"><strong>Phát</strong><select data-ew-video-rate title="Tốc độ phát"><option value="0.5">0.5x</option><option value="1" selected>1x</option><option value="1.5">1.5x</option><option value="2">2x</option><option value="4">4x</option></select>${button("video-loop", "repeat-2", "Phát lặp")}${button("video-mute", "volume-2", "Tắt tiếng")}${button("video-capture", "camera", "Chụp frame")}${button("video-monitor-fullscreen", "maximize-2", "Toàn màn hình monitor")}</div>
      <span class="ew-autosave" data-ew-autosave>${icon("cloud-check")} Đã lưu cục bộ</span>
    </div>`;
  }

  function timelineToolsMarkup() {
    return `<div class="ew-timeline-tools" data-ew-timeline-tools>${button("video-zoom-out", "zoom-out", "Thu nhỏ timeline", "-")}${button("video-zoom-fit", "scan", "Vừa timeline")}${button("video-zoom-in", "zoom-in", "Phóng timeline", "+")}</div>`;
  }

  function decorateVideo(outer) {
    const root = $(outer, "[data-ve-editor]");
    if (!root || $(root, "[data-ew-video-monitorbar]")) return;
    state.root = root;
    state.tool = VIDEO;
    root.classList.add("editor-workflow-pro", "editor-workflow-video");
    const monitorHeader = $(root, ".ve-monitor-tabs");
    monitorHeader?.insertAdjacentHTML("afterend", videoToolbarMarkup());
    const zoom = $(root, "[data-ve-zoom]")?.closest("label");
    zoom?.insertAdjacentHTML("beforebegin", timelineToolsMarkup());
    root.insertAdjacentHTML("beforeend", `<div class="ew-context-menu" data-ew-context hidden></div>`);
    root.addEventListener("contextmenu", openVideoContext);
    root.addEventListener("pointerdown", closeContext);
    root.addEventListener("input", markSaving);
    root.addEventListener("change", markSaving);
    ensureIcons();
  }

  function openPhotoContext(event) {
    const layer = event.target.closest("[data-adv-layer]");
    const canvas = event.target.closest("[data-adv-editor-canvas]");
    if (!layer && !canvas) return;
    event.preventDefault();
    const rows = layer
      ? [["photo-duplicate", "copy", "Nhân đôi layer"], ["photo-layer-up", "arrow-up", "Đưa lên"], ["photo-layer-down", "arrow-down", "Đưa xuống"], ["photo-merge", "combine", "Gộp xuống"], ["photo-delete", "trash-2", "Xóa layer"]]
      : [["photo-fit", "maximize", "Vừa màn hình"], ["photo-zoom-100", "scan", "Kích thước 100%"], ["photo-select-all", "scan", "Chọn tất cả"], ["photo-paste", "clipboard-paste", "Dán từ clipboard"], ["photo-grid", "grid-3x3", "Bật/tắt lưới"], ["photo-export", "download", "Xuất ảnh"]];
    showContext(event, rows);
  }

  function openVideoContext(event) {
    const clip = event.target.closest("[data-ve-clip],[data-ve-title]");
    const timeline = event.target.closest("[data-ve-timeline]");
    if (!clip && !timeline) return;
    event.preventDefault();
    clip?.click();
    const rows = clip
      ? [["video-split", "scissors", "Cắt tại playhead"], ["video-duplicate", "copy", "Nhân đôi clip"], ["video-ripple-delete", "between-horizontal-end", "Xóa dồn"], ["video-delete", "trash-2", "Xóa clip"]]
      : [["video-marker", "map-pin", "Thêm marker"], ["video-title", "type", "Thêm tiêu đề"], ["video-zoom-fit", "scan", "Vừa timeline"], ["video-sequence-start", "skip-back", "Về đầu sequence"], ["video-sequence-end", "skip-forward", "Tới cuối sequence"]];
    showContext(event, rows);
  }

  function showContext(event, rows) {
    const menu = $(state.root, "[data-ew-context]");
    if (!menu) return;
    menu.innerHTML = rows.map(([action, name, label]) => `<button type="button" data-ew-action="${action}">${icon(name)}<span>${label}</span></button>`).join("");
    menu.hidden = false;
    const width = 190;
    menu.style.left = `${Math.min(event.clientX, innerWidth - width - 10)}px`;
    menu.style.top = `${Math.min(event.clientY, innerHeight - rows.length * 34 - 10)}px`;
    ensureIcons();
  }

  function closeContext(event) {
    if (event?.target.closest("[data-ew-context]")) return;
    const menu = $(state.root, "[data-ew-context]");
    if (menu) menu.hidden = true;
  }

  function dispatchEditorKey(key, options = {}) {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options }));
  }

  function setTimelineZoom(next) {
    const input = $(state.root, "[data-ve-zoom]");
    if (!input) return;
    input.value = String(Math.max(Number(input.min), Math.min(Number(input.max), Number(next))));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    markSaving();
  }

  function captureVideoFrame() {
    const video = $(state.root, "[data-ve-video]");
    if (!video?.videoWidth) return videoAction("monitor-settings");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `hh-frame-${Date.now()}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }, "image/png");
  }

  function markSaving() {
    const node = $(state.root, "[data-ew-autosave]");
    if (!node) return;
    node.innerHTML = `${icon("loader-circle")} Đang lưu...`;
    node.classList.add("is-saving");
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => {
      videoAction("save");
      node.innerHTML = `${icon("cloud-check")} Đã lưu cục bộ`;
      node.classList.remove("is-saving");
      ensureIcons();
    }, 650);
    ensureIcons();
  }

  function handleWorkflowClick(event, name) {
    const control = event.target.closest("[data-ew-action]");
    if (!control) return false;
    const action = control.dataset.ewAction;
    closeContext();

    if (name === PHOTO) {
      const map = {
        "photo-select-all": "editor-select-all", "photo-deselect": "editor-deselect", "photo-selection-layer": "editor-selection-layer", "photo-crop-selection": "editor-crop-selection",
        "photo-new-layer": "editor-add-raster", "photo-duplicate": "editor-duplicate", "photo-merge": "editor-merge-down", "photo-delete": "editor-delete", "photo-layer-up": "editor-layer-up",
        "photo-layer-down": "editor-layer-down", "photo-fit": "editor-fit", "photo-zoom-100": "editor-zoom-100", "photo-grid": "editor-toggle-grid", "photo-paste": "editor-paste", "photo-export": "editor-export-dialog"
      };
      if (action === "photo-zoom-in" || action === "photo-zoom-out") {
        const current = Number($(state.root, "[data-adv-editor-zoom]")?.value || .75);
        setPhotoZoom(current + (action === "photo-zoom-in" ? .1 : -.1));
      } else if (action === "photo-guides") {
        const guides = $(state.root, "[data-ew-photo-guides]");
        guides.hidden = !guides.hidden;
        control.classList.toggle("is-active", !guides.hidden);
      } else if (map[action]) advancedAction(map[action]);
      updatePhotoZoom();
      return true;
    }

    if (name === VIDEO) {
      const map = {
        "video-split": "split", "video-duplicate": "duplicate", "video-delete": "delete", "video-ripple-delete": "ripple-delete", "video-marker": "marker", "video-title": "title",
        "video-sequence-start": "sequence-start", "video-sequence-end": "sequence-end"
      };
      if (action === "video-mark-in") dispatchEditorKey("i");
      else if (action === "video-mark-out") dispatchEditorKey("o");
      else if (action === "video-loop") {
        const video = $(state.root, "[data-ve-video]");
        video.loop = !video.loop;
        control.classList.toggle("is-active", video.loop);
      } else if (action === "video-mute") {
        const video = $(state.root, "[data-ve-video]");
        video.muted = !video.muted;
        control.classList.toggle("is-active", video.muted);
        control.innerHTML = `${icon(video.muted ? "volume-x" : "volume-2")}<span>${video.muted ? "Bật tiếng" : "Tắt tiếng"}</span>`;
        ensureIcons();
      } else if (action === "video-capture") captureVideoFrame();
      else if (action === "video-monitor-fullscreen") {
        const frame = $(state.root, "[data-ve-monitor-frame]");
        if (document.fullscreenElement) document.exitFullscreen(); else frame?.requestFullscreen?.();
      } else if (action === "video-zoom-in" || action === "video-zoom-out") {
        const input = $(state.root, "[data-ve-zoom]");
        setTimelineZoom(Number(input?.value || 18) + (action === "video-zoom-in" ? 5 : -5));
      } else if (action === "video-zoom-fit") setTimelineZoom(12);
      else if (map[action]) videoAction(map[action]);
      markSaving();
      return true;
    }
    return false;
  }

  function handleWorkflowChange(event, name) {
    if (name !== VIDEO) return false;
    if (event.target.matches("[data-ew-video-view]")) {
      const frame = $(state.root, "[data-ve-monitor-frame]");
      frame.dataset.ewView = event.target.value;
      return true;
    }
    if (event.target.matches("[data-ew-video-rate]")) {
      const video = $(state.root, "[data-ve-video]");
      if (video) video.playbackRate = Number(event.target.value);
      return true;
    }
    return false;
  }

  function cleanupOwn() {
    clearTimeout(state.saveTimer);
    if (state.root) {
      state.root.removeEventListener("contextmenu", openPhotoContext);
      state.root.removeEventListener("contextmenu", openVideoContext);
      state.root.removeEventListener("pointerdown", closeContext);
      state.root.removeEventListener("input", markSaving);
      state.root.removeEventListener("change", markSaving);
    }
    Object.assign(state, { root: null, tool: "", context: null, saveTimer: 0 });
  }

  addEventListener("keydown", (event) => {
    if (!state.root?.isConnected || event.key !== "Escape") return;
    closeContext();
  });

  window.HHMediaDesign = {
    supports: (name) => name === PHOTO || name === VIDEO || base.supports(name),
    render(outer, name) {
      cleanupOwn();
      base.render(outer, name);
      if (name === PHOTO) decoratePhoto(outer);
      if (name === VIDEO) decorateVideo(outer);
    },
    cleanup() { cleanupOwn(); base.cleanup?.(); },
    handleClick(event, outer, name) {
      if ((name === PHOTO || name === VIDEO) && handleWorkflowClick(event, name)) return;
      return base.handleClick?.(event, outer, name);
    },
    handleInput(event, outer, name) { return base.handleInput?.(event, outer, name); },
    handleChange(event, outer, name) {
      if ((name === PHOTO || name === VIDEO) && handleWorkflowChange(event, name)) return;
      return base.handleChange?.(event, outer, name);
    }
  };
})();
