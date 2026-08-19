"use strict";

/*
 * One-way, repeatable migration for the legacy adminCustomPermissions field.
 *
 * Usage:
 *   node scripts/migrate-admin-role-assignments.js --dry-run
 *   node scripts/migrate-admin-role-assignments.js
 *   node scripts/migrate-admin-role-assignments.js --rollback
 *
 * The migration deliberately keeps adminCustomPermissions intact for the
 * dual-read window.  Rollback only removes records created by this script.
 */
const { createHash } = require("crypto");
const { MongoClient, ObjectId } = require("mongodb");
const { normalizePermissions } = require("../utils/community-admin");

const MIGRATION = "admin-role-assignments-v1";
const now = () => new Date();
const idString = (value) => String(value || "");

function legacyRoleId(userId) {
  const digest = createHash("sha256").update(idString(userId)).digest("hex").slice(0, 20);
  return `custom:legacy_${digest}`;
}

async function migrateAdminRoleAssignments(db, { dryRun = false, rollback = false } = {}) {
  const users = db.collection("users");
  const definitions = db.collection("communityRoleDefinitions");
  const assignments = db.collection("communityRoleAssignments");
  const summary = { migration: MIGRATION, dryRun, rollback, scanned: 0, definitionsCreated: 0, assignmentsCreated: 0, alreadyMigrated: 0, skipped: 0, removed: 0 };
  if (rollback) {
    const [assignmentResult, definitionResult, userResult] = dryRun
      ? [{ deletedCount: await assignments.countDocuments({ "metadata.migration": MIGRATION }) }, { deletedCount: await definitions.countDocuments({ "metadata.migration": MIGRATION }) }, { modifiedCount: await users.countDocuments({ adminAccessMigrationVersion: MIGRATION }) }]
      : await Promise.all([
        assignments.deleteMany({ "metadata.migration": MIGRATION }),
        definitions.deleteMany({ "metadata.migration": MIGRATION }),
        users.updateMany({ adminAccessMigrationVersion: MIGRATION }, { $unset: { adminAccessMigrationVersion: "" } })
      ]);
    summary.removed = Number(assignmentResult.deletedCount || 0) + Number(definitionResult.deletedCount || 0) + Number(userResult.modifiedCount || 0);
    return summary;
  }

  const cursor = users.find({ adminCustomPermissions: { $exists: true, $type: "array", $ne: [] } }, { projection: { systemRoles: 1, adminCustomPermissions: 1, name: 1, email: 1 } });
  for await (const user of cursor) {
    summary.scanned += 1;
    const permissions = normalizePermissions(user.adminCustomPermissions);
    if (!permissions.length) { summary.skipped += 1; continue; }
    const roleId = legacyRoleId(user._id);
    const existingAssignment = await assignments.findOne({ userId: user._id, roleId, "metadata.migration": MIGRATION });
    if (existingAssignment) { summary.alreadyMigrated += 1; continue; }
    const timestamp = now();
    const role = {
      roleId,
      version: 1,
      name: `Legacy access · ${String(user.name || user.email || user._id).slice(0, 80)}`,
      description: "Role tạo từ adminCustomPermissions trong migration; hãy review và thay thế bằng custom role có owner rõ ràng.",
      permissions,
      status: "active",
      riskScore: Math.min(100, permissions.length * 2),
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: null,
      updatedBy: null,
      metadata: { migration: MIGRATION, sourceUserId: user._id }
    };
    const assignment = {
      userId: user._id,
      roleId,
      roleVersion: 1,
      workspaceId: "",
      scope: { type: "global", workspaceIds: [], moduleIds: [], accountIds: [], providerIds: [], contentSourceIds: [], ownerIds: [], environmentIds: [] },
      status: "active",
      grantedBy: null,
      reason: "Compatibility migration from adminCustomPermissions",
      grantedAt: timestamp,
      expiresAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata: { migration: MIGRATION, sourceField: "adminCustomPermissions" }
    };
    if (!dryRun) {
      await definitions.updateOne({ roleId, version: 1, "metadata.migration": MIGRATION }, { $setOnInsert: role }, { upsert: true });
      await assignments.insertOne(assignment);
      await users.updateOne({ _id: user._id }, { $set: { adminAccessMigrationVersion: MIGRATION, adminAccessMigrationAt: timestamp } });
    }
    summary.definitionsCreated += 1;
    summary.assignmentsCreated += 1;
  }
  return summary;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required; no database change was made.");
  const dryRun = process.argv.includes("--dry-run");
  const rollback = process.argv.includes("--rollback");
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(process.env.MONGODB_DB || "hoangdaika13_site");
    const result = await migrateAdminRoleAssignments(db, { dryRun, rollback });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.close();
  }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { MIGRATION, legacyRoleId, migrateAdminRoleAssignments };
