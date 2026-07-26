const { Readable } = require("stream");
const { pipeline } = require("stream/promises");
const { del, get, put } = require("@vercel/blob");
const { ObjectId } = require("mongodb");
const { clean, currentUser, ownerFrom, withApi } = require("../../utils/platform");

const MAX_MONGODB_TEXT_BYTES = 48 * 1024;
const MAX_SERVER_UPLOAD_BYTES = 3 * 1024 * 1024;

function blobConfigured() {
  return Boolean(String(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN || "").trim());
}

function capabilities() {
  const objectStorage = blobConfigured();
  return {
    metadata: true,
    smallTextPayload: true,
    largeBinaryFiles: objectStorage,
    objectStorage,
    provider: objectStorage ? "vercel-blob-private" : "mongodb",
    maxServerUploadBytes: objectStorage ? MAX_SERVER_UPLOAD_BYTES : MAX_MONGODB_TEXT_BYTES,
    message: objectStorage
      ? "Vercel Blob riêng tư đã sẵn sàng. Tệp được phục vụ qua API có xác thực."
      : "Tệp lớn cần kết nối Vercel Blob."
  };
}

function safeFilename(value) {
  const filename = clean(value || "untitled.bin", 180)
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return filename || "untitled.bin";
}

function decodePayload(body) {
  if (clean(body.encoding, 24).toLowerCase() === "base64") {
    const encoded = String(body.data || "").replace(/\s+/g, "");
    if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
      const error = new Error("Dữ liệu base64 không hợp lệ.");
      error.statusCode = 400;
      error.code = "FILE_DATA_INVALID";
      throw error;
    }
    return Buffer.from(encoded, "base64");
  }
  return Buffer.from(String(body.content || ""), "utf8");
}

function fileResponse(row) {
  const id = String(row._id);
  return {
    id,
    name: row.name,
    mimeType: row.mimeType,
    size: row.size,
    storageProvider: row.storageProvider || "mongodb",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt || row.createdAt,
    downloadUrl: row.pathname ? `/api/storage/files?id=${encodeURIComponent(id)}&download=1` : ""
  };
}

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    const collection = db.collection("storageFiles");
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để sử dụng Cloud Storage." });

    const id = clean(req.query?.id || body.id, 80);
    if (req.method === "GET" && id && req.query?.download === "1") {
      if (!ObjectId.isValid(id)) return res.status(400).json({ error: "File ID không hợp lệ." });
      const row = await collection.findOne({ _id: new ObjectId(id), userId: user._id });
      if (!row) return res.status(404).json({ error: "Không tìm thấy file." });

      if (!row.pathname) {
        res.setHeader("Content-Type", row.mimeType || "text/plain; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${safeFilename(row.name)}"`);
        return res.status(200).send(row.content || "");
      }

      const result = await get(row.pathname, { access: "private" });
      if (!result || result.statusCode !== 200 || !result.stream) {
        return res.status(404).json({ error: "Không tìm thấy dữ liệu Blob." });
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", result.blob.contentType || row.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename(row.name)}"`);
      res.setHeader("Cache-Control", "private, no-store");
      if (result.blob.etag) res.setHeader("ETag", result.blob.etag);
      await pipeline(Readable.fromWeb(result.stream), res);
      return;
    }

    if (req.method === "GET") {
      const rows = await collection
        .find({ userId: user._id }, { projection: { content: 0, blobUrl: 0 } })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      return res.status(200).json({ files: rows.map(fileResponse), capabilities: capabilities() });
    }

    if (req.method === "POST") {
      const now = new Date();
      const name = safeFilename(body.name);
      const mimeType = clean(body.mimeType || "application/octet-stream", 120);
      const payload = decodePayload(body);
      const limit = blobConfigured() ? MAX_SERVER_UPLOAD_BYTES : MAX_MONGODB_TEXT_BYTES;
      if (payload.byteLength > limit) {
        return res.status(413).json({
          error: `File vượt giới hạn ${(limit / 1024 / 1024).toFixed(limit >= 1024 * 1024 ? 0 : 2)} MB.`,
          code: "FILE_TOO_LARGE"
        });
      }

      const doc = {
        name,
        mimeType,
        size: payload.byteLength,
        ...ownerFrom(user, body),
        createdAt: now,
        updatedAt: now
      };

      if (blobConfigured()) {
        const blob = await put(`users/${String(user._id)}/${Date.now()}-${name}`, payload, {
          access: "private",
          addRandomSuffix: true,
          contentType: mimeType
        });
        Object.assign(doc, {
          storageProvider: "vercel-blob-private",
          pathname: blob.pathname,
          blobUrl: blob.url,
          etag: blob.etag || ""
        });
      } else {
        Object.assign(doc, {
          storageProvider: "mongodb",
          content: payload.toString("utf8")
        });
      }

      const result = await collection.insertOne(doc);
      return res.status(201).json({
        ok: true,
        file: fileResponse({ ...doc, _id: result.insertedId }),
        capabilities: capabilities()
      });
    }

    if (req.method === "DELETE") {
      if (!ObjectId.isValid(id)) return res.status(400).json({ error: "File ID không hợp lệ." });
      const row = await collection.findOne({ _id: new ObjectId(id), userId: user._id });
      if (!row) return res.status(404).json({ error: "Không tìm thấy file." });
      if (row.pathname && blobConfigured()) await del(row.pathname);
      await collection.deleteOne({ _id: row._id, userId: user._id });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  });
};
