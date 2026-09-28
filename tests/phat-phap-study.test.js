const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const checksum = value => require('node:crypto').createHash('sha256').update(JSON.stringify(value)).digest('hex');
function backupFile(payload) {return {name:'qa.hhphap',size:1000,text:async()=>JSON.stringify({kind:'hh-dharma-study',version:1,payload,checksum:checksum(payload)})};}
function runtime() {
  let now = 100000, callback, failures = false;
  const storage = new Map(), messages = [], nodes = [{textContent:''},{textContent:''}];
  const labels = [{textContent:''}], toggles = [{textContent:''},{textContent:''}], lock={disabled:true}, mini={hidden:true};
  const context = {structuredClone, URLSearchParams, TextEncoder, console, document:{hidden:false}, navigator:{locks:{request:async(name,opts,fn)=>fn({name})}}, location:{hash:''}, Date:class extends Date {static now(){return now;}},
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>{if(failures)throw Error('quota');storage.set(key,value);}},
    setInterval:fn=>{callback=fn;return 1;},clearInterval:()=>{callback=null;},setTimeout:()=>0,clearTimeout:()=>{},crypto:{subtle:require('node:crypto').webcrypto.subtle,randomUUID:()=>`test-${now}`}};
  context.window=context; vm.createContext(context);
  vm.runInContext(read('phat-phap-curriculum.js'),context);
  vm.runInContext(read('phat-phap-study-data.js'),context);
  vm.runInContext(read('phat-phap-learning-tools.js'),context);
  vm.runInContext(read('phat-phap-practice-runtime.js'),context);
  vm.runInContext(read('phat-phap-study-ui.js'),context);
  const code=read('phat-phap.js').replace('  global.HHPhatPhap =', `
    global.qa = {readState, commitStudy, stopTimer, toggleTimer, saveState, practiceMarkup, researchCatalog, handleChange, prepareImport, confirmPendingImport, pending:()=>pendingImport,
      init(host, account='guest') {root=host;accountKey=account;state=readState();timerInitial=300;timerRemaining=300;timerRunning=false;renderView=()=>{};updateProgressPanel=()=>{};toast=(message)=>global.messages.push(message);},
      state:()=>state, time:()=>({remaining:timerRemaining,running:timerRunning}), setSilent:()=>{state.meditation.silent=true;}};
  global.HHPhatPhap =`);
  context.messages=messages;
  vm.runInContext(code,context);
  const host={querySelector:selector=>selector==='[data-meditation-lock]'?lock:selector==='.dharma-meditation-mini'?mini:null,querySelectorAll:selector=>selector==='[data-timer-display]'?nodes:selector==='[data-timer-toggle]'?toggles:labels};
  context.qa.init(host);context.qa.setSilent();
  return {context,storage,messages,nodes,toggles,lock,mini,host,advance(seconds){now+=seconds*1000;callback?.();},fail(value){failures=value;}};
}
test('40 unique teachings preserve original IDs and every new reference/relationship resolves',()=>{
  const {context:c}=runtime(), t=c.HHPhatPhap.teachings, d=c.HHDharmaStudyData;
  assert.equal(t.length,40); assert.equal(new Set(t.map(x=>x.id)).size,40);
  for(const item of t){for(const id of item.related||[])assert.ok(t.some(x=>x.id===id),id);for(const r of item.references||[])assert.match(r.url,/^https:\/\/suttacentral.net\/[a-z0-9.]+\/en\/sujato$/);}
  for(const p of d.paths)for(const id of p.ids)assert.ok(t.some(x=>x.id===id));
  for(const item of d.topics){assert.ok(item.quiz.options[item.quiz.answer]);assert.ok(item.deep.length>70);}
});

