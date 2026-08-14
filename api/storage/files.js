const { Readable } = require("stream");
const { pipeline } = require("stream/promises");
const { del, get, put } = require("@vercel/blob");
const { ObjectId } = require("mongodb");
const { clean, currentUser, ownerFrom, withApi } = require("../../utils/platform");

const MAX_MONGODB_TEXT_BYTES = 48 * 1024;
const MAX_SERVER_UPLOAD_BYTES = 3 * 1024 * 1024;
const ACTIVE_MIME_TYPES = new Set([
  "image/svg+xml", "text/html", "application/xhtml+xml", "application/xml", "text/xml",
  "text/javascript", "application/javascript", "application/x-httpd-php",
  "application/x-msdownload", "application/x-msdos-program", "application/x-sh"
]);
const ACTIVE_EXTENSIONS = new Set(["svg", "svgz", "html", "htm", "xhtml", "xml", "js", "mjs", "cjs", "php", "exe", "dll", "com", "bat", "cmd", "ps1", "sh", "msi", "scr", "jar"]);
const MIME_EXTENSIONS = Object.freeze({
  "text/plain": ["txt", "md", "srt"],
  "text/markdown": ["md"],
  "text/csv": ["csv"],
  "text/vtt": ["vtt"],
  "application/json": ["json"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/gif": ["gif"],
  "image/webp": ["webp"],
  "image/avif": ["avif"],
  "audio/mpeg": ["mp3"],
  "audio/wav": ["wav"],
  "audio/ogg": ["ogg", "oga"],
  "audio/flac": ["flac"],
  "audio/mp4": ["m4a"],
  "video/mp4": ["mp4", "m4v"],
  "video/webm": ["webm"],
  "video/quicktime": ["mov"],
  "application/pdf": ["pdf"],
  "application/zip": ["zip"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"]
});

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

function uploadError(message, code = "FILE_TYPE_REJECTED", statusCode = 415) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function extensionOf(name) {
  const match = String(name || "").toLowerCase().match(/\.([a-z0-9]{1,12})$/);
  return match ? match[1] : "";
}

function startsWithBytes(payload, bytes) {
  return payload.length >= bytes.length && bytes.every((byte, index) => payload[index] === byte);
}

function ascii(payload, start, end) {
  return payload.subarray(start, end).toString("ascii");
}

function hasBinarySignature(mimeType, payload) {
  if (mimeType === "image/jpeg") return startsWithBytes(payload, [0xff, 0xd8, 0xff]);
  if (mimeType === "image/png") return startsWithBytes(payload, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mimeType === "image/gif") return ["GIF87a", "GIF89a"].includes(ascii(payload, 0, 6));
  if (mimeType === "image/webp") return ascii(payload, 0, 4) === "RIFF" && ascii(payload, 8, 12) === "WEBP";
  if (mimeType === "image/avif") return ascii(payload, 4, 8) === "ftyp" && /avif|avis/.test(ascii(payload, 8, 32));
  if (mimeType === "audio/mpeg") return ascii(payload, 0, 3) === "ID3" || (payload[0] === 0xff && (payload[1] & 0xe0) === 0xe0);
  if (mimeType === "audio/wav") return ascii(payload, 0, 4) === "RIFF" && ascii(payload, 8, 12) === "WAVE";
  if (mimeType === "audio/ogg") return ascii(payload, 0, 4) === "OggS";
  if (mimeType === "audio/flac") return ascii(payload, 0, 4) === "fLaC";
  if (["audio/mp4", "video/mp4", "video/quicktime"].includes(mimeType)) return ascii(payload, 4, 8) === "ftyp";
  if (mimeType === "video/webm") return startsWithBytes(payload, [0x1a, 0x45, 0xdf, 0xa3]);
  if (mimeType === "application/pdf") return ascii(payload, 0, 5) === "%PDF-";
  if (mimeType === "application/zip" || mimeType.includes("openxmlformats-officedocument")) {
    return startsWithBytes(payload, [0x50, 0x4b, 0x03, 0x04]) || startsWithBytes(payload, [0x50, 0x4b, 0x05, 0x06]);
  }
  return false;
}

function validateTextPayload(mimeType, payload) {
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(payload); }
  catch { throw uploadError("Tệp văn bản không phải UTF-8 hợp lệ.", "FILE_TEXT_INVALID", 400); }
  if (text.includes("\0")) throw uploadError("Tệp văn bản chứa dữ liệu nhị phân không hợp lệ.", "FILE_TEXT_INVALID", 400);
  if (mimeType === "application/json") {
    try { JSON.parse(text || "null"); }
    catch { throw uploadError("Tệp JSON không hợp lệ.", "FILE_JSON_INVALID", 400); }
  }
}

function validateUpload(name, declaredType, payload) {
  const mimeType = clean(declaredType, 120).split(";")[0].trim().toLowerCase();
  const extension = extensionOf(name);
  if (!mimeType || ACTIVE_MIME_TYPES.has(mimeType) || ACTIVE_EXTENSIONS.has(extension)) {
    throw uploadError("Định dạng chủ động hoặc có thể thực thi không được phép lưu trữ.");
  }
  const expectedExtensions = MIME_EXTENSIONS[mimeType];
  if (!expectedExtensions) throw uploadError("Định dạng tệp chưa nằm trong danh sách an toàn được hỗ trợ.");
  if (!extension || !expectedExtensions.includes(extension)) {
    throw uploadError("Phần mở rộng tệp không khớp với loại nội dung đã khai báo.", "FILE_EXTENSION_MISMATCH");
  }
  if (mimeType.startsWith("text/") || mimeType === "application/json") validateTextPayload(mimeType, payload);
  else if (!hasBinarySignature(mimeType, payload)) {
    throw uploadError("Chữ ký nội dung tệp không khớp với định dạng đã khai báo.", "FILE_SIGNATURE_MISMATCH");
  }
  return mimeType;
}

function safeStoredMime(value) {
  const mimeType = clean(value, 120).split(";")[0].trim().toLowerCase();
  return MIME_EXTENSIONS[mimeType] && !ACTIVE_MIME_TYPES.has(mimeType) ? mimeType : "application/octet-stream";
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
        res.setHeader("Content-Type", safeStoredMime(row.mimeType));
        res.setHeader("Content-Disposition", `attachment; filename="${safeFilename(row.name)}"`);
        res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
        res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
        res.setHeader("X-Download-Options", "noopen");
        return res.status(200).send(row.content || "");
      }

      const result = await get(row.pathname, { access: "private" });
      if (!result || result.statusCode !== 200 || !result.stream) {
        return res.status(404).json({ error: "Không tìm thấy dữ liệu Blob." });
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", safeStoredMime(row.mimeType || result.blob.contentType));
      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename(row.name)}"`);
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
      res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
      res.setHeader("X-Download-Options", "noopen");
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
      const payload = decodePayload(body);
      const mimeType = validateUpload(name, body.mimeType, payload);
      const limit = blobConfigured() ? MAX_SERVER_UPLOAD_BYTES : MAX_MONGODB_TEXT_BYTES;
      if (payload.byteLength > limit) {
        return res.status(413).json({
          error: `File vượt giới hạn ${(limit / 1024 / 1024).toFixed(limit >= 1024 * 1024 ? 0 : 2)} MB.`,
          code: "FILE_TOO_LARGE"
        });
      }
      if (!blobConfigured() && !mimeType.startsWith("text/") && mimeType !== "application/json") {
        return res.status(503).json({
          error: "Kho MongoDB dự phòng chỉ nhận tệp văn bản UTF-8. Hãy kết nối Vercel Blob để lưu media.",
          code: "OBJECT_STORAGE_REQUIRED"
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

module.exports.__test = Object.freeze({ safeStoredMime, validateUpload });
