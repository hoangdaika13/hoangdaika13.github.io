"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const core = require("../hh-school-core.js"), education = require("../utils/education-handler.js").__test;
const user = { _id: "student-1", educationRole: "student", roles: [] };
const valid = () => core.defaultState({ currentUser: { id: user._id }, profile: { id: "learner-1", grade: 6 } });

test("server refuses cross-account/profile queued saves before any write or role normalization", () => {
  for (const changed of [{ ownerId: "other" }, { learnerProfileId: "other" }, { profile: { id: "other" } }]) assert.throws(() => education.sanitizeState({ ...valid(), ...changed }, user, "learner-1"), error => error.statusCode === 403 && error.code === "EDUCATION_STATE_OWNER_MISMATCH");
  const forged = { ...valid(), role: "platform-admin" };
  assert.equal(education.sanitizeState(forged, user, "learner-1").role, "student");
});

test("server preserves supported schema and rejects future/partial/oversized state without acknowledging sync", () => {
  const saved = education.sanitizeState(valid(), user, "learner-1");
  assert.equal(saved.schemaVersion, 3);
  assert.throws(() => education.sanitizeState({ ...valid(), schemaVersion: 9 }, user, "learner-1"), error => error.statusCode === 422);
  assert.throws(() => education.sanitizeState({ ...valid(), storageArchive: { required: true } }, user, "learner-1"), error => error.code === "EDUCATION_STATE_ARCHIVE_REQUIRED");
  const large = valid(); large.attempts = Array.from({ length: 400 }, (_, i) => ({ id: "attempt-" + i, answer: "a".repeat(1000) }));
  assert.throws(() => education.sanitizeState(large, user, "learner-1"), error => error.statusCode === 413 && /thiết bị.*chưa đồng bộ/.test(error.message));
  assert.equal(large.attempts.length, 400);
});

test("new learning work invalidates a previous cloud acknowledgement without losing a known conflict", async () => {
  const data=new Map(),store=core.createStore({currentUser:{id:user._id},storage:{getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)},offline:null});await store.ready;
  store.update(s=>{s.syncStatus="synced";s.serverRevision=4;},"sync:success");assert.equal(store.get().syncStatus,"synced");
  store.update(s=>{s.studyWorkspace.notes.lesson={text:"Offline learning note",updatedAt:s.updatedAt};},"lesson:note");assert.equal(store.get().syncStatus,"local-only");
  store.update(s=>{s.syncStatus="conflict";},"sync:conflict");store.update(s=>{s.preferences.dailyMinutes=35;},"plan:save");assert.equal(store.get().syncStatus,"conflict");
});

test("cloud content comparison ignores transport metadata but detects unsent notes, attempts and frozen exam answers",()=>{
  const server=valid(),local=JSON.parse(JSON.stringify(server));local.revision=22;local.serverRevision=7;local.updatedAt="2026-10-27T00:00:00Z";local.auditLogs=[{event:"sync"}];local.syncStatus="synced";assert.equal(core.sameLearningContent(local,server),true);
  for(const change of [s=>s.studyWorkspace.notes.l={text:"new note"},s=>s.attempts.push({id:"new-answer"}),s=>s.studyWorkspace.examSessions.e={answers:{q:"new"}}]){const changed=JSON.parse(JSON.stringify(local));change(changed);assert.equal(core.sameLearningContent(changed,server),false);}
});
