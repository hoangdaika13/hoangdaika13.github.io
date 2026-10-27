'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),C=require('../hh-school-content.js'),base=require('../hh-school-curriculum.js'),core=require('../hh-school-core.js');
const sources=require('../data/hh-school/curriculum/source-index.json');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
test('manifest loads one verifiable grade at a time without claiming official completeness',async()=>{
 assert.equal(C.manifest.grades.length,12);assert.equal(C.manifest.coverage.catalogueSlots,168);
 for(const entry of C.manifest.grades){
  assert.equal(C.peekGrade(entry.grade),null,'importing manifest must not load lesson bodies');
  const bytes=fs.readFileSync(path.join(root,entry.url.split('?')[0]));assert.equal(hash(bytes),entry.sha256);
  assert.ok(entry.url.endsWith('?v='+entry.sha256.slice(0,12)),'cache URL follows actual content');
 }
 const first=await C.loadGrade(1);assert.equal(first.grade,1);assert.equal(C.peekGrade(2),null);
 assert.equal(C.manifest.coverage.complete,false);assert.equal(C.manifest.coverage.officialOutcomeCount,null);
 assert.equal(Object.isFrozen(first),true);assert.equal(Object.isFrozen(first.lessons[0].questions),true);
 await assert.rejects(C.loadGrade(0),/1–12/);await assert.rejects(C.loadGrade(13),/1–12/);
 const controller=new AbortController();controller.abort();await assert.rejects(C.loadGrade(1,{signal:controller.signal}),{name:'AbortError'});
});
test('all authored content has real distinct teaching, separate independent questions and honest editorial state',async()=>{
 const ids=new Set(),bodySignatures=new Set();let total=0;
 for(const grade of base.GRADES){
  const pack=await C.loadGrade(grade.number);assert.equal(C.validatePack(pack,grade.number).ok,true);
  assert.equal(pack.subjects.length,grade.subjects.length);
  for(const lesson of pack.lessons){
   assert.ok(!ids.has(lesson.lessonId));ids.add(lesson.lessonId);total++;
   const body=lesson.steps.find(step=>step.id==='core').body;assert.ok(body.length>=180,lesson.lessonId);
   assert.ok(!bodySignatures.has(body),'entire theory must not be duplicated under another lesson ID: '+lesson.lessonId);bodySignatures.add(body);
   assert.ok(lesson.workedExample.prompt&&lesson.workedExample.answer!==undefined&&lesson.workedExample.method.length>=2,lesson.lessonId);
   assert.equal(lesson.contentStatus,'draft');assert.equal(lesson.reviewerId,null);assert.equal(lesson.reviewedAt,null);assert.equal(base.canPublish(lesson),false);
   assert.ok(lesson.questions.some(q=>q.phase==='practice'));assert.ok(lesson.questions.some(q=>q.phase==='check'));
   const practice=new Set(lesson.questions.filter(q=>q.phase==='practice').map(q=>q.id));assert.ok(lesson.questions.filter(q=>q.phase==='check').every(q=>!practice.has(q.id)));
   assert.ok(!/Đáp án cần đạt/.test(lesson.steps.find(step=>step.id==='quickcheck').body));
   assert.equal(lesson.textbookCrosscheck.status,'not-completed');assert.equal(lesson.durationStatus,'unmeasured-internal-design');
   if(lesson.subjectId==='foreign-1'){
    assert.equal(lesson.language,'en');assert.equal(lesson.listening.mode,'browser-tts');assert.equal(lesson.listening.language,'en-US');assert.ok(/[a-z]/i.test(lesson.listening.transcript));
    if(grade.number<=2)assert.equal(lesson.enrichmentOnly,true);
   }
   for(const ref of lesson.referenceSources){const unit=sources.units.find(unit=>unit.id===ref.unitId);assert.ok(unit,lesson.lessonId);assert.equal(unit.grade,grade.number);assert.equal(ref.pageStart,unit.pageStart);if(ref.page!==null)assert.ok(ref.page>=unit.pageStart&&ref.page<unit.pageEnd,lesson.lessonId);else assert.equal(ref.precision,'grade-section-only');}
  }
  const normal=C.buildLegacyPack(grade.number,base.packForGrade(grade.number));assert.equal(normal.lessons.length,0,'drafts cannot enter the published path');
  const preview=C.buildLegacyPack(grade.number,base.packForGrade(grade.number),{includeDrafts:true});assert.equal(preview.lessons.length,pack.lessons.length);
  assert.equal(preview.archivedLessons.length,base.packForGrade(grade.number).lessons.length,'legacy IDs remain in an archive for migration');
  const first=preview.lessons[0];if(first){first.title='local copy';assert.notEqual(pack.lessons[0].title,'local copy');}
 }
 assert.equal(total,C.manifest.coverage.draftLessons);
});
test('every deterministic authored answer key grades correctly and manual products never fake an automatic mark',async()=>{
 let keys=0,manual=0;
 for(let grade=1;grade<=12;grade++)for(const lesson of (await C.loadGrade(grade)).lessons)for(const question of lesson.questions){
  const result=core.gradeQuestion(question,question.answer??'Một bài tự làm cần đối chiếu rubric.');
  if(['essay','project','scenario','upload','image-mark'].includes(question.type)){
   assert.equal(result.gradingStatus,'pending-review',question.id);assert.equal(result.score,null);assert.equal(result.correct,null);assert.ok(question.rubric?.length,question.id);manual++;
  }else{assert.equal(result.correct,true,question.id);assert.equal(result.score,100);keys++;
   if(question.type==='boolean')assert.equal(core.gradeQuestion(question,question.answer==='true'?'false':'true').correct,false,question.id);
   if(question.grading?.mode==='numeric')assert.equal(core.gradeQuestion(question,'not-a-number').correct,false,question.id);
  }
 }
 assert.ok(keys>100);assert.ok(manual>30);
});
test('source index identifies actual sections and distinguishes unconfigured/local scope',async()=>{
 const geography=sources.units.filter(unit=>unit.subjectFamily==='geography');assert.deepEqual(geography.map(unit=>unit.pageStart),[566,576,585]);
 assert.equal(sources.units.some(unit=>unit.subjectFamily==='physical-education'&&unit.grade===1&&unit.pageStart===1161),true);
 assert.ok(sources.sources.some(source=>source.id==='textbooks'&&source.access==='not-accessed'));
 for(let grade=1;grade<=12;grade++){
  const pack=await C.loadGrade(grade);const local=pack.subjects.find(subject=>subject.id==='local-education');assert.equal(local.status,'needs-local-source');assert.equal(local.coverage.complete,false);
  assert.equal(pack.coverage.officialOutcomeCount,null);
 }
});
test('a reviewed status without reviewer and evidence cannot enter a pack',async()=>{
 const pack=JSON.parse(JSON.stringify(await C.loadGrade(1)));pack.lessons[0].contentStatus='approved';
 const result=C.validatePack(pack,1);assert.equal(result.ok,false);assert.ok(result.errors.some(error=>/bằng chứng/.test(error)));
});
test('malformed imported packs produce validation errors without breaking the error screen',()=>{
 for(const input of [null,{}, {lessons:[null],subjects:null,outcomes:null}, {lessons:'bad',subjects:[],outcomes:[]}]){
  const result=C.validatePack(input,1);assert.equal(result.ok,false);assert.ok(result.errors.length);
 }
});
test('deterministic choice layout preserves the authored correct content and does not create new families',async()=>{
 const folder=path.join(root,'data/hh-school/curriculum');let choices=0;
 for(const file of fs.readdirSync(folder).filter(file=>/^authored-[a-z-]+\.json$/.test(file)))for(const spec of JSON.parse(fs.readFileSync(path.join(folder,file),'utf8'))){
  const lesson=(await C.loadGrade(spec.grade)).lessons.find(lesson=>lesson.lessonId==='g'+spec.grade+'-'+spec.subjectId+'-'+spec.slug);assert.ok(lesson);
  for(const [index,row]of [spec.guided,...spec.questions].entries())if(['single','multiple'].includes(row.type)){
   const actual=lesson.questions[index],oldKey=Array.isArray(row.answer)?row.answer:[row.answer],newKey=Array.isArray(actual.answer)?actual.answer:[actual.answer];
   assert.deepEqual(newKey.map(key=>actual.options[Number(key)]).sort(),oldKey.map(key=>row.options[Number(key)]).sort(),actual.id);
   assert.equal(actual.familyId,lesson.lessonId+'-'+(row.family||(index===0?'guided':row.type)||'short'));choices++;
  }
 }
 assert.ok(choices>50);
});
test('the coverage ledger accounts for every configured grade-subject without hiding gaps',async()=>{
 const ledger=JSON.parse(fs.readFileSync(path.join(root,'docs/education/hh-school-curriculum-coverage-2026-10-27.json'),'utf8'));
 assert.equal(ledger.rows.length,168);assert.deepEqual(ledger.coverage,C.manifest.coverage);
 assert.equal(ledger.sourceSectionLocators,sources.units.length);
 const slots=new Set();let lessons=0,questions=0,withDrafts=0;
 for(const grade of base.GRADES){
  const pack=await C.loadGrade(grade.number);
  for(const subject of grade.subjects){
   const slot=grade.number+':'+subject.id;assert.ok(!slots.has(slot));slots.add(slot);
   const row=ledger.rows.find(row=>row.grade===grade.number&&row.subjectId===subject.id);assert.ok(row,slot);
   const items=pack.lessons.filter(lesson=>lesson.subjectId===subject.id),count=items.reduce((sum,lesson)=>sum+lesson.questions.length,0);
   assert.equal(row.draftLessons,items.length,slot);assert.equal(row.questions,count,slot);
   assert.equal(row.publishedLessons,0);assert.equal(row.officialOutcomeCount,null);assert.ok(row.gaps.length>=2);
   assert.equal(Object.values(row.tracks).reduce((sum,count)=>sum+count,0),items.length,slot);
   if(row.source)assert.ok(sources.units.some(unit=>unit.id===row.source.unitId&&unit.grade===grade.number),slot);
   for(const ref of row.sources)assert.ok(sources.units.some(unit=>unit.id===ref.unitId&&unit.grade===grade.number),slot);
   if(subject.id==='informatics-technology')assert.deepEqual([...new Set(row.sources.map(ref=>ref.subjectFamily))].sort(),['informatics','technology']);
   if(subject.id==='technology'&&grade.number>=10)assert.deepEqual(row.sources.map(ref=>ref.strand).sort(),['agricultural','industrial']);
   lessons+=items.length;questions+=count;withDrafts+=items.length>0?1:0;
  }
 }
 assert.equal(lessons,C.manifest.coverage.draftLessons);assert.equal(withDrafts,C.manifest.coverage.subjectsWithDrafts);
 assert.ok(questions>=lessons*3);
});
