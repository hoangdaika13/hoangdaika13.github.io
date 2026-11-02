// Original procedural portal. The existing Three.js runtime loads only on demand.
import * as T from './vendor/three.module.min.js';
export function mountPortal(host, options = {}) {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    host.append(canvas);
    let renderer;
    try {
        renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
    }
    catch (e) {
        canvas.remove();
        host.dataset.renderer = '2d';
        throw e;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(43, 1, .1, 80), group = new T.Group();
    camera.position.z = 7.6;
    scene.add(group);
    const resources = [], keep = x => (resources.push(x), x);
    const main = new T.Mesh(keep(new T.TorusGeometry(2.04, .028, 8, 180)), keep(new T.MeshBasicMaterial({ color: 0x43e2ff, transparent: true, opacity: .95 })));
    group.add(main);
    for (let i = 0; i < 3; i++) {
        const ring = new T.Mesh(keep(new T.TorusGeometry(2.25 + i * .12, .009, 5, 160)), keep(new T.MeshBasicMaterial({ color: i === 1 ? 0xa17aff : 0x45baff, transparent: true, opacity: .45 - i * .08 })));
        ring.rotation.set(i * .62 + .12, i * .4, i * .4);
        group.add(ring);
    }
    const vertex = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
    const fragment = 'precision mediump float;varying vec2 vUv;uniform float time;void main(){vec2 p=(vUv-.5)*2.;float r=length(p),a=atan(p.y,p.x);float spiral=sin(a*8.-r*30.+time*.65)*.5+.5;float thin=pow(spiral,8.);float edge=exp(-pow((r-.96)*30.,2.));vec3 cyan=vec3(.08,.78,1.),violet=vec3(.40,.13,.90);vec3 c=mix(violet,cyan,sin(a+r*9.+time*.18)*.5+.5);float light=(thin*.24+edge*.7)*smoothstep(.08,.7,r);float alpha=(1.-smoothstep(.97,1.,r))*.85;gl_FragColor=vec4(c*light+edge*cyan*.3,alpha);}';
    const material = keep(new T.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false, uniforms: { time: { value: 0 } } }));
    const disc = new T.Mesh(keep(new T.CircleGeometry(2.04, 96)), material);
    disc.position.z = -.03;
    group.add(disc);
    const geom = keep(new T.BufferGeometry()), n = options.lowPower ? 180 : 650, positions = new Float32Array(n * 3), colors = new Float32Array(n * 3);
    let seed = options.seed || 4817;
    const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < n; i++) {
        const angle = rng() * Math.PI * 2, r = 2.25 + rng() * 1.8;
        positions[i * 3] = Math.cos(angle) * r;
        positions[i * 3 + 1] = Math.sin(angle) * r;
        positions[i * 3 + 2] = (rng() - .5) * 2;
        colors[i * 3] = .3 + rng() * .4;
        colors[i * 3 + 1] = .5 + rng() * .5;
        colors[i * 3 + 2] = 1;
    }
    geom.setAttribute('position', new T.BufferAttribute(positions, 3));
    geom.setAttribute('color', new T.BufferAttribute(colors, 3));
    const points = new T.Points(geom, keep(new T.PointsMaterial({ size: .015, vertexColors: true, transparent: true, opacity: .85, depthWrite: false })));
    group.add(points);
    let alive = true, raf = 0, last = 0, px = 0, py = 0, visible = true, contextLost = false;
    const start = performance.now(), reduce = matchMedia('(prefers-reduced-motion: reduce)'), motion = () => !options.reducedMotion && !reduce.matches;
    function resize() { if (!alive)
        return; const r = host.getBoundingClientRect(); if (!r.width || !r.height)
        return; renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); renderer.render(scene, camera); }
    function frame(t) { raf = 0; if (!alive || document.hidden || !visible || contextLost || !host.isConnected)
        return; if (t - last >= 33) {
        last = t;
        const elapsed = (t - start) / 1000;
        material.uniforms.time.value = elapsed;
        points.rotation.z = elapsed * .018;
        main.rotation.z = -elapsed * .04;
        group.rotation.y += (px * .13 - group.rotation.y) * .04;
        group.rotation.x += (-py * .13 - group.rotation.x) * .04;
        renderer.render(scene, camera);
    } if (motion())
        raf = requestAnimationFrame(frame); }
    const move = e => { const r = host.getBoundingClientRect(); px = (e.clientX - r.left) / r.width - .5; py = (e.clientY - r.top) / r.height - .5; if (!motion())
        renderer.render(scene, camera); };
    const visibility = () => { cancelAnimationFrame(raf); raf = 0; if (!document.hidden && alive && visible && !contextLost) {
        renderer.render(scene, camera);
        if (motion())
            raf = requestAnimationFrame(frame);
    } };
    const lost = e => { e.preventDefault(); contextLost = true; cancelAnimationFrame(raf); host.dataset.renderer = '2d'; };
    const intersection = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => { visible = entries[0].isIntersecting; visibility(); }) : null;
    intersection?.observe(host);
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    host.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('visibilitychange', visibility);
    reduce.addEventListener('change', visibility);
    canvas.addEventListener('webglcontextlost', lost);
    host.dataset.renderer = '3d';
    resize();
    if (motion())
        raf = requestAnimationFrame(frame);
    return { destroy() { alive = false; cancelAnimationFrame(raf); observer.disconnect(); intersection?.disconnect(); host.removeEventListener('pointermove', move); document.removeEventListener('visibilitychange', visibility); reduce.removeEventListener('change', visibility); canvas.removeEventListener('webglcontextlost', lost); for (const r of resources)
            r.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); } };
}
