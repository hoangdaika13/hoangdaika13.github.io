'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {admin}=require('../utils/education-handler.js').__test;
const {createEducationMemoryDB}=require('./helpers/hh-school-memory-db.js');
const reviewer={_id:'subject-reviewer',educationRole:'content-reviewer',roles:['content-reviewer']};
function fixture(){const db=createEducationMemoryDB();return {db,async request(method,body={},query={},user=reviewer){const result={status:0,body:null},res={status(code){result.status=code;return this;},json(value){result.body=value;return value;}};await admin({method,query},res,db,user,body);return result;}};}

test('editorial drafts retain all versions and reject a stale edit without approval',async()=>{
  const f=fixture(),contentId='math-authoring-test';
  const created=await f.request('POST',{action:'create-draft',contentId,title:'Bài biên soạn',kind:'lesson',licenseCode:'HH-ORIGINAL',payload:{steps:[{body:'Bản gốc'}],questions:[]}});
  assert.equal(created.status,200);assert.equal(created.body.item.status,'draft');
  for(let version=1;version<=2;version++){
    const saved=await f.request('PATCH',{action:'update-draft',contentId,baseVersion:version,payload:{steps:[{body:'Bản '+(version+1)}],questions:[]}});
    assert.equal(saved.status,200);assert.equal(saved.body.item.version,version+1);
  }
  const stale=await f.request('PATCH',{action:'update-draft',contentId,baseVersion:1,payload:{steps:[]}});
  assert.equal(stale.status,409);assert.equal(f.db.rows('education_content_versions').length,3);
  const versions=(await f.request('GET',{}, {view:'content'})).body.items;
  assert.deepEqual(versions.map(v=>v.version),[3,2,1]);assert.ok(versions.every(v=>v.status==='draft'&&v.contentStatus==='machine_generated'));
  assert.equal(versions.at(-1).payload.steps[0].body,'Bản gốc');
});

test('review proposals are stored as proposals and an unrelated learner cannot edit content',async()=>{
  const f=fixture(),proposal=await f.request('POST',{lessonId:'g1-math-count-ten',note:'Cần đối chiếu ví dụ và đơn vị.'});
  assert.equal(proposal.status,200);const pending=await f.request('GET');assert.equal(pending.body.items.length,1);assert.equal(pending.body.items[0].status,'proposed');assert.equal(pending.body.items[0].reviewerId,null);
  const denied=await f.request('POST',{action:'create-draft',title:'Bad'}, {}, {_id:'student',educationRole:'student',roles:['student']});
  assert.equal(denied.status,403);assert.equal(f.db.rows('education_content_versions').length,0);
  const approve=await f.request('PATCH',{reviewId:proposal.body.id,action:'approved'});assert.equal(approve.status,403);assert.equal(f.db.rows('education_reviews')[0].status,'proposed');
});
