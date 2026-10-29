/* Reuse the pinned, project-local Tesseract runtime. Images never leave the device. */
(function(root){
  'use strict';let library=null;
  function load(){if(root.Tesseract?.createWorker)return Promise.resolve(root.Tesseract);if(library)return library;library=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('vendor/tesseract.min.js?v=6.0.1',document.baseURI).href;script.onload=()=>root.Tesseract?.createWorker?resolve(root.Tesseract):reject(Error('Bộ nhận chữ chưa sẵn sàng.'));script.onerror=()=>{script.remove();library=null;reject(Error('Chưa tải được bộ nhận chữ trên thiết bị. Hãy thử lại khi có mạng.'));};document.head.append(script);});return library;}
  function lines(data,width,height){return (data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>p.lines||[])).slice(0,60).map(row=>{const b=row.bbox||{},x=Math.max(0,b.x0||0)/width,y=Math.max(0,b.y0||0)/height,w=Math.max(0,(b.x1||0)-(b.x0||0))/width,h=Math.max(0,(b.y1||0)-(b.y0||0))/height;let box=null;try{box=root.HHMathCore.imageBox({x,y,w,h});}catch{}return {text:String(row.text||'').trim(),confidence:Number(row.confidence)||0,box};}).filter(row=>row.text);}
  function create(){let worker=null,closed=false,rejectCancel;const cancelled=new Promise((resolve,reject)=>{rejectCancel=reject;});cancelled.catch(()=>{});
    return {async recognize(image,onProgress=()=>{}){return Promise.race([cancelled,(async()=>{
      const T=await load();if(closed)throw new DOMException('Đã hủy nhận chữ.','AbortError');
      // Tesseract distinguishes a core file from a directory by the final '.js'.
      // A query string here is treated as a directory and produces an invalid URL.
      const created=await T.createWorker('eng',1,{workerPath:new URL('vendor/tesseract-worker.min.js?v=6.0.1',document.baseURI).href,corePath:new URL('vendor/tesseract-core-simd-lstm.wasm.js',document.baseURI).href,langPath:new URL('vendor/tessdata',document.baseURI).href,logger:m=>{if(!closed)onProgress(m);}});
      if(closed){await created.terminate();throw new DOMException('Đã hủy nhận chữ.','AbortError');}worker=created;
      await worker.setParameters({tessedit_pageseg_mode:'6',user_defined_dpi:'150'});
      const result=await worker.recognize(image,{}, {text:true,blocks:true});if(closed)throw new DOMException('Đã hủy nhận chữ.','AbortError');return result.data;
    })()]);},destroy(){if(closed)return;closed=true;rejectCancel(new DOMException('Đã hủy nhận chữ.','AbortError'));const previous=worker;worker=null;previous?.terminate()?.catch?.(()=>{});}};
  }
  root.HHMathCoreOCR=Object.freeze({create,lines});
})(window);
