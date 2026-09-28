const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function api(){const c={};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../phat-phap-practice-runtime.js'),'utf8'),c);return c.HHDharmaPracticeRuntime;}
function speech(voiceList=[{lang:'vi-VN',localService:true}]){
  const jobs=new Map(),spoken=[],states=[],lines=[];let id=0,cancels=0;
  const clock={setTimeout(fn,ms){jobs.set(++id,{fn,ms});return id;},clearTimeout(id){jobs.delete(id);}};
  const synth={getVoices:()=>voiceList,cancel(){cancels++;},speak(u){spoken.push(u);u.onstart?.();}};
  const player=api().createSpeech({synth,Utterance:class {constructor(text){this.text=text;}},clock,onState:s=>states.push(s),onLine:i=>lines.push(i)});
  const advance=ms=>{for(const [key,job]of [...jobs])if(job.ms===ms){jobs.delete(key);job.fn();}};
  return{player,spoken,states,lines,jobs,advance,cancels:()=>cancels};
}
test('local speech never advances a sentence before the real end event',()=>{
  const r=speech();assert.equal(r.spoken.length,0);
  r.player.start({lines:['Câu dài đầu tiên','Câu thứ hai']});assert.equal(r.spoken.length,1);
  r.advance(160);assert.equal(r.spoken.length,1);
  r.spoken[0].onend();r.advance(160);assert.equal(r.spoken.length,2);assert.equal(r.lines[1],1);
  r.spoken[1].onend();assert.equal(r.player.status().phase,'ended');assert.equal(r.jobs.size,0);
});
test('pause cancels nodes/timers; late callbacks cannot resume; explicit resume replays current sentence',()=>{
  const r=speech();r.player.start({lines:['A','B'],sleepMinutes:5});const late=r.spoken[0].onend;
  r.player.pause();late();r.advance(160);assert.equal(r.spoken.length,1);assert.equal(r.jobs.size,0);
  assert.equal(r.player.status().phase,'paused');r.player.start({lines:['A','B'],index:r.player.status().index});assert.equal(r.spoken[1].text,'A');
  r.player.dispose();assert.equal(r.jobs.size,0);assert.equal(r.spoken[1].onend,null);
});
test('remote or missing Vietnamese voices never receive utterances',()=>{
  for(const voices of [[],[{lang:'vi-VN',localService:false}],[{lang:'en-US',localService:true}]]){
    const r=speech(voices);assert.equal(r.player.start({lines:['Private text']}),false);assert.equal(r.spoken.length,0);assert.equal(r.player.status().phase,'error');
  }
});

test('synchronous speech failure does not leave a sleep timer behind',()=>{
  const jobs=new Set();
  const p=api().createSpeech({synth:{getVoices:()=>[{lang:'vi-VN',localService:true}],cancel(){},speak(){throw Error('device');}},Utterance:class{},clock:{setTimeout(){jobs.add(1);return 1;},clearTimeout(id){jobs.delete(id);}}});
  assert.equal(p.start({lines:['A'],sleepMinutes:5}),false);assert.equal(p.status().phase,'error');assert.equal(jobs.size,0);
});
test('speech reports real errors, supports repeating and clears the sleep deadline',()=>{
  const r=speech();r.player.start({lines:['A'],repeat:true,sleepMinutes:5});r.spoken[0].onend();r.advance(160);assert.equal(r.spoken.length,2);
  r.advance(300000);assert.equal(r.player.status().phase,'paused');assert.equal(r.jobs.size,0);
  r.player.start({lines:['A']});r.spoken.at(-1).onerror({error:'synthesis-failed'});assert.equal(r.player.status().phase,'error');assert.match(r.states.at(-1).message,/synthesis-failed/);assert.equal(r.jobs.size,0);
});
function locks(){const held=new Set();return {async request(name,options,fn){if(held.has(name))return fn(null);held.add(name);try{await fn({name});}finally{held.delete(name);}}};}
test('Web Locks permits one timer per account, other accounts remain independent',async()=>{
  const a=api(),manager=locks(),first=a.createLock(manager),second=a.createLock(manager),other=a.createLock(manager);
  assert.equal(await first.acquire('account-a'),true);assert.equal(await second.acquire('account-a'),false);assert.equal(await other.acquire('account-b'),true);
  first.release();await new Promise(setImmediate);const third=a.createLock(manager);assert.equal(await third.acquire('account-a'),true);third.release();other.release();
});
test('pending locks can be abandoned on unmount; unsupported browsers fail closed',async()=>{
  const a=api(),unsupported=a.createLock();assert.equal(unsupported.supported,false);assert.equal(await unsupported.acquire('x'),false);
  let callback;const pending=a.createLock({request:(name,opt,fn)=>{callback=fn;return Promise.resolve();}});
  const result=pending.acquire('x');pending.release();callback({});assert.equal(await result,false);
});
