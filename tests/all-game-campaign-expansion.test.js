'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {solve,specs,base,groups}=require('../scripts/all-game-campaign-expansion-solutions.js');
const Campaign=require('../all-game-campaign-core.js');
const cmd=id=>({type:'command',id}),cell=index=>({type:'cell',index});
const context=new Proxy({createLinearGradient:()=>({addColorStop(){}})}, {get(t,k){return k in t?t[k]:(...args)=>undefined;},set(t,k,v){t[k]=v;return true;}});
const validationCommands={
 'slither-loop':'check','hashi-islands':'check','nurikabe-coast':'check','kakuro-sums':'check','logic-grid':'check','gearworks':'test','fluid-gates':'check','woodcut-planner':'assemble','logic-circuit':'test','lens-bench':'test','radar-triangulation':'verify','reaction-lab':'react','genetics-garden':'breed','geology-strata':'check','crystal-symmetry':'check','station-detective':'conclude','treaty-dialogue':'sign','cartographer-expedition':'return','vietnamese-crossword':'submit','word-tiles':'submit','cipher-workbench':'submit','typing-constellation':'submit','pottery-wheel':'fire','stained-glass':'check','bonsai-topiary':'finish','perspective-camera':'capture','print-register':'print',
 'dj-transition':'play','loop-band':'submit','pitch-glider':'play','harmony-workshop':'submit','orchestra-cues':'play','rope-cut-puzzle':'run','counterweight-rig':'release','domino-machine':'run','vertical-mall':'day','pet-care-clinic':'rest','hotel-manager':'admit','airport-terminal':'gate0','coaster-designer':'test','bakery-shift':'deliver','seasonal-farm':'harvest','power-grid':'dispatch','water-utility':'day','packet-router':'to4','orbital-transfer':'dock','thermal-transit':'send','relic-room':'use','clockloop-story':'signal','party-jrpg':'attack','ability-gated-quest':'strike','survivor-camp':'shelter','creature-tamer':'ability','wildlife-tracker':'photo','rewind-warden':'rewind','time-slice-arena':'fire','rune-gesture':'cast','swarm-conductor':'wide','paint-skirmish':'hide','twin-keepers':'power','manual-defuse':'submit','crew-coop':'cruise','cargo-duo':'force-right','kitchen-coop':'interact','sentence-weaver':'append'
};
test('all thirteen packs publish exactly 65 existing games and 1,540 original campaign missions',()=>{
 assert.equal(groups.length,13);assert.equal(Object.keys(specs).length,65);assert.equal(Object.values(specs).reduce((n,s)=>n+s.missions.length,0),1540);assert.equal(specs['logic-grid'].missions.length,32);
 assert.deepEqual(Object.keys(specs).sort(),Object.keys(base).sort());assert.deepEqual(Object.keys(validationCommands).sort(),Object.keys(specs).sort());
});
for(const [id,spec]of Object.entries(specs)){
 test(id+': every mandatory mission has a fresh legal walkthrough, deterministic replay and terminal freeze',()=>{
  assert.deepEqual(Campaign.validateSpec(spec),{ok:true,errors:[]});
  assert.equal(new Set(spec.missions.map(m=>JSON.stringify(m.setup))).size,spec.missions.length,'duplicate setup');
  for(const mission of spec.missions){
   const result=solve(id,mission);assert.equal(result.state.status,'won',mission.id+': '+result.state.message);assert.ok(result.trace.length>1,mission.id+' requires real inputs');assert.ok(spec.complete(result.state).complete);
   let replay=result.engine.create({seed:'campaign-proof',difficulty:'normal'});
   for(const {action,dt}of result.trace){const before=JSON.stringify(replay);const next=result.engine.step(replay,action,dt);assert.equal(JSON.stringify(replay),before,'immutable input');replay=next;}
   assert.deepEqual(replay,result.state,mission.id+' fresh replay');
   const before=JSON.stringify(replay);for(const a of [cmd('submit'),cell(0),{type:'tick',held:{action:true}}])assert.equal(JSON.stringify(result.engine.step(replay,a,.05)),before,'completed stage frozen');
   assert.doesNotThrow(()=>result.engine.draw(context,replay,{width:720,height:480}));
  }
 });
 test(id+': incomplete decisions never count as completion and hints do not solve the game',()=>{
  for(const mission of spec.missions){const g=spec.createEngine(base[id],mission);let s=g.create({seed:'negative-proof',difficulty:'normal'});assert.equal(spec.complete(s).complete,false);
   const before=JSON.stringify(s);let hinted=g.step(s,cmd('campaign-hint'));assert.equal(JSON.stringify(s),before);assert.equal(spec.complete(hinted).complete,false);assert.equal(hinted.missionHint,1);
   if(mission.setup.choices?.length){const blocked=g.step(s,cmd(validationCommands[id]),.05);assert.deepEqual(blocked,s,'play waits for a real story choice');s=g.step(s,cmd('story-share'));}
   const next=g.step(s,cmd(validationCommands[id]),.05);assert.equal(spec.complete(next).complete,false,mission.id+' completion without solving');
  }
 });
}
for(const [id,spec]of Object.entries(specs).filter(([,s])=>s.model==='story'))test(id+': three consequential choices persist across chapters and both ending paths finish through legal play',()=>{
 const choices=spec.missions.filter(m=>m.setup.choices?.length);assert.equal(choices.length,3);assert.equal(spec.chapters.length,5);
 for(const mission of choices){const g=spec.createEngine(base[id],mission),s=g.create(),a=g.step(s,cmd('story-share')),b=g.step(s,cmd('story-reserve'));const mechanical=q=>{const v=JSON.parse(JSON.stringify(q));for(const key of ['missionFlags','missionChoice','message'])delete v[key];return v;};assert.notDeepEqual(mechanical(a),mechanical(b),mission.id+' choice must alter playable resources');assert.notDeepEqual(a.missionFlags,b.missionFlags);}
 for(const choice of ['share','reserve']){let progress=Campaign.normalizeProgress(spec,null),last;for(const mission of spec.missions){const result=solve(id,mission,{choice,progress});assert.equal(result.state.status,'won',mission.id+' '+choice);if(mission!==spec.missions.at(-1))assert.equal(result.state.ending,undefined,'ending appears at actual finale');last=result.state;progress=Campaign.applyCompletion(spec,mission,progress,spec.complete(last),1);}
  assert.equal(Object.keys(progress.completed).length,20);assert.equal(last.ending,choice==='share'?'shared-dawn':'independent-dawn');assert.equal(choices.filter(m=>progress.flags[m.setup.choiceKey]===choice).length,3);
 }
});
test('creative commissions save the actual accepted artwork, survive progress normalization and allow multiple valid pottery profiles',()=>{
 for(const [id,spec]of Object.entries(specs).filter(([,s])=>s.model==='creative'))for(const mission of spec.missions){const {state}=solve(id,mission),text=state.missionFlags['art-'+mission.id],art=JSON.parse(text);assert.ok(text.length<=300,id+' artwork bound');assert.equal(art.kind,id);assert.equal(art.version,1);assert.ok(Array.isArray(art.params));const p=Campaign.applyCompletion(spec,mission,null,spec.complete(state),1);assert.deepEqual(JSON.parse(p.flags['art-'+mission.id]),art);}
 const spec=specs['pottery-wheel'],mission=spec.missions[0],g=spec.createEngine(base['pottery-wheel'],mission);let s=g.create();for(let i=0;i<8;i++){s=g.step(s,cell(i));for(let n=0;Math.abs(s.radii[i]-(mission.setup.content.potteryOrder[i]+2))>1&&n<40;n++)s=g.step(s,cmd(s.radii[i]<mission.setup.content.potteryOrder[i]+2?'widen':'narrow'));}s=g.step(s,cmd('fire'));assert.equal(s.status,'won');assert.notDeepEqual(s.completedArtwork.params[0],mission.setup.content.potteryOrder,'rubric accepts creative variation');
});
test('Kakuro has no empty or vacuous board and protects givens through both cells and digit commands',()=>{
 for(const m of specs['kakuro-sums'].missions){const g=specs['kakuro-sums'].createEngine(base['kakuro-sums'],m);let s=g.create();const p=m.setup.content;assert.ok(p.runs.length>0);assert.ok(p.runs.every(r=>r.cells.length>0));assert.ok(p.blocked.length<s.values.length);assert.equal(base['kakuro-sums'].rules.valid(s),false);
  for(const i of m.setup.locked){const v=s.values[i];s=g.step(s,cell(i));s=g.step(s,cmd('digit9'));assert.equal(s.values[i],v);}
 }
});
test('manual screens, role permissions and campaign undo preserve real constraints',()=>{
 const spec=specs['manual-defuse'],g=spec.createEngine(base[spec.id],spec.missions[5]);let s=g.create();s=g.step(s,cmd('handover'));const before=s.entered;s=g.step(s,cmd('wire-0'));assert.deepEqual(s.entered,before);assert.equal(s.covered,true);s=g.step(s,cmd('reveal'));assert.equal(s.role,'manual');assert.equal(g.describe(s).summary.includes(String(s.serial)),false);
 const craft=specs['pottery-wheel'],engine=craft.createEngine(base[craft.id],craft.missions[0]);let p=engine.create();const radii=p.radii.slice();p=engine.step(p,cmd('widen'));assert.notDeepEqual(p.radii,radii);p=engine.step(p,cmd('campaign-undo'));assert.deepEqual(p.radii,radii);
});
test('fluid interlocks, frozen floats and gearbox locked shafts enforce the authored physical constraints',()=>{
 const spec=specs['fluid-gates'],m=spec.missions[24],g=spec.createEngine(base[spec.id],m);let s=g.create();s=g.step(s,cmd('valve'));s=g.step(s,cmd('right'));s=g.step(s,cmd('valve'));assert.deepEqual(s.gates,[false,true]);s=g.step(s,cmd('run'));const cutoffs=s.cutoffs.slice();s=g.step(s,cmd('lower'));assert.deepEqual(s.cutoffs,cutoffs);const total=s.water.reduce((a,b)=>a+b,0);for(let i=0;i<100;i++)s=g.step(s,{type:'tick',held:{}},.05);assert.ok(Math.abs(s.water.reduce((a,b)=>a+b,0)-total)<1e-8);
 const gears=specs.gearworks,engine=gears.createEngine(base.gearworks,gears.missions[20]);let q=engine.create();q=engine.step(q,{type:'right'});q=engine.step(q,{type:'action'});assert.equal(q.selected,1);const locked=q.gears[1];q=engine.step(q,cmd('teeth'));assert.equal(q.gears[1],locked);
});
test('multi-batch fictional reactions conserve material through every legal delivery',()=>{
 const spec=specs['reaction-lab'];for(const mission of spec.missions){const result=solve(spec.id,mission);let s=result.engine.create({seed:'campaign-proof',difficulty:'normal'});const mass=base[spec.id].rules.mass(s);for(const {action,dt}of result.trace){s=result.engine.step(s,action,dt);assert.equal(base[spec.id].rules.mass(s),mass,mission.id+' '+action.id);}assert.equal(s.status,'won');}
});
test('composed musical programs and visible island clues do not count editorial labels as new content',()=>{
 for(const id of ['loop-band','orchestra-cues']){const values=specs[id].missions.map(m=>JSON.stringify(m.setup.content));assert.equal(new Set(values).size,16);}
 const clues=specs['nurikabe-coast'].missions.map(m=>JSON.stringify(m.setup.state.seeds));assert.equal(new Set(clues).size,32);for(const m of specs['nurikabe-coast'].missions){assert.ok(m.setup.state.seeds.some(c=>c.size>1));const g=specs['nurikabe-coast'].createEngine(base['nurikabe-coast'],m),s=g.create();assert.equal(base['nurikabe-coast'].rules.valid(s),false);}
});
test('a full creative campaign carries fractional artworks while bounding live checkpoint undo bytes',()=>{
 const Store=require('../all-game-campaign-store.js'),Common=require('../all-game-campaign-exp-common.js');
 for(const [id,spec]of Object.entries(specs).filter(([,s])=>s.model==='creative')){
  let progress=Campaign.normalizeProgress(spec,null);
  for(const mission of spec.missions){
   const {trace}=solve(id,mission,{progress}),engine=spec.createEngine(base[id],mission,{progress});let state=engine.create({seed:'campaign-proof',difficulty:'normal'});
   const priorArt=Object.fromEntries(Object.entries(progress.flags).filter(([key])=>key.startsWith('art-')));
   for(const item of trace){
    const action=id==='stained-glass'&&item.action.type==='pointer'?Object.assign({},item.action,{x:item.action.x+.1234567890123,y:item.action.y+.2345678901234}):item.action;
    const before=state;state=engine.step(state,action,item.dt);
    if(state.status==='playing'){
     assert.ok(Store.validJSON(state),mission.id+' serializable live checkpoint');assert.ok(JSON.stringify(state).length<Store.MAX_SNAPSHOT,mission.id+' live checkpoint size');
     assert.ok(state.missionUndo.length<=Common.MAX_UNDO_ENTRIES);assert.ok(Buffer.byteLength(JSON.stringify(state.missionUndo),'utf8')<=Common.MAX_UNDO_BYTES);
     for(const [key,value]of Object.entries(priorArt))assert.equal(state.missionFlags[key],value,'earlier artwork survives ordinary play');
     if(state.missionUndo.length&&state.missionMoves>before.missionMoves&&action.type==='command'&&action.id!=='campaign-hint'){
      const undone=engine.step(state,cmd('campaign-undo')),expected=JSON.parse(JSON.stringify(before));delete expected.missionUndo;const actual=JSON.parse(JSON.stringify(undone));delete actual.missionUndo;
      assert.deepEqual(actual,expected,mission.id+' restores the prior complete simulation');
      for(const [key,value]of Object.entries(priorArt))assert.equal(undone.missionFlags[key],value,'undo preserves accumulated artwork');
     }
    }
   }
   assert.equal(state.status,'won',mission.id+' fractional legal play');progress=Campaign.applyCompletion(spec,mission,progress,spec.complete(state),1);assert.ok(JSON.stringify(progress).length<Store.MAX_PROGRESS);
  }
  assert.equal(Object.keys(progress.completed).length,spec.missions.length);assert.equal(Object.keys(progress.flags).filter(key=>key.startsWith('art-')).length,20);for(const [key,value]of Object.entries(progress.flags).filter(([key])=>key.startsWith('art-'))){assert.ok(value.length<=300,key);assert.equal(JSON.parse(value).kind,id);}
 }
});
