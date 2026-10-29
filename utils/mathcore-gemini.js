'use strict';
// Gemini requests stay on the server. Use the existing configured key pool;
// neither request URLs nor returned errors contain credentials.
const {createHash}=require('node:crypto');
const {GeminiKeyPool,canTryAnotherKey}=require('./gemini-key-pool');
const DEFAULT_MODEL='gemini-3.8-flash';
let currentPool=null,poolSignature='';
function model(env=process.env){const requested=String(env.MATHCORE_GEMINI_MODEL||env.GEMINI_MODEL||DEFAULT_MODEL).trim();return /^gemini-[a-z0-9][a-z0-9.-]{1,70}$/.test(requested)?requested:DEFAULT_MODEL;}
function keyPool(keys){const signature=createHash('sha256').update(keys.join('\n')).digest('hex');if(!currentPool||signature!==poolSignature){currentPool=new GeminiKeyPool(keys,{maxAttempts:2});poolSignature=signature;}return currentPool;}
const failure=(status,message,code='GEMINI_PROVIDER_ERROR',extra={})=>Object.assign(Error(message),{status,code,...extra});
function parseResult(data){
  const candidate=data?.candidates?.[0];if(data?.promptFeedback?.blockReason||candidate?.finishReason!=='STOP')throw failure(502,'Gemini chưa trả về lời giải hoàn chỉnh. Hãy rút gọn đề hoặc thử lại.','GEMINI_RESPONSE_INCOMPLETE');
  const parts=candidate?.content?.parts,text=(Array.isArray(parts)?parts:[]).filter(part=>part&&part.thought!==true&&typeof part.text==='string').map(part=>part.text).join('').trim();
  if(!text||text.length>130000)throw failure(502,'Gemini chưa trả về nội dung phù hợp.','GEMINI_RESPONSE_INVALID');
  try{return JSON.parse(text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}catch{throw failure(502,'Gemini trả về nội dung chưa đúng định dạng. Hãy thử lại.','GEMINI_RESPONSE_INVALID');}
}
async function generate({apiKey,keys,instruction,prompt,image,schema,fetchImpl=fetch,env=process.env,pool}){
  const keyList=keys?.length?keys:apiKey?[apiKey]:[];if(!keyList.length)throw failure(503,'Gemini chưa được cấu hình trên máy chủ.','MATHCORE_NOT_CONFIGURED');
  const selected=model(env),ring=pool||keyPool(keyList);if(!ring.availableCount())throw failure(429,'Gemini đang tạm giới hạn yêu cầu. Hãy chờ rồi thử lại.','GEMINI_POOL_COOLDOWN',{retryAfter:75});
  const deadline=AbortSignal.timeout(23000),parts=[{text:prompt},...(image?[{inlineData:{mimeType:image.mimeType,data:image.data}}]:[])];let lastError;
  for(const key of ring.candidates()){
    let response;try{response=await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(selected)+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({systemInstruction:{parts:[{text:instruction}]},contents:[{role:'user',parts}],generationConfig:{responseMimeType:'application/json',responseJsonSchema:schema,maxOutputTokens:8192,...(/^gemini-[3-9]/.test(selected)?{thinkingConfig:{thinkingLevel:'LOW'}}:{})}}),signal:deadline});}catch{throw failure(deadline.aborted?504:502,deadline.aborted?'Gemini xử lý lâu hơn dự kiến. Hãy rút gọn đề và thử lại.':'Chưa kết nối được Gemini. Hãy thử lại.','GEMINI_CONNECTION_FAILED');}
    const data=await response.json().catch(()=>null);
    if(!response.ok){const message=String(data?.error?.message||'').slice(0,500);ring.reportFailure(key,response.status,message);lastError=failure(response.status===429?429:response.status>=500?502:503,response.status===429?'Gemini đang tạm giới hạn yêu cầu. Hãy chờ rồi thử lại.':'Gemini tạm thời chưa phản hồi. Hãy thử lại hoặc chọn công cụ cục bộ.','GEMINI_PROVIDER_ERROR',{upstreamStatus:response.status,retryAfter:Math.max(1,Math.min(1800,Number(response.headers?.get?.('retry-after'))||75))});if(!canTryAnotherKey(response.status,message)||deadline.aborted)break;continue;}
    const value=parseResult(data);ring.reportSuccess(key);return {value,model:selected,provider:'gemini'};
  }throw lastError||failure(502,'Chưa kết nối được Gemini.','GEMINI_PROVIDER_ERROR');
}
module.exports={DEFAULT_MODEL,model,parseResult,generate};
