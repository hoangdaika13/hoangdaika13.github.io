/* GLITCHVERSE structured data boundary. All numbers describe a fictional toy model. */
(function (root, factory) { const api = factory(); if (typeof module === 'object' && module.exports)
    module.exports = api;
else
    root.HHMultiverseModel = api; })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const VERSION = 1, MAX_BYTES = 750000, MAX_SNAPSHOTS = 48, MAX_BRANCHES = 12;
    const MODES = ['realistic', 'fantasy', 'sci-fi', 'chaos', 'custom'], APPS = ['home', 'news', 'social', 'search', 'market', 'encyclopedia', 'map', 'trends', 'archives'];
    const METRICS = ['population', 'technology', 'stability', 'economy', 'environment', 'wellbeing', 'education', 'energy', 'culture'];
    const fail = m => { throw Object.assign(Error(m), { code: 'MULTIVERSE_INVALID' }); };
    const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
    function safeTree(value) { let count = 0; function visit(v, depth) { if (++count > 45000 || depth > 24)
        fail('Dữ liệu quá phức tạp.'); if (v === null || typeof v === 'boolean')
        return; if (typeof v === 'number') {
        if (!Number.isFinite(v))
            fail('Số liệu chưa hợp lệ.');
        return;
    } if (typeof v === 'string') {
        if (v.length > 16000)
            fail('Văn bản vượt giới hạn.');
        return;
    } if (Array.isArray(v)) {
        if (v.length > 1000)
            fail('Danh sách vượt giới hạn.');
        v.forEach(x => visit(x, depth + 1));
        return;
    } if (!plain(v))
        fail('Cấu trúc JSON chưa hợp lệ.'); for (const [k, x] of Object.entries(v)) {
        if (['__proto__', 'prototype', 'constructor'].includes(k) || k.length > 160)
            fail('Khóa dữ liệu không được hỗ trợ.');
        visit(x, depth + 1);
    } } visit(value, 0); return value; }
    function text(v, max = 1000, required = true) { if (typeof v !== 'string' || v.length > max || required && !v.trim())
        fail('Thiếu nội dung hoặc văn bản quá dài.'); return v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').trim(); }
    const id = v => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9:_-]{0,119}$/.test(v) ? v : fail('ID chưa hợp lệ.');
    const number = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : fail('Thông số mô phỏng ngoài giới hạn.');
    const integer = (v, min, max) => Number.isInteger(v) ? number(v, min, max) : fail('Cần số nguyên.');
    const list = (v, min, max) => Array.isArray(v) && v.length >= min && v.length <= max ? v : fail('Số phần tử chưa hợp lệ.');
    const unique = (v, key = x => x) => new Set(v.map(key)).size === v.length ? v : fail('ID hoặc mục dữ liệu bị trùng.');
    const clone = v => JSON.parse(JSON.stringify(v));
    const fold = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
    function settings(v = {}) {
        if (!v || typeof v !== 'object' || Array.isArray(v))
            fail('Thiết lập phải là một đối tượng.');
        const rules = text(v.customRules || '', 1200, false).split('\n').map(rule => rule.trim()).filter(Boolean);
        if (rules.length > 6 || rules.some(rule => rule.length > 600))
            fail('Tối đa6 quy tắc, mỗi quy tắc tối đa600 ký tự.');
        return {
            mode: MODES.includes(v.mode) ? v.mode : 'sci-fi',
            creativity: integer(v.creativity ?? 65, 0, 100),
            complexity: v.complexity === 'rich' ? 'rich' : 'compact',
            epochYear: integer(v.epochYear ?? 2026, -2000, 9000),
            theme: text(v.theme || 'Khám phá', 100),
            language: v.language === 'en' ? 'en' : 'vi',
            focus: ['science', 'economy', 'society'].includes(v.focus) ? v.focus : 'society',
            customRules: rules.join('\n')
        };
    }
    function metrics(v) { return Object.fromEntries(METRICS.map(k => [k, k === 'population' ? integer(v[k], 1, 9000000000) : number(v[k], 0, 100)])); }
    function blueprint(v) {
        safeTree(v);
        if (!plain(v))
            fail('Chưa có bản thiết kế thế giới.');
        const locations = unique(list(v.locations, 2, 8).map(l => ({ id: id(l.id), name: text(l.name, 90), description: text(l.description, 800), x: number(l.x, 4, 96), y: number(l.y, 8, 92) })), x => x.id), locs = new Set(locations.map(l => l.id));
        const characters = unique(list(v.characters, 2, 8).map(c => ({ id: id(c.id), name: text(c.name, 80), role: text(c.role, 100), profession: text(c.profession, 100), personality: text(c.personality, 400), goal: text(c.goal, 500), belief: text(c.belief, 500), locationId: id(c.locationId), relationships: list(c.relationships || [], 0, 8).map(id) })), x => x.id), chars = new Set(characters.map(c => c.id));
        if (characters.some(c => !locs.has(c.locationId) || c.relationships.some(r => !chars.has(r) || r === c.id)))
            fail('Quan hệ hoặc địa điểm nhân vật chưa khớp.');
        return { name: text(v.name, 100), overview: text(v.overview, 1800), physics: text(v.physics, 1400), society: text(v.society, 1400), technology: text(v.technology, 1400), economy: text(v.economy, 1400), culture: text(v.culture, 1400), politics: text(v.politics, 1400), rules: list(v.rules, 2, 10).map(r => text(r, 600)), possibilities: list(v.possibilities, 1, 8).map(r => text(r, 600)), locations, characters, organizations: unique(list(v.organizations, 1, 8).map(o => ({ id: id(o.id), name: text(o.name, 90), description: text(o.description, 700), locationId: locs.has(o.locationId) ? o.locationId : fail('Tổ chức chưa khớp địa điểm.') })), o => o.id), products: unique(list(v.products, 2, 10).map(p => ({ id: id(p.id), name: text(p.name, 100), description: text(p.description, 700), price: integer(p.price, 1, 1000), locationId: locs.has(p.locationId) ? p.locationId : fail('Sản phẩm chưa khớp nơi sản xuất.') })), p => p.id), initialMetrics: metrics(v.initialMetrics) };
    }
    function browser(v = {}) {
        const tabs = unique(list(v.tabs || [{ id: 'tab-home', history: ['sim://home'], cursor: 0 }], 1, 8).map(t => ({ id: id(t.id), history: list(t.history, 1, 60).map(address), cursor: integer(t.cursor, 0, t.history.length - 1) })), t => t.id);
        return { tabs, activeTab: tabs.some(t => t.id === v.activeTab) ? v.activeTab : tabs[0].id, bookmarks: unique(list(v.bookmarks || [], 0, 60).map(b => ({ address: address(b.address), title: text(b.title, 160) })), b => b.address), history: list(v.history || [], 0, 100).map(h => ({ address: address(h.address), at: stamp(h.at) })) };
    }
    function address(v) { if (typeof v !== 'string' || v.length > 500 || !/^sim:\/\/(home|news|social|search|market|encyclopedia|map|trends|archives)(?:\/[A-Za-z0-9:_-]+)?(?:\?q=[^#]*)?$/.test(v))
        fail('Chỉ dùng địa chỉ sim:// của Internet giả tưởng.'); return v; }
    const stamp = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v)) ? v : fail('Thời điểm lưu chưa hợp lệ.');
    function universe(raw) {
        safeTree(raw);
        if (!plain(raw) || raw.schemaVersion !== VERSION || raw.fictional !== true)
            fail('Phiên bản vũ trụ chưa hỗ trợ; hãy giữ bản gốc.');
        const b = blueprint(raw.blueprint), locs = new Set(b.locations.map(l => l.id)), chars = new Set(b.characters.map(c => c.id));
        const events = unique(list(raw.events, 1, 180).map(e => ({ id: id(e.id), snapshotId: id(e.snapshotId), branchId: id(e.branchId), day: integer(e.day, 0, 3650000), kind: text(e.kind, 40), title: text(e.title, 160), description: text(e.description, 1400), locationIds: list(e.locationIds || [], 0, 8).map(id), characterIds: list(e.characterIds || [], 0, 8).map(id), causes: unique(list(e.causes || [], 0, 12).map(id)), effects: plain(e.effects) ? Object.fromEntries(Object.entries(e.effects).map(([k, v]) => [METRICS.includes(k) ? k : fail('Chỉ số tác động không có trong mô hình.'), number(v, -9000000000, 9000000000)])) : {} })), e => e.id);
        const snapshots = unique(list(raw.snapshots, 1, MAX_SNAPSHOTS).map(s => ({ id: id(s.id), parentId: s.parentId === null ? null : id(s.parentId), branchId: id(s.branchId), day: integer(s.day, 0, 3650000), metrics: metrics(s.metrics), locations: Object.fromEntries(b.locations.map(l => [l.id, ['active', 'strained', 'destroyed'].includes(s.locations?.[l.id]) ? s.locations[l.id] : fail('Thiếu trạng thái địa điểm.')])), eventIds: unique(list(s.eventIds, 1, 180).map(id)), wallet: integer(s.wallet, 0, 1000000), inventory: list(s.inventory || [], 0, 100).map(p => ({ productId: id(p.productId), quantity: integer(p.quantity, 1, 100) })), policies: list(s.policies || [], 0, 50).map(p => text(p, 1200)), note: text(s.note || '', 1400, false) })), s => s.id);
        const branches = unique(list(raw.branches, 1, MAX_BRANCHES).map(b => ({ id: id(b.id), name: text(b.name, 100), parentId: b.parentId === null ? null : id(b.parentId), forkSnapshotId: b.forkSnapshotId === null ? null : id(b.forkSnapshotId), headId: id(b.headId), createdAt: stamp(b.createdAt) })), b => b.id);
        const sm = new Map(snapshots.map(s => [s.id, s])), em = new Map(events.map(e => [e.id, e])), bm = new Map(branches.map(b => [b.id, b]));
        function ancestry(node, map, parent) { const seen = new Set(); let n = node; while (n) {
            if (seen.has(n.id))
                fail('Đồ thị lịch sử có vòng lặp.');
            seen.add(n.id);
            const p = n[parent];
            if (p && !map.has(p))
                fail('Thiếu nút cha.');
            n = p ? map.get(p) : null;
        } return seen; }
        if (branches.filter(b => !b.parentId).length !== 1 || snapshots.filter(s => !s.parentId).length !== 1)
            fail('Cần đúng một nhánh và snapshot gốc.');
        for (const branch of branches) {
            ancestry(branch, bm, 'parentId');
            const head = sm.get(branch.headId);
            if (!head || head.branchId !== branch.id || branch.parentId && !sm.has(branch.forkSnapshotId))
                fail('Nhánh không khớp snapshot.');
            if (branch.parentId && (!ancestry(head, sm, 'parentId').has(branch.forkSnapshotId) || !ancestry(sm.get(bm.get(branch.parentId).headId), sm, 'parentId').has(branch.forkSnapshotId)))
                fail('Nhánh không kế thừa mốc đã chọn.');
        }
        for (const s of snapshots) {
            const ancestors = ancestry(s, sm, 'parentId');
            if (!bm.has(s.branchId) || s.parentId && sm.get(s.parentId).day > s.day)
                fail('Thứ tự thời gian không hợp lệ.');
            for (const eid of s.eventIds) {
                const e = em.get(eid);
                if (!e || !ancestors.has(e.snapshotId) || e.day > s.day)
                    fail('Snapshot chứa sự kiện tương lai hoặc nhánh khác.');
            }
            if (s.inventory.some(p => !b.products.some(x => x.id === p.productId)))
                fail('Vật phẩm không thuộc vũ trụ.');
        }
        for (const e of events) {
            if (!sm.has(e.snapshotId) || !bm.has(e.branchId) || !sm.get(e.snapshotId).eventIds.includes(e.id) || e.locationIds.some(x => !locs.has(x)) || e.characterIds.some(x => !chars.has(x)) || e.causes.some(x => !em.has(x) || em.get(x).day > e.day || !sm.get(e.snapshotId).eventIds.includes(x)))
                fail('Quan hệ sự kiện không hợp lệ.');
        }
        const visiting = new Set(), visited = new Set();
        function checkCause(e) { if (visiting.has(e.id))
            fail('Đồ thị nguyên nhân có vòng lặp.'); if (visited.has(e.id))
            return; visiting.add(e.id); for (const c of e.causes)
            checkCause(em.get(c)); visiting.delete(e.id); visited.add(e.id); }
        events.forEach(checkCause);
        const current = { branchId: id(raw.current.branchId), snapshotId: id(raw.current.snapshotId) }, branch = bm.get(current.branchId);
        if (!branch || !ancestry(sm.get(branch.headId), sm, 'parentId').has(current.snapshotId))
            fail('Mốc đang xem không thuộc nhánh.');
        const conversations = list(raw.conversations || [], 0, 40).map(c => ({ id: id(c.id), characterId: chars.has(c.characterId) ? c.characterId : fail('Nhân vật không tồn tại.'), branchId: bm.has(c.branchId) ? c.branchId : fail('Nhánh hội thoại không tồn tại.'), snapshotId: sm.has(c.snapshotId) && ancestry(sm.get(bm.get(c.branchId).headId), sm, 'parentId').has(c.snapshotId) ? c.snapshotId : fail('Mốc hội thoại không thuộc nhánh.'), question: text(c.question, 2000), reply: text(c.reply, 5000), provider: ['offline', 'gemini'].includes(c.provider) ? c.provider : fail('Nguồn trả lời chưa hợp lệ.'), eventIds: list(c.eventIds || [], 0, 12).map(x => sm.get(c.snapshotId).eventIds.includes(x) ? x : fail('Nhân vật dẫn sự kiện ngoài mốc đang biết.')), at: stamp(c.at) }));
        const world = { schemaVersion: VERSION, fictional: true, id: id(raw.id), name: text(raw.name, 100), code: text(raw.code, 40), sequence: integer(raw.sequence ?? 0, 0, 1000000), premise: text(raw.premise, 2000), settings: settings(raw.settings), seed: integer(raw.seed, 0, 4294967295), createdAt: stamp(raw.createdAt), updatedAt: stamp(raw.updatedAt), provenance: { kind: ['offline', 'gemini', 'imported', 'copy'].includes(raw.provenance?.kind) ? raw.provenance.kind : fail('Thiếu nguồn khởi tạo.'), model: text(raw.provenance.model || '', 100, false), ruleVersion: 1 }, blueprint: b, branches, snapshots, events, current, conversations, journal: list(raw.journal || [], 0, 80).map(j => ({ id: id(j.id), snapshotId: sm.has(j.snapshotId) ? j.snapshotId : fail('Ghi chú không khớp mốc.'), text: text(j.text, 2000), at: stamp(j.at) })), capsules: list(raw.capsules || [], 0, 30).map(c => ({ id: id(c.id), snapshotId: sm.has(c.snapshotId) ? c.snapshotId : fail('Mốc ghi nhớ không tồn tại.'), branchId: bm.has(c.branchId) ? c.branchId : fail('Nhánh ghi nhớ không tồn tại.'), name: text(c.name, 100) })), browser: browser(raw.browser) };
        if (new TextEncoder().encode(JSON.stringify(world)).length > MAX_BYTES)
            fail('Vũ trụ vượt750KB. Xuất bản sao và tạo vũ trụ mới để tiếp tục.');
        return world;
    }
    function publicView(raw) { const w = universe(raw); w.conversations = []; w.journal = []; w.capsules = []; w.browser = browser(); return universe(w); }
    function serialize(w) { return JSON.stringify(universe(w)); }
    function parse(raw) { if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > MAX_BYTES)
        fail('Tệp JSON quá lớn.'); return universe(JSON.parse(raw)); }
    return Object.freeze({ VERSION, MAX_BYTES, MAX_SNAPSHOTS, MAX_BRANCHES, MODES, APPS, METRICS, fail, safeTree, text, id, number, integer, list, unique, clone, fold, settings, metrics, blueprint, browser, address, universe, publicView, serialize, parse });
});
