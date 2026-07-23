"use strict";

const { createHash } = require("node:crypto");
const { clean, currentUser, withApi } = require("../utils/platform");
const { configuredProviders, ensureIndexes, policyFor, providerStatus } = require("../services/toolGateway");

function subscriptionHash(endpoint) {
  return createHash("sha256").update(String(endpoint || "")).digest("hex");
}

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    if (req.method === "GET") return res.status(200).json({ gateway: "integrations", providers: providerStatus(), secretsExposed: false });
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để quản lý kết nối.", code: "AUTH_REQUIRED" });
    const policy = policyFor(body.toolId, body.action, "integration");
    if (policy.id !== "realtime-notifications") return res.status(404).json({ error: "Kết nối không được hỗ trợ.", code: "INTEGRATION_NOT_FOUND" });
    const configured = configuredProviders()["web-push"];
    if (policy.action === "status") return res.status(200).json({ configured, permissionRequired: "notifications", secretsExposed: false });
    if (!configured) return res.status(503).json({ error: "Web Push chưa được cấu hình trên máy chủ.", code: "INTEGRATION_NOT_CONFIGURED" });
    const subscription = body.input?.subscription || {};
    const endpoint = clean(subscription.endpoint, 1000);
    if (!endpoint || !/^https:\/\//i.test(endpoint)) return res.status(400).json({ error: "Push subscription không hợp lệ.", code: "SUBSCRIPTION_INVALID" });
    await ensureIndexes(db);
    const hash = subscriptionHash(endpoint);
    const collection = db.collection("toolNotificationSubscriptions");
    if (policy.action === "unsubscribe") {
      await collection.deleteOne({ userId: user._id, endpointHash: hash });
      return res.status(200).json({ ok: true, subscribed: false });
    }
    const keys = subscription.keys || {};
    if (!clean(keys.p256dh, 500) || !clean(keys.auth, 500)) return res.status(400).json({ error: "Push subscription thiếu public keys.", code: "SUBSCRIPTION_INVALID" });
    await collection.updateOne(
      { userId: user._id, endpointHash: hash },
      { $set: { endpoint, keys: { p256dh: clean(keys.p256dh, 500), auth: clean(keys.auth, 500) }, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
    return res.status(200).json({ ok: true, subscribed: true, endpointStored: true, endpointReturned: false });
  });
};
