(function(scope){
  'use strict';
  const VERSION=1,KEY='hh.all-game.library.v1',WIDTH=720,HEIGHT=480;
  const BASE_CATALOG=[
    ['snake','Neon Snake','arcade','Phản xạ','Lái rắn thu năng lượng, tránh tường và chính mình.','Mũi tên hoặc WASD để rẽ. Không thể quay ngược ngay lập tức.','#75f3bc','⌁','2–5 phút'],
    ['breakout','Prism Breaker','arcade','Phản xạ','Bật bóng phá các lớp gạch qua ba màn thử thách.','Trái/phải hoặc kéo trên sân để di chuyển. Space / Hành động để phóng bóng.','#67dcff','▰','3 màn'],
    ['star-guard','Star Guard','arcade','Hành động','Bảo vệ quỹ đạo trước các đợt tàu địch và trận cuối.','Mũi tên / WASD để di chuyển; giữ Space / Hành động để bắn.','#ff89ce','✦','4 đợt'],
    ['merge','Neon Merge','puzzles','Trí tuệ','Trượt các ô cùng giá trị, xây chuỗi ghép số tới 2048.','Mũi tên / WASD hoặc vuốt để trượt. Hoàn tác nước đi bằng nút ↶.','#ffc875','▦','Không giới hạn'],
    ['mines','Crystal Mines','puzzles','Trí tuệ','Suy luận từ các con số và đánh dấu vùng nguy hiểm.','Bấm ô để mở; chuột phải hoặc bật Cắm cờ để đánh dấu. Ô mở đầu luôn an toàn.','#ad9cff','✧','3 mức khó'],
    ['memory','Memory Constellation','puzzles','Thư giãn','Ghép các biểu tượng giống nhau bằng trí nhớ của bạn.','Bấm hai thẻ; thẻ chưa khớp tự úp sau một nhịp. Có thể dùng mũi tên và Enter.','#f4a6df','❖','3 mức khó'],
    ['block-drop','Block Drop','adventure','Trí tuệ','Xếp các khối rơi, hoàn thành hàng và tăng cấp độ.','Trái/phải để dịch; lên để xoay; xuống để hạ nhanh; Space / Hành động để thả.','#7ce5ed','▧','Theo cấp độ'],
    ['crate-lab','Crate Lab','adventure','Trí tuệ','Đẩy các khối năng lượng về đúng đích trong mê cung.','Mũi tên / WASD để đi. Chỉ đẩy, không kéo; dùng Hoàn tác khi bị kẹt.','#e3e986','▣','Nhiều màn'],
    ['orbit-runner','Orbit Runner','adventure','Hành động','Chạy, nhảy, thu vật phẩm và vượt các chặng không gian.','Trái/phải để chạy; lên / Space / Hành động để nhảy. Tới cổng để qua màn.','#95b4ff','↗','3 chặng']
  ].map(([id,title,bundle,category,description,controls,accent,icon,length])=>Object.freeze({id,title,bundle,category,description,controls,accent,icon,length,route:'/all-game/'+id}));
  const extra=scope.HHAllGameCatalog||(typeof require==='function'?require('./all-game-catalog.js'):[]);
  const CATALOG=Object.freeze([...BASE_CATALOG,...extra]);
  const BUNDLES={arcade:{api:'HHAllGameArcade',url:'all-game-arcade.js?v=1'},puzzles:{api:'HHAllGamePuzzles',url:'all-game-puzzles.js?v=1'},adventure:{api:'HHAllGameAdventure',url:'all-game-adventure.js?v=1'},'pack-puzzles':{api:'HHAllGamePackPuzzles',url:'all-game-pack-puzzles.js?v=1'},'pack-arcade':{api:'HHAllGamePackArcade',url:'all-game-pack-arcade.js?v=1'},'pack-casual':{api:'HHAllGamePackCasual',url:'all-game-pack-casual.js?v=1'}};
  const sessions=new Map(),loads=new Map();let active=null,serial=0;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase();
  const ids=new Set(CATALOG.map(g=>g.id));
  function account(options={}){return String(options.currentUser?.id||options.currentUser?._id||options.currentUser?.email||'guest').slice(0,300);}
  const keyFor=owner=>KEY+':'+encodeURIComponent(owner);
  function normalizeData(input){
    const raw=input&&typeof input==='object'?input:{},bests=Object.create(null);
    for(const id of ids){const item=raw.bests?.[id];if(!item||typeof item!=='object')continue;bests[id]={score:Math.max(0,Math.min(1e12,Number(item.score)||0)),plays:Math.max(0,Math.min(1e9,Math.floor(Number(item.plays)||0))),wins:Math.max(0,Math.min(1e9,Math.floor(Number(item.wins)||0)))};}
    return{version:VERSION,favorites:[...new Set((Array.isArray(raw.favorites)?raw.favorites:[]).filter(id=>ids.has(id)))],recents:[...new Set((Array.isArray(raw.recents)?raw.recents:[]).filter(id=>ids.has(id)))].slice(0,9),bests,difficulty:['easy','normal','hard'].includes(raw.difficulty)?raw.difficulty:'normal',motion:raw.motion!==false};
  }
  function read(storage,owner){try{const raw=storage?.getItem(keyFor(owner));if(raw&&raw.length>50000)return normalizeData();const data=raw?JSON.parse(raw):null;return normalizeData(data?.version===VERSION?data:null);}catch{return normalizeData();}}
  function save(storage,owner,data){try{if(!storage?.setItem)throw Error('unavailable');storage.setItem(keyFor(owner),JSON.stringify(normalizeData(data)));return{ok:true};}catch{return{ok:false,error:'Chưa lưu được trên thiết bị. Dữ liệu hiện chỉ giữ trong lần mở này.'};}}
  function filter(query='',category='all',favoritesOnly=false,favorites=[]){
    const terms=norm(query).trim().split(/\s+/).filter(Boolean),words=g=>norm(g.title+' '+g.description+' '+g.category).split(/[^a-z0-9]+/);
    const rows=CATALOG.filter(g=>(category==='all'||g.category===category)&&(!favoritesOnly||favorites.includes(g.id))&&terms.every(term=>words(g).some(word=>word.startsWith(term))));
    const exact=rows.filter(g=>terms.every(term=>words(g).includes(term)));return exact.length?exact:rows;
  }
  function poster(g){
    if(scope.HHAllGameScenes)return scope.HHAllGameScenes.thumbnail(g.id);
    const forms={snake:'<path d="M65 85H95V55H130V80H165V45H190"/>',breakout:'<path d="M60 35H95M105 35H140M150 35H185M60 55H95M105 55H140M150 55H185M100 105H150"/><circle cx="130" cy="78" r="7"/>','star-guard':'<path d="M125 35L145 90L125 78L105 90Z M65 35h10m100 15h10M90 110h10"/>',merge:'<rect x="68" y="30" width="48" height="42" rx="9"/><rect x="125" y="30" width="48" height="42" rx="9"/><rect x="125" y="80" width="48" height="42" rx="9"/><text x="92" y="58">4</text><text x="149" y="58">8</text><text x="149" y="108">16</text>',mines:'<path d="M90 25V110M125 25V110M160 25V110M65 50H185M65 85H185"/><circle cx="143" cy="68" r="8"/>',memory:'<rect x="65" y="30" width="48" height="76" rx="9"/><rect x="138" y="30" width="48" height="76" rx="9"/><path d="M89 48L98 66L89 84L80 66ZM162 48L171 66L162 84L153 66Z"/>','block-drop':'<path d="M80 30h30v30h30v30H80ZM150 90h30v30h-90v-30"/>','crate-lab':'<path d="M65 30h120v90H65ZM95 55h35v35H95ZM95 55l35 35M130 55L95 90"/><circle cx="160" cy="75" r="9"/>','orbit-runner':'<path d="M55 110h55M140 85h55M110 55l20-25 15 22M120 45l-12 27 23 10M128 83l-10 20M132 83l18 10"/>'};
    return `<svg viewBox="0 0 250 145" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${forms[g.id]||`<path d="M65 40h120v70H65zM80 65h30m-15-15v30M145 62h1m20 18h1"/><text x="125" y="133">${esc(g.icon)}</text>`}</g></svg>`;
  }
  function ensure(entry,doc){
    const config=BUNDLES[entry.bundle];if(scope[config.api]?.games?.[entry.id])return Promise.resolve(scope[config.api].games[entry.id]);
    if(!loads.has(config.url))loads.set(config.url,new Promise((resolve,reject)=>{const script=doc.createElement('script');script.src=config.url;script.async=true;let timer;
      const finish=error=>{clearTimeout(timer);script.onload=script.onerror=null;if(error){loads.delete(config.url);script.remove();reject(error);}else resolve();};
      script.onload=()=>scope[config.api]?.games?finish():finish(Error('Engine chưa cung cấp game.'));script.onerror=()=>finish(Error('Không tải được game. Hãy kiểm tra mạng rồi thử lại.'));timer=setTimeout(()=>finish(Error('Tải game quá lâu. Có thể thử lại.')),20000);doc.head.append(script);
    }));
    return loads.get(config.url).then(()=>{const game=scope[config.api]?.games?.[entry.id];if(!game?.create||!game.step||!game.draw)throw Error('Game chưa sẵn sàng.');return game;});
  }
  function mount(root,options={}){
    if(!root?.ownerDocument)return null;unmount();const doc=root.ownerDocument,owner=account(options);let storage=options.storage;
    if(storage===undefined){try{storage=scope.localStorage;}catch{storage=null;}}
    const data=read(storage,owner),entry=CATALOG.find(g=>g.id===options.gameId);let disposed=false,engine=null,session=null,raf=0,last=0,lastHUD='',lastBoard='',boardNodes=[],frameCount=0,flagMode=false,faulted=false;
    const off=[],held=Object.create(null),sessionKey=(difficulty=session?.difficulty||data.difficulty)=>JSON.stringify([owner,entry?.id,difficulty]);let focusedCell=0;
    const listen=(target,name,fn,opts)=>{target.addEventListener(name,fn,opts);off.push(()=>target.removeEventListener(name,fn,opts));};
    root.className='all-game';root.dataset.allGameMounted='true';root.dataset.motion=String(data.motion);root.dataset.game=entry?.id||'library';
    if(entry&&scope.HHAllGameScenes){const profile=scope.HHAllGameScenes.profiles[entry.id];root.dataset.scene=profile?.theme||'space';root.style.setProperty('--ag-scene',`url("data:image/svg+xml,${encodeURIComponent(scope.HHAllGameScenes.thumbnail(entry.id))}")`);root.style.setProperty('--ag-scene-light',profile?.palette[2]||entry.accent);}
    const common=`<header class="ag-hero"><div><span class="ag-eyebrow">HH • PLAY SOMETHING ORIGINAL</span><h1>${entry?esc(entry.title):'All Game<span>Neon Arcade</span>'}</h1><p>${entry?esc(entry.description):'Chọn một thử thách nhỏ. Một lần nghỉ thật vui.'}</p></div><div class="ag-hero-art" aria-hidden="true"><span>✦</span><i></i><b>2D</b></div></header><nav class="ag-topbar" aria-label="Điều hướng All Game"><a href="#/all-game">Tất cả game</a><a href="#/platform">HH Platform</a><button type="button" data-ag-motion aria-pressed="${!data.motion}">${data.motion?'Giảm hiệu ứng':'Bật hiệu ứng'}</button><span>Chơi cục bộ · Không quảng cáo</span></nav><output class="ag-status" data-ag-storage role="status"></output>`;
    const persist=()=>{const result=save(storage,owner,data);const status=root.querySelector('[data-ag-storage]');if(status)status.textContent=result.ok?'':result.error;return result.ok;};
    function cards(rows){return rows.map(g=>{const best=data.bests[g.id];return `<article class="ag-card" style="--ag-accent:${g.accent}"><a class="ag-poster" href="#${g.route}" aria-label="Mở ${esc(g.title)}">${poster(g)}<span>${esc(g.category)}</span><b>${esc(g.icon)}</b></a><div class="ag-card-body"><div class="ag-card-title"><h2><a href="#${g.route}">${esc(g.title)}</a></h2><button type="button" data-ag-favorite="${g.id}" aria-label="${data.favorites.includes(g.id)?'Bỏ yêu thích':'Yêu thích'} ${esc(g.title)}" aria-pressed="${data.favorites.includes(g.id)}">${data.favorites.includes(g.id)?'♥':'♡'}</button></div><p>${esc(g.description)}</p><div class="ag-card-meta"><span>${g.length}</span><span>${best?.plays?`Kỷ lục ${Math.round(best.score).toLocaleString('vi-VN')}`:'Chưa chơi'}</span></div><a class="ag-play-link" href="#${g.route}">Vào chơi <span aria-hidden="true">↗</span></a></div></article>`;}).join('');}
    if(!entry){
      root.innerHTML=common+(options.gameId?'<p class="ag-notice" role="status">Không tìm thấy game này. Chọn một game trong thư viện.</p>':'')+`<section class="ag-discovery" aria-label="Tìm game"><label>Tìm game<input type="search" data-ag-search placeholder="Thử: rắn, ghép số, phá gạch…" autocomplete="off"></label><label>Thể loại<select data-ag-category><option value="all">Tất cả thể loại</option>${[...new Set(CATALOG.map(g=>g.category))].map(s=>`<option>${esc(s)}</option>`).join('')}</select></label><button type="button" data-ag-only-favorites aria-pressed="false">♡ Yêu thích</button><output data-ag-count>${CATALOG.length} game</output></section><section class="ag-recent" aria-label="Chơi gần đây" ${data.recents.length?'':'hidden'}><h2>Gần đây</h2><div>${data.recents.map(id=>{const g=CATALOG.find(g=>g.id===id);return `<a href="#${g.route}">${esc(g.icon)} ${esc(g.title)}</a>`;}).join('')}</div></section><section class="ag-grid" data-ag-grid aria-label="Thư viện game">${cards(CATALOG)}</section><section class="ag-library-note"><h2>${CATALOG.length} thế giới nhỏ, viết riêng cho HH</h2><p>Game chạy trên trình duyệt, không nhúng iframe từ website khác. Kỷ lục và yêu thích lưu trên thiết bị theo tài khoản. Đây không phải bảng xếp hạng trực tuyến.</p><a href="docs/ALL_GAME_REFERENCES.md" target="_blank" rel="noopener">Nguồn cảm hứng & quyền sử dụng ↗</a></section>`;
      let favoritesOnly=false;
      const refresh=()=>{const rows=filter(root.querySelector('[data-ag-search]').value,root.querySelector('[data-ag-category]').value,favoritesOnly,data.favorites);root.querySelector('[data-ag-grid]').innerHTML=cards(rows)||'<p class="ag-empty">Chưa có game phù hợp. Thử từ khóa hoặc bộ lọc khác.</p>';root.querySelector('[data-ag-count]').textContent=rows.length+' game';};
      listen(root,'input',e=>{if(e.target.matches('[data-ag-search]'))refresh();});listen(root,'change',e=>{if(e.target.matches('[data-ag-category]'))refresh();});
      listen(root,'click',e=>{const favorite=e.target.closest('[data-ag-favorite]');if(favorite){const id=favorite.dataset.agFavorite;data.favorites=data.favorites.includes(id)?data.favorites.filter(item=>item!==id):[...data.favorites,id];persist();refresh();root.querySelector(`[data-ag-favorite="${id}"]`)?.focus();}if(e.target.closest('[data-ag-only-favorites]')){favoritesOnly=!favoritesOnly;e.target.closest('button').setAttribute('aria-pressed',String(favoritesOnly));refresh();}});
    }else{
      root.style.setProperty('--ag-accent',entry.accent);
      root.innerHTML=common+`<section class="ag-workspace"><div class="ag-stage-panel"><div class="ag-gamebar"><div><span data-ag-game-status>Đang tải game…</span><strong data-ag-score>0</strong></div><div><span>Màn / cấp</span><strong data-ag-level>1</strong></div><div><span>Kỷ lục trên máy</span><strong data-ag-best>${Math.round(data.bests[entry.id]?.score||0)}</strong></div></div><div class="ag-stage" data-ag-stage><canvas data-ag-canvas width="720" height="480" tabindex="0" role="img" aria-label="Sân chơi ${esc(entry.title)}. ${esc(entry.controls)}"></canvas><div class="ag-board" data-ag-board hidden aria-label="Bàn chơi ${esc(entry.title)}"></div><div class="ag-curtain" data-ag-curtain><strong data-ag-curtain-title>Đang chuẩn bị…</strong><p data-ag-curtain-copy>Chỉ bắt đầu khi bạn sẵn sàng.</p><button type="button" data-ag-start disabled>Bắt đầu</button><button type="button" data-ag-retry hidden>Thử tải lại</button></div></div><div class="ag-controls"><button type="button" data-ag-pause disabled>Tạm dừng</button><button type="button" data-ag-restart disabled>Ván mới</button><button type="button" data-ag-undo ${['merge','crate-lab'].includes(entry.id)?'':'hidden'}>↶ Hoàn tác</button><button type="button" data-ag-reset-level ${entry.id==='crate-lab'?'':'hidden'}>Chơi lại màn</button><button type="button" data-ag-continue hidden>Tiếp tục ghép</button><button type="button" data-ag-flag ${entry.id==='mines'?'':'hidden'} aria-pressed="false">⚑ Cắm cờ: tắt</button><button type="button" data-ag-fullscreen>Toàn màn hình</button></div><div class="ag-touch" aria-label="Điều khiển cảm ứng"><div class="ag-dpad">${[['up','↑'],['left','←'],['down','↓'],['right','→']].map(([id,icon])=>`<button type="button" data-ag-control="${id}" aria-label="${{up:'Lên',left:'Trái',down:'Xuống',right:'Phải'}[id]}">${icon}</button>`).join('')}</div><button type="button" class="ag-action" data-ag-control="action">Hành động</button></div><output class="ag-summary" data-ag-summary aria-live="polite"></output></div><aside class="ag-help"><span class="ag-eyebrow">HOW TO PLAY</span><h2>Cách chơi</h2><p>${esc(entry.controls)}</p><dl><dt>Tạm dừng</dt><dd>P hoặc Escape khi đang ở sân chơi.</dd><dt>Độ khó</dt><dd><select data-ag-difficulty aria-label="Độ khó"><option value="easy">Dễ</option><option value="normal">Tiêu chuẩn</option><option value="hard">Khó</option></select><small>Đổi độ khó chỉ áp dụng cho ván mới.</small></dd><dt>Dữ liệu</dt><dd>Phiên giữ tạm khi đổi mục. Reload sẽ bắt đầu ván mới; kỷ lục và yêu thích vẫn lưu trên máy.</dd></dl><a href="#/all-game">← Chọn game khác</a><p class="ag-note">Không thu mic/camera, không tự phát âm thanh, không có điểm hay đối thủ giả.</p></aside></section>`;
      const qs=s=>root.querySelector(s),canvas=qs('[data-ag-canvas]'),context=canvas.getContext('2d'),board=qs('[data-ag-board]'),curtain=qs('[data-ag-curtain]');
      qs('[data-ag-summary]').setAttribute('aria-live','off');qs('[data-ag-game-status]').setAttribute('role','status');
      const clock=doc.createElement('div');clock.className='ag-clock';clock.hidden=true;clock.innerHTML='<span>Thời gian còn lại</span><strong data-ag-clock>0:00</strong>';qs('.ag-gamebar').append(clock);
      const cue=doc.createElement('div');cue.className='ag-visual-cue';cue.hidden=true;qs('[data-ag-stage]').prepend(cue);
      cue.setAttribute('role','img');
      const directions={breakout:['left','right'],'paddle-duel':['up','down'],'sky-glider':[],'coin-catcher':['left','right'],'road-rush':['left','right'],'gravity-flip':[],'jump-tower':['left','right'],'shield-defense':['left','right']};
      if(directions[entry.id])root.querySelectorAll('[data-ag-control]').forEach(b=>{if(b.dataset.agControl!=='action')b.hidden=!directions[entry.id].includes(b.dataset.agControl);});
      if(['snake','merge','meteor-dodge','coin-catcher','river-cross','crate-lab'].includes(entry.id))qs('[data-ag-control="action"]').hidden=true;
      const actionLabels={'road-rush':'Phanh','ball-balance':'Hãm bi','laser-dash':'Lướt nhanh','orbit-collect':'Đảo chiều','shield-defense':'Xung khiên','pattern-recall':'Kiểm tra mẫu','pixel-painter':'Kiểm tra tranh','cafe-orders':'Giao món','garden-care':'Tiếp nước'};
      if(actionLabels[entry.id])qs('[data-ag-control="action"]').textContent=actionLabels[entry.id];
      if(directions[entry.id]?.length===0)qs('.ag-dpad').hidden=true;
      if(entry.id==='pixel-painter'){qs('[data-ag-difficulty]').closest('dd').hidden=true;qs('[data-ag-difficulty]').closest('dd').previousElementSibling.hidden=true;}
      qs('[data-ag-difficulty]').value=data.difficulty;
      qs('[data-ag-undo]').hidden=!(entry.undo||['merge','crate-lab'].includes(entry.id));qs('[data-ag-reset-level]').hidden=!(entry.reset||entry.id==='crate-lab');
      function storeSession(){if(!session)return;sessions.delete(sessionKey());sessions.set(sessionKey(),session);while(sessions.size>48)sessions.delete(sessions.keys().next().value);}
      function record(){const before=data.bests[entry.id]||{score:0,plays:0,wins:0},score=Math.max(0,Math.min(1e12,Number(session.state.score)||0));let changed=false;if(score>before.score){before.score=score;changed=true;}if(session.state.status==='won'&&!session.countedWin){before.wins++;session.countedWin=true;changed=true;}data.bests[entry.id]=before;if(changed)persist();qs('[data-ag-best]').textContent=Math.round(before.score).toLocaleString('vi-VN');}
      function drawFrame(){
        if(!engine||!session||disposed)return;
        const description=engine.describe?.(session.state)||{summary:entry.controls},cells=Array.isArray(description.cells)?description.cells:null;
        const paintedBoard=entry.bundle==='pack-puzzles'&&!['nonogram','towers-hanoi'].includes(entry.id),showCanvas=description.showCanvas||paintedBoard||entry.id==='towers-hanoi';
        canvas.hidden=!!cells&&!showCanvas;board.hidden=!cells;qs('[data-ag-stage]').dataset.mode=cells?(paintedBoard?'painted-board':showCanvas?'mixed':'board'):'canvas';
        cue.hidden=!description.visualCue;if(description.visualCue){cue.textContent=description.visualCue.text;cue.setAttribute('aria-label',description.visualCue.label||description.visualCue.text);cue.style.color=/^#[a-f0-9]{6}$/i.test(description.visualCue.color||'')?description.visualCue.color:'';}
        clock.hidden=!Number.isFinite(session.state.timeLeft);if(!clock.hidden){const seconds=Math.max(0,Math.ceil(session.state.timeLeft)),text=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');if(qs('[data-ag-clock]').textContent!==text)qs('[data-ag-clock]').textContent=text;}
        if(cells){
          const signature=cells.map(c=>[c.index,c.label,c.text,c.description,c.disabled,c.pressed,c.value,c.color,c.background,c.className].join('|')).join(';');
          if(signature!==lastBoard){
            const columns=Math.max(2,Math.min(24,Number(description.columns)||4));board.style.setProperty('--ag-columns',columns);
            if(paintedBoard){const rows=Math.ceil(cells.length/columns),size=Math.min((WIDTH-20)/columns,(HEIGHT-20)/rows);board.style.left=(WIDTH-size*columns)/2/WIDTH*100+'%';board.style.top=(HEIGHT-size*rows)/2/HEIGHT*100+'%';board.style.width=size*columns/WIDTH*100+'%';board.style.height=size*rows/HEIGHT*100+'%';}
            if(boardNodes.length!==cells.length){board.replaceChildren();boardNodes=cells.map((c,i)=>{const b=doc.createElement('button');b.type='button';b.dataset.agCell=String(c.index??i);board.append(b);return b;});}
            cells.forEach((c,i)=>{const b=boardNodes[i];b.dataset.agCell=String(c.index??i);b.textContent=String(c.text??c.value??c.label??'').slice(0,80);b.setAttribute('aria-label',String(c.description||c.label||c.value||'Ô '+(i+1)));b.setAttribute('aria-disabled',String(!!c.disabled));b.dataset.disabled=String(!!c.disabled);b.setAttribute('aria-pressed',String(!!c.pressed));b.dataset.tone=String(c.tone||'').replace(/[^a-z0-9-]/gi,'').slice(0,40);b.dataset.tile=String(c.value??c.label??'').slice(0,12);b.style.color=/^#[a-f0-9]{6}$/i.test(c.color||'')?c.color:'';b.style.backgroundColor=/^#[a-f0-9]{6}$/i.test(c.background||'')?c.background:'';});lastBoard=signature;
            if(entry.id==='nonogram'){
              const focused=board.contains(doc.activeElement)?doc.activeElement:null;
              board.style.setProperty('--ag-columns',6);board.replaceChildren();
              const clue=(text,label)=>{const span=doc.createElement('span');span.className='ag-clue';span.textContent=text;span.setAttribute('aria-label',label);return span;};
              board.append(clue('↘','Gợi ý hàng và cột'));session.state.clues.columns.forEach((values,i)=>board.append(clue(values.join(' · '),'Cột '+(i+1)+': '+values.join(', '))));
              session.state.clues.rows.forEach((values,y)=>{board.append(clue(values.join(' · '),'Hàng '+(y+1)+': '+values.join(', ')));board.append(...boardNodes.slice(y*5,y*5+5));});
              focused?.focus({preventScroll:true});
            }
          }
          board.setAttribute('aria-label','Bàn chơi '+entry.title+'. '+description.summary);
        }
        if(!canvas.hidden&&context){const dpr=Math.max(1,Math.min(1.5,scope.devicePixelRatio||1));if(canvas.width!==Math.round(WIDTH*dpr)){canvas.width=Math.round(WIDTH*dpr);canvas.height=Math.round(HEIGHT*dpr);}context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,WIDTH,HEIGHT);engine.draw(context,session.state,{width:WIDTH,height:HEIGHT,reducedMotion:!data.motion||scope.matchMedia?.('(prefers-reduced-motion: reduce)').matches,paintScene:scope.HHAllGameScenes?.paint});}else if(!canvas.hidden)throw Error('Trình duyệt chưa hỗ trợ Canvas 2D. Các game dạng bảng vẫn có thể sử dụng.');
        const hud=[session.state.score,session.state.level,session.state.status,session.paused,session.started].join('|');
        if(hud!==lastHUD){lastHUD=hud;qs('[data-ag-score]').textContent=Math.round(Number(session.state.score)||0).toLocaleString('vi-VN');qs('[data-ag-level]').textContent=String(session.state.level||1);qs('[data-ag-game-status]').textContent=!session.started?'Sẵn sàng':session.state.status==='won'?'Hoàn thành':session.state.status==='lost'?'Kết thúc':session.paused?'Tạm dừng':'Đang chơi';qs('[data-ag-pause]').textContent=session.paused?'Tiếp tục':'Tạm dừng';}
        if(qs('[data-ag-summary]').textContent!==description.summary)qs('[data-ag-summary]').textContent=description.summary;
        const ended=session.state.status!=='playing';curtain.hidden=session.started&&!session.paused&&!ended;
        qs('[data-ag-curtain-title]').textContent=ended?(session.state.result==='draw'?'Ván chơi hòa':session.state.status==='won'?'Thử thách hoàn thành!':'Hẹn bạn ở ván tiếp theo'):session.started?'Tạm nghỉ một chút':'Sẵn sàng khám phá?';
        qs('[data-ag-curtain-copy]').textContent=ended?description.summary:session.started?'Không có thời gian nào bị tính khi tạm dừng.':entry.controls;
        qs('[data-ag-start]').textContent=ended?'Chơi lại':session.started?'Tiếp tục':'Bắt đầu';qs('[data-ag-start]').disabled=false;
        qs('[data-ag-pause]').disabled=!session.started||ended;qs('[data-ag-restart]').disabled=false;qs('[data-ag-continue]').hidden=!(entry.id==='merge'&&session.state.status==='won');
      }
      function stop(){if(raf)scope.cancelAnimationFrame(raf);raf=0;last=0;for(const key of Object.keys(held))delete held[key];}
      function fail(){faulted=true;if(session)session.paused=true;stop();storeSession();curtain.hidden=false;qs('[data-ag-curtain-title]').textContent='Game đã dừng an toàn';qs('[data-ag-curtain-copy]').textContent='Có lỗi khi xử lý ván chơi. Bạn có thể tạo ván mới hoặc chọn game khác.';qs('[data-ag-storage]').textContent='Game gặp lỗi; phiên đã dừng an toàn. Có thể tạo ván mới.';qs('[data-ag-start]').disabled=true;qs('[data-ag-pause]').disabled=true;qs('[data-ag-restart]').disabled=!engine;}
      function draw(){if(faulted||disposed)return;try{drawFrame();}catch{fail();}}
      function pause(render=true){if(!session?.started||session.state.status!=='playing')return;session.paused=true;stop();storeSession();if(render)draw();}
      function schedule(){if(entry.realtime===false||['merge','mines','crate-lab'].includes(entry.id)||entry.id==='memory'&&!session?.state.mismatchRemaining){last=0;return;}if(disposed||!session||session.paused||!session.started||session.state.status!=='playing'||doc.hidden||raf)return;raf=scope.requestAnimationFrame(tick);}
      function apply(action,dt=0){const history=['undo','reset-level'].includes(action.type);if(faulted||!engine||!session?.started||!history&&(session.paused||session.state.status!=='playing'))return;try{const ended=session.state.status!=='playing';session.state=engine.step(session.state,action,dt);if(history&&ended&&session.state.status==='playing')session.paused=false;record();storeSession();draw();if(session.state.status!=='playing')stop();else schedule();}catch{fail();}}
      function tick(now){raf=0;if(disposed||doc.hidden)return;const dt=last?Math.min(.05,Math.max(0,(now-last)/1000)):0;last=now;apply({type:'tick',held:{...held}},dt);frameCount++;schedule();}
      function start(fresh=false){if(!engine||faulted&&!fresh)return;try{if(fresh||!session||session.state.status!=='playing'){faulted=false;session={state:engine.create({seed:(Date.now()^++serial)>>>0,difficulty:data.difficulty}),difficulty:data.difficulty,started:false,paused:true,countedWin:false};lastBoard='';lastHUD='';}
        if(!session.started){const best=data.bests[entry.id]||{score:0,plays:0,wins:0};best.plays++;data.bests[entry.id]=best;data.recents=[entry.id,...data.recents.filter(id=>id!==entry.id)].slice(0,9);persist();}
        session.started=true;session.paused=false;draw();storeSession();schedule();if(!faulted)(board.hidden?canvas:board.querySelector('button'))?.focus();}catch{fail();}}
      async function load(){qs('[data-ag-retry]').hidden=true;try{const result=await ensure(entry,doc);if(disposed)return;engine=result;session=sessions.get(sessionKey())||{state:engine.create({seed:(Date.now()^++serial)>>>0,difficulty:data.difficulty}),difficulty:data.difficulty,started:false,paused:true,countedWin:false};session.paused=true;storeSession();draw();}catch(error){if(disposed)return;qs('[data-ag-curtain-title]').textContent='Chưa tải được game';qs('[data-ag-curtain-copy]').textContent=error.message;qs('[data-ag-retry]').hidden=false;}}
      const keyAction=key=>({ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right',ArrowUp:'up',w:'up',W:'up',ArrowDown:'down',s:'down',S:'down',' ':'action',Enter:'action',z:'undo',Z:'undo'}[key]);
      listen(root,'click',e=>{if(e.target.closest('[data-ag-start]'))start();if(e.target.closest('[data-ag-restart]')){stop();start(true);}if(e.target.closest('[data-ag-pause]')){if(session?.paused)start();else pause();}if(e.target.closest('[data-ag-retry]'))void load();if(e.target.closest('[data-ag-undo]'))apply({type:'undo'});if(e.target.closest('[data-ag-reset-level]'))apply({type:'reset-level'});if(e.target.closest('[data-ag-flag]')){flagMode=!flagMode;qs('[data-ag-flag]').textContent='⚑ Cắm cờ: '+(flagMode?'bật':'tắt');qs('[data-ag-flag]').setAttribute('aria-pressed',String(flagMode));}if(e.target.closest('[data-ag-continue]')&&session){session.state=engine.step(session.state,{type:'continue'},0);session.paused=false;draw();schedule();}const cell=e.target.closest('[data-ag-cell]');if(cell)apply({type:'cell',index:Number(cell.dataset.agCell),alternate:flagMode});if(e.target.closest('[data-ag-fullscreen]')){const target=qs('.ag-stage-panel');const request=doc.fullscreenElement?doc.exitFullscreen?.():target.requestFullscreen?.();if(!request)qs('[data-ag-storage]').textContent='Trình duyệt chưa hỗ trợ toàn màn hình.';else request.catch(()=>{if(!disposed)qs('[data-ag-storage]').textContent='Không thể mở toàn màn hình. Bạn vẫn có thể chơi trong trang.';});}});
      listen(board,'contextmenu',e=>{const cell=e.target.closest('[data-ag-cell]');if(cell){e.preventDefault();apply({type:'cell',index:Number(cell.dataset.agCell),alternate:true});}});
      const hold=action=>{if(entry.id!=='block-drop'||!['up','action'].includes(action))held[action]=true;};
      const activateControl=action=>{
        if(action==='action'&&['pattern-recall','pixel-painter','cafe-orders','garden-care'].includes(entry.id)){apply({type:'action'});return;}
        if(!board.hidden&&(entry.boardNavigation||['memory','mines'].includes(entry.id))){
          if(action==='action'){apply({type:'cell',index:Number(boardNodes[focusedCell]?.dataset.agCell||0),alternate:flagMode});return;}
          const columns=engine?.describe(session.state).columns,delta={left:-1,right:1,up:-columns,down:columns}[action];if(delta!==undefined){focusedCell=Math.max(0,Math.min(boardNodes.length-1,focusedCell+delta));boardNodes[focusedCell]?.focus();return;}
        }hold(action);apply({type:action});
      };
      listen(board,'focusin',e=>{const index=boardNodes.indexOf(e.target);if(index>=0)focusedCell=index;});
      listen(root,'keydown',e=>{
        if(e.target.closest('input,select,textarea,[contenteditable=true]'))return;
        const control=e.target.closest('[data-ag-control]'),cell=e.target.closest('[data-ag-cell]'),playFocus=e.target===canvas||board.contains(e.target)||control;
        if(!playFocus)return;
        if(e.key==='Escape'||e.key.toLowerCase()==='p'){e.preventDefault();pause();return;}
        let action=keyAction(e.key);if(!action)return;
        if(cell&&['Enter',' '].includes(e.key))return;
        if(cell&&(['memory','mines'].includes(entry.id)||entry.boardNavigation)&&['left','right','up','down'].includes(action)){
          e.preventDefault();const columns=engine.describe(session.state).columns,index=boardNodes.indexOf(cell),delta={left:-1,right:1,up:-columns,down:columns}[action],next=Math.max(0,Math.min(boardNodes.length-1,index+delta));boardNodes[next]?.focus();return;
        }
        if(control&&['Enter',' '].includes(e.key))action=control.dataset.agControl;
        e.preventDefault();if(!e.repeat){if(control)activateControl(action);else{hold(action);apply({type:action});}}
      });
      listen(doc,'keyup',e=>{const action=e.target.closest?.('[data-ag-control]')&&['Enter',' '].includes(e.key)?e.target.closest('[data-ag-control]').dataset.agControl:keyAction(e.key);if(action)delete held[action];});
      listen(root,'focusout',e=>{if(!root.contains(e.relatedTarget))for(const key of Object.keys(held))delete held[key];});
      listen(root,'pointerdown',e=>{const button=e.target.closest('[data-ag-control]');if(!button)return;e.preventDefault();const action=button.dataset.agControl;button.setPointerCapture?.(e.pointerId);activateControl(action);});
      const release=e=>{const button=e.target.closest?.('[data-ag-control]');if(button)delete held[button.dataset.agControl];};listen(root,'pointerup',release);listen(root,'pointercancel',release);listen(root,'lostpointercapture',release);
      let swipe=null;
      listen(canvas,'pointerdown',e=>{if(!session?.started)return;const rect=canvas.getBoundingClientRect();swipe={x:e.clientX,y:e.clientY};canvas.setPointerCapture?.(e.pointerId);canvas.focus();apply({type:'pointer',phase:'down',x:(e.clientX-rect.left)*WIDTH/rect.width,y:(e.clientY-rect.top)*HEIGHT/rect.height});});
      listen(canvas,'pointermove',e=>{const rect=canvas.getBoundingClientRect();apply({type:'pointer',phase:'move',x:(e.clientX-rect.left)*WIDTH/rect.width,y:(e.clientY-rect.top)*HEIGHT/rect.height});});
      listen(canvas,'pointerup',e=>{if(swipe&&entry.id==='merge'){const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;if(Math.max(Math.abs(dx),Math.abs(dy))>20)apply({type:Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up'});}swipe=null;});
      listen(board,'pointerdown',e=>{if(entry.id!=='merge')return;swipe={x:e.clientX,y:e.clientY};});listen(board,'pointerup',e=>{if(!swipe||entry.id!=='merge')return;const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;swipe=null;if(Math.max(Math.abs(dx),Math.abs(dy))>25)apply({type:Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up'});});
      listen(root,'change',e=>{if(e.target.matches('[data-ag-difficulty]')){pause();storeSession();data.difficulty=e.target.value;if(persist())qs('[data-ag-storage]').textContent='Đã chọn độ khó cho ván mới. Ván đang giữ chưa thay đổi.';}});
      listen(doc,'visibilitychange',()=>{if(doc.hidden)pause();});listen(scope,'blur',pause);
      void load();
      options.onController?.({getState:()=>session?.state,getFrameCount:()=>frameCount,pause,start});
      active={destroy(){if(disposed)return;try{pause(false);}finally{disposed=true;stop();off.splice(0).forEach(fn=>fn());if(doc.fullscreenElement&&root.contains(doc.fullscreenElement))doc.exitFullscreen?.().catch(()=>{});root.replaceChildren();root.removeAttribute('data-all-game-mounted');}},getState:()=>session?.state,getFrameCount:()=>frameCount,pause,start};
    }
    listen(root,'click',e=>{if(e.target.closest('[data-ag-motion]')){data.motion=!data.motion;root.dataset.motion=String(data.motion);const button=root.querySelector('[data-ag-motion]');button.setAttribute('aria-pressed',String(!data.motion));button.textContent=data.motion?'Giảm hiệu ứng':'Bật hiệu ứng';persist();}});
    if(!entry)active={destroy(){disposed=true;off.splice(0).forEach(fn=>fn());root.replaceChildren();root.removeAttribute('data-all-game-mounted');}};
    return active;
  }
  function unmount(){active?.destroy();active=null;}
  const api=Object.freeze({VERSION,KEY,CATALOG,filter,normalizeData,keyFor,read,save,account,mount,unmount});scope.HHAllGame=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
