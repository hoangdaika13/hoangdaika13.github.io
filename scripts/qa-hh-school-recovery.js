'use strict';
// Actual HH School UI, native IndexedDB, native IME/CDP and production modules.
// Time, unavailable backend, denied storage and TTS dispatch are explicit QA
// doubles. Corrupt/future saves are attack fixtures, never completed learning.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.HH_QA_PLAYWRIGHT||'playwright');
const repo=path.resolve(__dirname,'..'),out=path.resolve(repo,process.env.HH_QA_OUTPUT||'.study-local/hh-school-recovery-1065');
const assets=['hh-school-curriculum','hh-school-offline','hh-school-core','hh-school-sync','hh-school-assessments','hh-school-content-manifest','hh-school-content','hh-school-workspace','hh-school'];
const csp=JSON.parse(fs.readFileSync(path.join(repo,'vercel.json'),'utf8')).headers.flatMap(row=>row.headers).find(row=>row.key==='Content-Security-Policy').value;
const results=[],errors=[];let browser,origin,page;
const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://local').pathname);res.setHeader('Cache-Control','no-store');
  if(name.startsWith('/api/'))return res.writeHead(503,{'Content-Type':'application/json'}).end(JSON.stringify({error:'QA backend intentionally unavailable'}));
  if(name==='/bootstrap.js'){res.setHeader('Content-Type','text/javascript');return res.end("window.qaOwner=new URL(location.href).searchParams.get('owner')||'recovery-student';function qaMount(){window.qaSchool=HHSchool.mount(document.querySelector('#probe'),{view:location.hash.split('/')[2]||'today',currentUser:{id:qaOwner}});}window.addEventListener('hashchange',qaMount);qaMount();");}
  if(name==='/probe.html'||name==='/blank.html'){res.setHeader('Content-Type','text/html');res.setHeader('Content-Security-Policy',csp);return res.end('<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/hh-school.css"><link rel="stylesheet" href="/hh-school-workspace.css"></head><body style="margin:0;background:#091522"><main id="probe"></main>'+assets.map(file=>'<script src="/'+file+'.js"></script>').join('')+(name==='/probe.html'?'<script src="/bootstrap.js"></script>':'')+'</body></html>');}
  const file=path.resolve(repo,'.'+name);if(!file.startsWith(repo+path.sep)||name.split('/').some(part=>part.startsWith('.')||['api','utils','node_modules'].includes(part)))return res.writeHead(403).end();
  if(!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();
  res.setHeader('Content-Type',({'.js':'text/javascript','.json':'application/json','.css':'text/css','.html':'text/html'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
async function saved(){await page.evaluate(async()=>{await qaSchool.store.ready;await qaSchool.store.whenSaved();});}
const state=()=>page.evaluate(()=>qaSchool.store.get());
async function open(owner,view='today'){await page.goto(origin+'/probe.html?owner='+owner+'#/learn/'+view);await saved();}
async function route(view){await page.evaluate(view=>location.hash='#/learn/'+view,view);await page.waitForFunction(view=>qaSchool.view===view,view);await saved();}
async function preview(){if(!(await state()).studyWorkspace.previewContent)await page.locator('[data-hsw-preview]').first().click();await saved();}
async function selectSubject(id){await route('subjects');await page.locator('[data-school-subject="'+id+'"]').click();}
async function activeExam(){const s=await state();return s.studyWorkspace.examSessions[s.studyWorkspace.activeExamId];}
async function createExam(mode='mock'){
  await selectSubject('vietnamese');await route('assessments');
  await page.locator('[data-hsw-exam-create] select[name=mode]').selectOption(mode);
  const counts=await page.locator('[data-hsw-exam-create] select[name=count] option').evaluateAll(nodes=>nodes.map(n=>n.value));
  await page.locator('[data-hsw-exam-create] select[name=count]').selectOption(counts.at(-1));
  await page.locator('[data-hsw-exam-create] input[name=minutes]').fill('2');
  await page.locator('[data-hsw-exam-create] button[type=submit]').click();
  await page.locator('[data-hsw-exam-answer]').waitFor();await saved();return activeExam();
}
async function scenario(name,fn,initial){
  if(process.env.HH_QA_CASES&&!process.env.HH_QA_CASES.split(',').includes(name))return;
  const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:2,reducedMotion:'reduce',acceptDownloads:true});
  page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',error=>errors.push({scenario:name,message:error.message}));
  try{if(initial)await initial(context,page);const detail=await fn(context,page);results.push({scenario:name,passed:true,...detail});console.log('PASS '+name);}
  catch(error){await page.screenshot({path:path.join(out,name+'-failure.png'),fullPage:true}).catch(()=>{});results.push({scenario:name,passed:false,error:error.message,stack:error.stack});console.error('FAIL '+name+': '+error.message);}
  finally{await context.close();}
}
async function run(){
  fs.mkdirSync(out,{recursive:true});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.HH_QA_CHROMIUM});
    for(const fixture of ['future-local','corrupt-local','future-idb','corrupt-idb'])await scenario(fixture,async()=>{
      const owner='qa-'+fixture;await page.goto(origin+'/blank.html');
      const raw=await page.evaluate(async({fixture,owner})=>{
        const s=HHSchoolCore.defaultState({currentUser:{id:owner}}),key=HHSchoolCore.storageKey(owner,'learner-1');
        if(fixture.endsWith('local')){const raw=fixture==='future-local'?'{\n "schemaVersion": 99, "ownerId": "'+owner+'", "learnerProfileId":"learner-1", "unknown":"giữ nguyên dấu Việt" \n}':'{ "broken": "dữ liệu chưa đóng"';localStorage.setItem(key,raw);return{kind:'local',key,raw};}
        if(fixture==='corrupt-idb')s.progress=[];const record={key:owner+':learner-1',ownerId:owner,learnerProfileId:'learner-1',archiveVersion:fixture==='future-idb'?99:1,state:s,updatedAt:'2026-10-27T00:00:00Z'};
        const db=await HHSchoolOffline.open();await new Promise((resolve,reject)=>{const tx=db.transaction('profiles','readwrite');tx.objectStore('profiles').put(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();return{kind:'idb',record};
      },{fixture,owner});
      await open(owner);await page.locator('[data-hsw-recovery]').waitFor();
      assert.equal(await page.evaluate(()=>qaSchool.store.getPersistence().status),'protected');
      assert.equal(await page.locator('[data-hsw-preview]').count(),0);assert.equal(await page.locator('input[data-hsw-note]').count(),0);
      const recovery=await page.evaluate(()=>qaSchool.store.getRecoveryData());assert.equal(recovery.protected,true);
      if(raw.kind==='local'){assert.equal(recovery.localRaw,raw.raw);assert.equal(await page.evaluate(key=>localStorage.getItem(key),raw.key),raw.raw);}
      else assert.deepEqual(JSON.parse(recovery.archiveRaw),raw.record);
      const update=await page.evaluate(()=>{try{qaSchool.store.update(s=>({...s,activeSubjectId:'history'}));return'allowed';}catch(error){return error.code;}});assert.equal(update,'STATE_PROTECTED');
      const download=page.waitForEvent('download');await page.locator('[data-hsw-recovery]').click();const file=await download,body=JSON.parse(fs.readFileSync(await file.path(),'utf8'));
      if(raw.kind==='local')assert.equal(body.localRaw,raw.raw);else assert.deepEqual(JSON.parse(body.archiveRaw),raw.record);
      await route('subjects');assert.equal(await page.evaluate(()=>qaSchool.store.getPersistence().status),'protected');
      if(raw.kind==='local')assert.equal(await page.evaluate(key=>localStorage.getItem(key),raw.key),raw.raw);
      return{checks:['native protected UI','no edit','recovery export preserves original data','navigation does not overwrite']};
    });
    await scenario('missing-idb',async()=>{
      await open('qa-no-idb');await page.locator('[data-hsw-preview]').first().waitFor();await preview();
      const status=await page.evaluate(()=>qaSchool.store.getPersistence());assert.equal(status.archived,false);assert.match(status.error,/IndexedDB/i);
      assert.ok(await page.evaluate(()=>!!localStorage.getItem(HHSchoolCore.storageKey(qaOwner,'learner-1'))),'the local fallback really wrote data');
      return{checks:['unsupported IndexedDB is visible','local fallback checked instead of assuming archive save'],status};
    },async context=>{await context.addInitScript(()=>Object.defineProperty(window,'indexedDB',{configurable:true,value:undefined}));});
    await scenario('quota',async()=>{
      await open('qa-quota');await page.locator('[data-hsw-preview]').first().waitFor();await preview();
      const status=await page.evaluate(()=>qaSchool.store.getPersistence());assert.equal(status.status,'error');assert.equal(status.archived,false);assert.match(status.error,/quota/i);
      assert.ok(await page.locator('.hsw-storage-error').count());assert.doesNotMatch(await page.locator('.hsw-storage-error').innerText(),/^Đã lưu/);
      return{checks:['both actual write paths fail','UI does not claim save'],status};
    },async context=>{await context.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('QA local quota exhausted','QuotaExceededError');};IDBObjectStore.prototype.put=function(){throw new DOMException('QA IndexedDB quota exhausted','QuotaExceededError');};});});
    await scenario('network-retry',async()=>{
      let blocked=true,attempts=0;await page.route('**/data/hh-school/curriculum/grade-1.json*',async route=>{attempts++;if(blocked)return route.fulfill({status:503,contentType:'application/json',body:'{"error":"QA pack unavailable"}'});return route.continue();});
      await open('qa-pack-network');await page.locator('[data-hsw-retry]').waitFor();assert.match(await page.locator('.hsw-head').innerText(),/503/);
      const prior=await state();blocked=false;await page.locator('[data-hsw-retry]').click();await page.waitForFunction(()=>!!HHSchoolContent.peekGrade(1));
      assert.equal((await state()).ownerId,prior.ownerId);assert.ok(attempts>=2);return{attempts,checks:['pack failure shown','retry loads verified pack','progress identity retained']};
    });
    await scenario('checksum-retry',async()=>{
      let corrupt=true;await page.route('**/data/hh-school/curriculum/grade-1.json*',async route=>{if(!corrupt)return route.continue();const response=await route.fetch(),raw=await response.text();return route.fulfill({response,body:raw+'\n '});});
      await open('qa-checksum');await page.locator('[data-hsw-retry]').waitFor();assert.match(await page.locator('.hsw-head').innerText(),/checksum/);assert.equal(await page.evaluate(()=>HHSchoolContent.peekGrade(1)),null);
      corrupt=false;await page.locator('[data-hsw-retry]').click();await page.waitForFunction(()=>!!HHSchoolContent.peekGrade(1));
      return{checks:['modified pack rejected before cache','retry accepts original SHA256']};
    });
    await scenario('rapid-grade-abort',async()=>{
      const failed=[];page.on('requestfailed',request=>failed.push({url:request.url(),error:request.failure()?.errorText}));
      await open('qa-abort');await page.waitForFunction(()=>!!HHSchoolContent.peekGrade(1));await route('paths');
      let release;const delayed=new Promise(resolve=>release=resolve);await page.route('**/data/hh-school/curriculum/grade-2.json*',async route=>{await delayed;try{await route.continue();}catch{}});
      const pending=page.waitForRequest(request=>request.url().includes('/grade-2.json'));await page.locator('[data-school-grade="2"]').click();await pending;
      const cancelled=page.waitForEvent('requestfailed',{predicate:request=>request.url().includes('/grade-2.json')});await page.locator('[data-school-grade="3"]').click();release();await cancelled;await page.waitForFunction(()=>!!HHSchoolContent.peekGrade(3));await saved();
      assert.equal((await state()).profile.grade,3);assert.equal(await page.evaluate(()=>HHSchoolContent.peekGrade(2)),null);assert.ok(failed.some(r=>r.url.includes('/grade-2.json')&&/ABORTED/.test(r.error)));
      return{checks:['obsolete fetch aborted','selected grade wins','aborted pack never cached'],failed};
    });
    await scenario('ime-exam-timeout',async()=>{
      await page.clock.install({time:new Date('2026-10-27T02:30:00Z')});await open('qa-ime-exam');await page.waitForFunction(()=>!!HHSchoolContent.peekGrade(1));await preview();let session=await createExam('mock');
      const index=session.questions.findIndex(q=>['essay','dictation','short'].includes(q.type));assert.ok(index>=0);await page.locator('[data-hsw-exam-nav="'+index+'"]').click();await saved();session=await activeExam();const qid=session.questions[index].id;
      const field=page.locator('[data-hsw-exam-answer] textarea[name=answer],[data-hsw-exam-answer] input[name=answer]').first();await field.focus();await field.evaluate(e=>window.qaImeField=e);
      const cdp=await page.context().newCDPSession(page);await cdp.send('Input.imeSetComposition',{text:'Tiếng Vi',selectionStart:8,selectionEnd:8});await page.clock.runFor(1400);
      assert.equal(await field.inputValue(),'Tiếng Vi');assert.equal((await activeExam()).answers[qid],undefined,'in-progress IME is not stored or graded');assert.equal(await field.evaluate(e=>e===window.qaImeField),true,'timer did not replace composition node');
      await cdp.send('Input.insertText',{text:'Tiếng Việt có dấu'});await page.clock.runFor(400);await saved();assert.equal((await activeExam()).answers[qid],'Tiếng Việt có dấu');assert.equal(await field.inputValue(),'Tiếng Việt có dấu');
      const deadline=session.deadlineAt,questions=session.questions;await page.reload();await saved();await page.locator('[data-hsw-exam-answer]').waitFor();assert.equal((await activeExam()).answers[qid],'Tiếng Việt có dấu');assert.equal((await activeExam()).deadlineAt,deadline);
      await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await page.clock.fastForward(121000);await saved();
      const ended=await activeExam();assert.equal(ended.status,'submitted');assert.equal(ended.result.reason,'timeout');assert.equal(ended.submittedAt,deadline);assert.deepEqual(ended.questions,questions);assert.equal(ended.answers[qid],'Tiếng Việt có dấu');assert.equal(await page.locator('[data-hsw-exam-pause]').count(),0);
      await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});await page.reload();await saved();assert.equal((await activeExam()).submissionId,ended.submissionId);
      await cdp.detach();return{checks:['native IME stays local until commit','timer preserves field node','autosave/reload exact Unicode','controlled hidden event and clock jump retain hard deadline','timeout once across reload'],clock:'Playwright controlled clock; visibility event explicitly doubled'};
    });
    await scenario('practice-pause',async()=>{
      await page.clock.install({time:new Date('2026-10-27T02:30:00Z')});await open('qa-practice');await page.waitForFunction(()=>!!HHSchoolContent.peekGrade(1));await preview();await createExam('practice');
      await page.locator('[data-hsw-exam-pause]').click();await saved();const before=await activeExam(),remaining=await page.locator('[data-hsw-exam-clock]').innerText();
      await page.clock.fastForward(180000);assert.equal((await activeExam()).status,'paused');assert.equal(await page.locator('[data-hsw-exam-clock]').innerText(),remaining);
      await page.reload();await saved();assert.equal((await activeExam()).status,'paused');assert.equal((await activeExam()).elapsedMs,before.elapsedMs);
      await page.locator('[data-hsw-exam-pause]').click();await saved();assert.equal((await activeExam()).status,'active');
      return{checks:['practice pause freezes advisory timer','pause reload persists','resume is explicit']};
    });
    await scenario('tts-opt-in',async()=>{
      await open('qa-tts');await page.waitForFunction(()=>!!HHSchoolContent.peekGrade(1));await preview();await selectSubject('foreign-1');await page.locator('.hsw-lesson-card [data-school-open-lesson]').first().click();await page.waitForFunction(()=>qaSchool.view==='lesson');await page.locator('[data-lesson-step="4"]').click();await page.locator('[data-hsw-speak]').waitFor();
      assert.equal(await page.evaluate(()=>qaSpeechCalls.length),0,'no speech before consent');
      await page.locator('[data-hsw-speech-rate]').selectOption('0.75');await page.locator('[data-hsw-speak]').click();const calls=await page.evaluate(()=>qaSpeechCalls);assert.equal(calls.length,1);assert.equal(calls[0].lang,'en-US');assert.equal(calls[0].rate,.75);assert.ok(calls[0].text.includes('Hello'));
      await page.locator('[data-hsw-speak-stop]').click();assert.match(await page.locator('[data-hsw-speech-status]').innerText(),/Đã dừng/);
      await route('today');assert.ok(await page.evaluate(()=>qaSpeechCancels>0));return{checks:['native SpeechSynthesisUtterance configured only on click','transcript/lang/rate','stop and unmount cancel'],audioMeasurement:'dispatch spy only; audible output not measured'};
    },async context=>{await context.addInitScript(()=>{window.qaSpeechCalls=[];window.qaSpeechCancels=0;if(speechSynthesis){const speak=speechSynthesis.speak.bind(speechSynthesis),cancel=speechSynthesis.cancel.bind(speechSynthesis);speechSynthesis.speak=utterance=>{qaSpeechCalls.push({text:utterance.text,lang:utterance.lang,rate:utterance.rate});speak(utterance);};speechSynthesis.cancel=()=>{qaSpeechCancels++;cancel();};}});});
    await scenario('tts-unsupported',async()=>{
      await open('qa-no-tts');await page.waitForFunction(()=>!!HHSchoolContent.peekGrade(1));await preview();await selectSubject('foreign-1');await page.locator('.hsw-lesson-card [data-school-open-lesson]').first().click();await page.waitForFunction(()=>qaSchool.view==='lesson');await page.locator('[data-lesson-step="4"]').click();await page.locator('[data-hsw-speak]').click();assert.match(await page.locator('[data-hsw-speech-status]').innerText(),/chưa hỗ trợ/);
      await page.locator('.hsw-lab details summary').click();assert.match(await page.locator('.hsw-lab p[lang]').innerText(),/Hello/);
      return{checks:['unsupported speech state','original transcript remains available']};
    },async context=>{await context.addInitScript(()=>Object.defineProperty(window,'speechSynthesis',{configurable:true,value:undefined}));});
  }finally{
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({at:new Date().toISOString(),results,errors,limits:['Backend responses intentionally503','Clock and hidden visibility are controlled test doubles','TTS dispatch checked, actual audio waveform not measured']},null,2));
    await browser?.close();await new Promise(resolve=>server.close(resolve));
  }
  if(results.some(row=>!row.passed)||errors.length)process.exitCode=1;
}
run().catch(error=>{console.error(error);process.exitCode=1;});
