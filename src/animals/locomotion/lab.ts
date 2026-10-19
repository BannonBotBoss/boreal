/**
 * Locomotion lab (dev page tools/locomotion-lab.html). One test quadruped walks a circle over a chosen terrain, driven
 * by the locomotion layer. Params: ?terrain=flat|hills|world  ?gait=auto|walk|trot|pace|canter|gallop|bound|pronk
 * ?speed=<m/s>  ?lod=near|mid  ?rig=stick|real  ?t=<seconds to pre-simulate>  ?cam=side|follow  ?pause=1 (freeze after ?t)
 * ?seed=<n> (coat variety)  ?darken=0..2 ?streakSpacing ?streakWidth ?streakJitter=0..1 (coat layers, also sliders)  ?posture=key:value,... (override posture.ts)  ?cam=profile (eye-level side view, for comparing with reference photos)  ?hide=body,legs,feet,ik  ?raw=1 (springs off)  ?ui=0 (hide the panel)
 * ?pounce=1 (a pounce at t = 1 s and every 3 s after; P key or the button pounces any time)  ?timescale=0.05..1 (slow motion, T-0002)
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { heightAt } from '../../core/world';
import { createLocomotion, limbToWorld, referenceLayout, SPRINGS } from './controller';
import { limbOf } from '../../core/animalBehavior';
import { POSTURE } from './posture';
import { TIMESCALE } from '../../core/timescale';
import { GAIT_TABLE } from './gaits';
import { createStickRig } from './stickRig';
import { COAT } from './fork/bodyTubes';
import { LEG_NAMES, type GaitId, type LegPose, type Lod, type TerrainFn } from './signals';

const q = new URLSearchParams(location.search);
// coat layers (fork/bodyTubes COAT): ?darken=0..2 ?streakSpacing ?streakWidth ?streakJitter=0..1, read before the rig is built
for (const k of Object.keys(COAT) as Array<keyof typeof COAT>) { const v = Number(q.get(k)); if (q.has(k) && Number.isFinite(v)) COAT[k] = v; }
// ?posture=headPitch:-.2,bodyDrop:.05 overrides POSTURE (posture.ts) for tuning
for (const kv of (q.get('posture') ?? '').split(',')) { const [k, v] = kv.split(':'); if (k in POSTURE && Number.isFinite(Number(v))) (POSTURE as Record<string, number>)[k] = Number(v); }
const terrainName = q.get('terrain') ?? 'flat';
const W0 = { x: 30, z: 30 }; // world-terrain sample window origin
const TERRAIN: Record<string, TerrainFn> = {
  flat: () => 0,
  hills: (x, z) => .35 * Math.sin(x * .45) * Math.cos(z * .38) + .12 * Math.sin(x * 1.1 + z * .7),
  world: (x, z) => heightAt(x + W0.x, z + W0.z) - heightAt(W0.x, W0.z),
};
const ground = TERRAIN[terrainName] ?? TERRAIN.flat;
const gaitParam = q.get('gait') ?? 'auto';
const state = {
  gait: (gaitParam in GAIT_TABLE ? gaitParam : undefined) as GaitId | undefined,
  speed: Number(q.get('speed') ?? NaN), lod: (q.get('lod') === 'mid' ? 'mid' : 'near') as Lod, paused: false, pounce: false, clock: 0,
};
const DEFAULT_SPEED: Record<string, number> = { auto: 1.2, walk: 1.2, trot: 2.6, pace: 2.6, canter: 4.5, gallop: 7, bound: 5, pronk: 3 };
if (!Number.isFinite(state.speed)) state.speed = DEFAULT_SPEED[gaitParam] ?? 1.2;

// ---------------------------------------------------------------- scene
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.append(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xcdd6cf); scene.fog = new THREE.Fog(0xcdd6cf, 18, 45);
scene.add(new THREE.HemisphereLight(0xf2f5e4, 0x55664f, 1.6));
const sun = new THREE.DirectionalLight(0xfff0d8, 2.6); sun.position.set(4, 8, 3); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: .5, far: 30 }); scene.add(sun, sun.target);
const size = 40, segs = 200, geo = new THREE.PlaneGeometry(size, size, segs, segs); geo.rotateX(-Math.PI / 2);
const pos = geo.attributes.position as THREE.BufferAttribute;
for (let i = 0; i < pos.count; i++) pos.setY(i, ground(pos.getX(i), pos.getZ(i)));
geo.computeVertexNormals();
const floor = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x7d8f63, roughness: 1 })); floor.receiveShadow = true; scene.add(floor);
const grid = new THREE.GridHelper(size, 40, 0x56664a, 0x6c7d5a); (grid.material as THREE.Material).opacity = .35; (grid.material as THREE.Material).transparent = true;
grid.position.y = terrainName === 'flat' ? .002 : -100; scene.add(grid);

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, .05, 200);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---------------------------------------------------------------- animal
const layout = referenceLayout(), R = 5;
const path = { a: 0 };
const at = () => { const x = R * Math.cos(path.a), z = -R * Math.sin(path.a); return { x, z, heading: path.a }; }; // velocity direction (−sin a, −cos a) = forward at heading a
let body = at();
const loco = createLocomotion(layout, ground, body);
const stick = createStickRig(layout); scene.add(stick.root);
let poseReal: ((p: LegPose, a: typeof body) => void) | undefined, realMeshes: THREE.Object3D[] = [], realChains: { girdle: THREE.Object3D; upper: THREE.Object3D; lower: THREE.Object3D; foot: THREE.Object3D; paw: THREE.Object3D }[] = [];
if (q.get('rig') === 'real' || q.get('rig') === 'orig') void loadReal();

/** The furred wolf through the forked rig (fork/playerRig.ts): hook 2 poses legs, tilt and height exactly from our pose. */
async function loadReal() {
  // ?rig=orig loads Claude's original rig (unposed by us) for the before/after budget numbers in ?stats=1
  const { createPlayerWolf } = q.get('rig') === 'orig' ? await import('../../render/playerWolf') as unknown as typeof import('./fork/playerRig') : await import('./fork/playerRig');
  const wolf = createPlayerWolf(Number(q.get('seed') ?? 1400)); scene.add(wolf.root); // ?seed= shows the seeded coat variety
  if (q.get('stats') === '1') setTimeout(() => statsOf(wolf.root), 1500);
  wolf.root.traverse(o => { if (!o.userData.shadowSet) o.castShadow = true; if ((o as THREE.Mesh).isMesh) realMeshes.push(o); });
  realChains = wolf.loco.chains; stick.root.visible = false; applyLayers();
  poseReal = (p, a) => {
    wolf.root.position.set(a.x, p.height, a.z); wolf.root.rotation.y = a.heading;
    wolf.animate(performance.now() / 1000, state.speed > .05, undefined, 0, 'walk', undefined, p);
  };
}

