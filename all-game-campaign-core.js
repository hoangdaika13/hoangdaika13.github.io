(function(scope,factory){'use strict';const api=factory();scope.HHAllGameCampaignCore=api;if(typeof module==='object'&&module.exports)module.exports=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION=1,targets=Object.freeze({puzzle:24,action:16,story:16,strategy:10,season:12,board:24,music:12,learning:24,creative:16,coop:16});
  const clone=value=>JSON.parse(JSON.stringify(value));
  const bounded=(value,max)=>Number.isFinite(Number(value))?Math.max(0,Math.min(max,Number(value))):0;
  function hash(value){let n=2166136261;for(const c of String(value))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;}
  function stableSignature(value){const sort=v=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>!['seed','color','accent','thumbnail','art'].includes(k)).map(k=>[k,sort(v[k])])):v;return JSON.stringify(sort(value));}
  function validateSpec(spec){
    const errors=[];if(!spec?.id||!targets[spec.model])errors.push('ID/model chưa hợp lệ');
    if(!Array.isArray(spec?.missions)||spec.missions.length<(targets[spec?.model]||1))errors.push('Nội dung chưa đạt cam kết');
    if(!Array.isArray(spec?.chapters)||spec.chapters.length<1)errors.push('Chưa có chương');
    if(typeof spec?.createEngine!=='function')errors.push('Chưa có engine campaign');
    const ids=new Set(),chapters=new Set((spec?.chapters||[]).map(c=>c.id));
    for(const m of spec?.missions||[]){if(!m.id||ids.has(m.id))errors.push('Trùng/thiếu mission ID');ids.add(m.id);if(!m.title||!m.objective||!m.mechanicIntroduced||!m.setup)errors.push('Thiếu spec màn '+m.id);if(!chapters.has(m.chapter))errors.push('Chương không tồn tại '+m.id);}
    for(const m of spec?.missions||[])for(const id of m.prerequisites||[])if(!ids.has(id))errors.push('Prerequisite không tồn tại '+id);
    return{ok:!errors.length,errors};
  }
  function defineSpec(spec){const result=validateSpec(spec);if(!result.ok)throw Error(spec.id+': '+result.errors.join('; '));return Object.freeze(Object.assign({contentVersion:1},spec));}
  function normalizeProgress(spec,input){
    const source=input&&input.version===VERSION&&input.gameId===spec.id?input:{},completed=Object.create(null),flags=Object.create(null),known=new Set(spec.missions.map(m=>m.id));
    for(const id of known){const row=source.completed?.[id];if(!row||typeof row!=='object')continue;completed[id]={score:bounded(row.score,1e12),outcome:['won','lost','draw'].includes(row.outcome)?row.outcome:'won',at:bounded(row.at,8640000000000000)};}
    for(const [id,value] of Object.entries(source.flags||{}).slice(0,128))if(/^[a-z0-9_-]{1,80}$/i.test(id)&&!['__proto__','constructor','prototype'].includes(id)&&['string','number','boolean'].includes(typeof value))flags[id]=typeof value==='string'?value.slice(0,300):typeof value==='number'?Number.isFinite(value)?value:0:value;
    return{version:VERSION,gameId:spec.id,contentVersion:spec.contentVersion||1,completed,flags,activeMission:known.has(source.activeMission)?source.activeMission:null,updatedAt:bounded(source.updatedAt,8640000000000000)};
  }
  function available(spec,mission,progress){
    const index=spec.missions.indexOf(mission),requirements=Array.isArray(mission.prerequisites)?mission.prerequisites:index>0?[spec.missions[index-1].id]:[];
    return requirements.every(id=>progress.completed[id])&&Object.entries(mission.requiresFlags||{}).every(([key,value])=>progress.flags[key]===value);
  }
  function outcome(spec,state,mission){
    const actual=state.result==='draw'?'draw':state.status==='won'?'won':state.status==='lost'?'lost':null;
    if(typeof spec.complete==='function'){const result=spec.complete(state,mission);if(result)return Object.assign({score:Math.max(0,Number(state.score)||0),outcome:actual,complete:false},result);}
    return{complete:actual==='won'||spec.model==='season'&&!!actual,outcome:actual,score:Math.max(0,Number(state.score)||0),flags:state.campaignFlags||{}};
  }
  function applyCompletion(spec,mission,progress,result,now=Date.now()){
    const next=normalizeProgress(spec,progress);if(!result.complete)return next;
    const old=next.completed[mission.id];next.completed[mission.id]={score:Math.max(old?.score||0,Number(result.score)||0),outcome:result.outcome||'won',at:now};
    Object.assign(next.flags,result.flags||{});if(result.ending)next.flags.ending=String(result.ending).slice(0,300);next.activeMission=null;next.updatedAt=now;return normalizeProgress(spec,next);
  }
  function createEngine(spec,base,missionId,context={}){
    const mission=typeof missionId==='object'?missionId:spec.missions.find(m=>m.id===missionId);if(!mission)throw Error('Không tìm thấy màn');
    const implementation=spec.createEngine(base,mission,context);if(!implementation?.create||!implementation.step||!implementation.describe||!implementation.draw)throw Error('Engine campaign chưa đủ chức năng');
    const engine={id:spec.id,realtime:implementation.realtime??base.realtime,rules:implementation.rules||base.rules||{},
      create(options={}){const state=implementation.create(Object.assign({},options,{seed:options.seed??hash(spec.id+':'+mission.id),campaignMission:mission,mission,progress:clone(context.progress||{})}));if(state.id!==spec.id)throw Error('Campaign đổi ID game');return Object.assign({},state,{campaign:{version:VERSION,gameId:spec.id,mission:mission.id,chapter:mission.chapter,contentVersion:spec.contentVersion||1}});},
      step(state,action,dt){const next=implementation.step(state,action,dt);if(next===state)return state;return Object.assign({},next,{campaign:state.campaign});},
      describe(state){const description=implementation.describe(state);return Object.assign({},description,{campaignObjective:mission.objective});},
      draw(ctx,state,options){return implementation.draw(ctx,state,options);}
    };return Object.freeze(engine);
  }
  return Object.freeze({VERSION,targets,clone,hash,stableSignature,validateSpec,defineSpec,normalizeProgress,available,outcome,applyCompletion,createEngine});
});
