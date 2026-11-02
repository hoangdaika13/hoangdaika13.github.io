'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async function({page,catalogue,out,pass,measure,audits}){
 const go=async route=>{await page.evaluate(r=>{location.hash=r;},'#'+route);await page.locator('.hhl').waitFor();};
 await go('/vietnam-law/library');await page.locator('.hhl-catalogue-summary').waitFor();
 assert.equal(await page.locator('[name=scope]').inputValue(),'bundled');assert.equal(await page.locator('.hhl-document-card').count(),20);
 const pages=Math.ceil(catalogue.documents.length/20);await page.locator('[data-law-action=page][data-law-page="'+pages+'"]').click();assert.equal(await page.locator('.hhl-document-card').count(),catalogue.documents.length%20||20);
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('.hhl-document-card').first().waitFor();assert.match(await page.evaluate(()=>location.hash),new RegExp('page='+pages));
 await page.locator('[data-law-action=catalogue-display]').click();assert.equal(await page.locator('.hhl-document-card').count(),catalogue.documents.length);assert.match(await page.evaluate(()=>location.hash),/display=all/);
 for(const width of [1440,375]){await page.setViewportSize({width,height:960});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));audits.push(await measure(page,'full-catalogue-'+width));await page.screenshot({path:path.join(out,'full-catalogue-'+width+'.png')});}
 await page.setViewportSize({width:1440,height:960});await page.evaluate(()=>{document.documentElement.style.zoom='2';});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));audits.push(await measure(page,'full-catalogue-zoom200'));await page.evaluate(()=>{document.documentElement.style.zoom='1';});
 await page.locator('[data-law-action=catalogue-kind][data-law-kind=code]').click();assert.equal(await page.locator('.hhl-document-card').count(),7);assert.match(await page.locator('.hhl-document-grid').innerText(),/Lao động/);
 await page.locator('[data-law-action=catalogue-kind][data-law-kind=constitution]').click();assert.equal(await page.locator('.hhl-document-card').count(),3);assert.equal(await page.locator('.hhl-document-card[data-law-document="11012"]').count(),1);
 await go('/vietnam-law/document/11012?view=text&article=120');await page.locator('.hhl-article').waitFor();assert.match(await page.locator('.hhl-article h2').innerText(),/Điều 120/);assert.match(await page.locator('.hhl-law-text').innerText(),/sửa đổi Hiến pháp/);await page.screenshot({path:path.join(out,'constitution-article120.png')});
 await go('/vietnam-law/library');await page.locator('[name=scope]').waitFor();await page.locator('[name=scope]').selectOption('official');await page.locator('[data-law-search] button[type=submit]').click();await page.locator('.hhl-document-card').first().waitFor();assert.match(await page.evaluate(()=>location.hash),/scope=official/);assert.equal(await page.locator('[name=kind]').inputValue(),'');
 await go('/vietnam-law');await page.locator('.hhl-document-card').first().waitFor();
 pass({catalogue:'All'+catalogue.documents.length+' imported records display in-browser; native first/last-page+reload/show-all,7codegroup,Constitution article120,live-source switch,375/desktop/200% layouts',officialLawCategory:catalogue.inventory.categoryStored+'/'+catalogue.inventory.categoryRecords,officialCategoryPages:catalogue.inventory.categoryPages.length});
};
