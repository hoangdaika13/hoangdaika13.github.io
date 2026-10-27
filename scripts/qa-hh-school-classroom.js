'use strict';
// Real HH School DOM, native IndexedDB and production education handlers.
// Authentication and MongoDB transport are explicit, isolated QA doubles.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {ObjectId}=require('mongodb');
const {chromium}=require(process.env.HH_QA_PLAYWRIGHT||'playwright');
const {createEducationMemoryDB}=require('../tests/helpers/hh-school-memory-db.js');
const handlers=require('../utils/education-handler.js').__test;
const repo=path.resolve(__dirname,'..'),out=path.resolve(repo,process.env.HH_QA_OUTPUT||'.study-local/hh-school-classroom-1065');
const assets=['hh-school-curriculum','hh-school-offline','hh-school-core','hh-school-sync','hh-school-assessments','hh-school-content-manifest','hh-school-content','hh-school-workspace','hh-school'];
const identities={teacher:{id:'qa-teacher',_id:'qa-teacher',name:'QA teacher',educationRole:'teacher',roles:['teacher']},student:{id:'qa-student',_id:'qa-student',name:'QA student',educationRole:'student',roles:['student']},outsider:{id:'qa-outsider',_id:'qa-outsider',name:'QA outsider',educationRole:'student',roles:['student']}};
const db=createEducationMemoryDB(),results=[],errors=[],apiCalls=[];
const csp=JSON.parse(fs.readFileSync(path.join(repo,'vercel.json'),'utf8')).headers.flatMap(row=>row.headers).find(row=>row.key==='Content-Security-Policy').value;
let browser,teacher,student,origin;
const userFor=req=>identities[/\bqaSchoolRole=([^;]+)/.exec(req.headers.cookie||'')?.[1]]||null;
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://local'),name=decodeURIComponent(url.pathname);res.setHeader('Cache-Control','no-store');
  if(name==='/api/auth/me'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({user:userFor(req)}));}
  if(name.startsWith('/api/education/')){
    const resource=name.split('/').at(-1),handler=handlers[resource],user=userFor(req);res.setHeader('Content-Type','application/json');
    if(!user)return res.writeHead(401).end(JSON.stringify({error:'Explicit QA identity required'}));
    if(!handler)return res.writeHead(503).end(JSON.stringify({error:'QA does not double this service: '+resource}));
    let text='';for await(const chunk of req)text+=chunk;
    const body=text?JSON.parse(text):{},query=Object.fromEntries(url.searchParams);
    const response={status(code){res.statusCode=code;return response;},json(data){apiCalls.push({resource,method:req.method,actor:user.id,status:res.statusCode||200});res.end(JSON.stringify(data));return data;}};
    try{return await handler({method:req.method,query,headers:req.headers,url:req.url},response,db,{...user,_id:user.id},body);}catch(error){res.statusCode=error.statusCode||500;apiCalls.push({resource,method:req.method,actor:user.id,status:res.statusCode,error:error.message});return res.end(JSON.stringify({error:error.message,code:error.code}));}
  }
  if(name.startsWith('/api/'))return res.writeHead(503).end();
  if(name==='/bootstrap.js'){res.setHeader('Content-Type','text/javascript');return res.end('window.qaIdentities='+JSON.stringify(identities)+';window.qaIdentity=qaIdentities[/\\bqaSchoolRole=([^;]+)/.exec(document.cookie)?.[1]];function qaMount(){window.qaSchool=HHSchool.mount(document.querySelector("#probe"),{view:location.hash.split("/")[2]||"today",currentUser:qaIdentity});}window.addEventListener("hashchange",qaMount);qaMount();');}
  if(name==='/probe.html'){res.setHeader('Content-Type','text/html');res.setHeader('Content-Security-Policy',csp);return res.end('<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/hh-school.css"><link rel="stylesheet" href="/hh-school-workspace.css"></head><body style="margin:0;background:#091522"><main id="probe"></main>'+assets.map(file=>'<script src="/'+file+'.js"></script>').join('')+'<script src="/bootstrap.js"></script></body></html>');}
  const file=path.resolve(repo,'.'+name);if(!file.startsWith(repo+path.sep)||name.split('/').some(part=>part.startsWith('.')||['api','utils','node_modules'].includes(part)))return res.writeHead(403).end();
  if(!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();res.setHeader('Content-Type',({'.js':'text/javascript','.json':'application/json','.css':'text/css','.html':'text/html'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
async function saved(page){await page.evaluate(async()=>{await qaSchool.store.ready;await qaSchool.store.whenSaved();});}
async function route(page,view){await page.evaluate(value=>location.hash='#/learn/'+value,view);await page.waitForFunction(value=>qaSchool.view===value,view);await saved(page);}
async function identityPage(role){const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:2,reducedMotion:'reduce',serviceWorkers:'block'});await context.addCookies([{name:'qaSchoolRole',value:role,url:origin}]);const page=await context.newPage();page.on('pageerror',error=>errors.push(role+': '+error.message));await page.goto(origin+'/probe.html#/learn/today');await saved(page);await page.locator('[data-hsw-preview]').first().waitFor();return page;}
async function chooseGrade(page,grade){await route(page,'paths');await page.locator('[data-school-grade="'+grade+'"]').click();await saved(page);await route(page,'today');await page.waitForFunction(value=>HHSchoolContent.peekGrade(value)!==null,grade);}
async function noOverflow(page,label){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow: '+label);}
async function run(){
  fs.mkdirSync(out,{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.HH_QA_CHROMIUM});teacher=await identityPage('teacher');await chooseGrade(teacher,6);
    await teacher.locator('[data-hsw-preview]').first().click();await saved(teacher);await route(teacher,'teacher');await teacher.locator('[data-teacher-create-class]').click();
    const create=teacher.locator('[data-class-create]');await create.locator('[name=name]').fill('QA lớp 6 · giải thích có bằng chứng');await create.locator('[name=grade]').fill('6');await create.locator('button[value=default]').click();
    await teacher.waitForFunction(()=>qaSchool.store.get().classes.some(row=>row.syncStatus==='synced'));const classId=String(db.rows('education_classes')[0]._id);
    await teacher.locator('[data-hsw-teacher-class]').selectOption(classId);await teacher.locator('[data-hsw-teacher-assign]').waitFor();
    const assignmentForm=teacher.locator('[data-hsw-teacher-assign]');await assignmentForm.locator('[name=title]').fill('Giải thích cách kiểm tra thông tin và nêu giới hạn');
    const lessonId=await assignmentForm.locator('[name=lessonId] option').nth(1).getAttribute('value');assert.ok(lessonId);await assignmentForm.locator('[name=lessonId]').selectOption(lessonId);
    const future=new Date(Date.now()+86400000),localDue=[future.getFullYear(),String(future.getMonth()+1).padStart(2,'0'),String(future.getDate()).padStart(2,'0')].join('-')+'T12:00';await assignmentForm.locator('[name=dueAt]').fill(localDue);await assignmentForm.locator('button[type=submit]').click();
    await teacher.waitForFunction(()=>document.querySelectorAll('[data-hsw-teacher-assign] input[name=title]').length>0);assert.equal(db.rows('education_assignments').length,1);const assignment=db.rows('education_assignments')[0],assignmentId=String(assignment._id);
    assert.deepEqual(assignment.lessonIds,[lessonId]);
    // Enrollment is the only classroom operation seeded directly: the invite/auth
    // transport is outside this probe; submission still checks this exact row.
    await db.collection('education_enrollments').insertOne({classId:new ObjectId(classId),learnerOwnerId:'qa-student',learnerProfileId:'learner-1',status:'active'});
    results.push({teacher:'DOM class creation and assignment with a real lesson ID',handlers:'Production classes/assignments handlers',enrollment:'Explicit QA database seed for the student, not a claimed invite integration test'});

    student=await identityPage('student');await chooseGrade(student,6);const form=()=>student.locator('[data-hsw-assignment="'+assignmentId+'"]');await form().waitFor();
    const original='Em kiểm tra người chịu trách nhiệm và ngày của thông tin.\n\nNếu chưa có nguồn phù hợp, em chưa kết luận nội dung đúng.';
    await form().locator('textarea[name=answer]').fill(original);await student.waitForFunction(({id,text})=>qaSchool.store.get().submissions.some(row=>String(row.assignmentId)===id&&row.answer===text&&row.status==='draft-device'),{id:assignmentId,text:original});await saved(student);await student.reload();await saved(student);await form().waitFor();assert.equal(await form().locator('textarea[name=answer]').inputValue(),original);
    await form().locator('button[type=submit]').click();await student.waitForFunction(()=>qaSchool.store.get().submissions.some(row=>row.answerRevision===1));assert.equal(db.rows('education_submissions')[0].answer,original);
    const revised='Bản sửa: em đối chiếu nguồn chính thức, thời điểm và phạm vi áp dụng.\n\nGiới hạn: một ảnh chụp không xác nhận toàn bộ bối cảnh.';
    await form().locator('textarea[name=answer]').fill(revised);await student.waitForFunction(({id,text})=>qaSchool.store.get().submissions.some(row=>String(row.assignmentId)===id&&row.answer===text&&row.status==='draft-device'),{id:assignmentId,text:revised});await saved(student);assert.equal(await student.evaluate(async id=>{const s=qaSchool.store.get(),row=await HHSchoolOffline.loadProfile(s.ownerId,s.learnerProfileId);return row.state.submissions.find(x=>String(x.assignmentId)===id)?.answer;},assignmentId),revised);await student.reload();await saved(student);await form().waitFor();assert.equal(await form().locator('textarea[name=answer]').inputValue(),revised);assert.equal(db.rows('education_submissions')[0].answer,original,'An unsent device draft cannot overwrite the server');
    results.push({student:'Original paragraphs survive draft reload; first submit becomes revision1; a newer device draft survives GET of the older server answer'});

    await teacher.locator('[data-hsw-teacher-refresh]').click();await teacher.locator('[data-hsw-grade]').waitFor();assert.equal(await teacher.locator('.hsw-student-answer').first().innerText(),original);
    const grade=teacher.locator('[data-hsw-grade]');await grade.locator('[name=score]').fill('72');await grade.locator('[name=feedback]').fill('Đã nêu nguồn.\nHãy bổ sung giới hạn của bằng chứng.');await grade.locator('[name=redo]').check();await grade.locator('button[type=submit]').click();await teacher.waitForFunction(()=>document.querySelector('[data-hsw-grade] input[name=score]')?.value==='72');
    assert.equal(db.rows('education_submissions')[0].status,'redo-required');assert.match(db.rows('education_submissions')[0].feedback,/\n/);
    await student.reload();await saved(student);await form().waitFor();assert.equal(await form().locator('textarea[name=answer]').inputValue(),revised);await student.getByText('Hãy bổ sung giới hạn của bằng chứng.',{exact:false}).waitFor();
    await form().locator('button[type=submit]').click();await student.waitForFunction(()=>qaSchool.store.get().submissions.some(row=>row.answerRevision===2));assert.equal(db.rows('education_submissions')[0].answer,revised);assert.equal(db.rows('education_submissions')[0].history[0].score,72);assert.equal(db.rows('education_submissions')[0].history[0].answer,original);
    const submissionId=String(db.rows('education_submissions')[0]._id),stale=await teacher.request.patch(origin+'/api/education/submissions',{data:{submissionId,answerRevision:1,score:0}});assert.equal(stale.status(),409);
    await teacher.locator('[data-hsw-teacher-refresh]').click();await teacher.locator('[data-hsw-grade][data-answer-revision="2"]').waitFor();const grade2=teacher.locator('[data-hsw-grade]');await grade2.locator('[name=score]').fill('91');await grade2.locator('[name=feedback]').fill('Bản sửa đã phân biệt nguồn và giới hạn.');await grade2.locator('button[type=submit]').click();
    await student.reload();await saved(student);await form().waitFor();await student.getByText('Bản sửa đã phân biệt nguồn và giới hạn.',{exact:false}).waitFor();assert.equal(await student.evaluate(()=>qaSchool.store.get().submissions.find(row=>row.answerRevision===2)?.score),91);
    results.push({feedback:'Teacher DOM score72/redo, student retains local revision, resubmits revision2, stale revision1 grade rejected409, teacher returns score91 visible after student reload',history:'Original paragraphs and prior score/feedback retained by the real handler'});

    const outsider=await identityPage('outsider'),denied=await outsider.request.patch(origin+'/api/education/submissions',{data:{submissionId,answerRevision:2,score:100}});assert.equal(denied.status(),403);assert.equal(db.rows('education_submissions')[0].score,91);
    await teacher.setViewportSize({width:375,height:812});await noOverflow(teacher,'teacher375');await teacher.screenshot({path:path.join(out,'teacher-375.png'),fullPage:true});await student.setViewportSize({width:375,height:812});await noOverflow(student,'student375');await student.screenshot({path:path.join(out,'student-375.png'),fullPage:true});
    await student.evaluate(()=>document.documentElement.style.zoom='2');await noOverflow(student,'student375zoom200');await student.evaluate(()=>document.documentElement.style.zoom='1');
    await teacher.setViewportSize({width:1440,height:1000});await teacher.screenshot({path:path.join(out,'teacher-desktop.png'),fullPage:true});
    results.push({permissions:'An unrelated student cannot grade:403, stored score unchanged',responsive:'Teacher/student375px,DPR2,reduced motion and studentzoom200 with no page overflow'});
    assert.deepEqual(errors,[]);console.log('PASS HH School real-handler classroom DOM workflow');
  }catch(error){await teacher?.screenshot({path:path.join(out,'teacher-failure.png'),fullPage:true}).catch(()=>{});await student?.screenshot({path:path.join(out,'student-failure.png'),fullPage:true}).catch(()=>{});throw error;}
  finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({at:new Date().toISOString(),results,errors,apiCalls,environment:'Headless Chromium native DOM/IndexedDB; explicit QA cookie identities and in-memory MongoDB transport, unchanged production education handlers'},null,2));await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