test('legacy backups require explicit replacement consent, drop unknown fields and normalize new study data',async()=>{
  const r=runtime(),q=r.context.qa,consent={checked:false};
  q.init({...r.host,querySelector:s=>s==='[data-import-consent]'?consent:r.host.querySelector(s)});
  const payload={lessonNotes:{'teaching:chanh-kien':'QA backup'},studyLab:{saved:['chanh-kien','unknown'],reader:{size:999,mode:'bad'}},unknownSecret:'not imported'};
  await q.prepareImport(backupFile(payload),'study');assert.match(q.pending().summary,/Gói cũ/);assert.equal(q.pending().data.unknownSecret,undefined);
  q.confirmPendingImport();assert.ok(q.pending());assert.equal(q.state().lessonNotes['teaching:chanh-kien'],undefined);
  consent.checked=true;q.confirmPendingImport();assert.equal(q.pending(),null);assert.equal(q.state().lessonNotes['teaching:chanh-kien'],'QA backup');
  assert.deepEqual([...q.state().studyLab.saved],['chanh-kien']);assert.equal(q.state().studyLab.reader.size,20);
});

test('invalid checksums and account changes during backup parsing cannot import data',async()=>{
  const r=runtime(),q=r.context.qa;
  await assert.rejects(q.prepareImport({size:100,text:async()=>JSON.stringify({kind:'hh-dharma-study',version:1,payload:{},checksum:'bad'})},'study'),/Checksum/);
  let finish;const file={size:100,name:'qa.hhphap',text:()=>new Promise(resolve=>{finish=resolve;})};
  const importing=q.prepareImport(file,'study');q.init(r.host,'second-account');
  finish(await backupFile({lessonNotes:{private:'QA'}}).text());await assert.rejects(importing,/Phiên làm việc/);assert.equal(q.pending(),null);
});
test('12 guided practices, eight ritual checklists and six new original readings are complete',()=>{
  const {context:c}=runtime(), d=c.HHDharmaStudyData;
  assert.equal(d.practices.length,12);assert.equal(d.rituals.length,8);assert.equal(d.chants.length,6);
  for(const item of [...d.practices,...d.rituals]){assert.ok(item.steps.length>=4);assert.ok(c.HHPhatPhap.teachings.some(x=>x.id===item.teachingId));}
  for(const item of d.rituals)assert.ok(c.HHPhatPhap.routes.some(x=>x.routeId===item.view));
  assert.ok(d.chants.every(x=>x.sourceLabel.includes('không phải kinh')));
  const markup=c.qa.practiceMarkup();
  assert.equal((markup.match(/data-meditation-type=/g)||[]).length,12);
  assert.ok(markup.indexOf('dharma-meditation-checkin') < markup.indexOf('dharma-practice-stage'));
  assert.ok(markup.indexOf('dharma-practice-stage') < markup.indexOf('dharma-meditation-course'));
  assert.equal((markup.match(/class="dharma-practice-stage"/g)||[]).length,1);
  const catalog=c.qa.researchCatalog().filter(x=>x.type==='practice');
  assert.equal(catalog.length,12);assert.ok(catalog.every(x=>x.title && x.text && x.duration>0 && x.action==='practice'));
});
test('old data migrates additively and malformed study progress is normalized',()=>{
  const {context:c,storage}=runtime();
  storage.set('hh.phat-phap.study.v1:guest',JSON.stringify({completedLessons:['duc-phat'],lessonNotes:{legacy:'Giữ ghi chú'},studyLab:{completed:['nghiep','nghiep','bad'],saved:'wrong',answers:{nghiep:99},ritualChecks:{home:[0,0,99,-1,'2']}}}));
  const s=c.qa.readState();assert.equal(s.lessonNotes.legacy,'Giữ ghi chú');assert.equal(s.completedLessons[0],'duc-phat');
  assert.equal(JSON.stringify(s.studyLab),JSON.stringify(c.HHDharmaStudyData.normalizeStudy({completed:['nghiep'],ritualChecks:{home:[0]}},c.HHPhatPhap.teachings.map(x=>x.id))));
});
test('study save is account scoped, round-trips answers/checklists, and rolls back on quota failure',()=>{
  const r=runtime(),q=r.context.qa;
  const next={completed:['nghiep'],saved:['nghiep'],answers:{nghiep:1},ritualChecks:{home:[0,2]}};
  assert.equal(q.commitStudy(next),true); assert.equal(q.readState().studyLab.answers.nghiep,1);
  assert.equal(q.readState().studyLab.ritualChecks.home.length,2);
  r.fail(true);assert.equal(q.commitStudy({completed:['tam-bao']}),false);assert.equal(q.state().studyLab.completed[0],'nghiep');assert.match(r.messages.at(-1),/Chưa lưu/);
  r.fail(false);q.init(r.host,'other-account');assert.equal(q.readState().studyLab.completed.length,0);
});
test('map aliases open the exact Tam học and Thất giác chi articles',()=>{
  const {context:c}=runtime();
  for(const [alias,id] of [['threefold','tam-hoc'],['seven','that-giac-chi'],['mindfulness','tu-niem-xu']]){
    const html=c.HHDharmaStudyUI.map({teachings:c.HHPhatPhap.teachings,selected:alias});
    assert.ok(html.includes(`data-open-teaching="${id}"`));assert.ok(html.includes(`data-map-node="${id}" aria-pressed="true"`));
  }
});
test('catalog filters without accents, returns honest empty states and escapes notes',()=>{
  const {context:c}=runtime(),teachings=c.HHPhatPhap.teachings,state=c.qa.state();
  let html=c.HHDharmaStudyUI.catalog({teachings,state,query:'chanh ngu',filter:'all'});
  assert.match(html,/1 chủ đề phù hợp/);
  html=c.HHDharmaStudyUI.catalog({teachings,state,query:'  ĐẠO  ',filter:'all'});assert.doesNotMatch(html,/0 chủ đề phù hợp/);
  html=c.HHDharmaStudyUI.catalog({teachings,state,query:'missing-term',filter:'all'});assert.match(html,/Không tìm thấy/);
  state.lessonNotes['teaching:nghiep']='</textarea><img src=x onerror=alert(1)>';
  html=c.HHDharmaStudyUI.detail({teachings,state,item:teachings.find(x=>x.id==='nghiep')});
  assert.doesNotMatch(html,/<img src=x/);assert.match(html,/&lt;\/textarea&gt;/);
});
test('timer uses elapsed wall time, updates all displays and resumes without duplicate intervals',async()=>{
  const r=runtime(),q=r.context.qa;
  await q.toggleTimer();r.advance(17);assert.equal(q.time().remaining,283);assert.ok(r.nodes.every(n=>n.textContent==='04:43'));assert.ok(r.toggles.every(n=>n.textContent==='Tạm dừng'));
  assert.equal(r.lock.disabled,false);assert.equal(r.mini.hidden,false);
  q.stopTimer();assert.equal(q.readState().meditation.timer.remaining,283);
  assert.equal(r.lock.disabled,true);assert.equal(r.mini.hidden,true);
  r.advance(100);assert.equal(q.time().remaining,283);
  await q.toggleTimer();r.advance(3);assert.equal(q.time().remaining,280);q.stopTimer();
});