// foot markers: green = planted (locked in the world), orange = swing
const dotGeo = new THREE.SphereGeometry(.025, 10, 8), green = new THREE.MeshBasicMaterial({ color: 0x1fbf4a }), orange = new THREE.MeshBasicMaterial({ color: 0xff8a1f });
const dots = LEG_NAMES.map(() => { const m = new THREE.Mesh(dotGeo, green); scene.add(m); return m; });
// debug layers: IK targets (limb top → the sole target the solver is asked to reach), and a leg-bone overlay for the real rig
const lineOf = (n: number, color: number) => { const g = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, depthTest: false })); l.renderOrder = 10; l.frustumCulled = false; scene.add(l); return l; };
const ikLines = LEG_NAMES.map(() => lineOf(2, 0x19c3e6)), boneLines = LEG_NAMES.map(() => lineOf(5, 0xffe14d));
const setLine = (l: THREE.Line, pts: { x: number; y: number; z: number }[]) => { const a = l.geometry.attributes.position as THREE.BufferAttribute; pts.forEach((p, k) => a.setXYZ(k, p.x, p.y, p.z)); a.needsUpdate = true; };
const layers = { body: true, legs: true, feet: true, ik: false, raw: q.get('raw') === '1' };
for (const k of (q.get('hide') ?? '').split(',')) if (k in layers) (layers as Record<string, boolean>)[k] = false;
if (q.get('show')) for (const k of q.get('show')!.split(',')) if (k in layers) (layers as Record<string, boolean>)[k] = true;
const springDefaults = { ...SPRINGS };
function applyLayers() {
  stick.body.forEach(o => { o.visible = layers.body; }); stick.legs.forEach(o => { o.visible = layers.legs; });
  realMeshes.forEach(o => { o.visible = layers.body; }); boneLines.forEach(l => { l.visible = layers.legs && !layers.body && realChains.length > 0; }); // real rig: the leg-bone overlay shows when the fur is hidden
  dots.forEach(d => { d.visible = layers.feet; }); ikLines.forEach(l => { l.visible = layers.ik; });
  Object.assign(SPRINGS, springDefaults, layers.raw ? { joint: 0, body: 0 } : {}); // raw = the solved pose without the critically damped springs
}

