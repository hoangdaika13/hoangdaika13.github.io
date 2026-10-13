(() => {
  "use strict";

  const DB_NAME = "hh-tool-workspace";
  const DB_VERSION = 1;
  const AI_ENDPOINTS = ["/api/ai"]; // One intentional request; never retry a paid operation at another endpoint.
  const TOOL_MANIFESTS = [
    { id: "voice-search", name: "Voice Search", runtime: "browser", permissions: ["microphone"], actions: ["start", "stop", "confirm", "clear"], history: true, offline: false },
    { id: "speech-to-text", name: "Speech To Text", runtime: "hybrid", permissions: ["microphone", "selected-audio"], actions: ["start", "stop", "record", "transcribe-file", "export-srt", "export-vtt"], history: true, offline: false },
    { id: "text-to-speech", name: "Text To Speech", runtime: "hybrid", permissions: [], actions: ["speak", "pause", "resume", "stop", "export-audio"], history: true, offline: false },
    { id: "ai-chat-assistant", name: "AI Chat Assistant", runtime: "ai", permissions: [], actions: ["send", "cancel", "new-chat", "export"], history: true, offline: false },
    { id: "ai-prompt-library", name: "AI Prompt Library", runtime: "browser", permissions: [], actions: ["save-prompt", "use-prompt", "new-prompt", "favorite-prompt", "duplicate-prompt", "delete-record", "render-prompt", "export-prompts", "import-prompts"], history: true, offline: true },
    { id: "ai-prompt-optimizer", name: "AI Prompt Optimizer", runtime: "hybrid", permissions: [], actions: ["optimize", "copy", "save-version"], history: true, offline: true },
    { id: "ai-image-prompt-generator", name: "AI Image Prompt Generator", runtime: "browser", permissions: [], actions: ["generate-image-prompt", "copy", "save-version"], history: true, offline: true },
    { id: "workspace-tabs", name: "Workspace Tabs", runtime: "browser", permissions: [], actions: ["new-tab", "select-tab", "save-tab", "close-tab", "pin-tab", "tab-left", "tab-right", "export-tab"], history: true, offline: true },
    { id: "drag-drop-dashboard", name: "Drag Drop Dashboard", runtime: "browser", permissions: [], actions: ["add-widget", "move-widget", "remove-widget", "reset-dashboard"], history: true, offline: true },
    { id: "widget-marketplace", name: "Widget Marketplace", runtime: "browser", permissions: [], actions: ["install-widget", "toggle-widget", "remove-widget"], history: true, offline: true },
    { id: "plugin-system", name: "Plugin System", runtime: "browser", permissions: ["explicit-plugin-permissions"], actions: ["import-plugin", "toggle-plugin", "remove-plugin"], history: true, offline: true },
    { id: "auto-save", name: "Auto Save", runtime: "browser", permissions: [], actions: ["save-document", "restore-document", "clear-document"], history: true, offline: true },
    { id: "version-history", name: "Version History", runtime: "browser", permissions: [], actions: ["create-version", "compare-version", "restore-version", "delete-record", "export-versions"], history: true, offline: true },
    { id: "file-explorer", name: "File Explorer", runtime: "browser", permissions: ["selected-files"], actions: ["upload-file", "preview-file", "rename-file", "save-file", "move-file", "delete-file", "export-file", "new-folder", "delete-folder"], history: true, offline: true },
    { id: "monaco-code-editor", name: "Monaco Code Editor", runtime: "hybrid", permissions: [], actions: ["format-code", "save-code", "version-code", "export-code", "new-code", "diff-code"], history: true, offline: true },
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
  const resolveManifest = value => {
    const clean = String(value || "").replace(/^(platform|ai|workspace|files)-/, "");
    return byName.get(value) || byId.get(value) || byId.get(aliases.get(value)) || byId.get(clean) || byId.get(aliases.get(clean)) || null;
  };
  const memory = { records: new Map(), history: new Map(), files: new Map() };
  const active = { recognition: null, utterance: null, request: null, ocrWorker: null, ocrRun: null, clockListener: null, timers: new Set(), host: null, manifest: null, scope: "guest", epoch: 0, detach: null, urls: new Set(), voicesListener: null, ocrImage: null, ocrFile: null, mediaFile: null, mediaRecorder: null, mediaStream: null, mediaChunks: [], transcriptSegments: [], subtitleCues: [], subtitleOrigin: "manual", aiAttachment: null, dashboardUndo: [] };

  function accountScope(options = {}) {
    if (globalThis.HHAllToolState?.accountScope) return globalThis.HHAllToolState.accountScope();
    const user = options.currentUser || globalThis.HHAuthz?.currentUser?.() || {};
    const id = user._id || user.id || user.sub;
    return id ? `account:${encodeURIComponent(String(id))}` : "guest";
  }
  const scopeFor = host => host?._toolScope || active.scope || accountScope();
  const live = (host, epoch = host?._toolEpoch) => active.host === host && active.epoch === epoch && (!host._toolAccount || host._toolAccount === accountScope(host._toolOptions));
  const scopedId = (id, owner) => `${owner}::${String(id)}`;
  const publicRow = row => row ? { ...row, id: row.localId } : null;
  const PURPOSES = Object.freeze({
    "voice-search": "Nói rồi xác nhận để tìm công cụ trong All Tools; không đọc nội dung riêng của workspace khác.",
    "speech-to-text": "Nhận dạng micro, ghi âm, chép file audio qua backend sau đồng ý chi phí và biên tập phụ đề. Không tự bật micro hoặc gửi tệp.",
    "text-to-speech": "Nghe bằng giọng thiết bị miễn phí; tạo WAV bằng giọng backend sau đồng ý chi phí. Hai engine và tùy chọn được phân biệt rõ.",
    "ai-chat-assistant": "Trợ lý văn bản có lịch sử riêng, tệp văn bản và xác nhận mỗi lần gửi AI.",
    "ai-prompt-library": "Thư viện prompt riêng: sửa, gắn tag, tìm kiếm, yêu thích, nhập/xuất JSON và điền biến mẫu mà không gửi AI.",
    "ai-prompt-optimizer": "Biên soạn prompt có cấu trúc bằng quy tắc cục bộ; không quảng cáo đây là kết quả AI.",
    "ai-image-prompt-generator": "Soạn mô tả ảnh theo chủ thể, phong cách và tỷ lệ. Chỉ tạo văn bản, không phát sinh phí tạo ảnh.",
    "workspace-tabs": "Nhiều tài liệu riêng trong All Tools; ghim, chuyển tab và giữ nội dung chưa nhấn lưu.",
    "drag-drop-dashboard": "Bảng cá nhân có widget ghi chú, checklist, bộ đếm và đồng hồ; không thay đổi dashboard chính.",
    "widget-marketplace": "Danh mục widget cục bộ đã được duyệt; cài để dùng ngay, không tải mã bên ngoài.",
    "plugin-system": "Cài engine xử lý văn bản an toàn từ manifest JSON, bật/tắt và chạy trên dữ liệu của bạn.",
    "auto-save": "Tài liệu nháp tự lưu theo tài khoản, khôi phục và xuất trước khi đóng.",
    "version-history": "Snapshot riêng: tìm kiếm, nhóm tài liệu, phân trang, đổi nhãn, so sánh hai bản và khôi phục có bảo vệ bản đang nhập; không ghi đè workspace khác.",
    "file-explorer": "Kho tệp cục bộ theo tài khoản: thư mục, tìm kiếm, sửa văn bản, đổi tên, xem trước an toàn và tải xuống.",
    "monaco-code-editor": "Monaco thật tải từ website: nhiều tài liệu, định dạng, chẩn đoán và diff. Mobile dùng editor văn bản dễ nhập; không chạy code.",
    "ocr": "Crop ảnh, nhận dạng Việt/Anh bằng engine OCR cục bộ tải khi cần, sửa và xuất văn bản; không tải ảnh lên server."
  });

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
      let settled = false;
      const timer = setTimeout(() => finish(null), 5000);
      const finish = db => { if (settled) { db?.close?.(); return; } settled = true; clearTimeout(timer); resolve(db); };
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("records")) db.createObjectStore("records", { keyPath: "id" });
        if (!db.objectStoreNames.contains("history")) {
          const store = db.createObjectStore("history", { keyPath: "id" });
          store.createIndex("tool", "tool", { unique: false });
        }
        if (!db.objectStoreNames.contains("files")) db.createObjectStore("files", { keyPath: "id" });
      };
      request.onsuccess = () => finish(request.result);
      request.onerror = () => finish(null);
      request.onblocked = () => finish(null);
    });
  }

  const storage = {
    async put(storeName, value, owner = value.owner || active.scope || accountScope()) {
      const stored = { ...value, id: scopedId(value.id, owner), localId: value.id, owner, schema: 2 };
      const db = await openDb();
      if (!db) { if (globalThis.indexedDB) throw new Error("IndexedDB không mở được. Chưa lưu; hãy xuất bản nháp trước khi rời."); memory[storeName].set(stored.id, structuredCloneSafe(stored)); return value; }
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).put(stored);
        tx.oncomplete = () => { db.close(); resolve(value); };
        tx.onerror = () => { db.close(); reject(tx.error || new Error("Không thể lưu dữ liệu ngoại tuyến.")); };
        tx.onabort = () => { db.close(); reject(tx.error || new Error("Giao dịch lưu đã bị hủy.")); };
      });
    },
    async get(storeName, id, owner = active.scope || accountScope()) {
      const db = await openDb();
      if (!db) { if (globalThis.indexedDB) throw new Error("Không đọc được IndexedDB. Dữ liệu đã lưu chưa được xác nhận; không tạo dữ liệu trống thay thế."); return publicRow(memory[storeName].get(scopedId(id, owner))); }
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const request = tx.objectStore(storeName).get(scopedId(id, owner));
        request.onsuccess = () => resolve(publicRow(request.result));
        request.onerror = () => reject(request.error || new Error("Đọc dữ liệu thất bại."));
        tx.oncomplete = () => db.close();
      });
    },
    async list(storeName, predicate = () => true, owner = active.scope || accountScope()) {
      const db = await openDb();
      if (!db) { if (globalThis.indexedDB) throw new Error("Không đọc được IndexedDB. Chưa xác nhận được danh sách dữ liệu cũ."); return [...memory[storeName].values()].filter(row => row.owner === owner).map(publicRow).filter(predicate); }
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const request = tx.objectStore(storeName).getAll();
        request.onsuccess = () => resolve((request.result || []).filter(row => row.owner === owner).map(publicRow).filter(predicate));
        request.onerror = () => reject(request.error || new Error("Đọc danh sách thất bại."));
        tx.oncomplete = () => db.close();
      });
    },
    async delete(storeName, id, owner = active.scope || accountScope()) {
      const db = await openDb();
      if (!db) { if (globalThis.indexedDB) throw new Error("Chưa xóa được: IndexedDB không mở được."); return memory[storeName].delete(scopedId(id, owner)); }
      return new Promise(resolve => {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).delete(scopedId(id, owner));
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onerror = () => { db.close(); resolve(false); };
        tx.onabort = () => { db.close(); resolve(false); };
      });
    }
  };
  const rawStorage = storage;

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
    if (["voice-search", "speech-to-text"].includes(manifest.id) && !getRecognition()) return { ok: manifest.id === "speech-to-text", degraded: true, reason: "Nhận dạng micro chưa hỗ trợ trên trình duyệt này. Có thể nhập văn bản; chép file audio dùng adapter backend nếu cấu hình." };
    if (manifest.id === "text-to-speech" && !("speechSynthesis" in globalThis)) return { ok: true, degraded: true, reason: "Giọng thiết bị chưa hỗ trợ; tạo WAV vẫn dùng được nếu backend có cấu hình." };
    if (manifest.id === "ocr" && !("TextDetector" in globalThis)) return { ok: true, degraded: true, reason: "OCR dùng Tesseract/WASM và dữ liệu Việt/Anh sẵn trong website; chỉ tải engine khi bạn nhấn Nhận dạng. Ảnh xử lý cục bộ, cần hỗ trợ Web Worker/WASM." };
    if (manifest.id === "ai-chat-assistant") return { ok: true, degraded: true, reason: "Soạn/lưu cuộc trò chuyện riêng trong All Tools. Gửi AI cần đăng nhập, backend và đồng ý chi phí; không tự gửi khi mở." };
    if (!globalThis.indexedDB && manifest.offline) return { ok: true, degraded: true, reason: "IndexedDB không khả dụng; dữ liệu chỉ được giữ trong phiên này." };
    return { ok: true, degraded: false, reason: "Sẵn sàng." };
  }

  function shell(manifest, body) {
    const support = featureSupport(manifest);
    if (manifest.id === "speech-to-text") body += subtitleMarkup();
    if (manifest.id === "text-to-speech") body += '<p class="hh-tool__help">Nên tạo đoạn ngắn khoảng 250 ký tự. WAV giới hạn 2 MB (khoảng 44 giây ở PCM 24 kHz mono 16-bit), không bảo đảm thời lượng theo số ký tự. Nội dung dài có thể bị từ chối sau khi nhà cung cấp đã tạo và vẫn tính phí. Không tự chia đoạn hoặc gọi API tiếp.</p>';
    return `<section class="hh-tool" data-hh-tool="${manifest.id}">
      <header class="hh-tool__header"><div><small>ALL TOOLS · WORKSPACE RIÊNG</small><h3>${esc(manifest.name)}</h3><p>${esc(PURPOSES[manifest.id])}</p></div><div class="hh-tool__badges"><span data-runtime="${manifest.runtime}">${esc(statusLabel(manifest.runtime))}</span><span class="${support.ok ? support.degraded ? "is-warning" : "is-ready" : "is-error"}">${support.ok ? support.degraded ? "Có giới hạn" : "Sẵn sàng" : "Không hỗ trợ"}</span></div></header>
      <div class="hh-tool__notice ${support.ok ? support.degraded ? "is-warning" : "" : "is-error"}" data-tool-notice role="status" aria-live="polite">${esc(support.reason)}</div>
      <div class="hh-tool__body">${body}</div>
      <footer class="hh-tool__footer"><span data-tool-state="idle"><i></i> Đang chờ</span><span>Lưu riêng tài khoản · ${globalThis.indexedDB ? "IndexedDB" : "bộ nhớ phiên"}</span><span>Không lưu API key trong trình duyệt</span></footer>
    </section>`;
  }

  const field = (label, control, hint = "") => `<label class="hh-tool__field"><span>${esc(label)}</span>${control}${hint ? `<small>${esc(hint)}</small>` : ""}</label>`;
  const button = (action, label, kind = "") => `<button type="button" data-tool-action="${action}" class="${kind}">${esc(label)}</button>`;
  const textArea = (name, placeholder, value = "") => `<textarea data-tool-input="${name}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`;
  const output = (label = "Kết quả") => `<section class="hh-tool__output"><header><strong>${esc(label)}</strong><button type="button" data-tool-action="copy-output">Sao chép</button></header><pre data-tool-output>Chưa có kết quả.</pre></section>`;
  const consent = '<label class="hh-tool__consent"><input type="checkbox" data-tool-paid-consent> Tôi đồng ý gửi nội dung tới backend AI; có thể tính phí API. Không tự thử lại.</label>';

  function voiceMarkup(manifest) {
    if (manifest.id === "text-to-speech") return shell(manifest, `<div class="hh-tool__grid"><section class="hh-tool__panel"><div class="hh-tool__form">${field("Văn bản", textArea("text", "Nhập nội dung cần đọc..."))}<div class="hh-tool__row">${field("Giọng thiết bị · chỉ nghe", '<select data-tool-input="voice"><option value="">Đang tải giọng...</option></select>')}${field("Ngôn ngữ", '<select data-tool-input="language"><option value="vi-VN">Tiếng Việt</option><option value="en-US">English (US)</option><option value="en-GB">English (UK)</option><option value="en-AU">English (Australia)</option></select>')}</div><div class="hh-tool__row">${field("Tốc độ giọng thiết bị", '<input data-tool-input="rate" type="range" min="0.5" max="2" step="0.1" value="1"><output data-tool-range-output="rate">1.0×</output>')}${field("Cao độ giọng thiết bị", '<input data-tool-input="pitch" type="range" min="0.5" max="2" step="0.1" value="1"><output data-tool-range-output="pitch">1.0</output>')}</div><div class="hh-tool__actions">${button("speak", "Nghe trên thiết bị", "is-primary")}${button("pause", "Tạm dừng")}${button("resume", "Tiếp tục")}${button("stop", "Dừng")}</div><hr>${field("Giọng backend · tạo WAV", '<select data-tool-input="server-voice"><option value="Kore">Kore</option><option value="Puck">Puck</option><option value="Zephyr">Zephyr</option><option value="Charon">Charon</option><option value="Aoede">Aoede</option><option value="Leda">Leda</option></select>')}<p data-tool-speech-capability role="status">Chưa kiểm tra cấu hình máy chủ.</p>${consent}<p class="hh-tool__help">Tối đa 2.000 ký tự; tốc độ/cao độ phía trên chỉ áp dụng giọng thiết bị. Tạo WAV cần đăng nhập, cấu hình backend và quota API.</p><div class="hh-tool__actions">${button("export-tts", "Tạo WAV bằng backend")}${button("cancel-speech", "Hủy yêu cầu")}${button("download-tts", "Tải WAV đã tạo")}</div><audio data-tool-tts-preview controls preload="none" aria-label="WAV đã tạo · không tự phát"></audio></div></section>${output("Trạng thái giọng đọc")}</div>`);
    const search = manifest.id === "voice-search";
    const actions = search ? button("confirm-search", "Xác nhận tìm") : `${button("start-media-record", "Ghi âm")}${button("stop-media-record", "Dừng ghi")}${button("download-recording", "Tải bản ghi")}${button("transcribe-media", "Chép file bằng backend")}${button("cancel-speech", "Hủy yêu cầu")}${button("export-srt", "Xuất SRT")}${button("export-vtt", "Xuất VTT")}`;
    return shell(manifest, `<div class="hh-tool__grid"><section class="hh-tool__panel"><div class="hh-tool__form"><div class="hh-tool__row">${field("Ngôn ngữ", '<select data-tool-input="language"><option value="vi-VN">Tiếng Việt</option><option value="en-US">English (US)</option><option value="en-GB">English (UK)</option><option value="en-AU">English (Australia)</option></select>')}${field("Chế độ", '<select data-tool-input="continuous"><option value="false">Một câu</option><option value="true">Liên tục</option></select>')}</div>${search ? "" : '<label class="hh-tool__file-button">Chọn audio · tối đa 2 MB<input type="file" accept="audio/*" data-tool-media-file></label><p data-tool-speech-capability role="status">Chưa kiểm tra cấu hình máy chủ.</p>'}<div class="hh-tool__wave" data-tool-wave aria-label="Trạng thái micro">${Array(18).fill("<i></i>").join("")}</div>${field("Bản chép lời có thể sửa", textArea("transcript", search ? "Kết quả giọng nói để xác nhận tìm kiếm..." : "Nhận dạng micro hoặc nhập bản chép lời để biên tập phụ đề..."))}${search ? "" : consent}<div class="hh-tool__actions">${button("start-recognition", "Nhận dạng trực tiếp", "is-primary")}${button("stop-recognition", "Dừng trực tiếp")}${actions}${button("clear-transcript", "Xóa")}</div>${search ? "" : '<p class="hh-tool__help">Chép file chưa khả dụng nếu backend chưa cấu hình/quota. Không có diarization/timestamp chính xác. Xuất SRT/VTT từ văn bản dùng mốc 4 giây/câu để bạn chỉnh thủ công.</p>'}</div></section>${output(search ? "Kết quả tìm kiếm" : "Thông tin file/phiên ghi")}</div>`);
  }

  function aiMarkup(manifest) {
    if (manifest.id === "ai-chat-assistant") return shell(manifest, `<section class="hh-tool__chat"><header><span>Model do máy chủ cấu hình · không dùng chung lịch sử Chat AI</span><label class="hh-tool__file-button">Đính kèm văn bản<input type="file" accept="text/*,application/json,.md,.csv" data-tool-ai-file></label>${button("new-chat", "Cuộc trò chuyện mới")}${button("export-chat", "Xuất cuộc trò chuyện")}</header><div class="hh-tool__messages" data-tool-messages><div class="is-system">AI chỉ hoạt động khi backend đã được cấu hình. Không nhập API key vào đây.</div></div>${consent}<div class="hh-tool__composer">${textArea("message", "Nhập yêu cầu; có thể đính kèm nội dung văn bản...")}<div>${button("cancel-ai", "Hủy")}${button("send-ai", "Gửi", "is-primary")}</div></div></section>`);
    if (manifest.id === "ai-prompt-library") return shell(manifest, `<div class="hh-tool__split"><section class="hh-tool__panel"><div class="hh-tool__form">${field("Tên prompt", '<input data-tool-input="title" placeholder="Ví dụ: Kịch bản video relax">')}${field("Tags", '<input data-tool-input="tags" placeholder="youtube, relax, image">')}${field("Prompt", textArea("content", "Viết prompt có thể tái sử dụng; dùng {{variable}} cho biến..."))}<div class="hh-tool__actions">${button("save-prompt", "Lưu prompt", "is-primary")}${button("new-prompt", "Prompt mới")}${button("export-prompts", "Xuất JSON")}<label class="hh-tool__file-button">Nhập JSON<input type="file" accept="application/json,.json" data-tool-prompt-file></label></div><p data-tool-prompt-state role="status">Đang tạo prompt mới.</p><div data-tool-variables></div>${button("render-prompt", "Điền biến và tạo bản dùng")}</div>${output("Prompt đã điền biến · không gửi AI")}</section><div><header class="hh-tool__toolbar">${field("Tìm prompt hoặc tag", '<input data-tool-input="prompt-filter" placeholder="Tên, nội dung, tag…">')}${field("Lọc", '<select data-tool-input="prompt-favorites"><option value="all">Tất cả</option><option value="favorites">Yêu thích</option></select>')}</header><section class="hh-tool__collection" data-tool-list><div class="hh-tool__empty">Đang tải thư viện…</div></section></div></div>`);
    const image = manifest.id === "ai-image-prompt-generator";
    return shell(manifest, `<div class="hh-tool__grid"><section class="hh-tool__panel"><div class="hh-tool__form">${field(image ? "Ý tưởng hình ảnh" : "Prompt gốc", textArea("source", image ? "Ví dụ: phòng jazz đêm mưa, cửa sổ lớn..." : "Mô tả nhiệm vụ cần tối ưu..."))}<div class="hh-tool__row">${field(image ? "Phong cách" : "Mục tiêu", `<select data-tool-input="goal">${image ? '<option value="cinematic">Cinematic</option><option value="illustration">Illustration</option><option value="photorealistic">Photorealistic</option><option value="anime">Anime</option>' : '<option value="accuracy">Chính xác</option><option value="creative">Sáng tạo</option><option value="concise">Ngắn gọn</option><option value="analysis">Phân tích sâu</option>'}</select>`)}${field(image ? "Tỉ lệ" : "Model đích", `<select data-tool-input="target"><option value="auto">Tự động</option>${image ? '<option value="16:9">16:9 YouTube</option><option value="9:16">9:16 Shorts</option><option value="1:1">1:1</option>' : '<option value="chat">Chat model</option><option value="reasoning">Reasoning model</option><option value="image">Image model</option>'}</select>`)}</div><div class="hh-tool__actions">${button(image ? "generate-image-prompt" : "optimize-prompt", image ? "Tạo prompt ảnh" : "Tối ưu prompt", "is-primary")}${button("save-output-version", "Lưu phiên bản")}</div></div></section>${output(image ? "Prompt hoàn chỉnh + Negative Prompt" : "Prompt đã tối ưu")}</div>`);
  }

  function workspaceMarkup(manifest) {
    if (manifest.id === "workspace-tabs") return shell(manifest, `<section class="hh-tool__workspace"><header class="hh-tool__tabbar" data-tool-tabs role="tablist" aria-label="Tài liệu riêng"></header><div class="hh-tool__form">${field("Tên tài liệu · lưu để đổi tên", '<input data-tool-input="title" value="Tài liệu mới">')}${textArea("document", "Soạn nội dung; bản nháp giữ riêng và được lưu khi chuyển tab...")}<div data-tool-save-state role="status">Đã lưu.</div><div class="hh-tool__actions">${button("new-tab", "Tab mới", "is-primary")}${button("save-tab", "Lưu & đổi tên")}${button("pin-tab", "Ghim/Bỏ ghim")}${button("tab-left", "Đưa tab về trước")}${button("tab-right", "Đưa tab ra sau")}${button("export-tab", "Xuất TXT")}${button("close-tab", "Xóa tab")}</div><p class="hh-tool__help">Chuyển tab giữ nội dung. Xóa tab có bước xác nhận và lưu snapshot; không ảnh hưởng tab của website chính.</p></div></section>`);
    if (manifest.id === "drag-drop-dashboard") return shell(manifest, `<div class="hh-tool__toolbar">${field("Loại widget", '<select data-tool-input="widget-kind"><option value="notes">Ghi chú</option><option value="checklist">Checklist</option><option value="counter">Bộ đếm</option><option value="clock">Đồng hồ</option></select>')}${button("add-widget", "Thêm widget", "is-primary")}${button("undo-dashboard", "Hoàn tác")}${button("reset-dashboard", "Đặt lại")}</div><p class="hh-tool__help">Dashboard riêng của All Tools. Kéo thả hoặc dùng nút Trước/Sau; dữ liệu không thay đổi Trang chủ.</p><section class="hh-tool__dashboard" data-tool-dashboard aria-label="Dashboard kéo thả"></section>`);
    if (manifest.id === "widget-marketplace") return shell(manifest, `<header class="hh-tool__toolbar"><input data-tool-input="filter" placeholder="Tìm widget…"><select data-tool-input="category"><option value="all">Tất cả</option><option value="productivity">Công việc</option><option value="analytics">Phân tích</option><option value="media">Media</option></select></header><section class="hh-tool__market" data-tool-list></section>`);
    if (manifest.id === "plugin-system") return shell(manifest, `<div class="hh-tool__split"><section class="hh-tool__panel"><div class="hh-tool__form"><p class="hh-tool__help">Chỉ dùng engine văn bản được duyệt trong All Tools: text-uppercase, text-trim, line-sort. Không tải/chạy JavaScript từ manifest, không xin quyền thiết bị.</p>${field("Plugin manifest", textArea("manifest", '{\n  "id": "my-plugin",\n  "name": "Sắp xếp dòng",\n  "version": "1.0.0",\n  "engine": "line-sort",\n  "permissions": []\n}'))}${field("Văn bản thử plugin", textArea("plugin-source", "Nhập văn bản để chạy engine đã bật..."))}<div class="hh-tool__actions">${button("import-plugin", "Kiểm tra & cài", "is-primary")}</div></div></section><div><section class="hh-tool__collection" data-tool-list></section>${output("Kết quả plugin")}</div></div>`);
    if (manifest.id === "auto-save") return shell(manifest, `<div class="hh-tool__grid"><section class="hh-tool__panel"><div class="hh-tool__form">${field("Tài liệu", '<input data-tool-input="title" value="Bản nháp Auto Save">')}${field("Nội dung", textArea("document", "Mọi thay đổi được lưu sau 600 ms..."), "Lưu riêng tài khoản. Khi lỗi, giữ nội dung và dùng Lưu ngay để thử lại hoặc Xuất bản nháp.")}<div class="hh-tool__actions">${button("save-document", "Lưu ngay", "is-primary")}${button("restore-document", "Khôi phục")}${button("clear-document", "Xóa bản nháp")}${button("export-document", "Xuất bản nháp")}</div><div class="hh-tool__save-state" data-tool-save-state>Chưa có thay đổi.</div></div></section>${output("Nhật ký lưu")}</div>`);
    if (manifest.id === "version-history") return shell(manifest, `<div class="hh-tool__split"><section class="hh-tool__panel"><div class="hh-tool__form">${field("Nhãn phiên bản", '<input data-tool-input="label" maxlength="180" placeholder="Ví dụ: Trước khi chỉnh sửa">')}${field("Nội dung đang sửa", textArea("document", "Nội dung cần lưu phiên bản..."))}<p class="hh-tool__help" data-tool-version-context>Đang soạn tài liệu riêng; không chỉnh workspace khác.</p><div class="hh-tool__actions">${button("create-version", "Tạo phiên bản", "is-primary")}${button("export-version-draft", "Xuất bản đang sửa")}${button("export-versions", "Xuất lịch sử")}</div><p class="hh-tool__help">Khôi phục chỉ đổi nội dung ở đây; tự lưu snapshot nội dung hiện tại trước khi thay thế. Nếu chuyển nhóm tài liệu, cần xác nhận lần hai. Không ghi đè phần vừa nhập trong lúc đọc/lưu. Giữ nguyên snapshot đến 500 KB UTF-8 và định dạng cũ 200.000 ký tự.</p></div>${output("So sánh snapshot hoặc hai bản được chọn")}</section><div><header class="hh-tool__version-toolbar">${field("Tìm nhãn hoặc nội dung", '<input data-tool-input="version-filter" placeholder="Tìm snapshot…">')}${field("Nhóm tài liệu", '<select data-tool-input="version-document"><option value="all">Tất cả nhóm</option></select>')}${field("Sắp xếp", '<select data-tool-input="version-sort"><option value="newest">Mới nhất</option><option value="oldest">Cũ nhất</option><option value="label">Theo nhãn</option></select>')}${field("Mỗi trang", '<select data-tool-input="version-page-size"><option value="20">20 bản</option><option value="50">50 bản</option></select>')}</header><div class="hh-tool__actions">${button("compare-selected-versions", "So sánh hai bản đã chọn")}${button("clear-version-selection", "Bỏ chọn")}<span data-tool-version-selection role="status">Chưa chọn snapshot.</span></div><section class="hh-tool__collection" data-tool-list></section><footer class="hh-tool__version-pagination">${button("version-prev", "Trang trước")}<span data-tool-version-page role="status"></span>${button("version-next", "Trang sau")}</footer></div></div>`);
    if (manifest.id === "file-explorer") return shell(manifest, `<section class="hh-tool__files"><header><label class="hh-tool__file-button">Chọn tệp<input type="file" data-tool-file multiple></label>${field("Thư mục hiện tại", '<select data-tool-input="file-folder"><option value="">Gốc</option></select>')}<input data-tool-input="file-filter" aria-label="Tìm tệp" placeholder="Tên hoặc loại tệp…"><input data-tool-input="folder-name" aria-label="Tên thư mục mới" placeholder="Tên thư mục mới">${button("new-folder", "Tạo thư mục")}${button("delete-folder", "Xóa thư mục trống")}</header><p class="hh-tool__help">Tệp chỉ nằm trên thiết bị và tài khoản hiện tại. HTML/SVG không được chạy; sửa văn bản tối đa 500 KB, tải lên tối đa 20 MB/tệp.</p><div class="hh-tool__file-layout"><div data-tool-list class="hh-tool__file-list"></div><section class="hh-tool__preview" data-tool-preview><div class="hh-tool__empty">Chọn một tệp để xem trước.</div></section></div></section>`);
    if (manifest.id === "monaco-code-editor") return shell(manifest, `<section class="hh-tool__code"><header>${field("Tài liệu", '<select data-tool-input="code-document"><option value="code-document">Code chính</option></select>')}${button("new-code", "Tài liệu mới")}${field("Tên file", '<input data-tool-input="code-title" value="main.js">')}<select aria-label="Ngôn ngữ code" data-tool-input="language"><option value="javascript">JavaScript</option><option value="typescript">TypeScript</option><option value="json">JSON</option><option value="html">HTML</option><option value="css">CSS</option><option value="markdown">Markdown</option></select>${button("format-code", "Format")}${button("save-code", "Lưu")}${button("version-code", "Snapshot")}${button("diff-code", "So với bản lưu")}${button("export-code", "Xuất file")}</header><div data-tool-editor class="hh-tool__editor"><textarea aria-label="Mã nguồn · không thực thi" data-tool-input="code" spellcheck="false">function hello(name) {\n  return &quot;Xin chào &quot; + name;\n}</textarea></div><div data-tool-code-diff class="hh-tool__code-diff" hidden></div><section data-tool-code-problems class="hh-tool__code-problems" aria-label="Chẩn đoán cú pháp" aria-live="polite"></section><footer data-tool-editor-status>Editor văn bản sẵn sàng; đang tải Monaco cục bộ. Nội dung không được thực thi.</footer></section>`);
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
    const token = globalThis.HHAuthSession?.token?.() || "";
    const response = await fetch(AI_ENDPOINTS[0], { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, credentials: "same-origin", signal, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || `Máy chủ AI trả HTTP ${response.status}. Chưa gửi lại.`);
    if (payload.toolId === "text-to-speech") { if (typeof data.result?.audio?.data !== "string" || data.result.audio.mimeType !== "audio/wav") throw new Error("Backend không trả WAV hợp lệ."); }
    else if (!data.result?.text?.trim()) throw new Error("Backend không trả về văn bản AI hợp lệ.");
    return data.result;
  }
  function bytesToBase64(bytes) { let binary = ""; for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192)); return btoa(binary); }
  function decodeSpeechAudio(audio) {
    if (audio?.mimeType !== "audio/wav" || typeof audio.data !== "string" || audio.data.length > 2800000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(audio.data)) throw new Error("Audio backend không phải WAV hợp lệ hoặc vượt 2 MB.");
    const binary = atob(audio.data); if (binary.length > 2 * 1024 * 1024 || binary.length < 44 || binary.slice(0, 4) !== "RIFF" || binary.slice(8, 12) !== "WAVE") throw new Error("Tệp WAV không hợp lệ hoặc vượt giới hạn.");
    return new Blob([Uint8Array.from(binary, char => char.charCodeAt(0))], { type: "audio/wav" });
  }
  async function hydrateSpeechCapability(host, manifest) {
    const epoch = active.epoch, node = host.querySelector("[data-tool-speech-capability]"); if (!node) return;
    const controller = new AbortController(); host._capabilityRequest = controller;
    try {
      const token = globalThis.HHAuthSession?.token?.() || "";
      const response = await fetch("/api/ai", { credentials: "same-origin", headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: controller.signal });
      const data = await response.json(); if (!live(host, epoch)) return;
      const providerId = manifest.id === "text-to-speech" ? "tts" : "speech";
      const provider = Array.isArray(data.providers) ? data.providers.find(row => row.provider === providerId) : data.providers?.[providerId];
      if (!response.ok || !provider) { node.textContent = "Chưa kiểm tra được cấu hình. Không có yêu cầu tạo/chép nào được gửi."; return; }
      host._speechCapability = provider;
      node.textContent = provider.configured ? `Backend có cấu hình · ${provider.model || "model máy chủ"}. Quota/billing được xác nhận khi bạn chủ động gửi.` : "Backend chưa cấu hình; nhận dạng/giọng thiết bị và nhập/xuất văn bản vẫn dùng được.";
    } catch (error) { if (live(host, epoch) && error.name !== "AbortError") node.textContent = "Không đọc được cấu hình máy chủ. Thao tác cục bộ vẫn hoạt động; không tự gọi dịch vụ trả phí."; }
    finally { if (host._capabilityRequest === controller) host._capabilityRequest = null; }
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

  const PLUGIN_ENGINES = Object.freeze({
    "text-uppercase": value => String(value).toLocaleUpperCase("vi-VN"),
    "text-trim": value => String(value).split(/\r?\n/).map(line => line.trim()).join("\n").trim(),
    "line-sort": value => String(value).split(/\r?\n/).sort((a, b) => a.localeCompare(b, "vi")).join("\n")
  });
  function validatePlugin(plugin) {
    if (!plugin || typeof plugin !== "object" || Array.isArray(plugin) || !/^[a-z0-9][a-z0-9-]{2,50}$/.test(plugin.id || "") || typeof plugin.name !== "string" || !plugin.name.trim() || plugin.name.length > 100 || !/^\d+\.\d+\.\d+$/.test(plugin.version || "")) throw new Error("Manifest cần id kebab-case, name (tối đa 100 ký tự) và version semver.");
    if (plugin.entry || plugin.script || plugin.code) throw new Error("Không cho phép mã thực thi trong manifest.");
    if (!Object.hasOwn(PLUGIN_ENGINES, plugin.engine)) throw new Error("Engine chưa được duyệt. Chọn text-uppercase, text-trim hoặc line-sort.");
    if (plugin.permissions?.length) throw new Error("Engine văn bản không cần quyền thiết bị/mạng; permissions phải rỗng.");
    return { pluginId: plugin.id, name: plugin.name.trim(), version: plugin.version, engine: plugin.engine, permissions: [] };
  }
  function runPlugin(engine, value) {
    if (!Object.hasOwn(PLUGIN_ENGINES, engine)) throw new Error("Engine plugin chưa được duyệt.");
    return PLUGIN_ENGINES[engine](String(value).slice(0, 200000));
  }

  function promptVariables(value) {
    return [...new Set([...String(value).matchAll(/\{\{\s*([A-Za-z][A-Za-z0-9_-]{0,63})\s*\}\}/g)].map(match => match[1]))].slice(0, 30);
  }
  function fillPrompt(value, variables) {
    const missing = promptVariables(value).filter(name => !Object.hasOwn(variables, name) || !String(variables[name]).trim());
    if (missing.length) throw new Error(`Chưa điền biến: ${missing.join(", ")}.`);
    return String(value).replace(/\{\{\s*([A-Za-z][A-Za-z0-9_-]{0,63})\s*\}\}/g, (match, name) => Object.hasOwn(variables, name) ? String(variables[name]).slice(0, 10000) : match);
  }
  function validatePromptImport(value) {
    const items = Array.isArray(value) ? value : value?.prompts;
    if (!Array.isArray(items) || !items.length || items.length > 100) throw new Error("JSON phải chứa 1–100 prompt trong mảng prompts.");
    return items.map((row, index) => {
      if (!row || typeof row.title !== "string" || !row.title.trim() || row.title.length > 180 || typeof row.content !== "string" || row.content.trim().length < 5 || row.content.length > 200000) throw new Error(`Prompt ${index + 1} không hợp lệ: cần tên và nội dung (tối đa 200.000 ký tự).`);
      if (row.tags != null && (!Array.isArray(row.tags) || row.tags.some(tag => typeof tag !== "string"))) throw new Error(`Tags của prompt ${index + 1} phải là mảng chuỗi.`);
      return { title: row.title.trim(), content: row.content, tags: (row.tags || []).map(tag => tag.trim().slice(0, 40)).filter(Boolean).slice(0, 20), favorite: row.favorite === true };
    });
  }
  function compareLines(before, after) {
    const oldLines = String(before).split("\n"), newLines = String(after).split("\n");
    if (oldLines.length > 4000 || newLines.length > 4000) throw new Error("So sánh giới hạn 4.000 dòng; xuất để dùng công cụ diff cho tài liệu lớn hơn.");
    let start = 0, endOld = oldLines.length, endNew = newLines.length;
    while (start < endOld && start < endNew && oldLines[start] === newLines[start]) start += 1;
    while (endOld > start && endNew > start && oldLines[endOld - 1] === newLines[endNew - 1]) { endOld -= 1; endNew -= 1; }
    if (start === endOld && start === endNew) return { added: 0, removed: 0, text: "Hai nội dung giống nhau." };
    const removed = oldLines.slice(start, endOld), added = newLines.slice(start, endNew);
    return { added: added.length, removed: removed.length, text: [`@@ từ dòng ${start + 1} · -${removed.length} / +${added.length} @@`, ...removed.map(line => `- ${line}`), ...added.map(line => `+ ${line}`)].join("\n") };
  }
  function validateVersionContent(value) {
    if (typeof value !== "string" || value.length > 200000 && (value.length > 500000 || new Blob([value]).size > 500000)) throw new Error("Nội dung vượt giới hạn snapshot: 500 KB UTF-8 hoặc định dạng cũ 200.000 ký tự. Hãy xuất bản đang sửa trước khi rời.");
    return value;
  }
  function versionContext(row) { return String(row?.sourceDocument || "local").slice(0, 200); }
  function renderVersionContext(host) { const node = host.querySelector("[data-tool-version-context]"); if (node) node.textContent = `Đang soạn nhóm: ${host.dataset.versionContext === "local" || !host.dataset.versionContext ? "Tài liệu riêng" : host.dataset.versionContext}. Khôi phục chỉ đổi nội dung ở đây, không mở/ghi workspace nguồn.`; }
  function renderVersionSelection(host) { const node = host.querySelector("[data-tool-version-selection]"); if (node) node.textContent = host._selectedVersions?.size ? `Đã chọn ${host._selectedVersions.size}/2: ${[...host._selectedVersions].map(id => host._versionLabels?.get(id) || id).join(" → ")}` : "Chưa chọn snapshot."; }
  function selectVersionPage(rows, { query = "", document = "all", sort = "newest", page = 0, size = 20 } = {}) {
    const filter = String(query).trim().toLocaleLowerCase(), count = size === 50 ? 50 : 20;
    const filtered = rows.filter(row => row?.type === "version" && (document === "all" || versionContext(row) === document) && (!filter || `${row.label || ""}\n${row.content || ""}`.toLocaleLowerCase().includes(filter)));
    filtered.sort((a, b) => sort === "label" ? String(a.label).localeCompare(String(b.label), "vi") : sort === "oldest" ? String(a.createdAt).localeCompare(String(b.createdAt)) : String(b.createdAt).localeCompare(String(a.createdAt)));
    const pages = Math.max(1, Math.ceil(filtered.length / count)), selected = Math.min(pages - 1, Math.max(0, Math.floor(Number(page) || 0)));
    return { rows: filtered.slice(selected * count, (selected + 1) * count), count: filtered.length, total: rows.length, page: selected, pages };
  }
  function renderVariables(host) {
    const panel = host.querySelector("[data-tool-variables]"); if (!panel) return;
    const previous = new Map([...panel.querySelectorAll("[data-prompt-variable]")].map(node => [node.dataset.promptVariable, node.value]));
    panel.innerHTML = promptVariables(getValue(host, "content")).map(name => `<label class="hh-tool__field"><span>${esc(name)}</span><input data-prompt-variable="${esc(name)}" value="${esc(previous.get(name) || "")}" placeholder="Giá trị cho ${esc(name)}"></label>`).join("") || '<p class="hh-tool__help">Mẫu không có biến. Viết {{topic}}, {{audience}}… để tái sử dụng.</p>';
  }
  function tabState(host, text) { const node = host.querySelector("[data-tool-save-state]"); if (node) node.textContent = text; }

  const BACKUP_RECORD_TYPES = new Set(["prompt", "code", "version", "workspace-tab", "tool-draft", "plugin", "widget", "dashboard", "document", "tool-folder"]);
  const backupId = value => typeof value === "string" && /^[A-Za-z0-9._-]{1,160}$/.test(value);
  const stripMetadata = row => { const { owner, localId, schema, ...data } = row; return data; };
  function normalizeWorkspaceData(payload) {
    if (!payload || payload.version !== 1 || !Array.isArray(payload.records) || !Array.isArray(payload.history) || !Array.isArray(payload.files) || !Array.isArray(payload.omittedFiles) || typeof payload.filesIncluded !== "boolean") throw new Error("Bản sao workspace không đúng định dạng.");
    if (payload.records.length > 1000 || payload.history.length > 2000 || payload.files.length > 100 || payload.omittedFiles.length > 1000) throw new Error("Bản sao có quá nhiều mục.");
    const cleanRecord = row => {
      if (!row || !backupId(row.id) || !BACKUP_RECORD_TYPES.has(row.type) || Object.hasOwn(row, "owner") || Object.hasOwn(row, "localId") || Object.hasOwn(row, "schema")) throw new Error("Mục bản sao không hợp lệ hoặc chứa thông tin tài khoản nội bộ.");
      const fields = new Set(["id", "type", "title", "content", "tags", "favorite", "updatedAt", "createdAt", "language", "label", "order", "pinned", "tool", "values", "output", "messages", "activeTab", "activeFile", "fileBaseUpdatedAt", "codeDocument", "sourceDocument", "promptId", "pluginId", "name", "version", "engine", "permissions", "enabled", "installedAt", "widgetId", "kind", "tasks", "count", "widgets", "subtitle", "versionPage", "versionContext"]);
      if (Object.keys(row).some(name => !fields.has(name))) throw new Error("Bản sao có trường workspace chưa được hỗ trợ.");
      for (const name of ["title", "label", "name"]) if (row[name] != null && (typeof row[name] !== "string" || row[name].length > 500)) throw new Error("Tên mục bản sao không hợp lệ.");
      if (row.sourceDocument != null && (typeof row.sourceDocument !== "string" || row.sourceDocument.length > 200)) throw new Error("Nhóm tài liệu nguồn không hợp lệ.");
      for (const name of ["createdAt", "updatedAt", "installedAt"]) if (row[name] != null && !Number.isFinite(new Date(row[name]).getTime())) throw new Error("Thời gian mục bản sao không hợp lệ.");
      if (row.content != null && (typeof row.content !== "string" || row.content.length > 200000 && !(row.type === "version" && row.content.length <= 500000 && new Blob([row.content]).size <= 500000))) throw new Error("Nội dung bản sao vượt giới hạn: tài liệu 200.000 ký tự, snapshot tệp bổ sung tối đa 500 KB UTF-8.");
      if (["code", "version", "workspace-tab", "document"].includes(row.type) && typeof row.content !== "string") throw new Error("Tài liệu bản sao thiếu nội dung.");
      if (row.type === "prompt") validatePromptImport([row]);
      if (row.type === "plugin") validatePlugin({ id: row.pluginId, name: row.name, version: row.version, engine: row.engine, permissions: row.permissions });
      if (row.type === "tool-draft" && (!byId.has(row.tool) || row.id !== `draft-${row.tool}` || !row.values || typeof row.values !== "object" || Array.isArray(row.values) || Object.entries(row.values).some(([name, value]) => !/^[a-z0-9-]{1,64}$/.test(name) || typeof value !== "string" || value.length > ((row.tool === "file-explorer" && name === "file-content" || row.tool === "version-history" && name === "document") ? 500000 : row.tool === "speech-to-text" && name === "subtitle-source" ? 300000 : 200000)))) throw new Error("Bản nháp tool không hợp lệ.");
      if (row.type === "tool-draft" && row.activeFile && (!backupId(row.activeFile) || row.tool !== "file-explorer")) throw new Error("Tệp trong bản nháp không hợp lệ.");
      if (row.type === "tool-draft" && row.fileBaseUpdatedAt && !Number.isFinite(new Date(row.fileBaseUpdatedAt).getTime())) throw new Error("Mốc bản nháp tệp không hợp lệ.");
      if (row.type === "tool-draft" && row.tool === "version-history" && row.values?.document != null) validateVersionContent(row.values.document);
      if (row.subtitle != null && (row.type !== "tool-draft" || row.tool !== "speech-to-text")) throw new Error("Timeline không thuộc tool này.");
      if (row.versionPage != null && (!Number.isInteger(row.versionPage) || row.versionPage < 0 || row.versionPage > 1000)) throw new Error("Trang lịch sử không hợp lệ.");
      if (row.versionContext != null && (typeof row.versionContext !== "string" || row.versionContext.length > 200)) throw new Error("Ngữ cảnh lịch sử không hợp lệ.");
      if (row.type === "tool-folder" && (typeof row.name !== "string" || !row.name.trim() || row.name.length > 100 || /[\\/]/.test(row.name))) throw new Error("Thư mục không hợp lệ.");
      if (row.type === "code" && !["javascript", "typescript", "json", "html", "css", "markdown"].includes(row.language)) throw new Error("Ngôn ngữ code không hợp lệ.");
      if (row.type === "dashboard" && (!Array.isArray(row.widgets) || row.widgets.length > 24)) throw new Error("Dashboard vượt giới hạn.");
      if (["widget", "dashboard"].includes(row.type)) for (const widget of row.type === "widget" ? [row] : row.widgets) {
        if (!widget || !backupId(widget.id) || !["notes", "checklist", "counter", "clock"].includes(widget.kind || widget.widgetId) || widget.content != null && (typeof widget.content !== "string" || widget.content.length > 200000) || widget.count != null && (!Number.isFinite(widget.count) || Math.abs(widget.count) > 1e9)) throw new Error("Widget trong bản sao không hợp lệ.");
        if (widget.tasks != null && (!Array.isArray(widget.tasks) || widget.tasks.length > 100 || widget.tasks.some(task => !task || !backupId(task.id) || typeof task.text !== "string" || task.text.length > 500 || typeof task.done !== "boolean"))) throw new Error("Checklist trong bản sao không hợp lệ.");
      }
      if (row.type === "tool-draft" && row.messages != null && (!Array.isArray(row.messages) || row.messages.length > 100 || row.messages.some(item => !item || !["user", "assistant"].includes(item.role) || typeof item.content !== "string" || item.content.length > 16000))) throw new Error("Hội thoại nháp không hợp lệ.");
      const clean = JSON.parse(JSON.stringify(row)); if (row.subtitle != null) clean.subtitle = normalizeSubtitleDraft(row.subtitle); return clean;
    };
    const records = payload.records.map(cleanRecord), ids = new Set(records.map(row => row.id));
    if (ids.size !== records.length) throw new Error("Bản sao có ID mục trùng.");
    const history = payload.history.map(row => {
      if (!row || !backupId(row.id) || !byId.has(row.tool) || typeof row.action !== "string" || row.action.length > 100 || !Number.isFinite(new Date(row.createdAt).getTime())) throw new Error("Lịch sử không hợp lệ.");
      return { id: row.id, tool: row.tool, action: row.action, summary: String(row.summary || "").slice(0, 160), createdAt: new Date(row.createdAt).toISOString() };
    });
    if (new Set(history.map(row => row.id)).size !== history.length) throw new Error("ID lịch sử trùng.");
    let bytes = 0;
    const files = payload.files.map(row => {
      if (!payload.filesIncluded || !row || !backupId(row.id) || typeof row.name !== "string" || !row.name || row.name.length > 180 || /[\\/]/.test(row.name) || typeof row.type !== "string" || row.type.length > 100 || typeof row.data !== "string" || row.data.length > 1400000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(row.data)) throw new Error("Tệp trong bản sao không hợp lệ.");
      const binary = atob(row.data); bytes += binary.length; if (binary.length > 1048576 || bytes > 2097152 || binary.length !== row.size) throw new Error("Tệp vượt 1 MB/tệp hoặc tổng 2 MB, hoặc sai kích thước.");
      if (row.folderId && !backupId(row.folderId)) throw new Error("Thư mục tệp không hợp lệ.");
      return { id: row.id, name: row.name, type: row.type, size: row.size, data: row.data, folderId: row.folderId || "", createdAt: String(row.createdAt || "").slice(0, 40), updatedAt: String(row.updatedAt || "").slice(0, 40) };
    });
    if (new Set(files.map(row => row.id)).size !== files.length) throw new Error("ID tệp trùng.");
    const omittedFiles = payload.omittedFiles.map(row => { if (!row || !backupId(row.id)) throw new Error("Mục bỏ qua không hợp lệ."); return { id: row.id, name: String(row.name || "").slice(0, 180), reason: String(row.reason || "").slice(0, 100) }; });
    return { version: 1, records, history, files, filesIncluded: payload.filesIncluded, omittedFiles };
  }
  async function exportWorkspaceData({ owner, includeFiles = false, maxBytes = 4194304 }) {
    const records = (await storage.list("records", () => true, owner)).map(stripMetadata), history = (await storage.list("history", () => true, owner)).map(row => ({ id: row.id, tool: row.tool, action: row.action, summary: String(row.summary || "").slice(0, 160), createdAt: row.createdAt }));
    const savedFiles = await storage.list("files", () => true, owner), files = [], omittedFiles = []; let bytes = 0;
    for (const row of savedFiles) {
      if (!includeFiles || row.size > 1048576 || bytes + row.size > 2097152) { omittedFiles.push({ id: row.id, name: row.name, reason: !includeFiles ? "Không chọn kèm tệp" : "Giới hạn 1 MB/tệp, tổng 2 MB" }); continue; }
      const data = bytesToBase64(new Uint8Array(await row.blob.arrayBuffer())); bytes += row.size;
      files.push({ id: row.id, name: row.name, type: row.type, folderId: row.folderId || "", size: row.size, data, createdAt: row.createdAt, updatedAt: row.updatedAt });
    }
    const result = normalizeWorkspaceData({ version: 1, records, history, files, filesIncluded: includeFiles, omittedFiles });
    if (new Blob([JSON.stringify(result)]).size > maxBytes) throw new Error("Workspace vượt dung lượng bản sao; xuất riêng từng tài liệu hoặc giảm lịch sử trước.");
    return result;
  }
  async function importWorkspaceData(payload, { owner, strategy = "merge" }) {
    const data = normalizeWorkspaceData(payload);
    if (!["merge", "skip", "replace"].includes(strategy)) throw new Error("Cách nhập workspace không hợp lệ.");
    const incoming = { records: data.records, history: data.history, files: data.files.map(row => { const binary = atob(row.data), { data: encoded, ...metadata } = row; return { ...metadata, blob: new Blob([Uint8Array.from(binary, char => char.charCodeAt(0))], { type: row.type }) }; }) };
    const storedRow = row => ({ ...row, id: scopedId(row.id, owner), localId: row.id, owner, schema: 2 });
    const apply = (existing, deleteRow, putRow) => {
      const referencedFolders = new Set(existing.files.map(row => row.folderId).filter(Boolean));
      for (const name of ["records", "history", "files"]) {
        const keepIds = new Set(incoming[name].map(row => row.id));
        if (name === "files") data.omittedFiles.forEach(row => keepIds.add(row.id));
        if (strategy === "replace" && (name !== "files" || data.filesIncluded)) for (const row of existing[name]) {
          const id = row.localId;
          if (name === "files" && keepIds.has(id)) continue;
          if (name === "records" && row.type === "tool-folder" && referencedFolders.has(id) && !keepIds.has(id)) continue;
          deleteRow(name, row.id);
        }
        for (const row of incoming[name]) { if (strategy === "skip" && existing[name].some(item => item.localId === row.id)) continue; putRow(name, storedRow(row)); }
      }
    };
    const db = await openDb();
    if (!db) {
      if (globalThis.indexedDB) throw new Error("IndexedDB chưa mở được. Chưa nhập bản sao.");
      const saved = Object.fromEntries(Object.entries(memory).map(([name, rows]) => [name, new Map(rows)]));
      try { apply(Object.fromEntries(Object.entries(memory).map(([name, rows]) => [name, [...rows.values()].filter(row => row.owner === owner)])), (name, id) => memory[name].delete(id), (name, row) => memory[name].set(row.id, structuredCloneSafe(row))); }
      catch (error) { for (const name of Object.keys(memory)) memory[name] = saved[name]; throw error; } return;
    }
    await new Promise((resolve, reject) => {
      const tx = db.transaction(["records", "history", "files"], "readwrite"), existing = {}; let loaded = 0;
      for (const name of ["records", "history", "files"]) {
        const request = tx.objectStore(name).getAll(); request.onsuccess = () => {
          existing[name] = request.result.filter(row => row.owner === owner); loaded += 1;
          if (loaded === 3) try { if (globalThis.HHAllToolState?.accountScope && globalThis.HHAllToolState.accountScope() !== owner) throw new Error("Tài khoản đã đổi; hủy nhập."); apply(existing, (store, id) => tx.objectStore(store).delete(id), (store, row) => tx.objectStore(store).put(row)); } catch (error) { tx._importError = error; tx.abort(); }
        };
      }
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => {};
      tx.onabort = () => { db.close(); reject(tx._importError || tx.error || new Error("Nhập bản sao thất bại; giao dịch đã hoàn tác, dữ liệu cũ giữ nguyên.")); };
    });
  }
  function registerWorkspaceBackup() {
    globalThis.HHAllToolState?.registerBackupScope?.("workspace", { export: exportWorkspaceData, normalize: normalizeWorkspaceData, import: importWorkspaceData, history: async ({ owner, limit }) => (await storage.list("history", () => true, owner)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit).map(row => ({ id: row.id, tool: row.tool, action: row.action, at: row.createdAt })) });
  }

  function draftSnapshot(host, manifest) {
    const values = {};
    host.querySelectorAll("[data-tool-input]").forEach(node => { if (node.type !== "file" && node.type !== "password") { const name = node.dataset.toolInput, value = String(node.value || ""); if (manifest.id === "file-explorer" && name === "file-content") { if (new Blob([value]).size > 500000) throw new Error("Bản nháp tệp vượt 500 KB; chưa lưu. Xuất bản nháp trước khi rời."); values[name] = value; } else if (manifest.id === "version-history" && name === "document") { validateVersionContent(value); values[name] = value; } else if (manifest.id === "speech-to-text" && name === "subtitle-source") { if (value.length > 300000 || new Blob([value]).size > 1048576) throw new Error("Nguồn phụ đề vượt 300.000 ký tự hoặc 1 MB; chưa lưu bản nháp nguồn."); values[name] = value; } else values[name] = value.slice(0, 200000); } });
    const result = host.querySelector("[data-tool-output]")?.textContent || "";
    const messages = host.querySelector("[data-tool-messages]") ? [...host.querySelectorAll("[data-tool-messages] > .is-user, [data-tool-messages] > .is-assistant")].slice(-100).map(node => ({ role: node.classList.contains("is-user") ? "user" : "assistant", content: node.textContent.slice(0, 16000) })) : [];
    return { id: `draft-${manifest.id}`, type: "tool-draft", tool: manifest.id, values, output: result.slice(0, 200000), messages, activeTab: host.dataset.activeTab || "", activeFile: manifest.id === "file-explorer" ? host.dataset.activeFile || "" : "", fileBaseUpdatedAt: manifest.id === "file-explorer" ? host._fileBaseUpdatedAt || "" : "", codeDocument: host.dataset.codeDocument || "", promptId: host.dataset.promptId || "", ...(manifest.id === "speech-to-text" ? { subtitle: normalizeSubtitleDraft({ version: 1, origin: active.subtitleOrigin, cues: active.subtitleCues }) } : {}), ...(manifest.id === "version-history" ? { versionPage: host._versionPage || 0, versionContext: host.dataset.versionContext || "local" } : {}), updatedAt: new Date().toISOString() };
  }
  async function saveDraft(host, manifest, snapshot = draftSnapshot(host, manifest)) {
    return storage.put("records", snapshot, scopeFor(host));
  }
  function scheduleDraft(host, manifest) {
    if (host._draftTimer) { clearTimeout(host._draftTimer); active.timers.delete(host._draftTimer); }
    host._draftTimer = setTimeout(() => { active.timers.delete(host._draftTimer); host._draftTimer = null; if (!live(host)) return; try { const snapshot = draftSnapshot(host, manifest); if (manifest.id === "monaco-code-editor") snapshot.values.code = editorValue(host); saveDraft(host, manifest, snapshot).catch(error => notice(host, error.message, "error")); } catch (error) { notice(host, error.message, "error"); } }, 400);
    active.timers.add(host._draftTimer);
  }
  async function saveCurrentTab(host) {
    const owner = scopeFor(host), id = host.dataset.activeTab;
    if (!id) return;
    const title = getValue(host, "title").trim() || "Không tên", content = getValue(host, "document");
    const row = await storage.get("records", id, owner);
    if (row) { await storage.put("records", { ...row, title, content, updatedAt: new Date().toISOString() }, owner); host._tabDirty = false; tabState(host, `Đã lưu ${nowLabel()}`); }
  }
  function updateWidget(host, article, transform, rerender = true) {
    const owner = scopeFor(host), epoch = active.epoch;
    const queued = (host._widgetQueue || Promise.resolve()).catch(() => {}).then(() => updateWidgetNow(host, article, transform, rerender, owner, epoch));
    host._widgetQueue = queued; return queued;
  }
  async function updateWidgetNow(host, article, transform, rerender, owner, epoch) {
    const prefix = article?.dataset.widgetPrefix;
    if (prefix === "market") {
      const record = await storage.get("records", `widget-${article.dataset.widgetId}`, owner);
      if (!record) throw new Error("Widget chưa được cài."); transform(record);
      await storage.put("records", record, owner); if (rerender && live(host, epoch)) await renderMarketplace(host);
    } else {
      const record = await storage.get("records", "dashboard-layout", owner), widgets = structuredCloneSafe(Array.isArray(record?.widgets) ? record.widgets : DEFAULT_DASHBOARD), row = widgets.find(item => item.id === article?.dataset.dashboardId);
      if (!row) throw new Error("Widget không còn tồn tại."); transform(row);
      await storage.put("records", { id: "dashboard-layout", type: "dashboard", widgets, updatedAt: new Date().toISOString() }, owner); if (rerender && live(host, epoch)) await renderDashboard(host);
    }
  }
  async function restoreDraft(host, manifest) {
    const epoch = active.epoch;
    const draft = await storage.get("records", `draft-${manifest.id}`, scopeFor(host));
    if (!live(host, epoch) || !draft) return;
    // Tabs and Auto Save have their own authoritative document records.
    if (!["workspace-tabs", "auto-save"].includes(manifest.id)) for (const [name, value] of Object.entries(draft.values || {})) { const node = getInput(host, name); if (node) node.value = value; }
    if (draft.output) setOutput(host, draft.output);
    const messages = host.querySelector("[data-tool-messages]");
    if (messages && Array.isArray(draft.messages)) messages.insertAdjacentHTML("beforeend", draft.messages.filter(row => ["user", "assistant"].includes(row.role)).map(row => `<div class="is-${row.role}">${esc(row.content)}</div>`).join(""));
    if (manifest.id === "workspace-tabs" && draft.activeTab) {
      const row = await storage.get("records", draft.activeTab, scopeFor(host));
      if (!live(host, epoch)) return;
      if (row?.type === "workspace-tab") {
        await renderTabs(host, row.id); if (!live(host, epoch) || host.dataset.activeTab !== row.id) return;
        if ((new Date(draft.updatedAt).getTime() || 0) >= (new Date(row.updatedAt).getTime() || 0) && typeof draft.values?.document === "string" && typeof draft.values?.title === "string") {
          getInput(host, "title").value = draft.values.title; getInput(host, "document").value = draft.values.document;
          host._tabDirty = draft.values.title !== row.title || draft.values.document !== row.content;
          if (host._tabDirty) tabState(host, "Đã khôi phục bản nháp chưa lưu · nhấn Lưu hoặc chuyển tab để giữ vào tài liệu.");
        }
      }
    }
    if (manifest.id === "file-explorer" && draft.activeFile) {
      const row = await storage.get("files", draft.activeFile, scopeFor(host)); if (!live(host, epoch)) return;
      if (row) {
        await previewFile(host, row.id); if (!live(host, epoch)) return;
        const editor = getInput(host, "file-content");
        if (editor && typeof draft.values?.["file-content"] === "string") editor.value = draft.values["file-content"];
        for (const name of ["rename", "file-destination"]) if (getInput(host, name) && typeof draft.values?.[name] === "string") getInput(host, name).value = draft.values[name];
        host._fileBaseUpdatedAt = draft.fileBaseUpdatedAt || row.updatedAt;
        fileEditState(host);
        if (fileHasDirtyEdits(host) && host._fileBaseUpdatedAt !== row.updatedAt) notice(host, "Tệp đã đổi từ khi tạo bản nháp. Bản nháp được giữ; xuất hoặc bỏ thay đổi để đọc bản lưu mới. Không tự ghi đè.", "warning");
      }
    }
    if (manifest.id === "ai-prompt-library" && draft.promptId) { const row = await storage.get("records", draft.promptId, scopeFor(host)); if (live(host, epoch) && row?.type === "prompt") host.dataset.promptId = row.id; }
    if (manifest.id === "speech-to-text" && draft.subtitle) { const restored = normalizeSubtitleDraft(draft.subtitle); active.subtitleCues = restored.cues; active.subtitleOrigin = restored.origin; }
    if (manifest.id === "version-history") { host._versionPage = Math.min(1000, Math.max(0, Number(draft.versionPage) || 0)); host.dataset.versionContext = draft.versionContext || "local"; }
    if (manifest.id === "monaco-code-editor" && draft.codeDocument) { const row = await storage.get("records", draft.codeDocument, scopeFor(host)); if (!live(host, epoch)) return; if (row?.type === "code") host.dataset.codeDocument = row.id; await renderCodeDocuments(host); }
  }

  function formatSegments(segments, kind) {
    if (!Array.isArray(segments) || !segments.length) return "";
    const stamp = seconds => {
      const total = Math.round(Math.max(0, Number(seconds) || 0) * 1000), hours = Math.floor(total / 3600000), minutes = Math.floor(total % 3600000 / 60000), secs = Math.floor(total % 60000 / 1000), millis = total % 1000;
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}${kind === "vtt" ? "." : ","}${String(millis).padStart(3, "0")}`;
    };
    const rows = segments.map((segment, index) => `${kind === "srt" ? `${index + 1}\n` : ""}${stamp(segment.start)} --> ${stamp(segment.end)}\n${segment.speaker ? `[${segment.speaker}] ` : ""}${segment.text || ""}`).join("\n\n");
    return kind === "vtt" ? `WEBVTT\n\n${rows}` : rows;
  }

  function subtitleMarkup() {
    return `<section class="hh-tool__timeline"><header><div><small>SUBTITLE STUDIO · XỬ LÝ CỤC BỘ</small><h4>Biên tập phụ đề theo thời gian</h4></div><span data-tool-subtitle-origin>Timeline thủ công · chưa có cue.</span></header><div class="hh-tool__form">${field("Dán SRT / WebVTT", textArea("subtitle-source", "Dán phụ đề có timestamp; không gửi lên máy chủ…"))}<div class="hh-tool__actions"><label class="hh-tool__file-button">Chọn SRT/VTT<input type="file" accept=".srt,.vtt,text/vtt,application/x-subrip,text/plain" data-tool-subtitle-file></label>${button("subtitle-import", "Nhập phụ đề đã dán")}${button("subtitle-from-transcript", "Chuyển bản chép → mốc ước lượng")}${button("subtitle-add", "Thêm cue")}${button("subtitle-sort", "Sắp theo thời gian")}${button("subtitle-validate", "Kiểm tra timeline")}${button("subtitle-clear", "Xóa timeline")}</div><p class="hh-tool__help">Tối đa 300 cue, tổng 200.000 ký tự, khoảng thời gian 0–24 giờ. Mốc chuyển từ bản chép là ước lượng 4 giây/câu, không phải timestamp đo từ audio. Engine hỗ trợ SRT và cue văn bản WebVTT cơ bản; STYLE/REGION và cue settings cần công cụ chuyên dụng. Timeline có thứ tự/không chồng lấn mới được xuất; các định dạng có chủ ý chồng lấn cần sửa hoặc dùng editor hỗ trợ riêng.</p><div data-tool-subtitle-validation role="status" aria-live="polite"></div><div data-tool-subtitle-cues></div></div></section>`;
  }
  function parseSubtitleTime(value) {
    const match = String(value).match(/^(?:(\d{2,}):)?([0-5]\d):([0-5]\d)[.,](\d{3})$/);
    if (!match) throw new Error(`Timestamp không hợp lệ: ${String(value).slice(0, 50)}.`);
    const seconds = (Number(match[1]) || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
    if (seconds > 86400) throw new Error("Timestamp vượt 24 giờ."); return seconds;
  }
  function normalizeSubtitleDraft(value) {
    if (!value || value.version !== 1 || !["manual", "srt", "vtt", "approximate"].includes(value.origin) || !Array.isArray(value.cues) || value.cues.length > 300) throw new Error("Bản nháp phụ đề không hợp lệ.");
    let count = 0;
    const cues = value.cues.map((row, index) => {
      if (!row || !backupId(row.id) || !["string", "number"].includes(typeof row.start) || !["string", "number"].includes(typeof row.end) || String(row.start).length > 24 || String(row.end).length > 24 || typeof row.text !== "string" || row.text.length > 4000) throw new Error(`Cue ${index + 1} vượt giới hạn hoặc sai dữ liệu.`);
      count += row.text.length; if (count > 200000) throw new Error("Phụ đề vượt tổng 200.000 ký tự.");
      return { id: row.id, start: String(row.start), end: String(row.end), text: row.text };
    });
    if (new Set(cues.map(row => row.id)).size !== cues.length) throw new Error("ID cue trùng nhau.");
    return { version: 1, origin: value.origin, cues };
  }
  function validateSubtitleCues(cues) {
    const safe = normalizeSubtitleDraft({ version: 1, origin: "manual", cues }), errors = [], normalized = [];
    let previousEnd = 0;
    for (const [index, row] of safe.cues.entries()) {
      const start = Number(row.start), end = Number(row.end), ordinal = index + 1;
      if (!String(row.start).trim() || !String(row.end).trim() || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > 86400 || end <= start || Math.abs(start * 1000 - Math.round(start * 1000)) > 1e-6 || Math.abs(end * 1000 - Math.round(end * 1000)) > 1e-6) errors.push(`Cue ${ordinal}: bắt đầu/kết thúc cần nằm trong 0–24h, tối đa 3 chữ số thập phân và kết thúc lớn hơn bắt đầu.`);
      else { if (start < previousEnd) errors.push(`Cue ${ordinal}: sai thứ tự hoặc chồng lấn cue trước (kết thúc ${previousEnd.toFixed(3)} giây).`); previousEnd = end; }
      if (!row.text.trim() || /\n\s*\n/.test(row.text)) errors.push(`Cue ${ordinal}: cần nội dung và không có dòng trắng ngắt cue.`);
      normalized.push({ ...row, start, end, text: row.text.trim() });
    }
    if (!safe.cues.length) errors.push("Timeline chưa có cue.");
    return { ok: errors.length === 0, errors, cues: normalized };
  }
  function parseSubtitles(value) {
    const source = String(value).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
    if (!source || source.length > 300000 || new Blob([source]).size > 1048576) throw new Error("Nguồn phụ đề cần nội dung, tối đa 300.000 ký tự/1 MB; phần nội dung cue tối đa 200.000 ký tự.");
    const blocks = source.split(/\n\s*\n/), kind = /^WEBVTT(?:\s|$)/.test(blocks[0]) ? "vtt" : "srt", cues = [], warnings = [];
    if (kind === "vtt") { if (blocks[0].split("\n").length > 1 || blocks[0].includes("-->")) throw new Error("Header WebVTT không hợp lệ hoặc chứa metadata chưa hỗ trợ."); blocks.shift(); }
    for (const block of blocks) {
      const lines = block.trim().split("\n"); if (kind === "vtt" && /^NOTE(?:\s|$)/.test(lines[0])) { warnings.push("Bỏ comment NOTE khi xuất lại."); continue; }
      if (kind === "vtt" && /^(STYLE|REGION)(?:\s|$)/.test(lines[0])) throw new Error("Chưa hỗ trợ STYLE/REGION; không nhập một phần hoặc âm thầm bỏ định dạng.");
      const timingIndex = lines[0].includes("-->") ? 0 : 1, timing = lines[timingIndex]?.match(/^(\S+)\s+-->\s+(\S+)(.*)$/);
      if (!timing || timing[3].trim()) throw new Error(`Cue ${cues.length + 1}: thiếu timestamp hoặc có cue settings chưa hỗ trợ.`);
      if (kind === "srt" && timingIndex === 1 && !/^\d+$/.test(lines[0])) throw new Error(`Cue SRT ${cues.length + 1}: số thứ tự không hợp lệ.`);
      cues.push({ id: uid("cue"), start: String(parseSubtitleTime(timing[1])), end: String(parseSubtitleTime(timing[2])), text: lines.slice(timingIndex + 1).join("\n") });
      if (cues.length > 300) throw new Error("Phụ đề vượt 300 cue.");
    }
    const draft = normalizeSubtitleDraft({ version: 1, origin: kind, cues }); if (!cues.length) throw new Error("Không có cue phụ đề để nhập.");
    return { ...draft, warnings: [...new Set(warnings)] };
  }
  function subtitleValidation(host) {
    const result = validateSubtitleCues(active.subtitleCues), node = host.querySelector("[data-tool-subtitle-validation]");
    if (node) { node.textContent = result.ok ? `Hợp lệ · ${result.cues.length} cue · thời gian do người dùng nhập/chỉnh.` : result.errors.join("\n"); node.className = result.ok ? "is-valid" : "is-invalid"; }
    return result;
  }
  function renderSubtitleTimeline(host) {
    const panel = host.querySelector("[data-tool-subtitle-cues]"); if (!panel) return;
    panel.innerHTML = active.subtitleCues.map((row, index) => `<article data-subtitle-cue="${esc(row.id)}"><header><strong>Cue ${index + 1}</strong><div>${button("subtitle-up", "Trước")}${button("subtitle-down", "Sau")}${button("subtitle-delete", "Xóa cue")}</div></header><div class="hh-tool__cue-times"><label>Bắt đầu (giây)<input data-subtitle-field="start" type="number" min="0" max="86400" step="0.001" value="${esc(row.start)}" aria-label="Cue ${index + 1} bắt đầu"></label><label>Kết thúc (giây)<input data-subtitle-field="end" type="number" min="0" max="86400" step="0.001" value="${esc(row.end)}" aria-label="Cue ${index + 1} kết thúc"></label></div><label>Nội dung<textarea data-subtitle-field="text" maxlength="4000" aria-label="Cue ${index + 1} nội dung">${esc(row.text)}</textarea></label></article>`).join("") || '<div class="hh-tool__empty">Nhập SRT/VTT, thêm cue hoặc chuyển bản chép thành mốc ước lượng.</div>';
    const origin = host.querySelector("[data-tool-subtitle-origin]"); if (origin) origin.textContent = `${({ manual: "Timeline thủ công", srt: "Nhập SRT", vtt: "Nhập WebVTT", approximate: "Mốc ước lượng · không đo audio" })[active.subtitleOrigin]} · ${active.subtitleCues.length} cue`;
    subtitleValidation(host);
  }

  async function renderCollection(host, type) {
    const epoch = active.epoch;
    const list = host.querySelector("[data-tool-list]");
    if (!list) return;
    if (type === "prompts") {
      const query = getValue(host, "prompt-filter").trim().toLocaleLowerCase(), favorites = getValue(host, "prompt-favorites") === "favorites";
      const rows = (await storage.list("records", row => row.type === "prompt" && (!favorites || row.favorite) && (!query || `${row.title} ${row.content} ${(row.tags || []).join(" ")}`.toLocaleLowerCase().includes(query)))).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      if (!live(host, epoch)) return;
      list.innerHTML = rows.length ? rows.map(row => `<article data-record-id="${esc(row.id)}"><header><strong>${row.favorite ? "★ " : ""}${esc(row.title)}</strong><span>${esc((row.tags || []).join(" · "))}</span></header><p>${esc(row.content.slice(0, 500))}${row.content.length > 500 ? "…" : ""}</p><footer>${button("use-prompt", "Mở & sửa")}${button("favorite-prompt", row.favorite ? "Bỏ yêu thích" : "Yêu thích")}${button("duplicate-prompt", "Nhân bản")}${button("delete-record", "Xóa")}</footer></article>`).join("") : `<div class="hh-tool__empty">${query || favorites ? "Không có prompt khớp bộ lọc." : "Chưa có prompt. Tạo prompt đầu tiên ở bên trái."}</div>`;
    }
    if (type === "versions") {
      const revision = (host._versionRenderRevision || 0) + 1; host._versionRenderRevision = revision;
      const rows = await storage.list("records", row => row.type === "version", scopeFor(host)); if (!live(host, epoch) || host._versionRenderRevision !== revision) return;
      const contextSelect = getInput(host, "version-document"), current = contextSelect?.value || "all", contexts = [...new Set(rows.map(versionContext))].sort((a, b) => a.localeCompare(b));
      if (contextSelect) { contextSelect.innerHTML = '<option value="all">Tất cả nhóm</option>' + contexts.map(id => `<option value="${esc(id)}">${esc(id === "local" ? "Tài liệu riêng" : id)}</option>`).join(""); contextSelect.value = contexts.includes(current) ? current : "all"; }
      const result = selectVersionPage(rows, { query: getValue(host, "version-filter"), document: getValue(host, "version-document") || "all", sort: getValue(host, "version-sort"), page: host._versionPage, size: Number(getValue(host, "version-page-size")) }); host._versionPage = result.page; host._versionPages = result.pages;
      host._selectedVersions ||= new Set(); for (const id of host._selectedVersions) if (!rows.some(row => row.id === id)) host._selectedVersions.delete(id);
      host._versionLabels = new Map(rows.map(row => [row.id, row.label]));
      list.innerHTML = result.rows.length ? result.rows.map(row => `<article data-record-id="${esc(row.id)}"><header><label class="hh-tool__version-check"><input type="checkbox" data-version-select="${esc(row.id)}" ${host._selectedVersions.has(row.id) ? "checked" : ""} aria-label="Chọn snapshot ${esc(row.label)}"><strong>${esc(row.label)}</strong></label><span>${esc(nowLabel(row.createdAt))}</span></header><small>${esc(versionContext(row) === "local" ? "Tài liệu riêng" : versionContext(row))} · ${row.content.length.toLocaleString("vi")} ký tự</small><p>${esc(row.content.slice(0, 180))}</p><label class="hh-tool__field"><span>Đổi nhãn snapshot</span><input data-version-label maxlength="180" value="${esc(host._versionLabelDrafts?.get(row.id) ?? row.label)}" aria-label="Nhãn snapshot ${esc(row.label)}"></label><footer>${button("rename-version", "Lưu nhãn")}${button("compare-version", "So với bản đang sửa")}${button("restore-version", "Khôi phục")}${button("delete-record", "Xóa")}</footer></article>`).join("") : `<div class="hh-tool__empty">${rows.length ? "Không có snapshot khớp bộ lọc." : "Chưa có phiên bản."}</div>`;
      const pageNode = host.querySelector("[data-tool-version-page]"); if (pageNode) pageNode.textContent = `Trang ${result.page + 1}/${result.pages} · ${result.count}/${result.total} snapshot khớp`;
      const previous = host.querySelector('[data-tool-action="version-prev"]'), next = host.querySelector('[data-tool-action="version-next"]'); if (previous) previous.disabled = result.page === 0; if (next) next.disabled = result.page >= result.pages - 1;
      renderVersionSelection(host);
      renderVersionContext(host);
    }
    if (type === "plugins") {
      const rows = await storage.list("records", row => row.type === "plugin");
      if (!live(host, epoch)) return;
      list.innerHTML = rows.length ? rows.map(row => `<article data-record-id="${esc(row.id)}"><header><strong>${esc(row.name)}</strong><span>v${esc(row.version)}</span></header><p>Engine: ${esc(row.engine || "Chưa được duyệt; cần nhập lại manifest")} · ${row.enabled ? "Đang bật" : "Đã tắt"}</p><footer>${button("toggle-plugin", row.enabled ? "Tắt" : "Bật")}${button("run-plugin", "Chạy văn bản")}${button("delete-record", "Gỡ")}</footer></article>`).join("") : '<div class="hh-tool__empty">Chưa có plugin. Nhập manifest với engine được duyệt để bắt đầu.</div>';
    }
  }

  const MARKET_WIDGETS = [
    { id: "notes", name: "Ghi chú nhanh", category: "productivity", permissions: [], description: "Soạn ghi chú tự lưu, không nối với ghi chú của workspace khác." },
    { id: "checklist", name: "Checklist", category: "productivity", permissions: [], description: "Thêm việc, đánh dấu hoàn thành và xóa từng việc." },
    { id: "counter", name: "Bộ đếm", category: "analytics", permissions: [], description: "Tăng, giảm hoặc đặt lại bộ đếm do bạn nhập." },
    { id: "clock", name: "Đồng hồ thiết bị", category: "productivity", permissions: [], description: "Giờ thực của thiết bị; không giả lập người dùng hay quota." }
  ];

  function widgetContent(item, prefix) {
    if (item.kind === "notes") return `<textarea data-widget-content="${esc(item.id)}" data-widget-prefix="${prefix}" aria-label="Ghi chú ${esc(item.title)}" placeholder="Ghi chú của bạn...">${esc(item.content || "")}</textarea>`;
    if (item.kind === "checklist") return `<ul class="hh-tool__checklist">${(item.tasks || []).map(task => `<li><label><input type="checkbox" data-widget-task="${esc(task.id)}" data-widget-owner="${esc(item.id)}" data-widget-prefix="${prefix}" ${task.done ? "checked" : ""}>${esc(task.text)}</label><button type="button" data-tool-action="delete-widget-task" data-task-id="${esc(task.id)}" aria-label="Xóa ${esc(task.text)}">×</button></li>`).join("")}</ul><input data-widget-task-input="${esc(item.id)}" placeholder="Việc cần làm" aria-label="Việc mới">${button("add-widget-task", "Thêm việc")}`;
    if (item.kind === "counter") return `<strong data-widget-count>${Number(item.count) || 0}</strong><div class="hh-tool__actions">${button("counter-down", "Giảm 1")}${button("counter-up", "Tăng 1")}${button("counter-reset", "Đặt lại")}</div>`;
    if (item.kind === "clock") return `<time data-widget-clock>${esc(new Date().toLocaleTimeString("vi-VN"))}</time><small>Giờ từ thiết bị · không gửi dữ liệu</small>`;
    return '<p class="hh-tool__help">Widget cũ chưa có engine. Xóa và thêm một loại được hỗ trợ.</p>';
  }

  async function renderMarketplace(host) {
    const epoch = active.epoch;
    const list = host.querySelector("[data-tool-list]"); if (!list) return;
    const installed = await storage.list("records", row => row.type === "widget");
    if (!live(host, epoch)) return;
    const ids = new Set(installed.map(row => row.widgetId));
    const filter = getValue(host, "filter").toLowerCase(), category = getValue(host, "category") || "all";
    const rows = MARKET_WIDGETS.filter(row => (!filter || row.name.toLowerCase().includes(filter)) && (category === "all" || row.category === category));
    list.innerHTML = rows.map(row => { const saved = installed.find(item => item.widgetId === row.id); return `<article data-widget-id="${row.id}" data-widget-prefix="market"><span>${esc(row.category)}</span><h4>${esc(row.name)}</h4><p>${esc(row.description)}</p>${saved ? widgetContent({ ...saved, title: row.name, kind: row.id }, "market") : ""}${button(ids.has(row.id) ? "remove-widget-market" : "install-widget", ids.has(row.id) ? "Gỡ widget" : "Cài và sử dụng", ids.has(row.id) ? "" : "is-primary")}</article>`; }).join("") || '<div class="hh-tool__empty">Không có widget khớp bộ lọc.</div>';
  }

  const DEFAULT_DASHBOARD = [
    { id: "plan", title: "Ghi chú hôm nay", kind: "notes", content: "" },
    { id: "tasks", title: "Việc cần làm", kind: "checklist", tasks: [] },
    { id: "clock", title: "Đồng hồ", kind: "clock" }
  ];
  async function renderDashboard(host) {
    const epoch = active.epoch;
    const record = await storage.get("records", "dashboard-layout");
    if (!live(host, epoch)) return;
    const widgets = Array.isArray(record?.widgets) ? record.widgets : DEFAULT_DASHBOARD;
    const board = host.querySelector("[data-tool-dashboard]"); if (!board) return;
    board.innerHTML = widgets.map((item, index) => `<article draggable="true" data-dashboard-id="${esc(item.id)}" data-widget-prefix="dashboard" data-dashboard-index="${index}" class="${item.size === "wide" ? "is-wide" : ""}"><span>Kéo để sắp xếp</span><h4>${esc(item.title)}</h4>${widgetContent(item, "dashboard")}<footer>${button("move-widget-left", "Trước")}${button("move-widget-right", "Sau")}${button("resize-dashboard-widget", item.size === "wide" ? "Thu nhỏ" : "Mở rộng")}${button("remove-dashboard-widget", "Xóa")}</footer></article>`).join("") || '<div class="hh-tool__empty">Dashboard trống. Thêm widget để bắt đầu.</div>';
    board.querySelectorAll("[draggable]").forEach(card => {
      card.addEventListener("dragstart", event => event.dataTransfer.setData("text/plain", card.dataset.dashboardIndex));
      card.addEventListener("dragover", event => event.preventDefault());
      card.addEventListener("drop", event => { event.preventDefault(); const from = Number(event.dataTransfer.getData("text/plain")), to = Number(card.dataset.dashboardIndex); moveDashboard(host, from, to).catch(error => notice(host, error.message, "error")); });
    });
  }
  async function moveDashboard(host, from, to) {
    const epoch = active.epoch;
    const record = await storage.get("records", "dashboard-layout");
    if (!live(host, epoch)) return;
    const widgets = structuredCloneSafe(Array.isArray(record?.widgets) ? record.widgets : DEFAULT_DASHBOARD);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= widgets.length || to >= widgets.length || from === to) return;
    active.dashboardUndo.push(structuredCloneSafe(widgets)); active.dashboardUndo = active.dashboardUndo.slice(-20);
    const [item] = widgets.splice(from, 1); widgets.splice(to, 0, item);
    await storage.put("records", { id: "dashboard-layout", type: "dashboard", widgets, updatedAt: new Date().toISOString() });
    await renderDashboard(host);
  }

  async function renderTabs(host, selectedId) {
    const epoch = active.epoch;
    let tabs = (await storage.list("records", row => row.type === "workspace-tab")).sort((a, b) => Number(b.pinned) - Number(a.pinned) || (Number(a.order) || 0) - (Number(b.order) || 0) || a.createdAt.localeCompare(b.createdAt));
    if (!live(host, epoch)) return;
    if (!tabs.length) {
      const first = { id: uid("tab"), type: "workspace-tab", title: "Tài liệu mới", content: "", pinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      await storage.put("records", first); tabs = [first];
    }
    if (!live(host, epoch)) return;
    const selected = tabs.find(row => row.id === selectedId) || tabs[0];
    host.dataset.activeTab = selected.id;
    const tabbar = host.querySelector("[data-tool-tabs]");
    tabbar.innerHTML = tabs.map(row => `<button type="button" role="tab" aria-selected="${row.id === selected.id}" data-tool-action="select-tab" data-record-id="${esc(row.id)}" class="${row.id === selected.id ? "is-active" : ""}">${row.pinned ? "◆ " : ""}${esc(row.title)}</button>`).join("");
    getInput(host, "title").value = selected.title;
    getInput(host, "document").value = selected.content;
    host._tabDirty = false; tabState(host, `Đã lưu · ${nowLabel(selected.updatedAt)}`);
  }

  async function renderFolders(host) {
    const epoch = active.epoch, select = getInput(host, "file-folder"), selected = select?.value || "";
    if (!select) return;
    const folders = await storage.list("records", row => row.type === "tool-folder"); if (!live(host, epoch)) return;
    select.innerHTML = '<option value="">Gốc</option>' + folders.sort((a, b) => a.name.localeCompare(b.name)).map(row => `<option value="${esc(row.id)}">${esc(row.name)}</option>`).join("");
    select.value = folders.some(row => row.id === selected) ? selected : "";
  }

  async function renderFiles(host) {
    const epoch = active.epoch;
    const list = host.querySelector("[data-tool-list]"); if (!list) return;
    const query = getValue(host, "file-filter").toLowerCase();
    const folder = getValue(host, "file-folder");
    const files = (await storage.list("files", row => (row.folderId || "") === folder && (!query || row.name.toLowerCase().includes(query) || row.type.toLowerCase().includes(query)))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (!live(host, epoch)) return;
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
    const epoch = active.epoch;
    if (manifest.id === "text-to-speech") { loadVoices(host); if ("speechSynthesis" in globalThis) { active.voicesListener = () => live(host) && loadVoices(host); speechSynthesis.addEventListener?.("voiceschanged", active.voicesListener); } }
    if (["speech-to-text", "text-to-speech"].includes(manifest.id)) await hydrateSpeechCapability(host, manifest);
    if (manifest.id === "ai-prompt-library") await renderCollection(host, "prompts");
    if (manifest.id === "version-history") await renderCollection(host, "versions");
    if (manifest.id === "plugin-system") await renderCollection(host, "plugins");
    if (manifest.id === "widget-marketplace") await renderMarketplace(host);
    if (manifest.id === "drag-drop-dashboard") await renderDashboard(host);
    if (manifest.id === "workspace-tabs") await renderTabs(host);
    if (manifest.id === "file-explorer") { await renderFolders(host); await renderFiles(host); }
    if (manifest.id === "auto-save") { const draft = await storage.get("records", "autosave-document"); if (!live(host, epoch)) return; if (draft) { getInput(host, "title").value = draft.title; getInput(host, "document").value = draft.content; host.querySelector("[data-tool-save-state]").textContent = `Khôi phục bản lưu ${nowLabel(draft.updatedAt)}`; } }
    if (manifest.id === "monaco-code-editor") { host.dataset.codeDocument = "code-document"; const saved = await storage.get("records", "code-document"); if (!live(host, epoch)) return; if (saved) { getInput(host, "code").value = saved.content; getInput(host, "language").value = saved.language; getInput(host, "code-title").value = saved.title || "main.js"; } await renderCodeDocuments(host); }
    if (!live(host, epoch)) return;
    await restoreDraft(host, manifest);
    if (!live(host, epoch)) return;
    if (manifest.id === "ai-prompt-library") {
      renderVariables(host); await renderCollection(host, "prompts");
      if (!live(host, epoch)) return;
      const state = host.querySelector("[data-tool-prompt-state]");
      if (state) state.textContent = host.dataset.promptId ? `Đang sửa “${getValue(host, "title") || "Prompt đã mở"}”. Lưu sẽ cập nhật prompt này.` : "Đang tạo prompt mới.";
    }
    if (manifest.id === "file-explorer") await renderFiles(host);
    if (manifest.id === "speech-to-text") renderSubtitleTimeline(host);
    if (manifest.id === "version-history") { await renderCollection(host, "versions"); renderVersionContext(host); }
    if (!live(host, epoch)) return;
    if (manifest.id === "ocr") host.querySelector('[data-tool-action="recognize-ocr"]')?.insertAdjacentHTML("afterend", button("cancel-ocr", "Hủy nhận dạng"));
    if (["drag-drop-dashboard", "widget-marketplace"].includes(manifest.id)) {
      host._clockTimer = null;
      const tick = () => { if (!live(host, epoch) || globalThis.document?.hidden || host._clockTimer) return; host.querySelectorAll("[data-widget-clock]").forEach(node => node.textContent = new Date().toLocaleTimeString("vi-VN")); const timer = setTimeout(() => { active.timers.delete(timer); host._clockTimer = null; tick(); }, 1000); host._clockTimer = timer; active.timers.add(timer); }; tick();
      active.clockListener = tick; globalThis.document?.addEventListener?.("visibilitychange", tick);
    }
    if (manifest.id === "monaco-code-editor") await mountCodeEditor(host);
  }

  function cleanup() {
    if (active.host && active.manifest && live(active.host)) {
      const host = active.host, manifest = active.manifest;
      try { const snapshot = draftSnapshot(host, manifest); if (manifest.id === "monaco-code-editor") snapshot.values.code = editorValue(host); saveDraft(host, manifest, snapshot).catch(error => notice(host, error.message, "error")); } catch (error) { notice(host, error.message, "error"); }
      if (manifest.id === "workspace-tabs") saveCurrentTab(host).catch(error => notice(host, error.message, "error"));
      if (manifest.id === "auto-save") saveAutoDocument(host, true).catch(error => notice(host, error.message, "error"));
    }
    active.epoch += 1;
    active.detach?.(); active.detach = null;
    if (active.recognition) { active.recognition.onend = null; active.recognition.onresult = null; active.recognition.onerror = null; active.recognition.onstart = null; active.recognition.stop?.(); } active.recognition = null;
    active.request?.abort?.(); active.request = null;
    active.host?._capabilityRequest?.abort?.();
    const speechPreview = active.host?.querySelector("[data-tool-tts-preview]"); speechPreview?.pause?.(); speechPreview?.removeAttribute?.("src"); speechPreview?.load?.();
    if (active.host) { active.host._ttsBlob = null; active.host._ttsUrl = null; }
    if (active.ocrRun) active.ocrRun.canceled = true; active.ocrRun = null;
    active.ocrWorker?.terminate?.().catch?.(() => {}); active.ocrWorker = null;
    if ("speechSynthesis" in globalThis) { if (active.utterance) { active.utterance.onstart = null; active.utterance.onend = null; active.utterance.onerror = null; speechSynthesis.cancel(); } if (active.voicesListener) speechSynthesis.removeEventListener?.("voiceschanged", active.voicesListener); } active.voicesListener = null; active.utterance = null;
    if (active.mediaRecorder) { active.mediaRecorder.onstop = null; active.mediaRecorder.ondataavailable = null; }
    active.mediaRecorder?.state !== "inactive" && active.mediaRecorder?.stop?.();
    active.mediaStream?.getTracks?.().forEach(track => track.stop());
    active.timers.forEach(timer => clearTimeout(timer)); active.timers.clear();
    if (active.clockListener) globalThis.document?.removeEventListener?.("visibilitychange", active.clockListener); active.clockListener = null;
    const editor = active.host?.querySelector("[data-tool-editor]")?._editor, model = editor?.getModel?.();
    active.host?._codeMarkerListener?.dispose?.(); active.host?._codeChangeListener?.dispose?.();
    active.host?._diffEditor?.dispose?.(); active.host?._diffModels?.forEach(item => item.dispose());
    editor?.dispose?.(); model?.dispose?.();
    if (active.manifest?.id === "monaco-code-editor") {
      // Public defaults events reset language-service worker managers before terminating our workers.
      const languages = globalThis.monaco?.languages;
      [languages?.typescript?.javascriptDefaults, languages?.typescript?.typescriptDefaults].forEach(defaults => defaults?.setWorkerOptions?.({ ...(defaults.workerOptions || {}) }));
      languages?.json?.jsonDefaults?.setDiagnosticsOptions?.({ ...(languages.json.jsonDefaults.diagnosticsOptions || {}) });
      [languages?.css?.cssDefaults, languages?.html?.htmlDefaults].forEach(defaults => defaults?.setOptions?.({ ...(defaults.options || {}) }));
      monacoWorkers.forEach(worker => worker.terminate()); monacoWorkers.clear();
    }
    active.urls.forEach(url => URL.revokeObjectURL(url)); active.urls.clear();
    active.host = null; active.manifest = null; active.ocrImage = null; active.ocrFile = null; active.mediaFile = null; active.mediaRecorder = null; active.mediaStream = null; active.mediaChunks = []; active.transcriptSegments = []; active.subtitleCues = []; active.subtitleOrigin = "manual"; active.aiAttachment = null; active.dashboardUndo = [];
  }

  function render(host, nameOrId, options = {}) {
    const manifest = resolveManifest(nameOrId);
    if (!manifest || !host) return false;
    cleanup(); active.host = host; active.manifest = manifest; active.scope = accountScope(options); host._toolScope = active.scope; host._toolAccount = active.scope; host._toolOptions = options; host._toolEpoch = active.epoch;
    if (manifest.id === "ai-prompt-library") delete host.dataset.promptId;
    if (manifest.id === "file-explorer") { delete host.dataset.activeFile; host._fileSavedContent = null; host._fileSavedName = ""; host._fileSavedFolder = ""; host._fileBaseUpdatedAt = ""; }
    if (manifest.id === "version-history") { host._versionPage = 0; host._versionEditRevision = 0; host._versionRenderRevision = 0; host._selectedVersions = new Set(); host._versionLabels = new Map(); host._versionLabelDrafts = new Map(); host.dataset.versionContext = "local"; }
    host.innerHTML = markup(manifest);
    host._toolReady = hydrate(host, manifest).catch(error => { if (live(host)) notice(host, error.message, "error"); });
    return true;
  }

  async function runAction(action, buttonNode, host, manifest) {
    const epoch = active.epoch, owner = scopeFor(host);
    // Capture this mount: a delayed read must never populate another account/tool in the same host.
    const storage = Object.fromEntries(["get", "list", "put", "delete"].map(method => [method, async (...args) => {
      if (!live(host, epoch)) { const error = new Error("Workspace đã đóng hoặc tài khoản đã đổi."); error.name = "AbortError"; throw error; }
      if (args[2] == null) args[2] = owner;
      const result = await rawStorage[method](...args);
      if (!live(host, epoch)) { const error = new Error("Workspace đã đóng hoặc tài khoản đã đổi."); error.name = "AbortError"; throw error; }
      return result;
    }]));
    const outputNode = host.querySelector("[data-tool-output]");
    if (action === "copy-output") { await navigator.clipboard.writeText(outputNode?.textContent || getValue(host, "ocr-result")); return notice(host, "Đã sao chép kết quả."); }
    if (["subtitle-import", "subtitle-from-transcript", "subtitle-add", "subtitle-sort", "subtitle-validate", "subtitle-clear", "subtitle-up", "subtitle-down", "subtitle-delete"].includes(action)) {
      if (manifest.id !== "speech-to-text") throw new Error("Timeline chỉ thuộc Speech To Text.");
      if (action === "subtitle-import" || action === "subtitle-from-transcript") {
        const text = action === "subtitle-import" ? getValue(host, "subtitle-source") : getValue(host, "transcript"); if (!text.trim()) throw new Error("Nhập nội dung trước khi tạo timeline.");
        const parsed = parseSubtitles(action === "subtitle-import" ? text : formatTranscript(text, "srt")); active.subtitleCues = parsed.cues; active.subtitleOrigin = action === "subtitle-import" ? parsed.origin : "approximate";
        renderSubtitleTimeline(host); return notice(host, action === "subtitle-import" ? `Đã nhập ${parsed.cues.length} cue cục bộ. ${parsed.warnings.join(" ")}` : "Đã tạo mốc ước lượng 4 giây/câu. Hãy chỉnh theo audio thực; đây không phải timestamp được đo.", action === "subtitle-import" ? "" : "warning");
      }
      if (action === "subtitle-add") { if (active.subtitleCues.length >= 300) throw new Error("Timeline giới hạn 300 cue."); const previous = active.subtitleCues.at(-1), start = previous && Number.isFinite(Number(previous.end)) ? Number(previous.end) : 0; active.subtitleCues.push({ id: uid("cue"), start: String(start), end: String(start + 4), text: "" }); }
      if (action === "subtitle-clear") { if (active.subtitleCues.length && buttonNode.dataset.confirmClear !== "yes") { buttonNode.dataset.confirmClear = "yes"; buttonNode.textContent = "Xác nhận xóa timeline"; return notice(host, "Bấm lại để xóa timeline. Bản chép lời vẫn được giữ.", "warning"); } active.subtitleCues = []; active.subtitleOrigin = "manual"; buttonNode.textContent = "Xóa timeline"; delete buttonNode.dataset.confirmClear; }
      if (action === "subtitle-sort") active.subtitleCues.sort((a, b) => (a.start.trim() && Number.isFinite(Number(a.start)) ? Number(a.start) : Infinity) - (b.start.trim() && Number.isFinite(Number(b.start)) ? Number(b.start) : Infinity));
      if (["subtitle-up", "subtitle-down", "subtitle-delete"].includes(action)) { const id = buttonNode.closest("[data-subtitle-cue]")?.dataset.subtitleCue, index = active.subtitleCues.findIndex(row => row.id === id); if (index < 0) throw new Error("Cue không còn tồn tại."); if (action === "subtitle-delete") active.subtitleCues.splice(index, 1); else { const to = index + (action === "subtitle-up" ? -1 : 1); if (to < 0 || to >= active.subtitleCues.length) throw new Error("Cue đã ở đầu/cuối danh sách."); [active.subtitleCues[index], active.subtitleCues[to]] = [active.subtitleCues[to], active.subtitleCues[index]]; } }
      if (action === "subtitle-validate") { const result = subtitleValidation(host); if (!result.ok) throw new Error(result.errors.join("\n")); return notice(host, "Timeline hợp lệ. Các mốc là dữ liệu bạn đã nhập/chỉnh, không chứng minh thời gian audio."); }
      renderSubtitleTimeline(host); return;
    }
    if (action === "start-recognition") {
      if (active.recognition) throw new Error("Micro đang nhận dạng. Dừng phiên hiện tại trước.");
      const Recognition = getRecognition(); if (!Recognition) throw new Error(featureSupport(manifest).reason);
      const recognition = new Recognition(); active.recognition = recognition; recognition.lang = getValue(host, "language") || "vi-VN"; recognition.continuous = getValue(host, "continuous") === "true"; recognition.interimResults = true;
      const transcript = getInput(host, "transcript"); let finalText = transcript.value;
      recognition.onstart = () => { host.querySelector("[data-tool-wave]")?.classList.add("is-live"); setState(host, "running", "Đang nghe micro"); };
      recognition.onresult = event => { if (!live(host)) return; let interim = ""; for (let i = event.resultIndex; i < event.results.length; i += 1) { const text = event.results[i][0].transcript; if (event.results[i].isFinal) finalText += `${finalText ? " " : ""}${text}`; else interim += text; } transcript.value = `${finalText}${interim ? ` ${interim}` : ""}`; scheduleDraft(host, manifest); };
      recognition.onerror = event => { host.querySelector("[data-tool-wave]")?.classList.remove("is-live"); setState(host, "error", "Không thể nhận dạng"); notice(host, `Micro/nhận dạng lỗi: ${event.error}. Kiểm tra quyền micro và kết nối.`, "error"); };
      recognition.onend = () => { if (!live(host)) return; host.querySelector("[data-tool-wave]")?.classList.remove("is-live"); active.recognition = null; setState(host, "done", "Đã dừng micro"); record(manifest.id, "recognize", transcript.value.slice(0, 160)).catch(error => notice(host, error.message, "error")); };
      recognition.start(); return;
    }
    if (action === "stop-recognition") { active.recognition?.stop?.(); return; }
    if (action === "clear-transcript") { getInput(host, "transcript").value = ""; active.transcriptSegments = []; setOutput(host, "Đã xóa bản chép lời. Timeline độc lập vẫn giữ; dùng Xóa timeline nếu cần."); return; }
    if (action === "start-media-record") {
      if (active.mediaRecorder?.state === "recording") throw new Error("Đang ghi âm. Dừng phiên hiện tại trước.");
      if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) throw new Error("Trình duyệt chưa hỗ trợ ghi âm. Hãy chọn một file audio/video thay thế.");
      active.mediaStream?.getTracks?.().forEach(track => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (!live(host, epoch)) { stream.getTracks().forEach(track => track.stop()); return; }
      const recorder = new MediaRecorder(stream); active.mediaStream = stream; active.mediaRecorder = recorder; active.mediaChunks = [];
      recorder.ondataavailable = event => { if (event.data?.size) active.mediaChunks.push(event.data); };
      recorder.onstop = () => { stream.getTracks().forEach(track => track.stop()); if (!live(host)) return; const blob = new Blob(active.mediaChunks, { type: recorder.mimeType || "audio/webm" }); active.mediaFile = new File([blob], `recording-${Date.now()}.webm`, { type: blob.type }); active.mediaStream = null; host.querySelector("[data-tool-wave]")?.classList.remove("is-live"); setOutput(host, `Đã ghi ${(blob.size / 1024).toFixed(1)} KB. Có thể tải bản ghi; chép backend tối đa 2 MB sau đồng ý chi phí.`); setState(host, "done", "Đã ghi âm"); };
      recorder.start(500); host.querySelector("[data-tool-wave]")?.classList.add("is-live"); setOutput(host, "Đang ghi âm từ micro…"); return;
    }
    if (action === "stop-media-record") { if (!active.mediaRecorder || active.mediaRecorder.state === "inactive") throw new Error("Chưa có phiên ghi âm đang chạy."); active.mediaRecorder.stop(); host.querySelector("[data-tool-wave]")?.classList.remove("is-live"); return; }
    if (action === "transcribe-media") {
      const file = active.mediaFile; if (!file) throw new Error("Chọn file audio hoặc ghi âm trước."); if (file.size > 2 * 1024 * 1024) throw new Error("File vượt 2 MB. Hãy nén hoặc chia nhỏ trước khi gửi.");
      if (!/^audio\//.test(file.type)) throw new Error("Chỉ chép file audio; video cần tách âm thanh trước.");
      if (host._speechCapability?.configured === false) throw new Error("Chép file chưa khả dụng: backend chưa cấu hình. Không gửi file.");
      if (!host.querySelector("[data-tool-paid-consent]")?.checked) throw new Error("Chọn đồng ý gửi file và chi phí API trước khi chép.");
      if (active.request) throw new Error("Đang xử lý. Hủy hoặc chờ yêu cầu hiện tại.");
      const controller = new AbortController(); active.request = controller; host.querySelector("[data-tool-paid-consent]").checked = false;
      try { const bytes = new Uint8Array(await file.arrayBuffer()); if (!live(host, epoch)) return; const result = await requestAi({ toolId: "speech-to-text", action: "transcribe", input: { audio: { data: bytesToBase64(bytes), mimeType: file.type.split(";")[0].replace("audio/x-wav", "audio/wav") }, language: getValue(host, "language") }, consent: { paidProcessing: true } }, controller.signal); if (!live(host, epoch)) return; getInput(host, "transcript").value = result.text; active.transcriptSegments = []; setOutput(host, `Đã chép file ${file.name} bằng backend.\nKhông có timestamp/diarization đo từ audio; phụ đề dùng mốc thủ công.\n${result.language || getValue(host, "language")}`); await record(manifest.id, "transcribe", file.name); }
      finally { if (active.request === controller) active.request = null; } return;
    }
    if (action === "download-recording") { if (!active.mediaFile) throw new Error("Chưa có bản ghi/tệp âm thanh."); return download(active.mediaFile.name, active.mediaFile, active.mediaFile.type); }
    if (action === "confirm-search") {
      const query = getValue(host, "transcript").trim(); if (!query) throw new Error("Chưa có nội dung giọng nói để tìm.");
      const rows = (globalThis.HHFeatureLab?.catalog?.() || TOOL_MANIFESTS).filter(tool => `${tool.name} ${tool.description || ""}`.toLocaleLowerCase("vi-VN").includes(query.toLocaleLowerCase("vi-VN"))).slice(0, 30);
      setOutput(host, rows.length ? rows.map(tool => `${tool.name}\n#/tools/${tool.id}`).join("\n\n") : `Không có tool khớp “${query}”.`); await record(manifest.id, "search", query); return;
    }
    if (["export-srt", "export-vtt"].includes(action)) {
      const kind = action.endsWith("srt") ? "srt" : "vtt", text = getValue(host, "transcript"); if (!text.trim() && !active.subtitleCues.length) throw new Error("Chưa có bản chép lời hoặc timeline để xuất.");
      if (!active.subtitleCues.length) { const parsed = parseSubtitles(formatTranscript(text, "srt")); active.subtitleCues = parsed.cues; active.subtitleOrigin = "approximate"; renderSubtitleTimeline(host); }
      const result = subtitleValidation(host); if (!result.ok) throw new Error(`Chưa xuất phụ đề: ${result.errors.join("\n")}`);
      download(`transcript.${kind}`, formatSegments(result.cues, kind), kind === "vtt" ? "text/vtt" : "application/x-subrip"); notice(host, active.subtitleOrigin === "approximate" ? "Đã xuất mốc ước lượng; không phải timestamp đo từ audio." : "Đã xuất timeline nhập/chỉnh sau khi kiểm tra thời gian và chồng lấn.", active.subtitleOrigin === "approximate" ? "warning" : ""); return;
    }
    if (action === "speak") {
      if (!("speechSynthesis" in globalThis)) throw new Error("Trình duyệt không hỗ trợ Text-to-Speech."); const text = getValue(host, "text").trim(); if (!text) throw new Error("Nhập văn bản cần đọc.");
      speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text), language = getValue(host, "language") || "vi-VN", select = getInput(host, "voice"); utterance.lang = language; utterance.rate = clamp(getValue(host, "rate"), .5, 2); utterance.pitch = clamp(getValue(host, "pitch"), .5, 2); utterance.voice = (select?.value !== "" ? select?._voices?.[Number(select.value)] : null) || speechSynthesis.getVoices().find(voice => voice.lang === language) || null;
      utterance.onstart = () => { setState(host, "running", "Đang đọc"); setOutput(host, `Giọng: ${utterance.voice?.name || "mặc định"}\nNgôn ngữ: ${utterance.lang}\nTốc độ: ${utterance.rate}×`); };
      utterance.onend = () => { if (!live(host)) return; setState(host, "done", "Đọc hoàn tất"); record(manifest.id, "speak", text.slice(0, 160), { voice: utterance.voice?.name, language }).catch(error => notice(host, error.message, "error")); };
      utterance.onerror = event => { setState(host, "error", "Không thể đọc"); notice(host, `Lỗi giọng đọc: ${event.error}`, "error"); };
      active.utterance = utterance; speechSynthesis.speak(utterance); return;
    }
    if (action === "pause") { globalThis.speechSynthesis?.pause?.(); return setState(host, "idle", "Đã tạm dừng"); }
    if (action === "resume") { globalThis.speechSynthesis?.resume?.(); return setState(host, "running", "Đang đọc tiếp"); }
    if (action === "stop") { globalThis.speechSynthesis?.cancel?.(); return setState(host, "idle", "Đã dừng"); }
    if (action === "export-tts") {
      const text = getValue(host, "text").trim(); if (!text) throw new Error("Nhập văn bản cần tạo audio."); if (text.length > 2000) throw new Error("Mỗi lần tạo WAV tối đa 2.000 ký tự.");
      if (host._speechCapability?.configured === false) throw new Error("Backend tạo WAV chưa cấu hình. Giọng thiết bị chỉ nghe được, không trả file.");
      if (!host.querySelector("[data-tool-paid-consent]")?.checked) throw new Error("Chọn đồng ý gửi văn bản và chi phí API trước khi tạo WAV.");
      if (active.request) throw new Error("Đang xử lý. Hủy hoặc chờ yêu cầu hiện tại.");
      const controller = new AbortController(); active.request = controller; host.querySelector("[data-tool-paid-consent]").checked = false;
      try { const result = await requestAi({ toolId: "text-to-speech", action: "synthesize", input: { text, voice: getValue(host, "server-voice") || "Kore", language: getValue(host, "language") }, consent: { paidProcessing: true } }, controller.signal); if (!live(host, epoch)) return; const blob = decodeSpeechAudio(result.audio), preview = host.querySelector("[data-tool-tts-preview]"); preview?.pause?.(); if (host._ttsUrl) { URL.revokeObjectURL(host._ttsUrl); active.urls.delete(host._ttsUrl); } host._ttsBlob = blob; host._ttsUrl = URL.createObjectURL(blob); active.urls.add(host._ttsUrl); if (preview) { preview.src = host._ttsUrl; preview.load?.(); } setOutput(host, `Đã tạo WAV ${(blob.size / 1024).toFixed(1)} KB · ${result.voice || getValue(host, "server-voice")}.\nNhấn Play để nghe hoặc Tải WAV. Không tự phát âm thanh.`); await record(manifest.id, "synthesize", `${text.length} ký tự`); }
      finally { if (active.request === controller) active.request = null; } return;
    }
    if (action === "download-tts") { if (!host._ttsBlob) throw new Error("Chưa có WAV. Tạo bằng backend trước."); return download("hh-tool-voice.wav", host._ttsBlob, "audio/wav"); }
    if (action === "cancel-speech") { active.request?.abort?.(); active.request = null; return notice(host, "Đã hủy chờ kết quả; yêu cầu đã gửi có thể vẫn tính phí ở nhà cung cấp. Không tự gửi lại.", "warning"); }
    if (action === "send-ai") {
      const message = getValue(host, "message").trim(); if (!message) throw new Error("Nhập nội dung cần gửi.");
      if (!host.querySelector("[data-tool-paid-consent]")?.checked) throw new Error("Chọn đồng ý gửi tới backend và chi phí API trước khi Gửi.");
      if (active.request) throw new Error("AI đang xử lý. Hủy hoặc chờ kết quả trước khi gửi tiếp.");
      const messages = host.querySelector("[data-tool-messages]"), history = [...messages.querySelectorAll(".is-user,.is-assistant")].slice(-8).map(node => `${node.classList.contains("is-user") ? "Người dùng" : "Trợ lý"}: ${node.textContent}`).join("\n");
      const attachment = active.aiAttachment ? `\n\nTệp người dùng cung cấp (${active.aiAttachment.name}):\n${active.aiAttachment.text.slice(0, 8000)}` : "", prompt = `${history ? `Ngữ cảnh hội thoại:\n${history.slice(-7000)}\n\n` : ""}Yêu cầu hiện tại:\n${message}${attachment}`.slice(0, 16000);
      const controller = new AbortController(); active.request = controller; host.querySelector("[data-tool-paid-consent]").checked = false;
      setState(host, "running", "AI đang xử lý");
      try { const data = await requestAi({ toolId: "ai-chat", action: "send", input: { prompt } }, controller.signal); if (!live(host, epoch)) return;
        messages.insertAdjacentHTML("beforeend", `<div class="is-user">${esc(message)}</div><div class="is-assistant">${esc(data.text)}</div>`); getInput(host, "message").value = ""; active.aiAttachment = null; setState(host, "done", "AI đã trả lời"); await record(manifest.id, "chat", message.slice(0, 160));
      } finally { if (active.request === controller) active.request = null; }
      return;
    }
    if (action === "cancel-ai") { active.request?.abort?.(); active.request = null; return setState(host, "idle", "Đã hủy yêu cầu AI"); }
    if (action === "new-chat") { active.request?.abort?.(); active.request = null; active.aiAttachment = null; host.querySelector("[data-tool-messages]").innerHTML = '<div class="is-system">Cuộc trò chuyện mới. Backend phải được cấu hình ở máy chủ.</div>'; return; }
    if (action === "export-chat") { download("hh-ai-chat.txt", host.querySelector("[data-tool-messages]").innerText); return; }
    if (action === "new-prompt") { delete host.dataset.promptId; ["title", "tags", "content"].forEach(name => { getInput(host, name).value = ""; }); renderVariables(host); const state = host.querySelector("[data-tool-prompt-state]"); if (state) state.textContent = "Đang tạo prompt mới."; return; }
    if (action === "render-prompt") { const variables = Object.create(null); host.querySelectorAll("[data-prompt-variable]").forEach(node => { variables[node.dataset.promptVariable] = node.value; }); setOutput(host, fillPrompt(getValue(host, "content"), variables)); return; }
    if (action === "save-prompt") {
      const title = getValue(host, "title").trim(), content = getValue(host, "content").trim(); if (!title || content.length < 5) throw new Error("Nhập tên và nội dung prompt.");
      const old = host.dataset.promptId ? await storage.get("records", host.dataset.promptId) : null, id = old?.id || uid("prompt");
      const safe = validatePromptImport([{ title, content, tags: getValue(host, "tags").split(","), favorite: old?.favorite }])[0];
      await storage.put("records", { id, type: "prompt", ...safe, updatedAt: new Date().toISOString() }); host.dataset.promptId = id; const state = host.querySelector("[data-tool-prompt-state]"); if (state) state.textContent = `Đã lưu “${title}” · lần lưu tiếp theo cập nhật prompt này.`; await renderCollection(host, "prompts"); await record(manifest.id, "save", title); return notice(host, globalThis.indexedDB ? "Đã lưu prompt vào IndexedDB." : "Đã giữ prompt trong phiên; IndexedDB chưa khả dụng.");
    }
    if (action === "use-prompt") { const row = await storage.get("records", buttonNode.closest("[data-record-id]").dataset.recordId); if (!row) throw new Error("Prompt không còn tồn tại."); host.dataset.promptId = row.id; getInput(host, "title").value = row.title; getInput(host, "content").value = row.content; getInput(host, "tags").value = (row.tags || []).join(", "); renderVariables(host); getInput(host, "content").focus(); const state = host.querySelector("[data-tool-prompt-state]"); if (state) state.textContent = `Đang sửa “${row.title}”.`; return notice(host, `Đã mở “${row.title}” trong trình soạn prompt riêng. Không thay đổi Chat AI.`); }
    if (["favorite-prompt", "duplicate-prompt"].includes(action)) { const row = await storage.get("records", buttonNode.closest("[data-record-id]").dataset.recordId); if (!row || row.type !== "prompt") throw new Error("Prompt không còn tồn tại."); if (action === "favorite-prompt") row.favorite = !row.favorite; else { row.id = uid("prompt"); row.title = `${row.title.slice(0, 170)} · bản sao`; } row.updatedAt = new Date().toISOString(); await storage.put("records", row); return renderCollection(host, "prompts"); }
    if (action === "export-prompts") { const rows = await storage.list("records", row => row.type === "prompt"); download("hh-prompt-library.json", JSON.stringify({ version: 1, prompts: rows }, null, 2), "application/json"); return; }
    if (action === "delete-record") { const id = buttonNode.closest("[data-record-id]").dataset.recordId; if (buttonNode.dataset.confirmDelete !== id) { buttonNode.dataset.confirmDelete = id; buttonNode.textContent = "Bấm lần nữa để xóa"; return notice(host, "Xóa mục này? Bấm lại đúng nút để xác nhận hoặc chọn mục khác.", "warning"); } const deleted = await storage.delete("records", id); if (!deleted) throw new Error("Chưa xóa được; hãy thử lại."); if (host.dataset.promptId === id) delete host.dataset.promptId; if (manifest.id === "ai-prompt-library") await renderCollection(host, "prompts"); else if (manifest.id === "version-history") await renderCollection(host, "versions"); else await renderCollection(host, "plugins"); return; }
    if (action === "optimize-prompt" || action === "generate-image-prompt") {
      const result = action === "optimize-prompt" ? optimizePrompt(getValue(host, "source"), getValue(host, "goal"), getValue(host, "target")) : imagePrompt(getValue(host, "source"), getValue(host, "goal"), getValue(host, "target")); setOutput(host, result); setState(host, "done", "Đã tạo bằng engine cục bộ"); await record(manifest.id, "generate", getValue(host, "source").slice(0, 160)); return;
    }
    if (action === "save-output-version") { const content = outputNode?.textContent || ""; if (!content || content === "Chưa có kết quả.") throw new Error("Chưa có kết quả để lưu."); await storage.put("records", { id: uid("version"), type: "version", label: manifest.name, content, createdAt: new Date().toISOString() }); return notice(host, "Đã lưu kết quả vào Version History."); }
    if (action === "new-tab") { await saveCurrentTab(host); if (!live(host)) return; const row = { id: uid("tab"), type: "workspace-tab", title: `Tài liệu ${Date.now().toString().slice(-4)}`, content: "", pinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; await storage.put("records", row); return renderTabs(host, row.id); }
    if (action === "select-tab") { await saveCurrentTab(host); if (live(host)) return renderTabs(host, buttonNode.dataset.recordId); return; }
    if (["save-tab", "pin-tab"].includes(action)) { const id = host.dataset.activeTab, row = await storage.get("records", id); if (!row) throw new Error("Tab không tồn tại."); row.title = getValue(host, "title").trim() || "Không tên"; row.content = getValue(host, "document"); row.updatedAt = new Date().toISOString(); if (action === "pin-tab") row.pinned = !row.pinned; await storage.put("records", row); await renderTabs(host, id); return; }
    if (action === "export-tab") return download(`${slug(getValue(host, "title"))}.txt`, getValue(host, "document"));
    if (["tab-left", "tab-right"].includes(action)) { await saveCurrentTab(host); const tabs = (await storage.list("records", row => row.type === "workspace-tab")).sort((a, b) => Number(b.pinned) - Number(a.pinned) || (Number(a.order) || 0) - (Number(b.order) || 0) || a.createdAt.localeCompare(b.createdAt)); const from = tabs.findIndex(row => row.id === host.dataset.activeTab), to = from + (action === "tab-left" ? -1 : 1); if (to < 0 || to >= tabs.length || Boolean(tabs[from].pinned) !== Boolean(tabs[to].pinned)) throw new Error("Chỉ sắp xếp tab trong nhóm ghim hoặc nhóm thường."); [tabs[from], tabs[to]] = [tabs[to], tabs[from]]; for (let index = 0; index < tabs.length; index += 1) await storage.put("records", { ...tabs[index], order: index }); return renderTabs(host, host.dataset.activeTab); }
    if (action === "close-tab") { const tabs = await storage.list("records", row => row.type === "workspace-tab"); if (tabs.length === 1) throw new Error("Workspace cần giữ ít nhất một tab."); if (buttonNode.dataset.confirmDelete !== host.dataset.activeTab) { buttonNode.dataset.confirmDelete = host.dataset.activeTab; buttonNode.textContent = "Xác nhận xóa tab"; return notice(host, "Xóa tab sẽ lưu bản sao vào Version History trước. Bấm lần nữa để xác nhận.", "warning"); } await storage.put("records", { id: uid("version"), type: "version", label: `Tab đã xóa · ${getValue(host, "title")}`, content: getValue(host, "document"), createdAt: new Date().toISOString() }); const deleted = await storage.delete("records", host.dataset.activeTab); if (!deleted) throw new Error("Chưa xóa được tab."); buttonNode.textContent = "Xóa tab"; delete buttonNode.dataset.confirmDelete; return renderTabs(host); }
    if (action === "move-widget-left" || action === "move-widget-right") { const index = Number(buttonNode.closest("[data-dashboard-index]").dataset.dashboardIndex); return moveDashboard(host, index, index + (action.endsWith("left") ? -1 : 1)); }
    if (["remove-dashboard-widget", "resize-dashboard-widget"].includes(action)) { const record = await storage.get("records", "dashboard-layout"); if (!live(host)) return; const id = buttonNode.closest("[data-dashboard-id]").dataset.dashboardId, widgets = structuredCloneSafe(Array.isArray(record?.widgets) ? record.widgets : DEFAULT_DASHBOARD); active.dashboardUndo.push(structuredCloneSafe(widgets)); const index = widgets.findIndex(row => row.id === id); if (index < 0) throw new Error("Widget không còn tồn tại."); if (action === "remove-dashboard-widget") widgets.splice(index, 1); else { const row = widgets[index]; row.size = row.size === "wide" ? "normal" : "wide"; } await storage.put("records", { id: "dashboard-layout", type: "dashboard", widgets, updatedAt: new Date().toISOString() }); return renderDashboard(host); }
    if (action === "add-widget") { const record = await storage.get("records", "dashboard-layout"); if (!live(host)) return; const widgets = structuredCloneSafe(Array.isArray(record?.widgets) ? record.widgets : DEFAULT_DASHBOARD), item = MARKET_WIDGETS.find(row => row.id === getValue(host, "widget-kind")) || MARKET_WIDGETS[0]; if (widgets.length >= 24) throw new Error("Dashboard giới hạn 24 widget trên thiết bị."); active.dashboardUndo.push(structuredCloneSafe(widgets)); widgets.push({ id: uid("widget"), title: item.name, kind: item.id, content: "", count: 0, tasks: [] }); await storage.put("records", { id: "dashboard-layout", type: "dashboard", widgets, updatedAt: new Date().toISOString() }); return renderDashboard(host); }
    if (action === "undo-dashboard") { const widgets = active.dashboardUndo.pop(); if (!widgets) throw new Error("Chưa có thay đổi dashboard để hoàn tác."); await storage.put("records", { id: "dashboard-layout", type: "dashboard", widgets, updatedAt: new Date().toISOString() }); return renderDashboard(host); }
    if (action === "reset-dashboard") { await storage.delete("records", "dashboard-layout"); return renderDashboard(host); }
    if (action === "install-widget") { const item = MARKET_WIDGETS.find(row => row.id === buttonNode.closest("[data-widget-id]").dataset.widgetId); if (!item) throw new Error("Widget chưa được duyệt."); await storage.put("records", { id: `widget-${item.id}`, type: "widget", widgetId: item.id, kind: item.id, content: "", count: 0, tasks: [], enabled: true, installedAt: new Date().toISOString() }); await renderMarketplace(host); await record(manifest.id, "install", item.name); return; }
    if (action === "remove-widget-market") { const widgetId = buttonNode.closest("[data-widget-id]").dataset.widgetId; await storage.delete("records", `widget-${widgetId}`); return renderMarketplace(host); }
    if (action === "import-plugin") {
      let plugin; try { plugin = JSON.parse(getValue(host, "manifest")); } catch { throw new Error("Manifest phải là JSON hợp lệ."); }
      const safe = validatePlugin(plugin);
      await storage.put("records", { id: `plugin-${plugin.id}`, type: "plugin", ...safe, enabled: false, installedAt: new Date().toISOString() }); await renderCollection(host, "plugins"); return notice(host, "Đã cài engine ở trạng thái tắt. Bật rồi dùng Chạy văn bản để xử lý cục bộ.", "warning");
    }
    if (action === "toggle-plugin") { const id = buttonNode.closest("[data-record-id]").dataset.recordId, row = await storage.get("records", id); if (!row || !Object.hasOwn(PLUGIN_ENGINES, row.engine)) throw new Error("Plugin chưa có engine được duyệt. Nhập lại manifest."); row.enabled = !row.enabled; await storage.put("records", row); return renderCollection(host, "plugins"); }
    if (action === "run-plugin") { const row = await storage.get("records", buttonNode.closest("[data-record-id]").dataset.recordId); if (!row?.enabled) throw new Error("Bật plugin trước khi chạy."); setOutput(host, runPlugin(row.engine, getValue(host, "plugin-source"))); return; }
    if (["counter-up", "counter-down", "counter-reset", "add-widget-task", "delete-widget-task"].includes(action)) { const article = buttonNode.closest("[data-widget-prefix]"); const text = article?.querySelector("[data-widget-task-input]")?.value.trim() || ""; if (action === "add-widget-task" && !text) throw new Error("Nhập công việc trước khi thêm."); return updateWidget(host, article, row => { if (action.startsWith("counter-")) row.count = action === "counter-reset" ? 0 : (Number(row.count) || 0) + (action === "counter-up" ? 1 : -1); else if (action === "add-widget-task") { row.tasks = [...(row.tasks || []), { id: uid("task"), text: text.slice(0, 500), done: false }].slice(-100); } else row.tasks = (row.tasks || []).filter(task => task.id !== buttonNode.dataset.taskId); }); }
    if (["save-document", "restore-document", "clear-document"].includes(action)) {
      if (action === "restore-document") { const row = await storage.get("records", "autosave-document"); if (!row) throw new Error("Chưa có bản nháp để khôi phục."); getInput(host, "title").value = row.title; getInput(host, "document").value = row.content; }
      else if (action === "clear-document") { await storage.delete("records", "autosave-document"); getInput(host, "document").value = ""; }
      else await saveAutoDocument(host, true);
      return;
    }
    if (action === "create-version") { const content = validateVersionContent(getValue(host, "document")); if (!content.trim()) throw new Error("Không thể tạo phiên bản trống."); await storage.put("records", { id: uid("version"), type: "version", label: getValue(host, "label").trim().slice(0, 180) || `Phiên bản ${nowLabel()}`, content, sourceDocument: host.dataset.versionContext || "local", createdAt: new Date().toISOString() }, owner); if (live(host, epoch)) await renderCollection(host, "versions"); return; }
    if (action === "export-version-draft") return download("hh-version-draft.txt", getValue(host, "document"));
    if (["version-prev", "version-next"].includes(action)) { host._versionPage = Math.max(0, (host._versionPage || 0) + (action === "version-prev" ? -1 : 1)); return renderCollection(host, "versions"); }
    if (action === "clear-version-selection") { host._selectedVersions?.clear(); host.querySelectorAll("[data-version-select]").forEach(node => { node.checked = false; }); renderVersionSelection(host); return; }
    if (action === "compare-selected-versions") { const ids = [...(host._selectedVersions || [])]; if (ids.length !== 2) throw new Error("Chọn đúng hai snapshot để so sánh."); const [first, second] = await Promise.all(ids.map(id => storage.get("records", id, owner))); if (!live(host, epoch)) return; if (first?.type !== "version" || second?.type !== "version") throw new Error("Snapshot đã bị xóa hoặc không đúng loại."); setOutput(host, `${first.label} [${versionContext(first)}] → ${second.label} [${versionContext(second)}]\n${compareLines(first.content, second.content).text}`); return; }
    if (action === "rename-version") { const article = buttonNode.closest("[data-record-id]"), label = article?.querySelector("[data-version-label]")?.value.trim(); if (!label || label.length > 180) throw new Error("Nhãn snapshot cần 1–180 ký tự."); const row = await storage.get("records", article.dataset.recordId, owner); if (!live(host, epoch)) return; if (row?.type !== "version") throw new Error("Snapshot không tồn tại."); await storage.put("records", { ...row, label, updatedAt: new Date().toISOString() }, owner); if (!live(host, epoch)) return; host._versionLabelDrafts?.delete(row.id); return renderCollection(host, "versions"); }
    if (action === "export-document") return download("hh-autosave-draft.txt", getValue(host, "document"));
    if (action === "compare-version") { const row = await storage.get("records", buttonNode.closest("[data-record-id]").dataset.recordId); if (!row) throw new Error("Snapshot không tồn tại."); setOutput(host, compareLines(row.content, getValue(host, "document")).text); return; }
    if (action === "restore-version") {
      const content = getValue(host, "document"), editRevision = host._versionEditRevision || 0, context = host.dataset.versionContext || "local";
      const row = await storage.get("records", buttonNode.closest("[data-record-id]").dataset.recordId, owner); if (!live(host, epoch)) return; if (row?.type !== "version") throw new Error("Snapshot không tồn tại.");
      if (getValue(host, "document") !== content || (host._versionEditRevision || 0) !== editRevision) throw new Error("Nội dung vừa được sửa trong lúc đọc snapshot. Chưa khôi phục; phần mới nhập được giữ.");
      if (context !== versionContext(row) && content.trim() && buttonNode.dataset.confirmContext !== row.id) { buttonNode.dataset.confirmContext = row.id; buttonNode.textContent = "Xác nhận đổi nhóm & khôi phục"; return notice(host, `Snapshot thuộc nhóm ${versionContext(row)}, khác nhóm ${context} đang soạn. Bấm lại để chuyển ở đây; không đổi workspace nguồn.`, "warning"); }
      validateVersionContent(row.content); validateVersionContent(content);
      if (content !== row.content && content.trim()) await storage.put("records", { id: uid("version"), type: "version", label: `Bản an toàn trước khi khôi phục ${row.label}`.slice(0, 180), content, sourceDocument: context, createdAt: new Date().toISOString() }, owner);
      if (!live(host, epoch)) return;
      if (getValue(host, "document") !== content || (host._versionEditRevision || 0) !== editRevision) throw new Error("Bạn vừa nhập thêm khi lưu bản an toàn. Đã giữ bản hiện tại; chưa khôi phục.");
      getInput(host, "document").value = row.content; host.dataset.versionContext = versionContext(row); host._versionEditRevision = editRevision + 1; await renderCollection(host, "versions"); return notice(host, `Đã khôi phục “${row.label}” ở đây; nội dung cũ đã lưu snapshot nếu có.`);
    }
    if (action === "export-versions") { const rows = await storage.list("records", row => row.type === "version"); download("hh-version-history.json", JSON.stringify({ version: 1, items: rows }, null, 2), "application/json"); return; }
    if (action === "preview-file") { if (fileHasDirtyEdits(host)) throw new Error("Tệp đang có thay đổi chưa lưu. Lưu/áp dụng đổi tên/chuyển thư mục, hoặc Xuất bản nháp rồi dùng Bỏ thay đổi trước khi mở tệp khác."); return previewFile(host, buttonNode.dataset.recordId); }
    if (action === "export-file-draft") { if (!getInput(host, "file-content")) throw new Error("Tệp này không có bản nháp văn bản."); return download(`${slug(getValue(host, "rename") || host._fileSavedName)}-draft.txt`, getValue(host, "file-content")); }
    if (action === "discard-file-draft") { const id = host.dataset.activeFile; if (!id) throw new Error("Chưa có tệp đang mở."); if (buttonNode.dataset.confirmDiscard !== id) { buttonNode.dataset.confirmDiscard = id; buttonNode.textContent = "Xác nhận bỏ thay đổi"; return notice(host, "Bỏ toàn bộ thay đổi chưa áp dụng ở tệp này? Hãy xuất bản nháp nếu cần. Bấm lại để xác nhận.", "warning"); } return previewFile(host, id); }
    if (["delete-file", "export-file", "rename-file", "save-file", "move-file"].includes(action)) return fileAction(host, action, buttonNode.closest("[data-record-id]")?.dataset.recordId, buttonNode);
    if (action === "new-folder") { const name = getValue(host, "folder-name").trim().slice(0, 100); if (!name || /[\\/]/.test(name)) throw new Error("Tên thư mục cần 1–100 ký tự, không chứa / hoặc \\."); const folders = await storage.list("records", row => row.type === "tool-folder"); if (folders.length >= 100 || folders.some(row => row.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error("Thư mục đã có hoặc đã đạt giới hạn 100 thư mục."); const row = { id: uid("folder"), type: "tool-folder", name }; await storage.put("records", row); await renderFolders(host); getInput(host, "file-folder").value = row.id; getInput(host, "folder-name").value = ""; return renderFiles(host); }
    if (action === "delete-folder") { const id = getValue(host, "file-folder"); if (!id) throw new Error("Không thể xóa thư mục gốc."); const files = await storage.list("files", row => row.folderId === id); if (files.length) throw new Error("Thư mục còn tệp; hãy chuyển hoặc xóa tệp trước."); if (!await storage.delete("records", id)) throw new Error("Chưa xóa được thư mục."); await renderFolders(host); return renderFiles(host); }
    if (["format-code", "save-code", "version-code", "export-code", "new-code", "diff-code", "close-code-diff"].includes(action)) return codeAction(host, action);
    if (action === "apply-crop") return drawOcr(host, true);
    if (action === "recognize-ocr") return recognizeOcr(host);
    if (action === "cancel-ocr") { if (active.ocrRun) active.ocrRun.canceled = true; active.ocrWorker?.terminate?.().catch?.(() => {}); active.ocrWorker = null; active.ocrRun = null; return notice(host, "Đã dừng OCR cục bộ. Ảnh và văn bản đang sửa vẫn còn."); }
    if (action === "export-ocr") { const text = getValue(host, "ocr-result"); if (!text.trim()) throw new Error("Chưa có kết quả OCR để xuất."); download("ocr-result.txt", text); return; }
    throw new Error("Thao tác không thuộc workspace này hoặc chưa được hỗ trợ.");
  }

  async function saveAutoDocument(host, manual = false) {
    const status = host.querySelector("[data-tool-save-state]"); if (status) status.textContent = "Đang lưu…";
    try {
      const row = { id: "autosave-document", type: "document", title: getValue(host, "title") || "Bản nháp", content: getValue(host, "document"), updatedAt: new Date().toISOString() };
      await storage.put("records", row, scopeFor(host)); if (status) status.textContent = `Đã lưu ${nowLabel(row.updatedAt)}`; setOutput(host, `${manual ? "Lưu thủ công" : "Auto save"}: ${nowLabel(row.updatedAt)}\n${row.content.length} ký tự`);
    } catch (error) { if (status) status.textContent = "Lưu lỗi · nội dung vẫn còn; Lưu ngay để thử lại hoặc Xuất bản nháp"; throw error; }
  }

  function fileHasDirtyEdits(host) {
    if (!host.dataset.activeFile) return false;
    const content = getInput(host, "file-content"), name = getInput(host, "rename"), folder = getInput(host, "file-destination");
    return Boolean(content && content.value !== host._fileSavedContent || name && name.value !== host._fileSavedName || folder && folder.value !== host._fileSavedFolder);
  }
  function fileEditState(host) { const node = host.querySelector("[data-tool-file-state]"); if (node) node.textContent = fileHasDirtyEdits(host) ? "Có thay đổi chưa ghi vào tệp · Lưu/áp dụng hoặc xuất bản nháp. Mở tệp khác sẽ yêu cầu xử lý bản nháp trước." : "Đang xem bản lưu · thay đổi văn bản chỉ ghi vào tệp khi nhấn Lưu."; }
  async function previewFile(host, id) {
    const epoch = active.epoch;
    const row = await storage.get("files", id); if (!row) return;
    if (!live(host, epoch)) return;
    active.urls.forEach(url => URL.revokeObjectURL(url)); active.urls.clear();
    host.dataset.activeFile = id; host._fileSavedContent = null; host._fileSavedName = row.name; host._fileSavedFolder = row.folderId || ""; host._fileBaseUpdatedAt = row.updatedAt;
    const preview = host.querySelector("[data-tool-preview]"); let content = "";
    if (/^image\/(png|jpeg|webp|gif|avif)$/.test(row.type)) { const url = URL.createObjectURL(row.blob); active.urls.add(url); content = `<img src="${url}" alt="${esc(row.name)}">`; }
    else if (/^(text\/|application\/(json|javascript|xml))/.test(row.type) && row.size < 2_000_000) { const text = await row.blob.text(); if (row.size <= 500000) host._fileSavedContent = text; content = row.size <= 500000 ? `<label class="hh-tool__field"><span>Văn bản · không chạy mã</span><textarea data-tool-input="file-content" spellcheck="false">${esc(text)}</textarea></label>` : `<pre>${esc(text)}</pre>`; }
    else content = '<div class="hh-tool__empty">Không có preview an toàn cho định dạng này.</div>';
    if (!live(host, epoch)) return;
    const folders = await storage.list("records", item => item.type === "tool-folder"); if (!live(host, epoch)) return;
    preview.innerHTML = `<article data-record-id="${esc(row.id)}"><header><label>Đổi tên<input data-tool-input="rename" value="${esc(row.name)}"></label><span>${esc(row.type)} · ${(row.size / 1024).toFixed(1)} KB</span></header>${content}<label class="hh-tool__field"><span>Chuyển tới thư mục</span><select data-tool-input="file-destination"><option value="">Gốc</option>${folders.map(folder => `<option value="${esc(folder.id)}" ${folder.id === row.folderId ? "selected" : ""}>${esc(folder.name)}</option>`).join("")}</select></label><p class="hh-tool__help" data-tool-file-state role="status"></p><footer>${button("rename-file", "Đổi tên")}${content.includes('data-tool-input="file-content"') ? `${button("save-file", "Lưu văn bản")}${button("export-file-draft", "Xuất bản nháp")}` : ""}${button("move-file", "Chuyển thư mục")}${button("export-file", "Tải bản lưu")}${button("discard-file-draft", "Bỏ thay đổi")}${button("delete-file", "Xóa")}</footer></article>`;
    fileEditState(host);
  }

  async function fileAction(host, action, id, buttonNode) {
    const epoch = active.epoch;
    const row = await storage.get("files", id); if (!row) throw new Error("Tệp không còn tồn tại.");
    if (!live(host, epoch)) return;
    if (action === "delete-file") { if (buttonNode?.dataset.confirmDelete !== id) { if (buttonNode) { buttonNode.dataset.confirmDelete = id; buttonNode.textContent = "Xác nhận xóa tệp"; } return notice(host, "Bấm lại để xóa tệp cục bộ và bỏ thay đổi chưa lưu; bản nhị phân không có snapshot tự động. Có thể xuất bản nháp trước.", "warning"); } if (!await storage.delete("files", id, scopeFor(host))) throw new Error("Chưa xóa được tệp."); delete host.dataset.activeFile; host.querySelector("[data-tool-preview]").innerHTML = '<div class="hh-tool__empty">Đã xóa tệp.</div>'; await renderFiles(host); return; }
    if (action === "export-file") return download(row.name, row.blob, row.type);
    const pending = { content: getInput(host, "file-content") ? getValue(host, "file-content") : null, name: getValue(host, "rename"), folder: getValue(host, "file-destination") };
    if (host._fileBaseUpdatedAt && row.updatedAt !== host._fileBaseUpdatedAt && fileHasDirtyEdits(host)) throw new Error("Tệp đã đổi kể từ khi mở bản nháp. Xuất bản nháp rồi Bỏ thay đổi để đọc bản lưu mới; không tự ghi đè.");
    if (action === "save-file") { const content = getValue(host, "file-content"); if (!/^(text\/|application\/(json|javascript|xml))/.test(row.type) || row.size > 500000 || new Blob([content]).size > 500000) throw new Error("Chỉ sửa văn bản tối đa 500 KB."); await storage.put("records", { id: uid("version"), type: "version", label: `Tệp trước khi sửa · ${row.name}`, content: await row.blob.text(), createdAt: new Date().toISOString() }, scopeFor(host)); if (!live(host, epoch)) return; row.blob = new Blob([content], { type: row.type }); row.size = row.blob.size; }
    else if (action === "move-file") { const target = getValue(host, "file-destination"); if (target) { const folder = await storage.get("records", target, scopeFor(host)); if (folder?.type !== "tool-folder") throw new Error("Thư mục đích không tồn tại."); } row.folderId = target; }
    else { const name = getValue(host, "rename").trim(); if (!name || name.length > 180 || /[\\/]/.test(name)) throw new Error("Tên tệp cần 1–180 ký tự, không chứa đường dẫn."); row.name = name; }
    if (!live(host, epoch)) return; row.updatedAt = new Date().toISOString(); await storage.put("files", row, scopeFor(host)); if (!live(host, epoch)) return; await renderFiles(host); await previewFile(host, id); if (!live(host, epoch)) return;
    if (action !== "save-file" && pending.content !== null && getInput(host, "file-content")) getInput(host, "file-content").value = pending.content;
    if (action !== "rename-file" && getInput(host, "rename")) getInput(host, "rename").value = pending.name;
    if (action !== "move-file" && getInput(host, "file-destination")) getInput(host, "file-destination").value = pending.folder;
    fileEditState(host); notice(host, fileHasDirtyEdits(host) ? "Đã áp dụng thao tác; các thay đổi chưa áp dụng vẫn giữ trong bản nháp." : "Đã lưu thay đổi tệp cục bộ.");
  }

  const MONACO_BASE = "/vendor/monaco-0.55.1/min/vs";
  const monacoWorkers = new Set();
  let monacoLoader = null;
  function loadLocalMonaco() {
    if (globalThis.monaco?.editor) return Promise.resolve(globalThis.monaco);
    if (!globalThis.document?.createElement || !globalThis.Worker || !globalThis.location || !/^https?:$/.test(location.protocol)) return Promise.reject(new Error("Monaco cần HTTP(S) và Web Worker; editor văn bản vẫn hoạt động."));
    if (monacoLoader) return monacoLoader;
    monacoLoader = new Promise((resolve, reject) => {
      const workers = { json: "json.worker-DKiEKt88.js", css: "css.worker-HnVq6Ewq.js", html: "html.worker-B51mlPHg.js", javascript: "ts.worker-CMbG-7ft.js", typescript: "ts.worker-CMbG-7ft.js" };
      globalThis.MonacoEnvironment = { ...(globalThis.MonacoEnvironment || {}), getWorker(moduleId, label) { const worker = new Worker(`${MONACO_BASE}/assets/${workers[label] || "editor.worker-Be8ye1pW.js"}`, { type: "module", name: `hh-tool-${label}` }); monacoWorkers.add(worker); return worker; } };
      const stylesheet = document.createElement("link"); stylesheet.rel = "stylesheet"; stylesheet.href = `${MONACO_BASE}/editor/editor.main.css`; document.head.appendChild(stylesheet);
      const loader = document.createElement("script"); loader.src = `${MONACO_BASE}/loader.js`; loader.async = true;
      const timer = setTimeout(() => reject(new Error("Monaco tải quá lâu. Editor văn bản giữ nguyên nội dung; mở lại để thử.")), 15000);
      loader.onerror = () => { clearTimeout(timer); loader.remove(); reject(new Error("Không tải được Monaco cục bộ; editor văn bản vẫn dùng được.")); };
      loader.onload = () => {
        globalThis.require.config({ paths: { vs: MONACO_BASE } });
        globalThis.require(["vs/editor/editor.main"], () => { clearTimeout(timer); resolve(globalThis.monaco); }, error => { clearTimeout(timer); reject(new Error(`Monaco chưa sẵn sàng: ${error?.message || "thiếu tài nguyên"}`)); });
      };
      document.head.appendChild(loader);
    }).catch(error => { monacoLoader = null; throw error; });
    return monacoLoader;
  }
  async function mountCodeEditor(host) {
    const epoch = active.epoch, status = host.querySelector("[data-tool-editor-status]");
    if (globalThis.matchMedia?.("(max-width: 600px), (pointer: coarse)").matches) { if (status) status.textContent = "Editor văn bản dành cho mobile: lưu, xuất và format JSON. Monaco không hỗ trợ trình duyệt mobile chính thức."; return; }
    try {
      const runtime = await loadLocalMonaco(); if (!live(host, epoch)) return;
      const holder = host.querySelector("[data-tool-editor]"), source = getValue(host, "code"); holder.innerHTML = "";
      runtime.languages.typescript?.javascriptDefaults?.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });
      runtime.languages.typescript?.typescriptDefaults?.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false });
      runtime.languages.json?.jsonDefaults?.setDiagnosticsOptions({ validate: true, allowComments: false, enableSchemaRequest: false, schemas: [] });
      const model = runtime.editor.createModel(source, getValue(host, "language") || "javascript");
      holder._editor = monaco.editor.create(holder, { model, theme: "vs-dark", automaticLayout: true, fontSize: 15, wordWrap: "on", tabSize: 2, scrollBeyondLastLine: false, minimap: { enabled: false }, ariaLabel: "Monaco Code Editor riêng · không chạy code" });
      host._codeChangeListener = holder._editor.onDidChangeModelContent(() => { if (live(host, epoch)) { scheduleDraft(host, active.manifest); if (status) status.textContent = "Monaco · có thay đổi chưa lưu vào tài liệu; bản nháp đang giữ tự động."; } });
      host._codeMarkerListener = runtime.editor.onDidChangeMarkers(() => { if (!live(host, epoch)) return; const model = holder._editor.getModel(), problems = host.querySelector("[data-tool-code-problems]"); if (!model || !problems) return; const markers = runtime.editor.getModelMarkers({ resource: model.uri }).slice(0, 50); problems.textContent = markers.length ? markers.map(item => `Dòng ${item.startLineNumber}:${item.startColumn} · ${item.message}`).join("\n") : "Chẩn đoán Monaco: chưa phát hiện lỗi. Đây không phải kiểm thử thực thi."; });
      if (status) status.textContent = "Monaco 0.55.1 cục bộ · Ctrl+F tìm, Ctrl+H thay thế, F1 lệnh. Không chạy code.";
    } catch (error) { if (live(host, epoch)) { if (status) status.textContent = error.message; notice(host, error.message, "warning"); } }
  }
  async function renderCodeDocuments(host) {
    const epoch = active.epoch, select = getInput(host, "code-document"); if (!select) return;
    const rows = await storage.list("records", row => row.type === "code"); if (!live(host, epoch)) return;
    if (!rows.some(row => row.id === "code-document")) rows.unshift({ id: "code-document", title: "main.js" });
    select.innerHTML = rows.map(row => `<option value="${esc(row.id)}">${esc(row.title || "Code chính")}</option>`).join(""); select.value = host.dataset.codeDocument || "code-document";
  }
  function editorValue(host) { const editor = host.querySelector("[data-tool-editor]")?._editor; return editor ? editor.getValue() : getValue(host, "code"); }
  function setEditorValue(host, value, language) { const editor = host.querySelector("[data-tool-editor]")?._editor; if (editor) { editor.setValue(value); if (language) monaco.editor.setModelLanguage(editor.getModel(), language); } else { const input = getInput(host, "code"); if (input) input.value = value; } }
  function clearCodeDiff(host) { host._diffEditor?.dispose?.(); host._diffModels?.forEach(model => model.dispose()); host._diffEditor = null; host._diffModels = []; const panel = host.querySelector("[data-tool-code-diff]"); if (panel) { panel.hidden = true; panel.innerHTML = ""; } }
  async function codeAction(host, action) {
    const epoch = active.epoch, owner = scopeFor(host), editor = host.querySelector("[data-tool-editor]")?._editor, language = getValue(host, "language") || "javascript"; let code = editorValue(host);
    if (code.length > 200000 && action !== "export-code") throw new Error("Tài liệu vượt 200.000 ký tự. Xuất hoặc chia nhỏ trước khi lưu.");
    const id = host.dataset.codeDocument || "code-document", title = getValue(host, "code-title").trim().slice(0, 180) || "main.js";
    if (action === "close-code-diff") { clearCodeDiff(host); return; }
    if (action === "new-code") { await codeAction(host, "save-code"); if (!live(host, epoch)) return; const row = { id: uid("code"), type: "code", title: `document-${Date.now().toString().slice(-4)}.js`, language: "javascript", content: "", updatedAt: new Date().toISOString() }; await storage.put("records", row, owner); if (!live(host, epoch)) return; host.dataset.codeDocument = row.id; getInput(host, "code-title").value = row.title; getInput(host, "language").value = row.language; setEditorValue(host, "", row.language); clearCodeDiff(host); await renderCodeDocuments(host); return; }
    if (action === "diff-code") { const saved = await storage.get("records", id, owner); if (!live(host, epoch)) return; if (!saved) throw new Error("Lưu tài liệu ít nhất một lần trước khi so sánh."); clearCodeDiff(host); const panel = host.querySelector("[data-tool-code-diff]"); if (!panel) return; panel.hidden = false; panel.innerHTML = `<header><strong>Bản lưu → nội dung hiện tại</strong>${button("close-code-diff", "Đóng so sánh")}</header><div data-tool-diff-surface></div>`; const surface = panel.querySelector("[data-tool-diff-surface]"); if (editor) { host._diffModels = [monaco.editor.createModel(saved.content, language), monaco.editor.createModel(code, language)]; host._diffEditor = monaco.editor.createDiffEditor(surface, { theme: "vs-dark", readOnly: true, originalEditable: false, automaticLayout: true, renderSideBySide: false, minimap: { enabled: false }, ariaLabel: "So sánh với bản đã lưu" }); host._diffEditor.setModel({ original: host._diffModels[0], modified: host._diffModels[1] }); } else { const pre = document.createElement("pre"); pre.textContent = compareLines(saved.content, code).text; surface.appendChild(pre); } return; }
    if (action === "format-code") {
      if (editor) { const formatter = editor.getAction("editor.action.formatDocument"); if (language === "markdown") throw new Error("Markdown có tô màu/tìm kiếm nhưng chưa có formatter; không báo format thành công giả."); if (!formatter?.isSupported?.()) throw new Error("Formatter ngôn ngữ đang tải hoặc không hỗ trợ. Hãy thử lại sau."); await formatter.run(); }
      else if (language === "json") { try { code = JSON.stringify(JSON.parse(code), null, 2); getInput(host, "code").value = code; } catch { throw new Error("JSON không hợp lệ."); } }
      else { code = code.split("\n").map(line => line.replace(/\s+$/g, "")).join("\n"); getInput(host, "code").value = code; }
      if (!live(host, epoch)) return; notice(host, editor ? "Đã chạy formatter Monaco; không thực thi mã nguồn." : language === "json" ? "Đã kiểm tra và định dạng JSON." : "Editor văn bản: chỉ bỏ khoảng trắng cuối dòng; chưa có formatter cho ngôn ngữ này.");
    }
    if (action === "save-code") { await storage.put("records", { id, type: "code", title, language, content: code, updatedAt: new Date().toISOString() }, owner); if (!live(host, epoch)) return; await renderCodeDocuments(host); host.querySelector("[data-tool-editor-status]").textContent = `Đã lưu ${title} · ${nowLabel()}`; }
    if (action === "version-code") await storage.put("records", { id: uid("version"), type: "version", label: `Code · ${title} · ${language}`, content: code, sourceDocument: id, createdAt: new Date().toISOString() }, owner);
    if (action === "export-code") download(title.replace(/[\\/]/g, "_") || `code.${({ javascript: "js", typescript: "ts", json: "json", html: "html", css: "css", markdown: "md" })[language] || "txt"}`, code);
  }

  async function loadOcrImage(host, file) {
    const epoch = active.epoch;
    if (!file.type.startsWith("image/")) throw new Error("OCR hiện nhận tệp ảnh. Hãy chuyển trang PDF thành ảnh trước khi tải lên.");
    if (file.size > 20 * 1024 * 1024) throw new Error("Ảnh vượt giới hạn 20 MB.");
    const image = new Image(), url = URL.createObjectURL(file); active.urls.add(url);
    try { await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error("Không đọc được ảnh.")); image.src = url; }); } finally { URL.revokeObjectURL(url); active.urls.delete(url); }
    if (!live(host, epoch)) return;
    active.ocrImage = image; active.ocrFile = file; host.querySelector("[data-tool-ocr-empty]").hidden = true; getInput(host, "crop-w").value = image.naturalWidth; getInput(host, "crop-h").value = image.naturalHeight; drawOcr(host, false);
  }
  function drawOcr(host, crop) {
    const image = active.ocrImage; if (!image) throw new Error("Chọn ảnh trước khi crop."); const canvas = host.querySelector("[data-tool-ocr-canvas]"), context = canvas.getContext("2d");
    const sx = clamp(getValue(host, "crop-x"), 0, image.naturalWidth - 1), sy = clamp(getValue(host, "crop-y"), 0, image.naturalHeight - 1), sw = clamp(getValue(host, "crop-w") || image.naturalWidth, 1, image.naturalWidth - sx), sh = clamp(getValue(host, "crop-h") || image.naturalHeight, 1, image.naturalHeight - sy), scale = Math.min(1, 1200 / Math.max(sw, sh)); canvas.width = Math.max(1, Math.round(sw * scale)); canvas.height = Math.max(1, Math.round(sh * scale)); context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height); if (crop) notice(host, `Đã crop vùng ${Math.round(sw)}×${Math.round(sh)} px.`);
  }
  let ocrLoader = null;
  function loadLocalOcr() {
    if (globalThis.Tesseract?.createWorker) return Promise.resolve(globalThis.Tesseract);
    if (!globalThis.Worker || !globalThis.WebAssembly) return Promise.reject(new Error("Thiết bị chưa hỗ trợ Web Worker/WASM cho OCR cục bộ."));
    if (ocrLoader) return ocrLoader;
    ocrLoader = new Promise((resolve, reject) => {
      const script = document.createElement("script"); script.src = new URL("/vendor/tesseract.min.js?v=6.0.1", location.href).href; script.async = true;
      script.onload = () => globalThis.Tesseract?.createWorker ? resolve(globalThis.Tesseract) : reject(new Error("Engine OCR đã tải nhưng chưa sẵn sàng."));
      script.onerror = () => { script.remove(); reject(new Error("Không tải được engine OCR cục bộ. Kiểm tra mạng/cache rồi thử lại.")); };
      document.head.append(script);
    }).catch(error => { ocrLoader = null; throw error; });
    return ocrLoader;
  }
  async function recognizeOcr(host) {
    if (!active.ocrImage) throw new Error("Chọn ảnh trước khi nhận dạng.");
    if (active.ocrRun) throw new Error("OCR đang chạy. Chờ kết quả hoặc Hủy nhận dạng.");
    const epoch = active.epoch, run = { canceled: false }, canvas = host.querySelector("[data-tool-ocr-canvas]"), owner = scopeFor(host);
    const current = () => live(host, epoch) && !run.canceled;
    active.ocrRun = run; setState(host, "running", "Đang nhận dạng OCR");
    let text = "", confidence = null, engine = "", worker = null;
    try {
      if (globalThis.TextDetector) {
        const detector = new TextDetector(), blocks = await detector.detect(canvas); if (!current()) return;
        text = blocks.map(item => item.rawValue).join("\n"); const measured = blocks.map(item => item.confidence).filter(value => typeof value === "number" && Number.isFinite(value)); confidence = measured.length === blocks.length && measured.length ? Math.round(measured.reduce((sum, value) => sum + value, 0) / measured.length * 100) : null; engine = "TextDetector cục bộ";
      } else {
        const tesseract = await loadLocalOcr(); if (!current()) return;
        const languages = ({ vi: "vie", en: "eng", "vi+en": "vie+eng" })[getValue(host, "ocr-language")] || "vie+eng";
        worker = await tesseract.createWorker(languages, 1, {
          workerPath: new URL("/vendor/tesseract-worker.min.js?v=6.0.1", location.href).href,
          corePath: new URL("/vendor/tesseract-core-simd-lstm.wasm.js?v=6.0.0", location.href).href,
          langPath: new URL("/vendor/tessdata/", location.href).href.replace(/\/$/, ""),
          logger: progress => { if (!current()) return; const labels = { "loading tesseract core": "Đang tải engine WASM", "loading language traineddata": "Đang tải dữ liệu ngôn ngữ", "initializing api": "Đang khởi tạo OCR", "recognizing text": "Đang nhận dạng chữ" }; const label = labels[progress.status] || "Đang chuẩn bị OCR"; notice(host, `${label}${Number.isFinite(progress.progress) ? ` · ${Math.round(clamp(progress.progress, 0, 1) * 100)}% của bước hiện tại` : ""}. Ảnh không rời thiết bị.`); }
        });
        if (!current()) return; active.ocrWorker = worker;
        const result = await worker.recognize(canvas); if (!current()) return;
        text = String(result.data?.text || ""); confidence = Number.isFinite(result.data?.confidence) ? Math.round(result.data.confidence) : null; engine = `Tesseract cục bộ · ${languages}`;
      }
      if (!current()) return;
      if (!text.trim()) throw new Error("OCR không tìm thấy văn bản trong vùng đã chọn.");
      getInput(host, "ocr-result").value = text; host.querySelector("[data-tool-confidence]").textContent = `Độ tin cậy: ${confidence == null ? "engine không cung cấp" : `${confidence}%`} · ${engine}`;
      setState(host, "done", "OCR hoàn tất"); notice(host, "Đã nhận dạng cục bộ. Kiểm tra và sửa lỗi chữ trước khi xuất.");
      await storage.put("history", { id: uid("event"), tool: "ocr", action: "recognize", summary: `${text.length} ký tự`, detail: { confidence, engine }, createdAt: new Date().toISOString() }, owner);
    } catch (error) { if (!current()) return; throw error;
    } finally {
      if (worker) await worker.terminate().catch(() => {});
      if (active.ocrWorker === worker) active.ocrWorker = null;
      if (active.ocrRun === run) active.ocrRun = null;
    }
  }
  function blobToBase64(blob) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(blob); }); }
  function base64ToBlob(value, type) { const binary = atob(String(value).replace(/^data:[^,]+,/, "")), bytes = new Uint8Array(binary.length); for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index); return new Blob([bytes], { type }); }

  async function handleClick(event, work, name) {
    const epoch = active.epoch;
    const manifest = resolveManifest(name); if (!manifest || !work.contains(event.target) || !live(work)) return false;
    const actionNode = event.target.closest("[data-tool-action]"); if (!actionNode) return false;
    event.preventDefault();
    try {
      const action = actionNode.dataset.toolAction;
      setState(work, "running", "Đang xử lý");
      await runAction(action, actionNode, work, manifest);
      if (!live(work, epoch)) return true;
      const keepsRunning = ["start-recognition", "start-media-record", "speak"].includes(action);
      if (!keepsRunning && work.querySelector('[data-tool-state="running"]')) setState(work, "done", "Hoàn thành");
      await saveDraft(work, manifest);
    }
    catch (error) { if (error.name !== "AbortError" && live(work, epoch)) { setState(work, "error", "Có lỗi"); notice(work, error.message || "Không thể thực hiện công cụ.", "error"); } }
    return true;
  }

  async function handleChange(event, work, name) {
    const epoch = active.epoch;
    const manifest = resolveManifest(name); if (!manifest || !live(work)) return false;
    const owner = scopeFor(work);
    if (manifest.id === "speech-to-text" && event.target.matches("[data-tool-subtitle-file]")) {
      const file = event.target.files?.[0]; if (!file) return true; if (file.size > 1048576) throw new Error("Phụ đề vượt 1 MB. Không đọc hoặc gửi file.");
      const source = await file.text(), parsed = parseSubtitles(source); if (!live(work, epoch)) return true;
      active.subtitleCues = parsed.cues; active.subtitleOrigin = parsed.origin; getInput(work, "subtitle-source").value = source; renderSubtitleTimeline(work); await saveDraft(work, manifest); if (!live(work, epoch)) return true; notice(work, `Đã nhập ${parsed.cues.length} cue từ ${file.name}. Không tải lên máy chủ. ${parsed.warnings.join(" ")}`); event.target.value = ""; return true;
    }
    if (manifest.id === "version-history" && event.target.matches("[data-version-select]")) { const id = event.target.dataset.versionSelect; work._selectedVersions ||= new Set(); if (event.target.checked) { if (work._selectedVersions.size >= 2 && !work._selectedVersions.has(id)) { event.target.checked = false; return notice(work, "Chỉ chọn hai snapshot để so sánh.", "warning"); } const row = await storage.get("records", id, owner); if (!live(work, epoch)) return true; if (row?.type !== "version") throw new Error("Snapshot không tồn tại."); if (work._selectedVersions.size >= 2 && !work._selectedVersions.has(id)) { event.target.checked = false; return notice(work, "Chỉ chọn hai snapshot để so sánh.", "warning"); } work._selectedVersions.add(id); work._versionLabels?.set(id, row.label); } else work._selectedVersions.delete(id); renderVersionSelection(work); return true; }
    if (manifest.id === "version-history" && event.target.matches('[data-tool-input="version-document"],[data-tool-input="version-sort"],[data-tool-input="version-page-size"]')) { work._versionPage = 0; await renderCollection(work, "versions"); scheduleDraft(work, manifest); return true; }
    if (event.target.matches("[data-widget-task]")) { const target = event.target, taskId = target.dataset.widgetTask, checked = target.checked; await updateWidget(work, target.closest("article[data-widget-prefix]"), row => { const task = (row.tasks || []).find(item => item.id === taskId); if (task) task.done = checked; }, false); return true; }
    if (event.target.matches("[data-tool-file]")) {
      const files = [...event.target.files]; if (files.length > 20 || files.some(file => file.size > 20 * 1024 * 1024)) throw new Error("Mỗi lần tối đa 20 tệp, mỗi tệp 20 MB."); const folderId = getValue(work, "file-folder"); for (const file of files) { if (!live(work)) return true; await storage.put("files", { id: uid("file"), name: file.name, type: file.type || "application/octet-stream", size: file.size, folderId, blob: file, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, owner); } if (live(work)) { await renderFiles(work); await record(manifest.id, "upload", `${files.length} tệp`); } return true;
    }
    if (event.target.matches("[data-tool-prompt-file]")) { const file = event.target.files?.[0]; if (!file) return true; if (file.size > 2000000) throw new Error("JSON vượt 2 MB."); let parsed; try { parsed = JSON.parse(await file.text()); } catch { throw new Error("Tệp JSON không hợp lệ."); } const rows = validatePromptImport(parsed); if (!live(work, epoch)) return true; let count = 0; try { for (const row of rows) { if (!live(work, epoch)) return true; await storage.put("records", { id: uid("prompt"), type: "prompt", ...row, updatedAt: new Date().toISOString() }, owner); count += 1; } } catch (error) { throw new Error(`Đã nhập ${count}/${rows.length} prompt trước khi lỗi lưu: ${error.message}`); } if (live(work, epoch)) { await renderCollection(work, "prompts"); notice(work, `Đã nhập ${count} prompt mới; không ghi đè prompt có sẵn.`); } event.target.value = ""; return true; }
    if (event.target.matches("[data-tool-ocr-file]")) { const file = event.target.files?.[0]; if (file) await loadOcrImage(work, file).catch(error => notice(work, error.message, "error")); return true; }
    if (event.target.matches("[data-tool-media-file]")) { const file = event.target.files?.[0]; if (file) { active.mediaFile = file; active.transcriptSegments = []; setOutput(work, `Đã chọn ${file.name}\n${file.type || "unknown"} · ${(file.size / 1024 / 1024).toFixed(2)} MB`); } return true; }
    if (event.target.matches("[data-tool-ai-file]")) {
      const file = event.target.files?.[0]; if (!file) return true; if (file.size > 500_000) { notice(work, "Tệp văn bản vượt quá 500 KB.", "error"); return true; }
      if (!/^(text\/|application\/json)/.test(file.type) && !/\.(md|txt|csv|json)$/i.test(file.name)) throw new Error("Chỉ nhận tệp văn bản TXT/MD/CSV/JSON."); const content = await file.text(); if (!live(work, epoch)) return true; active.aiAttachment = { name: file.name, type: file.type || "text/plain", text: content };
      notice(work, `Đã đính kèm ${file.name}. Tệp chỉ được gửi khi bạn nhấn Gửi.`); return true;
    }
    if (event.target.matches('[data-tool-input="language"]') && manifest.id === "monaco-code-editor") { work.querySelector("[data-tool-editor]")?._editor?.getModel?.() && monaco.editor.setModelLanguage(work.querySelector("[data-tool-editor]")._editor.getModel(), event.target.value); clearCodeDiff(work); scheduleDraft(work, manifest); return true; }
    if (event.target.matches('[data-tool-input="code-document"]') && manifest.id === "monaco-code-editor") { const id = event.target.value; await codeAction(work, "save-code"); const row = await storage.get("records", id, owner); if (!live(work, epoch)) return true; if (!row || row.type !== "code") throw new Error("Tài liệu code không tồn tại."); work.dataset.codeDocument = id; getInput(work, "code-title").value = row.title || "main.js"; getInput(work, "language").value = row.language; setEditorValue(work, row.content, row.language); clearCodeDiff(work); await renderCodeDocuments(work); scheduleDraft(work, manifest); return true; }
    if (manifest.id === "file-explorer" && event.target.matches('[data-tool-input="file-folder"]')) { await renderFiles(work); return true; }
    if (manifest.id === "file-explorer" && event.target.matches('[data-tool-input="file-destination"]')) { fileEditState(work); scheduleDraft(work, manifest); return true; }
    if (manifest.id === "ai-prompt-library" && event.target.matches('[data-tool-input="prompt-favorites"]')) { await renderCollection(work, "prompts"); return true; }
    if (manifest.id === "widget-marketplace" && event.target.matches('[data-tool-input="category"]')) { await renderMarketplace(work); return true; }
    return false;
  }

  function handleInput(event, work, name) {
    const manifest = resolveManifest(name); if (!manifest || !live(work)) return false;
    if (manifest.id === "version-history" && event.target.matches("[data-version-label]")) { const id = event.target.closest("[data-record-id]")?.dataset.recordId; if (id) { work._versionLabelDrafts ||= new Map(); work._versionLabelDrafts.set(id, String(event.target.value).slice(0, 180)); } return true; }
    if (manifest.id === "speech-to-text" && event.target.matches("[data-subtitle-field]")) {
      const id = event.target.closest("[data-subtitle-cue]")?.dataset.subtitleCue, fieldName = event.target.dataset.subtitleField, index = active.subtitleCues.findIndex(row => row.id === id); if (index < 0 || !["start", "end", "text"].includes(fieldName)) return false;
      const row = active.subtitleCues[index], candidate = active.subtitleCues.map((item, ordinal) => ordinal === index ? { ...item, [fieldName]: String(event.target.value) } : item);
      try { active.subtitleCues = normalizeSubtitleDraft({ version: 1, origin: active.subtitleOrigin, cues: candidate }).cues; subtitleValidation(work); scheduleDraft(work, manifest); } catch (error) { event.target.value = row[fieldName]; notice(work, error.message, "error"); }
      return true;
    }
    if (event.target.matches("[data-widget-content]")) { const content = event.target.value.slice(0, 200000); updateWidget(work, event.target.closest("article[data-widget-prefix]"), row => { row.content = content; }, false).catch(error => notice(work, error.message, "error")); return true; }
    if (event.target.matches("[data-tool-input]")) scheduleDraft(work, manifest);
    if (manifest.id === "version-history" && event.target.matches('[data-tool-input="document"]')) { work._versionEditRevision = (work._versionEditRevision || 0) + 1; return true; }
    if (manifest.id === "version-history" && event.target.matches('[data-tool-input="version-filter"]')) { work._versionPage = 0; if (work._versionFilterTimer) { clearTimeout(work._versionFilterTimer); active.timers.delete(work._versionFilterTimer); } const epoch = active.epoch, timer = setTimeout(() => { active.timers.delete(timer); work._versionFilterTimer = null; if (live(work, epoch)) renderCollection(work, "versions").catch(error => notice(work, error.message, "error")); }, 160); work._versionFilterTimer = timer; active.timers.add(timer); return true; }
    if (manifest.id === "file-explorer" && event.target.matches('[data-tool-input="file-content"],[data-tool-input="rename"]')) { fileEditState(work); return true; }
    if (manifest.id === "workspace-tabs" && event.target.matches('[data-tool-input="document"],[data-tool-input="title"]')) { work._tabDirty = true; tabState(work, "Có thay đổi · nhấn Lưu hoặc chuyển tab để lưu tài liệu."); return true; }
    if (manifest.id === "ai-prompt-library" && event.target.matches('[data-tool-input="content"]')) { renderVariables(work); return true; }
    if (manifest.id === "ai-prompt-library" && event.target.matches('[data-tool-input="prompt-filter"]')) { renderCollection(work, "prompts").catch(error => notice(work, error.message, "error")); return true; }
    if (event.target.matches('input[type="range"]')) { const node = work.querySelector(`[data-tool-range-output="${event.target.dataset.toolInput}"]`); if (node) node.textContent = `${Number(event.target.value).toFixed(1)}${event.target.dataset.toolInput === "rate" ? "×" : ""}`; return true; }
    if (manifest.id === "auto-save" && event.target.matches('[data-tool-input="document"],[data-tool-input="title"]')) { if (work._autoTimer) { clearTimeout(work._autoTimer); active.timers.delete(work._autoTimer); } const status = work.querySelector("[data-tool-save-state]"); if (status) status.textContent = "Có thay đổi · chuẩn bị lưu…"; const timer = setTimeout(() => { active.timers.delete(timer); work._autoTimer = null; if (live(work)) saveAutoDocument(work).catch(error => notice(work, error.message, "error")); }, 600); work._autoTimer = timer; active.timers.add(timer); return true; }
    if (manifest.id === "widget-marketplace" && event.target.matches('[data-tool-input="filter"]')) { renderMarketplace(work).catch(error => notice(work, error.message, "error")); return true; }
    if (manifest.id === "file-explorer" && event.target.matches('[data-tool-input="file-filter"]')) { renderFiles(work).catch(error => notice(work, error.message, "error")); return true; }
    return false;
  }

  function mount(host, options = {}) {
    registerWorkspaceBackup();
    const value = options.toolId || options.name || TOOL_MANIFESTS[0].id;
    const manifest = resolveManifest(value);
    if (!manifest || !render(host, manifest.id, options)) return null;
    const clickHandler = event => { handleClick(event, host, manifest.id); };
    const inputHandler = event => { handleInput(event, host, manifest.id); };
    const changeHandler = event => { handleChange(event, host, manifest.id).catch(error => { if (live(host)) notice(host, error.message, "error"); }); };
    host.addEventListener("click", clickHandler);
    host.addEventListener("input", inputHandler);
    host.addEventListener("change", changeHandler);
    const epoch = active.epoch;
    const authHandler = () => { if (active.host !== host || active.epoch !== epoch || scopeFor(host) === accountScope(host._toolOptions)) return; cleanup(); host.innerHTML = '<section class="hh-tool__empty" role="status">Tài khoản đã đổi. Mở lại công cụ để dùng dữ liệu đúng tài khoản.</section>'; };
    globalThis.addEventListener?.("hh:auth-change", authHandler);
    const detach = () => { host.removeEventListener("click", clickHandler); host.removeEventListener("input", inputHandler); host.removeEventListener("change", changeHandler); globalThis.removeEventListener?.("hh:auth-change", authHandler); };
    active.detach = detach;
    return {
      root: host.querySelector("[data-hh-tool]"),
      ready: host._toolReady,
      cleanup: () => {
        host.removeEventListener("click", clickHandler);
        host.removeEventListener("input", inputHandler);
        host.removeEventListener("change", changeHandler);
        if (active.host === host && active.epoch === epoch) cleanup();
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
    formatTranscript,
    formatSegments,
    parseSubtitleTime,
    parseSubtitles,
    validateSubtitleCues,
    normalizeSubtitleDraft,
    selectVersionPage,
    validateVersionContent,
    validatePlugin,
    runPlugin,
    promptVariables,
    fillPrompt,
    validatePromptImport,
    compareLines,
    decodeSpeechAudio,
    normalizeWorkspaceData,
    exportWorkspaceData,
    importWorkspaceData,
    requestAi,
    accountScope,
    renderMarkup: value => { const manifest = resolveManifest(value); return manifest ? markup(manifest) : ""; }
  };
  globalThis.HHToolWorkspace = api;
  registerWorkspaceBackup();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
