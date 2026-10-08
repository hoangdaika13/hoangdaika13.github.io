"use strict";
// Explicit QA-only database double; never used by production handlers.
function matches(row, query) {
  return Object.entries(query).every(([key, expected]) => {
    if (key === "$or") return expected.some(q => matches(row, q));
    const value = key.split(".").reduce((v, k) => v?.[k], row);
    if (expected && typeof expected === "object" && !(expected instanceof Date)) return Object.entries(expected).every(([op, v]) => op === "$gt" ? value > v : op === "$ne" ? value !== v : op === "$in" ? v.includes(value) : op === "$exists" ? (value !== undefined) === v : value === expected);
    return Array.isArray(value)?value.includes(expected):value === expected;
  });
}
class MemoryDb {
  constructor() { this.data = new Map(); }
  collection(name) {
    if (!this.data.has(name)) this.data.set(name, new Map());
    const store = this.data.get(name);
    return {
      createIndex: async () => "qa-index",
      countDocuments: async q => [...store.values()].filter(r => matches(r,q)).length,
      findOne: async q => structuredClone([...store.values()].find(r => matches(r,q)) || null),
      insertOne: async doc => { if(store.has(doc._id))throw Object.assign(Error("duplicate"),{code:11000});store.set(doc._id,structuredClone(doc));return {insertedId:doc._id}; },
      deleteOne:async query=>{const row=[...store.values()].find(row=>matches(row,query));if(row)store.delete(row._id);return {deletedCount:row?1:0};},
      deleteMany:async query=>{let count=0;for(const row of [...store.values()])if(matches(row,query)){store.delete(row._id);count++;}return {deletedCount:count};},
      updateMany:async(query,update)=>{let count=0;for(const row of store.values())if(matches(row,query)){Object.assign(row,structuredClone(update.$set||{}));count++;}return {matchedCount:count};},
      updateOne: async (query, update, options = {}) => {
        let row = [...store.values()].find(r => matches(r, query));
        if(!row && !options.upsert)return {matchedCount:0,modifiedCount:0};
        if(!row){if(store.has(query._id))throw Object.assign(Error("duplicate"),{code:11000});row={_id:query._id};store.set(row._id,row);}
        Object.assign(row,structuredClone(update.$set || {}));for(const[key,value]of Object.entries(update.$max||{}))if(row[key]===undefined||row[key]<value)row[key]=value;for(const[key,value]of Object.entries(update.$inc||{}))row[key]=(row[key]||0)+value;return {matchedCount:1,modifiedCount:1};
      },
      find(query, options = {}) {
        let rows = [...store.values()].filter(r => matches(r, query));
        return {
          sort(sort) { rows.sort((a,b)=>{for(const[key,direction]of Object.entries(sort)){const x=a[key],y=b[key];if(x>y)return direction;if(x<y)return -direction;}return 0;});return this; },
          limit(n) { rows=rows.slice(0,n);return this; },
          toArray: async () => structuredClone(options.projection ? rows.map(r=>Object.fromEntries(Object.entries(r).filter(([k])=>k==="_id"||options.projection[k]))) : rows)
        };
      }
    };
  }
}
module.exports = { MemoryDb };
