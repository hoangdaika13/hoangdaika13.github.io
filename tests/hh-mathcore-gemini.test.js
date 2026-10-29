'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../utils/mathcore-gemini'),H=require('../utils/mathcore-handler'),C=require('../hh-mathcore-core'),D=require('../hh-mathcore-content');
const {GeminiKeyPool,parseGeminiKeys}=require('../utils/gemini-key-pool');
const key='explicit-gemini-qa-key-0001',other='explicit-gemini-qa-key-0002';
process.env.GATEWAY_AUDIT_SALT='explicit-mathcore-gemini-qa-salt';
const tutor=()=>({title:'Gemini fixture',interpretation:'Giải phương trình.',conditions:['x thực'],hints:['Em trừ số nào ở cả hai vế?'],steps:[{title:'Tách ẩn',text:'Trừ 3, chia 2.',formula:'x = 4'}],answer:'x = 4',alternative:'Thử lại.',checks:[],uncertainties:[]});
const photo=()=>({readBack:'2x = 14',summary:'Xem lại chuyển vế.',uncertainties:[],nextHint:'11 − 3 bằng bao nhiêu?',observations:[{quote:'2x = 14',status:'review',note:'Xem lại dấu.',box:null}]});
const success=value=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]}),{status:200});
const response=()=>({code:0,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(value){this.value=value;return this;},end(){return this;}});
const req=(body,resource='tutor',extra={})=>({method:body?'POST':'GET',query:{mathResource:resource},headers:{origin:'https://hoang8.com'},body,...extra});
const setup=extra=>H.createHandler({getUser:async()=>({_id:'gemini-qa-member'}),getDb:async()=>({}),rateLimit:async()=>{},keys:()=>[],geminiKeys:()=>[key],...extra});
const generateArgs=extra=>({apiKey:key,instruction:'Trợ giảng toán.',prompt:'2x+3=11',schema:H.__test.tutorSchema,env:{},pool:new GeminiKeyPool([key]),...extra});
const png=()=>{const buf=Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(buf);buf.write('IHDR',12,'ascii');buf.writeUInt32BE(800,16);buf.writeUInt32BE(600,20);return {mimeType:'image/png',data:buf.toString('base64')};};

