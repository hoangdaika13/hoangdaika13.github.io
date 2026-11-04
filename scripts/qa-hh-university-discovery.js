'use strict';
// Native full-shell checks over the actual bundled school directory. No paid/API write.
const assert=require('node:assert/strict'),path=require('node:path');
const directory=require('../data/hh-university/directory.json'),K=require('../hh-university-discovery');
module.exports=async function({page,out,pass=()=>{},measure,audits=[]}){
 const viewport=page.viewportSize(),hash=await page.evaluate(()=>location.hash),zoom=await page.evaluate(()=>document.documentElement.style.zoom);
 const saved=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('hh.university.')).map(k=>[k,localStorage.getItem(k)])));
 const go=async route=>{await page.evaluate(route=>location.hash='#'+route,route);await page.locator('.hhu-discovery-results').waitFor({timeout:45000});};
 const action=async(name,extra='')=>page.locator('[data-hhu-action="'+name+'"]'+extra).first().click();
 const snapshot=()=>page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('hh.university.')).map(k=>[k,localStorage.getItem(k)])));
 const ids=()=>page.locator('.hhu-school-card').evaluateAll(rows=>rows.map(r=>r.dataset.hhuSchool));
 const submit=async values=>{const form=page.locator('[data-hhu-directory-form]');await form.evaluate(el=>el.closest('details').open=true);for(const[name,value]of Object.entries(values)){const el=form.locator('[name="'+name+'"]');if(name==='query')await el.fill(value);else await el.selectOption(value);}await form.locator('button[type=submit]').click();};
 const audit=async label=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+' overflow');if(measure)audits.push(await measure(page,label));};
 try{
  await page.setViewportSize({width:1440,height:1000});await go('/university');
  const before=await snapshot(),counts=K.counts(directory.schools);
  await action('coverage','[data-hhu-coverage=missing]');assert.equal((await ids()).length,Math.min(24,counts.missing));assert.ok((await ids()).every(id=>{const s=directory.schools.find(r=>r.id===id);return !s.programmeCount&&!s.scoreCount;}));
  await action('coverage','[data-hhu-coverage=scores]');assert.ok((await ids()).every(id=>directory.schools.find(r=>r.id===id).scoreCount>0));
  await action('layout','[data-hhu-layout=list]');assert.equal(await page.locator('.hhu-school-grid').getAttribute('data-hhu-layout'),'list');assert.deepEqual(await snapshot(),before);
  await submit({query:'',level:'all',province:'all',source:'website',sort:'programmes',size:'48'});
  const params=await page.evaluate(()=>location.hash);assert.match(params,/coverage=scores/);assert.match(params,/source=website/);assert.match(params,/size=48/);assert.match(params,/layout=list/);
  const context=await page.evaluate(()=>({photoIds:HHUniversityCampus.catalog.map(p=>p.schoolId),websiteIds:HHUniversityCampus.catalog.map(p=>p.schoolId)}));
  const expected=K.select(directory.schools,{coverage:'scores',source:'website',sort:'programmes',size:48,layout:'list'},context);assert.deepEqual(await ids(),expected.slice(0,48).map(r=>r.id));
  await action('page','[data-hhu-page="'+Math.max(0,Math.ceil(expected.length/48)-1)+'"]');assert.deepEqual(await ids(),K.paginate(expected,{size:48,page:999}).items.map(r=>r.id));
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('.hhu-discovery-results').waitFor({timeout:45000});assert.equal(await page.locator('[name=source]').inputValue(),'website');assert.equal(await page.locator('[name=sort]').inputValue(),'programmes');assert.equal(await page.locator('[name=size]').inputValue(),'48');
  await action('reset');assert.equal(await page.evaluate(()=>document.activeElement?.name),'query');assert.equal(await page.locator('[name=query]').inputValue(),'');assert.match(await page.evaluate(()=>location.hash),/^#\/university$/);
  await go('/university?q=QSC&coverage=scores&sort=programmes&layout=list&size=48');assert.equal((await ids()).length,1);
  const save=page.locator('[data-hhu-save-search]');const savedPanel=page.locator('.hhu-saved-search-panel');if(!await savedPanel.evaluate(el=>el.open))await savedPanel.locator('summary').click();await save.locator('[name=name]').fill('Discovery native QA');await save.locator('button[type=submit]').click();
  await save.locator('[name=name]').fill('Discovery retained QA');await save.locator('button[type=submit]').click();
  const savedRows=page.locator('.hhu-saved-search-panel .ue-saved-searches>div'),rowCount=await savedRows.count();
  for(const row of await savedRows.all()){assert.equal(await row.locator('a').count(),1);assert.equal(await row.locator('button').count(),1);}
  await savedRows.filter({hasText:'Discovery native QA'}).locator('button').click();assert.equal(await savedRows.count(),rowCount-1);assert.equal(await savedRows.filter({hasText:'Discovery native QA'}).count(),0);
  const savedLink=page.locator('.ue-saved-searches a').filter({hasText:'Discovery retained QA'}).last();assert.match(await savedLink.getAttribute('href'),/coverage=scores/);assert.match(await savedLink.getAttribute('href'),/layout=list/);assert.match(await savedLink.getAttribute('href'),/size=48/);
  await page.locator('.hhu-school-card .hhu-card-actions a').first().click();await page.locator('.hhu-school-header').waitFor();await page.goBack();await page.locator('.hhu-discovery-results').waitFor();assert.equal(await page.locator('[name=query]').inputValue(),'QSC');assert.equal(await page.locator('.hhu-school-grid').getAttribute('data-hhu-layout'),'list');
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('.hhu-discovery-results').waitFor({timeout:45000});assert.ok(await page.locator('.ue-saved-searches a').filter({hasText:'Discovery retained QA'}).count());assert.equal(await page.locator('.ue-saved-searches a').filter({hasText:'Discovery native QA'}).count(),0);
  for(const width of [1440,768,375]){await page.setViewportSize({width,height:1000});await page.locator('.hhu-school-card').first().scrollIntoViewIfNeeded();await audit('discovery-list-'+width);if(out)await page.screenshot({path:path.join(out,'discovery-list-'+width+'.png')});await action('layout','[data-hhu-layout=grid]');await audit('discovery-grid-'+width);await action('layout','[data-hhu-layout=list]');}
  await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>document.documentElement.style.zoom='2');await page.locator('.hhu-school-card').first().scrollIntoViewIfNeeded();await audit('discovery-zoom200');if(out)await page.screenshot({path:path.join(out,'discovery-zoom200.png')});
  await page.evaluate(()=>document.documentElement.style.zoom='1');await page.setViewportSize({width:375,height:1000});await action('reset');await page.locator('[name=query]').fill('no-matching-school-native-qa-753');await page.locator('[name=query]').press('Enter');assert.equal(await page.locator('.hhu-school-card').count(),0);assert.equal(await page.evaluate(()=>document.activeElement?.name),'query');await audit('discovery-no-results-375');
  pass({discovery:'Actual programme/score/missing/source facets, deterministic sort,24/48page,last/first,grid/list,URLreload/back,savedsearch retention,375/768/1440/200%,emptyresults,keyboardfocus; browsing does not change private state',directoryRecords:directory.schools.length});
 }finally{
  await page.evaluate(saved=>{for(const key of Object.keys(localStorage).filter(k=>k.startsWith('hh.university.')))if(!Object.hasOwn(saved,key))localStorage.removeItem(key);for(const[key,value]of Object.entries(saved))localStorage.setItem(key,value);},saved).catch(()=>{});
  await page.evaluate(zoom=>document.documentElement.style.zoom=zoom,zoom).catch(()=>{});if(viewport)await page.setViewportSize(viewport);if(await page.evaluate(()=>location.hash)!==hash)await page.evaluate(hash=>location.hash=hash,hash);
 }
};
