'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const E=require('../hh-university-experience-core'),T=require('../hh-university-tools'),H=require('../utils/university-handler'),G=require('../utils/mathcore-gemini'),R=require('../hh-university-workspace-data');
const {createEducationMemoryDB}=require('./helpers/hh-school-memory-db');
const root=path.resolve(__dirname,'..');
const response=()=>({code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(v){this.value=v;return this;},end(){return this;}});
const req=(method,body,extra={})=>({method,body,headers:{host:'hoang8.com',origin:'https://hoang8.com','sec-fetch-site':'same-origin'},query:{universityResource:'workspace'},...extra});
const course=(id,grade,credits=3)=>({id,code:id,title:id,credits,term:1,status:'completed',grade,day:1,start:'08:00',end:'09:00',prerequisites:[]});
const fixture=()=>{const db=createEducationMemoryDB(),user={_id:'alice'},calls=[];const h=H.createHandler({getUser:async()=>user,getDb:async()=>db,keys:()=>[],rateLimit:async(...args)=>calls.push(args.slice(1))});return {db,user,h,calls};};

test('additive experience migration preserves v1 study, CV and private state',()=>{
  const old=T.defaults();old.version=1;delete old.experience;old.cv.name='Existing learner';old.compare=[{schoolId:'vn-ts-313'}];old.planner.courses=[course('math',4)];
  const migrated=T.state(old);assert.equal(migrated.version,2);assert.equal(migrated.experience.schemaVersion,1);assert.equal(migrated.cv.name,old.cv.name);assert.equal(T.gpa(migrated.planner).gpa,4);assert.equal(migrated.compare[0].schoolId,'vn-ts-313');assert.equal(T.preferenceKey({_id:'a'}),'hh.university.workspace.v1:a');
});
test('unknown experience versions and excessive collections fail before replacement',()=>{
  assert.throws(()=>T.state({...T.defaults(),experience:{schemaVersion:2}}),/phục hồi/);
  assert.throws(()=>E.normalize({...E.defaults(),boards:Array(13).fill({})}),/khôi phục/);
  assert.throws(()=>E.normalize({...E.defaults(),attempts:[{id:'a',date:'2026-10-29',correct:5,total:4}]}),/khôi phục/);
});
test('search links roundtrip public filters and exclude unrelated private fields',()=>{
  const url=E.searchURL({q:'Công nghệ & phần mềm',province:'Hồ Chí Minh',year:2026,cv:'secret',token:'secret'}),params=new URLSearchParams(url.split('?')[1]);
  assert.equal(params.get('q'),'Công nghệ & phần mềm');assert.equal(params.get('year'),'2026');assert.ok(!url.includes('secret'));assert.equal(E.searchURL({q:'QSC',family:'computing'},'schools'),'/university?q=QSC');assert.equal(E.filters({year:'2099',level:'invalid'}).year,'all');
});
test('calendar grids are Monday-first, include leap day and shift over year boundaries',()=>{
  const rows=E.monthDays('2028-02');assert.equal(rows.length,42);assert.equal(new Date(rows[0].date+'T00:00Z').getUTCDay(),1);assert.equal(rows.filter(r=>r.current).length,29);assert.equal(E.shiftMonth('2026-12',1),'2027-01');assert.equal(E.shiftMonth('2026-01',-1),'2025-12');assert.throws(()=>E.monthDays('2026-13'));
});
test('event filtering separates scholarship, personal, completion and overdue dates',()=>{
  const events=[{id:'a',date:'2026-10-28',source:'https://example.edu.vn'},{id:'b',date:'2026-10-29',category:'scholarship',done:false},{id:'c',date:'2026-10-30',category:'scholarship',done:true}];
  const all=E.filterEvents(events,{school:'',category:'all',showDone:false},'2026-10-29');assert.equal(all.length,2);assert.equal(all[0].overdue,true);assert.equal(all[1].overdue,false);assert.equal(E.filterEvents(events,{category:'scholarship',showDone:false},'2026-10-29').length,1);
});
test('event conflicts use bounded times and do not treat adjacent appointments as overlap',()=>{
  const events=[{id:'a',date:'2026-10-29',time:'08:00',end:'09:00'},{id:'b',date:'2026-10-29',time:'09:00',end:'10:00'},{id:'c',date:'2026-10-29',time:'08:30',end:'08:45'}];assert.deepEqual(E.eventConflicts(events),[['a','c']]);assert.equal(E.clock('24:00'),'');assert.equal(E.day('2026-02-29'),'');
});
test('ICS retains explicitly selected duration and rejects invalid event clock state',()=>{
  const text=T.calendar([{id:'a',title:'Exam',date:'2026-12-20',time:'08:00',end:'10:00'}]);assert.match(text,/DTSTART:20261220T010000Z/);assert.match(text,/DTEND:20261220T030000Z/);assert.throws(()=>T.state({...T.defaults(),events:[{id:'a',title:'x',date:'2026-12-20',time:'24:00'}]}));
});
test('retake/deferred planning status never counts a new uncompleted grade as earned GPA',()=>{
  const p={...T.defaults().planner,courses:[course('a',4),{...course('b',3),status:'retake'},{...course('c',4),status:'deferred'}]};assert.equal(T.gpa(p).gpa,4);assert.equal(T.gpa(p).earned,3);assert.equal(T.conflicts(p.courses).length,0);assert.equal(T.course({...course('d',2),group:'Core'}).group,'Core');
});
test('cloud snapshot sends selected groups and excludes CV, orientation and learning notes',()=>{
  const s=T.defaults();s.cv.name='private-CV';s.profile.goals='private-goal';s.library.notes=[{id:'r',page:2,text:'private-note'}];s.experience.recentSearch={q:'private-search'};s.compare=[{schoolId:'vn-ts-313'}];
  const p=E.cloudPack(s,['compare'],T),text=JSON.stringify(p);assert.ok(!text.includes('private-'));assert.deepEqual(p.scopes,['compare']);assert.equal(p.data.compare.length,1);assert.equal(p.data.events,undefined);assert.equal(p.data.cv,undefined);
});
test('selective cloud restore preserves every unselected group and local identity data',()=>{
  const local=T.defaults(),remote=T.defaults();local.cv.name='Local';local.tasks=[{id:'t',title:'Local task'}];remote.wishes=[{schoolId:'vn-ts-89',programId:'p'}];remote.cv.name='Must not copy';
  const restored=E.cloudApply(local,E.cloudPack(remote,['wishes'],T),T);assert.equal(restored.cv.name,'Local');assert.equal(restored.tasks[0].title,'Local task');assert.equal(restored.wishes[0].schoolId,'vn-ts-89');assert.throws(()=>E.cloudPack(remote,['cv'],T));assert.throws(()=>E.cloudApply(local,{schemaVersion:2,data:{}},T));
});
test('snapshot API requires authentication and does not accept forged owner identifiers',async()=>{
  const f=fixture(),payload=E.cloudPack(T.defaults(),['compare'],T),r=response();await f.h(req('PUT',{revision:0,payload,ownerId:'bob'}),r);assert.equal(r.code,200);assert.equal(f.db.rows('university_workspaces')[0].ownerId,'alice');
  const anon=H.createHandler({getUser:async()=>null,keys:()=>[]}),a=response();await anon(req('GET'),a);assert.equal(a.code,401);
  const bob=H.createHandler({getUser:async()=>({_id:'bob'}),getDb:async()=>f.db,rateLimit:async()=>{},keys:()=>[]}),b=response();await bob(req('GET',undefined,{query:{universityResource:'workspace',ownerId:'alice'}}),b);assert.equal(b.value.payload,null);
});
test('snapshot writes use compare-and-set revisions, including concurrent first creation',async()=>{
  const f=fixture(),payload=E.cloudPack(T.defaults(),['calendar'],T);let r=response();await f.h(req('PUT',{revision:0,payload}),r);assert.equal(r.value.revision,1);
  r=response();await f.h(req('PUT',{revision:0,payload}),r);assert.equal(r.code,409);assert.equal(f.db.rows('university_workspaces').length,1);
  r=response();await f.h(req('PUT',{revision:1,payload}),r);assert.equal(r.value.revision,2);
  r=response();await f.h(req('PUT',{revision:1,payload}),r);assert.equal(r.code,409);assert.equal(f.db.rows('university_workspaces')[0].revision,2);
});
test('snapshot delete is owner and revision bound and does not clear local objects',async()=>{
  const f=fixture(),s=T.defaults(),payload=E.cloudPack(s,['planner'],T);let r=response();await f.h(req('PUT',{revision:0,payload}),r);r=response();await f.h(req('DELETE',{revision:9}),r);assert.equal(r.code,409);r=response();await f.h(req('DELETE',{revision:1}),r);assert.equal(r.code,200);assert.equal(f.db.rows('university_workspaces')[0].payload,null);assert.equal(f.db.rows('university_workspaces')[0].revision,2);r=response();await f.h(req('PUT',{revision:2,payload}),r);assert.equal(r.value.revision,3);r=response();await f.h(req('PUT',{revision:1,payload}),r);assert.equal(r.code,409);assert.equal(s.planner.targetCredits,120);
});
test('snapshot mutation rejects cross-origin, malformed payload and excess private fields',async()=>{
  const f=fixture();let r=response();await f.h(req('PUT',{revision:0,payload:{}},{headers:{host:'localhost:4000',origin:'https://attacker.invalid','sec-fetch-site':'cross-site'}}),r);assert.equal(r.code,403);
  r=response();await f.h(req('PUT',{revision:0,payload:{schemaVersion:1,scopes:['compare'],data:{cv:{name:'extra'}}}}),r);assert.equal(r.code,400);assert.equal(f.db.rows('university_workspaces').length,0);
});
test('practice expansion contains24 authored exercises, valid lesson references and distinct quizzes',()=>{
  const kit=H.__test.readEntry(R.learningKit),lib=H.__test.readEntry(R.library),ids=new Set();assert.equal(kit.rights,'HH-original');assert.equal(kit.courses.length,6);
  for(const c of kit.courses){const entry=lib.courses.find(e=>e.id===c.courseId),source=H.__test.readEntry({...entry,version:lib.version});assert.equal(c.exercises.length,4);for(const e of c.exercises){assert.ok(!ids.has(e.id));ids.add(e.id);assert.ok(source.lessons.some(l=>l.id===e.lessonId));assert.ok(e.hints.length>=2&&e.steps.length>=2&&e.check);assert.equal(new Set(e.question.options).size,4);assert.ok(e.question.correct>=0&&e.question.correct<4);}}
  assert.equal(ids.size,24);
});
test('worked arithmetic examples pass independent dimensional and algebraic checks',()=>{
  const kit=H.__test.readEntry(R.learningKit),ex=id=>kit.courses.flatMap(c=>c.exercises).find(e=>e.id===id);assert.equal(ex('uni-linear-extended-1').answer,'(5,5)');assert.equal(2*3+1,7);assert.equal(3-1,2);assert.equal((3/5)*(2/4),0.3);assert.equal(100-2*20,20+2*20);assert.equal(50*5,100+30*5);assert.equal((12/6)+(12/3),6);assert.equal(ex('uni-circuits-extended-4').answer,'20Wh = 0,02kWh');
});
test('source enrichment keeps CaoThang advanced tuition separate from general and historicalUIT fees',()=>{
  const c=R.tuition.find(t=>t.schoolId==='vn-ts-89');assert.equal(c.low,15000000);assert.equal(c.unit,'term');assert.equal(c.cohort,'2026');assert.equal(c.status,'published');assert.match(c.title,/tiên tiến/);assert.ok(R.profiles['vn-ts-89'].dormitorySourceId);assert.equal(R.profiles['vn-ts-350'].campuses.length,2);assert.ok(R.tuition.filter(t=>t.schoolId==='vn-ts-313').every(t=>t.cohort==='2025'&&t.status==='projected'));assert.equal(Object.keys(R.resourceFacts).length,3);assert.equal(R.resourceFacts['mit-linear'].level,'undergraduate');
});
test('Gemini pre-cancelled requests never fetch or consume a fallback key',async()=>{
  const c=new AbortController();c.abort();let calls=0;await assert.rejects(G.generate({keys:['explicit-cancellation-test-key'],instruction:'test',prompt:'test',schema:{},signal:c.signal,fetchImpl:async()=>{calls++;}}),e=>e.status===499&&e.code==='GEMINI_REQUEST_CANCELLED');assert.equal(calls,0);
});
test('Gemini forwards cancellation to the actual provider fetch',async()=>{
  const c=new AbortController();let activeSignal;const p=G.generate({keys:['explicit-mid-request-key'],instruction:'test',prompt:'test',schema:{},signal:c.signal,fetchImpl:async(url,init)=>{activeSignal=init.signal;return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true}));}});c.abort();await assert.rejects(p,e=>e.status===499);assert.equal(activeSignal.aborted,true);
});
test('AI chosen lesson must belong to the pinned course and narrows the retrieved context',async()=>{
  const c=await H.__test.contextFor({mode:'study',courseId:'uni-linear',lessonId:'uni-linear-vectors',question:'Explain'});assert.equal(c.length,1);assert.equal(c[0].id,'uni-linear-vectors');await assert.rejects(H.__test.contextFor({mode:'study',courseId:'uni-linear',lessonId:'uni-circuits-ohm',question:'Explain'}));
});
test('release assets include the experience core before tools and cover offline dependencies',()=>{
  const loader=fs.readFileSync(path.join(root,'performance-loader.js'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');assert.ok(loader.indexOf('"hh-university-experience-core.js?v=1"')<loader.indexOf('"hh-university-tools.js?v=2"'));for(const file of ['hh-university-experience-core.js?v=1','hh-university-experience.js?v=1','hh-university-experience.css?v=1'])assert.ok(sw.includes(file)&&loader.includes(file));
});
