'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const base = require('../all-game-pack-casual.js').games;
const pack = require('../all-game-campaign-pack-casual.js');
function solve(id, mission) {
  const engine=pack.games[id].createEngine(base[id],mission,{});let s=engine.create({seed:71});let actions=0;
  function step(action,dt=0){s=engine.step(s,action,dt);actions++;assert(actions<25000,'bounded walkthrough '+id+' '+mission.id);}
  function wait(predicate){while(s.status==='playing'&&!predicate(s))step({type:'tick'},.01);}
  const setup=mission.setup;
  while(s.status==='playing'){
    if(id==='simon-sequence'){wait(s=>s.phase==='input');if(s.status==='playing')step({type:'cell',index:s.expectedSequence[s.cursor]});}
    else if(id==='reaction-stop'){if(s.phase==='go')step({type:'cell',index:s.signal.opposite?1-s.signal.side:s.signal.side});else step({type:'tick'},.05);}
    else if(id==='rhythm-tap'){wait(s=>s.elapsed>=s.nextBeat-.02);if(s.status==='playing')step('action');}
    else if(id==='whack-orb'||id==='aim-trainer'||id==='odd-one-out')step({type:'cell',index:s.target});
    else if(id==='math-sprint')step({type:'cell',index:s.question.options.indexOf(s.question.answer)});
    else if(id==='color-word')step({type:'cell',index:s.expectedColor});
    else if(id==='pattern-recall'){wait(s=>s.phase==='recall');if(s.status==='playing'){for(const index of s.expectedPattern)step({type:'cell',index});step('action');}}
    else if(id==='treasure-grid'){
      const target=s.treasures.find(i=>!s.collected.includes(i))??35;const q=[[s.player]],seen=new Set([s.player]);let path;
      for(let n=0;n<q.length;n++){const p=q[n],last=p.at(-1);if(last===target){path=p;break;}for(const v of [last-6,last+6,last%6?last-1:-1,last%6<5?last+1:-1])if(v>=0&&v<36&&!seen.has(v)&&!s.traps.includes(v)&&!s.walls.includes(v)){seen.add(v);q.push(p.concat(v));}}
      assert(path,'connected legal mission');for(const index of path.slice(1))step({type:'cell',index});
    }
    else if(id==='lock-timing'){wait(s=>Math.abs(((s.phase-s.target+1.5)%1)-.5)<s.window*.3);if(s.status==='playing')step('action');}
    else if(id==='stack-tower'){wait(s=>{const p=s.tower.at(-1),m=s.moving;return Math.abs(m.x+m.width/2-p.x-p.width/2)<1.7;});if(s.status==='playing')step('action');}
    else if(id==='constellation-trace')step({type:'cell',index:s.order[s.path.length]});
    else if(id==='pixel-painter'){
      for(let row=0;row<8;row++)for(let col=0;col<8;col++){const index=row*8+col;let ink=1+row%3;if(setup.mode===3){const req=setup.required.find(r=>r[0]===index);if(req)ink=req[1];}step({type:'cell',index:64+ink});step({type:'cell',index});}step('action');
    }
    else if(id==='garden-care'){
      for(let i=0;i<3;i++){const p=s.plants[i];if(p.harvested)continue;if(p.growth>=1)step({type:'cell',index:i});else if(p.water>p.maxWater-.01)step({type:'cell',index:i,alternate:true});else if(p.water<p.minWater+.08){if(s.reservoir===0)step('action');if(s.reservoir>0)step({type:'cell',index:i});}}
      if(s.status==='playing')step({type:'tick'},.05);
    }
    else if(id==='cafe-orders'){for(const index of s.recipe.parts)step({type:'cell',index});step('action');}
    else throw Error(id);
  }
  assert.equal(s.status,'won',id+' '+mission.id+' '+s.message);
  assert.equal(s.id,id);assert(actions>0);assert.deepEqual(JSON.parse(JSON.stringify(s)),s);return {s,actions};
}
for(const [id,spec] of Object.entries(pack.games)){
  test(id+' all mandatory missions have fresh legal walkthroughs',()=>{
    const signatures=new Set();let total=0;
    for(const mission of spec.missions){assert(mission.hintSteps.length>=3);signatures.add(JSON.stringify(mission.setup));total+=solve(id,mission).actions;}
    assert.equal(signatures.size,spec.missions.length,'distinct authored setups');assert(total>spec.missions.length);
  });
}
test('wrong sequences, early reactions, blank art and invalid movement do not complete objectives',()=>{
  for(const id of ['simon-sequence','reaction-stop','pixel-painter','treasure-grid']){
    const m=pack.games[id].missions[0],e=pack.games[id].createEngine(base[id],m,{});let s=e.create({seed:3});const before=JSON.stringify(s);
    s=e.step(s,{type:'cell',index:9999},0);assert.notEqual(s.status,'won');if(id!=='reaction-stop')assert.equal(JSON.stringify(s),before);
    if(id==='reaction-stop')assert.equal(e.step(e.create({}),'action',0).status,'lost');
    if(id==='pixel-painter')assert.equal(e.step(e.create({}),'action',0).status,'playing');
  }
});
module.exports={solve};
const puzzleBase=require('../all-game-puzzles.js').games;
const puzzlePack=require('../all-game-campaign-puzzles.js');
function puzzleSolve(id,mission){const e=puzzlePack.games[id].createEngine(puzzleBase[id],mission,{});let s=e.create({seed:2}),count=0;const step=(a,dt=0)=>{s=e.step(s,a,dt);assert(++count<5000);};
 if(id==='merge'){
  const q=[{state:s,path:[]}],seen=new Set([JSON.stringify(s.board)]);let solution;
  for(let n=0;n<q.length&&n<25000;n++){const at=q[n];if(at.state.status==='won'){solution=at.path;break;}if(at.path.length>=mission.setup.moveBudget)continue;for(const type of ['left','right','up','down']){const next=e.step(at.state,{type},0),key=JSON.stringify(next.board);if(next.status!=='lost'&&!seen.has(key)){seen.add(key);q.push({state:next,path:at.path.concat(type)});}}}
  assert(solution,'legal merge path '+mission.id);for(const type of solution)step({type});
 }
 if(id==='mines'){
  const neighbors=i=>{const out=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&i%6+dx>=0&&i%6+dx<6&&Math.floor(i/6)+dy>=0&&Math.floor(i/6)+dy<6)out.push(i+dy*6+dx);return out;};
  let changed=true;while(s.status==='playing'&&changed){changed=false;for(let i=0;i<36;i++){const c=s.board[i];if(!c.revealed)continue;const ns=neighbors(i),unknown=ns.filter(n=>!s.board[n].revealed&&!s.board[n].flagged),remaining=c.adjacent-ns.filter(n=>s.board[n].flagged).length;if(unknown.length&&remaining===unknown.length){for(const index of unknown)step({type:'cell',index,alternate:true});changed=true;}else if(unknown.length&&remaining===0){for(const index of unknown)if(!s.board[index].revealed)step({type:'cell',index});changed=true;}}}
 }
 if(id==='memory'){
  while(s.previewRemaining>0)step({type:'tick'},.5);
  while(s.status==='playing'){const face=mission.setup.matchOrder?mission.setup.matchOrder[s.matchedPairs]:s.board.find(c=>!c.matched).face;const indices=s.board.map((c,i)=>!c.matched&&c.face===face?i:-1).filter(i=>i>=0);for(const index of indices)step({type:'cell',index});}
 }
 assert.equal(s.status,'won',id+' '+mission.id);return s;}