test('lesson notes never announce success when storage rejects the write',async()=>{
  const r=runtime();r.fail(true);
  const note={dataset:{lessonNote:'teaching:chanh-ngu'},value:'Ghi chú chưa lưu',matches:()=>false,closest:selector=>selector==='[data-lesson-note]'?note:null};
  await r.context.qa.handleChange({target:note});
  assert.match(r.messages.at(-1),/Chưa lưu/);assert.ok(r.messages.every(message=>!message.includes('Đã lưu')));
  r.fail(false);await r.context.qa.handleChange({target:note});
  assert.equal(r.context.qa.readState().lessonNotes['teaching:chanh-ngu'],note.value);
});
test('completed timer records one real session and does not tick after stopping',async()=>{
  const r=runtime(),q=r.context.qa;await q.toggleTimer();r.advance(301);
  assert.equal(q.state().practiceHistory.length,1);assert.equal(q.state().practiceHistory[0].minutes,5);
  r.advance(100);assert.equal(q.state().practiceHistory.length,1);assert.equal(q.time().running,false);
});
test('assets load in dependency order and cache manifest contains all new files',()=>{
  const loader=read('performance-loader.js'),sw=read('sw.js');
  const assets=['phat-phap-curriculum.js?v=1','phat-phap-study-data.js?v=2','phat-phap-learning-tools.js?v=1','phat-phap-study-ui.js?v=3','phat-phap-practice-runtime.js?v=1','phat-phap.js?v=21'];
  assert.ok(loader.includes(`scripts: [${assets.map(name=>JSON.stringify(name)).join(', ')}]`));
  for(const name of [...assets,'phat-phap.css?v=23'])assert.ok(sw.includes(name));
  assert.match(read('phat-phap.js'),/listen\(global, "pagehide"/);
  assert.match(read('phat-phap.css'),/forced-colors:active/);
  assert.match(read('phat-phap.css'),/body\.app-dharma-route\.app-sidebar-collapsed #appShell \.app-sidebar \{ display:none !important; \}/);
});

test('new curriculum plans, prerequisite links, levels and answer explanations resolve',()=>{
  const r=runtime(),c=r.context,C=c.HHDharmaCurriculum,t=c.HHPhatPhap.teachings;
  assert.equal(C.topics.length,16);
  for(const days of [7,14,30]){assert.equal(C.plan(days).length,days);assert.equal(new Set(C.plan(days)).size,days);for(const id of C.plan(days))assert.ok(t.some(x=>x.id===id));}
  for(const item of t){assert.ok(C.levels[item.level]);assert.ok(item.goal.length>30);for(const id of item.prerequisites)assert.ok(t.some(x=>x.id===id));if(item.quiz)assert.ok(item.quiz.explanation.length>30);}
});

test('local reading preferences, recent items and plan round-trip without leaking account state',()=>{
  const r=runtime(),q=r.context.qa,next=structuredClone(q.state().studyLab);
  next.recent=['chanh-kien'];next.plan={days:30,paused:true,skipped:['chanh-kien']};next.reader={mode:'night',size:28,line:2.2,width:'wide'};next.answers['chanh-kien']=0;
  assert.equal(q.commitStudy(next),true);const stored=q.readState().studyLab;
  assert.equal(stored.reader.mode,'night');assert.equal(stored.plan.days,30);assert.equal(stored.answers['chanh-kien'],0);
  q.init(r.host,'isolated');assert.equal(q.state().studyLab.recent.length,0);assert.equal(q.state().studyLab.reader.mode,'paper');
});

test('stale tabs cannot overwrite a newer stored document and timer refuses unsafe startup',async()=>{
  const r=runtime(),q=r.context.qa;
  const newer=JSON.stringify({...q.state(),lessonNotes:{keep:'Tab khác'}});r.storage.set('hh.phat-phap.study.v1:guest',newer);
  assert.equal(q.saveState(),false);assert.equal(r.storage.get('hh.phat-phap.study.v1:guest'),newer);
  await q.toggleTimer();assert.equal(q.time().running,false);
  assert.ok(r.messages.some(t=>t.includes('tab khác')));
});

test('review filters use real wrong answers and exported notes stay plain text',()=>{
  const r=runtime(),c=r.context,t=c.HHPhatPhap.teachings,s=c.qa.state();s.studyLab.answers['chanh-kien']=1;
  const html=c.HHDharmaStudyUI.catalog({teachings:t,state:s,query:'',filter:'review'});
  assert.match(html,/1 chủ đề phù hợp/);assert.match(html,/data-open-teaching="chanh-kien"/);
  const text=c.HHDharmaLearningTools.noteExport(t.find(x=>x.id==='chanh-kien'),'Ghi chú thử');
  assert.match(text,/Ghi chú thử/);assert.match(text,/suttacentral.net\/sn45.8/);assert.doesNotMatch(text,/journal|cipher/);
});
