(function(scope){
  'use strict';
  const MAX_BYTES=32*1024*1024,PART_CHARS=40000,MAX_PARTS=1024,SMALL_BYTES=200000;
  const byteLength=text=>typeof Buffer!=='undefined'?Buffer.byteLength(text,'utf8'):new TextEncoder().encode(text).length;
  async function digest(text){
    if(typeof module==='object'&&module.exports)return require('node:crypto').createHash('sha256').update(text).digest('hex');
    if(!scope.crypto?.subtle)throw Error('Trình duyệt chưa hỗ trợ xác minh lịch sử; bản trên thiết bị vẫn được giữ.');
    return Array.from(new Uint8Array(await scope.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),n=>n.toString(16).padStart(2,'0')).join('');
  }
  async function encode(state){
    const text=JSON.stringify(state),bytes=byteLength(text);if(bytes>MAX_BYTES)throw Object.assign(Error('Lịch sử vượt giới hạn đồng bộ 32 MB; hãy giữ backup trên thiết bị.'),{status:413,code:'PROGRESS_TRANSFER_TOO_LARGE'});
    const parts=[];for(let start=0;start<text.length;){let end=Math.min(text.length,start+PART_CHARS);if(end<text.length&&/[\uD800-\uDBFF]/.test(text[end-1]))end--;parts.push(text.slice(start,end));start=end;}
    if(parts.length>MAX_PARTS)throw Error('Quá nhiều phần lịch sử.');
    return{id:await digest(text),parts,bytes};
  }
  async function upload(send,payload,options={}){
    const encoded=await encode(payload.state),base={ownerId:payload.state.ownerId,learnerProfileId:payload.learnerProfileId,baseRevision:payload.baseRevision,transferId:encoded.id};
    const begun=await send({...base,action:'begin-transfer',parts:encoded.parts.length,bytes:encoded.bytes});
    if(begun.committed)return begun;
    const done=new Set(begun.uploaded || []);let completed=done.size;
    for(let offset=0;offset<encoded.parts.length;offset+=4){
      const batch=[];for(let i=offset;i<Math.min(offset+4,encoded.parts.length);i++)if(!done.has(i))batch.push((async()=>{const text=encoded.parts[i];await send({...base,action:'transfer-part',index:i,text,digest:await digest(text)});completed++;options.onProgress?.({completed,total:encoded.parts.length});})());
      const results=await Promise.allSettled(batch),failure=results.find(r=>r.status==='rejected');if(failure)throw failure.reason;
    }
    return send({...base,action:'commit-transfer'});
  }
  async function download(read,transfer){
    if(!transfer||!/^[a-f0-9]{64}$/.test(transfer.id)||!Number.isInteger(transfer.parts)||transfer.parts<1||transfer.parts>MAX_PARTS||!Number.isInteger(transfer.bytes)||transfer.bytes<1||transfer.bytes>MAX_BYTES)throw Error('Manifest lịch sử chưa hợp lệ; chưa thay dữ liệu trên thiết bị.');
    const texts=[];for(let offset=0;offset<transfer.parts;offset+=4){
      const results=await Promise.allSettled(Array.from({length:Math.min(4,transfer.parts-offset)},(_,j)=>read(transfer.id,offset+j)));
      for(let j=0;j<results.length;j++){const result=results[j];if(result.status==='rejected')throw result.reason;const part=result.value;if(part.index!==offset+j||typeof part.text!=='string'||byteLength(part.text)>180000||await digest(part.text)!==part.digest)throw Error('Một phần lịch sử sai checksum; bản trên thiết bị được giữ.');texts.push(part.text);}
    }
    const text=texts.join('');if(byteLength(text)!==transfer.bytes||await digest(text)!==transfer.id)throw Error('Lịch sử tải về không khớp checksum; chưa hợp nhất.');return JSON.parse(text);
  }
  const api=Object.freeze({MAX_BYTES,MAX_PARTS,SMALL_BYTES,byteLength,digest,encode,upload,download});scope.HHSchoolProgressCodec=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
