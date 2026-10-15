(function (scope) {
  'use strict';
  const KEY = 'hh.graphic-design.interface.v1';
  const mounted = new WeakMap();
  const CATALOG = Object.freeze([
    ['vector','Vector & Motion Core','Vẽ Bézier, keyframe và chuyển một thời điểm thành frame có thể sửa trong tài liệu chung.','Chuyển tĩnh có kiểm tra: không chuyển timeline, mask, Trim Path hoặc scale không đều. Boolean đường cong trong tài liệu chung dùng sai số tối đa 0,25px; Arc SVG cần đổi sang Bézier.','vector logo bezier svg boolean chuyển frame'],
    ['nondestructive','Non-destructive Editing','Chỉnh ảnh bằng các bước có thể thay đổi lại.','Giữ bản gốc; kiểm tra mask/filter khi chuyển sang định dạng khác.','ảnh photo crop filter mask'],
    ['typography','Typography Studio Pro','Chỉnh chữ, màu, khoảng cách và text path.','Font cần được cấp phép; OpenType tùy theo font và engine.','chữ font type text'],
    ['effects','Node Effects Composer','Ghép hiệu ứng bằng graph có đầu vào/đầu ra.','Graph không hợp lệ cần sửa trước khi render; preview có thể giảm độ phân giải.','node blur glow mask'],
    ['quick-motion','Motion Maker','Tạo chuyển động ngắn bằng preset và keyframe.','Chỉ xuất định dạng engine hỗ trợ; JSON không phải video.','motion logo animation'],
    ['animation','Animation 2D','Dựng timeline và chỉnh keyframe 2D.','Preview chuyển động không đồng nghĩa hỗ trợ mọi codec xuất.','timeline frame easing'],
    ['state-machine','State Machine & Data Binding','Kiểm tra state, trigger và binding có kiểu.','Không chạy JavaScript tùy ý từ project nhập vào.','state interaction data'],
    ['3d','3D Scene Studio','Sắp xếp vật thể, camera và ánh sáng; lưu bản gốc model/texture trên thiết bị theo dự án.','GLB/glTF chỉ theo subset loader hiện hỗ trợ; dữ liệu gốc không đi kèm JSON scene. HDR/EXR, Draco/KTX2 và rig/skinning chưa được hỗ trợ.','3d model gltf glb camera texture khôi phục'],
    ['mockup','3D Device Mockup','Trình bày thiết kế trên khung thiết bị.','Kiểm tra khả năng phối cảnh/3D thực tế trước khi xuất.','mockup phone laptop device'],
    ['character','Character Creator','Chỉnh nhân vật, biểu cảm và pose.','Asset và rig thuộc engine nhân vật; không cam kết mô phỏng người thật.','character nhân vật rig pose'],
    ['simulation','Simulation Lab','Thử particle, lực và chuyển động có seed.','Mô phỏng thiết kế có giới hạn, không phải kết quả vật lý khoa học.','particle physics spring'],
    ['prototype','UI/UX Prototype','Nối frame và thử luồng tương tác.','Prototype cục bộ không phải ứng dụng production hoặc link chia sẻ máy chủ.','ui ux prototype flow'],
    ['motion','Motion & Video','Chỉnh bố cục motion và timeline.','Kiểm tra capability media/codec; không tự phát âm thanh.','video audio motion timeline'],
    ['adaptive','Adaptive Design','Tạo biến thể kích thước từ nội dung và constraint.','Preview và crop theo quy tắc; không phải AI hiểu hình ảnh.','responsive layout social'],
    ['data','Data-driven Design','Ánh xạ CSV/JSON và sinh biến thể.','Kiểm tra dòng lỗi, trường thiếu và giới hạn batch trước khi áp dụng.','csv json batch dữ liệu'],
    ['components','Component & Variant System','Quản lý master, instance và override.','Chuyển engine cần adapter; không tự flatten component.','component variant design system'],
    ['color','Professional Color Pipeline','Quản lý palette, contrast và chuyển đổi màu.','CMYK/soft proof là xấp xỉ khi không có profile ICC thực; không dùng làm bằng chứng chuẩn in.','color màu palette oklch'],
    ['projects','Project & Version Vault','Lưu dự án, asset, snapshot và khôi phục.','Gói JSON của engine riêng có thể không chứa binary; kiểm tra gói portable trước khi chuyển máy.','project version backup'],
    ['collaboration','Live Collaboration','Kết nối phòng, bình luận và quyền theo backend.','Chỉ online khi máy chủ xác nhận. Hiện không coi presence là đồng bộ toàn bộ document.','realtime team phòng'],
    ['review','Review & Approval','Ghim nhận xét và theo dõi phiên bản duyệt.','Chia sẻ local-browser-profile chỉ mở trong cùng hồ sơ trình duyệt, không phải link bảo mật online.','review comment approval'],
    ['dev-ai','Dev Mode & Controlled AI','Inspect thiết kế, token và công việc AI có xác nhận.','Heuristic cục bộ không phải AI provider; API ngoài cần cấu hình và sự đồng ý.','ai css handoff dev'],
    ['export','Export Center Pro','Xuất frame tài liệu chung thành SVG, PNG/JPEG/WebP hoặc PDF nhiều trang dạng ảnh; đóng gói asset gốc.','PDF tài liệu chung là ảnh RGB, không phải vector/chữ tìm kiếm hoặc chuẩn in CMYK. Queue artboard riêng vẫn cần encoder cho PDF/MP4/WAV.','export png svg video pdf nhiều trang'],
    ['plugins','Plugin & Extension SDK','Nạp gói declarative với quyền được kiểm tra.','Không chạy mã tùy ý; lệnh chỉ áp dụng trong phạm vi host hỗ trợ.','plugin extension package'],
    ['performance','Performance Workspace','Xem asset, object và phép đo có nguồn.','Nhịp RAF giao diện không phải FPS render 3D; số không đo được phải ghi chưa có.','performance fps memory proxy'],
    ['composer','Universal Scene Composer','Ghép đối tượng, nội dung và chuyển động.','Một số đối tượng là proxy 2D; không gọi preview đó là render 3D hoặc video hoàn chỉnh.','composer scene audio 3d']
  ].map(([id,title,task,limit,keywords]) => Object.freeze({id,title,task,limit,keywords,route:'/graphic-design/'+id})));
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
  const search = value => {
    const terms=normalize(value).trim().split(/\s+/).filter(Boolean);
    return CATALOG.map((item,index)=>{
      const fields=[normalize(item.keywords),normalize(item.title),normalize(item.task)];
      if(!terms.every(term=>fields.some(field=>field.includes(term))))return null;
      const score=terms.reduce((sum,term)=>sum+Math.max(...fields.map((field,i)=>field.split(/[^a-z0-9]+/).includes(term)?[8,6,4][i]:field.includes(term)?1:0)),0);
      return{item,index,score};
    }).filter(Boolean).sort((a,b)=>b.score-a.score||a.index-b.index).map(row=>row.item);
  };
  function preferences(raw) {
    return {version:1,theme:['nebula','aurora','solar'].includes(raw?.theme)?raw.theme:'nebula',focus:raw?.focus===true,motion:raw?.motion!==false};
  }
  function mount(root, options={}) {
    if(!root?.ownerDocument) return null;
    unmount(root);
    const storage=options.storage, entry=CATALOG.find(item=>item.id===options.view), doc=root.ownerDocument;
    let prefs;try{prefs=preferences(JSON.parse(storage?.getItem(KEY)||'{}'));}catch{prefs=preferences({});}
    const bar=doc.createElement('section');bar.className='gdc-command';bar.setAttribute('aria-label','Bàn điều khiển Cosmic Design');
    bar.innerHTML=`<div class="gdc-heading"><span aria-hidden="true">✧</span><div><small>HH COSMIC DESIGN STUDIO</small><strong>${escape(entry?.title||'Chọn công việc của bạn')}</strong></div></div><div class="gdc-actions"><button type="button" data-gdc-focus aria-pressed="${prefs.focus}">Tập trung</button><button type="button" data-gdc-motion aria-pressed="${!prefs.motion}">Giảm hiệu ứng</button><label>Giao diện<select data-gdc-theme><option value="nebula">Nebula</option><option value="aurora">Aurora</option><option value="solar">Solar</option></select></label><button type="button" data-gdc-reset>Đặt lại bố cục</button></div><details class="gdc-guide"><summary>Hướng dẫn & giới hạn công cụ</summary><p>${escape(entry?.task||'Tạo hoặc mở dự án, rồi chọn một trong 25 studio chuyên biệt.')}</p><p>${escape(entry?.limit||'Mỗi engine có định dạng riêng. Chỉ phần có adapter mới tự đồng bộ; không tự chuyển đổi hoặc làm phẳng thiết kế.')}</p><p>Bản nháp của từng studio được tách theo tài khoản/dự án. Chỉ gọi đã lưu khi engine xác nhận; hãy xuất bản sao trước khi xóa dữ liệu trình duyệt.</p></details><div class="gdc-finder"><label>Tìm studio<input type="search" data-gdc-search placeholder="Thử: chữ, ảnh, SVG, video, 3D…" autocomplete="off"></label><output data-gdc-count aria-live="polite">25 studio</output><nav data-gdc-results aria-label="Kết quả tìm studio" hidden></nav></div><output class="gdc-status" data-gdc-status role="status"></output>`;
    if (entry) {
      const drawer=doc.createElement('details');drawer.className='gdc-search-drawer';
      const summary=doc.createElement('summary');summary.textContent='Tìm studio khác';drawer.append(summary,bar.querySelector('.gdc-finder'));
      bar.querySelector('[data-gdc-status]').before(drawer);
    }
    const anchor=root.querySelector('.gd-main');anchor ? anchor.before(bar) : root.prepend(bar);
    const apply=()=>{root.dataset.gdPalette=prefs.theme;root.dataset.gdFocus=String(prefs.focus);root.dataset.gdInterfaceMotion=String(prefs.motion);bar.querySelector('[data-gdc-theme]').value=prefs.theme;bar.querySelector('[data-gdc-focus]').setAttribute('aria-pressed',String(prefs.focus));bar.querySelector('[data-gdc-focus]').textContent=prefs.focus?'Thoát tập trung':'Tập trung';bar.querySelector('[data-gdc-motion]').setAttribute('aria-pressed',String(!prefs.motion));};
    const save=()=>{apply();try{if(!storage?.setItem)throw Error('unavailable');storage.setItem(KEY,JSON.stringify(prefs));bar.querySelector('[data-gdc-status]').textContent='Đã lưu bố cục riêng của dự án.';}catch{bar.querySelector('[data-gdc-status]').textContent='Bố cục chỉ giữ trong lần mở này; kho lưu trữ không khả dụng.';}};
    const click=event=>{if(event.target.closest('[data-gdc-focus]')){prefs.focus=!prefs.focus;save();}else if(event.target.closest('[data-gdc-motion]')){prefs.motion=!prefs.motion;save();}else if(event.target.closest('[data-gdc-reset]')){prefs=preferences({});save();}};
    const change=event=>{if(event.target.matches('[data-gdc-theme]')){prefs=preferences({...prefs,theme:event.target.value});save();}};
    const input=event=>{if(!event.target.matches('[data-gdc-search]'))return;const rows=search(event.target.value),results=bar.querySelector('[data-gdc-results]');results.hidden=!event.target.value.trim();results.innerHTML=rows.map(item=>`<a href="#${item.route}"><strong>${escape(item.title)}</strong><small>${escape(item.task)}</small></a>`).join('')||'<p>Chưa có studio phù hợp. Thử từ khóa khác.</p>';bar.querySelector('[data-gdc-count]').textContent=`${rows.length} studio`;};
    bar.addEventListener('click',click);bar.addEventListener('change',change);bar.addEventListener('input',input);apply();
    const controller={destroy(){bar.removeEventListener('click',click);bar.removeEventListener('change',change);bar.removeEventListener('input',input);bar.remove();delete root.dataset.gdFocus;delete root.dataset.gdPalette;delete root.dataset.gdInterfaceMotion;mounted.delete(root);}};
    mounted.set(root,controller);return controller;
  }
  function unmount(root){mounted.get(root)?.destroy();}
  const api=Object.freeze({KEY,CATALOG,search,preferences,mount,unmount});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  scope.HHGraphicDesignCapabilities=api;
})(typeof globalThis!=='undefined'?globalThis:this);
