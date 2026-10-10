/* Patin Video Studio: opt-in publisher embeds and device-only native media. */
(function(global){
  'use strict';
  const D=global.HHPatinData,C=global.HHPatinCore,e=C.escape,drafts=new Map();
  const topicName=id=>({foundation:'Nền tảng & phanh',speed:'Speed',slide:'Slide',slalom:'Slalom'}[id]||id);
  const levelName=id=>D.levels.find(l=>l.id===id)?.title||id;
  const time=n=>Math.floor(n/60)+':'+String(n%60).padStart(2,'0');
  function mount(host,{store,onStatus=()=>{},videoId=''}){
    let alive=true,selected=D.videos.find(v=>v.id===videoId)||D.videos.find(v=>v.id===store.getState().workshop.videos.lastVideo)||D.videos[0],query='',topic='all',level='all',onlyFavorite=false,onlyUnreviewed=false,limit=8,frame=null,blobUrl=null,fileVideo=null,a=null,b=null,loop=false;
    const cleanups=[],state=()=>store.getState().workshop.videos,record=()=>state().records[selected.id]||{note:'',reviewed:false,markers:[]},draftKey=()=>store.key+':'+selected.id;
    const on=(target,name,fn)=>{target.addEventListener(name,fn);cleanups.push(()=>target.removeEventListener(name,fn));};
    function message(text){if(!alive)return;const box=host.querySelector('[data-pt-video-status]');if(box.textContent!==text)box.textContent=text;onStatus(text);}
    function write(fn){try{const saved=store.mutate(fn);message(saved?'Đã lưu trên thiết bị cho tài khoản/khách hiện tại.':store.getStatus().error);return true;}catch(err){message(err.message);return false;}}
    function stopEmbed(text='Đã đóng trình phát ngoài; muốn xem lại hãy chủ động mở.'){
      if(frame){frame.remove();frame=null;}const area=host.querySelector('[data-pt-player]');if(area)area.innerHTML='<p class="pt-muted">'+e(text)+'</p>';
      const stop=host.querySelector('[data-pt-video-stop]');if(stop)stop.hidden=true;
    }
    function releaseFile(){if(fileVideo){fileVideo.pause();fileVideo.removeAttribute('src');fileVideo.load();fileVideo=null;}if(blobUrl){URL.revokeObjectURL(blobUrl);blobUrl=null;}a=b=null;loop=false;}
    function list(){
      const s=state(),terms=C.fold(query).split(/\s+/).filter(Boolean),found=D.videos.filter(v=>(topic==='all'||v.topic===topic)&&(level==='all'||v.level===level)&&(!onlyFavorite||s.favorites.includes(v.id))&&(!onlyUnreviewed||!s.records[v.id]?.reviewed)&&terms.every(t=>C.fold(v.title+' '+v.originalTitle+' '+v.publisher+' '+v.skillIds.map(id=>D.skills.find(s=>s.id===id)?.title).join(' ')).includes(t)));
      const focused=document.activeElement?.dataset.ptVideoSelect;
      host.querySelector('[data-pt-video-count]').textContent=found.length+' video phù hợp · ghi nhận đã xem là do bạn đánh dấu';
      host.querySelector('[data-pt-video-list]').innerHTML=found.length?found.slice(0,limit).map((v,i)=>'<article class="pt-card pt-video-card" data-topic="'+v.topic+'"><div class="pt-video-art" aria-hidden="true"><span>▶</span><b>'+String(i+1).padStart(2,'0')+'</b></div><p class="pt-kicker">'+e(topicName(v.topic))+' · '+e(levelName(v.level))+'</p><h3>'+e(v.title)+'</h3><p>'+e(v.publisher)+'</p><p class="pt-muted">'+(s.favorites.includes(v.id)?'★ Đã lưu · ':'')+(s.records[v.id]?.reviewed?'Đã xem · tự ghi':'Chưa đánh dấu đã xem')+'</p><button type="button" data-pt-video-select="'+v.id+'" aria-pressed="'+(v.id===selected.id)+'">Chọn video & hướng dẫn</button></article>').join(''):'<p class="pt-empty">Không có video phù hợp. Thử bỏ bộ lọc hoặc tìm tên kỹ năng khác.</p>';
      const more=host.querySelector('[data-pt-video-more]');more.hidden=limit>=found.length;more.textContent='Xem thêm ('+(found.length-Math.min(limit,found.length))+')';
      if(focused)host.querySelector('[data-pt-video-select="'+focused+'"]')?.focus();
    }
    function markers(){host.querySelector('[data-pt-markers]').innerHTML=record().markers.length?record().markers.map(m=>'<li><b>'+time(m.seconds)+'</b> '+e(m.note)+' <button type="button" data-pt-video-at="'+m.seconds+'">Mở tại mốc</button> <button type="button" data-pt-marker-remove="'+m.seconds+'" aria-label="Xóa mốc '+time(m.seconds)+'">Xóa</button></li>').join(''):'<li>Chưa có mốc. Nhập thời điểm bạn quan sát; HH không tự đọc tiến độ YouTube.</li>';}
    function detail(moveFocus=false){
      stopEmbed();const r=record(),draft=drafts.get(draftKey());
      host.querySelector('[data-pt-video-detail]').innerHTML='<header><p class="pt-kicker">'+e(selected.publisher)+' · '+e(topicName(selected.topic))+'</p><h3 tabindex="-1" data-pt-video-heading>'+e(selected.title)+'</h3><p class="pt-muted">'+e(selected.originalTitle)+'</p></header><aside class="pt-notice">'+(selected.level==='advanced'?'Chỉ quan sát định hướng · cần HLV và điều kiện chuyên dụng. Không tự thử theo clip.':'Xem để trao đổi với HLV; chuẩn bị bảo hộ, sân kiểm soát và phương án dừng.')+'</aside><div class="pt-player" data-pt-player><p>Chưa kết nối YouTube. Bấm mở để tải trình phát ngoài.</p></div><p class="pt-muted">Mở video kết nối tới YouTube và có thể gửi IP/thông tin trình duyệt. Dùng miền privacy-enhanced, không tự phát; quyền xem/nhúng do nhà xuất bản quyết định. Không tải hoặc lưu video nguồn.</p><div class="pt-actions"><button type="button" class="pt-primary" data-pt-video-open>Mở video · kết nối YouTube</button><button type="button" data-pt-video-stop hidden>Đóng trình phát</button><a href="'+selected.watchUrl+'" target="_blank" rel="noopener noreferrer">Xem trực tiếp trên YouTube ↗</a><a href="'+e(selected.sourceUrl)+'" target="_blank" rel="noopener noreferrer">Trang nhà xuất bản ↗</a></div><p class="pt-muted">Nếu trình phát bị chặn, video bị gỡ hoặc giới hạn vùng/tuổi, dùng liên kết nguồn. Tốc độ, phụ đề và toàn màn hình dùng điều khiển của YouTube; chưa xác minh phụ đề tiếng Việt.</p><h4>Quan sát có mục tiêu</h4><ol>'+selected.observations.map(t=>'<li>'+e(t)+'</li>').join('')+'</ol><div class="pt-chips">'+selected.skillIds.map(id=>'<a class="pt-chip" href="#/patin/skills/'+id+'" data-app-route="/patin/skills/'+id+'">'+e(D.skills.find(s=>s.id===id)?.title)+'</a>').join('')+'</div><div class="pt-actions"><button type="button" data-pt-video-favorite aria-pressed="'+state().favorites.includes(selected.id)+'">'+(state().favorites.includes(selected.id)?'★ Bỏ yêu thích':'☆ Yêu thích video')+'</button><label class="pt-radio"><input type="checkbox" data-pt-video-reviewed '+(r.reviewed?'checked':'')+'> Tôi đã xem / đối chiếu (tự ghi)</label></div><label class="pt-field">Ghi chú quan sát riêng · tự lưu<textarea rows="4" maxlength="2000" data-pt-video-note placeholder="Điều nhìn thấy, phần chưa rõ, câu hỏi cho HLV…">'+e(draft?.note??r.note)+'</textarea></label><p class="pt-muted">Không tính xem video thành thời lượng tập hoặc xác nhận kỹ năng. Ghi chú, yêu thích và mốc nằm trong bản sao JSON Patin; không đồng bộ máy chủ.</p><div class="pt-actions"><button type="button" data-pt-video-export-note>Tải ghi chú TXT</button><button type="button" data-pt-video-note-discard '+(draft?'':'hidden')+'>Bỏ bản ghi chú xung đột & tải bản đã lưu</button></div><form data-pt-marker-form class="pt-marker-form"><h4>Mốc thời gian của bạn · tối đa 12</h4><label class="pt-field">Thời điểm (giây)<input name="seconds" type="number" min="0" max="86400" step="1" required placeholder="Ví dụ: 45"></label><label class="pt-field">Điều muốn nhớ<input name="note" maxlength="160" required></label><button type="submit">Lưu / cập nhật mốc</button></form><ul class="pt-markers" data-pt-markers></ul>';
      host.querySelector('[data-pt-video-note]').dataset.expected=r.note;markers();if(moveFocus)host.querySelector('[data-pt-video-heading]').focus();
      if(draft)message('Có bản ghi chú chưa lưu do xung đột. Tải TXT để giữ bản đang nhập rồi đối chiếu; không tự ghi đè tab khác.');
    }
    function open(seconds=0){
      stopEmbed();if(fileVideo)fileVideo.pause();
      frame=document.createElement('iframe');frame.title=selected.title+' · '+selected.publisher;frame.referrerPolicy='strict-origin-when-cross-origin';frame.allow='fullscreen; encrypted-media; picture-in-picture';frame.allowFullscreen=true;
      frame.src='https://www.youtube-nocookie.com/embed/'+selected.youtubeId+'?autoplay=0&playsinline=1&rel=0&start='+seconds;
      host.querySelector('[data-pt-player]').replaceChildren(frame);host.querySelector('[data-pt-video-stop]').hidden=false;
      // A loaded cross-origin frame cannot prove media playback or subtitle availability.
      frame.addEventListener('error',()=>{if(alive)message('Không tải được khung video. Dùng liên kết nguồn hoặc thử lại.');},{once:true});
      message('Đã yêu cầu trình phát ngoài. Bấm Play trong video nếu muốn xem; HH không xác minh trạng thái phát bên trong YouTube.');
    }
    host.innerHTML='<section class="pt-video-studio"><header class="pt-studio-head"><p class="pt-kicker">HH PATIN · WATCH / NOTICE / ASK</p><h2>Học qua video · '+D.videos.length+' nguồn trực quan</h2><p>Chọn kỹ năng → xem toàn cảnh → ghi một điều nhìn thấy → hỏi HLV. Nguồn từ nhà xuất bản, không phải khóa học hoặc chứng chỉ HH.</p></header><div class="pt-actions"><button type="button" data-pt-video-jump="library">Chọn video / bộ lọc ↓</button><button type="button" data-pt-video-jump="detail">Video đang chọn ↓</button></div><p data-pt-video-status role="status" aria-live="polite"></p><div class="pt-video-layout"><section class="pt-card pt-video-detail" data-pt-video-detail aria-label="Video đang chọn"></section><section class="pt-video-library" aria-label="Thư viện video"><div class="pt-card"><label class="pt-field">Tìm video hoặc kỹ năng<input type="search" data-pt-video-query maxlength="120" placeholder="Phanh, Fish, Speed, SkateIA…"></label><div class="pt-detail-grid"><label class="pt-field">Nhóm<select data-pt-video-topic><option value="all">Tất cả</option>'+['foundation','speed','slide','slalom'].map(t=>'<option value="'+t+'">'+topicName(t)+'</option>').join('')+'</select></label><label class="pt-field">Mức tiếp cận HH<select data-pt-video-level><option value="all">Tất cả</option>'+D.levels.map(l=>'<option value="'+l.id+'">'+e(l.title)+'</option>').join('')+'</select></label></div><label class="pt-radio"><input type="checkbox" data-pt-video-favorites> Chỉ video yêu thích</label><label class="pt-radio"><input type="checkbox" data-pt-video-unreviewed> Chưa tự đánh dấu đã xem</label><button type="button" data-pt-video-clear>Xóa bộ lọc</button></div><p data-pt-video-count role="status"></p><div class="pt-video-grid" data-pt-video-list></div><button type="button" data-pt-video-more>Xem thêm</button></section></div><details class="pt-card pt-local-video"><summary>Video của bạn · tua chậm & lặp đoạn A–B trên thiết bị</summary><p>Chỉ mở video bạn sở hữu hoặc được phép sử dụng. Không tải lên máy chủ, không lưu tệp sau reload/rời mục. Hỗ trợ codec phụ thuộc trình duyệt; tối đa 150 MB.</p><label class="pt-field">Chọn MP4 / WebM<input type="file" accept="video/mp4,video/webm" data-pt-local-file></label><p data-pt-local-status role="status">Chưa chọn tệp.</p><video controls playsinline preload="metadata" data-pt-local-player hidden></video><div class="pt-local-controls"><label class="pt-field">Tốc độ<select data-pt-local-rate disabled>'+[.25,.5,.75,1,1.25,1.5].map(r=>'<option value="'+r+'" '+(r===1?'selected':'')+'>'+r+'×</option>').join('')+'</select></label><button type="button" data-pt-local-seek="-5" disabled>−5 giây</button><button type="button" data-pt-local-seek="5" disabled>+5 giây</button><button type="button" data-pt-local-a disabled>Đặt A tại vị trí hiện tại</button><button type="button" data-pt-local-b disabled>Đặt B tại vị trí hiện tại</button><button type="button" data-pt-local-loop aria-pressed="false" disabled>Bật lặp A–B</button><button type="button" data-pt-local-reset disabled>Xóa đoạn A–B</button><button type="button" data-pt-local-close disabled>Đóng tệp & giải phóng</button></div><p data-pt-local-range role="status">A: chưa đặt · B: chưa đặt</p></details></section>';
    function localMessage(t){host.querySelector('[data-pt-local-status]').textContent=t;}
    function localRange(){host.querySelector('[data-pt-local-range]').textContent='A: '+(a===null?'chưa đặt':a.toFixed(1)+' giây')+' · B: '+(b===null?'chưa đặt':b.toFixed(1)+' giây')+' · '+(loop?'Đang bật lặp (chỉ khi phát)':'Không lặp');host.querySelector('[data-pt-local-loop]').setAttribute('aria-pressed',String(loop));}
    function enableLocal(enabled){host.querySelectorAll('.pt-local-controls button,.pt-local-controls select').forEach(n=>n.disabled=!enabled);}
    on(host,'click',event=>{
      const btn=event.target.closest('button');if(!btn)return;
      if(btn.hasAttribute('data-pt-video-jump'))host.querySelector(btn.dataset.ptVideoJump==='library'?'[data-pt-video-query]':'[data-pt-video-heading]')?.focus();
      if(btn.hasAttribute('data-pt-video-select')){const next=D.videos.find(v=>v.id===btn.dataset.ptVideoSelect);if(!next)return;selected=next;if(fileVideo)fileVideo.pause();write(s=>C.setLastVideo(s,selected.id));detail(true);list();}
      if(btn.hasAttribute('data-pt-video-open'))open();
      if(btn.hasAttribute('data-pt-video-at'))open(Number(btn.dataset.ptVideoAt));
      if(btn.hasAttribute('data-pt-video-stop'))stopEmbed();
      if(btn.hasAttribute('data-pt-video-favorite')&&write(s=>C.toggleVideoFavorite(s,selected.id))){const saved=state().favorites.includes(selected.id);btn.setAttribute('aria-pressed',String(saved));btn.textContent=saved?'★ Bỏ yêu thích':'☆ Yêu thích video';list();}
      if(btn.hasAttribute('data-pt-video-more')){limit+=8;list();}
      if(btn.hasAttribute('data-pt-video-clear')){query='';topic=level='all';onlyFavorite=onlyUnreviewed=false;limit=8;host.querySelector('[data-pt-video-query]').value='';host.querySelector('[data-pt-video-topic]').value='all';host.querySelector('[data-pt-video-level]').value='all';host.querySelector('[data-pt-video-favorites]').checked=host.querySelector('[data-pt-video-unreviewed]').checked=false;list();}
      if(btn.hasAttribute('data-pt-marker-remove')&&write(s=>C.removeVideoMarker(s,selected.id,Number(btn.dataset.ptMarkerRemove)))){markers();host.querySelector('[data-pt-marker-form] input')?.focus();}
      if(btn.hasAttribute('data-pt-video-export-note')){const raw=[selected.title,selected.watchUrl,host.querySelector('[data-pt-video-note]').value,...record().markers.map(m=>time(m.seconds)+' '+m.note)].join('\n'),url=URL.createObjectURL(new Blob([raw],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='hh-patin-video-note.txt';link.click();URL.revokeObjectURL(url);}
      if(btn.hasAttribute('data-pt-video-note-discard')){drafts.delete(draftKey());detail(true);}
      if(!fileVideo)return;
      if(btn.hasAttribute('data-pt-local-seek'))fileVideo.currentTime=Math.max(0,Math.min(fileVideo.duration,fileVideo.currentTime+Number(btn.dataset.ptLocalSeek)));
      if(btn.hasAttribute('data-pt-local-a')){a=fileVideo.currentTime;loop=false;localRange();}
      if(btn.hasAttribute('data-pt-local-b')){b=fileVideo.currentTime;loop=false;localRange();}
      if(btn.hasAttribute('data-pt-local-loop')){if(a===null||b===null||b-a<.25){localMessage('Đặt B sau A ít nhất 0,25 giây rồi bật lặp.');return;}loop=!loop;localRange();}
      if(btn.hasAttribute('data-pt-local-reset')){a=b=null;loop=false;localRange();}
      if(btn.hasAttribute('data-pt-local-close')){releaseFile();host.querySelector('[data-pt-local-player]').hidden=true;host.querySelector('[data-pt-local-file]').value='';enableLocal(false);localRange();localMessage('Đã đóng tệp và giải phóng URL cục bộ.');}
    });
    on(host,'input',event=>{
      const n=event.target;
      if(n.hasAttribute('data-pt-video-query')){query=n.value.slice(0,120);limit=8;list();}
      if(n.hasAttribute('data-pt-video-note')){const note=n.value,expected=n.dataset.expected;if(write(s=>C.setVideoNote(s,selected.id,note,expected))){n.dataset.expected=note;drafts.delete(draftKey());}else{drafts.set(draftKey(),{note});host.querySelector('[data-pt-video-note-discard]').hidden=false;}}
    });
    on(host,'change',event=>{
      const n=event.target;
      if(n.hasAttribute('data-pt-video-topic'))topic=n.value;
      if(n.hasAttribute('data-pt-video-level'))level=n.value;
      if(n.hasAttribute('data-pt-video-favorites'))onlyFavorite=n.checked;
      if(n.hasAttribute('data-pt-video-unreviewed'))onlyUnreviewed=n.checked;
      if(n.matches('[data-pt-video-topic],[data-pt-video-level],[data-pt-video-favorites],[data-pt-video-unreviewed]')){limit=8;list();}
      if(n.hasAttribute('data-pt-video-reviewed')){if(!write(s=>C.setVideoReviewed(s,selected.id,n.checked)))n.checked=!n.checked;list();}
      if(n.hasAttribute('data-pt-local-rate')&&fileVideo)fileVideo.playbackRate=Number(n.value);
      if(n.hasAttribute('data-pt-local-file')){
        const file=n.files[0];if(!file)return;
        releaseFile();enableLocal(false);localRange();
        if(file.size>150*1024*1024||!['video/mp4','video/webm'].includes(file.type)){host.querySelector('[data-pt-local-player]').hidden=true;n.value='';localMessage('Chọn MP4/WebM hợp lệ, tối đa 150 MB.');return;}
        stopEmbed();fileVideo=host.querySelector('[data-pt-local-player]');fileVideo.hidden=false;blobUrl=URL.createObjectURL(file);fileVideo.src=blobUrl;host.querySelector('[data-pt-local-close]').disabled=false;fileVideo.playbackRate=1;host.querySelector('[data-pt-local-rate]').value='1';localMessage('Đang đọc metadata tệp trên thiết bị: '+file.name);
      }
    });
    on(host,'submit',event=>{if(!event.target.hasAttribute('data-pt-marker-form'))return;event.preventDefault();const f=new FormData(event.target);if(write(s=>C.setVideoMarker(s,selected.id,Number(f.get('seconds')),String(f.get('note'))))){markers();event.target.reset();}});
    const media=host.querySelector('[data-pt-local-player]');
    on(media,'loadedmetadata',()=>{if(!alive||!fileVideo)return;if(!Number.isFinite(media.duration)||media.duration<=0){localMessage('Không đọc được thời lượng/codec. Chọn tệp khác.');return;}enableLocal(true);localMessage('Tệp đã đọc được · '+media.duration.toFixed(1)+' giây. Bấm Play để phát.');});
    on(media,'error',()=>{if(fileVideo){enableLocal(false);host.querySelector('[data-pt-local-close]').disabled=false;localMessage('Trình duyệt không đọc được tệp/codec. Đóng tệp hoặc chọn MP4/WebM khác.');}});
    on(media,'timeupdate',()=>{if(loop&&fileVideo&&!media.paused&&a!==null&&b!==null&&media.currentTime>=b)media.currentTime=a;});
    on(media,'play',()=>{stopEmbed();if(document.hidden)media.pause();});
    on(host.querySelector('.pt-local-video'),'toggle',event=>{if(!event.target.open&&fileVideo)fileVideo.pause();});
    on(document,'visibilitychange',()=>{if(document.hidden){stopEmbed('Tab bị ẩn: đã đóng trình phát ngoài để không phát ngầm. Bấm mở lại khi cần.');if(fileVideo)fileVideo.pause();}});
    on(global,'storage',event=>{if(event.key===store.key)list();});
    if(videoId&&D.videos.some(v=>v.id===videoId))write(s=>C.setLastVideo(s,videoId));
    list();detail();
    return ()=>{alive=false;if(frame){frame.remove();frame=null;}cleanups.splice(0).forEach(fn=>fn());releaseFile();};
  }
  global.HHPatinVideo=Object.freeze({mount,discardDrafts:key=>{for(const k of drafts.keys())if(k.startsWith(key+':'))drafts.delete(k);}});
})(window);
