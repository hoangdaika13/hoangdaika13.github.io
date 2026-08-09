const films = require("../../assets/open-media/curated-films-v1.json");
const music = require("../../assets/open-media/curated-music-v1.json");
const { clean, currentUser, isAdminUser, withApi } = require("../platform");
const { assertSameOrigin } = require("./notices").__test;

const CATALOG_IDS = new Set([...(films.items || []), ...(music.items || [])].map((item) => String(item.id)));
let indexReady = false;

async function ensureIndex(collection) {
  if (indexReady) return;
  await collection.createIndex({ itemId: 1 }, { unique: true });
  indexReady = true;
}

function safeEvidenceUrl(value) {
  try {
    const parsed = new URL(clean(value, 1600));
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.href : "";
  } catch { return ""; }
}

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    const user = await currentUser(req);
    if (!user || !isAdminUser(user)) return res.status(403).json({ error: "Bạn không có quyền quản lý trạng thái phát hành." });
    const collection = db.collection("openMediaRestrictions");
    await ensureIndex(collection);
    if (req.method === "GET") {
      const rows = await collection.find({}).sort({ updatedAt: -1 }).limit(200).toArray();
      return res.status(200).json({ restrictions: rows });
    }
    if (req.method !== "PATCH") return res.status(405).json({ error: "Method not allowed" });
    assertSameOrigin(req);
    const itemId = clean(body.itemId || req.query?.itemId, 160);
    if (!CATALOG_IDS.has(itemId)) return res.status(404).json({ error: "Không tìm thấy nội dung trong danh mục đã kiểm duyệt." });
    const action = clean(body.action, 30);
    const decision = clean(body.decision, 3000);
    const evidenceUrl = safeEvidenceUrl(body.evidenceUrl);
    if (!['suspend', 'restore'].includes(action)) return res.status(400).json({ error: "Thao tác không hợp lệ." });
    if (decision.length < 20) return res.status(400).json({ error: "Cần ghi quyết định kiểm duyệt tối thiểu 20 ký tự." });
    if (action === "restore" && !evidenceUrl) return res.status(400).json({ error: "Khôi phục bắt buộc có URL bằng chứng HTTPS." });
    const now = new Date();
    const blocked = action === "suspend";
    const result = await collection.findOneAndUpdate(
      { itemId },
      {
        $set: {
          itemId,
          blocked,
          reasonCode: blocked ? clean(body.reasonCode, 80) || "manual-rights-suspension" : "reviewed-restoration",
          updatedAt: now,
          ...(blocked
            ? { blockedAt: now, blockedByUserId: user._id }
            : { restoredAt: now, restoredByUserId: user._id, restorationDecision: decision, restorationEvidenceUrl: evidenceUrl })
        },
        $setOnInsert: { createdAt: now },
        $push: { history: { action, decision, evidenceUrl: evidenceUrl || null, at: now, actorUserId: user._id } }
      },
      { upsert: true, returnDocument: "after" }
    );
    return res.status(200).json({ ok: true, restriction: result });
  });
};

module.exports.__test = Object.freeze({ CATALOG_IDS, safeEvidenceUrl });
