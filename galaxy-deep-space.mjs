// Original procedural sky shared by Galaxy renderers. No texture downloads or loop.
import * as T from './vendor/three.module.min.js';

export const SKY_BUDGETS = Object.freeze({
  economy: { stars: 400, nebulae: 0 },
  balanced: { stars: 1400, nebulae: 2 },
  cinematic: { stars: 2400, nebulae: 3 }
});

export function starAttributes(seed = 8921, count = 2400) {
  let state = seed >>> 0;
  const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  const position = [], color = [], size = [], phase = [];
  const palette = ['#dceaff', '#fff1dc', '#9fcbff', '#d7cbff', '#e9bd9c'].map(c => new T.Color(c));
  const tilt = -.25, roll = -1.1, cosTilt = Math.cos(tilt), sinTilt = Math.sin(tilt), cosRoll = Math.cos(roll), sinRoll = Math.sin(roll);
  for (let i = 0; i < count; i++) {
    // A tilted galactic band gives the sky a composed silhouette; the remaining
    // third retains a full-depth halo. Rotation preserves every star's radius.
    const a = random() * Math.PI * 2, y = (random() * 2 - 1) * (i % 3 ? .22 : 1), r = 105 + random() * 45;
    const x = Math.sqrt(1 - y * y);
    const width = Math.cos(a) * x * r, height = y * r, depth = Math.sin(a) * x * r;
    const tiltedHeight = height * cosTilt - depth * sinTilt;
    position.push(width * cosRoll - tiltedHeight * sinRoll, width * sinRoll + tiltedHeight * cosRoll, height * sinTilt + depth * cosTilt);
    const c = palette[Math.floor(random() * palette.length)], light = .55 + random() * .65;
    color.push(c.r * light, c.g * light, c.b * light);
    // Sparse bright stars; each prefix also has a complete spectral distribution.
    size.push(i % 29 === 0 ? 4 + random() * 2 : 1.3 + random() * 1.5);
    phase.push(random() * Math.PI * 2);
  }
  return { position, color, size, phase };
}

const starVertex = `attribute vec3 spectral;attribute float size;attribute float phase;
uniform float time;uniform float dpr;varying vec3 tint;varying float flare;
void main(){vec4 view=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*view;
gl_PointSize=clamp(size*dpr*130./max(45.,-view.z),1.,12.*dpr);
tint=spectral*(.96+.04*sin(time*.16+phase));flare=step(3.5,size);}`;
const starFragment = `varying vec3 tint;varying float flare;
void main(){vec2 p=gl_PointCoord-.5;float r=length(p)*2.;if(r>1.)discard;
float core=exp(-r*r*32.),halo=exp(-r*r*5.)*.12;
float rays=exp(-min(abs(p.x),abs(p.y))*85.)*pow(1.-r,3.)*.14*flare;
gl_FragColor=vec4(tint,core+halo+rays);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
// Four noise evaluations in total. Filaments and dust lanes reuse that field.
// These are depth-separated translucent sheets, not volumetric ray marching.
const nebulaFragment = `uniform vec3 tint;uniform vec3 accent;uniform float seed;uniform float time;varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
void main(){vec2 uv=(vUv-.5)*vec2(3.,2.);vec2 q=uv*2.4+seed;
float warp=n(q*.7+vec2(time*.0015,0.));float gas=n(q+warp*1.6)*.6+n(q*2.03+4.)*.27+n(q*4.1+9.)*.13;
float channel=uv.y+sin(uv.x*1.65+seed)*.24+(warp-.5)*.42;
float ridge=exp(-channel*channel*6.8);
float dust=smoothstep(.025,.16,abs(channel+sin(uv.x*2.7+seed)*.055));
float filament=pow(clamp(1.-abs(gas-.57)*3.8,0.,1.),3.);
float edge=smoothstep(0.,.17,vUv.x)*smoothstep(0.,.17,1.-vUv.x)*smoothstep(0.,.2,vUv.y)*smoothstep(0.,.2,1.-vUv.y);
float density=smoothstep(.24,.77,gas)*ridge*edge*(.22+.78*dust);
vec3 col=mix(tint*.68,accent,smoothstep(.38,.78,gas));
col=mix(col,vec3(.66,.35,.24),filament*(1.-dust)*.16);
gl_FragColor=vec4(col,density*(.28+filament*.13));
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;

export function createDeepSpace(track, { color = '#6253a1', accent = '#438baf', seed = 8921 } = {}) {
  const group = new T.Group(); group.name = 'galaxy-deep-space';
  const attributes = starAttributes(seed), geometry = track(new T.BufferGeometry());
  geometry.setAttribute('position', new T.Float32BufferAttribute(attributes.position, 3));
  geometry.setAttribute('spectral', new T.Float32BufferAttribute(attributes.color, 3));
  geometry.setAttribute('size', new T.Float32BufferAttribute(attributes.size, 1));
  geometry.setAttribute('phase', new T.Float32BufferAttribute(attributes.phase, 1));
  const material = track(new T.ShaderMaterial({ vertexShader: starVertex, fragmentShader: starFragment,
    uniforms: { time: { value: 0 }, dpr: { value: 1 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
  const stars = new T.Points(geometry, material); group.add(stars);
  const sheet = track(new T.PlaneGeometry(1, 1)), nebulae = [];
  [[-48,-37,-74,145,72,.3],[49,-49,-93,160,90,-.5],[-62,21,58,135,80,.7]].forEach((pose, i) => {
    const mat = track(new T.ShaderMaterial({ vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: nebulaFragment, uniforms: { tint: { value: new T.Color(color) }, accent: { value: new T.Color(accent) }, seed: { value: seed % 71 + i * 7.3 }, time: { value: 0 } },
      transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending }));
    const cloud = new T.Mesh(sheet, mat); cloud.position.set(...pose.slice(0, 3)); cloud.lookAt(0, 0, 0); cloud.rotateZ(pose[5]); cloud.scale.set(pose[3], pose[4], 1); group.add(cloud); nebulae.push(cloud);
  });
  return {
    group, stars, nebulae,
    setQuality(tier) { const budget = SKY_BUDGETS[tier] || SKY_BUDGETS.balanced; geometry.setDrawRange(0, budget.stars); nebulae.forEach((n, i) => { n.visible = i < budget.nebulae; }); },
    setPixelRatio(value) { material.uniforms.dpr.value = Math.max(1, Math.min(2, value || 1)); },
    setPalette(color, accent) { nebulae.forEach(n => { n.material.uniforms.tint.value.set(color); n.material.uniforms.accent.value.set(accent); }); },
    update(elapsed) { material.uniforms.time.value = elapsed; nebulae.forEach(n => { n.material.uniforms.time.value = elapsed; }); }
  };
}
