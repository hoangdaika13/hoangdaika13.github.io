'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {engines,walkthrough,catalog}=require('../scripts/all-game-exp-story-solutions.js');
function player(id,options={seed:'story-proof'}){const g=engines[id];let s=g.create(options);return{g,get s(){return s;},act(a,dt=0){s=g.step(s,a,dt);return s;},cmd(id){return this.act({type:'command',id});},cell(index){return this.act({type:'cell',index});},text(value){return this.act({type:'text',value});},ticks(count,held={}){for(let i=0;i<count&&s.status==='playing';i++)this.act({type:'tick',held},.05);return s;}};}

for(const {id} of catalog)test(id+': complete every mandatory objective from fresh state using legal inputs',()=>{
  const result=walkthrough(id);assert.equal(result.state.status,'won',id+': '+result.state.message);assert.ok(result.state.score>0);assert.ok(result.trace.length>0);
  let replay=engines[id].create(result.options);for(const {action,dt} of result.trace)replay=engines[id].step(replay,action,dt);assert.deepEqual(replay,result.state,'deterministic full campaign replay');
  const frozen=JSON.stringify(result.state);for(const a of [{type:'command',id:'submit'},{type:'cell',index:0},{type:'tick',held:{action:true}}])assert.equal(JSON.stringify(engines[id].step(result.state,a,.05)),frozen,'completed campaign does not continue scoring');
});

