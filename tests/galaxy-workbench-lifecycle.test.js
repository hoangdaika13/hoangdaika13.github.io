const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../galaxy-layer-one.js'),'utf8');
const body=source.slice(source.indexOf('  function mountWorkbench()'),source.indexOf('  function showToast(',source.indexOf('  function mountWorkbench()')));
function fixture(route,items=[]){
 let resolve,callbacks,opens=0;
 const pending=new Promise(done=>{resolve=done;});
 const owner={route,app:{},storage:{},contentStorage:{get:()=>pending},mediaPlaylist:['unchanged'],aiHistory:'original'};
 const context={runtime:owner,globalScope:{Blob,HHGalaxyWorkbench:{mount(app,options){callbacks=options;return {destroy(){}};}}},collectLocalState:()=>({items}),updateLocalItem(){},render(){},showToast(){},drawWaveform(){},updateMediaPlaylist(){},attachSubtitleFile(){},openLocalMedia(){opens++;},stopGame(){},toggleGame(){},File};
 vm.runInNewContext(body+'\nmountWorkbench();',context);
 return {owner,context,get callbacks(){return callbacks;},resolve,get opens(){return opens;}};
}
test('late file reads cannot open media in a different route of the persistent owner',async()=>{
 const f=fixture('/galaxy/video');const task=f.callbacks.openFile({route:'/galaxy/video',id:'v',meta:{mediaKind:'video'}});
 f.owner.route='/galaxy/music';f.resolve({value:new Blob(['video'],{type:'video/webm'})});await task;assert.equal(f.opens,0);
});
test('late conversation reads cannot replace context after navigation',async()=>{
 const f=fixture('/galaxy/ai');const task=f.callbacks.continueConversation({route:'/galaxy/ai',id:'a',description:'new'});
 f.owner.route='/galaxy/dev';f.resolve({value:{type:'ai-transcript',text:'new'}});await task;assert.equal(f.owner.aiHistory,'original');
});
test('replacing a workbench instance invalidates old callbacks even on the same route',()=>{
 const f=fixture('/galaxy/dev'),old=f.callbacks;assert.equal(old.isActive(),true);vm.runInNewContext('mountWorkbench();',f.context);assert.equal(old.isActive(),false);assert.equal(f.callbacks.isActive(),true);assert.equal(old.updateItem('x',{}),null);
});
test('late restored playlist does not modify the new route',async()=>{
 const item={id:'a',route:'/galaxy/music',meta:{mediaKind:'audio'}};const f=fixture('/galaxy/music',[item]);const task=f.callbacks.restorePlaylist();f.owner.route='/galaxy/settings';f.resolve({value:new Blob(['audio'],{type:'audio/wav'})});await task;assert.deepEqual(f.owner.mediaPlaylist,['unchanged']);
});
