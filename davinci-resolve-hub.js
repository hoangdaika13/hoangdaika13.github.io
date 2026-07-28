(() => {
  "use strict";

  const TOOL = "Video Editor";
  const PROJECT_KEY = "hh.video-editor.project.v1";
  const DB_NAME = "hh-video-editor-media";
  const DB_STORE = "assets";
  const VIEW_PAGE = Object.freeze({
    auto: "auto",
    media: "media",
    cut: "cut",
    edit: "edit",
    fusion: "fusion",
    color: "color",
    audio: "audio",
    titles: "edit",
    deliver: "deliver"
  });
  const VIEW_LABEL = Object.freeze({
    auto: "Auto Director",
    media: "Media Pool",
    cut: "Cut",
    edit: "Edit",
    fusion: "Fusion Lite",
    color: "Color",
    audio: "Audio",
    titles: "Titles & Captions",
    deliver: "Deliver"
  });

  let activeRoot = null;
  let editorHost = null;
  let autoHost = null;
  let controller = null;
  let metricsTimer = 0;
  let activeView = "edit";

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const formatBytes = (bytes) => {
    let value = Math.max(0, Number(bytes) || 0);
    for (const unit of ["B", "KB", "MB", "GB"]) {
      if (value < 1024 || unit === "GB") return `${value.toFixed(unit === "B" ? 0 : 1)} ${unit}`;
      value /= 1024;
    }
    return "0 B";
  };
  const capabilities = () => ({
    mediaRecorder: Boolean(window.MediaRecorder && window.HTMLCanvasElement?.prototype?.captureStream),
    webCodecs: Boolean(window.VideoEncoder && window.VideoDecoder),
    webGpu: Boolean(navigator.gpu),
    indexedDb: Boolean(window.indexedDB),
    worker: Boolean(window.Worker),
    online: navigator.onLine
  });
  const capabilityLabel = (available, ready, unavailable) => available ? ready : unavailable;
  const readProject = () => {
    try {
      const value = JSON.parse(localStorage.getItem(PROJECT_KEY) || "null");
      return value && typeof value === "object" ? value : null;
    } catch {
      return null;
    }
  };
  const projectDuration = (project) => Math.max(0, ...(project?.clips || []).map((clip) => {
    const speed = Math.max(.1, Number(clip.speed) || 1);
    return (Number(clip.start) || 0) + Math.max(0, ((Number(clip.out) || 0) - (Number(clip.in) || 0)) / speed);
  }));
  const formatTime = (seconds) => {
    const value = Math.max(0, Math.round(Number(seconds) || 0));
    return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  };
  const readAssets = () => new Promise((resolve) => {
    if (!window.indexedDB) return resolve([]);
    let request;
    try {
      request = indexedDB.open(DB_NAME, 1);
    } catch {
      resolve([]);
      return;
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE, { keyPath: "id" });
    };
    request.onerror = () => resolve([]);
    request.onsuccess = () => {
      const db = request.result;
      let rows = [];
      try {
        const transaction = db.transaction(DB_STORE);
        const getAll = transaction.objectStore(DB_STORE).getAll();
        getAll.onsuccess = () => { rows = getAll.result || []; };
        getAll.onerror = () => { rows = []; };
        transaction.oncomplete = () => { db.close(); resolve(rows); };
        transaction.onerror = () => { db.close(); resolve([]); };
      } catch {
        db.close();
        resolve([]);
      }
    };
  });

  function shellMarkup(view) {
    const caps = capabilities();
    return `
      <section class="dr-web-shell" data-dr-web-view="${escapeHtml(view)}">
        <header class="dr-web-command">
          <div class="dr-web-brand">
            <span class="dr-web-core" aria-hidden="true"><b>H</b><i></i></span>
            <div>
              <small>HH CREATIVE · BROWSER VIDEO ENGINE</small>
              <h2>HH Video Studio</h2>
              <p>Dựng, chỉnh màu, xử lý âm thanh và xuất WebM trực tiếp trên website. Không cần cài ứng dụng desktop.</p>
            </div>
          </div>
          <div class="dr-web-capabilities" aria-label="Khả năng của trình duyệt">
            <span data-state="${caps.indexedDb ? "ready" : "unsupported"}">${capabilityLabel(caps.indexedDb, "IndexedDB · sẵn sàng", "IndexedDB · không hỗ trợ")}</span>
            <span data-state="${caps.mediaRecorder ? "ready" : "unsupported"}">${capabilityLabel(caps.mediaRecorder, "WebM · sẵn sàng", "WebM · không hỗ trợ")}</span>
            <span data-state="${caps.webCodecs ? "ready" : "limited"}">${capabilityLabel(caps.webCodecs, "WebCodecs · sẵn sàng", "WebCodecs · giới hạn")}</span>
            <span data-state="${caps.webGpu ? "ready" : "limited"}">${capabilityLabel(caps.webGpu, "WebGPU · sẵn sàng", "WebGL · dự phòng")}</span>
            <span data-dr-online data-state="${caps.online ? "ready" : "offline"}">${caps.online ? "Online" : "Offline · local-first"}</span>
          </div>
          <div class="dr-web-actions">
            <button type="button" data-dr-forward="new">Dự án mới</button>
            <button type="button" data-dr-forward="import">Nhập media</button>
            <button type="button" data-dr-forward="save">Lưu</button>
            <button type="button" data-dr-forward="version-history">Phiên bản</button>
            <button class="is-primary" type="button" data-dr-forward="render">Xuất video</button>
          </div>
        </header>
        <nav class="dr-web-tabs" aria-label="Không gian dựng phim">
          ${Object.keys(VIEW_PAGE).map((id) => `<button type="button" data-dr-view="${id}" class="${id === view ? "is-active" : ""}"><span>${escapeHtml(VIEW_LABEL[id])}</span><small>${id === "titles" ? "SRT · VTT" : id === "deliver" ? "WebM · Queue" : VIEW_PAGE[id]}</small></button>`).join("")}
        </nav>
        <section class="dr-web-live" aria-label="Trạng thái dự án">
          <div><span>DỰ ÁN</span><strong data-dr-project-name>Chưa có project</strong></div>
          <div><span>MEDIA POOL</span><strong data-dr-asset-count>0 asset</strong></div>
          <div><span>TIMELINE</span><strong data-dr-timeline>0 clip · 00:00</strong></div>
          <div><span>AUTOSAVE</span><strong data-dr-saved>Chưa lưu</strong></div>
          <div><span>SERVER RENDER</span><strong data-state="provider-not-configured">Chưa cấu hình provider</strong></div>
        </section>
        <main class="dr-web-editor-frame">
          <div class="dr-web-loading" data-dr-loading><i></i><strong>Đang khởi tạo video engine…</strong></div>
          <div data-dr-auto-host hidden></div>
          <div data-dr-editor-host></div>
        </main>
        <footer class="dr-web-footer">
          <span data-dr-web-status role="status" aria-live="polite">Sẵn sàng · dữ liệu media nằm trên thiết bị này.</span>
          <span>Xuất máy chủ chỉ hoạt động khi provider được cấu hình thật.</span>
        </footer>
      </section>`;
  }

  function status(message, kind = "info") {
    const node = activeRoot?.querySelector("[data-dr-web-status]");
    if (!node) return;
    node.textContent = message;
    node.dataset.state = kind;
  }

  async function refreshMetrics() {
    if (!activeRoot?.isConnected) return;
    const project = readProject();
    const assets = await readAssets();
    if (!activeRoot?.isConnected) return;
    const name = activeRoot.querySelector("[data-dr-project-name]");
    const count = activeRoot.querySelector("[data-dr-asset-count]");
    const timeline = activeRoot.querySelector("[data-dr-timeline]");
    const saved = activeRoot.querySelector("[data-dr-saved]");
    if (name) name.textContent = project?.name || "Chưa có project";
    if (count) count.textContent = `${assets.length} asset · ${formatBytes(assets.reduce((sum, asset) => sum + (Number(asset.size) || 0), 0))}`;
    if (timeline) timeline.textContent = `${project?.clips?.length || 0} clip · ${formatTime(projectDuration(project))}`;
    if (saved) saved.textContent = project?.savedAt ? new Date(project.savedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Chưa lưu";
  }

  function forward(action) {
    const target = editorHost?.querySelector(`[data-ve-action="${action}"]`);
    if (!target) return status(`Công cụ ${action} chưa sẵn sàng. Hãy thử tải lại workspace.`, "error");
    target.click();
  }

  function activateView(view, announce = true) {
    activeView = VIEW_PAGE[view] ? view : "edit";
    if (!activeRoot) return;
    activeRoot.querySelector("[data-dr-web-view]")?.setAttribute("data-dr-web-view", activeView);
    activeRoot.querySelectorAll("[data-dr-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.drView === activeView));
    const isAuto = activeView === "auto";
    if (autoHost) {
      autoHost.hidden = !isAuto;
      if (isAuto && !autoHost.hasChildNodes()) window.HHVideoAutoTool?.mount?.(autoHost);
    }
    if (editorHost) editorHost.hidden = isAuto;
    if (isAuto) {
      if (announce) status("ÄÃ£ má»Ÿ Auto Video Director. HÃ£y quÃ©t Media Pool Ä‘á»ƒ láº­p káº¿ hoáº¡ch tháº­t.", "success");
      return;
    }
    const page = VIEW_PAGE[activeView];
    const pageButton = editorHost?.querySelector(`[data-vr-page="${page}"]`);
    pageButton?.click();
    if (activeView === "titles") {
      const graphics = editorHost?.querySelector('[data-ve-inspector-tab="graphics"]');
      graphics?.click();
    }
    if (announce) status(`Đã mở ${VIEW_LABEL[activeView]}.`, "success");
  }

  function bind() {
    controller = new AbortController();
    const options = { signal: controller.signal };
    activeRoot.addEventListener("click", (event) => {
      const view = event.target.closest("[data-dr-view]");
      if (view) {
        const next = view.dataset.drView;
        const nextHash = `#/davinci-resolve/${next}`;
        if (location.hash !== nextHash) history.pushState(null, "", nextHash);
        activateView(next);
        return;
      }
      const action = event.target.closest("[data-dr-forward]");
      if (action) {
        forward(action.dataset.drForward);
        return;
      }
      if (editorHost?.contains(event.target)) window.HHMediaDesign?.handleClick?.(event, editorHost, TOOL);
    }, options);
    activeRoot.addEventListener("input", (event) => {
      if (editorHost?.contains(event.target)) window.HHMediaDesign?.handleInput?.(event, editorHost, TOOL);
    }, options);
    activeRoot.addEventListener("change", (event) => {
      if (editorHost?.contains(event.target)) window.HHMediaDesign?.handleChange?.(event, editorHost, TOOL);
    }, options);
    window.addEventListener("hh:video-project-change", refreshMetrics, options);
    window.addEventListener("hh:video-auto-applied", () => {
      refreshEditor();
      refreshMetrics();
      status("Timeline Auto Ä‘Ã£ Ä‘Æ°á»£c ghi vÃ o project. Má»Ÿ Edit Ä‘á»ƒ kiá»ƒm tra hoáº·c xuáº¥t WebM.", "success");
    }, options);
    window.addEventListener("hh:video-export-status", (event) => {
      const detail = event.detail || {};
      const messages = {
        processing: `Đang kết xuất ${Math.round(detail.progress || 0)}%…`,
        completed: `Đã xuất ${detail.name || "video"} · ${formatBytes(detail.size || 0)}.`,
        failed: `Xuất thất bại: ${detail.message || "Không xác định"}.`,
        cancelled: "Đã hủy tác vụ xuất video."
      };
      status(messages[detail.status] || "Trạng thái kết xuất đã thay đổi.", detail.status === "completed" ? "success" : detail.status === "failed" ? "error" : "info");
      refreshMetrics();
    }, options);
    window.addEventListener("online", updateNetwork, options);
    window.addEventListener("offline", updateNetwork, options);
  }

  function updateNetwork() {
    const node = activeRoot?.querySelector("[data-dr-online]");
    if (!node) return;
    node.textContent = navigator.onLine ? "Online" : "Offline · local-first";
    node.dataset.state = navigator.onLine ? "ready" : "offline";
  }

  function mount(host, options = {}) {
    if (!host) return;
    unmount();
    activeRoot = host;
    activeView = VIEW_PAGE[options.view] ? options.view : "edit";
    activeRoot.innerHTML = shellMarkup(activeView);
    autoHost = activeRoot.querySelector("[data-dr-auto-host]");
    editorHost = activeRoot.querySelector("[data-dr-editor-host]");
    bind();
    if (!window.HHMediaDesign?.supports?.(TOOL)) {
      activeRoot.querySelector("[data-dr-loading]").innerHTML = "<strong>Không thể tải video engine.</strong><span>Hãy làm mới trang để thử lại.</span>";
      status("Video engine chưa được tải.", "error");
      return;
    }
    try {
      window.HHMediaDesign.render(editorHost, TOOL);
      activeRoot.querySelector("[data-dr-loading]")?.remove();
      requestAnimationFrame(() => activateView(activeView, false));
      refreshMetrics();
      metricsTimer = window.setInterval(refreshMetrics, 5000);
      status("Video engine đã sẵn sàng · project tự lưu trên thiết bị.", "success");
    } catch (error) {
      activeRoot.querySelector("[data-dr-loading]").innerHTML = `<strong>Không thể khởi tạo video engine.</strong><span>${escapeHtml(error?.message || error)}</span>`;
      status("Khởi tạo thất bại. Dữ liệu project cũ vẫn được giữ nguyên.", "error");
    }
  }

  function unmount() {
    window.clearInterval(metricsTimer);
    metricsTimer = 0;
    controller?.abort();
    controller = null;
    window.HHVideoAutoTool?.unmount?.();
    if (editorHost) window.HHMediaDesign?.cleanup?.();
    if (activeRoot) activeRoot.innerHTML = "";
    activeRoot = null;
    editorHost = null;
    autoHost = null;
  }

  function refreshEditor() {
    if (!editorHost || !window.HHMediaDesign?.supports?.(TOOL)) return;
    window.HHMediaDesign?.cleanup?.();
    editorHost.innerHTML = "";
    try {
      window.HHMediaDesign.render(editorHost, TOOL);
      if (activeView !== "auto") requestAnimationFrame(() => activateView(activeView, false));
    } catch (error) {
      status(`KhÃ´ng thá»ƒ lÃ m má»›i Video Studio: ${error?.message || error}`, "error");
    }
  }

  window.HHDavinciResolveHub = { mount, unmount, activateView, capabilities };
  const pending = document.querySelector("[data-davinci-resolve-host]");
  if (pending) mount(pending, { view: pending.dataset.davinciResolveView || "edit" });
})();
