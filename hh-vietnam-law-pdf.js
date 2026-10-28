(function (root) {
  'use strict';
  const C = root.HHVietnamLawCore;
  const base = 'vendor/pdfjs-law-6.4.299/';
  const MAX_BYTES = 64 * 1048576;
  let library;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ignored = error => ['RenderingCancelledException', 'AbortException', 'AbortError'].includes(error?.name);
  const pdfFiles = document => (document.attachments || []).filter(a => C.safeURL(a.url) && !/\.docx?(?:[?#]|$)/i.test(a.url));
  async function runtime() {
    library ||= import(new URL(base + 'build/pdf.min.mjs', root.document.baseURI).href).then(lib => {
      if (lib.version !== '6.4.299') throw Error('Phiên bản trình đọc PDF chưa khớp.');
      lib.GlobalWorkerOptions.workerSrc = new URL(base + 'build/pdf.worker.min.mjs', root.document.baseURI).href;
      return lib;
    }).catch(error => { library = null; throw error; });
    return library;
  }
  function create(host, options) {
    let document = options.document, files = pdfFiles(document), alive = true;
    let fileId = String(options.initial?.fileId || ''), pageNumber = Number(options.initial?.page) || 1;
    let zoom = options.initial?.zoom === 'fit' || !options.initial?.zoom ? 'fit' : Number(options.initial.zoom);
    let rotation = Number(options.initial?.rotation) || 0;
    let task = null, pdf = null, renderTask = null, layer = null, page = null, lib = null, fileController = null, documentBytes = 0, ranged = false;
    let loadSequence = 0, renderSequence = 0, searchSequence = 0, resizeTimer = 0, lastWidth = 0;
    let currentSearch = '', lastFound = 0, searching = false, passwordCallback = null, progress = 0, failed = false, pageDraft = null, controlsBusy = false;
    const lifecycle = new AbortController();
    const asset = path => new URL(base + path, root.document.baseURI).href;
    const by = selector => host.querySelector(selector);
    const file = () => files.find(a => String(a.id) === fileId) || files[0];
    const state = () => ({ fileId, page: pageNumber, zoom, rotation });
    function status(message, error = false) {
      if (!alive) return;
      const el = by('[data-pdf-status]');
      el.textContent = message;
      el.setAttribute('role', error ? 'alert' : 'status');
    }
    function controls(busy = false) {
      if (!alive) return;controlsBusy=busy;
      for (const button of host.querySelectorAll('[data-pdf-action]')) {
        const action = button.dataset.pdfAction;
        button.disabled = ['retry','tools'].includes(action) ? false : !pdf || busy;
        if (action === 'previous') button.disabled ||= pageNumber <= 1;
        if (action === 'next') button.disabled ||= pageNumber >= (pdf?.numPages || 1);
      }
      by('[name=pdfPage]').disabled = !pdf;
      by('[name=pdfPage]').max = pdf?.numPages || 1;
      if (pageDraft === null) by('[name=pdfPage]').value = pageNumber;
      by('[data-pdf-count]').textContent = pdf ? '/ ' + pdf.numPages : '/ …';
      by('[data-pdf-position]').textContent = pdf ? 'Trang ' + pageNumber + ' / ' + pdf.numPages + ' · Tệp ' + (files.indexOf(file()) + 1) + ' / ' + files.length : 'Đang mở PDF gốc';
      by('[data-pdf-zoom-label]').textContent = zoom === 'fit' ? 'Vừa chiều ngang' : Math.round(zoom * 100) + '%';
      by('[name=pdfFile]').value = fileId;
      by('[data-pdf-action=retry]').hidden = !failed;
      by('[data-pdf-action=cancel-search]').hidden = !searching;
      by('[data-pdf-action=fullscreen]').hidden = !root.document.fullscreenEnabled;
    }
    function markup() {
      host.className = 'hhl-pdf';
      host.innerHTML = '<header class="hhl-pdf-heading"><div><small>BẢN CÔNG BỐ GỐC</small><h2>Đọc PDF ngay tại đây</h2></div><span data-pdf-position></span></header>' +
        '<label class="hhl-pdf-files">Tệp văn bản<select name="pdfFile" aria-label="Chọn tệp PDF">' + files.map((a, i) => '<option value="' + escape(a.id) + '">' + (i + 1) + '. ' + escape(a.title || 'PDF nguồn') + '</option>').join('') + '</select></label>' +
        '<div class="hhl-pdf-toolbar" role="group" aria-label="Điều khiển PDF">' +
        '<button type="button" data-pdf-action="previous" aria-label="Trang PDF trước">←</button><form data-pdf-page><label>Trang<input name="pdfPage" type="number" min="1" value="1" inputmode="numeric" aria-label="Số trang PDF"></label><span data-pdf-count>/ …</span><button type="submit">Đi</button></form>' +
        '<button type="button" data-pdf-action="next" aria-label="Trang PDF tiếp">→</button><button type="button" data-pdf-action="fullscreen">Toàn màn hình</button><button type="button" class="hhl-pdf-tools-toggle" data-pdf-action="tools" aria-expanded="false">Công cụ PDF</button><div class="hhl-pdf-more"><div class="hhl-pdf-divider"></div>' +
        '<button type="button" data-pdf-action="zoom-out" aria-label="Thu nhỏ PDF">−</button><button type="button" data-pdf-action="fit" data-pdf-zoom-label>Vừa chiều ngang</button><button type="button" data-pdf-action="zoom-in" aria-label="Phóng to PDF">+</button>' +
        '<button type="button" data-pdf-action="rotate">Xoay 90°</button><button type="button" data-pdf-action="download">Tải PDF</button><button type="button" data-pdf-action="share">Chép liên kết trang</button></div></div>' +
        '<details class="hhl-pdf-search-details"><summary>Tìm chữ trong PDF</summary><form class="hhl-pdf-search" data-pdf-search><label>Tìm chữ trong tệp PDF<input name="pdfQuery" maxlength="160" placeholder="Từ khóa, tên hoặc số điều…"></label><button type="submit">Tìm tiếp</button><button type="button" data-pdf-action="cancel-search" hidden>Dừng tìm</button></form></details>' +
        '<p class="hhl-pdf-status" data-pdf-status role="status" aria-live="polite">Đang mở tệp nguồn…</p><button type="button" data-pdf-action="retry" hidden>Thử tải PDF lại</button>' +
        '<form class="hhl-pdf-password" data-pdf-password hidden><label>Mật khẩu tệp PDF<input type="password" name="pdfPassword" autocomplete="off" required></label><button type="submit">Mở tệp</button></form>' +
        '<div class="hhl-pdf-stage" tabindex="0" aria-label="Trang PDF. Dùng Page Down hoặc Page Up để chuyển trang."><div class="hhl-pdf-paper"><canvas aria-label="Trang PDF gốc" role="img"></canvas><div class="textLayer" aria-hidden="true"></div></div></div>' +
        '<details class="hhl-pdf-accessible"><summary>Đọc phần chữ ở trang này</summary><p data-pdf-plain></p><small>Chữ được trích tự động; bản scan có thể không có chữ để tìm hoặc sao chép.</small></details>' +
        '<p class="hhl-muted">Bạn đang xem bản PDF từ cơ quan nguồn. Tệp gốc chưa tự hợp nhất các sửa đổi sau đó. Trang đọc và lựa chọn hiển thị được lưu trên thiết bị theo tài khoản.</p>';
      controls(true);
    }
    async function cancelRender() {
      const prior = renderTask;
      renderTask = null;
      prior?.cancel();
      layer?.cancel();
      layer = null;
      if (prior) await prior.promise.catch(() => {});
    }
    async function render() {
      if (!alive || !pdf) return;
      const ticket = ++renderSequence, loading = loadSequence;
      await cancelRender();
      if (!alive || ticket !== renderSequence || loading !== loadSequence) return;
      controls(true);
      status('Đang vẽ trang ' + pageNumber + '…');
      try {
        const next = await pdf.getPage(pageNumber);
        if (!alive || ticket !== renderSequence || loading !== loadSequence) return;
        if (page && page !== next) page.cleanup();
        page = next;
        const pageRotation = (page.rotate + rotation) % 360;
        const stage = by('.hhl-pdf-stage'), unscaled = page.getViewport({scale:1, rotation:pageRotation});
        const available = Math.max(180, stage.clientWidth - 32);
        const scale = zoom === 'fit' ? available / unscaled.width : Math.max(.25, Math.min(3, zoom));
        const viewport = page.getViewport({scale, rotation:pageRotation}), paper = by('.hhl-pdf-paper'), canvas = by('canvas');
        const ratio = Math.max(.25, Math.min(root.devicePixelRatio || 1, 2.5, Math.sqrt(12000000 / (viewport.width * viewport.height))));
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = paper.style.width = viewport.width + 'px';
        canvas.style.height = paper.style.height = viewport.height + 'px';
        canvas.setAttribute('aria-label', 'Trang ' + pageNumber + ' — ' + document.code + ' — PDF gốc');
        paper.style.setProperty('--total-scale-factor', String(viewport.scale * viewport.userUnit));
        paper.style.setProperty('--scale-round-x', '1px');
        paper.style.setProperty('--scale-round-y', '1px');
        const textHost = by('.textLayer');textHost.replaceChildren();
        renderTask = page.render({canvasContext:canvas.getContext('2d'),viewport,transform:[ratio,0,0,ratio,0,0],annotationMode:lib.AnnotationMode.DISABLE});
        await renderTask.promise;
        if (!alive || ticket !== renderSequence || loading !== loadSequence) return;
        const content = await page.getTextContent({includeMarkedContent:true});
        if (!alive || ticket !== renderSequence || loading !== loadSequence) return;
        by('[data-pdf-plain]').textContent = content.items.filter(i => typeof i.str === 'string').map(i => i.str + (i.hasEOL ? '\n' : '')).join('').normalize('NFC');
        layer = new lib.TextLayer({textContentSource:content,container:textHost,viewport});
        await layer.render();
        if (!alive || ticket !== renderSequence || loading !== loadSequence) return;
        if (currentSearch) for (const span of textHost.querySelectorAll('span')) if (C.fold(span.textContent).includes(C.fold(currentSearch))) span.classList.add('hhl-pdf-match');
        failed = false;controls();status('Trang ' + pageNumber + ' đã sẵn sàng. '+(by('[data-pdf-plain]').textContent.trim()?'Có thể chọn và sao chép chữ trực tiếp.':'Trang này chưa có lớp chữ để tìm hoặc sao chép; có thể là bản scan.'));
        options.onChange?.(state());
      } catch (error) {
        if (alive && ticket === renderSequence && !ignored(error)) { failed = true;status('Chưa vẽ được trang PDF: ' + error.message, true);controls(); }
      }
    }
    async function open(selectedId, targetPage = 1) {
      const chosen = files.find(a => String(a.id) === String(selectedId)) || files[0];
      if (!chosen) {status('Nguồn chưa có tệp PDF để hiển thị.', true);return;}
      const ticket = ++loadSequence;
      fileController?.abort();fileController=new AbortController();documentBytes=0;ranged=false;
      ++searchSequence;++renderSequence;searching = false;pdf = null;failed = false;passwordCallback = null;
      by('[data-pdf-password]').hidden = true;
      await cancelRender();
      const prior = task;task = null;
      if (prior) await prior.destroy().catch(() => {});
      if (!alive || ticket !== loadSequence) return;
      fileId = String(chosen.id);pageNumber = Math.max(1, Math.floor(Number(targetPage) || 1));pageDraft = null;
      by('canvas').width = by('canvas').height = 1;by('.textLayer').replaceChildren();
      by('[data-pdf-plain]').textContent = '';controls(true);status('Đang tải tệp PDF từ nguồn chính thức…');
      try {
        lib = await runtime();
        if (!alive || ticket !== loadSequence) return;
        const url = C.safeURL(chosen.url);
        if (!url) throw Error('Địa chỉ PDF không thuộc nguồn được phép.');
        // Direct CORS transport keeps large publications out of serverless payloads.
        let pending;
        const source=await root.HHVietnamLawPDFTransport.prepare({PDFDataRangeTransport:lib.PDFDataRangeTransport,url,signal:fileController.signal,onError:error=>{if(!alive||ticket!==loadSequence)return;failed=true;status(error.message,true);controls();void pending?.destroy().catch(()=>{});}});
        if(!alive||ticket!==loadSequence){source?.range.abort();return;}
        ranged=Boolean(source);documentBytes=source?.length||0;
        pending = lib.getDocument({...(source?{range:source.range,length:source.length}:{url}),withCredentials:false,isEvalSupported:false,enableXfa:false,
          disableWorkerRendering:true,disableAutoFetch:true,disableStream:true,rangeChunkSize:262144,
          maxImageSize:25000000,canvasMaxAreaInBytes:48000000,
          cMapUrl:asset('cmaps/'),cMapPacked:true,standardFontDataUrl:asset('standard_fonts/'),wasmUrl:asset('wasm/'),iccUrl:asset('iccs/')});
        task = pending;progress = 0;
        pending.onPassword = (callback, reason) => {
          if (!alive || ticket !== loadSequence) return;
          passwordCallback = callback;by('[data-pdf-password]').hidden = false;
          status(reason === lib.PasswordResponses.INCORRECT_PASSWORD ? 'Mật khẩu tệp chưa đúng.' : 'Tệp nguồn được bảo vệ bằng mật khẩu.');
          by('[name=pdfPassword]').focus();
        };
        pending.onProgress = value => {
          if (!alive || ticket !== loadSequence) return;
          documentBytes=Math.max(documentBytes,value.total||0);
          const limit=ranged?root.HHVietnamLawPDFTransport.MAX_DOCUMENT:MAX_BYTES;
          if (value.total > limit || value.loaded > limit) {failed = true;void pending.destroy().catch(()=>{});status('Tệp vượt giới hạn tải an toàn trên trình duyệt; hãy đối chiếu tại nguồn.', true);controls();return;}
          const percent = value.total ? Math.floor(value.loaded / value.total * 10) * 10 : 0;
          if (percent > progress) {progress = percent;status('Đang tải PDF… ' + Math.min(100, percent) + '%');}
        };
        pdf = await pending.promise;
        if (!alive || ticket !== loadSequence) return;
        pageNumber = Math.min(pageNumber, pdf.numPages);
        await render();
      } catch (error) {
        if (alive && ticket === loadSequence && !ignored(error)) {if(!failed)status('Chưa mở được PDF tại nguồn. Kiểm tra kết nối rồi thử lại. ' + error.message, true);failed = true;controls();}
      }
    }
    function go(number) {if (!pdf) return;pageDraft=null;pageNumber = Math.max(1,Math.min(pdf.numPages,Math.floor(Number(number)||1)));void render();}
    async function find(query) {
      if (!pdf) return;
      const term = C.fold(query);
      const repeated = C.fold(currentSearch) === term && lastFound === pageNumber;
      if (term.length < 2) {status('Nhập ít nhất hai ký tự để tìm trong PDF.');return;}
      currentSearch = query;searching = true;controls();
      for (const span of host.querySelectorAll('.hhl-pdf-match')) span.classList.remove('hhl-pdf-match');
      const ticket = ++searchSequence, loading = loadSequence, documentPDF = pdf, start = repeated ? pageNumber % pdf.numPages + 1 : pageNumber;
      const limit = Math.min(documentPDF.numPages, 2000);
      try {
        for (let offset = 0; offset < limit; offset++) {
          if (!alive || ticket !== searchSequence || loading !== loadSequence) return;
          const n = (start - 1 + offset) % documentPDF.numPages + 1;
          status('Đang tìm chữ ở trang ' + n + ' / ' + documentPDF.numPages + '…');
          const candidate = await documentPDF.getPage(n),content = await candidate.getTextContent();
          const text = content.items.filter(i=>typeof i.str==='string').map(i=>i.str+(i.hasEOL?' ':'')).join('').normalize('NFC');
          if (!alive || ticket !== searchSequence || loading !== loadSequence) return;
          if (C.fold(text).includes(term)) {searching=false;lastFound=n;pageNumber=n;await render();if(alive&&ticket===searchSequence)status('Tìm thấy “'+query+'” ở trang '+n+'.');return;}
          if (candidate !== page) candidate.cleanup();
        }
        if(alive&&ticket===searchSequence)status(limit<documentPDF.numPages?'Đã tìm 2.000 trang; chưa kiểm tra hết tệp.':'Không tìm thấy chữ trong tệp này. PDF scan có thể không chứa lớp chữ.');
      } catch(error){if(alive&&ticket===searchSequence&&!ignored(error))status('Chưa tìm được trong PDF: '+error.message,true);}
      finally{if(alive&&ticket===searchSequence){searching=false;controls();}}
    }
    async function click(event) {
      const button = event.target.closest('[data-pdf-action]');if(!button||!host.contains(button))return;
      event.preventDefault();event.stopPropagation();
      try {
        const action=button.dataset.pdfAction;
        if(action==='tools'){const open=!host.hasAttribute('data-tools-open');host.toggleAttribute('data-tools-open',open);button.setAttribute('aria-expanded',String(open));}
        else if(action==='previous')go(pageNumber-1);else if(action==='next')go(pageNumber+1);
        else if(action==='retry')void open(fileId,pageNumber);
        else if(action==='fit'){zoom='fit';void render();}
        else if(action==='zoom-in'||action==='zoom-out'){const fitScale=page?Math.max(180,by('.hhl-pdf-stage').clientWidth-32)/page.getViewport({scale:1,rotation:(page.rotate+rotation)%360}).width:1;zoom=Math.max(.25,Math.min(3,(zoom==='fit'?fitScale:zoom)+(action==='zoom-in'?.25:-.25)));void render();}
        else if(action==='rotate'){rotation=(rotation+90)%360;void render();}
        else if(action==='cancel-search'){++searchSequence;searching=false;controls();status('Đã dừng tìm chữ.');}
        else if(action==='share')await options.onShare?.(state());
        else if(action==='fullscreen'){if(root.document.fullscreenElement===host)await root.document.exitFullscreen();else await host.requestFullscreen();}
        else if(action==='download'){
          if(documentBytes>MAX_BYTES)throw Error('Tệp lớn hơn 64 MiB. Bạn vẫn đọc được từng trang tại đây; mở phần Thông tin văn bản để tải tệp trực tiếp từ nguồn.');
          const ticket=loadSequence;status('Đang chuẩn bị PDF để tải về…');const bytes=await pdf.getData();if(!alive||ticket!==loadSequence)return;
          if(bytes.byteLength>MAX_BYTES)throw Error('Tệp vượt giới hạn tải 64 MiB.');
          const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),a=root.document.createElement('a');
          a.href=url;a.download=(document.code||'van-ban').replace(/[^\p{L}\p{N}._-]+/gu,'-')+'-'+(files.indexOf(file())+1)+'.pdf';root.document.body.append(a);a.click();a.remove();
          root.setTimeout(()=>URL.revokeObjectURL(url),1000);status('Đã chuẩn bị tệp PDF.');
        }
      }catch(error){if(alive&&!ignored(error))status(error.message,true);}
    }
    function submit(event){
      if(event.target.matches('[data-pdf-page]')){event.preventDefault();go(by('[name=pdfPage]').value);}
      else if(event.target.matches('[data-pdf-search]')){event.preventDefault();void find(by('[name=pdfQuery]').value.trim());}
      else if(event.target.matches('[data-pdf-password]')){event.preventDefault();const password=by('[name=pdfPassword]').value;by('[name=pdfPassword]').value='';by('[data-pdf-password]').hidden=true;passwordCallback?.(password);}
    }
    function fullscreenChange(){if(!alive)return;const button=by('[data-pdf-action=fullscreen]'),full=root.document.fullscreenElement===host;button.textContent=full?'Thoát toàn màn hình':'Toàn màn hình';button.setAttribute('aria-pressed',String(full));}
    function change(event){if(event.target.name==='pdfFile')void open(event.target.value,1);}
    function input(event){if(event.target.name==='pdfPage')pageDraft=event.target.value;}
    function keydown(event){if(!pdf||event.ctrlKey||event.altKey||event.metaKey||event.target.closest('input,textarea,select'))return;const delta=['PageDown','ArrowRight'].includes(event.key)?1:['PageUp','ArrowLeft'].includes(event.key)?-1:0;if(delta||event.key==='Home'||event.key==='End'){event.preventDefault();event.stopPropagation();go(delta?pageNumber+delta:event.key==='Home'?1:pdf.numPages);}}
    const observer=new ResizeObserver(entries=>{const width=entries[0]?.contentRect.width||0;if(Math.abs(width-lastWidth)<2)return;lastWidth=width;root.clearTimeout(resizeTimer);resizeTimer=root.setTimeout(()=>{if(alive&&pdf&&zoom==='fit')void render();},140);});
    markup();observer.observe(host);root.document.addEventListener('fullscreenchange',fullscreenChange);host.addEventListener('click',click);host.addEventListener('submit',submit);host.addEventListener('change',change);host.addEventListener('input',input);host.addEventListener('keydown',keydown);
    if(files.length)void open(fileId,pageNumber);else status('Nguồn chưa có PDF đọc được. Hãy kiểm tra tab thông tin văn bản.',true);
    return Object.freeze({getState:state,open:(id,page)=>open(id,page),updateDocument(value){const next=pdfFiles(value),before=file()?.url,changed=JSON.stringify(next)!==JSON.stringify(files);document=value;files=next;const chosen=file();if(changed){by('[name=pdfFile]').innerHTML=files.map((a,i)=>'<option value="'+escape(a.id)+'">'+(i+1)+'. '+escape(a.title||'PDF nguồn')+'</option>').join('');controls(controlsBusy);}if(chosen&&chosen.url!==before)void open(chosen.id,1);},destroy(){alive=false;++loadSequence;++renderSequence;++searchSequence;lifecycle.abort();fileController?.abort();root.document.removeEventListener('fullscreenchange',fullscreenChange);observer.disconnect();root.clearTimeout(resizeTimer);renderTask?.cancel();layer?.cancel();void task?.destroy().catch(()=>{});host.removeEventListener('click',click);host.removeEventListener('submit',submit);host.removeEventListener('change',change);host.removeEventListener('input',input);host.removeEventListener('keydown',keydown);host.replaceChildren();}});
  }
  root.HHVietnamLawPDF=Object.freeze({create,pdfFiles});
})(typeof window!=='undefined'?window:globalThis);
