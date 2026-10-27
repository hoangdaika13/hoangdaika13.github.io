"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), http = require("node:http");

test("native IndexedDB migrates long school history, isolates profiles and atomically preserves future archives and queues", { skip: !process.env.HH_QA_PLAYWRIGHT, timeout: 30000 }, async () => {
  const { chromium } = require(process.env.HH_QA_PLAYWRIGHT);
  const server = http.createServer((req, res) => {
    const name = ["core", "offline"].find(file => req.url === "/" + file + ".js");
    res.setHeader("Content-Type", name ? "text/javascript" : "text/html");
    res.end(name ? fs.readFileSync(path.resolve(__dirname, "../hh-school-" + name + ".js")) : '<!doctype html><script src="/core.js"></script><script src="/offline.js"></script>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.HH_QA_CHROMIUM ? { executablePath: process.env.HH_QA_CHROMIUM } : {}) });
    const page = await browser.newPage();
    await page.goto("http://127.0.0.1:" + server.address().port);
    const result = await page.evaluate(async () => {
      const C = HHSchoolCore, O = HHSchoolOffline, context = { currentUser: { id: "alice" }, profile: { id: "child-1", grade: 6 } }, state = C.defaultState(context);
      for (let i = 0; i < 2200; i++) { state.progress["l-" + i] = { status: "viewed" }; state.mastery["s-" + i] = { score: i % 100 }; state.attempts.push({ id: "a-" + i }); state.mistakes.push({ id: "m-" + i, questionId: "q-" + i }); }
      const legacy = await new Promise((resolve, reject) => { const request = indexedDB.open(O.DB_NAME, 2); request.onupgradeneeded = () => request.result.createObjectStore("profiles", { keyPath: "key" }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      await new Promise((resolve, reject) => { const tx = legacy.transaction("profiles", "readwrite"); tx.objectStore("profiles").put({ key: "alice:child-1", ownerId: "alice", learnerProfileId: "child-1", state }); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); legacy.close();
      const migrated = await O.loadProfile("alice", "child-1");
      if (migrated.state.attempts.length !== 2200 || Object.keys(migrated.state.progress).length !== 2200) throw Error("Migration dropped history");
      if (await O.loadProfile("bob", "child-1")) throw Error("Owner history leaked");
      if (await O.loadProfile("alice", "child-2")) throw Error("Profile history leaked");
      let mismatch = false; try { await O.saveProfile("bob", "child-1", state); } catch (error) { mismatch = error.code === "STATE_OWNER_MISMATCH"; }
      if (!mismatch) throw Error("Wrong owner accepted");
      const one = JSON.parse(JSON.stringify(state)), two = JSON.parse(JSON.stringify(state)); one.attempts.push({ id: "tab-one" }); two.attempts.push({ id: "tab-two" });
      await Promise.all([O.saveProfile("alice", "child-1", one), O.saveProfile("alice", "child-1", two)]);
      const both = await O.loadProfile("alice", "child-1"); if (both.state.attempts.length !== 2202) throw Error("Concurrent tabs lost attempt history");
      const raw = await O.open(), future = { key: "alice:child-1", archiveVersion: 9, ownerId: "alice", learnerProfileId: "child-1", state: { ...state, schemaVersion: 9 } };
      await new Promise((resolve, reject) => { const tx = raw.transaction("profiles", "readwrite"); tx.objectStore("profiles").put(future); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
      let protectedWrite = false; try { await O.saveProfile("alice", "child-1", state); } catch (error) { protectedWrite = error.code === "STATE_VERSION_UNSUPPORTED"; }
      const preserved = await new Promise(resolve => { const request = raw.transaction("profiles").objectStore("profiles").get("alice:child-1"); request.onsuccess = () => resolve(request.result); }); raw.close();
      if (!protectedWrite || JSON.stringify(preserved) !== JSON.stringify(future)) throw Error("Future archive overwritten");
      const protectedStore = C.createStore({ ...context, offline: O, storage: { getItem: () => null, setItem() { throw Error("Protected save must not write"); } } }); await protectedStore.ready;
      if (protectedStore.getPersistence().status !== "protected" || protectedStore.getRecoveryData().archiveRaw !== JSON.stringify(future)) throw Error("Native future archive recovery mismatch");
      let recoveryOnly = false; try { protectedStore.export(); } catch (error) { recoveryOnly = error.code === "STATE_PROTECTED"; } if (!recoveryOnly) throw Error("Exported fallback as a backup");

      const queueState = C.defaultState({ currentUser: { id: "queue-owner" }, profile: { id: "child-1" } });
      const request = { url: "/api/education/progress", method: "PUT", body: { learnerProfileId: "child-1", state: queueState } };
      await O.enqueue("queue-owner", "child-1", request);
      const nativePut = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function () { throw new DOMException("QA quota exhausted", "QuotaExceededError"); };
      let quotaFailed = false; try { await O.enqueue("queue-owner", "child-1", request); } catch { quotaFailed = true; } finally { IDBObjectStore.prototype.put = nativePut; }
      if (!quotaFailed || (await O.listQueue()).filter(row => row.ownerId === "queue-owner").length !== 1) throw Error("Failed queue replacement discarded previous save");
      await O.enqueue("other-owner", "child-1", { ...request, body: { learnerProfileId: "child-1", state: C.defaultState({ currentUser: { id: "other-owner" }, profile: { id: "child-1" } }) } });
      let scopeRequired = false; try { await O.flush(async () => {}); } catch (error) { scopeRequired = error.code === "SYNC_OWNER_REQUIRED"; }
      let sent = 0; await O.flush(async value => { if (value.body.state.ownerId !== "queue-owner") throw Error("Cross-account queue sent"); sent++; }, { ownerId: "queue-owner", learnerProfileId: "child-1" });
      if (!scopeRequired || sent !== 1 || !(await O.listQueue()).some(row => row.ownerId === "other-owner")) throw Error("Queue scope failed");
      await O.enqueue("queue-owner", "child-1", request);
      const acknowledged = C.normalizeState({ ...queueState, updatedAt: new Date(Date.now()+1000).toISOString() }, { currentUser: { id: "queue-owner" }, profile: queueState.profile }); acknowledged.studyWorkspace.notes.lesson={text:"Newer note included in confirmed cloud snapshot",updatedAt:acknowledged.updatedAt};
      if (await O.clearAcknowledged(acknowledged)!==1 || !(await O.listQueue()).some(row=>row.ownerId==="other-owner")) throw Error("Confirmed snapshot must prune covered retries without touching another account");
      const independent=JSON.parse(JSON.stringify(queueState));independent.attempts.push({id:"another-tab-not-yet-synced"});await O.enqueue("queue-owner","child-1",{...request,body:{learnerProfileId:"child-1",state:independent}});
      if (await O.clearAcknowledged(acknowledged)!==0 || !(await O.listQueue()).some(row=>row.ownerId==="queue-owner")) throw Error("Acknowledgement discarded unique queued work from another tab");
      return { migratedHistory: migrated.state.attempts.length, mergedHistory: both.state.attempts.length, protectedWrite, quotaFailed, scopeRequired, sent };
    });
    assert.deepEqual(result, { migratedHistory: 2200, mergedHistory: 2202, protectedWrite: true, quotaFailed: true, scopeRequired: true, sent: 1 });
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
});
