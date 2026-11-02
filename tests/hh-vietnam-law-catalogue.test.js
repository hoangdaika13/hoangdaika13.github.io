'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('../hh-vietnam-law-core'),S=require('../utils/vietnam-law-source'),catalogue=require('../data/hh-vietnam-law/catalogue.json'),audit=require('../data/hh-vietnam-law/source-audit.json');
const root=path.resolve(__dirname,'..');
test('every distinct official Law category record on all35audited pages is actually present and readable',()=>{
 const inventory=catalogue.inventory,ids=[...new Set(inventory.categoryPages.flatMap(p=>p.ids))];
 assert.equal(inventory.categoryPages.length,35);assert.equal(ids.length,348);assert.equal(inventory.categoryRecords,348);assert.equal(inventory.categoryStored,348);assert.deepEqual(inventory.categoryMissing,[]);assert.equal(inventory.nationalCorpusComplete,false);
 for(const id of ids){const row=catalogue.documents.find(d=>d.id===id);assert.ok(row,id);const doc=JSON.parse(fs.readFileSync(path.join(root,row.pack.url.split('?')[0])));assert.ok(doc.attachments.some(a=>C.safeURL(a.url)),id);}
 assert.equal(inventory.searchLawTotal,333);assert.ok(audit.queries.filter(q=>q.type==='Luật').length>=9);assert.ok(catalogue.documents.some(d=>d.code==='24/2026/QH16'));
});
test('classification recovers codes and untyped Constitution without falsifying the original source type',()=>{
 const before=JSON.stringify(catalogue),counts=C.catalogueSummary(catalogue.documents,'2026-11-02');assert.deepEqual(counts.kinds,{primary:355,law:345,code:7,constitution:3,other:229});assert.equal(counts.statuses.unknown,567);assert.equal(counts.statuses.upcoming,17);assert.equal(counts.statuses.active,0);
 const labour=catalogue.documents.find(d=>d.id==='30232');assert.equal(labour.type,'Nghị quyết');assert.equal(C.documentKind(labour),'code');assert.equal(C.documentKind({title:'Về thi hành Bộ luật Dân sự',type:'Nghị quyết'}),'other');assert.equal(JSON.stringify(catalogue),before);
});
test('all filtered catalogue records are reachable with pagination or display-all and stale pages clamp correctly',()=>{
 const ids=new Set();for(let page=1;page<=30;page++){const r=C.catalogueResults(catalogue.documents,{scope:'bundled',page,pageSize:20});if(page<=r.pageCount)r.documents.forEach(d=>ids.add(d.id));}assert.equal(ids.size,catalogue.documents.length);
 const all=C.catalogueResults(catalogue.documents,{scope:'bundled',kind:'code',display:'all',page:999});assert.equal(all.documents.length,7);assert.equal(all.page,1);
 const last=C.catalogueResults(catalogue.documents,{page:99999,pageSize:20});assert.equal(last.page,30);assert.equal(last.documents.length,4);
 const empty=C.catalogueResults(catalogue.documents,{query:'not-existing-law-qa-991'});assert.equal(empty.total,0);assert.equal(empty.page,1);assert.deepEqual(empty.documents,[]);
});
test('search combines Vietnamese terms with kind/date/status and stable immutable sorting',()=>{
 const before=JSON.stringify(catalogue),r=C.catalogueResults(catalogue.documents,{query:'dan su',kind:'code',sort:'issued-asc',display:'all'});assert.ok(r.documents.some(d=>d.id==='18397'));assert.ok(r.documents.every(d=>C.documentKind(d)==='code'));
 const dated=C.catalogueResults(catalogue.documents,{issuedFrom:'2026-01-01',kind:'law',sort:'issued-desc',display:'all'});assert.ok(dated.documents.every(d=>d.issuedAt>='2026-01-01'));assert.ok(dated.documents.every((d,i)=>!i||dated.documents[i-1].issuedAt>=d.issuedAt));assert.equal(JSON.stringify(catalogue),before);
 assert.equal(C.normalizeSearch({page:1264,pageSize:20}).page,1264);
});
test('2013Constitution has all120real article headings and correct own-header identity',()=>{
 const entry=catalogue.documents.find(d=>d.id==='11012'),doc=JSON.parse(fs.readFileSync(path.join(root,entry.pack.url.split('?')[0])));assert.equal(doc.articles.length,120);assert.equal(doc.articles.at(-1).number,'120');assert.equal(doc.textComplete,true);assert.equal(doc.textIdentity.codeMatched,true);
 assert.match(C.findArticles(doc,{article:'1'})[0].text,/một nước độc lập/);
 const metadata={id:'11012',code:'Hiến pháp',issuedAt:'2013-11-28'};assert.equal(S.__test.textIdentity(metadata,[{text:'Luật số: 1/2026/QH16\nCăn cứ Hiến pháp'}]).codeMatched,false);
});
test('official Law catalogue HTML parser only accepts source document links and validates pagination',async()=>{
 const html='<a class="sapo" href="/van-ban/luat-123.htm">Luật</a><a class="sapo" href="https://evil.invalid/van-ban/luat-456.htm">Unsafe</a><script>var totalPageSodo = 2;</script>';
 const result=await S.cataloguePage(1,{fetchImpl:async()=>new Response(html)});assert.deepEqual(result.ids,['123']);assert.equal(result.pageCount,2);
 await assert.rejects(S.cataloguePage(301),/Trang/);await assert.rejects(S.cataloguePage(1,{fetchImpl:async()=>new Response('<p>No source rows</p>')}),/cấu trúc/);
 assert.ok(C.safeURL('https://g7.cdnchinhphu.vn/official.pdf'));assert.equal(C.safeURL('https://g7.cdnchinhphu.vn.evil.invalid/official.pdf'),'');
});
test('source missing-date sentinel is retained as raw evidence and never displayed as a real commencement',()=>{
 const doc=S.normalizeDocument({id_van_ban:123,so_ky_hieu:'X',trich_yeu:'Văn bản kiểm tra',ngay_ban_hanh:'2026-01-01',ngay_co_hieu_luc:'1900-01-01'});
 assert.equal(doc.effectiveAt,null);assert.equal(doc.issuedAt,'2026-01-01');assert.equal(doc.sourceDatePlaceholders.effectiveAt,'1900-01-01');assert.equal(C.effectiveStatus(doc).status,'unknown');
 for(const row of catalogue.documents)for(const field of ['issuedAt','effectiveAt','expiredAt'])assert.notEqual(row[field],'1900-01-01');
});
