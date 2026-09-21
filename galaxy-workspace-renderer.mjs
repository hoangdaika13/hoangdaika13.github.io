/*
 * HH Galaxy workspace portal renderer.
 * Original procedural artwork. Three.js is bundled locally under the MIT license.
 */
import * as T from './vendor/three.module.min.js';

const THEMES = Object.freeze({
  '/galaxy/ai': ['#8b5cf6', '#22d3ee', 0],
  '/galaxy/music': ['#7c3aed', '#67e8f9', 1],
  '/galaxy/video': ['#f43f5e', '#fb923c', 2],
  '/galaxy/creator': ['#d946ef', '#8b5cf6', 3],
  '/galaxy/games': ['#22c55e', '#84cc16', 4],
  '/galaxy/dev': ['#0ea5e9', '#facc15', 5],
  '/galaxy/learning': ['#f59e0b', '#fde68a', 6],
  '/galaxy/community': ['#ec4899', '#a78bfa', 7],
  '/galaxy/tools': ['#06b6d4', '#60a5fa', 8],
  '/galaxy/analytics': ['#6366f1', '#22d3ee', 9],
  '/galaxy/settings': ['#64748b', '#a78bfa', 10]
});

const vertex = `
  varying vec3 vLocal;
  varying vec3 vNormal;
  varying vec3 vView;
  void main(){
    vLocal=position;
    vNormal=normalize(normalMatrix*normal);
    vec4 world=modelMatrix*vec4(position,1.0);
    vView=cameraPosition-world.xyz;
    gl_Position=projectionMatrix*viewMatrix*world;
  }
`;

const fragment = `
  uniform float time;
  uniform float seed;
  uniform float pattern;
  uniform vec3 primary;
  uniform vec3 secondary;
  varying vec3 vLocal;
  varying vec3 vNormal;
  varying vec3 vView;
  float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
  float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  float fbm(vec3 p){float n=0.;n+=noise(p)*.55;p=p*2.03+4.7;n+=noise(p)*.28;p=p*2.11+8.1;n+=noise(p)*.17;return n;}
  void main(){
    vec3 p=normalize(vLocal);
    float large=fbm(p*(3.8+mod(pattern,3.))*1.35+seed+vec3(0.,time*.018,0.));
    float detail=fbm(p*18.+seed*2.1);
    float bands=.5+.5*sin((p.y+large*.2)*34.+pattern*1.7);
    float cells=smoothstep(.56,.83,fbm(p*11.+seed));
    float selector=mod(pattern,4.);
    float mask=selector<.8?large:selector<1.8?bands:selector<2.8?cells:mix(large,bands,.45);
    vec3 color=mix(primary*.22,secondary*1.08,clamp(mask*.86+detail*.18,0.,1.));
    vec3 normal=normalize(vNormal),viewDir=normalize(vView),lightDir=normalize(vec3(-.7,.55,1.));
    float diffuse=max(dot(normal,lightDir),0.);
    float wrap=max(dot(normal,lightDir)*.55+.45,0.);
    float rim=pow(1.-max(dot(normal,viewDir),0.),3.2);
    float spec=pow(max(dot(reflect(-lightDir,normal),viewDir),0.),44.);
    color*=.15+diffuse*.78+wrap*.18;
    color+=secondary*rim*.34+vec3(1.)*spec*.32;
    gl_FragColor=vec4(color,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const atmosphere = `
  uniform vec3 glow;
  varying vec3 vNormal;
  varying vec3 vView;
  void main(){float rim=pow(1.-max(dot(normalize(vNormal),normalize(vView)),0.),3.5);gl_FragColor=vec4(glow,rim*.5);}
