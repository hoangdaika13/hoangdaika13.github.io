// Original procedural artwork shared by the map and every Galaxy workspace.
// No network textures. All lighting vectors are in world space.
import * as T from './vendor/three.module.min.js';

export const WORLD_PROFILES = Object.freeze({
  ai: { kind: 4, color: '#9d8aff', accent: '#65e1ee', motif: 'neural', tilt: .22, spin: .055 },
  music: { kind: 1, color: '#ad92df', accent: '#7ae6ce', motif: 'resonance', tilt: -.28, spin: .085 },
  video: { kind: 3, color: '#d59270', accent: '#ffb385', motif: 'frames', tilt: .12, spin: .045 },
  creator: { kind: 1, color: '#df92bd', accent: '#bfadff', motif: 'ribbons', tilt: -.4, spin: .07 },
  games: { kind: 0, color: '#628f78', accent: '#a6e5a0', motif: 'archipelago', tilt: .28, spin: .06 },
  dev: { kind: 4, color: '#568eaf', accent: '#82dbe7', motif: 'lattice', tilt: -.14, spin: .045 },
  learning: { kind: 0, color: '#92a582', accent: '#efd89e', motif: 'observatory', tilt: .31, spin: .04 },
  community: { kind: 0, color: '#ae93a6', accent: '#f2bddc', motif: 'constellation', tilt: -.24, spin: .065 },
  tools: { kind: 2, color: '#7ca6b1', accent: '#a8edff', motif: 'gyroscope', tilt: .38, spin: .052 },
  analytics: { kind: 2, color: '#8399c2', accent: '#a1dce8', motif: 'arcs', tilt: -.19, spin: .042 },
  settings: { kind: 3, color: '#a29eae', accent: '#c8bbeb', motif: 'station', tilt: .1, spin: .03 }
});

export function profileFor(route, index = 0) {
  const id = String(route).split('/').filter(Boolean).pop();
  return WORLD_PROFILES[id] || Object.values(WORLD_PROFILES)[Math.abs(index) % 11];
}
export const vertex = `varying vec3 vNormal; varying vec3 vPosition; varying vec3 vLocal; varying float vScale;
void main(){vec4 world=modelMatrix*vec4(position,1.);vPosition=world.xyz;vLocal=position;
vScale=length(modelMatrix[0].xyz);vNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*world;}`;
export const noise = `float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){return noise(p)*.55+noise(p*2.03+4.7)*.28+noise(p*4.11+8.1)*.17;}`;

