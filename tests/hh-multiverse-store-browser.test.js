'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
test('native IndexedDB transactions protect cross-tab edits, future records, account boundaries and quota recovery', { skip: !process.env.HH_QA_PLAYWRIGHT, timeout: 45000 }, async () => {
    const { chromium } = require(process.env.HH_QA_PLAYWRIGHT), allowed = new Set(['hh-multiverse-model.js', 'hh-multiverse-engine.js', 'hh-multiverse-store.js']);
    const server = http.createServer((req, res) => { const name = req.url.slice(1); if (allowed.has(name)) {
        res.setHeader('Content-Type', 'text/javascript');
        return res.end(fs.readFileSync(path.join(__dirname, '..', name)));
    } res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><script src="/hh-multiverse-model.js"></script><script src="/hh-multiverse-engine.js"></script><script src="/hh-multiverse-store.js"></script>'); });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    let browser;
    try {
        browser = await chromium.launch({ headless: true, executablePath: process.env.HH_QA_CHROMIUM });
        const page = await browser.newPage();
        await page.goto('http://127.0.0.1:' + server.address().port);
        const result = await page.evaluate(async () => {
            const E = HHMultiverseEngine, S = HHMultiverseStore, M = HHMultiverseModel, a = S.create({ id: 'alpha' }), b = S.create({ id: 'alpha' }), other = S.create({ id: 'beta' }), w = E.create('Nếu có hai Mặt Trăng?', {}, { id: 'native-store' }), saved = await a.put(w, { expectedLocalRevision: 0 });
            const race = await Promise.allSettled([a.put(E.advance(w, 1), { expectedLocalRevision: 1 }), b.put(E.advance(w, 30), { expectedLocalRevision: 1 })]);
            const winners = race.filter(r => r.status === 'fulfilled'), losers = race.filter(r => r.status === 'rejected');
            const current = await b.get(w.id);
            const db = await new Promise((r, j) => { const q = indexedDB.open('hh.multiverse.v1', 1); q.onsuccess = () => r(q.result); q.onerror = j; });
            const future = { version: 99, owner: a.owner, id: 'future-world', world: { schemaVersion: 99, name: 'Keep original' }, savedAt: new Date().toISOString() };
            await new Promise((r, j) => { const tx = db.transaction('universes', 'readwrite'); tx.objectStore('universes').put(future); tx.oncomplete = r; tx.onerror = j; });
            let protectedError = '';
            try {
                await a.put({ ...w, id: 'future-world' });
            }
            catch (e) {
                protectedError = e.message;
            }
            const original = await a.get('future-world');
            const realPut = IDBObjectStore.prototype.put;
            IDBObjectStore.prototype.put = function () { throw new DOMException('Explicit native quota fixture', 'QuotaExceededError'); };
            let memory;
            try {
                memory = await b.put(E.advance(current.world, 365), { expectedLocalRevision: current.localRevision });
            }
            finally {
                IDBObjectStore.prototype.put = realPut;
            }
            const clean = S.create({ id: 'alpha' }), restored = await clean.get(w.id), otherRows = await other.list();
            const output = { savedDurable: saved.durable, winners: winners.length, losers: losers.length, conflict: losers[0]?.reason.code, protectedError, original, quotaDurable: memory.durable, quotaMessage: b.status().error, memoryDays: E.snapshot((await b.get(w.id)).world).day, diskDays: E.snapshot(restored.world).day, otherRows: otherRows.length, roundtrip: M.parse(M.serialize(memory.world)).id };
            for (const store of [a, b, clean, other])
                store.close();
            db.close();
            return output;
        });
        assert.equal(result.savedDurable, true);
        assert.equal(result.winners, 1);
        assert.equal(result.losers, 1);
        assert.equal(result.conflict, 'LOCAL_CONFLICT');
        assert.ok(result.protectedError);
        assert.equal(result.original.world.schemaVersion, 99);
        assert.equal(result.quotaDurable, false);
        assert.match(result.quotaMessage, /JSON/);
        assert.ok(result.memoryDays > result.diskDays);
        assert.equal(result.otherRows, 0);
        assert.equal(result.roundtrip, 'native-store');
    }
    finally {
        await browser?.close();
        await new Promise(r => server.close(r));
    }
});
