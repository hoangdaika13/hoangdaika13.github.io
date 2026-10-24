'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const catalog=require('../all-game-expansion-catalog.js'),host=require('../all-game.js'),scenes=require('../all-game-scenes.js');
const bundles=Object.fromEntries([...new Set(catalog.map(g=>g.bundle))].map(name=>[name,require('../all-game-'+name+'.js')]));
const finite=v=>{if(typeof v==='number')assert.ok(Number.isFinite(v));else if(v&&typeof v==='object')Object.values(v).forEach(finite);};
test('100 new mechanics in20 lazy bundles preserve all109 existing IDs and supply original artwork',()=>{
  assert.equal(catalog.length,100);assert.equal(Object.keys(bundles).length,20);assert.equal(new Set(catalog.map(g=>g.id)).size,100);assert.equal(host.CATALOG.length,209);
  const beforeIDs=host.CATALOG.filter(g=>g.release!=='expansion').map(g=>g.id);assert.equal(beforeIDs.length,109);assert.equal(new Set(beforeIDs).size,109);
  for(const g of catalog){const engine=bundles[g.bundle].games[g.id];assert.ok(engine,g.id);assert.equal(g.route,'/all-game/'+g.id);assert.ok(g.mechanic.length>20&&g.difference.length>20,g.id+' mechanic comparison');assert.ok(g.closest&&g.closest!==g.id);assert.ok(Array.isArray(g.tags)&&g.tags.length>1);assert.equal(g.release,'expansion');assert.ok(scenes.illustration(g.id).length>300);assert.equal(g.realtime,engine.realtime);}
  for(const bundle of Object.values(bundles))assert.equal(Object.keys(bundle.games).length,5);
});
for(const row of catalog)test(row.id+': deterministic immutable rules, finite JSON and actual renderer',()=>{
  const game=bundles[row.bundle].games[row.id];
  for(const difficulty of ['easy','normal','hard']){
    let a=game.create({seed:'atlas-check',difficulty}),b=game.create({seed:'atlas-check',difficulty});assert.deepEqual(a,b);assert.equal(a.status,'playing');assert.equal(host.validSnapshot(a,row.id),true);
    let balance=0,draws=0;const gradient={addColorStop(n){assert.ok(n>=0&&n<=1);}},ctx=new Proxy({save(){balance++;},restore(){balance--;},createLinearGradient(){return gradient;},createRadialGradient(){return gradient;}},{get(o,k){return k in o?o[k]:(...args)=>{args.forEach(v=>{if(typeof v==='number')assert.ok(Number.isFinite(v),row.id+' '+k);});draws++;};}});
    for(let i=0;i<40;i++){const d=game.describe(a),actions=(d.actions||[]).filter(x=>!x.disabled),action=i%5===0&&actions.length?{type:'command',id:actions[i%actions.length].id}:i%7===0?{type:'cell',index:i%20}:i%3===0?{type:'action'}:{type:'tick',held:{right:i%2===0},elapsed:.035};const source=a,before=JSON.stringify(a),input=JSON.stringify(action);a=game.step(a,action,.035);b=game.step(b,action,.035);assert.deepEqual(a,b);assert.equal(JSON.stringify(action),input);assert.equal(JSON.stringify(source),before);finite(a);}
    const before=JSON.stringify(a);game.draw(ctx,a,{width:720,height:480,reducedMotion:false,paintScene:scenes.paint});game.draw(ctx,a,{width:375,height:250,reducedMotion:true});assert.equal(JSON.stringify(a),before);assert.equal(balance,0);assert.ok(draws>10);assert.deepEqual(JSON.parse(JSON.stringify(a)),a);
    for(const status of ['won','lost']){const ended={...a,status};assert.deepEqual(game.step(ended,{type:'action'},.05),ended);}
  }
});
test('new engines do not own browser resources or use nondeterministic random input',()=>{
  for(const name of Object.keys(bundles)){const source=fs.readFileSync(path.join(__dirname,'..','all-game-'+name+'.js'),'utf8');assert.doesNotMatch(source,/requestAnimationFrame|setInterval|setTimeout|fetch\(|document\.|localStorage|Math\.random|AudioContext/);}
});
test('long input sessions keep undo, gesture points and flight waypoints within checkpoint budgets',()=>{
  const cube=bundles['exp-classic'].games['twist-cube'];let state=cube.create({seed:2026});
  for(let i=0;i<600;i++){const choices=Array.from({length:6},(_,j)=>cube.step(state,{type:'command',id:'face'+((i+j)%6)}));state=choices.find(s=>s.status==='playing');assert.ok(state);}
  assert.equal(state.history.length,256);assert.equal(host.validSnapshot(state,state.id),true);
  const rune=bundles['exp-action'].games['rune-gesture'];state=rune.create();for(let i=0;i<600;i++)state=rune.step(state,{type:'cell',index:i%9});assert.equal(state.points.length,80);assert.ok(host.validSnapshot(state,state.id));
  const traffic=bundles['exp-vehicles'].games['air-traffic-control'];state=traffic.create();for(let i=0;i<600;i++)state=traffic.step(state,{type:'pointer',phase:'down',x:700,y:450});assert.ok(state.planes.every(p=>p.route.length<=64));assert.ok(host.validSnapshot(state,state.id));
});
