'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const core=require('../hh-school-core.js'),workspace=require('../hh-school-workspace.js'),A=require('../hh-school-assessments.js');
const lessons=require('../data/hh-school/curriculum/grade-1.json').lessons;
const initial=mode=>{const s=core.defaultState({currentUser:{id:'planner-student'},profile:{grade:1}});s.activeSubjectId='math';s.studyWorkspace.mode=mode;return s;};

test('foundation, school and advanced recommendations choose the corresponding real course content',()=>{
  for(const [mode,track]of [['foundation','foundation'],['school','standard'],['advanced','advanced']]){
    const s=initial(mode),before=JSON.stringify(s),plan=workspace.learningPlan(s,lessons);
    assert.equal(plan.lesson.track,track);assert.equal(plan.lesson.subjectId,'math');assert.equal(plan.lesson.gradeId,'grade-1');
    assert.match(plan.reason,/bạn đã chọn/);assert.equal(JSON.stringify(s),before);
  }
});

test('review mode uses genuine recorded mistakes and due reviews without inventing a weakness',()=>{
  const s=initial('review'),now=Date.parse('2026-10-27T03:00:00Z'),math=lessons.filter(l=>l.subjectId==='math');
  assert.equal(workspace.learningPlan(s,lessons,now).lesson,null);
  s.mistakes=[{lessonId:math[2].lessonId,occurrences:2}];
  assert.equal(workspace.learningPlan(s,lessons,now).lesson.lessonId,math[2].lessonId);
  s.reviews=[{lessonId:math[0].lessonId,skillId:math[0].questions[0].skillId,dueAt:new Date(now-1).toISOString()}];
  const plan=workspace.learningPlan(s,lessons,now);assert.equal(plan.lesson.lessonId,math[0].lessonId);assert.equal(plan.view,'practice');assert.match(plan.reason,/đến hạn/);
  s.reviews[0].dueAt=new Date(now+86400000).toISOString();assert.equal(workspace.learningPlan(s,lessons,now).lesson.lessonId,math[2].lessonId);
  s.activeSubjectId='vietnamese';assert.equal(workspace.learningPlan(s,lessons,now).lesson,null,'a math error must not create a language recommendation');
});

test('finishing the reading navigation recommends self practice without certifying mastery',()=>{
  const s=initial('school'),first=workspace.learningPlan(s,lessons).lesson;s.activeLessonId=first.lessonId;
  s.progress[first.lessonId]={navigationComplete:true,status:'viewed'};
  const plan=workspace.learningPlan(s,lessons);assert.equal(plan.lesson.lessonId,first.lessonId);assert.equal(plan.view,'practice');assert.deepEqual(s.mastery,{});
});

test('exam mode offers an assessment and uses real submitted mistakes to recommend remediation',()=>{
  const s=initial('exam');assert.equal(workspace.learningPlan(s,lessons).view,'assessments');
  const bank=lessons.filter(l=>l.subjectId==='math').flatMap(l=>l.questions.map(q=>({...q,lessonId:l.lessonId,gradeId:l.gradeId,subjectId:l.subjectId})));
  const blueprint={id:'plan-test',title:'Internal plan test',contentVersion:1,gradeId:'grade-1',subjectId:'math',durationMinutes:5,sections:[{id:'sample',count:4}]};
  const session=A.createSession({bank,blueprint,mode:'mock',ownerId:s.ownerId,learnerProfileId:s.learnerProfileId,now:1000,seed:3});
  const submitted=A.submit(session,{now:2000,gradeQuestion:core.gradeQuestion});
  s.studyWorkspace.examSessions[session.id]=submitted;
  const plan=workspace.learningPlan(s,lessons);assert.ok(plan.examErrors.length);assert.ok(plan.examErrors.includes(plan.lesson.lessonId));assert.match(plan.reason,/thi thử đã nộp/);assert.equal(plan.view,'lesson');
});
