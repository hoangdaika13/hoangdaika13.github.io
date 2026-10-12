(function (scope, factory) {
  const api = factory(scope || {});
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (scope) scope.HHChatAIMedia = api;
})(typeof window !== "undefined" ? window : globalThis, function (scope) {
  "use strict";
  const STYLES = { custom: ["Tự chọn", ""], photo: ["Ảnh chân thật", "Ánh sáng tự nhiên, chất liệu và chiều sâu chân thật."], cinema: ["Điện ảnh", "Ánh sáng điện ảnh, bố cục có chiều sâu, màu sắc tinh tế."], illustration: ["Minh họa", "Minh họa nguyên bản, đường nét rõ, bảng màu hài hòa."], cosmic: ["Vũ trụ 3D", "Không gian vũ trụ 3D, ánh sáng neon tinh tế, chi tiết mềm mại."] };
  const RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"];
  const STATUS = { submitting: "Đang gửi yêu cầu", running: "Nhà cung cấp đang xử lý", dispatching: "Đang chuyển tác vụ", queued: "Đang chờ", submitted: "Đã gửi tới nhà cung cấp", completed: "Đã có kết quả", failed: "Tác vụ thất bại", canceled: "Đã hủy", "cancel-requested": "Đã yêu cầu hủy; chờ xác nhận", "submission-unknown": "Chưa xác nhận lần gửi", "pause-requested": "Chờ xác nhận tạm dừng", paused: "Đã tạm dừng" };
  const ACTIVE = new Set(["submitting", "running", "dispatching", "queued", "submitted", "cancel-requested", "pause-requested"]);
  const text = (value, max = 5000) => String(value || "").trim().slice(0, max);
  const esc = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const choice = (value, list, fallback) => list.includes(value) ? value : fallback;
  function normalizeSettings(value = {}) {
    return { aspectRatio: choice(value.aspectRatio, RATIOS, "16:9"), imageSize: choice(value.imageSize, ["1K", "2K"], "1K"),
      durationSeconds: choice(Number(value.durationSeconds), [4, 6, 8, 10], 8), resolution: choice(value.resolution, ["720p", "1080p", "4k"], "720p"), style: choice(value.style, Object.keys(STYLES), "custom") };
  }
  function normalizeMedia(value) {
    if (!["image", "video"].includes(value?.kind)) return null;
    const result = { kind: value.kind, jobId: /^[a-f0-9]{24}$/i.test(value.jobId || "") ? value.jobId : "",
      requestKey: /^[a-z0-9_-]{8,180}$/i.test(value.requestKey || "") ? value.requestKey : "",
      status: Object.hasOwn(STATUS, value.status) ? value.status : "submission-unknown", error: text(value.error, 500),
      prompt: text(value.prompt), settings: normalizeSettings(value.settings), model: text(value.model, 120), expiresAt: text(value.expiresAt, 40) };
    if (value.kind === "video" && /^[a-f0-9]{24}$/i.test(value.quoteId || "")) result.quoteId = value.quoteId;
    return result; // Never retain bytes, provider URLs, tokens or Blob URLs in local history.
  }
  function videoRequest(prompt, settings) {
    const s = normalizeSettings(settings);
    return { mode: "text-to-video", prompt: text(prompt), durationSeconds: s.durationSeconds, aspectRatio: s.aspectRatio,
      resolution: s.resolution, variants: 1, provider: "auto" };
  }
  function jobPath(media, download = false) {
    if (!media?.jobId && (!media?.requestKey || media.kind !== "image")) return "";
    return media.kind === "video" ? `/api/ai-video-remake?action=${download ? "download" : "status"}&id=${encodeURIComponent(media.jobId)}`
      : `/api/modules/chat-ai/actions?mediaAction=${download ? "image-download" : "image-status"}&${media.jobId ? `id=${encodeURIComponent(media.jobId)}` : `requestKey=${encodeURIComponent(media.requestKey)}`}`;
  }
  function options(values, selected) { return values.map((item) => `<option value="${esc(item)}" ${String(item) === String(selected) ? "selected" : ""}>${esc(item)}</option>`).join(""); }
  function controls(runtime) {
    const kind = runtime.state.mode;
    if (!["image", "video"].includes(kind)) return "";
    const control = runtime.mediaControl, settings = normalizeSettings(runtime.state.mediaSettings);
    const cap = kind === "image" ? control?.image : control?.video;
    const ratios = kind === "image" ? RATIOS : cap?.limits?.directVeoAspectRatios?.length ? cap.limits.directVeoAspectRatios : ["16:9", "9:16"];
    const label = control?.checking ? "Đang kiểm tra dịch vụ media…" : kind === "image"
      ? !cap?.configured ? "Tạo ảnh: dịch vụ chưa cấu hình hoặc chưa kết nối được." : cap.canCreate ? "Ảnh có thể tính phí API · ảnh máy chủ lưu 7 ngày; tải về để giữ lâu dài." : cap.message
      : !cap?.modes?.["text-to-video"]?.supported ? "Video: chưa cấu hình dịch vụ tạo video từ mô tả." : !cap?.billing?.canCreate ? cap.billing?.reason : "Video có thể tính phí · cần báo giá máy chủ và xác nhận trước khi tạo.";
    const review = control?.review;
    return `<section class="chat-media-controls" aria-label="Tùy chọn tạo ${kind === "image" ? "ảnh" : "video"}"><p role="status">${esc(label || "Đăng nhập để tạo media.")}</p><div class="chat-media-options"><label>Khung hình<select data-chat-media-setting="aspectRatio">${options(ratios, settings.aspectRatio)}</select></label><label>Phong cách<select data-chat-media-setting="style">${Object.entries(STYLES).map(([key, value]) => `<option value="${key}" ${settings.style === key ? "selected" : ""}>${value[0]}</option>`).join("")}</select></label>${kind === "image" ? `<label>Độ nét<select data-chat-media-setting="imageSize">${options(["1K", "2K"], settings.imageSize)}</select></label>` : `<label>Thời lượng<select data-chat-media-setting="durationSeconds">${options(cap?.limits?.directVeoDurationsSeconds || [4,6,8], settings.durationSeconds)}</select></label><label>Độ nét<select data-chat-media-setting="resolution">${options(cap?.limits?.directVeoResolutions || ["720p"], settings.resolution)}</select></label>`}</div>${kind === "image" ? `<small>Thêm tối đa 2 ảnh PNG/JPEG/WebP để chỉnh sửa hoặc làm tham chiếu. Không gửi PDF trong chế độ tạo ảnh.</small>` : `<small>Chat tạo video từ văn bản. Remix video/nhân vật: dùng AI Video Remake Studio.</small>`}${review ? `<section class="chat-media-review" aria-label="Xác nhận tạo media"><strong>Xem lại yêu cầu ${review.kind === "image" ? "tạo ảnh" : "tạo video"}</strong><p>${esc(review.prompt)}</p><p>${esc(review.costLabel)}</p><label><input type="checkbox" data-chat-media-cost> Tôi đồng ý chi phí API cho đúng yêu cầu này.</label><label><input type="checkbox" data-chat-media-rights> Tôi có quyền sử dụng nội dung và ảnh tham chiếu.</label><div><button type="button" data-chat-media-confirm>Tạo ${review.kind === "image" ? "ảnh" : "video"} ngay</button><button type="button" data-chat-media-dismiss>Quay lại chỉnh</button></div></section>` : ""}</section>`;
  }
  function messageMarkup(message) {
    const media = normalizeMedia(message.media); if (!media) return "";
    const id = esc(message.id);
    return `<section class="chat-media-result" data-chat-media-result="${id}"><header><strong>${media.kind === "image" ? "◫ Ảnh AI" : "▷ Video AI"}</strong><span role="status">${esc(STATUS[media.status])}</span></header>${media.error ? `<p class="chat-media-error">${esc(media.error)}</p>` : ""}<div data-chat-media-preview="${id}"></div><footer>${media.status === "completed" && media.jobId ? `<button type="button" data-chat-media-view="${id}">Xem kết quả</button><button type="button" data-chat-media-download="${id}">Tải ${media.kind === "image" ? "ảnh" : "video"}</button>` : `<button type="button" data-chat-media-check="${id}">Kiểm tra kết quả</button>`}<button type="button" data-chat-media-use="${id}">Chỉnh prompt / bản mới</button>${media.kind === "video" && media.jobId && ACTIVE.has(media.status) ? `<button type="button" data-chat-media-cancel="${id}">Yêu cầu hủy</button>` : ""}</footer>${media.expiresAt ? `<small>Ảnh lưu tới ${esc(new Date(media.expiresAt).toLocaleDateString("vi-VN"))}; lịch sử chat chỉ lưu mã tác vụ.</small>` : ""}</section>`;
  }
  function create(runtime, hooks) {
    const state = { checking: true, image: null, video: null, review: null, revision: 0, timer: 0, checkingJobs: new Set(), fetching: new Set(), urls: new Map(), disposed: false };
    const active = () => !state.disposed && !runtime.lifecycleController.signal.aborted;
    const base = () => text(runtime.options.apiBase || scope.HH_API_BASE || scope.location?.origin, 600).replace(/\/$/, "");
    function headers() { const token = scope.HHAuthSession?.token?.() || ""; return token ? { Authorization: `Bearer ${token}` } : {}; }
    async function request(path, body, blob = false) {
      const response = await scope.fetch(`${base()}${path}`, { method: body ? "POST" : "GET", credentials: "include", cache: "no-store",
        headers: { ...headers(), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.any([runtime.lifecycleController.signal, ...(runtime.controller ? [runtime.controller.signal] : []), AbortSignal.timeout(blob ? 60000 : 45000)]) });
      if (blob && response.ok) {
        if (Number(response.headers.get("content-length")) > 40 * 1024 * 1024) throw new Error("Media vượt giới hạn xem/tải trong Chat (40 MB); dùng Studio để tải.");
        const mimeType = (response.headers.get("content-type") || "").split(";")[0];
        if (!/^(image\/(png|jpeg|webp)|video\/mp4)$/.test(mimeType)) throw new Error("Định dạng media chưa hỗ trợ trong Chat.");
        const reader = response.body?.getReader(); if (!reader) throw new Error("Trình duyệt chưa hỗ trợ tải media giới hạn dung lượng.");
        const chunks = []; let bytes = 0;
        for (;;) { const { value, done } = await reader.read(); if (done) break; bytes += value.byteLength;
          if (bytes > 40 * 1024 * 1024) { await reader.cancel(); throw new Error("Media vượt giới hạn 40 MB của Chat; dùng Studio để tải."); } chunks.push(value); }
        return new Blob(chunks, { type: mimeType });
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(text(data.error || `Máy chủ media trả mã ${response.status}.`, 400));
      return data;
    }
    async function loadCapabilities() {
      const [image, video] = await Promise.allSettled([request("/api/modules/chat-ai/actions?mediaAction=capabilities"), request("/api/ai-video-remake?action=capabilities")]);
      if (!active()) return;
      state.image = image.status === "fulfilled" ? image.value.image : null;
      state.video = video.status === "fulfilled" ? video.value.capabilities : null;
      state.checking = false; hooks.controls();
    }
    function invalidate() { state.revision++; state.review = null; hooks.controls(); }
    async function prepare(prompt, kind, attachments) {
      const revision = ++state.revision;
      if (runtime.busy) throw new Error("Đợi yêu cầu hiện tại hoàn tất rồi tạo media.");
      if (runtime.incognito) throw new Error("Tạo media lưu tác vụ ở máy chủ. Hãy tắt Phiên riêng tư trước khi tạo.");
      if (!text(prompt)) throw new Error("Hãy nhập mô tả ảnh/video muốn tạo.");
      if (state.checking) await loadCapabilities();
      if (kind === "image" && (!state.image?.configured || !state.image?.canCreate)) throw new Error(state.image?.message || "Chưa kết nối được dịch vụ tạo ảnh.");
      if (kind === "video" && (!state.video?.modes?.["text-to-video"]?.supported || !state.video?.billing?.canCreate)) throw new Error(state.video?.billing?.reason || "Chưa cấu hình tạo video từ mô tả.");
      if (kind === "video" && attachments.length) throw new Error("Chat hiện tạo video từ mô tả; không tự gửi hoặc bỏ qua ảnh/video đính kèm. Dùng AI Video Remake Studio cho remix.");
      if (kind === "image" && (attachments.length > 2 || attachments.some((file) => !["image/png", "image/jpeg", "image/webp"].includes(file.mimeType)))) throw new Error("Tạo ảnh chỉ nhận tối đa 2 ảnh PNG/JPEG/WebP.");
      const settings = normalizeSettings(runtime.state.mediaSettings);
      const finalPrompt = text(`${prompt}${STYLES[settings.style][1] ? `\nPhong cách: ${STYLES[settings.style][1]}` : ""}`);
      let quote = null;
      if (kind === "video") {
        const data = await request("/api/ai-video-remake", { action: "estimate", ...videoRequest(finalPrompt, settings) });
        if (!data.supported || !data.quote?.id) throw new Error(data.message || "Máy chủ chưa cấp báo giá hợp lệ; chưa tạo video.");
        quote = data;
      }
      if (!active() || revision !== state.revision) return;
      state.review = { kind, prompt: finalPrompt, settings, attachments: attachments.slice(), quote,
        costLabel: quote?.estimate?.pricingConfigured ? `Ước tính ${quote.estimate.amount} ${quote.estimate.currency}. ${quote.estimate.disclaimer || ""}`
          : "Có thể tính phí API. Máy chủ chưa có đơn giá xác nhận; không coi tác vụ là miễn phí." };
      hooks.render();
      runtime.host.querySelector("[data-chat-media-cost]")?.focus();
    }
    function applyJob(message, job) {
      const media = message.media;
      media.jobId = /^[a-f0-9]{24}$/i.test(job.id || "") ? job.id : media.jobId;
      media.status = Object.hasOwn(STATUS, job.status) ? job.status : "submission-unknown";
      media.error = text(typeof job.error === "object" ? job.error?.message : job.error, 500);
      media.model = text(job.model || job.provider?.model, 120); media.expiresAt = text(job.expiresAt, 40);
      message.loading = false; message.text = media.status === "completed" ? `${media.kind === "image" ? "Ảnh" : "Video"} đã tạo xong. Chọn xem hoặc tải kết quả bên dưới.` : "Tác vụ media được lưu ở máy chủ; trạng thái dưới đây đến từ backend.";
      hooks.write(); if (active()) hooks.message(message);
    }
    async function confirm() {
      const review = state.review;
      if (!review || runtime.busy) return;
      if (!runtime.host.querySelector("[data-chat-media-cost]")?.checked || !runtime.host.querySelector("[data-chat-media-rights]")?.checked) throw new Error("Hãy xác nhận chi phí và quyền sử dụng nội dung trước khi tạo.");
      if (review.quote && Date.parse(review.quote.quote.expiresAt) <= Date.now()) { invalidate(); throw new Error("Báo giá đã hết hạn; bấm Gửi để lấy báo giá mới."); }
      const session = hooks.session(), key = `media-${scope.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
      const message = { id: `assistant-${key}`, role: "assistant", mode: review.kind, createdAt: new Date().toISOString(), text: "Đang gửi yêu cầu tạo media đã xác nhận…",
        media: normalizeMedia({ kind: review.kind, requestKey: key, prompt: review.prompt, settings: review.settings, status: "submitting", quoteId: review.quote?.quote?.id }) };
      session.messages.push({ id: `user-${key}`, role: "user", mode: review.kind, text: review.prompt, createdAt: message.createdAt }, message);
      session.messages = session.messages.slice(-80); session.updatedAt = message.createdAt;
      if (session.title === "Cuộc trò chuyện mới") session.title = review.prompt.slice(0, 58);
      runtime.state.draft = ""; runtime.pending = []; runtime.busy = true; runtime.controller = new AbortController(); state.review = null; hooks.write(); hooks.render();
      try {
        const result = review.kind === "image" ? await request("/api/modules/chat-ai/actions?mediaAction=image-create", {
          input: review.prompt, aspectRatio: review.settings.aspectRatio, imageSize: review.settings.imageSize,
          referenceImages: review.attachments.map(({ mimeType, data }) => ({ mimeType, data })), acceptedCost: true, rightsAttested: true, idempotencyKey: key })
          : await request("/api/ai-video-remake", { action: "create-job", ...videoRequest(review.prompt, review.settings), quoteId: review.quote.quote.id, acceptedEstimate: true, idempotencyKey: key });
        applyJob(message, result.job);
      } catch (error) {
        message.media.status = "submission-unknown"; message.media.error = text(error.message, 400);
        message.text = "Chưa xác nhận được lần gửi. Không tự tạo lại để tránh phí trùng. Kiểm tra kết quả hoặc chủ động tiếp tục cùng mã yêu cầu."; hooks.write();
      } finally { runtime.busy = false; runtime.controller = null; if (active()) { hooks.message(message); hooks.busy(); } }
    }
    function messages() { return runtime.state.sessions.flatMap((session) => session.messages).filter((message) => message.media); }
    async function check(message, manual = false) {
      if (!message?.media || state.checkingJobs.has(message.id)) return;
      const media = message.media, path = jobPath(media);
      if (!path && !manual) return;
      state.checkingJobs.add(message.id);
      try {
        let result;
        if (!path && media.kind === "video" && media.quoteId && manual) {
          // Replay same quoted/idempotent submission, never a fresh paid attempt.
          result = await request("/api/ai-video-remake", { action: "create-job", ...videoRequest(media.prompt, media.settings), quoteId: media.quoteId, acceptedEstimate: true, idempotencyKey: media.requestKey });
        } else if (path) result = await request(path);
        else throw new Error("Không có mã tác vụ. Chỉnh prompt và xác nhận một yêu cầu mới nếu muốn tiếp tục.");
        if (active()) applyJob(message, result.job);
      } catch (error) { if (manual && active()) hooks.toast(error.message, "warning"); }
      finally { state.checkingJobs.delete(message.id); }
    }
    async function show(message, download = false) {
      const media = message.media;
      if (media.status !== "completed" || !media.jobId) throw new Error("Media chưa hoàn tất.");
      let result = state.urls.get(message.id);
      if (!result) {
        if (state.fetching.has(message.id)) return;
        state.fetching.add(message.id);
        try { const blob = await request(jobPath(media, true), null, true); if (!active()) return;
          result = { url: URL.createObjectURL(blob), mimeType: blob.type }; state.urls.set(message.id, result);
        } finally { state.fetching.delete(message.id); }
      }
      const url = result.url;
      if (download) {
        const extension = result.mimeType === "image/jpeg" ? "jpg" : result.mimeType.split("/")[1];
        const link = scope.document.createElement("a"); link.href = url; link.download = `hh-ai-${media.jobId}.${extension}`; link.click(); return;
      }
      const host = runtime.host.querySelector(`[data-chat-media-preview="${CSS.escape(message.id)}"]`);
      if (host) host.innerHTML = media.kind === "image" ? `<img src="${url}" alt="Ảnh AI: ${esc(media.prompt.slice(0, 160))}">` : `<video src="${url}" controls playsinline preload="metadata"></video>`;
    }
    async function click(button) {
      if (button.hasAttribute("data-chat-media-confirm")) { await confirm(); return true; }
      if (button.hasAttribute("data-chat-media-dismiss")) { invalidate(); return true; }
      for (const action of ["view", "download", "check", "use", "cancel"]) {
        const id = button.getAttribute(`data-chat-media-${action}`); if (!id) continue;
        const message = messages().find((item) => item.id === id); if (!message) return true;
        if (action === "view" || action === "download") await show(message, action === "download");
        if (action === "check") await check(message, true);
        if (action === "cancel") applyJob(message, (await request("/api/ai-video-remake", { action: "cancel", id: message.media.jobId })).job);
        if (action === "use") { runtime.state.mode = message.media.kind; runtime.state.draft = message.media.prompt; runtime.state.mediaSettings = { ...message.media.settings, style: "custom" }; invalidate(); hooks.write(); hooks.render(); runtime.host.querySelector("[data-chat-ai-input]")?.focus(); }
        return true;
      }
      return false;
    }
    function poll() {
      if (!active()) return;
      if (!scope.document.hidden) {
        const visible = hooks.session().messages.filter((message) => ACTIVE.has(message.media?.status)).slice(-3);
        void Promise.allSettled(visible.map((message) => check(message)));
      }
      state.timer = scope.setTimeout(poll, 20000);
    }
    function dispose() { state.disposed = true; clearTimeout(state.timer); for (const result of state.urls.values()) URL.revokeObjectURL(result.url); state.urls.clear(); }
    Object.assign(state, { prepare, click, invalidate, dispose, loadCapabilities });
    void loadCapabilities(); state.timer = scope.setTimeout(poll, 20000);
    return state;
  }
  return Object.freeze({ STYLES, RATIOS, STATUS, normalizeSettings, normalizeMedia, videoRequest, jobPath, controls, messageMarkup, create });
});
