'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const audio=require('../all-game-audio.js');
function fakeAudio(){
  let current;class Context{
    constructor(){current=this;this.currentTime=10;this.state='suspended';this.nodes=[];this.gains=[];this.destination={};}
    async resume(){this.state='running';}async suspend(){this.state='suspended';}async close(){this.state='closed';}
    createOscillator(){const node={frequency:{value:0},connect(){},disconnect(){this.disconnected=true;},start(time){this.startAt=time;},stop(time){this.stopAt=time;this.stopped=true;}};this.nodes.push(node);return node;}
    createGain(){const node={gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};this.gains.push(node);return node;}
    createStereoPanner(){return{pan:{value:0},connect(){},disconnect(){}};}
  }return{Context,get:()=>current};
}
test('audio needs an explicit gesture; bounded lookahead, deduplication and pause release all voices',async()=>{
  const fake=fakeAudio(),host=audio.create(fake.Context),score={clock:0,running:true,revision:1,voices:[{key:'beat',time:.05,freq:440},{key:'far',time:4,freq:880}]};
  host.sync(score,true);assert.equal(fake.get(),undefined);await host.enable();host.sync(score,true);const ctx=fake.get();assert.equal(ctx.nodes.length,1);assert.equal(ctx.nodes[0].startAt,10.05);host.sync(score,true);assert.equal(ctx.nodes.length,1);
  host.sync(score,false);assert.equal(host.activeVoices(),0);assert.ok(ctx.nodes[0].disconnected);ctx.currentTime=24;
  host.sync({...score,clock:2,voices:[{key:'old',time:.05},{key:'resume',time:2.04}]},true);assert.equal(ctx.nodes.length,2);assert.equal(ctx.nodes[1].startAt,24.04);host.mute();assert.equal(host.activeVoices(),0);assert.equal(ctx.state,'suspended');host.destroy();assert.equal(ctx.state,'closed');
});
test('audio limits polyphony and resets a changed score instead of replaying its past',async()=>{
  const fake=fakeAudio(),host=audio.create(fake.Context);await host.enable();const voices=Array.from({length:80},(_,i)=>({key:i,time:.08,freq:5000,duration:20,gain:2}));host.sync({clock:0,running:true,revision:0,voices},true);assert.equal(host.activeVoices(),32);assert.equal(fake.get().nodes[0].frequency.value,4000);host.sync({clock:0,running:true,revision:1,voices:[{key:'new',time:.04}]},true);assert.equal(host.activeVoices(),1);assert.ok(fake.get().nodes.slice(0,32).every(n=>n.disconnected));host.destroy();
  const absent=audio.create(null);assert.equal(await absent.enable(),false);absent.sync({running:true,clock:0},true);absent.destroy();
});
test('zero deck gain stays silent and master volume has bounded explicit controls',async()=>{
  const fake=fakeAudio(),host=audio.create(fake.Context);host.setVolume(.3);await host.enable();assert.equal(fake.get().gains[0].gain.value,.3);
  host.sync({clock:0,running:true,voices:[{key:'silent-deck',time:.05,gain:0}]},true);assert.equal(fake.get().nodes.length,0);
  host.setVolume(2);assert.equal(host.getVolume(),1);host.setVolume(-1);assert.equal(fake.get().gains[0].gain.value,0);host.destroy();
});
test('audio offset changes scheduled sound time, stops prior voices and keeps the engine clock untouched',async()=>{
  const fake=fakeAudio(),host=audio.create(fake.Context),score={clock:0,running:true,revision:1,voices:[{key:1,time:.1}]};await host.enable();host.setOffset(.05);host.sync(score,true);assert.ok(Math.abs(fake.get().nodes[0].startAt-10.05)<1e-9);host.setOffset(-.05);assert.equal(host.activeVoices(),0);host.sync(score,true);assert.ok(Math.abs(fake.get().nodes[1].startAt-10.15)<1e-9);assert.equal(score.clock,0);host.setOffset(1);assert.equal(host.getOffset(),.1);host.destroy();
});
test('all209 games, every difficulty and maximum counters survive a complete account round trip',()=>{
  const host=require('../all-game.js'),values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},bests={},records={};
  assert.equal(host.CATALOG.length,209);
  for(const {id} of host.CATALOG){bests[id]={score:1e12,plays:1e9,wins:1e9};for(const difficulty of ['easy','normal','hard'])records[host.recordKey(id,difficulty)]={...bests[id]};}
  const data=host.normalizeData({favorites:host.CATALOG.map(g=>g.id),bests,records});assert.equal(host.save(storage,'atlas',data).ok,true);const raw=values.get(host.keyFor('atlas'));assert.ok(raw.length>50000,'exercise the old limit');assert.ok(raw.length<350000);assert.deepEqual(host.read(storage,'atlas'),data);assert.deepEqual(host.read(storage,'different').favorites,[]);
});
