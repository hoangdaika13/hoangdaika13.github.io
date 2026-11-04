'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const K=require('../hh-university-discovery'),E=require('../hh-university-experience-core');
const schools=[
 {id:'vn-a',name:'Đại học Ánh Dương',code:'ADU',aliases:['Sun'],level:'university',province:'Hà Nội',programmeCount:3,scoreCount:8,officialWebsite:'https://a.edu.vn'},
 {id:'vn-b',name:'Cao đẳng Bách Khoa',code:'C01',aliases:[],level:'college',province:'Đà Nẵng',programmeCount:0,scoreCount:0},
 {id:'vn-c',name:'Đại học Biển Xanh',code:'SEA',aliases:[],level:'university',province:'Đà Nẵng',programmeCount:7,scoreCount:0,officialWebsite:'javascript:alert(1)'},
 {id:'vn-d',name:'Cao đẳng Đồng Bằng',code:'C02',aliases:[],level:'college',province:'Hà Nội',programmeCount:0,scoreCount:4}
];
const ctx={photoIds:['vn-b','vn-c'],websiteIds:['vn-b']};
test('directory state round-trips every filter, view and page through a bounded URL',()=>{
 const filters={q:'Bách khoa & kỹ thuật',level:'college',province:'Đà Nẵng',photos:'verified',coverage:'programmes',source:'website',sort:'province',layout:'list',size:48,page:3};
 for(const pane of ['schools','saved','scores'])assert.deepEqual(K.read(K.url(filters,pane)),filters);
 const dirty=K.normalize({q:'  <img onerror=1>\u0000  ',level:'unknown',coverage:'bad',source:'bad',sort:'bad',layout:'bad',size:100000,page:Infinity});
 assert.equal(dirty.q,'<img onerror=1>');assert.equal(dirty.level,'all');assert.equal(dirty.coverage,'all');assert.equal(dirty.size,24);assert.equal(dirty.page,0);assert.equal(K.normalize({page:-1}).page,0);assert.equal(K.normalize({page:1.5}).page,0);
});
test('coverage facets derive available records, preserving missing data without fabricated zero scores',()=>{
 assert.deepEqual(K.counts(schools,ctx),{total:4,university:2,college:2,programmes:2,scores:2,missing:1,photos:2,website:2});
 assert.deepEqual(K.select(schools,{coverage:'missing'},ctx).map(s=>s.id),['vn-b']);
 assert.deepEqual(K.select(schools,{coverage:'scores'},ctx).map(s=>s.id),['vn-d','vn-a']);
 assert.deepEqual(K.select(schools,{coverage:'programmes',photos:'verified'},ctx).map(s=>s.id),['vn-c']);
 assert.equal(K.select(schools,{coverage:'missing',source:'website'},ctx)[0].id,'vn-b');
});
test('compound searches keep source, level, province, saved and photo scopes independent',()=>{
 assert.equal(K.select(schools,{q:'bach khoa',level:'college',province:'Đà Nẵng',source:'website',photos:'verified'},ctx)[0].id,'vn-b');
 assert.equal(K.select(schools,{q:'Sun',photos:'verified'},ctx).length,0);
 assert.equal(K.select(schools,{q:'SEA',source:'website'},ctx).length,0);
 assert.deepEqual(K.select(schools,{coverage:'scores'},{...ctx,saved:['vn-a']}).map(s=>s.id),['vn-a']);
});
test('sort and pagination are deterministic, non-mutating and reach all records at either page size',()=>{
 const before=JSON.stringify(schools),ranked=K.select(schools,{sort:'programmes'},ctx);assert.deepEqual(ranked.slice(0,2).map(s=>s.id),['vn-c','vn-a']);assert.equal(JSON.stringify(schools),before);
 const rows=Array.from({length:101},(_,id)=>({id}));
 for(const size of [24,48]){const all=[];for(let page=0;page<Math.ceil(rows.length/size);page++)all.push(...K.paginate(rows,{size,page}).items);assert.deepEqual(all,rows);const last=K.paginate(rows,{size,page:999});assert.equal(last.page,Math.ceil(rows.length/size)-1);assert.equal(last.end,101);assert.equal(last.total,101);}
 assert.deepEqual(K.paginate([]),{items:[],page:0,pages:1,size:24,total:0,start:0,end:0});
});
test('saved school searches preserve discovery fields without polluting major searches or old defaults',()=>{
 const filters={q:'Công nghệ',level:'college',province:'Đà Nẵng',photos:'verified',coverage:'scores',source:'website',sort:'programmes',layout:'list',size:48,page:2};
 const state=E.normalize({...E.defaults(),schoolSearches:[{id:'search-a',name:'Các trường tôi chọn',filters}],recentSchoolSearch:filters});
 assert.deepEqual(K.read(E.searchURL(state.schoolSearches[0].filters,'schools')),filters);assert.deepEqual(K.normalize(state.recentSchoolSearch),filters);
 assert.equal(E.searchURL(filters,'majors').includes('photos='),false);assert.equal(E.searchURL(filters,'majors').includes('coverage='),false);
 assert.deepEqual(E.filters({}),{q:'',family:'all',province:'all',level:'all',year:'all'});
 assert.throws(()=>E.normalize({...E.defaults(),schoolSearches:'invalid'}));
});
