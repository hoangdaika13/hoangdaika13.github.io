"use strict";

const { MongoClient } = require("mongodb");
const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || "hoangdaika13_site";
if (!uri) throw new Error("MONGODB_URI is required; no database change was made.");

const definitions = [
  ["social_workspaces", { ownerId: 1, workspaceId: 1 }, { unique: true }],
  ["social_accounts", { ownerId: 1, workspaceId: 1, accountId: 1 }, { unique: true }],
  ["social_oauth_connections", { ownerId: 1, workspaceId: 1, accountId: 1 }, { unique: true }],
  ["social_assets", { ownerId: 1, workspaceId: 1, sha256: 1 }, { unique: true }],
  ["social_projects", { ownerId: 1, workspaceId: 1, projectId: 1 }, { unique: true }],
  ["social_posts", { ownerId: 1, workspaceId: 1, projectId: 1, updatedAt: -1 }],
  ["social_post_versions", { ownerId: 1, workspaceId: 1, projectId: 1, version: -1 }, { unique: true }],
  ["social_templates", { ownerId: 1, workspaceId: 1, templateId: 1 }, { unique: true }],
  ["social_brand_kits", { ownerId: 1, workspaceId: 1, brandKitId: 1 }, { unique: true }],
  ["social_publish_jobs", { ownerId: 1, workspaceId: 1, idempotencyKey: 1 }, { unique: true }],
  ["social_schedules", { ownerId: 1, workspaceId: 1, scheduledAt: 1 }],
  ["social_approvals", { ownerId: 1, workspaceId: 1, status: 1, updatedAt: -1 }],
  ["social_comments", { ownerId: 1, workspaceId: 1, accountId: 1, updatedAt: -1 }],
  ["social_analytics_snapshots", { ownerId: 1, workspaceId: 1, accountId: 1, capturedAt: -1 }],
  ["social_webhook_events", { provider: 1, eventId: 1 }, { unique: true }],
  ["social_audit_logs", { ownerId: 1, workspaceId: 1, createdAt: -1 }],
  ["social_ai_generations", { ownerId: 1, workspaceId: 1, createdAt: -1 }]
];

async function migrate() {
  const client = new MongoClient(uri); await client.connect();
  try {
    const db = client.db(databaseName);
    for (const [collectionName, keys, options = {}] of definitions) await db.collection(collectionName).createIndex(keys, { ...options, name: `social_${collectionName}_${Object.keys(keys).join("_")}`.slice(0, 120) });
    process.stdout.write(`Social Media Tools indexes ready: ${definitions.length}\n`);
  } finally { await client.close(); }
}
migrate().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
