(function tiktokCreatorPublishing(global) {
  "use strict";

  const api = (path, options = {}) => global.HHTikTokCreatorConnections.request(path, options);
  const PRIVACY_LEVELS = Object.freeze([
    { id: "SELF_ONLY", label: "Chỉ mình tôi" },
    { id: "MUTUAL_FOLLOW_FRIENDS", label: "Bạn bè theo dõi lẫn nhau" },
    { id: "FOLLOWER_OF_CREATOR", label: "Người theo dõi" },
    { id: "PUBLIC_TO_EVERYONE", label: "Mọi người" }
  ]);
  const TERMINAL_STATUSES = Object.freeze(new Set(["publish_complete", "send_to_user_inbox", "publicly_available", "failed"]));
  const sleep = (milliseconds, signal) => new Promise((resolve, reject) => {
    const timer = global.setTimeout(resolve, milliseconds);
    if (signal) signal.addEventListener("abort", () => { global.clearTimeout(timer); reject(new DOMException("Đã hủy upload.", "AbortError")); }, { once: true });
  });
  const retryable = (status) => status === 408 || status === 425 || status === 429 || status >= 500;
  const backoff = (attempt, base = 700) => Math.min(12000, base * (2 ** attempt)) + Math.floor(Math.random() * 450);

  function privacyLabel(id) { return PRIVACY_LEVELS.find((item) => item.id === id)?.label || id; }
  function normalizeCreator(data = {}) {
    const source = data.creator || data.data || data;
    const privacy = Array.isArray(source.privacy_level_options) ? source.privacy_level_options.filter((item) => PRIVACY_LEVELS.some((known) => known.id === item)) : [];
    return {
      nickname: String(source.creator_nickname || source.nickname || ""),
      avatarUrl: String(source.creator_avatar_url || source.avatar_url || ""),
      privacyOptions: privacy,
      commentDisabled: source.comment_disabled === true,
      duetDisabled: source.duet_disabled === true,
      stitchDisabled: source.stitch_disabled === true,
      maxDuration: Math.max(0, Number(source.max_video_post_duration_sec || source.max_duration || 0)),
      fetchedAt: new Date().toISOString()
    };
  }
  async function creatorInfo(connectionId) {
    if (!connectionId) throw new Error("Chưa chọn tài khoản TikTok.");
    return normalizeCreator(await api("creator-info", { method: "GET", query: { connectionId } }));
  }
  function validate(payload, status = {}, creator = null, file = null) {
    const errors = [];
    const direct = payload.mode !== "draft";
    if (!payload.connectionId) errors.push("Chưa chọn tài khoản đích.");
    if (!payload.previewed) errors.push("Phải xem preview trước khi truyền dữ liệu.");
    if (direct && !payload.privacyLevel) errors.push("Bạn phải tự chọn quyền riêng tư.");
    if (direct && !status.audited && payload.privacyLevel && payload.privacyLevel !== "SELF_ONLY") errors.push("Ứng dụng chưa audit chỉ được đăng SELF_ONLY.");
    if (direct && creator?.privacyOptions?.length && payload.privacyLevel && !creator.privacyOptions.includes(payload.privacyLevel)) errors.push("Quyền riêng tư không nằm trong Creator Info mới nhất.");
    if (!payload.musicConfirmed) errors.push("Chưa xác nhận quyền sử dụng âm nhạc.");
    if (!payload.confirmed) errors.push("Chưa đồng ý truyền nội dung tới TikTok.");
    if (direct && payload.commercialContent && !payload.ownBrand && !payload.brandedContent) errors.push("Nội dung thương mại phải chọn Thương hiệu của tôi, Nội dung tài trợ hoặc cả hai.");
    if (direct && payload.brandedContent && payload.privacyLevel === "SELF_ONLY") errors.push("Nội dung tài trợ không được đặt quyền riêng tư Chỉ mình tôi.");
    ["commentEnabled", "duetEnabled", "stitchEnabled"].forEach((field) => {
      if (payload[field] !== true && payload[field] !== false) errors.push(`${field} phải là lựa chọn boolean rõ ràng.`);
    });
    if (direct && creator?.commentDisabled && payload.commentEnabled) errors.push("Creator Info hiện không cho phép bình luận.");
    if (direct && creator?.duetDisabled && payload.duetEnabled) errors.push("Creator Info hiện không cho phép Duet.");
    if (direct && creator?.stitchDisabled && payload.stitchEnabled) errors.push("Creator Info hiện không cho phép Stitch.");
    if (file) {
      if (!file.size || file.size > 4 * 1024 ** 3) errors.push("Video phải lớn hơn 0 B và không quá 4 GB.");
      if (!["video/mp4", "video/quicktime", "video/webm"].includes(file.type)) errors.push("Chỉ hỗ trợ MP4, MOV hoặc WebM được TikTok chấp nhận.");
      if (creator?.maxDuration && Number(payload.duration || 0) > creator.maxDuration) errors.push(`Video vượt thời lượng tối đa ${creator.maxDuration} giây của tài khoản.`);
    }
    return errors;
  }
  function prepare(payload, status = {}, creator = null, file = null) {
    const errors = validate(payload, status, creator, file); if (errors.length) throw new Error(errors.join(" "));
    return api("publish/prepare", { method: "POST", body: { ...payload, idempotencyKey: payload.idempotencyKey || (global.crypto?.randomUUID?.() || `tiktok-${Date.now()}`) } });
  }
  async function initialize(jobId, file, durationSeconds, chunkSize = 16 * 1024 ** 2) {
    if (!jobId || !(file instanceof Blob) || !file.size) throw new Error("Tác vụ hoặc video upload không hợp lệ.");
    const result = await api("publish/init", { method: "POST", body: { jobId, videoSize: file.size, chunkSize, mimeType: file.type, durationSeconds: Number(durationSeconds || 0) } });
    if (!/^https:\/\/[^/]*tiktokapis\.com\//i.test(result.uploadUrl || "")) throw new Error("Upload URL không thuộc TikTok allowlist.");
    if (Array.isArray(result.allowedMime) && !result.allowedMime.includes(file.type)) throw new Error("MIME của video không được gateway TikTok cho phép.");
    return result;
  }
  async function putChunk(uploadUrl, blob, start, total, options = {}) {
    const end = start + blob.size - 1; const attempts = Math.max(1, Number(options.maxAttempts || 5));
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      let responseStatus = 0;
      try {
        // Browsers calculate Content-Length from Blob; setting it manually is forbidden.
        const response = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": options.mime || "video/mp4", "Content-Range": `bytes ${start}-${end}/${total}` }, body: blob, signal: options.signal });
        if (response.ok) return response;
        responseStatus = response.status;
        if (!retryable(response.status) || attempt === attempts - 1) throw new Error(`TikTok upload HTTP ${response.status}.`);
      } catch (error) {
        if (error?.name === "AbortError" || attempt === attempts - 1 || (responseStatus && !retryable(responseStatus))) throw error;
      }
      const wait = backoff(attempt); options.onRetry?.({ attempt: attempt + 1, wait, start, end }); await sleep(wait, options.signal);
    }
    throw new Error("Upload chunk thất bại sau nhiều lần thử.");
  }
  async function upload(file, initialized, options = {}) {
    const total = file.size; const declaredCount = Math.max(1, Number(initialized.totalChunkCount || 1)); const declaredSize = Math.max(1, Number(initialized.chunkSize || total)); let uploaded = 0;
    for (let index = 0; index < declaredCount; index += 1) {
      if (options.signal?.aborted) throw new DOMException("Đã hủy upload.", "AbortError");
      const start = uploaded;
      // TikTok requires the final declared chunk to contain every remaining byte,
      // including a remainder larger than the nominal chunk size.
      const endExclusive = index === declaredCount - 1 ? total : Math.min(total, start + declaredSize);
      const blob = file.slice(start, endExclusive, file.type || "video/mp4");
      if (!blob.size) break;
      await putChunk(initialized.uploadUrl, blob, start, total, { mime: file.type || "video/mp4", signal: options.signal, maxAttempts: options.maxAttempts, onRetry: options.onRetry });
      uploaded = endExclusive; options.onProgress?.({ uploaded, total, percent: Math.min(99, Math.round(uploaded / total * 99)), chunk: index + 1, chunks: declaredCount });
    }
    if (uploaded !== total) throw new Error(`Upload thiếu byte (${uploaded}/${total}).`);
    return { uploaded, total, publishId: initialized.publishId };
  }
  function publishStatus(jobId) { if (!jobId) throw new Error("Tác vụ không hợp lệ."); return api("publish/status", { method: "GET", query: { jobId } }); }
  function reportProgress(jobId, progress, checkpoint = "uploading") { return api("publish/progress", { method: "POST", body: { jobId, progress, checkpoint } }); }
  async function poll(jobId, options = {}) {
    const interval = Math.max(2500, Number(options.interval || 5000)); const maxAttempts = Math.max(1, Number(options.maxAttempts || 60)); let last = null;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (options.signal?.aborted) throw new DOMException("Đã dừng theo dõi.", "AbortError");
      try { last = await publishStatus(jobId); options.onStatus?.(last); const value = String(last.job?.status || "").toLowerCase(); if (TERMINAL_STATUSES.has(value) || value.includes("fail")) return last; }
      catch (error) { if (error?.status && error.status !== 429 && error.status < 500) throw error; options.onRetry?.({ attempt: attempt + 1, wait: backoff(attempt, interval) }); }
      await sleep(interval + Math.floor(Math.random() * 400), options.signal);
    }
    return last;
  }
  async function uploadJob(jobId, file, options = {}) {
    const initialized = await initialize(jobId, file, options.duration, options.chunkSize); options.onInitialized?.(initialized);
    await upload(file, initialized, options);
    options.onProgress?.({ uploaded: file.size, total: file.size, percent: 99, chunk: initialized.totalChunkCount, chunks: initialized.totalChunkCount });
    await reportProgress(jobId, 99, "uploaded").catch(() => {});
    // TikTok may need a short propagation window before status/fetch recognizes publish_id.
    await sleep(1500, options.signal);
    return poll(jobId, options);
  }
  function control(jobId, control) { if (!jobId || !["pause", "resume", "retry"].includes(control)) throw new Error("Điều khiển tác vụ không hợp lệ."); return api("publish/control", { method: "POST", body: { jobId, control } }); }
  function saveProject(project) { return api("project/save", { method: "POST", body: project }); }

  const uploadChunks = upload;
  const pollStatus = poll;
  global.HHTikTokCreatorPublishing = Object.freeze({ PRIVACY_LEVELS, TERMINAL_STATUSES, privacyLabel, normalizeCreator, creatorInfo, validate, prepare, initialize, putChunk, upload, uploadChunks, publishStatus, reportProgress, poll, pollStatus, uploadJob, control, saveProject });
})(window);
