(function (scope) {
  'use strict';
  const C = typeof module === 'object' && module.exports ? require('./hh-vietnam-law-core') : scope.HHVietnamLawCore;
  const MAX_DOCUMENT = 128 * 1048576, CHUNK = 262144;
  async function prepare({PDFDataRangeTransport,url,fetchImpl=scope.fetch.bind(scope),signal,onError=()=>{}}) {
    url = C.safeURL(url);
    if (!url) throw Error('Địa chỉ PDF không thuộc nguồn được phép.');
    const controller = new AbortController();
    if (signal?.aborted) throw new DOMException('Đã dừng tải PDF.', 'AbortError');
    const abort = () => controller.abort();
    signal?.addEventListener('abort',abort,{once:true});
    const init = () => ({credentials:'omit',redirect:'error',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
    let head;
    try {head = await fetchImpl(url,{...init(),method:'HEAD'});} catch(error) {signal?.removeEventListener('abort',abort);if(signal?.aborted)throw error;return null;}
    if ([403,404,410,429].includes(head.status)) {signal?.removeEventListener('abort',abort);throw Error('Nguồn PDF trả HTTP '+head.status+'.');}
    const length = Number(head.headers.get('content-length'));
    if (!head.ok || !Number.isSafeInteger(length) || length < 8 * 1048576) {signal?.removeEventListener('abort',abort);return null;}
    if (length > MAX_DOCUMENT) {signal?.removeEventListener('abort',abort);throw Error('Tệp vượt giới hạn đọc 128 MiB trên trình duyệt.');}
    async function bytes(begin,end) {
      if (!Number.isSafeInteger(begin)||!Number.isSafeInteger(end)||begin<0||end<=begin||end>length||end-begin>16*1048576)throw Error('Khoảng dữ liệu PDF chưa hợp lệ.');
      const response = await fetchImpl(url,{...init(),headers:{Range:'bytes='+begin+'-'+(end-1)}});
      const expected = end-begin,range = response.headers.get('content-range');
      // Content-Range is not exposed by every official CDN. Its status, bounded
      // length and any visible range/validator must still match the request.
      const etag=head.headers.get('etag'),nextETag=response.headers.get('etag');
      const mismatch=range&&range!=='bytes '+begin+'-'+(end-1)+'/'+length;
      if(response.status!==206||mismatch||etag&&nextETag&&etag!==nextETag||Number(response.headers.get('content-length'))!==expected){await response.body?.cancel().catch(()=>{});throw Error('Nguồn chưa trả đúng phần PDF cần đọc; chưa ghép dữ liệu này.');}
      const reader=response.body.getReader(),parts=[];let size=0;
      try{for(;;){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>expected){await reader.cancel();throw Error('Phần PDF vượt kích thước đã yêu cầu.');}parts.push(item.value);}}finally{reader.releaseLock();}
      if(size!==expected)throw Error('Phần PDF chưa tải đủ; hãy thử lại.');
      const value=new Uint8Array(size);let offset=0;for(const part of parts){value.set(part,offset);offset+=part.byteLength;}return value;
    }
    let initial;
    try {initial=await bytes(0,Math.min(CHUNK,length));if(String.fromCharCode(...initial.subarray(0,5))!=='%PDF-')throw Error('Tệp nguồn chưa có chữ ký định dạng PDF.');}catch(error){controller.abort();signal?.removeEventListener('abort',abort);throw error;}
    let active=0,closed=false,loaded=initial.length;
    const queue=[];
    class Transport extends PDFDataRangeTransport {
      constructor(){super(length,initial,false);}
      requestDataRange(begin,end){return new Promise(resolve=>{queue.push({begin,end,resolve});void pump();});}
      abort(){closed=true;controller.abort();signal?.removeEventListener('abort',abort);for(const item of queue.splice(0))item.resolve();}
    }
    const transport=new Transport();
    async function pump(){
      while(!closed&&active<3&&queue.length){const item=queue.shift();active++;
        void bytes(item.begin,item.end).then(value=>{if(closed)return;loaded+=value.byteLength;transport.onDataRange(item.begin,value);transport.onDataProgress?.(Math.min(length,loaded),length);}).catch(error=>{if(closed)return;transport.abort();onError(error);}).finally(()=>{active--;item.resolve();void pump();});
      }
    }
    return{range:transport,length};
  }
  const api=Object.freeze({prepare,MAX_DOCUMENT,CHUNK});scope.HHVietnamLawPDFTransport=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
