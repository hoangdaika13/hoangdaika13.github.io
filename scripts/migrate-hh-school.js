"use strict";

const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || "hoangdaika13_site";
if (!uri) throw new Error("MONGODB_URI is required; no database change was made.");

const definitions = [
  ["education_grades", { number: 1 }, { unique: true }],
  ["education_subjects", { id: 1 }, { unique: true }],
  ["education_curricula", { version: 1, gradeId: 1 }, { unique: true }],
  ["education_topics", { curriculumId: 1, subjectId: 1, id: 1 }, { unique: true }],
  ["education_lessons", { curriculumId: 1, lessonId: 1 }, { unique: true }],
  ["education_skills", { curriculumId: 1, skillId: 1 }, { unique: true }],
  ["education_prerequisites", { curriculumId: 1, skillId: 1, prerequisiteSkillId: 1 }, { unique: true }],
  ["education_questions", { curriculumId: 1, questionId: 1 }, { unique: true }],
  ["education_attempts", { ownerId: 1, learnerProfileId: 1, createdAt: -1 }],
  ["education_mastery", { ownerId: 1, learnerProfileId: 1, skillId: 1 }, { unique: true }],
  ["education_assignments", { classId: 1, dueAt: 1 }],
  ["education_classes", { teacherId: 1, updatedAt: -1 }],
  ["education_enrollments", { learnerOwnerId: 1, learnerProfileId: 1, classId: 1 }, { unique: true }],
  ["education_submissions", { assignmentId: 1, learnerOwnerId: 1, learnerProfileId: 1 }, { unique: true }],
  ["education_family_links", { tokenHash: 1 }, { unique: true, sparse: true }],
  ["education_family_links", { parentId: 1, status: 1 }],
  ["education_content_versions", { contentId: 1, version: -1 }, { unique: true }],
  ["education_content_versions", { checksum: 1, status: 1 }],
  ["education_reviews", { status: 1, createdAt: 1 }],
  ["education_sources", { checksum: 1 }, { unique: true, sparse: true }],
  ["education_licenses", { licenseCode: 1, version: 1 }, { unique: true }],
  ["education_ai_sessions", { ownerId: 1, learnerProfileId: 1, createdAt: -1 }],
  ["education_audit_logs", { actorId: 1, createdAt: -1 }],
  ["education_progress", { ownerId: 1, learnerProfileId: 1 }, { unique: true }]
];
const sameKeys = (left, right) => JSON.stringify(Object.entries(left || {})) === JSON.stringify(Object.entries(right || {}));

async function migrate() {
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(databaseName);
    await db.collection("education_classes").dropIndex("education_classes_code").catch((error) => {
      if (error?.codeName !== "IndexNotFound" && error?.code !== 27 && error?.code !== 26) throw error;
    });
    for (const [collectionName, keys, options = {}] of definitions) {
      const collection = db.collection(collectionName);
      const existing = await collection.listIndexes().toArray().catch((error) => error?.codeName === "NamespaceNotFound" || error?.code === 26 ? [] : Promise.reject(error));
      if (existing.some((item) => sameKeys(item.key, keys) && Boolean(item.unique) === Boolean(options.unique) && Boolean(item.sparse) === Boolean(options.sparse))) continue;
      await collection.createIndex(keys, { ...options, name: `hh_school_${collectionName}_${Object.keys(keys).join("_")}`.slice(0, 120) });
    }
    process.stdout.write(`HH School indexes ready: ${definitions.length}\n`);
  } finally {
    await client.close();
  }
}

migrate().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
