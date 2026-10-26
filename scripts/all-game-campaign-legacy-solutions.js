'use strict';
// QA controllers use only the same commands, visible positions and physics cues as the player.
const pack=require('../all-game-campaign-pack-arcade.js');
const base=require('../all-game-pack-arcade.js').games;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
function solve(id,mission){
 const e=pack.games[id].createEngine(base[id],mission,{}),cfg=mission.setup;let s=e.create({seed:44,difficulty:'normal'}),actions=0;
 const step=(a,dt=0)=>{s=e.step(s,a,dt);if(++actions>160000)throw Error('bounded '+id+' '+mission.id+' '+JSON.stringify(s));};
 const tick=(dt=1/60,held)=>step({type:'tick',held:held||{}},dt);
 while(s.status==='playing'){
  if(id==='paddle-duel'){
   if(s.serving)step('action');
   const b=s.ball,offset=b.vx<0?Math.sin(s.time*.731)*34:0;
   step({type:'pointer',y:b.y+offset},1/120);
  }else if(id==='sky-glider'){
   const gate=s.gates.find(g=>g.x+44>s.player.x-12),target=gate?gate.gap:240;
   if(s.player.y>target+23&&s.player.vy>-100)step('action');tick();
  }else if(id==='meteor-dodge'){
   const beacon=cfg.beacons.find((b,i)=>!s.visitedBeacons.includes(i));
   let target=beacon;if(!target){let best=-Infinity;for(let x=40;x<700;x+=40)for(let y=130;y<450;y+=40){const safe=Math.min(...s.meteors.map(m=>Math.hypot(x-m.x-m.vx*.2,y-m.y-m.vy*.2)-m.r));if(safe>best){best=safe;target={x,y};}}}
   step({type:'pointer',...target},1/60);
  }else if(id==='coin-catcher'){
   const coin=s.items.filter(i=>i.kind==='coin').sort((a,b)=>b.y-a.y)[0];let x=coin?coin.x+(coin.vx||0)*(418-coin.y)/coin.vy:360;
   const stone=s.items.find(i=>i.kind==='stone'&&i.y>405&&Math.abs(i.x-x)<50);if(stone&&(!coin||coin.y<390))x=stone.x<360?650:60;
   step({type:'pointer',x},1/60);
  }else if(id==='road-rush'){
   const gate=cfg.gates.find(g=>g.distance>s.progress);let lane=gate&&gate.distance-s.progress<70?gate.lane:s.lane;
   if(!gate||gate.distance-s.progress>=70){let best=-Infinity;for(let k=0;k<3;k++){const score=Math.min(1000,...s.cars.filter(c=>Math.abs(c.x-(210+k*150))<50&&c.y<470).map(c=>Math.abs(c.y-388)));if(score>best){lane=k;best=score;}}}
   step({type:'pointer',x:210+lane*150},1/120);
  }else if(id==='river-cross'){
   const p=s.player,row=p.row-1;let safe=true;
   if([2,3].includes(row))safe=s.logs.some(l=>l.row===row&&p.x>l.x+14&&p.x<l.x+l.w-14);
   if([5,6].includes(row))safe=!s.cars.some(c=>c.row===row&&p.x>c.x-22&&p.x<c.x+c.w+22);
   if(safe&&s.moveCooldown<=0)step('up');tick(.02);
  }else if(id==='asteroid-drift'){
   const r=s.rocks.slice().sort((a,b)=>Math.hypot(a.x-s.player.x,a.y-s.player.y)-Math.hypot(b.x-s.player.x,b.y-s.player.y))[0];if(!r)break;
   const t=Math.hypot(r.x-s.player.x,r.y-s.player.y)/420;step({type:'pointer',x:r.x+r.vx*t,y:r.y+r.vy*t});tick(1/60,{action:true});
  }else if(id==='gravity-flip'){
   const o=s.obstacles.find(o=>o.x+o.w>138&&o.x<390);if(o){const wanted=o.y<100?1:o.y+o.h>400?-1:s.player.y>o.y+o.h/2?1:-1;if(s.gravity!==wanted)step('action');}tick(1/120);
  }else if(id==='ball-balance'){
   const goal=s.checkpoints[s.progress],p=s.player;let x=goal.x,y=goal.y;
   // Route around circular holes before seeking the ordered checkpoint.
   for(const hole of s.holes){const dx=x-p.x,dy=y-p.y,t=clamp(((hole.x-p.x)*dx+(hole.y-p.y)*dy)/(dx*dx+dy*dy),0,1);if(Math.hypot(p.x+t*dx-hole.x,p.y+t*dy-hole.y)<hole.r+23){const sign=delta(Math.atan2(goal.y-hole.y,goal.x-hole.x),Math.atan2(p.y-hole.y,p.x-hole.x))>=0?1:-1,angle=Math.atan2(p.y-hole.y,p.x-hole.x)+sign*.7;x=hole.x+Math.cos(angle)*(hole.r+45);y=hole.y+Math.sin(angle)*(hole.r+45);break;}}
   const ax=(x-p.x)*5-p.vx*3.5,ay=(y-p.y)*5-p.vy*3.5;
   tick(1/120,{right:ax>8,left:ax< -8,down:ay>8,up:ay< -8,action:Math.hypot(x-p.x,y-p.y)<40});
  }else if(id==='jump-tower'){
   const target=s.platforms[Math.min(s.target,s.platform+1)],x=target.x+target.w/2,p=s.player;
   tick(1/120,{right:p.x<x-3,left:p.x>x+3,action:true});
  }else if(id==='laser-dash'){
   const beam=s.beams.find(b=>b.x+25>s.player.x),distance=beam?beam.x-s.player.x:100;
   const on=beam&&(s.time+beam.offset)%(beam.period||2.6)<(beam.active||1.45);
   const held={right:!beam||distance>31||!on||s.dash>0};
   if(beam&&distance<=90&&s.cooldown<=0)step('action');tick(1/120,held);
  }else if(id==='orbit-collect'){
   const star=s.stars.find(t=>!t.taken&&(t.order===undefined||t.order===s.progress)),p=s.player;
   const angular=delta(star.angle,p.angle),radial=star.radius-p.radius;
   tick(1/120,{right:angular>.025,left:angular<-.025,down:radial>2,up:radial< -2});
  }else if(id==='shield-defense'){
   const m=s.meteors.slice().sort((a,b)=>Math.hypot(a.x-360,a.y-240)-Math.hypot(b.x-360,b.y-240))[0];if(m)step({type:'pointer',x:m.x,y:m.y});tick();
  }else if(id==='target-range'){
   const t=s.targets.find(t=>t.kind!=='decoy');if(t)step({type:'pointer',x:t.x,y:t.y,phase:'down'});tick();
  }else if(id==='penalty-kick'){
   if(!s.flight&&s.cooldown<=0){const z=cfg.goalZones[s.progress],landing={x:z.x+z.w/2,y:z.y+z.h/2},future=360+Math.sin((s.time+.72)*cfg.keeperTempo+cfg.keeperPhase)*cfg.keeperReach;
    if(Math.abs(landing.x-future)>s.keeper.w/2+12){step({type:'pointer',x:landing.x-cfg.wind,y:landing.y});step('action');}}
   tick();
  }else if(id==='mini-golf'){
   if(Math.hypot(s.player.vx,s.player.vy)<6){
    const p=s.player,target=cfg.waypoints.find(q=>Math.hypot(q.x-p.x,q.y-p.y)>30&&q.x>p.x+20)||s.hole;
    const dx=target.x-p.x,dy=target.y-p.y,distance=Math.hypot(dx,dy),power=clamp((distance*.95+6)/720,.15,1);
    step({type:'pointer',x:p.x+dx/distance*power*600,y:p.y+dy/distance*power*600});step('action');
   }tick();
  }else if(id==='basket-shot'){
   if(!s.flying&&s.cooldown<=0){const p=s.player,h=s.hoop,dx=h.x-p.x,dy=h.y-p.y;let chosen;
    for(let t=1.7;t<=2.7;t+=.01){const vx=dx/t,vy=dy/t-250*t,speed=Math.hypot(vx,vy);if(vy+500*t>80&&speed>=195&&speed<=780&&Math.atan2(vy,vx)>-1.48){chosen={vx,vy,speed};break;}}
    if(!chosen)throw Error('unreachable basket');step({type:'pointer',x:p.x+chosen.vx/780*650,y:p.y+chosen.vy/780*650});step('action');
   }tick(1/120);
  }else throw Error(id);
 }
 if(s.status!=='won')throw Error(id+' '+mission.id+' '+JSON.stringify({status:s.status,time:s.time,progress:s.progress,health:s.health,player:s.player,ball:s.ball,opponent:s.opponent,strokes:s.strokes,attempts:s.attempts}));
 return {state:s,actions};
}
module.exports={solve};
if(require.main===module){const ids=process.argv.slice(2);for(const [id,spec]of Object.entries(pack.games)){if(ids.length&&!ids.includes(id))continue;let passed=0;for(const m of spec.missions){try{solve(id,m);passed++;}catch(error){console.error(error.message);break;}}console.log(id,passed+'/'+spec.missions.length);}}
