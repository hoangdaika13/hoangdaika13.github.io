// Original procedural artwork. One disposable WebGL renderer for the Galaxy map.
import * as T from './vendor/three.module.min.js';

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const vertex = `varying vec3 vNormal; varying vec3 vPosition; varying vec3 vLocal;
void main(){vec4 world=modelMatrix*vec4(position,1.);vPosition=world.xyz;vLocal=position;vNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*world;}`;
const noise = `float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){return noise(p)*.55+noise(p*2.03)*.28+noise(p*4.11)*.12;}`;
const surface = `${noise}
uniform vec3 tint;uniform float kind;uniform float time;uniform float seed;uniform float selected;
varying vec3 vNormal;varying vec3 vPosition;varying vec3 vLocal;
void main(){
 vec3 p=normalize(vLocal);float n=fbm(p*5.+seed);vec3 col;
 if(kind<.5){float land=smoothstep(.44,.53,n);col=mix(vec3(.025,.16,.3),mix(tint*.48,vec3(.32,.5,.28),.45),land);float ice=smoothstep(.78,.98,abs(p.y));col=mix(col,vec3(.82,.94,1.),ice);float cloud=smoothstep(.58,.72,fbm(p*9.+vec3(time*.013,seed,0.)));col=mix(col,vec3(.86,.92,1.),cloud*.8);}
 else if(kind<1.5){float band=sin(p.y*50.+n*9.+sin(p.x*5.)*1.5);col=mix(tint*.36,tint*1.07,smoothstep(-1.,1.,band));col=mix(col,vec3(.95,.8,.65),smoothstep(.54,.7,n)*.5);}
 else if(kind<2.5){col=mix(tint*.24,tint*1.1,n);float cracks=1.-smoothstep(.0,.03,abs(sin(n*43.+p.y*7.)));col=mix(col,vec3(.6,.9,1.),cracks*.3);}
 else {col=mix(tint*.18,tint*.95,n);float metal=pow(max(0.,sin(p.y*70.)),18.)*.12;col+=metal;}
 vec3 normal=normalize(vNormal),light=normalize(-vPosition),viewDir=normalize(cameraPosition-vPosition);
 float diffuse=max(dot(normal,light),0.);float spec=pow(max(dot(reflect(-light,normal),viewDir),0.),40.);
 float rim=pow(1.-max(dot(normal,viewDir),0.),3.);col*=.16+diffuse*1.08;col+=spec*.23+rim*tint*(.16+selected*.36);
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
const sunFragment = `${noise} uniform float time; varying vec3 vLocal; varying vec3 vNormal; varying vec3 vPosition;
void main(){vec3 p=normalize(vLocal);float n=fbm(p*9.+vec3(0.,time*.035,0.));float cells=noise(p*38.+n*3.);float veins=pow(abs(sin(n*15.+p.y*8.+time*.08)),4.);vec3 col=mix(vec3(1.,.19,.025),vec3(1.65,1.02,.3),n*.8+cells*.4);col+=veins*.16;float rim=pow(1.-max(dot(normalize(vNormal),normalize(cameraPosition-vPosition)),0.),2.);gl_FragColor=vec4(col*(1.-rim*.3),1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
const atmosphereFragment = `uniform vec3 tint;varying vec3 vNormal;varying vec3 vPosition;
void main(){float rim=pow(1.-abs(dot(normalize(vNormal),normalize(cameraPosition-vPosition))),3.5);float lit=.28+.72*max(dot(normalize(vNormal),normalize(-vPosition)),0.);gl_FragColor=vec4(tint,rim*lit*.32);}`;

export function mount(host, options = {}) {
  const doc = host.ownerDocument, win = doc.defaultView;
  let renderer;
  try { renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'default' }); }
  catch { throw Error('WEBGL_UNAVAILABLE'); }
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden','true');
  canvas.dataset.gluWebgl = '';
  host.append(canvas);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(44, 1, .1, 260);
  const world = new T.Group(); scene.add(world);
  const raycaster = new T.Raycaster(), pointer = new T.Vector2();
  const lookAt = new T.Vector3(), aim = new T.Vector3();
  let cameraState = { yaw: .22, pitch: .78, distance: 60, ...options.camera };
  let nodes = [], meshes = [], worldAssets = new Set(), sharedAssets = new Set();
  let active = false, motion = true, interactive = false, destroyed = false, lost = false, quality = options.quality || 'balanced';
  let frameId = 0, last = 0, elapsed = 0, hovered = '', selected = '', dirty = true;
  let frames = 0, sampleMs = 0, slowSamples = 0, frameTotal = 0, autoEconomy = false;
  let starfield, sun, corona, nebulae = [], meteor;
  const pointers = new Map(); let gesture = null, pinchDistance = 0;
  const controller = new AbortController(), signal = controller.signal;
  const register = (asset, shared = false) => { (shared ? sharedAssets : worldAssets).add(asset); return asset; };
  const settings = () => ({ dpr: quality === 'cinematic' ? 1.65 : quality === 'balanced' ? 1.3 : 1, stars: quality === 'cinematic' ? 1800 : quality === 'balanced' ? 950 : 350 });
  let seed = 8921;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  function glowTexture() {
    const art = doc.createElement('canvas'); art.width = art.height = 128;
    const context = art.getContext('2d');
    const gradient = context.createRadialGradient(64,64,0,64,64,64);
    gradient.addColorStop(0,'rgba(255,255,255,.85)'); gradient.addColorStop(.2,'rgba(255,255,255,.45)'); gradient.addColorStop(.48,'rgba(255,255,255,.12)'); gradient.addColorStop(1,'rgba(255,255,255,0)');
    context.fillStyle = gradient; context.fillRect(0,0,128,128);
    return register(new T.CanvasTexture(art), true);
  }
  const sphere = register(new T.SphereGeometry(1,40,28), true);
  const glow = glowTexture();
  function makeBackground() {
    const positions = [], colors = [];
    for (let i=0;i<1800;i++) {
      const theta=random()*Math.PI*2, y=random()*2-1, radius=80+random()*45;
      const x=Math.sqrt(1-y*y);
      positions.push(Math.cos(theta)*x*radius,y*radius,Math.sin(theta)*x*radius);
      const color=new T.Color().setHSL(.52+random()*.2,.18+random()*.28,.5+random()*.35);
      colors.push(color.r,color.g,color.b);
    }
    const geo=register(new T.BufferGeometry(),true);
    geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    starfield=new T.Points(geo,register(new T.PointsMaterial({size:.24,map:glow,vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending}),true));scene.add(starfield);
    for(let i=0;i<9;i++){
      const mat=register(new T.SpriteMaterial({map:glow,color:i%2?'#543586':'#195b78',transparent:true,opacity:.25,depthWrite:false,blending:T.AdditiveBlending}),true);
      const sprite=new T.Sprite(mat);sprite.position.set((i-4)*17,-12+(i%3)*8,-57-Math.sin(i)*12);sprite.scale.set(76,42,1);scene.add(sprite);nebulae.push(sprite);
    }
    const meteorGeo=register(new T.BufferGeometry().setFromPoints([new T.Vector3(0,0,0),new T.Vector3(-3,.8,0)]),true);
    meteor=new T.Line(meteorGeo,register(new T.LineBasicMaterial({color:'#bce9ff',transparent:true,opacity:0,depthWrite:false}),true));scene.add(meteor);
  }
  makeBackground();
  function makePlanet(entry,index,radius) {
    const group=new T.Group();world.add(group);
    const material=register(new T.ShaderMaterial({vertexShader:vertex,fragmentShader:surface,uniforms:{tint:{value:new T.Color(entry.color)},kind:{value:index%4},time:{value:0},seed:{value:index*7.13+1},selected:{value:0}}}));
    const body=new T.Mesh(sphere,material);body.scale.setScalar(radius);body.rotation.z=(index%3-.8)*.2;body.userData.route=entry.route;group.add(body);meshes.push(body);
    const atmo=new T.Mesh(sphere,register(new T.ShaderMaterial({vertexShader:vertex,fragmentShader:atmosphereFragment,uniforms:{tint:{value:new T.Color(entry.color)}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.FrontSide})));
    atmo.scale.setScalar(radius*1.07);group.add(atmo);
    if(index%3===1){
      const ring=new T.Mesh(register(new T.RingGeometry(radius*1.36,radius*2.08,80,1)),register(new T.ShaderMaterial({side:T.DoubleSide,transparent:true,depthWrite:false,uniforms:{tint:{value:new T.Color(entry.color)},inner:{value:radius*1.36},outer:{value:radius*2.08}},vertexShader:'varying vec3 pos;void main(){pos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 tint;uniform float inner;uniform float outer;varying vec3 pos;void main(){float r=(length(pos.xy)-inner)/(outer-inner);float bands=.3+.7*pow(abs(sin(r*95.)),.7);float gap=1.-smoothstep(.012,.025,abs(r-.63));gl_FragColor=vec4(tint*.65,bands*.55*(1.-gap));}'})));
      ring.rotation.x=-Math.PI/2+.2;ring.rotation.y=.25;group.add(ring);
    }
    return {entry,group,body,atmo,material,radius,index,angle:index*2.39996,orbit:10.5+Math.floor(index/4)*6.2+(index%2)*1.6,speed:.012/(1+index*.16)};
  }
  function clearWorld() {
    world.clear();worldAssets.forEach(asset=>asset.dispose());worldAssets.clear();nodes=[];meshes=[];
  }
  function setWorld(entries, system) {
    clearWorld(); elapsed=0; selected=''; aim.set(0,0,0); lookAt.set(0,0,0);
    const sunMaterial=register(system ? new T.ShaderMaterial({vertexShader:vertex,fragmentShader:surface,uniforms:{tint:{value:new T.Color(system.color)},kind:{value:0},time:{value:0},seed:{value:3},selected:{value:1}}}) : new T.ShaderMaterial({vertexShader:vertex,fragmentShader:sunFragment,uniforms:{time:{value:0}}}));
    sun=new T.Mesh(sphere,sunMaterial);sun.scale.setScalar(system?3.1:3.7);world.add(sun);
    corona=new T.Sprite(register(new T.SpriteMaterial({map:glow,color:system?.color||'#ffa431',transparent:true,opacity:.8,depthWrite:false,blending:T.AdditiveBlending})));
    // Planet systems have a quieter central halo than the solar overview.
    corona.material.opacity=system?.id ? .25 : .85;
    corona.scale.set(24,24,1);world.add(corona);
    entries.forEach((entry,index)=>nodes.push(makePlanet(entry,index,1.1+(index%4)*.23)));
    const orbits=[...new Set(nodes.map(node=>node.orbit))];
    orbits.forEach(radius=>{
      const points=Array.from({length:160},(_,i)=>{const angle=i/160*Math.PI*2;return new T.Vector3(Math.cos(angle)*radius,0,Math.sin(angle)*radius);});
      const line=new T.LineLoop(register(new T.BufferGeometry().setFromPoints(points)),register(new T.LineBasicMaterial({color:system?.color||'#8886c5',transparent:true,opacity:.14})));world.add(line);
    });
    // Orbit dust is one draw call, not a canvas per object.
    const dust=[];for(let i=0;i<500;i++){const a=random()*Math.PI*2,r=6+random()*1.5;dust.push(Math.cos(a)*r,(random()-.5)*.9,Math.sin(a)*r);}
    const dg=register(new T.BufferGeometry());dg.setAttribute('position',new T.Float32BufferAttribute(dust,3));
    const belt=new T.Points(dg,register(new T.PointsMaterial({color:system?.color||'#f5b177',size:.06,transparent:true,opacity:.45,depthWrite:false})));belt.name='dust';world.add(belt);
    applyQuality();invalidate();
  }
  function resize() {
    if(destroyed||lost)return;
    const box=host.getBoundingClientRect();if(!box.width||!box.height)return;
    renderer.setPixelRatio(Math.min(win.devicePixelRatio||1,settings().dpr));
    renderer.setSize(box.width,box.height,false);camera.aspect=box.width/box.height;camera.updateProjectionMatrix();invalidate();
  }
  function applyQuality(){
    starfield.geometry.setDrawRange(0,settings().stars);
    nebulae.forEach((sprite,index)=>sprite.visible=quality!=='economy'||index<3);
    nodes.forEach(node=>node.atmo.visible=quality!=='economy');
    const dust=world.getObjectByName('dust');if(dust)dust.visible=quality!=='economy';resize();
  }
  function setCamera(next, animate=false){
    cameraState={yaw:clamp(Number(next.yaw)||0,-Math.PI,Math.PI),pitch:clamp(Number(next.pitch)||.78,.24,1.35),distance:clamp(Number(next.distance)||60,25,95)};
    if(!animate)lookAt.copy(aim);invalidate();
  }
  function updateCamera(delta){
    lookAt.lerp(aim,motion?1-Math.exp(-delta*6):1);
    const {yaw,pitch,distance}=cameraState;
    // Account for narrow content areas without cropping the complete overview.
    const distanceFit=distance*(camera.aspect<1.2 ? Math.min(1.65,1.2/camera.aspect):1);
    camera.position.set(Math.sin(yaw)*Math.cos(pitch)*distanceFit,Math.sin(pitch)*distanceFit,Math.cos(yaw)*Math.cos(pitch)*distanceFit).add(lookAt);
    camera.lookAt(lookAt);
  }
  function select(route, animate=true){
    selected=route;
    const node=nodes.find(node=>node.entry.route===route);
    nodes.forEach(entry=>entry.material.uniforms.selected.value=entry===node?1:0);
    aim.copy(node ? node.group.position.clone().multiplyScalar(.25) : new T.Vector3());
    if(!animate||!motion)lookAt.copy(aim);
    invalidate();
  }
  function tick(now){
    frameId=0;if(destroyed||!active||lost)return;
    const raw=last?now-last:16.67,delta=Math.min(raw/1000,.05);last=now;
    if(motion){elapsed+=delta;dirty=true;}
    if(dirty || lookAt.distanceToSquared(aim)>.00001){
      nodes.forEach(node=>{
        if(motion&&node.entry.route!==hovered&&node.entry.route!==selected)node.angle+=delta*node.speed;
        node.group.position.set(Math.cos(node.angle)*node.orbit,Math.sin(node.index*1.7)*1.1,Math.sin(node.angle)*node.orbit);
        if(motion)node.body.rotation.y+=delta*(.05+node.index*.007);
        node.material.uniforms.time.value=elapsed;
      });
      if(sun){sun.material.uniforms.time.value=elapsed;sun.rotation.y=elapsed*.022;}
      if(corona)corona.material.rotation=elapsed*.025;
      nebulae.forEach((sprite,index)=>sprite.material.rotation=Math.sin(elapsed*.008+index)*.12);
      const streak=elapsed%29;meteor.visible=motion&&quality==='cinematic'&&streak>25&&streak<26.5;
      if(meteor.visible){meteor.position.set(30-(streak-25)*25,20-(streak-25)*5,-25);meteor.material.opacity=Math.sin((streak-25)/1.5*Math.PI)*.55;}
      updateCamera(delta);renderer.render(scene,camera);frameTotal++;dirty=false;
      canvas.dataset.frames=String(frameTotal);
      canvas.dataset.drawCalls=String(renderer.info.render.calls);
      canvas.dataset.geometries=String(renderer.info.memory.geometries);
    }
    if(motion && raw <= 120){
      // Long gaps normally mean background throttling, a debugger pause or a
      // sleeping display. They are not evidence that the device is weak.
      frames++;sampleMs+=raw;
      if(sampleMs>=2500){
        const fps=frames*1000/sampleMs;canvas.dataset.fps=fps.toFixed(1);
        slowSamples=fps<25 ? slowSamples+1:0;
        if(slowSamples>=2 && quality!=='economy'){autoEconomy=true;quality='economy';applyQuality();options.onStatus?.('Tự giảm xuống Tiết kiệm do khung hình chậm.');}
        frames=0;sampleMs=0;
      }
    } else if(raw > 120) {
      frames=0;sampleMs=0;slowSamples=0;
    }
    canvas.dataset.quality=quality;
    if(motion||lookAt.distanceToSquared(aim)>.00001)frameId=win.requestAnimationFrame(tick);
  }
  function invalidate(){dirty=true;if(active&&!frameId&&!destroyed&&!lost)frameId=win.requestAnimationFrame(tick);}
  function setOptions(next){
    active=!!next.active;motion=!!next.motion;interactive=!!next.interactive;
    if(next.quality!==quality&&!autoEconomy){quality=next.quality;applyQuality();}
    canvas.style.touchAction=interactive?'none':'pan-y pinch-zoom';
    canvas.dataset.running=String(active&&motion);
    if(!interactive)cancelGesture();
    if(!active){if(frameId)win.cancelAnimationFrame(frameId);frameId=0;last=0;}else invalidate();
  }
  function zoom(amount){cameraState.distance=clamp(cameraState.distance+amount,25,95);invalidate();options.onCamera?.();}
  function key(value){
    if(value==='Home'){aim.set(0,0,0);setCamera({yaw:.22,pitch:.78,distance:60});}
    else if(['+','=','-'].includes(value))zoom(value==='-'?4:-4);
    else {aim.copy(lookAt);cameraState.yaw=clamp(cameraState.yaw+(value==='ArrowLeft'?-.08:value==='ArrowRight'?.08:0),-Math.PI,Math.PI);cameraState.pitch=clamp(cameraState.pitch+(value==='ArrowUp'?.06:value==='ArrowDown'?-.06:0),.24,1.35);invalidate();}
    options.onCamera?.();
  }
  function hit(event){const box=canvas.getBoundingClientRect();pointer.set((event.clientX-box.left)/box.width*2-1,-(event.clientY-box.top)/box.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(meshes,false)[0]?.object.userData.route||'';}
  function cancelGesture(){for(const id of pointers.keys()){try{canvas.releasePointerCapture(id);}catch{}}pointers.clear();gesture=null;pinchDistance=0;}
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    if(interactive) canvas.parentElement?.focus({preventScroll:true});
    if(interactive)canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===1)gesture={x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,moved:false};
    else if(gesture){gesture.moved=true;pinchDistance=0;}
    aim.copy(lookAt);
  },{signal});
  canvas.addEventListener('pointermove',event=>{
    hovered=hit(event);canvas.style.cursor=interactive?'grab':hovered?'pointer':'default';
    if(!interactive||!pointers.has(event.pointerId)||!gesture)return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===2){
      const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);
      if(pinchDistance)zoom((pinchDistance-distance)*.1);pinchDistance=distance;gesture.moved=true;
    }else if(pointers.size===1){
      if(Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>6)gesture.moved=true;
      if(gesture.moved){cameraState.yaw=clamp(cameraState.yaw-(event.clientX-gesture.lastX)*.005,-Math.PI,Math.PI);cameraState.pitch=clamp(cameraState.pitch+(event.clientY-gesture.lastY)*.004,.24,1.35);invalidate();}
      gesture.lastX=event.clientX;gesture.lastY=event.clientY;
    }
  },{signal});
  canvas.addEventListener('pointerup',event=>{
    const moved=gesture?.moved||Math.hypot(event.clientX-(gesture?.x||0),event.clientY-(gesture?.y||0))>6;
    if(!moved){const route=hit(event);if(route)options.onSelect?.(route);}
    cancelGesture();options.onCamera?.();
  },{signal});
  canvas.addEventListener('pointercancel',cancelGesture,{signal});
  canvas.addEventListener('pointerleave',()=>{hovered='';if(!interactive)cancelGesture();},{signal});
  canvas.addEventListener('wheel',event=>{if(!interactive)return;event.preventDefault();aim.copy(lookAt);zoom(clamp(event.deltaY,-100,100)*.04);},{signal,passive:false});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;if(frameId)win.cancelAnimationFrame(frameId);frameId=0;canvas.dataset.running='false';options.onError?.();},{signal});
  // Recreate explicitly via Retry after a context loss; never leave two contexts alive.
  canvas.addEventListener('webglcontextrestored',()=>options.onError?.(),{signal});
  const observer=new win.ResizeObserver(resize);observer.observe(host);
  options.onStatus?.('Cảnh 3D sẵn sàng · chọn hành tinh hoặc điểm đến bên dưới.');
  return {
    setWorld,setCamera,select,setOptions,zoom,key,getCamera:()=>({...cameraState}),
    destroy(){
      if(destroyed)return;destroyed=true;controller.abort();cancelGesture();observer.disconnect();if(frameId)win.cancelAnimationFrame(frameId);frameId=0;
      clearWorld();sharedAssets.forEach(asset=>asset.dispose());sharedAssets.clear();scene.clear();renderer.dispose();renderer.forceContextLoss();canvas.remove();
    }
  };
}