`;

function glowTexture(doc) {
  const art = doc.createElement('canvas'); art.width = art.height = 128;
  const context = art.getContext('2d');
  const gradient = context.createRadialGradient(64,64,0,64,64,64);
  gradient.addColorStop(0,'rgba(255,255,255,.9)');
  gradient.addColorStop(.18,'rgba(255,255,255,.48)');
  gradient.addColorStop(.48,'rgba(255,255,255,.12)');
  gradient.addColorStop(1,'rgba(255,255,255,0)');
  context.fillStyle=gradient;context.fillRect(0,0,128,128);
  return new T.CanvasTexture(art);
}

export function mount(host, options = {}) {
  if (!host?.ownerDocument) return null;
  const doc=host.ownerDocument,win=doc.defaultView,route=String(options.route||'');
  const theme=THEMES[route]||['#8b5cf6','#22d3ee',0];
  const primary=new T.Color(theme[0]),secondary=new T.Color(theme[1]);
  let renderer;
  try { renderer=new T.WebGLRenderer({alpha:true,antialias:options.quality!=='low',powerPreference:'default'}); }
  catch (error) { options.onError?.(error); return null; }
  const canvas=renderer.domElement;canvas.dataset.hgl1WorkspaceWebgl='';canvas.dataset.route=route;canvas.setAttribute('aria-hidden','true');
  host.replaceChildren(canvas);
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(38,1,.1,80);camera.position.set(0,.15,7.1);
  const root=new T.Group();root.rotation.x=-.08;scene.add(root);
  const assets=new Set(),track=value=>{assets.add(value);return value;};
  const sphere=track(new T.SphereGeometry(1.65,options.quality==='high'?64:44,options.quality==='high'?44:30));
  const material=track(new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,uniforms:{time:{value:0},seed:{value:theme[2]*3.71+1},pattern:{value:theme[2]},primary:{value:primary},secondary:{value:secondary}}}));
  const planet=new T.Mesh(sphere,material);planet.rotation.z=(theme[2]%5-2)*.055;root.add(planet);
  const atmosphereMaterial=track(new T.ShaderMaterial({vertexShader:vertex,fragmentShader:atmosphere,uniforms:{glow:{value:secondary}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.FrontSide}));
  const shell=new T.Mesh(sphere,atmosphereMaterial);shell.scale.setScalar(1.075);root.add(shell);
  const glow=track(glowTexture(doc));
  const haloMaterial=track(new T.SpriteMaterial({map:glow,color:theme[0],transparent:true,opacity:.33,depthWrite:false,blending:T.AdditiveBlending}));
  const halo=new T.Sprite(haloMaterial);halo.scale.set(6.4,6.4,1);halo.position.z=-.35;root.add(halo);
  const ringMaterial=track(new T.MeshBasicMaterial({color:theme[1],transparent:true,opacity:.34,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}));
  const ring=new T.Mesh(track(new T.RingGeometry(2.15,2.46,112,1)),ringMaterial);ring.rotation.x=Math.PI/2.52;ring.rotation.y=.14;root.add(ring);
  const orbitGroup=new T.Group();root.add(orbitGroup);
  const moons=[];
  for(let index=0;index<3;index+=1){
    const moonMaterial=track(new T.MeshStandardMaterial({color:index===1?theme[1]:'#dbeafe',roughness:.62,metalness:.12,emissive:primary,emissiveIntensity:.08}));
    const moon=new T.Mesh(track(new T.SphereGeometry(.11+index*.035,20,14)),moonMaterial);moon.userData={radius:2.45+index*.38,speed:.24-index*.035,phase:index*2.1};orbitGroup.add(moon);moons.push(moon);
    const points=Array.from({length:96},(_,step)=>{const angle=step/96*Math.PI*2;return new T.Vector3(Math.cos(angle)*moon.userData.radius,0,Math.sin(angle)*moon.userData.radius);});
    const line=new T.LineLoop(track(new T.BufferGeometry().setFromPoints(points)),track(new T.LineBasicMaterial({color:theme[index%2],transparent:true,opacity:.12})));line.rotation.x=.12+index*.13;orbitGroup.add(line);
  }
  scene.add(new T.HemisphereLight(0xb9d9ff,0x09031b,1.15));
  const key=new T.PointLight(theme[1],18,24,2);key.position.set(-3.5,3.5,5);scene.add(key);
  const fill=new T.PointLight(theme[0],12,20,2);fill.position.set(4,-2,3);scene.add(fill);
  let seed=theme[2]*991+17;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const stars=[],starColors=[];const starCount=options.quality==='high'?900:options.quality==='low'?260:520;
  for(let index=0;index<starCount;index+=1){const angle=random()*Math.PI*2,radius=7+random()*13,y=(random()-.5)*10;stars.push(Math.cos(angle)*radius,y,Math.sin(angle)*radius-4);const c=new T.Color(index%5?0xbad8ff:theme[1]);starColors.push(c.r,c.g,c.b);}
  const starGeometry=track(new T.BufferGeometry());starGeometry.setAttribute('position',new T.Float32BufferAttribute(stars,3));starGeometry.setAttribute('color',new T.Float32BufferAttribute(starColors,3));
  const starMaterial=track(new T.PointsMaterial({size:.055,map:glow,vertexColors:true,transparent:true,opacity:.78,depthWrite:false,blending:T.AdditiveBlending}));
  const starfield=new T.Points(starGeometry,starMaterial);scene.add(starfield);
  const reduced=win.matchMedia?.('(prefers-reduced-motion: reduce)');
  let motion=options.motion!==false&&!reduced?.matches,active=true,visible=true,destroyed=false,lost=false,frame=0,last=0,elapsed=0;
  const controller=new AbortController(),signal=controller.signal;
  function resize(){if(destroyed||lost)return;const box=host.getBoundingClientRect();if(!box.width||!box.height)return;const cap=options.quality==='high'?1.55:options.quality==='low'?1:1.25;renderer.setPixelRatio(Math.min(win.devicePixelRatio||1,cap));renderer.setSize(box.width,box.height,false);camera.aspect=box.width/box.height;camera.updateProjectionMatrix();renderOnce();}
  function renderOnce(){if(destroyed||lost)return;renderer.render(scene,camera);canvas.dataset.frames=String(Number(canvas.dataset.frames||0)+1);}
  function tick(now){frame=0;if(destroyed||lost||!active||!visible||doc.hidden)return;const delta=Math.min((last?now-last:16.67)/1000,.05);last=now;if(motion){elapsed+=delta;planet.rotation.y+=delta*(.105+theme[2]*.003);root.rotation.y=Math.sin(elapsed*.16+theme[2])*.09;root.position.y=Math.sin(elapsed*.42+theme[2])*.055;ring.rotation.z+=delta*.045;haloMaterial.opacity=.29+Math.sin(elapsed*.7)*.05;starfield.rotation.y=elapsed*.0025;moons.forEach((moon,index)=>{const data=moon.userData,angle=elapsed*data.speed+data.phase;moon.position.set(Math.cos(angle)*data.radius,Math.sin(angle*1.3+index)*.22,Math.sin(angle)*data.radius);moon.rotation.y+=delta*.3;});material.uniforms.time.value=elapsed;}renderOnce();canvas.dataset.running=String(motion);if(motion)frame=win.requestAnimationFrame(tick);}
  function schedule(){if(destroyed||lost||!active||!visible||doc.hidden||frame)return;last=0;frame=win.requestAnimationFrame(tick);}
  function setOptions(next={}){if('active'in next)active=!!next.active;if('motion'in next)motion=!!next.motion&&!reduced?.matches;canvas.dataset.running=String(active&&visible&&motion);if(!active&&frame){win.cancelAnimationFrame(frame);frame=0;}if(active){renderOnce();if(motion)schedule();}}
  function visibility(){if(!doc.hidden)schedule();else if(frame){win.cancelAnimationFrame(frame);frame=0;}}
  function reducedMotion(){motion=options.motion!==false&&!reduced?.matches;setOptions({motion});}
  doc.addEventListener('visibilitychange',visibility,{signal});reduced?.addEventListener?.('change',reducedMotion,{signal});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;if(frame)win.cancelAnimationFrame(frame);frame=0;host.dataset.state='fallback';options.onError?.(new Error('WEBGL_CONTEXT_LOST'));},{signal});
  const resizeObserver=new win.ResizeObserver(resize);resizeObserver.observe(host);
  const intersection=win.IntersectionObserver?new win.IntersectionObserver(records=>{visible=records[0]?.isIntersecting!==false;if(visible)schedule();else if(frame){win.cancelAnimationFrame(frame);frame=0;}},{threshold:0}):null;intersection?.observe(host);
  resize();renderOnce();schedule();options.onReady?.();
  return {setOptions,destroy(){if(destroyed)return;destroyed=true;controller.abort();resizeObserver.disconnect();intersection?.disconnect();if(frame)win.cancelAnimationFrame(frame);frame=0;assets.forEach(asset=>asset.dispose?.());assets.clear();scene.clear();renderer.dispose();renderer.forceContextLoss();canvas.remove();}};
}

export const routes=Object.freeze(Object.keys(THEMES));
