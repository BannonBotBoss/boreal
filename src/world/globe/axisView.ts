/**
 * Through-planet axis view (Grok Bot, T-0070 stage 2): a vector û from the centre (0), a signed position r along it (core 0,
 * surfaces ±R, out to the magnetopause), a cutaway through the axis and a readout of depth/altitude, density, T and P.
 * Profiles come from the wasm (interior.rs PREM + gas.rs); altitude comes from radial.ts (the single source). The cut face is a
 * disc in the clip plane, coloured per layer by sampling the same profile. Controls: ?dir=lat,lon|body:sun, ?r=km, slider,
 * pad (ls aims û, rt/lt move r; dright/R toggles), click on the globe sets û.
 */
import * as THREE from 'three';
import type { PlanetSim } from '../../core/planetBudget';
import { INTERIOR_LAYERS } from '../../core/planetBudget';
import { altitudeAt, axisPoint, parseAxisDir } from './radial';
import { toLatLon, fromLatLon, type Vec3 } from './planet';
import { withLogDepth } from './logDepth';

const LAYER_RGB: number[][] = [[1, .85, .5], [1, .55, .15], [.75, .3, .15], [.45, .38, .32], [.1, .3, .7], [.55, .75, 1], [.6, .4, 1], [1, .9, .3]];
interface Surf { sampleSurface(d: Vec3, fp?: number): { h: number; water: number } }
export function createAxis(o: { q: URLSearchParams; scene: THREE.Scene; R: number; planet: Surf; material: THREE.Material; renderer: THREE.WebGLRenderer; sunDir: () => Vec3; sim: Promise<PlanetSim | null>; mount: HTMLElement }) {
  const { R } = o; let sim: PlanetSim | null = null; let on = o.q.has('r') || parseAxisDir(o.q.get('dir')) !== null;
  let u: Vec3 = parseAxisDir(o.q.get('dir'), o.sunDir) ?? [0, 1, 0], rKm = Number(o.q.get('r') ?? R / 1000); if (!Number.isFinite(rKm)) rKm = R / 1000;
  const R_MAX = 12 * R / 1000; // km: past the dayside magnetopause (~10 R_E, Shue 1998)
  const group = new THREE.Group(); group.renderOrder = 3; o.scene.add(group);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, toneMapped: false }); lineMat.onBeforeCompile = withLogDepth;
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), lineMat); line.frustumCulled = false; group.add(line);
  const ptMat = new THREE.PointsMaterial({ color: 0xffee55, size: 9, sizeAttenuation: false, toneMapped: false, depthTest: false });
  const pt = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3)), ptMat); pt.frustumCulled = false; pt.renderOrder = 10; group.add(pt);
  // cut face: a disc of radius R in the clip plane, coloured by layer at each radius (a 1D lookup filled from the wasm profile)
  const N = 512, lut = new Uint8Array(N * 4), tex = new THREE.DataTexture(lut, N, 1); tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;
  const discMat = new THREE.ShaderMaterial({ uniforms: { uLut: { value: tex } }, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D uLut; varying vec2 vP; void main(){ float r = length(vP); if (r > 1.0) discard; gl_FragColor = vec4(texture2D(uLut, vec2(r, .5)).rgb, 1.0); }' });
  discMat.onBeforeCompile = withLogDepth;
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), discMat); disc.frustumCulled = false; disc.scale.setScalar(R * 1.0005); group.add(disc);
  const clip = new THREE.Plane(); o.renderer.localClippingEnabled = true;
  const ui = document.createElement('div'); ui.style.cssText = 'position:absolute;left:12px;bottom:12px;z-index:20;font:12px/1.4 system-ui;color:#eee;background:rgba(0,0,0,.6);padding:8px 10px;border-radius:6px;min-width:260px;display:none';
  ui.innerHTML = '<div><b>Axis</b> <button data-a=sun>û → Sun</button> <button data-a=off>×</button></div><input type=range min=-1 max=1 step=0.0005 style="width:100%"><pre style="margin:4px 0 0;font:11px ui-monospace"></pre>';
  o.mount.appendChild(ui); const slider = ui.querySelector('input')!, pre = ui.querySelector('pre')!;
  // slider: linear through the planet (|s| ≤ .5 → |r| ≤ R), logarithmic outside to R_MAX
  const toR = (s: number) => { const a = Math.abs(s), R0 = R / 1000; return Math.sign(s) * (a <= .5 ? a * 2 * R0 : R0 * (R_MAX / R0) ** ((a - .5) * 2)); };
  const toS = (r: number) => { const a = Math.abs(r), R0 = R / 1000; return Math.sign(r) * (a <= R0 ? a / R0 / 2 : .5 + Math.log(a / R0) / Math.log(R_MAX / R0) / 2); };
  slider.oninput = () => { rKm = toR(Number(slider.value)); };
  ui.onclick = e => { const a = (e.target as HTMLElement).dataset.a; if (a === 'sun') u = o.sunDir(); if (a === 'off') api.toggle(false); };
  o.sim.then(s => { sim = s; if (!s) return; for (let i = 0; i < N; i++) { const L = s.radialProfile((i + .5) / N * R / 1000).layer | 0, c = LAYER_RGB[L] ?? [1, 1, 1];
    lut.set([c[0] * 255, c[1] * 255, c[2] * 255, 255], i * 4); } tex.needsUpdate = true; });
  const fmt = (x: number, d = 3) => Math.abs(x) >= 1e5 || (Math.abs(x) < 1e-2 && x !== 0) ? x.toExponential(d - 1) : x.toFixed(d);
  const api = {
    get on() { return on; }, get u() { return u; }, get rKm() { return rKm; },
    toggle(v = !on) { on = v; ui.style.display = on ? '' : 'none'; group.visible = on; o.material.clippingPlanes = on ? [clip] : null; o.material.needsUpdate = true; },
    aim(dLat: number, dLon: number) { const ll = toLatLon(u); u = fromLatLon(Math.max(-Math.PI / 2, Math.min(Math.PI / 2, ll.lat + dLat)), ll.lon + dLon); },
    move(f: number) { slider.value = String(Math.max(-1, Math.min(1, toS(rKm) + f))); rKm = toR(Number(slider.value)); },
    pick(d: Vec3) { u = d; },
    /** per frame, camera at the render origin: planet centre at −camPos */
    update(camPos: Vec3) {
      if (!on) return; group.position.set(-camPos[0], -camPos[1], -camPos[2]);
      const U = new THREE.Vector3(...u), surf = R; const out = Math.max(Math.abs(rKm) * 1000, surf) * 1.05;
      (line.geometry as THREE.BufferGeometry).setFromPoints([U.clone().multiplyScalar(-out), U.clone().multiplyScalar(out)]);
      const P = axisPoint(u, rKm); (pt.geometry.getAttribute('position') as THREE.BufferAttribute).set(P); pt.geometry.getAttribute('position').needsUpdate = true;
      // clip plane contains û and faces the camera: removes the near half so the section through the axis shows
      const C = new THREE.Vector3(...camPos), n = C.clone().addScaledVector(U, -C.dot(U)); if (n.lengthSq() < 1e-6) n.set(1, 0, 0).addScaledVector(U, -U.x);
      n.normalize(); clip.normal.copy(n).negate(); clip.constant = -n.dot(C); // render space x = p − C: keeps −n·p ≥ 0 (far half; three clips negative distance)
      disc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      if (!sim) { pre.textContent = 'loading profile…'; return; }
      const r = Math.abs(rKm), w: Vec3 = rKm >= 0 ? u : [-u[0], -u[1], -u[2]], a = altitudeAt(o.planet, r * 1000, w), hk = a.h / 1000, p = sim.radialProfile(hk >= 0 ? 6371 + hk : r * 6371 / (r - hk)); // map onto the 1-D PREM/US76 column: same h above the local surface, same fractional radius below
      const ll = toLatLon(u); slider.value = String(toS(rKm));
      pre.textContent = `û  lat ${(ll.lat * 180 / Math.PI).toFixed(2)}°  lon ${(ll.lon * 180 / Math.PI).toFixed(2)}°\n` +
        `r  ${rKm.toFixed(1)} km   ${a.h < 0 ? 'depth' : 'altitude'} ${(Math.abs(a.h) / 1000).toFixed(2)} km\n` +
        `   above sea ${(a.hSea / 1000).toFixed(2)} km, above mean R ${(a.hMean / 1000).toFixed(2)} km\n` +
        `layer ${INTERIOR_LAYERS[p.layer | 0]}\nρ ${fmt(p.rho)} kg/m³   T ${fmt(p.T, 4)} K\nP ${fmt(p.P)} Pa   g ${p.g.toFixed(3)} m/s²`;
    },
  };
  api.toggle(on); return api;
}
