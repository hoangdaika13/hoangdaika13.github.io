(function(scope){
  'use strict';
  const node=typeof module==='object'&&module.exports,manifest=node?require('./hh-school-university-manifest'):scope.HHSchoolUniversityManifest,U=node?require('./hh-school-university-core'):scope.HHSchoolUniversityCore;
  const cache=new Map(),pending=new Map();
  const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
  async function load(entry,options={}){
    if(options.signal?.aborted)throw Object.assign(Error('Đã dừng tải học phần.'),{name:'AbortError'});if(cache.has(entry.url))return cache.get(entry.url);if(!options.signal&&pending.has(entry.url))return pending.get(entry.url);
    const work=(async()=>{let bytes,text,hash;
      if(node){const fs=require('node:fs'),path=require('node:path');bytes=fs.readFileSync(path.resolve(__dirname,entry.url.split('?')[0]));text=bytes.toString('utf8');hash=require('node:crypto').createHash('sha256').update(bytes).digest('hex');}
      else{const response=await scope.fetch(new URL(entry.url,scope.document.baseURI),{credentials:'same-origin',signal:options.signal});if(!response.ok)throw Error('Không tải được học phần (HTTP '+response.status+'). Hãy thử lại khi có mạng.');bytes=new Uint8Array(await response.arrayBuffer());if(!scope.crypto?.subtle)throw Error('Trình duyệt chưa hỗ trợ xác minh học liệu; dữ liệu đã lưu vẫn được giữ.');hash=Array.from(new Uint8Array(await scope.crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
      if(bytes.length!==entry.bytes||hash!==entry.sha256)throw Error('Học liệu không khớp checksum; chưa dùng bản tải về.');const value=JSON.parse(text);if(!U.safeJSON(value))throw Error('Học liệu chứa cấu trúc không an toàn.');
      if(entry.id){const checked=U.validatePack(value,entry);if(!checked.ok)throw Error(checked.errors.join(' '));}else if(value.schemaVersion!==1||value.version!==manifest.version||!Array.isArray(value.courses)||!Array.isArray(value.resources))throw Error('Danh mục đại học chưa đúng phiên bản.');
      const result=freeze(value);cache.set(entry.url,result);return result;
    })();if(!options.signal)pending.set(entry.url,work);try{return await work;}finally{if(!options.signal)pending.delete(entry.url);}
  }
  const loadCatalogue=options=>load(manifest.catalogue,options),loadCourse=(id,options)=>{const entry=manifest.courses.find(c=>c.id===id);if(!entry)return Promise.reject(Error('Chưa có gói nội dung cho học phần này.'));return load(entry,options);};
  const api=Object.freeze({manifest,loadCatalogue,loadCourse,peekCatalogue:()=>cache.get(manifest.catalogue.url)||null,peekCourse:id=>cache.get(manifest.courses.find(c=>c.id===id)?.url)||null});scope.HHSchoolUniversityContent=api;if(node)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