for(const [id,spec]of Object.entries(puzzlePack.games))test(id+' campaign: every authored problem solved from fresh legal input',()=>{const unique=new Set(spec.missions.map(m=>JSON.stringify(m.setup)));assert.equal(unique.size,spec.missions.length);for(const m of spec.missions)puzzleSolve(id,m);});
test('mine explosions and wrong memory order remain meaningful failures',()=>{let m=puzzlePack.games.mines.missions[0],e=puzzlePack.games.mines.createEngine(puzzleBase.mines,m,{}),s=e.create({});assert.equal(e.step(s,{type:'cell',index:m.setup.mines[0]},0).status,'lost');m=puzzlePack.games.memory.missions[7];e=puzzlePack.games.memory.createEngine(puzzleBase.memory,m,{});s=e.create({});while(s.previewRemaining>0)s=e.step(s,{type:'tick'},1);const wrong=m.setup.matchOrder.at(-1),is=s.board.map((c,i)=>c.face===wrong?i:-1).filter(i=>i>=0);for(const index of is)s=e.step(s,{type:'cell',index},0);assert.equal(s.matchedPairs,0);});
const packPuzzleBase=require('../all-game-pack-puzzles.js').games;
const packPuzzles=require('../all-game-campaign-pack-puzzles.js');
function feedback(secret,guess){let exact=0,a=[],b=[];for(let i=0;i<4;i++)if(secret[i]===guess[i])exact++;else{a.push(secret[i]);b.push(guess[i]);}let near=0;for(const v of b){const at=a.indexOf(v);if(at>=0){near++;a.splice(at,1);}}return {exact,near};}
function solvePackPuzzle(id,m){const e=packPuzzles.games[id].createEngine(packPuzzleBase[id],m,{}),cfg=m.setup;let s=e.create({seed:9}),count=0;const step=(action)=>{s=e.step(s,typeof action==='number'?{type:'cell',index:action}:action,0);assert(++count<2000,id+' bounded');};
 if(id==='lights-out')for(const i of cfg.solution)step(i);
 else if(id==='slide-tiles')for(const i of cfg.solution)step(i);
 else if(id==='peg-solitaire')for(const move of cfg.solution){step(move.from);step(move.to);}
 else if(id==='n-queens'){for(const i of cfg.solution)if(!cfg.locked.includes(i))step(i);}
 else if(id==='nonogram'){for(let i=0;i<25;i++)if(cfg.target[i])step(i);}
 else if(id==='towers-hanoi'){
  const key=t=>JSON.stringify(t),q=[{t:s.towers,path:[]}],seen=new Set([key(s.towers)]);let path;
  for(let n=0;n<q.length;n++){const at=q[n];if(at.t[cfg.goalTower].length===cfg.count){path=at.path;break;}for(let a=0;a<3;a++)for(let b=0;b<3;b++){if(a===b||!at.t[a].length||cfg.adjacentOnly&&Math.abs(a-b)>1)continue;const top=at.t[a].at(-1);if(at.t[b].length&&at.t[b].at(-1)<top)continue;const next=JSON.parse(key(at.t));next[b].push(next[a].pop());const k=key(next);if(!seen.has(k)){seen.add(k);q.push({t:next,path:at.path.concat([[a,b]])});}}}
  assert(path);for(const [a,b]of path){step(a);step(b);}
 }
 else if(id==='maze-path')for(const i of cfg.solution)step(i);
 else if(['connect-four','tic-tac-toe','reversi-mini'].includes(id))step(cfg.goalMoves[0]);
 else if(id==='word-search')for(const word of cfg.words){step(word.path[0]);step(word.path.at(-1));}
 else if(id==='number-order')for(const n of cfg.numberOrder)step(s.board.indexOf(n));
 else if(id==='sudoku-mini'){for(let i=0;i<16;i++)if(!cfg.givens[i])while(s.status==='playing'&&s.board[i]!==cfg.solution[i])step(i);}
 else if(id==='color-flood'){for(const col of cfg.solution)if(s.status==='playing')step(s.board.indexOf(col));}
 else if(id==='pipe-link'){for(let i=0;i<25;i++)if(!cfg.locked.includes(i)){let rotations=0;while(s.status==='playing'&&s.board[i]!==cfg.solution[i]&&rotations++<4)step(i);}}
 else if(id==='code-breaker'){
  let candidates=[];for(let i=0;i<1296;i++){let n=i;const code=Array.from({length:4},()=>{const digit=n%6;n=Math.floor(n/6);return digit;});candidates.push(code);}
  while(s.status==='playing'){
   candidates=candidates.filter(code=>s.attempts.every(a=>{const f=feedback(code,a.guess);return f.exact===a.exact&&f.near===a.near;}));assert(candidates.length,'remaining codes');
   let best=candidates[0],bestWorst=Infinity;
   for(const g of candidates){const bins=new Map();for(const code of candidates){const f=feedback(code,g),k=f.exact+','+f.near;bins.set(k,(bins.get(k)||0)+1);}const worst=Math.max(...bins.values());if(worst<bestWorst){bestWorst=worst;best=g;}}
   for(let i=0;i<4;i++)while(s.guess[i]!==best[i])step(i);step(4);
  }
 }
 else if(id==='knights-tour')for(const i of cfg.solution.slice(1))step(i);
 else throw Error(id);
 assert.equal(s.status,'won',id+' '+m.id+' '+s.message);assert.equal(s.id,id);return s;
}
for(const [id,spec]of Object.entries(packPuzzles.games))test(id+' 28 fresh legal mission walkthroughs',()=>{const signatures=new Set(spec.missions.map(m=>JSON.stringify(m.setup)));assert.equal(signatures.size,28,'distinct setup data');for(const m of spec.missions)solvePackPuzzle(id,m);});
test('constraints reject forbidden queens, locked lamps, wrong knight checkpoint and nonadjacent Hanoi',()=>{
 for(const [id,n]of [['n-queens',0],['lights-out',7],['knights-tour',7],['towers-hanoi',14]]){
  const m=packPuzzles.games[id].missions[n],e=packPuzzles.games[id].createEngine(packPuzzleBase[id],m,{});let s=e.create({});
  if(id==='n-queens'){const before=JSON.stringify(s);s=e.step(s,{type:'cell',index:m.setup.forbidden[0]},0);assert.equal(JSON.stringify(s),before);}
  if(id==='lights-out'){const before=s.board.slice();s=e.step(s,{type:'cell',index:m.setup.locked[0]},0);assert.deepEqual(s.board,before);}
  if(id==='knights-tour'){s=e.step(s,{type:'cell',index:m.setup.checkpoints[8]},0);assert.equal(s.visited,1);}
  if(id==='towers-hanoi'){s.anchor=0;const before=JSON.stringify(s.towers);s=e.step(s,{type:'cell',index:2},0);assert.equal(JSON.stringify(s.towers),before);}
 }
});
const adventureBase=require('../all-game-adventure.js').games,adventurePack=require('../all-game-campaign-adventure.js');
for(const [id,spec]of Object.entries(adventurePack.games))test(id+' all longform missions solved from fresh inputs',()=>{
 const unique=new Set();for(const m of spec.missions){unique.add(JSON.stringify(m.setup));const e=spec.createEngine(adventureBase[id],m,{});let s=e.create({seed:4,difficulty:'normal'}),steps=0;
  if(id!=='orbit-runner'){for(const type of m.setup.solution){s=e.step(s,{type},0);steps++;}}
  else {const course=m.setup.course;while(s.status==='playing'&&steps++<12000){const p=s.player,bottom=p.y+p.height,front=p.x+p.width;let jump=false;
   if(p.grounded){
    const ground=course.platforms.filter(([x,y,w])=>p.x+p.width>x&&p.x<x+w&&Math.abs(bottom-y)<1).sort((a,b)=>a[1]-b[1])[0];
    if(ground&&ground[1]===420&&ground[0]+ground[2]<course.goal&&front>ground[0]+ground[2]-17)jump=true;
    if(course.hazards.some(([x,y,w,h])=>x-front<42&&x+w>p.x&&y+h>p.y))jump=true;
    if(course.platforms.some(([x,y,w])=>x-front<51&&x-front>0&&y<bottom-8&&y>p.y-55))jump=true;
   }
   s=e.step(s,{type:'tick',held:{right:true,up:jump}},1/60);
  }}
  assert.equal(s.status,'won',id+' '+m.id+' '+s.message+' @'+JSON.stringify(s.player));assert.equal(s.id,id);assert(!('course'in s),'static course stays outside checkpoint');assert(steps>0);
 }assert.equal(unique.size,spec.missions.length);
});
test('block budget and crate walls are actual constraints',()=>{const m=adventurePack.games['block-drop'].missions[0],e=adventurePack.games['block-drop'].createEngine(adventureBase['block-drop'],m,{});let s=e.create({});for(let i=0;i<4&&s.status==='playing';i++)s=e.step(s,{type:'action'},0);assert(s.status==='lost'||s.status==='won');const c=adventurePack.games['crate-lab'].missions[0],ce=adventurePack.games['crate-lab'].createEngine(adventureBase['crate-lab'],c,{}),cs=ce.create({});assert.deepEqual(ce.step(cs,{type:'cell',index:0},0),cs);});
const arcadeBase=require('../all-game-arcade.js').games,arcadePack=require('../all-game-campaign-arcade.js');
for(const [id,spec]of Object.entries(arcadePack.games))test(id+' complete 20 mission campaign from fresh legal inputs',()=>{
 for(const m of spec.missions){const e=spec.createEngine(arcadeBase[id],m,{});let s=e.create({seed:44,difficulty:'normal'}),steps=0;
  if(id==='snake')while(s.status==='playing'&&steps<20000){const blocked=new Set(s.body.slice(1,-1).concat(s.obstacles).map(p=>p.x+','+p.y)),head=s.body[0],queue=[{p:head,path:[]}],seen=new Set([head.x+','+head.y]);let path;
   for(let n=0;n<queue.length;n++){const at=queue[n];if(at.p.x===s.food.x&&at.p.y===s.food.y){path=at.path;break;}for(const [name,dx,dy]of [['up',0,-1],['right',1,0],['down',0,1],['left',-1,0]]){if(!at.path.length&&({up:'down',down:'up',left:'right',right:'left'})[s.direction]===name)continue;let p={x:at.p.x+dx,y:at.p.y+dy};const portal=s.portals.find(q=>q.from.x===p.x&&q.from.y===p.y);if(portal)p=portal.to;const key=p.x+','+p.y;if(p.x<0||p.x>=s.cols||p.y<0||p.y>=s.rows||blocked.has(key)||seen.has(key))continue;seen.add(key);queue.push({p,path:at.path.concat(name)});}}
   assert(path&&path.length,'snake route '+m.id);for(const type of path){const moves=s.moves;s=e.step(s,{type},0);while(s.status==='playing'&&s.moves===moves){s=e.step(s,{type:'tick'},Math.min(.05,s.interval-s.elapsed+1e-9));steps++;}if(s.status!=='playing')break;}
  }
  if(id==='breakout')while(s.status==='playing'&&steps++<90000){if(!s.launched)s=e.step(s,{type:'action'},0);const b=s.ball,p=s.paddle;let x=b.x;if(b.vy>0){const t=Math.max(0,(p.y-b.r-b.y)/b.vy);let hit=b.x+b.vx*t;const low=19,range=682;hit=((hit-low)%(range*2)+range*2)%(range*2);hit=low+(hit>range?range*2-hit:hit);const target=s.bricks.slice().sort((a,b)=>b.y-a.y)[0],desired=Math.atan2(target.x+target.w/2-hit,p.y-target.y);const rel=Math.max(-.85,Math.min(.85,desired/(Math.PI/3)));x=hit-rel*p.w/2;}
   s=e.step(s,{type:'pointer',x},1/120);
  }
  if(id==='star-guard')while(s.status==='playing'&&steps++<20000){const enemy=s.enemies.slice().sort((a,b)=>Math.abs(a.x-s.player.x)-Math.abs(b.x-s.player.x))[0];if(!enemy)break;const future=s.waveAge+(s.player.y-enemy.y)/560;let x=enemy.baseX+Math.sin(future*(enemy.kind==='boss'?.65:1.05)+enemy.phase)*(enemy.motion==='sweep'?95:enemy.kind==='boss'?228:28);const threats=s.enemyBullets.filter(b=>b.y>290&&b.vy>0&&Math.abs(b.x+(s.player.y-b.y)/b.vy*b.vx-x)<30);if(threats.length)x+=x<360?75:-75;s=e.step(s,{type:'pointer',x},0);s=e.step(s,{type:'tick',held:{action:true}},1/60);}
  assert.equal(s.status,'won',id+' '+m.id+' '+JSON.stringify({steps,lives:s.lives,health:s.health,remaining:s.bricks?.length||s.enemies?.length}));assert.equal(s.id,id);
 }
});
const packArcade=require('../all-game-campaign-pack-arcade.js');
const packArcadeBase=require('../all-game-pack-arcade.js').games;
const {solve:solvePackArcade}=require('../scripts/all-game-campaign-legacy-solutions.js');
for(const [id,spec]of Object.entries(packArcade.games))test(id+' every longform court/region has a fresh legal walkthrough',()=>{
 const setups=new Set();for(const mission of spec.missions){setups.add(JSON.stringify(mission.setup));const {state,actions}=solvePackArcade(id,mission);assert.equal(state.status,'won');assert.equal(state.id,id);assert(actions>0);assert(!('campaignConfig'in state));assert.deepEqual(JSON.parse(JSON.stringify(state)),state);}
 assert.equal(setups.size,spec.missions.length,'different authored layouts, objectives or interaction plans');
});

