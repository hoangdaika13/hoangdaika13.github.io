"use strict";

const { createHash, randomBytes } = require("node:crypto");
const { evaluateRights, sanitizeRights } = require("./comic-motion-rights");

const HANDOFF_SCHEMA_VERSION = 1;
const HANDOFF_TTL_MINUTES = Math.min(30, Math.max(10, Number(process.env.COMIC_MOTION_HANDOFF_TTL_MINUTES) || 20));
const MAX_HANDOFF_CHAPTERS = 100;
const indexedDatabases = new WeakSet();

function cleanText(value, max = 500) {
  return String(value ?? "").trim().replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").slice(0, max);
}

function safeHttps(value, max = 900) {
  const source = cleanText(value, max);
  if (!source) return "";
  try {
    const url = new URL(source);
    if (url.protocol !== "https:" || url.username || url.password) return "";
    url.hash = "";
    return url.href.slice(0, max);
  } catch { return ""; }
}

function safeId(value, fallback = "") {
  return cleanText(value, 180).replace(/[^a-zA-Z0-9:_.@/-]/g, "-").replace(/-{2,}/g, "-") || fallback;
}

function dateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sanitizeSeries(input = {}) {
  const series = input && typeof input === "object" ? input : {};
  const provider = safeId(series.provider || series.sourceType || "imported", "imported").toLowerCase();
  const id = safeId(series.id || series.seriesId, `series-${createHash("sha256").update(cleanText(series.title, 240)).digest("hex").slice(0, 16)}`);
  return {
    id,
    title: cleanText(series.title || "Truyện chưa đặt tên", 240),
    alternativeTitles: (Array.isArray(series.alternativeTitles) ? series.alternativeTitles : series.altTitles || []).map((item) => cleanText(item, 240)).filter(Boolean).slice(0, 20),
    author: cleanText(series.author, 240),
    artist: cleanText(series.artist, 240),
    cover: safeHttps(series.cover, 900),
    description: cleanText(series.description, 3000),
    genres: (Array.isArray(series.genres) ? series.genres : []).map((item) => cleanText(item, 80)).filter(Boolean).slice(0, 40),
    status: cleanText(series.status, 80),
    provider,
    sourceType: safeId(series.sourceType || provider, provider).toLowerCase(),
    sourceUrl: safeHttps(series.sourceUrl, 900),
    updatedAt: dateOrNull(series.updatedAt)
  };
}

function sanitizeChapter(input = {}, series = {}) {
  const chapter = input && typeof input === "object" ? input : {};
  const id = safeId(chapter.id || chapter.chapterId, "");
  if (!id) {
    const error = new Error("Chapter ID không hợp lệ.");
    error.statusCode = 400;
    error.code = "COMIC_CHAPTER_ID_REQUIRED";
    throw error;
  }
  const pageCount = Math.min(500, Math.max(0, Number(chapter.pageCount || chapter.pages?.length) || 0));
  return {
    id,
    number: cleanText(chapter.number, 60),
    title: cleanText(chapter.title, 240),
    sourceUrl: safeHttps(chapter.sourceUrl || chapter.apiUrl, 900),
    providerChapterId: safeId(chapter.providerChapterId || chapter.chapterId || chapter.id, id),
    pageCount,
    estimatedPanelCount: Math.min(2000, Math.max(pageCount, Number(chapter.estimatedPanelCount) || pageCount)),
    updatedAt: dateOrNull(chapter.updatedAt),
    scanlationGroup: cleanText(chapter.scanlationGroup, 240),
    provider: safeId(chapter.provider || series.provider || series.sourceType || "imported", "imported").toLowerCase(),
    pageRange: chapter.pageRange && typeof chapter.pageRange === "object" ? {
      start: Math.max(1, Number(chapter.pageRange.start) || 1),
      end: Math.min(pageCount || 500, Math.max(1, Number(chapter.pageRange.end) || pageCount || 1))
    } : null,
    cleanReaderBlockedPages: (Array.isArray(chapter.cleanReaderBlockedPages) ? chapter.cleanReaderBlockedPages : [])
      .map(Number).filter((value) => Number.isInteger(value) && value >= 0 && value < 500).slice(0, 500)
  };
}

function sanitizeDescriptor(input = {}, ownerId = "", options = {}) {
  const series = sanitizeSeries(input.series || input);
  const chaptersSource = Array.isArray(input.chapters) ? input.chapters : input.chapter ? [input.chapter] : [];
  if (!chaptersSource.length) {
    const error = new Error("Handoff cần ít nhất một chương.");
    error.statusCode = 400;
    error.code = "COMIC_HANDOFF_CHAPTER_REQUIRED";
    throw error;
  }
  if (chaptersSource.length > MAX_HANDOFF_CHAPTERS) {
    const error = new Error(`Mỗi handoff chỉ hỗ trợ tối đa ${MAX_HANDOFF_CHAPTERS} chương.`);
    error.statusCode = 413;
    error.code = "COMIC_HANDOFF_CHAPTER_LIMIT";
    throw error;
  }
  const rightsSource = input.rights && typeof input.rights === "object" ? input.rights : {};
  const rights = evaluateRights(sanitizeRights({ ...rightsSource, sourceUrl: rightsSource.sourceUrl || series.sourceUrl }), {
    provider: series.provider,
    sourceType: series.sourceType,
    commercialMode: input.commercialMode !== false,
    requireEvidence: true,
    trustedReview: options.trustedReview === true
  });
  const chapters = chaptersSource.map((chapter) => sanitizeChapter(chapter, series));
  return {
    schemaVersion: HANDOFF_SCHEMA_VERSION,
    ownerId: String(ownerId || ""),
    learnerProfileId: safeId(input.learnerProfileId, ""),
    workspaceId: safeId(input.workspaceId, ""),
    series,
    chapters,
    chapter: chapters.length === 1 ? chapters[0] : null,
    rights,
    preset: {
      id: safeId(input.preset?.id || "youtube-16x9", "youtube-16x9"),
      mode: ["auto", "quick-review", "pro"].includes(input.preset?.mode) ? input.preset.mode : "quick-review",
      format: ["16:9", "9:16", "1:1"].includes(input.preset?.format) ? input.preset.format : "16:9"
    },
    requestedAt: new Date()
  };
}

