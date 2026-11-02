/* One immutable World State Engine for every fictional Internet application. */
(function (root, factory) { const api = factory(typeof module === 'object' && module.exports ? require('./hh-multiverse-model') : root.HHMultiverseModel); if (typeof module === 'object' && module.exports)
    module.exports = api;
else
    root.HHMultiverseEngine = api; })(typeof globalThis !== 'undefined' ? globalThis : this, function (M) {
    'use strict';
    const now = () => new Date().toISOString(), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    function hash(v) { let n = 2166136261; for (const c of String(v)) {
        n ^= c.charCodeAt(0);
        n = Math.imul(n, 16777619);
    } return n >>> 0; }
    const uuid = () => globalThis.crypto?.randomUUID?.() || 'world-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    const SAMPLES = Object.freeze([
        ['sleep', 'Nếu con người không bao giờ cần ngủ thì sao?', 'Thành phố không ngủ', 'A city without sleep'],
        ['moons', 'Nếu Trái Đất có hai Mặt Trăng?', 'Hai vầng trăng', 'Two moon horizons'],
        ['memory', 'Nếu con người có thể mua bán ký ức?', 'Chợ ký ức', 'The memory exchange'],
        ['time', 'Nếu thời gian trở thành một loại tiền tệ?', 'Cộng hòa thời khắc', 'The hour republic'],
        ['animals', 'Nếu động vật có thể thành lập quốc gia?', 'Liên minh muôn loài', 'The wild federation'],
        ['network', 'Nếu Internet đã tồn tại từ năm 1500?', 'Mạng lưới cổ đại', 'The early network'],
        ['money', 'Một xã hội tồn tại 500 năm không dùng tiền', 'Quần đảo sẻ chia', 'The sharing archipelago'],
        ['sky', 'Nếu các thành phố có thể bay trên bầu trời?', 'Những thành phố trên mây', 'Cities in the sky']
    ]);
    const PROFILES = {
        sleep: ['Nhịp nghỉ ngơi là lựa chọn văn hóa, không phải nhu cầu ngủ.', 'Năng lượng và không gian yên tĩnh trở thành tài nguyên được tranh luận.'],
        moons: ['Hai vệ tinh định hình lịch và biểu tượng của cộng đồng.', 'Các khu vực thích nghi khác nhau với chu kỳ của hai vầng trăng.'],
        memory: ['Ký ức có thể được sao chép trong giả định này.', 'Quyền đồng ý và tính riêng tư của ký ức là vấn đề trung tâm.'],
        time: ['Đơn vị thời gian được dùng trong trao đổi giả tưởng.', 'Xã hội tranh luận cách phân phối quỹ thời gian công bằng.'],
        animals: ['Nhiều loài có ngôn ngữ và tổ chức chính trị riêng.', 'Hạ tầng phải phù hợp với nhiều môi trường sống.'],
        network: ['Thông điệp được truyền qua một mạng lưới có trước công nghiệp hiện đại.', 'Kho tri thức và quyền tiếp cận mạng định hình các liên minh.'],
        money: ['Hàng hóa được phân phối qua cam kết, nhu cầu và sổ trao đổi.', 'Niềm tin và năng lực phối hợp thay thế một phần tín hiệu giá.'],
        sky: ['Các thành phố nổi là tiền đề hư cấu của thế giới.', 'Năng lượng nâng và kết nối giữa các đô thị là giới hạn quan trọng.'],
        custom: ['Giả định của người tạo là quy tắc xuất phát, không phải một khẳng định thực tế.', 'Các cộng đồng xây dựng thể chế để thích nghi với giả định này.']
    };
    function family(p) { const q = M.fold(p); return /khong.*ngu|never.*sleep/.test(q) ? 'sleep' : /mat trang|moons?/.test(q) ? 'moons' : /ky uc|memor/.test(q) ? 'memory' : /thoi gian|time.*currenc/.test(q) ? 'time' : /dong vat|animal/.test(q) ? 'animals' : /1500|internet/.test(q) ? 'network' : /khong.*tien|without money/.test(q) ? 'money' : /bay|sky|fly/.test(q) ? 'sky' : 'custom'; }
    function offlineBlueprint(premise, rawSettings = {}) {
        const settings = M.settings(rawSettings), seed = hash(premise + JSON.stringify(settings)), f = family(premise), en = settings.language === 'en', sample = SAMPLES.find(s => s[0] === f), n = settings.complexity === 'rich' ? 6 : 3;
        const names = en ? ['Aster Reach', 'Vela Haven', 'Lumen Commons', 'Cloudwell', 'Silver Delta', 'Echo Basin'] : ['Bến Sao Lam', 'Vịnh Vân Kính', 'Thung lũng Cộng Hưởng', 'Cảng Mây Bạc', 'Đồng bằng Lưu Quang', 'Lòng chảo Tiếng Vọng'];
        const locations = Array.from({ length: n }, (_, i) => ({ id: 'loc-' + i, name: names[i], description: en ? 'A fictional district adapting to the founding premise.' : 'Một khu vực hư cấu thích nghi với giả định khởi đầu; có tiếng nói riêng trong hội đồng.', x: 14 + (i % 3) * 34 + (seed + i * 7) % 8, y: 22 + Math.floor(i / 3) * 44 + (seed + i * 11) % 13 }));
        const role = en ? ['Engineer', 'Archivist', 'Mediator', 'Researcher', 'Navigator', 'Artist'] : ['Kỹ sư', 'Người giữ sử', 'Người hòa giải', 'Nhà nghiên cứu', 'Hoa tiêu', 'Nghệ sĩ'];
        const chars = ['Mira Vân', 'Koa Lam', 'Neri Quang', 'Sora Kính', 'Ilo Vũ', 'Tavi Ngân'];
        const characters = locations.map((l, i) => ({ id: 'char-' + i, name: chars[i], role: role[i], profession: role[i], personality: en ? 'Curious, careful and open about uncertainty.' : 'Tò mò, cẩn trọng và nói rõ điều mình chưa biết.', goal: en ? 'Keep the community resilient without losing its identity.' : 'Giúp cộng đồng thích nghi mà không đánh mất bản sắc.', belief: en ? 'Public decisions should be discussed and recorded.' : 'Các quyết định chung cần được thảo luận và lưu lại.', locationId: l.id, relationships: ['char-' + ((i + 1) % n)] }));
        const products = Array.from({ length: settings.complexity === 'rich' ? 8 : 4 }, (_, i) => ({ id: 'product-' + i, name: (en ? ['Portable observatory', 'Memory lantern', 'Community energy kit', 'Transit pass'] : ['Đài quan sát bỏ túi', 'Đèn lưu niệm', 'Bộ năng lượng cộng đồng', 'Vé đường mây'])[i % 4] + (i >= 4 ? ' II' : ''), description: en ? 'A fictional item made for the rules of this universe.' : 'Vật phẩm hư cấu được thiết kế theo quy luật của vũ trụ; không có giao dịch tiền thật.', price: 40 + (seed + i * 43) % 180, locationId: locations[i % n].id }));
        const focus = settings.focus, variation = seed % 11;
        const modeRules = { realistic: en ? 'Keep familiar physical limits except for the stated premise.' : 'Giữ giới hạn vật lý quen thuộc ngoài giả định đã nêu.', fantasy: en ? 'Magic is a fictional shared resource with social limits.' : 'Phép thuật là tài nguyên hư cấu chịu giới hạn của cộng đồng.', 'sci-fi': en ? 'Speculative technology must account for energy and access.' : 'Công nghệ giả tưởng phải tính tới năng lượng và quyền tiếp cận.', chaos: en ? 'Timeline shocks have doubled model effects; uncertainty stays explicit.' : 'Biến cố timeline có tác động mô hình gấp đôi; luôn nêu rõ bất định.', custom: en ? 'The custom rules below are narrative constraints, not executable physics.' : 'Quy tắc tùy chỉnh là ràng buộc kể chuyện, không phải mã thực thi vật lý.' };
        const modeRule = modeRules[settings.mode];
        return M.blueprint({ name: sample ? sample[en ? 3 : 2] : (en ? 'The divergent horizon' : 'Chân trời dị biệt') + ' ' + (seed % 997), overview: (en ? 'A fictional civilization built around: ' : 'Nền văn minh hư cấu phát triển quanh giả định: ') + premise.slice(0, 1200), physics: modeRule + ' ' + (en ? 'The founding premise is assumed. This is a creative rule model, not a scientific simulation.' : PROFILES[f][0] + ' Các chỉ số bên dưới là mô hình sáng tạo đơn giản, không kiểm định vật lý.'), society: en ? 'Neighborhood councils debate access, work and collective responsibility.' : PROFILES[f][1], technology: en ? 'Research infrastructure grows through explicit timeline events.' : 'Hạ tầng nghiên cứu và kết nối được phát triển qua các sự kiện đã ghi trong timeline.', economy: en ? 'Fictional credits circulate locally; the 0–100 economy score is a toy model.' : 'Tín dụng mô phỏng lưu thông trong cộng đồng; chỉ số kinh tế 0–100 là mô hình đồ chơi.', culture: en ? 'Festivals and stories preserve memories of earlier snapshots.' : 'Lễ hội và chuyện kể lưu dấu những lựa chọn của các thế hệ trước.', politics: en ? 'A fictional council coordinates the districts; public decisions leave an audit trail.' : 'Hội đồng hư cấu phối hợp các khu vực; quyết định chung để lại dấu vết trong lịch sử.', rules: [premise.slice(0, 600), modeRule, en ? 'Only recorded events change the world state.' : 'Chỉ sự kiện được ghi mới làm đổi trạng thái thế giới.', en ? 'Branches inherit the past and keep separate futures.' : 'Các nhánh kế thừa quá khứ và giữ tương lai riêng.', ...(settings.customRules ? settings.customRules.split('\n').filter(Boolean).slice(0, 6) : [])], possibilities: en ? ['Resource pressure may trigger a crisis.', 'Collective research may unlock new infrastructure.'] : ['Áp lực tài nguyên có thể dẫn tới biến cố.', 'Nghiên cứu chung có thể mở ra hạ tầng mới.'], locations, characters, products, organizations: [{ id: 'org-council', name: en ? 'The Horizon Assembly' : 'Hội đồng Chân Trời', description: en ? 'A fictional coordinating body.' : 'Tổ chức điều phối hư cấu, không đại diện một cơ quan ngoài đời.', locationId: locations[0].id }], initialMetrics: { population: 25000 + seed % 75000, technology: 45 + variation + (focus === 'science' ? 12 : 0) + (settings.mode === 'sci-fi' ? 8 : 0), stability: settings.mode === 'chaos' ? 50 : settings.mode === 'realistic' ? 66 : 62, economy: 48 + (focus === 'economy' ? 13 : 0), environment: 68, wellbeing: 58, education: 48 + (focus === 'science' ? 10 : 0), energy: 60, culture: 58 + (focus === 'society' ? 10 : 0) + (settings.mode === 'fantasy' ? 8 : 0) } });
    }
    function create(premise, rawSettings = {}, options = {}) {
        premise = M.text(premise, 2000);
        const settings = M.settings(rawSettings);
        if (settings.mode === 'custom' && !settings.customRules)
            M.fail('Nhập ít nhất một quy tắc cho chế độ Custom.');
        const b = options.blueprint ? M.blueprint(options.blueprint) : offlineBlueprint(premise, settings), at = options.at || now(), id = options.id || uuid();
        return M.universe({ schemaVersion: 1, fictional: true, id, name: b.name, code: 'GV-' + hash(id).toString(16).toUpperCase(), sequence: 0, premise, settings, seed: hash(premise + JSON.stringify(settings)), createdAt: at, updatedAt: at, provenance: { kind: options.provider === 'gemini' ? 'gemini' : 'offline', model: options.model || '', ruleVersion: 1 }, blueprint: b, branches: [{ id: 'main', name: settings.language === 'en' ? 'Origin' : 'Nhánh gốc', parentId: null, forkSnapshotId: null, headId: 's0', createdAt: at }], snapshots: [{ id: 's0', parentId: null, branchId: 'main', day: 0, metrics: b.initialMetrics, locations: Object.fromEntries(b.locations.map(l => [l.id, 'active'])), eventIds: ['e0'], wallet: 1000, inventory: [], policies: [], note: settings.language === 'en' ? 'Origin snapshot of a fictional model.' : 'Mốc khởi đầu của mô hình hư cấu.' }], events: [{ id: 'e0', snapshotId: 's0', branchId: 'main', day: 0, kind: 'founding', title: settings.language === 'en' ? 'The first divergence' : 'Điểm phân kỳ đầu tiên', description: premise.slice(0, 1400), locationIds: b.locations.map(l => l.id), characterIds: b.characters.map(c => c.id), causes: [], effects: {} }], current: { branchId: 'main', snapshotId: 's0' }, conversations: [], journal: [], capsules: [], browser: M.browser() });
    }
    const snapshot = w => w.snapshots.find(s => s.id === w.current.snapshotId), branch = w => w.branches.find(b => b.id === w.current.branchId);
    function lineage(w, sid) { const out = []; let s = w.snapshots.find(s => s.id === sid); while (s) {
        out.unshift(s);
        s = w.snapshots.find(x => x.id === s.parentId);
    } return out; }
    const visibleEvents = w => snapshot(w).eventIds.map(id => w.events.find(e => e.id === id));
    const year = (w, s = snapshot(w)) => w.settings.epochYear + Math.floor(s.day / 365);
    function guard(w, snapshots = 1, branches = 0) { if (w.snapshots.length + snapshots > M.MAX_SNAPSHOTS || w.branches.length + branches > M.MAX_BRANCHES || w.events.length + snapshots > 180)
        M.fail('Đã tới giới hạn lịch sử. Xuất bản sao hoặc tạo vũ trụ riêng để tiếp tục.'); }
    const token = (w, prefix) => { let id; do {
        id = prefix + '-' + (++w.sequence);
    } while ([...w.snapshots, ...w.events, ...w.branches].some(v => v.id === id)); return id; };
    function forkInPlace(w, name) { guard(w, 1, 1); const from = snapshot(w), parent = branch(w), bid = token(w, 'branch'), sid = token(w, 's'); w.snapshots.push({ ...M.clone(from), id: sid, parentId: from.id, branchId: bid, note: 'Nhánh kế thừa nguyên trạng mốc ' + from.id }); w.branches.push({ id: bid, name: M.text(name || 'Nhánh mới', 100), parentId: parent.id, forkSnapshotId: from.id, headId: sid, createdAt: now() }); w.current = { branchId: bid, snapshotId: sid }; }
    function fork(raw, name) { const w = M.universe(raw); forkInPlace(w, name); w.updatedAt = now(); return M.universe(w); }
    function select(raw, branchId, snapshotId) { const w = M.universe(raw), b = w.branches.find(b => b.id === branchId); if (!b)
        M.fail('Nhánh không còn tồn tại.'); const sid = snapshotId || b.headId; if (!lineage(w, b.headId).some(s => s.id === sid))
        M.fail('Mốc không thuộc nhánh đã chọn.'); w.current = { branchId: b.id, snapshotId: sid }; return M.universe(w); }
    function append(w, day, event, deltas = {}, locationChange = null) {
        guard(w);
        const from = snapshot(w), sid = token(w, 's'), eid = token(w, 'e'), next = { ...M.clone(from), id: sid, parentId: from.id, branchId: w.current.branchId, day, note: event.description };
        for (const k of M.METRICS) {
            const lo = k === 'population' ? 1 : 0, hi = k === 'population' ? 9000000000 : 100;
            next.metrics[k] = clamp(Math.round((from.metrics[k] + (deltas[k] || 0)) * 100) / 100, lo, hi);
            if (k === 'population')
                next.metrics[k] = Math.round(next.metrics[k]);
        }
        if (locationChange)
            next.locations[locationChange.id] = locationChange.status;
        next.eventIds.push(eid);
        w.events.push({ id: eid, snapshotId: sid, branchId: w.current.branchId, day, kind: event.kind, title: event.title, description: event.description, locationIds: locationChange ? [locationChange.id] : event.locationIds || [], characterIds: event.characterIds || [], causes: from.eventIds.slice(-1), effects: Object.fromEntries(M.METRICS.filter(k => next.metrics[k] !== from.metrics[k]).map(k => [k, next.metrics[k] - from.metrics[k]])) });
        w.snapshots.push(next);
        branch(w).headId = sid;
        w.current.snapshotId = sid;
        w.updatedAt = now();
        return next;
    }
    const eventTemplates = [['discovery', 'Bước tiến trong nghiên cứu', { technology: 5, education: 3, energy: -1 }], ['reform', 'Thỏa thuận mới của hội đồng', { stability: 4, wellbeing: 3, economy: -1 }], ['crisis', 'Sự cố hạ tầng tại ', { environment: -6, stability: -5, energy: -4 }], ['recovery', 'Khôi phục hạ tầng tại ', { environment: 4, stability: 4, economy: -3 }], ['trade', 'Mạng trao đổi được mở rộng', { economy: 5, culture: 2, energy: -2 }], ['culture', 'Kho tri thức cộng đồng mở cửa', { culture: 4, education: 4, wellbeing: 2 }]];
    const englishTitles = ['A research breakthrough', 'A new council agreement', 'Infrastructure failure at ', 'Infrastructure restored at ', 'The exchange network expands', 'The community archive opens'];
    function advance(raw, days) {
        const w = M.universe(raw);
        M.integer(days, 1, 365000);
        const steps = Math.min(6, Math.max(1, Math.ceil(Math.log10(days + 1)))), start = snapshot(w).day;
        if (start + days > 3650000)
            M.fail('Mốc vượt giới hạn mô hình10.000năm.');
        guard(w, steps + (snapshot(w).id !== branch(w).headId ? 1 : 0), snapshot(w).id !== branch(w).headId ? 1 : 0);
        if (snapshot(w).id !== branch(w).headId)
            forkInPlace(w, 'Tương lai từ năm ' + year(w));
        for (let i = 1; i <= steps; i++) {
            const from = snapshot(w), target = start + Math.ceil(days * i / steps), r = hash(w.seed + ':' + from.id + ':' + target), t = eventTemplates[r % eventTemplates.length], loc = w.blueprint.locations[r % w.blueprint.locations.length], factor = w.settings.mode === 'chaos' ? 2 : 1, deltas = Object.fromEntries(Object.entries(t[2]).map(([k, v]) => [k, v * factor]));
            const rate = clamp(.004 + (from.metrics.wellbeing - 50) * .00002 + (from.metrics.technology - 50) * .00001, -.012, .012), nextPop = clamp(Math.round(from.metrics.population * Math.pow(1 + rate, (target - from.day) / 365)), 1, 9000000000);
            deltas.population = nextPop - from.metrics.population;
            const change = t[0] === 'crisis' ? { id: loc.id, status: (r % 3 === 0 ? 'destroyed' : 'strained') } : t[0] === 'recovery' ? { id: loc.id, status: 'active' } : null;
            append(w, target, { kind: t[0], title: (w.settings.language === 'en' ? englishTitles[r % eventTemplates.length] : t[1]) + (change ? loc.name : ''), description: w.settings.language === 'en' ? 'A rule-model event over ' + (target - from.day) + ' days. ' + (change ? (change.status === 'destroyed' ? 'The district is destroyed in this scenario; the map is updated.' : change.status === 'active' ? 'This recorded event restores the district.' : 'The district is under pressure and activity is restricted.') : 'The council and residents adapt their activities to current conditions.') : 'Sự kiện do mô hình quy tắc tạo trong ' + (target - from.day) + ' ngày. ' + (change ? (change.status === 'destroyed' ? 'Khu vực bị phá hủy trong kịch bản và bản đồ được cập nhật.' : change.status === 'active' ? 'Khu vực được phục hồi theo sự kiện này.' : 'Khu vực chịu áp lực và hạn chế hoạt động.') : 'Hội đồng và cư dân điều chỉnh hoạt động theo tình hình hiện tại.') }, deltas, change);
        }
        return M.universe(w);
    }
    const IMPACTS = { labor: { economy: -4, wellbeing: 8, culture: 4, education: 2, energy: 3, environment: 2, stability: 3, technology: 1 }, science: { technology: 9, education: 7, economy: -3, energy: -2, wellbeing: 2, culture: 1, environment: -1, stability: 1 }, ecology: { environment: 10, energy: 4, economy: -4, wellbeing: 4, technology: 2, education: 2, stability: 2, culture: 1 }, urban: { economy: 5, technology: 3, energy: -5, environment: -4, wellbeing: 2, education: 1, culture: 2, stability: -1 }, conflict: { stability: -12, economy: -8, wellbeing: -10, environment: -7, energy: -5, culture: -4, education: -4, technology: 1 }, recovery: { stability: 7, economy: -5, wellbeing: 6, environment: 7, energy: 3, technology: 2, education: 2, culture: 3 }, culture: { culture: 10, education: 4, wellbeing: 5, economy: -2, energy: -1, environment: 1, stability: 3, technology: 1 } };
    function infer(decision) { const q = M.fold(decision); return /lam viec|work|6 gio|six.hour/.test(q) ? 'labor' : /khoa hoc|research|science/.test(q) ? 'science' : /moi truong|energy|nang luong|environment/.test(q) ? 'ecology' : /pha huy|destroy|chien tranh/.test(q) ? 'conflict' : /xay lai|phuc hoi|recover/.test(q) ? 'recovery' : /thanh pho|city|urban/.test(q) ? 'urban' : /van hoa|culture|giao duc/.test(q) ? 'culture' : ''; }
    const fingerprint = w => hash(JSON.stringify([w.id, w.current, snapshot(w)])).toString(16);
    function preview(raw, decision, category) { const w = M.universe(raw); decision = M.text(decision, 1200); category = category || infer(decision); if (!IMPACTS[category])
        M.fail('Chọn nhóm tác động để bộ quy tắc biết cách mô phỏng quyết định này.'); const scale = .6 + w.settings.creativity / 100 * .8, deltas = Object.fromEntries(Object.entries(IMPACTS[category]).map(([k, v]) => [k, Math.round(v * scale)])); return { worldId: w.id, baseSnapshotId: w.current.snapshotId, baseBranchId: w.current.branchId, fingerprint: fingerprint(w), decision, category, deltas, assumptions: ['Bản xem trước từ trọng số quy tắc do HH thiết kế.', 'Chỉ số 0–100 là mô hình đồ chơi; không phải dự báo hoặc xác suất thực tế.', 'Chỉ Apply mới ghi sự kiện; thay đổi mốc/nhánh sẽ làm bản xem trước hết hạn.'], nodes: [{ id: 'decision', label: decision }, ...Object.entries(deltas).map(([id, value]) => ({ id, label: id, value }))], edges: Object.keys(deltas).map(k => ({ from: 'decision', to: k })) }; }
    function apply(raw, p) { let w = M.universe(raw); if (!p || p.worldId !== w.id || p.fingerprint !== fingerprint(w) || p.baseSnapshotId !== w.current.snapshotId || p.baseBranchId !== w.current.branchId)
        M.fail('Bản xem trước đã cũ. Hãy mô phỏng lại tại mốc đang chọn.'); const verified = preview(w, p.decision, p.category); guard(w, 2, 1); forkInPlace(w, 'Tác động: ' + p.decision.slice(0, 70)); const loc = w.blueprint.locations[0], change = p.category === 'conflict' ? { id: loc.id, status: 'destroyed' } : p.category === 'recovery' ? { id: loc.id, status: 'active' } : null; const s = append(w, snapshot(w).day + 1, { kind: 'decision', title: p.decision.slice(0, 160), description: 'Quyết định đã áp dụng trong nhánh mới. ' + verified.assumptions[0] }, verified.deltas, change); s.policies.push(p.decision); return M.universe(w); }
    function buy(raw, productId) { let w = M.universe(raw); const product = w.blueprint.products.find(p => p.id === productId); if (!product)
        M.fail('Vật phẩm không tồn tại.'); if (snapshot(w).locations[product.locationId] === 'destroyed')
        M.fail('Nơi sản xuất đã bị phá hủy ở mốc này.'); if (snapshot(w).wallet < product.price)
        M.fail('Không đủ tín dụng mô phỏng.'); if (snapshot(w).inventory.some(p => p.productId === productId && p.quantity >= 100))
        M.fail('Đã đạt giới hạn vật phẩm.'); if (snapshot(w).id !== branch(w).headId)
        forkInPlace(w, 'Giao dịch từ quá khứ'); const s = append(w, snapshot(w).day + 1, { kind: 'market', title: 'Trao đổi: ' + product.name, description: 'Giao dịch hư cấu bằng ' + product.price + ' tín dụng mô phỏng; không có thanh toán thật.' }, { economy: 1 }); s.wallet -= product.price; const row = s.inventory.find(p => p.productId === productId); if (row)
        row.quantity++;
    else
        s.inventory.push({ productId, quantity: 1 }); return M.universe(w); }
    function renameBranch(raw, bid, name) { const w = M.universe(raw), b = w.branches.find(b => b.id === bid); if (!b)
        M.fail('Nhánh không tồn tại.'); b.name = M.text(name, 100); w.updatedAt = now(); return M.universe(w); }
    function removeBranch(raw, bid) { const w = M.universe(raw), b = w.branches.find(b => b.id === bid); if (!b || !b.parentId || w.branches.some(b => b.parentId === bid))
        M.fail('Chỉ xóa nhánh lá; nhánh gốc được giữ.'); const removed = new Set(w.snapshots.filter(s => s.branchId === bid).map(s => s.id)); w.branches = w.branches.filter(b => b.id !== bid); w.snapshots = w.snapshots.filter(s => !removed.has(s.id)); w.events = w.events.filter(e => e.branchId !== bid); w.conversations = w.conversations.filter(c => c.branchId !== bid && !removed.has(c.snapshotId)); w.journal = w.journal.filter(j => !removed.has(j.snapshotId)); w.capsules = w.capsules.filter(c => c.branchId !== bid && !removed.has(c.snapshotId)); if (w.current.branchId === bid) {
        w.current = { branchId: b.parentId, snapshotId: w.branches.find(p => p.id === b.parentId).headId };
    } w.updatedAt = now(); return M.universe(w); }
    function duplicate(raw, options = {}) { const w = M.universe(raw); w.id = options.id || uuid(); w.code = 'GV-' + hash(w.id).toString(16).toUpperCase(); w.name = M.text(options.name || (w.name.slice(0, 89) + ' · bản sao'), 100); w.createdAt = options.at || now(); w.updatedAt = w.createdAt; w.provenance.kind = options.imported ? 'imported' : 'copy'; w.browser = M.browser(); if (!options.imported)
        w.conversations = []; return M.universe(w); }
    function addJournal(raw, text) { const w = M.universe(raw); if (w.journal.length >= 80)
        M.fail('Nhật ký đã đầy; xuất bản sao trước khi tiếp tục.'); w.journal.push({ id: uuid(), snapshotId: w.current.snapshotId, text: M.text(text, 2000), at: now() }); w.updatedAt = now(); return M.universe(w); }
    function capsule(raw, name) { const w = M.universe(raw); if (w.capsules.length >= 30)
        M.fail('Tối đa30 mốc ghi nhớ.'); w.capsules.push({ id: uuid(), name: M.text(name, 100), ...w.current }); w.updatedAt = now(); return M.universe(w); }
    return Object.freeze({ SAMPLES, PROFILES, IMPACTS, hash, family, uuid, offlineBlueprint, create, snapshot, branch, lineage, visibleEvents, year, fingerprint, advance, fork, select, preview, apply, buy, renameBranch, removeBranch, duplicate, addJournal, capsule });
});
