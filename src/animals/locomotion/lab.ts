/**
 * Locomotion lab (dev page tools/locomotion-lab.html). One test quadruped walks a circle over a chosen terrain, driven
 * by the locomotion layer. Params: ?terrain=flat|hills|world  ?gait=auto|walk|trot|pace|canter|gallop|bound|pronk
 * ?speed=<m/s>  ?lod=near|mid  ?rig=stick|real  ?t=<seconds to pre-simulate>  ?cam=side|follow
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { heightAt } from '../../core/world';
import { createLocomotion, referenceLayout } from './controller';
import { GAIT_TABLE } from './gaits';
import { createStickRig } from './stickRig';
import { LEG_NAMES, type GaitId, type LegPose, type Lod, type TerrainFn } from './signals';

const q = new URLSearchParams(location.search);
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
  speed: Number(q.get('speed') ?? NaN), lod: (q.get('lod') === 'mid' ? 'mid' : 'near') as Lod, paused: false,
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
let poseReal: ((p: LegPose, a: typeof body) => void) | undefined;
if (q.get('rig') === 'real') void loadReal();

/** The furred wolf through the forked rig (fork/playerRig.ts): hook 2 poses legs, tilt and height exactly from our pose. */
async function loadReal() {
  const { createPlayerWolf } = await import('./fork/playerRig');
  const wolf = createPlayerWolf(1400); scene.add(wolf.root);
  wolf.root.traverse(o => { o.castShadow = true; });
  stick.root.visible = false;
  poseReal = (p, a) => {
    wolf.root.position.set(a.x, p.height, a.z); wolf.root.rotation.y = a.heading;
    wolf.animate(performance.now() / 1000, state.speed > .05, undefined, 0, 'walk', undefined, p);
  };
}

// foot markers: green = planted (locked in the world), orange = swing
const dotGeo = new THREE.SphereGeometry(.025, 10, 8), green = new THREE.MeshBasicMaterial({ color: 0x1fbf4a }), orange = new THREE.MeshBasicMaterial({ color: 0xff8a1f });
const dots = LEG_NAMES.map(() => { const m = new THREE.Mesh(dotGeo, green); scene.add(m); return m; });

// ---------------------------------------------------------------- UI: speed slider, gait/LOD pickers, readout, footfall strip
const css = document.createElement('style');
css.textContent = `body{margin:0;overflow:hidden;font:12px system-ui;color:#1d241c}#ui{position:absolute;left:10px;top:10px;background:#ffffffd9;padding:8px 10px;border-radius:6px;min-width:260px}
#ui label{display:block;margin:3px 0}#ui input[type=range]{width:150px;vertical-align:middle}#ro{font:11px ui-monospace,monospace;white-space:pre;margin-top:4px}canvas#strip{display:block;margin-top:6px;background:#f4f5ef}`;
document.head.append(css);
const ui = document.createElement('div'); ui.id = 'ui';
ui.innerHTML = `<b>Locomotion lab</b> · terrain ${terrainName}<label>speed <input id="sp" type="range" min="0" max="10" step=".1"> <span id="spv"></span> m/s</label>
<label>gait <select id="ga">${['auto', ...Object.keys(GAIT_TABLE)].map(g => `<option>${g}</option>`).join('')}</select> LOD <select id="lo"><option>near</option><option>mid</option></select> <button id="pa">pause</button></label>
<div id="ro"></div><canvas id="strip" width="260" height="56"></canvas>`;
document.body.append(ui);
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const sp = $<HTMLInputElement>('sp'), ga = $<HTMLSelectElement>('ga'), lo = $<HTMLSelectElement>('lo');
sp.value = String(state.speed); ga.value = state.gait ?? 'auto'; lo.value = state.lod;
sp.oninput = () => { state.speed = Number(sp.value); }; ga.onchange = () => { state.gait = ga.value === 'auto' ? undefined : ga.value as GaitId; }; lo.onchange = () => { state.lod = lo.value as Lod; };
$('pa').onclick = () => { state.paused = !state.paused; };
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
  path.a += state.speed * dt / R; body = at();
  pose = loco.update({ ...body, speed: state.speed, gait: state.gait }, dt, state.lod);
  history.push(pose.contacts.slice()); if (history.length > 240) history.shift();
}
const warm = Number(q.get('t') ?? 0);
for (let t = 0; t < warm; t += DT) simulate(DT);
const sideCam = q.get('cam') !== 'follow';
function placeCamera(initial: boolean) {
  const f = { x: -Math.sin(body.heading), z: -Math.cos(body.heading) };
  if (initial) {
    // side view: perpendicular to the direction of travel, slightly above
    const d = 2.6; camera.position.set(body.x + f.z * d * (sideCam ? 1 : .6) - f.x * (sideCam ? 0 : 1.6), pose.height + .9, body.z - f.x * d * (sideCam ? 1 : .6) - f.z * (sideCam ? 0 : 1.6));
  }
  const target = new THREE.Vector3(body.x, pose.height + .45, body.z), delta = target.clone().sub(controls.target);
  controls.target.copy(target); camera.position.add(delta); sun.position.set(body.x + 4, pose.height + 8, body.z + 3); sun.target.position.copy(target);
}
placeCamera(true);
let last = performance.now(), acc = 0;
function frame(now: number) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (!state.paused) { acc += dt; while (acc >= DT) { simulate(DT); acc -= DT; } }
  stick.apply(pose, body); poseReal?.(pose, body);
  pose.feet.forEach((f, i) => { dots[i].position.set(f.x, f.y + .02, f.z); dots[i].material = pose.contacts[i] ? green : orange; });
  placeCamera(false); controls.update(); renderer.render(scene, camera);
  $('spv').textContent = state.speed.toFixed(1);
  $('ro').textContent = `gait ${pose.gait}  Fr ${pose.froude.toFixed(2)}  duty ${pose.duty.toFixed(2)}\nstride ${pose.cycle.toFixed(2)} m  pitch ${(pose.pitch * 57.3).toFixed(1)}°  roll ${(pose.roll * 57.3).toFixed(1)}°\n`
    + LEG_NAMES.map((n, i) => `${n} φ ${pose.phases[i].toFixed(2)} ${pose.contacts[i] ? 'down' : 'swing'}`).join('\n');
  drawStrip();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
document.title = 'ready';
