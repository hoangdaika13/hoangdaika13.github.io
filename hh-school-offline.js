(function initHHSchoolOffline(root) {
  "use strict";
  const DB_NAME = "hh-school-offline-v1";
  const DB_VERSION = 3;
  const STORES = Object.freeze({ profiles: "profiles", packs: "curriculumPacks", history: "curriculumHistory", queue: "syncQueue", files: "submissionFiles" });

  function open() {
    if (!root.indexedDB) return Promise.reject(Object.assign(new Error("IndexedDB không được trình duyệt hỗ trợ."), { code: "INDEXEDDB_UNAVAILABLE" }));
    return new Promise((resolve, reject) => {
      let rejected = false;
      const request = root.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORES.profiles)) db.createObjectStore(STORES.profiles, { keyPath: "key" });
        if (!db.objectStoreNames.contains(STORES.packs)) db.createObjectStore(STORES.packs, { keyPath: "key" });
        if (!db.objectStoreNames.contains(STORES.history)) db.createObjectStore(STORES.history, { keyPath: "key" });
        if (!db.objectStoreNames.contains(STORES.files)) db.createObjectStore(STORES.files, { keyPath: "key" });
        if (!db.objectStoreNames.contains(STORES.queue)) {
          const queue = db.createObjectStore(STORES.queue, { keyPath: "id" });
          queue.createIndex("createdAt", "createdAt"); queue.createIndex("ownerProfile", "ownerProfile");
        }
      };
      request.onblocked = () => { rejected = true; reject(Object.assign(new Error("Kho học tập đang chờ tab khác đóng để cập nhật; dữ liệu chưa bị xóa."), { code: "INDEXEDDB_BLOCKED" })); };
      request.onsuccess = () => { const db = request.result; if (rejected) { db.close(); return; } db.onversionchange = () => db.close(); resolve(db); };
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

  function validateProfile(ownerId, learnerProfileId, state) {
    if (!/^[a-zA-Z0-9._-]{1,100}$/.test(String(ownerId)) || !/^[a-zA-Z0-9._-]{1,100}$/.test(String(learnerProfileId)) || state?.ownerId !== ownerId || state?.learnerProfileId !== learnerProfileId || state?.profile?.id && state.profile.id !== learnerProfileId) throw Object.assign(new Error("Dữ liệu không khớp tài khoản và hồ sơ; chưa ghi hoặc đọc chéo."), { code: "STATE_OWNER_MISMATCH" });
    if (state.schemaVersion > 3 || state.studyWorkspace?.version !== undefined && state.studyWorkspace.version !== 1) throw Object.assign(new Error("Kho lịch sử thuộc phiên bản mới hơn; dữ liệu gốc được giữ."), { code: "STATE_VERSION_UNSUPPORTED" });
    if (!state || !Number.isInteger(state.schemaVersion) || state.schemaVersion < 1 || !state.progress || Array.isArray(state.progress) || typeof state.progress !== "object" || !state.mastery || Array.isArray(state.mastery) || typeof state.mastery !== "object" || !Array.isArray(state.attempts) || !Array.isArray(state.mistakes)) throw Object.assign(new Error("Kho lịch sử chưa hợp lệ; giữ bản gốc để phục hồi."), { code: "STATE_ARCHIVE_CORRUPT" });
    if (state.storageArchive?.required) throw Object.assign(new Error("Bản tóm tắt không được ghi đè kho lịch sử đầy đủ."), { code: "STATE_ARCHIVE_CORRUPT" });
  }
  async function saveProfile(ownerId, learnerProfileId, state) {
    validateProfile(ownerId, learnerProfileId, state);
    const db = await open(), key = profileKey(ownerId, learnerProfileId);
    try { await new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.profiles, "readwrite"), store = tx.objectStore(STORES.profiles);
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || Error("Ghi kho lịch sử bị hủy."));
      const fail = error => { try { tx.abort(); } catch {} reject(error); };
      const request = store.get(key);
      request.onsuccess = () => { try {
        const prior = request.result;
        if (prior?.archiveVersion > 1) throw Object.assign(new Error("Giữ nguyên kho lịch sử của phiên bản mới hơn."), { code: "STATE_VERSION_UNSUPPORTED" });
        if (prior) validateProfile(ownerId, learnerProfileId, prior.state);
        const context = { currentUser: { id: ownerId, educationRole: state.role }, profile: state.profile };
        const merged = prior && root.HHSchoolCore ? root.HHSchoolCore.mergeStates(state, prior.state, context) : state;
        store.put({ key, archiveVersion: 1, ownerId, learnerProfileId, state: merged, updatedAt: new Date().toISOString() });
      } catch (error) { if (request.result) error.recoveryRecord = request.result; fail(error); } };
    }); return key; } finally { db.close(); }
  }
  async function loadProfile(ownerId, learnerProfileId) {
    const db = await open(); try {
      const record = await requestValue(db.transaction(STORES.profiles).objectStore(STORES.profiles).get(profileKey(ownerId, learnerProfileId)));
      if (record) { try { if (record.archiveVersion > 1) throw Object.assign(new Error("Kho lịch sử của phiên bản mới hơn được bảo toàn."), { code: "STATE_VERSION_UNSUPPORTED" }); validateProfile(ownerId, learnerProfileId, record.state); } catch (error) { error.recoveryRecord = record; throw error; } }
      return record;
    } finally { db.close(); }
  }

  const api = Object.freeze({
    DB_NAME, DB_VERSION, STORES, open,
    saveProfile, loadProfile,
    async savePack(pack) { const key = packKey(pack.version, pack.grade.number); const existing = await api.loadPack(pack.version, pack.grade.number).catch(() => null); if (existing && existing.checksum !== pack.checksum) await transaction(STORES.history, "readwrite", (store) => store.put({ key: `${key}:${existing.checksum}`, version: existing.version, grade: existing.grade.number, checksum: existing.checksum, pack: existing, archivedAt: new Date().toISOString() })); await transaction(STORES.packs, "readwrite", (store) => store.put({ key, version: pack.version, grade: pack.grade.number, checksum: pack.checksum, pack, updatedAt: new Date().toISOString() })); return key; },
    async loadPack(version, grade, checksum = "") { const db = await open(); try { const record = await requestValue(db.transaction(STORES.packs).objectStore(STORES.packs).get(packKey(version, grade))); return record && (!checksum || record.checksum === checksum) ? record.pack : null; } finally { db.close(); } },
    async rollbackPack(version, grade, checksum) { const key = `${packKey(version, grade)}:${checksum}`; const db = await open(); try { const record = await requestValue(db.transaction(STORES.history).objectStore(STORES.history).get(key)); if (!record) throw new Error("Không tìm thấy phiên bản curriculum để rollback."); await api.savePack(record.pack); return record.pack; } finally { db.close(); } },
    async saveSubmissionFile(ownerId, learnerProfileId, file) {
      if (!(file instanceof Blob) || !file.size) throw new Error("Tệp bài làm không hợp lệ.");
      if (file.size > 10 * 1024 * 1024) throw new Error("Tệp bài làm vượt giới hạn 10 MB.");
      if (!["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Chỉ nhận PDF, PNG, JPEG hoặc WebP.");
      const key = `${profileKey(ownerId, learnerProfileId)}:file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const record = { key, ownerId, learnerProfileId, name: String(file.name || "bai-lam").slice(0, 160), type: file.type, size: file.size, blob: file, createdAt: new Date().toISOString(), syncStatus: "device-only" };
      await transaction(STORES.files, "readwrite", (store) => store.put(record));
      return { key, name: record.name, type: record.type, size: record.size, syncStatus: record.syncStatus };
    },
    async loadSubmissionFile(key) { const db = await open(); try { return await requestValue(db.transaction(STORES.files).objectStore(STORES.files).get(key)); } finally { db.close(); } },
    async enqueue(ownerId, learnerProfileId, request) {
      const ownerProfile = profileKey(ownerId, learnerProfileId), target = String(request?.url || "");
      if (!/^\/api\/education\/[a-z-]+$/.test(target)) throw Object.assign(new Error("Đích đồng bộ HH School không hợp lệ."), { code: "SYNC_TARGET_INVALID" });
      const isProgressSave = target === "/api/education/progress" && String(request?.method || "PUT").toUpperCase() === "PUT";
      if (isProgressSave) { const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body; if (body?.state?.ownerId !== ownerId || body?.learnerProfileId !== learnerProfileId || body?.state?.learnerProfileId !== learnerProfileId) throw Object.assign(new Error("Hàng đợi không khớp tài khoản/hồ sơ."), { code: "STATE_OWNER_MISMATCH" }); }
      const item = { id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ownerProfile, ownerId, learnerProfileId, request, attempts: 0, maxAttempts: 5, syncStatus: "queued", createdAt: Date.now() };
      const db = await open();
      try { await new Promise((resolve, reject) => { const tx = db.transaction(STORES.queue, "readwrite"), store = tx.objectStore(STORES.queue); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || Error("Chưa ghi được hàng đợi.")); const all = store.getAll(); all.onsuccess = () => { try { const sameProfile = all.result.filter(row => row.ownerProfile === ownerProfile), superseded = isProgressSave ? sameProfile.filter(row => row.request?.url === target && String(row.request?.method || "PUT").toUpperCase() === "PUT" && row.syncStatus !== "needs-resolution") : []; if (sameProfile.length - superseded.length >= 20) throw Object.assign(new Error("Hàng đợi đồng bộ đã đạt giới hạn 20 tác vụ."), { code: "SYNC_QUEUE_LIMIT" }); for (const prior of superseded) store.delete(prior.id); store.put(item); } catch (error) { try { tx.abort(); } catch {} reject(error); } }; }); } finally { db.close(); }
      try { void root.navigator?.serviceWorker?.ready?.then(registration => registration.sync?.register?.("hh-school-progress")).catch(() => {}); } catch {}
      return item;
    },
    async listQueue() { const db = await open(); try { return await requestValue(db.transaction(STORES.queue).objectStore(STORES.queue).getAll()); } finally { db.close(); } },
    async removeQueue(id) { await transaction(STORES.queue, "readwrite", (store) => store.delete(id)); },
    async clearAcknowledged(snapshot) {
      validateProfile(snapshot?.ownerId, snapshot?.learnerProfileId, snapshot);
      const C = root.HHSchoolCore; if (!C?.sameLearningContent) return 0;
      const items = (await api.listQueue()).filter(item => item.ownerId === snapshot.ownerId && item.learnerProfileId === snapshot.learnerProfileId && item.syncStatus !== "needs-resolution" && item.request?.url === "/api/education/progress"); let removed = 0;
      for (const item of items) { try { const body = typeof item.request.body === "string" ? JSON.parse(item.request.body) : item.request.body; validateProfile(snapshot.ownerId, snapshot.learnerProfileId, body?.state); const merged = C.mergeStates(body.state, snapshot, { currentUser: { id: snapshot.ownerId, educationRole: snapshot.role }, profile: snapshot.profile }); if (C.sameLearningContent(merged, snapshot)) { await api.removeQueue(item.id); removed++; } } catch {} }
      return removed;
    },
    async clearConflicts(ownerId, learnerProfileId) { const ownerProfile = profileKey(ownerId, learnerProfileId); const items = await api.listQueue(); const conflicts = items.filter((item) => item.ownerProfile === ownerProfile && item.syncStatus === "needs-resolution"); await Promise.all(conflicts.map((item) => api.removeQueue(item.id))); return conflicts.length; },
    async flush(sender, scope = {}) { if (root.document?.hidden) return []; if (!scope.ownerId || !scope.learnerProfileId) throw Object.assign(new Error("Cần xác minh tài khoản và hồ sơ trước khi gửi hàng đợi."), { code: "SYNC_OWNER_REQUIRED" }); const items = (await api.listQueue()).filter(item => item.ownerId === scope.ownerId && item.learnerProfileId === scope.learnerProfileId); const results = []; for (const item of items) { if (item.syncStatus === "needs-resolution") { results.push({ id: item.id, ok: false, conflict: true, error: item.lastError || "Cần giải quyết xung đột đồng bộ." }); continue; } if (item.attempts >= (item.maxAttempts || 5)) { results.push({ id: item.id, ok: false, terminal: true, error: "Đã vượt số lần thử đồng bộ." }); continue; } try { await sender(item.request); await api.removeQueue(item.id); results.push({ id: item.id, ok: true }); } catch (error) { const conflict = Number(error?.status) === 409; await transaction(STORES.queue, "readwrite", (store) => store.put({ ...item, attempts: conflict ? item.attempts : item.attempts + 1, syncStatus: conflict ? "needs-resolution" : "queued", conflict: conflict ? error.data?.conflict || null : item.conflict, lastError: error.message, lastAttemptAt: Date.now() })); results.push({ id: item.id, ok: false, conflict, error: error.message }); } } return results; }
  });
  root.HHSchoolOffline = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
