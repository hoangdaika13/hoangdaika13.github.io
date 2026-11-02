/* HH Platform workspace adapter. All simulations use the same validated world. */
(function (root) {
    'use strict';
    const M = root.HHMultiverseModel, E = root.HHMultiverseEngine, I = root.HHMultiverseInternet, V = root.HHMultiverseViews, S = root.HHMultiverseStore, A = root.HHMultiverseArt, G = root.HHMultiverseGallery, X = root.HHMultiverseExplorer;
    const PANES = ['overview', 'explorer', 'internet', 'timeline', 'butterfly', 'branches', 'characters', 'dna', 'journal', 'settings'];
    let active = null;
    function mount(host, options = {}) {
        unmount();
        if (!host)
            throw Error('Thiếu vùng hiển thị HH Multiverse.');
        const user = options.currentUser, logged = Boolean(user && !user.guest && (user.id || user._id)), store = S.create(user), life = new AbortController(), pending = new Set();
        const reduce = root.matchMedia('(prefers-reduced-motion: reduce)');
        let visual = A.preferences(), visualProtected = false;
        const visualKey = A.preferenceKey(user);
        try { visual = A.preferences(JSON.parse(root.localStorage.getItem(visualKey) || 'null')); }
        catch { visualProtected = true; }
        let alive = true, busy = false, portal = null, portalSequence = 0, sharedToken = '', modalResolve = null, modalFocus = null, operationController = null, loaded = false;
        const ctx = { draft: { premise: '', settings: M.settings(), provider: 'offline' }, rows: [], logged, admin: logged && ['owner', 'super_admin', 'admin', 'moderator'].includes(user.role), service: null, notice: '', motion: !reduce.matches, world: null, record: null, projection: null, view: 'overview', routeView: 'home', readOnly: false, allowClone: false, filters: { q: '', mode: 'all', sort: 'updated' }, cloudRows: null, publicRows: null, publicError: '', decision: { text: '', category: '' }, preview: null, compare: { left: 'main', right: '' }, characterId: '', chatProvider: 'offline', chatDraft: '', share: null, moderation: null };
        ctx.visual = visual;
        ctx.galleryFilter = 'all';
        ctx.gallery = G.filters();
        ctx.explorer = X.state();
        const collectionKey = G.collectionKey(user);
        let collectionProtected = false;
        ctx.artCollection = G.collection();
        try { ctx.artCollection = G.collection(JSON.parse(root.localStorage.getItem(collectionKey) || 'null')); }
        catch { collectionProtected = true; }
        ctx.lightboxId = '';
        ctx.lightboxIds = [];
        host.innerHTML = '<section class="mv"><div class="mv-generation" role="status"><span class="mv-spinner" aria-hidden="true"></span><h1>Đang mở Reality Engine…</h1><p>Đọc thư viện trên thiết bị.</p></div></section>';
        function assertAlive() { if (!alive)
            throw new DOMException('Workspace closed', 'AbortError'); }
        function writable() { if (ctx.readOnly)
            throw Error('Ảnh chụp này chỉ để xem. Sao chép thành vũ trụ riêng để thay đổi.'); if (!ctx.world)
            throw Error('Chọn một vũ trụ trước.'); }
        function notice(message) { ctx.notice = String(message || ''); const el = host.querySelector('[data-mv-notice]'); if (el) {
            el.textContent = ctx.notice;
            el.hidden = !ctx.notice;
        } }
        function saveVisual(next) {
            ctx.visual = A.preferences(next);
            const node = host.querySelector('[data-hh-multiverse]');
            if (node) { node.dataset.palette = ctx.visual.palette; node.dataset.compact = String(ctx.visual.compact); }
            if (visualProtected) { notice('Đã áp dụng trong phiên. Tùy chọn cũ cần phiên bản khác nên được giữ nguyên.'); return; }
            try { root.localStorage.setItem(visualKey, JSON.stringify(ctx.visual)); }
            catch { notice('Đã áp dụng bộ màu trong phiên; chưa lưu được tùy chọn trên thiết bị.'); }
        }
        function showArtwork(id, move = false) {
            const asset = A.find(id);
            if (!asset) throw Error('Ảnh không có trong bộ tranh.');
            const el = host.querySelector('[data-mv-dialog]');
            if (!move) {
                if (el.open || modalResolve) return;
                modalFocus = document.activeElement;
                ctx.lightboxIds = (ctx.routeView === 'gallery' ? G.filtered(ctx) : A.catalog).map(a => a.id);
                if (!ctx.lightboxIds.includes(id)) ctx.lightboxIds = A.catalog.map(a => a.id);
            }
            const focusedAction = move ? document.activeElement?.dataset.mvAction : 'close-art';
            ctx.lightboxId = id;
            el.classList.add('mv-art-dialog');
            el.setAttribute('aria-labelledby', 'mv-art-viewer-title');
            el.innerHTML = V.artworkViewer(id, ctx.lightboxIds);
            el.returnValue = '';
            if (!move) { if (el.showModal) el.showModal(); else el.setAttribute('open', ''); }
            const focus = ['previous-art', 'next-art', 'close-art'].includes(focusedAction) ? focusedAction : 'close-art';
            el.querySelector('[data-mv-action="' + focus + '"]')?.focus({ preventScroll: true });
        }
        function moveArtwork(delta) {
            const index = ctx.lightboxIds.indexOf(ctx.lightboxId), count = ctx.lightboxIds.length;
            if (count) showArtwork(ctx.lightboxIds[(index + delta + count) % count], true);
        }
        async function api(action, { method = 'GET', body, query = {}, signal } = {}) {
            const cancel = new AbortController(), abort = () => cancel.abort();
            life.signal.addEventListener('abort', abort, { once: true });
            signal?.addEventListener('abort', abort, { once: true });
            pending.add(cancel);
            const timeout = setTimeout(() => cancel.abort(), 35000), token = root.HHAuthSession?.token?.() || '';
            try {
                const base = String(root.HH_API_BASE || location.origin).replace(/\/$/, '');
                const url = new URL(base + '/api/multiverse/' + action, location.href);
                for (const [k, v] of Object.entries(query))
                    url.searchParams.set(k, v);
                const response = await fetch(url, { method, credentials: 'include', cache: 'no-store', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: cancel.signal });
                const data = await response.json().catch(() => ({}));
                assertAlive();
                if (!response.ok)
                    throw Object.assign(Error(data.error || 'Chưa kết nối được dịch vụ Multiverse. Bản trên thiết bị vẫn được giữ.'), { status: response.status, code: data.code });
                return data;
            }
            finally {
                clearTimeout(timeout);
                pending.delete(cancel);
                life.signal.removeEventListener('abort', abort);
                signal?.removeEventListener('abort', abort);
            }
        }
        async function refreshRows() { const rows = await store.list(); assertAlive(); ctx.rows = rows.map(r => { try {
            return { ...r, world: M.universe(r.world), protected: r.version !== 1 };
        }
        catch {
            return { ...r, protected: true };
        } }); }
        function project() { ctx.projection = ctx.world ? I.project(ctx.world) : null; }
        function stopPortal() { portalSequence++; portal?.destroy(); portal = null; }
        async function startPortal(force = false) {
            const node = host.querySelector('[data-mv-portal]');
            if (!node || portal)
                return;
            if (!force && (!ctx.motion || navigator.connection?.saveData || (navigator.deviceMemory && navigator.deviceMemory < 4) || innerWidth < 700))
                return;
            const sequence = ++portalSequence;
            try {
                const module = await import('./hh-multiverse-portal.mjs?v=1');
                if (!alive || sequence !== portalSequence || !node.isConnected)
                    return;
                portal = module.mountPortal(node, { reducedMotion: !ctx.motion });
            }
            catch {
                if (alive) {
                    node.dataset.renderer = '2d';
                    notice('Cổng 2D đang hoạt động; thiết bị chưa mở được WebGL. Các chức năng thế giới vẫn dùng được.');
                }
            }
        }
        function draw(full = false) { if (!alive)
            return; project(); if (full || !host.querySelector('[data-hh-multiverse]')) {
            stopPortal();
            host.innerHTML = V.shell(ctx);
            startPortal();
        }
        else {
            host.querySelector('[data-mv-world-header]').innerHTML = ctx.world ? V.worldHeader(ctx) : '';
            host.querySelector('[data-mv-body]').innerHTML = V.body(ctx);
            notice(ctx.notice);
        } host.querySelector('.mv')?.classList.toggle('mv-motion-off', !ctx.motion); const nav = host.querySelector('.mv-world-nav'), current = nav?.querySelector('[aria-current]'); if (current)
            nav.scrollLeft = current.offsetLeft - nav.offsetLeft - (nav.clientWidth - current.offsetWidth) / 2; }
        function url(view = ctx.view) { return ctx.readOnly ? '/multiverse/shared/' + sharedToken + '?view=' + view : '/multiverse/universe/' + ctx.world.id + '/' + view; }
        function pane(view, focus = true) { if (!PANES.includes(view))
            return; if (ctx.view !== view && ctx.record?.durable !== false)
            ctx.notice = ''; ctx.view = view; history.pushState(null, '', '#' + url(view)); draw(); if (focus)
            host.querySelector('[data-mv-world-header] h1')?.focus({ preventScroll: true }); }
        function navigate(path) { location.hash = path; }
        async function commit(next, metadata = {}) {
            writable();
            next = M.universe(next);
            const expected = ctx.record?.localRevision || 0;
            try {
                const record = await store.put(next, { expectedLocalRevision: expected, ...metadata });
                assertAlive();
                ctx.record = record;
                ctx.world = record.world;
                ctx.preview = null;
                await refreshRows();
                if (!record.durable)
                    notice(store.status().error || 'Bản này chỉ đang giữ trong phiên. Hãy xuất JSON trước khi đóng trang.');
                return record;
            }
            catch (e) {
                if (e.code === 'LOCAL_CONFLICT') {
                    ctx.world = next;
                    ctx.record = { ...ctx.record, world: next, durable: false };
                    notice(e.message + ' Bản chưa ghi vẫn có thể xuất bằng nút JSON.');
                    draw();
                }
                throw e;
            }
        }
        async function localCreate(world) { const record = await store.put(world, { expectedLocalRevision: 0 }); assertAlive(); ctx.world = world; ctx.record = record; ctx.readOnly = false; sharedToken = ''; ctx.view = 'overview'; ctx.preview = null; await refreshRows(); history.pushState(null, '', '#' + url()); draw(true); notice(record.durable ? 'Đã tạo và lưu vũ trụ trên thiết bị.' : store.status().error); }
        async function change(next, message, view) { await commit(next); if (view)
            pane(view, false);
        else
            draw(); if (message)
            notice(message + (ctx.record.durable ? '' : ' Bản trong phiên chưa lưu bền vững; hãy xuất JSON.')); }
        async function inspectRoute(route) {
            const parts = String(route).split('?')[0].split('/').filter(Boolean), params = new URLSearchParams(String(route).split('?')[1] || '');
            ctx.routeView = parts[1] || 'home';
            if (G.CATEGORIES.includes(params.get('category'))) ctx.galleryFilter = params.get('category');
            if (parts[1] === 'shared') {
                sharedToken = M.id(parts[2]);
                ctx.sharedToken = sharedToken;
                const data = await api('shared', { query: { token: sharedToken } });
                ctx.world = M.universe(data.world);
                ctx.readOnly = true;
                ctx.allowClone = data.allowClone;
                ctx.view = PANES.includes(params.get('view')) ? params.get('view') : 'overview';
                ctx.record = null;
            }
            else if (parts[1] === 'universe') {
                const id = M.id(parts[2]), record = await store.get(id);
                assertAlive();
                if (!record)
                    throw Error('Vũ trụ chưa có trên thiết bị của tài khoản này. Mở thư viện để nhập JSON hoặc tải bản máy chủ.');
                if (record.version !== 1)
                    throw Error('Phiên bản bản lưu chưa được hỗ trợ. Mở thư viện để xuất bản gốc; không ghi đè.');
                ctx.world = M.universe(record.world);
                ctx.record = record;
                ctx.view = PANES.includes(parts[3]) ? parts[3] : 'overview';
                if (params.get('branch'))
                    ctx.world = E.select(ctx.world, params.get('branch'), params.get('snapshot') || undefined);
            }
            else if (!['home', 'create', 'explore', 'my-universes', 'atlas', 'moderation', 'gallery'].includes(ctx.routeView))
                throw Error('Đường dẫn Multiverse chưa được hỗ trợ.');
        }
        function download(name, data, type = 'application/json') {
            const blob = new Blob([data], { type: type + ';charset=utf-8' }), href = URL.createObjectURL(blob), a = document.createElement('a');
            a.href = href;
            a.download = name;
            a.click();
            setTimeout(() => URL.revokeObjectURL(href), 1000);
        }
        async function recordWorld(id) { if (ctx.world?.id === id)
            return ctx.world; const row = await store.get(id); if (!row)
            throw Error('Bản lưu không còn tồn tại.'); return M.universe(row.world); }
        function dialog(title, content, { confirm = 'Xác nhận', danger = false } = {}) {
            if (modalResolve)
                modalResolve(null);
            const el = host.querySelector('[data-mv-dialog]');
            el.classList.remove('mv-art-dialog');
            el.removeAttribute('aria-labelledby');
            modalFocus = document.activeElement;
            el.returnValue = '';
            el.innerHTML = '<form method="dialog"><h2>' + V.esc(title) + '</h2>' + content + '<div class="mv-actions"><button value="cancel" formnovalidate>Hủy</button><button value="confirm" class="' + (danger ? 'mv-danger' : 'mv-primary') + '">' + V.esc(confirm) + '</button></div></form>';
            return new Promise(resolve => { modalResolve = resolve; if (el.showModal)
                el.showModal();
            else {
                el.setAttribute('open', '');
                el.querySelector('button')?.focus();
            } });
        }
        function closeDialog(e) {
            const el = e.target;
            if (!el.matches('[data-mv-dialog]')) return;
            if (el.classList.contains('mv-art-dialog')) {
                ctx.lightboxId = '';
                el.classList.remove('mv-art-dialog');
                el.removeAttribute('aria-labelledby');
            } else {
                const values = el.returnValue === 'confirm' ? Object.fromEntries(new FormData(el.querySelector('form'))) : null;
                const resolve = modalResolve;
                modalResolve = null;
                resolve?.(values);
            }
            if (modalFocus?.isConnected) modalFocus.focus({ preventScroll: true });
        }
        async function sync() {
            writable();
            if (!logged)
                throw Error('Đăng nhập để đồng bộ. Bản trên thiết bị vẫn sử dụng được.');
            const world = M.universe(ctx.world), data = await api('worlds', { method: 'PUT', body: { id: world.id, world, revision: ctx.record?.cloudRevision || 0 } });
            await commit(world, { cloudRevision: data.revision, cloudUpdatedAt: data.updatedAt });
            notice('Máy chủ đã xác nhận revision ' + data.revision + '. Bản chia sẻ cũ chưa thay đổi.');
            return data;
        }
        async function loadCloud() { const data = await api('worlds'); ctx.cloudRows = data.worlds; draw(); }
        async function downloadCloud(id) {
            const data = await api('worlds', { query: { id } }), world = M.universe(data.world), old = await store.get(id);
            const answer = await dialog('Đối chiếu bản máy chủ', '<p>' + V.esc(world.name) + ' · revision ' + data.revision + ' · ' + world.events.length + ' sự kiện.</p><p>' + (old ? 'Thiết bị đã có bản cùng ID. Bạn có thể giữ cả hai bằng cách sao chép, hoặc thay bản thiết bị sau khi xuất bản cũ.' : 'Bản này sẽ được lưu trên thiết bị cho tài khoản hiện tại.') + '</p>' + V.select('Cách tải', 'choice', old ? [['copy', 'Giữ cả hai · tạo ID riêng'], ['replace', 'Thay bản thiết bị']] : [['replace', 'Tải bản máy chủ']], 'copy'), { confirm: 'Tải về' });
            if (!answer)
                return;
            if (answer.choice === 'copy') {
                await localCreate(E.duplicate(world));
                return;
            }
            if (old)
                download(id + '-before-cloud.json', JSON.stringify(old.world, null, 2));
            const saved = await store.put(world, { expectedLocalRevision: old?.localRevision || 0, cloudRevision: data.revision, cloudUpdatedAt: data.updatedAt });
            assertAlive();
            ctx.world = saved.world;
            ctx.record = saved;
            ctx.readOnly = false;
            ctx.view = 'overview';
            await refreshRows();
            history.pushState(null, '', '#' + url());
            draw(true);
            notice(saved.durable ? 'Đã tải bản máy chủ và lưu trên thiết bị.' : store.status().error);
        }
        async function browserChange(next) { if (ctx.readOnly) {
            ctx.world = M.universe(next);
            draw();
        }
        else
            await change(next); if (ctx.view !== 'internet')
            pane('internet', false); }
        async function generation(form) {
            const f = Object.fromEntries(new FormData(form));
            ctx.draft = { premise: f.premise, provider: f.provider, settings: M.settings({ ...f, creativity: Number(f.creativity), epochYear: Number(f.epochYear) }) };
            M.text(f.premise, 2000);
            operationController = new AbortController();
            stopPortal();
            const body = host.querySelector('[data-mv-body]');
            body.innerHTML = '<section class="mv-generation" aria-live="polite"><span class="mv-spinner" aria-hidden="true"></span><small>REALITY FORGE / ' + (f.provider === 'gemini' ? 'GEMINI' : 'OFFLINE RULE MODEL') + '</small><h2>Đang dựng cấu trúc thực tại…</h2><p>Chuẩn bị quy luật, địa điểm và nhân vật. Chỉ lưu sau khi dữ liệu hợp lệ.</p>' + V.button('cancel-operation', 'Hủy tạo') + '</section>';
            try {
                const world = f.provider === 'gemini' ? M.universe((await api('generate', { method: 'POST', body: { premise: f.premise, settings: ctx.draft.settings }, signal: operationController.signal })).world) : E.create(f.premise, ctx.draft.settings);
                assertAlive();
                if (operationController.signal.aborted)
                    throw new DOMException('Aborted', 'AbortError');
                await localCreate(world);
            }
            catch (e) {
                if (alive) {
                    draw(true);
                    notice(e.name === 'AbortError' ? 'Đã hủy tạo. Giả định và thiết lập được giữ.' : e.message + ' Bạn có thể chọn Offline và thử lại.');
                }
            }
            finally {
                operationController = null;
            }
        }
        async function chat(form) {
            writable();
            const f = Object.fromEntries(new FormData(form)), id = M.id(form.dataset.id), question = M.text(f.question, 2000);
            ctx.chatDraft = question;
            ctx.chatProvider = f.provider;
            const fingerprint = E.fingerprint(ctx.world);
            let result;
            if (f.provider === 'gemini') {
                const context = I.chatContext(ctx.world, id), yes = await dialog('Gửi ngữ cảnh cho Gemini?', '<p>Chỉ nhân vật, quy luật và các sự kiện thuộc mốc đang xem cùng tối đa6 lượt hội thoại đúng nhánh được đưa vào prompt. Không có nhật ký hoặc tri thức tương lai.</p><details><summary>Xem ngữ cảnh</summary><pre>' + V.esc(JSON.stringify(context, null, 2)) + '</pre></details><p>' + V.esc(question) + '</p>', { confirm: 'Gửi cho Gemini' });
                if (!yes)
                    return;
                const payload = M.publicView(ctx.world);
                payload.conversations = ctx.world.conversations.filter(t => t.characterId === id && t.branchId === ctx.world.current.branchId && E.lineage(ctx.world, ctx.world.current.snapshotId).some(s => s.id === t.snapshotId)).slice(-6);
                notice('Gemini đang trả lời theo mốc đang chọn…');
                operationController = new AbortController();
                try {
                    result = (await api('character', { method: 'POST', body: { world: payload, characterId: id, question }, signal: operationController.signal })).result;
                }
                finally {
                    operationController = null;
                }
            }
            else
                result = I.offlineChat(ctx.world, id, question);
            if (fingerprint !== E.fingerprint(ctx.world))
                throw Error('Mốc đã đổi trong lúc trả lời; câu trả lời chưa được ghi. Hãy gửi lại tại mốc mới.');
            await change(I.saveChat(ctx.world, id, question, result), 'Đã lưu hội thoại ' + (f.provider === 'gemini' ? 'Gemini.' : 'mô phỏng offline.'));
            ctx.chatDraft = '';
            draw();
            host.querySelector('[name="question"]')?.focus({ preventScroll: true });
        }
        async function publish(form) {
            writable();
            const f = Object.fromEntries(new FormData(form)), visibility = f.visibility, allowClone = f.allowClone === 'on', yes = await dialog('Xác nhận ảnh chụp chia sẻ', '<p>' + V.esc(ctx.world.name) + ' · ' + ctx.world.branches.length + ' nhánh · ' + ctx.world.events.length + ' sự kiện.</p><p>Chế độ: ' + V.esc(visibility) + '. ' + (visibility === 'private' ? 'Thu hồi truy cập liên kết hiện tại.' : 'Ảnh chụp bỏ nhật ký, hội thoại và lịch sử duyệt. ' + (visibility === 'public' ? 'Nội dung phải được quản trị duyệt trước khi hiển thị.' : 'Ai có liên kết đều xem được.')) + '</p><p>' + (allowClone ? 'Cho phép sao chép thành vũ trụ riêng.' : 'Ứng dụng không cung cấp nút sao chép; nội dung hiển thị vẫn có thể được người xem ghi lại.') + '</p>', { confirm: visibility === 'private' ? 'Thu hồi' : 'Đồng bộ và gửi ảnh chụp' });
            if (!yes)
                return;
            const saved = await sync(), data = await api('publish', { method: 'POST', body: { id: ctx.world.id, revision: saved.revision, visibility, allowClone } });
            ctx.share = data;
            draw();
            notice(visibility === 'public' ? 'Đã gửi chờ duyệt; chưa xuất bản công khai.' : visibility === 'private' ? 'Đã thu hồi liên kết.' : 'Máy chủ đã tạo ảnh chụp chia sẻ chỉ đọc.');
        }
        async function perform(action, node) {
            const id = node?.dataset.id;
            if (action === 'open-art') { showArtwork(id); return; }
            if (action === 'gallery-random') { const rows = G.filtered(ctx); if (rows.length) showArtwork(rows[Math.floor(Math.random()*rows.length)].id); return; }
            if (action === 'previous-art' || action === 'next-art') { moveArtwork(action === 'previous-art' ? -1 : 1); return; }
            if (action === 'close-art') { const el = host.querySelector('[data-mv-dialog]'); if (el.close) el.close(); else { el.removeAttribute('open'); closeDialog({target:el}); } return; }
            if (action === 'art-create') { host.querySelector('[data-mv-dialog]').close(); navigate('/multiverse/create?sample=' + Number(node.dataset.index)); return; }
            if (action === 'gallery-filter') {
                if (!G.CATEGORIES.includes(node.dataset.kind)) return;
                ctx.galleryFilter = node.dataset.kind;
                ctx.gallery = G.filters({...ctx.gallery, page:1});
                history.replaceState(null, '', '#/multiverse/gallery?category=' + ctx.galleryFilter);
                draw();
                host.querySelector('[data-mv-action="gallery-filter"][data-kind="'+ctx.galleryFilter+'"]')?.focus({preventScroll:true});
                return;
            }
            if (action === 'gallery-favorite') {
                ctx.artCollection = G.toggleFavorite(ctx.artCollection, id);
                draw();
                if (collectionProtected) notice('Đã lưu trong phiên. Bộ sưu tập cũ cần phiên bản khác nên được giữ nguyên trên thiết bị.');
                else {
                    try { root.localStorage.setItem(collectionKey, JSON.stringify(ctx.artCollection)); notice('Đã cập nhật bộ sưu tập trên thiết bị theo tài khoản.'); }
                    catch { notice('Đã cập nhật trong phiên; chưa lưu được bộ sưu tập trên thiết bị.'); }
                }
                host.querySelector('[data-mv-action="gallery-favorite"][data-id="'+id+'"]')?.focus({preventScroll:true});
                return;
            }
            if (action === 'gallery-favorites' || action === 'gallery-page') {
                ctx.gallery = G.filters({...ctx.gallery, ...(action === 'gallery-favorites' ? {favoritesOnly:!ctx.gallery.favoritesOnly,page:1} : {page:Number(node.dataset.page)})});
                draw();
                host.querySelector(action === 'gallery-favorites' ? '[data-mv-action="gallery-favorites"]' : '[data-mvg-result]')?.focus({preventScroll:action === 'gallery-favorites'});
                return;
            }
            if (action === 'explorer-location' || action === 'explorer-zoom' || action === 'explorer-reset') {
                ctx.explorer = X.state({...ctx.explorer, ...(action === 'explorer-location' ? {locationId:id} : {zoom:action === 'explorer-reset'?1:ctx.explorer.zoom+Number(node.dataset.delta)})}, ctx.world);
                draw();
                host.querySelector(action === 'explorer-location' ? '[data-mv-action="explorer-location"][data-id="'+ctx.explorer.locationId+'"]' : action === 'explorer-reset' ? '[data-mv-action="explorer-reset"]' : '[data-mv-action="explorer-zoom"][data-delta="'+node.dataset.delta+'"]')?.focus({preventScroll:true});
                return;
            }
            if (action === 'compact-header') { saveVisual({...ctx.visual, compact:!ctx.visual.compact}); draw(); return; }
            if (action === 'cancel-operation') {
                operationController?.abort();
                return;
            }
            if (action === 'retry') {
                await initialize();
                return;
            }
            if (action === 'random') {
                ctx.draft.premise = E.SAMPLES[Math.floor(Math.random() * E.SAMPLES.length)][1];
                if (ctx.world)
                    navigate('/multiverse/create');
                else
                    draw(true);
                return;
            }
            if (action === 'sample') {
                ctx.draft.premise = E.SAMPLES[Number(node.dataset.index)]?.[1] || E.SAMPLES[0][1];
                navigate('/multiverse/create?sample=' + node.dataset.index);
                return;
            }
            if (action === 'toggle-motion') {
                ctx.motion = !ctx.motion;
                stopPortal();
                draw(true);
                return;
            }
            if (action === 'enable-3d') {
                if (host.querySelector('[data-mv-portal]')?.dataset.renderer === '2d')
                    stopPortal();
                await startPortal(true);
                return;
            }
            if (action === 'open-timeline') {
                if (ctx.world)
                    pane('timeline');
                else {
                    notice('Tạo hoặc mở một vũ trụ để xem timeline có dữ liệu.');
                    host.querySelector('textarea')?.focus();
                }
                return;
            }
            if (action === 'open-world') {
                navigate('/multiverse/universe/' + M.id(id));
                return;
            }
            if (action === 'duplicate-world') {
                await localCreate(E.duplicate(await recordWorld(id)));
                return;
            }
            if (action === 'copy-shared') {
                if (!ctx.allowClone)
                    throw Error('Chủ sở hữu chưa cho phép sao chép.');
                await localCreate(E.duplicate(ctx.world));
                return;
            }
            if (action === 'export-json') {
                if (ctx.readOnly && !ctx.allowClone)
                    throw Error('Chưa cho phép xuất bản chia sẻ.');
                const w = await recordWorld(id || ctx.world.id);
                download(w.id + '.json', M.serialize(w));
                notice('Đã chuẩn bị JSON. Hội thoại và nhật ký riêng có trong bản xuất của chủ sở hữu.');
                return;
            }
            if (action === 'export-raw') {
                const row = await store.get(id);
                download(id + '-original.json', JSON.stringify(row?.world ?? row, null, 2));
                return;
            }
            if (action === 'delete-world') {
                const row = await store.get(id);
                if (await dialog('Xóa bản trên thiết bị?', '<p>' + V.esc(row?.world?.name || id) + '</p><p>Bản máy chủ được quản lý riêng. Xuất JSON trước nếu bạn cần bản sao.</p>', { confirm: 'Xóa trên thiết bị', danger: true })) {
                    await store.remove(id);
                    await refreshRows();
                    if (ctx.world?.id === id)
                        navigate('/multiverse/my-universes');
                    else
                        draw();
                    notice('Đã xóa bản trên thiết bị.');
                }
                return;
            }
            if (action === 'load-cloud') {
                await loadCloud();
                return;
            }
            if (action === 'download-cloud') {
                await downloadCloud(id || ctx.world.id);
                return;
            }
            if (action === 'delete-cloud') {
                if (await dialog('Xóa bản máy chủ?', '<p>Liên kết chia sẻ sẽ bị thu hồi. Bản trên thiết bị vẫn được giữ. ID đã xóa không thể đồng bộ lại; cần sao chép thành ID mới.</p>', { confirm: 'Xóa máy chủ', danger: true })) {
                    await api('worlds', { method: 'DELETE', body: { id, revision: Number(node.dataset.revision) } });
                    await loadCloud();
                    notice('Máy chủ xác nhận đã xóa và thu hồi liên kết.');
                }
                return;
            }
            if (action === 'explore-public') {
                ctx.publicError = '';
                try {
                    ctx.publicRows = (await api('explore')).universes;
                }
                catch (e) {
                    ctx.publicError = e.message;
                    ctx.publicRows = [];
                }
                draw();
                return;
            }
            if (action === 'load-moderation') {
                ctx.moderation = await api('moderation');
                draw();
                return;
            }
            if (action === 'copy-share') {
                const field = host.querySelector('[data-mv-share-url]');
                if (!field)
                    throw Error('Chưa có liên kết được máy chủ xác nhận.');
                try {
                    await navigator.clipboard.writeText(field.value);
                    notice('Đã sao chép liên kết.');
                }
                catch {
                    field.focus();
                    field.select();
                    notice('Chưa truy cập clipboard. Liên kết đã được chọn để bạn sao chép.');
                }
                return;
            }
            if (action === 'report-share') {
                const answer = await dialog('Báo cáo ảnh chụp', V.area('Nội dung cần xem xét', 'reason', '', 'rows="3" required maxlength="1200"'), { confirm: 'Gửi báo cáo' });
                if (answer) {
                    await api('report', { method: 'POST', body: { token: sharedToken, reason: answer.reason } });
                    notice('Máy chủ đã nhận báo cáo.');
                }
                return;
            }
            if (action === 'view') {
                pane(node.dataset.view);
                return;
            }
            if (action === 'browse') {
                await browserChange(I.browse(ctx.world, node.dataset.address));
                return;
            }
            if (action === 'new-tab') {
                await browserChange(I.browse(ctx.world, 'sim://home', { newTab: true }));
                return;
            }
            if (action === 'close-tab') {
                await browserChange(I.closeTab(ctx.world, id));
                return;
            }
            if (action === 'switch-tab') {
                const w = M.clone(ctx.world);
                w.browser.activeTab = M.id(id);
                await browserChange(w);
                return;
            }
            if (action === 'browser-back' || action === 'browser-forward') {
                await browserChange(I.back(ctx.world, action === 'browser-back' ? -1 : 1));
                return;
            }
            if (action === 'bookmark') {
                await browserChange(I.bookmark(ctx.world));
                return;
            }
            if (action === 'snapshot') {
                const w = E.select(ctx.world, ctx.world.current.branchId, id);
                if (ctx.readOnly) {
                    ctx.world = w;
                    draw();
                }
                else
                    await change(w);
                return;
            }
            if (action === 'open-branch') {
                const w = E.select(ctx.world, id);
                if (ctx.readOnly) {
                    ctx.world = w;
                    draw();
                }
                else
                    await change(w);
                return;
            }
            if (action === 'undo-branch') {
                const b = E.branch(ctx.world);
                if (!b.parentId)
                    throw Error('Bạn đang ở nhánh gốc.');
                const w = E.select(ctx.world, b.parentId, b.forkSnapshotId);
                if (ctx.readOnly) {
                    ctx.world = w;
                    draw();
                }
                else
                    await change(w, 'Đã trở về mốc trước phân nhánh. Tương lai đã tạo vẫn được giữ.', 'timeline');
                return;
            }
            if (action === 'character') {
                ctx.characterId = id;
                ctx.chatDraft = '';
                pane('characters', false);
                const detail = host.querySelector('[data-mv-character-detail]');
                detail?.scrollIntoView({ block: 'start', behavior: 'instant' });
                detail?.focus({ preventScroll: true });
                return;
            }
            if (action === 'export-story' || action === 'export-text') {
                if (ctx.readOnly && !ctx.allowClone)
                    throw Error('Chưa cho phép xuất.');
                download(ctx.world.id + (action === 'export-text' ? '.txt' : '.md'), I.story(ctx.world), action === 'export-text' ? 'text/plain' : 'text/markdown');
                return;
            }
            writable();
            if (action === 'advance') {
                await change(E.advance(ctx.world, Number(node.dataset.days)), 'Đã tạo sự kiện và snapshot cho mốc mới.');
                return;
            }
            if (action === 'apply-decision') {
                if (!ctx.preview)
                    throw Error('Tạo bản xem trước trước khi Apply.');
                const next = E.apply(ctx.world, ctx.preview);
                await change(next, 'Đã áp dụng vào nhánh mới; nhánh gốc được giữ.', 'branches');
                return;
            }
            if (action === 'discard-preview') {
                ctx.preview = null;
                draw();
                return;
            }
            if (action === 'social-choice') {
                const c = ctx.projection.characters.find(c => c.id === id);
                ctx.decision = { text: 'Thảo luận công khai đề xuất của ' + (c?.name || 'cộng đồng'), category: 'culture' };
                ctx.preview = E.preview(ctx.world, ctx.decision.text, 'culture');
                pane('butterfly');
                return;
            }
            if (action === 'buy') {
                await change(E.buy(ctx.world, id), 'Đã trao đổi bằng tín dụng mô phỏng, không dùng tiền thật.');
                return;
            }
            if (action === 'copy-branch') {
                await change(E.fork(E.select(ctx.world, id), ('Bản sao ' + ctx.world.branches.find(b => b.id === id).name).slice(0, 100)), 'Đã tạo nhánh riêng.');
                return;
            }
            if (action === 'rename-branch') {
                const branch = ctx.world.branches.find(b => b.id === id), answer = await dialog('Đổi tên nhánh', V.field('Tên nhánh', 'name', branch?.name, 'maxlength="100" required'));
                if (answer)
                    await change(E.renameBranch(ctx.world, id, answer.name), 'Đã đổi tên nhánh.');
                return;
            }
            if (action === 'delete-branch') {
                if (await dialog('Xóa nhánh lá?', '<p>Các snapshot, sự kiện và hội thoại riêng của nhánh sẽ bị xóa. Nhánh cha được giữ.</p>', { confirm: 'Xóa nhánh', danger: true }))
                    await change(E.removeBranch(ctx.world, id), 'Đã xóa nhánh lá.');
                return;
            }
            if (action === 'clear-chat') {
                if (await dialog('Xóa hội thoại tại nhánh này?', '<p>Chỉ xóa hội thoại của nhân vật này trong nhánh đang xem.</p>', { confirm: 'Xóa hội thoại', danger: true })) {
                    const w = M.clone(ctx.world);
                    w.conversations = w.conversations.filter(t => t.characterId !== id || t.branchId !== w.current.branchId);
                    await change(w, 'Đã xóa hội thoại nhánh này.');
                }
                return;
            }
            if (action === 'capsule') {
                const c = ctx.world.capsules.find(c => c.id === id);
                if (!c)
                    throw Error('Mốc ghi nhớ không tồn tại.');
                await change(E.select(ctx.world, c.branchId, c.snapshotId), 'Đã trở lại mốc ghi nhớ.', 'timeline');
                return;
            }
            if (action === 'sync') {
                await sync();
                draw();
                return;
            }
            throw Error('Thao tác chưa được hỗ trợ.');
        }
        async function submit(form) {
            const f = Object.fromEntries(new FormData(form)), name = form.dataset.mvForm;
            if (name === 'gallery-search') {
                ctx.gallery = G.filters({...ctx.gallery, query:f.q, tone:f.tone, theme:f.theme, page:1});
                draw(); host.querySelector('[data-mvg-result]')?.focus({preventScroll:true}); return;
            }
            if (name === 'explorer-search') {
                ctx.explorer = X.state({...ctx.explorer, query:f.q, kind:f.kind}, ctx.world);
                draw(); host.querySelector('[data-mv-form="explorer-search"] [name=q]')?.focus({preventScroll:true}); return;
            }
            if (name === 'quick-create') {
                ctx.draft.premise = M.text(f.premise, 2000);
                navigate('/multiverse/create?premise=' + encodeURIComponent(ctx.draft.premise));
                return;
            }
            if (name === 'create') {
                await generation(form);
                return;
            }
            if (name === 'library-filter') {
                ctx.filters = { q: f.q, mode: f.mode, sort: f.sort };
                draw();
                return;
            }
            if (name === 'address') {
                await browserChange(I.browse(ctx.world, f.address));
                return;
            }
            if (name === 'search') {
                await browserChange(I.browse(ctx.world, 'sim://search?q=' + encodeURIComponent(f.q || f.query || '')));
                return;
            }
            if (name === 'compare') {
                ctx.compare = { left: f.left, right: f.right };
                draw();
                return;
            }
            if (name === 'review') {
                await api('moderation', { method: 'PATCH', body: { id: form.dataset.id, revision: Number(form.dataset.revision), status: f.status, note: f.note } });
                ctx.moderation = await api('moderation');
                draw();
                notice('Máy chủ đã ghi nhận quyết định duyệt.');
                return;
            }
            writable();
            if (name === 'advance') {
                await change(E.advance(ctx.world, Number(f.days)), 'Đã du hành đến mốc mới.');
                return;
            }
            if (name === 'preview') {
                ctx.decision = { text: f.decision, category: f.category };
                ctx.preview = E.preview(ctx.world, f.decision, f.category);
                draw();
                notice('Đây là xem trước; trạng thái vũ trụ chưa thay đổi.');
                return;
            }
            if (name === 'fork') {
                await change(E.fork(ctx.world, f.name), 'Đã tạo nhánh từ mốc hiện tại.');
                return;
            }
            if (name === 'chat') {
                await chat(form);
                return;
            }
            if (name === 'journal') {
                await change(E.addJournal(ctx.world, f.text), 'Đã lưu ghi chú riêng.');
                return;
            }
            if (name === 'capsule') {
                await change(E.capsule(ctx.world, f.name), 'Đã lưu mốc ghi nhớ.');
                return;
            }
            if (name === 'rename-world') {
                const w = M.clone(ctx.world);
                w.name = M.text(f.name, 100);
                w.updatedAt = new Date().toISOString();
                await change(w, 'Đã lưu tên vũ trụ.');
                return;
            }
            if (name === 'publish') {
                await publish(form);
                return;
            }
            throw Error('Biểu mẫu chưa được hỗ trợ.');
        }
        async function run(fn) { if (busy)
            return; busy = true; const shell = host.querySelector('[data-hh-multiverse]'); shell?.setAttribute('aria-busy', 'true'); try {
            await fn();
        }
        catch (e) {
            if (alive)
                notice(e.name === 'AbortError' ? 'Yêu cầu đã hủy hoặc hết thời gian; dữ liệu đang làm được giữ.' : e.message);
        }
        finally {
            busy = false;
            host.querySelector('[data-hh-multiverse]')?.removeAttribute('aria-busy');
        } }
        const click = e => { const view = e.target.closest('[data-mv-view]'); if (view && ctx.world) {
            e.preventDefault();
            if (!busy)
                pane(view.dataset.mvView);
            return;
        } const button = e.target.closest('[data-mv-action]'); if (!button || !host.contains(button) || button.disabled)
            return; if (button.dataset.mvAction === 'cancel-operation') {
            operationController?.abort();
            return;
        } e.preventDefault(); run(() => perform(button.dataset.mvAction, button)); };
        const formEvent = e => { if (!e.target.matches('[data-mv-form]'))
            return; e.preventDefault(); run(() => submit(e.target)); };
        const input = e => { if (e.target.name === 'creativity') {
            const o = host.querySelector('[data-mv-creativity]');
            if (o)
                o.textContent = e.target.value;
        } if (e.target.name === 'premise' && e.target.closest('[data-mv-form="create"]')) {
            const aside = host.querySelector('[data-mv-draft-art]'), id = A.forWorld({premise:e.target.value}).id;
            if (aside && aside.dataset.current !== id) { aside.dataset.current = id; aside.innerHTML = V.picture(id,{className:'mv-create-art',sizes:'400px'}); }
        } if (e.target.matches('[data-mv-snapshot-range]') && ctx.world) {
            const path = E.lineage(ctx.world, E.branch(ctx.world).headId), s = path[Number(e.target.value)], o = host.querySelector('[data-mv-snapshot-label]');
            if (o && s)
                o.textContent = 'Năm ' + E.year(ctx.world, s) + ' · ngày+' + s.day;
        } };
        const changeEvent = e => {
            if (e.target.name === 'visualPalette') { saveVisual({...ctx.visual,palette:e.target.value}); return; }
            if (e.target.matches('[data-mv-snapshot-range]') && ctx.world) {
                const path = E.lineage(ctx.world, E.branch(ctx.world).headId), s = path[Number(e.target.value)];
                if (s)
                    run(() => perform('snapshot', { dataset: { id: s.id } }));
            }
            if (e.target.name === 'importUniverse' && e.target.files?.[0]) {
                const file = e.target.files[0];
                run(async () => { if (file.size > M.MAX_BYTES)
                    throw Error('Tệp vượt750KB. Không có dữ liệu nào bị ghi đè.'); const world = M.parse(await file.text()), yes = await dialog('Nhập vũ trụ JSON', '<p>' + V.esc(world.name) + ' · ' + world.branches.length + ' nhánh · ' + world.events.length + ' sự kiện.</p><p>Tạo ID mới để giữ nguyên các bản đang có. Nguồn được ghi là JSON IMPORT; không tự xác nhận nội dung là do AI tạo.</p>', { confirm: 'Nhập thành bản riêng' }); if (yes)
                    await localCreate(E.duplicate(world, { imported: true })); });
            }
        };
        const shortcut = e => { if (!ctx.world || busy || e.defaultPrevented || e.ctrlKey || e.metaKey || !e.altKey || e.target.closest('input,textarea,select,[contenteditable=true]') || host.querySelector('dialog[open]'))
            return; const target = { i: 'internet', t: 'timeline', b: 'branches', n: 'butterfly', l: 'settings' }[e.key.toLowerCase()]; if (target) {
            e.preventDefault();
            pane(target);
        } };
        const motionChange = () => { ctx.motion = !reduce.matches; stopPortal(); if (loaded)
            draw(true); };
        const imageError = e => {
            if (e.target?.matches?.('img[data-mv-image]')) {
                const node = e.target.closest('.mv-art');
                if (node) { node.classList.add('mv-art-failed'); node.setAttribute('aria-label','Chưa tải được ảnh: '+(A.find(node.dataset.art)?.description||'tranh minh họa')); }
            }
        };
        const artworkKeys = e => {
            if (!ctx.lightboxId || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); moveArtwork(e.key === 'ArrowLeft' ? -1 : 1); }
        };
        host.addEventListener('click', click);
        host.addEventListener('submit', formEvent);
        host.addEventListener('input', input);
        host.addEventListener('change', changeEvent);
        host.addEventListener('close', closeDialog, true);
        host.addEventListener('error', imageError, true);
        document.addEventListener('keydown', artworkKeys);
        document.addEventListener('keydown', shortcut);
        reduce.addEventListener('change', motionChange);
        async function initialize() {
            try {
                await store.ready;
                await refreshRows();
                assertAlive();
                const route = options.route || '/multiverse', params = new URLSearchParams(String(route).split('?')[1] || '');
                if (params.has('sample'))
                    ctx.draft.premise = E.SAMPLES[Number(params.get('sample'))]?.[1] || '';
                if (params.has('premise'))
                    ctx.draft.premise = params.get('premise').slice(0, 2000);
                await inspectRoute(route);
                loaded = true;
                draw(true);
                if (store.status().error)
                    notice(store.status().error);
                api('status').then(data => { ctx.service = data; if (alive && ctx.routeView === 'create' && !busy && !host.querySelector('form:focus-within'))
                    draw(); }).catch(() => { });
            }
            catch (e) {
                if (alive) {
                    loaded = true;
                    host.innerHTML = '<section class="mv"><div class="mv-panel" role="alert"><h1>Chưa mở được thực tại</h1><p>' + V.esc(e.message) + '</p><div class="mv-actions">' + V.link('/multiverse/my-universes', 'Mở thư viện', 'mv-primary') + V.link('/multiverse', 'Trang chủ') + V.button('retry', 'Thử lại') + '</div></div></section>';
                }
            }
        }
        active = { destroy() { alive = false; life.abort(); operationController?.abort(); for (const c of pending)
                c.abort(); stopPortal(); store.close(); if (modalResolve) {
                modalResolve(null);
                modalResolve = null;
            } host.removeEventListener('click', click); host.removeEventListener('submit', formEvent); host.removeEventListener('input', input); host.removeEventListener('change', changeEvent); host.removeEventListener('close', closeDialog, true); host.removeEventListener('error', imageError, true); document.removeEventListener('keydown', artworkKeys); document.removeEventListener('keydown', shortcut); reduce.removeEventListener('change', motionChange); host.innerHTML = ''; } };
        initialize();
        return { unmount };
    }
    function unmount() { active?.destroy(); active = null; }
    root.HHMultiverse = Object.freeze({ mount, unmount });
})(typeof globalThis !== 'undefined' ? globalThis : this);
