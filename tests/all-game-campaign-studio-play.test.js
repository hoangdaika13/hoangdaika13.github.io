'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../all-game-campaign-studio-runtime.js'),Core=require('../all-game-campaign-core.js');
const {solve,audit}=require('../scripts/all-game-campaign-studio-play-checks.js');
const cmd=id=>({type:'command',id}),cell=index=>({type:'cell',index});
const native=Object.fromEntries(Object.entries(R.groups).map(([bundle])=>[bundle,require('../all-game-'+bundle+'.js').games]));
for(const[bundle,ids]of Object.entries(R.groups))for(const id of ids){
  const spec=R.makeSpec(id,bundle),base=native[bundle][id];
  test(id+': published campaign is wired to native rules with stable, nonempty missions',()=>{
    assert.ok(Core.validateSpec(spec).ok);assert.equal(spec.chapters.length,4);
    assert.deepEqual(Object.keys(require('../all-game-campaign-'+bundle+'.js').games),ids);
    assert.equal(new Set(spec.missions.map(m=>m.id)).size,spec.missions.length);
    assert.equal(new Set(spec.missions.map(m=>Core.stableSignature(m.setup))).size,spec.missions.length);
    assert.equal(spec.durationStatus,'unmeasured-human-playtime');
    for(const m of spec.missions){const e=spec.createEngine(base,m,{progress:{}}),state=e.create({difficulty:'normal'}),before=JSON.stringify(state);
      assert.equal(state.id,id);assert.equal(state.status,'playing');assert.equal(spec.complete(state,m).complete,false,m.id);
      const noop=e.step(state,cmd('not-a-real-action'),0);assert.equal(spec.complete(noop,m).complete,false,m.id+' cannot complete without gameplay');
      assert.equal(JSON.stringify(state),before,'native step must not mutate its input');
      assert.deepEqual(JSON.parse(JSON.stringify(state)),state,'checkpoint must be canonical JSON');
      const d=e.describe(state);assert.ok(d.summary);assert.equal(d.missionObjective,m.objective);
      assert.equal(e.rules,base.rules);assert.equal(typeof e.draw,'function');
    }
    const classic=base.create({difficulty:'normal',seed:1234});assert.equal(classic.campaignSetup,undefined);assert.equal(classic.campaignMetric,undefined);
  });
}
test('all 1732 Studio/Play missions replay from fresh normal states through native public inputs',()=>{
  const rows=audit({all:true,limit:18000});assert.equal(rows.length,85);assert.equal(rows.reduce((n,r)=>n+r.count,0),1732);
  for(const r of rows){assert.equal(r.terminals,r.count,r.id+': every mission reaches an actual native terminal');assert.deepEqual(r.reasons,[],r.id);if(r.model!=='season')assert.equal(r.wins,r.count,r.id);}
});
for(const id of ['runedeck-quest','dungeon-chronicle'])test(id+': both whole campaigns preserve consequential decisions and reach different endings',()=>{
  const bundle='strategy-combat',spec=R.makeSpec(id,bundle),base=native[bundle][id],endings=[];
  for(const branch of ['save','power']){let progress=Core.normalizeProgress(spec,null);
    for(const mission of spec.missions){assert.ok(Core.available(spec,mission,progress));const e=spec.createEngine(base,mission,{progress}),s=e.create({difficulty:'normal'});
      if(mission.setup.stage===0){assert.equal(e.describe(s).needsFrame,false);assert.equal(e.step(s,cmd('end'),.05),s,'choice gates the next gameplay action');assert.equal(e.describe(s).story.choices.length,2);}
      const result=solve(e,mission,{branch});assert.ok(result.success,mission.id+' '+branch);progress=Core.applyCompletion(spec,mission,progress,spec.complete(result.state,mission),1000+mission.setup.variant);
      progress=Core.normalizeProgress(spec,JSON.parse(JSON.stringify(progress)));assert.ok(progress.completed[mission.id]);
    }
    assert.equal(Object.keys(progress.completed).length,16);assert.equal(Object.keys(progress.flags).filter(k=>/^decision/.test(k)).length,4);endings.push(progress.flags.ending);
  }
  assert.deepEqual(endings,['Hải đăng đoàn tụ','Ngọn đèn độc hành']);
  const mission=spec.missions[5],safe=spec.createEngine(base,mission,{progress:{flags:{decision0:'save'}}}).create({difficulty:'normal'}),power=spec.createEngine(base,mission,{progress:{flags:{decision0:'power'}}}).create({difficulty:'normal'});
  if(id==='runedeck-quest'){assert.ok(safe.deck.includes('ward'));assert.ok(power.deck.includes('meteor'));assert.notDeepEqual(safe.hand,power.hand);}else{assert.ok(safe.food>power.food);assert.ok(safe.potions>power.potions);assert.ok(power.weapon>safe.weapon);}
});
test('practice chess chapters use four different movement families and every marked capture is native-legal',()=>{
  for(const[id,bundle]of [['royal-chess','strategy-board'],['xiangqi-river','exp-board'],['shogi-drops','exp-board']]){const spec=R.makeSpec(id,bundle),types=new Set();for(const m of spec.missions){const e=spec.createEngine(native[bundle][id],m,{}),s=e.create({difficulty:'normal'});types.add(s.board[s.campaignFrom]);assert.ok(e.rules.legal(s,1).some(x=>x.from===s.campaignFrom&&x.to===s.campaignTarget),m.id);const next=e.step(s,cell(-1));assert.equal(next.score,0);assert.equal(next.status,'playing');}assert.equal(types.size,4,id);}
});
test('Go chapters change group connectivity and liberty count, rather than just stone color',()=>{
  const spec=R.makeSpec('lotus-go','strategy-board'),base=native['strategy-board']['lotus-go'];
  const samples=[0,7,14,21].map(i=>{const e=spec.createEngine(base,spec.missions[i],{}),s=e.create({difficulty:'normal'});return{stones:s.board.filter(x=>x===-1).length,liberties:s.campaignAnswers.length,target:s.campaignMetric.captureTarget};});
  assert.deepEqual(samples,[{stones:1,liberties:1,target:1},{stones:2,liberties:1,target:2},{stones:3,liberties:2,target:3},{stones:4,liberties:2,target:4}]);
});
test('carrom practice keeps queen/last-coin and striker-foul rules',()=>{
  const spec=R.makeSpec('carrom-pocket','exp-board'),base=native['exp-board']['carrom-pocket'],mission=spec.missions[0],e=spec.createEngine(base,mission,{}),s=e.create({difficulty:'normal'});
  assert.equal(s.coins.filter(c=>c.kind===0).length,2,'one practice pot is not the last own coin');
  const fixture=JSON.parse(JSON.stringify(s));fixture.coins=[{x:160,y:40,vx:0,vy:0,r:10,kind:0,sunk:true},{x:360,y:240,vx:0,vy:0,r:10,kind:2},{x:410,y:200,vx:0,vy:0,r:10,kind:1}];base.rules.resolve(fixture);assert.equal(fixture.potted[0],0);assert.equal(spec.complete(fixture,mission).complete,false,'uncovered queen returns last own coin');
});
test('rail campaign target does not alter Quick Play target; generated wildfire bases stay traversable',()=>{
  const rail=native['management-workshop']['rail-dispatch'];assert.equal(rail.create({seed:1}).campaignMetric,undefined);
  const spec=R.makeSpec('wildfire-command','management-world'),base=native['management-world']['wildfire-command'];for(const m of spec.missions){const s=spec.createEngine(base,m,{}).create({difficulty:'normal'});for(const i of [63,72,73,74])assert.notEqual(s.terrain[i],2,m.id);assert.equal(s.fuel[72],0);}
});
test('physical table games request frames only while simulation or AI needs them',()=>{
  for(const[id,bundle,command]of [['tenpin-bowling','exp-precision','roll'],['eight-ball','exp-precision','shoot'],['carrom-pocket','exp-board','shoot']]){const e=native[bundle][id],s=e.create({seed:12});assert.equal(e.describe(s).needsFrame,false);const moving=e.step(s,cmd(command));assert.equal(e.describe(moving).needsFrame,true,id);}
});
test('cube coordinates remain exact JSON through quarter turns and checkpoint round trips',()=>{
  const e=native['exp-classic']['twist-cube'];let s=e.create({seed:12});for(const command of ['face0','face1','face2','face3','face4','face5']){s=e.step(s,cmd(command));assert.deepEqual(JSON.parse(JSON.stringify(s)),s);}
});