test('Gemini reuses existing server key aliases and respects an explicit valid math model',()=>{
 assert.deepEqual(parseGeminiKeys({GEMINI_API_KEYS:key+';'+other,GEMINI_API_KEY:key}),[key,other]);assert.deepEqual(parseGeminiKeys({GOOGLE_AI_API_KEY:key}),[key]);
 assert.equal(G.model({}),G.DEFAULT_MODEL);assert.equal(G.model({MATHCORE_GEMINI_MODEL:'gemini-2.5-flash',GEMINI_MODEL:'gemini-3.5-flash'}),'gemini-2.5-flash');assert.equal(G.model({GEMINI_MODEL:'gemini-3.5-flash'}),'gemini-3.5-flash');assert.equal(G.model({MATHCORE_GEMINI_MODEL:'https://evil.invalid/steal'}),G.DEFAULT_MODEL);
});
test('public status advertises Gemini independently from OpenAI without touching private services',async()=>{
 const handler=setup({getDb:()=>assert.fail('no DB on status'),getUser:()=>assert.fail('no auth lookup on status'),generate:()=>assert.fail('no provider on status')}),res=response();await handler(req(null,'status'),res);
 assert.equal(res.code,200);assert.equal(res.value.configured,true);assert.equal(res.value.defaultProvider,'gemini');assert.equal(res.value.providers.gemini.configured,true);assert.equal(res.value.providers.openai.configured,false);assert.equal(res.value.requiresLogin,true);assert.equal(res.value.photo.savedOnServer,false);assert.equal(res.headers['Cache-Control'],'no-store');assert.ok(!JSON.stringify(res.value).includes(key));
});
test('default Gemini and explicit OpenAI use only the selected provider key pool',async()=>{
 const calls=[],handler=setup({keys:()=>['explicit-openai-key'],generate:async input=>{calls.push(input);return {value:tutor(),model:'fixture'};}});
 for(const body of [{question:'2x+3=11'},{provider:'openai',question:'2x+3=11'}]){const res=response();await handler(req(body),res);assert.equal(res.code,200);assert.equal(res.value.result.provider,calls.at(-1).provider);}
 assert.equal(calls[0].provider,'gemini');assert.equal(calls[0].apiKey,key);assert.deepEqual(calls[0].keys,[key]);assert.equal(calls[1].provider,'openai');assert.equal(calls[1].apiKey,'explicit-openai-key');
});
test('unavailable or invalid selected provider never falls back to another AI',async()=>{
 const handler=setup({generate:()=>assert.fail('no provider call')});for(const [provider,status]of [['openai',503],['other',400],[null,400],[{},400]]){const res=response();await handler(req({provider,question:'2x=8'}),res);assert.equal(res.code,status);}
});
test('Gemini mutations keep the existing authentication, origin and shared rate limits',async()=>{
 for(const [extra,request,status]of [[{getUser:async()=>null},req({provider:'gemini',question:'2x=8'}),401],[{},req({provider:'gemini',question:'2x=8'},'tutor',{headers:{origin:'https://evil.invalid','sec-fetch-site':'cross-site'}}),403],[{rateLimit:async()=>{throw Object.assign(Error('rate fixture'),{statusCode:429,retryAfter:120});}},req({provider:'gemini',question:'2x=8'}),429]]){const res=response();await setup({...extra,generate:()=>assert.fail('no provider call')})(request,res);assert.equal(res.code,status);if(status===429)assert.equal(res.headers['Retry-After'],'120');}
});
test('text request reaches Google REST with schema, private header and original teaching instructions',async()=>{
 let payload;const result=await H.__test.generate({provider:'gemini',kind:'tutor',question:'2x+3=11',attempt:'2x=14',topic:D.topic('linear'),apiKey:key,fetchImpl:async(url,init)=>{assert.match(url,/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-[a-z0-9.-]+:generateContent$/);assert.ok(!url.includes(key));assert.equal(init.headers['x-goog-api-key'],key);assert.ok(init.signal instanceof AbortSignal);payload=JSON.parse(init.body);return success(tutor());}});
 assert.equal(result.provider,'gemini');assert.match(payload.systemInstruction.parts[0].text,/KHÔNG chứa đáp số cuối/);assert.match(payload.systemInstruction.parts[0].text,/không bịa giả thiết/);assert.equal(payload.generationConfig.responseMimeType,'application/json');assert.deepEqual(payload.generationConfig.responseJsonSchema,H.__test.tutorSchema);assert.ok(payload.generationConfig.maxOutputTokens<=8192);assert.deepEqual(payload.generationConfig.thinkingConfig,{thinkingLevel:'LOW'});assert.equal(payload.tools,undefined);assert.equal(JSON.parse(payload.contents[0].parts[0].text).attempt,'2x=14');
});
test('Gemini handler withholds the worked answer until reveal and enforces real typed-work quotes',async()=>{
 const limits=[],handler=setup({rateLimit:async(...args)=>limits.push(args.slice(1)),generate:input=>H.__test.generate({...input,fetchImpl:async()=>success(tutor())})});
 for(const reveal of [false,true]){const res=response();await handler(req({provider:'gemini',question:'2x+3=11',reveal}),res);assert.equal(res.code,200);assert.equal(res.value.result.provider,'gemini');assert.equal(res.value.result.answer,reveal?'x = 4':'');assert.equal(res.value.result.steps.length,reveal?1:0);}
 assert.equal(limits.length,4);assert.match(limits[0][0],/^mathcore-user:/);assert.match(limits[1][0],/^mathcore-ip:/);
 const bad=tutor();bad.checks=[{quote:'invented step',status:'review',note:'fixture'}];const res=response();await setup({generate:input=>H.__test.generate({...input,fetchImpl:async()=>success(bad)})})(req({provider:'gemini',question:'2x+3=11',attempt:'2x=14'}),res);assert.equal(res.code,502);assert.equal(res.value.code,'MATHCORE_QUOTE_INVALID');
});
test('Gemini image input stays inline and shares transcript, box and uncertainty validation',async()=>{
 const image=png();let payload;const handler=setup({generate:input=>H.__test.generate({...input,fetchImpl:async(_url,init)=>{payload=JSON.parse(init.body);return success(photo());}})}),res=response();await handler(req({provider:'gemini',question:'Kiểm tra bài',image},'photo'),res);
 assert.equal(res.code,200);assert.equal(res.value.result.provider,'gemini');assert.equal(res.value.result.observations[0].box,null);assert.deepEqual(payload.contents[0].parts[1].inlineData,{mimeType:image.mimeType,data:image.data});assert.match(payload.systemInstruction.parts[0].text,/không phỏng đoán vị trí/);assert.deepEqual(payload.generationConfig.responseJsonSchema.properties.observations.items.properties.box.type,['object','null']);
 for(const bad of [{...photo(),readBack:'2x = 8'},{...photo(),observations:[{...photo().observations[0],box:{x:.99,y:0,w:.5,h:.1}}]}]){const rejected=response();await setup({generate:input=>H.__test.generate({...input,fetchImpl:async()=>success(bad)})})(req({provider:'gemini',question:'Kiểm tra',image},'photo'),rejected);assert.equal(rejected.code,502);}
});
test('Gemini parsing rejects blocked, truncated, malformed or thought-only output',()=>{
 for(const data of [{promptFeedback:{blockReason:'SAFETY'}},{candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'{}'}]}}]},{candidates:[{content:{parts:[{text:'{}'}]}}]},{candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'private reasoning'}]}}]},{candidates:[{finishReason:'STOP',content:{parts:{text:'not an array'}}}]},{candidates:[{finishReason:'STOP',content:{parts:[null]}}]},{candidates:[{finishReason:'STOP',content:{parts:[{text:'not json'}]}}]}])assert.throws(()=>G.parseResult(data),error=>error.status===502);
 const result=G.parseResult({candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'ignored'},{text:'```json\n{"title":"Safe result"}\n```'}]}}]});assert.deepEqual(result,{title:'Safe result'});
});
test('valid JSON with invalid tutor data cannot bypass MATHCORE output validation',async()=>{
 const res=response();await setup({generate:input=>H.__test.generate({...input,fetchImpl:async()=>success({...tutor(),hints:[]})})})(req({provider:'gemini',question:'2x=8'}),res);assert.equal(res.code,502);assert.equal(res.value.code,'MATHCORE_OUTPUT_INVALID');
});
test('a quota-limited key rotates at most twice within the same provider, with one deadline',async()=>{
 const pool=new GeminiKeyPool([key,other],{maxAttempts:2}),seen=[],signals=[];const out=await G.generate(generateArgs({keys:[key,other],pool,fetchImpl:async(_url,init)=>{seen.push(init.headers['x-goog-api-key']);signals.push(init.signal);return seen.length===1?new Response(JSON.stringify({error:{message:'quota limit: 0'}}),{status:429}):success(tutor());}}));assert.deepEqual(seen,[key,other]);assert.equal(signals[0],signals[1]);assert.equal(pool.availableCount(),1);assert.equal(out.provider,'gemini');
});
test('exhausted Gemini key pool returns a safe cooldown and makes no further requests',async()=>{
 const pool=new GeminiKeyPool([key,other],{maxAttempts:2});let count=0;const args=generateArgs({keys:[key,other],pool,fetchImpl:async()=>{count++;return new Response(JSON.stringify({error:{message:'quota with secret '+key}}),{status:429,headers:{'retry-after':'9999'}});}});
 await assert.rejects(G.generate(args),error=>error.status===429&&error.retryAfter===1800&&!error.message.includes(key));assert.equal(count,2);assert.equal(pool.availableCount(),0);await assert.rejects(G.generate(args),error=>error.code==='GEMINI_POOL_COOLDOWN');assert.equal(count,2);
});
test('invalid configuration and network failures are sanitized without changing provider or model',async()=>{
 let count=0;await assert.rejects(G.generate(generateArgs({fetchImpl:async()=>{count++;return new Response(JSON.stringify({error:{message:'bad schema '+key}}),{status:400});}})),error=>error.status===503&&!error.message.includes(key));assert.equal(count,1);
 await assert.rejects(G.generate(generateArgs({fetchImpl:async()=>{throw Error('private network details '+key);}})),error=>error.status===502&&error.code==='GEMINI_CONNECTION_FAILED'&&!error.message.includes(key));
 await assert.rejects(G.generate({keys:[],env:{}}),error=>error.status===503);
});
test('older Gemini models omit unsupported thinking-level settings',async()=>{
 await G.generate(generateArgs({env:{MATHCORE_GEMINI_MODEL:'gemini-2.5-flash'},fetchImpl:async(url,init)=>{assert.match(url,/gemini-2\.5-flash:generateContent$/);assert.equal(JSON.parse(init.body).generationConfig.thinkingConfig,undefined);return success(tutor());}}));
});
test('notebook migration preserves old progress and Gemini provenance under schema3',()=>{
 for(const version of [1,2]){const p=C.preferences({...C.defaults(),version,notes:'old notes',saved:[{id:'g',provider:'gemini',problem:'2x=8',answer:'x=4',hints:['Trừ hai vế.'],steps:[{title:'Tách ẩn',text:'Chia 2.',formula:'x=4'}]}]});assert.equal(p.version,3);assert.equal(p.notes,'old notes');assert.equal(p.saved[0].provider,'gemini');assert.equal(p.saved[0].steps.length,1);assert.equal(C.preferences(JSON.parse(JSON.stringify(p))).saved[0].provider,'gemini');}
 assert.throws(()=>C.preferences({...C.defaults(),version:4}));assert.equal(C.storedLesson({problem:'x=1',answer:'1',provider:'fake-online'}).provider,'local');
});