// ---------------------------------------------------------------- UI: speed slider, gait/LOD pickers, readout, footfall strip
const css = document.createElement('style');
css.textContent = `body{margin:0;overflow:hidden;font:12px system-ui;color:#1d241c}#ui{position:absolute;left:10px;top:10px;background:#ffffffd9;padding:8px 10px;border-radius:6px;min-width:260px}
#ui label{display:block;margin:3px 0}#ui input[type=range]{width:150px;vertical-align:middle}#ro{font:11px ui-monospace,monospace;white-space:pre;margin-top:4px}canvas#strip{display:block;margin-top:6px;background:#f4f5ef}`;
document.head.append(css);
const ui = document.createElement('div'); ui.id = 'ui';
ui.innerHTML = `<b>Locomotion lab</b> · terrain ${terrainName}<label>speed <input id="sp" type="range" min="0" max="10" step=".1"> <span id="spv"></span> m/s</label>
<label>gait <select id="ga">${['auto', ...Object.keys(GAIT_TABLE)].map(g => `<option>${g}</option>`).join('')}</select> LOD <select id="lo"><option>near</option><option>mid</option></select> <button id="pa">pause</button> <button id="po">pounce</button></label>
<label>show ${Object.keys(layers).map(k => `<input type="checkbox" id="ly-${k}">${k === 'raw' ? 'raw (no springs)' : k === 'feet' ? 'foot markers' : k === 'ik' ? 'IK targets' : k}`).join(' ')}</label>
<label>coat ${([['darken', 0, 2, .05], ['streakSpacing', .004, .03, .001], ['streakWidth', .001, .01, .0005], ['streakJitter', 0, 1, .05]] as const).map(([k, lo, hi, st]) => `${k} <input type="range" data-coat="${k}" min="${lo}" max="${hi}" step="${st}" value="${COAT[k]}"> <span>${COAT[k]}</span>`).join('<br>')}</label>
<div id="ro"></div><canvas id="strip" width="260" height="56"></canvas>`;
document.body.append(ui); if (q.get('ui') === '0') ui.style.display = 'none';
// coat sliders rebuild the wolf by reloading with the value in the URL (the coat is baked into the skin and the cards)
ui.querySelectorAll<HTMLInputElement>('input[data-coat]').forEach(el => { el.oninput = () => { (el.nextElementSibling as HTMLElement).textContent = el.value; }; el.onchange = () => { q.set(el.dataset.coat!, el.value); location.search = q.toString(); }; });
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const sp = $<HTMLInputElement>('sp'), ga = $<HTMLSelectElement>('ga'), lo = $<HTMLSelectElement>('lo');
sp.value = String(state.speed); ga.value = state.gait ?? 'auto'; lo.value = state.lod;
sp.oninput = () => { state.speed = Number(sp.value); }; ga.onchange = () => { state.gait = ga.value === 'auto' ? undefined : ga.value as GaitId; }; lo.onchange = () => { state.lod = lo.value as Lod; };
$('pa').onclick = () => { state.paused = !state.paused; };
$('po').onclick = () => { state.pounce = true; }; addEventListener('keydown', e => { if (e.key === 'p') state.pounce = true; });
for (const k of Object.keys(layers) as (keyof typeof layers)[]) { const c = $<HTMLInputElement>(`ly-${k}`); c.checked = layers[k]; c.onchange = () => { layers[k] = c.checked; applyLayers(); }; }
applyLayers();
const autoPounce = q.get('pounce') === '1';
const strip = $<HTMLCanvasElement>('strip').getContext('2d')!, history: boolean[][] = [];

