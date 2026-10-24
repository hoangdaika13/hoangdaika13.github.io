'use strict';
// Native Chromium Web Audio, real host controls and a real monotonic clock.
// Instrumentation observes native nodes; it does not replace the audio renderer.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.HH_QA_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),out=path.resolve(root,process.env.HH_QA_OUTPUT||'.study-local/all-game-audio-1062');
const csp=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8')).headers.flatMap(h=>h.headers).find(h=>h.key==='Content-Security-Policy').value;
const assets=['all-game-studio-catalog.js','all-game-exp-catalog-play.js','all-game-exp-catalog-lab.js','all-game-exp-catalog-story.js','all-game-expansion-catalog.js','all-game-exp-art-play.js','all-game-exp-art-lab.js','all-game-exp-art-story.js','all-game-expansion-art.js','all-game-audio.js','all-game-catalog.js','all-game-studio-core.js','all-game-studio-art.js','all-game-scenes.js','all-game.js'];
const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://local').pathname);
  res.setHeader('Cache-Control','no-store');
  if(name==='/probe.html'){res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Security-Policy',csp);return res.end('<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/all-game.css"></head><body><main id="probe"></main>'+assets.map(f=>'<script src="/'+f+'"></script>').join('')+'</body></html>');}
  if(!/^\/all-game(?:-[a-z-]+)?\.(?:js|css)$/.test(name))return res.writeHead(404).end();
  const file=path.resolve(root,'.'+name);if(!fs.existsSync(file))return res.writeHead(404).end();res.setHeader('Content-Type',name.endsWith('.css')?'text/css':'text/javascript');fs.createReadStream(file).pipe(res);
});
async function run(){
  fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser,page,result={passed:false};
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.HH_QA_CHROMIUM});page=await browser.newPage({viewport:{width:1440,height:900}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      window.qaAudioContexts=[];const Native=window.AudioContext;
      window.AudioContext=class extends Native{
        constructor(...args){super(...args);this.qaStarts=[];this.qaStops=[];this.qaGains=[];qaAudioContexts.push(this);}
        createGain(){const node=super.createGain();this.qaGains.push(node);return node;}
        createOscillator(){const node=super.createOscillator(),start=node.start.bind(node),stop=node.stop.bind(node);node.start=(...args)=>{this.qaStarts.push({at:args[0],clock:this.currentTime,frequency:node.frequency.value});return start(...args);};node.stop=(...args)=>{this.qaStops.push({at:args[0]??null,clock:this.currentTime});return stop(...args);};return node;}
      };
    });
    await page.goto('http://127.0.0.1:'+server.address().port+'/probe.html');
    await page.evaluate(()=>{window.qaController=HHAllGame.mount(document.querySelector('#probe'),{gameId:'dj-transition',currentUser:{id:'audio-native-qa'}});});
    const startButton=page.locator('[data-ag-start]');await page.locator('[data-ag-start]:not([disabled])').waitFor();await startButton.click();
    assert.equal(await page.evaluate(()=>qaAudioContexts.length),0,'no native context before an explicit audio gesture');
    await page.locator('[data-ag-audio]').click();assert.ok(Math.abs(await page.evaluate(()=>qaAudioContexts[0].qaGains[0].gain.value)-.5)<.001);
    const volume=page.getByRole('slider',{name:'Âm lượng game',exact:true});assert.ok((await volume.boundingBox()).height>=44);
    await volume.focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');assert.ok(Math.abs(await page.evaluate(()=>qaAudioContexts[0].qaGains[0].gain.value)-.01)<.001);await page.keyboard.press('End');assert.equal(await page.evaluate(()=>qaAudioContexts[0].qaGains[0].gain.value),1);
    await page.locator('[data-ag-engine-action="play"]').click();const state=()=>page.evaluate(()=>qaController.getState()),began=await state();await page.waitForTimeout(1050);
    const played=await state(),audio=await page.evaluate(()=>{const c=qaAudioContexts[0];return{state:c.state,starts:c.qaStarts,stops:c.qaStops};});
    assert.equal(audio.state,'running');assert.ok(audio.starts.length>=2,'native oscillators start');assert.ok(Math.abs(played.musicTime-began.musicTime-1.05)<.3,'music clock follows monotonic elapsed');
    // A native audio quantum can elapse while JS constructs the nodes under load.
    assert.ok(audio.starts.every(n=>n.at>=n.clock-.02&&n.at-n.clock<.16),'lookahead stays bounded and does not queue old beats');
    assert.ok(audio.starts.every(n=>Math.min(...[48,55,60].map(m=>Math.abs(n.frequency-440*Math.pow(2,(m-69)/12))))<.01),'fader-zero deck B does not create audible voices');
    await page.locator('[data-ag-pause]').click();const paused=await state();
    const offset=page.getByRole('slider',{name:'Căn thời điểm âm thanh, mili giây',exact:true});await offset.focus();await page.keyboard.press('End');assert.equal(await offset.inputValue(),'100');assert.deepEqual(await state(),paused,'audio alignment does not alter game state');await page.keyboard.press('Home');assert.equal(await offset.inputValue(),'-100');for(let i=0;i<20;i++)await page.keyboard.press('ArrowRight');assert.equal(await offset.inputValue(),'0');
    const pausedStarts=await page.evaluate(()=>qaAudioContexts[0].qaStarts.length);assert.ok(await page.evaluate(()=>qaAudioContexts[0].qaStops.some(n=>n.at===null)),'pause stops scheduled voices');await page.waitForTimeout(200);assert.deepEqual(await state(),paused);assert.equal(await page.evaluate(()=>qaAudioContexts[0].qaStarts.length),pausedStarts);
    await startButton.click();await page.waitForTimeout(300);const resumed=await state();assert.ok(resumed.musicTime>paused.musicTime&&resumed.musicTime-paused.musicTime<.6,'resume has no paused-time catchup');
    await page.locator('[data-ag-audio]').click();assert.equal(await page.evaluate(()=>qaAudioContexts[0].state),'suspended');await page.evaluate(()=>HHAllGame.unmount());await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>qaAudioContexts[0].state),'closed');assert.deepEqual(errors,[]);
    result={passed:true,starts:audio.starts.length,playedDelta:played.musicTime-began.musicTime,checks:['gesture-only native context','native oscillator voices','zero-gain deck silence','50% master volume and keyboard range','±100ms alignment preserves state','bounded native scheduling','monotonic clock','pause stops and freezes','resume without catchup','mute suspension','unmount close'],errors};console.log(JSON.stringify(result,null,2));
  }catch(error){result.error=error.message;await page?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}
  finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));await browser?.close();await new Promise(r=>server.close(r));}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
