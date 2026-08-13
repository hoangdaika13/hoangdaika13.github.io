(function initHHSchoolOffline(root) {
  "use strict";
  const DB_NAME = "hh-school-offline-v1";
  const DB_VERSION = 1;
  const STORES = Object.freeze({ profiles: "profiles", packs: "curriculumPacks", queue: "syncQueue" });

  function open() {
    if (!root.indexedDB) return Promise.reject(Object.assign(new Error("IndexedDB không được trình duyệt hỗ trợ."), { code: "INDEXEDDB_UNAVAILABLE" }));
    return new Promise((resolve, reject) => {
      const request = root.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORES.profiles)) db.createObjectStore(STORES.profiles, { keyPath: "key" });
        if (!db.objectStoreNames.contains(STORES.packs)) db.createObjectStore(STORES.packs, { keyPath: "key" });
        if (!db.objectStoreNames.contains(STORES.queue)) {
          const queue = db.createObjectStore(STORES.queue, { keyPath: "id" });
          queue.createIndex("createdAt", "createdAt"); queue.createIndex("ownerProfile", "ownerProfile");
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Không mở được cơ sở dữ liệu offline."));
    });
  }

  async function transaction(storeName, mode, executor) {
    const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode); const store = tx.objectStore(storeName); let result;
        tx.oncomplete = () => resolve(result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error("Giao dịch offline bị hủy."));
        result = executor(store);
      });
    } finally { db.close(); }
  }
  const requestValue = (request) => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  const profileKey = (ownerId, learnerProfileId) => `${ownerId}:${learnerProfileId}`;
  const packKey = (version, grade) => `${version}:grade-${grade}`;

  const api = Object.freeze({
    DB_NAME, DB_VERSION, STORES, open,
    async saveProfile(ownerId, learnerProfileId, state) { const key = profileKey(ownerId, learnerProfileId); await transaction(STORES.profiles, "readwrite", (store) => store.put({ key, ownerId, learnerProfileId, state, updatedAt: new Date().toISOString() })); return key; },
    async loadProfile(ownerId, learnerProfileId) { const db = await open(); try { return await requestValue(db.transaction(STORES.profiles).objectStore(STORES.profiles).get(profileKey(ownerId, learnerProfileId))); } finally { db.close(); } },
    async savePack(pack) { const key = packKey(pack.version, pack.grade.number); await transaction(STORES.packs, "readwrite", (store) => store.put({ key, version: pack.version, grade: pack.grade.number, checksum: pack.checksum, pack, updatedAt: new Date().toISOString() })); return key; },
    async loadPack(version, grade, checksum = "") { const db = await open(); try { const record = await requestValue(db.transaction(STORES.packs).objectStore(STORES.packs).get(packKey(version, grade))); return record && (!checksum || record.checksum === checksum) ? record.pack : null; } finally { db.close(); } },
    async enqueue(ownerId, learnerProfileId, request) { const item = { id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ownerProfile: profileKey(ownerId, learnerProfileId), ownerId, learnerProfileId, request, attempts: 0, createdAt: Date.now() }; await transaction(STORES.queue, "readwrite", (store) => store.put(item)); try { await root.navigator?.serviceWorker?.ready?.then((registration) => registration.sync?.register?.("hh-school-progress")); } catch {} return item; },
    async listQueue() { const db = await open(); try { return await requestValue(db.transaction(STORES.queue).objectStore(STORES.queue).getAll()); } finally { db.close(); } },
    async removeQueue(id) { await transaction(STORES.queue, "readwrite", (store) => store.delete(id)); },
    async flush(sender) { const items = await api.listQueue(); const results = []; for (const item of items) { try { await sender(item.request); await api.removeQueue(item.id); results.push({ id: item.id, ok: true }); } catch (error) { results.push({ id: item.id, ok: false, error: error.message }); } } return results; }
  });
  root.HHSchoolOffline = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
