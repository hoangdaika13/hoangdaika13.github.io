'use strict';
// Original Vietnamese learning sequences. External sources are references only.
const VERSION='2026.10.28-university-v1';
const choice=(prompt,options,answer,explanation)=>({type:'mcq',gradingMode:'selection',prompt,options,answer,explanation});
const numeric=(prompt,answer,explanation)=>({type:'short',gradingMode:'numeric',grading:{mode:'numeric',tolerance:0.000001},prompt,answer,tolerance:0.000001,explanation});
const essay=(prompt,rubric,explanation)=>({type:'essay',gradingMode:'rubric',prompt,rubric:rubric.map((text,i)=>({id:'criterion-'+i,text,points:1})),explanation});
function lesson(id,title,objective,theory,worked,activity,misconception,questions){return{id,title,objective,theory,worked,activity,misconception,questions};}
function course(input){
  const lessons=input.lessons.map((l,i)=>({...l,id:input.id+'-'+l.id,prerequisites:i?[input.id+'-'+input.lessons[i-1].id]:[],outcomeId:input.id+'-o'+(i+1),questions:l.questions.map((q,j)=>({...q,id:input.id+'-'+l.id+'-q'+(j+1),familyId:input.id+'-'+l.id+'-f'+j,lessonId:input.id+'-'+l.id,gradeId:'university',subjectId:input.id,outcomeIds:[input.id+'-o'+(i+1)],cognitiveLevel:j?'apply':'understand',difficulty:j+1,points:1,contentStatus:'draft'}))}));
  const outcomes=lessons.map(l=>({id:l.outcomeId,text:l.objective}));
  const diagnostic=input.diagnostic.map((q,i)=>({...q,id:input.id+'-entry-q'+i,familyId:input.id+'-entry-f'+i,lessonId:lessons[Math.min(i,lessons.length-1)].id,outcomeIds:[outcomes[Math.min(i,outcomes.length-1)].id],gradeId:'university',subjectId:input.id,difficulty:1,cognitiveLevel:'understand',points:1,contentStatus:'draft'}));
  return{schemaVersion:1,version:VERSION,contentStatus:'draft',reviewEvidence:null,credits:null,officialComplete:false,authorship:'HH School — nội dung nguyên bản chờ thẩm định',...input,lessons,outcomes,diagnostic,blueprint:{id:input.id+'-final',gradeId:'university',subjectId:input.id,title:'Tự kiểm tra: '+input.title,contentVersion:VERSION,durationMinutes:30,contentStatus:'draft',sections:outcomes.map((o,i)=>({id:'unit-'+i,count:2,outcomeIds:[o.id]}))}};
}
module.exports={VERSION,choice,numeric,essay,lesson,course};
