"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { MemoryDb } = require("./helpers/comic-motion-memory-db");
const { createHandoff, getHandoff, consumeHandoff, handoffHash } = require("../utils/comic-motion-library");

function descriptor(id = "chapter-1") {
  return {
    series: { id: "series-1", title: "Open Comic", provider: "open-comic", sourceType: "open-comic", sourceUrl: "https://example.com/comic" },
    chapters: [{ id, number: 1, title: "Start", pageCount: 12, provider: "open-comic" }],
    rights: { licenseCode: "CC0-1.0", derivativesAllowed: true, commercialUseAllowed: true, redistributionAllowed: true, sourceUrl: "https://example.com/comic" }
  };
}

test("handoff is random, owner-scoped and consumable exactly once", async () => {
  const db = new MemoryDb();
  const handoff = await createHandoff(db, "owner-a", descriptor());
  assert.ok(handoff.id.length >= 43);
  assert.equal(db.collection("comicMotionHandoffs").rows[0].handoffHash, handoffHash(handoff.id));
  assert.equal("publicId" in db.collection("comicMotionHandoffs").rows[0], false);
  await assert.rejects(() => getHandoff(db, "owner-b", handoff.id), (error) => error.statusCode === 404);
  const consumed = await consumeHandoff(db, "owner-a", handoff.id);
  assert.equal(consumed.descriptor.series.id, "series-1");
  assert.ok(consumed.consumedAt);
  await assert.rejects(() => consumeHandoff(db, "owner-a", handoff.id), (error) => error.code === "COMIC_HANDOFF_CONSUMED_OR_EXPIRED");
});

test("expired handoff is rejected and rights registry is persisted", async () => {
  const db = new MemoryDb();
  const handoff = await createHandoff(db, "owner-a", descriptor("chapter-expired"));
  db.collection("comicMotionHandoffs").rows[0].expiresAt = new Date(Date.now() - 1);
  await assert.rejects(() => getHandoff(db, "owner-a", handoff.id), (error) => error.code === "COMIC_HANDOFF_NOT_FOUND");
  const rights = db.collection("comicMotionRights").rows[0];
  assert.equal(rights.ownerId, "owner-a");
  assert.equal(rights.chapterId, "chapter-expired");
  assert.equal(rights.status, "manual-review");
  assert.equal(rights.reasonCode, "RIGHTS_EVIDENCE_NOT_VERIFIED");
});
