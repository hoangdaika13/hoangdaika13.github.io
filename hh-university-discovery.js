/* Directory presentation state and coverage derived only from published records. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./hh-university-core'):root.HHUniversityCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.HHUniversityDiscovery=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C){
 'use strict';
 const COVERAGE=Object.freeze(['all','programmes','scores','missing']),SOURCES=Object.freeze(['all','website']),SORTS=Object.freeze(['name','programmes','province']),LAYOUTS=Object.freeze(['grid','list']);
 const clean=(value,max)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
 function normalize(raw={}){const r=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};return{
  q:clean(r.q??r.query,200),level:['university','college'].includes(r.level)?r.level:'all',province:clean(r.province,160)||'all',photos:r.photos==='verified'?'verified':'',
  coverage:COVERAGE.includes(r.coverage)?r.coverage:'all',source:SOURCES.includes(r.source)?r.source:'all',sort:SORTS.includes(r.sort)?r.sort:'name',layout:LAYOUTS.includes(r.layout)?r.layout:'grid',size:Number(r.size)===48?48:24,page:Number.isSafeInteger(Number(r.page))&&Number(r.page)>=0?Math.min(1000,Number(r.page)):0
 };}
 function read(route){return normalize(Object.fromEntries(new URLSearchParams(String(route||'').split('?')[1]||'')));}
 function url(raw,pane='schools'){
  const s=normalize(raw),p=new URLSearchParams();
  for(const [key,value,defaultValue]of [['q',s.q,''],['level',s.level,'all'],['province',s.province,'all'],['photos',s.photos,''],['coverage',s.coverage,'all'],['source',s.source,'all'],['sort',s.sort,'name'],['layout',s.layout,'grid'],['size',s.size,24],['page',s.page,0]])if(value!==defaultValue)p.set(key,String(value));
  return '/university'+(['scores','saved'].includes(pane)?'/'+pane:'')+(p.size?'?'+p:'');
 }
 const hasProgrammes=school=>Number(school.programmeCount)>0;
 const hasScores=school=>Number(school.scoreCount)>0;
 function context(raw={}){return{photoIds:new Set(raw.photoIds||[]),websiteIds:new Set(raw.websiteIds||[]),saved:Array.isArray(raw.saved)?raw.saved:null};}
 function select(schools,raw={},extra={}){
  const s=normalize(raw),ctx=context(extra);
  const rows=C.filterSchools(schools,{query:s.q,level:s.level,province:s.province,saved:ctx.saved}).filter(school=>
   (!s.photos||ctx.photoIds.has(school.id))&&(s.source!=='website'||Boolean(C.safeURL(school.officialWebsite))||ctx.websiteIds.has(school.id))&&
   (s.coverage==='all'||s.coverage==='programmes'&&hasProgrammes(school)||s.coverage==='scores'&&hasScores(school)||s.coverage==='missing'&&!hasProgrammes(school)&&!hasScores(school)));
  const compareName=(a,b)=>a.name.localeCompare(b.name,'vi')||a.id.localeCompare(b.id);
  return rows.sort((a,b)=>s.sort==='programmes'?(Number(b.programmeCount)||0)-(Number(a.programmeCount)||0)||compareName(a,b):s.sort==='province'?(a.province||'\uffff').localeCompare(b.province||'\uffff','vi')||compareName(a,b):compareName(a,b));
 }
 function paginate(rows,raw={}){const s=normalize(raw),pages=Math.max(1,Math.ceil(rows.length/s.size)),page=Math.min(s.page,pages-1);return{items:rows.slice(page*s.size,(page+1)*s.size),page,pages,size:s.size,total:rows.length,start:rows.length?page*s.size+1:0,end:Math.min((page+1)*s.size,rows.length)};}
 function counts(schools,extra={}){const ctx=context(extra);return{total:schools.length,university:schools.filter(s=>s.level==='university').length,college:schools.filter(s=>s.level==='college').length,programmes:schools.filter(hasProgrammes).length,scores:schools.filter(hasScores).length,missing:schools.filter(s=>!hasProgrammes(s)&&!hasScores(s)).length,photos:schools.filter(s=>ctx.photoIds.has(s.id)).length,website:schools.filter(s=>C.safeURL(s.officialWebsite)||ctx.websiteIds.has(s.id)).length};}
 function profileCoverage(pack){const years=C.YEARS.map(year=>{const row=pack?.scoreYears?.[year];return{year,available:row?.available===true,rows:row?.available===true&&Number.isSafeInteger(row.rows)&&row.rows>=0?row.rows:null};});return{programmes:pack?.programmes?.length||0,majors:pack?.majors?.length||0,curricula:pack?.curricula?.length||0,scoreRows:years.reduce((n,y)=>n+(y.rows||0),0),years:years.filter(y=>y.available).length,yearRows:years};}
 return Object.freeze({COVERAGE,SOURCES,SORTS,LAYOUTS,normalize,read,url,select,paginate,counts,profileCoverage});
});
