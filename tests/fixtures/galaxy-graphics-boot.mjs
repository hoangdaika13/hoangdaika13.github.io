import {mount as map} from '../../galaxy-universe-renderer.mjs?v=9';
import {mount as workspace} from '../../galaxy-workspace-renderer.mjs?v=4';
import {WORLD_PROFILES} from '../../galaxy-celestial-materials.mjs?v=4';
const host=document.querySelector('#scene'),status=document.querySelector('#status');
let renderer,active=true,motion=!new URLSearchParams(location.search).has('still');
const entries=Object.keys(WORLD_PROFILES).map(id=>({route:'/galaxy/'+id,title:id,color:WORLD_PROFILES[id].color}));
const routeControl=document.querySelector('#route');
for(const id of Object.keys(WORLD_PROFILES))if(![...routeControl.options].some(o=>o.value===id)){const option=document.createElement('option');option.value=id;option.textContent=id;routeControl.append(option);}
function sync(){renderer?.setOptions({active,motion,interactive:true,quality:document.querySelector('#route').value==='map'?document.querySelector('#quality').value:({economy:'low',balanced:'mid',cinematic:'high'}[document.querySelector('#quality').value])});status.value=`active=${active}; motion=${motion}`;}
function boot(){renderer?.destroy();host.dataset.state='loading';const route=document.querySelector('#route').value;const opts={route:'/galaxy/'+route,onSelect:r=>{renderer.select(r);status.value='selected='+r;},onError:()=>{host.dataset.state='fallback';status.value='WEBGL_CONTEXT_LOST';}};renderer=route==='map'?map(host,opts):workspace(host,opts);if(route==='map')renderer.setWorld(entries);host.dataset.state='ready';sync();}
document.querySelector('#route').onchange=boot;document.querySelector('#quality').onchange=sync;
document.querySelector('#pause').onclick=()=>{motion=!motion;sync();};document.querySelector('#active').onclick=()=>{active=!active;sync();};
document.querySelector('#retry').onclick=boot;document.querySelector('#destroy').onclick=()=>{renderer?.destroy();status.value='destroyed';};
document.querySelector('#loss').onclick=()=>host.querySelector('canvas')?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
host.onkeydown=e=>{if(['Home','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key)){e.preventDefault();renderer?.key?.(e.key);}};
boot();