function drawStrip() {
  const w = 260, rowH = 12; strip.clearRect(0, 0, w, 56);
  history.forEach((c, x) => c.forEach((on, i) => { if (on) { strip.fillStyle = i % 2 ? '#3d6b8c' : '#2e8b57'; strip.fillRect(x, 4 + i * rowH, 1, rowH - 3); } }));
  strip.fillStyle = '#333'; LEG_NAMES.forEach((n, i) => strip.fillText(n, w - 18, 13 + i * rowH));
}

// ---------------------------------------------------------------- loop
const DT = 1 / 120;
let pose: LegPose = loco.update({ ...body, speed: 0, gait: state.gait }, DT, state.lod);
function simulate(dt: number) {
  const before = state.clock; state.clock += dt;
  if (autoPounce && before < 1 && state.clock >= 1 || autoPounce && before >= 1 && Math.floor((before - 1) / 3) !== Math.floor((state.clock - 1) / 3)) state.pounce = true;
  const intent = state.pounce && !loco.jumping() ? { kind: 'pounce' as const } : undefined; state.pounce = false;
  const v = loco.jumping() || intent ? Math.max(state.speed, 5) : state.speed; // a pounce carries the body forward
  path.a += v * dt / R; body = at();
  pose = loco.update({ ...body, speed: v, gait: state.gait, intent }, dt, state.lod);
  history.push(pose.contacts.slice()); if (history.length > 240) history.shift();
}
const warm = Number(q.get('t') ?? 0);
for (let t = 0; t < warm; t += DT) simulate(DT);
if (q.get('pause') === '1') state.paused = true;
const sideCam = q.get('cam') !== 'follow', profile = q.get('cam') === 'profile';
function placeCamera(initial: boolean) {
  const f = { x: -Math.sin(body.heading), z: -Math.cos(body.heading) };
  if (initial) {
    // side view: perpendicular to the direction of travel, slightly above
    const d = profile ? 3.2 : 2.6; if (profile) { camera.fov = 58; camera.updateProjectionMatrix(); } camera.position.set(body.x + f.z * d * (sideCam ? 1 : .6) - f.x * (sideCam ? 0 : 1.6), pose.height + (profile ? .45 : .9), body.z - f.x * d * (sideCam ? 1 : .6) - f.z * (sideCam ? 0 : 1.6));
  }
  const target = new THREE.Vector3(body.x, pose.height + .45, body.z), delta = target.clone().sub(controls.target);
  controls.target.copy(target); camera.position.add(delta); sun.position.set(body.x + 4, pose.height + 8, body.z + 3); sun.target.position.copy(target);
}
placeCamera(true);
let last = performance.now(), acc = 0;
function frame(now: number) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (!state.paused) { acc += dt * TIMESCALE; while (acc >= DT) { simulate(DT); acc -= DT; } }
  stick.apply(pose, body); poseReal?.(pose, body);
  pose.feet.forEach((f, i) => { dots[i].position.set(f.x, f.y + .02, f.z); dots[i].material = pose.contacts[i] ? green : orange; });
  if (layers.ik) pose.feet.forEach((f, i) => { const L = limbOf(layout.legs, i); setLine(ikLines[i], [limbToWorld({ x: 0, y: L.hip + (L.girdle ?? 0), z: 0 }, body.x, body.z, body.heading, pose, layout.hips[i]), f]); });
  if (layers.legs && !layers.body && realChains.length) realChains.forEach((c, i) => { const v = new THREE.Vector3(); setLine(boneLines[i], [c.girdle, c.upper, c.lower, c.foot, c.paw].map(o => o.getWorldPosition(v).clone())); });
  placeCamera(false); controls.update(); renderer.render(scene, camera);
  $('spv').textContent = state.speed.toFixed(1);
  $('ro').textContent = `${loco.jumping() ? 'POUNCE  ' : ''}gait ${pose.gait}  Fr ${pose.froude.toFixed(2)}  duty ${pose.duty.toFixed(2)}  ${(state.speed / Math.max(1e-6, pose.cycle)).toFixed(2)} Hz  ${pose.contacts.some(c => c) ? 'ground' : 'AIRBORNE'}${TIMESCALE < 1 ? `  x${TIMESCALE}` : ''}\nstride ${pose.cycle.toFixed(2)} m  pitch ${(pose.pitch * 57.3).toFixed(1)}°  roll ${(pose.roll * 57.3).toFixed(1)}°\n`
    + LEG_NAMES.map((n, i) => `${n} φ ${pose.phases[i].toFixed(2)} ${pose.contacts[i] ? 'down' : 'swing'}`).join('\n');
  drawStrip();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (q.get('stats') !== '1') document.title = 'ready';

