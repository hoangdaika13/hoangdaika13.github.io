const test=require('node:test');
const assert=require('node:assert/strict');
const capabilities=require('../graphic-design-capabilities.js');
const context=require('../graphic-design-project-context.js');
const vector=require('../graphic-design-vector-core.js');
const exportsAPI=require('../graphic-design-export-center.js');
const universal=require('../graphic-design-universal.js');

test('all 25 studios expose distinct tasks and explicit limits, with Vietnamese search',()=>{
  assert.equal(capabilities.CATALOG.length,25);
  assert.equal(new Set(capabilities.CATALOG.map(item=>item.route)).size,25);
  assert.equal(capabilities.search('CHỮ')[0].id,'typography');
  assert.ok(capabilities.search('3d').some(item=>item.id==='3d'));
  assert.deepEqual(capabilities.search('no-such-studio'),[]);
  for(const item of capabilities.CATALOG){assert.ok(item.task.length>20);assert.ok(item.limit.length>30);assert.match(item.route,/^\/graphic-design\/[a-z-]+|^\/graphic-design\/3d$/);}
  assert.equal(capabilities.preferences({theme:'untrusted',focus:'yes',motion:0}).theme,'nebula');
  assert.equal(capabilities.preferences({focus:true,motion:false}).motion,false);
});
test('native Vector storage keeps two projects and accounts distinct without touching legacy data',async()=>{
  const data=new Map([['hh.graphic-vector-core.project.v1','legacy']]);
  const storage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
  const options=(accountId,projectId)=>{const projectContext=context.resolve({storage,accountId,projectId});return{storage:projectContext.engineStorage,projectContext};};
  const first=vector.createStorageDriver({},options('A','one')),second=vector.createStorageDriver({},options('A','two')),other=vector.createStorageDriver({},options('B','one'));
  await first.save({name:'one',layers:[]});await second.save({name:'two',layers:[]});
  assert.equal((await first.load()).name,'one');assert.equal((await second.load()).name,'two');assert.equal(await other.load(),null);
  assert.equal(data.get('hh.graphic-vector-core.project.v1'),'legacy');
  await assert.rejects(vector.createStorageDriver({},{storage:null}).save({name:'not saved'}),/Không thể tự lưu/);
});
test('Export Center delegates real source output and never invents encoder success',async()=>{
  const seen=[];
  const source={async prepareExportSVG(options){seen.push(options.accountId);return{svg:'<svg xmlns="http://www.w3.org/2000/svg"><rect width="30" height="40"/></svg>'};},async exportPackage(){return{format:'hh-design-package',assets:[{data:'original-bytes'}]};}};
  const svg=await exportsAPI.exportSharedDocument(source,'svg',{accountId:'A'});
  assert.equal(svg.blob.type,'image/svg+xml');assert.match(await svg.blob.text(),/<rect/);assert.deepEqual(seen,['A']);
  const pack=await exportsAPI.exportSharedDocument(source,'package');assert.equal(JSON.parse(await pack.blob.text()).assets[0].data,'original-bytes');assert.match(pack.filename,/\.hhdesign$/);
  await assert.rejects(exportsAPI.exportSharedDocument({},'svg'),/chưa được cấu hình/);
  await assert.rejects(exportsAPI.exportSharedDocument({prepareExportSVG(){throw Error('Missing source');}},'svg'),/Missing source/);
});

test('Export Center actual portable package string imports once with original binary assets intact',async()=>{
  const document=universal.defaultDocument({id:'source-project',name:'Real portable output'});
  document.assets=[{id:'source-asset',name:'Original binary',kind:'other',type:'application/octet-stream',size:4,status:'ready',license:'owned'}];
  const original=new Blob([new Uint8Array([0,3,128,255])],{type:'application/octet-stream'});
  const output=await exportsAPI.exportSharedDocument({exportPackage:()=>universal.exportPackage(document,{readAsset:async()=>({blob:original})})},'package');
  const raw=await output.blob.text();
  assert.equal(JSON.parse(raw).format,'hh-design-package','One JSON parse must yield a manifest, not a quoted JSON string');
  const clean=new Map();
  const restored=await universal.importPackage(raw,{storeAssets:async(records)=>records.forEach(record=>clean.set(record.id,record))});
  assert.equal(restored.name,'Real portable output');
  assert.notEqual(restored.assets[0].id,'source-asset');
  assert.deepEqual([...new Uint8Array(await clean.get(restored.assets[0].id).blob.arrayBuffer())],[0,3,128,255]);
});

test('standalone universal mount honors storage:null without reading legacy private documents',()=>{
  const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
  const reads=[];
  const sandbox={localStorage:{getItem(key){reads.push(key);return null;},setItem(){throw Error('Unexpected write');}}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../graphic-design-universal.js'),'utf8'),sandbox);
  const stop=new Error('Stop after storage resolution and initial document render');
  const host={querySelector(){return null;},insertAdjacentHTML(){throw stop;}};
  assert.throws(()=>sandbox.HHGraphicDesignUniversal.mount(host,{storage:null}),(error)=>error===stop);
  assert.ok(!reads.includes(universal.STORAGE_KEY),'Explicit null must never fall back to the global document key');
  assert.ok(!reads.includes('hh.graphic-design.universal.v1'),'Explicit null must not adopt a legacy private document');
});