test('59 legacy games meet content contracts and preserve native Quick Play identities',()=>{
 const core=require('../all-game-campaign-core.js');let total=0,count=0;
 for(const [content,bases]of [[pack,base],[puzzlePack,puzzleBase],[packPuzzles,packPuzzleBase],[adventurePack,adventureBase],[arcadePack,arcadeBase],[packArcade,packArcadeBase]])for(const [id,spec]of Object.entries(content.games)){
  assert.deepEqual(core.validateSpec(spec),{ok:true,errors:[]},id);count++;total+=spec.missions.length;
  const quick=bases[id].create({seed:71,difficulty:'normal'});assert.equal(quick.id,id);assert.equal(quick.status,'playing');assert(!quick.campaign);assert(!quick.campaignConfig);
 }
 assert.equal(count,59);assert.equal(total,1364);
});

test('arcade campaign snapshots are immutable, JSON-only and restore exactly',()=>{
 for(const [id,spec]of Object.entries(packArcade.games)){
  const mission=spec.missions.at(-1),engine=spec.createEngine(packArcadeBase[id],mission,{}),initial=engine.create({seed:44}),before=JSON.stringify(initial);
  const state=engine.step(initial,{type:'tick'},1/60);assert.equal(JSON.stringify(initial),before,id+' immutable step');
  const restored=JSON.parse(JSON.stringify(state));assert.deepEqual(engine.step(state,{type:'tick'},1/60),engine.step(restored,{type:'tick'},1/60),id+' deterministic checkpoint');
  assert(!('campaignConfig'in state));assert(!('setup'in state));assert.notEqual(state.status,'won');
 }
});

