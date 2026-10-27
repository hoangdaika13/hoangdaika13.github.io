'use strict';
// Deterministic compilation of authored records. Does not invent lessons,
// review approvals, official coverage percentages, or textbook references.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'data/hh-school/curriculum');
const base=require('../hh-school-curriculum.js');
const sourceIndex=JSON.parse(fs.readFileSync(path.join(folder,'source-index.json'),'utf8'));
const VERSION='2026.10.27-authored-drafts-v1',DATE='2026-10-27';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const slug=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const authored=fs.readdirSync(folder).filter(name=>/^authored-[a-z-]+\.json$/.test(name)).sort().flatMap(name=>{
  const rows=JSON.parse(fs.readFileSync(path.join(folder,name),'utf8'));
  if(!Array.isArray(rows))throw Error(name+' must contain authored lesson records');
  return rows.map(row=>({...row,authoredFile:'data/hh-school/curriculum/'+name}));
});
const familyFor=(subject,grade)=>subject==='vietnamese'||subject==='literature'?'language':subject==='ethics'||subject==='civic'||subject==='economics-law'?'civic':subject==='history-geography'?(grade<6?'primary-history-geography':'lower-history-geography'):subject==='experience-career'?'experience':subject==='informatics-technology'?'informatics':subject;
function sourceUnit(subject,grade,page){const candidates=sourceIndex.units.filter(unit=>unit.subjectFamily===familyFor(subject,grade)&&unit.grade===grade);return(page?candidates.find(unit=>page>=unit.pageStart&&page<unit.pageEnd):candidates[0])||null;}
function subjectSourceRefs(subject,grade){const families=subject==='informatics-technology'?['informatics','technology']:[familyFor(subject,grade)];return sourceIndex.units.filter(unit=>families.includes(unit.subjectFamily)&&unit.grade===grade).map(unit=>({sourceId:unit.sourceId,unitId:unit.id,subjectFamily:unit.subjectFamily,strand:unit.strand||null,pageStart:unit.pageStart,pageEnd:unit.pageEnd,precision:'grade-section-only'}));}
const original={sourceUrl:'https://hoang8.com/#/learn/library',sourceTitle:'HH School — bản biên soạn nguyên bản đang đối chiếu chương trình',publisher:'HH Platform',licenseCode:'HH-ORIGINAL',licenseUrl:'https://hoang8.com/terms.html',attribution:'Nội dung giải thích, ví dụ và bài tập do hệ thống HH School biên soạn; chưa được người thẩm định chuyên môn phê duyệt.',retrievedAt:DATE,reviewedAt:null,reviewerId:null,allowedForCommercialUse:true,allowedToModify:true,evidencePath:'docs/education/hh-school-content-sources-2026-10-27.md'};
const seen=new Set(),grades=[],ledger=[];
for(const grade of base.GRADES){
  const specs=authored.filter(row=>row.grade===grade.number),lessons=[],outcomes=[],subjects=[];
  for(const spec of specs){
    if(!grade.subjects.some(subject=>subject.id===spec.subjectId))throw Error('Unknown grade–subject: '+spec.grade+' '+spec.subjectId);
    const id='g'+grade.number+'-'+spec.subjectId+'-'+spec.slug;
    if(seen.has(id))throw Error('Duplicate authored ID '+id);seen.add(id);
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(spec.slug)||!spec.title||!Array.isArray(spec.theory)||spec.theory.join(' ').length<180||!spec.example?.method?.length||!spec.guided?.prompt||!Array.isArray(spec.questions)||spec.questions.length<2||!spec.application||!spec.summary)throw Error('Incomplete authored lesson '+id);
    const unit=sourceUnit(spec.sourceFamily||spec.subjectId,grade.number,spec.sourcePage),outcomeId=id+'-outcome',chapterId='g'+grade.number+'-'+spec.subjectId+'-'+slug(spec.chapter||spec.title);
    const sourceRef=unit?{sourceId:unit.sourceId,unitId:unit.id,page:spec.sourcePage||null,pageStart:unit.pageStart,pageEnd:unit.pageEnd,precision:spec.sourcePage?'located-page':'grade-section-only'}:null;
    outcomes.push({id:outcomeId,subjectId:spec.subjectId,text:spec.outcome,status:unit?'source-aligned-draft':'needs-programme-source',sourceRef,officialRequirementId:null,reviewed:false,scope:spec.track==='advanced'?'authored-extension':'authored-subset'});
    const question=(row,index,phase)=>{
      if(!row.prompt||!row.explanation)throw Error('Question without prompt/explanation '+id+' '+index);
      if(!['essay','scenario','project','upload','image-mark'].includes(row.type)&&row.answer===undefined)throw Error('Question without marking key '+id+' '+index);
      const normalized={...row},questionId=id+'-q'+(index+1);
      // Rotate answer positions once, deterministically, without inventing new
      // question families or pretending a reordered item is fresh content.
      if(['single','multiple'].includes(row.type)){
        if(!Array.isArray(row.options)||row.options.length<2)throw Error('Choice question without alternatives '+questionId);
        const offset=parseInt(sha(questionId).slice(0,8),16)%row.options.length;
        normalized.options=row.options.map((_,i)=>row.options[(i+offset)%row.options.length]);
        const newIndex=value=>String((Number(value)-offset+row.options.length)%row.options.length);
        normalized.answer=row.type==='multiple'?(Array.isArray(row.answer)?row.answer:String(row.answer).split(',')).map(newIndex):newIndex(row.answer);
        if(row.distractorRationale&&typeof row.distractorRationale==='object')normalized.distractorRationale=Object.fromEntries(Object.entries(row.distractorRationale).map(([key,value])=>[newIndex(key),value]));
      }
      return {...normalized,id:questionId,gradeId:grade.id,subjectId:spec.subjectId,lessonId:id,skillId:outcomeId,outcomeId,familyId:id+'-'+(row.family||row.type||'short'),phase,contentVersion:1,contentStatus:'draft',source:original,cognitiveLevel:row.cognitiveLevel||(phase==='practice'?'thông hiểu':'vận dụng'),difficulty:row.difficulty||(spec.track==='advanced'?4:spec.track==='foundation'?1:2),hintSteps:row.hints||[],helpLevel:phase==='practice'?1:0};
    };
    const guided={type:spec.guided.type||'short',grading:spec.guided.grading||{},...spec.guided,cognitiveLevel:'thông hiểu',family:'guided'};
    const questions=[question(guided,0,'practice'),...spec.questions.map((row,index)=>question(row,index+1,'check'))];
    const steps=[
      {id:'warmup',label:'Khởi động',body:spec.warmup||'Trước khi xem ví dụ, hãy thử diễn đạt: '+spec.outcome},
      {id:'goal',label:'Mục tiêu và kiến thức nền',body:spec.outcome+'\n\nKiến thức cần có: '+(spec.prerequisiteText||'Đọc dữ kiện của bài; có thể quay lại phần bù nền tảng trong cùng môn.')},
      {id:'core',label:'Kiến thức cốt lõi',body:spec.theory.join('\n\n')+(spec.terms?.length?'\n\nThuật ngữ: '+spec.terms.map(item=>item.term+': '+item.meaning).join('; '):'')},
      {id:'guided',label:'Ví dụ giải từng bước',body:spec.example.introduction||'Đọc đề, theo dõi từng bước rồi đối chiếu lý do; sau đó tự làm bài luyện với dữ kiện khác.'},
      {id:'interactive',label:'Quan sát và thực hành',body:spec.interactive||spec.application,diagram:spec.diagram||null},
      {id:'practice',label:'Luyện có hướng dẫn',body:spec.guided.prompt+'\n\nGợi ý theo mức: '+(spec.guided.hints||[]).join(' → ')},
      {id:'apply',label:'Vận dụng',body:spec.application},
      {id:'quickcheck',label:'Tự làm độc lập',body:'Đóng phần ví dụ và tự giải các câu dưới đây. Đáp án hoặc rubric chỉ dùng để đối chiếu sau khi bạn đã thử. Nội dung đang chờ thẩm định chuyên môn.'},
      {id:'summary',label:'Tóm tắt và sửa hiểu nhầm',body:spec.summary},
      {id:'next',label:'Ôn lại và học tiếp',body:'Sau một khoảng nghỉ, giải thích lại bằng lời của bạn: '+spec.outcome+'\nLưu câu hỏi còn vướng trong ghi chú; lần ôn sau thử câu độc lập trước khi mở lời giải.'}
    ];
    lessons.push({gradeId:grade.id,subjectId:spec.subjectId,topicId:chapterId,chapterId,lessonId:id,title:spec.title,outcome:spec.outcome,outcomeIds:[outcomeId],semester:spec.semester||1,semesterBasis:'Phân bổ học kỳ nội bộ dự kiến; không thay kế hoạch nhà trường.',track:spec.track||'standard',difficulty:{foundation:'Bù nền tảng',standard:'Chuẩn chương trình',advanced:'Nâng cao'}[spec.track||'standard'],enrichmentOnly:spec.enrichmentOnly===true,language:spec.language||null,listening:spec.listening||null,prerequisites:spec.prerequisites||[],prerequisiteText:spec.prerequisiteText||'',estimatedMinutes:spec.estimatedMinutes||null,durationStatus:'unmeasured-internal-design',contentStatus:'draft',editorialStatus:'needs-subject-review',reviewedAt:null,reviewerId:null,source:{...original,evidencePath:spec.authoredFile},referenceSources:sourceRef?[sourceRef]:[],additionalDraftReferences:spec.factualReferences||[],alignmentStatus:unit?'draft-subset-source-section-located':'requires-specific-programme-source',textbookCrosscheck:{status:'not-completed',editions:[]},speaker:'HH School',steps,workedExample:spec.example,commonMistakes:spec.mistakes||[],questions,mission:{id:id+'-activity',title:'Thực hành và tự đối chiếu',prompt:spec.application,status:'draft'},diagram:spec.diagram||null,terms:spec.terms||[],formulas:spec.formulas||[],rubric:spec.rubric||[],contentVersion:1,authoredFile:spec.authoredFile});
  }
  for(const subject of grade.subjects){
    const unit=sourceUnit(subject.id,grade.number),sourceRefs=subjectSourceRefs(subject.id,grade.number),items=lessons.filter(lesson=>lesson.subjectId===subject.id),chapterMap=new Map();
    for(const lesson of items){if(!chapterMap.has(lesson.chapterId))chapterMap.set(lesson.chapterId,{id:lesson.chapterId,title:specs.find(spec=>'g'+grade.number+'-'+spec.subjectId+'-'+spec.slug===lesson.lessonId)?.chapter||lesson.title,semester:lesson.semester,outcomeIds:[],lessonIds:[]});const chapter=chapterMap.get(lesson.chapterId);chapter.outcomeIds.push(...lesson.outcomeIds);chapter.lessonIds.push(lesson.lessonId);}
    const status=subject.id==='local-education'?'needs-local-source':['ethnic-language','foreign-2'].includes(subject.id)?'optional-language-unconfigured':items.length?'authored-subset':unit?'source-indexed-no-lessons':'programme-source-needed';
    subjects.push({id:subject.id,name:subject.name,optional:subject.optional,strands:subject.strands,description:status==='needs-local-source'?'Cần chọn tỉnh/thành và đúng tài liệu địa phương đã được phê duyệt; chưa có bài địa phương chung cho toàn quốc.':status==='optional-language-unconfigured'?'Cần xác định ngôn ngữ và chương trình phù hợp trước khi biên soạn.':unit?'Đã định vị phần chương trình môn học theo lớp; các bài dưới đây chỉ là phần đang biên soạn, chưa phải độ phủ đầy đủ.':'Chưa có phần nguồn chương trình được xác minh cho cấu hình này.',status,sourceRef:sourceRefs.find(ref=>ref.unitId===unit?.id)||null,sourceRefs,chapters:[...chapterMap.values()],coverage:{authoredLessons:items.length,publishedLessons:0,authoredOutcomes:items.length,officialOutcomeCount:null,complete:false},gaps:[...(items.length?[]:['Chưa có bài biên soạn cho môn–lớp này.']),'Chưa kiểm kê và đối chiếu đầy đủ từng yêu cầu cần đạt hiện hành.','Chưa có thẩm định chuyên môn hoặc đối chiếu đầy đủ ấn bản sách giáo khoa/sách nâng cao.',...(['informatics-technology','informatics','technology'].includes(subject.id)?['Chưa biên soạn, đối chiếu đầy đủ từng mạch/nhánh và chuyên đề của môn.']:[]),...(['history-geography','history','geography','economics-law'].includes(subject.id)?['Cần đối chiếu sửa đổi TT13/2022 và TT17/2025 đúng phần áp dụng.']:[])]});
  }
  for(const subject of subjects){const items=lessons.filter(lesson=>lesson.subjectId===subject.id);ledger.push({grade:grade.number,subjectId:subject.id,name:subject.name,required:!subject.optional,status:subject.status,draftLessons:items.length,questions:items.reduce((n,lesson)=>n+lesson.questions.length,0),tracks:Object.fromEntries(['foundation','standard','advanced'].map(track=>[track,items.filter(lesson=>lesson.track===track).length])),source:subject.sourceRef,sources:subject.sourceRefs,publishedLessons:0,officialOutcomeCount:null,gaps:subject.gaps});}
  const coverage={catalogueSlots:subjects.length,subjectsWithDrafts:subjects.filter(subject=>subject.coverage.authoredLessons).length,draftLessons:lessons.length,publishedLessons:0,authoredOutcomeCount:outcomes.length,officialOutcomeCount:null,complete:false};
  const pack={schemaVersion:1,contentVersion:VERSION,grade:grade.number,subjects,outcomes,lessons,sources:[original,...sourceIndex.sources],coverage};
  const serialized=JSON.stringify(pack,null,2)+'\n',filename='grade-'+grade.number+'.json';fs.writeFileSync(path.join(folder,filename),serialized);
  grades.push({grade:grade.number,url:'data/hh-school/curriculum/'+filename+'?v='+sha(serialized).slice(0,12),sha256:sha(serialized),bytes:Buffer.byteLength(serialized),coverage,subjects:subjects.map(subject=>({id:subject.id,name:subject.name,status:subject.status,chapters:subject.chapters.map(chapter=>({id:chapter.id,title:chapter.title,semester:chapter.semester,lessonIds:chapter.lessonIds}))})),lessons:lessons.map(lesson=>({id:lesson.lessonId,subjectId:lesson.subjectId,title:lesson.title,track:lesson.track,contentStatus:lesson.contentStatus}))});
}
const coverage={grades:12,catalogueSlots:grades.reduce((n,grade)=>n+grade.coverage.catalogueSlots,0),subjectsWithDrafts:grades.reduce((n,grade)=>n+grade.coverage.subjectsWithDrafts,0),draftLessons:seen.size,publishedLessons:0,officialOutcomeCount:null,complete:false};
const manifest={schemaVersion:1,version:VERSION,builtAt:DATE,coverage,grades};
fs.writeFileSync(path.join(root,'hh-school-content-manifest.js'),"(function(scope){'use strict';const data="+JSON.stringify(manifest)+";scope.HHSchoolContentManifest=data;if(typeof module==='object'&&module.exports)module.exports=data;})(typeof globalThis!=='undefined'?globalThis:this);\n");
fs.writeFileSync(path.join(folder,'coverage.json'),JSON.stringify({version:VERSION,coverage,grades:grades.map(grade=>({grade:grade.grade,...grade.coverage,subjects:JSON.parse(fs.readFileSync(path.join(folder,'grade-'+grade.grade+'.json'))).subjects.map(subject=>({id:subject.id,status:subject.status,...subject.coverage,gaps:subject.gaps}))}))},null,2)+'\n');
fs.writeFileSync(path.join(root,'docs/education/hh-school-curriculum-coverage-2026-10-27.json'),JSON.stringify({version:VERSION,coverage,officialOutcomeCount:null,sourceSectionLocators:sourceIndex.units.length,rows:ledger},null,2)+'\n');
const lines=['# HH School — ma trận nội dung ngày 27/10/2026','','Sinh từ nguồn biên soạn bằng `node scripts/build-hh-school-content.js`. Một dòng cho mỗi cấu hình lớp–môn/hoạt động trong catalog hiện có; không suy ra đây là toàn bộ yêu cầu cần đạt chính thức.','','- '+coverage.draftLessons+' bản ghi bài nguyên bản đang chờ thẩm định; '+coverage.subjectsWithDrafts+'/'+coverage.catalogueSlots+' cấu hình có bài biên soạn.','- 0 bài đã được người thẩm định phê duyệt; không có phần trăm độ phủ giáo trình chính thức.','- '+sourceIndex.units.length+' vị trí phần chương trình đã định vị trong bản lưu văn bản; đây không phải số yêu cầu cần đạt.','- Các số B/C/N là số bài bù nền tảng/chuẩn/nâng cao nội bộ, không phải số tiết quy định.','','| Lớp | Môn/hoạt động | Bài nháp | Câu | B/C/N | Vị trí phần nguồn | Trạng thái |','| --- | --- | ---: | ---: | --- | --- | --- |'];
for(const row of ledger)lines.push('| '+row.grade+' | '+row.name+' | '+row.draftLessons+' | '+row.questions+' | '+Object.values(row.tracks).join('/')+' | '+(row.sources.length?row.sources.map(ref=>'PDF '+ref.pageStart+'–'+ref.pageEnd+(ref.strand?' ('+ref.strand+')':'')).join('; '):'Cần nguồn riêng')+' | '+row.status+' |');
lines.push('','## Giới hạn phải giữ khi phát hành','','Mỗi cấu hình vẫn thiếu đối chiếu đầy đủ từng yêu cầu cần đạt và thẩm định chuyên môn. Bài đã có là một phần biên soạn, không đủ để tuyên bố học trọn chương trình, hoàn thành bộ sách hoặc bảo đảm sẵn sàng thi thật. Giáo dục địa phương cần tỉnh/thành; ngôn ngữ tự chọn và tiếng dân tộc cần chọn chương trình/ngôn ngữ cụ thể. Quốc phòng–an ninh cần đối chiếu nguồn riêng. Các chuyên đề THPT, điều chỉnh hiện hành, ấn bản SGK/sách nâng cao và phần chưa biên soạn được giữ trong danh sách khoảng trống.','','Xem hồ sơ nguồn: [hh-school-content-sources-2026-10-27.md](hh-school-content-sources-2026-10-27.md).');
fs.writeFileSync(path.join(root,'docs/education/hh-school-curriculum-coverage-2026-10-27.md'),lines.join('\n')+'\n');
console.log(JSON.stringify(coverage));
