/* Local-first storage; an acknowledged IDB transaction is the durable save boundary. */
(function (root, factory) { const api = factory(root, typeof module === 'object' && module.exports ? require('./hh-multiverse-model') : root.HHMultiverseModel); if (typeof module === 'object' && module.exports)
    module.exports = api;
else
    root.HHMultiverseStore = api; })(typeof globalThis !== 'undefined' ? globalThis : this, function (root, M) {
    'use strict';
    const ownerKey = user => 'hh.multiverse.workspace.v1:' + encodeURIComponent(String(user?.id || user?._id || 'guest'));
    function create(user, options = {}) {
        const owner = ownerKey(user), memory = new Map();
        let db = null, closed = false, memoryOnly = false, error = '';
        const idb = options.indexedDB === undefined ? root.indexedDB : options.indexedDB;
        const ready = new Promise(resolve => { if (!idb) {
            memoryOnly = true;
            error = 'IndexedDB chưa khả dụng; đang giữ dữ liệu trong phiên.';
            resolve();
            return;
        } let request; try {
            request = idb.open('hh.multiverse.v1', 1);
        }
        catch (e) {
            memoryOnly = true;
            error = e.message;
            resolve();
            return;
        } request.onupgradeneeded = () => { const d = request.result; if (!d.objectStoreNames.contains('universes')) {
            const s = d.createObjectStore('universes', { keyPath: ['owner', 'id'] });
            s.createIndex('owner', 'owner');
        } }; request.onerror = () => { memoryOnly = true; error = 'Chưa mở được bộ nhớ; bản trong phiên vẫn có thể xuất JSON.'; resolve(); }; request.onblocked = () => { memoryOnly = true; error = 'Bộ nhớ đang chờ tab khác. Bản trong phiên chưa được lưu bền vững.'; resolve(); }; request.onsuccess = () => { if (closed || memoryOnly) {
            request.result.close();
            resolve();
            return;
        } db = request.result; db.onversionchange = () => { db.close(); db = null; memoryOnly = true; error = 'Bộ nhớ đã đổi phiên bản; hãy xuất bản đang làm trước khi đóng trang.'; }; resolve(); }; });
        const operation = (mode, fn) => new Promise((resolve, reject) => { if (!db)
            return reject(Error('Bộ nhớ chưa sẵn sàng.')); const tx = db.transaction('universes', mode), s = tx.objectStore('universes'); let result; try {
            const request = fn(s);
            if (request)
                request.onsuccess = () => { result = request.result; };
        }
        catch (e) {
            tx.abort();
            return reject(e);
        } tx.oncomplete = () => resolve(result); tx.onerror = () => reject(tx.error || Error('Chưa hoàn tất giao dịch lưu.')); tx.onabort = () => reject(tx.error || Error('Giao dịch lưu đã hủy.')); });
        async function get(id) { await ready; if (memory.has(id))
            return M.clone(memory.get(id)); if (!db)
            return null; return await operation('readonly', s => s.get([owner, M.id(id)])) || null; }
        async function list() { await ready; let rows = []; if (db)
            try {
                rows = await operation('readonly', s => s.index('owner').getAll(owner));
            }
            catch (e) {
                error = e.message;
            } const merged = new Map(rows.map(r => [r.id, r])); for (const [k, v] of memory)
            merged.set(k, v); return [...merged.values()].map(r => M.clone(r)).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt))); }
        async function put(raw, metadata = {}) {
            await ready;
            const world = M.universe(raw), existing = await get(world.id);
            if (existing && existing.version !== 1)
                M.fail('Bản đã lưu thuộc phiên bản khác; không ghi đè.');
            const expected = metadata.expectedLocalRevision ?? existing?.localRevision ?? 0;
            const check = old => { if ((old?.localRevision || 0) !== expected)
                throw Object.assign(Error('Tab khác đã lưu thay đổi. Bản đang làm được giữ; hãy xuất JSON rồi mở lại bản thư viện để đối chiếu.'), { code: 'LOCAL_CONFLICT' }); if (old && old.version !== 1)
                M.fail('Không ghi đè phiên bản chưa được hỗ trợ.'); };
            check(existing);
            if (!existing && (await list()).length >= 20)
                M.fail('Tối đa20 vũ trụ trên một tài khoản/thiết bị. Hãy xuất hoặc xóa bớt.');
            const row = { version: 1, owner, id: world.id, world, localRevision: expected + 1, cloudRevision: Number.isInteger(metadata.cloudRevision) ? metadata.cloudRevision : existing?.cloudRevision || 0, cloudUpdatedAt: metadata.cloudUpdatedAt || existing?.cloudUpdatedAt || '', savedAt: new Date().toISOString(), durable: false };
            if (db && !memoryOnly) {
                try {
                    row.durable = true;
                    await new Promise((resolve, reject) => { const tx = db.transaction('universes', 'readwrite'), s = tx.objectStore('universes'), request = s.get([owner, row.id]); let failure; request.onsuccess = () => { try {
                        check(request.result);
                        s.put(row);
                    }
                    catch (e) {
                        failure = e;
                        tx.abort();
                    } }; tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(failure || tx.error || Error('Chưa hoàn tất giao dịch.')); });
                    memory.delete(row.id);
                    return M.clone(row);
                }
                catch (e) {
                    if (e.code === 'LOCAL_CONFLICT')
                        throw e;
                    row.durable = false;
                    memoryOnly = true;
                    error = 'Chưa lưu bền vững: ' + String(e.message || 'hết dung lượng') + '. Hãy xuất JSON trước khi đóng trang.';
                }
            }
            memory.set(row.id, row);
            return M.clone(row);
        }
        async function remove(id) { await ready; M.id(id); if (db)
            await operation('readwrite', s => s.delete([owner, id])); memory.delete(id); }
        return { owner, ready, get, list, put, remove, status: () => ({ memoryOnly, error, available: Boolean(db) }), close() { closed = true; db?.close(); db = null; } };
    }
    return { ownerKey, create };
});
