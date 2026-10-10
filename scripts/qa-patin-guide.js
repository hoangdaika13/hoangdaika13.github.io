/* Actual browser UI/storage/download QA. Media transport is not mocked or enabled here. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.HH_QA_PLAYWRIGHT||'playwright'),D=require('../patin-data'),G=require('../patin-guide');
const repo=path.resolve(__dirname,'..'),out=path.join(repo,'.study-local/patin-guide-qa'),results=[],pass=n=>{results.push(n);console.log('PASS '+n);};
const server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(repo,'.'+name);if(!file.startsWith(repo+path.sep)||name.split('/').some(p=>p.startsWith('.')||p==='node_modules'))return res.writeHead(403).end();if(!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
async function main(){
 fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.HH_QA_CHROMIUM});
  const ctx=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,serviceWorkers:'block'}),page=await ctx.newPage(),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(origin))external.push(r.url());});
  const go=async route=>{await page.evaluate(r=>location.hash='#'+r,route);await page.waitForFunction(r=>{const p=r.split('/'),el=document.querySelector('.pt-root');return el?.dataset.ptView===(p[2]||'home')&&el?.dataset.ptSkill===(p[3]||'');},route);};
  const read=()=>page.evaluate(()=>HHPatinCore.createStore(JSON.parse(localStorage.getItem('hh.qa.patin.user')||'null'),localStorage).getState());
  await page.goto(origin+'/tests/fixtures/patin.html#/patin/skills');
  assert.equal(await page.locator('.ptg-card-art svg').count(),12);
  assert.match(await page.locator('.ptg-library-intro').innerText(),/148.*37/);
  assert.equal(await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);return new Set(ids).size===ids.length;}),true);
  pass('12 native SVG cards, accurate catalog/video counts and unique accessibility IDs without asset fetches');
  await page.locator('[data-pt-library-method]').selectOption('video');assert.match(await page.locator('[data-pt-count]').innerText(),/^42 kỹ năng/);
  assert.equal((await read()).workshop.library.method,'video');await page.reload();assert.equal(await page.locator('[data-pt-library-method]').inputValue(),'video');
  await page.locator('[data-pt-library-method]').selectOption('verified');assert.match(await page.locator('[data-pt-count]').innerText(),/^16 kỹ năng/);
  await page.locator('[data-pt-quick-discipline=slide]').click();assert.match(await page.locator('[data-pt-count]').innerText(),/^8 kỹ năng/);
  await page.locator('[data-pt-discipline]').selectOption('slalom');assert.equal(await page.locator('[data-pt-quick-discipline=slalom]').getAttribute('aria-pressed'),'true');assert.match(await page.locator('[data-pt-count]').innerText(),/^8 kỹ năng/);
  await page.locator('[data-pt-library-method]').selectOption('all');await page.locator('[data-pt-quick-discipline=all]').click();
  pass('saved method filters, verified-source subset, quick disciplines and manual selection agree on real data');
  for(const s of D.skills){
   await go('/patin/skills/'+s.id);assert.equal(await page.locator('.pt-detail h2').innerText(),s.title);
   assert.equal(await page.locator('.ptg-read-steps>li').count(),5);assert.ok((await page.locator('.ptg-written').innerText()).includes(s.drill));
   await page.locator('[data-ptg-tab=visual]').click();const svg=page.locator('[data-ptg-artboard] svg');assert.equal(await svg.getAttribute('data-ptg-svg'),s.id);
   assert.ok((await svg.locator('title').textContent()).includes(s.title));assert.equal(await page.locator('[data-ptg-point]').count(),3);
   assert.equal(await svg.locator('g.ptg-point.is-active').count(),1);assert.ok(await svg.locator('path,circle,rect').count()>0);
   assert.equal((await read()).progress[s.id]?.read||false,false);
  }
  pass('all 148 actual lesson routes have distinct source text, nonempty conceptual drawings and three observation controls; viewing never marks read');
  await go('/patin/skills/fish');await page.locator('[data-ptg-tab=visual]').click();
  for(let i=0;i<3;i++){await page.locator('[data-ptg-point="'+i+'"]').click();assert.equal(await page.locator('[data-ptg-description]').innerText(),G.guide('fish').observations[i]);}
  await page.locator('[data-ptg-zoom="1"]').click();await page.locator('[data-ptg-zoom="1"]').click();await page.locator('[data-ptg-zoom="1"]').click();
  assert.match(await page.locator('[data-ptg-zoom-status]').innerText(),/^200%/);assert.equal(await page.locator('[data-ptg-zoom="1"]').isDisabled(),true);
  await page.locator('[data-ptg-pan="1,0"]').click();assert.notEqual(await page.locator('[data-ptg-artboard] svg').getAttribute('viewBox'),'105 75 210 150');
  await page.locator('[data-ptg-reset]').click();assert.equal(await page.locator('[data-ptg-artboard] svg').getAttribute('viewBox'),'0 0 420 300');assert.equal(await page.locator('[data-ptg-pan="1,0"]').isDisabled(),true);
  pass('real highlight descriptions, bounded 100–200% SVG zoom, pan and full-frame reset');
  await page.locator('[data-ptg-tab=written]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[data-ptg-tab=visual]').getAttribute('aria-selected'),'true');
  assert.equal(await page.locator('[data-ptg-tab=visual]').evaluate(n=>n===document.activeElement),true);
  await page.keyboard.press('End');assert.equal(await page.locator('[data-ptg-tab=ranking]').getAttribute('aria-selected'),'true');assert.match(await page.locator('.ptg-ranking').innerText(),/E · classic/);
  await page.keyboard.press('Home');assert.equal(await page.locator('[data-ptg-tab=written]').getAttribute('aria-selected'),'true');
  assert.equal(await page.locator('[data-ptg-panel]').getAttribute('aria-labelledby'),await page.locator('[data-ptg-tab=written]').getAttribute('id'));
  pass('keyboard roving tabs, Home/End, stable focus and correct explicit Classic reference');
  let event=page.waitForEvent('download');await page.locator('[data-ptg-text-export]').click();const txt=path.join(out,'fish.txt');await(await event).saveAs(txt);assert.ok(fs.readFileSync(txt,'utf8').includes(D.skills.find(s=>s.id==='fish').drill));
  await page.locator('[data-ptg-tab=visual]').click();event=page.waitForEvent('download');await page.locator('[data-ptg-svg-export]').click();const svgFile=path.join(out,'fish.svg');await(await event).saveAs(svgFile);
  const raw=fs.readFileSync(svgFile,'utf8');assert.match(raw,/<style>/);assert.ok(raw.includes('Fish'));assert.doesNotMatch(raw,/<script|<foreignObject|<image/);
  assert.equal(await page.evaluate(raw=>new DOMParser().parseFromString(raw,'image/svg+xml').querySelectorAll('parsererror').length,raw),0);
  pass('actual TXT and self-contained SVG downloads contain the chosen lesson and parse as safe XML');
  await page.locator('[data-pt-note]').fill('My private question');await page.locator('[data-ptg-point="2"]').click();await page.locator('[data-ptg-zoom="1"]').click();
  await go('/patin/routine');await go('/patin/skills/fish');assert.equal(await page.locator('[data-ptg-tab=visual]').getAttribute('aria-selected'),'true');assert.match(await page.locator('[data-ptg-zoom-status]').innerText(),/^125%/);assert.equal(await page.locator('[data-pt-note]').inputValue(),'My private question');
  await page.locator('[data-pt-star=fish]').click();assert.equal(await page.locator('[data-ptg-tab=visual]').getAttribute('aria-selected'),'true');await page.reload();assert.equal(await page.locator('[data-pt-note]').inputValue(),'My private question');
  pass('same-account reader position survives route/star rerender; private notes persist on reload without becoming mastery');
  await go('/patin/skills/t-stop');await page.locator('[data-ptg-tab=video]').click();assert.ok(await page.locator('[data-app-route="/patin/videos/ia-8-3VJ4yrPRY"]').count());
  assert.equal(await page.locator('iframe,video').count(),0);await page.locator('[data-app-route="/patin/videos/ia-8-3VJ4yrPRY"]').click();assert.equal(await page.locator('[data-pt-video-detail] h3').innerText(),'T-stop · Check stop');assert.equal(await page.locator('iframe').count(),0);
  await go('/patin/skills/slide-torque');await page.locator('[data-ptg-tab=video]').click();assert.match(await page.locator('.ptg-media').innerText(),/Chưa có video trực tiếp/);
  await page.locator('[data-ptg-tab=ranking]').click();assert.match(await page.locator('.ptg-ranking').innerText(),/Chưa có mức kỹ thuật/);
  await go('/patin/skills/speed-double-push');await page.locator('[data-ptg-tab=ranking]').click();assert.match(await page.locator('.ptg-ranking').innerText(),/Không áp dụng cấp Freestyle/);
  pass('new exact publisher route is opt-in; missing advanced video/grade and Speed not-applicable states stay honest');
  await go('/patin/studio');assert.equal(await page.locator('[data-ptg-skill] option').count(),148);await page.locator('[data-ptg-query]').fill('Criss-cross');assert.equal(await page.locator('[data-ptg-skill]').inputValue(),'slalom-cross');assert.equal(await page.locator('[data-ptg-artboard] svg').getAttribute('data-ptg-svg'),'slalom-cross');
  await page.locator('[data-ptg-query]').fill('NO MATCH ZZ');assert.equal(await page.locator('[data-ptg-skill]').isDisabled(),true);assert.equal(await page.locator('[data-ptg-panel]').isVisible(),false);assert.match(await page.locator('[data-ptg-atlas-count]').innerText(),/^0\/148/);
  await page.locator('[data-ptg-query]').fill('');await page.locator('[data-ptg-skill]').selectOption('slalom-footgun');assert.match(await page.locator('[data-ptg-panel]').innerText(),/Thẻ đọc và ghi chú/);
  await page.locator('[data-ptg-next="-1"]').click();assert.equal(await page.locator('[data-ptg-skill]').inputValue(),'slalom-spacing-context');await go('/patin/gear');await go('/patin/studio');assert.equal(await page.locator('[data-ptg-skill]').inputValue(),'slalom-spacing-context');
  pass('all-skill illustration atlas, alias search/empty, keyboard native select, next/previous and session return work');
  await go('/patin/skills/fish');await page.locator('[data-ptg-tab=visual]').click();
  await page.evaluate(()=>{localStorage.setItem('hh.qa.patin.user',JSON.stringify({id:'guide-b'}));dispatchEvent(new CustomEvent('hh:auth-change',{detail:{user:{id:'guide-b'}}}));});assert.equal(await page.locator('[data-pt-note]').inputValue(),'');assert.equal(await page.locator('[data-ptg-tab=written]').getAttribute('aria-selected'),'true');
  await go('/patin/skills');assert.equal(await page.locator('[data-pt-library-method]').inputValue(),'all');
  await page.evaluate(()=>{localStorage.removeItem('hh.qa.patin.user');dispatchEvent(new CustomEvent('hh:auth-change',{detail:{user:null}}));});await go('/patin/skills/fish');assert.equal(await page.locator('[data-pt-note]').inputValue(),'My private question');assert.equal(await page.locator('[data-ptg-tab=visual]').getAttribute('aria-selected'),'true');
  pass('guide session/method filter/private notes do not mix between actual account scopes');
  for(const width of [1440,768,375]){
   await page.setViewportSize({width,height:950});
   for(const route of ['/patin/skills','/patin/skills/heel-brake','/patin/skills/slide-magic','/patin/studio']){
    await go(route);for(const tab of route.includes('/skills/')?['written','visual','video','ranking']:[]){await page.locator('[data-ptg-tab='+tab+']').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+' '+tab+' '+width);}
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('.pt-footer').scrollIntoViewIfNeeded();
   }
   await go('/patin/skills');await page.locator('[data-pt-results]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'library-'+width+'.png')});
   await go('/patin/skills/fish');await page.locator('[data-ptg-tab=visual]').click();await page.locator('.ptg-reader').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'reader-'+width+'.png')});
   pass('library, atlas and every reader tab fit/scroll at '+width+'px');
  }
  await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>document.documentElement.dataset.theme='light');await page.screenshot({path:path.join(out,'reader-light.png')});
  await page.setViewportSize({width:750,height:950});await page.evaluate(()=>{document.documentElement.style.zoom='2';document.documentElement.dataset.theme='dark';});await page.emulateMedia({forcedColors:'active',reducedMotion:'reduce'});
  await page.locator('[data-ptg-point="1"]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('[data-ptg-point="1"]').getAttribute('aria-pressed'),'true');assert.notEqual(await page.locator('[data-ptg-point="1"]').evaluate(n=>getComputedStyle(n).outlineStyle),'none');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);pass('light theme, forced colors, reduced motion, 200% zoom and keyboard points have no uncaught or pre-consent requests');
  await ctx.close();
 }finally{await browser?.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checkedAt:new Date().toISOString(),results,scope:'Real browser UI/local storage/downloads; no external playback, physical motion or coaching certification'},null,2));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
