/* Original procedural artwork. One disposable scene per active workspace. */
import * as T from './vendor/three.module.min.js';
import { WORLD_PROFILES, profileFor, surfaceMaterial, atmosphereMaterial, cloudMaterial, ringMaterial, orbitPosition } from './galaxy-celestial-materials.mjs?v=2';

export const routes=Object.freeze(Object.keys(WORLD_PROFILES).map(id=>'/galaxy/'+id));
function glowTexture(doc) {
 const art=doc.createElement('canvas');art.width=art.height=128;
 const context=art.getContext('2d'),g=context.createRadialGradient(64,64,0,64,64,64);
 g.addColorStop(0,'rgba(255,255,255,.9)');g.addColorStop(.16,'rgba(255,255,255,.35)');g.addColorStop(.5,'rgba(255,255,255,.065)');g.addColorStop(1,'rgba(255,255,255,0)');
 context.fillStyle=g;context.fillRect(0,0,128,128);return new T.CanvasTexture(art);
}

// Each destination has its own spatial silhouette, sharing a single render loop.
export function buildLandmark(profile, track) {
 const group=new T.Group();group.name=profile.motif;
 const metal=track(new T.MeshStandardMaterial({color:profile.color,roughness:.4,metalness:.65,emissive:profile.accent,emissiveIntensity:.065}));
 const glow=track(new T.MeshBasicMaterial({color:profile.accent,transparent:true,opacity:.42,depthWrite:false,blending:T.AdditiveBlending}));
 const edge=track(new T.LineBasicMaterial({color:profile.accent,transparent:true,opacity:.3}));
 const torus=(r,tube=.012)=>track(new T.TorusGeometry(r,tube,6,80));
 const add=(geo,mat=metal)=>{const mesh=new T.Mesh(geo,mat);group.add(mesh);return mesh;};
 switch(profile.motif){
  case 'neural': case 'constellation': {
   const positions=[],geo=track(new T.SphereGeometry(.06,10,8));
   const dots=new T.InstancedMesh(geo,glow,18),matrix=new T.Matrix4();group.add(dots);
   for(let i=0;i<18;i++){const a=i*2.39996,y=1-i/8.5,r=Math.sqrt(Math.max(0,1-y*y)),p=new T.Vector3(Math.cos(a)*r*3,y*2.5,Math.sin(a)*r*3);matrix.makeTranslation(p.x,p.y,p.z);dots.setMatrixAt(i,matrix);positions.push(p);}
   const pairs=[];positions.forEach((p,i)=>positions.slice(i+1).forEach(q=>{if(p.distanceTo(q)<(profile.motif==='neural'?2.1:1.6))pairs.push(p,q);}));
   group.add(new T.LineSegments(track(new T.BufferGeometry().setFromPoints(pairs)),edge));break;
  }
  case 'resonance': {
   const bars=new T.InstancedMesh(track(new T.BoxGeometry(.06,1,.07)),metal,72),matrix=new T.Matrix4();
   for(let i=0;i<72;i++){const a=i/72*Math.PI*2;matrix.compose(new T.Vector3(Math.cos(a)*2.8,0,Math.sin(a)*2.8),new T.Quaternion(),new T.Vector3(1,.16+Math.pow(Math.sin(i*1.8),2)*.48,1));bars.setMatrixAt(i,matrix);}group.add(bars);add(torus(2.8),glow).rotation.x=Math.PI/2;break;
  }
  case 'frames': {
   const geo=track(new T.BoxGeometry(2.5,1.5,.1)),edges=track(new T.EdgesGeometry(geo));
   for(let i=0;i<4;i++){const f=new T.LineSegments(edges,edge);f.position.set((i-1.5)*.55,.3,(i-1.5)*1.7);f.rotation.y=-.55;group.add(f);}break;
  }
  case 'ribbons':
   for(let i=0;i<3;i++){const ribbon=add(track(new T.TorusKnotGeometry(2.6+i*.08,.018,128,5,2,3)),glow);ribbon.rotation.set(i*.7,.3+i*.4,0);}break;
  case 'archipelago': {
   const geo=track(new T.IcosahedronGeometry(.32,0));
   for(let i=0;i<14;i++){const rock=add(geo);rock.position.fromArray(orbitPosition(2.8+(i%3)*.3,i*2.39,.3));rock.scale.set(1+i%3*.3,.4,1);rock.rotation.set(i,i*.7,0);}break;
  }
  case 'lattice': {
   const box=track(new T.BoxGeometry(4.6,4.6,4.6)),geo=track(new T.EdgesGeometry(box));
   for(let i=0;i<3;i++){const mesh=new T.LineSegments(geo,edge);mesh.rotation.set(i*.26,.4+i*.25,.15);mesh.scale.setScalar(1-i*.12);group.add(mesh);}break;
  }
  case 'observatory': case 'gyroscope':
   for(let i=0;i<3;i++){const g=add(torus(2.6+i*.25,profile.motif==='gyroscope'?.038:.016));g.rotation.set(Math.PI/2-i*.6,i*.55,.25);}break;
  case 'arcs':
   for(let i=0;i<7;i++){const arc=add(track(new T.TorusGeometry(2.4+i*.12,.018,6,60,Math.PI*(.9+i*.11))),glow);arc.rotation.set(Math.PI/2,.25,i*.45);arc.position.y=(i-3)*.14;}break;
  case 'station': {
   const geo=track(new T.BoxGeometry(.3,.18,.6));
   for(let i=0;i<8;i++){const a=i*Math.PI/4,m=add(geo);m.position.fromArray(orbitPosition(2.9,a,.1));m.rotation.y=-a;}add(torus(2.9,.06)).rotation.x=Math.PI/2;break;
  }
 }
 return group;
}

