'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../hh-university-profile'),directory=require('../data/hh-university/directory.json');
const entry=directory.schools.find(s=>s.id==='vn-ts-313');
const school=require('../data/hh-university/schools/vn-ts-313.json');
const empty=require('../data/hh-university/schools/vn-colleges-513032d2a2c4b6.json');

test('profile facts match the pinned school pack and never infer current admissions from historic counts',()=>{
 const before=JSON.stringify(school),facts=P.summary({school,entry});
 assert.equal(facts.programmes,62);assert.equal(facts.majors,16);assert.equal(facts.curricula,2);assert.equal(facts.knownScoreRows,282);assert.equal(facts.years,7);
 assert.deepEqual(facts.yearRows.map(r=>r.year),[2020,2021,2022,2023,2024,2025,2026]);assert.equal(facts.yearRows[0].rows,40);assert.equal(JSON.stringify(school),before);
 assert.match(P.render({school,entry}),/có thể gồm chương trình của nhiều năm/);
});
test('missing years remain unknown while explicit zero-row data stays distinct and all years are selectable',()=>{
 const facts=P.summary({school:empty});assert.equal(facts.years,0);assert.ok(facts.yearRows.every(r=>!r.available&&r.rows===null));
 const changed=structuredClone(empty);changed.scoreYears['2020']={available:true,rows:0};changed.scoreYears['2021']={available:true,rows:null};const values=P.summary({school:changed});
 assert.equal(values.yearRows[0].rows,0);assert.equal(values.yearRows[0].available,true);assert.equal(values.yearRows[1].rows,null);assert.equal(values.scoreCountsComplete,false);
 const html=P.render({school:empty});assert.equal((html.match(/data-hhu-profile-year=/g)||[]).length,7);assert.match(html,/Chưa có bản ghi không đồng nghĩa/);assert.doesNotMatch(html,/disabled/);
});
test('profile source links deduplicate safe URLs and never use campus or directory data from another school',()=>{
 const a=P.summary({school,entry:{id:'another',officialWebsite:'https://wrong-school.example/'},campus:{schoolId:'another',officialUrl:'https://wrong-campus.example/'}});assert.equal(a.website,'');
 const website='https://www.uit.edu.vn/';const pack=structuredClone(school);pack.institution.officialWebsite=website;pack.institution.sources.push({id:'copy',url:website},{id:'x',url:'javascript:alert(1)'},{id:'x',url:'https://user:pass@example.com'});
 const b=P.summary({school:pack});assert.equal(b.website,website);assert.equal(b.sources.filter(s=>s.url===website).length,1);assert.ok(b.sources.every(s=>s.url.startsWith('https://')&&!s.url.includes('user:pass')));
 const c=P.summary({school,campus:{schoolId:school.institution.id,officialUrl:website}});assert.equal(c.website,website);
});
test('profile renders escaped source metadata and separate action hooks without duplicating original year/tab selectors',()=>{
 const pack=structuredClone(school);pack.institution.sources=[{id:'<img src=x onerror=alert(1)>',url:'https://example.edu.vn/?q=%22'}];pack.curricula=[{name:'<svg onload=alert(1)>',url:'https://example.edu.vn/curriculum'}];
 const html=P.render({school:pack,tab:'scores',year:2020});assert.doesNotMatch(html,/<(?:img|svg) /);assert.match(html,/&lt;img/);assert.match(html,/&lt;svg/);assert.doesNotMatch(html,/data-hhu-year=|data-hhu-tab=/);
 assert.match(html,/data-hhu-action="profile-year" data-hhu-profile-year="2020" aria-pressed="true"/);assert.match(html,/data-hhu-action="profile-tab" data-hhu-profile-tab="curricula"/);assert.match(html,/rel="noopener noreferrer"/);
});
test('collapsed non-major overview retains concise availability and invalid dates are not presented as verified dates',()=>{
 const pack=structuredClone(empty);pack.checkedAt='not-a-date';const html=P.render({school:pack,tab:'scores'});assert.match(html,/<details class="hup-overview">/);assert.doesNotMatch(html,/Invalid Date|Bản nhập /);
 assert.match(P.render({school,tab:'majors'}),/<details class="hup-overview" open>/);
});
