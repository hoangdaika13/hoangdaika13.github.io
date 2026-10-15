const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
test('Advanced geometry vendor is pinned with complete redistribution notices and deterministic bytes',()=>{
  const bytes=fs.readFileSync(path.join(root,'vendor/polygon-clipping-0.15.7.umd.min.js'));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'1bd1335a65dac024dcba9843c60160b3b53faa46967b1b3ae2a4d5ef0ff04fce');
  const notices=read('vendor/POLYGON-CLIPPING-NOTICES.md');
  for(const license of ['MIT License','Splaytree','Unlicense','Apache License'])assert.match(notices,new RegExp(license,'i'));
  assert.doesNotMatch(bytes.toString(),/sourceMappingURL/);
});
test('Graphics lazy group loads native and bounded geometry dependencies before its host',()=>{
  const loader=read('performance-loader.js'),block=loader.slice(loader.indexOf('    graphic: {'),loader.indexOf('    creative: {'));
  const order=['vendor/polygon-clipping-0.15.7.umd.min.js','graphic-design-geometry.js','graphic-design-universal.js','graphic-design-studio.js'];
  for(let i=1;i<order.length;i++)assert.ok(block.indexOf(order[i-1])>=0&&block.indexOf(order[i])>block.indexOf(order[i-1]));
  assert.ok(block.indexOf('graphic-design-vector-core.js')<block.indexOf('graphic-design-vector-bridge.js'));
  assert.ok(block.indexOf('graphic-design-vector-bridge.js')<block.indexOf('graphic-design-studio.js'));
  const sw=read('sw.js');
  for(const asset of [...order.slice(0,2),'graphic-design-vector-bridge.js']){
    const url=block.match(new RegExp('"('+asset.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\?v=[^"\\s]+)"'))?.[1];
    assert.ok(url,asset+' lazy version missing');assert.equal(sw.split('"./'+url+'"').length-1,1,asset+' must have exactly one executable cache entry');
  }
});
test('Studio wires explicit editable transfer and tears it down before its document/native controllers',()=>{
  const studio=read('graphic-design-studio.js');
  assert.match(studio,/HHGraphicVectorBridge\?\.mount\?\./);
  const unmount=studio.slice(studio.indexOf('  function unmount()'));
  assert.ok(unmount.indexOf('HHGraphicVectorBridge')<unmount.indexOf('HHGraphicDesignUniversal'));
  const bridge=read('graphic-design-vector-bridge.js');assert.match(bridge,/if\(disposed\)return;/);assert.match(bridge,/import-frame-layers/);assert.match(bridge,/native\.ready/);
});
