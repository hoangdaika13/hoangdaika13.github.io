import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as Three from '../vendor/three.module.min.js';
import * as celestial from '../galaxy-celestial-materials.mjs';
import {createDeepSpace} from '../galaxy-deep-space.mjs';

// Execute the actual lifecycle with Three geometry/materials and a fake GPU boundary.
// Browser fixture separately verifies shader compilation and real context loss.
const source=readFileSync(new URL('../galaxy-workspace-renderer.mjs',import.meta.url),'utf8')
 .replace(/^import .*;\r?\n/gm,'').replaceAll('export ','');
function harness(){
 const callbacks=new Map();let id=0,rendered=0,disposed=0,lost=0;
 const queries=new Map();const doc=new EventTarget();doc.hidden=false;
 const observers={};
 const win={devicePixelRatio:2,requestAnimationFrame:cb=>{callbacks.set(++id,cb);return id;},cancelAnimationFrame:i=>callbacks.delete(i),
  matchMedia:q=>{if(!queries.has(q)){const m=new EventTarget();m.matches=false;queries.set(q,m);}return queries.get(q);},
  ResizeObserver:class {constructor(cb){observers.resize=cb;}observe(){}disconnect(){observers.resize=null;}},
  IntersectionObserver:class {constructor(cb){observers.intersection=cb;}observe(){}disconnect(){observers.intersection=null;}}
 };
 doc.defaultView=win;doc.createElement=()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})});
 const canvas=new EventTarget();canvas.dataset={};canvas.style={};canvas.setAttribute=()=>{};canvas.remove=()=>{host.canvas=null;};
 const host={ownerDocument:doc,dataset:{},replaceChildren:c=>{host.canvas=c;},getBoundingClientRect:()=>({width:1000,height:600})};
 class GPU {constructor(){this.domElement=canvas;this.info={render:{calls:1},memory:{geometries:1}};}setPixelRatio(){}setSize(){}render(){rendered++;}dispose(){disposed++;}forceContextLoss(){lost++;}}
 const api=new Function('T','createDeepSpace',...Object.keys(celestial),source+'\nreturn {mount};')({...Three,WebGLRenderer:GPU},createDeepSpace,...Object.values(celestial));
 const controller=api.mount(host,{route:'/galaxy/ai',motion:true});
 const flush=()=>{const queued=[...callbacks.values()];callbacks.clear();queued.forEach(cb=>cb(16));};
 const media=(q,value)=>{const m=queries.get(q);m.matches=value;m.dispatchEvent(new Event('change'));};
 return {doc,host,canvas,controller,callbacks,observers,flush,media,stats:()=>({rendered,disposed,lost})};
}
test('workspace uses at most one loop and preserves a manual pause through system preference changes',()=>{
 const h=harness();assert.equal(h.callbacks.size,1);h.flush();assert.equal(h.callbacks.size,1);
 h.controller.setOptions({motion:false});h.flush();assert.equal(h.callbacks.size,0);
 const before=h.stats().rendered;
 h.media('(prefers-reduced-motion: reduce)',true);h.flush();h.media('(prefers-reduced-motion: reduce)',false);h.flush();
 assert.equal(h.callbacks.size,0);assert.equal(h.canvas.dataset.running,'false');assert.ok(h.stats().rendered>=before);
 h.controller.destroy();
});
test('hidden, offscreen and forced-color scenes neither render on resize nor keep a loop alive',()=>{
 const h=harness();h.flush();h.doc.hidden=true;h.doc.dispatchEvent(new Event('visibilitychange'));
 const before=h.stats().rendered;h.observers.resize();assert.equal(h.stats().rendered,before);assert.equal(h.callbacks.size,0);
 h.doc.hidden=false;h.doc.dispatchEvent(new Event('visibilitychange'));h.flush();
 h.observers.intersection([{isIntersecting:false}]);assert.equal(h.callbacks.size,0);h.observers.intersection([{isIntersecting:true}]);assert.equal(h.callbacks.size,1);
 h.media('(forced-colors: active)',true);assert.equal(h.callbacks.size,0);assert.equal(h.canvas.dataset.running,'false');h.controller.destroy();
});
test('context loss stops rendering and destruction is idempotent with observers disconnected',()=>{
 const h=harness();h.flush();h.canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));
 assert.equal(h.host.dataset.state,'fallback');assert.equal(h.callbacks.size,0);
 const count=h.stats().rendered;h.controller.setOptions({active:true});h.observers.resize();assert.equal(h.stats().rendered,count);
 h.controller.destroy();h.controller.destroy();assert.equal(h.host.canvas,null);assert.equal(h.observers.resize,null);assert.equal(h.observers.intersection,null);
 assert.equal(h.stats().disposed,1);assert.equal(h.stats().lost,1);
});
