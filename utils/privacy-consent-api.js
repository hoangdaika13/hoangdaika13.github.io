const { createHash } = require("crypto");
const { clean, currentUser, enforceRateLimit, withApi } = require("./platform");

const POLICY_VERSION = "privacy-v1-2026-07";
const CONSENT_RETENTION_SECONDS = 365 * 24 * 60 * 60;

function preferences(body = {}) {
  const input = body.preferences && typeof body.preferences === "object" ? body.preferences : body;
  return {
    necessary: true,
    analytics: input.analytics === true,
    personalization: input.personalization === true,
    marketing: false
  };
}

function visitorHash(value) {
  const raw = clean(value, 160);
  if (!raw) return "";
  return createHash("sha256").update(`hh-consent:${String(process.env.JWT_SECRET || "")}:${raw}`).digest("hex");
}

module.exports = async function privacyConsentHandler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    const consentEvents = db.collection("privacyConsentEvents");
    await Promise.all([
      consentEvents.createIndex({ createdAt: -1 }),
      consentEvents.createIndex({ userId: 1, createdAt: -1 }),
      consentEvents.createIndex({ identityHash: 1, createdAt: -1 }),
      consentEvents.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
    ]);

    if (req.method === "GET") {
      const user = await currentUser(req);
      if (!user) return res.status(200).json({ ok: true, authenticated: false, policyVersion: POLICY_VERSION, preferences: null });
      const item = await consentEvents.findOne({ userId: user._id }, { sort: { createdAt: -1 } });
      return res.status(200).json({
        ok: true,
        authenticated: true,
        policyVersion: POLICY_VERSION,
        preferences: item?.preferences || { necessary: true, analytics: Boolean(user.consent), personalization: false, marketing: false },
        updatedAt: item?.createdAt || user.consentUpdatedAt || null
      });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const user = await currentUser(req);
    const visitorId = clean(body.visitorId, 160);
    const identity = user ? `user:${String(user._id)}` : `guest:${visitorHash(visitorId)}`;
    if (!user && !visitorId) return res.status(400).json({ error: "Thiếu mã phiên quyền riêng tư." });
    await enforceRateLimit(db, `privacy-consent:${identity}`, 12, 60 * 60 * 1000);

    const now = new Date();
    const next = preferences(body);
    const record = {
      identityHash: createHash("sha256").update(`record:${identity}`).digest("hex"),
      kind: user ? "registered" : "guest",
      userId: user?._id || null,
      preferences: next,
      policyVersion: POLICY_VERSION,
      source: clean(body.source || "privacy-center", 40),
      createdAt: now,
      expiresAt: new Date(now.getTime() + CONSENT_RETENTION_SECONDS * 1000)
    };
    await consentEvents.insertOne(record);
    if (user) {
      await db.collection("users").updateOne(
        { _id: user._id },
        { $set: { consent: next.analytics, consentPreferences: next, consentPolicyVersion: POLICY_VERSION, consentUpdatedAt: now, updatedAt: now } }
      );
    }
    return res.status(200).json({
      ok: true,
      policyVersion: POLICY_VERSION,
      preferences: next,
      updatedAt: now,
      privacy: { rawCookieValuesStored: false, rawVisitorIdStored: false, rawIpStored: false, retentionDays: 365 }
    });
  });
};

module.exports.POLICY_VERSION = POLICY_VERSION;
