"use strict";

const { clean, currentUser, withApi } = require("../utils/platform");
const { TOOL_POLICIES, executeServerTool, policyFor, publicPolicy } = require("../services/toolGateway");

module.exports = async function handler(req, res) {
  return withApi(req, res, async ({ db, body }) => {
    if (req.method === "GET") return res.status(200).json({ gateway: "tools", version: 1, tools: Object.fromEntries(Object.entries(TOOL_POLICIES).filter(([, policy]) => policy.runtime === "server").map(([id, policy]) => [id, publicPolicy(policy)])), secretsExposed: false });
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: "Bạn cần đăng nhập để chạy Tool server.", code: "AUTH_REQUIRED" });
    const policy = policyFor(body.toolId, body.action, "server");
    try {
      const job = await executeServerTool(db, user, policy, body.input || {});
      return res.status(200).json({ ok: true, job, taskId: clean(body.taskId, 120) || null });
    } catch (error) {
      return res.status(Number(error.statusCode || 500)).json({ error: clean(error.message, 300), code: error.code || "TOOL_EXECUTION_FAILED", job: error.job || null });
    }
  });
};