export const surface = `${noise}
uniform vec3 tint; uniform vec3 accent; uniform vec3 lightPosition;
uniform float kind; uniform float seed; uniform float time; uniform float selected;
varying vec3 vNormal; varying vec3 vPosition; varying vec3 vLocal; varying float vScale;
void main(){
 vec3 p=normalize(vLocal);float macro=fbm(p*3.9+seed),detail=fbm(p*23.+seed*1.7);
 vec3 col;float height=detail*.05,specular=.1,shininess=32.;
 if(kind<.5){
  float shore=smoothstep(.49,.535,macro+detail*.06),highland=smoothstep(.59,.75,macro);
  vec3 land=mix(tint*.55,vec3(.42,.38,.24),highland);
  col=mix(mix(vec3(.008,.038,.095),vec3(.035,.20,.27),smoothstep(.38,.54,macro)),land,shore);
  col=mix(col,vec3(.77,.86,.89),smoothstep(.84,.98,abs(p.y)+macro*.07));
  height=shore*(macro*.025+detail*.007);specular=mix(.9,.07,shore);shininess=96.;
 }else if(kind<1.5){
  float latitude=p.y*38.+fbm(p*6.+vec3(seed,time*.004,0.))*8.;
  vec2 vortex=vec2(p.x-.42,p.y+.21);float storm=exp(-dot(vortex,vortex)*65.)*step(.0,p.z);
  float bands=.5+.5*sin(latitude+storm*sin(atan(vortex.y,vortex.x)*3.+length(vortex)*65.)*3.);
  col=mix(tint*.36,mix(tint,vec3(.83,.73,.56),.44),smoothstep(.1,.9,bands));
  col=mix(col,tint*.22+vec3(.25,.13,.09),storm*.65);col*=.83+detail*.34;height=detail*.007;specular=.18;
 }else if(kind<2.5){
  float cracks=1.-smoothstep(.0,.055,abs(sin(macro*42.+p.y*6.+detail*2.)));
  col=mix(tint*.35,vec3(.75,.84,.87),macro);col=mix(col,accent*.26,cracks*.75);
  height=detail*.025-cracks*.022;specular=.48;shininess=72.;
 }else if(kind<3.5){
  float ridge=1.-abs(fbm(p*8.+seed)*2.-1.);
  float crater=1.-smoothstep(.02,.16,abs(noise(p*15.+seed)-.5));
  col=mix(tint*.16,tint*.9,macro);col*=.65+detail*.5+ridge*.15;
  height=detail*.016+ridge*.012-crater*.002;specular=.055;
 }else{
  vec2 grid=abs(fract(vec2(atan(p.z,p.x)*5.,asin(p.y)*12.))-.5);
  float edge=min(grid.x,grid.y),aa=max(fwidth(edge),.015);
  float seam=1.-smoothstep(.008,.008+aa,edge);
  col=mix(tint*.1,tint*.46,detail);col+=accent*seam*.36;
  height=detail*.001+seam*.0002;specular=.45;shininess=80.;
 }
 height*=vScale;
 vec3 normal=normalize(vNormal),viewDir=normalize(cameraPosition-vPosition),light=normalize(lightPosition-vPosition);
 // Screen derivatives perturb the normal without three extra fbm evaluations per pixel.
 vec3 qx=dFdx(vPosition),qy=dFdy(vPosition),sx=cross(qy,normal),sy=cross(normal,qx);
 float determinant=dot(qx,sx);vec3 gradient=sign(determinant)*(dFdx(height)*sx+dFdy(height)*sy);
 normal=normalize(abs(determinant)*normal-gradient*.24);
 float day=dot(normal,light),diffuse=max(day,0.);
 float fresnel=pow(1.-max(dot(normal,viewDir),0.),4.);
 float spec=pow(max(dot(reflect(-light,normal),viewDir),0.),shininess)*specular*smoothstep(0.,.2,day);
 col*=.07+diffuse*1.32;col+=vec3(1.,.91,.77)*spec*.7+accent*fresnel*(.055+selected*.2);
 if(kind>3.5)col+=accent*smoothstep(.69,.76,detail)*(1.-smoothstep(-.1,.3,day))*.24;
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

export const atmosphereFragment = `uniform vec3 tint;uniform vec3 lightPosition;uniform float time;
varying vec3 vNormal;varying vec3 vPosition;
void main(){vec3 n=normalize(vNormal),v=normalize(cameraPosition-vPosition);float rim=pow(1.-max(dot(n,v),0.),4.5);
float day=dot(n,normalize(lightPosition-vPosition));vec3 color=mix(vec3(1.,.38,.13),tint,smoothstep(-.15,.5,day));
gl_FragColor=vec4(color,rim*(.13+.5*smoothstep(-.3,.8,day)));}`;

const cloudsFragment = `${noise} uniform float seed;uniform vec3 lightPosition;varying vec3 vLocal;varying vec3 vNormal;varying vec3 vPosition;
void main(){vec3 p=normalize(vLocal);float cloud=smoothstep(.51,.7,fbm(p*7.+seed)+noise(p*27.)*.08);
float day=max(dot(normalize(vNormal),normalize(lightPosition-vPosition)),0.);gl_FragColor=vec4(vec3(.83,.89,.94)*(.12+day*.92),cloud*.68);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;

export function surfaceMaterial(profile, seed, lightPosition = new T.Vector3(), selected = 0) {
 return new T.ShaderMaterial({vertexShader:vertex,fragmentShader:surface,uniforms:{tint:{value:new T.Color(profile.color)},accent:{value:new T.Color(profile.accent)},kind:{value:profile.kind},seed:{value:seed},time:{value:0},selected:{value:selected},lightPosition:{value:lightPosition}}});
}
export function atmosphereMaterial(color, lightPosition = new T.Vector3()) {
 return new T.ShaderMaterial({vertexShader:vertex,fragmentShader:atmosphereFragment,uniforms:{tint:{value:new T.Color(color)},time:{value:0},lightPosition:{value:lightPosition}},transparent:true,depthWrite:false,blending:T.AdditiveBlending});
}
export function cloudMaterial(seed, lightPosition = new T.Vector3()) {
 return new T.ShaderMaterial({vertexShader:vertex,fragmentShader:cloudsFragment,uniforms:{seed:{value:seed},lightPosition:{value:lightPosition}},transparent:true,depthWrite:false});
}
export function ringMaterial(color, inner, outer, lightPosition = new T.Vector3(), center = new T.Vector3(), radius = 1) {
 return new T.ShaderMaterial({side:T.DoubleSide,transparent:true,depthWrite:false,uniforms:{tint:{value:new T.Color(color)},inner:{value:inner},outer:{value:outer},lightPosition:{value:lightPosition},center:{value:center},radius:{value:radius}},vertexShader:vertex,fragmentShader:`
 uniform vec3 tint;uniform float inner;uniform float outer;uniform vec3 lightPosition;uniform vec3 center;uniform float radius;
 varying vec3 vLocal;varying vec3 vPosition;
 void main(){float r=(length(vLocal.xy)-inner)/(outer-inner);float density=mix(.28+.5*pow(abs(sin(r*65.+sin(r*23.))),.65),.53,clamp(fwidth(r)*65.,0.,1.));
 float gap=smoothstep(.012,.03,abs(r-.61));float edge=smoothstep(0.,.035,r)*(1.-smoothstep(.94,1.,r));
 vec3 light=normalize(lightPosition-vPosition),toCenter=center-vPosition;float along=dot(toCenter,light);
 float shadow=along>0.?smoothstep(radius*.88,radius*1.05,length(toCenter-light*along)):1.;
 gl_FragColor=vec4(tint*(.2+shadow*.55),density*gap*edge*.7);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
}

// Pure helpers are also used by the render loops and exercised by behavioral tests.
export function orbitPosition(radius, phase, tilt = 0) {
 return [Math.cos(phase)*radius, Math.sin(phase)*radius*Math.sin(tilt), Math.sin(phase)*radius*Math.cos(tilt)];
}
export function damp(current, target, delta, rate = 5) {
 return current + (target-current)*(1-Math.exp(-Math.min(Math.max(delta,0),.1)*rate));
}