test('mission gates reject skipped beacons, wrong lanes, decoys and wrong penalty zones',()=>{
 let spec=packArcade.games['meteor-dodge'],m=spec.missions[15],e=spec.createEngine(packArcadeBase[spec.id],m,{}),s=e.create({});
 s=e.step(s,{type:'pointer',...m.setup.beacons[2]},0);assert.deepEqual(s.visitedBeacons,[],'last region requires ordered beacons');
 s=e.step(s,{type:'pointer',...m.setup.beacons[0]},0);assert.deepEqual(s.visitedBeacons,[0]);
 while(s.status==='playing'&&s.time<m.setup.target+1)s=e.step(s,{type:'pointer',x:695,y:455},.05);assert.notEqual(s.status,'won','surviving alone cannot clear required stops');
 spec=packArcade.games['road-rush'];m=spec.missions[0];e=spec.createEngine(packArcadeBase[spec.id],m,{});s=e.create({});
 while(s.status==='playing')s=e.step(s,{type:'pointer',x:210+((m.setup.gates[0].lane+1)%3)*150},.05);assert.equal(s.status,'lost');assert.equal(s.gatesPassed.length,0);
 spec=packArcade.games['target-range'];m=spec.missions[15];e=spec.createEngine(packArcadeBase[spec.id],m,{});s=e.create({});
 while(!s.targets.some(t=>t.kind==='decoy')&&s.status==='playing')s=e.step(s,{type:'tick'},.05);
 const decoy=s.targets.find(t=>t.kind==='decoy'),progress=s.progress,misses=s.misses;assert(decoy);s=e.step(s,{type:'pointer',x:decoy.x,y:decoy.y,phase:'down'},0);assert.equal(s.progress,progress);assert.equal(s.misses,misses+1);
 spec=packArcade.games['penalty-kick'];m=spec.missions[0];e=spec.createEngine(packArcadeBase[spec.id],m,{});s=e.create({});
 for(let n=0;n<5;n++){s=e.step(s,{type:'pointer',x:350,y:225},0);s=e.step(s,'action',0);for(let k=0;k<25;k++)s=e.step(s,{type:'tick'},.05);}
 assert.equal(s.status,'lost');assert.equal(s.progress,0,'a goal outside the marked zone does not count');
});

