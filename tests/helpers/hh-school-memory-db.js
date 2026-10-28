"use strict";
// Explicit QA-only database double. Application handlers, authorization checks
// and revision filters still run unchanged; this does not simulate MongoDB I/O.
const { ObjectId } = require("mongodb");
const copy = value => value instanceof Date ? new Date(value) : value instanceof ObjectId ? new ObjectId(value) : Array.isArray(value) ? value.map(copy) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, child]) => [key, copy(child)])) : value;
const equal = (a, b) => a instanceof Date || b instanceof Date ? new Date(a).getTime() === new Date(b).getTime() : a instanceof ObjectId || b instanceof ObjectId ? String(a) === String(b) : a === b;
function field(row, path) { return path.split(".").reduce((value, key) => value?.[key], row); }
function matches(row, query = {}) {
  return Object.entries(query).every(([key, value]) => {
    if (key === "$or") return value.some(part => matches(row, part));
    if (key === "$and") return value.every(part => matches(row, part));
    const actual = field(row, key);
    if (value && typeof value === "object" && !(value instanceof Date) && !(value instanceof ObjectId) && Object.keys(value).some(name => name.startsWith("$"))) return Object.entries(value).every(([operator, operand]) => {
      if (operator === "$exists") return (actual !== undefined) === operand;
      if (operator === "$size") return Array.isArray(actual) && actual.length === operand;
      if (operator === "$in") return operand.some(item => Array.isArray(actual) ? actual.some(entry => equal(entry, item)) : equal(actual, item));
      if (operator === "$ne") return !equal(actual, operand);
      if (operator === "$gt") return actual > operand;
      if (operator === "$gte") return actual >= operand;
      if (operator === "$lt") return actual < operand;
      if (operator === "$lte") return actual <= operand;
      throw Error("QA query operator not implemented: " + operator);
    });
    return Array.isArray(actual) ? actual.some(item => equal(item, value)) : equal(actual, value);
  });
}
function createEducationMemoryDB(seed = {}) {
  const collections = new Map(Object.entries(seed).map(([name, rows]) => [name, copy(rows)]));
  const rows = name => { if (!collections.has(name)) collections.set(name, []); return collections.get(name); };
  const mutate = (row, update, inserted = false) => { if (inserted) Object.assign(row, copy(update.$setOnInsert || {})); Object.assign(row, copy(update.$set || {})); for (const key of Object.keys(update.$unset || {})) delete row[key]; for (const [key, value] of Object.entries(update.$inc || {})) row[key] = Number(row[key] || 0) + value; for (const [key, value] of Object.entries(update.$push || {})) (row[key] ||= []).push(copy(value)); };
  const api = { rows, collection(name) {
    return {
      async createIndex() { return "qa-index"; },
      find(query = {}, options = {}) { let sort = {}, limit = Infinity; const cursor = { sort(value) { sort = value; return cursor; }, limit(value) { limit = value; return cursor; }, async toArray() { let result = rows(name).filter(row => matches(row, query)).map(copy); const entries = Object.entries(sort); result.sort((a, b) => { for (const [key, direction] of entries) { const x = field(a, key), y = field(b, key); if (x > y) return direction; if (x < y) return -direction; } return 0; }); result = result.slice(0, limit); if (options.projection) result = result.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => key === "_id" || options.projection[key]))); return result; } }; return cursor; },
      async findOne(query = {}, options = {}) { const cursor = this.find(query, options); if (options.sort) cursor.sort(options.sort); return (await cursor.limit(1).toArray())[0] || null; },
      async findOneAndUpdate(query, update, options = {}) { const before = await this.findOne(query); await this.updateOne(query, update, options); return options.returnDocument === "after" ? this.findOne(query) : before; },
      async insertOne(input) { const row = { ...copy(input), _id: input._id || new ObjectId() }; if(rows(name).some(prior=>equal(prior._id,row._id)))throw Object.assign(Error("QA duplicate id"),{code:11000}); if (name === "education_progress" && rows(name).some(prior=>equal(prior.ownerId,row.ownerId)&&prior.learnerProfileId===row.learnerProfileId))throw Object.assign(Error("QA duplicate progress"),{code:11000}); if (name === "education_submissions" && rows(name).some(prior => equal(prior.assignmentId, row.assignmentId) && equal(prior.learnerOwnerId, row.learnerOwnerId) && prior.learnerProfileId === row.learnerProfileId)) throw Object.assign(Error("QA duplicate submission"), { code: 11000 }); rows(name).push(row); return { insertedId: row._id }; },
      async updateOne(query, update, options = {}) { let row = rows(name).find(item => matches(item, query)), inserted = false; if (!row && options.upsert) { row = Object.fromEntries(Object.entries(query).filter(([key, value]) => !key.startsWith("$") && (!value || typeof value !== "object" || value instanceof ObjectId || value instanceof Date))); row._id ||= new ObjectId(); rows(name).push(row); inserted = true; } if (!row) return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 }; mutate(row, update, inserted); return { matchedCount: inserted ? 0 : 1, modifiedCount: inserted ? 0 : 1, upsertedCount: inserted ? 1 : 0, upsertedId: inserted ? row._id : null }; },
      async updateMany(query, update) { let count = 0; for (const row of rows(name)) if (matches(row, query)) { mutate(row, update); count++; } return { modifiedCount: count }; },
      async deleteMany(query = {}) { const data=rows(name);let count=0;for(let i=data.length-1;i>=0;i--)if(matches(data[i],query)){data.splice(i,1);count++;}return {deletedCount:count}; },
      async countDocuments(query = {}) { return rows(name).filter(row => matches(row, query)).length; }
    };
  } };
  return api;
}
module.exports = { createEducationMemoryDB, matches, copy };
