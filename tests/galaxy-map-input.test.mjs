import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as Three from '../vendor/three.module.min.js';
import * as celestial from '../galaxy-celestial-materials.mjs';
import {createDeepSpace} from '../galaxy-deep-space.mjs';

const source=readFileSync(new URL('../galaxy-universe-renderer.mjs',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export ','');
function harness(){
 const callbacks=new Map(),capture=new Set(),selected=[];let id=0,now=0,rendered=0,focus=0,scene,camera;
 const canvas=new EventTarget();canvas.dataset={};canvas.style={};canvas.setAttribute=()=>{};canvas.remove=()=>{};
 canvas.setPointerCapture=i=>capture.add(i);canvas.releasePointerCapture=i=>capture.delete(i);
 canvas.closest=()=>({focus(){focus++;}});canvas.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:600});
 const win={devicePixelRatio:1,requestAnimationFrame:cb=>{callbacks.set(++id,cb);return id;},cancelAnimationFrame:i=>callbacks.delete(i),ResizeObserver:class{observe(){}disconnect(){}}};
 const doc={defaultView:win,createElement:()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
 const host={ownerDocument:doc,append(){},getBoundingClientRect:canvas.getBoundingClientRect};
 class GPU{constructor(){this.domElement=canvas;this.info={render:{calls:1},memory:{geometries:1}};}setPixelRatio(){}setSize(){}dispose(){}forceContextLoss(){}render(s,c){scene=s;camera=c;s.updateMatrixWorld();c.updateMatrixWorld();rendered++;}}
 const api=new Function('T','createDeepSpace',...Object.keys(celestial),source+'\nreturn {mount};')({...Three,WebGLRenderer:GPU},createDeepSpace,...Object.values(celestial));
 const control=api.mount(host,{onSelect:r=>selected.push(r)});control.setWorld([{route:'/galaxy/music',color:'#ad92df'}]);control.setOptions({active:true,motion:false,interactive:true});
 const flush=(delta=16.67)=>{now+=delta;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(cb=>cb(now));};flush();
 const send=(type,props={})=>{const e=new Event(type,{cancelable:true});Object.assign(e,{button:0,pointerId:1,clientX:100,clientY:100,...props});canvas.dispatchEvent(e);return e;};
 const planet=()=>{let p;scene.traverse(o=>{if(o.userData.route)p=o;});return p;};
 const point=()=>{const p=planet().getWorldPosition(new Three.Vector3()).project(camera);return {clientX:(p.x+1)*500,clientY:(1-p.y)*300};};
 return {control,callbacks,capture,selected,canvas,flush,send,point,planet,stats:()=>({rendered,focus})};
}
test('raycasting selects a real planet, ignores stray pointerup and never selects after a drag',()=>{
 const h=harness(),p=h.point();h.send('pointerup',p);assert.equal(h.selected.length,0);
 h.send('pointerdown',p);h.send('pointerup',p);assert.deepEqual(h.selected,['/galaxy/music']);assert.equal(h.stats().focus,1);
 h.send('pointerdown',p);h.send('pointermove',{...p,clientX:p.clientX+50});h.send('pointerup',{...p,clientX:p.clientX+50});assert.equal(h.selected.length,1);assert.equal(h.capture.size,0);h.control.destroy();
});
test('paused pointerleave redraws the highlight; reset preserves the world and restores camera',()=>{
 const h=harness();h.send('pointermove',h.point());h.flush();assert.ok(h.planet().parent.scale.x>1.1);
 h.send('pointerleave');h.flush();assert.equal(h.planet().parent.scale.x,1);assert.equal(h.callbacks.size,0);
 h.control.key('ArrowRight');h.control.zoom(-10);h.control.resetCamera();h.flush();assert.deepEqual(h.control.getCamera(),{yaw:.22,pitch:.78,distance:60});assert.equal(h.planet().userData.route,'/galaxy/music');h.control.destroy();
});
test('wheel is opt-in, simulated pinch is clamped, and exiting controls releases captures',()=>{
 const h=harness();h.control.setOptions({interactive:false});assert.equal(h.send('wheel',{deltaY:100}).defaultPrevented,false);
 h.control.setOptions({interactive:true});assert.equal(h.send('wheel',{deltaY:100}).defaultPrevented,true);
 h.send('pointerdown',{clientX:10});h.send('pointerdown',{pointerId:2,clientX:100});h.send('pointermove',{pointerId:2,clientX:120});h.send('pointermove',{pointerId:2,clientX:900});assert.equal(h.control.getCamera().distance,25);
 h.control.setOptions({interactive:false});assert.equal(h.capture.size,0);assert.equal(h.canvas.style.touchAction,'pan-y pinch-zoom');h.control.destroy();
});
test('auto economy persists through unrelated updates but a new manual quality is respected',()=>{
 const h=harness();h.control.setOptions({motion:true});for(let i=0;i<70;i++){h.flush(100);assert.equal(h.callbacks.size,1);}assert.equal(h.canvas.dataset.quality,'economy');
 h.control.setOptions({interactive:false,quality:'balanced'});h.flush();assert.equal(h.canvas.dataset.quality,'economy');
 h.control.setOptions({quality:'cinematic'});h.flush();assert.equal(h.canvas.dataset.quality,'cinematic');h.control.setOptions({active:false});assert.equal(h.callbacks.size,0);h.control.destroy();
});
test('context loss releases active gestures, cancels the loop and cannot render until remounted',()=>{
 const h=harness();h.control.setOptions({motion:true});h.send('pointerdown');h.send('webglcontextlost');
 assert.equal(h.capture.size,0);assert.equal(h.callbacks.size,0);const rendered=h.stats().rendered;
 h.control.setOptions({active:true});h.flush();assert.equal(h.stats().rendered,rendered);h.control.destroy();h.control.destroy();
});