test('finite asteroid objectives and collision courts retain physical constraints',()=>{
 const a=packArcade.games['asteroid-drift'],m=a.missions[0],e=a.createEngine(packArcadeBase[a.id],m,{}),s=e.create({});assert(s.finiteRocks);assert.equal(s.target,s.rocks.length*3,'two fragments per destroyed large rock');
 const p=packArcade.games['paddle-duel'],pm=p.missions[4],pe=p.createEngine(packArcadeBase[p.id],pm,{});let ps=pe.create({seed:44});ps=pe.step(ps,'action',0);
 // The rally must stay energetic through bumpers; the QA walkthrough above verifies actual scoring.
 for(let n=0;n<1500&&ps.status==='playing';n++){ps=pe.step(ps,{type:'pointer',y:ps.ball.y},1/120);if(!ps.serving)assert(Math.hypot(ps.ball.vx,ps.ball.vy)>=309.99);else ps=pe.step(ps,'action',0);}
 const g=packArcade.games['mini-golf'],gm=g.missions[0],ge=g.createEngine(packArcadeBase[g.id],gm,{});let gs=ge.create({});gs=ge.step(gs,'action',0);assert.equal(gs.strokes,1);assert(Math.hypot(gs.player.vx,gs.player.vy)>0);assert.equal(gs.progress,0);
});

