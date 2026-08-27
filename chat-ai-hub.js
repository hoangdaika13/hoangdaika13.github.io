(function chatAIHubModule(globalScope, factory) {
  "use strict";
  const api = factory(globalScope || {});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (globalScope && typeof globalScope === "object") globalScope.HHChatAI = api;
})(typeof window !== "undefined" ? window : globalThis, function createChatAIHub(globalScope) {
  "use strict";

  const VERSION = "3.3.0";
  const STORAGE_SCHEMA = "hh.chat.ai.v1";
  const MAX_SESSIONS = 40;
  const MAX_MESSAGES = 80;
  const MAX_TEXT_FILE = 220_000;
  const MAX_BINARY_FILE = 1_550_000;
  const MAX_CONTEXT_CHARS = 32_000;
  // Provider model ids stay internal. The product UI only exposes HH processing
  // profiles and the backend remains responsible for final routing/fallback.
  const MODELS = Object.freeze([
    { id: "gemini-3.6-flash" },
    { id: "gemini-3.5-flash" },
    { id: "gemini-3.5-flash-lite" },
    { id: "gemini-3.1-pro-preview" }
  ]);
  const PROCESSING_MODES = Object.freeze([
    { id: "auto", label: "Tự động thông minh", detail: "HH tự cân bằng tốc độ và chiều sâu" },
    { id: "fast", label: "Phản hồi nhanh", detail: "Ưu tiên tốc độ" },
    { id: "deep", label: "Suy luận sâu", detail: "Ưu tiên phân tích nhiều tầng" },
    { id: "economy", label: "Tiết kiệm dữ liệu", detail: "Ngữ cảnh gọn và phản hồi ngắn" }
  ]);
  const MODES = Object.freeze([
    { id: "chat", icon: "✦", label: "Trò chuyện", action: "chat", search: false, requiresAttachment: false, placeholder: "Nhắn điều bạn muốn trao đổi…", prompt: "Trả lời trực tiếp, tự nhiên theo ngữ cảnh hội thoại. Không biến yêu cầu thông thường thành báo cáo nghiên cứu." },
    { id: "research", icon: "⌕", label: "Nghiên cứu", action: "research", search: true, requiresAttachment: false, placeholder: "Nhập chủ đề cần nghiên cứu và kiểm chứng nguồn…", prompt: "Nghiên cứu bằng Google Search, ghi nguồn cạnh từng dữ kiện mới và tách rõ suy luận." },
    { id: "code", icon: "</>", label: "Lập trình", action: "code", search: false, requiresAttachment: false, placeholder: "Mô tả lỗi, yêu cầu code hoặc dán đoạn mã…", prompt: "Phân tích code như senior engineer; ưu tiên nguyên nhân gốc, giải pháp chạy được, bảo mật và kiểm thử." },
    { id: "write", icon: "✎", label: "Viết", action: "write", search: false, requiresAttachment: false, placeholder: "Mô tả nội dung, độc giả và giọng văn mong muốn…", prompt: "Đóng vai biên tập viên; tạo nội dung hoàn chỉnh, tự nhiên, đúng đối tượng và tránh câu chữ rập khuôn." },
    { id: "study", icon: "◎", label: "Học tập", action: "study", search: false, requiresAttachment: false, placeholder: "Nhập môn học, chủ đề hoặc câu hỏi cần được hướng dẫn…", prompt: "Dạy theo từng tầng và kiểm tra mức hiểu; không để lộ đáp án bài kiểm tra trước khi người học tự trả lời." },
    { id: "vision", icon: "◫", label: "Phân tích tệp", action: "vision", search: false, requiresAttachment: true, placeholder: "Đính kèm ảnh/PDF rồi mô tả nội dung cần phân tích…", prompt: "Đọc kỹ ảnh, PDF hoặc văn bản đính kèm; chỉ kết luận từ nội dung thực sự nhìn thấy và nói rõ phần không đọc được." }
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
  function blankSession(title = "Cuộc trò chuyện mới") { return { id: uid("chat"), title, pinned: false, folder: "Chung", tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [] }; }
  function defaultState() {
    const session = blankSession();
    return { version: VERSION, activeId: session.id, sessions: [session], processingMode: "auto", thinkingLevel: "medium", mode: "chat", webSearch: false, webSearchExplicit: false, autoFallback: true, contextBudget: 24000, responseStyle: "balanced", systemPrompt: "Bạn là HH AI trong HH Intelligence. Hãy trả lời chính xác, hữu ích, tự nhiên bằng tiếng Việt và không tuyên bố đã thực hiện hành động bên ngoài khi chưa có xác nhận.", draft: "", panel: "context", favoritePrompts: [], memoryEnabled: false, memoryProfile: "", voiceName: "", inspectorOpen: false, sidebarCollapsed: false };
  }
  function migrateLegacyContinuityText(value) {
    return clean(value, 48000)
      .replace(/HH Continuity đang tiếp quản/gi, "HH Basic Assist đang hỗ trợ")
      .replace(/Gemini và các provider cloud hiện chưa phản hồi ổn định\.?/gi, "Dịch vụ AI đám mây hiện chưa phản hồi ổn định.")
      .replace(/không phải (?:phản hồi|câu trả lời) của Gemini/gi, "không phải kết quả từ dịch vụ AI đám mây")
      .replace(/Tạo lại bằng cloud/gi, "Tạo bản khác")
      .replace(/khi provider phục hồi/gi, "khi HH Intelligence khôi phục")
      .replace(/provider phục hồi/gi, "HH Intelligence khôi phục");
  }
  function normalizeMessage(message, index) {
    const role = message?.role === "assistant" ? "assistant" : "user";
    const provider = clean(message?.provider, 80);
    const continuity = Boolean(message?.continuity) || provider === "local" || provider.startsWith("local-");
    const originalText = clean(message?.text, 48000);
    const text = role === "assistant" && continuity ? migrateLegacyContinuityText(originalText) : originalText;
    const mode = MODES.some((item) => item.id === message?.mode) ? message.mode : "";
    return { id: clean(message?.id, 120) || `message-${index}`, role, text, mode, createdAt: message?.createdAt || new Date().toISOString(), provider, model: clean(message?.model, 100), latencyMs: Math.max(0, Number(message?.latencyMs) || 0), usage: message?.usage && typeof message.usage === "object" ? message.usage : null, sources: (Array.isArray(message?.sources) ? message.sources : []).map((source) => ({ title: clean(source?.title || source?.url, 240), url: safeUrl(source?.url) })).filter((source) => source.url).slice(0, 12), attachments: (Array.isArray(message?.attachments) ? message.attachments : []).map((file) => ({ name: clean(file?.name, 180), mimeType: clean(file?.mimeType, 80), size: Math.max(0, Number(file?.size) || 0) })).slice(0, 4), stopped: Boolean(message?.stopped), error: Boolean(message?.error), continuity, pinned: Boolean(message?.pinned), providerError: clean(message?.providerError, 500) };
  }
  function normalizeState(raw) {
    const base = defaultState();
    const source = raw && typeof raw === "object" ? raw : {};
    const sessions = (Array.isArray(source.sessions) ? source.sessions : []).slice(0, MAX_SESSIONS).map((session, index) => ({ id: clean(session?.id, 120) || `session-${index}`, title: clean(session?.title, 120) || "Cuộc trò chuyện", pinned: Boolean(session?.pinned), folder: clean(session?.folder, 40) || "Chung", tags: (Array.isArray(session?.tags) ? session.tags : []).map((tag) => clean(tag, 24)).filter(Boolean).slice(0, 6), createdAt: session?.createdAt || new Date().toISOString(), updatedAt: session?.updatedAt || session?.createdAt || new Date().toISOString(), messages: (Array.isArray(session?.messages) ? session.messages : []).slice(-MAX_MESSAGES).map(normalizeMessage) }));
    if (!sessions.length) sessions.push(base.sessions[0]);
    const legacyMode = source.model === "gemini-3.5-flash-lite" ? "fast" : source.model === "gemini-3.5-flash" || source.model === "gemini-3.1-pro-preview" ? "deep" : "auto";
    const processingMode = PROCESSING_MODES.some((item) => item.id === source.processingMode) ? source.processingMode : legacyMode;
    const mode = MODES.some((item) => item.id === source.mode) ? source.mode : base.mode;
    const thinkingLevel = ["minimal", "low", "medium", "high"].includes(source.thinkingLevel) ? source.thinkingLevel : base.thinkingLevel;
    const savedSystemPrompt = clean(source.systemPrompt, 2000);
    const systemPrompt = /trợ lý Gemini|Gemini chính xác/i.test(savedSystemPrompt) ? base.systemPrompt : (savedSystemPrompt || base.systemPrompt);
    const webSearchExplicit = source.webSearchExplicit === true;
    return { ...base, sessions, activeId: sessions.some((session) => session.id === source.activeId) ? source.activeId : sessions[0].id, processingMode, mode, thinkingLevel, webSearch: webSearchExplicit ? Boolean(source.webSearch ?? source.googleSearch) : false, webSearchExplicit, autoFallback: source.autoFallback !== false, contextBudget: Math.max(8000, Math.min(MAX_CONTEXT_CHARS, Number(source.contextBudget) || base.contextBudget)), responseStyle: ["concise", "balanced", "detailed"].includes(source.responseStyle) ? source.responseStyle : base.responseStyle, systemPrompt, draft: clean(source.draft, 24000), panel: ["context", "prompts", "settings", "artifacts"].includes(source.panel) ? source.panel : "context", favoritePrompts: (Array.isArray(source.favoritePrompts) ? source.favoritePrompts : []).map((item) => clean(item, 2000)).filter(Boolean).slice(0, 20), memoryEnabled: source.memoryEnabled === true, memoryProfile: clean(source.memoryProfile, 1200), voiceName: clean(source.voiceName, 160), inspectorOpen: source.inspectorOpen === true, sidebarCollapsed: source.sidebarCollapsed === true };
  }
  function readState(storage, owner) { try { return normalizeState(JSON.parse(storage?.getItem(storageKey(owner)) || "{}")); } catch { return defaultState(); } }
  function writeState(runtime) {
    if (runtime.incognito) return;
    runtime.state.version = VERSION;
    try { runtime.storage?.setItem(storageKey(runtime.owner), JSON.stringify(runtime.state)); } catch { runtime.storageError = true; }
  }
  function currentSession(runtime) { return runtime.incognito ? runtime.privateSession : runtime.state.sessions.find((session) => session.id === runtime.state.activeId) || runtime.state.sessions[0]; }
  function resolveMode(modeId) { return MODES.find((mode) => mode.id === modeId) || MODES[0]; }
  function currentMode(runtime) { return resolveMode(runtime.state.mode); }
  function modeRequestContract(modeId, options = {}) {
    const mode = resolveMode(modeId);
    return { mode: mode.id, actionType: mode.action, useGoogleSearch: mode.search || options.manualWebSearch === true, requiresAttachment: mode.requiresAttachment === true, prompt: mode.prompt };
  }
  function currentProcessingMode(runtime) { return PROCESSING_MODES.find((mode) => mode.id === runtime.state.processingMode) || PROCESSING_MODES[0]; }
  function sortSessions(sessions) { return [...sessions].sort((a, b) => Number(b.pinned) - Number(a.pinned) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt)); }

  function routeProcessing(input = "", options = {}) {
    const textValue = clean(input, 48000).toLowerCase();
    const requested = PROCESSING_MODES.some((item) => item.id === options.processingMode) ? options.processingMode : "auto";
    const hasFiles = Number(options.attachmentCount || 0) > 0;
    const research = options.mode === "research" || /\b(mới nhất|hiện nay|nghiên cứu|nguồn|tin tức|giá|luật)\b/i.test(textValue);
    const deepTask = options.mode === "code" || options.mode === "study" || textValue.length > 4500 || /\b(phân tích sâu|chứng minh|kiến trúc|debug|thuật toán|toán học)\b/i.test(textValue);
    if (requested === "fast") return { model: "gemini-3.5-flash-lite", thinkingLevel: "low", contextBudget: Math.min(16000, options.contextBudget || 16000), useWebSearch: research };
    if (requested === "economy") return { model: "gemini-3.5-flash-lite", thinkingLevel: "minimal", contextBudget: Math.min(12000, options.contextBudget || 12000), useWebSearch: false };
    if (requested === "deep") return { model: "gemini-3.5-flash", thinkingLevel: "high", contextBudget: options.contextBudget || 32000, useWebSearch: research };
    if (hasFiles || research) return { model: "gemini-3.6-flash", thinkingLevel: options.thinkingLevel || "medium", contextBudget: options.contextBudget || 24000, useWebSearch: research };
    if (deepTask) return { model: "gemini-3.5-flash", thinkingLevel: options.thinkingLevel === "minimal" ? "medium" : options.thinkingLevel || "medium", contextBudget: options.contextBudget || 24000, useWebSearch: false };
    return { model: "gemini-3.5-flash-lite", thinkingLevel: "low", contextBudget: Math.min(20000, options.contextBudget || 20000), useWebSearch: false };
  }

  function estimateTokens(value) { return Math.max(0, Math.ceil(String(value || "").length / 3.2)); }
  function compactHistory(messages, budget = 24000) {
    const cleanMessages = (Array.isArray(messages) ? messages : []).filter((message) => message && !message.error && !message.stopped && !message.loading && message.text).slice(-30);
    const selected = []; let used = 0;
    for (let index = cleanMessages.length - 1; index >= 0; index -= 1) {
      const message = cleanMessages[index]; const text = clean(message.text, 6000); const cost = text.length + 24;
      if (selected.length >= 16 || (used + cost > budget && selected.length >= 4)) break;
      selected.unshift({ role: message.role === "assistant" ? "model" : "user", text }); used += cost;
    }
    const omitted = Math.max(0, cleanMessages.length - selected.length);
    if (omitted) {
      const older = cleanMessages.slice(0, omitted).slice(-8).map((message) => `${message.role === "assistant" ? "HH AI" : "Người dùng"}: ${clean(message.text, 220)}`).join("\n");
      const recap = { role: "user", text: `[NGỮ CẢNH CŨ ĐƯỢC RÚT GỌN TỪ ${omitted} TIN — chỉ là trích đoạn, không phải dữ kiện mới]\n${older}` };
      while (selected.length && used + recap.text.length > budget) { const removed = selected.shift(); used -= removed.text.length + 24; }
      selected.unshift(recap); used += recap.text.length;
    }
    return { history: selected, omitted, chars: used, estimatedTokens: estimateTokens(selected.map((item) => item.text).join("\n")) };
  }

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
  function revealChunks(value) {
    const tokens = String(value || "").match(/\S+\s*/g) || [];
    const size = tokens.length > 900 ? 7 : tokens.length > 500 ? 5 : tokens.length > 240 ? 3 : tokens.length > 100 ? 2 : 1;
    const chunks = [];
    for (let index = 0; index < tokens.length; index += size) chunks.push(tokens.slice(index, index + size).join(""));
    return chunks;
  }
  function isNearStreamBottom(stream, threshold = 120) {
    if (!stream) return true;
    return stream.scrollHeight - stream.scrollTop - stream.clientHeight <= threshold;
  }
  function scrollStreamToBottom(stream) {
    if (!stream) return;
    if (typeof stream.scrollTo === "function") stream.scrollTo({ top: stream.scrollHeight, behavior: "auto" });
    else stream.scrollTop = stream.scrollHeight;
  }
  function nextPaint() {
    return new Promise((resolve) => {
      if (typeof globalScope.requestAnimationFrame === "function") globalScope.requestAnimationFrame(() => resolve());
      else globalScope.setTimeout?.(resolve, 16);
    });
  }
  async function revealAssistant(runtime, message, value) {
    const fullText = clean(value, 48000);
    const reducedMotion = globalScope.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const chunks = revealChunks(fullText);
    if (!runtime?.host || reducedMotion || chunks.length <= 1) { message.text = fullText; message.streaming = false; return; }
    message.text = ""; message.loading = false; message.streaming = true;
    let following = isNearStreamBottom(runtime.host.querySelector("[data-chat-ai-stream]"), 150);
    render(runtime, true, { forceBottom: following });
    for (const chunk of chunks) {
      if (runtime.lifecycleController?.signal?.aborted) { message.text = fullText; break; }
      if (runtime.controller?.signal?.aborted) { message.stopped = true; break; }
      const stream = runtime.host.querySelector("[data-chat-ai-stream]");
      if (following && !isNearStreamBottom(stream, 150)) following = false;
      message.text += chunk;
      const article = runtime.host.querySelector(`[data-chat-ai-message="${message.id}"]`);
      const body = article?.querySelector(".chat-ai-message__body");
      if (!body) { message.text = fullText; break; }
      body.innerHTML = `${markdownMarkup(message.text, message.id)}<span class="chat-ai-stream-caret" aria-hidden="true"></span>`;
      if (following) scrollStreamToBottom(stream);
      await nextPaint();
    }
    message.streaming = false;
    const article = runtime.host?.querySelector?.(`[data-chat-ai-message="${message.id}"]`);
    const body = article?.querySelector(".chat-ai-message__body");
    if (body) body.innerHTML = markdownMarkup(message.text, message.id);
  }
  function sourceMarkup(sources) {
    if (!sources?.length) return "";
    return `<nav class="chat-ai-sources" aria-label="Nguồn tham khảo">${sources.map((source, index) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer"><i>${index + 1}</i><span>${escapeHtml(source.title || new URL(source.url).hostname)}</span></a>`).join("")}</nav>`;
  }
  function assistantIdentity(message) {
    const provider = clean(message?.provider, 80).toLowerCase();
    if (message?.continuity || provider === "local" || provider.startsWith("local-")) return { avatar: "H", label: "HH Basic Assist", status: "Xử lý cơ bản · không dùng AI đám mây" };
    return { avatar: "HH", label: "HH AI", status: "" };
  }
  function messageMarkup(message) {
    const assistant = message.role === "assistant";
    const identity = assistantIdentity(message);
    const messageMode = message.mode ? resolveMode(message.mode) : null;
    const footer = message.loading || message.streaming ? "" : assistant
      ? `<footer><button type="button" data-chat-ai-copy="${escapeHtml(message.id)}">Sao chép</button><button type="button" data-chat-ai-regenerate="${escapeHtml(message.id)}">Tạo bản khác</button><button type="button" data-chat-ai-refine="continue">Viết tiếp</button><button type="button" data-chat-ai-refine="shorter">Ngắn hơn</button><button type="button" data-chat-ai-refine="detailed">Chi tiết hơn</button><button type="button" data-chat-ai-speak="${escapeHtml(message.id)}">Đọc</button><button type="button" data-chat-ai-message-pin="${escapeHtml(message.id)}">${message.pinned ? "Bỏ ghim" : "Ghim"}</button><button type="button" data-chat-ai-branch="${escapeHtml(message.id)}">Tách nhánh</button></footer>`
      : `<footer><button type="button" data-chat-ai-edit-message="${escapeHtml(message.id)}">Sửa &amp; gửi lại</button><button type="button" data-chat-ai-copy="${escapeHtml(message.id)}">Sao chép</button></footer>`;
    const body = message.loading ? `<div class="chat-ai-thinking"><span class="chat-ai-thinking__orbit"><i></i><i></i><i></i></span><span>HH AI đang xử lý đúng chế độ ${escapeHtml(messageMode?.label || "Trò chuyện")}…</span></div>` : `${markdownMarkup(message.text, message.id)}${message.streaming ? `<span class="chat-ai-stream-caret" aria-hidden="true"></span>` : ""}`;
    return `<article class="chat-ai-message ${assistant ? "is-assistant" : "is-user"}${message.error ? " is-error" : ""}${message.continuity ? " is-continuity" : ""}${message.streaming ? " is-streaming" : ""}${message.pinned ? " is-pinned" : ""}" data-chat-ai-message="${escapeHtml(message.id)}"><div class="chat-ai-avatar">${assistant ? identity.avatar : "B"}</div><section><header><strong>${assistant ? identity.label : "Bạn"}</strong><span>${escapeHtml(nowLabelFrom(message.createdAt))}</span>${messageMode ? `<span class="chat-ai-message__mode">${escapeHtml(messageMode.icon)} ${escapeHtml(messageMode.label)}</span>` : ""}${message.pinned ? `<em>✦ Đã ghim</em>` : ""}${assistant && identity.status ? `<em>${escapeHtml(identity.status)}</em>` : ""}</header><div class="chat-ai-message__body">${body}</div>${message.attachments?.length ? `<div class="chat-ai-file-chips">${message.attachments.map((file) => `<span>${file.mimeType === "application/pdf" ? "PDF" : file.mimeType?.startsWith("image/") ? "Ảnh" : "TXT"} · ${escapeHtml(file.name)}</span>`).join("")}</div>` : ""}${message.streaming ? "" : sourceMarkup(message.sources)}${footer}</section></article>`;
  }
  function nowLabelFrom(value) { const date = new Date(value); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(date) : ""; }
  function sessionsMarkup(runtime) {
    const query = runtime.query.toLocaleLowerCase("vi");
    const sessions = sortSessions(runtime.state.sessions).filter((session) => (!runtime.folderFilter || session.folder === runtime.folderFilter) && (!query || `${session.title} ${session.folder} ${(session.tags || []).join(" ")} ${session.messages.map((message) => message.text).join(" ")}`.toLocaleLowerCase("vi").includes(query)));
    if (!sessions.length) return `<div class="chat-ai-empty-small">Không tìm thấy cuộc trò chuyện.</div>`;
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = startOfToday - 6 * 86400000;
    const groups = [
      ["pinned", "Đã ghim", sessions.filter((session) => session.pinned)],
      ["today", "Hôm nay", sessions.filter((session) => !session.pinned && Date.parse(session.updatedAt) >= startOfToday)],
      ["week", "7 ngày qua", sessions.filter((session) => !session.pinned && Date.parse(session.updatedAt) >= sevenDaysAgo && Date.parse(session.updatedAt) < startOfToday)],
      ["older", "Cũ hơn", sessions.filter((session) => !session.pinned && Date.parse(session.updatedAt) < sevenDaysAgo)]
    ];
    const itemMarkup = (session) => `<article class="chat-ai-session${session.id === runtime.state.activeId && !runtime.incognito ? " is-active" : ""}"><button type="button" data-chat-ai-session="${escapeHtml(session.id)}"><i>${session.pinned ? "◆" : "◇"}</i><span><strong>${escapeHtml(session.title)}</strong><small>${escapeHtml(session.folder || "Chung")} · ${session.messages.length} tin · ${escapeHtml(nowLabelFrom(session.updatedAt))}</small></span></button><details class="chat-ai-session-menu"><summary aria-label="Tác vụ với ${escapeHtml(session.title)}">•••</summary><div><button type="button" data-chat-ai-pin="${escapeHtml(session.id)}">${session.pinned ? "Bỏ ghim" : "Ghim"}</button><button type="button" data-chat-ai-rename="${escapeHtml(session.id)}">Đổi tên</button><button type="button" data-chat-ai-delete="${escapeHtml(session.id)}">Xóa</button></div></details></article>`;
    return groups.filter(([, , items]) => items.length).map(([id, label, items]) => `<section class="chat-ai-session-group" data-session-group="${id}"><header><span>${label}</span><i>${items.length}</i></header>${items.map(itemMarkup).join("")}</section>`).join("");
  }
  function pendingMarkup(runtime) {
    const files = runtime.pending.map((file, index) => `<article><i>${file.mimeType === "application/pdf" ? "PDF" : file.mimeType.startsWith("image/") ? "IMG" : "TXT"}</i><span><strong>${escapeHtml(file.name)}</strong><small>${Math.max(1, Math.round(file.size / 1024))} KB · sẵn sàng</small></span><button type="button" data-chat-ai-remove-file="${index}" aria-label="Bỏ tệp">×</button></article>`).join("");
    const queue = runtime.queue.map((item, index) => `<article class="chat-ai-queue-item"><i>${index + 1}</i><span><strong>${escapeHtml(item.input.slice(0, 70) || "Yêu cầu có tệp")}</strong><small>Đang chờ HH AI xử lý</small></span><button type="button" data-chat-ai-remove-queue="${index}" aria-label="Bỏ khỏi hàng đợi">×</button></article>`).join("");
    return files + queue;
  }
  function artifactsMarkup(session) {
    const artifacts = [];
    session.messages.filter((message) => message.role === "assistant").forEach((message) => String(message.text || "").split(/```/).forEach((part, index) => { if (index % 2) { const newline = part.indexOf("\n"); artifacts.push({ language: newline > -1 ? part.slice(0, newline) : "text", code: newline > -1 ? part.slice(newline + 1) : part, messageId: message.id }); } }));
    return artifacts.length ? artifacts.map((artifact, index) => `<article><header><strong>${escapeHtml(artifact.language || "code")}</strong><button type="button" data-chat-ai-download-artifact="${index}">Tải file</button></header><pre>${escapeHtml(artifact.code.slice(0, 1200))}</pre></article>`).join("") : `<div class="chat-ai-empty-small">Code block từ câu trả lời sẽ xuất hiện tại đây.</div>`;
  }
  function voiceOptions(selected = "") {
    const voices = globalScope.speechSynthesis?.getVoices?.() || [];
    const vietnamese = voices.filter((voice) => /^vi(?:-|_)/i.test(voice.lang));
    const list = vietnamese.length ? vietnamese : voices.slice(0, 30);
    return `<option value="">Giọng Việt mặc định</option>${list.map((voice) => `<option value="${escapeHtml(voice.name)}" ${voice.name === selected ? "selected" : ""}>${escapeHtml(voice.name)} · ${escapeHtml(voice.lang)}</option>`).join("")}`;
  }
  function rightPanelMarkup(runtime, session) {
    const panel = runtime.state.panel;
    const activeMode = currentMode(runtime);
    const tabs = `<nav>${[["context","Ngữ cảnh"],["prompts","Công cụ"],["artifacts","Tệp code"],["settings","Tùy chỉnh"]].map(([id, label]) => `<button type="button" class="${panel === id ? "is-active" : ""}" data-chat-ai-panel="${id}">${label}</button>`).join("")}</nav>`;
    let body = "";
    if (panel === "prompts") {
      body = `<section class="chat-ai-prompt-grid"><header><strong>Công cụ nhanh</strong><button type="button" data-chat-ai-save-prompt>＋ Lưu nội dung đang soạn</button></header>${PROMPTS.map(([title, prompt], index) => `<article><button type="button" data-chat-ai-prompt="${index}"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(prompt.slice(0, 92))}</span></button><button type="button" data-chat-ai-favorite-prompt="${index}" aria-label="Lưu prompt ${escapeHtml(title)}">☆</button></article>`).join("")}${runtime.state.favoritePrompts.length ? `<h3>Đã lưu</h3>${runtime.state.favoritePrompts.map((prompt, index) => `<article><button type="button" data-chat-ai-saved-prompt="${index}"><strong>Prompt ${index + 1}</strong><span>${escapeHtml(prompt.slice(0, 92))}</span></button><button type="button" data-chat-ai-remove-saved-prompt="${index}" aria-label="Xóa prompt">×</button></article>`).join("")}` : ""}</section>`;
    } else if (panel === "artifacts") {
      body = `<section class="chat-ai-artifacts" data-chat-ai-artifacts>${artifactsMarkup(session)}</section>`;
    } else if (panel === "settings") {
      const technicalProvider = escapeHtml(runtime.lastMeta.technicalProvider || "Chưa có yêu cầu");
      const technicalModel = escapeHtml(runtime.lastMeta.technicalModel || "Chưa có");
      body = `<section class="chat-ai-settings"><label><span>Tên cuộc trò chuyện</span><input data-chat-ai-title value="${escapeHtml(session.title)}" maxlength="120" ${runtime.incognito ? "disabled" : ""}></label><label><span>Thư mục</span><input data-chat-ai-folder value="${escapeHtml(session.folder || "Chung")}" maxlength="40" ${runtime.incognito ? "disabled" : ""}></label><label><span>Nhãn, phân cách bằng dấu phẩy</span><input data-chat-ai-tags value="${escapeHtml((session.tags || []).join(", "))}" maxlength="160" ${runtime.incognito ? "disabled" : ""}></label><label><span>Chế độ xử lý</span><select data-chat-ai-processing>${PROCESSING_MODES.map((mode) => `<option value="${mode.id}" ${runtime.state.processingMode === mode.id ? "selected" : ""}>${mode.label}</option>`).join("")}</select></label><label><span>Mức suy luận thủ công</span><select data-chat-ai-thinking>${[["minimal","Tối thiểu"],["low","Thấp"],["medium","Cân bằng"],["high","Cao"]].map(([id,label]) => `<option value="${id}" ${runtime.state.thinkingLevel === id ? "selected" : ""}>${label}</option>`).join("")}</select></label><label><span>Độ dài câu trả lời</span><select data-chat-ai-response-style>${[["concise","Ngắn gọn"],["balanced","Cân bằng"],["detailed","Chi tiết"]].map(([id,label])=>`<option value="${id}"${runtime.state.responseStyle===id?" selected":""}>${label}</option>`).join("")}</select></label><label><span>Độ dài ngữ cảnh</span><select data-chat-ai-context-budget>${[[12000,"Nhẹ"],[24000,"Cân bằng"],[32000,"Dài"]].map(([value,label])=>`<option value="${value}"${runtime.state.contextBudget===value?" selected":""}>${label}</option>`).join("")}</select></label><label><span>Giọng đọc</span><select data-chat-ai-voice>${voiceOptions(runtime.state.voiceName)}</select></label><label class="chat-ai-toggle"><input type="checkbox" data-chat-ai-search-toggle ${activeMode.search || runtime.state.webSearch ? "checked" : ""} ${activeMode.search ? "disabled" : ""}><span>${activeMode.search ? "Tìm kiếm web luôn bật trong chế độ Nghiên cứu" : "Tìm kiếm web khi cần dữ kiện mới"}</span></label><label class="chat-ai-toggle"><input type="checkbox" data-chat-ai-fallback-toggle ${runtime.state.autoFallback ? "checked" : ""}><span>Tự chuyển phương án xử lý khi dịch vụ quá tải</span></label><label class="chat-ai-toggle"><input type="checkbox" data-chat-ai-memory-toggle ${runtime.state.memoryEnabled ? "checked" : ""}><span>Cho phép dùng hồ sơ cá nhân hóa lưu trên thiết bị</span></label><label ${runtime.state.memoryEnabled ? "" : "hidden"}><span>Hồ sơ cá nhân hóa</span><textarea data-chat-ai-memory maxlength="1200" rows="4" placeholder="Ví dụ: Tôi thích câu trả lời ngắn, ưu tiên tiếng Việt…">${escapeHtml(runtime.state.memoryProfile)}</textarea></label><label><span>Chỉ dẫn hệ thống</span><textarea data-chat-ai-system maxlength="2000" rows="6">${escapeHtml(runtime.state.systemPrompt)}</textarea></label><button type="button" data-chat-ai-reset-system>Khôi phục chỉ dẫn mặc định</button><button type="button" data-chat-ai-clear-memory ${runtime.state.memoryProfile ? "" : "disabled"}>Xóa hồ sơ cá nhân hóa</button><details class="chat-ai-technical"><summary>Thông tin kỹ thuật</summary><p>Nhà cung cấp thực tế: <strong>${technicalProvider}</strong><br>Model nội bộ: <strong>${technicalModel}</strong><br>Độ trễ: <strong>${runtime.lastMeta.latencyMs ? `${runtime.lastMeta.latencyMs} ms` : "Chưa có"}</strong><br>Khóa truy cập chỉ nằm trên máy chủ.</p></details><small>HH Intelligence có thể dùng dịch vụ AI bên thứ ba. Thông tin kỹ thuật được thu gọn để giao diện dễ sử dụng nhưng vẫn minh bạch khi bạn cần kiểm tra.</small></section>`;
    } else {
      const stats = runtime.contextStats || compactHistory(session.messages, runtime.state.contextBudget);
      const percent = Math.round(Math.min(100, stats.chars / runtime.state.contextBudget * 100));
      body = `<section class="chat-ai-context"><article><span>CHẾ ĐỘ XỬ LÝ</span><strong>${escapeHtml(currentProcessingMode(runtime).label)}</strong><small>${escapeHtml(currentProcessingMode(runtime).detail)}</small></article><article><span>SỨC CHỨA NGỮ CẢNH</span><strong>${percent}% đang dùng</strong><small>${stats.history.length} phần · ${stats.omitted ? `${stats.omitted} tin cũ đã rút gọn` : "chưa cần rút gọn"}</small><meter min="0" max="${runtime.state.contextBudget}" value="${Math.min(stats.chars,runtime.state.contextBudget)}"></meter></article><article><span>HỘI THOẠI</span><strong>${session.messages.length} tin nhắn</strong><small>${runtime.incognito ? "Không lưu" : `Lưu trên thiết bị · ${escapeHtml(session.folder || "Chung")}`}</small></article><article><span>TÌM KIẾM WEB</span><strong>${runtime.state.webSearch || currentMode(runtime).search ? "Được bật" : "Đang tắt"}</strong><small>Nguồn sẽ xuất hiện khi dịch vụ trả citation</small></article><article><span>TRẠNG THÁI GẦN NHẤT</span><strong>${runtime.lastMeta.latencyMs ? "Đã hoàn tất" : "Sẵn sàng"}</strong><small>${runtime.lastMeta.latencyMs ? `${runtime.lastMeta.latencyMs} ms${runtime.lastMeta.fallbackUsed ? " · đã tự chuyển phương án" : ""}` : "Chưa có yêu cầu"}</small></article><details open><summary>HH Smart Router</summary><p>HH tự chọn phương án phù hợp theo độ dài, loại tác vụ, tệp và nhu cầu tìm kiếm. Khi dịch vụ quá tải, hệ thống đổi phương án trước khi chuyển sang HH Basic Assist.</p></details><details><summary>Quyền riêng tư</summary><p>Không nhập mật khẩu, khóa API hoặc bí mật. Ảnh/PDF chỉ được gửi khi bạn bấm Gửi. Hồ sơ cá nhân hóa mặc định tắt và chỉ lưu trên thiết bị.</p></details></section>`;
    }
    return `<aside class="chat-ai-inspector"><header class="chat-ai-drawer-head"><strong>Tùy chỉnh HH AI</strong><button type="button" data-chat-ai-mobile-close aria-label="Đóng tùy chỉnh">×</button></header>${tabs}<div class="chat-ai-inspector__body">${body}</div></aside>`;
  }
  function providerStatusLabel(status) {
    if (status === "online") return "HH Intelligence sẵn sàng";
    if (status === "degraded") return "HH AI đã tự chuyển phương án";
    if (status === "offline") return "HH Basic Assist sẵn sàng";
    return "Đang kiểm tra dịch vụ AI";
  }
  function updateProviderStatus(runtime) {
    if (!runtime?.host) return;
    const label = providerStatusLabel(runtime.providerStatus);
    runtime.host.querySelectorAll("[data-chat-ai-provider-state]").forEach((target) => {
      target.dataset.chatAiProviderState = runtime.providerStatus;
      const text = target.querySelector("[data-chat-ai-provider-label]");
      if (text) text.textContent = label;
    });
  }
  function shellMarkup(runtime) {
    const session = currentSession(runtime);
    const activeMode = currentMode(runtime);
    const messages = session.messages.length ? session.messages.map(messageMarkup).join("") : `<section class="chat-ai-welcome"><div class="chat-ai-orb"><span>HH</span><i></i><b></b></div><small>HH INTELLIGENCE · KIM LIÊN ĐIỆN</small><h2>Hôm nay chúng ta sẽ tạo nên điều gì?</h2><p>Trò chuyện nhiều lượt, nghiên cứu có nguồn, phân tích ảnh/PDF, viết nội dung và hỗ trợ lập trình trong một không gian riêng của bạn.</p><div>${PROMPTS.slice(0, 4).map(([title], index) => `<button type="button" data-chat-ai-prompt="${index}"><i>✦</i>${escapeHtml(title)}</button>`).join("")}</div></section>`;
    const mobilePanelClass = runtime.mobilePanel ? ` is-${runtime.mobilePanel}-open` : "";
    const providerLabel = providerStatusLabel(runtime.providerStatus);
    const layoutClass = `${mobilePanelClass}${runtime.state.inspectorOpen ? "" : " is-inspector-hidden"}${runtime.state.sidebarCollapsed ? " is-sidebar-collapsed" : ""}`;
    const folders = [...new Set(runtime.state.sessions.map((item) => item.folder || "Chung"))].sort((a, b) => a.localeCompare(b, "vi"));
    const primaryModes = MODES.filter((mode) => ["chat", "research", "code", "study"].includes(mode.id));
    const moreModes = MODES.filter((mode) => ["write", "vision"].includes(mode.id));
    const processingModes = PROCESSING_MODES.filter((mode) => mode.id !== "economy");
    const modeButton = (mode) => `<button type="button" class="${runtime.state.mode === mode.id ? "is-active" : ""}" data-chat-ai-mode="${mode.id}" aria-pressed="${runtime.state.mode === mode.id}" title="${escapeHtml(mode.prompt)}"><i>${mode.icon}</i><span>${mode.label}</span></button>`;
    return `<section class="chat-ai-hub${layoutClass}" data-chat-ai-hub data-busy="${runtime.busy}" data-private="${runtime.incognito}" data-active-mode="${escapeHtml(activeMode.id)}">
      <div class="chat-ai-cosmos" aria-hidden="true"><i></i><i></i><i></i><i></i><b></b><b></b><span></span><span></span><span></span></div>
      <header class="chat-ai-topbar">
        <button class="chat-ai-mobile-sessions" type="button" data-chat-ai-mobile-panel="sessions" aria-expanded="${runtime.mobilePanel === "sessions"}" aria-label="Mở danh sách hội thoại">☰</button>
        <div class="chat-ai-brand"><i><span>HH</span></i><span><small>HH · KIM LIÊN TRÍ TUỆ</small><strong>Chat AI</strong></span></div>
        <label class="chat-ai-chat-title"><span>Hội thoại hiện tại</span><input data-chat-ai-title value="${escapeHtml(session.title)}" maxlength="120" ${runtime.incognito ? "disabled" : ""} aria-label="Tên cuộc trò chuyện"></label>
        <div class="chat-ai-live-status" data-chat-ai-provider-state="${runtime.providerStatus}"><i></i><span data-chat-ai-provider-label>${providerLabel}</span></div>
        <div class="chat-ai-top-actions">
          <label class="chat-ai-processing"><span class="chat-ai-sr-only">Chế độ xử lý</span><select data-chat-ai-processing aria-label="Chế độ xử lý">${processingModes.map((mode) => `<option value="${mode.id}" ${runtime.state.processingMode === mode.id ? "selected" : ""}>${mode.id === "auto" ? "Tự động" : mode.id === "fast" ? "Nhanh" : "Suy luận sâu"}</option>`).join("")}</select></label>
          <details class="chat-ai-overflow"><summary aria-label="Mở thêm tùy chọn">•••</summary><div class="chat-ai-overflow__menu">
            <button type="button" class="${runtime.incognito ? "is-active" : ""}" data-chat-ai-private>◉ ${runtime.incognito ? "Tắt riêng tư" : "Riêng tư"}</button>
            <button type="button" class="chat-ai-desktop-settings ${runtime.state.inspectorOpen ? "is-active" : ""}" data-chat-ai-toggle-inspector>✦ Tùy chỉnh</button>
            <button type="button" class="chat-ai-mobile-settings" data-chat-ai-mobile-panel="inspector">✦ Tùy chỉnh</button>
            <label class="chat-ai-export-format"><span>Định dạng xuất</span><select data-chat-ai-export-format><option value="md">Markdown</option><option value="txt">TXT</option><option value="json">JSON</option><option value="pdf">In / PDF</option></select></label>
            <button type="button" data-chat-ai-export>⇩ Xuất hội thoại</button>
          </div></details>
        </div>
      </header>
      <nav class="chat-ai-mode-rail" aria-label="Chế độ Chat AI"><div class="chat-ai-mode-tabs">${primaryModes.map(modeButton).join("")}</div><details class="chat-ai-mode-more"><summary>＋ Thêm</summary><div>${moreModes.map(modeButton).join("")}</div></details></nav>
      <div class="chat-ai-layout">
        <aside class="chat-ai-sidebar"><header class="chat-ai-drawer-head"><strong>Hội thoại</strong><button type="button" data-chat-ai-mobile-close aria-label="Đóng lịch sử">×</button></header><button type="button" class="chat-ai-new" data-chat-ai-new>＋ Cuộc trò chuyện mới</button><label class="chat-ai-search"><span>⌕</span><input type="search" data-chat-ai-session-search value="${escapeHtml(runtime.query)}" placeholder="Tìm trong lịch sử..."></label><div class="chat-ai-folder-row"><select data-chat-ai-folder-filter aria-label="Lọc thư mục"><option value="">Tất cả thư mục</option>${folders.map((folder) => `<option value="${escapeHtml(folder)}" ${runtime.folderFilter === folder ? "selected" : ""}>${escapeHtml(folder)}</option>`).join("")}</select><button type="button" data-chat-ai-toggle-sidebar title="Thu gọn hội thoại">‹</button></div><div class="chat-ai-session-list" data-chat-ai-sessions>${runtime.incognito ? `<article class="chat-ai-private-card"><i>◉</i><strong>Phiên riêng tư</strong><span>Không ghi vào lịch sử</span></article>` : sessionsMarkup(runtime)}</div><footer><span data-chat-ai-provider-state="${runtime.providerStatus}"><i></i><b data-chat-ai-provider-label>${providerLabel}</b></span><small>Dữ liệu nhạy cảm và khóa truy cập được giữ phía máy chủ</small></footer></aside>
        <main class="chat-ai-main"><section class="chat-ai-stream" data-chat-ai-stream aria-live="polite">${messages}</section><section class="chat-ai-pending" data-chat-ai-pending ${runtime.pending.length || runtime.queue.length ? "" : "hidden"}>${pendingMarkup(runtime)}</section><form class="chat-ai-composer" data-chat-ai-form data-drop-active="false"><div class="chat-ai-composer__mode"><i>${escapeHtml(activeMode.icon)}</i><strong>${escapeHtml(activeMode.label)}</strong><span>${escapeHtml(activeMode.prompt)}</span></div><textarea data-chat-ai-input rows="2" maxlength="24000" placeholder="${escapeHtml(activeMode.placeholder)}">${escapeHtml(runtime.state.draft)}</textarea><div class="chat-ai-composer__bar"><div class="chat-ai-composer__tools"><label title="Kéo thả, dán hoặc chọn tệp">＋ <span>Tệp</span><input type="file" data-chat-ai-files multiple accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown,text/csv,application/json,.txt,.md,.csv,.json"></label><button type="button" data-chat-ai-mic title="Nhập bằng giọng nói">◉ <span>Nói</span></button><button type="button" data-chat-ai-save-prompt title="Lưu nội dung đang soạn">☆ <span>Lưu</span></button><button type="button" data-chat-ai-clear-draft title="Xóa nội dung">⌫</button></div><span class="chat-ai-composer__count"><b data-chat-ai-count>${runtime.state.draft.length}</b>/24000${runtime.queue.length ? ` · ${runtime.queue.length} đang chờ` : ""}</span><div class="chat-ai-composer__submit"><button type="button" class="chat-ai-stop" data-chat-ai-stop ${runtime.busy ? "" : "hidden"}>■ Dừng</button><button type="submit" class="chat-ai-send">${runtime.busy ? "Xếp hàng" : "Gửi"}<i>➤</i></button></div></div></form><footer class="chat-ai-honesty">HH Intelligence có thể mắc lỗi. Hãy kiểm tra dữ kiện quan trọng.</footer></main>
        ${rightPanelMarkup(runtime, session)}
      </div>
      <button type="button" class="chat-ai-mobile-backdrop" data-chat-ai-mobile-close aria-label="Đóng bảng điều khiển"></button><div class="chat-ai-toast" data-chat-ai-toast role="status" aria-live="polite" hidden></div>${runtime.deleted ? `<button class="chat-ai-undo" type="button" data-chat-ai-undo>Hoàn tác xóa “${escapeHtml(runtime.deleted.title)}”</button>` : ""}
    </section>`;
  }

  function captureFocus(runtime, enabled) {
    const active = runtime?.host?.ownerDocument?.activeElement;
    if (!enabled || !active || !runtime.host.contains(active)) return null;
    const attribute = [...active.attributes].find((item) => item.name.startsWith("data-chat-ai-"));
    const matching = attribute ? [...runtime.host.querySelectorAll(`[${attribute.name}]`)] : [];
    return {
      attribute: attribute?.name || "",
      value: attribute?.value || "",
      index: attribute ? Math.max(0, matching.indexOf(active)) : -1,
      id: active.id || "",
      name: active.getAttribute("name") || "",
      start: typeof active.selectionStart === "number" ? active.selectionStart : null,
      end: typeof active.selectionEnd === "number" ? active.selectionEnd : null
    };
  }
  function restoreFocus(runtime, snapshot) {
    if (!snapshot || !runtime?.host) return;
    let target = null;
    if (snapshot.attribute) {
      const matches = [...runtime.host.querySelectorAll(`[${snapshot.attribute}]`)].filter((item) => item.getAttribute(snapshot.attribute) === snapshot.value);
      target = matches[snapshot.index] || matches[0] || null;
    }
    if (!target && snapshot.id) target = runtime.host.ownerDocument.getElementById(snapshot.id);
    if (!target && snapshot.name) target = [...runtime.host.querySelectorAll("[name]")].find((item) => item.getAttribute("name") === snapshot.name) || null;
    target?.focus?.({ preventScroll: true });
    if (target && snapshot.start !== null && typeof target.setSelectionRange === "function") {
      const end = snapshot.end === null ? snapshot.start : snapshot.end;
      target.setSelectionRange(snapshot.start, end);
    }
  }
  function render(runtime, preserveFocus = true, scrollOptions = {}) {
    if (!runtime?.host) return;
    const previousStream = runtime.host.querySelector("[data-chat-ai-stream]");
    const previousAnchor = previousStream ? [...previousStream.querySelectorAll("[data-chat-ai-message]")].find((message) => message.getBoundingClientRect().bottom > previousStream.getBoundingClientRect().top) : null;
    const previousScroll = previousStream ? {
      top: previousStream.scrollTop,
      nearBottom: isNearStreamBottom(previousStream),
      anchorId: previousAnchor?.dataset?.chatAiMessage || "",
      anchorOffset: previousAnchor ? previousAnchor.getBoundingClientRect().top - previousStream.getBoundingClientRect().top : 0
    } : null;
    const focus = captureFocus(runtime, preserveFocus);
    runtime.host.innerHTML = shellMarkup(runtime);
    restoreFocus(runtime, focus);
    if (scrollOptions.focusInput) runtime.host.querySelector("[data-chat-ai-input]")?.focus?.({ preventScroll: true });
    const stream = runtime.host.querySelector("[data-chat-ai-stream]");
    if (stream) {
      if (scrollOptions.forceBottom || !previousScroll || previousScroll.nearBottom) scrollStreamToBottom(stream);
      else {
        stream.scrollTop = Math.min(previousScroll.top, Math.max(0, stream.scrollHeight - stream.clientHeight));
        const anchor = previousScroll.anchorId ? stream.querySelector(`[data-chat-ai-message="${previousScroll.anchorId}"]`) : null;
        if (anchor) stream.scrollTop += anchor.getBoundingClientRect().top - stream.getBoundingClientRect().top - previousScroll.anchorOffset;
      }
    }
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
  function retryAfterMilliseconds(value) {
    if (!value) return 0;
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(String(value));
    return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
  }
  function localContinuityResponse(input, options = {}) {
    const request = clean(input, 1200).replace(/\s+/g, " ") || "Yêu cầu chưa có phần văn bản.";
    const mode = clean(options.mode, 40) || "chat";
    const hasBinary = Boolean(options.hasBinary);
    const greeting = /^(?:xin chào|chào|hello|hi|hey)(?:\b|[!,.])/i.test(request);
    const codeTask = mode === "code" || /\b(?:code|bug|lỗi|api|javascript|typescript|python|html|css|sql|git)\b/i.test(request);
    const researchTask = mode === "research" || /\b(?:nghiên cứu|mới nhất|hiện nay|nguồn|tin tức|giá|luật)\b/i.test(request);
    const studyTask = mode === "study" || /\b(?:học|giải thích|bài tập|ôn tập|kiểm tra)\b/i.test(request);
    const writeTask = mode === "write" || /\b(?:viết|kịch bản|caption|bài đăng|nội dung|mô tả)\b/i.test(request);
    let actions;
    if (greeting) actions = ["Chào bạn! HH Basic Assist đang giữ hội thoại trong lúc dịch vụ AI đám mây khôi phục.", "Bạn có thể gửi mục tiêu, đoạn code hoặc nội dung cần xử lý; khi HH Intelligence sẵn sàng, nút **Tạo bản khác** sẽ chạy lại đúng yêu cầu."];
    else if (codeTask) actions = ["Chốt đầu ra mong muốn và cách tái hiện lỗi ngắn nhất.", "Ghi lại thông báo lỗi nguyên văn, môi trường chạy và dữ liệu đầu vào tối thiểu.", "Khoanh vùng thay đổi gần nhất, sửa một nguyên nhân mỗi lần rồi chạy syntax check và test hồi quy.", "Không đưa khóa API, token hoặc mật khẩu vào hội thoại hay mã client."];
    else if (researchTask) actions = ["Tách câu hỏi thành phạm vi, thời điểm và tiêu chí so sánh có thể kiểm chứng.", "Ưu tiên nguồn chính thức hoặc tài liệu gốc; ghi ngày truy cập cạnh dữ kiện dễ thay đổi.", "Tách rõ dữ kiện, suy luận và phần chưa xác minh.", "Chế độ local không có truy cập web nên chưa khẳng định thông tin thời gian thực."];
    else if (studyTask) actions = ["Nêu khái niệm bằng một câu đơn giản trước.", "Chia thành ba phần: nền tảng, ví dụ có lời giải và bài tự luyện chưa hiện đáp án.", "Tự giải thích lại bằng lời của bạn, sau đó kiểm tra điểm còn mơ hồ.", "Dùng nút tạo lại bằng cloud khi cần chấm hoặc phản hồi sâu theo ngữ cảnh."];
    else if (writeTask) actions = ["Xác định người đọc, mục tiêu và một thông điệp chính.", "Dựng khung: mở gây chú ý → giá trị cụ thể → bằng chứng/ví dụ → lời kêu gọi.", "Cắt câu lặp, kiểm tra tên riêng, dữ kiện và bản quyền trước khi xuất bản.", "Tạo ít nhất hai biến thể để so sánh giọng điệu và độ rõ."];
    else actions = ["Viết lại mục tiêu thành một kết quả có thể kiểm tra.", "Chia yêu cầu thành dữ liệu đầu vào, các bước xử lý và đầu ra mong muốn.", "Làm bước nhỏ có thể đảo ngược trước, ghi lại kết quả rồi mới mở rộng.", "Kiểm tra các giả định quan trọng trước khi dùng kết quả để quyết định."];
    return [
      "## HH Basic Assist đang hỗ trợ",
      "Dịch vụ AI đám mây hiện chưa phản hồi ổn định. Yêu cầu của bạn vẫn được giữ nguyên; nội dung dưới đây do bộ xử lý cơ bản trên thiết bị tạo và **không phải kết quả từ dịch vụ AI đám mây**.",
      "",
      `**Yêu cầu đã nhận:** ${request}`,
      hasBinary ? "\n**Tệp đính kèm:** chế độ local không đọc nội dung ảnh/PDF, vì vậy chưa đưa ra kết luận về tệp." : "",
      "",
      "### Hướng xử lý an toàn ngay bây giờ",
      ...actions.map((item, index) => `${index + 1}. ${item}`),
      "",
      "Khi HH Intelligence khôi phục đầy đủ, bấm **Tạo bản khác** ở câu trả lời này để nhận phân tích sâu hơn mà không phải nhập lại nội dung."
    ].filter(Boolean).join("\n");
  }
  async function providerRequest(runtime, input, history, attachments, modeId = "") {
    const base = clean(runtime.options.apiBase || globalScope.HH_API_BASE || globalScope.location?.origin, 600).replace(/\/$/, "");
    const token = globalScope.HHAuthSession?.token?.() || "";
    const mode = resolveMode(modeId || runtime.state.mode);
    const modeContract = modeRequestContract(mode.id, { manualWebSearch: runtime.state.webSearch });
    const routing = routeProcessing(input, { processingMode: runtime.state.processingMode, thinkingLevel: runtime.state.thinkingLevel, contextBudget: runtime.state.contextBudget, mode: mode.id, attachmentCount: attachments.length });
    const styleInstruction = runtime.state.responseStyle === "concise" ? "Trả lời ngắn gọn, ưu tiên kết luận và bước làm." : runtime.state.responseStyle === "detailed" ? "Giải thích chi tiết theo từng tầng, có ví dụ và giới hạn." : "Giữ độ dài cân bằng, rõ ràng và đủ để áp dụng.";
    const memoryInstruction = runtime.state.memoryEnabled && runtime.state.memoryProfile ? `\n\nHồ sơ cá nhân hóa do người dùng chủ động bật:\n${runtime.state.memoryProfile}` : "";
    const response = await fetch(`${base}/api/modules/chat-ai/actions`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ input, actionType: modeContract.actionType, anonymousId: anonymousId(), meta: { mode: modeContract.mode, provider: "gemini", allowProviderFallback: runtime.state.autoFallback, allowModelFallback: runtime.state.autoFallback, requireProvider: false, model: routing.model, thinkingLevel: routing.thinkingLevel, useGoogleSearch: modeContract.useGoogleSearch || routing.useWebSearch, systemPrompt: `${runtime.state.systemPrompt}${memoryInstruction}\n\nChế độ hiện tại: ${mode.label}. ${modeContract.prompt}\n${styleInstruction}`, history, attachments } }), signal: runtime.controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(clean(payload.error || "Chat AI backend chưa phản hồi.", 500)); error.code = payload.code || "CHAT_AI_ERROR"; error.status = response.status; error.retryAfterMs = retryAfterMilliseconds(response.headers.get("retry-after")); throw error; }
    if (!payload.action?.output) throw new Error("Chat AI backend trả về nội dung rỗng.");
    return { ...payload.action, requestedModel: payload.action.requestedModel || routing.model };
  }
  async function send(runtime, override = "", queuedAttachments = null, sendOptions = {}) {
    const inputNode = runtime.host.querySelector("[data-chat-ai-input]");
    let raw = clean(override || inputNode?.value || runtime.state.draft, 24000);
    const attachmentSource = Array.isArray(queuedAttachments) ? queuedAttachments : runtime.pending;
    let mode = resolveMode(sendOptions.mode || runtime.state.mode);
    if (!raw && !attachmentSource.length) { inputNode?.focus(); return toast(runtime, "Hãy nhập nội dung hoặc chọn tệp.", "warning"); }
    const command = raw.match(/^\/(research|code|write|study|vision|image|chat)\s*/i);
    if (command) {
      const commandMode = command[1].toLowerCase() === "image" ? "vision" : command[1].toLowerCase();
      runtime.state.mode = MODES.some((mode) => mode.id === commandMode) ? commandMode : runtime.state.mode;
      mode = currentMode(runtime);
      raw = clean(raw.slice(command[0].length), 24000) || raw;
    }
    if (mode.requiresAttachment && !attachmentSource.length) { inputNode?.focus(); return toast(runtime, "Chế độ Phân tích tệp cần ít nhất một ảnh, PDF hoặc tệp văn bản.", "warning"); }
    if (runtime.busy) {
      runtime.queue.push({ input: raw, attachments: attachmentSource.slice(0, 4), mode: mode.id, queuedAt: Date.now() });
      runtime.queue = runtime.queue.slice(0, 8);
      runtime.state.draft = ""; runtime.pending = []; writeState(runtime); render(runtime); toast(runtime, "Đã thêm yêu cầu vào hàng đợi."); return;
    }
    const session = currentSession(runtime);
    const routedContext = routeProcessing(raw, { processingMode: runtime.state.processingMode, thinkingLevel: runtime.state.thinkingLevel, contextBudget: runtime.state.contextBudget, mode: mode.id, attachmentCount: attachmentSource.length });
    const context = compactHistory(session.messages, routedContext.contextBudget);
    const history = context.history;
    runtime.contextStats = context;
    const textFiles = attachmentSource.filter((file) => file.kind === "text");
    const binaryFiles = attachmentSource.filter((file) => file.kind === "binary");
    const input = [raw, ...textFiles.map((file) => `\n\n--- TỆP ${file.name} ---\n${file.text}`)].join("").slice(0, 48000);
    const metadata = attachmentSource.map(({ name, mimeType, size }) => ({ name, mimeType, size }));
    const userMessage = { id: uid("user"), role: "user", text: raw || `Phân tích ${metadata.map((file) => file.name).join(", ")}`, mode: mode.id, createdAt: new Date().toISOString(), attachments: metadata };
    const loading = { id: uid("assistant"), role: "assistant", text: "", mode: mode.id, createdAt: new Date().toISOString(), loading: true };
    session.messages.push(userMessage, loading); session.messages = session.messages.slice(-MAX_MESSAGES); session.updatedAt = new Date().toISOString(); if (session.title === "Cuộc trò chuyện mới") session.title = clean(raw || metadata[0]?.name, 58) || session.title;
    runtime.state.draft = ""; runtime.busy = true; runtime.pending = []; runtime.controller = new AbortController(); writeState(runtime); render(runtime, true, { forceBottom: true, focusInput: true });
    const startedAt = performance.now();
    try {
      const action = await providerRequest(runtime, input, history, binaryFiles.map(({ name, mimeType, size, data }) => ({ name, mimeType, size, data })), mode.id);
      const actualProvider = clean(action.provider || "gemini", 80).toLowerCase();
      const continuity = actualProvider === "local" || actualProvider.startsWith("local-");
      const responseText = continuity ? migrateLegacyContinuityText(action.output) : action.output;
      Object.assign(loading, { loading: false, streaming: true, error: false, continuity, text: "", provider: actualProvider, providerError: action.providerError || "", model: action.model || (continuity ? "hh-basic-assist-v1" : action.requestedModel), latencyMs: Math.round(performance.now() - startedAt), usage: action.usage || null, sources: action.sources || [] });
      runtime.providerStatus = actualProvider === "gemini" ? "online" : "degraded";
      runtime.lastMeta = { label: assistantIdentity(loading).label, technicalProvider: actualProvider, technicalModel: loading.model, latencyMs: loading.latencyMs, tokens: action.usage?.totalTokenCount || action.usage?.total_tokens || action.usage?.totalTokens || "--", fallbackUsed: Boolean(action.fallbackUsed || actualProvider !== "gemini"), requestedModel: action.requestedModel || "" };
      await revealAssistant(runtime, loading, responseText);
    } catch (error) {
      const limited = Number(error.status) === 429 || /quota|resource_exhausted|rate limit/i.test(error.message);
      if (limited) runtime.cooldownUntil = Date.now() + Math.max(15000, Number(error.retryAfterMs) || 30000);
      if (error.name === "AbortError") {
        Object.assign(loading, { loading: false, stopped: true, error: false, text: "Đã dừng hiển thị yêu cầu này. Tác vụ đám mây có thể vẫn hoàn tất vì việc đóng kết nối không luôn đồng nghĩa với hủy xử lý phía máy chủ." });
      } else {
        const responseText = localContinuityResponse(input, { mode: mode.id, hasBinary: binaryFiles.length > 0 });
        Object.assign(loading, { loading: false, streaming: true, error: false, continuity: true, provider: "local-client", model: "hh-basic-assist-v1", providerError: clean(error.message, 500), latencyMs: Math.round(performance.now() - startedAt), text: "" });
        runtime.providerStatus = "offline";
        runtime.lastMeta = { label: "HH Basic Assist", technicalProvider: "local-client", technicalModel: "hh-basic-assist-v1", latencyMs: loading.latencyMs, tokens: "local", fallbackUsed: true, requestedModel: "" };
        await revealAssistant(runtime, loading, responseText);
      }
    } finally {
      runtime.busy = false; runtime.controller = null; session.updatedAt = new Date().toISOString(); writeState(runtime); render(runtime);
      const next = runtime.queue.shift();
      if (next) globalScope.setTimeout?.(() => send(runtime, next.input, next.attachments, { mode: next.mode }), 0);
    }
  }
  function download(filename, content, type = "text/plain;charset=utf-8") { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function exportSession(runtime, format = "md") {
    const session = currentSession(runtime); const stamp = new Date().toISOString().slice(0, 10); const safe = session.title.replace(/[^a-z0-9À-ỹ_-]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "chat-ai";
    if (format === "json") return download(`${safe}-${stamp}.json`, JSON.stringify({ version: VERSION, exportedAt: new Date().toISOString(), session }, null, 2), "application/json");
    if (format === "pdf") {
      const printable = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(session.title)}</title><style>body{font-family:Arial,sans-serif;max-width:820px;margin:32px auto;color:#18203a}h1{color:#4d4bd8}article{border:1px solid #dfe3f2;border-radius:12px;padding:14px;margin:12px 0}article h3{margin:0 0 8px;color:#5a63b8}.meta{color:#7b839c;font-size:12px}pre{white-space:pre-wrap;background:#f5f6fa;padding:10px;border-radius:8px}</style></head><body><h1>${escapeHtml(session.title)}</h1>${session.messages.map((message) => `<article><h3>${message.role === "assistant" ? "HH AI" : "Bạn"}</h3><div class="meta">${escapeHtml(nowLabelFrom(message.createdAt))}</div><div>${markdownMarkup(message.text, message.id)}</div></article>`).join("")}</body></html>`;
      const popup = globalScope.open?.("", "_blank", "noopener,noreferrer,width=920,height=760");
      if (popup?.document) { popup.document.write(printable); popup.document.close(); popup.focus?.(); popup.addEventListener?.("load", () => popup.print?.(), { once: true }); return; }
      return download(`${safe}-${stamp}.html`, printable, "text/html;charset=utf-8");
    }
    const content = [`# ${session.title}`, "", ...session.messages.map((message) => `## ${message.role === "assistant" ? assistantIdentity(message).label : "Bạn"}\n\n${message.text}${message.sources?.length ? `\n\nNguồn:\n${message.sources.map((source) => `- ${source.title}: ${source.url}`).join("\n")}` : ""}`)].join("\n\n");
    download(`${safe}-${stamp}.${format}`, content, format === "md" ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8");
  }
  async function copyText(text) { if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text); throw new Error("Clipboard chưa được trình duyệt cho phép."); }
  function findMessage(runtime, id) { return currentSession(runtime).messages.find((message) => message.id === id); }
  function newSession(runtime) { if (runtime.incognito) runtime.privateSession = blankSession("Phiên riêng tư"); else { const session = blankSession(); runtime.state.sessions.unshift(session); runtime.state.sessions = runtime.state.sessions.slice(0, MAX_SESSIONS); runtime.state.activeId = session.id; writeState(runtime); } runtime.pending = []; render(runtime, false, { forceBottom: true }); }
  function branchSession(runtime, messageId) {
    if (runtime.incognito) return toast(runtime, "Tắt Chế độ riêng tư để lưu nhánh.", "warning");
    const source = currentSession(runtime); const index = source.messages.findIndex((message) => message.id === messageId); if (index < 0) return;
    const branch = blankSession(`${source.title} · nhánh`); branch.messages = source.messages.slice(0, index + 1).map((message) => ({ ...message, id: uid(message.role) })); runtime.state.sessions.unshift(branch); runtime.state.activeId = branch.id; writeState(runtime); render(runtime, false, { forceBottom: true }); toast(runtime, "Đã tạo nhánh hội thoại mới.");
  }
  function speak(runtime, message) {
    if (!globalScope.speechSynthesis || !globalScope.SpeechSynthesisUtterance) return toast(runtime, "Trình duyệt chưa hỗ trợ đọc văn bản.", "warning");
    globalScope.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(message.text.slice(0, 5000)); utterance.lang = "vi-VN"; utterance.rate = 1; const preferred = globalScope.speechSynthesis.getVoices?.().find((voice) => voice.name === runtime.state.voiceName) || globalScope.speechSynthesis.getVoices?.().find((voice) => /^vi(?:-|_)/i.test(voice.lang)); if (preferred) utterance.voice = preferred; globalScope.speechSynthesis.speak(utterance);
  }
  function startVoice(runtime) {
    const Recognition = globalScope.SpeechRecognition || globalScope.webkitSpeechRecognition;
    if (!Recognition) return toast(runtime, "Trình duyệt chưa hỗ trợ nhập giọng nói.", "warning");
    const recognition = new Recognition(); recognition.lang = "vi-VN"; recognition.interimResults = false; recognition.onresult = (event) => { const input = runtime.host.querySelector("[data-chat-ai-input]"); if (input) { input.value = `${input.value}${input.value ? " " : ""}${event.results[0][0].transcript}`; input.dispatchEvent(new Event("input", { bubbles: true })); } }; recognition.onerror = () => toast(runtime, "Không nhận được giọng nói.", "warning"); recognition.start();
  }
  async function checkProvider(runtime) {
    const base = clean(runtime.options.apiBase || globalScope.HH_API_BASE || globalScope.location?.origin, 600).replace(/\/$/, ""); const token = globalScope.HHAuthSession?.token?.() || "";
    try { const response = await fetch(`${base}/api/modules/chat-ai/actions?anonymousId=${encodeURIComponent(anonymousId())}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" }); const data = await response.json().catch(() => ({})); const geminiReady = Boolean(data.providers?.gemini?.configured && data.providers?.gemini?.availableKeyCount !== 0); const alternateReady = Boolean(data.providers?.openai?.configured); runtime.providerStatus = response.ok && geminiReady ? "online" : response.ok && (alternateReady || data.supports?.localContinuity) ? "degraded" : "offline"; runtime.providerDetail = data.providers || null; } catch { runtime.providerStatus = "offline"; } updateProviderStatus(runtime);
  }

  async function addFiles(runtime, files) {
    for (const file of [...(files || [])].slice(0, 4)) {
      try { runtime.pending.push(await readFile(file)); } catch (error) { toast(runtime, error.message, "warning"); }
    }
    runtime.pending = runtime.pending.slice(0, 4); render(runtime);
  }

  async function handleClick(runtime, event) {
    const button = event.target.closest("button,[data-chat-ai-files]"); if (!button) return;
    if (button.dataset.chatAiMobilePanel) { runtime.mobilePanel = runtime.mobilePanel === button.dataset.chatAiMobilePanel ? "" : button.dataset.chatAiMobilePanel; return render(runtime); }
    if (button.dataset.chatAiMobileClose !== undefined) { runtime.mobilePanel = ""; return render(runtime); }
    if (button.dataset.chatAiToggleInspector !== undefined) { runtime.state.inspectorOpen = !runtime.state.inspectorOpen; writeState(runtime); return render(runtime); }
    if (button.dataset.chatAiToggleSidebar !== undefined) { runtime.state.sidebarCollapsed = !runtime.state.sidebarCollapsed; writeState(runtime); return render(runtime); }
    if (button.dataset.chatAiNew !== undefined) { runtime.mobilePanel = ""; return newSession(runtime); }
    if (button.dataset.chatAiSession) { runtime.state.activeId = button.dataset.chatAiSession; runtime.pending = []; runtime.mobilePanel = ""; writeState(runtime); return render(runtime, false, { forceBottom: true }); }
    if (button.dataset.chatAiMode) { runtime.state.mode = resolveMode(button.dataset.chatAiMode).id; writeState(runtime); return render(runtime); }
    if (button.dataset.chatAiPanel) { runtime.state.panel = button.dataset.chatAiPanel; writeState(runtime); return render(runtime); }
    if (button.dataset.chatAiPrompt !== undefined) { const prompt = PROMPTS[Number(button.dataset.chatAiPrompt)]?.[1] || ""; runtime.state.draft = prompt; writeState(runtime); render(runtime); runtime.host.querySelector("[data-chat-ai-input]")?.focus(); return; }
    if (button.dataset.chatAiSavedPrompt !== undefined) { runtime.state.draft = runtime.state.favoritePrompts[Number(button.dataset.chatAiSavedPrompt)] || ""; writeState(runtime); render(runtime); runtime.host.querySelector("[data-chat-ai-input]")?.focus(); return; }
    if (button.dataset.chatAiFavoritePrompt !== undefined) { const prompt = PROMPTS[Number(button.dataset.chatAiFavoritePrompt)]?.[1]; if (prompt && !runtime.state.favoritePrompts.includes(prompt)) runtime.state.favoritePrompts.unshift(prompt); runtime.state.favoritePrompts = runtime.state.favoritePrompts.slice(0, 20); writeState(runtime); render(runtime); return toast(runtime, "Đã lưu prompt yêu thích."); }
    if (button.dataset.chatAiSavePrompt !== undefined) { const prompt = clean(runtime.state.draft, 2000); if (!prompt) return toast(runtime, "Hãy nhập nội dung trước khi lưu prompt.", "warning"); if (!runtime.state.favoritePrompts.includes(prompt)) runtime.state.favoritePrompts.unshift(prompt); runtime.state.favoritePrompts = runtime.state.favoritePrompts.slice(0, 20); writeState(runtime); render(runtime); return toast(runtime, "Đã lưu prompt trên thiết bị."); }
    if (button.dataset.chatAiRemoveSavedPrompt !== undefined) { runtime.state.favoritePrompts.splice(Number(button.dataset.chatAiRemoveSavedPrompt), 1); writeState(runtime); return render(runtime); }
    if (button.dataset.chatAiPrivate !== undefined) { runtime.incognito = !runtime.incognito; if (runtime.incognito) runtime.privateSession = blankSession("Phiên riêng tư"); runtime.pending = []; return render(runtime); }
    if (button.dataset.chatAiExport !== undefined) {
      const format = runtime.host.querySelector("[data-chat-ai-export-format]")?.value;
      return exportSession(runtime, ["md", "txt", "json", "pdf"].includes(format) ? format : "md");
    }
    if (button.dataset.chatAiStop !== undefined) { runtime.controller?.abort(); return; }
    if (button.dataset.chatAiClearDraft !== undefined) { runtime.state.draft = ""; writeState(runtime); return render(runtime); }
    if (button.dataset.chatAiMic !== undefined) return startVoice(runtime);
    if (button.dataset.chatAiRemoveFile !== undefined) { runtime.pending.splice(Number(button.dataset.chatAiRemoveFile), 1); return render(runtime); }
    if (button.dataset.chatAiRemoveQueue !== undefined) { runtime.queue.splice(Number(button.dataset.chatAiRemoveQueue), 1); return render(runtime); }
    if (button.dataset.chatAiCopy) { const message = findMessage(runtime, button.dataset.chatAiCopy); try { await copyText(message?.text || ""); toast(runtime, "Đã sao chép câu trả lời."); } catch (error) { toast(runtime, error.message, "warning"); } return; }
    if (button.dataset.chatAiCopyCode) { const code = runtime.host.querySelector(`[data-chat-ai-code="${CSS.escape(button.dataset.chatAiCopyCode)}"]`)?.textContent || ""; try { await copyText(code); toast(runtime, "Đã sao chép code."); } catch (error) { toast(runtime, error.message, "warning"); } return; }
    if (button.dataset.chatAiRegenerate) { const session = currentSession(runtime); const index = session.messages.findIndex((message) => message.id === button.dataset.chatAiRegenerate); const previous = [...session.messages.slice(0, index)].reverse().find((message) => message.role === "user"); if (previous) return send(runtime, previous.text, null, { mode: previous.mode || runtime.state.mode }); return; }
    if (button.dataset.chatAiRefine) { const prompts = { continue: "Hãy tiếp tục câu trả lời ngay trước, không lặp lại phần đã viết.", shorter: "Hãy viết lại câu trả lời ngay trước ngắn gọn hơn nhưng không bỏ mất kết luận quan trọng.", detailed: "Hãy mở rộng câu trả lời ngay trước chi tiết hơn, thêm ví dụ và nêu giới hạn." }; const previous = [...currentSession(runtime).messages].reverse().find((message) => message.role === "assistant" && !message.loading); return send(runtime, prompts[button.dataset.chatAiRefine] || prompts.continue, null, { mode: previous?.mode || runtime.state.mode }); }
    if (button.dataset.chatAiSpeak) { const message = findMessage(runtime, button.dataset.chatAiSpeak); if (message) speak(runtime, message); return; }
    if (button.dataset.chatAiEditMessage) { const message = findMessage(runtime, button.dataset.chatAiEditMessage); if (message) { runtime.state.draft = message.text; writeState(runtime); render(runtime); runtime.host.querySelector("[data-chat-ai-input]")?.focus(); } return; }
    if (button.dataset.chatAiMessagePin) { const message = findMessage(runtime, button.dataset.chatAiMessagePin); if (message) { message.pinned = !message.pinned; writeState(runtime); render(runtime); } return; }
    if (button.dataset.chatAiBranch) return branchSession(runtime, button.dataset.chatAiBranch);
    if (button.dataset.chatAiPin) { const session = runtime.state.sessions.find((item) => item.id === button.dataset.chatAiPin); if (session) { session.pinned = !session.pinned; writeState(runtime); render(runtime); } return; }
    if (button.dataset.chatAiRename) {
      const session = runtime.state.sessions.find((item) => item.id === button.dataset.chatAiRename);
      if (!session || runtime.incognito) return;
      const nextTitle = clean(globalScope.prompt?.("Đổi tên cuộc trò chuyện", session.title) || "", 120);
      if (nextTitle) { session.title = nextTitle; session.updatedAt = new Date().toISOString(); writeState(runtime); render(runtime); }
      return;
    }
    if (button.dataset.chatAiDelete) { if (runtime.state.sessions.length <= 1) return toast(runtime, "Cần giữ ít nhất một cuộc trò chuyện.", "warning"); const index = runtime.state.sessions.findIndex((item) => item.id === button.dataset.chatAiDelete); if (index > -1) { runtime.deleted = { ...runtime.state.sessions[index], index }; runtime.state.sessions.splice(index, 1); if (runtime.state.activeId === button.dataset.chatAiDelete) runtime.state.activeId = runtime.state.sessions[0].id; writeState(runtime); render(runtime); } return; }
    if (button.dataset.chatAiUndo !== undefined && runtime.deleted) { runtime.state.sessions.splice(runtime.deleted.index, 0, runtime.deleted); runtime.state.activeId = runtime.deleted.id; runtime.deleted = null; writeState(runtime); return render(runtime); }
    if (button.dataset.chatAiResetSystem !== undefined) { runtime.state.systemPrompt = defaultState().systemPrompt; writeState(runtime); return render(runtime); }
    if (button.dataset.chatAiClearMemory !== undefined) { runtime.state.memoryProfile = ""; runtime.state.memoryEnabled = false; writeState(runtime); render(runtime); return toast(runtime, "Đã xóa hồ sơ cá nhân hóa trên thiết bị."); }
    if (button.dataset.chatAiDownloadArtifact !== undefined) { const session = currentSession(runtime); const artifacts = []; session.messages.filter((message) => message.role === "assistant").forEach((message) => String(message.text).split(/```/).forEach((part, index) => { if (index % 2) { const newline = part.indexOf("\n"); artifacts.push({ language: newline > -1 ? part.slice(0, newline) : "txt", code: newline > -1 ? part.slice(newline + 1) : part }); } })); const artifact = artifacts[Number(button.dataset.chatAiDownloadArtifact)]; if (artifact) download(`chat-ai-code-${Date.now()}.${artifact.language || "txt"}`, artifact.code); }
  }
  async function handleChange(runtime, event) {
    if (event.target.matches("[data-chat-ai-processing]")) runtime.state.processingMode = PROCESSING_MODES.some((mode) => mode.id === event.target.value) ? event.target.value : "auto";
    else if (event.target.matches("[data-chat-ai-thinking]")) runtime.state.thinkingLevel = event.target.value;
    else if (event.target.matches("[data-chat-ai-search-toggle]")) { runtime.state.webSearch = Boolean(event.target.checked); runtime.state.webSearchExplicit = true; }
    else if (event.target.matches("[data-chat-ai-fallback-toggle]")) runtime.state.autoFallback = Boolean(event.target.checked);
    else if (event.target.matches("[data-chat-ai-memory-toggle]")) runtime.state.memoryEnabled = Boolean(event.target.checked);
    else if (event.target.matches("[data-chat-ai-voice]")) runtime.state.voiceName = clean(event.target.value, 160);
    else if (event.target.matches("[data-chat-ai-folder-filter]")) runtime.folderFilter = clean(event.target.value, 40);
    else if (event.target.matches("[data-chat-ai-response-style]")) runtime.state.responseStyle = ["concise", "balanced", "detailed"].includes(event.target.value) ? event.target.value : "balanced";
    else if (event.target.matches("[data-chat-ai-context-budget]")) runtime.state.contextBudget = Math.max(8000, Math.min(MAX_CONTEXT_CHARS, Number(event.target.value) || 24000));
    else if (event.target.matches("[data-chat-ai-files]")) { await addFiles(runtime, event.target.files); event.target.value = ""; return; }
    else return;
    writeState(runtime); render(runtime);
  }
  function handleInput(runtime, event) {
    if (event.target.matches("[data-chat-ai-input]")) { runtime.state.draft = event.target.value.slice(0, 24000); if (!runtime.incognito) writeState(runtime); const count = runtime.host.querySelector("[data-chat-ai-count]"); if (count) count.textContent = runtime.state.draft.length; }
    if (event.target.matches("[data-chat-ai-session-search]")) { runtime.query = event.target.value; const list = runtime.host.querySelector("[data-chat-ai-sessions]"); if (list) list.innerHTML = sessionsMarkup(runtime); }
    if (event.target.matches("[data-chat-ai-title]") && !runtime.incognito) { const session = currentSession(runtime); session.title = clean(event.target.value, 120) || "Cuộc trò chuyện"; session.updatedAt = new Date().toISOString(); writeState(runtime); }
    if (event.target.matches("[data-chat-ai-folder]") && !runtime.incognito) { const session = currentSession(runtime); session.folder = clean(event.target.value, 40) || "Chung"; session.updatedAt = new Date().toISOString(); writeState(runtime); }
    if (event.target.matches("[data-chat-ai-tags]") && !runtime.incognito) { const session = currentSession(runtime); session.tags = event.target.value.split(",").map((tag) => clean(tag, 24)).filter(Boolean).slice(0, 6); session.updatedAt = new Date().toISOString(); writeState(runtime); }
    if (event.target.matches("[data-chat-ai-system]")) { runtime.state.systemPrompt = event.target.value.slice(0, 2000); writeState(runtime); }
    if (event.target.matches("[data-chat-ai-memory]")) { runtime.state.memoryProfile = event.target.value.slice(0, 1200); writeState(runtime); }
  }
  function handleKeydown(runtime, event) { if (event.target.matches("[data-chat-ai-input]") && event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); event.target.closest("form")?.requestSubmit(); } }
  function handleSubmit(runtime, event) { if (!event.target.matches("[data-chat-ai-form]")) return; event.preventDefault(); send(runtime); }
  function mount(host, options = {}) {
    unmount(); if (!host) return false;
    const controller = new AbortController(); const owner = ownerId(options); const storage = options.storage || globalScope.localStorage;
    instance = { host, options, lifecycleController: controller, controller: null, owner, storage, state: readState(storage, owner), pending: [], queue: [], busy: false, incognito: false, privateSession: blankSession("Phiên riêng tư"), providerStatus: "checking", providerDetail: null, query: "", folderFilter: "", deleted: null, lastMeta: {}, contextStats: null, cooldownUntil: 0, toastTimer: 0, storageError: false, mobilePanel: "" };
    try {
      const handoff = JSON.parse(globalScope.sessionStorage?.getItem("hh.chat-ai.handoff.v1") || "null");
      if (handoff?.prompt && Date.now() - Number(handoff.at || 0) < 5 * 60 * 1000) {
        instance.state.draft = clean(handoff.prompt, 24000);
        instance.state.mode = "research";
        instance.state.webSearch = true;
        globalScope.sessionStorage.removeItem("hh.chat-ai.handoff.v1");
      }
    } catch { /* Session storage may be unavailable. */ }
    if (options.newSession) { const session = blankSession(); instance.state.sessions.unshift(session); instance.state.sessions = instance.state.sessions.slice(0, MAX_SESSIONS); instance.state.activeId = session.id; writeState(instance); }
    host.addEventListener("click", (event) => handleClick(instance, event).catch((error) => toast(instance, error.message, "error")), { signal: controller.signal });
    host.addEventListener("change", (event) => handleChange(instance, event).catch((error) => toast(instance, error.message, "error")), { signal: controller.signal });
    host.addEventListener("input", (event) => handleInput(instance, event), { signal: controller.signal });
    host.addEventListener("keydown", (event) => handleKeydown(instance, event), { signal: controller.signal });
    host.addEventListener("submit", (event) => handleSubmit(instance, event), { signal: controller.signal });
    host.addEventListener("dragover", (event) => { if (![...(event.dataTransfer?.types || [])].includes("Files")) return; event.preventDefault(); const form = host.querySelector("[data-chat-ai-form]"); if (form) form.dataset.dropActive = "true"; }, { signal: controller.signal });
    host.addEventListener("dragleave", (event) => { if (event.relatedTarget && host.contains(event.relatedTarget)) return; const form = host.querySelector("[data-chat-ai-form]"); if (form) form.dataset.dropActive = "false"; }, { signal: controller.signal });
    host.addEventListener("drop", (event) => { if (!event.dataTransfer?.files?.length) return; event.preventDefault(); addFiles(instance, event.dataTransfer.files).catch((error) => toast(instance, error.message, "error")); }, { signal: controller.signal });
    host.addEventListener("paste", (event) => { const files = [...(event.clipboardData?.files || [])]; if (!files.length) return; event.preventDefault(); addFiles(instance, files).catch((error) => toast(instance, error.message, "error")); }, { signal: controller.signal });
    globalScope.document?.addEventListener("visibilitychange", () => { host.dataset.chatAiPaused = globalScope.document.hidden ? "true" : "false"; }, { signal: controller.signal });
    render(instance); checkProvider(instance); return true;
  }
  function unmount() { if (!instance) return; instance.controller?.abort(); instance.lifecycleController?.abort(); clearTimeout(instance.toastTimer); globalScope.speechSynthesis?.cancel?.(); instance = null; }
  function inspect() { return { version: VERSION, mounted: Boolean(instance), owner: instance?.owner || null, sessions: instance?.state?.sessions?.length || 0, busy: Boolean(instance?.busy), providerStatus: instance?.providerStatus || "idle" }; }

  return Object.freeze({ VERSION, STORAGE_SCHEMA, MODELS, PROCESSING_MODES, MODES, PROMPTS, MAX_SESSIONS, MAX_MESSAGES, MAX_CONTEXT_CHARS, estimateTokens, compactHistory, routeProcessing, modeRequestContract, revealChunks, isNearStreamBottom, localContinuityResponse, migrateLegacyContinuityText, storageKey, normalizeState, mount, unmount, inspect });
});
