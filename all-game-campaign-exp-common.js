(function(scope,factory){'use strict';const api=factory(scope.HHAllGameStudio||(typeof require==='function'?require('./all-game-studio-core.js'):null));scope.HHAllGameCampaignExpCommon=api;if(typeof module==='object'&&module.exports)module.exports=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const MAX_UNDO_ENTRIES=32,MAX_UNDO_BYTES=100000;
 const encoder=typeof TextEncoder==='function'?new TextEncoder():null;
 function serializedBytes(value){const json=JSON.stringify(value);return encoder?encoder.encode(json).length:encodeURIComponent(json).replace(/%[A-F\d]{2}/gi,'x').length;}
 function boundedUndo(history,before){const next=[...history,before].slice(-MAX_UNDO_ENTRIES);while(next.length&&serializedBytes(next)>MAX_UNDO_BYTES)next.shift();return next;}
 const readable=value=>String(value).replace(/([\p{L}])(\d)/gu,'$1 $2').replace(/(\d)([\p{L}])/gu,'$1 $2').replace(/([:;,])(?=\p{L})/gu,'$1 ').replace(/\s*([≥≤→±])\s*/g,' $1 ').replace(/\s+/g,' ').trim();
 function flagsOf(progress){return clone(progress?.flags||{});}
 function define(id,model,configs,chapterNames,mechanics){
  const chapters=chapterNames.map((title,i)=>({id:id+'-chapter-'+(i+1),title,summary:mechanics[i%mechanics.length]}));
  const per=Math.ceil(configs.length/chapters.length);
  const missions=configs.map((config,i)=>({id:id+'-mission-'+String(i+1).padStart(2,'0'),title:config.title||chapterNames[Math.floor(i/per)]+' · '+(i%per+1),chapter:chapters[Math.floor(i/per)].id,contentVersion:1,objective:readable(config.objective),mechanicIntroduced:config.mechanic||mechanics[Math.floor(i/per)%mechanics.length],setup:config,availableTools:config.tools||['keyboard','pointer'],resources:config.resources||{},hazards:config.hazards||[],prerequisites:i?[id+'-mission-'+String(i).padStart(2,'0')]:[],winConditions:(config.winConditions||[config.objective]).map(readable),loseConditions:config.loseConditions||['Vi phạm điều kiện thất bại của mô phỏng gốc.'],hintSteps:(config.hints||[config.objective,'Đọc trạng thái và phản hồi sau từng thao tác; hoàn tác hoặc khởi động lại nếu cần.']).map(readable),rewards:{score:100,entry:config.discovery||config.objective},choices:config.choices||[]}));
  const spec={id,contentVersion:1,model,chapters,missions,
   createEngine(base,mission,context={}){
    const setup=mission.setup;
    return{id,realtime:base.realtime,rules:base.rules,
     create(options={}){let s=base.create(Object.assign({},options,{seed:setup.seed??options.seed??id}));Object.assign(s,clone(setup.state||{}));s.content=clone(setup.content||{});s.missionId=mission.id;s.missionMoves=0;s.missionFlags=flagsOf(context.progress||options.progress);s.missionChoice='';s.missionUndo=[];s.missionHint=0;for(const e of setup.flagEffects||[])if(s.missionFlags[e.key]===e.value){const path=e.field.split('.'),last=path.pop();let target=s;for(const key of path)target=target?.[key];if(target&&typeof target[last]==='number')target[last]+=e.delta;}
      if(setup.choiceKey&&s.missionFlags[setup.choiceKey])applyChoice(s,setup,s.missionFlags[setup.choiceKey]);
      return s;},
     step(state,action={},dt=0){const a=typeof action==='string'?{type:action}:action;
      if(state.status!=='playing')return clone(state);
      if(a.type==='command'&&a.id==='campaign-hint'){const s=clone(state);s.missionHint=Math.min(mission.hintSteps.length,s.missionHint+1);s.message=mission.hintSteps[Math.max(0,s.missionHint-1)];return s;}
      if(a.type==='command'&&a.id==='campaign-undo'){const history=state.missionUndo||[];if(!history.length)return clone(state);const s=clone(history[history.length-1]);s.missionUndo=clone(history.slice(0,-1));return s;}
      if(a.type==='command'&&a.id?.startsWith('story-')){const s=clone(state),choice=a.id.slice(6);if(setup.choices?.some(c=>c.id===choice)&&!s.missionChoice){applyChoice(s,setup,choice);s.message=setup.choices.find(c=>c.id===choice).consequence;}return s;}
      if(setup.choices?.length&&!state.missionChoice)return clone(state);
      if(a.type==='command'&&setup.disabledCommands?.includes(a.id))return clone(state);
      if(a.type==='cell'&&setup.locked?.includes(a.index))return clone(state);
      if(a.type==='command'&&/^digit[1-9]$/.test(a.id)&&setup.locked?.includes(state.selected))return clone(state);
      let before=clone(state);delete before.missionUndo;
      let s=base.step(state,a,dt);s=clone(s);
      const meaningful=s.moves!==state.moves||a.type==='command'&&!['play','run'].includes(a.id)&&JSON.stringify(s)!==JSON.stringify(state);
      if(meaningful){s.missionMoves=(state.missionMoves||0)+1;if(!base.realtime){s.missionUndo=boundedUndo(state.missionUndo||[],before);}}
      if(setup.training&&s.status==='playing'&&s.round>state.round&&(s.points[0]-state.points[0])>=setup.training.minScore&&setup.training.required.every(v=>s.board[v.index]===v.letter)){s.status='won';s.score=Math.max(1,s.points[0]);s.message='Mục tiêu luyện tập đã được chứng minh bằng một nước đặt từ hợp lệ.';}
      if(setup.singleStage&&(s.cleared||s.level>state.level)&&s.status==='playing'){s.status='won';s.score=Math.max(1,s.score);s.transport=false;s.running=false;}
      if(model==='creative'&&s.status==='won'&&state.status!=='won'){
       const params=id==='pottery-wheel'?[state.radii,state.thickness]:id==='stained-glass'?state.pieces.map(p=>[p.x,p.y,p.a,p.color,p.alpha]):id==='bonsai-topiary'?state.branches.map(b=>[b.parent,Number(b.length.toFixed(3)),b.angle,Number(b.vigor.toFixed(3)),b.alive?1:0]):id==='perspective-camera'?[state.camera.x,state.camera.z,state.yaw,state.focal,state.exposure]:id==='print-register'?state.plates.map(p=>[p.x,p.y,p.a,p.ink,p.scale||1]):null;
       if(params){s.completedArtwork={version:1,kind:id,params:clone(params)};s.missionFlags['art-'+mission.id]=JSON.stringify(s.completedArtwork);}
      }
      if(setup.moveLimit&&s.missionMoves>setup.moveLimit&&s.status==='playing'){s.status='lost';s.message='Hết ngân sách thao tác của nhiệm vụ.';}
      if(s.status==='won'&&mission.id===missions[missions.length-1].id&&(model==='story'||model==='strategy'&&setup.story)){const values=Object.values(s.missionFlags);s.ending=values.filter(v=>v==='share'||v==='care').length>=2?'shared-dawn':'independent-dawn';}
      return s;
     },
     describe(s){const d=clone(base.describe(s));d.summary=mission.objective+' · '+d.summary;d.actions=(d.actions||[]).filter(a=>!setup.disabledCommands?.includes(a.id));d.actions.push(C.cmd('campaign-hint','Gợi ý từng bước'));
      if(!base.realtime)d.actions.push(C.cmd('campaign-undo','Hoàn tác nhiệm vụ',undefined,!(s.missionUndo||[]).length));
      if(setup.choices?.length&&!s.missionChoice)d.story={speaker:setup.speaker||'Người đồng hành',text:setup.storyText||'Quyết định này thay đổi nguồn lực và hồ sơ được giữ cho các chương sau.',choices:setup.choices.map(c=>({id:c.id,label:c.label,disabled:false}))};
      if(setup.locked&&d.cells)d.cells=d.cells.map(c=>setup.locked.includes(c.index)?Object.assign(c,{disabled:true,label:c.label+' · khóa theo đề bài'}):c);
      if(s.ending)d.story={speaker:'Nhật ký hành trình',text:s.ending==='shared-dawn'?'Bình minh chung: những cam kết giúp đỡ đã giữ mạng lưới đồng minh bên nhau.':'Bình minh độc lập: bạn hoàn thành tuyến đường bằng dự trữ và lựa chọn tự chủ.',choices:[]};
      return d;
     },
     draw(ctx,s,opt={}){base.draw(ctx,s,opt);if(setup.markers){ctx.save();ctx.scale((opt.width||720)/720,(opt.height||480)/480);for(const marker of setup.markers){const p=C.at(marker.index,C.layout(marker.columns||5,marker.rows||marker.columns||5));C.circle(ctx,p.x,p.y,marker.radius||14,null,marker.color||'#ffe69c',2);C.text(ctx,marker.label,p.x,p.y-20,12,'#fff2bc');}ctx.restore();}}
    };
   },
   complete(s){return{complete:s.status==='won',outcome:s.result==='draw'?'draw':s.status==='won'?'won':s.status==='lost'?'lost':'playing',score:s.score||0,flags:s.missionFlags||{},ending:s.ending};}
  };return spec;
 }
 function applyChoice(s,setup,id){const choice=setup.choices.find(c=>c.id===id);if(!choice)return;s.missionChoice=id;if(setup.choiceKey)s.missionFlags[setup.choiceKey]=id;for(const [key,value] of Object.entries(choice.state||{}))s[key]=clone(value);for(const [key,value] of Object.entries(choice.content||{}))s.content[key]=clone(value);}
 return Object.freeze({VERSION:1,define,clone,MAX_UNDO_ENTRIES,MAX_UNDO_BYTES});
});
