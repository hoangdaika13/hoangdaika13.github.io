(function(scope){
  'use strict';
  const VERSION=1, unsafe=new Set(['__proto__','constructor','prototype']);
  const copy=value=>JSON.parse(JSON.stringify(value));
  const id=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(value)&&!unsafe.has(value);
  const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
  const fail=(message,code='STATE_ARCHIVE_CORRUPT')=>{throw Object.assign(Error(message),{code});};
  const stamp=value=>Number.isFinite(Date.parse(value))?Date.parse(value):Number(value)||0;
  function safeJSON(value){const pending=[[value,0]];let nodes=0;while(pending.length){const [v,depth]=pending.pop();if(++nodes>300000||depth>35)return false;if(v===null||['string','boolean'].includes(typeof v))continue;if(typeof v==='number'){if(!Number.isFinite(v))return false;continue;}if(typeof v!=='object')return false;for(const [k,child]of Object.entries(v)){if(unsafe.has(k))return false;pending.push([child,depth+1]);}}return true;}
  const maps=['notes','drafts','progress','reviews','sessions','projects','bookmarks','plans','labs'];
  function normalize(input){
    if(input===undefined||input===null)input={};
    if(!record(input))fail('Kho học đại học chưa đúng cấu trúc; giữ dữ liệu gốc.');
    if(input.version!==undefined&&input.version!==VERSION)fail('Kho học đại học thuộc phiên bản chưa hỗ trợ; giữ dữ liệu gốc.','STATE_VERSION_UNSUPPORTED');
    if(!safeJSON(input))fail('Kho học đại học có dữ liệu không hợp lệ; giữ dữ liệu gốc.');
    for(const k of maps)if(input[k]!==undefined&&(!record(input[k])||Object.values(input[k]).some(v=>!record(v))))fail('Kho học đại học sai trường '+k+'.');
    for(const k of ['context','navigation'])if(input[k]!==undefined&&!record(input[k]))fail('Bối cảnh đại học chưa đúng cấu trúc.');
    if(Object.values(input.sessions||{}).some(s=>s.schemaVersion!==1))fail('Phiên kiểm tra đại học thuộc phiên bản chưa hỗ trợ.','STATE_VERSION_UNSUPPORTED');
    if(input.attempts!==undefined&&!Array.isArray(input.attempts))fail('Lịch sử học đại học cần là danh sách.');
    const value={version:VERSION,context:{level:'university',institutionId:'hh',programId:'self-study',cohort:'',year:1,term:'all',updatedAt:''},navigation:{pane:'home',courseId:'',lessonId:'',updatedAt:''},preview:false,attempts:[],...copy(input)};
    for(const k of maps){value[k]=Object.fromEntries(Object.entries(input[k]||{}).filter(([key])=>id(key)));}
    value.context={...value.context,level:'university'};value.attempts=value.attempts.filter(record);return value;
  }
  function merge(left,right){
    const a=normalize(left),b=normalize(right),newer=stamp(a.updatedAt)>=stamp(b.updatedAt)?a:b,result={...copy(newer)};
    for(const name of maps){result[name]={...b[name]};for(const [key,item]of Object.entries(a[name])){const prior=result[name][key];if(name==='sessions'&&(prior?.status==='submitted'||item?.status==='submitted'))result[name][key]=prior?.status==='submitted'?item?.status==='submitted'&&Number(item.submittedAt)<Number(prior.submittedAt)?item:prior:item;else if(!prior||stamp(item.updatedAt||item.lastClockAt)>=stamp(prior.updatedAt||prior.lastClockAt))result[name][key]=item;}}
    for(const key of new Set([...Object.keys(a.projects),...Object.keys(b.projects)]))if(result.projects[key])result.projects[key].revisions={...b.projects[key]?.revisions,...a.projects[key]?.revisions};
    result.attempts=[...new Map([...b.attempts,...a.attempts].map(row=>[row.id||JSON.stringify(row),row])).values()];
    result.context=stamp(a.context?.updatedAt)>=stamp(b.context?.updatedAt)?a.context:b.context;
    result.navigation=stamp(a.navigation?.updatedAt)>=stamp(b.navigation?.updatedAt)?a.navigation:b.navigation;
    return normalize(result);
  }
  function validatePack(pack,entry){
    const errors=[],seen=new Set();if(!record(pack)||pack.schemaVersion!==1||pack.id!==entry.id||pack.version!==entry.version)errors.push('Gói học phần không khớp manifest.');
    if(!Array.isArray(pack?.lessons)||!pack.lessons.length||!Array.isArray(pack?.outcomes)||!pack.outcomes.length)errors.push('Gói thiếu bài hoặc mục tiêu.');
    for(const lesson of pack?.lessons||[]){if(!id(lesson.id)||seen.has(lesson.id))errors.push('ID bài thiếu hoặc trùng.');seen.add(lesson.id);if(!lesson.title||!Array.isArray(lesson.theory)||lesson.theory.length<2||!Array.isArray(lesson.worked?.steps)||!lesson.worked.steps.length||!lesson.activity?.task||!lesson.misconception?.correction)errors.push('Bài thiếu giải thích, ví dụ hoặc thực hành.');if(!Array.isArray(lesson.questions)||lesson.questions.length<3)errors.push('Bài thiếu ngân hàng câu hỏi.');for(const q of lesson.questions||[]){if(!id(q.id)||seen.has(q.id)||!q.prompt||!q.explanation)errors.push('Câu hỏi không hợp lệ.');seen.add(q.id);if(!q.outcomeIds?.every(x=>pack.outcomes.some(o=>o.id===x)))errors.push('Câu chưa liên kết mục tiêu.');}}
    if(pack?.contentStatus!=='draft')errors.push('Quy trình phát hành đại học hiện chỉ nhận bản nháp; chưa có thẩm định để công bố.');return{ok:!errors.length,errors};
  }
  function attempt(workspace,question,value,result,courseId,options={}){
    const w=normalize(workspace),now=options.now??Date.now(),at=new Date(now).toISOString(),entry={id:options.id||'uni-attempt-'+now.toString(36)+'-'+Math.random().toString(36).slice(2,8),courseId,questionId:question.id,lessonId:question.lessonId,outcomeIds:question.outcomeIds,value:copy(value),result:copy(result),helped:Boolean(options.helped),contentStatus:'draft',createdAt:at};
    if(w.attempts.some(row=>row.id===entry.id))return w;w.attempts.push(entry);w.drafts[question.id]={submitted:true,value:null,updatedAt:at};
    const previous=w.reviews[question.id]||{},correct=result.correct===true&&!options.helped,interval=correct?Math.min(14,Math.max(1,Number(previous.intervalDays)||0)*3):1;
    w.reviews[question.id]={questionId:question.id,courseId,lessonId:question.lessonId,intervalDays:interval,dueAt:new Date(now+interval*86400000).toISOString(),lastCorrect:result.correct===true,pending:result.gradingStatus==='pending-review',updatedAt:at};w.updatedAt=at;return w;
  }
  function recommendation(w,course,now=Date.now()){
    const due=Object.values(w.reviews).filter(r=>r.courseId===course.id&&stamp(r.dueAt)<=now).sort((a,b)=>stamp(a.dueAt)-stamp(b.dueAt))[0];if(due)return{lessonId:due.lessonId,reason:due.lastCorrect?'Có câu đến lịch ôn sau lượt tự làm.':'Ôn lại bài có câu cần sửa hoặc đối chiếu rubric.',kind:'review'};
    const lesson=course.lessons.find(l=>!w.progress[l.id]?.viewedAt)||course.lessons[0];return{lessonId:lesson?.id,reason:course.lessons.some(l=>!w.progress[l.id]?.viewedAt)?'Tiếp tục bài chưa đánh dấu đã đọc trong chuỗi.':'Đã đọc chuỗi; luyện lại và đối chiếu dự án để củng cố.',kind:'lesson'};
  }
  function planDates(lessonIds,date,now=Date.now()){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Ngày ôn chưa hợp lệ.');const deadline=Date.parse(date+'T23:59:59');if(!Number.isFinite(deadline)||deadline<now)throw Error('Chọn ngày ôn từ hôm nay trở đi.');const days=Math.max(1,Math.floor((deadline-now)/86400000)+1);return lessonIds.map((lessonId,i)=>{const d=new Date(now);d.setDate(d.getDate()+Math.min(days-1,Math.floor(i*days/Math.max(1,lessonIds.length))));return{lessonId,date:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};});
  }
  const api=Object.freeze({VERSION,id,safeJSON,normalize,merge,validatePack,attempt,recommendation,planDates});scope.HHSchoolUniversityCore=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
