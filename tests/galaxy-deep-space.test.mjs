import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeepSpace, starAttributes, SKY_BUDGETS} from '../galaxy-deep-space.mjs';
import {readFileSync} from 'node:fs';

test('spectral sky is deterministic, distributed in depth and bounded at every tier', () => {
  const stars=starAttributes();assert.deepEqual(stars,starAttributes());assert.notDeepEqual(stars,starAttributes(42));
  assert.equal(stars.position.length,2400*3);assert.equal(stars.color.length,stars.position.length);
  for(let i=0;i<2400;i++){
    const r=Math.hypot(...stars.position.slice(i*3,i*3+3));assert.ok(r>=105&&r<=150.001);
    assert.ok(stars.size[i]>=1.3&&stars.size[i]<6);assert.ok(stars.phase[i]>=0&&stars.phase[i]<Math.PI*2);
  }
  for(const {stars:n} of Object.values(SKY_BUDGETS))assert.ok(n<=2400&&n>0);
});
test('all quality prefixes include large and small stars with more than one color', () => {
  const stars=starAttributes();for(const {stars:n} of Object.values(SKY_BUDGETS)){
    assert.ok(stars.size.slice(0,n).some(v=>v>=4));assert.ok(stars.size.slice(0,n).some(v=>v<2));
    assert.ok(new Set(stars.color.slice(0,n*3).map(v=>v.toFixed(2))).size>20);
  }
});

test('every quality tier keeps a dense tilted band and a sparse surrounding halo', () => {
  const stars=starAttributes(),normal=[-Math.cos(-.25)*Math.sin(-1.1),Math.cos(-.25)*Math.cos(-1.1),Math.sin(-.25)];
  for(const {stars:n} of Object.values(SKY_BUDGETS)){
    let band=0,halo=0;
    for(let i=0;i<n;i++){
      const point=stars.position.slice(i*3,i*3+3),radius=Math.hypot(...point);
      const latitude=Math.abs(point.reduce((sum,v,j)=>sum+v*normal[j],0)/radius);
      if(latitude<.24)band++;if(latitude>.65)halo++;
    }
    assert.ok(band/n>.7,'most stars form the same visible band at every tier');
    assert.ok(halo/n>.07,'a sparse halo avoids flattening the sky into a sheet');
  }
});
test('one point cloud and one shared nebula geometry: quality changes allocate nothing', () => {
  const assets=new Set(),sky=createDeepSpace(a=>{assets.add(a);return a;});const count=assets.size;
  assert.equal(sky.group.children.length,4);assert.ok(sky.stars.isPoints);
  assert.equal(new Set(sky.nebulae.map(n=>n.geometry)).size,1);
  assert.equal(new Set(sky.nebulae.map(n=>n.position.z)).size,3);
  for(const [tier,budget] of Object.entries(SKY_BUDGETS)){
    sky.setQuality(tier);assert.equal(sky.stars.geometry.drawRange.count,budget.stars);
    assert.equal(sky.nebulae.filter(n=>n.visible).length,budget.nebulae);assert.equal(assets.size,count);
  }
  sky.setPixelRatio(9);assert.equal(sky.stars.material.uniforms.dpr.value,2);
  sky.update(17);assert.equal(sky.stars.material.uniforms.time.value,17);
  for(const n of sky.nebulae)assert.equal(n.material.uniforms.time.value,17);
  sky.setPalette('#ff0000','#00ffff');assert.equal(sky.nebulae[0].material.uniforms.tint.value.getHexString(),'ff0000');
  let disposed=0;assets.forEach(a=>a.addEventListener('dispose',()=>disposed++));assets.forEach(a=>a.dispose());assert.equal(disposed,count);
});
test('both renderers share the local sky, whose exact module version is cached',()=>{
  const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
  for(const name of ['galaxy-universe-renderer.mjs','galaxy-workspace-renderer.mjs'])assert.match(read(name),/from '\.\/galaxy-deep-space\.mjs\?v=2'/);
  assert.match(read('sw.js'),/"\.\/galaxy-deep-space\.mjs\?v=2"/);
  assert.doesNotMatch(read('galaxy-deep-space.mjs'),/requestAnimationFrame|https?:\/\//);
});
