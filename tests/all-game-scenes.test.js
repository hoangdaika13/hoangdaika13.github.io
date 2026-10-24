const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),scene=require('../all-game-scenes.js'),{CATALOG}=require('../all-game.js');
test('All209 games have deterministic, distinct original SVG scenery in12 context families',()=>{
  assert.equal(Object.keys(scene.profiles).length,209);assert.equal(new Set(Object.values(scene.profiles).map(p=>p.theme)).size,12);
  const posters=CATALOG.map(g=>{assert.equal(scene.profiles[g.id].id,g.id);const svg=scene.thumbnail(g.id);assert.equal(svg,scene.thumbnail(g.id));assert.match(svg,/viewBox="0 0 720 480"/);assert.doesNotMatch(svg,/<script|<foreignObject|<image|href=|undefined|NaN/);return svg;});assert.equal(new Set(posters).size,209);
});
test('Shared Canvas scenery is finite, balanced and never alters gameplay state',()=>{
  let balance=0,draws=0;const gradient={addColorStop(i,c){assert.ok(i>=0&&i<=1);assert.match(c,/^#[a-f0-9]+$/i);}};
  const ctx=new Proxy({save(){balance++;},restore(){balance--;},createLinearGradient(){return gradient;},createRadialGradient(){return gradient;}},{get(target,key){return key in target?target[key]:function(...args){for(const value of args)if(typeof value==='number')assert.ok(Number.isFinite(value));draws++;};}});
  for(const g of CATALOG){const state=Object.freeze({id:g.id,score:4});scene.paint(ctx,g.id,state);assert.equal(balance,0);assert.equal(state.score,4);}assert.ok(draws>1000);
});
test('Scene helper owns no media, network, DOM, random wall clock or render loop',()=>{
  const source=fs.readFileSync(require.resolve('../all-game-scenes.js'),'utf8');assert.doesNotMatch(source,/requestAnimationFrame|setInterval|setTimeout|fetch\(|new Image|document\.|Date\.now|Math\.random/);
});
