(function(scope,factory){'use strict';const api=factory();scope.HHAllGameAudio=api;if(typeof module==='object'&&module.exports)module.exports=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Audio belongs to the mounted host. Engines only describe a JSON score.
  function create(Context){
    let context=null,master=null,volume=.5,offset=0,enabled=false,disposed=false,revision=null,anchor=null,lastClock=null;
    const voices=new Map(),scheduled=new Map();
    function stop(){for(const node of voices.values()){try{node.source.stop();node.source.disconnect();node.gain.disconnect();node.pan?.disconnect();}catch{}}voices.clear();scheduled.clear();anchor=null;lastClock=null;revision=null;}
    async function enable(){if(disposed)return false;try{if(!Context)return false;if(!context){context=new Context();master=context.createGain();master.gain.value=volume;master.connect(context.destination);}await context.resume();enabled=context.state==='running';return enabled;}catch{enabled=false;return false;}}
    function setVolume(value){const amount=Number(value);if(!Number.isFinite(amount))return;volume=Math.max(0,Math.min(1,amount));if(master)master.gain.value=volume;}
    function setOffset(value){const amount=Number(value);if(!Number.isFinite(amount))return;offset=Math.max(-.1,Math.min(.1,amount));stop();}
    function mute(){enabled=false;stop();if(context?.state==='running')void context.suspend().catch(()=>{});}
    function sync(score,active){
      if(disposed||!enabled||!context||context.state!=='running'||!active||!score?.running||!Number.isFinite(score.clock)){if(anchor!==null||voices.size)stop();return;}
      const clock=score.clock,now=context.currentTime,rev=String(score.revision??0);
      if(revision!==rev||anchor===null||clock<(lastClock??clock)-.001||Math.abs(now-anchor-clock)>.08){stop();revision=rev;anchor=now-clock;}
      lastClock=clock;
      for(const [key,end] of scheduled)if(end<clock-1)scheduled.delete(key);
      const lookahead=Math.max(.02,Math.min(.15,Number(score.lookahead)||.12));
      for(const voice of (Array.isArray(score.voices)?score.voices:[]).slice(0,512)){
        const time=Number(voice.time),key=rev+':'+String(voice.key);
        if(!Number.isFinite(time)||time<clock-.015||time>clock+lookahead||scheduled.has(key)||voices.size>=32)continue;
        const level=Math.max(0,Math.min(.15,(Number.isFinite(Number(voice.gain))?Number(voice.gain):.07)));
        if(!level)continue;
        const duration=Math.max(.02,Math.min(2,Number(voice.duration)||.12)),when=Math.max(now+.004,anchor+time-offset);
        const source=context.createOscillator(),gain=context.createGain(),pan=context.createStereoPanner?.();
        source.type=['sine','triangle','square','sawtooth'].includes(voice.kind)?voice.kind:'sine';source.frequency.value=Math.max(40,Math.min(4000,Number(voice.freq)||440));
        gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(level,when+.008);gain.gain.exponentialRampToValueAtTime(.0001,when+duration);
        source.connect(gain);if(pan){pan.pan.value=Math.max(-1,Math.min(1,Number(voice.pan)||0));gain.connect(pan);pan.connect(master);}else gain.connect(master);
        const node={source,gain,pan};voices.set(key,node);scheduled.set(key,time+duration);source.onended=()=>{if(voices.get(key)!==node)return;voices.delete(key);source.disconnect();gain.disconnect();pan?.disconnect();};source.start(when);source.stop(when+duration+.01);
      }
    }
    function destroy(){if(disposed)return;stop();disposed=true;enabled=false;master?.disconnect();master=null;if(context)void context.close().catch(()=>{});context=null;}
    return Object.freeze({enable,mute,sync,stop,destroy,setVolume,setOffset,getVolume:()=>volume,getOffset:()=>offset,isEnabled:()=>enabled,isSupported:()=>!!Context,activeVoices:()=>voices.size});
  }
  return Object.freeze({create});
});
