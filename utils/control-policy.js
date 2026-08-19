"use strict";

const { createHash } = require("crypto");

const POLICY_CONSUMERS = Object.freeze({
  "maintenance.mode": "utils/control-policy.js",
  "payments.locked": "api/donations.js",
  "content.publishing.locked": "api/community.js",
  "rate-limit.global": "utils/platform.js",
  "feature-flags": "utils/control-policy.js",
  "ai.provider.fallback": "ai gateway integration (provider-specific)"
});

function cleanKey(value) { return String(value || "").trim().slice(0, 180); }
function truthy(value) { return value === true || value === 1 || value === "1" || String(value || "").toLowerCase() === "true" || String(value || "").toLowerCase() === "locked"; }

async function readControlPolicy(db, key, fallback = null) {
  const normalized = cleanKey(key);
  if (!normalized || !db?.collection) return fallback;
  const row = await db.collection("communityControlPolicies").findOne({ key: normalized }, { projection: { value: 1, updatedAt: 1, updatedBy: 1, consumer: 1, enforcementState: 1 } });
  return row ? { key: normalized, value: row.value, updatedAt: row.updatedAt || null, updatedBy: row.updatedBy || null, consumer: row.consumer || POLICY_CONSUMERS[normalized] || null, enforcementState: row.enforcementState || (POLICY_CONSUMERS[normalized] ? "enforced" : "no_consumer") } : fallback;
}

async function enforceControlPolicy(db, { key, action = "read", actor = null, resource = null, defaultValue = null } = {}) {
  const normalized = cleanKey(key);
  const policy = await readControlPolicy(db, normalized, { key: normalized, value: defaultValue, consumer: POLICY_CONSUMERS[normalized] || null, enforcementState: POLICY_CONSUMERS[normalized] ? "enforced" : "no_consumer" });
  const locked = ["maintenance.mode", "payments.locked", "content.publishing.locked"].includes(normalized) && truthy(policy?.value);
  return {
    allowed: !locked,
    code: locked ? "CONTROL_POLICY_BLOCKED" : policy?.enforcementState === "no_consumer" ? "POLICY_NO_CONSUMER" : "ALLOWED",
    key: normalized,
    action: String(action || "read").slice(0, 100),
    actorId: actor?._id ? String(actor._id) : "",
    resourceId: resource?.id || resource?._id ? String(resource.id || resource._id) : "",
    value: policy?.value ?? defaultValue,
    consumer: policy?.consumer || null,
    enforcementState: policy?.enforcementState || "no_consumer"
  };
}

async function featureFlagEnabled(db, key, { subjectId = "", defaultEnabled = false } = {}) {
  const row = await db.collection("communityFeatureFlags").findOne({ key: cleanKey(key) }, { projection: { enabled: 1, rollout: 1 } });
  if (!row) return defaultEnabled;
  if (row.enabled !== true) return false;
  const rollout = Math.max(0, Math.min(100, Number(row.rollout ?? 100)));
  if (rollout >= 100) return true;
  if (rollout <= 0) return false;
  const digest = createHash("sha256").update(`${cleanKey(key)}:${String(subjectId || "anonymous")}`).digest("hex");
  return (Number.parseInt(digest.slice(0, 8), 16) % 100) < rollout;
}

function policyStatus(key) {
  const normalized = cleanKey(key);
  return { key: normalized, consumer: POLICY_CONSUMERS[normalized] || null, enforcementState: POLICY_CONSUMERS[normalized] ? "enforced" : "no_consumer" };
}

module.exports = { POLICY_CONSUMERS, enforceControlPolicy, featureFlagEnabled, policyStatus, readControlPolicy };
