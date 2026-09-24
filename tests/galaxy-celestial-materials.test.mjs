import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.min.js';
import { WORLD_PROFILES, profileFor, orbitPosition, damp, surfaceMaterial, cloudMaterial, ringMaterial } from '../galaxy-celestial-materials.mjs';
import { buildLandmark, routes } from '../galaxy-workspace-renderer.mjs';

test('all 11 real workspaces have a distinct spatial identity and cover five surface families',()=>{
 assert.equal(routes.length,11);
 assert.equal(new Set(Object.values(WORLD_PROFILES).map(p=>p.motif)).size,11);
 assert.deepEqual([...new Set(Object.values(WORLD_PROFILES).map(p=>p.kind))].sort(),[0,1,2,3,4]);
 for(const route of routes)assert.equal(profileFor(route),WORLD_PROFILES[route.split('/').pop()]);
 assert.equal(profileFor('/unknown',12),WORLD_PROFILES.music);
});

test('satellites stay on their tilted orbital plane and are positioned before any animation',()=>{
 for(const tilt of [0,.3,.9])for(const phase of [0,.5,Math.PI,4.6]){
  const [x,y,z]=orbitPosition(3,phase,tilt);
  assert.ok(Math.abs(Math.hypot(x,y,z)-3)<1e-12);
  assert.ok(Math.abs(y*Math.cos(tilt)-z*Math.sin(tilt))<1e-12);
 }
 assert.deepEqual(orbitPosition(3,0,.4),[3,0,0]);
});

test('camera damping converges without overshoot and is independent of normal frame rate',()=>{
 const simulate=n=>{let value=60;for(let i=0;i<n;i++)value=damp(value,25,1/n);return value;};
 assert.ok(Math.abs(simulate(60)-simulate(120))<1e-10);
 assert.ok(simulate(60)>25&&simulate(60)<26);
 assert.equal(damp(60,25,0),60);
 assert.equal(damp(60,25,-1),60);
});

test('materials keep instance uniforms isolated, retain lighting coordinates and enable depth occlusion',()=>{
 const light=new T.Vector3(1,2,3),center=new T.Vector3(4,5,6);
 const a=surfaceMaterial(WORLD_PROFILES.learning,7,light),b=surfaceMaterial(WORLD_PROFILES.learning,7,light);
 a.uniforms.selected.value=1;assert.equal(b.uniforms.selected.value,0);
 assert.equal(a.uniforms.lightPosition.value,light);assert.equal(a.depthTest,true);
 const clouds=cloudMaterial(7,light),ring=ringMaterial('#aabbcc',2,3,light,center,1);
 assert.equal(clouds.depthTest,true);assert.equal(clouds.depthWrite,false);
 assert.equal(ring.uniforms.center.value,center);assert.equal(ring.depthTest,true);
 [a,b,clouds,ring].forEach(m=>m.dispose());
});

test('every landmark builds finite real geometry within a bounded object budget',()=>{
 for(const profile of Object.values(WORLD_PROFILES)){
  const assets=new Set(),group=buildLandmark(profile,a=>{assets.add(a);return a;});
  assert.equal(group.name,profile.motif);assert.ok(group.children.length>0&&group.children.length<25);
  group.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(group);
  assert.ok(!bounds.isEmpty());assert.ok(Number.isFinite(bounds.min.x)&&Number.isFinite(bounds.max.z));
  for(const asset of assets)asset.dispose?.();
 }
});
test('repeated rocks and station modules use one instanced draw with distinct finite transforms',()=>{
 for(const [id,count] of [['games',14],['settings',8]]){
  const assets=new Set(),group=buildLandmark(WORLD_PROFILES[id],a=>{assets.add(a);return a;});
  const meshes=group.children.filter(n=>n.isInstancedMesh);assert.equal(meshes.length,1);assert.equal(meshes[0].count,count);
  const positions=new Set();for(let i=0;i<count;i++){const matrix=new T.Matrix4();meshes[0].getMatrixAt(i,matrix);assert.ok(matrix.elements.every(Number.isFinite));assert.ok(Math.abs(matrix.determinant())>.01);positions.add(matrix.elements.slice(12,15).join(','));}
  assert.equal(positions.size,count);assets.forEach(a=>a.dispose());
 }
});
