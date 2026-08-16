(function chatAIHubModule(globalScope, factory) {
  "use strict";
  const api = factory(globalScope || {});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope && typeof globalScope === "object") globalScope.HHChatAI = api;
})(typeof window !== "undefined" ? window : globalThis, function createChatAIHub(globalScope) {
  "use strict";

  const VERSION = "1.0.1";
  const STORAGE_SCHEMA = "hh.chat.ai.v1";
  const MAX_SESSIONS = 40;
  const MAX_MESSAGES = 80;
  const MAX_TEXT_FILE = 220_000;
  const MAX_BINARY_FILE = 1_550_000;
  const MODELS = Object.freeze([
    { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash", detail: "Mạnh · đa phương thức" },
    { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", detail: "Lập luận sâu" },
    { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", detail: "Nhanh · tiết kiệm" },
    { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview", detail: "Preview · chi phí cao" }
  ]);
  const MODES = Object.freeze([
    { id: "chat", icon: "✦", label: "Trò chuyện", action: "chat", search: false, prompt: "Trả lời trực tiếp, rõ ràng và hữu ích." },
    { id: "research", icon: "⌕", label: "Nghiên cứu", action: "research", search: true, prompt: "Nghiên cứu bằng Google Search, ghi nguồn cạnh từng dữ kiện mới và tách rõ suy luận." },
    { id: "code", icon: "</>", label: "Lập trình", action: "chat", search: false, prompt: "Phân tích code như senior engineer; ưu tiên giải pháp chạy được, bảo mật và có kiểm thử." },
    { id: "write", icon: "✎", label: "Viết", action: "chat", search: false, prompt: "Đóng vai biên tập viên; viết tự nhiên, đúng đối tượng và tránh câu chữ rập khuôn." },
    { id: "study", icon: "◎", label: "Học tập", action: "chat", search: false, prompt: "Giải thích theo từng tầng, hỏi kiểm tra ngắn và không đưa đáp án bài tập trước khi người học trả lời." },
    { id: "vision", icon: "◫", label: "Phân tích tệp", action: "chat", search: false, prompt: "Đọc kỹ ảnh, PDF hoặc văn bản đính kèm; chỉ kết luận từ nội dung thực sự nhìn thấy." }
  ]);
  const PROMPTS = Object.freeze([
    ["Tóm tắt thông minh", "Tóm tắt nội dung sau thành: ý chính, dữ kiện quan trọng, điểm chưa chắc chắn và 5 hành động tiếp theo."],
    ["Giải thích dễ hiểu", "Giải thích chủ đề sau theo ba mức: người mới, người đã biết cơ bản và người muốn áp dụng thực tế."],
    ["Sửa code có kiểm thử", "Phân tích lỗi trong code sau, nêu nguyên nhân gốc, đưa bản sửa tối thiểu và viết các ca kiểm thử quan trọng."],
    ["Nghiên cứu có nguồn", "Nghiên cứu chủ đề sau bằng nguồn hiện hành đáng tin cậy. Ghi nguồn ngay cạnh luận điểm và tách dữ kiện khỏi suy luận."],
    ["Viết nội dung đa nền tảng", "Từ ý tưởng sau, tạo phiên bản YouTube, TikTok, Facebook và bài blog; giữ cùng thông điệp nhưng tối ưu riêng từng nền tảng."],
    ["So sánh quyết định", "Lập bảng so sánh các lựa chọn sau theo lợi ích, chi phí, rủi ro, khả năng đảo ngược và đề xuất có điều kiện."],
    ["Phân tích ảnh/PDF", "Đọc tệp đính kèm, mô tả nội dung, trích dữ kiện chính, phát hiện điểm bất thường và nêu điều không thể xác minh."],
    ["Lập kế hoạch", "Biến mục tiêu sau thành kế hoạch theo tuần, đầu ra đo lường được, rủi ro, phụ thuộc và checklist hoàn thành."]
  ]);
  let instance = null;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);
  }
  function clean(value, max = 12000) { return String(value == null ? "" : value).trim().slice(0, max); }
  function safeUrl(value) { try { const url = new URL(String(value || "")); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; } }
  function uid(prefix = "id") { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
  function nowLabel() { return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date()); }
  function ownerId(options = {}) {
    const user = options.currentUser || {};
    return clean(user._id || user.id || user.email || "guest", 180).replace(/[^a-z0-9@._-]/gi, "_") || "guest";
  }
  function storageKey(owner) { return `${STORAGE_SCHEMA}:${owner}`; }
  function blankSession(title = "Cuộc trò chuyện mới") { return { id: uid("chat"), title, pinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [] }; }
  function defaultState() {
    const session = blankSession();
    return { version: VERSION, activeId: session.id, sessions: [session], model: "gemini-3.6-flash", thinkingLevel: "medium", mode: "chat", googleSearch: false, systemPrompt: "Bạn là HH Chat AI, trợ lý Gemini chính xác, hữu ích và trả lời bằng tiếng Việt tự nhiên.", draft: "", panel: "context" };
  }
  function normalizeMessage(message, index) {
    const role = message?.role === "assistant" ? "assistant" : "user";
    return { id: clean(message?.id, 120) || `message-${index}`, role, text: clean(message?.text, 48000), createdAt: message?.createdAt || new Date().toISOString(), provider: clean(message?.provider, 80), model: clean(message?.model, 100), latencyMs: Math.max(0, Number(message?.latencyMs) || 0), usage: message?.usage && typeof message.usage === "object" ? message.usage : null, sources: (Array.isArray(message?.sources) ? message.sources : []).map((source) => ({ title: clean(source?.title || source?.url, 240), url: safeUrl(source?.url) })).filter((source) => source.url).slice(0, 12), attachments: (Array.isArray(message?.attachments) ? message.attachments : []).map((file) => ({ name: clean(file?.name, 180), mimeType: clean(file?.mimeType, 80), size: Math.max(0, Number(file?.size) || 0) })).slice(0, 4), stopped: Boolean(message?.stopped), error: Boolean(message?.error) };
  }
  function normalizeState(raw) {
    const base = defaultState();
    const source = raw && typeof raw === "object" ? raw : {};
    const sessions = (Array.isArray(source.sessions) ? source.sessions : []).slice(0, MAX_SESSIONS).map((session, index) => ({ id: clean(session?.id, 120) || `session-${index}`, title: clean(session?.title, 120) || "Cuộc trò chuyện", pinned: Boolean(session?.pinned), createdAt: session?.createdAt || new Date().toISOString(), updatedAt: session?.updatedAt || session?.createdAt || new Date().toISOString(), messages: (Array.isArray(session?.messages) ? session.messages : []).slice(-MAX_MESSAGES).map(normalizeMessage) }));
    if (!sessions.length) sessions.push(base.sessions[0]);
    const model = MODELS.some((item) => item.id === source.model) ? source.model : base.model;
    const mode = MODES.some((item) => item.id === source.mode) ? source.mode : base.mode;
    const thinkingLevel = ["minimal", "low", "medium", "high"].includes(source.thinkingLevel) ? source.thinkingLevel : base.thinkingLevel;
    return { ...base, sessions, activeId: sessions.some((session) => session.id === source.activeId) ? source.activeId : sessions[0].id, model, mode, thinkingLevel, googleSearch: Boolean(source.googleSearch), systemPrompt: clean(source.systemPrompt, 2000) || base.systemPrompt, draft: clean(source.draft, 24000), panel: ["context", "prompts", "settings", "artifacts"].includes(source.panel) ? source.panel : "context" };
  }
  function readState(storage, owner) { try { return normalizeState(JSON.parse(storage?.getItem(storageKey(owner)) || "{}")); } catch { return defaultState(); } }
  function writeState(runtime) {
    if (runtime.incognito) return;
    runtime.state.version = VERSION;
    try { runtime.storage?.setItem(storageKey(runtime.owner), JSON.stringify(runtime.state)); } catch { runtime.storageError = true; }
  }
  function currentSession(runtime) { return runtime.incognito ? runtime.privateSession : runtime.state.sessions.find((session) => session.id === runtime.state.activeId) || runtime.state.sessions[0]; }
  function currentMode(runtime) { return MODES.find((mode) => mode.id === runtime.state.mode) || MODES[0]; }
  function sortSessions(sessions) { return [...sessions].sort((a, b) => Number(b.pinned) - Number(a.pinned) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt)); }

  function inlineMarkup(text) {
    let output = escapeHtml(text);
    output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>");
    return output.replace(/https?:\/\/[^\s<]+/g, (raw) => { const url = safeUrl(raw.replace(/[),.;]+$/, "")); return url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(raw)}</a>` : escapeHtml(raw); });
  }
  function textBlockMarkup(text) {
    return String(text || "").split(/\r?\n/).map((line) => {
      if (/^###\s+/.test(line)) return `<h4>${inlineMarkup(line.replace(/^###\s+/, ""))}</h4>`;
      if (/^##\s+/.test(line)) return `<h3>${inlineMarkup(line.replace(/^##\s+/, ""))}</h3>`;
      if (/^#\s+/.test(line)) return `<h2>${inlineMarkup(line.replace(/^#\s+/, ""))}</h2>`;
      if (/^[-*]\s+/.test(line)) return `<li>${inlineMarkup(line.replace(/^[-*]\s+/, ""))}</li>`;
      if (/^>\s?/.test(line)) return `<blockquote>${inlineMarkup(line.replace(/^>\s?/, ""))}</blockquote>`;
      return line.trim() ? `<p>${inlineMarkup(line)}</p>` : "<br>";
    }).join("").replace(/(?:<li>[\s\S]*?<\/li>)+/g, (list) => `<ul>${list}</ul>`);
  }
  function markdownMarkup(text, messageId) {
    return String(text || "").split(/```/).map((block, index) => {
      if (index % 2 === 0) return textBlockMarkup(block);
      const newline = block.indexOf("\n");
      const language = newline > -1 ? clean(block.slice(0, newline), 30) : "text";
      const code = newline > -1 ? block.slice(newline + 1) : block;
      return `<section class="chat-ai-code"><header><span>${escapeHtml(language || "code")}</span><button type="button" data-chat-ai-copy-code="${escapeHtml(messageId)}:${index}">Sao chép code</button></header><pre><code data-chat-ai-code="${escapeHtml(messageId)}:${index}">${escapeHtml(code)}</code></pre></section>`;
    }).join("");
  }
  function sourceMarkup(sources) {
    if (!sources?.length) return "";
    return `<nav class="chat-ai-sources" aria-label="Nguồn tham khảo">${sources.map((source, index) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer"><i>${index + 1}</i><span>${escapeHtml(source.title || new URL(source.url).hostname)}</span></a>`).join("")}</nav>`;
  }
  function messageMarkup(message) {
    const assistant = message.role === "assistant";
    return `<article class="chat-ai-message ${assistant ? "is-assistant" : "is-user"}${message.error ? " is-error" : ""}" data-chat-ai-message="${escapeHtml(message.id)}"><div class="chat-ai-avatar">${assistant ? "G" : "B"}</div><section><header><strong>${assistant ? "Gemini · HH" : "Bạn"}</strong><span>${escapeHtml(nowLabelFrom(message.createdAt))}</span>${message.model ? `<em>${escapeHtml(message.model)}</em>` : ""}</header><div class="chat-ai-message__body">${message.loading ? `<div class="chat-ai-thinking"><i></i><i></i><i></i><span>Gemini đang xử lý ngữ cảnh…</span></div>` : markdownMarkup(message.text, message.id)}</div>${message.attachments?.length ? `<div class="chat-ai-file-chips">${message.attachments.map((file) => `<span>${file.mimeType === "application/pdf" ? "PDF" : file.mimeType?.startsWith("image/") ? "Ảnh" : "TXT"} · ${escapeHtml(file.name)}</span>`).join("")}</div>` : ""}${sourceMarkup(message.sources)}${assistant && !message.loading ? `<footer><button type="button" data-chat-ai-copy="${escapeHtml(message.id)}">Sao chép</button><button type="button" data-chat-ai-regenerate="${escapeHtml(message.id)}">Tạo lại</button><button type="button" data-chat-ai-speak="${escapeHtml(message.id)}">Đọc</button><button type="button" data-chat-ai-branch="${escapeHtml(message.id)}">Tách nhánh</button></footer>` : ""}</section></article>`;
  }
  function nowLabelFrom(value) { const date = new Date(value); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(date) : ""; }
  function sessionsMarkup(runtime) {
    const query = runtime.query.toLocaleLowerCase("vi");
    return sortSessions(runtime.state.sessions).filter((session) => !query || `${session.title} ${session.messages.map((message) => message.text).join(" ")}`.toLocaleLowerCase("vi").includes(query)).map((session) => `<article class="chat-ai-session${session.id === runtime.state.activeId && !runtime.incognito ? " is-active" : ""}"><button type="button" data-chat-ai-session="${escapeHtml(session.id)}"><i>${session.pinned ? "◆" : "◇"}</i><span><strong>${escapeHtml(session.title)}</strong><small>${session.messages.length} tin · ${escapeHtml(nowLabelFrom(session.updatedAt))}</small></span></button><button type="button" data-chat-ai-pin="${escapeHtml(session.id)}" aria-label="${session.pinned ? "Bỏ ghim" : "Ghim"}">${session.pinned ? "●" : "○"}</button><button type="button" data-chat-ai-delete="${escapeHtml(session.id)}" aria-label="Xóa cuộc trò chuyện">×</button></article>`).join("") || `<div class="chat-ai-empty-small">Không tìm thấy cuộc trò chuyện.</div>`;
  }
  function pendingMarkup(runtime) {
    return runtime.pending.map((file, index) => `<article><i>${file.mimeType === "application/pdf" ? "PDF" : file.mimeType.startsWith("image/") ? "IMG" : "TXT"}</i><span><strong>${escapeHtml(file.name)}</strong><small>${Math.max(1, Math.round(file.size / 1024))} KB</small></span><button type="button" data-chat-ai-remove-file="${index}" aria-label="Bỏ tệp">×</button></article>`).join("");
  }
  function artifactsMarkup(session) {
    const artifacts = [];
    session.messages.filter((message) => message.role === "assistant").forEach((message) => String(message.text || "").split(/```/).forEach((part, index) => { if (index % 2) { const newline = part.indexOf("\n"); artifacts.push({ language: newline > -1 ? part.slice(0, newline) : "text", code: newline > -1 ? part.slice(newline + 1) : part, messageId: message.id }); } }));
    return artifacts.length ? artifacts.map((artifact, index) => `<article><header><strong>${escapeHtml(artifact.language || "code")}</strong><button type="button" data-chat-ai-download-artifact="${index}">Tải file</button></header><pre>${escapeHtml(artifact.code.slice(0, 1200))}</pre></article>`).join("") : `<div class="chat-ai-empty-small">Code block từ câu trả lời sẽ xuất hiện tại đây.</div>`;
  }
  function rightPanelMarkup(runtime, session) {
    const panel = runtime.state.panel;
    return `<aside class="chat-ai-inspector"><nav>${[["context","Ngữ cảnh"],["prompts","Prompt"],["artifacts","Tệp code"],["settings","Cài đặt"]].map(([id, label]) => `<button type="button" class="${panel === id ? "is-active" : ""}" data-chat-ai-panel="${id}">${label}</button>`).join("")}</nav><div class="chat-ai-inspector__body">${panel === "prompts" ? `<section class="chat-ai-prompt-grid">${PROMPTS.map(([title, prompt], index) => `<button type="button" data-chat-ai-prompt="${index}"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(prompt.slice(0, 92))}</span></button>`).join("")}</section>` : panel === "artifacts" ? `<section class="chat-ai-artifacts" data-chat-ai-artifacts>${artifactsMarkup(session)}</section>` : panel === "settings" ? `<section class="chat-ai-settings"><label><span>Tên cuộc trò chuyện</span><input data-chat-ai-title value="${escapeHtml(session.title)}" maxlength="120" ${runtime.incognito ? "disabled" : ""}></label><label><span>Chỉ dẫn hệ thống</span><textarea data-chat-ai-system maxlength="2000" rows="7">${escapeHtml(runtime.state.systemPrompt)}</textarea></label><label><span>Mức suy luận</span><select data-chat-ai-thinking>${[["minimal","Tối thiểu"],["low","Thấp"],["medium","Cân bằng"],["high","Cao"]].map(([id,label]) => `<option value="${id}" ${runtime.state.thinkingLevel === id ? "selected" : ""}>${label}</option>`).join("")}</select></label><label class="chat-ai-toggle"><input type="checkbox" data-chat-ai-search-toggle ${runtime.state.googleSearch ? "checked" : ""}><span>Dùng Google Search khi cần dữ kiện mới</span></label><button type="button" data-chat-ai-reset-system>Khôi phục chỉ dẫn mặc định</button><small>API key chỉ nằm trên Vercel. Lịch sử mặc định lưu cục bộ theo tài khoản; Chế độ riêng tư không lưu hội thoại.</small></section>` : `<section class="chat-ai-context"><article><span>MODEL</span><strong>${escapeHtml(MODELS.find((model) => model.id === runtime.state.model)?.label || runtime.state.model)}</strong><small>${escapeHtml(runtime.state.thinkingLevel)} thinking</small></article><article><span>HỘI THOẠI</span><strong>${session.messages.length} tin nhắn</strong><small>${runtime.incognito ? "Không lưu" : "Đã lưu trên thiết bị"}</small></article><article><span>TÌM KIẾM</span><strong>${runtime.state.googleSearch || currentMode(runtime).search ? "Được bật" : "Đang tắt"}</strong><small>Nguồn chỉ hiện khi provider trả citation</small></article><article><span>PHIÊN GẦN NHẤT</span><strong>${runtime.lastMeta.provider || "Chưa gọi API"}</strong><small>${runtime.lastMeta.latencyMs ? `${runtime.lastMeta.latencyMs}ms · ${runtime.lastMeta.tokens || "--"} tokens` : "Sẵn sàng"}</small></article><details open><summary>Quyền riêng tư</summary><p>Không nhập mật khẩu, khóa API hoặc bí mật. Ảnh/PDF chỉ gửi khi bạn bấm Gửi. Dữ liệu provider tuân theo điều khoản tài khoản Gemini API của chủ website.</p></details></section>`}</div></aside>`;
  }
  function shellMarkup(runtime) {
    const session = currentSession(runtime);
    const messages = session.messages.length ? session.messages.map(messageMarkup).join("") : `<section class="chat-ai-welcome"><div class="chat-ai-orb">G</div><small>GEMINI API · HH PLATFORM</small><h2>Tôi có thể giúp bạn làm gì?</h2><p>Trò chuyện nhiều lượt, nghiên cứu có nguồn, phân tích ảnh/PDF, viết nội dung và hỗ trợ lập trình trong một workspace riêng.</p><div>${PROMPTS.slice(0, 4).map(([title], index) => `<button type="button" data-chat-ai-prompt="${index}">${escapeHtml(title)}</button>`).join("")}</div></section>`;
    return `<section class="chat-ai-hub" data-chat-ai-hub data-busy="${runtime.busy}" data-private="${runtime.incognito}"><header class="chat-ai-topbar"><div class="chat-ai-brand"><i>AI</i><span><small>HH PLATFORM</small><strong>Chat AI</strong></span></div><div class="chat-ai-mode-tabs">${MODES.map((mode) => `<button type="button" class="${runtime.state.mode === mode.id ? "is-active" : ""}" data-chat-ai-mode="${mode.id}"><i>${mode.icon}</i>${mode.label}</button>`).join("")}</div><div class="chat-ai-top-actions"><label><span>Model Gemini</span><select data-chat-ai-model>${MODELS.map((model) => `<option value="${model.id}" ${runtime.state.model === model.id ? "selected" : ""}>${model.label}</option>`).join("")}</select></label><button type="button" class="${runtime.incognito ? "is-active" : ""}" data-chat-ai-private title="Không lưu hội thoại">◉ Riêng tư</button><button type="button" data-chat-ai-export>⇩ Xuất</button></div></header><div class="chat-ai-layout"><aside class="chat-ai-sidebar"><button type="button" class="chat-ai-new" data-chat-ai-new>＋ Cuộc trò chuyện mới</button><label class="chat-ai-search"><span>⌕</span><input type="search" data-chat-ai-session-search value="${escapeHtml(runtime.query)}" placeholder="Tìm lịch sử..."></label><div class="chat-ai-session-list" data-chat-ai-sessions>${runtime.incognito ? `<article class="chat-ai-private-card"><i>◉</i><strong>Phiên riêng tư</strong><span>Không ghi vào lịch sử</span></article>` : sessionsMarkup(runtime)}</div><footer><span data-chat-ai-provider-state="${runtime.providerStatus}"><i></i>${runtime.providerStatus === "online" ? "Gemini sẵn sàng" : runtime.providerStatus === "offline" ? "Backend ngoại tuyến" : "Đang kiểm tra Gemini"}</span><small>Khóa API được giữ phía server</small></footer></aside><main class="chat-ai-main"><section class="chat-ai-stream" data-chat-ai-stream aria-live="polite">${messages}</section><section class="chat-ai-pending" data-chat-ai-pending ${runtime.pending.length ? "" : "hidden"}>${pendingMarkup(runtime)}</section><form class="chat-ai-composer" data-chat-ai-form><textarea data-chat-ai-input rows="3" maxlength="24000" placeholder="Nhắn tin cho Gemini…" ${runtime.busy ? "disabled" : ""}>${escapeHtml(runtime.state.draft)}</textarea><div class="chat-ai-composer__bar"><div><label title="Ảnh, PDF hoặc văn bản nhỏ">＋ Tệp<input type="file" data-chat-ai-files multiple accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown,text/csv,application/json,.txt,.md,.csv,.json"></label><button type="button" data-chat-ai-mic title="Nhập bằng giọng nói">◉ Nói</button><button type="button" data-chat-ai-clear-draft>Xóa</button></div><span><b data-chat-ai-count>${runtime.state.draft.length}</b>/24000 · Enter để gửi</span><div><button type="button" data-chat-ai-stop ${runtime.busy ? "" : "hidden"}>Dừng</button><button type="submit" class="chat-ai-send" ${runtime.busy ? "disabled" : ""}>Gửi <i>➤</i></button></div></div></form><footer class="chat-ai-honesty">Gemini có thể mắc lỗi. Hãy kiểm tra thông tin quan trọng và mở nguồn được dẫn.</footer></main>${rightPanelMarkup(runtime, session)}</div><div class="chat-ai-toast" data-chat-ai-toast role="status" aria-live="polite" hidden></div>${runtime.deleted ? `<button class="chat-ai-undo" type="button" data-chat-ai-undo>Hoàn tác xóa “${escapeHtml(runtime.deleted.title)}”</button>` : ""}</section>`;
  }

  function render(runtime, preserveFocus = false) {
    if (!runtime?.host) return;
    const active = preserveFocus ? runtime.host.ownerDocument.activeElement?.dataset?.chatAiInput !== undefined : false;
    const cursor = active ? runtime.host.ownerDocument.activeElement.selectionStart : 0;
    runtime.host.innerHTML = shellMarkup(runtime);
    const exportButton = runtime.host.querySelector("[data-chat-ai-export]");
    exportButton?.insertAdjacentHTML("beforebegin", `<label class="chat-ai-export-format"><span>Định dạng</span><select data-chat-ai-export-format aria-label="Định dạng xuất hội thoại"><option value="md">Markdown</option><option value="txt">TXT</option><option value="json">JSON</option></select></label>`);
    if (active) { const input = runtime.host.querySelector("[data-chat-ai-input]"); input?.focus(); input?.setSelectionRange(cursor, cursor); }
    const stream = runtime.host.querySelector("[data-chat-ai-stream]"); if (stream) stream.scrollTop = stream.scrollHeight;
  }
  function toast(runtime, message, tone = "ok") {
    const target = runtime.host.querySelector("[data-chat-ai-toast]"); if (!target) return;
    target.textContent = message; target.dataset.tone = tone; target.hidden = false; clearTimeout(runtime.toastTimer); runtime.toastTimer = setTimeout(() => { target.hidden = true; }, 2800);
  }
  function anonymousId() {
    try { let id = globalScope.localStorage?.getItem("hh-anonymous-id"); if (!id) { id = globalScope.crypto?.randomUUID?.() || uid("guest"); globalScope.localStorage?.setItem("hh-anonymous-id", id); } return id; } catch { return uid("guest"); }
  }
  async function readFile(file) {
    const mimeType = clean(file.type || "application/octet-stream", 80).toLowerCase();
    const isText = mimeType.startsWith("text/") || ["application/json"].includes(mimeType) || /\.(txt|md|csv|json)$/i.test(file.name);
    if (isText) {
      if (file.size > MAX_TEXT_FILE) throw new Error(`${file.name}: văn bản tối đa ${Math.round(MAX_TEXT_FILE / 1000)} KB.`);
      return { name: file.name, mimeType: mimeType || "text/plain", size: file.size, text: await file.text(), kind: "text" };
    }
    if (!["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"].includes(mimeType)) throw new Error(`${file.name}: định dạng chưa được hỗ trợ.`);
    if (file.size > MAX_BINARY_FILE) throw new Error(`${file.name}: ảnh/PDF tối đa ${Math.round(MAX_BINARY_FILE / 1_000_000 * 10) / 10} MB qua Vercel.`);
    const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "").split(",")[1] || ""); reader.onerror = () => reject(new Error(`Không đọc được ${file.name}.`)); reader.readAsDataURL(file); });
    return { name: file.name, mimeType, size: file.size, data, kind: "binary" };
  }
  async function providerRequest(runtime, input, history, attachments) {
    const base = clean(runtime.options.apiBase || globalScope.HH_REALTIME_URL || globalScope.location?.origin, 600).replace(/\/$/, "");
    const token = globalScope.HHAuthSession?.token?.() || "";
    const mode = currentMode(runtime);
    const response = await fetch(`${base}/api/modules/chat-ai/actions`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ input, actionType: mode.action, anonymousId: anonymousId(), meta: { provider: "gemini", allowProviderFallback: false, requireProvider: true, model: runtime.state.model, thinkingLevel: runtime.state.thinkingLevel, useGoogleSearch: runtime.state.googleSearch || mode.search, systemPrompt: `${runtime.state.systemPrompt}\n\nChế độ hiện tại: ${mode.label}. ${mode.prompt}`, history, attachments } }), signal: runtime.controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(clean(payload.error || "Gemini chưa phản hồi.", 500)); error.code = payload.code || "CHAT_AI_ERROR"; throw error; }
    if (!payload.action?.output) throw new Error("Gemini trả về nội dung rỗng.");
    return payload.action;
  }
  async function send(runtime, override = "") {
    if (runtime.busy) return;
    const inputNode = runtime.host.querySelector("[data-chat-ai-input]");
    const raw = clean(override || inputNode?.value || runtime.state.draft, 24000);
    if (!raw && !runtime.pending.length) { inputNode?.focus(); return toast(runtime, "Hãy nhập nội dung hoặc chọn tệp.", "warning"); }
    const session = currentSession(runtime);
    const history = session.messages.filter((message) => !message.error && !message.stopped).slice(-16).map((message) => ({ role: message.role === "assistant" ? "model" : "user", text: message.text }));
    const textFiles = runtime.pending.filter((file) => file.kind === "text");
    const binaryFiles = runtime.pending.filter((file) => file.kind === "binary");
    const input = [raw, ...textFiles.map((file) => `\n\n--- TỆP ${file.name} ---\n${file.text}`)].join("").slice(0, 48000);
    const metadata = runtime.pending.map(({ name, mimeType, size }) => ({ name, mimeType, size }));
    const userMessage = { id: uid("user"), role: "user", text: raw || `Phân tích ${metadata.map((file) => file.name).join(", ")}`, createdAt: new Date().toISOString(), attachments: metadata };
    const loading = { id: uid("assistant"), role: "assistant", text: "", createdAt: new Date().toISOString(), loading: true };
    session.messages.push(userMessage, loading); session.messages = session.messages.slice(-MAX_MESSAGES); session.updatedAt = new Date().toISOString(); if (session.title === "Cuộc trò chuyện mới") session.title = clean(raw || metadata[0]?.name, 58) || session.title;
    runtime.state.draft = ""; runtime.busy = true; runtime.pending = []; runtime.controller = new AbortController(); writeState(runtime); render(runtime);
    const startedAt = performance.now();
    try {
      const action = await providerRequest(runtime, input, history, binaryFiles.map(({ name, mimeType, size, data }) => ({ name, mimeType, size, data })));
      Object.assign(loading, { loading: false, text: action.output, provider: action.provider || "gemini", model: action.model || runtime.state.model, latencyMs: Math.round(performance.now() - startedAt), usage: action.usage || null, sources: action.sources || [] });
      runtime.lastMeta = { provider: `${loading.provider} · ${loading.model}`, latencyMs: loading.latencyMs, tokens: action.usage?.totalTokenCount || action.usage?.total_tokens || action.usage?.totalTokens || "--" };
    } catch (error) {
      Object.assign(loading, { loading: false, error: true, text: error.name === "AbortError" ? "Đã dừng hiển thị yêu cầu này. Tác vụ phía nhà cung cấp có thể vẫn hoàn tất vì HTTP abort không bảo đảm hủy xử lý trên máy chủ." : `Không thể nhận phản hồi từ Gemini: ${error.message}` });
    } finally {
      runtime.busy = false; runtime.controller = null; session.updatedAt = new Date().toISOString(); writeState(runtime); render(runtime);
    }
  }
  function download(filename, content, type = "text/plain;charset=utf-8") { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function exportSession(runtime, format = "md") {
    const session = currentSession(runtime); const stamp = new Date().toISOString().slice(0, 10); const safe = session.title.replace(/[^a-z0-9À-ỹ_-]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "chat-ai";
    if (format === "json") return download(`${safe}-${stamp}.json`, JSON.stringify({ version: VERSION, exportedAt: new Date().toISOString(), session }, null, 2), "application/json");
    const content = [`# ${session.title}`, "", ...session.messages.map((message) => `## ${message.role === "assistant" ? "Gemini" : "Bạn"}\n\n${message.text}${message.sources?.length ? `\n\nNguồn:\n${message.sources.map((source) => `- ${source.title}: ${source.url}`).join("\n")}` : ""}`)].join("\n\n");
    download(`${safe}-${stamp}.${format}`, content, format === "md" ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8");
  }
  async function copyText(text) { if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text); throw new Error("Clipboard chưa được trình duyệt cho phép."); }
  function findMessage(runtime, id) { return currentSession(runtime).messages.find((message) => message.id === id); }
  function newSession(runtime) { if (runtime.incognito) runtime.privateSession = blankSession("Phiên riêng tư"); else { const session = blankSession(); runtime.state.sessions.unshift(session); runtime.state.sessions = runtime.state.sessions.slice(0, MAX_SESSIONS); runtime.state.activeId = session.id; writeState(runtime); } runtime.pending = []; render(runtime); }
  function branchSession(runtime, messageId) {
    if (runtime.incognito) return toast(runtime, "Tắt Chế độ riêng tư để lưu nhánh.", "warning");
    const source = currentSession(runtime); const index = source.messages.findIndex((message) => message.id === messageId); if (index < 0) return;
    const branch = blankSession(`${source.title} · nhánh`); branch.messages = source.messages.slice(0, index + 1).map((message) => ({ ...message, id: uid(message.role) })); runtime.state.sessions.unshift(branch); runtime.state.activeId = branch.id; writeState(runtime); render(runtime); toast(runtime, "Đã tạo nhánh hội thoại mới.");
  }
  function speak(runtime, message) {
    if (!globalScope.speechSynthesis || !globalScope.SpeechSynthesisUtterance) return toast(runtime, "Trình duyệt chưa hỗ trợ đọc văn bản.", "warning");
    globalScope.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(message.text.slice(0, 5000)); utterance.lang = "vi-VN"; utterance.rate = 1; globalScope.speechSynthesis.speak(utterance);
  }
  function startVoice(runtime) {
    const Recognition = globalScope.SpeechRecognition || globalScope.webkitSpeechRecognition;
    if (!Recognition) return toast(runtime, "Trình duyệt chưa hỗ trợ nhập giọng nói.", "warning");
    const recognition = new Recognition(); recognition.lang = "vi-VN"; recognition.interimResults = false; recognition.onresult = (event) => { const input = runtime.host.querySelector("[data-chat-ai-input]"); if (input) { input.value = `${input.value}${input.value ? " " : ""}${event.results[0][0].transcript}`; input.dispatchEvent(new Event("input", { bubbles: true })); } }; recognition.onerror = () => toast(runtime, "Không nhận được giọng nói.", "warning"); recognition.start();
  }
  async function checkProvider(runtime) {
    const base = clean(runtime.options.apiBase || globalScope.HH_REALTIME_URL || globalScope.location?.origin, 600).replace(/\/$/, ""); const token = globalScope.HHAuthSession?.token?.() || "";
    try { const response = await fetch(`${base}/api/modules/chat-ai/actions?anonymousId=${encodeURIComponent(anonymousId())}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" }); const data = await response.json().catch(() => ({})); runtime.providerStatus = response.ok && data.providers?.gemini?.configured ? "online" : "offline"; runtime.providerDetail = data.providers?.gemini || null; } catch { runtime.providerStatus = "offline"; } render(runtime);
  }

  async function handleClick(runtime, event) {
    const button = event.target.closest("button,[data-chat-ai-files]"); if (!button) return;
    if (button.dataset.chatAiNew !== undefined) return newSession(runtime);
    if (button.dataset.chatAiSession) { runtime.state.activeId = button.dataset.chatAiSession; runtime.pending = []; writeState(runtime); return render(runtime); }
    if (button.dataset.chatAiMode) { runtime.state.mode = button.dataset.chatAiMode; if (currentMode(runtime).search) runtime.state.googleSearch = true; writeState(runtime); return render(runtime); }
    if (button.dataset.chatAiPanel) { runtime.state.panel = button.dataset.chatAiPanel; writeState(runtime); return render(runtime); }
    if (button.dataset.chatAiPrompt !== undefined) { const prompt = PROMPTS[Number(button.dataset.chatAiPrompt)]?.[1] || ""; runtime.state.draft = prompt; writeState(runtime); render(runtime); runtime.host.querySelector("[data-chat-ai-input]")?.focus(); return; }
    if (button.dataset.chatAiPrivate !== undefined) { runtime.incognito = !runtime.incognito; if (runtime.incognito) runtime.privateSession = blankSession("Phiên riêng tư"); runtime.pending = []; return render(runtime); }
    if (button.dataset.chatAiExport !== undefined) {
      const format = runtime.host.querySelector("[data-chat-ai-export-format]")?.value;
      return exportSession(runtime, ["md", "txt", "json"].includes(format) ? format : "md");
    }
    if (button.dataset.chatAiStop !== undefined) { runtime.controller?.abort(); return; }
    if (button.dataset.chatAiClearDraft !== undefined) { runtime.state.draft = ""; writeState(runtime); return render(runtime); }
    if (button.dataset.chatAiMic !== undefined) return startVoice(runtime);
    if (button.dataset.chatAiRemoveFile !== undefined) { runtime.pending.splice(Number(button.dataset.chatAiRemoveFile), 1); return render(runtime); }
    if (button.dataset.chatAiCopy) { const message = findMessage(runtime, button.dataset.chatAiCopy); try { await copyText(message?.text || ""); toast(runtime, "Đã sao chép câu trả lời."); } catch (error) { toast(runtime, error.message, "warning"); } return; }
    if (button.dataset.chatAiCopyCode) { const code = runtime.host.querySelector(`[data-chat-ai-code="${CSS.escape(button.dataset.chatAiCopyCode)}"]`)?.textContent || ""; try { await copyText(code); toast(runtime, "Đã sao chép code."); } catch (error) { toast(runtime, error.message, "warning"); } return; }
    if (button.dataset.chatAiRegenerate) { const session = currentSession(runtime); const index = session.messages.findIndex((message) => message.id === button.dataset.chatAiRegenerate); const previous = [...session.messages.slice(0, index)].reverse().find((message) => message.role === "user"); if (previous) return send(runtime, previous.text); return; }
    if (button.dataset.chatAiSpeak) { const message = findMessage(runtime, button.dataset.chatAiSpeak); if (message) speak(runtime, message); return; }
    if (button.dataset.chatAiBranch) return branchSession(runtime, button.dataset.chatAiBranch);
    if (button.dataset.chatAiPin) { const session = runtime.state.sessions.find((item) => item.id === button.dataset.chatAiPin); if (session) { session.pinned = !session.pinned; writeState(runtime); render(runtime); } return; }
    if (button.dataset.chatAiDelete) { if (runtime.state.sessions.length <= 1) return toast(runtime, "Cần giữ ít nhất một cuộc trò chuyện.", "warning"); const index = runtime.state.sessions.findIndex((item) => item.id === button.dataset.chatAiDelete); if (index > -1) { runtime.deleted = { ...runtime.state.sessions[index], index }; runtime.state.sessions.splice(index, 1); if (runtime.state.activeId === button.dataset.chatAiDelete) runtime.state.activeId = runtime.state.sessions[0].id; writeState(runtime); render(runtime); } return; }
    if (button.dataset.chatAiUndo !== undefined && runtime.deleted) { runtime.state.sessions.splice(runtime.deleted.index, 0, runtime.deleted); runtime.state.activeId = runtime.deleted.id; runtime.deleted = null; writeState(runtime); return render(runtime); }
    if (button.dataset.chatAiResetSystem !== undefined) { runtime.state.systemPrompt = defaultState().systemPrompt; writeState(runtime); return render(runtime); }
    if (button.dataset.chatAiDownloadArtifact !== undefined) { const session = currentSession(runtime); const artifacts = []; session.messages.filter((message) => message.role === "assistant").forEach((message) => String(message.text).split(/```/).forEach((part, index) => { if (index % 2) { const newline = part.indexOf("\n"); artifacts.push({ language: newline > -1 ? part.slice(0, newline) : "txt", code: newline > -1 ? part.slice(newline + 1) : part }); } })); const artifact = artifacts[Number(button.dataset.chatAiDownloadArtifact)]; if (artifact) download(`chat-ai-code-${Date.now()}.${artifact.language || "txt"}`, artifact.code); }
  }
  async function handleChange(runtime, event) {
    if (event.target.matches("[data-chat-ai-model]")) runtime.state.model = event.target.value;
    else if (event.target.matches("[data-chat-ai-thinking]")) runtime.state.thinkingLevel = event.target.value;
    else if (event.target.matches("[data-chat-ai-search-toggle]")) runtime.state.googleSearch = Boolean(event.target.checked);
    else if (event.target.matches("[data-chat-ai-files]")) { const files = [...(event.target.files || [])].slice(0, 4); for (const file of files) { try { runtime.pending.push(await readFile(file)); } catch (error) { toast(runtime, error.message, "warning"); } } runtime.pending = runtime.pending.slice(0, 4); event.target.value = ""; render(runtime); return; }
    else return;
    writeState(runtime); render(runtime);
  }
  function handleInput(runtime, event) {
    if (event.target.matches("[data-chat-ai-input]")) { runtime.state.draft = event.target.value.slice(0, 24000); if (!runtime.incognito) writeState(runtime); const count = runtime.host.querySelector("[data-chat-ai-count]"); if (count) count.textContent = runtime.state.draft.length; }
    if (event.target.matches("[data-chat-ai-session-search]")) { runtime.query = event.target.value; const list = runtime.host.querySelector("[data-chat-ai-sessions]"); if (list) list.innerHTML = sessionsMarkup(runtime); }
    if (event.target.matches("[data-chat-ai-title]") && !runtime.incognito) { const session = currentSession(runtime); session.title = clean(event.target.value, 120) || "Cuộc trò chuyện"; session.updatedAt = new Date().toISOString(); writeState(runtime); }
    if (event.target.matches("[data-chat-ai-system]")) { runtime.state.systemPrompt = event.target.value.slice(0, 2000); writeState(runtime); }
  }
  function handleKeydown(runtime, event) { if (event.target.matches("[data-chat-ai-input]") && event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); event.target.closest("form")?.requestSubmit(); } }
  function handleSubmit(runtime, event) { if (!event.target.matches("[data-chat-ai-form]")) return; event.preventDefault(); send(runtime); }
  function mount(host, options = {}) {
    unmount(); if (!host) return false;
    const controller = new AbortController(); const owner = ownerId(options); const storage = options.storage || globalScope.localStorage;
    instance = { host, options, controller, owner, storage, state: readState(storage, owner), pending: [], busy: false, incognito: false, privateSession: blankSession("Phiên riêng tư"), providerStatus: "checking", providerDetail: null, query: "", deleted: null, lastMeta: {}, toastTimer: 0, storageError: false };
    if (options.newSession) { const session = blankSession(); instance.state.sessions.unshift(session); instance.state.sessions = instance.state.sessions.slice(0, MAX_SESSIONS); instance.state.activeId = session.id; writeState(instance); }
    host.addEventListener("click", (event) => handleClick(instance, event).catch((error) => toast(instance, error.message, "error")), { signal: controller.signal });
    host.addEventListener("change", (event) => handleChange(instance, event).catch((error) => toast(instance, error.message, "error")), { signal: controller.signal });
    host.addEventListener("input", (event) => handleInput(instance, event), { signal: controller.signal });
    host.addEventListener("keydown", (event) => handleKeydown(instance, event), { signal: controller.signal });
    host.addEventListener("submit", (event) => handleSubmit(instance, event), { signal: controller.signal });
    render(instance); checkProvider(instance); return true;
  }
  function unmount() { if (!instance) return; instance.controller?.abort(); clearTimeout(instance.toastTimer); globalScope.speechSynthesis?.cancel?.(); instance = null; }
  function inspect() { return { version: VERSION, mounted: Boolean(instance), owner: instance?.owner || null, sessions: instance?.state?.sessions?.length || 0, busy: Boolean(instance?.busy), providerStatus: instance?.providerStatus || "idle" }; }

  return Object.freeze({ VERSION, STORAGE_SCHEMA, MODELS, MODES, PROMPTS, MAX_SESSIONS, MAX_MESSAGES, storageKey, normalizeState, mount, unmount, inspect });
});
