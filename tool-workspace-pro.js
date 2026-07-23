(() => {
  "use strict";

  const DB_NAME = "hh-tool-workspace";
  const DB_VERSION = 1;
  const AI_ENDPOINTS = ["/api/ai", "/api/tools/run"];
  const TOOL_MANIFESTS = [
    { id: "voice-search", name: "Voice Search", runtime: "browser", permissions: ["microphone"], actions: ["start", "stop", "confirm", "clear"], history: true, offline: false },
    { id: "speech-to-text", name: "Speech To Text", runtime: "hybrid", permissions: ["microphone", "selected-audio"], actions: ["start", "stop", "record", "transcribe-file", "export-srt", "export-vtt"], history: true, offline: false },
    { id: "text-to-speech", name: "Text To Speech", runtime: "hybrid", permissions: [], actions: ["speak", "pause", "resume", "stop", "export-audio"], history: true, offline: true },
    { id: "ai-chat-assistant", name: "AI Chat Assistant", runtime: "ai", permissions: [], actions: ["send", "cancel", "new-chat", "export"], history: true, offline: false },
    { id: "ai-prompt-library", name: "AI Prompt Library", runtime: "browser", permissions: [], actions: ["save-prompt", "use-prompt", "delete-prompt", "export"], history: true, offline: true },
    { id: "ai-prompt-optimizer", name: "AI Prompt Optimizer", runtime: "hybrid", permissions: [], actions: ["optimize", "copy", "save-version"], history: true, offline: true },
    { id: "ai-image-prompt-generator", name: "AI Image Prompt Generator", runtime: "browser", permissions: [], actions: ["generate-image-prompt", "copy", "save-version"], history: true, offline: true },
    { id: "workspace-tabs", name: "Workspace Tabs", runtime: "browser", permissions: [], actions: ["new-tab", "save-document", "close-tab", "pin-tab"], history: true, offline: true },
    { id: "drag-drop-dashboard", name: "Drag Drop Dashboard", runtime: "browser", permissions: [], actions: ["add-widget", "move-widget", "remove-widget", "reset-dashboard"], history: true, offline: true },
    { id: "widget-marketplace", name: "Widget Marketplace", runtime: "browser", permissions: [], actions: ["install-widget", "toggle-widget", "remove-widget"], history: true, offline: true },
    { id: "plugin-system", name: "Plugin System", runtime: "browser", permissions: ["explicit-plugin-permissions"], actions: ["import-plugin", "toggle-plugin", "remove-plugin"], history: true, offline: true },
    { id: "auto-save", name: "Auto Save", runtime: "browser", permissions: [], actions: ["save-document", "restore-document", "clear-document"], history: true, offline: true },
    { id: "version-history", name: "Version History", runtime: "browser", permissions: [], actions: ["create-version", "restore-version", "delete-version", "export"], history: true, offline: true },
    { id: "file-explorer", name: "File Explorer", runtime: "browser", permissions: ["selected-files"], actions: ["upload-file", "preview-file", "rename-file", "delete-file", "export-file"], history: true, offline: true },
    { id: "monaco-code-editor", name: "Monaco Code Editor", runtime: "hybrid", permissions: [], actions: ["format-code", "save-document", "create-version", "export"], history: true, offline: true },
    { id: "ocr", name: "OCR", runtime: "hybrid", permissions: ["selected-image"], actions: ["select-image", "crop-image", "recognize", "copy", "export"], history: true, offline: false }
  ].map(item => Object.freeze({ inputs: [], ...item }));

  const byName = new Map(TOOL_MANIFESTS.map(item => [item.name, item]));
  const byId = new Map(TOOL_MANIFESTS.map(item => [item.id, item]));
  const aliases = new Map([
    ["ai-chat", "ai-chat-assistant"],
    ["prompt-library", "ai-prompt-library"],
    ["prompt-optimizer", "ai-prompt-optimizer"],
    ["image-prompt-generator", "ai-image-prompt-generator"],
    ["monaco-editor", "monaco-code-editor"]
  ]);
  const resolveManifest = value => byName.get(value) || byId.get(value) || byId.get(aliases.get(value)) || null;
  const memory = { records: new Map(), history: new Map(), files: new Map() };
  const active = { recognition: null, utterance: null, request: null, timers: new Set(), host: null, manifest: null, ocrImage: null, ocrFile: null, mediaFile: null, mediaRecorder: null, mediaStream: null, mediaChunks: [], transcriptSegments: [], aiAttachment: null, dashboardUndo: [] };

  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const uid = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  const slug = value => String(value || "tool").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
  const nowLabel = value => new Date(value || Date.now()).toLocaleString("vi-VN");
  const statusLabel = runtime => ({ browser: "Trình duyệt", ai: "AI · cần backend", hybrid: "Trình duyệt + fallback server" })[runtime] || runtime;
  const download = (name, content, type = "text/plain;charset=utf-8") => {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 1200);
  };

  function openDb() {
    if (!globalThis.indexedDB) return Promise.resolve(null);
    return new Promise(resolve => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("records")) db.createObjectStore("records", { keyPath: "id" });
        if (!db.objectStoreNames.contains("history")) {
          const store = db.createObjectStore("history", { keyPath: "id" });
          store.createIndex("tool", "tool", { unique: false });
        }
        if (!db.objectStoreNames.contains("files")) db.createObjectStore("files", { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
  }

  const storage = {
    async put(storeName, value) {
      const db = await openDb();
      if (!db) { memory[storeName].set(value.id, structuredCloneSafe(value)); return value; }
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(value);
        tx.oncomplete = () => { db.close(); resolve(value); };
        tx.onerror = () => { db.close(); reject(tx.error || new Error("Không thể lưu dữ liệu ngoại tuyến.")); };
      });
    },
    async get(storeName, id) {
      const db = await openDb();
      if (!db) return memory[storeName].get(id) || null;
      return new Promise(resolve => {
        const tx = db.transaction(storeName, "readonly");
        const request = tx.objectStore(storeName).get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
        tx.oncomplete = () => db.close();
      });
    },
    async list(storeName, predicate = () => true) {
      const db = await openDb();
      if (!db) return [...memory[storeName].values()].filter(predicate);
      return new Promise(resolve => {
        const tx = db.transaction(storeName, "readonly");
        const request = tx.objectStore(storeName).getAll();
        request.onsuccess = () => resolve((request.result || []).filter(predicate));
        request.onerror = () => resolve([]);
        tx.oncomplete = () => db.close();
      });
    },
    async delete(storeName, id) {
      const db = await openDb();
      if (!db) return memory[storeName].delete(id);
      return new Promise(resolve => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).delete(id);
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onerror = () => { db.close(); resolve(false); };
      });
    }
  };

  function structuredCloneSafe(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return value instanceof Blob ? value : JSON.parse(JSON.stringify(value));
  }

  async function record(tool, action, summary, detail = {}) {
    return storage.put("history", { id: uid("event"), tool, action, summary, detail, createdAt: new Date().toISOString() });
  }

  function getRecognition() { return globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition || null; }
  function featureSupport(manifest) {
    if (!manifest) return { ok: false, reason: "Tool không tồn tại." };
    if (["voice-search", "speech-to-text"].includes(manifest.id) && !getRecognition()) return { ok: false, reason: "Trình duyệt chưa hỗ trợ SpeechRecognition. Có thể dùng Chrome/Edge hoặc backend Speech-to-Text." };
    if (manifest.id === "text-to-speech" && !("speechSynthesis" in globalThis)) return { ok: false, reason: "Trình duyệt chưa hỗ trợ Speech Synthesis." };
    if (manifest.id === "ocr" && !("TextDetector" in globalThis)) return { ok: true, degraded: true, reason: "OCR cục bộ chưa được hỗ trợ; hệ thống sẽ dùng /api/tools/run khi bạn cho phép." };
    if (!globalThis.indexedDB && manifest.offline) return { ok: true, degraded: true, reason: "IndexedDB không khả dụng; dữ liệu chỉ được giữ trong phiên này." };
    return { ok: true, degraded: false, reason: "Sẵn sàng." };
  }

  function shell(manifest, body) {
    const support = featureSupport(manifest);
    return `<section class="hh-tool" data-hh-tool="${manifest.id}">
      <header class="hh-tool__header"><div><small>HH TOOL WORKSPACE</small><h3>${esc(manifest.name)}</h3><p>${esc(statusLabel(manifest.runtime))} · ${manifest.offline ? "Có thể dùng offline" : "Cần kết nối khi xử lý"}</p></div><div class="hh-tool__badges"><span data-runtime="${manifest.runtime}">${esc(statusLabel(manifest.runtime))}</span><span class="${support.ok ? support.degraded ? "is-warning" : "is-ready" : "is-error"}">${support.ok ? support.degraded ? "Fallback" : "Sẵn sàng" : "Không hỗ trợ"}</span></div></header>
      <div class="hh-tool__notice ${support.ok ? support.degraded ? "is-warning" : "" : "is-error"}" data-tool-notice role="status" aria-live="polite">${esc(support.reason)}</div>
      <div class="hh-tool__body">${body}</div>
      <footer class="hh-tool__footer"><span data-tool-state="idle"><i></i> Đang chờ</span><span>Lưu trữ: ${globalThis.indexedDB ? "IndexedDB" : "bộ nhớ phiên"}</span><span>Không lưu API key trong trình duyệt</span></footer>
    </section>`;
  }

  const field = (label, control, hint = "") => `<label class="hh-tool__field"><span>${esc(label)}</span>${control}${hint ? `<small>${esc(hint)}</small>` : ""}</label>`;
  const button = (action, label, kind = "") => `<button type="button" data-tool-action="${action}" class="${kind}">${esc(label)}</button>`;
  const textArea = (name, placeholder, value = "") => `<textarea data-tool-input="${name}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`;
  const output = (label = "Kết quả") => `<section class="hh-tool__output"><header><strong>${esc(label)}</strong><button type="button" data-tool-action="copy-output">Sao chép</button></header><pre data-tool-output>Chưa có kết quả.</pre></section>`;

  function voiceMarkup(manifest) {
    if (manifest.id === "text-to-speech") return shell(manifest, `<div class="hh-tool__grid"><section class="hh-tool__panel"><div class="hh-tool__form">${field("Văn bản", textArea("text", "Nhập nội dung cần đọc..."))}<div class="hh-tool__row">${field("Giọng", '<select data-tool-input="voice"><option value="">Đang tải giọng...</option></select>')}${field("Ngôn ngữ", '<select data-tool-input="language"><option value="vi-VN">Tiếng Việt</option><option value="en-US">English (US)</option><option value="en-GB">English (UK)</option><option value="en-AU">English (Australia)</option></select>')}</div><div class="hh-tool__row">${field("Tốc độ", '<input data-tool-input="rate" type="range" min="0.5" max="2" step="0.1" value="1"><output data-tool-range-output="rate">1.0×</output>')}${field("Cao độ", '<input data-tool-input="pitch" type="range" min="0.5" max="2" step="0.1" value="1"><output data-tool-range-output="pitch">1.0</output>')}</div><div class="hh-tool__actions">${button("speak", "Nghe thử", "is-primary")}${button("pause", "Tạm dừng")}${button("resume", "Tiếp tục")}${button("stop", "Dừng")}${button("export-tts", "Tạo file audio")}</div></div></section>${output("Trạng thái giọng đọc")}</div>`);
    const search = manifest.id === "voice-search";
    return shell(manifest, `<div class="hh-tool__grid"><section class="hh-tool__panel"><div class="hh-tool__form"><div class="hh-tool__row">${field("Ngôn ngữ", '<select data-tool-input="language"><option value="vi-VN">Tiếng Việt</option><option value="en-US">English (US)</option><option value="en-GB">English (UK)</option><option value="en-AU">English (Australia)</option></select>')}${field("Chế độ", `<select data-tool-input="continuous"><option value="false">Một câu</option><option value="true">Liên tục</option></select>`)}</div>${search ? "" : '<label class="hh-tool__file-button">Chọn audio/video<input type="file" accept="audio/*,video/*" data-tool-media-file></label>'}<div class="hh-tool__wave" data-tool-wave aria-label="Trạng thái micro">${Array(18).fill("<i></i>").join("")}</div>${textArea("transcript", search ? "Kết quả giọng nói để xác nhận tìm kiếm..." : "Bản chép lời và nhãn người nói sẽ xuất hiện ở đây...")}<div class="hh-tool__actions">${button("start-recognition", "Nhận dạng trực tiếp", "is-primary")}${button("stop-recognition", "Dừng trực tiếp")}${search ? button("confirm-search", "Xác nhận tìm") : `${button("start-media-record", "Ghi âm")}${button("stop-media-record", "Dừng ghi")}${button("transcribe-media", "Chép file", "is-primary")}${button("export-srt", "Xuất SRT")}${button("export-vtt", "Xuất VTT")}`}${button("clear-transcript", "Xóa")}</div></div></section>${output(search ? "Kết quả tìm kiếm" : "Thông tin file/phiên ghi")}</div>`);
  }

  function aiMarkup(manifest) {
    if (manifest.id === "ai-chat-assistant") return shell(manifest, `<section class="hh-tool__chat"><header><select data-tool-input="model"><option value="auto">Tự động chọn model</option><option value="fast">Nhanh</option><option value="reasoning">Lập luận</option></select><label class="hh-tool__file-button">Đính kèm văn bản<input type="file" accept="text/*,application/json,.md,.csv" data-tool-ai-file></label>${button("new-chat", "Cuộc trò chuyện mới")}${button("export-chat", "Xuất cuộc trò chuyện")}</header><div class="hh-tool__messages" data-tool-messages><div class="is-system">AI chỉ hoạt động khi backend đã được cấu hình. Không nhập API key vào đây.</div></div><div class="hh-tool__composer">${textArea("message", "Nhập yêu cầu; có thể đính kèm nội dung văn bản...")}<div>${button("cancel-ai", "Hủy")}${button("send-ai", "Gửi", "is-primary")}</div></div></section>`);
    if (manifest.id === "ai-prompt-library") return shell(manifest, `<div class="hh-tool__split"><section class="hh-tool__panel"><div class="hh-tool__form">${field("Tên prompt", '<input data-tool-input="title" placeholder="Ví dụ: Kịch bản video relax">')}${field("Tags", '<input data-tool-input="tags" placeholder="youtube, relax, image">')}${field("Prompt", textArea("content", "Viết prompt có thể tái sử dụng; dùng {{variable}} cho biến..."))}<div class="hh-tool__actions">${button("save-prompt", "Lưu prompt", "is-primary")}${button("export-prompts", "Xuất thư viện")}</div></div></section><section class="hh-tool__collection" data-tool-list><div class="hh-tool__empty">Đang tải thư viện…</div></section></div>`);
    const image = manifest.id === "ai-image-prompt-generator";
    return shell(manifest, `<div class="hh-tool__grid"><section class="hh-tool__panel"><div class="hh-tool__form">${field(image ? "Ý tưởng hình ảnh" : "Prompt gốc", textArea("source", image ? "Ví dụ: phòng jazz đêm mưa, cửa sổ lớn..." : "Mô tả nhiệm vụ cần tối ưu..."))}<div class="hh-tool__row">${field(image ? "Phong cách" : "Mục tiêu", `<select data-tool-input="goal">${image ? '<option value="cinematic">Cinematic</option><option value="illustration">Illustration</option><option value="photorealistic">Photorealistic</option><option value="anime">Anime</option>' : '<option value="accuracy">Chính xác</option><option value="creative">Sáng tạo</option><option value="concise">Ngắn gọn</option><option value="analysis">Phân tích sâu</option>'}</select>`)}${field(image ? "Tỉ lệ" : "Model đích", `<select data-tool-input="target"><option value="auto">Tự động</option>${image ? '<option value="16:9">16:9 YouTube</option><option value="9:16">9:16 Shorts</option><option value="1:1">1:1</option>' : '<option value="chat">Chat model</option><option value="reasoning">Reasoning model</option><option value="image">Image model</option>'}</select>`)}</div><div class="hh-tool__actions">${button(image ? "generate-image-prompt" : "optimize-prompt", image ? "Tạo prompt ảnh" : "Tối ưu prompt", "is-primary")}${button("save-output-version", "Lưu phiên bản")}</div></div></section>${output(image ? "Prompt hoàn chỉnh + Negative Prompt" : "Prompt đã tối ưu")}</div>`);
  }

  function workspaceMarkup(manifest) {
    if (manifest.id === "workspace-tabs") return shell(manifest, `<section class="hh-tool__workspace"><header class="hh-tool__tabbar" data-tool-tabs></header><div class="hh-tool__form">${field("Tên tài liệu", '<input data-tool-input="title" value="Tài liệu mới">')}${textArea("document", "Soạn nội dung; dữ liệu tự lưu trong IndexedDB...")}<div class="hh-tool__actions">${button("new-tab", "Tab mới", "is-primary")}${button("save-tab", "Lưu")}${button("pin-tab", "Ghim/Bỏ ghim")}${button("close-tab", "Đóng tab")}</div></div></section>`);
    if (manifest.id === "drag-drop-dashboard") return shell(manifest, `<div class="hh-tool__toolbar">${button("add-widget", "Thêm widget", "is-primary")}${button("undo-dashboard", "Hoàn tác")}${button("reset-dashboard", "Đặt lại")}</div><section class="hh-tool__dashboard" data-tool-dashboard aria-label="Dashboard kéo thả"></section>`);
    if (manifest.id === "widget-marketplace") return shell(manifest, `<header class="hh-tool__toolbar"><input data-tool-input="filter" placeholder="Tìm widget…"><select data-tool-input="category"><option value="all">Tất cả</option><option value="productivity">Công việc</option><option value="analytics">Phân tích</option><option value="media">Media</option></select></header><section class="hh-tool__market" data-tool-list></section>`);
    if (manifest.id === "plugin-system") return shell(manifest, `<div class="hh-tool__split"><section class="hh-tool__panel"><div class="hh-tool__form"><p class="hh-tool__help">Plugin chỉ được lưu như manifest dữ liệu và không được chạy mã tùy ý. Mỗi quyền phải được người dùng bật rõ ràng.</p>${field("Plugin manifest", textArea("manifest", '{\n  "id": "my-plugin",\n  "name": "My Plugin",\n  "version": "1.0.0",\n  "permissions": []\n}'))}<div class="hh-tool__actions">${button("import-plugin", "Kiểm tra & cài manifest", "is-primary")}</div></div></section><section class="hh-tool__collection" data-tool-list></section></div>`);
    if (manifest.id === "auto-save") return shell(manifest, `<div class="hh-tool__grid"><section class="hh-tool__panel"><div class="hh-tool__form">${field("Tài liệu", '<input data-tool-input="title" value="Bản nháp Auto Save">')}${field("Nội dung", textArea("document", "Mọi thay đổi được lưu sau 600 ms..."), "Không cần nhấn Lưu; có retry khi IndexedDB bận.")}<div class="hh-tool__actions">${button("save-document", "Lưu ngay", "is-primary")}${button("restore-document", "Khôi phục")}${button("clear-document", "Xóa bản nháp")}</div><div class="hh-tool__save-state" data-tool-save-state>Chưa có thay đổi.</div></div></section>${output("Nhật ký lưu")}</div>`);
    if (manifest.id === "version-history") return shell(manifest, `<div class="hh-tool__split"><section class="hh-tool__panel"><div class="hh-tool__form">${field("Nhãn phiên bản", '<input data-tool-input="label" placeholder="Ví dụ: Trước khi chỉnh sửa">')}${field("Nội dung", textArea("document", "Nội dung cần lưu phiên bản..."))}<div class="hh-tool__actions">${button("create-version", "Tạo phiên bản", "is-primary")}${button("export-versions", "Xuất lịch sử")}</div></div></section><section class="hh-tool__collection" data-tool-list></section></div>`);
    if (manifest.id === "file-explorer") return shell(manifest, `<section class="hh-tool__files"><header><label class="hh-tool__file-button">Chọn tệp<input type="file" data-tool-file multiple></label><input data-tool-input="file-filter" placeholder="Tìm theo tên hoặc loại tệp…"></header><div class="hh-tool__file-layout"><div data-tool-list class="hh-tool__file-list"></div><section class="hh-tool__preview" data-tool-preview><div class="hh-tool__empty">Chọn một tệp để xem trước.</div></section></div></section>`);
    if (manifest.id === "monaco-code-editor") return shell(manifest, `<section class="hh-tool__code"><header><select data-tool-input="language"><option value="javascript">JavaScript</option><option value="json">JSON</option><option value="html">HTML</option><option value="css">CSS</option><option value="markdown">Markdown</option></select>${button("format-code", "Format")}${button("save-code", "Lưu")}${button("version-code", "Tạo phiên bản")}${button("export-code", "Xuất file")}</header><div data-tool-editor class="hh-tool__editor"><textarea data-tool-input="code" spellcheck="false">function hello(name) {\n  return &quot;Xin chào &quot; + name;\n}</textarea></div><footer data-tool-editor-status>Fallback editor đang hoạt động; Monaco sẽ tự dùng khi thư viện đã được tải.</footer></section>`);
    return shell(manifest, `<div class="hh-tool__grid"><section class="hh-tool__panel"><div class="hh-tool__form"><label class="hh-tool__file-button">Chọn ảnh<input type="file" accept="image/*" data-tool-ocr-file></label><div class="hh-tool__ocr-stage"><canvas data-tool-ocr-canvas width="960" height="540"></canvas><div class="hh-tool__empty" data-tool-ocr-empty>Chọn ảnh để crop và nhận dạng.</div></div><div class="hh-tool__row">${field("Ngôn ngữ", '<select data-tool-input="ocr-language"><option value="vi">Tiếng Việt</option><option value="en">English</option><option value="vi+en">Việt + Anh</option></select>')}${field("Crop X / Y / W / H", '<div class="hh-tool__crop"><input type="number" data-tool-input="crop-x" value="0" min="0"><input type="number" data-tool-input="crop-y" value="0" min="0"><input type="number" data-tool-input="crop-w" value="0" min="0"><input type="number" data-tool-input="crop-h" value="0" min="0"></div>')}</div><div class="hh-tool__actions">${button("apply-crop", "Áp dụng crop")}${button("recognize-ocr", "Nhận dạng", "is-primary")}${button("export-ocr", "Xuất TXT")}</div></div></section><section class="hh-tool__output"><header><strong>Kết quả OCR</strong><span data-tool-confidence>Confidence: —</span></header><textarea data-tool-input="ocr-result" placeholder="Văn bản nhận dạng sẽ xuất hiện ở đây..."></textarea></section></div>`);
  }

  function markup(manifest) {
    if (["voice-search", "speech-to-text", "text-to-speech"].includes(manifest.id)) return voiceMarkup(manifest);
    if (manifest.id.startsWith("ai-")) return aiMarkup(manifest);
    return workspaceMarkup(manifest);
  }

  function setState(host, status, message) {
    const node = host?.querySelector("[data-tool-state]");
    if (node) { node.dataset.toolState = status; node.innerHTML = `<i></i> ${esc(message || ({ idle: "Đang chờ", running: "Đang chạy", done: "Hoàn thành", error: "Có lỗi" })[status])}`; }
  }
  function notice(host, message, kind = "") {
    const node = host?.querySelector("[data-tool-notice]");
    if (node) { node.textContent = message; node.className = `hh-tool__notice ${kind ? `is-${kind}` : ""}`; }
  }
  function getInput(host, name) { return host?.querySelector(`[data-tool-input="${name}"]`); }
  function getValue(host, name) { return getInput(host, name)?.value || ""; }
  function setOutput(host, value) { const node = host?.querySelector("[data-tool-output]"); if (node) node.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2); }

  async function requestAi(payload, signal) {
    let lastError = new Error("AI backend chưa được cấu hình.");
    for (const endpoint of AI_ENDPOINTS) {
      try {
        const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", signal, body: JSON.stringify(payload) });
        if (response.status === 404) continue;
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || data.message || `HTTP ${response.status}`);
        return data;
      } catch (error) { if (error.name === "AbortError") throw error; lastError = error; }
    }
    throw lastError;
  }

  function optimizePrompt(source, goal, target) {
    const text = source.trim();
    if (text.length < 8) throw new Error("Prompt cần ít nhất 8 ký tự để tối ưu.");
    const goalMap = { accuracy: "ưu tiên tính chính xác, nêu nguồn và đánh dấu điều chưa chắc chắn", creative: "đề xuất nhiều hướng sáng tạo nhưng giữ đúng mục tiêu", concise: "trả lời súc tích, bỏ phần lặp", analysis: "phân tích sâu, so sánh lựa chọn và chỉ ra rủi ro" };
    return `VAI TRÒ\nBạn là chuyên gia phù hợp nhất với nhiệm vụ dưới đây.\n\nMỤC TIÊU\n${text}\n\nƯU TIÊN\n${goalMap[goal] || goalMap.accuracy}.\n\nBỐI CẢNH & ĐẦU VÀO\n- Hỏi lại nếu thiếu dữ liệu quyết định.\n- Không tự tạo sự kiện, số liệu hoặc nguồn.\n\nQUY TRÌNH\n1. Tóm tắt cách hiểu yêu cầu.\n2. Lập kế hoạch ngắn trước khi thực hiện.\n3. Tạo kết quả dùng được ngay.\n4. Tự kiểm tra lỗi và giới hạn.\n\nĐỊNH DẠNG ĐẦU RA\nDành cho ${target || "auto"}; trình bày rõ ràng, có ví dụ và checklist hành động.`;
  }

  function imagePrompt(source, style, ratio) {
    const text = source.trim();
    if (text.length < 5) throw new Error("Hãy mô tả chủ thể hình ảnh rõ hơn.");
    const styles = { cinematic: "cinematic lighting, volumetric atmosphere, natural color separation", illustration: "editorial illustration, clean shapes, controlled texture", photorealistic: "photorealistic, physically plausible light, authentic materials", anime: "premium anime key visual, expressive lighting, consistent anatomy" };
    return `PROMPT\n${text}, ${styles[style] || styles.cinematic}, strong focal hierarchy, coherent environment, layered foreground and background, intentional color palette, fine detail, ${ratio === "auto" ? "balanced composition" : `composition optimized for ${ratio}`}, no embedded text.\n\nCAMERA & LIGHT\nEye-level composition, subject-safe framing, soft key light, subtle rim light, realistic depth and controlled highlights.\n\nNEGATIVE PROMPT\nlow resolution, blurry, over-sharpened, malformed anatomy, extra fingers, duplicate subject, inconsistent perspective, watermark, logo, random letters, UI elements, clipped subject.`;
  }

  function formatTranscript(text, kind) {
    const sentences = String(text).split(/(?<=[.!?])\s+|\n+/).map(item => item.trim()).filter(Boolean);
    const stamp = seconds => `${kind === "vtt" ? "" : "00:"}${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}${kind === "vtt" ? ".000" : ",000"}`;
    const rows = sentences.map((sentence, index) => `${kind === "srt" ? `${index + 1}\n` : ""}${stamp(index * 4)} --> ${stamp(index * 4 + 4)}\n${sentence}`).join("\n\n");
    return kind === "vtt" ? `WEBVTT\n\n${rows}` : rows;
  }

  function formatSegments(segments, kind) {
    if (!Array.isArray(segments) || !segments.length) return "";
    const stamp = seconds => {
      const total = Math.max(0, Number(seconds) || 0), hours = Math.floor(total / 3600), minutes = Math.floor(total % 3600 / 60), secs = Math.floor(total % 60), millis = Math.floor((total % 1) * 1000);
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}${kind === "vtt" ? "." : ","}${String(millis).padStart(3, "0")}`;
    };
    const rows = segments.map((segment, index) => `${kind === "srt" ? `${index + 1}\n` : ""}${stamp(segment.start)} --> ${stamp(segment.end)}\n${segment.speaker ? `[${segment.speaker}] ` : ""}${segment.text || ""}`).join("\n\n");
    return kind === "vtt" ? `WEBVTT\n\n${rows}` : rows;
  }

  async function renderCollection(host, type) {
    const list = host.querySelector("[data-tool-list]");
    if (!list) return;
    if (type === "prompts") {
      const rows = (await storage.list("records", row => row.type === "prompt")).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      list.innerHTML = rows.length ? rows.map(row => `<article data-record-id="${esc(row.id)}"><header><strong>${esc(row.title)}</strong><span>${esc((row.tags || []).join(" · "))}</span></header><p>${esc(row.content)}</p><footer>${button("use-prompt", "Dùng")}${button("delete-record", "Xóa")}</footer></article>`).join("") : '<div class="hh-tool__empty">Chưa có prompt. Tạo prompt đầu tiên ở bên trái.</div>';
    }
    if (type === "versions") {
      const rows = (await storage.list("records", row => row.type === "version")).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      list.innerHTML = rows.length ? rows.map(row => `<article data-record-id="${esc(row.id)}"><header><strong>${esc(row.label)}</strong><span>${esc(nowLabel(row.createdAt))}</span></header><p>${esc(row.content.slice(0, 180))}</p><footer>${button("restore-version", "Khôi phục")}${button("delete-record", "Xóa")}</footer></article>`).join("") : '<div class="hh-tool__empty">Chưa có phiên bản.</div>';
    }
    if (type === "plugins") {
      const rows = await storage.list("records", row => row.type === "plugin");
      list.innerHTML = rows.length ? rows.map(row => `<article data-record-id="${esc(row.id)}"><header><strong>${esc(row.name)}</strong><span>v${esc(row.version)}</span></header><p>Quyền: ${esc((row.permissions || []).join(", ") || "Không có")}</p><footer>${button("toggle-plugin", row.enabled ? "Tắt" : "Bật")}${button("delete-record", "Gỡ")}</footer></article>`).join("") : '<div class="hh-tool__empty">Chưa cài plugin manifest nào.</div>';
    }
  }

  const MARKET_WIDGETS = [
    { id: "today", name: "Kế hoạch hôm nay", category: "productivity", permissions: [] },
    { id: "focus", name: "Focus Timer", category: "productivity", permissions: ["notifications"] },
    { id: "api-quota", name: "API Quota", category: "analytics", permissions: ["api-status"] },
    { id: "activity", name: "Hoạt động gần đây", category: "analytics", permissions: [] },
    { id: "media-queue", name: "Media Render Queue", category: "media", permissions: ["job-status"] }
  ];

  async function renderMarketplace(host) {
    const list = host.querySelector("[data-tool-list]"); if (!list) return;
    const installed = await storage.list("records", row => row.type === "widget");
    const ids = new Set(installed.map(row => row.widgetId));
    const filter = getValue(host, "filter").toLowerCase(), category = getValue(host, "category") || "all";
    const rows = MARKET_WIDGETS.filter(row => (!filter || row.name.toLowerCase().includes(filter)) && (category === "all" || row.category === category));
    list.innerHTML = rows.map(row => `<article data-widget-id="${row.id}"><span>${esc(row.category)}</span><h4>${esc(row.name)}</h4><p>Quyền: ${esc(row.permissions.join(", ") || "Không có")}</p>${button(ids.has(row.id) ? "remove-widget-market" : "install-widget", ids.has(row.id) ? "Gỡ" : "Cài đặt", ids.has(row.id) ? "" : "is-primary")}</article>`).join("");
  }

  const DEFAULT_DASHBOARD = [
    { id: "plan", title: "Kế hoạch hôm nay", value: "3 việc ưu tiên" },
    { id: "quota", title: "API quota", value: "Chưa kết nối" },
    { id: "jobs", title: "Tác vụ nền", value: "0 đang chạy" }
  ];
  async function renderDashboard(host) {
    const record = await storage.get("records", "dashboard-layout");
    const widgets = record?.widgets?.length ? record.widgets : DEFAULT_DASHBOARD;
    const board = host.querySelector("[data-tool-dashboard]"); if (!board) return;
    board.innerHTML = widgets.map((item, index) => `<article draggable="true" data-dashboard-id="${esc(item.id)}" data-dashboard-index="${index}" class="${item.size === "wide" ? "is-wide" : ""}"><span>Kéo để sắp xếp</span><h4>${esc(item.title)}</h4><strong>${esc(item.value)}</strong><footer>${button("move-widget-left", "←")}${button("move-widget-right", "→")}${button("resize-dashboard-widget", item.size === "wide" ? "Thu nhỏ" : "Mở rộng")}${button("remove-dashboard-widget", "Xóa")}</footer></article>`).join("");
    board.querySelectorAll("[draggable]").forEach(card => {
      card.addEventListener("dragstart", event => event.dataTransfer.setData("text/plain", card.dataset.dashboardIndex));
      card.addEventListener("dragover", event => event.preventDefault());
      card.addEventListener("drop", async event => { event.preventDefault(); const from = Number(event.dataTransfer.getData("text/plain")), to = Number(card.dataset.dashboardIndex); await moveDashboard(host, from, to); });
    });
  }
  async function moveDashboard(host, from, to) {
    const record = await storage.get("records", "dashboard-layout");
    const widgets = structuredCloneSafe(record?.widgets?.length ? record.widgets : DEFAULT_DASHBOARD);
    if (from < 0 || to < 0 || from >= widgets.length || to >= widgets.length || from === to) return;
    active.dashboardUndo.push(structuredCloneSafe(widgets)); active.dashboardUndo = active.dashboardUndo.slice(-20);
    const [item] = widgets.splice(from, 1); widgets.splice(to, 0, item);
    await storage.put("records", { id: "dashboard-layout", type: "dashboard", widgets, updatedAt: new Date().toISOString() });
    await renderDashboard(host);
  }

  async function renderTabs(host, selectedId) {
    let tabs = (await storage.list("records", row => row.type === "workspace-tab")).sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.createdAt.localeCompare(b.createdAt));
    if (!tabs.length) {
      const first = { id: uid("tab"), type: "workspace-tab", title: "Tài liệu mới", content: "", pinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await storage.put("records", first); tabs = [first];
    }
    const selected = tabs.find(row => row.id === selectedId) || tabs[0];
    host.dataset.activeTab = selected.id;
    const tabbar = host.querySelector("[data-tool-tabs]");
    tabbar.innerHTML = tabs.map(row => `<button type="button" data-tool-action="select-tab" data-record-id="${row.id}" class="${row.id === selected.id ? "is-active" : ""}">${row.pinned ? "◆ " : ""}${esc(row.title)}</button>`).join("");
    getInput(host, "title").value = selected.title;
    getInput(host, "document").value = selected.content;
  }

  async function renderFiles(host) {
    const list = host.querySelector("[data-tool-list]"); if (!list) return;
    const query = getValue(host, "file-filter").toLowerCase();
    const files = (await storage.list("files", row => !query || row.name.toLowerCase().includes(query) || row.type.toLowerCase().includes(query))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    list.innerHTML = files.length ? files.map(row => `<button type="button" data-tool-action="preview-file" data-record-id="${row.id}"><strong>${esc(row.name)}</strong><span>${esc(row.type || "unknown")} · ${(row.size / 1024).toFixed(1)} KB</span></button>`).join("") : '<div class="hh-tool__empty">Chưa có tệp trong workspace.</div>';
  }

  function loadVoices(host) {
    if (!("speechSynthesis" in globalThis)) return;
    const select = getInput(host, "voice"); if (!select) return;
    const voices = speechSynthesis.getVoices();
    select.innerHTML = '<option value="">Tự động theo ngôn ngữ</option>' + voices.map((voice, index) => `<option value="${index}">${esc(voice.name)} · ${esc(voice.lang)}${voice.default ? " · mặc định" : ""}</option>`).join("");
    select._voices = voices;
  }

  async function hydrate(host, manifest) {
    if (manifest.id === "text-to-speech") { loadVoices(host); if ("speechSynthesis" in globalThis) speechSynthesis.onvoiceschanged = () => active.host === host && loadVoices(host); }
    if (manifest.id === "ai-prompt-library") await renderCollection(host, "prompts");
    if (manifest.id === "version-history") await renderCollection(host, "versions");
    if (manifest.id === "plugin-system") await renderCollection(host, "plugins");
    if (manifest.id === "widget-marketplace") await renderMarketplace(host);
    if (manifest.id === "drag-drop-dashboard") await renderDashboard(host);
    if (manifest.id === "workspace-tabs") await renderTabs(host);
    if (manifest.id === "file-explorer") await renderFiles(host);
    if (manifest.id === "auto-save") { const draft = await storage.get("records", "autosave-document"); if (draft) { getInput(host, "title").value = draft.title; getInput(host, "document").value = draft.content; host.querySelector("[data-tool-save-state]").textContent = `Khôi phục bản lưu ${nowLabel(draft.updatedAt)}`; } }
    if (manifest.id === "monaco-code-editor" && globalThis.monaco?.editor) {
      const holder = host.querySelector("[data-tool-editor]"); const source = getValue(host, "code"); holder.innerHTML = "";
      holder._editor = monaco.editor.create(holder, { value: source, language: "javascript", theme: "vs-dark", automaticLayout: true, minimap: { enabled: false } });
      host.querySelector("[data-tool-editor-status]").textContent = "Monaco Editor đang hoạt động.";
    }
  }

  function cleanup() {
    active.recognition?.stop?.(); active.recognition = null;
    active.request?.abort?.(); active.request = null;
    if ("speechSynthesis" in globalThis) speechSynthesis.cancel();
    active.mediaRecorder?.state !== "inactive" && active.mediaRecorder?.stop?.();
    active.mediaStream?.getTracks?.().forEach(track => track.stop());
    active.timers.forEach(timer => clearTimeout(timer)); active.timers.clear();
    active.host?.querySelector("[data-tool-editor]")?._editor?.dispose?.();
    active.host = null; active.manifest = null; active.ocrImage = null; active.ocrFile = null; active.mediaFile = null; active.mediaRecorder = null; active.mediaStream = null; active.mediaChunks = []; active.transcriptSegments = []; active.aiAttachment = null; active.dashboardUndo = [];
  }

  function render(host, nameOrId) {
    const manifest = resolveManifest(nameOrId);
    if (!manifest || !host) return false;
    cleanup(); active.host = host; active.manifest = manifest;
    host.innerHTML = markup(manifest);
    hydrate(host, manifest).catch(error => notice(host, error.message, "error"));
    return true;
  }

  async function runAction(action, buttonNode, host, manifest) {
    const outputNode = host.querySelector("[data-tool-output]");
    if (action === "copy-output") { await navigator.clipboard.writeText(outputNode?.textContent || getValue(host, "ocr-result")); return notice(host, "Đã sao chép kết quả."); }
    if (action === "start-recognition") {
      const Recognition = getRecognition(); if (!Recognition) throw new Error(featureSupport(manifest).reason);
      const recognition = new Recognition(); active.recognition = recognition; recognition.lang = getValue(host, "language") || "vi-VN"; recognition.continuous = getValue(host, "continuous") === "true"; recognition.interimResults = true;
      const transcript = getInput(host, "transcript"); let finalText = transcript.value;
      recognition.onstart = () => { host.querySelector("[data-tool-wave]")?.classList.add("is-live"); setState(host, "running", "Đang nghe micro"); };
      recognition.onresult = event => { let interim = ""; for (let i = event.resultIndex; i < event.results.length; i += 1) { const text = event.results[i][0].transcript; if (event.results[i].isFinal) finalText += `${finalText ? " " : ""}${text}`; else interim += text; } transcript.value = `${finalText}${interim ? ` ${interim}` : ""}`; };
      recognition.onerror = event => { host.querySelector("[data-tool-wave]")?.classList.remove("is-live"); setState(host, "error", "Không thể nhận dạng"); notice(host, `Micro/nhận dạng lỗi: ${event.error}. Kiểm tra quyền micro và kết nối.`, "error"); };
      recognition.onend = async () => { host.querySelector("[data-tool-wave]")?.classList.remove("is-live"); active.recognition = null; setState(host, "done", "Đã ghi nhận giọng nói"); await record(manifest.id, "recognize", transcript.value.slice(0, 160)); };
      recognition.start(); return;
    }
    if (action === "stop-recognition") { active.recognition?.stop?.(); return; }
    if (action === "clear-transcript") { getInput(host, "transcript").value = ""; setOutput(host, "Đã xóa bản chép lời."); return; }
    if (action === "start-media-record") {
      if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) throw new Error("Trình duyệt chưa hỗ trợ ghi âm. Hãy chọn một file audio/video thay thế.");
      active.mediaStream?.getTracks?.().forEach(track => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const recorder = new MediaRecorder(stream); active.mediaStream = stream; active.mediaRecorder = recorder; active.mediaChunks = [];
      recorder.ondataavailable = event => { if (event.data?.size) active.mediaChunks.push(event.data); };
      recorder.onstop = () => { const blob = new Blob(active.mediaChunks, { type: recorder.mimeType || "audio/webm" }); active.mediaFile = new File([blob], `recording-${Date.now()}.webm`, { type: blob.type }); stream.getTracks().forEach(track => track.stop()); active.mediaStream = null; setOutput(host, `Đã ghi ${(blob.size / 1024).toFixed(1)} KB. Nhấn “Chép file” để nhận dạng và phân biệt người nói qua backend.`); setState(host, "done", "Đã ghi âm"); };
      recorder.start(500); host.querySelector("[data-tool-wave]")?.classList.add("is-live"); setOutput(host, "Đang ghi âm từ micro…"); return;
    }
    if (action === "stop-media-record") { if (!active.mediaRecorder || active.mediaRecorder.state === "inactive") throw new Error("Chưa có phiên ghi âm đang chạy."); active.mediaRecorder.stop(); host.querySelector("[data-tool-wave]")?.classList.remove("is-live"); return; }
    if (action === "transcribe-media") {
      const file = active.mediaFile; if (!file) throw new Error("Chọn file audio/video hoặc ghi âm trước."); if (file.size > 20 * 1024 * 1024) throw new Error("File vượt quá 20 MB. Hãy nén hoặc chia nhỏ trước khi gửi.");
      active.request?.abort?.(); active.request = new AbortController(); const data = await requestAi({ toolId: "speech-to-text", action: "transcribe", language: getValue(host, "language"), filename: file.name, mimeType: file.type, audio: await blobToBase64(file), diarization: true, timestamps: true }, active.request.signal);
      const segments = Array.isArray(data.segments) ? data.segments.filter(item => item && typeof item.text === "string").map(item => ({ start: Number(item.start) || 0, end: Number(item.end) || Number(item.start) + 4 || 4, speaker: String(item.speaker || ""), text: item.text })) : [];
      active.transcriptSegments = segments; const text = segments.length ? segments.map(item => `${item.speaker ? `[${item.speaker}] ` : ""}${item.text}`).join("\n") : String(data.text || data.output || ""); if (!text.trim()) throw new Error("Backend không trả về bản chép lời."); getInput(host, "transcript").value = text; setOutput(host, `${segments.length} đoạn có timestamp · ${new Set(segments.map(item => item.speaker).filter(Boolean)).size || "chưa có"} người nói · ${file.name}`); active.request = null; await record(manifest.id, "transcribe", file.name, { segments: segments.length }); return;
    }
    if (action === "confirm-search") {
      const query = getValue(host, "transcript").trim(); if (!query) throw new Error("Chưa có nội dung giọng nói để tìm.");
      globalThis.dispatchEvent(new CustomEvent("hh:tool-search", { detail: { query, source: "voice" } }));
      setOutput(host, `Đã gửi truy vấn tìm kiếm: ${query}`); await record(manifest.id, "search", query); return;
    }
    if (["export-srt", "export-vtt"].includes(action)) {
      const kind = action.endsWith("srt") ? "srt" : "vtt", text = getValue(host, "transcript"); if (!text.trim()) throw new Error("Chưa có bản chép lời để xuất.");
      download(`transcript.${kind}`, formatSegments(active.transcriptSegments, kind) || formatTranscript(text, kind), kind === "vtt" ? "text/vtt" : "application/x-subrip"); return;
    }
    if (action === "speak") {
      if (!("speechSynthesis" in globalThis)) throw new Error("Trình duyệt không hỗ trợ Text-to-Speech."); const text = getValue(host, "text").trim(); if (!text) throw new Error("Nhập văn bản cần đọc.");
      speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text), language = getValue(host, "language") || "vi-VN", select = getInput(host, "voice"); utterance.lang = language; utterance.rate = clamp(getValue(host, "rate"), .5, 2); utterance.pitch = clamp(getValue(host, "pitch"), .5, 2); utterance.voice = select?._voices?.[Number(select.value)] || speechSynthesis.getVoices().find(voice => voice.lang === language) || null;
      utterance.onstart = () => { setState(host, "running", "Đang đọc"); setOutput(host, `Giọng: ${utterance.voice?.name || "mặc định"}\nNgôn ngữ: ${utterance.lang}\nTốc độ: ${utterance.rate}×`); };
      utterance.onend = async () => { setState(host, "done", "Đọc hoàn tất"); await record(manifest.id, "speak", text.slice(0, 160), { voice: utterance.voice?.name, language }); };
      utterance.onerror = event => { setState(host, "error", "Không thể đọc"); notice(host, `Lỗi giọng đọc: ${event.error}`, "error"); };
      active.utterance = utterance; speechSynthesis.speak(utterance); return;
    }
    if (action === "pause") { globalThis.speechSynthesis?.pause?.(); return setState(host, "idle", "Đã tạm dừng"); }
    if (action === "resume") { globalThis.speechSynthesis?.resume?.(); return setState(host, "running", "Đang đọc tiếp"); }
    if (action === "stop") { globalThis.speechSynthesis?.cancel?.(); return setState(host, "idle", "Đã dừng"); }
    if (action === "export-tts") {
      const text = getValue(host, "text").trim(); if (!text) throw new Error("Nhập văn bản cần tạo audio."); if (text.length > 10_000) throw new Error("Mỗi lần xuất tối đa 10.000 ký tự.");
      const voiceSelect = getInput(host, "voice"), voice = voiceSelect?._voices?.[Number(voiceSelect.value)];
      const data = await requestAi({ toolId: "text-to-speech", action: "synthesize", text, language: getValue(host, "language"), voice: voice?.name || "auto", rate: Number(getValue(host, "rate")) || 1, pitch: Number(getValue(host, "pitch")) || 1 });
      if (!data.audio) throw new Error("Backend chưa cung cấp dữ liệu audio. Nghe thử trong trình duyệt vẫn dùng được.");
      const mimeType = data.mimeType || "audio/mpeg", extension = mimeType.includes("wav") ? "wav" : mimeType.includes("ogg") ? "ogg" : "mp3";
      download(`hh-speech.${extension}`, base64ToBlob(data.audio, mimeType), mimeType); await record(manifest.id, "export-audio", `${text.length} ký tự`, { language: getValue(host, "language"), voice: voice?.name || "auto" }); return;
    }
    if (action === "send-ai") {
      const message = getValue(host, "message").trim(); if (!message) throw new Error("Nhập nội dung cần gửi.");
      const messages = host.querySelector("[data-tool-messages]"); messages.insertAdjacentHTML("beforeend", `<div class="is-user">${esc(message)}</div>`); getInput(host, "message").value = ""; active.request?.abort?.(); active.request = new AbortController(); setState(host, "running", "AI đang xử lý");
      const data = await requestAi({ toolId: manifest.id, action: "chat", model: getValue(host, "model") || "auto", messages: [{ role: "user", content: message }], attachment: active.aiAttachment }, active.request.signal);
      const answer = data.output || data.message || data.content; if (!answer) throw new Error("Backend không trả về nội dung hợp lệ.");
      messages.insertAdjacentHTML("beforeend", `<div class="is-assistant">${esc(answer)}</div>`); active.request = null; active.aiAttachment = null; setState(host, "done", "AI đã trả lời"); await record(manifest.id, "chat", message.slice(0, 160)); return;
    }
    if (action === "cancel-ai") { active.request?.abort?.(); active.request = null; return setState(host, "idle", "Đã hủy yêu cầu AI"); }
    if (action === "new-chat") { host.querySelector("[data-tool-messages]").innerHTML = '<div class="is-system">Cuộc trò chuyện mới. Backend phải được cấu hình ở máy chủ.</div>'; return; }
    if (action === "export-chat") { download("hh-ai-chat.txt", host.querySelector("[data-tool-messages]").innerText); return; }
    if (action === "save-prompt") {
      const title = getValue(host, "title").trim(), content = getValue(host, "content").trim(); if (!title || content.length < 5) throw new Error("Nhập tên và nội dung prompt.");
      await storage.put("records", { id: uid("prompt"), type: "prompt", title, content, tags: getValue(host, "tags").split(",").map(item => item.trim()).filter(Boolean), updatedAt: new Date().toISOString() }); await renderCollection(host, "prompts"); await record(manifest.id, "save", title); return notice(host, "Đã lưu prompt vào IndexedDB.");
    }
    if (action === "use-prompt") { const row = await storage.get("records", buttonNode.closest("[data-record-id]").dataset.recordId); globalThis.dispatchEvent(new CustomEvent("hh:prompt-use", { detail: row })); return notice(host, `Đã gửi “${row.title}” tới workspace qua sự kiện hh:prompt-use.`); }
    if (action === "export-prompts") { const rows = await storage.list("records", row => row.type === "prompt"); download("hh-prompt-library.json", JSON.stringify({ version: 1, prompts: rows }, null, 2), "application/json"); return; }
    if (action === "delete-record") { const id = buttonNode.closest("[data-record-id]").dataset.recordId; await storage.delete("records", id); if (manifest.id === "ai-prompt-library") await renderCollection(host, "prompts"); else if (manifest.id === "version-history") await renderCollection(host, "versions"); else await renderCollection(host, "plugins"); return; }
    if (action === "optimize-prompt" || action === "generate-image-prompt") {
      const result = action === "optimize-prompt" ? optimizePrompt(getValue(host, "source"), getValue(host, "goal"), getValue(host, "target")) : imagePrompt(getValue(host, "source"), getValue(host, "goal"), getValue(host, "target")); setOutput(host, result); setState(host, "done", "Đã tạo bằng engine cục bộ"); await record(manifest.id, "generate", getValue(host, "source").slice(0, 160)); return;
    }
    if (action === "save-output-version") { const content = outputNode?.textContent || ""; if (!content || content === "Chưa có kết quả.") throw new Error("Chưa có kết quả để lưu."); await storage.put("records", { id: uid("version"), type: "version", label: manifest.name, content, createdAt: new Date().toISOString() }); return notice(host, "Đã lưu kết quả vào Version History."); }
    if (action === "new-tab") { const row = { id: uid("tab"), type: "workspace-tab", title: `Tài liệu ${Date.now().toString().slice(-4)}`, content: "", pinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; await storage.put("records", row); return renderTabs(host, row.id); }
    if (action === "select-tab") return renderTabs(host, buttonNode.dataset.recordId);
    if (["save-tab", "pin-tab"].includes(action)) { const id = host.dataset.activeTab, row = await storage.get("records", id); if (!row) throw new Error("Tab không tồn tại."); row.title = getValue(host, "title").trim() || "Không tên"; row.content = getValue(host, "document"); row.updatedAt = new Date().toISOString(); if (action === "pin-tab") row.pinned = !row.pinned; await storage.put("records", row); await renderTabs(host, id); return; }
    if (action === "close-tab") { const tabs = await storage.list("records", row => row.type === "workspace-tab"); if (tabs.length === 1) throw new Error("Workspace cần giữ ít nhất một tab."); await storage.delete("records", host.dataset.activeTab); return renderTabs(host); }
    if (action === "move-widget-left" || action === "move-widget-right") { const index = Number(buttonNode.closest("[data-dashboard-index]").dataset.dashboardIndex); return moveDashboard(host, index, index + (action.endsWith("left") ? -1 : 1)); }
    if (["remove-dashboard-widget", "resize-dashboard-widget"].includes(action)) { const record = await storage.get("records", "dashboard-layout"), id = buttonNode.closest("[data-dashboard-id]").dataset.dashboardId, widgets = structuredCloneSafe(record?.widgets?.length ? record.widgets : DEFAULT_DASHBOARD); active.dashboardUndo.push(structuredCloneSafe(widgets)); if (action === "remove-dashboard-widget") widgets.splice(widgets.findIndex(row => row.id === id), 1); else { const row = widgets.find(item => item.id === id); row.size = row.size === "wide" ? "normal" : "wide"; } await storage.put("records", { id: "dashboard-layout", type: "dashboard", widgets, updatedAt: new Date().toISOString() }); return renderDashboard(host); }
    if (action === "add-widget") { const record = await storage.get("records", "dashboard-layout"), widgets = structuredCloneSafe(record?.widgets?.length ? record.widgets : DEFAULT_DASHBOARD); active.dashboardUndo.push(structuredCloneSafe(widgets)); widgets.push({ id: uid("custom"), title: "Widget tùy chỉnh", value: "Sẵn sàng cấu hình" }); await storage.put("records", { id: "dashboard-layout", type: "dashboard", widgets, updatedAt: new Date().toISOString() }); return renderDashboard(host); }
    if (action === "undo-dashboard") { const widgets = active.dashboardUndo.pop(); if (!widgets) throw new Error("Chưa có thay đổi dashboard để hoàn tác."); await storage.put("records", { id: "dashboard-layout", type: "dashboard", widgets, updatedAt: new Date().toISOString() }); return renderDashboard(host); }
    if (action === "reset-dashboard") { await storage.delete("records", "dashboard-layout"); return renderDashboard(host); }
    if (action === "install-widget") { const item = MARKET_WIDGETS.find(row => row.id === buttonNode.closest("[data-widget-id]").dataset.widgetId); await storage.put("records", { id: `widget-${item.id}`, type: "widget", widgetId: item.id, enabled: true, installedAt: new Date().toISOString() }); await renderMarketplace(host); await record(manifest.id, "install", item.name); return; }
    if (action === "remove-widget-market") { const widgetId = buttonNode.closest("[data-widget-id]").dataset.widgetId; await storage.delete("records", `widget-${widgetId}`); return renderMarketplace(host); }
    if (action === "import-plugin") {
      let plugin; try { plugin = JSON.parse(getValue(host, "manifest")); } catch { throw new Error("Manifest phải là JSON hợp lệ."); }
      if (!/^[a-z0-9][a-z0-9-]{2,50}$/.test(plugin.id || "") || typeof plugin.name !== "string" || !/^\d+\.\d+\.\d+$/.test(plugin.version || "")) throw new Error("Manifest cần id dạng kebab-case, name và version semver.");
      if (plugin.entry || plugin.script || plugin.code) throw new Error("Không cho phép mã thực thi trong manifest. Chỉ cài metadata và permissions.");
      const permissions = Array.isArray(plugin.permissions) ? plugin.permissions.filter(item => typeof item === "string").slice(0, 20) : [];
      await storage.put("records", { id: `plugin-${plugin.id}`, type: "plugin", pluginId: plugin.id, name: plugin.name, version: plugin.version, permissions, enabled: false, installedAt: new Date().toISOString() }); await renderCollection(host, "plugins"); return notice(host, "Đã cài manifest ở trạng thái tắt. Hãy xem quyền trước khi bật.", "warning");
    }
    if (action === "toggle-plugin") { const id = buttonNode.closest("[data-record-id]").dataset.recordId, row = await storage.get("records", id); row.enabled = !row.enabled; await storage.put("records", row); return renderCollection(host, "plugins"); }
    if (["save-document", "restore-document", "clear-document"].includes(action)) {
      if (action === "restore-document") { const row = await storage.get("records", "autosave-document"); if (!row) throw new Error("Chưa có bản nháp để khôi phục."); getInput(host, "title").value = row.title; getInput(host, "document").value = row.content; }
      else if (action === "clear-document") { await storage.delete("records", "autosave-document"); getInput(host, "document").value = ""; }
      else await saveAutoDocument(host, true);
      return;
    }
    if (action === "create-version") { const content = getValue(host, "document"); if (!content.trim()) throw new Error("Không thể tạo phiên bản trống."); await storage.put("records", { id: uid("version"), type: "version", label: getValue(host, "label").trim() || `Phiên bản ${nowLabel()}`, content, createdAt: new Date().toISOString() }); await renderCollection(host, "versions"); return; }
    if (action === "restore-version") { const row = await storage.get("records", buttonNode.closest("[data-record-id]").dataset.recordId); getInput(host, "document").value = row.content; return notice(host, `Đã khôi phục “${row.label}” vào trình soạn thảo.`); }
    if (action === "export-versions") { const rows = await storage.list("records", row => row.type === "version"); download("hh-version-history.json", JSON.stringify({ version: 1, items: rows }, null, 2), "application/json"); return; }
    if (action === "preview-file") return previewFile(host, buttonNode.dataset.recordId);
    if (["delete-file", "export-file", "rename-file"].includes(action)) return fileAction(host, action, buttonNode.closest("[data-record-id]")?.dataset.recordId);
    if (["format-code", "save-code", "version-code", "export-code"].includes(action)) return codeAction(host, action);
    if (action === "apply-crop") return drawOcr(host, true);
    if (action === "recognize-ocr") return recognizeOcr(host);
    if (action === "export-ocr") { const text = getValue(host, "ocr-result"); if (!text.trim()) throw new Error("Chưa có kết quả OCR để xuất."); download("ocr-result.txt", text); return; }
  }

  async function saveAutoDocument(host, manual = false) {
    const status = host.querySelector("[data-tool-save-state]"); if (status) status.textContent = "Đang lưu…";
    try {
      const row = { id: "autosave-document", type: "document", title: getValue(host, "title") || "Bản nháp", content: getValue(host, "document"), updatedAt: new Date().toISOString() };
      await storage.put("records", row); if (status) status.textContent = `Đã lưu ${nowLabel(row.updatedAt)}`; setOutput(host, `${manual ? "Lưu thủ công" : "Auto save"}: ${nowLabel(row.updatedAt)}\n${row.content.length} ký tự`);
    } catch (error) { if (status) status.textContent = "Lưu lỗi · sẽ thử lại"; const timer = setTimeout(() => saveAutoDocument(host), 1800); active.timers.add(timer); throw error; }
  }

  async function previewFile(host, id) {
    const row = await storage.get("files", id); if (!row) return;
    host.dataset.activeFile = id; const preview = host.querySelector("[data-tool-preview]"); let content = "";
    if (row.type.startsWith("image/")) { const url = URL.createObjectURL(row.blob); content = `<img src="${url}" alt="${esc(row.name)}" onload="setTimeout(()=>URL.revokeObjectURL(this.src),1200)">`; }
    else if (/^(text\/|application\/(json|javascript|xml))/.test(row.type) && row.size < 2_000_000) content = `<pre>${esc(await row.blob.text())}</pre>`;
    else content = '<div class="hh-tool__empty">Không có preview an toàn cho định dạng này.</div>';
    preview.innerHTML = `<article data-record-id="${row.id}"><header><input data-tool-input="rename" value="${esc(row.name)}"><span>${esc(row.type)} · ${(row.size / 1024).toFixed(1)} KB</span></header>${content}<footer>${button("rename-file", "Đổi tên")}${button("export-file", "Tải xuống")}${button("delete-file", "Xóa")}</footer></article>`;
  }

  async function fileAction(host, action, id) {
    const row = await storage.get("files", id); if (!row) throw new Error("Tệp không còn tồn tại.");
    if (action === "delete-file") { await storage.delete("files", id); host.querySelector("[data-tool-preview]").innerHTML = '<div class="hh-tool__empty">Đã xóa tệp.</div>'; await renderFiles(host); return; }
    if (action === "export-file") return download(row.name, row.blob, row.type);
    row.name = getValue(host, "rename").trim() || row.name; row.updatedAt = new Date().toISOString(); await storage.put("files", row); await renderFiles(host); await previewFile(host, id);
  }

  function editorValue(host) { const editor = host.querySelector("[data-tool-editor]")?._editor; return editor ? editor.getValue() : getValue(host, "code"); }
  async function codeAction(host, action) {
    const editor = host.querySelector("[data-tool-editor]")?._editor, language = getValue(host, "language") || "javascript"; let code = editorValue(host);
    if (action === "format-code") {
      if (editor) await editor.getAction("editor.action.formatDocument")?.run();
      else if (language === "json") { try { code = JSON.stringify(JSON.parse(code), null, 2); getInput(host, "code").value = code; } catch { throw new Error("JSON không hợp lệ."); } }
      else { code = code.split("\n").map(line => line.replace(/\s+$/g, "")).join("\n"); getInput(host, "code").value = code; }
    }
    if (action === "save-code") await storage.put("records", { id: "code-document", type: "code", language, content: code, updatedAt: new Date().toISOString() });
    if (action === "version-code") await storage.put("records", { id: uid("version"), type: "version", label: `Code · ${language}`, content: code, createdAt: new Date().toISOString() });
    if (action === "export-code") download(`code.${({ javascript: "js", json: "json", html: "html", css: "css", markdown: "md" })[language] || "txt"}`, code);
  }

  async function loadOcrImage(host, file) {
    if (!file.type.startsWith("image/")) throw new Error("OCR hiện nhận tệp ảnh. Hãy chuyển trang PDF thành ảnh trước khi tải lên.");
    const image = new Image(), url = URL.createObjectURL(file);
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error("Không đọc được ảnh.")); image.src = url; }); URL.revokeObjectURL(url);
    active.ocrImage = image; active.ocrFile = file; host.querySelector("[data-tool-ocr-empty]").hidden = true; getInput(host, "crop-w").value = image.naturalWidth; getInput(host, "crop-h").value = image.naturalHeight; drawOcr(host, false);
  }
  function drawOcr(host, crop) {
    const image = active.ocrImage; if (!image) throw new Error("Chọn ảnh trước khi crop."); const canvas = host.querySelector("[data-tool-ocr-canvas]"), context = canvas.getContext("2d");
    const sx = clamp(getValue(host, "crop-x"), 0, image.naturalWidth - 1), sy = clamp(getValue(host, "crop-y"), 0, image.naturalHeight - 1), sw = clamp(getValue(host, "crop-w") || image.naturalWidth, 1, image.naturalWidth - sx), sh = clamp(getValue(host, "crop-h") || image.naturalHeight, 1, image.naturalHeight - sy), scale = Math.min(1, 1200 / Math.max(sw, sh)); canvas.width = Math.max(1, Math.round(sw * scale)); canvas.height = Math.max(1, Math.round(sh * scale)); context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height); if (crop) notice(host, `Đã crop vùng ${Math.round(sw)}×${Math.round(sh)} px.`);
  }
  async function recognizeOcr(host) {
    if (!active.ocrImage) throw new Error("Chọn ảnh trước khi nhận dạng."); setState(host, "running", "Đang nhận dạng OCR"); const canvas = host.querySelector("[data-tool-ocr-canvas]"); let text = "", confidence = null, engine = "";
    if (globalThis.TextDetector) {
      const detector = new TextDetector(); const blocks = await detector.detect(canvas); text = blocks.map(item => item.rawValue).join("\n"); confidence = blocks.length ? Math.round(blocks.reduce((sum, item) => sum + (item.confidence ?? 1), 0) / blocks.length * 100) : 0; engine = "TextDetector cục bộ";
    } else {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png")); const base64 = await blobToBase64(blob); const data = await requestAi({ toolId: "ocr", action: "recognize", language: getValue(host, "ocr-language"), image: base64 }, undefined); text = data.text || data.output || ""; confidence = Number.isFinite(Number(data.confidence)) ? Math.round(Number(data.confidence) * (Number(data.confidence) <= 1 ? 100 : 1)) : null; engine = "Backend /api/tools/run";
    }
    if (!text.trim()) throw new Error("OCR không tìm thấy văn bản trong vùng đã chọn."); getInput(host, "ocr-result").value = text; host.querySelector("[data-tool-confidence]").textContent = `Confidence: ${confidence == null ? "backend không cung cấp" : `${confidence}%`} · ${engine}`; setState(host, "done", "OCR hoàn tất"); await record("ocr", "recognize", `${text.length} ký tự`, { confidence, engine });
  }
  function blobToBase64(blob) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(blob); }); }
  function base64ToBlob(value, type) { const binary = atob(String(value).replace(/^data:[^,]+,/, "")), bytes = new Uint8Array(binary.length); for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index); return new Blob([bytes], { type }); }

  async function handleClick(event, work, name) {
    const manifest = resolveManifest(name); if (!manifest || !work.contains(event.target)) return false;
    const actionNode = event.target.closest("[data-tool-action]"); if (!actionNode) return false;
    event.preventDefault();
    try {
      const action = actionNode.dataset.toolAction;
      setState(work, "running", "Đang xử lý");
      await runAction(action, actionNode, work, manifest);
      const keepsRunning = ["start-recognition", "speak"].includes(action);
      if (!keepsRunning && work.querySelector('[data-tool-state="running"]')) setState(work, "done", "Hoàn thành");
    }
    catch (error) { if (error.name !== "AbortError") { setState(work, "error", "Có lỗi"); notice(work, error.message || "Không thể thực hiện công cụ.", "error"); } }
    return true;
  }

  async function handleChange(event, work, name) {
    const manifest = resolveManifest(name); if (!manifest) return false;
    if (event.target.matches("[data-tool-file]")) {
      const files = [...event.target.files]; for (const file of files) await storage.put("files", { id: uid("file"), name: file.name, type: file.type || "application/octet-stream", size: file.size, blob: file, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); await renderFiles(work); await record(manifest.id, "upload", `${files.length} tệp`); return true;
    }
    if (event.target.matches("[data-tool-ocr-file]")) { const file = event.target.files?.[0]; if (file) await loadOcrImage(work, file).catch(error => notice(work, error.message, "error")); return true; }
    if (event.target.matches("[data-tool-media-file]")) { const file = event.target.files?.[0]; if (file) { active.mediaFile = file; active.transcriptSegments = []; setOutput(work, `Đã chọn ${file.name}\n${file.type || "unknown"} · ${(file.size / 1024 / 1024).toFixed(2)} MB`); } return true; }
    if (event.target.matches("[data-tool-ai-file]")) {
      const file = event.target.files?.[0]; if (!file) return true; if (file.size > 500_000) { notice(work, "Tệp văn bản vượt quá 500 KB.", "error"); return true; }
      active.aiAttachment = { name: file.name, type: file.type || "text/plain", text: await file.text() };
      notice(work, `Đã đính kèm ${file.name}. Tệp chỉ được gửi khi bạn nhấn Gửi.`); return true;
    }
    if (event.target.matches('[data-tool-input="language"]') && manifest.id === "monaco-code-editor") { work.querySelector("[data-tool-editor]")?._editor?.getModel?.() && monaco.editor.setModelLanguage(work.querySelector("[data-tool-editor]")._editor.getModel(), event.target.value); return true; }
    if (manifest.id === "widget-marketplace" && event.target.matches('[data-tool-input="category"]')) { await renderMarketplace(work); return true; }
    return false;
  }

  function handleInput(event, work, name) {
    const manifest = resolveManifest(name); if (!manifest) return false;
    if (event.target.matches('input[type="range"]')) { const node = work.querySelector(`[data-tool-range-output="${event.target.dataset.toolInput}"]`); if (node) node.textContent = `${Number(event.target.value).toFixed(1)}${event.target.dataset.toolInput === "rate" ? "×" : ""}`; return true; }
    if (manifest.id === "auto-save" && event.target.matches('[data-tool-input="document"],[data-tool-input="title"]')) { active.timers.forEach(timer => clearTimeout(timer)); active.timers.clear(); const status = work.querySelector("[data-tool-save-state]"); if (status) status.textContent = "Có thay đổi · chuẩn bị lưu…"; const timer = setTimeout(() => saveAutoDocument(work).catch(error => notice(work, error.message, "error")), 600); active.timers.add(timer); return true; }
    if (manifest.id === "widget-marketplace" && event.target.matches('[data-tool-input="filter"]')) { renderMarketplace(work); return true; }
    if (manifest.id === "file-explorer" && event.target.matches('[data-tool-input="file-filter"]')) { renderFiles(work); return true; }
    return false;
  }

  function mount(host, options = {}) {
    const value = options.toolId || options.name || TOOL_MANIFESTS[0].id;
    const manifest = resolveManifest(value);
    if (!manifest || !render(host, manifest.id)) return null;
    const clickHandler = event => { handleClick(event, host, manifest.id); };
    const inputHandler = event => { handleInput(event, host, manifest.id); };
    const changeHandler = event => { handleChange(event, host, manifest.id); };
    host.addEventListener("click", clickHandler);
    host.addEventListener("input", inputHandler);
    host.addEventListener("change", changeHandler);
    return {
      root: host.querySelector("[data-hh-tool]"),
      cleanup: () => {
        host.removeEventListener("click", clickHandler);
        host.removeEventListener("input", inputHandler);
        host.removeEventListener("change", changeHandler);
        cleanup();
      }
    };
  }

  const api = {
    manifests: TOOL_MANIFESTS,
    getManifest: resolveManifest,
    supports: value => Boolean(resolveManifest(value)),
    featureSupport,
    render,
    mount,
    cleanup,
    handleClick,
    handleChange,
    handleInput,
    storage,
    optimizePrompt,
    imagePrompt,
    formatTranscript
  };
  globalThis.HHToolWorkspace = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
