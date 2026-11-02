(function (root, factory) { const api = factory(typeof module === 'object' && module.exports ? require('./hh-multiverse-model') : root.HHMultiverseModel, typeof module === 'object' && module.exports ? require('./hh-multiverse-engine') : root.HHMultiverseEngine); if (typeof module === 'object' && module.exports)
    module.exports = api;
else
    root.HHMultiverseInternet = api; })(typeof globalThis !== 'undefined' ? globalThis : this, function (M, E) {
    'use strict';
    const LABELS = { population: 'Dân số hư cấu', technology: 'Công nghệ', stability: 'Ổn định xã hội', economy: 'Kinh tế', environment: 'Môi trường', wellbeing: 'Đời sống', education: 'Giáo dục', energy: 'Năng lượng', culture: 'Văn hóa' };
    const STATUS = { active: 'Đang hoạt động trong kịch bản', strained: 'Đang chịu áp lực', destroyed: 'Đã bị phá hủy tại mốc này' };
    function project(raw) {
        const w = M.universe(raw), s = E.snapshot(w), events = E.visibleEvents(w), year = E.year(w), b = w.blueprint;
        const articles = events.slice().reverse().map(e => ({ id: e.id, title: e.title, body: e.description, day: e.day, year: w.settings.epochYear + Math.floor(e.day / 365), author: b.characters[0].name + ' · phóng viên hư cấu', topic: e.kind, locationIds: e.locationIds, eventId: e.id }));
        const locations = b.locations.map(l => ({ ...l, status: s.locations[l.id], statusLabel: STATUS[s.locations[l.id]], events: events.filter(e => e.locationIds.includes(l.id)).map(e => e.id) }));
        const characters = b.characters.map((c, i) => { const known = events.slice(-6), latest = known.at(-1), place = locations.find(l => l.id === c.locationId); return { ...c, simulated: true, place, knownEventIds: known.map(e => e.id), activity: known.filter(e => e.characterIds.includes(c.id) || !e.characterIds.length).map(e => e.id), post: { id: 'post-' + s.id + '-' + c.id, characterId: c.id, title: c.role, body: (place.status === 'destroyed' ? 'Hạ tầng tại ' + place.name + ' đã bị phá hủy. ' : place.status === 'strained' ? 'Cộng đồng tại ' + place.name + ' đang chịu áp lực. ' : '') + c.belief + ' Tôi đang suy nghĩ về: ' + latest.title + '.', comments: b.characters.filter(other => other.id !== c.id).slice(0, 2).map(other => ({ name: other.name, text: 'Chúng ta cần đối chiếu quy tắc và lịch sử đã lưu trước khi quyết định.' })) } }; });
        const documents = [...b.rules.map((r, i) => ({ id: 'rule-' + i, kind: 'rule', title: 'Quy tắc ' + (i + 1), text: r, address: 'sim://encyclopedia/rule-' + i })), ...locations.map(l => ({ id: l.id, kind: 'location', title: l.name, text: l.description + ' ' + l.statusLabel, address: 'sim://map/' + l.id })), ...characters.map(c => ({ id: c.id, kind: 'character', title: c.name, text: [c.role, c.personality, c.goal, c.belief].join(' '), address: 'sim://social/' + c.id })), ...b.organizations.map(o => ({ id: o.id, kind: 'organization', title: o.name, text: o.description, address: 'sim://encyclopedia/' + o.id })), ...b.products.map(p => ({ id: p.id, kind: 'product', title: p.name, text: p.description, address: 'sim://market/' + p.id })), ...articles.map(a => ({ id: a.id, kind: 'event', title: a.title, text: a.body, address: 'sim://news/' + a.id }))];
        const previous = w.snapshots.find(p => p.id === s.parentId), trends = M.METRICS.map(key => ({ key, label: LABELS[key], value: s.metrics[key], delta: previous ? s.metrics[key] - previous.metrics[key] : 0, unit: key === 'population' ? 'người hư cấu' : 'điểm mô hình /100' }));
        return { worldId: w.id, name: w.name, premise: w.premise, branch: E.branch(w), snapshot: s, year, events, articles, locations, characters, documents, trends, products: b.products.map(p => ({ ...p, available: s.locations[p.locationId] !== 'destroyed' })), fictional: true, model: 'HH rule model v1' };
    }
    const stop = new Set(['vi', 'sao', 'la', 'gi', 'cua', 'trong', 'co', 'duoc', 'tai', 'the', 'nao', 'mot', 'nhung', 'why', 'what', 'the', 'is', 'a', 'in', 'of', 'does', 'do']);
    function search(raw, query) { const p = project(raw), terms = M.fold(M.text(query, 200, false)).split(/[^a-z0-9]+/).filter(t => t && !stop.has(t)); if (!terms.length)
        return p.documents.slice(0, 12); return p.documents.map(d => ({ ...d, score: terms.reduce((n, t) => n + (M.fold(d.title + ' ' + d.text).includes(t) ? 1 : 0), 0) })).filter(d => d.score > 0).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 24); }
    function parseAddress(address) { M.address(address); const u = new URL(address); return { app: u.hostname, target: u.pathname.replace(/^\//, ''), query: u.searchParams.get('q') || '' }; }
    function browse(raw, address, options = {}) { const w = M.universe(raw); M.address(address); const b = w.browser; let tab = b.tabs.find(t => t.id === b.activeTab); if (options.newTab) {
        if (b.tabs.length >= 8)
            M.fail('Tối đa8 tab; đóng bớt để mở thêm.');
        tab = { id: E.uuid(), history: [address], cursor: 0 };
        b.tabs.push(tab);
        b.activeTab = tab.id;
    }
    else if (options.replace)
        tab.history[tab.cursor] = address;
    else if (tab.history[tab.cursor] !== address) {
        tab.history = tab.history.slice(0, tab.cursor + 1);
        tab.history.push(address);
        if (tab.history.length > 60)
            tab.history.shift();
        tab.cursor = tab.history.length - 1;
    } b.history.push({ address, at: new Date().toISOString() }); b.history = b.history.slice(-100); return M.universe(w); }
    function back(raw, delta) { const w = M.universe(raw), t = w.browser.tabs.find(t => t.id === w.browser.activeTab); t.cursor = Math.max(0, Math.min(t.history.length - 1, t.cursor + delta)); return M.universe(w); }
    function activeAddress(w) { const t = w.browser.tabs.find(t => t.id === w.browser.activeTab); return t.history[t.cursor]; }
    function closeTab(raw, id) { const w = M.universe(raw); if (w.browser.tabs.length === 1)
        M.fail('Giữ ít nhất một tab.'); w.browser.tabs = w.browser.tabs.filter(t => t.id !== id); if (!w.browser.tabs.some(t => t.id === w.browser.activeTab))
        w.browser.activeTab = w.browser.tabs[0].id; return M.universe(w); }
    function bookmark(raw) { const w = M.universe(raw), address = activeAddress(w), at = w.browser.bookmarks.findIndex(b => b.address === address); if (at >= 0)
        w.browser.bookmarks.splice(at, 1);
    else {
        if (w.browser.bookmarks.length >= 60)
            M.fail('Tối đa60 bookmark.');
        w.browser.bookmarks.push({ address, title: parseAddress(address).app });
    } return M.universe(w); }
    function chatContext(raw, characterId) { const w = M.universe(raw), p = project(w), c = p.characters.find(c => c.id === characterId); if (!c)
        M.fail('Nhân vật không tồn tại.'); const ancestors = new Set(E.lineage(w, w.current.snapshotId).map(s => s.id)); return { worldId: w.id, premise: w.premise, rules: w.blueprint.rules, year: p.year, day: p.snapshot.day, branchId: w.current.branchId, snapshotId: w.current.snapshotId, character: { id: c.id, name: c.name, role: c.role, personality: c.personality, goal: c.goal, belief: c.belief, place: { name: c.place.name, status: c.place.statusLabel } }, events: p.events.slice(-12).map(e => ({ id: e.id, title: e.title, description: e.description, day: e.day })), history: w.conversations.filter(t => t.characterId === c.id && t.branchId === w.current.branchId && ancestors.has(t.snapshotId)).slice(-6).map(t => ({ question: t.question, reply: t.reply })), fictional: true }; }
    function offlineChat(raw, characterId, question) { const c = chatContext(raw, characterId), q = M.text(question, 2000), future = /tuong lai|ngay mai|future|tomorrow|1000 nam|100 nam sau/.test(M.fold(q)); return { reply: 'Tôi là ' + c.character.name + ', ' + c.character.role + ' trong vũ trụ hư cấu này. ' + (future ? 'Mốc tôi biết là năm ' + c.year + '. Tôi chưa có dữ kiện về tương lai hoặc nhánh khác. ' : c.character.belief + ' Ở ' + c.character.place.name + ', tình trạng được ghi là: ' + c.character.place.status + '. ') + (future ? '' : c.events.slice(-2).map(e => 'Tôi biết sự kiện “' + e.title + '”.').join(' ')) + ' Mục tiêu của tôi: ' + c.character.goal, eventIds: c.events.slice(-2).map(e => e.id), provider: 'offline' }; }
    function saveChat(raw, characterId, question, result) { const w = M.universe(raw), context = chatContext(w, characterId); if (w.conversations.length >= 40)
        M.fail('Đã lưu40 lượt chat; xuất bản sao hoặc xóa hội thoại để tiếp tục.'); if (!['offline', 'gemini'].includes(result.provider))
        M.fail('Thiếu nguồn phản hồi.'); const eventIds = M.list(result.eventIds, 0, 12).map(id => context.events.some(e => e.id === id) ? id : M.fail('Phản hồi dẫn sự kiện ngoài tri thức của nhân vật.')); w.conversations.push({ id: E.uuid(), characterId, branchId: w.current.branchId, snapshotId: w.current.snapshotId, question: M.text(question, 2000), reply: M.text(result.reply, 5000), provider: result.provider, eventIds, at: new Date().toISOString() }); w.updatedAt = new Date().toISOString(); return M.universe(w); }
    function story(raw, includeNotes = false) { const w = M.universe(raw), p = project(w); return '# ' + w.name + '\n\nFICTIONAL UNIVERSE / AI SIMULATION\nThế giới hư cấu · mô phỏng sáng tạo\n\n' + w.premise + '\n\nNguồn khởi tạo: ' + w.provenance.kind + '; mô hình quy tắc HH v1.\n\n## Quy luật\n\n' + w.blueprint.rules.map(r => '- ' + r).join('\n') + '\n\n## Lịch sử nhánh ' + p.branch.name + '\n\n' + p.events.map(e => '### Năm ' + (w.settings.epochYear + Math.floor(e.day / 365)) + ' · ' + e.title + '\n\n' + e.description).join('\n\n') + (includeNotes ? '\n\n## Ghi chú riêng được chọn để xuất\n\n' + w.journal.filter(j => p.snapshot.eventIds.length && E.lineage(w, w.current.snapshotId).some(s => s.id === j.snapshotId)).map(j => j.text).join('\n\n') : '') + '\n\nCác chỉ số là mô hình đồ chơi, không phải dữ liệu hoặc dự báo khoa học.\n'; }
    return Object.freeze({ LABELS, STATUS, project, search, parseAddress, browse, back, activeAddress, closeTab, bookmark, chatContext, offlineChat, saveChat, story });
});
