'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require('../hh-mathcore-core'),D=require('../hh-mathcore-content'),H=require('../utils/mathcore-handler');
const {createEducationMemoryDB}=require('./helpers/hh-school-memory-db');
process.env.GATEWAY_AUDIT_SALT='explicit-mathcore-unit-test-salt';
const close=(a,b)=>assert.ok(Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(b)),a+' != '+b);
test('bounded parser respects powers, unary signs, implicit multiplication and degree/radian units',()=>{
 for(const [expression,value]of [['2+3*4',14],['-2^2',-4],['(-2)^2',4],['2^3^2',512],['2^-2',.25],['sqrt(9)+abs(-2)',5],['ln(e)',1],['log(100)',2],['18-2*(3+4)',4]])close(C.calculator(expression),value);
 close(C.evaluate(C.parse('2x(x+1)'),3),24);close(C.calculator('sin(30)','deg'),.5);close(C.calculator('sin(pi/6)','rad'),.5);assert.ok(Number.isNaN(C.evaluate(C.parse('1/x'),0)));
});
test('expression input cannot execute code, access objects or consume unbounded recursion',()=>{
 for(const input of ['globalThis.process.exit()','constructor','x[0]','alert(1)','2;3','sin x','2+','(2+3','2+3)','('.repeat(40)+'1'+')'.repeat(40),'1+'.repeat(300)+'1'])assert.throws(()=>C.parse(input),input);
 for(const input of ['0^0','1/0','sqrt(-1)','ln(-1)','exp(10000)','tan(pi/2)'])assert.throws(()=>C.calculator(input),input);
 assert.throws(()=>C.calculator('x+1'),/biến x/);assert.equal(global.mathcoreInjected,undefined);
});
test('linear equations and degenerate cases retain their correct real solution sets',()=>{
 assert.equal(C.solveEquation('2x+3=11').answer,'x = 4');assert.equal(C.solveEquation('3(x-2)=2x+1').answer,'x = 7');assert.match(C.solveEquation('0x=0').answer,/Mọi số/);assert.match(C.solveEquation('2x+1=2x+3').answer,/vô nghiệm/);assert.match(C.solveEquation('-2x=8').answer,/x = -4/);
});
test('quadratic equations expose conditions, discriminant, roots, alternate method and hints',()=>{
 const result=C.solveEquation('x^2-5x+6=0');assert.equal(result.answer,'x₁ = 2; x₂ = 3');assert.equal(result.provider,'local');assert.equal(result.hints.length,3);assert.ok(result.conditions.length);assert.match(result.alternative,/nhân tử/);
 assert.match(C.solveEquation('x^2+2x+1=0').answer,/Nghiệm kép x = -1/);assert.match(C.solveEquation('x^2+1=0').answer,/không có nghiệm thực/);assert.equal(C.solveEquation('x^2=0').answer,'Nghiệm kép x = 0');
 assert.match(C.solveEquation('3x=1').answer,/≈/);assert.match(C.solveEquation('x^2=2').answer,/≈/);assert.throws(()=>C.solveEquation('0.0000000000001x=1'),/quá nhỏ/);
 for(const input of ['x^0=1','0^0=1','x/x=1','1/(x-1)=2','x^3=1','sin(x)=0','x=1=2','x^-1=2'])assert.throws(()=>C.solveEquation(input),input);
});
test('linear and quadratic solver agrees with independently generated roots',()=>{
 for(let a=-5;a<=5;a++){if(!a)continue;for(let x=-6;x<=6;x++){const b=7;const result=C.solveEquation(a+'x+'+b+'='+(a*x+b));assert.equal(result.answer,'x = '+x);}}
 for(let p=-5;p<=5;p++)for(let q=p;q<=5;q++){const b=-(p+q),c=p*q,result=C.solveEquation('x^2+('+b+')x+('+c+')=0');if(p===q)assert.equal(result.answer,'Nghiệm kép x = '+p);else assert.equal(result.answer,'x₁ = '+p+'; x₂ = '+q);}
});
test('line checker identifies the incorrect transition and explains its limited scope',()=>{
 const rows=C.checkLines('2x+3=11','2x=8\nx=4\n2x=14\nEm chuyển vế');assert.deepEqual(rows.map(x=>x.status),['equivalent','equivalent','review','unread']);assert.equal(rows[2].line,3);assert.ok(rows.every(x=>x.scope));
});
test('all24topics have useful formulas, conditions, hints, examples and distinct IDs',()=>{
 assert.equal(D.topics.length,24);assert.equal(new Set(D.topics.map(t=>t.id)).size,24);
 for(const t of D.topics){assert.ok(t.formulas.length&&t.hints.length&&t.steps.length,t.id);for(const field of ['title','summary','conditions','problem','answer','mistake','reflect'])assert.ok(t[field].length>0,t.id+' '+field);assert.ok(D.sources.some(s=>s.id===t.source));}
});
test('quiz generations have four mathematically distinct options, one answer and deterministic replay',()=>{
 for(const topic of D.practiceTopics)for(const difficulty of ['basic','standard','advanced'])for(let seed=1;seed<=30;seed++){
  const set=C.practice(topic,difficulty,5,seed);assert.deepEqual(set,C.practice(topic,difficulty,5,seed));assert.equal(set.length,5);
  for(const q of set){assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);const values=q.options.map(x=>C.calculator(x));for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)assert.ok(Math.abs(values[i]-values[j])>1e-10,JSON.stringify(q));assert.ok(q.correct>=0&&q.correct<4);assert.ok(q.explanation);}
 }
});
test('solid measures and invalid dimensions are bounded and correct',()=>{
 close(C.solidMeasure('box',{w:4,d:3,h:6}).volume,72);close(C.solidMeasure('pyramid',{w:4,d:3,h:6}).volume,24);close(C.solidMeasure('sphere',{r:3}).volume,36*Math.PI);close(C.solidMeasure('cone',{r:2,h:6}).volume,8*Math.PI);assert.equal(C.dimensions({w:-1,h:Infinity,d:100}).w,.5);assert.equal(C.dimensions({d:100}).d,10);
});
test('numerical tangent avoids claiming a derivative at a cusp or domain boundary',()=>{
 close(C.derivativeAt(C.parse('x^2'),2),4);close(C.derivativeAt(C.parse('sin(x)'),0),1);for(const expression of ['abs(x)','sqrt(x)','1/x'])assert.ok(Number.isNaN(C.derivativeAt(C.parse(expression),0)),expression);
});
test('account-scoped state bounds drafts, notes and history and rejects future/corrupt versions',()=>{
 assert.notEqual(C.preferenceKey({id:'a'}),C.preferenceKey({id:'b'}));assert.notEqual(C.preferenceKey({id:'a'}),C.preferenceKey(null));for(const value of [[],{},42,{version:999,saved:[],attempts:[],notes:''}])assert.throws(()=>C.preferences(value));
 const p=C.preferences({...C.defaults(),draft:{problem:'a'.repeat(10000),attempt:'b'.repeat(10000)},notes:'n'.repeat(40000),photo:'private image'});assert.equal(p.draft.problem.length,5000);assert.equal(p.draft.attempt.length,8000);assert.equal(p.notes.length,30000);assert.equal(p.photo,undefined);
});
test('HTML escaping handles hostile problem text and photo boxes reject invalid coordinates',()=>{
 assert.equal(C.escape('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');for(const b of [{x:NaN,y:0,w:1,h:1},{x:-.1,y:0,w:1,h:1},{x:.8,y:0,w:.3,h:1},{x:0,y:0,w:0,h:1}])assert.throws(()=>C.imageBox(b));assert.deepEqual(C.imageBox({x:.1,y:.2,w:.3,h:.4}),{x:.1,y:.2,w:.3,h:.4});
});
const response=()=>({code:0,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(value){this.value=value;return this;},end(){return this;}});
const tutorFixture=()=>({title:'QA tutor fixture',interpretation:'Phương trình bậc nhất.',conditions:['x thực'],hints:['Em sẽ trừ số nào?','Hệ số của x bằng bao nhiêu?'],steps:[{title:'Tách ẩn',text:'Trừ 3 và chia 2.',formula:'x = 4'}],answer:'x = 4',alternative:'Thử lại nghiệm.',checks:[],uncertainties:[]});
const photoFixture=()=>({readBack:'2x + 3 = 11\n2x = 14',summary:'Một dòng cần xem lại.',uncertainties:[],nextHint:'Khi chuyển +3 sang vế phải, dấu cần thế nào?',observations:[{quote:'2x = 14',status:'review',note:'Xem lại dấu khi chuyển vế.',box:{x:.1,y:.3,w:.6,h:.1}}]});
function request(resource='status',body,extra={}){return {method:body?'POST':'GET',query:{mathResource:resource},headers:{origin:'https://hoang8.com'},body,...extra};}
const png=()=>{const buf=Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(buf);buf.write('IHDR',12,'ascii');buf.writeUInt32BE(800,16);buf.writeUInt32BE(600,20);return {mimeType:'image/png',data:buf.toString('base64')};};
test('AI status is public and accurately reports a missing key without touching DB/provider',async()=>{
 const handler=H.createHandler({keys:()=>[],getDb:()=>{throw Error('DB should not run');},generate:()=>{throw Error('Provider should not run');}}),res=response();await handler(request(),res);assert.equal(res.code,200);assert.equal(res.value.configured,false);assert.equal(res.value.photo.savedOnServer,false);assert.equal(res.headers['Cache-Control'],'no-store');
});
test('AI requires authenticated account, rejects untrusted origins, and exposes configuration honestly',async()=>{
 for(const [user,keys,req,expected]of [[null,['test'],request('tutor',{question:'2x=8'}),401],[{_id:'member'},[],request('tutor',{question:'2x=8'}),503],[{_id:'member'},['test'],request('tutor',{question:'2x=8'},{headers:{origin:'https://evil.invalid','sec-fetch-site':'cross-site'}}),403]]){
  const handler=H.createHandler({getUser:async()=>user,keys:()=>keys,generate:()=>{throw Error('Provider should not run');}}),res=response();await handler(req,res);assert.equal(res.code,expected);
 }
});
test('AI provider gets bounded data, uses both user/IP limits and withholds solution until explicitly revealed',async()=>{
 const db=createEducationMemoryDB(),limits=[],calls=[];const handler=H.createHandler({getUser:async()=>({_id:'member'}),getDb:async()=>db,keys:()=>['explicit-test-key'],rateLimit:async(...args)=>limits.push(args.slice(1)),generate:async input=>{calls.push(input);return {value:tutorFixture(),model:'explicit-qa-provider'};}});
 let res=response();await handler(request('tutor',{question:'2x+3=11',topic:'linear'}),res);assert.equal(res.code,200);assert.equal(res.value.result.answer,'');assert.deepEqual(res.value.result.steps,[]);assert.equal(limits.length,2);assert.equal(calls[0].topic.id,'linear');
 res=response();await handler(request('tutor',{question:'2x+3=11',reveal:true}),res);assert.equal(res.value.result.answer,'x = 4');assert.equal(res.value.result.steps.length,1);
});
test('photo analysis rejects forged image MIME/base64, oversize payloads and oversized dimensions',()=>{
 assert.equal(H.__test.validateImage(png()).mimeType,'image/png');const oversized=png(),buf=Buffer.from(oversized.data,'base64');buf.writeUInt32BE(100000,16);oversized.data=buf.toString('base64');
 for(const image of [{mimeType:'image/svg+xml',data:'AAAA'}, {mimeType:'image/jpeg',data:png().data}, {mimeType:'image/png',data:'file://private'},oversized,{mimeType:'image/png',data:'A'.repeat(2200000)}])assert.throws(()=>H.__test.validateImage(image));
});
test('photo response keeps only valid quoted lines and bounded regions; uncertain positions are removed',()=>{
 const good=photoFixture();assert.equal(H.__test.validatePhoto(good).observations[0].box.x,.1);
 for(const mutate of [v=>v.observations[0].quote='not in readBack',v=>v.observations[0].box.x=.99]){const v=photoFixture();mutate(v);assert.throws(()=>H.__test.validatePhoto(v));}
 const uncertain=photoFixture();uncertain.observations[0].status='uncertain';assert.equal(H.__test.validatePhoto(uncertain).observations[0].box,null);
});
test('invented typed-work citations are rejected before reaching the browser',()=>{
 const value=tutorFixture();value.checks=[{quote:'not actually in work',status:'review',note:'test'}];assert.throws(()=>H.__test.validateTutor(value,'2x=8'),e=>e.code==='MATHCORE_QUOTE_INVALID');
});
test('image endpoint passes validated image and does not write problem/image to persistent storage',async()=>{
 const db=createEducationMemoryDB(),handler=H.createHandler({getUser:async()=>({_id:'member'}),getDb:async()=>db,keys:()=>['explicit-test'],rateLimit:async()=>{},generate:async({kind,image})=>{assert.equal(kind,'photo');assert.equal(image.mimeType,'image/png');return {value:photoFixture(),model:'fixture'};}}),res=response();await handler(request('photo',{question:'Kiểm tra bài',image:png()}),res);assert.equal(res.code,200);assert.equal(res.value.result.observations.length,1);assert.deepEqual(db.rows('mathcore'),[]);
});
test('provider instruction and payload use existing Responses API with images and strict schema',async()=>{
 let body;const out=await H.__test.generate({kind:'photo',question:'Xem bài',attempt:'',topic:D.topic('linear'),image:png(),apiKey:'explicit-test-key',fetchImpl:async(url,init)=>{assert.equal(url,'https://api.openai.com/v1/responses');body=JSON.parse(init.body);return new Response(JSON.stringify({output_text:JSON.stringify(photoFixture())}),{status:200});}});assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.equal(body.input[0].content[1].type,'input_image');assert.match(body.instructions,/không phỏng đoán vị trí/);assert.equal(out.value.readBack,photoFixture().readBack);
});
test('route integration includes sidebar category, command search, lazy assets and module dispatch',()=>{
 const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),client=read('script.js'),loader=read('performance-loader.js'),worker=read('sw.js');assert.match(client,/groupIds: \["learn", "mathcore"/);assert.match(client,/HHMathCoreAI\.mount/);assert.match(client,/HHMathCoreAI\?\.unmount/);assert.match(client,/sidebarSearchAliases\.mathcore/);assert.match(client,/item\.id === "mathcore"/);
 for(const asset of ['hh-mathcore-core.js','hh-mathcore-content.js','hh-mathcore-graphics.js','hh-mathcore-ai.js','hh-mathcore-ai.css']){const version=asset==='hh-mathcore-graphics.js'?1:2;assert.ok(loader.includes(asset+'?v='+version));assert.ok(worker.includes('./'+asset+'?v='+version));}
 assert.match(read('api/modules/[moduleId]/actions.js'),/moduleId === "mathcore"/);assert.ok(JSON.parse(read('vercel.json')).rewrites.some(r=>r.source==='/api/mathcore/:resource'));
 assert.equal(require('../hh-core-gateway').isCoreRoute('/mathcore/lab'),true);
});
test('OCR cancellation settles a pending job and terminates its worker',async()=>{
 const vm=require('node:vm');let terminated=0,started;const ready=new Promise(r=>{started=r;}),worker={setParameters:async()=>{},recognize:()=>{started();return new Promise(()=>{});},terminate:async()=>{terminated++;}},scope={HHMathCore:C,Tesseract:{createWorker:async()=>worker}},context={window:scope,document:{baseURI:'https://hoang8.com/'},URL,DOMException};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../hh-mathcore-ocr.js'),'utf8'),context);const session=scope.HHMathCoreOCR.create(),pending=session.recognize(new Uint8Array([1]));await ready;session.destroy();await assert.rejects(pending,e=>e.name==='AbortError');assert.equal(terminated,1);session.destroy();assert.equal(terminated,1);
});
test('OCR positions come from real line boxes and reject coordinates outside the image',()=>{
 const vm=require('node:vm'),scope={HHMathCore:C};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../hh-mathcore-ocr.js'),'utf8'),{window:scope});const rows=scope.HHMathCoreOCR.lines({blocks:[{paragraphs:[{lines:[{text:'2x = 14',confidence:90,bbox:{x0:10,y0:20,x1:60,y1:40}},{text:'outside',bbox:{x0:101,y0:0,x1:150,y1:20}}]}]}]},100,100);assert.equal(rows[0].box.x,.1);assert.equal(rows[0].box.h,.2);assert.equal(rows[1].box,null);
});
