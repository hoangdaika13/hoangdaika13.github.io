'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const worker=fs.readFileSync(require('node:path').resolve(__dirname,'../sw.js'),'utf8');
const queued=(owner,profile,id)=>({id,ownerId:owner,learnerProfileId:profile,ownerProfile:owner+':'+profile,request:{url:'/api/education/progress',method:'PUT',body:{learnerProfileId:profile,state:{ownerId:owner,learnerProfileId:profile,profile:{id:profile}}}}});
async function flush(items,activeOwner='parent-1'){
  const posted=[],changed=[],messages=[];
  const context=vm.createContext({URL,console,setTimeout,clearTimeout,self:{location:{origin:'https://school.test'},addEventListener(){},clients:{matchAll:async()=>[{postMessage:message=>messages.push(message)}]}},fetch:async(url,options)=>{if(url.endsWith('/api/auth/me'))return{ok:true,json:async()=>({user:{id:activeOwner}})};posted.push(JSON.parse(options.body));return{ok:true,status:200,json:async()=>({revision:1,updatedAt:'2026-10-27T00:00:00Z'})};}});
  vm.runInContext(worker,context);
  context.qaItems=items;context.qaChanged=changed;
  vm.runInContext('openHHSchoolQueue=async()=>({transaction:()=>({objectStore:()=>({getAll:()=>qaItems})}),close(){}});idbRequest=async value=>value;updateHHSchoolQueue=async(db,item,result)=>qaChanged.push({id:item.id,result});',context);
  const results=await vm.runInContext('flushHHSchoolQueue()',context);
  return{posted,changed,messages,results};
}
test('background sync sends only authenticated-owner records with exact matching profile metadata',async()=>{
  const good=queued('parent-1','child-1','good'),other=queued('other','child-1','other');
  const mismatched=queued('parent-1','child-2','mismatch');mismatched.request.body.state.profile.id='child-1';
  const wrongTarget=queued('parent-1','child-3','wrong-target');wrongTarget.request.url='/api/education/admin';
  const result=await flush([good,other,mismatched,wrongTarget]);
  assert.equal(result.posted.length,1);assert.equal(result.posted[0].learnerProfileId,'child-1');
  assert.equal(result.changed.find(x=>x.id==='good').result.remove,true);
  assert.equal(result.changed.find(x=>x.id==='other'),undefined,'other account remains untouched');
  assert.ok(result.changed.find(x=>x.id==='mismatch').result.error);
  assert.ok(result.changed.find(x=>x.id==='wrong-target').result.error);
  assert.deepEqual(Array.from(result.messages[0].results,x=>x.learnerProfileId),['child-1','child-2','child-3']);
});
test('background conflicts retain profile identity without broadcasting another child answer',async()=>{
  const row={...queued('parent-1','child-2','conflict'),syncStatus:'needs-resolution',conflict:{serverState:{privateAnswer:'do not broadcast'}}};
  const result=await flush([row]);assert.equal(result.posted.length,0);
  assert.equal(result.messages[0].ownerId,'parent-1');assert.equal(result.messages[0].results[0].learnerProfileId,'child-2');
  assert.equal(result.messages[0].results[0].conflictData,undefined);assert.equal(result.messages[0].results[0].conflict,true);
});