function handoffHash(handoffId) {
  return createHash("sha256").update(`comic-motion-handoff:${String(handoffId || "")}`).digest("hex");
}

async function ensureLibraryIndexes(db) {
  if (!db || indexedDatabases.has(db)) return;
  const handoffs = db.collection("comicMotionHandoffs");
  const rights = db.collection("comicMotionRights");
  await Promise.all([
    handoffs.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "comic_motion_handoff_ttl" }),
    handoffs.createIndex({ ownerId: 1, createdAt: -1 }, { name: "comic_motion_handoff_owner_created" }),
    handoffs.createIndex({ handoffHash: 1 }, { unique: true, name: "comic_motion_handoff_hash_unique" }),
    rights.createIndex({ ownerId: 1, seriesId: 1, chapterId: 1 }, { name: "comic_motion_rights_owner_series_chapter" })
  ]);
  indexedDatabases.add(db);
}

function publicHandoff(record, includeDescriptor = true, handoffId = "") {
  if (!record) return null;
  return {
    id: String(handoffId || ""),
    schemaVersion: Number(record.schemaVersion || HANDOFF_SCHEMA_VERSION),
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    consumedAt: record.consumedAt || null,
    ...(includeDescriptor ? { descriptor: record.descriptor } : {})
  };
}

async function createHandoff(db, ownerId, input, options = {}) {
  await ensureLibraryIndexes(db);
  const descriptor = sanitizeDescriptor(input, ownerId, options);
  const publicId = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + HANDOFF_TTL_MINUTES * 60_000);
  const record = {
    handoffHash: handoffHash(publicId),
    schemaVersion: HANDOFF_SCHEMA_VERSION,
    ownerId: String(ownerId),
    learnerProfileId: descriptor.learnerProfileId,
    workspaceId: descriptor.workspaceId,
    seriesId: descriptor.series.id,
    chapterId: descriptor.chapters[0].id,
    chapterIds: descriptor.chapters.map((chapter) => chapter.id),
    provider: descriptor.series.provider,
    descriptor,
    consumedAt: null,
    createdAt: now,
    updatedAt: now,
    expiresAt
  };
  await db.collection("comicMotionHandoffs").insertOne(record);
  await Promise.all(descriptor.chapters.map((chapter) => db.collection("comicMotionRights").updateOne(
    { ownerId: String(ownerId), seriesId: descriptor.series.id, chapterId: chapter.id },
    { $set: {
      ownerId: String(ownerId), learnerProfileId: descriptor.learnerProfileId, workspaceId: descriptor.workspaceId,
      seriesId: descriptor.series.id, chapterId: chapter.id, provider: chapter.provider || descriptor.series.provider,
      ...descriptor.rights, updatedAt: now
    }, $setOnInsert: { createdAt: now } },
    { upsert: true }
  )));
  await db.collection("comicMotionAuditEvents").insertOne({
    type: "handoff:created", ownerId: String(ownerId), seriesId: record.seriesId,
    chapterId: record.chapterId, provider: record.provider, handoffHash: record.handoffHash,
    createdAt: now, updatedAt: now
  });
  return publicHandoff(record, false, publicId);
}

function handoffFilter(ownerId, handoffId, now = new Date()) {
  return { ownerId: String(ownerId), handoffHash: handoffHash(handoffId), expiresAt: { $gt: now } };
}

async function getHandoff(db, ownerId, handoffId) {
  await ensureLibraryIndexes(db);
  const record = await db.collection("comicMotionHandoffs").findOne(handoffFilter(ownerId, handoffId));
  if (!record) {
    const error = new Error("Handoff không tồn tại, đã hết hạn hoặc không thuộc tài khoản này.");
    error.statusCode = 404;
    error.code = "COMIC_HANDOFF_NOT_FOUND";
    throw error;
  }
  return publicHandoff(record, true, handoffId);
}

async function consumeHandoff(db, ownerId, handoffId) {
  await ensureLibraryIndexes(db);
  const now = new Date();
  const record = await db.collection("comicMotionHandoffs").findOneAndUpdate(
    { ...handoffFilter(ownerId, handoffId, now), consumedAt: null },
    { $set: { consumedAt: now, updatedAt: now } },
    { returnDocument: "after" }
  );
  if (!record) {
    const error = new Error("Handoff đã được sử dụng, đã hết hạn hoặc không thuộc tài khoản này.");
    error.statusCode = 409;
    error.code = "COMIC_HANDOFF_CONSUMED_OR_EXPIRED";
    throw error;
  }
  await db.collection("comicMotionAuditEvents").insertOne({
    type: "handoff:consumed", ownerId: String(ownerId), seriesId: record.seriesId,
    chapterId: record.chapterId, provider: record.provider, handoffHash: record.handoffHash,
    createdAt: now, updatedAt: now
  });
  return publicHandoff(record, true, handoffId);
}

module.exports = {
  HANDOFF_SCHEMA_VERSION,
  HANDOFF_TTL_MINUTES,
  MAX_HANDOFF_CHAPTERS,
  safeId,
  safeHttps,
  sanitizeSeries,
  sanitizeChapter,
  sanitizeDescriptor,
  handoffHash,
  ensureLibraryIndexes,
  createHandoff,
  getHandoff,
  consumeHandoff
};
