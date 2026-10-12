"use strict";
const { createHash } = require("node:crypto");
const { ObjectId } = require("mongodb");
const { clean, currentUser, enforceRateLimit, isAdminUser, withApi } = require("./platform");
const RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"];
const COLLECTION = "chatAIImages";
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
function fail(message, statusCode = 400, code = "CHAT_MEDIA_INVALID") { return Object.assign(new Error(message), { statusCode, code }); }
function digest(value) { return createHash("sha256").update(value).digest("hex"); }
function normalizeInput(body = {}) {
  const prompt = clean(body.input, 5000);
  if (!prompt) throw fail("Hãy mô tả ảnh muốn tạo.");
  if (!RATIOS.includes(body.aspectRatio) || !["1K", "2K"].includes(body.imageSize)) throw fail("Tỉ lệ hoặc kích thước ảnh chưa được hỗ trợ.");
  const references = Array.isArray(body.referenceImages) ? body.referenceImages : [];
  if (references.length > 2) throw fail("Tối đa hai ảnh tham chiếu.");
  const referenceImages = references.map((image) => {
    const mimeType = String(image?.mimeType || "");
    const data = String(image?.data || "");
    if (!["image/png", "image/jpeg", "image/webp"].includes(mimeType) || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)
      || data.length > 2_100_000 || data.length % 4 !== 0) throw fail("Ảnh tham chiếu phải là PNG/JPEG/WebP, tối đa 1,55 MB.");
    try { imageBytes({ mimeType, data }); } catch { throw fail("Ảnh tham chiếu không khớp định dạng PNG/JPEG/WebP."); }
    return { mimeType, data };
  });
  if (referenceImages.length && body.rightsAttested !== true) throw fail("Cần xác nhận quyền sử dụng ảnh tham chiếu.");
  return { input: prompt, aspectRatio: body.aspectRatio, imageSize: body.imageSize, referenceImages };
}
function publicJob(row) {
  return { id: String(row._id), kind: "image", status: row.status, model: row.model || "", prompt: row.prompt,
    aspectRatio: row.aspectRatio, expiresAt: row.expiresAt, output: { ready: row.status === "completed" },
    error: row.error || null, createdAt: row.createdAt };
}
function imageBytes(media) {
  if (!["image/png", "image/jpeg", "image/webp"].includes(media?.mimeType) || !/^[A-Za-z0-9+/]+={0,2}$/.test(media?.data || "")
    || media.data.length > 3_100_000) throw fail("Nhà cung cấp không trả về ảnh hợp lệ trong giới hạn dung lượng.", 502);
  const buffer = Buffer.from(media.data, "base64");
  const valid = media.mimeType === "image/png" ? buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : media.mimeType === "image/jpeg" ? buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
      : buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
  if (!valid) throw fail("Dữ liệu kết quả không khớp định dạng ảnh.", 502);
  return buffer;
}
function createHandler({ generateImage, providerStatus }) {
  return (req, res) => withApi(req, res, async ({ db, body }) => {
    const user = await currentUser(req), action = String(req.query.mediaAction || "");
    if (action === "capabilities" && req.method === "GET") {
      const status = providerStatus(user);
      return res.status(200).json({ image: { configured: status.providers.image.configured,
        canCreate: Boolean(user && isAdminUser(user)), model: status.providers.image.model,
        aspectRatios: RATIOS, imageSizes: ["1K", "2K"], maxReferences: 2, retentionDays: 7,
        message: !user ? "Đăng nhập để tạo media." : !isAdminUser(user) ? "Tạo ảnh có tính phí hiện chỉ mở cho tài khoản quản trị theo quyền máy chủ." : "Cần xác nhận chi phí API trước mỗi yêu cầu; chưa có đơn giá ảnh trên máy chủ." } });
    }
    if (!user?._id) throw fail("Bạn cần đăng nhập để tạo hoặc mở media.", 401, "AUTH_REQUIRED");
    const jobs = db.collection(COLLECTION);
    await jobs.createIndex({ userId: 1, idempotencyHash: 1 }, { unique: true });
    await jobs.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    if (["image-status", "image-download"].includes(action) && req.method === "GET") {
      await enforceRateLimit(db, `chat-image-read:${user._id}`, 120, 60_000);
      const id = String(req.query.id || "");
      const key = clean(req.query.requestKey, 180);
      if ((id && !/^[a-f0-9]{24}$/i.test(id)) || (!id && !/^[a-z0-9_-]{8,180}$/i.test(key)) || action === "image-download" && !id) throw fail("Mã media không hợp lệ.");
      const query = { userId: user._id, expiresAt: { $gt: new Date() }, ...(id ? { _id: new ObjectId(id) } : { idempotencyHash: digest(`${user._id}:${key}`) }) };
      const row = await jobs.findOne(query);
      if (!row) throw fail("Không tìm thấy media của tài khoản này hoặc ảnh đã hết hạn lưu.", 404, "MEDIA_NOT_FOUND");
      if (action === "image-status") return res.status(200).json({ job: publicJob(row) });
      if (row.status !== "completed") throw fail("Ảnh chưa sẵn sàng tải.", 409);
      const bytes = imageBytes(row.output);
      res.setHeader("Content-Type", row.output.mimeType); res.setHeader("Content-Length", bytes.length);
      res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Disposition", `inline; filename="hh-ai-${String(row._id)}.${row.output.mimeType === "image/jpeg" ? "jpg" : row.output.mimeType.split("/")[1]}"`);
      return res.status(200).end(bytes);
    }
    if (action !== "image-create" || req.method !== "POST") throw fail("Tác vụ media không được hỗ trợ.", 405);
    if (!isAdminUser(user)) throw fail("Tạo ảnh có tính phí chưa được máy chủ cho phép cho tài khoản này.", 403, "MEDIA_ACCESS_DENIED");
    if (!providerStatus(user).providers.image.configured) throw fail("Dịch vụ tạo ảnh chưa được cấu hình.", 503, "MEDIA_NOT_CONFIGURED");
    if (body.acceptedCost !== true) throw fail("Bạn chưa xác nhận chi phí API cho yêu cầu này.", 400, "COST_CONFIRMATION_REQUIRED");
    const input = normalizeInput(body), key = clean(body.idempotencyKey, 180);
    if (!/^[a-z0-9_-]{8,180}$/i.test(key)) throw fail("Thiếu mã chống tạo ảnh trùng.");
    const hash = digest(`${user._id}:${key}`), inputHash = digest(JSON.stringify(input));
    const replay = await jobs.findOne({ userId: user._id, idempotencyHash: hash });
    if (replay) {
      if (replay.inputHash !== inputHash) throw fail("Mã yêu cầu đã dùng cho nội dung khác.", 409);
      return res.status(200).json({ job: publicJob(replay), idempotentReplay: true });
    }
    // Retain the existing paid-image hourly ceiling, not a new unlimited quota.
    await enforceRateLimit(db, `music-media:${user._id}`, 12, 60 * 60 * 1000);
    const now = new Date(), row = { userId: user._id, idempotencyHash: hash, inputHash, prompt: input.input,
      aspectRatio: input.aspectRatio, status: "running", createdAt: now, expiresAt: new Date(now.getTime() + RETENTION_MS) };
    try { row._id = (await jobs.insertOne(row)).insertedId; }
    catch (error) {
      if (error.code !== 11000) throw error;
      const existing = await jobs.findOne({ userId: user._id, idempotencyHash: hash });
      if (!existing || existing.inputHash !== inputHash) throw fail("Yêu cầu trùng có nội dung khác.", 409);
      return res.status(200).json({ job: publicJob(existing), idempotentReplay: true });
    }
    try {
      const generated = await generateImage({ input: input.input, meta: { aspectRatio: input.aspectRatio,
        imageSize: input.imageSize, referenceImages: input.referenceImages } }, { singleAttempt: true });
      imageBytes(generated.media);
      Object.assign(row, { status: "completed", model: clean(generated.media.model, 120), output: { mimeType: generated.media.mimeType, data: generated.media.data } });
      await jobs.updateOne({ _id: row._id, userId: user._id }, { $set: { status: row.status, model: row.model, output: row.output } });
    } catch {
      // No silent retries: provider may have accepted/billed even after timeout.
      row.status = "submission-unknown";
      row.error = "Chưa xác nhận được kết quả từ nhà cung cấp. Không tự gửi lại để tránh tính phí trùng; kiểm tra yêu cầu hoặc chủ động tạo bản mới.";
      await jobs.updateOne({ _id: row._id, userId: user._id }, { $set: { status: row.status, error: row.error } });
    }
    return res.status(200).json({ job: publicJob(row) });
  });
}
module.exports = { RATIOS, normalizeInput, publicJob, imageBytes, createHandler };
