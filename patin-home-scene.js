/* Original HH miniature skate scene. Native WebGL; no external models, textures or simulation claims. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.HHPatinHomeScene=api;})(typeof globalThis!=='undefined'?globalThis:this,function(scope){
 'use strict';
 const instances=new WeakMap();
 const VERTEX=`precision mediump float;attribute vec3 aPosition;attribute vec3 aNormal;attribute vec4 aColor;attribute vec4 aPivot;uniform mat4 uVP;uniform float uTime;varying vec3 vPosition;varying vec3 vNormal;varying vec4 vColor;
 void main(){vec3 p=aPosition,n=aNormal;if(aPivot.w>0.5){float a=uTime*.24,c=cos(a),s=sin(a);mat3 r=mat3(c,s,0.,-s,c,0.,0.,0.,1.);p=aPivot.xyz+r*(p-aPivot.xyz);n=r*n;}vPosition=p;vNormal=n;vColor=aColor;gl_Position=uVP*vec4(p,1.);}`;
 const FRAGMENT=`precision mediump float;varying vec3 vPosition;varying vec3 vNormal;varying vec4 vColor;uniform vec3 uEye;uniform float uTime;
 void main(){vec3 n=normalize(vNormal),eye=normalize(uEye-vPosition);vec3 key=normalize(vec3(-.4,.9,1.2)),fill=normalize(vec3(.8,.35,-.8));float diffuse=max(dot(n,key),0.),side=max(dot(n,fill),0.),rim=pow(1.-max(dot(n,eye),0.),2.);float spec=pow(max(dot(reflect(-key,n),eye),0.),32.)*.32;vec3 color=vColor.rgb*(.29+diffuse*.7)+vec3(.38,.24,.64)*side*.2+vec3(.18,.48,.51)*rim*.18+spec;float pulse=.82+.18*sin(uTime*.35+vPosition.x*.8);color+=vColor.rgb*vColor.a*pulse;gl_FragColor=vec4(color,1.);}`;
 const norm=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
 function multiply(a,b){const m=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)m[c*4+r]+=a[k*4+r]*b[c*4+k];return m;}
 function camera(aspect,yaw=-.65,pitch=.43,distance=6.5){
  aspect=Math.max(.2,Number(aspect)||1);pitch=Math.max(.22,Math.min(.72,pitch));distance=Math.max(5.1,Math.min(9,distance));
  const target=[0,.65,0],eye=[Math.sin(yaw)*distance,Math.sin(pitch)*distance+.6,Math.cos(yaw)*distance],z=norm(eye.map((v,i)=>v-target[i])),x=norm(cross([0,1,0],z)),y=cross(z,x),view=new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);
  const f=1/Math.tan(.65/2),near=.1,far=30,proj=new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);return {vp:multiply(proj,view),eye};
 }
 function quality({memory=0,cores=0,saveData=false,reduced=false,forced=false,mode='auto'}={}){const staticMode=saveData||reduced||forced||mode==='static',weak=(memory>0&&memory<=4)||(cores>0&&cores<=4);return {static:staticMode,tier:staticMode?'static':weak||mode==='economy'?'economy':'balanced',segments:weak||mode==='economy'?16:24,dpr:weak||mode==='economy'?1:1.5,fps:weak||mode==='economy'?24:30};}
 function geometry(segments=24){
  const data=[],n=Math.max(12,Math.min(32,Math.floor(segments)||24)),colors={cyan:[.25,.8,.79,.07],purple:[.51,.37,.77,.04],metal:[.32,.42,.52,0],rubber:[.065,.09,.14,0],gold:[.98,.63,.3,.04],floor:[.06,.11,.19,0],light:[.2,.85,.85,.7]};
  const vertex=(p,normal,color,pivot=[0,0,0,0])=>data.push(...p,...normal,...color,...pivot);
  function tri(a,b,c,col,pivot,normal){const nm=normal||norm(cross(b.map((v,i)=>v-a[i]),c.map((v,i)=>v-a[i])));for(const p of [a,b,c])vertex(p,nm,col,pivot);}
  const quad=(a,b,c,d,col,pivot,normal)=>{tri(a,b,c,col,pivot,normal);tri(a,c,d,col,pivot,normal);};
  function ellipsoid(center,radii,color){for(let j=0;j<8;j++)for(let i=0;i<n;i++){const point=(u,v)=>[center[0]+radii[0]*Math.sin(v)*Math.cos(u),center[1]+radii[1]*Math.cos(v),center[2]+radii[2]*Math.sin(v)*Math.sin(u)],a=point(i*2*Math.PI/n,j*Math.PI/8),b=point((i+1)*2*Math.PI/n,j*Math.PI/8),c=point((i+1)*2*Math.PI/n,(j+1)*Math.PI/8),dd=point(i*2*Math.PI/n,(j+1)*Math.PI/8);quad(a,b,c,dd,color);}}
  function box(center,size,color){const p=(x,y,z)=>center.map((v,i)=>v+[x,y,z][i]*size[i]/2);for(const [a,b,c,dd]of [[[1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1]],[[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,-1,-1]],[[-1,1,-1],[-1,1,1],[1,1,1],[1,1,-1]],[[-1,-1,1],[-1,-1,-1],[1,-1,-1],[1,-1,1]],[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]])quad(p(...a),p(...b),p(...c),p(...dd),color);}
  function cylinder(center,r0,r1,length,color,axis='y',spin=false){const pt=(a,r,z)=>{const p=axis==='z'?[r*Math.cos(a),r*Math.sin(a),z]:[r*Math.cos(a),z,r*Math.sin(a)];return p.map((v,i)=>v+center[i]);},pivot=spin?[...center,1]:undefined;
   for(let i=0;i<n;i++){const a=i*2*Math.PI/n,b=(i+1)*2*Math.PI/n,lo=-length/2,hi=length/2;quad(pt(a,r0,lo),pt(b,r0,lo),pt(b,r1,hi),pt(a,r1,hi),color,pivot);tri(pt(0,0,lo),pt(b,r0,lo),pt(a,r0,lo),color,pivot);tri(pt(0,0,hi),pt(a,r1,hi),pt(b,r1,hi),color,pivot);}}
  function ring(rx,rz,y,width,color){for(let i=0;i<n*2;i++){const a=i*Math.PI/n,b=(i+1)*Math.PI/n,p=(r,t)=>[Math.cos(t)*(rx+r),y,Math.sin(t)*(rz+r)];quad(p(-width/2,a),p(-width/2,b),p(width/2,b),p(width/2,a),color,undefined,[0,1,0]);}}
  function profile(points,depth,color){const side=points.map(([x,y])=>[(x+.1)*.94-.1,(y-1.25)*.94+1.25,depth/2]),back=side.map(([x,y])=>[x,y,-depth/2]),outer=points.map(([x,y])=>[x,y,depth*.36]),rear=points.map(([x,y])=>[x,y,-depth*.36]);
   // Ear clipping handles the concave boot silhouette without a heavy mesh library.
   let order=points.map((_,i)=>i),area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=a[0]*b[1]-b[0]*a[1];}if(area<0)order.reverse();
   const turn=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
   const inside=(p,a,b,c)=>turn(a,b,p)>=-1e-6&&turn(b,c,p)>=-1e-6&&turn(c,a,p)>=-1e-6;
   let guard=0;while(order.length>2&&guard++<points.length*points.length){let clipped=false;for(let k=0;k<order.length;k++){const ia=order[(k+order.length-1)%order.length],ib=order[k],ic=order[(k+1)%order.length];if(turn(points[ia],points[ib],points[ic])<=1e-6||order.some(j=>j!==ia&&j!==ib&&j!==ic&&inside(points[j],points[ia],points[ib],points[ic])))continue;tri(side[ia],side[ib],side[ic],color,undefined,[0,0,1]);tri(back[ic],back[ib],back[ia],colors.purple,undefined,[0,0,-1]);order.splice(k,1);clipped=true;break;}if(!clipped)break;}
   for(let i=0;i<points.length;i++){const j=(i+1)%points.length;quad(outer[i],outer[j],rear[j],rear[i],color);quad(side[i],side[j],outer[j],outer[i],color);quad(rear[i],rear[j],back[j],back[i],colors.purple);}
  }
  // Compact presentation stage, contact shadow approximation and neon lanes.
  ellipsoid([0,-.11,0],[2.85,.14,1.55],colors.floor);ellipsoid([0,.003,0],[1.3,.008,.56],[.025,.045,.065,0]);
  ring(2.45,1.18,.013,.045,colors.light);ring(2.58,1.29,.006,.025,[.68,.31,.74,.5]);
  for(let i=-4;i<=4;i++)box([i*.45,.012,-1.02],[.22,.009,.018],[.22,.48,.62,.2]);
  profile([[-1,.62],[-1.05,1.4],[-.99,1.9],[-.88,2.03],[-.52,2.03],[-.42,1.4],[-.28,1.15],[.12,1.02],[.8,.92],[1.06,.78],[1.1,.64]],.64,colors.cyan);
  ellipsoid([.3,.67,0],[.83,.14,.37],colors.rubber);box([-.05,.46,0],[2.07,.15,.25],colors.metal);
  for(const z of [-.26,.26])box([-.05,.49,z],[2.0,.065,.055],colors.purple);
  cylinder([-.74,1.98,0],.36,.36,.10,colors.purple);ellipsoid([-.74,2.039,0],[.27,.006,.25],colors.rubber);
  for(const y of [1.78,1.47])box([-.74,y,.339],[.56,.075,.055],colors.rubber);
  for(const [x,y]of [[-.28,1.18],[0,1.1],[.28,1.03],[.52,.98]])box([x,y,.34],[.065,.045,.09],colors.gold);
  for(const x of [-.82,-.28,.26,.80]){
   const center=[x,.25,0];cylinder(center,.238,.238,.17,colors.rubber,'z',true);
   for(const z of [-.1,.1]){cylinder([x,.25,z],.183,.183,.025,colors.purple,'z',true);cylinder([x,.25,z+Math.sign(z)*.02],.055,.055,.03,colors.gold,'z',true);
    for(let j=0;j<4;j++){const a=j*Math.PI/2,co=Math.cos(a),si=Math.sin(a),q=(r,t)=>[x+r*Math.cos(t),.25+r*Math.sin(t),z+Math.sign(z)*.016];quad(q(.065,a-.08),q(.165,a-.04),q(.165,a+.04),q(.065,a+.08),colors.cyan,[x,.25,z,1],[0,0,Math.sign(z)]);}
   }
  }
  for(const [x,z]of [[-1.7,-.65],[1.35,-.78],[1.98,.34]]){cylinder([x,.045,z],.21,.21,.07,colors.purple);cylinder([x,.23,z],.15,.023,.35,colors.gold);}
  return new Float32Array(data);
 }
 function mount(host,{motion=true,onStatus=()=>{}}={}){
  instances.get(host)?.destroy();
  let alive=true,gl=null,program=null,buffer=null,canvas=null,raf=0,frame=0,elapsed=0,last=0,clock=null,inView=false,pointer=[0,0],yaw=-.65,pitch=.43,distance=6.5,mode='auto',policy,contextLost=false,slow=0;
  const listeners=[],canvasCleanups=[],observers=[],reduced=scope.matchMedia?.('(prefers-reduced-motion: reduce)'),forced=scope.matchMedia?.('(forced-colors: active)'),doc=host.ownerDocument;
  const listen=(t,n,f)=>{t.addEventListener(n,f);listeners.push(()=>t.removeEventListener(n,f));};
  function status(state,text){if(state==='webgl'||state==='static')delete host.dataset.pthFailure;host.dataset.pthSceneState=state;onStatus(text);}
  function stop(){if(raf){scope.cancelAnimationFrame(raf);raf=0;}clock=null;last=0;}
  function release(){stop();canvasCleanups.splice(0).forEach(f=>f());if(gl){if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);if(!gl.isContextLost())gl.getExtension('WEBGL_lose_context')?.loseContext();}buffer=program=null;if(canvas){canvas.remove();canvas=null;}gl=null;}
  function resetPolicy(){policy=quality({memory:scope.navigator?.deviceMemory||0,cores:scope.navigator?.hardwareConcurrency||0,saveData:scope.navigator?.connection?.saveData,reduced:reduced?.matches,forced:forced?.matches,mode});}
  function eligible(){return alive&&host.isConnected&&inView&&!doc.hidden&&!policy.static&&!contextLost;}
  function makeShader(type,code){const s=gl.createShader(type);try{gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)||'Shader unavailable');return s;}catch(err){gl.deleteShader(s);throw err;}}
  function init(){
   if(gl||!eligible())return !!gl;
   canvas=doc.createElement('canvas');canvas.setAttribute('aria-hidden','true');canvas.dataset.pthCanvas='';host.appendChild(canvas);
   let shaders=[];try{
    gl=canvas.getContext('webgl',{alpha:true,antialias:policy.tier==='balanced',depth:true,powerPreference:'low-power',preserveDrawingBuffer:false});
    if(!gl)throw Error('WebGL unavailable');
    shaders.push(makeShader(gl.VERTEX_SHADER,VERTEX));shaders.push(makeShader(gl.FRAGMENT_SHADER,FRAGMENT));program=gl.createProgram();shaders.forEach(s=>gl.attachShader(program,s));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)||'Program unavailable');
    for(const s of shaders)gl.deleteShader(s);shaders=[];gl.useProgram(program);
    const data=geometry(policy.segments);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);host.dataset.pthVertices=String(data.length/14);
    let offset=0;for(const [name,size]of [['aPosition',3],['aNormal',3],['aColor',4],['aPivot',4]]){const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,56,offset*4);offset+=size;}
    program.locations={vp:gl.getUniformLocation(program,'uVP'),time:gl.getUniformLocation(program,'uTime'),eye:gl.getUniformLocation(program,'uEye')};program.count=data.length/14;
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearColor(0,0,0,0);
    const loss=ev=>{ev.preventDefault();contextLost=true;release();status('fallback','Mất kết nối đồ họa · dùng sơ đồ SVG. Có thể thử lại.');};canvas.addEventListener('webglcontextlost',loss);const mountedCanvas=canvas;canvasCleanups.push(()=>mountedCanvas.removeEventListener('webglcontextlost',loss));
    status('webgl','Mô hình WebGL 3D cách điệu · không mô phỏng kỹ thuật');return true;
   }catch(err){if(gl)for(const s of shaders)gl.deleteShader(s);release();host.dataset.pthFailure=String(err.message).slice(0,500);status('fallback','Không mở được WebGL · sơ đồ SVG vẫn dùng được.');return false;}
  }
  function draw(){
   if(!eligible()||!init())return;
   const box=host.getBoundingClientRect(),dpr=Math.min(scope.devicePixelRatio||1,policy.dpr),w=Math.min(1024,Math.max(1,Math.round(box.width*dpr))),h=Math.min(640,Math.max(1,Math.round(box.height*dpr)));
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);
   const bob=motion?Math.sin(elapsed*.045)*.045:0,view=camera(w/h,yaw+pointer[0]+bob,pitch+pointer[1],w/h<1?distance+1:distance);
   gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniformMatrix4fv(program.locations.vp,false,view.vp);gl.uniform3fv(program.locations.eye,view.eye);gl.uniform1f(program.locations.time,elapsed);gl.drawArrays(gl.TRIANGLES,0,program.count);frame++;host.dataset.pthFrames=String(frame);
  }
  function tick(now){raf=0;if(!eligible()||!motion)return;if(clock===null)clock=now;const delta=Math.min(.05,(now-clock)/1000);clock=now;elapsed+=delta;if(now-last>=1000/policy.fps){const before=scope.performance.now();draw();last=now;if(policy.tier==='balanced'&&scope.performance.now()-before>18&&++slow>=8){mode='economy';resetPolicy();host.dataset.pthTier=policy.tier;}}if(gl&&eligible()&&motion)raf=scope.requestAnimationFrame(tick);}
  function sync(){stop();resetPolicy();host.dataset.pthTier=policy.tier;if(policy.static){release();status('static','Minh họa SVG · chế độ giảm hiệu ứng / tiết kiệm');return;}if(!eligible())return;draw();if(gl&&motion)raf=scope.requestAnimationFrame(tick);}
  listen(doc,'visibilitychange',sync);
  listen(host,'pointermove',ev=>{if(!motion||!eligible()||policy.tier==='economy')return;const b=host.getBoundingClientRect();pointer=[((ev.clientX-b.left)/b.width-.5)*.12,((ev.clientY-b.top)/b.height-.5)*.055];});
  listen(host,'pointerleave',()=>{pointer=[0,0];});
  for(const media of [reduced,forced])if(media?.addEventListener)listen(media,'change',sync);
  if(scope.ResizeObserver){const o=new scope.ResizeObserver(()=>{if(eligible()&&!motion)draw();});o.observe(host);observers.push(o);}
  if(scope.IntersectionObserver){const o=new scope.IntersectionObserver(entries=>{inView=entries[0]?.isIntersecting||false;sync();},{threshold:.05});o.observe(host);observers.push(o);}else inView=true;
  resetPolicy();
  const api={setMotion:value=>{motion=!!value;sync();},setView:action=>{if(action==='left')yaw-=.25;if(action==='right')yaw+=.25;if(action==='up')pitch=Math.min(.72,pitch+.08);if(action==='down')pitch=Math.max(.22,pitch-.08);if(action==='closer')distance=Math.max(5.1,distance-.5);if(action==='farther')distance=Math.min(9,distance+.5);if(action==='reset'){yaw=-.65;pitch=.43;distance=6.5;pointer=[0,0];}if(eligible())draw();},setQuality:value=>{mode=['auto','economy','static'].includes(value)?value:'auto';release();sync();},retry:()=>{contextLost=false;release();sync();},snapshot:()=>({frames:frame,raf:!!raf,inView,alive,webgl:!!gl,tier:policy.tier,mode,motion,yaw,pitch,distance}),destroy:()=>{if(!alive)return;alive=false;release();observers.forEach(o=>o.disconnect());listeners.splice(0).forEach(f=>f());instances.delete(host);delete host.dataset.pthFrames;delete host.dataset.pthVertices;delete host.dataset.pthTier;delete host.dataset.pthSceneState;delete host.dataset.pthFailure;}};
  instances.set(host,api);sync();return api;
 }
 return Object.freeze({version:1,quality,geometry,camera,multiply,mount});
});
