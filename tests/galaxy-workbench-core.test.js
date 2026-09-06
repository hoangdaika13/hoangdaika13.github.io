const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const core=require('../galaxy-workbench-core.js');const layer=require('../galaxy-layer-one.js');const tools=require('../galaxy-layer-one-tools.js');const media=require('../galaxy-layer-one-media.js');
function pcm(channels,sampleRate=8000){return {sampleRate,length:channels[0].length,numberOfChannels:channels.length,getChannelData:i=>channels[i]};}
function storage(){const map=new Map();return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)};}
test('trim/fades/gain affect samples without mutating original PCM',()=>{
 const samples=new Float32Array(8000).fill(.5),input=pcm([samples]);const result=core.trimAudio(input,{start:.25,end:.75,gain:2,fadeIn:.1,fadeOut:.1});
 assert.equal(result.length,4000);assert.equal(result.getChannelData(0)[0],0);assert.equal(result.getChannelData(0)[1000],1);assert.equal(result.getChannelData(0)[3999],0);assert.equal(samples[0],.5);
 assert.throws(()=>core.trimAudio(input,{start:1,end:.5}));assert.throws(()=>core.trimAudio(input,{gain:NaN}));
});
test('mix handles different rates and mono/stereo without clipping',()=>{
 const a=pcm([new Float32Array(8000).fill(.6)]),b=pcm([new Float32Array(16000).fill(.2),new Float32Array(16000).fill(.4)],16000);
 const mix=core.mixAudio([a,b]);assert.equal(mix.length,8000);assert.equal(mix.numberOfChannels,2);assert.ok(Math.abs(mix.getChannelData(0)[100]-.4)<.00001);assert.ok(Math.abs(mix.getChannelData(1)[100]-.5)<.00001);
 assert.throws(()=>core.mixAudio([a]));
});
test('WAV output has correct RIFF lengths, sample rate, stereo interleave and duration',()=>{
 const wav=core.encodeWav(pcm([new Float32Array([1,-1,0]),new Float32Array([.5,-.5,0])],48000));const v=new DataView(wav);const text=(at,n)=>Buffer.from(wav,at,n).toString();
 assert.equal(text(0,4),'RIFF');assert.equal(text(8,4),'WAVE');assert.equal(v.getUint32(4,true),wav.byteLength-8);assert.equal(v.getUint32(24,true),48000);assert.equal(v.getUint16(22,true),2);assert.equal(v.getUint32(40,true),12);assert.equal(v.getInt16(44,true),32767);assert.equal(v.getInt16(46,true),16384);assert.equal(v.getInt16(48,true),-32768);
});
test('PCM worker returns transferable real WAV bytes and rejects malformed requests',()=>{
 const output=[];const self={HHGalaxyWorkbenchCore:core,postMessage:data=>output.push(data)};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../galaxy-workbench-worker.js'),'utf8'),{self,importScripts(){},Float32Array,Error});
 self.onmessage({data:{type:'trim',buffers:[{sampleRate:8000,channels:[new Float32Array(8000).fill(.2).buffer]}],options:{start:0,end:.5}}});assert.equal(output[0].ok,true);assert.equal(output[0].wav.byteLength,8044);
 self.onmessage({data:{type:'unknown'}});assert.equal(output[1].ok,false);
});
test('prompt variables preserve missing values and never use prototype properties',()=>{
 assert.deepEqual(core.promptVariables('Hi {{name}} {{topic}}',{name:'An'}),{names:['name','topic'],missing:['topic'],text:'Hi An {{topic}}'});
 assert.deepEqual(core.promptVariables('{{constructor}}',{}).missing,['constructor']);assert.throws(()=>core.promptVariables('{{x}}',{x:'a'.repeat(20001)}));
});
test('line diff and highlighting escape input rather than running HTML',()=>{
 assert.deepEqual(core.lineDiff('a\nb','a\nc').map(row=>row.kind),['same','add','remove']);
 const html=core.highlightCode('const x = "<img onerror=bad>";');assert.ok(html.includes('gwb-token-keyword'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));
 assert.throws(()=>core.lineDiff('x\n'.repeat(1000),'y\n'.repeat(1000)));
});
test('subtitle serialize/parse round trip preserves real timing and Unicode',()=>{
 const cues=[{startMs:1200,endMs:2500,text:'Xin chào\nHH Galaxy'}];for(const format of ['srt','vtt']){const output=core.serializeSubtitles(cues,format),parsed=media.parseSubtitles(output);assert.equal(parsed.cues[0].text,cues[0].text);assert.equal(parsed.cues[0].startMs,1200);assert.equal(parsed.cues[0].endMs,2500);}
 assert.throws(()=>core.serializeSubtitles([{startMs:2,endMs:1,text:'bad'}]));
});
test('CSV rejects data loss and malformed quoted values while preserving escaped commas/newlines',()=>{
 const rows=tools.csvToObjects('name,note\nAn,"a,b\nline"');assert.equal(rows[0].note,'a,b\nline');assert.equal(tools.csvToObjects(tools.objectsToCsv(rows))[0].note,rows[0].note);
 assert.throws(()=>tools.csvToObjects('a,b\n1,2,3'));assert.throws(()=>tools.parseCsv('a\n"x"junk'));
 assert.equal(tools.csvToObjects('a,b\n,').length,1);
});
test('item edit preserves original namespace, supports tags/favorite and survives reload',()=>{
 const s=storage(),item=layer.createLocalItem('/galaxy/ai','Original',s,{description:'Hi {{name}}'});
 const edited=layer.updateLocalItem(item.id,{title:'Edited',description:'New content',meta:{folder:'Writing',tags:['one','one'],favorite:true}},s);
 assert.equal(edited.title,'Edited');const restored=layer.collectLocalState(s).items[0];assert.equal(restored.description,'New content');assert.deepEqual(restored.meta.tags,['one']);assert.equal(restored.meta.favorite,true);assert.equal(restored.route,'/galaxy/ai');assert.equal(layer.updateLocalItem('missing',{},s),null);
});
test('editing with failed persistence does not report success or overwrite old data',()=>{
 const s=storage(),item=layer.createLocalItem('/galaxy/dev','Original',s,{description:'const x=1;'}),blocked={getItem:s.getItem,setItem(){throw Error('quota');}};
 assert.equal(layer.updateLocalItem(item.id,{title:'No'},blocked),null);assert.equal(layer.collectLocalState(s).items[0].title,'Original');
});
test('mistake notebook derives failures from eligible real cards',()=>{
 const state={decks:[{id:'d',title:'Deck',cards:[{id:'c',front:'Q',back:'A'}]}],activities:[{type:'quiz-answer',deckId:'d',cardId:'c',correct:false,at:'2026-09-06'}]};assert.equal(core.mistakeNotebook(state)[0].wrong,1);state.decks[0].isSample=true;assert.equal(core.mistakeNotebook(state).length,0);
});
test('video export declares WebM honestly and keeps cancellation/cleanup guards',()=>{
 const api=require('../galaxy-video-renderer.js');assert.equal(api.chooseMime({isTypeSupported:type=>type==='video/webm'}),'video/webm');assert.equal(api.chooseMime({isTypeSupported:()=>false}),'');
 const src=fs.readFileSync(path.join(__dirname,'../galaxy-video-renderer.js'),'utf8');for(const part of ['captureStream(30)','new global.MediaRecorder','recorder.stop()','revokeObjectURL','signal','total>120'])assert.ok(src.includes(part));
});
test('QR uses UTF-8 for Vietnamese and restores the shared vendor encoder',()=>{
 const qr=require('../vendor/qrcode.js'),before=qr.stringToBytes;
 const svg=tools.createQrSvg('Xin chào Việt Nam',qr);assert.match(svg,/<svg/);assert.equal(qr.stringToBytes,before);
 let bytes;const factory=()=>({addData:text=>{bytes=factory.stringToBytes(text);},make(){},createSvgTag:()=>'<svg></svg>'});factory.stringToBytes=text=>[...text].map(c=>c.charCodeAt(0)&255);const saved=factory.stringToBytes;factory.stringToBytesFuncs={'UTF-8':text=>[...Buffer.from(text)]};tools.createQrSvg('Việt',factory);assert.deepEqual(bytes,[...Buffer.from('Việt')]);assert.equal(factory.stringToBytes,saved);
});
test('editing oversized snippets fails without silent truncation',()=>{
 const s=storage(),item=layer.createLocalItem('/galaxy/dev','Small',s,{description:'abc'});assert.equal(layer.updateLocalItem(item.id,{description:'x'.repeat(16001)},s),null);assert.equal(layer.collectLocalState(s).items[0].description,'abc');
});
test('stale editor versions cannot overwrite newer local content',()=>{
 const s=storage(),item=layer.createLocalItem('/galaxy/dev','Current',s,{description:'Latest'});assert.equal(layer.updateLocalItem(item.id,{description:'Old',expectedUpdatedAt:'2000-01-01T00:00:00Z'},s),null);assert.equal(layer.collectLocalState(s).items[0].description,'Latest');
});
test('vendored sanitizer matches its recorded immutable release checksum',()=>{
 const crypto=require('node:crypto'),bytes=fs.readFileSync(path.join(__dirname,'../vendor/dompurify-3.4.14.min.js'));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'c2f26ea4fc0d88141c9aa430eb515ac86fce59418ceebd85fa475b87a8d6c3e6');
});
test('production package contains all nine steps and explicit binary/publication limitations',()=>{
 const files=core.productionPackage({id:'p',title:'Project',steps:{idea:{content:'Idea',notes:'Note',checklist:[{text:'Checked',done:true}],status:'completed'}}});
 assert.equal(Object.keys(files).length,12);assert.match(files['01-idea.md'],/\[x\] Checked/);const manifest=JSON.parse(files['manifest.json']);assert.equal(manifest.steps.length,9);assert.equal(manifest.includesBinaryMedia,false);assert.throws(()=>core.productionPackage({isDemo:true}));
});
