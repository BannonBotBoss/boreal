/**
 * Through-planet axis view (Grok Bot, T-0070 stage 2): a vector û from the centre (0), a signed position r along it (core 0,
 * surfaces ±R, out to the magnetopause), a cutaway through the axis and a readout of depth/altitude, density, T and P.
 * Profiles come from the wasm (interior.rs PREM + gas.rs); altitude comes from radial.ts (the single source). The cut face is a
 * disc in the clip plane, coloured per layer by sampling the same profile. Controls: ?dir=lat,lon|body:sun, ?r=km, slider,
 * pad (ls aims û, rt/lt move r; dright/R toggles), click on the globe sets û.
 */
import * as THREE from 'three';
import type { PlanetSim } from '../../core/planetBudget';
import { INTERIOR_LAYERS, ATM_LAYERS, GAS_SPECIES } from '../../core/planetBudget';
import { earthFigure } from './figure';
import { altitudeAt, axisPoint, parseAxisDir } from './radial';
import { toLatLon, fromLatLon, type Vec3 } from './planet';
import { withLogDepth } from './logDepth';
import { loadParcels, parcelPoints, parcelReadout } from './parcels';

const LAYER_RGB: number[][] = [[1, .85, .5], [1, .55, .15], [.75, .3, .15], [.45, .38, .32], [.1, .3, .7], [.55, .75, 1], [.6, .4, 1], [1, .9, .3]];
interface Surf { sampleSurface(d: Vec3, fp?: number): { h: number; water: number; kind?: string } }
export function createAxis(o: { q: URLSearchParams; scene: THREE.Scene; R: number; planet: Surf; material: THREE.Material; renderer: THREE.WebGLRenderer; sunDir: () => Vec3; sim: Promise<PlanetSim | null>; mount: HTMLElement }) {
  const { R } = o; let sim: PlanetSim | null = null; let on = o.q.has('r') || parseAxisDir(o.q.get('dir')) !== null;
  let u: Vec3 = parseAxisDir(o.q.get('dir'), o.sunDir) ?? [0, 1, 0], rKm = Number(o.q.get('r') ?? R / 1000); if (!Number.isFinite(rKm)) rKm = R / 1000;
  const R_MAX = 12 * R / 1000; // km: past the dayside magnetopause (~10 R_E, Shue 1998)
  const group = new THREE.Group(); group.renderOrder = 3; o.scene.add(group);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, toneMapped: false, depthTest: false }) // the axis lies in the cut plane: draw over the face; lineMat.onBeforeCompile = withLogDepth;
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), lineMat); line.frustumCulled = false; line.renderOrder = 9; group.add(line);
  const ptMat = new THREE.PointsMaterial({ color: 0xffee55, size: 9, sizeAttenuation: false, toneMapped: false, depthTest: false });
  const pt = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3)), ptMat); pt.frustumCulled = false; pt.renderOrder = 10; group.add(pt);
  // cut face: the section of the hydrostatic figure (figure.ts: a, c; spin axis +y) in the clip plane. Interior coloured per
  // PREM layer at the homologous radius s = |(x/a, y/c, z/a)| (a 1D lookup from the wasm profile); a ring to the highest
  // terrain (+9 km) closes the cut against the clipped tiles; with gas layers on, the air to H_ATM km by thermal layer (gas.rs)
  const FIG = earthFigure(), H_ATM = 600e3, H_TOP = 9e3;
  const N = 512, lut = new Uint8Array(N * 4), tex = new THREE.DataTexture(lut, N, 1); tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;
  const NA = 256, alut = new Uint8Array(NA * 4), atex = new THREE.DataTexture(alut, NA, 1); atex.magFilter = THREE.NearestFilter; atex.needsUpdate = true;
  const discMat = new THREE.ShaderMaterial({ uniforms: { uLut: { value: tex }, uAtmLut: { value: atex }, uA: { value: FIG.a }, uC: { value: FIG.c }, uTop: { value: H_TOP }, uAtm: { value: 0 }, uHAtm: { value: H_ATM } }, side: THREE.DoubleSide,
    // three's log-depth chunks (switched on by withLogDepth) so the cut face depth-tests against the log-depth tiles
    vertexShader: '#include <common>\n#include <logdepthbuf_pars_vertex>\nvarying vec3 vP; void main(){ vP = mat3(modelMatrix) * position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n#include <logdepthbuf_vertex>\n}',
    fragmentShader: `#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uLut, uAtmLut; uniform float uA, uC, uTop, uAtm, uHAtm; varying vec3 vP;
      void main(){ vec3 q = vP / vec3(uA, uC, uA); float s = length(q); float h = (s - 1.0) * length(vP) / s; // height above the figure
        vec3 c; if (s <= 1.0) c = texture2D(uLut, vec2(s, .5)).rgb; else if (h < uTop) c = texture2D(uLut, vec2(.999, .5)).rgb;
        else if (uAtm > .5 && h < uHAtm) c = texture2D(uAtmLut, vec2(h / uHAtm, .5)).rgb; else discard; gl_FragColor = vec4(c, 1.0);
#include <logdepthbuf_fragment>
}` });
  discMat.onBeforeCompile = withLogDepth;
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), discMat); disc.frustumCulled = false; group.add(disc);
  const setDiscScale = () => disc.scale.setScalar(FIG.a + (gasLayers ? H_ATM : H_TOP) * 1.01);
  const ATM_RGB = [[.35, .6, 1], [.55, .75, 1], [.4, .45, .85], [.75, .35, .6], [.3, .2, .35]];
  let gasLayers = o.q.get('gaslayers') === '1', showGas = o.q.get('gas') === '1' || gasLayers, showRT = o.q.get('rt') === '1', bodies = Number(o.q.get('bodies') ?? -1);
  let bodyInfo = '', parcelInfo = '', parcelsOn = o.q.get('parcels') === '1', parcels: THREE.Points | null = null;
  const comPt = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3)), new THREE.PointsMaterial({ color: 0x55ffee, size: 11, sizeAttenuation: false, toneMapped: false, depthTest: false }));
  comPt.frustumCulled = false; comPt.renderOrder = 11; comPt.visible = false; group.add(comPt);
  const clip = new THREE.Plane(); o.renderer.localClippingEnabled = true;
  const ui = document.createElement('div'); ui.style.cssText = 'position:absolute;left:12px;bottom:12px;z-index:20;font:12px/1.4 system-ui;color:#eee;background:rgba(0,0,0,.6);padding:8px 10px;border-radius:6px;min-width:260px;display:none';
  ui.innerHTML = '<div><b>Axis</b> <button data-a=sun>û → Sun</button> <button data-a=gas>Gas</button> <button data-a=layers>Layers</button> <button data-a=rt>RT</button> <button data-a=bodies>Bodies</button> <button data-a=parcels>Parcels</button> <button data-a=off>×</button></div><input type=range min=-1 max=1 step=0.0005 style="width:100%"><pre style="margin:4px 0 0;font:11px ui-monospace"></pre>';
  o.mount.appendChild(ui); const slider = ui.querySelector('input')!, pre = ui.querySelector('pre')!;
  // slider: linear through the planet (|s| ≤ .5 → |r| ≤ R), logarithmic outside to R_MAX
  const toR = (s: number) => { const a = Math.abs(s), R0 = R / 1000; return Math.sign(s) * (a <= .5 ? a * 2 * R0 : R0 * (R_MAX / R0) ** ((a - .5) * 2)); };
  const toS = (r: number) => { const a = Math.abs(r), R0 = R / 1000; return Math.sign(r) * (a <= R0 ? a / R0 / 2 : .5 + Math.log(a / R0) / Math.log(R_MAX / R0) / 2); };
  slider.oninput = () => { rKm = toR(Number(slider.value)); };
  ui.onclick = e => { const a = (e.target as HTMLElement).dataset.a; if (a === 'sun') u = o.sunDir(); if (a === 'off') api.toggle(false); if (a === 'gas') api.gas(); if (a === 'layers') api.layers(); if (a === 'rt') api.rt(); if (a === 'bodies') api.bodies(); if (a === 'parcels') api.parcels(); };
  o.sim.then(s => { sim = s; if (!s) return; for (let i = 0; i < N; i++) { const L = s.radialProfile((i + .5) / N * R / 1000).layer | 0, c = LAYER_RGB[L] ?? [1, 1, 1];
    lut.set([c[0] * 255, c[1] * 255, c[2] * 255, 255], i * 4); } tex.needsUpdate = true;
    for (let i = 0; i < NA; i++) { const L = s.gasAbove((i + .5) / NA * H_ATM / 1000).layer | 0, c = ATM_RGB[L]; alut.set([c[0] * 255, c[1] * 255, c[2] * 255, 255], i * 4); } atex.needsUpdate = true;
    if (bodies >= 0) runBodies(); });
  // live grid cell (the same PlanetSim instance planetLayers.ts seeds and steps): humidity, cloud fraction, cloud optical depth
  const YEAR = Number(o.q.get('year')) || new Date().getUTCFullYear();
  const liveCell = (latDeg: number, lonDeg: number) => { if (!sim || !sim.n) return null; const i = Math.min(sim.nlat - 1, Math.max(0, Math.floor((latDeg + 90) / 180 * sim.nlat))),
    j = Math.min(sim.nlon - 1, Math.max(0, Math.floor((((lonDeg + 180) % 360 + 360) % 360) / 360 * sim.nlon))), c = i * sim.nlon + j;
    return { q: sim.plane('q')[c], cloud: sim.plane('cloud')[c], cot: sim.plane('cot')[c] }; };
  // stage 6: the Earth built from relaxed SPH parcels (formation.rs bake); the cut plane clips them like the tiles
  const runParcels = async () => { if (!parcelsOn) { if (parcels) parcels.visible = false; parcelInfo = ''; return; }
    if (!parcels) { const b = await loadParcels(); if (!b) { parcelInfo = '\nparcels: no bake (public/bake/earth-parcels.bin)'; return; } parcels = parcelPoints(b.buf, clip); group.add(parcels); parcelInfo = '\n' + parcelReadout(b.meta); }
    parcels.visible = true; };
  const parcelFrame = () => { disc.visible = !(parcelsOn && parcels); if (parcels) ((parcels.material as THREE.ShaderMaterial).uniforms.uH.value = o.renderer.getDrawingBufferSize(new THREE.Vector2()).y / 2); };
  void runParcels();
  const runBodies = () => { if (!sim || bodies < 0) { bodyInfo = ''; comPt.visible = false; return; } const e = sim.emergentDemo(2000, bodies);
    const modes = ['relaxed PREM Earth', 'same particles, 3 v_esc', 'Earth + Moon (37 p)'];
    bodyInfo = `\nbodies [${modes[bodies]}]: ${e.count} object${e.count === 1 ? '' : 's'} (FoF b 0.2 + unbinding)` + (e.count ? `\n  M ${e.mass.toExponential(4)} kg  ${e.members} p ${e.trusted ? 'trusted' : 'untrusted'}\n  COM offset ${(Math.hypot(...e.com) / 1000).toFixed(1)} km  L_z ${e.spinZ.toExponential(3)}  layers ${e.layers}` +
      (bodies === 2 ? `\n  Moon inside Hill ${e.insideHill}  outside Roche ${e.outsideRoche}` : '') : '');
    // the object's centre of mass is its radial-axis origin: marker there (sampler frame +z spin -> globe +y)
    (comPt.geometry.getAttribute('position') as THREE.BufferAttribute).set([e.com[0], e.com[2], -e.com[1]]); comPt.geometry.getAttribute('position').needsUpdate = true; comPt.visible = e.count > 0; };
  const fmt = (x: number, d = 3) => Math.abs(x) >= 1e5 || (Math.abs(x) < 1e-2 && x !== 0) ? x.toExponential(d - 1) : x.toFixed(d);
  const api = {
    get on() { return on; }, get u() { return u; }, get rKm() { return rKm; },
    toggle(v = !on) { on = v; ui.style.display = on ? '' : 'none'; group.visible = on; o.material.clippingPlanes = on ? [clip] : null; o.material.needsUpdate = true; },
    aim(dLat: number, dLon: number) { const ll = toLatLon(u); u = fromLatLon(Math.max(-Math.PI / 2, Math.min(Math.PI / 2, ll.lat + dLat)), ll.lon + dLon); },
    move(f: number) { slider.value = String(Math.max(-1, Math.min(1, toS(rKm) + f))); rKm = toR(Number(slider.value)); },
    pick(d: Vec3) { u = d; },
    gas(v = !showGas) { showGas = v; },
    layers(v = !gasLayers) { gasLayers = v; discMat.uniforms.uAtm.value = v ? 1 : 0; if (v) showGas = true; setDiscScale(); },
    rt(v = !showRT) { showRT = v; },
    bodies() { bodies = bodies >= 2 ? -1 : bodies + 1; runBodies(); },
    parcels(v = !parcelsOn) { parcelsOn = v; void runParcels(); },
    /** per frame, camera at the render origin: planet centre at −camPos */
    update(camPos: Vec3) {
      if (!on) return; group.position.set(-camPos[0], -camPos[1], -camPos[2]); parcelFrame(); // with parcels on, the cut shows them instead of the PREM disc
      const U = new THREE.Vector3(...u), surf = R; const out = Math.max(Math.abs(rKm) * 1000, surf) * 1.05;
      (line.geometry as THREE.BufferGeometry).setFromPoints([U.clone().multiplyScalar(-out), U.clone().multiplyScalar(out)]);
      const P = axisPoint(u, rKm); (pt.geometry.getAttribute('position') as THREE.BufferAttribute).set(P); pt.geometry.getAttribute('position').needsUpdate = true;
      // clip plane contains û and faces the camera: removes the near half so the section through the axis shows
      const C = new THREE.Vector3(...camPos), n = C.clone().addScaledVector(U, -C.dot(U)); if (n.lengthSq() < 1e-6) n.set(1, 0, 0).addScaledVector(U, -U.x);
      n.normalize(); clip.normal.copy(n).negate(); clip.constant = -n.dot(C); // render space x = p − C: keeps −n·p ≥ 0 (far half; three clips negative distance)
      disc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      if (!sim) { pre.textContent = 'loading profile…'; return; }
      const r = Math.abs(rKm), w: Vec3 = rKm >= 0 ? u : [-u[0], -u[1], -u[2]], a = altitudeAt(o.planet, r * 1000, w), hk = a.h / 1000, sf0 = o.planet.sampleSurface(w), onLand = sf0.water <= sf0.h;
      // map onto the 1-D PREM/US76 column: same h above the local surface; under land the column starts at the top of PREM's
      // upper crust (6368 km, skipping its 3 km ocean shell) to the base of the crust (24.4 km, Moho), with the overburden of
      // that shell removed so P = 1 atm at the land surface; deeper (and under the sea) the same fractional radius
      const crust = onLand && hk < 0 && -hk < 24.4, P_SHELL = crust ? sim.radialProfile(6367.999).P - 101325 : 0;
      const p0 = sim.radialProfile(hk >= 0 ? 6371 + hk : crust ? 6367.999 + hk : r * 6371 / (r - hk)), p = { ...p0, P: p0.P - P_SHELL, T: crust ? p0.T + (288 - sim.radialProfile(6367.999).T) : p0.T };
      const ll = toLatLon(u), lat = Math.asin(Math.max(-1, Math.min(1, w[1]))) * 180 / Math.PI; slider.value = String(toS(rKm));
      // gravity: PREM (spherical) inside; outside, the rotating oblate figure (J2 + centrifugal, gas.rs gravity) at the true r
      const g = hk >= 0 ? sim.figureGravity(r * 1000, lat) : p.g;
      let txt = `û  lat ${(ll.lat * 180 / Math.PI).toFixed(2)}°  lon ${(ll.lon * 180 / Math.PI).toFixed(2)}°\n` +
        `r  ${rKm.toFixed(1)} km   ${a.h < 0 ? 'depth' : 'altitude'} ${(Math.abs(a.h) / 1000).toFixed(2)} km\n` +
        `   above sea ${(a.hSea / 1000).toFixed(2)} km, above mean R ${(a.hMean / 1000).toFixed(2)} km\n` +
        `layer ${INTERIOR_LAYERS[p.layer | 0]}${hk >= 0 ? ' · ' + ATM_LAYERS[sim.gasAbove(hk).layer | 0] : ''}\nρ ${fmt(p.rho)} kg/m³   T ${fmt(p.T, 4)} K\nP ${fmt(p.P)} Pa   g ${g.toFixed(3)} m/s²${hk >= 0 ? ' (figure)' : ' (PREM)'}`;
      if (showGas && hk >= 0) { const gc = sim.gasColumn(hk, 0, 0.0115), ab = sim.gasAbove(hk, 0.0115), top = gc.x.map((x, i) => [x, i] as [number, number]).sort((A, B) => B[0] - A[0]).slice(0, 4);
        txt += `\ngas  n ${fmt(gc.n)} m⁻³  ` + top.map(([x, i]) => `${GAS_SPECIES[i]} ${x >= .01 ? (x * 100).toFixed(2) + '%' : (x * 1e6).toFixed(1) + 'ppm'}`).join(' ') +
          `\nabove: ${fmt(ab.mass)} kg/m²  O₃ ${ab.o3DU.toFixed(1)} DU  H₂O ${ab.pwMm.toFixed(2)} mm`; }
      if (showRT) { const su = o.sunDir(), sn = Math.hypot(...su), sd = su.map(x => x / sn), cz = sd[0] * w[0] + sd[1] * w[1] + sd[2] * w[2];
        const P0 = w.map(x => x * r * 1000), vv = camPos.map((x, i) => x - P0[i]), cl = Math.hypot(...vv), cv0 = vv.map(x => x / cl), cosV = (cv0[0] * w[0] + cv0[1] * w[1] + cv0[2] * w[2]);
        const proj = (v: number[]) => { const d = v[0] * w[0] + v[1] * w[1] + v[2] * w[2]; return v.map((x, i) => x - d * w[i]); }, ps = proj(sd), pv = proj(cv0), nps = Math.hypot(...ps), npv = Math.hypot(...pv);
        const phi = nps > 1e-9 && npv > 1e-9 ? Math.acos(Math.max(-1, Math.min(1, -(ps[0] * pv[0] + ps[1] * pv[1] + ps[2] * pv[2]) / nps / npv))) : Math.PI;
        const sf = o.planet.sampleSurface(w), ocean = sf.water > sf.h, kind = ocean ? (Math.abs(lat) > 70 ? 1 : 0) : (Math.abs(lat) > 65 || sf.h > 4500 ? 2 : 3);
        const live = liveCell(lat, ll.lon * 180 / Math.PI), year = YEAR + ((live ? sim.day : 0) - 1) / 365.25;
        const k = sim.rtPoint({ year, cosZ: cz, cosV, phi, surf: kind, hKm: Math.max(0, (ocean ? sf.water : sf.h) / 1000) /* lake: its own surface height */, ...(live ? { qSurf: live.q, cloud: live.cloud, tau: live.cot > 0 ? live.cot : 9 } : {}) });
        txt += live ? `\n  sim day ${sim.day.toFixed(0)} ${sim.hour.toFixed(1)} h UTC  q ${(live.q * 1e3).toFixed(2)} g/kg  cloud ${live.cloud.toFixed(2)} τ ${live.cot.toFixed(1)}` : '\n  (no live grid: climatological q, clear sky)';
        txt += `\nRT  TSI ${k.tsi.toFixed(1)}  μ☉ ${cz.toFixed(3)}  surface ${kind === 0 && (sf.kind === 'lake' || sf.h > 0) ? 'lake' : ['ocean', 'sea ice', 'snow', 'land'][kind] /* water standing above sea level is a lake */} α ${k.albedo.toFixed(3)}` +
          (cz > 0 ? `\n  in ${k.toa.toFixed(1)}  refl atm ${k.reflAtm.toFixed(1)} surf ${k.reflSurf.toFixed(1)}  abs atm ${k.absAtm.toFixed(1)} surf ${k.absSurf.toFixed(1)} W/m²` + (kind === 0 ? `  glint BRF ${k.glint.toFixed(3)}` : '') : '\n  night side: no shortwave'); }
      pre.textContent = txt + bodyInfo + (parcelsOn ? parcelInfo : '');
    },
  };
  api.toggle(on); api.layers(gasLayers); return api;
}
