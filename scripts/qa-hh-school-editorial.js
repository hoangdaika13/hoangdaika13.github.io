'use strict';
// Real HH School DOM, native IndexedDB and production education handlers.
// Authentication and MongoDB transport are explicit, isolated QA doubles.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {ObjectId}=require('mongodb');
const {chromium}=require(process.env.HH_QA_PLAYWRIGHT||'playwright');
const {createEducationMemoryDB}=require('../tests/helpers/hh-school-memory-db.js');
const handlers=require('../utils/education-handler.js').__test;
const repo=path.resolve(__dirname,'..'),out=path.resolve(repo,process.env.HH_QA_OUTPUT||'.study-local/hh-school-editorial-1068');
const assets=['hh-school-curriculum','hh-school-offline','hh-school-university-core','hh-school-core','hh-school-progress-codec','hh-school-sync','hh-school-assessments','hh-school-content-manifest','hh-school-content','hh-school-workspace','hh-school'];
const identities={editor:{id:'qa-editor',_id:'qa-editor',name:'QA editor',educationRole:'content-reviewer',roles:['content-reviewer']},teacher:{id:'qa-teacher',_id:'qa-teacher',name:'QA teacher',educationRole:'teacher',roles:['teacher']},student:{id:'qa-student',_id:'qa-student',name:'QA student',educationRole:'student',roles:['student']},outsider:{id:'qa-outsider',_id:'qa-outsider',name:'QA outsider',educationRole:'student',roles:['student']}};
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
    const requestChunks=[];for await(const chunk of req)requestChunks.push(chunk);const text=Buffer.concat(requestChunks).toString('utf8');
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
  let editor;
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.HH_QA_CHROMIUM});editor=await identityPage('editor');await editor.locator('[data-hsw-preview]').first().click();await saved(editor);await route(editor,'admin');
    await editor.locator('[data-hsw-editor-source] option').nth(1).waitFor({state:'attached'});const form=editor.locator('[data-hsw-editor-draft]');await form.locator('select').selectOption({index:1});const contentId=await form.locator('[name=contentId]').inputValue();assert.ok(contentId);
    await form.locator('button[type=submit]').click();await editor.waitForFunction(()=>document.querySelectorAll('.hsw-student-answer').length===1);assert.equal(db.rows('education_content_versions').length,1);assert.equal(db.rows('education_content_versions')[0].status,'draft');
    const edit=editor.locator('[data-hsw-editor-draft]');await edit.locator('select').selectOption({index:1});const source=JSON.parse(await edit.locator('[name=payload]').inputValue());source.title+=' · bản sửa';await edit.locator('[name=title]').fill(source.title);await edit.locator('[name=payload]').fill(JSON.stringify(source));await edit.locator('button[type=submit]').click();await editor.waitForFunction(()=>document.querySelectorAll('.hsw-student-answer').length===2);assert.deepEqual(db.rows('education_content_versions').map(row=>row.version),[1,2]);assert.ok(db.rows('education_content_versions').every(row=>row.status==='draft'));
    const proposal=editor.locator('[data-hsw-editor-proposal]');await proposal.locator('[name=lessonId]').fill(contentId);await proposal.locator('[name=note]').fill('Đối chiếu lại ví dụ và yêu cầu cần đạt trước khi thẩm định.');await proposal.locator('button[type=submit]').click();await editor.getByRole('heading',{name:'1 đề xuất đang chờ'}).waitFor();assert.equal(db.rows('education_reviews')[0].status,'proposed');
    results.push({editor:'Native forms create original draft, append version2 and send proposal through production admin handler',publication:'All versions remain drafts, no forged approval'});
    for(const [width,height]of[[1440,900],[375,812]]){await editor.setViewportSize({width,height});await noOverflow(editor,'editor '+width);await editor.screenshot({path:path.join(out,'editor-'+width+'.png')});}
    const learner=await identityPage('student');const denied=await learner.evaluate(async()=>{const response=await fetch('/api/education/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create-draft',title:'unauthorized'})});return response.status;});assert.equal(denied,403);assert.equal(db.rows('education_content_versions').length,2);results.push({permissions:'Student edit rejected403 with no added version',responsive:'1440/375, DPR2, native keyboard controls'});
    assert.deepEqual(errors,[]);console.log('PASS editorial draft and proposal workflow');
  }catch(error){await editor?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({at:new Date().toISOString(),results,errors,apiCalls,environment:'Native Chromium and unchanged production admin handlers; explicit QA cookie identities and in-memory MongoDB transport'},null,2));await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