/** ?stats=1: the wolf's budget (skin vertices, fur cards, triangles, GPU buffer bytes, draw calls) into document.title for headless runs. */
function statsOf(rootObj: THREE.Object3D) {
  let skinVerts = 0, furCards = 0, tris = 0, bytes = 0, meshes = 0;
  rootObj.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; meshes++; const g = m.geometry, n = g.attributes.position.count;
    if (o.name === 'skin') skinVerts = n; if (o.name === 'fur') furCards = n / 5;
    tris += (g.index ? g.index.count : n) / 3;
    for (const a of Object.values(g.attributes)) bytes += (a as THREE.BufferAttribute).array.byteLength; if (g.index) bytes += g.index.array.byteLength; });
  let casters = 0; rootObj.traverse(o => { if ((o as THREE.Mesh).isMesh && o.castShadow && o.visible) casters++; });
  // the wolf's own textures (RGBA8; mipmapped ones × 4/3): GPU memory = buffers + textures
  const texs = new Set<THREE.Texture>(); rootObj.traverse(o => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (!m) return;
    for (const v of Object.values(m)) if ((v as THREE.Texture)?.isTexture) texs.add(v as THREE.Texture); });
  let texBytes = 0; texs.forEach(t => { const im = t.image as { width: number; height: number }; texBytes += im.width * im.height * 4 * (t.generateMipmaps ? 4 / 3 : 1); });
  // three resets renderer.info AFTER the shadow pass, so its calls never show; count both passes by hand on one extra frame:
  // total (shadow map re-rendered) and main only (shadow map frozen), then restore the defaults
  const r = renderer.info, sm = renderer.shadowMap; r.autoReset = false;
  r.reset(); renderer.render(scene, camera); const calls = r.render.calls, sceneTris = r.render.triangles;
  sm.autoUpdate = false; sm.needsUpdate = false; r.reset(); renderer.render(scene, camera); const mainCalls = r.render.calls;
  sm.autoUpdate = true; r.autoReset = true;
  document.title = 'STATS ' + JSON.stringify({ rig: q.get('rig'), skinVerts, furCards, wolfTris: tris, wolfMeshes: meshes, wolfShadowCasters: casters, wolfBufferKB: Math.round(bytes / 1024), wolfTextures: texs.size, wolfTextureKB: Math.round(texBytes / 1024), wolfGpuKB: Math.round((bytes + texBytes) / 1024),
    sceneCalls: calls, mainPassCalls: mainCalls, shadowPassCalls: calls - mainCalls, sceneTris, geometries: r.memory.geometries, textures: r.memory.textures });
}
