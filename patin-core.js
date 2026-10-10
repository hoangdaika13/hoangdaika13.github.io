(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./patin-data.js'):root.HHPatinData);if(typeof module==='object'&&module.exports)module.exports=api;else root.HHPatinCore=api;})(globalThis,function(data){
  'use strict';
  const VERSION=1,MAX_BYTES=600000,MAX_ENTRIES=500;
  const ids=new Set(data.skills.map(s=>s.id)),statuses=new Set(['read','tried']);
  const copy=value=>JSON.parse(JSON.stringify(value));
  const bytes=value=>new TextEncoder().encode(value).byteLength;
  const libraryDefaults=()=>({query:'',category:'all',discipline:'all',level:'all',favorites:false,mode:'grid',status:'all',sort:'default',page:1});
  const videoIds=new Set(data.videos.map(v=>v.id));
  const videoDefaults=()=>({version:1,lastVideo:null,favorites:[],records:{}});
  const recordDefault=()=>({note:'',reviewed:false,markers:[]});
  const workshopDefaults=()=>({version:1,plan:null,journalDraft:null,library:libraryDefaults(),videos:videoDefaults()});
  const blank=()=>({version:VERSION,revision:0,updatedAt:null,favorites:[],progress:{},journal:[],lastSkill:null,workshop:workshopDefaults()});
  const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const scope=user=>user?.guest===true?(user.id?'guest:'+encodeURIComponent(String(user.id)):'guest'):user&&(user.id||user._id||user.sub||user.email)?'account:'+encodeURIComponent(String(user.id||user._id||user.sub||user.email)):'guest';
  const keyFor=user=>'hh.patin.v1.'+scope(user);
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const text=(value,max)=>typeof value==='string'&&value.length<=max;
  const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
  function skillSelection(value,max=6){if(!Array.isArray(value)||value.length>max||value.some(id=>!ids.has(id))||new Set(value).size!==value.length)throw Error('Chọn tối đa '+max+' kỹ năng khác nhau.');return [...value];}
  function validatePlan(p){if(!object(p)||!text(p.title,160)||![10,20,30].includes(p.minutes)||!text(p.notes,1000)||(p.date!==''&&!date(p.date)))throw Error('Kế hoạch không hợp lệ.');return {title:p.title,minutes:p.minutes,date:p.date,skills:skillSelection(p.skills),notes:p.notes};}
  function validateEntry(e){if(!object(e)||!text(e.id,80)||!/^[a-zA-Z0-9-]+$/.test(e.id)||!date(e.date)||!Number.isInteger(e.minutes)||e.minutes<1||e.minutes>600||!text(e.note,2000)||!Array.isArray(e.skills)||e.skills.length>ids.size||e.skills.some(id=>!ids.has(id))||new Set(e.skills).size!==e.skills.length)throw Error('Nhật ký không hợp lệ (ngày, thời lượng hoặc kỹ năng).');return {id:e.id,date:e.date,minutes:e.minutes,note:e.note,skills:[...e.skills]};}
  function validateDraft(d){if(!object(d)||(d.date!==''&&!date(d.date))||!text(d.minutes,5)||!/^\d*$/.test(d.minutes)||!text(d.note,2000)||(d.editingId!==null&&(!text(d.editingId,80)||!/^[a-zA-Z0-9-]+$/.test(d.editingId))))throw Error('Bản nháp nhật ký không hợp lệ.');const snapshot=d.snapshot===null?null:validateEntry(d.snapshot);if((d.editingId===null)!==(snapshot===null)||snapshot&&snapshot.id!==d.editingId)throw Error('Bản gốc của buổi đang sửa không khớp.');return {date:d.date,minutes:d.minutes,note:d.note,skills:skillSelection(d.skills,ids.size),editingId:d.editingId,snapshot};}
  function validateVideos(v){
    if(v===undefined)return videoDefaults();
    if(!object(v)||v.version!==1||(v.lastVideo!==null&&!videoIds.has(v.lastVideo))||!Array.isArray(v.favorites)||v.favorites.length>videoIds.size||v.favorites.some(id=>!videoIds.has(id))||new Set(v.favorites).size!==v.favorites.length||!object(v.records)||Object.keys(v.records).length>videoIds.size)throw Error('Dữ liệu video không hợp lệ.');
    const records={};
    for(const [id,r]of Object.entries(v.records)){
      if(!videoIds.has(id)||!object(r)||!text(r.note,2000)||typeof r.reviewed!=='boolean'||!Array.isArray(r.markers)||r.markers.length>12||r.markers.some(m=>!object(m)||!Number.isInteger(m.seconds)||m.seconds<0||m.seconds>86400||!text(m.note,160))||new Set(r.markers.map(m=>m.seconds)).size!==r.markers.length)throw Error('Ghi chú hoặc mốc video không hợp lệ.');
      records[id]={note:r.note,reviewed:r.reviewed,markers:r.markers.map(m=>({seconds:m.seconds,note:m.note}))};
    }
    return {version:1,lastVideo:v.lastVideo,favorites:[...v.favorites],records};
  }
  function validateWorkshop(w){if(w===undefined)return workshopDefaults();if(!object(w)||w.version!==1)throw Error('Phiên bản công cụ Patin không hợp lệ.');const l=w.library;if(!object(l)||!text(l.query,120)||!['all',...data.categories.map(c=>c.id)].includes(l.category)||!['all',...data.levels.map(x=>x.id)].includes(l.level)||!['all',...data.disciplines.map(d=>d.id)].includes(l.discipline??'all')||typeof l.favorites!=='boolean'||!['grid','list'].includes(l.mode)||!['all','unread','read','tried'].includes(l.status)||!['default','title','level'].includes(l.sort)||!Number.isInteger(l.page)||l.page<1||l.page>100)throw Error('Bộ lọc thư viện không hợp lệ.');return {version:1,videos:validateVideos(w.videos),plan:w.plan===null?null:validatePlan(w.plan),journalDraft:w.journalDraft===null?null:validateDraft(w.journalDraft),library:{query:l.query,category:l.category,discipline:l.discipline??'all',level:l.level,favorites:l.favorites,mode:l.mode,status:l.status,sort:l.sort,page:l.page}};}
  function validate(input){
    if(!object(input)||input.version!==VERSION||!Number.isSafeInteger(input.revision)||input.revision<0||!Array.isArray(input.favorites)||input.favorites.length>ids.size||!object(input.progress)||Object.keys(input.progress).length>ids.size||!Array.isArray(input.journal)||input.journal.length>MAX_ENTRIES)throw Error('Định dạng hoặc phiên bản dữ liệu không hợp lệ.');
    if(input.favorites.some(id=>!ids.has(id))||new Set(input.favorites).size!==input.favorites.length)throw Error('Dấu trang không hợp lệ.');
    if(input.lastSkill!==null&&!ids.has(input.lastSkill))throw Error('Kỹ năng gần đây không hợp lệ.');
    if(input.updatedAt!==null&&(!text(input.updatedAt,40)||!Number.isFinite(Date.parse(input.updatedAt))))throw Error('Thời điểm lưu không hợp lệ.');
    const clean=blank();clean.revision=input.revision;clean.updatedAt=input.updatedAt;clean.favorites=[...input.favorites];clean.lastSkill=input.lastSkill;clean.workshop=validateWorkshop(input.workshop);
    for(const [id,p]of Object.entries(input.progress)){
      if(!ids.has(id)||!object(p)||typeof p.read!=='boolean'||typeof p.tried!=='boolean'||!text(p.note,4000))throw Error('Ghi chú hoặc tự ghi nhận kỹ năng không hợp lệ.');
      clean.progress[id]={read:p.read,tried:p.tried,note:p.note};
    }
    const seen=new Set();
    for(const e of input.journal){
      const entry=validateEntry(e);if(seen.has(entry.id))throw Error('ID buổi tập bị trùng.');seen.add(entry.id);clean.journal.push(entry);
    }
    if(bytes(JSON.stringify(clean))>MAX_BYTES)throw Error('Dữ liệu vượt giới hạn 600 KB.');
    return clean;
  }
  function parse(raw){if(typeof raw!=='string'||bytes(raw)>MAX_BYTES)throw Error('Tệp quá lớn hoặc không phải JSON.');return validate(JSON.parse(raw));}
  const memory=new Map();
  function createStore(user,storage,now=()=>new Date().toISOString()){
    const key=keyFor(user);let state=blank(),status='saved',error='',rawBackup='',pending=false,baseRaw=null;
    function load(){
      try{const raw=storage?.getItem(key)||null;if(!storage)throw Error('storage-unavailable');state=raw?parse(raw):blank();baseRaw=raw;rawBackup='';status='saved';error='';}
      catch(e){if(e.message==='storage-unavailable'||e.name==='SecurityError'){state=blank();status='memory';error='Trình duyệt không cho lưu cục bộ.';}else{state=blank();status='corrupt';error='Dữ liệu cũ không đọc được. Hãy tải bản gốc trước khi reset hoặc nhập bản sao.';try{rawBackup=storage?.getItem(key)||'';}catch(_){}}}
    }
    load();
    if(memory.has(key)){const draft=memory.get(key);state=copy(draft.state);baseRaw=draft.baseRaw;pending=true;status='memory';error='Có thay đổi chưa lưu trên thiết bị; hãy xuất hoặc thử lưu lại.';}
    function persist(next,replace=false){
      const clean=validate(next);clean.revision=Math.max(state.revision,clean.revision)+1;clean.updatedAt=now();if(!Number.isSafeInteger(clean.revision))throw Error('Revision vượt giới hạn; hãy xuất và reset trước khi nhập bản mới.');
      state=clean;
      try{if(!storage)throw Error('storage-unavailable');if(pending&&!replace&&(storage.getItem(key)||null)!==baseRaw)throw Error('data-changed');const raw=JSON.stringify(clean);storage.setItem(key,raw);baseRaw=raw;pending=false;memory.delete(key);status='saved';error='';return true;}
      catch(err){pending=true;memory.set(key,{state:copy(clean),baseRaw});status='memory';error=err.message==='data-changed'?'Tab khác đã đổi dữ liệu. Bản nháp chỉ giữ trong phiên; xuất rồi chọn bỏ bản nháp để tải bản mới.':'Chưa lưu được trên thiết bị (quyền lưu hoặc dung lượng). Dữ liệu tạm còn trong phiên; hãy xuất JSON.';return false;}
    }
    return Object.freeze({key,getState:()=>copy(state),getStatus:()=>({status,error,pending}),rawBackup:()=>rawBackup,
      mutate(fn){if(status==='corrupt')throw Error(error);if(!pending){load();if(status==='corrupt')throw Error(error);}const next=copy(state);fn(next);return persist(next);},
      retry(){if(status==='corrupt')throw Error(error);if(pending&&storage){const raw=storage.getItem(key)||null;if(raw!==baseRaw)throw Error('Một tab khác đã đổi dữ liệu. Xuất bản nháp rồi tải dữ liệu mới trước khi tiếp tục.');}return persist(state);},
      reload(){if(pending)return false;load();return status==='saved';},
      discardDraft(){memory.delete(key);pending=false;load();return status==='saved';},
      import(raw){const clean=parse(raw);return persist(clean,true);},
      reset(){if(!storage){state=blank();memory.delete(key);pending=false;status='memory';error='Không có quyền lưu; bộ nhớ phiên đã được xóa.';return false;}try{storage.removeItem(key);state=blank();memory.delete(key);pending=false;rawBackup='';status='saved';error='';return true;}catch(_){throw Error('Không xóa được dữ liệu trên thiết bị.');}},
      export:()=>JSON.stringify({format:'hh.patin',version:VERSION,exportedAt:now(),state})
    });
  }
  function readImport(raw){if(typeof raw!=='string'||bytes(raw)>MAX_BYTES+2000)throw Error('Tệp vượt giới hạn 600 KB.');const parsed=JSON.parse(raw);if(!object(parsed)||parsed.format!=='hh.patin'||parsed.version!==VERSION)throw Error('Không phải bản sao HH Patin v1.');return JSON.stringify(validate(parsed.state));}
  function filterSkills({query='',category='all',level='all',discipline='all',favoritesOnly=false,favorites=[],progress={},status='all',sort='default'}={}){const terms=fold(query).split(/\s+/).filter(Boolean),found=data.skills.filter(s=>(category==='all'||s.category===category)&&(discipline==='all'||s.discipline===discipline)&&(level==='all'||s.level===level)&&(!favoritesOnly||favorites.includes(s.id))&&(status==='all'||status==='unread'&&!progress[s.id]?.read||status==='read'&&progress[s.id]?.read||status==='tried'&&progress[s.id]?.tried)&&terms.every(t=>fold(s.title+' '+s.goal+' '+s.id+' '+data.categories.find(c=>c.id===s.category)?.title).includes(t)));if(sort==='title')found.sort((a,b)=>a.title.localeCompare(b.title,'vi'));if(sort==='level')found.sort((a,b)=>data.levels.findIndex(x=>x.id===a.level)-data.levels.findIndex(x=>x.id===b.level));return found;}
  function toggleFavorite(state,id){if(!ids.has(id))throw Error('Không có kỹ năng này.');state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id];}
  function progress(state,id){if(!ids.has(id))throw Error('Không có kỹ năng này.');return state.progress[id]||(state.progress[id]={read:false,tried:false,note:''});}
  function setStatus(state,id,field,value){if(!statuses.has(field)||typeof value!=='boolean')throw Error('Trạng thái không hợp lệ.');progress(state,id)[field]=value;}
  function setNote(state,id,value){if(!text(value,4000))throw Error('Ghi chú tối đa 4.000 ký tự.');progress(state,id).note=value;}
  function addEntry(state,entry){if(state.journal.length>=MAX_ENTRIES)throw Error('Đã đạt 500 buổi; hãy xuất bản sao và quản lý nhật ký cũ.');const checked=validate({...state,journal:[entry,...state.journal]});state.journal=checked.journal;}
  const removeEntry=(state,id)=>{state.journal=state.journal.filter(e=>e.id!==id);};
  function updateEntry(state,id,patch,snapshot){const index=state.journal.findIndex(j=>j.id===id);if(index<0)throw Error('Buổi này đã bị xóa ở nơi khác. Bản nháp vẫn được giữ.');const original=validateEntry(snapshot);if(original.id!==id||JSON.stringify(validateEntry(state.journal[index]))!==JSON.stringify(original))throw Error('Buổi này đã được sửa ở tab khác. Xuất bản nháp hoặc hủy sửa để tải bản mới.');state.journal[index]=validateEntry({...patch,id});}
  const setPlan=(state,p)=>{state.workshop.plan=p===null?null:validatePlan(p);};
  const setJournalDraft=(state,d)=>{state.workshop.journalDraft=d===null?null:validateDraft(d);};
  const setLibrary=(state,l)=>{state.workshop.library=validateWorkshop({...state.workshop,library:l}).library;};
  function videoRecord(state,id){if(!videoIds.has(id))throw Error('Không tìm thấy video.');return state.workshop.videos.records[id]||(state.workshop.videos.records[id]=recordDefault());}
  function setVideoNote(state,id,note,expected){const r=videoRecord(state,id);if(!text(note,2000))throw Error('Ghi chú tối đa 2000 ký tự.');if(r.note!==expected)throw Error('Ghi chú đã thay đổi ở tab khác. Bản đang nhập vẫn giữ; tải TXT trước rồi mở lại video để đối chiếu.');r.note=note;}
  function toggleVideoFavorite(state,id){if(!videoIds.has(id))throw Error('Không tìm thấy video.');const a=state.workshop.videos.favorites,i=a.indexOf(id);if(i<0)a.push(id);else a.splice(i,1);}
  function setVideoReviewed(state,id,value){if(typeof value!=='boolean')throw Error('Trạng thái không hợp lệ.');videoRecord(state,id).reviewed=value;}
  function setLastVideo(state,id){if(!videoIds.has(id))throw Error('Không tìm thấy video.');state.workshop.videos.lastVideo=id;}
  function setVideoMarker(state,id,seconds,note){const r=videoRecord(state,id);if(!Number.isInteger(seconds)||seconds<0||seconds>86400||!text(note,160))throw Error('Mốc thời gian không hợp lệ (0–86400 giây).');const i=r.markers.findIndex(m=>m.seconds===seconds);if(i<0){if(r.markers.length>=12)throw Error('Tối đa 12 mốc mỗi video.');r.markers.push({seconds,note});}else r.markers[i]={seconds,note};r.markers.sort((a,b)=>a.seconds-b.seconds);}
  function removeVideoMarker(state,id,seconds){const r=videoRecord(state,id);r.markers=r.markers.filter(m=>m.seconds!==seconds);}

  function filterJournal(state,{query='',skill='all',from='',to='',sort='newest'}={}){const terms=fold(query).split(/\s+/).filter(Boolean);return state.journal.filter(j=>(skill==='all'||j.skills.includes(skill))&&(!from||j.date>=from)&&(!to||j.date<=to)&&terms.every(t=>fold(j.note+' '+j.skills.map(id=>data.skills.find(s=>s.id===id)?.title).join(' ')).includes(t))).sort((a,b)=>(sort==='oldest'?1:-1)*a.date.localeCompare(b.date));}
  function journalCsv(entries){const field=value=>{let s=String(value??'');if(/^[\s\uFEFF]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};return '\uFEFF'+[['Ngày','Phút tự nhập','Kỹ năng','Ghi chú'],...entries.map(j=>[j.date,j.minutes,j.skills.map(id=>data.skills.find(s=>s.id===id)?.title||id).join(' | '),j.note])].map(row=>row.map(field).join(',')).join('\r\n');}
  function planText(p){const saved=validatePlan(p);return ['HH Patin · Kế hoạch tham khảo',saved.title||'Kế hoạch riêng',saved.date?'Ngày dự kiến: '+saved.date:'Chưa đặt ngày',...plan(saved.minutes).map(x=>x.minutes+' phút · '+x.title),'Bài muốn trao đổi với HLV: '+saved.skills.map(id=>data.skills.find(s=>s.id===id).title).join(', '),saved.notes,'Thời lượng là dự kiến, không được cộng vào nhật ký. Không phải chỉ định thể lực hay chứng nhận kỹ năng.'].join('\n');}
  const summary=state=>({read:Object.values(state.progress).filter(p=>p.read).length,tried:Object.values(state.progress).filter(p=>p.tried).length,sessions:state.journal.length,minutes:state.journal.reduce((n,e)=>n+e.minutes,0)});
  function plan(minutes=20){const duration=[10,20,30].includes(Number(minutes))?Number(minutes):20;return [{title:'Chuẩn bị & kiểm tra sân/giày',minutes:duration===10?2:4},{title:'Ôn tư thế và cách dừng đã được hướng dẫn',minutes:duration===10?5:duration===20?10:16},{title:'Bài HLV chọn ở tốc độ kiểm soát',minutes:duration===10?2:duration===20?4:7},{title:'Nghỉ, kiểm tra thiết bị & ghi nhận',minutes:duration===10?1:duration===20?2:3}];}

  const checkQuiz=answers=>data.quiz.map(q=>({id:q.id,answered:Number.isInteger(answers[q.id])&&answers[q.id]>=0&&answers[q.id]<q.options.length,correct:answers[q.id]===q.answer,explanation:q.explanation}));
  return Object.freeze({VERSION,MAX_BYTES,MAX_ENTRIES,blank,fold,escape,scope,keyFor,validate,parse,createStore,readImport,filterSkills,toggleFavorite,setStatus,setNote,addEntry,removeEntry,updateEntry,setPlan,setJournalDraft,setLibrary,setVideoNote,toggleVideoFavorite,setVideoReviewed,setLastVideo,setVideoMarker,removeVideoMarker,filterJournal,journalCsv,planText,summary,plan,checkQuiz});
});
