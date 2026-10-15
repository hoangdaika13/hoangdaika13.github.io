const test=require('node:test'),assert=require('node:assert/strict');
const vector=require('../graphic-design-vector-core.js');
const bridge=require('../graphic-design-vector-bridge.js');
const universal=require('../graphic-design-universal.js');
const make=(layers)=>vector.normalizeProject({format:vector.FORMAT,meta:{name:'Bridge <test>'},stage:{width:640,height:480,background:'#101010'},layers,timeline:{duration:3}});
const shape=(extra={})=>({id:'rect',type:'rect',name:'Shape',geometry:{x:20,y:30,width:100,height:80},style:{fill:'#ff0000',stroke:'#00ff00',strokeWidth:2},...extra});
test('Bridge creates editable snapshot with actual native transforms and no source mutation',()=>{
  const source=make([shape({transform:{x:10,y:20,rotation:90,scaleX:2,scaleY:2}})]),before=JSON.stringify(source);
  const result=bridge.snapshot(source,{time:1});
  assert.equal(result.ok,true);assert.equal(JSON.stringify(source),before);
  assert.equal(result.payload.layers.length,1);
  const first=result.payload.layers[0];
  assert.equal(first.type,'path');assert.deepEqual([first.pathPoints[0].x,first.pathPoints[0].y],[-50,60]);assert.equal(first.strokeWidth,4);
  assert.equal(first.pathPoints.length,5);assert.equal(first.pathClosed,true);
});
test('Bridge converts absolute Bezier handles to relative Universal handles and retains closing cubic',()=>{
  const source=make([shape({type:'path',geometry:{closed:true,points:[{x:10,y:10,inX:5,inY:9,outX:20,outY:25},{x:40,y:30,inX:30,inY:20,outX:50,outY:35}]}})]);
  const result=bridge.snapshot(source),path=result.payload.layers[0];
  assert.equal(result.ok,true);assert.deepEqual([path.pathPoints[0].inX,path.pathPoints[0].outY],[-5,15]);
  const d=universal.pathFromPoints(path.pathPoints,path.pathClosed);
  assert.match(d,/C 50 35 5 9 10 10 Z$/);
});
test('Bridge flattens neutral groups in render order and captures actual animation time',()=>{
  const source=make([{id:'g',type:'group',transform:{x:4,y:8}},shape({parentId:'g',keyframes:[{time:0,transform:{x:0,y:0}},{time:2,transform:{x:40,y:20}}]})]);
  const result=bridge.snapshot(source,{time:2});assert.equal(result.ok,true);
  assert.deepEqual([result.payload.layers[0].pathPoints[0].x,result.payload.layers[0].pathPoints[0].y],[64,58]);
  assert.equal(result.payload.layers[0].metadata.vectorBridge.time,2);
});
test('Text transfer preserves transformed baseline, font, fill and rotation',()=>{
  const source=make([shape({type:'text',geometry:{x:10,y:20,width:200,height:100,text:'Xin chào'},style:{fill:'#abcdef',stroke:'none',fontSize:30,fontFamily:'Georgia',fontWeight:700},transform:{x:5,y:3,rotation:90,scaleX:2,scaleY:2}})]);
  const result=bridge.snapshot(source),text=result.payload.layers[0];assert.equal(result.ok,true);
  assert.equal(text.fontSize,60);assert.equal(text.fontFamily,'Georgia');assert.equal(text.rotation,90);
  assert.equal(text.x,-95);assert.equal(text.y+text.height,23);assert.equal(text.anchorX,0);assert.equal(text.anchorY,1);
});
test('Unsupported rendering is rejected before transfer rather than silently flattened',()=>{
  for(const change of [{transform:{scaleX:2,scaleY:1}},{trim:{enabled:true}},{maskId:'mask'}, {type:'mask'}, {style:{fill:'rgb(1,2,3)'}},{solo:true}]) {
    const source=make([shape(change),{id:'mask',type:'mask'}]);
    const result=bridge.snapshot(source);assert.equal(result.ok,false);assert.ok(result.issues.length);
  }
  const group=make([{id:'g',type:'group',transform:{opacity:.5}},shape({parentId:'g'})]);assert.equal(bridge.snapshot(group).ok,false);
});
test('Hidden layers are explicitly counted; curved shapes disclose approximation',()=>{
  const result=bridge.snapshot(make([shape({id:'hide',visible:false}),shape({id:'oval',type:'ellipse',geometry:{cx:100,cy:100,width:80,height:120}})]));
  assert.equal(result.ok,true);assert.equal(result.hidden,1);assert.equal(result.warnings.length,1);assert.equal(result.payload.layers[0].pathPoints.length,5);
});
test('Copy command adds one frame with one undo record and preserves original frame',()=>{
  const source=make([shape({geometry:{x:21.25,y:33.75,width:100,height:80},style:{fill:'none',stroke:'#00ff00',strokeWidth:2}})]);
  const result=bridge.snapshot(source),initial=universal.defaultDocument();
  const copied=universal.operation(initial,'import-frame-layers',result.payload);
  assert.equal(copied.frames.length,initial.frames.length+1);
  assert.deepEqual(copied.frames[0],initial.frames[0]);
  const layer=copied.layers.at(-1);assert.equal(layer.pathPoints[0].x,21.25);assert.equal(layer.fill,'none');
  assert.notEqual(layer.id,source.layers[0].id);assert.equal(layer.frameId,copied.activeFrameId);
  const undone=universal.undo(copied);assert.deepEqual(undone.frames,initial.frames);assert.deepEqual(undone.layers,initial.layers);
});
test('Malformed and nonfinite bridge input fails closed',()=>{
  assert.throws(()=>bridge.snapshot({format:'other',layers:[]}));
  assert.throws(()=>bridge.snapshot(make([shape()]),{time:NaN}));
});
test('Unsupported stage paint is rejected and NONE keywords retain transparency on actual import',()=>{
  for(const background of ['none','#abc','rgba(0,0,0,.5)']){
    const source=make([shape()]);source.stage.background=background;
    assert.equal(bridge.snapshot(source).ok,false);
  }
  const result=bridge.snapshot(make([shape({style:{fill:'NONE',stroke:'NONE'}})]));assert.equal(result.ok,true);
  const copied=universal.operation(universal.defaultDocument(),'import-frame-layers',result.payload);
  assert.equal(copied.layers.at(-1).fill,'none');assert.equal(copied.layers.at(-1).stroke,'none');
});
test('Text adapter matches the actual native SVG stroke join/cap defaults',()=>{
  const result=bridge.snapshot(make([shape({type:'text',style:{fill:'#ffffff',stroke:'#ff0000',strokeWidth:2,lineJoin:'round',lineCap:'round',fontSize:20}})]));
  assert.equal(result.ok,true);assert.equal(result.payload.layers[0].strokeJoin,'miter');assert.equal(result.payload.layers[0].strokeCap,'butt');
});