test('native and campaign serve/aim states suspend idle frames and wake on a legal launch',()=>{
 const profiles=[['paddle-duel',packArcadeBase,packArcade],['mini-golf',packArcadeBase,packArcade],['basket-shot',packArcadeBase,packArcade],['breakout',arcadeBase,arcadePack]];
 for(const [id,bases,content]of profiles)for(const mode of ['quick','campaign']){
  const spec=content.games[id],e=mode==='quick'?bases[id]:spec.createEngine(bases[id],spec.missions[0],{});let s=e.create({seed:44,difficulty:'normal'});
  assert.equal(e.describe(s).needsFrame,false,id+' '+mode+' idle');
  s=e.step(s,{type:'pointer',x:150,y:200},0);assert.equal(e.describe(s).needsFrame,false,id+' aim is input driven');
  s=e.step(s,{type:'action'},0);assert.equal(e.describe(s).needsFrame,true,id+' '+mode+' launched');
  const before=JSON.stringify(s);s=e.step(s,{type:'tick'},1/60);assert.notEqual(JSON.stringify(s),before);assert.equal(e.describe({...s,status:'won'}).needsFrame,false,'terminal state stays idle');
 }
});

test('cooldowns and final golf adjudication finish before idle suspension; moving hazards keep frames',()=>{
 const basket=packArcadeBase['basket-shot'];let s=basket.step(basket.create({seed:44}),{type:'action'},0),steps=0;
 while(basket.describe(s).needsFrame&&s.status==='playing'&&steps++<3000)s=basket.step(s,{type:'tick'},1/60);
 assert(steps<3000);assert.equal(s.flying,false);assert.equal(s.cooldown,0);assert.equal(basket.describe(s).needsFrame,false);
 const golf=packArcadeBase['mini-golf'];let g=golf.create({});g={...g,strokes:8};assert.equal(golf.describe(g).needsFrame,true,'one adjudication frame is still required');g=golf.step(g,{type:'tick'},1/60);assert.equal(g.status,'lost');assert.equal(golf.describe(g).needsFrame,false);
 for(const id of Object.keys(packArcadeBase).filter(id=>!['paddle-duel','mini-golf','basket-shot'].includes(id)))assert.equal(packArcadeBase[id].describe(packArcadeBase[id].create({})).needsFrame,true,id+' has mandatory drift, hazards, keeper motion or passive time');
});
