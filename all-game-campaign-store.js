(function(scope,factory){'use strict';const api=factory(scope);scope.HHAllGameCampaignStore=api;if(typeof module==='object'&&module.exports)module.exports=api;})(typeof globalThis!=='undefined'?globalThis:this,function(scope){
  'use strict';
  const VERSION=1,DB='hh.all-game.campaigns.v1',MAX_PROGRESS=24000,MAX_SNAPSHOT=160000,MAX_CHECKPOINTS=32;
  const key=(owner,id)=>JSON.stringify([String(owner).slice(0,300),id]);
  function validJSON(value){const queue=[[value,0]];let count=0;while(queue.length){const [v,depth]=queue.pop();if(++count>30000||depth>24)return false;if(typeof v==='number'&&!Number.isFinite(v)||typeof v==='string'&&v.length>4000||['function','symbol','bigint','undefined'].includes(typeof v))return false;if(v&&typeof v==='object'){const prototype=Object.getPrototypeOf(v);if(!Array.isArray(v)&&prototype!==Object.prototype&&prototype!==null)return false;const values=Object.values(v);if(values.length>2500)return false;for(const child of values)queue.push([child,depth+1]);}}return true;}
  function create(indexedDB=scope.indexedDB){
    let opened=null,db=null;
    const error=(message,code='storage')=>({ok:false,code,error:message||'Chưa lưu được campaign trên thiết bị. Ván hiện tại vẫn giữ tạm trong lần mở này.'});
    function open(){if(!indexedDB?.open)return Promise.reject(Error('Trình duyệt chưa hỗ trợ lưu campaign bằng IndexedDB.'));if(opened)return opened;opened=new Promise((resolve,reject)=>{const request=indexedDB.open(DB,VERSION);request.onupgradeneeded=()=>{const database=request.result;for(const name of ['progress','checkpoints']){const store=database.objectStoreNames.contains(name)?request.transaction.objectStore(name):database.createObjectStore(name,{keyPath:'key'});if(!store.indexNames.contains('owner'))store.createIndex('owner','owner');}};request.onerror=()=>{opened=null;reject(request.error||Error('Không mở được kho campaign.'));};request.onblocked=()=>{opened=null;reject(Error('Kho campaign đang chờ một tab khác cập nhật.'));};request.onsuccess=()=>{db=request.result;db.onversionchange=()=>{db.close();db=null;opened=null;};resolve(db);};});return opened;}
    async function transaction(storeName,mode,work){const database=await open();return new Promise((resolve,reject)=>{const tx=database.transaction(storeName,mode),store=tx.objectStore(storeName);let value;const fail=e=>{try{tx.abort();}catch{}reject(e);};try{work(store,result=>{value=result;},fail);}catch(e){fail(e);return;}tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error||Error('Không lưu được campaign.'));tx.onabort=()=>reject(tx.error||Error('Đã hủy thao tác lưu.'));});}
    async function read(owner,id,kind='progress'){try{const value=await transaction(kind,'readonly',(store,done)=>{const request=store.get(key(owner,id));request.onsuccess=()=>done(request.result||null);});if(value&&value.version!==VERSION)return error('Save campaign thuộc phiên bản chưa hỗ trợ; dữ liệu gốc được giữ lại.','version');if(value&&(!validJSON(value)||value.id!==id||value.owner!==String(owner).slice(0,300)||(kind==='progress'?value.progress?.version!==VERSION||value.progress?.gameId!==id:!value.state||value.state.id!==id||value.state.status!=='playing')))return error('Save campaign không hợp lệ; dữ liệu gốc được giữ để phục hồi.','corrupt');return{ok:true,value};}catch(e){return error(e.message);}}
    async function saveProgress(owner,id,progress){try{if(!validJSON(progress)||JSON.stringify(progress).length>MAX_PROGRESS)throw Error('Tiến trình campaign quá lớn hoặc không hợp lệ; chưa ghi đè dữ liệu cũ.');const value={version:VERSION,key:key(owner,id),owner:String(owner).slice(0,300),id,progress,updatedAt:Date.now()};const written=await transaction('progress','readwrite',(store,done,fail)=>{const check=store.get(value.key);check.onsuccess=()=>{try{const prior=check.result;if(prior&&(prior.version!==VERSION||prior.progress?.contentVersion>progress.contentVersion)){done(false);return;}const request=store.put(value);request.onsuccess=()=>done(true);}catch(e){fail(e);}};});if(!written)throw Error('Save mới hơn được giữ lại; phiên hiện tại chưa ghi đè.');return{ok:true};}catch(e){return error(e.message);}}
    async function saveCheckpoint(owner,id,missionId,contentVersion,state){
      try{
        if(state!==null&&(!state||state.id!==id||state.status!=='playing'||!validJSON(state)||JSON.stringify(state).length>MAX_SNAPSHOT))throw Error('Điểm tiếp tục campaign không hợp lệ; dữ liệu trước được giữ lại.');
        const normalizedOwner=String(owner).slice(0,300),rowKey=key(owner,id);
        const written=await transaction('checkpoints','readwrite',(store,done,fail)=>{
          const prior=store.get(rowKey);prior.onsuccess=()=>{try{
            if(prior.result&&(prior.result.version!==VERSION||prior.result.contentVersion>contentVersion)){done(false);return;}
            if(state===null){store.delete(rowKey);done(true);return;}
            const request=store.index('owner').getAll(normalizedOwner);request.onsuccess=()=>{try{
              const rows=request.result.filter(row=>row.version===VERSION&&row.contentVersion<=contentVersion),now=Date.now(),updatedAt=Math.max(now,...rows.map(row=>Number.isFinite(row.updatedAt)?row.updatedAt+1:now));
              store.put({version:VERSION,key:rowKey,owner:normalizedOwner,id,missionId,contentVersion,state,updatedAt});
              const previous=rows.filter(row=>row.key!==rowKey).sort((a,b)=>b.updatedAt-a.updatedAt);for(const row of previous.slice(MAX_CHECKPOINTS-1))store.delete(row.key);done(true);
            }catch(e){fail(e);}};
          }catch(e){fail(e);}};
        });
        if(!written)throw Error('Điểm tiếp tục thuộc nội dung mới hơn được bảo toàn; phiên này chưa ghi đè.');return{ok:true};
      }catch(e){return error(e.message);}
    }
    async function list(owner,kind='progress'){try{const value=await transaction(kind,'readonly',(store,done)=>{const request=store.index('owner').getAll(String(owner).slice(0,300));request.onsuccess=()=>done(request.result.filter(row=>row.version===VERSION&&validJSON(row)));});return{ok:true,value};}catch(e){return error(e.message);}}
    function close(){db?.close();db=null;opened=null;}
    return Object.freeze({read,saveProgress,saveCheckpoint,list,close});
  }
  return Object.freeze({VERSION,DB,MAX_PROGRESS,MAX_SNAPSHOT,MAX_CHECKPOINTS,key,validJSON,create});
});