const rules={
  'station-detective'(p){p.cmd('conclude');assert.equal(p.s.status,'playing');assert.equal(p.s.errors,0);assert.equal(p.s.found.length,0);},
  'relic-room'(p){p.cmd('combine');p.cell(2);p.cmd('use');assert.equal(p.s.room,0);assert.deepEqual(p.s.inventory,[]);},
  'clockloop-story'(p){p.cmd('signal');assert.equal(p.s.signal,false);p.cmd('reset');p.cell(1);p.cmd('inspect');p.cmd('reset');assert.ok(p.s.knowledge.includes('flood'));assert.equal(p.s.bridge,false);assert.equal(p.s.hour,0);},
  'treaty-dialogue'(p){p.cmd('water');const funds=p.s.funds;p.cmd('water');assert.equal(p.s.funds,funds);p.cmd('arms');const trust=p.s.trust.slice();p.cmd('neutral');assert.deepEqual(p.s.trust,trust.map(v=>v-3));assert.equal(p.s.promises.includes('neutral'),false);},
  'cartographer-expedition'(p){p.cell(24);p.cmd('survey');p.cmd('return');assert.equal(p.s.player,0);assert.equal(p.s.supplies,24);assert.equal(p.s.status,'playing');},
  'party-jrpg'(p){p.cmd('skill');p.cmd('skill');assert.ok(p.s.enemies[0].hp<=0);p.cmd('focus');const mana=p.s.heroes[0].mana;p.cmd('skill');assert.equal(p.s.heroes[0].mana,mana);assert.equal(p.s.actor,0);},
  'ability-gated-quest'(p){p.cell(2);p.cmd('interact');assert.equal(p.s.room,0);assert.deepEqual(p.s.powers,[]);assert.equal(p.s.boss,3);},
  'survivor-camp'(p){p.cmd('shelter');assert.equal(p.s.shelter,false);assert.equal(p.s.hour,0);p.cell(6);p.cmd('gather');const wood=p.s.bag.wood;p.cmd('gather');assert.equal(p.s.bag.wood,wood);assert.equal(p.s.resources[6][1],0);},
  'creature-tamer'(p){for(let i=0;i<4;i++)p.cmd('offer');assert.equal(p.s.status,'lost');assert.deepEqual(p.s.friends,[]);},
  'wildlife-tracker'(p){p.cmd('photo');assert.equal(p.s.photos.length,0);assert.equal(p.s.alert,1);assert.equal(p.s.turn,1);},
  'rewind-warden'(p){p.cmd('rewind');assert.equal(p.s.energy,3);assert.equal(p.s.rewinds,0);p.cell(16);p.cell(17);assert.equal(p.s.key,true);p.cmd('rewind');assert.equal(p.s.energy,2);assert.equal(p.s.key,false);},
  'time-slice-arena'(p){p.cell(p.s.player);p.cmd('fire');assert.equal(p.s.ammo,3);assert.deepEqual(p.s.enemies.map(v=>v.hp),[1,1]);assert.equal(p.s.worldTime,.3);},
  'rune-gesture'(p){p.cmd('cast');assert.equal(p.s.enemyHp,4);assert.equal(p.s.danger,2);p.act({type:'pointer',phase:'down',x:30,y:40});p.act({type:'pointer',phase:'move',x:70,y:80});p.act({type:'pointer',phase:'up',x:70,y:80});const count=p.s.points.length;p.act({type:'pointer',phase:'move',x:140,y:180});assert.equal(p.s.points.length,count);},
  'swarm-conductor'(p){p.cmd('not-a-formation');p.ticks(1);assert.equal(p.s.formation,'tight');assert.equal(p.s.flock.length,18);assert.equal(p.s.status,'playing');assert.ok(p.s.flock.every(b=>b.x>=15&&b.x<=705&&b.y>=30&&b.y<=450));},
  'paint-skirmish'(p){p.act({type:'pointer',phase:'down',x:-500,y:410});p.cmd('paint');assert.deepEqual(p.s.board.flatMap((v,i)=>v===1?[i]:[]),[72,73]);for(let i=0;i<12;i++)p.cmd('paint');assert.equal(p.s.ink,0);const before=p.s.board.slice();p.cmd('paint');assert.deepEqual(p.s.board,before);},
  'twin-keepers'(p){p.cmd('p1right');p.cmd('p1right');p.cmd('p1right');assert.equal(p.s.keepers[0],2);assert.equal(p.s.keepers[1],12);assert.equal(p.s.latch,false);},
  'manual-defuse'(p){p.cmd('handover');p.cmd('wire-0');assert.deepEqual(p.s.entered,[]);assert.equal(p.s.covered,true);p.cmd('reveal');assert.equal(p.s.role,'manual');assert.equal(p.g.describe(p.s).summary.includes(String(p.s.serial)),false);},
  'crew-coop'(p){p.cmd('drive');assert.deepEqual(p.s.power,[2,2,2]);p.cmd('swap');p.cmd('drive');assert.equal(p.s.power.reduce((a,b)=>a+b,0),6);const y=p.s.ship.y;p.act({type:'down'});assert.equal(p.s.ship.y,y);},
  'cargo-duo'(p){p.cmd('grip');const before={...p.s.cargo};p.cmd('force-right');assert.deepEqual(p.s.cargo,before);assert.equal(p.s.moves,0);assert.equal(p.s.grips[0],false);},
  'kitchen-coop'(p){p.cmd('swap');p.cmd('interact');assert.deepEqual(p.s.hands,['','']);p.cmd('swap');p.cmd('interact');p.cmd('interact');assert.equal(p.s.hands[1],'raw');assert.equal(p.s.delivered,0);},
  'vietnamese-crossword'(p){p.text('ZZZ');p.cmd('submit');assert.equal(p.s.errors,1);assert.ok(p.s.board.every(v=>v===''));p.text('sáo');p.cmd('submit');assert.equal(p.s.board[6],'A');},
  'word-tiles'(p){p.cell(0);p.text('SAO');p.cmd('submit');assert.equal(p.s.round,0);assert.equal(p.s.points[0],0);assert.ok(p.s.board.every(v=>!v));p.cell(12);p.text('ZZZ');p.cmd('submit');assert.equal(p.s.round,0);},
  'sentence-weaver'(p){p.cmd('verb-2');p.cmd('object-2');p.cmd('append');assert.equal(p.s.errors,1);assert.equal(p.s.events.length,0);},
  'cipher-workbench'(p){p.text('A');p.cmd('assign');const first=p.s.selected;p.cmd('next');p.text('A');p.cmd('assign');assert.equal(p.s.mapping[first],'A');assert.equal(p.s.mapping[p.s.selected],undefined);assert.equal(p.g.describe(p.s).textInput.submit,'assign');},
  'typing-constellation'(p){p.text('Wrong');const errors=p.s.incorrect;p.text('');assert.equal(p.s.incorrect,errors);p.cmd('submit');assert.equal(p.s.level,1);assert.equal(p.s.completed.length,0);},
  'pottery-wheel'(p){p.cell(-1);assert.equal(p.s.selected,0);p.act({type:'pointer',phase:'move',x:450,y:100});assert.ok(p.s.radii.every(v=>v===40));for(let i=0;i<4;i++)p.cmd('fire');assert.equal(p.s.status,'lost');},
  'stained-glass'(p){p.cmd('check');assert.equal(p.s.errors,1);assert.equal(p.s.level,1);assert.ok(p.g.rules.error(p.s).some(v=>v.edge>3));},
  'bonsai-topiary'(p){p.cmd('prune');assert.equal(p.s.branches[0].alive,true);p.cmd('finish');assert.equal(p.s.status,'playing');p.cmd('branch-3');p.cmd('prune');p.cmd('season');assert.equal(p.s.branches[3].alive,false);assert.equal(p.s.branches[3].length,100);},
  'perspective-camera'(p){for(let i=0;i<5;i++)p.cmd('capture');assert.equal(p.s.status,'lost');assert.equal(p.s.photos.length,0);},
  'print-register'(p){for(let i=0;i<5;i++)p.cmd('print');assert.equal(p.s.status,'lost');assert.equal(p.s.waste,5);assert.equal(p.s.level,1);}
};
for(const {id} of catalog)test(id+': invalid or incomplete decisions obey the published constraints',()=>rules[id](player(id)));

test('the three timed Story games vary the actual deadline with difficulty',()=>{for(const id of ['swarm-conductor','paint-skirmish','kitchen-coop']){const g=engines[id],normal=g.create({difficulty:'normal'}),easy=g.create({difficulty:'easy'}),hard=g.create({difficulty:'hard'});assert.equal(easy.timeLeft,normal.timeLeft*1.25);assert.equal(hard.timeLeft,normal.timeLeft*.8);}});
test('word-tiles full legal play can also lose, and idle area control loses against the bot',()=>{assert.equal(walkthrough('word-tiles',{seed:'story-proof',difficulty:'normal'}).state.status,'lost');const p=player('paint-skirmish');p.ticks(710);assert.equal(p.s.status,'lost');assert.ok(p.s.board.some(v=>v===-1));});
