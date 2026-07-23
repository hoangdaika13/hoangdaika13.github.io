"use strict";

const { ObjectId } = require("mongodb");
const { clean, currentUser, withApi } = require("../utils/platform");
const { ensureIndexes } = require("../services/toolGateway");

const MAX_TEXT_BYTES = 48 * 1024;

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để dùng kho file Tool.", code: "AUTH_REQUIRED" });
    await ensureIndexes(db);
    const files = db.collection("toolFiles");
    const id = clean(req.query?.id || body.id, 80);
    if (req.method === "GET") {
      const rows = await files.find({ userId: user._id }, { projection: { content: 0 } }).sort({ updatedAt: -1 }).limit(100).toArray();
      return res.status(200).json({ files: rows.map((row) => ({ id: String(row._id), name: row.name, mimeType: row.mimeType, size: row.size, createdAt: row.createdAt, updatedAt: row.updatedAt })), limits: { textBytes: MAX_TEXT_BYTES, binaryUpload: false, opfsRecommended: true } });
    }
    if (req.method === "POST") {
      const content = String(body.content || "");
      if (Buffer.byteLength(content, "utf8") > MAX_TEXT_BYTES) return res.status(413).json({ error: "File vượt giới hạn gateway. Hãy lưu file lớn bằng OPFS/object storage.", code: "FILE_TOO_LARGE" });
      const now = new Date();
      const doc = { userId: user._id, name: clean(body.name || "untitled.txt", 180), mimeType: clean(body.mimeType || "text/plain", 100), size: Buffer.byteLength(content, "utf8"), content, createdAt: now, updatedAt: now };
      const result = await files.insertOne(doc);
      return res.status(201).json({ ok: true, file: { id: String(result.insertedId), name: doc.name, mimeType: doc.mimeType, size: doc.size, createdAt: now, updatedAt: now } });
    }
    if (req.method === "DELETE") {
      if (!/^[a-f0-9]{24}$/i.test(id)) return res.status(400).json({ error: "File ID không hợp lệ.", code: "FILE_ID_INVALID" });
      const result = await files.deleteOne({ _id: new ObjectId(id), userId: user._id });
      return result.deletedCount ? res.status(200).json({ ok: true }) : res.status(404).json({ error: "Không tìm thấy file.", code: "FILE_NOT_FOUND" });
    }
    return res.status(405).json({ error: "Method not allowed" });
  });
};
