(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.HHEnglishAcademySync=api;})(globalThis,function(){
  "use strict";
  const key=s=>(s.signedIn?"account:":"guest:")+s.ownerId+":"+s.learnerProfileId;
  function content(state){
    const value=JSON.parse(JSON.stringify(state||{}));delete value.ownerId;delete value.activeView;
    if(value.galaxy)delete value.galaxy.lastSavedAt;
    if(value.learningOS){delete value.learningOS.sync;delete value.learningOS.localUpdatedAt;delete value.learningOS.transition;delete value.learningOS.localSave;}
    return JSON.stringify(value);
  }
  const hasWork=state=>Boolean(Object.keys(state.completed||{}).length||Object.keys(state.savedWords||{}).length||Object.keys(state.learningOS?.lessonCheckpoints||{}).length||Object.values(state.writingDrafts||{}).some(Boolean)||state.onboarding?.completed||state.writingHistory?.length||state.speakingAttempts?.length||state.learningOS?.reviewAttempts?.length||state.vocabularyStudio?.personalDictionary?.length||state.learningOS?.academy?.conversation&&Object.keys(state.learningOS.academy.conversation).length);
  function create(o){
    let alive=true,inFlight=null,controller=null;const pending=new Map(),previews=new Map(),requests=new Set();
    async function send(url,options){const request=new AbortController();requests.add(request);try{return await o.fetch(url,{...options,signal:request.signal});}finally{requests.delete(request);}}
    const same=s=>alive&&key(o.scope())===key(s);
    const emit=(state,s)=>{if(same(s))o.emit?.(state.learningOS.sync);};
    function status(s,fields){if(!same(s))return;const state=o.read();state.learningOS.sync={...state.learningOS.sync,...fields};o.persist(state,s);emit(state,s);}
    const headers=s=>({"X-HH-Learner-Owner":s.ownerId,...(o.authorization?.()?{Authorization:"Bearer "+o.authorization()}: {})});
    async function fetchRemote(s){
      if(!s.signedIn)throw Error("Đăng nhập để đọc bản máy chủ. Khách chỉ lưu trên thiết bị.");
      const response=await send("/api/store/english-learning?learnerProfileId="+encodeURIComponent(s.learnerProfileId),{credentials:"include",headers:headers(s),signal:controller?.signal});
      const data=await response.json().catch(()=>({}));if(!same(s))throw Error("Hồ sơ đã thay đổi.");if(response.status===404)return null;if(!response.ok)throw Error(data.error||"Không tải được bản máy chủ.");previews.set(key(s),data);return data;
    }
    function accept(s,remote){if(!same(s))return;const view=o.read().activeView,state=o.normalize(remote.state);state.activeView=view;state.learningOS.sync={...state.learningOS.sync,status:"synced",dirty:false,revision:remote.revision,lastSuccessAt:remote.updatedAt,lastError:"",serverRevision:null};o.persist(state,s);pending.delete(key(s));previews.delete(key(s));emit(state,s);o.changed?.();}
    async function hydrate(){
      const s=o.scope();if(!s.signedIn||!alive)return false;controller=new AbortController();
      try{const remote=await fetchRemote(s);if(!same(s))return false;if(!remote){status(s,{revision:0,status:"local",serverKnown:true});return false;}const local=o.read();if(remote.revision<(local.learningOS.sync.revision||0))return false;if(content(local)===content(remote.state)||!hasWork(local)||local.learningOS.sync.dirty!==true){accept(s,remote);return true;}
        status(s,{status:"conflict",serverRevision:remote.revision,lastError:"Máy chủ và thiết bị có bản khác nhau. Bản thiết bị được giữ; chọn cách xử lý trước khi gửi."});return false;
      }catch(e){if(same(s)&&e.name!=="AbortError")status(s,{status:"failed",lastError:e.message});return false;}
    }
    async function sync(){
      const s=o.scope();if(!alive||!s.signedIn||inFlight)return false;const local=o.read();
      if(local.learningOS.sync.status==="conflict"||local.learningOS.sync.dirty!==true)return false;
      let mutation=pending.get(key(s));const signature=content(local);
      if(!mutation||mutation.signature!==signature){mutation={signature,id:"english-"+(globalThis.crypto?.randomUUID?.()||Date.now()+"-"+Math.random().toString(36).slice(2)),revision:Number(local.learningOS.sync.revision)||0,state:JSON.parse(JSON.stringify(local))};pending.set(key(s),mutation);}
      controller=new AbortController();const request=controller;inFlight=key(s);status(s,{status:"syncing",lastAttemptAt:new Date().toISOString(),lastError:""});
      try{
        const response=await send("/api/store/english-learning?action=sync",{method:"PUT",credentials:"include",headers:{...headers(s),"Content-Type":"application/json"},body:JSON.stringify({learnerProfileId:s.learnerProfileId,revision:mutation.revision,clientMutationId:mutation.id,state:mutation.state}),signal:request.signal}),result=await response.json().catch(()=>({}));
        if(!same(s))return false;
        if(response.status===409){status(s,{status:"conflict",serverRevision:result.revision??null,lastError:result.error||"Có thay đổi đồng thời. Chưa gửi lại tự động."});return false;}
        if(!response.ok)throw Error(result.error||"HTTP "+response.status);
        pending.delete(key(s));const latest=o.read(),dirty=content(latest)!==mutation.signature;status(s,{status:dirty?"local":"synced",dirty,revision:result.revision,lastSuccessAt:result.updatedAt,lastError:"",serverRevision:null});return true;
      }catch(e){if(same(s)&&e.name!=="AbortError")status(s,{status:"failed",lastError:e.message});return false;}
      finally{inFlight=null;}
    }
    async function preview(){const s=o.scope();controller=new AbortController();const remote=await fetchRemote(s);if(!remote)throw Error("Chưa có bản máy chủ.");return {revision:remote.revision,updatedAt:remote.updatedAt,completed:Object.keys(remote.state.completed||{}).filter(id=>remote.state.completed[id]).length,words:Object.keys(remote.state.savedWords||{}).length};}
    async function resolve(mode,confirmed=false){
      const s=o.scope();if(confirmed!==true)throw Error("Cần xác nhận đã xuất bản cần giữ.");if(inFlight)throw Error("Chờ yêu cầu đang xử lý.");controller=new AbortController();const remote=await fetchRemote(s);if(!remote)throw Error("Bản máy chủ không còn tồn tại.");if(mode==="server"){accept(s,remote);return true;}if(mode!=="local")throw Error("Lựa chọn không hợp lệ.");status(s,{revision:remote.revision,status:"local",dirty:true,lastError:"",serverRevision:null});pending.delete(key(s));return sync();
    }
    async function deleteRemote(confirmation){const s=o.scope();if(!s.signedIn||confirmation!==s.learnerProfileId)throw Error("Nhập đúng ID hồ sơ để xóa bản máy chủ.");controller=new AbortController();const response=await send("/api/store/english-learning?learnerProfileId="+encodeURIComponent(s.learnerProfileId),{method:"DELETE",credentials:"include",headers:{...headers(s),"X-HH-Confirm-Delete":confirmation},signal:controller.signal}),data=await response.json().catch(()=>({}));if(!same(s))return false;if(!response.ok)throw Error(data.error||"Không xóa được bản máy chủ.");pending.delete(key(s));previews.delete(key(s));status(s,{status:"local",revision:0,dirty:false,serverKnown:false,lastError:""});return data.deleted;}
    return {sync,hydrate,preview,resolve,deleteRemote,dispose(){alive=false;controller?.abort();for(const r of requests)r.abort();requests.clear();pending.clear();previews.clear();},cancel(){controller?.abort();for(const r of requests)r.abort();},isBusy:()=>Boolean(inFlight)};
  }
  return Object.freeze({create,content,hasWork});
});
