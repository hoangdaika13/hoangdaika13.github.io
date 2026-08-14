"use strict";

const { randomUUID } = require("node:crypto");

function valueAt(object, path) {
  return String(path).split(".").reduce((value, key) => value?.[key], object);
}

function equal(left, right) {
  if (left instanceof Date || right instanceof Date) return new Date(left).getTime() === new Date(right).getTime();
  return String(left) === String(right);
}

function matches(document, filter = {}) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === "$or") return expected.some((item) => matches(document, item));
    const actual = valueAt(document, key);
    if (expected && typeof expected === "object" && !(expected instanceof Date) && !Array.isArray(expected)) {
      if (Object.hasOwn(expected, "$gt") && !(actual > expected.$gt)) return false;
      if (Object.hasOwn(expected, "$gte") && !(actual >= expected.$gte)) return false;
      if (Object.hasOwn(expected, "$in") && !expected.$in.some((item) => equal(actual, item))) return false;
      if (Object.hasOwn(expected, "$nin") && expected.$nin.some((item) => equal(actual, item))) return false;
      return true;
    }
    return expected === null ? actual == null : equal(actual, expected);
  });
}

function applyUpdate(document, update, inserting = false) {
  if (update.$set) Object.assign(document, structuredClone(update.$set));
  if (inserting && update.$setOnInsert) Object.assign(document, structuredClone(update.$setOnInsert));
  if (update.$inc) Object.entries(update.$inc).forEach(([key, amount]) => { document[key] = Number(document[key] || 0) + Number(amount || 0); });
  return document;
}

class Cursor {
  constructor(rows) { this.rows = rows; }
  sort(spec = {}) { const [key, direction] = Object.entries(spec)[0] || []; if (key) this.rows.sort((a, b) => (valueAt(a, key) > valueAt(b, key) ? 1 : -1) * Number(direction)); return this; }
  limit(value) { this.rows = this.rows.slice(0, Number(value)); return this; }
  async toArray() { return structuredClone(this.rows); }
}

class Collection {
  constructor(name) { this.name = name; this.rows = []; }
  async createIndex() { return "index"; }
  assertUnique(document) {
    const duplicate = this.rows.some((row) =>
      this.name === "comicMotionHandoffs" && document.handoffHash && row.handoffHash === document.handoffHash
      || this.name === "comicMotionWorkerNonces" && document.nonceHash && row.nonceHash === document.nonceHash
      || this.name === "comicMotionJobs" && document.idempotencyKey && row.ownerId === document.ownerId && row.idempotencyKey === document.idempotencyKey
      || this.name === "comicMotionPresets" && row.ownerId === document.ownerId && row.id === document.id
    );
    if (duplicate) throw Object.assign(new Error("duplicate key"), { code: 11000 });
  }
  async insertOne(input) { const document = structuredClone(input); if (!document._id) document._id = randomUUID(); this.assertUnique(document); this.rows.push(document); return { insertedId: document._id }; }
  async insertMany(inputs) { for (const input of inputs) await this.insertOne(input); return { insertedCount: inputs.length }; }
  async findOne(filter) { const row = this.rows.find((entry) => matches(entry, filter)); return row ? structuredClone(row) : null; }
  find(filter) { return new Cursor(this.rows.filter((entry) => matches(entry, filter)).map((entry) => structuredClone(entry))); }
  async findOneAndUpdate(filter, update, options = {}) {
    let index = this.rows.findIndex((entry) => matches(entry, filter));
    if (index < 0 && options.upsert) {
      const base = Object.fromEntries(Object.entries(filter).filter(([, value]) => value == null || typeof value !== "object"));
      const document = applyUpdate({ _id: randomUUID(), ...base }, update, true); this.assertUnique(document); this.rows.push(document); index = this.rows.length - 1;
    }
    if (index < 0) return null;
    applyUpdate(this.rows[index], update, false);
    return structuredClone(this.rows[index]);
  }
  async updateOne(filter, update, options = {}) {
    let index = this.rows.findIndex((entry) => matches(entry, filter));
    if (index < 0 && options.upsert) {
      const base = Object.fromEntries(Object.entries(filter).filter(([, value]) => value == null || typeof value !== "object"));
      const document = applyUpdate({ _id: randomUUID(), ...base }, update, true); this.assertUnique(document); this.rows.push(document); return { matchedCount: 0, modifiedCount: 0, upsertedId: document._id };
    }
    if (index < 0) return { matchedCount: 0, modifiedCount: 0 };
    applyUpdate(this.rows[index], update, false); return { matchedCount: 1, modifiedCount: 1 };
  }
  async updateMany(filter, update) { let modifiedCount = 0; this.rows.forEach((row) => { if (matches(row, filter)) { applyUpdate(row, update, false); modifiedCount += 1; } }); return { modifiedCount }; }
  async deleteOne(filter) { const index = this.rows.findIndex((entry) => matches(entry, filter)); if (index < 0) return { deletedCount: 0 }; this.rows.splice(index, 1); return { deletedCount: 1 }; }
  async countDocuments(filter) { return this.rows.filter((entry) => matches(entry, filter)).length; }
}

class MemoryDb {
  constructor() { this.collections = new Map(); }
  collection(name) { if (!this.collections.has(name)) this.collections.set(name, new Collection(name)); return this.collections.get(name); }
}

module.exports = { MemoryDb, matches };
