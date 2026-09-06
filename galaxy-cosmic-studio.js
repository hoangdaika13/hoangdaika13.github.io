(function(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HHGalaxyCosmicStudio = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(scope) {
  'use strict';
  const KEY = 'hh.galaxy.cosmic-studio.v1';
  const ROUTES = Object.freeze([
    ['/galaxy/ai','AI Universe','Viết prompt, lưu hội thoại và làm việc với AI đã cấu hình.','✦','#bd91ff'],
    ['/galaxy/music','Music Planet','Nghe, sắp xếp playlist, cắt và phối âm thanh trên thiết bị.','♫','#58e0d4'],
    ['/galaxy/video','Video Planet','Chuẩn bị video, biên tập phụ đề và xuất dự án.','▶','#ffb27e'],
    ['/galaxy/creator','Creator Studio','Từ ý tưởng, kịch bản đến media và gói bàn giao.','✎','#ee8fdb'],
    ['/galaxy/games','Games World','Chơi, lưu tiến độ và điều chỉnh cách điều khiển.','⌘','#a5e986'],
    ['/galaxy/dev','Dev Planet','Soạn mã, xem trước, đối chiếu và xử lý dữ liệu.','</>','#f9d57b'],
    ['/galaxy/learning','Learning Star','Ghi chú, flashcard, ôn tập và kế hoạch học tập.','▣','#eabf79'],
    ['/galaxy/community','Community','Soạn bản nháp; chỉ kết nối và đăng khi bạn chủ động.','◎','#7ddfc1'],
    ['/galaxy/tools','Tools Galaxy','Markdown, JSON, CSV, QR và công cụ văn bản cục bộ.','◇','#8bcaf8'],
    ['/galaxy/analytics','Analytics','Đọc hoạt động cục bộ khi bạn đã bật đồng ý thu thập.','▥','#a5b5ff'],
    ['/galaxy/settings','Settings','Giao diện Galaxy, sao lưu, khôi phục và quản lý dữ liệu.','⚙','#c5acef']
  ].map(entry=>Object.freeze({route:entry[0],title:entry[1],description:entry[2],icon:entry[3],color:entry[4]})));
  const allowed = route => route === '/home' || ROUTES.some(item=>item.route === route);
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function accountId(user) {
    const id = user && !user.guest && (user.id || user._id || user.email);
    return id ? 'account-' + encodeURIComponent(String(id)) : 'device';
  }
  function accountStorage(storage, user) {
    if (!storage) return null;
    const id = accountId(user);
    if (id === 'device') return storage;
    const prefix = KEY + ':' + id + ':';
    return Object.freeze({
      hhGalaxyScope:id,
      getItem:key=>storage.getItem(prefix+key),
      setItem:(key,value)=>storage.setItem(prefix+key,String(value)),
      removeItem:key=>storage.removeItem(prefix+key)
    });
  }
  function readPreferences(storage) {
    let record;
    try {record=JSON.parse(storage?.getItem(KEY)||'null');} catch {}
    return {version:1, view:record?.view === 'list'?'list':'map', favorites:Array.isArray(record?.favorites)?record.favorites.filter(allowed).slice(0,12):[], recent:Array.isArray(record?.recent)?record.recent.filter(allowed).slice(0,6):[]};
  }
  function savePreferences(storage, prefs) {
    try {if(!storage) return false; storage.setItem(KEY,JSON.stringify(prefs)); return true;} catch {return false;}
  }
  const sensitive = /password|secret|token|api.?key|authorization|credential/i;
  function fieldKey(field, index) {
    const attrs = Array.from(field.attributes || []).filter(a=>a.name.startsWith('data-') && !/state|tone|status/.test(a.name)).map(a=>a.name+'='+a.value).sort().join('|');
    return [field.tagName,field.name||field.id||attrs||'field',index].join(':');
  }
  function draftFields(app) {
    return Array.from(app.querySelectorAll('.hgl1-main textarea, .hgl1-main input')).filter(field=> {
      const type=String(field.type||'text');
      return !field.disabled && !field.readOnly && (field.tagName==='TEXTAREA'||['text','url','search'].includes(type))
        && !field.closest('[data-hgl1-settings-form], [data-gcs-directory]')
        && !sensitive.test([field.name,field.id,field.autocomplete,field.getAttribute('aria-label'),...Array.from(field.attributes||[]).map(a=>a.name)].join(' '));
    });
  }
  function captureDraft(app) {
    const values={}; let length=0;
    draftFields(app).forEach((field,index)=> {const value=String(field.value||'');if(value.length<=100000 && length+value.length<=300000){values[fieldKey(field,index)]=value;length+=value.length;}});
    return values;
  }
  function restoreDraft(app,values) {
    if(!values || typeof values!=='object')return 0;
    let count=0;
    draftFields(app).forEach((field,index)=>{const value=values[fieldKey(field,index)];if(typeof value==='string' && value.length<=100000){field.value=value;count++;}});
    return count;
  }
  function mount(app, options={}) {
    if(!app || !allowed(options.route)) return null;
    const route=options.route, storage=options.storage;
    let prefs=readPreferences(storage), destroyed=false, dirty=false, timer=0;
    let session;try{session=scope.sessionStorage;}catch{}
    const draftKey=KEY+':draft:'+accountId(options.user)+':'+route;
    const owner=app.querySelector('.hgl1-main');if(!owner)return null;
    const toolbar=app.ownerDocument.createElement('section');toolbar.className='gcs-toolbar';
    toolbar.setAttribute('aria-label','Điều khiển HH Galaxy');
    const entry=ROUTES.find(item=>item.route===route);
    toolbar.innerHTML=`<div class="gcs-heading"><span class="gcs-mark" aria-hidden="true">✧</span><div><span class="gcs-eyebrow">HH GALAXY / COSMIC STUDIO</span><h1>${escape(entry?.title||'Không gian sáng tạo của bạn')}</h1></div></div><div class="gcs-controls">${route==='/home'?'<div class="gcs-view-switch" role="group" aria-label="Cách xem Galaxy"><button type="button" data-gcs-view="map">Bản đồ</button><button type="button" data-gcs-view="list">Danh sách</button></div>':`<button type="button" data-gcs-favorite aria-pressed="${prefs.favorites.includes(route)}">${prefs.favorites.includes(route)?'★ Đã yêu thích':'☆ Yêu thích'}</button>`}<button type="button" data-hgl1-action="open-command">Tìm công cụ <kbd>Ctrl K</kbd></button><a href="#/galaxy/settings" data-hgl1-route="/galaxy/settings" aria-label="Cài đặt Galaxy">⚙</a></div><p class="gcs-save-status" data-gcs-status role="status">Bản nháp giữ trong tab này. Tệp nguồn không tự tải lại; dữ liệu đã lưu vẫn ở thư viện.</p>`;
    owner.prepend(toolbar);
    const status=message=>{const output=toolbar.querySelector('[data-gcs-status]');if(output)output.textContent=message;};
    let draft;
    try {const raw=session?.getItem(draftKey);if(raw && raw.length<=650000)draft=JSON.parse(raw);} catch {}
    if(draft?.version===1 && restoreDraft(app,draft.values))status('Đã khôi phục bản nháp của tab. Dùng nút Lưu trong công cụ để lưu vào thư viện.');
    if(storage?.hhGalaxyScope)status('Kho riêng của tài khoản. Dữ liệu cũ trên thiết bị không tự nhập vào tài khoản; có thể nhập bản sao lưu trong Settings.');
    const persist=()=>{
      if(!dirty)return;
      try{if(!session)throw Error('unavailable');session.setItem(draftKey,JSON.stringify({version:1,values:captureDraft(app)}));status('Đã giữ bản nháp trong tab · chưa đồng nghĩa với lưu vào thư viện.');dirty=false;}
      catch{status('Chưa giữ được bản nháp. Hãy lưu hoặc xuất nội dung trước khi rời trang.');}
    };
    const input=event=>{if(!draftFields(app).includes(event.target))return;dirty=true;status('Đang giữ bản nháp…');scope.clearTimeout(timer);timer=scope.setTimeout(persist,400);};
    app.addEventListener('input',input);
    const visit=()=>{prefs.recent=[route,...prefs.recent.filter(r=>r!==route)].slice(0,6);savePreferences(storage,prefs);};visit();
    let directory=null;
    function paintDirectory(){
      if(!directory)return;
      const featured=prefs.favorites.length?ROUTES.filter(item=>prefs.favorites.includes(item.route)):[];
      directory.innerHTML=`<header><h2>Chọn công việc, bắt đầu ngay.</h2><p>11 workspace · dữ liệu trên thiết bị; các dịch vụ trực tuyến cần cấu hình riêng.</p></header>${featured.length?`<nav class="gcs-recent" aria-label="Workspace yêu thích">${featured.map(item=>`<a href="#${item.route}" data-hgl1-route="${item.route}">★ ${escape(item.title)}</a>`).join('')}</nav>`:''}<nav class="gcs-recent" aria-label="Workspace gần đây">${prefs.recent.filter(r=>r!=='/home').map(r=>{const item=ROUTES.find(i=>i.route===r);return item?`<a href="#${r}" data-hgl1-route="${r}">↗ ${escape(item.title)}</a>`:'';}).join('')}</nav><div class="gcs-directory-grid">${ROUTES.map(item=>`<article style="--gcs-accent:${item.color}"><span class="gcs-card-icon" aria-hidden="true">${escape(item.icon)}</span><h3>${escape(item.title)}</h3><p>${escape(item.description)}</p><footer><a href="#${item.route}" data-hgl1-route="${item.route}">Mở workspace ↗</a><button type="button" data-gcs-star="${item.route}" aria-label="Yêu thích ${escape(item.title)}" aria-pressed="${prefs.favorites.includes(item.route)}">${prefs.favorites.includes(item.route)?'★':'☆'}</button></footer></article>`).join('')}</div>`;
    }
    if(route==='/home'){
      directory=app.ownerDocument.createElement('section');directory.className='gcs-directory';directory.setAttribute('data-gcs-directory','');owner.append(directory);paintDirectory();
    }
    function setView(view){
      prefs.view=view;app.dataset.gcsView=view;
      toolbar.querySelectorAll('[data-gcs-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.gcsView===view)));
      const map=owner.querySelector('.hgl1-page--home');if(map){map.hidden=view==='list';map.inert=view==='list';}
      if(directory)directory.hidden=view!=='list';
      // Trigger the existing renderer's visibility observation; no extra canvas.
      if(view==='list')scope.dispatchEvent?.(new Event('resize'));
    }
    if(route==='/home')setView(prefs.view);
    const click=event=>{
      const view=event.target.closest('[data-gcs-view]');if(view){setView(view.dataset.gcsView);if(!savePreferences(storage,prefs))status('Chế độ xem chỉ giữ đến khi rời trang: kho lưu trữ không khả dụng.');return;}
      if(event.target.closest('[data-hgl1-route]')){persist();return;}
      const star=event.target.closest('[data-gcs-star],[data-gcs-favorite]');if(!star)return;
      const target=star.dataset.gcsStar||route;if(!allowed(target))return;
      prefs.favorites=prefs.favorites.includes(target)?prefs.favorites.filter(r=>r!==target):[...prefs.favorites,target];
      if(!savePreferences(storage,prefs)){status('Chưa lưu được yêu thích. Kiểm tra dung lượng hoặc quyền lưu trữ.');return;}
      star.setAttribute('aria-pressed',String(prefs.favorites.includes(target)));
      star.textContent=star.hasAttribute('data-gcs-favorite')?(prefs.favorites.includes(target)?'★ Đã yêu thích':'☆ Yêu thích'):(prefs.favorites.includes(target)?'★':'☆');
      status('Đã cập nhật yêu thích Galaxy. Ghim mục HH Galaxy vào sidebar bằng điều khiển của HH Platform.');
    };
    app.addEventListener('click',click);
    const pagehide=()=>persist();scope.addEventListener?.('pagehide',pagehide);
    return {capture:persist,destroy(){if(destroyed)return;persist();destroyed=true;scope.clearTimeout(timer);app.removeEventListener('input',input);app.removeEventListener('click',click);scope.removeEventListener?.('pagehide',pagehide);toolbar.remove();directory?.remove();}};
  }
  return Object.freeze({routes:ROUTES,accountId,accountStorage,readPreferences,savePreferences,captureDraft,restoreDraft,mount});
});
