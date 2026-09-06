(function(root,factory){"use strict";const api=factory(root);if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.HHGalaxyWorkbench=api;})(typeof globalThis!=="undefined"?globalThis:this,function(global){
  "use strict";
  const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const action=(id,text)=>`<button type="button" class="hgl1-button hgl1-button--ghost" data-gwb="${id}">${text}</button>`;
  const panel=(title,content)=>`<section class="gwb-panel"><header><span class="hgl1-kicker">WORKBENCH · XỬ LÝ THẬT TRÊN THIẾT BỊ</span><h3>${title}</h3></header>${content}</section>`;
  const notice='<output class="gwb-status" data-gwb-status role="status" aria-live="polite">Chưa xử lý dữ liệu.</output>';
  function markup(route){
    if(route==="/galaxy/music")return panel("Cắt, fade và xuất WAV",'<p>Giữ nguyên tệp gốc. WAV PCM 16-bit; tối đa 24 triệu mẫu/kênh. Bản mix căn các track về thời điểm 0 và tự giảm peak để tránh clipping.</p><div class="gwb-fields"><label>Gain<input type="number" min="0" max="4" step="0.1" value="1" data-gwb-gain></label><label>Fade in (giây)<input type="number" min="0" step="0.1" value="0" data-gwb-fade-in></label><label>Fade out (giây)<input type="number" min="0" step="0.1" value="0" data-gwb-fade-out></label></div><div class="gwb-actions">'+action("audio-preview","Nghe bản cắt")+action("audio-export","Xuất WAV đã cắt")+action("source-download","Tải tệp/bản thu gốc")+'</div><label><input type="checkbox" data-gwb-loop> Lặp khoảng cắt trên player</label><div data-gwb-audio-result></div><h4>Mix nhiều track</h4><p>Chọn 2–8 track trong playlist hiện tại. Mỗi track có trọng số bằng nhau.</p><div class="gwb-track-list" data-gwb-tracks></div>'+action("audio-mix","Mix và tải WAV")+notice);
    if(route==="/galaxy/video")return panel("Phụ đề có thể chỉnh sửa",'<label>Phụ đề SRT hoặc VTT<textarea rows="9" data-gwb-subtitles spellcheck="false" placeholder="1&#10;00:00:01,000 --> 00:00:03,000&#10;Nội dung phụ đề"></textarea></label><div class="gwb-actions">'+action("subtitle-apply","Gắn vào video")+action("subtitle-srt","Xuất SRT")+action("subtitle-vtt","Xuất VTT")+'</div>'+notice);
    if(route==="/galaxy/ai")return panel("Prompt có biến & tài liệu",'<p>Dùng {{ten_bien}} trong prompt. Biến và tài liệu chỉ được ghép cục bộ; bấm Gửi ở trên mới truyền tới provider.</p><label>Giá trị biến (JSON object)<textarea rows="3" data-gwb-variables placeholder=\'{"chu_de":"Thiên văn"}\'>{}</textarea></label><div class="gwb-actions">'+action("prompt-preview","Xem prompt sau điền biến")+action("prompt-apply","Điền vào ô gửi AI")+'</div><pre class="gwb-result" data-gwb-prompt-result></pre><label>Tài liệu đã nhập<select data-gwb-attachment><option value="">Chọn tài liệu văn bản</option></select></label>'+action("attach-text","Đính kèm nội dung vào prompt")+notice);
    if(route==="/galaxy/dev")return panel("Tìm/thay thế và so sánh mã",'<div class="gwb-fields"><label>Tìm chuỗi<input type="text" data-gwb-find></label><label>Thay bằng<input type="text" data-gwb-replace></label></div><div class="gwb-actions">'+action("find-code","Tìm tiếp")+action("replace-code","Thay tất cả")+action("export-code","Tải mã nguồn")+'</div><label>Phiên bản trước<textarea rows="5" data-gwb-before spellcheck="false"></textarea></label>'+action("diff-code","So sánh theo dòng")+'<pre class="gwb-result" data-gwb-diff></pre>'+notice);
    if(route==="/galaxy/community")return panel("Xem trước bản nháp",'<p>Preview Markdown được xử lý cục bộ và lọc HTML. Không đăng hoặc gửi nội dung tới realtime.</p>'+action("community-preview","Xem trước nội dung")+'<div class="gwb-result" data-gwb-community-preview></div>'+notice);
    if(route==="/galaxy/learning")return panel("Sổ lỗi từ câu trả lời thật",'<p>Chỉ tổng hợp câu quiz đã trả lời sai; không tạo dữ liệu học mẫu hoặc tiết lộ đáp án của câu hỏi đang làm.</p>'+action("mistakes-show","Xem sổ lỗi")+'<div data-gwb-mistakes></div>'+notice);
    return "";
  }
  function mount(app,options={}){
    if(!app||!global.document||!global.HHGalaxyWorkbenchCore)return null;
    const core=global.HHGalaxyWorkbenchCore,route=options.route,controller=new AbortController(),signal=controller.signal;
    const nodes=[],leases=new Set(),restorers=[];let disposed=false,audioContext=null,busy=false,pcmWorker=null,videoController=null;
    const listen=(target,type,fn,extra={})=>target?.addEventListener(type,fn,{...extra,signal});
    const status=(text,error=false)=>{const output=app.querySelector('[data-gwb-status]');if(output){output.textContent=text;output.dataset.error=String(error);}options.notify?.(text,error?"error":"info");};
    const append=(host,html)=>{if(!host)return null;const node=global.document.createElement('div');node.className='gwb-extension';node.innerHTML=html;host.appendChild(node);nodes.push(node);return node;};
    function download(data,name,type="text/plain;charset=utf-8"){
      const blob=data instanceof Blob?data:new Blob([data],{type});const url=URL.createObjectURL(blob);leases.add(url);
      const link=global.document.createElement('a');link.href=url;link.download=name.replace(/[<>:"/\\|?*]/g,'-');link.click();
      global.setTimeout(()=>{URL.revokeObjectURL(url);leases.delete(url);},5000);
    }
    let content=markup(route);
    if(route==='/galaxy/games')content=panel('Thử thách có mục tiêu','<p>Dùng phím hoặc chạm/kéo trên canvas để di chuyển. Đạt đủ điểm trước khi hết giờ để thắng. Game không phát âm thanh.</p><label>Độ khó cho lượt tiếp theo<select data-gwb-game-difficulty><option value="easy">Dễ · 5 điểm / 90 giây</option><option value="normal" selected>Vừa · 10 điểm / 60 giây</option><option value="hard">Khó · 15 điểm / 40 giây</option></select></label>'+action('game-restart','Bắt đầu lượt mới')+notice);
    if(route==='/galaxy/ai')content+=panel('Hội thoại hiện tại','<div class="gwb-actions">'+action('conversation-copy','Sao chép hội thoại')+action('conversation-export','Xuất hội thoại')+'</div><p>Mỗi lượt phản hồi được lưu thành snapshot. Khi chạm giới hạn context, xuất hội thoại trước khi bắt đầu mới.</p>');
    if(route==='/galaxy/video')content+=panel('Cắt / ghép video và chữ — xuất WebM', '<p>Xuất thực bằng Canvas + MediaRecorder, 1280×720, tối đa 120 giây. Tốc độ realtime; giữ tab hiển thị. Không thay đổi tệp gốc. Ghép clip dùng các video đã nhập trong phiên và căn về đầu mỗi clip.</p><div class="gwb-fields"><label>Bắt đầu (giây)<input type="number" min="0" step="0.1" value="0" data-gwb-video-start></label><label>Kết thúc (trống = hết)<input type="number" min="0" step="0.1" data-gwb-video-end></label></div><label>Chữ trên video<input type="text" maxlength="180" data-gwb-video-title></label><label>Màu chữ<input type="color" value="#ffffff" data-gwb-video-color></label><label><input type="checkbox" data-gwb-video-join> Ghép các video trong phiên (tối đa 4)</label><div class="gwb-actions">'+action('video-render','Xuất WebM thật')+action('video-cancel','Hủy tác vụ')+'</div><progress data-gwb-video-progress max="1" value="0"></progress><div data-gwb-video-result></div>');
    if(content)append(app.querySelector('.hgl1-functional-workspace')||app.querySelector('.hgl1-learning-main')||app.querySelector('.hgl1-main'),content);
    if(route==='/galaxy/music'){
      const canvas=app.querySelector('[data-hgl1-waveform]');
      if(canvas){
        const wrapper=document.createElement('div');wrapper.className='gwb-wave-scroll';canvas.parentElement.insertBefore(wrapper,canvas);wrapper.appendChild(canvas);
        const style=canvas.getAttribute('style');
        const zoom=append(app.querySelector('.hgl1-audio-console'),'<label>Phóng waveform<select data-gwb-wave-zoom><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></label>');
        listen(zoom,'change',event=>{canvas.style.width=String(Number(event.target.value)*100)+'%';canvas.style.maxWidth='none';canvas.style.height='140px';});
        restorers.push(()=>{if(wrapper.parentElement){wrapper.parentElement.insertBefore(canvas,wrapper);wrapper.remove();}if(style===null)canvas.removeAttribute('style');else canvas.setAttribute('style',style);});
      }
    }
    if(route==='/galaxy/dev'){
      const host=append(app.querySelector('.hgl1-dev-workspace'),'<details class="gwb-code-preview" open><summary>Màu cú pháp & số dòng — bản xem mã, không thực thi</summary><pre data-gwb-code-highlight></pre></details>');
      const editor=app.querySelector('#hgl1-dev-code');const update=()=>{host.querySelector('pre').innerHTML=core.highlightCode(editor.value);};listen(editor,'input',update);update();
    }
    if(route==='/galaxy/community'){
      const node=app.querySelector('[data-hgl1-community-form]');if(node)append(node,'<label>Tệp văn bản đính kèm (TXT/MD, tối đa 32 KB)<input type="file" accept=".txt,.md,text/plain,text/markdown" data-gwb-draft-file></label>');
    }
    const items=()=>options.items?.()||[];
    const library=app.querySelector('.hgl1-library');
    const favoriteFilter=library?append(library.querySelector('.hgl1-section-head')||library,'<label class="gwb-favorite-filter"><input type="checkbox" data-gwb-favorites-only> Chỉ hiện yêu thích</label>'):null;
    const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase();
    const filterItems=()=>{if(disposed)return;const query=normalize(app.querySelector('[data-hgl1-item-filter]')?.value),only=!!favoriteFilter?.querySelector('input').checked;const records=items();app.querySelectorAll('[data-hgl1-item]').forEach(card=>{const item=records.find(row=>row.id===card.dataset.itemId);if(item)card.hidden=(only&&!item.meta?.favorite)||!normalize([item.title,item.description,item.meta?.folder,...(item.meta?.tags||[])].join(' ')).includes(query);});};
    if(favoriteFilter)listen(favoriteFilter,'change',filterItems);
    listen(app,'input',event=>{if(event.target.matches('[data-hgl1-item-filter]'))queueMicrotask(filterItems);});
    const communityClient=route==='/galaxy/community'?global.HHGalaxyCommunityClient?.mount?.(app,options):null;
    const valid=()=>!disposed&&app.isConnected&&options.isActive?.()!==false;
    app.querySelectorAll('[data-hgl1-item]').forEach(card=>{
      const item=items().find(item=>item.id===card.dataset.itemId);if(!item)return;
      const controls=append(card.querySelector('.hgl1-document__body'),'<div class="gwb-item-actions" data-gwb-item-id="'+esc(item.id)+'">'+action('item-edit',item.meta?.fileName?'Mở tệp đã lưu':'Sửa / mở')+action('item-favorite',item.meta?.favorite?'★ Đã thích':'☆ Yêu thích')+action('item-export','Xuất')+'</div>');
      if(controls){controls.dataset.itemId=item.id;if(route==='/galaxy/ai'&&item.kind==='ai-conversation')controls.querySelector('.gwb-item-actions').insertAdjacentHTML('beforeend',action('item-continue','Tiếp tục hội thoại'));}
    });
    const attachment=app.querySelector('[data-gwb-attachment]');
    if(attachment)items().filter(item=>item.meta?.fileName&&/^(?:text\/|application\/json)/.test(item.meta.fileType)).forEach(item=>{const option=global.document.createElement('option');option.value=item.id;option.textContent=item.title;attachment.appendChild(option);});
    const tracks=app.querySelector('[data-gwb-tracks]');
    let videoTimeline=null;
    const drawTimeline=()=>{if(videoTimeline)videoTimeline.querySelector('[data-gwb-video-timeline]').innerHTML=(options.videos?.()||[]).map((clip,index)=>'<li><b>'+String(index+1).padStart(2,'0')+'</b><span>'+esc(clip.name)+'</span><button type="button" data-gwb="video-up" data-clip-index="'+index+'" aria-label="Đưa clip lên">↑</button><button type="button" data-gwb="video-down" data-clip-index="'+index+'" aria-label="Đưa clip xuống">↓</button></li>').join('')||'<li>Nhập clip để xây timeline.</li>';};
    if(route==='/galaxy/video'){
      videoTimeline=append(app.querySelector('.hgl1-media-workspace'),panel('Timeline & project video','<ol class="gwb-video-timeline" data-gwb-video-timeline></ol><label>Tên project<input maxlength="160" data-gwb-video-project-name></label>'+action('video-project-save','Lưu project và liên kết nguồn')+'<label>Project đã lưu<select data-gwb-video-project><option value="">Chọn project</option>'+items().filter(item=>item.kind==='video-edit-project').map(item=>'<option value="'+esc(item.id)+'">'+esc(item.title)+'</option>').join('')+'</select></label>'+action('video-project-load','Khôi phục project')+'<p>Project lưu liên kết nguồn trong kho Lớp 1; backup JSON không chứa media nhị phân. Ghép clip dùng thứ tự hiện tại.</p>'));drawTimeline();
    }
    const renderTracks=()=>{if(tracks)tracks.innerHTML=(options.playlist?.()||[]).map((track,i)=>`<div class="gwb-track-row"><label><input type="checkbox" data-gwb-track="${i}"> ${esc(track.name)}</label><button type="button" data-gwb="track-up" data-track-index="${i}" aria-label="Đưa ${esc(track.name)} lên">↑</button><button type="button" data-gwb="track-down" data-track-index="${i}" aria-label="Đưa ${esc(track.name)} xuống">↓</button></div>`).join('')||'<p>Nhập các tệp âm thanh để chọn track.</p>';};
    if(tracks){renderTracks();append(tracks.parentElement,'<div class="gwb-actions">'+action('playlist-restore','Khôi phục playlist từ kho đã lưu')+'</div><label>Tìm track<input type="search" data-gwb-track-search></label>');}
    const examples={"analyze-text":"Xin chào HH Galaxy!\nDữ liệu ví dụ.","format-json":'{"website":"hoang8.com","layer":1}',"preview-markdown":"# Dữ liệu ví dụ\n\n- **Xin chào** HH Galaxy","csv-to-json":'name,note\nAn,"Xin chào, Galaxy"',"json-to-csv":'[{"name":"An","note":"Xin chào"}]',"sha256-text":"HH Galaxy","generate-qr":"https://hoang8.com"};
    if(route==='/galaxy/tools')app.querySelectorAll('.hgl1-tool').forEach(card=>append(card,'<div class="gwb-tool-actions">'+action('tool-copy','Sao chép')+action('tool-download','Tải kết quả')+action('tool-example','Nạp ví dụ')+action('tool-reset','Xóa ô nhập')+'</div><small class="gwb-example-note" hidden>Dữ liệu ví dụ — không phải dữ liệu người dùng</small>'));
    async function decode(file){
      if(!file||file.size>64*1024*1024)throw Error('Mỗi track tối đa 64 MB cho xử lý PCM.');
      const Context=global.AudioContext||global.webkitAudioContext;if(!Context)throw Error('Web Audio không được hỗ trợ.');
      audioContext ||= new Context();const bytes=await file.arrayBuffer();if(!valid())throw Error('Đã rời workspace.');
      const buffer=await audioContext.decodeAudioData(bytes);if(!valid())throw Error('Đã rời workspace.');
      if(buffer.length>core.MAX_SAMPLES)throw Error('Âm thanh đã giải mã vượt giới hạn 24 triệu mẫu/kênh.');return buffer;
    }
    async function processPCM(buffers,type,options){
      if(typeof global.Worker!=='function')throw Error('Trình duyệt không hỗ trợ Worker; không xử lý PCM nặng trên giao diện.');
      let samples=0;
      const data=buffers.map(buffer=>{samples+=buffer.length*buffer.numberOfChannels;if(samples>48000000)throw Error('Tổng PCM vượt 48 triệu mẫu.');return {sampleRate:buffer.sampleRate,channels:Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i).slice().buffer)};});
      return new Promise((resolve,reject)=>{
        const worker=new Worker('galaxy-workbench-worker.js?v=3');pcmWorker=worker;
        const cancel=()=>{clearTimeout(timer);worker.terminate();pcmWorker=null;reject(new DOMException('Đã hủy.','AbortError'));};
        const done=()=>{clearTimeout(timer);signal.removeEventListener('abort',cancel);worker.terminate();if(pcmWorker===worker)pcmWorker=null;};
        const timer=setTimeout(()=>{done();reject(Error('Worker quá thời gian xử lý.'));},60000);
        signal.addEventListener('abort',cancel,{once:true});
        worker.onmessage=event=>{done();event.data.ok?resolve(event.data):reject(Error(event.data.error));};
        worker.onerror=()=>{done();reject(Error('Không tải/chạy được PCM worker.'));};
        worker.postMessage({type,buffers:data,options},data.flatMap(item=>item.channels));
      });
    }
    function audioOptions(session){const form=app.querySelector('[data-hgl1-trim-form]');return {start:Number(form?.elements.start.value||0),end:Number(form?.elements.end.value||session.element.duration),gain:Number(app.querySelector('[data-gwb-gain]').value),fadeIn:Number(app.querySelector('[data-gwb-fade-in]').value),fadeOut:Number(app.querySelector('[data-gwb-fade-out]').value)};}
    const media=options.session?.();
    if(media?.kind==='audio'){
      listen(media.element,'timeupdate',()=>{
        const canvas=app.querySelector('[data-hgl1-waveform]'),context=canvas?.getContext('2d');
        if(context&&media.waveform&&media.element.duration){options.drawWaveform?.(media.waveform);const x=canvas.width*media.element.currentTime/media.element.duration;context.fillStyle='#f4a2ff';context.fillRect(x,0,2,canvas.height);}
        if(app.querySelector('[data-gwb-loop]')?.checked){const trim=audioOptions(media);if(trim.end>trim.start&&media.element.currentTime>=trim.end)media.element.currentTime=trim.start;}
      });
      const waveform=app.querySelector('[data-hgl1-waveform]');if(waveform){waveform.setAttribute('tabindex','0');waveform.setAttribute('aria-label','Waveform: bấm để seek, phím mũi tên để chuyển 5 giây');
        listen(waveform,'click',event=>{if(!Number.isFinite(media.element.duration))return;const box=waveform.getBoundingClientRect();media.element.currentTime=Math.max(0,Math.min(1,(event.clientX-box.left)/box.width))*media.element.duration;});
        listen(waveform,'keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();media.element.currentTime=Math.max(0,Math.min(media.element.duration||0,media.element.currentTime+(event.key==='ArrowLeft'?-5:5)));}});
      }
    }
    async function editItem(item,trigger){
      if(item.meta?.fileName){await options.openFile?.(item);return;}
      const dialog=global.document.createElement('dialog');dialog.className='gwb-dialog';dialog.innerHTML='<form method="dialog"><h3>Chỉnh sửa tài liệu Lớp 1</h3><label>Tên<input name="title" maxlength="160" required value="'+esc(item.title)+'"></label><label>Nội dung (tối đa 16.000 ký tự)<textarea name="description" rows="10" maxlength="16000">'+esc(item.description)+'</textarea></label><label>Thư mục<input name="folder" maxlength="80" value="'+esc(item.meta?.folder||'')+'"></label><label>Tags, phân cách bằng dấu phẩy<input name="tags" maxlength="500" value="'+esc((item.meta?.tags||[]).join(', '))+'"></label><div class="gwb-actions"><button value="cancel">Hủy</button><button value="save">Lưu thay đổi</button></div><output role="status"></output></form>';
      app.appendChild(dialog);nodes.push(dialog);
      dialog.addEventListener('close',()=>{dialog.remove();trigger?.focus?.();},{once:true});
      dialog.addEventListener('submit',event=>{if(event.submitter?.value!=='save')return;event.preventDefault();const form=event.target;try{const saved=options.updateItem?.(item.id,{expectedUpdatedAt:item.updatedAt,title:form.elements.title.value,description:form.elements.description.value,meta:{...item.meta,folder:form.elements.folder.value,tags:form.elements.tags.value.split(',').map(x=>x.trim()).filter(Boolean)}});if(!saved)throw Error('Không thể lưu. Dữ liệu cũ vẫn được giữ.');dialog.close();options.refresh?.();}catch(error){dialog.querySelector('output').textContent=error.message;}});
      if(typeof dialog.showModal!=='function'){dialog.remove();throw Error('Trình duyệt không hỗ trợ dialog.');}dialog.showModal();
    }
    listen(app,'click',async event=>{
      const button=event.target.closest('[data-gwb]');if(!button||!app.contains(button))return;
      const id=button.dataset.gwb;const owner=button.closest('.gwb-extension');
      try{
        if(id==='video-up'||id==='video-down'){options.reorderVideos?.(Number(button.dataset.clipIndex),id==='video-up'?-1:1);drawTimeline();return;}
        if(id==='video-project-save'){
          const saved=options.saveVideoProject?.({title:app.querySelector('[data-gwb-video-project-name]').value,start:app.querySelector('[data-gwb-video-start]').value,end:app.querySelector('[data-gwb-video-end]').value,text:app.querySelector('[data-gwb-video-title]').value,color:app.querySelector('[data-gwb-video-color]').value,join:app.querySelector('[data-gwb-video-join]').checked,subtitles:app.querySelector('[data-gwb-subtitles]').value});if(!saved)throw Error('Không thể lưu project video.');const option=document.createElement('option');option.value=saved.id;option.textContent=saved.title;app.querySelector('[data-gwb-video-project]').appendChild(option);status('Đã lưu project và liên kết nguồn cục bộ.');return;
        }
        if(id==='video-project-load'){
          const project=await options.loadVideoProject?.(app.querySelector('[data-gwb-video-project]').value);if(!valid()||!project)return;for(const [key,selector]of [['start','start'],['end','end'],['text','title'],['color','color']])app.querySelector('[data-gwb-video-'+selector+']').value=String(project[key]??'');app.querySelector('[data-gwb-video-join]').checked=project.join===true;app.querySelector('[data-gwb-subtitles]').value=String(project.subtitles||'');drawTimeline();status('Đã khôi phục project và các tệp nguồn còn trong kho.');return;
        }
        if(id==='playlist-restore'){const rows=await options.restorePlaylist?.();if(valid()){renderTracks();status('Đã khôi phục '+(rows?.length||0)+' track có tệp còn trong kho. Không tự phát.');}return;}
        if(id==='track-up'||id==='track-down'){options.reorderPlaylist?.(Number(button.dataset.trackIndex),id==='track-up'?-1:1);renderTracks();return;}
        if(id==='game-restart'){options.restartGame?.();return;}
        if(id.startsWith('item-')){
          const item=items().find(item=>item.id===owner?.dataset.itemId);if(!item)throw Error('Tài liệu không còn tồn tại.');
          if(id==='item-edit')await editItem(item,button);
          if(id==='item-continue'){await options.continueConversation?.(item);if(valid())status('Đã nạp context. Chưa gửi yêu cầu AI.');}
          if(id==='item-favorite'){if(!options.updateItem?.(item.id,{meta:{...item.meta,favorite:!item.meta?.favorite}}))throw Error('Không thể lưu yêu thích.');options.refresh?.();}
          if(id==='item-export')download(JSON.stringify(item,null,2),'galaxy-'+item.id+'.json','application/json');return;
        }
        if(id.startsWith('tool-')){
          const card=button.closest('.hgl1-tool'),input=card.querySelector('textarea'),output=card.querySelector('.hgl1-tool__output');
          const tool=card.querySelector('[data-hgl1-action]')?.dataset.hgl1Action;
          if(id==='tool-reset'){input.value='';output.textContent='Chưa có kết quả.';output.dataset.gwbRevision=String(Number(output.dataset.gwbRevision||0)+1);delete output.dataset.tone;card.querySelector('.gwb-example-note').hidden=true;input.focus();return;}
          if(id==='tool-example'){input.value=examples[tool]||'';output.textContent='Ví dụ chưa được xử lý.';output.dataset.gwbRevision=String(Number(output.dataset.gwbRevision||0)+1);delete output.dataset.tone;card.querySelector('.gwb-example-note').hidden=false;input.focus();return;}
          if(output.dataset.tone!=='success')throw Error('Hãy xử lý thành công trước khi sao chép hoặc tải.');
          const text=tool==='generate-qr'?output.querySelector('svg')?.outerHTML:tool==='preview-markdown'?output.innerHTML:output.textContent;
          if(!text)throw Error('Chưa có kết quả.');
          if(id==='tool-copy'){if(!global.navigator.clipboard?.writeText)throw Error('Clipboard không khả dụng; hãy dùng Tải kết quả.');await global.navigator.clipboard.writeText(text);options.notify?.('Đã sao chép kết quả.','success');}
          else{const ext=tool==='generate-qr'?'svg':tool==='preview-markdown'?'html':tool==='json-to-csv'?'csv':['format-json','csv-to-json'].includes(tool)?'json':'txt';download(text,'galaxy-'+tool+'.'+ext,ext==='svg'?'image/svg+xml':ext==='html'?'text/html;charset=utf-8':'text/plain;charset=utf-8');}return;
        }
        if(id==='prompt-preview'||id==='prompt-apply'){
          const input=app.querySelector('[data-hgl1-ai-draft]'),values=JSON.parse(app.querySelector('[data-gwb-variables]').value||'{}');
          if(!values||Array.isArray(values)||typeof values!=='object')throw Error('Biến phải là JSON object.');
          const resolved=core.promptVariables(input.value,values);app.querySelector('[data-gwb-prompt-result]').textContent=resolved.text;
          if(resolved.missing.length)throw Error('Thiếu giá trị: '+resolved.missing.join(', '));
          if(id==='prompt-apply'){if(resolved.text.length>input.maxLength)throw Error('Prompt vượt giới hạn ô gửi.');input.value=resolved.text;}status('Đã điền biến cục bộ. Chưa gửi tới AI.');return;
        }
        if(id==='conversation-copy'||id==='conversation-export'){
          const text=options.conversation?.();if(!text)throw Error('Chưa có hội thoại đã nhận phản hồi.');
          if(id==='conversation-export')download(text,'galaxy-conversation.txt');else{if(!global.navigator.clipboard?.writeText)throw Error('Clipboard không khả dụng.');await global.navigator.clipboard.writeText(text);}status('Đã chuẩn bị hội thoại thật.');return;
        }
        if(id==='attach-text'){
          const selected=items().find(item=>item.id===attachment.value);if(!selected)throw Error('Chọn tài liệu đã nhập.');
          const data=await options.readContent?.(selected);if(!valid())return;
          const text=typeof data==='string'?data:data instanceof Blob?await data.text():JSON.stringify(data);
          const input=app.querySelector('[data-hgl1-ai-draft]'),combined=input.value+'\n\n[Tài liệu '+selected.title+']\n'+text;
          if(combined.length>input.maxLength)throw Error('Tài liệu vượt giới hạn prompt; hãy trích phần cần gửi.');input.value=combined;status('Đã ghép nội dung tài liệu; chưa gửi ra ngoài.');return;
        }
        if(['audio-preview','audio-export','audio-mix','source-download'].includes(id)){
          if(busy)throw Error('Tác vụ âm thanh đang chạy.');const session=options.session?.();
          if(id==='source-download'){if(!session?.file)throw Error('Chưa mở tệp hoặc bản thu.');download(session.file,session.fileName||'recording.webm');return;}
          busy=true;button.disabled=true;status('Đang giải mã và xử lý PCM trên thiết bị…');
          try{
            let result;
            if(id==='audio-mix'){const playlist=options.playlist?.()||[],selected=[...app.querySelectorAll('[data-gwb-track]:checked')].map(input=>playlist[Number(input.dataset.gwbTrack)]).filter(Boolean);if(selected.length<2||selected.length>8)throw Error('Chọn 2–8 track.');const buffers=[];let total=0;for(const track of selected){const buffer=await decode(track.file);total+=buffer.length*buffer.numberOfChannels;if(total>48000000)throw Error('Tổng PCM vượt giới hạn mix.');buffers.push(buffer);}result=await processPCM(buffers,'mix',{});}
            else{if(!session?.file)throw Error('Chưa mở âm thanh.');result=await processPCM([await decode(session.file)],'trim',audioOptions(session));}
            const blob=new Blob([result.wav],{type:'audio/wav'});if(!valid())return;
            if(id==='audio-preview'){const node=app.querySelector('[data-gwb-audio-result]');node.querySelector('audio')?.pause();node.replaceChildren();const audio=global.document.createElement('audio');audio.controls=true;audio.autoplay=false;audio.src=URL.createObjectURL(blob);leases.add(audio.src);node.appendChild(audio);}
            else download(blob,id==='audio-mix'?'galaxy-mix.wav':'galaxy-trim.wav');
            status('Hoàn tất: '+(result.length/result.sampleRate).toFixed(2)+' giây · '+result.channels+' kênh · WAV PCM 16-bit.');
          }finally{busy=false;if(button.isConnected)button.disabled=false;await audioContext?.close?.();audioContext=null;}return;
        }
        if(id.startsWith('subtitle-')){
          const input=app.querySelector('[data-gwb-subtitles]'),parsed=global.HHGalaxyLayerOneMedia.parseSubtitles(input.value);if(!parsed.cues.length)throw Error('Không có cue phụ đề hợp lệ.');
          if(id==='subtitle-apply'){const file=new Blob([core.serializeSubtitles(parsed.cues,'vtt')],{type:'text/vtt'});Object.defineProperty(file,'name',{value:'edited.vtt'});if(!await options.applySubtitles?.(file))throw Error('Chưa gắn được phụ đề. Hãy mở video cục bộ.');}
          else{const format=id==='subtitle-srt'?'srt':'vtt';download(core.serializeSubtitles(parsed.cues,format),'galaxy-subtitles.'+format,format==='vtt'?'text/vtt':'application/x-subrip');}status('Đã xử lý '+parsed.cues.length+' cue.');return;
        }
        if(id==='video-cancel'){videoController?.abort();status('Đã yêu cầu hủy xuất video.');return;}
        if(id==='video-render'){
          if(videoController)throw Error('Một bản xuất đang chạy.');
          const renderer=global.HHGalaxyVideoRenderer;if(!renderer)throw Error('Engine video chưa tải.');
          const files=app.querySelector('[data-gwb-video-join]').checked?(options.videos?.()||[]).map(item=>item.file):[options.session?.()?.file].filter(Boolean);
          videoController=new AbortController();const abort=()=>videoController?.abort();signal.addEventListener('abort',abort,{once:true});button.disabled=true;
          try{const result=await renderer.render({files,start:app.querySelector('[data-gwb-video-start]').value,end:app.querySelector('[data-gwb-video-end]').value,text:app.querySelector('[data-gwb-video-title]').value,color:app.querySelector('[data-gwb-video-color]').value,signal:videoController.signal,onProgress:value=>{const progress=app.querySelector('[data-gwb-video-progress]');if(progress)progress.value=value;}});if(!valid())return;download(result.blob,'galaxy-video.webm');const player=global.document.createElement('video');player.controls=true;player.src=URL.createObjectURL(result.blob);leases.add(player.src);app.querySelector('[data-gwb-video-result]').replaceChildren(player);status('Đã xuất WebM '+result.duration.toFixed(2)+' giây; '+(result.audio?'có track âm thanh.':'không có track âm thanh.'));}finally{signal.removeEventListener('abort',abort);videoController=null;if(button.isConnected)button.disabled=false;}return;
        }
        if(['find-code','replace-code','export-code','diff-code'].includes(id)){
          const editor=app.querySelector('#hgl1-dev-code'),find=app.querySelector('[data-gwb-find]').value,replacement=app.querySelector('[data-gwb-replace]').value;
          if(id==='export-code'){download(editor.value,'galaxy-snippet.'+({javascript:'js',html:'html',css:'css',json:'json'}[app.querySelector('#hgl1-dev-language').value]||'txt'));return;}
          if(id==='diff-code'){app.querySelector('[data-gwb-diff]').innerHTML=core.lineDiff(app.querySelector('[data-gwb-before]').value,editor.value).map(row=>`<span class="gwb-diff-${row.kind}">${row.kind==='add'?'+':row.kind==='remove'?'-':' '} ${esc(row.text)}</span>`).join('\n');return;}
          if(!find)throw Error('Nhập chuỗi cần tìm.');
          if(id==='replace-code'){const next=editor.value.split(find).join(replacement);if(next.length>editor.maxLength)throw Error('Kết quả vượt giới hạn editor.');editor.value=next;status('Đã thay chuỗi trong editor; bấm Lưu snippet để ghi dữ liệu.');}
          else{let index=editor.value.indexOf(find,editor.selectionEnd);if(index<0)index=editor.value.indexOf(find);if(index<0)throw Error('Không tìm thấy chuỗi.');editor.focus();editor.setSelectionRange(index,index+find.length);}return;
        }
        if(id==='community-preview'){
          const text=app.querySelector('[data-hgl1-community-form] textarea').value;const html=global.HHGalaxyLayerOneTools.markdownToSafeHtml(text);
          const clean=global.DOMPurify?.sanitize(html,{USE_PROFILES:{html:true}});if(typeof clean!=='string')throw Error('Bộ lọc HTML chưa được tải.');app.querySelector('[data-gwb-community-preview]').innerHTML=clean;status('Preview cục bộ; bài chưa được đăng.');return;
        }
        if(id==='mistakes-show'){
          if(options.isQuizActive?.())throw Error('Hoàn tất hoặc đóng quiz trước khi xem sổ lỗi.');
          const rows=core.mistakeNotebook(options.learningState?.());app.querySelector('[data-gwb-mistakes]').innerHTML=rows.map(row=>`<article><b>${esc(row.deck)}</b><p>${esc(row.card.front)}</p><small>Sai ${row.wrong} lần</small><details><summary>Xem đáp án</summary><p>${esc(row.card.back)}</p></details></article>`).join('')||'<p>Chưa có câu trả lời sai trong lịch sử quiz.</p>';status(rows.length+' thẻ cần ôn lại.');
        }
      }catch(error){if(valid())status(String(error.message||error).slice(0,260),true);}
    });
    listen(app,'change',async event=>{if(!event.target.matches('[data-gwb-draft-file]'))return;const file=event.target.files?.[0];try{if(!file||file.size>32768||!/\.(txt|md)$/i.test(file.name))throw Error('Chỉ nhận TXT/MD tối đa 32 KB.');const text=await file.text();if(!valid())return;const field=app.querySelector('[data-hgl1-community-form] textarea'),next=field.value+'\n\n[Tệp '+file.name+']\n'+text;if(next.length>field.maxLength)throw Error('Nội dung gộp vượt giới hạn bản nháp.');field.value=next;status('Đã ghép tài liệu vào bản nháp; chưa gửi ra ngoài.');}catch(error){if(valid())status(error.message,true);}finally{event.target.value='';}});
    listen(app,'input',event=>{if(event.target.matches('[data-gwb-track-search]')){tracks?.querySelectorAll('.gwb-track-row').forEach(row=>{row.hidden=!normalize(row.textContent).includes(normalize(event.target.value));});return;}const card=event.target.closest('.hgl1-tool');if(!card||!event.target.matches('textarea'))return;const output=card.querySelector('.hgl1-tool__output');if(output){output.dataset.gwbRevision=String(Number(output.dataset.gwbRevision||0)+1);output.dataset.tone='stale';}});
    return {destroy(){disposed=true;controller.abort();communityClient?.destroy?.();pcmWorker?.terminate();videoController?.abort();audioContext?.close?.()?.catch?.(()=>{});restorers.forEach(restore=>restore());nodes.forEach(node=>{node.querySelectorAll('audio,video').forEach(audio=>audio.pause());node.remove();});leases.forEach(url=>URL.revokeObjectURL(url));leases.clear();}};
  }
  return Object.freeze({mount,markup});
});
