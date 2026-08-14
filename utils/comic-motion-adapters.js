"use strict";

const { createHash } = require("node:crypto");
const { chapterPages: oTruyenChapterPages } = require("./otruyen-source");
const { chapterPages: mangaDexChapterPages } = require("./mangadex-source");

function fail(message, code = "COMIC_ADAPTER_UNAVAILABLE", statusCode = 422) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
}

function checksumHints(pages = []) {
  return pages.map((page, index) => ({ index, sourceFingerprint: createHash("sha256").update(String(page)).digest("hex") }));
}

class ComicProviderAdapter {
  canHandle() { return false; }
  getSeries(descriptor) { return descriptor.series; }
  getChapters(descriptor) { return descriptor.chapters || []; }
  getAttribution(descriptor) { return descriptor.rights?.attributionText || ""; }
  getRights(descriptor) { return descriptor.rights || { status: "unknown" }; }
  getChecksumHints(pages) { return checksumHints(pages); }
}

class OTruyenAdapter extends ComicProviderAdapter {
  canHandle(descriptor) { return descriptor?.series?.provider === "otruyen" || descriptor?.series?.sourceType === "otruyen"; }
  async getChapterPages(chapter) {
    if (!chapter?.sourceUrl) fail("OTruyen chapter thiếu API URL đã được gateway cấp.", "OTRUYEN_CHAPTER_URL_REQUIRED");
    const result = await oTruyenChapterPages({ url: chapter.sourceUrl });
    const data = result.data;
    const base = String(data.domain_cdn || "").replace(/\/$/, "");
    const path = String(data.item?.chapter_path || "").replace(/^\/+|\/+$/g, "");
    return (data.item?.chapter_image || []).slice(0, 500).map((entry) => `${base}/${path}/${encodeURIComponent(String(entry.image_file || ""))}`);
  }
}

class MangaDexAdapter extends ComicProviderAdapter {
  canHandle(descriptor) { return descriptor?.series?.provider === "mangadex" || descriptor?.series?.sourceType === "mangadex"; }
  async getChapterPages(chapter) {
    const id = String(chapter?.providerChapterId || chapter?.id || "").replace(/^mangadex:chapter:/, "");
    if (!id) fail("MangaDex chapter ID đang trống.", "MANGADEX_CHAPTER_ID_REQUIRED");
    return (await mangaDexChapterPages({ id })).pages;
  }
}

class OpenComicAdapter extends ComicProviderAdapter {
  canHandle(descriptor) { return ["github-open", "open-comic"].includes(descriptor?.series?.sourceType); }
  async getChapterPages(chapter) {
    const pages = Array.isArray(chapter?.pages) ? chapter.pages.filter((page) => /^https:\/\/(?:raw\.githubusercontent\.com|upload\.wikimedia\.org)\//i.test(page)).slice(0, 500) : [];
    if (!pages.length) fail("Open Comic cần manifest trang đã kiểm duyệt trên worker.", "OPEN_COMIC_MANIFEST_REQUIRED");
    return pages;
  }
}

class ImportedComicAdapter extends ComicProviderAdapter {
  canHandle(descriptor) { return ["imported", "feed", "local-cbz", "local-zip"].includes(descriptor?.series?.sourceType); }
  async getChapterPages(chapter) {
    const assetIds = Array.isArray(chapter?.assetIds) ? chapter.assetIds.slice(0, 500) : [];
    if (!assetIds.length) fail("Truyện import chỉ được resolve qua private asset storage.", "PRIVATE_ASSET_STORAGE_REQUIRED");
    return assetIds.map((assetId) => ({ assetId: String(assetId) }));
  }
}

class OwnedUploadAdapter extends ImportedComicAdapter {
  canHandle(descriptor) { return descriptor?.series?.sourceType === "owned-upload"; }
}

const adapters = Object.freeze([new OTruyenAdapter(), new MangaDexAdapter(), new OpenComicAdapter(), new OwnedUploadAdapter(), new ImportedComicAdapter()]);

function adapterFor(descriptor) {
  const adapter = adapters.find((candidate) => candidate.canHandle(descriptor));
  if (!adapter) fail("Nguồn truyện chưa có adapter được phép.", "COMIC_ADAPTER_NOT_FOUND");
  return adapter;
}

module.exports = { ComicProviderAdapter, OTruyenAdapter, MangaDexAdapter, OpenComicAdapter, ImportedComicAdapter, OwnedUploadAdapter, adapters, adapterFor, checksumHints };
