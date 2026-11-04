'use strict';
// Invoked from the native full-shell University suite after a school is open.
// Uses pinned real records and read-only navigation; never writes account data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const P=require('../hh-university-profile');
const rich=require('../data/hh-university/schools/vn-ts-313.json');
const missing=require('../data/hh-university/schools/vn-colleges-513032d2a2c4b6.json');

module.exports=async function({page,out,pass=()=>{},measure,audits=[]}){
 const originalHash=await page.evaluate(()=>location.hash),viewport=page.viewportSize(),originalZoom=await page.evaluate(()=>document.documentElement.style.zoom);
 const go=async(school,query='tab=majors')=>{
  await page.evaluate(route=>location.hash=route,'#/university/school/'+school.institution.id+'?'+query);
  await page.waitForFunction(id=>document.querySelector('.hhu-school-header [data-hhu-action=save]')?.dataset.hhuId===id&&document.querySelector('.hup'),school.institution.id);
 };
 const open=async()=>{if(await page.locator('.hup-overview').getAttribute('open')===null)await page.locator('.hup-overview>summary').click();};
 const screen=async name=>{if(out){fs.mkdirSync(out,{recursive:true});await page.locator('.hup').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:path.join(out,name+'.png')});}};
 try{
  await go(rich);await open();const facts=P.summary({school:rich});
  assert.equal(await page.locator('[data-hup-metric=programmes]>strong').innerText(),String(facts.programmes));
  assert.equal(await page.locator('[data-hup-metric=curricula]>strong').innerText(),String(facts.curricula));
  assert.equal(await page.locator('[data-hup-metric=scores]>strong').innerText(),String(facts.knownScoreRows));
  assert.equal(await page.locator('.hup [data-hhu-profile-year]').count(),7);
  assert.equal(await page.locator('.hup .hup-year-missing').count(),0);
  await page.locator('[data-hhu-profile-year="2020"]').click();
  await page.locator('.hhu-school-tabs [data-hhu-tab=scores][aria-pressed=true]').waitFor();await page.locator('.hhu-score-table').waitFor();
  assert.equal(await page.locator('.hhu-years [data-hhu-year]').count(),7);
  assert.equal(await page.locator('.hhu-years [data-hhu-year="2020"]').getAttribute('aria-pressed'),'true');
  await open();await page.locator('[data-hhu-profile-tab=curricula]').click();
  await page.locator('.hhu-school-tabs [data-hhu-tab=curricula][aria-pressed=true]').waitFor();
  assert.equal(await page.locator('[data-hhu-curriculum]').count(),2);
  await open();await page.locator('[data-hhu-profile-tab=sources]').click();
  await page.locator('.hhu-school-tabs [data-hhu-tab=sources][aria-pressed=true]').waitFor();await open();
  await page.locator('.hup-sources>summary').click();
  const links=await page.locator('.hup-sources a').evaluateAll(rows=>rows.map(e=>({url:e.href,target:e.target,rel:e.rel})));
  assert.ok(links.length>=4);assert.ok(links.every(link=>link.url.startsWith('https://')&&link.target==='_blank'&&link.rel.includes('noopener')));

  for(const width of [1440,768,375]){
   await page.setViewportSize({width,height:1000});await open();
   const rects=await page.locator('.hup button,.hup summary,.hup a').evaluateAll(rows=>rows.filter(e=>e.getClientRects().length).map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
   assert.ok(rects.every(rect=>rect.width>=44&&rect.height>=44),JSON.stringify(rects.filter(rect=>rect.width<44||rect.height<44)));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.locator('.hup-overview>summary').focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');assert.ok(await page.locator('.hup-overview>summary').evaluate(e=>e===document.activeElement));assert.notEqual(await page.locator('.hup-overview>summary').evaluate(e=>getComputedStyle(e).outlineStyle),'none');
   await page.keyboard.press('Enter');assert.equal(await page.locator('.hup-overview').getAttribute('open'),null);await page.keyboard.press('Enter');assert.notEqual(await page.locator('.hup-overview').getAttribute('open'),null);
   if(measure)audits.push(await measure(page,'profile-'+width));await screen('profile-'+width);
  }
  await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>{document.documentElement.style.zoom='2';});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));if(measure)audits.push(await measure(page,'profile-zoom200'));await screen('profile-zoom200');
  await page.evaluate(zoom=>{document.documentElement.style.zoom=zoom;},originalZoom);
  await go(missing);await open();
  assert.equal(await page.locator('.hup .hup-year-missing').count(),7);
  assert.match(await page.locator('.hup').innerText(),/Chưa có bản ghi không đồng nghĩa/);
  assert.equal(await page.locator('[data-hup-metric=programmes]>strong').innerText(),'0');
  await page.locator('[data-hhu-profile-year="2026"]').click();
  await page.locator('.hhu-school-tabs [data-hhu-tab=scores][aria-pressed=true]').waitFor();
  assert.equal(await page.locator('.hhu-years [data-hhu-year="2026"]').getAttribute('aria-pressed'),'true');
  pass({schoolProfile:'Exact62programmes/2curricula/282scorefacts;7yearbuttons switch to actual tables;curriculum/source navigation;safe sources;missing-college data stays unknown;375/1440/200% layouts and44px controls'});
 }
 finally{
  await page.evaluate(zoom=>{document.documentElement.style.zoom=zoom;},originalZoom).catch(()=>{});
  if(viewport)await page.setViewportSize(viewport);
  await page.evaluate(hash=>{location.hash=hash;},originalHash);
  await page.waitForFunction(()=>document.querySelector('.hhu')&&!document.querySelector('.hhu-loading'),undefined,{timeout:45000});
 }
};
