(function(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HHGalaxyLivingUniverse = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(scope) {
  'use strict';
  const KEY = 'hh.galaxy.universe.v1';
  const COLORS = ['#bca1ff','#64ddce','#ffaf91','#f394d9','#9ee8aa','#efcf82','#8acafa','#dc9dce','#82e4ea','#9caefe','#c0bde6'];
  const clamp = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validRoute = value => typeof value === 'string' && /^\/(?!\/)[a-z0-9/_-]+$/i.test(value);
  function systemForTool(tool) {
    if (tool.id === 'creator-studio' || tool.route === '/create/workflow') return 'creator';
    if (tool.id === 'analytics' || tool.route === '/analytics') return 'analytics';
    if (tool.id === 'settings' || tool.route === '/settings') return 'settings';
    return tool.planet;
  }
  function buildCatalog(manifest = [], tools = []) {
    const seen = new Set();
    return manifest.filter(item => item.id !== 'home' && !item.adminOnly && validRoute(item.route)).map((item, index) => {
      const children = tools.filter(tool => systemForTool(tool) === item.id && !tool.adminOnly && validRoute(tool.route) && tool.route !== item.route && !seen.has(tool.route)).map(tool => {
        seen.add(tool.route);
        return { id: tool.id, route: tool.route, title: tool.title, description: tool.description || 'Mở công cụ hiện có trong HH Platform. Khả năng trực tuyến phụ thuộc cấu hình của workspace.', color: COLORS[index % COLORS.length], children: [] };
      });
      return { id: item.id, route: item.route, title: item.title || item.label, description: item.description, color: COLORS[index % COLORS.length], children };
    });
  }
  function normalizeState(value = {}, catalog = []) {
    const system = catalog.find(item => item.id === value.system);
    const visible = system ? system.children : catalog;
    return {
      version: 1, system: system?.id || '', selected: visible.some(item => item.route === value.selected) ? value.selected : '',
      quality: ['economy','balanced','cinematic'].includes(value.quality) ? value.quality : 'balanced', paused: value.paused === true,
      camera: { yaw: clamp(value.camera?.yaw, -Math.PI, Math.PI, 0.22), pitch: clamp(value.camera?.pitch, 0.24, 1.35, 0.78), distance: clamp(value.camera?.distance, 25, 95, 60) },
      overviewCamera: { yaw: clamp(value.overviewCamera?.yaw, -Math.PI, Math.PI, 0.22), pitch: clamp(value.overviewCamera?.pitch, 0.24, 1.35, 0.78), distance: clamp(value.overviewCamera?.distance, 25, 95, 60) }
    };
  }
  function effectiveQuality(requested, device = {}) {
    if (device.saveData || (device.memory > 0 && device.memory <= 4) || (device.cores > 0 && device.cores <= 4)) return 'economy';
    return ['economy','balanced','cinematic'].includes(requested) ? requested : 'balanced';
  }
  function mount(host, options = {}) {
    if (!host?.ownerDocument) return false;
    const doc = host.ownerDocument, catalog = buildCatalog(options.manifest, options.tools);
    if (!catalog.length) return false;
    const storage = options.storage, personal = options.personal || {};
    let raw = {}; try { raw = JSON.parse(storage?.getItem(KEY) || '{}'); } catch {}
    let state = normalizeState(raw || {}, catalog), renderer = null, destroyed = false, loading = false, view = 'map', filter = 'all', interactive = false;
    let visible = true, saveTimer = 0, loadToken = 0;
    const controller = new AbortController(), signal = controller.signal;
    const motionQuery = scope.matchMedia?.('(prefers-reduced-motion: reduce)');
    const contrastQuery = scope.matchMedia?.('(forced-colors: active)');
    const device = { saveData: scope.navigator?.connection?.saveData, memory: scope.navigator?.deviceMemory, cores: scope.navigator?.hardwareConcurrency };
    const prefs = () => scope.HHGalaxyCosmicStudio?.readPreferences(storage) || { favorites: [], recent: [] };
    host.innerHTML = `<section class="glu" aria-labelledby="glu-title" data-glu>
      <header class="glu-intro"><div><span class="glu-eyebrow">A LIVING CREATIVE UNIVERSE</span><h2 id="glu-title">Một thiên hà. Vô vàn ý tưởng.</h2><p>Chọn một hành tinh để khám phá; chỉ mở công cụ khi bạn sẵn sàng.</p></div><span class="glu-count">${catalog.length} vùng chức năng<br><small>Từ registry hiện có</small></span></header>
      <div class="glu-controls" role="group" aria-label="Điều khiển thế giới Galaxy">
        <button type="button" data-glu-action="overview">◎ Toàn cảnh</button><button type="button" data-glu-action="back" disabled>← Hệ trước</button>
        <button type="button" data-glu-action="interact" aria-pressed="false">Điều khiển 3D</button>
        <button type="button" data-glu-action="pause" aria-pressed="false">Tạm dừng chuyển động</button>
        <label>Đồ họa <select data-glu-quality aria-label="Chất lượng đồ họa"><option value="economy">Tiết kiệm</option><option value="balanced">Cân bằng</option><option value="cinematic">Điện ảnh</option></select></label>
      </div>
      <div class="glu-workspace"><div class="glu-space">
        <div class="glu-scene" data-glu-scene tabindex="0" role="group" aria-label="Vũ trụ 3D tương tác" aria-describedby="glu-help">
          <div class="glu-backdrop" aria-hidden="true"></div><div class="glu-canvas" data-glu-canvas></div>
          <div class="glu-scene-caption" aria-hidden="true"><span>HH / GALAXY</span><strong data-glu-scene-title>TOÀN THIÊN HÀ</strong></div>
          <span class="glu-render-status" data-glu-render-status role="status">Đang chuẩn bị cảnh 3D…</span>
        </div>
        <div class="glu-scene-footer"><p id="glu-help">Cuộn trang bình thường. Bật Điều khiển 3D để kéo / pinch / zoom. Esc để thoát; phím mũi tên để xoay, +/− để zoom.</p><div><button type="button" data-glu-action="zoom-in" aria-label="Phóng to cảnh">＋</button><button type="button" data-glu-action="zoom-out" aria-label="Thu nhỏ cảnh">−</button><button type="button" data-glu-action="retry" hidden>Thử lại 3D</button></div></div>
      </div><aside class="glu-inspector" aria-label="Thông tin hành tinh"><div data-glu-preview></div></aside></div>
      <section class="glu-directory" aria-label="Điểm đến Galaxy"><header><div><span class="glu-eyebrow" data-glu-location>TOÀN THIÊN HÀ</span><h3 data-glu-directory-title>Các hệ hành tinh</h3></div><div class="glu-filters" role="group" aria-label="Lọc điểm đến"><button type="button" data-glu-filter="all" aria-pressed="true">Tất cả</button><button type="button" data-glu-filter="favorites" aria-pressed="false">Yêu thích</button><button type="button" data-glu-filter="recent" aria-pressed="false">Gần đây</button></div></header><div class="glu-cards" data-glu-cards></div></section>
      <p class="glu-notice" data-glu-notice role="status">Góc nhìn lưu riêng trên thiết bị theo tài khoản. Không gửi dữ liệu ra ngoài.</p>
    </section>`;
    const root = host.querySelector('[data-glu]'), scene = root.querySelector('[data-glu-scene]');
    const query = selector => root.querySelector(selector);
    const notify = message => { query('[data-glu-notice]').textContent = message; };
    const currentSystem = () => catalog.find(item => item.id === state.system);
    const entries = () => currentSystem()?.children || catalog;
    const selected = () => entries().find(item => item.route === state.selected);
    const motion = () => !state.paused && !motionQuery?.matches;
    const quality = () => effectiveQuality(state.quality, device);
    const isFavorite = item => item.route.startsWith('/galaxy/') ? prefs().favorites.includes(item.route) : (personal.getFavorites?.() || []).includes(item.route);
    function save() {
      scope.clearTimeout(saveTimer);
      if (renderer) state.camera = renderer.getCamera();
      try { if (!storage) throw Error('storage'); storage.setItem(KEY, JSON.stringify(state)); }
      catch { notify('Chưa lưu được góc nhìn: kho cục bộ không khả dụng. Điều hướng vẫn hoạt động.'); }
    }
    function scheduleSave() { scope.clearTimeout(saveTimer); saveTimer = scope.setTimeout(save, 300); }
    function active() { return !destroyed && view === 'map' && visible && !doc.hidden && !contrastQuery?.matches; }
    function sync() {
      root.dataset.view = view;
      root.dataset.interactive = String(interactive);
      query('[data-glu-action="interact"]').setAttribute('aria-pressed', String(interactive));
      query('[data-glu-action="interact"]').textContent = interactive ? 'Thoát 3D · Esc' : 'Điều khiển 3D';
      query('[data-glu-action="pause"]').setAttribute('aria-pressed', String(!motion()));
      query('[data-glu-action="pause"]').textContent = motionQuery?.matches ? 'Đang giảm chuyển động' : state.paused ? 'Tiếp tục chuyển động' : 'Tạm dừng chuyển động';
      query('[data-glu-action="pause"]').disabled = !!motionQuery?.matches;
      query('[data-glu-quality]').value = state.quality;
      query('[data-glu-action="back"]').disabled = !state.system;
      renderer?.setOptions({ active: active(), motion: motion(), interactive, quality: quality() });
      if (contrastQuery?.matches) query('[data-glu-render-status]').textContent = 'Chế độ tương phản cao · sử dụng các điểm đến bên dưới.';
    }
    function paintPreview() {
      const item = selected();
      const target = item || currentSystem();
      const canPin = target && personal.canPersonalize?.(target.route);
      query('[data-glu-preview]').innerHTML = target ? `<span class="glu-eyebrow">${item ? 'ĐANG CHỌN' : 'HỆ HIỆN TẠI'}</span><div class="glu-portrait" style="--glu-accent:${target.color}" aria-hidden="true"></div><h3>${escape(target.title)}</h3><p>${escape(target.description)}</p><div class="glu-actions"><a class="glu-primary" href="#${escape(target.route)}" data-glu-open="${escape(target.route)}">Mở workspace ↗</a>${target.children.length ? `<button type="button" data-glu-system="${escape(target.id)}">Khám phá ${target.children.length} công cụ →</button>` : ''}<button type="button" data-glu-star="${escape(target.route)}" aria-pressed="${isFavorite(target)}" ${!target.route.startsWith('/galaxy/') && !canPin ? 'disabled title="Lưu mục cha bằng sidebar HH Platform"' : ''}>${isFavorite(target) ? '♥ Đã yêu thích' : '♡ Yêu thích'}</button>${canPin ? `<button type="button" data-glu-pin="${escape(target.route)}" aria-pressed="${(personal.getPins?.() || []).includes(target.route)}">${(personal.getPins?.() || []).includes(target.route) ? '★ Đã ghim' : '☆ Ghim sidebar'}</button>` : ''}</div><small>Công cụ mở trong khung HH Platform. Dịch vụ trực tuyến được kiểm tra tại workspace.</small>` : `<span class="glu-eyebrow">TRẠM ĐỊNH HƯỚNG</span><div class="glu-portrait glu-portrait--sun" aria-hidden="true"></div><h3>Ý tưởng bắt đầu từ đâu?</h3><p>Chạm vào một hành tinh hoặc chọn điểm đến bên dưới. Xem mô tả trước khi mở công cụ.</p><div class="glu-legend"><span><i></i> Hành tinh: vùng chức năng</span><span><i></i> Vệ tinh: công cụ trong hệ</span></div><p class="glu-small">Danh sách và bản đồ dùng cùng registry. Không có điểm đến giả.</p>`;
    }
    function paintCards() {
      const recent = [...prefs().recent, ...(personal.getRecent?.() || [])];
      let items = entries().filter(item => filter === 'all' || (filter === 'favorites' ? isFavorite(item) : recent.includes(item.route)));
      if (filter === 'recent') items.sort((a,b) => recent.indexOf(a.route) - recent.indexOf(b.route));
      query('[data-glu-cards]').innerHTML = items.length ? items.map(item => `<article class="glu-card" style="--glu-accent:${item.color}" data-selected="${item.route === state.selected}"><button type="button" data-glu-select="${escape(item.route)}" aria-pressed="${item.route === state.selected}"><span class="glu-mini-planet" aria-hidden="true"></span><span><strong>${escape(item.title)}</strong><small>${item.children.length ? `${item.children.length} công cụ trong hệ` : 'Workspace hiện có'}</small></span><span aria-hidden="true">↗</span></button>${view === 'list' ? `<p>${escape(item.description)}</p><a href="#${escape(item.route)}" data-glu-open="${escape(item.route)}">Mở workspace →</a>${item.children.length ? `<button type="button" data-glu-system="${escape(item.id)}">Khám phá công cụ</button>` : ''}` : ''}</article>`).join('') : '<p class="glu-empty">Chưa có điểm đến trong bộ lọc này. Chọn Tất cả để tiếp tục khám phá.</p>';
      root.querySelectorAll('[data-glu-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.gluFilter === filter)));
    }
    function select(route, focus = false) {
      if (!entries().some(item => item.route === route)) return;
      state.selected = route;
      renderer?.select(route, motion());
      paintPreview(); paintCards(); scheduleSave();
      if (focus) query('[data-glu-open]')?.focus({ preventScroll: true });
    }
    function setSystem(id) {
      if (id && !catalog.some(item => item.id === id && item.children.length)) return;
      if (!state.system && id) state.overviewCamera = renderer?.getCamera() || state.camera;
      state.system = id; state.selected = ''; filter = 'all';
      state.camera = id ? { yaw: 0.22, pitch: 0.78, distance: 52 } : { ...state.overviewCamera };
      updateWorld(); save();
      query('[data-glu-select]')?.focus({ preventScroll: true });
    }
    function updateWorld() {
      const system = currentSystem();
      query('[data-glu-location]').textContent = system ? `THIÊN HÀ / ${system.title}` : 'TOÀN THIÊN HÀ';
      query('[data-glu-directory-title]').textContent = system ? 'Công cụ trong hệ' : 'Các hệ hành tinh';
      query('[data-glu-scene-title]').textContent = system?.title || 'TOÀN THIÊN HÀ';
      renderer?.setWorld(entries(), system);
      renderer?.setCamera(state.camera, false);
      renderer?.select(state.selected, false);
      paintPreview(); paintCards(); sync();
    }
    async function loadRenderer() {
      if (loading || destroyed || renderer || contrastQuery?.matches || view !== 'map') return;
      loading = true; const token = ++loadToken;
      query('[data-glu-action="retry"]').hidden = true;
      query('[data-glu-render-status]').textContent = 'Đang tải cảnh 3D trên thiết bị…';
      try {
        const module = await import('./galaxy-universe-renderer.mjs?v=2');
        if (destroyed || token !== loadToken) return;
        renderer = module.mount(query('[data-glu-canvas]'), {
          onSelect: route => select(route), onCamera: scheduleSave,
          onStatus: message => { if (!destroyed) query('[data-glu-render-status]').textContent = message; },
          onError: () => { if (!destroyed) { query('[data-glu-render-status]').textContent = 'Không có WebGL hoặc kết nối đồ họa đã mất. Danh sách bên dưới vẫn hoạt động.'; query('[data-glu-action="retry"]').hidden = false; } },
          quality: quality(), camera: state.camera
        });
        updateWorld();
      } catch {
        query('[data-glu-render-status]').textContent = 'Chưa tải được 3D. Chọn điểm đến bên dưới hoặc thử lại.';
        query('[data-glu-action="retry"]').hidden = false;
      } finally { loading = false; }
    }
    function setView(next) {
      view = next === 'list' ? 'list' : 'map'; interactive = false;
      paintCards(); sync(); if (view === 'map') void loadRenderer();
    }
    host.addEventListener('hh:galaxy:universe-view', event => setView(event.detail?.view), { signal });
    root.addEventListener('click', event => {
      const button = event.target.closest('button,a'); if (!button || !root.contains(button)) return;
      if (button.dataset.gluSelect) { select(button.dataset.gluSelect, true); return; }
      if (button.dataset.gluSystem) { setSystem(button.dataset.gluSystem); return; }
      if (button.dataset.gluFilter) { filter = button.dataset.gluFilter; paintCards(); return; }
      if (button.dataset.gluOpen) { save(); if (options.navigate) { event.preventDefault(); options.navigate(button.dataset.gluOpen); } return; }
      const route = button.dataset.gluStar || button.dataset.gluPin;
      if (route) {
        try {
          if (button.dataset.gluPin) { if (personal.togglePin?.(route) !== true) throw Error('pin'); }
          else if (route.startsWith('/galaxy/')) {
            const next = prefs(); next.favorites = next.favorites.includes(route) ? next.favorites.filter(item => item !== route) : [...next.favorites, route];
            if (!scope.HHGalaxyCosmicStudio?.savePreferences(storage, next)) throw Error('storage');
          } else if (personal.toggleFavorite?.(route) !== true) throw Error('favorite');
          notify('Đã lưu trên thiết bị vào kho hiện có của tài khoản.'); paintPreview(); paintCards();
        } catch { notify('Chưa lưu được. Ghim sidebar tối đa 5 mục; kiểm tra quyền lưu trữ hoặc bỏ ghim một mục.'); }
        return;
      }
      switch (button.dataset.gluAction) {
        case 'overview': state.overviewCamera = { yaw: 0.22, pitch: 0.78, distance: 60 }; setSystem(''); break;
        case 'back': setSystem(''); break;
        case 'interact': interactive = !interactive; sync(); break;
        case 'pause': state.paused = !state.paused; sync(); save(); break;
        case 'zoom-in': renderer?.zoom(-6); save(); break;
        case 'zoom-out': renderer?.zoom(6); save(); break;
        case 'retry': renderer?.destroy(); renderer = null; void loadRenderer(); break;
      }
    }, { signal });
    root.addEventListener('change', event => {
      if (event.target.matches('[data-glu-quality]')) { state.quality = event.target.value; sync(); save(); notify(quality() !== state.quality ? 'Thiết bị / tiết kiệm dữ liệu: tự giới hạn ở mức Tiết kiệm.' : 'Đã áp dụng mức đồ họa.'); }
    }, { signal });
    root.addEventListener('keydown', event => {
      if (event.key === 'Escape') { interactive = false; sync(); query('[data-glu-action="interact"]').focus({ preventScroll: true }); }
      if (event.target === scene && interactive && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','=','Home'].includes(event.key)) {
        event.preventDefault(); renderer?.key(event.key); scheduleSave();
      }
    }, { signal });
    doc.addEventListener('visibilitychange', sync, { signal });
    scope.addEventListener?.('pagehide', save, { signal });
    motionQuery?.addEventListener?.('change', sync, { signal });
    contrastQuery?.addEventListener?.('change', () => { sync(); void loadRenderer(); }, { signal });
    const observer = scope.IntersectionObserver ? new scope.IntersectionObserver(records => { visible = records[0]?.isIntersecting !== false; sync(); }, { threshold: 0 }) : null;
    observer?.observe(scene);
    const initialPrefs = prefs(); view = initialPrefs.view;
    updateWorld(); void loadRenderer();
    return { setView, destroy() { if (destroyed) return; save(); destroyed = true; loadToken++; controller.abort(); observer?.disconnect(); scope.clearTimeout(saveTimer); renderer?.destroy(); renderer = null; host.replaceChildren(); } };
  }
  return Object.freeze({ buildCatalog, normalizeState, effectiveQuality, mount });
});