export function mount(host, options = {}) {
 if(!host?.ownerDocument)return null;
 const doc=host.ownerDocument,win=doc.defaultView,profile=profileFor(options.route);
 const assets=new Set(),track=value=>{assets.add(value);return value;};
 let renderer,resizeObserver,intersection,canvas,scene;
 let frame=0,last=0,elapsed=0,frames=0,sampleTime=0,samples=0,total=0;
 let active=true,visible=true,destroyed=false,lost=false,requestedMotion=options.motion!==false;
 let quality=options.quality||'mid',requestedQuality=quality;
 const reduced=win.matchMedia?.('(prefers-reduced-motion: reduce)'),contrast=win.matchMedia?.('(forced-colors: active)');
 const controller=new AbortController(),signal=controller.signal;
 const motion=()=>requestedMotion&&!reduced?.matches;
 const canRender=()=>!destroyed&&!lost&&active&&visible&&!doc.hidden&&!contrast?.matches;
 function stop(){if(frame)win.cancelAnimationFrame(frame);frame=0;last=0;if(canvas)canvas.dataset.running='false';}
 function destroy(){if(destroyed)return;destroyed=true;stop();controller.abort();resizeObserver?.disconnect();intersection?.disconnect();assets.forEach(asset=>asset.dispose?.());assets.clear();scene?.clear();renderer?.dispose();renderer?.forceContextLoss();canvas?.remove();}
 try {
  renderer=new T.WebGLRenderer({alpha:true,antialias:quality!=='low',powerPreference:'default'});
  canvas=renderer.domElement;canvas.dataset.hgl1WorkspaceWebgl='';canvas.dataset.route=String(options.route||'');canvas.dataset.motif=profile.motif;canvas.setAttribute('aria-hidden','true');host.replaceChildren(canvas);
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
  scene=new T.Scene();const camera=new T.PerspectiveCamera(38,1,.1,100);camera.position.set(0,.6,11);camera.lookAt(0,0,0);
  const root=new T.Group();scene.add(root);const lightPosition=new T.Vector3(-5,5,8);
  const sphere=track(new T.SphereGeometry(1,64,44));
  const material=track(surfaceMaterial(profile,Object.keys(WORLD_PROFILES).indexOf(String(options.route).split('/').pop())*3.71+1,lightPosition));
  const planet=new T.Mesh(sphere,material);planet.scale.setScalar(1.7);planet.rotation.z=profile.tilt;root.add(planet);
  const shell=new T.Mesh(sphere,track(atmosphereMaterial(profile.accent,lightPosition)));shell.scale.setScalar(1.79);root.add(shell);
  const clouds=profile.kind===0?new T.Mesh(sphere,track(cloudMaterial(material.uniforms.seed.value,lightPosition))):null;
  if(clouds){clouds.scale.setScalar(1.74);clouds.rotation.z=profile.tilt;root.add(clouds);}
  const glow=track(glowTexture(doc));
  const halo=new T.Sprite(track(new T.SpriteMaterial({map:glow,color:profile.accent,transparent:true,opacity:.18,depthWrite:false,blending:T.AdditiveBlending})));halo.scale.set(7,7,1);halo.position.z=-1;root.add(halo);
  const ring=new T.Mesh(track(new T.RingGeometry(2.2,2.85,128,1)),track(ringMaterial(profile.accent,2.2,2.85,lightPosition,root.position,1.7)));ring.rotation.set(1.13,.22,.15);ring.visible=profile.kind===1||profile.kind===2;root.add(ring);
  const landmark=buildLandmark(profile,track);root.add(landmark);
  const moons=[];
  for(let i=0;i<2;i++){const moon=new T.Mesh(sphere,track(surfaceMaterial({...profile,kind:3,color:'#9c99a1'},19+i,lightPosition)));moon.scale.setScalar(.13+i*.05);root.add(moon);moons.push(moon);}
  scene.add(new T.HemisphereLight(0xaec7e5,0x0b061a,.75));
  const key=new T.PointLight(0xffe2bf,60,40,2);key.position.copy(lightPosition);scene.add(key);
  const fill=new T.PointLight(profile.accent,16,30,2);fill.position.set(5,-3,2);scene.add(fill);
  let seed=material.uniforms.seed.value*991+17;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const positions=[],colors=[];
  for(let i=0;i<850;i++){positions.push((random()-.5)*45,(random()-.5)*24,-5-random()*25);const c=new T.Color(i%7?'#b9cddd':'#f4c49c');colors.push(c.r,c.g,c.b);}
  const starGeometry=track(new T.BufferGeometry());starGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));starGeometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const starfield=new T.Points(starGeometry,track(new T.PointsMaterial({size:.065,map:glow,vertexColors:true,transparent:true,opacity:.65,depthWrite:false,blending:T.AdditiveBlending})));scene.add(starfield);
  const nebulae=[];
  for(let i=0;i<3;i++){const n=new T.Sprite(track(new T.SpriteMaterial({map:glow,color:i===1?profile.accent:profile.color,transparent:true,opacity:.12,depthWrite:false,blending:T.AdditiveBlending})));n.position.set((i-1)*12,(i-1)*4,-12-i*3);n.scale.set(30,14,1);scene.add(n);nebulae.push(n);}
  function pose(){
   planet.rotation.y=elapsed*profile.spin;if(clouds)clouds.rotation.y=elapsed*profile.spin*1.17;
   landmark.rotation.y=elapsed*.014;landmark.rotation.z=Math.sin(elapsed*.06)*.035;
   moons.forEach((moon,i)=>moon.position.fromArray(orbitPosition(3.1+i*.4,elapsed*(.085-i*.018)+i*2.3,.3+i*.25)));
   starfield.rotation.z=Math.sin(elapsed*.006)*.02;material.uniforms.time.value=elapsed;
  }
  function renderOnce(){
   if(!canRender())return;pose();renderer.render(scene,camera);total++;canvas.dataset.frames=String(total);canvas.dataset.drawCalls=String(renderer.info.render.calls);canvas.dataset.geometries=String(renderer.info.memory.geometries);canvas.dataset.quality=quality;
  }
  function resize(){
   if(destroyed||lost)return;const box=host.getBoundingClientRect();if(!box.width||!box.height)return;
   renderer.setPixelRatio(Math.min(win.devicePixelRatio||1,quality==='high'?1.5:quality==='low'?1:1.25));renderer.setSize(box.width,box.height,false);camera.aspect=box.width/box.height;camera.updateProjectionMatrix();
   root.position.x=box.width>720?2:0;root.position.y=box.width>720?.25:.55;root.scale.setScalar(box.width>720?1:Math.min(1,box.width/590));ring.material.uniforms.radius.value=1.7*root.scale.x;renderOnce();
  }
  function applyQuality(){starGeometry.setDrawRange(0,quality==='low'?240:quality==='high'?850:500);shell.visible=quality!=='low';if(clouds)clouds.visible=quality!=='low';nebulae.forEach(n=>n.visible=quality!=='low');landmark.visible=quality!=='low';resize();}
  function tick(now){
   frame=0;if(!canRender()){stop();return;}const raw=last?now-last:16.67,delta=Math.min(raw/1000,.05);last=now;
   if(motion())elapsed+=delta;renderOnce();canvas.dataset.running=String(motion());
   if(motion()&&raw<120){frames++;sampleTime+=raw;if(sampleTime>=2500){const fps=frames*1000/sampleTime;canvas.dataset.fps=fps.toFixed(1);samples=fps<25?samples+1:0;frames=0;sampleTime=0;if(samples>=2&&quality!=='low'){quality='low';applyQuality();options.onStatus?.('Tự giảm đồ họa để giữ thao tác nhẹ.');}}}
   else if(raw>=120){frames=0;sampleTime=0;samples=0;}
   if(motion())frame=win.requestAnimationFrame(tick);
  }
  function schedule(){if(!canRender()){stop();return;}if(!frame){last=0;frame=win.requestAnimationFrame(tick);}}
  function setOptions(next={}){
   if('active'in next)active=!!next.active;if('motion'in next)requestedMotion=!!next.motion;
   if(next.quality&&next.quality!==requestedQuality){quality=next.quality;requestedQuality=quality;samples=0;applyQuality();}
   stop();schedule();
  }
  function visibility(){stop();schedule();}
  doc.addEventListener('visibilitychange',visibility,{signal});reduced?.addEventListener?.('change',visibility,{signal});contrast?.addEventListener?.('change',visibility,{signal});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;stop();host.dataset.state='fallback';options.onError?.(new Error('WEBGL_CONTEXT_LOST'));},{signal});
  resizeObserver=new win.ResizeObserver(resize);resizeObserver.observe(host);
  intersection=win.IntersectionObserver?new win.IntersectionObserver(records=>{visible=records[0]?.isIntersecting!==false;stop();schedule();},{threshold:0}):null;intersection?.observe(host);
  pose();applyQuality();schedule();options.onReady?.();
  return {setOptions,destroy};
 }catch(error){destroy();options.onError?.(error);return null;}
}
